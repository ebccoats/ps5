// -----------------------------------------------------------------
// List of haptic modes for the DualSense controller
// -----------------------------------------------------------------

class HapticsMode {
    static DEFAULT_MODE = "23"; 
    static DEFAULT_PARAMS = ["ff", "ff", "01", "02", "01", "01", "00"];
    static DEFAULT_RUMBLE = [0, 0];

    constructor({ name = "", label = "", mode, params, rumble, audio = null } = {}) {
        this.name = name;
        this.label = label;
        this.mode = mode || HapticsMode.DEFAULT_MODE;
        this.params = params?.length ? [...params] : [...HapticsMode.DEFAULT_PARAMS];
        this.rumble = rumble?.length ? [...rumble] : [...HapticsMode.DEFAULT_RUMBLE];
        this.audio  = audio
    }
}

const TRIGGER_MODES = [
    new HapticsMode({ 
        name: "rock", label: "Deep rumble", 
        rumble: [50, 0], 
        audio: "<lt, mt>"}),
    new HapticsMode({ 
        name: "bug", label: "Light rumble", 
        rumble: [0, 100], 
        audio: "<hh hh ->*16"}),
    new HapticsMode({ 
        name: "air", label: "Gallop"}),
    new HapticsMode({ 
        name: "none", label: "Full zero", 
        mode: "05", params: ["00", "00", "00", "00", "00", "00", "00"] })
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

        controller.changeRumble(mode.rumble[0], mode.rumble[1])

        controller.sendOutputReport().finally(() => SENDING.delete(controller));
    }
}

// -----------------------------------------------------------------
// Switch to a different audio sample based on the mode name
// -----------------------------------------------------------------

var AUDIO_PLAYING = false

function turnOffAudio() {
    AUDIO_PLAYING = false
    hush()
}

function switchAudio(mode) {
    if (mode.audio && !AUDIO_PLAYING) {
        AUDIO_PLAYING = true
        console.log("mode audio")
        sound(mode.audio).play()
        setTimeout(turnOffAudio, 1000)
    }
}

// -----------------------------------------------------------------
// Switch to a different haptic mode based on the provided mode name
// -----------------------------------------------------------------
function switchMode(modeName) {

    const mode = TRIGGER_MODES.find(mode => mode.name === modeName);
    if (!mode) {
        console.error("Invalid mode name: ", mode);
        return;
    }
    
    switchAudio(mode)

    updateActiveControllers(mode);

    
}