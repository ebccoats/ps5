// USBTMC over WebUSB. The DS1054Z is high-speed but its bulk endpoints advertise
// 64-byte packets. A transfer longer than one packet is cut off after the first,
// so every read and write below is a single packet. The 12-byte header on the
// first IN packet says how many message bytes follow; later packets are raw data.

const USBTMC_DEV_DEP_MSG_OUT = 1;
const USBTMC_REQUEST_DEV_DEP_MSG_IN = 2;
const USBTMC_DEV_DEP_MSG_IN = 2;
const USBTMC_INITIATE_ABORT_BULK_IN = 3;
const USBTMC_INITIATE_CLEAR = 5;
const USBTMC_GET_CAPABILITIES = 7;

function concatBytes(chunks) {
    let length = 0;
    for (const chunk of chunks)
        length += chunk.length;
    const out = new Uint8Array(length);
    let offset = 0;
    for (const chunk of chunks) {
        out.set(chunk, offset);
        offset += chunk.length;
    }
    return out;
}

function copyDataView(view) {
    const out = new Uint8Array(view.byteLength);
    for (let i = 0; i < view.byteLength; i++)
        out[i] = view.getUint8(i);
    return out;
}

class Usbtmc {
    constructor() {
        this.device = null;
        this.interfaceNumber = 0;
        this.epOut = 0;
        this.epIn = 0;
        this.packetSize = 64;
        this.tag = 1;
        this.lastInTag = 1;
        this.tail = Promise.resolve();
    }

    nextTag() {
        const tag = this.tag;
        this.tag = tag === 255 ? 1 : tag + 1;
        return tag;
    }

    lock(fn) {
        const run = this.tail.then(fn, fn);
        this.tail = run.then(() => {}, () => {});
        return run;
    }

    async request() {
        if (!navigator.usb)
            throw new Error("WebUSB is unavailable. Open this page from localhost in Chrome or Edge.");
        let device;
        try {
            device = await navigator.usb.requestDevice({
                filters: [{ vendorId: 0x1ab1, productId: 0x04ce }]
            });
        } catch (error) {
            if (error && (error.name === "NotFoundError" || error.name === "AbortError"))
                return null;
            throw error;
        }
        await this.open(device);
        return device;
    }

    async open(device) {
        await this.close();
        this.device = device;
        if (!device.opened)
            await device.open();
        if (device.configuration == null)
            await device.selectConfiguration(1);

        const iface = device.configuration.interfaces[0];
        this.interfaceNumber = iface.interfaceNumber;
        const alt = iface.alternates[0];
        if (alt.interfaceClass !== 0xfe || alt.interfaceSubclass !== 3)
            throw new Error("The selected device is not a USBTMC instrument.");

        let out = null;
        let inn = null;
        for (const endpoint of alt.endpoints) {
            if (endpoint.type !== "bulk")
                continue;
            if (endpoint.direction === "out")
                out = endpoint;
            else if (endpoint.direction === "in")
                inn = endpoint;
        }
        if (!out || !inn)
            throw new Error("The instrument is missing its bulk endpoints.");
        this.epOut = out.endpointNumber;
        this.epIn = inn.endpointNumber;
        this.packetSize = inn.packetSize || 64;

        try {
            await device.claimInterface(this.interfaceNumber);
        } catch (error) {
            throw new Error("Could not claim the USB interface. Close UltraSigma, VISA, or anything else using the scope, then connect again.");
        }
        await this.controlIn(USBTMC_GET_CAPABILITIES, 0, 24).catch(() => {});
        await this.controlIn(USBTMC_INITIATE_CLEAR, 0, 1).catch(() => {});
    }

    controlIn(request, value, length) {
        return this.device.controlTransferIn({
            requestType: "class",
            recipient: "interface",
            request,
            value,
            index: this.interfaceNumber
        }, length);
    }

    async close() {
        const device = this.device;
        this.device = null;
        if (!device)
            return;
        try {
            if (device.opened)
                await device.releaseInterface(this.interfaceNumber);
        } catch (error) {}
        try {
            if (device.opened)
                await device.close();
        } catch (error) {}
    }

