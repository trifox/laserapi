/**
 * Leuchtlinge
 *
 * Seitenansicht einer Höhle aus Fraktalgestein. Aus einer Luke fallen 20–40 kleine Leuchtlinge und laufen
 * stur geradeaus, an Wänden drehen sie um. Ziel: mindestens X % von ihnen innerhalb des Zeitlimits ins
 * Spiralportal (Ausgang) bringen. Gefahren: Wände, Abgründe, Lavaseen und zu hohe Stürze.
 *
 * Regeln
 * - Werkzeugleiste unten (abgetrennter, dunkler Streifen): gui/voteGroup mit GRABEN / BAUEN / BLOCKEN / SCHIRM.
 *   Das Feld, das zuerst voll ist (Mehrheit der Laser), wird das aktive Werkzeug. Es bleibt aktiv, bis ein
 *   anderes Feld voll wird – also kein nervöses Hin- und Herspringen.
 * - Im Spielfeld wirkt der Laser mit dem aktiven Werkzeug (Eingabe über gui/paintLayer als Belichtungsschicht):
 *   GRABEN  – beleuchtetes Gestein wird über Zeit abgetragen (mehr Laser = mehr Fläche = schneller).
 *             Metallfelsen (ab Level 5) sind unzerstörbar und sprühen nur Funken.
 *   BAUEN   – wo geleuchtet wird, entsteht eine Lichtbrücke. Gebaute Zellen zerfallen langsam, wenn sie nicht
 *             mehr beleuchtet werden – Teamwork hält sie stabil.
 *   BLOCKEN – jeder Leuchtling ist zusätzlich ein gui/pixelFillButton (Handle-Wrapping). Voll gefüllt wird er
 *             zum Blocker: bleibt stehen, die anderen drehen an ihm um. Nach einiger Zeit (oder wenn nur noch
 *             Blocker übrig sind) dreht er um und läuft weg von der Gefahr, vor der er stand.
 *   SCHIRM  – ein angeleuchteter (gefüllter) Leuchtling bekommt einen Schirm und überlebt jeden Sturz.
 *   Bei anderem Werkzeug füllen sich die Leuchtling-Buttons nicht (Wrapper ruft handle nicht auf, Zähler fällt).
 * - Strafe für Wildleuchten: gui/calmMeter über dem Spielfeld. Wird zu wild herumgeleuchtet, geraten die
 *   Leuchtlinge in Panik (laufen schneller, Angstschweiß-Partikel, Bildschirm wackelt).
 * - Level: 1 nur Graben, 2 Abgrund (Bauen), 3 Lava (Blocker sinnvoll), 4 hoher Sturz (Schirm), 5 alles + Metall,
 *   danach Kombinationen, gespiegelte Höhlen, mehr und schnellere Leuchtlinge, knappere Zeit, höhere Quote.
 *   Zu wenig gerettet = ein Leben weg, das Level wird neu gewürfelt. Keine Leben mehr = Game Over.
 *
 * Tastatur (Test ohne Laser)
 * - Leertaste: Start / Neustart
 * - 1–4 (halten): Werkzeugfeld füllen (GRABEN, BAUEN, BLOCKEN, SCHIRM)
 * - Pfeiltasten: Test-Cursor bewegen, Enter (halten): Cursor wirkt wie ein Laser (Gelände + Leuchtlinge)
 * - P (halten): wildes Leuchten simulieren (Panik), N: nächstes Level
 *
 * Klassiker: Lemmings (DMA Design, Amiga 1991). Anders als dort bekommt hier nicht ein einzelner Lemming eine
 * Fähigkeit per Mausklick, sondern das ganze Publikum wählt per Mehrheitsabstimmung ein Werkzeug, das dann
 * auf das GELÄNDE wirkt (Graben/Bauen) bzw. auf jede Figur, die genug Licht abbekommt (Blocken/Schirm).
 *
 * Ein-Pixel-Netzspiel: funktioniert auch, wenn jeder Mitspieler genau einen Pixel steuert – Abstimmung und
 * Gelände arbeiten über Flächenanteile, ein Pixel allein gräbt eben nur ein kleines Loch.
 *
 * Bewusst KEINE Physik-Engine: die Lauflogik prüft nur wenige Punkte gegen ein eigenes Solid-Raster
 * (Boden unter den Füßen, Wand vor sich, kleine Stufe hochsteigen, Fallen mit linear wachsender
 * Geschwindigkeit). Diese simple Raster-Lauflogik ist ein Kandidat für einen späteren gemeinsamen
 * Gelände-Helfer der Plattform.
 *
 * Idee für später (Teammodus): zwei Luken, zwei Ausgänge, linke vs. rechte Saalhälfte mit je eigener
 * Werkzeugleiste (zoneSplit) – wer rettet mehr?
 */

import util, { getRgbSpreadHex } from '../util.js';
var laserConfig = require('../LaserApiConfig.js').default;
var MasterCanvas = require('../MasterCanvas').default;
var guiFillButton = require('./gui/fillButton-ai2').default;
var guiPixelFillButton = require('./gui/pixelFillButton').default;
var guiPaintLayer = require('./gui/paintLayer').default;
var guiVoteGroup = require('./gui/voteGroup').default;
var guiCalmMeter = require('./gui/calmMeter').default;
var createHighscore = require('../util/highscore').default;
import soundSave from '../../../public/media/369952__mischy__plop-1.wav';
import soundSplat from '../../../public/media/414346__bykgames__explosion-far.wav';
import soundLava from '../../../public/media/485066__javierserrat__object-falls-into-the-water.wav';
import soundLevel from '../../../public/media/517267__foolboymedia__cinematic-stomp.wav';
import soundTool from '../../../public/media/72218__benboncan__sonar.wav';

// Highscore einmal pro Modul (überlebt Spielwechsel)
var highscore = createHighscore('Leuchtlinge', 'punkte');

// ---------------------------------------------------------------------------------------------------------
// Einstellungen
// ---------------------------------------------------------------------------------------------------------

const SETTINGS = {
  width: 1920,
  height: 1080,
  cellSize: 16, // Gelände-Raster in px (unabhängig vom Laser-Grid)
  cols: 120, // 120 * 16 = 1920
  rows: 53, // 53 * 16 = 848
  fieldY: 80, // Spielfeld beginnt unter der HUD-Leiste
  toolbarY: 930, // Werkzeugleiste (dunkler Streifen) bis 1080
  // Leuchtling-Geometrie
  bodyR: 26, // Körperradius (gezeichnet)
  bodyH: 50, // Höhe Fuß bis Kopf für Kollision
  halfW: 15, // halbe Kollisionsbreite
  hitR: 58, // Füllbereich des pixelFillButtons (>= 50)
  maxStepCells: 2, // so viele Zellen steigt ein Leuchtling hoch bzw. runter, ohne zu fallen
  // Fallen
  fallAcc: 900, // px/s² (linear wachsende Fallgeschwindigkeit)
  fallMax: 520, // px/s
  umbrellaFall: 110, // px/s mit Schirm
  safeFall: 200, // px – tiefer = Splat (ohne Schirm)
  // Belichtungsschicht (paintLayer)
  lightUp: 3.5, // Belichtung pro Sekunde bei vollem Licht
  lightDown: 2.5, // Abbau pro Sekunde ohne Licht
  lightBrush: 26, // Pinselradius px
  // Partikel
  maxParticles: 400,
  maxTexts: 30,
  fireflies: 32,
  lives: 3,
  intermissionTime: 2.6,
  gameOverLockTime: 2,
  cursorSpeed: 700,
  cursorRadius: 44,
};

const DIFFICULTY = {
  walkersStart: 20,
  walkersPerLevel: 3,
  walkersMax: 40,
  spawnIntervalStart: 1.7,
  spawnIntervalFactor: 0.93,
  spawnIntervalMin: 0.85,
  walkSpeedStart: 55, // px/s
  walkSpeedPerLevel: 5,
  walkSpeedMax: 95,
  timeLimitStart: 150, // s
  timeLimitPerLevel: -7,
  timeLimitMin: 90,
  requiredStart: 0.5, // Anteil, der gerettet werden muss
  requiredPerLevel: 0.04,
  requiredMax: 0.8,
  digRate: 1.5, // Gestein pro Sekunde bei voller Belichtung (1 = Zelle weg)
  buildRate: 2.4, // Aufbau pro Sekunde bei voller Belichtung
  builtRefresh: 2, // gebaute Zellen laden sich unter Licht so schnell wieder auf
  builtDecayStart: 0.07, // Zerfall pro Sekunde ohne Licht (1 = ganze Zelle)
  builtDecayPerLevel: 0.01,
  builtDecayMax: 0.16,
  blockDuration: 25, // s, danach läuft der Blocker weiter
  blockerFill: { speedUp: 70, speedDown: 35, fullPercent: 20, activeValue: 90 },
  metalFromLevel: 5,
  mirrorFromLevel: 6,
  gapGrowEvery: 3, // Abgrund wird alle n Level eine Zelle breiter
  panicFrom: 0.35, // calmMeter-Chaos, ab dem Panik einsetzt
  panicSpeedBoost: 0.9, // +90 % Tempo bei voller Panik
  // Punkte
  pointsSaveBase: 50,
  pointsSavePerLevel: 10,
  timeBonusPerSecond: 2,
  perfectBonus: 250,
};

const CS = SETTINGS.cellSize;
const COLS = SETTINGS.cols;
const ROWS = SETTINGS.rows;
const FIELD = { x: 0, y: SETTINGS.fieldY, w: COLS * CS, h: ROWS * CS };

// Zelltypen im Solid-Raster
const T_EMPTY = 0;
const T_ROCK = 1;
const T_METAL = 2;
const T_BUILT = 3;
const T_LAVA = 4;
const T_WALL = 9; // virtuell: ausserhalb links/rechts/oben

// Werkzeuge
const TOOL_DIG = 0;
const TOOL_BUILD = 1;
const TOOL_BLOCK = 2;
const TOOL_UMBRELLA = 3;
const TOOLS = [
  { name: 'GRABEN', short: 'Gestein abtragen', hue: 0.42 },
  { name: 'BAUEN', short: 'Lichtbrücke', hue: 0.55 },
  { name: 'BLOCKEN', short: 'Leuchtling stoppt', hue: 0.66 },
  { name: 'SCHIRM', short: 'sanft landen', hue: 0.3 },
];
const TOOL_X = [110, 590, 1070, 1550];
const TOOL_Y = 1005;

const LEVEL_HINTS = [
  'Eine Wand versperrt den Weg – GRABEN!',
  'Ein Abgrund! Baut eine Lichtbrücke – BAUEN!',
  'Lava! Haltet sie auf – BLOCKEN (oder bauen)!',
  'Tiefer Sturz! Spannt Schirme auf – SCHIRM!',
  'Alles zusammen – und Metall lässt sich nicht graben!',
];

const JULIA_SEEDS = [
  [-0.8, 0.156],
  [-0.4, 0.6],
  [0.285, 0.01],
  [-0.70176, -0.3842],
  [-0.835, -0.2321],
  [0.355, 0.355],
];

// ---------------------------------------------------------------------------------------------------------
// Modul-Zustand
// ---------------------------------------------------------------------------------------------------------

