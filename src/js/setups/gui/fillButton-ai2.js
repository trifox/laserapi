/**
 * fillButton-ai2 – überarbeitete Fassung von ./fillButton.js
 *
 * Original: src/js/setups/gui/fillButton.js (bleibt unverändert erhalten, wird von den alten Spielen benutzt).
 * Drop-in-Ersatz: gleiche Factory-Optionen, gleiche Methoden und Callbacks. Umstellen per
 *   require('./gui/fillButton').default  →  require('./gui/fillButton-ai2').default
 *
 * Funktion (wie Original): n-Eck, das sich füllt, solange irgendein Laser darin ist (binär, speedUp/s),
 * und sonst leert (speedDown/s). Über activeValue → 'active' + onEnterActive, darunter zurück → onExitActive.
 * Mit keyCode reagiert der Button NUR auf die Taste (wie im Original – "unsichtbare Zwillinge" verlassen sich darauf).
 *
 * Behobene Fehler gegenüber dem Original:
 * - Rand: Das Original las ausserhalb des Bildes Zellen der Nachbarzeile (Laser am anderen Bildrand
 *   lösten Randbuttons aus). Jetzt wird über gridScan.scanCircle am Rand geclampt gescannt.
 * - Scanbereich ist der Kreis um den Button statt eines um eine Zelle zu grossen Quadrats.
 * - Tastenmodus: onEnterActive feuerte in JEDEM Frame, solange die Taste gedrückt war. Jetzt genau einmal
 *   pro Tastendruck. Ausserdem baute sich der Zähler nach dem Loslassen nie ab (Button blieb für immer
 *   aktiv, onExitActive kam nie) – jetzt leert er sich mit speedDown wie bei Laser-Eingabe.
 * - onEnterActive feuert bei JEDEM Eintritt in 'active' (auch normal → active in einem Frame, z. B. nach
 *   einem Ruckler mit grossem elapsed oder setValue). Das Original wertete nur grow → active aus.
 * - onExitActive feuert bei jedem Verlassen von 'active' (auch active → normal), ausser beim counterReset.
 * - Die Füllung nutzt die aktuelle Eckenzahl (setEdges wirkte im Original nur auf den Rahmen);
 *   getEdges() liefert den aktuellen Wert.
 * - Label nutzt die per setColor gesetzte Farbe; der Tasten-Hinweis liegt nicht mehr auf dem Label.
 * - Zeichnen in ctx.save()/restore() – fillStyle/strokeStyle/lineWidth "lecken" nicht ins Spiel.
 * - elapsed wird auf 0.1 s begrenzt (kein Sofort-Füllen nach Tab-Wechsel).
 *
 * Zusätzlich: setVisible/getVisible, getState(), getAngle/setAngle, setEdges2.
 */
import { scanCircle, createKeyEdge } from './gridScan.js';
var MasterCanvas = require('../../MasterCanvas').default;
var util = require('../../util.js').default;
var laserConfig = require('../../LaserApiConfig').default;

/**
 * Interne Factory, auch von iframe_fillButton-ai2 benutzt.
 * env.getCtx(handleArgs) liefert den Zeichenkontext, env.getCanvas(ctx) die Canvas-Grösse { width, height }.
 */
