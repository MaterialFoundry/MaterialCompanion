const path = require('path');
const { spawn } = require("child_process");
const fs = require('fs');
const fsPromises = require('fs').promises;
const { getSetting, setSetting, setData } = require("../misc.js")
const decompress = require("decompress");
const dns = require('node:dns');

const https = require('https'); // or 'https' for https:// URLs

const sensorUrl = "https://api.github.com/repos/MaterialFoundry/MaterialPlane_Sensor/releases";
//const sensorUrl = "https://api.github.com/repos/MaterialFoundry/Sensor_Test/releases";
const penUrl = "https://api.github.com/repos/MaterialFoundry/MaterialPlane_Pen/releases";
const baseUrl = "https://api.github.com/repos/MaterialFoundry/MaterialPlane_Base/releases";

let popup;
let baseEepromData = [];
let penEepromData = [];
let sensorConnectionEvent;
let sensorConnectionMethod;
let sensorIp;

function startGame(game) {
    setData('startGame',game);
}

function updateSensorData(data) {
    //console.log(data);
    document.getElementById("sensorVariant").innerHTML = data.hardwareVariant;
    document.getElementById("sensorFirmwareVer").innerHTML = 'v' + data.firmwareVersion;
    document.getElementById("sensorWebserverVer").innerHTML = 'v' + data.webserverVersion;
    document.getElementById("sensorWiFiConnected").checked = data.network.wifiConnected;
    document.getElementById("sensorSSID").innerHTML = data.network.ssid;
    document.getElementById("sensorIP").innerHTML = data.network.ip;
    document.getElementById("sensorName").innerHTML = data.network.name;
    for (let elmnt of document.querySelectorAll('.mpConf label')) elmnt.style.color = 'white';
}

class MaterialPlane {
    constructor(pUp) {
        popup = pUp;
    }

    sensorVariants = ["Production"];
    sensorReleases = [];
    sensorVariantReleases = [];
    webserverReleases = [];
    baseReleases = [];
    penReleases = [];
    pymcuprogInstalled = false;
    pythonInstalled = false;
    pyserialInstalled = false;
    pipInstalled = false;
    pythonCmd = window.navigator.platform == 'Win32' ? 'py' : 'python3';

