const path = require('path');
const { spawn } = require("child_process");
const fs = require('fs');
const fsPromises = require('fs').promises;
const {openPopup, closePopup } = require("../misc.js")
const axios = require('axios');

const https = require('https'); // or 'https' for https:// URLs

const sensorUrl = "https://api.github.com/repos/MaterialFoundry/MaterialPlane_Sensor/releases";
const penUrl = "https://api.github.com/repos/MaterialFoundry/MaterialPlane_Pen/releases";
const baseUrl = "https://api.github.com/repos/MaterialFoundry/MaterialPlane_Base/releases";

let popup;
let baseEepromData = [];
let penEepromData = [];

class MaterialPlane {
    constructor(pUp) {
        popup = pUp;
    }
    
    sensorReleases = [];
    baseReleases = [];
    penReleases = [];

    init(sensorPort, dockPort) {
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
            document.getElementById("sensorWebserver").innerHTML = "[placeholder]";
            document.getElementById("sensorWiFiConnected").checked = false;
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
        document.getElementById("updateSensorFirmware").addEventListener('click', () => {
            this.updateSensor(sensorPort.getSerialPort());
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
    }

    async readAttinyEeprom(port, device) {
        console.log(`Read ${device} EEPROM on port: ${port.path}`);


        const ls = spawn('pymcuprog', ['read', '-m', 'eeprom', '-t', 'uart', '-u', port.path, '-d', 'attiny1616']);

        let parent = this;
        ls.stdout.on("data", data => {
            console.log(`stdout: ${data}`);
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
        ls.stderr.on("data", data => {
            const str = String.fromCharCode.apply(null, new Uint16Array(data));
            console.log(`stderr: ${data}`);   
        });
    
        ls.on('error', (error) => {
            console.log(`error: ${error.message}`);
        });
    
        ls.on("close", async code => {
            console.log(`child process exited with code ${code}`);
        });

    }
    async updateAttiny(port, device, mode='flash') {
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

            ls = spawn('pymcuprog', ['write', '-f', firmwarePath, '-t', 'uart', '-u', port.path, '-d', 'attiny1616', '-v', 'debug', '--verify', '--erase']);
        }
        else if (mode == 'eeprom') {
            if (device == 'base') {
                if (document.getElementById('baseId').value == '' || document.getElementById('baseSens').value == '') {
                    const msg = i18n.localize("MP.BASE_UPDATE.ERR_NO_ID");
                    popup.addDetails(msg + '\n');
                    popup.error(msg, true);
                    return;
                }
                ls = spawn('pymcuprog', ['write', '-m', 'eeprom', '-o', '0x04', '-l', document.getElementById('baseId').value>>8, document.getElementById('baseId').value&0xFF,document.getElementById('baseSens').value, '-t', 'uart', '-u', port.path, '-d', 'attiny1616', '-v', 'debug']);
            }
            else if (device == 'pen') {
                if (document.getElementById('penId').value == '' || document.getElementById('penTimeout').value == '') {
                    const msg = i18n.localize("MP.PEN_UPDATE.ERR_NO_ID");
                    popup.addDetails(msg + '\n');
                    popup.error(msg, true);
                    return;
                }
                ls = spawn('pymcuprog', ['write', '-m', 'eeprom', '-o', '0x04', '-l', document.getElementById('penId').value>>8, document.getElementById('penId').value&0xFF,'0xff','0xff',document.getElementById('penTimeout').value, '-t', 'uart', '-u', port.path, '-d', 'attiny1616', '-v', 'debug']);
            }
        }
        else if (mode == 'defaultEeprom') {
            ls = spawn('pymcuprog', ['write', '-m', 'eeprom', '-o', '0x04', '-l', '0xff','0xff','0xff','0xff','0xff','0xff', '-t', 'uart', '-u', port.path, '-d', 'attiny1616', '-v', 'debug']);
        }
        
        
        let state = 'init';
        let flashSize;
        let dataCounter = 0;
        let percentage = -1;
        let parent = this;
        ls.stdout.on("data", data => {
            console.log(`stdout: ${data}`);
            const str = String.fromCharCode.apply(null, new Uint16Array(data));

            if (data.includes('UPDI init OK')) {
                console.log('UPDI init OK')
                popup.addDetails('UPDI init OK.\n');
                state = 'gettingInfo';
            }
            else if (data.includes('bytes of data to flash')) {
                state = 'writingFlash';
                flashSize = parseInt(str.split("- Writing ")[1].split(' ')[0]);
                console.log(`Writing ${flashSize} bytes to flash.`);
                popup.addDetails(`Writing ${flashSize} bytes to flash.\n`);
            }
            else if (data.includes('Write complete')) {
                console.log("Writing done.")
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
                        console.log(`Writing: ${perc}%`);
                    } 
                }
            }
            else if (data.includes('bytes from flash')) {
                state = 'verifyFlash';
                console.log("Verifying flash.");
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
                        console.log(`Verifying: ${perc}%`);
                    } 
                }
            }
            else if (state == 'verifyFlash' && data.includes('OK')) {
                console.log("Verification done.")
                popup.addDetails(`\nVerification Done.\n`);
                state = 'verifyComplete';
            }
            else if (data.includes('Done') && ((state == 'verifyComplete' && mode == 'flash') || mode == 'eeprom' || mode == 'defaultEeprom')) {
                console.log("Update done.")
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
            console.log(`stderr: ${data}`);   
        });
    
        ls.on('error', (error) => {
            console.log(`error: ${error.message}`);
        });
    
        ls.on("close", async code => {
            console.log(`child process exited with code ${code}`);
            if (device == 'base') parent.deleteFile(firmwarePath);
        });
    }

