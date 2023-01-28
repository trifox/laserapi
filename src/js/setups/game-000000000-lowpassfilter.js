var laserConfig = require('../LaserApiConfig').default;
var MasterCanvas = require('../MasterCanvas').default;
import util from '../util.js';
var guiFillButton = require('./gui/fillButton').default;
var GPU = require('gpu.js').GPU;
var lastResolution = -1;

const gpu = new GPU();

var lastTime = 0;
var elapsed = 0;
function getDelta() {
  var currentTime = performance.now();
  const elapsed = (currentTime - lastTime) / 1000;

  lastTime = currentTime;
  return elapsed;
}
var kernelRender;
var kernelBuffer;
var buffer;
const handler = function (laserGrid) {
  elapsed = getDelta();
  var gridSize = Math.floor(Math.sqrt(laserGrid.length));
  if (gridSize !== lastResolution) {
    // initialise the buffer bitmap with the same size of the input guiRangeSlider

    buffer = new Float32Array(laserGrid.length);
    kernelBuffer = undefined;
    kernelRender = undefined;
    lastResolution = gridSize;
  }
  const ctx = MasterCanvas.get2dContext();

  if (!kernelBuffer) {
    kernelBuffer = gpu
      .createKernel(function (grid, buffer, elapsed, gridSizeIn) {
        const pos = this.thread.x;
        if (
          grid[pos] +
            grid[pos - 1] +
            grid[pos + 1] +
            grid[pos + gridSizeIn] +
            grid[pos - gridSizeIn] >
          0
        ) {
          return Math.min(buffer[pos] + 100 * elapsed, 1);
        } else {
          return Math.max(buffer[pos] - 10 * elapsed, 0);
        }
      })
      .setOutput([laserGrid.length])
      .setGraphical(false);
  }

  if (!kernelRender) {
    kernelRender = gpu
      .createKernel(function (gameRect, gameSize) {
        const pos = this.thread.x;
        if (
          gameRect[pos] +
            gameRect[pos - 1] +
            gameRect[pos + 1] +
            gameRect[pos + gameSize] +
            gameRect[pos - gameSize] >
          0.0
        ) {
          return 1;
        } else {
          return 0;
        }
      })
      .setOutput([laserGrid.length]);
  }
  buffer = kernelBuffer(laserGrid, buffer, elapsed, gridSize);
  // console.log("buffer is", buffer);
  return kernelRender(buffer, gridSize);
};

export default {
  name: 'Input Lowpassfilter',
  handle: handler,
  init: () => {},
};
