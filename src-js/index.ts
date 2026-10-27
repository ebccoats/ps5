import { Board } from "./game/board.js";
import { Player } from "./game/player.js";
import { initializeGraphics } from "./rendering/graphics.js";

import { connectToController } from "./controller/dualsense-connection.js";

import { createGameEvents } from "./game/events.js";

// ---------------------------------------------------------------------------------
// Initialize connection to PS5 controller.
// ---------------------------------------------------------------------------------
const controller = await connectToController();

// ---------------------------------------------------------------------------------
// Initialize a new player and board.
// ---------------------------------------------------------------------------------
const player = new Player(createGameEvents(controller));
const board = new Board(player);
initializeGraphics(board, player);

// ---------------------------------------------------------------------------------
// Game loop: The player can echolocate, turn, and move around the board.
// ---------------------------------------------------------------------------------
function gameLoop() {
    window.requestAnimationFrame(gameLoop);

    player.echolocate(board);

    if (!controller.input) return;

    // If player is changing orientation, turn them.
    if (controller.input.rightJoyStickHasTriggered()) {
        player.changeOrientation(...controller.input.getRoundedPositionsOnRightJoyStick());
    }

    // If player is holding the trigger, move them.
    if (controller.input.triggerDown()) {
        player.move(board);
    }
}

window.requestAnimationFrame(gameLoop);
