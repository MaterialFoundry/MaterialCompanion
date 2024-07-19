
You can either run Material Companion from one of the prebuilt packages, or build the application yourself.

## Installing/Running Material Companion:

1. Download the latest version from the [releases](https://github.com/MaterialFoundry/MaterialCompanion/releases) page:
    * Windows: MaterialCompanion-win32-x64.zip
    * MacOS (Intel): MaterialCompanion-macos-x64.zip or MaterialCompanion-macos-x64.dmg
    * MacOS (Arm): MaterialCompanion-macos-arm64.zip or MaterialCompanion-macos-arm64.dmg
    * Linux: MaterialCompanion-linux-x64.zip
2. Extract the file (if it's a .zip)
3. Run `Material Companion.exe` (Windows) or `Material Companion` (MacOS/Linux) from within the folder, or open the .dmg file and drag `Material Companion` to the applications folder (MacOS)
4. Material Plane users that want to use Material Compaion to update the Material Plane hardware you will need to install [Python v3](https://www.python.org/downloads/).

<b>Some notes for MacOS users</b><br>
On MacOS you will probably get a message that it can't be opened because the developer cannot be verified. To solve this:

1. Open 'System Preferences'
2. Navigate to 'Security & Privacy
3. Unlock the page using the lock in the lower left
4. There should be a message: `"Material Companion" was blocked from use because it is not from an identified developer', press 'Open Anyway' to the right of that message
5. You might get another message to confirm that you want to open it: click 'Open'

<b>Connection issues with some browsers</b><br>
Some browsers, such as Brave, have a built-in adblocker that may prevent Foundry from connecting to Material Companion. If you run into connection issues, try disabling the adblocker (in brave: press the lion icon, and set the shields to 'down'), or use another browser like Chrome or Firefox.

## Running/Building from the source
If you want to make modifications, or you can't get the prebuild apps to work, you can try running or building the app from the source.

<b>Prerequisites</b><br>
You will need to install/configure the following applications:

* Windows
    * [node.js](https://nodejs.org/en/download/prebuilt-installer)
    * [Python v3](https://www.python.org/downloads/)
    * [Microsoft Visual C++](https://www.microsoft.com/en-US/Download/confirmation.aspx?id=48145)

* MacOS
    * [node.js](https://nodejs.org/en/download/prebuilt-installer)
    * [Python v3](https://www.python.org/downloads/)
    * [Xcode](https://developer.apple.com/xcode/) or Command Line Tools

* Linux
    * [node.js](https://nodejs.org/en/download/prebuilt-installer)
    * [Python v3](https://www.python.org/downloads/)
    * A C++ compiler
    * Installed and configured [ALSA](https://alsa.opensrc.org/Quick_Install)
    * The libasound2-dev and build-essential packages

<b>Running from the source</b>

1. [Download](https://github.com/MaterialFoundry/MaterialCompanion/releases) and unzip the source code
2. Open a termial window and navigate to the Material Companion folder
3. Run `npm update` and then `npm install` to update existing dependencies and install new dependencies
4. Run `npm start` to start the app

<b>Building from the source</b>

1. Make sure the app runs using the instructions above
2. Run `npm run package` to build the app
3. The apps should be built in `/out/Material Companion-[platform]`