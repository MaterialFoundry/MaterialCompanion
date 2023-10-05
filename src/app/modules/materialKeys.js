const { getSetting, setSetting, getDataFromMain, DeviceManager, clientManager } = require('../misc.js');

class MaterialKeys {
    constructor() {
        this.deviceManager = new DeviceManager();
        this.input;
        this.output;
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
        const allowedDevices = await getDataFromMain('allowedMkDevices');
        console.log('updating midi devices',inputs, outputs, allowedDevices)

        let table = document.getElementById('mkTable');
        for (let i=table.rows.length-1; i>0; i--) 
            table.deleteRow(i);
        
        const len = inputs.length > outputs.length ? inputs.length : outputs.length;

        for (let i=0; i<len; i++) {
            let row = table.insertRow(i+1);
            let cell1 = row.insertCell(0);
            let cell2 = row.insertCell(1);
            const input = inputs[i];
            if (input == undefined) cell1.innerHTML = '';
            else {
                cell1.innerHTML = await this.createTableDevice(input, allowedDevices, 'input');
                cell2.innerHTML = await this.createTableDevice(input, allowedDevices, 'output');
            }

            const output = outputs[i];
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
                let blockedDevices = await getSetting('blockedMkDevices');
                if (blockedDevices.find(d => d.name == name && d.type == type)) {
                    blockedDevices = blockedDevices.filter(d => d.name != name || d.type != type);
                }
                else {
                    blockedDevices.push({name, type});
                }
                setSetting('blockedMkDevices',blockedDevices)
                setTimeout(()=>parent.updateDevices(inputs, outputs),10);
            });
        }
    }

    async createTableDevice(device, allowedDevices, deviceType) {
        const blockedDevices = await getSetting('blockedMkDevices');
        let status = '';
        if (blockedDevices.find(d => d.name == device && d.type == deviceType)) status = 'blocked';
        else {
            let validDevices = allowedDevices.devices.filter(d => device.includes(d.id));
            if (validDevices.filter(d => device.includes(d.id)).length > 0) {
                if (validDevices.find(d => d.id == this.input?.id)) status = 'connected'
                else status = 'validDevice'
            } 
        }
        return  `<div class="mkDevice ${status}" id="${device}-${deviceType}" name="${status != '' ? 'mkDevice' : ''}">${device}</div>`;
    }
}

module.exports = { MaterialKeys };