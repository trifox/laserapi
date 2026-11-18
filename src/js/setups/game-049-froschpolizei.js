/**
 * Laser-Froschpolizei – umgekehrtes Frogger für viele Laser
 *
 * Die Frösche hüpfen VON SELBST stur Spur für Spur nach oben: von der Wiese (Froschkolonie) über vier
 * Straßenspuren, den Mittelstreifen und drei Flussspuren bis in den Seerosenteich. Das Publikum steuert
 * nicht die Frösche, sondern ist die VERKEHRSPOLIZEI.
 *
 * Regeln:
 * - AUTOS anleuchten = bremsen (gui/pixelFillButton). Je voller der Button, desto langsamer; voll = Stillstand.
 *   Mehr Laser auf einem Auto = schneller gestoppt (Teamwork über bedeckten Flächenanteil).
 * - LKW (ab Level 2, ab Level 3 als Kolonne) sind lange Felder (gui/regionButton) und brauchen viel mehr Laser.
 * - STAU-METER: Stehen oder schleichen Autos, steigt der Stau. Wildes Herumleuchten über der Straße
 *   (gui/calmMeter) lässt ihn zusätzlich steigen. Ist der Stau voll, rast ein RASER durch eine Spur –
 *   er lässt sich nicht bremsen. Also nur die Autos anhalten, die gerade einen Frosch bedrohen!
 * - FLUSS: Ein Frosch springt stur weiter. Landet er im Wasser statt auf einem Baumstamm, ist er verloren.
 *   Angeleuchtete Stämme werden langsamer und halten an, damit die Frösche draufspringen können.
 *   Frösche auf Stämmen treiben mit – zu weit an den Rand getrieben = verloren.
 * - KROKODILE (ab Level 3) sehen fast aus wie Baumstämme (Höcker, blinzelnde Augen). Anleuchten weckt sie:
 *   sie schnappen nach jedem Frosch auf ihrem Rücken. NICHT alles anleuchten!
 * - NEBEL (ab Level 4): Autos tauchen erst spät aus dem Dunst auf.
 * - Level-Ziel: X Frösche retten, bevor Y verloren gehen (sonst Game Over). Jedes Level: mehr und schnellere
 *   Autos, mehr Frösche gleichzeitig unterwegs, neue Gefahren.
 * - 2 TEAMS (zweiter Start-Button): Linke und rechte Kolonie mit eigenem Punktestand. Jedes Auto trägt die
 *   Farbe der Seite, von der es kommt. Auf der EIGENEN Hälfte bremst Anleuchten, auf der GEGNERISCHEN
 *   Hälfte gibt es Vollgas – man kann dem anderen Team also die Autos auf den Hals hetzen.
 *
 * Tastatur-Test (ohne Laser):
 *   Leertaste = Start (Einzel) bzw. zurück zum Start, T = Start mit 2 Teams,
 *   1–4 halten = Autos der Straßenspur 1–4 bremsen (1 = unterste Spur),
 *   5–7 halten = Stämme der Flussspur 1–3 anhalten (5 = unterste; weckt dort auch Krokodile),
 *   9 halten = wildes Herumleuchten simulieren (Stau-Strafe), N = nächstes Level.
 *
 * Klassiker: Frogger (Konami, 1981) und Freeway (Activision, Atari 2600, 1981) – dort steuert man den
 * Frosch bzw. das Huhn durch den Verkehr. Hier ist es umgekehrt: die Tiere laufen von selbst, gesteuert
 * wird der VERKEHR (ein bisschen wie Lemmings, nur mit Polizeikelle).
 *
 * Ein-Pixel-Netzspiel: Jede Eingabe ist ein Flächenanteil (Auto/Stamm/Krokodil-Feld) bzw. die Unruhe im
 * Straßenbereich – das funktioniert genauso, wenn tausende Netzspieler je genau einen Pixel steuern.
 */

import util, { getRgbSpreadHex, getRgbSpread, removeItemFromArray } from '../util.js';
import soundWhistle from '../../../public/media/trillerpfeife.mp3';
import soundSplash from '../../../public/media/485066__javierserrat__object-falls-into-the-water.wav';
import soundSplat from '../../../public/media/414346__bykgames__explosion-far.wav';
import soundPlop from '../../../public/media/369952__mischy__plop-1.wav';
import soundLevel from '../../../public/media/521966__kastenfrosch__ready-to-start-jingle.ogg';
import soundSnap from '../../../public/media/517267__foolboymedia__cinematic-stomp.wav';
import soundRaser from '../../../public/media/70299__kizilsungur__sonar.wav';
import soundStart from '../../../public/media/496199__luminousfridge__player-spawned.ogg';

var laserConfig = require('../LaserApiConfig.js').default;
var MasterCanvas = require('../MasterCanvas').default;
var guiFillButton = require('./gui/fillButton-ai2').default;
var guiPixelFillButton = require('./gui/pixelFillButton').default;
var guiRegionButton = require('./gui/regionButton').default;
var guiCalmMeter = require('./gui/calmMeter').default;
var createHighscore = require('../util/highscore').default;

// --- Highscore: modul-global, bleibt über alle Runden erhalten ---
var highscore = createHighscore('Froschpolizei', 'punkte');

// --- Balancing ---
const DIFFICULTY = {
  // Autos
  carStartSpeed: 120, // px/s
  carSpeedPerLevel: 22,
  carMaxSpeed: 260,
  laneSpeedMul: [1.0, 1.15, 0.9, 1.25],
  spawnStart: 8.4, // s zwischen zwei Autos pro Spur
  spawnFactor: 0.88,
  spawnMin: 1.4,
  carRadius: 62, // Laser-Messkreis eines Autos
  carFillSpeed: 130, // Füllrate bei voller Abdeckung (Zähler 0..100)
  carEmptySpeed: 40,
  carFullPercent: 22, // ab diesem Flächenanteil volle Füllrate
  truckLength: 300,
  truckFillSpeed: 70,
  truckEmptySpeed: 30,
  truckFullPercent: 40,
  truckSpeedMul: 0.8,
  truckFromLevel: 2,
  convoyFromLevel: 3,
  bigConvoyFromLevel: 5,
  queueGap: 34, // Mindestabstand im Stau
  harmlessSpeed: 35, // langsamer als das (px/s) überfährt ein Auto keinen Frosch
  vollgasFactor: 1.3, // Teammodus: Anleuchten auf gegnerischer Hälfte
  keyFillSpeed: 260, // Tastatur-Test
  // Fluss
  logBaseSpeed: [65, 90, 85],
  logSpeedPerLevel: 0.07,
  logFillSpeed: 95,
  logEmptySpeed: 35,
  logFullPercent: 25,
  logLengthMin: 280,
  logLengthMax: 460,
  logGapMin: 80,
  logGapMinPerLevel: 18,
  logGapMax: 220,
  logGapMaxPerLevel: 30,
  crocFromLevel: 3,
  crocChance: 0.2,
  crocChancePerLevel: 0.05,
  crocMaxChance: 0.4,
  crocLength: 300,
  crocFillSpeed: 80,
  crocFullPercent: 25,
  crocAwakeTime: 2.4,
  // Frösche
  frogRadius: 42,
  hopDuration: 0.38,
  hopWaitStart: 1.7,
  hopWaitPerLevel: 0.09,
  hopWaitMin: 0.9,
  medianWaitFactor: 2.2, // auf dem Mittelstreifen wartet der Frosch länger (Zeit, einen Stamm anzuhalten)
  riverWaitFactor: 1.6, // auf Stämmen ebenso
  landTolerance: 22, // so weit neben dem Stamm hält sich ein Frosch noch an der Kante fest
  frogSpawnInterval: 2.3,
  maxFrogsStart: 3,
  maxFrogsPerLevel: 1,
  maxFrogsCap: 9,
  targetStart: 6,
  targetPerLevel: 2,
  maxLost: 6,
  teamExtraFrogs: 2,
  teamExtraTarget: 2,
  // Stau
  jamPerCar: 2.2, // pro voll gebremstem (sichtbarem) Auto und Sekunde
  jamMaxCars: 5, // mehr stehende Autos zählen nicht zusätzlich (Deckel)
  jamPerBlockedLane: 1.5, // wenn an der Einfahrt Autos warten
  jamPerChaos: 10, // bei Unruhe 1
  jamDecay: 6,
  jamChaosPenalty: 12,
  jamAfterRaser: 20,
  raserTargetChance: 0.5, // Anteil der Raser, die gezielt eine Spur mit Frosch nehmen
  raserWarnTime: 1.3,
  raserSpeed: 1100,
  // Nebel
  fogFromLevel: 4,
  fogStart: 60,
  fogDepth: 420,
  // Punkte
  scoreSave: 100,
  scoreSavePerLevel: 25,
  scoreLevel: 150,
  penaltyCroc: 25,
  penaltyChaos: 10,
  // Sonstiges
  levelUpDuration: 2.4,
  gameOverButtonDelay: 2.5,
  gameOverAutoReturn: 40,
  maxParticles: 400,
  maxRipples: 30,
  whistleGap: 1.2,
};

const SETTINGS = {
  width: 1920,
  height: 1080,
  // Reihen, auf denen Frösche sitzen: 0 Wiese, 1–4 Straße, 5 Mittelstreifen, 6–8 Fluss, 9 Teich
  rowY: [1030, 927, 822, 717, 612, 520, 425, 315, 205, 108],
  roadTop: 560,
  roadBottom: 980,
  roadLaneH: 105,
  roadDirs: [1, -1, 1, -1],
  riverTop: 150,
  riverBottom: 480,
  riverLaneH: 110,
  riverDirs: [-1, 1, -1],
  pondBottom: 150,
  roadKeys: ['Digit1', 'Digit2', 'Digit3', 'Digit4'],
  riverKeys: ['Digit5', 'Digit6', 'Digit7'],
  chaosKey: 'Digit9',
  carHues: [0.36, 0.45, 0.55, 0.62, 0.7],
  teamHues: [0.33, 0.67],
};

const LEVEL_NEWS = [
  '',
  'Autos anleuchten = bremsen. Stämme anhalten!',
  'NEU: LKW – die brauchen viel mehr Laser!',
  'NEU: Krokodile im Fluss – NICHT anleuchten!',
  'NEU: Nebel – die Autos kommen spät!',
  'NEU: lange LKW-Kolonnen!',
  'Rushhour! Alles wird schneller!',
];

const W = SETTINGS.width;
const H = SETTINGS.height;
const ROW_Y = SETTINGS.rowY;

// --- Zustand ---
var gameState = 'start';
var teamMode = false;
var time = 0;
var level = 1;
var feat = null;
var score = 0;
var teamScore = [0, 0];
var teamSaved = [0, 0];
var savedThisLevel = 0;
var lostThisLevel = 0;
var jam = 0;
var shake = 0;
var flash = 0;
var levelUpTimer = 0;
var levelBonus = 0;
var gameOverTimer = 0;
var frogSpawnTimer = 0;
var nextTeam = 0;
var whistleTimer = 0;
var raserWarn = null;
var STATS = {};
var roadLanes = [];
var riverLanes = [];
var vehicles = [];
var riverObjs = [];
var frogs = [];
var pondFrogs = [];
var particles = [];
var ripples = [];
var floaters = [];
var decor = { cars: [], logs: [], frogT: 0 };
var activeSounds = [];
var previousKeys = {};
var startButton = null;
var teamButton = null;
var restartButton = null;
var calm = null;
var C = {};
var bgCanvas = null;
var lilyPad = null;