var gameState = 'start';
var gameTime = 0;
var level = 1;
var score = 0;
var lives = SETTINGS.lives;
var STATS = {};
var PAL = {};
var params = {};

// Gelände
var terrain = new Uint8Array(COLS * ROWS);
var work = new Float32Array(COLS * ROWS); // Fels: Rest-Härte, Leer: Bau-Ladung, Brücke: Stabilität
var shade = new Uint8Array(COLS * ROWS); // Fraktal-Schattierung des Gesteins
var occ = new Uint8Array(COLS * ROWS); // von Leuchtlingen belegte Zellen (dort wird nicht gebaut)
var occList = [];
var pools = []; // Lavaseen {c0, c1, r0, r1}
var hatch = { x: 0, y: 0, open: 0 };
var exitPortal = { x: 0, y: 0 };
var startDir = 1;
var terrainCanvas = null;
var terrainCtx = null;
var dirty = null; // {c0, r0, c1, r1}
var dirtyTimer = 0;
var builtList = [];
var digList = [];
var chargeList = [];
var metalSparkTimer = 0;
var rng = Math.random;
var noiseTable = new Float32Array(512);

// Leuchtlinge
var walkers = [];
var spawned = 0;
var spawnTimer = 0;
var savedCount = 0;
var lostCount = 0;
var timeLeft = 0;
var panic = 0;
var endTimer = -1;
var endSuccess = false;
var goalAnnounced = false;

// GUI
var layer = null;
var vote = null;
var calm = null;
var startButton = null;
var gameOverButton = null;
var activeTool = TOOL_DIG;
var toolFlash = 0;

// Effekte
var particles = [];
var texts = [];
var fireflies = [];
var parade = [];
var shake = 0;
var flash = 0;
var interTimer = 0;
var interTitle = '';
var interSub = '';
var gameOverTime = 0;
var cursor = { x: 960, y: 500, visible: 0 };
var previousKeys = {};
var activeSounds = [];

// ---------------------------------------------------------------------------------------------------------
// Hilfen
// ---------------------------------------------------------------------------------------------------------

/** Farbe aus der Laserfarbe abgeleitet; Hue immer im Komplementärbereich 0.25..0.75 */
function col(h, s, v) {
  const hue = Math.max(0.25, Math.min(0.75, h));
  return getRgbSpreadHex(laserConfig.testColor, hue, s, v);
}

function buildPalette() {
  PAL = {
    rockShades: [],
    rockEdge: col(0.5, 0.55, 0.78),
    rockEdgeInner: col(0.47, 0.5, 0.3),
    metalFill: col(0.36, 0.25, 0.16),
    metalEdge: col(0.36, 0.35, 0.95),
    metalLine: col(0.36, 0.3, 0.4),
    builtFill: col(0.58, 0.8, 0.28),
    builtEdge: col(0.58, 0.6, 0.95),
    charge: col(0.58, 0.6, 0.6),
    dig: col(0.32, 0.9, 0.55),
    lava: col(0.28, 1, 0.95),
    lavaDark: col(0.27, 1, 0.32),
    lavaGlow: col(0.3, 1, 0.6),
    hud: col(0.5, 0.45, 0.95),
    hudDim: col(0.5, 0.4, 0.55),
    hudWarn: col(0.3, 0.9, 1),
    good: col(0.42, 0.7, 1),
    bad: col(0.27, 0.9, 1),
    toolbarBg: col(0.55, 0.6, 0.07),
    toolbarLine: col(0.55, 0.5, 0.45),
    hudBg: col(0.55, 0.6, 0.06),
    portal: col(0.62, 0.7, 0.85),
    portalB: col(0.72, 0.6, 0.7),
    hatch: col(0.45, 0.4, 0.7),
    hatchFill: col(0.45, 0.4, 0.12),
    firefly: col(0.4, 0.8, 0.6),
    title: [],
    button: [col(0.45, 0.7, 0.75), col(0.55, 0.8, 0.95), col(0.65, 0.9, 1)],
    tool: [],
    toolDim: [],
  };
  for (let s = 0; s < 6; s++) {
    PAL.rockShades.push(col(0.5 + s * 0.035, 0.5, s === 0 ? 0.05 : 0.07 + s * 0.022));
  }
  for (let k = 0; k < 11; k++) PAL.title.push(col(0.35 + k * 0.035, 0.75, 1));
  TOOLS.forEach((t) => {
    PAL.tool.push(col(t.hue, 0.75, 1));
    PAL.toolDim.push(col(t.hue, 0.6, 0.45));
  });
}

function resetStats() {
  STATS = {
    saved: 0,
    lost: 0,
    splat: 0,
    burned: 0,
    abyss: 0,
    dug: 0,
    built: 0,
    blockers: 0,
    umbrellas: 0,
    panics: 0,
    levelsDone: 0,
    playTime: 0,
  };
}

function keyPressedOnce(code) {
  const down = !!laserConfig.pressedKeys[code];
  const was = !!previousKeys[code];
  previousKeys[code] = down;
  return down && !was;
}

function isKey(code) {
  return !!laserConfig.pressedKeys[code];
}

function playSound(src, volume) {
  try {
    const a = new Audio(src);
    a.volume = volume === undefined ? 0.6 : volume;
    a.play();
    activeSounds.push(a);
    if (activeSounds.length > 12) activeSounds.shift();
  } catch (e) {
    // kein Audio – egal
  }
}

function addParticle(p) {
  if (particles.length >= SETTINGS.maxParticles) return;
  particles.push(p);
}

function burst(x, y, n, color, speed, life, size, gravity) {
  for (let k = 0; k < n; k++) {
    const a = Math.random() * Math.PI * 2;
    const v = speed * (0.3 + Math.random() * 0.7);
    addParticle({
      x,
      y,
      vx: Math.cos(a) * v,
      vy: Math.sin(a) * v,
      life: life * (0.6 + Math.random() * 0.4),
      max: life,
      color,
      size: size * (0.6 + Math.random() * 0.6),
      g: gravity || 0,
    });
  }
}

function addText(x, y, text, color, size) {
  if (texts.length >= SETTINGS.maxTexts) texts.shift();
  texts.push({ x, y, text, color, size: size || 44, life: 1.4, max: 1.4 });
}

// ---------------------------------------------------------------------------------------------------------
// Rauschen / Zufall (pro Level geseedet)
// ---------------------------------------------------------------------------------------------------------

