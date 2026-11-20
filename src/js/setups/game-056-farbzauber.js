/**
 * Farbzauber – die graue Fraktal-Welt bekommt ihre Farbe zurück
 *
 * Unten liegt eine graue, nur konturierte Fraktal-Landschaft (Welt 1: Mandelbrot-Gebirge, Welt 2: Julia-Küste,
 * Welt 3: Nebel-Hügel, danach wieder von vorn mit anderen Ausschnitten). Sie ist in 6 Zonen geteilt.
 * Jede Zone hat eine eigene Zielfarbe – eine Mischung aus den drei Grundtönen (z. B. 2× Grün-Ton + 1× Blau-Ton).
 *
 * Regeln:
 * - Im dunklen Aktionsband schweben Farbtropfen in drei Grundtönen. Anleuchten = fangen.
 * - Der Bildschirm ist in drei Drittel geteilt, jedes Drittel hat seinen KESSEL. Ein gefangener Tropfen fliegt in den
 *   Kessel des Drittels, in dem er gefangen wurde (passt er dort nicht, aber im Nachbarkessel, hilft er dort aus).
 *   Über dem Kessel steht sein Rezept (die Mischung der Zone, die er gerade färben will – der Pfeil zeigt welche).
 *   Jeder Kessel gießt nur auf die zwei Zonen unter seinem Drittel – drei Teams nach Saalbereich.
 * - Ist das Rezept komplett, leuchtet der Kessel: alle zusammen GIESSEN (gui/pixelFillButton – mehr Laser =
 *   schneller). Die Zone wird mit fraktalem Detail-Reveal farbig.
 * - Falsche Farbe oder ein MATSCH-SPRITZER (ab Level 2) im Kessel = Matsch. Dann muss der Kessel erst gemeinsam
 *   GELEERT werden (gleicher Knopf), die gesammelten Tropfen sind weg. Wildes Herumleuchten wird so bestraft.
 * - KLECKS-GEISTER saugen die Farbe aus eingefärbten Zonen und klauen Tropfen. Anleuchten, bis sie platzen
 *   (geklaute Tropfen kommen zurück). Ab Level 4 kommt pro Welt ein RIESENKLECKS, der nur im Team platzt.
 * - REGENBOGEN-TROPFEN (ab Level 3) passen in jedes Rezept und putzen sogar einen Matsch-Kessel sauber.
 * - Level geschafft, wenn die Welt zu X % eingefärbt ist (70 % in Welt 1, dann mehr). Läuft die Zeit vorher ab:
 *   Game Over. Highscore: Punkte, Level, Welten, Güsse, Geister.
 *
 * Licht-Kniff (Christians Regel „Aktionsflächen dunkel“):
 * - Geteilter Bildschirm: oben das schwarze AKTIONSBAND (Tropfen, Geister, Kessel = alle Fangziele), unten die
 *   LANDSCHAFT als reine Anzeige. Dort wird nie ein Laser ausgewertet, also darf sie bunt und hell sein.
 * - Jedes Fangziel liegt auf einer schwarzen Scheibe und ist nur konturiert (Tropfen, Geister, Kessel).
 *   Kesselinhalt ist nur eine dünne Flüssigkeitslinie, kein gefülltes Farbfeld.
 * - Alle Farben über getRgbSpreadHex(testColor, hue 0.25..0.75) – nie die Laserfarbe. Grundtöne 0.3/0.5/0.7,
 *   Mischungen liegen dazwischen.
 * - Die Fraktale werden pro Welt EINMAL in Offscreen-Canvas gerechnet (grau + 8 Reveal-Schichten).
 *
 * Tastatur (Test ohne Laser):
 * - Leertaste: Start / Nochmal
 * - 1 / 2 / 3: einen passenden Tropfen für Kessel 1 / 2 / 3 fangen
 * - 4 / 5 / 6: Kessel 1 / 2 / 3 auslösen (gießen, wenn fertig – leeren, wenn Matsch)
 * - 7: Matsch-Spritzer in Kessel 1 werfen (Strafe testen) · 0: alle Geister platzen lassen
 * - N: Level sofort geschafft · X: Zeit auf 0 (Game Over testen)
 *   (d v g r m h t f F s, PageUp/PageDown/Home sind Debug-Tasten in view.js und hier bewusst frei)
 *
 * Klassiker: Wizball (Sensible Software / Ocean, C64 1987) – eine graue Welt wieder einfärben, Farbtropfen fangen,
 * im Kessel mischen. Hier ohne Ball und Katze: Das Publikum ist der Zauberer, und gemischt wird im Team.
 * Ähnlichkeiten im Bestand: Malen/Einfärben wie game-006-montagsmaler und game-019-dienstagsmaler (dort malt man
 * frei, hier nach Rezept), Fraktale wie game-008-mandelbrot und game-022-fractal-bakery (Mandelbrot als Kulisse).
 * Kessel-Rezepte erinnern an Sortierspiele (game-019-sorter): richtige Farbe in den richtigen Topf.
 *
 * One-Pixel-Netzwerkspiel: funktioniert. Alle Eingaben sind Flächenanteile (pixelFillButton): Jeder Mitspieler
 * steuert einen Punkt, mehrere Punkte auf einem Ziel füllen schneller. Die Drittel-Kessel ergeben im Netz drei
 * natürliche Teams. Für sehr wenige Pixel müsste fullPercent der Ziele kleiner gewählt werden.
 */

import util, { getRgbSpread, getRgbSpreadHex, renderTextDropShadow } from '../util.js';
import { createKeyEdge } from './gui/gridScan.js';
import soundPickup from '../../../public/media/opengameart/Item Pickup.ogg';
import soundError from '../../../public/media/opengameart/Menu Error.ogg';
import soundPour from '../../../public/media/485066__javierserrat__object-falls-into-the-water.wav';
import soundPop from '../../../public/media/369952__mischy__plop-1.wav';
import soundLevelUp from '../../../public/media/opengameart/Level Up.ogg';
import soundRainbow from '../../../public/media/opengameart/Ability Learn.ogg';
import soundSteal from '../../../public/media/opengameart/Decline.wav';
import soundReady from '../../../public/media/opengameart/Menu Confirm.ogg';
import soundBigPop from '../../../public/media/155235__zangrutz__bomb-small (1).mp3';
import soundMusic from '../../../public/media/522110__setuniman__cheeky-1t41b.wav';
import soundJingle from '../../../public/media/521966__kastenfrosch__ready-to-start-jingle.ogg';
import soundGameOver from '../../../public/media/opengameart/Music Box Game Over III.wav';
var laserConfig = require('../LaserApiConfig.js').default;
var MasterCanvas = require('../MasterCanvas').default;
var guiFillButton = require('./gui/fillButton-ai2').default;
var guiPixelFillButton = require('./gui/pixelFillButton').default;
var createHighscore = require('../util/highscore').default;

const W = 1920;
const H = 1080;
const HUD_H = 86;
const BAND_TOP = 150; // Tropfen-Mittelpunkte zwischen BAND_TOP und BAND_BOTTOM
const BAND_BOTTOM = 420;
const RECIPE_Y = 505;
const CAUL_Y = 610;
const CAUL_R = 78;
const LAND_Y = 700; // ab hier nur Anzeige
const LAND_H = H - LAND_Y;
const LW = 960; // Offscreen-Auflösung der Landschaft (wird ×2 gezeichnet)
const LH = 190;
const ZONES = 6;
const ZONE_W = W / ZONES;
const THIRD_X = [320, 960, 1600];
const BASE_HUES = [0.3, 0.5, 0.7];
const BASE_NAMES = ['Grün', 'Türkis', 'Blau']; // nur grob, die echten Töne hängen von der Laserfarbe ab
const LAYERS = 8;
const GHOST_HOVER_Y = 610;
const BIG_HOVER_Y = 400;

// ---------------------------------------------------------------------------------------------------------
// Einstellungen
// ---------------------------------------------------------------------------------------------------------

const SETTINGS = {
  dropRadius: 58,
  ghostRadius: 60,
  bigGhostRadius: 96,
  flyTime: 0.55,
  pourDuration: 1.4,
  pourRate: 0.8, // Farbe pro Sekunde, die beim Gießen in die Zone fließt
  shineTime: 10, // Gießen auf eine volle Zone: so lange geisterfest
  levelUpDuration: 3.6,
  againDelay: 1.5,
  maxParticles: 420,
  maxFloaters: 30,
  catchPoints: 10,
  pourPointsPerDrop: 50,
  ghostPoints: 150,
  bigGhostPoints: 600,
  rainbowPoints: 100,
  timeBonusPerSecond: 10,
  spoilPenalty: 30,
};

const DIFFICULTY = {
  timeStart: 120,
  timePerLevel: 8,
  timeMax: 170,
  goalStart: 0.7,
  goalPerLevel: 0.03,
  goalMax: 0.85,
  recipeSizes: [2, 3, 3, 4, 4, 5], // pro Level, danach bleibt der letzte Wert
  dropInterval: 1.0,
  dropIntervalPerLevel: -0.05,
  dropIntervalMin: 0.55,
  dropsMax: 9,
  dropsMaxPerLevel: 1,
  dropsMaxCap: 14,
  dropSpeed: 55,
  dropSpeedPerLevel: 12,
  dropSpeedMax: 170,
  dropLife: 15,
  neededBias: 0.6, // Anteil Tropfen, die gerade irgendein Kessel braucht
  dropFill: 150, // speedUp der Tropfen
  splatFromLevel: 2,
  splatChance: 0.1,
  splatChancePerLevel: 0.02,
  splatChanceMax: 0.22,
  rainbowFromLevel: 3,
  rainbowChance: 0.06,
  ghostsMaxStart: 1,
  ghostsMaxPerLevel: 1,
  ghostsMaxCap: 6,
  ghostFirst: 8,
  ghostInterval: 10,
  ghostIntervalPerLevel: -0.8,
  ghostIntervalMin: 4,
  ghostSpeed: 70,
  ghostSpeedPerLevel: 10,
  ghostSpeedMax: 160,
  ghostFill: 75,
  ghostFillPerLevel: -5,
  ghostFillMin: 40,
  drainRate: 0.05, // Farbe pro Sekunde
  drainPerLevel: 0.01,
  drainMax: 0.12,
  bigGhostFromLevel: 4,
  bigGhostFill: 26,
  bigGhostAt: 0.25, // Anteil der Levelzeit, nach dem der Riesenklecks kommt
  pourFill: 45,
  emptyFill: 40,
};

const LEVEL_NEWS = {
  1: 'Tropfen fangen · Kessel füllen · GEMEINSAM GIESSEN',
  2: 'Matsch-Spritzer! Bloß nicht anleuchten!',
  3: 'Regenbogen-Tropfen passen überall – und putzen Matsch weg',
  4: 'Ein RIESENKLECKS! Alle zusammen drauf!',
  5: 'Vierer-Mischungen, schnellere Tropfen',
  6: 'Fünfer-Mischungen – Meisterzauberei!',
};

