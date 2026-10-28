extends RefCounted
class_name StrudelAudio

class Pattern:
	var notes = null
	var sound := "sawtooth"
	var chord = null
	var gain := 1.0

var modes := {}
var audio_playing := false
var _stop_at_msec := -1


func _init() -> void:
	var mode = ModeController.GameMode
	modes = {
		mode.ROCK_FEEDBACK: _pattern(),
		mode.BUG_FEEDBACK: _pattern(),
		mode.AIR_GALLOP: _pattern(),
		mode.ECHOLOCATE_ROCK: _pattern(),
		mode.ROCK_SLAM: _pattern("0", "lt"),
		mode.ECHOLOCATE_BUG: _pattern("<0 0 ->*16", "insect"),
		mode.BUG_MUNCH: _pattern("<0 1 2 3 4 5 6 5 4 3 4 5 6>*30", "sawtooth", "C"),
		mode.ECHOLOCATE_AIR: _pattern(),
		mode.DISABLED: _pattern(),
	}


func tick() -> void:
	if _stop_at_msec >= 0 and Time.get_ticks_msec() >= _stop_at_msec:
		turn_off_audio()


func switch_audio_mode(pattern: Pattern, intensity: float) -> void:
	var should_play: bool = pattern.notes != null and (not audio_playing or intensity > 0.99)
	if not should_play:
		return
	_create_playback(pattern, intensity)
	_reset_timeout()


func turn_off_audio() -> void:
	_clear_timeout()
	var window = JavaScriptBridge.get_interface("window")
	window.hush()
	audio_playing = false


func _create_playback(pattern: Pattern, intensity: float) -> void:
	var window = JavaScriptBridge.get_interface("window")
	window.playStrudel(pattern.notes, pattern.sound, pattern.gain * intensity, pattern.chord)
	audio_playing = true


func _clear_timeout() -> void:
	_stop_at_msec = -1


func _reset_timeout() -> void:
	_clear_timeout()
	_stop_at_msec = Time.get_ticks_msec() + 500


func _pattern(notes = null, sound: String = "sawtooth", chord = null, gain: float = 1.0) -> Pattern:
	var pattern := Pattern.new()
	pattern.notes = notes
	pattern.sound = sound
	pattern.chord = chord
	pattern.gain = gain
	return pattern
