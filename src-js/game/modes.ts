import { AudioMode } from "../audio/audio.js";
import { HapticsMode } from "../controller/haptics.js";

export type GameModeOptions = Partial<GameMode>;

export class GameMode {
    readonly name: string               = "";
    readonly audioMode: AudioMode       =  new AudioMode();
    readonly hapticsMode: HapticsMode   = new HapticsMode();
    readonly priority: number           = 0;
    readonly distanceCutoff: number     = 2;

    constructor(options: GameModeOptions = {}) {
        Object.assign(this, options);
    }

    static TURN = new GameMode({
        name: "turn",
        audioMode: new AudioMode({
            note: "c4",
            sound: "triangle",
            gain: 0.6,
            penv: 32,
            pdecay: 0.5,
            decay: 0.5
        }),
        priority: 1,
    });

    static ECHOLOCATE_ROCK = new GameMode({
        name: "echolocating-rock",
        audioMode: new AudioMode({
            n: "0",
            sound: "wind",
        }),
        hapticsMode: new HapticsMode({
            rumble: [0, 10],
            params: [255, 1, 2, 10, 1, 1, 0],
        }),
        distanceCutoff: 1
    });

    static SLAM_ROCK = new GameMode({
        name: "rock-slam",
        audioMode: new AudioMode({
            n: "0",
            sound: "lt",
        }),
        hapticsMode: new HapticsMode({
            mode: 0,
            rumble: [200, 0],
            params: [0, 0, 0, 0, 0, 0, 0],
        }),
        priority: 1,
    });

    static ECHOLOCATE_BUG = new GameMode({
        name: "echolocating-bug",
        audioMode: new AudioMode({
            n: "<0 0 ->*16",
            sound: "insect",
        }),
        hapticsMode: new HapticsMode({ 
            rumble: [0, 10] 
        }),
    });

    static MUNCH_BUG = new GameMode({
        name: "munching-bug",
        audioMode: new AudioMode({
            n: "<0 1 2 3 4 5 6 5 4 3 4 5 6>*30",
            chord: "C",
        }),
        hapticsMode: new HapticsMode({ 
            rumble: [0, 50] 
        }),
        priority: 1,
    });

    static ECHOLOCATE_AIR = new GameMode({
        name: "echolocating-air",
    });

}
