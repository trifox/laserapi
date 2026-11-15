/**
 * Wortlicht – Buchstabengitter für viele Laser
 *
 * Im Gitter sind Wörter versteckt (waagerecht, senkrecht, später rückwärts und diagonal).
 * Ein Wort ist gefunden, wenn ALLE seine Buchstaben innerhalb eines Zeitfensters angeleuchtet wurden –
 * lange Wörter schafft man am besten gemeinsam (mehrere Laser auf verschiedene Buchstaben).
 * Zufallsfunde (andere Wörter aus dem Wörterbuch) zählen als Bonus.
 *
 * Varianten (Auswahl auf dem Startscreen):
 * 1. Klassisch     – alle Wörter der Liste finden, gefundene bleiben markiert.
 * 2. Lösungswort   – gefundene Wörter verschwinden, die übrigen Buchstaben ergeben das Lösungswort.
 * 3. Nachrutschen  – gefundene Buchstaben verschwinden, neue fallen von oben nach und bilden mit den
 *                    Nachbarn neue Wörter. Ziel: eine Anzahl Wörter finden.
 * 4. Wortlinks     – gefundene Wörter werden Links. Lange genug anleuchten = Wechsel auf ein anderes
 *                    Spielfeld (Thema). Themen-Namen im Gitter führen zu genau diesem Thema.
 *
 * Strafe fürs Wischen: werden in kurzer Zeit zu viele Buchstaben neu angeleuchtet, ist das Gitter
 * ÜBERBELICHTET – alles Angeleuchtete erlischt, es kostet Zeit und das Gitter ist kurz blind.
 *
 * Level: Zeitlimit pro Spielfeld (gefundene Wörter geben Zeit dazu). Mit jedem Level wird das Gitter
 * grösser, es kommen Richtungen dazu (Level 2: rückwärts/hoch, Level 3+: diagonal) und das
 * Zeitfenster wird kürzer.
 *
 * Eingabe: ein unsichtbarer gui/pixelFillButton pro Buchstabe, bei Wortlinks einer pro Link.
 *
 * Tastatur-Test: Space/1 = Klassisch, 2 = Lösungswort, 3 = Nachrutschen, 4 = Wortlinks,
 *                F = nächstes Wort finden, J = ersten Link benutzen, L = Level überspringen.
 *
 * Alle Stellschrauben stehen gesammelt in DIFFICULTY.
 */

import util, { getRgbSpreadHex, removeItemFromArray } from '../util.js';
var laserConfig = require('../LaserApiConfig.js').default;
var MasterCanvas = require('../MasterCanvas').default;
var guiFillButton = require('./gui/fillButton').default;
var guiPixelFillButton = require('./gui/pixelFillButton').default;
import soundPop from '../../../public/media/369952__mischy__plop-1.wav';
import soundBoom from '../../../public/media/414346__bykgames__explosion-far.wav';
import soundLevel from '../../../public/media/521966__kastenfrosch__ready-to-start-jingle.ogg';
import soundTravel from '../../../public/media/496199__luminousfridge__player-spawned.ogg';

const DIFFICULTY = {
  // Gittergrössen pro Level (Spalten, Zeilen); danach bleibt die letzte
  gridSizes: [
    [12, 7],
    [14, 8],
    [16, 9],
    [18, 10],
  ],
  reverseLevel: 2, // ab hier auch rückwärts und von unten nach oben
  diagonalLevel: 3, // ab hier diagonal (vorwärts)
  allDirectionsLevel: 4, // ab hier alle 8 Richtungen
  // Zeitfenster, in dem alle Buchstaben eines Wortes angeleuchtet sein müssen
  windowStart: 10.0,
  windowPerLevel: 0.25,
  windowMin: 1.6,
  windowPerLetter: 0.3,
  // Buchstaben-Erkennung (pixelFillButton pro Zelle)
  cellFullPercent: 20,
  cellFillTime: 0.35, // Sekunden bei voller Bedeckung bis der Buchstabe als angeleuchtet zählt
  // Überbelichtung (Strafe fürs Wischen)
  overexposeWindow: 1.5, // Sekunden
  overexposeFactor: 0.15, // Anteil der Zellen, die in diesem Fenster neu angeleuchtet werden dürfen
  overexposeMin: 16,
  overexposePenalty: 5, // Sekunden Zeitabzug
  blindDuration: 2,
  // Zeit
  timeBase: 90,
  timePerWord: 12,
  timeBonusPerFind: 6,
  // Wörter pro Spielfeld
  targetsStart: 6,
  targetsPerLevel: 1,
  targetsMax: 12,
  minWordLength: 4,
  // Nachrutschen
  refillGoalStart: 6,
  refillGoalPerLevel: 2,
  refillMinCandidates: 5,
  refillTime: 150,
  hintAfter: 20, // Sekunden ohne Fund, dann blinkt ein Hinweis
  // Lösungswort
  solutionMaxWords: 30, // so viele Wörter höchstens (Seitenleiste zweispaltig)
  // Wortlinks
  linkHoldTime: 2.5,
  linkMinFound: 3, // so viele Wörter müssen gefunden sein, bevor ein Link funktioniert
  linkThemeNames: 2, // so viele Themen-Namen werden pro Spielfeld versteckt
  // Punkte
  scorePerLetter: 10,
  bonusPerLetter: 5,
  maxParticles: 400,
};

const MODES = {
  classic: { name: 'Klassisch', key: 'Digit1' },
  solution: { name: 'Lösungswort', key: 'Digit2' },
  refill: { name: 'Nachrutschen', key: 'Digit3' },
  links: { name: 'Wortlinks', key: 'Digit4' },
};

const THEMES = {
  TIERE: ['HUND', 'KATZE', 'PFERD', 'MAUS', 'LÖWE', 'TIGER', 'ZEBRA', 'HASE', 'IGEL', 'ADLER', 'ESEL', 'AFFE', 'BIENE', 'WOLF', 'FUCHS', 'EULE'],
  MEER: ['FISCH', 'QUALLE', 'KRABBE', 'MUSCHEL', 'WELLE', 'STRAND', 'ANKER', 'SCHIFF', 'INSEL', 'MÖWE', 'KORALLE', 'DELFIN', 'HAFEN', 'BOJE'],
  ESSEN: ['BROT', 'KÄSE', 'APFEL', 'BIRNE', 'NUDEL', 'SUPPE', 'PIZZA', 'KUCHEN', 'HONIG', 'BUTTER', 'MILCH', 'WURST', 'SALAT', 'KEKS'],
  WETTER: ['REGEN', 'SONNE', 'WOLKE', 'BLITZ', 'DONNER', 'NEBEL', 'SCHNEE', 'STURM', 'HAGEL', 'FROST', 'WIND', 'HITZE', 'GEWITTER'],
  WELTALL: ['STERN', 'MOND', 'PLANET', 'KOMET', 'RAKETE', 'SATURN', 'MARS', 'VENUS', 'GALAXIE', 'ORBIT', 'SONDE', 'KRATER'],
  MUSIK: ['GITARRE', 'TROMMEL', 'GEIGE', 'FLÖTE', 'KLAVIER', 'NOTE', 'TAKT', 'BASS', 'CHOR', 'LIED', 'HARFE', 'ORGEL', 'TUBA'],
  SPORT: ['TENNIS', 'FUSSBALL', 'LAUFEN', 'SPRINT', 'BOXEN', 'RUDERN', 'TURNEN', 'POKAL', 'TRAINER', 'TRIKOT', 'SIEG', 'TORWART'],
  GARTEN: ['BLUME', 'ROSE', 'TULPE', 'BAUM', 'GRAS', 'BEET', 'ZAUN', 'HECKE', 'SPATEN', 'SAMEN', 'KAKTUS', 'WURZEL', 'MOOS'],
  LASER: ['LICHT', 'STRAHL', 'PUNKT', 'KAMERA', 'PIXEL', 'FARBE', 'SPIEGEL', 'LINSE', 'PHOTON', 'BEAMER', 'LEUCHTE', 'GLANZ'],
  STADT: ['HAUS', 'STRASSE', 'BRÜCKE', 'TURM', 'KIRCHE', 'MARKT', 'PARK', 'SCHULE', 'BAHNHOF', 'AMPEL', 'KINO', 'MUSEUM'],
};

