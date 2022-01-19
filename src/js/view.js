import { Solver } from "p2";
import util from "./util.js";
var helper = require("./helper.js");
var laserConfig = require("./LaserApiConfig").default;
var Util = require("./util").default;
var CanvasVideo = require("./CanvasVideo").default;
var LaserApi = require("./LaserApi.js").default;
var LaserApiPresets = require("./LaserApiPresets").default;
var w3 = require("./../css/w3.css").default;
//var game01 = require('./setups/game-001-play-midi').default
//var shader = require('./shader').default
var MainCanvas = require("./MasterCanvas").default;
// var game01 = require('./setups/game-002-moorhuni').default
//var game01 = require('./setups/game-003-pong').default
//var game01 = require('./setups/game-004-paint').default
var gameDebug = require("./setups/game-004-debug").default;
var gameDebugCorners = require("./setups/game-004-debug-corners").default;
var gameDebugTransform = require("./setups/game-004-debug-transform").default;
var GameWrapper = require("./setups/game-wrapper").default;
//var game01 = require('./setups/game-005-switch').default
var games = [
  // new GameWrapper(require("./setups/game-001-play-midi").default),
  // new GameWrapper(require("./setups/game-002-moorhuni").default),
  new GameWrapper(require("./setups/game-003-pong").default),
  // new GameWrapper(require("./setups/game-005-switch").default),
  new GameWrapper(require("./setups/game-006-fade").default),
  // new GameWrapper(require("./setups/game-007-c64-evoke17").default),
  // new GameWrapper(require("./setups/game-007-c64").default),
  new GameWrapper(require("./setups/game-008-mandelbrot").default),
];
console.log("games are", games);
/* make sure to use https as the web audio api does not like http */
MainCanvas.init(document.getElementById("canvas"));
CanvasVideo.init(document.getElementById("video"));

function startGame(index) {
  if (games[index].init) {
    games[index].init();
  }
}
function stopGame(index) {
  if (games[index].stop) {
    f;
    games[index].stop();
  }
}
startGame(0);

