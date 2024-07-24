class LaunchpadProMk3 {
    sysExHeader = [0x00, 0x20, 0x29, 0x02, 0x0E];
    midi;

    constructor() {};

    onOpen(midi) {
        this.midi = midi;

        //set to programming mode
        this.midi.sendSysEx([0x0E, 0x01]);
        this.clearAllLEDs();
    }

    onClose() {
        //leave programming mode
        this.midi.sendSysEx([0x0E, 0x00]);
    }

    onNoteOn(data) {
        return {
            button: data.note,
            state: data.velocity == 127 ? 1 : 0
        }
    }

    onCC(data) {
        return {
            button: data.controller,
            state: data.value == 127 ? 1 : 0
        }
    }

    getColorData(button, mode='off', color=0, color2=0) {
        if (mode == 'off') return [0x00, button, 0x00];
        else if (mode == 'static') return [0x00, button, color];
        else if (mode == 'flashing') return [0x01, button, color, color2];
        else if (mode == 'pulsing') return [0x02, button, color];
        else if (mode == 'rgb') { 
            var result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(color);
            return [0x03, button, parseInt(result[1], 16)/2, parseInt(result[2], 16)/2, parseInt(result[3], 16)/2];
        }
    }

    setLED(button, mode='off', color=0, color2=0) {
        this.midi.sendSysEx([0x03, ...this.getColorData(button, mode, color, color2)])
    }

    setAllLEDs(mode='off', color=0, color2=0) {
        let sysEx = [0x03];

        if (mode == 'array') {
            for (let element of color) {
                sysEx.push(...this.getColorData(element.button, element.mode, element.color))
            }
        }
        else {
            for (let i=11; i<100; i++) {
                if (i % 10 == 0) continue;
                sysEx.push(...this.getColorData(i, mode, color, color2))
            }
        }

        this.midi.sendSysEx(sysEx);
    }

    clearAllLEDs() {
        this.setAllLEDs('off');
    }
}

module.exports = { LaunchpadProMk3 };