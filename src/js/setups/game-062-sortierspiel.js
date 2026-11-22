/**
 * Sortierspiel – Tetris-Steine wegsortieren, Dreiecke zur Figur legen (Spielidee: Georg)
 *
 * Regeln:
 * - In der Mitte steht ein TISCH (die Linie in der Mitte). Die Steine kommen in WELLEN: Alle Steine einer
 *   Welle (die 7 Tetris-Formen I O T L J S Z, Level 1: 12 Stück, pro Level +2, höchstens 24) erscheinen
 *   gleichzeitig als Formation über dem Bild und fallen ZUSAMMEN herunter – jeder Stein landet auf dem Tisch.
 *   Die Steine folgen der Schwerkraft, sind starr und drehen sich nicht. Sie stapeln sich auf dem Tisch.
 * - Am linken und rechten Bildschirmrand sind 7 TORE – eins pro Form, die Form ist im Tor vorgezeichnet.
 *   Ein Stein, der in SEIN Tor kommt, verschwindet (+1 sortiert). Ein falsches Tor stößt ihn zurück (rot).
 * - GREIFEN: Laser auf einen Stein halten → der Greif-Ring füllt sich (mehr Laser = schneller). Ist er voll,
 *   folgt der Stein den Lasern (mehrere Laser = Schwerpunkt). Keine Laser mehr → der Stein fällt senkrecht.
 *   Wird ein Stein unten aus dem Stapel gezogen, fallen die Steine darüber nach. Steine, die neben dem Tisch
 *   losgelassen werden, fallen aus dem Bild und kommen oben über dem Tisch wieder herein.
 * - Mit jeder Welle fällt auch ein DREIECK. Unter dem Tisch ist der Umriss einer FIGUR aus Dreiecken
 *   vorgezeichnet. Ein Dreieck in die Nähe eines freien Platzes ziehen und loslassen → es rastet ein
 *   (richtige Ausrichtung automatisch).
 * - Erst wenn der Tisch leer ist (keine Steine, kein loses Dreieck), kommt die nächste Welle. Pro Level gibt es
 *   so viele Wellen wie die Figur Dreiecke hat (Level 1: 3, dann 4, 6, 8, 9, 12, 16).
 * - Figur komplett → Level geschafft. Kein Verlieren, alle spielen zusammen gegen die Uhr.
 *   Pro Level: mehr Steine pro Welle, größere Figur, die Tore werden neu gemischt.
 * - PUNKTE (Highscore): 10 pro sortiertem Stein, 50 pro gelegtem Dreieck, 250 pro geschaffter Figur,
 *   −5 pro falschem Tor. Eingetragen wird am Ende (alle Figuren gelegt) – wie früher am Amiga: erst durchspielen,
 *   dann Namen… äh, Punkte eintragen.
 *
 * Offene Frage von Georg (Verhalten der Steine): umgesetzt wie vorgeschlagen – Schwerkraft, starr, kein Drehen.
 * Physik: eigene, achsenparallele Stapel-Physik (Abschnitt „Physik“) statt p2 – Steine drehen sich nie, also
 * reichen Rechtecke; das ist billig, vorhersagbar und ohne npm-Paket testbar. Getragene Steine schweben durch
 * alles hindurch (kein Schieben), losgelassene fallen senkrecht und setzen auf dem Höchsten darunter auf.
 *
 * Laser sind nicht unterscheidbar: Greifen über Flächenanteil (gui/dragHandle, unsichtbar, per Handle-Wrapping
 * an den Stein gekoppelt). Damit ein Laser auf einem Stapel nicht mehrere Steine gleichzeitig greift,
 * werden beim Greifen die Greif-Zähler der Nachbarsteine kurz gesperrt.
 *
 * Licht-Disziplin: Hintergrund schwarz, Steine dunkel gefüllt mit heller Kontur (der Laserpunkt auf einem
 * Stein bleibt erkennbar), Tore nur als Umriss. Farben nur Hue 0.25..0.75 relativ zur Laserfarbe.
 *
 * Interferenz: Jeder kann jeden Stein greifen – auch einen, den gerade andere tragen (dann zieht der
 * Schwerpunkt). Das ist hier kooperativ gewollt; Störer kosten nur Zeit.
 *
 * One-Pixel-Netzwerk-Tauglichkeit: Greifen ist Flächenanteil am Greif-Kreis; ein einzelner Netz-Pixel füllt
 * langsam, viele Pixel auf demselben Stein schnell. Tragen folgt dem Schwerpunkt – mit Millionen Pixeln wird
 * daraus ein „Schwarm trägt Stein“. Skaliert, weil alle Schwellen relativ (fullPercent) sind.
 *
 * Klassiker: Tetris (Alexei Paschitnow, 1984; Amiga/C64-Umsetzungen 1988) – dieselben 7 Formen, hier aber
 * nicht stapeln, sondern wegsortieren; dazu ein Tangram-Puzzle (Dreiecke zur Figur), wie die alten
 * Lernspiel-Disketten. Das Sortieren nach Form erinnert an Kinder-Steckwürfel.
 * Ähnlichkeiten im Bestand: src/js/setups/physics-game-sorter (p2-Sortierer, Objekte in Behälter) – hier ohne
 * p2 und mit Formen-Toren; Greifen/Ablegen wie in Spielen mit gui/dragHandle.
 *
 * Tastatur (Test ohne Laser):
 * - Leertaste: Start / Pause zwischen Wellen bzw. Level-Übergang überspringen / Nochmal
 * - A: einen zufälligen Stein automatisch in sein Tor fliegen lassen (gedrückt halten = viele)
 * - B: ein loses Dreieck in die Figur legen
 * - N: Level sofort schaffen
 *   (d v g r m h t f F s, PageUp/PageDown/Home sind in view.js Debug-Tasten und hier bewusst frei)
 */

import util, { getRgbSpreadHex } from '../util.js';
import { createKeyEdge, isKeyDown } from './gui/gridScan.js';
import soundPlop from '../../../public/media/369952__mischy__plop-1.wav';
import soundError from '../../../public/media/opengameart/Menu Error.ogg';
import soundLevelUp from '../../../public/media/opengameart/Level Up.ogg';
import soundPickup from '../../../public/media/opengameart/Item Pickup.ogg';
import soundGrab from '../../../public/media/opengameart/Menu Move.ogg';
import soundWin from '../../../public/media/opengameart/Ability Learn.ogg';
import soundLoad from '../../../public/media/opengameart/Transition.ogg';
var laserConfig = require('../LaserApiConfig.js').default;
var MasterCanvas = require('../MasterCanvas').default;
var guiFillButton = require('./gui/fillButton-ai2').default;
var guiDragHandle = require('./gui/dragHandle').default;
var createHighscore = require('../util/highscore').default;

const W = 1920;
const H = 1080;
const B = 40; // Kantenlänge eines Tetris-Blocks in px

// ---------------------------------------------------------------------------------------------------------
// Balancing
// ---------------------------------------------------------------------------------------------------------

