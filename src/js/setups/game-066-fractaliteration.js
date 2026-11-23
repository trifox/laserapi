/**
 * Fractal-Iteration – kooperative Iterationsjagd im Apfelmännchen
 *
 * Erstellt mit Claude Opus 5.5 (claude-opus-5-5), Idee: Christian Kleinhuis.
 *
 * Worum geht's:
 *   Ein Mandelbrot-Fraktal (Escape-Time-Färbung, jede Farbstufe = eine Iterationszahl) füllt den Saal.
 *   Das Spiel sagt eine Ziel-Iteration an: „LEUCHTE ITERATION 17 AN!“. Egal wo – jede Stelle, deren
 *   Fluchtzeit im Zielband (Ziel ± Toleranz) liegt, zählt. Alle Laser suchen gleichzeitig.
 *   Liegen Laser im Zielband, füllt sich die FANG-ENERGIE (mehr Laser im Band = schneller, gedeckelt).
 *   Voll = gefangen: Punkte (= die Iterationszahl selbst + Zeitbonus), Orbit-Explosion, nächstes Ziel.
 *   Pro Level DIFFICULTY.targetsPerLevel Ziele, dann Zoomfahrt an eine tiefere Stelle (Seepferdchental,
 *   Elefantental, Feigenbaum-Punkt, Mini-Brot …). Je tiefer, desto absurder die Zahlen – Iteration 1056
 *   ist kein Bug, das ist Fraktal-Humor. Ab Level 5 wird zuerst ITERATION 65536 angesagt (Scherz).
 *
 * Hinweise (Kombi, Nutzerwunsch):
 *   1. Beim Ansagen blinkt das Zielband EINMAL kurz auf – man sieht kurz, wo es liegt.
 *   2. Danach hat jeder Laser einen Wärmer/Kälter-Ring: je näher die Iteration unter dem Laser am Ziel,
 *      desto grösser/heller/wärmer der Ring. Daneben steht die Iteration unter dem Laser und die Differenz.
 *   Ausserdem zeichnet jeder Laser seinen ORBIT (die Folge z → z² + c) als kleine Leuchtspur – daher die Orbit-Spuren.
 *
 * Strafe für Wildleuchten: Laser in der schwarzen Menge (konvergent, „unendlich viele Iterationen“)
 *   saugen Fang-Energie ab. Läuft die Zeit für ein Ziel ab: Leben weg („divergiert“). 0 Leben = Game Over.
 *
 * Multiplayer / One-Pixel-Plattform: Jeder Laser (oder jeder Netz-Spieler mit seinem einen Pixel) ist ein
 *   eigener Sucher mit eigenem Ring und Orbit (gui/blobTracker). Gemeinsamer Team-Score, kein Gegner –
 *   aber wer ins Schwarze leuchtet, sabotiert alle.
 *
 * Tastatur (Test ohne Laser): Leertaste = Start/Neustart, 1 = aktuelles Ziel sofort fangen,
 *   2 = Level überspringen, B (halten) = drei kreisende Test-Laser.
 *
 * Ähnlichkeiten / Herkunft:
 *   - game-008 Mandelbrot (Fraktal-Explorer mit Reglern) und game-022 Fractal Bakery (Chris' letztes Spiel,
 *     Mandelbrot als Kulisse) – hier ist die Fluchtzeit selbst erstmals das Spielziel.
 *   - game-027 Simon: „Ansage → Saal reagiert“-Rhythmus.
 *   - game-065 Fraktalreich: dort sind Iterationen Währung, hier Zielscheibe.
 *   - Klassiker: Fractint (DOS, 1988) – zeilenweiser Aufbau mit Scanlinie und Palettenrotation sind eine
 *     Verneigung davor; Spielprinzip „finde das Ding im Gewusel“ wie Where's Waldo? (NES/Amiga 1991).
 *
 * Engine-Rücksichten (siehe CLAUDE.md): dt geclampt, Zustand vorbelegt (handle() ohne init() läuft),
 * keine Debug-Tasten belegt, Fraktal progressiv mit Zeitbudget statt pro Frame neu.
 */

import { getRgbSpread, getRgbSpreadHex } from '../util.js';
var util = require('../util.js').default;
var laserConfig = require('../LaserApiConfig.js').default;
var MasterCanvas = require('../MasterCanvas').default;
var guiFillButton = require('./gui/fillButton-ai2').default;
var guiBlobTracker = require('./gui/blobTracker').default;
var createHighscore = require('../util/highscore').default;
import soundCatch from '../../../public/media/opengameart/Item Pickup.ogg';
import soundLevelUp from '../../../public/media/opengameart/Level Up.ogg';
import soundError from '../../../public/media/opengameart/Menu Error.ogg';
import soundAnnounce from '../../../public/media/opengameart/Menu Move.ogg';
import soundZoom from '../../../public/media/opengameart/Transition.ogg';
import soundGameOver from '../../../public/media/opengameart/Music Box Game Over III.wav';

// ---------------------------------------------------------------------------------------------
// Einstellungen
// ---------------------------------------------------------------------------------------------

const DIFFICULTY = {
  lives: 3,
  targetsPerLevel: 3,
  startTargetTime: 30, // Sekunden pro Ziel in Level 1
  targetTimePerLevel: -2, // pro Level
  minTargetTime: 14,
  catchRate: 0.55, // Fang-Energie pro Sekunde und Laser im Band
  teamCap: 4, // höchstens so viele Laser zählen (Teamwork gedeckelt)
  drainInSet: 0.3, // Energieverlust pro Sekunde und Laser in der schwarzen Menge
  decay: 0.12, // Energieverlust pro Sekunde, wenn niemand im Band ist
  tolFrac: 0.01, // Toleranz = Ziel * tolFrac (gerundet)
  minBandShare: 0.008, // Zielband muss mind. diesen Bildanteil haben (sonst Toleranz wachsen lassen)
  percentileLoStart: 0.15,
  percentileHiStart: 0.75,
  percentilePerLevel: 0.06,
  gagFromLevel: 5, // ab hier wird zuerst ITERATION 65536 angesagt
  computeBudgetMs: 7, // Rechenzeit fürs Fraktal pro Frame
  cycleSpeed: 30, // Palettenrotation (Einträge pro Sekunde)
  zoomTime: 2.2,
  minRenderTime: 1.2,
  announceTime: 1.9,
  gagTime: 1.7,
  caughtTime: 1.2,
  hitSampleRadius: 2, // Buffer-Pixel um den Laser, die mitgeprüft werden (verzeihend)
};

