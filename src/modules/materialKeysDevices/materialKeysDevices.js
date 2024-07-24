const LaunchpadMiniMk3 = require('./launchpadMiniMk3.js').LaunchpadMiniMk3
const LaunchpadMk2 = require('./launchpadMk2.js').LaunchpadMk2
const LaunchpadProMk3 = require('./launchpadProMk3.js').LaunchpadProMk3
const LaunchpadX = require('./launchpadX.js').LaunchpadX

const protocols = [
    {
        name: "Launchpad Mini Mk3",
        protocol: new LaunchpadMiniMk3()
    },{
        name: "Launchpad Mk2",
        protocol: new LaunchpadMk2()
    },{
        name: "Launchpad Pro Mk3",
        protocol: new LaunchpadProMk3()
    },{
        name: "Launchpad X",
        protocol: new LaunchpadX()
    }
]; 

module.exports = { protocols };