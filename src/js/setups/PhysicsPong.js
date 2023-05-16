var p2 = require('p2');
var lastTime = performance.now();
var laserConfig = require('../LaserApiConfig.js').default;
var ballSpeed = 100;
var gameState = 'game';
var obstacleSizeY = 50;
var obstacleSizeX = 50;
var itemCount = 18;
var planes = [];
var won = 0;
import soundBounce from '../../../public/media/opengameart/Transition.ogg';
import soundBounce2 from '../../../public/media/bounce_523088_11537497-lq.mp3';
import soundEinwurf from '../../../public/media/trillerpfeife.mp3';
import soundGoal from '../../../public/media/goal148153_612195-lq.mp3';
import soundGoal2 from '../../../public/media/goal2.mp3';
import { getRgbSpread, getRgbSpreadHex, renderText, rgbToHex } from '../util';
const addPlane = function (angle, world, collisionshape) {
  // Create a platform that the ball can bounce on
  var platformShape1 = new p2.Plane();
  var planeBody = new p2.Body({
    position: [
      laserConfig.canvasResolution.width,
      laserConfig.canvasResolution.height,
    ],
    collisionResponse: true,
    angle: angle,
  });

  console.log('addPlane created ', angle, platformShape1, planeBody);
  planeBody.addShape(platformShape1);
  world.addBody(planeBody);
  // Create material for the platform
  platformShape1.material = new p2.Material();

  // Create contact material between the two materials.
  // The ContactMaterial defines what happens when the two materials meet.
  // In this case, we use some restitution.
  world.addContactMaterial(
    new p2.ContactMaterial(platformShape1.material, collisionshape.material, {
      restitution: 1.0,
      friction: 0,
      stiffness: Number.MAX_VALUE, // We need infinite stiffness to get exact restitution
    })
  );

  return planeBody;
};
const addObstacle = function (world, collisionshape) {
  // Create a platform that the ball can bounce on
  var obstacleShape = new p2.Box({
    //  position:[-32.5,-32.5]  ,
    width: obstacleSizeX,
    height: obstacleSizeY,
    collisionResponse: true,
  });
  var obstacleBody = new p2.Body({
    mass: 0,
    velocity: [0, 0],
  });
  console.log('created obstacle', obstacleShape, obstacleBody);

  obstacleBody.addShape(obstacleShape);
  world.addBody(obstacleBody);
  // Create material for the platform
  obstacleShape.material = new p2.Material();

  // Create contact material between the two materials.
  // The ContactMaterial defines what happens when the two materials meet.
  // In this case, we use some restitution.
  world.addContactMaterial(
    new p2.ContactMaterial(obstacleShape.material, collisionshape.material, {
      restitution: 1.0, // restitution = bounce rate 1=perfect
      friction: 10,
      surfaceVelocity: 1,
      contactSkinSize: 0,
      stiffness: Number.MAX_VALUE, // We need infinite stiffness to get exact restitution
    })
  );
  return obstacleBody;
};
const obstacles = [];
var circleBody = null;
var circleShape = null;
var world = null;
var delayCount = 5;
function onTick(elapsed) {
  // console.log('diff is ', (cTime - lastTime));
  // The step method moves the bodies forward in time.
  // timestep, delta, subframes
  //   console.log('ball is ', circleBody);

  if (delayCount > 0) {
    delayCount -= elapsed;
  } else {
    world.step(1 / 60, elapsed);
  }

  planeAnim -= elapsed;
  //  renderGame(MasterCanvas.get2dContext());

  //  intervalId = setTimeout(onTick, 25);

  // Print the circle position to console.
  // Could be replaced by a render call.
  //console.log("Circle y position: " + circleBody.position[1]);
  //   physicsBall.style.top = circleBody.position[1];
  //     physicsBall.style.left = circleBody.position[0];
}

function getRandomBallSpeed() {
  return [
    Math.random() > 0.5 ? -ballSpeed : ballSpeed,
    Math.random() > 0.5 ? -ballSpeed : ballSpeed,
  ];
}