const WORLDS = [
  { name: 'Mandelbrot-Gebirge', kind: 'mandel' },
  { name: 'Julia-Küste', kind: 'julia' },
  { name: 'Nebel-Hügel', kind: 'hills' },
];

// ---------------------------------------------------------------------------------------------------------
// Zustand (vorbelegt – handle() läuft auch ohne init())
// ---------------------------------------------------------------------------------------------------------

const STATE = {
  scene: 'title',
  sceneTime: 0,
  time: 0,
  level: 1,
  clock: DIFFICULTY.timeStart,
  levelTimeTotal: DIFFICULTY.timeStart,
  levelTime: 0,
  goal: DIFFICULTY.goalStart,
  score: 0,
  shake: 0,
  flash: 0,
  newHighscore: false,
  endReason: '',
  dropTimer: 1,
  ghostTimer: DIFFICULTY.ghostFirst,
  bigSpawned: false,
  lastBonus: 0,
};

const STATS = {
  drops: 0,
  rainbows: 0,
  spoils: 0,
  empties: 0,
  pours: 0,
  ghosts: 0,
  bigGhosts: 0,
  stolen: 0,
  worlds: 0,
};

var world = null; // { level, kind, name, F, IN, EDGE, R, grey, layers, palKey }
var nextJob = null; // nächste Welt, wird in Level-Up/Game-Over portionsweise vorgerechnet
var zones = [];
var cauldrons = [];
var drops = [];
var ghosts = [];
var flyers = [];
var pours = [];
var particles = [];
var floaters = [];
var stars = [];

var startButton = null;
var againButton = null;
var music = null;
var keyEdge = createKeyEdge();
var highscore = createHighscore('Farbzauber', 'punkte');

var PAL = null;
var palKey = '';

// ---------------------------------------------------------------------------------------------------------
// Hilfen
// ---------------------------------------------------------------------------------------------------------

function clampHue(h) {
  return Math.max(0.25, Math.min(0.75, h));
}

/** Farbe aus der Laserfarbe; Hue immer im Komplementärbereich 0.25..0.75 */
function col(h, s, v) {
  return getRgbSpreadHex(laserConfig.testColor, clampHue(h), s, v);
}

function rgb(h, s, v) {
  return getRgbSpread(laserConfig.testColor, clampHue(h), s, v);
}

function ensurePalette() {
  const key = String(laserConfig.testColor);
  if (PAL && key === palKey) return;
  palKey = key;
  PAL = {
    base: BASE_HUES.map((h) => col(h, 0.75, 1)),
    baseDim: BASE_HUES.map((h) => col(h, 0.6, 0.45)),
    mud: col(0.32, 0.3, 0.5),
    mudDim: col(0.32, 0.3, 0.3),
    ghost: col(0.5, 0.06, 0.78),
    ghostDim: col(0.5, 0.05, 0.4),
    ghostEye: col(0.5, 0.04, 0.95),
    caul: col(0.55, 0.15, 0.6),
    caulDim: col(0.55, 0.1, 0.32),
    hud: col(0.45, 0.4, 0.92),
    hudDim: col(0.45, 0.3, 0.55),
    warn: col(0.72, 0.85, 1),
    good: col(0.35, 0.7, 1),
    title: col(0.4, 0.65, 1),
    sub: col(0.6, 0.45, 0.9),
    flash: col(0.5, 0.25, 1),
    star: col(0.55, 0.2, 0.3),
    sep: col(0.5, 0.1, 0.22),
    start: [col(0.45, 0.6, 0.6), col(0.45, 0.6, 0.8), col(0.45, 0.6, 1)],
  };
  if (world) renderWorldImages(world);
}

function zoneColor(z, s, v) {
  return col(z.hue, s === undefined ? 0.75 : s, v === undefined ? 1 : v);
}

function playSound(src, volume) {
  try {
    const a = new Audio(src);
    a.volume = volume === undefined ? 1 : volume;
    const p = a.play();
    if (p && p.catch) p.catch(() => {});
    return a;
  } catch (e) {
    return null;
  }
}

function stopMusic() {
  if (music) {
    try {
      music.pause();
    } catch (e) {
      // egal
    }
    music = null;
  }
}

function setScene(name) {
  STATE.scene = name;
  STATE.sceneTime = 0;
}

function lvlValue(start, per, limit, isMin) {
  const v = start + (STATE.level - 1) * per;
  return isMin ? Math.max(limit, v) : Math.min(limit, v);
}

function recipeSize(level) {
  const list = DIFFICULTY.recipeSizes;
  return list[Math.min(level - 1, list.length - 1)];
}

function thirdOf(x) {
  return Math.max(0, Math.min(2, Math.floor(x / (W / 3))));
}

function addParticles(x, y, count, color, speed, gravity) {
  for (let i = 0; i < count && particles.length < SETTINGS.maxParticles; i++) {
    const a = Math.random() * Math.PI * 2;
    const s = (0.3 + Math.random()) * (speed || 220);
    const life = 0.5 + Math.random() * 0.8;
    particles.push({
      x,
      y,
      vx: Math.cos(a) * s,
      vy: Math.sin(a) * s - (gravity ? 120 : 0),
      g: gravity || 0,
      life,
      max: life,
      color,
      size: 3 + Math.random() * 5,
    });
  }
}

function addFloater(x, y, text, color) {
  if (floaters.length >= SETTINGS.maxFloaters) floaters.shift();
  floaters.push({ x, y, text, color, life: 1.6 });
}

// ---------------------------------------------------------------------------------------------------------
// Fraktal-Landschaft (einmal pro Welt vorgerendert)
// ---------------------------------------------------------------------------------------------------------

function hash2(x, y, seed) {
  const s = Math.sin(x * 127.1 + y * 311.7 + seed * 74.7) * 43758.5453;
  return s - Math.floor(s);
}

function valueNoise(x, y, seed) {
  const xi = Math.floor(x);
  const yi = Math.floor(y);
  const xf = x - xi;
  const yf = y - yi;
  const u = xf * xf * (3 - 2 * xf);
  const v = yf * yf * (3 - 2 * yf);
  const a = hash2(xi, yi, seed);
  const b = hash2(xi + 1, yi, seed);
  const c = hash2(xi, yi + 1, seed);
  const d = hash2(xi + 1, yi + 1, seed);
  return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
}

function fbm(x, y, seed, octaves) {
  let sum = 0;
  let amp = 0.5;
  let f = 1;
  let norm = 0;
  for (let i = 0; i < octaves; i++) {
    sum += amp * valueNoise(x * f, y * f, seed + i * 13);
    norm += amp;
    amp *= 0.5;
    f *= 2.03;
  }
  return sum / norm;
}

/** Escape-Zeit (geglättet) + Orbit-Falle; liefert v 0..1 und ob der Punkt in der Menge liegt */
function escape(zr, zi, cr, ci, maxIter, out) {
  let trap = 1e9;
  let n = 0;
  let r2 = zr * zr + zi * zi;
  while (n < maxIter && r2 < 64) {
    const t = zr * zr - zi * zi + cr;
    zi = 2 * zr * zi + ci;
    zr = t;
    r2 = zr * zr + zi * zi;
    if (r2 < trap) trap = r2;
    n++;
  }
  if (n >= maxIter) {
    out.inside = 1;
    out.v = Math.min(1, Math.sqrt(Math.sqrt(trap)) * 1.15);
  } else {
    const mu = n + 1 - Math.log(Math.log(Math.sqrt(r2))) / Math.LN2;
    out.inside = 0;
    out.v = Math.max(0, Math.min(1, Math.sqrt(Math.max(0, mu) / maxIter)));
  }
}

/**
 * Fraktal-Feld als „Job“: wird zeilenweise gerechnet, damit der Bau der nächsten Welt während der
 * Level-Up-Szene über mehrere Frames verteilt werden kann (kein Ruckler). Ergebnis: F (0..1), IN (in der Menge
 * bzw. Boden), danach EDGE (Konturen) und R (Reveal-Schicht je Pixel).
 */
function createFieldJob(level) {
  const idx = (level - 1) % WORLDS.length;
  const variant = Math.floor((level - 1) / WORLDS.length);
  const job = {
    level,
    kind: WORLDS[idx].kind,
    name: WORLDS[idx].name + (variant > 0 ? ' ' + (variant + 1) : ''),
    variant,
    seed: level * 17.3 + Math.floor(Math.random() * 100),
    F: new Float32Array(LW * LH),
    IN: new Uint8Array(LW * LH),
    EDGE: null,
    R: null,
    row: 0,
    done: false,
    horizons: null,
    L: null, // Hügel: Kettennummer je Pixel (für saubere Konturen)
  };
  if (job.kind === 'hills') {
    // drei fBm-Grate, vorne tiefer
    job.horizons = [];
    for (let j = 0; j < 3; j++) {
      const hz = new Float32Array(LW);
      for (let x = 0; x < LW; x++) {
        const n = fbm(x * 0.006 * (1 + j * 0.6) + job.seed + j * 10, j * 3.1, job.seed, 5);
        const ridge = 1 - Math.abs(n * 2 - 1);
        hz[x] = LH * (0.12 + 0.22 * j) + LH * 0.32 * (1 - ridge);
      }
      job.horizons.push(hz);
    }
    job.L = new Uint8Array(LW * LH);
  }
  return job;
}

function computeFieldRow(job, y, out) {
  const F = job.F;
  const IN = job.IN;
  const v = job.variant;
  if (job.kind === 'mandel') {
    // obere Hälfte der Mandelbrotmenge, liegend: die Menge selbst ist das Gebirge
    const re0 = -2.2 + v * 0.06;
    const reW = 2.95 - v * 0.12;
    const ci = ((LH - y) / LH) * (1.25 - v * 0.05);
    for (let x = 0; x < LW; x++) {
      escape(0, 0, re0 + (x / LW) * reW, ci, 70, out);
      F[y * LW + x] = out.v;
      IN[y * LW + x] = out.inside;
    }
  } else if (job.kind === 'julia') {
    const cr = -0.8 + v * 0.025;
    const cim = 0.156 - v * 0.01;
    const zi = 0.62 - (y / LH) * 1.24;
    for (let x = 0; x < LW; x++) {
      escape(-1.65 + (x / LW) * 3.3, zi, cr, cim, 80, out);
      F[y * LW + x] = out.v;
      IN[y * LW + x] = out.inside;
    }
  } else {
    const hz = job.horizons;
    for (let x = 0; x < LW; x++) {
      let layer = -1;
      for (let j = 2; j >= 0; j--) {
        if (y > hz[j][x]) {
          layer = j;
          break;
        }
      }
      const i = y * LW + x;
      if (layer < 0) {
        F[i] = Math.max(0, fbm(x * 0.012, y * 0.04, job.seed + 5, 3) - 0.4) * 0.6; // zarte Nebelschwaden
        IN[i] = 0;
        job.L[i] = 0;
      } else {
        // Höhenlinien parallel zum Grat, leicht fraktal verbeult
        const tex = fbm(x * 0.03, y * 0.06, job.seed + layer * 7, 3);
        const depth = (y - hz[layer][x]) / LH;
        F[i] = Math.max(0, Math.min(1, 0.95 - layer * 0.12 + (tex - 0.5) * 0.25 - depth * 1.6));
        IN[i] = 1;
        job.L[i] = layer + 1;
      }
    }
  }
}

