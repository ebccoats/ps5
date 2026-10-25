// -----------------------------------------------------------------
// List of haptic modes for the DualSense controller
// -----------------------------------------------------------------

class HapticsMode {
    static DEFAULT_MODE = "23";
    static DEFAULT_PARAMS = ["ff", "ff", "01", "02", "01", "01", "00"];
    static DEFAULT_RUMBLE = [0, 0];

    constructor({ name = "", label = "", mode, params, rumble } = {}) {
        this.name = name;
        this.label = label;
        this.mode = mode || HapticsMode.DEFAULT_MODE;
        this.params = params?.length ? [...params] : [...HapticsMode.DEFAULT_PARAMS];
        this.rumble = rumble?.length ? [...rumble] : [...HapticsMode.DEFAULT_RUMBLE];
    }
}


const HAPTICS_MODES = {
    rock: new HapticsMode({
        name: "rock",
        label: "Echolocate rock -- light buzz",
        rumble: [0, 10],
        // params: ["00", "00", "00", "00", "00", "00", "00"],
    }),
    slamRock: new HapticsMode({
        name: "slamRock",
        label: "Deep rumble, no movement",
        rumble: [200, 0],
        params: ["00", "00", "00", "00", "00", "00", "00"],
    }),

    bug: new HapticsMode({
        name: "bug",
        label: "Echolocate bug -- light buzz",
        rumble: [0, 10],
    }),
    munchBug: new HapticsMode({
        name: "munchBug",
        label: "Less light rumble",
        rumble: [0, 50],
    }),
    air: new HapticsMode({
        name: "air",
        label: "Gallop",
    }),
    none: new HapticsMode({
        name: "none",
        label: "Full zero",
        mode: "05",
        params: ["00", "00", "00", "00", "00", "00", "00"],
    }),
};


// -----------------------------------------------------------------
// Set of controllers currently sending haptic mode updates to prevent duplicate sends
// -----------------------------------------------------------------
const SENDING = new WeakSet();

// -----------------------------------------------------------------
// Send the selected haptic mode to all connected controllers
// -----------------------------------------------------------------
function scaleByIntensity(value, intensity) {
    return Math.round(value * intensity);
}

async function switchHapticsMode(mode, intensity) {
    controller = activeController

    if (SENDING.has(controller) && intensity <= 0.99) return;

    SENDING.add(controller);

    // const scaledParams = mode.params.map(param =>
    //     Math.round(parseInt(param, 16) * intensity).toString(16).padStart(2, "0")
    // );
    try {
        controller.changeTriggerEffect(
            "left", { mode: mode.mode }, ...mode.params
        );
        controller.changeTriggerEffect(
            "right", { mode: mode.mode }, ...mode.params
        );
        controller.changeRumble(
            scaleByIntensity(mode.rumble[0], intensity),
            scaleByIntensity(mode.rumble[1], intensity)
        );

        await controller.sendOutputReport();
    } catch (error) {
        console.error("Failed to update controller:", error);
    } finally {
        SENDING.delete(controller);
    }
}