    async init(sensorPort, dockPort) {
        window.startGame = function(game) {setData('startGame',game)};

        /* COM ports*/
        document.getElementById("refreshComPort").addEventListener('click', () => {sensorPort.scanSerialPorts();})
        document.getElementById("refreshSensorComPort").addEventListener('click', () => {sensorPort.scanSerialPorts();})
        document.getElementById("refreshBaseComPort").addEventListener('click', () => {dockPort.scanSerialPorts();})
        document.getElementById("refreshPenComPort").addEventListener('click', () => {dockPort.scanSerialPorts();})

        document.getElementById("comPort").addEventListener('change', (e) => {sensorPort.setSerialPort(e.target.value)})
        document.getElementById("sensorComPort").addEventListener('change', (e) => {sensorPort.setSerialPort(e.target.value)})
        document.getElementById("baseComPort").addEventListener('change', (e) => {dockPort.setSerialPort(e.target.value)})
        document.getElementById("penComPort").addEventListener('change', (e) => {dockPort.setSerialPort(e.target.value)})

        document.getElementById("connectComPort").addEventListener('click', () => {sensorPort.openSerialPort()})


        /* Sensor config */
        document.getElementById("readSensorConfig").addEventListener('click', async () => {
            sensorPort.openSerialPort(true, 'update');
            setTimeout(()=>{sensorPort.write(JSON.stringify({event:"getStatus"}))},100);
            for (let elmnt of document.querySelectorAll('.mpConf label')) elmnt.style.color = "#2d3058";
            document.getElementById("sensorWiFiConnected").checked = false;
        });

        document.getElementById("openWebserver").addEventListener('click', () => {
            if (document.getElementById("sensorIP").style.color == "") {
                const popupContent = `
                    Could not open webserver because no valid IP address was found.<br>
                    Try reading the sensor configuration using the 'Read' button.
                `
                popup.open(popupContent, true);
                return;
            }
            const sensorIp = "http://" + document.getElementById("sensorIP").innerHTML;
            console.log(sensorIp)
            open( sensorIp, function (err) {
                if ( err ) throw err;    
            });
        });

        //document.getElementById("sensorVersionList").addEventListener('change', (e) => {document.getElementById("sensorUploadForm").style.display = e.target.value == 'uploadFile' ? "" : "none";})
        document.getElementById("connectWiFiBtn").addEventListener('click', () => {
            const popupContent = `
                <div>${i18n.localize("MP.SENSOR_CONNECT_POPUP.CONTENT")}</div>

                <h3>${i18n.localize("MP.SENSOR_CONNECT_POPUP.ACCESSPOINTS")}</h3>
                <div class="form-elements">
                    <label class="tooltip">${i18n.localize("MP.SENSOR_CONNECT_POPUP.SCAN_ACCESSPOINTS.LABEL")}
                    <span class="tooltiptext">${i18n.localize("MP.SENSOR_CONNECT_POPUP.SCAN_ACCESSPOINTS.TOOLTIP")}</span>
                    </label>
                    <input type="button" id="scanWiFi" value="Scan">
                </div>

                <select name="APs" default="" id="APs" size="6" style="width:100%">
                </select>

                <div class="form-elements">
                    <label class="tooltip">${i18n.localize("MP.SENSOR_CONNECT_POPUP.SSID.LABEL")}
                    <span class="tooltiptext">${i18n.localize("MP.SENSOR_CONNECT_POPUP.SSID.TOOLTIP")}</span>
                    </label>
                    <input type="text" name="SSID" id="SSID">
                </div>

                <div class="form-elements">
                    <label class="tooltip">${i18n.localize("MP.SENSOR_CONNECT_POPUP.PASSWORD.LABEL")}
                    <span class="tooltiptext">${i18n.localize("MP.SENSOR_CONNECT_POPUP.PASSWORD.TOOLTIP")}</span>
                    </label>
                    <input type="password" name="password" id="password">
                </div>

                <div class="form-elements">
                    <label class="tooltip"></label>
                    <button type="button" id="connectWiFi">${i18n.localize("CONNECT")}</button>
                </div>
            `
            popup.open(popupContent);
            
            document.getElementById("scanWiFi").addEventListener('click', async () => {
                await sensorPort.openSerialPort(true, 'scanWiFi',20000);
                setTimeout(()=>{sensorPort.write(JSON.stringify({event:"scanWifi"}))},100);
                document.getElementById("scanWiFi").value = "Scanning.  ";
                let counter = 0;
                document.scanInterval = setInterval(()=>{
                    if (document.getElementById("scanWiFi") == undefined) {
                        clearInterval(document.scanInterval);
                        return;
                    }
                    if (counter >= 20) {
                        clearInterval(document.scanInterval);
                        document.getElementById("scanWiFi").value = "Scan";
                        return;
                    }
                    const val = document.getElementById("scanWiFi").value;
                    if (val == "Scanning.  ") document.getElementById("scanWiFi").value = "Scanning.. ";
                    else if (val == "Scanning.. ") document.getElementById("scanWiFi").value = "Scanning...";
                    else if (val == "Scanning...") document.getElementById("scanWiFi").value = "Scanning.  ";
                    counter++;
                }, 1000);
            });
            document.getElementById("APs").addEventListener("change", (event) => { 
                let ssid = event.target.value.substring(1,event.target.value.length-1);
                document.getElementById("SSID").value = ssid;
            });
            document.getElementById("connectWiFi").addEventListener("click", async (event) => {
                if (document.getElementById("SSID").value == "") {
                    alert("No access point selected");
                    return;
                }
                await sensorPort.openSerialPort(true);
                setTimeout(()=>{sensorPort.write(JSON.stringify({event:"connectWifi", ssid:document.getElementById("SSID").value, pw: document.getElementById("password").value}))},100);
            });
        });
        document.getElementById("sensorVariantUpload").addEventListener('change', () => {
            this.updateSensorFirmwareList();
        });
        document.getElementById("updateSensorFirmware").addEventListener('click', () => {
            this.updateSensor(sensorPort);
        });
        document.getElementById("sensorPreReleases").checked = await getSetting('mpSensorPreReleases');
        document.getElementById("sensorPreReleases").addEventListener('change', async (evt) => {
            await setSetting('mpSensorPreReleases', evt.target.checked);
            this.updateSensorFirmwareList();
            //this.updateSensor();
        });
        document.getElementById("sensorUploadMethod").addEventListener('change', (event) => {
            if (event.target.value == "USB") document.getElementById("mpUpdateAddressWrapper").style.display = "none";
            else document.getElementById("mpUpdateAddressWrapper").style.display = "";
        });


        document.getElementById("updateBaseFirmware").addEventListener('click', () => {
            this.updateAttiny(dockPort.getSerialPort(), 'base');
        });

        document.getElementById("readBaseEeprom").addEventListener('click', () => {
            this.readAttinyEeprom(dockPort.getSerialPort(), 'base');
        });

        document.getElementById("writeBaseEeprom").addEventListener('click', () => {
            this.updateAttiny(dockPort.getSerialPort(), 'base', 'eeprom');
        });

        document.getElementById("writeDefaultBaseEeprom").addEventListener('click', () => {
            this.updateAttiny(dockPort.getSerialPort(), 'base', 'defaultEeprom');
        });

        document.getElementById("readPenEeprom").addEventListener('click', () => {
            this.readAttinyEeprom(dockPort.getSerialPort(), 'pen');
        });

        document.getElementById("writePenEeprom").addEventListener('click', () => {
            this.updateAttiny(dockPort.getSerialPort(), 'pen', 'eeprom');
        });

        document.getElementById("writeDefaultPenEeprom").addEventListener('click', () => {
            this.updateAttiny(dockPort.getSerialPort(), 'pen', 'defaultEeprom');
        });

        document.getElementById("updatePenFirmware").addEventListener('click', () => {
            this.updateAttiny(dockPort.getSerialPort(), 'pen');
        });

        sensorPort.scanSerialPorts();
        dockPort.scanSerialPorts();

        document.getElementById("mpSensorConnectionEvent").addEventListener('change', (evt) => {
            sensorConnectionEvent = evt.target.value;
            setSetting('sensorConnectionEvent', sensorConnectionEvent);
        });

        /*
        document.getElementById("mpSensorConnectionMethod").addEventListener('change', (evt) => {
            sensorConnectionMethod = evt.target.value;
            if (sensorConnectionMethod == 'wifi') {
                document.getElementById("mpSensorAddress").style.display = "";
                document.getElementById("mpSensorUSBConnection").style.display = "none";
            }
            else {
                document.getElementById("mpSensorAddress").style.display = "none";
                document.getElementById("mpSensorUSBConnection").style.display = "";
            }
            setSetting('sensorConnectionMethod', sensorConnectionMethod);
        });
        */

        document.getElementById("mpSensorIpAddress").addEventListener('change', (evt) => {
            sensorIp = evt.target.value;
            setSetting('mpSensorIp', sensorIp);
        });

        document.getElementById("mpSensorConnect").addEventListener('click', () => {
            setData('connectMpSensor',null);
        })

        sensorConnectionEvent = await getSetting('sensorConnectionEvent');
        document.getElementById("mpSensorConnectionEvent").value = sensorConnectionEvent;
        //sensorConnectionMethod = await getSetting('sensorConnectionMethod');
        //console.log('connMethod',sensorConnectionMethod)
        //document.getElementById("mpSensorConnectionMethod").value = sensorConnectionMethod;
        sensorIp = await getSetting('mpSensorIp');
        document.getElementById("mpSensorIpAddress").value = sensorIp;
        document.getElementById("mpSensorIpAddress").style.color = 'white';
    }

