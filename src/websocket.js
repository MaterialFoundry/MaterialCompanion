const WebSocket = require('ws');
const settings = require('electron-settings');
const { app, ipcMain } = require('electron');
const { materialPlaneWsClient, materialPlaneSerial } = require('./modules/materialPlane');



let win;
app.connections = [];
//let wss;
let mdClients = [];
//let mpClient;
let mpSerial;
//let app;
let pluginVersion;

ipcMain.handle('sendWs', async(event, ...args) => {
    //console.log('sendWs',event,...args);
})

function sendToRenderer(type,data) {
    win.webContents.send('asynchronous-message', {type,data});
    //console.log('sending to renderer',data)
}

async function initializeWebsocket(window, eventEm) {
    
    if (app.wss != undefined) {
        console.log('websocket already open, terminating all connections');
        await app.wss.clients.forEach((socket) => {
            // Soft close
            socket.close();
          
            process.nextTick(() => {
              if ([socket.OPEN, socket.CLOSING].includes(socket.readyState)) {
                // Socket still hangs, hard close
                socket.terminate();
              }
            });
          });
        await app.wss.close();
        app.wss = undefined;
        app.mpClient.close();
        app.mpClient = undefined;
    }
    
    win = window
    eventEmitter = eventEm;
    version = app.getVersion();
    sendToRenderer('appVersion',version)
    //port = await getSetting('port');
    port = await settings.get('port');
    console.log(`Starting websocket on port ${port}`)
    sendToRenderer('notification',`Starting websocket on port ${port}`)
    app.wss = new WebSocket.WebSocketServer({ port });
    setTimeout(async()=> {
        app.mpClient = new materialPlaneWsClient(app.wss, window);
        mpSerial = new materialPlaneSerial(window);
        const connMode = await settings.get('sensorConnectionEvent');
        if (connMode == 'start') {
            const ip = await settings.get('mpSensorIp');
            app.mpClient.start(ip, app.wss);
        }
        
    },100);
    
    /*
    * Do when a new websocket connection is made
    */
    app.wss.on('connection', function (ws, request, client) {
        let source;
        let connection;
        let userId;
        let userName;
        let target;

        //Set ping interval
        const id = setInterval(function () {
            ws.send("{\"T\":\"P\"}")
        }, 1000);

        ws.on('message', async function incoming(data) {
            let JSONdata;
            try {
                JSONdata = JSON.parse(data);
            } catch(err) {
                console.log('could not parse JSON',err)
            }
            sendToRenderer('wsReceive',JSONdata);
            //console.log('rec',JSONdata)
            if (JSONdata.target == "MaterialCompanion") {
                source = JSONdata.source;
                userId = JSONdata.userId;
                userName = JSONdata.userName;
                target = JSONdata.target;
                connection = await setServerConfig(JSONdata, ws);
            }
            else if (JSONdata.target == "MaterialPlane_Device") {
                app.mpClient.broadcast(JSONdata.data)
            }
            else if (JSONdata.target == "MaterialKeys_Device") {
                app.midi.onWsData(JSONdata);
            }
            else {
                app.wss.broadcast(JSONdata, JSONdata.target, source);
            }

            analyzeWebsocketMessage(JSONdata);
        });

        ws.on('close', async function (client) {
            console.log('Closed ws')
            
            sendToRenderer('serverConfig',{
                type: 'disconnected',
                source,
                target,
                userId,
                userName
            });
            
            app.connections = app.connections.filter(c => c.source != source || c.userId != userId);

            if (source == 'MaterialKeys_Foundry' && await settings.get('mkConnectionEvent') == 'module') {
                app.midi.disconnect();
            }

            clearInterval(id);
        }); 
    });

    /*
    * Broadcast message over websocket to all connected clients
    */
    app.wss.broadcast = async function broadcast(data, target, source) {
        sendToRenderer('wsBroadcast',{data,target,source});
        let msg = JSON.stringify(data);
        let conn = app.connections.filter(c => c.source == target);
        let clientData = [];
        if (target == 'MaterialDeck_Foundry' || target == 'MaterialDeck_Device') clientData = await settings.get('clientData');

        for (let connection of conn) {
            if (connection.source != target && connection.target != source) continue;

            if (target == 'MaterialDeck_Foundry' && data.device != undefined) {
                const user = clientData.find(c => c.userId == connection.userId);
                if (user.materialDeck.blockedDevices.indexOf(data.device) != -1) continue;
            }
            else if (target == 'MaterialDeck_Device' && data.device != undefined) {
                const user = clientData.find(c => c.userId == data.userId);
                
                if (user.materialDeck.blockedDevices.indexOf(data.device) != -1) continue;
            }
            sendToRenderer('wsBroadcast',{msg});
            connection.ws.send(msg)
            
        }
    };
}

