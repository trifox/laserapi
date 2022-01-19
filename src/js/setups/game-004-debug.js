var laserConfig = require("../LaserApiConfig").default;
var MainCanvas = require("../MasterCanvas").default;

var GPU = require("gpu.js").GPU;
var lastResolution = -1;

const gpu = new GPU();

var kernel;
var gridBuffer
var lastGridResolution

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
};

export default {
  name: "Debug Grid",
  init:()=>{},
  handle: function (grid) {
    handler(grid);
  },
};
