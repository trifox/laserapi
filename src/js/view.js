var helper = require('./helper.js')
var laserConfig = require('./LaserApiConfig.js').default
var laserApi = require('./LaserApi.js').default
//var game01 = require('./setups/game-001-play-midi').default
var game01 = require('./setups/game-002-moorhuni').default
var Tone = require('tone')
console.log(game01)
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
        synths[index].triggerAttackRelease(10 + index * 4, .2);
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

function componentToHex(c) {
    var hex = c.toString(16);
    return hex.length == 1 ? "0" + hex : hex;
}

function rgbToHex(r, g, b) {
    return "#" + componentToHex(r) + componentToHex(g) + componentToHex(b);
}
function hexToRgb(hex) {
    var result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
    return result ? {
            r: parseInt(result[1], 16),
            g: parseInt(result[2], 16),
            b: parseInt(result[3], 16)
        } : null;
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
    laserConfig.treshold = document.getElementById('treshold').value
    laserConfig.testColor[0] = hexToRgb(document.getElementById('lasercolor').value).r
    laserConfig.testColor[1] = hexToRgb(document.getElementById('lasercolor').value).g
    laserConfig.testColor[2] = hexToRgb(document.getElementById('lasercolor').value).b
    laserApi.init(video, canvas);
    laserApi.registerCallback((grid) => {
        laserConfig.transform = getCoordinates()

        updateKnobs(laserConfig.transform)
        saveToLocalStorage()
        game01.handle(grid)
    });

    // canvas.width = Math.floor(video.videoWidth)
    //   canvas.height = Math.floor(video.videoHeight)
    //   canvas.style.width = canvas.width;
    //  canvas.style.height = canvas.height;

})
