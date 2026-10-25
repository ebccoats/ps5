// -----------------------------------------------------------------
// List of gameplay sounds
// -----------------------------------------------------------------

class AudioMode {

    constructor({ name = "", label = "", notes = null,  sound="sawtooth", chord = null, gain = 1.0} = {}) {
        this.name = name;
        this.label = label;
        this.notes = notes;
        this.sound = sound;
        this.chord = chord;
        this.gain = gain;
    }
}

const AUDIO_MODES = {
    rock: new AudioMode({
        name: "rock",
        label: "Deep rumble",
        // sound: "<lt, mt>",
        // gain: 0.1,
    }),
    slamRock: new AudioMode({
        name: "slamRock",
        label: "Level down sound",
        notes: "0",
        sound: "lt"
        // notes: "<7 6 5 4 3 2 1 0 0 0 0 lt@@>*30",
        // chord: "Am"
    }),
    bug: new AudioMode({
        name: "bug",
        label: "Light rumble",
        notes: "<0 0 ->*16",
        sound: "insect"
    }),
    munchBug: new AudioMode({
        name: "munchBug",
        label: "Level up sound",
        notes: "<0 1 2 3 4 5 6 5 4 3 4 5 6>*30",
        chord: "C"
    }),
    air: new AudioMode({
        name: "air",
        label: "Gallop",
        // audio: "<wind>/8",
    }),
};

// -----------------------------------------------------------------
// Switch to a different audio sample based on the mode name
// -----------------------------------------------------------------

var AUDIO_PLAYING = false;

function turnOffAudio() {
    AUDIO_PLAYING = false;
    hush();
}

function switchAudioMode(audioMode, intensity) {
    if (audioMode?.notes && !AUDIO_PLAYING || audioMode?.notes && intensity > .99) {
        AUDIO_PLAYING = true;
        // n("lt").chord("Am").voicing().sound("sawtooth").play()
        let audio = n(audioMode.notes).sound(audioMode.sound).gain(audioMode.gain * intensity)
        if (audioMode.chord !== null) {
            audio.chord(audioMode.chord).voicing().play()
        }
        else {
            audio.play()
        }
        setTimeout(turnOffAudio, 500);
    }
}
