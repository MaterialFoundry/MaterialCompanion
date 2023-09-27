const settings = require('electron-settings');
const { app, ipcMain } = require('electron');
const easymidi = require('easymidi');
const mkDevices = require('./materialKeysDevices.json');

let win;
let midi;


ipcMain.handle('scanMidi', async (event) => {
    console.log('Scanning MIDI',midi);
    midi.searchMidi();
})

function initializeMidi(window) {
    win = window;
    midi = new Midi();
}

async function getAllowedMkDevices() {
    let devices = mkDevices;

    return {devices};
}

class Midi {
    constructor() {
        this.inputs = [];
        this.outputs = [];
    }

    searchMidi() {
        //Get the MIDI inputs and outputs
        let inputs = easymidi.getInputs();
        let outputs = easymidi.getOutputs();
    
        console.log('midi',inputs,outputs);

        win.webContents.send('asynchronous-message', {
            type: 'midiDevices',
            inputs,
            outputs
        });
    }
}


module.exports = { initializeMidi, midi, getAllowedMkDevices };