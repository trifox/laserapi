/**
 * Farbenturm – Farbsteine verkleben, größter Klumpen gewinnt (Spielidee: Georg)
 *
 * Regeln:
 * - Zwei Teams nach Saalhälfte: LINKS gegen RECHTS (gestrichelte Mittellinie).
 * - In den vier Ecken entstehen Steine (Laser auf die Ecke halten, gui/pixelFillButton). Jede Ecke hat eine Farbe
 *   und eine Form: A ● · B ▲ · C ■ · D ◆. Links liegen A und C, rechts B und D.
 * - KLEBEN: Nur NACHBARN im Farbkreis kleben aneinander: A–B, B–C, C–D, D–A (Legende oben in der Mitte).
 *   A und C kleben nicht – jedes Team braucht also Steine von der anderen Seite.
 *   Gleiche Farben und Gegenüber prallen voneinander ab. Geklebtes lässt sich NIE wieder trennen.
 * - ZIEHEN: Stein anleuchten, bis sein Ring voll ist (gui/dragHandle) → er folgt dem Laser. Ein Klumpen aus 2–3
 *   Steinen wird als Ganzes gezogen, ist aber schwerer zu greifen (mehr Laser!). Auch Klumpen des Gegners
 *   kann man wegziehen – Klauen ist erlaubt.
 * - VERANKERN: Ab 4 Steinen ist ein Klumpen fest und unbeweglich. Er zählt für die Hälfte, in der er festwurde,
 *   und kann weiter wachsen.
 * - RUNDE: Nach Ablauf der Zeit gewinnt die Hälfte mit dem größten verankerten Klumpen.
 *   3 Runden: Ab Runde 2 treiben graue Störsteine übers Feld (kleben nie, schubsen alles weg), in Runde 3 mehr.
 * - Highscore (util/highscore.js, Sortierfeld 'groesster'): größter Klumpen der Partie.
 *
 * Tastatur (ohne Laser): Leertaste = Start/Weiter, 1–4 = Stein aus Ecke A–D, Pfeiltasten = Cursor,
 * Enter = Stein/Klumpen am Cursor greifen bzw. ablegen.
 *
 * Vorbilder: Atomix (Amiga/C64 1990, Bindungen nur in passender Richtung), Columns (1990, Farbfolgen),
 * Puyo Puyo (1991, Farben kleben). Im Repo ähnlich: game-072-alphabet (Spawner am Rand, Greifen, Kreisphysik,
 * Kleben) – hier kommt die Farbregel, das Verankern und der Team-Wettbewerb dazu.
 *
 * Erstellt mit Claude Opus 5.5 (claude-opus-5-5) über die Skills laser-chris → laser-georg → new-laser-game.
 * Prompt (Kern): "Farbenturm – In den Ecken kann man Kästchen oder Steine spawnen. Jede Ecke in einer anderen Farbe.
 * Die Steine können aneinander kleben, abhängig von der Farbe. Es klebt nur eine bestimmte Farbfolge. Steine, die
 * einmal kleben, können nicht getrennt werden. Kleben mehr als drei Steine aneinander, können sie nicht mehr bewegt
 * werden." + Auswahl: Team-Wettbau größter Klumpen, Draufsicht schwebend, Nachbarn im Farbkreis, Bildschirmhälften.
 */
import util, { getRgbSpreadHex } from '../util.js';
import { createKeyEdge, isKeyDown } from './gui/gridScan.js';
import soundPlop from '../../../public/media/369952__mischy__plop-1.wav';
import soundGlue from '../../../public/media/opengameart/Menu Selection Click.wav';
import soundAnchor from '../../../public/media/517267__foolboymedia__cinematic-stomp.wav';
import soundRound from '../../../public/media/opengameart/Level Up.ogg';
import soundGameOver from '../../../public/media/opengameart/Ability Learn.ogg';
var laserConfig = require('../LaserApiConfig.js').default;
var MasterCanvas = require('../MasterCanvas').default;
var guiFillButton = require('./gui/fillButton').default;
var guiPixelFillButton = require('./gui/pixelFillButton').default;
var guiDragHandle = require('./gui/dragHandle').default;
var createHighscore = require('../util/highscore').default;

const W = 1920;
const H = 1080;

const SETTINGS = {
  radius: 50, // Stein-Radius (≥ 50 px Laserziel)
  area: { x: 20, y: 140, width: W - 40, height: H - 160 }, // Spielfeld unter der HUD-Leiste
  anchorSize: 4, // ab so vielen Steinen verankert
  maxStones: 80,
  friction: 2.0,
  restitution: 0.65,
  spawnSpeed: 320,
  spawnerRadius: 70,
  corners: [
    // Farbe A..D, Ecke; links A + C, rechts B + D → jedes Team braucht die Gegenseite
    { color: 0, x: 110, y: 250 },
    { color: 1, x: W - 110, y: 250 },
    { color: 2, x: 110, y: H - 110 },
    { color: 3, x: W - 110, y: H - 110 },
  ],
  blockerSpeed: 140,
  roundEndTime: 3.5,
  cursorSpeed: 700,
  maxParticles: 400,
};

