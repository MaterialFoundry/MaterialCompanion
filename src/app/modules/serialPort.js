const { SerialPort } = require('serialport');
const { ReadlineParser } = require('@serialport/parser-readline');
const { errorPopup } = require("../misc.js");

let serialports = [];
let popup;

const deviceList = [
    {
        vid: "1A86",
        pid: "7523",
        serialNumber: "MPD",
        name: "Dock"
    },{
        vid: "303A",
        pid: "1001",
        serialNumber: "",
        name: "Sensor - Update"
    },{
        vid: "16D0",
        pid: "11CE",
        serialNumber: "",
        name: "Sensor"
    }
]

function getSerialPortName(port) {
    for (let d of deviceList) {
        if (port.vendorId.toUpperCase() !== d.vid) continue;
        if (port.productId.toUpperCase() !== d.pid) continue;
        if (d.name == "Dock" && !port.serialNumber.startsWith("MPD")) continue;
        return d.name;
    }
    return "";
}

async function scanSerialPorts() {
    await SerialPort.list().then((ports, err) => {
        if(err) {
          console.log('err',err.message);
          return;
        }
        serialports = [];

        if (ports.length === 0) {
        }
        else {
            for (let p of ports) {
                if (p.vendorId == undefined || p.productId == undefined) continue;
                const port = {
                    path: p.path,
                    vid: p.vendorId,
                    pid: p.productId,
                    serialNumber: p.serialNumber,
                    name: getSerialPortName(p)
                }
                serialports.push(port);
            }
        } 
    });
    return serialports;
}

class SerPort {
    constructor(type, pUp) {
        this.type = type;
        popup = pUp;
    }

    selectedPort = {};
    open = false;
    port = {};
    parser;
    tempOpen = false;
    errorTimeout;

    async scanSerialPorts() {
        
        const ports = await scanSerialPorts();
        this.selectedPort = ports.find(p => p.name.includes(this.type));
        if (this.selectedPort == undefined) this.selectedPort = ports[0];
        
        if (this.type == "Sensor") {
            this.updateSerialPortElmnt(serialports, "comPort");
            this.updateSerialPortElmnt(serialports, "sensorComPort");
        }
        else if (this.type == "Dock") {
            this.updateSerialPortElmnt(serialports, "baseComPort");
            this.updateSerialPortElmnt(serialports, "penComPort");
        }
        return ports;
    }

    getSerialPort() {
        if (this.selectedPort == undefined) {
            this.selectedPort = serialports.filter(p => p.path === document.getElementById("sensorComPort").value)[0];
        }
        return this.selectedPort;
    }

    setSerialPort(path) {
        this.selectedPort = serialports.filter(p => p.path === path)[0];
        if (this.type == "Sensor") {
            this.updateSerialPortElmnt(serialports, "comPort");
            this.updateSerialPortElmnt(serialports, "sensorComPort");
        }
        else if (this.type == "Dock") {
            this.updateSerialPortElmnt(serialports, "baseComPort");
            this.updateSerialPortElmnt(serialports, "penComPort");
        }
    }

    updateSerialPortElmnt(ports, elmntId) {
        let elmnt = document.getElementById(elmntId);
        while (elmnt.options.length > 0) {
            elmnt.remove(0);
        }
        for (let p of ports) {
            const label = p.name != "" ? `${p.path} (${p.name})` : p.path;
            let newOption = new Option(label,p.path);
            elmnt.add(newOption, undefined);
        }
        if (this.selectedPort?.path != undefined) elmnt.value = this.selectedPort.path;
    }

    openSerialPort(keepOpen=false, tempOpen=null, timeout=5000) {
        let temp = tempOpen;
        if (temp != null) {
            let parent = this;
            this.errorTimeout = setTimeout(()=>{
                //if (parent.open) {
                    popup.error("Could not read data", true);
                    popup.addDetails('Timeout\n');
                    parent.closeSerialPort();
                //}
            },timeout);
        }
        if (this.selectedPort == undefined) {
            this.selectedPort = serialports.filter(p => p.path === document.getElementById("sensorComPort").value)[0];
        }
        if (this.open) {
            if (!keepOpen) this.closeSerialPort();
            return;
        }
        if (this.selectedPort?.path == undefined) {
            console.warn("No serial port selected");
            return;
        }
        console.log(`Connecting ${this.type} serial port`);
        this.port = new SerialPort({path: this.selectedPort.path, baudRate: 115200})
        this.parser = this.port.pipe(new ReadlineParser());
        this.parser.on('data',function(data) {parent.analyzeData(data)});
        let parent = this;
        this.port.on('open', function() {
            console.log("port open");
            parent.open = true;
            parent.tempOpen = temp;
            document.getElementById("connectComPort").innerHTML = window.i18n.localize("DISCONNECT");
        })
        this.port.on('close', function() {
            console.log("port closed");
            parent.open = false;
            document.getElementById("connectComPort").innerHTML = window.i18n.localize("CONNECT");
        })
        this.port.on('error', function(err) {
            console.log('Error',err);
            popup.error("Error, check 'Details' for more info.", true);
            popup.clearDetails();
            popup.addDetails(err);
            clearTimeout(this.errorTimeout);
        });
    }

    write(msg) {
        if (!this.open) return;
        this.port.write(msg);
    }

    closeSerialPort() {
        if (this.open) {
            this.open = false;
            this.port.close();
        }
    }

    analyzeData(msg) {
        if (msg.length < 3) return;
        //console.warn(`raw: '${msg}'`);
        let data;
        let validJson = true;
        let parent = this;
        try {
            data = JSON.parse(msg);
        }
        catch (error) {
            validJson = false;
            console.log('could not parse',{error})
        }

        if (validJson) {
            if (data.status == 'update') {
                document.getElementById("sensorVariant").innerHTML = data.hardwareVariant;
                document.getElementById("sensorFirmwareVer").innerHTML = 'v' + data.firmwareVersion;
                document.getElementById("sensorWebserverVer").innerHTML = 'v' + data.webserverVersion;
                document.getElementById("sensorWiFiConnected").checked = data.network.wifiConnected;
                document.getElementById("sensorSSID").innerHTML = data.network.ssid;
                document.getElementById("sensorIP").innerHTML = data.network.ip;
                document.getElementById("sensorName").innerHTML = data.network.name;
                for (let elmnt of document.querySelectorAll('.mpConf label')) elmnt.style.color = 'white';
                if (parent.tempOpen == 'update') {
                    clearTimeout(this.errorTimeout);
                    parent.closeSerialPort();
                }
            }
            else if (data.status == 'wifiStations') {
                if (parent.tempOpen == 'scanWiFi') {
                    clearTimeout(this.errorTimeout);
                    parent.closeSerialPort();
                }
                document.getElementById("scanWiFi").value = "Scan";
                const stations = data.stations;
                let ssidElement = document.getElementById("APs");
                for (let i=0; i<stations.length; i++) {
                    const station = stations[i];
                    let newOption = document.createElement("option");
                    newOption.value = `"${station.ssid}"`;
                    newOption.innerHTML = `${station.ssid} (${station.rssi}dBm/${station.authMode})`;
                    ssidElement.appendChild(newOption);
                }
            }
        }
    }
}

module.exports = { SerPort };