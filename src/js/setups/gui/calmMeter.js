/**
 * calmMeter – misst, wie ruhig oder wild die Laser in einem Bereich sind.
 *
 * Pro Frame wird die Menge der leuchtenden Zellen mit dem vorigen Frame verglichen:
 *   Bewegung = geänderte Zellen / alle Zellen, die in einem der beiden Frames leuchten (0..1)
 * Stillgehaltene Laser ändern fast nichts (≈ 0), herumgewedelte Laser fast alles (≈ 1).
 * Der Wert wird geglättet (getChaos()); getCalm() = 1 - getChaos().
 *
 * Auslöser:
 *   onChaos – Chaos bleibt chaosHoldTime Sekunden über chaosThreshold (einmal, bis es wieder ruhig wird).
 *             → einheitliche Strafe für "wildes Herumleuchten".
 *   onCalm  – Laser sind da UND bleiben calmHoldTime Sekunden ruhig (unter calmThreshold);
 *             danach beginnt der Zähler von vorn. → "Ziel ruhig halten", Zielen, Schleichen.
 *
 * Kamera vs. Spiel-Bildrate: Liefert die Kamera seltener neue Bilder, als das Spiel zeichnet, sind
 * aufeinanderfolgende Grids identisch. Völlig unveränderte Frames werden deshalb bis staleTime Sekunden
 * übersprungen und erst danach als echte Ruhe gewertet.
 *
 * Optionen:
 *   posX, posY, width, height  Messbereich (Mittelpunkt + Grösse, Standard: ganzer Bildschirm)
 *   smoothing = 3 (1/s), minPercent = 0 (Mindest-Flächenanteil für "Laser da")
 *   chaosThreshold = 0.5, chaosHoldTime = 0.5, calmThreshold = 0.25, calmHoldTime = 1.5, staleTime = 0.25
 *   chaosKey / calmKey   Tasten simulieren wilde bzw. ruhige Laser (Test ohne Laser)
 *   visible = false (zeichnet Rahmen + Unruhe-Balken), label, normalColor, calmColor, chaosColor
 *   onChaos(meter), onCalm(meter)
 *
 * Getter/Setter: X, Y, Width, Height, Radius (halbe Diagonale, nur lesend sinnvoll), Color, Label.
 * Abfragen: getMotion() (roh, letzter Frame), getChaos(), getCalm(), getCalmProgress() (0..1 bis onCalm),
 *   isChaotic(), hasInput(), getLitPercent(); reset().
 *
 * Beispiel:
 *   const unruhe = guiCalmMeter({ onChaos: () => { score -= 10; shake = 20; } });
 *   unruhe.handle(grid, elapsed);
 *   igel.setColor(unruhe.getChaos() > 0.4 ? warnFarbe : normalFarbe);
 */
import { getGridGeometry, getCellRange, isKeyDown, approach, clamp } from './gridScan.js';
var MasterCanvas = require('../../MasterCanvas').default;
var util = require('../../util.js').default;

