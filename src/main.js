const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('path');
const url = require('url');
const packageJson = require('../package.json');
const settings = require('electron-settings');
const { initializeWebsocket, getConnections } = require('./websocket')
const { initializeMidi, getAllowedMkDevices } = require('./modules/materialKeys')

let dev = false;

var env = process.argv[2];
switch (env) {
    case 'dev':
        console.log('Starting development')
        dev = true;
        break;
    case 'prod':
        dev = false;
        break;
}

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
    blockedMkDevices: [],
    sensorConnectionMode: 'module',
    mpSensorIp: 'materialsensor.local:3000'
}

setDefaultSettings();

async function setDefaultSettings(force = false) {
    for (const [key, value] of Object.entries(defaultSettings)) {
        if (await settings.get(key) == undefined || force) 
            await settings.set(key, value);
    }
}

app.whenReady().then(() => {
    createWindow();
    setTimeout(()=> {
        initializeWebsocket(win);
        initializeMidi(win);
    }, 1000)
    
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

    //Open console for dev
    if (dev) {
        win.webContents.openDevTools();
        win.webContents.send('asynchronous-message', {
            devMode: 'true'
        });
    }
}

function relaunchApp() {
    app.relaunch();
    app.exit();
}



//let app.gameWindow;

const createGameWindow = (game) => {
    console.log('Starting game',game)
    const { screen } = require('electron');
    const primaryDisplay = screen.getPrimaryDisplay()
    const { width, height } = primaryDisplay.workAreaSize
    
    //Create window
    app.gameWindow = new BrowserWindow({
        width,
        height,
        icon: path.join(__dirname, 'app', 'images', 'icons', 'png','48x48.png'),
        backgroundColor: '#000000',
        webPreferences: {
            nodeIntegration: true,
            contextIsolation: false,
        }
    })
  
    //Load main html file
    app.gameWindow.loadURL(url.format({
        pathname: path.join(__dirname, 'game', 'game.html'),
        protocol: 'file',
        slashes: true
    }));

    //Remove menu from window
    app.gameWindow.removeMenu();

    //Enable console on F12 and refresh on F5
    app.gameWindow.webContents.on('before-input-event', (event,input)=>{
        if (input.type == 'keyDown' && input.key == 'F12') {
            if (!app.gameWindow.webContents.isDevToolsOpened()) app.gameWindow.webContents.openDevTools();
            else app.gameWindow.webContents.closeDevTools();
        }
        if (input.type == 'keyDown' && input.key == 'F5') {
            app.gameWindow.webContents.send('asynchronous-message', {
                type: 'refreshWindow'
            });
            setTimeout(() => {
                app.gameWindow.reload();
                setTimeout(()=>{
                    app.gameWindow.webContents.send('asynchronous-message', {
                        type:'setGame',
                        game
                    });
                }, 500)
                //initializeWebsocket(win);
            }, 100)
        }
    });

    //Open console for dev
    if (dev) {
        app.gameWindow.webContents.openDevTools();
        app.gameWindow.webContents.send('asynchronous-message', {
            devMode: 'true'
        });
    }

    setTimeout(()=>{
        app.gameWindow.webContents.send('asynchronous-message', {
            type:'setGame',
            game
        });
    }, 1000)
    
}


ipcMain.handle('restart', (event) => {
    //console.log('restarting');
    setTimeout(relaunchApp,1000);
});

ipcMain.handle('setSetting', async (event, key, value) => {
    //console.log('setSetting',key,value)
    if (key == 'sensorConnectionMode') {
        if (value == 'module') {
            const mpModuleConnections = app.connections.filter(c => c.source == 'MaterialPlane_Foundry');
            if (mpModuleConnections.length > 0 && !app.mpClient.connected()) {
                const ip = await settings.get('mpSensorIp');
                app.mpClient.start(ip, app.wss);
            }
        }
    }
    return await settings.set(key,value);
});

ipcMain.handle('getSetting', async (event, key) => {
    //console.log('getSetting',key)
    return await settings.get(key);
});

ipcMain.handle('defaultSettings', async (event) => {
    //console.log('Resetting settings')
    await setDefaultSettings(true);
    relaunchApp();
});

ipcMain.handle('getData', async (event, key) => {
   // console.log('getData',key); 
    if (key == 'appVersion') return app.getVersion();
    //return getAllowedMkDevices();
});

ipcMain.handle('setData', async (event, key, value) => {
   // console.log('setData',key,value)
    if (key == 'connectMpSensor') {
        const ip = await settings.get('mpSensorIp');
        if (!app.mpClient.connected()) app.mpClient.start(ip, app.wss);
        else app.mpClient.close();
    }
    else if (key == 'startGame') {
        createGameWindow(value);
    }
})
