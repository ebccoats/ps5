let lastState = { connected: false, channels: [] };
let connectPending = false;
const pendingDisplay = {};

const ui = {};

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
    document.body.appendChild(hapticsPanel());

    ui.note = document.createElement("p");
    ui.note.className = "note";
    ui.note.textContent = "Waiting for the scope server.";
    document.body.appendChild(ui.note);

    setControlsEnabled(false);
    window.addEventListener("resize", () => drawScope(ui.canvas, lastState));
    drawScope(ui.canvas, lastState);
    poll();
    if (navigator.hid)
        controllerHandler.checkForGrantedDevices().then(refreshPadStatus, refreshPadStatus);
}

const PARAMETER_COUNT = 7;

const controllerHandler = new GameControllerWebHandler();
const triggers = {};
const rumble = { low: 0, high: 0 };
let sendToBoth = true;
let hapticChain = Promise.resolve();

function hapticsPanel() {
    const section = document.createElement("section");
    section.className = "controller-section";
    const head = document.createElement("div");
    head.className = "controller-head";
    const title = document.createElement("h2");
    title.textContent = "Dualsense Controller";
    head.appendChild(title);
    ui.pad = button(head, "Connect controller", () => connectController());
    ui.padStatus = document.createElement("p");
    ui.padStatus.className = "note";
    ui.padStatus.textContent = navigator.hid
        ? "No controller connected."
        : "WebHID is unavailable. Open this page in Chrome or Edge.";
    head.appendChild(ui.padStatus);
    section.appendChild(head);

    const presets = document.createElement("div");
    presets.className = "presets";
    const presetHeading = document.createElement("h3");
    presetHeading.textContent = "Presets";
    presets.appendChild(presetHeading);
    ui.presetList = document.createElement("div");
    ui.presetList.className = "preset-list";
    presets.appendChild(ui.presetList);
    const saveRow = document.createElement("div");
    saveRow.className = "preset-save";
    const nameLabel = document.createElement("label");
    nameLabel.appendChild(document.createTextNode("Name"));
    ui.presetName = document.createElement("input");
    ui.presetName.type = "text";
    ui.presetName.maxLength = 60;
    nameLabel.appendChild(ui.presetName);
    saveRow.appendChild(nameLabel);
    button(saveRow, "Save preset", () => savePreset());
    ui.presetNote = document.createElement("p");
    ui.presetNote.className = "preset-note";
    saveRow.appendChild(ui.presetNote);
    presets.appendChild(saveRow);
    section.appendChild(presets);

    const wrap = document.createElement("div");
    wrap.className = "haptics";
    ui.haptics = wrap;

    const both = document.createElement("label");
    both.className = "both-triggers";
    const box = document.createElement("input");
    box.type = "checkbox";
    box.checked = true;
    ui.sendBoth = box;
    box.addEventListener("change", () => {
        const source = sendToBoth ? triggers.both : triggers.left;
        sendToBoth = box.checked;
        rebuildTriggerPanels(source ? readSetting(source) : null);
        scheduleHaptics();
    });
    both.appendChild(box);
    both.appendChild(document.createTextNode("Send to both triggers"));

    ui.triggerPanels = document.createElement("div");
    ui.triggerPanels.className = "trigger-panels";
    rebuildTriggerPanels();

    const motors = document.createElement("div");
    motors.className = "panel rumble-panel";
    const heading = document.createElement("h3");
    heading.textContent = "Rumble";
    motors.appendChild(heading);
    ui.rumbleControls = {
        low: rumbleRow("Low", "low"),
        high: rumbleRow("High", "high"),
    };
    motors.appendChild(ui.rumbleControls.low.row);
    motors.appendChild(ui.rumbleControls.high.row);
    wrap.appendChild(motors);
    wrap.appendChild(both);
    wrap.appendChild(ui.triggerPanels);
    section.appendChild(wrap);
    loadPresets();
    return section;
}

