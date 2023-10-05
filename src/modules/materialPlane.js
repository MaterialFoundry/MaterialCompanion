const WebSocket = require('ws');
const settings = require('electron-settings');
const { app, ipcMain } = require('electron');
const { SerPort } = require("../app/modules/serialPort.js");

let win;
let inverval;
let ws;
let wsOpen = false;
let obj;
let serialPorts = [];

function sendToRenderer(type,data) {
    win.webContents.send('asynchronous-message', {type,data});
    //console.log('sending to renderer',data)
}

//ipcMain.handle('scanSerial', async(event, ...args) => {
 //   console.log('sendWs',event,...args);
//})

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
        
        clearInterval(inverval);
        let parent = this;

        ws.onmessage = function(msg) {
            //console.log('msg',msg.data)
            //console.log(this.server);
            clearInterval(inverval);
            inverval = setInterval(parent.resetConnection, 2500);
            parent.server.broadcast(JSON.parse(msg.data),'MaterialPlane_Foundry','MaterialPlane_Device');
        }

        ws.onopen = function() {
            console.log("Material Plane Sensor: Websocket connected");
            wsOpen = true;
            sendToRenderer('materialPlane_deviceConnected');
            app.wss.broadcast({status:'sensorConnected'},'MaterialPlane_Foundry','MaterialPlane_Device');
            clearInterval(inverval);
            inverval = setInterval(parent.resetConnection, 2500);
        }

        ws.onclose = function() {
            //console.log("Material Plane Sensor: Websocket disconnected");
            if (wsOpen) sendToRenderer('materialPlane_deviceDisconnected');
            wsOpen = false;
            
        }

        ws.onerror = function(err) {
            //console.log('err',err)
        }

        inverval = setInterval(this.resetConnection, 10000);
    }

    broadcast(data) {
        if (wsOpen) {
            //console.log('toSensor',data)
            ws.send(JSON.stringify(data))
        }
    }

    async close() {
        return ws.close();
    }

    resetConnection() {
        //console.log('reset',ws)
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
}

class materialPlaneSerial {
    serialPort; 

    constructor(window) {
        win = window;
        this.serialPort = new SerPort('Sensor');
        this.scanSerial();
    }

    async scanSerial() {
        //console.log("scanning serialports")
        //console.log(await this.serialPort.scanSerialPorts());
    }
}

module.exports = { materialPlaneWsClient, materialPlaneSerial };