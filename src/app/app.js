const { Localization } = require("./localization.js");
const { ipcRenderer } = require('electron');

var ip = require('ip');

const startLogo = {
    enable: true,
    static: 2000,
    fadeout: 1000
}

window.i18n = new Localization();


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

/*
        document.getElementById('languageSelect').addEventListener('change', async (event) => {
            console.log(event);
            const newLang = event.target.value;
            if (newLang != i18n.language.lang) {
                await ipcRenderer.invoke('setSetting','language',newLang)
                ipcRenderer.invoke('restart');
            } 
        });

        document.getElementById('applyPort').addEventListener('click', async function(event){
            const port = document.getElementById('port').value;
            if (port == '' || port < 0 || port > 65535) return;
            await ipcRenderer.invoke('setSetting', 'port', port);
            ipcRenderer.invoke('restart');
        });

        document.getElementById('runInTray').addEventListener('change', async function(event){
            await ipcRenderer.invoke('setSetting', 'runInTray', event.target.checked);
            ipcRenderer.invoke('restart');
        });
*/
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
    }, 250);
});

