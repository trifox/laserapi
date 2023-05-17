/**
 * Paradise Game
 *
 * The game switches between 2 game screens:
 * - one is the start screen where only one guiFillButton() triggers the gemeScreen in the onEnterActive()
 * - the other is the game screen with Utilizes multiple  guiFillButtons() that reposition after onEnterActive(),
 *    one guiFillButton() acts as the forbidden fruit, when that guiFillButton triggers an onEnterActive() the game is over.
 *
 */

import util, { getRgbSpreadHex, removeItemFromArray } from '../util.js';

var laserConfig = require('../LaserApiConfig.js').default;
var MasterCanvas = require('../MasterCanvas').default;
var guiFillButton = require('./gui/fillButton').default;
var knobPositions = [];

import soundSpawn from '../../../public/media/369952__mischy__plop-1.wav';
var lastResolution = -1;
const bottomBarStartY = 1080 * 0.75;
var help = false;
var lastTime = 0;
var gameState = 'game';
var gameScore = 0;
function getDelta() {
  var currentTime = performance.now();
  const elapsed = (currentTime - lastTime) / 1000;

  lastTime = currentTime;
  return elapsed;
}
var buttonsGameOverScreen = [];

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
      gameScore = 0;
      buttons = createButtons();
    },
    onExitActive: (sender) => { },
  }),
];
function createEnemyButton({ isApple = false } = { isApple: false }) {
  var delay = isApple ? 0 : Math.random() * 10;
  const enemy = guiFillButton({
    label: '',
    posX: Math.random() * 1920,
    posY: Math.random() * 1080,
    speedDown: 150,
    speedUp: isApple ? 300 : 600,
    radius: isApple ? 100 : Math.random() * 100 + 50,
    lineWidth: isApple ? 10 : 2,
    counterReset: true,
    normalColor: isApple
      ? getRgbSpreadHex(laserConfig.testColor, 0.3, 0.9, 0.9)
      : getRgbSpreadHex(
        laserConfig.testColor,
        0.5 + Math.random() * 0.2,
        0.9,
        0.9
      ),
    growColor: isApple
      ? getRgbSpreadHex(laserConfig.testColor, 0.3, 0.75, 0.75)
      : getRgbSpreadHex(laserConfig.testColor, 0.6, 0.75, 0.75),
    activeColor: isApple
      ? getRgbSpreadHex(laserConfig.testColor, 0.3, 0.5, 0.5)
      : getRgbSpreadHex(laserConfig.testColor, 0.65, 0.5, 0.5),
    edges: 3 + Math.round(Math.random() * 12),
    edges2: undefined, //3 + Math.round(Math.random() * 12),
    onEnterActive: () => {
      if (isApple) {
        gameState = 'gameover';
        buttonsGameOverScreen = createButtonsGameOverScreen();
      }
      gameScore++;
      removeItemFromArray(buttons, enemy);
      buttons.push(createEnemyButton());

      var audio = new Audio(soundSpawn);
      audio.play();
      delay = Math.random() * 10;
    },
  });
  var origHandle = enemy.handle;
  enemy.handle = (grid, elapsed) => {
    delay -= elapsed;
    if (delay > 0) {
      return;
    }
    origHandle(grid, elapsed);
  };
  return enemy;
}
var buttons = [];

const createButtons = () => [
  createEnemyButton({ isApple: true }),
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
var lastResolution = -1;
var gameTime = 0;

export default {
  name: 'Laser-Paradise',
  description: `
  
Willkommen im Paradies!


Ziel ist es soviele Kugeln wie möglich zu zerplatzen,
  
ohne die 'verbotene' Frucht zu zerstören.`,

  image: 'media/img/gametitles/laser-paradise-###8###.png',
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
      text: 'Laser-Paradise',
      fontSize: '150px',
      fillStyle: getRgbSpreadHex(laserConfig.testColor, 0.4),
      x: laserConfig.canvasResolution.width / 2,
      y: 200,
    });
    util.renderTextDropShadow({
      ctx,
      text: `
      You survived ${gameTime.toFixed(2)} seconds
      and popped ${gameScore} items
      that makes ${(gameScore / gameTime).toFixed(2)} ratio
      `,
      fontSize: '50px',
      fillStyle: getRgbSpreadHex(laserConfig.testColor, 0.5),
      x: laserConfig.canvasResolution.width / 2,
      y: 200,
    });
  },
  handleGameScreen(grid, elapsed) {
    gameTime += elapsed;
    const ctx = MasterCanvas.get2dContext();
    buttons.forEach((item) => {
      item.handle(grid, elapsed);
    });
    util.renderTextDropShadow({
      ctx,
      text: `${gameScore} - ${gameTime.toFixed(2)} ${(
        gameScore / gameTime
      ).toFixed(2)}`,
      fontSize: '50px',
      fillStyle: getRgbSpreadHex(laserConfig.testColor, 0.3),
      align: 'left',
      x: 100,
      y: 1080 - 100,
    });
  },
};
