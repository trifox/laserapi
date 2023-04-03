import {
  renderTextDropShadow,
  removeItemFromArray,
  getRgbSpreadHex,
  getRgbSpreadRandomHex,
  getRgbSpreadRandomHexTriplet,
} from '../util.js';

var laserConfig = require('../LaserApiConfig.js').default;
var MasterCanvas = require('../MasterCanvas').default;
var guiFillButton = require('./gui/fillButton').default;
var guiFollowCircle = require('./gui/followCircle').default;

import soundSpawn from '../../../public/media/496199__luminousfridge__player-spawned.ogg';
import soundExplode from '../../../public/media/369952__mischy__plop-1.wav';
import soundGameOver from '../../../public/media/70299__kizilsungur__sonar.wav';
import soundBG from '../../../public/media/517267__foolboymedia__cinematic-stomp.wav';
import soundLevelUp1 from '../../../public/media/opengameart/Ability Learn.ogg';
import soundLevelUp2 from '../../../public/media/opengameart/Level Up.ogg';
// import soundBG from '../../../public/media/522110__setuniman__cheeky-1t41b.wav';
/**
 * audio imports
 */
import soundSpawn from '../../../public/media/496199__luminousfridge__player-spawned.ogg';
import { lerp2dArray, sin3, slerp } from '../math.js';
import {
  createFlapAndHordeEnemy,
  renderEnemiesRightSidePreview,
} from './game-015-flap.js';
import { drawSineLine } from './game-016b-lasersharkpool.js';

var enemies = createEnemies();

function createEnemies() {
  enemies = [];
  enemies.push(createFlapAndHordeEnemy(enemies, 0.2));

  return enemies;
}
var bgSound;
var spawnButtons = [];
var bubbles = [];
var gameState = 'spawn';
var help = false;
var gameTime = 0;
var wonTime = 0;
var startAmount = 0;
var bestWonTime = 0;
var deathgram = [];
var buttonsSpawnScreen = [];

const createButtonsSpawnScreen = () => [
  guiFillButton({
    label: 'Start',
    posX: 1920 / 2,
    posY: 1080 / 2,
    speedDown: 10,
    keyCode: 'Space',
    speedUp: 20,
    edges: Math.floor(3 + Math.random() * 8),
    edges2: Math.floor(3 + Math.random() * 8),
    angle: Math.random() * 360,
    activeValue: 90,
    radius: 200,
    normalColor: getRgbSpreadRandomHex(laserConfig.testColor),
    growColor: getRgbSpreadRandomHex(laserConfig.testColor),
    activeColor: getRgbSpreadRandomHex(laserConfig.testColor),
    onEnterActive: (sender) => {
      gameState = 'game';
      gameTime = 0;
      startAmount = bubbles.length;
      enemies = createEnemies();
      nextLevel = NEXT_LEVEL_INTERVAL;
      bgSound = new Audio(soundBG);
      bgSound.loop = true;
      bgSound.play();
    },
    onExitActive: (sender) => { },
  }),
  // helpButton,
];
var buttonsGameOverScreen = [];

