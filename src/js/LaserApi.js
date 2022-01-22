/**
 *
 * Breakdown of algorithm
 *
 * 1. input
 *  a. a video image stream (videoResolution)
 *  b. a rectangular are marking the projected frame to scan out of the video stream
 *    i. at the time of writing perspective transform is performed by using weights the corner
 *        x/y directions of the rectangular, this will be dealt with future changes backmapping
 *        the projection to a rectangular area, and is as of now just the best known and easiest
 *        to implement, /message end future christian and reader
 *  c. a color reference indicating the laser color to scan for
 * 2.a. extract area of interest from the rectangular area marked (testresolution)
 * 2.b. calculate color diferencies of rgb values to reference color to scan for (testresolution)
 * 3. create 1 dimensional resultarray out of video image (gridResolution)
 *
 */
var hermite = require("cubic-hermite");
import { lerp, lerp2d, lerp3d } from "./math.js";
var helper = require("./helper.js");
var GPU = require("gpu.js").GPU;
var laserConfig = require("./LaserApiConfig.js").default;
var gpuTools = require("./gpuTools").default;

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

gpu.addFunction(gpuTools.rgb2hsv);
gpu.addFunction(
  function getColorDistance(col1, referenceColor) {
    var diff = [
      col1[0] - referenceColor[0],
      col1[1] - referenceColor[1],
      col1[2] - referenceColor[2],
    ];
    var result = Math.sqrt(
      diff[0] * diff[0] + diff[1] * diff[1] + diff[2] * diff[2]
    );

    // // console.log('diff is .', col1, col2, result);
    const contrast = 1;
    const brightness = 1;
    // // use hsv color distances for
    var hsv1 = rgb2hsv(col1[0], col1[1], col1[2]);
    var hsv2 = rgb2hsv(referenceColor[0], referenceColor[1], referenceColor[2]);
    var hsvdiff = [
      Math.abs(hsv1[0] - hsv2[0]),
      Math.abs(hsv1[1] * brightness - hsv2[1]),
      Math.abs(hsv1[2] * contrast - hsv2[2]),
    ];
    // return result;
    // var result2 = Math.sqrt(hsvdiff[0] * hsvdiff[0]);
    return (
      Math.sqrt(
        hsvdiff[0] * hsvdiff[0] +
          hsvdiff[1] * hsvdiff[1] +
          hsvdiff[2] * hsvdiff[2]
      ) / 386 // the 386 results from sqrt(360*360+100*100+100*100) range of rgb2hsv result
    );
  },
  { argumentTypes: { col1: "Array(3)", col2: "Array(3)" } }
);

