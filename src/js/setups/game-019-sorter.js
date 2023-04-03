/**
 * Paradise Game
 *
 * The game switches between 2 game screens:
 * - one is the start screen where only one guiFillButton() triggers the gemeScreen in the onEnterActive()
 * - the other is the game screen with Utilizes multiple  guiFillButtons() that reposition after onEnterActive(),
 *    one guiFillButton() acts as the forbidden fruit, when that guiFillButton triggers an onEnterActive() the game is over.
 *
 */

import util, { drawNgon, getRgbSpreadHex, removeItemFromArray } from '../util.js';
const synth = window.speechSynthesis;
var laserConfig = require('../LaserApiConfig.js').default;
var MasterCanvas = require('../MasterCanvas').default;
var guiFillButton = require('./gui/fillButton').default;
var knobPositions = [];

import soundSpawn from '../../../public/media/369952__mischy__plop-1.wav';
import guiFollowCircle from './gui/followCircle.js';
import { checkBorderAndSlowDown, repellAll } from './game-017-thehorde.js';
var lastResolution = -1;
const bottomBarStartY = 1080 * 0.75;
var help = false;
var lastTime = 0;
var gameState = 'game';
var gameScore = [0, 0];
const intervalSpawn = 2;
const maxAllowed = 25
var baseDef = [{
  corners: 4, color: getRgbSpreadHex(
    laserConfig.testColor,
    0.5 + 0.25,
    1,
    1
  )
}, {
  corners: 16, color: getRgbSpreadHex(
    laserConfig.testColor,
    0.5 - 0.25,
    1,
    1
  )
}]

function getDelta() {
  var currentTime = performance.now();
  const elapsed = (currentTime - lastTime) / 1000;

  lastTime = currentTime;
  return elapsed;
}

const createButtonsGameOverScreen = () => [
  guiFillButton({
    label: 'Start',
    posX: 1920 / 2,
    posY: 1080 / 2 + 200,
    speedDown: 12,
    keyCode: 'Space',
    speedUp: 25,
    edges: Math.floor(3 + Math.random() * 8),
    edges2: undefined, //Math.floor(3 + Math.random() * 8),
    angle: Math.random() * 360,
    activeValue: 90,
    radius: 200,
    normalColor: getRgbSpreadHex(laserConfig.testColor, 0.4),
    activeColor: getRgbSpreadHex(laserConfig.testColor, 0.5),
    growColor: getRgbSpreadHex(laserConfig.testColor, 0.6),
    onEnterActive: (sender) => {
      gameState = 'game';
      gameTime = 0;
      gameScore = [0, 0];
      buttons = createButtons();
    },
    onExitActive: (sender) => { },
  }),
];
var buttonsGameOverScreen = createButtonsGameOverScreen();
function renderBases(ctx) {


  util.drawNgon({
    ctx,
    color: baseDef[0].color,
    Xcenter: 100,
    Ycenter: 540,
    size: 100,
    numberOfSides: baseDef[0].corners,
    filled: true,
    angle: 45,
    lineWidth: 5,
  });


  util.drawNgon({
    ctx,
    color: baseDef[1].color,
    Xcenter: 1920 - 100,
    Ycenter: 540,
    size: 100,
    numberOfSides: baseDef[1].corners,
    filled: true,
    angle: 45,
    lineWidth: 5,
  });
}

var buttons = [];
function createSortableElement() {
  const edges = baseDef[Math.floor(Math.random() * baseDef.length)].corners
  const color = baseDef[Math.floor(Math.random() * baseDef.length)].color

  const result = guiFollowCircle({
    label: '',
    posX: 250 + Math.random() * (1920 - 500),
    posY: -100,
    normalColor: color,
    edges: 4,
    angle: Math.PI / 4,
    edges2: edges,
    speedDown: .1,
    speedUp: .5,
    scanRadiusFactor: 1.5,
    radius: 150 / 2,
  })
  const handleOriginal = result.handle
  result.handle = (grid, elapsed) => {

    handleOriginal(grid, elapsed)
    result.setSpeedY(result.getSpeedY() + 0.25 * elapsed)
    function checkPlayer(index) {
      if (edges === baseDef[index].corners && color === baseDef[index].color) {
        // both match+2
        gameScore[index]++
        gameScore[index]++
        speechSynthesis.speak(new SpeechSynthesisUtterance('Perfekt Plus 2'))
      } if (edges === baseDef[index].corners) {
        // corners match+1
        gameScore[index]++
        speechSynthesis.speak(new SpeechSynthesisUtterance('Gleiche Form Plus 1'))
      } else if (color === baseDef[index].color) {
        // color match
        gameScore[index]++

        speechSynthesis.speak(new SpeechSynthesisUtterance('Gleiche Farbe Plus 1'))
      } else {
        // no match, score -1

        speechSynthesis.speak(new SpeechSynthesisUtterance('Fehler Minus 2'))
        gameScore[index] -= 2
      }
      removeItemFromArray(buttons, result)
    }

    if (result.getX() < 250) {
      // check player1 effect 
      checkPlayer(0)
    }
    if (result.getX() > 1920 - 250) {
      // check player2 effect yes yes code dupl

      checkPlayer(1)
    }

  }
  return result
}
const createButtons = () => [
  createSortableElement()
];
var lastResolution = -1;
var gameTime = 0;