// --- Hilfsfunktionen ---
function clamp(v, a, b) {
  return Math.max(a, Math.min(b, v));
}

function rand(a, b) {
  return a + Math.random() * (b - a);
}

/** Farbe aus der Laserfarbe – Farbton immer im Komplementärbereich 0.25..0.75 */
function col(hue, sat, val) {
  return getRgbSpreadHex(laserConfig.testColor, clamp(hue, 0.25, 0.75), sat, val);
}

function colRgb(hue, sat, val) {
  return getRgbSpread(laserConfig.testColor, clamp(hue, 0.25, 0.75), sat, val);
}

function keyDown(code) {
  return !!laserConfig.pressedKeys[code];
}

function keyPressedOnce(code) {
  const down = keyDown(code);
  const was = !!previousKeys[code];
  previousKeys[code] = down;
  return down && !was;
}

function playSound(snd, volume) {
  try {
    const audio = new Audio(snd);
    audio.volume = volume === undefined ? 1 : volume;
    activeSounds.push(audio);
    audio.addEventListener('ended', () => removeItemFromArray(activeSounds, audio));
    const p = audio.play();
    if (p && p.catch) p.catch(() => {});
  } catch (e) {
    // Ton ist nur Beiwerk
  }
}

function whistle() {
  if (whistleTimer > 0) return;
  whistleTimer = DIFFICULTY.whistleGap;
  playSound(soundWhistle, 0.6);
}

function roundRectPath(ctx, x, y, w, h, r) {
  r = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

function rectPolygon(x, y, w, h) {
  return [
    [x - w / 2, y - h / 2],
    [x + w / 2, y - h / 2],
    [x + w / 2, y + h / 2],
    [x - w / 2, y + h / 2],
  ];
}

function halfOf(x) {
  return x < W / 2 ? 0 : 1;
}

// --- Farbpalette (nie die Laserfarbe selbst) ---
function buildPalette() {
  C = {
    pondDeep: col(0.5, 0.7, 0.1),
    pondLight: col(0.47, 0.6, 0.2),
    river: col(0.55, 0.75, 0.11),
    riverDark: col(0.57, 0.8, 0.07),
    wave: col(0.52, 0.45, 0.6),
    bank: col(0.4, 0.5, 0.3),
    grass: col(0.36, 0.6, 0.14),
    grass2: col(0.38, 0.55, 0.24),
    grass3: col(0.33, 0.5, 0.09),
    flower: col(0.7, 0.5, 0.75),
    asphalt: col(0.6, 0.2, 0.085),
    speck: col(0.6, 0.12, 0.14),
    roadEdge: col(0.5, 0.12, 0.55),
    roadLine: col(0.5, 0.1, 0.42),
    beam: col(0.45, 0.2, 0.9),
    light: col(0.45, 0.25, 0.8),
    brake: col(0.27, 0.9, 0.9),
    police: col(0.5, 0.85, 1),
    warn: col(0.27, 0.95, 1),
    raserBody: col(0.27, 0.7, 0.14),
    tire: col(0.6, 0.1, 0.05),
    log: col(0.3, 0.5, 0.15),
    logRim: col(0.3, 0.45, 0.5),
    logRing: col(0.3, 0.35, 0.35),
    croc: col(0.33, 0.5, 0.145),
    crocRim: col(0.32, 0.45, 0.48),
    crocEye: col(0.27, 0.9, 0.95),
    eye: col(0.5, 0.05, 0.92),
    pupil: col(0.6, 0.3, 0.06),
    text: col(0.5, 0.15, 0.92),
    title: col(0.42, 0.8, 1),
    hud: col(0.55, 0.5, 1),
    jamLow: col(0.4, 0.7, 0.75),
    jamHigh: col(0.27, 0.9, 1),
    spark: col(0.45, 0.6, 1),
    splat: col(0.36, 0.7, 0.75),
    splash: col(0.52, 0.4, 0.95),
    fog: col(0.55, 0.1, 0.45),
    dust: col(0.38, 0.3, 0.45),
    btnNormal: col(0.45, 0.7, 0.9),
    btnGrow: col(0.5, 0.8, 1),
    btnActive: col(0.55, 0.9, 1),
    team: [col(SETTINGS.teamHues[0], 0.75, 0.95), col(SETTINGS.teamHues[1], 0.75, 0.95)],
  };
}

/** Seerose als Mandelbrot-Menge (der Knick der Hauptkardioide ist der Schlitz im Blatt) */
function makeLilyPad() {
  const w = 108;
  const h = 96;
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const g = canvas.getContext('2d');
  const img = g.createImageData(w, h);
  const d = img.data;
  const inside = colRgb(0.33, 0.65, 0.34);
  const vein = colRgb(0.33, 0.6, 0.22);
  const edge = colRgb(0.4, 0.5, 0.8);
  const maxIter = 40;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const cr = -2.1 + (x / w) * 2.7;
      const ci = (y / h - 0.5) * 2.4;
      let zr = 0;
      let zi = 0;
      let i = 0;
      while (zr * zr + zi * zi <= 4 && i < maxIter) {
        const t = zr * zr - zi * zi + cr;
        zi = 2 * zr * zi + ci;
        zr = t;
        i++;
      }
      const idx = (y * w + x) * 4;
      if (i === maxIter) {
        // Blattadern: Strahlen vom Blattzentrum
        const ang = Math.atan2(ci, cr + 0.2);
        const isVein = Math.abs(Math.sin(ang * 5)) < 0.12;
        const c = isVein ? vein : inside;
        d[idx] = c[0];
        d[idx + 1] = c[1];
        d[idx + 2] = c[2];
        d[idx + 3] = 255;
      } else if (i > 5) {
        d[idx] = edge[0];
        d[idx + 1] = edge[1];
        d[idx + 2] = edge[2];
        d[idx + 3] = Math.floor(Math.pow(i / maxIter, 0.7) * 170);
      } else {
        d[idx + 3] = 0;
      }
    }
  }
  g.putImageData(img, 0, 0);
  return canvas;
}

/** Hintergrund (Teich, Fluss, Mittelstreifen, Straße, Wiese) einmal vorrendern */
function buildBackground() {
  lilyPad = makeLilyPad();
  bgCanvas = document.createElement('canvas');
  bgCanvas.width = W;
  bgCanvas.height = H;
  const g = bgCanvas.getContext('2d');

  // Teich
  let grad = g.createLinearGradient(0, 0, 0, SETTINGS.pondBottom);
  grad.addColorStop(0, C.pondDeep);
  grad.addColorStop(1, C.pondLight);
  g.fillStyle = grad;
  g.fillRect(0, 0, W, SETTINGS.pondBottom);
  for (let i = 0; i < 16; i++) {
    const s = rand(0.55, 1.0);
    g.save();
    g.translate(60 + i * 120 + rand(-30, 30), rand(92, 128));
    g.rotate(rand(0, Math.PI * 2));
    g.scale(s, s * 0.7);
    g.drawImage(lilyPad, -54, -48);
    g.restore();
  }
  // kleine Blüten
  g.fillStyle = C.flower;
  for (let i = 0; i < 10; i++) {
    const x = rand(30, W - 30);
    const y = rand(95, 140);
    for (let k = 0; k < 5; k++) {
      const a = (k / 5) * Math.PI * 2;
      g.beginPath();
      g.arc(x + Math.cos(a) * 6, y + Math.sin(a) * 6, 4, 0, Math.PI * 2);
      g.fill();
    }
  }

  // Fluss
  grad = g.createLinearGradient(0, SETTINGS.riverTop, 0, SETTINGS.riverBottom);
  grad.addColorStop(0, C.riverDark);
  grad.addColorStop(0.5, C.river);
  grad.addColorStop(1, C.riverDark);
  g.fillStyle = grad;
  g.fillRect(0, SETTINGS.riverTop, W, SETTINGS.riverBottom - SETTINGS.riverTop);
  g.strokeStyle = C.bank;
  g.lineWidth = 6;
  [SETTINGS.riverTop, SETTINGS.riverBottom].forEach((y) => {
    g.beginPath();
    for (let x = 0; x <= W; x += 24) {
      const yy = y + Math.sin(x * 0.05) * 3;
      if (x === 0) g.moveTo(x, yy);
      else g.lineTo(x, yy);
    }
    g.stroke();
  });

  // Mittelstreifen + Wiese
  function grassArea(y0, y1) {
    g.fillStyle = C.grass;
    g.fillRect(0, y0, W, y1 - y0);
    for (let i = 0; i < 900; i++) {
      const x = rand(0, W);
      const y = rand(y0, y1);
      g.strokeStyle = Math.random() < 0.5 ? C.grass2 : C.grass3;
      g.lineWidth = 2;
      g.beginPath();
      g.moveTo(x, y);
      g.lineTo(x + rand(-4, 4), y - rand(4, 11));
      g.stroke();
    }
    g.fillStyle = C.flower;
    for (let i = 0; i < 25; i++) {
      g.beginPath();
      g.arc(rand(0, W), rand(y0 + 6, y1 - 6), rand(2, 4), 0, Math.PI * 2);
      g.fill();
    }
  }
  grassArea(SETTINGS.riverBottom, SETTINGS.roadTop);
  grassArea(SETTINGS.roadBottom, H);

  // Straße
  g.fillStyle = C.asphalt;
  g.fillRect(0, SETTINGS.roadTop, W, SETTINGS.roadBottom - SETTINGS.roadTop);
  g.fillStyle = C.speck;
  for (let i = 0; i < 1400; i++) {
    g.fillRect(rand(0, W), rand(SETTINGS.roadTop, SETTINGS.roadBottom), 2, 2);
  }
  g.strokeStyle = C.roadEdge;
  g.lineWidth = 6;
  [SETTINGS.roadTop + 4, SETTINGS.roadBottom - 4].forEach((y) => {
    g.beginPath();
    g.moveTo(0, y);
    g.lineTo(W, y);
    g.stroke();
  });
  // Bordstein-Kacheln am Mittelstreifen
  g.fillStyle = C.roadLine;
  for (let x = 0; x < W; x += 60) {
    g.fillRect(x, SETTINGS.roadTop - 10, 30, 6);
  }
}