var lastGameIndex = -1;
async function scaleImageData(imageData, width, height) {
  const resizeWidth = width >> 0;
  const resizeHeight = height >> 0;
  const ibm = await window.createImageBitmap(
    imageData,
    0,
    0,
    imageData.width,
    imageData.height,
    {
      resizeWidth,
      resizeHeight,
    }
  );
  const canvas = document.createElement("canvas");
  canvas.width = resizeWidth;
  canvas.height = resizeHeight;
  const ctx = canvas.getContext("2d");
  ctx.scale(resizeWidth / imageData.width, resizeHeight / imageData.height);
  ctx.drawImage(ibm, 0, 0);
  return ctx.getImageData(0, 0, resizeWidth, resizeHeight);
}
async function frameHandler() {
  // console.time("frameHandler");
  var ctx = MainCanvas.get2dContext();
  // console.log('Re Rendering');
  // console.log('Re Rendering', MainCanvas.getCanvas());

  animationHandler();

  //var transform = getTransformOfVideoInput()

  MainCanvas.clear();
  // ctx.width = laserConfig.canvasResolution.width;
  // ctx.style.width = laserConfig.canvasResolution.width;
  // ctx.style.height = laserConfig.canvasResolution.height;
  // ctx.save();
  //   skewXY(MainCanvas.get2dContext(), document.getElementById('skewY').value, document.getElementById('skewX').value)
  //skewX(MainCanvas.get2dContext(), document.getElementById('skewX').value)
  //   MainCanvas.get2dContext().translate(transform.translate.x, transform.translate.y)
  //   MainCanvas.get2dContext().translate(transform.translate.x, transform.translate.y)
  //   MainCanvas.get2dContext().rotate((transform.rotate / 180.0) * Math.PI)

  //    MainCanvas.get2dContext().scale(transform.scale, transform.scale)
  //  console.log('Re rotate', transform.rotate);
  ctx.imageSmoothingEnabled = false;

  /**
   * we use painters method and draw on canvas
   * we start with drawing the video frame as initial input
   */
  if (laserConfig.debugVideo) {
    ctx.save();
    // ctx.translate(0, laserConfig.videoResolution.height);
    // ctx.scale(1, -1);
    ctx.drawImage(
      CanvasVideo.getVideo(),
      0,
      0,
      laserConfig.videoResolution.width,
      laserConfig.videoResolution.height
    );
    ctx.restore();
  }
  // console.time("frameHandler");
  /**
   * step 2 is to retrieve the rendered video frame as imageData
   */
  // var canvasColor = ctx.getImageData(
  //   0,
  //   0,
  //   laserConfig.videoResolution.width,
  //   laserConfig.videoResolution.height
  // ); // rgba e [0,255]

  // console.timeEnd("frameHandler");
  // MainCanvas.get2dContext().restore();

  // MainCanvas.get2dContext().fillStyle = "#006666";

  // MainCanvas.get2dContext().strokeStyle = "#0000ff";
  // MainCanvas.get2dContext().strokeRect(
  //   0,
  //   0,
  //   laserConfig.testResolution.width,
  //   laserConfig.testResolution.height
  // );

  // console.time("getInterestRegionGPU");
  /**
   * here we map out the designated area of interest from the input video frame
   * it comes back as imagedata
   */
  // var canvasColorInterest = LaserApi.getInterestReqionGPU(
  //   MainCanvas.get2dContext(),
  //   CanvasVideo.getVideo()
  // );

  // console.timeEnd("getInterestRegionGPU");
  // var canvasColorInterestOld = LaserApi.getInterestReqion(
  //   MainCanvas.get2dContext(),
  //   canvasColor
  // );

  // // console.timeEnd("getInterestRegionCPU");
  // if (!laserConfig.debugVideo) {
  //   MainCanvas.clear();
  // } else {
  //   // MainCanvas.get2dContext().putImageData(
  //   //   canvasColorInterestOld,
  //   //   laserConfig.testResolution.width * 2,
  //   //   0
  //   // );
  // }

  /**
   * draw the debug output scaled for the extracted rect which becomes fed into the
   * game update loop
   */
  //      var newCanvas = $("<canvas>")
  //      .attr("width", laserConfig.testResolution.width)
  //      .attr("height",laserConfig.testResolution.height)[0];

  //  newCanvas.getContext("2d").putImageData(canvasColorInterest, 0, 0);
  //  MainCanvas.get2dContext().drawImage(newCanvas,0,0,laserConfig.canvasResolution.width,laserConfig.canvasResolution.height)

  // MainCanvas.get2dContext().drawImage(canvasColorInterest, 0, 0, 200, 200);
  // }

  // console.timeEnd("frameHandler");
  // console.time("GetRectCPU");
  // var laserGridOld = LaserApi.getRectForInputImage(canvasColorInterest);
  // // console.log("Lasergridold is", laserGridOld);
  // console.timeEnd("GetRectCPU");

  // console.time("GetRectGPU");
  /** step is downsampling the mapped and filtered input video stream image
   * to just an image with 1 channel
   */
  //var laserGrid = LaserApi.getRectForInputImageGPU(canvasColorInterest);
  var laserGrid = LaserApi.getFine(CanvasVideo.getVideo());
  // console.timeEnd("frameHandler");
  // console.log("Lasergrid is", laserGrid);
  // console.timeEnd("GetRectGPU");

  // console.log(laserGrid);
  if (laserConfig.showDebug) {
    gameDebug.handle(laserGrid);
  }

  if (lastGameIndex !== laserConfig.gameIndex) {
    if (games[lastGameIndex] && games[lastGameIndex].stop) {
      games[lastGameIndex].stop(laserGrid);
    }
    lastGameIndex = laserConfig.gameIndex;
  }
  if (laserConfig.showGame) {
    // console.time("GameHandler")
    games[laserConfig.gameIndex || 0].handle(laserGrid);
    // console.timeEnd("GameHandler")
  }

  //setTimeout(frameHandler, 0);

  if (laserConfig.showTransform) {
    gameDebugTransform.handle();
  }
  if (laserConfig.showGrid) {
    gameDebugCorners.handle();
  }
  if (laserConfig.showHelp) {
    showHelp(ctx);
  }
  window.requestAnimationFrame(frameHandler);
  // console.timeEnd("frameHandler");
}

