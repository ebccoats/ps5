// @ts-nocheck
// add an instance of GameControllerWebHandler to your game script
// on the webpage you need a button that calls GameControllerWebHandler.requestDevice()
// after the user presses that button and gives permissions to access their DualSense controller, you can access them in GameControllerWebHandler.controllers


export interface GameControllerWebHandler {
    controllers: DualSenseHid[];
    requestDevice(): Promise<void>;
    checkForGrantedDevices(): Promise<void>;
}

export interface DualSenseInputReport {
    triggerDown(): boolean;
    rightJoyStickHasTriggered(): boolean;
    getRoundedPositionsOnRightJoyStick(): [number, number];
}

export interface DualSenseHid {
    device_: WebHIDDevice;
    input?: DualSenseInputReport;
    changeTriggerEffect(
        side: "left" | "right",
        setting: { mode: number; params: number[] }
    ): void;
    changeRumble(left: number, right: number): void;
    sendOutputReport(): Promise<boolean>;
}

export class GameControllerWebHandler {
    constructor() {
        this.controllers = []
        this.VENDOR_ID = Object.freeze({
            SONY: 0x054c,
            NINTENDO: 0x057E,
            MICROSOFT: 0x045E
        })

        this.PRODUCT_ID = Object.freeze({
            DUAL_SENSE: 0x0ce6
        })

        this.EXPECTED_REPORT_SIZE = Object.freeze({
            // Expected report sizes, not including the report ID byte.
            DUAL_SENSE_USB_0x01: 63,
            DUAL_SENSE_BT_0x01: 9,
            DUAL_SENSE_BT_0x31: 77,
        })

        this.USAGE_PAGE_GENERIC_DESKTOP = 0x0001;
        this.USAGE_ID_GD_GAME_PAD = 0x0005;
    }

    hex8 = value => { return ('00' + (value >>> 0).toString(16)).substr(-2); };
    hex16 = value => { return ('0000' + (value >>> 0).toString(16)).substr(-4); };
    hex32 = value => { return ('00000000' + (value >>> 0).toString(16)).substr(-8); };

    parseHex = value => {
        if (value == '')
            return 0;

        return parseInt(value, 16);
    };

    requestDevice = async () => {
        let requestOptions = {
            filters: [
                {
                    vendorId: this.VENDOR_ID.SONY, productId: this.PRODUCT_ID.DUAL_SENSE,
                    usagePage: this.USAGE_PAGE_GENERIC_DESKTOP, usage: this.USAGE_ID_GD_GAME_PAD
                },
            ]
        };

        let device;
        try {
            let devices = await navigator.hid.requestDevice(requestOptions);
            device = devices[0];
        } catch (e) { }

        if (!device)
            return;

        if (!device.opened) {
            await device.open();
            if (!device.opened) {
                console.log('Failed to open ' + device.productName);
                return;
            }
        }

        console.log('Opened DualSense');
        window.dshid = new DualSenseHid(device, this);
        window.dshid.initialize();
        this.controllers.push(window.dshid)
    }

    checkForGrantedDevices = async () => {
        this.checkingForDevicesInProgress = true

        if (window.dshid !== undefined && !window.dshid.device_.opened) {
            console.log('DualSense disconnected');
            window.dshid.onConnectionError();
        }

        if (window.dshid !== undefined)
            return;

        // console.log('Checking for a connected DualSense');
        // Check if we already have permissions for a DualSense device.
        const devices = await navigator.hid.getDevices();
        for (const device of devices) {
            if (device.vendorId == this.VENDOR_ID.SONY && device.productId == this.PRODUCT_ID.DUAL_SENSE) {
                if (!device.opened) {
                    await device.open();
                    if (!device.opened)
                        continue;
                }

                console.log('Opened DualSense');
                window.dshid = new DualSenseHid(device, this);
                window.dshid.initialize();

                this.controllers.push(window.dshid)
                return;
            }
        }
        console.log('Checked for a connected DualSense...No DualSense found');
        this.checkingForDevicesInProgress = false
    };

}

export class DualSenseInputReport {
    constructor(report, handler) {
        this.input = {}

        if (report.byteLength === handler.EXPECTED_REPORT_SIZE.DUAL_SENSE_USB_0x01) {
            return this.handle_usb01(report)
        } else if (report.byteLength === handler.EXPECTED_REPORT_SIZE.DUAL_SENSE_BT_0x01) {
            return this.handle_bluetooth01(report)
        } else if (report.byteLength === handler.EXPECTED_REPORT_SIZE.DUAL_SENSE_BT_0x31) {
            return this.handle_bluetooth31(report)
        }
    }

    // True if the joystick is not near neutral position
    triggerDown = () => {
        return (this.l2axis > 0.04 || this.r2axis > 0.04)
    };

    // True if the joystick is not near neutral position
    rightJoyStickHasTriggered = () => {
        let cutoff = 0.20
        return (this.rsx > cutoff || this.rsx < -cutoff || this.rsy > cutoff || this.rsy < -cutoff  )
    };