// --- Level-Eigenschaften ---
function levelFeatures(lvl) {
  const D = DIFFICULTY;
  return {
    carSpeed: Math.min(D.carMaxSpeed, D.carStartSpeed + (lvl - 1) * D.carSpeedPerLevel),
    spawnInterval: Math.max(D.spawnMin, D.spawnStart * Math.pow(D.spawnFactor, lvl - 1)),
    truckChance: lvl >= D.truckFromLevel ? Math.min(0.45, 0.15 + 0.06 * (lvl - D.truckFromLevel)) : 0,
    convoyMax: lvl >= D.bigConvoyFromLevel ? 3 : lvl >= D.convoyFromLevel ? 2 : 1,
    crocChance:
      lvl >= D.crocFromLevel ? Math.min(D.crocMaxChance, D.crocChance + D.crocChancePerLevel * (lvl - D.crocFromLevel)) : 0,
    fog: lvl >= D.fogFromLevel,
    maxFrogs: Math.min(D.maxFrogsCap, D.maxFrogsStart + (lvl - 1) * D.maxFrogsPerLevel) + (teamMode ? D.teamExtraFrogs : 0),
    hopWait: Math.max(D.hopWaitMin, D.hopWaitStart - (lvl - 1) * D.hopWaitPerLevel),
    target: D.targetStart + (lvl - 1) * D.targetPerLevel + (teamMode ? D.teamExtraTarget : 0),
    maxLost: D.maxLost,
    logSpeedMul: 1 + (lvl - 1) * D.logSpeedPerLevel,
    logGapMin: D.logGapMin + (lvl - 1) * D.logGapMinPerLevel,
    logGapMax: D.logGapMax + (lvl - 1) * D.logGapMaxPerLevel,
  };
}

// --- Effekte ---
function addParticle(x, y, vx, vy, life, color, size, grav, glow) {
  if (particles.length >= DIFFICULTY.maxParticles) particles.shift();
  particles.push({ x: x, y: y, vx: vx, vy: vy, life: life, maxLife: life, color: color, size: size, grav: grav || 0, glow: !!glow });
}

function burst(x, y, color, count, speed, grav, glow) {
  for (let i = 0; i < count; i++) {
    const a = Math.random() * Math.PI * 2;
    const s = speed * (0.3 + Math.random() * 0.7);
    addParticle(x, y, Math.cos(a) * s, Math.sin(a) * s, rand(0.4, 1.0), color, rand(4, 10), grav, glow);
  }
}

function splashAt(x, y) {
  for (let i = 0; i < 26; i++) {
    addParticle(x + rand(-20, 20), y, rand(-160, 160), rand(-420, -150), rand(0.5, 0.9), C.splash, rand(4, 8), 900, false);
  }
  addRipple(x, y);
  addRipple(x + 10, y + 4);
}

function addRipple(x, y) {
  if (ripples.length >= DIFFICULTY.maxRipples) ripples.shift();
  ripples.push({ x: x, y: y, t: 0 });
}

function addFloater(x, y, text, color, size) {
  floaters.push({ x: x, y: y, text: text, color: color || C.text, life: 1.5, maxLife: 1.5, size: size || 44 });
}

function addScore(points, x, y, team) {
  score = Math.max(0, score + points);
  if (teamMode && team !== undefined) teamScore[team] = Math.max(0, teamScore[team] + points);
  addFloater(x, y, (points > 0 ? '+' : '') + points, points > 0 ? C.spark : C.warn);
}

// --- Fahrzeuge (Laser-Eingabe über pixelFillButton bzw. regionButton) ---
function setVehicleLook(v) {
  let hue = SETTINGS.carHues[Math.floor(Math.random() * SETTINGS.carHues.length)];
  if (teamMode) hue = SETTINGS.teamHues[v.owner];
  v.hue = hue;
  if (v.kind === 'raser') {
    v.bodyCol = C.raserBody;
    v.rimCol = C.warn;
  } else {
    v.bodyCol = col(hue, 0.5, v.kind === 'truck' ? 0.13 : 0.11);
    v.rimCol = col(hue, 0.65, 0.85);
  }
}

function createVehicle(kind, laneIdx) {
  const lane = roadLanes[laneIdx];
  const isTruck = kind === 'truck';
  const len = isTruck ? DIFFICULTY.truckLength : 170;
  const h = isTruck ? 86 : 78;
  const x = lane.dir > 0 ? -len / 2 - 10 : W + len / 2 + 10;
  const v = {
    kind: kind,
    lane: laneIdx,
    dir: lane.dir,
    x: x,
    prevX: x,
    y: lane.y,
    len: len,
    h: h,
    base: feat.carSpeed * DIFFICULTY.laneSpeedMul[laneIdx] * (isTruck ? DIFFICULTY.truckSpeedMul : 1) * rand(0.9, 1.1),
    speed: 0,
    moved: 0,
    realSpeed: 0,
    value: 0,
    owner: lane.dir > 0 ? 0 : 1,
    foreign: false,
    horn: rand(1, 3),
    seed: Math.random() * 100,
    btn: null,
  };
  setVehicleLook(v);
  const onStop = () => {
    if (v.foreign) return;
    STATS.stops++;
    whistle();
    addFloater(v.x, v.y - 30, 'HALT!', C.police, 34);
  };
  if (isTruck) {
    v.btn = guiRegionButton({
      polygon: rectPolygon(x, lane.y, len, h),
      speedUp: DIFFICULTY.truckFillSpeed,
      speedDown: DIFFICULTY.truckEmptySpeed,
      fullPercent: DIFFICULTY.truckFullPercent,
      activeValue: 95,
      minValue: 10,
      visible: false,
      onEnterActive: onStop,
    });
  } else {
    v.btn = guiPixelFillButton({
      label: '',
      posX: x,
      posY: lane.y,
      radius: DIFFICULTY.carRadius,
      speedUp: DIFFICULTY.carFillSpeed,
      speedDown: DIFFICULTY.carEmptySpeed,
      fullPercent: DIFFICULTY.carFullPercent,
      activeValue: 95,
      minValue: 10,
      visible: false,
      onEnterActive: onStop,
    });
  }
  // Handle-Wrapping: Bewegung + Bremsen/Vollgas, dann Messen
  const handleOriginal = v.btn.handle;
  v.btn.handle = (grid, dt) => {
    const effect = v.value >= 96 ? 1 : v.value / 100;
    v.foreign = teamMode && halfOf(v.x) !== v.owner;
    v.speed = v.foreign ? v.base * (1 + effect * DIFFICULTY.vollgasFactor) : v.base * (1 - effect);
    v.x += v.dir * v.speed * dt;
    v.btn.setX(v.x);
    handleOriginal(grid, dt);
    if (keyDown(SETTINGS.roadKeys[v.lane])) {
      v.btn.setValue(Math.min(100, v.btn.getValue() + DIFFICULTY.keyFillSpeed * dt));
    }
    v.value = v.btn.getValue();
  };
  vehicles.push(v);
  return v;
}

function createRaser(laneIdx) {
  const lane = roadLanes[laneIdx];
  const len = 190;
  const x = lane.dir > 0 ? -len / 2 - 10 : W + len / 2 + 10;
  const v = {
    kind: 'raser',
    lane: laneIdx,
    dir: lane.dir,
    x: x,
    prevX: x,
    y: lane.y,
    len: len,
    h: 74,
    base: DIFFICULTY.raserSpeed,
    speed: DIFFICULTY.raserSpeed,
    moved: 0,
    realSpeed: DIFFICULTY.raserSpeed,
    value: 0,
    owner: 0,
    foreign: false,
    horn: 99,
    seed: Math.random() * 100,
    btn: null,
  };
  setVehicleLook(v);
  vehicles.push(v);
  STATS.rasers++;
  shake = Math.max(shake, 8);
  return v;
}

function laneEntryFree(laneIdx) {
  for (let i = 0; i < vehicles.length; i++) {
    const v = vehicles[i];
    if (v.lane !== laneIdx || v.kind === 'raser') continue;
    const d = v.dir > 0 ? v.x - v.len / 2 : W - (v.x + v.len / 2);
    if (d < DIFFICULTY.queueGap + 10) return false;
  }
  return true;
}

/** Warteschlange: niemand fährt auf den Vordermann auf (Liste = Objekte einer Spur, gleiche Richtung) */
function resolveQueue(list, dir, gap) {
  list.sort((a, b) => (b.x - a.x) * dir);
  for (let i = 1; i < list.length; i++) {
    const lead = list[i - 1];
    const f = list[i];
    const limit = lead.x - dir * (lead.len / 2 + f.len / 2 + gap);
    if (dir > 0 ? f.x > limit : f.x < limit) {
      f.x = limit;
      if (f.btn) f.btn.setX(f.x);
    }
  }
}

function updateRoad(grid, dt) {
  let blocked = 0;
  roadLanes.forEach((lane, i) => {
    lane.timer -= dt;
    const wants = lane.pending > 0 || lane.timer <= 0;
    if (!wants) return;
    if (!laneEntryFree(i)) {
      blocked++;
      return;
    }
    if (lane.pending > 0) {
      createVehicle('truck', i);
      lane.pending--;
    } else {
      if (Math.random() < feat.truckChance) {
        createVehicle('truck', i);
        lane.pending = Math.floor(Math.random() * feat.convoyMax);
      } else {
        createVehicle('car', i);
      }
      lane.timer = feat.spawnInterval * rand(0.6, 1.4);
    }
  });

  vehicles.forEach((v) => {
    v.prevX = v.x;
  });
  vehicles.slice().forEach((v) => {
    if (v.btn) v.btn.handle(grid, dt);
    else v.x += v.dir * v.speed * dt;
  });
  for (let i = 0; i < roadLanes.length; i++) {
    resolveQueue(
      vehicles.filter((v) => v.lane === i && v.kind !== 'raser'),
      roadLanes[i].dir,
      DIFFICULTY.queueGap
    );
  }

  // Stau messen: tatsächliche Bewegung (auch Autos, die hinter einem stehenden Auto warten)
  let braked = 0;
  vehicles.slice().forEach((v) => {
    v.moved = Math.abs(v.x - v.prevX);
    v.realSpeed = dt > 0 ? v.moved / dt : 0;
    const visible = v.x + v.len / 2 > 0 && v.x - v.len / 2 < W;
    if (v.kind !== 'raser' && dt > 0 && !v.foreign && visible) {
      braked += clamp(1 - v.moved / dt / v.base, 0, 1);
    }
    // Hupen bei stark gebremsten Autos
    if (v.kind !== 'raser' && v.value > 60) {
      v.horn -= dt;
      if (v.horn <= 0) {
        v.horn = rand(1.6, 3.2);
        addFloater(v.x + rand(-30, 30), v.y - 40, 'HUP!', v.rimCol, 30);
      }
    }
    if ((v.dir > 0 && v.x - v.len / 2 > W + 40) || (v.dir < 0 && v.x + v.len / 2 < -40)) {
      removeItemFromArray(vehicles, v);
    }
  });

  const chaos = calm ? calm.getChaos() : 0;
  jam += (Math.min(braked, DIFFICULTY.jamMaxCars) * DIFFICULTY.jamPerCar + blocked * DIFFICULTY.jamPerBlockedLane + chaos * DIFFICULTY.jamPerChaos - DIFFICULTY.jamDecay) * dt;
  jam = clamp(jam, 0, 100);
  STATS.maxJam = Math.max(STATS.maxJam, jam);

  // erst wieder ein Raser, wenn der letzte durch ist
  const raserOnRoad = vehicles.some((v) => v.kind === 'raser');
  if (raserOnRoad || raserWarn) jam = Math.min(jam, 99);
  if (jam >= 99 && !raserWarn && !raserOnRoad) {
    raserWarn = { lane: pickRaserLane(), t: DIFFICULTY.raserWarnTime };
    jam = DIFFICULTY.jamAfterRaser;
    playSound(soundRaser, 0.7);
    addFloater(W / 2, SETTINGS.roadTop + 60, 'STAU! DER RASER KOMMT!', C.warn, 60);
  }
  if (raserWarn) {
    raserWarn.t -= dt;
    if (raserWarn.t <= 0) {
      createRaser(raserWarn.lane);
      raserWarn = null;
    }
  }
}

