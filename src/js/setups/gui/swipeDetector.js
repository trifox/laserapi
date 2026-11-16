/**
 * swipeDetector – erkennt Gesten des Laser-Schwerpunkts: Wischen (links/rechts/hoch/runter) und Kreisen.
 *
 * Verfolgt wird der (geglättete) Schwerpunkt aller Laser im Bereich. Gesten entstehen also nur, wenn die
 * Menge GEMEINSAM wischt – einzelne Laser verschieben den Schwerpunkt bei vielen Spielern kaum. Das ist
 * gewollt: Gesten sind eine Teamwork-Aktion ("alle wischen nach rechts!"). Verschwinden alle Laser,
 * beginnt die Geste von vorn.
 *
 * - Wischen: Der Schwerpunkt legt innerhalb von swipeTime Sekunden mindestens minDistance Pixel zurück,
 *   und eine Richtung dominiert um directionRatio → onSwipe('left' | 'right' | 'up' | 'down', info).
 * - Kreisen: Innerhalb von circleTime Sekunden dreht sich die Bewegungsrichtung um insgesamt ~360°
 *   und die Spur ist mindestens minCircleRadius gross → onCircle('cw' | 'ccw', info) (Uhrzeigersinn
 *   bezogen auf den Bildschirm).
 * Nach jeder Geste gilt eine Sperre (cooldown), damit eine Bewegung nicht mehrfach zählt.
 * Sprungschutz: Springt der rohe Schwerpunkt in einem Frame weiter als maxJump Pixel (typisch, wenn Laser
 * den Bereich betreten oder verlassen), ist das keine Geste – die Spur beginnt dort neu.
 * Einigkeit: Gesten zählen nur, solange die Laser beieinander sind (Streuung <= maxSpread Pixel).
 * Ziellos verteilte Laser erzeugen so keine Zufallsgesten. Für Einzelspieler-Tests maxSpread erhöhen.
 * Achtung: Über den ganzen Bildschirm verteilt liegt die Streuung eines grossen Publikums meist deutlich über
 * 200 px – dann wird nie eine Geste erkannt. Entweder einen kleineren Gestenbereich wählen (alle wischen
 * gemeinsam in einem Feld) oder maxSpread passend erhöhen (z. B. 400–500).
 *
 * Optionen:
 *   posX, posY, width, height   Messbereich (Mittelpunkt + Grösse, Standard: ganzer Bildschirm)
 *   minPercent = 0, smoothing = 12 (1/s)
 *   swipeTime = 0.5, minDistance = 250, directionRatio = 1.5
 *   circleTime = 1.6, minCircleRadius = 80, cooldown = 0.6, maxJump = 200 (Pixel pro Frame),
 *   maxSpread = 200 (Pixel; Infinity = Einigkeit egal)
 *   keyCodes  { left, right, up, down, cw, ccw } – Taste löst die Geste direkt aus (Test ohne Laser)
 *   visible = true (Rahmen + Spur + letzte Geste), label, normalColor, trailColor
 *   onSwipe(direction, info, detector)   info = { dx, dy, distance, duration }
 *   onCircle(direction, info, detector)  info = { turn (Radiant), duration }
 *
 * Getter/Setter: X, Y, Width, Height, Radius (halbe kürzere Seite), Color, Label.
 * Abfragen: hasInput(), getPointX()/getPointY() (aktueller Schwerpunkt), getTrail() (Kopie der Spur
 *   [{x, y, t}]), getLastGesture() ({ type: 'swipe' | 'circle', direction, time } oder null), reset().
 *
 * Beispiel:
 *   const geste = guiSwipeDetector({
 *     keyCodes: { left: 'ArrowLeft', right: 'ArrowRight' },
 *     onSwipe: (dir) => { if (dir === 'right') naechsteSeite(); },
 *   });
 *   geste.handle(grid, elapsed);
 */
import { scanRect, approach, createKeyEdge } from './gridScan.js';
var MasterCanvas = require('../../MasterCanvas').default;
var util = require('../../util.js').default;