function analyzeWebsocketMessage(msg) {
    if (msg.source == 'MaterialDeck_Device'){
        if (msg.type == 'deviceList') sendToRenderer('materialDeck_devices',{devices: msg.devices});
        else if (msg.type == 'deviceConnected') sendToRenderer('materialDeck_deviceConnected',{device: msg.device});
        else if (msg.type == 'deviceDisconnected') sendToRenderer('materialDeck_deviceDisconnected',{device: msg.device});
    }
    else if (msg.source == 'MaterialDeck_Foundry') {

    }
    else if (msg.source == 'MaterialPlane_Foundry') {
        
    }
}

async function setServerConfig(JSONdata, ws) {
    if (JSONdata.source == undefined || JSONdata.target == undefined || JSONdata.userId == undefined) return;
    const source = JSONdata.source;
    const target = JSONdata.sourceTarget;
    const userId = JSONdata.userId;
    const devices = JSONdata.devices;
    const userName = JSONdata.userName;
    let connection = {
        ws,
        connected: true,
        source,
        target,
        userId,
        userName,
        devices,
    }

    if (app.connections.find(c => c.userId == userId && c.target == target && c.source == source)) {
        console.log('Connection already exists, clearing earlier entry');
        app.connections = app.connections.filter(c => c.userId != userId);
    }
    app.connections.push(connection);

    sendToRenderer('serverConfig',{
        type: JSONdata.type,
        source,
        target,
        userId,
        devices,
        userName
    });

    if (source == 'MaterialPlane_Foundry') {
        const connectionMode = await settings.get('sensorConnectionEvent');
        if (connectionMode == 'module') {
            const ip = await settings.get('mpSensorIp');
            app.mpClient.start(ip, app.wss);
        }
    }
    else if (source == "MaterialDeck_Foundry") {
        console.log('Foundry VTT - MD Connected');
        const data = {
            target: 'MaterialDeck_Foundry',
            source: 'MaterialCompanion',
            type: 'connected',
            materialCompanionVersion: version,
            pluginVersion,
        }
        app.wss.broadcast(data, data.target, data.source);
    }
    else if (source == "MaterialDeck_Device") {
        console.log('Stream Deck Connected');
        pluginVersion = JSONdata.version;
        const data = {
            target: 'MaterialDeck_Foundry',
            source: 'MaterialCompanion',
            type: 'connected',
            materialCompanionVersion: version,
            pluginVersion,
        }
        app.wss.broadcast(data, data.target, data.source);
    }
    else if (source == "MaterialKeys_Foundry") {
        console.log('Foundry VTT - MK Connected');
        const data = {
            target: 'MaterialKeys_Foundry',
            source: 'MaterialCompanion',
            type: 'connected',
            materialCompanionVersion: version
        }
        app.wss.broadcast(data, data.target, data.source);

        if (app.midi.connected) {
            const data = {
                target: 'MaterialKeys_Foundry',
                source: 'MaterialCompanion',
                type: 'deviceConnected'
            }
            app.wss.broadcast(data, data.target, data.source);
        }
        else if (await settings.get('mkConnectionEvent') == 'module') app.midi.connect();
    }
    return connection;
}

function getConnections() {
    return app.connections;
}

module.exports = { initializeWebsocket, getConnections };