    getRoundedPositionsOnRightJoyStick = () => {
        return [Math.round(this.rsx), Math.round(this.rsy)]
    };

    // Normalize an 8-bit thumbstick axis to the range [-1, +1].
    normalizeThumbStickAxis = value => {
        return (2 * value / 0xFF) - 1.0;
    };

    // Normalize an 8-bit trigger axis to the range [0, +1].
    normalizeTriggerAxis = value => {
        return value / 0xFF;
    };


    // Normalize a digital button value to the range [0, +1].
    normalizeButton = value => {
        return value ? 1.0 : 0.0;
    };


    handle_usb01(report) {
        let axes0 = report.getUint8(0);
        let axes1 = report.getUint8(1);
        let axes2 = report.getUint8(2);
        let axes3 = report.getUint8(3);
        let axes4 = report.getUint8(4);
        let axes5 = report.getUint8(5);
        let seqNum = report.getUint8(6);
        let buttons0 = report.getUint8(7);
        let buttons1 = report.getUint8(8);
        let buttons2 = report.getUint8(9);
        let buttons3 = report.getUint8(10);
        let timestamp0 = report.getUint8(11);
        let timestamp1 = report.getUint8(12);
        let timestamp2 = report.getUint8(13);
        let timestamp3 = report.getUint8(14);
        let gyroX0 = report.getUint8(15);
        let gyroX1 = report.getUint8(16);
        let gyroY0 = report.getUint8(17);
        let gyroY1 = report.getUint8(18);
        let gyroZ0 = report.getUint8(19);
        let gyroZ1 = report.getUint8(20);
        let accelX0 = report.getUint8(21);
        let accelX1 = report.getUint8(22);
        let accelY0 = report.getUint8(23);
        let accelY1 = report.getUint8(24);
        let accelZ0 = report.getUint8(25);
        let accelZ1 = report.getUint8(26);
        let sensorTimestamp0 = report.getUint8(27);
        let sensorTimestamp1 = report.getUint8(28);
        let sensorTimestamp2 = report.getUint8(29);
        let sensorTimestamp3 = report.getUint8(30);
        // byte 31?
        let touch00 = report.getUint8(32);
        let touch01 = report.getUint8(33);
        let touch02 = report.getUint8(34);
        let touch03 = report.getUint8(35);
        let touch10 = report.getUint8(36);
        let touch11 = report.getUint8(37);
        let touch12 = report.getUint8(38);
        let touch13 = report.getUint8(39);
        // byte 40?
        this.r2feedback = report.getUint8(41);
        this.l2feedback = report.getUint8(42);
        // bytes 43-51?
        let battery0 = report.getUint8(52);
        let battery1 = report.getUint8(53);
        // bytes 54-58?
        // bytes 59-62 CRC32 checksum

        this.lsx = this.normalizeThumbStickAxis(axes0);
        this.lsy = this.normalizeThumbStickAxis(axes1);
        this.rsx = this.normalizeThumbStickAxis(axes2);
        this.rsy = this.normalizeThumbStickAxis(axes3);
        this.l2axis = this.normalizeTriggerAxis(axes4);
        this.r2axis = this.normalizeTriggerAxis(axes5);

        this.dpad = buttons0 & 0x0f;
        this.up = this.normalizeButton(this.dpad == 0 || this.dpad == 1 || this.dpad == 7);
        this.down = this.normalizeButton(this.dpad == 3 || this.dpad == 4 || this.dpad == 5);
        this.left = this.normalizeButton(this.dpad == 5 || this.dpad == 6 || this.dpad == 7);
        this.right = this.normalizeButton(this.dpad == 1 || this.dpad == 2 || this.dpad == 3);
        this.square = this.normalizeButton(buttons0 & 0x10);
        this.cross = this.normalizeButton(buttons0 & 0x20);
        this.circle = this.normalizeButton(buttons0 & 0x40);
        this.triangle = this.normalizeButton(buttons0 & 0x80);
        this.l1 = this.normalizeButton(buttons1 & 0x01);
        this.r1 = this.normalizeButton(buttons1 & 0x02);
        this.l2 = this.normalizeButton(buttons1 & 0x04);
        this.r2 = this.normalizeButton(buttons1 & 0x08);
        this.create = this.normalizeButton(buttons1 & 0x10);
        this.options = this.normalizeButton(buttons1 & 0x20);
        this.l3 = this.normalizeButton(buttons1 & 0x40);
        this.r3 = this.normalizeButton(buttons1 & 0x80);
        this.ps = this.normalizeButton(buttons2 & 0x01);
        this.touchpad = this.normalizeButton(buttons2 & 0x02);
        this.mute = this.normalizeButton(buttons2 & 0x04);

        this.touch0active = !(touch00 & 0x80);
        this.touch0id = (touch00 & 0x7F);
        this.touch0x = ((touch02 & 0x0F) << 8) | touch01;
        this.touch0y = (touch03 << 4) | ((touch02 & 0xF0) >> 4);
        this.touch1active = !(touch10 & 0x80);
        this.touch1id = (touch10 & 0x7F);
        this.touch1x = ((touch12 & 0x0F) << 8) | touch11;
        this.touch1y = (touch13 << 4) | ((touch12 & 0xF0) >> 4);

        // Clean up gyro info?
        this.gyrox = (gyroX1 << 8) | gyroX0;
        if (this.gyrox > 0x7FFF) this.gyrox -= 0x10000;
        this.gyroy = (gyroY1 << 8) | gyroY0;
        if (this.gyroy > 0x7FFF) this.gyroy -= 0x10000;
        this.gyroz = (gyroZ1 << 8) | gyroZ0;
        if (this.gyroz > 0x7FFF) this.gyroz -= 0x10000;
        this.accelx = (accelX1 << 8) | accelX0;
        if (this.accelx > 0x7FFF) this.accelx -= 0x10000;
        this.accely = (accelY1 << 8) | accelY0;
        if (this.accely > 0x7FFF) this.accely -= 0x10000;
        this.accelz = (accelZ1 << 8) | accelZ0;
        if (this.accelz > 0x7FFF) this.accelz -= 0x10000;

        this.batteryLevelPercent = (battery0 & 0x0f) * 100 / 8;
        this.batteryFull = !!(battery0 & 0x20);
        this.batteryCharging = !!(battery1 & 0x08);

        this.lsx = Number(this.lsx).toFixed(2);
        this.lsy = Number(this.lsy).toFixed(2);
        this.rsx = Number(this.rsx).toFixed(2);
        this.rsy = Number(this.rsy).toFixed(2);

        return this
    }

