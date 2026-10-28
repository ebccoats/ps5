extends RefCounted
class_name Haptics

class Setting:
	var mode: int
	var params: Array
	var rumble: Array
	var js_object: JavaScriptObject

var bridge: DualSenseBridge
var modes := {}

var _sending := false
var _send_done: JavaScriptObject
var _send_failed: JavaScriptObject


func _init() -> void:
	var mode = ModeController.GameMode
	modes = {
		mode.ROCK_FEEDBACK: _default_setting(),
		mode.ECHOLOCATE_ROCK: _make(23, [0, 10], [255, 1, 2, 10, 1, 1, 0]),
		mode.ROCK_SLAM: _make(23, [200, 0], [0, 0, 0, 0, 0, 0, 0]),
		mode.BUG_FEEDBACK: _make(23, [0, 10], [255, 255, 1, 2, 1, 1, 0]),
		mode.ECHOLOCATE_BUG: _make(23, [0, 10], [255, 255, 1, 2, 1, 1, 0]),
		mode.BUG_MUNCH: _make(23, [0, 50], [255, 255, 1, 2, 1, 1, 0]),
		mode.ECHOLOCATE_AIR: _default_setting(),
		mode.AIR_GALLOP: _default_setting(),
		mode.DISABLED: _make(5, [0, 0], [0, 0, 0, 0, 0, 0, 0]),
	}


func setup() -> void:
	_send_done = JavaScriptBridge.create_callback(_clear_sending)
	_send_failed = JavaScriptBridge.create_callback(_fail_sending)


func switch_haptics_mode(setting: Setting, intensity: float) -> void:
	var controller = bridge.active_controller
	if _sending and intensity <= 0.99:
		return

	_sending = true
	if controller == null:
		push_error("Failed to update controller")
		_sending = false
		return

	var js_setting := _ensure_js(setting)
	controller.changeTriggerEffect("left", js_setting)
	controller.changeTriggerEffect("right", js_setting)
	var left := _scale_by_intensity(setting.rumble[0], intensity)
	var right := _scale_by_intensity(setting.rumble[1], intensity)
	controller.changeRumble(left, right)

	var promise = controller.sendOutputReport()
	if promise == null:
		push_error("Failed to update controller")
		_sending = false
		return
	promise.then(_send_done, _send_failed)


func _scale_by_intensity(value: int, intensity: float) -> int:
	return int(floor(float(value) * intensity + 0.5))


func _ensure_js(setting: Setting) -> JavaScriptObject:
	if setting.js_object != null:
		return setting.js_object
	var js_setting = JavaScriptBridge.create_object("Object")
	js_setting.mode = setting.mode
	var params = JavaScriptBridge.create_object("Array")
	for value in setting.params:
		params.push(value)
	js_setting.params = params
	var rumble = JavaScriptBridge.create_object("Array")
	for value in setting.rumble:
		rumble.push(value)
	js_setting.rumble = rumble
	setting.js_object = js_setting
	return js_setting


func _default_setting() -> Setting:
	return _make(23, [0, 0], [255, 255, 1, 2, 1, 1, 0])


func _make(mode: int, rumble: Array, params: Array) -> Setting:
	var setting := Setting.new()
	setting.mode = mode
	setting.rumble = rumble.duplicate()
	setting.params = params.duplicate()
	return setting


func _clear_sending(_args: Array) -> void:
	_sending = false


func _fail_sending(args: Array) -> void:
	push_error("Failed to update controller: %s" % str(args))
	_sending = false
