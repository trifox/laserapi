var laserConfig = require('../LaserApiConfig.js').default
var MasterCanvas = require('../MasterCanvas').default
var PhysicsPong = require('./PhysicsPong').default

var knobPositions = []

var moveSpeed = 20
const itemCount = 6;

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

            knobPositions[k].left = knobPositions[k].left - directions[k].x / length * moveSpeed
            knobPositions[k].top = knobPositions[k].top - directions[k].y / length * moveSpeed

        }

    }

    for (var i = 0; i < itemCount; i++) {

        var rect1 = getRectangleFromKnob(knobPositions [i])
        for (var k = 0; k < itemCount; k++) {
            if (k !== i) {

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
    for (var k = 0; k < itemCount; k++) {

        MasterCanvas.get2dContext().fillStyle = knobPositions [k].color

        MasterCanvas.get2dContext().fillRect(knobPositions [k].left, knobPositions [k].top, knobPositions [k].width, knobPositions [k].width)

    }

    //    console.log(knobPositions)

}

function init() {
    PhysicsPong.init(itemCount)
    knobPositions = []
    for (var i = 0; i < itemCount / 2; i++) {

        knobPositions.push({
            width: 100,
            left: 100,
            top: 100 + i * 110,
            color: '#00aaff'

        })
    }
    for (var i = 0; i < itemCount / 2; i++) {

        knobPositions.push({
            width: 100,
            left: laserConfig.canvasResolution.width - 200,
            top: 100 + i * 110,
            color: '#00aaff'

        })
    }
    console.log('initialised pong ', knobPositions)
}

var lastResolution = -1

export default {

    name: 'Pong Game 2d',
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

        // update physics positions
        for (var i = 0; i < itemCount; i++) {
            if (PhysicsPong.getObstacle(i)) {
                PhysicsPong.getObstacle(i).position = [knobPositions [i].left + 50, knobPositions[i].top + 50]
                PhysicsPong.getObstacle(i).color = knobPositions [i].color
            }

        }
        PhysicsPong.step()
        // console.log('physics pong is ', PhysicsPong)
        PhysicsPong.render(MasterCanvas.get2dContext())
    }

}