    handle_bluetooth01(report) {
        let axes0 = report.getUint8(0);
        let axes1 = report.getUint8(1);
        let axes2 = report.getUint8(2);
        let axes3 = report.getUint8(3);
        let buttons0 = report.getUint8(4);
        let buttons1 = report.getUint8(5);
        let buttons2 = report.getUint8(6);
        let axes4 = report.getUint8(7);
        let axes5 = report.getUint8(8);

        this.lsx = this.normalizeThumbStickAxis(axes0);
        this.lsy = this.normalizeThumbStickAxis(axes1);
        this.rsx = this.normalizeThumbStickAxis(axes2);
        this.rsy = this.normalizeThumbStickAxis(axes3);
        this.l2axis = this.normalizeTriggerAxis(axes4);
        this.r2axis = this.normalizeTriggerAxis(axes5);

        this.dpad = buttons0 & 0x0f;
        this.up = this.normalizeButton(this.dpad == 0 || this.dpad == 1 || this.dpad == 7);
        this.down = this.normalizeButton(this.dpad == 3 || this.dpad == 4 || this.dpad == 5);
        this.left = this.normalizeButton(this.dpad == 5 || this.dpad == 6 || this.dpad == 7);
        this.right = this.normalizeButton(this.dpad == 1 || this.dpad == 2 || this.dpad == 3);
        this.square = this.normalizeButton(buttons0 & 0x10);
        this.cross = this.normalizeButton(buttons0 & 0x20);
        this.circle = this.normalizeButton(buttons0 & 0x40);
        this.triangle = this.normalizeButton(buttons0 & 0x80);
        this.l1 = this.normalizeButton(buttons1 & 0x01);
        this.r1 = this.normalizeButton(buttons1 & 0x02);
        this.l2 = this.normalizeButton(buttons1 & 0x04);
        this.r2 = this.normalizeButton(buttons1 & 0x08);
        this.create = this.normalizeButton(buttons1 & 0x10);
        this.options = this.normalizeButton(buttons1 & 0x20);
        this.l3 = this.normalizeButton(buttons1 & 0x40);
        this.r3 = this.normalizeButton(buttons1 & 0x80);
        this.ps = this.normalizeButton(buttons2 & 0x01);
        this.touchpad = this.normalizeButton(buttons2 & 0x02);

        this.lsx = Number(this.lsx).toFixed(2);
        this.lsy = Number(this.lsy).toFixed(2);
        this.rsx = Number(this.rsx).toFixed(2);
        this.rsy = Number(this.rsy).toFixed(2);

        return this
    }

