"""Read a Rigol DS1054Z over USB and serve the trace to the page in this folder.

The scope is high-speed USB but its bulk endpoints advertise 64-byte packets.
Each transfer below is one packet. The first IN packet carries a 12-byte
USBTMC header; the packets after it are the rest of the message.

    python3 -m venv .venv
    .venv/bin/pip install -r requirements.txt
    .venv/bin/python server.py

Then open http://127.0.0.1:8765/
"""

import json
import math
import os
import queue
import re
import struct
import threading
import time
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.parse import urlparse

import usb.core
import usb.util

ROOT = Path(__file__).resolve().parent
HOST = "127.0.0.1"
PORT = 8765
VID = 0x1AB1
PID = 0x04CE
DS1000Z_IDN = re.compile(r"DS1\d{3}Z|MSO1\d{3}Z|DS1000Z", re.IGNORECASE)
FILES = {
    "/index.html": "text/html; charset=utf-8",
    "/app.js": "text/javascript; charset=utf-8",
    "/scope-view.js": "text/javascript; charset=utf-8",
}
BUILTIN_PRESETS = ROOT.parent / "presets"
SAVED_PRESETS = ROOT / "presets"
PRESET_LOCK = threading.Lock()
SLUG = re.compile(r"^[a-z0-9]+(?:-[a-z0-9]+)*$")


def as_byte(value, label):
    if isinstance(value, bool) or not isinstance(value, int) or value < 0 or value > 255:
        raise ValueError(label)
    return value


def normalize_effect(value):
    if not isinstance(value, dict):
        raise ValueError("Each trigger needs a mode and 7 parameters")
    params = value.get("params")
    if not isinstance(params, list) or len(params) != 7:
        raise ValueError("Each trigger needs 7 parameters")
    return {
        "mode": as_byte(value.get("mode"), "Mode must be a byte"),
        "params": [as_byte(item, "Parameters must be bytes") for item in params],
    }


def normalize_rumble(value):
    if not isinstance(value, dict):
        raise ValueError("Rumble needs low and high")
    return {
        "low": as_byte(value.get("low"), "Rumble must be a byte"),
        "high": as_byte(value.get("high"), "Rumble must be a byte"),
    }


def normalize_preset(body):
    if not isinstance(body, dict):
        raise ValueError("Preset must be an object")
    name = body.get("name")
    if not isinstance(name, str):
        raise ValueError("Name the preset")
    name = " ".join(name.split())
    if not name or len(name) > 60:
        raise ValueError("Name the preset")
    send_to_both = body.get("sendToBoth", True)
    if not isinstance(send_to_both, bool):
        raise ValueError("sendToBoth must be true or false")
    left = normalize_effect(body.get("left"))
    right = left if send_to_both else normalize_effect(body.get("right"))
    return {
        "name": name,
        "sendToBoth": send_to_both,
        "rumble": normalize_rumble(body.get("rumble")),
        "left": left,
        "right": right,
    }


def preset_slug(name):
    slug = re.sub(r"[^a-z0-9]+", "-", name.lower()).strip("-")[:64].strip("-")
    if not slug or slug == "index" or SLUG.fullmatch(slug) is None:
        raise ValueError("Name the preset")
    return slug


def read_preset(path, builtin):
    data = normalize_preset(json.loads(path.read_text(encoding="utf-8")))
    data["id"] = path.stem
    data["builtin"] = builtin
    return data


def list_presets():
    order = []
    index_path = BUILTIN_PRESETS / "index.json"
    if index_path.is_file():
        listed = json.loads(index_path.read_text(encoding="utf-8"))
        if isinstance(listed, list):
            order = [item for item in listed if isinstance(item, str)]
    found = {}
    if BUILTIN_PRESETS.is_dir():
        for path in BUILTIN_PRESETS.glob("*.json"):
            if path.name == "index.json":
                continue
            found[path.stem] = read_preset(path, True)
    presets = [found[preset_id] for preset_id in order if preset_id in found]
    for preset_id in sorted(found):
        if preset_id not in order:
            presets.append(found[preset_id])
    if SAVED_PRESETS.is_dir():
        for path in sorted(SAVED_PRESETS.glob("*.json"), key=lambda item: item.stem):
            try:
                presets.append(read_preset(path, False))
            except (OSError, ValueError, json.JSONDecodeError):
                continue
    return presets


