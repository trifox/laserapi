var helper = require('./helper.js')
var laserConfig = require('./LaserApiConfig.js').default
var laserApi = require('./LaserApi.js').default

console.log(laserApi)
/* make sure to use https as the web audio api does not like http */

if (location.protocol === 'http:' && location.hostname !== 'localhost' && location.hostname !== '0.0.0.0') {
    location.href = 'https:' + window.location.href.substring(window.location.protocol.length);
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

function lerp(v0, v1, t) {

    return (1 - t) * v0 + t * v1;

}

function lerp2d(v0, v1, t) {

    return {
        x: lerp(v0.x, v1.x, t),
        y: lerp(v0.y, v1.y, t)
    };

}

// normalized coord in, normalized coord out
function transformCoordinate(coord, mapping) {


    // find p[ositions on x axises top and bottom
    var tx1 = lerp2d(mapping.topleft, mapping.topright, coord.x);
    var tx2 = lerp2d(mapping.bottomleft, mapping.bottomright, coord.x);
    var result = lerp2d(tx1, tx2, coord.y);
    // console.log('INput ', coord, 'output', result)
    return result;
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

function getColorDistance(col1, col2) {
    var diff = []
    diff[0] = col1[0] - col2[0];
    diff[1] = col1[1] - col2[1];
    diff[2] = col1[2] - col2[2];
    var result = Math.sqrt(diff[0] * diff[0] + diff[1] * diff[1] + diff[2] * diff[2]);

    // console.log('diff is .', col1, col2, result);

    return result;
}
loadFromLocalStorage();
console.log(getColorDistance(laserConfig.testColor, [0, 0, 0]))
console.log(getColorDistance(laserConfig.testColor, [0, 255, 0]))
console.log(getColorDistance(laserConfig.testColor, [255, 255, 255]))

var gRect = new Array(laserConfig.gridResolution * laserConfig.gridResolution);
var globalImageData = null;
/* start as soon as things are set up */
document.addEventListener("DOMContentLoaded", function (event) {
    var canvas = document.getElementById('canvas')
    var context = canvas.getContext("2d")
    var video = document.getElementById('video')

    laserApi.init(video, canvas);

    canvas.width = Math.floor(video.videoWidth)
    canvas.height = Math.floor(video.videoHeight)
    canvas.style.width = canvas.width;
    canvas.style.height = canvas.height;

    // ask for mic permission
    /*    navigator.getUserMedia({
     video: {
     width: laserConfig.videoResolution.width,
     height: laserConfig.videoResolution.height
     }
     }, function (stream) {

     video.srcObject = stream;
     video.onloadedmetadata = function (e) {
     // Do something with the video here.
     video.play();

     canvas.width = Math.floor(video.videoWidth)
     canvas.height = Math.floor(video.videoHeight)
     canvas.style.width = canvas.width;
     canvas.style.height = canvas.height;

     updateCanvasRegular()
     };

     }, function () {

     })
     */
    // render canvas
    var updateCanvas = function (options) {

        //    console.log(getCoordinates());
        var transform = getCoordinates();

        if (globalImageData === null) {
            globalImageData = context.createImageData(canvas.width, canvas.height)
            for (var i = 0; i < globalImageData.data.length; i += 4) {
                globalImageData.data[i + 0] = 0;
                globalImageData.data[i + 1] = 0;
                globalImageData.data[i + 2] = 0;
                globalImageData.data[i + 3] = 255;
            }
        }
        updateKnobs(transform);
        saveToLocalStorage();
        if (canvas.width > 0) {

            // context.clearRect(0, 0, canvas.width, canvas.height)
            context.drawImage(video, 0, 0, canvas.width, canvas.height);

            var canvasColorOriginal = context.getImageData(0, 0, canvas.width, canvas.height); // rgba e [0,255]
            var canvasColor = context.getImageData(0, 0, canvas.width, canvas.height); // rgba e [0,255]
            var pixels = canvasColor.data;

            var gwidth = (canvas.width / laserConfig.gridResolution);
            var gheight = (canvas.height / laserConfig.gridResolution)

            for (var gy = 0; gy < laserConfig.gridResolution; gy++) {
                for (var gx = 0; gx < laserConfig.gridResolution; gx++) {
                    var gIndex = gy * laserConfig.gridResolution + gx;
                    gRect[gIndex] = 0;
                }
            }

            for (var x = 0; x < canvas.width; x++) {
                for (var y = 0; y < canvas.height; y++) {

                    var transformed = transformCoordinate({
                        x: x / canvas.width,
                        y: y / canvas.height
                    }, transform);

                    transformed.x *= canvas.width;
                    transformed.y *= canvas.height;

                    transformed.x = Math.round(transformed.x)
                    transformed.y = Math.round(transformed.y)
                    if (x === 0 && y === 0) {
                        //          console.log("transformed is ", transformed)
                    }
                    var index = (transformed.y * canvas.width + transformed.x) * 4;
                    var indexnormal = (y * canvas.width + x) * 4;
                    var gx = Math.floor(x / gwidth);
                    var gy = Math.floor(y / gheight);
                    var gIndex = gy * laserConfig.gridResolution + gx;

                    //canvasColor.data[index + 1] = 0;
                    //canvasColor.data[index + 2] = 0;
                    //                    if (canvasColor.data[index] > (canvasColor.data[index + 1] + canvasColor.data[index + 2])) {
                    var diff = [];
                    var current = [];
                    current[0] = canvasColorOriginal.data[index];
                    current[1] = canvasColorOriginal.data[index + 1];
                    current[2] = canvasColorOriginal.data[index + 2];

                    if (getColorDistance(laserConfig.testColor, [
                            canvasColorOriginal.data[index],
                            canvasColorOriginal.data[index + 1],
                            canvasColorOriginal.data[index + 2]

                        ]) < laserConfig.treshold) {
                        /*  coordinates.push({
                         x: x,
                         x: x,
                         y: y,
                         r: canvasColor.data[index],
                         g: canvasColor.data[index + 1],
                         b: canvasColor.data[index + 2]
                         });
                         */
                        globalImageData.data[indexnormal] = 0;
                        globalImageData.data[indexnormal + 1] = 0;
                        globalImageData.data[indexnormal + 2] = 255;

                        gRect[gIndex] = gRect[gIndex] + 1;

                    } else {
                        globalImageData.data[indexnormal] *= 0.9;
                        globalImageData.data[indexnormal + 1] *= 0.9;
                        globalImageData.data[indexnormal + 2] *= 0.9;

                        //gRect[gIndex] = 0;
                    }
                }

            }

            context.putImageData(globalImageData, 0, 0);

            for (var gx = 0; gx < laserConfig.gridResolution; gx++) {
                for (var gy = 0; gy < laserConfig.gridResolution; gy++) {
                    var ggx = gx * gwidth;
                    var ggy = gy * gheight;
                    var gIndex = gy * laserConfig.gridResolution + gx;

                    if (gRect[gIndex] > 0) {
                        context.strokeStyle = "#0000ff";
                        context.strokeRect(ggx, ggy, gwidth, gheight)
                        context.font = "10px Arial";
                        context.fillStyle = '#ffffff'
                        context.textAlign = 'center'
                        // context.fillText('' + gRect[gIndex], ggx + gwidth * 0.5, ggy + gheight * 0.5);

                        context.fillRect(ggx, ggy, canvas.width / laserConfig.gridResolution, canvas.height / laserConfig.gridResolution)
                    }
                    else {
                        // context.strokeStyle = "#ffffff";

                    }

                }
            }

        }

    }

    // main loop, calls the render method each 30ms + calculates the current average volume + activates the alarm
    var updateCanvasRegular = function () {

        updateCanvas()
        window.requestAnimationFrame(updateCanvasRegular);
        /*  setTimeout(function () {


         updateCanvas()
         updateCanvasRegular()

         }, 300)*/
    }

    // recalculate the canvas size after resize events
    window.onresize = function (event) {
        canvas.width = Math.floor(video.videoWidth)
        canvas.height = Math.floor(video.videoHeight)

        canvas.style.width = canvas.width;
        canvas.style.height = canvas.height;

    };

})