const createButtonsGameOverScreen = () => [
  guiFillButton({
    label: 'Spawn Again',
    posX: 1920 / 2,
    posY: 1080 / 2,
    speedDown: 12,
    speedUp: 25,
    edges: 3,
    keyCode: 'Space',
    radius: 200,
    normalColor: getRgbSpreadHex(laserConfig.testColor, 0.5),
    onEnterActive: (sender) => {
      gameState = 'spawn';
      gameTime = 0;
      spawnButtons = createSpawnButtons();
      enemies = createEnemies();
      deathgram = [];
    },
  }),
  // helpButton,
];
function checkCollisionWithObstacles() {
  const todelete = [];

  function getBubbleDist(bubble, obstacle) {
    return Math.sqrt(
      Math.pow(bubble.getX() - obstacle.getX(), 2) +
      Math.pow(bubble.getY() - obstacle.getY(), 2)
    );
  }
  bubbles.forEach((bubble) => {
    enemies.forEach((obstacle) => {
      if (
        getBubbleDist(bubble, obstacle) <
        bubble.getRadius() + obstacle.getSize()
      ) {
        todelete.push(bubble);
      }
    });
  });
  if (todelete.length > 0) {
    var audio = new Audio(soundExplode);
    audio.play();
  }
  if (todelete.length > 0) {
    deathgram.push({
      time: gameTime,
      count: bubbles.length - todelete.length,
    });
  }
  todelete.forEach((item) => removeItemFromArray(bubbles, item));
}
export function repellAll({
  workArray,
  targetArray = undefined,
  elapsed = 1,
  bounce = 1,
  fieldName = undefined
}) {
  // console.log(';repellall', workArray);
  function getBubbleDif(a, b) {
    return [a.getX() - b.getX(), a.getY() - b.getY()];
  }

  function getBubbleDist(a, b) {
    return Math.sqrt(
      Math.pow(a.getX() - b.getX(), 2) + Math.pow(a.getY() - b.getY(), 2)
    );
  }
  workArray.forEach((bubble1Elem) => {
    const bubble1 = fieldName ? bubble1Elem[fieldName] : bubble1Elem;
    targetArray.forEach((bubble2Elem) => {
      const bubble2 = fieldName ? bubble2Elem[fieldName] : bubble2Elem;

      if (bubble1 !== bubble2) {
        // console.log('testing', bubble1, bubble2);
        const dist = getBubbleDist(bubble1, bubble2);
        if (dist < bubble1.getRadius() + bubble2.getRadius()) {
          //repell
          // console.log('repelling', bubble1, bubble2);
          var dir1 = getBubbleDif(bubble1, bubble2);
          dir1 = [
            //normalize and scale with bounce
            (dir1[0] / dist) * bounce,
            (dir1[1] / dist) * bounce,
          ];
          var dir2 = [-dir1[0], -dir1[1]];

          var newDirBubble1 = lerp2dArray(
            [bubble1.getSpeedX(), bubble1.getSpeedY()],
            dir1,
            0.5
          );
          newDirBubble1 = [
            bubble1.getSpeedX() - dir2[0] * elapsed,
            bubble1.getSpeedY() - dir2[1] * elapsed,
          ];
          var newDirBubble2 = lerp2dArray(
            [bubble2.getSpeedX(), bubble2.getSpeedY()],
            dir2,
            0.5
          );
          newDirBubble2 = [
            bubble2.getSpeedX() - dir1[0] * elapsed,
            bubble2.getSpeedY() - dir1[1] * elapsed,
          ];
          // console.log('repellspeeds are', newDirBubble1, newDirBubble2);
          bubble1.setSpeedX(newDirBubble1[0]);
          bubble1.setSpeedY(newDirBubble1[1]);
          bubble2.setSpeedX(newDirBubble2[0]);
          bubble2.setSpeedY(newDirBubble2[1]);
        }
      }
    });
  });
}
var lastResolution = -1;
var enemyRowCounter = 0;
function createBubble({
  x,
  y,
  radius = 50,
  color = 'red',
  edges = 5,
  edges2 = 5,
}) {
  var bubble = guiFollowCircle({
    label: '',
    posX: x,
    posY: y,
    normalColor: color,
    edges,
    edges2: undefined,
    speedDown: 0.08,
    speedUp: 0.04,
    scanRadiusFactor: 2.5,
    followTrueOrRepellFalse: false,
    radius: radius / 2,
  });
  const orighandle = bubble.handle;
  var sinCounter = 0;
  bubble.handle = (grid, elapsed) => {
    orighandle(grid, elapsed);
    // console.log(bubble.getSpeedX(), bubble.getSpeedY());
    if (
      Math.sqrt(
        bubble.getSpeedX() * bubble.getSpeedX() +
        bubble.getSpeedX() * bubble.getSpeedY()
      ) < 0.01
    ) {
      sinCounter += elapsed;
    } else {
    }
    bubble.setAngle((sin3(sinCounter * 0.5) * Math.PI) / 2);
    bubble.setInnerRadiusFactor(0.5 + sin3(sinCounter * 1) * 0.25);
  };
  return bubble;
}
function createSpawnButton({
  x,
  y,
  radius = 50,
  color = 'green',
  growColor = 'red',
  activeColor = 'gold',
}) {
  var butt = guiFillButton({
    label: '',
    posX: 100 + x * radius * 3,
    posY: 100 + y * radius * 3,
    speedDown: 10,
    speedUp: 50,
    edges: Math.floor(3 + Math.random() * 8),
    edges2: undefined,
    angle: Math.random() * 360,
    activeValue: 90,
    radius: radius,
    scanRadiusFactor: 12,
    growColor,
    activeColor,
    normalColor: color,
    onEnterActive: (sender) => {
      var audio = new Audio(soundSpawn);
      audio.play();
      removeItemFromArray(spawnButtons, butt);
      for (var i = 0; i < 4; i++) {
        bubbles.push(
          createBubble({
            x: butt.getX() + radius / 2 + (i % 2) * radius - radius,
            y: butt.getY() + radius / 2 + (i / 2) * radius - radius,
            radius: radius,
            edges: butt.getEdges(),
            edges2: butt.getEdges2(),
            color: butt.getColor(),
          })
        );
      }
    },
    onExitActive: (sender) => { },
  });
  return butt;
}
function createSpawnButtons(config) {
  const result = [];
  for (var i = 0; i < 12; i++) {
    for (var j = 0; j < 7; j++) {
      const randomColor = getRgbSpreadRandomHexTriplet(laserConfig.testColor);
      if (!(i > 4 && i < 8 && j > 1 && j < 5)) {
        var item = createSpawnButton({
          x: i,
          y: j,
          radius: 50,
          activeColor: randomColor[2],
          growColor: randomColor[1],
          color: randomColor[0],
        });
        result.push(item);
      }
    }
  }
  return result;
}
export function checkBorderAndSlowDown(item, margin = 75) {
  if (item.getX() < margin) {
    item.setX(margin);
    item.setSpeedX(0);
  }
  if (item.getY() < margin) {
    item.setY(margin);
    item.setSpeedY(0);
  }
  if (item.getX() > 1920 - margin) {
    item.setX(1920 - margin);
    item.setSpeedX(0);
  }
  if (item.getY() > 1080 - margin) {
    item.setY(1080 - margin);
    item.setSpeedY(0);
  }
}
var time = Math.random() * 1000;

