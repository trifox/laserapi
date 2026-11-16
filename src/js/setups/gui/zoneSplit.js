/**
 * zoneSplit – teilt einen Bereich in Zonen (Spalten × Zeilen) und misst die Laser pro Zone.
 *
 * Pro Zone:
 *   percent – beleuchteter Flächenanteil der Zone (0..100), auflösungsunabhängig
 *   share   – Anteil der Zone an ALLEN Lasern im Bereich (0..1, Summe = 1, 0 wenn keine Laser)
 * Beide Werte werden geglättet (smoothing). Ein einziger Scan pro Frame für alle Zonen.
 *
 * Gedacht für Team-Spiele über Saalbereiche: linke gegen rechte Hälfte (Tauziehen, Kicker),
 * Quadranten als vier Teams, Abstimmen nach Sitzblock, "welche Seite ist lauter".
 * getBalanceX()/getBalanceY() fassen die Verteilung zu einem Wert -1..1 zusammen
 * (z. B. -1 = alle Laser links, +1 = alle rechts) – direkt als Tauzieh-Kraft nutzbar.
 *
 * Optionen:
 *   posX, posY, width, height   Bereich (Mittelpunkt + Grösse, Standard: ganzer Bildschirm)
 *   columns = 2, rows = 1
 *   smoothing = 5 (1/s), minPercent = 0 (darunter zählt eine Zone als leer)
 *   labels = []     Beschriftung je Zone (Index = zeile * columns + spalte)
 *   colors = []     Farbe je Zone (sonst normalColor)
 *   keyCodes = []   solange Taste i gedrückt ist, gilt Zone i als voll beleuchtet (Test ohne Laser)
 *   visible = true (Zonengrenzen + Anteilsbalken), normalColor, lineWidth = 3
 *   onLeaderChange(index, previousIndex, zones)  Zone mit dem grössten Anteil wechselt (-1 = keine)
 *   leaderMargin = 0.05  Hysterese: neue Führung erst, wenn ihr Anteil (0..1) den der bisherigen um so viel übertrifft
 *
 * Getter/Setter: X, Y, Width, Height, Radius (halbe kürzere Seite), Color, Label (Titel).
 * Abfragen: getZoneCount(), getPercent(i), getPercents(), getShare(i), getShares(), getLeader(),
 *   getBalanceX(), getBalanceY(), getZoneRect(i) ({ x, y, width, height }, x/y = linke obere Ecke),
 *   getZoneAt(x, y) (Zone unter einem Punkt oder -1).
 *
 * Beispiel (Tauziehen):
 *   const seiten = guiZoneSplit({ columns: 2, labels: ['TEAM LINKS', 'TEAM RECHTS'], keyCodes: ['KeyA', 'KeyL'] });
 *   seiten.handle(grid, elapsed);
 *   knoten.x += seiten.getBalanceX() * zugKraft * elapsed;
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
  columns = 2,
  rows = 1,
  smoothing = 5,
  minPercent = 0,
  labels = [],
  colors = [],
  keyCodes = [],
  visible = true,
  normalColor = '#0044ff',
  lineWidth = 3,
  onLeaderChange,
  leaderMargin = 0.05,
}) => {
  var cx = posX;
  var cy = posY;
  var w = width;
  var h = height;
  var currentColor = normalColor;
  var currentLabel = label;
  var count = Math.max(1, columns * rows);
  var percents = [];
  var shares = [];
  var leader = -1;
  for (let i = 0; i < count; i++) {
    percents.push(0);
    shares.push(0);
  }

  function zoneRect(i) {
    const zw = w / columns;
    const zh = h / rows;
    const col = i % columns;
    const row = Math.floor(i / columns);
    return { x: cx - w / 2 + col * zw, y: cy - h / 2 + row * zh, width: zw, height: zh };
  }

  function zoneAt(px, py) {
    const lx = px - (cx - w / 2);
    const ly = py - (cy - h / 2);
    if (lx < 0 || ly < 0 || lx >= w || ly >= h) return -1;
    return Math.floor(ly / (h / rows)) * columns + Math.floor(lx / (w / columns));
  }

  function balance(axis) {
    // Mittelwert der Zonenmitten (-1..1), gewichtet mit den Anteilen
    let b = 0;
    shares.forEach((s, i) => {
      const pos = axis === 'x' ? i % columns : Math.floor(i / columns);
      const n = axis === 'x' ? columns : rows;
      const centered = n > 1 ? (pos / (n - 1)) * 2 - 1 : 0;
      b += s * centered;
    });
    return clamp(b, -1, 1);
  }

  function measure(grid, elapsed) {
    const lit = [];
    const total = [];
    for (let i = 0; i < count; i++) {
      lit.push(0);
      total.push(0);
    }
    const geo = getGridGeometry(grid);
    const r = getCellRange(geo, cx - w / 2, cy - h / 2, w, h);
    if (r) {
      for (let gy = r.y0; gy <= r.y1; gy++) {
        const row = gy * geo.size;
        const py = (gy + 0.5) * geo.fy;
        for (let gx = r.x0; gx <= r.x1; gx++) {
          const z = zoneAt((gx + 0.5) * geo.fx, py);
          if (z < 0) continue;
          total[z]++;
          if (grid[gx + row] > 0) lit[z]++;
        }
      }
    }
    const raw = lit.map((l, i) => {
      if (isKeyDown(keyCodes[i])) return 100;
      const p = total[i] ? (l / total[i]) * 100 : 0;
      return p >= minPercent ? p : 0;
    });
    const sum = raw.reduce((a, b) => a + b, 0);
    for (let i = 0; i < count; i++) {
      percents[i] = approach(percents[i], raw[i], smoothing, elapsed);
      shares[i] = approach(shares[i], sum > 0 ? raw[i] / sum : 0, smoothing, elapsed);
    }
    let best = -1;
    shares.forEach((s, i) => {
      if (s > 0.01 && (best < 0 || s > shares[best])) best = i;
    });
    // Hysterese: Ein neuer Führender muss den bisherigen um leaderMargin übertreffen,
    // sonst flackert onLeaderChange bei etwa gleich starken Zonen mehrmals pro Sekunde.
    if (best >= 0 && leader >= 0 && best !== leader && shares[leader] > 0.01 && shares[best] < shares[leader] + leaderMargin) {
      best = leader;
    }
    if (best !== leader) {
      const prevLeader = leader;
      leader = best;
      if (onLeaderChange) onLeaderChange(best, prevLeader, result);
    }
  }

  function draw() {
    const ctx = MasterCanvas.get2dContext();
    ctx.save();
    for (let i = 0; i < count; i++) {
      const z = zoneRect(i);
      const color = colors[i] || currentColor;
      ctx.strokeStyle = color;
      ctx.lineWidth = lineWidth;
      ctx.setLineDash([18, 14]);
      ctx.strokeRect(z.x + 4, z.y + 4, z.width - 8, z.height - 8);
      ctx.setLineDash([]);
      // Anteilsbalken unten in der Zone
      const bw = z.width * 0.6;
      const bx = z.x + (z.width - bw) / 2;
      const by = z.y + z.height - 50;
      ctx.globalAlpha = 0.25;
      ctx.fillStyle = color;
      ctx.fillRect(bx, by, bw, 22);
      ctx.globalAlpha = leader === i ? 1 : 0.7;
      ctx.fillRect(bx, by, bw * shares[i], 22);
      ctx.globalAlpha = 1;
      if (labels[i]) {
        util.renderText({ ctx, text: labels[i], x: z.x + z.width / 2, y: z.y + 50, fontSize: '36px', fillStyle: color });
      }
      util.renderText({ ctx, text: Math.round(shares[i] * 100) + '%', x: z.x + z.width / 2, y: by - 12, fontSize: '30px', fillStyle: color });
    }
    ctx.restore();
    if (currentLabel) util.renderText({ ctx, text: currentLabel, x: cx, y: cy - h / 2 + 50, fontSize: '40px', fillStyle: currentColor });
  }

  var result = {
    name: 'GUI zoneSplit',
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
    getZoneCount() {
      return count;
    },
    getPercent(i) {
      return percents[i] || 0;
    },
    getPercents() {
      return percents.slice();
    },
    getShare(i) {
      return shares[i] || 0;
    },
    getShares() {
      return shares.slice();
    },
    getLeader() {
      return leader;
    },
    getBalanceX() {
      return balance('x');
    },
    getBalanceY() {
      return balance('y');
    },
    getZoneRect(i) {
      return zoneRect(i);
    },
    getZoneAt(px, py) {
      return zoneAt(px, py);
    },
    handle: function (grid, elapsed) {
      measure(grid, elapsed);
      if (visible) draw();
    },
  };
  return result;
};
