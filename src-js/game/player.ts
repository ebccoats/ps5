import { GameEvent } from "./events.js";
import { GameObject } from "./objects.js";
import type { GameEvents } from "./events.js";
import type { Board, GridLocation } from "./board.js";

const PLAYER_COLLISION_RADIUS = 0

export class Player {
  x = 2;
  y = 2;
  orientation: GridLocation = [0, 1];
  velocity = 0.005;
  private readonly events: GameEvents;

  constructor(events: GameEvents) {
    this.events = events;
  }

  // ------------------------------------------------------------------
  // Turning
  // ------------------------------------------------------------------

  getOrientation(): GridLocation {
    return this.orientation
  }

  private isNewOrientation(x: number, y: number): boolean {
    return this.orientation[0] !== x || this.orientation[1] !== y
  }

  private isValidOrientation(x: number, y: number): boolean {
    return x !== 0 || y !== 0 // at least one component of the direction vector is nonzero
  }

  changeOrientation(camera_x: number, camera_y: number): boolean {
    const [x, y] = [
      Math.ceil(camera_x),
      Math.ceil(camera_y),
    ]
    if (!this.isValidOrientation(x, y) || !this.isNewOrientation(x, y)) return false

    this.orientation = [x, y]
    this.events.emit(GameEvent.PLAYER_TURNED)
    return true
  }

  // ------------------------------------------------------------------
  // Moving
  // ------------------------------------------------------------------

  move(board: Board, velocity = this.velocity): void {
    const previousX = this.x
    const previousY = this.y
    this.x += velocity*this.orientation[0]
    this.y += velocity*this.orientation[1]

    const overlappingObjects = board.getObjectsOverlapping(
      this.x,
      this.y,
      PLAYER_COLLISION_RADIUS
    )
    const rock = overlappingObjects.find(({ object }) => object === GameObject.ROCK)

    if (rock) {
      this.x = previousX
      this.y = previousY
      this.bumpIntoRock(board)
    } else {
      const bug = overlappingObjects.find(({ object }) => object === GameObject.BUG)
      if (bug) {
        this.eatBug(board, bug.location)
      }
    }

    this.events.emit(GameEvent.PLAYER_MOVED)
  }

  // ------------------------------------------------------------------
  // Taking actions (eating bugs or bumping into rocks)
  // ------------------------------------------------------------------

  private eatBug(board: Board, location: GridLocation): void {
    board.changeObjectAt(...location, GameObject.AIR)
    this.events.emit(GameEvent.BUG_EATEN, { location })
  }

  private bumpIntoRock(board: Board): void {
    // The player shouldn't be able to enter this space.
    this.move(board, -20 * this.velocity)
    this.events.emit(GameEvent.ROCK_HIT)
  }

  echolocate(board: Board): void {
    const maxDistance = 2;
    const hit = board.getFirstObjectOnRay(
      ...this.getPreciseLocation(),
      ...this.getOrientation(),
      maxDistance
    );

    this.events.emit(GameEvent.ECHOLOCATED, hit);
  }

  // ------------------------------------------------------------------
  // Getting Locations
  // ------------------------------------------------------------------

  getPreciseLocation(): GridLocation {
    return [this.x, this.y]
  }

}