    async checkPythonInstall() {
        if (this.pythonInstalled) return true;

        return new Promise((resolve) => {
            console.log("Checking for python install")

            const checkInstall = spawn(this.pythonCmd, ['-V']);
            let rec = [];
            checkInstall.stdout.on('data', function (data) {
                const str = String.fromCharCode.apply(null, new Uint16Array(data));
               // console.log('Pipe data from python',{data:str}, str.length);
                rec.push(str);
            });
            checkInstall.on('close', (code) => {
                console.log(`Python closed with code: ${code}, data:`,{data:rec});
                if (code != 0) {
                    const popupContent = `
                        <h2>Python Required</h2>
                        To configure or update the base, pen or sensor you need to install <a class="hyperlink" href="https://www.python.org/" target="_blank">Python 3.10 or 3.11</a>.<br>
                        <br>
                        Please try again after installing Python.
                    `
                    popup.open(popupContent, false, false);
                    console.log("Python not installed")
                    resolve(false);
                }
                else {
                    console.log("Python installed");
                    resolve(true);
                }
                
            });
            checkInstall.on('error', (err) => {
               // console.log('err',err);
                const popupContent = `
                    <h2>Python Required</h2>
                    To configure or update the base, pen or sensor you need to install <a class="hyperlink" href="https://www.python.org/" target="_blank">Python</a>.<br>
                    <br>
                    Please try again after installing.
                `
                popup.open(popupContent, false, false);
                resolve(false);
            });
        });
    }

    async runCommand(cmd, args) {
        return new Promise((resolve) => {
            let argsStr = `${cmd}`;
            for (let arg of args) argsStr += ` ${arg}`
            popup.addDetails(`Checking ${argsStr}\n`);
            const checkInstall = spawn(cmd, args);
            let d = [];
            checkInstall.on('close', (code) => {
                d.push(`Close: ${code}`)
                popup.addDetails(`${argsStr} => close: ${code}\n\n`);
                resolve({success:code == 0, data:d, close:code});
            });
            checkInstall.on('error', (err) => {
                d.push(`err: ${err.toString()}`);
                popup.addDetails(`${argsStr} => err: ${err.toString()}\n`);
                resolve({success:false, data:d});
            });
            checkInstall.stdout.on('data', function (data) {
                const str = String.fromCharCode.apply(null, new Uint16Array(data));
                popup.addDetails(`${argsStr} => stdout: ${str}`);
                d.push(`stdout: ${str}`);
            });
        });
    }

    async installPymcuprog() {
        this.pythonInstalled = await this.checkPythonInstall();
        if (!this.pythonInstalled) return false;

        if (this.pymcuprogInstalled && this.pipInstalled) return true;

        const pip = await this.runCommand(this.pythonCmd, ['-m', 'pip', '--version']);
        const pymcuprog = await this.runCommand(this.pythonCmd, ['-m', 'pymcuprog.pymcuprog', '-V']);
        this.pipInstalled = pip.success;
        this.pymcuprogInstalled = pymcuprog.success;

        if (this.pymcuprogInstalled && this.pipInstalled) return true;

        let parent = this;

        return new Promise((resolve) => {
            const popupContent = `
                <h2>Dependencies Required</h2>
                To configure or update the base or pen you need to install ${!this.pipInstalled ? '<a class="hyperlink" href="https://pypi.org/project/pip/" target="_blank">pip</a>' : ''} ${!this.pipInstalled && !this.pymcuprogInstalled ? 'and' : ''} ${!this.pymcuprogInstalled ? '<a class="hyperlink" href="https://github.com/microchip-pic-avr-tools/pymcuprog" target="_blank">pymcuprog</a>' : ''}.<br>
                <br>
                Press 'Ok' to install or 'Cancel' to cancel.<br>
                
                <div class="popup-form-val">
                    <button class="popupButton" id="installPymcuprog">Ok</button>
                    <button class="popupButton" id="dontInstallPymcuprog">Cancel</button>
                </div>
            `
            popup.open(popupContent, false, true);

            document.getElementById("dontInstallPymcuprog").addEventListener('click', ()=> {
                popup.close();
                resolve(false);
            });

            document.getElementById("installPymcuprog").addEventListener('click', async()=> {
                const popupContent = `
                    <h2>Installing Dependencies</h2>
                    Please wait.
                `

                popup.open(popupContent, false, true);
                popup.clearDetails();

                let pipInstall = {success: true}
                let pymcuprogInstall = {success: true}

                if (!parent.pipInstalled) {
                    popup.addDetails(`Installing pip.\n\n`);
                    pipInstall = await parent.runCommand(this.pythonCmd,['-m', 'ensurepip', '--default-pip'])
                    for (let m of pipInstall.data) popup.addDetails(`${m}\n`);
                }
                if (!parent.pymcuprogInstalled) {
                    popup.addDetails(`Installing pymcuprog.\n\n`);
                    pymcuprogInstall = await parent.runCommand(this.pythonCmd,['-m', 'pip', 'install', 'pymcuprog'])
                    for (let m of pymcuprogInstall.data) popup.addDetails(`${m}\n`);
                    if (!pymcuprogInstall.success) {
                        popup.error("Pymcuprog install failed, see 'Details' for more info.",true);
                    }
                }
                if (!pipInstall.success && !pymcuprogInstall.success) {
                    const hidapiErr = pymcuprogInstall.data.find(d => d.includes('Failed to build hidapi')) != undefined
                    popup.error(`Pip and pymcuprog install failed${hidapiErr ? ", you might have an incompatible version of Python, try uninstalling your current Python install and installing Python 3.10 or 3.11" : ""}.\nSee 'Details' for more info.`,true);
                }
                else if (!pipInstall.success) {
                    popup.error("Pip install failed, see 'Details' for more info.",true);
                }
                else if (!pymcuprogInstall.success) {
                    const hidapiErr = pymcuprogInstall.data.find(d => d.includes('Failed to build hidapi')) != undefined
                    popup.error(`Pymcuprog install failed${hidapiErr ? ", you might have an incompatible version of Python, try uninstalling your current Python install and installing Python 3.10 or 3.11" : ""}.\nSee 'Details' for more info.`,true);
                }
                else {
                    popup.content("Installation successful");
                }
            });
        });
    }

