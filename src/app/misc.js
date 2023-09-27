const { ipcRenderer } = require('electron');

async function getSetting(setting) {
    const value = await ipcRenderer.invoke('getSetting',setting);
    console.log('getSetting',setting,value)
    return value;
}

async function setSetting(setting, value) {
    console.log('setSetting',setting,value)
    await ipcRenderer.invoke('setSetting', setting, value);
}

async function getDataFromMain(id) {
    const value = await ipcRenderer.invoke('getData',id);
    console.log('getSetting',id,value)
    return value;
}

class PopUp {
    popupOpen = false;
    details = "";
    constructor() {
        let parent = this;
        
        document.getElementById(`closePopup`).addEventListener("click", () => {
            parent.close();
        })
        document.getElementById("popup").addEventListener("pointerdown", (event) => {
            if (event.target == document.getElementById("popup")) 
                parent.close();
        })

        document.getElementById("detailsHeader").addEventListener("click",(event) => {
            let thisElement = event.target;
            if (event.target.className == "expandableIcon") thisElement = event.target.parentElement;
            let nextElement = thisElement.nextElementSibling;
            const collapse = nextElement.className == "section" ? true : false;
            nextElement.className = collapse ? "section collapsed" : "section";
            thisElement.children[0].src = collapse ? "images/arrow-right.png" : "images/arrow-down.png";
        })
    }

    error(msg, dispDetails=false) {
        this.open(msg, true, dispDetails);
    }

    open(msg, dispError=false, dispDetails=false) {
        if (dispError) document.getElementById("popupError").style.display="";
        else document.getElementById("popupError").style.display="none";
        if (dispDetails) document.getElementById("popupDetails").style.display="";
        else {
            document.getElementById("popupDetails").style.display="none";
            this.clearDetails();
        }
        if (this.popupOpen = false) {
            this.clearDetails();
        }

        document.getElementById("popupContent").innerHTML = msg;
        document.getElementById("popup").style.display = "block";

        this.popupOpen = true;
    }

    content(msg) {
        document.getElementById("popupContent").innerHTML = msg;
    }

    close() {
        document.getElementById("popup").style.display = "none";
        this.popupOpen = false;
    }

    addDetails(msg) {
        this.details += msg;
        document.getElementById("popupDetailsContent").value = this.details;
    }

    clearDetails() {
        this.details = "";
        document.getElementById("popupDetailsContent").value = this.details;
    }
}

/*
function errorPopup(msg) {
    document.getElementById("errorPopupContent").innerHTML = msg;
    openPopup("errorPopup");
}
*/

function openPopup(id) {
    document.getElementById(id).style.display = "block";
    document.getElementById(`close${id}`).addEventListener("click", (event) => {
        closePopup(id);
    })
    window.onclick = function(event) {
        if (event.target == document.getElementById(id)) {
            closePopup(id);
        }
    }
}

function closePopup(id) {
    document.getElementById(id).style.display = "none";
}

class DeviceManager {
    constructor() {
        this.devices = [];
    }

    addDevice(device) {
        if (this.devices.find(d => d.id == device.id)) {
            console.log('device already exists');
            return;
        }
        else this.devices.push(device);
        return this.devices;
    }

    updateDevices(devices) {
        this.devices = devices;
    }

    removeDevice(device) {
        this.devices = this.devices.filter(d => d.id != device.id);
        return this.devices;
    }

    removeAllDevices() {
        this.devices = [];
        return this.devices;
    }

    getDevices() {
        return this.devices;
    }
}

class ClientManager {
    constructor() {
        this.clients = [];
    }

    getClient(userId) {
        return this.clients.find(c => c.userId == userId);
    }

    getClients() {
        return this.clients;
    }

    async addClient(userId, userName) {
        let clientData = await getSetting('clientData');
        if (clientData == undefined) clientData = [];

        let data = {
            userId,
            userName,
            materialDeck: {blockedDevices: []},
            materialKeys: {},
            materialPlane: {}
        }

        let existingClient = this.clients.find(c => c.userId == userId);
        let savedClient = clientData.find(c => c.userId == userId);
        if (savedClient == undefined) {
            console.log(`Saving new client: ${userName} (${userId})`)
            clientData.push(data);
            setSetting('clientData',clientData);
        }
        else {
            data = savedClient;
        }
        this.clients.push(data)
        
        if (existingClient == undefined) {
            console.log(`Adding new client: ${userName} (${userId})`)
        }
        return this.clients;
    }

    removeClient(userId, userName) {
        this.clients = this.clients.filter(c => c.userId != userId);
        return this.clients;
    }
}

let clientManager = new ClientManager();

module.exports = { getSetting, setSetting, getDataFromMain, DeviceManager, clientManager, PopUp, openPopup, closePopup }