const DIFFICULTY = {
  piecesStart: 12, // Steine pro Welle in Level 1
  piecesPerLevel: 2, // + pro Level
  piecesMax: 24, // mehr passt nicht übereinander auf den Tisch
  waveGap: 14, // px Abstand der Steine in der Formation
  waveRowGap: 30, // px Abstand der Reihen in der Formation
  loadPause: 1.6, // s Pause, bevor die nächste Welle fällt
  levelUpDuration: 2.8,
  gravity: 1800, // px/s²
  maxFall: 1500, // px/s
  grabRadius: 58, // Greif-Kreis um den Stein
  grabSpeed: 200,
  grabFullPercent: 18,
  grabBlockRadius: 110, // Nachbarsteine in diesem Abstand werden beim Greifen kurz gesperrt
  grabBlockTime: 0.5,
  maxCarrySpeed: 1600,
  rejectCooldown: 0.8,
  snapDistance: 140, // so nah muss ein Dreieck am freien Platz losgelassen werden
  maxParticles: 400,
};

// Punkte für den Highscore
const SCORE = { sorted: 10, triangle: 50, figure: 250, wrong: -5 };

// Tisch und Figurenbereich
const TABLE = { x0: 470, x1: 1450, top: 590, thick: 26, rimW: 20, rimH: 56 };
const FIG = { cx: 960, cy: 860, side: 112 };

// Die 7 Formen (Zellen im Raster, y nach unten)
const SHAPES = [
  { key: 'I', cells: [[0, 0], [1, 0], [2, 0], [3, 0]] },
  { key: 'O', cells: [[0, 0], [1, 0], [0, 1], [1, 1]] },
  { key: 'T', cells: [[0, 0], [1, 0], [2, 0], [1, 1]] },
  { key: 'L', cells: [[0, 0], [0, 1], [0, 2], [1, 2]] },
  { key: 'J', cells: [[1, 0], [1, 1], [1, 2], [0, 2]] },
  { key: 'S', cells: [[1, 0], [2, 0], [0, 1], [1, 1]] },
  { key: 'Z', cells: [[0, 0], [1, 0], [1, 1], [2, 1]] },
];

// Torpositionen: 4 links, 3 rechts (Mittelpunkt, Grösse), Öffnung zeigt zur Mitte
const GATE_W = 270;
const GATE_H = 220;
const GATE_SLOTS = [
  { x: 150, y: 165, side: 'left' },
  { x: 150, y: 410, side: 'left' },
  { x: 150, y: 655, side: 'left' },
  { x: 150, y: 900, side: 'left' },
  { x: 1770, y: 260, side: 'right' },
  { x: 1770, y: 540, side: 'right' },
  { x: 1770, y: 820, side: 'right' },
];

// ---------------------------------------------------------------------------------------------------------
// Figuren aus gleichseitigen Dreiecken (Dreiecksgitter: Zeile r, Spalte c, "oben" wenn (r + c) gerade)
// ---------------------------------------------------------------------------------------------------------

function bigTriangle(n) {
  const cells = [];
  const off = (n - 1) % 2;
  for (let r = 0; r < n; r++) {
    for (let c = n - 1 - r; c <= n - 1 + r; c++) cells.push([r, c + off]);
  }
  return cells;
}

const FIGURES = [
  { name: 'Trapez', cells: [[0, 0], [0, 1], [0, 2]] },
  { name: 'Großes Dreieck', cells: bigTriangle(2) },
  { name: 'Sechseck', cells: [[0, 0], [0, 1], [0, 2], [1, 0], [1, 1], [1, 2]] },
  { name: 'Raute', cells: [[0, 0], [0, 1], [0, 2], [0, 3], [1, 1], [1, 2], [1, 3], [1, 4]] },
  { name: 'Riesendreieck', cells: bigTriangle(3) },
  {
    name: 'Großes Trapez',
    cells: [[0, 0], [0, 1], [0, 2], [0, 3], [0, 4], [1, -1], [1, 0], [1, 1], [1, 2], [1, 3], [1, 4], [1, 5]],
  },
  { name: 'Pyramide', cells: bigTriangle(4) },
];

function buildSlots(figure) {
  const S = FIG.side;
  const h = (S * Math.sqrt(3)) / 2;
  const slots = figure.cells.map((rc) => {
    const r = rc[0];
    const c = rc[1];
    const up = (r + c) % 2 === 0;
    const x = (c * S) / 2;
    const y = r * h;
    const pts = up
      ? [[x + S / 2, y], [x + S, y + h], [x, y + h]]
      : [[x, y], [x + S, y], [x + S / 2, y + h]];
    return { pts, up, filled: false, fillTime: 0 };
  });
  let minX = Infinity;
  let maxX = -Infinity;
  let minY = Infinity;
  let maxY = -Infinity;
  slots.forEach((s) =>
    s.pts.forEach((p) => {
      minX = Math.min(minX, p[0]);
      maxX = Math.max(maxX, p[0]);
      minY = Math.min(minY, p[1]);
      maxY = Math.max(maxY, p[1]);
    })
  );
  const dx = FIG.cx - (minX + maxX) / 2;
  const dy = FIG.cy - (minY + maxY) / 2;
  slots.forEach((s) => {
    s.pts = s.pts.map((p) => [p[0] + dx, p[1] + dy]);
    s.x = (s.pts[0][0] + s.pts[1][0] + s.pts[2][0]) / 3;
    s.y = (s.pts[0][1] + s.pts[1][1] + s.pts[2][1]) / 3;
  });
  return slots;
}

// ---------------------------------------------------------------------------------------------------------
// Zustand (modulweit vorbelegt, damit handle() auch ohne init() läuft)
// ---------------------------------------------------------------------------------------------------------

var gameState = 'start';
var world = null;
var pieces = []; // Steine und lose Dreiecke: { kind: 'piece'|'tri', shape, body, drag, ... }
var slots = [];
var gates = [];
var spawnQueue = [];
var spawnTimer = 0;
var loadPause = 0;
var loadsDone = 0;
var loadsTotal = 0;
var level = 1;
var stateTime = 0;
var levelTime = 0;
var totalTime = 0;
var clock = 0;
var shake = 0;
var flash = 0;
var particles = [];
var floaters = [];
var stats = { sorted: 0, wrong: 0, triangles: 0 };
var levelTimes = [];
var startButton = null;
var againButton = null;
var keyEdge = createKeyEdge();
var autoKeyTimer = 0;
var waveBanner = 0; // s, solange das „WELLE x/y“-Banner sichtbar ist
var finalScore = 0;
var newHighscore = false;
var highscore = createHighscore('Sortierspiel', 'punkte');
var pal = null;
var palKey = '';
var sprites = null;
var bgCanvas = null;
var gateCanvas = null;
var figCanvas = null;

// ---------------------------------------------------------------------------------------------------------
// Farben (nur aus der Laserfarbe abgeleitet, Hue-Abstand ≥ 0.2)
// ---------------------------------------------------------------------------------------------------------

