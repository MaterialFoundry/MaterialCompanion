const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('path');
const url = require('url');
const packageJson = require('../package.json');
const settings = require('electron-settings');
const { initializeWebsocket } = require('./websocket')
const { initializeMidi, getAllowedMkDevices } = require('./modules/materialKeys')

console.log(`Starting Material Companion v${packageJson.version}`);

process.env['ELECTRON_DISABLE_SECURITY_WARNINGS'] = 'true';

let win;

const defaultSettings = {
    language: 'en',
    port: 3001,
    runInTray: false,
    mpComPort: "",
    dockComPort: "",
    enableMpUsb: false,
    clientData: [],
    autoScanUsb: false,
    autoScanMidi: true,
    blockedMkDevices: []
}

setDefaultSettings();

async function setDefaultSettings(force = false) {
    for (const [key, value] of Object.entries(defaultSettings)) {
        if (await settings.get(key) == undefined || force) await settings.set(key, value);
    }
}

app.whenReady().then(() => {
    createWindow();
    initializeWebsocket(win);
    initializeMidi(win);
})

const createWindow = () => {
    //Create window
    win = new BrowserWindow({
        width: 800,
        height: 800,
        icon: path.join(__dirname, 'app', 'images', 'icons', 'png','48x48.png'),
        backgroundColor: '#4f4f4f',
        webPreferences: {
            nodeIntegration: true,
            contextIsolation: false,
        }
    })
  
    //Load main html file
    win.loadURL(url.format({
        pathname: path.join(__dirname, 'app', 'app.html'),
        protocol: 'file',
        slashes: true
    }));

    //Remove menu from window
    win.removeMenu();

    //Enable console on F12 and refresh on F5
    win.webContents.on('before-input-event', (event,input)=>{
        if (input.type == 'keyDown' && input.key == 'F12') {
            if (!win.webContents.isDevToolsOpened()) win.webContents.openDevTools();
            else win.webContents.closeDevTools();
        }
        if (input.type == 'keyDown' && input.key == 'F5') {
            win.webContents.send('asynchronous-message', {
                type: 'refreshWindow'
            });
            setTimeout(() => {
                win.reload();
                initializeWebsocket(win);
            }, 100)
        }
    });

    //Open console by default
    //win.webContents.openDevTools();
}

function relaunchApp() {
    app.relaunch();
    app.exit();
}

ipcMain.handle('restart', (event) => {
    //console.log('restarting');
    setTimeout(relaunchApp,1000);
});

ipcMain.handle('setSetting', async (event, key, value) => {
    //console.log('setSetting',key,value)
    return await settings.set(key,value);
});

ipcMain.handle('getSetting', async (event, key) => {
   // console.log('getSetting',key)
    return await settings.get(key);
});

ipcMain.handle('defaultSettings', async (event) => {
    //console.log('Resetting settings')
    await setDefaultSettings(true);
    relaunchApp();
});

ipcMain.handle('getData', async (event, key) => {
   // console.log('getData',key); 
    return getAllowedMkDevices();
});
