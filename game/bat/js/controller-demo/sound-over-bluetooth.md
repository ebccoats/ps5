# DualSense speaker audio over Bluetooth

Handoff for the next attempt. The test page is `dualsenseScriptTest.html`. Protocol code is `dualsense-gallop.js`. `dualsense.js` is the untouched baseline. Do not edit `dualsense.js`, `gallopGame.js`, `gallopGame.html`, `index.js`, or `index.html`. Keep DOM in the HTML page. Keep the three-line header at the top of `dualsense-gallop.js`. Small diffs.

Serve the page from this directory and open it in Chrome or Edge:

```
python3 -m http.server 8734
```

`http://127.0.0.1:8734/dualsenseScriptTest.html`

WebHID only works on localhost. The embedded Cursor browser cannot complete the HID picker and cannot hear the controller. Hardware checks have to be done by the user.

## Goal

One unbroken 440 Hz tone from a DualSense over Bluetooth, on the internal speaker and on the headphone jack. USB is a different path and is not this bug.

## What the user confirmed, by ear

These are the only audio results that came back from the controller.

- Bluetooth output report `0x36`, with the send loop that drops a frame when `sendReport` is still in flight, plays on **both** the internal speaker and the headphone jack. Continuous mode sounded like a rapid series of beeps with a click between them. That was the best Bluetooth result.
- The same page's **Play on computer** button plays a smooth 440 Hz sine through the Mac's default output. The tone itself is fine. That button does not call `selectAudioOutput`.
- Switching that same stream to PadForge's shorter report `0x35` made the beeps faster. It did not become one tone. `0x35` was reverted.
- Looping a ~213 ms pre-encoded clip (20 × 200-byte Opus frames, `TONE_FRAMES_B64` in the page) sounds like beeps in a row. The user rejected that. Continuous mode must be a live stream.
- A live WebCodecs encoder, still sent by the dropping loop, was still beeps with clicks. The encoder change alone did not fix continuity.
- Writing the 512→480 packed frames **before** `audioControl` and the speaker/headset lane were patched into the `0x36` snapshot produced silence on the jack and the speaker. After those fields were patched, the choppy tone came back. Routing matters.
- Allowing two `sendSpeakerFrame` calls in flight made both outputs silent.
- Sending strictly one report at a time, and sending the next frame as soon as the previous promise settled, stayed silent.
- The current loop (one report at a time, on a 10.667 ms timer, frame kept while a write is in flight, with a `Playing · N sent` counter) was tried once and was still silent. The user did not report the counter text, and it is unknown whether the controller was power-cycled first.

Lightbar and player LEDs already work on USB and Bluetooth. Do not regress them. Bluetooth lightbar needs one report with byte 38 = `0x02` and byte 41 = `0x02` before later color writes. Player LED brightness `0x00` is high. `valid_flag1` stays `0xd7`. While a tone is playing, `valid_flag0` is `0xf0` so the rumble bits stay clear and the actuators can stay in audio mode.

## What was checked in this browser, not on the controller

Chrome's `AudioEncoder` accepts:

```
codec: "opus"
sampleRate: 48000
numberOfChannels: 2
bitrate: 160000
bitrateMode: "constant"
latencyMode: "realtime"
opus: { frameDuration: 10000, complexity: 0 }
```

It emits 200-byte packets whose first byte is TOC `0xF4` (CELT-only, fullband, 10 ms, stereo, one frame). Decoding that stream with `AudioDecoder` joins the 440 Hz sine with a boundary jump of about one sample (~0.061). The bitstream produced in the browser is continuous. That does not prove the controller's decoder is happy with it.

A local `libopus` ctypes experiment against Homebrew's dylib failed earlier (`OPUS_SET_EXPERT_FRAME_DURATION` / bitrate ctls returned -1). Do not repeat it. ffmpeg is at `/opt/homebrew/bin/ffmpeg`.

## How the audio path actually works

