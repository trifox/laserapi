var helper = require('./helper.js')
var laserConfig = require('./LaserApiConfig').default
var Util = require('./util').default
var CanvasVideo = require('./CanvasVideo').default
var LaserApi = require('./LaserApi.js').default
var LaserApiPresets = require('./LaserApiPresets').default
var w3 = require('./../css/w3.css').default
//var game01 = require('./setups/game-001-play-midi').default
//var shader = require('./shader').default
var MainCanvas = require('./MasterCanvas').default
// var game01 = require('./setups/game-002-moorhuni').default
//var game01 = require('./setups/game-003-pong').default
//var game01 = require('./setups/game-004-paint').default
var gameDebug = require('./setups/game-004-debug').default
var gameDebugCorners = require('./setups/game-004-debug-corners').default
var gameDebugTransform = require('./setups/game-004-debug-transform').default
var GameWrapper = require('./setups/game-wrapper').default
//var game01 = require('./setups/game-005-switch').default
var games = [
    new GameWrapper(require('./setups/game-001-play-midi').default),
    new GameWrapper(require('./setups/game-002-moorhuni').default),
    new GameWrapper(require('./setups/game-003-pong-2').default),
    new GameWrapper(require('./setups/game-005-switch').default),
    new GameWrapper(require('./setups/game-006-fade').default)
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
    context.setTransform(1, 0, Math.tan((angle / 180.0) * Math.PI), 1, 1, 0, 0);
}
function skewXY(context, angle1, angle2) {
    context.setTransform(1, Math.tan((angle1 / 180.0) * Math.PI), Math.tan((angle2 / 180.0) * Math.PI), 1, 1, 0, 0);
}

function frameHandler() {

    // console.log('Re Rendering');
    // console.log('Re Rendering', MainCanvas.getCanvas());

    animationHandler();

    var transform = getTransformOfVideoInput()

    MainCanvas.clear()
    MainCanvas.getCanvas().width = laserConfig.canvasResolution.width
    MainCanvas.getCanvas().height = laserConfig.canvasResolution.height
    MainCanvas.getCanvas().style.width = laserConfig.canvasResolution.width
    MainCanvas.getCanvas().style.height = laserConfig.canvasResolution.height
    MainCanvas.get2dContext().save()
    skewXY(MainCanvas.get2dContext(), document.getElementById('skewY').value, document.getElementById('skewX').value)
    //skewX(MainCanvas.get2dContext(), document.getElementById('skewX').value)
    MainCanvas.get2dContext().translate(transform.translate.x, transform.translate.y)
    MainCanvas.get2dContext().translate(transform.translate.x, transform.translate.y)
    MainCanvas.get2dContext().rotate((transform.rotate / 180.0) * Math.PI)

    MainCanvas.get2dContext().scale(transform.scale, transform.scale)
    //  console.log('Re rotate', transform.rotate);
    MainCanvas.get2dContext().imageSmoothingEnabled = false

    MainCanvas.get2dContext().drawImage(CanvasVideo.getVideo(), -laserConfig.testResolution.width / 2, -laserConfig.testResolution.height / 2, laserConfig.testResolution.width, laserConfig.testResolution.height);

    var canvasColor = MainCanvas.get2dContext().getImageData(0, 0, laserConfig.testResolution.width, laserConfig.testResolution.height); // rgba e [0,255]

    MainCanvas.get2dContext().restore()

    MainCanvas.get2dContext().fillStyle = '#006666'

    MainCanvas.get2dContext().strokeStyle = "#0000ff";
    MainCanvas.get2dContext().strokeRect(0, 0, laserConfig.testResolution.width, laserConfig.testResolution.height)
    var canvasColorInterest = LaserApi.getInterestReqion(MainCanvas.get2dContext(), canvasColor)
    if (!laserConfig.debugVideo) {
        MainCanvas.clear()
    } else {

        MainCanvas.get2dContext().putImageData(canvasColorInterest, laserConfig.testResolution.width, 0);

        //    gameDebugCorners.handle(canvasColor)
        gameDebugTransform.handle(canvasColor)
    }
    var laserGrid = LaserApi.getRectForInputImage(canvasColorInterest)

    if (laserConfig.showGame) {

        games[laserConfig.gameIndex].handle(laserGrid)
    }
    if (laserConfig.showDebug) {
        gameDebug.handle(laserGrid)
    }
    setTimeout(frameHandler, 0)
}

