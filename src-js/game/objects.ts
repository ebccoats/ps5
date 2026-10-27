export const GameObject = Object.freeze({
    ROCK: "rock",
    BUG: "bug",
    AIR: "air",
} as const);

export type GameObjectType = typeof GameObject[keyof typeof GameObject];