var ballRadius = 20;
var bounceAudio = new Audio(soundBounce);
var bounceAudio2 = new Audio(soundBounce2);
var planeAnim = 0; //
const PLANE_ANIM_TIME = 5; //
var planeYPos = 100;
const init2dPhysics = function (obstacleCount) {
  console.log('init2dPhysics');
  ///////////////////
  // Create a physics world, where bodies and constraints live
  world = new p2.World({
    solver: p2.GSSolver({ iterations: 100, tolerance: 0 }),
    gravity: [0, 0],
    relaxation: 20,
    broadphase: p2.NaiveBroadphase(),
    stiffness: Number.MAX_VALUE,
  });
  world.on('beginContact', (data) => {
    console.log('contaaact', data);
    if (data.bodyA.type != data.bodyB.type) {
      console.log('circle is', data.shapeA, data.shapeB);
      console.log(data.shapeA.constructor.name, data.shapeB.constructor.name);
      if (
        data.shapeA.constructor.name === 'Plane' ||
        data.shapeB.constructor.name === 'Plane'
      ) {
        bounceAudio.pause();
        bounceAudio.currentTime = 0;
        bounceAudio.play();
        planeAnim = PLANE_ANIM_TIME;
        planeYPos = data.bodyB.position[1] > 1080 / 2 ? 1080 : 0;
        // console.log('posy posis', data.bodyB.position);
        // console.log('posy posis', data.bodyA.position);
      } else {
        bounceAudio2.pause();
        bounceAudio2.currentTime = 0;
        bounceAudio2.play();
      }
    }
  });
  console.log('world is ', world);
  // Create an empty dynamic body
  circleBody = new p2.Body({
    mass: 10,
    position: [250, 250],
    velocity: getRandomBallSpeed(),
    restitution: 1,
    angle: 0,
    stiffness: Number.MAX_VALUE, // We need infinite stiffness to get exact restitution
  });
  // Add a circle shape to the body.
  circleShape = new p2.Circle({ radius: ballRadius });
  circleShape.material = new p2.Material();
  circleBody.addShape(circleShape);

  // Remove damping from the ball, so it does not lose energy
  circleBody.damping = 0;
  circleBody.angularDamping = 0;
  circleBody.friction = 100;
  console.log('body is', circleBody);
  // ...and add the body to the world.
  // If we don't add it to the world, it won't be simulated.
  world.addBody(circleBody);

  //  addPlane(0, world, circleShape)
  planes.push(addPlane(0, world, circleShape));
  // planes.push(addPlane(Math.PI / 2.0, world, circleShape));
  planes.push(addPlane(Math.PI, world, circleShape));
  // planes.push(addPlane(Math.PI + Math.PI / 2.0, world, circleShape));
  //  addPlane(Math.PI, world, circleShape)
  //  addPlane(Math.PI   + Math.PI/2, world, circleShape)
  // To get the trajectories of the bodies,
  // we must step the world forward in time.
  // This is done using a fixed time step size.

  for (var i = 0; i < obstacleCount; i++) {
    obstacles[i] = addObstacle(world, circleShape);
  }

  // The "Game loop". Could be replaced by, for example, requestAnimationFrame.
  //   intervalId = setTimeout(onTick, 25);
  ////////////////
};
function renderIntro(ctx) {
  ctx.font = '140px Verdana        ';
  ctx.fillStyle = getRgbSpreadHex(laserConfig.testColor, 0.5);
  ctx.textAlign = 'center';
  ctx.fillText('Laser-Pong', laserConfig.canvasResolution.width / 2, 200);
}
function renderGameOver(ctx) {
  ctx.fillStyle = getRgbSpreadHex(laserConfig.testColor, 0.6);
  ctx.textAlign = 'center';
  renderText({
    ctx,
    fillStyle: getRgbSpreadHex(laserConfig.testColor, 0.6, 1, 0.5),
    fontSize: '80px',
    text: `Game Over
${winPointsTeam1} : ${winPointsTeam2} 
Winner:`,
    x: laserConfig.canvasResolution.width / 2,
    y: 200,
  });
  renderText({
    ctx,
    fillStyle: getRgbSpreadHex(laserConfig.testColor, 0.6, 1, 1),
    fontSize: '80px',
    text: `


Team ${won}`,
    x: laserConfig.canvasResolution.width / 2,
    y: 200,
  });
}

