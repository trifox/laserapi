var laserConfig = require('../LaserApiConfig').default
var MainCanvas = require('../MasterCanvas').default

var lastResolution = -1

const handler = function (laserGrid) {

    // paint markers in the corners
    var size=25
    MainCanvas.get2dContext().fillStyle = '#00ffff'
    MainCanvas.get2dContext().fillRect(0, 0, size, size)
    MainCanvas.get2dContext().fillRect(laserConfig.canvasResolution.width - size, 0, size, size)
    MainCanvas.get2dContext().fillRect(laserConfig.canvasResolution.width - size, laserConfig.canvasResolution.height - size, size, size)
    MainCanvas.get2dContext().fillRect(0, laserConfig.canvasResolution.height - size, size, size)

}

export default {

    name: 'Debug Grid',
    handle: function (grid) {
        handler(grid)
    }

}