    write(text) {
        return this.lock(() => this.writeUnlocked(text));
    }

    query(text, maxBytes) {
        return this.lock(async () => {
            await this.writeUnlocked(text);
            return this.readUnlocked(maxBytes == null ? 8192 : maxBytes);
        });
    }

    async writeUnlocked(text) {
        const device = this.requireDevice();
        const payload = new TextEncoder().encode(text.endsWith("\n") ? text : text + "\n");
        const tag = this.nextTag();
        await this.bulkOut(device, packOut(tag, payload));
    }

    packetBytes() {
        const reported = this.packetSize || 64;
        return reported > 64 ? 64 : reported;
    }

    async bulkOut(device, message) {
        const packet = this.packetBytes();
        for (let offset = 0; offset < message.length; offset += packet) {
            const chunk = message.subarray(offset, offset + packet);
            const result = await device.transferOut(this.epOut, chunk);
            if (result.status !== "ok")
                throw new Error("USB write failed (" + result.status + ")");
        }
    }

    async readUnlocked(maxBytes) {
        const device = this.requireDevice();
        const tag = this.nextTag();
        this.lastInTag = tag;
        await this.bulkOut(device, packIn(tag, maxBytes));

        const chunks = [];
        let got = 0;
        let size = null;
        const started = performance.now();
        const packet = this.packetBytes();
        while (size == null || got < 12 + size) {
            if (performance.now() - started > 2000) {
                await this.abortIn().catch(() => {});
                throw new Error("The scope did not answer");
            }
            const result = await device.transferIn(this.epIn, packet);
            if (result.status !== "ok")
                throw new Error("USB read failed (" + result.status + ")");
            if (!result.data || result.data.byteLength === 0) {
                if (chunks.length === 0)
                    continue;
                await this.abortIn().catch(() => {});
                throw new Error("The scope reply ended early");
            }
            const bytes = copyDataView(result.data);
            chunks.push(bytes);
            got += bytes.length;
            if (size == null && got >= 12) {
                const head = concatBytes(chunks);
                if (head[0] !== USBTMC_DEV_DEP_MSG_IN)
                    throw new Error("Unexpected USB reply");
                size = head[4] | (head[5] << 8) | (head[6] << 16) | (head[7] << 24);
                if (size > maxBytes) {
                    await this.abortIn().catch(() => {});
                    throw new Error("The scope reply is larger than requested");
                }
            }
            if (size != null && got >= 12 + size)
                break;
            if (bytes.length < packet) {
                await this.abortIn().catch(() => {});
                throw new Error("The scope reply ended early");
            }
        }
        const all = concatBytes(chunks);
        return all.slice(12, 12 + size);
    }

    async abortIn() {
        if (!this.device || !this.device.opened)
            return;
        await this.controlIn(USBTMC_INITIATE_ABORT_BULK_IN, this.lastInTag, 2).catch(() => {});
        await this.controlIn(USBTMC_INITIATE_CLEAR, 0, 1).catch(() => {});
    }

    requireDevice() {
        if (!this.device || !this.device.opened)
            throw new Error("Scope is not open");
        return this.device;
    }
}

function packOut(tag, payload) {
    const pad = (4 - ((12 + payload.length) % 4)) % 4;
    const bytes = new Uint8Array(12 + payload.length + pad);
    bytes[0] = USBTMC_DEV_DEP_MSG_OUT;
    bytes[1] = tag;
    bytes[2] = tag ^ 0xff;
    new DataView(bytes.buffer).setUint32(4, payload.length, true);
    bytes[8] = 0x01;
    bytes.set(payload, 12);
    return bytes;
}

function packIn(tag, maxBytes) {
    const bytes = new Uint8Array(12);
    bytes[0] = USBTMC_REQUEST_DEV_DEP_MSG_IN;
    bytes[1] = tag;
    bytes[2] = tag ^ 0xff;
    new DataView(bytes.buffer).setUint32(4, maxBytes, true);
    return bytes;
}

if (typeof module !== "undefined" && module.exports) {
    module.exports = { packOut, packIn };
}