    async updateSensor(port) {
        console.log(`Update sensor on port: ${port.path}`);

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

        const hardwareVariant = document.getElementById("sensorVariantUpload").value;
        if (document.getElementById("sensorVersionList").value == 'none' && document.getElementById("sensorWsVersionList").value == 'none') {
            popup.content(`No firmware or webserver selected.\n\n`);
            return;
        }
        const firmwareRelease = this.sensorReleases.find(r => r.version == document.getElementById("sensorVersionList").value);
        const webserverRelease = this.sensorReleases.find(r => r.version == document.getElementById("sensorWsVersionList").value);

        popup.addDetails(`Update sensor ${firmwareRelease != undefined && webserverRelease != undefined ? 'firmware & webserver' : firmwareRelease != undefined ? 'firmware' : 'webserver'} on port: ${port.path}.\n\n`);

        let err = false;
        let errMsg = "";
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
        if (err) {
            console.warn(errMsg);
            popup.error(errMsg, true);
            popup.addDetails(errMsg);
            return;
        }

        const esptoolPath = path.join(__dirname, 'materialPlane', 'esptool', 'esptool.py');
        let firmwarePath = path.join(__dirname, 'materialPlane', 'firmware.bin');
        let bootloaderPath = path.join(__dirname, 'materialPlane', 'bootloader.bin');
        let app0Path = path.join(__dirname, 'materialPlane', 'boot_app0.bin');
        let partitionsPath = path.join(__dirname, 'materialPlane', 'partitions.bin');
        let webserverPath = path.join(__dirname, 'materialPlane', 'webserver.bin');

        let cmd = [esptoolPath, '--chip', hardwareVariant=='Production' ? 'esp32s3' : 'esp32', '-p', port.path, 'write_flash', '-z'];

        if (firmwareRelease != undefined) {
            cmd.push('0x0',bootloaderPath,'0x8000',partitionsPath,'0xe000',app0Path,'0x10000',firmwarePath)
            popup.addDetails(`Downloading firmware file.\n`)
            try {
                await this.downloadFile(firmwareRelease.variants.find(r=> r.type == 'firmware').url, firmwarePath);
            }
            catch (err) {
                const msg = "Could not download firmware.";
                popup.addDetails(msg + '\n');
                popup.error(msg, true);
                console.warn(msg);
                return;
            }

            popup.addDetails(`Downloading bootloader file.\n`)
            try {
                await this.downloadFile(firmwareRelease.variants.find(r=> r.type == 'bootloader').url, bootloaderPath);
            }
            catch (err) {
                const msg = "Could not download bootloader.";
                popup.addDetails(msg);
                popup.error(msg, true);
                console.warn(msg);
                return;
            }

            popup.addDetails(`Downloading boot_app0 file.\n`)
            try {
                await this.downloadFile(firmwareRelease.variants.find(r=> r.type == 'boot_app0').url, app0Path);
            }
            catch (err) {
                const msg = "Could not download boot_app0.";
                popup.addDetails(msg + '\n');
                popup.error(msg, true);
                console.warn(msg);
                return;
            }

            popup.addDetails(`Downloading partitions file.\n`)
            try {
                await this.downloadFile(firmwareRelease.variants.find(r=> r.type == 'partitions').url, partitionsPath);
            }
            catch (err) {
                const msg = "Could not download partitions.";
                popup.addDetails(msg + '\n');
                popup.error(msg, true);
                console.warn(msg);
                return;
            }
        }

        if (webserverRelease != undefined) {
            cmd.push('0x290000',webserverPath)
            popup.addDetails(`Downloading webserver file.\n`)

            try {
                await this.downloadFile(webserverRelease.variants[0].url, webserverPath);
            }
            catch (err) {
                const msg = "Could not download webserver.";
                popup.addDetails(msg + '\n');
                popup.error(msg, true);
                console.warn(msg);
                return;
            }
        }
        
        
        let dataToSend;
        console.log(`Uploading data to sensor`);
        popup.addDetails(`Uploading data to sensor.\n`);
     
        const python = spawn('python', cmd);
        
        python.stdout.on('data', function (data) {
            dataToSend = data.toString();
            const str = String.fromCharCode.apply(null, new Uint16Array(data));
            console.log('Pipe data from esptool',{data:str});
            
            popup.addDetails(str);

            let perc = parseInt(str.split('(')[1]?.split(' ')[0]);

            if (str.includes('Leaving')) {
                document.getElementById("updatePopupContent").innerHTML = i18n.localize("MP.SENSOR_UPDATE.DONE");
                //if (mode == 'webserver') perc = 100;
                //if (firmwareRelease != undefined) {
                    
                //}
                
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
        
        python.on('close', (code) => {
            console.log(`Esptool closed with code: ${code}, data:`,{data:dataToSend});
            if (code != 0) {
                popup.error(i18n.localize("MP.SENSOR_UPDATE.ERR"));
            }
            parent.deleteFile(firmwarePath);
            parent.deleteFile(bootloaderPath);
            parent.deleteFile(app0Path);
            parent.deleteFile(partitionsPath);
            parent.deleteFile(webserverPath);
        });
        return;
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
                console.log(msg)

                return resolve(
                    this.downloadFile(response.headers.location, targetFile)
                )
            }

            const msg = `Downloading file from: '${url}' to: '${targetFile}'`;
            console.log(msg)
            //popup.addDetails('Downloading file\n');
      
            // save the file to disk
            const fileWriter = fs
              .createWriteStream(targetFile)
              .on('finish', () => {
                console.log('Download done')
                popup.addDetails('Download done.\n');
                resolve({})
              })
      
            response.pipe(fileWriter)
          }).on('error', error => {
            reject(error)
          })
        })
      }

    async getReleases() {
        let parent = this;
        
        //Sensor releases
        $.getJSON(sensorUrl).done(function(releases) {
            for (let release of releases) {
                if (release.draft) continue;
                let variants = [];
                for (let asset of release.assets) {
                    let variant;
                    let type;

                    if (asset.name.includes("Production")) variant = "Production";
                    else if (asset.name.includes("DIY")) variant = "DIY";
                    else if (asset.name.includes("Webserver")) variant = "Webserver";

                    if (asset.name.includes("Firmware")) type = 'firmware';
                    else if (asset.name.includes("Bootloader")) type = 'bootloader';
                    else if (asset.name.includes("boot_app0")) type = 'boot_app0';
                    else if (asset.name.includes("Partitions")) type = 'partitions';

                    variants.push({
                        variant,
                        type,
                        url: asset.browser_download_url
                    })
                }
                if (variants.length == 0) continue;
                parent.sensorReleases.push({
                    version: release.name,
                    variants
                })
            }

            let elmnt = document.getElementById("sensorVersionList");
            for (let r of parent.sensorReleases.filter(r => r.version.includes('Firmware'))) {
                elmnt.add(new Option(r.version,r.version), undefined);
            }
            elmnt.add(new Option('None','none'), undefined);

            let elmntWs = document.getElementById("sensorWsVersionList");
            for (let r of parent.sensorReleases.filter(r => r.version.includes('Webserver'))) {
                elmntWs.add(new Option(r.version,r.version), undefined);
            }
            elmntWs.add(new Option('None','none'), undefined);
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

module.exports = { MaterialPlane };