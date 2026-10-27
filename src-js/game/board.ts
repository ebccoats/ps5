import { GameObject, type GameObjectType } from "./objects.js";
import type { Player } from "./player.js";

export type GridLocation = [number, number];
export interface BoardIntersection {
    object: GameObjectType;
    location: GridLocation;
}
export interface RayHit {
    object: GameObjectType;
    distance: number;
}

export class Board {
    readonly width = 400;
    readonly height = 400;
    readonly pixelsPerCell = 80;
    readonly player: Player;
    private readonly objectsByLocation = new Map<string, GameObjectType>();
    private readonly rock_occs = 0.2;
    private readonly bug_occs = 0.1;

    constructor(player: Player) {
        this.player = player;

        this.populateInitialBoard()
    }

    private populateInitialBoard() {
        const columns = Math.ceil(this.width / this.pixelsPerCell)
        const rows = Math.ceil(this.height / this.pixelsPerCell)
        const centerX = Math.round(this.player.x)
        const centerY = Math.round(this.player.y)
        const startX = centerX - Math.floor(columns / 2)
        const startY = centerY - Math.floor(rows / 2)
        const locations: GridLocation[] = []

        for (let row = 0; row < rows; row++) {
            for (let column = 0; column < columns; column++) {
                const x = startX + column
                const y = startY + row

                if (x !== centerX || y !== centerY) {
                    locations.push([x, y])
                }
            }
        }

        for (let index = locations.length - 1; index > 0; index--) {
            const swapIndex = Math.floor(Math.random() * (index + 1))
            ;[locations[index], locations[swapIndex]] = [locations[swapIndex], locations[index]]
        }

        const rockCount = Math.round(columns * rows * this.rock_occs)
        const bugCount = Math.round(columns * rows * this.bug_occs)

        locations.forEach((location, index) => {
            let object: GameObjectType = GameObject.AIR
            if (index < rockCount) {
                object = GameObject.ROCK
            } else if (index < rockCount + bugCount) {
                object = GameObject.BUG
            }

            this.objectsByLocation.set(this.getLocationKey(...location), object)
        })

        this.objectsByLocation.set(
            this.getLocationKey(centerX, centerY),
            GameObject.AIR
        )
    }

    private getLocationKey(x: number, y: number): string {
        return `${x},${y}`
    }

    private getGridLocation(x: number, y: number): GridLocation {
        return [Math.round(x), Math.round(y)]
    }

    getObjectAt(x: number, y: number): GameObjectType {
        const [gridX, gridY] = this.getGridLocation(x, y)
        const locationKey = this.getLocationKey(gridX, gridY)
        const existingObject = this.objectsByLocation.get(locationKey)

        if (existingObject !== undefined) {
            return existingObject
        }

        const rand = Math.random()
        let object: GameObjectType = GameObject.AIR

        if (rand < this.rock_occs) {
            object = GameObject.ROCK
        } else if (rand < this.rock_occs + this.bug_occs) {
            object = GameObject.BUG
        }

        this.objectsByLocation.set(locationKey, object)

        return object
    }

    getFirstObjectOnRay(
        x: number,
        y: number,
        directionX: number,
        directionY: number,
        maxDistance: number
    ): RayHit  {
        const directionLength = Math.hypot(directionX, directionY)

        const unitX = directionX / directionLength
        const unitY = directionY / directionLength
        const [startX, startY] = this.getGridLocation(x, y)
        let column = startX
        let row = startY
        const stepX = Math.sign(unitX)
        const stepY = Math.sign(unitY)
        const deltaX = stepX === 0 ? Infinity : 1 / Math.abs(unitX)
        const deltaY = stepY === 0 ? Infinity : 1 / Math.abs(unitY)
        let nextX = stepX === 0
            ? Infinity
            : (column + stepX / 2 - x) / unitX
        let nextY = stepY === 0
            ? Infinity
            : (row + stepY / 2 - y) / unitY
        let distance = 0

        while (distance <= maxDistance) {
            const object = this.getObjectAt(column, row)
            if (object !== GameObject.AIR) return { object, distance }

            if (nextX < nextY) {
                column += stepX
                distance = nextX
                nextX += deltaX
            } else if (nextY < nextX) {
                row += stepY
                distance = nextY
                nextY += deltaY
            } else {
                column += stepX
                row += stepY
                distance = nextX
                nextX += deltaX
                nextY += deltaY
            }
        }

        return { object: GameObject.AIR, distance: maxDistance }
    }

    getObjectsOverlapping(x: number, y: number, radius = 0): BoardIntersection[] {
        const objects: BoardIntersection[] = []
        const extent = 0.5 + radius
        const minX = Math.ceil(x - extent)
        const maxX = Math.floor(x + extent)
        const minY = Math.ceil(y - extent)
        const maxY = Math.floor(y + extent)

        for (let row = minY; row <= maxY; row++) {
            for (let column = minX; column <= maxX; column++) {
                const gridX = column
                const gridY = row
                const object = this.getObjectAt(gridX, gridY)

                if (object !== GameObject.AIR) {
                    objects.push({ object, location: [gridX, gridY] })
                }
            }
        }

        return objects.filter(({ location }) => {
            const distanceX = Math.max(Math.abs(x - location[0]) - 0.5, 0)
            const distanceY = Math.max(Math.abs(y - location[1]) - 0.5, 0)
            return Math.hypot(distanceX, distanceY) <= radius
        })
    }

    changeObjectAt(x: number, y: number, newObj: GameObjectType): void {
        const [gridX, gridY] = this.getGridLocation(x, y)
        const locationKey = this.getLocationKey(gridX, gridY)

        this.objectsByLocation.set(locationKey, newObj)
    }
}
