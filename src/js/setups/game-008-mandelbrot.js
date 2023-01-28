import util, {
  getRgbSpreadHex,
  getRgbSpreadRandomHexTriplet,
  getRgbSpreadTriplet,
  removeItemFromArray,
} from '../util.js'; 
import guiSwitch from './gui/switch.js';

var laserConfig = require('../LaserApiConfig.js').default;
var MasterCanvas = require('../MasterCanvas').default;
var guiFillButton = require('./gui/fillButton').default; 
var guiRangeSlider = require('./gui/rangeSlider').default;

var knobPositions = [];

var lastResolution = -1;
const leftStartX = 1920 * 0.05;
const rightStartX = 1920 - 1920 * 0.05;
const bottomBarStartY = 1080 * 0.75;
var help = false;
var xSlider;
var ySlider;
var xSeedSlider;
var ySeedSlider;
var buttons; 
var juliaSeedEnableButton
const bottomBarCenterY = (1080 - bottomBarStartY) / 2 + bottomBarStartY;
var zoomSlider;
const createGui = () => {
  const cold1 = getRgbSpreadTriplet(laserConfig.testColor);
  const cold2 = getRgbSpreadTriplet(laserConfig.testColor);
  xSlider = guiRangeSlider({
    label: 'X Coordinate',
    posX: rightStartX - 1400,
    posY: bottomBarCenterY - 100,
    height: 100,
    width: 400,
    startValue: -0.6,
    minValue: -2,
    maxValue: 2,
    normalColor: cold1[0],
    growColor: cold1[1],
    activeColor: cold1[2],
  }); xSeedSlider = guiRangeSlider({
    label: 'X Seed',
    posX: rightStartX - 1400,
    posY: bottomBarCenterY + 35,
    height: 100,
    width: 400,
    startValue: 0,
    minValue: -2,
    maxValue: 2,
    normalColor: cold1[0],
    growColor: cold1[1],
    activeColor: cold1[2],
  });
  ySlider = guiRangeSlider({
    label: 'Y Coordinate',
    posX: rightStartX - 900,
    posY: bottomBarCenterY - 100,
    height: 100,
    width: 400,
    startValue: 0,
    minValue: -2,
    maxValue: 2,
    normalColor: cold1[0],
    growColor: cold1[1],
    activeColor: cold1[2],
  });
  ySeedSlider = guiRangeSlider({
    label: 'Y Seed',
    posX: rightStartX - 900,
    posY: bottomBarCenterY + 35,
    height: 100,
    width: 400,
    startValue: 0,
    minValue: -2,
    maxValue: 2,
    normalColor: cold1[0],
    growColor: cold1[1],
    activeColor: cold1[2],
  });
  zoomSlider = guiRangeSlider({
    label: 'ZOOM',
    posX: rightStartX - 400,
    posY: bottomBarCenterY - 50,
    height: 100,
    width: 400,
    exponential: true,
    startValue: 2,
    minValue: 0.0001,
    maxValue: 2,
    normalColor: cold1[0],
    growColor: cold1[1],
    activeColor: cold1[2],
    step : 0.02,
  }); 
    juliaSeedEnableButton = guiSwitch({
      label: 'Julia Off',
      label2: 'Julia On',
      posX: leftStartX + 200,
      posY: bottomBarCenterY+85,
      speedDown: 25,
      speedUp: 50,
      radius: 50,
      normalColor: cold2[0],
      growColor: cold2[1],
      activeColor: cold2[2],
      onEnterActive: () => {
        zoomSlider.reset();
        xSlider.reset();
        ySlider.reset();
      },
    }),
    buttons = [
      guiFillButton({
        label: 'Reset',
        posX: leftStartX + 200,
        posY: bottomBarCenterY-50,
        speedDown: 25,
        speedUp: 50,
        radius: 50,
        normalColor: cold2[0],
        growColor: cold2[1],
        activeColor: cold2[2],
        onEnterActive: () => {
          zoomSlider.reset();
          xSlider.reset();
          ySlider.reset();
          xSeedSlider.reset()
          ySeedSlider.reset()
        },
      }),
      // guiFillButton({
      //   label: 'HELP',
      //   posX: leftStartX + 50,
      //   posY: bottomBarCenterY,
      //   radius: 50,
      //   speedDown: 25,
      //   activeValue: 50,
      //   minValue: 10,
      //   speedUp: 50,
      //   normalColor: getRgbSpreadHex(laserConfig.testColor, 0.6),
      //   growColor: getRgbSpreadHex(laserConfig.testColor, 0.5),
      //   activeColor: getRgbSpreadHex(laserConfig.testColor, 0.4),
      //   onEnterActive: () => {
      //     help = true;
      //   },
      //   onExitActive: () => {
      //     help = false;
      //   },
      // }),
      juliaSeedEnableButton,
      xSlider,
      ySlider,
      zoomSlider,
      xSeedSlider,
      ySeedSlider
    ];
};
var GPU = require('gpu.js').GPU;
var lastResolution = -1;

