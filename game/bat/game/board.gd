extends RefCounted
class_name Board

var width := 400
var height := 400
var player
var brd: Array = []
var rock_occs := 0.2
var bug_occs := 0.1
var air_occs := 0.7


func _init(player_ref = null) -> void:
	player = player_ref
	var cell = ModeController.GameObject
	brd = [
		[cell.ROCK, cell.AIR, cell.ROCK, cell.AIR, cell.AIR],
		[cell.ROCK, cell.AIR, cell.AIR, cell.AIR, cell.AIR],
		[cell.ROCK, cell.ROCK, cell.AIR, cell.BUG, cell.AIR],
		[cell.ROCK, cell.AIR, cell.BUG, cell.BUG, cell.AIR],
		[cell.ROCK, cell.AIR, cell.BUG, cell.BUG, cell.AIR],
	]


func get_size() -> int:
	return brd.size()


func get_x_max() -> int:
	return brd[0].size() - 1


func get_y_max() -> int:
	return brd.size() - 1


func is_out_of_bounds(x: float, y: float) -> bool:
	return y < 0.0 or y >= brd.size() or x < 0.0 or x >= brd[0].size()


# True if the player is within 2 units of the y length or x length.
func is_nearly_out_of_bounds(x: float, y: float) -> bool:
	return y >= brd.size() - 2 or x >= brd[0].size() - 2


func generate_more_board() -> void:
	var target_height: int = brd.size() + 10
	var target_width: int = (brd[0] as Array).size() + 10

	for row in brd:
		while row.size() < target_width:
			row.append(_generate_tile())

	while brd.size() < target_height:
		var row: Array = []
		while row.size() < target_width:
			row.append(_generate_tile())
		brd.append(row)


func get_object_at(x: float, y: float) -> String:
	if is_out_of_bounds(x, y):
		return ModeController.GameObject.ROCK
	return brd[int(y)][int(x)]


func change_object_at(x: int, y: int, new_obj: String) -> void:
	if is_out_of_bounds(x, y):
		push_error("The game board is not big enough to change an object at %s %s" % [x, y])
		return
	brd[y][x] = new_obj


func render() -> void:
	pass


func _generate_tile() -> String:
	var roll := randf()
	var cell = ModeController.GameObject
	if roll < rock_occs:
		return cell.ROCK
	if roll < rock_occs + bug_occs:
		return cell.BUG
	return cell.AIR
