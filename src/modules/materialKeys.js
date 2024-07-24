const settings = require('electron-settings');
const { app, ipcMain } = require('electron');
const easymidi = require('easymidi');
const protocols = require('./materialKeysDevices/materialKeysDevices.js').protocols;

let win;
let midi;

function sendToRenderer(type,data,options) {
    win.webContents.send('asynchronous-message', {type,data,options});
}

ipcMain.handle('scanMidi', async (event) => {
    midi.searchMidi();
});

ipcMain.handle('connectMidi', (event, input, output) => {
    if (!midi.connected)
        midi.connect(input,output);
    else    
        midi.disconnect();
});

ipcMain.handle('updateMkProtocol', (event, protocol) => {
    midi.setProtocol(protocol);
});

ipcMain.handle('updateMkDevice', (event) => {
    if (midi.connected) midi.disconnect();
    midi.connect();
});

function initializeMidi(window) {
    win = window;
    midi = new Midi();
}

class Midi {
    connected = false;
    inputs = [];
    outputs = [];
    protocol = {};
    device = {
        input: undefined,
        output: undefined
    }

    constructor() {
        app.midi = this;
        this.init();
    }

    async init() {
        this.setProtocol(await settings.get('MkProtocol'));


        //Periodically check for changes in MIDI devices
        let parent = this;
        setInterval(async function() {
            if (! await settings.get('mkContinuousScan')) return;
            parent.searchMidi({update:true});
        }, 2000);
    }

    setProtocol(protocol) {
        if (protocol == undefined || protocol == '') return;
        //this.protocol = protocol;
        

        const connected = this.connected;
        if (connected) this.disconnect();
    
        for (let p of protocols) {
            //console.log(JSON.stringify({p:protocols[i],name:protocols[i].name, p2:protocol}));
            if (p.name == protocol);
            this.protocol = p.protocol;
            break;
        }
        
        if (connected) this.connect();
    }

    async searchMidi(options) {
        //Get the MIDI inputs and outputs
        let inputs = easymidi.getInputs();
        let outputs = easymidi.getOutputs();

        //If an update is requested, check for changes in MIDI devices. If there are no changes, return.
        if (options?.update) {
            let midiChanged = false;
            const inputLen = inputs.length > this.inputs.length ? inputs.length : this.inputs.length;
            for (let i=0; i<inputLen; i++) {
                if (inputs[i] != this.inputs[i]) {
                    midiChanged = true;
                    break;
                }   
            }

            if (!midiChanged) {
                const outputLen = outputs.length > this.outputs.length ? outputs.length : this.outputs.length;
                for (let i=0; i<outputLen; i++) {
                    if (outputs[i] != this.outputs[i]) {
                        midiChanged = true;
                        break;
                    }   
                }
            }

            if (!midiChanged) return;
        }

        this.inputs = inputs;
        this.outputs = outputs;
        
        //Transmit devices to app
        win.webContents.send('asynchronous-message', {
            type: 'midiDevices',
            inputs,
            outputs
        });

        const connectionEvent = await settings.get('mkConnectionEvent');
        if (!this.connected) {
            const mkConnection = app.connections.find(c => c.source == 'MaterialKeys_Foundry');
            if (connectionEvent == 'start' || (connectionEvent == 'module' && mkConnection != undefined && mkConnection.connected))
            this.connect();
        }
    }

    async connect(input, output) {
        if (input == undefined) input = await settings.get('selectedMkInputDevice');
        if (output == undefined) output = await settings.get('selectedMkOutputDevice');
        if (input == undefined && output == undefined) {
            console.log('No MIDI device selected');
            sendToRenderer('errorPopup', "MK.NO_DEVICE_SELECTED");
            return;
        }
        
        console.log(`Connecting MIDI device:\nInput: ${input}\nOutput: ${output}`)

        try {
            this.device.input = new easymidi.Input(input);
        } catch (err) {
            //if (err.message.includes("Internal RtMidi error")) sendToRenderer('errorPopup', "MK.CONNECTION_ERROR", {details:`Is MIDI device already connected?\n${err.message}`});
            //else sendToRenderer('errorPopup', "MK.CONNECTION_ERROR", {details:err.message});
            return;
        }
        
        try {
            this.device.output = new easymidi.Output(output);
        } catch (err) {
            //sendToRenderer('errorPopup', "MK.CONNECTION_ERROR", {details:err});
            return;
        }
        
        this.connected = true;

        console.log("MIDI connected");
        sendToRenderer('materialKeys_deviceConnected');

        const data = {
            target: 'MaterialKeys_Foundry',
            source: 'MaterialCompanion',
            type: 'deviceConnected'
        }
        app.wss.broadcast(data, data.target, data.source);

        this.protocol.onOpen(this);

        let parent = this;
        this.device.input.on('noteon', function (msg) {parent.onMidiIn(msg)});
        this.device.input.on('cc', function (msg) {parent.onMidiIn(msg)});
    }

    async disconnect() {
        console.log('Disconnecting MIDI device');
        if (this.protocol?.onClose)
            this.protocol.onClose();

        if (this.device.input != undefined)
            this.device.input.close();
        if (this.device.output != undefined)
            this.device.output.close();
        this.connected = false;
        sendToRenderer('materialKeys_deviceDisconnected');

        const data = {
            target: 'MaterialKeys_Foundry',
            source: 'MaterialCompanion',
            type: 'deviceDisconnected'
        }
        app.wss.broadcast(data, data.target, data.source);
    }

    sendSysEx(data) {
        if (!this.connected) return;
        let msg = [0xF0];
        const header = this.protocol.sysExHeader;
        msg.push(...this.protocol.sysExHeader, ...data, 0xF7);
        this.device.output.send('sysex',msg);
    }

    sendMidi(data) {

    }

    onMidiIn(data) {
        let buttonData;
        if (data._type == 'noteon') buttonData = this.protocol.onNoteOn(data);
        else if (data._type == 'cc') buttonData = this.protocol.onCC(data);

        const msg = {
            target: 'MaterialKeys_Foundry',
            type: 'key',
            button: buttonData.button,
            state: buttonData.state
        }
        app.wss.broadcast(msg,'MaterialKeys_Foundry','MaterialKeys_Device');
        
    }

    onWsData(data) {
        if (data.event == 'updateAllLEDs') this.protocol.setAllLEDs('array', data.payload);
    }
}

module.exports = { initializeMidi, midi };