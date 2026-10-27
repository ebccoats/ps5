// -----------------------------------------------------------------
// List of haptic modes for the DualSense controller
// -----------------------------------------------------------------

class HapticsMode {
    constructor({ mode = "23", params = ["ff", "ff", "01", "02", "01", "01", "00"], rumble = [0, 0] } = {}) {
        this.mode = mode;
        this.params = params;
        this.rumble = rumble;
    }
}

const HAPTICS_MODES = {
    // Light buzz while near or echolocating a rock.
    [GameMode.ROCK_FEEDBACK]: new HapticsMode({
        rumble: [0, 10],
    }),
    [GameMode.ECHOLOCATE_ROCK]: new HapticsMode({
        rumble: [0, 10],
    }),
    // Deep rumble with no trigger movement.
    [GameMode.ROCK_SLAM]: new HapticsMode({
        rumble: [200, 0],
        params: ["00", "00", "00", "00", "00", "00", "00"],
    }),

    // Light buzz while near or echolocating a bug.
    [GameMode.BUG_FEEDBACK]: new HapticsMode({
        rumble: [0, 10],
    }),
    [GameMode.ECHOLOCATE_BUG]: new HapticsMode({
        rumble: [0, 10],
    }),
    // Light rumble while munching a bug.
    [GameMode.BUG_MUNCH]: new HapticsMode({
        rumble: [0, 50],
    }),

    // Trigger feedback for echolocating air.
    [GameMode.ECHOLOCATE_AIR]: new HapticsMode(),
    // Trigger feedback for galloping.
    [GameMode.AIR_GALLOP]: new HapticsMode(),

    // Disable trigger effects and rumble.
    [GameMode.DISABLED]: new HapticsMode({
        mode: "05",
        params: ["00", "00", "00", "00", "00", "00", "00"],
    }),
};

// -----------------------------------------------------------------
// Switch to a different haptic based on the mode name
// -----------------------------------------------------------------

const SENDING = new WeakSet(); // Prevent overlapping updates to the same controller.

function scaleByIntensity(value, intensity) {
    return Math.round(value * intensity);
}

function applyTriggerMode(controller, mode) {
    for (const side of ["left", "right"]) {
        controller.changeTriggerEffect(side, { mode: mode.mode }, ...mode.params);
    }
}

function applyRumble(controller, mode, intensity) {
    const rumble = mode.rumble.map(value => scaleByIntensity(value, intensity));
    controller.changeRumble(...rumble);
}

async function switchHapticsMode(mode, intensity) {
    const controller = activeController;

    if (SENDING.has(controller) && intensity <= 0.99) return;

    SENDING.add(controller);

    try {
        applyTriggerMode(controller, mode);
        applyRumble(controller, mode, intensity);
        await controller.sendOutputReport();
    } catch (error) {
        console.error("Failed to update controller:", error);
    } finally {
        SENDING.delete(controller);
    }
}
