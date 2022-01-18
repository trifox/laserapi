var p2 = require("p2");
var lastTime = performance.now();
var laserConfig = require("../LaserApiConfig.js").default;
var MasterCanvas = require("../MasterCanvas").default;
var matter = require("matter-js");
var intervalId = null;
var ballSpeed = 250;
var gameState = "game";
var obstacleSizeY = 160;
var obstacleSizeX = 160;
var itemCount = 6;
var planes = [];
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

  console.log("addPlane created ", angle, platformShape1, planeBody);
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
  console.log("created obstacle", obstacleShape, obstacleBody);

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
var timeStep = 0.1; // seconds
var circleBody = null;
var circleShape = null;
var world = null;
function onTick() {
  // console.log('diff is ', (cTime - lastTime));
  // The step method moves the bodies forward in time.
  // timestep, delta, subframes
  //   console.log('ball is ', circleBody);

  var cTime = performance.now();
  world.step((cTime - lastTime) / 1000);
  lastTime = cTime;
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

var ballRadius = 50;
const init2dPhysics = function (obstacleCount) {
  console.log("init2dPhysics");
  ///////////////////
  // Create a physics world, where bodies and constraints live
  world = new p2.World({
    solver: p2.GSSolver({ iterations: 100, tolerance: 0 }),
    gravity: [0, 0],
    relaxation: 20,
    broadphase: p2.NaiveBroadphase(),
    stiffness: Number.MAX_VALUE,
  });
  console.log("world is ", world);
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
  console.log("body is", circleBody);
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
  ctx.font = "140px Verdana        ";
  ctx.fillStyle = "#0088ff";
  ctx.textAlign = "center";
  ctx.fillText("Laser-Pong", laserConfig.canvasResolution.width / 2, 200);
  renderDescription(ctx);
}
function renderGameOver(ctx) {
  ctx.font = "140px Verdana        ";
  ctx.fillStyle = "#0088ff";
  ctx.textAlign = "center";
  ctx.fillText(
    "Game over and the winner is",
    laserConfig.canvasResolution.width / 2,
    200
  );
  renderDescription(ctx);
}
function renderDescription(ctx) {
  ctx.font = "43px Arial  ";
  ctx.fillStyle = "#88ff88";
  ctx.textAlign = "center";
  ctx.fillText(
    "Play with people and control the paddles left and right",
    laserConfig.canvasResolution.width / 2,
    400
  );
}
function renderGame(canvas2d) {
  switch (gameState) {
    case "game":
      renderGamePlayfield(canvas2d);
      break;
    case "intro":
      renderIntro(canvas2d);
      break;
    case "gameover":
      renderGameOver(canvas2d);
      break;
  }
}
function renderGamePlayfield(canvas2d) {
  canvas2d.save();
  // for (var i = 0; i < planes.length; i++) {
  //   planes[i].position = [
  //     laserConfig.canvasResolution.width,
  //     laserConfig.canvasResolution.height,
  //   ];
  // }
  //console.log('canvas size is ', laserConfig.canvasResolution)
  // canvas2d.translate(50, 50)
  for (var i = 0; i < itemCount; i++) {
    //  console.log('rendering obstacle', obstacles [i])
    canvas2d.fillStyle = obstacles[i].color;

    canvas2d.lineWidth = 2;
    canvas2d.strokeStyle = "#00ff88";
    canvas2d.strokeRect(
      obstacles[i].position[0] - obstacleSizeX / 2,
      obstacles[i].position[1] - obstacleSizeY / 2,
      obstacles[i].shapes[0].width,
      obstacles[i].shapes[0].height
    );
  }

  //draw a circle
  canvas2d.beginPath();
  canvas2d.fillStyle = "#0088ff";
  canvas2d.strokeStyle = "#ff88ff";
  canvas2d.arc(
    circleBody.position[0],
    circleBody.position[1],
    ballRadius,
    0,
    Math.PI * 2,
    true
  );
  canvas2d.closePath();
  canvas2d.fill();
  canvas2d.lineWidth = 4;
  canvas2d.beginPath();
  canvas2d.moveTo(circleBody.position[0], circleBody.position[1]);
  canvas2d.lineTo(
    circleBody.position[0] + Math.cos(circleBody.angle) * ballRadius,
    circleBody.position[1] + Math.sin(circleBody.angle) * ballRadius
  );
  canvas2d.stroke();
  canvas2d.beginPath();
  canvas2d.moveTo(circleBody.position[0], circleBody.position[1]);
  canvas2d.lineTo(
    circleBody.position[0] + Math.cos(circleBody.angle + Math.PI) * ballRadius,
    circleBody.position[1] + Math.sin(circleBody.angle + Math.PI) * ballRadius
  );
  canvas2d.stroke();

  canvas2d.restore();
  canvas2d.font = "40px Arial  ";
  canvas2d.fillStyle = "#008800";
  canvas2d.textAlign = "right";
  canvas2d.fillText(
    "Current Leg " + pointsTeam1 + " : " + pointsTeam2 + " ",
    laserConfig.canvasResolution.width,
    laserConfig.canvasResolution.height - 20
  );
  canvas2d.textAlign = "left";
  canvas2d.fillText(
    " " + winPointsTeam1 + " : " + winPointsTeam2 + " Matches",
    0,
    laserConfig.canvasResolution.height - 20
  );

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
    return;
  }

  if (circleBody.position[0] < ballRadius * 2) {
    pointsTeam2++;
    circleBody.position = [
      laserConfig.canvasResolution.width / 2,
      laserConfig.canvasResolution.height / 2,
    ];
    circleBody.angularVelocity = 0;
    circleBody.angle = 0;
    circleBody.velocity = getRandomBallSpeed();
  }
  if (
    circleBody.position[0] >
    laserConfig.canvasResolution.width - ballRadius * 2
  ) {
    pointsTeam1++;
    circleBody.angularVelocity = 0;
    circleBody.angle = 0;
    circleBody.position = [
      laserConfig.canvasResolution.width / 2,
      laserConfig.canvasResolution.height / 2,
    ];
    circleBody.velocity = getRandomBallSpeed();
  }

  if (pointsTeam1 >= winPoints) {
    winPointsTeam1++;
    pointsTeam1 = 0;
    pointsTeam2 = 0;
  }
  if (pointsTeam2 >= winPoints) {
    winPointsTeam2++;
    pointsTeam1 = 0;
    pointsTeam2 = 0;
  }
}
export default {
  getObstacle: function (index) {
    return obstacles[index];
  },
  step: onTick,
  init: function (data) {
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
    clearInterval(intervalId);
  },

  render: renderGame,
};