var presets = []
setTimeout(frameHandler, 1000)
if (document.addEventListener) {
    document.addEventListener('webkitfullscreenchange', exitHandler, false);
    // document.addEventListener('fullscreenchange', exitHandler, false);
}

function exitHandler(data) {
    console.log('exitHandler', data)
    if (document.webkitIsFullScreen || document.mozFullScreen || document.msFullscreenElement !== null) {
    } else {

        /* Run code on exit */
        console.log('RESETTING RESOLUTION TO DEFAULT', laserConfig.canvasResolution)
        laserConfig.canvasResolution.width = 640
        laserConfig.canvasResolution.height = 480
        games[laserConfig.gameIndex].init()

    }
}
function fullscreen() {

    console.log('fullscreen clicked')
    var elem = document.getElementById("canvas");
    console.log('element is ', elem)
    console.log('element is ', elem.getBoundingClientRect())

    laserConfig.canvasResolution.width = screen.width
    laserConfig.canvasResolution.height = screen.height
    console.log('resolution is clicked', laserConfig.canvasResolution)
    if (elem.webkitRequestFullscreen) {
        elem.webkitRequestFullscreen();
    }

    games[laserConfig.gameIndex].init()

}
function fullscreenEdit() {

    console.log('fullscreenedit clicked')
    var elem = document.body;
    console.log('element is ', elem)
    console.log('element is ', elem.getBoundingClientRect())

    // laserConfig.canvasResolution.width = 640
    // laserConfig.canvasResolution.height = 480
    console.log('resolution is clicked', laserConfig.canvasResolution)
    if (elem.webkitRequestFullscreen) {
        elem.webkitRequestFullscreen();
    }

    games[laserConfig.gameIndex].init()

}
function initHTML() {

    document.getElementById('fullscreen_button').onclick = fullscreen
    document.getElementById('fullscreenedit_button').onclick = fullscreenEdit
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
        document.getElementById('preset-name').value = presets[evt.target.value].name
        console.log('selector changed', evt.target.value, presets[evt.target.value])
        var config = presets[evt.target.value].config
        delete config.transform
        delete config.videoTransform
        loadHtmlFromSettings(presets[evt.target.value].config)

    }
}

function loadPresetsFromLocalStorage() {

    var data = JSON.parse(window.localStorage.getItem('laserPresets'))

    presets = LaserApiPresets
    if (data) {
        //    presets = presets.join(data.presets)
    }

    console.log('presets data is ', data)
}
function loadFromLocalStorage() {
    loadPresetsFromLocalStorage()
    var data = JSON.parse(window.localStorage.getItem('laser'))
    if (data !== null) {
        console.log('last data is ', data)

        loadHtmlFromSettings(data.laserConfig)
    }

}

