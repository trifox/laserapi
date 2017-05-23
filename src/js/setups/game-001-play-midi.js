var laserConfig = require('../LaserApiConfig.js').default
var Tone = require('tone')
var playTones = {}

var synths = []

var lastResolution = -1
const maxSynths = 16
function init(count) {

    if (synths.length) {

        for (var i = 0; i < synths.length; i++) {
            if (synths[i]) {
                synths[i].triggerRelease();
            }

        }

    }

    synths = []
    playTones = []

    for (var i = 0; i < count; i++) {

        synths.push(new Tone.Synth().toMaster());
        playTones[i] = false
    }
}

const handler = function (grid) {

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
                if (synths[i % maxSynths]) {
                    synths[i % maxSynths].triggerAttack(60 + i * 8.7);
                }
            }

        } else {
            if (playTones[i % maxSynths]) {
                playTones[i % maxSynths] = false
                if (synths[i % maxSynths]) {
                    synths[i % maxSynths].triggerRelease();
                }
            }

        }

    }

}

export default {

    name: 'MIDI',
    init: function () {

        init()

    },
    handle: function (grid) {
        handler(grid)
    }

}
