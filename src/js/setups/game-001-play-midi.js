var laserConfig = require('../LaserApiConfig.js').default
var Tone = require('tone')
var playTones = {}

var synths = []
for (var i = 0; i < laserConfig.gridResolution * laserConfig.gridResolution; i++) {

    synths[i] = new Tone.Synth(  ).toMaster();
}

const handler = (grid) => {

    for (var i = 0; i < grid.length; i++) {

        if (grid[i] > 0) {

            if (playTones[i]) {

             //   playTones[i]()

            } else {

                playTones[i] = true
                synths[i].triggerAttack(10+i*5);
            }

        } else {
            playTones[i] = false

            synths[i].triggerRelease();
        }

    }

}

export default {

    handle: (grid) => {
        handler(grid)
    }

}
