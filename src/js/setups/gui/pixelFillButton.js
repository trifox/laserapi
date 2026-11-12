import { renderText } from '../../util.js';

/**
 * pixelFillButton ist wie fillButton eine n-Eck-Fläche, die sich füllt und bei activeValue auslöst.
 *
 * Unterschied: statt "irgendein Laser in der Bounding-Box ja/nein" wird der ANTEIL leuchtender
 * Grid-Zellen innerhalb des Kreises gemessen (getFillPercent(), 0..100).
 * Der Anteil ist unabhängig von der Grid-Auflösung (ein Laserpunkt ist auf der Projektion immer
 * etwa gleich gross), und mehr Laser = mehr Fläche = schnelleres Füllen.
 *
 * Füllrate pro Sekunde = speedUp * min(1, fillPercent / fullPercent)
 * - fullPercent: ab diesem Anteil wird mit voller Geschwindigkeit gefüllt (z. B. 50 => "halb bedeckt = voll")
 * - minPercent:  darunter zählt es als Rauschen, der Zähler fällt mit speedDown
 *
 * Gescannt wird nur die Bounding-Box des Kreises (am Rand geclampt).
 */
var MasterCanvas = require('../../MasterCanvas').default;
var util = require('../../util.js').default;

var laserConfig = require('../../LaserApiConfig').default;

/**
 * zählt die Grid-Zellen, deren Mittelpunkt im Kreis (Canvas-Pixel) liegt, und davon die leuchtenden
 * @returns {{hits: number, total: number}}
 */
export function countGridCellsInCircle(grid, x, y, radius) {
  const gridSize = Math.floor(Math.sqrt(grid.length));
  const factx = MasterCanvas.getCanvas().width / gridSize;
  const facty = MasterCanvas.getCanvas().height / gridSize;
  const x0 = Math.max(0, Math.floor((x - radius) / factx));
  const x1 = Math.min(gridSize - 1, Math.floor((x + radius) / factx));
  const y0 = Math.max(0, Math.floor((y - radius) / facty));
  const y1 = Math.min(gridSize - 1, Math.floor((y + radius) / facty));
  let hits = 0;
  let total = 0;
  for (let gy = y0; gy <= y1; gy++) {
    for (let gx = x0; gx <= x1; gx++) {
      const dx = (gx + 0.5) * factx - x;
      const dy = (gy + 0.5) * facty - y;
      if (dx * dx + dy * dy <= radius * radius) {
        total++;
        if (grid[gx + gy * gridSize] > 0) hits++;
      }
    }
  }
  // Kreis kleiner als eine Zelle: die Zelle unter dem Mittelpunkt zählt
  if (total === 0) {
    const gx = Math.floor(x / factx);
    const gy = Math.floor(y / facty);
    if (gx >= 0 && gx < gridSize && gy >= 0 && gy < gridSize) {
      total = 1;
      if (grid[gx + gy * gridSize] > 0) hits = 1;
    }
  }
  return { hits, total };
}