function nowMs() {
  return typeof performance !== 'undefined' && performance.now ? performance.now() : Date.now();
}

/** rechnet Zeilen, bis budgetMs verbraucht ist; true = fertig */
function stepFieldJob(job, budgetMs) {
  if (job.done) return true;
  const t0 = nowMs();
  const out = { v: 0, inside: 0 };
  while (job.row < LH) {
    computeFieldRow(job, job.row, out);
    job.row++;
    if (nowMs() - t0 > budgetMs) break;
  }
  if (job.row < LH) return false;
  // Konturen (Bandwechsel) und Reveal-Rang
  const F = job.F;
  const IN = job.IN;
  const L = job.L;
  // Bandnummer je Pixel: Hügel = Kette + grobe Höhenlinien, Fraktale = Escape-Bänder
  const bandOf = (i) => (L ? L[i] * 10 + Math.floor(F[i] * 5) : Math.floor(F[i] * 10) + IN[i] * 20);
  const EDGE = new Uint8Array(LW * LH);
  const R = new Uint8Array(LW * LH);
  for (let y = 0; y < LH; y++) {
    for (let x = 0; x < LW; x++) {
      const i = y * LW + x;
      const band = bandOf(i);
      const bx = x < LW - 1 ? bandOf(i + 1) : band;
      const by = y < LH - 1 ? bandOf(i + LW) : band;
      EDGE[i] = band !== bx || band !== by ? 1 : 0;
      // Farbe wächst von unten nach oben, entlang der fraktalen Bänder
      const fr = F[i] * 4 - Math.floor(F[i] * 4);
      const r = 0.5 * fr + 0.5 * (1 - y / LH) + 0.08 * hash2(x, y, job.seed);
      R[i] = Math.max(0, Math.min(LAYERS - 1, Math.floor((r / 1.08) * LAYERS)));
    }
  }
  job.EDGE = EDGE;
  job.R = R;
  job.horizons = null;
  job.L = null;
  job.done = true;
  return true;
}

function makeCanvas(w, h) {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  return c;
}

function renderWorldImages(wd) {
  const grey = makeCanvas(LW, LH);
  const gctx = grey.getContext('2d');
  const gimg = gctx.createImageData(LW, LH);
  const layers = [];
  const limgs = [];
  for (let k = 0; k < LAYERS; k++) {
    const c = makeCanvas(LW, LH);
    layers.push(c);
    limgs.push(c.getContext('2d').createImageData(LW, LH));
  }
  // Farbtabellen je Zone: 32 Stufen × (aussen, innen) × (normal, Kontur)
  const LUT = [];
  for (let z = 0; z < ZONES; z++) {
    const hue = zones[z] ? zones[z].hue : 0.5;
    const tab = [];
    for (let q = 0; q < 32; q++) {
      const f = q / 31;
      tab.push([
        rgb(hue - 0.07 + f * 0.14, 0.8, 0.06 + 0.6 * f),
        rgb(hue + (f - 0.5) * 0.1, 0.7, 0.3 + 0.6 * f),
        rgb(hue - 0.07 + f * 0.14, 0.5, Math.min(1, 0.3 + 0.6 * f)),
        rgb(hue + (f - 0.5) * 0.1, 0.45, 1),
      ]);
    }
    LUT.push(tab);
  }
  const zw = LW / ZONES;
  for (let y = 0; y < LH; y++) {
    for (let x = 0; x < LW; x++) {
      const idx = y * LW + x;
      const p = idx * 4;
      const f = wd.F[idx];
      const inside = wd.IN[idx];
      const edge = wd.EDGE[idx];
      let g;
      if (inside) g = edge ? 150 : 30 + 70 * f;
      else g = edge ? 70 : 6 + 40 * f;
      gimg.data[p] = g;
      gimg.data[p + 1] = g;
      gimg.data[p + 2] = g;
      gimg.data[p + 3] = 255;
      const z = Math.min(ZONES - 1, Math.floor(x / zw));
      const c = LUT[z][Math.round(f * 31)][(edge ? 2 : 0) + inside];
      const li = limgs[wd.R[idx]].data;
      li[p] = c[0];
      li[p + 1] = c[1];
      li[p + 2] = c[2];
      li[p + 3] = 255;
    }
  }
  gctx.putImageData(gimg, 0, 0);
  for (let k = 0; k < LAYERS; k++) layers[k].getContext('2d').putImageData(limgs[k], 0, 0);
  wd.grey = grey;
  wd.layers = layers;
  wd.palKey = palKey;
}

function makeRecipe(n) {
  const counts = [0, 0, 0];
  const order = [0, 1, 2].sort(() => Math.random() - 0.5);
  let colors = n <= 2 ? 1 + Math.floor(Math.random() * 2) : 2 + Math.floor(Math.random() * 2);
  colors = Math.min(colors, n);
  for (let i = 0; i < colors; i++) counts[order[i]] = 1;
  for (let i = colors; i < n; i++) counts[order[Math.floor(Math.random() * colors)]]++;
  return counts;
}

/** Neue Welt: Feld aus dem (ggf. schon vorgerechneten) Job, neue Rezepte, Bilder */
function buildWorld(level, job) {
  let fj = job && job.level === level ? job : null;
  if (!fj && world && world.level === level) fj = world; // Titelwelt wiederverwenden, nur neue Rezepte
  if (!fj) fj = createFieldJob(level);
  if (!fj.done) stepFieldJob(fj, 1e9);
  zones = [];
  const n = recipeSize(level);
  for (let z = 0; z < ZONES; z++) {
    const recipe = makeRecipe(n);
    let hue = 0;
    for (let k = 0; k < 3; k++) hue += recipe[k] * BASE_HUES[k];
    zones.push({
      i: z,
      cx: z * ZONE_W + ZONE_W / 2,
      third: Math.floor(z / 2),
      recipe,
      size: n,
      hue: clampHue(hue / n),
      c: 0,
      pending: 0,
      shine: 0,
      drainedBy: null,
    });
  }
  world = {
    level,
    kind: fj.kind,
    name: fj.name,
    F: fj.F,
    IN: fj.IN,
    EDGE: fj.EDGE,
    R: fj.R,
    done: true,
    seed: fj.seed,
    grey: null,
    layers: [],
    palKey: '',
  };
  renderWorldImages(world);
}

function ensureWorld() {
  if (!world || zones.length !== ZONES) buildWorld(STATE.level);
  else if (world.palKey !== palKey) renderWorldImages(world);
  if (stars.length === 0) {
    for (let i = 0; i < 60; i++) {
      stars.push({ x: Math.random() * W, y: HUD_H + 10 + Math.random() * (LAND_Y - HUD_H - 20), p: Math.random() * 6 });
    }
  }
}

function progress() {
  if (zones.length === 0) return 0;
  let s = 0;
  zones.forEach((z) => (s += z.c));
  return s / zones.length;
}

// ---------------------------------------------------------------------------------------------------------
// Kessel
// ---------------------------------------------------------------------------------------------------------

function makeCauldron(i) {
  return {
    i,
    cx: THIRD_X[i],
    zone: null,
    contents: [0, 0, 0],
    rainbows: 0,
    spoiled: false,
    ready: false,
    btn: null,
    slosh: 0,
  };
}

function cauldronTotal(c) {
  return c.contents[0] + c.contents[1] + c.contents[2] + c.rainbows;
}

function missing(c, k) {
  if (!c.zone) return 0;
  return Math.max(0, c.zone.recipe[k] - c.contents[k]);
}

function totalMissing(c) {
  return Math.max(0, (c.zone ? c.zone.size : 0) - cauldronTotal(c));
}

function chooseTarget(c) {
  const mine = zones.filter((z) => z.third === c.i);
  if (mine.length === 0) {
    c.zone = null;
    return;
  }
  mine.sort((a, b) => a.c + a.pending - (b.c + b.pending) + (Math.random() - 0.5) * 0.02);
  c.zone = mine[0];
}

function resetCauldron(c) {
  c.contents = [0, 0, 0];
  c.rainbows = 0;
  c.spoiled = false;
  c.ready = false;
  if (c.btn) c.btn.setValue(0);
  chooseTarget(c);
}

function ensureCauldrons() {
  if (cauldrons.length !== 3) {
    cauldrons = [makeCauldron(0), makeCauldron(1), makeCauldron(2)];
  }
  cauldrons.forEach((c) => {
    if (!c.zone || zones.indexOf(c.zone) < 0) chooseTarget(c);
  });
}

function mixHue(c) {
  const n = cauldronTotal(c);
  if (n === 0) return c.zone ? c.zone.hue : 0.5;
  let h = 0;
  for (let k = 0; k < 3; k++) h += c.contents[k] * BASE_HUES[k];
  h += c.rainbows * (c.zone ? c.zone.hue : 0.5);
  return clampHue(h / n);
}

function spoil(c, text) {
  if (c.spoiled) {
    addFloater(c.cx, CAUL_Y - 120, 'Blubb.', PAL.mud);
    return;
  }
  c.spoiled = true;
  c.ready = false;
  if (c.btn) c.btn.setValue(0);
  STATS.spoils++;
  STATE.score = Math.max(0, STATE.score - SETTINGS.spoilPenalty);
  STATE.shake = 14;
  addParticles(c.cx, CAUL_Y - 30, 30, PAL.mud, 260, 400);
  addFloater(c.cx, CAUL_Y - 130, text || 'MATSCH!', PAL.warn);
  playSound(soundError, 0.8);
}

function checkReady(c) {
  if (!c.spoiled && c.zone && totalMissing(c) === 0 && !c.ready) {
    c.ready = true;
    if (c.btn) c.btn.setValue(0);
    addFloater(c.cx, CAUL_Y - 140, 'GIESSEN!', zoneColor(c.zone));
    addParticles(c.cx, CAUL_Y - 40, 24, zoneColor(c.zone), 240, 0);
    playSound(soundReady, 0.7);
  }
}

