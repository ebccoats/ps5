extends Node
class_name DualSenseBridge

var active_controller = null

var _connecting := false
var _retry_at_msec := 0
var _connected_cb: JavaScriptObject
var _failed_cb: JavaScriptObject


func setup() -> bool:
	if not _eval_project_file("res://js/controller/dualsense.js", "\nwindow.GameControllerWebHandler = GameControllerWebHandler;\n"):
		return false
	if JavaScriptBridge.get_interface("GameControllerWebHandler") == null:
		push_error("GameControllerWebHandler was not defined")
		return false

	var window = JavaScriptBridge.get_interface("window")
	window.controllerHandler = JavaScriptBridge.create_object("GameControllerWebHandler")

	# Godot's shell already uses #status for the loading splash. Writing to that
	# node would erase it, so the connection text goes to a separate element.
	JavaScriptBridge.eval("""
if (!document.getElementById("controller-status")) {
	const status = document.createElement("p");
	status.id = "controller-status";
	status.style.cssText = "position:absolute;z-index:2;margin:8px;color:white;font:14px sans-serif;";
	document.body.prepend(status);
}
""", true)

	if not _eval_project_file("res://js/controller/dualsense-connection.js", "", true):
		return false
	if JavaScriptBridge.get_interface("connectToController") == null:
		push_error("connectToController was not defined")
		return false

	_init_strudel()
	_connected_cb = JavaScriptBridge.create_callback(_handle_connected)
	_failed_cb = JavaScriptBridge.create_callback(_handle_connect_failed)
	return true


func connect_if_needed() -> void:
	if active_controller != null or _connecting:
		return
	if Time.get_ticks_msec() < _retry_at_msec:
		return
	var window = JavaScriptBridge.get_interface("window")
	var promise = window.connectToController()
	if promise == null:
		_retry_at_msec = Time.get_ticks_msec() + 1000
		return
	_connecting = true
	promise.then(_connected_cb, _failed_cb)


func _init_strudel() -> void:
	if JavaScriptBridge.get_interface("initStrudel") == null:
		push_error("Strudel was not loaded")
		return
	JavaScriptBridge.eval("""
initStrudel({
	prebake: () => {
		samples("github:tidalcycles/dirt-samples");
	},
});
""", true)


func _eval_project_file(path: String, suffix: String = "", redirect_status: bool = false) -> bool:
	var code := FileAccess.get_file_as_string(path)
	if code.is_empty():
		push_error("%s was not exported" % path)
		return false
	if redirect_status:
		code = code.replace('getElementById("status")', 'getElementById("controller-status")')
	JavaScriptBridge.eval(code + suffix, true)
	return true


func _handle_connected(args: Array) -> void:
	_connecting = false
	var controller = args[0] if args.size() > 0 else null
	if controller != null:
		active_controller = controller
	else:
		_retry_at_msec = Time.get_ticks_msec() + 1000


func _handle_connect_failed(_args: Array) -> void:
	_connecting = false
	_retry_at_msec = Time.get_ticks_msec() + 1000
	push_error("Controller connection failed")