function renderGame(canvas2d) {
  switch (gameState) {
    case 'game':
      renderGamePlayfield(canvas2d);

      if (delayCount > 2) {
        renderText({
          ctx: canvas2d,
          fontSize: '75px',
          lineHeight: 85,
          x: 1920 / 2,
          fillStyle: getRgbSpreadHex(laserConfig.testColor, 0.5),
          y: 200,
          text: `Current Leg  
${pointsTeam1} : ${pointsTeam2} 
Current Match  
${winPointsTeam1} : ${winPointsTeam2} 


> ${Math.ceil(delayCount)} <`,
        });
      }
      if (winPointsTeam1 == 7 || winPointsTeam1 - winPointsTeam2 >= winPoints) {
        gameState = 'gameover';
        won = 1;
        delayCount = 10;
      }
      if (winPointsTeam2 == 7 || winPointsTeam2 - winPointsTeam1 >= winPoints) {
        gameState = 'gameover';
        won = 2;
        delayCount = 10;
      }
      break;

    case 'gameover':
      renderGameOver(canvas2d);
      if (delayCount > 0) {
        renderText({
          ctx: canvas2d,
          fontSize: '75px',
          x: 1920 / 2 + 2,
          fillStyle: getRgbSpreadHex(laserConfig.testColor, 0.5),
          y: 1080 / 2 + 500,
          text: `Restart in
> ${Math.ceil(delayCount)} <`,
        });
      } else {
        if (gamedata.callbackBallOutside) gamedata.callbackBallOutside();
        gameState = 'game';
        won = 0;
        winPointsTeam1 = 0;
        winPointsTeam2 = 0;
        pointsTeam1 = 0;
        pointsTeam2 = 0;
      }
      break;
  }
}
function renderGamePlayfield(ctx) {
  ctx.save();
  var playfieldColor1 = getRgbSpreadHex(laserConfig.testColor, 0.5);
  var playfieldColor2 = getRgbSpreadHex(laserConfig.testColor, 0.35);
  var playfieldColor3 = getRgbSpreadHex(laserConfig.testColor, 0.65);


  for (var i = 0; i < itemCount; i++) {
    //  console.log('rendering obstacle', obstacles [i])
    ctx.fillStyle = obstacles[i].color;

    ctx.lineWidth = 3;
    ctx.strokeStyle = playfieldColor1;
    ctx.strokeRect(
      obstacles[i].position[0] - obstacleSizeX / 2,
      obstacles[i].position[1] - obstacleSizeY / 2,
      obstacles[i].shapes[0].width,
      obstacles[i].shapes[0].height
    );
  }

  //draw a circle
  ctx.beginPath();
  ctx.fillStyle = playfieldColor3;
  ctx.strokeStyle = playfieldColor2;
  ctx.arc(
    circleBody.position[0],
    circleBody.position[1],
    ballRadius,
    0,
    Math.PI * 2,
    true
  );
  ctx.closePath();
  ctx.fill();
  ctx.beginPath();
  ctx.fillStyle = playfieldColor3;
  ctx.strokeStyle = playfieldColor2;
  ctx.arc(
    circleBody.position[0],
    circleBody.position[1],
    ballRadius,
    0,
    Math.PI * 2,
    true
  );
  ctx.closePath();
  ctx.stroke();

  ctx.lineWidth = 4;
  ctx.beginPath();
  ctx.moveTo(circleBody.position[0], circleBody.position[1]);
  ctx.lineTo(
    circleBody.position[0] + Math.cos(circleBody.angle) * ballRadius,
    circleBody.position[1] + Math.sin(circleBody.angle) * ballRadius
  );
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(circleBody.position[0], circleBody.position[1]);
  ctx.lineTo(
    circleBody.position[0] + Math.cos(circleBody.angle + Math.PI) * ballRadius,
    circleBody.position[1] + Math.sin(circleBody.angle + Math.PI) * ballRadius
  );
  ctx.stroke();

  ctx.restore();
  ctx.font = '50px Arial  ';
  ctx.fillStyle = playfieldColor2;
  ctx.textAlign = 'right';
  ctx.fillText(
    'Current Leg ' + pointsTeam1 + ' : ' + pointsTeam2 + ' ',
    laserConfig.canvasResolution.width - 100,
    laserConfig.canvasResolution.height - 50
  );
  ctx.textAlign = 'left';
  ctx.fillText(
    ' ' + winPointsTeam1 + ' : ' + winPointsTeam2 + ' Matches',
    100,
    laserConfig.canvasResolution.height - 50
  );
  if (planeAnim > 0) {
    var playfieldColor3 = getRgbSpreadHex(
      laserConfig.testColor,

      0.25 + planeAnim / PLANE_ANIM_TIME / 2,

      (planeAnim / PLANE_ANIM_TIME) * 0.5,
      (planeAnim / PLANE_ANIM_TIME) * 0.5
    );
    ctx.fillStyle = playfieldColor3;
    if (planeYPos > 1080 / 2) {
      ctx.fillRect(
        0,
        planeYPos - 12 * (planeAnim / PLANE_ANIM_TIME),
        1920,
        25 * (planeAnim / PLANE_ANIM_TIME)
      );
    } else {
      ctx.fillRect(0, planeYPos, 1920, 12 * (planeAnim / PLANE_ANIM_TIME));
    }
  }
  checkBallOutSide();
}
var pointsTeam1 = 0;
var pointsTeam2 = 0;
var winPoints = 3;
var winPointsTeam1 = 0;
var winPointsTeam2 = 0;
function checkBallOutSide() {
  if (circleBody.velocity[0] > 500 || circleBody.velocity[1] > 500) {
    /// reset ball due to some fancy quirkies

    circleBody.position = [
      laserConfig.canvasResolution.width / 2,
      laserConfig.canvasResolution.height / 2,
    ];
    circleBody.angularVelocity = 0;
    circleBody.angle = 0;
    circleBody.velocity = getRandomBallSpeed();
    var audio = new Audio(soundEinwurf);
    audio.play();
    delayCount = 2;

    return;
  }

  if (circleBody.position[0] < ballRadius) {
    pointsTeam2++;
    circleBody.position = [
      laserConfig.canvasResolution.width / 2,
      laserConfig.canvasResolution.height / 2,
    ];
    circleBody.angularVelocity = 0;
    circleBody.angle = 0;
    circleBody.velocity = getRandomBallSpeed();
    if (gamedata.callbackBallOutside) gamedata.callbackBallOutside();
    var audio = new Audio(soundGoal);
    audio.play();
    delayCount = 5;
  }
  if (
    circleBody.position[0] >
    laserConfig.canvasResolution.width - ballRadius
  ) {
    pointsTeam1++;
    circleBody.angularVelocity = 0;
    circleBody.angle = 0;
    circleBody.position = [
      laserConfig.canvasResolution.width / 2,
      laserConfig.canvasResolution.height / 2,
    ];
    circleBody.velocity = getRandomBallSpeed();
    if (gamedata.callbackBallOutside) gamedata.callbackBallOutside();
    var audio = new Audio(soundGoal2);
    audio.play();
    delayCount = 5;
  }

  if (pointsTeam1 >= winPoints || pointsTeam1 > 7) {
    winPointsTeam1++;
    pointsTeam1 = 0;
    pointsTeam2 = 0;
  }
  if (pointsTeam2 >= winPoints || pointsTeam2 > 7) {
    winPointsTeam2++;
    pointsTeam1 = 0;
    pointsTeam2 = 0;
  }
}
var elapsed = 0;
const gamedata = {
  getObstacle: function (index) {
    return obstacles[index];
  },
  step: onTick,
  callbackBallOutside: undefined,
  init: function (data) {
    delayCount = 5;

    if (data) {
      if (data.itemCount) {
        itemCount = data.itemCount;
      }
      if (data.moveSpeed) {
        moveSpeed = data.moveSpeed;
      }
      if (data.obstacleSize) {
        obstacleSizeX = data.obstacleSize * laserConfig.playfieldScale;
        obstacleSizeY = data.obstacleSize * laserConfig.playfieldScale;
      }

      if (data.obstacleSizeX) {
        obstacleSizeX = data.obstacleSizeX * laserConfig.playfieldScale;
      }

      if (data.obstacleSizeY) {
        obstacleSizeY = data.obstacleSizeY * laserConfig.playfieldScale;
      }
      if (data.ballSpeed) {
        ballSpeed = data.ballSpeed;
      }
    }
    lastTime = performance.now();
    init2dPhysics(itemCount);

    circleBody.position = [
      laserConfig.canvasResolution.width / 2,
      laserConfig.canvasResolution.height / 2,
    ];
    circleBody.velocity = getRandomBallSpeed();
    //   console.log('phiscs is', world)
  },
  stop: function () {
    //clearInterval(intervalId);
  },

  render: renderGame,
};
export default gamedata;