def save_preset(body):
    preset = normalize_preset(body)
    slug = preset_slug(preset["name"])
    SAVED_PRESETS.mkdir(parents=True, exist_ok=True)
    path = (SAVED_PRESETS / f"{slug}.json").resolve()
    if path.parent != SAVED_PRESETS.resolve():
        raise ValueError("Name the preset")
    stored = {key: preset[key] for key in ("name", "sendToBoth", "rumble", "left", "right")}
    text = json.dumps(stored, indent=2) + "\n"
    with PRESET_LOCK:
        path.write_text(text, encoding="utf-8")
    return read_preset(path, False)


def libusb_backend():
    import usb.backend.libusb1 as libusb1

    backend = libusb1.get_backend()
    if backend is not None:
        return backend
    for path in ("/opt/homebrew/lib/libusb-1.0.dylib", "/usr/local/lib/libusb-1.0.dylib"):
        if os.path.exists(path):
            backend = libusb1.get_backend(find_library=lambda _name, path=path: path)
            if backend is not None:
                return backend
    raise RuntimeError("libusb was not found. Install it with: brew install libusb")


def pack_out(tag, payload):
    pad = (4 - ((12 + len(payload)) % 4)) % 4
    buf = bytearray(12 + len(payload) + pad)
    buf[0] = 1
    buf[1] = tag
    buf[2] = tag ^ 0xFF
    struct.pack_into("<I", buf, 4, len(payload))
    buf[8] = 0x01
    buf[12:12 + len(payload)] = payload
    return bytes(buf)


def pack_in(tag, max_bytes):
    buf = bytearray(12)
    buf[0] = 2
    buf[1] = tag
    buf[2] = tag ^ 0xFF
    struct.pack_into("<I", buf, 4, max_bytes)
    return bytes(buf)


def decode_ieee_block(data):
    start = data.find(0x23)
    if start < 0 or start + 2 > len(data):
        raise RuntimeError("Waveform header missing")
    digits = data[start + 1] - 0x30
    if digits < 1 or digits > 9:
        raise RuntimeError("Waveform header missing")
    length_start = start + 2
    data_start = length_start + digits
    if data_start > len(data):
        raise RuntimeError("Waveform header truncated")
    length = 0
    for byte in data[length_start:data_start]:
        digit = byte - 0x30
        if digit < 0 or digit > 9:
            raise RuntimeError("Waveform header missing")
        length = length * 10 + digit
    if data_start + length > len(data):
        raise RuntimeError("Waveform truncated")
    return data[data_start:data_start + length]


def parse_preamble(text):
    parts = [float(part.strip()) for part in str(text).strip().split(",")]
    if len(parts) < 10 or not all(math.isfinite(part) for part in parts[:10]):
        raise RuntimeError("Bad waveform preamble")
    keys = (
        "format", "type", "points", "count",
        "xincrement", "xorigin", "xreference",
        "yincrement", "yorigin", "yreference",
    )
    return dict(zip(keys, parts[:10]))


def volts_from_bytes(samples, preamble):
    yorigin = preamble["yorigin"]
    yreference = preamble["yreference"]
    yincrement = preamble["yincrement"]
    return [(byte - yorigin - yreference) * yincrement for byte in samples]


def step125(value, direction):
    decades = (1, 2, 5)
    if not (value > 0) or not math.isfinite(value):
        return value
    exp = math.floor(math.log10(value * (1 + 1e-12)))
    mantissa = value / (10 ** exp)
    index = min(range(3), key=lambda i: abs(math.log(mantissa) - math.log(decades[i])))
    index += -1 if direction < 0 else 1
    decade = exp
    while index >= len(decades):
        index -= len(decades)
        decade += 1
    while index < 0:
        index += len(decades)
        decade -= 1
    return float(f"{decades[index] * (10 ** decade):.8e}")