function emptySetting() {
    return { mode: 0, params: Array(PARAMETER_COUNT).fill(0) };
}

function rebuildTriggerPanels(leftSeed, rightSeed) {
    if (!leftSeed)
        leftSeed = emptySetting();
    if (!rightSeed)
        rightSeed = leftSeed;
    ui.haptics.classList.toggle("split", !sendToBoth);
    ui.triggerPanels.replaceChildren();
    if (sendToBoth) {
        triggers.both = triggerPanel("Trigger", leftSeed);
        ui.triggerPanels.appendChild(triggers.both.panel);
        return;
    }
    triggers.left = triggerPanel("Left trigger", leftSeed);
    triggers.right = triggerPanel("Right trigger", rightSeed);
    ui.triggerPanels.appendChild(triggers.left.panel);
    ui.triggerPanels.appendChild(triggers.right.panel);
}

function triggerPanel(title, seed) {
    const panel = document.createElement("div");
    panel.className = "panel";
    const heading = document.createElement("h3");
    heading.textContent = title;
    panel.appendChild(heading);
    const mode = byteRow(panel, "Mode", seed.mode, false);
    const params = [];
    for (let index = 0; index < PARAMETER_COUNT; index++)
        params.push(byteRow(panel, "Parameter " + (index + 1), seed.params[index], true));
    return { panel, mode, params };
}

function byteRow(panel, name, initial, withSlider) {
    const row = document.createElement("label");
    row.className = "mode-row";
    const label = document.createElement("span");
    label.textContent = name;
    const slider = document.createElement("input");
    slider.type = "range";
    slider.min = "0";
    slider.max = "255";
    slider.value = String(initial);
    const number = document.createElement("input");
    number.type = "number";
    number.className = "byte-field";
    number.min = "0";
    number.max = "255";
    number.step = "1";
    number.value = String(initial);
    row.appendChild(label);
    row.appendChild(number);
    if (withSlider) {
        slider.addEventListener("input", () => {
            number.value = slider.value;
            scheduleHaptics();
        });
        row.appendChild(slider);
    }
    number.addEventListener("input", () => {
        const parsed = parseByte(number.value);
        if (parsed == null)
            return;
        slider.value = String(parsed);
        scheduleHaptics();
    });
    number.addEventListener("change", () => {
        const parsed = parseByte(number.value);
        const next = parsed == null ? Number(slider.value) : parsed;
        slider.value = String(next);
        number.value = String(next);
        scheduleHaptics();
    });
    panel.appendChild(row);
    return { slider, number };
}

function rumbleRow(name, key) {
    const row = document.createElement("label");
    row.className = "rumble-row";
    const label = document.createElement("span");
    label.textContent = name;
    const slider = document.createElement("input");
    slider.type = "range";
    slider.min = "0";
    slider.max = "255";
    slider.value = "0";
    const value = document.createElement("span");
    value.className = "param-value";
    value.textContent = "0";
    slider.addEventListener("input", () => {
        rumble[key] = Number(slider.value);
        value.textContent = slider.value;
        scheduleHaptics();
    });
    row.appendChild(label);
    row.appendChild(value);
    row.appendChild(slider);
    return { row, slider, value };
}

function setRumble(key, amount) {
    rumble[key] = amount;
    const control = ui.rumbleControls[key];
    control.slider.value = String(amount);
    control.value.textContent = String(amount);
}

function currentHaptics() {
    const low = rumble.low;
    const high = rumble.high;
    if (sendToBoth) {
        const setting = readSetting(triggers.both);
        return {
            sendToBoth: true,
            rumble: { low, high },
            left: setting,
            right: setting,
        };
    }
    return {
        sendToBoth: false,
        rumble: { low, high },
        left: readSetting(triggers.left),
        right: readSetting(triggers.right),
    };
}

