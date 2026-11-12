/**
 * Sandburg-Flut
 *
 * Am Strand zwischen Wald und Meer baut das ganze Publikum gemeinsam Sandburgen.
 * - Pro Level erscheint ein Bauplan (gestrichelt): Mauer, Türme, später ein Bergfried.
 * - Laser schütten Sand auf (gui/paintLayer, 'paint'): mehr Laser = schneller bauen (Teamwork).
 *   Ist ein Bauteil zu DIFFICULTY.partDone gefüllt, wird es zur fertigen Burgmauer mit Zinnen und Fahne.
 * - Wellen spülen den unteren Teil wieder weg. Die Flut steigt im Laufe des Levels, am Ende des
 *   Timers kommt die grosse Welle. Ist die Burg bis dahin nicht fertig: zwei Erdbeeren weg, neuer Versuch.
 * - Erdbeeren sind die Leben. Zwei Picknickdecken liegen am Strand: wer Sand darauf schüttet,
 *   versandet die Erdbeeren (-1). Wildes Herumleuchten lohnt sich also nicht.
 * - Sand ausserhalb des Bauplans ist verschwendet und drückt den Effizienz-Bonus.
 *
 * Neue Elemente:
 * - Level 2: Krabben laufen aus dem Meer zu den Picknickdecken und klauen Erdbeeren.
 *            Anleuchten verscheucht sie. Unterwegs graben sie Löcher in die Burg.
 * - Level 3: grössere Burgen mit Bergfried.
 * - Level 4: Möwen landen auf der Burg und picken Löcher hinein. Anleuchten verscheucht sie.
 * - Level 5+: Sturmflut – höhere und häufigere Wellen.
 *
 * Eingabe nur über GUI-Komponenten: gui/paintLayer (Sand), gui/pixelFillButton (Krabben, Möwen).
 *
 * Tastatur-Test: Space = Start, B = ein Stück Burg bauen, C = alle Tiere verscheuchen, L = Level fertig.
 *
 * Alle Stellschrauben stehen gesammelt in DIFFICULTY.
 */

import util, { getRgbSpreadHex, removeItemFromArray } from '../util.js';
var laserConfig = require('../LaserApiConfig.js').default;
var MasterCanvas = require('../MasterCanvas').default;
var guiFillButton = require('./gui/fillButton').default;
var guiPixelFillButton = require('./gui/pixelFillButton').default;
var guiPaintLayer = require('./gui/paintLayer').default;
import soundPop from '../../../public/media/369952__mischy__plop-1.wav';
import soundSplash from '../../../public/media/485066__javierserrat__object-falls-into-the-water.wav';
import soundBoom from '../../../public/media/414346__bykgames__explosion-far.wav';
import soundLevel from '../../../public/media/521966__kastenfrosch__ready-to-start-jingle.ogg';

const DIFFICULTY = {
  strawberries: 6, // Leben
  // Bauen
  paintSpeed: 0.15, // Füllung pro Sekunde einer beleuchteten Sandzelle (1 = in 1 s voll)
  completeGoal: 0.9, // Anteil des Bauplans, ab dem die Burg fertig ist
  partDone: 0.9, // Anteil eines Bauteils, ab dem es als fertig gezeichnet wird
  partBroken: 0.7, // darunter zerfällt ein fertiges Teil wieder zu Sand
  // Zeit bis zur grossen Flut
  tideTimeStart: 70,
  tideTimePerLevel: 8,
  // Burg
  castleWidthStart: 520,
  castleWidthPerLevel: 120,
  castleWidthMax: 1200,
  towerHeightStart: 190,
  towerHeightPerLevel: 15,
  towerHeightMax: 300,
  keepLevel: 3,
  // Wellen
  waveIntervalStart: 7,
  waveIntervalFactor: 0.9,
  waveIntervalMin: 3,
  waveReachStart: 70, // px vom Meer aus nach oben
  waveReachPerLevel: 15,
  waveReachTide: 90, // zusätzliche Reichweite, wenn die Flut steigt (Timer läuft ab)
  waveErode: 0.45, // Abtrag pro Sekunde an der Wellenfront
  stormLevel: 5,
  // Krabben
  crabLevel: 2,
  crabIntervalStart: 9,
  crabIntervalPerLevel: -0.8,
  crabIntervalMin: 3.5,
  crabSpeed: 70,
  crabShooTime: 0.7,
  crabDig: 0.5,
  // Möwen
  gullLevel: 4,
  gullInterval: 10,
  gullPeck: 0.4,
  gullShooTime: 0.8,
  // Picknick
  picnicSandLimit: 0.3, // Durchschnittlicher Sand auf der Decke, ab dem die Erdbeeren versanden
  // Punkte
  scorePart: 50,
  scoreCastle: 300,
  scoreShoo: 20,
  timeBonusPerSecond: 5,
  maxParticles: 400,
};

const W = 1920;
const H = 1080;
const FOREST_Y = 250; // Waldrand
const SEA_Y = 820; // Wasserlinie
const BEACH_Y = FOREST_Y;
const CELL = 20;
const BASE_Y = 770; // Burg-Unterkante
const PICNICS = [
  { x: 180, y: 370 },
  { x: 1740, y: 370 },
];

// --- Zustand ---
var gameState = 'start';
var level = 1;
var score = 0;
var berries = DIFFICULTY.strawberries;
var gameTime = 0;
var stateTime = 0;
var tideLeft = 0;
var tideTotal = 1;
var sand = null; // paintLayer
var parts = [];
var partOf = null; // Int16Array: Zelle -> Bauteil (-1 = ausserhalb)
var blueprintCells = [];
var waste = 0;
var waves = [];
var waveTimer = 0;
var crabs = [];
var crabTimer = 0;
var gulls = [];
var gullTimer = 0;
var picnics = [];
var particles = [];
var floatingTexts = [];
var shake = 0;
var flash = 0;
var failText = '';
var buttonsStart = [];
var buttonsGameOver = [];
var stats = { castles: 0, parts: 0, crabs: 0, gulls: 0, berriesLost: 0, floods: 0 };
var previousKeys = {};
var lastTime = 0;
var activeSounds = [];
var sprites = {};

