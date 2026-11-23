/**
 * Fraktal-Simon – „Simon sagt“ mit Iterationsbändern
 *
 * Erstellt mit Claude Opus 5.5 (claude-opus-5-5), Idee: Christian Kleinhuis.
 *
 * Worum geht's:
 *   Ein Fraktal (Start: das ganze Mandelbrot, maxIter 50) wird in 3–6 ITERATIONSBÄNDER zerlegt, z. B.
 *   „4–5“, „6–8“, „10–15“. Jedes Band hat eine eigene Farbe und einen eigenen Ton. Es werden nur Bänder
 *   gebildet, die gross genug sind, um sie mit dem Laser zu treffen (Quantile des Iterations-Histogramms,
 *   zu kleine Bänder werden mit dem Nachbarn verschmolzen).
 *   - ZEIGEN: Die Sequenz blinkt Band für Band auf (mit Ton). Eingabe gesperrt.
 *   - NACHMACHEN: Der Saal leuchtet die Bänder in derselben Reihenfolge an. Eingabe per MEHRHEIT:
 *     Jedes Band füllt sich nach dem Anteil der Laser, die gerade darin liegen. Das Band, das zuerst voll
 *     ist, gilt als Eingabe. Einzelne Störer schaden also nicht – die Mehrheit entscheidet.
 *     Laser in der schwarzen Menge und auf neutralen Flächen zählen nicht.
 *   - Richtig = Ton + nächster Schritt. Falsch oder zu langsam = Leben weg, Sequenz wird erneut gezeigt.
 *   - Sequenz komplett = Runde geschafft, die Sequenz wird um ein Band länger.
 *   - Nach DIFFICULTY.roundsPerLevel Runden: Zoomfahrt zu einem neuen Ort/Fraktal (Julia-Mengen,
 *     Seepferdchental, Burning Ship, Tricorn, Elefantental, Dendrit …) mit neuer Bandaufteilung,
 *     mehr Bändern und schnellerem Zeigen.
 *
 * Multiplayer / One-Pixel-Plattform: jeder Laser (oder Netz-Pixel) ist eine Stimme (gui/blobTracker).
 *   Rundenbasiert ist bei vielen Lasern heikel – darum Mehrheitsentscheid statt „jeder Fehlklick zählt“.
 *
 * Tastatur (Test ohne Laser): Leertaste = Start/Neustart, 1–6 = Band auslösen, B (halten) = Test-Laser.
 *
 * Ähnlichkeiten / Herkunft:
 *   - game-027 Laser-Simon: gleiches Prinzip – dort feste Kreisfelder, hier Fraktalbänder, die sich über
 *     das ganze Bild verteilen (jedes „Feld“ ist hunderte Inseln gross).
 *   - game-066 Fractal-Iteration: Technik (progressiver Iterationsbuffer, Bloom, Bandmasken) und die Idee
 *     selbst – Fraktal-Simon ist dort beim Spielen entstanden.
 *   - Klassiker: Simon (Milton Bradley, 1978), Touch Me (Atari, 1974) und Fractint (DOS, 1988) für den
 *     zeilenweisen Bildaufbau.
 *
 * Engine-Rücksichten (CLAUDE.md): dt geclampt, Zustand vorbelegt (handle() läuft ohne init()), keine
 * Debug-Tasten belegt, kein Spread-Operator, Fraktal progressiv mit Zeitbudget.
 */

import { getRgbSpread, getRgbSpreadHex } from '../util.js';
var util = require('../util.js').default;
var laserConfig = require('../LaserApiConfig.js').default;
var MasterCanvas = require('../MasterCanvas').default;
var guiFillButton = require('./gui/fillButton-ai2').default;
var guiBlobTracker = require('./gui/blobTracker').default;
var createHighscore = require('../util/highscore').default;
import soundLevelUp from '../../../public/media/opengameart/Level Up.ogg';
import soundZoom from '../../../public/media/opengameart/Transition.ogg';
import soundGameOver from '../../../public/media/opengameart/Music Box Game Over III.wav';

// ---------------------------------------------------------------------------------------------
// Einstellungen
// ---------------------------------------------------------------------------------------------

const DIFFICULTY = {
  lives: 3,
  roundsPerLevel: 3, // geschaffte Sequenzen bis zum nächsten Fraktal
  startLength: 2, // Sequenzlänge in Runde 1 von Level 1
  lengthPerTwoLevels: 1, // alle zwei Level startet die Sequenz um so viel länger
  showOnStart: 0.75, // Sekunden, die ein Band beim Zeigen leuchtet
  showOnPerLevel: -0.06,
  showOnMin: 0.3,
  showGapStart: 0.3,
  showGapPerLevel: -0.025,
  showGapMin: 0.1,
  fillRate: 0.9, // Fülle pro Sekunde bei 100 % Laseranteil
  fillDecay: 0.6, // Abbau pro Sekunde ohne Laser im Band
  inputCooldown: 0.5, // nach einer Eingabe kurz nichts füllen
  inputTimeout: 14, // Sekunden pro Schritt
  skipShare: 0.45, // die grossen Aussenflächen (niedrige Iterationen) bleiben neutral
  topShare: 0.985, // die allerhöchsten Iterationen ebenfalls
  minBandShare: 0.03, // Band muss mind. 3 % des Bildes bedecken (sonst verschmelzen)
  computeBudgetMs: 7,
  zoomTime: 2.2,
  minRenderTime: 1.2,
  successTime: 1.4,
  errorTime: 1.8,
};

const settings = {
  W: 1920,
  H: 1080,
  FH: 960, // Fraktal-/Aktionsfläche, darunter HUD
  BW: 480,
  BH: 240,
  maxBands: 6,
  maxParticles: 400,
  maxIterCap: 4000,
};

// Pentatonik – klingt immer irgendwie richtig, auch wenn der Saal falsch liegt
const TONES = [261.63, 293.66, 329.63, 392.0, 440.0, 523.25];

