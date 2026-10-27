import type { DualSenseHid } from "../controller/dualsense.js";
import type { GameMode } from "./modes.js";
import { switchAudioMode } from "../audio/audio.js";
import { switchHapticsMode } from "../controller/haptics.js";

export function switchMode(
    controller: DualSenseHid,
    gameMode: GameMode,
    distanceFromObject: number
): void {
    console.log("In haptics/audio mode", gameMode.name);

    switchHapticsMode(controller, gameMode, distanceFromObject);
    switchAudioMode(gameMode, distanceFromObject);
}