// zusätzliche Alltagswörter für Zufallsfunde
const EXTRA_WORDS = [
  'ABER', 'ALLE', 'AUTO', 'BALL', 'BERG', 'BILD', 'BUCH', 'DACH', 'DORF', 'EIS', 'ENDE', 'ERDE', 'FELD', 'FEST',
  'GOLD', 'HAND', 'HERZ', 'HOSE', 'HUT', 'KERN', 'KIND', 'KOPF', 'LAND', 'LAMPE', 'LIEBE', 'LUFT', 'NASE', 'NEST',
  'OBST', 'OPER', 'RAD', 'RAND', 'REIS', 'RING', 'ROT', 'SAND', 'SEIL', 'SEE', 'TANZ', 'TEE', 'TIER', 'TISCH',
  'TRAUM', 'UHR', 'WALD', 'WAND', 'WEG', 'WELT', 'ZAHL', 'ZEIT', 'ZELT', 'NEIN', 'NETZ', 'NUSS', 'RASEN', 'REISE',
  'ROSA', 'SALZ', 'SEELE', 'SINN', 'STEIN', 'STERNE', 'TEIL', 'TOR', 'TREUE', 'ESSEN', 'LESEN', 'RENNEN', 'SINGEN',
  'NASS', 'RIESE', 'ENTE', 'ERBSE', 'LIED', 'NADEL', 'RAUM', 'TANNE', 'TINTE', 'TONNE', 'TRESEN', 'ADER', 'ASSE',
];

const SOLUTIONS = [
  'TOLL', 'SUPER', 'BRAVO', 'PRIMA', 'STARK', 'HURRA', 'KLASSE', 'SPITZE', 'GENIAL', 'LÖSUNG', 'SCHATZ', 'MEISTER',
  'TREFFER', 'TEAMWORK', 'GEWONNEN', 'GEMEINSAM', 'WUNDERBAR', 'GEHEIMNIS', 'LASERSPIEL', 'LICHTBLICK', 'BUCHSTABEN',
  'WORTSCHATZ', 'VOLLTREFFER', 'FANTASTISCH', 'HERVORRAGEND', 'SENSATIONELL', 'AUSGEZEICHNET', 'GLANZLEISTUNG',
  'ABSOLUTSPITZE', 'LEUCHTSTRAHLEN',
];

// Buchstabenhäufigkeit (grob deutsch) für Füllbuchstaben
const LETTER_FREQ = 'EEEEEEEENNNNNIIIIISSSSRRRRAAAAATTTTDDDHHHUUULLLCCGGMMOOBBWFKZPVÜÄÖJ';

const DIRS_ALL = [
  [1, 0], // rechts
  [0, 1], // runter
  [-1, 0], // links
  [0, -1], // hoch
  [1, 1],
  [1, -1],
  [-1, 1],
  [-1, -1],
];

const W = 1920;
const H = 1080;
const GRID_X = 40;
const GRID_Y = 120;
const GRID_W = 1450;
const GRID_H = 930;
const SIDE_X = 1530;

var DICT = new Set();
(function buildDict() {
  Object.keys(THEMES).forEach((t) => {
    DICT.add(t);
    THEMES[t].forEach((w) => DICT.add(w));
  });
  EXTRA_WORDS.forEach((w) => DICT.add(w));
})();

// --- Zustand ---
var gameState = 'start';
var mode = 'classic';
var level = 1;
var score = 0;
var gameTime = 0;
var stateTime = 0;
var timeLeft = 0;
var theme = 'TIERE';
var visitedThemes = [];
var cols = 12;
var rows = 7;
var cs = 100; // Zellgrösse
var gx0 = 0;
var gy0 = 0;
var cells = []; // [r][c]
var targets = [];
var candidates = [];
var foundWords = [];
var bonusFound = new Set();
var links = [];
var solution = '';
var refillFound = 0;
var refillPending = -1;
var settleTimer = 0;
var hintTimer = 0;
var hintCandidate = null;
var activations = [];
var blindTimer = 0;
var nextTheme = null;
var levelupText = '';
var particles = [];
var floatingTexts = [];
var bgLetters = [];
var shake = 0;
var flash = 0;
var buttonsStart = [];
var buttonsGameOver = [];
var stats = { words: 0, bonus: 0, letters: 0, overexposed: 0, boards: 0 };
var previousKeys = {};
var lastTime = 0;
var activeSounds = [];
var sprites = {};
var glyphCache = {};

// --- Farben (alle aus testColor abgeleitet, nie die reine Laserfarbe) ---
var COL = {};
function updateColors() {
  const c = laserConfig.testColor;
  COL = {
    bg1: getRgbSpreadHex(c, 0.6, 0.6, 0.07),
    bg2: getRgbSpreadHex(c, 0.52, 0.6, 0.2),
    tile: getRgbSpreadHex(c, 0.55, 0.45, 0.18),
    tileEdge: getRgbSpreadHex(c, 0.55, 0.5, 0.25),
    hot: getRgbSpreadHex(c, 0.4, 0.85, 1),
    found: getRgbSpreadHex(c, 0.3, 0.6, 0.95),
    link: getRgbSpreadHex(c, 0.2, 0.7, 1),
    letter: getRgbSpreadHex(c, 0.5, 0.1, 1),
    letterDark: getRgbSpreadHex(c, 0.55, 0.7, 0.15),
    text: getRgbSpreadHex(c, 0.45, 0.35, 1),
    textDim: getRgbSpreadHex(c, 0.5, 0.3, 0.6),
    textHi: getRgbSpreadHex(c, 0.35, 0.8, 1),
    bad: getRgbSpreadHex(c, 0.65, 0.9, 1),
    bgLetter: getRgbSpreadHex(c, 0.55, 0.5, 0.35),
  };
}

function lineColor(i) {
  return getRgbSpreadHex(laserConfig.testColor, 0.25 + ((i * 0.13) % 0.5), 0.7, 1);
}

// --- Hilfsfunktionen ---
function getDelta() {
  const now = performance.now();
  if (lastTime === 0) {
    lastTime = now;
    return 0;
  }
  const elapsed = (now - lastTime) / 1000;
  lastTime = now;
  return Math.min(elapsed, 0.1);
}

