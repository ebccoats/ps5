import { GameControllerWebHandler } from "./dualsense.js";
import type { DualSenseHid } from "./dualsense.js";

// -----------------------------------------------------------------
// Controller connection
// -----------------------------------------------------------------
const connectionStatus = (() => {
    const element = document.getElementById("status");
    if (!element) throw new Error("Controller status element is missing from the page");
    return element;
})();
const connectButton = (() => {
    const element = document.getElementById("connect");
    if (!element) throw new Error("Controller connect button is missing from the page");
    return element;
})();
export const controllerHandler = new GameControllerWebHandler();
let resolvePendingConnection: ((controller: DualSenseHid) => void) | undefined;
const pendingConnection = new Promise<DualSenseHid>(resolve => {
    resolvePendingConnection = resolve;
});

function getActiveController(): DualSenseHid | undefined {
    return controllerHandler.controllers.find(controller => controller.device_.opened);
}

function controllerConnected(): DualSenseHid | undefined {
    const activeController = getActiveController();

    if (activeController) {
        connectionStatus.textContent = "DualSense connected. You're ready to play!";
        resolvePendingConnection?.(activeController);
        resolvePendingConnection = undefined;
    }

    return activeController;
}

connectButton.addEventListener("click", async () => {
    try {
        await controllerHandler.requestDevice();
        controllerConnected();
    } catch (error) {
        console.error("Controller connection failed:", error);
    }
});

export async function connectToController(): Promise<DualSenseHid> {
    const activeController = controllerConnected();
    if (activeController) return activeController;

    try {
        await controllerHandler.checkForGrantedDevices();
    } catch (error) {
        console.error("Controller connection failed:", error);
    }

    return controllerConnected() ?? pendingConnection;
}
