// -----------------------------------------------------------------
// Controller connection
// -----------------------------------------------------------------
const connectionStatus = document.getElementById("status");
connectionStatus.textContent = "No DualSense connected.  Click the PS5 button on your controller to connect.";

let connectionAttemptInProgress = false

async function connectToController() {
    let activeController = null
    const open_controllers = controllerHandler.controllers.filter(controller => controller.device_ && controller.device_.opened);

    if (open_controllers.length > 0) {
        activeController = open_controllers[0]
        connectionStatus.textContent = "DualSense connected. You're ready to play!"

        connectionAttemptInProgress = false
        return activeController
    }

    connectionStatus.textContent = "No DualSense connected. Click the PS5 button on your controller to connect."

    if (connectionAttemptInProgress || controllerHandler.checkingForDevicesInProgress)
        return null
    

    connectionAttemptInProgress = true

    try {
        await controllerHandler.requestDevice()
        await controllerHandler.checkForGrantedDevices()
    } catch (error) {
        console.error("Controller connection failed:", error)
    } finally {
        connectionAttemptInProgress = false
    }

    return activeController
}
