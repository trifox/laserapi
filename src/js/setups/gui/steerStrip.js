/**
 * steerStrip – Lenkstreifen: liefert die Position aller Laser in einem Rechteck als Wert 0..1.
 *
 * Gemessen wird der Schwerpunkt aller leuchtenden Zellen im Streifen, entlang einer Achse
 * ('x' = links 0 … rechts 1, 'y' = oben 0 … unten 1; mit invert umgedreht). Der Wert folgt weich
 * (smoothing), damit Rauschen nicht zittert. Bei neuem Input springt er direkt auf den Schwerpunkt.
 * Ohne Laser bleibt der letzte Wert stehen (hasInput() = false).
 *
 * Teamwork-Maß: getFocus() = 1, wenn alle Laser eng beieinander sind, 0 bei Streuung >= focusSpread.
 * Damit kann ein Spiel Einigkeit belohnen (z. B. schärfer lenken, wenn alle dieselbe Stelle anleuchten).
 *
 * Gedacht für: Lenken, Schläger, Kräne, Regler, Lautstärke – alles Eindimensionale.
 *
 * Optionen:
 *   posX, posY      Mittelpunkt des Streifens (Standard: unten, volle Breite)
 *   width, height   Grösse in Canvas-Pixeln
 *   axis = 'x'      Messachse 'x' oder 'y'; invert = false
 *   minPercent = 0  Mindest-Flächenanteil (Prozent des Streifens), darunter zählt es als "kein Input"
 *   smoothing = 8   Folgegeschwindigkeit (1/s)
 *   focusSpread = 400  Streuung in Pixeln, bei der getFocus() 0 wird
 *   startValue = 0.5
 *   keyCodes        { minus: 'ArrowLeft', plus: 'ArrowRight' } – Tasten verschieben den Wert (Test ohne Laser),
 *                   keySpeed = 1 (Wert pro Sekunde), keyHoldTime = 0.5 (s, so lange gilt der Tastenwert danach)
 *   visible = true, label, normalColor, markerColor, lineWidth
 *   onInput(strip)  Laser tauchen auf;  onLost(strip)  Laser verschwinden
 *
 * Getter/Setter: X, Y, Width, Height, Radius (= halbe Länge entlang der Achse), Color, Label, Value.
 * Weitere Getter: getRawValue() (ungeglättet), getPosition() (Pixelposition des Werts entlang der Achse),
 *   hasInput(), getFocus(), getSpread(), getLitPercent(), getAxis().
 *
 * Beispiel:
 *   const lenkung = guiSteerStrip({ posY: 990, height: 180, keyCodes: { minus: 'ArrowLeft', plus: 'ArrowRight' } });
 *   lenkung.handle(grid, elapsed);
 *   auto.x = lerp(auto.x, lenkung.getPosition(), 3 * elapsed * (0.3 + lenkung.getFocus()));
 */
import { scanRect, isKeyDown, approach, clamp } from './gridScan.js';
var MasterCanvas = require('../../MasterCanvas').default;
var util = require('../../util.js').default;

export default ({
  label = '',
  posX = 960,
  posY = 990,
  width = 1920,
  height = 180,
  axis = 'x',
  invert = false,
  minPercent = 0,
  smoothing = 8,
  focusSpread = 400,
  startValue = 0.5,
  keyCodes,
  keySpeed = 1,
  keyHoldTime = 0.5,
  visible = true,
  lineWidth = 3,
  normalColor = '#0044ff',
  markerColor = '#00bbff',
  onInput,
  onLost,
}) => {
  var cx = posX;
  var cy = posY;
  var w = width;
  var h = height;
  var value = startValue;
  var raw = startValue;
  var input = false;
  var spread = 0;
  var litPercent = 0;
  var keyTimer = 0;
  var currentColor = normalColor;
  var currentLabel = label;

  function length() {
    return axis === 'y' ? h : w;
  }

  function toValue(px, py) {
    const v = axis === 'y' ? (py - (cy - h / 2)) / h : (px - (cx - w / 2)) / w;
    return clamp(invert ? 1 - v : v, 0, 1);
  }

  function valueToPos(v) {
    const vv = invert ? 1 - v : v;
    return axis === 'y' ? cy - h / 2 + vv * h : cx - w / 2 + vv * w;
  }

  function draw() {
    const ctx = MasterCanvas.get2dContext();
    ctx.save();
    ctx.strokeStyle = currentColor;
    ctx.lineWidth = lineWidth;
    ctx.setLineDash([20, 14]);
    ctx.strokeRect(cx - w / 2, cy - h / 2, w, h);
    ctx.setLineDash([]);
    if (input) {
      const p = valueToPos(value);
      const thick = 6 + 14 * result.getFocus();
      ctx.strokeStyle = markerColor;
      ctx.lineWidth = thick;
      ctx.lineCap = 'round';
      ctx.beginPath();
      if (axis === 'y') {
        ctx.moveTo(cx - w / 2 + 10, p);
        ctx.lineTo(cx + w / 2 - 10, p);
      } else {
        ctx.moveTo(p, cy - h / 2 + 10);
        ctx.lineTo(p, cy + h / 2 - 10);
      }
      ctx.stroke();
    }
    ctx.restore();
    if (currentLabel) {
      util.renderText({ ctx, text: currentLabel, x: cx, y: cy + 12, fontSize: '36px', fillStyle: currentColor });
    }
  }

  var result = {
    name: 'GUI steerStrip',
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
      return length() / 2;
    },
    setRadius(v) {
      if (axis === 'y') h = v * 2;
      else w = v * 2;
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
    getAxis() {
      return axis;
    },
    getValue() {
      return value;
    },
    setValue(v) {
      value = clamp(v, 0, 1);
      raw = value;
    },
    getRawValue() {
      return raw;
    },
    getPosition() {
      return valueToPos(value);
    },
    hasInput() {
      return input;
    },
    getSpread() {
      return spread;
    },
    getFocus() {
      return input ? clamp(1 - spread / focusSpread, 0, 1) : 0;
    },
    getLitPercent() {
      return litPercent;
    },
    handle: function (grid, elapsed) {
      const had = input;
      const s = scanRect(grid, cx - w / 2, cy - h / 2, w, h);
      litPercent = s.percent;

      let keyActive = false;
      if (keyCodes) {
        let d = 0;
        if (isKeyDown(keyCodes.minus)) d -= 1;
        if (isKeyDown(keyCodes.plus)) d += 1;
        if (d !== 0) {
          if (keyTimer <= 0) raw = value;
          raw = clamp(raw + d * keySpeed * elapsed, 0, 1);
          keyTimer = keyHoldTime;
        } else {
          keyTimer = Math.max(0, keyTimer - elapsed);
        }
        keyActive = keyTimer > 0;
      }

      if (keyActive) {
        input = true;
        spread = 0;
      } else if (s.count > 0 && s.percent >= minPercent) {
        raw = toValue(s.x, s.y);
        spread = s.spread;
        input = true;
      } else {
        input = false;
      }

      if (input) {
        value = had ? approach(value, raw, smoothing, elapsed) : raw;
        if (!had && onInput) onInput(result);
      } else if (had && onLost) {
        onLost(result);
      }

      if (visible) draw();
    },
  };
  return result;
};