var presets = [];

//setTimeout(frameHandler, 1000);
// document.addEventListener('fullscreenchange', exitHandler, false);

if (document.addEventListener) {
  document.addEventListener("webkitfullscreenchange", exitHandler, false);
}
document.onkeydown = function (evt) {
  if (isNaN(evt.key)) {
    console.log(evt.key);
    switch (evt.key) {
      case "d":
        //   console.log('doing it ',laserConfig.showDebug )
        laserConfig.showDebug = !laserConfig.showDebug;
        document.getElementById("showDebug").checked = laserConfig.showDebug;
        break;
      case "v":
        //   console.log('doing it ',laserConfig.showDebug )
        laserConfig.debugVideo = !laserConfig.debugVideo;
        document.getElementById("debugVideo").checked = laserConfig.debugVideo;
        break;
      case "g":
        console.log("doing it ", laserConfig.showGame);
        laserConfig.showGame = !laserConfig.showGame;
        document.getElementById("showGame").checked = laserConfig.showGame;
        break;

      case "r":
        console.log("showing raster it ", laserConfig.showGrid);
        laserConfig.showGrid = !laserConfig.showGrid;
        document.getElementById("showGrid").checked = laserConfig.showGrid;
        break;
      case "h":
        console.log("showing help ", laserConfig.showHelp);
        laserConfig.showHelp = !laserConfig.showHelp;
        document.getElementById("showHelp").checked = laserConfig.showHelp;
        break;
      case "t":
        console.log("showing transform it ", laserConfig.showTransform);
        laserConfig.showTransform = !laserConfig.showTransform;
        document.getElementById("showTransform").checked =
          laserConfig.showTransform;
        break;
      case "f":
        fullscreen();

        break;
      case "F":
        fullscreenEdit();

        break;
      case "s":
        // make snapshot

        var canvas = document.getElementById("canvas");
        var snapshotCanvasHtml = document.getElementById("snapshotCanvas");
        var video = document.getElementById("video");
        var canvasVideo = document.getElementById("canvasVideo");
        var context2dVideo = canvasVideo.getContext("2d");

        canvasVideo.width = 1920;
        canvasVideo.height = 1080;

        // draw snapshot im,age

        context2dVideo.drawImage(video, 0, 0, 1920, 1080);
        gameDebugTransform.drawQuad(
          canvasVideo.width,
          canvasVideo.height,
          context2dVideo,
          laserConfig.transform
        );

        var snapshotVideoHtml = document.getElementById("snapshotVideo");
        var snapshotImage = canvas.toDataURL("image/png");
        snapshotCanvasHtml.src = snapshotImage;

        var snapshotVideoImage = canvasVideo.toDataURL("image/png");
        snapshotVideoHtml.src = snapshotVideoImage;

        //     console.log('video image is ', snapshotVideoImage)

        break;
    }
  } else {
    document.getElementById("presets-selector").value = evt.key;
    loadPreset(presets[evt.key]);
  }
};
function showHelp(ctx) {
  ctx.fillStyle = "#00000088";
  ctx.fillRect(
    laserConfig.canvasResolution.width * 0.05,
    220,
    laserConfig.canvasResolution.width * 0.9,
    laserConfig.canvasResolution.height * 0.5
  );
  util.renderTextDropShadow({
    ctx,
    text: "Laser-Api",
    fontSize: "150px",
    fillStyle: "green",
    x: laserConfig.canvasResolution.width / 2,
    y: 200,
  });

  util.renderTextOutline({
    ctx,
    text: `
This HELP text is displayed,because you pressed the 'h' key, press it again to hide.

Shortcut Keys:
      'h' - show/hide this help  
      'f' - Fullscreen Mode, always work in fullscreen mode, exit using ESC key
SHIFT+'f' - Fullscreen Edit Mode, showing the transform edit controls
      'd' - show/hide debug scanline grid, whis is the input for laserApi applications (Debug) (current:${laserConfig.showDebug})
      'g' - show/hide current game rendering (Game)                                            (current:${laserConfig.showGame})
      'r' - show/hide aligning raster when setting up rectangle of interest (Raster)           (current:${laserConfig.showGrid})
      't' - show/hide the rectangle of interest (Transform)                                    (current:${laserConfig.showTransform})
      'v' - show/hide video input stream                                                       (current:${laserConfig.debugVideo})

Setting Up:
1. Setting up
    a. Select Rectangle of interest - Display the Video (v) and display the Transform (t), hide all other (r,g,d). 
      Use the input form (SHFT-F)to place the corners of the rectangle to the projection, either monitor or projector.
    b. Fine Tune Perspective - The Perspective is corrected using the handles on each corner,
      one for horizontal and one for vertical called slopeX and slopeY. Use the Raster (r) and Debug (d) to match.
    c. Setup Laser Color - provide a color matching the video stream color of the laserpointer color to look for.
2. Select Game and Play
    a. Use input form (SHIFT-F) to select a game in the game dropdown.
    b. Display the game (g), hide all other views (d,v,r,t).
                                                                                                             Have Fun!
Copyright 2022 C.Kleinhuis 
Copyright 2022 Frontend Solutions GmbH
Copyright 2022 I-Love-Chaos`,
    fontSize: "26px",
    font: "Courier",
    lineHeight: 30,
    align: "left",
    fillStyle: "#ffffff",
    x: 50,
    y: 250,
    dropDistX: 4,
    dropDistY: 4,
  });
}
function exitHandler(data) {
  console.log("exitHandler", data);
  if (
    document.webkitIsFullScreen ||
    document.mozFullScreen ||
    document.msFullscreenElement !== null
  ) {
  } else {
    /* Run code on exit */
    console.log(
      "RESETTING RESOLUTION TO DEFAULT",
      laserConfig.canvasResolution
    );
    laserConfig.canvasResolution.width = 1920;
    laserConfig.canvasResolution.height = 1080;
    games[laserConfig.gameIndex].init();
  }
}
function fullscreen() {
  console.log("fullscreen clicked");
  var elem = document.getElementById("canvas");
  var canvascontainer = document.getElementById("canvascontainer");
  var editor = document.getElementById("editor");
  console.log("element is ", elem);
  editor.style.display = "none";

  console.log("element is ", elem.getBoundingClientRect());

  // laserConfig.canvasResolution.width =
  //   screen.width * document.getElementById("playfieldScale").value;
  // laserConfig.canvasResolution.height =
  //   screen.height * document.getElementById("playfieldScale").value;
  canvas.style.left = (screen.width - laserConfig.canvasResolution.width) / 2;
  canvas.style.top = (screen.height - laserConfig.canvasResolution.height) / 2;
  canvas.style.width = laserConfig.canvasResolution.width;
  canvas.style.height = laserConfig.canvasResolution.height;
  console.log("resolution is clicked", laserConfig.canvasResolution);
  if (canvascontainer.webkitRequestFullscreen) {
    canvascontainer.webkitRequestFullscreen();
  }

  games[laserConfig.gameIndex || 0].init();
}
function fullscreenEdit() {
  console.log("fullscreenedit clicked");
  var elem = document.body;
  var editor = document.getElementById("editor");
  var canvascontainer = document.getElementById("canvascontainer");
  console.log("element is ", elem);
  editor.style.display = "block";

  var canvas = document.getElementById("canvas");
  console.log("element is ", elem);
  console.log("element is ", canvascontainer);
  console.log("element is ", elem.getBoundingClientRect());

  // laserConfig.canvasResolution.width = 640
  // laserConfig.canvasResolution.height = 480
  console.log("-----");
  console.log("Screen Width and height is ", screen.width);
  console.log("Screen Width and height is ", screen.height);
  console.log("-----");

  // laserConfig.canvasResolution.width =
  //   screen.width * document.getElementById("playfieldScale").value;
  // laserConfig.canvasResolution.height =
  //   screen.height * document.getElementById("playfieldScale").value;
  canvas.style.width = laserConfig.canvasResolution.width;
  canvas.style.height = laserConfig.canvasResolution.height;
  canvas.style.left = (screen.width - laserConfig.canvasResolution.width) / 2;
  canvas.style.top = (screen.height - laserConfig.canvasResolution.height) / 2;
  console.log("resolution is clicked", laserConfig.canvasResolution);
  if (canvascontainer.webkitRequestFullscreen) {
    canvascontainer.webkitRequestFullscreen();
  }

  games[laserConfig.gameIndex || 0].init();
}
function initHTML() {
  document.getElementById("fullscreen_button").onclick = fullscreen;
  document.getElementById("fullscreenedit_button").onclick = fullscreenEdit;
  document.getElementById("save-preset-button").onclick = function () {
    console.log("saving preset");

    presets = JSON.parse(window.localStorage.getItem("laserPresets"));
    if (presets === null) {
      presets = {
        presets: [],
      };
    }

    presets.presets.push({
      name: document.getElementById("preset-name").value,
      config: laserConfig,
    });

    window.localStorage.setItem("laserPresets", JSON.stringify(presets));
  };

  for (var i = 0; i < games.length; i++) {
    var option = document.createElement("option");
    option.text = "Game #" + i + " - " + games[i].getName();
    option.value = i;
    if (i === laserConfig.gameIndex) {
      option.selected = true;
    }
    console.log("game found: ", option.text);
    document.getElementById("game-selector").add(option);
  }

  document.getElementById("game-selector").onchange = function (evt) {
    laserConfig.gameIndex = evt.target.value;
  };

  document.getElementById("presets-selector").onchange = function (evt) {
    document.getElementById("preset-name").value =
      presets[evt.target.value].name;
    console.log(
      "selector changed",
      evt.target.value,
      presets[evt.target.value]
    );
    var preset = presets[evt.target.value];
    var config = preset.config;
    delete config.transform;
    delete config.videoTransform;
    loadHtmlFromSettings(presets[evt.target.value].config);
    games[laserConfig.gameIndex || 0].init(preset.initData);
  };
}

