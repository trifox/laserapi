/**
 * 
 * also spiel geht so:
 * 
 * verteidigung
 * es gibt tuerme die spieler kaufen kann um die angreifer abzulenken und dadurch zeit zu gewinnen sie zu zerstoeren
 * 
 * gerade ist die idee quasi kreis, raute, quadrat anzubieten, die argumentation ist kreis am schwierigsten zum kontrollieren
 * zu nutzen ist, diamant kann als umlenkungselement genommen werden und der klassische quader ist halt ne wirkliche wand
 * 
 * angreifer
 * was die angreifer angeht moechte ich mindestens auch 3 angriffs typen haben, 
 * - standard ball kugelt nur rum, kann zerstoert werden gibt 5 geld bei abschuss
 * - explosions ball, dieser verhaelt sich wie der standard ball, wenn er aber zerstoert wird wird er zu 4 standard baellen (noch zu diskutieren ob er auch 4 leben wegnimmt)
 * - rammbock ball, dieser verkleinert den angetroffenen turm, er explodiert also und ist am gefaehrlichsten da er tuerme dezimieren kann
 * 
 * 
 * 
 */


var p2 = require('p2');
var laserConfig = require('../../LaserApiConfig.js').default;
var ballSpeed = 100;
var gameState = 'game';
var obstacleSizeX = 100;
var planes = [];
var won = 0;
var maxLife = 1;
var escapedBalls = 0;

