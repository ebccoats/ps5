
import type { DualSenseHid } from "./dualsense.js";
import type { GameMode } from "../game/modes.js";

// -----------------------------------------------------------------
// Setting up Haptics modes
// -----------------------------------------------------------------

export type HapticsModeOptions = Partial<HapticsMode>;


export class HapticsMode {
    readonly mode: string = "23";
    readonly params: string[] = ["ff", "ff", "01", "02", "01", "01", "00"];
    readonly rumble: [number, number] = [0, 0];

    constructor(options: HapticsModeOptions = {}) {
        Object.assign(this, options);
    }
}

// -----------------------------------------------------------------
// Switch to a different haptic based on the game mode
// -----------------------------------------------------------------

const SENDING = new WeakSet(); // Prevent overlapping updates to the same controller.
const SENDING_PRIORITY = new WeakMap<DualSenseHid, number>();
const SENDING_COUNT = new WeakMap<DualSenseHid, number>();

function scaleByIntensity(value: number, intensity: number): number {
    return Math.round(value * intensity);
}

function applyTriggerMode(controller: DualSenseHid, mode: GameMode["hapticsMode"]): void {
    for (const side of ["left", "right"] as const) {
        controller.changeTriggerEffect(side, { mode: mode.mode }, ...mode.params);
    }
}

function applyRumble(controller: DualSenseHid, mode: GameMode["hapticsMode"], intensity: number): void {
    const rumble = mode.rumble.map(value => scaleByIntensity(value, intensity));
    controller.changeRumble(rumble[0], rumble[1]);
}

function calculateHapticsIntensity(distanceFromObject: number): number {
    const decay = 1;
    const intensity = 2 / (decay * distanceFromObject + Math.sqrt(2)) ** 2;
    return Math.max(0, Math.min(1, intensity));
}

export async function switchHapticsMode(
    controller: DualSenseHid | null,
    gameMode: GameMode,
    distanceFromObject: number
): Promise<void> {
    const { hapticsMode, priority, distanceCutoff } = gameMode;
    const intensity = calculateHapticsIntensity(distanceFromObject)

    if (distanceFromObject > distanceCutoff) return;
    if (!controller) return;

    const sendingPriority = SENDING_PRIORITY.get(controller) ?? 0;
    if (
        SENDING.has(controller) &&
        (priority < sendingPriority || intensity <= 0.99)
    ) {
        return;
    }

    SENDING.add(controller);
    SENDING_PRIORITY.set(controller, Math.max(sendingPriority, priority));
    SENDING_COUNT.set(controller, (SENDING_COUNT.get(controller) ?? 0) + 1);

    try {
        applyTriggerMode(controller, hapticsMode);
        applyRumble(controller, hapticsMode, intensity);
        await controller.sendOutputReport();
    } catch (error) {
        console.error("Failed to update controller:", error);
    } finally {
        const remainingSends = (SENDING_COUNT.get(controller) ?? 0) - 1;
        if (remainingSends === 0) {
            SENDING.delete(controller);
            SENDING_PRIORITY.delete(controller);
            SENDING_COUNT.delete(controller);
        } else {
            SENDING_COUNT.set(controller, remainingSends);
        }
    }
}
