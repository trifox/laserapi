var laserConfig = require("../LaserApiConfig").default;
var MainCanvas = require("../MasterCanvas").default;

var GPU = require("gpu.js").GPU;
var lastResolution = -1;

const gpu = new GPU();

var kernel;
const handler = function (laserGrid) {
  const ctx = MainCanvas.get2dContext();
  // console.log("render debug", laserConfig);
  if (!kernel) {
    kernel = gpu
      .createKernel(function (gameRect, gridResolution, outWidth, outHeight) {
        var xpos = Math.floor((this.thread.x / outWidth) * gridResolution);
        var ypos = Math.floor(
          ((outHeight - this.thread.y) / outHeight) * gridResolution
        );
        var value = gameRect[xpos + ypos * gridResolution];

        this.color(value, value, value, value);
      })
      .setOutput([
        laserConfig.canvasResolution.width,
        laserConfig.canvasResolution.height,
      ])
      .setGraphical(true);
  }
  kernel(
    laserGrid,
    laserConfig.gridResolution,
    laserConfig.canvasResolution.width,
    laserConfig.canvasResolution.height
  );
  ctx.drawImage(kernel.canvas, 0, 0);
  return;

  ctx.font = "10px Arial";
  // random      ctx.fillStyle = '#00' + Math.floor(Math.random() * 255).toString(16) + 'ff'

  ctx.fillStyle = "#00ffff";

  ctx.lineWidth = 0;
  ctx.textAlign = "center";
  for (var x = 0; x < laserConfig.gridResolution; x++) {
    for (var y = 0; y < laserConfig.gridResolution; y++) {
      var gwidth =
        laserConfig.canvasResolution.width / laserConfig.gridResolution;
      var gheight =
        laserConfig.canvasResolution.height / laserConfig.gridResolution;

      var ggx = x * gwidth;
      var ggy = y * gheight;
      var gIndex = y * laserConfig.gridResolution + x;

      if (laserGrid[gIndex] > 0) {
        //    ctx.strokeStyle = "#0000ff";
        //    ctx.strokeRect(ggx, ggy, gwidth, gheight)

        // context.fillText('' +LaserApi . gRect[gIndex], ggx + gwidth * 0.5, ggy + gheight * 0.5);

        ctx.fillRect(
          ggx,
          ggy,
          laserConfig.canvasResolution.width / laserConfig.gridResolution,
          laserConfig.canvasResolution.height / laserConfig.gridResolution
        );
      } else {
        // context.strokeStyle = "#ffffff";
      }
    }
    //  console.timeEnd'render debug')
  }
};

export default {
  name: "Debug Grid",
  handle: function (grid) {
    handler(grid);
  },
};
