extends Node2D

var bridge: DualSenseBridge
var player: Player
var board: Board
var haptics: Haptics
var audio: StrudelAudio
var modes: ModeController
var view: CaveGraphics

var _echolocation_mode_by_object := {}
var _feedback_mode_by_object := {}


func _ready() -> void:
	if not OS.has_feature("web"):
		set_process(false)
		return

	bridge = DualSenseBridge.new()
	add_child(bridge)
	if not bridge.setup():
		set_process(false)
		return

	player = Player.new()
	board = Board.new(player)
	player.game_board = board

	haptics = Haptics.new()
	haptics.bridge = bridge
	haptics.setup()
	audio = StrudelAudio.new()
	modes = ModeController.new()
	modes.haptics = haptics
	modes.audio = audio
	player.modes = modes

	view = CaveGraphics.new()
	view.player = player
	view.board = board
	add_child(view)
	player.on_draw = view.redraw

	var cell = ModeController.GameObject
	var mode = ModeController.GameMode
	_echolocation_mode_by_object = {
		cell.ROCK: mode.ECHOLOCATE_ROCK,
		cell.BUG: mode.ECHOLOCATE_BUG,
		cell.AIR: mode.ECHOLOCATE_AIR,
	}
	_feedback_mode_by_object = {
		cell.ROCK: mode.ROCK_FEEDBACK,
		cell.BUG: mode.BUG_FEEDBACK,
		cell.AIR: mode.AIR_GALLOP,
	}


func _process(_delta: float) -> void:
	audio.tick()
	player.poll_freeze()

	if bridge.active_controller != null:
		_process_controller_input(bridge.active_controller)
	else:
		bridge.connect_if_needed()


func _process_controller_input(controller) -> void:
	var input = controller.input
	if input == null:
		return

	var location := player.get_location()
	if input.rightJoyStickHasTriggered():
		_update_echolocation(input, location)
	else:
		_apply_environment_feedback()

	if input.triggerDown():
		player.move(board)
		view.redraw()


func _update_echolocation(input, location: Vector2i) -> void:
	var pos = input.getRoundedPositionsOnRightJoyStick()
	var camera_x := float(location.x) + float(pos[0])
	var camera_y := float(location.y) + float(pos[1])
	var object: String = board.get_object_at(camera_x, camera_y)
	var distance := player.get_distance_from_object(camera_x, camera_y)
	modes.switch_mode(_echolocation_mode_by_object[object], distance)
	player.change_orientation(camera_x, camera_y)
	view.redraw()


func _apply_environment_feedback() -> void:
	var location := player.get_location()
	var object: String = board.get_object_at(location.x, location.y)
	modes.switch_mode(_feedback_mode_by_object[object])