function ensurePalette() {
  const tc = laserConfig.testColor || [255, 0, 0];
  const key = tc.join(',');
  if (pal && key === palKey) return;
  palKey = key;
  pal = {
    shapes: SHAPES.map((s, i) => getRgbSpreadHex(tc, 0.25 + (i * 0.5) / 6, 0.75, 0.95)),
    shapesDark: SHAPES.map((s, i) => getRgbSpreadHex(tc, 0.25 + (i * 0.5) / 6, 0.8, 0.16)),
    tri: getRgbSpreadHex(tc, 0.5, 0.25, 1),
    triDark: getRgbSpreadHex(tc, 0.5, 0.6, 0.18),
    table: getRgbSpreadHex(tc, 0.45, 0.45, 0.35),
    tableTop: getRgbSpreadHex(tc, 0.45, 0.4, 0.8),
    hud: getRgbSpreadHex(tc, 0.5, 0.25, 1),
    hudDim: getRgbSpreadHex(tc, 0.5, 0.35, 0.65),
    bgA: getRgbSpreadHex(tc, 0.55, 0.7, 0.12),
    bgB: getRgbSpreadHex(tc, 0.4, 0.7, 0.05),
    good: getRgbSpreadHex(tc, 0.33, 0.8, 1),
    bad: getRgbSpreadHex(tc, 0.75, 0.9, 1),
    start: [getRgbSpreadHex(tc, 0.4, 0.7, 0.7), getRgbSpreadHex(tc, 0.5, 0.7, 0.85), getRgbSpreadHex(tc, 0.6, 0.6, 1)],
  };
  sprites = null;
  bgCanvas = null;
  gateCanvas = null;
  figCanvas = null;
}

function makeCanvas(w, h) {
  const c = document.createElement('canvas');
  c.width = Math.max(1, Math.ceil(w));
  c.height = Math.max(1, Math.ceil(h));
  return c;
}

function shapeBounds(shape) {
  let mx = 0;
  let my = 0;
  shape.cells.forEach((c) => {
    mx = Math.max(mx, c[0] + 1);
    my = Math.max(my, c[1] + 1);
  });
  return { w: mx, h: my };
}

// Block-Mittelpunkte relativ zum Formmittelpunkt (in px, Blockgrösse size)
function blockOffsets(shape, size) {
  const b = shapeBounds(shape);
  return shape.cells.map((c) => [(c[0] + 0.5 - b.w / 2) * size, (c[1] + 0.5 - b.h / 2) * size]);
}

function drawBlocks(ctx, shape, cx, cy, size, fill, dark, alpha) {
  const offs = blockOffsets(shape, size);
  ctx.save();
  ctx.globalAlpha = alpha === undefined ? 1 : alpha;
  offs.forEach((o) => {
    const x = cx + o[0] - size / 2;
    const y = cy + o[1] - size / 2;
    // Licht-Disziplin: Steine sind Aktionsflächen → dunkel gefüllt, nur hell konturiert
    ctx.fillStyle = dark;
    ctx.fillRect(x + 1, y + 1, size - 2, size - 2);
    ctx.strokeStyle = fill;
    ctx.lineWidth = 3;
    ctx.strokeRect(x + 3.5, y + 3.5, size - 7, size - 7);
  });
  ctx.restore();
}

function ensureSprites() {
  ensurePalette();
  if (sprites) return;
  sprites = SHAPES.map((shape, i) => {
    const b = shapeBounds(shape);
    const c = makeCanvas(b.w * B + 4, b.h * B + 4);
    drawBlocks(c.getContext('2d'), shape, c.width / 2, c.height / 2, B, pal.shapes[i], pal.shapesDark[i], 1);
    return c;
  });
}

function ensureBackground() {
  ensurePalette();
  if (bgCanvas) return;
  bgCanvas = makeCanvas(W, H);
  const ctx = bgCanvas.getContext('2d');
  const g = ctx.createRadialGradient(W / 2, H / 2, 100, W / 2, H / 2, 1100);
  g.addColorStop(0, pal.bgA);
  g.addColorStop(1, '#000000');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, W, H);
  // dezentes Raster
  ctx.strokeStyle = pal.bgB;
  ctx.lineWidth = 1;
  ctx.globalAlpha = 0.6;
  for (let x = 0; x <= W; x += B) {
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, H);
    ctx.stroke();
  }
  for (let y = 0; y <= H; y += B) {
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(W, y);
    ctx.stroke();
  }
  ctx.globalAlpha = 1;
  // Tisch
  const tg = ctx.createLinearGradient(0, TABLE.top, 0, TABLE.top + TABLE.thick);
  tg.addColorStop(0, pal.tableTop);
  tg.addColorStop(1, pal.table);
  ctx.fillStyle = tg;
  ctx.fillRect(TABLE.x0, TABLE.top, TABLE.x1 - TABLE.x0, TABLE.thick);
  ctx.fillRect(TABLE.x0, TABLE.top - TABLE.rimH, TABLE.rimW, TABLE.rimH);
  ctx.fillRect(TABLE.x1 - TABLE.rimW, TABLE.top - TABLE.rimH, TABLE.rimW, TABLE.rimH);
  // Tischbeine
  ctx.fillStyle = pal.table;
  ctx.globalAlpha = 0.6;
  ctx.fillRect(TABLE.x0 + 30, TABLE.top + TABLE.thick, 22, 60);
  ctx.fillRect(TABLE.x1 - 52, TABLE.top + TABLE.thick, 22, 60);
  ctx.globalAlpha = 1;
}

function ensureGateCanvas() {
  ensureSprites();
  if (gateCanvas) return;
  gateCanvas = makeCanvas(W, H);
  const ctx = gateCanvas.getContext('2d');
  gates.forEach((g) => {
    const x0 = g.x - GATE_W / 2;
    const y0 = g.y - GATE_H / 2;
    const col = pal.shapes[g.type];
    ctx.save();
    ctx.fillStyle = '#000000';
    ctx.globalAlpha = 0.75;
    ctx.fillRect(x0, y0, GATE_W, GATE_H);
    ctx.globalAlpha = 1;
    // U-Rahmen, offen zur Bildmitte
    ctx.strokeStyle = col;
    ctx.lineWidth = 8;
    ctx.shadowColor = col;
    ctx.shadowBlur = 18;
    ctx.beginPath();
    if (g.side === 'left') {
      ctx.moveTo(x0 + GATE_W, y0);
      ctx.lineTo(x0, y0);
      ctx.lineTo(x0, y0 + GATE_H);
      ctx.lineTo(x0 + GATE_W, y0 + GATE_H);
    } else {
      ctx.moveTo(x0, y0);
      ctx.lineTo(x0 + GATE_W, y0);
      ctx.lineTo(x0 + GATE_W, y0 + GATE_H);
      ctx.lineTo(x0, y0 + GATE_H);
    }
    ctx.stroke();
    ctx.shadowBlur = 0;
    // Umriss der Form
    const offs = blockOffsets(SHAPES[g.type], B);
    ctx.setLineDash([8, 6]);
    ctx.lineWidth = 3;
    offs.forEach((o) => ctx.strokeRect(g.x + o[0] - B / 2 + 2, g.y + o[1] - B / 2 + 2, B - 4, B - 4));
    ctx.setLineDash([]);
    drawBlocks(ctx, SHAPES[g.type], g.x, g.y, B, col, pal.shapesDark[g.type], 0.18);
    ctx.restore();
    util.renderText({
      ctx,
      text: SHAPES[g.type].key,
      x: g.side === 'left' ? x0 + 30 : x0 + GATE_W - 30,
      y: y0 + 46,
      fontSize: '38px',
      fillStyle: col,
    });
  });
}