gpu.addFunction(function lerpSin(v0, v1, t) {
  return lerp(v0, v1, 1 - (Math.cos(t * Math.PI) * 0.5 + 0.5));
});
gpu.addFunction(lerp);
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
        lerp(hermite1TopLeftRight, hermite2BottomLeftRight, coord[0])
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
var superKernel;
var LaserApi = {
  lerp: lerp,
  lerp2d: lerp2d,
  lerp3d: lerp3d,

  gRect: new Array(laserConfig.gridResolution * laserConfig.gridResolution),
  //globalImageData: null,
  video: null,
  canvas: null,
  getFine(videoInput) {
    /**
     * this method performs the full input filtering and transformation
     * as of now it is using the gpu.js kernel combination feature to keep
     * everything on the gpu, functionality wise it is
     *
     * 1. transform input video into region of interest and calculate color diferences to laserpoint color
     * 2. subsample to scale down to what is used as working space of the games, creating a 1dimensional output array of dots indicating true or false wether a laser pointer
     * has been detected for that location....
     */
    if (!superKernel) {
      const videoKernel = this.createVideoKernel();
      const downscaleKernel = this.createDownScaleKernel();
      superKernel = gpu.combineKernels(
        videoKernel,
        downscaleKernel,
        function (
          imageData,
          resX,
          resY,
          inputResX,
          inputResY,
          mapping,
          referenceColor,
          threshold,
          gridResolution
        ) {
          return downscaleKernel(
            videoKernel(
              imageData,
              resX,
              resY,
              inputResX,
              inputResY,
              mapping,
              referenceColor,
              threshold
            ),
            gridResolution,
            gridResolution,
            resX,
            resY
          );
        }
      );
    }

    return superKernel(
      videoInput,
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
        laserConfig.testColor[0] / 255,
        laserConfig.testColor[1] / 255,
        laserConfig.testColor[2] / 255,
      ],
      Number(laserConfig.threshold / 255),
      laserConfig.gridResolution
    );
  },

  createVideoKernel() {
    return gpu
      .createKernel(function (
        imageData,
        resX,
        resY,
        inputResX,
        inputResY,
        mapping,
        referenceColor,
        threshold
      ) {
        var x = this.thread.x;
        var y = resY - this.thread.y;

        var transformedCoord = transformCoordinate(
          [x / resX, y / resY],
          [mapping[0][0], 1 - mapping[0][1], mapping[0][2], mapping[0][3]],
          [mapping[1][0], 1 - mapping[1][1], mapping[1][2], mapping[1][3]],
          [mapping[2][0], 1 - mapping[2][1], mapping[2][2], mapping[2][3]],
          [mapping[3][0], 1 - mapping[3][1], mapping[3][2], mapping[3][3]]
        );
        var x2 = Math.floor(transformedCoord[0] * inputResX);
        var y2 = Math.floor(transformedCoord[1] * inputResY);
        const pixel = imageData[y2][x2];
        // var index = (x2 + y2 * inputResX) * 4;
        var colorDistance = getColorDistance(
          [pixel[0], pixel[1], pixel[2]],
          [referenceColor[0], referenceColor[1], referenceColor[2]]
        );
        if (colorDistance < threshold) {
          this.color(
            referenceColor[0],
            referenceColor[1],
            referenceColor[2],
            0
          );
        } else {
          this.color(0, 0, 0, 0);
          // const pixel33 = imageData[y2][x2];
          // // const pixel = imageData[this.thread.y][this.thread.x];
          // this.color(pixel[0], pixel[1], pixel[2], pixel[3]);
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
  },

  getInterestReqionGPU(context, canvasColorOriginal) {
    if (!compiledKernelExtractInterestRegion) {
      compiledKernelExtractInterestRegion = this.createVideoKernel();
    }
    compiledKernelExtractInterestRegion(
      canvasColorOriginal,
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

    // var resultImage = context.createImageData(
    //   laserConfig.testResolution.width,
    //   laserConfig.testResolution.height
    // );
    // // set our buffer as source
    // resultImage.data.set(compiledKernelExtractInterestRegion.getPixels());

    // render.destroy();

    return compiledKernelExtractInterestRegion.canvas;
  },

  createDownScaleKernel() {
    return gpu
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
            // if (imageData[sourceIndex + 4 * (i + j * inputResX)] > 0) {
            //   accumulator++;
            // }
            var pixel =
              imageData[Math.floor((resY - currentY) * factY) + j][
                Math.floor(currentX * factX) + i
              ];
            if (pixel[0] > 0) {
              accumulator++;
            }
            //accumulator++;
          }
        }
        return accumulator;
        //   if (canvasColorOriginal) {
        //   }
      })
      .setOutput([laserConfig.gridResolution * laserConfig.gridResolution]);
  },
  getRectForInputImageGPU: function (canvasColorOriginal) {
    /**
     * this method downscales the rgb input 2d array into
     * a 2d array of just floats
     */
    if (!compiledKernelExtractGrid) {
      compiledKernelExtractGrid = this.createDownScaleKernel();
    }
    return compiledKernelExtractGrid(
      canvasColorOriginal,
      Number(laserConfig.gridResolution),
      Number(laserConfig.gridResolution),
      Number(laserConfig.testResolution.width),
      Number(laserConfig.testResolution.height)
    );
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
  // // main loop, calls the render method each 30ms + calculates the current average volume + activates the alarm
  // updateCanvasRegular: function () {
  //   return;
  //   var currentDate = performance.now();
  //   //     console.log('checking ', lastDate, currentDate);
  //   if (currentDate - lastDate < laserConfig.tickIntervalMilliseconds) {
  //     window.requestAnimationFrame(LaserApi.updateCanvasRegular);
  //     return;
  //   }
  //   //    console.log('returning ', lastDate, currentDate);
  //   lastDate = currentDate;

  //   LaserApi.updateCanvas();
  // },

  registerCallback: function (fn) {
    // most simple callback saving for now, no events, no unregister nothing
    LaserApi.callback = fn;
  },
};

export default LaserApi;
