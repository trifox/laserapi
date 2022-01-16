var laserConfig = require("../LaserApiConfig").default;

var hermite = require("cubic-hermite");
var MainCanvas = require("../MasterCanvas").default;

function lerp(v0, v1, t) {
  return (1 - t) * v0 + t * v1;
}
var lastResolution = -1;
function drawLineNormalized(areaWidth, areaHeight, context, p1, p2, color) {
  drawLine(
    context,
    {
      x: p1.x * areaWidth,
      y: p1.y * areaHeight,
    },
    {
      x: p2.x * areaWidth,
      y: p2.y * areaHeight,
    },
    color
  );
}
function drawLineNormalizedExtended(
  areaWidth,
  areaHeight,
  context,
  p1,
  p2,
  color,
  sl1 = 1,
  sl2 = 1
) {
  drawLineNormalized(areaWidth, areaHeight, context, p1, p2, color);
  // make funny dots along line
  // console.log("HERMITE SLOPES ARE", sl1, sl2);
  for (var i = 0; i < 10; i++) {
    var size = 8;
    context.strokeRect(
      lerp(
        p1.x * areaWidth,
        p2.x * areaWidth,
        hermite(0, sl1, 1, sl2, i / 10)
      ) -
        size / 2,
      lerp(
        p1.y * areaHeight,
        p2.y * areaHeight,
        hermite(0, sl1, 1, sl2, i / 10)
      ) -
        size / 2,

      size,
      size
    );
  }
}
function drawLine(context, p1, p2, color) {
  context.strokeStyle = color;
  context.beginPath();
  context.moveTo(p1.x, p1.y);
  context.lineTo(p2.x, p2.y);
  context.stroke();
}

function drawQuad(areaWidth, areaHeight, context, transform) {
  MainCanvas.get2dContext().fillStyle = "#ffffff";
  // console.log("drawing transform ", transform);
  drawLineNormalizedExtended(
    areaWidth,
    areaHeight,
    context,
    transform.topleft,
    transform.topright,
    "#00ffff",
    transform.topleft.slopex * 2,
    transform.topright.slopex * 2
  );
  drawLineNormalizedExtended(
    areaWidth,
    areaHeight,
    context,
    transform.topleft,
    transform.bottomleft,
    "#00ffff",
    transform.topleft.slopey * 2,
    transform.bottomleft.slopey * 2
  );
  drawLineNormalizedExtended(
    areaWidth,
    areaHeight,
    context,
    transform.bottomleft,
    transform.bottomright,
    "#00ffff",
    transform.bottomleft.slopex * 2,
    transform.bottomright.slopex * 2
  );
  drawLineNormalizedExtended(
    areaWidth,
    areaHeight,
    context,
    transform.bottomright,
    transform.topright,
    "#00ffff",
    transform.bottomright.slopey * 2,
    transform.topright.slopey * 2
  );
  //
  // diagonal lines following
  // ...
  drawLineNormalized(
    areaWidth,
    areaHeight,
    context,
    transform.bottomleft,
    transform.topright
  );
  drawLineNormalized(
    areaWidth,
    areaHeight,
    context,
    transform.topleft,
    transform.bottomright
  );
}

const handler = function () {
  // paint markers in the corners
  MainCanvas.get2dContext().fillStyle = "#ffffff";
  MainCanvas.get2dContext().strokeStyle = "#ffffff";
  MainCanvas.get2dContext().lineWidth = 2;
  var size = 8;
  MainCanvas.get2dContext().strokeRect(
    laserConfig.transform.topleft.x * laserConfig.testResolution.width -
      size / 2,
    laserConfig.transform.topleft.y * laserConfig.testResolution.height -
      size / 2,
    size,
    size
  );

  MainCanvas.get2dContext().strokeRect(
    laserConfig.transform.topright.x * laserConfig.testResolution.width -
      size / 2,
    laserConfig.transform.topright.y * laserConfig.testResolution.height -
      size / 2,
    size,
    size
  );
  MainCanvas.get2dContext().strokeRect(
    laserConfig.transform.bottomleft.x * laserConfig.testResolution.width -
      size / 2,
    laserConfig.transform.bottomleft.y * laserConfig.testResolution.height -
      size / 2,
    size,
    size
  );
  MainCanvas.get2dContext().strokeRect(
    laserConfig.transform.bottomright.x * laserConfig.testResolution.width -
      size / 2,
    laserConfig.transform.bottomright.y * laserConfig.testResolution.height -
      size / 2,
    size,
    size
  );

  drawQuad(
    laserConfig.videoResolution.width,
    laserConfig.videoResolution.height,
    MainCanvas.get2dContext(),
    laserConfig.transform
  );
};

export default {
  drawQuad: drawQuad,
  name: "Debug Grid",
  handle: function (grid) {
    handler(grid);
  },
};
