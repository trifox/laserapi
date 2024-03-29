var laserConfig = require("../LaserApiConfig").default;
var LaserApi = require("../LaserApi").default;
var MainCanvas = require("../MasterCanvas").default;

var lastResolution = -1;
var fadeDuration = 1500;
var myGrid = [];

function init(count) {
  myGrid = [];
  console.log("initialising fade ", count);
  for (var i = 0; i < count; i++) {
    myGrid.push({
      active: false,
      time: performance.now(),
    });
  }
}
function toPaddedHexString(num, len) {
  //    console.log('toPaddedHexString', num, len)
  var str = (num % 256).toString(16);
  return "0".repeat(len - str.length) + str;
}

function getColorString(r, g, b) {
  var result =
    "#" +
    toPaddedHexString(Math.floor(Math.abs(r)), 2) +
    toPaddedHexString(Math.floor(Math.abs(g)), 2) +
    toPaddedHexString(Math.floor(Math.abs(b)), 2);
  //  console.log('result is ', r, g, b, result)
  return result;
}

function getColorString2(position) {
  // console.log('position is ',position)
  if (position > 1) {
    position = 1;
  }

  if (position < 0) {
    position = 0;
  }
  var green = {
    x: 0,
    y: 255,
    z: 0,
  };
  var turkis = {
    x: 0,
    y: 255,
    z: 255,
  };
  var blue = {
    x: 0,
    y: 0,
    z: 255,
  };
  var darkgrey = {
    x: 0,
    y: 128,
    z: 128,
  };
  var black = {
    x: 0,
    y: 0,
    z: 0,
  };

  var colors = [
    green,
    turkis,
    black,
    black,
    // turkis,
    // blue,
    // black,
    // turkis,
    // black,
    // black
  ];

  var index1 = Math.floor(position * (colors.length - 2));
  var index2 = Math.floor(position * (colors.length - 2)) + 1;
  // console.log('lerping colors', position, colors, index1, index2)
  var lerpresult = LaserApi.lerp3d(
    colors[index1],
    colors[index2],
    (position - (index1 * 1) / (colors.length - 2)) * (colors.length - 2)
  );
  return getColorString(lerpresult.x, lerpresult.y, lerpresult.z);
}

const handler = function (laserGrid) {
  if (lastResolution != laserGrid.length) {
    init(laserGrid.length);
    lastResolution = laserGrid.length;
    console.log("resolution is ", laserGrid);
  }
  var currentDate = performance.now();
  for (var x = 0; x < laserConfig.gridResolution; x++) {
    for (var y = 0; y < laserConfig.gridResolution; y++) {
      var gwidth =
        laserConfig.canvasResolution.width / laserConfig.gridResolution;
      var gheight =
        laserConfig.canvasResolution.height / laserConfig.gridResolution;

      var ggx = x * gwidth;
      var ggy = y * gheight;
      var gIndex = y * laserConfig.gridResolution + x;

      if (myGrid[gIndex].active) {
        myGrid[gIndex].active =
          currentDate - myGrid[gIndex].time < fadeDuration;
        // random      MainCanvas.get2dContext().fillStyle = '#00' + Math.floor(Math.random() * 255).toString(16) + 'ff'
        //    console.log('diff is ', currentDate, myGrid[gIndex].time, currentDate - myGrid[gIndex].time)
        //    MainCanvas.get2dContext().fillStyle = getColorString(0, 255 - ((currentDate - myGrid[gIndex].time) / fadeDuration) * 255, 0, 255)
        MainCanvas.get2dContext().fillStyle = getColorString2(
          (currentDate - myGrid[gIndex].time) / fadeDuration
        );
        // context.fillText('' +LaserApi . gRect[gIndex], ggx + gwidth * 0.5, ggy + gheight * 0.5);

        MainCanvas.get2dContext().fillRect(
          ggx,
          ggy,
          laserConfig.canvasResolution.width / laserConfig.gridResolution,
          laserConfig.canvasResolution.height / laserConfig.gridResolution
        );
      } else {
        // context.strokeStyle = "#ffffff";
      }

      if (laserGrid[gIndex] > 0) {
        myGrid[gIndex].active = true;
        myGrid[gIndex].time = performance.now();
      }
    }
  }
};

export default {
  name: "FadeCPU",
  init: function (data) {
    if (data) {
      if (data.fadeDuration) {
        fadeDuration = data.fadeDuration;
      }
    }
  },
  handle: function (grid) {
    handler(grid);
  },
};