def is_displayed(text):
    value = str(text).strip().upper()
    return value in ("1", "ON")


def blank_frame(error=None, identity=""):
    return {
        "connected": False,
        "identity": identity,
        "error": error,
        "timeScale": None,
        "timeOffset": None,
        "sampleRate": None,
        "trigger": {"status": "", "source": "", "level": None},
        "channels": [],
    }


class Usbtmc:
    def __init__(self, dev, ep_out, ep_in, interface, packet):
        self.dev = dev
        self.ep_out = ep_out
        self.ep_in = ep_in
        self.interface = interface
        self.packet = packet
        self.tag = 1
        self.last_tag = 1

    @classmethod
    def open_scope(cls):
        dev = usb.core.find(idVendor=VID, idProduct=PID, backend=libusb_backend())
        if dev is None:
            raise RuntimeError("No DS1054Z found on USB")
        try:
            dev.reset()
        except usb.core.USBError:
            pass
        dev = usb.core.find(idVendor=VID, idProduct=PID, backend=libusb_backend())
        if dev is None:
            raise RuntimeError("No DS1054Z found on USB")
        try:
            if dev.is_kernel_driver_active(0):
                dev.detach_kernel_driver(0)
        except (NotImplementedError, usb.core.USBError):
            pass
        try:
            cfg = dev.get_active_configuration()
        except usb.core.USBError:
            dev.set_configuration()
            cfg = dev.get_active_configuration()
        intf = usb.util.find_descriptor(cfg, bInterfaceClass=0xFE, bInterfaceSubClass=3)
        if intf is None:
            raise RuntimeError("The selected device is not a USBTMC instrument.")
        ep_out = None
        ep_in = None
        for endpoint in intf:
            if usb.util.endpoint_type(endpoint.bmAttributes) != usb.util.ENDPOINT_TYPE_BULK:
                continue
            if usb.util.endpoint_direction(endpoint.bEndpointAddress) == usb.util.ENDPOINT_OUT:
                ep_out = endpoint
            else:
                ep_in = endpoint
        if ep_out is None or ep_in is None:
            raise RuntimeError("The instrument is missing its bulk endpoints.")
        number = intf.bInterfaceNumber
        try:
            usb.util.claim_interface(dev, number)
        except usb.core.USBError as error:
            raise RuntimeError(
                "Could not claim the USB interface. Close anything else using the scope, then connect again."
            ) from error
        # The descriptor says 512, but this scope sends 64-byte bulk packets.
        # A short read is the end of a message only when it is shorter than 64.
        for endpoint in (ep_out, ep_in):
            try:
                dev.clear_halt(endpoint.bEndpointAddress)
            except usb.core.USBError:
                pass
        scope = cls(dev, ep_out, ep_in, number, 64)
        scope.flush_in()
        return scope

    def control_in(self, request, value, index, length):
        return self.dev.ctrl_transfer(0xA1, request, value, index, length, timeout=1000)

    def close(self):
        dev = self.dev
        self.dev = None
        if dev is None:
            return
        try:
            usb.util.release_interface(dev, self.interface)
        except usb.core.USBError:
            pass
        try:
            usb.util.dispose_resources(dev)
        except usb.core.USBError:
            pass

    def next_tag(self):
        tag = self.tag
        self.tag = 1 if tag == 255 else tag + 1
        return tag

    def write(self, text):
        if not text.endswith("\n"):
            text += "\n"
        tag = self.next_tag()
        self.bulk_out(pack_out(tag, text.encode()))

    def query(self, text, max_bytes=4096):
        self.write(text)
        payload = self.bulk_in(max_bytes)
        return payload.replace(b"\x00", b"").decode("ascii", "replace").strip()

    def query_binary(self, text, max_bytes=16384):
        self.write(text)
        return self.bulk_in(max_bytes)

    def bulk_out(self, message):
        for offset in range(0, len(message), self.packet):
            chunk = message[offset:offset + self.packet]
            try:
                written = self.ep_out.write(chunk, timeout=2000)
            except usb.core.USBError:
                self.clear_halt()
                written = self.ep_out.write(chunk, timeout=2000)
            if written != len(chunk):
                raise RuntimeError("USB write failed")

    def clear_halt(self):
        if self.dev is None:
            return
        for endpoint in (self.ep_out, self.ep_in):
            try:
                self.dev.clear_halt(endpoint.bEndpointAddress)
            except usb.core.USBError:
                pass

    def bulk_in(self, max_bytes):
        # A waveform is several USBTMC transfers. Each one is at most 500
        # payload bytes, and EOM stays clear until the last transfer.
        message = bytearray()
        while len(message) < max_bytes:
            payload, eom = self.read_transfer(max_bytes - len(message))
            message.extend(payload)
            if eom:
                break
        return bytes(message)

    def read_transfer(self, max_bytes):
        tag = self.next_tag()
        self.last_tag = tag
        self.bulk_out(pack_in(tag, max_bytes))
        chunks = []
        got = 0
        size = None
        eom = 1
        deadline = time.monotonic() + 2
        while size is None or got < 12 + size:
            if time.monotonic() > deadline:
                self.abort_in()
                raise TimeoutError("The scope did not answer")
            try:
                packet = bytes(self.ep_in.read(self.packet, timeout=2000))
            except usb.core.USBTimeoutError:
                self.abort_in()
                raise TimeoutError("The scope did not answer") from None
            if not packet:
                if not chunks:
                    continue
                break
            chunks.append(packet)
            got += len(packet)
            if size is None and got >= 12:
                head = b"".join(chunks)
                if head[0] != 2:
                    raise RuntimeError("Unexpected USB reply")
                size = struct.unpack_from("<I", head, 4)[0]
                eom = head[8] & 1
                if size > max_bytes:
                    self.abort_in()
                    raise RuntimeError("The scope reply is larger than requested")
            if size is not None and got >= 12 + size:
                break
            if len(packet) < self.packet:
                break
        if size is None:
            raise RuntimeError("The scope sent an empty reply")
        if got % self.packet == 0:
            self.flush_in(timeout=200)
        return b"".join(chunks)[12:12 + size], eom

    def flush_in(self, timeout=30):
        if self.dev is None:
            return
        try:
            while True:
                packet = self.ep_in.read(self.packet, timeout=timeout)
                if not packet:
                    break
        except usb.core.USBTimeoutError:
            pass

    def abort_in(self):
        if self.dev is None:
            return
        try:
            self.dev.ctrl_transfer(0xA2, 3, self.last_tag, self.ep_in.bEndpointAddress, 2, timeout=500)
        except usb.core.USBError:
            pass