    handle_bluetooth31(report) {
        // byte 0?
        let axes0 = report.getUint8(1);
        let axes1 = report.getUint8(2);
        let axes2 = report.getUint8(3);
        let axes3 = report.getUint8(4);
        let axes4 = report.getUint8(5);
        let axes5 = report.getUint8(6);
        // byte 7?
        let buttons0 = report.getUint8(8);
        let buttons1 = report.getUint8(9);
        let buttons2 = report.getUint8(10);
        // byte 11?
        let timestamp0 = report.getUint8(12);
        let timestamp1 = report.getUint8(13);
        let timestamp2 = report.getUint8(14);
        let timestamp3 = report.getUint8(15);
        let gyroX0 = report.getUint8(16);
        let gyroX1 = report.getUint8(17);
        let gyroY0 = report.getUint8(18);
        let gyroY1 = report.getUint8(19);
        let gyroZ0 = report.getUint8(20);
        let gyroZ1 = report.getUint8(21);
        let accelX0 = report.getUint8(22);
        let accelX1 = report.getUint8(23);
        let accelY0 = report.getUint8(24);
        let accelY1 = report.getUint8(25);
        let accelZ0 = report.getUint8(26);
        let accelZ1 = report.getUint8(27);
        // bytes 28-32?
        let touch00 = report.getUint8(33);
        let touch01 = report.getUint8(34);
        let touch02 = report.getUint8(35);
        let touch03 = report.getUint8(36);
        let touch10 = report.getUint8(37);
        let touch11 = report.getUint8(38);
        let touch12 = report.getUint8(39);
        let touch13 = report.getUint8(40);
        // byte 41?
        this.r2feedback = report.getUint8(42);
        this.l2feedback = report.getUint8(43);
        // bytes 44-52?
        let battery0 = report.getUint8(53);
        let battery1 = report.getUint8(54);
        // bytes 55-76?

        this.lsx = this.normalizeThumbStickAxis(axes0);
        this.lsy = this.normalizeThumbStickAxis(axes1);
        this.rsx = this.normalizeThumbStickAxis(axes2);
        this.rsy = this.normalizeThumbStickAxis(axes3);
        this.l2axis = this.normalizeTriggerAxis(axes4);
        this.r2axis = this.normalizeTriggerAxis(axes5);

        this.dpad = buttons0 & 0x0f;
        this.up = this.normalizeButton(this.dpad == 0 || this.dpad == 1 || this.dpad == 7);
        this.down = this.normalizeButton(this.dpad == 3 || this.dpad == 4 || this.dpad == 5);
        this.left = this.normalizeButton(this.dpad == 5 || this.dpad == 6 || this.dpad == 7);
        this.right = this.normalizeButton(this.dpad == 1 || this.dpad == 2 || this.dpad == 3);
        this.square = this.normalizeButton(buttons0 & 0x10);
        this.cross = this.normalizeButton(buttons0 & 0x20);
        this.circle = this.normalizeButton(buttons0 & 0x40);
        this.triangle = this.normalizeButton(buttons0 & 0x80);
        this.l1 = this.normalizeButton(buttons1 & 0x01);
        this.r1 = this.normalizeButton(buttons1 & 0x02);
        this.l2 = this.normalizeButton(buttons1 & 0x04);
        this.r2 = this.normalizeButton(buttons1 & 0x08);
        this.create = this.normalizeButton(buttons1 & 0x10);
        this.options = this.normalizeButton(buttons1 & 0x20);
        this.l3 = this.normalizeButton(buttons1 & 0x40);
        this.r3 = this.normalizeButton(buttons1 & 0x80);
        this.ps = this.normalizeButton(buttons2 & 0x01);
        this.touchpad = this.normalizeButton(buttons2 & 0x02);
        this.mute = this.normalizeButton(buttons2 & 0x04);

        this.touch0active = !(touch00 & 0x80);
        this.touch0id = (touch00 & 0x7F);
        this.touch0x = ((touch02 & 0x0F) << 8) | touch01;
        this.touch0y = (touch03 << 4) | ((touch02 & 0xF0) >> 4);
        this.touch1active = !(touch10 & 0x80);
        this.touch1id = (touch10 & 0x7F);
        this.touch1x = ((touch12 & 0x0F) << 8) | touch11;
        this.touch1y = (touch13 << 4) | ((touch12 & 0xF0) >> 4);

        this.gyrox = (gyroX1 << 8) | gyroX0;
        if (this.gyrox > 0x7FFF) this.gyrox -= 0x10000;
        this.gyroy = (gyroY1 << 8) | gyroY0;
        if (this.gyroy > 0x7FFF) this.gyroy -= 0x10000;
        this.gyroz = (gyroZ1 << 8) | gyroZ0;
        if (this.gyroz > 0x7FFF) this.gyroz -= 0x10000;
        this.accelx = (accelX1 << 8) | accelX0;
        if (this.accelx > 0x7FFF) this.accelx -= 0x10000;
        this.accely = (accelY1 << 8) | accelY0;
        if (this.accely > 0x7FFF) this.accely -= 0x10000;
        this.accelz = (accelZ1 << 8) | accelZ0;
        if (this.accelz > 0x7FFF) this.accelz -= 0x10000;

        this.batteryLevelPercent = (battery0 & 0x0f) * 100 / 8;
        this.batteryFull = !!(battery0 & 0x20);
        this.batteryCharging = !!(battery1 & 0x08);

        return this
    }


}