Bluetooth speaker and headphone audio is Opus inside a HID output report. It is not A2DP and it is not a browser audio output. The Gamepad API cannot play it. The Gamepad API only reads buttons and axes and can rumble.

USB speaker audio is a USB audio-class device. The page plays it with a Web Audio oscillator plus `selectAudioOutput` / `setSinkId`. Report `0x36` is Bluetooth-only.

`sendReport` data does **not** include the report id. A 398-byte DualSense report is a 397-byte WebHID buffer. CRC is `fillDualSenseChecksum(reportId, payload)`: prefix `[0xa2, reportId]`, CRC32 over everything except the last 4 bytes, little-endian into those 4 bytes. DS5Dongle CRCs the buffer **including** the report id, seeded with `0xA2`. Those two procedures are the same calculation. It has not been re-checked byte for byte against a capture.

The controller consumes a 10 ms Opus frame over a 512-sample tick at 48 kHz. The send period is `512 / 48000` seconds = **10.667 ms**, not 10 ms. Sending on a 10 ms clock overruns the controller (~6.7% fast). DS5Dongle resamples 512 input samples down to 480 before the encoder for this reason. The page does that in `encodeToneFrame` by packing 512 samples of the sine into each 480-sample Opus frame. A late tick must not be repaid with a burst. Firmware drops back-to-back catch-up packets.

## Report that made sound

`DualSenseHid.sendSpeakerFrame` builds report `0x36`. Layout below is the WebHID buffer (dongle index minus 1). This matches loteran/DS5Dongle `src/audio.cpp` (fork of awalol/DS5Dongle; default branch is `master`).

| WebHID index | Value |
| --- | --- |
| 0 | sequence nibble `<< 4` (`audioSeq_`) |
| 1 | `0x91` |
| 2 | `0x07` |
| 3 | `0xfe` (mic closed) |
| 4..8 | `32` five times. Only index 8 is the buffer length that the dongle says takes effect. Range used by the dongle is 16–128, default 32 |
| 9 | `audioCounter_` |
| 10 | `0x90` |
| 11 | `63` |
| 12..74 | 63-byte state snapshot (`speakerState_`). Volumes are then overwritten: headphone at 16, speaker at 17, mic at 18, `audioControl_` at 19, preamp at 49 (low 3 bits) |
| 75 | `0x92` |
| 76 | `64` |
| 77..140 | haptic PCM, currently zeros |
| 141 | lane: `0x16` headset, `0x15` headset+speaker, `0x13` speaker, always OR `0x80` |
| 142 | `200` |
| 143..342 | Opus frame |
| 393..396 | CRC |

Lane selection in the current code: headset if the page passes `headset` (dropdown value `"2"`) or `audioControl_ === 0x02`. Else `0x15` when `audioControl_ === 0x22`. Else `0x13`.

Dropdown values, from the common output `audio_control` byte: Off `0`, Headset `0x02`, Speaker `0x30` (48), Headset and speaker `0x22` (34). `prepareToneLevels` switches Off to Speaker, raises a zero headphone volume to 80 for headset or both, raises a zero speaker volume to 100 for any non-headset path, and raises a zero preamp to 2.

PadForge (hifihedgehog) uses a different working layout: report `0x35`, 334 bytes including the report id, no 63-byte state snapshot, buffer length default 48. Combined with haptics it is still `0x35`, with the audio packet further along. On this controller that report was audible and choppier-faster, then abandoned. Do not switch back to it unless a measured `sendReport` time shows the 397-byte write cannot keep 10.667 ms and the shorter report can.

## Send loop

Current loop is `startBluetoothTone` in `dualsenseScriptTest.html`.

