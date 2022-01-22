import util from "../util.js";
import gpu from "../gpuTools";

var laserConfig = require("../LaserApiConfig.js").default;
var MasterCanvas = require("../MasterCanvas").default;
var guiFillButton = require("./gui/fillButton").default;
var guiFlipButton = require("./gui/flipButton").default;
var guiRangeSlider = require("./gui/rangeSlider").default;
var guiFollowCircle = require("./gui/followCircle").default;
var knobPositions = [];

var lastResolution = -1;
const leftStartX = 1920 * 0.05;
const rightStartX = 1920 - 1920 * 0.05;
const bottomBarStartY = 1080 * 0.75;
var help = false;
const bottomBarCenterY = (1080 - bottomBarStartY) / 2 + bottomBarStartY;
function getComplementColor() {}

function createButton(posX, posY) {
  const hsv = gpu.rgb2hsv(
    laserConfig.testColor[0] / 255,
    laserConfig.testColor[1] / 255,
    laserConfig.testColor[2] / 255
  );
  var rgb1 = gpu.hsv2rgb(0.75 + hsv[0] / 360, 1, 1);
  var rgb2 = gpu.hsv2rgb(0.65 + hsv[0] / 360, 0.75, 0.9);
  var rgb3 = gpu.hsv2rgb(0.55 + hsv[0] / 360, 0.5, 0.81);

  var isBottomSide = true;
  const enemy = guiFillButton({
    label: "",
    posX: posX,
    posY: posY,
    normalColor: util.rgbToHex(rgb1[0] * 255, rgb1[1] * 255, rgb1[2] * 255),
    activeColor: util.rgbToHex(rgb2[0] * 255, rgb2[1] * 255, rgb2[2] * 255),
    growColor: util.rgbToHex(rgb3[0] * 255, rgb3[1] * 255, rgb3[2] * 255),
    edges: 8,
    speedDown: 50,
    speedUp: 200,
    radius: 100,
    onEnterActive: () => {
      // var audio = new Audio(
      //   "https://freesound.org/data/previews/372/372209_6687700-lq.mp3"
      //   "https://freesound.org/data/previews/19/19988_37876-lq.mp3"
      // );
      // audio.play();

      console.log("hsv is ", hsv);
      if (isBottomSide) {
        var audio = new Audio(
          "https://freesound.org/data/previews/337/337049_3232293-lq.mp3"
        );
        audio.play();
        var rgb1 = gpu.hsv2rgb(0.25 + hsv[0] / 360, 1, 1);
        var rgb2 = gpu.hsv2rgb(0.35 + hsv[0] / 360, 0.75, 0.9);
        var rgb3 = gpu.hsv2rgb(0.45 + hsv[0] / 360, 0.5, 0.81);

        console.log("rgb is ", rgb1);
        enemy.setColor(
          util.rgbToHex(rgb1[0] * 255, rgb1[1] * 255, rgb1[2] * 255)
        );
        enemy.setGrowColor(
          util.rgbToHex(rgb2[0] * 255, rgb2[1] * 255, rgb2[2] * 255)
        );
        enemy.setActiveColor(
          util.rgbToHex(rgb3[0] * 255, rgb3[1] * 255, rgb3[2] * 255)
        );
      } else {
        var audio = new Audio(
          "https://freesound.org/data/previews/372/372209_6687700-lq.mp3"
        );
        audio.play();
        var rgb1 = gpu.hsv2rgb(0.75 + hsv[0] / 360, 1, 1);
        var rgb2 = gpu.hsv2rgb(0.65 + hsv[0] / 360, 0.75, 0.9);
        var rgb3 = gpu.hsv2rgb(0.55 + hsv[0] / 360, 0.5, 0.8);

        enemy.setColor(
          util.rgbToHex(rgb1[0] * 255, rgb1[1] * 255, rgb1[2] * 255)
        );
        enemy.setGrowColor(
          util.rgbToHex(rgb2[0] * 255, rgb2[1] * 255, rgb2[2] * 255)
        );
        enemy.setActiveColor(
          util.rgbToHex(rgb3[0] * 255, rgb3[1] * 255, rgb3[2] * 255)
        );
      }
      isBottomSide = !isBottomSide;
    },
  });

  return {
    getGui: () => enemy,
    handle: (grid) => {
      // // grow element at constant rate up to certain size
      // if (enemy.getRadius() < 250) {
      //   enemy.setRadius(enemy.getRadius() + 0.1);
      // } else {
      //   enemy.setRadius(250);
      // }
      enemy.handle(grid);
    },
  };
}
var enemies = [];

var buttons = [];
for (var i = 0; i < 7; i++) {
  for (var j = 0; j < 4; j++) {
    buttons.push(createButton(100 + i * 250, 100 + j * 250));
  }
}
var GPU = require("gpu.js").GPU;
var lastResolution = -1;
function removeItemFromArray(arr, value) {
  console.log("Removing from array", arr, value);
  var index = arr.indexOf(value);
  if (index > -1) {
    arr.splice(index, 1);
  }
  return arr;
}

export default {
  name: "Laser-Reversi",
  init: function (data) {
    console.log("init game reversi ", knobPositions);
  },
  handle: function (grid) {
    if (lastResolution != grid.length) {
      // init();
      lastResolution = grid.length;
    }
    this.handleGameScreen(grid);
  },

  handleGameScreen(grid) {
    const ctx = MasterCanvas.get2dContext();
    buttons.forEach((item) => {
      item.handle(grid);

      // item.setX(item.getX() + 1 * Math.random() * 4);
    });
    enemies.forEach((item) => {
      item.handle(grid);

      // item.setX(item.getX() + 1 * Math.random() * 4);
    });

    if (help) {
      util.renderTextDropShadow({
        ctx,
        text: "Laser-BaseFight",
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
