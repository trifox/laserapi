var laserConfig = require("../LaserApiConfig").default;
var LaserApi = require("../LaserApi").default;
var MainCanvas = require("../MasterCanvas").default;

var lastResolution = -1;
var fadeDuration = 500;
var myGrid = [];

var myImage1 = require("../../img/c64_intro_evoke17_000.png");

var imageObj = new Image();
imageObj.src = myImage1;

export default {
  name: "C64",
  handle: function (grid) {
    console.log(
      "Loaded C64",
      laserConfig.canvasResolution.width,
      laserConfig.canvasResolution.height
    );
    MainCanvas.get2dContext().drawImage(
      imageObj,
      0,
      0,
      laserConfig.canvasResolution.width,
      laserConfig.canvasResolution.height
    );
  },
};