    async readAttinyEeprom(port, device) {
        if (await this.installPymcuprog() == false) return;

        console.log(`Read ${device} EEPROM on port: ${port.path}`);


        const ls = spawn(this.pythonCmd, ['-m', 'pymcuprog.pymcuprog', 'read', '-m', 'eeprom', '-t', 'uart', '-u', port.path, '-d', 'attiny1616']);

        let parent = this;
        ls.stdout.on("data", data => {
            //console.log(`stdout: ${data}`);
            const str = String.fromCharCode.apply(null, new Uint16Array(data));

            if (str.includes("Memory type: eeprom")) {
                let eepromData1 = str.split("---------------------------------------------------------")[1].split('\r\n');
                let eepromData = [];
                for (let e of eepromData1) {
                    if (e == "") continue;
                    let sub = e.split(": ")[1].split(' ');
                    for (let a of sub) {
                        if (a == "") continue;
                        eepromData.push(Number(`0x${a}`));
                    }
                }
                //console.log(eepromData)

                //if base
                if (eepromData[0] == 1 || (eepromData[0] >> 2 && device == 'base')) {
                    baseEepromData = eepromData;
                    if (device == 'pen') {
                        if (confirm("The connected device is a base, go to the base section?")) {
                            device = 'base';
                            document.getElementById('baseVer').value = `v${eepromData[1]}.${eepromData[2]}.${eepromData[3]}`;
                            document.getElementById('baseId').value = eepromData[4] << 8 | eepromData[5];
                            document.getElementById('baseSens').value = eepromData[6];
                            document.getElementById('baseTabLink').click();
                            return device;
                        }
                    }
                    document.getElementById('baseVer').value = `v${eepromData[1]}.${eepromData[2]}.${eepromData[3]}`;
                    document.getElementById('baseId').value = eepromData[4] << 8 | eepromData[5];
                    document.getElementById('baseSens').value = eepromData[6];
                }
                //if pen
                else if (eepromData[0] == 2 || (eepromData[0] >> 2 && device == 'pen')) {
                    penEepromData = eepromData;
                    if (device == 'base') {
                        if (confirm("The connected device is a pen, go to the pen section?")) {
                            device = 'pen';
                            document.getElementById('penVer').value = `v${eepromData[1]}.${eepromData[2]}.${eepromData[3]}`;
                            document.getElementById('penId').value = eepromData[4] << 8 | eepromData[5];
                            document.getElementById('penTimeout').value = eepromData[8];
                            document.getElementById('penTabLink').click();
                            return device;
                        }
                    }
                    document.getElementById('penVer').value = `v${eepromData[1]}.${eepromData[2]}.${eepromData[3]}`;
                    document.getElementById('penId').value = eepromData[4] << 8 | eepromData[5];
                    document.getElementById('penTimeout').value = eepromData[8];
                }
            }
        });
        //console.log(updateMessage)

        ls.stdout.on("data", data => {
             console.log(`stdout: ${data}`);
             const str = String.fromCharCode.apply(null, new Uint16Array(data));
            if (str.includes("UPDI initialisation failed")) {
                popup.addDetails(`Err: ${str}\n`);
                popup.error(`Could not find dock or ${device}.`, true);
                return;
            }
            if (str.includes("could not open port")) {
                popup.addDetails(`Err: ${str}\n`);
                popup.error(`Could not find dock.`, true);
                return;
            }
            else if (str.includes ('ERROR')) {
                popup.addDetails(`Err: ${str}\n`);
                popup.error(`Read failed, see 'Details' for more info.`, true);
                return;
            }
             
        });
        
        ls.stderr.on("data", data => {
            const str = String.fromCharCode.apply(null, new Uint16Array(data));
            console.log(`stderr: ${data}`);   
            popup.addDetails(`data: ${data}\n`);
        });
    
        ls.on('error', (error) => {
            console.log(`error: ${error.message}`);
           popup.addDetails(`err: ${error}\n`);
        });
    
        ls.on("close", async code => {
            console.log(`child process exited with code ${code}`);
            popup.addDetails(`close: ${code}\n`);
        });

    }