// Steigerung pro Runde
const DIFFICULTY = {
  rounds: 3,
  roundTime: [90, 90, 75], // s
  blockers: [0, 4, 7], // graue Störsteine je Runde
};

const SHAPE_NAMES = ['●', '▲', '■', '◆'];
const SIDE_NAMES = ['LINKS', 'RECHTS'];

// Zustand (so vorbelegt, dass handle() auch ohne init() läuft)
let gameState = 'start'; // 'start' | 'play' | 'roundend' | 'gameover'
let round = 0;
let roundTimer = 0;
let stateTimer = 0;
let clusters = []; // { stones, x, y, vx, vy, anchored, side, grabbedBy, keyHeld, blocker }
let stones = []; // { color, cluster, dx, dy, handle, born }
let bonds = []; // [steinA, steinB]
let spawners = [];
let particles = [];
let floatTexts = [];
let stats = newStats();
let roundResults = []; // { left, right, winner }
let cursor = { x: W / 2, y: H / 2, visible: false };
let keyCluster = null;
let winner = -1;
let newHigh = false;
let startButton = null;
let nextButton = null;
let time = 0;
let shake = 0;
let palCache = null;
let palKey = '';
let lastSound = 0;
const keyEdge = createKeyEdge();
const highscore = createHighscore('Farbenturm', 'groesster');

function newStats() {
  return { spawned: 0, glued: 0, anchors: 0, biggest: 0, wins: [0, 0] };
}

// ---------- Hilfen ----------

function play(snd, volume = 0.35) {
  if (time - lastSound < 0.05) return;
  lastSound = time;
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
      stone: [0.28, 0.43, 0.57, 0.72].map((h) => getRgbSpreadHex(tc, h, 0.8, 1)),
      blocker: getRgbSpreadHex(tc, 0.5, 0.05, 0.6),
      side: [getRgbSpreadHex(tc, 0.35, 0.6, 1), getRgbSpreadHex(tc, 0.65, 0.6, 1)],
      line: getRgbSpreadHex(tc, 0.5, 0.3, 0.4),
      hud: getRgbSpreadHex(tc, 0.5, 0.35, 0.95),
      warn: getRgbSpreadHex(tc, 0.4, 0.9, 1),
    };
  }
  return palCache;
}

const sticks = (a, b) => a >= 0 && b >= 0 && (Math.abs(a - b) === 1 || Math.abs(a - b) === 3);
const wx = (s) => s.cluster.x + s.dx;
const wy = (s) => s.cluster.y + s.dy;
const isStatic = (c) => c.anchored || c.grabbedBy || c.keyHeld;

// ---------- Steine & Klumpen ----------

function createStone(color, x, y, vx, vy) {
  if (stones.length >= SETTINGS.maxStones) {
    addFloat('voll!', x, y - 60, pal().warn);
    return null;
  }
  const cluster = { stones: [], x, y, vx, vy, anchored: false, side: -1, grabbedBy: null, keyHeld: false, blocker: color < 0 };
  const s = { color, cluster, dx: 0, dy: 0, born: time, handle: null };
  cluster.stones.push(s);
  if (color >= 0) {
    const A = SETTINGS.area;
    s.handle = guiDragHandle({
      posX: x,
      posY: y,
      radius: SETTINGS.radius,
      grabSpeed: 130,
      speedDown: 80,
      fullPercent: 20,
      catchFactor: 1.7,
      followSmoothing: 11,
      dropDelay: 0.4,
      bounds: { x: A.x, y: A.y, width: A.width, height: A.height },
      visible: false,
      onGrab: () => onGrab(s),
      onDrop: () => onDrop(s),
    });
  }
  clusters.push(cluster);
  stones.push(s);
  return s;
}

function onGrab(s) {
  const c = s.cluster;
  if (c.anchored) return s.handle.drop();
  c.grabbedBy = s;
  c.stones.forEach((o) => o !== s && o.handle && o.handle.setEnabled(false));
  play(soundGlue, 0.15);
}

function onDrop(s) {
  const c = s.cluster;
  if (c.grabbedBy === s) c.grabbedBy = null;
  if (c.keyHeld) {
    c.keyHeld = false;
    if (keyCluster === c) keyCluster = null;
  }
  if (!c.anchored) c.stones.forEach((o) => o.handle && o.handle.setEnabled(true));
}