// --- Farben (alle aus testColor abgeleitet, nie die reine Laserfarbe) ---
var COL = {};
function updateColors() {
  const c = laserConfig.testColor;
  COL = {
    sky: getRgbSpreadHex(c, 0.55, 0.4, 0.9),
    forestFar: getRgbSpreadHex(c, 0.3, 0.6, 0.35),
    forestNear: getRgbSpreadHex(c, 0.33, 0.7, 0.22),
    trunk: getRgbSpreadHex(c, 0.08, 0.5, 0.3),
    beach: getRgbSpreadHex(c, 0.12, 0.35, 0.85),
    beachDark: getRgbSpreadHex(c, 0.12, 0.45, 0.7),
    sand: getRgbSpreadHex(c, 0.1, 0.5, 0.75),
    sandDark: getRgbSpreadHex(c, 0.1, 0.6, 0.5),
    sandLight: getRgbSpreadHex(c, 0.12, 0.3, 0.95),
    sea: getRgbSpreadHex(c, 0.55, 0.75, 0.6),
    seaDeep: getRgbSpreadHex(c, 0.6, 0.8, 0.35),
    foam: getRgbSpreadHex(c, 0.55, 0.1, 1),
    blueprint: getRgbSpreadHex(c, 0.5, 0.6, 0.6),
    flag: getRgbSpreadHex(c, 0.45, 0.85, 1),
    berry: getRgbSpreadHex(c, 0.95, 0.85, 0.85),
    leaf: getRgbSpreadHex(c, 0.3, 0.8, 0.6),
    blanket1: getRgbSpreadHex(c, 0.65, 0.5, 0.9),
    blanket2: getRgbSpreadHex(c, 0.65, 0.15, 1),
    crab: getRgbSpreadHex(c, 0.9, 0.8, 0.8),
    gull: getRgbSpreadHex(c, 0.55, 0.05, 1),
    text: getRgbSpreadHex(c, 0.5, 0.25, 1),
    textHi: getRgbSpreadHex(c, 0.42, 0.8, 1),
    bad: getRgbSpreadHex(c, 0.85, 0.9, 1),
    shadow: getRgbSpreadHex(c, 0.6, 0.6, 0.15),
  };
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
  floatingTexts.push({ text, x, y, color, size, time: 0, duration: 1.5 });
}

function burst(x, y, color, count = 16, speed = 300, gravity = 400) {
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
    });
  }
}

function makeCanvas(w, h) {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  return c;
}

// --- Vorrendern ---
function renderSandTexture(w, h) {
  const c = makeCanvas(w, h);
  const ctx = c.getContext('2d');
  ctx.fillStyle = COL.sand;
  ctx.fillRect(0, 0, w, h);
  for (let i = 0; i < 9000; i++) {
    ctx.fillStyle = Math.random() < 0.5 ? COL.sandDark : COL.sandLight;
    ctx.globalAlpha = 0.25 + Math.random() * 0.35;
    ctx.fillRect(Math.random() * w, Math.random() * h, 3, 3);
  }
  ctx.globalAlpha = 1;
  return c;
}

function renderForestLayer(color, height, treeCount, minH, maxH, seed) {
  const c = makeCanvas(W, height);
  const ctx = c.getContext('2d');
  let rnd = seed;
  const rand = () => {
    rnd = (rnd * 9301 + 49297) % 233280;
    return rnd / 233280;
  };
  for (let i = 0; i < treeCount; i++) {
    const x = (i / treeCount) * W + rand() * 40;
    const th = minH + rand() * (maxH - minH);
    ctx.fillStyle = COL.trunk;
    ctx.fillRect(x - 6, height - 30, 12, 30);
    ctx.fillStyle = color;
    for (let k = 0; k < 3; k++) {
      const w = 70 - k * 18;
      const y0 = height - 25 - k * th * 0.28;
      ctx.beginPath();
      ctx.moveTo(x - w, y0);
      ctx.lineTo(x, y0 - th * 0.45);
      ctx.lineTo(x + w, y0);
      ctx.closePath();
      ctx.fill();
    }
  }
  return c;
}

function renderBackground() {
  const c = makeCanvas(W, H);
  const ctx = c.getContext('2d');
  const sky = ctx.createLinearGradient(0, 0, 0, FOREST_Y);
  sky.addColorStop(0, COL.sky);
  sky.addColorStop(1, COL.sandLight);
  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, W, FOREST_Y);
  ctx.drawImage(renderForestLayer(COL.forestFar, 220, 40, 120, 180, 7), 0, FOREST_Y - 220);
  ctx.drawImage(renderForestLayer(COL.forestNear, 200, 26, 140, 200, 3), 0, FOREST_Y - 190);
  // Erdbeerbüsche am Waldrand
  for (let i = 0; i < 14; i++) {
    const x = 60 + i * 140 + (i % 3) * 20;
    const y = FOREST_Y - 5;
    ctx.fillStyle = COL.leaf;
    ctx.beginPath();
    ctx.ellipse(x, y, 45, 22, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = COL.berry;
    for (let k = 0; k < 3; k++) {
      ctx.beginPath();
      ctx.arc(x - 20 + k * 20, y - 4 + (k % 2) * 8, 7, 0, Math.PI * 2);
      ctx.fill();
    }
  }
  // Strand
  const beach = ctx.createLinearGradient(0, FOREST_Y, 0, SEA_Y);
  beach.addColorStop(0, COL.beach);
  beach.addColorStop(1, COL.beachDark);
  ctx.fillStyle = beach;
  ctx.fillRect(0, FOREST_Y, W, SEA_Y - FOREST_Y + 10);
  for (let i = 0; i < 3000; i++) {
    ctx.fillStyle = Math.random() < 0.5 ? COL.beachDark : COL.sandLight;
    ctx.globalAlpha = 0.25;
    ctx.fillRect(Math.random() * W, FOREST_Y + Math.random() * (SEA_Y - FOREST_Y), 3, 3);
  }
  ctx.globalAlpha = 1;
  return c;
}