function keyPressedOnce(code) {
  const down = !!laserConfig.pressedKeys[code];
  const was = !!previousKeys[code];
  previousKeys[code] = down;
  return down && !was;
}

function playSound(snd, volume = 1) {
  const audio = new Audio(snd);
  audio.volume = volume;
  activeSounds.push(audio);
  audio.addEventListener('ended', () => removeItemFromArray(activeSounds, audio));
  audio.play().catch(() => {});
}

function shuffle(arr) {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function randomLetter() {
  return LETTER_FREQ[Math.floor(Math.random() * LETTER_FREQ.length)];
}

function addFloatingText(text, x, y, color, size = 44) {
  floatingTexts.push({ text, x, y, color, size, time: 0, duration: 1.5 });
}

function burst(x, y, color, count = 16, speed = 300) {
  for (let i = 0; i < count && particles.length < DIFFICULTY.maxParticles; i++) {
    const a = Math.random() * Math.PI * 2;
    const s = speed * (0.3 + Math.random() * 0.7);
    particles.push({
      x,
      y,
      vx: Math.cos(a) * s,
      vy: Math.sin(a) * s,
      life: 0,
      maxLife: 0.5 + Math.random() * 0.6,
      size: 5 + Math.random() * 8,
      color,
    });
  }
}

function cellCenter(r, c) {
  return { x: gx0 + c * cs + cs / 2, y: gy0 + r * cs + cs / 2 };
}

function windowFor(len) {
  const base = Math.max(DIFFICULTY.windowMin, DIFFICULTY.windowStart - DIFFICULTY.windowPerLevel * (level - 1));
  return base + DIFFICULTY.windowPerLetter * len;
}

function allowedDirs() {
  if (level >= DIFFICULTY.allDirectionsLevel) return DIRS_ALL;
  if (level >= DIFFICULTY.diagonalLevel) return DIRS_ALL.slice(0, 6);
  if (level >= DIFFICULTY.reverseLevel) return DIRS_ALL.slice(0, 4);
  return DIRS_ALL.slice(0, 2);
}

// --- Vorrendern ---
function makeCanvas(w, h) {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  return c;
}

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

function renderTile(size, fill, edge) {
  const c = makeCanvas(size, size);
  const ctx = c.getContext('2d');
  const grad = ctx.createLinearGradient(0, 0, 0, size);
  grad.addColorStop(0, fill);
  grad.addColorStop(1, edge);
  ctx.fillStyle = grad;
  roundRect(ctx, 3, 3, size - 6, size - 6, size * 0.18);
  ctx.fill();
  ctx.strokeStyle = edge;
  ctx.lineWidth = 3;
  ctx.stroke();
  return c;
}

function renderSprites() {
  const s = cs - 6;
  sprites = {
    tile: renderTile(s, COL.tile, COL.tileEdge),
    hot: renderTile(s, COL.hot, COL.tile),
    found: renderTile(s, COL.found, COL.tileEdge),
    link: renderTile(s, COL.link, COL.found),
  };
  glyphCache = {};
  const bg = makeCanvas(W, H);
  const ctx = bg.getContext('2d');
  const grad = ctx.createRadialGradient(W / 2, H / 2, 100, W / 2, H / 2, W * 0.7);
  grad.addColorStop(0, COL.bg2);
  grad.addColorStop(1, COL.bg1);
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, W, H);
  sprites.bg = bg;
}

function glyph(letter, color) {
  const key = letter + color + cs;
  if (!glyphCache[key]) {
    const size = cs;
    const c = makeCanvas(size, size);
    const ctx = c.getContext('2d');
    ctx.fillStyle = color*0.4;
    ctx.strokeStyle = color;
    ctx.font = `bold ${Math.floor(size * 0.6)}px Verdana`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    ctx.fillText(letter, size / 2, size / 2 + size * 0.04);
    ctx.strokeText(letter, size / 2, size / 2 + size * 0.04);
    glyphCache[key] = c;
  }
  return glyphCache[key];
}

// --- Spielfeld erzeugen ---
function emptyGrid() {
  const g = [];
  for (let r = 0; r < rows; r++) g.push(new Array(cols).fill(null));
  return g;
}

/** sucht eine Position für word, nur leere Zellen oder gleiche Buchstaben; gibt Zellliste oder null */
function placeWord(g, word, dirs, tries = 300) {
  const letters = Array.from(word);
  const len = letters.length;
  for (let t = 0; t < tries; t++) {
    const [dx, dy] = dirs[Math.floor(Math.random() * dirs.length)];
    const c0 = Math.floor(Math.random() * cols);
    const r0 = Math.floor(Math.random() * rows);
    const c1 = c0 + dx * (len - 1);
    const r1 = r0 + dy * (len - 1);
    if (c1 < 0 || c1 >= cols || r1 < 0 || r1 >= rows) continue;
    let ok = true;
    let overlap = 0;
    for (let i = 0; i < len; i++) {
      const v = g[r0 + dy * i][c0 + dx * i];
      if (v !== null && v !== letters[i]) {
        ok = false;
        break;
      }
      if (v !== null) overlap++;
    }
    if (!ok || overlap === len) continue;
    const list = [];
    for (let i = 0; i < len; i++) {
      g[r0 + dy * i][c0 + dx * i] = letters[i];
      list.push([r0 + dy * i, c0 + dx * i]);
    }
    return list;
  }
  return null;
}

function countEmpty(g) {
  let n = 0;
  g.forEach((row) => row.forEach((v) => (v === null ? n++ : 0)));
  return n;
}

function targetCount() {
  return Math.min(DIFFICULTY.targetsMax, DIFFICULTY.targetsStart + DIFFICULTY.targetsPerLevel * (level - 1));
}

function fitWords(list) {
  const maxLen = Math.max(cols, rows);
  return list.filter((w) => Array.from(w).length <= maxLen && Array.from(w).length >= DIFFICULTY.minWordLength);
}