function applyPreset(preset) {
    sendToBoth = preset.sendToBoth !== false;
    ui.sendBoth.checked = sendToBoth;
    setRumble("low", preset.rumble.low);
    setRumble("high", preset.rumble.high);
    rebuildTriggerPanels(preset.left, sendToBoth ? preset.left : preset.right);
    scheduleHaptics();
}

function renderPresets(presets) {
    ui.presetList.replaceChildren();
    for (const preset of presets)
        button(ui.presetList, preset.name, () => applyPreset(preset));
}

async function loadPresets() {
    try {
        const response = await fetch("/api/presets");
        if (!response.ok)
            throw new Error("Could not load presets");
        const body = await response.json();
        renderPresets(body.presets || []);
    } catch (error) {
        ui.presetNote.textContent = "Could not load presets.";
    }
}

async function savePreset() {
    const name = ui.presetName.value.trim();
    if (!name) {
        ui.presetNote.textContent = "Name the preset.";
        return;
    }
    ui.presetNote.textContent = "";
    try {
        const response = await fetch("/api/presets", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(Object.assign({ name }, currentHaptics())),
        });
        const body = await response.json().catch(() => ({}));
        if (!response.ok)
            throw new Error(body.error || "Could not save the preset.");
        ui.presetNote.textContent = "Saved.";
        await loadPresets();
    } catch (error) {
        ui.presetNote.textContent = error && error.message ? error.message : "Could not save the preset.";
    }
}

function activeController() {
    const open = controllerHandler.controllers.filter(controller => controller.device_ && controller.device_.opened);
    return open.length ? open[0] : null;
}

function refreshPadStatus() {
    const pad = activeController();
    if (!ui.padStatus)
        return;
    if (!pad) {
        ui.padStatus.textContent = navigator.hid
            ? "No controller connected."
            : "WebHID is unavailable. Open this page in Chrome or Edge.";
        return;
    }
    const name = pad.device_ && pad.device_.productName ? pad.device_.productName : "DualSense";
    ui.padStatus.textContent = name + " connected (" + pad.connectionType_ + ").";
}

async function connectController() {
    if (!navigator.hid) {
        refreshPadStatus();
        return;
    }
    ui.pad.disabled = true;
    try {
        await controllerHandler.requestDevice();
    } catch (error) {
        ui.padStatus.textContent = error && error.message ? error.message : "Could not open the controller";
    }
    ui.pad.disabled = false;
    refreshPadStatus();
}

function parseByte(text) {
    if (!/^\d+$/.test(text))
        return null;
    const value = Number(text);
    if (value > 255)
        return null;
    return value;
}

function readControl(control) {
    const parsed = parseByte(control.number.value);
    return parsed == null ? Number(control.slider.value) : parsed;
}

function readSetting(control) {
    return {
        mode: readControl(control.mode),
        params: control.params.map(readControl)
    };
}

function scheduleHaptics() {
    const run = hapticChain.then(sendHaptics, sendHaptics);
    hapticChain = run.then(() => {}, () => {});
}

async function sendHaptics() {
    const pad = activeController();
    if (!pad)
        return;
    if (sendToBoth) {
        const setting = readSetting(triggers.both);
        pad.changeTriggerEffect("left", setting);
        pad.changeTriggerEffect("right", setting);
    } else {
        pad.changeTriggerEffect("left", readSetting(triggers.left));
        pad.changeTriggerEffect("right", readSetting(triggers.right));
    }
    pad.changeRumble(rumble.low, rumble.high);
    const sent = await pad.sendOutputReport();
    if (sent === false)
        ui.padStatus.textContent = "Could not send the haptic report.";
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
        send(":CHAN" + channel.index + ":DISP " + (box.checked ? "ON" : "OFF"));
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

function setControlsEnabled(enabled) {
    ui.run.disabled = !enabled;
    ui.stop.disabled = !enabled;
    ui.single.disabled = !enabled;
    for (const channel of Object.values(ui.channels))
        channel.box.disabled = !enabled;
    for (const el of document.querySelectorAll("button.step"))
        el.disabled = !enabled;
}

function post(url, body) {
    return fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body)
    }).then(response => {
        if (!response.ok)
            throw new Error("Scope command failed");
    }).catch(reportError);
}

