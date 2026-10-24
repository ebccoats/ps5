// -----------------------------------------------------------------
// List of haptic modes for the DualSense controller
// -----------------------------------------------------------------
const TRIGGER_MODES = [
    { name: "rock", label: "Mosquito", mode: "06", params: ["ff", "10", "01", "00", "00", "00", "00"] },
    { name: "bug", label: "Gallop/Sine wave pattern", mode: "23", params: ["ff", "ff", "01", "02", "01", "01", "00"] },
    { name: "none", label: "Full zero", mode: "05", params: ["00", "00", "00", "00", "00", "00", "00"] }
];

// -----------------------------------------------------------------
// Set of controllers currently sending haptic mode updates to prevent duplicate sends
// -----------------------------------------------------------------
const SENDING = new WeakSet();

// -----------------------------------------------------------------
// Send the selected haptic mode to all connected controllers
// -----------------------------------------------------------------
function updateActiveControllers(mode) {
    const open_controllers = controllerHandler.controllers.filter(controller =>
        controller.device_ && controller.device_.opened &&
        (controller.connectionType_ === "usb" || controller.connectionType_ === "bluetooth")
    );

    for (const controller of open_controllers) {
        if (SENDING.has(controller))
            continue;
        SENDING.add(controller);
        controller.changeTriggerEffect("left", { mode: mode.mode }, ...mode.params);
        controller.changeTriggerEffect("right", { mode: mode.mode }, ...mode.params);
        controller.sendOutputReport().finally(() => SENDING.delete(controller));
    }
}

// -----------------------------------------------------------------
// Switch to a different haptic mode based on the provided mode name
// -----------------------------------------------------------------
function switchMode(modeName) {
    const mode = TRIGGER_MODES.find(mode => mode.name === modeName);
    if (!mode) {
        console.error("Invalid mode name");
        return;
    }
    updateActiveControllers(mode);
}