function loadHtmlFromSettings(settings) {

    console.log('loading settings', settings)
    if (settings.treshold !== undefined) {
        document.getElementById('treshold').value = settings.treshold
        laserConfig.treshold = settings.treshold
    }
    if (settings.testColor !== undefined) {

        document.getElementById('lasercolor').value = Util.rgbToHex(settings.testColor[0], settings.testColor[1], settings.testColor[2])

        laserConfig.testColor = settings.testColor
    }
    if (settings.debugVideo !== undefined) {

        document.getElementById('debugVideo').value = settings.debugVideo
        laserConfig.debugVideo = settings.debugVideo

    }
    if (settings.showGame !== undefined) {

        document.getElementById('showGame').checked = settings.showGame
        laserConfig.showGame = settings.showGame

    }
    if (settings.gameIndex !== undefined) {

        console.log('loading settings gameIndex', settings)
        laserConfig.gameIndex = settings.gameIndex
        document.getElementById('game-selector').value = settings.gameIndex

    }
    if (settings.showDebug !== undefined) {

        document.getElementById('showDebug').checked = settings.showDebug
        laserConfig.showDebug = settings.showDebug

    }
    if (settings.debugVideo !== undefined) {

        document.getElementById('debugVideo').checked = settings.debugVideo
        laserConfig.debugVideo = settings.debugVideo

    }
    if (settings.gridResolution !== undefined) {

        document.getElementById('gridResolution').value = settings.gridResolution
        laserConfig.gridResolution = settings.gridResolution

    }
    if (settings.videoTransform !== undefined) {
        if (settings.videoTransform.skew !== undefined) {

            document.getElementById('skewX').value = settings.videoTransform.skew.x
            laserConfig.videoTransform.skew.x = settings.videoTransform.skew.x

        }
    }
    if (settings.videoTransform !== undefined && settings.videoTransform.skew !== undefined) {

        document.getElementById('skewY').value = settings.videoTransform.skew.y
        laserConfig.videoTransform.skew.y = settings.videoTransform.skew.y

    }

    if (settings.videoTransform !== undefined) {

        document.getElementById('rotateVideo').value = settings.videoTransform.rotate
        document.getElementById('scaleVideo').value = settings.videoTransform.scale
        document.getElementById('translateVideoX').value = settings.videoTransform.translate.x
        document.getElementById('translateVideoY').value = settings.videoTransform.translate.y
        laserConfig.videoTransform.rotateVideo = settings.videoTransform.rotateVideo
        laserConfig.videoTransform.translateVideoX = settings.videoTransform.translateVideoX
        laserConfig.videoTransform.scaleVideo = settings.videoTransform.scaleVideo
        laserConfig.videoTransform.translateVideoY = settings.videoTransform.translateVideoY

        setVideoTransform(settings.videoTransform)
    }

    if (settings.transform !== undefined) {

        setCoordinates(settings.transform)
    }

}
function saveToLocalStorage() {
    var data = JSON.stringify({
        laserConfig: laserConfig
    })
    // console.log('Saving to localstorage', data)
    window.localStorage.setItem('laser', data)
}

function getCoordinatesForInputElement(elemprefix) {

    var elem1x = document.getElementById(elemprefix + '_x');
    var elem1y = document.getElementById(elemprefix + '_y');
    return {
        x: elem1x.value / 10000.0,
        y: elem1y.value / 10000.0
    }
}

function setCoordinatesForInputElement(elemprefix, data) {

    var elem1x = document.getElementById(elemprefix + '_x');
    var elem1y = document.getElementById(elemprefix + '_y');
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
function getTransformOfVideoInput() {

    return {
        rotate: document.getElementById('rotateVideo').value,
        skew: {
            x: document.getElementById('skewX').value,
            y: document.getElementById('skewY').value

        },
        scale: document.getElementById('scaleVideo').value,
        translate: {
            x: document.getElementById('translateVideoX').value,
            y: document.getElementById('translateVideoY').value,
        }
    }
}
function setCoordinates(data) {

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
    laserConfig.gameIndex = document.getElementById('game-selector').value
    laserConfig.videoTransform = getTransformOfVideoInput()

    laserConfig.testColor[0] = Util.hexToRgb(document.getElementById('lasercolor').value).r
    laserConfig.testColor[1] = Util.hexToRgb(document.getElementById('lasercolor').value).g
    laserConfig.testColor[2] = Util.hexToRgb(document.getElementById('lasercolor').value).b
    laserConfig.transform = getCoordinates()
    // console.log('config is ', laserConfig)
    //     shader.start()
    //  updateKnobs(laserConfig.transform)
    setVideoTransform(getTransformOfVideoInput());
    saveToLocalStorage()

}

var canvasSize = {

    x: 512,
    y: 512

}

function updatePresetSelector() {

    document.getElementById('presets-selector').innerHTML = ''

    var option = document.createElement("option");
    option.text = 'Select Preset'
    option.disabled = true
    option.selected = true

    console.log('game found: ', option.text)
    document.getElementById('presets-selector').add(option);
    for (var i = 0; i < presets.length; i++
    ) {
        var option = document.createElement("option");
        option.text = "Preset #" + i + ' - ' + presets[i].name;
        option.value = i

        console.log('game found: ', option.text)
        document.getElementById('presets-selector').add(option);

    }

}
document.addEventListener("DOMContentLoaded", function (event) {
    initHTML()
    loadFromLocalStorage();
    updatePresetSelector()
})

export default{}
