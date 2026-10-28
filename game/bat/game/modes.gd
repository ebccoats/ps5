extends RefCounted
class_name ModeController

class GameObject:
	const ROCK := "rock"
	const BUG := "bug"
	const AIR := "air"

class GameMode:
	const ROCK_FEEDBACK := "rock_feedback"
	const ECHOLOCATE_ROCK := "echolocate_rock"
	const ROCK_SLAM := "rock_slam"
	const BUG_FEEDBACK := "bug_feedback"
	const ECHOLOCATE_BUG := "echolocate_bug"
	const BUG_MUNCH := "bug_munch"
	const ECHOLOCATE_AIR := "echolocate_air"
	const AIR_GALLOP := "air_gallop"
	const DISABLED := "disabled"

var haptics
var audio

var switching_paused := false
var _resume_at_msec := 0


func calculate_intensity(distance: float) -> float:
	var decay := 1.0
	var intensity := 2.0 / ((decay * distance + sqrt(2.0)) ** 2.0)
	return clampf(intensity, 0.0, 1.0)


func pause_mode_switches(time_ms: int) -> void:
	switching_paused = true
	_resume_at_msec = Time.get_ticks_msec() + time_ms


func switch_mode(mode: String, distance: float = 0.0) -> void:
	if _pause_blocks():
		return

	var intensity := calculate_intensity(distance)
	print("In haptics/audio mode %s" % mode)

	haptics.switch_haptics_mode(haptics.modes[mode], intensity)
	audio.switch_audio_mode(audio.modes[mode], intensity)


func _pause_blocks() -> bool:
	if switching_paused and Time.get_ticks_msec() >= _resume_at_msec:
		switching_paused = false
	return switching_paused