function addToCauldron(c, kind) {
  c.slosh = 1;
  if (kind === 'rainbow') {
    STATS.rainbows++;
    STATE.score += SETTINGS.rainbowPoints;
    playSound(soundRainbow, 0.7);
    if (c.spoiled) {
      c.spoiled = false;
      c.contents = [0, 0, 0];
      c.rainbows = 0;
      if (c.btn) c.btn.setValue(0);
      chooseTarget(c);
      addFloater(c.cx, CAUL_Y - 130, 'Blitzblank!', PAL.good);
      return;
    }
    if (totalMissing(c) > 0) c.rainbows++;
    else addFloater(c.cx, CAUL_Y - 130, '+' + SETTINGS.rainbowPoints, PAL.good);
    checkReady(c);
    return;
  }
  if (kind === 'splat') {
    spoil(c, 'MATSCH-SPRITZER!');
    return;
  }
  if (c.spoiled) {
    addFloater(c.cx, CAUL_Y - 120, 'Blubb.', PAL.mud);
    return;
  }
  // Regenbogen-Tropfen zählen als Joker – erst echte Lücken füllen
  if (missing(c, kind) > 0 && totalMissing(c) > 0) {
    c.contents[kind]++;
    STATE.score += SETTINGS.catchPoints;
    checkReady(c);
  } else {
    spoil(c, 'Falsche Farbe – Matsch!');
  }
}

function triggerCauldron(c) {
  if (c.spoiled) {
    STATS.empties++;
    addParticles(c.cx, CAUL_Y, 26, PAL.mud, 300, 500);
    addFloater(c.cx, CAUL_Y - 130, 'Ausgekippt!', PAL.hud);
    playSound(soundPour, 0.5);
    resetCauldron(c);
    return;
  }
  if (!c.ready || !c.zone) return;
  const z = c.zone;
  const free = Math.max(0, 1 - z.c - z.pending);
  if (free < 0.1) {
    z.shine = SETTINGS.shineTime;
    addFloater(z.cx, LAND_Y - 20, 'Extra-Glanz!', zoneColor(z));
  }
  z.pending += Math.min(1, free);
  pours.push({ c: c.i, z, t: 0, hue: z.hue });
  const pts = SETTINGS.pourPointsPerDrop * z.size * STATE.level;
  STATE.score += pts;
  STATS.pours++;
  addFloater(c.cx, CAUL_Y - 140, '+' + pts, zoneColor(z));
  STATE.flash = 0.25;
  playSound(soundPour, 0.9);
  resetCauldron(c);
}

function ensureCauldronButton(c) {
  if (c.btn) return;
  c.btn = guiPixelFillButton({
    label: '',
    posX: c.cx,
    posY: CAUL_Y,
    radius: CAUL_R,
    speedUp: DIFFICULTY.pourFill,
    speedDown: 15,
    fullPercent: 55,
    activeValue: 85,
    counterReset: true,
    visible: false,
    onEnterActive: () => triggerCauldron(c),
  });
}

function updateCauldrons(grid, dt) {
  cauldrons.forEach((c, i) => {
    c.slosh = Math.max(0, c.slosh - dt * 1.5);
    if (keyEdge('Digit' + (i + 4))) triggerCauldron(c);
    if (c.spoiled || c.ready) {
      ensureCauldronButton(c);
      c.btn.handle(grid, dt);
    }
  });
  if (keyEdge('Digit7') && cauldrons[0]) addToCauldron(cauldrons[0], 'splat');
}

// ---------------------------------------------------------------------------------------------------------
// Tropfen
// ---------------------------------------------------------------------------------------------------------

function neededKinds() {
  const list = [];
  cauldrons.forEach((c) => {
    if (c.spoiled || c.ready) return;
    for (let k = 0; k < 3; k++) if (missing(c, k) > 0) list.push(k);
  });
  return list;
}

function pickDropKind() {
  if (STATE.level >= DIFFICULTY.rainbowFromLevel && Math.random() < DIFFICULTY.rainbowChance) return 'rainbow';
  if (STATE.level >= DIFFICULTY.splatFromLevel) {
    const chance = lvlValue(DIFFICULTY.splatChance, DIFFICULTY.splatChancePerLevel, DIFFICULTY.splatChanceMax, false);
    if (Math.random() < chance) return 'splat';
  }
  const need = neededKinds();
  if (need.length > 0 && Math.random() < DIFFICULTY.neededBias) return need[Math.floor(Math.random() * need.length)];
  return Math.floor(Math.random() * 3);
}

function spawnDrop(kind, x, y) {
  const speed = lvlValue(DIFFICULTY.dropSpeed, DIFFICULTY.dropSpeedPerLevel, DIFFICULTY.dropSpeedMax, false);
  const fromSide = x === undefined && Math.random() < 0.5;
  let px = x;
  let py = y;
  let ang;
  if (px === undefined) {
    if (fromSide) {
      const left = Math.random() < 0.5;
      px = left ? -50 : W + 50;
      py = BAND_TOP + Math.random() * (BAND_BOTTOM - BAND_TOP);
      ang = (left ? 0 : Math.PI) + (Math.random() - 0.5) * 0.8;
    } else {
      px = 120 + Math.random() * (W - 240);
      py = HUD_H - 40;
      ang = Math.PI / 2 + (Math.random() - 0.5) * 1.2;
    }
  } else {
    ang = Math.random() * Math.PI * 2;
  }
  const s = speed * (0.75 + Math.random() * 0.5);
  const d = {
    kind: kind === undefined ? pickDropKind() : kind,
    x: px,
    y: py,
    vx: Math.cos(ang) * s,
    vy: Math.sin(ang) * s,
    speed: s,
    life: DIFFICULTY.dropLife * (0.8 + Math.random() * 0.4),
    age: 0,
    phase: Math.random() * 10,
    btn: null,
    gone: false,
  };
  drops.push(d);
  return d;
}

function dropColor(d, v) {
  if (d.kind === 'splat') return v === undefined ? PAL.mud : PAL.mudDim;
  if (d.kind === 'rainbow') return col(0.25 + ((STATE.time * 0.3 + d.phase) % 1) * 0.5, 0.7, v === undefined ? 1 : v);
  return v === undefined ? PAL.base[d.kind] : PAL.baseDim[d.kind];
}

function fits(c, kind) {
  if (!c || c.spoiled || c.ready) return false;
  if (kind === 'rainbow') return totalMissing(c) > 0;
  return typeof kind === 'number' && missing(c, kind) > 0;
}

/**
 * Wohin fliegt ein gefangener Tropfen? In den Kessel des eigenen Drittels – passt er dort nicht, aber im
 * Nachbarkessel, hilft er dort aus (verzeihend an den Drittelgrenzen). Passt er nirgends: eigener Kessel → Matsch.
 */
function routeDrop(d) {
  const own = thirdOf(d.x);
  if (d.kind === 'splat' || fits(cauldrons[own], d.kind)) return own;
  if (d.kind === 'rainbow' && cauldrons[own] && cauldrons[own].spoiled) return own; // putzt den Matsch weg
  const left = own - 1;
  const right = own + 1;
  const xr = d.x - own * (W / 3); // Position im Drittel
  const order = xr < W / 6 ? [left, right] : [right, left];
  for (let i = 0; i < order.length; i++) {
    if (order[i] >= 0 && order[i] < 3 && fits(cauldrons[order[i]], d.kind)) return order[i];
  }
  return own;
}

function catchDrop(d, ciOverride) {
  if (d.gone) return;
  d.gone = true;
  const i = drops.indexOf(d);
  if (i >= 0) drops.splice(i, 1);
  const ci = ciOverride === undefined ? routeDrop(d) : ciOverride;
  const c = cauldrons[ci];
  if (!c) return;
  if (d.kind !== 'splat') STATS.drops++;
  flyers.push({ x0: d.x, y0: d.y, x: d.x, y: d.y, t: 0, kind: d.kind, c, color: dropColor(d) });
  addParticles(d.x, d.y, 14, dropColor(d), 200, 0);
  playSound(d.kind === 'splat' ? soundSteal : soundPickup, 0.55);
}

function ensureDropButton(d) {
  if (d.btn) return;
  d.btn = guiPixelFillButton({
    label: '',
    posX: d.x,
    posY: d.y,
    radius: SETTINGS.dropRadius,
    speedUp: DIFFICULTY.dropFill,
    speedDown: 60,
    fullPercent: 20,
    activeValue: 80,
    visible: false,
    onEnterActive: () => catchDrop(d),
  });
}

function updateDrops(grid, dt) {
  STATE.dropTimer -= dt;
  const maxDrops = lvlValue(DIFFICULTY.dropsMax, DIFFICULTY.dropsMaxPerLevel, DIFFICULTY.dropsMaxCap, false);
  if (STATE.dropTimer <= 0) {
    STATE.dropTimer = lvlValue(DIFFICULTY.dropInterval, DIFFICULTY.dropIntervalPerLevel, DIFFICULTY.dropIntervalMin, true);
    if (drops.length < maxDrops) spawnDrop();
  }
  for (let i = 0; i < 3; i++) {
    if (keyEdge('Digit' + (i + 1))) keyCatch(i);
  }
  // Tropfen weichen einander aus, damit sich die Fangscheiben nicht stapeln
  const minDist = SETTINGS.dropRadius * 2 + 16;
  for (let i = 0; i < drops.length; i++) {
    for (let j = i + 1; j < drops.length; j++) {
      const a = drops[i];
      const b = drops[j];
      const dx = b.x - a.x;
      const dy = b.y - a.y;
      const dd = Math.hypot(dx, dy);
      if (dd > 0.01 && dd < minDist) {
        const push = ((minDist - dd) / dd) * Math.min(1, dt * 4);
        a.x -= dx * push;
        a.y -= dy * push;
        b.x += dx * push;
        b.y += dy * push;
      }
    }
  }
  drops.slice().forEach((d) => {
    if (d.gone) return;
    d.age += dt;
    // sanftes Schweben: Richtung dreht langsam, Band-Ränder federn
    const wob = Math.sin(STATE.time * 1.3 + d.phase) * 0.6;
    const a = Math.atan2(d.vy, d.vx) + wob * dt;
    d.vx = Math.cos(a) * d.speed;
    d.vy = Math.sin(a) * d.speed;
    d.x += d.vx * dt;
    d.y += d.vy * dt;
    const fading = d.age > d.life;
    if (!fading) {
      if (d.y < BAND_TOP && d.vy < 0) d.vy = Math.abs(d.vy);
      if (d.y > BAND_BOTTOM && d.vy > 0) d.vy = -Math.abs(d.vy);
      if (d.age > 2) {
        if (d.x < 70 && d.vx < 0) d.vx = Math.abs(d.vx);
        if (d.x > W - 70 && d.vx > 0) d.vx = -Math.abs(d.vx);
      }
    }
    if (d.y > BAND_BOTTOM + 30) d.y = BAND_BOTTOM + 30; // nie in die Kesselreihe
    if (fading && (d.x < -80 || d.x > W + 80 || d.age > d.life + 4)) {
      d.gone = true;
      const k = drops.indexOf(d);
      if (k >= 0) drops.splice(k, 1);
      return;
    }
    if (d.x > -SETTINGS.dropRadius && d.x < W + SETTINGS.dropRadius && d.y > HUD_H) {
      ensureDropButton(d);
      d.btn.setX(d.x);
      d.btn.setY(d.y);
      d.btn.handle(grid, dt);
    }
  });
}

