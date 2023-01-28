/**
 * fillButton is a circular area that becomes filled, once filled the state switches to 'ON'
 *
 */
var MasterCanvas = require('../../MasterCanvas').default;
var util = require('../../util.js').default;
import { lerp, slerp } from './../../math.js';
function moveToHelper_getGridPixel(data, x, y) {
  const gridSize = Math.floor(Math.sqrt(data.length));
  return data[Math.floor(x) + Math.floor(y) * gridSize];
}

const guiFollowCircle = ({
  label = 'Follow Circle',
  posX,
  posY,
  radius = 100,
  speedUp = 0.1,
  speedDown = 0.1,
  normalColor = '#008844', 
  speedX = 0,
  edges,
  lineWidth = 4,
  edges2,
  shrinkSpeed = 0, 
  speedY = 0,
  onEnterActive,
  onExitActive,
  scanRadiusFactor = 1,
  innerRadiusFactor = 0.5,
  followTrueOrRepellFalse = true,
  angle = 0,
}) => {
  var sleeper = 0;
  var currentX = posX;
  var currentY = posY;
  var currentSpeedX = speedX;
  var currentSpeedY = speedY;
  var currentAngle = angle;
  var currentRadius = radius;
  var currentNormalColor = normalColor;
  var currentScanRadiusFactor = scanRadiusFactor;
  var currentInnerRadiusFactor = innerRadiusFactor;

  var currentScanRadius = radius * currentScanRadiusFactor; // private value calculates the scan radius based on scan factor
  var lastTime = performance.now();
  var state = 'normal';
  return {
    name: 'GUI flipButton',
    init: function () {},
    data: {
      fillState: 0,
    },
    setX(newX) {
      currentX = newX;
    },
    getX() {
      return currentX;
    },
    setInnerRadiusFactor(newX) {
      currentInnerRadiusFactor = newX;
    },
    getInnerRadiusFactor() {
      return currentInnerRadiusFactor;
    },
    getAngle() {
      return currentAngle;
    },
    setAngle(newX) {
      currentAngle = newX;
    },
    setColor(newX) {
      currentNormalColor = newX;
    },
    getColor() {
      return currentNormalColor;
    },
    setRadius(newX) {
      currentRadius = newX;
    },
    getRadius() {
      return currentRadius;
    },
    setY(newY) {
      currentY = newY;
    },
    getY() {
      return currentY;
    },
    setSpeedY(newY) {
      currentSpeedY = newY;
    },
    getSpeedY() {
      return currentSpeedY;
    },
    setSpeedX(newY) {
      currentSpeedX = newY;
    },
    getSpeedX() {
      return currentSpeedX;
    },
    handle: function (grid,elapsed) {
      if (sleeper-- <= 0) {
        sleeper = 1; //update always 1 
 
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
        var first = true;
        var midCoord = {};
        var count = 0;
        for (var x = 0; x <= (currentScanRadius * 2) / factx; x++) {
          for (var y = 0; y <= (currentScanRadius * 2) / facty; y++) {
            const currX = currentX - currentScanRadius;
            const currY = currentY - currentScanRadius;
            // if there is one, break, this is the scale of the grid, the step 0.. should be in grid pixel resolution
            if (
              moveToHelper_getGridPixel(
                grid,
                x + Math.floor(currX / factx),
                y + Math.floor(currY / facty)
              ) > 0
            ) {
              count++;
              if (first) {
                midCoord = { x, y };
              } else {
                midCoord = { x: x + midCoord.x, y: y + midCoord.y };
              }
              first = false;
            }
          }
        }
        midCoord = {
          x: midCoord.x / count,
          y: midCoord.y / count,
        };
        if (!first) {
          // first flag indicates that one field has been found and a valid mass center is available
          if (followTrueOrRepellFalse) {
          
            currentSpeedX = lerp(
              currentSpeedX,
              midCoord.x / ((currentScanRadius * 2) / factx) - 0.5,
              speedUp
            );
            currentSpeedY = lerp(
              currentSpeedY,
              midCoord.y / ((currentScanRadius * 2) / facty) - 0.5,
              speedUp
            );
          } else {
            currentSpeedX = lerp(
              currentSpeedX,
              -(midCoord.x / ((currentScanRadius * 2) / factx) - 0.5),
              speedUp
            );
            currentSpeedY = lerp(
              currentSpeedY,
              -(midCoord.y / ((currentScanRadius * 2) / facty) - 0.5),
              speedUp
            );
          }
        } else {
          currentSpeedX = lerp(currentSpeedX, 0, speedDown);
          currentSpeedY = lerp(currentSpeedY, 0, speedDown);
          currentRadius = Math.max(0, currentRadius - shrinkSpeed * elapsed);
        }
        currentX = currentX + currentSpeedX * elapsed * 1000;
        currentY = currentY + currentSpeedY * elapsed * 1000;
      }
    
      var ctx = MasterCanvas.get2dContext();

      var oldstate = state;

      ctx.strokeStyle = currentNormalColor;

      if (oldstate != state) {
        if (oldstate == 'grow' && state == 'active') {
          if (onEnterActive) {
            onEnterActive();
          }
        }
        if (oldstate == 'active' && state == 'grow') {
          if (onExitActive) {
            onExitActive();
          }
        }
      }

      ctx.lineWidth = lineWidth;
    
      util.renderText({
        ctx,
        text: label,
        x: currentX,
        y: currentY - 10,
        fontSize: '25px',
        fillStyle: normalColor,
      });
      if (edges) {
        util.drawNgon({
          ctx,
          color: currentNormalColor,
          Xcenter: currentX,
          Ycenter: currentY,
          size: currentRadius,
          numberOfSides: edges,
          angle: currentAngle,
          lineWidth,
        });
      }
      if (edges2) {
        util.drawNgon({
          ctx,
          color: currentNormalColor,
          Xcenter: currentX,
          Ycenter: currentY,
          size: currentRadius * currentInnerRadiusFactor,
          numberOfSides: edges2,
          angle: currentAngle,
          lineWidth: lineWidth / 2,
        });
        ctx.arc(currentX, currentY, currentRadius, 0, Math.PI);
      }
    },
  };
};
export default guiFollowCircle;