/** fertiges Bauteil als Sandburg-Grafik (Zinnen, Ziegel, optional Fahne) */
function renderPartSprite(part) {
  const pad = 70;
  const c = makeCanvas(part.w + 2, part.h + pad);
  const ctx = c.getContext('2d');
  const top = pad;
  const grad = ctx.createLinearGradient(0, top, 0, top + part.h);
  grad.addColorStop(0, COL.sandLight);
  grad.addColorStop(1, COL.sandDark);
  ctx.fillStyle = grad;
  const crenH = part.type === 'wall' ? 18 : 26;
  const crenW = part.type === 'wall' ? 30 : Math.max(18, part.w / 5);
  ctx.fillRect(0, top + crenH, part.w, part.h - crenH);
  for (let x = 0; x < part.w; x += crenW * 2) ctx.fillRect(x, top, Math.min(crenW, part.w - x), crenH + 2);
  // Ziegelfugen
  ctx.strokeStyle = COL.sandDark;
  ctx.globalAlpha = 0.5;
  ctx.lineWidth = 2;
  for (let y = top + crenH + 22; y < top + part.h; y += 22) {
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(part.w, y);
    ctx.stroke();
  }
  ctx.globalAlpha = 1;
  if (part.type !== 'wall') {
    // Fenster
    ctx.fillStyle = COL.shadow;
    const wy = top + part.h * 0.35;
    ctx.beginPath();
    ctx.arc(part.w / 2, wy, part.w * 0.12, Math.PI, 0);
    ctx.fillRect(part.w / 2 - part.w * 0.12, wy, part.w * 0.24, part.w * 0.25);
    ctx.fill();
    // Fahnenmast (die Fahne selbst weht live)
    ctx.fillStyle = COL.trunk;
    ctx.fillRect(part.w / 2 - 2, 10, 4, top - 10);
  } else {
    // Tor in der Mitte
    ctx.fillStyle = COL.shadow;
    ctx.beginPath();
    ctx.arc(part.w / 2, top + part.h - 40, 30, Math.PI, 0);
    ctx.fillRect(part.w / 2 - 30, top + part.h - 40, 60, 40);
    ctx.fill();
  }
  return { canvas: c, pad };
}

function renderSprites() {
  sprites.bg = renderBackground();
  sprites.sandTex = renderSandTexture(W, SEA_Y - BEACH_Y + 20);
}

// --- Bauplan ---
function createBlueprint() {
  const width = Math.min(DIFFICULTY.castleWidthMax, DIFFICULTY.castleWidthStart + DIFFICULTY.castleWidthPerLevel * (level - 1));
  const towerH = Math.min(DIFFICULTY.towerHeightMax, DIFFICULTY.towerHeightStart + DIFFICULTY.towerHeightPerLevel * (level - 1));
  const cx = W / 2 + (Math.random() - 0.5) * 300;
  const x0 = cx - width / 2;
  const towerW = 110;
  const towerCount = level >= 4 ? 4 : level >= DIFFICULTY.keepLevel ? 3 : 2;
  const list = [];
  list.push({ type: 'wall', x: x0, y: BASE_Y - 95, w: width, h: 95 });
  for (let i = 0; i < towerCount; i++) {
    const tx = x0 + (i * (width - towerW)) / (towerCount - 1);
    const center = towerCount % 2 === 1 && i === (towerCount - 1) / 2;
    const h = center && level >= DIFFICULTY.keepLevel ? towerH + 70 : towerH;
    list.push({ type: center && level >= DIFFICULTY.keepLevel ? 'keep' : 'tower', x: tx, y: BASE_Y - h, w: center ? towerW + 50 : towerW, h });
  }
  if (towerCount === 4 && level >= DIFFICULTY.keepLevel) {
    list.push({ type: 'keep', x: cx - 85, y: BASE_Y - towerH - 70, w: 170, h: towerH + 70 });
  }
 // Teile, die später gezeichnet werden, liegen vorne: Mauer zuletzt
list.reverse();
return list.map((p, id) => Object.assign({}, p, { id, total: 0, full: 0, done: false, doneTime: 0, sprite: null }));
}

function buildPartMap() {
  const cols = sand.getCols();
  const rows = sand.getRows();
  partOf = new Int16Array(cols * rows).fill(-1);
  blueprintCells = [];
  for (let i = 0; i < cols * rows; i++) {
    const x = ((i % cols) + 0.5) * CELL;
    const y = BEACH_Y + (Math.floor(i / cols) + 0.5) * CELL;
    for (const p of parts) {
      if (x >= p.x && x < p.x + p.w && y >= p.y && y < p.y + p.h) {
        partOf[i] = p.id;
        p.total++;
        blueprintCells.push(i);
        break;
      }
    }
  }
  parts.forEach((p) => (p.sprite = renderPartSprite(p)));
}

function onSandChange({ index, full }) {
  if (!partOf) return;
  const id = partOf[index];
  if (id < 0) {
    waste += full ? 1 : -1;
    return;
  }
  const p = parts[id];
  p.full += full ? 1 : -1;
  const ratio = p.full / Math.max(1, p.total);
  if (!p.done && ratio >= DIFFICULTY.partDone) {
    p.done = true;
    p.doneTime = gameTime;
    stats.parts++;
    score += DIFFICULTY.scorePart;
    addFloatingText(`${p.type === 'wall' ? 'Mauer' : p.type === 'keep' ? 'Bergfried' : 'Turm'} fertig! +${DIFFICULTY.scorePart}`, p.x + p.w / 2, p.y - 30, COL.textHi, 46);
    burst(p.x + p.w / 2, p.y, COL.flag, 30, 400);
    playSound(soundPop, 0.6);
  } else if (p.done && ratio < DIFFICULTY.partBroken) {
    p.done = false;
    addFloatingText('eingestürzt!', p.x + p.w / 2, p.y - 30, COL.bad, 44);
    burst(p.x + p.w / 2, p.y + p.h / 2, COL.sand, 30, 300);
    shake = Math.max(shake, 0.3);
  }
}

function completion() {
  let full = 0;
  let total = 0;
  parts.forEach((p) => {
    full += Math.max(0, p.full);
    total += p.total;
  });
  return total > 0 ? full / total : 0;
}

// --- Picknick ---
function createPicnics() {
  return PICNICS.map((p) => ({ x: p.x, y: p.y, cooldown: 0, berries: 5 }));
}

function updatePicnics(ctx, elapsed) {
  picnics.forEach((p) => {
    p.cooldown = Math.max(0, p.cooldown - elapsed);
    const avg = gameState === 'game' ? sand.getAverageInCircle(p.x, p.y, 80) : 0;
    p.warn = avg > DIFFICULTY.picnicSandLimit * 0.4;
    if (gameState === 'game' && p.cooldown === 0 && avg > DIFFICULTY.picnicSandLimit) {
      p.cooldown = 2;
      sand.setInCircle(p.x, p.y, 110, 0);
      loseBerry(p.x, p.y, 'Erdbeeren versandet!');
    }
    renderPicnic(ctx, p);
  });
}

