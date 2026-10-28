// -----------------------------------------------------------------
// List of haptic modes for the DualSense controller
// -----------------------------------------------------------------


// call these HapticsMode objects "settings" when passing around as arguments
class HapticsMode {
    constructor({ 
        mode = 23,
        rumble = [0, 0],
        params = [255, 255, 1, 2, 1, 1, 0],
    } = {}) {
        this.mode = mode;
        this.params = params;
        this.rumble = rumble;
    }
}

const HAPTICS_MODES = {
    // Light buzz while near or echolocating a rock.
    [GameMode.ROCK_FEEDBACK]: new HapticsMode({
        // rumble: [0, 10],
    }),
    [GameMode.ECHOLOCATE_ROCK]: new HapticsMode({
        rumble: [0, 10],
        params: [255, 1, 2, 10, 1, 1, 0],
    }),
    // Deep rumble with no trigger movement.
    [GameMode.ROCK_SLAM]: new HapticsMode({
        rumble: [200, 0],
        params: [0, 0, 0, 0, 0, 0, 0],
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
        mode: 5,
        params: [0, 0, 0, 0, 0, 0, 0],
    }),
};

// -----------------------------------------------------------------
// Switch to a different haptic based on the mode name
// -----------------------------------------------------------------

const SENDING = new WeakSet(); // Prevent overlapping updates to the same controller.

function scaleByIntensity(value, intensity) {
    return Math.round(value * intensity);
}

function applyTriggerMode(controller, settings) {
    for (const side of ["left", "right"]) {
        controller.changeTriggerEffect(side, settings);
    }
}

function applyRumble(controller, settings, intensity) {
    const rumble = settings.rumble.map(value => scaleByIntensity(value, intensity));
    controller.changeRumble(...rumble);
}

async function switchHapticsMode(settings, intensity) {
    const controller = activeController;

    if (SENDING.has(controller) && intensity <= 0.99) return;

    SENDING.add(controller);

    try {
        applyTriggerMode(controller, settings);
        applyRumble(controller, settings, intensity);
        await controller.sendOutputReport();
    } catch (error) {
        console.error("Failed to update controller:", error);
    } finally {
        SENDING.delete(controller);
    }
}
