var laserConfig = require('../LaserApiConfig.js').default
var p2 = require('p2')
var canvas = document.getElementById('canvas')

const createItem = function(index, size = 75)  {

    var div1 = document.createElement('div');
    div1.style.position = 'absolute';
    var div = document.createElement('div');
    div.style.top = 100 + (index % 3 ) * 100;
    div.style.left = 100 + Math.floor(index / 3) * 100;
    div1.appendChild(div)
    div.style.backgroundColor = 'green';
    div.style.position = 'absolute';
    div.style.width = size;
    div.style.height = size;
    // div.style.top = -size / 2;
    // div.style.left = -size / 2;
    div.style.zIndex = 1000;

    return div;
}
var divs = []

var moveSpeed = 20
const itemCount = 6;

for (var i = 0; i < itemCount / 2; i++) {

    var div = createItem(i)
    canvas.parentNode.appendChild(div)
    divs.push(div);
    div.style.borderRadius = '5px'
    div.style.border = '0px solid lightgreen'

}
for (var i = 0; i < itemCount / 2; i++) {

    var div = createItem(i)
    canvas.parentNode.appendChild(div)
    divs.push(div);
    if (i < itemCount / 2) {

        div.style.borderRadius = '5px'
        div.style.border = '0px solid lightblue'
        div.style.backgroundColor = 'blue';
        div.style.left = 400;

    }
}
var physicsBall = createItem(0, 25);

canvas.parentNode.appendChild(physicsBall)
physicsBall.style.borderRadius = '5px'
physicsBall.style.border = '0px solid white'
physicsBall.style.backgroundColor = 'green';
physicsBall.style.left = 10;