export default ({
  label = 'Sample Button',
  posX,
  posY,
  radius = 50,
  speedUp = 100,
  speedDown = 50,
  fullPercent = 50,
  minPercent = 0,
  counterReset = false,
  edges = 5,
  edges2,
  keyCode = undefined,
  angle = 0,
  lineWidth = 3,
  activeColor = '#00bbff',
  growColor = '#0088ff',
  normalColor = '#0044ff',
  activeValue = 75,
  minValue = 25,
  onEnterActive,
  onExitActive,
  visible = true,
}) => {
  var currentX = posX;
  var currentY = posY;
  var counter = 0;
  var fillPercent = 0;
  var currentEdges = edges;
  var currentRadius = radius;
  var currentAngle = angle;
  var currentLineWidth = lineWidth;
  var currentColor = normalColor;
  var currentLabel = label;
  var currentGrowColor = growColor;
  var currentActiveColor = activeColor;
  var state = 'normal';
  var result = {
    name: 'GUI pixelFillButton',
    init: function () {},
    getFillPercent() {
      return fillPercent;
    },
    getColor() {
      return currentColor;
    },
    setColor(newcol) {
      currentColor = newcol;
    },
    getGrowColor() {
      return currentGrowColor;
    },
    setGrowColor(newcol) {
      currentGrowColor = newcol;
    },
    getActiveColor() {
      return currentActiveColor;
    },
    setActiveColor(newcol) {
      currentActiveColor = newcol;
    },
    getLabel() {
      return currentLabel;
    },
    setLabel(newLabel) {
      currentLabel = newLabel;
    },
    getValue() {
      return counter;
    },
    setValue(newValue) {
      counter = newValue;
    },
    setCounter(newValue) {
      counter = newValue;
    },
    getState() {
      return state;
    },
    getX() {
      return currentX;
    },
    setX(newX) {
      currentX = newX;
    },
    getY() {
      return currentY;
    },
    setY(newY) {
      currentY = newY;
    },
    getRadius() {
      return currentRadius;
    },
    setRadius(newRadius) {
      currentRadius = newRadius;
    },
    getEdges() {
      return currentEdges;
    },
    setEdges(newEdges) {
      currentEdges = newEdges;
    },
    getAngle() {
      return currentAngle;
    },
    setAngle(newAngle) {
      currentAngle = newAngle;
    },
    getLineWidth() {
      return currentLineWidth;
    },
    setLineWidth(newLineWidth) {
      currentLineWidth = newLineWidth;
    },
    handle: function (grid, elapsed) {
      var ctx = MasterCanvas.get2dContext();

      if (!keyCode) {
        const { hits, total } = countGridCellsInCircle(grid, currentX, currentY, currentRadius);
        fillPercent = total > 0 ? (hits / total) * 100 : 0;
        if (hits > 0 && fillPercent > minPercent) {
          const rate = Math.min(1, fillPercent / Math.max(0.001, fullPercent));
          counter = Math.min(100, counter + Math.abs(speedUp * rate * elapsed));
        } else {
          counter = Math.max(0, counter - Math.abs(speedDown * elapsed));
        }
      } else if (laserConfig.pressedKeys[keyCode]) {
        fillPercent = 100;
        counter = activeValue + 1;
        state = 'grow';
      }

      var oldstate = state;
      var color;
      if (counter > activeValue) {
        color = currentActiveColor;
        state = 'active';
      } else if (counter > minValue) {
        color = currentGrowColor;
        state = 'grow';
      } else {
        color = currentColor;
        state = 'normal';
      }

      if (visible) {
        util.drawNgon({
          ctx,
          color,
          Xcenter: currentX,
          Ycenter: currentY,
          size: currentRadius,
          numberOfSides: currentEdges,
          angle: currentAngle,
          lineWidth: currentLineWidth,
        });
        if (edges2) {
          util.drawNgon({
            ctx,
            color,
            Xcenter: currentX,
            Ycenter: currentY,
            size: currentRadius / 2,
            numberOfSides: edges2,
            angle: currentAngle,
            lineWidth: currentLineWidth / 2,
          });
        }
        if (counter > 0) {
          util.drawNgon({
            ctx,
            color,
            Xcenter: currentX,
            Ycenter: currentY,
            size: currentRadius * (counter / 100),
            numberOfSides: currentEdges,
            angle: currentAngle,
            lineWidth: currentLineWidth,
          });
        }
        if (currentLabel) {
          util.renderText({
            ctx,
            text: currentLabel,
            x: currentX,
            y: currentY - 10,
            fillStyle: currentColor,
            fontSize: '25px',
          });
        }
        if (keyCode) {
          renderText({
            ctx,
            text: `Press <${keyCode}> to start!`,
            fontSize: '24px',
            x: currentX,
            y: currentY - 10,
          });
        }
      }

      // anders als fillButton auch normal -> active, da hohe Füllraten grow in einem Frame überspringen können
      if (oldstate != state) {
        if (state == 'active') {
          if (onEnterActive) {
            onEnterActive(result);
          }
          if (counterReset) {
            counter = 0;
            state = 'normal';
          }
        }
        if (oldstate == 'active') {
          if (onExitActive) {
            onExitActive(result);
          }
        }
      }
    },
  };
  return result;
};
