/**
 * fillButton is a circular area that becomes filled, once filled the state switches to 'ON'
 *
 */
var MasterCanvas = require("../../MasterCanvas").default;
var util = require("../../util.js").default;

function moveToHelper_getGridPixel(data, x, y) {
  const gridSize = Math.floor(Math.sqrt(data.length));
  return data[Math.floor(x) + Math.floor(y) * gridSize];
}

export default ({
  label = "Sample Buttohn",
  posX,
  posY,
  radius = 10,
  speedUp = 1,
  speedDown = 0.1,
  activeColor = "#ffff00",
  growColor = "#00ffff",
  normalColor = "#0000ff",
  activeValue = 75,
  onEnterActive,
  onExitActive,
  minValue = 25,
}) => {
  var sleeper = 0;
  var counter = 0;
  var lastTime = performance.now();
  var state = "normal";
  return {
    name: "GUI flipButton",
    init: function () {},
    data: {
      fillState: 0,
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
        var found = false;
        for (var x = 0; x <= (radius * 2) / factx; x++) {
          for (var y = 0; y <= (radius * 2) / facty; y++) {
            // if there is one, break, this is the scale of the grid, the step 0.. should be in grid pixel resolution
            if (
              moveToHelper_getGridPixel(
                grid,
                x + Math.floor((posX - radius) / factx),
                y + Math.floor((posY - radius) / facty)
              ) > 0
            ) {
              // console.log("found increment!!!!!!!!!!!!!!!");
              found = true;
              break;
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
      }
      var ctx = MasterCanvas.get2dContext();

      //        ctx.strokeStyle = util.rgbToHex(0, 255, 255);
      var oldstate = state;
      if (counter > activeValue) {
        ctx.strokeStyle = activeColor;
        state = "active";
      } else if (counter > minValue) {
        ctx.strokeStyle = growColor;
        state = "grow";
      } else {
        ctx.strokeStyle = normalColor;
        state = "normal";
      }
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
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(posX, posY, radius, 0, 2 * Math.PI);
      ctx.arc(posX, posY, radius * (counter / 100), 0, 2 * Math.PI);
      ctx.rect(posX - radius, posY - radius, radius * 2, radius * 2);
      ctx.stroke();

      // ctx.fillText(label, posX, posY - radius);

      util.renderText({
        ctx,
        text: label,
        x: posX,
        y: posY - 10,
        fontSize: "25px",
        fillStyle: "white",
      });
    },
  };
};