/** Tastatur-Test: passenden Tropfen fürs Kessel ci fangen – gibt es keinen, wird einer herbeigezaubert */
function keyCatch(ci) {
  const c = cauldrons[ci];
  if (!c || c.spoiled || c.ready) return;
  let best = null;
  drops.forEach((d) => {
    if (!d.gone && fits(c, d.kind) && (!best || Math.abs(d.x - c.cx) < Math.abs(best.x - c.cx))) best = d;
  });
  if (!best) {
    let kind = 0;
    for (let k = 0; k < 3; k++) if (missing(c, k) > 0) kind = k;
    best = spawnDrop(kind, c.cx, BAND_BOTTOM - 40);
  }
  catchDrop(best, ci);
}

function updateFlyers(dt) {
  flyers.slice().forEach((f) => {
    f.t += dt / SETTINGS.flyTime;
    const t = Math.min(1, f.t);
    const tx = f.c.cx;
    const ty = CAUL_Y - 30;
    f.x = f.x0 + (tx - f.x0) * t;
    f.y = f.y0 + (ty - f.y0) * t - Math.sin(t * Math.PI) * 120;
    if (particles.length < SETTINGS.maxParticles && Math.random() < 0.7) {
      particles.push({ x: f.x, y: f.y, vx: 0, vy: 0, g: 0, life: 0.4, max: 0.4, color: f.color, size: 6 });
    }
    if (f.t >= 1) {
      flyers.splice(flyers.indexOf(f), 1);
      addToCauldron(f.c, f.kind);
    }
  });
}

// ---------------------------------------------------------------------------------------------------------
// Klecks-Geister
// ---------------------------------------------------------------------------------------------------------

function spawnGhost(big) {
  const left = Math.random() < 0.5;
  const g = {
    big: !!big,
    r: big ? SETTINGS.bigGhostRadius : SETTINGS.ghostRadius,
    x: left ? -90 : W + 90,
    y: BAND_TOP + Math.random() * (BAND_BOTTOM - BAND_TOP),
    vx: 0,
    vy: 0,
    state: 'wander',
    zone: null,
    drop: null,
    tx: W / 2,
    ty: 300,
    carry: [],
    phase: Math.random() * 10,
    retarget: 0,
    btn: null,
    gone: false,
  };
  ghosts.push(g);
  retargetGhost(g);
  if (big) {
    addFloater(W / 2, 260, 'RIESENKLECKS!', PAL.warn);
    STATE.shake = 12;
  }
  return g;
}

function releaseZone(g) {
  if (g.zone && g.zone.drainedBy === g) g.zone.drainedBy = null;
  g.zone = null;
}

function retargetGhost(g) {
  releaseZone(g);
  g.drop = null;
  g.retarget = 6 + Math.random() * 4;
  const free = zones.filter((z) => z.c > 0.12 && z.shine <= 0 && !z.drainedBy);
  if (free.length > 0 && (Math.random() < 0.65 || drops.length === 0 || g.big)) {
    free.sort((a, b) => b.c - a.c);
    const z = free[Math.floor(Math.random() * Math.min(2, free.length))];
    g.state = 'drain';
    g.zone = z;
    z.drainedBy = g;
    g.tx = z.cx;
    g.ty = g.big ? BIG_HOVER_Y : GHOST_HOVER_Y;
    return;
  }
  const candidates = drops.filter((d) => !d.gone && d.x > 0 && d.x < W);
  if (candidates.length > 0 && !g.big) {
    let best = candidates[0];
    candidates.forEach((d) => {
      if (Math.hypot(d.x - g.x, d.y - g.y) < Math.hypot(best.x - g.x, best.y - g.y)) best = d;
    });
    g.state = 'hunt';
    g.drop = best;
    return;
  }
  g.state = 'wander';
  g.tx = 200 + Math.random() * (W - 400);
  g.ty = BAND_TOP + Math.random() * (BAND_BOTTOM - BAND_TOP);
}

function popGhost(g) {
  if (g.gone) return;
  g.gone = true;
  releaseZone(g);
  const i = ghosts.indexOf(g);
  if (i >= 0) ghosts.splice(i, 1);
  const pts = g.big ? SETTINGS.bigGhostPoints : SETTINGS.ghostPoints;
  STATE.score += pts * (g.big ? 1 : Math.max(1, Math.ceil(STATE.level / 2)));
  if (g.big) STATS.bigGhosts++;
  else STATS.ghosts++;
  addParticles(g.x, g.y, g.big ? 70 : 36, PAL.ghost, g.big ? 420 : 300, 300);
  addFloater(g.x, g.y - g.r - 10, g.big ? 'PLATSCH!! +' + pts : 'Plopp! +' + pts, PAL.ghostEye);
  STATE.shake = g.big ? 18 : 6;
  playSound(g.big ? soundBigPop : soundPop, 0.8);
  // geklaute Tropfen kommen zurück
  g.carry.forEach((kind, k) => {
    const d = spawnDrop(kind, g.x + (k - (g.carry.length - 1) / 2) * 90, Math.min(BAND_BOTTOM, g.y));
    d.age = 0;
  });
  if (g.carry.length > 0) addFloater(g.x, g.y + 40, 'Tropfen zurück!', PAL.good);
}

function ensureGhostButton(g) {
  if (g.btn) return;
  const fill = g.big
    ? DIFFICULTY.bigGhostFill
    : lvlValue(DIFFICULTY.ghostFill, DIFFICULTY.ghostFillPerLevel, DIFFICULTY.ghostFillMin, true);
  g.btn = guiPixelFillButton({
    label: '',
    posX: g.x,
    posY: g.y,
    radius: g.r,
    speedUp: fill,
    speedDown: 15,
    fullPercent: g.big ? 50 : 30,
    activeValue: 90,
    visible: false,
    onEnterActive: () => popGhost(g),
  });
}

function updateGhosts(grid, dt) {
  const maxGhosts = lvlValue(DIFFICULTY.ghostsMaxStart, DIFFICULTY.ghostsMaxPerLevel, DIFFICULTY.ghostsMaxCap, false);
  STATE.ghostTimer -= dt;
  if (STATE.ghostTimer <= 0) {
    STATE.ghostTimer = lvlValue(DIFFICULTY.ghostInterval, DIFFICULTY.ghostIntervalPerLevel, DIFFICULTY.ghostIntervalMin, true);
    const normal = ghosts.filter((g) => !g.big).length;
    if (normal < maxGhosts) spawnGhost(false);
  }
  if (
    STATE.level >= DIFFICULTY.bigGhostFromLevel &&
    !STATE.bigSpawned &&
    STATE.levelTime > STATE.levelTimeTotal * DIFFICULTY.bigGhostAt
  ) {
    STATE.bigSpawned = true;
    spawnGhost(true);
  }
  if (keyEdge('Digit0')) ghosts.slice().forEach((g) => popGhost(g));
  const speed = lvlValue(DIFFICULTY.ghostSpeed, DIFFICULTY.ghostSpeedPerLevel, DIFFICULTY.ghostSpeedMax, false);
  const drain = lvlValue(DIFFICULTY.drainRate, DIFFICULTY.drainPerLevel, DIFFICULTY.drainMax, false);
  ghosts.slice().forEach((g) => {
    if (g.gone) return;
    g.retarget -= dt;
    if (g.state === 'hunt') {
      if (!g.drop || g.drop.gone) retargetGhost(g);
      else {
        g.tx = g.drop.x;
        g.ty = g.drop.y;
      }
    }
    if (g.state === 'drain' && (!g.zone || g.zone.c <= 0.01 || g.zone.shine > 0)) retargetGhost(g);
    if (g.state === 'wander' && g.retarget <= 0) retargetGhost(g);
    const dx = g.tx - g.x;
    const dy = g.ty + Math.sin(STATE.time * 2 + g.phase) * 10 - g.y;
    const dist = Math.hypot(dx, dy);
    const sp = speed * (g.big ? 0.6 : 1) * (g.state === 'hunt' ? 1.2 : 1);
    if (dist > 2) {
      const step = Math.min(dist, sp * dt);
      g.x += (dx / dist) * step;
      g.y += (dy / dist) * step;
    }
    if (g.state === 'hunt' && g.drop && !g.drop.gone && Math.hypot(g.drop.x - g.x, g.drop.y - g.y) < 45) {
      const d = g.drop;
      d.gone = true;
      const k = drops.indexOf(d);
      if (k >= 0) drops.splice(k, 1);
      if (d.kind !== 'splat') g.carry.push(d.kind);
      STATS.stolen++;
      addFloater(g.x, g.y - g.r - 10, 'Geklaut!', PAL.warn);
      playSound(soundSteal, 0.6);
      retargetGhost(g);
    }
    if (g.state === 'drain' && g.zone && dist < 30) {
      const z = g.zone;
      z.c = Math.max(0, z.c - drain * (g.big ? 2 : 1) * dt);
      if (particles.length < SETTINGS.maxParticles && Math.random() < dt * 25) {
        const px = z.cx + (Math.random() - 0.5) * ZONE_W * 0.8;
        particles.push({
          x: px,
          y: LAND_Y + 20 + Math.random() * 80,
          vx: (g.x - px) * 1.2,
          vy: (g.y - LAND_Y - 60) * 1.2,
          g: 0,
          life: 0.7,
          max: 0.7,
          color: zoneColor(z, 0.6, 0.8),
          size: 5,
        });
      }
    }
    ensureGhostButton(g);
    g.btn.setX(g.x);
    g.btn.setY(g.y);
    g.btn.handle(grid, dt);
  });
}

// ---------------------------------------------------------------------------------------------------------
// Zonen, Güsse, Partikel
// ---------------------------------------------------------------------------------------------------------

function updateZones(dt) {
  zones.forEach((z) => {
    z.shine = Math.max(0, z.shine - dt);
    if (z.pending > 0) {
      const add = Math.min(z.pending, SETTINGS.pourRate * dt);
      z.pending -= add;
      z.c = Math.min(1, z.c + add);
    }
    if (z.c > 0.6 && particles.length < SETTINGS.maxParticles - 50 && Math.random() < dt * 3 * z.c) {
      particles.push({
        x: z.i * ZONE_W + Math.random() * ZONE_W,
        y: LAND_Y + 30 + Math.random() * (LAND_H - 40),
        vx: 0,
        vy: -20,
        g: 0,
        life: 1,
        max: 1,
        color: zoneColor(z, 0.3, 1),
        size: 4,
      });
    }
  });
}

