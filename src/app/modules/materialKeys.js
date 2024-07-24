const { getSetting, setSetting, getDataFromMain, invokeRenderer, DeviceManager, clientManager } = require('../misc.js');
const protocols = require('../../modules/materialKeysDevices/materialKeysDevices.js');
let popup;

class MaterialKeys {
    input;
    output;
    protocols;

    constructor(pUp) {
        popup = pUp;
        //this.deviceManager = new DeviceManager();
    }

    async init() {

        //Populate protocol selector
        const protocolElmnt = document.getElementById('mkProtocol');
        for (let protocol of protocols.protocols) {
            const opt = document.createElement("option");
            opt.value = protocol.name;
            opt.text = protocol.name;
            protocolElmnt.add(opt, null);
        }
        const protocol = await getSetting('MkProtocol');
        protocolElmnt.value = protocol;

        //Add event listener to protocol selector
        protocolElmnt.addEventListener('change', async function(e) {
            const protocol = e.target.value;
            setSetting('MkProtocol',protocol);
            invokeRenderer('updateMkProtocol', protocol);
        });

        document.getElementById('mkScanMidi').addEventListener('click', function() { invokeRenderer('scanMidi');});
        document.getElementById('mkScanOnStart').addEventListener('click', function(e) { setSetting('mkScanOnStart',e.target.checked);});
        document.getElementById('mkContinuousScan').addEventListener('click', function(e) { setSetting('mkContinuousScan',e.target.checked);});
        document.getElementById('mkMidiConnect').addEventListener('click', function(e) {invokeRenderer('connectMidi'); });
        document.getElementById('mkConnectionEvent').addEventListener('change', function(e) { setSetting('mkConnectionEvent',e.target.value);});
        
        document.getElementById('mkConnectionEvent').value = await getSetting('mkConnectionEvent');

        if (await getSetting('mkScanOnStart')) {
            document.getElementById("mkScanOnStart").checked = true;
            setTimeout(()=>{
                invokeRenderer('scanMidi');
            },500);
        }

        if (await getSetting('mkContinuousScan')) {
            document.getElementById("mkContinuousScan").checked = true;
            invokeRenderer('scanMidi');
        }

        if (await getSetting('mkConnectionEvent') == 'start') {
            invokeRenderer('connectMidi');
        }
    }

    setFoundryConnected(connected) {
        document.getElementById("MaterialKeys_Foundry").checked = connected;
        document.getElementById("MaterialKeys_Foundry2").checked = connected;
    }

    setDeviceConnected(connected) {
        document.getElementById("MaterialKeys_Device").checked = connected;
        document.getElementById("MaterialKeys_Device2").checked = connected;
    }

    async updateDevices(inputs, outputs) {
        const selectedDevice = {
            input: await getSetting('selectedMkInputDevice'),
            output: await getSetting('selectedMkOutputDevice')
        }

        let table = document.getElementById('mkTable');
        for (let i=table.rows.length-1; i>0; i--) 
           table.deleteRow(i);
        
        const len = inputs.length > outputs.length ? inputs.length : outputs.length;

        for (let i=0; i<len; i++) {
            let row = table.insertRow(i+1);
            let cell1 = row.insertCell(0);
            let cell2 = row.insertCell(1);
            const input = inputs[i];
            const output = outputs[i];
            if (input == undefined)     cell1.innerHTML = '';
            else                        cell1.innerHTML = await this.createDeviceTableEntry(input, selectedDevice, 'input');
            if (output == undefined)    cell2.innerHTML = '';
            else                        cell2.innerHTML = await this.createDeviceTableEntry(output, selectedDevice, 'output');
            

            //const output = outputs[i];
        }

        const clickableDevices = document.getElementsByName('mkDevice');
        let parent = this;
        for (let elmnt of clickableDevices) {
            elmnt.addEventListener('click', async (event)=> {
                const id = event.target.id;
                const idSplit = id.split('-');
                const type = idSplit[idSplit.length-1];
                let name = '';
                for (let i=0; i<idSplit.length-1; i++) {
                    if (i > 0) name += '-';
                    name += idSplit[i];
                }

                let status = '';
                const classList = event.target.classList.value;
                if (classList.includes('notConnected')) status = 'notConnected';
                else if (classList.includes('selectedDevice')) status = 'selectedDevice';

                if (status == 'notConnected') {
                    if (type == 'input') {
                        selectedDevice.input = name;
                    }
                    else if (type == 'output') {
                        selectedDevice.output = name;
                    }
                }
                else {
                    if (type == 'input') {
                        selectedDevice.input = "";
                    }
                    else if (type == 'output') {
                        selectedDevice.output = "";
                    }
                }

                await setSetting('selectedMkInputDevice',selectedDevice.input);
                await setSetting('selectedMkOutputDevice',selectedDevice.output);
                invokeRenderer('updateMkDevice');
                setTimeout(()=>parent.updateDevices(inputs, outputs),10);
            });
        }
    }

    async createDeviceTableEntry(device, selectedDevice, deviceType) {
        let status = '';
        if (deviceType == 'input' && selectedDevice.input == device) status = 'selectedDevice';
        else if (deviceType == 'output' && selectedDevice.output == device) status = 'selectedDevice';
        else status = 'notConnected'
        return  `<div class="mkDevice ${status}" id="${device}-${deviceType}" name="${status != '' ? 'mkDevice' : ''}">${device}</div>`;
    }
}

module.exports = { MaterialKeys };