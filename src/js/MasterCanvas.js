// the main canvas is organized here

var laserConfig = require("./LaserApiConfig.js").default;
var canvas = null;
var context2d = null;
var context3d = null;

var imageObj = new Image();

var myImage = require("../img/C64_startup_animiert.gif");
imageObj.src = myImage;

export default {
  showC64: function () {
    console.log(
      "Loaded C64",
      laserConfig.canvasResolution.width,
      laserConfig.canvasResolution.height
    );
    context2d.drawImage(
      imageObj,
      0,
      0,
      laserConfig.canvasResolution.width,
      laserConfig.canvasResolution.height
    );
  },

  clear: function () {
    context2d.beginPath();
    context2d.rect(
      0,
      0,
      laserConfig.canvasResolution.width,
      laserConfig.canvasResolution.height
    );
    context2d.fillStyle = "black";
    context2d.fill();
  },
  getCanvas: function () {
    return canvas;
  },
  get2dContext: function () {
    return context2d;
  },
  get3dContext: function () {
    return context3d;
  },
  init: function (canvasIn) {
    canvas = canvasIn;
    canvas.width = laserConfig.canvasResolution.width;
    canvas.height = laserConfig.canvasResolution.height;
    console.log("Initialising from canvas DOM element", this);
    console.log("Initialising from canvas DOM element", canvas);
    context2d = canvas.getContext("2d");
    context3d =
      canvas.getContext("webgl") || canvas.getContext("experimental-webgl");
  },
};