var NEXT_LEVEL_INTERVAL = 20;
var nextLevel = NEXT_LEVEL_INTERVAL;

export default {
  name: 'Laser-CowHorde',
  description: `
  
  Hier werden gleich 4 Blasen pro Nest erzeugt.

  Die Blasen "fliehen" vor deinem Laser-Pointer.
    
    
  Versucht zusammen die 'Herde' zu steuern und
  den Hindernissen auszuweichen so lange es geht.

  `,

  image: 'media/img/gametitles/laser-cowhorde-###4###.png',
  init: function (data) {
    console.log('init game laser cowhorde');
    spawnButtons = createSpawnButtons({});
    buttonsSpawnScreen = createButtonsSpawnScreen();
    buttonsGameOverScreen = createButtonsGameOverScreen();
  },
  handle: function (grid, elapsed) {
    gameTime += elapsed;

    nextLevel -= elapsed;
    if (nextLevel < 0) {
      enemies.push(createFlapAndHordeEnemy(enemies, 0.2));
      nextLevel = NEXT_LEVEL_INTERVAL;
      if (Math.floor(gameTime / NEXT_LEVEL_INTERVAL) % 2 === 0) {
        var audio = new Audio(soundLevelUp1);
        audio.play();
      } else {
        var audio = new Audio(soundLevelUp2);
        audio.play();
      }
    }

    if (lastResolution != grid.length) {
      // init();
      lastResolution = grid.length;
    }
    const ctx = MasterCanvas.get2dContext();

    time += elapsed * 0.1;

    switch (gameState) {
      case 'spawn':
        this.handleSpawnScreen(grid, elapsed);
        break;
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
    this.renderLandscape(wonTime);
    enemies.forEach((item) => item.update(ctx, 0, gameTime));
    buttonsGameOverScreen.forEach((item) => item.handle(grid, elapsed));

    this.renderDeathgram(ctx);
    renderTextDropShadow({
      ctx,
      text: 'Laser-Horde',
      fontSize: '150px',
      fillStyle: getRgbSpreadHex(laserConfig.testColor, 0.4),
      x: laserConfig.canvasResolution.width / 2,
      y: 200,
    });
    renderTextDropShadow({
      ctx,
      text: `You reached distance: ${wonTime.toFixed(2)}
      
      Todays best is: ${bestWonTime.toFixed(2)}
      
      In Total ${startAmount} cows went on a journey
      `,
      fontSize: '50px',
      fillStyle: getRgbSpreadHex(laserConfig.testColor, 0.5),
      x: laserConfig.canvasResolution.width / 2,
      y: 400,
    });
  },
  handleGameScreen(grid, elapsed) {
    const ctx = MasterCanvas.get2dContext();
    this.renderLandscape(gameTime);

    repellAll({ workArray: bubbles, targetArray: bubbles, elapsed });
    checkCollisionWithObstacles();
    enemies.forEach((item) => item.update(ctx, elapsed, gameTime));
    bubbles.forEach((item) => item.handle(grid, elapsed));
    if (bubbles.length === 0) {
      wonTime = gameTime;
      bestWonTime = Math.max(wonTime, bestWonTime);
      gameState = 'gameover';

      bgSound.pause();
      var audio = new Audio(soundGameOver);
      audio.play();
    }
    bubbles.forEach(item => checkBorderAndSlowDown(item));
    renderEnemiesRightSidePreview(ctx, enemies);
  },
  renderDeathgram(ctx) {
    if (deathgram.length > 0) {
      ctx.beginPath();
      var width = 1920;
      var height = 1080;
      ctx.strokeStyle = '#884444';
      ctx.lineWidth = 10;
      ctx.moveTo(0, 1080 - (deathgram[0].count / startAmount) * height);

      for (var i = 0; i < deathgram.length; i++) {
        console.log(deathgram[i]);
        // ctx.moveTo((deathgram[i].time / gameTime) * width, 1000);
        ctx.lineTo(
          (deathgram[i].time / (wonTime || gameTime)) * width,
          1080 - (deathgram[i].count / startAmount) * height
        );
      }
      ctx.stroke();
    }
  },
  renderLandscape(gameTime) {
    const ctx = MasterCanvas.get2dContext();
    renderTextDropShadow({
      ctx,
      text:
        bubbles.length +
        '/' +
        startAmount +
        '                ' +
        gameTime.toFixed(2),
      fontSize: '150px',
      fillStyle: getRgbSpreadHex(laserConfig.testColor, 0.4),
      x: laserConfig.canvasResolution.width / 2,
      y: 1080 - 50,
    });
    renderTextDropShadow({
      ctx,
      text: `${enemies.length} Level`,
      fontSize: '50px',
      fillStyle: getRgbSpreadHex(laserConfig.testColor, 0.4),
      x: 1920 / 2,
      y: 1080 - 50,
    });
    drawSineLine({
      ctx,
      yLevel: 0,
      width: 2,
      amplitude: 50,
      color: getRgbSpreadHex(laserConfig.testColor, 0.5),
      t: 100 + time,
      lineWidth: 5,
    });
    drawSineLine({
      ctx,
      yLevel: 1080 / 2 + 400,
      width: 13,
      amplitude: 50,
      color: getRgbSpreadHex(laserConfig.testColor, 0.3),
      t: 200 + time,
      lineWidth: 5,
    });
    drawSineLine({
      ctx,
      yLevel: 1080 / 2 + 400,
      width: 3,
      amplitude: 100,
      color: getRgbSpreadHex(laserConfig.testColor, 0.6),
      t: 300 + time,
      lineWidth: 2,
    });
    drawSineLine({
      ctx,
      yLevel: 1080 / 2,
      width: 5,
      amplitude: 200,
      color: getRgbSpreadHex(laserConfig.testColor, 0.55),
      t: 400 + time,
      lineWidth: 1,
    });
  },
  handleSpawnScreen(grid, elapsed) {
    const ctx = MasterCanvas.get2dContext();
    if (bubbles.length > 0) {
      buttonsSpawnScreen.forEach((item) => item.handle(grid, elapsed));
    }
    spawnButtons.forEach((item) => item.handle(grid, elapsed));
    repellAll({ workArray: bubbles, targetArray: bubbles, elapsed });
    bubbles.forEach((item) => item.handle(grid, elapsed));

    bubbles.forEach((item) => {
      if (item.getX() < 50) {
        item.setX(50);
        item.setSpeedX(0);
      }
      if (item.getY() < 50) {
        item.setY(50);
        item.setSpeedY(0);
      }
      if (item.getX() > 1920 - 50) {
        item.setX(1920 - 50);
        item.setSpeedX(0);
      }
      if (item.getY() > 1080 - 50) {
        item.setY(1080 - 50);
        item.setSpeedY(0);
      }
    });
  },
};
