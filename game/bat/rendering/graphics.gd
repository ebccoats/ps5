extends Node2D
class_name CaveGraphics

const CELL_SIZE := 80.0
const PLAYER_DIAMETER := 20.0
const ARROW_LENGTH := 22.0

const PLAYER_COLOR := Color("#772b38")
const AIR_COLOR := Color("#DECCB4")
const ROCK_COLOR := Color("#1B2504")
const BUG_COLOR := Color("#BAA04D")

var player: Player
var board: Board
var has_drawn := false


func redraw() -> void:
	has_drawn = true
	queue_redraw()


func _draw() -> void:
	if not has_drawn or player == null or board == null:
		return

	var precise := player.get_precise_location()
	var canvas_w := float(board.width)
	var canvas_h := float(board.height)
	var origin_x := canvas_w / 2.0 - precise.x * CELL_SIZE
	var origin_y := canvas_h / 2.0 - precise.y * CELL_SIZE
	_draw_board(origin_x, origin_y, canvas_w, canvas_h)
	_draw_player(origin_x, origin_y, precise)


func _draw_board(origin_x: float, origin_y: float, canvas_w: float, canvas_h: float) -> void:
	var min_x := floori(-origin_x / CELL_SIZE)
	var max_x := ceili((canvas_w - origin_x) / CELL_SIZE)
	var min_y := floori(-origin_y / CELL_SIZE)
	var max_y := ceili((canvas_h - origin_y) / CELL_SIZE)
	var cell = ModeController.GameObject

	for y in range(min_y, max_y + 1):
		for x in range(min_x, max_x + 1):
			var object: String = board.get_object_at(x, y)
			var color := AIR_COLOR
			if object == cell.ROCK:
				color = ROCK_COLOR
			elif object == cell.BUG:
				color = BUG_COLOR
			draw_rect(Rect2(
				origin_x + x * CELL_SIZE - CELL_SIZE / 2.0,
				origin_y + y * CELL_SIZE - CELL_SIZE / 2.0,
				CELL_SIZE + 1.0,
				CELL_SIZE + 1.0
			), color)


func _draw_player(origin_x: float, origin_y: float, precise: Vector2) -> void:
	var facing := player.get_orientation()
	var screen := Vector2(
		origin_x + precise.x * CELL_SIZE,
		origin_y + precise.y * CELL_SIZE
	)
	var angle := atan2(float(facing.y), float(facing.x))
	# p5 ellipse() takes a diameter. PLAYER_RADIUS in the original script is that diameter.
	draw_circle(screen, PLAYER_DIAMETER * 0.5, PLAYER_COLOR)

	var tip := Vector2(ARROW_LENGTH, 0.0).rotated(angle)
	var left := Vector2(ARROW_LENGTH - 8.0, -5.0).rotated(angle)
	var right := Vector2(ARROW_LENGTH - 8.0, 5.0).rotated(angle)
	draw_line(screen, screen + tip, PLAYER_COLOR, 3.0)
	draw_colored_polygon(PackedVector2Array([
		screen + tip,
		screen + left,
		screen + right,
	]), PLAYER_COLOR)
