/**
 * flipButton is a button that is triggering onEnter, onExit events when a laser pointer has been detected
 * underneath
 *
 */
var MasterCanvas = require("../../MasterCanvas").default;
var util = require("../../util.js").default;

var guiFlipButton = require("./flipButton").default;
var guiFillButton = require("./fillButton").default;
function moveToHelper_getGridPixel(data, x, y) {
  const gridSize = Math.floor(Math.sqrt(data.length));
  return data[Math.floor(x) + Math.floor(y) * gridSize];
}
import { explerp } from "./../../math";
var lastTime;
export default ({
  label = "Switch",
  label2 = "Switch2",
  posX,
  posY,
  onChange,
  startValue = 0.4,
  minValue = 0.00001,
  maxValue = 1,
  radius = 50,
  step = 0.1,
  exponential = false,
}) => {
  var down = true;
  var currentValue = startValue;
var updateView=()=>{

  if (down) {
    button.setLabel(label);
    button.setEdges(5);
  } else {
    button.setLabel(label2);
    button.setEdges(3);
  }
}
  var button = guiFillButton({
    label: label,
    posX: posX,
    posY: posY,
    radius: radius,
    onEnterActive: () => {
      down = !down;
updateView()
      if (onChange) {
        onChange(down);
      }
    },
  });
  var buttons = [button];
updateView()
  return {
    getValue: () =>
      exponential
        ? explerp(
            minValue,
            maxValue,
            Math.abs(currentValue - minValue) / Math.abs(maxValue - minValue)
          )
        : currentValue,
    name: "Range Slider",
    init: function () {},
    data: {
      fillState: 0,
    },
    getIsChecked() {
      return down;
    },
    reset: () => {
      currentValue = startValue;
      currentStep = step;
    },
    setStep(newStep) {
      currentStep = newStep;
    },
    handle: function (grid) {
      var ctx = MasterCanvas.get2dContext();
      buttons.forEach((item) => item.handle(grid));
    },
  };
};