- One `0x31` output report is sent first, with `speakerTone_` set, so volumes and `valid_flag0 = 0xf0` go out. The animation frame skips controllers in `toneControllers`, so it does not fight the audio writes.
- Then one `0x36` at a time. `sending` is a `WeakSet`. If a write is outstanding, the Opus frame stays at the head of `toneQueue`.
- Timer period is 10.667 ms. A late wake schedules the next grid point. It does not emit a catch-up burst.
- The note under the button is supposed to read `Playing · N sent` or `N sent, M failed` plus `speakerError_`. **That text was never reported.** Read it before changing the packet again.
- If the setup `0x31` does not settle within 800 ms the page says the Bluetooth write stalled and does not start the tone.

The version that actually made sound was simpler and lossy: every 10.667 ms it `shift()`ed a frame, and if `sending` already contained the controller it **threw that frame away** and waited for the next tick. A missing Opus frame is a decoder click plus a gap, which matches "beeps with clicking between them." `sendReport` was still in flight on the next tick often enough that about every other frame was discarded. So the browser write is often slower than 10.667 ms. That measurement was not timed directly. It is inferred from the drops.

Two later attempts to stop dropping frames (`inFlight < 2`, then a single in-flight send that continues as soon as the promise settles) produced silence. Treat "never overlap `sendReport`" as a constraint. Chrome on macOS can reject a second output report while one is pending. Whether these two attempts wedged the radio until a power cycle is **not confirmed**. The user was asked to turn the controller off and on before the last listen, and the result was still silence, with no counter text.

## Approaches that are dead ends

- **Gamepad API, even for audio only.** It cannot see the Bluetooth speaker or jack.
- **Pico W firmware** ([rafaelvaloto/Pico_W-Dualsense](https://github.com/rafaelvaloto/Pico_W-Dualsense)). The README marks audio as not planned. `ProcessAudioHaptic` and `InitializeAudioDevice` are empty. The only interrupt write is the 79-byte report `0x31`. Do not copy its Bluetooth output header. The header that made LEDs work here is the kernel-style one already in `sendOutputReport`: sequence nibble and tag `0x10`.
- **Dualsense-Multiplatform** (Gamepad-Core) `AudioHapticUpdate`. It fills a buffer starting `0x36`, but the Pico never calls it, and its audio packet ids are `0x95` / `0x96`, not `0x13` / `0x16`. There is no state snapshot.
- **Looped pre-encoded clip** as the continuous tone.
- **Report `0x35`** as a substitute for fixing delivery of `0x36`. Faster beeps only.
- **Two overlapping `sendReport(0x36)` calls.** Silence on both outputs.
- **Assuming the browser write is as fast as DS5Dongle or PadForge.** Those programs write to a local USB device (a Pico bridge, or a dongle that then relays). This page writes to the Bluetooth radio through WebHID. Their 10.667 ms cadence is the controller's cadence, not evidence that `sendReport` returns in under 10.667 ms.

## Open questions

1. On the current page, after a reload and a fresh connect, what does the note say while Continuous is running? `Playing · N sent` with N climbing means the writes are accepted and the controller is rejecting or muting the payload. `failed` plus the error string means WebHID is refusing the report. `Bluetooth write stalled` means the setup `0x31` never finished. Do not guess which one it is.
2. Time one `sendReport(0x36)`. If it is reliably under 10.667 ms, a no-drop one-at-a-time loop can be continuous. If it is over 10.667 ms, the 32 ms jitter buffer will drain and the tone will gap even with a perfect Opus stream. A larger buffer length only covers jitter. It does not fix a sustained rate deficit.
3. Do not pipeline a second `sendReport` until that timing exists, and do not burst a backlog. The controller drops catch-up bursts.
4. If writes succeed and the speaker stays quiet, diff a captured `0x36` against DS5Dongle, including CRC, the five buffer-length bytes, the 63-byte state image, and lanes `0x13` / `0x16`. The choppy-but-audible build is the baseline for "this payload can be heard." The silent builds after it only changed the scheduler, then added the counter and the setup timeout.
5. Power-cycle the controller (PS button) after any experiment that overlapped writes, then connect again. Do not trust a silent result from a link that has just had two output reports in flight.
