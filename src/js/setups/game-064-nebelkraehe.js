/**
 * Trupp Nebelkrähe – Erkundungs- und Überlebensspiel für den ganzen Saal
 *
 * Erstellt mit Claude Opus 5.5 (claude-opus-5-5).
 *
 * Der Trupp „Nebelkrähe“ (8 Leute, eigene Figuren, fiktives Land Varnholm, kein echter Krieg) ist hinter der
 * Grenze abgeschnitten und muss sich zur Basis durchschlagen: drei Kartenscreens von LINKS nach RECHTS –
 *   1 „Grenzfluss-Tal“  →  2 „Nebelwald“  →  3 „Bergpass zur Basis“.
 *
 * Regeln:
 * - KARTE: Jeder Screen ist ein Feldraster (9 × 5) unter Nebel. Der Trupp steht auf einem Feld; auf den
 *   Nachbarfeldern liegen dunkle Abstimm-Pads (gui/voteGroup). Der ganze Saal leuchtet – das Pad, das zuerst
 *   voll ist, ist der nächste Schritt. Der Trupp marschiert, der Nebel um ihn lichtet sich.
 * - JEDER SCHRITT kostet 1 Proviant und 2 Stunden. Sumpf kostet doppelt. Ohne Proviant wird alle paar Schritte
 *   jemand schwächer (verwundet → gefallen).
 * - FELDER: leer · Begegnung (eins von 14 Minispielen) · Fund (Proviant/Munition/Verbandskasten) ·
 *   Rastplatz (heilt alle Verwundeten, kostet Zeit + Proviant) · Dorf (Tauschhandel per Abstimmung) ·
 *   Höhle (Abkürzung, 3 Spalten nach vorn) · Sumpf (Gelände, teurer). Auf leeren Feldern lauern auch
 *   zufällige Begegnungen.
 * - MINISPIELE: Jede Begegnung ist ein eigenes kurzes Laserspiel (Feuergefecht, Scharfschütze, Minenfeld,
 *   Nachtwache, Fluss, Sumpf, Mörser, Sanitäter, Funkspruch, Versorgungsabwurf, Brücke, Tierangriff,
 *   Vorräte, Gefangene). Pro Lauf kommt nach Möglichkeit jedes mindestens einmal vor. Verluste treffen erst
 *   Gesunde (→ verwundet), dann Verwundete (→ gefallen).
 * - ZIEL: rechter Rand von Screen 3 = die Basis. Alle gefallen = Game Over.
 * - HIGHSCORE: Überlebende × 1000 + gewonnene Minispiele × 200 + Proviant + Munition − Zeitstrafe.
 *   (Highscore muss sein – wie früher am Amiga, als man für einen Platz in der Bestenliste die halbe Nacht
 *   vor dem Monitor saß.)
 * - MINISPIEL-TEST im Hauptmenü: jedes der 14 Minispiele einzeln starten, mit Schwierigkeit 1/2/3.
 *
 * Klassiker: Lost Patrol (Ocean, Amiga/Atari ST 1990) – Spähtrupp, Karte, Tage zählen, Begegnungen als
 * Action-Szenen. Anders hier: Der ganze Saal ist der Truppführer (Abstimmung statt Joystick), die Szenen sind
 * 14 verschiedene Laser-Minispiele, das Setting ist erfunden und gewaltarm-comichaft (Getroffene „fallen aus“).
 * Ähnlichkeiten im Bestand: Abstimmen wie game-048-umfrage / game-018-voter, Kartenbewegung mit Zielwahl wie
 * game-057-fallensteller, Minispiel-Sammlung ähnlich game-063-tempelsturz (Stationen).
 *
 * Interferenz: Beim Abstimmen gewinnt die Mehrheit – Störer können die Richtung nur verzögern, nicht kapern,
 * denn das Pad muss voll werden. In den Minispielen ist Wildleuchten meist bestraft (eigene Leute, Minen,
 * Laterne). Bewusst so gelassen: Es gibt kein Gegenteam – alle sind der Trupp.
 *
 * One-Pixel-Netzwerk: Alles ist Flächenanteil (voteGroup, pixelFillButton, paintLayer). Ein Netz-Spieler mit
 * einem Pixel ist eine Stimme mit winzigem Gewicht; Millionen Pixel ergeben eine echte Saal-Mehrheit.
 *
 * Licht-Disziplin: Alle Laser-Pads schwarz hinterlegt und nur konturiert; Karte dunkel, Höhenlinien aus einer
 * vorgerenderten Julia-Menge stark gedimmt. Farben nur Komplementärbereich (Hue 0.25 … 0.75).
 *
 * Tastatur (Test ohne Laser):
 *   Leertaste  Start / Karte überspringen / weiter
 *   Pfeile     Richtung auf der Karte abstimmen
 *   Escape     Karte: zurück ins Hauptmenü (Spielleitung)
 *   N          laufendes Minispiel gilt als gewonnen
 *   B          Sprung zum nächsten Screen
 *   K / X      im Minispiel: Helfer / Fehlschlag erzwingen (machen die Minispiele selbst)
 *   Testmenü:  1–9, 0, Y, U, I, O = Minispiel 1–14 · J = Schwierigkeit · Escape = zurück
 *   (d v g r m h t f F s, PageUp/PageDown/Home sind Debug-Tasten in view.js und hier frei gelassen)
 *
 * Aufbau der Datei: Kern (Zustand, Karte, Szenen) – an der Marke „@@MINIGAMES@@“ stehen die 14 Minispiele.
 * Minispiel-Vertrag: function mgXyz(opts) mit opts = { level: 0|1|2, squadCount, ammo, testMode } →
 *   { id, title, hint, update(grid, dt, ctx) }; update liefert null, solange es läuft, und genau einmal
 *   { win, casualties, loot: { food, ammo }, text }.
 */

import util, { getRgbSpreadHex } from '../util.js';
import { createKeyEdge, isKeyDown as gsIsKeyDown } from './gui/gridScan.js';
import sndShot from '../../../public/media/flash-253597_4508519-lq.mp3';
import sndHit from '../../../public/media/155235__zangrutz__bomb-small (1).mp3';
import sndPlop from '../../../public/media/369952__mischy__plop-1.wav';
import sndError from '../../../public/media/opengameart/Menu Error.ogg';
import sndWin from '../../../public/media/opengameart/Level Up.ogg';
import sndBoom from '../../../public/media/414346__bykgames__explosion-far.wav';
import sndPickup from '../../../public/media/opengameart/Item Pickup.ogg';
import sndClick from '../../../public/media/opengameart/Menu Move.ogg';
import sndSplash from '../../../public/media/485066__javierserrat__object-falls-into-the-water.wav';
import sndSonar from '../../../public/media/70299__kizilsungur__sonar.wav';
import sndTransition from '../../../public/media/opengameart/Transition.ogg';
import sndGameOver from '../../../public/media/opengameart/Music Box Game Over III.wav';
import sndVictory from '../../../public/media/opengameart/Ability Learn.ogg';
import sndStep from '../../../public/media/opengameart/Menu Confirm.ogg';
var laserConfig = require('../LaserApiConfig.js').default;
var MasterCanvas = require('../MasterCanvas').default;
var createHighscore = require('../util/highscore').default;

// GUI-Bausteine (auch für die Minispiele)
var guiFillButton = require('./gui/fillButton-ai2').default;
var guiPixelFillButton = require('./gui/pixelFillButton').default;
var guiFollowCircle = require('./gui/followCircle-ai2').default;
var guiDragHandle = require('./gui/dragHandle').default;
var guiAimTurret = require('./gui/aimTurret').default;
var guiPaintLayer = require('./gui/paintLayer').default;
var guiSteerStrip = require('./gui/steerStrip').default;
var guiSwipeDetector = require('./gui/swipeDetector').default;
var guiBlobTracker = require('./gui/blobTracker').default;
var guiRegionButton = require('./gui/regionButton').default;
var guiVoteGroup = require('./gui/voteGroup').default;
var guiCalmMeter = require('./gui/calmMeter').default;
var guiRangeSlider = require('./gui/rangeSlider-ai2').default;

const W = 1920;
const H = 1080;
const TOP = 90; // HUD-Streifen oben, Spielfläche ist TOP..H

// ---------------------------------------------------------------------------------------------------------
// Einstellungen
// ---------------------------------------------------------------------------------------------------------

const SETTINGS = {
  cols: 9,
  rows: 5,
  squadSize: 8,
  startFood: 22,
  startAmmo: 30,
  startMedkits: 1,
  hoursPerStep: 2,
  walkTime: 0.55, // s pro Schritt (Animation)
  revealRadius: 2, // der revealradius sollte eigentlich vom fitness abhaengen, aber ok
  padRadius: 66,
  introDuration: 2.6,
  resultDuration: 3.4,
  eventDuration: 2.8,
  transitionDuration: 3.5,
  starveEvery: 3, // ohne Proviant: alle n Schritte wird jemand schwächer
  randomEncounterChance: 0.34,
  maxParticles: 300,
  maxFloaters: 30,
};

const DIFFICULTY = {
  // pro Screen (0, 1, 2)
  minigamesPerScreen: [5, 7, 9],
  findsPerScreen: [4, 3, 4],
  swampPerScreen: [3, 6, 2],
  restPerScreen: [1, 2, 3],
  villagePerScreen: [1, 2, 3],
  cavePerScreen: [2, 1, 3],
  caveJump: 3,
};

const SCORE = { survivor: 1000, minigame: 200, hourPenalty: 4 };

const SCREENS = [
  { name: 'Grenzfluss-Tal', seedR: -0.4, seedI: 0.6, hue: 0.42 },
  { name: 'Nebelwald', seedR: -0.8, seedI: 0.156, hue: 0.33 },
  { name: 'Bergpass zur Basis', seedR: 0.285, seedI: 0.01, hue: 0.58 },
];

const SQUAD_NAMES = ['Colonel Cologne', 'Seargent Searge', 'Meister Proper', '', 'Ossi Oskar', 'Wessi Wilhelm', 'Klara Klahr', 'Claudia Diebh'];

const MG_NAMES = [
  'Feuergefecht',
  'Scharfschütze',
  'Minenfeld',
  'Nachtwache',
  'Flussüberquerung',
  'Sumpf',
  'Mörserbeschuss',
  'Sanitäter',
  'Funkspruch',
  'Versorgungsabwurf',
  'Brücke',
  'Tierangriff',
  'Vorräte suchen',
  'Gefangene befreien',
];
const MG_KEYS = ['Digit1', 'Digit2', 'Digit3', 'Digit4', 'Digit5', 'Digit6', 'Digit7', 'Digit8', 'Digit9', 'Digit0', 'KeyY', 'KeyU', 'KeyI', 'KeyO'];
const MG_KEY_LABELS = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '0', 'Y', 'U', 'I', 'O'];

// ---------------------------------------------------------------------------------------------------------
// Farben (nur Komplementärbereich der Laserfarbe, Hue 0.25 … 0.75)
// ---------------------------------------------------------------------------------------------------------

function col(hue, sat, val) {
  return getRgbSpreadHex(laserConfig.testColor, hue, sat, val);
}

var PAL = {};
var palKey = '';
function ensurePalette() {
  const key = laserConfig.testColor.join(',');
  if (key === palKey) return;
  palKey = key;
  PAL.text = col(0.5, 0.12, 0.96);
  PAL.dim = col(0.5, 0.25, 0.55);
  PAL.accent = col(0.42, 0.7, 1);
  PAL.good = col(0.33, 0.75, 1);
  PAL.bad = col(0.72, 0.8, 1);
  PAL.warn = col(0.27, 0.9, 1);
  PAL.enemy = col(0.68, 0.7, 0.95);
  PAL.friend = col(0.38, 0.6, 1);
  PAL.water = col(0.55, 0.7, 0.75);
  PAL.jungle = col(0.36, 0.7, 0.55);
  PAL.ground = col(0.3, 0.45, 0.45);
  PAL.glow = col(0.47, 0.5, 1);
  PAL.dark = col(0.5, 0.4, 0.06);
  PAL.pad = col(0.45, 0.55, 0.85);
  PAL.padGrow = col(0.48, 0.7, 1);
  PAL.padActive = col(0.36, 0.8, 1);
  PAL.fog = col(0.52, 0.2, 0.16);
  PAL.chart = col(0.45, 0.4, 0.2);
  // Begriff-Farben für Felder
  PAL.fieldMg = col(0.7, 0.6, 0.9);
  PAL.fieldFind = col(0.3, 0.7, 1);
  PAL.fieldRest = col(0.4, 0.5, 1);
  PAL.fieldVillage = col(0.6, 0.45, 1);
  PAL.fieldCave = col(0.52, 0.35, 0.8);
  PAL.fieldSwamp = col(0.38, 0.55, 0.5);
  bgCanvases = [null, null, null];
  titleCanvas = null;
}

// ---------------------------------------------------------------------------------------------------------
// Kleine Helfer (auch für Minispiele)
// ---------------------------------------------------------------------------------------------------------

var keyEdgeInternal = createKeyEdge();
function keyEdge(code) {
  return keyEdgeInternal(code);
}
function isKeyDown(code) {
  return gsIsKeyDown(code);
}
function clamp(v, a, b) {
  return Math.max(a, Math.min(b, v));
}
function lerp(a, b, t) {
  return a + (b - a) * t;
}

const SND = {
  shot: sndShot,
  hit: sndHit,
  plop: sndPlop,
  error: sndError,
  win: sndWin,
  boom: sndBoom,
  pickup: sndPickup,
  click: sndClick,
  splash: sndSplash,
  sonar: sndSonar,
};

function playSound(src, volume) {
  try {
    const a = new Audio(src);
    a.volume = volume === undefined ? 0.5 : volume;
    const p = a.play();
    if (p && p.catch) p.catch(() => {});
  } catch (e) {
    // Ton ist optional
  }
}

var particles = [];
var floaters = [];
var shake = 0;

function burst(x, y, color, count, speed) {
  const n = Math.min(count || 12, SETTINGS.maxParticles - particles.length);
  const sp = speed || 250;
  for (let i = 0; i < n; i++) {
    const a = Math.random() * Math.PI * 2;
    const v = sp * (0.3 + Math.random() * 0.7);
    particles.push({ x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v, life: 0.5 + Math.random() * 0.6, max: 1.1, color, size: 2 + Math.random() * 4 });
  }
}

function addFloater(x, y, text, color) {
  if (floaters.length >= SETTINGS.maxFloaters) floaters.shift();
  floaters.push({ x, y, text, color: color || PAL.text, life: 1.4 });
}

function addShake(amount) {
  shake = Math.min(30, shake + (amount || 8));
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
    p.x += p.vx * dt;
    p.y += p.vy * dt;
    p.vx *= Math.exp(-2 * dt);
    p.vy = p.vy * Math.exp(-2 * dt) + 120 * dt;
    ctx.globalAlpha = clamp(p.life / 0.6, 0, 1);
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
    f.y -= 50 * dt;
    ctx.save();
    ctx.globalAlpha = clamp(f.life, 0, 1);
    util.renderText({ ctx, text: f.text, x: f.x, y: f.y, fontSize: '40px', fillStyle: f.color });
    ctx.restore();
  });
}

function makeCanvas(w, h) {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  return c;
}

function shuffle(arr) {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    const t = arr[i];
    arr[i] = arr[j];
    arr[j] = t;
  }
  return arr;
}

function fmtTime(hours) {
  const day = Math.floor(hours / 24) + 1;
  const h = Math.floor(hours % 24);
  return 'Tag ' + day + ', ' + (h < 10 ? '0' : '') + h + ':00';
}

// Dunkles Pad: schwarze Scheibe unter einem Laser-Feld (Licht-Disziplin)
function darkDisk(ctx, x, y, r) {
  ctx.save();
  ctx.fillStyle = '#000000';
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

// Standard-Knopf (Menüs): schwarz hinterlegt, konturiert, OHNE keyCode (sonst ignoriert er die Laser)
function makeButton(label, x, y, r, onEnter, edges) {
  ensurePalette();
  return guiFillButton({
    label,
    posX: x,
    posY: y,
    radius: r,
    edges: edges || 6,
    speedUp: 55,
    speedDown: 25,
    activeValue: 85,
    lineWidth: 4,
    normalColor: PAL.pad,
    growColor: PAL.padGrow,
    activeColor: PAL.padActive,
    onEnterActive: onEnter,
  });
}

// ---------------------------------------------------------------------------------------------------------
// Zustand (vorbelegt, damit handle() auch ohne init() läuft)
// ---------------------------------------------------------------------------------------------------------

var scene = 'title'; // title | test | map | event | intro | minigame | result | transition | gameover | victory
var sceneTime = 0;
var clock = 0;
var screenIndex = 0;
var fields = []; // fields[c][r] = { type, terrain, mg, revealed, visited }
var squadPos = { c: 0, r: 2 };
var walk = null; // { from:{c,r}, to:{c,r}, t }
var trail = [];
var vote = null;
var voteDirs = [];
var squad = [];
var res = { food: SETTINGS.startFood, ammo: SETTINGS.startAmmo, medkits: SETTINGS.startMedkits, hours: 6 };
var STATS = { steps: 0, minigamesWon: 0, minigamesLost: 0, finds: 0, fallen: 0, wounded: 0, screensDone: 0 };
var mgPool = [];
var current = null; // laufendes Minispiel { index, game, testMode }
var lastResult = null; // { title, win, text, lines[] }
var eventCard = null; // { title, lines[], color }
var village = null;
var starveCounter = 0;
var finalScore = 0;
var newHighscore = false;
var testDifficulty = 0;
var testLastText = '';
var buttons = {}; // Menü-Knöpfe je Szene
var bgCanvases = [null, null, null];
var titleCanvas = null;
var fogSprite = null;
var highscore = createHighscore('Trupp Nebelkrähe', 'punkte');

function setScene(s) {
  scene = s;
  sceneTime = 0;
  buttons = {};
}

// ---------------------------------------------------------------------------------------------------------
// Trupp
// ---------------------------------------------------------------------------------------------------------

function makeSquad() {
  return SQUAD_NAMES.map((name) => ({ name, state: 'ok' })); // ok | wounded | dead
}
function aliveCount() {
  return squad.filter((s) => s.state !== 'dead').length;
}
function healthyCount() {
  return squad.filter((s) => s.state === 'ok').length;
}

// Verluste: erst Gesunde verwunden, dann Verwundete fallen. Liefert Textzeilen mit Namen.
function applyCasualties(n) {
  const lines = [];
  for (let i = 0; i < n; i++) {
    const ok = squad.filter((s) => s.state === 'ok');
    const wounded = squad.filter((s) => s.state === 'wounded');
    if (ok.length) {
      const s = ok[Math.floor(Math.random() * ok.length)];
      s.state = 'wounded';
      STATS.wounded++;
      lines.push(s.name + ' ist verwundet');
    } else if (wounded.length) {
      const s = wounded[Math.floor(Math.random() * wounded.length)];
      s.state = 'dead';
      STATS.fallen++;
      lines.push(s.name + ' fällt aus');
    }
  }
  return lines;
}

function healAll() {
  let n = 0;
  squad.forEach((s) => {
    if (s.state === 'wounded') {
      s.state = 'ok';
      n++;
    }
  });
  return n;
}

function healOne() {
  const s = squad.find((q) => q.state === 'wounded');
  if (!s) return null;
  s.state = 'ok';
  return s.name;
}

// ---------------------------------------------------------------------------------------------------------
// Karte
// ---------------------------------------------------------------------------------------------------------

const MAP = { x0: 40, y0: TOP + 20, x1: W - 40, y1: H - 20 };
function cellW() {
  return (MAP.x1 - MAP.x0) / SETTINGS.cols;
}
function cellH() {
  return (MAP.y1 - MAP.y0) / SETTINGS.rows;
}
function cellCenter(c, r) {
  return { x: MAP.x0 + (c + 0.5) * cellW(), y: MAP.y0 + (r + 0.5) * cellH() };
}

// Minispiele auf die 3 Screens verteilen: jedes mindestens einmal pro Lauf (14 = 5 + 5 + 4)
function buildMinigamePool() {
  const all = shuffle(MG_NAMES.map((n, i) => i));
  mgPool = [];
  let k = 0;
  DIFFICULTY.minigamesPerScreen.forEach((cnt, s) => {
    mgPool[s] = all.slice(k, k + cnt);
    k += cnt;
  });
}

function generateScreen(s) {
  fields = [];
  for (let c = 0; c < SETTINGS.cols; c++) {
    fields[c] = [];
    for (let r = 0; r < SETTINGS.rows; r++) {
      fields[c][r] = { type: 'empty', terrain: 'land', mg: -1, revealed: false, visited: false };
    }
  }
  // freie Zellen (nicht Startspalte)
  const free = [];
  for (let c = 1; c < SETTINGS.cols; c++) for (let r = 0; r < SETTINGS.rows; r++) free.push({ c, r });
  shuffle(free);
  const take = () => free.pop();
  (mgPool[s] || []).forEach((mg) => {
    const p = take();
    if (!p) return;
    fields[p.c][p.r].type = 'mg';
    fields[p.c][p.r].mg = mg;
  });
  for (let i = 0; i < DIFFICULTY.findsPerScreen[s]; i++) {
    const p = take();
    if (p) fields[p.c][p.r].type = 'find';
  }
  for (let i = 0; i < DIFFICULTY.restPerScreen[s]; i++) {
    const p = take();
    if (p) fields[p.c][p.r].type = 'rest';
  }
  for (let i = 0; i < DIFFICULTY.villagePerScreen[s]; i++) {
    const p = take();
    if (p) fields[p.c][p.r].type = 'village';
  }
  for (let i = 0; i < DIFFICULTY.cavePerScreen[s]; i++) {
    // Höhlen nur in der linken Hälfte, sonst wären sie sinnlos
    const idx = free.findIndex((q) => q.c <= 4);
    if (idx >= 0) {
      const p = free.splice(idx, 1)[0];
      fields[p.c][p.r].type = 'cave';
    }
  }
  for (let i = 0; i < DIFFICULTY.swampPerScreen[s]; i++) {
    const c = 1 + Math.floor(Math.random() * (SETTINGS.cols - 1));
    const r = Math.floor(Math.random() * SETTINGS.rows);
    fields[c][r].terrain = 'swamp';
  }
  squadPos = { c: 0, r: Math.floor(SETTINGS.rows / 2) };
  fields[0][squadPos.r].visited = true;
  trail = [{ c: squadPos.c, r: squadPos.r }];
  reveal(squadPos.c, squadPos.r);
}

function reveal(c, r) {
  const R = SETTINGS.revealRadius;
  for (let dc = -R; dc <= R; dc++) {
    for (let dr = -R; dr <= R; dr++) {
      const cc = c + dc;
      const rr = r + dr;
      if (cc >= 0 && rr >= 0 && cc < SETTINGS.cols && rr < SETTINGS.rows) fields[cc][rr].revealed = true;
    }
  }
}

// ---------------------------------------------------------------------------------------------------------
// Vorgerenderte Grafik: Höhenlinien aus einer Julia-Menge, Nebelwolke, Titel
// ---------------------------------------------------------------------------------------------------------

function juliaIter(zr, zi, cr, ci, maxIter) {
  let i = 0;
  while (zr * zr + zi * zi <= 4 && i < maxIter) {
    const t = zr * zr - zi * zi + cr;
    zi = 2 * zr * zi + ci;
    zr = t;
    i++;
  }
  return i;
}

function renderContours(w, h, seedR, seedI, color, zoom) {
  const lw = Math.floor(w / 4);
  const lh = Math.floor(h / 4);
  const it = new Uint8Array(lw * lh);
  for (let y = 0; y < lh; y++) {
    for (let x = 0; x < lw; x++) {
      const zr = ((x - lw / 2) / lw) * 3.2 * zoom;
      const zi = ((y - lh / 2) / lh) * 1.8 * zoom;
      it[x + y * lw] = juliaIter(zr, zi, seedR, seedI, 40);
    }
  }
  const small = makeCanvas(lw, lh);
  const sctx = small.getContext('2d');
  const img = sctx.createImageData(lw, lh);
  const n = parseInt(color.slice(1, 7), 16);
  const cr = (n >> 16) & 255;
  const cg = (n >> 8) & 255;
  const cb = n & 255;
  for (let y = 0; y < lh - 1; y++) {
    for (let x = 0; x < lw - 1; x++) {
      const a = it[x + y * lw];
      const band = Math.floor(a / 3);
      const edge = band !== Math.floor(it[x + 1 + y * lw] / 3) || band !== Math.floor(it[x + (y + 1) * lw] / 3);
      if (!edge) continue;
      const k = (x + y * lw) * 4;
      img.data[k] = cr;
      img.data[k + 1] = cg;
      img.data[k + 2] = cb;
      img.data[k + 3] = a >= 39 ? 90 : 170;
    }
  }
  sctx.putImageData(img, 0, 0);
  const c = makeCanvas(w, h);
  const ctx = c.getContext('2d');
  ctx.imageSmoothingEnabled = true;
  ctx.drawImage(small, 0, 0, w, h);
  return c;
}

function ensureScreenBackground(s) {
  ensurePalette();
  if (bgCanvases[s]) return bgCanvases[s];
  const sc = SCREENS[s];
  const c = makeCanvas(W, H);
  const ctx = c.getContext('2d');
  const g = ctx.createLinearGradient(0, TOP, W, H);
  g.addColorStop(0, col(sc.hue, 0.5, 0.07));
  g.addColorStop(1, col(sc.hue + 0.08, 0.5, 0.04));
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, W, H);
  const contour = renderContours(W, H - TOP, sc.seedR, sc.seedI, col(sc.hue, 0.45, 0.32), 1.15);
  ctx.globalAlpha = 0.55;
  ctx.drawImage(contour, 0, TOP);
  ctx.globalAlpha = 1;
  // Kartengitter
  ctx.strokeStyle = col(sc.hue, 0.3, 0.16);
  ctx.lineWidth = 1;
  for (let cc = 0; cc <= SETTINGS.cols; cc++) {
    const x = MAP.x0 + cc * cellW();
    ctx.beginPath();
    ctx.moveTo(x, MAP.y0);
    ctx.lineTo(x, MAP.y1);
    ctx.stroke();
  }
  for (let rr = 0; rr <= SETTINGS.rows; rr++) {
    const y = MAP.y0 + rr * cellH();
    ctx.beginPath();
    ctx.moveTo(MAP.x0, y);
    ctx.lineTo(MAP.x1, y);
    ctx.stroke();
  }
  // Ziel-Kante rechts
  ctx.strokeStyle = col(0.33, 0.6, 0.45);
  ctx.setLineDash([14, 10]);
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(MAP.x1 + 8, MAP.y0);
  ctx.lineTo(MAP.x1 + 8, MAP.y1);
  ctx.stroke();
  ctx.setLineDash([]);
  bgCanvases[s] = c;
  return c;
}

function ensureFogSprite() {
  if (fogSprite) return fogSprite;
  ensurePalette();
  const w = Math.ceil(cellW() * 1.5);
  const h = Math.ceil(cellH() * 1.5);
  const c = makeCanvas(w, h);
  const ctx = c.getContext('2d');
  const n = parseInt(PAL.fog.slice(1, 7), 16);
  const rgb = ((n >> 16) & 255) + ',' + ((n >> 8) & 255) + ',' + (n & 255);
  for (let i = 0; i < 9; i++) {
    const x = w * (0.2 + Math.random() * 0.6);
    const y = h * (0.2 + Math.random() * 0.6);
    const r = Math.min(w, h) * (0.25 + Math.random() * 0.25);
    const g = ctx.createRadialGradient(x, y, 0, x, y, r);
    g.addColorStop(0, 'rgba(' + rgb + ',0.95)');
    g.addColorStop(1, 'rgba(' + rgb + ',0)');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();
  }
  fogSprite = c;
  return c;
}

function ensureTitleCanvas() {
  ensurePalette();
  if (titleCanvas) return titleCanvas;
  const c = makeCanvas(W, H);
  const ctx = c.getContext('2d');
  ctx.fillStyle = col(0.45, 0.5, 0.05);
  ctx.fillRect(0, 0, W, H);
  const contour = renderContours(W, H, -0.7269, 0.1889, col(0.4, 0.5, 0.3), 1.0);
  ctx.globalAlpha = 0.6;
  ctx.drawImage(contour, 0, 0);
  ctx.globalAlpha = 1;
  titleCanvas = c;
  return c;
}

// ---------------------------------------------------------------------------------------------------------
// Zeichnen: Karte, Felder, Nebel, Trupp, HUD
// ---------------------------------------------------------------------------------------------------------

