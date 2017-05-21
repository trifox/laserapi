var laserConfig = require('../LaserApiConfig.js').default
var MasterCanvas = require('../MasterCanvas').default

const createItem = function (index) {

    var div = document.createElement('div');
    div.style.backgroundColor = 'green';
    div.style.position = 'absolute';
    div.style.width = 75;
    div.style.height = 75;
    div.style.top = 100 + (index % 3 ) * 100;
    div.style.left = 100 + Math.floor(index / 3) * 100;
    div.style.zIndex = 1000;

    return div;
}
var divs = []

var knobPositions = []

var moveSpeed = 20
const itemCount = 6;
//
// for (var i = 0; i < itemCount / 2; i++) {
//
//     var div = createItem(i)
//     canvas.parentNode.appendChild(div)
//     divs.push(div);
//     div.style.borderRadius = '5px'
//     div.style.border = '5px solid lightgreen'
//
// }
// for (var i = 0; i < itemCount / 2; i++) {
//
//     var div = createItem(i)
//     canvas.parentNode.appendChild(div)
//     divs.push(div);
//     if (i < itemCount / 2) {
//
//         div.style.borderRadius = '5px'
//         div.style.border = '5px solid lightblue'
//         div.style.backgroundColor = 'blue';
//         div.style.left = 400;
//
//     }
// }

const isInsideRect = function (rect1, rect2) {
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
const getRectangleFromBoundingRect = function (clientBoundingRect) {
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
const getRectangleFromKnob = function (knobEntry) {
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
    var scalex = MasterCanvas.width / laserConfig.gridResolution
    var scaley = MasterCanvas.height / laserConfig.gridResolution
    for (var i = 0; i < grid.length; i++) {

        if (grid[i] > 0) {
            //  console.log('scale ', canvas.getBoundingClientRect(), laserConfig, scalex, scaley)
            // rect for grid plate object
            for (var k = 0; k < itemCount; k++) {
                var div = divs[k]
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
            //       oldPositions [k] = divs[k].getBoundingClientRect()

            //  var length = Math.sqrt(directions[k].x * directions[k].x + directions[k].y * directions[k].y)
            //     divs[k].style.left = divs[k].getBoundingClientRect().left - directions[k].x / length * moveSpeed
            //     divs[k].style.top = divs[k].getBoundingClientRect().top - directions[k].y / length * moveSpeed
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
                    //  console.log('Overlap ', rect1, rect2)
                    //             divs[k].style.left = oldPositions [k].left
                    //              divs[k].style.top = oldPositions [k].top

                    //               divs[i].style.left = oldPositions [i].left
                    //               divs[i].style.top = oldPositions [i].top
                }
            }
        }

    }
    for (var k = 0; k < itemCount; k++) {

        MasterCanvas.get2dContext().fillStyle = '#0000ff'

        MasterCanvas.get2dContext().fillRect(knobPositions [k].left, knobPositions [k], knobPositions [k].width, knobPositions [k].width)

    }

    console.log(knobPositions)

}

function init() {
    knobPositions = []
    for (var i = 0; i < itemCount; i++) {

        knobPositions [i] = {
            width: 100,
            left: 0,
            top: 0,
            color: 'green'

        }
    }

}

export default {
    init: function () {
        init()
    },
    handle: function (grid) {
        handler(grid)
    }

}