export const OBSTACLE_TYPES = {
  BOX: 'Box',
  DIAMOND: 'Diamond',
  CIRCLE: 'Circle',
}
export const BALL_TYPES = {
  NORMAL: 'BallaBalla',
  EXPLODE: 'BumBum',
  RAMMBOCK: 'RammiBocki',

}
import soundBounce from '../../../../public/media/opengameart/Transition.ogg';
import soundBounce2 from '../../../../public/media/bounce_523088_11537497-lq.mp3';
import soundGameOver from '../../../../public/media/flash-253597_4508519-lq.mp3';
import soundEinwurf from '../../../../public/media/trillerpfeife.mp3';
import soundGoal from '../../../../public/media/goal148153_612195-lq.mp3';
import soundGoal2 from '../../../../public/media/goal2.mp3';
import { drawNgon, getRgbSpread, getRgbSpreadHex, removeItemFromArray, renderText, rgbToHex } from '../../util';
var maxBallAge = 35;
const removeObstacle = (obstacle) => {


  if (gamedata.callBackObstacleDeleted) {
    gamedata.callBackObstacleDeleted(obstacle)
  }
  world.removeBody(obstacle)
  balls.forEach(ball => {
    world.removeContactMaterial(world.getContactMaterial(obstacle.shapes[0].material, ball.circleBody.shapes[0].material))
  })
  removeItemFromArray(obstacles, obstacle);
}
const removeBall = (ball) => {
  if (!ball) return;
  // console.group('removeBall')
  // console.log('removing ball')

  if (gamedata.callBackBallDeleted) {
    gamedata.callBackBallDeleted(ball)
  }
  obstacles.forEach(obstacle => {
    world.removeContactMaterial(world.getContactMaterial(obstacle.shapes[0].material, ball.circleBody.shapes[0].material))
  })
  // console.log('removing body', ball.circleBody)
  world.removeBody(ball.circleBody)
  removeItemFromArray(balls, ball);
  // console.groupEnd();
}
const addPlane = function (angle, world) {
  // Create a platform that the ball can bounce on
  var platformShape1 = new p2.Plane();
  var planeBody = new p2.Body({
    position: [
      laserConfig.canvasResolution.width,
      laserConfig.canvasResolution.height - 150,
    ],
    collisionResponse: true,
    angle: angle,
  });

  console.log('addPlane created ', angle, platformShape1, planeBody);
  planeBody.addShape(platformShape1);
  world.addBody(planeBody);
  // Create material for the platform
  platformShape1.material = new p2.Material();

  return planeBody;
};
const spawnBall = function (world, { x, y, dirX, dirY, type = BALL_TYPES.NORMAL, ballRadius = 100 }) {

  // Create an empty dynamic body
  const circleBody = new p2.Body({
    mass: 1000,
    position: [
      x,
      y
    ],
    velocity: [
      dirX,
      dirY
    ],
    restitution: 1,
    angle: 0,
    stiffness: Number.MAX_VALUE, // We need infinite stiffness to get exact restitution
  });
  // Add a circle shape to the body.
  const circleShape = new p2.Circle({ radius: ballRadius });
  circleShape.material = new p2.Material();
  circleBody.addShape(circleShape);
  const contactMaterials = []
  // Remove damping from the ball, so it does not lose energy
  circleBody.damping = 0;
  circleBody.angularDamping = 0;
  circleBody.friction = 100;
  circleBody.laserType = type
  // console.log('body is', circleBody);
  // ...and add the body to the world.
  // If we don't add it to the world, it won't be simulated.
  // console.log("CREATED CIRCLE BALL")
  world.addBody(circleBody);
  // declare collisions with the players obstacles
  obstacles.forEach(obstacle => {
    contactMaterials.push(createContact(world, obstacle.shapes[0], circleShape))
  })
  // declare collisions with the upper and lower walls
  planes.forEach(plane => {
    contactMaterials.push(createContactWall(world, plane.shapes[0], circleShape));
  })
  const ball = { circleBody, circleShape, contactMaterials, age: 0, type }
  if (gamedata.callBackBallCreated) {
    gamedata.callBackBallCreated(ball)
  }
  console.log('Spawnied ballie', ball)
  return ball
}
const addObstacle = function (world, type, { posX = 0, posY = 0, radius = obstacleSizeX }) {
  // Create a platform that the ball can bounce on

  var obstacleShape


  if (type === OBSTACLE_TYPES.BOX) {
    obstacleShape = new p2.Box({
      //  position:[-32.5,-32.5]  ,
      width: radius,
      height: radius,
      collisionResponse: true,
    })
  } else if (type === OBSTACLE_TYPES.DIAMOND) {
    obstacleShape = new p2.Box({
      //  position:[-32.5,-32.5]  ,
      width: radius,
      height: radius,
      collisionResponse: true,
    })
  } else {
    obstacleShape = new p2.Circle({
      radius: radius / 2,
      collisionResponse: true,
    }
    )
  }


  var obstacleBody = new p2.Body({
    mass: 0,
    velocity: [0, 0],
    position: [posX, posY],
    angle: type === OBSTACLE_TYPES.DIAMOND ? 45 : 0
  });
  obstacleBody.laserType = 'obstacle'
  // console.log('created obstacle', obstacleShape, obstacleBody);

  obstacleBody.addShape(obstacleShape);

  world.addBody(obstacleBody);
  // Create material for the platform
  obstacleShape.material = new p2.Material();
  balls.forEach(ball => {
    ball.contactMaterials.push(createContact(world, obstacleShape, ball.circleBody.shapes[0]))
  })
  // createContact(world, obstacleShape, collisionshape)
  obstacleBody.type = type


  if (gamedata.callBackObstacleCreated) {
    gamedata.callBackObstacleCreated(obstacleBody)
  }

  return obstacleBody
};