function drawFieldIcon(ctx, f, x, y) {
  const s = Math.min(cellW(), cellH()) * 0.22;
  ctx.save();
  ctx.lineWidth = 3;
  if (f.terrain === 'swamp') {
    ctx.strokeStyle = PAL.fieldSwamp;
    ctx.globalAlpha = 0.6;
    for (let i = -1; i <= 1; i++) {
      ctx.beginPath();
      for (let k = -3; k <= 3; k++) {
        const xx = x + k * s * 0.4;
        const yy = y + s * 1.2 + i * s * 0.35 + Math.sin(k + clock * 2 + i) * 4;
        if (k === -3) ctx.moveTo(xx, yy);
        else ctx.lineTo(xx, yy);
      }
      ctx.stroke();
    }
    ctx.globalAlpha = 1;
  }
  if (f.visited && f.type !== 'empty') ctx.globalAlpha = 0.35;
  if (f.type === 'mg') {
    ctx.strokeStyle = PAL.fieldMg;
    ctx.beginPath();
    ctx.moveTo(x, y - s);
    ctx.lineTo(x + s, y + s * 0.8);
    ctx.lineTo(x - s, y + s * 0.8);
    ctx.closePath();
    ctx.stroke();
    util.renderText({ ctx, text: '!', x, y: y + s * 0.55, fontSize: Math.round(s * 1.2) + 'px', fillStyle: PAL.fieldMg });
  } else if (f.type === 'find') {
    ctx.strokeStyle = PAL.fieldFind;
    ctx.strokeRect(x - s * 0.8, y - s * 0.5, s * 1.6, s);
    ctx.beginPath();
    ctx.moveTo(x - s * 0.8, y - s * 0.1);
    ctx.lineTo(x + s * 0.8, y - s * 0.1);
    ctx.stroke();
  } else if (f.type === 'rest') {
    ctx.strokeStyle = PAL.fieldRest;
    ctx.beginPath();
    ctx.moveTo(x - s, y + s * 0.6);
    ctx.lineTo(x, y - s * 0.8);
    ctx.lineTo(x + s, y + s * 0.6);
    ctx.closePath();
    ctx.stroke();
  } else if (f.type === 'village') {
    ctx.strokeStyle = PAL.fieldVillage;
    for (let i = -1; i <= 1; i += 2) {
      const xx = x + i * s * 0.6;
      ctx.strokeRect(xx - s * 0.4, y - s * 0.1, s * 0.8, s * 0.7);
      ctx.beginPath();
      ctx.moveTo(xx - s * 0.5, y - s * 0.1);
      ctx.lineTo(xx, y - s * 0.6);
      ctx.lineTo(xx + s * 0.5, y - s * 0.1);
      ctx.stroke();
    }
  } else if (f.type === 'cave') {
    ctx.strokeStyle = PAL.fieldCave;
    ctx.beginPath();
    ctx.arc(x, y + s * 0.6, s, Math.PI, 0);
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(x, y + s * 0.6, s * 0.5, Math.PI, 0);
    ctx.stroke();
  }
  ctx.restore();
}

function drawMap(ctx) {
  ctx.drawImage(ensureScreenBackground(screenIndex), 0, 0);
  // Pfadspur
  if (trail.length > 1) {
    ctx.save();
    ctx.strokeStyle = PAL.friend;
    ctx.globalAlpha = 0.5;
    ctx.lineWidth = 4;
    ctx.setLineDash([10, 12]);
    ctx.beginPath();
    trail.forEach((p, i) => {
      const q = cellCenter(p.c, p.r);
      if (i === 0) ctx.moveTo(q.x, q.y);
      else ctx.lineTo(q.x, q.y);
    });
    ctx.stroke();
    ctx.restore();
  }
  // Felder
  for (let c = 0; c < SETTINGS.cols; c++) {
    for (let r = 0; r < SETTINGS.rows; r++) {
      const f = fields[c] && fields[c][r];
      if (!f || !f.revealed) continue;
      const p = cellCenter(c, r);
      drawFieldIcon(ctx, f, p.x, p.y);
    }
  }
  // Nebel (treibende Wolken über unerforschten Feldern)
  const fog = ensureFogSprite();
  for (let c = 0; c < SETTINGS.cols; c++) {
    for (let r = 0; r < SETTINGS.rows; r++) {
      const f = fields[c] && fields[c][r];
      if (!f || f.revealed) continue;
      const p = cellCenter(c, r);
      const ox = Math.sin(clock * 0.3 + c * 1.7 + r) * 14;
      const oy = Math.cos(clock * 0.25 + r * 2.1 + c) * 8;
      ctx.drawImage(fog, p.x - fog.width / 2 + ox, p.y - fog.height / 2 + oy);
    }
  }
  drawSquadMarker(ctx);
}

function squadXY() {
  if (walk) {
    const a = cellCenter(walk.from.c, walk.from.r);
    const b = cellCenter(walk.to.c, walk.to.r);
    const t = clamp(walk.t / SETTINGS.walkTime, 0, 1);
    const e = t * t * (3 - 2 * t);
    return { x: lerp(a.x, b.x, e), y: lerp(a.y, b.y, e) - Math.sin(t * Math.PI) * 14 };
  }
  return cellCenter(squadPos.c, squadPos.r);
}

function drawSquadMarker(ctx) {
  const p = squadXY();
  const alive = aliveCount();
  ctx.save();
  ctx.shadowColor = PAL.friend;
  ctx.shadowBlur = 12;
  ctx.strokeStyle = PAL.friend;
  ctx.lineWidth = 4;
  ctx.beginPath();
  ctx.arc(p.x, p.y, 26 + Math.sin(clock * 3) * 2, 0, Math.PI * 2);
  ctx.stroke();
  ctx.shadowBlur = 0;
  // kleine Punkte = Trupp-Mitglieder
  for (let i = 0; i < alive; i++) {
    const a = (i / Math.max(1, alive)) * Math.PI * 2 + clock * 0.8;
    ctx.fillStyle = PAL.friend;
    ctx.beginPath();
    ctx.arc(p.x + Math.cos(a) * 14, p.y + Math.sin(a) * 14, 4, 0, Math.PI * 2);
    ctx.fill();
  }
  // Krähen-Wimpel
  ctx.strokeStyle = PAL.text;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(p.x, p.y - 26);
  ctx.lineTo(p.x, p.y - 58);
  ctx.stroke();
  ctx.fillStyle = PAL.accent;
  ctx.beginPath();
  ctx.moveTo(p.x, p.y - 58);
  ctx.lineTo(p.x + 22 + Math.sin(clock * 6) * 3, p.y - 51);
  ctx.lineTo(p.x, p.y - 44);
  ctx.closePath();
  ctx.fill();
  ctx.restore();
}

function drawHud(ctx, title) {
  ctx.save();
  ctx.fillStyle = 'rgba(0,0,0,0.85)';
  ctx.fillRect(0, 0, W, TOP);
  ctx.strokeStyle = PAL.dim;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(0, TOP - 1);
  ctx.lineTo(W, TOP - 1);
  ctx.stroke();
  ctx.restore();
  const leftText = current && current.testMode ? 'MINISPIEL-TEST' : (screenIndex + 1) + '/3 ' + SCREENS[screenIndex].name;
  ctx.save();
  ctx.textAlign = 'left';
  util.renderText({ ctx, text: leftText, x: 30, y: 58, fontSize: '36px', fillStyle: PAL.accent, align: 'left' });
  ctx.restore();
  // Trupp-Symbole
  const sx = 560;
  squad.forEach((s, i) => {
    const x = sx + i * 44;
    const y = 45;
    ctx.save();
    ctx.lineWidth = 3;
    ctx.strokeStyle = s.state === 'ok' ? PAL.friend : s.state === 'wounded' ? PAL.warn : PAL.dim;
    ctx.beginPath();
    ctx.arc(x, y - 10, 8, 0, Math.PI * 2);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(x - 12, y + 18);
    ctx.lineTo(x, y);
    ctx.lineTo(x + 12, y + 18);
    ctx.stroke();
    if (s.state === 'dead') {
      ctx.strokeStyle = PAL.bad;
      ctx.beginPath();
      ctx.moveTo(x - 16, y - 20);
      ctx.lineTo(x + 16, y + 20);
      ctx.moveTo(x + 16, y - 20);
      ctx.lineTo(x - 16, y + 20);
      ctx.stroke();
    }
    ctx.restore();
  });
  const info = title
    ? title
    : 'Proviant ' + res.food + '   Munition ' + res.ammo + '   Verband ' + res.medkits + '   ' + fmtTime(res.hours);
  util.renderText({ ctx, text: info, x: 1450, y: 58, fontSize: '34px', fillStyle: title ? PAL.warn : PAL.text });
}

// ---------------------------------------------------------------------------------------------------------
// Highscore-Panel (eigenes, kleines – die Standardanzeige läge auf den Menü-Knöpfen)
// ---------------------------------------------------------------------------------------------------------

function computeScore() {
  return Math.max(
    0,
    Math.round(
      aliveCount() * SCORE.survivor +
        STATS.minigamesWon * SCORE.minigame +
        res.food +
        res.ammo -
        res.hours * SCORE.hourPenalty
    )
  );
}

function drawHighscorePanel(ctx, x, y) {
  const best = highscore.getHighscore();
  ctx.save();
  ctx.fillStyle = 'rgba(0,0,0,0.7)';
  ctx.fillRect(x - 200, y - 50, 400, best ? 190 : 90);
  ctx.strokeStyle = PAL.dim;
  ctx.lineWidth = 2;
  ctx.strokeRect(x - 200, y - 50, 400, best ? 190 : 90);
  ctx.restore();
  util.renderText({ ctx, text: 'BESTENLISTE', x, y, fontSize: '32px', fillStyle: PAL.accent });
  if (!best) {
    util.renderText({ ctx, text: 'noch leer – wie ein C64 ohne Datasette', x, y: y + 30, fontSize: '20px', fillStyle: PAL.dim });
    return;
  }
  util.renderText({
    ctx,
    text: best.punkte + ' Punkte\n' + best.ueberlebende + ' überlebt · ' + best.minispiele + ' Siege\n' + (best.basis ? 'Basis erreicht' : 'Screen ' + best.screen),
    x,
    y: y + 44,
    fontSize: '28px',
    lineHeight: 38,
    fillStyle: PAL.text,
  });
}

function enterHighscore(reachedBase) {
  finalScore = computeScore();
  highscore.addEntry({
    punkte: finalScore,
    ueberlebende: aliveCount(),
    minispiele: STATS.minigamesWon,
    screen: screenIndex + 1,
    basis: reachedBase ? 1 : 0,
    stunden: res.hours,
  });
  newHighscore = highscore.lastEntryNewHighscore();
}

// ---------------------------------------------------------------------------------------------------------
// Spielablauf: Start, Screens, Abstimmen, Laufen, Felder betreten
// ---------------------------------------------------------------------------------------------------------

function resetRun() {
  ensurePalette();
  squad = makeSquad();
  res = { food: SETTINGS.startFood, ammo: SETTINGS.startAmmo, medkits: SETTINGS.startMedkits, hours: 6 };
  STATS = { steps: 0, minigamesWon: 0, minigamesLost: 0, finds: 0, fallen: 0, wounded: 0, screensDone: 0 };
  particles = [];
  floaters = [];
  shake = 0;
  starveCounter = 0;
  current = null;
  lastResult = null;
  eventCard = null;
  village = null;
  walk = null;
  vote = null;
  newHighscore = false;
  buildMinigamePool();
}

function startRun() {
  resetRun();
  screenIndex = 0;
  generateScreen(0);
  setScene('map');
  playSound(sndTransition, 0.5);
}

const DIRS = [
  { dc: 1, dr: 0, key: 'ArrowRight', label: 'O' },
  { dc: 0, dr: -1, key: 'ArrowUp', label: 'N' },
  { dc: 0, dr: 1, key: 'ArrowDown', label: 'S' },
  { dc: -1, dr: 0, key: 'ArrowLeft', label: 'W' },
];

function buildVote() {
  voteDirs = [];
  const options = [];
  const keyCodes = [];
  DIRS.forEach((d) => {
    const c = squadPos.c + d.dc;
    const r = squadPos.r + d.dr;
    if (c < 0 || r < 0 || c >= SETTINGS.cols || r >= SETTINGS.rows) {
      // rechter Rand: Ausgang zum nächsten Screen
      if (!(d.dc === 1 && c >= SETTINGS.cols)) return;
    }
    let p;
    if (c >= SETTINGS.cols) {
      p = { x: MAP.x1 - 10, y: cellCenter(0, r).y };
    } else {
      const cc = cellCenter(c, r);
      // Pad zum aktuellen Feld hin versetzt, damit Icon/Nebel daneben sichtbar bleiben
      p = { x: lerp(cc.x, cellCenter(squadPos.c, squadPos.r).x, 0.12), y: lerp(cc.y, cellCenter(squadPos.c, squadPos.r).y, 0.12) };
    }
    voteDirs.push({ c, r, exit: c >= SETTINGS.cols });
    options.push({ x: p.x, y: p.y, label: c >= SETTINGS.cols ? 'AUS' : d.label });
    keyCodes.push(d.key);
  });
  vote = guiVoteGroup({
    options,
    radius: SETTINGS.padRadius,
    edges: 8,
    fontSize: 34,
    speedUp: 55,
    speedDown: 18,
    fullPercent: 25,
    keyCodes,
    normalColor: PAL.pad,
    growColor: PAL.padGrow,
    activeColor: PAL.padActive,
    lineWidth: 4,
    showShares: true,
    onDecide: (i) => {
      if (i < 0) return;
      const t = voteDirs[i];
      playSound(sndStep, 0.4);
      if (t.exit) {
        leaveScreen();
        return;
      }
      walk = { from: { c: squadPos.c, r: squadPos.r }, to: { c: t.c, r: t.r }, t: 0 };
      vote = null;
    },
  });
}

function leaveScreen() {
  vote = null;
  STATS.screensDone++;
  if (screenIndex >= SCREENS.length - 1) {
    enterHighscore(true);
    playSound(sndVictory, 0.8);
    setScene('victory');
    return;
  }
  playSound(sndTransition, 0.6);
  setScene('transition');
}

function nextScreen() {
  screenIndex++;
  fogSprite = null;
  generateScreen(screenIndex);
  setScene('map');
}

function stepCosts(f) {
  const cost = f.terrain === 'swamp' ? 2 : 1;
  res.hours += SETTINGS.hoursPerStep * cost;
  STATS.steps++;
  const lines = [];
  if (res.food > 0) {
    res.food = Math.max(0, res.food - cost);
  } else {
    starveCounter++;
    if (starveCounter >= SETTINGS.starveEvery) {
      starveCounter = 0;
      applyCasualties(1).forEach((l) => lines.push('Hunger: ' + l));
    }
  }
  return lines;
}

function arrive() {
  squadPos = { c: walk.to.c, r: walk.to.r };
  walk = null;
  trail.push({ c: squadPos.c, r: squadPos.r });
  if (trail.length > 60) trail.shift();
  reveal(squadPos.c, squadPos.r);
  const f = fields[squadPos.c][squadPos.r];
  const first = !f.visited;
  f.visited = true;
  const hunger = stepCosts(f);
  if (hunger.length) {
    hunger.forEach((l) => addFloater(squadXY().x, squadXY().y - 60, l, PAL.bad));
    if (aliveCount() === 0) return goGameOver();
  }
  if (!first) return; // schon besuchte Felder lösen nichts mehr aus
  if (f.type === 'mg') return startMinigame(f.mg, false);
  if (f.type === 'find') return doFind();
  if (f.type === 'rest') return doRest();
  if (f.type === 'village') return doVillage();
  if (f.type === 'cave') return doCave();
  if (f.terrain === 'swamp') addFloater(squadXY().x, squadXY().y - 60, 'Sumpf: doppelt teuer', PAL.fieldSwamp);
  if (f.type === 'empty' && Math.random() < SETTINGS.randomEncounterChance) {
    return startMinigame(Math.floor(Math.random() * MG_NAMES.length), false);
  }
}

function showEvent(title, lines, color, after) {
  eventCard = { title, lines, color: color || PAL.accent, after: after || null };
  setScene('event');
}

function doFind() {
  STATS.finds++;
  const roll = Math.random();
  let line;
  if (roll < 0.45) {
    const n = 4 + Math.floor(Math.random() * 5);
    res.food += n;
    line = '+' + n + ' Proviant';
  } else if (roll < 0.8) {
    const n = 6 + Math.floor(Math.random() * 10);
    res.ammo += n;
    line = '+' + n + ' Munition';
  } else {
    res.medkits++;
    line = '+1 Verbandskasten';
  }
  const lines = [line];
  // Verbandskasten sofort nutzen, wenn jemand verwundet ist
  if (res.medkits > 0 && squad.some((s) => s.state === 'wounded')) {
    res.medkits--;
    lines.push(healOne() + ' wird verbunden');
  }
  playSound(sndPickup, 0.6);
  showEvent('FUND!', lines, PAL.fieldFind);
}

function doRest() {
  const healed = healAll();
  res.hours += 8;
  const eat = Math.min(res.food, 2);
  res.food -= eat;
  playSound(sndClick, 0.5);
  showEvent('RASTPLATZ', ['Der Trupp schläft 8 Stunden', healed ? healed + ' Verwundete geheilt' : 'Niemand verwundet', '−' + eat + ' Proviant'], PAL.fieldRest);
}

function doCave() {
  const target = Math.min(SETTINGS.cols - 1, squadPos.c + DIFFICULTY.caveJump);
  const lines = ['Ein alter Schmugglertunnel!', 'Der Trupp kommt ' + (target - squadPos.c) + ' Felder weiter wieder heraus.'];
  playSound(sndSonar, 0.5);
  showEvent('HÖHLE', lines, PAL.fieldCave, () => {
    squadPos = { c: target, r: squadPos.r };
    fields[target][squadPos.r].visited = true;
    trail.push({ c: squadPos.c, r: squadPos.r });
    reveal(squadPos.c, squadPos.r);
    res.hours += 3;
  });
}

function doVillage() {
  village = {
    vote: guiVoteGroup({
      options: [
        { x: 520, y: 700, label: 'Proviant' },
        { x: 960, y: 700, label: 'Munition' },
        { x: 1400, y: 700, label: 'Weiter' },
      ],
      radius: 120,
      edges: 8,
      fontSize: 38,
      speedUp: 45,
      speedDown: 15,
      fullPercent: 25,
      timeLimit: 20,
      keyCodes: ['Digit1', 'Digit2', 'Digit3'],
      normalColor: PAL.pad,
      growColor: PAL.padGrow,
      activeColor: PAL.padActive,
      onDecide: (i) => {
        let line = 'Der Trupp zieht weiter.';
        if (i === 0) {
          const pay = Math.min(res.ammo, 8);
          res.ammo -= pay;
          res.food += 8;
          line = pay + ' Munition gegen 8 Proviant getauscht';
        } else if (i === 1) {
          const pay = Math.min(res.food, 6);
          res.food -= pay;
          res.ammo += 12;
          line = pay + ' Proviant gegen 12 Munition getauscht';
        }
        playSound(sndPickup, 0.5);
        village.doneText = line;
        village.doneTime = 0;
      },
    }),
    doneText: null,
    doneTime: 0,
  };
  setScene('village');
}

// ---------------------------------------------------------------------------------------------------------
// Minispiele starten und auswerten
// ---------------------------------------------------------------------------------------------------------

function startMinigame(index, testMode) {
  const level = testMode ? testDifficulty : screenIndex;
  let game = null;
  try {
    game = MINIGAMES[index]({ level, squadCount: testMode ? SETTINGS.squadSize : aliveCount(), ammo: testMode ? 30 : res.ammo, testMode });
  } catch (e) {
    console.error('Minispiel', index, 'konnte nicht starten', e);
    game = null;
  }
  current = { index, game, testMode, title: (game && game.title) || MG_NAMES[index], hint: (game && game.hint) || '' };
  setScene('intro');
}

function finishMinigame(result) {
  const r = result || { win: true, casualties: 0, loot: { food: 0, ammo: 0 }, text: '' };
  const loot = r.loot || { food: 0, ammo: 0 };
  const lines = [];
  if (r.text) lines.push(r.text);
  if (current.testMode) {
    testLastText = current.title + ': ' + (r.win ? 'GEWONNEN' : 'VERLOREN') + (r.casualties ? ' · ' + r.casualties + ' Verluste' : '');
    lastResult = { title: current.title, win: !!r.win, lines: lines.concat(['Verluste: ' + (r.casualties || 0), 'Beute: ' + (loot.food || 0) + ' Proviant, ' + (loot.ammo || 0) + ' Munition']) };
  } else {
    if (r.win) STATS.minigamesWon++;
    else STATS.minigamesLost++;
    applyCasualties(Math.max(0, r.casualties || 0)).forEach((l) => lines.push(l));
    if (loot.food) {
      res.food = Math.max(0, res.food + loot.food);
      lines.push((loot.food > 0 ? '+' : '') + loot.food + ' Proviant');
    }
    if (loot.ammo) {
      res.ammo = Math.max(0, res.ammo + loot.ammo);
      lines.push((loot.ammo > 0 ? '+' : '') + loot.ammo + ' Munition');
    }
    lastResult = { title: current.title, win: !!r.win, lines };
  }
  playSound(r.win ? sndWin : sndError, 0.6);
  setScene('result');
}

function goGameOver() {
  enterHighscore(false);
  playSound(sndGameOver, 0.7);
  setScene('gameover');
}

// ---------------------------------------------------------------------------------------------------------
// Szenen
// ---------------------------------------------------------------------------------------------------------

function drawCard(ctx, title, lines, color, sub) {
  ctx.save();
  ctx.fillStyle = 'rgba(0,0,0,0.78)';
  ctx.fillRect(260, 260, W - 520, 560);
  ctx.strokeStyle = color;
  ctx.lineWidth = 4;
  ctx.strokeRect(260, 260, W - 520, 560);
  ctx.restore();
  util.renderText({ ctx, text: title, x: W / 2, y: 380, fontSize: '96px', fillStyle: color });
  util.renderText({ ctx, text: lines.join('\n'), x: W / 2, y: 470, fontSize: '40px', lineHeight: 56, fillStyle: PAL.text });
  if (sub) util.renderText({ ctx, text: sub, x: W / 2, y: 790, fontSize: '26px', fillStyle: PAL.dim });
}

function handleTitle(grid, dt, ctx) {
  const bg = ensureTitleCanvas();
  const ox = Math.sin(clock * 0.07) * 40;
  ctx.drawImage(bg, -40 + ox, 0, W + 80, H);
  // treibender Nebel
  const fog = ensureFogSprite();
  for (let i = 0; i < 10; i++) {
    const x = ((clock * (20 + i * 6) + i * 260) % (W + 400)) - 200;
    const y = 120 + ((i * 97) % 800);
    ctx.drawImage(fog, x, y);
  }
  util.renderText({ ctx, text: 'TRUPP NEBELKRÄHE', x: W / 2, y: 230, fontSize: '140px', fillStyle: PAL.accent });
  util.renderText({
    ctx,
    text: 'Abgeschnitten hinter dem Grenzfluss. Drei Gebiete bis zur Basis.\nDer ganze Saal führt den Trupp – stimmt ab, wohin es geht, und besteht die Begegnungen.',
    x: W / 2,
    y: 320,
    fontSize: '36px',
    lineHeight: 52,
    fillStyle: PAL.text,
  });
  if (!buttons.start) {
    buttons.start = makeButton('START', 700, 640, 140, () => startRun(), 8);
    buttons.test = makeButton('TEST', 1220, 640, 110, () => setScene('test'), 6);
  }
  // lokale Referenz: ein Knopf kann die Szene wechseln (setScene leert buttons) – danach nichts mehr anfassen
  const bs = buttons;
  darkDisk(ctx, 700, 640, 150);
  darkDisk(ctx, 1220, 640, 120);
  bs.start.handle(grid, dt);
  bs.test.handle(grid, dt);
  util.renderText({ ctx, text: 'MINISPIEL-TEST (P)', x: 1220, y: 800, fontSize: '28px', fillStyle: PAL.dim });
  util.renderText({ ctx, text: 'Leertaste = Start', x: 700, y: 820, fontSize: '28px', fillStyle: PAL.dim });
  drawHighscorePanel(ctx, W / 2, 930);
  util.renderText({ ctx, text: 'nach Lost Patrol (Ocean, Amiga 1990)', x: W - 260, y: H - 30, fontSize: '22px', fillStyle: PAL.dim });
  if (sceneTime > 0.3 && keyEdge('Space')) startRun();
  if (keyEdge('KeyP')) setScene('test');
}

function handleTest(grid, dt, ctx) {
  ctx.drawImage(ensureTitleCanvas(), 0, 0);
  ctx.save();
  ctx.fillStyle = 'rgba(0,0,0,0.55)';
  ctx.fillRect(0, 0, W, H);
  ctx.restore();
  util.renderText({ ctx, text: 'MINISPIEL-TEST', x: W / 2, y: 130, fontSize: '90px', fillStyle: PAL.accent });
  util.renderText({ ctx, text: 'Feld anleuchten oder Taste drücken · J = Schwierigkeit · Escape = zurück', x: W / 2, y: 190, fontSize: '30px', fillStyle: PAL.dim });
  if (!buttons.mg) {
    buttons.mg = MG_NAMES.map((name, i) => {
      const x = 190 + (i % 7) * 257;
      const y = i < 7 ? 380 : 640;
      return makeButton('', x, y, 88, () => startMinigame(i, true), 6);
    });
    buttons.diff = makeButton('', 1540, 900, 95, () => {
      testDifficulty = (testDifficulty + 1) % 3;
    }, 8);
    buttons.back = makeButton('', 380, 900, 95, () => setScene('title'), 8);
  }
  const bs = buttons; // siehe handleTitle
  bs.mg.forEach((b, i) => {
    const x = 190 + (i % 7) * 257;
    const y = i < 7 ? 380 : 640;
    darkDisk(ctx, x, y, 96);
    b.handle(grid, dt);
    util.renderText({ ctx, text: MG_KEY_LABELS[i], x, y: y + 18, fontSize: '50px', fillStyle: PAL.pad });
    util.renderText({ ctx, text: (i + 1) + '. ' + MG_NAMES[i], x, y: y + 130, fontSize: '26px', fillStyle: PAL.text });
  });
  darkDisk(ctx, 1540, 900, 104);
  bs.diff.handle(grid, dt);
  util.renderText({ ctx, text: 'Schwer ' + (testDifficulty + 1) + '/3', x: 1540, y: 910, fontSize: '28px', fillStyle: PAL.warn });
  darkDisk(ctx, 380, 900, 104);
  bs.back.handle(grid, dt);
  util.renderText({ ctx, text: 'ZURÜCK', x: 380, y: 910, fontSize: '28px', fillStyle: PAL.text });
  if (testLastText) util.renderText({ ctx, text: 'Zuletzt: ' + testLastText, x: W / 2, y: 910, fontSize: '34px', fillStyle: PAL.good });
  if (sceneTime > 0.3) {
    MG_KEYS.forEach((k, i) => {
      if (keyEdge(k) && scene === 'test') startMinigame(i, true);
    });
  }
  if (keyEdge('KeyJ')) testDifficulty = (testDifficulty + 1) % 3;
  if (keyEdge('Escape')) setScene('title');
}

function handleMap(grid, dt, ctx) {
  drawMap(ctx);
  if (walk) {
    walk.t += dt;
    if (walk.t >= SETTINGS.walkTime) arrive();
  } else if (scene === 'map') {
    if (!vote) buildVote();
    drawPadBacks(ctx); // schwarze Scheiben unter den Pads (Licht-Disziplin)
    vote.handle(grid, dt);
    util.renderText({ ctx, text: 'Wohin? Pad gemeinsam anleuchten!', x: W / 2, y: H - 30, fontSize: '30px', fillStyle: PAL.dim });
  }
  if (keyEdge('KeyB') && scene === 'map') leaveScreen();
  if (keyEdge('Escape') && scene === 'map') setScene('title'); // Spielleitung: zurück ins Hauptmenü (Lauf bleibt nicht erhalten)
}

// Pad-Hintergründe: an denselben Stellen wie die voteGroup-Optionen
function drawPadBacks(ctx) {
  const cur = cellCenter(squadPos.c, squadPos.r);
  voteDirs.forEach((t) => {
    let x;
    let y;
    if (t.exit) {
      x = MAP.x1 - 10;
      y = cellCenter(0, t.r).y;
    } else {
      const cc = cellCenter(t.c, t.r);
      x = lerp(cc.x, cur.x, 0.12);
      y = lerp(cc.y, cur.y, 0.12);
    }
  //  darkDisk(ctx, x, y, SETTINGS.padRadius + 6);
  });
}

function handleEvent(grid, dt, ctx) {
  drawMap(ctx);
  drawCard(ctx, eventCard.title, eventCard.lines, eventCard.color, 'weiter in ' + Math.max(0, Math.ceil(SETTINGS.eventDuration - sceneTime)) + ' s (Leertaste)');
  if (sceneTime > SETTINGS.eventDuration || (sceneTime > 0.4 && keyEdge('Space'))) {
    const after = eventCard.after;
    eventCard = null;
    if (after) after();
    setScene('map');
  }
}

function handleVillage(grid, dt, ctx) {
  drawMap(ctx);
  ctx.save();
  ctx.fillStyle = 'rgba(0,0,0,0.82)';
  ctx.fillRect(0, TOP, W, H - TOP);
  ctx.restore();
  util.renderText({ ctx, text: 'DORF AM WEGESRAND', x: W / 2, y: 260, fontSize: '90px', fillStyle: PAL.fieldVillage });
  util.renderText({
    ctx,
    text: 'Die Leute hier tauschen – was braucht der Trupp?\nProviant: 8 Munition → 8 Proviant · Munition: 6 Proviant → 12 Munition',
    x: W / 2,
    y: 350,
    fontSize: '34px',
    lineHeight: 50,
    fillStyle: PAL.text,
  });
  [520, 960, 1400].forEach((x) => darkDisk(ctx, x, 700, 130));
  village.vote.handle(grid, dt);
  if (village.doneText) {
    village.doneTime += dt;
    util.renderText({ ctx, text: village.doneText, x: W / 2, y: 940, fontSize: '44px', fillStyle: PAL.good });
    if (village.doneTime > 1.8) {
      village = null;
      setScene('map');
    }
  }
}

function handleIntro(grid, dt, ctx) {
  ctx.drawImage(ensureScreenBackground(screenIndex), 0, 0);
  ctx.save();
  ctx.fillStyle = 'rgba(0,0,0,0.8)';
  ctx.fillRect(0, TOP, W, H - TOP);
  ctx.restore();
  const pulse = 1 + Math.sin(clock * 6) * 0.03;
  ctx.save();
  ctx.translate(W / 2, 440);
  ctx.scale(pulse, pulse);
  util.renderText({ ctx, text: 'BEGEGNUNG', x: 0, y: -120, fontSize: '44px', fillStyle: PAL.warn });
  util.renderText({ ctx, text: current.title.toUpperCase(), x: 0, y: 0, fontSize: '120px', fillStyle: PAL.accent });
  ctx.restore();
  util.renderText({ ctx, text: current.hint || '', x: W / 2, y: 600, fontSize: '40px', lineHeight: 56, fillStyle: PAL.text });
  const left = Math.max(0, SETTINGS.introDuration - sceneTime);
  ctx.save();
  ctx.strokeStyle = PAL.warn;
  ctx.lineWidth = 8;
  ctx.beginPath();
  ctx.arc(W / 2, 820, 60, -Math.PI / 2, -Math.PI / 2 + (Math.PI * 2 * left) / SETTINGS.introDuration);
  ctx.stroke();
  ctx.restore();
  util.renderText({ ctx, text: String(Math.ceil(left)), x: W / 2, y: 840, fontSize: '56px', fillStyle: PAL.warn });
  if (sceneTime > SETTINGS.introDuration || (sceneTime > 0.3 && keyEdge('Space'))) {
    if (!current.game) finishMinigame({ win: true, casualties: 0, loot: { food: 0, ammo: 0 }, text: 'Minispiel fehlt noch' });
    else setScene('minigame');
  }
}

