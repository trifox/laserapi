var helper = require('./helper.js')
var laserConfig = require('./LaserApiConfig').default
var CanvasVideo = require('./CanvasVideo').default
var LaserApi = require('./LaserApi.js').default
var w3 = require('./../css/w3.css').default
//var game01 = require('./setups/game-001-play-midi').default
//var shader = require('./shader').default
var MainCanvas = require('./MasterCanvas').default
// var game01 = require('./setups/game-002-moorhuni').default
//var game01 = require('./setups/game-003-pong').default
//var game01 = require('./setups/game-004-paint').default
var gameDebug = require('./setups/game-004-debug').default
//var game01 = require('./setups/game-005-switch').default
var games = [
    require('./setups/game-001-play-midi').default,
    require('./setups/game-002-moorhuni').default,
    require('./setups/game-003-pong-2').default,
    require('./setups/game-005-switch').default,
    require('./setups/game-006-fade').default
]
/* make sure to use https as the web audio api does not like http */

MainCanvas.init(document.getElementById('canvas'))
CanvasVideo.init(document.getElementById('video'))

function startGame(index) {

    if (games[index].init) {
        games[index].init();
    }
}
function stopGame(index) {

    if (games[index].stop) {
        games[index].stop();
    }
}
startGame(0)

function skewY(context, angle) {
    context.setTransform(1, Math.tan((angle / 180.0) * Math.PI), 0, 1, 0, 0);
}
function skewX(context, angle) {
    context.setTransform(Math.tan((angle / 180.0) * Math.PI), 1, 0, 0, 0, 0);
}
function frameHandler() {

    // console.log('Re Rendering');
    // console.log('Re Rendering', MainCanvas.getCanvas());

    animationHandler();

    var transform = getTransformOfVideoInput()

    MainCanvas.clear()
    MainCanvas.get2dContext().save()
    skewY(MainCanvas.get2dContext(), document.getElementById('skewX').value)
    MainCanvas.get2dContext().translate(transform.translate.x, transform.translate.y)
    MainCanvas.get2dContext().translate(transform.translate.x, transform.translate.y)
    MainCanvas.get2dContext().rotate((transform.rotate / 180.0) * Math.PI)

    MainCanvas.get2dContext().scale(transform.scale, transform.scale)
    //  console.log('Re rotate', transform.rotate);
    MainCanvas.get2dContext().imageSmoothingEnabled = false

    MainCanvas.get2dContext().drawImage(CanvasVideo.getVideo(), -laserConfig.canvasResolution.width / 2, -laserConfig.canvasResolution.height / 2, MainCanvas.getCanvas().width, MainCanvas.getCanvas().height);

    var canvasColor = MainCanvas.get2dContext().getImageData(0, 0, laserConfig.canvasResolution.width, laserConfig.canvasResolution.height); // rgba e [0,255]

    MainCanvas.get2dContext().restore()

    if (!laserConfig.debugVideo) {
        MainCanvas.clear()
    }
    var laserGrid = LaserApi.getRectForInputImage(canvasColor)

    if (laserConfig.showGame) {

        games[laserConfig.gameIndex].handle(laserGrid)
    }
    if (laserConfig.showDebug) {
        gameDebug.handle(laserGrid)
    }
    setTimeout(frameHandler, 0)
}

var presets
setTimeout(frameHandler, 0)