/** Klumpen b in Klumpen a aufnehmen (a bleibt bestehen); Geklebtes bleibt für immer zusammen */
function merge(a, b, sa, sb) {
  // verankerter oder größerer Klumpen ist das Ziel
  if (b.anchored || (!a.anchored && b.stones.length > a.stones.length)) {
    [a, b] = [b, a];
  }
  // Griffe lösen, bevor umgehängt wird
  [a, b].forEach((c) => {
    c.stones.forEach((s) => s.handle && s.handle.isGrabbed() && s.handle.drop());
    c.grabbedBy = null;
    c.keyHeld = false;
    if (keyCluster === c) keyCluster = null;
  });
  b.stones.forEach((s) => {
    const x = wx(s);
    const y = wy(s);
    s.cluster = a;
    s.dx = x - a.x;
    s.dy = y - a.y;
    a.stones.push(s);
  });
  clusters = clusters.filter((c) => c !== b);
  if (!a.anchored) {
    a.vx = (a.vx + b.vx) / 2;
    a.vy = (a.vy + b.vy) / 2;
  }
  bonds.push([sa, sb]);
  stats.glued++;
  const mx = (wx(sa) + wx(sb)) / 2;
  const my = (wy(sa) + wy(sb)) / 2;
  burst(mx, my, pal().hud, 10);
  play(soundGlue, 0.3);
  if (!a.anchored && a.stones.length >= SETTINGS.anchorSize) anchor(a);
  if (a.anchored) {
    a.stones.forEach((s) => s.handle && s.handle.setEnabled(false));
    stats.biggest = Math.max(stats.biggest, a.stones.length);
  } else {
    a.stones.forEach((s) => s.handle && s.handle.setEnabled(true));
  }
}

function anchor(c) {
  c.anchored = true;
  c.vx = 0;
  c.vy = 0;
  const cx = c.stones.reduce((sum, s) => sum + wx(s), 0) / c.stones.length;
  const cy = c.stones.reduce((sum, s) => sum + wy(s), 0) / c.stones.length;
  c.side = cx < W / 2 ? 0 : 1;
  stats.anchors++;
  shake = Math.max(shake, 0.3);
  c.stones.forEach((s) => burst(wx(s), wy(s), pal().side[c.side], 8));
  addFloat(`VERANKERT – ${SIDE_NAMES[c.side]}`, cx, cy - 80, pal().side[c.side]);
  play(soundAnchor, 0.35);
}

/** Klumpen so verschieben, dass alle Steine im Feld liegen; liefert true, wenn geschoben wurde */
function keepInside(c) {
  const A = SETTINGS.area;
  const r = SETTINGS.radius;
  let shiftX = 0;
  let shiftY = 0;
  c.stones.forEach((s) => {
    const x = wx(s);
    const y = wy(s);
    if (x - r < A.x) shiftX = Math.max(shiftX, A.x - (x - r));
    if (x + r > A.x + A.width) shiftX = Math.min(shiftX, A.x + A.width - (x + r));
    if (y - r < A.y) shiftY = Math.max(shiftY, A.y - (y - r));
    if (y + r > A.y + A.height) shiftY = Math.min(shiftY, A.y + A.height - (y + r));
  });
  c.x += shiftX;
  c.y += shiftY;
  if (shiftX) c.vx = Math.sign(shiftX) * Math.abs(c.vx) * SETTINGS.restitution;
  if (shiftY) c.vy = Math.sign(shiftY) * Math.abs(c.vy) * SETTINGS.restitution;
}