function updatePours(dt) {
  pours.slice().forEach((p) => {
    p.t += dt;
    if (p.t >= SETTINGS.pourDuration) pours.splice(pours.indexOf(p), 1);
    else if (particles.length < SETTINGS.maxParticles && Math.random() < 0.8) {
      particles.push({
        x: p.z.cx + (Math.random() - 0.5) * 60,
        y: LAND_Y + 10,
        vx: (Math.random() - 0.5) * 260,
        vy: -60 - Math.random() * 120,
        g: 500,
        life: 0.8,
        max: 0.8,
        color: col(p.hue, 0.6, 1),
        size: 6,
      });
    }
  });
}

function updateParticles(dt) {
  particles.slice().forEach((p) => {
    p.life -= dt;
    if (p.life <= 0) {
      particles.splice(particles.indexOf(p), 1);
      return;
    }
    p.vy += p.g * dt;
    p.x += p.vx * dt;
    p.y += p.vy * dt;
  });
  floaters.slice().forEach((f) => {
    f.life -= dt;
    f.y -= 50 * dt;
    if (f.life <= 0) floaters.splice(floaters.indexOf(f), 1);
  });
}

// ---------------------------------------------------------------------------------------------------------
// Szenen-Steuerung
// ---------------------------------------------------------------------------------------------------------

function startLevel() {
  buildWorld(STATE.level, nextJob);
  nextJob = null;
  drops = [];
  ghosts = [];
  flyers = [];
  pours = [];
  cauldrons = [];
  ensureCauldrons();
  STATE.levelTimeTotal = lvlValue(DIFFICULTY.timeStart, DIFFICULTY.timePerLevel, DIFFICULTY.timeMax, false);
  STATE.clock = STATE.levelTimeTotal;
  STATE.levelTime = 0;
  STATE.goal = lvlValue(DIFFICULTY.goalStart, DIFFICULTY.goalPerLevel, DIFFICULTY.goalMax, false);
  STATE.dropTimer = 0.3;
  STATE.ghostTimer = DIFFICULTY.ghostFirst;
  STATE.bigSpawned = false;
  for (let i = 0; i < 4; i++) spawnDrop(undefined, 300 + i * 440, BAND_TOP + 60 + (i % 2) * 120);
}

function resetRun() {
  particles = [];
  floaters = [];
  STATE.level = 1;
  STATE.score = 0;
  STATE.shake = 0;
  STATE.flash = 0;
  STATE.newHighscore = false;
  STATE.endReason = '';
  Object.keys(STATS).forEach((k) => (STATS[k] = 0));
  againButton = null;
  startLevel();
}

function resetAll() {
  stopMusic();
  STATE.level = 1;
  world = null;
  nextJob = null;
  zones = [];
  cauldrons = [];
  drops = [];
  ghosts = [];
  flyers = [];
  pours = [];
  particles = [];
  floaters = [];
  startButton = null;
  againButton = null;
  keyEdge = createKeyEdge();
  setScene('title');
}

function startGame() {
  resetRun();
  setScene('game');
  playSound(soundJingle, 0.7);
  stopMusic();
  music = playSound(soundMusic, 0.3);
  if (music) music.loop = true;
}

function levelComplete() {
  const bonus = Math.max(0, Math.round(STATE.clock)) * SETTINGS.timeBonusPerSecond;
  STATE.score += bonus;
  STATS.worlds++;
  STATE.lastBonus = bonus;
  ghosts.slice().forEach((g) => popGhost(g));
  drops.forEach((d) => addParticles(d.x, d.y, 8, dropColor(d), 160, 0));
  drops = [];
  flyers = [];
  zones.forEach((z) => (z.pending = Math.max(0, 1 - z.c)));
  STATE.flash = 0.9;
  playSound(soundLevelUp, 0.8);
  STATE.level++;
  nextJob = createFieldJob(STATE.level);
  setScene('levelup');
}

function endGame(reason) {
  STATE.endReason = reason;
  stopMusic();
  playSound(soundGameOver, 0.8);
  highscore.addEntry({
    punkte: Math.round(STATE.score),
    level: STATE.level,
    welten: STATS.worlds,
    giessen: STATS.pours,
    geister: STATS.ghosts + STATS.bigGhosts,
  });
  STATE.newHighscore = highscore.lastEntryNewHighscore();
  againButton = null;
  nextJob = createFieldJob(1);
  setScene('gameover');
}

// ---------------------------------------------------------------------------------------------------------
// Zeichnen
// ---------------------------------------------------------------------------------------------------------

function renderBand(ctx) {
  ctx.save();
  // schwache Sterne im Aktionsband (sehr dunkel, damit die Kamera nichts sieht)
  ctx.fillStyle = PAL.star;
  stars.forEach((s) => {
    const a = 0.3 + 0.3 * Math.sin(STATE.time * 1.5 + s.p);
    ctx.globalAlpha = Math.max(0, a);
    ctx.fillRect(s.x, s.y, 3, 3);
  });
  ctx.globalAlpha = 1;
  // Drittel-Grenzen
  ctx.strokeStyle = PAL.sep;
  ctx.lineWidth = 3;
  ctx.setLineDash([14, 22]);
  for (let i = 1; i < 3; i++) {
    ctx.beginPath();
    ctx.moveTo((W / 3) * i, HUD_H + 20);
    ctx.lineTo((W / 3) * i, LAND_Y - 10);
    ctx.stroke();
  }
  ctx.setLineDash([]);
  ctx.restore();
}

function renderLandscape(ctx, alpha) {
  if (!world || !world.grey) return;
  ctx.save();
  ctx.globalAlpha = alpha === undefined ? 1 : alpha;
  ctx.drawImage(world.grey, 0, 0, LW, LH, 0, LAND_Y, W, LAND_H);
  const zw = LW / ZONES;
  zones.forEach((z) => {
    const amount = z.c * LAYERS;
    const n = Math.floor(amount);
    for (let k = 0; k <= n && k < LAYERS; k++) {
      const a = k < n ? 1 : amount - n;
      if (a <= 0.01) continue;
      ctx.globalAlpha = a * (alpha === undefined ? 1 : alpha);
      ctx.drawImage(world.layers[k], z.i * zw, 0, zw, LH, z.i * ZONE_W, LAND_Y, ZONE_W, LAND_H);
    }
  });
  ctx.globalAlpha = alpha === undefined ? 1 : alpha;
  // Kante zum Aktionsband + Zonengrenzen
  ctx.strokeStyle = PAL.hudDim;
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(0, LAND_Y);
  ctx.lineTo(W, LAND_Y);
  ctx.stroke();
  ctx.strokeStyle = PAL.sep;
  for (let i = 1; i < ZONES; i++) {
    ctx.beginPath();
    ctx.moveTo(i * ZONE_W, LAND_Y);
    ctx.lineTo(i * ZONE_W, H);
    ctx.stroke();
  }
  ctx.restore();
}

function renderZoneLabels(ctx) {
  zones.forEach((z) => {
    const y = LAND_Y + 48;
    ctx.save();
    ctx.fillStyle = '#000000';
    ctx.globalAlpha = 0.65;
    ctx.fillRect(z.cx - 110, y - 34, 220, 64);
    ctx.globalAlpha = 1;
    // Zielfarbe als Farbklecks (Anzeigebereich – darf leuchten)
    ctx.fillStyle = zoneColor(z);
    ctx.beginPath();
    ctx.arc(z.cx - 62, y - 2, 22, 0, Math.PI * 2);
    ctx.fill();
    if (z.shine > 0) {
      ctx.strokeStyle = zoneColor(z, 0.3, 1);
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(z.cx - 62, y - 2, 30 + Math.sin(STATE.time * 8) * 4, 0, Math.PI * 2);
      ctx.stroke();
    }
    ctx.restore();
    util.renderText({
      ctx,
      text: Math.round(z.c * 100) + '%',
      x: z.cx + 24,
      y: y + 14,
      fontSize: '40px',
      fillStyle: z.c >= 0.95 ? zoneColor(z, 0.4, 1) : PAL.hud,
    });
  });
}

function drawDropShape(ctx, x, y, size) {
  ctx.beginPath();
  ctx.moveTo(x, y - size * 1.25);
  ctx.bezierCurveTo(x + size * 0.35, y - size * 0.55, x + size, y - size * 0.1, x + size, y + size * 0.35);
  ctx.arc(x, y + size * 0.35, size, 0, Math.PI);
  ctx.bezierCurveTo(x - size, y - size * 0.1, x - size * 0.35, y - size * 0.55, x, y - size * 1.25);
  ctx.closePath();
}

function renderRing(ctx, x, y, r, value, color) {
  if (value <= 0.01) return;
  ctx.save();
  ctx.strokeStyle = color;
  ctx.lineWidth = 8;
  ctx.beginPath();
  ctx.arc(x, y, r, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * Math.min(1, value));
  ctx.stroke();
  ctx.restore();
}

function renderDrops(ctx) {
  const r = SETTINGS.dropRadius;
  drops.forEach((d) => {
    const fade = d.age > d.life ? Math.max(0, 1 - (d.age - d.life) / 3) : Math.min(1, d.age * 2);
    const bob = Math.sin(STATE.time * 3 + d.phase) * 4;
    ctx.save();
    ctx.globalAlpha = fade;
    ctx.fillStyle = '#000000';
    ctx.beginPath();
    ctx.arc(d.x, d.y, r + 4, 0, Math.PI * 2);
    ctx.fill();
    const c = dropColor(d);
    ctx.strokeStyle = dropColor(d, 0.5);
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(d.x, d.y, r, 0, Math.PI * 2);
    ctx.stroke();
    ctx.strokeStyle = c;
    ctx.lineWidth = 5;
    if (d.kind === 'splat') {
      // gezackter Matschklecks mit X-Augen
      ctx.beginPath();
      for (let i = 0; i <= 12; i++) {
        const a = (i / 12) * Math.PI * 2 + STATE.time * 0.5;
        const rr = (i % 2 ? 20 : 34) + Math.sin(STATE.time * 4 + i) * 3;
        const px = d.x + Math.cos(a) * rr;
        const py = d.y + bob + Math.sin(a) * rr;
        if (i === 0) ctx.moveTo(px, py);
        else ctx.lineTo(px, py);
      }
      ctx.stroke();
      ctx.lineWidth = 3;
      [-10, 10].forEach((ex) => {
        ctx.beginPath();
        ctx.moveTo(d.x + ex - 5, d.y + bob - 9);
        ctx.lineTo(d.x + ex + 5, d.y + bob + 1);
        ctx.moveTo(d.x + ex + 5, d.y + bob - 9);
        ctx.lineTo(d.x + ex - 5, d.y + bob + 1);
        ctx.stroke();
      });
    } else {
      drawDropShape(ctx, d.x, d.y + bob, 24);
      ctx.stroke();
      if (d.kind === 'rainbow') {
        for (let k = 0; k < 3; k++) {
          ctx.strokeStyle = col(0.3 + k * 0.2, 0.7, 1);
          ctx.lineWidth = 3;
          ctx.beginPath();
          ctx.arc(d.x, d.y, r - 10 - k * 6, STATE.time * 2 + k, STATE.time * 2 + k + Math.PI * 1.2);
          ctx.stroke();
        }
      } else {
        // Glanzlicht (nur Linie)
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.arc(d.x - 7, d.y + bob + 10, 9, Math.PI * 0.9, Math.PI * 1.4);
        ctx.stroke();
      }
    }
    if (d.btn) renderRing(ctx, d.x, d.y, r + 10, d.btn.getValue() / 80, c);
    ctx.restore();
  });
}

