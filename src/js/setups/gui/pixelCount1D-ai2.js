/**
 * pixelCount1D-ai2 – überarbeitete Fassung von ./pixelCount1D.js
 *
 * Original: src/js/setups/gui/pixelCount1D.js (bleibt unverändert erhalten).
 * Drop-in-Ersatz: gleiche Optionen und Methoden.
 *   import pixelCount1D from './gui/pixelCount1D.js'  →  import pixelCount1D from './gui/pixelCount1D-ai2.js'
 *
 * Funktion: Misst im Rechteck (Mittelpunkt posX/posY, halbe Breite radius, halbe Höhe radiusY), wo die Laser
 * horizontal im Mittel liegen – eine Skala von label1 (links) bis label2 (rechts), z. B. "1 … 100".
 * getMeanX() = Schwerpunkt in Pixeln ab linkem Rand des Rechtecks, getFillPercent() = Flächenanteil.
 *
 * Behobene Fehler gegenüber dem Original:
 * - Phantompunkt: Schwerpunkt wurde zur linken Kante gezogen, getFillPercent() nie 0 (siehe pixelCountBase-ai2).
 * - Randüberlauf beim Scannen (gridScan).
 * - getLabel() war doppelt definiert und lieferte deshalb label2. Jetzt: getLabel() = label1, neu getLabel2().
 * - setRadius() wirkte nicht auf den Messbereich (der Scan nutzte den Startradius). Jetzt schon.
 * - Es wurde ein zweiter "Scan-Rahmen" (scanRadiusFactor) gezeichnet, der gar nicht gescannt wurde – entfernt.
 * - Der Füllbalken nutzte die zufällig zuletzt gesetzte fillStyle des Spiels – jetzt die Komponentenfarbe.
 * - Eigene performance.now()-Zeitmessung entfernt (wurde nicht benutzt); Zeichnen in save/restore.
 *
 * Zusätzlich: hasInput(), getLabel2(), getRadiusY()/setRadiusY().
 */
import { createPixelCountBase, assign } from './pixelCountBase-ai2.js';
var MasterCanvas = require('../../MasterCanvas').default;
var util = require('../../util.js').default;

export default ({
  live = true,
  label1 = 'Pixel Counter 1d',
  label2 = 'Pixel Counter 1d',
  posX,
  posY,
  radius = 10,
  radiusY = 100,
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
  var currentRadiusY = radiusY;

  return assign(base.api, {
    name: 'GUI pixel Count 1d button',
    getMeanX() {
      return s.meanX;
    },
    getRadiusY() {
      return currentRadiusY;
    },
    setRadiusY(v) {
      currentRadiusY = v;
    },
    handle: function (grid) {
      const left = s.x - s.radius;
      const top = s.y - currentRadiusY;
      base.measure(grid, left, top, s.radius * 2, currentRadiusY * 2);

      const ctx = MasterCanvas.get2dContext();
      ctx.save();
      ctx.strokeStyle = s.color;
      ctx.fillStyle = s.color;
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.rect(left, top, s.radius * 2, currentRadiusY * 2);
      ctx.stroke();

      const bar = s.radius * 2 * base.fraction() * 2;
      ctx.fillRect(left, s.y - s.radius - bar, s.radius * 2, bar);
      if (live && s.hasLaser) {
        ctx.fillStyle = '#004400';
        ctx.fillRect(left + s.meanX - 50, top, 100, currentRadiusY * 2);
      }
      ctx.restore();

      util.renderText({
        ctx,
        text: `${s.label1}`,
        x: s.x - s.radius,
        y: top - 25,
        fontSize: '25px',
        fillStyle: 'white',
      });
      util.renderText({
        ctx,
        text: `${s.label2}`,
        x: s.x + s.radius,
        y: top - 25,
        fontSize: '25px',
        fillStyle: 'white',
      });
    },
  });
};
