/**
 *
 * warning:
 *
 * YES I KNOW THIS CAN NOT USED WITH STATIC REFERENCES< IT WILL CONTINUE PROVIDING BETTER API INSTANCING FUNCTIONALITY IN FUTURE
 *
 */
var hermite = require("cubic-hermite");
var helper = require("./helper.js");
var GPU = require("gpu.js").GPU;

const gpu = new GPU();
gpu.addFunction(function cubicHermite(p0, v0, p1, v1, t) {
  var ti = t - 1,
    t2 = t * t,
    ti2 = ti * ti,
    h00 = (1 + 2 * t) * ti2,
    h10 = t * ti2,
    h01 = t2 * (3 - 2 * t),
    h11 = t2 * ti;
  //   if(p0.length) {
  //     if(!f) {
  //       f = new Array(p0.length)
  //     }
  //     for(var i=p0.length-1; i>=0; --i) {
  //       f[i] = h00*p0[i] + h10*v0[i] + h01*p1[i] + h11*v1[i]
  //     }
  //     return f
  //   }
  return h00 * p0 + h10 * v0 + h01 * p1 + h11 * v1;
});
gpu.addFunction(
  function getColorDistance(col1, col2) {
    var diff = [col1[0] - col2[0], col1[1] - col2[1], col1[2] - col2[2]];
    var result = Math.sqrt(
      diff[0] * diff[0] + diff[1] * diff[1] + diff[2] * diff[2]
    );

    // console.log('diff is .', col1, col2, result);

    return result;
  },
  { argumentTypes: { col1: "Array(3)", col2: "Array(3)" } }
);

gpu.addFunction(function lerpSin(v0, v1, t) {
  return lerp(v0, v1, 1 - (Math.cos(t * Math.PI) * 0.5 + 0.5));
});
gpu.addFunction(
  function lerp(v0, v1, t) {
    return (1 - t) * v0 + t * v1;
  },
  {
    argumentTypes: { v0: "Number", v1: "Number", t: "Number" },
    returnType: "Number",
  }
);
gpu.addFunction(
  function lerp2d(v0, v1, t) {
    return [lerp(v0[0], v1[0], t), lerp(v0[1], v1[1], t)];
  },
  function lerp2dHermite(v0, v0s, v1, v1s, t) {
    return [
      lerp(v0[0], v1[0], hermite(0, v0s, 1, v1s)),
      lerp(v0[1], v1[1], hermite(0, v0s, 1, v1s)),
    ];
  },
  {
    argumentTypes: { v0: "Array(2)", v1: "Array(2)", t: "Number" },
    returnType: "Array(2)",
  }
);
gpu.addFunction(
  function transformCoordinate(
    coord,
    mapTopLeft,
    mapTopRight,
    mapBottomLeft,
    mapBottomRight
  ) {
    // find p[ositions on x axises top and bottom
    // mapping is 2d array in order topleft,topright, bottomleft,bottomright
    // var tx1 = lerp2d(mapTopLeft, mapTopRight, coord[0]);
    // var tx2 = lerp2d(mapBottomLeft, mapBottomRight, coord[0]);
    // var result = lerp2d(tx1, tx2, coord[1]);

    var hermite1TopLeftRight = cubicHermite(
      0,
      mapTopLeft[2],
      1,
      mapTopRight[2],
      coord[0]
    );
    var hermite2BottomLeftRight = cubicHermite(
      0,
      mapBottomLeft[2],
      1,
      mapBottomRight[2],
      coord[0]
    );
    var hermite3 = cubicHermite(
      0,
      mapTopLeft[3],
      1,
      mapBottomLeft[3],
      coord[1]
    );
    var hermite4 = cubicHermite(
      0,
      mapTopRight[3],
      1,
      mapBottomRight[3],
      coord[1]
    );
    var tx1 = lerp2d(
      [mapTopLeft[0], mapTopLeft[1]],
      [mapTopRight[0], mapTopRight[1]],
      hermite1TopLeftRight
    );
    var tx2 = lerp2d(
      [mapBottomLeft[0], mapBottomLeft[1]],
      [mapBottomRight[0], mapBottomRight[1]],
      hermite2BottomLeftRight
    );
    var result = lerp2d(
      tx1,
      tx2,
      lerp(
        hermite3,
        hermite4,
        lerp(hermite1TopLeftRight, hermite2BottomLeftRight, coord[1])
      )
    );
    // console.log('INput ', coord, 'output', result)
    return result;
  },
  {
    argumentTypes: {
      coord: "Array(2)",
      mapTopLeft: "Array(4)",
      mapTopRight: "Array(4)",
      mapBottomLeft: "Array(4)",
      mapBottomRight: "Array(4)",
    },
    returnType: "Array(2)",
  }
);