function renderGhosts(ctx) {
  ghosts.forEach((g) => {
    const t = STATE.time;
    const filled = g.btn ? g.btn.getValue() / 90 : 0;
    ctx.save();
    // Saugstrahl in die Zone
    if (g.state === 'drain' && g.zone && Math.hypot(g.tx - g.x, g.ty - g.y) < 40) {
      ctx.globalAlpha = 0.5 + 0.2 * Math.sin(t * 10);
      ctx.strokeStyle = zoneColor(g.zone, 0.4, 0.7);
      ctx.lineWidth = 6;
      ctx.setLineDash([10, 12]);
      ctx.lineDashOffset = t * 60;
      ctx.beginPath();
      ctx.moveTo(g.x - 25, LAND_Y + 70);
      ctx.lineTo(g.x, g.y + g.r * 0.6);
      ctx.lineTo(g.x + 25, LAND_Y + 70);
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.globalAlpha = 1;
    }
    const wob = 1 + filled * 0.25 * Math.sin(t * 30);
    ctx.fillStyle = '#000000';
    // weicher Klecks: Kurven durch die Mittelpunkte von 12 wabernden Randpunkten
    const pts = [];
    for (let i = 0; i < 12; i++) {
      const a = (i / 12) * Math.PI * 2;
      const rr = g.r * (1 + 0.12 * Math.sin(t * 3 + i * 1.7 + g.phase)) * wob;
      pts.push([g.x + Math.cos(a) * rr, g.y + Math.sin(a) * rr * 0.9]);
    }
    ctx.beginPath();
    ctx.moveTo((pts[11][0] + pts[0][0]) / 2, (pts[11][1] + pts[0][1]) / 2);
    for (let i = 0; i < 12; i++) {
      const n2 = pts[(i + 1) % 12];
      ctx.quadraticCurveTo(pts[i][0], pts[i][1], (pts[i][0] + n2[0]) / 2, (pts[i][1] + n2[1]) / 2);
    }
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = g.carry.length > 0 && typeof g.carry[0] === 'number' ? PAL.base[g.carry[0]] : PAL.ghost;
    ctx.lineWidth = g.big ? 7 : 5;
    ctx.stroke();
    // Augen + Mund (Linien)
    const look = g.state === 'drain' ? 1 : 0;
    ctx.strokeStyle = PAL.ghostEye;
    ctx.lineWidth = 3;
    const er = g.r * 0.18;
    [-1, 1].forEach((s) => {
      ctx.beginPath();
      ctx.arc(g.x + s * g.r * 0.32, g.y - g.r * 0.2, er, 0, Math.PI * 2);
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(g.x + s * g.r * 0.32, g.y - g.r * 0.2 + look * er * 0.5, er * 0.35, 0, Math.PI * 2);
      ctx.stroke();
    });
    ctx.beginPath();
    if (g.state === 'drain') ctx.arc(g.x, g.y + g.r * 0.3, g.r * 0.18, 0, Math.PI * 2);
    else ctx.arc(g.x, g.y + g.r * 0.15, g.r * 0.3, 0.15 * Math.PI, 0.85 * Math.PI);
    ctx.stroke();
    ctx.restore();
    renderRing(ctx, g.x, g.y, g.r + 14, filled, PAL.ghostEye);
  });
}

function renderCauldrons(ctx) {
  cauldrons.forEach((c) => {
    const x = c.cx;
    const y = CAUL_Y;
    const z = c.zone;
    const hue = mixHue(c);
    const pulse = c.ready ? 0.5 + 0.5 * Math.sin(STATE.time * 6) : 0;
    ctx.save();
    // Pfeil zur Zielzone
    if (z) {
      ctx.strokeStyle = zoneColor(z, 0.5, 0.55);
      ctx.lineWidth = 4;
      ctx.setLineDash([8, 10]);
      ctx.lineDashOffset = -STATE.time * 30;
      ctx.beginPath();
      ctx.moveTo(x + (z.cx < x ? -CAUL_R : CAUL_R) * 0.8, y + 40);
      ctx.quadraticCurveTo(z.cx, y + 30, z.cx, LAND_Y + 8);
      ctx.stroke();
      ctx.setLineDash([]);
    }
    ctx.fillStyle = '#000000';
    ctx.beginPath();
    ctx.arc(x, y, CAUL_R + 8, 0, Math.PI * 2);
    ctx.fill();
    // Topf-Kontur
    const rim = c.spoiled ? PAL.mud : c.ready ? col(hue, 0.7, 0.7 + 0.3 * pulse) : PAL.caul;
    ctx.strokeStyle = rim;
    ctx.lineWidth = c.ready ? 7 : 5;
    ctx.beginPath();
    ctx.ellipse(x, y - 34, CAUL_R * 0.85, 16, 0, 0, Math.PI * 2);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(x - CAUL_R * 0.85, y - 34);
    ctx.bezierCurveTo(x - CAUL_R * 0.95, y + 40, x - 40, y + 62, x, y + 62);
    ctx.bezierCurveTo(x + 40, y + 62, x + CAUL_R * 0.95, y + 40, x + CAUL_R * 0.85, y - 34);
    ctx.stroke();
    // Füllstand als Flüssigkeitslinie (keine Fläche)
    const total = cauldronTotal(c);
    const size = z ? z.size : 1;
    if (total > 0 || c.spoiled) {
      const lvl = c.spoiled ? 0.8 : total / size;
      const ly = y + 50 - lvl * 70;
      const half = CAUL_R * (0.55 + 0.3 * lvl);
      ctx.strokeStyle = c.spoiled ? PAL.mud : col(hue, 0.75, 1);
      ctx.lineWidth = 5;
      ctx.beginPath();
      for (let i = 0; i <= 16; i++) {
        const px = x - half + (i / 16) * half * 2;
        const py = ly + Math.sin(STATE.time * 5 + i * 0.9) * (3 + c.slosh * 10);
        if (i === 0) ctx.moveTo(px, py);
        else ctx.lineTo(px, py);
      }
      ctx.stroke();
      if (c.spoiled) {
        ctx.lineWidth = 3;
        for (let b = 0; b < 3; b++) {
          const bt = (STATE.time * 0.8 + b * 0.33) % 1;
          ctx.globalAlpha = 1 - bt;
          ctx.beginPath();
          ctx.arc(x - 25 + b * 25, ly - bt * 50, 6 + bt * 6, 0, Math.PI * 2);
          ctx.stroke();
        }
        ctx.globalAlpha = 1;
      }
    }
    ctx.restore();
    if (c.btn && (c.ready || c.spoiled)) {
      renderRing(ctx, x, y, CAUL_R + 18, c.btn.getValue() / 85, c.spoiled ? PAL.warn : col(hue, 0.6, 1));
    }
    // Rezept / Hinweis darüber
    if (c.spoiled) {
      util.renderText({ ctx, text: 'MATSCH! LEEREN', x, y: RECIPE_Y + 14, fontSize: '40px', fillStyle: PAL.warn });
    } else if (c.ready) {
      util.renderText({
        ctx,
        text: 'GIESSEN!',
        x,
        y: RECIPE_Y + 16,
        fontSize: 42 + Math.round(pulse * 8) + 'px',
        fillStyle: col(hue, 0.6, 1),
      });
    } else if (z) {
      const slots = [];
      for (let k = 0; k < 3; k++) for (let n = 0; n < z.recipe[k]; n++) slots.push(k);
      const have = [c.contents[0], c.contents[1], c.contents[2]];
      let jokers = c.rainbows;
      const gap = 44;
      const x0 = x - ((slots.length - 1) * gap) / 2;
      ctx.save();
      slots.forEach((k, i) => {
        const sx = x0 + i * gap;
        let full = false;
        if (have[k] > 0) {
          have[k]--;
          full = true;
        } else if (jokers > 0) {
          jokers--;
          full = true;
        }
        drawDropShape(ctx, sx, RECIPE_Y, 13);
        if (full) {
          ctx.fillStyle = PAL.base[k];
          ctx.fill();
        } else {
          ctx.strokeStyle = PAL.base[k];
          ctx.lineWidth = 3;
          ctx.stroke();
        }
      });
      ctx.restore();
    }
  });
}

function renderPours(ctx) {
  pours.forEach((p) => {
    const c = cauldrons[p.c];
    if (!c) return;
    const t = p.t / SETTINGS.pourDuration;
    const a = t < 0.15 ? t / 0.15 : t > 0.8 ? (1 - t) / 0.2 : 1;
    ctx.save();
    ctx.globalAlpha = Math.max(0, a);
    ctx.strokeStyle = col(p.hue, 0.7, 1);
    ctx.lineWidth = 16;
    ctx.lineCap = 'round';
    ctx.beginPath();
    const sx = c.cx + (p.z.cx < c.cx ? -60 : 60);
    ctx.moveTo(sx, CAUL_Y + 30);
    ctx.quadraticCurveTo(p.z.cx, CAUL_Y + 10, p.z.cx, LAND_Y + 60);
    ctx.stroke();
    ctx.restore();
  });
}

function renderFlyers(ctx) {
  ctx.save();
  flyers.forEach((f) => {
    ctx.strokeStyle = f.color;
    ctx.lineWidth = 5;
    drawDropShape(ctx, f.x, f.y, 18);
    ctx.stroke();
  });
  ctx.restore();
}

function renderParticles(ctx) {
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  particles.forEach((p) => {
    ctx.globalAlpha = Math.max(0, p.life / p.max);
    ctx.fillStyle = p.color;
    ctx.fillRect(p.x - p.size / 2, p.y - p.size / 2, p.size, p.size);
  });
  ctx.restore();
  floaters.forEach((f) => {
    ctx.save();
    ctx.globalAlpha = Math.max(0, Math.min(1, f.life));
    util.renderText({ ctx, text: f.text, x: f.x, y: f.y, fontSize: '44px', fillStyle: f.color });
    ctx.restore();
  });
}

