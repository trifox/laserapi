import util from "../util.js";

var laserConfig = require("../LaserApiConfig.js").default;
var MasterCanvas = require("../MasterCanvas").default;
var guiFillButton = require("./gui/fillButton").default;
var guiFlipButton = require("./gui/flipButton").default;
var guiRangeSlider = require("./gui/rangeSlider").default;

var knobPositions = [];

var lastResolution = -1;
const leftStartX = 1920 * 0.05;
const rightStartX = 1920 - 1920 * 0.05;
const bottomBarStartY = 1080 * 0.75;
var help = false;
const bottomBarCenterY = (1080 - bottomBarStartY) / 2 + bottomBarStartY;

const xSlider = guiRangeSlider({
  label: "X Coordinate",
  posX: rightStartX - 1400,
  posY: bottomBarCenterY - 50,
  height: 100,
  width: 400,
  startValue: -0.6,
  minValue: -2,
  maxValue: 2,
});
const ySlider = guiRangeSlider({
  label: "Y Coordinate",
  posX: rightStartX - 900,
  posY: bottomBarCenterY - 50,
  height: 100,
  width: 400,
  startValue: 0,
  minValue: 2,
  maxValue: -2,
});
const zoomSlider = guiRangeSlider({
  label: "ZOOM",
  posX: rightStartX - 400,
  posY: bottomBarCenterY - 50,
  height: 100,
  width: 400,
  exponential: true,
  startValue: 2,
  minValue: 0.0001,
  maxValue: 2,
});
const rotationSlider = guiRangeSlider({
  label: "Angle",
  posX: rightStartX - 1300,
  posY: bottomBarCenterY + 20,
  height: 100,
  width: 600,
  step: 1,
  startValue: 0,
  minValue: 0,
  maxValue: Math.PI,
});

const buttons = [
  guiFillButton({
    label: "Reset",
    posX: leftStartX + 200,
    posY: bottomBarCenterY,
    speedDown: 2,
    speedUp: 1,
    radius: 50,
    onEnterActive: () => {
      zoomSlider.reset();
      xSlider.reset();
      ySlider.reset();
    },
  }),
  guiFillButton({
    label: "HELP",
    posX: leftStartX + 50,
    posY: bottomBarCenterY,
    radius: 50,
    speedDown: 2,
    activeValue: 50,
    minValue: 10,
    speedUp: 8,
    onEnterActive: () => {
      help = true;
    },
    onExitActive: () => {
      help = false;
    },
  }),

  xSlider,
  ySlider,
  zoomSlider,
  // rotationSlider,
];

var GPU = require("gpu.js").GPU;
var lastResolution = -1;

const gpu = new GPU();
gpu.addFunction(function rotate(v, a) {
  const s = Math.sin(a);
  const c = Math.cos(a);
  const m = [
    [c, -s],
    [s, c],
  ];
  return [m[0][0] * v[0] + m[0][1] * v[1], m[1][0] * v[0] + m[1][1] * v[1]];
});
var kernel;
const handler = function () {
  const ctx = MasterCanvas.get2dContext();
  // console.log("render debug", laserConfig);
  if (!kernel) {
    kernel = gpu
      .createKernel(function (zoomCenter, zoomSize, maxIterations, angle) {
        let x = [0, 0];
        let inputXCoordinate = [
          ((this.thread.x / this.output.y) * 4 - 2) * (zoomSize / 4),
          ((this.thread.y / this.output.y) * 4 - 2) * (zoomSize / 4),
        ];
        inputXCoordinate = rotate(inputXCoordinate, angle);
        let c = [
          zoomCenter[0] + inputXCoordinate[0],
          zoomCenter[1] + inputXCoordinate[1],
        ];
        let escaped = false;
        let iterations = 0;
        for (let i = 0; i < maxIterations; i++) {
          iterations = i;
          x = [
            x[0] * x[0] - x[1] * x[1] + c[0],
            x[0] * x[1] + x[0] * x[1] + c[1],
          ];
          if (x[0] * x[0] + x[1] * x[1] > 16) {
            escaped = true;
            break;
          }
        }
        if (escaped) {
          this.color(
            Math.sin(55.75 * (iterations / maxIterations)) * 0.5 + 0.5,
            Math.sin(77.75 * (iterations / maxIterations)) * 0.5 + 0.5,
            Math.sin(1113.75 * (iterations / maxIterations)) * 0.5 + 0.5,
            1
          );
        } else {
          this.color(0, 0, 0, 1);
        }
      })
      .setOutput([
        laserConfig.canvasResolution.width * 0.9,
        laserConfig.canvasResolution.height * 0.7,
      ])
      .setGraphical(true);
  }
  xSlider.setStep(zoomSlider.getValue() / 4);
  ySlider.setStep(zoomSlider.getValue() / 4);
  kernel(
    [xSlider.getValue(), ySlider.getValue()],
    zoomSlider.getValue(),
    256,
    0
  );
  ctx.drawImage(
    kernel.canvas,
    laserConfig.canvasResolution.width * 0.05,
    laserConfig.canvasResolution.height * 0.05
  );
  return;
};
export default {
  name: "Laser-Mandelbrot",
  init: function (data) {
    console.log("init game mandelbrot ", knobPositions);
  },
  handle: function (grid) {
    if (lastResolution != grid.length) {
      // init();
      lastResolution = grid.length;
    }
    handler();
    this.handleMandelbrotScreen(grid);
  },

  handleMandelbrotScreen(grid) {
    const ctx = MasterCanvas.get2dContext();
    buttons.forEach((item) => item.handle(grid));
    if (help) {
      util.renderTextDropShadow({
        ctx,
        text: "Laser-Mandelbrot",
        fontSize: "150px",
        fillStyle: "green",
        x: laserConfig.canvasResolution.width / 2,
        y: 200,
      });
      ctx.fillStyle = "#00000088";
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
because you hovered over the HELP button in the bottom left corner.

You Can Reset to start location by targeting the RESET button with your laser for some time.

To control the location inside the Mandelbrot Set:
we have the Coordinates X/Y for horizontal/vertical positioning
and the ZOOM which is controlling the magnification at that location

Each of those control parameters are controlled using the sliders at the bottom,
by hovering with the laser above the right or left 
area of the bars below the labels X(Horizontal)/Y(Vertical)/ZOOM
the corresponding values are changed

have fun!

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
  },
};
