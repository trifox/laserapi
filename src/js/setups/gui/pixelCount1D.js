/**
 * fillButton is a circular area that becomes filled, once filled the state switches to 'ON'
 *
 */
var MasterCanvas = require('../../MasterCanvas').default;
var util = require('../../util.js').default;
import { lerp, slerp } from '../../math.js';
function moveToHelper_getGridPixel(data, x, y) {
  const gridSize = Math.floor(Math.sqrt(data.length));
  return data[Math.floor(x) + Math.floor(y) * gridSize];
}

export default ({
  live = true,
  label1 = 'Pixel Counter 1d',
  label2 = 'Pixel Counter 1d',
  posX,
  posY,
  radius = 10,
  radiusY = 100,
  normalColor = '#008844',
  speedX = 0,
  speedY = 0,
  onEnterActive,
  onExitActive,
  scanRadiusFactor = 1.5,
  innerRadiusFactor = 0.5,
  angle = 0,
}) => {
  var freezeResult = 0
  var totalCount = 0;
  var pixelCount = 0;
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
  var currentLabel1 = label1;
  var currentLabel2 = label2;
  var meanX = 0
  var meanY = 0
  return {
    name: 'GUI pixel Count 1d button',
    init: function () { },
    data: {
      fillState: 0,
    },
    getFillPercent() {
      return Math.round((pixelCount / totalCount) * 100);
    },
    setLabel(newLabel) {
      currentLabel1 = newLabel;
    },
    getLabel() {
      return currentLabel1;
    },
    setLabel2(newLabel) {
      currentLabel2 = newLabel;
    },
    getLabel() {
      return currentLabel2;
    },
    getMeanX() {
      return meanX;
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
    getRadiusY() {
      return radiusY;
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
    handle: function (grid) {
      /** calculates the mean of 1dimensional range found pixels */
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

      totalCount = 1;
      pixelCount = 1;
      meanX = 0
      meanY = 0
      for (var x = 0; x <= (radius * 2) / factx; x++) {
        for (var y = 0; y <= (radiusY * 2) / facty; y++) {
          totalCount++;
          // if there is one, break, this is the scale of the grid, the step 0.. should be in grid pixel resolution
          if (
            moveToHelper_getGridPixel(
              grid,
              x + Math.floor((currentX - radius) / factx),
              y + Math.floor((currentY - radiusY) / facty)
            ) > 0
          ) {
            pixelCount++;
            meanX += x
            meanY += y
          }
        }
      }
      // console.log('Mean count is ', meanX, meanY, pixelCount)

      meanX = (meanX / pixelCount) * factx
      meanY = (meanY / pixelCount) * facty
      // console.log("Mean x y", meanX, meanY)
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

      ctx.beginPath();
      ctx.rect(currentX - radius, currentY - radiusY, radius * 2, radiusY * 2);
      ctx.stroke();

      ctx.beginPath();
      ctx.lineWidth = 2;
      ctx.rect(
        currentX - radius * scanRadiusFactor,
        currentY - radiusY * scanRadiusFactor,
        radius * 2 * scanRadiusFactor,
        radiusY * 2
      );
      ctx.stroke();

      ctx.fillRect(
        currentX - radius,
        currentY - radius - radius * 2 * (pixelCount / totalCount) * 2,
        radius * 2,
        radius * 2 * (pixelCount / totalCount) * 2
      );
      if (live) {
        ctx.fillStyle = "#004400";
        ctx.fillRect(
          currentX - radius + meanX - 50, currentY - radiusY, 100, radiusY * 2
        );
      }

      util.renderText({
        ctx,
        text: `${currentLabel1}`,
        x: currentX - currentRadius,
        y: currentY - radiusY - 25,
        fontSize: '25px',
        fillStyle: 'white',
      });
      util.renderText({
        ctx,
        text: `${currentLabel2}`,
        x: currentX + currentRadius,
        y: currentY - radiusY - 25,
        fontSize: '25px',
        fillStyle: 'white',
      });
    },
  };
};