// Orte/Fraktale pro Level. type: mandel | julia | ship | tricorn
const LOCATIONS = [
  { name: 'Das Apfelmännchen', type: 'mandel', cx: -0.65, cy: 0, w: 3.4, maxIter: 50, bands: 3, quip: 'Ganz klassisch. Drei Bänder, null Ausreden.' },
  { name: 'Julia „Seepferdchen“ c = -0.8+0.156i', type: 'julia', jr: -0.8, ji: 0.156, cx: 0, cy: 0, w: 3.6, maxIter: 90, bands: 4, quip: 'Julia ist Mandelbrots kleine Schwester – merkt sich aber mehr.' },
  { name: 'Seepferdchental', type: 'mandel', cx: -0.7453, cy: 0.1127, w: 0.03, maxIter: 200, bands: 4, quip: 'Seepferdchen haben ein Gedächtnis von 3 Sekunden. Ihr hoffentlich mehr.' },
  { name: 'Burning Ship', type: 'ship', cx: -0.45, cy: -0.5, w: 3.6, maxIter: 60, bands: 4, flipY: true, quip: 'Das Schiff brennt. Simon sagt: trotzdem weiterspielen.' },
  { name: 'Julia c = 0.285+0.01i', type: 'julia', jr: 0.285, ji: 0.01, cx: 0, cy: 0, w: 3.0, maxIter: 160, bands: 5, quip: 'Fünf Bänder. Ab hier wird mitgesummt.' },
  { name: 'Tricorn (Mandelbar)', type: 'tricorn', cx: -0.3, cy: 0, w: 4.0, maxIter: 60, bands: 5, quip: 'z wird konjugiert. Euer Gedächtnis hoffentlich nicht.' },
  { name: 'Elefantental', type: 'mandel', cx: 0.2855, cy: 0.0115, w: 0.012, maxIter: 300, bands: 5, quip: 'Elefanten vergessen nie. Beweist es.' },
  { name: 'Julia-Dendrit c = i', type: 'julia', jr: 0, ji: 1, cx: 0, cy: 0, w: 3.2, maxIter: 120, bands: 6, quip: 'Ein Dendrit ohne Inneres. Sechs Bänder. Viel Glück.' },
];

const QUIPS_SUCCESS = [
  'SIMON IST ZUFRIEDEN!',
  'Iterativ korrekt!',
  'Das Gedächtnis konvergiert!',
  'Wie ein Amiga mit 512 KB Extra-RAM!',
  'Fractint nickt anerkennend.',
];
const QUIPS_ERROR = [
  'Falsches Band – Simon ist enttäuscht.',
  'Divergiert! Nochmal von vorn.',
  'Das war Iteration daneben.',
  'Gedächtnis-Überlauf. Wie beim C64 nach POKE 53280.',
];

const stats = {
  score: 0,
  lives: DIFFICULTY.lives,
  level: 1,
  round: 0, // geschaffte Runden im Level
  rounds: 0, // geschaffte Runden insgesamt
  longest: 0,
  errors: 0,
  playTime: 0,
};

// ---------------------------------------------------------------------------------------------
// Zustand (vorbelegt, damit handle() auch ohne init() läuft)
// ---------------------------------------------------------------------------------------------

var gameState = 'start'; // start | zoom | render | show | input | success | error | gameover
var stateTime = 0;
var time = 0;
var shake = 0;
var quipText = '';
var newHighscore = false;

var sequence = [];
var showIndex = 0; // welcher Schritt wird gerade gezeigt
var showPhase = 'gap'; // on | gap
var showTimer = 0;
var inputIndex = 0;
var inputTimer = 0;
var cooldown = 0;
var demoTimer = 0;

var bands = []; // { lo, hi, hue, color, area, labelX, labelY, fill, flash }
var bandOfIter = new Uint8Array(2); // 0 = neutral, sonst Bandindex + 1
var blobInfo = [];
var particles = [];
var floaters = [];

var canvases = null;
var comp = { view: null, row: 0, done: false };
var iterBuf = new Uint16Array(settings.BW * settings.BH);
var hist = new Uint32Array(2);
var lut = new Uint32Array(2);
var colors = {};
var colorKey = null;
var lastZoomFrom = { x: 960, y: 480 };

var prevKeys = {};
function keyPressed(code) {
  const down = !!(laserConfig.pressedKeys && laserConfig.pressedKeys[code]);
  const was = !!prevKeys[code];
  prevKeys[code] = down;
  return down && !was;
}

function pick(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

// ---------------------------------------------------------------------------------------------
// Sound: Sample-Dateien + WebAudio-Töne für die Bänder
// ---------------------------------------------------------------------------------------------

function playSound(snd, volume) {
  try {
    const a = new Audio(snd);
    a.volume = volume === undefined ? 0.6 : volume;
    const p = a.play();
    if (p && p.catch) p.catch(() => {});
  } catch (e) {
    // Sound ist Deko
  }
}

var audioCtx = null;
function tone(freq, dur, type, vol) {
  try {
    if (!audioCtx) {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return;
      audioCtx = new AC();
    }
    if (audioCtx.state === 'suspended') audioCtx.resume();
    const t = audioCtx.currentTime;
    const o = audioCtx.createOscillator();
    const g = audioCtx.createGain();
    o.type = type || 'triangle';
    o.frequency.value = freq;
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(vol || 0.25, t + 0.02);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g);
    g.connect(audioCtx.destination);
    o.start(t);
    o.stop(t + dur + 0.05);
  } catch (e) {
    // kein Audio – egal
  }
}

function bandTone(b, dur) {
  tone(TONES[b % TONES.length], dur || 0.45, 'triangle', 0.3);
  tone(TONES[b % TONES.length] * 2, (dur || 0.45) * 0.6, 'sine', 0.08);
}

function errorTone() {
  tone(110, 0.7, 'sawtooth', 0.18);
  tone(116, 0.7, 'sawtooth', 0.12);
}

// ---------------------------------------------------------------------------------------------
// Farben (Komplementärbereich 0.25..0.75)
// ---------------------------------------------------------------------------------------------

