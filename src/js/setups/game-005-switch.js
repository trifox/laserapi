var laserConfig = require('../LaserApiConfig').default
var MainCanvas = require('../MasterCanvas').default

var lastResolution = -1
var myGrid = []

function init(count) {

    myGrid = []

    for (var i = 0; i < count; i++) {

        myGrid.push({
            active: false,
            time: new Date() - 1000
        });
    }
}

const handler = (laserGrid) => {

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

            if (laserGrid[gIndex] > 0) {

                if (currentDate - myGrid[gIndex].time > 1000) {
                    myGrid[gIndex].active = !myGrid[gIndex].active
                    myGrid[gIndex].time = new Date()
                }
            }
            if (myGrid[gIndex].active) {

                MainCanvas.get2dContext().strokeStyle = "#0000ff";
                MainCanvas.get2dContext().strokeRect(ggx, ggy, gwidth, gheight)
                MainCanvas.get2dContext().font = "10px Arial";
                // random      MainCanvas.get2dContext().fillStyle = '#00' + Math.floor(Math.random() * 255).toString(16) + 'ff'
                if (gIndex % 2 === 0) {
                    MainCanvas.get2dContext().fillStyle = '#0000ff'
                } else {
                    MainCanvas.get2dContext().fillStyle = '#00ff00'
                }
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

    handle: (grid) => {
        handler(grid)
    }

}
