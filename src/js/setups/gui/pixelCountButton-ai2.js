/**
 * pixelCountButton-ai2 – überarbeitete Fassung von ./pixelCountButton.js
 *
 * Original: src/js/setups/gui/pixelCountButton.js (bleibt unverändert erhalten).
 * Drop-in-Ersatz: gleiche Optionen und Methoden.
 *   require('./gui/pixelCountButton').default  →  require('./gui/pixelCountButton-ai2').default
 *
 * Funktion: Quadrat (halbe Kantenlänge radius), gemessen wird der Laser-Flächenanteil im Scan-Quadrat mit
 * halber Kantenlänge radius · scanRadiusFactor (Standard 1.5 – etwas grösser als das gezeichnete Feld,
 * damit knapp daneben noch zählt). getFillPercent() 0..100, live = Balken über dem Feld.
 *
 * Behobene Fehler gegenüber dem Original:
 * - getFillPercent() lieferte vor dem ersten handle() NaN (0/0) – jetzt 0.
 * - Randüberlauf beim Scannen (gridScan).
 * - setRadius() wirkte nicht auf den Messbereich (Scanradius war einmalig aus dem Startradius berechnet).
 * - Es wurde nur jeden 2. Frame gemessen (Werte hinkten hinterher) – jetzt jeden Frame (Scan ist geclampt
 *   und günstig).
 * - Der Balken nutzte die zuletzt gesetzte fillStyle des Spiels – jetzt die Komponentenfarbe; save/restore.
 *
 * Zusätzlich: hasInput(), getScanRadiusFactor/setScanRadiusFactor.
 */
import { createPixelCountBase, assign } from './pixelCountBase-ai2.js';
var MasterCanvas = require('../../MasterCanvas').default;
var util = require('../../util.js').default;

export default ({
  live = true,
  label = 'Pixel Counter',
  posX,
  posY,
  radius = 10,
  speedUp = 0.1, // im Original ohne Funktion
  speedDown = 0.1, // im Original ohne Funktion
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
    label1: label,
    label2: '',
  });
  const s = base.state;

  return assign(base.api, {
    name: 'GUI pixelCountButton',
    getScanRadiusFactor() {
      return s.scanRadiusFactor;
    },
    setScanRadiusFactor(v) {
      s.scanRadiusFactor = v;
    },
    handle: function (grid) {
      const r = s.radius;
      const sr = r * s.scanRadiusFactor;
      base.measure(grid, s.x - sr, s.y - sr, sr * 2, sr * 2);

      const ctx = MasterCanvas.get2dContext();
      ctx.save();
      ctx.strokeStyle = s.color;
      ctx.fillStyle = s.color;
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.rect(s.x - r, s.y - r, r * 2, r * 2);
      ctx.stroke();
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.rect(s.x - sr, s.y - sr, sr * 2, sr * 2);
      ctx.stroke();
      if (live) {
        const bar = r * 2 * base.fraction() * 2;
        ctx.fillRect(s.x - r, s.y - r - bar, r * 2, bar);
      }
      ctx.restore();
      util.renderText({
        ctx,
        text: `${s.label1}`,
        x: s.x,
        y: s.y + r + 25,
        fontSize: '25px',
        fillStyle: 'white',
      });
    },
  });
};
