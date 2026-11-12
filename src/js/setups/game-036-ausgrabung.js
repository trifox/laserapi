/**
 * Laser-Ausgrabung
 *
 * Kooperative Archäologie: Freilegen statt Abschiessen, Geduld statt Hektik.
 * - Der Bildschirm ist eine Erdschicht (gui/paintLayer im 'mask'-Modus). Lasern trägt die Erde ab.
 * - Darunter liegen pro Level zufällig verteilte Fundstücke (Knochen, Schädel, Amphore, Münze,
 *   Schwert, Ammonit). Ist DIFFICULTY.revealToCollect ihrer Fläche freigelegt, sind sie "bereit":
 *   jetzt muss der Kern des Fundes kurz unbeleuchtet bleiben, dann wird er geborgen (Vitrine rechts).
 * - Zerbrechlich: wird der Kern eines schon teilweise freigelegten Fundes weiter beleuchtet,
 *   bekommt er Risse und zerbricht (Punktabzug). Also am Rand graben und dann loslassen!
 * - Versteckte Wasseradern: wird dort gegraben, läuft Wasser aus und spült in der Umgebung
 *   wieder Erde drauf. Feuchte, dunklere Stellen in der Erde verraten sie.
 * - Metalldetektor: alle paar Sekunden pulsen Ringe über Funden in der Nähe beleuchteter Stellen
 *   (heiß / warm / lau), damit nicht der ganze Bildschirm umgegraben werden muss.
 * - Sonnenuntergang = Zeitlimit pro Level. Mindestens DIFFICULTY.requiredShare der Funde müssen
 *   geborgen sein, sonst ist die Grabung vorbei.
 * - Effizienz = geborgene Fundfläche / umgegrabene Fläche (getCoverage) -> Bonus am Levelende.
 *
 * Ausgelegt für viele Spieler: Graben wirkt über die beleuchtete Fläche (mehr Laser = schneller),
 * wildes Leuchten zerbricht Funde und sticht Wasseradern an.
 *
 * Tastatur ohne Laser: Leertaste = Start, G = gräbt am Rand eines zufälligen Fundes, H = Detektor-Puls.
 *
 * Alle Stellschrauben stehen gesammelt in DIFFICULTY.
 */

import util, { getRgbSpread, getRgbSpreadHex, removeItemFromArray } from '../util.js';
var laserConfig = require('../LaserApiConfig.js').default;
var MasterCanvas = require('../MasterCanvas').default;
var guiFillButton = require('./gui/fillButton').default;
var guiPaintLayer = require('./gui/paintLayer').default;
import soundCollect from '../../../public/media/369952__mischy__plop-1.wav';
import soundBreak from '../../../public/media/414346__bykgames__explosion-far.wav';
import soundWater from '../../../public/media/485066__javierserrat__object-falls-into-the-water.wav';
import soundSonar from '../../../public/media/72218__benboncan__sonar.wav';

const DIFFICULTY = {
  // Erde
  cellSize: 20, // interne Auflösung der Erdschicht in px
  digSpeedStart: 1.2, // Abtragen pro Sekunde bei voller Beleuchtung (1 = Zelle in 1s frei)
  digSpeedFactor: 0.88, // pro Level: härtere Erde
  digSpeedMin: 0.45,
  brushRadius: 40, // Pinsel in px: ein Laserpunkt gräbt auch etwas Umgebung frei
  revealedThreshold: 0.6, // ab diesem Wert gilt eine Erdzelle als abgetragen
  // Funde
  findsStart: 3,
  findsPerLevel: 1,
  findsMax: 9,
  findRadiusStart: 100, // px, Durchmesser also 200
  findRadiusPerLevel: -7,
  findRadiusMin: 62, // Durchmesser >= 120px
  findRadiusRandom: 0.12, // +- Anteil
  revealToCollect: 0.7, // Anteil freigelegter Fundfläche zum Bergen
  collectCalmTime: 1.0, // so lange muss der Kern danach unbeleuchtet bleiben
  requiredShare: 0.5, // Anteil der Funde, der bis Sonnenuntergang geborgen sein muss
  // Zerbrechlichkeit
  fragileFromStart: 0.4, // ab diesem Freilegungs-Anteil wird der Fund empfindlich
  fragileFromPerLevel: -0.03,
  fragileFromMin: 0.2,
  coreRadius: 0.6, // empfindlicher Kern als Anteil des Fundradius
  fullStressLit: 0.3, // Anteil beleuchteter Kern-Zellen für volle Riss-Geschwindigkeit
  breakTimeStart: 2.6, // Sekunden voller Beleuchtung bis zum Bruch
  breakTimePerLevel: -0.2,
  breakTimeMin: 1.0,
  stressHeal: 0.06, // Risse "beruhigen" sich pro Sekunde ohne Licht
  // Wasseradern
  veinsStart: 1,
  veinsPerLevel: 1,
  veinsMax: 7,
  veinRadius: 70,
  veinTrigger: 0.3, // abgetragener Anteil der Ader, ab dem sie platzt
  floodRadius: 290,
  floodDuration: 2.5,
  floodRefill: 0.9, // Erde pro Sekunde, die das Wasser zurückspült (Mitte)
  // Detektor
  detectorInterval: 6,
  detectorRanges: [160, 320, 480], // heiß / warm / lau
  detectorJitter: 35,
  // Zeit (Sonnenuntergang)
  levelTimeBase: 60,
  levelTimePerFind: 12,
  levelEndDuration: 5,
  gameOverLockTime: 2,
  // Punkte
  pointsBroken: -60,
  pointsFlood: -20,
  timeBonusPerSecond: 2,
  efficiencyBonusMax: 300,
};

const FIELD = { x: 0, y: 120, w: 1680, h: 960 };
const VITRINE = { x: 1690, y: 120, w: 230, h: 960 };
const CENTER_X = 1920 / 2;

const FIND_TYPES = [
  { key: 'bone', name: 'Knochen', value: 80 },
  { key: 'skull', name: 'Schädel', value: 120 },
  { key: 'amphora', name: 'Amphore', value: 100 },
  { key: 'coin', name: 'Münze', value: 150 },
  { key: 'sword', name: 'Schwert', value: 140 },
  { key: 'ammonite', name: 'Ammonit', value: 110 },
];

var gameState = 'start';
var level = 1;
var score = 0;
var gameTime = 0;
var timeLeft = 0;
var levelDuration = 0;
var levelEndTimer = 0;
var levelEndInfo = undefined;
var gameOverTime = 0;
var detectorTimer = 0;
var layer = undefined;
var pitCanvas = undefined;
var palette = undefined;
var finds = [];
var veins = [];
var floods = [];
var pings = [];
var shards = [];
var flyers = [];
var floatingTexts = [];
var startButtons = [];
var gameOverButtons = [];
var showcase = []; // alle geborgenen Funde (Sprites) für die End-Vitrine
var demoSprites = [];
var stats = undefined;
var activeSounds = [];
var previousKeys = {};
var lastTime = 0;

function getDelta() {
  var currentTime = performance.now();
  if (lastTime === 0) {
    lastTime = currentTime;
    return 0;
  }
  const elapsed = (currentTime - lastTime) / 1000;
  lastTime = currentTime;
  // gegen Sprünge nach Tab-Inaktivität
  return Math.min(elapsed, 0.1);
}

