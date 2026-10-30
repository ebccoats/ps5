const SCOPE_CHANNELS = [
    { index: 1, name: "CH1", color: "#ffd000" },
    { index: 2, name: "CH2", color: "#00d4f5" },
    { index: 3, name: "CH3", color: "#ff4fd8" },
    { index: 4, name: "CH4", color: "#4d8dff" }
];

function formatEng(value, unit) {
    if (!Number.isFinite(value))
        return "—";
    if (value === 0)
        return "0 " + unit;
    const sign = value < 0 ? "-" : "";
    const magnitude = Math.abs(value);
    const units = [
        [1e9, "G"],
        [1e6, "M"],
        [1e3, "k"],
        [1, ""],
        [1e-3, "m"],
        [1e-6, "µ"],
        [1e-9, "n"],
        [1e-12, "p"]
    ];
    let scale = 1e-12;
    let prefix = "p";
    for (const [step, name] of units) {
        if (magnitude >= step || step === 1e-12) {
            scale = step;
            prefix = name;
            break;
        }
    }
    const number = magnitude / scale;
    const digits = number >= 100 ? 0 : number >= 10 ? 1 : 2;
    const text = number.toFixed(digits).replace(/\.0+$/, "").replace(/(\.\d*[1-9])0+$/, "$1");
    return sign + (magnitude === 0 ? "0" : text) + " " + prefix + unit;
}

function drawScope(canvas, state) {
    const dpr = window.devicePixelRatio || 1;
    const rect = canvas.getBoundingClientRect();
    const width = Math.max(320, rect.width);
    const height = Math.max(240, rect.height);
    const pixelWidth = Math.floor(width * dpr);
    const pixelHeight = Math.floor(height * dpr);
    if (canvas.width !== pixelWidth || canvas.height !== pixelHeight) {
        canvas.width = pixelWidth;
        canvas.height = pixelHeight;
    }
    const ctx = canvas.getContext("2d");
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, width, height);
    ctx.fillStyle = "#0c100e";
    ctx.fillRect(0, 0, width, height);

    const padLeft = 36;
    const padRight = 22;
    const padTop = 18;
    const padBottom = 32;
    const plotWidth = width - padLeft - padRight;
    const plotHeight = height - padTop - padBottom;

    ctx.save();
    ctx.beginPath();
    ctx.rect(padLeft, padTop, plotWidth, plotHeight);
    ctx.clip();
    ctx.fillStyle = "#101612";
    ctx.fillRect(padLeft, padTop, plotWidth, plotHeight);

    ctx.lineWidth = 1;
    for (let division = 0; division <= 12; division++) {
        const x = padLeft + plotWidth * division / 12;
        ctx.strokeStyle = division === 6 ? "#4e6a58" : "#24352c";
        ctx.beginPath();
        ctx.moveTo(x + 0.5, padTop);
        ctx.lineTo(x + 0.5, padTop + plotHeight);
        ctx.stroke();
    }
    for (let division = 0; division <= 8; division++) {
        const y = padTop + plotHeight * division / 8;
        ctx.strokeStyle = division === 4 ? "#4e6a58" : "#24352c";
        ctx.beginPath();
        ctx.moveTo(padLeft, y + 0.5);
        ctx.lineTo(padLeft + plotWidth, y + 0.5);
        ctx.stroke();
    }

    const channels = state && state.channels || [];
    for (const channel of channels) {
        if (!channel.enabled || !channel.volts || !channel.volts.length || !(channel.scale > 0))
            continue;
        const meta = SCOPE_CHANNELS[channel.index - 1];
        ctx.beginPath();
        ctx.strokeStyle = meta.color;
        ctx.lineWidth = 1.6;
        const samples = channel.volts;
        for (let i = 0; i < samples.length; i++) {
            const x = padLeft + (samples.length === 1 ? plotWidth / 2 : plotWidth * i / (samples.length - 1));
            const divisions = (samples[i] + channel.offset) / channel.scale;
            const y = padTop + plotHeight / 2 - divisions * (plotHeight / 8);
            if (i === 0)
                ctx.moveTo(x, y);
            else
                ctx.lineTo(x, y);
        }
        ctx.stroke();
    }
    ctx.restore();

    ctx.font = "12px ui-sans-serif, system-ui, sans-serif";
    ctx.textBaseline = "middle";
    for (const channel of channels) {
        if (!channel.enabled || !(channel.scale > 0))
            continue;
        const meta = SCOPE_CHANNELS[channel.index - 1];
        const divisions = channel.offset / channel.scale;
        const y = padTop + plotHeight / 2 - divisions * (plotHeight / 8);
        if (y < padTop || y > padTop + plotHeight)
            continue;
        ctx.fillStyle = meta.color;
        ctx.beginPath();
        ctx.moveTo(padLeft - 10, y);
        ctx.lineTo(padLeft - 2, y - 5);
        ctx.lineTo(padLeft - 2, y + 5);
        ctx.closePath();
        ctx.fill();
    }

    const trigger = state && state.trigger;
    if (trigger && Number.isFinite(trigger.level)) {
        const source = /CHAN([1-4])/i.exec(trigger.source || "");
        const index = source ? Number(source[1]) : 0;
        const channel = channels.find(item => item.index === index && item.enabled && item.scale > 0);
        if (channel) {
            const meta = SCOPE_CHANNELS[channel.index - 1];
            const divisions = (trigger.level + channel.offset) / channel.scale;
            const y = padTop + plotHeight / 2 - divisions * (plotHeight / 8);
            if (y >= padTop && y <= padTop + plotHeight) {
                ctx.fillStyle = meta.color;
                ctx.beginPath();
                ctx.moveTo(padLeft + plotWidth + 10, y);
                ctx.lineTo(padLeft + plotWidth + 2, y - 5);
                ctx.lineTo(padLeft + plotWidth + 2, y + 5);
                ctx.closePath();
                ctx.fill();
            }
        }
    }

    ctx.fillStyle = "#9fb3a6";
    ctx.textAlign = "center";
    ctx.textBaseline = "alphabetic";
    const timeLabel = state && Number.isFinite(state.timeScale) ? formatEng(state.timeScale, "s") + "/div" : "";
    if (timeLabel)
        ctx.fillText(timeLabel, padLeft + plotWidth / 2, height - 10);
    if (state && state.trigger && state.trigger.status === "STOP") {
        ctx.fillStyle = "rgba(255, 208, 0, 0.85)";
        ctx.textAlign = "left";
        ctx.fillText("STOP", padLeft + 8, padTop + 16);
    }
    if (!state || !state.connected) {
        ctx.fillStyle = "#9fb3a6";
        ctx.textAlign = "center";
        ctx.font = "15px ui-sans-serif, system-ui, sans-serif";
        ctx.fillText("No scope connected", padLeft + plotWidth / 2, padTop + plotHeight / 2);
    }
}

if (typeof window !== "undefined") {
    window.SCOPE_CHANNELS = SCOPE_CHANNELS;
    window.formatEng = formatEng;
    window.drawScope = drawScope;
}
