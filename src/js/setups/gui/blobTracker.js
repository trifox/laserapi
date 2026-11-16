/**
 * blobTracker – findet einzelne Laserflecken (Blobs) in einem Bereich und verfolgt sie über die Zeit.
 *
 * Zusammenhängende leuchtende Grid-Zellen bilden einen Blob (8er-Nachbarschaft, mit diagonal = false 4er).
 * Jeder Blob bekommt eine stabile id, solange er sich von Frame zu Frame nicht weiter als maxMatchDistance
 * bewegt. Kurzes Flackern (bis keepTime Sekunden) wird überbrückt.
 *
 * Damit lassen sich Dinge bauen, die mit Schwerpunkt-Komponenten nicht gehen:
 * "jeder Laser steuert eine eigene Figur", Laser zählen (Mitspieler schätzen), Laser-Paare, Kollisionen
 * zwischen Lasern und Objekten an vielen Stellen gleichzeitig.
 * Hinweis: Zwei Laser, die sich berühren, verschmelzen zu einem Blob (mergeDistance verstärkt das gezielt).
 *
 * Optionen:
 *   posX, posY, width, height   Suchbereich (Mittelpunkt + Grösse, Standard: ganzer Bildschirm)
 *   minCells = 1     kleinere Blobs werden ignoriert (Rauschfilter, in Grid-Zellen)
 *   diagonal = true  diagonale Nachbarn gehören zum selben Blob
 *   mergeDistance = 0  Blobs, deren Mittelpunkte näher sind (Pixel), werden zusammengelegt
 *   maxMatchDistance = 200, keepTime = 0.25, smoothing = 15 (1/s), maxBlobs = 64 (die grössten zählen)
 *   testKey          solange gedrückt, kreisen drei Test-Blobs im Bereich (Test ohne Laser)
 *   visible = false (zeichnet Bereich + Blobs mit id), label, normalColor, blobColor
 *   onBlobEnter(blob, tracker), onBlobLeave(blob, tracker)
 *
 * Blob-Objekt (nur lesen!): { id, x, y (geglättet), rawX, rawY, vx, vy (px/s), size (Zellen),
 *   percent (Anteil am Suchbereich), radius (geschätzt, px), age (s), lost (s seit letzter Sichtung) }
 *
 * Getter/Setter: X, Y, Width, Height, Radius (halbe kürzere Seite), Color, Label.
 * Abfragen: getBlobs() (sichtbare Blobs), getAllBlobs() (inkl. kurz verlorener), getCount(), getBlob(id),
 *   getNearest(x, y, maxDist = Infinity) (nächster sichtbarer Blob oder null), reset().
 *
 * Leistung: eine Flutfüllung über den Suchbereich pro Frame – Bereich so klein wie nötig wählen.
 *
 * Beispiel:
 *   const laser = guiBlobTracker({
 *     onBlobEnter: (b) => { figuren[b.id] = neueFigur(b.x, b.y); },
 *     onBlobLeave: (b) => { delete figuren[b.id]; },
 *   });
 *   laser.handle(grid, elapsed);
 *   laser.getBlobs().forEach((b) => figuren[b.id].zieheZu(b.x, b.y));
 */
import { getGridGeometry, getCellRange, isKeyDown, approach } from './gridScan.js';
var MasterCanvas = require('../../MasterCanvas').default;
var util = require('../../util.js').default;