function updateClusters(grid, dt) {
  // Eingabe: gegriffenen Stein abfragen, Klumpen folgt ihm
  clusters.slice().forEach((c) => {
    if (c.anchored || c.blocker) return;
    if (c.keyHeld) {
      // Bezugspunkt = gegriffener Stein (siehe handleKeyboard)
      c.x += (cursor.x - c.x) * Math.min(1, dt * 10);
      c.y += (cursor.y - c.y) * Math.min(1, dt * 10);
      keepInside(c);
      return;
    }
    const ox = c.x;
    const oy = c.y;
    c.stones.slice().forEach((s) => {
      if (!clusters.includes(s.cluster) || s.cluster !== c || !s.handle) return;
      if (!s.handle.isGrabbed()) {
        s.handle.setX(wx(s));
        s.handle.setY(wy(s));
      }
      const before = s.handle.getValue();
      s.handle.handle(grid, dt);
      const after = s.handle.getValue();
      // größere Klumpen sind schwerer zu greifen (Handle-Wrapping)
      if (!s.handle.isGrabbed() && after > before && c.stones.length > 1) {
        s.handle.setValue(before + (after - before) / c.stones.length);
      }
      if (s.handle.isGrabbed() && c.grabbedBy === s) {
        c.x = s.handle.getX() - s.dx;
        c.y = s.handle.getY() - s.dy;
      }
    });
    if (c.grabbedBy) {
      keepInside(c);
      c.vx = (c.x - ox) / Math.max(dt, 0.001);
      c.vy = (c.y - oy) / Math.max(dt, 0.001);
    }
  });

  // Bewegung freier Klumpen
  const damp = Math.exp(-SETTINGS.friction * dt);
  clusters.forEach((c) => {
    if (isStatic(c)) return;
    c.x += c.vx * dt;
    c.y += c.vy * dt;
    if (c.blocker) {
      // Störsteine treiben mit konstantem Tempo
      const sp = Math.hypot(c.vx, c.vy) || 1;
      c.vx = (c.vx / sp) * SETTINGS.blockerSpeed;
      c.vy = (c.vy / sp) * SETTINGS.blockerSpeed;
    } else {
      c.vx *= damp;
      c.vy *= damp;
    }
    keepInside(c);
  });

  // Paare: kleben oder abprallen (n ≤ 80 → n² ist günstig)
  const r = SETTINGS.radius;
  for (let i = 0; i < stones.length; i++) {
    for (let j = i + 1; j < stones.length; j++) {
      const a = stones[i];
      const b = stones[j];
      const ca = a.cluster;
      const cb = b.cluster;
      if (ca === cb) continue;
      const dx = wx(b) - wx(a);
      const dy = wy(b) - wy(a);
      const d = Math.hypot(dx, dy) || 0.001;
      if (d >= 2 * r) continue;
      if (sticks(a.color, b.color) && !(ca.anchored && cb.anchored)) {
        merge(ca, cb, a, b);
        continue;
      }
      const sa = isStatic(ca);
      const sb = isStatic(cb);
      if (sa && sb) continue;
      const nx = dx / d;
      const ny = dy / d;
      const overlap = 2 * r - d;
      const pa = sa ? 0 : sb ? 1 : 0.5;
      const pb = sb ? 0 : sa ? 1 : 0.5;
      ca.x -= nx * overlap * pa;
      ca.y -= ny * overlap * pa;
      cb.x += nx * overlap * pb;
      cb.y += ny * overlap * pb;
      const rel = (cb.vx - ca.vx) * nx + (cb.vy - ca.vy) * ny;
      if (rel >= 0) continue;
      const imp = -(1 + SETTINGS.restitution) * rel;
      if (!sa && !sb) {
        const ma = ca.stones.length;
        const mb = cb.stones.length;
        ca.vx -= ((imp * mb) / (ma + mb)) * nx;
        ca.vy -= ((imp * mb) / (ma + mb)) * ny;
        cb.vx += ((imp * ma) / (ma + mb)) * nx;
        cb.vy += ((imp * ma) / (ma + mb)) * ny;
      } else if (sa) {
        cb.vx += imp * nx;
        cb.vy += imp * ny;
      } else {
        ca.vx -= imp * nx;
        ca.vy -= imp * ny;
      }
    }
  }
}

function scores() {
  const best = [0, 0];
  clusters.forEach((c) => {
    if (c.anchored) best[c.side] = Math.max(best[c.side], c.stones.length);
  });
  return best;
}

// ---------- Effekte ----------

function burst(x, y, color, n) {
  for (let i = 0; i < n && particles.length < SETTINGS.maxParticles; i++) {
    const a = Math.random() * Math.PI * 2;
    const v = 50 + Math.random() * 260;
    const life = 0.4 + Math.random() * 0.7;
    particles.push({ x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v, life, max: life, color, size: 2 + Math.random() * 5 });
  }
}

function addFloat(text, x, y, color) {
  if (floatTexts.length > 12) return;
  floatTexts.push({ text, x, y, life: 1.6, color });
}

function drawEffects(ctx, dt) {
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  particles.slice().forEach((p) => {
    p.life -= dt;
    if (p.life <= 0) {
      particles.splice(particles.indexOf(p), 1);
      return;
    }
    p.x += p.vx * dt;
    p.y += p.vy * dt;
    p.vx *= 0.94;
    p.vy *= 0.94;
    ctx.globalAlpha = p.life / p.max;
    ctx.fillStyle = p.color;
    ctx.fillRect(p.x - p.size / 2, p.y - p.size / 2, p.size, p.size);
  });
  ctx.restore();
  floatTexts.slice().forEach((f) => {
    f.life -= dt;
    if (f.life <= 0) {
      floatTexts.splice(floatTexts.indexOf(f), 1);
      return;
    }
    f.y -= 35 * dt;
    ctx.save();
    ctx.globalAlpha = Math.min(1, f.life);
    util.renderText({ ctx, text: f.text, x: f.x, y: f.y, fontSize: '40px', fillStyle: f.color });
    ctx.restore();
  });
}

// ---------- Zeichnen ----------

