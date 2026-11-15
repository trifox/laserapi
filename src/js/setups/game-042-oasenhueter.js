/**
 * Oasenhüter
 *
 * In einer Wüstenoase schlüpft ein kleiner Wüstendrache – das ganze Publikum pflegt ihn gemeinsam.
 * - Der Drache hat Bedürfnisse (Wasser, Schatten, Futter, Spielen), die alle gleichzeitig sinken.
 * - Jedes Bedürfnis wird über eine Station erfüllt (Brunnen, Sonnensegel, Dattelpalme), die man
 *   anleuchtet (gui/pixelFillButton): Je mehr Fläche bedeckt ist, desto schneller füllt sich die Station
 *   (gedeckelt über fullPercent). Ist sie voll, fliegt eine Portion zum Drachen.
 *   Ein Laser allein ist zu langsam – die Menge muss sich auf die Stationen aufteilen.
 * - Ein Ring um jede Station zeigt, wie voll das Bedürfnis ist. Bleibt ein Bedürfnis zu lange leer,
 *   geht ein Herz verloren. Keine Herzen mehr: Der Drache fliegt davon (Game Over).
 * - Level = Wachstumsstufe. Der Wachstumsbalken füllt sich nur, solange alle Bedürfnisse gut versorgt sind.
 *   Ist er voll, wächst der Drache (Ei → Baby → Junger Drache → Halbstarker → Großer Drache → Drachenkönig).
 * - Volle Bedürfnisse noch weiter zu füllen bringt nichts („satt!“) – lieber dort helfen, wo es fehlt.
 *
 * Neue Elemente:
 * - Level 2: Futter (Dattelpalme) und Schlafphasen. Schläft der Drache, darf ihn niemand anleuchten –
 *            sonst wacht er grantig auf: Punktabzug, Wachstum stockt, Bedürfnisse sinken schneller.
 * - Level 3: Spielen – der Ball folgt dem Laser (gui/followCircle) und muss zum Drachen gebracht werden.
 * - Level 4: Sandsturm – Dünen begraben Stationen, sie müssen erst freigeleuchtet werden.
 * - Level 5: Der Brunnen trocknet aus – erst die Brücke über das Wadi bauen (drei Planken anleuchten),
 *            dann Wasserkrüge von der Quelle über die Brücke zum Drachen führen. Neben der Brücke: Absturz.
 * - Level 6+: Runen-Rätsel – der Drache denkt an eine Folge von Runen, die in der richtigen Reihenfolge
 *             angeleuchtet werden muss. Falsche Rune = grantiger Drache. Danach wird alles schneller.
 *
 * Eingabe nur über GUI-Komponenten: gui/pixelFillButton (Stationen, Dünen, Planken, Runen, schlafender Drache),
 * gui/followCircle (Ball, Wasserkrug), gui/fillButton (Start).
 *
 * Tastatur-Test: Space = Start, 1 = Wasser, 2 = Futter, 3 = Schatten, 4 = Ball spielen,
 * S = Drache einschlafen lassen, W = schlafenden Drachen wecken (grantig), T = Sandsturm,
 * B = Brunnen trocknet aus, R = Rätsel starten, E = aktuelles Ereignis lösen, L = Level überspringen.
 *
 * Alle Stellschrauben stehen gesammelt in DIFFICULTY.
 */

import util, { getRgbSpreadHex, removeItemFromArray } from '../util.js';
var laserConfig = require('../LaserApiConfig.js').default;
var MasterCanvas = require('../MasterCanvas').default;
var guiFillButton = require('./gui/fillButton').default;
var guiPixelFillButton = require('./gui/pixelFillButton').default;
var guiFollowCircle = require('./gui/followCircle').default;
import soundPop from '../../../public/media/369952__mischy__plop-1.wav';
import soundSplash from '../../../public/media/485066__javierserrat__object-falls-into-the-water.wav';
import soundBoom from '../../../public/media/414346__bykgames__explosion-far.wav';
import soundLevel from '../../../public/media/opengameart/Level Up.ogg';
import soundGrumpy from '../../../public/media/517267__foolboymedia__cinematic-stomp.wav';
import soundWrong from '../../../public/media/opengameart/Menu Error.ogg';
import soundRiddle from '../../../public/media/opengameart/Ability Learn.ogg';
import soundBounce from '../../../public/media/bounce_523088_11537497-lq.mp3';
import soundGameOver from '../../../public/media/opengameart/Music Box Game Over III.wav';

const DIFFICULTY = {
  hearts: 5, // Leben
  // Bedürfnisse
  needDecayStart: 0.02, // Abfall pro Sekunde (1 = voll) im ersten Level
  needDecayFactor: 1.12, // pro Level multipliziert
  needDecayMax: 0.07,
  needStart: 0.7, // Startwert zu Levelbeginn (mindestens)
  goodThreshold: 0.3, // darüber gilt ein Bedürfnis als gut versorgt
  satedThreshold: 0.93, // darüber ist der Drache satt (Portion verpufft)
  emptyGrace: 8, // so lange darf ein Bedürfnis leer sein, dann geht ein Herz verloren
  needAfterHeartLoss: 0.4,
  // Stationen (pixelFillButton)
  stationRadius: 110,
  portionTime: 1.2, // Sekunden bis zur Portion bei voller Bedeckung
  fullPercent: 30, // ab diesem Flächenanteil volle Füllgeschwindigkeit (Teamwork, gedeckelt)
  stationSpeedDown: 25,
  portion: 0.2, // Bedürfnis-Zuwachs pro Portion
  // Wachstum
  levelTimeStart: 30, // Sekunden guter Pflege bis zur nächsten Stufe
  levelTimePerLevel: 5,
  growthPartial: 0.25, // Wachstumsfaktor, wenn ein Bedürfnis knapp (aber nicht leer) ist
  growthSleep: 1.25, // im Schlaf wachsen Drachen schneller
  // Futter / Schlaf
  foodLevel: 2,
  sleepLevel: 2,
  sleepIntervalStart: 26,
  sleepIntervalPerLevel: -1.5,
  sleepIntervalMin: 16,
  sleepDuration: 9,
  yawnTime: 2.5,
  sleepDecayFactor: 0.35, // Bedürfnisse sinken im Schlaf langsamer
  wakeFullPercent: 12, // Flächenanteil auf dem Drachen für volle Weck-Geschwindigkeit
  wakeTime: 1.5, // Sekunden bei voller Bedeckung bis er aufwacht
  grumpyTime: 6,
  grumpyDecayFactor: 1.5,
  // Ball
  playLevel: 3,
  playPortion: 0.4,
  ballRadius: 60,
  // Sandsturm
  stormLevel: 4,
  stormIntervalStart: 32,
  stormIntervalPerLevel: -2,
  stormIntervalMin: 20,
  stormDuration: 8,
  stormDecayFactor: 1.25,
  duneHp: 3, // so oft muss eine Düne voll angeleuchtet werden
  duneDigTime: 1.0,
  // Ausgetrockneter Brunnen
  wellLevel: 5,
  wellIntervalStart: 40,
  wellIntervalMin: 28,
  plankTime: 2.5,
  jugsNeeded: 2,
  jugWater: 0.45,
  // Rätsel
  riddleLevel: 6,
  riddleIntervalStart: 30,
  riddleIntervalMin: 22,
  riddleTime: 30,
  riddleLengthStart: 3,
  riddleLengthMax: 5,
  runeTime: 1.0,
  // Punkte
  scorePortion: 10,
  scoreBall: 40,
  scoreDune: 20,
  scorePlank: 20,
  scoreJug: 50,
  scoreWellFixed: 100,
  scoreRiddle: 150,
  scoreSleepWell: 30,
  scoreGrumpy: 50, // Abzug
  scoreLevel: 200, // * Level
  scoreGoodPerSecond: 2,
  maxParticles: 400,
};

const W = 1920;
const H = 1080;
const HUD_H = 130;
const DRAGON_HOME = { x: 860, y: 610 };
const DRAGON_R = 115; // Grundgröße (wird mit der Stufe skaliert)
const POND = { x: 880, y: 905, rx: 400, ry: 115 };
const WADI_X0 = 1450;
const WADI_X1 = 1690;
const BRIDGE_Y = 600;
const BRIDGE_HALF = 80;
const SPRING = { x: 1815, y: 600 };
const BALL_HOME = { x: 1250, y: 840 };
const STAGES = [
  { name: 'Drachen-Ei', scale: 0.8 },
  { name: 'Drachenbaby', scale: 0.7 },
  { name: 'Junger Drache', scale: 0.85 },
  { name: 'Halbstarker Drache', scale: 1.0 },
  { name: 'Großer Drache', scale: 1.15 },
  { name: 'Drachenkönig', scale: 1.3 },
];
const NEEDS = {
  water: { label: 'Wasser', decay: 1.15, level: 1 },
  shade: { label: 'Schatten', decay: 0.85, level: 1 },
  food: { label: 'Futter', decay: 1.0, level: DIFFICULTY.foodLevel },
  play: { label: 'Spielen', decay: 0.9, level: DIFFICULTY.playLevel },
};
const NEED_KEYS = { water: 'Digit1', food: 'Digit2', shade: 'Digit3', play: 'Digit4' };
const STATION_DEFS = [
  { need: 'water', name: 'Brunnen', x: 300, y: 340 },
  { need: 'shade', name: 'Sonnensegel', x: 1270, y: 340 },
  { need: 'food', name: 'Dattelpalme', x: 300, y: 810 },
];
// Runensteine liegen im Oasen-Teich
const RUNE_POS = [
  { x: 540, y: 975, edges: 3 },
  { x: 730, y: 1000, edges: 4 },
  { x: 920, y: 1000, edges: 5 },
  { x: 1100, y: 975, edges: 6 },
];

// --- Zustand ---
var gameState = 'start';
var level = 1;
var score = 0;
var hearts = DIFFICULTY.hearts;
var gameTime = 0;
var stateTime = 0;
var growth = 0;
var needs = {};
var stations = [];
var dragon = null;
var sleep = null; // { phase: 'awake'|'yawn'|'sleep', timer, button }
var grumpyLeft = 0;
var ball = null;
var ballCooldown = 0;
var storm = null; // { left }
var stormTimer = 0;
var well = null; // { planks: [...], jug, jugRespawn, delivered }
var wellTimer = 0;
var riddle = null; // { runes, seq, progress, left }
var riddleTimer = 0;
var flyers = [];
var particles = [];
var stormDust = [];
var floatingTexts = [];
var sparkles = [];
var shake = 0;
var flash = 0;
var levelText = '';
var gameOverReason = '';
var buttonsStart = [];
var buttonsGameOver = [];
var stats = { portions: 0, balls: 0, dunes: 0, jugs: 0, jugsLost: 0, riddles: 0, grumpy: 0, sleeps: 0, heartsLost: 0, time: 0 };
var previousKeys = {};
var lastTime = 0;
var activeSounds = [];
var sprites = {};