export default ({
  label = '',
  posX = 960,
  posY = 540,
  width = 1920,
  height = 1080,
  minCells = 1,
  diagonal = true,
  mergeDistance = 0,
  maxMatchDistance = 200,
  keepTime = 0.25,
  smoothing = 15,
  maxBlobs = 64,
  testKey,
  visible = false,
  normalColor = '#0044ff',
  blobColor = '#00bbff',
  onBlobEnter,
  onBlobLeave,
}) => {
  var cx = posX;
  var cy = posY;
  var w = width;
  var h = height;
  var currentColor = normalColor;
  var currentLabel = label;
  var labels = null;
  var stack = [];
  var tracked = [];
  var nextId = 1;
  var clock = 0;

  function findBlobs(grid) {
    const geo = getGridGeometry(grid);
    const r = getCellRange(geo, cx - w / 2, cy - h / 2, w, h);
    const raw = [];
    if (!r) return { raw, totalCells: 0, geo };
    const cw = r.x1 - r.x0 + 1;
    const ch = r.y1 - r.y0 + 1;
    const n = cw * ch;
    if (!labels || labels.length < n) labels = new Int32Array(n);
    else labels.fill(0, 0, n);
    let mark = 0;
    for (let ly = 0; ly < ch; ly++) {
      for (let lx = 0; lx < cw; lx++) {
        const li = lx + ly * cw;
        if (labels[li] || !(grid[r.x0 + lx + (r.y0 + ly) * geo.size] > 0)) continue;
        mark++;
        labels[li] = mark;
        stack.length = 0;
        stack.push(li);
        let count = 0;
        let sx = 0;
        let sy = 0;
        while (stack.length) {
          const c = stack.pop();
          const x = c % cw;
          const y = (c - x) / cw;
          count++;
          sx += (r.x0 + x + 0.5) * geo.fx;
          sy += (r.y0 + y + 0.5) * geo.fy;
          for (let dy = -1; dy <= 1; dy++) {
            for (let dx = -1; dx <= 1; dx++) {
              if ((dx === 0 && dy === 0) || (!diagonal && dx !== 0 && dy !== 0)) continue;
              const nx = x + dx;
              const ny = y + dy;
              if (nx < 0 || ny < 0 || nx >= cw || ny >= ch) continue;
              const ni = nx + ny * cw;
              if (labels[ni]) continue;
              if (grid[r.x0 + nx + (r.y0 + ny) * geo.size] > 0) {
                labels[ni] = mark;
                stack.push(ni);
              }
            }
          }
        }
        if (count >= minCells) raw.push({ x: sx / count, y: sy / count, size: count });
      }
    }
    return { raw, totalCells: n, geo };
  }

  function mergeClose(raw) {
    // Grösste zuerst; bei sehr vielen Rausch-Flecken nur die grössten berücksichtigen (Performance-Deckel).
    raw.sort((a, b) => b.size - a.size);
    if (raw.length > maxBlobs * 4) raw.length = maxBlobs * 4;
    if (mergeDistance <= 0) return raw;
    // Ein Durchlauf (O(n·k) statt vorher bis O(n³)): jeder Fleck wandert in den ersten nahen Cluster,
    // sonst bildet er einen neuen.
    const out = [];
    raw.forEach((b) => {
      for (let i = 0; i < out.length; i++) {
        const a = out[i];
        if (Math.hypot(a.x - b.x, a.y - b.y) < mergeDistance) {
          const size = a.size + b.size;
          out[i] = { x: (a.x * a.size + b.x * b.size) / size, y: (a.y * a.size + b.y * b.size) / size, size };
          return;
        }
      }
      out.push({ x: b.x, y: b.y, size: b.size });
    });
    return out;
  }

  function track(raw, totalCells, geo, elapsed) {
    raw.sort((a, b) => b.size - a.size);
    if (raw.length > maxBlobs) raw.length = maxBlobs;
    const used = {};
    const cellArea = geo.fx * geo.fy;
    raw.forEach((rb) => {
      let best = null;
      let bestD = maxMatchDistance;
      tracked.forEach((t) => {
        if (used[t.id]) return;
        const d = Math.hypot(t.rawX - rb.x, t.rawY - rb.y);
        if (d <= bestD) {
          bestD = d;
          best = t;
        }
      });
      const percent = totalCells ? (rb.size / totalCells) * 100 : 0;
      const radius = Math.sqrt((rb.size * cellArea) / Math.PI);
      if (best) {
        used[best.id] = true;
        const nx = approach(best.x, rb.x, smoothing, elapsed);
        const ny = approach(best.y, rb.y, smoothing, elapsed);
        if (elapsed > 0) {
          best.vx = approach(best.vx, (nx - best.x) / elapsed, 8, elapsed);
          best.vy = approach(best.vy, (ny - best.y) / elapsed, 8, elapsed);
        }
        best.x = nx;
        best.y = ny;
        best.rawX = rb.x;
        best.rawY = rb.y;
        best.size = rb.size;
        best.percent = percent;
        best.radius = radius;
        best.age += elapsed;
        best.lost = 0;
      } else {
        const blob = { id: nextId++, x: rb.x, y: rb.y, rawX: rb.x, rawY: rb.y, vx: 0, vy: 0, size: rb.size, percent, radius, age: 0, lost: 0 };
        used[blob.id] = true;
        tracked.push(blob);
        if (onBlobEnter) onBlobEnter(blob, result);
      }
    });
    tracked.slice().forEach((t) => {
      if (used[t.id]) return;
      t.lost += elapsed;
      t.age += elapsed;
      if (t.lost > keepTime) {
        tracked.splice(tracked.indexOf(t), 1);
        if (onBlobLeave) onBlobLeave(t, result);
      }
    });
  }

  function draw() {
    const ctx = MasterCanvas.get2dContext();
    ctx.save();
    ctx.strokeStyle = currentColor;
    ctx.lineWidth = 3;
    ctx.setLineDash([16, 12]);
    ctx.strokeRect(cx - w / 2, cy - h / 2, w, h);
    ctx.setLineDash([]);
    ctx.strokeStyle = blobColor;
    ctx.lineWidth = 4;
    tracked.forEach((b) => {
      if (b.lost > 0) return;
      ctx.beginPath();
      ctx.arc(b.x, b.y, Math.max(25, b.radius + 15), 0, Math.PI * 2);
      ctx.stroke();
      util.renderText({ ctx, text: String(b.id), x: b.x, y: b.y - Math.max(25, b.radius + 15) - 8, fontSize: '26px', fillStyle: blobColor });
    });
    ctx.restore();
    if (currentLabel) {
      util.renderText({ ctx, text: currentLabel, x: cx, y: cy - h / 2 + 40, fontSize: '32px', fillStyle: currentColor });
    }
  }

  var result = {
    name: 'GUI blobTracker',
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
    getBlobs() {
      return tracked.filter((b) => b.lost === 0);
    },
    getAllBlobs() {
      return tracked.slice();
    },
    getCount() {
      return tracked.filter((b) => b.lost === 0).length;
    },
    getBlob(id) {
      return tracked.find((b) => b.id === id) || null;
    },
    getNearest(x, y, maxDist) {
      let best = null;
      let bestD = maxDist === undefined ? Infinity : maxDist;
      tracked.forEach((b) => {
        if (b.lost > 0) return;
        const d = Math.hypot(b.x - x, b.y - y);
        if (d <= bestD) {
          bestD = d;
          best = b;
        }
      });
      return best;
    },
    reset() {
      tracked.slice().forEach((t) => {
        if (onBlobLeave) onBlobLeave(t, result);
      });
      tracked = [];
    },
    handle: function (grid, elapsed) {
      clock += elapsed;
      const found = findBlobs(grid);
      let raw = mergeClose(found.raw);
      if (isKeyDown(testKey)) {
        const rr = Math.min(w, h) * 0.3;
        for (let i = 0; i < 3; i++) {
          const a = clock * (0.8 + i * 0.3) + (i * Math.PI * 2) / 3;
          raw.push({ x: cx + Math.cos(a) * rr, y: cy + Math.sin(a) * rr, size: 4 });
        }
      }
      track(raw, found.totalCells, found.geo, elapsed);
      if (visible) draw();
    },
  };
  return result;
};
