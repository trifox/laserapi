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
var maxLife = 10;
var escapedBalls = 0;
export const OBSTACLE_TYPES = {
  BOX: 'Box',
  DIAMOND: 'Diamond',
  CIRCLE: 'Circle',
}
export const BALL_TYPES = {
  NORMAL: 'BallaBalla',
}
import soundBounce from '../../../../public/media/opengameart/Transition.ogg';
import soundBounce2 from '../../../../public/media/bounce_523088_11537497-lq.mp3';
import soundEinwurf from '../../../../public/media/trillerpfeife.mp3';
import soundGoal from '../../../../public/media/goal148153_612195-lq.mp3';
import soundGoal2 from '../../../../public/media/goal2.mp3';
import { drawNgon, getRgbSpread, getRgbSpreadHex, removeItemFromArray, renderText, rgbToHex } from '../../util';
var maxBallAge = 15;
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
const spawnBall = function (world, { x, y, dirX, dirY, type = BALL_TYPES.NORMAL, size = ballRadius }) {

  // Create an empty dynamic body
  const circleBody = new p2.Body({
    mass: 1,
    gravityScale: 10,
    damping: 0,
    position: [
      x,
      y
    ],
    velocity: [
      0, 0
      // type === BALL_TYPES.NORMAL ? dirX : dirX / 4,
      // type === BALL_TYPES.NORMAL ? dirY : dirY / 4
    ],
    // restitution: 0,
    angle: 0,
    // stiffness: 0, // We need infinite stiffness to get exact restitution
  });
  // Add a circle shape to the body.
  const circleShape = new p2.Box({ width: size, height: size });
  circleShape.material = new p2.Material();
  circleBody.addShape(circleShape);
  const contactMaterials = []
  // add damping to the ball to fall down
  // circleBody.damping = .1;
  // circleBody.angularDamping = .1;
  // circleBody.friction = .1;
  // circleBody.gravityScale = 1;
  circleBody.laserType = BALL_TYPES.NORMAL;

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

  balls.forEach(ball => {
    contactMaterials.push(createContactBallBall(world, ball.circleBody.shapes[0], circleShape));
  })
  const ball = { circleBody, circleShape, contactMaterials, age: -1000, type }
  if (gamedata.callBackBallCreated) {
    // gamedata.callBackBallCreated(ball)
  }

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
    mass: 1,
    velocity: [0, 0],
    gravityScale: 10,
    position: [posX, posY],
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
      restitution: 0.0,
      friction: 2,
      stiffness: Number.MAX_VALUE, // We need infinite stiffness to get exact restitution
    })
  world.addContactMaterial(
    material
  )
  return material
}

const createContactBallBall = function (world, collisionshape, collisionshape2) {
  // Create contact material between the two materials.
  // The ContactMaterial defines what happens when the two materials meet. 
  const material = new p2.ContactMaterial(collisionshape.material, collisionshape2.material,
    {
      restitution: 0.0,
      friction: 2,
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
      restitution: 0.0, // restitution = bounce rate 1=perfect
      friction: 2,
      stiffness: Number.MAX_VALUE, // We need infinite stiffness to get exact restitution
    })
  world.addContactMaterial(
    material
  );
  return material
}