function ensureFigCanvas() {
  ensurePalette();
  if (figCanvas) return;
  figCanvas = makeCanvas(W, H);
  const ctx = figCanvas.getContext('2d');
  ctx.save();
  ctx.strokeStyle = pal.hudDim;
  ctx.lineWidth = 3;
  ctx.setLineDash([12, 8]);
  ctx.fillStyle = '#000000';
  slots.forEach((s) => {
    ctx.beginPath();
    ctx.moveTo(s.pts[0][0], s.pts[0][1]);
    ctx.lineTo(s.pts[1][0], s.pts[1][1]);
    ctx.lineTo(s.pts[2][0], s.pts[2][1]);
    ctx.closePath();
    ctx.globalAlpha = 0.6;
    ctx.fill();
    ctx.globalAlpha = 1;
    ctx.stroke();
  });
  ctx.restore();
}

// ---------------------------------------------------------------------------------------------------------
// Effekte
// ---------------------------------------------------------------------------------------------------------

function playSound(src, volume) {
  try {
    const a = new Audio(src);
    a.volume = volume === undefined ? 0.6 : volume;
    const p = a.play();
    if (p && p.catch) p.catch(() => {});
  } catch (e) {
    // Ton ist nicht wichtig
  }
}

function burst(x, y, color, count, speed) {
  for (let i = 0; i < count; i++) {
    if (particles.length >= DIFFICULTY.maxParticles) particles.shift();
    const a = Math.random() * Math.PI * 2;
    const v = (0.3 + Math.random()) * (speed || 400);
    const life = 0.5 + Math.random() * 0.7;
    particles.push({ x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v, life, max: life, color, size: 3 + Math.random() * 6 });
  }
}

function addFloater(x, y, text, color) {
  if (floaters.length > 30) floaters.shift();
  floaters.push({ x, y, text, color, life: 1.3 });
}

function updateEffects(dt, ctx) {
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  particles.slice().forEach((p) => {
    p.life -= dt;
    if (p.life <= 0) {
      particles.splice(particles.indexOf(p), 1);
      return;
    }
    p.vy += 600 * dt;
    p.x += p.vx * dt;
    p.y += p.vy * dt;
    ctx.globalAlpha = Math.max(0, p.life / p.max);
    ctx.fillStyle = p.color;
    ctx.fillRect(p.x - p.size / 2, p.y - p.size / 2, p.size, p.size);
  });
  ctx.restore();
  floaters.slice().forEach((f) => {
    f.life -= dt;
    if (f.life <= 0) {
      floaters.splice(floaters.indexOf(f), 1);
      return;
    }
    f.y -= 70 * dt;
    ctx.save();
    ctx.globalAlpha = Math.min(1, f.life);
    util.renderText({ ctx, text: f.text, x: f.x, y: f.y, fontSize: '44px', fillStyle: f.color });
    ctx.restore();
  });
}

// ---------------------------------------------------------------------------------------------------------
// Physik – eigene, achsenparallele Stapel-Physik (kein p2)
// ---------------------------------------------------------------------------------------------------------
// Die Steine drehen sich nie, deshalb reichen Rechtecke: Jeder Stein besteht aus seinen Block-Rechtecken
// (Dreieck: seine Bounding-Box). Freie Steine fallen senkrecht; treffen sie unten auf den Tisch oder einen
// anderen Stein, setzen sie exakt darauf auf. Fehlt die Stütze (Stein darunter weggenommen), fallen sie von
// selbst weiter. Kein seitliches Schieben, kein Drehen – billig (O(n²) mit n ≤ ~30) und völlig vorhersehbar.
// Das Objekt in p.body ist bewusst schlicht: { position: [x, y], velocity: [vx, vy], gravityScale, rects }.

const PHYS_EPS = 0.5;

function createWorld() {
  world = {
    statics: [
      { x0: TABLE.x0, x1: TABLE.x1, y0: TABLE.top },
      { x0: TABLE.x0, x1: TABLE.x0 + TABLE.rimW, y0: TABLE.top - TABLE.rimH },
      { x0: TABLE.x1 - TABLE.rimW, x1: TABLE.x1, y0: TABLE.top - TABLE.rimH },
    ],
  };
}

function makeBody(x, y, rects) {
  return { position: [x, y], velocity: [0, 0], gravityScale: 1, collisionResponse: true, rects, resting: false };
}

function pieceRects(type) {
  return blockOffsets(SHAPES[type], B).map((o) => ({ ox: o[0], oy: o[1], hw: B / 2, hh: B / 2 }));
}

function triSize() {
  const s = FIG.side * 0.95;
  return { w: s, h: (s * Math.sqrt(3)) / 2 };
}

function triRects() {
  const t = triSize();
  // Schwerpunkt liegt h/6 unter der Mitte der Bounding-Box
  return [{ ox: 0, oy: -t.h / 6, hw: t.w / 2, hh: t.h / 2 }];
}

function halfWidth(body) {
  let m = 0;
  body.rects.forEach((r) => {
    m = Math.max(m, Math.abs(r.ox) + r.hw);
  });
  return m;
}

function bodyBottom(body) {
  let m = -Infinity;
  body.rects.forEach((r) => {
    m = Math.max(m, body.position[1] + r.oy + r.hh);
  });
  return m;
}

function bodyX(p) {
  return p.body.position[0];
}
function bodyY(p) {
  return p.body.position[1];
}

function setGravityOn(body, on) {
  body.gravityScale = on ? 1 : 0;
}

function isSolid(p) {
  return !p.drag.isGrabbed() && !p.auto;
}

function stepPhysics(dt) {
  const list = pieces.filter(isSolid);
  // unterste zuerst, damit ein Stapel in einem Frame sauber aufeinander liegt
  list.sort((a, b) => bodyBottom(b.body) - bodyBottom(a.body));
  list.forEach((p) => {
    const b = p.body;
    if (b.gravityScale > 0) {
      b.velocity[1] = Math.min(DIFFICULTY.maxFall, b.velocity[1] + DIFFICULTY.gravity * b.gravityScale * dt);
    }
    // seitlich nur nach einem Rückstoß aus dem falschen Tor
    if (b.velocity[0] !== 0) {
      b.position[0] += b.velocity[0] * dt;
      b.velocity[0] *= Math.exp(-2.5 * dt);
      if (Math.abs(b.velocity[0]) < 5) b.velocity[0] = 0;
    }
    const move = b.velocity[1] * dt;
    if (move <= 0) {
      b.position[1] += move;
      b.resting = false;
      return;
    }
    let allowed = move;
    const px = b.position[0];
    const py = b.position[1];
    b.rects.forEach((r) => {
      const ax0 = px + r.ox - r.hw + PHYS_EPS;
      const ax1 = px + r.ox + r.hw - PHYS_EPS;
      const abot = py + r.oy + r.hh;
      const test = (x0, x1, top) => {
        if (x1 <= ax0 || x0 >= ax1) return;
        const gap = top - abot;
        if (gap < -PHYS_EPS) return; // Hindernis liegt darüber bzw. überlappt schon → ignorieren
        if (gap < allowed) allowed = Math.max(0, gap);
      };
      world.statics.forEach((s) => test(s.x0, s.x1, s.y0));
      list.forEach((o) => {
        if (o === p) return;
        const ob = o.body;
        ob.rects.forEach((q) =>
          test(ob.position[0] + q.ox - q.hw, ob.position[0] + q.ox + q.hw, ob.position[1] + q.oy - q.hh)
        );
      });
    });
    b.position[1] += allowed;
    if (allowed < move) {
      b.velocity[1] = 0;
      b.velocity[0] = 0;
      b.resting = true;
    } else {
      b.resting = false;
    }
  });
}