var laserConfig = require("./LaserApiConfig.js").default;

/* make sure to use https as the web audio api does not like http */
//
// if (location.protocol === 'http:' && location.hostname !== 'localhost' && location.hostname !== '0.0.0.0') {
//     location.href = 'https:' + window.location.href.substrixng(window.location.protocol.length);
// }

function lerp(v0, v1, t) {
  return (1 - t) * v0 + t * v1;
}

function lerp2d(v0, v1, t) {
  return {
    x: lerp(v0.x, v1.x, t),
    y: lerp(v0.y, v1.y, t),
  };
}
function lerp3d(v0, v1, t) {
  return {
    x: lerp(v0.x, v1.x, t),
    y: lerp(v0.y, v1.y, t),
    z: lerp(v0.z, v1.z, t),
  };
}

// normalized coord in, normalized coord out
function transformCoordinate(coord, mapping) {
  // find p[ositions on x axises top and bottom
  var tx1 = lerp2d(mapping.topleft, mapping.topright, coord.x);
  var tx2 = lerp2d(mapping.bottomleft, mapping.bottomright, coord.x);
  var result = lerp2d(tx1, tx2, coord.y);
  // console.log('INput ', coord, 'output', result)
  return result;
}

function getCoordinates() {
  return laserConfig.transform;
}
function setCoordinates(data) {
  laserConfig.transform = data;
}