    async updateAttiny(port, device, mode='flash') {
        if (await this.installPymcuprog() == false) return;

        console.log(`Update ${device} on port: ${port.path}`);
        let firmwarePath = "";

        let popupContent = '';
        if (mode == 'flash') {
            popupContent = `
                <h3>${i18n.localize("MP.BASE_UPDATE.HEADER_FIRMWARE")}</h3>
                ${i18n.localize("MP.SENSOR_UPDATE.WAIT")}
                <div class="popupContent" id="updatePopupContent">
                    <div id="popupProgressLabel">${i18n.localize("MP.BASE_UPDATE.UPDATE_PROGRESS")}</div>
                    <div class="form-elements">
                        <progress id="baseUpdateProgress" value="0" max="100"></progress>
                        <div style="margin-left: 5px" id="baseUpdateProgressNum">0%</div>
                    </div>
                </div>
            `
        }
        else if (mode == 'eeprom' || mode == 'defaultEeprom') {
            popupContent = `
            <h3>${i18n.localize("MP.BASE_UPDATE.HEADER_EEPROM")}</h3>
            <div class="popupContent" id="updatePopupContent">
                ${i18n.localize("MP.SENSOR_UPDATE.WAIT")}
            </div>
        `
        }
        popup.open(popupContent, false, true);
        popup.clearDetails();

        popup.addDetails(`Updating ${device} ${mode == 'flash' ? 'flash' : 'configuration'} on port: ${port.path}.\n\n`);


        let ls;
        
        if (mode == 'flash') {
            let release;
            if (device == 'base') release = this.baseReleases.find(r => r.version == document.getElementById("baseVersionList").value);
            else if (device == 'pen') release = this.penReleases.find(r => r.version == document.getElementById("penVersionList").value);

            if (release == undefined) {
                return;
            }
            
            const url = release.variants[0].url;
            firmwarePath = path.join(__dirname, 'materialPlane', 'base.hex');
    
            popup.addDetails(`Downloading file.\n`)
            try {
                await this.downloadFile(url, firmwarePath);
            }
            catch (err) {
                const msg = "Could not download firmware.";
                popup.addDetails(msg + '\n');
                popup.error(msg, true);
                console.warn(msg);
                return;
            }

            ls = spawn(this.pythonCmd, ['-m', 'pymcuprog.pymcuprog', 'write', '-f', firmwarePath, '-t', 'uart', '-u', port.path, '-d', 'attiny1616', '-v', 'debug', '--verify', '--erase']);
        }
        else if (mode == 'eeprom') {
            if (device == 'base') {
                if (document.getElementById('baseId').value == '' || document.getElementById('baseSens').value == '') {
                    const msg = i18n.localize("MP.BASE_UPDATE.ERR_NO_ID");
                    popup.addDetails(msg + '\n');
                    popup.error(msg, true);
                    return;
                }
                ls = spawn(this.pythonCmd, ['-m', 'pymcuprog.pymcuprog', 'write', '-m', 'eeprom', '-o', '0x04', '-l', document.getElementById('baseId').value>>8, document.getElementById('baseId').value&0xFF,document.getElementById('baseSens').value, '-t', 'uart', '-u', port.path, '-d', 'attiny1616', '-v', 'debug']);
            }
            else if (device == 'pen') {
                if (document.getElementById('penId').value == '' || document.getElementById('penTimeout').value == '') {
                    const msg = i18n.localize("MP.PEN_UPDATE.ERR_NO_ID");
                    popup.addDetails(msg + '\n');
                    popup.error(msg, true);
                    return;
                }
                ls = spawn(this.pythonCmd, ['-m', 'pymcuprog.pymcuprog', 'write', '-m', 'eeprom', '-o', '0x04', '-l', document.getElementById('penId').value>>8, document.getElementById('penId').value&0xFF,'0xff','0xff',document.getElementById('penTimeout').value, '-t', 'uart', '-u', port.path, '-d', 'attiny1616', '-v', 'debug']);
            }
        }
        else if (mode == 'defaultEeprom') {
            ls = spawn(this.pythonCmd, ['-m', 'pymcuprog.pymcuprog', 'write', '-m', 'eeprom', '-o', '0x04', '-l', '0xff','0xff','0xff','0xff','0xff','0xff', '-t', 'uart', '-u', port.path, '-d', 'attiny1616', '-v', 'debug']);
        }
        
        
        let state = 'init';
        let flashSize;
        let dataCounter = 0;
        let percentage = -1;
        let parent = this;
        ls.stdout.on("data", data => {
           // console.log(`stdout: ${data}`);
            const str = String.fromCharCode.apply(null, new Uint16Array(data));

            if (data.includes('UPDI init OK')) {
               // console.log('UPDI init OK')
                popup.addDetails('UPDI init OK.\n');
                state = 'gettingInfo';
            }
            else if (data.includes('bytes of data to flash')) {
                state = 'writingFlash';
                flashSize = parseInt(str.split("- Writing ")[1].split(' ')[0]);
               // console.log(`Writing ${flashSize} bytes to flash.`);
                popup.addDetails(`Writing ${flashSize} bytes to flash.\n`);
            }
            else if (data.includes('Write complete')) {
               // console.log("Writing done.")
                popup.addDetails(`\nWriting Done.\n`);
                state = 'writeComplete';
            }
            else if (state == 'writingFlash' && data.includes('send')) {
                const dataToSend = str.split("send : [")[1].split("]")[0].split(", ");
                if (dataToSend.length > 4) {
                    dataCounter += dataToSend.length;
                    let perc = Math.ceil(100*dataCounter/flashSize);
                    if (perc > 100) perc = 100;
                    if (perc != percentage) {
                        percentage = perc;
                        document.getElementById("baseUpdateProgress").value = perc;
                        document.getElementById("baseUpdateProgressNum").innerHTML = perc + '%';
                        popup.addDetails(`.`);
                      //  console.log(`Writing: ${perc}%`);
                    } 
                }
            }
            else if (data.includes('bytes from flash')) {
                state = 'verifyFlash';
               // console.log("Verifying flash.");
                popup.addDetails(`Verifying flash.\n`);
                document.getElementById("popupProgressLabel").innerHTML = i18n.localize("MP.BASE_UPDATE.VERIFY_PROGRESS");
                percentage = 0;
                dataCounter = 0;
            }
            else if (state == 'verifyFlash' && data.includes('receive')) {
                const dataToReceive = str.split("receive : [")[1].split("]")[0].split(", ");
                if (dataToReceive.length > 4) {
                    dataCounter += dataToReceive.length;
                    let perc = Math.ceil(100*dataCounter/flashSize);
                    if (perc > 100) perc = 100;
                    if (perc != percentage) {
                        const diff = perc - percentage;
                        percentage = perc;
                        document.getElementById("baseUpdateProgress").value = perc;
                        document.getElementById("baseUpdateProgressNum").innerHTML = perc + '%';
                        for (let i=0; i<diff; i++) popup.addDetails(`.`);
                      //  console.log(`Verifying: ${perc}%`);
                    } 
                }
            }
            else if (state == 'verifyFlash' && data.includes('OK')) {
               // console.log("Verification done.")
                popup.addDetails(`\nVerification Done.\n`);
                state = 'verifyComplete';
            }
            else if (data.includes('Done') && ((state == 'verifyComplete' && mode == 'flash') || mode == 'eeprom' || mode == 'defaultEeprom')) {
               // console.log("Update done.")
                popup.addDetails(`\n\nUpdate Done\n`);
                state = 'done';
                document.getElementById("updatePopupContent").innerHTML = i18n.localize("MP.BASE_UPDATE.DONE");
                if (mode != 'defaultEeprom') parent.deleteFile(firmwarePath);
                else this.readAttinyEeprom(port, device);
            }
            else if (data.includes('Unable to open serial port')) {
                popup.addDetails(`\nCould not open COM port:\n`+str);
                popup.error(i18n.localize("MP.BASE_UPDATE.ERR_CONN"), true);
            }
            else if (data.includes('Operation failed')) {
                popup.addDetails(`\nUPDI initialization failed:\n`+str);
                popup.error(i18n.localize("MP.BASE_UPDATE.ERR_NO_BASE"), true);
            }
            else if (data.includes('Unexpected number of bytes in response') || (state == 'verifyFlash' && data.includes('Error with st_ptr'))) {
                popup.addDetails(`\nLost connection to base\n`+str);
                popup.error(i18n.localize("MP.BASE_UPDATE.ERR_BASE_DISCONNECT"), true);
            }
            else {
             //   console.log(`stdout: ${data}`);
            }
      
        });
        //console.log(updateMessage)
        ls.stderr.on("data", data => {
            const str = String.fromCharCode.apply(null, new Uint16Array(data));
            popup.addDetails(`stderr: ${str}\n`);
            console.log(`data: ${data}`);   
        });
    
        ls.on('error', (error) => {
            //console.log(`error: ${error.message}`);
            popup.addDetails(`err: ${error}\n`);
        });
    
        ls.on("close", async code => {
           // console.log(`child process exited with code ${code}`);
            popup.addDetails(`close: ${code}\n`);
            if (device == 'base') parent.deleteFile(firmwarePath);
        });
    }