function createDrag(p) {
  p.drag = guiDragHandle({
    posX: p.body.position[0],
    posY: p.body.position[1],
    radius: DIFFICULTY.grabRadius,
    grabSpeed: DIFFICULTY.grabSpeed,
    fullPercent: DIFFICULTY.grabFullPercent,
    catchFactor: 1.8,
    followSmoothing: 9,
    maxSpeed: DIFFICULTY.maxCarrySpeed,
    dropDelay: 0.4,
    visible: false,
    onGrab: () => {
      setGravityOn(p.body, false);
      p.body.velocity[0] = 0;
      p.body.velocity[1] = 0;
      playSound(soundGrab, 0.25);
      // Nachbarn sperren: ein Laser greift nur einen Stein
      pieces.forEach((o) => {
        if (o === p || o.drag.isGrabbed()) return;
        if (Math.hypot(o.body.position[0] - p.body.position[0], o.body.position[1] - p.body.position[1]) < DIFFICULTY.grabBlockRadius) {
          o.drag.setValue(0);
          o.grabBlock = DIFFICULTY.grabBlockTime;
        }
      });
    },
    onDrop: () => {
      setGravityOn(p.body, true);
      p.body.velocity[1] = 0;
      if (p.kind === 'tri') tryPlaceTriangle(p, DIFFICULTY.snapDistance);
    },
  });
}

function addPiece(type, x, y) {
  const body = makeBody(x, y, pieceRects(type));
  const p = { kind: 'piece', type, body, grabBlock: 0, reject: 0, auto: null, age: 0 };
  createDrag(p);
  pieces.push(p);
  return p;
}

function triVertices(side) {
  const h = (side * Math.sqrt(3)) / 2;
  // Spitze oben, Schwerpunkt im Ursprung
  return [[0, (-2 * h) / 3], [side / 2, h / 3], [-side / 2, h / 3]];
}

function addTriangle(x, y) {
  const body = makeBody(x, y, triRects());
  const p = { kind: 'tri', type: -1, body, grabBlock: 0, reject: 0, auto: null, age: 0 };
  createDrag(p);
  pieces.push(p);
  return p;
}

function removePiece(p) {
  const i = pieces.indexOf(p);
  if (i >= 0) pieces.splice(i, 1);
}

// Innenbereich des Tisches (zwischen den Rändern), dort landen alle Steine
function tableInner() {
  return { x0: TABLE.x0 + TABLE.rimW + 8, x1: TABLE.x1 - TABLE.rimW - 8 };
}

// Verlorener Stein: fällt oben wieder herein – immer genau über dem Tisch
function respawn(p) {
  if (p.drag.isGrabbed()) p.drag.drop();
  setGravityOn(p.body, true);
  const inner = tableInner();
  const hw = halfWidth(p.body);
  p.body.position[0] = inner.x0 + hw + Math.random() * Math.max(0, inner.x1 - inner.x0 - 2 * hw);
  p.body.position[1] = -150 - Math.random() * 150;
  p.body.velocity[0] = 0;
  p.body.velocity[1] = 0;
  p.auto = null;
}

// ---------------------------------------------------------------------------------------------------------
// Tore und Dreiecke
// ---------------------------------------------------------------------------------------------------------

function shuffle(arr) {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    const t = arr[i];
    arr[i] = arr[j];
    arr[j] = t;
  }
  return arr;
}

function buildGates() {
  const types = shuffle([0, 1, 2, 3, 4, 5, 6]);
  gates = GATE_SLOTS.map((s, i) => ({ x: s.x, y: s.y, side: s.side, type: types[i], good: 0, bad: 0 }));
  gateCanvas = null;
}

function gateAt(x, y) {
  for (let i = 0; i < gates.length; i++) {
    const g = gates[i];
    if (Math.abs(x - g.x) < GATE_W / 2 && Math.abs(y - g.y) < GATE_H / 2) return g;
  }
  return null;
}

function checkGates(p) {
  if (p.reject > 0) return;
  const x = p.body.position[0];
  const y = p.body.position[1];
  const g = gateAt(x, y);
  if (!g) return;
  if (p.kind === 'piece' && g.type === p.type) {
    // richtig einsortiert
    stats.sorted++;
    g.good = 1;
    burst(x, y, pal.shapes[p.type], 40, 500);
    addFloater(g.x, g.y - GATE_H / 2 - 10, '+1', pal.good);
    playSound(soundPlop, 0.6);
    removePiece(p);
    return;
  }
  // falsches Tor → zurückstossen
  g.bad = 1;
  stats.wrong++;
  shake = 0.35;
  p.reject = DIFFICULTY.rejectCooldown;
  p.auto = null;
  p.body.collisionResponse = true;
  if (p.drag.isGrabbed()) p.drag.drop();
  setGravityOn(p.body, true);
  p.body.velocity[0] = g.side === 'left' ? 900 : -900;
  p.body.velocity[1] = -500;
  burst(x, y, pal.bad, 20, 300);
  addFloater(x, y - 60, 'Falsches Tor!', pal.bad);
  playSound(soundError, 0.5);
}

function freeSlots() {
  return slots.filter((s) => !s.filled);
}

function placeInSlot(p, s) {
  s.filled = true;
  s.fillTime = 0;
  stats.triangles++;
  removePiece(p);
  burst(s.x, s.y, pal.tri, 50, 450);
  addFloater(s.x, s.y - 70, 'Passt!', pal.good);
  playSound(soundPickup, 0.7);
}

function tryPlaceTriangle(p, maxDist) {
  let best = null;
  let bestD = maxDist;
  freeSlots().forEach((s) => {
    const d = Math.hypot(s.x - p.body.position[0], s.y - p.body.position[1]);
    if (d <= bestD) {
      bestD = d;
      best = s;
    }
  });
  if (best) placeInSlot(p, best);
}

// ---------------------------------------------------------------------------------------------------------
// Ablauf: Level, Ladungen
// ---------------------------------------------------------------------------------------------------------

function piecesPerLoad() {
  return Math.min(DIFFICULTY.piecesMax, DIFFICULTY.piecesStart + (level - 1) * DIFFICULTY.piecesPerLevel);
}

function clearPieces() {
  pieces.slice().forEach((p) => removePiece(p));
  pieces = [];
  spawnQueue = [];
}

