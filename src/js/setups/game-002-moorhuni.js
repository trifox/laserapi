var laserConfig = require('../LaserApiConfig.js').default
var MasterCanvas = require('../MasterCanvas').default

var knobPositions = []

var moveSpeed = 20
const itemCount = 12;
const itemSize = 100;

const isInsideRect = function (rect1, rect2) {
    //   console.log('comparing ', rect1, rect2)
    var p1 = rect1.topleft.x < rect2.topright.x
    var p2 = rect1.topright.x > rect2.topleft.x

    var p3 = rect1.topleft.y < rect2.bottomright.y
    var p4 = rect1.bottomright.y > rect2.topleft.y

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
            y: knobEntry.top + knobEntry.width,
        },
        bottomright: {
            x: knobEntry.left + knobEntry.width,
            y: knobEntry.top + knobEntry.width,
        }
    }
    //  console.log('returning ', rect1)
    return rect1
}
const handler = function (grid) {

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
    var scalex = laserConfig.canvasResolution.width / laserConfig.gridResolution
    var scaley = laserConfig.canvasResolution.height / laserConfig.gridResolution
    for (var i = 0; i < grid.length; i++) {

        if (grid[i] > 0) {
            //  console.log('scale ', canvas.getBoundingClientRect(), laserConfig, scalex, scaley)
            // rect for grid plate object
            for (var k = 0; k < itemCount; k++) {
                //    var clientBoundingRect = div.getBoundingClientRect()
                //     var rect1 = getRectangleFromBoundingRect(clientBoundingRect)
                var rect1 = getRectangleFromKnob(knobPositions [k])

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

                //  console.log('testtt ', rect1, rect2)
                if (isInsideRect(rect1, rect2)) {
                    //     console.log('intersecting ', rect1, rect2)
                    //     console.log('dist is ', getDist(rect1, rect2))

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

        oldPositions [k] = getRectangleFromKnob(knobPositions [k])
        //      console.log('direction is ', direction)
        var length = Math.sqrt(directions[k].x * directions[k].x + directions[k].y * directions[k].y)
        if (length > 0) {
            // console.log('addd0 is ', knobPositions[k])
            // console.log('addd1 is ', knobPositions[k].left)
            // console.log('addd2 is ', directions[k].x)
            // console.log('addd3 is ', length)
            // console.log('addd5 is ', moveSpeed)

            knobPositions[k].left = knobPositions[k].left - directions[k].x / length * knobPositions[k].speed
            knobPositions[k].top = knobPositions[k].top - directions[k].y / length * knobPositions[k].speed

        }

    }

    for (var i = 0; i < itemCount; i++) {

        if (!knobPositions [i].dead) {
            var rect1 = getRectangleFromKnob(knobPositions [i])
            for (var k = 0; k < itemCount; k++) {
                if (k !== i) {
                    if (!knobPositions [k].dead) {
                        var rect2 = getRectangleFromKnob(knobPositions[k])
                        //  console.log('checking ', rect1, rect2)
                        if (isInsideRect(rect1, rect2)) {
                            // anoverlapp occured, move both back!
                            // console.log('Overlap ', rect1, rect2)
                            knobPositions[k].left = oldPositions [k].topleft.x
                            knobPositions[k].top = oldPositions [k].topleft.y

                            //               divs[i].style.left = oldPositions [i].left
                            //               divs[i].style.top = oldPositions [i].top
                        }
                    }
                }
            }
        }

    }
    for (var k = 0; k < itemCount; k++) {
        if (!knobPositions [k].dead) {
            MasterCanvas.get2dContext().fillStyle = knobPositions [k].color

            MasterCanvas.get2dContext().fillRect(knobPositions [k].left, knobPositions [k].top, knobPositions [k].width, knobPositions [k].width)

        }
    }

    //    console.log(knobPositions)

}

function init() {
    knobPositions = []
    pointsTeam1 = 0
    pointsTeam2 = 0
    var teamSize = itemCount / 2

    for (var i = 0; i < teamSize / 2; i++) {

        knobPositions.push({
            width: itemSize,
            left: 100,
            speed: 5,
            top: 100 + i * (itemSize + 10),
            color: (i % 2 === 0) ? '#00ff88' : '#00ff44'

        })

        knobPositions.push({
            width: itemSize / 2,
            left: 250,
            speed: 10,
            top: 125 + i * (itemSize + 10),
            color: (i % 2 === 0) ? '#00ff88' : '#00ff44'

        })

    }
    for (var i = 0; i < teamSize / 2; i++) {

        knobPositions.push({
            width: itemSize,
            left: laserConfig.canvasResolution.width - 200,
            speed: 5,
            top: 100 + i * (itemSize + 10),
            color: (i % 2 === 0) ? '#0088ff' : '#0044ff'

        })

        knobPositions.push({
            width: itemSize / 2,
            left: laserConfig.canvasResolution.width - 300,
            speed: 10,
            top: 125 + i * (itemSize + 10),
            color: (i % 2 === 0) ? '#0088ff' : '#0044ff'

        })

    }
    console.log('initialised ', knobPositions)
}

var lastResolution = -1

var pointsTeam1 = 0
var pointsTeam2 = 0

var winPointsTeam1 = 0
var winPpointsTeam2 = 0
function checkOut() {

    for (var i = 0; i < itemCount; i++) {
        if (i < itemCount / 2) {

            if (knobPositions [i].left > laserConfig.canvasResolution.width - 100) {
                if (!knobPositions[i].dead) {
                    knobPositions[i].dead = true
                    pointsTeam1++
                }
            }
        } else {
            if (knobPositions [i].left < 50) {
                if (!knobPositions[i].dead) {
                    knobPositions[i].dead = true
                    pointsTeam2++
                }

            }
        }
    }

    var oneAliveTeam1 = false;
    for (var i = 0; i < itemCount / 2; i++) {

        if (!knobPositions [i].dead) {
            oneAliveTeam1 = true
            break;
        }

    }
    if (!oneAliveTeam1) {
        // game 2 wins
        winPpointsTeam2++
        init();
    }

    var oneAliveTeam2 = false;
    for (var i = itemCount / 2; i < itemCount; i++) {

        if (!knobPositions [i].dead) {
            oneAliveTeam2 = true
            break;
        }

    }
    if (!oneAliveTeam2) {
        // game 2 wins
        winPointsTeam1++
        init();
    }

}

export default {
    name: 'Obstacle Game',
    init: function () {
        init()
        console.log('init game moorhuni ', knobPositions)
    },
    handle: function (grid) {

        if (lastResolution != grid.length) {

            init()
            lastResolution = grid.length
        }

        handler(grid)
        checkOut()

        var canvas2d = MasterCanvas.get2dContext()
        canvas2d.font = "40px Arial  ";
        canvas2d.fillStyle = '#008800'
        canvas2d.textAlign = 'left'
        canvas2d.fillText(winPointsTeam1 + ' : ' + winPpointsTeam2 + ' Matches ', 0, laserConfig.canvasResolution.height);
        canvas2d.fillStyle = '#0088ff'
        canvas2d.textAlign = 'right'
        canvas2d.fillText('Current ' + pointsTeam1 + ' : ' + pointsTeam2, laserConfig.canvasResolution.width, laserConfig.canvasResolution.height);

    }

}