export default ({
  label = '',
  posX = 960,
  posY = 540,
  width = 1920,
  height = 1080,
  smoothing = 3,
  minPercent = 0,
  chaosThreshold = 0.5,
  chaosHoldTime = 0.5,
  calmThreshold = 0.25,
  calmHoldTime = 1.5,
  staleTime = 0.25,
  chaosKey,
  calmKey,
  visible = false,
  normalColor = '#0044ff',
  calmColor = '#00bbff',
  chaosColor = '#ff8800',
  onChaos,
  onCalm,
}) => {
  var cx = posX;
  var cy = posY;
  var w = width;
  var h = height;
  var currentColor = normalColor;
  var currentLabel = label;
  var prev = null;
  var prevKey = '';
  var prevLit = 0;
  var motion = 0;
  var chaos = 0;
  var input = false;
  var litPercent = 0;
  var staleTimer = 0;
  var chaosTimer = 0;
  var chaosFired = false;
  var calmTimer = 0;

  function measure(grid) {
    const geo = getGridGeometry(grid);
    const r = getCellRange(geo, cx - w / 2, cy - h / 2, w, h);
    if (!r) return { lit: 0, diff: 0, union: 0, total: 0, fresh: true };
    const cw = r.x1 - r.x0 + 1;
    const n = cw * (r.y1 - r.y0 + 1);
    const key = geo.size + ':' + r.x0 + ':' + r.y0 + ':' + n;
    let fresh = false;
    if (key !== prevKey || !prev || prev.length !== n) {
      prev = new Uint8Array(n);
      prevKey = key;
      prevLit = 0;
      fresh = true;
    }
    let lit = 0;
    let diff = 0;
    let both = 0;
    for (let gy = r.y0; gy <= r.y1; gy++) {
      const row = gy * geo.size;
      const li = (gy - r.y0) * cw - r.x0;
      for (let gx = r.x0; gx <= r.x1; gx++) {
        const cur = grid[gx + row] > 0 ? 1 : 0;
        const i = li + gx;
        const old = prev[i];
        lit += cur;
        if (cur !== old) diff++;
        else if (cur) both++;
        prev[i] = cur;
      }
    }
    const union = lit + prevLit - both;
    prevLit = lit;
    return { lit, diff, union, total: n, fresh };
  }

  function draw() {
    const ctx = MasterCanvas.get2dContext();
    ctx.save();
    ctx.strokeStyle = currentColor;
    ctx.lineWidth = 3;
    ctx.setLineDash([16, 12]);
    ctx.strokeRect(cx - w / 2, cy - h / 2, w, h);
    ctx.setLineDash([]);
    const bw = Math.min(w - 40, 400);
    const bx = cx - bw / 2;
    const by = cy + h / 2 - 50;
    ctx.globalAlpha = 0.3;
    ctx.fillStyle = currentColor;
    ctx.fillRect(bx, by, bw, 24);
    ctx.globalAlpha = 1;
    ctx.fillStyle = chaos > chaosThreshold ? chaosColor : calmColor;
    ctx.fillRect(bx, by, bw * chaos, 24);
    if (calmTimer > 0) {
      ctx.strokeStyle = calmColor;
      ctx.lineWidth = 8;
      ctx.beginPath();
      ctx.arc(cx, cy, 50, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * result.getCalmProgress());
      ctx.stroke();
    }
    ctx.restore();
    if (currentLabel) {
      util.renderText({ ctx, text: currentLabel, x: cx, y: cy - h / 2 + 40, fontSize: '32px', fillStyle: currentColor });
    }
  }

  var result = {
    name: 'GUI calmMeter',
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
      return Math.hypot(w, h) / 2;
    },
    setRadius(v) {
      const f = v / Math.max(1, Math.hypot(w, h) / 2);
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
    getMotion() {
      return motion;
    },
    getChaos() {
      return chaos;
    },
    getCalm() {
      return 1 - chaos;
    },
    getCalmProgress() {
      return clamp(calmTimer / Math.max(0.001, calmHoldTime), 0, 1);
    },
    isChaotic() {
      return chaos > chaosThreshold;
    },
    hasInput() {
      return input;
    },
    getLitPercent() {
      return litPercent;
    },
    reset() {
      prev = null;
      motion = 0;
      chaos = 0;
      chaosTimer = 0;
      chaosFired = false;
      calmTimer = 0;
      staleTimer = 0;
    },
    handle: function (grid, elapsed) {
      const m = measure(grid);
      litPercent = m.total ? (m.lit / m.total) * 100 : 0;
      input = m.lit > 0 && litPercent >= minPercent;
      let update = !m.fresh;
      motion = m.union > 0 ? m.diff / m.union : 0;

      if (update && m.diff === 0 && m.lit > 0) {
        // identisches Kamerabild: kurz überspringen, erst nach staleTime als echte Ruhe werten
        staleTimer += elapsed;
        if (staleTimer < staleTime) update = false;
      } else {
        staleTimer = 0;
      }

      if (isKeyDown(chaosKey)) {
        input = true;
        motion = 1;
        update = true;
      } else if (isKeyDown(calmKey)) {
        input = true;
        motion = 0;
        update = true;
      }

      if (update) chaos = approach(chaos, input ? motion : 0, smoothing, elapsed);

      // Chaos-Auslöser mit Hysterese
      if (chaos > chaosThreshold) {
        chaosTimer += elapsed;
        if (!chaosFired && chaosTimer >= chaosHoldTime) {
          chaosFired = true;
          if (onChaos) onChaos(result);
        }
      } else if (chaos < chaosThreshold * 0.8) {
        chaosTimer = 0;
        chaosFired = false;
      }

      // Ruhe-Auslöser: nur mit Laser
      if (input && chaos < calmThreshold) {
        calmTimer += elapsed;
        if (calmTimer >= calmHoldTime) {
          calmTimer = 0;
          if (onCalm) onCalm(result);
        }
      } else {
        calmTimer = Math.max(0, calmTimer - elapsed * 2);
      }

      if (visible) draw();
    },
  };
  return result;
};