class Rigol:
    def __init__(self, usb):
        self.usb = usb

    def write(self, command):
        self.usb.write(command)

    def query(self, command):
        return self.usb.query(command)

    def identify(self):
        idn = self.query("*IDN?")
        if not DS1000Z_IDN.search(idn):
            raise RuntimeError("Connected to " + idn + ", which is not a DS1000Z scope.")
        return idn

    def read_channel(self, index):
        displayed = is_displayed(self.query(f":CHAN{index}:DISP?"))
        scale = float(self.query(f":CHAN{index}:SCAL?"))
        offset = float(self.query(f":CHAN{index}:OFFS?"))
        if not displayed:
            return {"index": index, "enabled": False, "scale": scale, "offset": offset, "volts": None}
        self.write(
            f":WAV:SOUR CHAN{index};:WAV:MODE NORM;:WAV:FORM BYTE;:WAV:STAR 1;:WAV:STOP 1200"
        )
        preamble = parse_preamble(self.query(":WAV:PRE?"))
        if preamble["format"] != 0:
            raise RuntimeError("Scope did not return BYTE waveform data")
        block = decode_ieee_block(self.query_binary(":WAV:DATA?"))
        return {
            "index": index,
            "enabled": True,
            "scale": scale,
            "offset": offset,
            "volts": volts_from_bytes(block, preamble),
        }

    def query_binary(self, command):
        return self.usb.query_binary(command)

    def read_frame(self):
        time_scale = float(self.query(":TIM:SCAL?"))
        time_offset = float(self.query(":TIM:OFFS?"))
        sample_rate = float(self.query(":ACQ:SRAT?"))
        trigger_status = self.query(":TRIG:STAT?").strip()
        trigger_source = ""
        trigger_level = None
        try:
            trigger_source = self.query(":TRIG:EDG:SOUR?").strip()
            trigger_level = float(self.query(":TRIG:EDG:LEV?"))
        except (RuntimeError, TimeoutError, ValueError, usb.core.USBError):
            pass
        channels = [self.read_channel(index) for index in range(1, 5)]
        return {
            "timeScale": time_scale,
            "timeOffset": time_offset,
            "sampleRate": sample_rate,
            "trigger": {
                "status": trigger_status,
                "source": trigger_source,
                "level": trigger_level,
            },
            "channels": channels,
        }


