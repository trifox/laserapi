var laserConfig = require('../LaserApiConfig').default
var MainCanvas = require('../MasterCanvas').default

var lastResolution = -1
function drawLineNormalized(context, p1, p2, color) {

    drawLine(context, {
        x: p1.x * laserConfig.testResolution.width,
        y: p1.y * laserConfig.testResolution.height
    }, {
        x: p2.x * laserConfig.testResolution.width,
        y: p2.y * laserConfig.testResolution.height
    })

}
function drawLine(context, p1, p2, color) {

    context.strokeStyle = '#ffffff'
    context.beginPath();
    context.moveTo(p1.x, p1.y);
    context.lineTo(p2.x, p2.y);
    context.stroke();

}
const handler = function (laserGrid) {

    // paint markers in the corners
    MainCanvas.get2dContext().fillStyle = '#ffffff'
    var size = 4
    MainCanvas.get2dContext().fillRect(laserConfig.transform.topleft.x * laserConfig.testResolution.width - size / 2, laserConfig.transform.topleft.y * laserConfig.testResolution.height - size / 2, size, size)
    MainCanvas.get2dContext().fillRect(laserConfig.transform.topright.x * laserConfig.testResolution.width - size / 2, laserConfig.transform.topright.y * laserConfig.testResolution.height - size / 2, size, size)
    MainCanvas.get2dContext().fillRect(laserConfig.transform.bottomleft.x * laserConfig.testResolution.width - size / 2, laserConfig.transform.bottomleft.y * laserConfig.testResolution.height - size / 2, size, size)
    MainCanvas.get2dContext().fillRect(laserConfig.transform.bottomright.x * laserConfig.testResolution.width - size / 2, laserConfig.transform.bottomright.y * laserConfig.testResolution.height - size / 2, size, size)
    drawLineNormalized(MainCanvas.get2dContext(), laserConfig.transform.topleft, laserConfig.transform.topright)
    drawLineNormalized(MainCanvas.get2dContext(), laserConfig.transform.topleft, laserConfig.transform.bottomleft)
    drawLineNormalized(MainCanvas.get2dContext(), laserConfig.transform.bottomleft, laserConfig.transform.bottomright)
    drawLineNormalized(MainCanvas.get2dContext(), laserConfig.transform.bottomright, laserConfig.transform.topright)
    drawLineNormalized(MainCanvas.get2dContext(), laserConfig.transform.bottomleft, laserConfig.transform.topright)
    drawLineNormalized(MainCanvas.get2dContext(), laserConfig.transform.topleft, laserConfig.transform.bottomright)
}

export default {

    name: 'Debug Grid',
    handle: function (grid) {
        handler(grid)
    }

}