function refreshColors() {
  const tc = laserConfig.testColor;
  const key = tc[0] + ',' + tc[1] + ',' + tc[2];
  if (colorKey === key) return;
  colorKey = key;
  colors = {
    hud: getRgbSpreadHex(tc, 0.5, 0.7, 0.95),
    hudDim: getRgbSpreadHex(tc, 0.42, 0.6, 0.55),
    warm: getRgbSpreadHex(tc, 0.3, 0.9, 1),
    accent: getRgbSpreadHex(tc, 0.6, 0.9, 1),
    danger: getRgbSpreadHex(tc, 0.27, 1, 0.9),
    neutral: getRgbSpreadHex(tc, 0.5, 0.2, 0.5),
    barBg: getRgbSpreadHex(tc, 0.5, 0.5, 0.15),
    button: getRgbSpreadHex(tc, 0.45, 0.8, 0.5),
    buttonGrow: getRgbSpreadHex(tc, 0.5, 0.8, 0.75),
    buttonActive: getRgbSpreadHex(tc, 0.55, 0.8, 1),
  };
  bands.forEach((b) => {
    b.color = getRgbSpreadHex(tc, b.hue, 0.9, 1);
  });
}

function rgbToU32(c) {
  return (255 << 24) | ((c[2] & 255) << 16) | ((c[1] & 255) << 8) | (c[0] & 255);
}

// ---------------------------------------------------------------------------------------------
// Fraktal-Berechnung (progressiv, Fractint-Style)
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
    masks: [],
  };
  for (let i = 0; i < settings.maxBands; i++) {
    const m = mk(settings.BW, settings.BH);
    m.small = mk(settings.BW / 4, settings.BH / 4);
    m.image = m.ctx.createImageData(settings.BW, settings.BH);
    m.pix = new Uint32Array(m.image.data.buffer);
    canvases.masks.push(m);
  }
  canvases.image = canvases.buf.ctx.createImageData(settings.BW, settings.BH);
  canvases.pix = new Uint32Array(canvases.image.data.buffer);
}

function getView(level) {
  if (level <= LOCATIONS.length) return LOCATIONS[level - 1];
  // danach im Kreis, aber mit mehr Bändern (Endlos-Simon)
  const base = LOCATIONS[(level - 1) % LOCATIONS.length];
  if (!base.hard) {
    base.hard = { name: base.name + ' (Endlos)', type: base.type, jr: base.jr, ji: base.ji, cx: base.cx, cy: base.cy, w: base.w, maxIter: base.maxIter, bands: settings.maxBands, flipY: base.flipY, quip: 'Endlos-Simon. Ab hier nur noch Ehre.' };
  }
  return base.hard;
}

