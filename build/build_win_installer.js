const { MSICreator } = require('electron-wix-msi');
const path = require('path');

//App directory
const APP_DIR = path.resolve(__dirname, './dist','win-unpacked')

//Output directory
const OUT_DIR = path.resolve(__dirname, './dist', 'windows_installer')

const ICON_DIR = path.resolve(__dirname, './src', 'app', 'images','icons.ico')
const BACKGROUND_DIR = path.resolve(__dirname, './src', 'app', 'images','installer_background.jpg')

console.log('appdir',APP_DIR)

// Step 1: Instantiate the MSICreator
const msiCreator = new MSICreator({
    appDirectory: APP_DIR,
    description: 'Companion app for the Material Foundry modules and hardware',
    exe: 'Material Companion.exe',
    name: 'Material Companion',
    shortName: 'MaterialCompanion',
    manufacturer: 'Material Foundry',
    version: '1.0.0',
    icon: ICON_DIR,
    outputDirectory: OUT_DIR,
    ui: {
        chooseDirectory: true,
        images: {
            background: BACKGROUND_DIR
        }
    }
});

// Step 2: Create a .wxs template file
msiCreator.create().then(function(){
    msiCreator.compile();
})