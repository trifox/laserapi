/**
 * pixelCount2D-ai2 – überarbeitete Fassung von ./pixelCount2D.js
 *
 * Original: src/js/setups/gui/pixelCount2D.js (bleibt unverändert erhalten).
 * Drop-in-Ersatz: gleiche Optionen und Methoden.
 *   import pixelCount2D from './gui/pixelCount2D.js'  →  import pixelCount2D from './gui/pixelCount2D-ai2.js'
 *
 * Funktion: Koordinatenfeld (Quadrat um posX/posY mit halber Kantenlänge radius, 10×10-Raster). Misst den
 * Schwerpunkt der Laser: getMeanX()/getMeanY() in Pixeln ab linker oberer Ecke. Beschriftung wie im
 * Original: label1 links (Y-Achse), label2 rechts unten und links oben (Achsenenden), label3 Ursprung,
 * label4 unten Mitte (X-Achse).
 *
 * Behobene Fehler gegenüber dem Original:
 * - Phantompunkt: Schwerpunkt wurde zur linken oberen Ecke gezogen (siehe pixelCountBase-ai2).
 * - Randüberlauf beim Scannen (gridScan).
 * - getLabel() war doppelt definiert und lieferte label2. Jetzt: getLabel() = label1, neu getLabel2().
 * - setRadius() wirkte nicht auf den Messbereich; jetzt schon. Raster und Achsen nutzen den aktuellen Radius.
 * - Die Schwerpunkt-Markierung wurde auch ohne Laser an der Ecke gezeichnet – jetzt nur mit Eingabe.
 * - Eigene performance.now()-Zeitmessung entfernt; Zeichnen in save/restore.
 *
 * Zusätzlich: hasInput(), getLabel2(), setLabel3/setLabel4.
 */
import { createPixelCountBase, assign } from './pixelCountBase-ai2.js';
import { drawLine } from '../../util.js';
var MasterCanvas = require('../../MasterCanvas').default;
var util = require('../../util.js').default;

export default ({
  live = true,
  label1 = 'Pixel Counter 1d',
  label2 = 'Pixel Counter 1d',
  label3 = 'Pixel Counter 1d',
  label4 = 'Pixel Counter 1d',
  posX,
  posY,
  radius = 10,
  normalColor = '#008844',
  speedX = 0,
  speedY = 0,
  onEnterActive, // im Original ohne Funktion, bleibt wirkungslos
  onExitActive, // im Original ohne Funktion, bleibt wirkungslos
  scanRadiusFactor = 1.5,
  innerRadiusFactor = 0.5,
  angle = 0,
}) => {
  const base = createPixelCountBase({
    posX,
    posY,
    radius,
    speedX,
    speedY,
    angle,
    normalColor,
    innerRadiusFactor,
    scanRadiusFactor,
    label1,
    label2,
  });
  const s = base.state;
  var currentLabel3 = label3;
  var currentLabel4 = label4;

  return assign(base.api, {
    name: 'GUI pixel Count 2d',
    getMeanX() {
      return s.meanX;
    },
    getMeanY() {
      return s.meanY;
    },
    setLabel3(v) {
      currentLabel3 = v;
    },
    setLabel4(v) {
      currentLabel4 = v;
    },
    handle: function (grid) {
      const r = s.radius;
      const left = s.x - r;
      const top = s.y - r;
      base.measure(grid, left, top, r * 2, r * 2);

      const ctx = MasterCanvas.get2dContext();
      ctx.save();
      ctx.lineWidth = 4;
      if (live && s.hasLaser) {
        ctx.fillStyle = '#004400';
        ctx.fillRect(left + s.meanX - 12.5, top + s.meanY - 12.5, 25, 25);
      }
      for (var i = 0; i < 11; i++) {
        const d = i * ((r * 2) / 10);
        drawLine(ctx, left, top + d, s.x + r, top + d, '#444444');
        drawLine(ctx, left + d, top, left + d, s.y + r, '#444444');
      }
      drawLine(ctx, left - 10, s.y + r, s.x + r, s.y + r, '#888888');
      drawLine(ctx, left, s.y + r + 10, left, top, '#888888');
      ctx.restore();

      util.renderText({ ctx, text: `${s.label1}`, x: left - 25, y: s.y, fontSize: '25px', fillStyle: 'white', align: 'right' });
      util.renderText({ ctx, text: `${s.label2}`, x: s.x + r + 50, y: s.y + r, fontSize: '25px', fillStyle: 'white', align: 'left' });
      util.renderText({ ctx, text: `${s.label2}`, x: left - 25, y: top - 25, fontSize: '25px', fillStyle: 'white', align: 'left' });
      util.renderText({ ctx, text: `${currentLabel3}`, x: left, y: s.y + r + 50, fontSize: '25px', fillStyle: 'white' });
      util.renderText({ ctx, text: `${currentLabel4}`, x: s.x, y: s.y + r + 50, fontSize: '25px', fillStyle: 'white' });
    },
  });
};
