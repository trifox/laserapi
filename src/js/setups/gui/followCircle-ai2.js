/**
 * followCircle-ai2 – überarbeitete Fassung von ./followCircle.js
 *
 * Original: src/js/setups/gui/followCircle.js (bleibt unverändert erhalten).
 * Drop-in-Ersatz: gleiche Optionen und Methoden.
 *   require('./gui/followCircle').default  →  require('./gui/followCircle-ai2').default
 *
 * Funktion: Ein Objekt folgt dem Schwerpunkt der Laser in seinem Scanbereich (followTrueOrRepellFalse = true)
 * oder flieht davor (false). Die Zielgeschwindigkeit ergibt sich aus der Lage des Schwerpunkts im Scan-Quadrat
 * (Seitenlänge 2 · radius · scanRadiusFactor): Schwerpunkt am Rand = volle Geschwindigkeit.
 *
 * Behobene Fehler gegenüber dem Original:
 * - setRadius/shrinkSpeed veränderten nur die Figur, nicht den Erfassungsbereich (Scanradius wurde einmalig
 *   aus dem Startradius berechnet). Jetzt gilt immer radius · scanRadiusFactor.
 * - Bildratenabhängigkeit: Das Original rechnete nur jeden 2. Frame, bewegte sich dabei nur mit dem elapsed
 *   dieses einen Frames (halbe Geschwindigkeit, Ruckeln) und glättete mit einem festen lerp-Faktor pro Update.
 *   Jetzt wird jeden Frame gerechnet, Glättung und Bewegung skalieren mit elapsed. Kalibriert auf das Verhalten
 *   des Originals bei 60 fps (speedUp/speedDown = Anteil pro Update bei 30 Updates/s, 500 px/s je Einheit).
 * - Rand: Lesen ausserhalb des Bildes traf Zellen der Nachbarzeile – jetzt geclampter Scan (gridScan).
 * - onEnterActive/onExitActive wurden im Original nie ausgelöst (state änderte sich nie). Sie bleiben aus
 *   Kompatibilitätsgründen wirkungslos – manche Spiele (z. B. game-020-defender) übergeben dort Code, der
 *   bei echtem Auslösen plötzlich laufen würde. Neu dafür: onLaserEnter(circle) sobald Laser erfasst werden,
 *   onLaserLeave(circle) wenn keine mehr da sind.
 * - Ein loses ctx.arc() ohne beginPath/stroke verschmutzte den Pfad des Spiels; Zeichnen jetzt in save/restore.
 * - Label nutzt die per setColor gesetzte Farbe.
 *
 * Zusätzlich: onLaserEnter/onLaserLeave, hasInput(), getScanRadiusFactor/setScanRadiusFactor, getLabel/setLabel, setVisible.
 */
import { scanRect } from './gridScan.js';
var MasterCanvas = require('../../MasterCanvas').default;
var util = require('../../util.js').default;

const UPDATES_PER_SECOND = 30; // Update-Rate des Originals bei 60 fps (jeder 2. Frame)
const PIXELS_PER_UNIT = 500; // Original: speed · elapsed · 1000 in jedem 2. Frame

/** lerp-Faktor pro Original-Update in einen bildratenunabhängigen Faktor für dt umrechnen */
function smoothFactor(perUpdate, dt) {
  const a = Math.min(1, Math.max(0, perUpdate));
  return 1 - Math.pow(1 - a, dt * UPDATES_PER_SECOND);
}

