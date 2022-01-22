/**
 * fillButton is a circular area that becomes filled, once filled the state switches to 'ON'
 *
 */
var MasterCanvas = require("../../MasterCanvas").default;
var util = require("../../util.js").default;
import { lerp, slerp } from "./../../math.js";
function moveToHelper_getGridPixel(data, x, y) {
  const gridSize = Math.floor(Math.sqrt(data.length));
  return data[Math.floor(x) + Math.floor(y) * gridSize];
}

export default ({
  label = "Follow Circle",
  posX,
  posY,
  radius = 10,
  speedUp = 0.1,
  speedDown = 0.1,
  activeColor = "#ffff00",
  growColor = "#00ffff",
  normalColor = "#008844",
  activeValue = 75,
  speedX = 0,
  edges = 10,
  speedY = 0,
  onEnterActive,
  onExitActive,
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
  var counter = 0;
  var lastTime = performance.now();
  var state = "normal";
  return {
    name: "GUI flipButton",
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
    handle: function (grid) {
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
        var first = true;
        var midCoord = {};
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
              if (first) {
                midCoord = { x, y };
              } else {
                midCoord = { x: (x + midCoord.x) / 2, y: (y + midCoord.y) / 2 };
              }
              first = false;
            }
          }
        }
        if (!first) {
          // first flag indicates that one field has been found and a valid mass center is available
          currentSpeedX = lerp(
            currentSpeedX,
            midCoord.x / ((currentRadius * 2) / factx) - 0.5,
            speedUp
          );
          currentSpeedY = lerp(
            currentSpeedY,
            midCoord.y / ((currentRadius * 2) / facty) - 0.5,
            speedUp
          );
        } else {
          currentSpeedX = lerp(currentSpeedX, 0, speedDown);
          currentSpeedY = lerp(currentSpeedY, 0, speedDown);
        }
        currentX = currentX + currentSpeedX * elapsed * 1000;
        currentY = currentY + currentSpeedY * elapsed * 1000;
      }
      // console.log(
      //   "data",
      //   currentX,
      //   currentY,
      //   currentSpeedX,
      //   currentSpeedY,
      //   radius
      // );
      var ctx = MasterCanvas.get2dContext();

      //        ctx.strokeStyle = util.rgbToHex(0, 255, 255);
      var oldstate = state;

      ctx.strokeStyle = currentNormalColor;

      if (oldstate != state) {
        if (oldstate == "grow" && state == "active") {
          if (onEnterActive) {
            onEnterActive();
          }
        }
        if (oldstate == "active" && state == "grow") {
          if (onExitActive) {
            onExitActive();
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
      // currentAngle = Math.atan2(currentSpeedX, currentSpeedY);
      util.renderText({
        ctx,
        text: label,
        x: currentX,
        y: currentY - 10,
        fontSize: "25px",
        fillStyle: "white",
      });
      util.drawNgon({
        ctx,
        color: currentNormalColor,
        Xcenter: currentX,
        Ycenter: currentY,
        size: currentRadius,
        numberOfSides: edges,
        angle: currentAngle,
      });
    },
  };
};
