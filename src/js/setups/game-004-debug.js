import { getRgbSpread } from '../util';

var laserConfig = require('../LaserApiConfig').default;
var MainCanvas = require('../MasterCanvas').default;

var GPU = require('gpu.js').GPU;

const gpu = new GPU();

var kernel;
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
          (value * testColor[0]) / 255,
          (value * testColor[1]) / 255,
          (value * testColor[2]) / 255,
          1
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
    getRgbSpread(laserConfig.testColor, 0.5)
  );
  ctx.drawImage(kernel.canvas, 0, 0);
};

export default {
  name: 'Debug Grid',
  init: () => {},
  handle: function (grid) {
    handler(grid);
  },
};
