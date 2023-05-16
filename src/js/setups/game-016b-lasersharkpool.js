import {
  renderTextDropShadow,
  removeItemFromArray,
  rgbToHex,
  drawLine,
  drawNgon,
  renderTextOutline,
  getRgbSpreadHex,
} from '../util.js';
var LARVE_RADIUS = 20;
var FISH_RADIUS = 50;
var SHARK_RADIUS = 100;
var MAX_RADIUS = 150;
var laserConfig = require('../LaserApiConfig.js').default;
var MasterCanvas = require('../MasterCanvas').default;
var guiFillButton = require('./gui/fillButton').default;
var guiFollowCircle = require('./gui/followCircle').default;

import soundSpawn from '../../../public/media/496199__luminousfridge__player-spawned.ogg';
import soundExplode from '../../../public/media/414346__bykgames__explosion-far.wav';
import soundGameOver from '../../../public/media/70299__kizilsungur__sonar.wav';
import soundBG from '../../../public/media/522110__setuniman__cheeky-1t41b.wav';
import soundEat from '../../../public/media/369952__mischy__plop-1.wav';
import soundLevelUp from '../../../public/media/opengameart/Level Up.ogg';
import soundLevelDown from '../../../public/media/opengameart/Transition.ogg';
// import soundBG from '../../../public/media/522110__setuniman__cheeky-1t41b.wav';
/**
 * audio imports
 */
import soundSpawn from '../../../public/media/496199__luminousfridge__player-spawned.ogg';
import { lerp, lerp2dArray, slerp } from '../math.js';
import { checkBorderAndSlowDown, repellAll } from './game-017-thehorde.js';