export class DualSenseHid {
    constructor(hidDevice, handler) {
        this.device_ = hidDevice;
        this.h = handler; // game controller handler helper class
        this.connectionType_ = null;

        // UI controls that affect the output report.
        this.checkboxPlayerLeds_ = 0x00;
        this.sliderLightbarRed_ = 0xFF;
        this.sliderLightbarGreen_ = 0xFF;
        this.sliderLightbarBlue_ = 0xFF;

        // Output report state.
        this.outputSeq_ = 1;
        this.playerLeds_ = 0x00;
        this.playerLedBrightness_ = 0x00;
        this.lightbarBrightness_ = 0xFF;
        this.muteLed_ = 0x00;
        this.motorLeft_ = 0x00;
        this.motorRight_ = 0x00;
        this.headphoneVolume_ = 0x00;
        this.speakerVolume_ = 0x00;
        this.micVolume_ = 0x00;
        this.audioControl_ = 0x00;
        this.powerSave_ = 0x00;
        this.rumbleReduction_ = 0x00;
        this.triggerSoftness_ = 0x00;
        this.speakerPreamp_ = 0x00;
        this.lightbarSetup_ = 0x00;
        this.releaseLeds_ = false;
        this.speakerTone_ = false;
        this.audioSeq_ = 0;
        this.audioCounter_ = 0;
        this.l2EffectMode_ = 0x26;
        this.l2EffectParam1_ = 0x90;
        this.l2EffectParam2_ = 0xA0;
        this.l2EffectParam3_ = 0xFF;
        this.l2EffectParam4_ = 0x00;
        this.l2EffectParam5_ = 0x00;
        this.l2EffectParam6_ = 0x00;
        this.l2EffectParam7_ = 0x00;
        this.l2EffectParam8_ = 0x00;
        this.l2EffectParam9_ = 0x00;
        this.l2EffectParam10_ = 0x00;
        this.r2EffectMode_ = 0x26;
        this.r2EffectParam1_ = 0x90;
        this.r2EffectParam2_ = 0xA0;
        this.r2EffectParam3_ = 0xFF;
        this.r2EffectParam4_ = 0x00;
        this.r2EffectParam5_ = 0x00;
        this.r2EffectParam6_ = 0x00;
        this.r2EffectParam7_ = 0x00;
        this.r2EffectParam8_ = 0x00;
        this.r2EffectParam9_ = 0x00;
        this.r2EffectParam10_ = 0x00;
        this.lightbarRed_ = 0xFF;
        this.lightbarGreen_ = 0xFF;
        this.lightbarBlue_ = 0xFF;

        this.inputReport = {}
        // WebHID API doesn't indicate whether we are connected through the controller's
        // USB or Bluetooth interface. The protocol is different depending on the connection
        // type so we will try to detect it based on the collection information.
        this.connectionType_ = 'unknown';
        for (const c of this.device_.collections) {
            if (c.usagePage != this.h.USAGE_PAGE_GENERIC_DESKTOP || c.usage != this.h.USAGE_ID_GD_GAME_PAD)
                continue;

            // Compute the maximum input report byte length and compare against known values.
            let maxInputReportBytes = c.inputReports.reduce((max, report) => {
                return Math.max(max, report.items.reduce((sum, item) => { return sum + item.reportSize * item.reportCount; }, 0));
            }, 0);
            if (maxInputReportBytes == 504)
                this.connectionType_ = 'usb';
            else if (maxInputReportBytes == 616)
                this.connectionType_ = 'bluetooth';
        }
    }


    initialize() {
        this.device_.oninputreport = e => { this.onInputReport(e); }
        this.readFeatureReport05().catch(() => {});
    }

    hex8 = value => { return ('00' + (value >>> 0).toString(16)).substr(-2); };
    hex16 = value => { return ('0000' + (value >>> 0).toString(16)).substr(-4); };
    hex32 = value => { return ('00000000' + (value >>> 0).toString(16)).substr(-8); };

    parseHex = value => {
        if (value == '')
            return 0;

        return parseInt(value, 16);
    };

    async readFeatureReport05() {
        // By default, bluetooth-connected DualSense only sends input report 0x01 which omits motion and touchpad data.
        // Reading feature report 0x05 causes it to start sending input report 0x31.
        //
        // Note: The Gamepad API will do this for us if it enumerates the gamepad.
        // Other applications like Steam may have also done this already.
        if (this.connectionType_ == 'bluetooth')
            await this.device_.receiveFeatureReport(0x05);
    }


    changePlayerLEDs = playerNumber => {
        this.playerLeds_ = (playerNumber === 1 ? 0x01 : 0x00)
            | (playerNumber === 2 ? 0x02 : 0x00)
            | (playerNumber === 3 ? 0x04 : 0x00)
            | (playerNumber === 4 ? 0x08 : 0x00)
            | (playerNumber === 5 ? 0x10 : 0x00);
    };

    // 0 high, 1 medium, 2 low. One level for every lit player LED.
    changePlayerLedBrightness = brightness => {
        this.playerLedBrightness_ = brightness < 0 ? 0 : (brightness > 2 ? 2 : brightness);
    };

    // 0-255. The lightbar has no brightness byte, so this scales the RGB.
    changeLightbarBrightness = brightness => {
        this.lightbarBrightness_ = brightness & 0xff;
    };

    mute = muted => {
        this.muteLed_ = muted > 1 ? 0x02 : (muted ? 0x01 : 0x00);
    };

    changeRumble = (left, right) => {
        this.motorLeft_ = left & 0xff;
        this.motorRight_ = right & 0xff;
    };

    changeAudio = (headphone, speaker, mic, path) => {
        this.headphoneVolume_ = headphone & 0x7f;
        this.speakerVolume_ = speaker & 0xff;
        this.micVolume_ = mic > 0x40 ? 0x40 : (mic & 0xff);
        this.audioControl_ = path & 0xff;
    };

