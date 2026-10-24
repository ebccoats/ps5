// ---------------------------------------------------------------------------------
// Initialize the game controller handler
// ---------------------------------------------------------------------------------
const controllerHandler = new GameControllerWebHandler();
const connectionStatus = document.getElementById("status");
connectionStatus.textContent = "No DualSense connected...please press the PS button on your controller to connect.";
controllerHandler.checkForGrantedDevices();

// ---------------------------------------------------------------------------------
// Initialize a new player and a new board
// ---------------------------------------------------------------------------------
const board = new Board()
board.render()

const player = new Player()
player.renderOn(board)

// ---------------------------------------------------------------------------------------------
// Start the game loop to continuously check for controller input and update the game state
// Check where the camera (right joy stick) is pointing, and update haptics accordingly
// ---------------------------------------------------------------------------------------------
window.requestAnimationFrame(gameLoop);

async function gameLoop() {
    window.requestAnimationFrame(gameLoop);

    const open_controllers = controllerHandler.controllers.filter(controller => controller.device_ && controller.device_.opened);
    connectionStatus.textContent = open_controllers.length ? "DualSense connected.  You're ready to play!" : "No DualSense connected...please press the PS button on your controller to connect.";

    for (const controller of open_controllers) {
        if (controller.input && controller.input.rightJoyStickHasTriggered()) {
            let [camera_dx,camera_dy] = controller.input.getRoundedPositionsOnRightJoyStick()
            let [camera_x,camera_y] = [player.getLocation()[0] + camera_dx, player.getLocation()[1] + camera_dy]
            object = board.getObjectAt(camera_x, camera_y)
            
            console.log("Object at Camera Location:", camera_x, camera_y, "is", object)

            switchMode(object)
        } 

    }
}




