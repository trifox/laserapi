var laserConfig = require('../LaserApiConfig.js').default
var Tone = require('tone')
var playTones = {}

var synths = []

var lastResolution = -1
const maxSynths = 16
function init(count) {

    if (synths.length) {

        for (var i = 0; i < synths.length; i++) {

            synths[i].triggerRelease();
        }

    }

    synths = []
    playTones = {}

    for (var i = 0; i < count; i++) {

        synths.push(new Tone.Synth().toMaster());
    }
}

const handler = function(grid) {

    if (lastResolution != grid.length) {

        init(maxSynths)
        lastResolution = grid.length
    }

    for (var i = 0; i < grid.length; i++) {

        if (grid[i] > 0) {

            if (playTones[i % maxSynths]
            ) {

                //   playTones[i]()

            }
            else {

                playTones[i % maxSynths] = true
                synths[i % maxSynths].triggerAttack(20 + i * 8.7);
            }

        } else {
            if (playTones[i % maxSynths]) {
                playTones[i % maxSynths] = false
                synths[i % maxSynths].triggerRelease();
            }

        }

    }

}

export default {

    handle: function(grid)   {
        handler(grid)
    }

}
