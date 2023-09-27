const { getSetting, setSetting, DeviceManager, clientManager } = require('../misc.js');

class MaterialDeck {
    constructor() {
        this.deviceManager = new DeviceManager();
    }

    setFoundryConnected(connected) {
        document.getElementById("MaterialDeck_Foundry").checked = connected;
        document.getElementById("MaterialDeck_Foundry2").checked = connected;
        document.getElementById("mdClientsWrapper").style.display = connected ? "" : "none";
    }

    setDeviceConnected(connected) {
        document.getElementById("MaterialDeck_Device").checked = connected;
        document.getElementById("MaterialDeck_Device2").checked = connected;
        document.getElementById("mdDevicesWrapper").style.display = connected ? "" : "none";
    }

    getClients() {
        return clientManager.getClients();
    }

    addDevice(device) {
        this.updateDevices(this.deviceManager.addDevice(device));
        this.setDeviceConnected(true);
    }

    removeDevice(device) {
        this.updateDevices(this.deviceManager.removeDevice(device));
        if (this.deviceManager.getDevices().length == 0) this.setDeviceConnected(false);
    }

    removeAllDevices() {
        this.updateDevices(this.deviceManager.removeAllDevices());
        this.setDeviceConnected(false);
    }
    
    updateDevices(devices) {
        this.deviceManager.updateDevices(devices);
    
        let table = document.getElementById('materialDeckDeviceTable');
        for (let i=table.rows.length-1; i>0; i--) 
            table.deleteRow(i);
    
        if (devices != undefined && devices.length > 0) {
            let i = 1;
            for (let device of devices) {
                let deviceType;
                switch (device.type) {
                    case 0: deviceType = 'Stream Deck'; break;
                    case 1: deviceType = 'Stream Deck Mini'; break;
                    case 2: deviceType = 'Stream Deck XL'; break;
                    case 3: deviceType = 'Stream Deck Mobile'; break;
                    case 4: deviceType = 'Corsair G Keys'; break;
                }
                let row = table.insertRow(i);
                let cell1 = row.insertCell(0);
                let cell2 = row.insertCell(1);
                cell1.innerHTML = device.name;
                cell2.innerHTML = deviceType;
                i++;
            }
        }
        
        this.updateClientTable(clientManager.getClients());
        this.setDeviceConnected(true);
    }

    async addClient(userId, userName) {
        this.updateClientTable(await clientManager.addClient(userId, userName));
        this.setFoundryConnected(true);
    }

    async removeClient(userId, userName) {
        this.updateClientTable(await clientManager.removeClient(userId, userName));
        if (clientManager.getClients().length == 0) this.setFoundryConnected(false);
    }

    updateClientTable(clients) {
        let table = document.getElementById('materialDeckClientsTable');
        for (let i=table.rows.length-1; i>0; i--) 
            table.deleteRow(i);
    
        if (clients == undefined || clients.length == 0) return;
        let i = 1;
        for (let client of clients) {
            let row = table.insertRow(i);
            let cell1 = row.insertCell(0);
            let cell2 = row.insertCell(1);
            cell1.innerHTML = client.userName;
            cell2.innerHTML = this.createClientTableDevice(client);
            i++;
        }
    }

    createClientTableDevice(client) {
        let html = '';
        const devices = this.deviceManager.getDevices();
        if (devices == undefined || devices.length == 0) {
            return `<div class="mdDevice notConnected">${i18n.localize("MD.SD_NOT_CONNECTED.LABEL")}</div>`;
        }
        for (let device of devices) {
            const blocked = client.materialDeck.blockedDevices.indexOf(device.id) > -1 ? 'blocked' : '';
            html += `<div class="mdDevice ${blocked}" name="mdDevice" id="mdDevice_${client.userId}_${device.id}">${device.name}</div>`;
            let parent = this;
            setTimeout(() => {
                document.getElementById(`mdDevice_${client.userId}_${device.id}`).addEventListener('click', function(event) {parent.deviceClicked(event,parent)});
            },100)
        }
        return html;
    }

    async deviceClicked(event, parent) {
        const targetIdArray = event.target.id.split('_');
        const userId = targetIdArray[1];
        const deviceId = targetIdArray[2]

        let client = clientManager.getClient(userId);
        let blockedDevices = client.materialDeck.blockedDevices;
        const index = blockedDevices.indexOf(deviceId);
        if (index < 0) blockedDevices.push(deviceId);
        else blockedDevices.splice(index, 1);
        parent.updateClientTable(clientManager.getClients());

        let clientData = await getSetting('clientData');
        if (clientData == undefined) clientData = [];
        clientData.find(c => c.userId == userId).materialDeck.blockedDevices = blockedDevices;
        setSetting('clientData',clientData);
    }
}

module.exports = { MaterialDeck };