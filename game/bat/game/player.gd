extends RefCounted
class_name Player

var x := 2.0
var y := 2.0
var orientation := Vector2i(0, 1)
var velocity := 0.005
var game_board: Board
var is_frozen := false
var on_draw: Callable = Callable()
var modes: ModeController

var _unfreeze_at_msec := -1


func get_orientation() -> Vector2i:
	return orientation


func change_orientation(camera_x: float, camera_y: float) -> void:
	var dx := ceili(camera_x - get_x())
	var dy := ceili(camera_y - get_y())
	# Don't change orientation if it is 0; keep the last orientation.
	if not (dx == 0 and dy == 0):
		orientation = Vector2i(dx, dy)


func move(board: Board, speed: Variant = null) -> void:
	if is_frozen:
		return

	var step: float = velocity if speed == null else float(speed)
	x = maxf(x + step * orientation.x, 0.0)
	y = maxf(y + step * orientation.y, 0.0)

	if board.is_nearly_out_of_bounds(x, y):
		board.generate_more_board()

	var location := get_location()
	if board.get_object_at(location.x, location.y) == ModeController.GameObject.ROCK:
		bump_into_rock()
	else:
		var bug_location := get_location()
		if board.get_object_at(bug_location.x, bug_location.y) == ModeController.GameObject.BUG:
			eat_bug()

	_request_draw()


func freeze(time_ms: int) -> void:
	is_frozen = true
	_unfreeze_at_msec = Time.get_ticks_msec() + time_ms


func unfreeze() -> void:
	is_frozen = false
	_unfreeze_at_msec = -1


func poll_freeze() -> void:
	if is_frozen and _unfreeze_at_msec >= 0 and Time.get_ticks_msec() >= _unfreeze_at_msec:
		unfreeze()


func get_distance_from_object(at_x: float, at_y: float) -> float:
	return Vector2(x - at_x, y - at_y).length() - 0.5


func eat_bug() -> void:
	var location := get_location()
	game_board.change_object_at(location.x, location.y, ModeController.GameObject.AIR)
	modes.switch_mode(ModeController.GameMode.BUG_MUNCH)
	modes.pause_mode_switches(400)


func bump_into_rock() -> void:
	# The player shouldn't be able to enter this space.
	modes.switch_mode(ModeController.GameMode.ROCK_SLAM)
	modes.pause_mode_switches(400)
	move(game_board, -20.0 * velocity)


func get_location() -> Vector2i:
	return Vector2i(_js_round(x), _js_round(y))


func get_x() -> int:
	return get_location().x


func get_y() -> int:
	return get_location().y


func get_precise_location() -> Vector2:
	return Vector2(x, y)


func get_precise_x() -> float:
	return x


func get_precise_y() -> float:
	return y


func _request_draw() -> void:
	if on_draw.is_valid():
		on_draw.call()


func _js_round(value: float) -> int:
	return int(floor(value + 0.5))