function pickRaserLane() {
  const candidates = [];
  // bevorzugt die Spur, in der ein Frosch sitzt bzw. in die er gleich hüpft
  frogs.forEach((f) => {
    if (f.row >= 0 && f.row <= 4) candidates.push(f.row === 0 ? 0 : f.row - 1);
  });
  if (candidates.length && Math.random() < DIFFICULTY.raserTargetChance) return candidates[Math.floor(Math.random() * candidates.length)];
  return Math.floor(Math.random() * roadLanes.length);
}

// --- Fluss: Baumstämme und Krokodile (regionButton) ---
function createRiverObject(kind, laneIdx, x, len) {
  const lane = riverLanes[laneIdx];
  const isCroc = kind === 'croc';
  len = isCroc ? DIFFICULTY.crocLength : len;
  const h = isCroc ? 76 : 78;
  const o = {
    kind: kind,
    lane: laneIdx,
    dir: lane.dir,
    x: x,
    prevX: x,
    dx: 0,
    y: lane.y,
    len: len,
    h: h,
    base: DIFFICULTY.logBaseSpeed[laneIdx] * feat.logSpeedMul,
    speed: 0,
    value: 0,
    awake: 0,
    blink: rand(1, 4),
    eyesOpen: 0,
    seed: Math.random() * 100,
    btn: null,
  };
  o.btn = guiRegionButton({
    polygon: rectPolygon(x, lane.y, len, h),
    speedUp: isCroc ? DIFFICULTY.crocFillSpeed : DIFFICULTY.logFillSpeed,
    speedDown: DIFFICULTY.logEmptySpeed,
    fullPercent: isCroc ? DIFFICULTY.crocFullPercent : DIFFICULTY.logFullPercent,
    activeValue: 90,
    minValue: 10,
    visible: false,
    onEnterActive: isCroc ? () => wakeCroc(o) : undefined,
  });
  const handleOriginal = o.btn.handle;
  o.btn.handle = (grid, dt) => {
    if (o.kind === 'croc') {
      // Krokodile lassen sich nicht anhalten – wach schwimmen sie sogar schneller
      o.speed = o.base * (o.awake > 0 ? 1.4 : 1);
    } else {
      const effect = o.value >= 96 ? 1 : o.value / 100;
      o.speed = o.base * (1 - effect);
    }
    o.x += o.dir * o.speed * dt;
    o.btn.setX(o.x);
    handleOriginal(grid, dt);
    if (keyDown(SETTINGS.riverKeys[o.lane])) {
      o.btn.setValue(Math.min(100, o.btn.getValue() + DIFFICULTY.keyFillSpeed * dt));
    }
    o.value = o.btn.getValue();
  };
  riverObjs.push(o);
  lane.last = o;
  return o;
}

function wakeCroc(o) {
  if (o.awake > 0) return;
  o.awake = DIFFICULTY.crocAwakeTime;
  STATS.crocsWoken++;
  playSound(soundSnap, 0.8);
  shake = Math.max(shake, 10);
  addFloater(o.x, o.y - 50, 'KROKODIL!', C.warn, 50);
  addScore(-DIFFICULTY.penaltyCroc, o.x, o.y - 100);
  frogs.slice().forEach((f) => {
    if (f.ride === o) loseFrog(f, 'croc');
  });
}

function spawnRiverObject(laneIdx) {
  const lane = riverLanes[laneIdx];
  const kind = Math.random() < feat.crocChance ? 'croc' : 'log';
  const len = kind === 'croc' ? DIFFICULTY.crocLength : rand(DIFFICULTY.logLengthMin, DIFFICULTY.logLengthMax);
  const x = lane.dir > 0 ? -len / 2 - 5 : W + len / 2 + 5;
  createRiverObject(kind, laneIdx, x, len);
  lane.gap = rand(feat.logGapMin, feat.logGapMax);
}

function populateRiver() {
  riverLanes.forEach((lane, i) => {
    let c = rand(0, 160);
    let entryMost = null;
    while (c < W) {
      const len = rand(DIFFICULTY.logLengthMin, DIFFICULTY.logLengthMax);
      const o = createRiverObject('log', i, c + len / 2, len);
      if (!entryMost || (lane.dir > 0 ? o.x < entryMost.x : o.x > entryMost.x)) entryMost = o;
      c += len + rand(feat.logGapMin, feat.logGapMax);
    }
    lane.last = entryMost;
    lane.gap = rand(feat.logGapMin, feat.logGapMax);
  });
}

function updateRiver(grid, dt) {
  riverLanes.forEach((lane, i) => {
    const last = lane.last;
    if (!last || riverObjs.indexOf(last) < 0) {
      spawnRiverObject(i);
      return;
    }
    const d = lane.dir > 0 ? last.x - last.len / 2 : W - (last.x + last.len / 2);
    if (d >= lane.gap) spawnRiverObject(i);
  });
  riverObjs.forEach((o) => {
    o.prevX = o.x;
  });
  riverObjs.slice().forEach((o) => o.btn.handle(grid, dt));
  for (let i = 0; i < riverLanes.length; i++) {
    resolveQueue(
      riverObjs.filter((o) => o.lane === i),
      riverLanes[i].dir,
      20
    );
  }
  riverObjs.slice().forEach((o) => {
    o.dx = o.x - o.prevX;
    // Krokodil: Augen blinzeln, nach dem Schnappen wieder einschlafen
    if (o.kind === 'croc') {
      if (o.awake > 0) {
        o.awake -= dt;
        if (o.awake <= 0) {
          o.awake = 0;
          o.btn.setValue(0);
          o.value = 0;
        }
      }
      if (o.eyesOpen > 0) o.eyesOpen -= dt;
      o.blink -= dt;
      if (o.blink <= 0) {
        o.eyesOpen = 0.6;
        o.blink = rand(2, 5);
      }
    }
    if ((o.dir > 0 && o.x - o.len / 2 > W + 20) || (o.dir < 0 && o.x + o.len / 2 < -20)) {
      removeItemFromArray(riverObjs, o);
    }
  });
}

// --- Frösche ---
function spawnFrog() {
  const team = teamMode ? nextTeam : 0;
  nextTeam = 1 - nextTeam;
  // nicht zu nah am Rand: dort treiben die Stämme schnell aus dem Bild
  const x0 = teamMode ? (team === 0 ? 240 : W / 2 + 120) : 240;
  const x1 = teamMode ? (team === 0 ? W / 2 - 120 : W - 240) : W - 240;
  // Platz suchen, der möglichst weit von anderen Fröschen der unteren Reihen entfernt ist
  let best = rand(x0, x1);
  let bestDist = -1;
  for (let k = 0; k < 8; k++) {
    const cx = rand(x0, x1);
    let m = 9999;
    frogs.forEach((f) => {
      if (f.row <= 1) m = Math.min(m, Math.abs(f.x - cx));
    });
    if (m > bestDist) {
      bestDist = m;
      best = cx;
    }
  }
  const hue = teamMode ? SETTINGS.teamHues[team] : 0.36 + Math.random() * 0.1;
  frogs.push({
    x: best,
    y: ROW_Y[0],
    row: 0,
    team: team,
    state: 'sit',
    wait: rand(1.4, 2.6),
    waitMax: 2.6,
    hopT: 0,
    fromY: ROW_Y[0],
    toY: ROW_Y[0],
    ride: null,
    age: 0,
    body: col(hue, 0.65, 0.5),
    rim: col(hue, 0.5, 0.9),
    look: rand(-1, 1),
  });
}

function hitByVehicle(f) {
  const lane = f.row - 1;
  for (let i = 0; i < vehicles.length; i++) {
    const v = vehicles[i];
    // stehende Autos überfahren niemanden – genau dafür ist die Polizei da
    if (v.lane === lane && v.realSpeed > DIFFICULTY.harmlessSpeed && Math.abs(v.x - f.x) < v.len / 2 + DIFFICULTY.frogRadius * 0.55) {
      return true;
    }
  }
  return false;
}

function findRiverObjectAt(laneIdx, x) {
  for (let i = 0; i < riverObjs.length; i++) {
    const o = riverObjs[i];
    if (o.lane === laneIdx && Math.abs(o.x - x) < o.len / 2 + DIFFICULTY.landTolerance) return o;
  }
  return null;
}

function landFrog(f) {
  f.row++;
  f.y = ROW_Y[f.row];
  f.state = 'sit';
  f.hopT = 0;
  f.wait = feat.hopWait * rand(0.75, 1.25);
  if (f.row === 5) f.wait *= DIFFICULTY.medianWaitFactor;
  if (f.row >= 6) f.wait *= DIFFICULTY.riverWaitFactor;
  f.waitMax = f.wait;
  if (f.row === 9) {
    saveFrog(f);
    return;
  }
  if (f.row >= 6 && f.row <= 8) {
    const o = findRiverObjectAt(f.row - 6, f.x);
    if (!o) {
      loseFrog(f, 'water');
      return;
    }
    if (o.kind === 'croc' && o.awake > 0) {
      loseFrog(f, 'croc');
      return;
    }
    f.ride = o;
    // an der Kante gelandet: auf den Stamm ziehen
    f.x = clamp(f.x, o.x - o.len / 2 + 30, o.x + o.len / 2 - 30);
    addRipple(f.x, f.y + 20);
  } else {
    for (let i = 0; i < 5; i++) {
      addParticle(f.x + rand(-25, 25), f.y + 30, rand(-60, 60), rand(-60, -10), 0.4, C.dust, rand(3, 6), 0, false);
    }
  }
}

function loseFrog(f, reason) {
  if (frogs.indexOf(f) < 0) return;
  removeItemFromArray(frogs, f);
  lostThisLevel++;
  STATS.lost++;
  if (reason === 'car') {
    STATS.lostCar++;
    burst(f.x, f.y, f.body, 26, 420, 0, false);
    burst(f.x, f.y, C.splat, 12, 260, 0, true);
    shake = Math.max(shake, 18);
    playSound(soundSplat, 0.6);
    addFloater(f.x, f.y - 50, 'PLATT!', C.warn, 50);
  } else if (reason === 'croc') {
    STATS.lostCroc++;
    burst(f.x, f.y, f.body, 20, 300, 0, false);
    splashAt(f.x, f.y);
    shake = Math.max(shake, 12);
    playSound(soundSnap, 0.8);
    addFloater(f.x, f.y - 50, 'HAPS!', C.warn, 50);
  } else {
    if (reason === 'drift') STATS.lostDrift++;
    else STATS.lostWater++;
    splashAt(f.x, f.y);
    playSound(soundSplash, 0.7);
    addFloater(f.x, f.y - 50, reason === 'drift' ? 'ABGETRIEBEN!' : 'PLATSCH!', C.splash, 46);
  }
}

