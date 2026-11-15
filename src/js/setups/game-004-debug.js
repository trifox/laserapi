import { getRgbSpread } from '../util';

var laserConfig = require('../LaserApiConfig').default;
var MainCanvas = require('../MasterCanvas').default;

// Ein temporäres Canvas, auf dem wir die rohen Pixel manipulieren
var offscreenCanvas = null;
var offscreenCtx = null;
var imageData = null;

const handler = function (laserGrid) {
  const ctx = MainCanvas.get2dContext();
  const width = laserConfig.canvasResolution.width;
  const height = laserConfig.canvasResolution.height;
  const gridRes = laserConfig.gridResolution;
  const testColor = getRgbSpread(laserConfig.testColor, 0.5,1,.5);

  // Offscreen-Canvas initialisieren, falls noch nicht geschehen
  if (!offscreenCanvas) {
    offscreenCanvas = document.createElement('canvas');
    offscreenCanvas.width = width;
    offscreenCanvas.height = height;
    offscreenCtx = offscreenCanvas.getContext('2d', { willReadFrequently: true });
    imageData = offscreenCtx.createImageData(width, height);
  }

  const data = imageData.data;
   
  // Pixel direkt im CPU-Arbeitsspeicher befüllen
  for (let y = 0; y < height; y++) {
    // Canvas-Y (0 oben) auf Grid-Y umrechnen
   const gridY = Math.floor((y / height) * gridRes);
    for (let x = 0; x < width; x++) {
      const gridX = Math.floor((x / width) * gridRes);
      const value = laserGrid[gridX + gridY * gridRes];
      
      const index = (y * width + x) * 4;

      if (value > 0) {
        // Farbe berechnen und Alpha voll setzen (255)
        data[index]     = (value * testColor[0]) * 255; // R
        data[index + 1] = (value * testColor[1]) * 255; // G
        data[index + 2] = (value * testColor[2]) * 255; // B
        data[index + 3] = 255;                          // A (sichtbar)
      } else {
        // Komplett transparent löschen
        data[index + 3] = 0;                            // A (transparent)
      }
    }
  }

  // ImageData auf das temporäre Canvas schreiben
  offscreenCtx.putImageData(imageData, 0, 0);

  // Alten Bereich auf dem Haupt-Canvas löschen und das Bitmap drüberzeichnen
//  ctx.clearRect(0, 0, width, height);
  ctx.drawImage(offscreenCanvas, 0, 0);
};

export default {
  name: 'Debug Grid (CPU)',
  init: () => {},
  handle: function (grid) {
    handler(grid);
  },
};