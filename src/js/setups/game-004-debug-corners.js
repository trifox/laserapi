var laserConfig = require("../LaserApiConfig").default;
var Util = require("../util").default;
var MainCanvas = require("../MasterCanvas").default;

var lastResolution = -1;

function createDiv() {
  var div = document.createElement("div");
  div.style.position = "absolute";
  div.style.width = "100px";
  div.style.height = "100px";
  div.style.backgroundColor = "red";
  div.style.opacity = 0.7;
  div.style.zIndex = "22222";
  return div;
}
//
// var topleft = createDiv()
// var topright = createDiv()
// topright.style.right = 0
//
// var bottomleft = createDiv()
// bottomleft.style.bottom = 0
// var bottomright = createDiv()
// bottomright.style.right = 0
// bottomright.style.bottom = 0
//
// document.body.insertBefore(topleft, document.body.firstChild)
// document.body.insertBefore(topright, document.body.firstChild)
// document.body.insertBefore(bottomleft, document.body.firstChild)
// document.body.insertBefore(bottomright, document.body.firstChild)
const handler = function () {
  // paint markers in the corners
  var size = 75;
  MainCanvas.get2dContext().fillStyle = Util.rgbToHex(
    laserConfig.testColor[0],
    laserConfig.testColor[1],
    laserConfig.testColor[2]
  );
  MainCanvas.get2dContext().strokeStyle = Util.rgbToHex(
    laserConfig.testColor[0],
    laserConfig.testColor[1],
    laserConfig.testColor[2]
  );
  MainCanvas.get2dContext().lineWidth = 8;

  for (var i = 0; i < 1; i += 0.2) {
    drawLine(
      MainCanvas.get2dContext(),
      0,
      laserConfig.canvasResolution.height * i,
      laserConfig.canvasResolution.width,
      laserConfig.canvasResolution.height * i,
      "#ff0000"
    );
    drawLine(
      MainCanvas.get2dContext(),
      laserConfig.canvasResolution.width * i,
      0,
      laserConfig.canvasResolution.width * i,
      laserConfig.canvasResolution.height,
      "#ff0000"
    );
  }
  for (var i = 0; i < 1; i += 2) {
    MainCanvas.get2dContext().fillStyle = "#ff0000";
    MainCanvas.get2dContext().fillRect(i * size, i * size, size, size);
    MainCanvas.get2dContext().fillStyle = "#000000";
    MainCanvas.get2dContext().fillRect(i * size, i * size, size / 3, size / 3);

    MainCanvas.get2dContext().fillStyle = "#ff0000";
    MainCanvas.get2dContext().fillRect(
      laserConfig.canvasResolution.width - i * size - size,
      i * size,
      size,
      size
    );
    MainCanvas.get2dContext().fillStyle = "#000000";
    MainCanvas.get2dContext().fillRect(
      laserConfig.canvasResolution.width - i * size - size / 3,
      i * size,
      size / 3,
      size / 3
    );

    MainCanvas.get2dContext().fillStyle = "#ff0000";
    MainCanvas.get2dContext().fillRect(
      laserConfig.canvasResolution.width - i * size - size,
      laserConfig.canvasResolution.height - i * size - size,
      size,
      size
    );

    MainCanvas.get2dContext().fillStyle = "#000000";

    MainCanvas.get2dContext().fillRect(
      laserConfig.canvasResolution.width - i * size - size / 3,
      laserConfig.canvasResolution.height - i * size - size / 3,
      size / 3,
      size / 3
    );
    MainCanvas.get2dContext().fillStyle = "#0000";
    MainCanvas.get2dContext().fillRect(
      laserConfig.canvasResolution.width - i * size - size / 3,
      laserConfig.canvasResolution.height - i * size - size / 3,
      size / 3,
      size / 3
    );
    MainCanvas.get2dContext().fillStyle = "#ff0000";
    MainCanvas.get2dContext().fillRect(
      i * size,
      laserConfig.canvasResolution.height - i * size - size,
      size,
      size
    );
    MainCanvas.get2dContext().fillStyle = "#000000";
    MainCanvas.get2dContext().fillRect(
      i * size,
      laserConfig.canvasResolution.height - i * size - size / 3,
      size / 3,
      size / 3
    );
    // MainCanvas.get2dContext().strokeRect(
    //   i * size,
    //   i * size,
    //   laserConfig.canvasResolution.width - 2 * i * size,
    //   laserConfig.canvasResolution.height - 2 * i * size
    // );
  }

  //
  // bottomright.style.backgroundColor = Util.rgbToHex(laserConfig.testColor[0], laserConfig.testColor[1], laserConfig.testColor[2])
  // bottomleft.style.backgroundColor = Util.rgbToHex(laserConfig.testColor[0], laserConfig.testColor[1], laserConfig.testColor[2])
  // topleft.style.backgroundColor = Util.rgbToHex(laserConfig.testColor[0], laserConfig.testColor[1], laserConfig.testColor[2])
  // topright.style.backgroundColor = Util.rgbToHex(laserConfig.testColor[0], laserConfig.testColor[1], laserConfig.testColor[2])
};
function drawLine(ctx, x1, y1, x2, y2, color = "#ffffff") {
  MainCanvas.get2dContext().strokeStyle = color;
  MainCanvas.get2dContext().beginPath();
  MainCanvas.get2dContext().moveTo(x1, y1);
  MainCanvas.get2dContext().lineTo(x2, y2);
  MainCanvas.get2dContext().stroke();
}
export default {
  name: "Debug Grid",
  init: function () {},
  handle: function (grid) {
    handler(grid);
  },
  stop: function () {},
};
