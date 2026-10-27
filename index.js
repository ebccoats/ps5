// ---------------------------------------------------------------------------------
// Initialize a new player and board
// ---------------------------------------------------------------------------------
const player = new Player();
const board = new Board(player);


// ---------------------------------------------
// Feel haptics / audio of where you're looking
// ---------------------------------------------

const ECHOLOCATION_MODE_BY_OBJECT = {
    [GameObject.ROCK]: GameMode.ECHOLOCATE_ROCK,
    [GameObject.BUG]: GameMode.ECHOLOCATE_BUG,
    [GameObject.AIR]: GameMode.ECHOLOCATE_AIR,
};

function updateEcholocation(controller, playerX, playerY) {
    const [cameraDX, cameraDY] = controller.input.getRoundedPositionsOnRightJoyStick();
    const cameraX = playerX + cameraDX;
    const cameraY = playerY + cameraDY;
    const object = board.getObjectAt(cameraX, cameraY);
    const distance = player.getDistanceFromObject(cameraX, cameraY);

    switchMode(ECHOLOCATION_MODE_BY_OBJECT[object], distance);
    player.changeOrientation(cameraX, cameraY);
    draw();
}

// ---------------------------------------------
// Feel haptics / audio of where you currently are
// ---------------------------------------------

const FEEDBACK_MODE_BY_OBJECT = {
    [GameObject.ROCK]: GameMode.ROCK_FEEDBACK,
    [GameObject.BUG]: GameMode.BUG_FEEDBACK,
    [GameObject.AIR]: GameMode.AIR_GALLOP,
};

function applyEnvironmentFeedback() {
    const object = board.getObjectAt(...player.getLocation());
    switchMode(FEEDBACK_MODE_BY_OBJECT[object]);
}

// ---------------------------------------------
// Read controller input (joystick + trigger)
// ---------------------------------------------

function processControllerInput(controller) {
    if (!controller.input) return;

    const [playerX, playerY] = player.getLocation();

    if (controller.input.rightJoyStickHasTriggered()) {
        updateEcholocation(controller, playerX, playerY);
    } else {
        applyEnvironmentFeedback();
    }

    if (controller.input.triggerDown()) {
        player.move(board);
        draw();
    }
}

const controllerHandler = new GameControllerWebHandler();
let activeController = null;

async function gameLoop() {
    if (activeController) 
        processControllerInput(activeController);
    else 
        activeController = await connectToController();

    window.requestAnimationFrame(gameLoop);
}

window.requestAnimationFrame(gameLoop);