// --- Farben (alle aus testColor abgeleitet, nie die reine Laserfarbe) ---
var COL = {};
function updateColors() {
  const c = laserConfig.testColor;
  COL = {
    skyTop: getRgbSpreadHex(c, 0.58, 0.45, 0.75),
    skyBottom: getRgbSpreadHex(c, 0.1, 0.35, 1),
    sun: getRgbSpreadHex(c, 0.14, 0.6, 1),
    duneFar: getRgbSpreadHex(c, 0.08, 0.45, 0.85),
    duneMid: getRgbSpreadHex(c, 0.09, 0.5, 0.78),
    sand: getRgbSpreadHex(c, 0.11, 0.42, 0.9),
    sandDark: getRgbSpreadHex(c, 0.08, 0.55, 0.62),
    sandLight: getRgbSpreadHex(c, 0.12, 0.25, 1),
    rock: getRgbSpreadHex(c, 0.06, 0.45, 0.45),
    rockDark: getRgbSpreadHex(c, 0.05, 0.5, 0.25),
    water: getRgbSpreadHex(c, 0.53, 0.7, 0.75),
    waterDeep: getRgbSpreadHex(c, 0.58, 0.8, 0.45),
    waterLight: getRgbSpreadHex(c, 0.5, 0.35, 1),
    palm: getRgbSpreadHex(c, 0.3, 0.7, 0.6),
    palmDark: getRgbSpreadHex(c, 0.33, 0.75, 0.38),
    trunk: getRgbSpreadHex(c, 0.07, 0.55, 0.42),
    date: getRgbSpreadHex(c, 0.04, 0.75, 0.55),
    sail: getRgbSpreadHex(c, 0.62, 0.35, 0.95),
    sailDark: getRgbSpreadHex(c, 0.65, 0.5, 0.7),
    ball1: getRgbSpreadHex(c, 0.75, 0.6, 1),
    ball2: getRgbSpreadHex(c, 0.15, 0.2, 1),
    dragon: getRgbSpreadHex(c, 0.42, 0.6, 0.75),
    dragonDark: getRgbSpreadHex(c, 0.45, 0.7, 0.5),
    belly: getRgbSpreadHex(c, 0.15, 0.35, 1),
    wing: getRgbSpreadHex(c, 0.48, 0.5, 0.85),
    blush: getRgbSpreadHex(c, 0.9, 0.35, 1),
    egg: getRgbSpreadHex(c, 0.13, 0.2, 1),
    eggSpot: getRgbSpreadHex(c, 0.42, 0.55, 0.8),
    eye: getRgbSpreadHex(c, 0.6, 0.6, 0.15),
    rune: getRgbSpreadHex(c, 0.68, 0.55, 1),
    runeStone: getRgbSpreadHex(c, 0.07, 0.3, 0.55),
    good: getRgbSpreadHex(c, 0.33, 0.6, 0.95),
    warn: getRgbSpreadHex(c, 0.13, 0.85, 1),
    bad: getRgbSpreadHex(c, 0.88, 0.65, 1),
    text: getRgbSpreadHex(c, 0.12, 0.15, 1),
    textHi: getRgbSpreadHex(c, 0.14, 0.75, 1),
    shadow: getRgbSpreadHex(c, 0.07, 0.6, 0.18),
    night: getRgbSpreadHex(c, 0.65, 0.6, 0.2),
  };
  NEEDS.water.color = COL.water;
  NEEDS.shade.color = COL.sail;
  NEEDS.food.color = COL.date;
  NEEDS.play.color = COL.ball1;
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

function addFloatingText(text, x, y, color, size = 44) {
  floatingTexts.push({ text, x, y, color, size, time: 0, duration: 1.6 });
}

function burst(x, y, color, count = 16, speed = 300, gravity = 400, shape = 'square') {
  for (let i = 0; i < count && particles.length < DIFFICULTY.maxParticles; i++) {
    const a = Math.random() * Math.PI * 2;
    const s = speed * (0.3 + Math.random() * 0.7);
    particles.push({
      x,
      y,
      vx: Math.cos(a) * s,
      vy: Math.sin(a) * s - speed * 0.3,
      life: 0,
      maxLife: 0.5 + Math.random() * 0.7,
      size: 5 + Math.random() * 8,
      color,
      gravity,
      shape,
    });
  }
}

function dist(ax, ay, bx, by) {
  return Math.hypot(ax - bx, ay - by);
}

function clamp(v, a, b) {
  return Math.max(a, Math.min(b, v));
}

function makeCanvas(w, h) {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  return c;
}

function seededRandom(seed) {
  let s = seed;
  return () => {
    s = (s * 9301 + 49297) % 233280;
    return s / 233280;
  };
}

function stage() {
  return Math.min(STAGES.length - 1, level - 1);
}

function dragonRadius() {
  return DRAGON_R * dragon.scale;
}

function needActive(key) {
  return level >= NEEDS[key].level;
}

function activeNeedKeys() {
  return Object.keys(NEEDS).filter(needActive);
}

function needDecay() {
  return Math.min(DIFFICULTY.needDecayMax, DIFFICULTY.needDecayStart * Math.pow(DIFFICULTY.needDecayFactor, level - 1));
}

function lowestNeed() {
  let best = null;
  activeNeedKeys().forEach((k) => {
    if (!best || needs[k].value < needs[best].value) best = k;
  });
  return best;
}

function stationOf(need) {
  return stations.find((s) => s.need === need);
}

// --- Vorrendern ---
function renderBackground() {
  const c = makeCanvas(W, H);
  const ctx = c.getContext('2d');
  const rnd = seededRandom(11);
  // Himmel
  const sky = ctx.createLinearGradient(0, 0, 0, 330);
  sky.addColorStop(0, COL.skyTop);
  sky.addColorStop(1, COL.skyBottom);
  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, W, 340);
  // Dünen in Schichten
  const dune = (color, base, amp, freq, phase) => {
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.moveTo(0, H);
    for (let x = 0; x <= W; x += 20) {
      ctx.lineTo(x, base - amp * Math.abs(Math.sin(x * freq + phase)) - amp * 0.3 * Math.sin(x * freq * 2.7 + phase));
    }
    ctx.lineTo(W, H);
    ctx.closePath();
    ctx.fill();
  };
  dune(COL.duneFar, 300, 70, 0.0035, 0.4);
  dune(COL.duneMid, 360, 60, 0.005, 1.7);
  // Sandboden
  const ground = ctx.createLinearGradient(0, 360, 0, H);
  ground.addColorStop(0, COL.sand);
  ground.addColorStop(1, COL.sandDark);
  ctx.fillStyle = ground;
  ctx.fillRect(0, 380, W, H - 380);
  ctx.beginPath();
  ctx.moveTo(0, 400);
  for (let x = 0; x <= W; x += 20) ctx.lineTo(x, 385 + 20 * Math.sin(x * 0.004 + 2));
  ctx.lineTo(W, 420);
  ctx.closePath();
  ctx.fill();
  // Windrippel
  ctx.strokeStyle = COL.sandLight;
  ctx.globalAlpha = 0.35;
  ctx.lineWidth = 3;
  for (let i = 0; i < 70; i++) {
    const x = rnd() * W;
    const y = 420 + rnd() * (H - 440);
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.quadraticCurveTo(x + 40, y - 10, x + 90, y);
    ctx.stroke();
  }
  ctx.globalAlpha = 1;
  for (let i = 0; i < 2500; i++) {
    ctx.fillStyle = rnd() < 0.5 ? COL.sandDark : COL.sandLight;
    ctx.globalAlpha = 0.2;
    ctx.fillRect(rnd() * W, 360 + rnd() * (H - 360), 3, 3);
  }
  ctx.globalAlpha = 1;
  // Wadi (ausgetrocknetes Flussbett / Schlucht)
  const wadi = ctx.createLinearGradient(WADI_X0, 0, WADI_X1, 0);
  wadi.addColorStop(0, COL.rockDark);
  wadi.addColorStop(0.5, COL.shadow);
  wadi.addColorStop(1, COL.rockDark);
  ctx.fillStyle = wadi;
  ctx.beginPath();
  ctx.moveTo(WADI_X0, 330);
  for (let y = 330; y <= H; y += 30) ctx.lineTo(WADI_X0 + 12 * Math.sin(y * 0.03), y);
  ctx.lineTo(WADI_X1, H);
  for (let y = H; y >= 330; y -= 30) ctx.lineTo(WADI_X1 + 12 * Math.sin(y * 0.025 + 1), y);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = COL.rock;
  for (let i = 0; i < 30; i++) {
    const y = 340 + rnd() * (H - 340);
    const side = rnd() < 0.5 ? WADI_X0 : WADI_X1;
    ctx.beginPath();
    ctx.ellipse(side + (rnd() - 0.5) * 30, y, 14 + rnd() * 16, 8 + rnd() * 8, 0, 0, Math.PI * 2);
    ctx.fill();
  }
  // alte Brückenpfosten
  ctx.fillStyle = COL.trunk;
  [BRIDGE_Y - BRIDGE_HALF, BRIDGE_Y + BRIDGE_HALF].forEach((y) => {
    ctx.fillRect(WADI_X0 - 18, y - 30, 14, 40);
    ctx.fillRect(WADI_X1 + 4, y - 30, 14, 40);
  });
  // Quelle hinter dem Wadi
  ctx.fillStyle = COL.rock;
  ctx.beginPath();
  ctx.ellipse(SPRING.x, SPRING.y + 30, 95, 55, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = COL.water;
  ctx.beginPath();
  ctx.ellipse(SPRING.x, SPRING.y + 25, 70, 35, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = COL.waterLight;
  ctx.globalAlpha = 0.5;
  ctx.beginPath();
  ctx.ellipse(SPRING.x - 15, SPRING.y + 18, 35, 12, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.globalAlpha = 1;
  drawPalm(ctx, SPRING.x + 40, SPRING.y - 10, 0.7, rnd);
  // Oasen-Teich
  ctx.fillStyle = COL.palm;
  ctx.beginPath();
  ctx.ellipse(POND.x, POND.y, POND.rx + 40, POND.ry + 30, 0, 0, Math.PI * 2);
  ctx.fill();
  return c
  const pond = ctx.createRadialGradient(POND.x, POND.y, 20, POND.x, POND.y, POND.rx);
  pond.addColorStop(0, COL.waterDeep);
  pond.addColorStop(1, COL.water);
  ctx.fillStyle = pond;
  ctx.beginPath();
  ctx.ellipse(POND.x, POND.y, POND.rx, POND.ry, 0, 0, Math.PI * 2);
  ctx.fill();
  // Schilf und Palmen um den Teich
  ctx.strokeStyle = COL.palmDark;
  ctx.lineWidth = 5;
  for (let i = 0; i < 40; i++) {
    const a = rnd() * Math.PI * 2;
    const x = POND.x + Math.cos(a) * (POND.rx + 15);
    const y = POND.y + Math.sin(a) * (POND.ry + 12);
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.quadraticCurveTo(x + 10, y - 30, x + (rnd() - 0.5) * 30, y - 45 - rnd() * 25);
    ctx.stroke();
  }
  drawPalm(ctx, POND.x - POND.rx + 30, POND.y - 60, 1.1, rnd);
  drawPalm(ctx, POND.x + POND.rx - 20, POND.y - 50, 1.0, rnd);
  drawPalm(ctx, 90, 560, 0.8, rnd);
  // Kakteen und Steine
  for (let i = 0; i < 6; i++) {
    const x = [560, 1120, 140, 1380, 620, 1780][i];
    const y = [470, 500, 1000, 1000, 1040, 960][i];
    drawCactus(ctx, x, y, 0.6 + rnd() * 0.4);
  }
  return c;
}

function drawPalm(ctx, x, y, s, rnd) {
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(s, s);
  ctx.strokeStyle = COL.trunk;
  ctx.lineWidth = 22;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(0, 60);
  ctx.quadraticCurveTo(-20, -60, 10, -170);
  ctx.stroke();
  ctx.strokeStyle = COL.sandDark;
  ctx.lineWidth = 3;
  for (let k = 0; k < 9; k++) {
    const t = k / 9;
    const px = -12 * Math.sin(t * Math.PI) + t * 10;
    const py = 60 - t * 230;
    ctx.beginPath();
    ctx.moveTo(px - 10, py);
    ctx.lineTo(px + 10, py - 6);
    ctx.stroke();
  }
  for (let k = 0; k < 7; k++) {
    const a = -Math.PI / 2 + (k - 3) * 0.5 + (rnd ? (rnd() - 0.5) * 0.2 : 0);
    const len = 120;
    ctx.fillStyle = k % 2 ? COL.palm : COL.palmDark;
    ctx.beginPath();
    ctx.moveTo(10, -170);
    ctx.quadraticCurveTo(10 + Math.cos(a - 0.3) * len * 0.7, -170 + Math.sin(a - 0.3) * len * 0.7 - 30, 10 + Math.cos(a) * len, -170 + Math.sin(a) * len + 50);
    ctx.quadraticCurveTo(10 + Math.cos(a + 0.3) * len * 0.5, -170 + Math.sin(a + 0.3) * len * 0.5 - 10, 10, -170);
    ctx.fill();
  }
  ctx.restore();
}

function drawCactus(ctx, x, y, s) {
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(s, s);
  ctx.fillStyle = COL.palmDark;
  ctx.lineCap = 'round';
  ctx.strokeStyle = COL.palmDark;
  ctx.lineWidth = 26;
  ctx.beginPath();
  ctx.moveTo(0, 0);
  ctx.lineTo(0, -110);
  ctx.moveTo(0, -50);
  ctx.lineTo(-35, -50);
  ctx.lineTo(-35, -85);
  ctx.moveTo(0, -65);
  ctx.lineTo(32, -65);
  ctx.lineTo(32, -95);
  ctx.stroke();
  ctx.restore();
}

function renderStationSprite(type) {
  const c = makeCanvas(260, 300);
  const ctx = c.getContext('2d');
  ctx.translate(130, 170);
  if (type === 'water') {
    // Brunnen: Steinring, Dach, Eimer
    ctx.fillStyle = COL.rock;
    ctx.beginPath();
    ctx.ellipse(0, 40, 80, 32, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillRect(-80, -10, 160, 50);
    ctx.fillStyle = COL.rockDark;
    for (let i = -3; i <= 3; i++) ctx.fillRect(i * 22 - 9, -6, 18, 14);
    ctx.fillStyle = COL.waterDeep;
    ctx.beginPath();
    ctx.ellipse(0, -10, 70, 22, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = COL.trunk;
    ctx.fillRect(-78, -120, 12, 115);
    ctx.fillRect(66, -120, 12, 115);
    ctx.beginPath();
    ctx.moveTo(-100, -110);
    ctx.lineTo(0, -160);
    ctx.lineTo(100, -110);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = COL.sandLight;
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(0, -110);
    ctx.lineTo(0, -50);
    ctx.stroke();
    ctx.fillStyle = COL.sandDark;
    ctx.fillRect(-16, -55, 32, 28);
  } else if (type === 'shade') {
    // Sonnensegel: zwei Pfosten, gespanntes Tuch, Schatten
    ctx.fillStyle = COL.shadow;
    ctx.globalAlpha = 0.35;
    ctx.beginPath();
    ctx.ellipse(10, 70, 110, 28, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = 1;
    ctx.fillStyle = COL.trunk;
    ctx.fillRect(-95, -100, 12, 175);
    ctx.fillRect(85, -70, 12, 145);
    ctx.fillStyle = COL.sail;
    ctx.beginPath();
    ctx.moveTo(-95, -100);
    ctx.quadraticCurveTo(0, -60, 97, -70);
    ctx.lineTo(60, -10);
    ctx.quadraticCurveTo(-20, -30, -100, -30);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = COL.sailDark;
    ctx.lineWidth = 4;
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(-60, -85);
    ctx.lineTo(-50, -30);
    ctx.moveTo(-10, -75);
    ctx.lineTo(0, -25);
    ctx.moveTo(40, -70);
    ctx.lineTo(45, -18);
    ctx.stroke();
  } else if (type === 'food') {
    // Dattelpalme mit Datteln
    drawPalm(ctx, 0, 60, 0.7, seededRandom(5));
    ctx.fillStyle = COL.date;
    for (let i = 0; i < 12; i++) {
      const a = (i / 12) * Math.PI * 2;
      ctx.beginPath();
      ctx.ellipse(7 + Math.cos(a) * 22, -45 + Math.sin(a) * 12, 8, 12, 0, 0, Math.PI * 2);
      ctx.fill();
    }
  } else if (type === 'toybox') {
    // Spielkiste
    ctx.fillStyle = COL.trunk;
    ctx.fillRect(-70, -10, 140, 70);
    ctx.fillStyle = COL.sandDark;
    ctx.fillRect(-76, -22, 152, 18);
    ctx.strokeStyle = COL.sandLight;
    ctx.lineWidth = 4;
    ctx.strokeRect(-60, 0, 120, 50);
  }
  return c;
}

function renderSprites() {
  sprites.bg = renderBackground();
  sprites.water = renderStationSprite('water');
  sprites.shade = renderStationSprite('shade');
  sprites.food = renderStationSprite('food');
  sprites.toybox = renderStationSprite('toybox');
  sparkles = [];
  for (let i = 0; i < 45; i++) {
    const a = Math.random() * Math.PI * 2;
    const r = Math.sqrt(Math.random()) * 0.9;
    sparkles.push({
      x: POND.x + Math.cos(a) * POND.rx * r,
      y: POND.y + Math.sin(a) * POND.ry * r,
      phase: Math.random() * 10,
      speed: 1 + Math.random() * 2,
      size: 6 + Math.random() * 10,
    });
  }
}

// --- Symbole für Bedürfnisse ---
function drawNeedIcon(ctx, need, x, y, s) {
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(s, s);
  if (need === 'water') {
    ctx.fillStyle = COL.water;
    ctx.beginPath();
    ctx.moveTo(0, -24);
    ctx.quadraticCurveTo(18, 0, 16, 10);
    ctx.arc(0, 10, 16, 0, Math.PI);
    ctx.quadraticCurveTo(-18, 0, 0, -24);
    ctx.fill();
    ctx.fillStyle = COL.waterLight;
    ctx.fillRect(-7, 2, 5, 10);
  } else if (need === 'food') {
    ctx.fillStyle = COL.date;
    ctx.beginPath();
    ctx.ellipse(0, 0, 13, 20, 0.3, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = COL.palm;
    ctx.fillRect(2, -24, 4, 8);
  } else if (need === 'shade') {
    ctx.fillStyle = COL.sail;
    ctx.beginPath();
    ctx.moveTo(-24, -12);
    ctx.quadraticCurveTo(0, -2, 24, -14);
    ctx.lineTo(16, 8);
    ctx.quadraticCurveTo(0, 2, -20, 8);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = COL.trunk;
    ctx.fillRect(-25, -14, 4, 34);
  } else if (need === 'play') {
    drawBall(ctx, 0, 0, 20, gameTime);
  }
  ctx.restore();
}

function drawBall(ctx, x, y, r, rot) {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(rot);
  ctx.fillStyle = COL.ball2;
  ctx.beginPath();
  ctx.arc(0, 0, r, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = COL.ball1;
  for (let k = 0; k < 3; k++) {
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.arc(0, 0, r, (k * 2 * Math.PI) / 3, (k * 2 * Math.PI) / 3 + Math.PI / 3);
    ctx.closePath();
    ctx.fill();
  }
  ctx.strokeStyle = COL.shadow;
  ctx.lineWidth = Math.max(2, r * 0.08);
  ctx.beginPath();
  ctx.arc(0, 0, r, 0, Math.PI * 2);
  ctx.stroke();
  ctx.restore();
}

// --- Bedürfnisse ---
function resetNeeds() {
  Object.keys(NEEDS).forEach((k) => {
    needs[k] = { value: DIFFICULTY.needStart, empty: 0 };
  });
}

function giveNeed(need, amount, x, y) {
  const n = needs[need];
  if (!needActive(need)) return;
  if (n.value >= DIFFICULTY.satedThreshold) {
    addFloatingText('satt!', x, y - 40, COL.text, 40);
    n.value = Math.min(1, n.value + amount);
    return false;
  }
  n.value = Math.min(1, n.value + amount);
  n.empty = 0;
  return true;
}

function updateNeeds(dt) {
  let factor = 1;
  if (sleep && sleep.phase === 'sleep') factor *= DIFFICULTY.sleepDecayFactor;
  if (grumpyLeft > 0) factor *= DIFFICULTY.grumpyDecayFactor;
  if (storm) factor *= DIFFICULTY.stormDecayFactor;
  const base = needDecay();
  activeNeedKeys().forEach((k) => {
    const n = needs[k];
    n.value = Math.max(0, n.value - base * NEEDS[k].decay * factor * dt);
    if (n.value <= 0) {
      n.empty += dt;
      if (n.empty >= DIFFICULTY.emptyGrace) {
        n.empty = 0;
        n.value = DIFFICULTY.needAfterHeartLoss;
        const st = stationOf(k);
        loseHeart(`${NEEDS[k].label} fehlt!`, st ? st.x : dragon.x, st ? st.y - 150 : dragon.y - 200);
      }
    } else {
      n.empty = 0;
    }
  });
}

function careFactor() {
  if (grumpyLeft > 0) return 0;
  let anyEmpty = false;
  let anyLow = false;
  activeNeedKeys().forEach((k) => {
    if (needs[k].value <= 0) anyEmpty = true;
    else if (needs[k].value < DIFFICULTY.goodThreshold) anyLow = true;
  });
  if (anyEmpty) return 0;
  if (anyLow) return DIFFICULTY.growthPartial;
  return sleep && sleep.phase === 'sleep' ? DIFFICULTY.growthSleep : 1;
}

function loseHeart(text, x, y) {
  hearts--;
  stats.heartsLost++;
  shake = Math.max(shake, 0.5);
  dragon.sad = 2;
  addFloatingText(`${text} −1 ♥`, clamp(x, 220, W - 220), clamp(y, 200, H - 100), COL.bad, 48);
  burst(dragon.x, dragon.y - 40, COL.bad, 25, 350);
  playSound(soundBoom, 0.4);
  if (hearts <= 0) {
    hearts = 0;
    gameOverReason = `Der Drache hatte zu wenig ${text.replace(' fehlt!', '')} – er fliegt davon …`;
    gameState = 'gameover';
    stateTime = 0;
    playSound(soundGameOver, 0.7);
    buttonsGameOver = [startButton()];
  }
}

// --- Stationen ---
function createStation(def) {
  const st = Object.assign({}, def, { glow: 0, dune: null, duneHp: 0, dry: false, button: null });
  st.button = guiPixelFillButton({
    label: '',
    posX: def.x,
    posY: def.y,
    radius: DIFFICULTY.stationRadius,
    fullPercent: DIFFICULTY.fullPercent,
    speedUp: 100 / DIFFICULTY.portionTime,
    speedDown: DIFFICULTY.stationSpeedDown,
    counterReset: true,
    minValue: 1,
    activeValue: 99,
    visible: false,
    onEnterActive: () => sendPortion(st),
  });
  return st;
}

function sendPortion(st) {
  st.glow = 1;
  flyers.push({ need: st.need, x: st.x, y: st.y - 40, sx: st.x, sy: st.y - 40, t: 0, dur: 0.7, amount: DIFFICULTY.portion });
  burst(st.x, st.y - 40, NEEDS[st.need].color, 10, 220, 200);
  playSound(soundPop, 0.45);
}

function updateFlyers(ctx, dt) {
  flyers.slice().forEach((f) => {
    f.t += dt;
    const u = Math.min(1, f.t / f.dur);
    const tx = dragon.x;
    const ty = dragon.y - dragonRadius() * 0.4;
    f.x = f.sx + (tx - f.sx) * u;
    f.y = f.sy + (ty - f.sy) * u - Math.sin(u * Math.PI) * 160;
    // Leuchtspur
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    ctx.globalAlpha = 0.35;
    ctx.fillStyle = NEEDS[f.need].color;
    ctx.beginPath();
    ctx.arc(f.x, f.y, 34, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
    drawNeedIcon(ctx, f.need, f.x, f.y, 1.4);
    if (u >= 1) {
      removeItemFromArray(flyers, f);
      if (giveNeed(f.need, f.amount, tx, ty)) {
        score += DIFFICULTY.scorePortion;
        stats.portions++;
        addFloatingText(`+${DIFFICULTY.scorePortion}`, tx + 80, ty - 60, COL.textHi, 40);
      }
      dragon.bounce = 1;
      burst(tx, ty, NEEDS[f.need].color, 12, 250, 300);
    }
  });
}

function handleStations(ctx, grid, dt, active) {
  stations.forEach((st) => {
    if (!needActive(st.need)) return;
    st.glow = Math.max(0, st.glow - dt * 2);
    if (active) {
      if (st.dune) st.dune.handle(grid, dt);
      else if (!st.dry) st.button.handle(grid, dt);
      else st.button.setValue(0);
    }
    renderStation(ctx, st);
  });
}

function renderNeedRing(ctx, need, x, y, r) {
  const n = needs[need];
  const v = n.value;
  const low = v < DIFFICULTY.goodThreshold;
  const blink = v <= 0 && Math.floor(gameTime * 5) % 2 === 0;
  ctx.save();
  ctx.lineCap = 'round';
  ctx.lineWidth = 16;
  ctx.strokeStyle = COL.shadow;
  ctx.globalAlpha = 0.55;
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.stroke();
  ctx.globalAlpha = 1;
  ctx.strokeStyle = blink ? COL.text : low ? COL.bad : v > 0.7 ? COL.good : COL.warn;
  if (low) {
    ctx.shadowColor = COL.bad;
    ctx.shadowBlur = 20;
  }
  if (v > 0) {
    ctx.beginPath();
    ctx.arc(x, y, r, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * v);
    ctx.stroke();
  } else if (blink) {
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.stroke();
  }
  ctx.restore();
  // Bedürfnis-Symbol oben am Ring
  ctx.save();
  ctx.fillStyle = COL.shadow;
  ctx.beginPath();
  ctx.arc(x, y - r, 30, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
  drawNeedIcon(ctx, need, x, y - r, 1.05);
  if (v <= 0) {
    const left = Math.max(0, Math.ceil(DIFFICULTY.emptyGrace - n.empty));
    util.renderTextDropShadow({ ctx, text: `! ${left}`, fontSize: '50px', fillStyle: COL.bad, shadowStyle: COL.shadow, dropDistX: 3, dropDistY: 3, x: x + r + 40, y: y - r + 15 });
  }
}

function renderStation(ctx, st) {
  const r = DIFFICULTY.stationRadius;
  const fill = st.dune ? st.dune.getValue() / 100 : st.button.getValue() / 100;
  // Glow beim Füllen
  if (fill > 0.02 || st.glow > 0) {
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    const g = ctx.createRadialGradient(st.x, st.y, 10, st.x, st.y, r * 1.2);
    g.addColorStop(0, NEEDS[st.need].color);
    g.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.globalAlpha = Math.min(0.6, fill * 0.5 + st.glow * 0.6);
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(st.x, st.y, r * 1.2, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }
  ctx.drawImage(sprites[st.need], st.x - 130, st.y - 170);
  if (st.dry) {
    // ausgetrocknet: Risse und Staub
    ctx.save();
    ctx.strokeStyle = COL.rockDark;
    ctx.lineWidth = 5;
    ctx.beginPath();
    ctx.moveTo(st.x - 50, st.y - 10);
    ctx.lineTo(st.x - 10, st.y - 2);
    ctx.lineTo(st.x + 5, st.y - 18);
    ctx.lineTo(st.x + 45, st.y - 6);
    ctx.stroke();
    ctx.restore();
    util.renderTextDropShadow({ ctx, text: 'trocken!', fontSize: '42px', fillStyle: COL.bad, shadowStyle: COL.shadow, dropDistX: 3, dropDistY: 3, x: st.x, y: st.y + 110 });
  }
  if (st.dune) renderDune(ctx, st);
  // Füllfortschritt der Station (innerer Ring)
  if (fill > 0) {
    ctx.save();
    ctx.strokeStyle = COL.text;
    ctx.lineWidth = 8;
    ctx.globalAlpha = 0.9;
    ctx.beginPath();
    ctx.arc(st.x, st.y, r - 18, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * fill);
    ctx.stroke();
    ctx.restore();
  }
  renderNeedRing(ctx, st.need, st.x, st.y, r + 12);
  if (!st.dune && !st.dry) {
    util.renderTextDropShadow({ ctx, text: NEEDS[st.need].label, fontSize: '40px', fillStyle: COL.text, shadowStyle: COL.shadow, dropDistX: 3, dropDistY: 3, x: st.x, y: st.y + r + 60 });
  }
}

// --- Drache ---
function createDragon() {
  return {
    x: DRAGON_HOME.x,
    y: DRAGON_HOME.y,
    scale: STAGES[0].scale,
    bounce: 0,
    blink: 2,
    sad: 0,
    lookX: DRAGON_HOME.x + 100,
    dir: 1,
    smoke: 0,
  };
}

function dragonMood() {
  if (sleep && sleep.phase === 'sleep') return 'sleep';
  if (grumpyLeft > 0) return 'grumpy';
  if (sleep && sleep.phase === 'yawn') return 'yawn';
  const low = lowestNeed();
  if (dragon.sad > 0 || (low && needs[low].value < DIFFICULTY.goodThreshold)) return 'sad';
  return 'happy';
}

function updateDragon(dt) {
  dragon.bounce = Math.max(0, dragon.bounce - dt * 3);
  dragon.sad = Math.max(0, dragon.sad - dt);
  dragon.blink -= dt;
  if (dragon.blink < -0.15) dragon.blink = 2 + Math.random() * 3;
  const targetScale = STAGES[stage()].scale;
  dragon.scale += (targetScale - dragon.scale) * Math.min(1, dt * 3);
  // schaut zur Station, die er am dringendsten braucht
  const low = lowestNeed();
  let lx = dragon.x + dragon.dir * 100;
  if (ball && low === 'play') lx = ball.getX();
  else if (low) {
    const st = stationOf(low);
    if (st) lx = st.x;
  }
  if (riddle) lx = W / 2;
  dragon.lookX += (lx - dragon.lookX) * Math.min(1, dt * 4);
  if (Math.abs(dragon.lookX - dragon.x) > 60) dragon.dir = dragon.lookX > dragon.x ? 1 : -1;
  if (grumpyLeft > 0 && Math.random() < dt * 10) {
    const r = dragonRadius();
    particles.length < DIFFICULTY.maxParticles &&
      particles.push({
        x: dragon.x + dragon.dir * r * 0.9,
        y: dragon.y - r * 0.7,
        vx: dragon.dir * (40 + Math.random() * 40),
        vy: -60 - Math.random() * 40,
        life: 0,
        maxLife: 1.2,
        size: 18 + Math.random() * 14,
        color: COL.rock,
        gravity: -20,
        shape: 'round',
      });
  }
}

function drawDragon(ctx, x, y, scale, st, mood, t) {
  ctx.save();
  ctx.translate(x, y);
  // Schatten am Boden
  ctx.fillStyle = COL.shadow;
  ctx.globalAlpha = 0.3;
  ctx.beginPath();
  ctx.ellipse(0, 85 * scale, 110 * scale, 22 * scale, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.globalAlpha = 1;
  const b = dragon ? dragon.bounce : 0;
  const breath = mood === 'sleep' ? Math.sin(t * 1.5) * 0.04 : Math.sin(t * 3) * 0.02;
  ctx.scale(scale * (1 + b * 0.08), scale * (1 - b * 0.1 + breath));
  if (st === 0) {
    drawEgg(ctx, t);
    ctx.restore();
    return;
  }
  ctx.scale(dragon ? dragon.dir : 1, 1);
  const flap = mood === 'happy' ? Math.sin(t * 8) * 0.35 : mood === 'sleep' ? 0 : Math.sin(t * 3) * 0.15;
  const wingS = [0, 0.55, 0.75, 0.95, 1.1, 1.3][st];
  // Schwanz
  const sway = Math.sin(t * (mood === 'happy' ? 5 : 2)) * 15;
  ctx.strokeStyle = COL.dragon;
  ctx.lineCap = 'round';
  ctx.lineWidth = 26;
  ctx.beginPath();
  ctx.moveTo(-40, 30);
  ctx.quadraticCurveTo(-120, 50 + sway, -150, -10 + sway * 2);
  ctx.stroke();
  ctx.fillStyle = COL.dragonDark;
  ctx.beginPath();
  ctx.moveTo(-150, -10 + sway * 2);
  ctx.lineTo(-175, -40 + sway * 2);
  ctx.lineTo(-135, -25 + sway * 2);
  ctx.closePath();
  ctx.fill();
  // Flügel (hinten)
  const wing = (side) => {
    ctx.save();
    ctx.translate(-5, -40);
    ctx.rotate(side * (0.35 + flap) - 0.2);
    ctx.scale(wingS, wingS);
    ctx.fillStyle = side > 0 ? COL.wing : COL.dragonDark;
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.quadraticCurveTo(-40, -120, -110, -110);
    ctx.quadraticCurveTo(-90, -70, -100, -45);
    ctx.quadraticCurveTo(-70, -50, -65, -20);
    ctx.quadraticCurveTo(-40, -30, 0, 0);
    ctx.fill();
    ctx.restore();
  };
  wing(-1);
  // Beine
  ctx.fillStyle = COL.dragonDark;
  ctx.beginPath();
  ctx.ellipse(-35, 65, 22, 16, 0, 0, Math.PI * 2);
  ctx.ellipse(35, 65, 22, 16, 0, 0, Math.PI * 2);
  ctx.fill();
  // Körper
  ctx.fillStyle = COL.dragon;
  ctx.beginPath();
  ctx.ellipse(0, 10, 75, 62, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = COL.belly;
  ctx.beginPath();
  ctx.ellipse(18, 22, 42, 44, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = COL.sandDark;
  ctx.lineWidth = 2;
  for (let k = 0; k < 4; k++) {
    ctx.beginPath();
    ctx.moveTo(-15, 0 + k * 14);
    ctx.quadraticCurveTo(18, 6 + k * 14, 52, 0 + k * 14);
    ctx.stroke();
  }
  // Rückenzacken
  ctx.fillStyle = COL.dragonDark;
  for (let k = 0; k < 4; k++) {
    const sx = -55 + k * 22;
    const sy = -38 - Math.sin((k / 3) * Math.PI) * 14;
    ctx.beginPath();
    ctx.moveTo(sx - 10, sy + 8);
    ctx.lineTo(sx, sy - 14);
    ctx.lineTo(sx + 10, sy + 8);
    ctx.closePath();
    ctx.fill();
  }
  wing(1);
  // Kopf
  const hx = 55;
  const hy = -62 + (mood === 'sleep' ? 18 : 0);
  ctx.fillStyle = COL.dragon;
  ctx.beginPath();
  ctx.arc(hx, hy, 48, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.ellipse(hx + 40, hy + 12, 32, 24, 0, 0, Math.PI * 2);
  ctx.fill();
  // Hörner
  if (st >= 2) {
    ctx.fillStyle = COL.belly;
    const hl = 12 + st * 6;
    [-20, 8].forEach((o) => {
      ctx.beginPath();
      ctx.moveTo(hx + o - 8, hy - 38);
      ctx.lineTo(hx + o - 14, hy - 38 - hl);
      ctx.lineTo(hx + o + 6, hy - 42);
      ctx.closePath();
      ctx.fill();
    });
  }
  // Krone für den Drachenkönig
  if (st >= 5) {
    ctx.fillStyle = COL.sun;
    ctx.shadowColor = COL.sun;
    ctx.shadowBlur = 20;
    ctx.beginPath();
    ctx.moveTo(hx - 30, hy - 45);
    ctx.lineTo(hx - 30, hy - 80);
    ctx.lineTo(hx - 15, hy - 62);
    ctx.lineTo(hx, hy - 88);
    ctx.lineTo(hx + 15, hy - 62);
    ctx.lineTo(hx + 30, hy - 80);
    ctx.lineTo(hx + 30, hy - 45);
    ctx.closePath();
    ctx.fill();
    ctx.shadowBlur = 0;
  }
  // Nasenlöcher
  ctx.fillStyle = COL.dragonDark;
  ctx.beginPath();
  ctx.arc(hx + 58, hy + 4, 4, 0, Math.PI * 2);
  ctx.arc(hx + 48, hy + 2, 4, 0, Math.PI * 2);
  ctx.fill();
  // Augen
  const ex = hx + 10;
  const ey = hy - 10;
  if (mood === 'sleep' || (dragon && dragon.blink < 0)) {
    ctx.strokeStyle = COL.eye;
    ctx.lineWidth = 5;
    ctx.beginPath();
    ctx.arc(ex, ey, 14, 0.2, Math.PI - 0.2);
    ctx.stroke();
  } else {
    ctx.fillStyle = COL.text;
    ctx.beginPath();
    ctx.ellipse(ex, ey, 17, 21, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = COL.eye;
    const look = dragon ? clamp((dragon.lookX - dragon.x) * dragon.dir * 0.02, -5, 6) : 3;
    ctx.beginPath();
    ctx.arc(ex + look, ey + 2, 10, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = COL.text;
    ctx.beginPath();
    ctx.arc(ex + look + 3, ey - 3, 4, 0, Math.PI * 2);
    ctx.fill();
    if (mood === 'grumpy' || mood === 'sad') {
      ctx.strokeStyle = COL.eye;
      ctx.lineWidth = 6;
      ctx.beginPath();
      if (mood === 'grumpy') {
        ctx.moveTo(ex - 18, ey - 30);
        ctx.lineTo(ex + 16, ey - 18);
      } else {
        ctx.moveTo(ex - 16, ey - 20);
        ctx.lineTo(ex + 16, ey - 30);
      }
      ctx.stroke();
    }
  }
  // Mund
  ctx.strokeStyle = COL.eye;
  ctx.lineWidth = 4;
  ctx.beginPath();
  if (mood === 'yawn') {
    ctx.fillStyle = COL.eye;
    ctx.ellipse(hx + 45, hy + 28, 14, 10 + Math.sin(t * 2) * 4, 0, 0, Math.PI * 2);
    ctx.fill();
  } else if (mood === 'happy') {
    ctx.arc(hx + 40, hy + 18, 14, 0.2, Math.PI - 0.4);
    ctx.stroke();
  } else if (mood === 'sad' || mood === 'grumpy') {
    ctx.arc(hx + 40, hy + 36, 12, Math.PI + 0.4, -0.4);
    ctx.stroke();
  } else {
    ctx.moveTo(hx + 30, hy + 28);
    ctx.lineTo(hx + 55, hy + 28);
    ctx.stroke();
  }
  // Bäckchen
  if (mood === 'happy') {
    ctx.fillStyle = COL.blush;
    ctx.globalAlpha = 0.6;
    ctx.beginPath();
    ctx.ellipse(hx + 18, hy + 18, 11, 7, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = 1;
  }
  ctx.restore();
}

function drawEgg(ctx, t) {
  const g = growth;
  ctx.rotate(Math.sin(t * (3 + g * 6)) * (0.04 + g * 0.12));
  // Wärmeglühen
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  ctx.globalAlpha = 0.25 + 0.15 * Math.sin(t * 2);
  ctx.fillStyle = COL.sun;
  ctx.beginPath();
  ctx.ellipse(0, 0, 105, 130, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
  ctx.fillStyle = COL.egg;
  ctx.beginPath();
  ctx.moveTo(0, -110);
  ctx.bezierCurveTo(70, -110, 85, 20, 80, 40);
  ctx.bezierCurveTo(70, 90, -70, 90, -80, 40);
  ctx.bezierCurveTo(-85, 20, -70, -110, 0, -110);
  ctx.fill();
  ctx.fillStyle = COL.eggSpot;
  [
    [-30, -50, 16],
    [25, -70, 11],
    [35, 0, 18],
    [-40, 30, 12],
    [0, 50, 10],
  ].forEach(([sx, sy, sr]) => {
    ctx.beginPath();
    ctx.arc(sx, sy, sr, 0, Math.PI * 2);
    ctx.fill();
  });
  // Risse je nach Wachstum
  const cracks = Math.floor(g * 6);
  ctx.strokeStyle = COL.eye;
  ctx.lineWidth = 4;
  ctx.beginPath();
  let px = -60;
  let py = -20;
  ctx.moveTo(px, py);
  for (let k = 0; k < cracks; k++) {
    px += 22;
    py += k % 2 === 0 ? -16 : 16;
    ctx.lineTo(px, py);
  }
  ctx.stroke();
}

function renderThoughtBubble(ctx) {
  const r = dragonRadius();
  const bx = dragon.x + dragon.dir * r * 0.9;
  const by = dragon.y - r * 1.7 - 40;
  let content = null;
  if (riddle) content = 'riddle';
  else if (sleep && sleep.phase === 'sleep') content = 'sleep';
  else {
    const low = lowestNeed();
    if (low && needs[low].value < DIFFICULTY.goodThreshold && stage() > 0) content = low;
  }
  if (!content) return;
  if (content === 'sleep') {
    for (let k = 0; k < 3; k++) {
      const p = (gameTime * 0.6 + k / 3) % 1;
      ctx.save();
      ctx.globalAlpha = 1 - p;
      util.renderTextDropShadow({ ctx, text: 'Z', fontSize: `${40 + k * 14}px`, fillStyle: COL.text, shadowStyle: COL.shadow, dropDistX: 3, dropDistY: 3, x: bx + p * 60 * dragon.dir + k * 20, y: by + 40 - p * 90 });
      ctx.restore();
    }
    return;
  }
  const w = content === 'riddle' ? riddle.seq.length * 95 + 50 : 110;
  const cx = content === 'riddle' ? clamp(bx, w / 2 + 20, W - w / 2 - 20) : bx;
  const cy = content === 'riddle' ? Math.max(HUD_H + 90, by) : by;
  ctx.save();
  ctx.fillStyle = COL.text;
  ctx.globalAlpha = 0.92;
  ctx.beginPath();
  ctx.ellipse(cx, cy, w / 2, 60, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.arc(dragon.x + dragon.dir * r * 0.6, dragon.y - r * 1.15, 14, 0, Math.PI * 2);
  ctx.arc(dragon.x + dragon.dir * r * 0.75, dragon.y - r * 1.4, 20, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
  if (content === 'riddle') {
    util.renderTextDropShadow({ ctx, text: `${Math.ceil(riddle.left)}s`, fontSize: '44px', fillStyle: COL.rune, shadowStyle: COL.shadow, dropDistX: 3, dropDistY: 3, x: cx + w / 2 + 60, y: cy + 15 });
    riddle.seq.forEach((ri, k) => {
      const x = cx - ((riddle.seq.length - 1) * 95) / 2 + k * 95;
      const done = k < riddle.progress;
      util.drawNgon({ ctx, color: done ? COL.good : COL.night, Xcenter: x, Ycenter: cy, size: 32, numberOfSides: RUNE_POS[ri].edges, angle: -Math.PI / 2, lineWidth: done ? 10 : 6 });
    });
  } else {
    const pulse = 1.4 + 0.15 * Math.sin(gameTime * 8);
    drawNeedIcon(ctx, content, cx, cy, pulse);
  }
}

// --- Schlaf ---
function createSleep() {
  const s = { phase: 'awake', timer: sleepInterval() * (0.7 + Math.random() * 0.4), left: 0, button: null };
  s.button = guiPixelFillButton({
    label: '',
    posX: dragon.x,
    posY: dragon.y,
    radius: DRAGON_R,
    fullPercent: DIFFICULTY.wakeFullPercent,
    speedUp: 100 / DIFFICULTY.wakeTime,
    speedDown: 50,
    minValue: 1,
    activeValue: 99,
    visible: false,
    onEnterActive: () => wakeUp(true),
  });
  return s;
}

function sleepInterval() {
  return Math.max(DIFFICULTY.sleepIntervalMin, DIFFICULTY.sleepIntervalStart + DIFFICULTY.sleepIntervalPerLevel * (level - DIFFICULTY.sleepLevel));
}

function fallAsleep() {
  sleep.phase = 'sleep';
  sleep.left = DIFFICULTY.sleepDuration;
  sleep.button.setValue(0);
  addFloatingText('Pssst! Der Drache schläft – nicht anleuchten!', dragon.x, dragon.y - dragonRadius() * 2 - 60, COL.text, 46);
}

function wakeUp(grumpy) {
  if (!sleep || sleep.phase !== 'sleep') return;
  sleep.phase = 'awake';
  sleep.timer = sleepInterval() * (0.8 + Math.random() * 0.4);
  sleep.button.setValue(0);
  if (grumpy) {
    makeGrumpy('Aufgeweckt! Grrr!');
  } else {
    stats.sleeps++;
    score += DIFFICULTY.scoreSleepWell;
    addFloatingText(`Ausgeschlafen! +${DIFFICULTY.scoreSleepWell}`, dragon.x, dragon.y - dragonRadius() * 1.8, COL.textHi, 46);
    burst(dragon.x, dragon.y - 60, COL.sun, 20, 300, 100);
  }
}

function makeGrumpy(text) {
  grumpyLeft = DIFFICULTY.grumpyTime;
  stats.grumpy++;
  score = Math.max(0, score - DIFFICULTY.scoreGrumpy);
  shake = Math.max(shake, 0.5);
  addFloatingText(`${text} −${DIFFICULTY.scoreGrumpy}`, dragon.x, dragon.y - dragonRadius() * 1.8, COL.bad, 50);
  burst(dragon.x, dragon.y - 60, COL.rock, 25, 300, -50, 'round');
  playSound(soundGrumpy, 0.6);
}

function updateSleep(ctx, grid, dt) {
  if (!sleep) return;
  sleep.button.setX(dragon.x);
  sleep.button.setY(dragon.y);
  sleep.button.setRadius(dragonRadius());
  if (sleep.phase === 'sleep') {
    sleep.left -= dt;
    sleep.button.handle(grid, dt);
    // Warnung, wenn Laser auf dem Drachen ist
    const v = sleep.button.getValue() / 100;
    if (v > 0.05) {
      ctx.save();
      ctx.strokeStyle = COL.bad;
      ctx.lineWidth = 10;
      ctx.globalAlpha = 0.4 + v * 0.6;
      ctx.setLineDash([20, 14]);
      ctx.beginPath();
      ctx.arc(dragon.x, dragon.y - 10, dragonRadius() * 1.15, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();
      if (Math.random() < dt * 4) addFloatingText('Pssst!', dragon.x + (Math.random() - 0.5) * 200, dragon.y - dragonRadius() * 1.5, COL.bad, 44);
    }
    if (sleep.phase === 'sleep' && sleep.left <= 0) wakeUp(false);
  } else if (grumpyLeft <= 0 && !riddle) {
    sleep.timer -= dt;
    sleep.phase = sleep.timer <= DIFFICULTY.yawnTime ? 'yawn' : 'awake';
    if (sleep.timer <= 0) fallAsleep();
  }
}

// --- Ball ---
function createBall() {
  const b = guiFollowCircle({
    label: '',
    posX: BALL_HOME.x,
    posY: BALL_HOME.y - 40,
    radius: DIFFICULTY.ballRadius,
    scanRadiusFactor: 2.4,
    speedUp: 0.12,
    speedDown: 0.08,
    visible: false,
  });
  b.rot = 0;
  return b;
}

function updateBall(ctx, grid, dt, active) {
  if (!ball) return;
  ctx.drawImage(sprites.toybox, BALL_HOME.x - 130, BALL_HOME.y - 170 + 60);
  renderNeedRing(ctx, 'play', BALL_HOME.x, BALL_HOME.y + 20, 95);
  if (!riddle && dist(ball.getX(), ball.getY(), BALL_HOME.x, BALL_HOME.y - 40) < 30) {
    util.renderTextDropShadow({ ctx, text: 'Ball zum Drachen!', fontSize: '36px', fillStyle: COL.text, shadowStyle: COL.shadow, dropDistX: 3, dropDistY: 3, x: BALL_HOME.x, y: BALL_HOME.y + 190 });
  }
  ballCooldown = Math.max(0, ballCooldown - dt);
  if (active) {
    const ox = ball.getX();
    ball.handle(grid, dt);
    if (storm) ball.setX(ball.getX() + 60 * dt);
    ball.setX(clamp(ball.getX(), 70, WADI_X0 - 70));
    ball.setY(clamp(ball.getY(), HUD_H + 70, H - 70));
    ball.rot += (ball.getX() - ox) / DIFFICULTY.ballRadius;
    const d = dist(ball.getX(), ball.getY(), dragon.x, dragon.y);
    const reach = dragonRadius() + DIFFICULTY.ballRadius * 0.5;
    if (d < reach && ballCooldown === 0) {
      if (sleep && sleep.phase === 'sleep') {
        // sanft wegschubsen, nicht wecken
        const a = Math.atan2(ball.getY() - dragon.y, ball.getX() - dragon.x);
        ball.setX(dragon.x + Math.cos(a) * (reach + 20));
        ball.setY(dragon.y + Math.sin(a) * (reach + 20));
        ball.setSpeedX(0);
        ball.setSpeedY(0);
        addFloatingText('Pssst!', ball.getX(), ball.getY() - 70, COL.bad, 40);
      } else {
        deliverBall();
      }
    }
  }
  // Ball zeichnen (mit Glow)
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  ctx.globalAlpha = 0.3;
  ctx.fillStyle = COL.ball1;
  ctx.beginPath();
  ctx.arc(ball.getX(), ball.getY(), DIFFICULTY.ballRadius * 1.5, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
  ctx.save();
  ctx.fillStyle = COL.shadow;
  ctx.globalAlpha = 0.3;
  ctx.beginPath();
  ctx.ellipse(ball.getX(), ball.getY() + DIFFICULTY.ballRadius * 0.95, DIFFICULTY.ballRadius * 0.9, 12, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
  drawBall(ctx, ball.getX(), ball.getY(), DIFFICULTY.ballRadius, ball.rot);
}

function deliverBall() {
  ballCooldown = 1;
  const x = ball.getX();
  const y = ball.getY();
  if (giveNeed('play', DIFFICULTY.playPortion, x, y)) {
    score += DIFFICULTY.scoreBall;
    stats.balls++;
    addFloatingText(`Juhu! +${DIFFICULTY.scoreBall}`, x, y - 80, COL.textHi, 48);
  }
  dragon.bounce = 1;
  burst(x, y, COL.ball1, 25, 400, 300);
  burst(x, y, COL.ball2, 15, 300, 300);
  playSound(soundBounce, 0.6);
  ball.setX(BALL_HOME.x);
  ball.setY(BALL_HOME.y - 40);
  ball.setSpeedX(0);
  ball.setSpeedY(0);
}

// --- Sandsturm ---
function stormInterval() {
  return Math.max(DIFFICULTY.stormIntervalMin, DIFFICULTY.stormIntervalStart + DIFFICULTY.stormIntervalPerLevel * (level - DIFFICULTY.stormLevel));
}

function startStorm() {
  storm = { left: DIFFICULTY.stormDuration };
  const candidates = stations.filter((s) => needActive(s.need) && !s.dune && !s.dry);
  const count = Math.min(candidates.length, 1 + Math.floor((level - DIFFICULTY.stormLevel) / 2));
  for (let i = 0; i < count; i++) {
    const st = candidates.splice(Math.floor(Math.random() * candidates.length), 1)[0];
    buryStation(st);
  }
  addFloatingText('SANDSTURM! Leuchtet die Dünen frei!', W / 2, 300, COL.warn, 60);
  shake = Math.max(shake, 0.4);
  playSound(soundBoom, 0.3);
}

function buryStation(st) {
  st.duneHp = DIFFICULTY.duneHp;
  st.button.setValue(0);
  st.dune = guiPixelFillButton({
    label: '',
    posX: st.x,
    posY: st.y,
    radius: DIFFICULTY.stationRadius,
    fullPercent: DIFFICULTY.fullPercent,
    speedUp: 100 / DIFFICULTY.duneDigTime,
    speedDown: DIFFICULTY.stationSpeedDown,
    counterReset: true,
    minValue: 1,
    activeValue: 99,
    visible: false,
    onEnterActive: () => digDune(st),
  });
}

function digDune(st) {
  st.duneHp--;
  burst(st.x, st.y, COL.sand, 25, 380, 500);
  if (st.duneHp <= 0) {
    st.dune = null;
    stats.dunes++;
    score += DIFFICULTY.scoreDune;
    addFloatingText(`Freigeschaufelt! +${DIFFICULTY.scoreDune}`, st.x, st.y - 160, COL.textHi, 44);
    playSound(soundPop, 0.6);
  } else {
    playSound(soundPop, 0.3);
  }
}

function renderDune(ctx, st) {
  const h = (st.duneHp / DIFFICULTY.duneHp) * 150 + 30;
  ctx.save();
  const g = ctx.createLinearGradient(0, st.y + 80 - h, 0, st.y + 80);
  g.addColorStop(0, COL.sandLight);
  g.addColorStop(1, COL.sandDark);
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.moveTo(st.x - 135, st.y + 80);
  ctx.quadraticCurveTo(st.x - 40, st.y + 80 - h * 1.3, st.x + 20, st.y + 80 - h);
  ctx.quadraticCurveTo(st.x + 90, st.y + 80 - h * 0.6, st.x + 135, st.y + 80);
  ctx.closePath();
  ctx.fill();
  ctx.restore();
  util.renderTextDropShadow({ ctx, text: `freileuchten! (${st.duneHp})`, fontSize: '38px', fillStyle: COL.warn, shadowStyle: COL.shadow, dropDistX: 3, dropDistY: 3, x: st.x, y: st.y + DIFFICULTY.stationRadius + 60 });
}

function updateStorm(ctx, dt) {
  // Staubstreifen
  const intensity = storm ? Math.min(1, storm.left, (DIFFICULTY.stormDuration - storm.left) * 2) : 0;
  if (storm) {
    storm.left -= dt;
    if (storm.left <= 0) storm = null;
    const spawn = 120 * dt * intensity;
    for (let i = 0; i < spawn && stormDust.length < 160; i++) {
      stormDust.push({ x: -50, y: Math.random() * H, vx: 900 + Math.random() * 600, vy: (Math.random() - 0.3) * 100, len: 40 + Math.random() * 80 });
    }
  }
  if (!stormDust.length && intensity <= 0) return;
  ctx.save();
  if (intensity > 0) {
    ctx.globalAlpha = 0.28 * intensity;
    ctx.fillStyle = COL.duneFar;
    ctx.fillRect(0, 0, W, H);
  }
  ctx.globalAlpha = 0.6;
  ctx.strokeStyle = COL.sandLight;
  ctx.lineWidth = 3;
  ctx.beginPath();
  for (let i = stormDust.length - 1; i >= 0; i--) {
    const d = stormDust[i];
    d.x += d.vx * dt;
    d.y += d.vy * dt;
    if (d.x > W + 100) {
      stormDust.splice(i, 1);
      continue;
    }
    ctx.moveTo(d.x, d.y);
    ctx.lineTo(d.x - d.len, d.y - d.vy * 0.05);
  }
  ctx.stroke();
  ctx.restore();
}

// --- Ausgetrockneter Brunnen + Brücke ---
function wellInterval() {
  return Math.max(DIFFICULTY.wellIntervalMin, DIFFICULTY.wellIntervalStart - 3 * (level - DIFFICULTY.wellLevel));
}

function startDryWell() {
  const st = stationOf('water');
  if (!st) return;
  st.dry = true;
  st.dune = null;
  const planks = [0, 1, 2].map((i) => {
    const plank = { x: WADI_X0 + 40 + i * ((WADI_X1 - WADI_X0 - 80) / 2), y: BRIDGE_Y, built: false, button: null };
    plank.button = guiPixelFillButton({
      label: '',
      posX: plank.x,
      posY: plank.y,
      radius: 60,
      fullPercent: DIFFICULTY.fullPercent,
      speedUp: 100 / DIFFICULTY.plankTime,
      speedDown: 15,
      minValue: 1,
      activeValue: 99,
      visible: false,
      onEnterActive: () => {
        if (plank.built) return;
        plank.built = true;
        score += DIFFICULTY.scorePlank;
        addFloatingText(`Planke! +${DIFFICULTY.scorePlank}`, plank.x, plank.y - 100, COL.textHi, 40);
        burst(plank.x, plank.y, COL.trunk, 15, 250);
        playSound(soundPop, 0.5);
      },
    });
    return plank;
  });
  well = { planks, jug: null, jugRespawn: 0, delivered: 0 };
  addFloatingText('Der Brunnen ist ausgetrocknet!', st.x + 300, st.y - 120, COL.bad, 54);
  addFloatingText('Baut die Brücke zur Quelle!', WADI_X0 - 250, BRIDGE_Y - 180, COL.warn, 50);
  playSound(soundWrong, 0.5);
}

function bridgeBuilt() {
  return well && well.planks.every((p) => p.built);
}

function spawnJug() {
  well.jug = guiFollowCircle({
    label: '',
    posX: SPRING.x - 20,
    posY: SPRING.y - 30,
    radius: 50,
    scanRadiusFactor: 2.4,
    speedUp: 0.12,
    speedDown: 0.1,
    visible: false,
  });
}

function endDryWell(text = 'Der Brunnen sprudelt wieder!') {
  const st = stationOf('water');
  if (st) st.dry = false;
  well = null;
  wellTimer = wellInterval();
  stats.wells = (stats.wells || 0) + 1;
  if (st) {
    burst(st.x, st.y - 20, COL.water, 40, 450, 500);
    addFloatingText(`${text} +${DIFFICULTY.scoreWellFixed}`, st.x + 250, st.y - 140, COL.textHi, 50);
  }
  score += DIFFICULTY.scoreWellFixed;
  playSound(soundSplash, 0.7);
}

function updateWell(ctx, grid, dt, active) {
  if (!well) return;
  // Planken
  well.planks.forEach((p) => {
    if (active && !p.built) p.button.handle(grid, dt);
    ctx.save();
    if (p.built) {
      ctx.fillStyle = COL.trunk;
      ctx.fillRect(p.x - 40, p.y - BRIDGE_HALF, 80, BRIDGE_HALF * 2);
      ctx.strokeStyle = COL.sandDark;
      ctx.lineWidth = 3;
      for (let k = -2; k <= 2; k++) {
        ctx.beginPath();
        ctx.moveTo(p.x - 40, p.y + k * 30);
        ctx.lineTo(p.x + 40, p.y + k * 30);
        ctx.stroke();
      }
    } else {
      const v = p.button.getValue() / 100;
      ctx.strokeStyle = COL.warn;
      ctx.lineWidth = 6;
      ctx.setLineDash([16, 12]);
      ctx.strokeRect(p.x - 40, p.y - BRIDGE_HALF, 80, BRIDGE_HALF * 2);
      ctx.setLineDash([]);
      ctx.fillStyle = COL.trunk;
      ctx.globalAlpha = 0.4 + v * 0.6;
      ctx.fillRect(p.x - 40, p.y + BRIDGE_HALF - BRIDGE_HALF * 2 * v, 80, BRIDGE_HALF * 2 * v);
    }
    ctx.restore();
  });
  if (bridgeBuilt()) {
    // Seile
    ctx.save();
    ctx.strokeStyle = COL.sandLight;
    ctx.lineWidth = 4;
    [-1, 1].forEach((s) => {
      ctx.beginPath();
      ctx.moveTo(WADI_X0 - 10, BRIDGE_Y + s * BRIDGE_HALF);
      ctx.quadraticCurveTo((WADI_X0 + WADI_X1) / 2, BRIDGE_Y + s * BRIDGE_HALF + 15, WADI_X1 + 10, BRIDGE_Y + s * BRIDGE_HALF);
      ctx.stroke();
    });
    ctx.restore();
    if (!well.jug) {
      well.jugRespawn -= dt;
      if (well.jugRespawn <= 0) spawnJug();
    }
  } else {
    util.renderTextDropShadow({ ctx, text: 'Brücke bauen!', fontSize: '40px', fillStyle: COL.warn, shadowStyle: COL.shadow, dropDistX: 3, dropDistY: 3, x: (WADI_X0 + WADI_X1) / 2, y: BRIDGE_Y - BRIDGE_HALF - 40 });
  }
  const jug = well.jug;
  if (!jug) return;
  if (active) {
    jug.handle(grid, dt);
    jug.setX(clamp(jug.getX(), 60, W - 60));
    jug.setY(clamp(jug.getY(), HUD_H + 60, H - 60));
    const x = jug.getX();
    const y = jug.getY();
    if (x > WADI_X0 && x < WADI_X1 && Math.abs(y - BRIDGE_Y) > BRIDGE_HALF) {
      // abgestürzt
      stats.jugsLost++;
      burst(x, y, COL.water, 25, 300, 600);
      burst(x, y, COL.trunk, 12, 250, 600);
      addFloatingText('Krug abgestürzt!', x, y - 80, COL.bad, 44);
      playSound(soundSplash, 0.5);
      well.jug = null;
      well.jugRespawn = 1.2;
      return;
    }
    if (dist(x, y, dragon.x, dragon.y) < dragonRadius() + 40) {
      well.delivered++;
      stats.jugs++;
      giveNeed('water', DIFFICULTY.jugWater, x, y);
      score += DIFFICULTY.scoreJug;
      addFloatingText(`Wasser! +${DIFFICULTY.scoreJug}`, x, y - 90, COL.textHi, 48);
      burst(x, y, COL.water, 30, 350, 400);
      dragon.bounce = 1;
      playSound(soundSplash, 0.6);
      well.jug = null;
      well.jugRespawn = 0.8;
      if (well.delivered >= DIFFICULTY.jugsNeeded) {
        endDryWell();
        return;
      }
    }
  }
  // Krug zeichnen
  const x = jug.getX();
  const y = jug.getY();
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  ctx.globalAlpha = 0.3;
  ctx.fillStyle = COL.water;
  ctx.beginPath();
  ctx.arc(x, y, 75, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
  ctx.save();
  ctx.translate(x, y);
  ctx.fillStyle = COL.trunk;
  ctx.beginPath();
  ctx.ellipse(0, 10, 40, 42, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillRect(-16, -48, 32, 28);
  ctx.fillStyle = COL.water;
  ctx.beginPath();
  ctx.ellipse(0, -48, 18, 7, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = COL.sandLight;
  ctx.lineWidth = 4;
  ctx.beginPath();
  ctx.moveTo(-36, 0);
  ctx.lineTo(36, 0);
  ctx.stroke();
  ctx.restore();
  util.renderTextDropShadow({ ctx, text: `Krug ${well.delivered + 1}/${DIFFICULTY.jugsNeeded}`, fontSize: '36px', fillStyle: COL.text, shadowStyle: COL.shadow, dropDistX: 3, dropDistY: 3, x, y: y + 90 });
}

// --- Rätsel ---
function riddleInterval() {
  return Math.max(DIFFICULTY.riddleIntervalMin, DIFFICULTY.riddleIntervalStart - 2 * (level - DIFFICULTY.riddleLevel));
}

function startRiddle() {
  const len = Math.min(DIFFICULTY.riddleLengthMax, DIFFICULTY.riddleLengthStart + Math.floor((level - DIFFICULTY.riddleLevel) / 2));
  const seq = [];
  for (let i = 0; i < len; i++) {
    let r;
    do {
      r = Math.floor(Math.random() * RUNE_POS.length);
    } while (seq.length && seq[seq.length - 1] === r);
    seq.push(r);
  }
  riddle = { seq, progress: 0, left: DIFFICULTY.riddleTime, runes: [] };
  riddle.runes = RUNE_POS.map((p, i) => {
const rune = Object.assign({}, p, { index: i, glow: 0, button: null });
    rune.button = guiPixelFillButton({
      label: '',
      posX: p.x,
      posY: p.y,
      radius: 70,
      fullPercent: DIFFICULTY.fullPercent,
      speedUp: 100 / DIFFICULTY.runeTime,
      speedDown: 40,
      counterReset: true,
      minValue: 1,
      activeValue: 99,
      visible: false,
      onEnterActive: () => pressRune(rune),
    });
    return rune;
  });
  addFloatingText('Rätsel! Leuchtet die Runen in der gedachten Reihenfolge an!', W / 2, 860, COL.rune, 46);
  playSound(soundRiddle, 0.5);
}

function pressRune(rune) {
  if (!riddle) return;
  rune.glow = 1;
  if (riddle.seq[riddle.progress] === rune.index) {
    riddle.progress++;
    burst(rune.x, rune.y, COL.rune, 18, 300, 100);
    playSound(soundPop, 0.5);
    if (riddle.progress >= riddle.seq.length) solveRiddle();
  } else {
    riddle.progress = 0;
    burst(rune.x, rune.y, COL.bad, 18, 300, 100);
    playSound(soundWrong, 0.6);
    makeGrumpy('Falsche Rune!');
  }
}

function solveRiddle() {
  stats.riddles++;
  score += DIFFICULTY.scoreRiddle;
  activeNeedKeys().forEach((k) => (needs[k].value = Math.min(1, needs[k].value + 0.3)));
  growth = Math.min(1, growth + 0.15);
  addFloatingText(`Rätsel gelöst! +${DIFFICULTY.scoreRiddle}`, W / 2, 420, COL.textHi, 60);
  riddle.runes.forEach((r) => burst(r.x, r.y, COL.rune, 20, 400, 150));
  flash = 0.6;
  playSound(soundRiddle, 0.8);
  riddle = null;
  riddleTimer = riddleInterval();
}

function updateRiddle(ctx, grid, dt, active) {
  if (!riddle) return;
  riddle.left -= dt;
  riddle.runes.forEach((r) => {
    r.glow = Math.max(0, r.glow - dt * 2);
    if (active) r.button.handle(grid, dt);
    const v = r.button.getValue() / 100;
    ctx.save();
    ctx.fillStyle = COL.runeStone;
    ctx.beginPath();
    ctx.ellipse(r.x, r.y + 10, 72, 78, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalCompositeOperation = 'lighter';
    ctx.shadowColor = COL.rune;
    ctx.shadowBlur = 20 + r.glow * 40;
    util.drawNgon({ ctx, color: COL.rune, Xcenter: r.x, Ycenter: r.y, size: 42, numberOfSides: r.edges, angle: -Math.PI / 2, lineWidth: 8 + r.glow * 8 });
    if (v > 0) util.drawNgon({ ctx, color: COL.text, Xcenter: r.x, Ycenter: r.y, size: 42 * v, numberOfSides: r.edges, angle: -Math.PI / 2, lineWidth: 6 });
    ctx.restore();
  });
  if (riddle && riddle.left <= 0) {
    addFloatingText('Rätsel verpasst …', W / 2, 420, COL.bad, 50);
    riddle = null;
    riddleTimer = riddleInterval();
  }
}

// --- Ereignis-Steuerung ---
function updateEvents(dt) {
  if (level >= DIFFICULTY.stormLevel && !storm) {
    stormTimer -= dt;
    if (stormTimer <= 0) {
      stormTimer = stormInterval() * (0.8 + Math.random() * 0.4);
      startStorm();
    }
  }
  const exclusiveBusy = well || riddle || (sleep && sleep.phase !== 'awake');
  if (level >= DIFFICULTY.wellLevel && !well) {
    wellTimer -= dt;
    if (wellTimer <= 0 && !exclusiveBusy) startDryWell();
  }
  if (level >= DIFFICULTY.riddleLevel && !riddle) {
    riddleTimer -= dt;
    if (riddleTimer <= 0 && !exclusiveBusy) startRiddle();
  }
}

function solveCurrentEvent() {
  stations.forEach((st) => {
    if (st.dune) {
      st.duneHp = 1;
      digDune(st);
    }
  });
  if (well) endDryWell();
  if (riddle) solveRiddle();
}

// --- Level ---
function startLevel() {
  activeNeedKeys().forEach((k) => {
    needs[k].value = Math.max(needs[k].value, DIFFICULTY.needStart);
    needs[k].empty = 0;
  });
  growth = 0;
  flyers = [];
  stations.forEach((st) => {
    st.dune = null;
    st.dry = false;
    st.button.setValue(0);
  });
  storm = null;
  stormDust = [];
  well = null;
  riddle = null;
  grumpyLeft = 0;
  stormTimer = 12;
  wellTimer = level === DIFFICULTY.wellLevel ? 10 : wellInterval() * 0.6;
  riddleTimer = level === DIFFICULTY.riddleLevel ? 10 : riddleInterval() * 0.6;
  sleep = level >= DIFFICULTY.sleepLevel ? createSleep() : null;
  ball = level >= DIFFICULTY.playLevel ? createBall() : null;
  ballCooldown = 0;
  dragon.x = DRAGON_HOME.x;
  dragon.y = DRAGON_HOME.y;
  gameState = 'game';
  stateTime = 0;
}

function resetGame() {
  level = 1;
  score = 0;
  hearts = DIFFICULTY.hearts;
  stats = { portions: 0, balls: 0, dunes: 0, jugs: 0, jugsLost: 0, riddles: 0, grumpy: 0, sleeps: 0, heartsLost: 0, wells: 0, time: 0 };
  particles = [];
  floatingTexts = [];
  resetNeeds();
  dragon = createDragon();
  stations = STATION_DEFS.map(createStation);
  lastTime = performance.now();
  playSound(soundLevel, 0.5);
  startLevel();
}

function levelUp() {
  const bonus = DIFFICULTY.scoreLevel * level;
  score += bonus;
  const next = Math.min(STAGES.length - 1, level);
  levelText = level === 1 ? `Das Ei ist geschlüpft! +${bonus}` : next > stage() ? `Euer Drache ist gewachsen: ${STAGES[next].name}! +${bonus}` : `Der Drachenkönig wird noch prächtiger! +${bonus}`;
  gameState = 'levelup';
  stateTime = 0;
  flash = 1;
  flyers = [];
  burst(dragon.x, dragon.y - 60, COL.sun, 50, 600, 200);
  burst(dragon.x, dragon.y - 60, COL.dragon, 30, 500, 200);
  playSound(soundLevel, 0.8);
}

function newElementText(lvl) {
  if (lvl === DIFFICULTY.foodLevel) return 'NEU: Futter von der Dattelpalme – und Schlafphasen!\nSchläft der Drache: NICHT anleuchten!';
  if (lvl === DIFFICULTY.playLevel) return 'NEU: Spielen! Der Ball folgt eurem Laser –\nbringt ihn zum Drachen!';
  if (lvl === DIFFICULTY.stormLevel) return 'NEU: Sandstürme begraben Stationen –\nleuchtet die Dünen frei!';
  if (lvl === DIFFICULTY.wellLevel) return 'NEU: Der Brunnen trocknet aus! Baut die Brücke\nund führt Wasserkrüge von der Quelle zum Drachen.';
  if (lvl === DIFFICULTY.riddleLevel) return 'NEU: Runen-Rätsel! Leuchtet die Runen in der\nReihenfolge an, an die der Drache denkt.';
  return 'Der Drache wird größer – und anspruchsvoller …';
}

function startButton() {
  return guiFillButton({
    label: 'START',
    posX: W / 2,
    posY: 650,
    speedDown: 12,
    speedUp: 25,
    edges: 6,
    angle: 0,
    activeValue: 90,
    radius: 140,
    normalColor: COL.sun,
    activeColor: COL.textHi,
    growColor: COL.sandLight,
    onEnterActive: () => resetGame(),
    onExitActive: () => {},
  });
}

// --- Partikel, Texte, HUD ---
function updateParticles(ctx, dt) {
  ctx.save();
  for (let i = particles.length - 1; i >= 0; i--) {
    const p = particles[i];
    p.life += dt;
    if (p.life >= p.maxLife) {
      particles.splice(i, 1);
      continue;
    }
    p.vy += p.gravity * dt;
    p.x += p.vx * dt;
    p.y += p.vy * dt;
    ctx.globalAlpha = 1 - p.life / p.maxLife;
    ctx.fillStyle = p.color;
    if (p.shape === 'round') {
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.size * (0.5 + p.life / p.maxLife), 0, Math.PI * 2);
      ctx.fill();
    } else {
      ctx.fillRect(p.x - p.size / 2, p.y - p.size / 2, p.size, p.size);
    }
  }
  ctx.restore();
}

function updateFloatingTexts(ctx, dt) {
  for (let i = floatingTexts.length - 1; i >= 0; i--) {
    const t = floatingTexts[i];
    t.time += dt;
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
      shadowStyle: COL.shadow,
      x: clamp(t.x, 300, W - 300),
      y: t.y - t.time * 50,
    });
    ctx.restore();
  }
}

function renderFlash(ctx, dt) {
  if (flash <= 0) return;
  ctx.save();
  ctx.globalAlpha = Math.min(0.5, flash * 0.5);
  ctx.fillStyle = COL.sandLight;
  ctx.fillRect(0, 0, W, H);
  ctx.restore();
  flash = Math.max(0, flash - dt * 1.5);
}

function renderSparkles(ctx) {
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  ctx.strokeStyle = COL.waterLight;
  ctx.lineWidth = 3;
  sparkles.forEach((s) => {
    const a = Math.pow(Math.max(0, Math.sin(gameTime * s.speed + s.phase)), 8);
    if (a < 0.05) return;
    ctx.globalAlpha = a;
    ctx.beginPath();
    ctx.moveTo(s.x - s.size, s.y);
    ctx.lineTo(s.x + s.size, s.y);
    ctx.moveTo(s.x, s.y - s.size * 0.6);
    ctx.lineTo(s.x, s.y + s.size * 0.6);
    ctx.stroke();
  });
  ctx.restore();
}

function renderSun(ctx) {
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  const r = 70 + 6 * Math.sin(gameTime * 1.5);
  const g = ctx.createRadialGradient(1480, 120, 10, 1480, 120, r * 3);
  g.addColorStop(0, COL.sun);
  g.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.globalAlpha = 0.6;
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.arc(1480, 120, r * 3, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
  ctx.fillStyle = COL.sun;
  ctx.beginPath();
  ctx.arc(1480, 120, r * 0.8, 0, Math.PI * 2);
  ctx.fill();
}

function renderHud(ctx) {
  ctx.save();
  ctx.fillStyle = COL.shadow;
  ctx.globalAlpha = 0.55;
  ctx.fillRect(0, 0, W, 100);
  ctx.restore();
  util.renderTextDropShadow({ ctx, text: `Level ${level} · ${STAGES[stage()].name}`, fontSize: '44px', dropDistX: 3, dropDistY: 3, fillStyle: COL.text, shadowStyle: COL.shadow, align: 'left', x: 30, y: 65 });
  // Wachstumsbalken
  const bx = 760;
  const bw = 520;
  ctx.save();
  ctx.fillStyle = COL.night;
  ctx.fillRect(bx, 25, bw, 50);
  const f = careFactor();
  ctx.fillStyle = f >= 1 ? COL.good : f > 0 ? COL.warn : COL.bad;
  ctx.shadowColor = ctx.fillStyle;
  ctx.shadowBlur = 15;
  ctx.fillRect(bx, 25, bw * growth, 50);
  ctx.shadowBlur = 0;
  ctx.strokeStyle = COL.text;
  ctx.lineWidth = 4;
  ctx.strokeRect(bx, 25, bw, 50);
  ctx.restore();
  util.renderTextDropShadow({ ctx, text: f > 0 ? `Wachstum ${Math.floor(growth * 100)} %` : 'Wachstum stockt!', fontSize: '36px', dropDistX: 2, dropDistY: 2, fillStyle: COL.text, shadowStyle: COL.shadow, x: bx + bw / 2, y: 63 });
  // Punkte und Herzen
  util.renderTextDropShadow({ ctx, text: `${Math.floor(score)}`, fontSize: '46px', dropDistX: 3, dropDistY: 3, fillStyle: COL.textHi, shadowStyle: COL.shadow, align: 'right', x: W - 30, y: 65 });
  for (let i = 0; i < DIFFICULTY.hearts; i++) {
    drawHeart(ctx, 1330 + i * 52, 50, 20, i < hearts ? COL.bad : COL.night);
  }
}

function drawHeart(ctx, x, y, s, color) {
  ctx.save();
  ctx.translate(x, y);
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.moveTo(0, s * 0.9);
  ctx.bezierCurveTo(-s * 1.4, -s * 0.2, -s * 0.6, -s * 1.2, 0, -s * 0.4);
  ctx.bezierCurveTo(s * 0.6, -s * 1.2, s * 1.4, -s * 0.2, 0, s * 0.9);
  ctx.fill();
  ctx.restore();
}

// --- Szene ---
function renderScene(ctx, grid, dt, active) {
  ctx.drawImage(sprites.bg, 0, 0);
  renderSun(ctx);
  renderSparkles(ctx);
  handleStations(ctx, grid, dt, active);
  updateWell(ctx, grid, dt, active);
  updateRiddle(ctx, grid, dt, active);
  updateDragon(dt);
  if (active) updateSleep(ctx, grid, dt);
  drawDragon(ctx, dragon.x, dragon.y, dragon.scale, stage(), dragonMood(), gameTime);
  updateBall(ctx, grid, dt, active);
  updateFlyers(ctx, dt);
  renderThoughtBubble(ctx);
  updateStorm(ctx, dt);
  updateParticles(ctx, dt);
  updateFloatingTexts(ctx, dt);
}

// --- Bildschirme ---
function handleStart(grid, dt, ctx) {
  gameTime += dt;
  ctx.drawImage(sprites.bg, 0, 0);
  renderSun(ctx);
  renderSparkles(ctx);
  drawDragon(ctx, 450, 700, 0.9, 0, 'happy', gameTime);
  drawDragon(ctx, 1450, 720, 0.8, 3, 'happy', gameTime);
  util.renderTextDropShadow({ ctx, text: 'OASENHÜTER', fontSize: '150px', fillStyle: COL.sun, shadowStyle: COL.shadow, x: W / 2, y: 260 });
  util.renderTextDropShadow({
    ctx,
    text: 'Pflegt gemeinsam einen kleinen Wüstendrachen!\nTeilt euch auf: Wasser, Schatten, Futter, Spielen.',
    fontSize: '44px',
    lineHeight: 60,
    dropDistX: 4,
    dropDistY: 4,
    fillStyle: COL.text,
    shadowStyle: COL.shadow,
    x: W / 2,
    y: 380,
  });
  buttonsStart.forEach((b) => b.handle(grid, dt));
  if (keyPressedOnce('Space')) resetGame();
}

function handleKeys() {
  Object.keys(NEED_KEYS).forEach((k) => {
    if (keyPressedOnce(NEED_KEYS[k]) && needActive(k)) {
      if (k === 'play') {
        if (ball) deliverBall();
      } else {
        const st = stationOf(k);
        if (st) sendPortion(st);
      }
    }
  });
  if (keyPressedOnce('KeyS') && sleep && sleep.phase !== 'sleep') fallAsleep();
  if (keyPressedOnce('KeyW')) wakeUp(true);
  if (keyPressedOnce('KeyT') && level >= DIFFICULTY.stormLevel && !storm) startStorm();
  if (keyPressedOnce('KeyB') && level >= DIFFICULTY.wellLevel && !well) startDryWell();
  if (keyPressedOnce('KeyR') && level >= DIFFICULTY.riddleLevel && !riddle) startRiddle();
  if (keyPressedOnce('KeyE')) solveCurrentEvent();
  if (keyPressedOnce('KeyL')) {
    growth = 1;
  }
}

function handleGame(grid, dt, ctx) {
  gameTime += dt;
  stateTime += dt;
  stats.time += dt;
  handleKeys();
  grumpyLeft = Math.max(0, grumpyLeft - dt);
  updateNeeds(dt);
  if (gameState !== 'game') {
    handleGameOver(grid, dt, ctx);
    return;
  }
  updateEvents(dt);
  const f = careFactor();
  growth = Math.min(1, growth + (f * dt) / (DIFFICULTY.levelTimeStart + DIFFICULTY.levelTimePerLevel * (level - 1)));
  if (f >= 1) score += DIFFICULTY.scoreGoodPerSecond * dt;

  shake = Math.max(0, shake - dt);
  ctx.save();
  if (shake > 0) {
    const s = shake * 25;
    ctx.translate((Math.random() - 0.5) * s, (Math.random() - 0.5) * s);
  }
  renderScene(ctx, grid, dt, true);
  ctx.restore();
  renderHud(ctx);
  renderFlash(ctx, dt);

  if (gameState === 'game' && growth >= 1) levelUp();
}

function handleLevelUp(grid, dt, ctx) {
  gameTime += dt;
  stateTime += dt;
  // Drache wächst sichtbar auf die nächste Stufe
  const next = STAGES[Math.min(STAGES.length - 1, level)];
  dragon.scale += (next.scale * 1.15 - dragon.scale) * Math.min(1, dt * 2);
  renderSceneLevelUp(ctx, grid, dt);
  if (Math.random() < dt * 8) {
    burst(200 + Math.random() * (W - 400), 200 + Math.random() * 300, Math.random() < 0.5 ? COL.sun : COL.dragon, 25, 450, 150);
  }
  const t = Math.min(1, stateTime * 3);
  ctx.save();
  ctx.translate(W / 2, 290);
  ctx.scale(0.5 + 0.5 * t, 0.5 + 0.5 * t);
  util.renderTextDropShadow({ ctx, text: `LEVEL ${level + 1}`, fontSize: '170px', fillStyle: COL.sun, shadowStyle: COL.shadow, x: 0, y: 0 });
  ctx.restore();
  util.renderTextDropShadow({
    ctx,
    text: `${levelText}\n${newElementText(level + 1)}`,
    fontSize: '44px',
    lineHeight: 62,
    dropDistX: 4,
    dropDistY: 4,
    fillStyle: COL.text,
    shadowStyle: COL.shadow,
    x: W / 2,
    y: 400,
  });
  renderHud(ctx);
  renderFlash(ctx, dt);
  if (stateTime >= 4.5) {
    level++;
    startLevel();
  }
}

function renderSceneLevelUp(ctx, grid, dt) {
  ctx.drawImage(sprites.bg, 0, 0);
  renderSun(ctx);
  renderSparkles(ctx);
  // Lichtstrahlen hinter dem Drachen
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  ctx.translate(dragon.x, dragon.y - 40);
  ctx.rotate(gameTime * 0.4);
  ctx.fillStyle = COL.sun;
  ctx.globalAlpha = 0.18;
  for (let k = 0; k < 12; k++) {
    ctx.rotate((Math.PI * 2) / 12);
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.lineTo(-40, -600);
    ctx.lineTo(40, -600);
    ctx.closePath();
    ctx.fill();
  }
  ctx.restore();
  updateDragon(dt);
  drawDragon(ctx, dragon.x, dragon.y, dragon.scale, Math.min(STAGES.length - 1, level), 'happy', gameTime);
  updateParticles(ctx, dt);
  updateFloatingTexts(ctx, dt);
}

function handleGameOver(grid, dt, ctx) {
  gameTime += dt;
  stateTime += dt;
  ctx.drawImage(sprites.bg, 0, 0);
  renderSun(ctx);
  renderSparkles(ctx);
  // der Drache fliegt davon
  const fly = Math.min(1, stateTime / 3);
  if (stage() > 0) drawDragon(ctx, dragon.x + fly * 700, dragon.y - fly * 600, dragon.scale * (1 - fly * 0.6), stage(), 'sad', gameTime);
  else drawDragon(ctx, dragon.x, dragon.y, dragon.scale, 0, 'sad', gameTime);
  updateParticles(ctx, dt);
  updateFloatingTexts(ctx, dt);
  util.renderTextDropShadow({ ctx, text: 'Der Drache ist weg!', fontSize: '120px', fillStyle: COL.bad, shadowStyle: COL.shadow, x: W / 2, y: 190 });
  const m = Math.floor(stats.time / 60);
  const s = Math.floor(stats.time % 60);
  util.renderTextDropShadow({
    ctx,
    text:
      `${gameOverReason}\n` +
      `Level ${level} (${STAGES[stage()].name}) – ${Math.floor(score)} Punkte – ${m}:${String(s).padStart(2, '0')} min gepflegt\n` +
      `${stats.portions} Portionen, ${stats.balls} Bälle, ${stats.dunes} Dünen freigeleuchtet\n` +
      `${stats.jugs} Krüge gebracht (${stats.jugsLost} abgestürzt), ${stats.riddles} Rätsel gelöst\n` +
      `${stats.sleeps}× ausgeschlafen, ${stats.grumpy}× grantig`,
    fontSize: '42px',
    lineHeight: 60,
    dropDistX: 4,
    dropDistY: 4,
    fillStyle: COL.text,
    shadowStyle: COL.shadow,
    x: W / 2,
    y: 280,
  });
  buttonsGameOver.forEach((b) => b.handle(grid, dt));
  if (stateTime > 1.5 && keyPressedOnce('Space')) resetGame();
}

export default {
  name: 'Oasenhüter',
  description: `
Pflegt gemeinsam einen Wüstendrachen in der Oase!

Wasser, Schatten, Futter und Spielen sinken ständig.
Leuchtet die Stationen an (Brunnen, Sonnensegel, Dattelpalme) –
je mehr Laser, desto schneller kommt eine Portion beim Drachen an.
Teilt euch auf! Bleibt ein Bedürfnis zu lange leer, geht ein Herz verloren.

Schläft der Drache: NICHT anleuchten, sonst wird er grantig!
Gut versorgt wächst er vom Ei bis zum Drachenkönig.`,
  image: 'media/img/gametitles/laser-cowhorde-###4###.png',
  init: function () {
    updateColors();
    renderSprites();
    gameState = 'start';
    gameTime = 0;
    stateTime = 0;
    level = 1;
    score = 0;
    hearts = DIFFICULTY.hearts;
    growth = 0;
    resetNeeds();
    dragon = createDragon();
    stations = STATION_DEFS.map(createStation);
    sleep = null;
    ball = null;
    storm = null;
    well = null;
    riddle = null;
    grumpyLeft = 0;
    flyers = [];
    particles = [];
    stormDust = [];
    floatingTexts = [];
    buttonsStart = [startButton()];
    buttonsGameOver = [];
    previousKeys = {};
    lastTime = performance.now();
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