function generateBoard() {
  const dirs = allowedDirs();
  for (let attempt = 0; attempt < 40; attempt++) {
    const g = emptyGrid();
    const placed = [];
    let pool = shuffle(fitWords(THEMES[theme])).slice(0, targetCount());
    if (mode === 'links') {
      const others = shuffle(Object.keys(THEMES).filter((t) => t !== theme));
      pool = pool.slice(0, Math.max(3, targetCount() - DIFFICULTY.linkThemeNames));
      pool = pool.concat(fitWords(others).slice(0, DIFFICULTY.linkThemeNames));
    }
    pool.sort((a, b) => b.length - a.length);
    pool.forEach((w) => {
      const cellsOfWord = placeWord(g, w, dirs);
      if (cellsOfWord) placed.push({ word: w, cells: cellsOfWord, found: false, target: true });
    });
    let sol = '';
    if (mode === 'solution') {
      // weitere Wörter einbauen, bis genau so viele Lücken übrig sind wie ein Lösungswort Buchstaben hat
      const extra = shuffle(fitWords(Array.from(DICT)).filter((w) => !placed.some((p) => p.word === w)));
      for (const w of extra) {
        if (countEmpty(g) <= 14 || placed.length >= DIFFICULTY.solutionMaxWords) break;
        const cellsOfWord = placeWord(g, w, dirs, 60);
        if (cellsOfWord) placed.push({ word: w, cells: cellsOfWord, found: false, target: true });
      }
      const empty = countEmpty(g);
      if (empty < 4) continue;
      // längstes passendes Lösungswort; überzählige freie Felder werden Lücken ('#')
      const maxLen = Math.max(...SOLUTIONS.map((x) => Array.from(x).length).filter((l) => l <= empty));
      const fitting = SOLUTIONS.filter((x) => Array.from(x).length === maxLen);
      sol = fitting[Math.floor(Math.random() * fitting.length)];
      const solLetters = Array.from(sol);
      const L = solLetters.length;
      const solIndex = new Set();
      for (let i = 0; i < L; i++) solIndex.add(Math.floor(((i + 0.5) * empty) / L));
      let k = 0;
      let e = 0;
      for (let r = 0; r < rows; r++) {
        for (let c = 0; c < cols; c++) {
          if (g[r][c] !== null) continue;
          g[r][c] = solIndex.has(e) ? solLetters[k++] : '#';
          e++;
        }
      }
    } else {
      for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) if (g[r][c] === null) g[r][c] = randomLetter();
    }
    if (placed.length >= 3) return { grid: g, targets: placed, solution: sol };
  }
  // Notfall (sollte praktisch nicht vorkommen): Klassik-Feld ohne Lösungswort
  const g = emptyGrid();
  const placed = [];
  fitWords(THEMES[theme]).forEach((w) => {
    const cl = placeWord(g, w, allowedDirs());
    if (cl) placed.push({ word: w, cells: cl, found: false, target: true });
  });
  for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) if (g[r][c] === null) g[r][c] = randomLetter();
  return { grid: g, targets: placed, solution: '' };
}

/** alle Wörterbuch-Wörter im aktuellen Gitter (erlaubte Richtungen) */
function scanDictionary() {
  const dirs = allowedDirs();
  const result = [];
  const maxLen = 9;
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      if (cells[r][c].removed) continue;
      dirs.forEach(([dx, dy]) => {
        let s = '';
        const list = [];
        for (let i = 0; i < maxLen; i++) {
          const rr = r + dy * i;
          const cc = c + dx * i;
          if (rr < 0 || rr >= rows || cc < 0 || cc >= cols || cells[rr][cc].removed) break;
          s += cells[rr][cc].letter;
          list.push([rr, cc]);
          if (list.length >= DIFFICULTY.minWordLength && DICT.has(s)) {
            result.push({ word: s, cells: list.slice(), found: false, target: false });
          }
        }
      });
    }
  }
  return result;
}

function rebuildCandidates() {
  if (mode === 'solution') {
    candidates = targets;
  } else if (mode === 'refill') {
    candidates = scanDictionary();
  } else {
    const targetWords = new Set(targets.map((t) => t.word));
    candidates = targets.concat(scanDictionary().filter((c) => !targetWords.has(c.word)));
  }
}

function createCell(r, c, letter) {
  const { x, y } = cellCenter(r, c);
  const cell = {
    r,
    c,
    letter,
    litAt: -100,
    isLit: false,
    found: 0,
    removed: false,
    vanish: 0,
    offsetY: 0,
    flash: 0,
    hole: letter === '#',
    button: guiPixelFillButton({
      label: '',
      posX: x,
      posY: y,
      radius: cs * 0.42,
      edges: 4,
      fullPercent: DIFFICULTY.cellFullPercent,
      speedUp: 100 / DIFFICULTY.cellFillTime,
      speedDown: 300,
      minValue: 1,
      activeValue: 99,
      visible: false,
    }),
  };
  if (cell.hole) {
    cell.removed = true;
    cell.vanish = 1;
  }
  return cell;
}

function startBoard() {
  const idx = Math.min(level - 1, DIFFICULTY.gridSizes.length - 1);
  [cols, rows] = DIFFICULTY.gridSizes[idx];
  cs = Math.floor(Math.min(GRID_W / cols, GRID_H / rows));
  gx0 = GRID_X + (GRID_W - cols * cs) / 2;
  gy0 = GRID_Y + (GRID_H - rows * cs) / 2;
  renderSprites();
  const board = generateBoard();
  targets = board.targets;
  solution = board.solution;
  cells = [];
  for (let r = 0; r < rows; r++) {
    const row = [];
    for (let c = 0; c < cols; c++) row.push(createCell(r, c, board.grid[r][c]));
    cells.push(row);
  }
  foundWords = [];
  bonusFound = new Set();
  links = [];
  refillFound = 0;
  refillPending = -1;
  settleTimer = 0.5;
  hintTimer = 0;
  hintCandidate = null;
  activations = [];
  blindTimer = 0;
  rebuildCandidates();
  if (mode === 'refill') ensureCandidates();
  timeLeft =
    mode === 'refill'
      ? DIFFICULTY.refillTime
      : DIFFICULTY.timeBase + DIFFICULTY.timePerWord * targets.length;
  if (!visitedThemes.includes(theme)) visitedThemes.push(theme);
  stats.boards++;
  gameState = 'game';
  stateTime = 0;
}

function pickTheme() {
  const fresh = Object.keys(THEMES).filter((t) => !visitedThemes.includes(t));
  const pool = fresh.length ? fresh : Object.keys(THEMES).filter((t) => t !== theme);
  return pool[Math.floor(Math.random() * pool.length)];
}

// --- Funde ---
function cellsOf(cand) {
  return cand.cells.map(([r, c]) => cells[r][c]);
}

function checkCandidates() {
  if (blindTimer > 0 || settleTimer > 0 || refillPending >= 0) return;
  for (const cand of candidates) {
    if (cand.found) continue;
    if (cand.cells.some(([r, c]) => cells[r][c].removed)) continue;
    if (!cand.target && bonusFound.has(cand.word) && mode !== 'refill') continue;
    const win = windowFor(cand.cells.length);
    const all = cand.cells.every(([r, c]) => gameTime - cells[r][c].litAt <= win);
    if (all) {
      onFound(cand);
      if (gameState !== 'game' || refillPending >= 0) return;
    }
  }
}