function renderHud(ctx) {
  const y = 60;
  ctx.save();
  ctx.fillStyle = '#000000';
  ctx.fillRect(0, 0, W, HUD_H);
  ctx.restore();
  util.renderText({
    ctx,
    text: 'Level ' + STATE.level + ' · ' + (world ? world.name : ''),
    x: 30,
    y,
    fontSize: '42px',
    fillStyle: PAL.hud,
    align: 'left',
  });
  util.renderText({ ctx, text: Math.round(STATE.score) + ' Punkte', x: 1000, y, fontSize: '44px', fillStyle: PAL.hud });
  const clock = Math.max(0, Math.ceil(STATE.clock));
  const low = STATE.clock < 15;
  util.renderText({
    ctx,
    text: Math.floor(clock / 60) + ':' + String(clock % 60).padStart(2, '0'),
    x: 1380,
    y,
    fontSize: low && Math.sin(STATE.time * 8) > 0 ? '52px' : '44px',
    fillStyle: low ? PAL.warn : PAL.hud,
  });
  const p = progress();
  util.renderText({
    ctx,
    text: 'Farbe ' + Math.round(p * 100) + '% / ' + Math.round(STATE.goal * 100) + '%',
    x: W - 30,
    y,
    fontSize: '44px',
    fillStyle: p >= STATE.goal ? PAL.good : PAL.hud,
    align: 'right',
  });
  ctx.save();
  ctx.fillStyle = PAL.caulDim;
  ctx.fillRect(0, HUD_H - 8, W, 8);
  ctx.fillStyle = PAL.good;
  ctx.fillRect(0, HUD_H - 8, W * Math.min(1, p), 8);
  ctx.fillStyle = PAL.warn;
  ctx.fillRect(W * STATE.goal - 3, HUD_H - 18, 6, 18);
  ctx.restore();
}

function renderFlash(ctx, dt) {
  if (STATE.flash <= 0) return;
  ctx.save();
  ctx.globalAlpha = Math.min(0.35, STATE.flash * 0.4);
  ctx.fillStyle = PAL.flash;
  ctx.fillRect(0, 0, W, H);
  ctx.restore();
  STATE.flash -= dt;
}

function renderWorld(ctx, hideCauldrons) {
  ctx.save();
  if (STATE.shake > 0) {
    ctx.translate((Math.random() - 0.5) * STATE.shake, (Math.random() - 0.5) * STATE.shake);
  }
  renderBand(ctx);
  renderLandscape(ctx);
  renderZoneLabels(ctx);
  renderPours(ctx);
  if (!hideCauldrons) renderCauldrons(ctx);
  renderDrops(ctx);
  renderGhosts(ctx);
  renderFlyers(ctx);
  renderParticles(ctx);
  ctx.restore();
}

// ---------------------------------------------------------------------------------------------------------
// Szenen
// ---------------------------------------------------------------------------------------------------------

function handleTitle(grid, dt, ctx) {
  // die Welt färbt sich zur Demo langsam ein und wieder aus
  zones.forEach((z) => {
    z.c = Math.max(0, Math.min(1, 0.5 + 0.7 * Math.sin(STATE.time * 0.5 - z.i * 0.6)));
  });
  updateParticles(dt);
  if (Math.random() < dt * 6) {
    const z = zones[Math.floor(Math.random() * zones.length)];
    if (z && z.c > 0.4) addParticles(z.cx, LAND_Y + 60 + Math.random() * 200, 4, zoneColor(z, 0.4, 1), 80, 0);
  }
  renderBand(ctx);
  renderLandscape(ctx, 0.8);
  renderParticles(ctx);
  renderTextDropShadow({ ctx, text: 'Farbzauber', x: W / 2, y: 240, fontSize: '150px', fillStyle: PAL.title });
  util.renderText({
    ctx,
    text: 'Die Welt ist grau. Ihr habt die Farbe.',
    x: W / 2,
    y: 320,
    fontSize: '52px',
    fillStyle: PAL.sub,
  });
  util.renderText({
    ctx,
    text: 'Tropfen fangen · Kessel nach Rezept füllen · gemeinsam GIESSEN\nKlecks-Geister platzen lassen · Matsch-Spritzer NICHT fangen!',
    x: W / 2,
    y: 395,
    fontSize: '36px',
    lineHeight: 50,
    fillStyle: PAL.hudDim,
  });
  if (!startButton) {
    startButton = guiFillButton({
      label: 'START',
      posX: W / 2,
      posY: 580,
      radius: 100,
      edges: 7,
      speedUp: 45,
      speedDown: 20,
      activeValue: 85,
      lineWidth: 4,
      normalColor: PAL.start[0],
      growColor: PAL.start[1],
      activeColor: PAL.start[2],
      onEnterActive: () => startGame(),
    });
  }
  ctx.save();
  ctx.fillStyle = '#000000';
  ctx.beginPath();
  ctx.arc(W / 2, 580, 112, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
  startButton.handle(grid, dt);
  if (keyEdge('Space')) startGame();
  highscore.renderHighAndLowScores(ctx);
}

function handleGame(grid, dt, ctx) {
  STATE.clock -= dt;
  STATE.levelTime += dt;
  STATE.shake = Math.max(0, STATE.shake - dt * 40);
  updateDrops(grid, dt);
  updateGhosts(grid, dt);
  updateCauldrons(grid, dt);
  updateFlyers(dt);
  updatePours(dt);
  updateZones(dt);
  updateParticles(dt);
  if (keyEdge('KeyN')) zones.forEach((z) => (z.c = 1));
  if (keyEdge('KeyX')) STATE.clock = 0;
  renderWorld(ctx);
  renderHud(ctx);
  renderFlash(ctx, dt);
  if (STATE.scene !== 'game') return;
  const p = progress();
  if (p >= STATE.goal - 1e-6) levelComplete();
  else if (STATE.clock <= 0) endGame('Die Zeit ist um – die Welt bleibt ' + Math.round((1 - p) * 100) + ' % grau.');
}

function handleLevelUp(grid, dt, ctx) {
  if (nextJob) stepFieldJob(nextJob, 6);
  STATE.shake = Math.max(0, STATE.shake - dt * 40);
  updateZones(dt);
  updatePours(dt);
  updateParticles(dt);
  if (Math.random() < dt * 12) {
    addParticles(Math.random() * W, LAND_Y + Math.random() * 300, 10, col(0.25 + Math.random() * 0.5, 0.6, 1), 260, 200);
  }
  renderWorld(ctx, true);
  renderHud(ctx);
  renderFlash(ctx, dt);
  const s = 1 + Math.max(0, 0.4 - STATE.sceneTime) * 1.5;
  const next = WORLDS[(STATE.level - 1) % WORLDS.length].name;
  ctx.save();
  ctx.translate(W / 2, 300);
  ctx.scale(s, s);
  renderTextDropShadow({ ctx, text: 'LEVEL ' + STATE.level, x: 0, y: 0, fontSize: '150px', fillStyle: PAL.title });
  ctx.restore();
  util.renderText({ ctx, text: 'Welt gerettet! Nächste Welt: ' + next, x: W / 2, y: 395, fontSize: '50px', fillStyle: PAL.good });
  util.renderText({
    ctx,
    text: LEVEL_NEWS[STATE.level] || 'Mehr Geister, schnellere Tropfen!',
    x: W / 2,
    y: 465,
    fontSize: '46px',
    fillStyle: PAL.sub,
  });
  util.renderText({ ctx, text: 'Zeitbonus +' + STATE.lastBonus, x: W / 2, y: 545, fontSize: '44px', fillStyle: PAL.hud });
  if (STATE.sceneTime >= SETTINGS.levelUpDuration) {
    startLevel();
    setScene('game');
  }
}

function handleGameOver(grid, dt, ctx) {
  if (nextJob) stepFieldJob(nextJob, 6);
  updateParticles(dt);
  renderBand(ctx);
  renderLandscape(ctx, 0.7);
  renderParticles(ctx);
  renderTextDropShadow({ ctx, text: 'Grau gewinnt', x: W / 2, y: 200, fontSize: '130px', fillStyle: PAL.title });
  util.renderText({ ctx, text: STATE.endReason, x: W / 2, y: 280, fontSize: '42px', fillStyle: PAL.warn });
  util.renderText({
    ctx,
    text:
      Math.round(STATE.score) +
      ' Punkte' +
      (STATE.newHighscore ? '  – NEUER HIGHSCORE!' : '') +
      '\n' +
      'Level ' +
      STATE.level +
      ' · ' +
      STATS.worlds +
      ' Welt(en) gerettet · ' +
      STATS.pours +
      '× gegossen\n' +
      STATS.drops +
      ' Tropfen gefangen · ' +
      STATS.spoils +
      '× Matsch · ' +
      (STATS.ghosts + STATS.bigGhosts) +
      ' Geister geplatzt · ' +
      STATS.stolen +
      ' geklaut',
    x: W / 2,
    y: 350,
    fontSize: '38px',
    lineHeight: 56,
    fillStyle: PAL.sub,
  });
  highscore.renderHighAndLowScores(ctx);
  if (STATE.sceneTime > SETTINGS.againDelay) {
    if (!againButton) {
      againButton = guiFillButton({
        label: 'NOCHMAL',
        posX: W / 2,
        posY: 590,
        radius: 95,
        edges: 6,
        speedUp: 45,
        speedDown: 20,
        activeValue: 85,
        lineWidth: 4,
        normalColor: PAL.start[0],
        growColor: PAL.start[1],
        activeColor: PAL.start[2],
        onEnterActive: () => startGame(),
      });
    }
    ctx.save();
    ctx.fillStyle = '#000000';
    ctx.beginPath();
    ctx.arc(W / 2, 590, 106, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
    againButton.handle(grid, dt);
    if (keyEdge('Space')) startGame();
  } else {
    keyEdge('Space');
  }
}

// ---------------------------------------------------------------------------------------------------------
// Export
// ---------------------------------------------------------------------------------------------------------

export default {
  name: 'Farbzauber',
  description: `
  Die Fraktal-Welt ist grau geworden – ihr zaubert die Farbe zurück!

  Farbtropfen anleuchten = fangen. Sie fliegen in den Kessel eures Drittels.
  Füllt den Kessel genau nach Rezept, dann ALLE zusammen auf den Kessel: GIESSEN!
  Falsche Farbe oder Matsch-Spritzer = Matsch – dann erst gemeinsam leeren.

  Klecks-Geister saugen die Farbe weg und klauen Tropfen: anleuchten, bis sie platzen!
  Färbt die Welt ein, bevor die Zeit abläuft.
  `,
  image: 'media/img/gametitles/laser-mandelbrot-1-###4###.png',

  init: function () {
    resetAll();
  },

  handle: function (grid, elapsed) {
    const dt = Math.min(elapsed || 0, 0.1);
    const ctx = MasterCanvas.get2dContext();
    ensurePalette();
    ensureWorld();
    ensureCauldrons();
    STATE.time += dt;
    STATE.sceneTime += dt;

    switch (STATE.scene) {
      case 'title':
        handleTitle(grid, dt, ctx);
        break;
      case 'game':
        handleGame(grid, dt, ctx);
        break;
      case 'levelup':
        handleLevelUp(grid, dt, ctx);
        break;
      case 'gameover':
        handleGameOver(grid, dt, ctx);
        break;
      default:
        setScene('title');
    }
  },

  stop: function () {
    stopMusic();
  },
};
