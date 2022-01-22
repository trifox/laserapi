var laserConfig = require("../LaserApiConfig").default;
var MainCanvas = require("../MasterCanvas").default;

var GPU = require("gpu.js").GPU;
var lastResolution = -1;

const gpu = new GPU();

var kernel;
var gridBuffer;
var lastGridResolution;

const handler = function (laserGrid) {
  const ctx = MainCanvas.get2dContext();
  // console.log("render debug", laserConfig);
  if (!kernel) {
    kernel = gpu
      .createKernel(function (
        gameRect,
        gridResolution,
        outWidth,
        outHeight,
        testColor
      ) {
        var xpos = Math.floor((this.thread.x / outWidth) * gridResolution);
        var ypos = Math.floor(
          ((outHeight - this.thread.y) / outHeight) * gridResolution
        );
        var value = gameRect[xpos + ypos * gridResolution];

        this.color(
          value * (1 - testColor[0]),
          value * (1 - testColor[1]),
          value * (1 - testColor[2]),
          value
        );
      })
      .setOutput([
        laserConfig.canvasResolution.width,
        laserConfig.canvasResolution.height,
      ])
      .setGraphical(true);
  }
  // console.log("testcolor is", laserConfig.testColor);
  kernel(
    laserGrid,
    laserConfig.gridResolution,
    laserConfig.canvasResolution.width,
    laserConfig.canvasResolution.height,
    [
      laserConfig.testColor[0] / 255,
      laserConfig.testColor[1] / 255,
      laserConfig.testColor[2] / 255,
    ]
  );
  ctx.drawImage(kernel.canvas, 0, 0);
};

export default {
  name: "Debug Grid",
  init: () => {},
  handle: function (grid) {
    handler(grid);
  },
};
