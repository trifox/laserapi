var laserConfig = require('../LaserApiConfig').default
var MainCanvas = require('../MasterCanvas').default

var lastResolution = -1
function drawLineNormalized(areaWidth, areaHeight, context, p1, p2, color) {

    drawLine(context, {
        x: p1.x * areaWidth,
        y: p1.y * areaHeight
    }, {
        x: p2.x * areaWidth,
        y: p2.y * areaHeight
    }, '#00ffff')

}
function drawLine(context, p1, p2, color) {

    context.strokeStyle = color
    context.beginPath();
    context.moveTo(p1.x, p1.y);
    context.lineTo(p2.x, p2.y);
    context.stroke();

}

function drawQuad(areaWidth, areaHeight, context, transform) {

    MainCanvas.get2dContext().fillStyle = '#ffffff'
    MainCanvas.get2dContext().lineWidth = 2
    drawLineNormalized(areaWidth, areaHeight, context, transform.topleft, transform.topright)
    drawLineNormalized(areaWidth, areaHeight, context, transform.topleft, transform.bottomleft)
    drawLineNormalized(areaWidth, areaHeight, context, transform.bottomleft, transform.bottomright)
    drawLineNormalized(areaWidth, areaHeight, context, transform.bottomright, transform.topright)
    drawLineNormalized(areaWidth, areaHeight, context, transform.bottomleft, transform.topright)
    drawLineNormalized(areaWidth, areaHeight, context, transform.topleft, transform.bottomright)

}

const handler = function (laserGrid) {

    // paint markers in the corners
    MainCanvas.get2dContext().fillStyle = '#ffffff'
    MainCanvas.get2dContext().lineWidth = 1
    var size = 4
    MainCanvas.get2dContext().fillRect(laserConfig.transform.topleft.x * laserConfig.testResolution.width - size / 2, laserConfig.transform.topleft.y * laserConfig.testResolution.height - size / 2, size, size)
    MainCanvas.get2dContext().fillRect(laserConfig.transform.topright.x * laserConfig.testResolution.width - size / 2, laserConfig.transform.topright.y * laserConfig.testResolution.height - size / 2, size, size)
    MainCanvas.get2dContext().fillRect(laserConfig.transform.bottomleft.x * laserConfig.testResolution.width - size / 2, laserConfig.transform.bottomleft.y * laserConfig.testResolution.height - size / 2, size, size)
    MainCanvas.get2dContext().fillRect(laserConfig.transform.bottomright.x * laserConfig.testResolution.width - size / 2, laserConfig.transform.bottomright.y * laserConfig.testResolution.height - size / 2, size, size)

    drawQuad(laserConfig.testResolution.width, laserConfig.testResolution.height, MainCanvas.get2dContext(), laserConfig.transform)

}

export default {
    drawQuad: drawQuad,
    name: 'Debug Grid',
    handle: function (grid) {
        handler(grid)
    }

}
