import type { GameMode } from "../game/modes.js";

declare global {

    function initStrudel(options: { prebake: () => void }): void;
    function samples(source: string): void;
    function hush(): void;
    function note(note: string): any;
    function n(n: string): any;
}

// -----------------------------------------------------------------
// Setting up Audio modes
// -----------------------------------------------------------------

export type AudioModeOptions = Partial<AudioMode>;

export class AudioMode {
    readonly n: string  = "";
    readonly note: string = "";
    readonly sound: string = "sawtooth";
    readonly chord: string = "";
    readonly gain: number = 1.0;
    readonly lpf_cutoff: number = 1.0;
    readonly penv: number = 0;
    readonly pdecay: number = 0;
    readonly decay: number = 0;


    constructor(options: AudioModeOptions = {}) {
        Object.assign(this, options);
    }
}

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
// Switch to a different audio sample based on the game mode
// -----------------------------------------------------------------

let AUDIO_PLAYING = false;
let AUDIO_PRIORITY = 0;
function turnOffAudio() {
    clearAudioTimeout();
    hush();
    AUDIO_PLAYING = false;
    AUDIO_PRIORITY = 0;
}

function getLPFCutoff(intensity : number) {
    // Lowpass filer cutoff so higher frequencies are heard with higher intensity (range 3000 to 15000)
    // The lower the frequency, the less you hear
    return 5000 * Math.pow(3, intensity);
}

function calculateAudioIntensity(distanceFromObject: number): number {
    const decay = 1;
    const intensity = 2 / (decay * distanceFromObject + Math.sqrt(2)) ** 2;
    return Math.max(0, Math.min(1, intensity));
}

function createAudioPlayback(audioMode: AudioMode, distanceFromObject: number): void {
    const intensity = calculateAudioIntensity(distanceFromObject)

    var playback = audioMode.note ? note(audioMode.note) : n(audioMode.n)
    playback = playback
        .sound(audioMode.sound)
        .gain(audioMode.gain * intensity)
        .lpf(getLPFCutoff(intensity));
    if(audioMode.chord) {playback = playback.chord(audioMode.chord).voicing()}
    if(audioMode.penv) {playback = playback.penv(audioMode.penv)}
    if(audioMode.pdecay) {playback = playback.pdecay(audioMode.pdecay)}
    if(audioMode.decay) {playback = playback.decay(audioMode.decay)}

    playback.play()

    AUDIO_PLAYING = true;
}

let AUDIO_TIMEOUT: ReturnType<typeof setTimeout> | null = null;
function clearAudioTimeout() {
    if (AUDIO_TIMEOUT === null) return;
    clearTimeout(AUDIO_TIMEOUT);
    AUDIO_TIMEOUT = null;
}
function resetAudioTimeout() {
    clearAudioTimeout() 
    AUDIO_TIMEOUT = setTimeout(turnOffAudio, 500);
}


export function switchAudioMode(gameMode: GameMode, distanceFromObject: number): void {
    const { audioMode, priority, distanceCutoff } = gameMode;

    if (!audioMode.note && !audioMode.n) return;
    if (distanceFromObject > distanceCutoff) return;

    if (priority < AUDIO_PRIORITY) return;

    if (priority > AUDIO_PRIORITY || priority == 1) {
        turnOffAudio();
    } else if (AUDIO_PLAYING && distanceFromObject > 0) {
        return;
    }

    createAudioPlayback(audioMode, distanceFromObject);
    AUDIO_PRIORITY = priority;

    resetAudioTimeout()
}