const guiFollowCircle = ({
  label = 'Follow Circle',
  posX,
  posY,
  radius = 100,
  speedUp = 0.1,
  speedDown = 0.1,
  normalColor = '#008844',
  speedX = 0,
  edges,
  lineWidth = 4,
  edges2,
  shrinkSpeed = 0,
  speedY = 0,
  onEnterActive, // eslint-disable-line no-unused-vars -- absichtlich wirkungslos (siehe oben)
  onExitActive, // eslint-disable-line no-unused-vars
  onLaserEnter,
  onLaserLeave,
  scanRadiusFactor = 1,
  innerRadiusFactor = 0.5,
  followTrueOrRepellFalse = true,
  visible = true,
  angle = 0,
}) => {
  var currentX = posX;
  var currentY = posY;
  var currentSpeedX = speedX;
  var currentSpeedY = speedY;
  var currentAngle = angle;
  var currentRadius = radius;
  var currentNormalColor = normalColor;
  var currentScanRadiusFactor = scanRadiusFactor;
  var currentInnerRadiusFactor = innerRadiusFactor;
  var currentLabel = label;
  var currentVisible = visible;
  var laserPresent = false;

  var result = {
    name: 'GUI followCircle',
    init: function () {},
    data: {
      fillState: 0,
    },
    setX(newX) {
      currentX = newX;
    },
    getX() {
      return currentX;
    },
    setInnerRadiusFactor(v) {
      currentInnerRadiusFactor = v;
    },
    getInnerRadiusFactor() {
      return currentInnerRadiusFactor;
    },
    setScanRadiusFactor(v) {
      currentScanRadiusFactor = v;
    },
    getScanRadiusFactor() {
      return currentScanRadiusFactor;
    },
    getIsCurrentlyHavingMoreThanZeroLaserPointersDetected() {
      return laserPresent;
    },
    hasInput() {
      return laserPresent;
    },
    getAngle() {
      return currentAngle;
    },
    setAngle(v) {
      currentAngle = v;
    },
    setColor(v) {
      currentNormalColor = v;
    },
    getColor() {
      return currentNormalColor;
    },
    setLabel(v) {
      currentLabel = v;
    },
    getLabel() {
      return currentLabel;
    },
    setVisible(v) {
      currentVisible = v;
    },
    setRadius(v) {
      currentRadius = v;
    },
    getRadius() {
      return currentRadius;
    },
    setY(newY) {
      currentY = newY;
    },
    getY() {
      return currentY;
    },
    setSpeedY(v) {
      currentSpeedY = v;
    },
    getSpeedY() {
      return currentSpeedY;
    },
    setSpeedX(v) {
      currentSpeedX = v;
    },
    getSpeedX() {
      return currentSpeedX;
    },
    handle: function (grid, elapsed) {
      const dt = Math.min(Math.max(elapsed || 0, 0), 0.1);
      const scanR = Math.max(1, currentRadius * currentScanRadiusFactor);
      const left = currentX - scanR;
      const top = currentY - scanR;
      const s = scanRect(grid, left, top, scanR * 2, scanR * 2);
      const had = laserPresent;
      laserPresent = s.hasLaser;

      if (laserPresent) {
        // Lage des Schwerpunkts im Scan-Quadrat: -0.5 (links/oben) … +0.5 (rechts/unten)
        var tx = (s.x - left) / (scanR * 2) - 0.5;
        var ty = (s.y - top) / (scanR * 2) - 0.5;
        if (!followTrueOrRepellFalse) {
          tx = -tx;
          ty = -ty;
        }
        const f = smoothFactor(speedUp, dt);
        currentSpeedX += (tx - currentSpeedX) * f;
        currentSpeedY += (ty - currentSpeedY) * f;
      } else {
        const f = smoothFactor(speedDown, dt);
        currentSpeedX -= currentSpeedX * f;
        currentSpeedY -= currentSpeedY * f;
        currentRadius = Math.max(0, currentRadius - shrinkSpeed * dt);
      }
      currentX += currentSpeedX * dt * PIXELS_PER_UNIT;
      currentY += currentSpeedY * dt * PIXELS_PER_UNIT;
      result.data.fillState = laserPresent ? 100 : 0;

      if (currentVisible) {
        const ctx = MasterCanvas.get2dContext();
        ctx.save();
        ctx.strokeStyle = currentNormalColor;
        ctx.lineWidth = lineWidth;
        util.renderText({
          ctx,
          text: currentLabel,
          x: currentX,
          y: currentY - 10,
          fontSize: '25px',
          fillStyle: currentNormalColor,
        });
        if (edges) {
          util.drawNgon({
            ctx,
            color: currentNormalColor,
            Xcenter: currentX,
            Ycenter: currentY,
            size: currentRadius,
            numberOfSides: edges,
            angle: currentAngle,
            lineWidth,
          });
        }
        if (edges2) {
          util.drawNgon({
            ctx,
            color: currentNormalColor,
            Xcenter: currentX,
            Ycenter: currentY,
            size: currentRadius * currentInnerRadiusFactor,
            numberOfSides: edges2,
            angle: currentAngle,
            lineWidth: lineWidth / 2,
          });
        }
        ctx.restore();
      }

      if (laserPresent && !had && onLaserEnter) onLaserEnter(result);
      if (!laserPresent && had && onLaserLeave) onLaserLeave(result);
    },
  };
  return result;
};

export default guiFollowCircle;