    getIpFromHostname(hostname) {
        return new Promise((resolve) => {
            dns.lookup(hostname, (err, address, family) => {
                if (err) resolve({err})
                else resolve ({address})
            })
        })
    }

    getFileStats(path) {
        return new Promise((resolve) => {
            fs.stat(path, (err, stats) => {
                if (err) resolve ({err});
                else resolve(stats)
            })
        })
    }

    async updateSensor(sensorPort) {
        if (await this.checkPythonInstall() == false) return;

        const port = sensorPort.getSerialPort();
        const updateAddress = document.getElementById("mpUpdateAddress").value;
        const updateMethod = document.getElementById("sensorUploadMethod").value;
        let updateIp;
     
        if (updateMethod == "USB")
            console.log(`Update sensor using USB on port: ${port.path}`);
        else if (updateMethod == "WiFi_Firmware")
            console.log(`Update sensor firmware over WiFi on address: ${updateAddress}`);
        else if (updateMethod == "WiFi_Webserver")
            console.log(`Update sensor webserver over WiFi on address: ${updateAddress}`);

        let parent = this;

        const popupContent = `
            <h3>${i18n.localize("MP.SENSOR_UPDATE.HEADER_FIRMWARE")}</h3>
            <div class="popupContent" id="updatePopupContent">
                ${i18n.localize("MP.SENSOR_UPDATE.PROGRESS")}
                <div class="form-elements">
                    <progress id="sensorUpdateProgress" value="0" max="100"></progress>
                    <div style="margin-left: 5px" id="sensorUpdateProgressNum">0%</div>
                </div>
            </div>
        `
        popup.open(popupContent, false, true);
        popup.clearDetails();

        if (document.getElementById("sensorVersionList").value == 'none' && document.getElementById("sensorWsVersionList").value == 'none') {
            popup.content(`No firmware or webserver selected.\n\n`);
            return;
        }

        const firmwareRelease = this.sensorVariantReleases.find(r => r.name == document.getElementById("sensorVersionList").value);
        const webserverRelease = this.webserverReleases.find(r => r.name == document.getElementById("sensorWsVersionList").value);

        if (updateMethod == "USB") popup.addDetails(`Update sensor ${firmwareRelease != undefined && webserverRelease != undefined ? 'firmware & webserver' : firmwareRelease != undefined ? 'firmware' : 'webserver'} on port: ${port.path}.\n\n`);
        else if (updateMethod == "WiFi_Firmware") popup.addDetails(`Update sensor firmware over WiFi to: ${updateAddress}.\n\n`);
        else if (updateMethod == "WiFi_Webserver") popup.addDetails(`Update sensor webserver over WiFi to: ${updateAddress}.\n\n`);
        

        let err = false;
        let errMsg = "";
        if (updateMethod == "USB") {
            if (port == undefined) {
                err = true;
                errMsg = i18n.localize("MP.SENSOR_UPDATE.ERR_COM");
            }
            else if (port.name == "Sensor") {
                err = true;
                errMsg = i18n.localize("MP.SENSOR_UPDATE.ERR_UPDATEMODE");
            }
            else if (firmwareRelease == undefined && webserverRelease == undefined) {
                err = true;
                errMsg = i18n.localize("MP.SENSOR_UPDATE.ERR_FILE");
            }
        }
        else {
            const resolvedHostname = await this.getIpFromHostname(updateAddress);
            updateIp = resolvedHostname.address;
            if (resolvedHostname.err != undefined) {
                err = true;
                errMsg = i18n.localize("MP.SENSOR_UPDATE.ERR_IP");
            }
            if (updateAddress == undefined || updateAddress == "") {
                err = true;
                errMsg = i18n.localize("MP.SENSOR_UPDATE.ERR_ADDR");
            }
            else if ((updateMethod == "WiFi_Firmware" && firmwareRelease == undefined) || (updateMethod == "WiFi_Webserver" && webserverRelease == undefined)) {
                err = true;
                errMsg = i18n.localize("MP.SENSOR_UPDATE.ERR_FILE");
            }
        }
        
        if (err) {
           // console.warn(errMsg);
            popup.error(errMsg, true);
            popup.addDetails(errMsg);
            return;
        }
        else if (updateIp != undefined) {
            popup.addDetails(`Resolved IP '${updateIp}' from sensor address.\n`)
        }

        let folder = path.join(__dirname, 'materialPlane', 'firmware');
        const esptoolPath = path.join(__dirname, 'materialPlane', 'esptool', 'esptool.py');
        const espotaPath = path.join(__dirname, 'materialPlane', 'espota.py');
        let zipPath = path.join(folder, 'firmware.zip');
        let webserverPath = path.join(folder, 'webserver.bin');
        let firmwarePath, bootloaderPath, app0Path, partitionsPath;

        fs.mkdir(folder,function(e){
            if(!e || (e && e.code === 'EEXIST')){
                //do something with contents
            } else {
                //debug
                console.log(e);
            }
        });

        let cmd = [];
        if (updateMethod == "USB")
            cmd.push(esptoolPath, '--after', 'hard_reset', '--chip', firmwareRelease.chip, '-p', port.path, 'write_flash', '-z');
        else
            cmd.push(espotaPath, '-i', updateIp, '-p', '3232');

        if (updateMethod != "WiFi_Webserver" && firmwareRelease != undefined) {
 
            popup.addDetails(`Downloading firmware file.\n`)
            
            try {
                await this.downloadFile(firmwareRelease.url, zipPath);

                popup.addDetails(`Unzipping files.\n`)

                try {
                    await decompress(zipPath,folder).then((files) => {
                        const partitionTableFile = files.find(f => f.path.includes('artitionTable'));
                        const partitionTable = JSON.parse(partitionTableFile.data.toString());
                        if (updateMethod == "USB") {
                            for (let p of partitionTable) {
                                cmd.push(p.address, path.join(folder, p.src));
                            }
                        }
                        else {
                            const firmwareFile = partitionTable.find(p => p.label == 'firmware');
                            cmd.push('-f', path.join(folder,firmwareFile.src));
                        }
                    })
                }
                catch (err) {
                    const msg = "Could not unzip firmware file.";
                    popup.addDetails(msg + '\n');
                    popup.error(msg, true);
                    console.err(err);
                    return;
                }
            }
            catch (err) {
                const msg = "Could not download firmware.";
                popup.addDetails(msg + '\n');
                popup.error(msg, true);
              //  console.warn(msg);
                return;
            }
        }

        if (updateMethod != "WiFi_Firmware" && webserverRelease != undefined) {
            if (updateMethod == "USB")
                cmd.push('0x290000',webserverPath)
            else 
                cmd.push('-s', '-f' ,webserverPath)
            popup.addDetails(`Downloading webserver file.\n`)

            try {
                await this.downloadFile(webserverRelease.url, webserverPath);
            }
            catch (err) {
                const msg = "Could not download webserver.";
                popup.addDetails(msg + '\n');
                popup.error(msg, true);
                //console.warn(msg);
                return;
            }
        }

        console.log('cmd',cmd)
        console.log('test',cmd.slice(-1)[0])
        let fileSize = 0;
        if (updateMethod != "USB") {
            const fileStats = await this.getFileStats(cmd.slice(-1)[0]);
            fileSize = fileStats.size/1000;
        }
            
        
        let dataToSend;
        console.log(`Uploading data to sensor`);
        popup.addDetails(`Uploading data to sensor.\n`);
     
        const python = spawn(this.pythonCmd, cmd);
        
        python.stdout.on('data', function (data) {
            dataToSend = data.toString();
            const str = String.fromCharCode.apply(null, new Uint16Array(data));
            console.log('Pipe data from esptool',{data:str});
            
            popup.addDetails(str);

            let perc = parseInt(str.split('(')[1]?.split(' ')[0]);

            if (str.includes('Leaving')) {
                document.getElementById("updatePopupContent").innerHTML = i18n.localize("MP.SENSOR_UPDATE.DONE");
            }
            if (!isNaN(perc) && perc >=0 && perc <= 100) {
                if (perc == 100) perc = 99;
                document.getElementById("sensorUpdateProgress").value=perc;
                document.getElementById("sensorUpdateProgressNum").innerHTML=perc+'%';
            }
            else if (str.includes('Failed to connect')) {
                popup.error(i18n.localize("MP.SENSOR_UPDATE.ERR_CONN"));
            }
            
        });

        let updateCounter = 0;
        let updatePercentage = -1;
        let updateStarted = false;
        python.stderr.on("data", data => {
            if (updateMethod != "USB" && data == 'Uploading.') {
                updateStarted = true;
            }
            if (updateStarted && updateMethod != "USB" && data == '.') {
                updateCounter++;
                const perc = Math.ceil(100*updateCounter/fileSize);
                if (perc != updatePercentage) {
                    updatePercentage = perc;
                    console.log(`Uploading: ${perc}%`);
                    popup.addDetails(`${perc}%, `);
                    document.getElementById("sensorUpdateProgress").value=perc;
                    document.getElementById("sensorUpdateProgressNum").innerHTML=perc+'%';
                }
            }
            else {
                console.log(`stderr: ${data}`);   
                popup.addDetails(`stderr: ${data}\n`);
            }
        });
        
        python.on('close', (code) => {
            console.log(`Esptool closed with code: ${code}, data:`,{data:dataToSend});
            if (code == 2 && dataToSend.includes('--chip argument')) {
                popup.error(i18n.localize("MP.SENSOR_UPDATE.ERR_CHIP"), true); 
            }
            else if (updateMethod != "USB" && code == 0) {
                document.getElementById("sensorUpdateProgress").value=100;
                    document.getElementById("sensorUpdateProgressNum").innerHTML='100%';
                document.getElementById("updatePopupContent").innerHTML = i18n.localize("MP.SENSOR_UPDATE.DONEOTA");
            }
            else if (updateMethod != "USB" && code == 1) {
                popup.error(i18n.localize("MP.SENSOR_UPDATE.ERR_OTA_CONN"), true); 
            }
            else if (code != 0) {
                popup.error(i18n.localize("MP.SENSOR_UPDATE.ERR"), true);
            }
            popup.addDetails(`Closed: ${code}`);
            fs.rmSync(folder, { recursive: true, force: true });
        });

        python.on('error', (err) => {
            popup.error(i18n.localize("MP.SENSOR_UPDATE.ERR"), true);
            popup.addDetails(err);
        })
        return;
        

        

        /*
        console.log('files',this.files)
        for (let file of this.files) {
            this.deleteFile(path.join(folder, file.path))
        }
        this.deleteFile(zipPath);
        */
    }

