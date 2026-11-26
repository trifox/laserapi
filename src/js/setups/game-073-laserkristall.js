/**
 * Laserkristall – „Points connect“: Aus einem Foto aller Laserpunkte wächst ein Kristallnetz (Spielidee: Georg)
 *
 * Eine Chill-Kunstmaschine ohne Ziel, ohne Level und ohne Highscore (bewusste Entscheidung).
 *
 * Ablauf:
 * - Unten rechts liegt der FOTO-Knopf (gui/fillButton). Füllen → Countdown 3 – 2 – 1 – „Cheese!“.
 *   Während des Countdowns platzieren alle ihre Laser; jeder Punkt wird live mit einem Ring markiert
 *   (gui/blobTracker findet die einzelnen Laserflecken).
 * - Blitz! Das Foto hält alle Laserpunkte fest (dazu die vier Bildecken als Rahmen).
 * - Daraus wird ein Dreiecksnetz (Delaunay, Bowyer-Watson): Die Kanten wachsen Strich für Strich vom ersten Punkt
 *   aus, wie beim Punkte-Verbinden, dann füllen sich die Flächen mit schimmernden Farbverläufen. Große Dreiecke
 *   bekommen eine fraktale Sierpinski-Unterteilung, die Punkte atmen leicht.
 * - Das Bild bleibt stehen, bis jemand das nächste Foto auslöst.
 * - Während des Countdowns wird das alte Bild abgedunkelt, damit die Kamera die Laser sauber erkennt.
 *
 * Tastatur (ohne Laser): Leertaste = Foto-Countdown, Enter = Zufallsfoto (sofort), B gedrückt halten = drei
 * kreisende Test-Laser (blobTracker-Testmodus).
 *
 * Vorbilder: Connect-the-dots / Malen nach Zahlen, Mystify (Windows-3.1-Bildschirmschoner 1992), Deluxe Paint
 * (Amiga 1985), Chaos-Game aus Barnsleys „Fractals Everywhere“ (1988). Im Repo neu – blobTracker wird sonst
 * für Steuerung genutzt (Hydra, Horde 2, Fraktal-Spiele 064–068), hier als Kamera-Auslöser.
 *
 * Erstellt mit Claude Opus 5.5 (claude-opus-5-5) über die Skills laser-chris → new-laser-game.
 * Prompt (Kern): "noch ein weiteres Chill-Spiel ohne Highscore. Points connect: Es wird ein Foto aller Laserpunkte
 * genommen und daraus etwas gezeichnet, wie bei den Kinderspielen, wo man die Punkte verbinden muss." + Auswahl:
 * Chill-Kunstmaschine, Kristallnetz, Countdown-Knopf, Bild bleibt stehen.
 */
import util, { getRgbSpreadHex } from '../util.js';
import { createKeyEdge } from './gui/gridScan.js';
import soundTick from '../../../public/media/opengameart/Menu Selection Click.wav';
import soundShutter from '../../../public/media/opengameart/Menu Confirm.ogg';
import soundGrow from '../../../public/media/opengameart/Ability Learn.ogg';
var laserConfig = require('../LaserApiConfig.js').default;
var MasterCanvas = require('../MasterCanvas').default;
var guiFillButton = require('./gui/fillButton').default;
var guiBlobTracker = require('./gui/blobTracker').default;

const W = 1920;
const H = 1080;

const SETTINGS = {
  button: { x: W - 110, y: H - 110, radius: 75 },
  countdown: 3, // Sekunden
  cheeseTime: 0.5, // "Cheese!" vor dem Blitz
  flashTime: 0.6,
  edgeGrowTime: 3.0, // s bis alle Kanten gezeichnet sind
  faceFadeTime: 2.0, // s bis alle Flächen da sind
  minPointDistance: 35, // näher liegende Fotopunkte werden zusammengefasst
  randomPhotoPoints: 22, // Enter = Zufallsfoto
  breathe: 6, // px, wie stark die Punkte atmen
  sierpinskiArea: 40000, // ab dieser Dreiecksfläche (px²) fraktale Unterteilung
  sierpinskiDepth: 2,
  dimDuringCountdown: 0.12,
};

