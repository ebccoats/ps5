const GameObject = Object.freeze({
    ROCK: "rock",
    BUG: "bug",
    AIR: "air",
});

const GameMode = Object.freeze({
    ROCK_FEEDBACK: "rock_feedback",
    ECHOLOCATE_ROCK: "echolocate_rock",
    ROCK_SLAM: "rock_slam",
    BUG_FEEDBACK: "bug_feedback",
    ECHOLOCATE_BUG: "echolocate_bug",
    BUG_MUNCH: "bug_munch",
    ECHOLOCATE_AIR: "echolocate_air",
    AIR_GALLOP: "air_gallop",
    DISABLED: "disabled",
});

// ---------------------------------------------------------------------------------
// Allow switching haptics & audio modes
// ---------------------------------------------------------------------------------

function calculateIntensity(distance) {
    const decay = 1;
    const intensity = 2 / (decay * distance + Math.sqrt(2)) ** 2;
    return Math.max(0, Math.min(1, intensity));
}

let switchingPaused = false;
let resumeSwitchesTimeout;
function pauseModeSwitches(time) {
    switchingPaused = true;
    clearTimeout(resumeSwitchesTimeout);
    resumeSwitchesTimeout = setTimeout(() => {
        switchingPaused = false;
    }, time);
}

function switchMode(mode, distance = 0) {
    if (switchingPaused) return;

    const intensity = calculateIntensity(distance);
    console.log("In haptics/audio mode", mode)//, "at intensity", intensity.toFixed(2));

    switchHapticsMode(HAPTICS_MODES[mode], intensity);
    switchAudioMode(AUDIO_MODES[mode], intensity);
}