    async deleteFile(url) {
        fs.unlink(url, (err)=>{if (err) console.log(err)})
    }

    async downloadFile (url, targetFile) { 
        return await new Promise((resolve, reject) => {
          https.get(url, response => {
            const code = response.statusCode ?? 0
            if (code >= 400) {
                return reject("Error: not found")
            }
      
            // handle redirects
            if (code > 300 && code < 400 && !!response.headers.location) {
                const msg = `Download redirected to: '${response.headers.location}'`;
                //console.log(msg)

                return resolve(
                    this.downloadFile(response.headers.location, targetFile)
                )
            }

            const msg = `Downloading file from: '${url}' to: '${targetFile}'`;
            //console.log(msg)
            //popup.addDetails('Downloading file\n');
      
            // save the file to disk
            const fileWriter = fs
              .createWriteStream(targetFile)
              .on('finish', () => {
               // console.log('Download done')
                popup.addDetails('Download done.\n');
                resolve({})
              })
      
            response.pipe(fileWriter)
          }).on('error', error => {
            reject(error)
          })
        })
      }


    async updateSensorFirmwareList() {
        const selectedVariant = document.getElementById("sensorVariantUpload").value;
        
        this.sensorVariantReleases = this.sensorReleases.filter(r => r.variant == selectedVariant);
        this.sensorVariantReleases.sort(function(a, b){
            if (a.name < b.name) return 1;
            if (a.name > b.name) return -1;
            return 0;
        });

        const includePreReleases = await getSetting('mpSensorPreReleases');
     
        let elmnt = document.getElementById("sensorVersionList");
        elmnt.innerHTML = "";
        for (let r of this.sensorVariantReleases) {

            if (!includePreReleases && r.prerelease) continue;
            
            const prerelease = r.prerelease ? " (Pre-Release)" : "";
            elmnt.add(new Option(r.name+prerelease,r.name)); 
        }
        elmnt.add(new Option('None','none'));

        const webserverReleases = this.webserverReleases;
        webserverReleases.sort(function(a, b){
            if (a.name < b.name) return 1;
            if (a.name > b.name) return -1;
            return 0;
        });
        elmnt = document.getElementById("sensorWsVersionList");
        elmnt.innerHTML = "";
        for (let r of webserverReleases) {
            if (!includePreReleases && r.prerelease) {
                //console.log('prerelease',r)
                continue;
            }
            const prerelease = r.prerelease ? " (Pre-Release)" : "";
            elmnt.add(new Option(r.name+prerelease,r.name)); 
        }
        elmnt.add(new Option('None','none'));
    }