function onFound(cand) {
  cand.found = true;
  const len = cand.cells.length;
  const isBonus = !cand.target && mode !== 'refill';
  const points = len * (isBonus ? DIFFICULTY.bonusPerLetter : DIFFICULTY.scorePerLetter);
  score += points;
  timeLeft += DIFFICULTY.timeBonusPerFind;
  stats.words++;
  stats.letters += len;
  if (isBonus) {
    stats.bonus++;
    bonusFound.add(cand.word);
  }
  hintTimer = 0;
  hintCandidate = null;
  const color = lineColor(foundWords.length);
  foundWords.push({ word: cand.word, cells: cand.cells, color, bonus: isBonus });
  const first = cellCenter(cand.cells[0][0], cand.cells[0][1]);
  const last = cellCenter(cand.cells[len - 1][0], cand.cells[len - 1][1]);
  const mid = { x: (first.x + last.x) / 2, y: (first.y + last.y) / 2 };
  addFloatingText(`${cand.word} +${points}`, mid.x, mid.y - cs * 0.6, isBonus ? COL.textHi : COL.found, 54);
  cellsOf(cand).forEach((cell) => {
    const p = cellCenter(cell.r, cell.c);
    burst(p.x, p.y, color, 6, 280);
    cell.litAt = -100;
  });
  flash = Math.max(flash, 0.25);
  playSound(soundPop, 0.6);

  if (mode === 'classic' || mode === 'links') {
    cellsOf(cand).forEach((cell) => cell.found++);
    if (mode === 'links') createLink(cand, mid);
    if (mode === 'classic' && targets.every((t) => t.found)) {
      startLevelUp(`Alle ${targets.length} Wörter gefunden!`);
    }
  } else if (mode === 'solution') {
    cellsOf(cand).forEach((cell) => {
      const stillNeeded = targets.some((t) => !t.found && t.cells.some(([r, c]) => r === cell.r && c === cell.c));
      if (!stillNeeded && !cell.removed) {
        cell.removed = true;
        cell.vanish = 0;
      }
    });
    if (targets.every((t) => t.found)) {
      gameState = 'reveal';
      stateTime = 0;
      playSound(soundLevel, 0.8);
    }
  } else if (mode === 'refill') {
    cellsOf(cand).forEach((cell) => {
      cell.removed = true;
      cell.vanish = 0;
    });
    refillFound++;
    refillPending = 0.45;
    if (refillFound >= refillGoal()) {
      startLevelUp(`${refillFound} Wörter gefunden!`);
    }
  }
}

function refillGoal() {
  return DIFFICULTY.refillGoalStart + DIFFICULTY.refillGoalPerLevel * (level - 1);
}

// --- Nachrutschen ---
function doRefill() {
  for (let c = 0; c < cols; c++) {
    const kept = [];
    for (let r = rows - 1; r >= 0; r--) {
      if (!cells[r][c].removed) kept.push({ letter: cells[r][c].letter, fromRow: r });
    }
    const missing = rows - kept.length;
    for (let r = rows - 1, k = 0; r >= 0; r--, k++) {
      const cell = cells[r][c];
      cell.removed = false;
      cell.vanish = 0;
      cell.found = 0;
      cell.litAt = -100;
      if (k < kept.length) {
        cell.letter = kept[k].letter;
        cell.offsetY = -(r - kept[k].fromRow) * cs;
      } else {
        cell.letter = randomLetter();
        cell.offsetY = -missing * cs - 40;
      }
    }
  }
  hintCandidate = null;
  hintTimer = 0;
  rebuildCandidates();
  ensureCandidates();
  settleTimer = 0.5;
}

/** sorgt dafür, dass genug Wörter im Gitter stecken: pflanzt bei Bedarf neue ein (glitzern kurz auf) */
function ensureCandidates() {
  let tries = 0;
  while (candidates.length < DIFFICULTY.refillMinCandidates && tries < 20) {
    tries++;
    const g = cells.map((row) => row.map(() => null));
    const word = shuffle(fitWords(THEMES[theme].concat(EXTRA_WORDS)))[0];
    const placed = placeWord(g, word, allowedDirs(), 50);
    if (!placed) continue;
    placed.forEach(([r, c], i) => {
      cells[r][c].letter = Array.from(word)[i];
      cells[r][c].flash = 1;
    });
    rebuildCandidates();
  }
}

// --- Wortlinks ---
function createLink(cand, mid) {
  const target = THEMES[cand.word] && cand.word !== theme ? cand.word : pickTheme();
  const link = {
    word: cand.word,
    target,
    x: mid.x,
    y: mid.y,
    button: null,
  };
  link.button = guiPixelFillButton({
    label: '',
    posX: mid.x,
    posY: mid.y,
    radius: Math.max(55, cs * 0.8),
    edges: 16,
    fullPercent: 30,
    speedUp: 100 / DIFFICULTY.linkHoldTime,
    speedDown: 40,
    minValue: 1,
    activeValue: 99,
    counterReset: true,
    visible: false,
    onEnterActive: () => useLink(link),
  });
  links.push(link);
}

function useLink(link) {
  if (gameState !== 'game') return;
  const foundCount = foundWords.length;
  if (foundCount < DIFFICULTY.linkMinFound) {
    addFloatingText(`Erst ${DIFFICULTY.linkMinFound} Wörter finden!`, link.x, link.y - cs, COL.bad, 44);
    return;
  }
  nextTheme = link.target;
  playSound(soundTravel, 0.8);
  burst(link.x, link.y, COL.link, 60, 600);
  startLevelUp(`Link: ${link.word}  →  ${link.target}`);
}

// --- Level ---
function startLevelUp(text) {
  gameState = 'levelup';
  stateTime = 0;
  flash = 1;
  levelupText = text;
  if (mode !== 'links') playSound(soundLevel, 0.8);
}

function nextLevel() {
  level++;
  theme = mode === 'links' && nextTheme ? nextTheme : pickTheme();
  nextTheme = null;
  startBoard();
}

function newElementText(lvl) {
  if (lvl === DIFFICULTY.reverseLevel) return 'NEU: Wörter auch rückwärts und von unten nach oben!';
  if (lvl === DIFFICULTY.diagonalLevel) return 'NEU: Wörter auch diagonal!';
  if (lvl === DIFFICULTY.allDirectionsLevel) return 'NEU: Alle Richtungen – und das grösste Gitter!';
  return 'Weniger Zeit pro Wort …';
}

function gameOver() {
  gameState = 'gameover';
  stateTime = 0;
  buttonsGameOver = createModeButtons();
  playSound(soundBoom, 0.7);
}

// --- Überbelichtung ---
function overexpose() {
  stats.overexposed++;
  blindTimer = DIFFICULTY.blindDuration;
  timeLeft -= DIFFICULTY.overexposePenalty;
  shake = 0.5;
  activations = [];
  cells.forEach((row) => row.forEach((cell) => (cell.litAt = -100)));
  addFloatingText(`ÜBERBELICHTET!  −${DIFFICULTY.overexposePenalty}s`, gx0 + (cols * cs) / 2, H / 2, COL.bad, 80);
  playSound(soundBoom, 0.6);
}

// --- Eingabe pro Frame ---
function handleCells(grid, elapsed) {
  const threshold = Math.max(DIFFICULTY.overexposeMin, Math.round(cols * rows * DIFFICULTY.overexposeFactor));
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const cell = cells[r][c];
      if (cell.removed) continue;
      cell.button.handle(grid, elapsed);
      const lit = cell.button.getValue() >= 50;
      if (blindTimer <= 0 && lit) {
        if (!cell.isLit && gameTime - cell.litAt > 1) activations.push(gameTime);
        cell.litAt = gameTime;
      }
      cell.isLit = lit;
    }
  }
  while (activations.length && gameTime - activations[0] > DIFFICULTY.overexposeWindow) activations.shift();
  if (activations.length > threshold) overexpose();
}

// --- Zeichnen ---
function renderBackground(ctx, elapsed) {
  ctx.drawImage(sprites.bg, 0, 0);
  // treibende Hintergrund-Buchstaben
  ctx.save();
  ctx.fillStyle = COL.bgLetter;
  bgLetters.forEach((b) => {
    b.y -= b.speed * elapsed;
    if (b.y < -100) {
      b.y = H + 100;
      b.x = Math.random() * W;
    }
    ctx.globalAlpha = b.alpha;
    ctx.font = `bold ${b.size}px Verdana`;
    ctx.textAlign = 'center';
    ctx.fillText(b.letter, b.x + Math.sin(gameTime * 0.5 + b.seed) * 30, b.y);
  });
  ctx.restore();
}

