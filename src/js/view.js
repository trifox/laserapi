var helper = require('./helper.js')
var laserConfig = require('./LaserApiConfig').default
var CanvasVideo = require('./CanvasVideo').default
var LaserApi = require('./LaserApi.js').default
//var game01 = require('./setups/game-001-play-midi').default
//var shader = require('./shader').default
var MainCanvas = require('./MasterCanvas').default
// var game01 = require('./setups/game-002-moorhuni').default
var game01 = require('./setups/game-003-pong').default
/* make sure to use https as the web audio api does not like http */

MainCanvas.init(document.getElementById('canvas'))
CanvasVideo.init(document.getElementById('video'))

function frameHandler() {

    // console.log('Re Rendering');
    // console.log('Re Rendering', MainCanvas.getCanvas());

    animationHandler();

    var transform = getTransformOfVideoInput()

    MainCanvas.get2dContext().save()
    MainCanvas.get2dContext().scale(transform.scale, transform.scale)
    MainCanvas.get2dContext().translate(transform.translate.x, transform.translate.y)
    MainCanvas.get2dContext().translate(transform.translate.x, transform.translate.y)
    MainCanvas.get2dContext().rotate((transform.rotate / 180.0) * Math.PI)

    //  console.log('Re rotate', transform.rotate);
    MainCanvas.get2dContext().imageSmoothingEnabled = false

    MainCanvas.clear()

    MainCanvas.get2dContext().drawImage(CanvasVideo.getVideo(), 0, 0, MainCanvas.getCanvas().width, MainCanvas.getCanvas().height);

    var canvasColor = MainCanvas.get2dContext().getImageData(0, 0, laserConfig.canvasResolution.width, laserConfig.canvasResolution.height); // rgba e [0,255]

    MainCanvas.get2dContext().restore()

    if (!laserConfig.debugVideo) {
        MainCanvas.clear()
    }
    var laserGrid = LaserApi.getRectForInputImage(canvasColor)

    for (var x = 0; x < laserConfig.gridResolution; x++) {
        for (var y = 0; y < laserConfig.gridResolution; y++) {

            var gwidth = (laserConfig.canvasResolution.width / laserConfig.gridResolution);
            var gheight = (laserConfig.canvasResolution.height / laserConfig.gridResolution)

            var ggx = x * gwidth;
            var ggy = y * gheight;
            var gIndex = y * laserConfig.gridResolution + x;

            if (laserGrid[gIndex] > 0) {
                MainCanvas.get2dContext().strokeStyle = "#0000ff";
                MainCanvas.get2dContext().strokeRect(ggx, ggy, gwidth, gheight)
                MainCanvas.get2dContext().font = "10px Arial";
                // random      MainCanvas.get2dContext().fillStyle = '#00' + Math.floor(Math.random() * 255).toString(16) + 'ff'
                if (gIndex % 2 === 0) {
                    MainCanvas.get2dContext().fillStyle = '#0000ff'
                } else {
                    MainCanvas.get2dContext().fillStyle = '#00ff00'
                }
                MainCanvas.get2dContext().textAlign = 'center'
                // context.fillText('' +LaserApi . gRect[gIndex], ggx + gwidth * 0.5, ggy + gheight * 0.5);

                MainCanvas.get2dContext().fillRect(ggx, ggy, laserConfig.canvasResolution.width / laserConfig.gridResolution, laserConfig.canvasResolution.height / laserConfig.gridResolution)
            }
            else {
                // context.strokeStyle = "#ffffff";

            }

        }
    }
    game01.handle(laserGrid)
    setTimeout(frameHandler, 25)
}

setTimeout(frameHandler, 25)

function loadFromLocalStorage() {

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

loadFromLocalStorage();

var interval = 1000 / 25
var lastDate = performance.now()

function animationHandler() {

    laserConfig.treshold = document.getElementById('treshold').value
    laserConfig.gridResolution = document.getElementById('gridResolution').value
    laserConfig.debugVideo = document.getElementById('debugVideo').checked
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
    return
    var canvas = document.getElementById('canvas')
    canvas.width = canvasSize.x;
    canvas.height = canvasSize.y;
    canvas.style.width = canvasSize.x;
    canvas.style.height = canvasSize.y;
    var context = canvas.getContext("2d")
    context.clearRect(0, 0, canvasSize.x, canvasSize.y)

    var video = document.getElementById('video')

    navigator.getUserMedia({
        video: {
            width: laserConfig.videoResolution.width,
            height: laserConfig.videoResolution.height
        }
    }, (stream) => {

        console.log('Stream received', stream)
        video.srcObject = stream;
        video.onloadedmetadata = (e) => {
            console.log('Metadata received', this)
            console.log('Metadata received', e)
            // Do something with the video here.
            video.play();
            animationHandler();
        };

    }, () => {

    })

    canvas.width = Math.floor(video.videoWidth)
    canvas.height = Math.floor(video.videoHeight)
    canvas.style.width = canvas.width;
    canvas.style.height = canvas.height;

})