// Zustand (so vorbelegt, dass handle() auch ohne init() läuft)
let mode = 'idle'; // 'idle' | 'countdown' | 'flash' | 'build' | 'show'
let modeTimer = 0;
let picture = null; // { points, edges, triangles, number }
let pictureAlpha = 1;
let photoCount = 0;
let lastCount = -1;
let tracker = null;
let button = null;
let time = 0;
let palCache = null;
let palKey = '';
const keyEdge = createKeyEdge();

// ---------- Hilfen ----------

function play(snd, volume = 0.35) {
  try {
    const a = new Audio(snd);
    a.volume = volume;
    a.play().catch(() => {});
  } catch (e) {}
}

function pal() {
  const tc = laserConfig.testColor;
  const key = tc.join(',');
  if (key !== palKey) {
    palKey = key;
    palCache = {
      face: Array.from({ length: 32 }, (_, i) => getRgbSpreadHex(tc, 0.27 + (0.46 * i) / 31, 0.65, 0.85)),
      edge: getRgbSpreadHex(tc, 0.55, 0.35, 1),
      point: getRgbSpreadHex(tc, 0.65, 0.5, 1),
      live: getRgbSpreadHex(tc, 0.4, 0.8, 1),
      hud: getRgbSpreadHex(tc, 0.5, 0.35, 0.9),
      button: getRgbSpreadHex(tc, 0.5, 0.5, 0.4),
      flash: getRgbSpreadHex(tc, 0.5, 0.15, 1),
    };
  }
  return palCache;
}

function nearButton(x, y) {
  const b = SETTINGS.button;
  return Math.hypot(x - b.x, y - b.y) < b.radius * 1.6;
}

// ---------- Delaunay-Triangulation (Bowyer-Watson) ----------

function circumcircle(p, a, b, c) {
  const A = p[a];
  const B = p[b];
  const C = p[c];
  const d = 2 * (A.x * (B.y - C.y) + B.x * (C.y - A.y) + C.x * (A.y - B.y));
  if (Math.abs(d) < 1e-9) return { x: 0, y: 0, r2: Infinity };
  const a2 = A.x * A.x + A.y * A.y;
  const b2 = B.x * B.x + B.y * B.y;
  const c2 = C.x * C.x + C.y * C.y;
  const x = (a2 * (B.y - C.y) + b2 * (C.y - A.y) + c2 * (A.y - B.y)) / d;
  const y = (a2 * (C.x - B.x) + b2 * (A.x - C.x) + c2 * (B.x - A.x)) / d;
  return { x, y, r2: (A.x - x) ** 2 + (A.y - y) ** 2 };
}

/** liefert Dreiecke als Index-Tripel [a, b, c] in points */
function delaunay(points) {
  const p = points.slice();
  const n = p.length;
  // Super-Dreieck, das alles umschließt
  const M = 10000; // sehr groß, sonst fehlen am Rand Dreiecke
  p.push({ x: -M * W, y: -M * H }, { x: M * W, y: -M * H }, { x: W / 2, y: M * H });
  let tris = [{ v: [n, n + 1, n + 2], cc: circumcircle(p, n, n + 1, n + 2) }];
  for (let i = 0; i < n; i++) {
    const pt = p[i];
    const bad = [];
    const keep = [];
    tris.forEach((t) => ((pt.x - t.cc.x) ** 2 + (pt.y - t.cc.y) ** 2 < t.cc.r2 ? bad : keep).push(t));
    // Rand des Lochs = Kanten, die nur in einem schlechten Dreieck vorkommen
    const edgeCount = new Map();
    bad.forEach((t) => {
      for (let k = 0; k < 3; k++) {
        const a = t.v[k];
        const b = t.v[(k + 1) % 3];
        const key = a < b ? `${a},${b}` : `${b},${a}`;
        edgeCount.set(key, (edgeCount.get(key) || 0) + 1);
      }
    });
    tris = keep;
    edgeCount.forEach((count, key) => {
      if (count !== 1) return;
      const [a, b] = key.split(',').map(Number);
      tris.push({ v: [a, b, i], cc: circumcircle(p, a, b, i) });
    });
  }
  return tris.filter((t) => t.v.every((v) => v < n)).map((t) => t.v);
}

// ---------- Foto → Bild ----------