// Eine WELLE: alle Steine erscheinen gleichzeitig als Formation (Reihen) über dem Bild – jede Reihe passt
// komplett in die Tischbreite – und fallen zusammen herunter auf die Linie in der Mitte.
function startLoad() {
  loadsDone++;
  const n = piecesPerLoad();
  const q = [];
  for (let i = 0; i < n; i++) q.push(i % SHAPES.length);
  shuffle(q);
  q.splice(Math.floor(Math.random() * (q.length + 1)), 0, 'tri');
  const inner = tableInner();
  const innerW = inner.x1 - inner.x0;
  const GAP = DIFFICULTY.waveGap;
  const rows = [];
  let row = { items: [], w: 0, h: 0 };
  q.forEach((t) => {
    const tri = t === 'tri';
    const w = tri ? triSize().w : shapeBounds(SHAPES[t]).w * B;
    const h = tri ? triSize().h : shapeBounds(SHAPES[t]).h * B;
    if (row.items.length && row.w + GAP + w > innerW) {
      rows.push(row);
      row = { items: [], w: 0, h: 0 };
    }
    row.w += (row.items.length ? GAP : 0) + w;
    row.h = Math.max(row.h, h);
    row.items.push({ t, w, h });
  });
  if (row.items.length) rows.push(row);
  let yBottom = -30; // Unterkante der untersten Reihe, knapp über dem Bildrand
  rows.forEach((r) => {
    let x = inner.x0 + Math.random() * Math.max(0, innerW - r.w);
    r.items.forEach((it) => {
      const cx = x + it.w / 2;
      const cy = yBottom - it.h / 2;
      if (it.t === 'tri') addTriangle(cx, cy + it.h / 6);
      else addPiece(it.t, cx, cy);
      x += it.w + GAP;
    });
    yBottom -= r.h + DIFFICULTY.waveRowGap;
  });
  spawnQueue = [];
  waveBanner = 2.2;
  playSound(soundLoad, 0.4);
}

function startLevel(l) {
  level = l;
  ensurePalette();
  if (!world) createWorld();
  clearPieces();
  slots = buildSlots(FIGURES[Math.min(level - 1, FIGURES.length - 1)]);
  figCanvas = null;
  buildGates();
  loadsDone = 0;
  loadsTotal = slots.length;
  loadPause = 0;
  levelTime = 0;
  gameState = 'play';
  stateTime = 0;
  startLoad();
}

function resetGame() {
  ensurePalette();
  if (world) clearPieces();
  world = null;
  createWorld();
  particles = [];
  floaters = [];
  stats = { sorted: 0, wrong: 0, triangles: 0 };
  levelTimes = [];
  totalTime = 0;
  shake = 0;
  flash = 0;
}

function startGame() {
  resetGame();
  startLevel(1);
}

function finishLevel() {
  levelTimes.push(levelTime);
  // Reste auf dem Tisch als Bonus-Feuerwerk auflösen
  pieces.slice().forEach((p) => {
    burst(p.body.position[0], p.body.position[1], p.kind === 'tri' ? pal.tri : pal.shapes[p.type], 12, 400);
    removePiece(p);
  });
  spawnQueue = [];
  flash = 1;
  stateTime = 0;
  if (level >= FIGURES.length) {
    gameState = 'won';
    againButton = null;
    finalScore = computeScore();
    highscore.addEntry({
      punkte: finalScore,
      sortiert: stats.sorted,
      dreiecke: stats.triangles,
      falscheTore: stats.wrong,
      minuten: totalTime / 60,
    });
    newHighscore = highscore.lastEntryNewHighscore();
    playSound(soundWin, 0.8);
  } else {
    gameState = 'levelup';
    playSound(soundLevelUp, 0.7);
  }
}

// Punkte: siehe SCORE oben, plus Zeitbonus (je schneller, desto mehr; nie negativ)
function computeScore() {
  const figures = levelTimes.length;
  const base =
    stats.sorted * SCORE.sorted + stats.triangles * SCORE.triangle + figures * SCORE.figure + stats.wrong * SCORE.wrong;
  const timeBonus = Math.max(0, Math.round(3000 - totalTime * 2));
  return Math.max(0, base + timeBonus);
}

function tableEmpty() {
  return spawnQueue.length === 0 && pieces.length === 0;
}

// ---------------------------------------------------------------------------------------------------------
// Spielzustand 'play'
// ---------------------------------------------------------------------------------------------------------

function keyboardTest(dt) {
  // A gedrückt halten: alle 0.25 s fliegt ein Stein automatisch in sein Tor
  if (isKeyDown('KeyA')) {
    autoKeyTimer -= dt;
    if (autoKeyTimer <= 0) {
      autoKeyTimer = 0.25;
      const cand = pieces.filter((p) => p.kind === 'piece' && !p.auto && p.body.position[1] > 0);
      if (cand.length) {
        const p = cand[Math.floor(Math.random() * cand.length)];
        const g = gates.find((gg) => gg.type === p.type);
        if (p.drag.isGrabbed()) p.drag.drop();
        p.auto = { x: g.x, y: g.y };
        p.body.collisionResponse = false;
        setGravityOn(p.body, false);
      }
    }
  } else {
    autoKeyTimer = 0;
  }
  if (keyEdge('KeyB')) {
    const t = pieces.find((p) => p.kind === 'tri');
    const s = freeSlots()[0];
    if (t && s) placeInSlot(t, s);
  }
  if (keyEdge('KeyN')) {
    slots.forEach((s) => (s.filled = true));
  }
}

function updatePlay(grid, dt) {
  levelTime += dt;
  totalTime += dt;

  if (waveBanner > 0) waveBanner -= dt;

  keyboardTest(dt);

  // Eingabe (Handle-Wrapping: unsichtbarer dragHandle folgt dem Körper)
  pieces.slice().forEach((p) => {
    p.age += dt;
    if (p.grabBlock > 0) {
      p.grabBlock -= dt;
      p.drag.setValue(0);
    }
    if (p.reject > 0) p.reject -= dt;
    const bx = p.body.position[0];
    const by = p.body.position[1];
    if (p.auto) {
      const dx = p.auto.x - bx;
      const dy = p.auto.y - by;
      const d = Math.hypot(dx, dy) || 1;
      const step = Math.min(d, 1400 * dt);
      p.body.position[0] += (dx / d) * step;
      p.body.position[1] += (dy / d) * step;
      return;
    }
    p.drag.setX(bx);
    p.drag.setY(by);
    p.drag.handle(grid, dt);
    if (p.drag.isGrabbed()) {
      // getragener Stein folgt dem (unsichtbaren) Greif-Griff direkt, ohne Schwerkraft
      p.body.position[0] = p.drag.getX();
      p.body.position[1] = p.drag.getY();
      p.body.velocity[0] = 0;
      p.body.velocity[1] = 0;
    }
  });

  stepPhysics(dt);

  // Tore, Rand, Dreiecke
  pieces.slice().forEach((p) => {
    const x = p.body.position[0];
    const y = p.body.position[1];
    if (y > H + 150 || x < -200 || x > W + 200) {
      respawn(p);
      return;
    }
    checkGates(p);
  });

  if (slots.length && freeSlots().length === 0) {
    finishLevel();
    return;
  }

  // Nächste Ladung
  if (tableEmpty() && loadsDone < loadsTotal) {
    if (loadPause <= 0) loadPause = DIFFICULTY.loadPause;
    loadPause -= dt;
    if (loadPause <= 0 || keyEdge('Space')) {
      loadPause = 0;
      startLoad();
    }
  }
}

