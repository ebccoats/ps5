// ---------------------------------------------------------------------------------
// Initialize a new player and a new board, and render them
// --------------------------------------------------------------------------------- 
const player = new Player()
const board = new Board(player)

// ---------------------------------------------------------------------------------
// Initialize the game controller handler
// ---------------------------------------------------------------------------------
const controllerHandler = new GameControllerWebHandler();

// ---------------------------------------------------------------------------------
// Initialize audio sounds
// ---------------------------------------------------------------------------------
initStrudel({
  prebake: () => {
    samples("github:tidalcycles/dirt-samples") // bd (drums), insect, etc. 
    samples("https://strudel.b-cdn.net/piano.json") // piano
  }
});

// -----------------------------------------------------------------
// Allow switching haptics & audio modes
// -----------------------------------------------------------------
function calculateIntensity(distance) {
    const decay = 1; // larger for faster sound decay with distance
    const intensity = 2 / (decay * distance + Math.sqrt(2)) ** 2;
    return Math.max(0, Math.min(1, intensity)); // must be between 0 and 1
}

var switchingPaused = false

function resumeModeSwitches() {
    switchingPaused = false
}

function pauseModeSwitches(time) {
    switchingPaused = true
    setTimeout(resumeModeSwitches, time)
}

function switchMode(modeName, distance = 0) {
    if (switchingPaused && modeName !== "slamRock") return;

    const intensity = calculateIntensity(distance);
    console.log("Switching to mode", modeName, "at intensity", intensity)

    const hapticsMode = HAPTICS_MODES[modeName];
    switchHapticsMode(hapticsMode, intensity);

    const audioMode = AUDIO_MODES[modeName];
    switchAudioMode(audioMode, intensity);
}

// -----------------------------------------------------------------
// Continously check for controller input
// -----------------------------------------------------------------

async function processControllerInput(controller) {
    if (!controller.input) return

    const [playerX, playerY] = player.getLocation()

    // -------------------------------------------
    // Feel the haptics of where you are looking
    // -------------------------------------------
    if (controller.input.rightJoyStickHasTriggered()) {
        
        const [cameraDX, cameraDY] = controller.input.getRoundedPositionsOnRightJoyStick()
        const [cameraX, cameraY] = [playerX + cameraDX, playerY + cameraDY]

        // Change haptics
        let object = board.getObjectAt(cameraX, cameraY)
        dist = player.getDistanceFromObject(cameraX, cameraY)
        // console.log("Distance from object", object,"is", dist)
        switchMode(object, dist)

        // Change the direction you are looking in
        player.changeOrientation(cameraX, cameraY)
        // console.log("Object at Camera Location:", cameraX, cameraY, "is", object)

        draw()
    } 

    // ---------------------------------------------
    // Otherwise, only feel the haptics of where you are
    // ---------------------------------------------
    else {
        let object = board.getObjectAt(...player.getLocation())
        switchMode(object)
        // console.log("Object at Your Location", player.getPreciseLocation()[0], player.getPreciseLocation()[1],"is", object)

    }

    // -------------------------------------------------------------
    // Move forward (in direction of camera) if trigger is down
    // -------------------------------------------------------------
    if (controller.input.triggerDown()) {
        player.move(board) // move in the direction of player's orientation
        draw()
    }

}


// ---------------------------------------------------------------------------------------------
// Start the game loop 
// ---------------------------------------------------------------------------------------------
var activeController = null

async function gameLoop() {
    if (activeController)
        processControllerInput(activeController)
    else
        activeController = await connectToController()

    window.requestAnimationFrame(gameLoop)
}

window.requestAnimationFrame(gameLoop);

