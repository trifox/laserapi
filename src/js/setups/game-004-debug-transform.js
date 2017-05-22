var laserConfig = require('../LaserApiConfig').default
var MainCanvas = require('../MasterCanvas').default

var lastResolution = -1

const handler = function (laserGrid) {

    // paint markers in the corners
    MainCanvas.get2dContext().fillStyle = '#ffffff'
    var size=4
    MainCanvas.get2dContext().fillRect(laserConfig.transform.topleft.x * laserConfig.testResolution.width-size/2, laserConfig.transform.topleft.y * laserConfig.testResolution.height-size/2,size , size)
    MainCanvas.get2dContext().fillRect(laserConfig.transform.topright.x * laserConfig.testResolution.width-size/2, laserConfig.transform.topright.y * laserConfig.testResolution.height-size/2, size, size)
    MainCanvas.get2dContext().fillRect(laserConfig.transform.bottomleft.x * laserConfig.testResolution.width-size/2, laserConfig.transform.bottomleft.y * laserConfig.testResolution.height-size/2, size, size)
    MainCanvas.get2dContext().fillRect(laserConfig.transform.bottomright.x * laserConfig.testResolution.width-size/2, laserConfig.transform.bottomright.y * laserConfig.testResolution.height-size/2, size, size)

}

export default {

    name: 'Debug Grid',
    handle: function (grid) {
        handler(grid)
    }

}
