var laserConfig = require("../LaserApiConfig").default;
var MasterCanvas = require("../MasterCanvas").default;
import util from "../util.js";
import { lerp3dArray, lerp, lerp2dArray } from "../math.js";
import gpuTools from "../gpuTools";
var guiFillButton = require("./gui/fillButton").default;
var GPU = require("gpu.js").GPU;
var lastResolution = -1;

const gpu = new GPU();
gpu.addFunction(gpuTools.hsv2rgb);
gpu.addFunction(gpuTools.rgb2hsv);
gpu.addFunction(lerp);
gpu.addFunction(lerp3dArray);
gpu.addFunction(lerp2dArray);
var kernelRender;
var kernelBuffer;
var buffer;

var lastTime = 0;
var elapsed = 0;
function getDelta() {
  var currentTime = performance.now();
  const elapsed = (currentTime - lastTime) / 1000;

  lastTime = currentTime;
  return elapsed;
}

var help = false;
const buttons = [
  guiFillButton({
    label: "HELP",
    posX: 1920 - 100,
    posY: 1080 - 100,
    radius: 50,

    onEnterActive: () => {
      help = true;
    },
    onExitActive: () => {
      help = false;
    },
  }),
];

const handler = function (laserGrid) {
  elapsed = getDelta();
  var gridSize = Math.sqrt(laserGrid.length);
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
      .createKernel(function (grid, buffer, elapsed) {
        const pos = this.thread.x;
        if (grid[pos] > 0) {
          return Math.min(buffer[pos] + 1000 * elapsed, 1);
        } else {
          return Math.max(buffer[pos] - 0.01 * elapsed, 0);
        }
      })
      .setOutput([laserGrid.length])
      .setGraphical(false);
  }

  if (!kernelRender) {
    kernelRender = gpu
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
        var hsv = rgb2hsv(
          testColor[0] / 255,
          testColor[1] / 255,
          testColor[2] / 255
        );
        var rgbs = hsv2rgb(
          (0.25 + value * 0.5 + hsv[0] / 360) % 1,
          1 - value * 0.5,
          value
        );
        this.color(value * rgbs[0], value * rgbs[1], value * rgbs[2], value);
      })
      .setOutput([
        laserConfig.canvasResolution.width,
        laserConfig.canvasResolution.height,
      ])
      .setGraphical(true);
  }
  buffer = kernelBuffer(laserGrid, buffer, elapsed);
  // console.log("buffer is", buffer);
  kernelRender(
    buffer,
    laserConfig.gridResolution,
    laserConfig.canvasResolution.width,
    laserConfig.canvasResolution.height,
    laserConfig.testColor
  );
  ctx.drawImage(kernelRender.canvas, 0, 0);

  buttons.forEach((item) => item.handle(laserGrid));
  if (help) {
    drawHelp();
  }
};

function drawHelp() {
  const ctx = MasterCanvas.get2dContext();
  if (help) {
    util.renderTextDropShadow({
      ctx,
      text: "Laser-Montagsmaler",
      fontSize: "150px",
      fillStyle: "red",
      x: laserConfig.canvasResolution.width / 2,
      y: 200,
    });
    ctx.fillStyle = "#00aa0088";
    ctx.fillRect(
      laserConfig.canvasResolution.width * 0.05,
      220,
      laserConfig.canvasResolution.width * 0.9,
      laserConfig.canvasResolution.height * 0.5
    );
    util.renderTextOutline({
      ctx,
      text: `
This HELP text is displayed,
because you hovered over the HELP button in the bottom right corner.

This is a painting fading app, 
point your laser anywhere and it leaves a trace that slowly diminishes

Have Fun!

Copyright 2022 C.Kleinhuis 
Copyright 2022 Frontend Solutions GmbH
Copyright 2022 I-Love-Chaos`,
      fontSize: "26px",
      lineHeight: 25,
      fillStyle: "#ffffff",
      x: laserConfig.canvasResolution.width / 2,
      y: 250,
      dropDistX: 4,
      dropDistY: 4,
    });
  }
}
export default {
  name: "Montagsmaler",
  handle: handler,
  init: () => {},
};