var bgSound;
var spawnButtons = [];
var buttonsGameOverScreen = [];
var larves = [];
var fishes = [];
var sharks = [];
var gameState = 'game';
var help = false;
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
function renderDots(ctx) {
  for (var i = 0; i < DOTCOUNT; i++) {
    for (var j = 0; j < DOTCOUNT; j++) {
      if (foodGrid[i][j] > 0) {
        ctx.fillStyle = getRgbSpreadHex(laserConfig.testColor, 0.65, 1, 1);
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
      (bubble.getX() - obstacle.getX()),
      2
    ) +
    Math.pow(
      (bubble.getY() - obstacle.getY()),
      2
    )
  );
}
function checkCollisionWithObstacles(arr1Small, arr2Big) {
  const todelete = [];
  arr1Small.forEach((bubble) => {
    arr2Big.forEach((obstacle) => {
      if (
        getBubbleDist(bubble, obstacle) <
        bubble.getRadius() + obstacle.getRadius()
      ) {
        console.log(
          'bubble radius size',
          bubble.getRadius(),
          obstacle.getRadius()
        );
        todelete.push(bubble);
        var newRadius = obstacle.getRadius() + bubble.getRadius()
        if (newRadius > MAX_RADIUS) {
          newRadius = MAX_RADIUS
        }
        obstacle.setRadius(newRadius);
      }
    });
  });
  if (todelete.length > 0) {
    var audio = new Audio(soundExplode);
    audio.play();
  }
  todelete.forEach((item) => removeItemFromArray(arr1Small, item));
  // todeleteobstacles.forEach((item) => removeItemFromArray(enemies, item));
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

function createFish({ x, y, radius = FISH_RADIUS, color = 'green' }) {
  var audio = new Audio(soundSpawn);
  audio.play();

  var fish = guiFollowCircle({
    label: '',
    posX: x,
    posY: y,
    shrinkSpeed: 1,
    normalColor: color,
    edges: 4,
    edges2: 5,
    lineWidth: 5,
    speedUp: 0.05,
    speedDown: 0.01,
    radius: FISH_RADIUS,
  });

  var orighandle = fish.handle; // warning cross
  fish.handle = function handle(grid, elapsed) {
    orighandle(grid, elapsed);

    fish.setRadius(fish.getRadius() - elapsed * 0.75);
    // fish.setAngle(Math.atan2(fish.getSpeedY(), fish.getSpeedX()));
    if (fish.getRadius() > SHARK_RADIUS) {
      removeItemFromArray(fishes, fish);
      sharks.push(
        createShark({
          x: fish.getX(),
          y: fish.getY(),
          color,
        })
      );

      var audio = new Audio(soundLevelUp);
      audio.play();
    }

    if (fish.getRadius() < LARVE_RADIUS) {
      removeItemFromArray(fishes, fish);
      larves.push(
        createLarve({
          x: fish.getX(),
          y: fish.getY(),
          color,
        })
      );

      var audio = new Audio(soundLevelDown);
      audio.play();
    }

    // var foodx = Math.floor(bubble.getX() / (1920 / DOTCOUNT));
    // var foody = Math.floor(bubble.getY() / (1080 / DOTCOUNT));
    // // if (foodx >= 0 && foody >= 0 && foodx < 10 && foody < 10)
    //   if (foodGrid[foodx][foody] > 0) {
    //     foodGrid[foodx][foody] = 0;
    //     bubble.setRadius(bubble.getRadius() + 10);

    //     var audio = new Audio(soundEat);
    //     audio.play();
    //   }
  };
  return fish;
}
function createShark({ x, y, radius = 50, color = 'green' }) {
  var audio = new Audio(soundSpawn);
  audio.play();

  var shark = guiFollowCircle({
    label: '',
    posX: x,
    lineWidth: 10,
    posY: y,
    normalColor: color,
    edges: 5,
    edges2: 6,
    speedUp: 0.05,
    speedDown: 0.01,
    radius: SHARK_RADIUS,
    shrinkSpeed: 1,
  });

  var orighandle = shark.handle; // warning cross
  shark.handle = function handle(grid, elapsed) {
    orighandle(grid, elapsed);
    shark.setRadius(shark.getRadius() - elapsed * 4);
    // fish.setAngle(Math.atan2(fish.getSpeedY(), fish.getSpeedX()));
    if (shark.getRadius() < FISH_RADIUS) {
      removeItemFromArray(sharks, shark);
      fishes.push(
        createFish({
          x: shark.getX(),
          y: shark.getY(),
          color,
        })
      );

      var audio = new Audio(soundLevelDown);
      audio.play();
    }
  };
  return shark;
}
function createLarve({ x, y, radius = LARVE_RADIUS, color }) {
  var audio = new Audio(soundSpawn);
  audio.play();

  var larve = guiFollowCircle({
    label: '',
    posX: x,
    posY: y,
    normalColor: color,
    edges: 3,
    edges2: 4,
    speedDown: 0.01,
    scanRadiusFactor: 2.5,
    lineWidth: 2,
    shrinkSpeed: 1,
    speedUp: 0.1,
    radius: LARVE_RADIUS,
  });

  var orighandle = larve.handle; // warning cross
  larve.handle = function handle(grid, elapsed) {
    orighandle(grid, elapsed);

    // bubble.setAngle(Math.atan2(bubble.getSpeedY(), bubble.getSpeedX()));
    var foodx = Math.floor(larve.getX() / (1920 / DOTCOUNT));
    var foody = Math.floor(larve.getY() / (1080 / DOTCOUNT));
    if (foodx >= 0 && foody >= 0 && foodx < 10 && foody < 10) {
      if (foodGrid[foodx][foody] > 0) {
        foodGrid[foodx][foody] = 0;
        larve.setRadius(larve.getRadius() + 10);
        var audio = new Audio(soundEat);
        audio.play();
        if (larve.getRadius() > FISH_RADIUS) {
          removeItemFromArray(larves, larve);
          // create FISH
          fishes.push(
            createFish({
              x: larve.getX(),
              y: larve.getY(),
              radius: larve.getRadius(),
              color,
            })
          );

          var audio = new Audio(soundLevelUp);
          audio.play();
        }
      }
    }

    if (larve.getRadius() < LARVE_RADIUS / 2) {
      removeItemFromArray(larves, larve);
    }
  };
  return larve;
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
    posX: 50 + x * radius * 3,
    posY: 100 + y * radius * 3,
    speedDown: 10,
    speedUp: 50,
    edges: 12,
    edges2: undefined,
    // angle: Math.random() * 360,
    activeValue: 90,
    radius: radius,
    growColor,
    activeColor,
    normalColor: color,
    onEnterActive: (sender) => {
      // removeItemFromArray(spawnButtons, butt);
      larves.push(
        createLarve({
          x: butt.getX(),
          y: butt.getY(),
          radius: radius * 2,
          // edges: butt.getEdges(),
          // edges2: butt.getEdges2(),
          color: activeColor,
        })
      );
    },
    onExitActive: () => { },
  });
  return butt;
}
function createSpawnButtons() {
  const result = [];
  for (var i = 0; i < 13; i++) {
    for (var j = 0; j < 7; j++) {
      const randomColor = getRgbSpreadHex(
        laserConfig.testColor,
        0.25 + i / 26,
        1,
        1
      );
      const randomColor1 = getRgbSpreadHex(
        laserConfig.testColor,
        0.25 + i / 26,
        1,
        0.75
      );
      const randomColor2 = getRgbSpreadHex(
        laserConfig.testColor,
        0.25 + i / 26,
        1,
        0.5
      );
      if (!(i > 0 && i < 12 && j > 0 && j < 6)) {
        var item = createSpawnButton({
          x: i,
          y: j,
          radius: 50,
          activeColor: randomColor,
          growColor: randomColor1,
          color: randomColor2,
        });
        result.push(item);
      }
    }
  }
  return result;
}
spawnButtons = [];
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

