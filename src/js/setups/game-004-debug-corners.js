var laserConfig = require('../LaserApiConfig').default
var Util = require('../util').default
var MainCanvas = require('../MasterCanvas').default

var lastResolution = -1

function createDiv() {
    var div = document.createElement("div");
    div.style.position = 'absolute'
    div.style.width = '100px'
    div.style.height = '100px'
    div.style.backgroundColor = 'red'
    div.style.opacity = 0.7
    div.style.zIndex = '22222'
    return div
}
//
// var topleft = createDiv()
// var topright = createDiv()
// topright.style.right = 0
//
// var bottomleft = createDiv()
// bottomleft.style.bottom = 0
// var bottomright = createDiv()
// bottomright.style.right = 0
// bottomright.style.bottom = 0
//
// document.body.insertBefore(topleft, document.body.firstChild)
// document.body.insertBefore(topright, document.body.firstChild)
// document.body.insertBefore(bottomleft, document.body.firstChild)
// document.body.insertBefore(bottomright, document.body.firstChild)
const handler = function (laserGrid) {

    // paint markers in the corners
    var size = 50
    MainCanvas.get2dContext().fillStyle = Util.rgbToHex(laserConfig.testColor[0], laserConfig.testColor[1], laserConfig.testColor[2])
    MainCanvas.get2dContext().strokeStyle = Util.rgbToHex(laserConfig.testColor[0], laserConfig.testColor[1], laserConfig.testColor[2])
    MainCanvas.get2dContext().lineWidth = 20
    MainCanvas.get2dContext().fillRect(0, 0, size, size)
    MainCanvas.get2dContext().fillRect(laserConfig.canvasResolution.width - size, 0, size, size)
    MainCanvas.get2dContext().fillRect(0, laserConfig.canvasResolution.height - size, size, size)
    MainCanvas.get2dContext().fillRect(laserConfig.canvasResolution.width - size, laserConfig.canvasResolution.height - size, size, size)
    MainCanvas.get2dContext().strokeRect(0, 0, laserConfig.canvasResolution.width, laserConfig.canvasResolution.height)
    //
    // bottomright.style.backgroundColor = Util.rgbToHex(laserConfig.testColor[0], laserConfig.testColor[1], laserConfig.testColor[2])
    // bottomleft.style.backgroundColor = Util.rgbToHex(laserConfig.testColor[0], laserConfig.testColor[1], laserConfig.testColor[2])
    // topleft.style.backgroundColor = Util.rgbToHex(laserConfig.testColor[0], laserConfig.testColor[1], laserConfig.testColor[2])
    // topright.style.backgroundColor = Util.rgbToHex(laserConfig.testColor[0], laserConfig.testColor[1], laserConfig.testColor[2])
}

export default {

    name: 'Debug Grid',
    init: function () {
    },
    handle: function (grid) {
        handler(grid)
    },
    stop: function () {
    }

}
