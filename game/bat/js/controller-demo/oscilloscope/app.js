const usb = new Usbtmc();
let scope = null;
let alive = false;
let lastState = { connected: false, channels: [] };
let chain = Promise.resolve();
const pendingDisplay = {};

const ui = {};

function enqueue(fn) {
    const run = chain.then(fn, fn);
    chain = run.then(() => {}, () => {});
    return run;
}

function clampScale(value, min, max) {
    return Math.min(max, Math.max(min, value));
}

function buildPage() {
    const title = document.createElement("h1");
    title.textContent = "DS1054Z";
    document.body.appendChild(title);

    const bar = document.createElement("div");
    bar.className = "bar";
    ui.connect = button(bar, "Connect scope", () => toggleConnection());
    ui.run = button(bar, "Run", () => send(":RUN"));
    ui.stop = button(bar, "Stop", () => send(":STOP"));
    ui.single = button(bar, "Single", () => send(":SING"));
    ui.identity = document.createElement("span");
    ui.identity.className = "identity";
    ui.identity.textContent = "No scope connected";
    bar.appendChild(ui.identity);
    document.body.appendChild(bar);

    const layout = document.createElement("div");
    layout.className = "layout";
    const screen = document.createElement("div");
    screen.className = "screen";
    ui.canvas = document.createElement("canvas");
    screen.appendChild(ui.canvas);
    layout.appendChild(screen);

    const side = document.createElement("aside");
    ui.trigger = document.createElement("p");
    ui.trigger.className = "readout";
    ui.trigger.textContent = "Trigger —";
    side.appendChild(ui.trigger);
    side.appendChild(timeControl());
    ui.time = document.createElement("p");
    ui.time.className = "readout";
    ui.time.textContent = "Delay —";
    side.appendChild(ui.time);
    ui.rate = document.createElement("p");
    ui.rate.className = "readout";
    ui.rate.textContent = "Sample rate —";
    side.appendChild(ui.rate);

    ui.channels = {};
    for (const channel of SCOPE_CHANNELS)
        side.appendChild(channelRow(channel));
    layout.appendChild(side);
    document.body.appendChild(layout);

    ui.note = document.createElement("p");
    ui.note.className = "note";
    ui.note.textContent = usbAvailable()
        ? "USB cable from the scope, then Connect. Chrome or Edge, served from localhost."
        : "WebUSB is unavailable. Open this page from localhost in Chrome or Edge.";
    document.body.appendChild(ui.note);

    setControlsEnabled(false);
    window.addEventListener("resize", () => drawScope(ui.canvas, lastState));
    drawScope(ui.canvas, lastState);
}

function button(parent, label, onClick) {
    const el = document.createElement("button");
    el.type = "button";
    el.textContent = label;
    el.addEventListener("click", onClick);
    parent.appendChild(el);
    return el;
}

function timeControl() {
    const row = document.createElement("div");
    row.className = "channel";
    const name = document.createElement("strong");
    name.textContent = "Timebase";
    row.appendChild(name);
    ui.timeScale = document.createElement("span");
    ui.timeScale.textContent = "—";
    row.appendChild(ui.timeScale);
    row.appendChild(stepButton("Slower timebase", -1, () => stepTime(-1)));
    row.appendChild(stepButton("Faster timebase", 1, () => stepTime(1)));
    return row;
}

function channelRow(channel) {
    const row = document.createElement("div");
    row.className = "channel";
    const label = document.createElement("label");
    const box = document.createElement("input");
    box.type = "checkbox";
    box.addEventListener("change", () => {
        pendingDisplay[channel.index] = box.checked;
        const command = ":CHAN" + channel.index + ":DISP " + (box.checked ? "ON" : "OFF");
        const job = send(command);
        if (job)
            job.then(() => {}, () => { delete pendingDisplay[channel.index]; });
    });
    label.appendChild(box);
    const name = document.createElement("span");
    name.textContent = channel.name;
    name.style.color = channel.color;
    label.appendChild(name);
    row.appendChild(label);
    const scale = document.createElement("span");
    scale.textContent = "—";
    row.appendChild(scale);
    row.appendChild(stepButton(channel.name + " smaller", -1, () => stepChannel(channel.index, -1)));
    row.appendChild(stepButton(channel.name + " larger", 1, () => stepChannel(channel.index, 1)));
    ui.channels[channel.index] = { box, scale };
    return row;
}

function stepButton(label, direction, onClick) {
    const el = document.createElement("button");
    el.type = "button";
    el.className = "step";
    el.textContent = direction < 0 ? "−" : "+";
    el.setAttribute("aria-label", label);
    el.addEventListener("click", onClick);
    return el;
}

function usbAvailable() {
    return typeof navigator !== "undefined" && !!navigator.usb && window.isSecureContext;
}

