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
                cell1.innerHTML = this.createTableDevice(input, allowedDevices, 'input');
                /*
                cell1.innerHTML = input; 
                let validDevices = allowedDevices.devices.filter(d => input.includes(d.id));
                if (validDevices.filter(d => input.includes(d.id)).length > 0) {
                    if (validDevices.find(d => d.id == this.input?.id)) cell1.style.color = 'green'
                    else cell1.style.color = 'orange'
                }  
                */
            }


            const output = outputs[i];
            console.log(i,input,output)
            //cell1.innerHTML = inputs[i] == undefined ? '' : inputs[i];
            //cell2.innerHTML = outputs[i] == undefined ? '' : outputs[i];
        }
    }

    async createTableDevice(device, allowedDevices, deviceType) {
        let html = '';
        const blockedDevices = await getSetting('blockedMkDevices');
        //console.log('client',client)
        let status = 'notConnected';
        let validDevices = allowedDevices.devices.filter(d => device.includes(d.id));
        if (validDevices.filter(d => device.includes(d.id)).length > 0) {
            if (validDevices.find(d => d.id == this.input?.id)) status = ''
            else status = 'validDevice'
        }  
        return  `<div class="mkDevice ${status}">${device}</div>`;
    }
}

module.exports = { MaterialKeys };