const gpu = new GPU();
gpu.addFunction(function rotate(v, a) {
  const s = Math.sin(a);
  const c = Math.cos(a);
  const m = [
    [c, -s],
    [s, c],
  ];
  return [m[0][0] * v[0] + m[0][1] * v[1], m[1][0] * v[0] + m[1][1] * v[1]];
});
var kernel;
const handler = function (grid, elapsed) {
  const ctx = MasterCanvas.get2dContext();
  // console.log("render debug", laserConfig);
  if (!kernel) {
    kernel = gpu
      .createKernel(function (zoomCenter, zoomSize, maxIterations, angle, seed, julia) {
        let zIn = [seed[0], seed[1]];
        let inputXCoordinate = [
          (((this.thread.x - (this.output.x - this.output.y) / 2) /
            this.output.y) *
            4 -
            2) *
          (zoomSize / 4),
          ((this.thread.y / this.output.y) * 4 - 2) * (zoomSize / 4),
        ];
        inputXCoordinate = rotate(inputXCoordinate, angle);

        let cIn = [
          zoomCenter[0] + inputXCoordinate[0],
          zoomCenter[1] + inputXCoordinate[1],
        ];

        let z = [0, 0]
        let c = [0, 0]
        if (julia && this.thread.x > 940) {
          c = zIn
          z = [
            (((this.thread.x - (this.output.x - this.output.y) / 2) /
              this.output.y) *
              4 -
              4.5),
            ((this.thread.y / this.output.y) * 4 - 2),
          ];

        } else {
          z = [0, 0];
          c = cIn
        }


        let escaped = false;
        let iterations = 0;
        for (let i = 0; i < maxIterations; i++) {
          iterations = i;
          z = [
            z[0] * z[0] - z[1] * z[1] + c[0],
            z[0] * z[1] + z[0] * z[1] + c[1],
          ];
          if (z[0] * z[0] + z[1] * z[1] > 16) {
            escaped = true;
            break;
          }
        }
        if (escaped) {
          this.color(
            Math.sin(55.75 * Math.log(1 + iterations / maxIterations)) * 0.5 +
            0.5,
            Math.sin(77.75 * Math.log(1 + iterations / maxIterations)) * 0.5 +
            0.5,
            Math.sin(1113.75 * Math.log(1 + iterations / maxIterations)) * 0.5 +
            0.5,
            1
          );
        } else {
          this.color(0, 0, 0, 1);
        }
        // mark julia seed red
        if (julia &&Math.sqrt(
          ((cIn[0] - seed[0]) * (cIn[0] - seed[0])) +
          ((cIn[1] - seed[1]) * (cIn[1] - seed[1])))
          < 0.1 * (zoomSize / 4)) {
          this.color(1, 0, 0, 1)
        }
      })
      .setOutput([
        laserConfig.canvasResolution.width * 0.9,
        laserConfig.canvasResolution.height * 0.7,
      ])
      .setGraphical(true);
  }
  xSlider.setStep(zoomSlider.getValue() / 8);
  ySlider.setStep(zoomSlider.getValue() / 8);
  xSeedSlider.setStep(zoomSlider.getValue() / 12);
  ySeedSlider.setStep(zoomSlider.getValue() / 12);

if(juliaSeedEnableButton.getIsChecked()){


  removeItemFromArray(buttons,xSeedSlider)
  removeItemFromArray(buttons,ySeedSlider) 

}else{
  if(buttons.indexOf(xSeedSlider)===-1){
buttons.push(xSeedSlider)
  }
  if(buttons.indexOf(ySeedSlider)===-1){
buttons.push(ySeedSlider)
  }
}
  kernel(
    [xSlider.getValue(), ySlider.getValue()],
    zoomSlider.getValue(),
    1024,
    0,
    [xSeedSlider.getValue(), ySeedSlider.getValue()], !juliaSeedEnableButton.getIsChecked()
  );
  ctx.drawImage(
    kernel.canvas,
    laserConfig.canvasResolution.width * 0.05,
    laserConfig.canvasResolution.height * 0.05
  );
  return;
};
export default {
  name: 'Laser-Mandelbrot',
  description: `Das Mandelbrot, 
  
  I-LOVE-CHAOS
  
  Läßt keine gelegenheit aus das Mandelbrot vorzustellen!

  Never Discredit Chaos!
 
  `,
  init: function (data) {
    console.log('init game mandelbrot ', knobPositions);

    createGui();
  },
  handle: function (grid, elapsed) {
    if (lastResolution != grid.length) {
      // init();
      lastResolution = grid.length;
    }
    handler(grid, elapsed);
    this.handleMandelbrotScreen(grid, elapsed);
  },

  handleMandelbrotScreen(grid, elapsed) {
    buttons.forEach((item) => item.handle(grid, elapsed));
  },
};