function shapePath(ctx, color, x, y, r) {
  ctx.beginPath();
  if (color === 0 || color < 0) {
    ctx.arc(x, y, r, 0, Math.PI * 2);
  } else {
    const n = color === 1 ? 3 : 4;
    const rot = color === 1 ? -Math.PI / 2 : color === 2 ? Math.PI / 4 : 0;
    const rr = color === 2 ? r * 1.15 : r;
    for (let k = 0; k <= n; k++) {
      const a = rot + (k / n) * Math.PI * 2;
      k ? ctx.lineTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr) : ctx.moveTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr);
    }
  }
  ctx.closePath();
}

function drawStone(ctx, s) {
  const P = pal();
  const c = s.cluster;
  const x = wx(s);
  const y = wy(s);
  const color = s.color < 0 ? P.blocker : P.stone[s.color];
  const fill = s.handle && !s.handle.isGrabbed() ? s.handle.getValue() : 0;
  const pop = Math.max(0, 1 - (time - s.born) * 4);
  const r = SETTINGS.radius * 0.8 * (1 + pop * 0.3);
  ctx.save();
  if (c.grabbedBy || c.keyHeld) {
    ctx.shadowColor = color;
    ctx.shadowBlur = 22;
  }
  if (c.anchored) {
    // Halo in der Teamfarbe
    ctx.strokeStyle = P.side[c.side];
    ctx.globalAlpha = 0.35 + 0.2 * Math.sin(time * 3);
    ctx.lineWidth = 6;
    ctx.beginPath();
    ctx.arc(x, y, SETTINGS.radius + 2, 0, Math.PI * 2);
    ctx.stroke();
  }
  shapePath(ctx, s.color, x, y, r);
  ctx.globalAlpha = c.anchored ? 0.5 : 0.2;
  ctx.fillStyle = color;
  ctx.fill();
  ctx.globalAlpha = 1;
  ctx.strokeStyle = color;
  ctx.lineWidth = 4;
  if (s.color < 0) ctx.setLineDash([8, 6]);
  ctx.stroke();
  ctx.restore();
  if (fill > 0 && !c.anchored) {
    ctx.save();
    ctx.strokeStyle = color;
    ctx.lineWidth = 6;
    ctx.beginPath();
    ctx.arc(x, y, SETTINGS.radius + 6, -Math.PI / 2, -Math.PI / 2 + (Math.PI * 2 * fill) / 100);
    ctx.stroke();
    ctx.restore();
  }
}

function drawField(ctx) {
  const P = pal();
  ctx.save();
  ctx.strokeStyle = P.line;
  ctx.lineWidth = 2;
  ctx.setLineDash([16, 14]);
  ctx.beginPath();
  ctx.moveTo(W / 2, SETTINGS.area.y);
  ctx.lineTo(W / 2, H);
  ctx.stroke();
  ctx.setLineDash([]);
  // Klebe-Bänder
  ctx.lineCap = 'round';
  bonds.forEach(([a, b]) => {
    ctx.strokeStyle = a.cluster.anchored ? P.side[a.cluster.side] : P.hud;
    ctx.globalAlpha = 0.7;
    ctx.lineWidth = 10;
    ctx.beginPath();
    ctx.moveTo(wx(a), wy(a));
    ctx.lineTo(wx(b), wy(b));
    ctx.stroke();
  });
  ctx.restore();
}

function drawClusterSizes(ctx) {
  const P = pal();
  clusters.forEach((c) => {
    if (!c.anchored) return;
    const cx = c.stones.reduce((sum, s) => sum + wx(s), 0) / c.stones.length;
    const top = Math.min(...c.stones.map(wy)) - SETTINGS.radius - 14;
    util.renderText({ ctx, text: `${c.stones.length}`, x: cx, y: top, fontSize: '44px', fillStyle: P.side[c.side] });
  });
}

/** Legende: vier Formen im Kreis, Linien zeigen, wer klebt */
function drawLegend(ctx, cx, cy, radius, size) {
  const P = pal();
  const pos = [0, 1, 2, 3].map((k) => ({ x: cx + Math.cos(-Math.PI / 2 + (k * Math.PI) / 2) * radius, y: cy + Math.sin(-Math.PI / 2 + (k * Math.PI) / 2) * radius }));
  ctx.save();
  ctx.strokeStyle = P.hud;
  ctx.globalAlpha = 0.6;
  ctx.lineWidth = 3;
  ctx.beginPath();
  for (let k = 0; k <= 4; k++) k ? ctx.lineTo(pos[k % 4].x, pos[k % 4].y) : ctx.moveTo(pos[0].x, pos[0].y);
  ctx.stroke();
  ctx.globalAlpha = 1;
  pos.forEach((p, k) => {
    shapePath(ctx, k, p.x, p.y, size);
    ctx.fillStyle = P.stone[k];
    ctx.globalAlpha = 0.35;
    ctx.fill();
    ctx.globalAlpha = 1;
    ctx.strokeStyle = P.stone[k];
    ctx.lineWidth = 3;
    ctx.stroke();
  });
  ctx.restore();
}

