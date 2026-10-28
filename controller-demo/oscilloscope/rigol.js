// Screen waveform for the Rigol DS1000Z family (DS1054Z). NORMal mode is the
// trace on the instrument: 12 divisions, 100 points each, 25 codes per division.

const DS1000Z_IDN = /DS1\d{3}Z|MSO1\d{3}Z|DS1000Z/i;

function decodeIeeeBlock(bytes) {
    let start = -1;
    for (let i = 0; i < bytes.length; i++) {
        if (bytes[i] === 0x23) {
            start = i;
            break;
        }
    }
    if (start < 0 || start + 2 > bytes.length)
        throw new Error("Waveform header missing");
    const digits = bytes[start + 1] - 0x30;
    if (digits < 1 || digits > 9)
        throw new Error("Waveform header missing");
    const lengthStart = start + 2;
    const dataStart = lengthStart + digits;
    if (dataStart > bytes.length)
        throw new Error("Waveform header truncated");
    let length = 0;
    for (let i = lengthStart; i < dataStart; i++) {
        const digit = bytes[i] - 0x30;
        if (digit < 0 || digit > 9)
            throw new Error("Waveform header missing");
        length = length * 10 + digit;
    }
    if (dataStart + length > bytes.length)
        throw new Error("Waveform truncated");
    return bytes.slice(dataStart, dataStart + length);
}

function parsePreamble(text) {
    const parts = String(text).trim().split(",").map(part => Number(part.trim()));
    if (parts.length < 10 || parts.some(part => !Number.isFinite(part)))
        throw new Error("Bad waveform preamble");
    return {
        format: parts[0],
        type: parts[1],
        points: parts[2],
        count: parts[3],
        xincrement: parts[4],
        xorigin: parts[5],
        xreference: parts[6],
        yincrement: parts[7],
        yorigin: parts[8],
        yreference: parts[9]
    };
}

function voltsFromBytes(samples, preamble) {
    const volts = new Float64Array(samples.length);
    for (let i = 0; i < samples.length; i++)
        volts[i] = (samples[i] - preamble.yorigin - preamble.yreference) * preamble.yincrement;
    return volts;
}

function step125(value, direction) {
    const decades = [1, 2, 5];
    if (!(value > 0) || !Number.isFinite(value))
        return value;
    const exp = Math.floor(Math.log10(value * (1 + 1e-12)));
    const mantissa = value / (10 ** exp);
    let index = 0;
    let error = Infinity;
    for (let i = 0; i < decades.length; i++) {
        const delta = Math.abs(Math.log(mantissa) - Math.log(decades[i]));
        if (delta < error) {
            error = delta;
            index = i;
        }
    }
    index += direction < 0 ? -1 : 1;
    let decade = exp;
    while (index >= decades.length) {
        index -= decades.length;
        decade += 1;
    }
    while (index < 0) {
        index += decades.length;
        decade -= 1;
    }
    return Number((decades[index] * (10 ** decade)).toExponential(8));
}

function isDisplayed(text) {
    const value = String(text).trim().toUpperCase();
    return value === "1" || value === "ON";
}

class RigolScope {
    constructor(usb) {
        this.usb = usb;
    }

    write(command) {
        return this.usb.write(command);
    }

    async query(command) {
        const bytes = await this.usb.query(command, 4096);
        return new TextDecoder().decode(bytes).replace(/\0/g, "").trim();
    }

    async queryBinary(command) {
        return this.usb.query(command, 16384);
    }

    async identify() {
        const idn = await this.query("*IDN?");
        if (!DS1000Z_IDN.test(idn))
            throw new Error("Connected to " + idn + ", which is not a DS1000Z scope.");
        return idn;
    }

    async readChannel(index) {
        const displayed = isDisplayed(await this.query(":CHAN" + index + ":DISP?"));
        const scale = Number(await this.query(":CHAN" + index + ":SCAL?"));
        const offset = Number(await this.query(":CHAN" + index + ":OFFS?"));
        if (!displayed)
            return { index, enabled: false, scale, offset, volts: null };
        await this.write(":WAV:SOUR CHAN" + index + ";:WAV:MODE NORM;:WAV:FORM BYTE;:WAV:STAR 1;:WAV:STOP 1200");
        const preamble = parsePreamble(await this.query(":WAV:PRE?"));
        if (preamble.format !== 0)
            throw new Error("Scope did not return BYTE waveform data");
        const block = decodeIeeeBlock(await this.queryBinary(":WAV:DATA?"));
        return {
            index,
            enabled: true,
            scale,
            offset,
            volts: voltsFromBytes(block, preamble),
            xincrement: preamble.xincrement
        };
    }

    async readFrame() {
        const timeScale = Number(await this.query(":TIM:SCAL?"));
        const timeOffset = Number(await this.query(":TIM:OFFS?"));
        const sampleRate = Number(await this.query(":ACQ:SRAT?"));
        const triggerStatus = (await this.query(":TRIG:STAT?")).trim();
        let triggerSource = "";
        let triggerLevel = null;
        try {
            triggerSource = (await this.query(":TRIG:EDG:SOUR?")).trim();
            triggerLevel = Number(await this.query(":TRIG:EDG:LEV?"));
        } catch (error) {}
        const channels = [];
        for (let index = 1; index <= 4; index++)
            channels.push(await this.readChannel(index));
        return {
            timeScale,
            timeOffset,
            sampleRate,
            trigger: {
                status: triggerStatus,
                source: triggerSource,
                level: triggerLevel
            },
            channels
        };
    }
}

const Rigol = {
    decodeIeeeBlock,
    parsePreamble,
    voltsFromBytes,
    step125,
    isDisplayed,
    RigolScope
};

if (typeof window !== "undefined")
    window.Rigol = Rigol;
if (typeof module !== "undefined" && module.exports)
    module.exports = Rigol;