function mulberry32(a) {
  return function () {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function noise1(x) {
  const i = Math.floor(x);
  const f = x - i;
  const a = noiseTable[i & 511];
  const b = noiseTable[(i + 1) & 511];
  const u = f * f * (3 - 2 * f);
  return a + (b - a) * u;
}

/** fraktales Rauschen (3 Oktaven), etwa -1..1 */
function fbm(x) {
  return noise1(x) * 0.6 + noise1(x * 2.1 + 17) * 0.28 + noise1(x * 4.3 + 41) * 0.12;
}

// ---------------------------------------------------------------------------------------------------------
// Solid-Raster
// ---------------------------------------------------------------------------------------------------------

function cellTypeAt(px, py) {
  const c = Math.floor((px - FIELD.x) / CS);
  const r = Math.floor((py - FIELD.y) / CS);
  if (c < 0 || c >= COLS || r < 0) return T_WALL;
  if (r >= ROWS) return T_EMPTY;
  return terrain[c + r * COLS];
}

function isSolid(px, py) {
  const t = cellTypeAt(px, py);
  return t === T_ROCK || t === T_METAL || t === T_BUILT || t === T_WALL;
}

/** für die Kontur: Fels/Metall gilt als fest, ausserhalb seitlich/oben ebenfalls */
function isRockCell(c, r) {
  if (c < 0 || c >= COLS || r < 0) return true;
  if (r >= ROWS) return false;
  const t = terrain[c + r * COLS];
  return t === T_ROCK || t === T_METAL;
}

function setCell(c, r, t) {
  if (c < 0 || c >= COLS || r < 0 || r >= ROWS) return;
  const i = c + r * COLS;
  terrain[i] = t;
  work[i] = t === T_ROCK || t === T_BUILT ? 1 : 0;
}

function markDirty(c, r) {
  if (!dirty) {
    dirty = { c0: c, r0: r, c1: c, r1: r };
  } else {
    if (c < dirty.c0) dirty.c0 = c;
    if (c > dirty.c1) dirty.c1 = c;
    if (r < dirty.r0) dirty.r0 = r;
    if (r > dirty.r1) dirty.r1 = r;
  }
}

// ---------------------------------------------------------------------------------------------------------
// Levelbau (prozedural aus 5 Grundformen + Zufallsvariation)
// ---------------------------------------------------------------------------------------------------------

function slab(c0, c1, top, bottom, rough, off) {
  for (let c = Math.max(0, c0); c <= Math.min(COLS - 1, c1); c++) {
    const t = top + Math.round(fbm(c * 0.11 + off) * rough);
    for (let r = Math.max(0, t); r <= Math.min(ROWS - 1, bottom); r++) setCell(c, r, T_ROCK);
  }
}

function pillar(c0, c1, r0, r1, rough, off) {
  for (let r = Math.max(0, r0); r <= Math.min(ROWS - 1, r1); r++) {
    const l = c0 + Math.round(fbm(r * 0.13 + off) * rough);
    const rr = c1 + Math.round(fbm(r * 0.13 + off + 33) * rough);
    for (let c = Math.max(0, l); c <= Math.min(COLS - 1, rr); c++) setCell(c, r, T_ROCK);
  }
}

/** Metall nur dort, wo schon Fels ist (elliptischer Brocken mit Rauschrand) */
function metalBlob(c0, c1, r0, r1) {
  const cx = (c0 + c1) / 2;
  const cy = (r0 + r1) / 2;
  const rx = Math.max(1, (c1 - c0) / 2);
  const ry = Math.max(1, (r1 - r0) / 2);
  for (let r = r0; r <= r1; r++) {
    for (let c = c0; c <= c1; c++) {
      if (c < 0 || c >= COLS || r < 0 || r >= ROWS) continue;
      const dx = (c - cx) / rx;
      const dy = (r - cy) / ry;
      if (dx * dx + dy * dy <= 1 + fbm(c * 0.4 + r * 0.7) * 0.35 && terrain[c + r * COLS] === T_ROCK) {
        setCell(c, r, T_METAL);
      }
    }
  }
}

/** Lavasee in den Boden einsenken: darüber frei, darin Lava */
function lavaPool(c0, c1, surface, depth) {
  for (let c = c0; c <= c1; c++) {
    for (let r = surface - 4; r < surface; r++) setCell(c, r, T_EMPTY);
    for (let r = surface; r < surface + depth; r++) setCell(c, r, T_LAVA);
    for (let r = surface + depth; r < surface + depth + 2; r++) setCell(c, r, T_ROCK);
  }
  pools.push({ c0, c1, r0: surface, r1: surface + depth - 1 });
}

function caveFrame() {
  for (let c = 0; c < COLS; c++) {
    const th = 2 + Math.round((fbm(c * 0.07 + 5) + 1) * 1.5);
    for (let r = 0; r < th; r++) setCell(c, r, T_ROCK);
  }
  for (let r = 0; r < ROWS; r++) {
    const l = 1 + Math.round((fbm(r * 0.09 + 50) + 1) * 1.4);
    const rr = 1 + Math.round((fbm(r * 0.09 + 90) + 1) * 1.4);
    for (let c = 0; c < l; c++) setCell(c, r, T_ROCK);
    for (let c = COLS - rr; c < COLS; c++) setCell(c, r, T_ROCK);
  }
}

function buildLevel(n) { 
  rng = mulberry32((n * 7919 + Math.floor(Math.random() * 1e6)) >>> 0);
  for (let k = 0; k < noiseTable.length; k++) noiseTable[k] = rng() * 2 - 1;
  terrain.fill(T_EMPTY);
  work.fill(0);
  pools = [];
  const j = (a) => Math.round((rng() * 2 - 1) * a);
  const metal = n >= DIFFICULTY.metalFromLevel;
  const L = { hatchC: 14 + j(3), hatchR: 29, exitC: 104 + j(4), dir: 1 };

  caveFrame();
  const tpl = (n - 1) % 5;

  if (tpl === 0) {
    // GRABEN: Wand von der Decke bis zum Boden
    const floorTop = 38 + j(1);
    slab(0, COLS - 1, floorTop, ROWS - 1, 1.5, 3);
    const wallC = 56 + j(6);
    pillar(wallC, wallC + 7 + j(1), 0, floorTop + 1, 1.5, 7);
    if (metal) metalBlob(wallC - 2, wallC + 10, 3, floorTop - 13);
    if (n > 5) {
      const w2 = 84 + j(3);
      pillar(w2, w2 + 4, floorTop - 14, floorTop + 1, 1, 13);
      if (metal) metalBlob(w2 - 1, w2 + 6, floorTop - 15, floorTop - 9);
    }
    L.hatchR = floorTop - 9;
  } else if (tpl === 1) {
    // BAUEN: Abgrund in der Mitte
    const floorTop = 38 + j(1);
    const gapC = 50 + j(4);
    const gapW = 14 + Math.min(8, Math.floor(n / DIFFICULTY.gapGrowEvery));
    slab(0, gapC - 1, floorTop, ROWS - 1, 1.2, 3);
    slab(gapC + gapW, COLS - 1, floorTop + j(1), ROWS - 1, 1.2, 9);
    if (n > 5) {
      const w = gapC + gapW + 12 + j(3);
      pillar(w, w + 4, floorTop - 7, floorTop + 1, 1, 21);
    }
    L.hatchR = floorTop - 9;
  } else if (tpl === 2) {
    // LAVA: Ausgang links der Luke, rechts Lava – Blocker drehen sie um
    const floorTop = 38 + j(1);
    slab(0, COLS - 1, floorTop, ROWS - 1, 1.0, 5);
    L.hatchC = 44 + j(3);
    L.exitC = 12 + j(3);
    const p0 = L.hatchC + 14 + j(2);
    lavaPool(p0, p0 + 16 + j(2), floorTop + 1, 5);
    if (n > 7) lavaPool(96 + j(3), 108, floorTop + 1, 4);
    // Metall im Boden unter der Luke: dort kann man sich nicht nach unten durchgraben
    if (metal) metalBlob(L.hatchC - 6, L.hatchC + 6, floorTop + 2, floorTop + 7);
    L.hatchR = floorTop - 9;
  } else if (tpl === 3) {
    // SCHIRM: hoher Sims, tiefer Sturz
    const ledgeTop = 16 + j(1);
    const ledgeEnd = 40 + j(4);
    slab(0, ledgeEnd, ledgeTop, ledgeTop + 4, 1.0, 3);
    const floorTop = 46;
    slab(0, COLS - 1, floorTop, ROWS - 1, 1.0, 11);
    if (n > 8) lavaPool(70 + j(4), 80 + j(2), floorTop + 1, 4);
    if (metal) metalBlob(ledgeEnd - 6, ledgeEnd + 1, ledgeTop + 1, ledgeTop + 5);
    L.hatchC = 12 + j(2);
    L.hatchR = ledgeTop - 8;
  } else {
    // KOMBI: Abgrund, Wand mit Metallkern, kleiner Lavasee
    const floorTop = 37 + j(1);
    const gapC = 42 + j(2);
    const gapW = 11 + Math.min(6, Math.floor(n / 4));
    slab(0, gapC - 1, floorTop, ROWS - 1, 1.2, 3);
    slab(gapC + gapW, COLS - 1, floorTop + 1, ROWS - 1, 1.2, 9);
    const wallC = 74 + j(3);
    pillar(wallC, wallC + 6, 0, floorTop + 2, 1.2, 17);
    metalBlob(wallC - 2, wallC + 8, 3, floorTop - 13);
    const p0 = 92 + j(2);
    lavaPool(p0, p0 + 5 + Math.min(4, Math.floor(n / 5)), floorTop + 2, 4);
    L.hatchC = 12 + j(2);
    L.exitC = 112 + j(2);
    L.hatchR = floorTop - 9;
  }

  // ab Level 6 manchmal gespiegelt
  if (n >= DIFFICULTY.mirrorFromLevel && rng() < 0.5) {
    for (let r = 0; r < ROWS; r++) {
      for (let c = 0; c < COLS / 2; c++) {
        const a = c + r * COLS;
        const b = COLS - 1 - c + r * COLS;
        const tt = terrain[a];
        terrain[a] = terrain[b];
        terrain[b] = tt;
        const ww = work[a];
        work[a] = work[b];
        work[b] = ww;
      }
    }
    pools = pools.map((p) => ({ c0: COLS - 1 - p.c1, c1: COLS - 1 - p.c0, r0: p.r0, r1: p.r1 }));
    L.hatchC = COLS - 1 - L.hatchC;
    L.exitC = COLS - 1 - L.exitC;
    L.dir = -1;
  }

  // Luke freiräumen
  for (let r = L.hatchR - 4; r <= L.hatchR + 2; r++) {
    for (let c = L.hatchC - 3; c <= L.hatchC + 3; c++) {
      if (c >= 0 && c < COLS && r >= 0 && r < ROWS && terrain[c + r * COLS] !== T_LAVA) setCell(c, r, T_EMPTY);
    }
  }
  hatch.x = FIELD.x + (L.hatchC + 0.5) * CS;
  hatch.y = FIELD.y + L.hatchR * CS;
  hatch.open = 0;
  startDir = L.dir;

  // Ausgang: Boden suchen, Metallsockel + Freiraum
  let gr = -1;
  for (let r = 10; r < ROWS; r++) {
    if (isRockCell(L.exitC, r)) {
      gr = r;
      break;
    }
  }
  if (gr < 0) gr = 44;
  for (let c = L.exitC - 3; c <= L.exitC + 3; c++) {
    for (let r = gr - 6; r < gr; r++) setCell(c, r, T_EMPTY);
    setCell(c, gr, T_METAL);
    setCell(c, gr + 1, T_METAL);
  }
  exitPortal.x = FIELD.x + (L.exitC + 0.5) * CS;
  exitPortal.y = FIELD.y + gr * CS;

  // Fraktal-Schattierung (Julia-Bänder) für das Gestein
  const seed = JULIA_SEEDS[n % JULIA_SEEDS.length];
  for (let r = 0; r < ROWS; r++) {
    for (let c = 0; c < COLS; c++) {
      let zx = (c / COLS - 0.5) * 3.4;
      let zy = (r / ROWS - 0.5) * 1.6;
      let it = 0;
      while (zx * zx + zy * zy < 4 && it < 28) {
        const t = zx * zx - zy * zy + seed[0];
        zy = 2 * zx * zy + seed[1];
        zx = t;
        it++;
      }
      shade[c + r * COLS] = it >= 28 ? 0 : 1 + (it % 5);
    }
  }

  renderTerrainFull();
}

// ---------------------------------------------------------------------------------------------------------
// Gelände zeichnen (Offscreen, nur bei Änderung)
// ---------------------------------------------------------------------------------------------------------

function ensureTerrainCanvas() {
  if (!terrainCanvas) {
    terrainCanvas = document.createElement('canvas');
    terrainCanvas.width = FIELD.w;
    terrainCanvas.height = FIELD.h;
    terrainCtx = terrainCanvas.getContext('2d');
  }
}

function renderTerrainFull() {
  ensureTerrainCanvas();
  renderTerrainRect(0, 0, COLS - 1, ROWS - 1);
  dirty = null;
}

function renderTerrainRect(c0, r0, c1, r1) {
  c0 = Math.max(0, c0 - 1);
  r0 = Math.max(0, r0 - 1);
  c1 = Math.min(COLS - 1, c1 + 1);
  r1 = Math.min(ROWS - 1, r1 + 1);
  const g = terrainCtx;
  const x0 = c0 * CS;
  const y0 = r0 * CS;
  const w = (c1 - c0 + 1) * CS;
  const h = (r1 - r0 + 1) * CS;
  g.save();
  g.beginPath();
  g.rect(x0, y0, w, h);
  g.clip();
  g.clearRect(x0, y0, w, h);
  // sehr dunkle Füllung (fraktale Bänder)
  for (let s = 0; s < 6; s++) {
    g.fillStyle = PAL.rockShades[s];
    for (let r = r0; r <= r1; r++) {
      for (let c = c0; c <= c1; c++) {
        const i = c + r * COLS;
        if (terrain[i] === T_ROCK && shade[i] === s) g.fillRect(c * CS, r * CS, CS + 0.5, CS + 0.5);
      }
    }
  }
  g.fillStyle = PAL.metalFill;
  for (let r = r0; r <= r1; r++) {
    for (let c = c0; c <= c1; c++) {
      if (terrain[c + r * COLS] === T_METAL) g.fillRect(c * CS, r * CS, CS + 0.5, CS + 0.5);
    }
  }
  // Metall-Schraffur
  g.strokeStyle = PAL.metalLine;
  g.lineWidth = 2;
  g.beginPath();
  for (let r = r0; r <= r1; r++) {
    for (let c = c0; c <= c1; c++) {
      if (terrain[c + r * COLS] === T_METAL && (c + r) % 2 === 0) {
        g.moveTo(c * CS + 3, r * CS + CS - 3);
        g.lineTo(c * CS + CS - 3, r * CS + 3);
      }
    }
  }
  g.stroke();
  // Konturen: Kante zeichnen, wo Fels/Metall an Nicht-Fels grenzt
  for (let pass = 0; pass < 2; pass++) {
    const type = pass === 0 ? T_ROCK : T_METAL;
    g.strokeStyle = pass === 0 ? PAL.rockEdge : PAL.metalEdge;
    g.lineWidth = pass === 0 ? 3 : 4;
    g.lineCap = 'square';
    g.beginPath();
    for (let r = Math.max(0, r0 - 1); r <= Math.min(ROWS - 1, r1 + 1); r++) {
      for (let c = Math.max(0, c0 - 1); c <= Math.min(COLS - 1, c1 + 1); c++) {
        if (terrain[c + r * COLS] !== type) continue;
        const x = c * CS;
        const y = r * CS;
        if (!isRockCell(c, r - 1)) {
          g.moveTo(x, y);
          g.lineTo(x + CS, y);
        }
        if (!isRockCell(c, r + 1)) {
          g.moveTo(x, y + CS);
          g.lineTo(x + CS, y + CS);
        }
        if (!isRockCell(c - 1, r)) {
          g.moveTo(x, y);
          g.lineTo(x, y + CS);
        }
        if (!isRockCell(c + 1, r)) {
          g.moveTo(x + CS, y);
          g.lineTo(x + CS, y + CS);
        }
      }
    }
    g.stroke();
  }
  g.restore();
}

// ---------------------------------------------------------------------------------------------------------
// Leuchtlinge
// ---------------------------------------------------------------------------------------------------------

function walkerColors(w) {
  w.fill = col(w.hue, 0.7, 0.16);
  w.rim = col(w.hue, 0.6, 0.95);
  w.eye = col(w.hue, 0.12, 0.95);
  w.glow = col(w.hue + 0.1, 0.8, 1);
}

function createWalker(x, y, dir) {
  const w = {
    x,
    y,
    dir,
    state: 'fall',
    vy: 0,
    fallStartY: y,
    umbrella: false,
    hue: 0.45 + Math.random() * 0.17,
    phase: Math.random() * 10,
    blockTimer: 0,
    anim: 0,
    scale: 1,
    spin: 0,
    panic: 0,
    btn: null,
  };
  walkerColors(w);
  const bf = DIFFICULTY.blockerFill;
  const btn = guiPixelFillButton({
    label: '',
    posX: x,
    posY: y - SETTINGS.bodyR,
    radius: SETTINGS.hitR,
    speedUp: bf.speedUp,
    speedDown: bf.speedDown,
    fullPercent: bf.fullPercent,
    activeValue: bf.activeValue,
    counterReset: true,
    visible: false,
    onEnterActive: () => onWalkerFilled(w),
  });
  // Handle-Wrapping: nur beim passenden Werkzeug füllen, sonst leert sich der Zähler
  const handleOriginal = btn.handle;
  btn.handle = (grid, dt) => {
    btn.setX(w.x);
    btn.setY(w.y - SETTINGS.bodyR);
    if (!isReceptive(w)) {
      if (btn.getValue() > 0) btn.setValue(Math.max(0, btn.getValue() - 80 * dt));
      return;
    }
    if (cursor.visible > 0 && isKey('Enter')) {
      const dx = cursor.x - w.x;
      const dy = cursor.y - (w.y - SETTINGS.bodyR);
      if (dx * dx + dy * dy < SETTINGS.hitR * SETTINGS.hitR) btn.setValue(Math.min(100, btn.getValue() + 160 * dt));
    }
    handleOriginal(grid, dt);
  };
  w.btn = btn;
  return w;
}

function isReceptive(w) {
  if (activeTool === TOOL_BLOCK) return w.state === 'walk';
  if (activeTool === TOOL_UMBRELLA) return !w.umbrella && (w.state === 'walk' || w.state === 'fall');
  return false;
}

function onWalkerFilled(w) {
  if (activeTool === TOOL_BLOCK && w.state === 'walk') {
    w.state = 'block';
    w.blockTimer = DIFFICULTY.blockDuration;
    STATS.blockers++;
    burst(w.x, w.y - SETTINGS.bodyR, 14, PAL.tool[TOOL_BLOCK], 220, 0.6, 4, 0);
    addText(w.x, w.y - 80, 'STOPP!', PAL.tool[TOOL_BLOCK], 36);
  } else if (activeTool === TOOL_UMBRELLA && !w.umbrella) {
    w.umbrella = true;
    STATS.umbrellas++;
    burst(w.x, w.y - SETTINGS.bodyR * 2, 12, PAL.tool[TOOL_UMBRELLA], 180, 0.6, 4, 0);
    addText(w.x, w.y - 80, 'Schirm!', PAL.tool[TOOL_UMBRELLA], 36);
  }
}

function hasGround(x, y) {
  return isSolid(x, y + 2) || isSolid(x - 6, y + 2) || isSolid(x + 6, y + 2);
}

function blockedByBlocker(w, nx) {
  for (let k = 0; k < walkers.length; k++) {
    const b = walkers[k];
    if (b === w || b.state !== 'block') continue;
    if (Math.abs(b.y - w.y) > SETTINGS.bodyH) continue;
    const dx = b.x - nx;
    if (dx * w.dir > 0 && Math.abs(dx) < SETTINGS.halfW * 2 + 6) return true;
  }
  return false;
}

function startFall(w) {
  w.state = 'fall';
  w.vy = 30;
  w.fallStartY = w.y;
}

function killWalker(w, how) {
  w.state = 'dead';
  w.anim = 0;
  lostCount++;
  STATS.lost++;
  const cx = w.x;
  const cy = w.y - SETTINGS.bodyR;
  if (how === 'splat') {
    STATS.splat++;
    burst(cx, w.y - 6, 26, w.rim, 320, 0.9, 6, 600);
    burst(cx, w.y - 6, 10, w.glow, 180, 1.2, 3, 0);
    shake = Math.max(shake, 14);
    addText(cx, cy - 40, 'Splat!', PAL.bad, 40);
    playSound(soundSplat, 0.35);
  } else if (how === 'burn') {
    STATS.burned++;
    burst(cx, w.y, 30, PAL.lava, 260, 1.0, 5, -150);
    shake = Math.max(shake, 10);
    addText(cx, cy - 40, 'Zisch!', PAL.bad, 40);
    playSound(soundLava, 0.5);
  } else {
    STATS.abyss++;
    addText(cx, FIELD.y + FIELD.h - 40, 'Aaah…', PAL.bad, 40);
  }
}

function saveWalker(w) {
  w.state = 'saved';
  w.anim = 0;
  savedCount++;
  STATS.saved++;
  const pts = DIFFICULTY.pointsSaveBase + DIFFICULTY.pointsSavePerLevel * level;
  score += pts;
  addText(exitPortal.x, exitPortal.y - 130, '+' + pts, PAL.good, 44);
  burst(exitPortal.x, exitPortal.y - 50, 18, PAL.portal, 260, 0.8, 4, 0);
  playSound(soundSave, 0.5);
}

function atExit(w) {
  return Math.abs(w.x - exitPortal.x) < 34 && Math.abs(w.y - exitPortal.y) < 40;
}

function updateWalk(w, dt, speed) {
  const nx = w.x + w.dir * speed * dt;
  const fx = nx + w.dir * SETTINGS.halfW;
  if (blockedByBlocker(w, nx)) {
    w.dir = -w.dir;
    return;
  }
  if (isSolid(fx, w.y - 2)) {
    // Stufe hochsteigen?
    let climb = 0;
    for (let k = 1; k <= SETTINGS.maxStepCells; k++) {
      const ny = w.y - k * CS;
      if (!isSolid(fx, ny - 2) && !isSolid(fx, ny - SETTINGS.bodyH) && !isSolid(w.x, ny - SETTINGS.bodyH)) {
        climb = k;
        break;
      }
    }
    if (!climb) {
      w.dir = -w.dir;
      return;
    }
    w.y -= climb * CS;
    w.x = nx;
  } else if (isSolid(fx, w.y - SETTINGS.bodyH * 0.5) || isSolid(fx, w.y - SETTINGS.bodyH)) {
    w.dir = -w.dir;
    return;
  } else {
    w.x = nx;
  }
  // eingebaut/eingeklemmt (z. B. Brücke unter dem Körper): eine Zelle hoch
  if (isSolid(w.x, w.y - 2) && !isSolid(w.x, w.y - CS - SETTINGS.bodyH)) w.y -= CS;
  if (!hasGround(w.x, w.y)) {
    for (let k = 1; k <= SETTINGS.maxStepCells; k++) {
      if (hasGround(w.x, w.y + k * CS)) {
        w.y += k * CS;
        return;
      }
    }
    startFall(w);
  }
}

function updateFall(w, dt) {
  const maxV = w.umbrella ? SETTINGS.umbrellaFall : SETTINGS.fallMax;
  w.vy = Math.min(maxV, w.vy + SETTINGS.fallAcc * dt);
  if (w.vy > maxV) w.vy = maxV;
  let remaining = w.vy * dt;
  while (remaining > 0) {
    const step = Math.min(remaining, CS * 0.5);
    remaining -= step;
    w.y += step;
    if (cellTypeAt(w.x, w.y - 2) === T_LAVA) {
      killWalker(w, 'burn');
      return;
    }
    if (w.y > FIELD.y + FIELD.h + 80) {
      killWalker(w, 'abyss');
      return;
    }
    if (isSolid(w.x, w.y) || isSolid(w.x - 6, w.y) || isSolid(w.x + 6, w.y)) {
      // auf Zellkante einrasten
      const r = Math.floor((w.y - FIELD.y) / CS);
      w.y = FIELD.y + r * CS;
      const dist = w.y - w.fallStartY;
      if (dist > SETTINGS.safeFall && !w.umbrella) {
        killWalker(w, 'splat');
        return;
      }
      w.state = 'walk';
      w.vy = 0;
      if (w.umbrella && dist > SETTINGS.safeFall) burst(w.x, w.y, 8, PAL.tool[TOOL_UMBRELLA], 120, 0.5, 3, 0);
      return;
    }
  }
}

function updateWalkers(grid, dt) {
  const speedBase = params.walkSpeed * (1 + panic * DIFFICULTY.panicSpeedBoost);
  walkers.slice().forEach((w) => {
    w.panic = panic;
    if (w.state === 'walk') {
      w.phase += dt * (speedBase / 9);
      updateWalk(w, dt, speedBase);
      if (w.state === 'walk' && atExit(w)) saveWalker(w);
      if (panic > 0.3 && Math.random() < dt * 4 * panic) {
        addParticle({
          x: w.x + (Math.random() - 0.5) * 30,
          y: w.y - SETTINGS.bodyR * 2,
          vx: (Math.random() - 0.5) * 60,
          vy: -60,
          life: 0.6,
          max: 0.6,
          color: PAL.hudWarn,
          size: 3,
          g: 300,
        });
      }
    } else if (w.state === 'fall') {
      updateFall(w, dt);
      if (w.state === 'fall' && atExit(w)) saveWalker(w);
    } else if (w.state === 'block') {
      w.blockTimer -= dt;
      if (!hasGround(w.x, w.y)) {
        startFall(w);
      } else if (w.blockTimer <= 0) {
        // Dienst vorbei: der Blocker dreht um (er stand ja mit dem Gesicht zur Gefahr)
        w.state = 'walk';
        w.dir = -w.dir;
      }
    } else if (w.state === 'saved') {
      w.anim += dt;
      w.x += (exitPortal.x - w.x) * Math.min(1, dt * 6);
      w.scale = Math.max(0, 1 - w.anim / 0.6);
      w.spin += dt * 12;
      if (w.anim > 0.6) walkers.splice(walkers.indexOf(w), 1);
      return;
    } else if (w.state === 'dead') {
      walkers.splice(walkers.indexOf(w), 1);
      return;
    }
    if (w.state === 'walk' || w.state === 'fall') w.btn.handle(grid, dt);
    else if (w.btn.getValue() > 0) w.btn.setValue(0);
  });
}

function markOccupied() {
  for (let k = 0; k < occList.length; k++) occ[occList[k]] = 0;
  occList.length = 0;
  walkers.forEach((w) => {
    if (w.state !== 'walk' && w.state !== 'fall' && w.state !== 'block') return;
    const c0 = Math.max(0, Math.floor((w.x - SETTINGS.halfW - 6 - FIELD.x) / CS));
    const c1 = Math.min(COLS - 1, Math.floor((w.x + SETTINGS.halfW + 6 - FIELD.x) / CS));
    const r0 = Math.max(0, Math.floor((w.y - SETTINGS.bodyH - 10 - FIELD.y) / CS));
    const r1 = Math.min(ROWS - 1, Math.floor((w.y - 1 - FIELD.y) / CS));
    for (let r = r0; r <= r1; r++) {
      for (let c = c0; c <= c1; c++) {
        const i = c + r * COLS;
        if (!occ[i]) {
          occ[i] = 1;
          occList.push(i);
        }
      }
    }
  });
}

// ---------------------------------------------------------------------------------------------------------
// Werkzeuge auf das Gelände anwenden (Werte kommen aus der paintLayer-Belichtung)
// ---------------------------------------------------------------------------------------------------------

function applyTools(dt) {
  builtList.length = 0;
  digList.length = 0;
  chargeList.length = 0;
  const tool = activeTool;
  const digStep = DIFFICULTY.digRate * dt;
  const buildStep = DIFFICULTY.buildRate * dt;
  const decay = params.builtDecay * dt;
  let metalHit = 0;
  let i = 0;
  for (let r = 0; r < ROWS; r++) {
    const cy = FIELD.y + (r + 0.5) * CS;
    for (let c = 0; c < COLS; c++, i++) {
      const t = terrain[i];
      if (t === T_EMPTY) {
        if (tool === TOOL_BUILD) {
          const v = layer.getValueAt(FIELD.x + (c + 0.5) * CS, cy);
          if (v > 0.05 && !occ[i]) {
            work[i] += v * buildStep;
            if (work[i] >= 1) {
              terrain[i] = T_BUILT;
              work[i] = 1;
              STATS.built++;
              if (Math.random() < 0.25) burst(FIELD.x + (c + 0.5) * CS, cy, 2, PAL.builtEdge, 80, 0.4, 2, 0);
            } else {
              chargeList.push(i);
            }
          } else if (work[i] > 0) {
            work[i] = Math.max(0, work[i] - dt * 1.5);
            if (work[i] > 0) chargeList.push(i);
          }
        } else if (work[i] !== 0) {
          work[i] = 0;
        }
      } else if (t === T_ROCK) {
        if (tool === TOOL_DIG) {
          const v = layer.getValueAt(FIELD.x + (c + 0.5) * CS, cy);
          if (v > 0.05) {
            work[i] -= v * digStep;
            if (work[i] <= 0) {
              terrain[i] = T_EMPTY;
              work[i] = 0;
              markDirty(c, r);
              STATS.dug++;
              if (Math.random() < 0.35) {
                addParticle({
                  x: FIELD.x + (c + 0.5) * CS,
                  y: cy,
                  vx: (Math.random() - 0.5) * 160,
                  vy: -80 - Math.random() * 120,
                  life: 0.8,
                  max: 0.8,
                  color: PAL.rockEdge,
                  size: 3 + Math.random() * 3,
                  g: 700,
                });
              }
              continue;
            }
          }
        }
        if (work[i] < 1) digList.push(i);
      } else if (t === T_BUILT) {
        let v = 0;
        if (tool === TOOL_BUILD) v = layer.getValueAt(FIELD.x + (c + 0.5) * CS, cy);
        if (v > 0.05) {
          work[i] = Math.min(1, work[i] + v * DIFFICULTY.builtRefresh * dt);
        } else {
          work[i] -= decay;
        }
        if (work[i] <= 0) {
          terrain[i] = T_EMPTY;
          work[i] = 0;
          if (Math.random() < 0.5) burst(FIELD.x + (c + 0.5) * CS, cy, 2, PAL.builtEdge, 60, 0.5, 2, 200);
        } else {
          builtList.push(i);
        }
      } else if (t === T_METAL && tool === TOOL_DIG) {
        const v = layer.getValueAt(FIELD.x + (c + 0.5) * CS, cy);
        if (v > 0.3) {
          metalHit++;
          if (Math.random() < dt * 2) burst(FIELD.x + (c + 0.5) * CS, cy, 2, PAL.metalEdge, 200, 0.3, 2, 300);
        }
      }
    }
  }
  if (metalHit > 4) {
    metalSparkTimer -= dt;
    if (metalSparkTimer <= 0) {
      metalSparkTimer = 3;
      addText(960, FIELD.y + 120, 'Metall! Hier hilft kein Graben', PAL.metalEdge, 40);
    }
  }
}

// ---------------------------------------------------------------------------------------------------------
// Ablauf: Spiel, Level, Zwischenbild, Game Over
// ---------------------------------------------------------------------------------------------------------

function levelParams(n) {
  const k = n - 1;
  return {
    walkers: Math.min(DIFFICULTY.walkersMax, DIFFICULTY.walkersStart + k * DIFFICULTY.walkersPerLevel),
    spawnInterval: Math.max(
      DIFFICULTY.spawnIntervalMin,
      DIFFICULTY.spawnIntervalStart * Math.pow(DIFFICULTY.spawnIntervalFactor, k)
    ),
    walkSpeed: Math.min(DIFFICULTY.walkSpeedMax, DIFFICULTY.walkSpeedStart + k * DIFFICULTY.walkSpeedPerLevel),
    timeLimit: Math.max(DIFFICULTY.timeLimitMin, DIFFICULTY.timeLimitStart + k * DIFFICULTY.timeLimitPerLevel),
    required: Math.min(DIFFICULTY.requiredMax, DIFFICULTY.requiredStart + k * DIFFICULTY.requiredPerLevel),
    builtDecay: Math.min(DIFFICULTY.builtDecayMax, DIFFICULTY.builtDecayStart + k * DIFFICULTY.builtDecayPerLevel),
  };
}

function requiredCount() {
  return Math.ceil(params.walkers * params.required);
}

function startLevel(n) {
  params = levelParams(n);
  buildLevel(n);
  walkers = [];
  particles = [];
  texts = [];
  spawned = 0;
  spawnTimer = 1.0;
  savedCount = 0;
  lostCount = 0;
  timeLeft = params.timeLimit;
  panic = 0;
  endTimer = -1;
  endSuccess = false;
  goalAnnounced = false;
  activeTool = TOOL_DIG;
  toolFlash = 0;
  metalSparkTimer = 0;
  for (let k = 0; k < occList.length; k++) occ[occList[k]] = 0;
  occList.length = 0;
  if (layer) layer.fill(0);
  if (vote) vote.reset();
  if (calm) calm.reset();
}

function enterIntermission(title, sub) {
  gameState = 'levelup';
  interTimer = SETTINGS.intermissionTime;
  interTitle = title;
  interSub = sub;
  flash = 1;
}

function levelHint(n) {
  return n <= LEVEL_HINTS.length ? LEVEL_HINTS[n - 1] : LEVEL_HINTS[(n - 1) % LEVEL_HINTS.length] + '  (schneller, mehr, knapper)';
}

function startGame() {
  resetStats();
  score = 0;
  lives = SETTINGS.lives;
  level = 1;
  gameTime = 0;
  startLevel(level);
  enterIntermission('LEVEL 1', levelHint(1));
  playSound(soundLevel, 0.5);
}

function finishLevel(success) {
  if (success) {
    const bonus = Math.ceil(Math.max(0, timeLeft)) * DIFFICULTY.timeBonusPerSecond;
    const perfect = savedCount >= params.walkers ? DIFFICULTY.perfectBonus : 0;
    score += bonus + perfect;
    STATS.levelsDone++;
    level++;
    startLevel(level);
    enterIntermission(
      'LEVEL ' + level,
      (perfect ? 'ALLE GERETTET! +' + perfect + '   ' : '') + 'Zeitbonus +' + bonus + '\n' + levelHint(level)
    );
    playSound(soundLevel, 0.5);
  } else {
    lives--;
    shake = 20;
    if (lives <= 0) {
      enterGameOver();
      return;
    }
    const got = savedCount + ' von ' + requiredCount();
    startLevel(level);
    enterIntermission('NOCHMAL!', 'Nur ' + got + ' gerettet – noch ' + lives + ' Leben' + '\n' + levelHint(level));
    playSound(soundSplat, 0.4);
  }
}

function enterGameOver() {
  gameState = 'gameover';
  gameOverTime = 0;
  highscore.addEntry({ punkte: score, level: level, gerettet: STATS.saved });
  gameOverButton = guiFillButton({
    label: 'NOCHMAL',
    posX: 960,
    posY: 820,
    radius: 105,
    edges: 8,
    speedUp: 60,
    speedDown: 30,
    normalColor: PAL.button[0],
    growColor: PAL.button[1],
    activeColor: PAL.button[2],
    onEnterActive: () => {
      if (gameOverTime > SETTINGS.gameOverLockTime) startGame();
    },
  });
}

function setTool(i) {
  if (i < 0 || i >= TOOLS.length) return;
  if (i !== activeTool) {
    activeTool = i;
    toolFlash = 1.3;
    playSound(soundTool, 0.25);
  }
}

// ---------------------------------------------------------------------------------------------------------
// Zeichnen
// ---------------------------------------------------------------------------------------------------------

function updateFireflies(dt) {
  if (fireflies.length === 0) {
    for (let k = 0; k < SETTINGS.fireflies; k++) {
      fireflies.push({
        x: Math.random() * 1920,
        y: FIELD.y + Math.random() * FIELD.h,
        phase: Math.random() * 10,
        speed: 10 + Math.random() * 25,
      });
    }
  }
  fireflies.forEach((f) => {
    f.phase += dt;
    f.x += Math.sin(f.phase * 0.7) * f.speed * dt;
    f.y += Math.cos(f.phase * 0.53) * f.speed * 0.6 * dt;
    if (f.x < 0) f.x += 1920;
    if (f.x > 1920) f.x -= 1920;
    if (f.y < FIELD.y) f.y = FIELD.y + FIELD.h;
    if (f.y > FIELD.y + FIELD.h) f.y = FIELD.y;
  });
}

function drawFireflies(ctx) {
  ctx.save();
  ctx.fillStyle = PAL.firefly;
  fireflies.forEach((f) => {
    const a = 0.15 + 0.35 * Math.max(0, Math.sin(f.phase * 2.3));
    ctx.globalAlpha = a;
    ctx.beginPath();
    ctx.arc(f.x, f.y, 2.5, 0, Math.PI * 2);
    ctx.fill();
  });
  ctx.restore();
}

function drawLava(ctx) {
  ctx.save();
  pools.forEach((p) => {
    const x = FIELD.x + p.c0 * CS;
    const y = FIELD.y + p.r0 * CS;
    const w = (p.c1 - p.c0 + 1) * CS;
    const h = (p.r1 - p.r0 + 1) * CS;
    ctx.fillStyle = PAL.lavaDark;
    ctx.fillRect(x, y + 4, w, h - 4);
    // schimmernde Blasen im See
    ctx.globalAlpha = 0.25;
    ctx.fillStyle = PAL.lavaGlow;
    for (let k = 0; k < 3; k++) {
      const bx = x + w * (0.5 + 0.4 * Math.sin(gameTime * (0.4 + k * 0.3) + k * 2));
      const by = y + h * (0.55 + 0.2 * Math.sin(gameTime * 0.9 + k));
      ctx.beginPath();
      ctx.ellipse(bx, by, 26, 10, 0, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
    // Oberfläche
    ctx.strokeStyle = PAL.lava;
    ctx.lineWidth = 4;
    ctx.shadowColor = PAL.lava;
    ctx.shadowBlur = 16;
    ctx.beginPath();
    for (let xx = 0; xx <= w; xx += 8) {
      const yy = y + 5 + Math.sin(gameTime * 3 + (x + xx) * 0.05) * 3 + Math.sin(gameTime * 1.7 + (x + xx) * 0.13) * 1.5;
      if (xx === 0) ctx.moveTo(x + xx, yy);
      else ctx.lineTo(x + xx, yy);
    }
    ctx.stroke();
    ctx.shadowBlur = 0;
    if (gameState === 'play' && Math.random() < 0.03 * (w / 100)) {
      addParticle({
        x: x + Math.random() * w,
        y: y + 4,
        vx: (Math.random() - 0.5) * 30,
        vy: -90 - Math.random() * 80,
        life: 0.7,
        max: 0.7,
        color: PAL.lava,
        size: 3,
        g: 300,
      });
    }
  });
  ctx.restore();
}

function drawBuiltAndDig(ctx) {
  ctx.save();
  // Bau-Ladung (Vorschau)
  if (chargeList.length) {
    ctx.strokeStyle = PAL.charge;
    ctx.lineWidth = 1.5;
    chargeList.forEach((i) => {
      const c = i % COLS;
      const r = (i - c) / COLS;
      ctx.globalAlpha = Math.min(1, work[i]) * 0.8;
      const s = CS * (0.3 + 0.7 * Math.min(1, work[i]));
      ctx.strokeRect(FIELD.x + c * CS + (CS - s) / 2, FIELD.y + r * CS + (CS - s) / 2, s, s);
    });
  }
  // Lichtbrücke
  if (builtList.length) {
    const shimmer = 0.75 + 0.25 * Math.sin(gameTime * 6);
    builtList.forEach((i) => {
      const c = i % COLS;
      const r = (i - c) / COLS;
      const x = FIELD.x + c * CS;
      const y = FIELD.y + r * CS;
      ctx.globalAlpha = 0.35 + 0.65 * work[i];
      ctx.fillStyle = PAL.builtFill;
      ctx.fillRect(x, y, CS, CS);
      ctx.globalAlpha = (0.3 + 0.7 * work[i]) * shimmer;
      ctx.strokeStyle = PAL.builtEdge;
      ctx.lineWidth = 2;
      ctx.strokeRect(x + 1, y + 1, CS - 2, CS - 2);
    });
  }
  // angegrabenes Gestein glüht
  if (digList.length) {
    ctx.fillStyle = PAL.dig;
    digList.forEach((i) => {
      const c = i % COLS;
      const r = (i - c) / COLS;
      ctx.globalAlpha = (1 - work[i]) * 0.7;
      const s = CS * (1 - work[i] * 0.6);
      ctx.fillRect(FIELD.x + c * CS + (CS - s) / 2, FIELD.y + r * CS + (CS - s) / 2, s, s);
    });
  }
  ctx.restore();
}

function drawHatch(ctx) {
  const x = hatch.x;
  const y = hatch.y - 40;
  ctx.save();
  // Schacht nach oben
  ctx.strokeStyle = PAL.hatch;
  ctx.globalAlpha = 0.35;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(x - 40, y);
  ctx.lineTo(x - 40, FIELD.y);
  ctx.moveTo(x + 40, y);
  ctx.lineTo(x + 40, FIELD.y);
  ctx.stroke();
  ctx.globalAlpha = 1;
  ctx.fillStyle = PAL.hatchFill;
  ctx.fillRect(x - 48, y - 16, 96, 22);
  ctx.strokeStyle = PAL.hatch;
  ctx.lineWidth = 3;
  ctx.strokeRect(x - 48, y - 16, 96, 22);
  // Klappen
  const a = hatch.open * 1.2;
  ctx.beginPath();
  ctx.moveTo(x - 46, y + 6);
  ctx.lineTo(x - 46 + Math.cos(a) * 44, y + 6 + Math.sin(a) * 44);
  ctx.moveTo(x + 46, y + 6);
  ctx.lineTo(x + 46 - Math.cos(a) * 44, y + 6 + Math.sin(a) * 44);
  ctx.stroke();
  // Restanzeige
  util.renderText({
    ctx,
    text: String(Math.max(0, params.walkers - spawned)),
    x,
    y: y - 24,
    fontSize: '30px',
    fillStyle: PAL.hatch,
  });
  ctx.restore();
}

/** Portal mit selbstähnlicher Spirale (rotierende, geschachtelte n-Ecke + logarithmische Spiralarme) */
function drawPortal(ctx) {
  const x = exitPortal.x;
  const y = exitPortal.y - 52;
  ctx.save();
  ctx.translate(x, y);
  ctx.globalCompositeOperation = 'lighter';
  ctx.strokeStyle = PAL.portal;
  ctx.lineWidth = 2.5;
  ctx.globalAlpha = 0.8;
  let s = 48;
  let rot = gameTime * 0.8;
  for (let k = 0; k < 6; k++) {
    ctx.beginPath();
    for (let e = 0; e <= 5; e++) {
      const a = rot + (e / 5) * Math.PI * 2;
      if (e === 0) ctx.moveTo(Math.cos(a) * s, Math.sin(a) * s);
      else ctx.lineTo(Math.cos(a) * s, Math.sin(a) * s);
    }
    ctx.stroke();
    s *= 0.72;
    rot += 0.45 + Math.sin(gameTime) * 0.1;
  }
  ctx.strokeStyle = PAL.portalB;
  ctx.globalAlpha = 0.7;
  for (let arm = 0; arm < 4; arm++) {
    ctx.beginPath();
    for (let k = 0; k <= 24; k++) {
      const tt = k / 24;
      const a = -gameTime * 2 + arm * (Math.PI / 2) + tt * 5;
      const rr = 50 * Math.exp(-tt * 2.6);
      if (k === 0) ctx.moveTo(Math.cos(a) * rr, Math.sin(a) * rr);
      else ctx.lineTo(Math.cos(a) * rr, Math.sin(a) * rr);
    }
    ctx.stroke();
  }
  ctx.restore();
  util.renderText({ ctx, text: 'AUSGANG', x, y: y - 66, fontSize: '26px', fillStyle: PAL.portal });
}

function drawWalker(ctx, w) {
  const s = w.scale === undefined ? 1 : w.scale;
  if (s <= 0.02) return;
  const R = SETTINGS.bodyR;
  ctx.save();
  let px = w.x;
  const py = w.y - R;
  if (w.panic > 0.05 && w.state === 'walk') px += (Math.random() - 0.5) * 6 * w.panic;
  ctx.translate(px, py);
  ctx.scale(s, s);
  if (w.spin) ctx.rotate(w.spin);
  const walking = w.state === 'walk';
  const falling = w.state === 'fall';
  const bob = walking ? Math.abs(Math.sin(w.phase * 2)) * 4 : 0;
  ctx.lineCap = 'round';
  ctx.strokeStyle = w.rim;
  ctx.lineWidth = 4;
  // Schirm
  if (w.umbrella) {
    if (falling) {
      ctx.beginPath();
      ctx.moveTo(0, -R * 0.6);
      ctx.lineTo(0, -R * 2.3);
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(0, -R * 2.3, R * 1.6, Math.PI, 0);
      ctx.closePath();
      ctx.fillStyle = w.fill;
      ctx.fill();
      ctx.strokeStyle = PAL.tool[TOOL_UMBRELLA];
      ctx.stroke();
      ctx.strokeStyle = w.rim;
    } else {
      ctx.beginPath();
      ctx.moveTo(-w.dir * R * 0.7, R * 0.3);
      ctx.lineTo(-w.dir * R * 0.9, -R * 1.2);
      ctx.strokeStyle = PAL.tool[TOOL_UMBRELLA];
      ctx.stroke();
      ctx.strokeStyle = w.rim;
    }
  }
  // Füße
  const step = walking ? Math.sin(w.phase * 2) * 8 : 0;
  ctx.beginPath();
  ctx.moveTo(-8, R * 0.6);
  ctx.lineTo(-8 + step, R);
  ctx.moveTo(8, R * 0.6);
  ctx.lineTo(8 - step, R);
  ctx.stroke();
  // Arme
  ctx.beginPath();
  if (w.state === 'block') {
    ctx.moveTo(-R * 0.8, -bob);
    ctx.lineTo(-R * 1.6, -R * 0.4);
    ctx.moveTo(R * 0.8, -bob);
    ctx.lineTo(R * 1.6, -R * 0.4);
  } else if (falling && !w.umbrella) {
    ctx.moveTo(-R * 0.7, -R * 0.2);
    ctx.lineTo(-R * 1.1, -R * 1.1);
    ctx.moveTo(R * 0.7, -R * 0.2);
    ctx.lineTo(R * 1.1, -R * 1.1);
  }
  ctx.stroke();
  // Körper: dunkel gefüllt, heller Rand
  ctx.beginPath();
  ctx.ellipse(0, -bob, R * 0.85, R * 0.95, 0, 0, Math.PI * 2);
  ctx.fillStyle = w.fill;
  ctx.fill();
  ctx.lineWidth = w.state === 'block' ? 6 : 4;
  ctx.strokeStyle = w.state === 'block' ? PAL.tool[TOOL_BLOCK] : w.rim;
  ctx.stroke();
  // Augen
  const ex = (w.dir || 1) * 5;
  ctx.fillStyle = w.eye;
  ctx.beginPath();
  ctx.arc(ex - 7, -6 - bob, 5, 0, Math.PI * 2);
  ctx.arc(ex + 7, -6 - bob, 5, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = w.fill;
  const look = falling ? -2 : 0;
  ctx.beginPath();
  ctx.arc(ex - 7 + (w.dir || 1) * 1.8, -6 - bob + look, 2.3, 0, Math.PI * 2);
  ctx.arc(ex + 7 + (w.dir || 1) * 1.8, -6 - bob + look, 2.3, 0, Math.PI * 2);
  ctx.fill();
  // Antenne mit Leuchtkugel
  ctx.strokeStyle = w.rim;
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(0, -R * 0.9 - bob);
  ctx.quadraticCurveTo(-(w.dir || 1) * 8, -R * 1.3 - bob, -(w.dir || 1) * 5, -R * 1.5 - bob);
  ctx.stroke();
  ctx.shadowColor = w.glow;
  ctx.shadowBlur = 14;
  ctx.fillStyle = w.glow;
  ctx.beginPath();
  ctx.arc(-(w.dir || 1) * 5, -R * 1.5 - bob, 4.5 + 1.5 * Math.sin(gameTime * 5 + w.phase), 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();

  // Füllring (Blocken/Schirm) und Blocker-Timer in Weltkoordinaten
  if (w.btn && w.btn.getValue() > 1 && (w.state === 'walk' || w.state === 'fall')) {
    ctx.save();
    ctx.strokeStyle = PAL.tool[activeTool];
    ctx.lineWidth = 5;
    ctx.beginPath();
    ctx.arc(w.x, w.y - R, SETTINGS.hitR, -Math.PI / 2, -Math.PI / 2 + (Math.PI * 2 * w.btn.getValue()) / 100);
    ctx.stroke();
    ctx.restore();
  }
  if (w.state === 'block') {
    ctx.save();
    ctx.strokeStyle = PAL.toolDim[TOOL_BLOCK];
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(w.x, w.y - R, R * 1.25, -Math.PI / 2, -Math.PI / 2 + (Math.PI * 2 * w.blockTimer) / DIFFICULTY.blockDuration);
    ctx.stroke();
    ctx.restore();
  }
}

function updateParticles(dt) {
  particles.slice().forEach((p) => {
    p.life -= dt;
    if (p.life <= 0) {
      particles.splice(particles.indexOf(p), 1);
      return;
    }
    p.vy += (p.g || 0) * dt;
    p.x += p.vx * dt;
    p.y += p.vy * dt;
  });
  texts.slice().forEach((t) => {
    t.life -= dt;
    t.y -= 50 * dt;
    if (t.life <= 0) texts.splice(texts.indexOf(t), 1);
  });
}

function drawParticles(ctx) {
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  particles.forEach((p) => {
    ctx.globalAlpha = Math.max(0, p.life / p.max);
    ctx.fillStyle = p.color;
    ctx.fillRect(p.x - p.size / 2, p.y - p.size / 2, p.size, p.size);
  });
  ctx.restore();
  texts.forEach((t) => {
    ctx.save();
    ctx.globalAlpha = Math.max(0, Math.min(1, t.life / t.max * 1.5));
    util.renderText({ ctx, text: t.text, x: t.x, y: t.y, fontSize: t.size + 'px', fillStyle: t.color });
    ctx.restore();
  });
}

function drawWorld(ctx) {
  ctx.save();
  ctx.beginPath();
  ctx.rect(0, FIELD.y, 1920, FIELD.h);
  ctx.clip();
  drawFireflies(ctx);
  if (terrainCanvas) ctx.drawImage(terrainCanvas, FIELD.x, FIELD.y);
  drawLava(ctx);
  drawBuiltAndDig(ctx);
  drawHatch(ctx);
  drawPortal(ctx);
  walkers.forEach((w) => drawWalker(ctx, w));
  drawParticles(ctx);
  ctx.restore();
}

function drawHud(ctx) {
  ctx.save();
  ctx.fillStyle = PAL.hudBg;
  ctx.fillRect(0, 0, 1920, FIELD.y - 4);
  ctx.restore();
  const need = requiredCount();
  util.renderText({ ctx, text: 'LEVEL ' + level, x: 30, y: 56, fontSize: '44px', fillStyle: PAL.hud, align: 'left' });
  util.renderText({
    ctx,
    text: 'Gerettet ' + savedCount + ' / ' + need + '  (von ' + params.walkers + ')',
    x: 300,
    y: 56,
    fontSize: '44px',
    fillStyle: savedCount >= need ? PAL.good : PAL.hud,
    align: 'left',
  });
  const tl = Math.max(0, Math.ceil(timeLeft));
  util.renderText({
    ctx,
    text: 'Zeit ' + tl,
    x: 1050,
    y: 56,
    fontSize: '44px',
    fillStyle: tl <= 15 && Math.floor(gameTime * 3) % 2 === 0 ? PAL.hudWarn : PAL.hud,
    align: 'left',
  });
  let hearts = '';
  for (let k = 0; k < lives; k++) hearts += '♥';
  util.renderText({ ctx, text: hearts, x: 1290, y: 56, fontSize: '44px', fillStyle: PAL.bad, align: 'left' });
  util.renderText({ ctx, text: String(score), x: 1890, y: 56, fontSize: '44px', fillStyle: PAL.hud, align: 'right' });
  // Fortschritt gerettet
  ctx.save();
  ctx.fillStyle = PAL.hudDim;
  ctx.globalAlpha = 0.4;
  ctx.fillRect(0, FIELD.y - 8, 1920, 4);
  ctx.globalAlpha = 1;
  ctx.fillStyle = PAL.good;
  ctx.fillRect(0, FIELD.y - 8, (1920 * savedCount) / Math.max(1, params.walkers), 4);
  ctx.fillStyle = PAL.hud;
  ctx.fillRect((1920 * need) / Math.max(1, params.walkers) - 2, FIELD.y - 14, 4, 14);
  // Panik-Anzeige
  if (panic > 0.02) {
    ctx.fillStyle = PAL.hudWarn;
    ctx.globalAlpha = 0.5 + 0.5 * panic;
    ctx.fillRect(1480, 24, 220 * panic, 18);
    ctx.globalAlpha = 1;
    ctx.strokeStyle = PAL.hudWarn;
    ctx.strokeRect(1480, 24, 220, 18);
  }
  ctx.restore();
  if (panic > 0.02) {
    util.renderText({ ctx, text: 'PANIK', x: 1590, y: 72, fontSize: '22px', fillStyle: PAL.hudWarn });
  }
}

/** dunkler, abgetrennter Werkzeugstreifen – Hintergrund vor voteGroup.handle, Texte danach */
function drawToolbarBack(ctx) {
  ctx.save();
  ctx.fillStyle = PAL.toolbarBg;
  ctx.fillRect(0, SETTINGS.toolbarY, 1920, 1080 - SETTINGS.toolbarY);
  ctx.strokeStyle = PAL.toolbarLine;
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(0, SETTINGS.toolbarY);
  ctx.lineTo(1920, SETTINGS.toolbarY);
  ctx.stroke();
  ctx.restore();
}

function drawToolbarFront(ctx) {
  const shares = vote ? vote.getShares() : [0, 0, 0, 0];
  TOOLS.forEach((t, i) => {
    const x = TOOL_X[i];
    const isActive = i === activeTool;
    const color = isActive ? PAL.tool[i] : PAL.toolDim[i];
    util.renderText({ ctx, text: t.name, x: x + 92, y: TOOL_Y - 8, fontSize: '42px', fillStyle: color, align: 'left' });
    util.renderText({
      ctx,
      text: isActive ? 'AKTIV · ' + t.short : t.short,
      x: x + 92,
      y: TOOL_Y + 26,
      fontSize: '22px',
      fillStyle: color,
      align: 'left',
    });
    ctx.save();
    ctx.globalAlpha = 0.35;
    ctx.fillStyle = PAL.toolDim[i];
    ctx.fillRect(x + 92, TOOL_Y + 40, 240, 10);
    ctx.globalAlpha = 1;
    ctx.fillStyle = PAL.tool[i];
    ctx.fillRect(x + 92, TOOL_Y + 40, 240 * Math.min(1, shares[i] || 0), 10);
    if (isActive) {
      ctx.strokeStyle = PAL.tool[i];
      ctx.lineWidth = 3;
      ctx.strokeRect(x - 82, SETTINGS.toolbarY + 10, 440, 1080 - SETTINGS.toolbarY - 20);
    }
    ctx.restore();
  });
  if (toolFlash > 0) {
    ctx.save();
    ctx.globalAlpha = Math.min(1, toolFlash);
    util.renderTextDropShadow({
      ctx,
      text: 'Werkzeug: ' + TOOLS[activeTool].name,
      x: 960,
      y: FIELD.y + 90,
      fontSize: '60px',
      lineHeight: 60,
      fillStyle: PAL.tool[activeTool],
    });
    ctx.restore();
  }
}

function drawCursor(ctx) {
  if (cursor.visible <= 0) return;
  ctx.save();
  ctx.strokeStyle = PAL.tool[activeTool];
  ctx.globalAlpha = Math.min(1, cursor.visible);
  ctx.lineWidth = 3;
  ctx.setLineDash([10, 8]);
  ctx.beginPath();
  ctx.arc(cursor.x, cursor.y, SETTINGS.cursorRadius, 0, Math.PI * 2);
  ctx.stroke();
  ctx.setLineDash([]);
  ctx.beginPath();
  ctx.moveTo(cursor.x - 12, cursor.y);
  ctx.lineTo(cursor.x + 12, cursor.y);
  ctx.moveTo(cursor.x, cursor.y - 12);
  ctx.lineTo(cursor.x, cursor.y + 12);
  ctx.stroke();
  ctx.restore();
}

// ---------------------------------------------------------------------------------------------------------
// Zustände
// ---------------------------------------------------------------------------------------------------------

function handleKeyboardCursor(dt) {
  let mx = 0;
  let my = 0;
  if (isKey('ArrowLeft')) mx -= 1;
  if (isKey('ArrowRight')) mx += 1;
  if (isKey('ArrowUp')) my -= 1;
  if (isKey('ArrowDown')) my += 1;
  const enter = isKey('Enter');
  if (mx || my || enter) cursor.visible = 3;
  else cursor.visible = Math.max(0, cursor.visible - dt);
  cursor.x = Math.max(0, Math.min(1920, cursor.x + mx * SETTINGS.cursorSpeed * dt));
  cursor.y = Math.max(FIELD.y, Math.min(FIELD.y + FIELD.h, cursor.y + my * SETTINGS.cursorSpeed * dt));
  // Enter wirkt wie Laserlicht auf die Belichtungsschicht (über deren Setter)
  if (enter) layer.addInCircle(cursor.x, cursor.y, SETTINGS.cursorRadius, (SETTINGS.lightUp + SETTINGS.lightDown) * dt, 0.3);
}

function handlePlay(grid, dt) {
  const ctx = MasterCanvas.get2dContext();
  gameTime += dt;
  STATS.playTime += dt;
  timeLeft -= dt;
  toolFlash = Math.max(0, toolFlash - dt);
  shake = Math.max(0, shake - dt * 30);

  if (keyPressedOnce('KeyN')) {
    finishLevel(true);
    return;
  }

  // Eingabe: Werkzeugwahl, Unruhe, Belichtung
  drawToolbarBack(ctx);
  vote.handle(grid, dt);
  calm.handle(grid, dt);
  layer.update(grid, dt);
  handleKeyboardCursor(dt);
  const targetPanic = Math.max(0, Math.min(1, (calm.getChaos() - DIFFICULTY.panicFrom) / 0.4));
  panic += (targetPanic - panic) * Math.min(1, dt * 2);

  // Gelände
  markOccupied();
  applyTools(dt);
  dirtyTimer -= dt;
  if (dirty && dirtyTimer <= 0) {
    renderTerrainRect(dirty.c0, dirty.r0, dirty.c1, dirty.r1);
    dirty = null;
    dirtyTimer = 0.05;
  }

  // Luke
  if (spawned < params.walkers) {
    hatch.open = Math.min(1, hatch.open + dt * 2);
    spawnTimer -= dt;
    if (spawnTimer <= 0 && hatch.open >= 1) {
      spawnTimer = params.spawnInterval;
      walkers.push(createWalker(hatch.x + (Math.random() - 0.5) * 10, hatch.y, startDir));
      spawned++;
    }
  } else {
    hatch.open = Math.max(0, hatch.open - dt);
  }

  updateWalkers(grid, dt);
  updateFireflies(dt);
  updateParticles(dt);

  // Zeichnen
  ctx.save();
  if (shake > 0) ctx.translate((Math.random() - 0.5) * shake, (Math.random() - 0.5) * shake);
  drawWorld(ctx);
  ctx.restore();
  drawCursor(ctx);
  drawHud(ctx);
  drawToolbarFront(ctx);
  if (panic > 0.3) {
    ctx.save();
    ctx.globalAlpha = (panic - 0.3) * 0.5;
    ctx.strokeStyle = PAL.hudWarn;
    ctx.lineWidth = 18;
    ctx.strokeRect(9, FIELD.y + 9, 1902, FIELD.h - 18);
    ctx.restore();
  }

  // Levelende
  const need = requiredCount();
  let alive = 0;
  walkers.forEach((w) => {
    if (w.state === 'walk' || w.state === 'fall' || w.state === 'block') alive++;
  });
  const toSpawn = params.walkers - spawned;
  // nur noch Blocker übrig: alle freigeben, damit das Level nicht künstlich hängt
  if (toSpawn === 0 && alive > 0) {
    let free = 0;
    walkers.forEach((w) => {
      if (w.state === 'walk' || w.state === 'fall') free++;
    });
    if (free === 0) {
      walkers.forEach((w) => {
        if (w.state === 'block') w.blockTimer = 0;
      });
    }
  }
  if (!goalAnnounced && savedCount >= need) {
    goalAnnounced = true;
    addText(960, FIELD.y + 200, 'ZIEL ERREICHT – rettet weitere für Bonus!', PAL.good, 50);
  }
  if (endTimer < 0) {
    if (savedCount + alive + toSpawn < need) {
      endTimer = 1.5;
      endSuccess = false;
    } else if (toSpawn === 0 && alive === 0) {
      endTimer = 1.0;
      endSuccess = savedCount >= need;
    } else if (timeLeft <= 0) {
      endTimer = 0.8;
      endSuccess = savedCount >= need;
    }
  } else {
    endTimer -= dt;
    if (endTimer <= 0) finishLevel(endSuccess);
  }
}

function handleIntermission(grid, dt) {
  const ctx = MasterCanvas.get2dContext();
  gameTime += dt;
  interTimer -= dt;
  flash = Math.max(0, flash - dt * 1.5);
  updateFireflies(dt);
  updateParticles(dt);
  drawWorld(ctx);
  drawToolbarBack(ctx);
  drawHud(ctx);
  ctx.save();
  ctx.globalAlpha = 0.6;
  ctx.fillStyle = '#000000';
  ctx.fillRect(0, FIELD.y, 1920, FIELD.h);
  ctx.restore();
  if (flash > 0) {
    ctx.save();
    ctx.globalAlpha = flash * 0.25;
    ctx.fillStyle = PAL.portal;
    ctx.fillRect(0, FIELD.y, 1920, FIELD.h);
    ctx.restore();
  }
  const pulse = 1 + 0.05 * Math.sin(gameTime * 6);
  ctx.save();
  ctx.translate(960, 420);
  ctx.scale(pulse, pulse);
  util.renderTextDropShadow({ ctx, text: interTitle, x: 0, y: 0, fontSize: '150px', fillStyle: PAL.title[4] });
  ctx.restore();
  util.renderTextDropShadow({
    ctx,
    text: interSub,
    x: 960,
    y: 560,
    fontSize: '48px',
    lineHeight: 70,
    fillStyle: PAL.hud,
  });
  util.renderText({
    ctx,
    text: params.walkers + ' Leuchtlinge · ' + Math.round(params.required * 100) + ' % retten · ' + params.timeLimit + ' s',
    x: 960,
    y: 760,
    fontSize: '40px',
    fillStyle: PAL.hudDim,
  });
  if (interTimer <= 0 || keyPressedOnce('Space')) gameState = 'play';
}

function handleStart(grid, dt) {
  const ctx = MasterCanvas.get2dContext();
  gameTime += dt;
  updateFireflies(dt);
  drawFireflies(ctx);

  // animierter Titel (Buchstaben wippen)
  const title = 'LEUCHTLINGE';
  ctx.save();
  ctx.font = 'bold 150px Verdana';
  ctx.textAlign = 'left';
  let total = 0;
  const widths = [];
  for (let k = 0; k < title.length; k++) {
    const wch = ctx.measureText(title[k]).width;
    widths.push(wch);
    total += wch;
  }
  let x = 960 - total / 2;
  for (let k = 0; k < title.length; k++) {
    const y = 250 + Math.sin(gameTime * 2.5 + k * 0.6) * 14;
    ctx.shadowColor = PAL.title[k % PAL.title.length];
    ctx.shadowBlur = 25;
    ctx.fillStyle = PAL.title[k % PAL.title.length];
    ctx.fillText(title[k], x, y);
    x += widths[k];
  }
  ctx.restore();
  util.renderText({
    ctx,
    text: 'Rettet die Leuchtlinge aus der Fraktalhöhle!',
    x: 960,
    y: 350,
    fontSize: '48px',
    fillStyle: PAL.hud,
  });
  util.renderText({
    ctx,
    text: 'Unten per Mehrheit das Werkzeug wählen – im Feld wirkt es aufs Gestein.\nGRABEN · BAUEN · BLOCKEN · SCHIRM   –   und nicht wild herumleuchten!',
    x: 960,
    y: 420,
    fontSize: '34px',
    lineHeight: 46,
    fillStyle: PAL.hudDim,
  });

  startButton.handle(grid, dt);
  util.renderText({ ctx, text: 'anleuchten oder Leertaste', x: 960, y: 800, fontSize: '30px', fillStyle: PAL.hudDim });

  // Parade unten
  if (parade.length === 0) {
    for (let k = 0; k < 7; k++) {
      const w = { x: k * 290, y: 1010, dir: 1, state: 'walk', phase: k, umbrella: k === 3, hue: 0.45 + k * 0.025, scale: 1, panic: 0 };
      walkerColors(w);
      parade.push(w);
    }
  }
  parade.forEach((w) => {
    w.x += 60 * dt;
    w.phase += dt * 6;
    if (w.x > 2000) w.x -= 2080;
    drawWalker(ctx, w);
  });

  if (keyPressedOnce('Space')) startGame();
}

function handleGameOver(grid, dt) {
  const ctx = MasterCanvas.get2dContext();
  gameTime += dt;
  gameOverTime += dt;
  updateFireflies(dt);
  updateParticles(dt);
  drawFireflies(ctx);
  drawParticles(ctx);

  util.renderTextDropShadow({
    ctx,
    text: 'GAME OVER',
    x: 960,
    y: 170,
    fontSize: '150px',
    fillStyle: PAL.title[2],
  });
  const lines = [
    'Level ' + level + ' erreicht  ·  ' + score + ' Punkte',
    'Gerettet: ' + STATS.saved + '   Verloren: ' + STATS.lost + '  (Splat ' + STATS.splat + ', Lava ' + STATS.burned + ', Abgrund ' + STATS.abyss + ')',
    'Gegraben: ' + STATS.dug + '   Gebaut: ' + STATS.built + '   Blocker: ' + STATS.blockers + '   Schirme: ' + STATS.umbrellas,
    'Panik-Anfälle: ' + STATS.panics + '   Spielzeit: ' + Math.round(STATS.playTime) + ' s',
  ];
  lines.forEach((t, k) => {
    util.renderText({ ctx, text: t, x: 960, y: 290 + k * 58, fontSize: k === 0 ? '48px' : '36px', fillStyle: k === 0 ? PAL.hud : PAL.hudDim });
  });

  highscore.renderHighAndLowScores(ctx);

  if (gameOverTime > SETTINGS.gameOverLockTime) {
    gameOverButton.handle(grid, dt);
    util.renderText({ ctx, text: 'anleuchten oder Leertaste', x: 960, y: 960, fontSize: '30px', fillStyle: PAL.hudDim });
    if (keyPressedOnce('Space')) startGame();
  } else {
    keyPressedOnce('Space');
  }
}

// ---------------------------------------------------------------------------------------------------------
// Export
// ---------------------------------------------------------------------------------------------------------

export default {
  name: 'Leuchtlinge',
  description: `
Rettet die Leuchtlinge!

Aus einer Luke purzeln kleine Leuchtlinge und laufen stur geradeaus 
in Abgründe, gegen Wände und in die Lava

Unten wählt ihr per Mehrheit das Werkzeug:

GRABEN: Gestein ableuchten
BAUEN: Lichtbrücke – zerfällt ohne Licht
BLOCKEN: Leuchtling anleuchten: er hält die anderen auf
SCHIRM: Leuchtling anleuchten: er überlebt den tiefen Sturz.

Ruhig zielen! Wildes Herumleuchten versetzt die Leuchtlinge in Panik.
  `,
  image: 'media/img/gametitles/laser-cowhorde-###4###.png',

  init: function () {
    buildPalette();
    resetStats();
    gameState = 'start';
    gameTime = 0;
    level = 1;
    score = 0;
    lives = SETTINGS.lives;
    walkers = [];
    particles = [];
    texts = [];
    fireflies = [];
    parade = [];
    shake = 0;
    flash = 0;
    panic = 0;
    previousKeys = {};
    cursor = { x: 960, y: 500, visible: 0 };
    activeTool = TOOL_DIG;
    params = levelParams(1);

    layer = guiPaintLayer({
      posX: FIELD.x,
      posY: FIELD.y,
      width: FIELD.w,
      height: FIELD.h,
      cellSize: CS,
      speedUp: SETTINGS.lightUp,
      speedDown: SETTINGS.lightDown,
      brushRadius: SETTINGS.lightBrush,
      threshold: 0.5,
      visible: false,
    });
    vote = guiVoteGroup({
      label: '',
      options: TOOL_X.map((x) => ({ x, y: TOOL_Y, label: '' })),
      radius: 62,
      edges: 6,
      speedUp: 70,
      speedDown: 25,
      fullPercent: 25,
      decideValue: 100,
      lockAfterDecide: false,
      showShares: false,
      keyCodes: ['Digit1', 'Digit2', 'Digit3', 'Digit4'],
      normalColor: col(0.5, 0.5, 0.5),
      growColor: col(0.55, 0.7, 0.85),
      activeColor: col(0.6, 0.8, 1),
      onDecide: (i) => setTool(i),
    });
    calm = guiCalmMeter({
      posX: 960,
      posY: FIELD.y + FIELD.h / 2,
      width: FIELD.w,
      height: FIELD.h,
      chaosThreshold: 0.55,
      chaosHoldTime: 0.6,
      smoothing: 3,
      chaosKey: 'KeyP',
      visible: false,
      onChaos: () => {
        STATS.panics++;
        shake = Math.max(shake, 12);
        addText(960, FIELD.y + 260, 'PANIK! Ruhiger leuchten!', PAL.hudWarn, 56);
      },
    });
    startButton = guiFillButton({
      label: 'START',
      posX: 960,
      posY: 640,
      radius: 110,
      edges: 8,
      speedUp: 60,
      speedDown: 30,
      normalColor: PAL.button[0],
      growColor: PAL.button[1],
      activeColor: PAL.button[2],
      onEnterActive: () => {
        if (gameState === 'start') startGame();
      },
    });
  },

  handle: function (grid, elapsed) {
    const dt = Math.min(Math.max(elapsed || 0, 0), 0.1);
    switch (gameState) {
      case 'start':
        handleStart(grid, dt);
        break;
      case 'levelup':
        handleIntermission(grid, dt);
        break;
      case 'play':
        handlePlay(grid, dt);
        break;
      case 'gameover':
        handleGameOver(grid, dt);
        break;
    }
  },

  stop: function () {
    activeSounds.forEach((a) => {
      try {
        a.pause();
      } catch (e) {
        // ignorieren
      }
    });
    activeSounds = [];
    walkers = [];
    particles = [];
  },
};