    changeOutputTuning = (rumbleReduction, triggerSoftness, speakerPreamp) => {
        this.rumbleReduction_ = rumbleReduction & 0x0f;
        this.triggerSoftness_ = triggerSoftness & 0x0f;
        this.speakerPreamp_ = speakerPreamp & 0x07;
    };

    changePowerSave = flags => {
        this.powerSave_ = flags & ~0x10;
    };

    changeLightbarSetup = setup => {
        this.lightbarSetup_ = setup & 0x03;
    };

    releaseLeds = release => {
        this.releaseLeds_ = !!release;
    };

    changeLightbarColor = (red, green, blue) => {
        this.sliderLightbarRed_ = red;
        this.sliderLightbarGreen_ = green;
        this.sliderLightbarBlue_ = blue;
        this.lightbarRed_ = red;
        this.lightbarGreen_ = green;
        this.lightbarBlue_ = blue;
    }

    // wants the trigger parameters packaged up into the "setting" object
    // "setting" object has mode, param[p1, p2, p3, p4, p5, p6, p7]
    // setting can accept hex values 0-ff or decimal from 0-255 


    changeTriggerEffect = (side, setting) => {
        if (side === "left") {
            this.l2EffectMode_ = setting.mode
            this.l2EffectParam1_ = setting.params[0] 
            this.l2EffectParam2_ = setting.params[1]
            this.l2EffectParam3_ = setting.params[2]
            this.l2EffectParam4_ = setting.params[3]
            this.l2EffectParam5_ = setting.params[4]
            this.l2EffectParam6_ = setting.params[5]
            this.l2EffectParam7_ = setting.params[6]
            // this.l2EffectParam8_ = setting.params[7]
            // this.l2EffectParam9_ = setting.params[8]
            // this.l2EffectParam10_ = setting.params[9]
        } else if (side === "right") {
            this.r2EffectMode_ = setting.mode
            this.r2EffectParam1_ = setting.params[0] 
            this.r2EffectParam2_ = setting.params[1]
            this.r2EffectParam3_ = setting.params[2]
            this.r2EffectParam4_ = setting.params[3]
            this.r2EffectParam5_ = setting.params[4]
            this.r2EffectParam6_ = setting.params[5]
            this.r2EffectParam7_ = setting.params[6]
            // this.r2EffectParam8_ = setting.params[7]
            // this.r2EffectParam9_ = setting.params[8]
            // this.r2EffectParam10_ = setting.params[9]
        }

    }

    onConnectionError() {
        console.log("connection error")
        delete window.dshid;
    }

    onInputReport(event) {
        let reportId = event.reportId;
        let report = event.data;
        let reportString = this.hex8(reportId);
        for (let i = 0; i < report.byteLength; ++i)
            reportString += ' ' + this.hex8(report.getUint8(i));

        this.inputReportHex = reportString;
        this.input = new DualSenseInputReport(report, this.h)
    }