export default ({
  label = '',
  posX = 960,
  posY = 540,
  width = 1920,
  height = 1080,
  minPercent = 0,
  smoothing = 12,
  swipeTime = 0.5,
  minDistance = 250,
  directionRatio = 1.5,
  circleTime = 1.6,
  minCircleRadius = 80,
  cooldown = 0.6,
  maxJump = 200,
  maxSpread = 200,
  keyCodes,
  visible = true,
  normalColor = '#0044ff',
  trailColor = '#00bbff',
  onSwipe,
  onCircle,
}) => {
  var cx = posX;
  var cy = posY;
  var w = width;
  var h = height;
  var currentColor = normalColor;
  var currentLabel = label;
  var clock = 0;
  var input = false;
  var px = 0;
  var py = 0;
  var rawX = 0;
  var rawY = 0;
  var history = [];
  var cooldownTimer = 0;
  var lastGesture = null;
  var pressedOnce = createKeyEdge();

  function fire(type, direction, info) {
    lastGesture = { type, direction, time: clock };
    cooldownTimer = cooldown;
    history = input ? [{ x: px, y: py, t: clock }] : [];
    if (type === 'swipe' && onSwipe) onSwipe(direction, info, result);
    if (type === 'circle' && onCircle) onCircle(direction, info, result);
  }

  function checkSwipe() {
    let start = null;
    for (let i = 0; i < history.length; i++) {
      if (clock - history[i].t <= swipeTime) {
        start = history[i];
        break;
      }
    }
    if (!start) return false;
    const dx = px - start.x;
    const dy = py - start.y;
    const distance = Math.sqrt(dx * dx + dy * dy);
    if (distance < minDistance) return false;
    let dir = null;
    if (Math.abs(dx) >= directionRatio * Math.abs(dy)) dir = dx > 0 ? 'right' : 'left';
    else if (Math.abs(dy) >= directionRatio * Math.abs(dx)) dir = dy > 0 ? 'down' : 'up';
    if (!dir) return false;
    fire('swipe', dir, { dx, dy, distance, duration: clock - start.t });
    return true;
  }

  function checkCircle() {
    const samples = history.filter((s) => clock - s.t <= circleTime);
    if (samples.length < 6) return false;
    let minX = Infinity;
    let minY = Infinity;
    let maxX = -Infinity;
    let maxY = -Infinity;
    samples.forEach((s) => {
      minX = Math.min(minX, s.x);
      minY = Math.min(minY, s.y);
      maxX = Math.max(maxX, s.x);
      maxY = Math.max(maxY, s.y);
    });
    if (maxX - minX < minCircleRadius * 1.4 || maxY - minY < minCircleRadius * 1.4) return false;
    // Drehung der Bewegungsrichtung aufsummieren; kurze Schritte (Rauschen) werden zusammengefasst
    const minStep = Math.max(10, minCircleRadius * 0.25);
    let anchor = samples[0];
    let heading = null;
    let turn = 0;
    for (let i = 1; i < samples.length; i++) {
      const s = samples[i];
      const dx = s.x - anchor.x;
      const dy = s.y - anchor.y;
      if (dx * dx + dy * dy < minStep * minStep) continue;
      const hd = Math.atan2(dy, dx);
      if (heading !== null) {
        let d = hd - heading;
        while (d > Math.PI) d -= Math.PI * 2;
        while (d < -Math.PI) d += Math.PI * 2;
        turn += d;
      }
      heading = hd;
      anchor = s;
    }
    if (Math.abs(turn) < Math.PI * 2 * 0.9) return false;
    fire('circle', turn > 0 ? 'cw' : 'ccw', { turn, duration: clock - samples[0].t });
    return true;
  }

  function draw() {
    const ctx = MasterCanvas.get2dContext();
    ctx.save();
    ctx.strokeStyle = currentColor;
    ctx.lineWidth = 3;
    ctx.setLineDash([16, 12]);
    ctx.strokeRect(cx - w / 2, cy - h / 2, w, h);
    ctx.setLineDash([]);
    if (history.length > 1) {
      ctx.strokeStyle = trailColor;
      ctx.lineWidth = 8;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      for (let i = 1; i < history.length; i++) {
        const a = history[i - 1];
        const b = history[i];
        ctx.globalAlpha = Math.max(0, 1 - (clock - b.t) / Math.max(swipeTime, circleTime));
        ctx.beginPath();
        ctx.moveTo(a.x, a.y);
        ctx.lineTo(b.x, b.y);
        ctx.stroke();
      }
    }
    ctx.restore();
    if (currentLabel) {
      util.renderText({ ctx, text: currentLabel, x: cx, y: cy - h / 2 + 40, fontSize: '32px', fillStyle: currentColor });
    }
    if (lastGesture && clock - lastGesture.time < 0.8) {
      const names = { left: '← LINKS', right: 'RECHTS →', up: '↑ HOCH', down: '↓ RUNTER', cw: '↻ KREIS', ccw: '↺ KREIS' };
      ctx.save();
      ctx.globalAlpha = 1 - (clock - lastGesture.time) / 0.8;
      util.renderText({ ctx, text: names[lastGesture.direction] || '', x: cx, y: cy + 20, fontSize: '60px', fillStyle: trailColor });
      ctx.restore();
    }
  }

  var result = {
    name: 'GUI swipeDetector',
    init: function () {},
    getX() {
      return cx;
    },
    setX(v) {
      cx = v;
    },
    getY() {
      return cy;
    },
    setY(v) {
      cy = v;
    },
    getWidth() {
      return w;
    },
    setWidth(v) {
      w = v;
    },
    getHeight() {
      return h;
    },
    setHeight(v) {
      h = v;
    },
    getRadius() {
      return Math.min(w, h) / 2;
    },
    setRadius(v) {
      const f = v / Math.max(1, Math.min(w, h) / 2);
      w *= f;
      h *= f;
    },
    getColor() {
      return currentColor;
    },
    setColor(v) {
      currentColor = v;
    },
    getLabel() {
      return currentLabel;
    },
    setLabel(v) {
      currentLabel = v;
    },
    hasInput() {
      return input;
    },
    getPointX() {
      return px;
    },
    getPointY() {
      return py;
    },
    getTrail() {
      return history.map((s) => ({ x: s.x, y: s.y, t: s.t }));
    },
    getLastGesture() {
      return lastGesture;
    },
    reset() {
      history = [];
      lastGesture = null;
      cooldownTimer = 0;
    },
    handle: function (grid, elapsed) {
      clock += elapsed;
      cooldownTimer = Math.max(0, cooldownTimer - elapsed);
      const s = scanRect(grid, cx - w / 2, cy - h / 2, w, h);
      const had = input;
      // zu verstreute Laser zählen nicht als Gesten-Eingabe
      input = s.count > 0 && s.percent >= minPercent && s.spread <= maxSpread;

      if (input) {
        const jumped = had && Math.hypot(s.x - rawX, s.y - rawY) > maxJump;
        rawX = s.x;
        rawY = s.y;
        if (had && !jumped) {
          px = approach(px, s.x, smoothing, elapsed);
          py = approach(py, s.y, smoothing, elapsed);
        } else {
          px = s.x;
          py = s.y;
          history = [];
        }
        history.push({ x: px, y: py, t: clock });
        const keep = Math.max(swipeTime, circleTime);
        while (history.length && clock - history[0].t > keep) history.shift();
        if (cooldownTimer <= 0 && !checkSwipe()) checkCircle();
      } else {
        history = [];
      }

      if (keyCodes) {
        ['left', 'right', 'up', 'down'].forEach((dir) => {
          if (pressedOnce(keyCodes[dir])) fire('swipe', dir, { dx: 0, dy: 0, distance: minDistance, duration: 0 });
        });
        ['cw', 'ccw'].forEach((dir) => {
          if (pressedOnce(keyCodes[dir])) fire('circle', dir, { turn: dir === 'cw' ? Math.PI * 2 : -Math.PI * 2, duration: 0 });
        });
      }

      if (visible) draw();
    },
  };
  return result;
};
