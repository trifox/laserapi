import {
  renderTextDropShadow,
  removeItemFromArray,
  rgbToHex,
  drawLine,
  drawNgon,
  renderTextOutline,
  getRgbSpreadHex,
  getRgbSpread,
  getRgbSaturation,
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
import { lerp2dArray, slerp } from '../math.js';
import { repellAll } from './game-017-thehorde.js';

var enemies = createEnemies();

function createEnemies() {
  enemies = [];

  enemies.push(createFlapAndHordeEnemy(enemies));
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
var helpButton = guiFillButton({
  label: 'Help',
  posX: 1920 - 100,
  posY: 1080 - 100,
  speedDown: 50,
  speedUp: 100,
  edges: 32,
  activeValue: 35,
  radius: 50,
  normalColor: '#00aa00',
  onEnterActive: (sender) => {
    // initialise game
    // buttons = initialiseTeams();
    // enemies = [];
    help = true;
    // won = undefined;
  },
  onExitActive: (sender) => {
    // initialise game
    // buttons = initialiseTeams();
    // enemies = [];
    help = false;
    // won = undefined;
  },
});
var buttonsSpawnScreen = createSpawnButtonsScreen();

function createSpawnButtonsScreen() {
  return [
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
      normalColor: getRgbSpreadHex(laserConfig.testColor, 0.5),
      growColor: getRgbSpreadHex(laserConfig.testColor, 0.4),
      activeColor: getRgbSpreadHex(laserConfig.testColor, 0.3),
      onEnterActive: (sender) => {
        gameState = 'game';
        gameTime = 0;
        startAmount = bubbles.length;

        spawnButtons = createSpawnButtons();
        enemies = createEnemies();
        bgSound = new Audio(soundBG);
        bgSound.loop = true;
        nextLevel = NEXT_LEVEL_INTERVAL;
        bgSound.play();
      },
      onExitActive: (sender) => { },
    }),
    // helpButton,
  ];
}
const createButtonsGameOverScreen = () => [
  guiFillButton({
    label: 'Spawn Again',
    posX: 1920 / 2,
    posY: 1080 / 2,
    speedDown: 50,
    speedUp: 100,
    edges: 3,
    keyCode: 'Space',
    radius: 200,
    normalColor: getRgbSpreadRandomHex(laserConfig.testColor),
    growColor: getRgbSpreadRandomHex(laserConfig.testColor),
    activeColor: getRgbSpreadRandomHex(laserConfig.testColor),
    onEnterActive: (sender) => {
      gameState = 'spawn';
      gameTime = 0;
      spawnButtons = createSpawnButtons();
      buttonsGameOverScreen = createButtonsGameOverScreen();
      enemies = createEnemies();
    },
  }),
  // helpButton,
];
var buttonsGameOverScreen = createButtonsGameOverScreen();

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
  todelete.forEach((item) => removeItemFromArray(bubbles, item));
}
var lastResolution = -1;
var enemyRowCounter = 0;
export function createFlapAndHordeEnemy(enemiesIn = enemies, speed = 0.4) {
  var x = 0;
  var y = 0;
  var currentRadius = 100;
  var currentEdges1 = 100;
  var currentEdges2 = 100;
  var currentEdges3 = 100;
  var currentAngle1 = Math.random() * 360;
  var currentAngle2 = Math.random() * 360;
  var currentAngle3 = Math.random() * 360;
  var currentSpeed = 1;
  var currentColor = 1;
  var currentFlapspeed = 1;
  var currentFlapspeed2 = 1;
  var age = 0;
  function init() {
    age++;
    // max x
    const maxX =
      enemiesIn && enemiesIn.reduce
        ? enemiesIn.reduce((prev, curr) => {
          return Math.max(prev, curr.getX() + curr.getSize() * 2);
        }, 1920)
        : 1920;
    enemyRowCounter++;
    // currentSpeed = Math.random() * 150 + 25;
    currentSpeed = 100;
    currentAngle1 = Math.random() * 360;
    currentAngle2 = Math.random() * 360;
    currentAngle3 = Math.random() * 360;
    currentEdges1 = 3 + Math.floor(Math.random() * 12);
    currentEdges2 = 3 + Math.floor(Math.random() * 12);
    currentEdges3 = 3 + Math.floor(Math.random() * 12);
    currentFlapspeed = Math.random() * 3;
    currentFlapspeed2 = Math.random() * 3;
    currentRadius = Math.random() * 100 + 50;
    myTime = Math.random() * 1000;
    x = maxX + currentRadius + Math.random() * (1920 / (age * 2 + 2));
    y = Math.floor(Math.random() * 1080);
    currentColor = getRgbSpreadHex(
      laserConfig.testColor,
      0.3 + Math.random() * 0.4,
      Math.random() * 0.5 + 0.5,
      Math.random() * 0.5 + 0.5
    );
  }
  var myTime = 0;
  init();
  return {
    getX: () => x,
    getY: () => y,
    getSize: () => currentRadius,

    update(ctx, elapsed = 0, gameTime) {
      myTime += elapsed;
      x =
        x -
        (currentSpeed * (1 + Math.floor(gameTime / NEXT_LEVEL_INTERVAL) * speed)) *
        elapsed;
      if (x < -currentRadius) {
        init();
      }
      drawNgon({
        ctx,
        color: currentColor,
        Xcenter: x,
        Ycenter: y,
        size: currentRadius / 2,
        numberOfSides: currentEdges1,
        angle: currentAngle1,
      });
      drawNgon({
        ctx,
        color: currentColor,
        Xcenter: x,
        Ycenter: y,
        size: currentRadius / 4,
        numberOfSides: currentEdges2,
        angle: currentAngle2,
      });
      drawNgon({
        ctx,
        color: currentColor,
        Xcenter: x,
        Ycenter: y,
        size: currentRadius / 8,
        numberOfSides: currentEdges3,
        angle: currentAngle3,
      });
      for (var i = 0; i < 3; i++) {
        drawNgon({
          ctx,
          color: currentColor,
          Xcenter: x,
          Ycenter: y,
          size:
            currentRadius +
            sin3(i * currentFlapspeed2 + myTime * currentFlapspeed) * 25,
          numberOfSides: currentEdges1,
          angle: currentAngle2,
          lineWidth: 10,
        });
      }
    },
  };
}
function createBubble({
  x,
  y,
  radius = 50,
  color = 'red',
  edges = 5,
  edges2 = 5,
}) {
  var audio = new Audio(soundSpawn);
  audio.play();

  var bubble = guiFollowCircle({
    label: '',
    posX: x,
    posY: y,
    normalColor: color,
    edges,
    edges2,
    speedDown: 0.01,
    speedUp: 0.1,
    scanRadiusFactor: 1.5,
    radius: radius / 2,
  });

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
    edges2: Math.floor(3 + Math.random() * 8),
    angle: Math.random() * 360,
    activeValue: 90,
    radius: radius,
    growColor,
    activeColor,
    normalColor: color,
    onEnterActive: (sender) => {
      removeItemFromArray(spawnButtons, butt);
      bubbles.push(
        createBubble({
          x: butt.getX() + radius / 2,
          y: butt.getY() + radius / 2,
          radius: radius * 2,
          edges: butt.getEdges(),
          edges2: butt.getEdges2(),
          color: color,
        })
      );
    },
    onExitActive: (sender) => { },
  });
  return butt;
}
function createSpawnButtons(config) {
  const result = [];
  for (var i = 0; i < 12; i++) {
    for (var j = 0; j < 7; j++) {
      if (!(i > 4 && i < 8 && j > 1 && j < 5)) {
        const randomColor = getRgbSpreadRandomHexTriplet(laserConfig.testColor);
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
export function renderEnemiesRightSidePreview(ctx, enemies) {
  // render next upcoming line
  var maxEnemy = enemies.reduceRight(
    (prev, current) => Math.max(prev, current.getX() - 1920),
    0
  );
  enemies.forEach((enemy, index) => {
    if (enemy.getX() > 1920) {
      ctx.fillStyle = getRgbSpreadHex(
        laserConfig.testColor,
        0.4 + ((enemy.getX() - 1920) / maxEnemy) * 0.2
      );
      ctx.fillRect(
        1920 - 10,
        enemy.getY() - enemy.getSize(),
        10,
        enemy.getSize() * 2
      );
    }
  });
}
// spawnButtons = createSpawnButtons({});
export function sin3(x) {
  return (
    (Math.sin(x) +
      Math.sin(x * 2) +
      Math.sin(x * 4) +
      Math.sin(x / 2) +
      Math.sin(x / 4)) /
    5
  );
}
function drawSineLine({
  ctx,
  yLevel = 500,
  width = 1,
  amplitude = 200,
  color = 'red',
  t = 0,
  lineWidth = 3,
}) {
  var last = [];
  for (var x = 0; x < 1920; x += 100) {
    var ypos = yLevel + sin3(t + (x / 1920) * Math.PI * width) * amplitude;
    ctx.lineWidth = lineWidth;
    drawLine(ctx, last[0], last[1], x, ypos, color);
    last = [x, ypos];
  }
}
var time = Math.random() * 1000;
var NEXT_LEVEL_INTERVAL = 20;
var nextLevel = NEXT_LEVEL_INTERVAL;
export default {
  name: 'Laser-Flapping',
  description: `Inspiriert von Flappy Bird.
  
  Erzeuge zu anfang des Spiels Blasen, 
  die Blasen folgen deinem Laser-Pointer.

  Wenn alle ihre Blasen erzeugt haben wird das Spiel
  durch aktivieren des Start-Knopfes begonnen.

  Aufgabe ist es mit deiner Blase zu überleben,
  weiche den hindernissen aus.

  Sei aber auch vorsichtig mit Kollision anderer Blasen,
   diese versperren sich.
  
  `,
  image: 'media/img/gametitles/laser-flapping-###8###.png',
  init: function (data) {
    console.log('init game laser flappy birdy ');

    spawnButtons = createSpawnButtons();
    buttonsSpawnScreen = createSpawnButtonsScreen();
    buttonsGameOverScreen = createButtonsGameOverScreen();
  },
  handle: function (grid, elapsed) {
    gameTime += elapsed;

    nextLevel -= elapsed;
    if (nextLevel < 0) {
      enemies.push(createFlapAndHordeEnemy(enemies));
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

  handleGameOverScreen(grid, elapsed) {
    const ctx = MasterCanvas.get2dContext();
    this.renderLandscape(wonTime);
    enemies.forEach((item) => item.update(ctx, 0, gameTime));
    buttonsGameOverScreen.forEach((item) => item.handle(grid, elapsed));
    renderTextDropShadow({
      ctx,
      text: 'Laser-Flapping',
      fontSize: '150px',
      fillStyle: getRgbSpreadHex(laserConfig.testColor, 0.4),
      x: laserConfig.canvasResolution.width / 2,
      y: 200,
    });
    renderTextDropShadow({
      ctx,
      text: `You reached distance: ${wonTime.toFixed(2)}
      
      Todays best is: ${bestWonTime.toFixed(2)}
      
      In Total ${startAmount} bubbles went on a journey
      `,
      fontSize: '50px',
      fillStyle: getRgbSpreadHex(laserConfig.testColor, 0.55),
      x: laserConfig.canvasResolution.width / 2,
      y: 400,
    });
  },
  handleGameScreen(grid, elapsed) {
    const ctx = MasterCanvas.get2dContext();
    this.renderLandscape(gameTime);

    repellAll({ workArray: bubbles, targetArray: bubbles, elapsed });
    renderEnemiesRightSidePreview(ctx, enemies);
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
    // bubbles.forEach((item) => {
    //   bubbles.forEach((item) => {
    //     if (item.getX() < 0) item.setX(item.getX() + 1920);
    //     if (item.getY() < 0) item.setY(item.getY() + 1080);
    //     if (item.getX() > 1920) item.setX(item.getX() - 1920);
    //     if (item.getY() > 1080) item.setY(item.getY() - 1080);
    //   });
    // });
  },
  renderLandscape(gameTime, elapsed) {
    const ctx = MasterCanvas.get2dContext();
    renderTextDropShadow({
      ctx,
      text:
        bubbles.length +
        '/' +
        startAmount +
        '                 ' +
        gameTime.toFixed(2),
      fontSize: '150px',
      fillStyle: getRgbSpreadHex(laserConfig.testColor, 0.4),
      x: laserConfig.canvasResolution.width / 2,
      y: 1080 - 50,
    });
    renderTextDropShadow({
      ctx,
      text: `Level ${enemies.length}`,
      fontSize: '50px',
      fillStyle: getRgbSpreadHex(laserConfig.testColor, 0.5),
      x: 1920 / 2,
      y: 1080 - 50,
    });
    drawSineLine({
      ctx,
      yLevel: 0,
      width: 2,
      amplitude: 50,
      color: getRgbSpreadHex(laserConfig.testColor, 0.55),
      t: 100 + time,
      lineWidth: 5,
    });
    drawSineLine({
      ctx,
      yLevel: 1080 / 2 + 400,
      width: 13,
      amplitude: 50,
      color: getRgbSpreadHex(laserConfig.testColor, 0.6),
      t: 200 + time,
      lineWidth: 5,
    });
    drawSineLine({
      ctx,
      yLevel: 1080 / 2 + 400,
      width: 3,
      amplitude: 100,
      color: getRgbSpreadHex(laserConfig.testColor, 0.35),
      t: 300 + time,
      lineWidth: 2,
    });
    drawSineLine({
      ctx,
      yLevel: 1080 / 2,
      width: 5,
      amplitude: 200,
      color: getRgbSpreadHex(laserConfig.testColor, 0.6),
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
    if (help) {
      renderTextDropShadow({
        ctx,
        text: 'Laser-Flapping',
        fontSize: '150px',
        fillStyle: getRgbSpreadHex(laserConfig.testColor, 0.4),
        x: laserConfig.canvasResolution.width / 2,
        y: 200,
      });
      ctx.fillStyle = getRgbSpreadHex(laserConfig.testColor, 0.4);
      ctx.fillRect(
        laserConfig.canvasResolution.width * 0.05,
        220,
        laserConfig.canvasResolution.width * 0.9,
        laserConfig.canvasResolution.height * 0.5
      );
      renderTextOutline({
        ctx,
        text: `
This HELP text is displayed,
because you hovered over the HELP button in the bottom right corner.

The goal is to survive as long as possible
 by not colliding with obstacles

The game starts with a spawn area, each player can spawn its representative
take care for it and guide it through the obstacles as long as possible

Have Fun!

Copyright 2022 C.Kleinhuis and Georg Buchrucker 
Copyright 2022 Frontend Solutions GmbH
Copyright 2022 I-Love-Chaos`,
        fontSize: '26px',
        lineHeight: 25,
        fillStyle: getRgbSpreadHex(laserConfig.testColor, 0.4),
        x: laserConfig.canvasResolution.width / 2,
        y: 250,
        dropDistX: 4,
        dropDistY: 4,
      });
    }
  },
};
