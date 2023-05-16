import util, { getRgbSpread, getRgbSpreadHex } from '../util.js';
import { repellAll } from './game-017-thehorde.js';
import guiFollowCircle from './gui/followCircle.js';

var laserConfig = require('../LaserApiConfig.js').default;
var MasterCanvas = require('../MasterCanvas').default;
var PhysicsPong = require('./PhysicsPong').default;
var guiFillButton = require('./gui/fillButton').default;
PhysicsPong.callbackBallOutside = () => {
  init();
};
var knobPositions = [];

import soundMotivation1 from '../../../public/media/fans2-606958_6072659-lq.mp3';
import soundMotivation2 from '../../../public/media/fans1-463918_9722681-lq.mp3';
var obstacleSizeY = 30;
var obstacleSizeX = 30;
var moveSpeed = 125;
var itemCount = 18;
var clampMovementX = true;
var lastTime = performance.now();
var countDown = 0;
console.log('init pong to state start');
var gameState = 'game';
var paddles = [];
const isInsideRect = function (rect1, rect2) {
  //   console.log('comparing ', rect1, rect2)
  var p1 = rect1.topleft.x < rect2.topright.x;
  var p2 = rect1.topright.x > rect2.topleft.x;

  var p3 = rect1.topleft.y < rect2.bottomright.y;
  var p4 = rect1.bottomright.y > rect2.topleft.y;

  var result = p1 && p2 && p3 && p4;
  //    console.log('r======== ', result)
  return result;
};

function getDist(rect1, rect2) {
  // diostance to center of rects

  var p1 = {
    x: (rect1.topleft.x + rect1.bottomright.x) / 2,
    y: (rect1.topleft.y + rect1.bottomright.y) / 2,
  };
  var p2 = {
    x: (rect2.topleft.x + rect2.bottomright.x) / 2,
    y: (rect2.topleft.y + rect2.bottomright.y) / 2,
  };
  return {
    x: (p1.x - p2.x) / 2,
    y: (p1.y - p2.y) / 2,
  };
}
const getRectangleFromKnob = function (knobEntry) {
  //   console.log('getting rectangle from knob', knobEntry)
  var rect1 = {
    topleft: {
      x: knobEntry.left,
      y: knobEntry.top,
    },
    topright: {
      x: knobEntry.left + knobEntry.width,
      y: knobEntry.top,
    },
    bottomleft: {
      x: knobEntry.left,
      y: knobEntry.top + knobEntry.height,
    },
    bottomright: {
      x: knobEntry.left + knobEntry.width,
      y: knobEntry.top + knobEntry.height,
    },
  };
  //  console.log('returning ', rect1)
  return rect1;
};