function levelValue(start, perLevel, min, max) {
  const v = start + perLevel * (level - 1);
  return Math.max(min, Math.min(max, v));
}

/** true nur im Frame, in dem die Taste gedrückt wird */
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

function stopAllSounds() {
  activeSounds.forEach((audio) => audio.pause());
  activeSounds = [];
}

function rgba(rgb, alpha, mul = 1) {
  return `rgba(${Math.round(Math.min(255, rgb[0] * mul))},${Math.round(
    Math.min(255, rgb[1] * mul)
  )},${Math.round(Math.min(255, rgb[2] * mul))},${alpha})`;
}

/** alle Farben aus der Laserfarbe abgeleitet, Erdtöne dunkel und entsättigt (nie Laserfarbe) */
function makePalette() {
  const tc = laserConfig.testColor;
  return {
    earth: getRgbSpread(tc, 0.08, 0.55, 0.36),
    earthHex: getRgbSpreadHex(tc, 0.08, 0.55, 0.36),
    earthLight: getRgbSpread(tc, 0.1, 0.45, 0.5),
    earthDark: getRgbSpread(tc, 0.06, 0.6, 0.22),
    stone: getRgbSpread(tc, 0.1, 0.08, 0.55),
    pit: getRgbSpread(tc, 0.07, 0.5, 0.13),
    bone: getRgbSpreadHex(tc, 0.12, 0.18, 0.92),
    boneShade: getRgbSpreadHex(tc, 0.12, 0.25, 0.6),
    gold: getRgbSpreadHex(tc, 0.13, 0.75, 0.95),
    goldDark: getRgbSpreadHex(tc, 0.12, 0.8, 0.55),
    clay: getRgbSpreadHex(tc, 0.07, 0.6, 0.75),
    clayDark: getRgbSpreadHex(tc, 0.06, 0.65, 0.4),
    metal: getRgbSpreadHex(tc, 0.55, 0.12, 0.82),
    metalDark: getRgbSpreadHex(tc, 0.55, 0.15, 0.45),
    fossil: getRgbSpreadHex(tc, 0.1, 0.25, 0.72),
    fossilDark: getRgbSpreadHex(tc, 0.1, 0.35, 0.4),
    crack: getRgbSpreadHex(tc, 0.07, 0.5, 0.08),
    water: getRgbSpread(tc, 0.55, 0.7, 0.9),
    hot: getRgbSpreadHex(tc, 0.15, 0.9, 1),
    warm: getRgbSpreadHex(tc, 0.35, 0.8, 1),
    cold: getRgbSpreadHex(tc, 0.6, 0.6, 0.9),
    warn: getRgbSpreadHex(tc, 0.5, 0.9, 1),
    good: getRgbSpreadHex(tc, 0.33, 0.8, 1),
    title: getRgbSpreadHex(tc, 0.12, 0.7, 1),
    text: getRgbSpreadHex(tc, 0.14, 0.3, 1),
    dim: getRgbSpreadHex(tc, 0.12, 0.3, 0.55),
    button: [
      getRgbSpreadHex(tc, 0.4),
      getRgbSpreadHex(tc, 0.5),
      getRgbSpreadHex(tc, 0.6),
    ],
  };
}

// ---------------------------------------------------------------------------
// Fundstücke als Vektorzeichnungen (Einheitskreis, Radius 1)
// ---------------------------------------------------------------------------