// ---------------------------------------------------------------------------------------------------------
// Zeichnen
// ---------------------------------------------------------------------------------------------------------

function fmtTime(t) {
  const m = Math.floor(t / 60);
  const s = Math.floor(t % 60);
  return m + ':' + (s < 10 ? '0' : '') + s;
}

function drawGates(ctx, dt) {
  ensureGateCanvas();
  ctx.drawImage(gateCanvas, 0, 0);
  const grabbedTypes = {};
  pieces.forEach((p) => {
    if (p.kind === 'piece' && p.drag.isGrabbed()) grabbedTypes[p.type] = true;
  });
  gates.forEach((g) => {
    g.good = Math.max(0, g.good - dt * 2);
    g.bad = Math.max(0, g.bad - dt * 2);
    const x0 = g.x - GATE_W / 2;
    const y0 = g.y - GATE_H / 2;
    ctx.save();
    if (grabbedTypes[g.type]) {
      // passendes Tor pulsiert, solange so ein Stein getragen wird
      ctx.globalAlpha = 0.35 + 0.25 * Math.sin(clock * 8);
      ctx.strokeStyle = pal.shapes[g.type];
      ctx.lineWidth = 14;
      ctx.strokeRect(x0 - 6, y0 - 6, GATE_W + 12, GATE_H + 12);
    }
    if (g.good > 0) {
      ctx.globalAlpha = g.good * 0.5;
      ctx.fillStyle = pal.good;
      ctx.fillRect(x0, y0, GATE_W, GATE_H);
    }
    if (g.bad > 0) {
      ctx.globalAlpha = g.bad * 0.6;
      ctx.fillStyle = pal.bad;
      ctx.fillRect(x0, y0, GATE_W, GATE_H);
    }
    ctx.restore();
  });
}

function drawTrianglePath(ctx, pts) {
  ctx.beginPath();
  ctx.moveTo(pts[0][0], pts[0][1]);
  ctx.lineTo(pts[1][0], pts[1][1]);
  ctx.lineTo(pts[2][0], pts[2][1]);
  ctx.closePath();
}

function drawFigure(ctx, dt) {
  ensureFigCanvas();
  ctx.drawImage(figCanvas, 0, 0);
  ctx.save();
  slots.forEach((s) => {
    if (!s.filled) return;
    s.fillTime += dt;
    const pop = Math.max(0, 1 - s.fillTime * 3);
    ctx.fillStyle = pal.tri;
    ctx.shadowColor = pal.tri;
    ctx.shadowBlur = 15 + pop * 30;
    ctx.globalAlpha = 0.85;
    drawTrianglePath(ctx, s.pts);
    ctx.fill();
    ctx.shadowBlur = 0;
    ctx.globalAlpha = 1;
    ctx.strokeStyle = pal.triDark;
    ctx.lineWidth = 4;
    ctx.stroke();
  });
  ctx.restore();
  const filled = slots.length - freeSlots().length;
  util.renderText({
    ctx,
    text: 'Figur: ' + filled + ' / ' + slots.length,
    x: FIG.cx,
    y: H - 12,
    fontSize: '30px',
    fillStyle: pal.hudDim,
  });
}

function drawGrabRing(ctx, p, x, y) {
  const v = p.drag.getValue();
  if (p.drag.isGrabbed()) {
    ctx.save();
    ctx.strokeStyle = pal.hud;
    ctx.globalAlpha = 0.5;
    ctx.lineWidth = 3;
    ctx.setLineDash([10, 10]);
    ctx.beginPath();
    ctx.arc(x, y, DIFFICULTY.grabRadius * 1.8, clock * 2, clock * 2 + Math.PI * 2);
    ctx.stroke();
    ctx.restore();
  } else if (v > 0) {
    ctx.save();
    ctx.strokeStyle = pal.hud;
    ctx.lineWidth = 8;
    ctx.beginPath();
    ctx.arc(x, y, DIFFICULTY.grabRadius, -Math.PI / 2, -Math.PI / 2 + (Math.PI * 2 * v) / 100);
    ctx.stroke();
    ctx.restore();
  }
}

function drawPieces(ctx) {
  ensureSprites();
  pieces.forEach((p) => {
    const x = bodyX(p);
    const y = bodyY(p);
    const grabbed = p.drag.isGrabbed();
    if (p.kind === 'piece') {
      const spr = sprites[p.type];
      ctx.save();
      if (grabbed) {
        ctx.shadowColor = pal.shapes[p.type];
        ctx.shadowBlur = 30;
      }
      if (p.reject > 0) ctx.globalAlpha = 0.6 + 0.4 * Math.sin(clock * 40);
      ctx.drawImage(spr, x - spr.width / 2, y - spr.height / 2);
      ctx.restore();
    } else {
      const side = FIG.side * 0.95;
      const v = triVertices(side);
      ctx.save();
      ctx.fillStyle = pal.triDark;
      ctx.shadowColor = pal.tri;
      ctx.shadowBlur = 6 + 4 * Math.sin(clock * 5);
      ctx.beginPath();
      ctx.moveTo(x + v[0][0], y + v[0][1]);
      ctx.lineTo(x + v[1][0], y + v[1][1]);
      ctx.lineTo(x + v[2][0], y + v[2][1]);
      ctx.closePath();
      ctx.fill();
      ctx.shadowBlur = 0;
      ctx.strokeStyle = pal.tri;
      ctx.lineWidth = 5;
      ctx.stroke();
      ctx.restore();
    }
    drawGrabRing(ctx, p, x, y);
  });
}

function drawHud(ctx) {
  util.renderText({
    ctx,
    text: 'Level ' + level + ' · Welle ' + Math.max(1, loadsDone) + '/' + loadsTotal,
    x: W / 2,
    y: 56,
    fontSize: '46px',
    fillStyle: pal.hud,
  });
  util.renderText({
    ctx,
    text: 'Sortiert: ' + stats.sorted + '   Zeit: ' + fmtTime(levelTime) + '   Auf dem Tisch: ' + (pieces.length + spawnQueue.length),
    x: W / 2,
    y: 104,
    fontSize: '32px',
    fillStyle: pal.hudDim,
  });
  if (tableEmpty() && loadPause > 0) {
    util.renderText({ ctx, text: 'Tisch leer – neue Welle!', x: W / 2, y: 400, fontSize: '80px', fillStyle: pal.good });
  }
  if (waveBanner > 0) {
    ctx.save();
    ctx.globalAlpha = Math.min(1, waveBanner);
    util.renderText({ ctx, text: 'WELLE ' + loadsDone + '/' + loadsTotal, x: W / 2, y: 300, fontSize: '110px', fillStyle: pal.hud });
    ctx.restore();
  }
}

