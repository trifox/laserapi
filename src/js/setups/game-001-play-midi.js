var laserConfig = require('../LaserApiConfig.js').default
var Tone = require('tone')
var playTones
var synths

var lastResolution = -1
const maxSynths = 16

function init(count = maxSynths) {

    if (!synths) {
        synths = []
        playTones = []
        for (var i = 0; i < count; i++) {

            synths.push(new Tone.Synth().toMaster());
            playTones[i] = false
        }
    }
    if (
        synths.length) {

        for (var i = 0; i < synths.length; i++) {
            if (synths[i]) {
                synths[i].triggerRelease();
            }

        }

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
                    //    console.log('trigger',i)
                    synths[i % maxSynths].triggerAttack(60 + i * 8.7);
                }
            }

        } else {
            if (playTones[i % maxSynths]) {
                playTones[i % maxSynths] = false
                if (synths[i % maxSynths]) {
                    // console.log('releasing',i)
                    synths[i % maxSynths].triggerRelease();
                }
            }

        }

    }

}

export default {

    name: 'MIDI',
    init: function () {

        init(maxSynths)

    },
    handle: function (grid) {
        handler(grid)
    },
    stop: function () {

        // for stopping we just reinit ;-)
        init(maxSynths)
    }

}