var spawnCount = 1
var spawPosX = 100
var spawPosY = 500
var spawPosDirX = 5
var spawPosDirY = 0
var spawAngleStart = 0
var spawAngleAdd = 1
var spawnBurstCount = 0
var currentSpawnCount = 1
var spawnedBallsCount = 0
var spawnBallSpeed = 400
var waveCount = 0
var frequency = 1 // frequence of spawn ball in seconds 
var spawnType = BALL_TYPES.NORMAL
const spawnManager = (elapsed) => {

  spawnBurstCount -= elapsed
  if (spawnBurstCount < 0) {
    waveCount++
    // reset spawn mode to new settings
    spawPosY = 300
    spawPosX = Math.random() * (1920 - 200) + 100
    spawPosDirY = Math.random() * (60) - 30
    spawPosDirX = Math.random() * (60) - 30
    spawAngleStart = 0
    spawAngleAdd = Math.random() * 25 - 12.5
    currentSpawnCount = 1 // number of balls in this wave
    frequency = Math.random() + 0.01 // spawn wave item frequency
    spawnBurstCount = 1 // every 20 seconds new wave
    spawnedBallsCount = 0
    spawnBallSpeed = 0
    spawnType = BALL_TYPES.NORMAL
    // spawPosY = 100
    // spawPosDirY = 25
    // spawAngleAdd = 0

  }
  spawnCount -= elapsed
  if (spawnCount < 0 && spawnedBallsCount < currentSpawnCount) {
    spawnedBallsCount++
    const velocityX = Math.cos((spawAngleStart / 180) * Math.PI) * spawnBallSpeed
    const velocityY = Math.sin((spawAngleStart / 180) * Math.PI) * spawnBallSpeed

    balls.push(spawnBall(world, { x: spawPosX, y: spawPosY, dirX: velocityX, dirY: velocityY, type: spawnType, size: 100 }))
    spawPosX += spawPosDirX
    spawPosY += spawPosDirY
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
  planeAnim -= elapsed;

  checkBallOutSide(elapsed);
}

function getRandomBallSpeed() {
  return [
    Math.random() > 0.5 ? -ballSpeed : ballSpeed,
    Math.random() > 0.5 ? -ballSpeed : ballSpeed,
  ];
}

var ballRadius = 50;
var bounceAudio = new Audio(soundBounce);
var bounceAudio2 = new Audio(soundBounce2);
var planeAnim = 0; //
const PLANE_ANIM_TIME = 5; //
var planeYPos = 100;
const init2dPhysics = function () {
  console.log('init2dPhysics');
  balls = []
  obstacles = []
  planes = []
  ///////////////////
  // Create a physics world, where bodies and constraints live
  world = new p2.World({
    // solver: p2.GSSolver({ iterations: 100, tolerance: 0 }),
    gravity: [0, 10],
    // relaxation: 20,
    // broadphase: p2.NaiveBroadphase(),
    // stiffness: Number.MAX_VALUE,
  });

  world.on('beginContact', (data) => {
    console.log('contaaact', data);

    if (data.bodyA.type != data.bodyB.type) {
      if (
        data.shapeA.constructor.name === 'Plane' ||
        data.shapeB.constructor.name === 'Plane'
      ) {
        // bounceAudio.pause();
        // bounceAudio.currentTime = 0;
        // bounceAudio.play();
        planeAnim = PLANE_ANIM_TIME;
      } else {
        // bounceAudio2.pause();
        // bounceAudio2.currentTime = 0;
        // bounceAudio2.play();
      }
    }
  });
  planes.push(addPlane(0, world));
  planes.push(addPlane(Math.PI, world));
  planes.push(addPlane(Math.PI / 2, world));
  planes.push(addPlane(Math.PI + Math.PI / 2, world));

};
function renderGameOver(ctx) {
  ctx.fillStyle = getRgbSpreadHex(laserConfig.testColor, 0.6);
  ctx.textAlign = 'center';
  renderText({
    ctx,
    fillStyle: getRgbSpreadHex(laserConfig.testColor, 0.6, 1, 0.5),
    fontSize: '80px',
    lineHeight: 85,
    text: `Game Over 
Winner:`,
    x: laserConfig.canvasResolution.width / 2,
    y: 200,
  });
  renderText({
    ctx,
    fillStyle: getRgbSpreadHex(laserConfig.testColor, 0.6, 1, 1),
    fontSize: '80px',
    lineHeight: 85,
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
          fontSize: '125px',
          x: 1920 / 2,
          lineHeight: 85,
          fillStyle: getRgbSpreadHex(laserConfig.testColor, 0.5),
          y: 200,
          text: `Current Wave  
 >${waveCount}<`,
        });
      }
      if (escapedBalls > 10) {
        gameState = 'gameover';
        won = 1;
        delayCount = 10;
      }

      break;

    case 'gameover':
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

    // drawNgon({
    //   ctx,
    //   numberOfSides: 4,
    //   Xcenter: circleBody.position[0],
    //   Ycenter: circleBody.position[1],
    //   size: circleBody.shapes[0].width,
    //   angle: -(circleBody.angle - Math.PI / 4),
    //   color: playfieldColor2
    // })
    ctx.save();
    ctx.translate(circleBody.position[0], circleBody.position[1],)
    ctx.rotate(circleBody.angle)
    ctx.fillRect(-circleBody.shapes[0].width / 2,
      -circleBody.shapes[0].height / 2,
      circleBody.shapes[0].width,
      circleBody.shapes[0].width)

    ctx.restore();
    ctx.restore();


  })

  // drawBall(circleBody, ballRadius)

  balls.forEach(ball => drawBall(ball.circleBody, ball.circleBody.shapes[0].radius, ball.type))
  ctx.font = '50px Arial  ';
  ctx.fillStyle = playfieldColor2;
  ctx.textAlign = 'left';
  ctx.fillText(
    `  XXX HEALTH: ${maxLife - escapedBalls} Wave: ${waveCount} Next Wave: ${Math.ceil(spawnBurstCount)}s`,
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
    ctx.fillStyle = playfieldColor2;
  }
  ctx.fillRect(0, 1080 - 200, 1920, 2);
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
