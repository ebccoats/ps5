PLAYER_COLOR = "#772b38"
AIR_COLOR = "#DECCB4" // #766F23
ROCK_COLOR = "#1B2504"
BUG_COLOR = "#BAA04D"

const CELL_SIZE = 80
const PLAYER_RADIUS = 20
const ARROW_LENGTH = 22

function setup() {
    createCanvas(board.width, board.height)
    noLoop()
}

function draw() {
    
    const [playerX, playerY] = player.getPreciseLocation()
    
    const originX = board.width / 2 - playerX * CELL_SIZE 
    const originY = board.height / 2 - playerY * CELL_SIZE

    drawBoard(originX, originY)
    drawPlayer(originX, originY)
}

// ---------------------------------------------------
// Draw board
// ---------------------------------------------------
function drawBoard(originX, originY) {
    
    const minX = Math.floor(-originX / CELL_SIZE)
    const maxX = Math.ceil((width - originX) / CELL_SIZE)
    const minY = Math.floor(-originY / CELL_SIZE)
    const maxY = Math.ceil((height - originY) / CELL_SIZE)

    for (let y = minY; y <= maxY; y++) {
    for (let x = minX; x <= maxX; x++) {
        const object = board.getObjectAt(x, y)

        switch (object) {
            case GameObject.ROCK:
                fill(ROCK_COLOR)
                break
            case GameObject.BUG:
                fill(BUG_COLOR)
                break
            default:
                fill(AIR_COLOR)
        }

        rect(
            originX + x * CELL_SIZE - CELL_SIZE / 2,
            originY + y * CELL_SIZE - CELL_SIZE / 2,
            CELL_SIZE + 1,
            CELL_SIZE + 1
        )
    }
    }
}

// ---------------------------------------------------
// Draw player
// ---------------------------------------------------
function drawPlayer(originX, originY) {
    const [x, y] = player.getPreciseLocation()
    const [orientationX, orientationY] = player.getOrientation()

    const screenX = originX + x * CELL_SIZE
    const screenY = originY + y * CELL_SIZE
    const angle = Math.atan2(orientationY, orientationX)

    push()
    translate(screenX, screenY)

    fill(PLAYER_COLOR)
    noStroke()
    ellipse(0, 0, PLAYER_RADIUS, PLAYER_RADIUS)

    rotate(angle)
    stroke(PLAYER_COLOR)
    strokeWeight(3)

    line(0, 0, ARROW_LENGTH, 0)
    triangle(
        ARROW_LENGTH, 0,
        ARROW_LENGTH - 8, -5,
        ARROW_LENGTH - 8, 5
    )

    pop()
}
