const { Localization } = require("./localization.js");
const { ipcRenderer } = require('electron');
const { MaterialDeck } = require('./modules/materialDeck.js');
const { MaterialKeys } = require('./modules/materialKeys.js');
const { MaterialPlane } = require('./modules/materialPlane.js');
const { SerPort } = require("./modules/serialPort.js");
const { PopUp } = require("./misc.js")

let popup = new PopUp();

var ip = require('ip');
var materialDeck = new MaterialDeck(popup);
var materialKeys = new MaterialKeys(popup);
var materialPlane = new MaterialPlane(popup);
var sensorPort = new SerPort('Sensor',popup);
var dockPort = new SerPort('Dock',popup);

const startLogo = {
    enable: true,
    static: 2000,
    fadeout: 500
}

window.i18n = new Localization();

ipcRenderer.on('asynchronous-message', async function (evt, message) {
    console.log('received from main: ',message); // Returns: {'SAVED': 'File Saved'}

    if (message.type == 'refreshWindow') {
        await sensorPort.closeSerialPort();
        await dockPort.closeSerialPort();
    }
    else if (message.type == 'serverConfig') {
        if (message.data.source == 'MaterialDeck_Foundry') {
            if (message.data.type == 'connected') materialDeck.addClient(message.data.userId, message.data.userName);
            else if (message.data.type == 'disconnected') materialDeck.removeClient(message.data.userId, message.data.userName);
        } 
        if (message.data.source == 'MaterialDeck_Device') {
            if (message.data.type == 'connected') materialDeck.updateDevices(message.data.devices);
            if (message.data.type == 'disconnected') materialDeck.removeAllDevices();
            
        } 
    }
    else if (message.type == 'materialDeck_deviceConnected') materialDeck.addDevice(message.data.device);
    else if (message.type == 'materialDeck_deviceDisconnected') materialDeck.removeDevice(message.data.device);
    else if (message.type == 'midiDevices') materialKeys.updateDevices(message.inputs, message.outputs);
});

document.addEventListener("DOMContentLoaded", async function(){
    console.log("window loaded")

    if (startLogo.enable) {
        const stepLength = 10;  //ms
        const stepSize = stepLength/startLogo.fadeout;
        setTimeout(() => {
            setTimeout(() => {
                let logoOpacity = 1;
                let logoFadeTimer = setInterval(function () {
                    if (logoOpacity <= stepSize) {
                        clearInterval(logoFadeTimer);
                        document.getElementById("logoOverlay").style.display = 'none';
                    }
                    document.getElementById("logoOverlay").style.opacity = logoOpacity;
                    logoOpacity -= stepSize;
                }, stepLength);
            }, stepLength);
        }, startLogo.static)
    }
    else 
        document.getElementById("logoOverlay").style.display = 'none';

    i18n.setLanguage(await ipcRenderer.invoke('getSetting','language'))
    
    setTimeout(async () => {
        //Perform localization
        i18n.performLocalization();

        const wsPort = await ipcRenderer.invoke('getSetting','port');
        document.getElementById('port').value = wsPort;
        let msAddress = `localhost:${wsPort}`;
        document.getElementById('materialCompanionAddress').value = msAddress;
        document.getElementById('materialCompanionAddressRemote').value=`${ip.address()}:${wsPort}`

        document.getElementById('runInTray').checked = await ipcRenderer.invoke('getSetting','runInTray');
        //document.getElementById('enableUSB').checked = await ipcRenderer.invoke('getSetting','enableMpUsb');

        //Fill language selector
        let languageOptions = [];
        for (let lang of i18n.languages) languageOptions.push(`<option value=${lang.lang} ${lang.lang == i18n.language.lang ? 'selected' : ''}>${lang.name}</option>`);
        document.getElementById('languageSelect').innerHTML = languageOptions.join();

        document.getElementById('mkScanMidi').addEventListener('click', function() {
            ipcRenderer.invoke('scanMidi');
        });

        document.getElementById('saveSettings').addEventListener('click', async function() {
            const port = document.getElementById('port').value;
            if (port != '' && port >= 0 && port <= 65535) await ipcRenderer.invoke('setSetting', 'port', port);
            const newLang = document.getElementById('languageSelect').value;
            if (newLang != i18n.language.lang) await ipcRenderer.invoke('setSetting','language',newLang)
            await ipcRenderer.invoke('setSetting', 'runInTray', document.getElementById('runInTray').checked);
            ipcRenderer.invoke('restart');
        })

        document.getElementById('resetSettings').addEventListener('click', () => {
            if (confirm(i18n.localize("SETTINGS.RESET.CONFIRM"))) ipcRenderer.invoke('defaultSettings');
        })

        materialPlane.init(sensorPort, dockPort);
    }, 250);

    materialPlane.getReleases();
});