const settings = {
  W: 1920,
  H: 1080,
  FH: 960, // Höhe der Fraktal-/Aktionsfläche, darunter HUD-Leiste
  BW: 480, // Auflösung des Iterationsbuffers
  BH: 240,
  maxParticles: 400,
  orbitSteps: 48,
  orbitScale: 34, // Pixel pro Einheit in der z-Ebene
  maxIterCap: 30000,
};

// Fraktal-Orte pro Level (cx/cy = Bildmitte, w = Breite in der komplexen Ebene)
const LOCATIONS = [
  { name: 'Das Apfelmännchen', cx: -0.65, cy: 0, w: 3.4, maxIter: 64, quip: 'Benoît sagt Hallo. Fangen wir harmlos an.' },
  { name: 'Seepferdchental', cx: -0.7453, cy: 0.1127, w: 0.03, maxIter: 250, quip: 'Hier wohnen die Seepferdchen. Bitte nicht füttern.' },
  { name: 'Elefantental', cx: 0.2855, cy: 0.0115, w: 0.012, maxIter: 350, quip: 'Rüssel an Rüssel bis ins Unendliche.' },
  { name: 'Dreifachspirale', cx: -0.088, cy: 0.6545, w: 0.008, maxIter: 500, quip: 'Drei Spiralen, null Ausreden.' },
  { name: 'Feigenbaum-Punkt', cx: -1.401155, cy: 0, w: 0.0006, maxIter: 900, quip: 'Periodenverdopplung. Und nochmal. Und nochmal.' },
  { name: 'Tiefsee -0.7436', cx: -0.743643887037151, cy: 0.13182590420533, w: 0.000002, maxIter: 1600, quip: 'Zoom 1:1.700.000 – der C64 rechnet noch an Level 1.' },
  { name: 'Mini-Brot im Nadelöhr', cx: -1.7548776662, cy: 0, w: 0.0008, maxIter: 1400, quip: 'Ein ganzes Apfelmännchen. Im Apfelmännchen. Klassiker.' },
];

const QUIPS_CATCH = [
  'DIVERGENZ BESTÄTIGT!',
  'ESCAPE TIME: PUNKTLANDUNG!',
  'Fractint hätte dafür 3 Tage gebraucht!',
  'z² + c = WIR!',
  'Benoît wäre stolz.',
  'Schneller als ein Amiga mit Turbokarte!',
  'Orbit gefangen!',
];
const QUIPS_TIMEOUT = [
  'Zu langsam – das Ziel ist ins Unendliche entkommen.',
  'Divergiert. Leider ohne euch.',
  'Konvergenz der Hoffnung: 0.',
];

const stats = {
  score: 0,
  lives: DIFFICULTY.lives,
  level: 1,
  caught: 0,
  caughtInLevel: 0,
  deepestIter: 0,
  timeouts: 0,
  playTime: 0,
};

// ---------------------------------------------------------------------------------------------
// Zustand (vorbelegt, damit handle() auch ohne init() läuft)
// ---------------------------------------------------------------------------------------------

var gameState = 'start'; // start | zoom | render | announce | play | caught | gameover
var stateTime = 0;
var time = 0;
var cycle = 0;
var shake = 0;
var quipText = '';
var newHighscore = false;
var gameOverTime = 0;

var target = { iter: 10, tol: 0, timeLeft: 30, timeMax: 30, energy: 0, gag: false };
var usedTargets = [];
var particles = [];
var floaters = [];
var blobInfo = []; // pro Frame: { blob, iter, diff, inBand, inSet, closeness }

var canvases = null; // Offscreen-Canvasse, lazy angelegt
var comp = { view: null, row: 0, done: false, startTime: 0 };
var iterBuf = new Uint16Array(settings.BW * settings.BH);
var hist = new Uint32Array(2);
var colorBase = new Uint8Array(2);
var palette = new Uint32Array(256);
var paletteColor = null;
var colors = {};
var lastZoomFrom = { x: 960, y: 480 };

var prevKeys = {};
function keyPressed(code) {
  const down = !!(laserConfig.pressedKeys && laserConfig.pressedKeys[code]);
  const was = !!prevKeys[code];
  prevKeys[code] = down;
  return down && !was;
}

function playSound(snd, volume) {
  try {
    const a = new Audio(snd);
    a.volume = volume === undefined ? 0.6 : volume;
    const p = a.play();
    if (p && p.catch) p.catch(() => {});
  } catch (e) {
    // Sound ist Deko – nie das Spiel abschiessen
  }
}