function loadPreset(preset) {
  if (preset === undefined) {
    return;
  }
  if (preset === null) {
    return;
  }
  var config = preset.config;
  delete config.transform;
  delete config.videoTransform;
  loadHtmlFromSettings(config);
  games[laserConfig.gameIndex || 0].init(preset.initData);
}

function loadPresetsFromLocalStorage() {
  var data = JSON.parse(window.localStorage.getItem("laserPresets"));

  presets = LaserApiPresets;
  if (data) {
    //    presets = presets.join(data.presets)
  }

  console.log("presets data is ", data);
}
function loadFromLocalStorage() {
  loadPresetsFromLocalStorage();
  var data = JSON.parse(window.localStorage.getItem("laser"));
  if (data !== null) {
    console.log("last data is ", data);

    loadHtmlFromSettings(data.laserConfig);
  }
}

function loadHtmlFromSettings(settings) {
  console.log("loading settings", settings);
  if (settings.treshold !== undefined) {
    document.getElementById("threshold").value = settings.treshold;
    laserConfig.threshold = settings.treshold;
  }
  if (settings.testColor !== undefined) {
    document.getElementById("lasercolor").value = Util.rgbToHex(
      settings.testColor[0],
      settings.testColor[1],
      settings.testColor[2]
    );

    laserConfig.testColor = settings.testColor;
  }
  if (settings.debugVideo !== undefined) {
    document.getElementById("debugVideo").value = settings.debugVideo;
    laserConfig.debugVideo = settings.debugVideo;
  }
  if (settings.playfieldScale !== undefined) {
    document.getElementById("playfieldScale").value = settings.playfieldScale;
    laserConfig.debugVideo = settings.playfieldScale;
  }
  if (settings.showGame !== undefined) {
    document.getElementById("showGame").checked = settings.showGame;
    laserConfig.showGame = settings.showGame;
  }
  if (settings.threshold !== undefined) {
    document.getElementById("threshold").value = settings.threshold;
    laserConfig.threshold = settings.threshold;
  }
  if (settings.showGrid !== undefined) {
    document.getElementById("showGrid").checked = settings.showGrid;
    laserConfig.showGrid = settings.showGrid;
  }
  if (settings.showTransform !== undefined) {
    document.getElementById("showTransform").checked = settings.showTransform;
    laserConfig.showTransform = settings.showTransform;
  }
  if (settings.gameIndex !== undefined) {
    console.log("loading settings gameIndex", settings);
    laserConfig.gameIndex = settings.gameIndex;
    document.getElementById("game-selector").value = settings.gameIndex;
  }
  if (settings.showDebug !== undefined) {
    document.getElementById("showDebug").checked = settings.showDebug;
    laserConfig.showDebug = settings.showDebug;
  }
  if (settings.showHelp !== undefined) {
    document.getElementById("showHelp").checked = settings.showHelp;
    laserConfig.showHelp = settings.showHelp;
  }
  if (settings.debugVideo !== undefined) {
    document.getElementById("debugVideo").checked = settings.debugVideo;
    laserConfig.debugVideo = settings.debugVideo;
  }
  if (settings.gridResolution !== undefined) {
    document.getElementById("gridResolution").value = settings.gridResolution;
    laserConfig.gridResolution = settings.gridResolution;
  }
  /*
     if (settings.videoTransform !== undefined) {
     if (settings.videoTransform.skew !== undefined) {

     document.getElementById('skewX').value = settings.videoTransform.skew.x
     laserConfig.videoTransform.skew.x = settings.videoTransform.skew.x

     }
     }
     if (settings.videoTransform !== undefined && settings.videoTransform.skew !== undefined) {

     document.getElementById('skewY').value = settings.videoTransform.skew.y
     laserConfig.videoTransform.skew.y = settings.videoTransform.skew.y

     }

     if (settings.videoTransform !== undefined) {

     document.getElementById('rotateVideo').value = settings.videoTransform.rotate
     document.getElementById('scaleVideo').value = settings.videoTransform.scale
     document.getElementById('translateVideoX').value = settings.videoTransform.translate.x
     document.getElementById('translateVideoY').value = settings.videoTransform.translate.y
     laserConfig.videoTransform.rotateVideo = settings.videoTransform.rotateVideo
     laserConfig.videoTransform.translateVideoX = settings.videoTransform.translateVideoX
     laserConfig.videoTransform.scaleVideo = settings.videoTransform.scaleVideo
     laserConfig.videoTransform.translateVideoY = settings.videoTransform.translateVideoY

     setVideoTransform(settings.videoTransform)
     }
     */
  if (settings.transform !== undefined) {
    setCoordinates(settings.transform);
  }
}
var lastStore;
function saveToLocalStorage() {
  var data = JSON.stringify({
    laserConfig: laserConfig,
  });
  if (lastStore != data) {
    console.log("Saving to localstorage", data);
    lastStore = data;
    window.localStorage.setItem("laser", data);
  }
}

