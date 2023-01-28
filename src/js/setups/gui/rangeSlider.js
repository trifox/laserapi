/**
 * flipButton is a button that is triggering onEnter, onExit events when a laser pointer has been detected
 * underneath
 *
 */
var MasterCanvas = require('../../MasterCanvas').default;
var util = require('../../util.js').default;

var guiFlipButton = require('./flipButton').default;
function moveToHelper_getGridPixel(data, x, y) {
  const gridSize = Math.floor(Math.sqrt(data.length));
  return data[Math.floor(x) + Math.floor(y) * gridSize];
}
import { explerp } from './../../math'; 
export default ({
  label = 'Range Slider',
  posX,
  posY,
  width = 200,
  height = 50,
  growColor = '#00ffff',
  normalColor = '#0088ff', 
  startValue = 0.4,
  minValue = 0.00001,
  maxValue = 1,
  step = 0.02,
  exponential = false,
  upLabel='-',
  downLabel='+',
}) => { 
  var currentStep = step;
  var currentValue = startValue; 
  var state = 'normal';
  const radius = height / 2;
  var buttonPlusActive = false;
  var buttonMinusActive = false;
  var buttons = [
    guiFlipButton({
      label: downLabel,
      posX: posX + width - radius,
      posY: posY + radius,
      radius: radius,
      normalColor,
      activeColor: growColor,
      onEnter: () => (buttonPlusActive = true),
      onExit: () => (buttonPlusActive = false),
    }),
    guiFlipButton({
      label: upLabel,
      posY: posY + radius,
      posX: posX + radius,
      radius: radius,
      normalColor,
      activeColor: growColor,
      onEnter: () => (buttonMinusActive = true),
      onExit: () => (buttonMinusActive = false),
    }),
  ];

  return {
    getValue: () =>
      exponential
        ? explerp(
            minValue,
            maxValue,
            Math.abs(currentValue - minValue) / Math.abs(maxValue - minValue)
          )
        : currentValue,
    name: 'Range Slider',
    init: function () {},
    data: {
      fillState: 0,
    },
    reset: () => {
      currentValue = startValue;
      currentStep = step;
    },
    setStep(newStep) {
      currentStep = newStep;
    },
    handle: function (grid, elapsed) {
      var ctx = MasterCanvas.get2dContext();

      //        ctx.strokeStyle = util.rgbToHex(0, 255, 255);
      var oldstate = state;
      // if (found) {
      //   ctx.strokeStyle = activeColor;
      //   state = "active";
      // } else {
      //   ctx.strokeStyle = normalColor;
      //   state = "inactive";
      // }
      // if (oldstate != state) {
      //   if (state == "active") {
      //     if (onEnter) {
      //       onEnter();
      //     }
      //   }
      //   if (state == "inactive") {
      //     if (onExit) {
      //       onExit();
      //     }
      //   }
      // }

      // ctx.fillText(label, posX, posY - radius);
      if (buttonMinusActive) {
        currentValue = Math.max(
          currentValue - currentStep * elapsed,
          Math.min(minValue, maxValue)
        );
      }
      if (buttonPlusActive) {
        currentValue = Math.min(
          currentValue + currentStep * elapsed,
          Math.max(minValue, maxValue)
        );
      }
      ctx.lineWidth = height / 2;
      ctx.strokeStyle = normalColor;
      ctx.beginPath();
      ctx.moveTo(posX, posY + height / 2);
      ctx.lineTo(
        posX +
          (Math.abs(this.getValue() - minValue) /
            Math.abs(maxValue - minValue)) *
            width,
        posY + height / 2
      );

      ctx.stroke();

      ctx.lineWidth = height / 8;
      ctx.strokeStyle = growColor;
      ctx.beginPath();
      ctx.moveTo(posX, posY + height / 2);
      ctx.lineTo(
        posX +
          (Math.abs(currentValue - minValue) / Math.abs(maxValue - minValue)) *
            width,
        posY + height / 2
      );
      ctx.stroke();

      ctx.strokeStyle = '#8888ff';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.rect(posX, posY, width, height);
      ctx.stroke();

      buttons.forEach((item) => item.handle(grid, elapsed));

      util.renderTextDropShadow({
        ctx,
        text: this.getValue().toFixed(5),
        x: posX + width / 2,
        y: posY + height / 2,
        fontSize: '20px',
        fillStyle: normalColor,
        dropDistX: 2,
        dropDistY: 2,
      });
      util.renderTextDropShadow({
        ctx,
        text: label,
        x: posX + 5,
        y: posY + 25,
        align: 'left',
        fontSize: '25px',
        fillStyle: normalColor,
        dropDistX: 2,
        dropDistY: 2,
      });
    },
  };
};
