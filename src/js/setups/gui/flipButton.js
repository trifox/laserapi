/**
 * flipButton is a button that is triggering onEnter, onExit events when a laser pointer has been detected
 * underneath
 *
 */
var MasterCanvas = require("../../MasterCanvas").default;
var util = require("../../util.js").default;

function moveToHelper_getGridPixel(data, x, y) {
  const gridSize = Math.floor(Math.sqrt(data.length));
  return data[Math.floor(x) + Math.floor(y) * gridSize];
}

export default ({
  label = "Flip Button",
  posX,
  posY,
  radius = 10,
  activeColor = "#ffff00", 
  normalColor = "#008844",
  onEnter,
  onExit,
}) => {
  var sleeper = 0;
  var counter = 0;
  var lastTime = performance.now();
  var state = "normal";
  return {
    name: "GUI fillButton",
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
        for (
          var x = 0;
          x <= (radius *2/ factx) /** why the heck is it 8 here??!~! */;
          x++
        ) {
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
          }
          if (found) break;
        }
      }
      var ctx = MasterCanvas.get2dContext();

      //        ctx.strokeStyle = util.rgbToHex(0, 255, 255);
      var oldstate = state;
      if (found) {
        ctx.strokeStyle = activeColor;
        state = "active";
      } else {
        ctx.strokeStyle = normalColor;
        state = "inactive";
      }
      if (oldstate != state) {
        if (state == "active") {
          if (onEnter) {
            onEnter();
          }
        }
        if (state == "inactive") {
          if (onExit) {
            onExit();
          }
        }
      }
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.arc(posX, posY, radius, 0, 2 * Math.PI);
      ctx.arc(posX, posY, radius * (counter / 100), 0, 2 * Math.PI);
      ctx.stroke();

      // ctx.fillText(label, posX, posY - radius);

      util.renderTextDropShadow({
        ctx,
        text: label,
        x: posX,
        y: posY,
        fontSize: "25px",
        fillStyle: "white",
        dropDistX: 2,
        dropDistY: 2,
      });
    },
  };
};