function send(command) {
    if (!lastState.connected)
        return;
    post("/api/scpi", { command });
}

function stepTime(direction) {
    if (!lastState.connected)
        return;
    post("/api/step", { target: "time", direction });
}

function stepChannel(index, direction) {
    if (!lastState.connected)
        return;
    post("/api/step", { target: "channel", index, direction });
}

function toggleConnection() {
    connectPending = true;
    ui.connect.disabled = true;
    post("/api/connect", { open: !lastState.connected }).then(() => {
        connectPending = false;
    }, () => {
        connectPending = false;
    });
}

function poll() {
    fetch("/api/frame").then(response => {
        if (!response.ok)
            throw new Error("Scope server returned " + response.status);
        return response.json();
    }).then(frame => {
        showFrame(frame);
        window.setTimeout(poll, 100);
    }, () => {
        ui.identity.textContent = "No scope server";
        ui.note.textContent = "Scope server is not running. From controller-demo/oscilloscope, run server.py and reload.";
        ui.connect.textContent = "Connect scope";
        setControlsEnabled(false);
        lastState = { connected: false, channels: [] };
        drawScope(ui.canvas, lastState);
        window.setTimeout(poll, 1000);
    });
}

function showFrame(frame) {
    const trigger = frame.trigger || {};
    const channels = frame.channels || [];
    lastState = {
        connected: !!frame.connected,
        timeScale: frame.timeScale,
        timeOffset: frame.timeOffset,
        channels,
        trigger
    };
    if (!connectPending) {
        ui.connect.disabled = false;
        ui.connect.textContent = frame.connected ? "Disconnect" : "Connect scope";
    }
    setControlsEnabled(!!frame.connected);
    ui.identity.textContent = frame.connected
        ? (frame.identity || "Scope connected")
        : "No scope connected";
    ui.timeScale.textContent = Number.isFinite(frame.timeScale) ? formatEng(frame.timeScale, "s") + "/div" : "—";
    ui.time.textContent = Number.isFinite(frame.timeOffset) ? "Delay " + formatEng(frame.timeOffset, "s") : "Delay —";
    ui.rate.textContent = Number.isFinite(frame.sampleRate) ? formatEng(frame.sampleRate, "Sa/s") : "Sample rate —";
    const level = Number.isFinite(trigger.level) ? "  " + formatEng(trigger.level, "V") : "";
    ui.trigger.textContent = frame.connected
        ? "Trigger " + (trigger.status || "—") + "  " + (trigger.source || "") + level
        : "Trigger —";
    if (!frame.connected) {
        for (const row of Object.values(ui.channels)) {
            row.box.checked = false;
            row.scale.textContent = "—";
        }
    }
    for (const channel of channels) {
        const row = ui.channels[channel.index];
        if (!row)
            continue;
        if (Object.prototype.hasOwnProperty.call(pendingDisplay, channel.index)) {
            if (channel.enabled === pendingDisplay[channel.index])
                delete pendingDisplay[channel.index];
        } else {
            row.box.checked = channel.enabled;
        }
        const offset = Number.isFinite(channel.offset) ? "  " + formatEng(channel.offset, "V") : "";
        row.scale.textContent = (Number.isFinite(channel.scale) ? formatEng(channel.scale, "V") + "/div" : "—") + offset;
    }
    if (frame.error)
        ui.note.textContent = frame.error;
    else if (frame.connected)
        ui.note.textContent = "Trace is read over USB by the Python server.";
    else
        ui.note.textContent = "Plug in the scope, then Connect.";
    drawScope(ui.canvas, lastState);
}

function reportError(error) {
    ui.note.textContent = error && error.message ? error.message : "Scope command failed";
}

buildPage();