function makePicture(rawPoints) {
  // nahe Punkte zusammenfassen
  const pts = [];
  rawPoints.forEach((q) => {
    if (!pts.some((o) => Math.hypot(o.x - q.x, o.y - q.y) < SETTINGS.minPointDistance)) pts.push({ x: q.x, y: q.y });
  });
  const laserCount = pts.length;
  // Rahmen: vier Ecken + Kantenmitten, damit das Netz das ganze Bild füllt
  [[0, 0], [W, 0], [W, H], [0, H], [W / 2, 0], [W / 2, H], [0, H / 2], [W, H / 2]].forEach(([x, y]) => pts.push({ x, y, frame: true }));
  pts.forEach((q, i) => {
    q.phase = Math.random() * Math.PI * 2;
    q.order = i;
  });
  const triangles = delaunay(pts);
  // Kanten eindeutig sammeln, sortiert nach Abstand vom ersten Laserpunkt (Wachstum von dort aus)
  const start = laserCount ? pts[0] : { x: W / 2, y: H / 2 };
  const edgeMap = new Map();
  triangles.forEach((t) => {
    for (let k = 0; k < 3; k++) {
      const a = t[k];
      const b = t[(k + 1) % 3];
      const key = a < b ? `${a},${b}` : `${b},${a}`;
      if (edgeMap.has(key)) continue;
      const mx = (pts[a].x + pts[b].x) / 2;
      const my = (pts[a].y + pts[b].y) / 2;
      edgeMap.set(key, { a, b, dist: Math.hypot(mx - start.x, my - start.y) });
    }
  });
  const edges = Array.from(edgeMap.values()).sort((e1, e2) => e1.dist - e2.dist);
  const maxDist = edges.length ? edges[edges.length - 1].dist || 1 : 1;
  edges.forEach((e) => (e.delay = (e.dist / maxDist) * SETTINGS.edgeGrowTime));
  const tris = triangles.map((t) => {
    const cx = (pts[t[0]].x + pts[t[1]].x + pts[t[2]].x) / 3;
    const cy = (pts[t[0]].y + pts[t[1]].y + pts[t[2]].y) / 3;
    const area = Math.abs((pts[t[1]].x - pts[t[0]].x) * (pts[t[2]].y - pts[t[0]].y) - (pts[t[2]].x - pts[t[0]].x) * (pts[t[1]].y - pts[t[0]].y)) / 2;
    return {
      v: t,
      cx,
      cy,
      area,
      color: Math.floor(((cx / W) * 0.6 + (cy / H) * 0.4) * 31),
      delay: SETTINGS.edgeGrowTime * 0.6 + (Math.hypot(cx - start.x, cy - start.y) / maxDist) * SETTINGS.faceFadeTime,
      phase: Math.random() * Math.PI * 2,
    };
  });
  photoCount++;
  return { points: pts, edges, triangles: tris, laserCount, number: photoCount, age: 0 };
}

function takePhoto(points) {
  picture = makePicture(points);
  pictureAlpha = 1;
  mode = 'build';
  modeTimer = 0;
  play(soundGrow, 0.3);
}

// ---------- Zeichnen ----------

function pointPos(q) {
  if (q.frame) return q;
  return { x: q.x + Math.sin(time * 0.7 + q.phase) * SETTINGS.breathe, y: q.y + Math.cos(time * 0.6 + q.phase) * SETTINGS.breathe };
}

function sierpinski(ctx, a, b, c, depth) {
  if (depth <= 0) return;
  const ab = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
  const bc = { x: (b.x + c.x) / 2, y: (b.y + c.y) / 2 };
  const ca = { x: (c.x + a.x) / 2, y: (c.y + a.y) / 2 };
  ctx.moveTo(ab.x, ab.y);
  ctx.lineTo(bc.x, bc.y);
  ctx.lineTo(ca.x, ca.y);
  ctx.closePath();
  sierpinski(ctx, a, ab, ca, depth - 1);
  sierpinski(ctx, ab, b, bc, depth - 1);
  sierpinski(ctx, ca, bc, c, depth - 1);
}

