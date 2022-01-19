var laserConfig = require("../LaserApiConfig").default;
var MasterCanvas = require("../MasterCanvas").default;
import util from "../util.js";
var guiFillButton = require("./gui/fillButton").default;
var GPU = require("gpu.js").GPU;
var lastResolution = -1;

const gpu = new GPU();

var kernelRender;
var kernelBuffer;
var buffer;

var help = false;
const buttons = [
  guiFillButton({
    label: "HELP",
    posX: 1920 - 100,
    posY: 1080 - 100,
    radius: 50,
    speedUp: 2,
    speedDown: 1,

    onEnterActive: () => {
      help = true;
    },
    onExitActive: () => {
      help = false;
    },
  }),
];

const handler = function (laserGrid) {
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
      .createKernel(function (grid, buffer) {
        const pos = this.thread.x;
        if (grid[pos] > 0) {
          return Math.min(buffer[pos] + 1, 1);
        } else {
          return Math.max(buffer[pos] - 0.001, 0);
        }
      })
      .setOutput([laserGrid.length])
      .setGraphical(false);
  }

  if (!kernelRender) {
    kernelRender = gpu
      .createKernel(function (gameRect, gridResolution, outWidth, outHeight) {
        var xpos = Math.floor((this.thread.x / outWidth) * gridResolution);
        var ypos = Math.floor(
          ((outHeight - this.thread.y) / outHeight) * gridResolution
        );
        var value = gameRect[xpos + ypos * gridResolution];

        this.color(
          0.5 * value * (Math.sin(value * 13) * 0.5 + 0.5),
          value * (Math.sin(value * 15) * 0.25 + 0.5),
          value * (Math.sin(value * 17) * 0.25 + 0.5),
          value
        );
      })
      .setOutput([
        laserConfig.canvasResolution.width,
        laserConfig.canvasResolution.height,
      ])
      .setGraphical(true);
  }
  buffer = kernelBuffer(laserGrid, buffer);
  // console.log("buffer is", buffer);
  kernelRender(
    buffer,
    laserConfig.gridResolution,
    laserConfig.canvasResolution.width,
    laserConfig.canvasResolution.height
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
      text: "Laser-Fade",
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
  name: "Fade GPU",
  handle: handler,
  init: () => {},
};