function handleMinigame(grid, dt, ctx) {
  let result = null;
  ctx.save();
  if (shake > 0) ctx.translate((Math.random() - 0.5) * shake, (Math.random() - 0.5) * shake);
  try {
    result = current.game.update(grid, dt, ctx);
  } catch (e) {
    console.error('Minispiel-Fehler in', current.title, e);
    result = { win: true, casualties: 0, loot: { food: 0, ammo: 0 }, text: 'Glück gehabt (Fehler im Minispiel)' };
  }
  ctx.restore();
  updateEffects(dt, ctx);
  drawHud(ctx, current.title);
  if (!result && keyEdge('KeyN')) result = { win: true, casualties: 0, loot: { food: 0, ammo: 0 }, text: 'Test: als gewonnen gewertet' };
  if (result) finishMinigame(result);
}

function handleResult(grid, dt, ctx) {
  if (lastResult && !current.testMode) drawMap(ctx);
  else ctx.drawImage(ensureScreenBackground(screenIndex), 0, 0);
  const color = lastResult.win ? PAL.good : PAL.bad;
  drawCard(ctx, lastResult.win ? 'GESCHAFFT!' : 'ÜBEL ERWISCHT', [lastResult.title].concat(lastResult.lines), color, 'weiter (Leertaste)');
  if (sceneTime > SETTINGS.resultDuration || (sceneTime > 0.5 && keyEdge('Space'))) {
    const test = current.testMode;
    current = null;
    if (test) setScene('test');
    else if (aliveCount() === 0) goGameOver();
    else setScene('map');
  }
}

function handleTransition(grid, dt, ctx) {
  const t = clamp(sceneTime / SETTINGS.transitionDuration, 0, 1);
  ctx.drawImage(ensureScreenBackground(screenIndex), -t * 400, 0);
  ctx.save();
  ctx.globalAlpha = t;
  ctx.drawImage(ensureScreenBackground(Math.min(2, screenIndex + 1)), W - t * W, 0);
  ctx.restore();
  ctx.save();
  ctx.fillStyle = 'rgba(0,0,0,0.6)';
  ctx.fillRect(0, 300, W, 420);
  ctx.restore();
  util.renderText({ ctx, text: SCREENS[screenIndex].name + ' durchquert!', x: W / 2, y: 420, fontSize: '80px', fillStyle: PAL.good });
  util.renderText({ ctx, text: 'Weiter: ' + SCREENS[screenIndex + 1].name, x: W / 2, y: 540, fontSize: '64px', fillStyle: PAL.accent });
  util.renderText({ ctx, text: aliveCount() + ' von 8 dabei · ' + fmtTime(res.hours), x: W / 2, y: 640, fontSize: '38px', fillStyle: PAL.text });
  if (sceneTime > SETTINGS.transitionDuration || (sceneTime > 0.5 && keyEdge('Space'))) nextScreen();
}

function drawEndStats(ctx, y) {
  const lines = [
    'Überlebende: ' + aliveCount() + ' / 8   ·   Gefallen: ' + squad.filter((s) => s.state === 'dead').length,
    'Minispiele gewonnen: ' + STATS.minigamesWon + '   ·   verloren: ' + STATS.minigamesLost,
    'Schritte: ' + STATS.steps + '   ·   Funde: ' + STATS.finds + '   ·   ' + fmtTime(res.hours),
    finalScore + ' Punkte' + (newHighscore ? '  –  NEUER HIGHSCORE! Ab in die Bestenliste wie 1990.' : ''),
  ];
  util.renderText({ ctx, text: lines.join('\n'), x: W / 2, y, fontSize: '38px', lineHeight: 56, fillStyle: PAL.text });
}

function handleEnd(grid, dt, ctx, won) {
  ctx.drawImage(ensureScreenBackground(screenIndex), 0, 0);
  ctx.save();
  ctx.fillStyle = 'rgba(0,0,0,0.75)';
  ctx.fillRect(0, 0, W, H);
  ctx.restore();
  if (won && Math.random() < 0.2) burst(Math.random() * W, 200 + Math.random() * 300, PAL.good, 18, 300);
  updateEffects(dt, ctx);
  util.renderText({ ctx, text: won ? 'BASIS ERREICHT!' : 'TRUPP VERLOREN', x: W / 2, y: 190, fontSize: '130px', fillStyle: won ? PAL.good : PAL.bad });
  util.renderText({ ctx, text: won ? 'Nebelkrähe ist zurück.' : 'Im ' + SCREENS[screenIndex].name + ' verliert sich die Spur.', x: W / 2, y: 260, fontSize: '40px', fillStyle: PAL.dim });
  drawEndStats(ctx, 340);
  if (sceneTime > 1.5) {
    if (!buttons.again) {
      buttons.again = makeButton('NOCHMAL', 640, 760, 110, () => startRun(), 8);
      buttons.menu = makeButton('MENÜ', 1280, 760, 90, () => setScene('title'), 6);
    }
    darkDisk(ctx, 640, 760, 120);
    darkDisk(ctx, 1280, 760, 100);
    const bs = buttons; // siehe handleTitle
    bs.again.handle(grid, dt);
    bs.menu.handle(grid, dt);
    if (keyEdge('Space')) startRun();
  }
  drawHighscorePanel(ctx, W / 2, 940);
}

// @@MINIGAMES@@ (eingefügt: Minispiele 1–14)
// =========================================================================================================
// MINISPIELE A (1–5): Feuergefecht, Scharfschütze, Minenfeld, Nachtwache, Fluss
// Vertrag: mgXyz(opts) → { id, title, hint, update(grid, dt, ctx) }; update liefert null, solange es läuft,
// und genau einmal { win, casualties, loot: { food, ammo }, text }.
// Gemeinsame Helfer haben das Präfix mga…, jedes Minispiel sein eigenes (ff, ss, mf, nw, fl).
// Licht-Disziplin: Laser-Ziele (Pads) sind schwarz gefüllt und nur konturiert, Füllstand als Ring außen.
// =========================================================================================================

/** Unsichtbarer pixelFillButton als Laser-Ziel (Füllung ∝ bedeckter Fläche, mehr Laser = schneller). */
function mgaPad(x, y, r, o) {
  o = o || {};
  return guiPixelFillButton({
    label: '',
    posX: x,
    posY: y,
    radius: r,
    edges: 24,
    speedUp: o.speedUp || 140,
    speedDown: o.speedDown || 35,
    fullPercent: o.fullPercent || 22,
    minPercent: 0,
    activeValue: 99,
    minValue: 1,
    visible: false,
  });
}

/** Test-Helfer (Taste K): füllt ein Pad, als würde der Saal draufleuchten. */
function mgaKeyFill(pad, dt, rate) {
  if (isKeyDown('KeyK')) pad.setValue(Math.min(100, pad.getValue() + (rate || 170) * dt));
}

/** Pad zeichnen: schwarz gefüllt, Kontur, Füllring außen. */
function mgaDrawPad(ctx, x, y, r, value, color, label, alpha) {
  ctx.save();
  ctx.globalAlpha = alpha === undefined ? 0.85 : alpha;
  ctx.fillStyle = '#000000';
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.fill();
  ctx.globalAlpha = 1;
  ctx.strokeStyle = color;
  ctx.lineWidth = 3;
  ctx.stroke();
  if (value > 0.5) {
    ctx.lineWidth = 8;
    ctx.beginPath();
    ctx.arc(x, y, r + 9, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * Math.min(1, value / 100));
    ctx.stroke();
  }
  ctx.restore();
  if (label) util.renderText({ ctx, text: label, x, y: y + 10, fontSize: '26px', fillStyle: color });
}

/** Fortschritts-/Zeitbalken oben im Minispiel-Bereich, optional mit Text darunter. */
function mgaBar(ctx, frac, label, color) {
  const x0 = 420;
  const x1 = W - 420;
  const y = TOP + 26;
  ctx.save();
  ctx.fillStyle = '#000000';
  ctx.fillRect(x0, y - 12, x1 - x0, 24);
  ctx.strokeStyle = PAL.dim;
  ctx.lineWidth = 2;
  ctx.strokeRect(x0, y - 12, x1 - x0, 24);
  ctx.fillStyle = color || PAL.accent;
  ctx.fillRect(x0 + 3, y - 9, (x1 - x0 - 6) * clamp(frac, 0, 1), 18);
  ctx.restore();
  if (label) util.renderText({ ctx, text: label, x: W / 2, y: y + 54, fontSize: '34px', fillStyle: PAL.text });
}

function mgaCanvas(w, h) {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  return c;
}

/** Einfacher Pseudo-Zufall mit Startwert (damit vorgerenderte Hintergründe stabil bleiben). */
function mgaRng(seed) {
  let s = seed || 1;
  return () => {
    s = (s * 16807) % 2147483647;
    return (s - 1) / 2147483646;
  };
}

/** Dschungel-Silhouetten in Ebenen (vorrendern!): je weiter hinten, desto heller/blasser. */
function mgaJungle(w, h, seed, layers) {
  const c = mgaCanvas(w, h);
  const g = c.getContext('2d');
  const rnd = mgaRng(seed);
  const grad = g.createLinearGradient(0, 0, 0, h);
  grad.addColorStop(0, getRgbSpreadHex(laserConfig.testColor, 0.45, 0.6, 0.1));
  grad.addColorStop(1, '#010302');
  g.fillStyle = grad;
  g.fillRect(0, 0, w, h);
  const n = layers || 4;
  for (let l = 0; l < n; l++) {
    const val = 0.2 - l * 0.04;
    g.fillStyle = getRgbSpreadHex(laserConfig.testColor, 0.38 + l * 0.03, 0.7, Math.max(0.03, val));
    const base = h * (0.35 + l * 0.15);
    // Baumkronen als Kreis-Ketten, Farnwedel als Bögen
    for (let x = -40; x < w + 80; x += 40 + rnd() * 60) {
      const r = 40 + rnd() * 90 - l * 6;
      g.beginPath();
      g.arc(x, base - rnd() * 80, Math.max(20, r), 0, Math.PI * 2);
      g.fill();
    }
    g.fillRect(0, base, w, h - base);
    // Farne
    g.strokeStyle = g.fillStyle;
    g.lineWidth = 4;
    for (let i = 0; i < 12; i++) {
      const fx = rnd() * w;
      const fy = base - 20 - rnd() * 60;
      for (let k = -3; k <= 3; k++) {
        g.beginPath();
        g.moveTo(fx, fy + 60);
        g.quadraticCurveTo(fx + k * 20, fy, fx + k * 34, fy + 20 + Math.abs(k) * 6);
        g.stroke();
      }
    }
  }
  return c;
}