def clamp(value, low, high):
    return min(high, max(low, value))


class Hub:
    def __init__(self):
        self.lock = threading.Lock()
        self.commands = queue.Queue()
        self.frame = blank_frame()
        self.want_open = True
        self.stop = False
        self.thread = threading.Thread(target=self.run, name="scope-io", daemon=True)
        self.usb = None
        self.scope = None
        self.identity = ""
        self.noted = None

    def start(self):
        self.thread.start()

    def shutdown(self):
        self.stop = True
        self.thread.join(timeout=3)
        self.close_scope()

    def snapshot(self):
        with self.lock:
            return self.frame

    def publish(self, frame):
        with self.lock:
            self.frame = frame

    def note(self, message):
        if message == self.noted:
            return
        self.noted = message
        print(message, flush=True)

    def close_scope(self):
        usb_dev = self.usb
        self.usb = None
        self.scope = None
        self.identity = ""
        if usb_dev is not None:
            usb_dev.close()

    def run(self):
        while not self.stop:
            self.drain()
            if self.stop:
                break
            if not self.want_open:
                if self.usb is not None:
                    self.close_scope()
                    self.publish(blank_frame())
                    self.note("scope closed")
                time.sleep(0.1)
                continue
            if self.scope is None:
                try:
                    self.usb = Usbtmc.open_scope()
                    self.scope = Rigol(self.usb)
                    self.identity = self.scope.identify()
                    self.note("connected: " + self.identity)
                except Exception as error:
                    self.close_scope()
                    self.publish(blank_frame(str(error)))
                    self.note(str(error))
                    time.sleep(1)
                    continue
            try:
                frame = self.scope.read_frame()
            except usb.core.USBError as error:
                self.close_scope()
                self.publish(blank_frame("Scope disconnected"))
                self.note("Scope disconnected: " + str(error))
                time.sleep(0.4)
                continue
            except Exception as error:
                self.publish({
                    "connected": True,
                    "identity": self.identity,
                    "error": str(error),
                    "timeScale": None,
                    "timeOffset": None,
                    "sampleRate": None,
                    "trigger": {"status": "", "source": "", "level": None},
                    "channels": [],
                })
                self.note(str(error))
                time.sleep(0.4)
                continue
            frame["connected"] = True
            frame["identity"] = self.identity
            frame["error"] = None
            self.publish(frame)

    def drain(self):
        while True:
            try:
                kind, body = self.commands.get_nowait()
            except queue.Empty:
                return
            try:
                self.handle(kind, body)
            except Exception as error:
                self.note(str(error))

    def handle(self, kind, body):
        if kind == "connect":
            self.want_open = bool(body)
            if not self.want_open:
                self.close_scope()
                self.publish(blank_frame())
            return
        if self.scope is None:
            return
        if kind == "scpi":
            command = str(body).strip()
            if not command or "\n" in command or len(command) > 200:
                raise RuntimeError("Bad command")
            self.scope.write(command)
            return
        if kind != "step":
            return
        direction = int(body.get("direction", 0))
        if direction not in (-1, 1):
            return
        if body.get("target") == "time":
            current = float(self.scope.query(":TIM:SCAL?"))
            nxt = clamp(step125(current, direction), 5e-9, 50)
            self.scope.write(":TIM:SCAL " + format(nxt, ".6e"))
            return
        if body.get("target") == "channel":
            index = int(body.get("index", 0))
            if index not in (1, 2, 3, 4):
                return
            current = float(self.scope.query(f":CHAN{index}:SCAL?"))
            nxt = clamp(step125(current, direction), 1e-3, 100)
            self.scope.write(f":CHAN{index}:SCAL " + format(nxt, ".6e"))