function updateKnobs(rect) {
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

function getColorDistance(col1, col2) {
  var diff = [];
  diff[0] = col1[0] - col2[0];
  diff[1] = col1[1] - col2[1];
  diff[2] = col1[2] - col2[2];
  var result = Math.sqrt(
    diff[0] * diff[0] + diff[1] * diff[1] + diff[2] * diff[2]
  );

  // console.log('diff is .', col1, col2, result);

  return result;
}
var lastDate = performance.now();

var compiledKernelExtractInterestRegion;
var compiledKernelExtractGrid;

var LaserApi = {
  lerp: lerp,
  lerp2d: lerp2d,
  lerp3d: lerp3d,

  gRect: new Array(laserConfig.gridResolution * laserConfig.gridResolution),
  globalImageData: null,
  video: null,
  canvas: null,
  getInterestReqionGPU(context, canvasColorOriginal) {
    if (!compiledKernelExtractInterestRegion) {
      compiledKernelExtractInterestRegion = gpu
        .createKernel(function (
          imageData,
          resX,
          resY,
          inputResX,
          inputResY,
          mapping,
          referenceColor,
          treshold
        ) {
          var x = this.thread.x;
          var y = resY - this.thread.y;

          var transformedCoord = transformCoordinate(
            [x / resX, y / resY],
            [mapping[0][0], mapping[0][1], mapping[0][2], mapping[0][3]],
            [mapping[1][0], mapping[1][1], mapping[1][2], mapping[1][3]],
            [mapping[2][0], mapping[2][1], mapping[2][2], mapping[2][3]],
            [mapping[3][0], mapping[3][1], mapping[3][2], mapping[3][3]]
          );
          var x2 = Math.floor(transformedCoord[0] * inputResX);
          var y2 = Math.floor(transformedCoord[1] * inputResY);
          var index = (x2 + y2 * inputResX) * 4;
          var colorDistance = getColorDistance(
            [imageData[index], imageData[index + 2], imageData[index + 3]],
            [referenceColor[0], referenceColor[1], referenceColor[2]]
          );
          if (colorDistance < treshold) {
            this.color(
              referenceColor[0] / 255,
              referenceColor[1] / 255,
              referenceColor[2] / 255,
              0
            );
          } else {
            this.color(0, 0, 0, 0);
          }
          // this.color(
          //   imageData[index] / 255,
          //   imageData[index + 1] / 255,
          //   imageData[index + 2] / 255,
          //   1
          // );
        })
        .setOutput([
          laserConfig.testResolution.width,
          laserConfig.testResolution.height,
        ])
        .setGraphical(true);
    }
    compiledKernelExtractInterestRegion(
      canvasColorOriginal.data,
      laserConfig.testResolution.width,
      laserConfig.testResolution.height,
      laserConfig.videoResolution.width,
      laserConfig.videoResolution.height,
      [
        [
          laserConfig.transform.topleft.x,
          laserConfig.transform.topleft.y,
          Number(laserConfig.transform.topleft.slopex),
          Number(laserConfig.transform.topleft.slopey),
        ],
        [
          laserConfig.transform.topright.x,
          laserConfig.transform.topright.y,
          Number(laserConfig.transform.topright.slopex),
          Number(laserConfig.transform.topright.slopey),
        ],
        [
          laserConfig.transform.bottomleft.x,
          laserConfig.transform.bottomleft.y,
          Number(laserConfig.transform.bottomleft.slopex),
          Number(laserConfig.transform.bottomleft.slopey),
        ],
        [
          laserConfig.transform.bottomright.x,
          laserConfig.transform.bottomright.y,
          Number(laserConfig.transform.bottomright.slopex),
          Number(laserConfig.transform.bottomright.slopey),
        ],
      ],
      [
        laserConfig.testColor[0],
        laserConfig.testColor[1],
        laserConfig.testColor[2],
      ],
      Number(laserConfig.threshold)
    );

    // create imageData object

    var resultImage = context.createImageData(
      laserConfig.testResolution.width,
      laserConfig.testResolution.height
    );
    // set our buffer as source
    resultImage.data.set(compiledKernelExtractInterestRegion.getPixels());

    // render.destroy();

    return resultImage;
  },
  getInterestReqion: function (context, canvasColorOriginal) {
    /**
     * this method performs the extraction of the chosen area of interest and returns a rectangular result of the distances
     * to the selected marker color
     */

    var resultImage = context.createImageData(
      laserConfig.testResolution.width,
      laserConfig.testResolution.height
    );

    //  resultImage.drawImage(video, 0, 0, canvas.width, canvas.height);

    for (var x = 0; x < laserConfig.testResolution.width; x++) {
      for (var y = 0; y < laserConfig.testResolution.height; y++) {
        var indexnormal = (y * laserConfig.testResolution.width + x) * 4; // index to the result image pixel

        // get coordinate in original image mapped through the rectangle of user input
        var coordTransformed = transformCoordinate(
          {
            x: x / laserConfig.testResolution.width,
            y: y / laserConfig.testResolution.height,
          },
          laserConfig.transform
        );

        coordTransformed.x *= laserConfig.testResolution.width;
        coordTransformed.y *= laserConfig.testResolution.height;
        //   console.log('coord', coordTransformed)
        var indexInput =
          (Math.floor(coordTransformed.y) * laserConfig.testResolution.width +
            Math.floor(coordTransformed.x)) *
          4;

        if (
          getColorDistance(laserConfig.testColor, [
            canvasColorOriginal.data[indexInput],
            canvasColorOriginal.data[indexInput + 1],
            canvasColorOriginal.data[indexInput + 2],
          ]) < laserConfig.threshold
        ) {
          resultImage.data[indexnormal] = canvasColorOriginal.data[indexInput];
          resultImage.data[indexnormal + 1] =
            canvasColorOriginal.data[indexInput + 1];
          resultImage.data[indexnormal + 2] =
            canvasColorOriginal.data[indexInput + 2];
          resultImage.data[indexnormal + 3] =
            canvasColorOriginal.data[indexInput + 3];
        } else {
          resultImage.data[indexnormal] = 0;
          resultImage.data[indexnormal + 1] = 0;
          resultImage.data[indexnormal + 2] = 0;
          resultImage.data[indexnormal + 3] = 255;
        }
      }
    }
    return resultImage;
  },
  getRectForInputImageGPU: function (canvasColorOriginal) {
    /**
     * this method downscales the rgb input 2d array into
     * a 2d array of just floats
     */
    if (!compiledKernelExtractGrid) {
      compiledKernelExtractGrid = gpu
        .createKernel(function (imageData, resX, resY, inputResX, inputResY) {
          var currentX = this.thread.x % resX;
          var currentY = Math.floor(this.thread.x / resY);
          var accumulator = 0;
          var factX = inputResX / resX;
          var factY = inputResY / resY;
          var sourceIndex =
            Math.floor(
              inputResX * Math.floor(currentY * factY) +
                Math.floor(currentX * factX)
            ) * 4;
          for (var i = 0; i <= Math.floor(factX); i++) {
            for (var j = 0; j <= Math.floor(factY); j++) {
              if (imageData[sourceIndex + 4 * (i + j * inputResX)] > 0) {
                accumulator++;
              }
            }
          }
          return accumulator;
          //   if (canvasColorOriginal) {
          //   }
        })
        .setOutput([laserConfig.gridResolution * laserConfig.gridResolution]);
    }
    return compiledKernelExtractGrid(
      canvasColorOriginal,
      Number(laserConfig.gridResolution),
      Number(laserConfig.gridResolution),
      Number(laserConfig.testResolution.width),
      Number(laserConfig.testResolution.height)
    );
  },
  getRectForInputImage: function (canvasColorOriginal) {
    //     console.log('input image is ', canvasColorOriginal)
    var gwidth = canvasColorOriginal.width / laserConfig.gridResolution;
    var gheight = canvasColorOriginal.height / laserConfig.gridResolution;

    for (var gy = 0; gy < laserConfig.gridResolution; gy++) {
      for (var gx = 0; gx < laserConfig.gridResolution; gx++) {
        var gIndex = gy * laserConfig.gridResolution + gx;
        LaserApi.gRect[gIndex] = 0;
      }
    }

    // lol, room for improvement to make it stop as soon as an adequate pixel has been found in subsection search should continue directly in next section
    for (var x = 0; x < laserConfig.testResolution.width; x++) {
      for (var y = 0; y < laserConfig.testResolution.height; y++) {
        /*var transformed = transformCoordinate({
                     x: x / LaserApi.canvas.width,
                     y: y / LaserApi.canvas.height
                     }, transform);

                     transformed.x *= LaserApi.canvas.width;
                     transformed.y *= LaserApi.canvas.height;

                     transformed.x = Math.round(transformed.x)
                     transformed.y = Math.round(transformed.y)

                     */

        var transformed = {
          x: x,
          y: y,
        };

        if (x === 0 && y === 0) {
          //          console.log("transformed is ", transformed)
        }
        var index =
          (transformed.y * laserConfig.testResolution.width + transformed.x) *
          4;
        var indexnormal = (y * laserConfig.testResolution.width + x) * 4;
        var gx = Math.floor(x / gwidth);
        var gy = Math.floor(y / gheight);
        var gIndex = gy * laserConfig.gridResolution + gx;
        if (LaserApi.gRect[gIndex] > 0) {
          //     break;
        }
        //canvasColor.data[index + 1] = 0;
        //canvasColor.data[index + 2] = 0;
        //                    if (canvasColor.data[index] > (canvasColor.data[index + 1] + canvasColor.data[index + 2])) {
        var diff = [];
        var current = [];
        current[0] = canvasColorOriginal.data[index];
        current[1] = canvasColorOriginal.data[index + 1];
        current[2] = canvasColorOriginal.data[index + 2];

        if (
          getColorDistance(laserConfig.testColor, [
            canvasColorOriginal.data[index],
            canvasColorOriginal.data[index + 1],
            canvasColorOriginal.data[index + 2],
          ]) < laserConfig.threshold
        ) {
          /*  coordinates.push({
                         x: x,
                         x: x,
                         y: y,
                         r: canvasColor.data[index],
                         g: canvasColor.data[index + 1],
                         b: canvasColor.data[index + 2]
                         });
                         */
          // LaserApi.globalImageData.data[indexnormal] = 0;
          // LaserApi.globalImageData.data[indexnormal + 1] = 0;
          // LaserApi.globalImageData.data[indexnormal + 2] = 255;

          LaserApi.gRect[gIndex] = LaserApi.gRect[gIndex] + 1;
        } else {
          // LaserApi.globalImageData.data[indexnormal] *= 0.9;
          // LaserApi.globalImageData.data[indexnormal + 1] *= 0.9;
          // LaserApi.globalImageData.data[indexnormal + 2] *= 0.9;
          //LaserApi .gRect[gIndex] = 0;
        }
      }
    }
    return LaserApi.gRect;
  },

  init: function (video, canvas) {
    LaserApi.video = video;
    LaserApi.canvas = canvas;
    LaserApi.context = canvas.getContext("2d");
    console.log("LaserApi Init() called", video, canvas);

    // ask for mic permission
    navigator.getUserMedia(
      {
        video: {
          width: laserConfig.videoResolution.width,
          height: laserConfig.videoResolution.height,
        },
      },
      function (stream) {
        console.log("Stream received", stream);
        video.srcObject = stream;
        video.onloadedmetadata = function (e) {
          console.log("Metadata received", this);
          console.log("Metadata received", e);
          // Do something with the video here.
          video.play();
          LaserApi.canvas.width = Math.floor(video.videoWidth);
          LaserApi.canvas.height = Math.floor(video.videoHeight);
          LaserApi.canvas.style.width = LaserApi.canvas.width;
          LaserApi.canvas.style.height = LaserApi.canvas.height;

          LaserApi.updateCanvasRegular();
        };
      },
      function () {}
    );
  },
  // main loop, calls the render method each 30ms + calculates the current average volume + activates the alarm
  updateCanvasRegular: function () {
    var currentDate = performance.now();
    //     console.log('checking ', lastDate, currentDate);
    if (currentDate - lastDate < laserConfig.tickIntervalMilliseconds) {
      window.requestAnimationFrame(LaserApi.updateCanvasRegular);
      return;
    }
    //    console.log('returning ', lastDate, currentDate);
    lastDate = currentDate;

    LaserApi.updateCanvas();
    window.requestAnimationFrame(LaserApi.updateCanvasRegular);
    /*  setTimeout(function () {


             updateCanvas()
             updateCanvasRegular()

             }, 300)*/
  },

  // render canvas
  updateCanvas: function (options) {
    //    console.log('UpdateCanvas in api ///');
    var transform = getCoordinates();

    if (LaserApi.globalImageData === null) {
      LaserApi.globalImageData = LaserApi.context.createImageData(
        LaserApi.canvas.width,
        LaserApi.canvas.height
      );
      for (var i = 0; i < LaserApi.globalImageData.data.length; i += 4) {
        LaserApi.globalImageData.data[i + 0] = 0;
        LaserApi.globalImageData.data[i + 1] = 0;
        LaserApi.globalImageData.data[i + 2] = 0;
        LaserApi.globalImageData.data[i + 3] = 255;
      }
    }
    if (LaserApi.canvas.width > 0) {
      // context.clearRect(0, 0, canvas.width, canvas.height)
      LaserApi.context.drawImage(video, 0, 0, canvas.width, canvas.height);

      var canvasColorOriginal = LaserApi.context.getImageData(
        0,
        0,
        LaserApi.canvas.width,
        LaserApi.canvas.height
      ); // rgba e [0,255]
      var canvasColor = LaserApi.context.getImageData(
        0,
        0,
        LaserApi.canvas.width,
        LaserApi.canvas.height
      ); // rgba e [0,255]
      var pixels = canvasColor.data;

      var gwidth = LaserApi.canvas.width / laserConfig.gridResolution;
      var gheight = LaserApi.canvas.height / laserConfig.gridResolution;

      for (var gy = 0; gy < laserConfig.gridResolution; gy++) {
        for (var gx = 0; gx < laserConfig.gridResolution; gx++) {
          var gIndex = gy * laserConfig.gridResolution + gx;
          LaserApi.gRect[gIndex] = 0;
        }
      }

      // lol, room for improvement to make it stop as soon as an adequate pixel has been found in subsection search should continue directly in next section
      for (var x = 0; x < LaserApi.canvas.width; x++) {
        for (var y = 0; y < LaserApi.canvas.height; y++) {
          /*var transformed = transformCoordinate({
                         x: x / LaserApi.canvas.width,
                         y: y / LaserApi.canvas.height
                         }, transform);

                         transformed.x *= LaserApi.canvas.width;
                         transformed.y *= LaserApi.canvas.height;

                         transformed.x = Math.round(transformed.x)
                         transformed.y = Math.round(transformed.y)

                         */

          var transformed = {
            x: x,
            y: y,
          };

          if (x === 0 && y === 0) {
            //          console.log("transformed is ", transformed)
          }
          var index =
            (transformed.y * LaserApi.canvas.width + transformed.x) * 4;
          var indexnormal = (y * LaserApi.canvas.width + x) * 4;
          var gx = Math.floor(x / gwidth);
          var gy = Math.floor(y / gheight);
          var gIndex = gy * laserConfig.gridResolution + gx;

          //canvasColor.data[index + 1] = 0;
          //canvasColor.data[index + 2] = 0;
          //                    if (canvasColor.data[index] > (canvasColor.data[index + 1] + canvasColor.data[index + 2])) {
          var diff = [];
          var current = [];
          current[0] = canvasColorOriginal.data[index];
          current[1] = canvasColorOriginal.data[index + 1];
          current[2] = canvasColorOriginal.data[index + 2];

          if (
            getColorDistance(laserConfig.testColor, [
              canvasColorOriginal.data[index],
              canvasColorOriginal.data[index + 1],
              canvasColorOriginal.data[index + 2],
            ]) < laserConfig.threshold
          ) {
            /*  coordinates.push({
                             x: x,
                             x: x,
                             y: y,
                             r: canvasColor.data[index],
                             g: canvasColor.data[index + 1],
                             b: canvasColor.data[index + 2]
                             });
                             */
            LaserApi.globalImageData.data[indexnormal] = 0;
            LaserApi.globalImageData.data[indexnormal + 1] = 0;
            LaserApi.globalImageData.data[indexnormal + 2] = 255;

            LaserApi.gRect[gIndex] = LaserApi.gRect[gIndex] + 1;
          } else {
            LaserApi.globalImageData.data[indexnormal] *= 0.9;
            LaserApi.globalImageData.data[indexnormal + 1] *= 0.9;
            LaserApi.globalImageData.data[indexnormal + 2] *= 0.9;

            //LaserApi .gRect[gIndex] = 0;
          }
        }
      }

      LaserApi.context.putImageData(LaserApi.globalImageData, 0, 0);

      for (var gx = 0; gx < laserConfig.gridResolution; gx++) {
        for (var gy = 0; gy < laserConfig.gridResolution; gy++) {
          var ggx = gx * gwidth;
          var ggy = gy * gheight;
          var gIndex = gy * laserConfig.gridResolution + gx;

          if (LaserApi.gRect[gIndex] > 0) {
            LaserApi.context.strokeStyle = "#0000ff";
            LaserApi.context.strokeRect(ggx, ggy, gwidth, gheight);
            LaserApi.context.strokeStyle = "#0000ff";
            LaserApi.context.font = "10px Arial";
            LaserApi.context.fillStyle = "#ffffff";
            LaserApi.context.textAlign = "center";
            // context.fillText('' +LaserApi . gRect[gIndex], ggx + gwidth * 0.5, ggy + gheight * 0.5);

            LaserApi.context.fillRect(
              ggx,
              ggy,
              LaserApi.canvas.width / laserConfig.gridResolution,
              LaserApi.canvas.height / laserConfig.gridResolution
            );
          } else {
            // context.strokeStyle = "#ffffff";
          }
        }
      }

      // so at this point is time to call the callback method from our api listener

      if (LaserApi.callback) {
        LaserApi.callback(LaserApi.gRect);
      }
    }
  },
  registerCallback: function (fn) {
    // most simple callback saving for now, no events, no unregister nothing
    LaserApi.callback = fn;
  },
};

export default LaserApi;
