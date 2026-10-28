
extends Node

var my_js_instance: JavaScriptObject

func _ready() -> void:

	if not OS.has_feature("web"):
		return

	var code := FileAccess.get_file_as_string("res://js/test.js")
	
	if code.is_empty():
		push_error("res://js/test.js was not exported")
		return

	JavaScriptBridge.eval(code, true)

	if JavaScriptBridge.get_interface("MyTestClass") == null:
		push_error("MyTestClass was not defined")
		return

	my_js_instance = JavaScriptBridge.create_object("MyTestClass")

	print(my_js_instance.testMethod())