function saveFrog(f) {
  removeItemFromArray(frogs, f);
  savedThisLevel++;
  STATS.saved++;
  if (teamMode) teamSaved[f.team]++;
  const pts = DIFFICULTY.scoreSave + DIFFICULTY.scoreSavePerLevel * (level - 1);
  addScore(pts, f.x, f.y - 20, f.team);
  burst(f.x, f.y, C.spark, 28, 380, 0, true);
  burst(f.x, f.y, f.rim, 10, 200, 0, true);
  pondFrogs.push({ x: f.x, t: 0, body: f.body, rim: f.rim });
  if (pondFrogs.length > 16) pondFrogs.shift();
  playSound(soundPlop, 0.8);
}

function updateFrogs(dt) {
  frogSpawnTimer -= dt;
  if (frogSpawnTimer <= 0 && frogs.length < feat.maxFrogs) {
    spawnFrog();
    frogSpawnTimer = DIFFICULTY.frogSpawnInterval * rand(0.7, 1.3);
  }
  frogs.slice().forEach((f) => {
    f.age += dt;
    if (f.state === 'sit') {
      if (f.ride) {
        if (riverObjs.indexOf(f.ride) < 0) {
          loseFrog(f, 'drift');
          return;
        }
        f.x += f.ride.dx;
        if (f.x < 25 || f.x > W - 25) {
          loseFrog(f, 'drift');
          return;
        }
      }
      if (f.row >= 1 && f.row <= 4 && hitByVehicle(f)) {
        loseFrog(f, 'car');
        return;
      }
      f.wait -= dt;
      if (f.wait <= 0) {
        f.state = 'hop';
        f.hopT = 0;
        f.fromY = ROW_Y[f.row];
        f.toY = ROW_Y[f.row + 1];
        f.ride = null;
        f.look = rand(-1, 1);
      }
    } else if (f.state === 'hop') {
      f.hopT += dt / DIFFICULTY.hopDuration;
      if (f.hopT >= 1) landFrog(f);
      else f.y = f.fromY + (f.toY - f.fromY) * f.hopT - Math.sin(f.hopT * Math.PI) * 30;
    }
  });
}

// --- Spielablauf ---
function resetStats() {
  STATS = {
    saved: 0,
    lost: 0,
    lostCar: 0,
    lostWater: 0,
    lostDrift: 0,
    lostCroc: 0,
    rasers: 0,
    stops: 0,
    chaos: 0,
    crocsWoken: 0,
    maxJam: 0,
    playTime: 0,
  };
}

function startGame(team) {
  teamMode = !!team;
  resetStats();
  score = 0;
  teamScore = [0, 0];
  teamSaved = [0, 0];
  pondFrogs = [];
  particles = [];
  ripples = [];
  floaters = [];
  playSound(soundStart, 0.8);
  startLevel(1);
}

function startLevel(lvl) {
  level = lvl;
  feat = levelFeatures(lvl);
  vehicles = [];
  riverObjs = [];
  frogs = [];
  savedThisLevel = 0;
  lostThisLevel = 0;
  jam = 0;
  raserWarn = null;
  frogSpawnTimer = 0.6;
  nextTeam = 0;
  roadLanes = SETTINGS.roadDirs.map((dir, i) => ({
    y: ROW_Y[i + 1],
    dir: dir,
    timer: rand(0.3, 2.2),
    pending: 0,
  }));
  riverLanes = SETTINGS.riverDirs.map((dir, i) => ({
    y: ROW_Y[i + 6],
    dir: dir,
    last: null,
    gap: 200,
  }));
  populateRiver();
  if (calm) calm.reset();
  gameState = 'play';
}

function finishLevel() {
  levelBonus = DIFFICULTY.scoreLevel * level;
  score += levelBonus;
  if (teamMode) {
    teamScore[0] += Math.round(levelBonus / 2);
    teamScore[1] += Math.round(levelBonus / 2);
  }
  gameState = 'levelup';
  levelUpTimer = DIFFICULTY.levelUpDuration;
  flash = 1;
  playSound(soundLevel, 0.8);
}

function endGame() {
  gameState = 'gameover';
  gameOverTimer = 0;
  highscore.addEntry({ punkte: score, level: level, gerettet: STATS.saved });
  playSound(soundSplat, 0.5);
  shake = 20;
}

function goToStart() {
  gameState = 'start';
  vehicles = [];
  riverObjs = [];
  frogs = [];
  initDecor();
}

// --- Zeichnen ---
function drawRiverWaves(ctx) {
  ctx.save();
  ctx.strokeStyle = C.wave;
  ctx.lineCap = 'round';
  riverLanes.forEach((lane, i) => {
    for (let k = 0; k < 2; k++) {
      const speed = (k ? 25 : 60) * lane.dir;
      ctx.globalAlpha = k ? 0.12 : 0.22;
      ctx.lineWidth = k ? 2 : 3;
      ctx.setLineDash(k ? [40, 70] : [70, 50]);
      ctx.lineDashOffset = -time * speed;
      for (let j = -1; j <= 1; j += 2) {
        const yy = lane.y + j * 34 + k * 14;
        ctx.beginPath();
        for (let x = 0; x <= W; x += 48) {
          const y = yy + Math.sin((x - time * speed) * 0.012 + i + k * 2) * (k ? 4 : 7);
          if (x === 0) ctx.moveTo(x, y);
          else ctx.lineTo(x, y);
        }
        ctx.stroke();
      }
    }
  });
  ctx.restore();
}

function drawRoadMarkings(ctx) {
  ctx.save();
  ctx.strokeStyle = C.roadLine;
  ctx.lineWidth = 6;
  ctx.setLineDash([55, 45]);
  for (let i = 1; i < 4; i++) {
    const y = SETTINGS.roadTop + i * SETTINGS.roadLaneH;
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(W, y);
    ctx.stroke();
  }
  ctx.setLineDash([]);
  // wandernde Pfeile zeigen die Fahrtrichtung (sehr dunkel, liegt im Aktionsbereich)
  ctx.globalAlpha = 0.14;
  ctx.lineWidth = 5;
  roadLanes.forEach((lane) => {
    const off = (((time * 45 * lane.dir) % 320) + 320) % 320;
    for (let x = off - 320; x < W + 320; x += 320) {
      ctx.beginPath();
      ctx.moveTo(x - 12 * lane.dir, lane.y - 16);
      ctx.lineTo(x + 6 * lane.dir, lane.y);
      ctx.lineTo(x - 12 * lane.dir, lane.y + 16);
      ctx.stroke();
    }
  });
  ctx.globalAlpha = 1;
  if (teamMode) {
    // Mittellinie und Teamfarben am Straßenrand
    ctx.strokeStyle = C.roadEdge;
    ctx.globalAlpha = 0.5;
    ctx.lineWidth = 4;
    ctx.setLineDash([20, 20]);
    ctx.beginPath();
    ctx.moveTo(W / 2, SETTINGS.roadTop);
    ctx.lineTo(W / 2, SETTINGS.roadBottom);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.globalAlpha = 0.8;
    ctx.lineWidth = 8;
    for (let t = 0; t < 2; t++) {
      ctx.strokeStyle = C.team[t];
      ctx.beginPath();
      ctx.moveTo(t * (W / 2) + 10, SETTINGS.roadBottom + 6);
      ctx.lineTo((t + 1) * (W / 2) - 10, SETTINGS.roadBottom + 6);
      ctx.moveTo(t * (W / 2) + 10, SETTINGS.roadTop - 2);
      ctx.lineTo((t + 1) * (W / 2) - 10, SETTINGS.roadTop - 2);
      ctx.stroke();
    }
  }
  ctx.restore();
}

function vehicleAlpha(v) {
  if (!feat || !feat.fog || gameState !== 'play') return 1;
  const d = v.dir > 0 ? v.x + v.len / 2 : W - (v.x - v.len / 2);
  return clamp((d - DIFFICULTY.fogStart) / DIFFICULTY.fogDepth, 0.06, 1);
}

