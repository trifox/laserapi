var laserConfig = require('../LaserApiConfig').default
var MainCanvas = require('../MasterCanvas').default

var lastResolution = -1

const handler = function (laserGrid) {


    for (var x = 0; x < laserConfig.gridResolution; x++) {
        for (var y = 0; y < laserConfig.gridResolution; y++) {

            var gwidth = (laserConfig.canvasResolution.width / laserConfig.gridResolution);
            var gheight = (laserConfig.canvasResolution.height / laserConfig.gridResolution)

            var ggx = x * gwidth;
            var ggy = y * gheight;
            var gIndex = y * laserConfig.gridResolution + x;

            if (laserGrid[gIndex] > 0) {
            //    MainCanvas.get2dContext().strokeStyle = "#0000ff";
            //    MainCanvas.get2dContext().strokeRect(ggx, ggy, gwidth, gheight)
                MainCanvas.get2dContext().font = "10px Arial";
                // random      MainCanvas.get2dContext().fillStyle = '#00' + Math.floor(Math.random() * 255).toString(16) + 'ff'

                MainCanvas.get2dContext().fillStyle = '#00ffff'

                MainCanvas.get2dContext().lineWidth = 0;
                MainCanvas.get2dContext().textAlign = 'center'
                // context.fillText('' +LaserApi . gRect[gIndex], ggx + gwidth * 0.5, ggy + gheight * 0.5);

                MainCanvas.get2dContext().fillRect(ggx, ggy, laserConfig.canvasResolution.width / laserConfig.gridResolution, laserConfig.canvasResolution.height / laserConfig.gridResolution)
            }
            else {
                // context.strokeStyle = "#ffffff";

            }

        }
    }
}

export default {

    name: 'Debug Grid',
    handle: function (grid) {
        handler(grid)
    }

}