function escapeTime(cr, ci, v, maxI, eps) {
  let x;
  let y;
  let ar;
  let ai;
  if (v.type === 'julia') {
    x = cr;
    y = ci;
    ar = v.jr;
    ai = v.ji;
  } else {
    if (v.type === 'mandel') {
      const xq = cr - 0.25;
      const q = xq * xq + ci * ci;
      if (q * (q + xq) <= 0.25 * ci * ci) return maxI;
      if ((cr + 1) * (cr + 1) + ci * ci <= 0.0625) return maxI;
    }
    x = 0;
    y = 0;
    ar = cr;
    ai = ci;
  }
  let px = x;
  let py = y;
  let period = 0;
  let check = 8;
  const ship = v.type === 'ship';
  const tri = v.type === 'tricorn';
  for (let i = 1; i < maxI; i++) {
    const x2 = x * x;
    const y2 = y * y;
    let ny;
    if (ship) ny = 2 * Math.abs(x * y) + ai;
    else if (tri) ny = -2 * x * y + ai;
    else ny = 2 * x * y + ai;
    x = x2 - y2 + ar;
    y = ny;
    if (x * x + y * y > 4) return i;
    if (Math.abs(x - px) < eps && Math.abs(y - py) < eps) return maxI;
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
  const maxI = Math.min(settings.maxIterCap, view.maxIter);
  hist = new Uint32Array(maxI + 1);
  bandOfIter = new Uint8Array(maxI + 1);
  lut = new Uint32Array(maxI + 1);
  bands = [];
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
  const dx = w / BW;
  const dy = h / BH;
  const maxI = Math.min(settings.maxIterCap, v.maxIter);
  const eps = Math.min(1e-12, dx * 1e-4);
  const pix = canvases.pix;
  const tc = laserConfig.testColor;
  const t0 = performance.now();
  while (comp.row < BH) {
    const by = comp.row;
    const ci = v.flipY ? v.cy - h / 2 + (by + 0.5) * dy : v.cy + h / 2 - (by + 0.5) * dy;
    let idx = by * BW;
    for (let bx = 0; bx < BW; bx++, idx++) {
      const it = escapeTime(x0 + (bx + 0.5) * dx, ci, v, maxI, eps);
      iterBuf[idx] = it;
      if (it < maxI) hist[it]++;
    }
    // vorläufige Farben für den Aufbau (Bänder gibt es erst am Ende)
    idx = by * BW;
    for (let bx = 0; bx < BW; bx++, idx++) {
      const it = iterBuf[idx];
      if (it >= maxI) pix[idx] = 0xff000000;
      else {
        if (!lut[it]) lut[it] = rgbToU32(getRgbSpread(tc, 0.25 + ((it * 0.13) % 0.5), 0.7, 0.18 + 0.2 * ((it * 0.37) % 1)));
        pix[idx] = lut[it];
      }
    }
    comp.row++;
    if (performance.now() - t0 > budgetMs) break;
  }
  if (comp.row >= BH) {
    comp.done = true;
    buildBands();
  }
}

// ---------------------------------------------------------------------------------------------
// Bänder bilden: Quantile des Histogramms, zu kleine verschmelzen
// ---------------------------------------------------------------------------------------------

function buildBands() {
  const v = comp.view;
  const maxI = Math.min(settings.maxIterCap, v.maxIter);
  const n = settings.BW * settings.BH;
  let total = 0;
  for (let i = 1; i < maxI; i++) total += hist[i];
  const minArea = DIFFICULTY.minBandShare * n;
  const K = Math.min(settings.maxBands, v.bands);
  bands = [];
  if (total > 0) {
    // Start: erste Iteration, ab der die neutralen Aussenflächen vorbei sind
    let acc = 0;
    let s = 1;
    for (let i = 1; i < maxI; i++) {
      if (acc + hist[i] > DIFFICULTY.skipShare * total && acc > 0) {
        s = i;
        break;
      }
      acc += hist[i];
      s = i + 1;
    }
    let e = maxI - 1;
    let acc2 = 0;
    for (let i = 1; i < maxI; i++) {
      acc2 += hist[i];
      if (acc2 >= DIFFICULTY.topShare * total) {
        e = i;
        break;
      }
    }
    if (e < s) e = s;
    let mass = 0;
    for (let i = s; i <= e; i++) mass += hist[i];
    const per = mass / K;
    let start = s;
    let cur = 0;
    for (let i = s; i <= e; i++) {
      cur += hist[i];
      if ((cur >= per && bands.length < K - 1) || i === e) {
        bands.push({ lo: start, hi: i, area: cur });
        start = i + 1;
        cur = 0;
      }
    }
    // zu kleine Bänder mit dem Nachbarn verschmelzen
    let merged = true;
    while (merged && bands.length > 2) {
      merged = false;
      for (let b = 0; b < bands.length; b++) {
        if (bands[b].area < minArea) {
          const other = b > 0 ? b - 1 : b + 1;
          const lo = Math.min(bands[b].lo, bands[other].lo);
          const hi = Math.max(bands[b].hi, bands[other].hi);
          bands[Math.min(b, other)] = { lo: lo, hi: hi, area: bands[b].area + bands[other].area };
          bands.splice(Math.max(b, other), 1);
          merged = true;
          break;
        }
      }
    }
  }
  // zu wenige Bänder (einzelne Iterationen dominieren)? Grösstes teilbares Band am Median teilen
  let splitting = true;
  while (splitting && bands.length > 0 && bands.length < K) {
    splitting = false;
    let bi = -1;
    for (let b = 0; b < bands.length; b++) {
      if (bands[b].hi > bands[b].lo && (bi < 0 || bands[b].area > bands[bi].area)) bi = b;
    }
    if (bi < 0) break;
    const band = bands[bi];
    let acc = 0;
    for (let i = band.lo; i < band.hi; i++) {
      acc += hist[i];
      if (acc >= band.area / 2) {
        if (acc >= minArea && band.area - acc >= minArea) {
          bands.splice(bi, 1, { lo: band.lo, hi: i, area: acc }, { lo: i + 1, hi: band.hi, area: band.area - acc });
          splitting = true;
        }
        break;
      }
    }
  }
  if (bands.length === 0) bands.push({ lo: 1, hi: maxI - 1, area: total });

  // Farben, Lookup, Label-Positionen, Masken
  const tc = laserConfig.testColor;
  bandOfIter.fill(0);
  bands.forEach((b, k) => {
    b.hue = bands.length > 1 ? 0.25 + (0.5 * k) / (bands.length - 1) : 0.5;
    b.color = getRgbSpreadHex(tc, b.hue, 0.9, 1);
    b.fill = 0;
    b.flash = 0;
    for (let i = b.lo; i <= b.hi; i++) bandOfIter[i] = k + 1;
  });
  const sumX = new Float64Array(bands.length);
  const sumY = new Float64Array(bands.length);
  const cnt = new Float64Array(bands.length);
  for (let i = 0; i < n; i++) {
    const it = iterBuf[i];
    if (it >= maxI) continue;
    const b = bandOfIter[it];
    if (!b) continue;
    sumX[b - 1] += i % settings.BW;
    sumY[b - 1] += Math.floor(i / settings.BW);
    cnt[b - 1]++;
  }
  const best = bands.map(() => ({ d: Infinity, x: 0, y: 0 }));
  const mx = bands.map((b, k) => (cnt[k] ? sumX[k] / cnt[k] : settings.BW / 2));
  const my = bands.map((b, k) => (cnt[k] ? sumY[k] / cnt[k] : settings.BH / 2));
  for (let i = 0; i < n; i++) {
    const it = iterBuf[i];
    if (it >= maxI) continue;
    const b = bandOfIter[it];
    if (!b) continue;
    const x = i % settings.BW;
    const y = Math.floor(i / settings.BW);
    // Label nicht an den Bildrand und nicht unter Titel/Sequenzpunkte (obere ~200 px) legen
    if (x < 30 || x > settings.BW - 30 || y < 52 || y > settings.BH - 20) continue;
    const d = (x - mx[b - 1]) * (x - mx[b - 1]) + (y - my[b - 1]) * (y - my[b - 1]);
    if (d < best[b - 1].d) best[b - 1] = { d: d, x: x, y: y };
  }
  bands.forEach((b, k) => {
    if (best[k].d === Infinity) best[k] = { d: 0, x: mx[k], y: Math.max(52, my[k]) };
    b.labelX = ((best[k].x + 0.5) / settings.BW) * settings.W;
    b.labelY = ((best[k].y + 0.5) / settings.BH) * settings.FH;
    b.label = b.lo === b.hi ? String(b.lo) : b.lo + '–' + b.hi;
    const m = canvases.masks[k];
    const col = rgbToU32(getRgbSpread(tc, b.hue, 0.5, 1));
    for (let i = 0; i < n; i++) {
      const it = iterBuf[i];
      m.pix[i] = it < maxI && bandOfIter[it] === k + 1 ? col : 0;
    }
    m.ctx.putImageData(m.image, 0, 0);
    m.small.ctx.clearRect(0, 0, m.small.canvas.width, m.small.canvas.height);
    m.small.ctx.imageSmoothingEnabled = true;
    m.small.ctx.drawImage(m.canvas, 0, 0, m.small.canvas.width, m.small.canvas.height);
  });
}

function bandAtScreen(x, y) {
  // Mehrheit im 3×3-Umfeld (verzeihend an Bandgrenzen); -1 = schwarze Menge, 0 = neutral
  const bx0 = Math.floor((x / settings.W) * settings.BW);
  const by0 = Math.floor((y / settings.FH) * settings.BH);
  const maxI = Math.min(settings.maxIterCap, comp.view.maxIter);
  const votes = [0, 0, 0, 0, 0, 0, 0];
  let inSet = 0;
  for (let oy = -1; oy <= 1; oy++) {
    for (let ox = -1; ox <= 1; ox++) {
      const bx = bx0 + ox;
      const by = by0 + oy;
      if (bx < 0 || by < 0 || bx >= settings.BW || by >= settings.BH) continue;
      const it = iterBuf[by * settings.BW + bx];
      if (it >= maxI) inSet++;
      else votes[bandOfIter[it]]++;
    }
  }
  let bestB = 0;
  let bestV = votes[0];
  for (let b = 1; b < votes.length; b++) {
    if (votes[b] > bestV) {
      bestV = votes[b];
      bestB = b;
    }
  }
  if (inSet > bestV) return -1;
  return bestB;
}

function screenToC(x, y) {
  const v = comp.view;
  const h = (v.w * settings.FH) / settings.W;
  const im = v.flipY ? v.cy + (y / settings.FH - 0.5) * h : v.cy - (y / settings.FH - 0.5) * h;
  return { re: v.cx + (x / settings.W - 0.5) * v.w, im: im };
}

// Farben pro Iteration für diesen Frame (Schimmern + Aufblitzen der Bänder)
function buildLut(dim) {
  const tc = laserConfig.testColor;
  const maxI = Math.min(settings.maxIterCap, comp.view.maxIter);
  for (let it = 0; it <= maxI; it++) {
    if (it >= maxI) {
      lut[it] = 0xff000000;
      continue;
    }
    const b = bandOfIter[it];
    if (b) {
      const band = bands[b - 1];
      const shimmer = 0.82 + 0.18 * Math.sin(it * 1.1 - time * 4);
      const val = Math.min(1, dim * shimmer + band.flash * 0.65);
      lut[it] = rgbToU32(getRgbSpread(tc, band.hue, 0.9 - band.flash * 0.3, val));
    } else {
      const val = 0.05 + 0.035 * (0.5 + 0.5 * Math.sin(it * 0.7 - time * 2));
      lut[it] = rgbToU32(getRgbSpread(tc, 0.5, 0.3, val));
    }
  }
}

function recolor() {
  const n = settings.BW * settings.BH;
  const pix = canvases.pix;
  for (let i = 0; i < n; i++) pix[i] = lut[iterBuf[i]];
}

// ---------------------------------------------------------------------------------------------
// Ablauf
// ---------------------------------------------------------------------------------------------

function setState(s) {
  gameState = s;
  stateTime = 0;
}

function showOn() {
  return Math.max(DIFFICULTY.showOnMin, DIFFICULTY.showOnStart + DIFFICULTY.showOnPerLevel * (stats.level - 1));
}
function showGap() {
  return Math.max(DIFFICULTY.showGapMin, DIFFICULTY.showGapStart + DIFFICULTY.showGapPerLevel * (stats.level - 1));
}

function newSequence() {
  const len = DIFFICULTY.startLength + Math.floor((stats.level - 1) / 2) * DIFFICULTY.lengthPerTwoLevels;
  sequence = [];
  for (let i = 0; i < len; i++) sequence.push(Math.floor(Math.random() * bands.length));
}

function startShow() {
  showIndex = 0;
  showPhase = 'gap';
  showTimer = 0.8; // kurze Pause vor dem ersten Band
  bands.forEach((b) => {
    b.fill = 0;
  });
  setState('show');
}

function startInput() {
  inputIndex = 0;
  inputTimer = DIFFICULTY.inputTimeout;
  cooldown = 0.3;
  bands.forEach((b) => {
    b.fill = 0;
  });
  setState('input');
}

function snapshotOld() {
  const o = canvases.old;
  o.ctx.clearRect(0, 0, settings.BW, settings.BH);
  o.ctx.drawImage(canvases.buf.canvas, 0, 0);
}

function goToLevel(level) {
  const oldView = comp.view;
  stats.level = level;
  stats.round = 0;
  const nv = getView(level);
  lastZoomFrom.x = settings.W / 2;
  lastZoomFrom.y = settings.FH / 2;
  if (oldView && oldView.type === nv.type && nv.type === 'mandel') {
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

function startGame() {
  stats.score = 0;
  stats.lives = DIFFICULTY.lives;
  stats.level = 1;
  stats.round = 0;
  stats.rounds = 0;
  stats.longest = 0;
  stats.errors = 0;
  stats.playTime = 0;
  particles = [];
  floaters = [];
  newHighscore = false;
  if (comp.view !== getView(1)) goToLevel(1);
  else {
    quipText = comp.view.quip;
    setState('render');
  }
}

function registerInput(b) {
  const band = bands[b];
  band.flash = 1;
  bandTone(b, 0.4);
  bands.forEach((x) => {
    x.fill = 0;
  });
  cooldown = DIFFICULTY.inputCooldown;
  if (b === sequence[inputIndex]) {
    burstAt(band.labelX, band.labelY, 18, band.hue);
    blobInfo.forEach((bi) => {
      if (bi.band === b + 1) burstAt(bi.blob.x, bi.blob.y, 6, band.hue);
    });
    inputIndex++;
    inputTimer = DIFFICULTY.inputTimeout;
    if (inputIndex >= sequence.length) roundSuccess();
  } else {
    roundError();
  }
}

function roundSuccess() {
  const pts = sequence.length * 10 * stats.level + Math.round(inputTimer * 2);
  stats.score += pts;
  stats.round++;
  stats.rounds++;
  stats.longest = Math.max(stats.longest, sequence.length);
  quipText = pick(QUIPS_SUCCESS);
  floaters.push({ x: settings.W / 2, y: 300, text: '+' + pts, life: 1.6, max: 1.6, size: 110 });
  // kleine Fanfare: die Sequenz im Schnelldurchlauf
  sequence.slice(0, 4).forEach((b, i) => {
    setTimeout(() => bandTone(b, 0.18), i * 90);
  });
  setState('success');
}

function roundError() {
  stats.lives--;
  stats.errors++;
  shake = 0.7;
  quipText = pick(QUIPS_ERROR);
  errorTone();
  if (stats.lives <= 0) endGame();
  else setState('error');
}

function endGame() {
  highscore.addEntry({ punkte: stats.score, laengsteSequenz: stats.longest, level: stats.level });
  newHighscore = highscore.lastEntryNewHighscore();
  playSound(soundGameOver, 0.7);
  setState('gameover');
}

// ---------------------------------------------------------------------------------------------
// Partikel
// ---------------------------------------------------------------------------------------------

function burstAt(x, y, n, hue) {
  for (let i = 0; i < n && particles.length < settings.maxParticles; i++) {
    const a = Math.random() * Math.PI * 2;
    const sp = 120 + Math.random() * 500;
    particles.push({ x: x, y: y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, life: 1, max: 1, hue: hue + (Math.random() - 0.5) * 0.08, size: 3 + Math.random() * 5 });
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
    p.x += p.vx * dt;
    p.y += p.vy * dt;
    p.vx *= 1 - 2 * dt;
    p.vy *= 1 - 2 * dt;
    const u = p.life / p.max;
    ctx.globalAlpha = u;
    ctx.fillStyle = getRgbSpreadHex(laserConfig.testColor, Math.max(0.25, Math.min(0.75, p.hue)), 0.7, 1);
    ctx.beginPath();
    ctx.arc(p.x, Math.min(p.y, settings.FH), p.size * (0.5 + u), 0, Math.PI * 2);
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
// Zeichnen
// ---------------------------------------------------------------------------------------------

function drawFractal(ctx, alpha, dim) {
  if (comp.done) {
    buildLut(dim);
    recolor();
  }
  canvases.buf.ctx.putImageData(canvases.image, 0, 0);
  ctx.save();
  if (shake > 0) ctx.translate((Math.random() - 0.5) * 30 * shake, (Math.random() - 0.5) * 30 * shake);
  ctx.globalAlpha = alpha;
  ctx.imageSmoothingEnabled = false;
  ctx.drawImage(canvases.buf.canvas, 0, 0, settings.W, settings.FH);
  const g = canvases.glow;
  g.ctx.imageSmoothingEnabled = true;
  g.ctx.drawImage(canvases.buf.canvas, 0, 0, g.canvas.width, g.canvas.height);
  ctx.imageSmoothingEnabled = true;
  ctx.globalCompositeOperation = 'lighter';
  ctx.globalAlpha = alpha * (0.3 + 0.1 * Math.sin(time * 1.7));
  ctx.drawImage(g.canvas, -20, -10, settings.W + 40, settings.FH + 20);
  // Bloom der aufblitzenden Bänder
  bands.forEach((b, k) => {
    if (b.flash <= 0.02) return;
    ctx.globalAlpha = b.flash * 0.9;
    ctx.drawImage(canvases.masks[k].small.canvas, -30, -15, settings.W + 60, settings.FH + 30);
  });
  ctx.restore();
}

function drawOldZoom(ctx, u) {
  const e = u * u * (3 - 2 * u);
  const s = Math.exp(e * 3);
  ctx.save();
  ctx.globalAlpha = 1 - e * 0.7;
  ctx.translate(lastZoomFrom.x, lastZoomFrom.y);
  ctx.scale(s, s);
  ctx.rotate(e * 0.6);
  ctx.translate(-lastZoomFrom.x, -lastZoomFrom.y);
  ctx.imageSmoothingEnabled = true;
  ctx.drawImage(canvases.old.canvas, 0, 0, settings.W, settings.FH);
  ctx.restore();
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

// Range-Label auf dem Band: dunkler Fleck (gut für die Kamera) + Füllring
function drawBandLabels(ctx, withFill) {
  bands.forEach((b) => {
    const r = 46;
    ctx.save();
    ctx.fillStyle = 'rgba(0,0,0,0.85)';
    ctx.beginPath();
    ctx.arc(b.labelX, b.labelY, r, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalCompositeOperation = 'lighter';
    ctx.strokeStyle = b.color;
    ctx.shadowColor = b.color;
    ctx.shadowBlur = 10 + 30 * b.flash;
    ctx.lineWidth = 3 + 4 * b.flash;
    ctx.globalAlpha = 0.6 + 0.4 * b.flash;
    ctx.beginPath();
    ctx.arc(b.labelX, b.labelY, r, 0, Math.PI * 2);
    ctx.stroke();
    if (withFill && b.fill > 0) {
      ctx.lineWidth = 9;
      ctx.globalAlpha = 1;
      ctx.beginPath();
      ctx.arc(b.labelX, b.labelY, r + 10, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * Math.min(1, b.fill));
      ctx.stroke();
    }
    ctx.restore();
    util.renderText({ ctx, text: b.label, x: b.labelX, y: b.labelY + 10, fontSize: b.label.length > 5 ? '22px' : '28px', fillStyle: b.color });
  });
}

function drawBlobs(ctx) {
  blobInfo.forEach((bi) => {
    const b = bi.blob;
    let col = colors.neutral;
    if (bi.band === -1) col = colors.danger;
    else if (bi.band > 0) col = bands[bi.band - 1].color;
    const pulse = 0.5 + 0.5 * Math.sin(time * 6 + b.id);
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    ctx.strokeStyle = col;
    ctx.shadowColor = col;
    ctx.shadowBlur = 18;
    ctx.lineWidth = bi.band > 0 ? 5 : 2;
    ctx.globalAlpha = bi.band > 0 ? 0.9 : 0.5;
    ctx.beginPath();
    ctx.arc(b.x, b.y, 30 + pulse * 6, 0, Math.PI * 2);
    ctx.stroke();
    // kleine Orbit-Spur (Gruss aus game-066)
    const c = screenToC(b.x, b.y);
    const v = comp.view;
    let zr = v.type === 'julia' ? c.re : 0;
    let zi = v.type === 'julia' ? c.im : 0;
    const ar = v.type === 'julia' ? v.jr : c.re;
    const ai = v.type === 'julia' ? v.ji : c.im;
    ctx.lineWidth = 1.5;
    ctx.globalAlpha = 0.45;
    ctx.beginPath();
    ctx.moveTo(b.x, b.y);
    for (let i = 0; i < 32; i++) {
      let ny;
      if (v.type === 'ship') ny = 2 * Math.abs(zr * zi) + ai;
      else if (v.type === 'tricorn') ny = -2 * zr * zi + ai;
      else ny = 2 * zr * zi + ai;
      zr = zr * zr - zi * zi + ar;
      zi = ny;
      ctx.lineTo(b.x + zr * 26, b.y - zi * 26);
      if (zr * zr + zi * zi > 4) break;
    }
    ctx.stroke();
    ctx.restore();
  });
}

function drawSequenceDots(ctx, done, highlight) {
  const n = sequence.length;
  const gap = 46;
  const x0 = settings.W / 2 - ((n - 1) * gap) / 2;
  for (let i = 0; i < n; i++) {
    ctx.save();
    const known = i < done;
    const col = known ? bands[sequence[i]].color : colors.hudDim;
    ctx.fillStyle = known ? col : 'rgba(0,0,0,0.7)';
    ctx.strokeStyle = col;
    ctx.lineWidth = 3;
    if (i === highlight) {
      ctx.shadowColor = colors.accent;
      ctx.shadowBlur = 20;
    }
    ctx.beginPath();
    ctx.arc(x0 + i * gap, 160, i === highlight ? 16 : 12, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    ctx.restore();
  }
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
  ctx.arc(x + (-1 + 0.35) * r * 2, y, 0.5 * r, 0, Math.PI * 2);
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
  util.renderText({ ctx, text: v.name, x: 30, y: top + 96, fontSize: '22px', fillStyle: colors.hudDim, align: 'left', font: 'Verdana' });
  util.renderText({ ctx, text: 'PUNKTE ' + stats.score, x: W - 30, y: top + 52, fontSize: '44px', fillStyle: colors.hud, align: 'right' });
  for (let i = 0; i < DIFFICULTY.lives; i++) {
    drawMiniBrot(ctx, W - 60 - i * 60, top + 88, 16, i < stats.lives ? colors.warm : '#222230');
  }

  // Bandbalken: Farbe, Range und Fülle
  if (bands.length && comp.done) {
    const totalW = 900;
    const bw = totalW / bands.length - 12;
    const x0 = W / 2 - totalW / 2;
    bands.forEach((b, k) => {
      const x = x0 + k * (bw + 12);
      ctx.save();
      ctx.fillStyle = colors.barBg;
      ctx.fillRect(x, top + 62, bw, 30);
      ctx.fillStyle = b.color;
      ctx.shadowColor = b.color;
      ctx.shadowBlur = 10 + 20 * b.flash;
      ctx.globalAlpha = 0.35 + 0.65 * Math.max(b.flash, gameState === 'input' ? 1 : 0.4);
      ctx.fillRect(x, top + 62, bw * Math.min(1, gameState === 'input' ? b.fill : 1), 30);
      ctx.restore();
      util.renderText({ ctx, text: (k + 1) + ':  i ' + b.label, x: x + bw / 2, y: top + 48, fontSize: '26px', fillStyle: b.color });
    });
    if (gameState === 'input') {
      ctx.save();
      ctx.fillStyle = inputTimer < 4 && Math.sin(time * 14) > 0 ? colors.danger : colors.hudDim;
      ctx.fillRect(x0, top + 100, totalW * Math.max(0, inputTimer / DIFFICULTY.inputTimeout), 8);
      ctx.restore();
    }
  } else {
    util.renderText({ ctx, text: 'FRAKTAL-SIMON', x: W / 2, y: top + 70, fontSize: '48px', fillStyle: colors.hudDim });
  }
}

function drawHighscorePanel(ctx, y) {
  const best = highscore.getHighscore();
  util.renderTextDropShadow({
    ctx,
    text: best
      ? 'Highscore: ' + Math.round(best.punkte) + ' Punkte  ·  längste Sequenz ' + best.laengsteSequenz + '  ·  Level ' + best.level
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

var highscore = createHighscore('Fraktal-Simon', 'punkte');

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
    edges: 6,
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
  if (gameState === 'gameover' && stateTime > 3) setState('start');
});

function styleButton(btn) {
  btn.setColor(colors.button);
  if (btn.setGrowColor) btn.setGrowColor(colors.buttonGrow);
  if (btn.setActiveColor) btn.setActiveColor(colors.buttonActive);
}

function evaluateBlobs() {
  blobInfo = [];
  if (!comp.done) return;
  tracker.getBlobs().forEach((b) => {
    if (b.y > settings.FH) return;
    blobInfo.push({ blob: b, band: bandAtScreen(b.x, b.y) });
  });
}

// ---------------------------------------------------------------------------------------------
// Hauptschleife
// ---------------------------------------------------------------------------------------------

function handleFrame(grid, elapsed) {
  const dt = Math.min(elapsed || 0, 0.1);
  time += dt;
  stateTime += dt;
  shake = Math.max(0, shake - dt);
  const ctx = MasterCanvas.get2dContext();
  ensureCanvases();
  refreshColors();
  if (!comp.view) beginCompute(getView(1));
  computeRows(DIFFICULTY.computeBudgetMs);
  bands.forEach((b) => {
    b.flash = Math.max(0, b.flash - dt * 2.2);
  });

  tracker.handle(grid, dt);
  evaluateBlobs();

  const kSpace = keyPressed('Space');
  const kDigit = [];
  for (let i = 0; i < settings.maxBands; i++) kDigit.push(keyPressed('Digit' + (i + 1)));
  const W = settings.W;

  if (gameState === 'start') {
    // Demo: zufällige Bänder blinken lautlos
    demoTimer -= dt;
    if (comp.done && bands.length && demoTimer <= 0) {
      bands[Math.floor(Math.random() * bands.length)].flash = 1;
      demoTimer = 0.9;
    }
    drawFractal(ctx, 0.9, 0.3);
    drawScanline(ctx);
    drawBlobs(ctx);
    bigText(ctx, 'FRAKTAL-SIMON', 210, 150, colors.accent, 45);
    bigText(ctx, 'Merkt euch, welche Iterationsbänder aufblinken – und leuchtet sie nach.', 300, 38, colors.hud, 10);
    bigText(ctx, 'Die Mehrheit entscheidet: das Band, das zuerst voll ist, zählt.', 360, 32, colors.hudDim, 0);
    drawDarkSpot(ctx, W / 2, 720, 190);
    styleButton(startButton);
    startButton.handle(grid, dt);
    drawHighscorePanel(ctx, 900);
    if (kSpace) startGame();
  } else if (gameState === 'zoom') {
    drawOldZoom(ctx, Math.min(1, stateTime / DIFFICULTY.zoomTime));
    bigText(ctx, 'LEVEL ' + stats.level, 420, 150, colors.accent, 45);
    bigText(ctx, getView(stats.level).name, 520, 48, colors.hud, 15);
    if (stateTime >= DIFFICULTY.zoomTime) setState('render');
  } else if (gameState === 'render') {
    drawFractal(ctx, 1, 0.35);
    drawScanline(ctx);
    bigText(ctx, 'LEVEL ' + stats.level, 420, 150, colors.accent, 45);
    bigText(ctx, comp.view.name, 520, 48, colors.hud, 15);
    bigText(ctx, quipText, 600, 34, colors.hudDim, 0);
    if (comp.done) bigText(ctx, bands.length + ' Bänder: ' + bands.map((b) => b.label).join('   '), 680, 40, colors.warm, 10);
    else bigText(ctx, 'Rechne … Zeile ' + comp.row + ' / ' + settings.BH, 880, 30, colors.hudDim, 0);
    if (comp.done && stateTime >= DIFFICULTY.minRenderTime + 1) {
      newSequence();
      startShow();
    }
  } else if (gameState === 'show') {
    showTimer -= dt;
    if (showTimer <= 0) {
      if (showPhase === 'gap') {
        if (showIndex >= sequence.length) {
          startInput();
        } else {
          showPhase = 'on';
          showTimer = showOn();
          bands[sequence[showIndex]].flash = 1;
          bandTone(sequence[showIndex], showOn());
        }
      } else {
        showPhase = 'gap';
        showTimer = showGap();
        showIndex++;
      }
    }
    if (showPhase === 'on' && showIndex < sequence.length) bands[sequence[showIndex]].flash = Math.max(bands[sequence[showIndex]].flash, 0.85);
    drawFractal(ctx, 1, 0.22);
    drawBandLabels(ctx, false);
    bigText(ctx, 'SIMON ZEIGT …', 100, 60, colors.hud, 15);
    drawSequenceDots(ctx, Math.min(showIndex + (showPhase === 'on' ? 1 : 0), sequence.length), showIndex);
  } else if (gameState === 'input') {
    stats.playTime += dt;
    inputTimer -= dt;
    cooldown = Math.max(0, cooldown - dt);
    // Mehrheit: Anteil der Laser je Band
    const counts = [0, 0, 0, 0, 0, 0, 0];
    let total = 0;
    blobInfo.forEach((bi) => {
      total++;
      if (bi.band > 0) counts[bi.band]++;
    });
    let triggered = -1;
    bands.forEach((b, k) => {
      const share = total > 0 ? counts[k + 1] / total : 0;
      if (cooldown <= 0 && share > 0) b.fill += DIFFICULTY.fillRate * share * dt;
      else b.fill = Math.max(0, b.fill - DIFFICULTY.fillDecay * dt);
      if (b.fill >= 1 && triggered < 0) triggered = k;
      if (kDigit[k]) triggered = k;
    });
    drawFractal(ctx, 1, 0.36);
    drawBandLabels(ctx, true);
    drawBlobs(ctx);
    bigText(ctx, 'NACHMACHEN!  ' + (inputIndex + 1) + ' / ' + sequence.length, 100, 60, colors.warm, 20);
    drawSequenceDots(ctx, inputIndex, inputIndex);
    if (triggered >= 0) registerInput(triggered);
    else if (inputTimer <= 0) roundError();
  } else if (gameState === 'success') {
    drawFractal(ctx, 1, 0.4);
    drawBandLabels(ctx, false);
    drawBlobs(ctx);
    bigText(ctx, quipText, 200, 60, colors.accent, 25);
    if (stateTime >= DIFFICULTY.successTime) {
      if (stats.round >= DIFFICULTY.roundsPerLevel) {
        goToLevel(stats.level + 1);
      } else {
        sequence.push(Math.floor(Math.random() * bands.length));
        startShow();
      }
    }
  } else if (gameState === 'error') {
    drawFractal(ctx, 0.8, 0.25);
    drawBandLabels(ctx, false);
    bigText(ctx, quipText, 200, 56, colors.danger, 25);
    bigText(ctx, 'Simon zeigt es nochmal.', 280, 40, colors.hudDim, 0);
    if (stateTime >= DIFFICULTY.errorTime) startShow();
  } else if (gameState === 'gameover') {
    drawFractal(ctx, 0.35, 0.25);
    bigText(ctx, 'GAME OVER', 200, 150, colors.danger, 50);
    bigText(ctx, quipText, 290, 34, colors.hudDim, 0);
    bigText(
      ctx,
      'Punkte: ' + stats.score + '   ·   Level ' + stats.level + '   ·   ' + stats.rounds + ' Runden\n' +
        'Längste Sequenz: ' + stats.longest + '   ·   Fehler ' + stats.errors + '   ·   Spielzeit ' + Math.round(stats.playTime) + ' s',
      380,
      44,
      colors.hud,
      10
    );
    if (newHighscore) bigText(ctx, 'NEUER HIGHSCORE! Simon hätte am Amiga applaudiert.', 520, 40, colors.warm, 25);
    if (stateTime > 3) {
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
  name: 'Fraktal-Simon',
  description:
    'Fraktal-Simon – „Simon sagt“ mit Iterationsbändern!\n\n' +
    'Das Fraktal ist in farbige Iterationsbänder zerlegt (z. B. 4–5, 6–8, 10–15).\n' +
    'Simon lässt sie nacheinander aufblinken – merkt euch die Reihenfolge.\n' +
    'Dann leuchtet ihr sie nach: Das Band, in dem die MEISTEN Laser sind, füllt sich.\n' +
    'Ist es voll, gilt es als Eingabe. Falsches Band = Leben weg.\n' +
    'Jede Runde wird die Sequenz länger, jedes Level bringt ein neues Fraktal.',
  image: 'media/img/gametitles/laser-mandelbrot-###4###.png',
  init: () => {
    gameState = 'start';
    stateTime = 0;
    stats.score = 0;
    stats.lives = DIFFICULTY.lives;
    stats.level = 1;
    stats.round = 0;
    stats.rounds = 0;
    stats.longest = 0;
    stats.errors = 0;
    stats.playTime = 0;
    sequence = [];
    particles = [];
    floaters = [];
    blobInfo = [];
    shake = 0;
    newHighscore = false;
    tracker.reset();
    colorKey = null;
    comp.view = null; // Level 1 wird im ersten Frame neu gerechnet
  },
  handle: (grid, elapsed) => {
    try {
      handleFrame(grid, elapsed);
    } catch (e) {
      console.error('Fraktal-Simon:', e);
    }
  },
  stop: () => {
    particles = [];
    floaters = [];
    try {
      if (audioCtx && audioCtx.close) audioCtx.close();
    } catch (e) {
      // egal
    }
    audioCtx = null;
  },
};
