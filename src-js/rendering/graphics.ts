import { GameObject } from "../game/objects.js";
import type { Board } from "../game/board.js";
import type { Player } from "../game/player.js";

const PLAYER_COLOR = "#772b38"
const AIR_COLOR = "#DECCB4"
const ROCK_COLOR = "#1B2504"
const BUG_COLOR = "#BAA04D"

const OBJECT_RADIUS = 0.5
const PLAYER_RADIUS = 20
const ARROW_LENGTH = 22

let board!: Board;
let player!: Player;
let sketch!: P5Instance;


export interface P5Instance {
    width: number;
    height: number;
    setup: () => void;
    draw: () => void;
    createCanvas(width: number, height: number): void;
    noLoop(): void;
    fill(color: string): void;
    rect(x: number, y: number, width: number, height: number): void;
    push(): void;
    translate(x: number, y: number): void;
    ellipse(x: number, y: number, width: number, height: number): void;
    noStroke(): void;
    rotate(angle: number): void;
    stroke(color: string): void;
    strokeWeight(weight: number): void;
    line(x1: number, y1: number, x2: number, y2: number): void;
    triangle(x1: number, y1: number, x2: number, y2: number, x3: number, y3: number): void;
    pop(): void;
}

declare const p5: new (initialize: (sketch: P5Instance) => void) => P5Instance;
export function initializeGraphics(gameBoard: Board, gamePlayer: Player): void {
    board = gameBoard;
    player = gamePlayer;
    sketch = new p5(p => {
        p.setup = () => {
            p.createCanvas(board.width, board.height);
            p.noLoop();
        };
        p.draw = () => render(p);
    });
}

export function draw(): void {
    render(sketch);
}

function render(p: P5Instance): void {
    const [playerX, playerY] = player.getPreciseLocation()

    drawBoard(p, playerX, playerY)
    drawPlayer(p)
    drawPlayerArrow(p)
}

// ---------------------------------------------------
// Draw board
// ---------------------------------------------------
function drawBoard(p: P5Instance, playerX: number, playerY: number): void {
    p.fill(AIR_COLOR)
    p.rect(0, 0, p.width, p.height)

    const pixelsPerCell = board.pixelsPerCell
    const centerX = board.width / 2
    const centerY = board.height / 2
    const minX = Math.floor(playerX - centerX / pixelsPerCell - OBJECT_RADIUS)
    const maxX = Math.ceil(playerX + (p.width - centerX) / pixelsPerCell + OBJECT_RADIUS)
    const minY = Math.floor(playerY - centerY / pixelsPerCell - OBJECT_RADIUS)
    const maxY = Math.ceil(playerY + (p.height - centerY) / pixelsPerCell + OBJECT_RADIUS)
    const objectSize = 2 * OBJECT_RADIUS * pixelsPerCell

    for (let row = minY; row <= maxY; row++) {
        for (let column = minX; column <= maxX; column++) {
            const x = column
            const y = row
            const object = board.getObjectAt(x, y)

            if (object === GameObject.AIR) continue

            p.fill(object === GameObject.ROCK ? ROCK_COLOR : BUG_COLOR)
            p.rect(
                centerX + (x - playerX) * pixelsPerCell - objectSize / 2,
                centerY + (y - playerY) * pixelsPerCell - objectSize / 2,
                objectSize,
                objectSize
            )
        }
    }
}

// ---------------------------------------------------
// Draw player
// ---------------------------------------------------
function drawPlayer(p: P5Instance): void {
    
    p.push()
    p.translate(board.width / 2, board.height / 2)

    p.fill(PLAYER_COLOR)
    p.noStroke()

    p.ellipse(0, 0, PLAYER_RADIUS, PLAYER_RADIUS)

    p.pop()
}

// ---------------------------------------------------
// Draw player arrow
// ---------------------------------------------------

function drawPlayerArrow(p: P5Instance): void {
    const [orientationX, orientationY] = player.getOrientation()
    const angle = Math.atan2(orientationY, orientationX)

    p.push()

    p.translate(board.width / 2, board.height / 2)
    p.rotate(angle)

    p.fill(PLAYER_COLOR)
    p.stroke(PLAYER_COLOR)
    p.strokeWeight(3)

    p.line(0, 0, ARROW_LENGTH, 0)
    p.triangle(
        ARROW_LENGTH, 0,
        ARROW_LENGTH - 8, -5,
        ARROW_LENGTH - 8, 5
    )

    p.pop()
}