    updateSensorVariants(newVariant) {
        this.sensorVariants.push(newVariant);
        let elmnt = document.getElementById("sensorVariantUpload");
        elmnt.add(new Option(newVariant,newVariant));
    }
    
    async getReleases() {
        let parent = this;
        
        //Sensor releases
        $.getJSON(sensorUrl).done(function(releases) {
            for (let release of releases) {
                if (release.name.includes("ebserver")) {
                    parent.webserverReleases.push({
                        name: release.name,
                        url: release.assets[0].browser_download_url,
                        prerelease: release.prerelease
                    })
                    continue;
                }

                const variantsFile = release.assets.find(r => r.name == 'variants.json');
                if (variantsFile == undefined) continue;

                fetch(variantsFile.browser_download_url)
                    .then((response) => response.json())
                    .then(function(json) {
                        for (let r of json) {
                            if (parent.sensorVariants.filter(v => v == r.label).length == 0)
                                parent.updateSensorVariants(r.label);
                            
                            parent.sensorReleases.push({
                                name: release.name,
                                variant: r.label,
                                url: release.assets.find(a => a.name == r.src).browser_download_url,
                                prerelease: release.prerelease,
                                chip: r.chip
                            })
                        }
                        parent.updateSensorFirmwareList();
                    });
            }
        });

        //Base releases
        $.getJSON(baseUrl).done(function(releases) {
            for (let release of releases) {
                if (release.draft) continue;
                let variants = [];
                for (let asset of release.assets) {
                    let variant;
                    variants.push({
                        variant,
                        url: asset.browser_download_url
                    })
                }
                if (variants.length == 0) continue;
                parent.baseReleases.push({
                    version: release.name,
                    variants
                })
            }
  
            let elmnt = document.getElementById("baseVersionList");
            for (let r of parent.baseReleases) {
                let newOption = new Option(r.version,r.version);
                elmnt.add(newOption, undefined);
            }
        });

        //Pen releases
        $.getJSON(penUrl).done(function(releases) {
            for (let release of releases) {
                if (release.draft) continue;
                let variants = [];
                for (let asset of release.assets) {
                    let variant;
                    variants.push({
                        variant,
                        url: asset.browser_download_url
                    })
                }
                if (variants.length == 0) continue;
                parent.penReleases.push({
                    version: release.name,
                    variants
                })
            }

            let elmnt = document.getElementById("penVersionList");
            for (let r of parent.penReleases) {
                let newOption = new Option(r.version,r.version);
                elmnt.add(newOption, undefined);
            }
        })
    }
}

const eepromStart = [
    [0x10, 0x14, 0x00, 0x00],
    [0x10, 0x14, 0x10, 0x00],
    [0x10, 0x14, 0x20, 0x00],
    [0x10, 0x14, 0x30, 0x00],
    [0x10, 0x14, 0x40, 0x00],
    [0x10, 0x14, 0x50, 0x00],
    [0x10, 0x14, 0x60, 0x00],
    [0x10, 0x14, 0x70, 0x00],
    [0x10, 0x14, 0x80, 0x00],
    [0x10, 0x14, 0x90, 0x00],
    [0x10, 0x14, 0xA0, 0x00],
    [0x10, 0x14, 0xB0, 0x00],
    [0x10, 0x14, 0xC0, 0x00],
    [0x10, 0x14, 0xD0, 0x00],
    [0x10, 0x14, 0xE0, 0x00],
    [0x10, 0x14, 0xF0, 0x00]
]
 

async function writeEepromFile(eepromData) {

    let str = '';
    let counter = 0;
    for (let line = 0; line < 16; line++) {
        let newLine = ':';
        let checkSumBytes = [];
        for (let i=0; i<4; i++) {
            checkSumBytes[i] = eepromStart[line][i];
            newLine += intToHexString(eepromStart[line][i]);
        }

        for (let v = 0; v<16; v++) {
            newLine += intToHexString(eepromData[counter]);
            checkSumBytes.push(eepromData[counter]);
            counter++;
        }
        const calculatedCheckSum = intToHexString((-checkSumBytes.reduce((sum, v)=>sum + v, 0)) & 0xFF);
        newLine += calculatedCheckSum + '\r\n';
        str += newLine;
    }
    str += ":00000001FF"
   
    try {
        return await fsPromises.writeFile(path.join(__dirname, 'materialPlane', 'eeprom.hex'), str, 'utf8');
    } catch (err) {
        console.log('err',err);
    }
}

function intToHexString(val) {
    let str = val.toString(16);
    if (str.length == 1) str = '0' + str;
    return str;
}

module.exports = { MaterialPlane, updateSensorData };