function drawVehicle(ctx, v) {
  const hl = v.len / 2;
  const hh = v.h / 2;
  const effect = v.value / 100;
  const stopped = v.value >= 95 && !v.foreign;
  ctx.save();
  ctx.globalAlpha = vehicleAlpha(v);
  ctx.translate(v.x, v.y);
  if (v.dir < 0) ctx.scale(-1, 1);
  const base = ctx.globalAlpha;

  // dezenter Scheinwerferkegel
  if (!stopped) {
    ctx.globalAlpha = base * (feat && feat.fog ? 0.09 : 0.05);
    ctx.fillStyle = C.beam;
    ctx.beginPath();
    ctx.moveTo(hl, -hh * 0.5);
    ctx.lineTo(hl + 230, -hh - 8);
    ctx.lineTo(hl + 230, hh + 8);
    ctx.lineTo(hl, hh * 0.5);
    ctx.closePath();
    ctx.fill();
    ctx.globalAlpha = base;
  }

  // Räder
  ctx.fillStyle = C.tire;
  ctx.strokeStyle = v.rimCol;
  ctx.lineWidth = 2;
  const wheelX = v.kind === 'truck' ? [-hl + 30, -hl + 90, hl - 50] : [-hl + 26, hl - 58];
  wheelX.forEach((wx) => {
    [-hh - 6, hh - 4].forEach((wy) => {
      ctx.fillRect(wx, wy, 34, 10);
      ctx.strokeRect(wx, wy, 34, 10);
    });
  });

  const rim = stopped ? C.police : v.foreign && effect > 0.05 ? C.warn : v.rimCol;
  ctx.fillStyle = v.bodyCol;
  ctx.strokeStyle = rim;
  ctx.lineWidth = 4;
  if (v.kind === 'truck') {
    // Auflieger
    roundRectPath(ctx, -hl, -hh + 4, v.len - 82, v.h - 8, 8);
    ctx.fill();
    ctx.stroke();
    ctx.globalAlpha = base * 0.45;
    ctx.lineWidth = 2;
    for (let x = -hl + 36; x < hl - 90; x += 36) {
      ctx.beginPath();
      ctx.moveTo(x, -hh + 10);
      ctx.lineTo(x, hh - 10);
      ctx.stroke();
    }
    ctx.globalAlpha = base;
    // Fahrerhaus
    ctx.lineWidth = 4;
    roundRectPath(ctx, hl - 74, -hh, 74, v.h, 14);
    ctx.fill();
    ctx.stroke();
    ctx.lineWidth = 3;
    roundRectPath(ctx, hl - 30, -hh + 10, 20, v.h - 20, 6);
    ctx.stroke();
  } else if (v.kind === 'raser') {
    ctx.beginPath();
    ctx.moveTo(-hl, -hh);
    ctx.lineTo(hl - 50, -hh);
    ctx.lineTo(hl, -hh * 0.3);
    ctx.lineTo(hl, hh * 0.3);
    ctx.lineTo(hl - 50, hh);
    ctx.lineTo(-hl, hh);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    ctx.lineWidth = 6;
    ctx.beginPath();
    ctx.moveTo(-hl + 10, -8);
    ctx.lineTo(hl - 30, -8);
    ctx.moveTo(-hl + 10, 8);
    ctx.lineTo(hl - 30, 8);
    ctx.stroke();
    // Flammen am Heck (klein, Glow nur am Rand)
    ctx.globalCompositeOperation = 'lighter';
    ctx.fillStyle = C.warn;
    for (let k = -1; k <= 1; k += 2) {
      const fl = 30 + Math.sin(time * 40 + k) * 12;
      ctx.beginPath();
      ctx.moveTo(-hl, k * 18 - 8);
      ctx.lineTo(-hl - fl, k * 18);
      ctx.lineTo(-hl, k * 18 + 8);
      ctx.closePath();
      ctx.fill();
    }
    ctx.globalCompositeOperation = 'source-over';
  } else {
    roundRectPath(ctx, -hl, -hh, v.len, v.h, 20);
    ctx.fill();
    ctx.stroke();
    ctx.lineWidth = 3;
    roundRectPath(ctx, hl - 64, -hh + 10, 26, v.h - 20, 8);
    ctx.stroke();
    roundRectPath(ctx, -hl + 20, -hh + 12, 20, v.h - 24, 6);
    ctx.stroke();
    ctx.globalAlpha = base * 0.5;
    roundRectPath(ctx, -hl + 50, -hh + 14, v.len - 122, v.h - 28, 10);
    ctx.stroke();
    ctx.globalAlpha = base;
  }

  // Scheinwerfer und Bremslichter (klein)
  ctx.fillStyle = C.light;
  ctx.fillRect(hl - 8, -hh + 8, 6, 12);
  ctx.fillRect(hl - 8, hh - 20, 6, 12);
  if (effect > 0.05 && !v.foreign) {
    ctx.globalAlpha = base * clamp(0.3 + effect, 0, 1);
    ctx.fillStyle = C.brake;
    ctx.fillRect(-hl + 2, -hh + 8, 6, 14);
    ctx.fillRect(-hl + 2, hh - 22, 6, 14);
    ctx.globalAlpha = base;
  }
  // Vollgas-Streifen (Teammodus)
  if (v.foreign && effect > 0.05) {
    ctx.strokeStyle = C.warn;
    ctx.lineWidth = 3;
    for (let k = -1; k <= 1; k++) {
      const len = 40 + Math.random() * 50 * effect;
      ctx.beginPath();
      ctx.moveTo(-hl - 10, k * 22);
      ctx.lineTo(-hl - 10 - len, k * 22);
      ctx.stroke();
    }
  }
  // Füllanzeige als Linie unter dem Fahrzeug
  if (v.value > 1) {
    ctx.strokeStyle = v.foreign ? C.warn : C.police;
    ctx.lineWidth = 6;
    ctx.beginPath();
    ctx.moveTo(-hl, hh + 10);
    ctx.lineTo(-hl + v.len * effect, hh + 10);
    ctx.stroke();
  }
  ctx.restore();

  // Halt-Schild (ungespiegelt, damit Text lesbar ist)
  if (stopped) {
    ctx.save();
    ctx.globalAlpha = vehicleAlpha(v);
    util.drawNgon({ ctx, numberOfSides: 8, size: 24, Xcenter: v.x, Ycenter: v.y, lineWidth: 4, color: C.police, angle: Math.PI / 8 });
    util.renderText({ ctx, text: 'HALT', x: v.x, y: v.y + 6, fontSize: '15px', fillStyle: C.police });
    ctx.restore();
  }
}

