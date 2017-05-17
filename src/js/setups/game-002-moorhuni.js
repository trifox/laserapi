var laserConfig = require('../LaserApiConfig.js').default

var canvas = document.getElementById('canvascontainer')

const createItem = (index) => {

    var div = document.createElement('div');
    div.style.backgroundColor = 'green';
    div.style.position = 'absolute';
    div.style.width = 75;
    div.style.height = 75;
    div.style.top = 300 + (index % 3 ) * 80;
    div.style.left = 300 + Math.floor(index / 3 ) * 80;
    div.style.zIndex = 1000;

    return div;
}
var divs = []

const itemCount = 10;

for (var i = 0; i < itemCount; i++) {

    var div = createItem(i)
    canvas.parentNode.appendChild(div)
    divs[i] = div;

}
const isInsideRect = (rect1, rect2) => {
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

const handler = (grid) => {

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

                    directions[k].x += (getDist(rect1, rect2).x / length ) * 2
                    directions[k].y += (getDist(rect1, rect2).y / length ) * 2
                    //      console.log('moving ', direction)
                } else {

                    //    console.log('not intersectiong ', rect1, rect2)
                    //      console.log('dist is ', getDist(rect1, rect2))

                }
            }
        } else {

        }

    }
    for (var k = 0; k < itemCount; k++) {
        divs[k].style.left = divs[k].getBoundingClientRect().left - directions[k].x * 1
        divs[k].style.top = divs[k].getBoundingClientRect().top - directions[k].y * 1
    }
}

export default {

    handle: (grid) => {
        handler(grid)
    }

}
