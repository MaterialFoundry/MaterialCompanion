class LaunchpadMk2 {
    sysExHeader = [0x00, 0x20, 0x29, 0x02, 0x18];
    midi;

    constructor() {};

    onOpen(midi) {
        this.midi = midi;

        //set to programming mode
        this.midi.sendSysEx([0x22, 0x00]);
        this.clearAllLEDs();
    }

    onClose() {

    }

    onNoteOn(data) {
        return {
            button: data.note,
            state: data.velocity == 127 ? 1 : 0
        }
    }

    onCC(data) {
        return {
            button: data.controller-13,
            state: data.value == 127 ? 1 : 0
        }
    }

    getColorData(button, mode='off', color=0, color2=0) {
        if (mode == 'off') return [0x0A, button, 0x00];
        else if (mode == 'static') return [0x0A, button, color];
        else if (mode == 'flashing') return [0x0A, button, color, 0x23, button, color2];
        else if (mode == 'pulsing') return [0x028, button, color];
        else if (mode == 'rgb') { 
            var result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(color);
            return [0x0B, button, parseInt(result[1], 16)/4, parseInt(result[2], 16)/4, parseInt(result[3], 16)/4];
        }
    }

    setLED(button, mode='off', color=0, color2=0) { 
        this.midi.sendSysEx([...this.getColorData(button, mode, color, color2)])
    }

    setAllLEDs(mode='off', color=0, color2=0) {
        let sysEx = [];

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

module.exports = { LaunchpadMk2 };