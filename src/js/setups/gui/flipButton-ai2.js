/**
 * flipButton-ai2 – überarbeitete Fassung von ./flipButton.js
 *
 * Original: src/js/setups/gui/flipButton.js (bleibt unverändert erhalten).
 * Drop-in-Ersatz: gleiche Optionen (label, posX, posY, radius, activeColor, normalColor, onEnter, onExit).
 *   require('./gui/flipButton').default  →  require('./gui/flipButton-ai2').default
 *
 * Funktion: Kreis, der sofort onEnter auslöst, wenn ein Laser darin ist, und onExit, wenn keiner mehr da ist.
 *
 * Behobene Fehler gegenüber dem Original:
 * - onExit feuerte im ersten Frame ohne Laser, obwohl nie onEnter kam (Startzustand 'normal' ≠ 'inactive').
 * - Rand: Lesen ausserhalb des Bildes traf Zellen der Nachbarzeile – jetzt geclampter Kreis-Scan (gridScan).
 * - Flackern: Ein einzelner verrauschter Frame ohne Laser löste onExit + onEnter aus. Jetzt muss der Laser
 *   exitDelay Sekunden fehlen (Standard 0.1 s), bevor onExit kommt. enterDelay (Standard 0 = sofort wie
 *   im Original) verzögert optional das Eintreten.
 * - Der Kreis zeichnete wegen des zweiten arc(…, 0 …) einen Strich zur Mitte; Zeichnen jetzt in save/restore.
 *
 * Zusätzlich: Getter/Setter X, Y, Radius, Color, Label, isActive(), visible-Option, labelColor (Standard 'white').
 */
import { scanCircle } from './gridScan.js';
var MasterCanvas = require('../../MasterCanvas').default;
var util = require('../../util.js').default;

export default ({
  label = 'Flip Button',
  posX,
  posY,
  radius = 10,
  activeColor = '#ffff00',
  normalColor = '#008844',
  labelColor = 'white',
  enterDelay = 0,
  exitDelay = 0.1,
  visible = true,
  onEnter,
  onExit,
}) => {
  var currentX = posX;
  var currentY = posY;
  var currentRadius = radius;
  var currentColor = normalColor;
  var currentActiveColor = activeColor;
  var currentLabel = label;
  var active = false;
  var onTimer = 0;
  var offTimer = 0;

  var result = {
    name: 'GUI flipButton',
    init: function () {},
    data: {
      fillState: 0,
    },
    getX() {
      return currentX;
    },
    setX(v) {
      currentX = v;
    },
    getY() {
      return currentY;
    },
    setY(v) {
      currentY = v;
    },
    getRadius() {
      return currentRadius;
    },
    setRadius(v) {
      currentRadius = v;
    },
    getColor() {
      return currentColor;
    },
    setColor(v) {
      currentColor = v;
    },
    getActiveColor() {
      return currentActiveColor;
    },
    setActiveColor(v) {
      currentActiveColor = v;
    },
    getLabel() {
      return currentLabel;
    },
    setLabel(v) {
      currentLabel = v;
    },
    isActive() {
      return active;
    },
    handle: function (grid, elapsed) {
      const dt = Math.min(Math.max(elapsed || 0, 0), 0.1);
      const found = scanCircle(grid, currentX, currentY, currentRadius).hasLaser;
      var changed = false;
      if (found) {
        offTimer = 0;
        onTimer += dt;
        if (!active && onTimer >= enterDelay) {
          active = true;
          changed = true;
        }
      } else {
        onTimer = 0;
        offTimer += dt;
        if (active && offTimer >= exitDelay) {
          active = false;
          changed = true;
        }
      }
      result.data.fillState = active ? 100 : 0;

      if (visible) {
        const ctx = MasterCanvas.get2dContext();
        ctx.save();
        ctx.strokeStyle = active ? currentActiveColor : currentColor;
        ctx.lineWidth = 4;
        ctx.beginPath();
        ctx.arc(currentX, currentY, currentRadius, 0, 2 * Math.PI);
        ctx.stroke();
        util.renderTextDropShadow({
          ctx,
          text: currentLabel,
          x: currentX,
          y: currentY,
          fontSize: '25px',
          fillStyle: labelColor,
          dropDistX: 2,
          dropDistY: 2,
        });
        ctx.restore();
      }

      if (changed) {
        if (active && onEnter) onEnter(result);
        if (!active && onExit) onExit(result);
      }
    },
  };
  return result;
};
