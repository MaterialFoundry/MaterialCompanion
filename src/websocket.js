const WebSocket = require('ws');
const settings = require('electron-settings');
const { app, ipcMain } = require('electron');
const { materialPlaneWsClient, materialPlaneSerial } = require('./modules/materialPlane');



let win;
let connections = [];
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
    //port = await getSetting('port');
    port = await settings.get('port');
    console.log(`Starting websocket on port ${port}`)
    sendToRenderer('notification',`Starting websocket on port ${port}`)
    app.wss = new WebSocket.WebSocketServer({ port });
    setTimeout(()=> {
        app.mpClient = new materialPlaneWsClient(app.wss, window);
        mpSerial = new materialPlaneSerial(window);
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
            let JSONdata = JSON.parse(data);
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
            
            connections = connections.filter(c => c.module != target);
            
            /*
            if (target == "MK"){
                console.log('Foundry VTT - MK disconnected');
                MKConnected = false;
                eventEmitter.emit('ws', 'connected', target, false);
                saveSetting(`${target}connected`,false,'temp');
            }
            else if (target == "MD"){
                console.log('Foundry VTT - MD disconnected');
                const index = connections.findIndex(c => c.conId == connection);
                connections.splice(index,1);
                MDConnected = false;
                eventEmitter.emit('ws', 'connected', target, false);
                saveSetting(`${target}connected`,false,'temp');
            }
            else if (target == "SD") {
                console.log('Stream Deck disconnected');
                const index = connections.findIndex(c => c.conId == connection.conId);
                connections.splice(index,1);
                if (connections.find(c => c.target == target) == undefined) {
                    SDConnected = false;
                    eventEmitter.emit('ws', 'connected', target, false);
                    saveSetting(`${target}connected`,false,'temp');
                    if (MDConnected){
                        const data = {
                            target: 'MD',
                            type: 'disconnected',
                            data: 'SD'
                        }
                        app.wss.broadcast(data);
                    }
                }
            }
            else if (target == "MP"){
                console.log('Foundry VTT - MP disconnected');
                const index = connections.findIndex(c => c.conId == connection.conId);
                connections.splice(index,1);
                MPConnected = false;
                try {
                    wsSensor.close();
                }
                catch (err) {}
                eventEmitter.emit('ws', 'connected', target, false);
                saveSetting(`${target}connected`,false,'temp');
            }
            else {
                const index = connections.findIndex(c => c.conId == connection.conId);
                connections.splice(index,1);
                const data = {
                    target,
                    type: 'disconnected',
                    id: passthroughId
                }
                app.wss.broadcast(data);
            }
            */
            clearInterval(id);
        }); 
    });

    /*
    * Broadcast message over websocket to all connected clients
    */
    app.wss.broadcast = async function broadcast(data, target, source) {
        sendToRenderer('wsBroadcast',{data,target,source});
        let msg = JSON.stringify(data);
        let conn = connections.filter(c => c.source == target);
        let clientData = [];
        //console.log('send',target,source, conn.length)
        if (target == 'MaterialDeck_Foundry' || target == 'MaterialDeck_Device') clientData = await settings.get('clientData');

        for (let connection of conn) {
            //console.log('connection',connection.source, source, connection.target, target)
            if (connection.source != target && connection.target != source) continue;
            //console.log('connection',connection.source, connection.target, data)
            if (target == 'MaterialDeck_Foundry' && data.device != undefined) {
                const user = clientData.find(c => c.userId == connection.userId);
                if (user.materialDeck.blockedDevices.indexOf(data.device) != -1) continue;
            }
            else if (target == 'MaterialDeck_Device' && data.device != undefined) {
                const user = clientData.find(c => c.userId == data.userId);
                
                if (user.materialDeck.blockedDevices.indexOf(data.device) != -1) continue;

                
                //console.log('user',data.device,user,user.materialDeck.blockedDevices.indexOf(data.device))
            }
            sendToRenderer('wsBroadcast',{msg});
            connection.ws.send(msg)
            
        }
        //console.log('message not sent',target,source)
        
        //console.log('conn',conn)
        return;
        if (target == undefined) {
            let msg = JSON.stringify(data);

            for (let connection of connections) {
                if (connection.target == data.target) {
                    connection.ws.send(msg);
                    return true;
                } 
            }
            return false;
        }
        else {
            for (let connection of connections) {
                if (connection.target == target) {
                    connection.ws.send(data);
                    return true;
                }
                    
            }
            return false;
        }
        return false;
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

    if (connections.find(c => c.userId == userId && c.target == target && c.source == source)) {
        console.log('Connection already exists, clearing earlier entry');
        connections = connections.filter(c => c.userId != userId);
    }
    connections.push(connection);

    //console.log('connections',connections)

    sendToRenderer('serverConfig',{
        type: JSONdata.type,
        source,
        target,
        userId,
        devices,
        userName
    });

   // sendToRenderer('connections',{
    //    connections: JSON.stringify(connections)
    //});


    if (target == 'MaterialPlane_Device') {
        app.mpClient.start(JSONdata.sensorIp, app.wss);
        
    }
    else if (target == 'SD') {
        
        //eventEmitter.emit('ws', 'connected', 'SD', false);
        //saveSetting('SDconnected', false, 'temp');
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
    return connection;

    /*
    else if (target == "SD"){
        SDversion = JSONdata.version;
        if (JSONdata.type == "disconnected"){
            console.log('Stream Deck disconnected');
            SDConnected = false;
            if (MDConnected){
                const data = {
                    target: 'MD',
                    type: 'disconnected',
                    data: 'SD'
                }
                app.wss.broadcast(data);
            }
        }
        else {
            connection = {
                ws,
                conId: connectionId,
                target
            };
            connections.push(connection);
            connectionId++;
            SDConnected = true;
            console.log('Stream Deck connected');

            if (MDConnected){
                const data = {
                    target: 'MD',
                    type: 'connected',
                    data: 'SD',
                    MSversion: version,
                    SDversion: SDversion,
                }
                app.wss.broadcast(data);
            }
        }
    }
    */
 
}

function getConnections() {
    return connections;
}

module.exports = { initializeWebsocket, getConnections };