    async sendOutputReport() {
        let reportId;
        let reportData;
        let common;
        let r2Effect;
        let l2Effect;
        if (this.connectionType_ == 'bluetooth') {
            reportId = 0x31;
            reportData = new Uint8Array(77);

            // seq_tag
            reportData[0] = (this.outputSeq_ << 4);
            if (++this.outputSeq_ == 16)
                this.outputSeq_ = 0;

            // tag
            reportData[1] = 0x10; // DS_OUTPUT_TAG

            common = new DataView(reportData.buffer, 2, 47);
            r2Effect = new DataView(common.buffer, 12, 11);
            l2Effect = new DataView(common.buffer, 23, 11);
        } else if (this.connectionType_ == 'usb') {
            reportId = 0x02;
            reportData = new Uint8Array(47);

            common = new DataView(reportData.buffer, 0, 47);
            r2Effect = new DataView(common.buffer, 10, 11);
            l2Effect = new DataView(common.buffer, 21, 11);
        }

        // valid_flag0
        // bit 0: COMPATIBLE_VIBRATION
        // bit 1: HAPTICS_SELECT
        // Those two pull the actuators out of audio mode, so a speaker tone leaves them clear.
        common.setUint8(0, this.speakerTone_ ? 0xf0 : 0xff);

        // valid_flag1
        // bit 0: MIC_MUTE_LED_CONTROL_ENABLE
        // bit 1: POWER_SAVE_CONTROL_ENABLE
        // bit 2: LIGHTBAR_CONTROL_ENABLE
        // bit 4: PLAYER_INDICATOR_CONTROL_ENABLE
        // bit 3 is left clear unless release LEDs is set; setting it turns the LEDs off
        // bit 7: audio control 2 (speaker preamp)
        common.setUint8(1, 0xd7 | (this.releaseLeds_ ? 0x08 : 0));

        // DualShock 4 compatibility mode.
        common.setUint8(2, this.motorRight_);
        common.setUint8(3, this.motorLeft_);

        // headphone 0-127, speaker 0-255, microphone 0-64, audio path
        common.setUint8(4, this.headphoneVolume_);
        common.setUint8(5, this.speakerVolume_);
        common.setUint8(6, this.micVolume_);
        common.setUint8(7, this.audioControl_);

        // mute_button_led
        // 0: mute LED off
        // 1: mute LED on
        common.setUint8(8, this.muteLed_);

        // power_save_control
        // bit 4: POWER_SAVE_CONTROL_MIC_MUTE, owned by the mute LED
        common.setUint8(9, (this.muteLed_ ? 0x00 : 0x10) | this.powerSave_);

        // Right trigger effect
        // Mode
        // 0x00: off
        // 0x01: mode1
        // 0x02: mode2
        // 0x05: mode1 + mode4
        // 0x06: mode2 + mode4
        // 0x21: mode1 + mode20
        // 0x25: mode1 + mode4 + mode20
        // 0x26: mode2 + mode4 + mode20
        // 0xFC: calibration
        r2Effect.setUint8(0, this.r2EffectMode_);

        // Effect parameter 1
        // start of resistance section
        r2Effect.setUint8(1, this.r2EffectParam1_);

        // Effect parameter 2
        // mode1: amount of force exerted
        // mode2: end of resistance section
        // mode4 + mode20: flags
        //   bit 2: do not pause effect when fully pressed
        r2Effect.setUint8(2, this.r2EffectParam2_);

        // Effect parameter 3
        // mode2: force exerted
        r2Effect.setUint8(3, this.r2EffectParam3_);

        // Effect effect parameter 4
        // mode4 + mode20: strength near release state
        r2Effect.setUint8(4, this.r2EffectParam4_);

        // Effect parameter 5
        // mode4 + mode20: strength near middle
        r2Effect.setUint8(5, this.r2EffectParam5_);

        // Effect parameter 6
        // mode4 + mode20: at pressed state
        r2Effect.setUint8(6, this.r2EffectParam6_);

        // Effect parameter 7
        // mode4 + mode20: effect actuation frequency in Hz
        r2Effect.setUint8(7, this.r2EffectParam7_);
        r2Effect.setUint8(8, this.r2EffectParam8_);
        r2Effect.setUint8(9, this.r2EffectParam9_);
        r2Effect.setUint8(10, this.r2EffectParam10_);

        // Left trigger effect
        // Mode
        // 0x00: off
        // 0x01: mode1
        // 0x02: mode2
        // 0x05: mode1 + mode4
        // 0x06: mode2 + mode4
        // 0x21: mode1 + mode20
        // 0x25: mode1 + mode4 + mode20
        // 0x26: mode2 + mode4 + mode20
        // 0xFC: calibration
        l2Effect.setUint8(0, this.l2EffectMode_);

        // Effect parameter 1
        // start of resistance section
        l2Effect.setUint8(1, this.l2EffectParam1_);

        // Effect parameter 2
        // mode1: amount of force exerted
        // mode2: end of resistance section
        // mode4 + mode20: flags
        //   bit 2: do not pause effect when fully pressed
        l2Effect.setUint8(2, this.l2EffectParam2_);

        // Effect parameter 3
        // mode2: force exerted
        l2Effect.setUint8(3, this.l2EffectParam3_);

        // Effect effect parameter 4
        // mode4 + mode20: strength near release state
        l2Effect.setUint8(4, this.l2EffectParam4_);

        // Effect parameter 5
        // mode4 + mode20: strength near middle
        l2Effect.setUint8(5, this.l2EffectParam5_);

        // Effect parameter 6
        // mode4 + mode20: at pressed state
        l2Effect.setUint8(6, this.l2EffectParam6_);

        // Effect parameter 7
        // mode4 + mode20: effect actuation frequency in Hz
        l2Effect.setUint8(7, this.l2EffectParam7_);
        l2Effect.setUint8(8, this.l2EffectParam8_);
        l2Effect.setUint8(9, this.l2EffectParam9_);
        l2Effect.setUint8(10, this.l2EffectParam10_);

        // high nibble: trigger softness, low nibble: rumble reduction
        common.setUint8(36, ((this.triggerSoftness_ & 0x0f) << 4) | (this.rumbleReduction_ & 0x0f));
        // speaker preamp gain
        common.setUint8(37, this.speakerPreamp_ & 0x07);

        // Bluetooth plays a lightbar animation at connect and ignores color and
        // player LED writes until one report tells it to stop that animation.
        const bluetoothLightbarSetup = this.connectionType_ == 'bluetooth' && !this.lightbarSetupSent_;
        if (bluetoothLightbarSetup) {
            common.setUint8(38, 0x02);
            common.setUint8(41, 0x02);
        } else {
            // valid_flag2 at byte 38
            // bit 0: player LED brightness control
            // bit 1: lightbar setup control
            common.setUint8(38, 0x03);
            common.setUint8(41, this.lightbarSetup_);
            // player LED brightness: 0 high, 1 medium, 2 low
            common.setUint8(42, this.playerLedBrightness_);
            common.setUint8(43, this.playerLeds_);
            common.setUint8(44, (this.lightbarRed_ * this.lightbarBrightness_ / 255) | 0);
            common.setUint8(45, (this.lightbarGreen_ * this.lightbarBrightness_ / 255) | 0);
            common.setUint8(46, (this.lightbarBlue_ * this.lightbarBrightness_ / 255) | 0);
        }

        // fill CRC32
        if (this.connectionType_ == 'bluetooth') {
            this.fillDualSenseChecksum(reportId, reportData);
        }

        // Update UI
        let reportString = `${this.hex8(reportId)} `;
        for (const byte of reportData)
            reportString += `${this.hex8(byte)} `;
        this.outputReportHex = reportString;

        // Send output report
        try {
            await this.device_.sendReport(reportId, reportData);
        } catch (error) {
            console.log('Failed to write DualSense output report');
            return false;
        }

        if (bluetoothLightbarSetup)
            this.lightbarSetupSent_ = true;

        return true;
    }