function pick(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

// ---------------------------------------------------------------------------------------------
// Farben (nur Komplementärbereich 0.25..0.75 zur Laserfarbe)
// ---------------------------------------------------------------------------------------------

function refreshColors() {
  const tc = laserConfig.testColor;
  const key = tc[0] + ',' + tc[1] + ',' + tc[2];
  if (paletteColor === key) return;
  paletteColor = key;
  for (let i = 0; i < 256; i++) {
    const u = i / 256;
    const spread = 0.25 + 0.5 * (0.5 + 0.5 * Math.sin(u * Math.PI * 2));
    const val = 0.16 + 0.36 * (0.5 + 0.5 * Math.sin(u * Math.PI * 6 + 1.3));
    const c = getRgbSpread(tc, spread, 0.85, val);
    palette[i] = (255 << 24) | ((c[2] & 255) << 16) | ((c[1] & 255) << 8) | (c[0] & 255);
  }
  colors = {
    cold: (v) => getRgbSpreadHex(tc, 0.75 - 0.5 * v, 0.8, 0.45 + 0.55 * v),
    hud: getRgbSpreadHex(tc, 0.5, 0.7, 0.95),
    hudDim: getRgbSpreadHex(tc, 0.42, 0.6, 0.55),
    warm: getRgbSpreadHex(tc, 0.3, 0.9, 1),
    accent: getRgbSpreadHex(tc, 0.6, 0.9, 1),
    danger: getRgbSpreadHex(tc, 0.27, 1, 0.9),
    band: getRgbSpread(tc, 0.5, 0.45, 1),
    bar: getRgbSpreadHex(tc, 0.35, 0.9, 0.9),
    barBg: getRgbSpreadHex(tc, 0.5, 0.5, 0.18),
    timer: getRgbSpreadHex(tc, 0.65, 0.8, 0.85),
    button: getRgbSpreadHex(tc, 0.45, 0.8, 0.5),
    buttonGrow: getRgbSpreadHex(tc, 0.5, 0.8, 0.75),
    buttonActive: getRgbSpreadHex(tc, 0.55, 0.8, 1),
  };
}

// ---------------------------------------------------------------------------------------------
// Fraktal: progressiver Iterationsbuffer (Fractint-Style)
// ---------------------------------------------------------------------------------------------

function ensureCanvases() {
  if (canvases) return;
  const mk = (w, h) => {
    const c = document.createElement('canvas');
    c.width = w;
    c.height = h;
    return { canvas: c, ctx: c.getContext('2d') };
  };
  canvases = {
    buf: mk(settings.BW, settings.BH),
    glow: mk(settings.BW / 4, settings.BH / 4),
    old: mk(settings.BW, settings.BH),
    mask: mk(settings.BW, settings.BH),
    maskGlow: mk(settings.BW / 4, settings.BH / 4),
  };
  canvases.image = canvases.buf.ctx.createImageData(settings.BW, settings.BH);
  canvases.pix = new Uint32Array(canvases.image.data.buffer);
  canvases.maskImage = canvases.mask.ctx.createImageData(settings.BW, settings.BH);
  canvases.maskPix = new Uint32Array(canvases.maskImage.data.buffer);
}

function getView(level) {
  if (level <= LOCATIONS.length) return LOCATIONS[level - 1];
  // Endlos-Zoom: immer tiefer in die Tiefsee, bis Double-Genauigkeit „Tschüss“ sagt
  const base = LOCATIONS[5];
  const k = level - LOCATIONS.length;
  const w = Math.max(1.5e-11, base.w / Math.pow(8, k));
  const atLimit = w <= 1.5e-11;
  return {
    name: atLimit ? 'Numerischer Rand (Double sagt Tschüss)' : 'Tiefsee x' + Math.round(base.w / w),
    cx: base.cx,
    cy: base.cy,
    w: w,
    maxIter: Math.min(settings.maxIterCap, Math.round(base.maxIter * Math.pow(1.4, k))),
    quip: atLimit ? 'Weiter geht nicht – 64 Bit sind auch nur 64 Bit.' : 'Noch tiefer. Die Zahlen werden albern.',
  };
}

function escapeTime(cr, ci, maxI, eps) {
  // Hauptkardioide und Periode-2-Kreis direkt erkennen
  const xq = cr - 0.25;
  const q = xq * xq + ci * ci;
  if (q * (q + xq) <= 0.25 * ci * ci) return maxI;
  if ((cr + 1) * (cr + 1) + ci * ci <= 0.0625) return maxI;
  let x = 0;
  let y = 0;
  let x2 = 0;
  let y2 = 0;
  let px = 0;
  let py = 0;
  let period = 0;
  let check = 8;
  for (let i = 1; i < maxI; i++) {
    y = 2 * x * y + ci;
    x = x2 - y2 + cr;
    x2 = x * x;
    y2 = y * y;
    if (x2 + y2 > 4) return i;
    if (Math.abs(x - px) < eps && Math.abs(y - py) < eps) return maxI; // periodisch = in der Menge
    period++;
    if (period > check) {
      period = 0;
      if (check < 512) check *= 2;
      px = x;
      py = y;
    }
  }
  return maxI;
}

function beginCompute(view) {
  ensureCanvases();
  refreshColors();
  comp.view = view;
  comp.row = 0;
  comp.done = false;
  comp.startTime = time;
  const maxI = view.maxIter;
  colorBase = new Uint8Array(maxI + 1);
  for (let it = 0; it <= maxI; it++) {
    colorBase[it] = (it * 7 + Math.floor(Math.log2(it + 1) * 40)) & 255;
  }
  hist = new Uint32Array(maxI + 1);
  canvases.pix.fill(0xff000000);
}

function computeRows(budgetMs) {
  if (!comp.view || comp.done) return;
  const v = comp.view;
  const BW = settings.BW;
  const BH = settings.BH;
  const w = v.w;
  const h = (w * settings.FH) / settings.W;
  const x0 = v.cx - w / 2;
  const y0 = v.cy + h / 2;
  const dx = w / BW;
  const dy = h / BH;
  const maxI = v.maxIter;
  const eps = Math.min(1e-12, dx * 1e-4);
  const pix = canvases.pix;
  const t0 = performance.now();
  while (comp.row < BH) {
    const by = comp.row;
    const ci = y0 - (by + 0.5) * dy;
    let idx = by * BW;
    for (let bx = 0; bx < BW; bx++, idx++) {
      const it = escapeTime(x0 + (bx + 0.5) * dx, ci, maxI, eps);
      iterBuf[idx] = it;
      pix[idx] = it >= maxI ? 0xff000000 : palette[colorBase[it]];
      if (it < maxI) hist[it]++;
    }
    comp.row++;
    if (performance.now() - t0 > budgetMs) break;
  }
  if (comp.row >= BH) comp.done = true;
}

function recolor() {
  const n = settings.BW * settings.BH;
  const maxI = comp.view.maxIter;
  const pix = canvases.pix;
  const c = Math.floor(cycle) & 255;
  for (let i = 0; i < n; i++) {
    const it = iterBuf[i];
    pix[i] = it >= maxI ? 0xff000000 : palette[(colorBase[it] + c) & 255];
  }
}

function buildMask() {
  const n = settings.BW * settings.BH;
  const lo = target.iter - target.tol;
  const hi = target.iter + target.tol;
  const b = colors.band;
  const col = (255 << 24) | ((b[2] & 255) << 16) | ((b[1] & 255) << 8) | (b[0] & 255);
  const mp = canvases.maskPix;
  for (let i = 0; i < n; i++) {
    const it = iterBuf[i];
    mp[i] = it >= lo && it <= hi ? col : 0;
  }
  canvases.mask.ctx.putImageData(canvases.maskImage, 0, 0);
  const g = canvases.maskGlow;
  g.ctx.clearRect(0, 0, g.canvas.width, g.canvas.height);
  g.ctx.imageSmoothingEnabled = true;
  g.ctx.drawImage(canvases.mask.canvas, 0, 0, g.canvas.width, g.canvas.height);
}

// Bildschirm → komplexe Ebene / Buffer
function screenToC(x, y) {
  const v = comp.view;
  const h = (v.w * settings.FH) / settings.W;
  return { re: v.cx + (x / settings.W - 0.5) * v.w, im: v.cy - (y / settings.FH - 0.5) * h };
}

function iterAtScreen(x, y) {
  const bx = Math.floor((x / settings.W) * settings.BW);
  const by = Math.floor((y / settings.FH) * settings.BH);
  if (bx < 0 || by < 0 || bx >= settings.BW || by >= settings.BH) return -1;
  return iterBuf[by * settings.BW + bx];
}

// ---------------------------------------------------------------------------------------------
// Ziel wählen
// ---------------------------------------------------------------------------------------------

function bandArea(t, tol) {
  let s = 0;
  const maxI = comp.view.maxIter;
  for (let i = Math.max(1, t - tol); i <= Math.min(maxI - 1, t + tol); i++) s += hist[i];
  return s;
}

function pickTarget() {
  const maxI = comp.view.maxIter;
  let escaped = 0;
  for (let i = 1; i < maxI; i++) escaped += hist[i];
  const minArea = DIFFICULTY.minBandShare * settings.BW * settings.BH;
  const lvl = stats.level - 1;
  const lo = Math.min(0.55, DIFFICULTY.percentileLoStart + DIFFICULTY.percentilePerLevel * lvl);
  const hi = Math.min(0.97, DIFFICULTY.percentileHiStart + DIFFICULTY.percentilePerLevel * lvl);
  let best = null;
  for (let attempt = 0; attempt < 10; attempt++) {
    const p = lo + Math.random() * (hi - lo);
    let acc = 0;
    let t = 1;
    for (let i = 1; i < maxI; i++) {
      acc += hist[i];
      if (acc >= p * escaped) {
        t = i;
        break;
      }
    }
    t = Math.max(2, t);
    let tol = Math.round(t * DIFFICULTY.tolFrac);
    const tolMax = Math.max(2, Math.round(t * 0.12));
    while (bandArea(t, tol) < minArea && tol < tolMax) tol++;
    best = { iter: t, tol: tol };
    if (usedTargets.indexOf(t) < 0 && bandArea(t, tol) >= minArea) break;
  }
  usedTargets.push(best.iter);
  target.iter = best.iter;
  target.tol = best.tol;
  target.energy = 0;
  target.timeMax = Math.max(
    DIFFICULTY.minTargetTime,
    DIFFICULTY.startTargetTime + DIFFICULTY.targetTimePerLevel * (stats.level - 1)
  );
  target.timeLeft = target.timeMax;
  target.gag = stats.level >= DIFFICULTY.gagFromLevel && stats.caughtInLevel === 0;
  buildMask();
}

// ---------------------------------------------------------------------------------------------
// Zustandswechsel
// ---------------------------------------------------------------------------------------------

function setState(s) {
  gameState = s;
  stateTime = 0;
}

function snapshotOld() {
  const o = canvases.old;
  o.ctx.clearRect(0, 0, settings.BW, settings.BH);
  o.ctx.drawImage(canvases.buf.canvas, 0, 0);
}

function goToLevel(level) {
  const oldView = comp.view;
  stats.level = level;
  stats.caughtInLevel = 0;
  usedTargets = [];
  const nv = getView(level);
  if (oldView) {
    const h = (oldView.w * settings.FH) / settings.W;
    lastZoomFrom.x = Math.max(0, Math.min(settings.W, ((nv.cx - oldView.cx) / oldView.w + 0.5) * settings.W));
    lastZoomFrom.y = Math.max(0, Math.min(settings.FH, (-(nv.cy - oldView.cy) / h + 0.5) * settings.FH));
  }
  snapshotOld();
  beginCompute(nv);
  quipText = nv.quip;
  playSound(level > 1 ? soundLevelUp : soundZoom, 0.6);
  setState(level > 1 ? 'zoom' : 'render');
}

function startAnnounce() {
  pickTarget();
  playSound(soundAnnounce, 0.7);
  setState('announce');
}

function startGame() {
  stats.score = 0;
  stats.lives = DIFFICULTY.lives;
  stats.caught = 0;
  stats.caughtInLevel = 0;
  stats.deepestIter = 0;
  stats.timeouts = 0;
  stats.playTime = 0;
  stats.level = 1;
  particles = [];
  floaters = [];
  usedTargets = [];
  newHighscore = false;
  const v1 = getView(1);
  if (comp.view !== v1) {
    goToLevel(1);
  } else {
    quipText = v1.quip;
    setState('render'); // render wartet, bis das Bild fertig ist, und sagt dann an
  }
}

function catchTarget() {
  const pts = target.iter + Math.round(target.timeLeft * 10) + 50 * stats.level;
  stats.score += pts;
  stats.caught++;
  stats.caughtInLevel++;
  stats.deepestIter = Math.max(stats.deepestIter, target.iter);
  quipText = pick(QUIPS_CATCH);
  playSound(soundCatch, 0.8);
  // Explosionen an allen Lasern im Band, sonst in der Mitte
  let any = false;
  blobInfo.forEach((bi) => {
    if (bi.inBand) {
      any = true;
      burst(bi.blob.x, bi.blob.y, 40);
    }
  });
  if (!any) burst(settings.W / 2, settings.FH / 2, 80);
  floaters.push({ x: settings.W / 2, y: settings.FH / 2 - 80, text: '+' + pts, life: 1.8, max: 1.8, size: 110 });
  setState('caught');
}

function timeoutTarget() {
  stats.lives--;
  stats.timeouts++;
  shake = 0.6;
  quipText = pick(QUIPS_TIMEOUT);
  playSound(soundError, 0.8);
  if (stats.lives <= 0) {
    endGame();
  } else {
    setState('caught');
  }
}

function endGame() {
  highscore.addEntry({ punkte: stats.score, level: stats.level, tiefsteIteration: stats.deepestIter });
  newHighscore = highscore.lastEntryNewHighscore();
  gameOverTime = 0;
  playSound(soundGameOver, 0.7);
  setState('gameover');
}

// ---------------------------------------------------------------------------------------------
// Partikel
// ---------------------------------------------------------------------------------------------

function burst(x, y, n) {
  for (let i = 0; i < n && particles.length < settings.maxParticles; i++) {
    const a = Math.random() * Math.PI * 2;
    if (i % 3 === 0) {
      // Orbit-Partikel: kreisen um den Treffer und driften nach aussen
      particles.push({ orbit: true, cx: x, cy: y, r: 10 + Math.random() * 30, a: a, va: (Math.random() < 0.5 ? -1 : 1) * (3 + Math.random() * 4), vr: 60 + Math.random() * 120, life: 1.6, max: 1.6, hue: 0.25 + Math.random() * 0.5, size: 4 + Math.random() * 4 });
    } else {
      const sp = 150 + Math.random() * 550;
      particles.push({ orbit: false, x: x, y: y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, life: 1.1, max: 1.1, hue: 0.25 + Math.random() * 0.5, size: 3 + Math.random() * 5 });
    }
  }
}

function updateAndDrawParticles(ctx, dt) {
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  particles.slice().forEach((p) => {
    p.life -= dt;
    if (p.life <= 0) {
      const i = particles.indexOf(p);
      if (i >= 0) particles.splice(i, 1);
      return;
    }
    let x;
    let y;
    if (p.orbit) {
      p.a += p.va * dt;
      p.r += p.vr * dt;
      x = p.cx + Math.cos(p.a) * p.r;
      y = p.cy + Math.sin(p.a) * p.r * 0.6;
    } else {
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.vx *= 1 - 1.8 * dt;
      p.vy *= 1 - 1.8 * dt;
      x = p.x;
      y = p.y;
    }
    const u = p.life / p.max;
    ctx.globalAlpha = u;
    ctx.fillStyle = getRgbSpreadHex(laserConfig.testColor, p.hue, 0.8, 1);
    ctx.beginPath();
    ctx.arc(x, Math.min(y, settings.FH), p.size * (0.5 + u), 0, Math.PI * 2);
    ctx.fill();
  });
  ctx.restore();

  floaters.slice().forEach((f) => {
    f.life -= dt;
    if (f.life <= 0) {
      const i = floaters.indexOf(f);
      if (i >= 0) floaters.splice(i, 1);
      return;
    }
    const u = f.life / f.max;
    ctx.save();
    ctx.globalAlpha = Math.min(1, u * 2);
    ctx.shadowColor = colors.warm;
    ctx.shadowBlur = 30;
    util.renderTextDropShadow({ ctx, text: f.text, x: f.x, y: f.y - (1 - u) * 120, fontSize: f.size + 'px', lineHeight: f.size, fillStyle: colors.warm, dropDistX: 4, dropDistY: 4 });
    ctx.restore();
  });
}

// ---------------------------------------------------------------------------------------------
// Laser auswerten: Iteration, Wärmer/Kälter, Orbit
// ---------------------------------------------------------------------------------------------

function evaluateBlobs() {
  blobInfo = [];
  if (!comp.done) return;
  const maxI = comp.view.maxIter;
  const r = DIFFICULTY.hitSampleRadius;
  const sx = settings.W / settings.BW;
  const sy = settings.FH / settings.BH;
  tracker.getBlobs().forEach((b) => {
    if (b.y > settings.FH) return;
    let bestIt = -1;
    let bestDiff = Infinity;
    let setCount = 0;
    let samples = 0;
    for (let oy = -r; oy <= r; oy++) {
      for (let ox = -r; ox <= r; ox++) {
        const it = iterAtScreen(b.x + ox * sx, b.y + oy * sy);
        if (it < 0) continue;
        samples++;
        if (it >= maxI) {
          setCount++;
          continue;
        }
        const d = Math.abs(it - target.iter);
        if (d < bestDiff) {
          bestDiff = d;
          bestIt = it;
        }
      }
    }
    const center = iterAtScreen(b.x, b.y);
    const inSet = center >= maxI && setCount > samples / 2;
    const inBand = bestIt >= 0 && bestDiff <= target.tol;
    let closeness = 0;
    if (inBand) closeness = 1;
    else if (bestIt > 0) closeness = Math.max(0, 1 - Math.abs(Math.log((bestIt + 1) / (target.iter + 1))) / 1.3);
    blobInfo.push({ blob: b, iter: center >= maxI ? -1 : center, near: bestIt, inBand: inBand, inSet: inSet, closeness: closeness });
  });
}

function drawOrbit(ctx, x, y, color, alpha) {
  const c = screenToC(x, y);
  let zr = 0;
  let zi = 0;
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  ctx.globalAlpha = alpha;
  ctx.strokeStyle = color;
  ctx.lineWidth = 2;
  ctx.shadowColor = color;
  ctx.shadowBlur = 12;
  ctx.beginPath();
  ctx.moveTo(x, y);
  for (let i = 0; i < settings.orbitSteps; i++) {
    const nr = zr * zr - zi * zi + c.re;
    zi = 2 * zr * zi + c.im;
    zr = nr;
    const m = zr * zr + zi * zi;
    const px = x + zr * settings.orbitScale;
    const py = y - zi * settings.orbitScale;
    ctx.lineTo(px, py);
    if (m > 4) break;
  }
  ctx.stroke();
  ctx.restore();
}

function drawBlobs(ctx, withRings) {
  blobInfo.forEach((bi) => {
    const b = bi.blob;
    const pulse = Math.sin(time * 6 + b.id) * 0.5 + 0.5;
    const col = bi.inSet ? colors.danger : colors.cold(bi.closeness);
    drawOrbit(ctx, b.x, b.y, col, 0.45 + 0.4 * bi.closeness);
    if (!withRings) return;
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    const radius = 34 + 46 * bi.closeness + pulse * 8;
    ctx.strokeStyle = col;
    ctx.shadowColor = col;
    ctx.shadowBlur = 10 + 30 * bi.closeness;
    ctx.lineWidth = 3 + 6 * bi.closeness;
    ctx.globalAlpha = 0.5 + 0.5 * bi.closeness;
    ctx.beginPath();
    ctx.arc(b.x, b.y, radius, 0, Math.PI * 2);
    ctx.stroke();
    if (bi.inBand) {
      // Volltreffer: zweiter, rotierender Ring
      ctx.setLineDash([18, 12]);
      ctx.lineDashOffset = -time * 80;
      ctx.beginPath();
      ctx.arc(b.x, b.y, radius + 16, 0, Math.PI * 2);
      ctx.stroke();
      ctx.setLineDash([]);
    }
    ctx.restore();
    let label;
    if (bi.inSet || bi.iter < 0) label = ''; // in der Menge: nur roter Ring, Warnung steht oben (sonst Textsalat)
    else if (bi.inBand) label = 'i ' + bi.near + '  TREFFER';
    else label = 'i ' + bi.iter + '  (' + (bi.iter > target.iter ? '+' : '') + (bi.iter - target.iter) + ')';
    if (label) {
      util.renderTextDropShadow({ ctx, text: label, x: b.x, y: b.y - radius - 14, fontSize: '28px', lineHeight: 28, fillStyle: col, dropDistX: 3, dropDistY: 3 });
    }
  });
}

// ---------------------------------------------------------------------------------------------
// Zeichnen: Fraktal, HUD, Texte
// ---------------------------------------------------------------------------------------------

function drawFractal(ctx, alpha) {
  const W = settings.W;
  const FH = settings.FH;
  if (comp.done) recolor();
  canvases.buf.ctx.putImageData(canvases.image, 0, 0);
  ctx.save();
  if (shake > 0) ctx.translate((Math.random() - 0.5) * 30 * shake, (Math.random() - 0.5) * 30 * shake);
  ctx.globalAlpha = alpha;
  ctx.imageSmoothingEnabled = false;
  ctx.drawImage(canvases.buf.canvas, 0, 0, W, FH);
  // Bloom: verkleinert und weich wieder hochskaliert, additiv
  const g = canvases.glow;
  g.ctx.imageSmoothingEnabled = true;
  g.ctx.drawImage(canvases.buf.canvas, 0, 0, g.canvas.width, g.canvas.height);
  ctx.imageSmoothingEnabled = true;
  ctx.globalCompositeOperation = 'lighter';
  ctx.globalAlpha = alpha * (0.35 + 0.15 * Math.sin(time * 1.7));
  ctx.drawImage(g.canvas, -20, -10, W + 40, FH + 20);
  ctx.restore();
}

function drawBandFlash(ctx, env) {
  if (env <= 0) return;
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  ctx.imageSmoothingEnabled = false;
  ctx.globalAlpha = env;
  ctx.drawImage(canvases.mask.canvas, 0, 0, settings.W, settings.FH);
  ctx.imageSmoothingEnabled = true;
  ctx.globalAlpha = env * 0.9;
  ctx.drawImage(canvases.maskGlow.canvas, -30, -15, settings.W + 60, settings.FH + 30);
  ctx.restore();
}

function drawOldZoom(ctx, u) {
  const e = u * u * (3 - 2 * u);
  const s = Math.exp(e * 3);
  ctx.save();
  ctx.globalAlpha = 1 - e * 0.7;
  ctx.translate(lastZoomFrom.x, lastZoomFrom.y);
  ctx.scale(s, s);
  ctx.translate(-lastZoomFrom.x, -lastZoomFrom.y);
  ctx.imageSmoothingEnabled = true;
  ctx.drawImage(canvases.old.canvas, 0, 0, settings.W, settings.FH);
  ctx.restore();
  // Zoom-Ringe
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  ctx.strokeStyle = colors.accent;
  for (let i = 0; i < 5; i++) {
    const rr = ((time * 400 + i * 160) % 800) + 20;
    ctx.globalAlpha = 0.4 * (1 - rr / 820);
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.arc(lastZoomFrom.x, lastZoomFrom.y, rr, 0, Math.PI * 2);
    ctx.stroke();
  }
  ctx.restore();
}

function drawScanline(ctx) {
  if (comp.done) return;
  const y = (comp.row / settings.BH) * settings.FH;
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  ctx.fillStyle = colors.accent;
  ctx.shadowColor = colors.accent;
  ctx.shadowBlur = 25;
  ctx.fillRect(0, y - 2, settings.W, 4);
  ctx.restore();
}

function bigText(ctx, text, y, size, color, glow) {
  ctx.save();
  ctx.shadowColor = color;
  ctx.shadowBlur = glow === undefined ? 30 : glow;
  util.renderTextDropShadow({ ctx, text, x: settings.W / 2, y: y, fontSize: size + 'px', lineHeight: size * 1.1, fillStyle: color, dropDistX: 6, dropDistY: 6 });
  ctx.restore();
}

function drawMiniBrot(ctx, x, y, r, color) {
  ctx.save();
  ctx.fillStyle = color;
  ctx.shadowColor = color;
  ctx.shadowBlur = 10;
  ctx.beginPath();
  for (let i = 0; i <= 40; i++) {
    const t = (i / 40) * Math.PI * 2;
    const px = Math.cos(t) / 2 - Math.cos(2 * t) / 4 + 0.35;
    const py = Math.sin(t) / 2 - Math.sin(2 * t) / 4;
    if (i === 0) ctx.moveTo(x + px * r * 2, y + py * r * 2);
    else ctx.lineTo(x + px * r * 2, y + py * r * 2);
  }
  ctx.fill();
  ctx.beginPath();
  ctx.arc(x + (-1 + 0.35) * r * 2, y, 0.25 * r * 2, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

function drawHud(ctx) {
  const W = settings.W;
  const top = settings.FH;
  ctx.save();
  const grad = ctx.createLinearGradient(0, top, 0, settings.H);
  grad.addColorStop(0, '#0a0a12');
  grad.addColorStop(1, '#000000');
  ctx.fillStyle = grad;
  ctx.fillRect(0, top, W, settings.H - top);
  ctx.strokeStyle = colors.hudDim;
  ctx.globalAlpha = 0.6 + 0.4 * Math.sin(time * 2);
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(0, top + 1);
  ctx.lineTo(W, top + 1);
  ctx.stroke();
  ctx.restore();

  const v = comp.view || LOCATIONS[0];
  util.renderText({ ctx, text: 'LEVEL ' + stats.level, x: 30, y: top + 52, fontSize: '44px', fillStyle: colors.hud, align: 'left' });
  util.renderText({ ctx, text: v.name + '  ·  max ' + v.maxIter + ' it', x: 30, y: top + 96, fontSize: '24px', fillStyle: colors.hudDim, align: 'left', font: 'Verdana' });

  util.renderText({ ctx, text: 'PUNKTE ' + stats.score, x: W - 30, y: top + 52, fontSize: '44px', fillStyle: colors.hud, align: 'right' });
  for (let i = 0; i < DIFFICULTY.lives; i++) {
    drawMiniBrot(ctx, W - 60 - i * 60, top + 88, 16, i < stats.lives ? colors.warm : '#222230');
  }

  if (gameState === 'play' || gameState === 'announce' || gameState === 'caught') {
    const tt = 'ZIEL  i = ' + target.iter + (target.tol > 0 ? ' ± ' + target.tol : '');
    ctx.save();
    ctx.shadowColor = colors.warm;
    ctx.shadowBlur = 20;
    util.renderText({ ctx, text: tt, x: W / 2, y: top + 50, fontSize: '48px', fillStyle: colors.warm });
    ctx.restore();
    const bx = 610;
    const bw = 700;
    ctx.save();
    ctx.fillStyle = colors.barBg;
    ctx.fillRect(bx, top + 66, bw, 20);
    ctx.fillRect(bx, top + 94, bw, 10);
    ctx.fillStyle = colors.bar;
    ctx.shadowColor = colors.bar;
    ctx.shadowBlur = 15;
    ctx.fillRect(bx, top + 66, bw * Math.min(1, target.energy), 20);
    const tl = target.timeLeft / target.timeMax;
    ctx.fillStyle = tl < 0.25 && Math.sin(time * 14) > 0 ? colors.danger : colors.timer;
    ctx.fillRect(bx, top + 94, bw * Math.max(0, tl), 10);
    ctx.restore();
  } else {
    util.renderText({ ctx, text: 'FRACTAL-ITERATION', x: W / 2, y: top + 70, fontSize: '48px', fillStyle: colors.hudDim });
  }
}

function drawHighscorePanel(ctx, y) {
  const best = highscore.getHighscore();
  util.renderTextDropShadow({
    ctx,
    text: best
      ? 'Highscore: ' + Math.round(best.punkte) + ' Punkte  ·  Level ' + best.level + '  ·  tiefste Iteration ' + best.tiefsteIteration
      : 'Noch kein Highscore – wie am C64: leere Tabelle, volle Hoffnung.',
    x: settings.W / 2,
    y: y,
    fontSize: '32px',
    lineHeight: 34,
    fillStyle: colors.hudDim,
    dropDistX: 3,
    dropDistY: 3,
  });
}

function drawDarkSpot(ctx, x, y, r) {
  // Aktionsbereich dunkel halten, damit der Laser gut erkannt wird
  ctx.save();
  const g = ctx.createRadialGradient(x, y, r * 0.6, x, y, r);
  g.addColorStop(0, 'rgba(0,0,0,0.95)');
  g.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

// ---------------------------------------------------------------------------------------------
// GUI
// ---------------------------------------------------------------------------------------------

var highscore = createHighscore('Fractal-Iteration', 'punkte');

var tracker = guiBlobTracker({
  posX: settings.W / 2,
  posY: settings.FH / 2,
  width: settings.W,
  height: settings.FH,
  minCells: 1,
  maxBlobs: 64,
  keepTime: 0.2,
  testKey: 'KeyB',
});

function makeButton(label, onEnter) {
  return guiFillButton({
    label: label,
    posX: settings.W / 2,
    posY: 720,
    radius: 110,
    edges: 7,
    speedUp: 60,
    speedDown: 30,
    normalColor: '#203040',
    growColor: '#305070',
    activeColor: '#4080a0',
    onEnterActive: onEnter,
  });
}

var startButton = makeButton('START', () => {
  if (gameState === 'start') startGame();
});
var restartButton = makeButton('NOCHMAL', () => {
  if (gameState === 'gameover' && gameOverTime > 3) setState('start');
});

function styleButton(btn) {
  btn.setColor(colors.button);
  if (btn.setGrowColor) btn.setGrowColor(colors.buttonGrow);
  if (btn.setActiveColor) btn.setActiveColor(colors.buttonActive);
}

// ---------------------------------------------------------------------------------------------
// Hauptschleife
// ---------------------------------------------------------------------------------------------

function handleFrame(grid, elapsed) {
  const dt = Math.min(elapsed || 0, 0.1);
  time += dt;
  stateTime += dt;
  cycle += dt * DIFFICULTY.cycleSpeed;
  shake = Math.max(0, shake - dt);
  const ctx = MasterCanvas.get2dContext();
  ensureCanvases();
  refreshColors();
  if (!comp.view) beginCompute(getView(1));
  computeRows(DIFFICULTY.computeBudgetMs);

  tracker.handle(grid, dt);

  // Tastatur
  const kSpace = keyPressed('Space');
  const k1 = keyPressed('Digit1');
  const k2 = keyPressed('Digit2');

  const W = settings.W;

  if (gameState === 'start') {
    evaluateBlobs();
    drawFractal(ctx, 0.85);
    drawScanline(ctx);
    drawBlobs(ctx, false);
    bigText(ctx, 'FRACTAL-ITERATION', 210, 150, colors.accent, 45);
    bigText(ctx, 'Leuchtet die angesagte Iteration an – irgendwo im Apfelmännchen.', 300, 40, colors.hud, 10);
    bigText(ctx, 'Je tiefer der Zoom, desto absurder die Zahl. Iteration 1056? Kein Bug, Humor.', 360, 32, colors.hudDim, 0);
    drawDarkSpot(ctx, W / 2, 720, 190);
    styleButton(startButton);
    startButton.handle(grid, dt);
    drawHighscorePanel(ctx, 900);
    if (kSpace) startGame();
  } else if (gameState === 'zoom') {
    drawOldZoom(ctx, Math.min(1, stateTime / DIFFICULTY.zoomTime));
    bigText(ctx, 'LEVEL ' + stats.level, 420, 150, colors.accent, 45);
    bigText(ctx, getView(stats.level).name, 520, 56, colors.hud, 15);
    if (stateTime >= DIFFICULTY.zoomTime) setState('render');
  } else if (gameState === 'render') {
    drawFractal(ctx, 1);
    drawScanline(ctx);
    bigText(ctx, 'LEVEL ' + stats.level, 420, 150, colors.accent, 45);
    bigText(ctx, comp.view.name, 520, 56, colors.hud, 15);
    bigText(ctx, quipText, 600, 34, colors.hudDim, 0);
    if (!comp.done) bigText(ctx, 'Rechne … Zeile ' + comp.row + ' / ' + settings.BH, 880, 30, colors.hudDim, 0);
    if (comp.done && stateTime >= DIFFICULTY.minRenderTime) startAnnounce();
  } else if (gameState === 'announce') {
    drawFractal(ctx, 1);
    const gagT = target.gag ? DIFFICULTY.gagTime : 0;
    if (stateTime < gagT) {
      bigText(ctx, 'LEUCHTET ITERATION', 360, 70, colors.hud, 15);
      bigText(ctx, '65536', 520, 170, colors.danger, 60);
      bigText(ctx, '… kleiner Scherz. Der Rechner ist ein Amiga 500.', 620, 36, colors.hudDim, 0);
    } else {
      const u = (stateTime - gagT) / DIFFICULTY.announceTime;
      drawBandFlash(ctx, Math.max(0, Math.sin(Math.min(1, u) * Math.PI)));
      bigText(ctx, 'LEUCHTET ITERATION', 360, 70, colors.hud, 15);
      bigText(ctx, String(target.iter) + (target.tol > 0 ? ' ±' + target.tol : ''), 520, 170, colors.warm, 60);
      bigText(ctx, 'egal wo!', 610, 44, colors.hudDim, 0);
    }
    if (stateTime >= gagT + DIFFICULTY.announceTime) setState('play');
  } else if (gameState === 'play') {
    stats.playTime += dt;
    evaluateBlobs();
    let inBand = 0;
    let inSet = 0;
    blobInfo.forEach((bi) => {
      if (bi.inBand) inBand++;
      if (bi.inSet) inSet++;
    });
    target.energy += Math.min(inBand, DIFFICULTY.teamCap) * DIFFICULTY.catchRate * dt;
    target.energy -= inSet * DIFFICULTY.drainInSet * dt;
    if (inBand === 0) target.energy -= DIFFICULTY.decay * dt;
    target.energy = Math.max(0, target.energy);
    target.timeLeft -= dt;
    if (inSet > 0 && Math.random() < dt * 2) shake = Math.max(shake, 0.15);

    drawFractal(ctx, 1);
    drawBlobs(ctx, true);
    if (blobInfo.length === 0 && stateTime > 3) {
      bigText(ctx, 'Laser rein! Ziel: i = ' + target.iter, 120, 44, colors.hudDim, 0);
    }
    if (inSet > 0) bigText(ctx, 'Nicht ins Schwarze – dort konvergiert alles!', 120, 40, colors.danger, 10);

    if (k1) target.energy = 1;
    if (target.energy >= 1) catchTarget();
    else if (target.timeLeft <= 0) timeoutTarget();
    if (k2 && gameState === 'play') goToLevel(stats.level + 1);
  } else if (gameState === 'caught') {
    evaluateBlobs();
    drawFractal(ctx, 1);
    drawBlobs(ctx, false);
    bigText(ctx, quipText, 200, 56, colors.accent, 25);
    if (stateTime >= DIFFICULTY.caughtTime) {
      if (stats.caughtInLevel >= DIFFICULTY.targetsPerLevel) goToLevel(stats.level + 1);
      else startAnnounce();
    }
  } else if (gameState === 'gameover') {
    gameOverTime += dt;
    drawFractal(ctx, 0.35);
    bigText(ctx, 'GAME OVER', 200, 150, colors.danger, 50);
    bigText(ctx, 'Das Orbit ist divergiert. ' + quipText, 290, 34, colors.hudDim, 0);
    bigText(
      ctx,
      'Punkte: ' + stats.score + '   ·   Level ' + stats.level + '   ·   ' + stats.caught + ' Ziele gefangen\n' +
        'Tiefste Iteration: ' + stats.deepestIter + '   ·   Spielzeit ' + Math.round(stats.playTime) + ' s',
      380,
      44,
      colors.hud,
      10
    );
    if (newHighscore) bigText(ctx, 'NEUER HIGHSCORE! Wie damals am Amiga – nur fraktaler.', 520, 40, colors.warm, 25);
    if (gameOverTime > 3) {
      drawDarkSpot(ctx, W / 2, 720, 190);
      styleButton(restartButton);
      restartButton.handle(grid, dt);
      if (kSpace) setState('start');
    }
    highscore.renderHighAndLowScores(ctx); // Darstellung aus util/highscore.js (High links, Low rechts)
  }

  updateAndDrawParticles(ctx, dt);
  drawHud(ctx);
}

export default {
  name: 'Fractal-Iteration',
  description:
    'Fractal-Iteration – Iterationsjagd im Apfelmännchen!\n\n' +
    'Das Spiel sagt eine Iteration an („Leuchtet Iteration 17 an!“).\n' +
    'Jede Farbstufe im Fraktal ist eine Iterationszahl – sucht sie, egal wo.\n' +
    'Beim Ansagen blinkt das Zielband einmal kurz auf, danach zeigt euch\n' +
    'der Ring um jeden Laser: wärmer oder kälter. Mehr Laser im Band = schneller gefangen.\n' +
    'Nicht ins Schwarze leuchten – dort konvergiert alles und saugt Energie ab.\n' +
    'Jedes Level zoomt tiefer: Iteration 1056 ist kein Bug, das ist Fraktal-Humor.',
  image: 'media/img/gametitles/laser-mandelbrot-###4###.png',
  init: () => {
    gameState = 'start';
    stateTime = 0;
    stats.score = 0;
    stats.lives = DIFFICULTY.lives;
    stats.level = 1;
    stats.caught = 0;
    stats.caughtInLevel = 0;
    stats.deepestIter = 0;
    stats.timeouts = 0;
    stats.playTime = 0;
    particles = [];
    floaters = [];
    usedTargets = [];
    blobInfo = [];
    shake = 0;
    newHighscore = false;
    tracker.reset();
    paletteColor = null;
    comp.view = null; // Level-1-Bild wird im ersten Frame neu gerechnet
  },
  handle: (grid, elapsed) => {
    try {
      handleFrame(grid, elapsed);
    } catch (e) {
      // Fehler nicht als bleibende ERROR-Zeile enden lassen (Engine setzt sie nie zurück)
      console.error('Fractal-Iteration:', e);
    }
  },
  stop: () => {
    particles = [];
    floaters = [];
  },
};