function drawPicture(ctx, alpha) {
  if (!picture || alpha <= 0.01) return;
  const P = pal();
  const t = picture.age;
  const pos = picture.points.map(pointPos);
  ctx.save();
  // Flächen
  picture.triangles.forEach((tri) => {
    const f = Math.max(0, Math.min(1, (t - tri.delay) / 0.8));
    if (f <= 0) return;
    const [a, b, c] = tri.v.map((i) => pos[i]);
    const shimmer = 0.5 + 0.5 * Math.sin(time * 1.3 + tri.phase + tri.cx * 0.004);
    ctx.globalAlpha = alpha * f * (0.18 + 0.22 * shimmer);
    ctx.fillStyle = P.face[(tri.color + Math.floor(time * 2)) % P.face.length];
    ctx.beginPath();
    ctx.moveTo(a.x, a.y);
    ctx.lineTo(b.x, b.y);
    ctx.lineTo(c.x, c.y);
    ctx.closePath();
    ctx.fill();
    if (tri.area > SETTINGS.sierpinskiArea) {
      ctx.globalAlpha = alpha * f * 0.25;
      ctx.strokeStyle = P.face[(tri.color + 8) % P.face.length];
      ctx.lineWidth = 1;
      ctx.beginPath();
      sierpinski(ctx, a, b, c, SETTINGS.sierpinskiDepth);
      ctx.stroke();
    }
  });
  // Kanten wachsen Strich für Strich
  ctx.strokeStyle = P.edge;
  ctx.lineWidth = 2.5;
  ctx.lineCap = 'round';
  ctx.shadowColor = P.edge;
  ctx.shadowBlur = 10;
  picture.edges.forEach((e) => {
    const g = Math.max(0, Math.min(1, (t - e.delay) / 0.35));
    if (g <= 0) return;
    const a = pos[e.a];
    const b = pos[e.b];
    ctx.globalAlpha = alpha * 0.8;
    ctx.beginPath();
    ctx.moveTo(a.x, a.y);
    ctx.lineTo(a.x + (b.x - a.x) * g, a.y + (b.y - a.y) * g);
    ctx.stroke();
  });
  // Punkte
  ctx.shadowBlur = 18;
  ctx.fillStyle = P.point;
  picture.points.forEach((q, i) => {
    if (q.frame) return;
    const pop = Math.max(0, Math.min(1, t * 3 - i * 0.05));
    if (pop <= 0) return;
    ctx.globalAlpha = alpha;
    ctx.beginPath();
    ctx.arc(pos[i].x, pos[i].y, 5 + 4 * pop + Math.sin(time * 3 + q.phase), 0, Math.PI * 2);
    ctx.fill();
  });
  ctx.restore();
  if (t > SETTINGS.edgeGrowTime + SETTINGS.faceFadeTime) {
    util.renderText({
      ctx,
      text: `Kristall #${picture.number} · ${picture.laserCount} Punkte`,
      x: 30,
      y: H - 30,
      fontSize: '30px',
      fillStyle: P.hud,
      align: 'left',
    });
  }
}

function drawLiveBlobs(ctx, strong) {
  const P = pal();
  ctx.save();
  ctx.strokeStyle = P.live;
  ctx.lineWidth = strong ? 4 : 2;
  tracker.getBlobs().forEach((b) => {
    if (nearButton(b.x, b.y)) return;
    ctx.globalAlpha = strong ? 0.9 : 0.35;
    ctx.beginPath();
    ctx.arc(b.x, b.y, 28 + Math.sin(time * 6 + b.id) * 4, 0, Math.PI * 2);
    ctx.stroke();
  });
  ctx.restore();
}

// ---------- Ablauf ----------

function startCountdown() {
  if (mode === 'countdown' || mode === 'flash') return;
  mode = 'countdown';
  modeTimer = 0;
  lastCount = -1;
}

function snapshotPoints() {
  return tracker.getBlobs().filter((b) => !nearButton(b.x, b.y)).map((b) => ({ x: b.x, y: b.y }));
}

function randomPoints() {
  return Array.from({ length: SETTINGS.randomPhotoPoints }, () => ({ x: 80 + Math.random() * (W - 160), y: 80 + Math.random() * (H - 160) }));
}

function createParts() {
  const P = pal();
  tracker = guiBlobTracker({ minCells: 1, mergeDistance: 30, maxBlobs: 64, testKey: 'KeyB', visible: false });
  button = guiFillButton({
    label: 'FOTO',
    posX: SETTINGS.button.x,
    posY: SETTINGS.button.y,
    radius: SETTINGS.button.radius,
    edges: 6,
    speedUp: 70,
    speedDown: 35,
    counterReset: true,
    lineWidth: 4,
    normalColor: P.button,
    growColor: P.live,
    activeColor: P.point,
    onEnterActive: () => startCountdown(),
  });
}