function setControlsEnabled(enabled) {
    ui.run.disabled = !enabled;
    ui.stop.disabled = !enabled;
    ui.single.disabled = !enabled;
    for (const channel of Object.values(ui.channels))
        channel.box.disabled = !enabled;
    for (const el of document.querySelectorAll("button.step"))
        el.disabled = !enabled;
}

function send(command) {
    if (!scope)
        return null;
    const job = enqueue(() => scope.write(command));
    job.catch(reportError);
    return job;
}

function stepTime(direction) {
    if (!scope)
        return;
    enqueue(async () => {
        const current = Number(await scope.query(":TIM:SCAL?"));
        const next = clampScale(Rigol.step125(current, direction), 5e-9, 50);
        await scope.write(":TIM:SCAL " + next.toExponential(6));
    }).catch(reportError);
}

function stepChannel(index, direction) {
    if (!scope)
        return;
    enqueue(async () => {
        const current = Number(await scope.query(":CHAN" + index + ":SCAL?"));
        const next = clampScale(Rigol.step125(current, direction), 1e-3, 100);
        await scope.write(":CHAN" + index + ":SCAL " + next.toExponential(6));
    }).catch(reportError);
}

async function toggleConnection() {
    if (alive) {
        alive = false;
        ui.connect.disabled = true;
        await enqueue(async () => {
            scope = null;
            await usb.close();
        }).catch(() => {});
        lastState = { connected: false, channels: [] };
        ui.identity.textContent = "No scope connected";
        ui.trigger.textContent = "Trigger —";
        ui.rate.textContent = "Sample rate —";
        ui.timeScale.textContent = "—";
        for (const channel of Object.values(ui.channels)) {
            channel.box.checked = false;
            channel.scale.textContent = "—";
        }
        ui.connect.textContent = "Connect scope";
        ui.connect.disabled = false;
        setControlsEnabled(false);
        drawScope(ui.canvas, lastState);
        return;
    }
    ui.connect.disabled = true;
    try {
        const device = await usb.request();
        if (!device) {
            ui.connect.disabled = false;
            return;
        }
        scope = new Rigol.RigolScope(usb);
        const idn = await enqueue(() => scope.identify());
        ui.identity.textContent = idn;
        alive = true;
        ui.connect.textContent = "Disconnect";
        ui.connect.disabled = false;
        setControlsEnabled(true);
        poll();
    } catch (error) {
        scope = null;
        await usb.close().catch(() => {});
        ui.identity.textContent = error && error.message ? error.message : "Could not open the scope";
        ui.connect.textContent = "Connect scope";
        ui.connect.disabled = false;
        setControlsEnabled(false);
    }
}

function poll() {
    if (!alive)
        return;
    enqueue(() => scope.readFrame()).then(frame => {
        if (!alive)
            return;
        showFrame(frame);
        window.setTimeout(poll, 40);
    }, error => {
        if (!alive)
            return;
        if (error && (error.name === "NotFoundError" || error.name === "NetworkError" || error.name === "InvalidStateError")) {
            alive = false;
            scope = null;
            usb.close().catch(() => {});
            ui.identity.textContent = "Scope disconnected";
            ui.connect.textContent = "Connect scope";
            setControlsEnabled(false);
            lastState = { connected: false, channels: lastState.channels };
            drawScope(ui.canvas, lastState);
            return;
        }
        reportError(error);
        window.setTimeout(poll, 400);
    });
}

function showFrame(frame) {
    lastState = {
        connected: true,
        timeScale: frame.timeScale,
        timeOffset: frame.timeOffset,
        channels: frame.channels,
        trigger: frame.trigger
    };
    ui.timeScale.textContent = formatEng(frame.timeScale, "s") + "/div";
    ui.time.textContent = "Delay " + formatEng(frame.timeOffset, "s");
    ui.rate.textContent = formatEng(frame.sampleRate, "Sa/s");
    const level = Number.isFinite(frame.trigger.level) ? "  " + formatEng(frame.trigger.level, "V") : "";
    ui.trigger.textContent = "Trigger " + (frame.trigger.status || "—") + "  " + (frame.trigger.source || "") + level;
    for (const channel of frame.channels) {
        const row = ui.channels[channel.index];
        if (Object.prototype.hasOwnProperty.call(pendingDisplay, channel.index)) {
            if (channel.enabled === pendingDisplay[channel.index])
                delete pendingDisplay[channel.index];
        } else {
            row.box.checked = channel.enabled;
        }
        const offset = Number.isFinite(channel.offset) ? "  " + formatEng(channel.offset, "V") : "";
        row.scale.textContent = (Number.isFinite(channel.scale) ? formatEng(channel.scale, "V") + "/div" : "—") + offset;
    }
    drawScope(ui.canvas, lastState);
}

function reportError(error) {
    ui.note.textContent = error && error.message ? error.message : "Scope command failed";
}

buildPage();
