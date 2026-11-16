/**
 * pixelCount4D-ai2 – überarbeitete Fassung von ./pixelCount4D.js
 *
 * Original: src/js/setups/gui/pixelCount4D.js (bleibt unverändert erhalten).
 * Drop-in-Ersatz: gleiche Optionen und Methoden.
 *   import pixelCount4D from './gui/pixelCount4D.js'  →  import pixelCount4D from './gui/pixelCount4D-ai2.js'
 *
 * Funktion: Quadrat mit Achsenkreuz, vier Pole (label1 links, label2 rechts, label3 oben, label4 unten).
 * getMeanX()/getMeanY() = Schwerpunkt der Laser in Pixeln ab linker oberer Ecke des Quadrats.
 *
 * Behobene Fehler gegenüber dem Original:
 * - Phantompunkt: Schwerpunkt wurde zur linken oberen Ecke gezogen (siehe pixelCountBase-ai2).
 * - Randüberlauf beim Scannen (gridScan).
 * - getLabel() war doppelt definiert und lieferte label2. Jetzt: getLabel() = label1, neu getLabel2().
 * - setRadius() wirkte nicht auf den Messbereich; jetzt schon.
 * - Gezeichneter "Scan-Rahmen" (scanRadiusFactor, mit falscher Höhe) wurde gar nicht gescannt – entfernt.
 * - Füllbalken nutzte die zuletzt gesetzte fillStyle des Spiels – jetzt die Komponentenfarbe.
 * - Achsenkreuz wurde doppelt gezeichnet; Schwerpunkt-Markierung ohne Laser an der Ecke – behoben.
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
    name: 'GUI pixel Count 4d',
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
      ctx.strokeStyle = s.color;
      ctx.fillStyle = s.color;
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.rect(left, top, r * 2, r * 2);
      ctx.stroke();

      const bar = r * 2 * base.fraction() * 2;
      ctx.fillRect(left, top - bar, r * 2, bar);
      if (live && s.hasLaser) {
        ctx.fillStyle = '#004400';
        ctx.fillRect(left + s.meanX - 12.5, top + s.meanY - 12.5, 25, 25);
      }
      drawLine(ctx, left, s.y, s.x + r, s.y, '#888888');
      drawLine(ctx, s.x, top, s.x, s.y + r, '#888888');
      ctx.restore();

      util.renderText({ ctx, text: `${s.label1}`, x: left - 25, y: s.y, fontSize: '25px', fillStyle: 'white', align: 'right' });
      util.renderText({ ctx, text: `${s.label2}`, x: s.x + r + 25, y: s.y, fontSize: '25px', fillStyle: 'white', align: 'left' });
      util.renderText({ ctx, text: `${currentLabel3}`, x: s.x, y: top - 25, fontSize: '25px', fillStyle: 'white' });
      util.renderText({ ctx, text: `${currentLabel4}`, x: s.x, y: s.y + r + 50, fontSize: '25px', fillStyle: 'white' });
    },
  });
};