function initHTML() {

    document.getElementById('fullscreen_button').onclick = function () {

        console.log('going fullscreen')

    }
    document.getElementById('save-preset-button').onclick = function () {

        console.log('saving preset')

        presets = JSON.parse(window.localStorage.getItem('laserPresets'))
        if (presets === null) {
            presets = {
                presets: []
            }
        }

        presets.presets.push({
            name: document.getElementById('preset-name').value,
            config: laserConfig
        })

        window.localStorage.setItem('laserPresets', JSON.stringify(presets))
    }

    for (var i = 0; i < games.length; i++) {

        var option = document.createElement("option");
        option.text = "Game #" + i + ' - ' + games[i].name;
        option.value = i
        if (i === laserConfig.gameIndex) {
            option.selected = true
        }
        console.log('game found: ', option.text)
        document.getElementById('game-selector').add(option);

    }

    document.getElementById('game-selector').onchange = function (evt) {

        laserConfig.gameIndex = evt.target.value

    }
    document.getElementById('presets-selector').onchange = function (evt) {

        console.log('selector changed', evt.target.value)

    }
}
function loadPresetsFromLocalStorage() {

    var data = JSON.parse(window.localStorage.getItem('laserPresets'))
    console.log('presets data is ', data)
}
function loadFromLocalStorage() {
    loadPresetsFromLocalStorage()
    try {
        var data = JSON.parse(window.localStorage.getItem('laser'))
        console.log('last data is ', data)

        if (data.treshold) {
            document.getElementById('treshold').value = data.laserConfig.treshold
        }
        if (data.testColor) {

            document.getElementById('lasercolor').value = data.testColor

        }

        if (data.laserConfig.debugVideo) {

            document.getElementById('debugVideo').value = data.laserConfig.debugVideo

        }
        if (data.laserConfig.showGame) {

            document.getElementById('showGame').checked = data.laserConfig.showGame

        }
        if (data.laserConfig.gameIndex) {

            document.getElementById('game-selector').value = data.laserConfig.gameIndex

        }
        if (data.laserConfig.showDebug) {

            document.getElementById('showDebug').checked = data.laserConfig.showDebug

        }
        if (data.laserConfig.debugVideo) {

            document.getElementById('debugVideo').checked = data.laserConfig.debugVideo

        }
        if (data.laserConfig.gridResolution) {

            document.getElementById('gridResolution').value = data.laserConfig.gridResolution

        }

        if (data.videoTransform) {

            document.getElementById('rotateVideo').value = data.laserConfig.videoTransform.rotate
            document.getElementById('scaleVideo').value = data.laserConfig.videoTransform.scale
            document.getElementById('translateVideoX').value = data.laserConfig.videoTransform.translate.x
            document.getElementById('translateVideoY').value = data.laserConfig.videoTransform.translate.y

        }

        setVideoTransform(data.videoTransform)
        if (data && data.transform) {

            setCoordinates(data.transform)
        }
    }
    catch (e) {
        console.log('error ', e)
    }
}

function saveToLocalStorage() {

    window.localStorage.setItem('laser', JSON.stringify({
        treshold: document.getElementById('treshold').value,
        testColor: document.getElementById('lasercolor').value,
        transform: getCoordinates(),
        videoTransform: getTransformOfVideoInput(),
        debugVideo: document.getElementById('debugVideo').checked,
        laserConfig: laserConfig
    }))
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
    return laserConfig.transform
    return {
        topleft: getCoordinatesForInputElement('topleft'),
        topright: getCoordinatesForInputElement('topright'),
        bottomleft: getCoordinatesForInputElement('bottomleft'),
        bottomright: getCoordinatesForInputElement('bottomright')

    }
}
function getTransformOfVideoInput() {

    return {
        rotate: document.getElementById('rotateVideo').value,

        scale: document.getElementById('scaleVideo').value,
        translate: {
            x: document.getElementById('translateVideoX').value,
            y: document.getElementById('translateVideoY').value,
        }
    }
}
function setCoordinates(data) {
    return;

    setCoordinatesForInputElement('topleft', data.topleft);
    setCoordinatesForInputElement('topright', data.topright);
    setCoordinatesForInputElement('bottomleft', data.bottomleft);
    setCoordinatesForInputElement('bottomright', data.bottomright);
}

function updateKnobs(rect) {
    return
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

function setVideoTransform(transform) {
    return;
    var video = document.getElementById('video')

    var trans = ''
    //
    trans = 'translate(' + transform.translate.x + 'px,' + transform.translate.y + 'px) ';
    trans += 'scale(' + transform.scale + ') ';
    trans += 'rotate(' + transform.rotate + 'deg) ';
    video.style.transform = trans

    //  console.log('set tranform to ', trans)
    //   console.log('set tranform to ', video.style.transform)

}


var interval = 1000 / 25
var lastDate = performance.now()

function animationHandler() {

    laserConfig.treshold = document.getElementById('treshold').value
    laserConfig.gridResolution = document.getElementById('gridResolution').value
    laserConfig.debugVideo = document.getElementById('debugVideo').checked
    laserConfig.showDebug = document.getElementById('showDebug').checked
    laserConfig.showGame = document.getElementById('showGame').checked
    laserConfig.videoTransform = getTransformOfVideoInput()
    laserConfig.testColor[0] = hexToRgb(document.getElementById('lasercolor').value).r
    laserConfig.testColor[1] = hexToRgb(document.getElementById('lasercolor').value).g
    laserConfig.testColor[2] = hexToRgb(document.getElementById('lasercolor').value).b
    laserConfig.transform = getCoordinates()
    //     shader.start()
    //  updateKnobs(laserConfig.transform)
    saveToLocalStorage()
    setVideoTransform(getTransformOfVideoInput());

}

var canvasSize = {

    x: 512,
    y: 512

}

document.addEventListener("DOMContentLoaded", function (event) {
    initHTML()
    loadFromLocalStorage();
})

export default{}
