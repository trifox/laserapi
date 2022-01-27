import {
  renderTextDropShadow,
  removeItemFromArray,
  rgbToHex,
  drawLine,
  drawNgon,
  renderTextOutline,
} from '../util.js';

var laserConfig = require('../LaserApiConfig.js').default;
var MasterCanvas = require('../MasterCanvas').default;
var guiFillButton = require('./gui/fillButton').default;
var guiFollowCircle = require('./gui/followCircle').default;

import soundSpawn from '../../../public/media/496199__luminousfridge__player-spawned.ogg';
import soundExplode from '../../../public/media/414346__bykgames__explosion-far.wav';
import soundGameOver from '../../../public/media/70299__kizilsungur__sonar.wav';
import soundBG from '../../../public/media/522110__setuniman__cheeky-1t41b.wav';
import soundEat from '../../../public/media/369952__mischy__plop-1.wav';
// import soundBG from '../../../public/media/522110__setuniman__cheeky-1t41b.wav';
/**
 * audio imports
 */
import soundSpawn from '../../../public/media/496199__luminousfridge__player-spawned.ogg';
import { lerp, lerp2dArray, slerp } from '../math.js';

var enemies = createEnemies();

function createEnemies() {
  return [createEnemy(), createEnemy(), createEnemy()];
}
var bgSound;
var spawnButtons = [];
var bubbles = [];
var gameState = 'spawn';
var help = false;
var enemyRowCounter = 0;
var gameTime = 0;
var wonTime = 0;
var foodGrid = [];
var startAmount = 0;
var bestWonTime = Number.MAX_SAFE_INTEGER;
const DOTCOUNT = 10;
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
var buttonsSpawnScreen = [
  guiFillButton({
    label: 'Start',
    posX: 1920 / 2,
    posY: 1080 / 2,
    speedDown: 50,
    speedUp: 100,
    edges: Math.floor(3 + Math.random() * 8),
    edges2: Math.floor(3 + Math.random() * 8),
    angle: Math.random() * 360,
    activeValue: 90,
    radius: 200,
    normalColor: 'green',
    onEnterActive: (sender) => {
      gameState = 'game';
      gameTime = 0;
      startAmount = bubbles.length;
      enemies = createEnemies();
      bgSound = new Audio(soundBG);
      bgSound.loop = true;
      foodGrid = createFoodGrid();
      bgSound.play();
    },
    onExitActive: (sender) => {},
  }),
  helpButton,
];
var buttonsGameOverScreen = [
  guiFillButton({
    label: 'Spawn Again',
    posX: 1920 / 2,
    posY: 1080 / 2,
    speedDown: 50,
    speedUp: 100,
    edges: 3,
    radius: 200,
    normalColor: 'green',
    onEnterActive: (sender) => {
      gameState = 'spawn';
      gameTime = 0;
      spawnButtons = createSpawnButtons();
      enemies = createEnemies();
      bubbles = [];
    },
  }),
  helpButton,
];