function init(data) {
  if (data) {
    if (data.itemCount !== undefined) {
      itemCount = data.itemCount;
    }
    if (data.moveSpeed !== undefined) {
      moveSpeed = data.moveSpeed;
    }
    if (data.obstacleSize !== undefined) {
      obstacleSizeX = data.obstacleSize * laserConfig.playfieldScale;
      obstacleSizeY = data.obstacleSize * laserConfig.playfieldScale;
    }

    if (data.obstacleSizeX !== undefined) {
      obstacleSizeX = data.obstacleSizeX * laserConfig.playfieldScale;
    }

    if (data.clampMovementX !== undefined) {
      clampMovementX = data.clampMovementX * laserConfig.playfieldScale;
    }

    if (data.obstacleSizeY !== undefined) {
      obstacleSizeY = data.obstacleSizeY * laserConfig.playfieldScale;
    }
  }
  PhysicsPong.init(data);
  knobPositions = [];
  const padsPerPlayer = itemCount / 2;
  const padsSize = padsPerPlayer * obstacleSizeY;
  paddles = [];
  for (var i = 0; i < padsPerPlayer; i++) {
    paddles.push(
      guiFollowCircle({
        label: '',
        posX: 200,
        posY: i * 100 + 100,
        normalColor: getRgbSpreadHex(laserConfig.testColor, 0.4, 0.7, 0.7),

        speedDown: 0.1,
        speedUp: 0.1,
        angle: Math.PI / 4,
        scanRadiusFactor: 2,
        edges: 4,
        lineWidth: 2,
        edges2: undefined,
        followTrueOrRepellFalse: true,
        radius: 25,
      })
    );
    paddles.push(
      guiFollowCircle({
        label: '',
        posX: 1920 - 200,
        posY: i * 100 + 100,
        normalColor: getRgbSpreadHex(laserConfig.testColor, 0.7, 0.7, 0.7),
        lineWidth: 2,
        speedDown: 0.1,
        angle: 0 + Math.PI,
        edges: 3,
        edges2: undefined,
        speedUp: 0.1,
        scanRadiusFactor: 2,
        followTrueOrRepellFalse: true,
        radius: 25,
      })
    );

    knobPositions.push({
      width: obstacleSizeX,
      left: obstacleSizeX,
      height: obstacleSizeY,
      top:
        (laserConfig.canvasResolution.height / (padsPerPlayer + 1)) * (i + 1) -
        obstacleSizeY / 2,
      color: '#0000ff',
    });
  }
  for (var i = 0; i < padsPerPlayer; i++) {
    knobPositions.push({
      width: obstacleSizeX,
      height: obstacleSizeY,
      left: laserConfig.canvasResolution.width - obstacleSizeX * 2,

      top:
        (laserConfig.canvasResolution.height / (padsPerPlayer + 1)) * (i + 1) -
        obstacleSizeY / 2,
      color: '#0000ff',
    });
  }
  lastTime = performance.now();
  console.log('initialised pong ', knobPositions);
}
var activeButtons = [false, false];
var lastResolution = -1;
const buttons = [
  guiFillButton({
    label: 'Team 1',
    posX: 1920 / 2 - 400,
    posY: 650,
    keyCode: 'Space',
    radius: 200,
    onEnterActive: () => {
      console.log('hrhr enter active1');
      activeButtons[0] = true;
      if (
        activeButtons.reduce(
          (previousValue, currentValue) => previousValue && currentValue
        ) === true
      ) {
        PhysicsPong.init();
        gameState = 'game';
      }
    },
    onExitActive: () => {
      activeButtons[0] = false;
      console.log('hrhr exit active1');
    },
  }),
  guiFillButton({
    label: 'Team 2',
    keyCode: 'Space',
    posX: 1920 / 2 + 400,
    posY: 650,
    radius: 200,
    onEnterActive: () => {
      activeButtons[1] = true;
      console.log('hrhr enter active2', gameState);
      if (
        activeButtons.reduce(
          (previousValue, currentValue) => previousValue && currentValue
        ) === true
      ) {
        PhysicsPong.init();

        gameState = 'game';
      }
    },
    onExitActive: () => {
      activeButtons[1] = false;
      console.log('hrhr exit active2', gameState);
    },
  }),
];
export default {
  name: 'Laser-Pong',
  description: `
  Laser-Pong: Steuere dein Team zum Sieg!
  
  Wie beim Fussball geht es darum, 
  den Ball auf die gegnerische Seite zu bringen.
  
  Magnetische Kontrolle: Steuere deine Männchen mit einem Laserstrahl!
  
  Aber sei vorsichtig:
  das gegnerische Team kann auch deine bewegen...

  Es wird nach Sätzen mit 3 gewinnpunkten bis max 7 gespielt.
  `,
  image: 'media/img/gametitles/laser-pong-###8###.png',
  init: function (data) {
    init(data);

    console.log('init game pong ', knobPositions);
  },
  handle: function (grid, elapsed) {
    if (lastResolution != grid.length) {
      init();
      lastResolution = grid.length;
    }

    // handler(grid);
    // console.log(gameState);
    if (gameState == 'start') {
      this.handleStartGame(grid, elapsed);
    } else {
      // update physics positions
      repellAll({ workArray: paddles, targetArray: paddles, elapsed });
      paddles.forEach((item) => {
        item.handle(grid, elapsed);
        if (item.getX() < item.getRadius()) {
          item.setSpeedX(0);
          item.setX(item.getRadius());
        }
        if (item.getY() < item.getRadius()) {
          item.setSpeedY(0);
          item.setY(item.getRadius());
        }
        if (item.getX() > 1920 - item.getRadius()) {
          item.setSpeedX(0);
          item.setX(1920 - item.getRadius());
        }
        if (item.getY() > 1080 - item.getRadius()) {
          item.setSpeedY(0);
          item.setY(1080 - item.getRadius());
        }
      });
      for (var i = 0; i < itemCount; i++) {
        if (PhysicsPong.getObstacle(i)) {
          //  console.log('physics pong', knobPositions [i], PhysicsPong.getObstacle(i))

          var obstacle = PhysicsPong.getObstacle(i);
          var obstPosition = {
            x: knobPositions[i].left + knobPositions[i].width / 2,
            y: knobPositions[i].top + knobPositions[i].height / 2,
          };
          obstPosition = { x: paddles[i].getX(), y: paddles[i].getY() };
          // if (
          //   Math.sqrt(
          //     Math.pow(obstPosition.x - obstacle.position[0], 2) +
          //       Math.pow(obstPosition.y - obstacle.position[1], 2)
          //   ) > 0.5
          // ) {
          //   obstacle.velocity = [
          //     (obstacle.position[0] - obstPosition.x) / 10,
          //     (obstacle.position[1] - obstPosition.y) / 10,
          //   ];
          //   // console.log("applying force", obstacle.force);
          //   // obstacle.stiffness = 0;
          // } else {
          //   obstacle.velocity = [0, 0];
          // }
          obstacle.position = [obstPosition.x, obstPosition.y];
          obstacle.color = knobPositions[i].color;
          // console.log(obstacle);

          // console.log('physics pong is ', PhysicsPong)
        }
      }
      PhysicsPong.step(elapsed);
      PhysicsPong.render(MasterCanvas.get2dContext());
    }
  },

  handleStartGame(grid, elapsed) {
    util.renderText({
      ctx: MasterCanvas.get2dContext(),
      text: 'Laser-Pong',
      fontSize: '150px',
      fillStyle: 'green',
      x: laserConfig.canvasResolution.width / 2,
      y: 200,
    });
    util.renderText({
      ctx: MasterCanvas.get2dContext(),
      text: 'Activate Both buttons to start game and indicate you are ready',
      fontSize: '50px',
      x: laserConfig.canvasResolution.width / 2,
      y: 300,
    });
    buttons.forEach((item) => item.handle(grid, elapsed));
  },
};