function renderGrid(ctx, elapsed) {
  const s = cs - 6;
  const heatWin = windowFor(5);
  // Fundlinien (Klassisch / Links) unter den Buchstaben
  if (mode === 'classic' || mode === 'links') {
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    ctx.lineCap = 'round';
    foundWords.forEach((f) => {
      const a = cellCenter(f.cells[0][0], f.cells[0][1]);
      const b = cellCenter(f.cells[f.cells.length - 1][0], f.cells[f.cells.length - 1][1]);
      ctx.strokeStyle = f.color;
      ctx.globalAlpha = 0.25;
      ctx.lineWidth = cs * 0.95;
      ctx.beginPath();
      ctx.moveTo(a.x, a.y);
      ctx.lineTo(b.x, b.y);
      ctx.stroke();
    });
    ctx.restore();
  }
  const linkCells = new Set();
  if (mode === 'links') foundWords.forEach((f) => f.cells.forEach(([r, c]) => linkCells.add(r * 100 + c)));
  const hintCells = new Set();
  if (hintCandidate && Math.floor(gameTime * 3) % 2 === 0) {
    hintCandidate.cells.slice(0, 2).forEach(([r, c]) => hintCells.add(r * 100 + c));
  }

  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const cell = cells[r][c];
      if (cell.offsetY < 0) cell.offsetY = Math.min(0, cell.offsetY + 1500 * elapsed);
      cell.flash = Math.max(0, cell.flash - elapsed);
      if (cell.removed) {
        if (cell.vanish >= 1) continue;
        if (cell.vanish === 0) {
          const p = cellCenter(r, c);
          burst(p.x, p.y, COL.found, 10, 350);
        }
        cell.vanish = Math.min(1, cell.vanish + elapsed * 2.5);
      }
      const x = gx0 + c * cs + 3;
      const y = gy0 + r * cs + 3 + cell.offsetY;
      const scale = cell.removed ? 1 - cell.vanish : 1;
      ctx.save();
      ctx.translate(x + s / 2, y + s / 2);
      if (scale !== 1) {
        ctx.scale(scale, scale);
        ctx.rotate(cell.vanish * 2);
      }
      ctx.translate(-s / 2, -s / 2);
      let tile = sprites.tile;
      let letterColor = COL.letter;
      if (cell.found > 0) {
        tile = linkCells.has(r * 100 + c) ? sprites.link : sprites.found;
        letterColor = COL.letterDark;
      }
      ctx.drawImage(tile, 0, 0);
      const heat = blindTimer > 0 ? 0 : Math.max(0, 1 - (gameTime - cell.litAt) / heatWin);
      if (heat > 0) {
        ctx.globalAlpha = heat;
        ctx.drawImage(sprites.hot, 0, 0);
        ctx.globalAlpha = 1;
        letterColor = heat > 0.5 ? COL.letterDark : letterColor;
      }
      if (cell.flash > 0 || hintCells.has(r * 100 + c)) {
        ctx.globalAlpha = Math.max(cell.flash, 0.6);
        ctx.drawImage(sprites.link, 0, 0);
        ctx.globalAlpha = 1;
      }
      ctx.drawImage(glyph(cell.letter, letterColor), -3, -3);
      ctx.restore();
    }
  }
  if (blindTimer > 0) {
    ctx.save();
    ctx.globalAlpha = Math.min(0.6, blindTimer * 0.4);
    ctx.fillStyle = COL.letter;
    ctx.fillRect(gx0, gy0, cols * cs, rows * cs);
    ctx.restore();
  }
}

function renderLinks(ctx, grid, elapsed) {
  links.forEach((link) => {
    if (gameState === 'game') link.button.handle(grid, elapsed);
    const v = link.button.getValue() / 100;
    const rad = link.button.getRadius();
    ctx.save();
    ctx.strokeStyle = COL.link;
    ctx.lineWidth = 8;
    ctx.globalAlpha = 0.5 + Math.sin(gameTime * 4) * 0.2;
    ctx.beginPath();
    ctx.arc(link.x, link.y, rad, 0, Math.PI * 2);
    ctx.stroke();
    if (v > 0) {
      ctx.globalAlpha = 1;
      ctx.lineWidth = 14;
      ctx.strokeStyle = COL.textHi;
      ctx.beginPath();
      ctx.arc(link.x, link.y, rad, -Math.PI / 2, -Math.PI / 2 + v * Math.PI * 2);
      ctx.stroke();
    }
    ctx.restore();
    util.renderTextDropShadow({
      ctx,
      text: `→ ${link.target}`,
      fontSize: '34px',
      dropDistX: 3,
      dropDistY: 3,
      fillStyle: COL.link,
      x: link.x,
      y: link.y + rad + 36,
    });
  });
}

function renderSidebar(ctx) {
  const x = SIDE_X;
  let y = 150;
  util.renderTextDropShadow({
    ctx,
    text: mode === 'links' ? theme : `Thema: ${theme}`,
    fontSize: '42px',
    dropDistX: 3,
    dropDistY: 3,
    fillStyle: COL.textHi,
    align: 'left',
    x,
    y,
  });
  y += 60;
  if (mode === 'refill') {
    util.renderText({ ctx, text: `Wörter: ${refillFound} / ${refillGoal()}`, fontSize: '40px', fillStyle: COL.text, align: 'left', x, y });
    y += 50;
    util.renderText({ ctx, text: `im Gitter: ${candidates.filter((c) => !c.found).length}`, fontSize: '34px', fillStyle: COL.textDim, align: 'left', x, y });
    y += 60;
    foundWords.slice(-12).forEach((f) => {
      util.renderText({ ctx, text: f.word, fontSize: '36px', fillStyle: f.color, align: 'left', x, y });
      y += 46;
    });
    return;
  }
  // ab 13 Wörtern zweispaltig und kleiner
  const many = targets.length > 12;
  const perCol = many ? Math.ceil(targets.length / 2) : targets.length;
  const lineH = many ? 40 : 48;
  const yStart = y;
  targets.forEach((t, i) => {
    const tx = x + (i >= perCol ? 185 : 0);
    const ty = yStart + (i % perCol) * lineH;
    util.renderText({
      ctx,
      text: t.word,
      fontSize: many ? '28px' : '38px',
      fillStyle: t.found ? COL.found : COL.text,
      align: 'left',
      x: tx,
      y: ty,
    });
    if (t.found) {
      ctx.save();
      ctx.strokeStyle = COL.found;
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.moveTo(tx, ty - 10);
      ctx.lineTo(tx + Array.from(t.word).length * (many ? 20 : 30), ty - 10);
      ctx.stroke();
      ctx.restore();
    }
  });
  y = yStart + perCol * lineH;
  if (bonusFound.size > 0) {
    y += 10;
    util.renderText({ ctx, text: `+ ${bonusFound.size} Zufallsfunde`, fontSize: '34px', fillStyle: COL.textHi, align: 'left', x, y });
    y += 48;
  }
  if (mode === 'solution') {
    y += 10;
    util.renderText({ ctx, text: `Lösungswort: ${Array.from(solution).length} Buchst.`, fontSize: '30px', fillStyle: COL.textDim, align: 'left', x, y });
  }
  if (mode === 'links') {
    y += 10;
    const ok = foundWords.length >= DIFFICULTY.linkMinFound;
    util.renderText({
      ctx,
      text: ok ? 'Links lange anleuchten\n= Spielfeld wechseln' : `Ab ${DIFFICULTY.linkMinFound} Funden\nwerden Links aktiv`,
      fontSize: '30px',
      lineHeight: 38,
      fillStyle: ok ? COL.link : COL.textDim,
      align: 'left',
      x,
      y,
    });
  }
}