const createContactWall = function (world, collisionshape, collisionshape2) {
  // Create contact material between the two materials.
  // The ContactMaterial defines what happens when the two materials meet. 
  const material = new p2.ContactMaterial(collisionshape.material, collisionshape2.material,
    {
      restitution: 1.0,
      friction: 0,
      stiffness: Number.MAX_VALUE, // We need infinite stiffness to get exact restitution
    })
  world.addContactMaterial(
    material
  )
  return material
}
const createContact = function (world, collisionshape, collisionshape2) {
  // console.log('creating contact', collisionshape, collisionshape2)
  const material = new p2.ContactMaterial(collisionshape.material, collisionshape2.material,
    {
      restitution: 1.0, // restitution = bounce rate 1=perfect
      friction: 10,
      surfaceVelocity: 1,
      contactSkinSize: 0,
      stiffness: Number.MAX_VALUE, // We need infinite stiffness to get exact restitution
    })
  world.addContactMaterial(
    material
  );
  return material
}
var spawnieTable = []
var spawnCount = 1
var spawPosX = 100
var spawPosY = 500
var spawPosDirX = 0
var spawPosDirY = 0
var spawAngleStart = 0
var spawAngleAdd = 0
var spawnBurstCount = 0
var currentSpawnCount = 1
var spawnedBallsCount = 0
var spawnBallSpeed = 400
var waveCount = 0
var frequency = 1 // frequence of spawn ball in seconds 
var spawnType = BALL_TYPES.NORMAL
const spawnManager = (elapsed) => {
  spawnieTable.forEach(spawnie => {

    spawnie.spawnCount -= elapsed
    if (spawnie.spawnCount < 0) {
      spawnedBallsCount++
      spawnie.spawnCount = spawnie.frequency
      // handle spawn wave
      const anglenew = Math.random() * 45 - 22.5
      const velocityX = Math.cos((anglenew / 180) * Math.PI) * spawnie.spawnBallSpeed
      const velocityY = Math.sin((anglenew / 180) * Math.PI) * spawnie.spawnBallSpeed

      balls.push(spawnBall(world, {
        ballRadius: spawnie.ballRadius,
        x: spawnie.spawnPosX,
        y: spawnie.spawnPosY + 200,
        dirX: velocityX,
        dirY: velocityY,
        type: BALL_TYPES.RAMMBOCK
      }))
      spawnie.spawnPosX = (spawnie.spawnPosX + spawnie.spawnPosDirX) % 1920
      spawnie.spawnPosY = (spawnie.spawnPosY + spawnie.spawnPosDirY) % (1080 - 400) + 75
      spawnie.spawnedBallsCount++

    }
  })
  spawnieTable = spawnieTable.filter(spawnie => spawnie.spawnedBallsCount < spawnie.currentSpawnCount)



  spawnBurstCount -= elapsed
  if (spawnBurstCount < 0) {
    if (gamedata.callbackWaveBegin) {
      gamedata.callbackWaveBegin()
    }
    if (waveCount % 5 == 4) {

      spawnBurstCount = 3

      spawnieTable.push(spawnWaveType_1_georgendboss({ waveCount }))

    } else {

      spawnBurstCount = 10
      spawnieTable.push(spawnWaveType_1_georg7({ waveCount }))
    }
    waveCount++
    console.log('spawned wave', spawnieTable)
  }
}
const spawnWave = ({ waveCount = 0 }) => {
  return {
    // reset spawn mode to new settings
    spawnTime: 0,
    spawnPosY: 450,
    spawnPosX: 200,
    // spawPosDirY = Math.random() * (60) - 30
    // spawPosDirX = Math.random() * (60) - 30
    spawnPosDirY: Math.random() * 400 + 100,
    spawnPosDirX: -25,
    spawnAngleStart: Math.random() * 25 - 12.5,
    spawnAngleAdd: Math.random() * 50 - 25,
    currentSpawnCount: 10 + waveCount * 10,// number of balls in this wave
    frequency: 5,
    // spawnBurstCount: 5 + currentSpawnCount / 2, // every 20 seconds new wave
    spawnedBallsCount: 0,
    spawnCount: 0,
    spawnBallSpeed: 100,
    ballRadius: 10,
    spawnType: Math.random() > 0.5 ? BALL_TYPES.NORMAL : Math.random() > 0.5 ? BALL_TYPES.EXPLODE : BALL_TYPES.RAMMBOCK,
    // spawPosY = 100

  }
}
const spawnWaveType_0 = ({ waveCount = 0 }) => {
  return {
    // reset spawn mode to new settings
    spawnTime: 0,
    spawnPosY: 450,
    spawnPosX: 200,
    // spawPosDirY = Math.random() * (60) - 30
    // spawPosDirX = Math.random() * (60) - 30
    spawnPosDirY: 1853,
    spawnPosDirX: 0,
    spawnAngleStart: Math.random() * 25 - 12.5,
    // spawnAngleAdd: Math.random() * 50 - 25,
    currentSpawnCount: 10 + waveCount * 5,// number of balls in this wave
    frequency: .001,
    // spawnBurstCount: 5 + currentSpawnCount / 2, // every 20 seconds new wave
    spawnedBallsCount: 0,
    spawnCount: 0,
    spawnBallSpeed: 100,
    ballRadius: 25,
    spawnType: Math.random() > 0.5 ? BALL_TYPES.NORMAL : Math.random() > 0.5 ? BALL_TYPES.EXPLODE : BALL_TYPES.RAMMBOCK,
    // spawPosY = 100

  }
}
const spawnWaveType_1_georg7 = ({ waveCount = 0 }) => {
  return {
    // reset spawn mode to new settings
    spawnTime: 0,
    spawnPosY: 100,
    spawnPosX: 250,
    // spawPosDirY = Math.random() * (60) - 30
    // spawPosDirX = Math.random() * (60) - 30
    spawnPosDirY: 20 + Math.random() * 1080 - 400,
    spawnPosDirX: 0,
    spawnAngleStart: Math.random() * 180 - 90,
    // spawnAngleAdd: Math.random() * 50 - 25,
    currentSpawnCount: 20 + waveCount,// number of balls in this wave
    frequency: .2,
    // spawnBurstCount: 5 + currentSpawnCount / 2, // every 20 seconds new wave
    spawnedBallsCount: 0,
    spawnCount: 0,
    spawnBallSpeed: 100 + Math.min(100 * (waveCount + 1), 500),
    ballRadius: 20,
    spawnType: Math.random() > 0.5 ? BALL_TYPES.NORMAL : Math.random() > 0.5 ? BALL_TYPES.EXPLODE : BALL_TYPES.RAMMBOCK,
    // spawPosY = 100

  }
}
const spawnWaveType_1_georgendboss = ({ waveCount = 0 }) => {
  return {
    // reset spawn mode to new settings
    spawnTime: 0,
    spawnPosY: 1080 / 2 - 75,
    spawnPosX: 150,
    // spawPosDirY = Math.random() * (60) - 30
    // spawPosDirX = Math.random() * (60) - 30
    spawnPosDirY: 50,
    spawnPosDirX: 0,
    spawnAngleStart: Math.random() * 25 - 12.5,
    // spawnAngleAdd: Math.random() * 50 - 25,
    currentSpawnCount: 1,// number of balls in this wave
    frequency: .1,
    // spawnBurstCount: 5 + currentSpawnCount / 2, // every 20 seconds new wave
    spawnedBallsCount: 0,
    spawnCount: 0,
    spawnBallSpeed: 100 + 75 * (waveCount / 5),
    ballRadius: 150,
    spawnType: Math.random() > 0.5 ? BALL_TYPES.NORMAL : Math.random() > 0.5 ? BALL_TYPES.EXPLODE : BALL_TYPES.RAMMBOCK,
    // spawPosY = 100

  }
}