function getCoordinatesForInputElement(elemprefix) {
  var elem1x = document.getElementById(elemprefix + "_x");
  var elem1y = document.getElementById(elemprefix + "_y");
  var elem1yslope = document.getElementById("slope" + elemprefix + "_y");
  var elem1xslope = document.getElementById("slope" + elemprefix + "_x");
  return {
    x: elem1x.value / 10000.0,
    y: elem1y.value / 10000.0,
    slopex: ((elem1xslope && Number(elem1xslope.value)) || 10000) / 5000,
    slopey: ((elem1yslope && Number(elem1yslope.value)) || 10000) / 5000,
  };
}

function setCoordinatesForInputElement(elemprefix, data) {
  var elem1x = document.getElementById(elemprefix + "_x");
  var elem1y = document.getElementById(elemprefix + "_y");
  var elem1xslope = document.getElementById("slope" + elemprefix + "_x");
  var elem1yslope = document.getElementById("slope" + elemprefix + "_y");
  elem1x.value = data.x * 10000.0;
  elem1y.value = data.y * 10000.0;
  if (elem1xslope) elem1xslope.value = (data.slopex || 1) * 5000;
  if (elem1yslope) elem1yslope.value = (data.slopey || 1) * 5000;
}
function getCoordinates() {
  var result = {
    topleft: getCoordinatesForInputElement("topleft"),
    topright: getCoordinatesForInputElement("topright"),
    bottomleft: getCoordinatesForInputElement("bottomleft"),
    bottomright: getCoordinatesForInputElement("bottomright"),
  };
  // console.log("coordinates are", result);
  return result;
}
function getTransformOfVideoInput() {
  return {
    rotate: document.getElementById("rotateVideo").value,
    skew: {
      x: document.getElementById("skewX").value,
      y: document.getElementById("skewY").value,
    },
    scale: document.getElementById("scaleVideo").value,
    translate: {
      x: document.getElementById("translateVideoX").value,
      y: document.getElementById("translateVideoY").value,
    },
  };
}
function setCoordinates(data) {
  setCoordinatesForInputElement("topleft", data.topleft);
  setCoordinatesForInputElement("topright", data.topright);
  setCoordinatesForInputElement("bottomleft", data.bottomleft);
  setCoordinatesForInputElement("bottomright", data.bottomright);
}