function renderHud(ctx) {
  util.renderTextDropShadow({
    ctx,
    text: `Level ${level} · ${MODES[mode].name} · ${score} Punkte`,
    fontSize: '46px',
    dropDistX: 4,
    dropDistY: 4,
    fillStyle: COL.text,
    align: 'left',
    x: 40,
    y: 70,
  });
  const t = Math.max(0, Math.ceil(timeLeft));
  const low = timeLeft < 15 && Math.floor(gameTime * 4) % 2 === 0;
  util.renderTextDropShadow({
    ctx,
    text: `${Math.floor(t / 60)}:${String(t % 60).padStart(2, '0')}`,
    fontSize: '60px',
    dropDistX: 4,
    dropDistY: 4,
    fillStyle: low ? COL.bad : COL.textHi,
    align: 'right',
    x: W - 40,
    y: 80,
  });
}

function updateParticles(ctx, elapsed) {
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  for (let i = particles.length - 1; i >= 0; i--) {
    const p = particles[i];
    p.life += elapsed;
    if (p.life >= p.maxLife) {
      particles.splice(i, 1);
      continue;
    }
    p.vx *= 1 - 2 * elapsed;
    p.vy = p.vy * (1 - 2 * elapsed) + 150 * elapsed;
    p.x += p.vx * elapsed;
    p.y += p.vy * elapsed;
    ctx.globalAlpha = 1 - p.life / p.maxLife;
    ctx.fillStyle = p.color;
    ctx.fillRect(p.x - p.size / 2, p.y - p.size / 2, p.size, p.size);
  }
  ctx.restore();
}

function updateFloatingTexts(ctx, elapsed) {
  for (let i = floatingTexts.length - 1; i >= 0; i--) {
    const t = floatingTexts[i];
    t.time += elapsed;
    if (t.time >= t.duration) {
      floatingTexts.splice(i, 1);
      continue;
    }
    ctx.save();
    ctx.globalAlpha = 1 - t.time / t.duration;
    util.renderTextDropShadow({
      ctx,
      text: t.text,
      fontSize: `${t.size}px`,
      dropDistX: 3,
      dropDistY: 3,
      fillStyle: t.color,
      x: t.x,
      y: t.y - t.time * 50,
    });
    ctx.restore();
  }
}

function renderFlash(ctx, elapsed) {
  if (flash <= 0) return;
  ctx.save();
  ctx.globalAlpha = Math.min(0.4, flash * 0.4);
  ctx.fillStyle = COL.letter;
  ctx.fillRect(0, 0, W, H);
  ctx.restore();
  flash = Math.max(0, flash - elapsed * 2);
}

// --- Bildschirme ---
function createModeButtons() {
  const keys = Object.keys(MODES);
  return keys.map((m, i) =>
    guiFillButton({
      label: '',
      posX: 330 + i * 420,
      posY: 700,
      speedDown: 12,
      speedUp: 25,
      edges: 4,
      angle: Math.PI / 4,
      activeValue: 90,
      radius: 130,
      normalColor: lineColor(i),
      activeColor: COL.textHi,
      growColor: COL.hot,
      onEnterActive: () => startGame(m),
      onExitActive: () => {},
    })
  );
}

const MODE_TEXT = {
  classic: 'Wörter finden',
  solution: 'Rest = Lösung',
  refill: 'Neue Buchstaben\nfallen nach',
  links: 'Wörter werden\nLinks',
};

function renderModeLabels(ctx) {
  Object.keys(MODES).forEach((m, i) => {
    const x = 330 + i * 420;
    util.renderTextDropShadow({ ctx, text: `${i + 1}`, fontSize: '90px', dropDistX: 4, dropDistY: 4, fillStyle: lineColor(i), x, y: 730 });
    util.renderTextDropShadow({ ctx, text: MODES[m].name, fontSize: '44px', dropDistX: 3, dropDistY: 3, fillStyle: COL.textHi, x, y: 885 });
    util.renderText({ ctx, text: MODE_TEXT[m], fontSize: '32px', lineHeight: 40, fillStyle: COL.text, x, y: 935 });
  });
}

function handleModeKeys() {
  if (keyPressedOnce('Space')) return startGame('classic');
  Object.keys(MODES).forEach((m) => {
    if (keyPressedOnce(MODES[m].key)) startGame(m);
  });
}

function startGame(m) {
  mode = m;
  level = 1;
  score = 0;
  visitedThemes = [];
  stats = { words: 0, bonus: 0, letters: 0, overexposed: 0, boards: 0 };
  particles = [];
  floatingTexts = [];
  theme = pickTheme();
  nextTheme = null;
  startBoard();
}

function handleStart(grid, elapsed, ctx) {
  gameTime += elapsed;
  renderBackground(ctx, elapsed);
  const title = 'WORTLICHT';
  Array.from(title).forEach((ch, i) => {
    const x = W / 2 + (i - (title.length - 1) / 2) * 120;
    const y = 260 + Math.sin(gameTime * 3 + i * 0.6) * 18;
    util.renderTextDropShadow({ ctx, text: ch, fontSize: '150px', fillStyle: lineColor(i), x, y });
  });
  util.renderTextDropShadow({
    ctx,
    text: 'Alle Buchstaben eines Wortes kurz nacheinander anleuchten!\nNicht übers Gitter wischen – sonst Überbelichtung.',
    fontSize: '42px',
    lineHeight: 58,
    dropDistX: 4,
    dropDistY: 4,
    fillStyle: COL.text,
    x: W / 2,
    y: 380,
  });
  buttonsStart.forEach((b) => b.handle(grid, elapsed));
  renderModeLabels(ctx);
  handleModeKeys();
  updateParticles(ctx, elapsed);
}

