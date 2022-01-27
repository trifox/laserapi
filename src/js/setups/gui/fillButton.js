/**
 * fillButton is a circular area that becomes filled, once filled the state switches to 'ON'
 *
 */
var MasterCanvas = require('../../MasterCanvas').default;
var util = require('../../util.js').default;

function moveToHelper_getGridPixel(data, x, y) {
  const gridSize = Math.floor(Math.sqrt(data.length));
  return data[Math.floor(x) + Math.floor(y) * gridSize];
}

export default ({
  label = 'Sample Button',
  posX,
  posY,
  radius = 10,
  speedUp = 50,
  edges = 5,
  edges2 = 3,
  speedDown = 25,
  angle = 0,
  activeColor = '#00bbff',
  growColor = '#0088ff',
  normalColor = '#0044ff',
  activeValue = 75,
  minValue = 25,
  onEnterActive,
  onExitActive,
}) => {
  var sleeper = 0;
  var currentX = posX;
  var currentY = posY;
  var counter = 0;
  var currentEdges = edges;
  var lastTime = performance.now();
  var currentRadius = radius;
  var currentColor = normalColor;
  var currentLabel = label;
  var currentGrowColor = growColor;
  var currentActiveColor = activeColor;
  var state = 'normal';
  var result = {
    name: 'GUI flipButton',
    init: function () {},
    data: {
      fillState: 0,
    },
    getColor() {
      return currentColor;
    },
    getLabel() {
      return currentLabel;
    },
    getEdges() {
      return edges;
    },
    getEdges2() {
      return edges2;
    },
    setLabel(label) {
      currentLabel = label;
    },
    setColor(newcol) {
      currentColor = newcol;
    },
    setValue(newcol) {
      counter = newcol;
    },
    getGrowColor() {
      return currentGrowColor;
    },
    setGrowColor(newcol) {
      currentGrowColor = newcol;
    },
    getActiveColor() {
      return currentActiveColor;
    },
    setActiveColor(newcol) {
      currentActiveColor = newcol;
    },
    setX(newX) {
      currentX = newX;
    },
    getX() {
      return currentX;
    },
    setY(newX) {
      currentY = newX;
    },
    setEdges(newX) {
      currentEdges = newX;
    },
    setCounter(newX) {
      counter = newX;
    },
    getY() {
      return currentY;
    },
    getRadius() {
      return currentRadius;
    },
    setRadius(newRadius) {
      currentRadius = newRadius;
    },
    handle: function (grid) {
      var ctx = MasterCanvas.get2dContext();
      if (sleeper-- <= 0) {
        sleeper = 1; //update always 1
        var currentTime = performance.now();
        const elapsed = (currentTime - lastTime) / 1000;

        lastTime = currentTime;
        /**
         * here we need to think about how to improve performance, would a shader with one output help here?
         * i think not because the shader would iterate over each field anyways
         *
         * the only thing for performance is that we not go through all the grid, but just rasterize the given circle
         * and query the grid data array for non zero values
         */

        const gridSize = Math.sqrt(grid.length);

        const factx = MasterCanvas.getCanvas().width / gridSize;
        const facty = MasterCanvas.getCanvas().height / gridSize;
        var found = false;

        for (var x = 0; x <= (currentRadius * 2) / factx; x++) {
          for (var y = 0; y <= (currentRadius * 2) / facty; y++) {
            // if there is one, break, this is the scale of the grid, the step 0.. should be in grid pixel resolution
            if (
              moveToHelper_getGridPixel(
                grid,
                x + Math.floor((currentX - currentRadius) / factx),
                y + Math.floor((currentY - currentRadius) / facty)
              ) > 0
            ) {
              // ctx.fillRect(
              //   currentX - radius + x * factx,
              //   currentY - radius + y * facty,
              //   (radius)/(currentRadius * 2) / factx ,
              //   (radius)/(currentRadius * 2) / facty ,
              // );
              //  console.log("found increment!!!!!!!!!!!!!!!",x,y,);
              found = true;
              break;
            }
          }
          if (found) break;
        }
        if (found) {
          counter = Math.min(100, counter + Math.abs(speedUp * elapsed));
          sleeper = 1;
        } else {
          counter = Math.max(0, counter - Math.abs(speedDown * elapsed));
          // make a sleep
          sleeper = 5 + Math.round(Math.random() * 25);
          sleeper = 1;
        }
      }

      //        ctx.strokeStyle = util.rgbToHex(0, 255, 255);
      var oldstate = state;
      if (counter > activeValue) {
        ctx.strokeStyle = currentActiveColor;
        ctx.fillStyle = currentActiveColor;
        state = 'active';
      } else if (counter > minValue) {
        ctx.strokeStyle = currentGrowColor;
        ctx.fillStyle = currentGrowColor;
        state = 'grow';
      } else {
        ctx.strokeStyle = currentColor;
        ctx.fillStyle = currentColor;
        state = 'normal';
      }
      if (oldstate != state) {
        if (oldstate == 'grow' && state == 'active') {
          if (onEnterActive) {
            onEnterActive(result);
          }
        }
        if (oldstate == 'active' && state == 'grow') {
          if (onExitActive) {
            onExitActive(result);
          }
        }
      }
      ctx.lineWidth = 4;
      // ctx.beginPath();
      // ctx.arc(currentX, currentY, currentRadius, 0, 2 * Math.PI);
      // ctx.arc(
      //   currentX,
      //   currentY,
      //   currentRadius * (counter / 100),
      //   0,
      //   2 * Math.PI
      // );
      // ctx.rect(
      //   currentX - currentRadius,
      //   currentY - currentRadius,
      //   currentRadius * 2,
      //   currentRadius * 2
      // );
      // ctx.stroke();

      // ctx.fillText(label, posX, posY - radius);
      util.drawNgon({
        ctx,
        color: ctx.strokeStyle,
        Xcenter: currentX,
        Ycenter: currentY,
        size: currentRadius,
        numberOfSides: currentEdges,
        angle,
      });
      if (edges2) {
        util.drawNgon({
          ctx,
          color: ctx.strokeStyle,
          Xcenter: currentX,
          Ycenter: currentY,
          size: currentRadius / 2,
          numberOfSides: edges2,
          angle,
        });
      }
      util.drawNgon({
        ctx,
        color: ctx.strokeStyle,
        Xcenter: currentX,
        Ycenter: currentY,
        size: currentRadius * (counter / 100),
        numberOfSides: edges,
        filled: false,
        angle,
      });
      util.renderText({
        ctx,
        text: currentLabel,
        x: currentX,
        y: currentY - 10,
        fontSize: '25px',
        fillStyle: 'lightgreen',
      });
    },
  };
  return result;
};
