var laserConfig = require('../LaserApiConfig').default;
var MasterCanvas = require('../MasterCanvas').default;
import util, {
  getRgbSpreadHex,
  removeItemFromArray,
  rgbToHex,
} from '../util.js';
import { lerp3dArray, lerp, lerp2dArray, sin3 } from '../math.js';
import gpuTools from '../gpuTools';
import followCircle from './gui/followCircle.js';
import { repellAll } from './game-017-thehorde.js';
var guiFillButton = require('./gui/fillButton').default;
var GPU = require('gpu.js').GPU;
var lastResolution = -1;

const gpu = new GPU();
gpu.addFunction(gpuTools.hsv2rgb);
gpu.addFunction(gpuTools.rgb2hsv);
gpu.addFunction(lerp);
gpu.addFunction(lerp3dArray);
gpu.addFunction(lerp2dArray);
var kernelRender;
var kernelBuffer;
var kernelBufferFire;
var buffer;
var buffer2;

var lastTime = 0;
var elapsed = 0;
function getDelta() {
  var currentTime = performance.now();
  const elapsed = (currentTime - lastTime) / 1000;

  lastTime = currentTime;
  return elapsed;
}

var offscreen = new OffscreenCanvas(1920, 1080);

var help = false;
const buttons = [
  guiFillButton({
    label: 'CLEAR',
    posX: 1920 - 100,
    posY: 1080 - 100,
    radius: 50,

    onEnterActive: () => {
      const ctxoff = offscreen.getContext('2d');
      ctxoff.clearRect(0, 0, offscreen.width, offscreen.height);
    },
    onExitActive: () => {},
  }),
];

function createStift({
  x,
  y,
  radius = 50,
  color = [0, 128, 128],
  edges = 5,
  edges2 = 5,
}) {
  var bubble = followCircle({
    label: '',
    posX: x,
    posY: y,
    normalColor: rgbToHex(color[0], color[1], color[2], 25),

    edges,
    edges2,
    speedDown: 0.08,
    speedUp: 0.1,
    scanRadiusFactor: 1,
    followTrueOrRepellFalse: true,
    radius: radius,
  });
  const orighandle = bubble.handle;
  var sinCounter = 0;
  var age = 0;
  var lastPos;
  bubble.handle = (grid, elapsed) => {
    const ctxoff = offscreen.getContext('2d');
    ctxoff.strokeStyle = getRgbSpreadHex(laserConfig.testColor, 0.5);
    ctxoff.lineWidth = 5;
    if (lastPos) {
      ctxoff.beginPath();
      ctxoff.moveTo(lastPos.x, lastPos.y);
      ctxoff.lineTo(bubble.getX(), bubble.getY());
      ctxoff.stroke();
    }
    if (bubble.getX() < 50) bubble.setX(bubble.getX() + (1920 - 100));
    if (bubble.getY() < 50) bubble.setY(bubble.getY() + (1080 - 100));
    if (bubble.getX() > 1920 - 50) bubble.setX(bubble.getX() - (1920 - 100));
    if (bubble.getY() > 1080 - 50) bubble.setY(bubble.getY() - (1080 - 100));
    lastPos = { x: bubble.getX(), y: bubble.getY() };

    age += 100 * elapsed;
    orighandle(grid, elapsed);
    // console.log(bubble.getSpeedX(), bubble.getSpeedY());
    if (
      Math.sqrt(
        bubble.getSpeedX() * bubble.getSpeedX() +
          bubble.getSpeedX() * bubble.getSpeedY()
      ) < 0.01
    ) {
      //  bubble.setRadius(bubble.getRadius() - 25 * elapsed);
      if (bubble.getRadius() < 0) {
        //    removeItemFromArray(stifte, bubble);
      }
    } else {
    }
    //bubble.setAngle((sin3(sinCounter * 0.5) * Math.PI) / 2);
  };
  return bubble;
}
function createSpawnButton({ x, y, radius = 50, color = [255, 0, 0] }) {
  var butt = guiFillButton({
    label: '',
    posX: 100 + x * radius * 3,
    posY: 100 + y * radius * 3,
    speedDown: 100,
    speedUp: 50,
    edges: Math.floor(3 + Math.random() * 8),
    edges2: Math.floor(3 + Math.random() * 8),
    angle: Math.random() * 360,
    activeValue: 75,
    minValue: 10,
    radius: radius,
    scanRadiusFactor: 1,
    growColor: rgbToHex(color[0], color[1], color[2], 50),
    activeColor: rgbToHex(color[0], color[1], color[2], 255),
    normalColor: rgbToHex(color[0], color[1], color[2], 25),
    onEnterActive: (sender) => {
      //removeItemFromArray(spawnButtons, butt);
      butt.setValue(0);
      stifte.push(
        createStift({
          x: butt.getX(),
          y: butt.getY(),
          radius: radius,
          edges: butt.getEdges(),
          edges2: butt.getEdges2(),
          color: color,
        })
      );
    },
    onExitActive: (sender) => {},
  });
  return butt;
}
function createSpawnButtons() {
  const result = [];
  for (var i = 0; i < 17; i++) {
    for (var j = 0; j < 9; j++) {
      const randomColor = [
        Math.floor(Math.random() * 64),
        Math.floor(Math.random() * 128) + 128,
        Math.floor(Math.random() * 256),
      ];

      var item = createSpawnButton({
        x: i,
        y: j,
        radius: 35,

        color: randomColor,
      });
      result.push(item);
    }
  }
  return result;
}
var spawnButtons = createSpawnButtons({});

const stifte = [];

const handler = function (laserGrid, elapsedIn) {
  elapsed = elapsedIn;
  var gridSize = Math.sqrt(laserGrid.length);
  if (gridSize !== lastResolution) {
    // initialise the buffer bitmap with the same size of the input guiRangeSlider

    buffer = new Float32Array(laserGrid.length);
    buffer2 = new Float32Array(laserGrid.length);
    kernelBuffer = undefined;
    lastResolution = gridSize;
  }
  const ctx = MasterCanvas.get2dContext();
  stifte.forEach((stift) => stift.handle(laserGrid, elapsed));

  spawnButtons.forEach((button) => button.handle(laserGrid, elapsed));

  repellAll({ workArray: stifte, targetArray: stifte, elapsed });
  ctx.drawImage(offscreen, 0, 0);
  buttons.forEach((item) => item.handle(laserGrid, elapsed));
};

export default {
  name: 'Laser-Dienstagsmaler',
  description: `
  Male Bilder mit Laser-Stiften.
  
  Erzeuge einen Stift, durch still halten deines Lasers.

  Ist ein Sift entstanden,
  so folgt dieser Stift deinem Laser-Pointer.

  Wird ein Stift nicht durch ein Laser-Pointer kontrolliert
  verschwindet er wieder.
  `,
  handle: handler,
  init: () => {},
};