function handleGame(grid, elapsed, ctx) {
  gameTime += elapsed;
  stateTime += elapsed;
  timeLeft -= elapsed;
  blindTimer = Math.max(0, blindTimer - elapsed);
  settleTimer = Math.max(0, settleTimer - elapsed);

  // Tastatur-Test
  if (keyPressedOnce('KeyF')) {
    const next = candidates.find((c) => !c.found && (c.target || mode === 'refill') && !c.cells.some(([r, cc]) => cells[r][cc].removed));
    if (next) next.cells.forEach(([r, c]) => (cells[r][c].litAt = gameTime));
  }
  if (keyPressedOnce('KeyJ') && links.length) useLink(links[0]);
  if (keyPressedOnce('KeyL')) {
    if (mode === 'links') nextTheme = pickTheme();
    startLevelUp('Level übersprungen');
  }

  if (refillPending >= 0) {
    refillPending -= elapsed;
    if (refillPending < 0) {
      refillPending = -1;
      if (gameState === 'game') doRefill();
    }
  }

  if (mode === 'refill' && gameState === 'game') {
    hintTimer += elapsed;
    if (hintTimer > DIFFICULTY.hintAfter && !hintCandidate) {
      const open = candidates.filter((c) => !c.found);
      hintCandidate = open[Math.floor(Math.random() * open.length)] || null;
    }
  }

  if (gameState === 'game') {
    handleCells(grid, elapsed);
    checkCandidates();
  }

  shake = Math.max(0, shake - elapsed);
  ctx.save();
  if (shake > 0) {
    const s = shake * 25;
    ctx.translate((Math.random() - 0.5) * s, (Math.random() - 0.5) * s);
  }
  renderBackground(ctx, elapsed);
  renderGrid(ctx, elapsed);
  if (mode === 'links') renderLinks(ctx, grid, elapsed);
  updateParticles(ctx, elapsed);
  updateFloatingTexts(ctx, elapsed);
  ctx.restore();
  renderSidebar(ctx);
  renderHud(ctx);
  renderFlash(ctx, elapsed);

  if (gameState === 'game' && timeLeft <= 0) gameOver();
}

function handleReveal(grid, elapsed, ctx) {
  gameTime += elapsed;
  stateTime += elapsed;
  renderBackground(ctx, elapsed);
  // übrig gebliebene Buchstaben fliegen in die Mitte und bilden das Lösungswort
  const rest = [];
  for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) if (!cells[r][c].removed) rest.push(cells[r][c]);
  const t = Math.min(1, stateTime / 1.5);
  const ease = t * t * (3 - 2 * t);
  const spacing = Math.min(130, (W - 200) / Math.max(1, rest.length));
  rest.forEach((cell, i) => {
    const from = cellCenter(cell.r, cell.c);
    const tx = W / 2 + (i - (rest.length - 1) / 2) * spacing;
    const ty = 540 + Math.sin(gameTime * 4 + i * 0.5) * 12 * ease;
    const x = from.x + (tx - from.x) * ease;
    const y = from.y + (ty - from.y) * ease;
    ctx.drawImage(sprites.link, x - (cs - 6) / 2, y - (cs - 6) / 2);
    ctx.drawImage(glyph(cell.letter, COL.letterDark), x - cs / 2, y - cs / 2);
  });
  if (stateTime > 1.5) {
    if (stateTime - elapsed <= 1.5) {
      burst(W / 2, 540, COL.textHi, 80, 700);
      flash = 1;
    }
    util.renderTextDropShadow({ ctx, text: 'LÖSUNGSWORT', fontSize: '110px', fillStyle: COL.textHi, x: W / 2, y: 350 });
  }
  updateParticles(ctx, elapsed);
  renderHud(ctx);
  renderFlash(ctx, elapsed);
  if (stateTime > 4) startLevelUp(`Lösungswort: ${solution}`);
}

function handleLevelUp(grid, elapsed, ctx) {
  gameTime += elapsed;
  stateTime += elapsed;
  renderBackground(ctx, elapsed);
  if (Math.random() < elapsed * 25) burst(Math.random() * W, H + 10, lineColor(Math.floor(Math.random() * 6)), 4, 700);
  updateParticles(ctx, elapsed);
  updateFloatingTexts(ctx, elapsed);
  const t = Math.min(1, stateTime * 3);
  ctx.save();
  ctx.translate(W / 2, 380);
  ctx.scale(0.5 + 0.5 * t, 0.5 + 0.5 * t);
  util.renderTextDropShadow({ ctx, text: `LEVEL ${level + 1}`, fontSize: '170px', fillStyle: COL.textHi, x: 0, y: 0 });
  ctx.restore();
  util.renderTextDropShadow({
    ctx,
    text: `${levelupText}\n${newElementText(level + 1)}`,
    fontSize: '50px',
    lineHeight: 70,
    dropDistX: 4,
    dropDistY: 4,
    fillStyle: COL.text,
    x: W / 2,
    y: 520,
  });
  renderHud(ctx);
  renderFlash(ctx, elapsed);
  if (stateTime >= 3) nextLevel();
}

function handleGameOver(grid, elapsed, ctx) {
  gameTime += elapsed;
  stateTime += elapsed;
  renderBackground(ctx, elapsed);
  updateParticles(ctx, elapsed);
  util.renderTextDropShadow({ ctx, text: 'Zeit abgelaufen!', fontSize: '130px', fillStyle: COL.bad, x: W / 2, y: 200 });
  util.renderTextDropShadow({
    ctx,
    text:
      `${MODES[mode].name}: Level ${level} erreicht – ${score} Punkte\n` +
      `${stats.words} Wörter gefunden (${stats.bonus} Zufallsfunde), ${stats.letters} Buchstaben\n` +
      `${stats.boards} Spielfelder, ${stats.overexposed}× überbelichtet`,
    fontSize: '44px',
    lineHeight: 62,
    dropDistX: 4,
    dropDistY: 4,
    fillStyle: COL.text,
    x: W / 2,
    y: 310,
  });
  buttonsGameOver.forEach((b) => b.handle(grid, elapsed));
  renderModeLabels(ctx);
  handleModeKeys();
}

function resetAll() {
  updateColors();
  cs = 100;
  renderSprites();
  gameState = 'start';
  gameTime = 0;
  stateTime = 0;
  particles = [];
  floatingTexts = [];
  bgLetters = [];
  for (let i = 0; i < 30; i++) {
    bgLetters.push({
      letter: randomLetter(),
      x: Math.random() * W,
      y: Math.random() * H,
      size: 60 + Math.random() * 140,
      speed: 15 + Math.random() * 40,
      alpha: 0.08 + Math.random() * 0.15,
      seed: Math.random() * 10,
    });
  }
  buttonsStart = createModeButtons();
  buttonsGameOver = [];
  previousKeys = {};
  lastTime = performance.now();
}

export default {
  name: 'Wortlicht',
  description: `
Buchstabengitter für alle!

Im Gitter sind Wörter versteckt 
waagerecht, senkrecht, später auch rückwärts und diagonal

Ein Wort ist gefunden, wenn 
ALLE seine Buchstaben kurz nacheinander angeleuchtet werden

Varianten
Klassisch, Lösungswort, Nachrutschen, Wortlinks`,
  image: 'media/img/gametitles/laser-sorter-###3###.png',
  init: function () {
    resetAll();
  },
  handle: function (grid) {
    const elapsed = getDelta();
    const ctx = MasterCanvas.get2dContext();
    switch (gameState) {
      case 'start':
        handleStart(grid, elapsed, ctx);
        break;
      case 'game':
        handleGame(grid, elapsed, ctx);
        break;
      case 'reveal':
        handleReveal(grid, elapsed, ctx);
        break;
      case 'levelup':
        handleLevelUp(grid, elapsed, ctx);
        break;
      case 'gameover':
        handleGameOver(grid, elapsed, ctx);
        break;
    }
  },
  stop: function () {
    activeSounds.slice().forEach((a) => a.pause());
    activeSounds = [];
  },
};