export default {
  name: 'Laserkristall',
  description: `Laserkristall – Punkte verbinden mit Lasern. Kein Ziel, nur schöne Bilder.
Den FOTO-Knopf unten rechts füllen: Countdown 3 – 2 – 1 – Cheese!
Bis dahin verteilt ihr eure Laserpunkte auf der Leinwand – jeder Punkt bekommt einen Ring.
Blitz! Aus euren Punkten wächst ein schimmerndes Kristallnetz, Strich für Strich.
Das Bild bleibt stehen, bis ihr das nächste Foto macht.`,
  image: 'media/img/gametitles/laser-mandelbrot-###4###.png',
  init() {
    mode = 'idle';
    modeTimer = 0;
    picture = null;
    pictureAlpha = 1;
    photoCount = 0;
    createParts();
  },
  handle(grid, elapsed) {
    const dt = Math.min(elapsed, 0.1);
    const ctx = MasterCanvas.get2dContext();
    const P = pal();
    time += dt;
    modeTimer += dt;
    if (!tracker) createParts();
    tracker.handle(grid, dt);
    if (picture) picture.age += dt;

    if (keyEdge('Space')) startCountdown();
    if (keyEdge('Enter')) takePhoto(randomPoints());

    if (mode === 'countdown') {
      pictureAlpha += (SETTINGS.dimDuringCountdown - pictureAlpha) * Math.min(1, dt * 4);
      drawPicture(ctx, pictureAlpha);
      drawLiveBlobs(ctx, true);
      const left = SETTINGS.countdown - modeTimer;
      const count = Math.ceil(left);
      if (count !== lastCount && count > 0) {
        lastCount = count;
        play(soundTick, 0.4);
      }
      const text = left > 0 ? `${count}` : 'Cheese!';
      const scale = left > 0 ? 1 + (count - left) * 0.6 : 1;
      ctx.save();
      ctx.globalAlpha = 0.5; // Ziffern nur halbhell – die Leinwand ist gerade Aktionsbereich
      util.renderText({ ctx, text, x: W / 2, y: H / 2 + 50, fontSize: `${Math.round(150 * scale)}px`, fillStyle: P.hud });
      ctx.restore();
      util.renderText({ ctx, text: `${snapshotPoints().length} Punkte`, x: W / 2, y: H - 60, fontSize: '40px', fillStyle: P.live });
      if (left <= -SETTINGS.cheeseTime) {
        const pts = snapshotPoints();
        mode = 'flash';
        modeTimer = 0;
        play(soundShutter, 0.5);
        takePhoto(pts);
        mode = 'flash';
      }
    } else {
      pictureAlpha += (1 - pictureAlpha) * Math.min(1, dt * 3);
      drawPicture(ctx, pictureAlpha);
      if (mode === 'flash' && modeTimer >= SETTINGS.flashTime) mode = 'build';
      if (mode === 'build' && picture && picture.age > SETTINGS.edgeGrowTime + SETTINGS.faceFadeTime + 1) mode = 'show';
      if (!picture) {
        drawLiveBlobs(ctx, false);
        util.renderText({ ctx, text: 'LASERKRISTALL', x: W / 2, y: 380, fontSize: '150px', fillStyle: P.hud });
        util.renderText({
          ctx,
          text: `FOTO-Knopf unten rechts füllen – dann verteilt eure Laser.\n3 – 2 – 1 – Cheese! Aus euren Punkten wächst ein Kristall.`,
          x: W / 2,
          y: 500,
          fontSize: '42px',
          lineHeight: 64,
          fillStyle: P.hud,
        });
      }
    }

    if (mode === 'flash') {
      ctx.save();
      ctx.globalAlpha = Math.max(0, 1 - modeTimer / SETTINGS.flashTime) * 0.7;
      ctx.fillStyle = P.flash;
      ctx.fillRect(0, 0, W, H);
      ctx.restore();
    }

    // Knopf auf dunklem Grund (Aktionsbereich frei von Bildlicht)
    ctx.save();
    ctx.fillStyle = 'rgba(0,0,0,0.85)';
    ctx.beginPath();
    ctx.arc(SETTINGS.button.x, SETTINGS.button.y, SETTINGS.button.radius * 1.35, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
    button.handle(grid, dt);
  },
  stop() {
    mode = 'idle';
  },
};