function renderDots(ctx) {
  for (var i = 0; i < DOTCOUNT; i++) {
    for (var j = 0; j < DOTCOUNT; j++) {
      if (foodGrid[i][j] > 0) {
        ctx.fillStyle = 'lightgreen';
        ctx.beginPath();
        ctx.arc(
          i * (1920 / DOTCOUNT) + 1920 / DOTCOUNT / 2,
          j * (1080 / DOTCOUNT) + 1080 / DOTCOUNT / 2,
          10,
          0,
          2 * Math.PI
        );
        ctx.fill();
      }
    }
  }
}
function getBubbleDist(bubble, obstacle) {
  return Math.sqrt(
    Math.pow(
      Math.abs(bubble.getX() % 1920) - Math.abs(obstacle.getX() % 1920),
      2
    ) +
      Math.pow(
        Math.abs(bubble.getY() % 1080) - Math.abs(obstacle.getY() % 1080),
        2
      )
  );
}
function getBubbleDiff(bubble, obstacle) {
  return [
    Math.abs(bubble.getX() % 1920) - Math.abs(obstacle.getX() % 1920),
    Math.abs(bubble.getX() % 1080) - Math.abs(obstacle.getY() % 1920),
  ];
}
function checkCollisionWithObstacles() {
  const todelete = [];
  const todeleteobstacles = [];

  bubbles.forEach((bubble) => {
    enemies.forEach((obstacle) => {
      if (
        getBubbleDist(bubble, obstacle) <
        bubble.getRadius() + obstacle.getSize()
      ) {
        console.log(
          'bubble radius size',
          bubble.getRadius(),
          obstacle.getSize()
        );
        if (bubble.getRadius() < obstacle.getSize()) {
          todelete.push(bubble);
          obstacle.setSize(obstacle.getSize() + bubble.getRadius() * 0.1);
        } else {
          todeleteobstacles.push(obstacle);
          bubble.setRadius(obstacle.getSize() * 0.1 + bubble.getRadius());
        }
      }
    });
  });
  if (todelete.length > 0) {
    var audio = new Audio(soundExplode);
    audio.play();
  }
  todelete.forEach((item) => removeItemFromArray(bubbles, item));
  todeleteobstacles.forEach((item) => removeItemFromArray(enemies, item));
}
function repellAll(workArray) {
  // console.log(';repellall', workArray);
  function getBubbleDif(a, b) {
    return [a.getX() - b.getX(), a.getY() - b.getY()];
  }
  function getBubbleDist(a, b) {
    return Math.sqrt(
      Math.pow(a.getX() - b.getX(), 2) + Math.pow(a.getY() - b.getY(), 2)
    );
  }
  workArray.forEach((bubble1) => {
    workArray.forEach((bubble2) => {
      if (bubble1 !== bubble2) {
        // console.log('testing', bubble1, bubble2);
        const dist = getBubbleDist(bubble1, bubble2);
        if (dist < bubble1.getRadius() + bubble2.getRadius()) {
          //repell
          // console.log('repelling', bubble1, bubble2);
          var dir1 = getBubbleDif(bubble1, bubble2);
          var dir2 = [-dir1[0], -dir1[1]];
          var newDirBubble1 = lerp2dArray(
            [bubble1.getSpeedX(), bubble1.getSpeedY()],
            dir1,
            3 * elapsed
          );
          newDirBubble1 = [
            bubble1.getSpeedX() - dir2[0] * elapsed * 0.01,
            bubble1.getSpeedY() - dir2[1] * elapsed * 0.01,
          ];
          var newDirBubble2 = lerp2dArray(
            [bubble2.getSpeedX(), bubble2.getSpeedY()],
            dir2,
            3 * elapsed
          );
          newDirBubble2 = [
            bubble2.getSpeedX() - dir1[0] * elapsed * 0.01,
            bubble2.getSpeedY() - dir1[1] * elapsed * 0.01,
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

function createFoodGrid() {
  var x = [];
  for (var i = 0; i < DOTCOUNT + 1; i++) {
    x[i] = new Array(DOTCOUNT + 1);
  }
  return x;
}
foodGrid = createFoodGrid();
function createEnemy() {
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

  function init() {
    enemyRowCounter++;
    x = 1920;
    y = Math.floor(Math.random() * 10) * 90 + 50;
    currentSpeed = Math.random() * 150 + 25;
    currentSpeed = 100;
    currentAngle1 = Math.random() * 360;
    currentAngle2 = Math.random() * 360;
    currentAngle3 = Math.random() * 360;
    currentEdges1 = 3 + Math.floor(Math.random() * 5);
    currentEdges2 = 3 + Math.floor(Math.random() * 12);
    currentEdges3 = 3 + Math.floor(Math.random() * 12);
    currentFlapspeed = Math.random() * 3;
    currentFlapspeed2 = Math.random() * 3;
    dirX = Math.random() * 300 - 150;
    dirY = Math.random() * 300 - 150;
    currentRadius = Math.random() * 100 + 100;
    myTime = Math.random() * 1000;
    speedx = Math.random() * 150 + 25;
    speedy = Math.random() * 150 + 25;
    currentColor = rgbToHex(
      Math.floor(Math.random() * 128),
      Math.floor(Math.random() * 200 + 56),
      Math.floor(Math.random() * 200 + 56)
    );
  }
  var myTime = 0;
  var dirX = 0;
  var dirY = 0;
  var speedx = Math.random() * 25 + 25;
  var speedy = Math.random() * 25 + 25;
  init();
  const myself = {
    getX: () => x,
    getY: () => y,
    getSize: () => currentRadius,
    setSize: (x) => {
      currentRadius = x;
    },

    update(ctx, elapsed = 1) {
      myTime += elapsed;
      // move in direction of closest bubbles
      var closest = bubbles[0];
      var dist = Number.MAX_SAFE_INTEGER;
      bubbles.forEach((bubble) => {
        // console.log('bubble and obst is', bubble, myself);
        if (getBubbleDist(bubble, myself) < dist) {
          // console.log('setting bubble and obst is', bubble, myself);
          closest = bubble;
          dist = getBubbleDist(bubble, myself);
        }
      });
      if (closest) {
        var dist = getBubbleDist(closest, myself);
        var diff = getBubbleDiff(closest, myself);
        if (myself.getSize() > closest.getRadius()) {
          // push towards bubble
          dirX = lerp(dirX, (diff[0] / dist) * speedx, elapsed * 2);
          dirY = lerp(dirY, (diff[1] / dist) * speedy, elapsed * 2);
        } else {
          // push away from bubble
          console.log(dist, diff);
          dirX = lerp(dirX, -(diff[0] / dist) * speedx, elapsed * 2);
          dirY = lerp(dirY, -(diff[1] / dist) * speedy, elapsed * 2);
        }
      }
      if (x < 0) x = x + 1920;
      if (y < 0) y = y + 1080;
      if (x > 1920) x = x - 1920;
      if (y > 1080) y = y - 1080;
      x = x + dirX * elapsed;
      y = y + dirY * elapsed;
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
  return myself;
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
    radius: radius / 2,
  });

  var orighandle = bubble.handle; // warning cross
  bubble.handle = function handle(grid) {
    orighandle(grid);
    if (bubble.getRadius() > 200) {
      if (Math.floor((gameTime * 1000) % 100) == 0) {
        bubble.setColor('lightblue');
      } else {
        bubble.setColor('lightgreen');
      }
    }
    var foodx = Math.floor(bubble.getX() / (1920 / DOTCOUNT));
    var foody = Math.floor(bubble.getY() / (1080 / DOTCOUNT));
    if (foodx >= 0 && foody >= 0 && foodx < 10 && foody < 10)
      if (foodGrid[foodx][foody] > 0) {
        foodGrid[foodx][foody] = 0;
        bubble.setRadius(bubble.getRadius() + 10);

        var audio = new Audio(soundEat);
        audio.play();
      }
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
          color: butt.getActiveColor(),
        })
      );
    },
    onExitActive: (sender) => {},
  });
  return butt;
}
function createSpawnButtons(config) {
  const result = [];
  for (var i = 0; i < 12; i++) {
    for (var j = 0; j < 7; j++) {
      const randomColor = [
        Math.floor(Math.random() * 128),
        Math.floor(Math.random() * 256),
        Math.floor(Math.random() * 256),
      ];
      var item = createSpawnButton({
        x: i,
        y: j,
        radius: 50,
        activeColor: rgbToHex(randomColor[0], randomColor[1], randomColor[2]),
        growColor: rgbToHex(
          Math.floor(randomColor[0] * 0.75),
          Math.floor(randomColor[1] * 0.75),
          Math.floor(randomColor[2] * 0.75)
        ),
        color: rgbToHex(
          Math.floor(randomColor[0] * 0.5),
          Math.floor(randomColor[1] * 0.5),
          Math.floor(randomColor[2] * 0.5)
        ),
      });
      result.push(item);
    }
  }
  return result;
}
spawnButtons = createSpawnButtons({});
function sin3(x) {
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
var lastTime = 0;
var elapsed = 0;
var foodSpawnCounter = 0;
var foodSpawnInterval = 3;
export default {
  name: 'Laser-Shark',
  init: function (data) {
    console.log('init game laser flappy birdy ');
  },
  handle: function (grid) {
    var currentTime = performance.now();
    elapsed = (currentTime - lastTime) / 1000;
    gameTime += elapsed;
    lastTime = currentTime;

    if (lastResolution != grid.length) {
      // init();
      lastResolution = grid.length;
    }
    const ctx = MasterCanvas.get2dContext();

    time += elapsed * 0.1;

    switch (gameState) {
      case 'spawn':
        this.handleSpawnScreen(grid);
        break;
      case 'game':
        this.handleGameScreen(grid);
        break;
      case 'gameover_won':
        this.handleGameOverScreenWon(grid);
        break;
      case 'gameover_lost':
        this.handleGameOverScreenLost(grid);
        break;
    }
  },

  handleGameOverScreenWon(grid) {
    const ctx = MasterCanvas.get2dContext();
    this.renderLandscape(wonTime);
    enemies.forEach((item) => item.update(ctx, 0));
    buttonsGameOverScreen.forEach((item) => item.handle(grid));
    renderTextDropShadow({
      ctx,
      text: 'Laser-Shark',
      fontSize: '150px',
      fillStyle: 'red',
      x: laserConfig.canvasResolution.width / 2,
      y: 200,
    });
    renderTextDropShadow({
      ctx,
      text: `You reached distance: ${wonTime.toFixed(2)}

      You made it!

      Todays best is: ${bestWonTime.toFixed(2)}
      
      In Total ${startAmount} bubbles went in the pod
      `,
      fontSize: '50px',
      fillStyle: 'yellow',
      x: laserConfig.canvasResolution.width / 2,
      y: 400,
    });
  },
  handleGameOverScreenLost(grid) {
    const ctx = MasterCanvas.get2dContext();
    this.renderLandscape(wonTime);
    enemies.forEach((item) => item.update(ctx, 0));
    buttonsGameOverScreen.forEach((item) => item.handle(grid));
    renderTextDropShadow({
      ctx,
      text: 'Laser-Shark',
      fontSize: '150px',
      fillStyle: 'red',
      x: laserConfig.canvasResolution.width / 2,
      y: 200,
    });
    renderTextDropShadow({
      ctx,
      text: `You reached distance: ${wonTime.toFixed(2)}

      The Sharks ate you all! 
      
      In Total ${startAmount} bubbles went in the pod
      `,
      fontSize: '50px',
      fillStyle: 'yellow',
      x: laserConfig.canvasResolution.width / 2,
      y: 400,
    });
  },
  handleGameScreen(grid) {
    const ctx = MasterCanvas.get2dContext();
    this.renderLandscape(gameTime);

    // spawn food
    foodSpawnCounter += elapsed;
    if (foodSpawnCounter > foodSpawnInterval) {
      foodSpawnCounter = 0;
      console.log('spawnie food');
      // spawn a new dots
      foodGrid[Math.floor(Math.random() * DOTCOUNT)][
        Math.floor(Math.random() * DOTCOUNT)
      ] = 1;
    }
    //
    renderDots(ctx);

    repellAll(bubbles);
    checkCollisionWithObstacles();
    enemies.forEach((item) => item.update(ctx, elapsed));
    bubbles.forEach((item) => item.handle(grid));
    if (enemies.length === 0) {
      // won by all sharks eaten
      // lost by all bubbles eaten
      wonTime = gameTime;
      bestWonTime = Math.min(wonTime, bestWonTime);
      gameState = 'gameover_won';

      bgSound.pause();
      var audio = new Audio(soundGameOver);
      audio.play();
    }
    if (bubbles.length === 0) {
      // lost by all bubbles eaten
      wonTime = gameTime;
      bestWonTime = Math.max(wonTime, bestWonTime);
      gameState = 'gameover_lost';

      bgSound.pause();
      var audio = new Audio(soundGameOver);
      audio.play();
    }
    bubbles.forEach((item) => {
      if (item.getX() < 0) item.setX(item.getX() + 1920);
      if (item.getY() < 0) item.setY(item.getY() + 1080);
      if (item.getX() > 1920) item.setX(item.getX() - 1920);
      if (item.getY() > 1080) item.setY(item.getY() - 1080);
    });
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
      fillStyle: '#66aaff',
      x: laserConfig.canvasResolution.width / 2,
      y: 1080 - 50,
    });
    drawSineLine({
      ctx,
      yLevel: 0,
      width: 2,
      amplitude: 50,
      color: '#00ffff',
      t: 100 + time,
      lineWidth: 5,
    });
    drawSineLine({
      ctx,
      yLevel: 1080 / 2 + 400,
      width: 13,
      amplitude: 50,
      color: '#00cccc',
      t: 200 + time,
      lineWidth: 5,
    });
    drawSineLine({
      ctx,
      yLevel: 1080 / 2 + 400,
      width: 3,
      amplitude: 100,
      color: '#00aaaa',
      t: 300 + time,
      lineWidth: 2,
    });
    drawSineLine({
      ctx,
      yLevel: 1080 / 2,
      width: 5,
      amplitude: 200,
      color: '#008888',
      t: 400 + time,
      lineWidth: 1,
    });
  },
  handleSpawnScreen(grid) {
    const ctx = MasterCanvas.get2dContext();
    if (bubbles.length > 0) {
      buttonsSpawnScreen.forEach((item) => item.handle(grid));
    }
    spawnButtons.forEach((item) => item.handle(grid));
    repellAll(bubbles);
    bubbles.forEach((item) => item.handle(grid));
    if (help) {
      renderTextDropShadow({
        ctx,
        text: 'Laser-Flapping',
        fontSize: '150px',
        fillStyle: 'red',
        x: laserConfig.canvasResolution.width / 2,
        y: 200,
      });
      ctx.fillStyle = '#00000088';
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

The goal is to become a huge fish in the pool, eat food particles to grow as big as the other sharks 

Have Fun!

Copyright 2022 C.Kleinhuis and Georg Buchrucker 
Copyright 2022 Frontend Solutions GmbH
Copyright 2022 I-Love-Chaos`,
        fontSize: '26px',
        lineHeight: 25,
        fillStyle: '#00ffff',
        x: laserConfig.canvasResolution.width / 2,
        y: 250,
        dropDistX: 4,
        dropDistY: 4,
      });
    }
  },
};
