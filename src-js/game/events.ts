import { GameMode } from "./modes.js";
import { GameObject, type GameObjectType } from "./objects.js";
import { type RayHit } from "./board.js";
import { switchMode } from "./mode-switcher.js";
import { draw } from "../rendering/graphics.js";
import type { DualSenseHid } from "../controller/dualsense.js";

// ------------------------------------------------------
// GameEvents trigger GameModes (audio or haptics)
// -------------------------------------------------------

export const GameEvent = Object.freeze({
    PLAYER_MOVED: "player-moved",
    PLAYER_TURNED: "player-orientation-changed",
    BUG_EATEN: "bug-eaten",
    ROCK_HIT: "rock-hit",
    ECHOLOCATED: "echolocated"
});

export type GameEventType = typeof GameEvent[keyof typeof GameEvent];
export type GameEventListener = (payload?: unknown) => void;

export class GameEvents {
    private readonly listeners = new Map<GameEventType, Set<GameEventListener>>();

    on(event: GameEventType, listener: GameEventListener) {
        let listeners = this.listeners.get(event);
        if (!listeners) {
            listeners = new Set();
            this.listeners.set(event, listeners);
        }
        listeners.add(listener);

        return () => {
            listeners.delete(listener);
        };
    }

    emit(event: GameEventType, payload?: unknown) {
        for (const listener of this.listeners.get(event) ?? []) {
            listener(payload);
        }
    }
}

// ------------------------------------------------------
// Results of triggers
// -------------------------------------------------------

export function createGameEvents(controller: DualSenseHid): GameEvents {
    const gameEvents = new GameEvents();

    gameEvents.on(GameEvent.PLAYER_MOVED, draw);
    gameEvents.on(GameEvent.PLAYER_TURNED, () => {
        switchMode(controller, GameMode.TURN, 0);
        draw();
    });
    gameEvents.on(GameEvent.BUG_EATEN, () => {
        switchMode(controller, GameMode.MUNCH_BUG, 0);
    });
    gameEvents.on(GameEvent.ROCK_HIT, () => {
        switchMode(controller, GameMode.SLAM_ROCK, 0);
    });
    gameEvents.on(GameEvent.ECHOLOCATED, (hit) => {
        if (!isRayHit(hit)) {
            throw new TypeError("Echolocated event hit must be a ray hit");
        }

        const modeByObject: Record<GameObjectType, GameMode> = {
            [GameObject.ROCK]: GameMode.ECHOLOCATE_ROCK,
            [GameObject.BUG]: GameMode.ECHOLOCATE_BUG,
            [GameObject.AIR]: GameMode.ECHOLOCATE_AIR,
        };

        switchMode(controller, modeByObject[hit.object], hit.distance);
    });

    return gameEvents;
}

function isRayHit(value: unknown): value is RayHit {
    if (typeof value !== "object" || value === null) return false;

    const hit = value as { object?: unknown; distance?: unknown };
    const isKnownObject = Object.values(GameObject).some(object => object === hit.object);
    return isKnownObject && typeof hit.distance === "number" && Number.isFinite(hit.distance);
}