// checkcollisions
function checkCollision(item1, item2) {
  const distx = item1.getX() - item2.getX()
  const disty = item1.getY() - item2.getY()
  const dist = Math.sqrt(distx * distx + disty * disty)

  return dist < item2.getRadius() + item1.getRadius()
}
export default {
  name: 'Laser-Sorter',
  description: `
  
  Willkommen beim Sortieren!

  Das Spiel funktioniert so:

  Jedes team hat eine seite mit einer zugeordneten FARBE und FORM

  aufgabe ist es die erscheinenden farbigen formen entweder auf seine eigene home base zu ziehen,
  oder sie dem gegner unterzujubeln, sind 10 formen auf dem feld so ist das spiel vorbei und
  der punktestand entsteidet bis zu diesem punkt.
  
 .`,
  image: 'media/img/gametitles/laser-sorter-###4###.png',
  init: function (data) {
    console.log('init game paradise ', knobPositions);
    buttons = createButtons();
  },
  handle: function (grid, elapsed) {
    elapsed = getDelta();
    if (lastResolution != grid.length) {
      // init();
      lastResolution = grid.length;
    }
    switch (gameState) {
      case 'game':
        this.handleGameScreen(grid, elapsed);
        break;
      case 'gameover':
        this.handleGameOverScreen(grid, elapsed);
        break;
    }
  },

  handleGameOverScreen(grid, elapsed) {
    const ctx = MasterCanvas.get2dContext();
    buttonsGameOverScreen.forEach((item) => item.handle(grid, elapsed));
    util.renderTextDropShadow({
      ctx,
      text: 'Laser-Sorter',
      fontSize: '150px',
      fillStyle: getRgbSpreadHex(laserConfig.testColor, 0.4),
      x: laserConfig.canvasResolution.width / 2,
      y: 200,
    });
    util.renderTextDropShadow({
      ctx,
      text: `
Team 1 Points: ${gameScore[0]}
Team 2 Points: ${gameScore[1]}
      `,
      fontSize: '50px',
      fillStyle: getRgbSpreadHex(laserConfig.testColor, 0.5),
      x: laserConfig.canvasResolution.width / 2,
      y: 200,
    });
  },
  handleGameScreen(grid, elapsed) {




    gameTime += elapsed;
    if (gameTime > intervalSpawn) {
      buttons.push(createSortableElement())
      gameTime = 0
      if (buttons.length > maxAllowed) {
        gameState = 'gameover'
      }
    }
    const ctx = MasterCanvas.get2dContext();
    // repellAll({ workArray: buttons, targetArray: buttons, elapsed, bounce: 0. })

    buttons.forEach(button => {
      buttons.forEach(base => {
        // console.log(button, base)
        if (button != base && checkCollision(button, base)) {
          // console.log("COLLISION")


          button.setSpeedX(0)
          button.setSpeedY(0)
          base.setSpeedY(0)
          base.setSpeedY(0)
        }
      })
    })

    buttons.forEach((item) => {
      item.handle(grid, elapsed);
    });
    buttons.forEach(item => checkBorderAndSlowDown(item));
    renderBases(ctx);
    util.renderTextDropShadow({
      ctx,
      text: `${gameScore[0]}:${gameScore[1]}`,
      fontSize: '50px',
      fillStyle: getRgbSpreadHex(laserConfig.testColor, 0.3),
      align: 'left',
      x: 100,
      y: 1080 - 100,
    });
  },
};