const addPlane =function (angle, world, collisionshape) {

    // Create a platform that the ball can bounce on
    var platformShape1 = new p2.Plane();
    var platformBody1 = new p2.Body({
            mass: 0,
            position: [640, 480],
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
const addObstacle =function (world, collisionshape)  {

    // Create a platform that the ball can bounce on
    var platformShape1 = new p2.Box({
        //  position:[-32.5,-32.5]  ,
        width: 75,
        height: 75
    });
    var platformBody1 = new p2.Body({
            mass: 0
        }
        )
        ;

    console.log('created obstacle', platformShape1, platformBody1)

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

    return platformBody1

}
const obstacles = []
const init2dPhysics = function() {

    ///////////////////
    // Create a physics world, where bodies and constraints live
    var world = new p2.World({
        gravity: [0, 0]
    });
    console.log('world is ', world)
    // Create an empty dynamic body
    var circleBody = new p2.Body({
        mass: 1,
        position: [50, 50],
        velocity: [10, -10],
        angle: 0,
        angularVelocity: 0
    });
    // Add a circle shape to the body.
    var circleShape = new p2.Box({
        width: 25,
        position: [-12.5, -12.5],
        height: 25
    });
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
    var timeStep = 1; // seconds

    for (i = 0; i < itemCount; i++) {

        obstacles[i] = addObstacle(world, circleShape)

    }

    // The "Game loop". Could be replaced by, for example, requestAnimationFrame.
    setInterval(function () {

        // The step method moves the bodies forward in time.
        world.step(timeStep);

        // Print the circle position to console.
        // Could be replaced by a render call.
        //console.log("Circle y position: " + circleBody.position[1]);
        physicsBall.style.top = circleBody.position[1];
        physicsBall.style.left = circleBody.position[0];
    }, 25);
    ////////////////
}
init2dPhysics()
const isInsideRect =function (rect1, rect2)  {
    //   console.log('comparing ', rect1, rect2)
    var p1 = rect1.topleft.x <= rect2.topright.x
    var p2 = rect1.topright.x >= rect2.topleft.x

    var p3 = rect1.topleft.y <= rect2.bottomright.y
    var p4 = rect1.bottomright.y >= rect2.topleft.y

    var result = p1 && p2 && p3 && p4;
    //    console.log('r======== ', result)
    return result;
}

function getDist(rect1, rect2) {
    // diostance to center of rects

    var p1 = {
        x: (rect1.topleft.x + rect1.bottomright.x) / 2,
        y: (rect1.topleft.y + rect1.bottomright.y) / 2
    }
    var p2 = {
        x: (rect2.topleft.x + rect2.bottomright.x) / 2,
        y: (rect2.topleft.y + rect2.bottomright.y) / 2
    }
    return {
        x: (p1.x - p2.x) / 2,
        y: (p1.y - p2.y) / 2
    }
}
const getRectangleFromBoundingRect = function(clientBoundingRect)   {
    var rect1 = {

        topleft: {
            x: clientBoundingRect.left,
            y: clientBoundingRect.top,
        },
        topright: {
            x: clientBoundingRect.right,
            y: clientBoundingRect.top,
        },
        bottomleft: {
            x: clientBoundingRect.left,
            y: clientBoundingRect.bottom,
        },
        bottomright: {
            x: clientBoundingRect.right,
            y: clientBoundingRect.bottom,
        }
    }
    return rect1
}
const handler = function(grid)   {

    // rect for test object

    var direction = {
        x: 0,
        y: 0

    }
    var directions = []
    for (var k = 0; k < itemCount; k++) {
        directions[k] = {
            x: 0,
            y: 0

        }
    }
    var scalex = canvas.getBoundingClientRect().width / laserConfig.gridResolution
    var scaley = canvas.getBoundingClientRect().height / laserConfig.gridResolution
    for (var i = 0; i < grid.length; i++) {

        if (grid[i] > 0) {
            //  console.log('scale ', canvas.getBoundingClientRect(), laserConfig, scalex, scaley)
            // rect for grid plate object
            for (var k = 0; k < itemCount; k++) {
                var div = divs[k]
                var clientBoundingRect = div.getBoundingClientRect()
                var rect1 = getRectangleFromBoundingRect(clientBoundingRect)

                var rect2 = {

                    topleft: {
                        x: (i % laserConfig.gridResolution ) * scalex,
                        y: Math.floor(i / laserConfig.gridResolution) * scaley,
                    },
                    topright: {
                        x: (i % laserConfig.gridResolution ) * scalex + scalex,
                        y: Math.floor(i / laserConfig.gridResolution) * scaley,
                    },
                    bottomleft: {
                        x: (i % laserConfig.gridResolution ) * scalex,
                        y: Math.floor(i / laserConfig.gridResolution) * scaley + scaley,
                    },
                    bottomright: {
                        x: (i % laserConfig.gridResolution ) * scalex + scalex,
                        y: Math.floor(i / laserConfig.gridResolution) * scaley + scaley,
                    }
                }

                if (isInsideRect(rect1, rect2)) {
                    //      console.log('intersecting ', rect1, rect2)
                    //      console.log('dist is ', getDist(rect1, rect2))

                    var dist = getDist(rect1, rect2)
                    var length = Math.sqrt(dist.x * dist.x + dist.y * dist.y)

                    directions[k].x += getDist(rect1, rect2).x
                    directions[k].y += getDist(rect1, rect2).y
                    //      console.log('moving ', direction)
                } else {

                    //    console.log('not intersectiong ', rect1, rect2)
                    //      console.log('dist is ', getDist(rect1, rect2))

                }
            }
        } else {

        }

    }

    var oldPositions = []
    for (var k = 0; k < itemCount; k++) {

        if (divs[k]) {
            oldPositions [k] = divs[k].getBoundingClientRect()

            var length = Math.sqrt(directions[k].x * directions[k].x + directions[k].y * directions[k].y)
            divs[k].style.left = divs[k].getBoundingClientRect().left - directions[k].x / length * moveSpeed
            divs[k].style.top = divs[k].getBoundingClientRect().top - directions[k].y / length * moveSpeed
        }
    }

    for (var i = 0; i < itemCount; i++) {

        if (divs[i]) {
            var rect1 = getRectangleFromBoundingRect(divs[i].getBoundingClientRect())
            for (var k = 0; k < itemCount; k++) {
                if (k !== i) {

                    var rect2 = getRectangleFromBoundingRect(divs[k].getBoundingClientRect())
                    //  console.log('checking ', rect1, rect2)
                    if (isInsideRect(rect1, rect2)) {
                        // anoverlapp occured, move both back!
                        //  console.log('Overlap ', rect1, rect2)
                        divs[k].style.left = oldPositions [k].left
                        divs[k].style.top = oldPositions [k].top

                        divs[i].style.left = oldPositions [i].left
                        divs[i].style.top = oldPositions [i].top
                    }
                }
            }
        }
    }

    for (var i = 0; i < itemCount; i++) {

        obstacles [i].position = [divs[i].getBoundingClientRect().left, divs[i].getBoundingClientRect().top]
    }

}

export default {


    handle: function(grid)  {
        handler(grid)
    }
}