const spawnWaveType_1 = ({ waveCount = 0 }) => {
  return {
    // reset spawn mode to new settings
    spawnTime: 0,
    spawnPosY: 100,
    spawnPosX: 250,
    // spawPosDirY = Math.random() * (60) - 30
    // spawPosDirX = Math.random() * (60) - 30
    spawnPosDirY: 50,
    spawnPosDirX: 0,
    spawnAngleStart: Math.random() * 25 - 12.5,
    // spawnAngleAdd: Math.random() * 50 - 25,
    currentSpawnCount: 30 + waveCount,// number of balls in this wave
    frequency: .1,
    // spawnBurstCount: 5 + currentSpawnCount / 2, // every 20 seconds new wave
    spawnedBallsCount: 0,
    spawnCount: 0,
    spawnBallSpeed: 100 + 100 * waveCount,
    ballRadius: 10,
    spawnType: Math.random() > 0.5 ? BALL_TYPES.NORMAL : Math.random() > 0.5 ? BALL_TYPES.EXPLODE : BALL_TYPES.RAMMBOCK,
    // spawPosY = 100

  }
}
// spawnieTable.push(spawnWave())
const spawnManagerOld = (elapsed) => {

  spawnBurstCount -= elapsed
  if (spawnBurstCount < 0) {
    if (gamedata.callbackWaveBegin) {
      gamedata.callbackWaveBegin()
    }
    waveCount++
    // reset spawn mode to new settings
    spawPosY = 450
    spawPosX = 0
    // spawPosDirY = Math.random() * (60) - 30
    // spawPosDirX = Math.random() * (60) - 30
    spawPosDirY = Math.random() * 100 + 100
    spawPosDirX = -25
    spawAngleStart = Math.random() * 25 - 12.5
    spawAngleAdd = Math.random() * 50 - 25
    currentSpawnCount = 10 + waveCount * 5 // number of balls in this wave
    frequency = Math.random() + 0.01 // spawn wave item frequency
    spawnBurstCount = 5 + currentSpawnCount / 2 // every 20 seconds new wave
    spawnedBallsCount = 0
    spawnBallSpeed = 100
    spawnType = Math.random() > 0.5 ? BALL_TYPES.NORMAL : Math.random() > 0.5 ? BALL_TYPES.EXPLODE : BALL_TYPES.RAMMBOCK
    // spawPosY = 100
    // spawPosDirY = 25
    // spawAngleAdd = 0

  }
  spawnCount -= elapsed
  if (spawnCount < 0 && spawnedBallsCount < currentSpawnCount) {
    spawnedBallsCount++
    const anglenew = Math.random() * 90 - 45
    const velocityX = Math.cos((anglenew / 180) * Math.PI) * spawnBallSpeed
    const velocityY = Math.sin((anglenew / 180) * Math.PI) * spawnBallSpeed

    balls.push(spawnBall(world, {
      ballRadius: 200,
      x: spawPosX,
      y: spawPosY + 200,
      dirX: velocityX,
      dirY: velocityY,
      type: BALL_TYPES.RAMMBOCK
    }))
    spawPosX = (spawPosX + spawPosDirX) % 1920
    spawPosY = (spawPosY + spawPosDirY) % (1080 - 400)
    spawAngleStart += spawAngleAdd
    if (spawAngleStart < -45 || spawAngleStart > 45) spawAngleAdd *= -1
    spawnCount = frequency
  }

}