/** Soldat als dunkle Silhouette mit Kontur (y = Füße). kind: 'friend' | 'enemy'. */
function mgaFigure(ctx, x, y, s, color, kind, sway) {
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(s, s);
  ctx.rotate(sway || 0);
  ctx.fillStyle = '#04070a';
  ctx.strokeStyle = color;
  ctx.lineWidth = 3 / s;
  ctx.lineJoin = 'round';
  ctx.beginPath();
  // Beine
  ctx.moveTo(-9, 0);
  ctx.lineTo(-6, -32);
  ctx.lineTo(6, -32);
  ctx.lineTo(9, 0);
  ctx.lineTo(3, 0);
  ctx.lineTo(0, -22);
  ctx.lineTo(-3, 0);
  ctx.closePath();
  // Rumpf
  ctx.moveTo(-12, -32);
  ctx.lineTo(-14, -58);
  ctx.lineTo(14, -58);
  ctx.lineTo(12, -32);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
  // Kopf
  ctx.beginPath();
  ctx.arc(0, -67, 8, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();
  // Kopfbedeckung: eigene Leute runder Helm, Gegner Schirmmütze
  ctx.beginPath();
  if (kind === 'enemy') {
    ctx.moveTo(-9, -71);
    ctx.lineTo(9, -71);
    ctx.lineTo(17, -69);
    ctx.lineTo(9, -78);
    ctx.lineTo(-8, -78);
  } else {
    ctx.arc(0, -69, 11, Math.PI, 0);
  }
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
  // Gewehr
  ctx.beginPath();
  ctx.moveTo(-10, -50);
  ctx.lineTo(kind === 'enemy' ? -34 : 34, -56);
  ctx.lineWidth = 4 / s;
  ctx.stroke();
  ctx.restore();
}

// ---------------------------------------------------------------------------------------------------------
// 1. FEUERGEFECHT – Gegner tauchen hinter Deckung auf, anleuchten = Treffer. Eigene Leute nicht anleuchten!
// ---------------------------------------------------------------------------------------------------------

const FF = {
  duration: [36, 33, 30],
  hitsNeeded: [8, 12, 16],
  maxUp: [2, 3, 4],
  spawnEvery: [1.6, 1.2, 0.9],
  upTime: [4.6, 3.6, 2.8], // so lange bis der Gegner schießt
  firesPerCasualty: [4, 3, 2],
  friendEvery: [9, 7, 5.5],
};

const FF_COVERS = [
  { x: 250, y: 740, type: 'bush' },
  { x: 560, y: 830, type: 'log' },
  { x: 860, y: 720, type: 'ruin' },
  { x: 1170, y: 820, type: 'bush' },
  { x: 1460, y: 730, type: 'log' },
  { x: 1700, y: 840, type: 'ruin' },
];

var ffBackground = null;

function ffDrawCover(ctx, c) {
  ctx.save();
  ctx.fillStyle = '#020403';
  ctx.strokeStyle = PAL.jungle;
  ctx.lineWidth = 3;
  ctx.beginPath();
  if (c.type === 'bush') {
    for (let i = -2; i <= 2; i++) ctx.arc(c.x + i * 38, c.y - 18 - (2 - Math.abs(i)) * 14, 46, 0, Math.PI * 2);
    ctx.rect(c.x - 120, c.y - 20, 240, 60);
  } else if (c.type === 'log') {
    ctx.moveTo(c.x - 130, c.y - 50);
    ctx.lineTo(c.x + 130, c.y - 56);
    ctx.arc(c.x + 130, c.y - 28, 28, -Math.PI / 2, Math.PI / 2);
    ctx.lineTo(c.x - 130, c.y);
    ctx.arc(c.x - 130, c.y - 25, 25, Math.PI / 2, -Math.PI / 2);
    ctx.rect(c.x - 140, c.y - 4, 280, 50);
  } else {
    ctx.rect(c.x - 115, c.y - 70, 70, 120);
    ctx.rect(c.x - 45, c.y - 40, 90, 90);
    ctx.rect(c.x + 45, c.y - 95, 70, 145);
  }
  ctx.fill();
  ctx.stroke();
  ctx.restore();
}

function mgFeuergefecht(opts) {
  const lv = clamp(opts.level || 0, 0, 2);
  if (!ffBackground) ffBackground = mgaJungle(W, H - TOP, 4711, 4);
  let time = 0;
  let hits = 0;
  let fires = 0;
  let casualties = 0;
  let spawnTimer = 1;
  let friendTimer = FF.friendEvery[lv] * 0.6;
  let finished = false;
  const enemies = []; // { cover, rise, up, pad, state: 'rise'|'up'|'down', fireFlash }
  const friends = []; // { x, y, speed, pad, down }

  function freeCover() {
    const free = FF_COVERS.filter((c) => !enemies.some((e) => e.cover === c));
    return free.length ? free[Math.floor(Math.random() * free.length)] : null;
  }

  function finish(win, text) {
    finished = true;
    return { win, casualties: Math.min(casualties, opts.squadCount || 99), loot: { food: 0, ammo: win ? 2 + Math.floor(hits / 4) : 0 }, text };
  }

  return {
    id: 'feuergefecht',
    title: 'FEUERGEFECHT',
    hint: 'Gegner hinter der Deckung anleuchten! Eigene Leute NICHT treffen.',
    update(grid, dt, ctx) {
      if (finished) return null;
      time += dt;
      // --- Spawnen
      spawnTimer -= dt;
      if (spawnTimer <= 0 && enemies.length < FF.maxUp[lv]) {
        const c = freeCover();
        if (c) {
          enemies.push({ cover: c, rise: 0, up: 0, state: 'rise', pad: mgaPad(c.x, c.y - 120, 62), fireFlash: 0 });
          spawnTimer = FF.spawnEvery[lv] * (0.7 + Math.random() * 0.6);
        }
      }
      friendTimer -= dt;
      if (friendTimer <= 0) {
        const dir = Math.random() < 0.5 ? 1 : -1;
        friends.push({ x: dir > 0 ? -60 : W + 60, y: 1010, speed: dir * (240 + lv * 40), pad: mgaPad(0, 0, 60, { speedUp: 160 }), down: 0 });
        friendTimer = FF.friendEvery[lv] * (0.8 + Math.random() * 0.4);
      }
      // --- Gegner
      enemies.slice().forEach((e) => {
        if (e.state === 'rise') {
          e.rise = Math.min(1, e.rise + dt * 3);
          if (e.rise >= 1) e.state = 'up';
        } else if (e.state === 'up') {
          e.up += dt;
          if (e.up > FF.upTime[lv]) {
            // Schuss!
            e.fireFlash = 0.25;
            e.up = 0;
            fires++;
            playSound(SND.shot, 0.5);
            addShake(6);
            if (fires % FF.firesPerCasualty[lv] === 0) {
              casualties++;
              addFloater(W / 2, 960, 'Mann getroffen!', PAL.bad);
            } else {
              addFloater(e.cover.x, e.cover.y - 200, 'Knapp vorbei!', PAL.warn);
            }
          }
        } else {
          e.rise -= dt * 4;
          if (e.rise <= 0) enemies.splice(enemies.indexOf(e), 1);
          return;
        }
        e.fireFlash = Math.max(0, e.fireFlash - dt);
        const py = e.cover.y - 60 - e.rise * 70;
        e.pad.setY(py);
        if (e.state === 'up') {
          mgaKeyFill(e.pad, dt, 220);
          e.pad.handle(grid, dt);
          if (e.pad.getValue() >= 98) {
            hits++;
            e.state = 'down';
            burst(e.cover.x, py, PAL.enemy, 24, 380);
            addFloater(e.cover.x, py - 80, 'TREFFER', PAL.good);
            playSound(SND.hit, 0.5);
          }
        }
      });
      // --- Eigene Leute laufen durchs Bild
      friends.slice().forEach((f) => {
        if (f.down > 0) {
          f.down += dt;
          if (f.down > 1.5) friends.splice(friends.indexOf(f), 1);
          return;
        }
        f.x += f.speed * dt;
        f.pad.setX(f.x);
        f.pad.setY(f.y - 60);
        f.pad.handle(grid, dt);
        if (f.pad.getValue() >= 70) {
          f.down = 0.01;
          casualties++;
          addShake(10);
          burst(f.x, f.y - 60, PAL.bad, 30, 300);
          addFloater(f.x, f.y - 160, 'EIGENE LEUTE!', PAL.bad);
          playSound(SND.error, 0.7);
        }
        if (f.x < -100 || f.x > W + 100) friends.splice(friends.indexOf(f), 1);
      });

      // --- Zeichnen
      ctx.drawImage(ffBackground, 0, TOP);
      enemies.forEach((e) => {
        const footY = e.cover.y + 20 + (1 - e.rise) * 120;
        mgaFigure(ctx, e.cover.x, footY, 2, PAL.enemy, 'enemy', 0);
        if (e.fireFlash > 0) {
          ctx.save();
          ctx.globalCompositeOperation = 'lighter';
          ctx.fillStyle = PAL.warn;
          ctx.beginPath();
          ctx.arc(e.cover.x - 70, footY - 112, 26 * (e.fireFlash / 0.25), 0, Math.PI * 2);
          ctx.fill();
          ctx.restore();
        }
      });
      FF_COVERS.forEach((c) => ffDrawCover(ctx, c));
      enemies.forEach((e) => {
        if (e.state !== 'up') return;
        // Warnring: wird rot, kurz bevor er schießt
        const danger = e.up / FF.upTime[lv];
        mgaDrawPad(ctx, e.cover.x, e.pad.getY(), 62, e.pad.getValue(), danger > 0.7 ? PAL.bad : PAL.enemy, '', 0.25);
      });
      friends.forEach((f) => {
        const sway = f.down > 0 ? Math.min(1.4, f.down * 3) * Math.sign(f.speed) : Math.sin(time * 12) * 0.05;
        mgaFigure(ctx, f.x, f.y, 1.7, PAL.friend, 'friend', sway);
        if (f.down === 0 && f.pad.getValue() > 5) {
          util.renderText({ ctx, text: 'NICHT SCHIESSEN!', x: f.x, y: f.y - 170, fontSize: '28px', fillStyle: PAL.bad });
        }
      });
      const left = Math.max(0, FF.duration[lv] - time);
      mgaBar(ctx, hits / FF.hitsNeeded[lv], 'Treffer ' + hits + '/' + FF.hitsNeeded[lv] + '   ·   ' + Math.ceil(left) + ' s', PAL.good);

      // --- Ende
      if (keyEdge('KeyX')) return finish(false, 'Rückzug! Der Trupp zieht sich zurück.');
      if (casualties >= (opts.squadCount || 99)) return finish(false, 'Der Trupp ist aufgerieben …');
      if (hits >= FF.hitsNeeded[lv]) return finish(true, 'Feindstellung ausgeschaltet! Munition erbeutet.');
      if (left <= 0) {
        casualties++;
        return finish(false, 'Zu langsam – der Feind hält die Stellung. Ein Mann verloren beim Rückzug.');
      }
      return null;
    },
  };
}

// ---------------------------------------------------------------------------------------------------------
// 2. SCHARFSCHÜTZE – Fernglas-Ansicht. Im Dickicht blitzt kurz ein Zielfernrohr auf. Alle Laser bündeln
//    (aimTurret: Schwerpunkt + Fokus), Fadenkreuz ruhig auf die Stelle halten → Schuss.
//    Wildes Leuchten = großer Streukreis = kein Treffer (Teamwork statt Einzelkämpfer).
// ---------------------------------------------------------------------------------------------------------

const SS = {
  snipers: [3, 4, 5],
  duration: [42, 42, 40],
  hidden: [1.6, 1.3, 1.0], // Pause vor dem Aufblitzen
  glint: [2.2, 1.6, 1.1], // so lange blitzt es
  aim: [4.0, 3.2, 2.5], // danach zielt er noch so lange, dann Schuss
  holdNeeded: [0.9, 1.1, 1.2], // s Fadenkreuz ruhig auf ihm
  hitRadius: [95, 80, 70],
  minFocus: [0.45, 0.55, 0.6],
};
const SS_CX = 960;
const SS_CY = 590;
const SS_R = 440;

var ssScope = null;

function ssRenderScope() {
  const c = mgaCanvas(SS_R * 2, SS_R * 2);
  const g = c.getContext('2d');
  const rnd = mgaRng(9001);
  g.fillStyle = getRgbSpreadHex(laserConfig.testColor, 0.42, 0.6, 0.07);
  g.fillRect(0, 0, c.width, c.height);
  // dichtes Blattwerk in mehreren Ebenen
  for (let l = 0; l < 5; l++) {
    g.fillStyle = getRgbSpreadHex(laserConfig.testColor, 0.36 + l * 0.04, 0.7, 0.05 + l * 0.025);
    for (let i = 0; i < 90; i++) {
      const x = rnd() * c.width;
      const y = rnd() * c.height;
      const a = rnd() * Math.PI;
      g.save();
      g.translate(x, y);
      g.rotate(a);
      g.beginPath();
      g.ellipse(0, 0, 40 + rnd() * 40, 10 + rnd() * 10, 0, 0, Math.PI * 2);
      g.fill();
      g.restore();
    }
  }
  return c;
}

function mgScharfschuetze(opts) {
  const lv = clamp(opts.level || 0, 0, 2);
  if (!ssScope) ssScope = ssRenderScope();
  let time = 0;
  let killed = 0;
  let casualties = 0;
  let finished = false;
  let sniper = null; // { x, y, phase: 'hidden'|'glint'|'aim', t, hold }
  let kx = SS_CX;
  let ky = SS_CY;
  const turret = guiAimTurret({
    posX: SS_CX,
    posY: H + 200, // Rohr unsichtbar unterhalb
    scanX: SS_CX - SS_R,
    scanY: SS_CY - SS_R,
    scanWidth: SS_R * 2,
    scanHeight: SS_R * 2,
    focusSpread: 300,
    targetSmoothing: 8,
    fireInterval: 999,
    visible: false,
  });

  function newSniper() {
    const a = Math.random() * Math.PI * 2;
    const d = Math.random() * (SS_R - 110);
    sniper = { x: SS_CX + Math.cos(a) * d, y: SS_CY + Math.sin(a) * d, phase: 'hidden', t: 0, hold: 0 };
  }
  newSniper();

  function finish(win, text) {
    finished = true;
    return { win, casualties: Math.min(casualties, opts.squadCount || 99), loot: { food: 0, ammo: win ? 1 : 0 }, text };
  }

  return {
    id: 'scharfschuetze',
    title: 'SCHARFSCHÜTZE',
    hint: 'Auf das Aufblitzen achten! ALLE Laser bündeln und das Fadenkreuz ruhig draufhalten.',
    update(grid, dt, ctx) {
      if (finished) return null;
      time += dt;
      turret.handle(grid, dt);
      let tx = turret.getTargetX();
      let ty = turret.getTargetY();
      let focus = turret.getFocus();
      let has = turret.hasTarget();
      if (isKeyDown('KeyK')) {
        // Test: virtueller Zielpunkt wandert zum Schützen, voller Fokus
        kx = lerp(kx, sniper.x, Math.min(1, dt * 2));
        ky = lerp(ky, sniper.y, Math.min(1, dt * 2));
        tx = kx;
        ty = ky;
        focus = 1;
        has = true;
      }
      // --- Schütze
      sniper.t += dt;
      if (sniper.phase === 'hidden' && sniper.t > SS.hidden[lv]) {
        sniper.phase = 'glint';
        sniper.t = 0;
        playSound(SND.click, 0.4);
      } else if (sniper.phase === 'glint' && sniper.t > SS.glint[lv]) {
        sniper.phase = 'aim';
        sniper.t = 0;
      } else if (sniper.phase === 'aim' && sniper.t > SS.aim[lv]) {
        casualties++;
        playSound(SND.shot, 0.7);
        addShake(14);
        addFloater(SS_CX, SS_CY + SS_R - 60, 'Mann getroffen!', PAL.bad);
        newSniper(); // er wechselt die Stellung
      }
      const onTarget =
        has && sniper.phase !== 'hidden' && focus >= SS.minFocus[lv] && Math.hypot(tx - sniper.x, ty - sniper.y) < SS.hitRadius[lv];
      sniper.hold = onTarget ? sniper.hold + dt : Math.max(0, sniper.hold - dt * 0.7);
      if (sniper.hold >= SS.holdNeeded[lv]) {
        killed++;
        playSound(SND.shot, 0.6);
        burst(sniper.x, sniper.y, PAL.enemy, 30, 300);
        addFloater(sniper.x, sniper.y - 60, 'AUSGESCHALTET', PAL.good);
        newSniper();
        sniper.t = -0.8; // kurze Atempause
      }

      // --- Zeichnen
      ctx.save();
      ctx.fillStyle = '#000000';
      ctx.fillRect(0, TOP, W, H - TOP);
      ctx.beginPath();
      ctx.arc(SS_CX, SS_CY, SS_R, 0, Math.PI * 2);
      ctx.clip();
      // leichtes Schwanken des Fernglases
      const swx = Math.sin(time * 0.7) * 6;
      const swy = Math.cos(time * 0.9) * 5;
      ctx.drawImage(ssScope, SS_CX - SS_R + swx, SS_CY - SS_R + swy);
      if (sniper.phase === 'glint') {
        const p = 0.5 + 0.5 * Math.sin(sniper.t * 18);
        ctx.globalCompositeOperation = 'lighter';
        ctx.strokeStyle = PAL.warn;
        ctx.lineWidth = 3;
        const r = 10 + p * 14;
        ctx.beginPath();
        ctx.moveTo(sniper.x - r * 2, sniper.y);
        ctx.lineTo(sniper.x + r * 2, sniper.y);
        ctx.moveTo(sniper.x, sniper.y - r * 2);
        ctx.lineTo(sniper.x, sniper.y + r * 2);
        ctx.stroke();
        ctx.fillStyle = PAL.warn;
        ctx.beginPath();
        ctx.arc(sniper.x, sniper.y, 5 + p * 4, 0, Math.PI * 2);
        ctx.fill();
        ctx.globalCompositeOperation = 'source-over';
      }
      // Vignette
      const vg = ctx.createRadialGradient(SS_CX, SS_CY, SS_R * 0.55, SS_CX, SS_CY, SS_R);
      vg.addColorStop(0, 'rgba(0,0,0,0)');
      vg.addColorStop(1, 'rgba(0,0,0,0.9)');
      ctx.fillStyle = vg;
      ctx.fillRect(SS_CX - SS_R, SS_CY - SS_R, SS_R * 2, SS_R * 2);
      ctx.restore();
      // Fernglas-Rand + Strichskala
      ctx.save();
      ctx.strokeStyle = PAL.dim;
      ctx.lineWidth = 6;
      ctx.beginPath();
      ctx.arc(SS_CX, SS_CY, SS_R, 0, Math.PI * 2);
      ctx.stroke();
      ctx.lineWidth = 2;
      for (let i = -8; i <= 8; i++) {
        ctx.beginPath();
        ctx.moveTo(SS_CX + i * 40, SS_CY - (i % 2 ? 6 : 12));
        ctx.lineTo(SS_CX + i * 40, SS_CY + (i % 2 ? 6 : 12));
        ctx.stroke();
      }
      ctx.restore();
      // Fadenkreuz des Saals: Streukreis zeigt Einigkeit
      if (has) {
        const rr = 34 + (1 - focus) * 140;
        const col = onTarget ? PAL.good : focus >= SS.minFocus[lv] ? PAL.accent : PAL.dim;
        ctx.save();
        ctx.strokeStyle = col;
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.arc(tx, ty, rr, 0, Math.PI * 2);
        ctx.moveTo(tx - rr - 20, ty);
        ctx.lineTo(tx - 12, ty);
        ctx.moveTo(tx + 12, ty);
        ctx.lineTo(tx + rr + 20, ty);
        ctx.moveTo(tx, ty - rr - 20);
        ctx.lineTo(tx, ty - 12);
        ctx.moveTo(tx, ty + 12);
        ctx.lineTo(tx, ty + rr + 20);
        ctx.stroke();
        if (sniper.hold > 0) {
          ctx.lineWidth = 8;
          ctx.beginPath();
          ctx.arc(tx, ty, rr + 14, -Math.PI / 2, -Math.PI / 2 + (Math.PI * 2 * sniper.hold) / SS.holdNeeded[lv]);
          ctx.stroke();
        }
        ctx.restore();
        if (focus < SS.minFocus[lv]) {
          util.renderText({ ctx, text: 'Bündeln! Alle auf einen Punkt!', x: SS_CX, y: SS_CY + SS_R + 50, fontSize: '32px', fillStyle: PAL.warn });
        }
      }
      if (sniper.phase === 'aim') {
        const danger = sniper.t / SS.aim[lv];
        util.renderText({ ctx, text: danger > 0.6 ? 'ER ZIELT!' : 'Wo war das Blitzen?', x: 260, y: 600, fontSize: '40px', fillStyle: danger > 0.6 ? PAL.bad : PAL.dim });
      }
      const left = Math.max(0, SS.duration[lv] - time);
      mgaBar(ctx, killed / SS.snipers[lv], 'Schützen ' + killed + '/' + SS.snipers[lv] + '   ·   ' + Math.ceil(left) + ' s', PAL.good);

      if (keyEdge('KeyX')) return finish(false, 'Festgenagelt – der Trupp kriecht zurück.');
      if (casualties >= (opts.squadCount || 99)) return finish(false, 'Der Trupp ist aufgerieben …');
      if (killed >= SS.snipers[lv]) return finish(true, 'Alle Scharfschützen ausgeschaltet!');
      if (left <= 0) return finish(false, 'Die Schützen halten den Pass. Umweg nötig.');
      return null;
    },
  };
}

// ---------------------------------------------------------------------------------------------------------
// 3. MINENFELD – Boden abtasten (Belichtung legt Minen frei), Minen entschärfen (Pad halten), dann den Pfad
//    Wegpunkt für Wegpunkt von links nach rechts markieren. Wegpunkt über scharfer Mine = BUMM.
// ---------------------------------------------------------------------------------------------------------

const MF = {
  mines: [7, 10, 13],
  waypoints: [6, 7, 8],
  duration: [46, 43, 40],
  revealAt: 0.45, // Belichtung, ab der eine Mine sichtbar ist
  dangerRadius: 75,
};
const MF_X0 = 120;
const MF_X1 = W - 120;
const MF_Y0 = TOP + 140;
const MF_Y1 = H - 50;

function mgMinenfeld(opts) {
  const lv = clamp(opts.level || 0, 0, 2);
  let time = 0;
  let casualties = 0;
  let finished = false;
  let walk = -1; // ≥ 0: Trupp läuft den Pfad ab (Fortschritt 0..1)
  let next = 0; // nächster Wegpunkt
  const scan = guiPaintLayer({
    posX: MF_X0,
    posY: MF_Y0,
    width: MF_X1 - MF_X0,
    height: MF_Y1 - MF_Y0,
    cellSize: 30,
    speedUp: 1.4,
    speedDown: 0.03,
    brushRadius: 40,
    threshold: MF.revealAt,
    render: 'paint',
    color: PAL.ground,
    maxAlpha: 0.16,
    visible: true,
  });
  // Wegpunkte: Kette von links nach rechts mit Zick-Zack
  const wps = [];
  const nW = MF.waypoints[lv];
  for (let i = 0; i < nW; i++) {
    const x = MF_X0 + 140 + (i * (MF_X1 - MF_X0 - 280)) / (nW - 1);
    const y = MF_Y0 + 120 + Math.random() * (MF_Y1 - MF_Y0 - 240);
    wps.push({ x, y, pad: mgaPad(x, y, 62, { speedUp: 110 }), done: false });
  }
  // Minen: etwa die Hälfte direkt bei Wegpunkten (Abtasten ist Pflicht), der Rest verstreut
  const mines = [];
  for (let i = 0; i < MF.mines[lv]; i++) {
    let x;
    let y;
    if (i < Math.ceil(nW / 2)) {
      const w = wps[1 + Math.floor(Math.random() * (nW - 1))];
      x = w.x + (Math.random() - 0.5) * 60;
      y = w.y + (Math.random() - 0.5) * 60;
    } else {
      x = MF_X0 + 80 + Math.random() * (MF_X1 - MF_X0 - 160);
      y = MF_Y0 + 60 + Math.random() * (MF_Y1 - MF_Y0 - 120);
    }
    mines.push({ x, y, revealed: false, defused: false, exploded: false, pad: mgaPad(x, y, 55, { speedUp: 75, speedDown: 20 }) });
  }

  function finish(win, text) {
    finished = true;
    return { win, casualties: Math.min(casualties, opts.squadCount || 99), loot: { food: 0, ammo: 0 }, text };
  }

  function squadPos(t) {
    const pts = [{ x: MF_X0 - 40, y: (MF_Y0 + MF_Y1) / 2 }].concat(wps).concat([{ x: MF_X1 + 60, y: (MF_Y0 + MF_Y1) / 2 }]);
    const f = clamp(t, 0, 1) * (pts.length - 1);
    const i = Math.min(pts.length - 2, Math.floor(f));
    const k = f - i;
    return { x: lerp(pts[i].x, pts[i + 1].x, k), y: lerp(pts[i].y, pts[i + 1].y, k) };
  }

  return {
    id: 'minenfeld',
    title: 'MINENFELD',
    hint: 'Boden ableuchten, Minen entschärfen, dann den Pfad von links nach rechts markieren.',
    update(grid, dt, ctx) {
      if (finished) return null;
      time += dt;
      const test = isKeyDown('KeyK');
      // --- Hintergrund zuerst (die Belichtungsschicht zeichnet sich in scan.handle darüber)
      ctx.save();
      ctx.fillStyle = '#020302';
      ctx.fillRect(0, TOP, W, H - TOP);
      ctx.strokeStyle = PAL.ground;
      ctx.globalAlpha = 0.25;
      ctx.lineWidth = 1;
      for (let x = MF_X0; x <= MF_X1; x += 60) {
        ctx.beginPath();
        ctx.moveTo(x, MF_Y0);
        ctx.lineTo(x, MF_Y1);
        ctx.stroke();
      }
      for (let y = MF_Y0; y <= MF_Y1; y += 60) {
        ctx.beginPath();
        ctx.moveTo(MF_X0, y);
        ctx.lineTo(MF_X1, y);
        ctx.stroke();
      }
      ctx.globalAlpha = 1;
      ctx.strokeStyle = PAL.dim;
      ctx.setLineDash([14, 10]);
      ctx.strokeRect(MF_X0, MF_Y0, MF_X1 - MF_X0, MF_Y1 - MF_Y0);
      ctx.setLineDash([]);
      ctx.restore();
      if (walk < 0) {
        scan.handle(grid, dt);
        // Minen freilegen / entschärfen
        mines.forEach((m) => {
          if (m.exploded || m.defused) return;
          if (!m.revealed && scan.getAverageInCircle(m.x, m.y, 45) >= MF.revealAt) {
            m.revealed = true;
            playSound(SND.sonar, 0.4);
            addFloater(m.x, m.y - 70, 'MINE!', PAL.warn);
          }
          if (test && next < wps.length && Math.hypot(m.x - wps[next].x, m.y - wps[next].y) < MF.dangerRadius + 30) {
            if (!m.revealed) {
              scan.setInCircle(m.x, m.y, 60, 1);
              m.revealed = true;
            }
            else mgaKeyFill(m.pad, dt, 150);
          }
          if (m.revealed) {
            m.pad.handle(grid, dt);
            if (m.pad.getValue() >= 98) {
              m.defused = true;
              playSound(SND.click, 0.6);
              burst(m.x, m.y, PAL.good, 14, 200);
              addFloater(m.x, m.y - 70, 'entschärft', PAL.good);
            }
          }
        });
        // nächster Wegpunkt (nur der ist aktiv)
        if (next < wps.length) {
          const w = wps[next];
          const blocked = test && mines.some((m) => !m.exploded && !m.defused && Math.hypot(m.x - w.x, m.y - w.y) < MF.dangerRadius + 30);
          if (!blocked) mgaKeyFill(w.pad, dt, 120);
          w.pad.handle(grid, dt);
          if (w.pad.getValue() >= 98) {
            w.done = true;
            next++;
            playSound(SND.plop, 0.5);
            mines.forEach((m) => {
              if (m.exploded || m.defused) return;
              if (Math.hypot(m.x - w.x, m.y - w.y) < MF.dangerRadius) {
                m.exploded = true;
                casualties++;
                playSound(SND.boom, 0.8);
                addShake(18);
                burst(m.x, m.y, PAL.bad, 50, 520);
                addFloater(m.x, m.y - 90, 'BUMM! Mann verloren', PAL.bad);
              }
            });
            if (next >= wps.length) {
              walk = 0;
              addFloater(W / 2, MF_Y0 + 40, 'Pfad steht – Trupp, vorwärts!', PAL.good);
            }
          }
        }
      } else {
        walk += dt / 4;
      }

      // --- Zeichnen
      // Pfad-Linie
      ctx.save();
      ctx.strokeStyle = PAL.good;
      ctx.lineWidth = 4;
      ctx.setLineDash([10, 12]);
      ctx.beginPath();
      ctx.moveTo(MF_X0 - 40, (MF_Y0 + MF_Y1) / 2);
      wps.forEach((w) => {
        if (w.done) ctx.lineTo(w.x, w.y);
      });
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.restore();
      mines.forEach((m) => {
        if (!m.revealed || m.exploded) return;
        ctx.save();
        ctx.fillStyle = '#000000';
        ctx.strokeStyle = m.defused ? PAL.good : PAL.warn;
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.arc(m.x, m.y, 20, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
        for (let k = 0; k < 6; k++) {
          const a = (k * Math.PI) / 3 + time * 0.3;
          ctx.beginPath();
          ctx.moveTo(m.x + Math.cos(a) * 20, m.y + Math.sin(a) * 20);
          ctx.lineTo(m.x + Math.cos(a) * 30, m.y + Math.sin(a) * 30);
          ctx.stroke();
        }
        ctx.restore();
        if (!m.defused) mgaDrawPad(ctx, m.x, m.y, 55, m.pad.getValue(), PAL.warn, '', 0);
      });
      mines.forEach((m) => {
        if (!m.exploded) return;
        ctx.save();
        ctx.strokeStyle = PAL.bad;
        ctx.globalAlpha = 0.5;
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.arc(m.x, m.y, 40, 0, Math.PI * 2);
        ctx.stroke();
        ctx.restore();
      });
      wps.forEach((w, i) => {
        const active = i === next && walk < 0;
        const col = w.done ? PAL.good : active ? PAL.accent : PAL.dim;
        mgaDrawPad(ctx, w.x, w.y, 62, active ? w.pad.getValue() : w.done ? 100 : 0, col, String(i + 1), active ? 0.85 : 0.5);
      });
      // Trupp
      for (let k = 0; k < 3; k++) {
        const back = walk < 0 ? 0 : -0.04 * k;
        const p = squadPos(walk < 0 ? 0 : walk + back);
        mgaFigure(ctx, p.x - (walk < 0 ? k * 26 : 0), p.y + 30, 1.1, PAL.friend, 'friend', Math.sin(time * 10 + k) * 0.06);
      }
      const left = Math.max(0, MF.duration[lv] - time);
      const revealed = mines.filter((m) => m.revealed).length;
      mgaBar(
        ctx,
        walk >= 0 ? 1 : next / wps.length,
        'Wegpunkte ' + next + '/' + wps.length + '   ·   Minen gefunden ' + revealed + '   ·   ' + Math.ceil(left) + ' s',
        PAL.good
      );

      if (keyEdge('KeyX')) return finish(false, 'Abgebrochen – zurück auf sicheren Boden.');
      if (casualties >= (opts.squadCount || 99)) return finish(false, 'Der Trupp ist aufgerieben …');
      if (walk >= 1) {
        const lost = mines.filter((m) => m.exploded).length;
        return finish(true, lost ? 'Durch – aber das Minenfeld hat Opfer gefordert.' : 'Sauber durchs Minenfeld!');
      }
      if (walk < 0 && left <= 0) return finish(false, 'Keine Zeit mehr – der Trupp muss einen langen Umweg nehmen.');
      return null;
    },
  };
}

// ---------------------------------------------------------------------------------------------------------
// 4. NACHTWACHE – Dunkelheit, die Laser sind Taschenlampen (paintLayer-Maske deckt die Szene auf).
//    Leuchtende Augenpaare schleichen heran: lange genug anleuchten → sie fliehen. Verpasst → Angriff.
//    Die Schlafenden am Feuer NICHT anleuchten (aufgeweckt + geblendet → Morgen verzögert sich).
// ---------------------------------------------------------------------------------------------------------

const NW = {
  duration: [36, 38, 40],
  maxEyes: [3, 4, 5],
  spawnEvery: [2.6, 2.0, 1.5],
  attackTime: [8, 6.5, 5],
  wakePenalty: 4, // s, um die sich der Morgen verschiebt
  wakesPerCasualty: 3,
};
const NW_FIRE = { x: 960, y: 880 };
const NW_SLEEPERS = [
  { x: 720, y: 950 },
  { x: 1200, y: 950 },
  { x: 960, y: 1020 },
];

var nwScene = null;

function nwRenderScene() {
  const c = mgaJungle(W, H - TOP, 1337, 3);
  const g = c.getContext('2d');
  // Lichtung um das Lager
  g.fillStyle = getRgbSpreadHex(laserConfig.testColor, 0.45, 0.5, 0.09);
  g.beginPath();
  g.ellipse(NW_FIRE.x, NW_FIRE.y - TOP + 40, 420, 150, 0, 0, Math.PI * 2);
  g.fill();
  return c;
}

function mgNachtwache(opts) {
  const lv = clamp(opts.level || 0, 0, 2);
  if (!nwScene) nwScene = nwRenderScene();
  let time = 0;
  let dawnAt = NW.duration[lv];
  let casualties = 0;
  let wakes = 0;
  let caught = 0;
  let spawnTimer = 1.5;
  let finished = false;
  const torch = guiPaintLayer({
    posX: 0,
    posY: TOP,
    width: W,
    height: H - TOP,
    cellSize: 24,
    speedUp: 3.5,
    speedDown: 0.9,
    brushRadius: 80,
    threshold: 0.5,
    render: 'mask',
    color: '#000000',
    maxAlpha: 0.97,
    visible: true,
  });
  const sleepers = NW_SLEEPERS.map((p) => ({ x: p.x, y: p.y, pad: mgaPad(p.x, p.y - 20, 70, { speedUp: 110, speedDown: 50 }), cool: 0 }));
  const eyes = []; // { sx, sy, x, y, t, pad, blink }

  function spawnEye() {
    for (let tries = 0; tries < 20; tries++) {
      const x = 150 + Math.random() * (W - 300);
      const y = TOP + 120 + Math.random() * 560;
      if (Math.hypot(x - NW_FIRE.x, y - NW_FIRE.y) < 380) continue;
      if (eyes.some((e) => Math.hypot(e.x - x, e.y - y) < 200)) continue;
      eyes.push({ sx: x, sy: y, x, y, t: 0, pad: mgaPad(x, y, 72, { speedUp: 120, speedDown: 30 }), blink: Math.random() * 5 });
      return;
    }
  }

  function finish(win, text) {
    finished = true;
    return { win, casualties: Math.min(casualties, opts.squadCount || 99), loot: { food: 0, ammo: 0 }, text };
  }

  return {
    id: 'nachtwache',
    title: 'NACHTWACHE',
    hint: 'Leuchtet die Augen in der Dunkelheit an! Die Schlafenden am Feuer NICHT blenden.',
    update(grid, dt, ctx) {
      if (finished) return null;
      time += dt;
      // --- Szene, dann die Taschenlampen-Maske darüber (zeichnet sich in torch.handle)
      ctx.drawImage(nwScene, 0, TOP);
      sleepers.forEach((s) => {
        ctx.save();
        ctx.fillStyle = '#05070a';
        ctx.strokeStyle = PAL.friend;
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.ellipse(s.x, s.y, 80, 26, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
        ctx.beginPath();
        ctx.arc(s.x - 66, s.y - 8, 15, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
        ctx.restore();
      });
      if (isKeyDown('KeyK')) eyes.forEach((e) => torch.setInCircle(e.x, e.y, 70, 1));
      torch.handle(grid, dt);

      // --- Augen
      spawnTimer -= dt;
      if (spawnTimer <= 0 && eyes.length < NW.maxEyes[lv]) {
        spawnEye();
        spawnTimer = NW.spawnEvery[lv] * (0.7 + Math.random() * 0.6);
      }
      eyes.slice().forEach((e) => {
        e.t += dt;
        const k = Math.min(1, e.t / NW.attackTime[lv]);
        e.x = lerp(e.sx, NW_FIRE.x, k * 0.55);
        e.y = lerp(e.sy, NW_FIRE.y - 60, k * 0.55);
        e.pad.setX(e.x);
        e.pad.setY(e.y);
        mgaKeyFill(e.pad, dt, 200);
        e.pad.handle(grid, dt);
        if (e.pad.getValue() >= 98) {
          caught++;
          playSound(SND.hit, 0.5);
          burst(e.x, e.y, PAL.enemy, 20, 300);
          addFloater(e.x, e.y - 60, 'verscheucht!', PAL.good);
          eyes.splice(eyes.indexOf(e), 1);
        } else if (e.t >= NW.attackTime[lv]) {
          casualties++;
          playSound(SND.shot, 0.7);
          addShake(14);
          burst(e.x, e.y, PAL.bad, 30, 400);
          addFloater(NW_FIRE.x, NW_FIRE.y - 200, 'Überfall! Mann verloren', PAL.bad);
          eyes.splice(eyes.indexOf(e), 1);
        }
      });
      // --- Schlafende
      sleepers.forEach((s) => {
        s.cool = Math.max(0, s.cool - dt);
        s.pad.handle(grid, dt);
        if (s.cool <= 0 && s.pad.getValue() >= 80) {
          s.cool = 3;
          s.pad.setValue(0);
          wakes++;
          dawnAt += NW.wakePenalty;
          playSound(SND.error, 0.6);
          addShake(5);
          addFloater(s.x, s.y - 90, 'GEBLENDET! +' + NW.wakePenalty + ' s', PAL.bad);
          if (wakes % NW.wakesPerCasualty === 0) {
            casualties++;
            addFloater(s.x, s.y - 150, 'Übermüdet – Mann fällt aus', PAL.bad);
          }
        }
      });

      // --- über der Maske: Feuer, Augen, Hinweise
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      const fl = 0.8 + 0.2 * Math.sin(time * 13) + 0.1 * Math.sin(time * 31);
      const fg = ctx.createRadialGradient(NW_FIRE.x, NW_FIRE.y, 5, NW_FIRE.x, NW_FIRE.y, 120 * fl);
      fg.addColorStop(0, PAL.warn);
      fg.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.globalAlpha = 0.5;
      ctx.fillStyle = fg;
      ctx.beginPath();
      ctx.arc(NW_FIRE.x, NW_FIRE.y, 120 * fl, 0, Math.PI * 2);
      ctx.fill();
      ctx.globalAlpha = 1;
      eyes.forEach((e) => {
        e.blink += dt;
        if (e.blink % 4 < 0.15) return; // blinzeln
        const danger = e.t / NW.attackTime[lv];
        ctx.fillStyle = danger > 0.7 ? PAL.bad : PAL.enemy;
        ctx.beginPath();
        ctx.ellipse(e.x - 16, e.y, 8, 5, 0, 0, Math.PI * 2);
        ctx.ellipse(e.x + 16, e.y, 8, 5, 0, 0, Math.PI * 2);
        ctx.fill();
      });
      ctx.restore();
      eyes.forEach((e) => {
        if (e.pad.getValue() > 1) mgaDrawPad(ctx, e.x, e.y, 72, e.pad.getValue(), PAL.enemy, '', 0);
      });
      sleepers.forEach((s) => {
        if (s.pad.getValue() > 10) util.renderText({ ctx, text: 'Psst! Nicht blenden!', x: s.x, y: s.y - 60, fontSize: '26px', fillStyle: PAL.warn });
      });
      // Morgenröte oben
      const k = clamp(time / dawnAt, 0, 1);
      ctx.save();
      const sky = ctx.createLinearGradient(0, TOP, 0, TOP + 160);
      sky.addColorStop(0, getRgbSpreadHex(laserConfig.testColor, 0.6, 0.6, 0.05 + k * 0.4));
      sky.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = sky;
      ctx.fillRect(0, TOP, W, 160);
      ctx.restore();
      mgaBar(ctx, k, 'Bis zum Morgengrauen: ' + Math.ceil(Math.max(0, dawnAt - time)) + ' s   ·   verscheucht ' + caught, PAL.accent);

      if (keyEdge('KeyX')) return finish(false, 'Das Lager wurde überrannt – Flucht in die Nacht!');
      if (casualties >= (opts.squadCount || 99)) return finish(false, 'Die Nacht war zu lang …');
      if (time >= dawnAt) return finish(true, casualties ? 'Morgengrauen. Die Nacht hat Opfer gekostet.' : 'Morgengrauen – alle haben die Nacht überstanden!');
      return null;
    },
  };
}

// ---------------------------------------------------------------------------------------------------------
// 5. FLUSS – Floß in der Strömung (Fluss fließt nach unten). Lenkstreifen unten: links/rechts steuern.
//    Baumstämme anleuchten → zerbrechen. Felsen kann man nicht zerstören → ausweichen!
//    Rammt das Floß etwas, fällt ein Mann ins Wasser: schnell anleuchten = gerettet. Floß selbst nicht blenden.
// ---------------------------------------------------------------------------------------------------------

const FL = {
  duration: [30, 34, 38],
  current: [230, 290, 350], // px/s
  spawnEvery: [1.35, 1.0, 0.75],
  rockShare: [0.3, 0.38, 0.45],
  rescueTime: [5, 4.2, 3.5],
};
const FL_X0 = 300;
const FL_X1 = W - 300;
const FL_RAFT_Y = 790;
const FL_RAFT_W = 250;
const FL_RAFT_H = 90;

function mgFluss(opts) {
  const lv = clamp(opts.level || 0, 0, 2);
  let time = 0;
  let casualties = 0;
  let rescued = 0;
  let broken = 0;
  let spawnTimer = 0.8;
  let flow = 0;
  let blind = 0;
  let finished = false;
  let raftX = W / 2;
  let onRaft = Math.max(1, Math.min(4, opts.squadCount || 4));
  const strip = guiSteerStrip({
    posX: W / 2,
    posY: 1015,
    width: FL_X1 - FL_X0,
    height: 110,
    axis: 'x',
    smoothing: 6,
    visible: false,
  });
  const raftPad = mgaPad(raftX, FL_RAFT_Y, 95, { speedUp: 90, speedDown: 45 });
  const obstacles = []; // { kind: 'log'|'rock', x, y, pad, hit }
  const swimmers = []; // { x, y, t, pad }

  function finish(win, text) {
    finished = true;
    return { win, casualties: Math.min(casualties, opts.squadCount || 99), loot: { food: win ? 1 : 0, ammo: 0 }, text };
  }

  function collides(o) {
    const rx0 = raftX - FL_RAFT_W / 2;
    const rx1 = raftX + FL_RAFT_W / 2;
    const ry0 = FL_RAFT_Y - FL_RAFT_H / 2;
    const ry1 = FL_RAFT_Y + FL_RAFT_H / 2;
    if (o.kind === 'rock') {
      const cx = clamp(o.x, rx0, rx1);
      const cy = clamp(o.y, ry0, ry1);
      return Math.hypot(o.x - cx, o.y - cy) < 58;
    }
    return o.x + 115 > rx0 && o.x - 115 < rx1 && o.y + 24 > ry0 && o.y - 24 < ry1;
  }

  return {
    id: 'fluss',
    title: 'FLUSSÜBERQUERUNG',
    hint: 'Unten lenken! Baumstämme anleuchten, Felsen ausweichen, Leute im Wasser retten.',
    update(grid, dt, ctx) {
      if (finished) return null;
      time += dt;
      flow += FL.current[lv] * dt;
      const test = isKeyDown('KeyK');
      // --- Lenken
      strip.handle(grid, dt);
      blind = Math.max(0, blind - dt);
      let target = raftX;
      if (test) {
        // Test: freie Spur suchen (Felsen meiden)
        let best = raftX;
        let bestScore = -1e9;
        for (let x = FL_X0 + 140; x <= FL_X1 - 140; x += 40) {
          let score = -Math.abs(x - raftX) * 0.2;
          obstacles.forEach((o) => {
            if (o.kind === 'rock' && o.y < FL_RAFT_Y + 60 && o.y > FL_RAFT_Y - 600 && Math.abs(o.x - x) < 220) score -= 1000;
          });
          if (score > bestScore) {
            bestScore = score;
            best = x;
          }
        }
        target = best;
      } else if (strip.hasInput()) {
        target = strip.getPosition();
      }
      if (blind <= 0) raftX = lerp(raftX, clamp(target, FL_X0 + FL_RAFT_W / 2, FL_X1 - FL_RAFT_W / 2), Math.min(1, dt * 2.5));
      raftPad.setX(raftX);
      raftPad.handle(grid, dt);
      if (raftPad.getValue() >= 90 && blind <= 0) {
        blind = 1.2;
        raftPad.setValue(0);
        playSound(SND.error, 0.5);
        addFloater(raftX, FL_RAFT_Y - 110, 'Steuermann geblendet!', PAL.bad);
      }
      // --- Hindernisse
      spawnTimer -= dt;
      if (spawnTimer <= 0 && time < FL.duration[lv] - 2) {
        const rock = Math.random() < FL.rockShare[lv];
        const x = FL_X0 + 130 + Math.random() * (FL_X1 - FL_X0 - 260);
        obstacles.push({ kind: rock ? 'rock' : 'log', x, y: TOP - 60, pad: rock ? null : mgaPad(x, TOP - 60, 78, { speedUp: 150 }), hit: false, rot: (Math.random() - 0.5) * 0.3 });
        spawnTimer = FL.spawnEvery[lv] * (0.7 + Math.random() * 0.6);
      }
      obstacles.slice().forEach((o) => {
        o.y += FL.current[lv] * dt;
        if (o.pad) {
          o.pad.setX(o.x);
          o.pad.setY(o.y);
          if (test) mgaKeyFill(o.pad, dt, 260);
          o.pad.handle(grid, dt);
          if (o.pad.getValue() >= 98) {
            broken++;
            playSound(SND.hit, 0.4);
            burst(o.x, o.y, PAL.ground, 22, 320);
            obstacles.splice(obstacles.indexOf(o), 1);
            return;
          }
        }
        if (!o.hit && collides(o)) {
          o.hit = true;
          addShake(12);
          playSound(SND.splash, 0.7);
          if (onRaft > 0) {
            onRaft--;
            const side = o.x < raftX ? 1 : -1;
            const sx = clamp(raftX + side * 170, FL_X0 + 70, FL_X1 - 70);
            swimmers.push({ x: sx, y: FL_RAFT_Y + 30, t: 0, pad: mgaPad(sx, FL_RAFT_Y + 30, 68, { speedUp: 150 }) });
            addFloater(sx, FL_RAFT_Y - 60, 'MANN ÜBER BORD!', PAL.bad);
          }
          if (o.kind === 'log') {
            obstacles.splice(obstacles.indexOf(o), 1);
            return;
          }
        }
        if (o.y > H + 80) obstacles.splice(obstacles.indexOf(o), 1);
      });
      // --- Schwimmer
      swimmers.slice().forEach((s) => {
        s.t += dt;
        s.y += FL.current[lv] * 0.12 * dt;
        s.pad.setY(s.y);
        if (test) mgaKeyFill(s.pad, dt, 200);
        s.pad.handle(grid, dt);
        if (s.pad.getValue() >= 90) {
          rescued++;
          onRaft++;
          playSound(SND.pickup, 0.6);
          addFloater(s.x, s.y - 70, 'GERETTET!', PAL.good);
          swimmers.splice(swimmers.indexOf(s), 1);
        } else if (s.t >= FL.rescueTime[lv]) {
          casualties++;
          addFloater(s.x, s.y - 70, 'abgetrieben …', PAL.bad);
          swimmers.splice(swimmers.indexOf(s), 1);
        }
      });

      // --- Zeichnen
      ctx.save();
      ctx.fillStyle = '#010406';
      ctx.fillRect(FL_X0, TOP, FL_X1 - FL_X0, H - TOP);
      // Strömungslinien
      ctx.strokeStyle = PAL.water;
      ctx.globalAlpha = 0.22;
      ctx.lineWidth = 2;
      for (let i = 0; i < 26; i++) {
        const x = FL_X0 + 40 + ((i * 197) % (FL_X1 - FL_X0 - 80));
        const y = TOP + ((flow * (0.8 + (i % 3) * 0.2) + i * 131) % (H - TOP + 120)) - 60;
        ctx.beginPath();
        ctx.moveTo(x, y);
        ctx.quadraticCurveTo(x + 12, y + 30, x, y + 60);
        ctx.stroke();
      }
      ctx.globalAlpha = 1;
      // Ufer
      ctx.fillStyle = '#020503';
      ctx.fillRect(0, TOP, FL_X0, H - TOP);
      ctx.fillRect(FL_X1, TOP, W - FL_X1, H - TOP);
      ctx.strokeStyle = PAL.jungle;
      ctx.lineWidth = 4;
      ctx.beginPath();
      for (let y = TOP; y <= H; y += 30) {
        const wob = Math.sin((y + flow) * 0.02) * 14;
        if (y === TOP) ctx.moveTo(FL_X0 + wob, y);
        else ctx.lineTo(FL_X0 + wob, y);
      }
      ctx.stroke();
      ctx.beginPath();
      for (let y = TOP; y <= H; y += 30) {
        const wob = Math.sin((y + flow) * 0.02 + 2) * 14;
        if (y === TOP) ctx.moveTo(FL_X1 + wob, y);
        else ctx.lineTo(FL_X1 + wob, y);
      }
      ctx.stroke();
      ctx.restore();
      obstacles.forEach((o) => {
        ctx.save();
        ctx.translate(o.x, o.y);
        ctx.fillStyle = '#030303';
        if (o.kind === 'rock') {
          ctx.strokeStyle = PAL.dim;
          ctx.lineWidth = 4;
          ctx.beginPath();
          for (let k = 0; k < 8; k++) {
            const a = (k * Math.PI) / 4;
            const r = 52 + ((k * 37) % 11);
            if (k === 0) ctx.moveTo(Math.cos(a) * r, Math.sin(a) * r);
            else ctx.lineTo(Math.cos(a) * r, Math.sin(a) * r);
          }
          ctx.closePath();
          ctx.fill();
          ctx.stroke();
        } else {
          ctx.rotate(o.rot);
          ctx.strokeStyle = PAL.ground;
          ctx.lineWidth = 3;
          ctx.fillRect(-115, -22, 230, 44);
          ctx.strokeRect(-115, -22, 230, 44);
          ctx.beginPath();
          ctx.arc(115, 0, 22, -Math.PI / 2, Math.PI / 2);
          ctx.stroke();
        }
        ctx.restore();
        if (o.pad && o.pad.getValue() > 1) mgaDrawPad(ctx, o.x, o.y, 78, o.pad.getValue(), PAL.ground, '', 0);
      });
      swimmers.forEach((s) => {
        const bob = Math.sin(time * 6 + s.x) * 5;
        ctx.save();
        ctx.strokeStyle = PAL.friend;
        ctx.fillStyle = '#04070a';
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.arc(s.x, s.y + bob, 16, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(s.x - 30, s.y - 20 + bob + Math.sin(time * 9) * 10);
        ctx.lineTo(s.x - 12, s.y + bob);
        ctx.moveTo(s.x + 30, s.y - 20 + bob - Math.sin(time * 9) * 10);
        ctx.lineTo(s.x + 12, s.y + bob);
        ctx.stroke();
        ctx.restore();
        mgaDrawPad(ctx, s.x, s.y, 68, s.pad.getValue(), PAL.friend, '', 0);
        util.renderText({ ctx, text: 'HILFE! ' + Math.ceil(FL.rescueTime[lv] - s.t), x: s.x, y: s.y - 82, fontSize: '28px', fillStyle: PAL.bad });
      });
      // Floß
      ctx.save();
      ctx.translate(raftX, FL_RAFT_Y + Math.sin(time * 3) * 4);
      ctx.fillStyle = '#060402';
      ctx.strokeStyle = blind > 0 ? PAL.bad : PAL.ground;
      ctx.lineWidth = 4;
      ctx.fillRect(-FL_RAFT_W / 2, -FL_RAFT_H / 2, FL_RAFT_W, FL_RAFT_H);
      ctx.strokeRect(-FL_RAFT_W / 2, -FL_RAFT_H / 2, FL_RAFT_W, FL_RAFT_H);
      for (let k = 1; k < 6; k++) {
        ctx.beginPath();
        ctx.moveTo(-FL_RAFT_W / 2 + (k * FL_RAFT_W) / 6, -FL_RAFT_H / 2);
        ctx.lineTo(-FL_RAFT_W / 2 + (k * FL_RAFT_W) / 6, FL_RAFT_H / 2);
        ctx.stroke();
      }
      ctx.restore();
      for (let k = 0; k < onRaft; k++) {
        mgaFigure(ctx, raftX - 75 + k * 50, FL_RAFT_Y + 10, 0.9, PAL.friend, 'friend', Math.sin(time * 3 + k) * 0.08);
      }
      // Lenkstreifen (Aktionsfläche: schwarz, Kontur, Marker)
      ctx.save();
      ctx.fillStyle = '#000000';
      ctx.fillRect(FL_X0, 960, FL_X1 - FL_X0, 110);
      ctx.strokeStyle = PAL.accent;
      ctx.lineWidth = 3;
      ctx.strokeRect(FL_X0, 960, FL_X1 - FL_X0, 110);
      ctx.fillStyle = PAL.accent;
      ctx.beginPath();
      ctx.moveTo(target, 968);
      ctx.lineTo(target - 18, 990);
      ctx.lineTo(target + 18, 990);
      ctx.closePath();
      ctx.fill();
      ctx.restore();
      util.renderText({ ctx, text: '◀  LENKEN  ▶', x: W / 2, y: 1030, fontSize: '34px', fillStyle: PAL.dim });
      const k = clamp(time / FL.duration[lv], 0, 1);
      mgaBar(ctx, k, 'Bis zum anderen Ufer: ' + Math.ceil(Math.max(0, FL.duration[lv] - time)) + ' s   ·   gerettet ' + rescued, PAL.water);

      if (keyEdge('KeyX')) return finish(false, 'Das Floß kentert – der Trupp schwimmt zurück ans Ufer.');
      if (casualties >= (opts.squadCount || 99)) return finish(false, 'Der Trupp ist aufgerieben …');
      if (time >= FL.duration[lv] && swimmers.length === 0) {
        return finish(true, casualties ? 'Am anderen Ufer – aber nicht alle haben es geschafft.' : 'Alle sicher am anderen Ufer!');
      }
      return null;
    },
  };
}

// =========================================================================================================
// Minispiele 6–10 (Chunk B): Sumpf, Mörser, Sanitäter, Funkspruch, Abwurf
// Vertrag: function mgXyz(opts) → { id, title, hint, update(grid, dt, ctx) }; update liefert null, solange es
// läuft, und genau einmal { win, casualties, loot: { food, ammo }, text }.
// Aktionsflächen schwarz + nur Kontur; Farben nur aus PAL. Test: K halten = Saal löst es, X = Abbruch.
// =========================================================================================================

// ---- gemeinsame Helfer (Präfix mgb) ----

function mgbBar(ctx, x, y, w, h, frac, color, label) {
  ctx.save();
  ctx.fillStyle = '#000000';
  ctx.fillRect(x, y, w, h);
  ctx.fillStyle = color;
  ctx.fillRect(x, y, w * clamp(frac, 0, 1), h);
  ctx.strokeStyle = PAL.dim;
  ctx.lineWidth = 2;
  ctx.strokeRect(x, y, w, h);
  ctx.restore();
  if (label) util.renderText({ ctx, text: label, x: x + w / 2, y: y - 12, fontSize: '28px', fillStyle: PAL.text });
}

// Restzeit-Balken oben im Spielbereich
function mgbTimer(ctx, left, total) {
  const frac = total > 0 ? left / total : 0;
  mgbBar(ctx, 560, TOP + 18, 800, 16, frac, frac < 0.25 ? PAL.warn : PAL.accent);
  util.renderText({ ctx, text: Math.ceil(Math.max(0, left)) + ' s', x: 1420, y: TOP + 34, fontSize: '28px', fillStyle: PAL.dim });
}

// Fortschrittsring um einen Punkt
function mgbRing(ctx, x, y, r, frac, color, width) {
  ctx.save();
  ctx.strokeStyle = color;
  ctx.lineWidth = width || 8;
  ctx.beginPath();
  ctx.arc(x, y, r, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * clamp(frac, 0, 1));
  ctx.stroke();
  ctx.restore();
}

// Dunkle Aktionsfläche (Kreis) mit Kontur
function mgbPad(ctx, x, y, r, color, lw) {
  ctx.save();
  ctx.fillStyle = '#000000';
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = color;
  ctx.lineWidth = lw || 3;
  ctx.stroke();
  ctx.restore();
}

// Soldat (Draufsicht/Halbtotale): dunkler Körper, helle Kontur, Helm – Aktionsfläche bleibt dunkel
function mgbSoldier(ctx, x, y, s, color, t, sink) {
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(s, s);
  const bob = Math.sin((t || 0) * 6) * 2;
  ctx.fillStyle = '#05080a';
  ctx.strokeStyle = color;
  ctx.lineWidth = 3;
  // Körper
  ctx.beginPath();
  ctx.ellipse(0, 10 + bob, 18, 26, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();
  // Kopf + Helm
  ctx.beginPath();
  ctx.arc(0, -22 + bob, 12, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();
  ctx.beginPath();
  ctx.arc(0, -24 + bob, 15, Math.PI, 0);
  ctx.lineTo(17, -22 + bob);
  ctx.lineTo(-17, -22 + bob);
  ctx.closePath();
  ctx.stroke();
  // Gewehr
  ctx.beginPath();
  ctx.moveTo(-14, 2 + bob);
  ctx.lineTo(20, -18 + bob);
  ctx.stroke();
  ctx.restore();
  if (sink) {
    // Versinken: unteren Teil mit "Sumpf" überdecken
    ctx.save();
    ctx.fillStyle = PAL.dark;
    ctx.globalAlpha = 0.92;
    const cover = clamp(sink, 0, 1) * 70 * s;
    ctx.fillRect(x - 30 * s, y + 36 * s - cover, 60 * s, cover + 4);
    ctx.restore();
  }
}

function mgbResult(win, casualties, food, ammo, text) {
  return { win: !!win, casualties: casualties || 0, loot: { food: food || 0, ammo: ammo || 0 }, text: text || '' };
}

// =========================================================================================================
// 6. SUMPF – Kameraden versinken, greifen und ans feste Ufer ziehen
// =========================================================================================================

function mgSumpf(opts) {
  const level = opts.level || 0;
  const count = clamp(Math.min(opts.squadCount || 4, 3 + level), 1, 5);
  const SM = {
    sinkTime: [26, 20, 15][level], // s bis ganz versunken
    grabbedSinkFactor: 0, // gegriffen = sinkt nicht
    shoreX: 1460,
    shoreMove: level >= 2 ? 120 : level >= 1 ? 50 : 0, // Ufer wandert (px Amplitude)
    total: 45,
  };
  const smBg = document.createElement('canvas');
  smBg.width = W;
  smBg.height = H - TOP;
  (function smRenderBg() {
    const c = smBg.getContext('2d');
    c.fillStyle = '#000000';
    c.fillRect(0, 0, smBg.width, smBg.height);
    // Sumpfschlieren (dunkel, nur Display)
    for (let i = 0; i < 140; i++) {
      c.globalAlpha = 0.05 + Math.random() * 0.08;
      c.fillStyle = i % 3 ? PAL.jungle : PAL.water;
      c.beginPath();
      c.ellipse(Math.random() * 1400, Math.random() * smBg.height, 40 + Math.random() * 140, 10 + Math.random() * 30, Math.random() * 3, 0, Math.PI * 2);
      c.fill();
    }
    c.globalAlpha = 1;
    // Schilf
    c.strokeStyle = PAL.jungle;
    c.lineWidth = 2;
    for (let i = 0; i < 70; i++) {
      const x = Math.random() * 1400;
      const y = smBg.height - Math.random() * 60;
      c.globalAlpha = 0.3;
      c.beginPath();
      c.moveTo(x, y);
      c.quadraticCurveTo(x + 10, y - 50, x + (Math.random() - 0.5) * 30, y - 90 - Math.random() * 60);
      c.stroke();
    }
    c.globalAlpha = 1;
  })();

  const shorePts = [];
  function smShoreX(t) {
    return SM.shoreX + Math.sin(t * 0.6) * SM.shoreMove;
  }
  function smUpdateSnaps(t) {
    shorePts.length = 0;
    const sx = smShoreX(t) + 150;
    for (let i = 0; i < 5; i++) shorePts.push({ x: sx + (i % 2) * 140, y: TOP + 180 + i * 170 });
  }
  smUpdateSnaps(0);

  const men = [];
  for (let i = 0; i < count; i++) {
    const m = {
      x: 260 + Math.random() * 850,
      y: TOP + 170 + ((i + 0.5) / count) * (H - TOP - 300) + (Math.random() - 0.5) * 60,
      sink: 0.1 + Math.random() * 0.15,
      state: 'sinking', // 'sinking' | 'saved' | 'lost'
      bubbles: 0,
    };
    m.drag = guiDragHandle({
      posX: m.x,
      posY: m.y,
      radius: 70,
      grabSpeed: 140,
      fullPercent: 20,
      catchFactor: 1.7,
      maxSpeed: 900,
      dropDelay: 0.5,
      visible: false,
      bounds: { x: 0, y: TOP + 60, width: W, height: H - TOP - 60 },
      snapPoints: shorePts,
      snapDistance: 140,
      onGrab: () => playSound(SND.click, 0.3),
      onDrop: () => {
        if (m.drag.getX() > smShoreX(t)) smSave(m);
      },
    });
    men.push(m);
  }

  let t = 0;
  let done = null;
  const leeches = [];
  for (let i = 0; i < 9; i++) leeches.push({ x: 150 + Math.random() * 1200, y: TOP + 120 + Math.random() * 820, p: Math.random() * 6 });

  function smSave(m) {
    if (m.state !== 'sinking') return;
    m.state = 'saved';
    m.drag.setEnabled(false);
    burst(m.drag.getX(), m.drag.getY(), PAL.good, 18, 260);
    addFloater(m.drag.getX(), m.drag.getY() - 70, 'GERETTET!', PAL.good);
    playSound(SND.pickup, 0.6);
  }
  function smLose(m) {
    if (m.state !== 'sinking') return;
    m.state = 'lost';
    m.drag.setEnabled(false);
    burst(m.drag.getX(), m.drag.getY(), PAL.water, 30, 200);
    addFloater(m.drag.getX(), m.drag.getY() - 60, 'Versunken …', PAL.bad);
    addShake(6);
    playSound(SND.splash, 0.7);
  }

  function draw(ctx) {
    ctx.drawImage(smBg, 0, TOP);
    const sx = smShoreX(t);
    // festes Ufer: dunkel, Kontur
    ctx.save();
    ctx.fillStyle = '#000000';
    ctx.beginPath();
    ctx.moveTo(sx, TOP + 60);
    for (let y = TOP + 60; y <= H; y += 60) ctx.lineTo(sx + Math.sin(y * 0.02 + t) * 18, y);
    ctx.lineTo(W, H);
    ctx.lineTo(W, TOP + 60);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = PAL.ground;
    ctx.lineWidth = 5;
    ctx.stroke();
    ctx.restore();
    util.renderText({ ctx, text: 'FESTES UFER', x: sx + 220, y: TOP + 110, fontSize: '36px', fillStyle: PAL.ground });
    // Ziel-Markierungen
    shorePts.forEach((p) => {
      ctx.save();
      ctx.setLineDash([10, 10]);
      ctx.strokeStyle = PAL.dim;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(p.x, p.y, 60, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();
    });
    // Blutegel (Deko)
    ctx.save();
    ctx.strokeStyle = PAL.enemy;
    ctx.globalAlpha = 0.5;
    ctx.lineWidth = 4;
    leeches.forEach((l) => {
      ctx.beginPath();
      for (let k = 0; k < 6; k++) {
        const xx = l.x + k * 7;
        const yy = l.y + Math.sin(t * 4 + l.p + k) * 5;
        if (k === 0) ctx.moveTo(xx, yy);
        else ctx.lineTo(xx, yy);
      }
      ctx.stroke();
    });
    ctx.restore();
    // Kameraden
    men.forEach((m) => {
      const x = m.drag.getX();
      const y = m.drag.getY();
      if (m.state === 'lost') {
        ctx.save();
        ctx.strokeStyle = PAL.dim;
        ctx.globalAlpha = 0.5;
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.ellipse(x, y + 30, 50, 14, 0, 0, Math.PI * 2);
        ctx.stroke();
        ctx.restore();
        return;
      }
      const col = m.state === 'saved' ? PAL.good : m.drag.isGrabbed() ? PAL.accent : m.sink > 0.7 ? PAL.warn : PAL.friend;
      mgbSoldier(ctx, x, y, 1.3, col, t, m.state === 'sinking' ? m.sink : 0);
      if (m.state === 'sinking') {
        // Greif-Ring + Sink-Balken
        mgbRing(ctx, x, y, 82, m.drag.getValue() / 100, PAL.accent, 6);
        mgbBar(ctx, x - 50, y + 70, 100, 10, 1 - m.sink, m.sink > 0.7 ? PAL.warn : PAL.good);
        if (Math.random() < 0.08) burst(x + (Math.random() - 0.5) * 60, y + 40, PAL.water, 2, 40);
      }
    });
  }

  return {
    id: 'sumpf',
    title: 'SUMPF',
    hint: 'Versinkende Kameraden mit Licht greifen und ans feste Ufer ziehen!',
    update(grid, dt, ctx) {
      if (done) return null;
      t += dt;
      smUpdateSnaps(t);
      const test = isKeyDown('KeyK');
      men.forEach((m) => {
        if (m.state !== 'sinking') return;
        if (test) {
          // Test: Saal zieht nacheinander alle ans Ufer
          const first = men.find((o) => o.state === 'sinking');
          if (first === m) {
            const tx = smShoreX(t) + 200;
            const ty = m.drag.getY();
            const dx = tx - m.drag.getX();
            m.drag.setX(m.drag.getX() + Math.sign(dx) * Math.min(Math.abs(dx), 700 * dt));
            m.drag.setY(ty);
            if (m.drag.getX() > smShoreX(t) + 40) smSave(m);
          }
        } else {
          m.drag.handle(grid, dt);
        }
        if (m.state !== 'sinking') return;
        if (!m.drag.isGrabbed()) m.sink += dt / SM.sinkTime;
        else m.sink = Math.max(0, m.sink - dt * 0.05);
        if (m.drag.getX() > smShoreX(t) + 40 && !m.drag.isGrabbed()) smSave(m);
        if (m.sink >= 1) smLose(m);
      });
      draw(ctx);
      mgbTimer(ctx, SM.total - t, SM.total);
      const left = men.filter((m) => m.state === 'sinking').length;
      if (keyEdge('KeyX')) men.forEach((m) => smLose(m));
      if (t >= SM.total) men.forEach((m) => smLose(m));
      if (left === 0 || men.every((m) => m.state !== 'sinking')) {
        const lost = men.filter((m) => m.state === 'lost').length;
        const saved = count - lost;
        done = mgbResult(lost < count, lost, 0, 0, saved + ' von ' + count + ' aus dem Sumpf gezogen');
        return done;
      }
      return null;
    },
  };
}

// =========================================================================================================
// 7. MÖRSER – Einschlagkreise mit Countdown, Kameraden rechtzeitig herausziehen
// =========================================================================================================

function mgMoerser(opts) {
  const level = opts.level || 0;
  const count = clamp(Math.min(opts.squadCount || 4, 4 + level), 1, 6);
  const MO = {
    total: [30, 36, 42][level],
    interval: [3.4, 2.5, 1.8][level], // s zwischen neuen Einschlägen
    countdown: [4.2, 3.4, 2.7][level], // s bis zum Einschlag
    radius: [130, 145, 165][level],
    maxActive: [2, 3, 4][level],
  };
  const FIELD = { x0: 120, x1: W - 120, y0: TOP + 90, y1: H - 60 };
  const moBg = document.createElement('canvas');
  moBg.width = W;
  moBg.height = H - TOP;
  (function moRenderBg() {
    const c = moBg.getContext('2d');
    c.fillStyle = '#000000';
    c.fillRect(0, 0, moBg.width, moBg.height);
    // Gras-/Erdflecken, sehr dunkel
    for (let i = 0; i < 220; i++) {
      c.globalAlpha = 0.04 + Math.random() * 0.06;
      c.fillStyle = i % 2 ? PAL.ground : PAL.jungle;
      c.beginPath();
      c.arc(Math.random() * W, Math.random() * moBg.height, 10 + Math.random() * 60, 0, Math.PI * 2);
      c.fill();
    }
    c.globalAlpha = 1;
  })();

  const men = [];
  for (let i = 0; i < count; i++) {
    const m = {
      state: 'ok', // 'ok' | 'dead'
      drag: guiDragHandle({
        posX: 400 + (i % 3) * 520 + (Math.random() - 0.5) * 120,
        posY: TOP + 280 + Math.floor(i / 3) * 380 + (Math.random() - 0.5) * 80,
        radius: 65,
        grabSpeed: 160,
        fullPercent: 20,
        catchFactor: 1.8,
        maxSpeed: 1100,
        dropDelay: 0.45,
        visible: false,
        bounds: { x: FIELD.x0, y: FIELD.y0, width: FIELD.x1 - FIELD.x0, height: FIELD.y1 - FIELD.y0 },
        onGrab: () => playSound(SND.click, 0.25),
      }),
    };
    men.push(m);
  }
  const shells = []; // { x, y, r, left, total }
  const craters = [];
  let t = 0;
  let spawnTimer = 1.2;
  let done = null;

  function moSpawn() {
    const alive = men.filter((m) => m.state === 'ok');
    if (!alive.length) return;
    const target = alive[Math.floor(Math.random() * alive.length)];
    const ang = Math.random() * Math.PI * 2;
    const off = Math.random() * MO.radius * 0.6;
    shells.push({
      x: clamp(target.drag.getX() + Math.cos(ang) * off, FIELD.x0 + 60, FIELD.x1 - 60),
      y: clamp(target.drag.getY() + Math.sin(ang) * off, FIELD.y0 + 60, FIELD.y1 - 60),
      r: MO.radius,
      left: MO.countdown,
      total: MO.countdown,
    });
    playSound(SND.sonar, 0.25);
  }

  function moImpact(s) {
    burst(s.x, s.y, PAL.warn, 50, 520);
    burst(s.x, s.y, PAL.dim, 30, 260);
    addShake(14);
    playSound(SND.boom, 0.8);
    craters.push({ x: s.x, y: s.y, r: s.r * 0.55 });
    men.forEach((m) => {
      if (m.state !== 'ok') return;
      if (Math.hypot(m.drag.getX() - s.x, m.drag.getY() - s.y) < s.r) {
        m.state = 'dead';
        m.drag.setEnabled(false);
        addFloater(m.drag.getX(), m.drag.getY() - 70, 'GETROFFEN!', PAL.bad);
      }
    });
  }

  function draw(ctx) {
    ctx.drawImage(moBg, 0, TOP);
    // Krater (Display, dunkel)
    ctx.save();
    craters.forEach((c) => {
      ctx.strokeStyle = PAL.ground;
      ctx.globalAlpha = 0.45;
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.arc(c.x, c.y, c.r, 0, Math.PI * 2);
      ctx.stroke();
      ctx.globalAlpha = 0.25;
      ctx.beginPath();
      ctx.arc(c.x, c.y, c.r * 0.6, 0, Math.PI * 2);
      ctx.stroke();
    });
    ctx.restore();
    // Einschlagkreise: dunkel innen, pulsierende Kontur, Countdown-Ring
    shells.forEach((s) => {
      const f = s.left / s.total;
      const pulse = 0.5 + 0.5 * Math.sin(t * (8 + (1 - f) * 20));
      ctx.save();
      ctx.strokeStyle = f < 0.35 ? PAL.bad : PAL.warn;
      ctx.lineWidth = 3 + pulse * 3;
      ctx.setLineDash([18, 12]);
      ctx.lineDashOffset = -t * 60;
      ctx.beginPath();
      ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2);
      ctx.stroke();
      ctx.setLineDash([]);
      // Fadenkreuz
      ctx.globalAlpha = 0.6;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(s.x - 26, s.y);
      ctx.lineTo(s.x + 26, s.y);
      ctx.moveTo(s.x, s.y - 26);
      ctx.lineTo(s.x, s.y + 26);
      ctx.stroke();
      ctx.restore();
      mgbRing(ctx, s.x, s.y, s.r + 14, f, f < 0.35 ? PAL.bad : PAL.warn, 6);
      // fallende Granate (Schatten wird kleiner)
      ctx.save();
      ctx.fillStyle = PAL.dim;
      ctx.globalAlpha = 0.3 + 0.5 * (1 - f);
      ctx.beginPath();
      ctx.ellipse(s.x, s.y, 8 + 22 * (1 - f), 4 + 10 * (1 - f), 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    });
    // Kameraden
    men.forEach((m) => {
      const x = m.drag.getX();
      const y = m.drag.getY();
      if (m.state === 'dead') {
        ctx.save();
        ctx.globalAlpha = 0.35;
        mgbSoldier(ctx, x, y, 1.1, PAL.dim, 0, 0);
        ctx.restore();
        return;
      }
      const danger = shells.some((s) => Math.hypot(x - s.x, y - s.y) < s.r);
      mgbSoldier(ctx, x, y, 1.2, m.drag.isGrabbed() ? PAL.accent : danger ? PAL.warn : PAL.friend, t, 0);
      mgbRing(ctx, x, y, 78, m.drag.getValue() / 100, PAL.accent, 5);
    });
  }

  return {
    id: 'moerser',
    title: 'MÖRSERBESCHUSS',
    hint: 'Kameraden greifen und aus den Einschlagkreisen ziehen, bevor es kracht!',
    update(grid, dt, ctx) {
      if (done) return null;
      t += dt;
      const test = isKeyDown('KeyK');
      men.forEach((m) => {
        if (m.state !== 'ok') return;
        if (test) {
          // Test: aus jedem Gefahrenkreis wegschieben
          shells.forEach((s) => {
            const dx = m.drag.getX() - s.x;
            const dy = m.drag.getY() - s.y;
            const d = Math.hypot(dx, dy) || 1;
            if (d < s.r + 40) {
              m.drag.setX(clamp(m.drag.getX() + (dx / d) * 800 * dt, FIELD.x0 + 70, FIELD.x1 - 70));
              m.drag.setY(clamp(m.drag.getY() + (dy / d) * 800 * dt, FIELD.y0 + 70, FIELD.y1 - 70));
            }
          });
        } else {
          m.drag.handle(grid, dt);
        }
      });
      spawnTimer -= dt;
      if (spawnTimer <= 0 && t < MO.total - MO.countdown && shells.length < MO.maxActive) {
        spawnTimer = MO.interval * (0.7 + Math.random() * 0.6);
        moSpawn();
      }
      shells.slice().forEach((s) => {
        s.left -= dt;
        if (s.left <= 0) {
          shells.splice(shells.indexOf(s), 1);
          moImpact(s);
        }
      });
      draw(ctx);
      mgbTimer(ctx, MO.total - t, MO.total);
      if (keyEdge('KeyX')) {
        men.forEach((m) => {
          m.state = 'dead';
        });
      }
      const aliveNow = men.filter((m) => m.state === 'ok').length;
      if (aliveNow === 0 || (t >= MO.total && shells.length === 0)) {
        const dead = count - aliveNow;
        done = mgbResult(aliveNow > 0, dead, 0, 0, aliveNow > 0 ? 'Beschuss überstanden – ' + dead + ' Verluste' : 'Der ganze Trupp im Feuer …');
        return done;
      }
      return null;
    },
  };
}

// =========================================================================================================
// 8. SANITÄTER – im Herzschlag-Takt die Puls-Zone beleuchten
// =========================================================================================================

function mgSanitaeter(opts) {
  const level = opts.level || 0;
  const SA = {
    total: [35, 40, 45][level],
    period: [1.15, 0.95, 0.8][level], // s pro Herzschlag
    window: [0.24, 0.2, 0.17][level], // ± s um den Schlag
    hitGain: [0.11, 0.09, 0.075][level],
    missLoss: 0.06,
    offLossPerSec: [0.18, 0.24, 0.3][level], // Strafe fürs Leuchten neben dem Takt
    litPercent: 2.5, // ab diesem Flächenanteil gilt eine Zone als beleuchtet
    zones: level === 0 ? 1 : 2,
  };
  const ZY = 780;
  const zonePos = SA.zones === 1 ? [{ x: W / 2, y: ZY }] : [{ x: W / 2 - 360, y: ZY }, { x: W / 2 + 360, y: ZY }];
  const zones = zonePos.map((p) => ({
    x: p.x,
    y: p.y,
    lit: 0, // geglätteter Beleuchtungsgrad 0..1
    flash: 0,
    btn: guiPixelFillButton({
      label: '',
      posX: p.x,
      posY: p.y,
      radius: 120,
      speedUp: 100,
      speedDown: 100,
      fullPercent: 20,
      edges: 32,
      visible: false,
    }),
  }));
  let t = 0;
  let stability = 0.4;
  let nextBeat = 1.5;
  let beatIndex = 0;
  let windowLit = 0;
  let evaluated = false;
  let done = null;
  const ecg = []; // Ringpuffer der EKG-Kurve
  let ecgPhase = 0;
  let hits = 0;
  let misses = 0;

  function saActive() {
    return SA.zones === 1 ? 0 : beatIndex % 2;
  }

  function saEcgValue(phase) {
    // typische QRS-Form aus Phase 0..1 nach dem Schlag
    if (phase < 0.04) return -0.2 * (phase / 0.04);
    if (phase < 0.08) return -0.2 + 1.4 * ((phase - 0.04) / 0.04);
    if (phase < 0.13) return 1.2 - 1.6 * ((phase - 0.08) / 0.05);
    if (phase < 0.18) return -0.4 + 0.4 * ((phase - 0.13) / 0.05);
    if (phase > 0.35 && phase < 0.5) return 0.18 * Math.sin(((phase - 0.35) / 0.15) * Math.PI);
    return 0;
  }

  function draw(ctx) {
    ctx.save();
    ctx.fillStyle = '#000000';
    ctx.fillRect(0, TOP, W, H - TOP);
    ctx.restore();
    // EKG-Monitor (Display)
    const MX = 260;
    const MY = TOP + 90;
    const MW = W - 520;
    const MH = 260;
    ctx.save();
    ctx.strokeStyle = PAL.dim;
    ctx.lineWidth = 2;
    ctx.strokeRect(MX, MY, MW, MH);
    ctx.globalAlpha = 0.15;
    for (let gx = MX; gx < MX + MW; gx += 40) {
      ctx.beginPath();
      ctx.moveTo(gx, MY);
      ctx.lineTo(gx, MY + MH);
      ctx.stroke();
    }
    ctx.globalAlpha = 1;
    const col = stability < 0.25 ? PAL.bad : stability < 0.6 ? PAL.warn : PAL.good;
    ctx.strokeStyle = col;
    ctx.shadowColor = col;
    ctx.shadowBlur = 10;
    ctx.lineWidth = 4;
    ctx.beginPath();
    for (let i = 0; i < ecg.length; i++) {
      const x = MX + (i / 300) * MW;
      const y = MY + MH * 0.6 - ecg[i] * MH * 0.38;
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.stroke();
    ctx.restore();
    util.renderText({ ctx, text: 'PULS ' + Math.round(60 / SA.period) + '   STABIL ' + Math.round(stability * 100) + '%', x: W / 2, y: MY + MH + 50, fontSize: '36px', fillStyle: col });
    mgbBar(ctx, MX, MY + MH + 75, MW, 18, stability, col);
    // Verwundeter (Display, liegt zwischen den Zonen)
    ctx.save();
    ctx.translate(W / 2, ZY + 190);
    ctx.rotate(-Math.PI / 2);
    mgbSoldier(ctx, 0, 0, 1.1, PAL.friend, 0, 0);
    ctx.restore();
    // Zonen
    const tb = nextBeat - t; // Zeit bis zum Schlag
    const inWin = Math.abs(tb) <= SA.window;
    zones.forEach((z, i) => {
      const active = i === saActive();
      const approach = active ? clamp(1 - tb / SA.period, 0, 1) : 0;
      mgbPad(ctx, z.x, z.y, 120, active ? (inWin ? PAL.good : PAL.accent) : PAL.dim, active ? 5 : 2);
      if (active) {
        // schrumpfender Takt-Ring zeigt den nächsten Schlag
        ctx.save();
        ctx.strokeStyle = inWin ? PAL.good : PAL.accent;
        ctx.globalAlpha = 0.4 + 0.6 * approach;
        ctx.lineWidth = 4;
        ctx.beginPath();
        ctx.arc(z.x, z.y, 120 + 120 * (1 - approach), 0, Math.PI * 2);
        ctx.stroke();
        ctx.restore();
      }
      if (z.flash > 0) mgbRing(ctx, z.x, z.y, 136, 1, z.flash > 0 && z.good ? PAL.good : PAL.bad, 10 * z.flash);
      util.renderText({ ctx, text: active ? '♥' : '', x: z.x, y: z.y + 18, fontSize: '56px', fillStyle: PAL.accent });
    });
  }

  return {
    id: 'sanitaeter',
    title: 'SANITÄTER',
    hint: 'Nur im Herzschlag-Takt auf die leuchtende Zone! Daneben leuchten schadet.',
    update(grid, dt, ctx) {
      if (done) return null;
      t += dt;
      const test = isKeyDown('KeyK');
      const tb = nextBeat - t;
      const inWin = Math.abs(tb) <= SA.window;
      zones.forEach((z, i) => {
        z.btn.handle(grid, dt);
        let litNow = z.btn.getFillPercent() > SA.litPercent ? 1 : 0;
        if (test) litNow = i === saActive() && inWin ? 1 : 0;
        z.lit = litNow;
        z.flash = Math.max(0, z.flash - dt * 2);
        const active = i === saActive();
        if (litNow) {
          if (active && inWin) windowLit += dt;
          else stability -= SA.offLossPerSec * dt; // falscher Zeitpunkt / falsche Zone
        }
      });
      // Schlag auswerten, sobald das Fenster vorbei ist
      if (t > nextBeat + SA.window && !evaluated) {
        evaluated = true;
        const z = zones[saActive()];
        if (windowLit > 0.05) {
          stability += SA.hitGain;
          hits++;
          z.flash = 1;
          z.good = true;
          burst(z.x, z.y, PAL.good, 10, 200);
          playSound(SND.click, 0.3);
        } else {
          stability -= SA.missLoss;
          misses++;
          z.flash = 1;
          z.good = false;
        }
      }
      if (evaluated && t > nextBeat + SA.window) {
        nextBeat += SA.period;
        beatIndex++;
        windowLit = 0;
        evaluated = false;
      }
      // EKG-Kurve fortschreiben
      ecgPhase = (t - (nextBeat - SA.period)) / SA.period;
      const noise = (1 - stability) * (Math.random() - 0.5) * 0.25;
      ecg.push(saEcgValue(clamp(ecgPhase, 0, 1.5) % 1) * (0.5 + stability * 0.7) + noise);
      if (ecg.length > 300) ecg.shift();
      stability = clamp(stability, 0, 1);
      draw(ctx);
      mgbTimer(ctx, SA.total - t, SA.total);
      if (keyEdge('KeyX')) stability = 0;
      if (stability >= 1) {
        burst(W / 2, ZY + 190, PAL.good, 40, 300);
        playSound(SND.win, 0.6);
        done = mgbResult(true, 0, 0, 0, 'Patient stabil! (' + hits + ' Schläge im Takt)');
        return done;
      }
      if (stability <= 0 || t >= SA.total) {
        playSound(SND.error, 0.6);
        done = mgbResult(false, 1, 0, 0, stability <= 0 ? 'Puls verloren …' : 'Zu spät – er hat es nicht geschafft');
        return done;
      }
      return null;
    },
  };
}

// =========================================================================================================
// 9. FUNKSPRUCH – Frequenz einstellen, dann Morse-Folge nachleuchten
// =========================================================================================================

function mgFunkspruch(opts) {
  const level = opts.level || 0;
  const FU = {
    total: [42, 44, 46][level],
    band: [0.075, 0.058, 0.045][level], // halbe Breite des Zielbands (0..1)
    holdNeeded: 2,
    seqLen: [3, 4, 6][level],
    padCount: level >= 2 ? 5 : 4,
    showOn: [0.8, 0.65, 0.55][level],
    showOff: 0.25,
    wrongPenalty: 3,
  };
  const target = 0.15 + Math.random() * 0.7;
  const dial = guiSteerStrip({
    posX: W / 2,
    posY: 900,
    width: 1500,
    height: 200,
    axis: 'x',
    minPercent: 0.2,
    smoothing: 6,
    startValue: target < 0.5 ? 0.9 : 0.1,
    visible: false,
  });
  const padPos = [];
  for (let i = 0; i < FU.padCount; i++) {
    const a = Math.PI + (i / (FU.padCount - 1)) * Math.PI;
    padPos.push({ x: W / 2 + Math.cos(a) * 680, y: 820 + Math.sin(a) * 330 });
  }
  const pads = padPos.map((p) => ({
    x: p.x,
    y: p.y,
    glow: 0,
    btn: guiPixelFillButton({ label: '', posX: p.x, posY: p.y, radius: 105, speedUp: 170, speedDown: 90, fullPercent: 15, edges: 32, visible: false }),
  }));
  const seq = [];
  for (let i = 0; i < FU.seqLen; i++) {
    let k;
    do {
      k = Math.floor(Math.random() * FU.padCount);
    } while (seq.length && seq[seq.length - 1] === k);
    seq.push(k);
  }
  let phase = 'tune'; // 'tune' | 'show' | 'input'
  let hold = 0;
  let t = 0;
  let penalty = 0;
  let showT = 0;
  let inputPos = 0;
  let cooldown = 0;
  let errors = 0;
  let done = null;
  // vorgerendertes Rauschen (Display)
  const fuNoise = document.createElement('canvas');
  fuNoise.width = 400;
  fuNoise.height = 120;
  (function fuRenderNoise() {
    const c = fuNoise.getContext('2d');
    for (let i = 0; i < 2600; i++) {
      c.fillStyle = Math.random() < 0.5 ? PAL.dim : PAL.text;
      c.globalAlpha = Math.random() * 0.8;
      c.fillRect(Math.random() * 400, Math.random() * 120, 2, 2);
    }
  })();

  function fuStartShow() {
    phase = 'show';
    showT = 0;
    inputPos = 0;
    pads.forEach((p) => p.btn.setValue(0));
  }

  function fuDrawRadio(ctx) {
    // Funkgerät-Display (oben)
    const RX = 460;
    const RY = TOP + 70;
    const RW = 1000;
    const RH = 300;
    ctx.save();
    ctx.strokeStyle = PAL.dim;
    ctx.lineWidth = 3;
    ctx.strokeRect(RX, RY, RW, RH);
    ctx.restore();
    const v = dial.getValue();
    const dist = Math.abs(v - target);
    const clear = clamp(1 - dist / (FU.band * 4), 0, 1);
    // Skala
    ctx.save();
    ctx.strokeStyle = PAL.dim;
    ctx.lineWidth = 2;
    for (let i = 0; i <= 40; i++) {
      const x = RX + 40 + (i / 40) * (RW - 80);
      ctx.beginPath();
      ctx.moveTo(x, RY + RH - 40);
      ctx.lineTo(x, RY + RH - (i % 5 ? 55 : 75));
      ctx.stroke();
    }
    // Nadel
    const nx = RX + 40 + v * (RW - 80);
    ctx.strokeStyle = clear > 0.75 ? PAL.good : PAL.accent;
    ctx.lineWidth = 5;
    ctx.beginPath();
    ctx.moveTo(nx, RY + 30);
    ctx.lineTo(nx, RY + RH - 30);
    ctx.stroke();
    // Rauschen / Signal
    ctx.globalAlpha = 0.15 + (1 - clear) * 0.6;
    ctx.drawImage(fuNoise, Math.random() * -40, 0, 440, 120, RX + 40, RY + 50, RW - 80, 120);
    ctx.globalAlpha = 1;
    ctx.strokeStyle = PAL.good;
    ctx.globalAlpha = clear;
    ctx.lineWidth = 3;
    ctx.beginPath();
    for (let x = 0; x <= RW - 80; x += 6) {
      const y = RY + 110 + Math.sin(x * 0.05 + t * 12) * 30 * clear;
      if (x === 0) ctx.moveTo(RX + 40 + x, y);
      else ctx.lineTo(RX + 40 + x, y);
    }
    ctx.stroke();
    ctx.restore();
    util.renderText({ ctx, text: (88 + v * 20).toFixed(1) + ' MHz', x: RX + RW / 2, y: RY + RH + 50, fontSize: '40px', fillStyle: clear > 0.75 ? PAL.good : PAL.text });
    return clear;
  }

  function draw(ctx) {
    ctx.save();
    ctx.fillStyle = '#000000';
    ctx.fillRect(0, TOP, W, H - TOP);
    ctx.restore();
    if (phase === 'tune') {
      fuDrawRadio(ctx);
      // Regler-Streifen: dunkel + Kontur
      ctx.save();
      ctx.strokeStyle = PAL.accent;
      ctx.lineWidth = 3;
      ctx.strokeRect(W / 2 - 750, 800, 1500, 200);
      const px = W / 2 - 750 + dial.getValue() * 1500;
      ctx.beginPath();
      ctx.moveTo(px, 800);
      ctx.lineTo(px, 1000);
      ctx.stroke();
      ctx.restore();
      util.renderText({ ctx, text: 'FREQUENZ-REGLER – gemeinsam hin und her fahren', x: W / 2, y: 780, fontSize: '30px', fillStyle: PAL.dim });
      mgbBar(ctx, W / 2 - 200, 610, 400, 22, hold / FU.holdNeeded, PAL.good, 'Signal halten');
      return;
    }
    util.renderText({ ctx, text: phase === 'show' ? 'MORSE-FOLGE MERKEN …' : 'NACHLEUCHTEN: ' + inputPos + ' / ' + seq.length, x: W / 2, y: TOP + 140, fontSize: '60px', fillStyle: phase === 'show' ? PAL.accent : PAL.text });
    // Fortschritt als Morse-Zeichen
    for (let i = 0; i < seq.length; i++) {
      const x = W / 2 - (seq.length - 1) * 45 + i * 90;
      ctx.save();
      ctx.fillStyle = i < inputPos ? PAL.good : PAL.dim;
      ctx.globalAlpha = i < inputPos ? 1 : 0.4;
      if (seq[i] % 2) ctx.fillRect(x - 30, TOP + 200, 60, 16);
      else {
        ctx.beginPath();
        ctx.arc(x, TOP + 208, 11, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.restore();
    }
    pads.forEach((p, i) => {
      mgbPad(ctx, p.x, p.y, 105, p.glow > 0 ? PAL.accent : PAL.dim, 3 + p.glow * 8);
      if (p.glow > 0) {
        ctx.save();
        ctx.strokeStyle = PAL.glow;
        ctx.globalAlpha = p.glow;
        ctx.shadowColor = PAL.glow;
        ctx.shadowBlur = 25;
        ctx.lineWidth = 6;
        ctx.beginPath();
        ctx.arc(p.x, p.y, 125, 0, Math.PI * 2);
        ctx.stroke();
        ctx.restore();
      }
      if (phase === 'input') mgbRing(ctx, p.x, p.y, 118, p.btn.getValue() / 75, PAL.accent, 6);
      util.renderText({ ctx, text: String(i + 1), x: p.x, y: p.y + 20, fontSize: '56px', fillStyle: PAL.dim });
    });
  }

  return {
    id: 'funkspruch',
    title: 'FUNKSPRUCH',
    hint: 'Erst die Frequenz finden, dann die Morse-Folge in der richtigen Reihenfolge nachleuchten.',
    update(grid, dt, ctx) {
      if (done) return null;
      t += dt;
      const test = isKeyDown('KeyK');
      pads.forEach((p) => {
        p.glow = Math.max(0, p.glow - dt * 3);
      });
      if (phase === 'tune') {
        if (test) dial.setValue(dial.getValue() + (target - dial.getValue()) * Math.min(1, dt * 3));
        else dial.handle(grid, dt);
        if (Math.abs(dial.getValue() - target) <= FU.band) hold += dt;
        else hold = Math.max(0, hold - dt * 0.7);
        if (hold >= FU.holdNeeded) {
          playSound(SND.sonar, 0.6);
          addFloater(W / 2, TOP + 300, 'VERBINDUNG!', PAL.good);
          fuStartShow();
        }
      } else if (phase === 'show') {
        showT += dt;
        const step = FU.showOn + FU.showOff;
        const k = Math.floor(showT / step);
        if (k < seq.length && showT - k * step < FU.showOn) pads[seq[k]].glow = 1;
        pads.forEach((p) => {
          p.btn.handle(grid, dt);
          p.btn.setValue(0); // während der Vorführung zählt nichts
        });
        if (showT >= seq.length * step + 0.3) phase = 'input';
      } else {
        cooldown = Math.max(0, cooldown - dt);
        pads.forEach((p, i) => {
          if (test) {
            if (i === seq[inputPos]) p.btn.setValue(p.btn.getValue() + 220 * dt);
          } else {
            p.btn.handle(grid, dt);
          }
          if (cooldown > 0) p.btn.setValue(0);
          if (p.btn.getValue() >= 75) {
            pads.forEach((q) => q.btn.setValue(0));
            cooldown = 0.45;
            p.glow = 1;
            if (i === seq[inputPos]) {
              inputPos++;
              burst(p.x, p.y, PAL.good, 14, 240);
              playSound(SND.click, 0.4);
            } else {
              errors++;
              penalty += FU.wrongPenalty;
              addShake(8);
              addFloater(p.x, p.y - 140, 'FALSCH! −' + FU.wrongPenalty + ' s', PAL.bad);
              playSound(SND.error, 0.6);
              fuStartShow();
            }
          }
        });
      }
      draw(ctx);
      const left = FU.total - t - penalty;
      mgbTimer(ctx, left, FU.total);
      if (phase === 'input' && inputPos >= seq.length) {
        playSound(SND.win, 0.7);
        done = mgbResult(true, 0, 2 + level, 3 + level, 'Funkspruch durch! Versorgung kommt' + (errors ? ' (' + errors + ' Fehler)' : ''));
        return done;
      }
      if (keyEdge('KeyX') || left <= 0) {
        playSound(SND.error, 0.6);
        done = mgbResult(false, 0, 0, 0, 'Keine Verbindung – nur Rauschen …');
        return done;
      }
      return null;
    },
  };
}

// =========================================================================================================
// 10. VERSORGUNGSABWURF – Kisten mit dem Lichtkorb fangen, Späher vertreiben, Bomben meiden
// =========================================================================================================

function mgAbwurf(opts) {
  const level = opts.level || 0;
  const AB = {
    total: [40, 42, 45][level],
    goal: [6, 8, 10][level],
    fallSpeed: [115, 145, 175][level],
    interval: [1.9, 1.5, 1.2][level],
    bombShare: [0.15, 0.22, 0.3][level],
    landedTime: [6, 5, 4][level], // so lange liegt eine Kiste am Boden
    scoutSpeed: [90, 120, 150][level],
    basketY: 900,
    groundY: 1010,
    catchHalf: 115,
  };
  const basket = guiFollowCircle({
    label: '',
    posX: W / 2,
    posY: AB.basketY,
    radius: 90,
    speedUp: 0.3,
    speedDown: 0.2,
    scanRadiusFactor: 2.3,
    innerRadiusFactor: 0.2,
    followTrueOrRepellFalse: true,
    visible: false,
  });
  const drops = []; // { x, y, bomb, state: 'fall'|'ground', groundT, sway }
  const scouts = []; // { x, dir, target, btn }
  let t = 0;
  let spawnT = 0.8;
  let caught = 0;
  let stolen = 0;
  let casualties = 0;
  let done = null;
  const abSky = document.createElement('canvas');
  abSky.width = W;
  abSky.height = H - TOP;
  (function abRenderSky() {
    const c = abSky.getContext('2d');
    c.fillStyle = '#000000';
    c.fillRect(0, 0, W, abSky.height);
    // Baumkronen-Silhouetten am Rand (Display)
    c.fillStyle = PAL.jungle;
    c.globalAlpha = 0.18;
    for (let i = 0; i < 40; i++) {
      const x = (i / 40) * W;
      c.beginPath();
      c.arc(x, abSky.height - 40 - Math.random() * 40, 50 + Math.random() * 40, Math.PI, 0);
      c.fill();
    }
    c.globalAlpha = 0.08;
    c.fillStyle = PAL.dim;
    for (let i = 0; i < 6; i++) {
      c.beginPath();
      c.ellipse(Math.random() * W, 80 + Math.random() * 240, 160, 30, 0, 0, Math.PI * 2);
      c.fill();
    }
    c.globalAlpha = 1;
  })();

  function abSpawnDrop() {
    drops.push({ x: 180 + Math.random() * (W - 360), y: TOP + 20, bomb: Math.random() < AB.bombShare, state: 'fall', groundT: 0, sway: Math.random() * 6 });
    playSound(SND.plop, 0.2);
  }

  function abSpawnScout(d) {
    const fromLeft = d.x > W / 2 ? false : true;
    const sx = fromLeft ? -60 : W + 60;
    const s = {
      x: sx,
      target: d,
      btn: guiPixelFillButton({ label: '', posX: sx, posY: AB.groundY - 50, radius: 70, speedUp: 130, speedDown: 50, fullPercent: 18, edges: 32, visible: false }),
    };
    scouts.push(s);
  }

  function abCollect(d) {
    drops.splice(drops.indexOf(d), 1);
    scouts.filter((s) => s.target === d).forEach((s) => {
      s.target = null;
    });
    if (d.bomb) {
      casualties++;
      burst(d.x, d.y, PAL.bad, 50, 500);
      addShake(16);
      addFloater(d.x, d.y - 60, 'BOMBE!', PAL.bad);
      playSound(SND.boom, 0.8);
    } else {
      caught++;
      burst(d.x, d.y, PAL.good, 20, 260);
      addFloater(d.x, d.y - 60, '+1 KISTE', PAL.good);
      playSound(SND.pickup, 0.6);
    }
  }

  function abDrawCrate(ctx, d) {
    const bomb = d.bomb;
    const col = bomb ? PAL.bad : PAL.accent;
    const sway = d.state === 'fall' ? Math.sin(t * 2 + d.sway) * 0.15 : 0;
    ctx.save();
    ctx.translate(d.x, d.y);
    ctx.rotate(sway);
    if (d.state === 'fall') {
      // Fallschirm (Display-Kontur)
      ctx.strokeStyle = PAL.dim;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(0, -90, 70, Math.PI, 0);
      ctx.stroke();
      for (let k = -1; k <= 1; k++) {
        ctx.beginPath();
        ctx.moveTo(k * 70, -90);
        ctx.lineTo(k * 18, -26);
        ctx.stroke();
      }
    }
    ctx.fillStyle = '#000000';
    ctx.strokeStyle = col;
    ctx.lineWidth = 4;
    if (bomb) {
      ctx.beginPath();
      ctx.arc(0, 0, 28, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(14, -24);
      ctx.lineTo(24, -40);
      ctx.stroke();
      if (Math.sin(t * 20) > 0) {
        ctx.fillStyle = PAL.warn;
        ctx.beginPath();
        ctx.arc(26, -43, 5, 0, Math.PI * 2);
        ctx.fill();
      }
    } else {
      ctx.fillRect(-30, -26, 60, 52);
      ctx.strokeRect(-30, -26, 60, 52);
      ctx.beginPath();
      ctx.moveTo(-30, -26);
      ctx.lineTo(30, 26);
      ctx.moveTo(30, -26);
      ctx.lineTo(-30, 26);
      ctx.stroke();
    }
    ctx.restore();
    if (d.state === 'ground' && !d.bomb) mgbBar(ctx, d.x - 40, d.y + 36, 80, 8, 1 - d.groundT / AB.landedTime, PAL.warn);
  }

  function draw(ctx) {
    ctx.drawImage(abSky, 0, TOP);
    // Boden
    ctx.save();
    ctx.strokeStyle = PAL.ground;
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.moveTo(0, AB.groundY + 30);
    ctx.lineTo(W, AB.groundY + 30);
    ctx.stroke();
    ctx.restore();
    drops.forEach((d) => abDrawCrate(ctx, d));
    // Späher: dunkle Gestalt mit Gegner-Kontur, Vertreibe-Ring
    scouts.forEach((s) => {
      ctx.save();
      ctx.globalAlpha = 0.9;
      mgbSoldier(ctx, s.x, AB.groundY - 50, 1.1, PAL.enemy, t, 0);
      ctx.restore();
      mgbRing(ctx, s.x, AB.groundY - 50, 80, s.btn.getValue() / 75, PAL.accent, 5);
    });
    // Lichtkorb: dunkle Schale, helle Kontur
    const bx = basket.getX();
    ctx.save();
    ctx.fillStyle = '#000000';
    ctx.strokeStyle = PAL.good;
    ctx.lineWidth = 5;
    ctx.beginPath();
    ctx.moveTo(bx - AB.catchHalf, AB.basketY - 30);
    ctx.lineTo(bx - AB.catchHalf + 25, AB.basketY + 40);
    ctx.lineTo(bx + AB.catchHalf - 25, AB.basketY + 40);
    ctx.lineTo(bx + AB.catchHalf, AB.basketY - 30);
    ctx.fill();
    ctx.stroke();
    ctx.globalAlpha = 0.35;
    ctx.setLineDash([8, 10]);
    ctx.strokeRect(bx - 207, AB.basketY - 207, 414, 414);
    ctx.restore();
    util.renderText({ ctx, text: 'KISTEN ' + caught + ' / ' + AB.goal, x: 260, y: TOP + 90, fontSize: '44px', fillStyle: PAL.text });
    if (stolen) util.renderText({ ctx, text: 'geklaut: ' + stolen, x: W - 240, y: TOP + 90, fontSize: '36px', fillStyle: PAL.bad });
  }

  return {
    id: 'abwurf',
    title: 'VERSORGUNGSABWURF',
    hint: 'Lichtkorb unter die Kisten lenken! Späher wegleuchten – Bomben NICHT fangen.',
    update(grid, dt, ctx) {
      if (done) return null;
      t += dt;
      const test = isKeyDown('KeyK');
      if (test) {
        // Test: Korb fährt unter die nächste gute Kiste
        const good = drops.filter((d) => !d.bomb).sort((a, b) => b.y - a.y)[0];
        let tx = good ? good.x : basket.getX();
        // Bomben knapp über dem Korb ausweichen
        drops.forEach((d) => {
          if (d.bomb && d.state === 'fall' && d.y > AB.basketY - 260 && d.y < AB.basketY + 20 && Math.abs(d.x - tx) < AB.catchHalf + 40) {
            tx = d.x + (tx >= d.x ? 1 : -1) * (AB.catchHalf + 80);
          }
        });
        basket.setX(basket.getX() + clamp(tx - basket.getX(), -900 * dt, 900 * dt));
      } else {
        basket.handle(grid, dt);
      }
      basket.setX(clamp(basket.getX(), AB.catchHalf, W - AB.catchHalf));
      basket.setY(AB.basketY);
      spawnT -= dt;
      if (spawnT <= 0 && t < AB.total - 3) {
        spawnT = AB.interval * (0.7 + Math.random() * 0.6);
        abSpawnDrop();
      }
      const bx = basket.getX();
      drops.slice().forEach((d) => {
        if (d.state === 'fall') {
          d.y += AB.fallSpeed * dt;
          d.x += Math.sin(t * 2 + d.sway) * 20 * dt;
          if (Math.abs(d.y - AB.basketY) < 30 && Math.abs(d.x - bx) < AB.catchHalf) {
            abCollect(d);
            return;
          }
          if (d.y >= AB.groundY) {
            d.y = AB.groundY;
            d.state = 'ground';
            if (d.bomb) {
              drops.splice(drops.indexOf(d), 1);
              burst(d.x, d.y, PAL.warn, 30, 300);
              addShake(6);
              playSound(SND.boom, 0.4);
            } else {
              abSpawnScout(d);
            }
          }
        } else {
          d.groundT += dt;
          // gelandete Kisten kann der Korb am Boden einsammeln
          if (Math.abs(d.x - bx) < AB.catchHalf - 20 && test) abCollect(d);
          else if (d.groundT >= AB.landedTime) {
            drops.splice(drops.indexOf(d), 1);
            addFloater(d.x, d.y - 60, 'verloren', PAL.dim);
          }
        }
      });
      // Korb sammelt auch am Boden liegende Kisten ein, wenn er drüber steht (ohne Test)
      if (!test) {
        drops.slice().forEach((d) => {
          if (d.state === 'ground' && Math.abs(d.x - bx) < AB.catchHalf - 20 && d.groundT > 0.3) abCollect(d);
        });
      }
      scouts.slice().forEach((s) => {
        const tx = s.target ? s.target.x : s.x < W / 2 ? -100 : W + 100;
        const dir = Math.sign(tx - s.x);
        s.x += dir * AB.scoutSpeed * dt;
        s.btn.setX(s.x);
        if (test) s.btn.setValue(s.btn.getValue() + 120 * dt);
        else s.btn.handle(grid, dt);
        if (s.btn.getValue() >= 75) {
          scouts.splice(scouts.indexOf(s), 1);
          burst(s.x, AB.groundY - 50, PAL.enemy, 16, 260);
          addFloater(s.x, AB.groundY - 140, 'VERTRIEBEN', PAL.good);
          playSound(SND.shot, 0.5);
          return;
        }
        if (s.target && Math.abs(s.target.x - s.x) < 20) {
          const i = drops.indexOf(s.target);
          if (i >= 0) {
            drops.splice(i, 1);
            stolen++;
            addFloater(s.x, AB.groundY - 140, 'GEKLAUT!', PAL.bad);
            playSound(SND.error, 0.5);
          }
          s.target = null;
        }
        if (!s.target && (s.x < -80 || s.x > W + 80)) scouts.splice(scouts.indexOf(s), 1);
        if (s.target && drops.indexOf(s.target) < 0) s.target = null;
      });
      draw(ctx);
      mgbTimer(ctx, AB.total - t, AB.total);
      const forceFail = keyEdge('KeyX');
      if (caught >= AB.goal || forceFail || t >= AB.total) {
        const win = caught >= AB.goal && !forceFail;
        if (win) playSound(SND.win, 0.7);
        done = mgbResult(win, casualties, Math.round(caught * 0.6), Math.round(caught * 0.6) + (win ? 2 : 0), caught + ' Kisten geborgen' + (stolen ? ', ' + stolen + ' geklaut' : '') + (casualties ? ', ' + casualties + ' Bombenopfer' : ''));
        return done;
      }
      return null;
    },
  };
}

// =========================================================================================================
// Minispiele 11–14 (Chunk C): Brücke, Tierangriff, Vorräte, Gefangene
// Vertrag: function mgXyz(opts) → { id, title, hint, update(grid, dt, ctx) }; update liefert null, solange
// es läuft, und genau einmal { win, casualties, loot: { food, ammo }, text }.
// Test: K halten = Saal löst es (nach und nach), X = sofort verloren.
// Gemeinsame Helfer dieses Chunks tragen das Präfix mgc, die Minispiele br / ta / vo / ge.
// =========================================================================================================

// Zeitbalken oben im Spielbereich (fraction 1 → 0), Text links
function mgcDrawTimer(ctx, fraction, label, color) {
  const x = 160;
  const y = TOP + 18;
  const w = W - 320;
  ctx.save();
  ctx.fillStyle = PAL.dark;
  ctx.fillRect(x, y, w, 16);
  ctx.fillStyle = color || PAL.accent;
  ctx.fillRect(x, y, w * clamp(fraction, 0, 1), 16);
  ctx.strokeStyle = PAL.dim;
  ctx.lineWidth = 2;
  ctx.strokeRect(x, y, w, 16);
  ctx.restore();
  if (label) util.renderText({ ctx, text: label, x: W / 2, y: TOP + 70, fontSize: '34px', fillStyle: PAL.text });
}

// Aktionsfläche: schwarzer Kreis mit Kontur und Füllring (value 0..1)
function mgcDrawPad(ctx, x, y, r, value, color, label) {
  ctx.save();
  ctx.fillStyle = '#000000';
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = PAL.pad;
  ctx.lineWidth = 3;
  ctx.stroke();
  if (value > 0) {
    ctx.strokeStyle = color || PAL.accent;
    ctx.lineWidth = 10;
    ctx.beginPath();
    ctx.arc(x, y, r + 10, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * clamp(value, 0, 1));
    ctx.stroke();
  }
  ctx.restore();
  if (label) util.renderText({ ctx, text: label, x, y: y + r + 42, fontSize: '28px', fillStyle: PAL.dim });
}

function mgcCanvas(w, h) {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  return c;
}

// unsichtbarer Sensor (Füllrate ∝ Flächenanteil), Zeichnen übernimmt das Minispiel
function mgcSensor(x, y, r, speedUp, speedDown, fullPercent) {
  return guiPixelFillButton({
    label: '',
    posX: x,
    posY: y,
    radius: r,
    speedUp: speedUp,
    speedDown: speedDown,
    fullPercent: fullPercent || 25,
    activeValue: 100,
    minValue: 0,
    edges: 12,
    visible: false,
  });
}

function mgcResult(win, casualties, food, ammo, text) {
  return { win: !!win, casualties: casualties || 0, loot: { food: food || 0, ammo: ammo || 0 }, text: text || '' };
}

// ---------------------------------------------------------------------------------------------------------
// 11. BRÜCKE – Planken in die Lücken der Hängebrücke ziehen, bevor die Verfolger da sind
// ---------------------------------------------------------------------------------------------------------

const BR = {
  bridgeY: 470,
  x0: 560,
  x1: 1360,
  plankW: 120,
  plankH: 40,
  time: [42, 36, 30],
  gaps: [3, 4, 5],
  crossTime: 2.6,
};

function brBuildBackground() {
  const c = mgcCanvas(W, H);
  const g = c.getContext('2d');
  // Schlucht: dunkle Felswände links und rechts, Abgrund in der Mitte (nur Kontur, kein Licht)
  g.fillStyle = PAL.dark;
  g.fillRect(0, TOP, W, H - TOP);
  g.fillStyle = PAL.ground;
  g.globalAlpha = 0.35;
  g.beginPath();
  g.moveTo(0, BR.bridgeY + 10);
  g.lineTo(BR.x0, BR.bridgeY + 10);
  g.lineTo(BR.x0 - 60, H);
  g.lineTo(0, H);
  g.closePath();
  g.fill();
  g.beginPath();
  g.moveTo(W, BR.bridgeY + 10);
  g.lineTo(BR.x1, BR.bridgeY + 10);
  g.lineTo(BR.x1 + 60, H);
  g.lineTo(W, H);
  g.closePath();
  g.fill();
  g.globalAlpha = 1;
  g.strokeStyle = PAL.jungle;
  g.lineWidth = 3;
  g.beginPath();
  g.moveTo(0, BR.bridgeY + 10);
  g.lineTo(BR.x0, BR.bridgeY + 10);
  g.lineTo(BR.x0 - 60, H);
  g.moveTo(W, BR.bridgeY + 10);
  g.lineTo(BR.x1, BR.bridgeY + 10);
  g.lineTo(BR.x1 + 60, H);
  g.stroke();
  // Felskanten-Striche im Abgrund (Tiefe)
  g.strokeStyle = PAL.dim;
  g.globalAlpha = 0.25;
  for (let i = 0; i < 14; i++) {
    const y = BR.bridgeY + 80 + i * 38;
    g.beginPath();
    g.moveTo(BR.x0 + 30 + i * 6, y);
    g.lineTo(BR.x0 + 90 + i * 9, y + 10);
    g.moveTo(BR.x1 - 30 - i * 6, y);
    g.lineTo(BR.x1 - 90 - i * 9, y + 10);
    g.stroke();
  }
  g.globalAlpha = 1;
  // Dschungel-Silhouetten oben
  g.fillStyle = PAL.jungle;
  g.globalAlpha = 0.25;
  for (let i = 0; i < 24; i++) {
    const x = (i * 97) % W;
    const h = 60 + ((i * 53) % 90);
    g.beginPath();
    g.ellipse(x, TOP + 110, 70, h, 0, 0, Math.PI * 2);
    g.fill();
  }
  g.globalAlpha = 1;
  return c;
}

function mgBruecke(opts) {
  const level = clamp(opts.level || 0, 0, 2);
  const nGaps = BR.gaps[level];
  const total = BR.time[level];
  const nBoards = 8 + nGaps; // Brückenbretter insgesamt
  const boardW = (BR.x1 - BR.x0) / nBoards;
  // Lücken gleichmässig verteilt, nie am Rand
  const gapIdx = [];
  for (let i = 0; i < nGaps; i++) gapIdx.push(Math.round(((i + 1) * nBoards) / (nGaps + 1)) - 0);
  const slots = gapIdx.map((bi) => ({ x: BR.x0 + (bi + 0.5) * boardW, y: BR.bridgeY, filled: false, bi }));
  const snapPoints = slots.map((s) => ({ x: s.x, y: s.y }));
  const bg = brBuildBackground();
  const planks = [];
  let timeLeft = total;
  let phase = 'build'; // 'build' | 'cross' | 'done'
  let crossT = 0;
  let wind = 0;
  let windTarget = 0;
  let windTimer = 2;
  let autoTimer = 0;
  let clock = 0;
  let result = null;
  let doneDelay = 0;
  let returned = false;

  // Planken auf den Felsvorsprüngen links/rechts verteilen; höhere Level = weiter weg
  for (let i = 0; i < nGaps + 1; i++) {
    const left = i % 2 === 0;
    const spread = 120 + level * 60;
    const px = left ? 200 + Math.random() * 220 - level * 40 : W - 200 - Math.random() * 220 + level * 40;
    const py = 700 + Math.random() * spread + (i % 3) * 40;
    const p = { x: px, y: Math.min(H - 70, py), placed: -1, sway: Math.random() * 6 };
    p.drag = guiDragHandle({
      posX: p.x,
      posY: p.y,
      radius: 62,
      grabSpeed: 140,
      fullPercent: 20,
      catchFactor: 1.7,
      followSmoothing: 9,
      maxSpeed: 1300,
      dropDelay: 0.45,
      snapPoints: snapPoints,
      snapDistance: 90,
      bounds: { x: 0, y: TOP + 100, width: W, height: H - TOP - 100 },
      visible: false,
      onDrop: (h, snapIndex) => brDrop(p, snapIndex),
    });
    planks.push(p);
  }

  function brDrop(p, snapIndex) {
    if (snapIndex < 0) {
      playSound(SND.click, 0.3);
      return;
    }
    const s = slots[snapIndex];
    if (s.filled) {
      // Lücke schon zu → Planke springt zurück auf den Vorsprung
      p.drag.setX(p.x < W / 2 ? 260 : W - 260);
      p.drag.setY(760);
      addFloater(s.x, s.y - 60, 'schon voll', PAL.warn);
      playSound(SND.error, 0.4);
      return;
    }
    brPlace(p, snapIndex);
  }

  function brPlace(p, snapIndex) {
    const s = slots[snapIndex];
    s.filled = true;
    p.placed = snapIndex;
    p.drag.setX(s.x);
    p.drag.setY(s.y);
    p.drag.setEnabled(false);
    burst(s.x, s.y, PAL.good, 18, 260);
    addFloater(s.x, s.y - 70, 'PASST!', PAL.good);
    playSound(SND.plop, 0.6);
  }

  function brFinish(win) {
    if (result) return;
    if (win) {
      result = mgcResult(true, 0, 0, 0, 'Brücke geflickt – der Trupp ist drüben!');
      playSound(SND.win, 0.6);
    } else {
      const cas = Math.min(opts.squadCount || 1, level >= 2 ? 2 : 1);
      result = mgcResult(false, cas, 0, 0, 'Verfolger erreichen den Trupp – ' + cas + ' Mann verloren, Rest entkommt.');
      addShake(18);
      playSound(SND.shot, 0.6);
    }
    phase = 'done';
    doneDelay = 1.2;
  }

  function brDrawBridge(ctx) {
    const sag = 34;
    const yAt = (x) => {
      const t = (x - BR.x0) / (BR.x1 - BR.x0);
      return BR.bridgeY + Math.sin(t * Math.PI) * sag + Math.sin(clock * 2.2 + t * 6) * wind * 10;
    };
    ctx.save();
    // Seile
    ctx.strokeStyle = PAL.ground;
    ctx.lineWidth = 4;
    ctx.beginPath();
    for (let x = BR.x0; x <= BR.x1; x += 20) {
      const y = yAt(x) - 70;
      if (x === BR.x0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.stroke();
    ctx.beginPath();
    for (let x = BR.x0; x <= BR.x1; x += 20) {
      const y = yAt(x) + 4;
      if (x === BR.x0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.stroke();
    // Bretter (Lücken: gestrichelter Umriss = Ziel)
    for (let i = 0; i < nBoards; i++) {
      const cx = BR.x0 + (i + 0.5) * boardW;
      const cy = yAt(cx);
      const slot = slots.find((s) => s.bi === i);
      if (slot && !slot.filled) {
        ctx.strokeStyle = PAL.warn;
        ctx.setLineDash([8, 8]);
        ctx.lineWidth = 3;
        ctx.strokeRect(cx - boardW / 2 + 4, cy - 14, boardW - 8, 28);
        ctx.setLineDash([]);
        continue;
      }
      ctx.fillStyle = PAL.dark;
      ctx.fillRect(cx - boardW / 2 + 3, cy - 12, boardW - 6, 24);
      ctx.strokeStyle = slot ? PAL.good : PAL.ground;
      ctx.lineWidth = 3;
      ctx.strokeRect(cx - boardW / 2 + 3, cy - 12, boardW - 6, 24);
      // senkrechte Halteseile
      ctx.strokeStyle = PAL.ground;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(cx, cy - 12);
      ctx.lineTo(cx, cy - 70);
      ctx.stroke();
    }
    ctx.restore();
    return yAt;
  }

  function brDrawSoldier(ctx, x, y, color, scale) {
    const s = scale || 1;
    ctx.save();
    ctx.strokeStyle = color;
    ctx.fillStyle = '#000000';
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.arc(x, y - 58 * s, 12 * s, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(x, y - 46 * s);
    ctx.lineTo(x, y - 18 * s);
    ctx.lineTo(x - 10 * s, y);
    ctx.moveTo(x, y - 18 * s);
    ctx.lineTo(x + 10 * s, y);
    ctx.moveTo(x - 14 * s, y - 38 * s);
    ctx.lineTo(x + 14 * s, y - 34 * s);
    ctx.stroke();
    ctx.restore();
  }

  return {
    id: 'bruecke',
    title: 'Die Brücke',
    hint: 'Planken greifen und in die Lücken der Brücke ziehen – schnell, die Verfolger kommen!',
    update(grid, dt, ctx) {
      clock += dt;
      if (returned) return null;
      if (result) {
        doneDelay -= dt;
        if (doneDelay <= 0) {
          returned = true;
          return result;
        }
      }
      // Wind: ab Level 1 schaukelt die Brücke, lose Planken rutschen
      windTimer -= dt;
      if (windTimer <= 0) {
        windTimer = 2 + Math.random() * 3;
        windTarget = level === 0 ? 0 : (Math.random() * 2 - 1) * (0.5 + level * 0.4);
      }
      wind = lerp(wind, windTarget, Math.min(1, dt * 1.5));

      if (phase === 'build') {
        timeLeft -= dt;
        if (keyEdge('KeyX')) brFinish(false);
        if (isKeyDown('KeyK')) {
          autoTimer -= dt;
          if (autoTimer <= 0) {
            autoTimer = 0.8;
            const free = slots.findIndex((s) => !s.filled);
            const p = planks.find((pp) => pp.placed < 0);
            if (free >= 0 && p) brPlace(p, free);
          }
        }
        planks.forEach((p) => {
          if (p.placed >= 0) return;
          if (!p.drag.isGrabbed() && level > 0) {
            p.drag.setX(clamp(p.drag.getX() + wind * 22 * dt, 80, W - 80));
          }
          p.drag.handle(grid, dt);
        });
        if (slots.every((s) => s.filled)) {
          phase = 'cross';
          crossT = 0;
          playSound(SND.pickup, 0.5);
        } else if (timeLeft <= 0) {
          brFinish(false);
        }
      } else if (phase === 'cross') {
        crossT += dt;
        if (crossT >= BR.crossTime) brFinish(true);
      }

      // ------ Zeichnen ------
      ctx.drawImage(bg, 0, 0);
      const yAt = brDrawBridge(ctx);
      // Verfolger: Silhouetten, die von links heranrücken
      const prog = clamp(1 - timeLeft / total, 0, 1);
      const pursX = -80 + prog * (BR.x0 - 220);
      for (let i = 0; i < 4; i++) brDrawSoldier(ctx, pursX - i * 55, BR.bridgeY + 6, PAL.enemy, 0.9);
      // Trupp: wartet am linken Brückenkopf bzw. läuft hinüber
      const squad = Math.max(1, Math.min(6, opts.squadCount || 4));
      for (let i = 0; i < squad; i++) {
        let x;
        if (phase === 'build') x = BR.x0 - 40 - i * 34;
        else x = BR.x0 - 40 - i * 34 + clamp(crossT / BR.crossTime, 0, 1) * (BR.x1 - BR.x0 + 260);
        const y = x > BR.x0 && x < BR.x1 ? yAt(x) - 12 : BR.bridgeY + 6;
        brDrawSoldier(ctx, x, y, PAL.friend, 0.85);
      }
      // Planken (Aktionsflächen: schwarz, nur Kontur + Greifring)
      planks.forEach((p) => {
        if (p.placed >= 0) {
          const s = slots[p.placed];
          const y = yAt(s.x);
          ctx.save();
          ctx.fillStyle = PAL.dark;
          ctx.fillRect(s.x - boardW / 2 + 3, y - 12, boardW - 6, 24);
          ctx.strokeStyle = PAL.good;
          ctx.lineWidth = 3;
          ctx.strokeRect(s.x - boardW / 2 + 3, y - 12, boardW - 6, 24);
          ctx.restore();
          return;
        }
        const x = p.drag.getX();
        const y = p.drag.getY();
        const grabbed = p.drag.isGrabbed();
        ctx.save();
        ctx.translate(x, y);
        ctx.rotate(grabbed ? Math.sin(clock * 6) * 0.06 : wind * 0.12);
        ctx.fillStyle = '#000000';
        ctx.fillRect(-BR.plankW / 2, -BR.plankH / 2, BR.plankW, BR.plankH);
        ctx.strokeStyle = grabbed ? PAL.accent : PAL.ground;
        ctx.lineWidth = grabbed ? 5 : 3;
        ctx.strokeRect(-BR.plankW / 2, -BR.plankH / 2, BR.plankW, BR.plankH);
        ctx.restore();
        const v = p.drag.getValue() / 100;
        if (!grabbed && v > 0) {
          ctx.save();
          ctx.strokeStyle = PAL.accent;
          ctx.lineWidth = 8;
          ctx.beginPath();
          ctx.arc(x, y, 74, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * v);
          ctx.stroke();
          ctx.restore();
        }
        if (grabbed) {
          // Hilfslinie zur nächsten freien Lücke
          let best = null;
          let bd = Infinity;
          slots.forEach((s) => {
            if (s.filled) return;
            const d = Math.hypot(s.x - x, s.y - y);
            if (d < bd) {
              bd = d;
              best = s;
            }
          });
          if (best) {
            ctx.save();
            ctx.strokeStyle = PAL.accent;
            ctx.globalAlpha = 0.5;
            ctx.setLineDash([12, 12]);
            ctx.lineWidth = 3;
            ctx.beginPath();
            ctx.moveTo(x, y);
            ctx.lineTo(best.x, yAt(best.x));
            ctx.stroke();
            ctx.restore();
          }
        }
      });
      const filled = slots.filter((s) => s.filled).length;
      mgcDrawTimer(
        ctx,
        timeLeft / total,
        phase === 'cross' ? 'Alle rüber!' : 'Lücken: ' + filled + ' / ' + nGaps + '   ·   Verfolger in ' + Math.max(0, Math.ceil(timeLeft)) + ' s',
        timeLeft < total * 0.3 ? PAL.bad : PAL.accent
      );
      return null;
    },
  };
}

// ---------------------------------------------------------------------------------------------------------
// 12. TIERANGRIFF – Schlangen und Raubkatzen schleichen ans Nachtlager; Licht scheucht sie zurück
// ---------------------------------------------------------------------------------------------------------

const TA = {
  campX: 960,
  campY: 640,
  campR: 150,
  time: [30, 36, 42],
  spawnStart: [3.2, 2.6, 2.0],
  spawnEnd: [1.8, 1.3, 0.9],
  speed: { snake: [55, 70, 85], cat: [80, 100, 125] },
  retreat: 260, // px/s Rückzug bei voller Beleuchtung
  sensorR: 72,
  muleX: 1150,
  muleY: 690,
};

function taBuildBackground() {
  const c = mgcCanvas(W, H);
  const g = c.getContext('2d');
  g.fillStyle = '#000000';
  g.fillRect(0, TOP, W, H - TOP);
  // Waldrand: dunkle Baumkronen am Rand, Mitte frei
  g.fillStyle = PAL.jungle;
  for (let i = 0; i < 60; i++) {
    const a = (i / 60) * Math.PI * 2;
    const rx = 900 + ((i * 37) % 60);
    const ry = 470 + ((i * 53) % 40);
    const x = TA.campX + Math.cos(a) * rx;
    const y = TA.campY + Math.sin(a) * ry;
    g.globalAlpha = 0.18;
    g.beginPath();
    g.arc(x, y, 90 + ((i * 29) % 60), 0, Math.PI * 2);
    g.fill();
  }
  g.globalAlpha = 1;
  // Sterne oben
  g.fillStyle = PAL.dim;
  for (let i = 0; i < 70; i++) {
    g.globalAlpha = 0.2 + ((i * 17) % 10) / 25;
    g.fillRect((i * 271) % W, TOP + 30 + ((i * 113) % 140), 2, 2);
  }
  g.globalAlpha = 1;
  return c;
}

function mgTierangriff(opts) {
  const level = clamp(opts.level || 0, 0, 2);
  const total = TA.time[level];
  const bg = taBuildBackground();
  const animals = [];
  let timeLeft = total;
  let spawnTimer = 1.2;
  let casualties = 0;
  let foodLost = 0;
  let scared = 0;
  let clock = 0;
  let result = null;
  let returned = false;
  let doneDelay = 0;
  const squad = Math.max(1, opts.squadCount || 4);
  // Packesel: gutes Objekt, nicht anleuchten!
  const mule = { x: TA.muleX, y: TA.muleY, bolt: 0, panic: 0 };
  mule.sensor = mgcSensor(mule.x, mule.y, 70, 90, 60, 20);

  function taSpawn() {
    const kind = Math.random() < (level === 0 ? 0.6 : 0.45) ? 'snake' : 'cat';
    // Startpunkt am Rand des Spielbereichs (links, rechts, oben, unten-Ecken)
    const side = Math.floor(Math.random() * 4);
    let x;
    let y;
    if (side === 0) {
      x = -60;
      y = TOP + 160 + Math.random() * (H - TOP - 220);
    } else if (side === 1) {
      x = W + 60;
      y = TOP + 160 + Math.random() * (H - TOP - 220);
    } else if (side === 2) {
      x = 200 + Math.random() * (W - 400);
      y = TOP + 120;
    } else {
      x = Math.random() < 0.5 ? 120 : W - 120;
      y = H + 60;
    }
    const a = {
      kind,
      x,
      y,
      speed: TA.speed[kind][level] * (0.85 + Math.random() * 0.3),
      phase: Math.random() * 6,
      fear: 0, // 0..1, bei 1 flieht das Tier endgültig
      fleeing: false,
      dead: false,
    };
    a.sensor = mgcSensor(x, y, TA.sensorR, 100, 35, 22);
    animals.push(a);
  }

  function taFinish(win, text) {
    if (result) return;
    result = mgcResult(win, casualties, foodLost ? -foodLost : 0, 0, text);
    doneDelay = 1.2;
    playSound(win ? SND.win : SND.error, 0.6);
  }

  function taDrawSnake(ctx, a, lit) {
    const dx = TA.campX - a.x;
    const dy = TA.campY - a.y;
    const ang = Math.atan2(dy, dx) + (a.fleeing ? Math.PI : 0);
    ctx.save();
    ctx.translate(a.x, a.y);
    ctx.rotate(ang);
    ctx.strokeStyle = lit ? PAL.warn : PAL.enemy;
    ctx.lineWidth = 9;
    ctx.lineCap = 'round';
    ctx.beginPath();
    for (let i = 0; i <= 12; i++) {
      const px = -i * 9;
      const py = Math.sin(a.phase * 6 - i * 0.7) * 10;
      if (i === 0) ctx.moveTo(px, py);
      else ctx.lineTo(px, py);
    }
    ctx.stroke();
    ctx.fillStyle = PAL.glow;
    ctx.beginPath();
    ctx.arc(4, -4, 3, 0, Math.PI * 2);
    ctx.arc(4, 4, 3, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  function taDrawCat(ctx, a, lit) {
    const dx = TA.campX - a.x;
    const ang = dx >= 0 ? 1 : -1;
    const dir = a.fleeing ? -ang : ang;
    const step = Math.sin(a.phase * 8) * 6;
    ctx.save();
    ctx.translate(a.x, a.y);
    ctx.scale(dir, 1);
    ctx.fillStyle = '#000000';
    ctx.strokeStyle = lit ? PAL.warn : PAL.enemy;
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.ellipse(0, 0, 48, 20, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(46, -14, 17, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    // Ohren, Schwanz, Beine
    ctx.beginPath();
    ctx.moveTo(38, -28);
    ctx.lineTo(42, -40);
    ctx.lineTo(48, -30);
    ctx.moveTo(52, -30);
    ctx.lineTo(58, -40);
    ctx.lineTo(60, -26);
    ctx.moveTo(-46, -4);
    ctx.quadraticCurveTo(-80, -30 + step, -70, -50);
    ctx.moveTo(-30, 16);
    ctx.lineTo(-34 + step, 36);
    ctx.moveTo(30, 16);
    ctx.lineTo(34 - step, 36);
    ctx.stroke();
    ctx.fillStyle = PAL.glow;
    ctx.beginPath();
    ctx.arc(52, -17, 3.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  function taDrawCamp(ctx) {
    // Lagerfeuer (Anzeige, darf leuchten – liegt aber mitten im Lager, nicht auf Tierwegen)
    const flick = 0.8 + Math.sin(clock * 13) * 0.1 + Math.sin(clock * 7.3) * 0.1;
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    const grad = ctx.createRadialGradient(TA.campX, TA.campY, 10, TA.campX, TA.campY, TA.campR * 1.4);
    grad.addColorStop(0, PAL.warn);
    grad.addColorStop(0.3, PAL.dark);
    grad.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.globalAlpha = 0.35 * flick;
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.arc(TA.campX, TA.campY, TA.campR * 1.4, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
    ctx.save();
    ctx.fillStyle = PAL.warn;
    ctx.globalAlpha = 0.9;
    for (let i = 0; i < 3; i++) {
      const h = 34 * flick + i * 6;
      ctx.beginPath();
      ctx.moveTo(TA.campX - 18 + i * 18, TA.campY + 10);
      ctx.quadraticCurveTo(TA.campX - 10 + i * 10, TA.campY - h, TA.campX - 4 + i * 14 + Math.sin(clock * 9 + i) * 4, TA.campY - h - 10);
      ctx.quadraticCurveTo(TA.campX + 4 + i * 8, TA.campY - h * 0.5, TA.campX + 10 + i * 6, TA.campY + 10);
      ctx.fill();
    }
    ctx.restore();
    // Lagerring + schlafende Soldaten
    ctx.save();
    ctx.strokeStyle = PAL.dim;
    ctx.setLineDash([10, 14]);
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(TA.campX, TA.campY, TA.campR, 0, Math.PI * 2);
    ctx.stroke();
    ctx.setLineDash([]);
    const n = Math.max(0, squad - casualties);
    for (let i = 0; i < n; i++) {
      const a = Math.PI * 0.8 + (i / Math.max(1, n)) * Math.PI * 1.4;
      const x = TA.campX + Math.cos(a) * 90;
      const y = TA.campY + Math.sin(a) * 70;
      ctx.strokeStyle = PAL.friend;
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.ellipse(x, y, 26, 10, a, 0, Math.PI * 2);
      ctx.stroke();
    }
    ctx.restore();
  }

  function taDrawMule(ctx) {
    const lit = mule.sensor.getFillPercent() > 0;
    const v = mule.sensor.getValue() / 100;
    ctx.save();
    ctx.translate(mule.x, mule.y);
    ctx.fillStyle = '#000000';
    ctx.strokeStyle = mule.bolt > 0 ? PAL.bad : PAL.friend;
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.ellipse(0, 0, 44, 22, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    ctx.beginPath();
    ctx.ellipse(46, -24, 14, 22, -0.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(42, -46);
    ctx.lineTo(40, -66);
    ctx.moveTo(52, -44);
    ctx.lineTo(56, -64);
    ctx.moveTo(-30, 18);
    ctx.lineTo(-30, 44);
    ctx.moveTo(30, 18);
    ctx.lineTo(30, 44);
    // Gepäck
    ctx.rect(-26, -40, 40, 22);
    ctx.stroke();
    ctx.restore();
    if (v > 0.05) {
      ctx.save();
      ctx.strokeStyle = PAL.bad;
      ctx.lineWidth = 8;
      ctx.beginPath();
      ctx.arc(mule.x, mule.y, 82, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * v);
      ctx.stroke();
      ctx.restore();
    }
    if (lit) util.renderText({ ctx, text: 'Nicht den Esel blenden!', x: mule.x, y: mule.y - 100, fontSize: '28px', fillStyle: PAL.bad });
  }

  return {
    id: 'tierangriff',
    title: 'Tierangriff',
    hint: 'Raubtiere schleichen ans Lager – anleuchten scheucht sie weg. Den Packesel NICHT anleuchten!',
    update(grid, dt, ctx) {
      clock += dt;
      if (returned) return null;
      if (result) {
        doneDelay -= dt;
        if (doneDelay <= 0) {
          returned = true;
          return result;
        }
      }
      const running = !result;
      if (running) {
        timeLeft -= dt;
        if (keyEdge('KeyX')) {
          casualties = Math.min(squad, casualties + 1);
          taFinish(false, 'Die Raubtiere haben das Lager überrannt.');
        }
        // Nachschub: Spawn-Intervall wird über die Zeit kürzer
        spawnTimer -= dt;
        if (spawnTimer <= 0 && timeLeft > 2) {
          const f = 1 - timeLeft / total;
          spawnTimer = lerp(TA.spawnStart[level], TA.spawnEnd[level], f) * (0.7 + Math.random() * 0.6);
          taSpawn();
          if (level === 2 && Math.random() < 0.3) taSpawn();
        }
        const autoK = isKeyDown('KeyK');
        animals.slice().forEach((a) => {
          a.phase += dt;
          a.sensor.setX(a.x);
          a.sensor.setY(a.y);
          a.sensor.handle(grid, dt);
          const pct = a.sensor.getFillPercent();
          const litNow = pct > 0 || autoK;
          // Angst sammelt sich über Zeit (nie Einzelframe): Füllwert des Sensors bzw. Testhilfe
          a.fear = autoK ? Math.min(1, a.fear + dt * 0.9) : a.sensor.getValue() / 100;
          const dx = TA.campX - a.x;
          const dy = TA.campY - a.y;
          const d = Math.hypot(dx, dy) || 1;
          if (a.fleeing) {
            a.x -= (dx / d) * TA.retreat * 1.4 * dt;
            a.y -= (dy / d) * TA.retreat * 1.4 * dt;
            if (a.x < -150 || a.x > W + 150 || a.y < TOP - 50 || a.y > H + 150) animals.splice(animals.indexOf(a), 1);
            return;
          }
          if (a.fear >= 0.95) {
            a.fleeing = true;
            scared++;
            burst(a.x, a.y, PAL.good, 12, 220);
            addFloater(a.x, a.y - 50, 'VERSCHEUCHT', PAL.good);
            playSound(SND.plop, 0.5);
            return;
          }
          if (litNow) {
            // beleuchtet: zurückweichen (stärker, je mehr Fläche beleuchtet ist – gedeckelt)
            const push = TA.retreat * Math.min(1, autoK ? 1 : pct / 22);
            a.x -= (dx / d) * push * dt;
            a.y -= (dy / d) * push * dt;
          } else {
            a.x += (dx / d) * a.speed * dt;
            a.y += (dy / d) * a.speed * dt;
          }
          if (d < TA.campR - 20) {
            casualties = Math.min(squad, casualties + 1);
            animals.splice(animals.indexOf(a), 1);
            burst(a.x, a.y, PAL.bad, 26, 320);
            addFloater(TA.campX, TA.campY - 120, 'Angriff! −1 Mann', PAL.bad);
            addShake(16);
            playSound(SND.hit, 0.7);
            if (casualties >= squad) taFinish(false, 'Das Lager ist verloren.');
          }
        });
        // Packesel
        mule.sensor.handle(grid, dt);
        if (mule.bolt > 0) {
          mule.bolt -= dt;
          mule.x = TA.muleX + Math.sin(mule.bolt * 6) * 120 + (1 - mule.bolt / 3) * 0;
          if (mule.bolt <= 0) {
            mule.x = TA.muleX;
            mule.sensor.setValue(0);
          }
        } else if (mule.sensor.getValue() >= 70) {
          mule.bolt = 3;
          foodLost++;
          addFloater(mule.x, mule.y - 120, 'Esel geht durch! −1 Proviant', PAL.bad);
          addShake(8);
          playSound(SND.error, 0.6);
        }
        mule.sensor.setX(mule.x);
        if (timeLeft <= 0) {
          taFinish(
            true,
            casualties === 0 ? 'Die Nacht überstanden – niemand verletzt!' : 'Die Nacht überstanden, ' + casualties + ' Mann verloren.'
          );
        }
      }

      // ------ Zeichnen ------
      ctx.drawImage(bg, 0, 0);
      taDrawCamp(ctx);
      taDrawMule(ctx);
      animals.forEach((a) => {
        const lit = a.sensor.getFillPercent() > 0;
        // Aktionsfläche dunkel: nur ein dünner Angst-Ring um das Tier
        if (!a.fleeing && a.fear > 0.03) {
          ctx.save();
          ctx.strokeStyle = PAL.good;
          ctx.lineWidth = 6;
          ctx.beginPath();
          ctx.arc(a.x, a.y, TA.sensorR + 6, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * a.fear);
          ctx.stroke();
          ctx.restore();
        }
        if (a.kind === 'snake') taDrawSnake(ctx, a, lit);
        else taDrawCat(ctx, a, lit);
      });
      mgcDrawTimer(
        ctx,
        timeLeft / total,
        'Bis Sonnenaufgang: ' + Math.max(0, Math.ceil(timeLeft)) + ' s   ·   verscheucht: ' + scared + (casualties ? '   ·   verloren: ' + casualties : ''),
        PAL.accent
      );
      return null;
    },
  };
}

// ---------------------------------------------------------------------------------------------------------
// 13. VORRÄTE – verlassenes Lager im Dunkeln: Laser leuchten frei, Fundstücke halten = einsammeln
// ---------------------------------------------------------------------------------------------------------

const VO = {
  x: 120,
  y: TOP + 100,
  w: W - 240,
  h: H - TOP - 290, // unten bleibt Platz für die Suchliste
  time: [38, 32, 27],
  items: [5, 6, 8],
  traps: [1, 2, 3],
  itemR: 60,
  revealNeed: 0.35, // so weit muss die Stelle freigeleuchtet sein, bevor Halten zählt
  holdTime: 1.6, // s bei voller Abdeckung
  kinds: {
    dose: { name: 'Konserve', food: 1, ammo: 0 },
    flasche: { name: 'Feldflasche', food: 1, ammo: 0 },
    munition: { name: 'Munitionskiste', food: 0, ammo: 4 },
  },
};

function voBuildScene() {
  const c = mgcCanvas(VO.w, VO.h);
  const g = c.getContext('2d');
  g.fillStyle = PAL.dark;
  g.fillRect(0, 0, VO.w, VO.h);
  // Zelte, umgestürzte Kisten, Fässer, Wäscheleinen – nur Konturen in gedämpften Tönen
  g.strokeStyle = PAL.ground;
  g.lineWidth = 4;
  for (let i = 0; i < 5; i++) {
    const x = 160 + i * 340 + ((i * 71) % 60);
    const y = 120 + ((i * 97) % 200);
    g.beginPath();
    g.moveTo(x - 130, y + 110);
    g.lineTo(x, y - 40);
    g.lineTo(x + 130, y + 110);
    g.closePath();
    g.stroke();
    g.beginPath();
    g.moveTo(x, y - 40);
    g.lineTo(x, y + 110);
    g.stroke();
  }
  g.strokeStyle = PAL.jungle;
  for (let i = 0; i < 14; i++) {
    const x = (i * 233) % VO.w;
    const y = 60 + ((i * 151) % (VO.h - 120));
    g.strokeRect(x, y, 70, 50);
    g.beginPath();
    g.moveTo(x, y);
    g.lineTo(x + 70, y + 50);
    g.stroke();
  }
  g.strokeStyle = PAL.dim;
  g.lineWidth = 2;
  for (let i = 0; i < 9; i++) {
    const x = 80 + ((i * 389) % (VO.w - 160));
    const y = 80 + ((i * 263) % (VO.h - 160));
    g.beginPath();
    g.ellipse(x, y, 30, 40, 0, 0, Math.PI * 2);
    g.stroke();
  }
  // Grasbüschel
  g.strokeStyle = PAL.jungle;
  for (let i = 0; i < 120; i++) {
    const x = (i * 157) % VO.w;
    const y = (i * 89) % VO.h;
    g.beginPath();
    g.moveTo(x, y);
    g.lineTo(x - 6, y - 16);
    g.moveTo(x, y);
    g.lineTo(x + 5, y - 14);
    g.stroke();
  }
  return c;
}

function voDrawItem(ctx, kind, x, y, s, color) {
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(s, s);
  ctx.strokeStyle = color;
  ctx.fillStyle = '#000000';
  ctx.lineWidth = 4;
  if (kind === 'dose') {
    ctx.beginPath();
    ctx.ellipse(0, -18, 20, 7, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    ctx.strokeRect(-20, -18, 40, 38);
    ctx.beginPath();
    ctx.moveTo(-20, 0);
    ctx.lineTo(20, 0);
    ctx.stroke();
  } else if (kind === 'flasche') {
    ctx.beginPath();
    ctx.ellipse(0, 6, 20, 24, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    ctx.strokeRect(-6, -30, 12, 14);
  } else if (kind === 'munition') {
    ctx.fillRect(-30, -18, 60, 36);
    ctx.strokeRect(-30, -18, 60, 36);
    ctx.beginPath();
    ctx.moveTo(-30, -6);
    ctx.lineTo(30, -6);
    ctx.stroke();
    ctx.strokeRect(-8, -24, 16, 6);
  } else {
    // Sprengfalle: Stolperdraht mit Granate
    ctx.beginPath();
    ctx.ellipse(0, 4, 14, 18, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(-60, 22);
    ctx.lineTo(60, 18);
    ctx.moveTo(0, -14);
    ctx.lineTo(8, -24);
    ctx.stroke();
  }
  ctx.restore();
}

function mgVorraete(opts) {
  const level = clamp(opts.level || 0, 0, 2);
  const total = VO.time[level];
  const scene = voBuildScene();
  const kindsList = ['dose', 'munition', 'flasche'];
  const spots = [];
  const nItems = VO.items[level];
  const nTraps = VO.traps[level];
  // Plätze ohne Überlappung würfeln
  let guard = 0;
  while (spots.length < nItems + nTraps && guard++ < 500) {
    const x = VO.x + 90 + Math.random() * (VO.w - 180);
    const y = VO.y + 80 + Math.random() * (VO.h - 160);
    if (spots.every((s) => Math.hypot(s.x - x, s.y - y) > 200)) spots.push({ x, y });
  }
  const items = spots.map((s, i) => {
    const trap = i >= nItems;
    const it = {
      x: s.x,
      y: s.y,
      kind: trap ? 'falle' : kindsList[i % kindsList.length],
      trap,
      prog: 0,
      done: false,
    };
    it.sensor = mgcSensor(s.x, s.y, VO.itemR, 100, 50, 25);
    return it;
  });
  const mask = guiPaintLayer({
    posX: VO.x,
    posY: VO.y,
    width: VO.w,
    height: VO.h,
    cellSize: 24,
    speedUp: 2.2,
    speedDown: level === 0 ? 0.04 : 0.08 + level * 0.03,
    brushRadius: 70,
    threshold: 0.5,
    render: 'mask',
    color: '#000000',
    smooth: true,
    visible: true,
  });
  let timeLeft = total;
  let found = 0;
  let casualties = 0;
  let food = 0;
  let ammo = 0;
  let clock = 0;
  let result = null;
  let returned = false;
  let doneDelay = 0;
  let autoTimer = 0;
  const needed = Math.ceil(nItems * 0.6);

  function voFinish() {
    if (result) return;
    const win = found >= needed;
    result = mgcResult(
      win,
      casualties,
      food,
      ammo,
      found === nItems
        ? 'Alles gefunden: +' + food + ' Proviant, +' + ammo + ' Munition'
        : found + ' von ' + nItems + ' Vorräten gefunden: +' + food + ' Proviant, +' + ammo + ' Munition'
    );
    doneDelay = 1.2;
    playSound(win ? SND.win : SND.error, 0.6);
  }

  return {
    id: 'vorraete',
    title: 'Verlassenes Lager',
    hint: 'Dunkles Lager freileuchten, Vorräte suchen und mit dem Laser halten. Vorsicht: Stolperdrähte NICHT halten!',
    update(grid, dt, ctx) {
      clock += dt;
      if (returned) return null;
      if (result) {
        doneDelay -= dt;
        if (doneDelay <= 0) {
          returned = true;
          return result;
        }
      }
      if (!result) {
        timeLeft -= dt;
        if (keyEdge('KeyX')) {
          timeLeft = 0;
          found = 0;
          food = 0;
          ammo = 0;
        }
        // Testhilfe: ein Fundstück nach dem anderen freilegen und halten
        if (isKeyDown('KeyK')) {
          autoTimer -= dt;
          const target = items.find((it) => !it.done && !it.trap);
          if (target) {
            mask.addInCircle(target.x, target.y, VO.itemR + 30, dt * 3);
            if (mask.getAverageInCircle(target.x, target.y, VO.itemR) >= VO.revealNeed) target.prog += dt / VO.holdTime;
          }
        }
      }

      // ------ Zeichnen: Szene + Fundstücke UNTER der Maske ------
      ctx.save();
      ctx.fillStyle = '#000000';
      ctx.fillRect(0, TOP, W, H - TOP);
      ctx.restore();
      ctx.drawImage(scene, VO.x, VO.y);
      items.forEach((it) => {
        if (it.done) return;
        voDrawItem(ctx, it.kind, it.x, it.y, 1.3, it.trap ? PAL.enemy : PAL.good);
      });
      mask.handle(grid, dt); // deckt alles zu, was nicht freigeleuchtet ist (und misst die Laser)

      if (!result) {
        items.forEach((it) => {
          if (it.done) return;
          it.sensor.handle(grid, dt);
          const revealed = mask.getAverageInCircle(it.x, it.y, VO.itemR) >= VO.revealNeed;
          const pct = it.sensor.getFillPercent();
          if (revealed && pct > 0) it.prog += (dt / VO.holdTime) * Math.min(1, pct / 25);
          else if (!isKeyDown('KeyK')) it.prog = Math.max(0, it.prog - dt * 0.4);
          if (it.prog >= 1) {
            it.done = true;
            if (it.trap) {
              casualties = Math.min(opts.squadCount || 1, casualties + 1);
              burst(it.x, it.y, PAL.bad, 40, 520);
              addFloater(it.x, it.y - 60, 'SPRENGFALLE! −1 Mann', PAL.bad);
              addShake(24);
              playSound(SND.boom, 0.8);
            } else {
              const k = VO.kinds[it.kind];
              found++;
              food += k.food;
              ammo += k.ammo;
              burst(it.x, it.y, PAL.good, 18, 260);
              addFloater(it.x, it.y - 60, k.name + (k.food ? ' +' + k.food + ' Proviant' : ' +' + k.ammo + ' Munition'), PAL.good);
              playSound(SND.pickup, 0.6);
            }
          }
          // Halte-Ring nur über freigeleuchteten Stellen zeigen (verrät sonst das Versteck)
          if (revealed && it.prog > 0.02) {
            ctx.save();
            ctx.strokeStyle = it.trap ? PAL.bad : PAL.good;
            ctx.lineWidth = 8;
            ctx.beginPath();
            ctx.arc(it.x, it.y, VO.itemR + 12, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * clamp(it.prog, 0, 1));
            ctx.stroke();
            ctx.restore();
          }
        });
        if (found >= nItems || timeLeft <= 0) voFinish();
      }

      // Rahmen um das Suchfeld
      ctx.save();
      ctx.strokeStyle = PAL.dim;
      ctx.lineWidth = 3;
      ctx.strokeRect(VO.x, VO.y, VO.w, VO.h);
      ctx.restore();
      // Suchliste unten (Anzeigebereich)
      const listY = VO.y + VO.h + 95;
      const list = items.filter((it) => !it.trap);
      const step = Math.min(200, (W - 400) / Math.max(1, list.length));
      const startX = W / 2 - ((list.length - 1) * step) / 2;
      list.forEach((it, i) => {
        const x = startX + i * step;
        voDrawItem(ctx, it.kind, x, listY, 1, it.done ? PAL.good : PAL.dim);
        if (it.done) {
          ctx.save();
          ctx.strokeStyle = PAL.good;
          ctx.lineWidth = 6;
          ctx.beginPath();
          ctx.moveTo(x - 30, listY);
          ctx.lineTo(x - 8, listY + 24);
          ctx.lineTo(x + 34, listY - 26);
          ctx.stroke();
          ctx.restore();
        }
      });
      mgcDrawTimer(
        ctx,
        timeLeft / total,
        'Gefunden: ' + found + ' / ' + nItems + ' (mindestens ' + needed + ')   ·   noch ' + Math.max(0, Math.ceil(timeLeft)) + ' s',
        timeLeft < total * 0.25 ? PAL.bad : PAL.accent
      );
      return null;
    },
  };
}

// ---------------------------------------------------------------------------------------------------------
// 14. GEFANGENE – Schloss mit Ringen: Kreisgesten drehen, Riegel-Feld halten; Wache nicht alarmieren
// ---------------------------------------------------------------------------------------------------------

const GE = {
  lockX: 860,
  lockY: 600,
  ringR: [110, 165, 220, 275],
  rings: [3, 3, 4],
  time: [50, 44, 38],
  step: Math.PI / 3, // eine Kreisgeste dreht den aktiven Ring um 60°
  padX: 1580,
  padY: 600,
  padR: 110,
  guardY: TOP + 150,
  guardSpeed: [150, 190, 240],
  coneHalf: 260, // halbe Breite des Lichtkegels am Schloss
  alarmNeed: 1.4, // s Laser im Lichtkegel → Alarm
  alarmPenalty: 6, // s Abzug
  wrongPenalty: 3,
};

function mgGefangene(opts) {
  const level = clamp(opts.level || 0, 0, 2);
  const total = GE.time[level];
  const nRings = GE.rings[level];
  // Kerbe jedes Rings in 60°-Schritten verdreht (nie schon ausgerichtet)
  const rings = [];
  for (let i = 0; i < nRings; i++) {
    const steps = 1 + Math.floor(Math.random() * 5); // 1..5 Schritte entfernt
    rings.push({ r: GE.ringR[i], angle: steps * GE.step, shown: steps * GE.step, locked: false });
  }
  let active = nRings - 1; // von aussen nach innen
  let timeLeft = total;
  let alarm = 0;
  let alarms = 0;
  let guardX = -200;
  let guardDir = 1;
  let clock = 0;
  let result = null;
  let returned = false;
  let doneDelay = 0;
  let autoTimer = 0;
  let wrongCool = 0;
  let lastDt = 0.016;
  const gesture = guiSwipeDetector({
    posX: GE.lockX,
    posY: GE.lockY,
    width: 760,
    height: 700,
    circleTime: 1.8,
    minCircleRadius: 70,
    cooldown: 0.5,
    maxSpread: 450,
    visible: false,
    onCircle: (dir) => geRotate(dir === 'cw' ? 1 : -1),
  });
  const pad = guiPixelFillButton({
    label: '',
    posX: GE.padX,
    posY: GE.padY,
    radius: GE.padR,
    speedUp: 70,
    speedDown: 40,
    fullPercent: 20,
    activeValue: 100,
    minValue: 0,
    edges: 12,
    visible: false,
  });

  function geNorm(a) {
    const t = Math.PI * 2;
    return ((a % t) + t) % t;
  }

  function geAligned(ring) {
    const a = geNorm(ring.angle);
    return a < 0.01 || a > Math.PI * 2 - 0.01;
  }

  function geRotate(sign) {
    if (result || active < 0) return;
    const ring = rings[active];
    ring.angle = geNorm(ring.angle + sign * GE.step);
    if (geNorm(ring.angle) < 0.01 || geNorm(ring.angle) > Math.PI * 2 - 0.01) ring.angle = 0;
    playSound(SND.click, 0.5);
    if (geAligned(ring)) addFloater(GE.lockX, GE.lockY - ring.r - 30, 'KLICK – jetzt Riegel halten!', PAL.good);
  }

  function geLock() {
    const ring = rings[active];
    ring.locked = true;
    burst(GE.lockX, GE.lockY - ring.r, PAL.good, 20, 260);
    playSound(SND.pickup, 0.6);
    active--;
    pad.setValue(0);
    if (active < 0) geFinish(true);
  }

  function geFinish(win) {
    if (result) return;
    result = win
      ? mgcResult(true, 0, 0, 6, 'Gefangener befreit! Er bringt 6 Schuss Munition mit.')
      : mgcResult(false, 0, 0, 0, 'Zu spät – die Wachablösung kommt, wir müssen weiter.');
    doneDelay = 1.4;
    playSound(win ? SND.win : SND.error, 0.7);
  }

  function geDrawLock(ctx) {
    // Gefangener hinter Gittern (Anzeige links oben neben dem Schloss)
    ctx.save();
    ctx.strokeStyle = PAL.dim;
    ctx.lineWidth = 4;
    const cx = 260;
    const cy = 620;
    for (let i = 0; i < 6; i++) {
      ctx.beginPath();
      ctx.moveTo(cx - 100 + i * 40, cy - 170);
      ctx.lineTo(cx - 100 + i * 40, cy + 170);
      ctx.stroke();
    }
    ctx.strokeRect(cx - 110, cy - 180, 220, 360);
    ctx.strokeStyle = PAL.friend;
    ctx.beginPath();
    ctx.arc(cx, cy - 60, 22, 0, Math.PI * 2);
    ctx.moveTo(cx, cy - 38);
    ctx.lineTo(cx, cy + 50);
    ctx.lineTo(cx - 24, cy + 120);
    ctx.moveTo(cx, cy + 50);
    ctx.lineTo(cx + 24, cy + 120);
    ctx.moveTo(cx - 34, cy - 10 + Math.sin(clock * 3) * 6);
    ctx.lineTo(cx + 34, cy - 10 - Math.sin(clock * 3) * 6);
    ctx.stroke();
    ctx.restore();

    // Schloss: Aktionsfläche (Gestenfeld) schwarz, Ringe nur als Konturen
    ctx.save();
    ctx.fillStyle = '#000000';
    ctx.beginPath();
    ctx.arc(GE.lockX, GE.lockY, GE.ringR[nRings - 1] + 50, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = PAL.pad;
    ctx.lineWidth = 2;
    ctx.stroke();
    // Markierung oben
    ctx.fillStyle = PAL.accent;
    ctx.beginPath();
    const topY = GE.lockY - GE.ringR[nRings - 1] - 46;
    ctx.moveTo(GE.lockX - 18, topY - 20);
    ctx.lineTo(GE.lockX + 18, topY - 20);
    ctx.lineTo(GE.lockX, topY + 4);
    ctx.closePath();
    ctx.fill();
    rings.forEach((ring, i) => {
      // sichtbarer Winkel läuft weich nach
      let diff = ring.angle - ring.shown;
      if (diff > Math.PI) diff -= Math.PI * 2;
      if (diff < -Math.PI) diff += Math.PI * 2;
      ring.shown += diff * Math.min(1, 12 * lastDt);
      const isActive = i === active;
      const color = ring.locked ? PAL.good : isActive ? (geAligned(ring) ? PAL.good : PAL.accent) : PAL.dim;
      ctx.strokeStyle = color;
      ctx.lineWidth = isActive ? 10 : 6;
      // Ring mit Lücke (Kerbe) bei -90° + Winkel
      const notch = -Math.PI / 2 + ring.shown;
      ctx.beginPath();
      ctx.arc(GE.lockX, GE.lockY, ring.r, notch + 0.22, notch + Math.PI * 2 - 0.22);
      ctx.stroke();
      // Kerben-Zahn
      ctx.beginPath();
      ctx.moveTo(GE.lockX + Math.cos(notch) * (ring.r - 18), GE.lockY + Math.sin(notch) * (ring.r - 18));
      ctx.lineTo(GE.lockX + Math.cos(notch) * (ring.r + 18), GE.lockY + Math.sin(notch) * (ring.r + 18));
      ctx.stroke();
    });
    // Drehpfeile als Hinweis
    if (active >= 0 && !geAligned(rings[active])) {
      ctx.strokeStyle = PAL.dim;
      ctx.lineWidth = 3;
      const r = rings[active].r;
      const a0 = clock * 1.5;
      ctx.beginPath();
      ctx.arc(GE.lockX, GE.lockY, r + 26, a0, a0 + 1.2);
      ctx.stroke();
    }
    ctx.restore();
  }

  function geDrawGuard(ctx) {
    // Lichtkegel der Wache (Anzeige, halbtransparent – fällt auf das Schloss, wenn sie darüber ist)
    ctx.save();
    ctx.globalAlpha = 0.12;
    ctx.fillStyle = PAL.warn;
    ctx.beginPath();
    ctx.moveTo(guardX, GE.guardY + 20);
    ctx.lineTo(guardX - GE.coneHalf, H - 40);
    ctx.lineTo(guardX + GE.coneHalf, H - 40);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
    ctx.save();
    ctx.strokeStyle = PAL.enemy;
    ctx.fillStyle = '#000000';
    ctx.lineWidth = 4;
    const step = Math.sin(clock * 8) * 8;
    ctx.beginPath();
    ctx.arc(guardX, GE.guardY - 50, 14, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(guardX, GE.guardY - 36);
    ctx.lineTo(guardX, GE.guardY);
    ctx.lineTo(guardX - 10 + step, GE.guardY + 26);
    ctx.moveTo(guardX, GE.guardY);
    ctx.lineTo(guardX + 10 - step, GE.guardY + 26);
    ctx.moveTo(guardX, GE.guardY - 24);
    ctx.lineTo(guardX + 26 * guardDir, GE.guardY - 10);
    ctx.stroke();
    ctx.restore();
  }

  return {
    id: 'gefangene',
    title: 'Gefangene befreien',
    hint: 'Gemeinsam im Schloss KREISEN dreht den Ring. Kerbe oben → Riegel-Feld rechts halten. Im Licht der Wache nicht leuchten!',
    update(grid, dt, ctx) {
      clock += dt;
      lastDt = dt;
      if (returned) return null;
      if (result) {
        doneDelay -= dt;
        if (doneDelay <= 0) {
          returned = true;
          return result;
        }
      }
      let guardSees = false;
      if (!result) {
        timeLeft -= dt;
        wrongCool = Math.max(0, wrongCool - dt);
        if (keyEdge('KeyX')) timeLeft = 0;
        // Wache läuft hin und her
        guardX += guardDir * GE.guardSpeed[level] * dt;
        if (guardX > W + 200) guardDir = -1;
        if (guardX < -200) guardDir = 1;
        guardSees = Math.abs(guardX - GE.lockX) < GE.coneHalf + 120;

        gesture.handle(grid, dt);
        pad.handle(grid, dt);
        // Testhilfe: Ring drehen bzw. Riegel halten
        if (isKeyDown('KeyK')) {
          autoTimer -= dt;
          if (autoTimer <= 0 && active >= 0) {
            autoTimer = 0.7;
            if (!geAligned(rings[active])) geRotate(1);
            else pad.setValue(100);
          }
        }
        const lightNow = gesture.hasInput() || pad.getFillPercent() > 0;
        if (guardSees && lightNow && !isKeyDown('KeyK')) alarm += dt;
        else alarm = Math.max(0, alarm - dt * 0.5);
        if (alarm >= GE.alarmNeed) {
          alarm = 0;
          alarms++;
          timeLeft -= GE.alarmPenalty;
          addShake(18);
          addFloater(GE.lockX, GE.lockY - 330, 'ALARM! −' + GE.alarmPenalty + ' s', PAL.bad);
          playSound(SND.error, 0.8);
        }
        if (active >= 0 && pad.getValue() >= 100) {
          if (geAligned(rings[active])) geLock();
          else if (wrongCool <= 0) {
            wrongCool = 1;
            pad.setValue(0);
            timeLeft -= GE.wrongPenalty;
            addFloater(GE.padX, GE.padY - 150, 'Kerbe nicht oben! −' + GE.wrongPenalty + ' s', PAL.bad);
            addShake(8);
            playSound(SND.error, 0.5);
          }
        }
        if (!result && timeLeft <= 0) geFinish(false);
      }

      // ------ Zeichnen ------
      ctx.save();
      ctx.fillStyle = PAL.dark;
      ctx.fillRect(0, TOP, W, H - TOP);
      ctx.restore();
      geDrawGuard(ctx);
      geDrawLock(ctx);
      // Gestenspur (dünn, damit sie kein Laserlicht vortäuscht)
      const trail = gesture.getTrail();
      if (trail.length > 1) {
        ctx.save();
        ctx.strokeStyle = PAL.accent;
        ctx.globalAlpha = 0.5;
        ctx.lineWidth = 2;
        ctx.beginPath();
        trail.forEach((p, i) => (i ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y)));
        ctx.stroke();
        ctx.restore();
      }
      const ringOk = active >= 0 && geAligned(rings[active]);
      mgcDrawPad(ctx, GE.padX, GE.padY, GE.padR, pad.getValue() / 100, ringOk ? PAL.good : PAL.warn, 'RIEGEL');
      if (alarm > 0) {
        ctx.save();
        ctx.fillStyle = PAL.bad;
        ctx.fillRect(GE.lockX - 150, H - 60, 300 * clamp(alarm / GE.alarmNeed, 0, 1), 18);
        ctx.strokeStyle = PAL.bad;
        ctx.strokeRect(GE.lockX - 150, H - 60, 300, 18);
        ctx.restore();
      }
      if (guardSees && !result) {
        util.renderText({ ctx, text: 'PSST – Wache schaut her!', x: GE.lockX, y: H - 80, fontSize: '32px', fillStyle: PAL.warn });
      }
      const lockedN = rings.filter((r) => r.locked).length;
      mgcDrawTimer(
        ctx,
        timeLeft / total,
        'Ringe: ' + lockedN + ' / ' + nRings + '   ·   noch ' + Math.max(0, Math.ceil(timeLeft)) + ' s' + (alarms ? '   ·   Alarme: ' + alarms : ''),
        timeLeft < total * 0.25 ? PAL.bad : PAL.accent
      );
      return null;
    },
  };
}

// @@MINIGAMES-ENDE@@


const MINIGAMES = [mgFeuergefecht, mgScharfschuetze, mgMinenfeld, mgNachtwache, mgFluss, mgSumpf, mgMoerser, mgSanitaeter, mgFunkspruch, mgAbwurf, mgBruecke, mgTierangriff, mgVorraete, mgGefangene];

// ---------------------------------------------------------------------------------------------------------
// Export
// ---------------------------------------------------------------------------------------------------------

export default {
  name: 'Trupp Nebelkrähe',
  description: `nach Lost Patrol (Amiga 1990)
  
  Euer Trupp ist hinter der Grenze abgeschnitten
  Drei Gebiete bis zur Basis immer nach RECHTS
    
   Auf der Karte: 
    gemeinsam ein Richtungs-Pad anleuchten, das volle Pad gewinnt

    Jeder Schritt kostet Proviant. Unterwegs warten 14 Begegnungen 
    jede ein eigenes Laser-Minispiel

    Eigene Leute nie anleuchten! 
    
    Im Menü gibt es einen Minispiel-Test`,
  image: 'media/img/gametitles/laser-defense-###4###.png',
  init() {
    ensurePalette();
    resetRun();
    screenIndex = 0;
    generateScreen(0);
    current = null;
    setScene('title');
  },
  handle(grid, elapsed) {
    const dt = Math.min(elapsed || 0, 0.1);
    const ctx = MasterCanvas.get2dContext();
    ensurePalette();
    if (!squad.length) {
      resetRun();
      generateScreen(0);
    }
    clock += dt;
    sceneTime += dt;
    shake = Math.max(0, shake - dt * 40);
    if (scene === 'title') handleTitle(grid, dt, ctx);
    else if (scene === 'test') handleTest(grid, dt, ctx);
    else if (scene === 'map') {
      ctx.save();
      if (shake > 0) ctx.translate((Math.random() - 0.5) * shake, (Math.random() - 0.5) * shake);
      handleMap(grid, dt, ctx);
      ctx.restore();
      updateEffects(dt, ctx);
      if (scene === 'map' || scene === 'event') drawHud(ctx);
    } else if (scene === 'event') {
      handleEvent(grid, dt, ctx);
      drawHud(ctx);
    } else if (scene === 'village') {
      handleVillage(grid, dt, ctx);
      drawHud(ctx);
    } else if (scene === 'intro') {
      if (!current) setScene('map');
      else {
        handleIntro(grid, dt, ctx);
        drawHud(ctx, current.title);
      }
    } else if (scene === 'minigame') {
      if (!current || !current.game) setScene('map');
      else handleMinigame(grid, dt, ctx);
    } else if (scene === 'result') {
      if (!current || !lastResult) setScene('map');
      else {
        handleResult(grid, dt, ctx);
        drawHud(ctx);
      }
    } else if (scene === 'transition') {
      handleTransition(grid, dt, ctx);
      drawHud(ctx);
    } else if (scene === 'gameover') handleEnd(grid, dt, ctx, false);
    else if (scene === 'victory') handleEnd(grid, dt, ctx, true);
  },
  stop() {
    current = null;
    vote = null;
    village = null;
    particles = [];
    floaters = [];
    scene = 'title';
    buttons = {};
  },
};
