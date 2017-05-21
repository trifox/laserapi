var laserConfig = require('../LaserApiConfig').default
var LaserApi = require('../LaserApi').default
var MainCanvas = require('../MasterCanvas').default

var lastResolution = -1
var fadeDuration = 25000
var myGrid = []

function init(count) {

    myGrid = []
    console.log('initialising fade ', count)
    for (var i = 0; i < count; i++) {

        myGrid.push({
            active: false,

            time: new Date() - 1000
        });
    }
}
function toPaddedHexString(num, len) {
    //    console.log('toPaddedHexString', num, len)
    var str = ( num % 256).toString(16);
    return "0".repeat(len - str.length) + str;
}

function getColorString(r, g, b) {

    var result = '#' + toPaddedHexString(Math.floor(Math.abs(r)), 2) + toPaddedHexString(Math.floor(Math.abs(g)), 2) + toPaddedHexString(Math.floor(Math.abs(b)), 2)
    //  console.log('result is ', r, g, b, result)
    return result
}

function getColorString2(position) {
    // console.log('position is ',position)
    var col1 = {
        x: 0,
        y: 255,
        z: 0
    }
    var col2 = {
        x: 0,
        y: 255,
        z: 255
    }
    var col3 = {
        x: 0,
        y: 0,
        z: 255
    }
    var col4 = {
        x: 0,
        y: 128,
        z: 128
    }
    var col5 = {
        x: 0,
        y: 0,
        z: 0
    }
    var lerpresult
    if (position < 0) {
        return getColorString(col1.x, col1.y, col1.z)
    } else if (position > 1) {
        return getColorString(col5.x, col5.y, col5.z)
    } else if (position < 0.25) {
        lerpresult = LaserApi.lerp3d(col1, col2, position * 4)
        return getColorString(lerpresult.x, lerpresult.y, lerpresult.z)

    } else if (position < 0.5) {

        lerpresult = LaserApi.lerp3d(col2, col3, (position - 0.25) * 4)
        return getColorString(lerpresult.x, lerpresult.y, lerpresult.z)
    }
    else if (position < 0.75) {

        lerpresult = LaserApi.lerp3d(col3, col4, (position - 0.5) * 4)
        return getColorString(lerpresult.x, lerpresult.y, lerpresult.z)
    } else {

        lerpresult = LaserApi.lerp3d(col4, col5, (position - 0.75) * 4)
        return getColorString(lerpresult.x, lerpresult.y, lerpresult.z)
    }

}

const handler = function (laserGrid) {

    if (lastResolution != laserGrid.length) {

        init(laserGrid.length)
        lastResolution = laserGrid.length
    }
    var currentDate = new Date()
    for (var x = 0; x < laserConfig.gridResolution; x++) {
        for (var y = 0; y < laserConfig.gridResolution; y++) {

            var gwidth = (laserConfig.canvasResolution.width / laserConfig.gridResolution);
            var gheight = (laserConfig.canvasResolution.height / laserConfig.gridResolution)

            var ggx = x * gwidth;
            var ggy = y * gheight;
            var gIndex = y * laserConfig.gridResolution + x;

            if (myGrid[gIndex].active) {

                myGrid[gIndex].active = currentDate - myGrid[gIndex].time < fadeDuration
                // random      MainCanvas.get2dContext().fillStyle = '#00' + Math.floor(Math.random() * 255).toString(16) + 'ff'
                //   console.log('diff is ', currentDate - myGrid[gIndex].time)
                //    MainCanvas.get2dContext().fillStyle = getColorString(0, 255 - ((currentDate - myGrid[gIndex].time) / fadeDuration) * 255, 0, 255)
                MainCanvas.get2dContext().fillStyle = getColorString2(((currentDate - myGrid[gIndex].time) / fadeDuration))
                // context.fillText('' +LaserApi . gRect[gIndex], ggx + gwidth * 0.5, ggy + gheight * 0.5);

                MainCanvas.get2dContext().fillRect(ggx, ggy, laserConfig.canvasResolution.width / laserConfig.gridResolution, laserConfig.canvasResolution.height / laserConfig.gridResolution)
            }
            else {
                // context.strokeStyle = "#ffffff";

            }

            if (laserGrid[gIndex] > 0) {

                myGrid[gIndex].active = true
                myGrid[gIndex].time = new Date()
            }
        }
    }
}

export default {
    name: 'Fade'    ,
    handle: function (grid) {
        handler(grid)
    }

}
