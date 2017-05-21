var p2 = require('p2')
var lastTime = performance.now()
var laserConfig = require('../LaserApiConfig.js').default
var MasterCanvas = require('../MasterCanvas').default
var itemCount = 6;
var intervalId = null;
var ballSpeed = 100
const addPlane = function (angle, world, collisionshape) {

    // Create a platform that the ball can bounce on
    var platformShape1 = new p2.Plane();
    var platformBody1 = new p2.Body({
            mass: 0,
            position: [laserConfig.canvasResolution.width, laserConfig.canvasResolution.height],
            angle: angle
        }
    );

    console.log('created ', platformShape1, platformBody1)

    platformBody1.addShape(platformShape1);
    world.addBody(platformBody1);
    // Create material for the platform
    platformShape1.material = new p2.Material();

    // Create contact material between the two materials.
    // The ContactMaterial defines what happens when the two materials meet.
    // In this case, we use some restitution.
    world.addContactMaterial(new p2.ContactMaterial(platformShape1.material, collisionshape.material, {
        restitution: 1.0,
        friction: 0,
        stiffness: Number.MAX_VALUE // We need infinite stiffness to get exact restitution
    }));

}
const addObstacle = function (world, collisionshape) {

    // Create a platform that the ball can bounce on
    var obstacleShape = new p2.Box({
        //  position:[-32.5,-32.5]  ,
        width: 100,
        height: 100
    });
    var obstacleBody = new p2.Body({
            mass: 0
        }
        )
        ;

    console.log('created obstacle', obstacleShape
        , obstacleBody
    )

    obstacleBody.addShape(obstacleShape);
    world.addBody(obstacleBody
    );
    // Create material for the platform
    obstacleShape.material = new p2.Material();

    // Create contact material between the two materials.
    // The ContactMaterial defines what happens when the two materials meet.
    // In this case, we use some restitution.
    world.addContactMaterial(new p2.ContactMaterial(obstacleShape
        .material, collisionshape.material, {
        restitution: 1.0,
        friction: 0,
        stiffness: Number.MAX_VALUE // We need infinite stiffness to get exact restitution
    }));

    return obstacleBody

}
const obstacles = []
var timeStep = .1; // seconds
var circleBody = null
var circleShape = null
var world = null
function onTick() {

    var cTime = performance.now()
    // console.log('diff is ', (cTime - lastTime));
    // The step method moves the bodies forward in time.
    world.step(timeStep, (cTime - lastTime) / 1000.0, 10);
    lastTime = cTime
    //   console.log('ball is ', circleBody);
    render(MasterCanvas.get2dContext())

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
        Math.random() > 0.5 ? -ballSpeed : ballSpeed
    ]
}

var ballRadius = 25
const init2dPhysics = function (obstacleCount) {

    ///////////////////
    // Create a physics world, where bodies and constraints live
    world = new p2.World({
        gravity: [0, 0]
    });
    console.log('world is ', world)
    // Create an empty dynamic body
    circleBody = new p2.Body({
        mass: 1,
        position: [250, 250],
        velocity: getRandomBallSpeed(),
        angle: 0,
        angularVelocity: 0
    });
    // Add a circle shape to the body.
    circleShape = new p2.Circle({radius: ballRadius});
    circleShape.material = new p2.Material();
    circleBody.addShape(circleShape);

    // Remove damping from the ball, so it does not lose energy
    circleBody.damping = 0;
    circleBody.angularDamping = 0;
    console.log('body is', circleBody)
    // ...and add the body to the world.
    // If we don't add it to the world, it won't be simulated.
    world.addBody(circleBody);

    //  addPlane(0, world, circleShape)
    addPlane(0, world, circleShape)
    addPlane(Math.PI / 2.0, world, circleShape)
    addPlane(Math.PI, world, circleShape)
    addPlane(Math.PI + Math.PI / 2.0, world, circleShape)
    //  addPlane(Math.PI, world, circleShape)
    //  addPlane(Math.PI   + Math.PI/2, world, circleShape)
    // To get the trajectories of the bodies,
    // we must step the world forward in time.
    // This is done using a fixed time step size.

    for (var i = 0; i < obstacleCount; i++) {

        obstacles[i] = addObstacle(world, circleShape)

    }

    // The "Game loop". Could be replaced by, for example, requestAnimationFrame.
    //   intervalId = setTimeout(onTick, 25);
    ////////////////
}
function render(canvas2d) {
    canvas2d.save()
    // canvas2d.translate(50, 50)
    for (var i = 0; i < itemCount; i++) {

        //  console.log('rendering obstacle', obstacles [i])
        canvas2d.fillStyle = obstacles[i].color

        canvas2d.fillRect(obstacles[i].position[0] - 50, obstacles[i].position[1] - 50, 100, 100)

    }

    //draw a circle
    canvas2d.beginPath();
    canvas2d.fillStyle = '#00ff00'
    canvas2d.arc(circleBody.position[0], circleBody.position[1], ballRadius, 0, Math.PI * 2, true);
    canvas2d.closePath();
    canvas2d.fill();

    canvas2d.restore()
    canvas2d.font = "40px Arial  ";
    canvas2d.fillStyle = '#008800'
    canvas2d.textAlign = 'right'
    canvas2d.fillText('Current ' + pointsTeam1 + ' : ' + pointsTeam2 + ' ', laserConfig.canvasResolution.width, laserConfig.canvasResolution.height - 20
    )
    ;
    canvas2d.textAlign = 'left'
    canvas2d.fillText(' ' + winPointsTeam1 + ' : ' + winPointsTeam2 + ' Matches', 0, laserConfig.canvasResolution.height - 20
    )
    ;

    checkBallOutSide();
}
var pointsTeam1 = 0
var pointsTeam2 = 0
var winPoints = 3
var winPointsTeam1 = 0
var winPointsTeam2 = 0
function checkBallOutSide() {

    if (circleBody.position[0] < ballRadius * 2) {

        pointsTeam2++
        circleBody.position = [laserConfig.canvasResolution.width / 2, laserConfig.canvasResolution.height / 2]
        circleBody.velocity = getRandomBallSpeed()

    }
    if (circleBody.position[0] > laserConfig.canvasResolution.width - ballRadius * 2) {

        pointsTeam1++
        circleBody.position = [laserConfig.canvasResolution.width / 2, laserConfig.canvasResolution.height / 2]
        circleBody.velocity = getRandomBallSpeed()

    }

    if (pointsTeam1 >= winPoints) {

        winPointsTeam1++
        pointsTeam1 = 0
        pointsTeam2 = 0

    }
    if (pointsTeam2 >= winPoints) {

        winPointsTeam2++
        pointsTeam1 = 0
        pointsTeam2 = 0

    }

}
export default{

    getObstacle: function (index) {
        return obstacles [index]
    },
    step: onTick,
    init: function (obstacleCount) {
        itemCount = obstacleCount
        init2dPhysics(obstacleCount);
        console.log('phiscs is', world)
    },
    stop: function () {
        clearInterval(intervalId)
    },

    render: render

}