function updateKnobs(rect) {
  return;
  var knob1 = document.getElementById("knob1");
  var knob2 = document.getElementById("knob2");
  var knob3 = document.getElementById("knob3");
  var knob4 = document.getElementById("knob4");
  var container = document.getElementById("video").getBoundingClientRect();
  knob1.style.top = rect.topleft.y * container.height;
  knob1.style.left = rect.topleft.x * container.width;
  knob2.style.top = rect.topright.y * container.height;
  knob2.style.left = rect.topright.x * container.width;
  knob3.style.top = rect.bottomleft.y * container.height;
  knob3.style.left = rect.bottomleft.x * container.width;
  knob4.style.top = rect.bottomright.y * container.height;
  knob4.style.left = rect.bottomright.x * container.width;

  //   console.log(rect, knob1.style.top, knob1.style.left, container.width, container.height)
}

function setVideoTransform(transform) {
  return;
  var video = document.getElementById("video");

  var trans = "";
  //
  trans =
    "translate(" +
    transform.translate.x +
    "px," +
    transform.translate.y +
    "px) ";
  trans += "scale(" + transform.scale + ") ";
  trans += "rotate(" + transform.rotate + "deg) ";
  video.style.transform = trans;

  //  console.log('set tranform to ', trans)
  //   console.log('set tranform to ', video.style.transform)
}