export function drawSineLine({
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
export function drawSineLineY({
  ctx,
  yLevel = 500,
  width = 1,
  amplitude = 200,
  color = 'red',
  t = 0,
  lineWidth = 3,
}) {
  var last = [];
  for (var x = 0; x < 1080; x += 100) {
    var ypos = yLevel + sin3(t + (x / 1080) * Math.PI * width) * amplitude;
    ctx.lineWidth = lineWidth;
    drawLine(ctx, last[0], last[1], ypos, x, color);
    last = [ypos, x];
  }
}
var time = Math.random() * 1000;
var lastTime = 0;
var elapsed = 0;
var foodSpawnCounter = 0;
var foodSpawnInterval = 1;
export default {
  name: 'Laser-SharkPool',
  description: `
  Am Bildschirmrand befinden sich Nester aus welchen
  kleine Larven entstehen die deinem Laser-Pointer folgen.

  Als Larve kannst du kleine Punkte futtern, 
  um zu einem Fisch zu werden.

  Fische futtern Larven,
  Ein Fisch wird zu einem Hai.
  
  Haie futtern Fische, 
  und brauchen Nahrung.
  
  `,
  image: 'media/img/gametitles/laser-sharkpool-###8###.png',
  init: function (data) {
    console.log('init game laser flappy birdy ');
    spawnButtons = createSpawnButtons();
  },
  handle: function (grid, elapsed) {
    const ctx = MasterCanvas.get2dContext();
    //////////////////////////
    ////////////////////////// test slerp
    //////////////////////////////////////

    // var coord = [1, 0];
    // var coord2 = [0, 2];
    // var xx = slerp(coord, coord2, gameTime % 1);
    // ctx.fillStyle = 'red';
    // ctx.fillRect((xx[0] + 1) * 100, (xx[1] + 1) * 100, 10, 10);

    //////////////////////////
    ////////////////////////// test slerp
    //////////////////////////////////////
    //////////////////////////
    ////////////////////////// test slerp
    //////////////////////////////////////

    gameTime += elapsed;

    if (lastResolution != grid.length) {
      // init();
      lastResolution = grid.length;
    }

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
    buttonsGameOverScreen.forEach((item) => item.handle(grid, elapsed));
    renderTextDropShadow({
      ctx,
      text: 'Laser-Shark',
      fontSize: '150px',
      fillStyle: 'lightblue',
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
      fillStyle: 'lightgreen',
      x: laserConfig.canvasResolution.width / 2,
      y: 400,
    });
  },
  handleGameOverScreenLost(grid, elapsed) {
    const ctx = MasterCanvas.get2dContext();
    this.renderLandscape(wonTime);
    buttonsGameOverScreen.forEach((item) => item.handle(grid, elapsed));
    renderTextDropShadow({
      ctx,
      text: 'Laser-Shark',
      fontSize: '150px',
      fillStyle: 'darkblue',
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
      fillStyle: 'darkgreen',
      x: laserConfig.canvasResolution.width / 2,
      y: 400,
    });
  },
  handleGameScreen(grid, elapsed) {
    const ctx = MasterCanvas.get2dContext();
    this.renderLandscape(gameTime);

    spawnButtons.forEach((item) => item.handle(grid, elapsed));
    // spawn food
    foodSpawnCounter += elapsed;
    if (foodSpawnCounter > foodSpawnInterval / (larves.length / 3)) {
      foodSpawnCounter = 0;
      // console.log('spawnie food');
      // spawn a new dots
      foodGrid[1 + Math.floor(Math.random() * (DOTCOUNT - 2))][
        1 + Math.floor(Math.random() * (DOTCOUNT - 2))
      ] = 1;
    }
    //
    renderDots(ctx);

    larves.forEach((item) => item.handle(grid, elapsed));
    fishes.forEach((item) => item.handle(grid, elapsed));
    sharks.forEach((item) => item.handle(grid, elapsed));
    repellAll({ workArray: larves, targetArray: larves, elapsed, bounce: 1 });
    repellAll({ workArray: larves, targetArray: sharks, elapsed, bounce: 1 });

    repellAll({ workArray: sharks, targetArray: sharks, elapsed, bounce: 1 });
    repellAll({ workArray: fishes, targetArray: fishes, elapsed, bounce: 1 });
    repellAll({ workArray: fishes, targetArray: sharks, elapsed, bounce: 1 });
    checkCollisionWithObstacles(larves, fishes);
    checkCollisionWithObstacles(fishes, sharks);

    larves.forEach((item) => checkBorderAndSlowDown(item, 150));
    fishes.forEach((item) => checkBorderAndSlowDown(item, 175));
    sharks.forEach((item) => checkBorderAndSlowDown(item, 175));
  },
  renderLandscape(gameTime) {
    const ctx = MasterCanvas.get2dContext();

    // renderTextDropShadow({
    //   ctx,
    //   text:
    //     larves.length +
    //     '/' +
    //     startAmount +
    //     '                ' +
    //     gameTime.toFixed(2),
    //   fontSize: '150px',
    //   fillStyle: '#00aaff',
    //   x: laserConfig.canvasResolution.width / 2,
    //   y: 1080 - 50,
    // });
    drawSineLineY({
      ctx,
      yLevel: 50,
      width: 2,
      amplitude: 50,
      color: getRgbSpreadHex(laserConfig.testColor, 0.6, 0.25),
      t: 100 + time,
      lineWidth: 5,
    });
    drawSineLineY({
      ctx,
      yLevel: 1920 - 100,
      width: 2,
      amplitude: 50,
      color: getRgbSpreadHex(laserConfig.testColor, 0.55, 0.25),
      t: 100 + time,
      lineWidth: 5,
    });
    drawSineLine({
      ctx,
      yLevel: 100,
      width: 2,
      amplitude: 50,
      color: getRgbSpreadHex(laserConfig.testColor, 0.5, 0.25),
      t: 100 + time,
      lineWidth: 5,
    });
    drawSineLine({
      ctx,
      yLevel: 1080 - 100,
      width: 2,
      amplitude: 50,
      color: getRgbSpreadHex(laserConfig.testColor, 0.45, 0.25),
      t: 100 + time,
      lineWidth: 5,
    });
  },
  handleSpawnScreen(grid, elapsed) {
    const ctx = MasterCanvas.get2dContext();
    if (larves.length > 0) {
      buttonsSpawnScreen.forEach((item) => item.handle(grid, elapsed));
    }
    spawnButtons.forEach((item) => item.handle(grid, elapsed));
    repellAll({ workArray: larves, targetArray: larves, elapsed, bounce: 1 });
    larves.forEach((item) => item.handle(grid, elapsed));
    if (help) {
      renderTextDropShadow({
        ctx,
        text: 'Laser-Flapping',
        fontSize: '150px',
        fillStyle: 'lightgreen',
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
        fillStyle: '#0088ff',
        x: laserConfig.canvasResolution.width / 2,
        y: 250,
        dropDistX: 4,
        dropDistY: 4,
      });
    }
  },
};