hub = Hub()


class Handler(BaseHTTPRequestHandler):
    def log_message(self, fmt, *args):
        return

    def do_GET(self):
        path = urlparse(self.path).path
        if path == "/api/frame":
            self.send_json(hub.snapshot())
            return
        if path == "/api/presets":
            try:
                self.send_json({"presets": list_presets()})
            except (OSError, ValueError, json.JSONDecodeError):
                self.send_json({"ok": False, "error": "Could not load presets"}, 500)
            return
        if path == "/":
            path = "/index.html"
        if path == "/controller/dualsense.js":
            self.send_file(ROOT.parent.parent / "controller" / "dualsense.js", "text/javascript; charset=utf-8")
            return
        mime = FILES.get(path)
        if mime is None:
            self.send_error(404)
            return
        self.send_file(ROOT / path.lstrip("/"), mime)

    def send_file(self, path, mime):
        body = path.read_bytes()
        self.send_response(200)
        self.send_header("Content-Type", mime)
        self.send_header("Content-Length", str(len(body)))
        self.send_header("Cache-Control", "no-store")
        self.end_headers()
        self.wfile.write(body)

    def do_POST(self):
        path = urlparse(self.path).path
        length = int(self.headers.get("Content-Length", "0") or 0)
        if length > 8192:
            self.send_json({"ok": False, "error": "Preset is too large"}, 400)
            return
        raw = self.rfile.read(length) if length else b"{}"
        try:
            body = json.loads(raw.decode())
        except (UnicodeDecodeError, json.JSONDecodeError):
            self.send_json({"ok": False, "error": "Bad JSON"}, 400)
            return
        if path == "/api/connect":
            hub.commands.put(("connect", bool(body.get("open"))))
        elif path == "/api/scpi":
            hub.commands.put(("scpi", body.get("command", "")))
        elif path == "/api/step":
            hub.commands.put(("step", body))
        elif path == "/api/presets":
            try:
                saved = save_preset(body)
            except ValueError as error:
                self.send_json({"ok": False, "error": str(error)}, 400)
                return
            except OSError:
                self.send_json({"ok": False, "error": "Could not save the preset"}, 500)
                return
            self.send_json({"ok": True, "preset": saved})
            return
        else:
            self.send_json({"ok": False}, 404)
            return
        self.send_json({"ok": True})

    def send_json(self, payload, status=200):
        body = json.dumps(payload, allow_nan=False).encode()
        self.send_response(status)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(body)))
        self.send_header("Cache-Control", "no-store")
        self.end_headers()
        self.wfile.write(body)


def main():
    hub.start()
    server = ThreadingHTTPServer((HOST, PORT), Handler)
    print(f"DS1054Z viewer at http://{HOST}:{PORT}/", flush=True)
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        print()
    finally:
        server.server_close()
        hub.shutdown()


if __name__ == "__main__":
    main()