export function createFillButton(
  {
    label = 'Sample Button',
    posX,
    posY,
    radius = 10,
    speedUp = 50,
    counterReset = false,
    edges = 5,
    edges2,
    speedDown = 25,
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
  },
  env
) {
  var currentX = posX;
  var currentY = posY;
  var counter = 0;
  var currentEdges = edges;
  var currentEdges2 = edges2;
  var currentAngle = angle;
  var currentRadius = radius;
  var currentColor = normalColor;
  var currentLabel = label;
  var currentGrowColor = growColor;
  var currentActiveColor = activeColor;
  var currentVisible = visible;
  var state = 'normal';
  var pressedOnce = createKeyEdge();

  function stateFor(value) {
    if (value > activeValue) return 'active';
    if (value > minValue) return 'grow';
    return 'normal';
  }

  function draw(ctx) {
    const color = state === 'active' ? currentActiveColor : state === 'grow' ? currentGrowColor : currentColor;
    ctx.save();
    util.drawNgon({
      ctx,
      color,
      Xcenter: currentX,
      Ycenter: currentY,
      size: currentRadius,
      numberOfSides: currentEdges,
      angle: currentAngle,
      lineWidth,
    });
    if (currentEdges2) {
      util.drawNgon({
        ctx,
        color,
        Xcenter: currentX,
        Ycenter: currentY,
        size: currentRadius / 2,
        numberOfSides: currentEdges2,
        angle: currentAngle,
        lineWidth: lineWidth / 2,
      });
    }
    util.drawNgon({
      ctx,
      color,
      Xcenter: currentX,
      Ycenter: currentY,
      size: currentRadius * (counter / 100),
      numberOfSides: currentEdges,
      filled: false,
      angle: currentAngle,
      lineWidth,
    });
    util.renderText({
      ctx,
      text: currentLabel,
      x: currentX,
      y: currentY - 10,
      fillStyle: currentColor,
      fontSize: '25px',
    });
    if (keyCode) {
      util.renderText({
        ctx,
        text: `Press <${keyCode}> to start!`,
        fontSize: '24px',
        x: currentX,
        y: currentY + 24,
        fillStyle: currentColor,
      });
    }
    ctx.restore();
  }

  var result = {
    name: 'GUI fillButton',
    init: function () {},
    data: {
      fillState: 0,
    },
    getColor() {
      return currentColor;
    },
    getLabel() {
      return currentLabel;
    },
    getEdges() {
      return currentEdges;
    },
    getEdges2() {
      return currentEdges2;
    },
    setEdges2(v) {
      currentEdges2 = v;
    },
    setLabel(label) {
      currentLabel = label;
    },
    setColor(newcol) {
      currentColor = newcol;
    },
    getValue() {
      return counter;
    },
    setValue(v) {
      counter = v;
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
    setX(newX) {
      currentX = newX;
    },
    getX() {
      return currentX;
    },
    setY(newY) {
      currentY = newY;
    },
    getY() {
      return currentY;
    },
    setEdges(n) {
      currentEdges = n;
    },
    setCounter(v) {
      counter = v;
    },
    getRadius() {
      return currentRadius;
    },
    setRadius(newRadius) {
      currentRadius = newRadius;
    },
    getAngle() {
      return currentAngle;
    },
    setAngle(a) {
      currentAngle = a;
    },
    getVisible() {
      return currentVisible;
    },
    setVisible(v) {
      currentVisible = v;
    },
    /** 'normal' | 'grow' | 'active' */
    getState() {
      return state;
    },
    handle: function (grid, elapsed, ctxArg) {
      const ctx = env.getCtx(ctxArg);
      const dt = Math.min(Math.max(elapsed || 0, 0), 0.1);
      var forceEnter = false;

      if (!keyCode) {
        const s = scanCircle(grid, currentX, currentY, currentRadius, env.getCanvas(ctx));
        if (s.hasLaser) {
          counter = Math.min(100, counter + Math.abs(speedUp * dt));
        } else {
          counter = Math.max(0, counter - Math.abs(speedDown * dt));
        }
      } else if (pressedOnce(keyCode)) {
        // ein Tastendruck = genau ein Auslösen, auch wenn der Button noch aktiv ist
        counter = activeValue + 1;
        forceEnter = true;
      } else if (!laserConfig.pressedKeys[keyCode]) {
        counter = Math.max(0, counter - Math.abs(speedDown * dt));
      }

      var oldstate = state;
      state = stateFor(counter);
      result.data.fillState = counter;

      if (currentVisible) draw(ctx);

      if (state === 'active' && (oldstate !== 'active' || forceEnter)) {
        if (onEnterActive) onEnterActive(result);
        if (counterReset) {
          counter = 0;
          state = 'normal';
        }
      } else if (oldstate === 'active' && state !== 'active') {
        if (onExitActive) onExitActive(result);
      }
    },
  };
  return result;
}

export default (options) =>
  createFillButton(options, {
    getCtx: () => MasterCanvas.get2dContext(),
    getCanvas: () => null, // null = MasterCanvas (Standard in gridScan)
  });
