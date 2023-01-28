import {
  renderTextDropShadow,
  removeItemFromArray,
  rgbToHex,
  drawLine,
  drawNgon,
  renderTextOutline,
  getRgbSpreadHex,
  getRgbSpreadRandomHex,
  getRgbSpreadRandomHexTriplet,
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
import { repellAll } from './game-017-thehorde.js';

var enemies = createEnemies();

function createEnemies() {
  return [createEnemy() ];
}
var bgSound;
var spawnButtons = [];
var bubbles = [];
var gameState = 'spawn';  
var gameTime = 0;
var wonTime = 0;
var foodGrid = [];
var startAmount = 0;
var bestWonTime = Number.MAX_SAFE_INTEGER;
const DOTCOUNT = 10; 
var buttonsSpawnScreen = [];

const createButtonsSpawnScreen = () => [
  guiFillButton({
    label: 'Start',
    posX: 1920 / 2,
    posY: 1080 / 2,
    speedDown: 10,
    keyCode:32,
    speedUp: 20,
    edges: Math.floor(3 + Math.random() * 8),
    edges2: Math.floor(3 + Math.random() * 8),
    angle: Math.random() * 360,
    activeValue: 90,
    radius: 200,
    normalColor: getRgbSpreadHex(laserConfig.testColor, 0.4),
    growColor: getRgbSpreadHex(laserConfig.testColor, 0.5),
    activeColor: getRgbSpreadHex(laserConfig.testColor, 0.6),
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
  // helpButton,
];
var buttonsGameOverScreen = [];

const createButtonsGameOverScreen = () => [
  guiFillButton({
    label: 'Spawn Again',
    posX: 1920 / 2,
    posY: 1080 / 2,
    speedDown: 12.5,
    speedUp: 25,
    edges: 3,
    keyCode:32,
    radius: 200,
    normalColor: getRgbSpreadHex(laserConfig.testColor, 0.4),
    growColor: getRgbSpreadHex(laserConfig.testColor, 0.5),
    activeColor: getRgbSpreadHex(laserConfig.testColor, 0.6),
    onEnterActive: (sender) => {
      gameState = 'spawn';
      gameTime = 0;
      spawnButtons = createSpawnButtons();
      enemies = createEnemies();
      bubbles = [];
    },
  }),
  // helpButton,
];

function renderDots(ctx) {
  for (var i = 0; i < DOTCOUNT; i++) {
    for (var j = 0; j < DOTCOUNT; j++) {
      if (foodGrid[i][j] > 0) {
        ctx.fillStyle = getRgbSpreadHex(laserConfig.testColor, 0.5);
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
    ( bubble.getX()  -  obstacle.getX() ),
      2
    ) +
      Math.pow(
  (bubble.getY()  - obstacle.getY() ),
        2
      )
  );
}
function getBubbleDiff(bubble, obstacle) {
  return [
     bubble.getX()  -obstacle.getX(),
    bubble.getY() -obstacle.getY() ,
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
  var currentColor = 1;
  var currentFlapspeed = 1;
  var currentFlapspeed2 = 1;

  function init() {
    window.onkeydown = function (e) { 
      
      if (e.key == " " ||
      e.code == "Space" ||      
      e.keyCode == 32      
  ) {
    // todo space start game handlin
    //your code
  }
    } 
    x = 1920;
    y = Math.floor(Math.random() * 10) * 90 + 50; 
    currentAngle1 = Math.random() * 360;
    currentAngle2 = Math.random() * 360;
    currentAngle3 = Math.random() * 360;
    currentEdges1 = 6 + Math.floor(Math.random() * 5);
    currentEdges2 = 6 + Math.floor(Math.random() * 12);
    currentEdges3 = 6 + Math.floor(Math.random() * 12);
    currentFlapspeed = Math.random() * 3;
    currentFlapspeed2 = Math.random() * 3;
    dirX = Math.random() * 300 - 150;
    dirY = Math.random() * 300 - 150;
    currentRadius = Math.random() * 100 + 100;
    myTime = Math.random() * 1000;
    speedx = Math.random() * 150 + 25;
    speedy = Math.random() * 150 + 25;
    currentColor = getRgbSpreadRandomHex(laserConfig.testColor);
  }
  var myTime = 0;
  var dirX = 0;
  var dirY = 0;
  var speedx = Math.random() * 25 + 15;
  var speedy = Math.random() * 25 + 15;
  init();
  const myself = {
    getX: () => x,
    getY: () => y,
    getSize: () => currentRadius,
    setSize: (x) => {
      currentRadius = x;
    },

    update(ctx, elapsed) {
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

          // dirX=(diff[0] / dist) * speedx
          // dirY=(diff[1] / dist) * speedy

        } else {
          // push away from bubble
          console.log(dist, diff);
          dirX = lerp(dirX, -(diff[0] / dist) * speedx, elapsed * 2);
          dirY = lerp(dirY, -(diff[1] / dist) * speedy, elapsed * 2);
        }

      }
      if (x < 50) x =50;
      if (y < 50) y = 50;
      if (x > 1920 - 50) x =1920 - 50;
      if (y > 1080 - 50) y =1080 - 50;
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
function createBubble({ x, y, radius = 50, color, edges = 5, edges2 = 5 }) {
  var audio = new Audio(soundSpawn);
  audio.play();

  var bubble = guiFollowCircle({
    label: '',
    posX: x,
    posY: y,
    normalColor: color,
    scanRadiusFactor: 1.5,
    edges,
    edges2,
    speedDown: 0.01,
    speedUp: 0.1,
    radius: radius / 2,
  });

  var orighandle = bubble.handle; // warning cross
  bubble.handle = function handle(grid, elapsed) {
    orighandle(grid, elapsed);
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
          color: butt.getColor(),
        })
      );
    },
    onExitActive: (sender) => {},
  });
  return butt;
}
function createSpawnButtons() {
  const result = [];
  for (var i = 0; i < 12; i++) {
    for (var j = 0; j < 7; j++) {
      const randomcolor = getRgbSpreadRandomHexTriplet(laserConfig.testColor);
      if (!(i > 4 && i < 8 && j > 1 && j < 5)) {
        var item = createSpawnButton({
          x: i,
          y: j,
          radius: 50,
          activeColor: randomcolor[2],
          growColor: randomcolor[1],
          color: randomcolor[0],
        });
        result.push(item);
      }
    }
  }
  return result;
}
spawnButtons = createSpawnButtons();
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
var foodSpawnCounter = 0;
var foodSpawnInterval = 3;
export default {
  name: 'Laser-Shark',
  description: `
  
    Erzeuge Blasen mit dem Laser-Pointer,
   welche dem Laser-Pointer folgen.
  

  Starte das Spiel 
  durch aktivieren des Start-Knopfes.
  

  Aufgabe des Spiels ist es die Hai-Fische zu besiegen,
  indem du kleine punkte futterst bis du größer bist als die Haie.`,
  init: function (data) {
    console.log('init game laser flappy birdy ');
    spawnButtons = createSpawnButtons();
    enemies = createEnemies();
    buttonsGameOverScreen = createButtonsGameOverScreen();
    buttonsSpawnScreen = createButtonsSpawnScreen();
  },
  handle: function (grid, elapsed) {
    gameTime += elapsed;

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
      case 'gameover_won':
        this.handleGameOverScreenWon(grid, elapsed);
        break;
      case 'gameover_lost':
        this.handleGameOverScreenLost(grid, elapsed);
        break;
    }
  },

  handleGameOverScreenWon(grid, elapsed) {
    const ctx = MasterCanvas.get2dContext();
    this.renderLandscape(wonTime);
    enemies.forEach((item) => item.update(ctx, elapsed));
    // console.log('elapsed seems to be', elapsed);
    buttonsGameOverScreen.forEach((item) => item.handle(grid, elapsed));
    renderTextDropShadow({
      ctx,
      text: 'Laser-Shark',
      fontSize: '150px',
      fillStyle: getRgbSpreadHex(laserConfig.testColor, 0.5),
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
      fillStyle: getRgbSpreadHex(laserConfig.testColor, 0.4),
      x: laserConfig.canvasResolution.width / 2,
      y: 400,
    });
  },
  handleGameOverScreenLost(grid, elapsed) {
    const ctx = MasterCanvas.get2dContext();
    this.renderLandscape(wonTime);
    enemies.forEach((item) => item.update(ctx, elapsed));
    // console.log('elapsed seems to be', elapsed);
    buttonsGameOverScreen.forEach((item) => item.handle(grid, elapsed));
    renderTextDropShadow({
      ctx,
      text: 'Laser-Shark',
      fontSize: '150px',
      fillStyle: getRgbSpreadHex(laserConfig.testColor, 0.5),
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
      fillStyle: getRgbSpreadHex(laserConfig.testColor, 0.6),
      x: laserConfig.canvasResolution.width / 2,
      y: 400,
    });
  },
  handleGameScreen(grid, elapsed) {
    const ctx = MasterCanvas.get2dContext();
    this.renderLandscape(gameTime);

    // spawn food
    foodSpawnCounter += elapsed;
    if (foodSpawnCounter > foodSpawnInterval/(bubbles.length/3)) {
      foodSpawnCounter = 0;
      console.log('spawnie food');
      // spawn a new dots
      foodGrid[Math.floor(Math.random() * DOTCOUNT)][
        Math.floor(Math.random() * DOTCOUNT)
      ] = 1;
    }
    //
    renderDots(ctx);

    repellAll({ workArray: bubbles, targetArray: bubbles, elapsed });
    checkCollisionWithObstacles();
    enemies.forEach((item) => item.update(ctx, elapsed));
    bubbles.forEach((item) => item.handle(grid, elapsed));
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
      fillStyle: getRgbSpreadHex(laserConfig.testColor, 0.5),
      x: laserConfig.canvasResolution.width / 2,
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
      color: getRgbSpreadHex(laserConfig.testColor, 0.35),
      t: 200 + time,
      lineWidth: 5,
    });
    drawSineLine({
      ctx,
      yLevel: 1080 / 2 + 400,
      width: 3,
      amplitude: 100,
      color: getRgbSpreadHex(laserConfig.testColor, 0.55),
      t: 300 + time,
      lineWidth: 2,
    });
    drawSineLine({
      ctx,
      yLevel: 1080 / 2,
      width: 5,
      amplitude: 200,
      color: getRgbSpreadHex(laserConfig.testColor, 0.65),
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
  },
};
