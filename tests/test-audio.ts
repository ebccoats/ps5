interface MockPattern {
    sound(value: string): MockPattern;
    gain(value: number): MockPattern;
    lpf(value: number): MockPattern;
    chord(value: string): MockPattern;
    voicing(): MockPattern;
    penv(value: number): MockPattern;
    pdecay(value: number): MockPattern;
    decay(value: number): MockPattern;
    play(): void;
}

interface TestGameMode {
    audioMode: {
        n: string;
        note: string;
        sound: string;
        gain: number;
        chord: string;
        penv: number;
        pdecay: number;
        decay: number;
    };
    priority: number;
    distanceCutoff: number;
}

export async function testPriorityOneAudioAlwaysPlays(): Promise<void> {
    let playCount = 0;
    const createPattern = (): MockPattern => {
        const pattern: MockPattern = {
            sound: () => pattern,
            gain: () => pattern,
            lpf: () => pattern,
            chord: () => pattern,
            voicing: () => pattern,
            penv: () => pattern,
            pdecay: () => pattern,
            decay: () => pattern,
            play: () => {
                playCount += 1;
            },
        };
        return pattern;
    };

    const testGlobals = globalThis as typeof globalThis & {
        initStrudel: (options: { prebake: () => void }) => void;
        samples: (source: string) => void;
        hush: () => void;
        note: (value: string) => MockPattern;
        n: (value: string) => MockPattern;
    };
    testGlobals.initStrudel = () => {};
    testGlobals.samples = () => {};
    testGlobals.hush = () => {};
    testGlobals.note = () => createPattern();
    testGlobals.n = () => createPattern();

    const audioModulePath: string = "../dist-js/audio/audio.js";
    const modesModulePath: string = "../dist-js/game/modes.js";
    const { switchAudioMode } = await import(audioModulePath) as {
        switchAudioMode: (gameMode: TestGameMode, distanceFromObject: number) => void;
    };
    const { GameMode } = await import(modesModulePath) as {
        GameMode: {
            ECHOLOCATE_ROCK: TestGameMode;
            SLAM_ROCK: TestGameMode;
        };
    };

    switchAudioMode(GameMode.ECHOLOCATE_ROCK, 0.25);
    switchAudioMode(GameMode.SLAM_ROCK, 0.25);
    switchAudioMode(GameMode.SLAM_ROCK, 0.25);

    if (playCount !== 3) {
        throw new Error(`Expected 3 playback calls, received ${playCount}`);
    }

    console.log("Passed: priority-1 audio always plays when called");
}
