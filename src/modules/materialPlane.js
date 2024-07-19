const WebSocket = require('ws');
const settings = require('electron-settings');
const { app, ipcMain } = require('electron');
const { SerPort } = require("../app/modules/serialPort.js");

let win;
let interval;
let ws;
let wsOpen = false;
let obj;
let serialPorts = [];

function sendToRenderer(type,data) {
    win.webContents.send('asynchronous-message', {type,data});
    //console.log('sending to renderer',data)
}

class materialPlaneWsClient {
    sensorIp;
    server;

    constructor(wss,window) {
        win = window;
        obj = this;
    }

    async start(ip, wss) {
        this.sensorIp = ip;
        this.server = wss;

        if (wsOpen) {
            console.log('Sensor WS already open, closing now'); 
            await this.close();
        }

        console.log('starting ws for MP on ip', ip)

        ws = new WebSocket('ws://'+ip);
        
        clearInterval(interval);
        let parent = this;

        ws.onmessage = function(msg) {
            clearInterval(interval);
            interval = setInterval(parent.resetConnection, 2500);
            let data;
            try {
                data = JSON.parse(msg.data);
                if (app.gameWindow != undefined) {
                    app.gameWindow.webContents.send('asynchronous-message', {type:'wsData',data});
                }
            } catch(err) {
                console.log(err);
            }
            app.wss.broadcast(data,'MaterialPlane_Foundry','MaterialPlane_Device');
        }

        ws.onopen = function() {
            console.log("Material Plane Sensor: Websocket connected");
            wsOpen = true;
            sendToRenderer('materialPlane_deviceConnected');
            app.wss.broadcast({status:'sensorConnected'},'MaterialPlane_Foundry','MaterialPlane_Device');
            clearInterval(interval);
            interval = setInterval(parent.resetConnection, 2500);
        }

        ws.onclose = function() {
            if (wsOpen) sendToRenderer('materialPlane_deviceDisconnected');
            wsOpen = false;
            
        }

        ws.onerror = function(err) {
            //console.log('err',err)
        }

        interval = setInterval(this.resetConnection, 10000);
    }

    broadcast(data) {
        if (wsOpen) {
            ws.send(JSON.stringify(data))
        }
    }

    async close() {
        console.log("Closing sensor connection");
        clearInterval(interval);
        return ws.close();
    }

    resetConnection() {
        if (wsOpen) {
            wsOpen = false;
            console.log("Material Plane: Disconnected from server");
            obj.start(obj.sensorIp);
        }
        
       
        else if (ws.readyState == 2 || ws.readyState == 3){
            console.log("Material Plane: Connection to server failed");
            obj.start(obj.sensorIp);
        }
        
    }

    connected() {
        return wsOpen;
    }
}

class materialPlaneSerial {
    serialPort; 

    constructor(window) {
        win = window;
        this.serialPort = new SerPort('Sensor');
        this.scanSerial();
    }

    async scanSerial() {
    }
}

module.exports = { materialPlaneWsClient, materialPlaneSerial };