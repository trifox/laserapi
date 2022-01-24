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

var lastTime = 0;
var elapsed = 0;
function getDelta() {
  var currentTime = performance.now();
  const elapsed = (currentTime - lastTime) / 1000;

  lastTime = currentTime;
  return elapsed;
}
function createEnemyButton() {
  const enemy = guiFillButton({
    label: "",
    posX: leftStartX + 200,
    posY: Math.random() * 800,
    speedDown: 50,
    speedUp: 200,
    radius: 50,
    onEnterActive: () => {
      enemy.setCounter(0);
      enemy.setY(Math.random() * 1080);
      enemy.setX(Math.random() * 1920);
      enemy.setEdges(Math.floor(3 + Math.random() * 8));

      enemy.setRadius(Math.random() * 200);
      var audio = new Audio(
        "https://freesound.org/data/previews/19/19988_37876-lq.mp3"
      );
      audio.play();
    },
  });

  return enemy;
}
const buttons = [
  createEnemyButton(),
  createEnemyButton(),
  createEnemyButton(),
  createEnemyButton(),
  createEnemyButton(),
  createEnemyButton(),
  createEnemyButton(),
  createEnemyButton(),
  createEnemyButton(),
  createEnemyButton(),
  createEnemyButton(),
  createEnemyButton(),
  createEnemyButton(),
  createEnemyButton(),
  createEnemyButton(),
  createEnemyButton(),
  createEnemyButton(),
  createEnemyButton(),
  createEnemyButton(),
  createEnemyButton(),
  createEnemyButton(),
  createEnemyButton(),
  createEnemyButton(),
  createEnemyButton(),
  createEnemyButton(),
  createEnemyButton(),
  createEnemyButton(),
  createEnemyButton(),
  createEnemyButton(),
  createEnemyButton(),
  createEnemyButton(),
  createEnemyButton(),
  createEnemyButton(),
  createEnemyButton(),
  createEnemyButton(),
  createEnemyButton(),
  createEnemyButton(),
  createEnemyButton(),
  createEnemyButton(),
  createEnemyButton(),
  createEnemyButton(),
  createEnemyButton(),
  createEnemyButton(),
  createEnemyButton(),
  createEnemyButton(),
  createEnemyButton(),
  createEnemyButton(),
  createEnemyButton(),
  createEnemyButton(),
  createEnemyButton(),
  createEnemyButton(),
  createEnemyButton(),
  createEnemyButton(),
  createEnemyButton(),
  createEnemyButton(),
  createEnemyButton(),
  createEnemyButton(),
  createEnemyButton(),
  createEnemyButton(),
  createEnemyButton(),
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
  return;
  const ctx = MasterCanvas.get2dContext();
  // console.log("render debug", laserConfig);
  if (!kernel) {
    kernel = gpu
      .createKernel(function (zoomCenter, zoomSize, maxIterations, angle) {
        let x = [0, 0];
        let inputXCoordinate = [
          (((this.thread.x - (this.output.x - this.output.y) / 2) /
            this.output.y) *
            4 -
            2) *
            (zoomSize / 4),
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
            Math.sin(55.75 * Math.log(1 + iterations / maxIterations)) * 0.5 +
              0.5,
            Math.sin(77.75 * Math.log(1 + iterations / maxIterations)) * 0.5 +
              0.5,
            Math.sin(1113.75 * Math.log(1 + iterations / maxIterations)) * 0.5 +
              0.5,
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
  kernel([0, 0], 2, 512, 0);
  ctx.drawImage(
    kernel.canvas,
    laserConfig.canvasResolution.width * 0.05,
    laserConfig.canvasResolution.height * 0.05
  );
  return;
};
export default {
  name: "Laser-Plopper",
  init: function (data) {
    console.log("init game mandelbrot ", knobPositions);
  },
  handle: function (grid) {
    elapsed = getDelta();
    if (lastResolution != grid.length) {
      // init();
      lastResolution = grid.length;
    }
    handler();
    this.handleMandelbrotScreen(grid);
  },

  handleMandelbrotScreen(grid) {
    const ctx = MasterCanvas.get2dContext();
    buttons.forEach((item) => {
      item.handle(grid);

      // item.setX(item.getX() + 1 * Math.random() * 4);
      item.setRadius(item.getRadius() + elapsed * Math.random() * 4);
    });
    if (help) {
      util.renderTextDropShadow({
        ctx,
        text: "Laser-Shooter",
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

Have Fun!

Copyright 2022 C.Kleinhuis and Georg Buchrucker 
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