function drawRiverObject(ctx, o) {
  const hl = o.len / 2;
  const hh = o.h / 2;
  ctx.save();
  ctx.translate(o.x, o.y);
  if (o.dir < 0) ctx.scale(-1, 1);
  // Bugwelle
  ctx.strokeStyle = C.wave;
  ctx.globalAlpha = 0.3;
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.arc(hl - 6, 0, hh + 6, -Math.PI / 2.4, Math.PI / 2.4);
  ctx.stroke();
  ctx.globalAlpha = 1;

  if (o.kind === 'log') {
    ctx.fillStyle = C.log;
    ctx.strokeStyle = C.logRim;
    ctx.lineWidth = 4;
    roundRectPath(ctx, -hl, -hh, o.len, o.h, hh * 0.8);
    ctx.fill();
    ctx.stroke();
    // Rinde
    ctx.globalAlpha = 0.45;
    ctx.lineWidth = 2;
    for (let k = -1; k <= 1; k++) {
      ctx.beginPath();
      for (let x = -hl + 30; x <= hl - 30; x += 20) {
        const y = k * hh * 0.42 + Math.sin(x * 0.07 + o.seed + k) * 4;
        if (x === -hl + 30) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.stroke();
    }
    ctx.globalAlpha = 1;
    // Jahresringe vorne
    ctx.strokeStyle = C.logRing;
    ctx.lineWidth = 3;
    for (let r = 1; r <= 3; r++) {
      ctx.beginPath();
      ctx.ellipse(hl - 14, 0, 4 * r, (hh - 6) * (r / 3), 0, 0, Math.PI * 2);
      ctx.stroke();
    }
  } else {
    const awake = o.awake > 0;
    ctx.fillStyle = C.croc;
    ctx.strokeStyle = awake ? C.warn : C.crocRim;
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.moveTo(-hl, 0);
    ctx.lineTo(-hl + 70, -hh * 0.6);
    ctx.lineTo(hl - 90, -hh);
    ctx.quadraticCurveTo(hl - 40, -hh * 0.75, hl - 30, -hh * 0.35);
    ctx.lineTo(hl, -hh * 0.22);
    ctx.lineTo(hl, hh * 0.22);
    ctx.lineTo(hl - 30, hh * 0.35);
    ctx.quadraticCurveTo(hl - 40, hh * 0.75, hl - 90, hh);
    ctx.lineTo(-hl + 70, hh * 0.6);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    // Höcker (getarnt als Rinde)
    ctx.globalAlpha = 0.45;
    ctx.lineWidth = 2;
    ctx.beginPath();
    let up = true;
    for (let x = -hl + 70; x <= hl - 100; x += 18) {
      const y = up ? -7 : 7;
      if (x === -hl + 70) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
      up = !up;
    }
    ctx.stroke();
    ctx.globalAlpha = 1;
    // falscher Jahresring hinten – Tarnung
    ctx.strokeStyle = C.logRing;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.ellipse(-hl + 40, 0, 6, hh * 0.4, 0, 0, Math.PI * 2);
    ctx.stroke();
    // Maul
    if (awake) {
      const jaw = 0.5 + 0.5 * Math.abs(Math.sin(time * 12));
      ctx.fillStyle = '#000000';
      ctx.strokeStyle = C.warn;
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(hl - 70, 0);
      ctx.lineTo(hl + 30, -34 * jaw);
      ctx.lineTo(hl + 30, 34 * jaw);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
    }
    // Augen: blinzeln selten, wach leuchten sie
    if (awake || o.eyesOpen > 0) {
      ctx.fillStyle = C.crocEye;
      ctx.globalAlpha = awake ? 1 : 0.7;
      [-1, 1].forEach((s) => {
        ctx.beginPath();
        ctx.arc(hl - 78, s * hh * 0.5, awake ? 7 : 4, 0, Math.PI * 2);
        ctx.fill();
      });
      ctx.globalAlpha = 1;
    }
  }
  // Füllanzeige
  if (o.value > 1) {
    ctx.strokeStyle = o.kind === 'croc' ? C.warn : C.police;
    ctx.lineWidth = 5;
    ctx.beginPath();
    ctx.moveTo(-hl, hh + 8);
    ctx.lineTo(-hl + o.len * (o.value / 100), hh + 8);
    ctx.stroke();
  }
  ctx.restore();
}

function drawFrogShape(ctx, x, y, scale, hopT, body, rim, look) {
  const stretch = hopT > 0 ? Math.sin(hopT * Math.PI) : 0;
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(scale, scale);
  // Schatten
  ctx.globalAlpha = 0.35;
  ctx.fillStyle = '#000000';
  ctx.beginPath();
  ctx.ellipse(0, 30 + stretch * 26, 32, 12, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.globalAlpha = 1;
  // Beine
  ctx.strokeStyle = rim;
  ctx.lineWidth = 8;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  [-1, 1].forEach((s) => {
    ctx.beginPath();
    ctx.moveTo(s * 18, 14);
    ctx.lineTo(s * (36 + stretch * 4), 26 + stretch * 16);
    ctx.lineTo(s * 24, 40 + stretch * 22);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(s * 14, -10);
    ctx.lineTo(s * 30, -22 - stretch * 10);
    ctx.stroke();
  });
  // Körper
  ctx.fillStyle = body;
  ctx.lineWidth = 4;
  ctx.beginPath();
  ctx.ellipse(0, 4, 28, 34, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();
  // Augen
  [-1, 1].forEach((s) => {
    ctx.fillStyle = C.eye;
    ctx.beginPath();
    ctx.arc(s * 14, -26, 10, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = C.pupil;
    ctx.beginPath();
    ctx.arc(s * 14 + look * 3, -28, 5, 0, Math.PI * 2);
    ctx.fill();
  });
  ctx.restore();
}

function drawFrog(ctx, f) {
  const spawnScale = clamp(f.age * 4, 0, 1);
  const hopScale = f.state === 'hop' ? 1 + 0.22 * Math.sin(f.hopT * Math.PI) : 1;
  const breathe = f.state === 'sit' ? 1 + Math.sin(time * 5 + f.x) * 0.03 : 1;
  // Countdown-Ring bis zum nächsten Hüpfer
  if (f.state === 'sit' && f.waitMax > 0) {
    const p = clamp(f.wait / f.waitMax, 0, 1);
    ctx.save();
    ctx.strokeStyle = f.rim;
    ctx.globalAlpha = 0.5;
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.arc(f.x, f.y, DIFFICULTY.frogRadius + 8, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * p);
    ctx.stroke();
    ctx.restore();
  }
  drawFrogShape(ctx, f.x, f.y, spawnScale * hopScale * breathe, f.state === 'hop' ? f.hopT : 0, f.body, f.rim, f.look);
}

function drawPondFrogs(ctx, dt) {
  pondFrogs.slice().forEach((p) => {
    p.t += dt;
    if (p.t > 8) {
      removeItemFromArray(pondFrogs, p);
      return;
    }
    const a = p.t > 7 ? 8 - p.t : 1;
    const hop = Math.max(0, Math.sin(p.t * 3 + p.x)) * 8;
    ctx.save();
    ctx.globalAlpha = clamp(a, 0, 1);
    drawFrogShape(ctx, p.x, ROW_Y[9] - hop, 0.6, 0, p.body, p.rim, Math.sin(p.t));
    ctx.restore();
  });
}

function drawFog(ctx) {
  if (!feat || !feat.fog) return;
  ctx.save();
  for (let s = 0; s < 2; s++) {
    const x0 = s === 0 ? 0 : W;
    const x1 = s === 0 ? DIFFICULTY.fogStart + DIFFICULTY.fogDepth : W - DIFFICULTY.fogStart - DIFFICULTY.fogDepth;
    const grad = ctx.createLinearGradient(x0, 0, x1, 0);
    grad.addColorStop(0, C.fog);
    grad.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.globalAlpha = 0.16 + Math.sin(time * 0.7 + s) * 0.03;
    ctx.fillStyle = grad;
    ctx.fillRect(Math.min(x0, x1), SETTINGS.roadTop, Math.abs(x1 - x0), SETTINGS.roadBottom - SETTINGS.roadTop);
  }
  // treibende Schwaden
  ctx.fillStyle = C.fog;
  for (let i = 0; i < 6; i++) {
    const x = ((time * (20 + i * 6) + i * 340) % (W + 400)) - 200;
    const y = SETTINGS.roadTop + 40 + ((i * 97) % 340);
    ctx.globalAlpha = 0.04;
    ctx.beginPath();
    ctx.ellipse(x, y, 220, 50, 0, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
}

function drawRaserWarning(ctx) {
  if (!raserWarn) return;
  const lane = roadLanes[raserWarn.lane];
  if (!lane) return;
  if (Math.sin(time * 25) < 0) return;
  const x = lane.dir > 0 ? 70 : W - 70;
  ctx.save();
  ctx.strokeStyle = C.warn;
  ctx.lineWidth = 8;
  for (let k = 0; k < 3; k++) {
    const xx = x + lane.dir * k * 40;
    ctx.beginPath();
    ctx.moveTo(xx - 18 * lane.dir, lane.y - 30);
    ctx.lineTo(xx + 12 * lane.dir, lane.y);
    ctx.lineTo(xx - 18 * lane.dir, lane.y + 30);
    ctx.stroke();
  }
  ctx.restore();
}

function updateAndDrawParticles(ctx, dt) {
  ctx.save();
  particles.slice().forEach((p) => {
    p.life -= dt;
    if (p.life <= 0) {
      removeItemFromArray(particles, p);
      return;
    }
    p.vy += p.grav * dt;
    p.x += p.vx * dt;
    p.y += p.vy * dt;
    p.vx *= 0.98;
    ctx.globalCompositeOperation = p.glow ? 'lighter' : 'source-over';
    ctx.globalAlpha = clamp(p.life / p.maxLife, 0, 1);
    ctx.fillStyle = p.color;
    ctx.beginPath();
    ctx.arc(p.x, p.y, p.size * (0.4 + 0.6 * (p.life / p.maxLife)), 0, Math.PI * 2);
    ctx.fill();
  });
  ctx.globalCompositeOperation = 'source-over';
  ctx.strokeStyle = C.wave;
  ctx.lineWidth = 3;
  ripples.slice().forEach((r) => {
    r.t += dt;
    if (r.t > 1.2) {
      removeItemFromArray(ripples, r);
      return;
    }
    ctx.globalAlpha = (1 - r.t / 1.2) * 0.6;
    ctx.beginPath();
    ctx.ellipse(r.x, r.y, 10 + r.t * 80, 4 + r.t * 26, 0, 0, Math.PI * 2);
    ctx.stroke();
  });
  ctx.restore();
}

function drawFloaters(ctx, dt) {
  floaters.slice().forEach((f) => {
    f.life -= dt;
    if (f.life <= 0) {
      removeItemFromArray(floaters, f);
      return;
    }
    f.y -= 60 * dt;
    ctx.save();
    ctx.globalAlpha = clamp(f.life / f.maxLife * 1.5, 0, 1);
    util.renderTextDropShadow({
      ctx,
      text: f.text,
      x: f.x,
      y: f.y,
      fontSize: f.size + 'px',
      fillStyle: f.color,
      dropDistX: 3,
      dropDistY: 3,
    });
    ctx.restore();
  });
}

function drawFlash(ctx, dt) {
  if (flash <= 0) return;
  flash = Math.max(0, flash - dt * 1.5);
  ctx.save();
  ctx.globalAlpha = flash * 0.3;
  ctx.fillStyle = C.spark;
  ctx.fillRect(0, 0, W, H);
  ctx.restore();
}

function drawHud(ctx) {
  // Stau-Meter
  const bx = W / 2 - 200;
  const by = 16;
  const bw = 400;
  const bh = 36;
  ctx.save();
  ctx.fillStyle = 'rgba(0,0,0,0.6)';
  ctx.fillRect(bx, by, bw, bh);
  const hot = jam > 70;
  ctx.fillStyle = hot ? C.jamHigh : C.jamLow;
  ctx.globalAlpha = hot ? 0.7 + 0.3 * Math.sin(time * 14) : 0.85;
  ctx.fillRect(bx, by, bw * (jam / 100), bh);
  ctx.globalAlpha = 1;
  ctx.strokeStyle = C.hud;
  ctx.lineWidth = 3;
  ctx.strokeRect(bx, by, bw, bh);
  ctx.restore();
  util.renderTextDropShadow({
    ctx,
    text: 'STAU',
    x: W / 2,
    y: by + 29,
    fontSize: '28px',
    fillStyle: C.text,
    dropDistX: 2,
    dropDistY: 2,
  });

  if (teamMode) {
    for (let t = 0; t < 2; t++) {
      util.renderTextDropShadow({
        ctx,
        text: (t === 0 ? 'TEAM LINKS ' : 'TEAM RECHTS ') + teamScore[t],
        x: t === 0 ? 30 : W - 30,
        y: 56,
        align: t === 0 ? 'left' : 'right',
        fontSize: '44px',
        fillStyle: C.team[t],
        dropDistX: 4,
        dropDistY: 4,
      });
    }
    util.renderTextDropShadow({
      ctx,
      text: 'Level ' + level + ' · ' + savedThisLevel + '/' + feat.target + ' gerettet · ' + lostThisLevel + '/' + feat.maxLost + ' verloren',
      x: W / 2,
      y: 90,
      fontSize: '30px',
      fillStyle: C.text,
      dropDistX: 3,
      dropDistY: 3,
    });
  } else {
    util.renderTextDropShadow({
      ctx,
      text: 'LEVEL ' + level + '   ' + score + ' Pkt',
      x: 30,
      y: 56,
      align: 'left',
      fontSize: '44px',
      fillStyle: C.hud,
      dropDistX: 4,
      dropDistY: 4,
    });
    util.renderTextDropShadow({
      ctx,
      text: savedThisLevel + '/' + feat.target + ' gerettet   ' + lostThisLevel + '/' + feat.maxLost + ' verloren',
      x: W - 30,
      y: 56,
      align: 'right',
      fontSize: '44px',
      fillStyle: lostThisLevel >= feat.maxLost - 1 ? C.warn : C.hud,
      dropDistX: 4,
      dropDistY: 4,
    });
  }
}

/** Komplette Spielszene (ohne HUD) */
function drawScene(ctx, dt) {
  ctx.drawImage(bgCanvas, 0, 0);
  drawRiverWaves(ctx);
  drawRoadMarkings(ctx);
  riverObjs.forEach((o) => drawRiverObject(ctx, o));
  vehicles.forEach((v) => drawVehicle(ctx, v));
  drawFog(ctx);
  drawRaserWarning(ctx);
  drawPondFrogs(ctx, dt);
  frogs.forEach((f) => drawFrog(ctx, f));
  updateAndDrawParticles(ctx, dt);
}

// --- Zustände ---
function handlePlay(grid, dt) {
  const ctx = MasterCanvas.get2dContext();
  time += dt;
  STATS.playTime += dt;
  whistleTimer -= dt;
  shake = Math.max(0, shake - dt * 40);

  calm.handle(grid, dt);
  updateRoad(grid, dt);
  updateRiver(grid, dt);
  updateFrogs(dt);

  ctx.save();
  if (shake > 0) ctx.translate(rand(-shake, shake), rand(-shake, shake));
  drawScene(ctx, dt);
  drawFloaters(ctx, dt);
  ctx.restore();
  drawHud(ctx);

  if (keyPressedOnce('KeyN')) {
    finishLevel();
    return;
  }
  if (lostThisLevel >= feat.maxLost) endGame();
  else if (savedThisLevel >= feat.target) finishLevel();
}

function handleLevelUp(grid, dt) {
  const ctx = MasterCanvas.get2dContext();
  time += dt;
  levelUpTimer -= dt;
  ctx.save();
  ctx.drawImage(bgCanvas, 0, 0);
  drawRiverWaves(ctx);
  drawRoadMarkings(ctx);
  drawPondFrogs(ctx, dt);
  // Feuerwerk aus dem Teich
  if (Math.random() < dt * 8) burst(rand(200, W - 200), rand(80, 400), C.spark, 14, 300, 120, true);
  updateAndDrawParticles(ctx, dt);
  ctx.fillStyle = 'rgba(0,0,0,0.4)';
  ctx.fillRect(0, 0, W, H);
  ctx.restore();
  drawFlash(ctx, dt);
  const zoom = 1 + Math.max(0, levelUpTimer - (DIFFICULTY.levelUpDuration - 0.4)) * 1.5;
  ctx.save();
  ctx.translate(W / 2, 470);
  ctx.scale(zoom, zoom);
  util.renderTextDropShadow({ ctx, text: 'LEVEL ' + (level + 1), x: 0, y: 0, fontSize: '190px', fillStyle: C.title });
  ctx.restore();
  util.renderTextDropShadow({
    ctx,
    text: LEVEL_NEWS[Math.min(level + 1, LEVEL_NEWS.length - 1)],
    x: W / 2,
    y: 600,
    fontSize: '56px',
    fillStyle: C.police,
    dropDistX: 5,
    dropDistY: 5,
  });
  util.renderTextDropShadow({
    ctx,
    text: 'Level-Bonus +' + levelBonus,
    x: W / 2,
    y: 690,
    fontSize: '44px',
    fillStyle: C.text,
    dropDistX: 4,
    dropDistY: 4,
  });
  drawFloaters(ctx, dt);
  if (levelUpTimer <= 0) startLevel(level + 1);
}

/** Dekoration für Titel- und Game-Over-Bildschirm (ohne Laser-Eingabe) */
function initDecor() {
  roadLanes = SETTINGS.roadDirs.map((dir, i) => ({ y: ROW_Y[i + 1], dir: dir, timer: 0, pending: 0 }));
  riverLanes = SETTINGS.riverDirs.map((dir, i) => ({ y: ROW_Y[i + 6], dir: dir, last: null, gap: 200 }));
  decor = { cars: [], logs: [], frogT: 0 };
  roadLanes.forEach((lane, i) => {
    for (let k = 0; k < 2; k++) {
      const v = {
        kind: i === 2 && k === 0 ? 'truck' : 'car',
        lane: i,
        dir: lane.dir,
        x: rand(0, W) + k * 900,
        y: lane.y,
        len: i === 2 && k === 0 ? DIFFICULTY.truckLength : 170,
        h: i === 2 && k === 0 ? 86 : 78,
        speed: 150 + i * 30,
        value: 0,
        owner: lane.dir > 0 ? 0 : 1,
        foreign: false,
      };
      setVehicleLook(v);
      decor.cars.push(v);
    }
  });
  riverLanes.forEach((lane, i) => {
    for (let k = 0; k < 3; k++) {
      decor.logs.push({
        kind: i === 1 && k === 1 ? 'croc' : 'log',
        lane: i,
        dir: lane.dir,
        x: k * 700 + rand(0, 200),
        y: lane.y,
        len: i === 1 && k === 1 ? DIFFICULTY.crocLength : rand(240, 400),
        h: 78,
        speed: 70 + i * 15,
        value: 0,
        awake: 0,
        eyesOpen: 0,
        blink: 2,
        seed: Math.random() * 100,
      });
    }
  });
}

function drawMenuBackdrop(ctx, dt) {
  time += dt;
  ctx.drawImage(bgCanvas, 0, 0);
  drawRiverWaves(ctx);
  drawRoadMarkings(ctx);
  decor.logs.forEach((o) => {
    o.x += o.dir * o.speed * dt;
    if (o.dir > 0 && o.x - o.len / 2 > W) o.x = -o.len / 2 - 200;
    if (o.dir < 0 && o.x + o.len / 2 < 0) o.x = W + o.len / 2 + 200;
    o.blink -= dt;
    if (o.eyesOpen > 0) o.eyesOpen -= dt;
    if (o.blink <= 0) {
      o.eyesOpen = 0.6;
      o.blink = rand(2, 4);
    }
    drawRiverObject(ctx, o);
  });
  decor.cars.forEach((v) => {
    v.x += v.dir * v.speed * dt;
    if (v.dir > 0 && v.x - v.len / 2 > W) v.x = -v.len / 2 - rand(50, 400);
    if (v.dir < 0 && v.x + v.len / 2 < 0) v.x = W + v.len / 2 + rand(50, 400);
    drawVehicle(ctx, v);
  });
  // Ein Demo-Frosch hüpft immer wieder nach oben
  decor.frogT += dt;
  const cycle = 0.9;
  const total = cycle * 9;
  const t = decor.frogT % (total + 1);
  const row = Math.min(8, Math.floor(t / cycle));
  const ft = clamp((t - row * cycle) / 0.38, 0, 1);
  const fy = ROW_Y[row] + (ROW_Y[row + 1] - ROW_Y[row]) * ft - Math.sin(ft * Math.PI) * 30;
  drawFrogShape(ctx, 1500, t > total ? ROW_Y[9] : fy, 1 + 0.2 * Math.sin(ft * Math.PI), ft < 1 ? ft : 0, col(0.38, 0.65, 0.5), col(0.38, 0.5, 0.9), 0);
  updateAndDrawParticles(ctx, dt);
  ctx.save();
  ctx.fillStyle = 'rgba(0,0,0,0.6)';
  ctx.fillRect(0, 0, W, H);
  ctx.restore();
}

function createMenuButton(x, y, onEnter) {
  return guiFillButton({
    label: '',
    posX: x,
    posY: y,
    radius: 120,
    speedUp: 45,
    speedDown: 30,
    edges: 8,
    angle: Math.PI / 8,
    lineWidth: 6,
    normalColor: C.btnNormal,
    growColor: C.btnGrow,
    activeColor: C.btnActive,
    onEnterActive: onEnter,
  });
}

function handleStart(grid, dt) {
  const ctx = MasterCanvas.get2dContext();
  drawMenuBackdrop(ctx, dt);
  const wob = 1 + Math.sin(time * 2.2) * 0.03;
  util.renderTextDropShadow({ ctx, text: 'LASER-', x: W / 2, y: 110, fontSize: '60px', fillStyle: C.police, dropDistX: 4, dropDistY: 4 });
  ctx.save();
  ctx.translate(W / 2, 240);
  ctx.scale(wob, wob);
  ctx.rotate(Math.sin(time * 1.3) * 0.02);
  util.renderTextDropShadow({ ctx, text: 'Froschpolizei', x: 0, y: 0, fontSize: '150px', fillStyle: C.title });
  ctx.restore();
  util.renderTextDropShadow({
    ctx,
    text:
      'Die Frösche hüpfen stur nach oben – IHR regelt den Verkehr!\n' +
      'Autos anleuchten = bremsen, voll = Stillstand\n' +
      'Baumstämme anleuchten = anhalten, damit die Frösche draufkommen\n' +
      'Aber: zu viel Stau ruft den RASER – und Krokodile schlafen lassen!',
    x: W / 2,
    y: 350,
    lineHeight: 62,
    fontSize: '42px',
    fillStyle: C.text,
    dropDistX: 4,
    dropDistY: 4,
  });
  startButton.handle(grid, dt);
  teamButton.handle(grid, dt);
  util.renderTextDropShadow({ ctx, text: 'START', x: 700, y: 990, fontSize: '54px', fillStyle: C.btnGrow, dropDistX: 4, dropDistY: 4 });
  util.renderTextDropShadow({ ctx, text: '2 TEAMS', x: 1220, y: 990, fontSize: '54px', fillStyle: C.btnGrow, dropDistX: 4, dropDistY: 4 });
  util.renderText({ ctx, text: 'Leertaste = Start · T = 2 Teams', x: W / 2, y: 1060, fontSize: '28px', fillStyle: C.hud });
  if (keyPressedOnce('Space')) startGame(false);
  else if (keyPressedOnce('KeyT')) startGame(true);
}

function handleGameOver(grid, dt) {
  const ctx = MasterCanvas.get2dContext();
  gameOverTimer += dt;
  shake = Math.max(0, shake - dt * 40);
  ctx.save();
  if (shake > 0) ctx.translate(rand(-shake, shake), rand(-shake, shake));
  drawMenuBackdrop(ctx, dt);
  ctx.restore();
  util.renderTextDropShadow({ ctx, text: 'Dienstschluss!', x: W / 2, y: 190, fontSize: '150px', fillStyle: C.title });
  let lines =
    'Level ' + level + ' erreicht · ' + score + ' Punkte · ' + STATS.saved + ' Frösche gerettet\n' +
    'Platt: ' + STATS.lostCar + ' · Ertrunken: ' + STATS.lostWater + ' · Abgetrieben: ' + STATS.lostDrift + ' · Gefressen: ' + STATS.lostCroc + '\n' +
    'Autos gestoppt: ' + STATS.stops + ' · Raser: ' + STATS.rasers + ' · Krokodile geweckt: ' + STATS.crocsWoken + ' · Wildleuchten: ' + STATS.chaos;
  if (teamMode) {
    const winner = teamScore[0] === teamScore[1] ? 'Unentschieden!' : teamScore[0] > teamScore[1] ? 'Team LINKS gewinnt!' : 'Team RECHTS gewinnt!';
    lines += '\nLINKS ' + teamScore[0] + ' : ' + teamScore[1] + ' RECHTS – ' + winner;
  }
  util.renderTextDropShadow({
    ctx,
    text: lines,
    x: W / 2,
    y: 300,
    lineHeight: 60,
    fontSize: '40px',
    fillStyle: C.text,
    dropDistX: 4,
    dropDistY: 4,
  });
  highscore.renderHighAndLowScores(ctx);
  if (gameOverTimer > DIFFICULTY.gameOverButtonDelay) {
    restartButton.handle(grid, dt);
    util.renderTextDropShadow({ ctx, text: 'ZUM START', x: W / 2, y: 975, fontSize: '50px', fillStyle: C.btnGrow, dropDistX: 4, dropDistY: 4 });
  }
  util.renderText({
    ctx,
    text: 'Leertaste = zurück zum Start (automatisch in ' + Math.max(0, Math.ceil(DIFFICULTY.gameOverAutoReturn - gameOverTimer)) + ' s)',
    x: W / 2,
    y: 1060,
    fontSize: '28px',
    fillStyle: C.hud,
  });
  if (keyPressedOnce('Space') || gameOverTimer > DIFFICULTY.gameOverAutoReturn) goToStart();
}

export default {
  name: 'Laser-Froschpolizei',
  description: `
Willkommen bei der Laser-Froschpolizei!

Die Frösche wollen in den Seerosenteich – und hüpfen stur nach oben,
egal was kommt. Ihr seid die Verkehrspolizei!

Leuchtet Autos an, um sie zu bremsen – mehr Laser, schneller Stillstand.
Haltet Baumstämme im Fluss an, damit die Frösche nicht ins Wasser springen.

Aber Vorsicht: Zu viel Stau ruft den RASER, und wildes Herumleuchten
macht den Stau noch schlimmer. Und manche Baumstämme haben Augen …
  `,
  image: 'media/img/gametitles/laser-cowhorde-###4###.png',
  init: function () {
    buildPalette();
    buildBackground();
    gameState = 'start';
    teamMode = false;
    time = 0;
    level = 1;
    feat = levelFeatures(1);
    score = 0;
    teamScore = [0, 0];
    teamSaved = [0, 0];
    savedThisLevel = 0;
    lostThisLevel = 0;
    jam = 0;
    shake = 0;
    flash = 0;
    whistleTimer = 0;
    raserWarn = null;
    vehicles = [];
    riverObjs = [];
    frogs = [];
    pondFrogs = [];
    particles = [];
    ripples = [];
    floaters = [];
    previousKeys = {};
    resetStats();
    initDecor();
    startButton = createMenuButton(700, 820, () => startGame(false));
    teamButton = createMenuButton(1220, 820, () => startGame(true));
    restartButton = createMenuButton(W / 2, 810, () => goToStart());
    calm = guiCalmMeter({
      posX: W / 2,
      posY: (SETTINGS.roadTop + SETTINGS.roadBottom) / 2,
      width: W,
      height: SETTINGS.roadBottom - SETTINGS.roadTop,
      chaosThreshold: 0.55,
      chaosHoldTime: 0.8,
      chaosKey: SETTINGS.chaosKey,
      visible: false,
      onChaos: () => {
        STATS.chaos++;
        jam = Math.min(100, jam + DIFFICULTY.jamChaosPenalty);
        whistle();
        addScore(-DIFFICULTY.penaltyChaos, W / 2, SETTINGS.roadTop + 160);
        addFloater(W / 2, SETTINGS.roadTop + 100, 'NICHT WILD LEUCHTEN!', C.warn, 60);
      },
    });
  },
  handle: function (grid, elapsed) {
    const dt = Math.min(elapsed || 0, 0.1);
    switch (gameState) {
      case 'start':
        handleStart(grid, dt);
        break;
      case 'play':
        handlePlay(grid, dt);
        break;
      case 'levelup':
        handleLevelUp(grid, dt);
        break;
      case 'gameover':
        handleGameOver(grid, dt);
        break;
    }
  },
  stop: function () {
    activeSounds.slice().forEach((a) => a.pause());
    activeSounds = [];
    vehicles = [];
    riverObjs = [];
    frogs = [];
    particles = [];
    ripples = [];
    floaters = [];
    pondFrogs = [];
  },
};
