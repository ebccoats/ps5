// ---------------------------------------------------------------------------------
// Initialize audio sounds
// ---------------------------------------------------------------------------------

initStrudel({
    prebake: () => {
        samples("github:tidalcycles/dirt-samples");
        // samples("https://strudel.b-cdn.net/piano.json");
    },
});

// -----------------------------------------------------------------
// List of gameplay sounds
// -----------------------------------------------------------------

class AudioMode {
    constructor({ notes = null, sound = "sawtooth", chord = null, gain = 1.0 } = {}) {
        this.notes = notes;
        this.sound = sound;
        this.chord = chord;
        this.gain = gain;
    }
}

const AUDIO_MODES = {
    [GameMode.ROCK_FEEDBACK]: new AudioMode(),
    [GameMode.BUG_FEEDBACK]: new AudioMode(),
    [GameMode.AIR_GALLOP]: new AudioMode(),
    [GameMode.ECHOLOCATE_ROCK]: new AudioMode(),
    [GameMode.ROCK_SLAM]: new AudioMode({
        notes: "0",
        sound: "lt",
    }),
    [GameMode.ECHOLOCATE_BUG]: new AudioMode({
        notes: "<0 0 ->*16",
        sound: "insect",
    }),
    [GameMode.BUG_MUNCH]: new AudioMode({
        notes: "<0 1 2 3 4 5 6 5 4 3 4 5 6>*30",
        chord: "C",
    }),
    [GameMode.ECHOLOCATE_AIR]: new AudioMode(),
    [GameMode.DISABLED]: new AudioMode(),
};

// -----------------------------------------------------------------
// Switch to a different audio sample based on the mode name
// -----------------------------------------------------------------

let AUDIO_PLAYING = false;
function turnOffAudio() {
    clearAudioTimeout();
    hush();
    AUDIO_PLAYING = false;
}
function createAudioPlayback(audioMode, intensity) {
    
    const audio = n(audioMode.notes)
        .sound(audioMode.sound)
        .gain(audioMode.gain * intensity);

    const playback = audioMode.chord != null
        ? audio.chord(audioMode.chord).voicing()
        : audio;

    playback.play()

    AUDIO_PLAYING = true;
}

let AUDIO_TIMEOUT = null;
function clearAudioTimeout() {
    if (AUDIO_TIMEOUT === null) return;
    clearTimeout(AUDIO_TIMEOUT);
    AUDIO_TIMEOUT = null;
}
function resetAudioTimeout() {
    clearAudioTimeout() 
    AUDIO_TIMEOUT = setTimeout(turnOffAudio, 500);
}


function switchAudioMode(audioMode, intensity) {
    const shouldPlay = Boolean(audioMode?.notes) && (!AUDIO_PLAYING || intensity > 0.99);
    if (!shouldPlay) return;

    
    createAudioPlayback(audioMode, intensity);

    resetAudioTimeout()
}