var obstacles = [];
// var circleBody = null;
// var circleShape = null;
var world = null;
var delayCount = 5;
var balls = []
function onTick(elapsed) {
  if (delayCount > 0) {
    delayCount -= elapsed;
  } else {
    world.step(1 / 60, elapsed);
    spawnManager(elapsed)
  }

  checkBallOutSide(elapsed);
}

function getRandomBallSpeed() {
  return [
    Math.random() > 0.5 ? -ballSpeed : ballSpeed,
    Math.random() > 0.5 ? -ballSpeed : ballSpeed,
  ];
}

var ballRadius = 15;
var gameOverAudio = new Audio(soundGameOver);
var bounceAudio = new Audio(soundBounce);
var bounceAudio2 = new Audio(soundBounce2);
const init2dPhysics = function () {
  console.log('init2dPhysics');
  balls = []
  obstacles = []
  planes = []
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
    var factDie = 0.9
    // check if rambock collision
    if (data.bodyA.laserType === BALL_TYPES.RAMMBOCK && data.bodyB.laserType === 'obstacle') {
      //  we have a rambock 
      console.log('Collision Rammbock')
      if (data.bodyB.shapes[0].radius) {
        data.bodyB.shapes[0].radius *= factDie
        if (data.bodyB.shapes[0].radius <= 25) {
          removeObstacle(obstacles.find(item => { return item === data.bodyB }))
        }

      } else {

        data.bodyB.shapes[0].width *= factDie
        data.bodyB.shapes[0].height *= factDie

        if (data.bodyB.shapes[0].width < 25) {
          removeObstacle(obstacles.find(item => { return item === data.bodyB }))
        }
      }
      // data.bodyA.shapes[0].radius /= 2
      // if (data.bodyA.shapes[0].radius < 10) {
      //   removeBall(balls.find(item => { return item.circleBody === data.bodyA }))
      // }
    } else if (data.bodyB.laserType === BALL_TYPES.RAMMBOCK && data.bodyA.laserType === 'obstacle') {
      console.log('Collision Rammbock')
      if (data.bodyA.shapes[0].radius) {
        data.bodyA.shapes[0].radius *= factDie
        if (data.bodyA.shapes[0].radius <= 25) {
          removeObstacle(obstacles.find(item => { return item === data.bodyA }))
        }

      } else {

        data.bodyA.shapes[0].width *= factDie
        data.bodyA.shapes[0].height *= factDie
        if (data.bodyA.shapes[0].width <= 25) {
          removeObstacle(obstacles.find(item => { return item === data.bodyA }))
        }
      }
      removeBall(balls.find(item => { return item.circleBody === data.bodyB }))
    }
    if (data.bodyA.type != data.bodyB.type) {
      if (
        data.shapeA.constructor.name === 'Plane' ||
        data.shapeB.constructor.name === 'Plane'
      ) {
        bounceAudio.pause();
        bounceAudio.currentTime = 0;
        bounceAudio.play();
      } else {
        bounceAudio2.pause();
        bounceAudio2.currentTime = 0;
        bounceAudio2.play();
      }
    }
  });
  planes.push(addPlane(0, world));
  planes.push(addPlane(Math.PI, world));
  // planes.push(addPlane(Math.PI / 2, world));
  planes.push(addPlane((Math.PI / 2) * 3, world));

};
function renderGameOver(ctx) {
  ctx.fillStyle = getRgbSpreadHex(laserConfig.testColor, 0.6);
  ctx.textAlign = 'center';
  renderText({
    ctx,
    fillStyle: getRgbSpreadHex(laserConfig.testColor, 0.6, 1, 1),
    fontSize: '80px',
    lineHeight: 85,
    text: `Game Over
    
    Reached Wave
    ${waveCount}
    `,
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
          fontSize: '125px',
          x: 1920 / 2,
          lineHeight: 125,
          fillStyle: getRgbSpreadHex(laserConfig.testColor, 0.5),
          y: 200,
          text: `Laser-Defense
>${Math.round(delayCount)}<`,
        });
      }
      if (escapedBalls >= maxLife) {

        gameOverAudio.pause();
        gameOverAudio.currentTime = 0;
        gameOverAudio.play();

        gameState = 'gameover';
        won = 1;
        delayCount = 10;
      }

      break;

    case 'gameover':
      renderGamePlayfield(canvas2d);

      renderGameOver(canvas2d);
      if (delayCount > 0) {
        renderText({
          ctx: canvas2d,
          lineHeight: 125,
          fontSize: '125px',
          x: 1920 / 2 + 2,
          fillStyle: getRgbSpreadHex(laserConfig.testColor, 0.5),
          y: 1080 / 2 + 300,
          text: `Restart in
> ${Math.ceil(delayCount)} <`,
        });
      } else {
        if (gamedata.callbackBallOutside) gamedata.callbackBallOutside();
        gameState = 'game';
        won = 0;
        escapedBalls = 0;
        obstacles.forEach(removeObstacle)
        balls.forEach(removeBall)
        init2dPhysics()
        waveCount = 0;

      }
      break;
  }
}
function renderGamePlayfield(ctx) {
  ctx.save();
  var playfieldColor1 = getRgbSpreadHex(laserConfig.testColor, 0.5);
  var playfieldColor2 = getRgbSpreadHex(laserConfig.testColor, 0.35);
  var playfieldColor3 = getRgbSpreadHex(laserConfig.testColor, 0.65);
  var playfieldColor4 = getRgbSpreadHex(laserConfig.testColor, 0.45);

  function renderObstacle(obstacle) {
    // console.log('rendering obstacle', obstacle)

    ctx.fillStyle = obstacle.color;
    ctx.lineWidth = 3;
    ctx.strokeStyle = playfieldColor1;
    switch (obstacle.type) {
      case OBSTACLE_TYPES.CIRCLE:
        ctx.beginPath();
        ctx.arc(
          obstacle.position[0],
          obstacle.position[1],
          obstacle.shapes[0].radius, 0, 2 * Math.PI);
        ctx.stroke();
        break;
      case OBSTACLE_TYPES.BOX:
        ctx.strokeRect(
          obstacle.position[0] - obstacle.shapes[0].width / 2,
          obstacle.position[1] - obstacle.shapes[0].height / 2,
          obstacle.shapes[0].width,
          obstacle.shapes[0].height)
        break;

      case OBSTACLE_TYPES.DIAMOND:
        ctx.save();

        // rotate the canvas to the specified degrees
        ctx.translate(obstacle.position[0],
          obstacle.position[1]);
        ctx.rotate(45 * Math.PI / 180);
        ctx.strokeRect(
          - obstacle.shapes[0].width / 2, - obstacle.shapes[0].height / 2,
          obstacle.shapes[0].width,
          obstacle.shapes[0].height)
        ctx.restore();

        break;

    }
  }
  obstacles.forEach(renderObstacle)
  // console.log('rendering obstacles end')

  const drawBall = ((circleBody, ballRadius, type = BALL_TYPES.NORMAL) => {
    // console.log('drawing the ball', circleBody)

    var playfieldColor2 = getRgbSpreadHex(laserConfig.testColor, 0.25);
    var playfieldColor3 = getRgbSpreadHex(laserConfig.testColor, 0.55);
    switch (type) {
      case BALL_TYPES.EXPLODE:

        playfieldColor2 = getRgbSpreadHex(laserConfig.testColor, 0.35);
        playfieldColor3 = getRgbSpreadHex(laserConfig.testColor, 0.65);
        break;
      case BALL_TYPES.RAMMBOCK:
        playfieldColor2 = getRgbSpreadHex(laserConfig.testColor, 0.45);
        playfieldColor3 = getRgbSpreadHex(laserConfig.testColor, 0.75);
        break;
      default:
        break;
    }
    drawNgon({
      ctx,
      numberOfSides: type === BALL_TYPES.RAMMBOCK ? 32 : type === BALL_TYPES.EXPLODE ? 4 : 16,
      Xcenter: circleBody.position[0],
      Ycenter: circleBody.position[1],
      size: circleBody.shapes[0].radius,
      angle: type === BALL_TYPES.RAMMBOCK ? Math.PI / 4 : 0
    })

    ctx.restore();


  })

  // drawBall(circleBody, ballRadius)

  balls.forEach(ball => drawBall(ball.circleBody, ball.circleBody.shapes[0].radius, ball.type))
  ctx.font = '50px Arial';
  ctx.fillStyle = playfieldColor2;
  ctx.textAlign = 'left';
  ctx.fillText(
    `Level: ${waveCount}`,
    100,
    laserConfig.canvasResolution.height - 50
  );

  ctx.fillRect(0, 1080 - 150, 1920, 2);
  ctx.fillRect(0, 0, 1920, 2);
}
function checkBallOutSide(elapsed) {
  balls.forEach(ball => {
    ball.age += elapsed
    // console.log('checking ball', ball)
    if (ball.circleBody.velocity[0] > 5000 || ball.circleBody.velocity[1] > 5000 || ball.circleBody.position[1] < 0 || ball.circleBody.position[0] < -250 || ball.circleBody.position[1] > 1080) {
      /// reset ball due to some fancy quirkies

      ball.circleBody.position = [
        laserConfig.canvasResolution.width / 2,
        laserConfig.canvasResolution.height / 2,
      ];
      ball.circleBody.angularVelocity = 0;
      ball.circleBody.angle = 0;
      ball.circleBody.velocity = getRandomBallSpeed();
      // var audio = new Audio(soundEinwurf);
      // audio.play();
      // delayCount = 2;
      removeBall(ball)

      return;
    }

    if (ball.age > maxBallAge) {
      removeBall(ball)
      return;
    }

    if (
      ball.circleBody.position[0] >
      laserConfig.canvasResolution.width - ballRadius
    ) {
      escapedBalls++

      // if (gamedata.callbackBallOutside) gamedata.callbackBallOutside();
      // var audio = new Audio(soundEinwurf);
      // audio.play();
      // delayCount = 5;
      removeBall(ball)
    }

  })
}
const gamedata = {
  addKilledCount: function () {


  },
  addObstacle: function (type, { posX = 100, posY = 100, radius }) {

    console.log('Dynamically adding obstacle')
    const result = addObstacle(world, type, { posX, posY, radius })
    obstacles.push(result)
    return result
  },
  removeBall: (ballDef) => {
    removeBall(ballDef)
    /* when player calls this method from controlling game, we consider the type, in case its explode spawn 4 new balls in all directions */
    if (ballDef.type == BALL_TYPES.EXPLODE) {

      balls.push(spawnBall(world, {
        x: ballDef.circleBody.position[0],
        y: ballDef.circleBody.position[1],
        dirX: 100 + ballDef.circleBody.velocity[0] / 4,
        dirY: 100 + ballDef.circleBody.velocity[1] / 4,
        type: BALL_TYPES.NORMAL
      }))
      balls.push(spawnBall(world, {
        x: ballDef.circleBody.position[0],
        y: ballDef.circleBody.position[1],
        dirX: -100 + ballDef.circleBody.velocity[0] / 4,
        dirY: 100 + ballDef.circleBody.velocity[1] / 4,
        type: BALL_TYPES.NORMAL
      }))
      balls.push(spawnBall(world, {
        x: ballDef.circleBody.position[0],
        y: ballDef.circleBody.position[1],
        dirX: -100 + ballDef.circleBody.velocity[0] / 4,
        dirY: -100 + ballDef.circleBody.velocity[1] / 4,
        type: BALL_TYPES.NORMAL
      }))
      balls.push(spawnBall(world, {
        x: ballDef.circleBody.position[0],
        y: ballDef.circleBody.position[1],
        dirX: 100 + ballDef.circleBody.velocity[0] / 4,
        dirY: -100 + ballDef.circleBody.velocity[1] / 4,
        type: BALL_TYPES.NORMAL
      }))

    }

  },
  getObstacle: function (index) {
    return obstacles[index];
  },
  step: onTick,
  callbackWaveBegin: undefined,
  callbackBallOutside: undefined,
  callBackBallCreated: undefined,
  callBackBallDeleted: undefined,
  callBackObstacleCreated: undefined,
  callBackObstacleDeleted: undefined,
  init: function (data) {
    delayCount = 5;

    if (data) {

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
    init2dPhysics();

  },
  stop: function () {
  },

  render: renderGame,
};
export default gamedata;
