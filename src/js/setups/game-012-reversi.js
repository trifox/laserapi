import util, {
  getRgbSpreadHex,
  getRgbSpreadRandomHexTriplet,
} from '../util.js';
import gpu from '../gpuTools';

var laserConfig = require('../LaserApiConfig.js').default;
var MasterCanvas = require('../MasterCanvas').default;
var guiFillButton = require('./gui/fillButton').default;
var guiSwitch = require('./gui/switch').default;
var knobPositions = [];

import soundSpawn from '../../../public/media/369952__mischy__plop-1.wav';
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
var startScreenButtons = [];
const createStartScreenButtons = () => [
  guiFillButton({
    label: 'Reset',
    posX: 100,
    posY: 1080 - 100,
    speedDown: 25,
    speedUp: 25,
    edges: 8,
    radius: 50,
    normalColor: getRgbSpreadHex(laserConfig.testColor, 0.5, 1, 1),
    growColor: getRgbSpreadHex(laserConfig.testColor, 0.5, 0.75, 0.75),
    activeColor: getRgbSpreadHex(laserConfig.testColor, 0.5, 0.5, 0.5),
    onEnterActive: (sender) => {
      createButtons();
    },
  }),
  guiSwitch({
    label: 'Reversi',
    label2: 'Single',
    posX: 200,
    posY: 1080 - 100,
    speedDown: 25,
    speedUp: 25,
    edges: 8,
    radius: 50,
    normalColor: getRgbSpreadHex(laserConfig.testColor, 0.6, 1, 1),
    growColor: getRgbSpreadHex(laserConfig.testColor, 0.6, 0.75, 0.75),
    activeColor: getRgbSpreadHex(laserConfig.testColor, 0.6, 0.5, 0.5),
    onChange: (value) => {
      useLineMode = value;
    },
  }),
];
function createButton(fieldX, fieldY, posX, posY) {
  const hsv1 = getRgbSpreadHex(laserConfig.testColor, 0.35, 1, 1);
  const hsv2 = getRgbSpreadHex(laserConfig.testColor, 0.65, 1, 1);
  var isBottomSide = false;

  function updateButtonColor() {
    enemy.setValue(0);
    if (isBottomSide) {
      enemy.setEdges(4);
      var audio = new Audio(soundSpawn);

      enemy.setColor(hsv1);
      enemy.setGrowColor(hsv1);
      enemy.setActiveColor(hsv1);
    } else {
      enemy.setEdges(5);

      var audio = new Audio(soundSpawn);
      // audio.play();

      enemy.setColor(hsv2);
      enemy.setGrowColor(hsv2);
      enemy.setActiveColor(hsv2);
    }
  }

  const enemy = guiFillButton({
    label: '',
    posX: posX,
    posY: posY,
    normalColor: hsv1,
    activeColor: hsv1,
    growColor: hsv1,
    edges: 8,
    speedDown: 100,
    lineWidth: 5,
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
      var audio = new Audio(soundSpawn);
      audio.play();
      if (useLineMode) {
        // horizontal right
        var temp = [];
        console.log('checking', fieldX, fieldY);
        for (var i = fieldX + 1; i < fieldSizeX; i++) {
          const bb = getButton(i, fieldY);
          console.log('check', i, bb, bb.isBottomSide(), isBottomSide);
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
        console.log('found', temp);
        temp.forEach((item) => {
          console.log('item is', item);
          item.setBottomSide(isBottomSide);
        });
        // horizontal left
        temp = [];
        console.log('checking', fieldX, fieldY);
        for (var i = fieldX - 1; i >= 0; i--) {
          const bb = getButton(i, fieldY);
          console.log('check', i, bb, bb.isBottomSide(), isBottomSide);
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
        console.log('found', temp);
        temp.forEach((item) => {
          console.log('item is', item);
          item.setBottomSide(isBottomSide);
        });
        // vertical up
        temp = [];
        console.log('checking', fieldX, fieldY);
        for (var i = fieldY - 1; i >= 0; i--) {
          const bb = getButton(fieldX, i);
          console.log('check', i, bb, bb.isBottomSide(), isBottomSide);
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
        console.log('found', temp);
        temp.forEach((item) => {
          console.log('item is', item);
          item.setBottomSide(isBottomSide);
        });
        //////
        // vertical down
        temp = [];
        console.log('checking', fieldX, fieldY);
        for (var i = fieldY + 1; i < fieldSizeY; i++) {
          const bb = getButton(fieldX, i);
          console.log('check', i, bb, bb.isBottomSide(), isBottomSide);
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
        console.log('found', temp);
        temp.forEach((item) => {
          console.log('item is', item);
          item.setBottomSide(isBottomSide);
        });
        //////
      }
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
    handle: (grid,elapsed) => {
      // // grow element at constant rate up to certain size
      // if (enemy.getRadius() < 250) {
      //   enemy.setRadius(enemy.getRadius() + 0.1);
      // } else {
      //   enemy.setRadius(250);
      // }
      enemy.handle(grid,elapsed);
    },
  };
}
var enemies = [];

var buttons = [];
const createButtons = () => {
  buttons = [];
  for (var i = 0; i < fieldSizeX; i++) {
    for (var j = 0; j < fieldSizeY; j++) {
      buttons.push(
        createButton(i, j, 100 + i * pieceSize, 100 + j * pieceSize)
      );
    }
  }
};
var GPU = require('gpu.js').GPU;
var lastResolution = -1;
function removeItemFromArray(arr, value) {
  console.log('Removing from array', arr, value);
  var index = arr.indexOf(value);
  if (index > -1) {
    arr.splice(index, 1);
  }
  return arr;
}

export default {
  name: 'Laser-Reversi',
  description: `Inspiriert von Knallfolie und Reversi
  
  Ist eine studie für weitere Spiele.`,
  init: function (data) {
    console.log('init game reversi ', knobPositions);
    createButtons();
    startScreenButtons = createStartScreenButtons();
  },
  handle: function (grid, elapsed) {
    if (lastResolution != grid.length) {
      // init();
      lastResolution = grid.length;
    }
    this.handleGameScreen(grid, elapsed);
    startScreenButtons.forEach((item) => item.handle(grid, elapsed));
  },

  handleGameScreen(grid, elapsed) {
    const ctx = MasterCanvas.get2dContext();
    buttons.forEach((item) => {
      item.handle(grid, elapsed);

      // item.setX(item.getX() + 1 * Math.random() * 4);
    });
    enemies.forEach((item) => {
      item.handle(grid, elapsed);

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
      fontSize: '50px',
      fillStyle: getRgbSpreadHex(laserConfig.testColor, 0.5),
      x: laserConfig.canvasResolution.width / 2,
      y: 1080 - 100,
    });
  },
};
