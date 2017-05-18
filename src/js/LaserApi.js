/**
 *
 * warning:
 *
 * YES I KNOW THIS CAN NOT USED WITH STATIC REFERENCES< IT WILL CONTINUE PROVIDING BETTER API INSTANCING FUNCTIONALITY IN FUTURE
 *
 */

var helper = require('./helper.js')
var laserConfig = require('./LaserApiConfig.js').default

/* make sure to use https as the web audio api does not like http */
//
// if (location.protocol === 'http:' && location.hostname !== 'localhost' && location.hostname !== '0.0.0.0') {
//     location.href = 'https:' + window.location.href.substrixng(window.location.protocol.length);
// }

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

    return laserConfig.transform
}
function setCoordinates(data) {
    laserConfig.transform = data
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
var lastDate = performance.now()

var LaserApi =
    {
        gRect: new Array(laserConfig.gridResolution * laserConfig.gridResolution),
        globalImageData: null,
        video: null,
        canvas: null,

        init: (video, canvas) => {
            LaserApi.video = video
            LaserApi.canvas = canvas
            LaserApi.context = canvas.getContext("2d")
            console.log('LaserApi Init() called', video, canvas)

            // ask for mic permission
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

                    LaserApi.canvas.width = Math.floor(video.videoWidth)
                    LaserApi.canvas.height = Math.floor(video.videoHeight)
                    LaserApi.canvas.style.width = LaserApi.canvas.width;
                    LaserApi.canvas.style.height = LaserApi.canvas.height;

                    LaserApi.updateCanvasRegular()
                };

            }, () => {

            })

        },
        // main loop, calls the render method each 30ms + calculates the current average volume + activates the alarm
        updateCanvasRegular: () => {

            var currentDate = performance.now()
       //     console.log('checking ', lastDate, currentDate);
            if (currentDate - lastDate < laserConfig.tickIntervalMilliseconds) {
                window.requestAnimationFrame(LaserApi.updateCanvasRegular);
                return
            }
        //    console.log('returning ', lastDate, currentDate);
            lastDate = currentDate

            LaserApi.updateCanvas()
            window.requestAnimationFrame(LaserApi.updateCanvasRegular);
            /*  setTimeout(function () {


             updateCanvas()
             updateCanvasRegular()

             }, 300)*/
        },

        // render canvas
        updateCanvas: (options) => {

            //    console.log('UpdateCanvas in api ///');
            var transform = getCoordinates();

            if (LaserApi.globalImageData === null) {
                LaserApi.globalImageData = LaserApi.context.createImageData(LaserApi.canvas.width, LaserApi.canvas.height)
                for (var i = 0; i < LaserApi.globalImageData.data.length; i += 4) {
                    LaserApi.globalImageData.data[i + 0] = 0;
                    LaserApi.globalImageData.data[i + 1] = 0;
                    LaserApi.globalImageData.data[i + 2] = 0;
                    LaserApi.globalImageData.data[i + 3] = 255;
                }
            }
            if (LaserApi.canvas.width > 0) {

                // context.clearRect(0, 0, canvas.width, canvas.height)
                LaserApi.context.drawImage(video, 0, 0, canvas.width, canvas.height);

                var canvasColorOriginal = LaserApi.context.getImageData(0, 0, LaserApi.canvas.width, LaserApi.canvas.height); // rgba e [0,255]
                var canvasColor = LaserApi.context.getImageData(0, 0, LaserApi.canvas.width, LaserApi.canvas.height); // rgba e [0,255]
                var pixels = canvasColor.data;

                var gwidth = (LaserApi.canvas.width / laserConfig.gridResolution);
                var gheight = (LaserApi.canvas.height / laserConfig.gridResolution)

                for (var gy = 0; gy < laserConfig.gridResolution; gy++) {
                    for (var gx = 0; gx < laserConfig.gridResolution; gx++) {
                        var gIndex = gy * laserConfig.gridResolution + gx;
                        LaserApi.gRect[gIndex] = 0;
                    }
                }

                // lol, room for improvement to make it stop as soon as an adequate pixel has been found in subsection search should continue directly in next section
                for (var x = 0; x < LaserApi.canvas.width; x++) {
                    for (var y = 0; y < LaserApi.canvas.height; y++) {

                        var transformed = transformCoordinate({
                            x: x / LaserApi.canvas.width,
                            y: y / LaserApi.canvas.height
                        }, transform);

                        transformed.x *= LaserApi.canvas.width;
                        transformed.y *= LaserApi.canvas.height;

                        transformed.x = Math.round(transformed.x)
                        transformed.y = Math.round(transformed.y)
                        if (x === 0 && y === 0) {
                            //          console.log("transformed is ", transformed)
                        }
                        var index = (transformed.y * LaserApi.canvas.width + transformed.x) * 4;
                        var indexnormal = (y * LaserApi.canvas.width + x) * 4;
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
                            LaserApi.globalImageData.data[indexnormal] = 0;
                            LaserApi.globalImageData.data[indexnormal + 1] = 0;
                            LaserApi.globalImageData.data[indexnormal + 2] = 255;

                            LaserApi.gRect[gIndex] = LaserApi.gRect[gIndex] + 1;

                        } else {
                            LaserApi.globalImageData.data[indexnormal] *= 0.9;
                            LaserApi.globalImageData.data[indexnormal + 1] *= 0.9;
                            LaserApi.globalImageData.data[indexnormal + 2] *= 0.9;

                            //LaserApi .gRect[gIndex] = 0;
                        }
                    }

                }

                LaserApi.context.putImageData(LaserApi.globalImageData, 0, 0);

                for (var gx = 0; gx < laserConfig.gridResolution; gx++) {
                    for (var gy = 0; gy < laserConfig.gridResolution; gy++) {
                        var ggx = gx * gwidth;
                        var ggy = gy * gheight;
                        var gIndex = gy * laserConfig.gridResolution + gx;

                        if (LaserApi.gRect[gIndex] > 0) {
                            LaserApi.context.strokeStyle = "#0000ff";
                            LaserApi.context.strokeRect(ggx, ggy, gwidth, gheight)
                            LaserApi.context.font = "10px Arial";
                            LaserApi.context.fillStyle = '#ffffff'
                            LaserApi.context.textAlign = 'center'
                            // context.fillText('' +LaserApi . gRect[gIndex], ggx + gwidth * 0.5, ggy + gheight * 0.5);

                            LaserApi.context.fillRect(ggx, ggy, LaserApi.canvas.width / laserConfig.gridResolution, LaserApi.canvas.height / laserConfig.gridResolution)
                        }
                        else {
                            // context.strokeStyle = "#ffffff";

                        }

                    }
                }

                // so at this point is time to call the callback method from our api listener

                if (LaserApi.callback) {

                    LaserApi.callback(LaserApi.gRect)

                }

            }

        },
        registerCallback: (fn) => {
            // most simple callback saving for now, no events, no unregister nothing
            LaserApi.callback = fn
        }

    }

export default       LaserApi