function drawBone(ctx, p) {
  ctx.fillStyle = p.bone;
  ctx.strokeStyle = p.boneShade;
  ctx.lineWidth = 0.05;
  ctx.beginPath();
  ctx.rect(-0.7, -0.14, 1.4, 0.28);
  ctx.fill();
  ctx.stroke();
  [-0.75, 0.75].forEach((x) => {
    [-0.17, 0.17].forEach((y) => {
      ctx.beginPath();
      ctx.arc(x, y, 0.22, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
    });
  });
  ctx.fillRect(-0.72, -0.13, 1.44, 0.26);
}

function drawSkull(ctx, p) {
  ctx.fillStyle = p.bone;
  ctx.strokeStyle = p.boneShade;
  ctx.lineWidth = 0.05;
  ctx.beginPath();
  ctx.arc(0, -0.15, 0.72, Math.PI * 0.85, Math.PI * 2.15);
  ctx.lineTo(0.42, 0.55);
  ctx.lineTo(-0.42, 0.55);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
  // Unterkiefer
  ctx.beginPath();
  ctx.rect(-0.36, 0.55, 0.72, 0.3);
  ctx.fill();
  ctx.stroke();
  // Augenhöhlen und Nase
  ctx.fillStyle = p.crack;
  [-0.28, 0.28].forEach((x) => {
    ctx.beginPath();
    ctx.ellipse(x, 0.0, 0.2, 0.17, 0, 0, Math.PI * 2);
    ctx.fill();
  });
  ctx.beginPath();
  ctx.moveTo(0, 0.2);
  ctx.lineTo(-0.09, 0.38);
  ctx.lineTo(0.09, 0.38);
  ctx.closePath();
  ctx.fill();
  // Zähne
  ctx.strokeStyle = p.boneShade;
  ctx.lineWidth = 0.04;
  for (let i = -2; i <= 2; i++) {
    ctx.beginPath();
    ctx.moveTo(i * 0.13, 0.55);
    ctx.lineTo(i * 0.13, 0.8);
    ctx.stroke();
  }
}

function drawAmphora(ctx, p) {
  ctx.fillStyle = p.clay;
  ctx.strokeStyle = p.clayDark;
  ctx.lineWidth = 0.06;
  // Henkel
  ctx.beginPath();
  ctx.arc(-0.32, -0.45, 0.2, Math.PI * 0.5, Math.PI * 1.6);
  ctx.stroke();
  ctx.beginPath();
  ctx.arc(0.32, -0.45, 0.2, Math.PI * 1.4, Math.PI * 0.5);
  ctx.stroke();
  // Körper
  ctx.beginPath();
  ctx.moveTo(-0.16, -0.85);
  ctx.lineTo(0.16, -0.85);
  ctx.lineTo(0.16, -0.55);
  ctx.quadraticCurveTo(0.65, -0.35, 0.5, 0.25);
  ctx.quadraticCurveTo(0.35, 0.75, 0.0, 0.92);
  ctx.quadraticCurveTo(-0.35, 0.75, -0.5, 0.25);
  ctx.quadraticCurveTo(-0.65, -0.35, -0.16, -0.55);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
  // Verzierung
  ctx.strokeStyle = p.clayDark;
  ctx.lineWidth = 0.05;
  [-0.2, 0.05, 0.3].forEach((y) => {
    ctx.beginPath();
    ctx.moveTo(-0.5, y);
    ctx.quadraticCurveTo(0, y + 0.08, 0.5, y);
    ctx.stroke();
  });
}

function drawCoin(ctx, p) {
  ctx.fillStyle = p.gold;
  ctx.strokeStyle = p.goldDark;
  ctx.lineWidth = 0.08;
  ctx.beginPath();
  ctx.arc(0, 0, 0.85, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();
  ctx.lineWidth = 0.04;
  ctx.beginPath();
  ctx.arc(0, 0, 0.68, 0, Math.PI * 2);
  ctx.stroke();
  // Punktkranz
  ctx.fillStyle = p.goldDark;
  for (let i = 0; i < 16; i++) {
    const a = (i / 16) * Math.PI * 2;
    ctx.beginPath();
    ctx.arc(Math.cos(a) * 0.76, Math.sin(a) * 0.76, 0.035, 0, Math.PI * 2);
    ctx.fill();
  }
  // stilisiertes Profil
  ctx.beginPath();
  ctx.arc(0.02, -0.08, 0.3, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.moveTo(-0.3, 0.5);
  ctx.quadraticCurveTo(0, 0.1, 0.3, 0.5);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = p.gold;
  ctx.beginPath();
  ctx.arc(0.12, -0.12, 0.05, 0, Math.PI * 2);
  ctx.fill();
}

function drawSword(ctx, p) {
  ctx.rotate(-Math.PI / 4);
  ctx.fillStyle = p.metal;
  ctx.strokeStyle = p.metalDark;
  ctx.lineWidth = 0.05;
  // Klinge
  ctx.beginPath();
  ctx.moveTo(-0.08, 0.3);
  ctx.lineTo(-0.08, -0.82);
  ctx.lineTo(0, -0.98);
  ctx.lineTo(0.08, -0.82);
  ctx.lineTo(0.08, 0.3);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(0, 0.25);
  ctx.lineTo(0, -0.85);
  ctx.stroke();
  // Parierstange, Griff, Knauf
  ctx.fillStyle = p.gold;
  ctx.strokeStyle = p.goldDark;
  ctx.beginPath();
  ctx.rect(-0.32, 0.3, 0.64, 0.1);
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = p.clayDark;
  ctx.fillRect(-0.06, 0.4, 0.12, 0.38);
  ctx.fillStyle = p.gold;
  ctx.beginPath();
  ctx.arc(0, 0.86, 0.1, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();
}

function drawAmmonite(ctx, p) {
  ctx.fillStyle = p.fossil;
  ctx.strokeStyle = p.fossilDark;
  ctx.lineWidth = 0.06;
  ctx.beginPath();
  ctx.arc(0, 0, 0.88, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();
  // Spirale
  ctx.beginPath();
  for (let t = 0; t <= Math.PI * 6; t += 0.1) {
    const r = 0.86 * Math.exp(-0.16 * (Math.PI * 6 - t));
    const x = Math.cos(t) * r;
    const y = Math.sin(t) * r;
    if (t === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  }
  ctx.stroke();
  // Rippen
  ctx.lineWidth = 0.03;
  for (let i = 0; i < 28; i++) {
    const t = Math.PI * 6 - i * 0.35;
    const r1 = 0.86 * Math.exp(-0.16 * (Math.PI * 6 - t));
    const r0 = 0.86 * Math.exp(-0.16 * (Math.PI * 6 - t + Math.PI * 2));
    ctx.beginPath();
    ctx.moveTo(Math.cos(t) * r0, Math.sin(t) * r0);
    ctx.lineTo(Math.cos(t) * r1, Math.sin(t) * r1);
    ctx.stroke();
  }
}

const DRAWERS = {
  bone: drawBone,
  skull: drawSkull,
  amphora: drawAmphora,
  coin: drawCoin,
  sword: drawSword,
  ammonite: drawAmmonite,
};

/** rendert ein Fundstück einmalig in ein Offscreen-Canvas */
function renderFindSprite(type, radius, angle) {
  const size = Math.ceil(radius * 2 + 8);
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');
  ctx.translate(size / 2, size / 2);
  ctx.rotate(angle);
  ctx.scale(radius, radius);
  ctx.lineJoin = 'round';
  ctx.lineCap = 'round';
  DRAWERS[type.key](ctx, palette);
  return canvas;
}

/** Erde mit Schichten, Klumpen, Steinen und feuchten Stellen über den Wasseradern */
function renderEarthTexture() {
  const canvas = document.createElement('canvas');
  canvas.width = FIELD.w;
  canvas.height = FIELD.h;
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = rgba(palette.earth, 1);
  ctx.fillRect(0, 0, FIELD.w, FIELD.h);
  // Erdschichten
  for (let i = 0; i < 7; i++) {
    const y = Math.random() * FIELD.h;
    const h = 40 + Math.random() * 110;
    ctx.fillStyle = Math.random() < 0.5 ? rgba(palette.earthLight, 0.25) : rgba(palette.earthDark, 0.3);
    ctx.beginPath();
    ctx.moveTo(0, y);
    for (let x = 0; x <= FIELD.w; x += 80) {
      ctx.lineTo(x, y + Math.sin(x * 0.004 + i) * 25);
    }
    for (let x = FIELD.w; x >= 0; x -= 80) {
      ctx.lineTo(x, y + h + Math.sin(x * 0.005 + i * 2) * 20);
    }
    ctx.closePath();
    ctx.fill();
  }
  // Klumpen
  for (let i = 0; i < 900; i++) {
    const shade = Math.random();
    ctx.fillStyle =
      shade < 0.5 ? rgba(palette.earthDark, 0.35) : rgba(palette.earthLight, 0.3);
    ctx.beginPath();
    ctx.ellipse(
      Math.random() * FIELD.w,
      Math.random() * FIELD.h,
      3 + Math.random() * 16,
      2 + Math.random() * 10,
      Math.random() * Math.PI,
      0,
      Math.PI * 2
    );
    ctx.fill();
  }
  // Steine
  for (let i = 0; i < 140; i++) {
    const x = Math.random() * FIELD.w;
    const y = Math.random() * FIELD.h;
    const r = 4 + Math.random() * 9;
    ctx.fillStyle = rgba(palette.stone, 0.8, 0.7 + Math.random() * 0.5);
    ctx.beginPath();
    for (let k = 0; k < 6; k++) {
      const a = (k / 6) * Math.PI * 2;
      const rr = r * (0.7 + Math.random() * 0.4);
      ctx.lineTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr);
    }
    ctx.closePath();
    ctx.fill();
  }
  // feuchte Stellen über den Wasseradern (subtiler Hinweis)
  veins.forEach((vein) => {
    const g = ctx.createRadialGradient(
      vein.x - FIELD.x,
      vein.y - FIELD.y,
      0,
      vein.x - FIELD.x,
      vein.y - FIELD.y,
      vein.r * 1.7
    );
    g.addColorStop(0, rgba(palette.earthDark, 0.45));
    g.addColorStop(1, rgba(palette.earthDark, 0));
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, FIELD.w, FIELD.h);
  });
  return canvas;
}

/** dunkler Grubenboden unter der Erde */
function renderPit() {
  const canvas = document.createElement('canvas');
  canvas.width = FIELD.w;
  canvas.height = FIELD.h;
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = rgba(palette.pit, 1);
  ctx.fillRect(0, 0, FIELD.w, FIELD.h);
  for (let i = 0; i < 400; i++) {
    ctx.fillStyle = rgba(palette.pit, 0.6, Math.random() < 0.5 ? 0.6 : 1.5);
    ctx.beginPath();
    ctx.arc(Math.random() * FIELD.w, Math.random() * FIELD.h, 2 + Math.random() * 8, 0, Math.PI * 2);
    ctx.fill();
  }
  return canvas;
}

function makeCracks(radius) {
  const cracks = [];
  for (let k = 0; k < 6; k++) {
    let a = Math.random() * Math.PI * 2;
    let x = (Math.random() - 0.5) * radius * 0.3;
    let y = (Math.random() - 0.5) * radius * 0.3;
    const points = [[x, y]];
    for (let s = 0; s < 4; s++) {
      a += (Math.random() - 0.5) * 1.2;
      const len = radius * (0.15 + Math.random() * 0.12);
      x += Math.cos(a) * len;
      y += Math.sin(a) * len;
      points.push([x, y]);
    }
    cracks.push(points);
  }
  return cracks;
}

// ---------------------------------------------------------------------------
// Level-Aufbau
// ---------------------------------------------------------------------------

function randomInField(margin) {
  return {
    x: FIELD.x + margin + Math.random() * (FIELD.w - 2 * margin),
    y: FIELD.y + margin + Math.random() * (FIELD.h - 2 * margin),
  };
}

function distance(a, b) {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

function createFinds(count, baseRadius) {
  const result = [];
  for (let k = 0; k < count; k++) {
    const r = baseRadius * (1 + (Math.random() * 2 - 1) * DIFFICULTY.findRadiusRandom);
    let pos = undefined;
    for (let tries = 0; tries < 300; tries++) {
      const p = randomInField(r + 25);
      if (result.every((f) => distance(f, p) > (f.r + r) * 1.25 + 30)) {
        pos = p;
        break;
      }
    }
    if (!pos) continue;
    const type = FIND_TYPES[Math.floor(Math.random() * FIND_TYPES.length)];
    result.push({
      type,
      x: pos.x,
      y: pos.y,
      r,
      sprite: renderFindSprite(type, r, Math.random() * Math.PI * 2),
      cracks: makeCracks(r),
      state: 'buried', // buried -> ready -> collected | broken
      reveal: 0,
      stress: 0,
      calm: 0,
      coreLit: 0,
      slot: k,
    });
  }
  return result;
}

function createVeins(count, findList) {
  const result = [];
  const r = DIFFICULTY.veinRadius;
  for (let k = 0; k < count; k++) {
    for (let tries = 0; tries < 300; tries++) {
      const p = randomInField(r);
      const freeOfFinds = findList.every((f) => distance(f, p) > f.r + r + 25);
      const freeOfVeins = result.every((v) => distance(v, p) > r * 3);
      if (freeOfFinds && freeOfVeins) {
        result.push({ x: p.x, y: p.y, r, burst: false });
        break;
      }
    }
  }
  return result;
}

function startLevel(newLevel) {
  level = newLevel;
  const count = Math.round(levelValue(DIFFICULTY.findsStart, DIFFICULTY.findsPerLevel, 1, DIFFICULTY.findsMax));
  const radius = levelValue(
    DIFFICULTY.findRadiusStart,
    DIFFICULTY.findRadiusPerLevel,
    DIFFICULTY.findRadiusMin,
    1000
  );
  const veinCount = Math.round(levelValue(DIFFICULTY.veinsStart, DIFFICULTY.veinsPerLevel, 0, DIFFICULTY.veinsMax));
  finds = createFinds(count, radius);
  veins = createVeins(veinCount, finds);
  floods = [];
  pings = [];
  shards = [];
  flyers = [];
  floatingTexts = [];

  const digSpeed = Math.max(
    DIFFICULTY.digSpeedMin,
    DIFFICULTY.digSpeedStart * Math.pow(DIFFICULTY.digSpeedFactor, level - 1)
  );
  layer = guiPaintLayer({
    posX: FIELD.x,
    posY: FIELD.y,
    width: FIELD.w,
    height: FIELD.h,
    cellSize: DIFFICULTY.cellSize,
    speedUp: digSpeed,
    speedDown: 0,
    brushRadius: DIFFICULTY.brushRadius,
    threshold: DIFFICULTY.revealedThreshold,
    render: 'mask',
    color: palette.earthHex, // nur ohne Textur sichtbar
    texture: renderEarthTexture(),
  });
  pitCanvas = renderPit();

  levelDuration = DIFFICULTY.levelTimeBase + DIFFICULTY.levelTimePerFind * finds.length;
  timeLeft = levelDuration;
  detectorTimer = DIFFICULTY.detectorInterval / 2;
  stats.levelStart = { collected: stats.collected, broken: stats.broken };
  gameState = 'game';
  addFloatingText(`Level ${level}`, FIELD.x + FIELD.w / 2, FIELD.y + FIELD.h / 2, palette.title, 90);
}

function resetGame() {
  palette = makePalette();
  score = 0;
  gameTime = 0;
  showcase = [];
  stats = {
    collected: 0,
    broken: 0,
    floods: 0,
    dugScreens: 0,
    efficiencySum: 0,
    levelsDone: 0,
    levelStart: { collected: 0, broken: 0 },
  };
  previousKeys = {};
  lastTime = performance.now();
  startLevel(1);
}

// ---------------------------------------------------------------------------
// Spiellogik
// ---------------------------------------------------------------------------

function addFloatingText(text, x, y, color, size = 45) {
  floatingTexts.push({ text, x, y, time: 0, duration: 1.8, color, size });
}

function requiredFinds() {
  return Math.max(1, Math.ceil(finds.length * DIFFICULTY.requiredShare));
}

function collectedThisLevel() {
  return finds.filter((f) => f.state === 'collected').length;
}

/** geborgene Fundfläche / umgegrabene Fläche, 0..1 (undefined solange kaum gegraben) */
function currentEfficiency() {
  const coverage = layer.getCoverage();
  if (coverage < 0.005) return undefined;
  const foundArea = finds
    .filter((f) => f.state === 'collected')
    .reduce((sum, f) => sum + Math.PI * f.r * f.r, 0);
  return Math.min(1, foundArea / (FIELD.w * FIELD.h) / coverage);
}

function collectFind(find) {
  find.state = 'collected';
  const points = Math.round(find.type.value * (1 - 0.5 * find.stress));
  score += points;
  stats.collected++;
  showcase.push(find);
  addFloatingText(`${find.type.name} +${points}`, find.x, find.y - find.r - 20, palette.good);
  flyers.push({ find, t: 0, duration: 1.2 });
  playSound(soundCollect);
}

function breakFind(find) {
  find.state = 'broken';
  score += DIFFICULTY.pointsBroken;
  stats.broken++;
  addFloatingText(`Zerbrochen! ${DIFFICULTY.pointsBroken}`, find.x, find.y - find.r - 20, palette.warn);
  const colors = [palette.bone, palette.clay, palette.gold, palette.metal, palette.fossil];
  for (let i = 0; i < 14; i++) {
    const a = Math.random() * Math.PI * 2;
    const speed = 150 + Math.random() * 350;
    shards.push({
      x: find.x,
      y: find.y,
      vx: Math.cos(a) * speed,
      vy: Math.sin(a) * speed - 200,
      rot: Math.random() * Math.PI,
      vrot: (Math.random() - 0.5) * 10,
      size: find.r * (0.15 + Math.random() * 0.2),
      color: colors[Math.floor(Math.random() * colors.length)],
      t: 0,
    });
  }
  playSound(soundBreak, 0.6);
}

function updateFind(find, elapsed) {
  if (find.state !== 'buried' && find.state !== 'ready') return;
  find.reveal = layer.getCoverageInCircle(find.x, find.y, find.r * 0.85);
  const fragileFrom = levelValue(
    DIFFICULTY.fragileFromStart,
    DIFFICULTY.fragileFromPerLevel,
    DIFFICULTY.fragileFromMin,
    1
  );
  const breakTime = levelValue(
    DIFFICULTY.breakTimeStart,
    DIFFICULTY.breakTimePerLevel,
    DIFFICULTY.breakTimeMin,
    100
  );
  find.coreLit = layer.getLitInCircle(find.x, find.y, find.r * DIFFICULTY.coreRadius);

  // Zerbrechlichkeit: Licht auf dem Kern eines teilweise freigelegten Fundes
  if (find.reveal >= fragileFrom && find.coreLit > 0) {
    find.stress += (elapsed * Math.min(1, find.coreLit / DIFFICULTY.fullStressLit)) / breakTime;
    if (find.stress >= 1) {
      breakFind(find);
      return;
    }
  } else {
    find.stress = Math.max(0, find.stress - DIFFICULTY.stressHeal * elapsed);
  }

  if (find.state === 'buried') {
    if (find.reveal >= DIFFICULTY.revealToCollect) {
      find.state = 'ready';
      find.calm = 0;
    }
  } else {
    // bereit: Kern muss kurz in Ruhe gelassen werden, Wasser kann ihn wieder zuschütten
    if (find.reveal < DIFFICULTY.revealToCollect - 0.1) {
      find.state = 'buried';
      return;
    }
    if (find.coreLit > 0) {
      find.calm = 0;
    } else {
      find.calm += elapsed;
      if (find.calm >= DIFFICULTY.collectCalmTime) {
        collectFind(find);
      }
    }
  }
}

function updateVeins() {
  veins.forEach((vein) => {
    if (vein.burst) return;
    if (layer.getCoverageInCircle(vein.x, vein.y, vein.r * 0.7) >= DIFFICULTY.veinTrigger) {
      vein.burst = true;
      stats.floods++;
      score += DIFFICULTY.pointsFlood;
      floods.push({ x: vein.x, y: vein.y, t: 0 });
      addFloatingText(`Wasserader! ${DIFFICULTY.pointsFlood}`, vein.x, vein.y - 60, palette.cold);
      playSound(soundWater);
    }
  });
}

function floodRadius(flood) {
  const p = Math.min(1, flood.t / DIFFICULTY.floodDuration);
  return DIFFICULTY.floodRadius * (0.3 + 0.7 * (1 - Math.pow(1 - p, 2)));
}

function updateFloods(elapsed) {
  floods.slice().forEach((flood) => {
    flood.t += elapsed;
    if (flood.t < DIFFICULTY.floodDuration) {
      // Wasser spült Erde zurück (Werte runter = wieder zugedeckt)
      layer.addInCircle(flood.x, flood.y, floodRadius(flood), -DIFFICULTY.floodRefill * elapsed, 0.5);
    } else if (flood.t > DIFFICULTY.floodDuration + 2) {
      removeItemFromArray(floods, flood);
    }
  });
}

/** Metalldetektor: Ringe über Funden in der Nähe beleuchteter Stellen (force = alle, Tastatur-Test) */
function detectorPulse(force) {
  let any = false;
  const ranges = DIFFICULTY.detectorRanges;
  finds.forEach((find) => {
    if (find.state !== 'buried') return;
    let heat = -1;
    for (let k = 0; k < ranges.length; k++) {
      if (layer.getLitInCircle(find.x, find.y, ranges[k]) > 0) {
        heat = k;
        break;
      }
    }
    if (force && heat < 0) heat = ranges.length - 1;
    if (heat < 0) return;
    any = true;
    const jitter = DIFFICULTY.detectorJitter;
    pings.push({
      x: find.x + (Math.random() * 2 - 1) * jitter,
      y: find.y + (Math.random() * 2 - 1) * jitter,
      r: find.r,
      heat,
      t: 0,
    });
  });
  if (any) playSound(soundSonar, 0.5);
}

/** Tastatur-Test: gräbt am Rand eines zufälligen Fundes ein Stück frei */
function digRandom() {
  const candidates = finds.filter((f) => f.state === 'buried' || f.state === 'ready');
  if (candidates.length === 0) return;
  const find = candidates[Math.floor(Math.random() * candidates.length)];
  const a = Math.random() * Math.PI * 2;
  layer.addInCircle(find.x + Math.cos(a) * find.r * 0.9, find.y + Math.sin(a) * find.r * 0.9, 70, 0.8, 0.5);
}

function finishLevel() {
  const total = finds.length;
  const collected = collectedThisLevel();
  const success = collected >= requiredFinds();
  const allDone = finds.every((f) => f.state === 'collected' || f.state === 'broken');
  const coverage = layer.getCoverage();
  const efficiency = currentEfficiency() || 0;
  const timeBonus = success && allDone ? Math.round(timeLeft * DIFFICULTY.timeBonusPerSecond) : 0;
  const efficiencyBonus = success
    ? Math.round(efficiency * DIFFICULTY.efficiencyBonusMax * (collected / Math.max(1, total)))
    : 0;
  score += timeBonus + efficiencyBonus;
  stats.dugScreens += coverage;
  stats.efficiencySum += efficiency;
  stats.levelsDone++;
  levelEndInfo = { success, collected, total, coverage, efficiency, timeBonus, efficiencyBonus };
  if (success) {
    gameState = 'levelEnd';
    levelEndTimer = DIFFICULTY.levelEndDuration;
  } else {
    gameState = 'gameover';
    gameOverTime = 0;
    gameOverButtons = createGameOverButtons();
  }
}

// ---------------------------------------------------------------------------
// Buttons
// ---------------------------------------------------------------------------

function createStartButtons() {
  return [
    guiFillButton({
      label: 'Start',
      posX: CENTER_X,
      posY: 830,
      radius: 150,
      speedUp: 25,
      speedDown: 12,
      edges: 7,
      angle: Math.random() * Math.PI,
      activeValue: 90,
      normalColor: palette.button[0],
      activeColor: palette.button[1],
      growColor: palette.button[2],
      onEnterActive: () => resetGame(),
    }),
  ];
}

function createGameOverButtons() {
  return [
    guiFillButton({
      label: 'Neu',
      posX: 1700,
      posY: 920,
      radius: 120,
      speedUp: 25,
      speedDown: 12,
      edges: 7,
      angle: Math.random() * Math.PI,
      activeValue: 90,
      normalColor: palette.button[0],
      activeColor: palette.button[1],
      growColor: palette.button[2],
      onEnterActive: () => resetGame(),
    }),
  ];
}

// ---------------------------------------------------------------------------
// Zeichnen
// ---------------------------------------------------------------------------

function drawFinds(ctx) {
  finds.forEach((find) => {
    if (find.state !== 'buried' && find.state !== 'ready') return;
    const s = find.sprite;
    ctx.drawImage(s, find.x - s.width / 2, find.y - s.height / 2);
    const crackCount = Math.ceil(find.stress * find.cracks.length);
    if (crackCount > 0) {
      ctx.save();
      ctx.strokeStyle = palette.crack;
      ctx.lineWidth = 5;
      ctx.lineCap = 'round';
      for (let k = 0; k < crackCount; k++) {
        const pts = find.cracks[k];
        ctx.beginPath();
        ctx.moveTo(find.x + pts[0][0], find.y + pts[0][1]);
        for (let i = 1; i < pts.length; i++) ctx.lineTo(find.x + pts[i][0], find.y + pts[i][1]);
        ctx.stroke();
      }
      ctx.restore();
    }
  });
}

/** Fortschritt, Warnungen und "Loslassen" über der Erde */
function drawFindOverlays(ctx) {
  const blink = Math.floor(gameTime * 6) % 2 === 0;
  finds.forEach((find) => {
    if (find.state !== 'buried' && find.state !== 'ready') return;
    if (find.reveal < 0.1 && find.stress <= 0) return;
    ctx.save();
    // Freilegungs-Fortschritt als Bogen
    ctx.lineWidth = 8;
    ctx.strokeStyle = find.state === 'ready' ? palette.good : palette.dim;
    ctx.beginPath();
    const progress = Math.min(1, find.reveal / DIFFICULTY.revealToCollect);
    ctx.arc(find.x, find.y, find.r + 14, -Math.PI / 2, -Math.PI / 2 + progress * Math.PI * 2);
    ctx.stroke();
    if (find.state === 'ready') {
      // Ruhe-Fortschritt innen
      ctx.lineWidth = 6;
      ctx.beginPath();
      ctx.arc(
        find.x,
        find.y,
        find.r + 28,
        -Math.PI / 2,
        -Math.PI / 2 + (find.calm / DIFFICULTY.collectCalmTime) * Math.PI * 2
      );
      ctx.stroke();
    }
    ctx.restore();

    const stressed = find.stress > 0.05 && find.coreLit > 0;
    if (stressed && blink) {
      util.drawNgon({
        ctx,
        color: palette.warn,
        Xcenter: find.x,
        Ycenter: find.y,
        size: find.r * DIFFICULTY.coreRadius,
        numberOfSides: 24,
        lineWidth: 6,
      });
    }
    if (stressed || find.state === 'ready') {
      util.renderTextDropShadow({
        ctx,
        text: stressed ? 'Vorsicht!' : 'Loslassen!',
        fontSize: '40px',
        dropDistX: 3,
        dropDistY: 3,
        fillStyle: stressed ? palette.warn : palette.good,
        x: find.x,
        y: find.y - find.r - 40,
      });
    }
  });
}

function drawFloods(ctx) {
  floods.forEach((flood) => {
    const r = floodRadius(flood);
    const fade =
      flood.t < DIFFICULTY.floodDuration ? 1 : Math.max(0, 1 - (flood.t - DIFFICULTY.floodDuration) / 2);
    const g = ctx.createRadialGradient(flood.x, flood.y, 0, flood.x, flood.y, r);
    g.addColorStop(0, rgba(palette.water, 0.55 * fade));
    g.addColorStop(0.8, rgba(palette.water, 0.3 * fade));
    g.addColorStop(1, rgba(palette.water, 0));
    ctx.save();
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(flood.x, flood.y, r, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = rgba(palette.water, 0.7 * fade, 1.2);
    ctx.lineWidth = 3;
    for (let k = 0; k < 3; k++) {
      const rr = ((flood.t * 120 + k * 60) % r) + 10;
      ctx.beginPath();
      ctx.arc(flood.x, flood.y, rr, 0, Math.PI * 2);
      ctx.stroke();
    }
    ctx.restore();
  });
}

function drawPings(ctx, elapsed) {
  const heatColors = [palette.hot, palette.warm, palette.cold];
  const heatNames = ['heiß', 'warm', 'lau'];
  const duration = 1.6;
  pings.slice().forEach((ping) => {
    ping.t += elapsed;
    if (ping.t >= duration) {
      removeItemFromArray(pings, ping);
      return;
    }
    const color = heatColors[ping.heat];
    for (let k = 0; k < 3; k++) {
      const local = (ping.t - k * 0.2) / (duration - 0.4);
      if (local < 0 || local > 1) continue;
      ctx.save();
      ctx.globalAlpha = 1 - local;
      util.drawNgon({
        ctx,
        color,
        Xcenter: ping.x,
        Ycenter: ping.y,
        size: 30 + local * ping.r * (1.6 + ping.heat * 0.6),
        numberOfSides: 32,
        lineWidth: 8 - ping.heat * 2,
      });
      ctx.restore();
    }
    ctx.save();
    ctx.globalAlpha = Math.max(0, 1 - ping.t / duration);
    util.renderTextDropShadow({
      ctx,
      text: heatNames[ping.heat],
      fontSize: '40px',
      dropDistX: 3,
      dropDistY: 3,
      fillStyle: color,
      x: ping.x,
      y: ping.y + 14,
    });
    ctx.restore();
  });
}

function drawShards(ctx, elapsed) {
  shards.slice().forEach((s) => {
    s.t += elapsed;
    if (s.t > 1.3) {
      removeItemFromArray(shards, s);
      return;
    }
    s.vy += 700 * elapsed;
    s.x += s.vx * elapsed;
    s.y += s.vy * elapsed;
    s.rot += s.vrot * elapsed;
    ctx.save();
    ctx.globalAlpha = Math.max(0, 1 - s.t / 1.3);
    ctx.translate(s.x, s.y);
    ctx.rotate(s.rot);
    ctx.fillStyle = s.color;
    ctx.beginPath();
    ctx.moveTo(-s.size, -s.size * 0.4);
    ctx.lineTo(s.size, -s.size * 0.2);
    ctx.lineTo(0, s.size * 0.7);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  });
}

function slotRect(index, count) {
  const top = VITRINE.y + 70;
  const slotH = Math.min(150, (VITRINE.h - 80) / Math.max(1, count));
  return { x: VITRINE.x + VITRINE.w / 2, y: top + slotH * (index + 0.5), size: slotH * 0.8 };
}

function drawVitrine(ctx) {
  ctx.save();
  ctx.fillStyle = rgba(palette.pit, 1, 1.4);
  ctx.fillRect(VITRINE.x, VITRINE.y, VITRINE.w, VITRINE.h);
  ctx.strokeStyle = palette.dim;
  ctx.lineWidth = 4;
  ctx.strokeRect(VITRINE.x + 2, VITRINE.y + 2, VITRINE.w - 4, VITRINE.h - 4);
  ctx.restore();
  util.renderText({
    ctx,
    text: 'Vitrine',
    fontSize: '40px',
    fillStyle: palette.text,
    x: VITRINE.x + VITRINE.w / 2,
    y: VITRINE.y + 50,
  });
  finds.forEach((find) => {
    const slot = slotRect(find.slot, finds.length);
    const flying = flyers.some((f) => f.find === find);
    ctx.save();
    if (find.state === 'collected' && !flying) {
      ctx.drawImage(find.sprite, slot.x - slot.size / 2, slot.y - slot.size / 2, slot.size, slot.size);
    } else if (find.state === 'broken') {
      ctx.strokeStyle = palette.warn;
      ctx.lineWidth = 6;
      const h = slot.size * 0.3;
      ctx.beginPath();
      ctx.moveTo(slot.x - h, slot.y - h);
      ctx.lineTo(slot.x + h, slot.y + h);
      ctx.moveTo(slot.x + h, slot.y - h);
      ctx.lineTo(slot.x - h, slot.y + h);
      ctx.stroke();
    } else {
      ctx.strokeStyle = palette.dim;
      ctx.setLineDash([10, 8]);
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(slot.x, slot.y, slot.size * 0.4, 0, Math.PI * 2);
      ctx.stroke();
    }
    ctx.restore();
  });
}

function drawFlyers(ctx, elapsed) {
  flyers.slice().forEach((flyer) => {
    flyer.t += elapsed;
    const p = Math.min(1, flyer.t / flyer.duration);
    const e = p * p * (3 - 2 * p);
    const find = flyer.find;
    const slot = slotRect(find.slot, finds.length);
    const size = find.sprite.width + (slot.size - find.sprite.width) * e;
    const x = find.x + (slot.x - find.x) * e;
    const y = find.y + (slot.y - find.y) * e - Math.sin(p * Math.PI) * 150;
    ctx.drawImage(find.sprite, x - size / 2, y - size / 2, size, size);
    if (p >= 1) removeItemFromArray(flyers, flyer);
  });
}

function drawFloatingTexts(ctx, elapsed) {
  floatingTexts.slice().forEach((t) => {
    t.time += elapsed;
    if (t.time >= t.duration) {
      removeItemFromArray(floatingTexts, t);
      return;
    }
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
  });
}

/** Sonnenuntergang: je weniger Zeit, desto dunkler/wärmer die Grabung */
function drawSunset(ctx) {
  const p = 1 - timeLeft / levelDuration;
  if (p < 0.6) return;
  const alpha = ((p - 0.6) / 0.4) * 0.45;
  ctx.save();
  ctx.fillStyle = rgba(getRgbSpread(laserConfig.testColor, 0.7, 0.7, 0.25), alpha);
  ctx.fillRect(FIELD.x, FIELD.y, FIELD.w, FIELD.h);
  ctx.restore();
}

function formatTime(seconds) {
  const s = Math.max(0, Math.ceil(seconds));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}

function drawHud(ctx) {
  const eff = currentEfficiency();
  util.renderTextDropShadow({
    ctx,
    text: `Level ${level}   Funde ${collectedThisLevel()}/${finds.length} (mind. ${requiredFinds()})   Punkte ${score}`,
    fontSize: '45px',
    dropDistX: 3,
    dropDistY: 3,
    align: 'left',
    fillStyle: palette.text,
    x: 30,
    y: 75,
  });
  util.renderTextDropShadow({
    ctx,
    text: `Effizienz ${eff === undefined ? '--' : Math.round(eff * 100) + '%'}   ${formatTime(timeLeft)}`,
    fontSize: '45px',
    dropDistX: 3,
    dropDistY: 3,
    align: 'right',
    fillStyle: timeLeft < 15 && Math.floor(gameTime * 2) % 2 === 0 ? palette.warn : palette.text,
    x: 1780,
    y: 75,
  });
  // Sonne, die hinter dem Horizont versinkt
  const p = 1 - timeLeft / levelDuration;
  ctx.save();
  ctx.beginPath();
  ctx.rect(1800, 0, 120, 112);
  ctx.clip();
  ctx.fillStyle = palette.hot;
  ctx.beginPath();
  ctx.arc(1860, 45 + p * 90, 35, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
  ctx.save();
  ctx.strokeStyle = palette.dim;
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(1800, 112);
  ctx.lineTo(1920, 112);
  ctx.stroke();
  ctx.restore();
}

/** Spielfeld komplett zeichnen; withInput = Grid wird eingelesen */
function drawField(ctx, grid, elapsed, withInput) {
  ctx.drawImage(pitCanvas, FIELD.x, FIELD.y);
  drawFinds(ctx);
  if (withInput) {
    layer.handle(grid, elapsed);
  } else {
    layer.draw(ctx);
  }
  drawFloods(ctx);
  drawFindOverlays(ctx);
  drawPings(ctx, elapsed);
  drawShards(ctx, elapsed);
  drawSunset(ctx);
  drawVitrine(ctx);
  drawFlyers(ctx, elapsed);
  drawFloatingTexts(ctx, elapsed);
  drawHud(ctx);
}

function drawShowcase(ctx, y) {
  const size = 100;
  const perRow = 12;
  const items = showcase.slice(0, perRow * 2);
  const rowCount = Math.min(perRow, items.length);
  items.forEach((find, i) => {
    const row = Math.floor(i / perRow);
    const col = i % perRow;
    const inRow = row === 0 ? rowCount : items.length - perRow;
    const x = CENTER_X - ((inRow - 1) * (size + 10)) / 2 + col * (size + 10);
    ctx.drawImage(find.sprite, x - size / 2, y + row * (size + 10), size, size);
  });
  if (showcase.length > items.length) {
    util.renderText({
      ctx,
      text: `+${showcase.length - items.length} weitere`,
      fontSize: '40px',
      fillStyle: palette.dim,
      x: CENTER_X,
      y: y + 2 * (size + 10) + 40,
    });
  }
  if (showcase.length === 0) {
    util.renderText({
      ctx,
      text: '(leer)',
      fontSize: '40px',
      fillStyle: palette.dim,
      x: CENTER_X,
      y: y + 60,
    });
  }
}

export default {
  name: 'Laser-Ausgrabung',
  description: `
Laser-Ausgrabung: gemeinsam Fundstücke freilegen!

Unter der Erde liegen Knochen, Schädel, Amphoren, Münzen, Schwerter und Ammoniten.
Wo ihr hinleuchtet, wird Erde abgetragen. Ist ein Fund grösstenteils frei,
leuchtet sein Ring grün: jetzt LOSLASSEN, dann wird er geborgen und kommt in die Vitrine.

Vorsicht, die Funde sind zerbrechlich! Wer auf die Mitte eines schon halb
freigelegten Fundes leuchtet, macht Risse hinein, bis er zerbricht.
Grabt am Rand und lasst die Mitte in Ruhe.

Unter dunklen, feuchten Stellen liegen Wasseradern. Grabt ihr sie an,
spült das Wasser die Erde ringsum wieder zu.

Der Metalldetektor piept alle paar Sekunden über Funden in der Nähe eurer Laser:
heiß, warm oder lau. Wer gezielt sucht statt alles umzugraben, bekommt Effizienz-Bonus.

Bis Sonnenuntergang muss mindestens die Hälfte der Funde geborgen sein.
Tipp: Verteilt euch, jeder Fund braucht nur wenige Laser am Rand!`,
  image: 'media/img/gametitles/laser-shark-###4###.png',

  init: function () {
    console.log('init game ausgrabung');
    palette = makePalette();
    gameState = 'start';
    previousKeys = {};
    lastTime = 0;
    startButtons = createStartButtons();
    gameOverButtons = [];
    finds = [];
    showcase = [];
    demoSprites = FIND_TYPES.map((type) => ({ type, sprite: renderFindSprite(type, 70, 0) }));
  },

  stop: function () {
    stopAllSounds();
  },

  handle: function (grid) {
    const elapsed = getDelta();
    switch (gameState) {
      case 'start':
        this.handleStartScreen(grid, elapsed);
        break;
      case 'game':
        this.handleGameScreen(grid, elapsed);
        break;
      case 'levelEnd':
        this.handleLevelEndScreen(grid, elapsed);
        break;
      case 'gameover':
        this.handleGameOverScreen(grid, elapsed);
        break;
    }
  },

  handleStartScreen(grid, elapsed) {
    const ctx = MasterCanvas.get2dContext();
    util.renderTextDropShadow({
      ctx,
      text: 'Laser-Ausgrabung',
      fontSize: '150px',
      fillStyle: palette.title,
      x: CENTER_X,
      y: 190,
    });
    util.renderTextDropShadow({
      ctx,
      text: 'Leuchtet die Erde weg, grabt am Rand und lasst die Funde dann los!\nZu viel Licht auf der Mitte zerbricht sie.',
      fontSize: '45px',
      lineHeight: 65,
      dropDistX: 4,
      dropDistY: 4,
      fillStyle: palette.text,
      x: CENTER_X,
      y: 300,
    });
    demoSprites.forEach((demo, i) => {
      const x = CENTER_X + (i - (demoSprites.length - 1) / 2) * 260;
      ctx.drawImage(demo.sprite, x - demo.sprite.width / 2, 470 - demo.sprite.height / 2);
      util.renderText({
        ctx,
        text: demo.type.name,
        fontSize: '36px',
        fillStyle: palette.text,
        x,
        y: 600,
      });
    });

    startButtons.slice().forEach((button) => button.handle(grid, elapsed));
    if (gameState !== 'start') return;
    util.renderTextDropShadow({
      ctx,
      text: 'Ohne Laser: Leertaste startet, G gräbt, H Detektor',
      fontSize: '30px',
      dropDistX: 2,
      dropDistY: 2,
      fillStyle: palette.dim,
      x: CENTER_X,
      y: 1040,
    });
    if (keyPressedOnce('Space')) {
      resetGame();
    }
  },

  handleGameScreen(grid, elapsed) {
    const ctx = MasterCanvas.get2dContext();
    gameTime += elapsed;
    timeLeft -= elapsed;

    if (keyPressedOnce('KeyG')) digRandom();
    if (keyPressedOnce('KeyH')) detectorPulse(true);
    keyPressedOnce('Space'); // Tastenzustand mitführen

    detectorTimer -= elapsed;
    if (detectorTimer <= 0) {
      detectorTimer = DIFFICULTY.detectorInterval;
      detectorPulse(false);
    }

    // Logik nutzt die Werte des letzten Frames, die Erdschicht liest das Grid beim Zeichnen ein
    finds.slice().forEach((find) => updateFind(find, elapsed));
    updateVeins();
    updateFloods(elapsed);

    drawField(ctx, grid, elapsed, true);

    const allDone = finds.every((f) => f.state === 'collected' || f.state === 'broken');
    if ((allDone && flyers.length === 0) || timeLeft <= 0) {
      finishLevel();
    }
  },

  handleLevelEndScreen(grid, elapsed) {
    const ctx = MasterCanvas.get2dContext();
    levelEndTimer -= elapsed;
    drawField(ctx, grid, elapsed, false);
    const info = levelEndInfo;
    ctx.save();
    ctx.fillStyle = 'rgba(0,0,0,0.6)';
    ctx.fillRect(260, 280, 1400, 560);
    ctx.restore();
    util.renderTextDropShadow({
      ctx,
      text: `Level ${level} geschafft!`,
      fontSize: '110px',
      fillStyle: palette.title,
      x: FIELD.x + FIELD.w / 2 + 120,
      y: 410,
    });
    util.renderTextDropShadow({
      ctx,
      text: `${info.collected} von ${info.total} Funden geborgen
Umgegraben ${Math.round(info.coverage * 100)}%  ·  Effizienz ${Math.round(info.efficiency * 100)}%
Effizienz-Bonus +${info.efficiencyBonus}   Zeit-Bonus +${info.timeBonus}`,
      fontSize: '45px',
      lineHeight: 70,
      dropDistX: 3,
      dropDistY: 3,
      fillStyle: palette.text,
      x: FIELD.x + FIELD.w / 2 + 120,
      y: 530,
    });
    util.renderTextDropShadow({
      ctx,
      text: `Nächste Grabung in ${Math.max(0, Math.ceil(levelEndTimer))}...`,
      fontSize: '45px',
      dropDistX: 3,
      dropDistY: 3,
      fillStyle: palette.good,
      x: FIELD.x + FIELD.w / 2 + 120,
      y: 790,
    });
    if (levelEndTimer <= 0) {
      startLevel(level + 1);
    }
  },

  handleGameOverScreen(grid, elapsed) {
    gameOverTime += elapsed;
    const ctx = MasterCanvas.get2dContext();
    util.renderTextDropShadow({
      ctx,
      text: 'Die Sonne ist untergegangen',
      fontSize: '110px',
      fillStyle: palette.title,
      x: CENTER_X,
      y: 150,
    });
    const avgEff = stats.levelsDone > 0 ? stats.efficiencySum / stats.levelsDone : 0;
    util.renderTextDropShadow({
      ctx,
      text: `Level ${level} erreicht  ·  ${score} Punkte
Funde geborgen: ${stats.collected}   zerbrochen: ${stats.broken}   Wasseradern: ${stats.floods}
Umgegrabene Fläche: ${stats.dugScreens.toFixed(1)} Bildschirme  ·  Effizienz ${Math.round(avgEff * 100)}%`,
      fontSize: '45px',
      lineHeight: 70,
      dropDistX: 4,
      dropDistY: 4,
      fillStyle: palette.text,
      x: CENTER_X,
      y: 270,
    });
    util.renderTextDropShadow({
      ctx,
      text: 'Eure Vitrine',
      fontSize: '50px',
      dropDistX: 3,
      dropDistY: 3,
      fillStyle: palette.title,
      x: CENTER_X,
      y: 520,
    });
    drawShowcase(ctx, 560);

    if (gameOverTime < DIFFICULTY.gameOverLockTime) {
      keyPressedOnce('Space'); // Tastenzustand mitführen
      return;
    }
    gameOverButtons.slice().forEach((button) => button.handle(grid, elapsed));
    if (gameState !== 'gameover') return;
    util.renderTextDropShadow({
      ctx,
      text: 'Neue Grabung: Laser auf den Knopf oder Leertaste',
      fontSize: '40px',
      dropDistX: 3,
      dropDistY: 3,
      align: 'right',
      fillStyle: palette.text,
      x: 1520,
      y: 1040,
    });
    if (keyPressedOnce('Space')) {
      resetGame();
    }
  },
};
