var laserConfig = require('../LaserApiConfig').default
var MainCanvas = require('../MasterCanvas').default

var lastResolution = -1

const handler = function (laserGrid) {

    // paint markers in the corners
    MainCanvas.get2dContext().fillStyle = '#00ffff'
    MainCanvas.get2dContext().fillRect(0, 0, 50, 50)
    MainCanvas.get2dContext().fillRect(laserConfig.canvasResolution.width - 50, 0, 50, 50)
    MainCanvas.get2dContext().fillRect(laserConfig.canvasResolution.width - 50, laserConfig.canvasResolution.height - 50, 50, 50)
    MainCanvas.get2dContext().fillRect(0, laserConfig.canvasResolution.height - 50, 50, 50)

}

export default {

    name: 'Debug Grid',
    handle: function (grid) {
        handler(grid)
    }

}