function drawScene(ctx, dt) {
  ensureBackground();
  ctx.save();
  if (shake > 0) ctx.translate((Math.random() - 0.5) * 24 * shake, (Math.random() - 0.5) * 24 * shake);
  ctx.drawImage(bgCanvas, 0, 0);
  drawFigure(ctx, dt);
  drawGates(ctx, dt);
  drawPieces(ctx);
  ctx.restore();
  updateEffects(dt, ctx);
  if (flash > 0) {
    ctx.save();
    ctx.globalAlpha = flash * 0.4;
    ctx.fillStyle = pal.tri;
    ctx.fillRect(0, 0, W, H);
    ctx.restore();
  }
}

// ---------------------------------------------------------------------------------------------------------
// Zustände
// ---------------------------------------------------------------------------------------------------------

function handleStart(grid, dt, ctx) {
  ensureSprites();
  ensureBackground();
  ctx.drawImage(bgCanvas, 0, 0);
  // fallende Deko-Steine
  for (let i = 0; i < 14; i++) {
    const t = SHAPES.length;
    const k = i % t;
    const spr = sprites[k];
    const x = ((i * 337) % 1800) + 60;
    const y = ((clock * (80 + (i % 5) * 25) + i * 173) % (H + 300)) - 150;
    ctx.save();
    ctx.globalAlpha = 0.35;
    ctx.drawImage(spr, x - spr.width / 2, y - spr.height / 2);
    ctx.restore();
  }
  util.renderText({ ctx, text: 'SORTIERSPIEL', x: W / 2, y: 230, fontSize: '150px', fillStyle: pal.hud });
  util.renderText({
    ctx,
    text: 'Steine mit dem Laser greifen und ins passende Tor bringen.\nGoldene Dreiecke unter dem Tisch zur Figur zusammenlegen.',
    x: W / 2,
    y: 330,
    fontSize: '36px',
    lineHeight: 50,
    fillStyle: pal.hudDim,
  });
  if (!startButton) {
    startButton = guiFillButton({
      label: 'START',
      posX: W / 2,
      posY: 680,
      radius: 150,
      edges: 4,
      speedUp: 45,
      speedDown: 20,
      activeValue: 85,
      lineWidth: 4,
      normalColor: pal.start[0],
      growColor: pal.start[1],
      activeColor: pal.start[2],
      onEnterActive: () => startGame(),
    });
  }
  startButton.handle(grid, dt);
  if (keyEdge('Space')) startGame();
  highscore.renderHighAndLowScores(ctx);
}

function handleLevelUp(grid, dt, ctx) {
  stateTime += dt;
  drawScene(ctx, dt);
  ctx.save();
  ctx.fillStyle = '#000000';
  ctx.globalAlpha = 0.5;
  ctx.fillRect(0, 300, W, 330);
  ctx.restore();
  util.renderText({ ctx, text: 'FIGUR KOMPLETT!', x: W / 2, y: 420, fontSize: '110px', fillStyle: pal.tri });
  util.renderText({
    ctx,
    text: 'Level ' + level + ' in ' + fmtTime(levelTime) + ' · weiter mit Level ' + (level + 1),
    x: W / 2,
    y: 520,
    fontSize: '48px',
    fillStyle: pal.hud,
  });
  util.renderText({
    ctx,
    text: 'Nächstes Mal: ' + piecesPerLoad() + '+ Steine pro Welle, neue Tore',
    x: W / 2,
    y: 590,
    fontSize: '34px',
    fillStyle: pal.hudDim,
  });
  if (stateTime > DIFFICULTY.levelUpDuration || (stateTime > 0.5 && keyEdge('Space'))) startLevel(level + 1);
}

function handleWon(grid, dt, ctx) {
  stateTime += dt;
  ensureBackground();
  ctx.drawImage(bgCanvas, 0, 0);
  if (Math.random() < 0.3) burst(Math.random() * W, Math.random() * H * 0.6, pal.shapes[Math.floor(Math.random() * 7)], 20, 350);
  updateEffects(dt, ctx);
  util.renderText({ ctx, text: 'GESCHAFFT!', x: W / 2, y: 220, fontSize: '150px', fillStyle: pal.tri });
  util.renderText({
    ctx,
    text:
      'Alle ' + FIGURES.length + ' Figuren gelegt in ' + fmtTime(totalTime) + '\n' +
      'Steine sortiert: ' + stats.sorted + '   Falsche Tore: ' + stats.wrong + '   Dreiecke: ' + stats.triangles + '\n' +
      finalScore + ' Punkte' + (newHighscore ? '  – NEUER HIGHSCORE! Wie damals am Amiga.' : ''),
    x: W / 2,
    y: 330,
    fontSize: '44px',
    lineHeight: 64,
    fillStyle: pal.hud,
  });
  if (stateTime > 2) {
    if (!againButton) {
      againButton = guiFillButton({
        label: 'NOCHMAL',
        posX: W / 2,
        posY: 720,
        radius: 140,
        edges: 4,
        speedUp: 45,
        speedDown: 20,
        activeValue: 85,
        lineWidth: 4,
        normalColor: pal.start[0],
        growColor: pal.start[1],
        activeColor: pal.start[2],
        onEnterActive: () => startGame(),
      });
    }
    againButton.handle(grid, dt);
    if (keyEdge('Space')) startGame();
  }
  highscore.renderHighAndLowScores(ctx);
}

export default {
  name: 'Sortierspiel',
  description:
    'Sortierspiel (Idee: Georg)\n\n' +
    'Tetris-Steine fallen auf den Tisch in der Mitte.\n' +
    'Laser auf einen Stein halten, bis der Ring voll ist – dann folgt er euren Lasern.\n' +
    'Jeden Stein in SEIN Tor am Rand bringen. Falsche Tore stoßen ihn zurück.\n' +
    'Mit jeder Ladung fällt ein goldenes Dreieck: unter dem Tisch in die Figur legen.\n' +
    'Figur komplett = Level geschafft!',
  image: 'media/img/gametitles/laser-sorter-###4###.png',
  init() {
    ensurePalette();
    gameState = 'start';
    startButton = null;
    againButton = null;
    stateTime = 0;
    resetGame();
  },
  handle(grid, elapsed) {
    const dt = Math.min(elapsed || 0, 0.1);
    const ctx = MasterCanvas.get2dContext();
    ensurePalette();
    clock += dt;
    shake = Math.max(0, shake - dt);
    flash = Math.max(0, flash - dt * 1.5);
    if (gameState === 'play' && !world) startGame();
    if (gameState === 'start') {
      handleStart(grid, dt, ctx);
    } else if (gameState === 'play') {
      updatePlay(grid, dt);
      drawScene(ctx, dt);
      if (gameState === 'play') drawHud(ctx);
    } else if (gameState === 'levelup') {
      handleLevelUp(grid, dt, ctx);
    } else if (gameState === 'won') {
      handleWon(grid, dt, ctx);
    }
  },
  stop() {
    if (world) clearPieces();
    world = null;
    particles = [];
    floaters = [];
    gameState = 'start';
  },
};