    // Bluetooth speaker/jack audio. Report 0x36 carries one Opus frame.
    // WebHID's buffer omits the report id, so this is 397 bytes.
    speakerState_ = new Uint8Array([
        0xfd, 0xe3, 0x00, 0x00,
        0x7f, 0x64,
        0x00, 0x09, 0x00, 0x10, 0x00, 0x00, 0x00, 0x00,
        0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00,
        0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00,
        0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x0a,
        0x04, 0x00, 0x00, 0x00, 0x01,
        0x00,
        0x00, 0x00, 0xff,
        0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00,
        0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00,
    ]);

    sendSpeakerFrame = async (opusFrame, headset) => {
        if (this.connectionType_ != 'bluetooth')
            return false;
        const reportData = new Uint8Array(397);
        reportData[0] = (this.audioSeq_ & 0x0f) << 4;
        this.audioSeq_ = (this.audioSeq_ + 1) & 0x0f;
        reportData[1] = 0x91;
        reportData[2] = 0x07;
        reportData[3] = 0xfe;
        reportData[4] = 32;
        reportData[5] = 32;
        reportData[6] = 32;
        reportData[7] = 32;
        reportData[8] = 32;
        reportData[9] = this.audioCounter_ & 0xff;
        this.audioCounter_ = (this.audioCounter_ + 1) & 0xff;
        reportData[10] = 0x90;
        reportData[11] = 63;
        reportData.set(this.speakerState_, 12);
        reportData[16] = this.headphoneVolume_;
        reportData[17] = this.speakerVolume_;
        reportData[18] = this.micVolume_;
        reportData[19] = this.audioControl_;
        reportData[49] = this.speakerPreamp_ & 0x07;
        reportData[75] = 0x92;
        reportData[76] = 64;
        const jack = headset || this.audioControl_ === 0x02;
        const lane = jack ? 0x16 : (this.audioControl_ === 0x22 ? 0x15 : 0x13);
        reportData[141] = lane | 0x80;
        reportData[142] = 200;
        reportData.set(opusFrame.subarray(0, 200), 143);
        this.fillDualSenseChecksum(0x36, reportData);
        try {
            await this.device_.sendReport(0x36, reportData);
        } catch (error) {
            this.speakerError_ = error && error.message ? error.message : "speaker write failed";
            console.log(this.speakerError_);
            return false;
        }
        this.speakerError_ = "";
        return true;
    }

    // Generate CRC32 lookup table.
    makeCRCTable = () => {
        let c;
        const crcTable = [];
        for (let n = 0; n < 256; ++n) {
            c = n;
            for (let k = 0; k < 8; ++k)
                c = ((c & 1) ? (0xEDB88320 ^ (c >>> 1)) : (c >>> 1));
            crcTable[n] = (c >>> 0);
        }
        return crcTable;
    };

    // Compute CRC32 for `prefixBytes` concatenated with `dataView`.
    crc32 = (prefixBytes, dataView) => {
        if (window.crcTable === undefined)
            window.crcTable = this.makeCRCTable();
        let crc = (-1 >>> 0);
        for (const byte of prefixBytes)
            crc = (crc >>> 8) ^ window.crcTable[(crc ^ byte) & 0xFF];
        for (let i = 0; i < dataView.byteLength; ++i)
            crc = (crc >>> 8) ^ window.crcTable[(crc ^ dataView.getUint8(i)) & 0xFF];
        return (crc ^ (-1)) >>> 0;
    };

    // Given a DualSense Bluetooth output report with `reportId` and `reportData`,
    // compute the CRC32 checksum and write it to the last four bytes of `reportData`.
    fillDualSenseChecksum = (reportId, reportData) => {
        const crc = this.crc32([0xa2, reportId], new DataView(reportData.buffer, 0, reportData.byteLength - 4));
        reportData[reportData.byteLength - 4] = (crc >>> 0) & 0xff;
        reportData[reportData.byteLength - 3] = (crc >>> 8) & 0xff;
        reportData[reportData.byteLength - 2] = (crc >>> 16) & 0xff;
        reportData[reportData.byteLength - 1] = (crc >>> 24) & 0xff;
    };



}