function renderPicnic(ctx, p) {
  ctx.save();
  ctx.translate(p.x, p.y);
  ctx.rotate(-0.12);
  const s = 34;
  for (let i = -3; i < 3; i++) {
    for (let j = -2; j < 2; j++) {
      ctx.fillStyle = (i + j) % 2 === 0 ? COL.blanket1 : COL.blanket2;
      ctx.fillRect(i * s, j * s, s, s);
    }
  }
  // Schüssel mit Erdbeeren
  ctx.fillStyle = COL.blanket2;
  ctx.beginPath();
  ctx.ellipse(0, 0, 48, 28, 0, 0, Math.PI * 2);
  ctx.fill();
  const n = Math.max(0, berries);
  for (let k = 0; k < Math.min(6, n); k++) {
    const a = (k / 6) * Math.PI * 2;
    drawBerry(ctx, Math.cos(a) * 22, Math.sin(a) * 10 - 4, 11);
  }
  ctx.restore();
  if (p.warn && p.cooldown === 0 && Math.floor(gameTime * 6) % 2 === 0) {
    ctx.save();
    ctx.strokeStyle = COL.bad;
    ctx.lineWidth = 6;
    ctx.setLineDash([14, 10]);
    ctx.beginPath();
    ctx.arc(p.x, p.y, 110, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();
  }
  if (p.cooldown > 0) {
    ctx.save();
    ctx.globalAlpha = p.cooldown / 2;
    ctx.strokeStyle = COL.bad;
    ctx.lineWidth = 8;
    ctx.beginPath();
    ctx.arc(p.x, p.y, 110, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();
  }
}

function drawBerry(ctx, x, y, r) {
  ctx.fillStyle = COL.berry;
  ctx.beginPath();
  ctx.moveTo(x - r, y - r * 0.3);
  ctx.quadraticCurveTo(x, y - r * 1.1, x + r, y - r * 0.3);
  ctx.lineTo(x, y + r * 1.1);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = COL.leaf;
  ctx.fillRect(x - r * 0.5, y - r * 0.85, r, r * 0.3);
  ctx.fillStyle = COL.sandLight;
  ctx.fillRect(x - r * 0.3, y, 2, 2);
  ctx.fillRect(x + r * 0.2, y + r * 0.3, 2, 2);
}

function loseBerry(x, y, text, amount = 1) {
  berries -= amount;
  stats.berriesLost += amount;
  shake = Math.max(shake, 0.4);
  burst(x, y, COL.berry, 25, 350);
  addFloatingText(`${text} −${amount}`, x, y - 100, COL.bad, 46);
  playSound(soundBoom, 0.4);
  if (berries <= 0) {
    berries = 0;
    gameState = 'gameover';
    stateTime = 0;
    buttonsGameOver = [startButton()];
  }
}

// --- Wellen ---
function waveReach() {
  const tideProgress = 1 - tideLeft / tideTotal;
  return DIFFICULTY.waveReachStart + DIFFICULTY.waveReachPerLevel * (level - 1) + DIFFICULTY.waveReachTide * tideProgress * tideProgress;
}

function spawnWave(big = false) {
  const span = big ? W + 400 : 600 + Math.random() * 600;
  const x0 = big ? -200 : Math.random() * (W - span * 0.5) - span * 0.25;
  const storm = level >= DIFFICULTY.stormLevel ? 1.15 : 1;
  waves.push({
    x0,
    x1: x0 + span,
    reach: big ? SEA_Y - BEACH_Y + 60 : waveReach() * storm * (0.8 + Math.random() * 0.4),
    t: 0,
    duration: big ? 3.5 : 3,
    big,
    seed: Math.random() * 10,
  });
  playSound(soundSplash, big ? 0.9 : 0.35);
}

function waveFront(w, x) {
  // Höhe der Wellenfront an x (0 ausserhalb), weiche Ränder
  if (x < w.x0 || x > w.x1) return 0;
  const u = (x - w.x0) / (w.x1 - w.x0);
  const edge = Math.sin(u * Math.PI);
  const surge = Math.sin(Math.min(1, w.t / w.duration) * Math.PI);
  return w.reach * surge * Math.pow(edge, 0.5) * (1 + 0.08 * Math.sin(x * 0.02 + w.seed + gameTime * 3));
}

function updateWaves(ctx, elapsed) {
  waves.slice().forEach((w) => {
    w.t += elapsed;
    if (w.t >= w.duration) {
      removeItemFromArray(waves, w);
      return;
    }
    const rising = w.t < w.duration / 2;
    // Abtrag entlang der Front (nur beim Auflaufen)
    if (rising && (gameState === 'game' || gameState === 'flood')) {
      const r = w.big ? 90 : 45;
      for (let x = Math.max(0, w.x0); x <= Math.min(W, w.x1); x += r) {
        const h = waveFront(w, x);
        if (h < 10) continue;
        const fy = SEA_Y - h;
        const rate = w.big ? 4 : DIFFICULTY.waveErode;
        sand.addInCircle(x, fy + r * 0.4, r, -rate * elapsed, 0.3);
        if (w.big) sand.addInCircle(x, fy + r * 1.6, r, -rate * elapsed, 0);
      }
    }
    // Zeichnen: Wasserzunge mit Schaumkante
    ctx.save();
    ctx.globalAlpha = 0.75;
    ctx.fillStyle = COL.sea;
    ctx.beginPath();
    ctx.moveTo(Math.max(0, w.x0), SEA_Y + 5);
    for (let x = Math.max(0, w.x0); x <= Math.min(W, w.x1); x += 20) ctx.lineTo(x, SEA_Y - waveFront(w, x));
    ctx.lineTo(Math.min(W, w.x1), SEA_Y + 5);
    ctx.closePath();
    ctx.fill();
    ctx.globalAlpha = 1;
    ctx.strokeStyle = COL.foam;
    ctx.lineWidth = 8;
    ctx.lineCap = 'round';
    ctx.beginPath();
    let started = false;
    for (let x = Math.max(0, w.x0); x <= Math.min(W, w.x1); x += 20) {
      const y = SEA_Y - waveFront(w, x);
      if (!started) {
        ctx.moveTo(x, y);
        started = true;
      } else ctx.lineTo(x, y);
    }
    ctx.stroke();
    ctx.restore();
    if (Math.random() < elapsed * (w.big ? 60 : 12)) {
      const x = w.x0 + Math.random() * (w.x1 - w.x0);
      burst(x, SEA_Y - waveFront(w, x), COL.foam, 2, 150, 300);
    }
  });
}

function renderSea(ctx) {
  const grad = ctx.createLinearGradient(0, SEA_Y, 0, H);
  grad.addColorStop(0, COL.sea);
  grad.addColorStop(1, COL.seaDeep);
  ctx.save();
  ctx.fillStyle = grad;
  ctx.beginPath();
  ctx.moveTo(0, H);
  for (let x = 0; x <= W; x += 20) ctx.lineTo(x, SEA_Y + Math.sin(x * 0.01 + gameTime * 2) * 8);
  ctx.lineTo(W, H);
  ctx.closePath();
  ctx.fill();
  ctx.strokeStyle = COL.foam;
  ctx.globalAlpha = 0.35;
  ctx.lineWidth = 4;
  for (let k = 0; k < 4; k++) {
    ctx.beginPath();
    const y0 = SEA_Y + 40 + k * 55;
    for (let x = 0; x <= W; x += 30) {
      const y = y0 + Math.sin(x * 0.008 + gameTime * (1.5 + k * 0.3) + k) * 10;
      if (x === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.stroke();
  }
  ctx.restore();
}

// --- Krabben ---
function spawnCrab() {
  const target = picnics[Math.floor(Math.random() * picnics.length)];
  const crab = {
    x: 200 + Math.random() * (W - 400),
    y: SEA_Y + 30,
    target,
    state: 'walk',
    carrying: false,
    seed: Math.random() * 10,
    button: null,
  };
  crab.button = guiPixelFillButton({
    label: '',
    posX: crab.x,
    posY: crab.y,
    radius: 60,
    fullPercent: 25,
    speedUp: 100 / DIFFICULTY.crabShooTime,
    speedDown: 60,
    minValue: 1,
    activeValue: 99,
    visible: false,
    onEnterActive: () => {
      if (crab.state === 'flee') return;
      crab.state = 'flee';
      stats.crabs++;
      score += DIFFICULTY.scoreShoo;
      addFloatingText(`husch! +${DIFFICULTY.scoreShoo}`, crab.x, crab.y - 60, COL.textHi, 40);
      burst(crab.x, crab.y, COL.sand, 12, 250);
      playSound(soundPop, 0.4);
    },
  });
  crabs.push(crab);
}

function updateCrabs(ctx, grid, elapsed) {
  crabs.slice().forEach((crab) => {
    if (gameState === 'game') crab.button.handle(grid, elapsed);
    else if (crab.state === 'walk') crab.state = 'flee';
    if (crab.state === 'walk') {
      const dx = crab.target.x - crab.x;
      const dy = crab.target.y - crab.y;
      const d = Math.hypot(dx, dy);
      if (d < 50) {
        crab.state = 'flee';
        crab.carrying = true;
        loseBerry(crab.x, crab.y, 'Krabbe klaut Erdbeere!');
      } else {
        const sp = DIFFICULTY.crabSpeed * (1 + 0.05 * (level - 1));
        crab.x += (dx / d) * sp * elapsed;
        crab.y += (dy / d) * sp * elapsed;
        sand.addInCircle(crab.x, crab.y, 30, -DIFFICULTY.crabDig * elapsed, 0.5);
      }
    } else {
      crab.y += 260 * elapsed;
      crab.x += Math.sin(gameTime * 10 + crab.seed) * 60 * elapsed;
      if (crab.y > H + 60) {
        removeItemFromArray(crabs, crab);
        return;
      }
    }
    crab.button.setX(crab.x);
    crab.button.setY(crab.y);
    renderCrab(ctx, crab);
  });
}

function renderCrab(ctx, crab) {
  const walk = Math.sin(gameTime * 18 + crab.seed);
  const v = crab.button.getValue() / 100;
  ctx.save();
  ctx.translate(crab.x, crab.y);
  ctx.strokeStyle = COL.crab;
  ctx.lineWidth = 6;
  ctx.lineCap = 'round';
  for (let s = -1; s <= 1; s += 2) {
    for (let k = 0; k < 3; k++) {
      ctx.beginPath();
      ctx.moveTo(s * 20, k * 8 - 4);
      ctx.lineTo(s * 42, k * 10 + 6 + walk * 5 * (k % 2 ? 1 : -1));
      ctx.stroke();
    }
    // Scheren
    ctx.beginPath();
    ctx.arc(s * 40, -26, 12, 0, Math.PI * 2);
    ctx.fillStyle = COL.crab;
    ctx.fill();
  }
  ctx.fillStyle = COL.crab;
  ctx.beginPath();
  ctx.ellipse(0, 0, 34, 24, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = COL.shadow;
  ctx.fillRect(-12, -22, 6, 10);
  ctx.fillRect(6, -22, 6, 10);
  if (crab.carrying) drawBerry(ctx, 0, -40, 14);
  ctx.restore();
  if (v > 0 && crab.state === 'walk') {
    ctx.save();
    ctx.strokeStyle = COL.textHi;
    ctx.lineWidth = 8;
    ctx.beginPath();
    ctx.arc(crab.x, crab.y, 60, -Math.PI / 2, -Math.PI / 2 + v * Math.PI * 2);
    ctx.stroke();
    ctx.restore();
  }
}

// --- Möwen ---
function spawnGull() {
  const target = parts[Math.floor(Math.random() * parts.length)];
  const gull = {
    x: Math.random() < 0.5 ? -80 : W + 80,
    y: 120 + Math.random() * 100,
    tx: target.x + target.w * (0.2 + Math.random() * 0.6),
    ty: target.y + 30 + Math.random() * Math.max(10, target.h - 60),
    state: 'fly',
    seed: Math.random() * 10,
    peck: 0,
    button: null,
  };
  gull.button = guiPixelFillButton({
    label: '',
    posX: gull.x,
    posY: gull.y,
    radius: 65,
    fullPercent: 25,
    speedUp: 100 / DIFFICULTY.gullShooTime,
    speedDown: 60,
    minValue: 1,
    activeValue: 99,
    visible: false,
    onEnterActive: () => {
      if (gull.state === 'flee') return;
      gull.state = 'flee';
      stats.gulls++;
      score += DIFFICULTY.scoreShoo;
      addFloatingText(`kreisch! +${DIFFICULTY.scoreShoo}`, gull.x, gull.y - 60, COL.textHi, 40);
      playSound(soundPop, 0.4);
    },
  });
  gulls.push(gull);
}

function updateGulls(ctx, grid, elapsed) {
  gulls.slice().forEach((g) => {
    if (gameState === 'game') g.button.handle(grid, elapsed);
    else if (g.state !== 'flee') g.state = 'flee';
    if (g.state === 'fly') {
      const dx = g.tx - g.x;
      const dy = g.ty - g.y;
      const d = Math.hypot(dx, dy);
      if (d < 10) g.state = 'peck';
      else {
        g.x += (dx / d) * Math.min(d, 320 * elapsed);
        g.y += (dy / d) * Math.min(d, 320 * elapsed);
      }
    } else if (g.state === 'peck') {
      g.peck += elapsed;
      sand.addInCircle(g.x, g.y + 20, 40, -DIFFICULTY.gullPeck * elapsed, 0.3);
      if (Math.random() < elapsed * 6) burst(g.x, g.y + 20, COL.sand, 2, 120);
    } else {
      g.y -= 380 * elapsed;
      g.x += (g.x < W / 2 ? -1 : 1) * 200 * elapsed;
      if (g.y < -100) {
        removeItemFromArray(gulls, g);
        return;
      }
    }
    g.button.setX(g.x);
    g.button.setY(g.y);
    renderGull(ctx, g);
  });
}

function renderGull(ctx, g) {
  const flap = g.state === 'peck' ? 0.2 : Math.sin(gameTime * 12 + g.seed);
  ctx.save();
  ctx.translate(g.x, g.y);
  ctx.strokeStyle = COL.gull;
  ctx.fillStyle = COL.gull;
  ctx.lineWidth = 9;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(-60, -flap * 30);
  ctx.quadraticCurveTo(-25, -25 - flap * 10, 0, 0);
  ctx.quadraticCurveTo(25, -25 - flap * 10, 60, -flap * 30);
  ctx.stroke();
  ctx.beginPath();
  ctx.ellipse(0, 5, 22, 13, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = COL.flag;
  ctx.fillRect(18, 2, 14, 5);
  ctx.restore();
  const v = g.button.getValue() / 100;
  if (v > 0 && g.state !== 'flee') {
    ctx.save();
    ctx.strokeStyle = COL.textHi;
    ctx.lineWidth = 8;
    ctx.beginPath();
    ctx.arc(g.x, g.y, 65, -Math.PI / 2, -Math.PI / 2 + v * Math.PI * 2);
    ctx.stroke();
    ctx.restore();
  }
}

// --- Burg zeichnen ---
function renderBlueprint(ctx) {
  ctx.save();
  ctx.setLineDash([16, 12]);
  ctx.lineDashOffset = -gameTime * 30;
  ctx.lineWidth = 4;
  ctx.strokeStyle = COL.blueprint;
  parts.forEach((p) => {
    if (p.done) return;
    ctx.globalAlpha = 0.18;
    ctx.fillStyle = COL.blueprint;
    ctx.fillRect(p.x, p.y, p.w, p.h);
    ctx.globalAlpha = 0.8;
    ctx.strokeRect(p.x, p.y, p.w, p.h);
  });
  ctx.restore();
}

function renderDoneParts(ctx) {
  parts.forEach((p) => {
    if (!p.done) return;
    const age = gameTime - p.doneTime;
    const pop = age < 0.4 ? 1 + Math.sin((age / 0.4) * Math.PI) * 0.06 : 1;
    ctx.save();
    ctx.translate(p.x + p.w / 2, p.y + p.h);
    ctx.scale(pop, pop);
    ctx.drawImage(p.sprite.canvas, -p.w / 2, -p.h - p.sprite.pad);
    ctx.restore();
    if (p.type !== 'wall') {
      // wehende Fahne
      ctx.save();
      ctx.fillStyle = COL.flag;
      const fx = p.x + p.w / 2 + 2;
      const fy = p.y - p.sprite.pad + 12;
      ctx.beginPath();
      ctx.moveTo(fx, fy);
      for (let k = 0; k <= 6; k++) ctx.lineTo(fx + k * 9, fy + Math.sin(gameTime * 8 + k * 0.8) * 4);
      for (let k = 6; k >= 0; k--) ctx.lineTo(fx + k * 9, fy + 26 + Math.sin(gameTime * 8 + k * 0.8) * 4);
      ctx.closePath();
      ctx.fill();
      ctx.restore();
    }
    if (age < 1) {
      ctx.save();
      ctx.globalAlpha = 1 - age;
      ctx.strokeStyle = COL.textHi;
      ctx.lineWidth = 10;
      ctx.strokeRect(p.x - 6, p.y - 6, p.w + 12, p.h + 12);
      ctx.restore();
    }
  });
}

// --- Effekte & HUD ---
function updateParticles(ctx, elapsed) {
  ctx.save();
  for (let i = particles.length - 1; i >= 0; i--) {
    const p = particles[i];
    p.life += elapsed;
    if (p.life >= p.maxLife) {
      particles.splice(i, 1);
      continue;
    }
    p.vy += p.gravity * elapsed;
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
      shadowStyle: COL.shadow,
      x: t.x,
      y: t.y - t.time * 50,
    });
    ctx.restore();
  }
}

function renderFlash(ctx, elapsed) {
  if (flash <= 0) return;
  ctx.save();
  ctx.globalAlpha = Math.min(0.5, flash * 0.5);
  ctx.fillStyle = COL.foam;
  ctx.fillRect(0, 0, W, H);
  ctx.restore();
  flash = Math.max(0, flash - elapsed * 1.5);
}

function renderHud(ctx) {
  const pct = Math.floor(completion() * 100);
  util.renderTextDropShadow({
    ctx,
    text: `Level ${level} · Burg ${pct} % · ${score} Punkte`,
    fontSize: '46px',
    dropDistX: 4,
    dropDistY: 4,
    fillStyle: COL.text,
    shadowStyle: COL.shadow,
    align: 'left',
    x: 30,
    y: 60,
  });
  // Flut-Anzeige
  const t = Math.max(0, Math.ceil(tideLeft));
  const low = tideLeft < 10 && Math.floor(gameTime * 4) % 2 === 0;
  util.renderTextDropShadow({
    ctx,
    text: `Flut in ${t}s`,
    fontSize: '46px',
    dropDistX: 4,
    dropDistY: 4,
    fillStyle: low ? COL.bad : COL.foam,
    shadowStyle: COL.shadow,
    align: 'left',
    x: 30,
    y: 115,
  });
  // Erdbeeren = Leben
  ctx.save();
  for (let i = 0; i < DIFFICULTY.strawberries; i++) {
    ctx.globalAlpha = i < berries ? 1 : 0.2;
    drawBerry(ctx, W - 50 - i * 55, 55, 20);
  }
  ctx.restore();
}

// --- Spielfluss ---
function resetSand() {
  if (!sand) {
    sand = guiPaintLayer({
      posX: 0,
      posY: BEACH_Y,
      width: W,
      height: SEA_Y - BEACH_Y + 20,
      cellSize: CELL,
      speedUp: DIFFICULTY.paintSpeed,
      speedDown: 0,
      brushRadius: 0,
      threshold: 0.6,
      render: 'paint',
      color: COL.sand,
      texture: sprites.sandTex,
      onCellChange: onSandChange,
    });
  }
  sand.setTexture(sprites.sandTex);
  partOf = null;
  sand.fill(0);
}

function startLevel() {
  resetSand();
  parts = createBlueprint();
  waste = 0;
  buildPartMap();
  waves = [];
  crabs = [];
  gulls = [];
  waveTimer = 2;
  crabTimer = 4;
  gullTimer = 5;
  tideTotal = DIFFICULTY.tideTimeStart + DIFFICULTY.tideTimePerLevel * (level - 1);
  tideLeft = tideTotal;
  picnics.forEach((p) => (p.cooldown = 0));
  gameState = 'game';
  stateTime = 0;
}

function resetGame() {
  level = 1;
  score = 0;
  berries = DIFFICULTY.strawberries;
  stats = { castles: 0, parts: 0, crabs: 0, gulls: 0, berriesLost: 0, floods: 0 };
  particles = [];
  floatingTexts = [];
  picnics = createPicnics();
  lastTime = performance.now();
  startLevel();
}

function startButton() {
  return guiFillButton({
    label: 'START',
    posX: W / 2,
    posY: 600,
    speedDown: 12,
    speedUp: 25,
    edges: 5,
    angle: -Math.PI / 2,
    activeValue: 90,
    radius: 140,
    normalColor: COL.flag,
    activeColor: COL.textHi,
    growColor: COL.sandLight,
    onEnterActive: () => resetGame(),
    onExitActive: () => {},
  });
}

function castleDone() {
  stats.castles++;
  const timeBonus = Math.floor(tideLeft) * DIFFICULTY.timeBonusPerSecond;
  let built = 0;
  parts.forEach((p) => (built += Math.max(0, p.full)));
  const efficiency = built / Math.max(1, built + Math.max(0, waste));
  const effBonus = Math.floor(efficiency * 200);
  score += DIFFICULTY.scoreCastle + timeBonus + effBonus;
  failText = `Burg fertig! +${DIFFICULTY.scoreCastle}\nZeitbonus +${timeBonus} · Sand-Effizienz ${Math.round(efficiency * 100)} % +${effBonus}`;
  gameState = 'levelup';
  stateTime = 0;
  flash = 1;
  parts.forEach((p) => {
    p.done = true;
    burst(p.x + p.w / 2, p.y, COL.flag, 20, 500);
  });
  playSound(soundLevel, 0.8);
}

function startFlood() {
  gameState = 'flood';
  stateTime = 0;
  stats.floods++;
  spawnWave(true);
  shake = 0.8;
  playSound(soundBoom, 0.7);
}

function newElementText(lvl) {
  if (lvl === DIFFICULTY.crabLevel) return 'NEU: Krabben klauen Erdbeeren – anleuchten verscheucht sie!';
  if (lvl === DIFFICULTY.keepLevel) return 'NEU: Grössere Burgen mit Bergfried!';
  if (lvl === DIFFICULTY.gullLevel) return 'NEU: Möwen picken Löcher in die Burg – verscheuchen!';
  if (lvl === DIFFICULTY.stormLevel) return 'NEU: Sturmflut – die Wellen kommen höher!';
  return 'Die Burg wird grösser, die Flut kommt schneller …';
}

// --- Bildschirme ---
function renderScene(ctx, grid, elapsed, active) {
  ctx.drawImage(sprites.bg, 0, 0);
  renderBlueprint(ctx);
  if (active) sand.handle(grid, elapsed);
  else sand.draw(ctx);
  renderDoneParts(ctx);
  updatePicnics(ctx, elapsed);
  updateCrabs(ctx, grid, elapsed);
  renderSea(ctx);
  updateWaves(ctx, elapsed);
  updateGulls(ctx, grid, elapsed);
  updateParticles(ctx, elapsed);
  updateFloatingTexts(ctx, elapsed);
}

function handleStart(grid, elapsed, ctx) {
  gameTime += elapsed;
  ctx.drawImage(sprites.bg, 0, 0);
  renderSea(ctx);
  waveTimer -= elapsed;
  if (waveTimer <= 0) {
    waveTimer = 3;
    spawnWave();
  }
  updateWaves(ctx, elapsed);
  updateParticles(ctx, elapsed);
  util.renderTextDropShadow({ ctx, text: 'SANDBURG-FLUT', fontSize: '150px', fillStyle: COL.flag, shadowStyle: COL.shadow, x: W / 2, y: 380 });
  util.renderTextDropShadow({
    ctx,
    text: 'Baut gemeinsam Sandburgen, bevor die Flut kommt!\nKein Sand auf die Erdbeeren!',
    fontSize: '44px',
    lineHeight: 60,
    dropDistX: 4,
    dropDistY: 4,
    fillStyle: COL.text,
    shadowStyle: COL.shadow,
    x: W / 2,
    y: 760,
  });
  buttonsStart.forEach((b) => b.handle(grid, elapsed));
  if (keyPressedOnce('Space')) resetGame();
}

function handleGame(grid, elapsed, ctx) {
  gameTime += elapsed;
  stateTime += elapsed;
  tideLeft -= elapsed;

  // Tastatur-Test
  if (keyPressedOnce('KeyB')) {
    for (let k = 0; k < 60 && blueprintCells.length; k++) {
      const i = blueprintCells[Math.floor(Math.random() * blueprintCells.length)];
      const cols = sand.getCols();
      sand.setValueAt(((i % cols) + 0.5) * CELL, BEACH_Y + (Math.floor(i / cols) + 0.5) * CELL, 1);
    }
  }
  if (keyPressedOnce('KeyC')) {
    crabs.forEach((c) => (c.state = 'flee'));
    gulls.forEach((g) => (g.state = 'flee'));
  }
  if (keyPressedOnce('KeyL')) {
    castleDone();
    return;
  }

  // Wellen
  waveTimer -= elapsed;
  if (waveTimer <= 0) {
    waveTimer = Math.max(DIFFICULTY.waveIntervalMin, DIFFICULTY.waveIntervalStart * Math.pow(DIFFICULTY.waveIntervalFactor, level - 1)) * (0.7 + Math.random() * 0.6);
    spawnWave();
  }
  // Krabben
  if (level >= DIFFICULTY.crabLevel) {
    crabTimer -= elapsed;
    if (crabTimer <= 0) {
      crabTimer = Math.max(DIFFICULTY.crabIntervalMin, DIFFICULTY.crabIntervalStart + DIFFICULTY.crabIntervalPerLevel * (level - DIFFICULTY.crabLevel));
      spawnCrab();
    }
  }
  // Möwen
  if (level >= DIFFICULTY.gullLevel) {
    gullTimer -= elapsed;
    if (gullTimer <= 0) {
      gullTimer = DIFFICULTY.gullInterval * (0.7 + Math.random() * 0.6);
      spawnGull();
    }
  }

  shake = Math.max(0, shake - elapsed);
  ctx.save();
  if (shake > 0) {
    const s = shake * 25;
    ctx.translate((Math.random() - 0.5) * s, (Math.random() - 0.5) * s);
  }
  renderScene(ctx, grid, elapsed, true);
  ctx.restore();
  renderHud(ctx);
  renderFlash(ctx, elapsed);

  if (gameState !== 'game') return;
  if (completion() >= DIFFICULTY.completeGoal) castleDone();
  else if (tideLeft <= 0) startFlood();
}

function handleFlood(grid, elapsed, ctx) {
  gameTime += elapsed;
  stateTime += elapsed;
  shake = Math.max(0, shake - elapsed * 0.5);
  ctx.save();
  if (shake > 0) ctx.translate((Math.random() - 0.5) * shake * 30, (Math.random() - 0.5) * shake * 30);
  renderScene(ctx, grid, elapsed, false);
  ctx.restore();
  util.renderTextDropShadow({ ctx, text: 'DIE FLUT KOMMT!', fontSize: '130px', fillStyle: COL.foam, shadowStyle: COL.shadow, x: W / 2, y: 300 });
  renderHud(ctx);
  if (stateTime > 3.6) {
    loseBerry(W / 2, 500, 'Burg weggespült!', 2);
    if (gameState === 'flood') startLevel(); // neuer Versuch mit neuem Bauplan
  }
}

function handleLevelUp(grid, elapsed, ctx) {
  gameTime += elapsed;
  stateTime += elapsed;
  renderScene(ctx, grid, elapsed, false);
  if (Math.random() < elapsed * 8) {
    burst(200 + Math.random() * (W - 400), 150 + Math.random() * 300, Math.random() < 0.5 ? COL.flag : COL.berry, 25, 450, 150);
  }
  const t = Math.min(1, stateTime * 3);
  ctx.save();
  ctx.translate(W / 2, 330);
  ctx.scale(0.5 + 0.5 * t, 0.5 + 0.5 * t);
  util.renderTextDropShadow({ ctx, text: `LEVEL ${level + 1}`, fontSize: '170px', fillStyle: COL.flag, shadowStyle: COL.shadow, x: 0, y: 0 });
  ctx.restore();
  util.renderTextDropShadow({
    ctx,
    text: `${failText}\n${newElementText(level + 1)}`,
    fontSize: '44px',
    lineHeight: 62,
    dropDistX: 4,
    dropDistY: 4,
    fillStyle: COL.text,
    shadowStyle: COL.shadow,
    x: W / 2,
    y: 440,
  });
  renderHud(ctx);
  renderFlash(ctx, elapsed);
  if (stateTime >= 4) {
    level++;
    startLevel();
  }
}

function handleGameOver(grid, elapsed, ctx) {
  gameTime += elapsed;
  stateTime += elapsed;
  renderScene(ctx, grid, elapsed, false);
  util.renderTextDropShadow({ ctx, text: 'Alle Erdbeeren weg!', fontSize: '120px', fillStyle: COL.bad, shadowStyle: COL.shadow, x: W / 2, y: 200 });
  util.renderTextDropShadow({
    ctx,
    text:
      `Level ${level} erreicht – ${score} Punkte\n` +
      `${stats.castles} Burgen, ${stats.parts} Türme & Mauern gebaut, ${stats.floods} Fluten\n` +
      `${stats.crabs} Krabben und ${stats.gulls} Möwen verscheucht`,
    fontSize: '44px',
    lineHeight: 62,
    dropDistX: 4,
    dropDistY: 4,
    fillStyle: COL.text,
    shadowStyle: COL.shadow,
    x: W / 2,
    y: 300,
  });
  buttonsGameOver.forEach((b) => b.handle(grid, elapsed));
  if (keyPressedOnce('Space')) resetGame();
}

export default {
  name: 'Sandburg-Flut',
  description: `
Baut gemeinsam Sandburgen am Strand!

Leuchtet in den gestrichelten Bauplan – dort wächst Sand.
Je mehr Laser, desto schneller steht die Burg.
Wellen spülen sie unten wieder weg, und am Ende kommt die Flut.

Kein Sand auf die Picknickdecken – sonst versanden die Erdbeeren!
Krabben und Möwen verscheucht ihr mit dem Laser.`,
  image: 'media/img/gametitles/laser-paradise-###4###.png',
  init: function () {
    updateColors();
    renderSprites();
    sand = null;
    parts = [];
    partOf = null;
    waves = [];
    crabs = [];
    gulls = [];
    particles = [];
    floatingTexts = [];
    picnics = createPicnics();
    resetSand();
    gameState = 'start';
    gameTime = 0;
    waveTimer = 1;
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
      case 'flood':
        handleFlood(grid, elapsed, ctx);
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
