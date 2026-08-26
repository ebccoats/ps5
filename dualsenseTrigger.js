// This is the stuff I added:

const radioButtons = document.getElementsByName('triggerMode')

function setTriggerMode(label) {
    let newTrigger = returnSettings(label)

    window.dshid.setTriggerEffectParams(newTrigger.mode, newTrigger.params)
    console.log(newTrigger)
}

export function pageSetup() {
    for (let radio of radioButtons) {
        radio.addEventListener('click', (e) => {
            let label = e.srcElement.defaultValue
            setTriggerMode(label)
        })
    }

}

class TriggerSettings {
    label = "none"
    mask = 0x00
    mode = 0x00
    params            
    constructor(label, mask, mode) {
        this.label = label
        this.mask = mask
        this.mode = mode
        this.params = new TriggerParams()
    }

    set(params) {
        this.params = params
    }

}

class TriggerParams {
    p1 = 0x00
    p2 = 0x00
    p3 = 0x00
    p4 = 0x00
    p5 = 0x00
    p6 = 0x00
    p7 = 0x00
}

    
function returnSettings(label) {
    let settings 
    let params = new TriggerParams()

    console.log(label)
    switch(label) {
        case "linear": // continuous resistance
            settings = new TriggerSettings("linear", 0x00, 0x21)
            params = new TriggerParams()

            params.p1 = 0x01 // start position
            params.p2 = 0xFF // force/strength

            settings.set(params)

            console.log("linear")
            return settings

            break
        case "nonlinear": // weapon with trigger at 255
            settings = new TriggerSettings("nonlinear", 0x00, 0x25)
            params = new TriggerParams()

            params.p1 = 0x01 // start position
            params.p2 = 0xFF // end position (trigger tripped)
            params.p3 = 0xFF // max force (severity of slope)


            settings.set(params)

            return settings

            break

        case "threshold": // trigger
            settings = new TriggerSettings("threshold", 0x00, 0x21)
            params = new TriggerParams()

            params.p1 = 0x80 // start position
            params.p2 = 0xA0 // end position (trigger tripped)
            params.p3 = 0x90 // max force

            settings.set(params)

            return settings

            break
        case "bowThreshold":
            settings = new TriggerSettings("bowThreshold", 0x00, 0x22)
            params = new TriggerParams()

            params.p1 = 0x20 // start position
            params.p2 = 0xA0 // end position (trigger tripped)
            params.p3 = 0x90 // max force
            params.p4 = 0xDF // snap force (right at release threshold, JUST before the end) 

            settings.set(params)

            return settings

            break
        case "vibration":
            settings = new TriggerSettings("vibration", 0x00, 0x26)
            params = new TriggerParams()

            params.p1 = 0x01 // start position
            params.p2 = 0xFF // amplitude (intnsity/strength)
            params.p3 = 0xFF // frequency (pulses per second)


            settings.set(params)

            return settings


            break
        case "sineRhythm":
            settings = new TriggerSettings("sineRhythm", 0x00, 0x23)
            params = new TriggerParams()

            params.p1 = 0x20 // start position
            params.p2 = 0xA0 // end position 
            params.p3 = 0x90 // primary force strength
            params.p4 = 0xDF // secondary force strength
            params.p5 = 0xDF // frequency (overall cycle speed)
            params.p6 = 0xDF // period (timing intervals between the alternating strengths/amplitudes)

            settings.set(params)

            return settings

            break
        case "squareRhythm":
            settings = new TriggerSettings("squareRhythm", 0x00, 0x27)
            params = new TriggerParams()

            params.p1 = 0x10 // start position
            params.p2 = 0xFF // end position 
            params.p3 = 0x30 // primary force strength
            params.p4 = 0x90 // secondary force strength
            params.p5 = 0x3F // frequency (overall cycle speed)
            params.p6 = 0xDF // period (timing intervals between the alternating strengths/amplitudes)

            settings.set(params)

            return settings

            break
        case "none":
            settings = new TriggerSettings("none", 0x00, 0x00)
            params = new TriggerParams()

            settings.set(params)

            return settings

            break
    }
}