function drawSpawners(ctx) {
  const P = pal();
  spawners.forEach((sp) => {
    ctx.save();
    ctx.fillStyle = 'rgba(0,0,0,0.85)';
    ctx.beginPath();
    ctx.arc(sp.corner.x, sp.corner.y, SETTINGS.spawnerRadius * 1.25, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
    sp.button.handle(sp.grid, sp.dt);
    ctx.save();
    ctx.globalAlpha = 0.5 + 0.5 * (sp.button.getValue() / 100);
    shapePath(ctx, sp.corner.color, sp.corner.x, sp.corner.y, 26);
    ctx.strokeStyle = P.stone[sp.corner.color];
    ctx.lineWidth = 4;
    ctx.stroke();
    ctx.restore();
  });
}

function drawHud(ctx) {
  const P = pal();
  const sc = scores();
  ctx.save();
  ctx.fillStyle = '#000';
  ctx.fillRect(0, 0, W, SETTINGS.area.y - 10);
  ctx.restore();
  util.renderText({ ctx, text: `LINKS ${sc[0]}`, x: 40, y: 80, fontSize: '56px', fillStyle: P.side[0], align: 'left' });
  util.renderText({ ctx, text: `${sc[1]} RECHTS`, x: W - 40, y: 80, fontSize: '56px', fillStyle: P.side[1], align: 'right' });
  util.renderText({
    ctx,
    text: `Runde ${round + 1}/${DIFFICULTY.rounds} · ${Math.ceil(roundTimer)} s · Siege ${stats.wins[0]}:${stats.wins[1]}`,
    x: W / 2 + 300,
    y: 75,
    fontSize: '34px',
    fillStyle: roundTimer < 15 ? P.warn : P.hud,
    align: 'center',
  });
  drawLegend(ctx, W / 2 - 200, 66, 42, 13);
  util.renderText({ ctx, text: 'klebt', x: W / 2 - 110, y: 76, fontSize: '26px', fillStyle: P.hud, align: 'left' });
}

function drawCursor(ctx) {
  if (!cursor.visible) return;
  ctx.save();
  ctx.strokeStyle = pal().hud;
  ctx.lineWidth = 2;
  ctx.setLineDash([6, 6]);
  ctx.beginPath();
  ctx.arc(cursor.x, cursor.y, SETTINGS.radius + 14, 0, Math.PI * 2);
  ctx.stroke();
  ctx.restore();
}

// ---------- Ablauf ----------

function spawnFromCorner(corner) {
  const tx = W / 2 - corner.x;
  const ty = H / 2 - corner.y;
  const len = Math.hypot(tx, ty) || 1;
  const x = corner.x + (tx / len) * SETTINGS.spawnerRadius * 1.6;
  const y = corner.y + (ty / len) * SETTINGS.spawnerRadius * 1.6;
  const s = createStone(corner.color, x, y, (tx / len) * SETTINGS.spawnSpeed, (ty / len) * SETTINGS.spawnSpeed);
  if (!s) return;
  stats.spawned++;
  burst(x, y, pal().stone[corner.color], 10);
  play(soundPlop, 0.25);
}

function createSpawners() {
  const P = pal();
  spawners = SETTINGS.corners.map((corner) => {
    const color = P.stone[corner.color];
    const button = guiPixelFillButton({
      label: '',
      posX: corner.x,
      posY: corner.y,
      radius: SETTINGS.spawnerRadius,
      edges: 8,
      speedUp: 90,
      speedDown: 50,
      fullPercent: 20,
      counterReset: true,
      lineWidth: 3,
      normalColor: P.line,
      growColor: color,
      activeColor: color,
      onEnterActive: () => spawnFromCorner(corner),
    });
    return { corner, button, grid: null, dt: 0 };
  });
}

function createButtons() {
  const P = pal();
  const opts = { posX: W / 2, radius: 100, edges: 6, speedUp: 60, speedDown: 30, lineWidth: 5, normalColor: P.line, growColor: P.side[0], activeColor: P.side[1] };
  startButton = guiFillButton(Object.assign({}, opts, { label: 'START', posY: 860, onEnterActive: () => startGame() }));
  nextButton = guiFillButton(Object.assign({}, opts, { label: 'NOCHMAL', posY: 900, onEnterActive: () => startGame() }));}

function startRound() {
  clusters = [];
  stones = [];
  bonds = [];
  keyCluster = null;
  roundTimer = DIFFICULTY.roundTime[round];
  const A = SETTINGS.area;
  for (let i = 0; i < DIFFICULTY.blockers[round]; i++) {
    const a = Math.random() * Math.PI * 2;
    createStone(-1, W / 2 + (Math.random() - 0.5) * 600, A.y + 150 + Math.random() * (A.height - 300), Math.cos(a), Math.sin(a));
  }
  if (DIFFICULTY.blockers[round]) addFloat('Störsteine!', W / 2, H / 2, pal().warn);
  gameState = 'play';
}

function startGame() {
  round = 0;
  stats = newStats();
  roundResults = [];
  particles = [];
  floatTexts = [];
  createSpawners();
  startRound();
}

function endRound() {
  const sc = scores();
  const w = sc[0] === sc[1] ? 0.5 : sc[0] > sc[1] ? 0 : 1;
  if (w !== 0.5) stats.wins[w]++;
  roundResults.push({ left: sc[0], right: sc[1], winner: w });
  gameState = 'roundend';
  stateTimer = 0;
  play(soundRound, 0.5);
}

function endGame() {
  winner = stats.wins[0] === stats.wins[1] ? 0.5 : stats.wins[0] > stats.wins[1] ? 0 : 1;
  highscore.addEntry({
    groesster: stats.biggest,
    sieger: winner,
    siegeLinks: stats.wins[0],
    siegeRechts: stats.wins[1],
    steine: stats.spawned,
  });
  newHigh = highscore.lastEntryNewHighscore();
  gameState = 'gameover';
  play(soundGameOver, 0.5);
  createButtons();
}

function handleKeyboard(dt) {
  let mx = 0;
  let my = 0;
  if (isKeyDown('ArrowLeft')) mx -= 1;
  if (isKeyDown('ArrowRight')) mx += 1;
  if (isKeyDown('ArrowUp')) my -= 1;
  if (isKeyDown('ArrowDown')) my += 1;
  if (mx || my) {
    cursor.visible = true;
    const A = SETTINGS.area;
    cursor.x = Math.max(A.x, Math.min(A.x + A.width, cursor.x + mx * SETTINGS.cursorSpeed * dt));
    cursor.y = Math.max(A.y, Math.min(A.y + A.height, cursor.y + my * SETTINGS.cursorSpeed * dt));
  }
  ['Digit1', 'Digit2', 'Digit3', 'Digit4'].forEach((code, k) => {
    if (keyEdge(code)) spawnFromCorner(SETTINGS.corners.find((c) => c.color === k));
  });
  if (keyEdge('Enter')) {
    cursor.visible = true;
    if (keyCluster) {
      keyCluster.keyHeld = false;
      keyCluster = null;
      return;
    }
    const near = stones
      .filter((s) => s.handle && !s.cluster.anchored && Math.hypot(wx(s) - cursor.x, wy(s) - cursor.y) < SETTINGS.radius * 1.5)
      .sort((a, b) => Math.hypot(wx(a) - cursor.x, wy(a) - cursor.y) - Math.hypot(wx(b) - cursor.x, wy(b) - cursor.y))[0];
    if (near) {
      const c = near.cluster;
      // Bezugspunkt des Klumpens auf den gegriffenen Stein legen (dann folgt genau er dem Cursor)
      const refX = wx(near);
      const refY = wy(near);
      const odx = near.dx;
      const ody = near.dy;
      c.stones.forEach((s) => {
        s.dx -= odx;
        s.dy -= ody;
      });
      c.x = refX;
      c.y = refY;
      c.keyHeld = true;
      c.vx = 0;
      c.vy = 0;
      keyCluster = c;
    }
  }
}

function handlePlay(grid, dt, ctx) {
  if (!spawners.length) startGame();
  roundTimer -= dt;
  handleKeyboard(dt);
  spawners.forEach((sp) => {
    sp.grid = grid;
    sp.dt = dt;
  });
  updateClusters(grid, dt);
  drawField(ctx);
  stones.forEach((s) => drawStone(ctx, s));
  drawClusterSizes(ctx);
  drawSpawners(ctx);
  drawCursor(ctx);
  drawEffects(ctx, dt);
  drawHud(ctx);
  if (roundTimer <= 0) endRound();
}

function handleRoundEnd(grid, dt, ctx) {
  const P = pal();
  stateTimer += dt;
  drawField(ctx);
  stones.forEach((s) => drawStone(ctx, s));
  drawClusterSizes(ctx);
  drawEffects(ctx, dt);
  drawHud(ctx);
  const res = roundResults[roundResults.length - 1];
  const text = res.winner === 0.5 ? 'UNENTSCHIEDEN' : `${SIDE_NAMES[res.winner]} GEWINNT`;
  ctx.save();
  ctx.globalAlpha = Math.min(1, stateTimer * 3);
  util.renderText({ ctx, text, x: W / 2, y: H / 2, fontSize: '150px', fillStyle: res.winner === 0.5 ? P.hud : P.side[res.winner] });
  util.renderText({ ctx, text: `Runde ${round + 1}: ${res.left} : ${res.right}`, x: W / 2, y: H / 2 + 80, fontSize: '50px', fillStyle: P.hud });
  ctx.restore();
  if (stateTimer >= SETTINGS.roundEndTime || keyEdge('Space')) {
    round++;
    if (round >= DIFFICULTY.rounds) endGame();
    else startRound();
  }
}

function handleStart(grid, dt, ctx) {
  const P = pal();
  if (!startButton) createButtons();
  util.renderText({ ctx, text: 'FARBENTURM', x: W / 2, y: 210, fontSize: '150px', fillStyle: P.hud });
  util.renderText({
    ctx,
    text: `LINKS gegen RECHTS: Steine aus den Ecken holen und verkleben.\nNur Nachbarfarben kleben – ab 4 Steinen ist der Klumpen verankert und zählt.\nDer größte verankerte Klumpen gewinnt die Runde. Klauen erlaubt!`,
    x: W / 2,
    y: 320,
    fontSize: '40px',
    lineHeight: 58,
    fillStyle: P.hud,
  });
  ctx.save();
  ctx.translate(0, Math.sin(time * 1.5) * 6);
  drawLegend(ctx, W / 2, 610, 110, 34);
  ctx.restore();
  highscore.renderHighAndLowScores(ctx);
  startButton.handle(grid, dt);
  util.renderText({ ctx, text: 'Leertaste = Start', x: W / 2, y: 1040, fontSize: '32px', fillStyle: P.hud });
  if (keyEdge('Space')) startGame();
}

function handleGameOver(grid, dt, ctx) {
  const P = pal();
  if (!nextButton) createButtons();
  const title = winner === 0.5 ? 'UNENTSCHIEDEN!' : `${SIDE_NAMES[winner]} GEWINNT!`;
  util.renderText({ ctx, text: title, x: W / 2, y: 200, fontSize: '150px', fillStyle: winner === 0.5 ? P.hud : P.side[winner] });
  const lines = roundResults.map((r, i) => `Runde ${i + 1}:  ${r.left} : ${r.right}`).join('\n');
  util.renderText({
    ctx,
    text: `${lines}\nGrößter Klumpen ${stats.biggest} · Steine ${stats.spawned} · Klebestellen ${stats.glued}`,
    x: W / 2,
    y: 320,
    fontSize: '44px',
    lineHeight: 62,
    fillStyle: P.hud,
  });
  if (newHigh) util.renderText({ ctx, text: 'NEUER HIGHSCORE – größer als jeder Atomix-Kristall auf dem Amiga!', x: W / 2, y: 620, fontSize: '40px', fillStyle: P.warn });
  highscore.renderHighAndLowScores(ctx);
  nextButton.handle(grid, dt);
  if (keyEdge('Space')) startGame();
}

export default {
  name: 'Farbenturm',
  description: `Farbenturm – LINKS gegen RECHTS.
In den vier Ecken entstehen Farbsteine: Laser auf die Ecke halten.
Steine anleuchten bis der Ring voll ist, dann ziehen. Nur NACHBARFARBEN kleben (Legende oben).
Was klebt, bleibt für immer zusammen. Ab 4 Steinen ist der Klumpen verankert und zählt für seine Hälfte.
Der größte verankerte Klumpen gewinnt die Runde – kleine Klumpen des Gegners darf man klauen!`,
  image: 'media/img/gametitles/laser-basefight-###8###.png',
  init() {
    gameState = 'start';
    clusters = [];
    stones = [];
    bonds = [];
    particles = [];
    floatTexts = [];
    stats = newStats();
    roundResults = [];
    round = 0;
    keyCluster = null;
    cursor = { x: W / 2, y: H / 2, visible: false };
    newHigh = false;
    createSpawners();
    createButtons();
  },
  handle(grid, elapsed) {
    const dt = Math.min(elapsed, 0.1);
    const ctx = MasterCanvas.get2dContext();
    time += dt;
    pal();
    ctx.save();
    if (shake > 0) {
      shake = Math.max(0, shake - dt);
      ctx.translate((Math.random() - 0.5) * 30 * shake, (Math.random() - 0.5) * 30 * shake);
    }
    if (gameState === 'start') handleStart(grid, dt, ctx);
    else if (gameState === 'play') handlePlay(grid, dt, ctx);
    else if (gameState === 'roundend') handleRoundEnd(grid, dt, ctx);
    else handleGameOver(grid, dt, ctx);
    ctx.restore();
  },
  stop() {
    keyCluster = null;
  },
};
