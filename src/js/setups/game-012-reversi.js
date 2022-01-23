import util from "../util.js";
import gpu from "../gpuTools";

var laserConfig = require("../LaserApiConfig.js").default;
var MasterCanvas = require("../MasterCanvas").default;
var guiFillButton = require("./gui/fillButton").default;
var guiSwitch = require("./gui/switch").default;
var knobPositions = [];

var lastResolution = -1;
const bottomBarStartY = 1080 * 0.75;
var help = false;
var fieldSizeX = 12;
var pieceSize = 150;
var useLineMode = true;
var fieldSizeY = 6;
const bottomBarCenterY = (1080 - bottomBarStartY) / 2 + bottomBarStartY;
function getButton(x, y) {
  // array seems to be distored, make brute force search for now
  for (var i in buttons) {
    if (buttons[i].fieldX === x && buttons[i].fieldY === y) return buttons[i];
  }
  //  return buttons[x + y * fieldSizeX];
}
var startScreenButtons = [
  guiFillButton({
    label: "Reset",
    posX: 100,
    posY: 1080 - 100,
    speedDown: 25,
    speedUp: 25,
    edges: 8,
    radius: 50,
    normalColor: "#00aaff",
    onEnterActive: (sender) => {
      // initialise game
    },
  }),
  guiSwitch({
    label: "Reversi",
    label2: "Single",
    posX: 200,
    posY: 1080 - 100,
    speedDown: 25,
    speedUp: 25,
    edges: 8,
    radius: 50,
    normalColor: "#00aaff",
    onChange: (value) => {
      useLineMode = value;
    },
  }),
  guiFillButton({
    label: "Help",
    posX: 1920 - 100,
    posY: 1080 - 100,
    speedDown: 10,
    speedUp: 50,
    edges: 32,
    activeValue: 35,
    radius: 50,
    normalColor: "#00aaff",
    onEnterActive: (sender) => {
      help = true;
    },
    onExitActive: (sender) => {
      help = false;
    },
  }),
];
function createButton(fieldX, fieldY, posX, posY) {
  const hsv = gpu.rgb2hsv(
    laserConfig.testColor[0] / 255,
    laserConfig.testColor[1] / 255,
    laserConfig.testColor[2] / 255
  );
  var rgb1 = gpu.hsv2rgb(0.75 + hsv[0] / 360, 1, 1);
  var rgb2 = gpu.hsv2rgb(0.65 + hsv[0] / 360, 0.75, 0.9);
  var rgb3 = gpu.hsv2rgb(0.55 + hsv[0] / 360, 0.5, 0.81);

  var isBottomSide = true;

  function updateButtonColor() {
    enemy.setValue(0);
    if (isBottomSide) {
      enemy.setEdges(4);
      var audio = new Audio(
        "https://freesound.org/data/previews/337/337049_3232293-lq.mp3"
      );
      // audio.play();
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
      enemy.setEdges(5);

      var audio = new Audio(
        "https://freesound.org/data/previews/372/372209_6687700-lq.mp3"
      );
      // audio.play();
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
  }

  const enemy = guiFillButton({
    label: "",
    posX: posX,
    posY: posY,
    normalColor: util.rgbToHex(rgb1[0] * 255, rgb1[1] * 255, rgb1[2] * 255),
    activeColor: util.rgbToHex(rgb2[0] * 255, rgb2[1] * 255, rgb2[2] * 255),
    growColor: util.rgbToHex(rgb3[0] * 255, rgb3[1] * 255, rgb3[2] * 255),
    edges: 8,
    speedDown: 100,
    speedUp: 50,
    radius: pieceSize / 2,
    onEnterActive: () => {
      // var audio = new Audio(
      //   "https://freesound.org/data/previews/372/372209_6687700-lq.mp3"
      //   "https://freesound.org/data/previews/19/19988_37876-lq.mp3"
      // );
      // audio.play();

      // find horizontal matching own color

      isBottomSide = !isBottomSide;

      if (useLineMode) {
        // horizontal right
        var temp = [];
        console.log("checking", fieldX, fieldY);
        for (var i = fieldX + 1; i < fieldSizeX; i++) {
          const bb = getButton(i, fieldY);
          console.log("check", i, bb, bb.isBottomSide(), isBottomSide);
          // go right
          if (bb.isBottomSide() === !isBottomSide) {
            temp.push(bb);
          } else {
            // stop until first found same
            break;
          }
          if (i === fieldSizeX - 1) {
            // last item has not breaked out and hence clear temp list
            temp = [];
          }
        }
        console.log("found", temp);
        temp.forEach((item) => {
          console.log("item is", item);
          item.setBottomSide(isBottomSide);
        });
        // horizontal left
        temp = [];
        console.log("checking", fieldX, fieldY);
        for (var i = fieldX - 1; i >= 0; i--) {
          const bb = getButton(i, fieldY);
          console.log("check", i, bb, bb.isBottomSide(), isBottomSide);
          // go right
          if (bb.isBottomSide() === !isBottomSide) {
            temp.push(bb);
          } else {
            // stop until first found same
            break;
          }
          if (i === 0) {
            // last item has not breaked out and hence clear temp list
            temp = [];
          }
        }
        console.log("found", temp);
        temp.forEach((item) => {
          console.log("item is", item);
          item.setBottomSide(isBottomSide);
        });
        // vertical up
        temp = [];
        console.log("checking", fieldX, fieldY);
        for (var i = fieldY - 1; i >= 0; i--) {
          const bb = getButton(fieldX, i);
          console.log("check", i, bb, bb.isBottomSide(), isBottomSide);
          // go right
          if (bb.isBottomSide() === !isBottomSide) {
            temp.push(bb);
          } else {
            // stop until first found same
            break;
          }
          if (i === 0) {
            // last item has not breaked out and hence clear temp list
            temp = [];
          }
        }
        console.log("found", temp);
        temp.forEach((item) => {
          console.log("item is", item);
          item.setBottomSide(isBottomSide);
        });
        //////
        // vertical down
        temp = [];
        console.log("checking", fieldX, fieldY);
        for (var i = fieldY + 1; i < fieldSizeY; i++) {
          const bb = getButton(fieldX, i);
          console.log("check", i, bb, bb.isBottomSide(), isBottomSide);
          // go right
          if (bb.isBottomSide() === !isBottomSide) {
            temp.push(bb);
          } else {
            // stop until first found same
            break;
          }
          if (i + 1 === fieldSizeY) {
            // last item has not breaked out and hence clear temp list
            temp = [];
          }
        }
        console.log("found", temp);
        temp.forEach((item) => {
          console.log("item is", item);
          item.setBottomSide(isBottomSide);
        });
        //////
      }

      console.log("hsv is ", hsv);
      updateButtonColor();
    },
  });

  updateButtonColor();
  return {
    fieldX,
    fieldY,
    getGui: () => enemy,
    isBottomSide: () => isBottomSide,
    setBottomSide: (v) => {
      isBottomSide = v;
      updateButtonColor();
      enemy.setValue(50);
    },
    x: posX,
    y: posY,
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
for (var i = 0; i < fieldSizeX; i++) {
  for (var j = 0; j < fieldSizeY; j++) {
    buttons.push(createButton(i, j, 100 + i * pieceSize, 100 + j * pieceSize));
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
    startScreenButtons.forEach((item) => item.handle(grid));
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

    // count pieces
    var countup = 0;
    var countdown = 0;
    buttons.forEach((item) => {
      if (item.isBottomSide()) {
        countup++;
      } else {
        countdown++;
      }
    });
    util.renderTextDropShadow({
      ctx,
      text: `Team 1 ${((countup / buttons.length) * 100).toFixed(0)}% ${(
        (countdown / buttons.length) *
        100
      ).toFixed(0)}% Team 1 `,
      fontSize: "50px",
      fillStyle: "green",
      x: laserConfig.canvasResolution.width / 2,
      y: 1080 - 100,
    });

    if (help) {
      util.renderTextDropShadow({
        ctx,
        text: "Laser-Reversi",
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
because you hovered over the HELP button in the bottom right corner.

A game inspired by Reversi. 

Each time a coin is flipped, all coins up to the next coin of same color 
in the row/column are flipped as well.

The game starts with 50/50 coin division, the goal is to overtake the full field.

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
