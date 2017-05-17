
var laserConfig = require('../LaserApiConfig.js').default
var Tone = require('tone')
var playTones = {}

var synths = []
for (var i = 0; i < laserConfig.gridResolution * laserConfig.gridResolution; i++) {

    synths[i] = new Tone.Synth().toMaster();
}

const makeBingFunction = (index) => {

    var lastDate = performance.now()
    var triggered = false;
    return () => {
        var currentDate = performance.now()
        if (currentDate - lastDate < 100) {
            //     return
        }
        if (triggered) {
            console.log('retunr')
            return
        }
        triggered = true;
        lastDate = currentDate
        // pitch time velocity
        synths[index].triggerAttackRelease(index * 7, .2);
    }

}

const handler = (grid) => {

    for (var i = 0; i < grid.length; i++) {

        if (grid[i] > 0) {

            if (playTones[i]) {

                playTones[i]()

            } else {

                playTones[i] = makeBingFunction(i)
                playTones[i]()
            }

        } else {
            playTones[i] = null
        }

    }

}

export default {

    handle: (grid) => {
        handler(grid)
    }

}
