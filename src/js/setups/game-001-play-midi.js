var helper = require('./helper.js')
var laserConfig = require('./LaserApiConfig.js').default
var laserApi = require('./LaserApi.js').default
var Tone = require('tone')
console.log(laserApi)
/* make sure to use https as the web audio api does not like http */

//play a middle 'C' for the duration of an 8th note
// save playing tones
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
        synths[index].triggerAttackRelease(index*7, .2);
        //  synths[index].triggerAttackRelease(index * 8, 1.1);
    }

}
function loadFromLocalStorage() {

    try {
        var data = JSON.parse(window.localStorage.getItem('laser'))
        console.log('last data is ', data)
        if (data && data.transform) {
            setCoordinates(data.transform)
        }
    }
    catch (e) {
        console.log('error ', e)
    }
}

function saveToLocalStorage() {

    window.localStorage.setItem('laser', JSON.stringify({transform: getCoordinates()}))
}

function getCoordinatesForInputElement(elemprefix) {

    elem1x = document.getElementById(elemprefix + '_x');
    elem1y = document.getElementById(elemprefix + '_y');
    return {
        x: elem1x.value / 10000.0,
        y: elem1y.value / 10000.0
    }
}

function setCoordinatesForInputElement(elemprefix, data) {

    elem1x = document.getElementById(elemprefix + '_x');
    elem1y = document.getElementById(elemprefix + '_y');
    elem1x.value = data.x * 10000.0;
    elem1y.value = data.y * 10000.0;
}

function getCoordinates() {

    return {
        topleft: getCoordinatesForInputElement('topleft'),
        topright: getCoordinatesForInputElement('topright'),
        bottomleft: getCoordinatesForInputElement('bottomleft'),
        bottomright: getCoordinatesForInputElement('bottomright')

    }
}
function setCoordinates(data) {
    setCoordinatesForInputElement('topleft', data.topleft);
    setCoordinatesForInputElement('topright', data.topright);
    setCoordinatesForInputElement('bottomleft', data.bottomleft);
    setCoordinatesForInputElement('bottomright', data.bottomright);
}

function updateKnobs(rect) {
    var knob1 = document.getElementById('knob1');
    var knob2 = document.getElementById('knob2');
    var knob3 = document.getElementById('knob3');
    var knob4 = document.getElementById('knob4');
    var container = document.getElementById('video').getBoundingClientRect();
    knob1.style.top = rect.topleft.y * container.height;
    knob1.style.left = rect.topleft.x * container.width;
    knob2.style.top = rect.topright.y * container.height;
    knob2.style.left = rect.topright.x * container.width;
    knob3.style.top = rect.bottomleft.y * container.height;
    knob3.style.left = rect.bottomleft.x * container.width;
    knob4.style.top = rect.bottomright.y * container.height;
    knob4.style.left = rect.bottomright.x * container.width;

    //   console.log(rect, knob1.style.top, knob1.style.left, container.width, container.height)

}

loadFromLocalStorage();

var interval = 1000 / 25
var lastDate = performance.now()

document.addEventListener("DOMContentLoaded", function (event) {
    var canvas = document.getElementById('canvas')
    var context = canvas.getContext("2d")
    var video = document.getElementById('video')

    laserApi.init(video, canvas);
    laserApi.registerCallback((grid) => {
        laserConfig.transform = getCoordinates()

        updateKnobs(laserConfig.transform)
        saveToLocalStorage()

        var currentDate = performance.now()

        if (currentDate - lastDate < 100) {
            //     return
        }
        lastDate = currentDate

        //   console.log('new grid received', grid)

        for (var i = 0; i < grid.length; i++) {

            if (grid[i] > 0) {
                // something is active in this grid

                if (playTones[i]) {

                    // do nothing
                    //   console.log('playing ', i)
                    //   console.log('playing ', playTones[i])
                    //   playTones[i].triggerAttack()
                    //playTones[i].triggerAttack()
                    // play it
                    playTones[i]()

                } else {

                    playTones[i] = makeBingFunction(i)
                    // play it
                    playTones[i]()
                }

            } else {
                //. grid deactive
                playTones[i] = null
          //      synths[i].triggerRelease(1);
            }

        }

    });

    canvas.width = Math.floor(video.videoWidth)
    canvas.height = Math.floor(video.videoHeight)
    canvas.style.width = canvas.width;
    canvas.style.height = canvas.height;

})