function animationHandler() {
  laserConfig.threshold = Number(document.getElementById("threshold").value);
  laserConfig.gridResolution = Number(
    document.getElementById("gridResolution").value
  );
  laserConfig.debugVideo = document.getElementById("debugVideo").checked;
  laserConfig.showDebug = document.getElementById("showDebug").checked;
  laserConfig.showHelp = document.getElementById("showHelp").checked;
  laserConfig.showGame = document.getElementById("showGame").checked;
  laserConfig.showGrid = document.getElementById("showGrid").checked;
  laserConfig.showTransform = document.getElementById("showTransform").checked;
  laserConfig.gameIndex = Number(
    document.getElementById("game-selector").value
  );
  laserConfig.playfieldScale = Number(
    document.getElementById("playfieldScale").value
  );
  //  laserConfig.videoTransform = getTransformOfVideoInput()

  laserConfig.testColor[0] = Util.hexToRgb(
    document.getElementById("lasercolor").value
  ).r;
  laserConfig.testColor[1] = Util.hexToRgb(
    document.getElementById("lasercolor").value
  ).g;
  laserConfig.testColor[2] = Util.hexToRgb(
    document.getElementById("lasercolor").value
  ).b;
  laserConfig.transform = getCoordinates();
  // console.log('config is ', laserConfig)
  //     shader.start()
  //  updateKnobs(laserConfig.transform)
  // setVideoTransform(getTransformOfVideoInput());
  saveToLocalStorage();
}

function updatePresetSelector() {
  document.getElementById("presets-selector").innerHTML = "";

  var option = document.createElement("option");
  option.text = "Select Preset";
  option.disabled = true;
  option.selected = true;

  console.log("game found: ", option.text);
  document.getElementById("presets-selector").add(option);
  for (var i = 0; i < presets.length; i++) {
    var option = document.createElement("option");
    option.text = "Preset #" + i + " - " + presets[i].name;
    option.value = i;

    console.log("game preset found: ", option.text);
    document.getElementById("presets-selector").add(option);
  }
}
document.addEventListener("DOMContentLoaded", function (event) {
  initHTML();
  loadFromLocalStorage();
  updatePresetSelector();
  fullscreen();
  fullscreenEdit();

  window.requestAnimationFrame(frameHandler);
});

export default {};
