/**
 * Keks-Oase
 *
 * Mitten in einer Pixel-Wüste liegt ein Keksgarten mit mehreren Beeten. Oben brennt eine riesige
 * Pixel-Sonne und schleudert glühende Hitze-Pixel auf die Beete.
 *
 * Regeln:
 * - Hitze-Pixel abschiessen (+Punkte). Erreicht eines ein Beet, verdunstet Oasen-Wasser (= Leben)
 *   und der Keks in diesem Beet verbrennt.
 * - In jedem Beet reift ein Keks. Reife Kekse (golden, pulsierend) anleuchten = ernten (+Punkte, +Wasser).
 *   Unreife Kekse anleuchten = zerkrümeln (-Punkte). Wildes Herumleuchten lohnt sich also nicht.
 * - Pro Level muss eine bestimmte Anzahl Kekse geerntet werden, dann folgt der Level-Übergang.
 * - Ist das Wasser leer, ist die Oase vertrocknet: Game Over.
 *
 * Neue Elemente pro Level:
 * - Level 2: Fata-Morgana-Kekse schweben in der Wüste. NICHT beschiessen (kostet Wasser).
 * - Level 3: Glutklumpen – gross und zäh, brauchen mehrere Laser gleichzeitig (Teamwork),
 *            zerfallen beim Platzen in kleine Hitze-Pixel.
 * - Level 4: Zickzack-Pixel, die seitlich ausschlagen.
 * - Level 5+: Sonnenstürme – regelmässig eine ganze Salve auf einmal.
 *
 * Mehrspieler: Hitze-Pixel kommen über die ganze Breite, viele gleichzeitig; alle Ziele sind
 * gui/pixelFillButtons, die Wirkung skaliert mit dem beleuchteten Flächenanteil.
 *
 * Tastatur-Test: Space = Start, H = alle reifen Kekse ernten, X = alle Hitze-Pixel zerstören,
 *                L = nächstes Level.
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
import soundSplash from '../../../public/media/485066__javierserrat__object-falls-into-the-water.wav';

const DIFFICULTY = {
  // Level-Ziel: geerntete Kekse
  cookiesGoalStart: 6,
  cookiesGoalPerLevel: 3,
  levelUpDuration: 2.5, // Sekunden Level-Übergang
  // Wasser (Leben)
  waterMax: 100,
  waterLossHeat: 10, // Hitze-Pixel trifft Beet
  waterLossMirage: 12, // Fata Morgana beschossen
  waterGainHarvest: 3,
  // Beete
  bedCount: 6,
  ripenTime: 7, // Sekunden bis ein Keks reif ist
  ripenTimePerLevel: 0.4, // Kekse reifen später etwas langsamer
  ripeDuration: 6, // so lange bleibt ein reifer Keks erntbar, dann zerfällt er
  cookieHarvestTime: 0.6, // Sekunden Beleuchtung bei voller Bedeckung
  cookieFullPercent: 30,
  // Hitze-Pixel
  spawnIntervalStart: 1.5,
  spawnIntervalFactor: 0.86,
  spawnIntervalMin: 0.3,
  maxHeatStart: 5,
  maxHeatPerLevel: 3,
  maxHeatCap: 30,
  heatSpeedStart: 110, // px/s
  heatSpeedPerLevel: 18,
  heatSpeedCap: 320,
  heatHitTime: 0.25,
  heatFullPercent: 35,
  heatDecay: 120, // Abbau Füllstand pro Sekunde
  // Glutklumpen (ab glutLevel)
  glutLevel: 3,
  glutChance: 0.12,
  glutRadius: 140,
  glutHitTime: 2.2, // bei voller Bedeckung, d. h. viele Laser
  glutFullPercent: 45,
  glutSplit: 4,
  // Zickzack (ab zigzagLevel)
  zigzagLevel: 4,
  zigzagChance: 0.35,
  // Fata Morgana (ab mirageLevel)
  mirageLevel: 2,
  mirageInterval: 6,
  mirageMax: 3,
  mirageLifetime: 9,
  // Sonnensturm (ab stormLevel)
  stormLevel: 5,
  stormInterval: 14,
  stormCountStart: 6,
  stormCountPerLevel: 2,
  // Punkte
  scoreHeat: 10,
  scoreGlut: 50,
  scoreHarvest: 50,
  scoreCrumble: -30,
  // Effekte
  maxParticles: 400,
};

const W = 1920;
const H = 1080;
const SUN_X = W / 2;
const SUN_Y = 150;
const BED_Y = 930;
const PIXEL = 10; // Pixelgröße des Retro-Looks

// --- Zustand ---
var gameState = 'start';
var level = 1;
var score = 0;
var water = DIFFICULTY.waterMax;
var harvestedInLevel = 0;
var gameTime = 0;
var stateTime = 0;
var spawnTimer = 0;
var mirageTimer = 0;
var stormTimer = 0;
var shake = 0;
var flash = 0;
var heats = [];
var beds = [];
var mirages = [];
var particles = [];
var floatingTexts = [];
var buttonsStart = [];
var buttonsGameOver = [];
var stats = { heat: 0, glut: 0, harvested: 0, crumbled: 0, burned: 0, mirages: 0 };
var previousKeys = {};
var lastTime = 0;
var activeSounds = [];

// --- Farben (alle aus testColor abgeleitet, nie die reine Laserfarbe) ---
var COL = {};
function updateColors() {
  const c = laserConfig.testColor;
  COL = {
    sky1: getRgbSpreadHex(c, 0.55, 0.7, 0.12),
    sky2: getRgbSpreadHex(c, 0.62, 0.6, 0.35),
    duneFar: getRgbSpreadHex(c, 0.45, 0.55, 0.45),
    duneMid: getRgbSpreadHex(c, 0.42, 0.6, 0.6),
    duneNear: getRgbSpreadHex(c, 0.4, 0.65, 0.75),
    sun: getRgbSpreadHex(c, 0.5, 0.9, 1),
    sunCore: getRgbSpreadHex(c, 0.48, 0.4, 1),
    heat: getRgbSpreadHex(c, 0.52, 1, 1),
    heatCore: getRgbSpreadHex(c, 0.5, 0.3, 1),
    glut: getRgbSpreadHex(c, 0.56, 1, 0.95),
    green: getRgbSpreadHex(c, 0.25, 0.75, 0.75),
    greenDark: getRgbSpreadHex(c, 0.27, 0.8, 0.4),
    water: getRgbSpreadHex(c, 0.2, 0.7, 0.9),
    cookie: getRgbSpreadHex(c, 0.42, 0.6, 0.8),
    cookieRipe: getRgbSpreadHex(c, 0.45, 0.85, 1),
    cookieRaw: getRgbSpreadHex(c, 0.4, 0.3, 0.55),
    choc: getRgbSpreadHex(c, 0.38, 0.6, 0.3),
    mirage: getRgbSpreadHex(c, 0.22, 0.4, 1),
    text: getRgbSpreadHex(c, 0.45, 0.5, 1),
    textHi: getRgbSpreadHex(c, 0.35, 0.8, 1),
    bad: getRgbSpreadHex(c, 0.6, 0.9, 1),
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

function lv(start, perLevel, cap) {
  const v = start + perLevel * (level - 1);
  return perLevel >= 0 ? Math.min(cap, v) : Math.max(cap, v);
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
  floatingTexts.push({ text, x, y, color, size, time: 0, duration: 1.4 });
}

function burst(x, y, color, count = 18, speed = 300) {
  for (let i = 0; i < count && particles.length < DIFFICULTY.maxParticles; i++) {
    const a = Math.random() * Math.PI * 2;
    const s = speed * (0.3 + Math.random() * 0.7);
    particles.push({
      x,
      y,
      vx: Math.cos(a) * s,
      vy: Math.sin(a) * s - 80,
      life: 0,
      maxLife: 0.6 + Math.random() * 0.6,
      size: PIXEL * (0.6 + Math.random() * 1.2),
      color,
    });
  }
}

// --- vorgerenderte Grafik ---
var bgCanvas = null;
var cookieSprites = {};

/** Pixel-Wüste: einmal klein rendern und hochskaliert ohne Glättung zeichnen */
function renderBackground() {
  const w = W / PIXEL;
  const h = H / PIXEL;
  const small = document.createElement('canvas');
  small.width = w;
  small.height = h;
  const ctx = small.getContext('2d');
  // Himmel in Bändern (Retro-Verlauf)
  const bands = 8;
  for (let i = 0; i < bands; i++) {
    const t = i / (bands - 1);
    ctx.fillStyle = t < 0.5 ? COL.sky1 : COL.sky2;
    ctx.globalAlpha = 0.5 + t * 0.5;
    ctx.fillRect(0, Math.floor((i * h * 0.6) / bands), w, Math.ceil((h * 0.6) / bands) + 1);
  }
  ctx.globalAlpha = 1;
  // Sterne/Staub
  ctx.fillStyle = COL.text;
  for (let i = 0; i < 60; i++) {
    ctx.globalAlpha = 0.2 + Math.random() * 0.4;
    ctx.fillRect(Math.floor(Math.random() * w), Math.floor(Math.random() * h * 0.45), 1, 1);
  }
  ctx.globalAlpha = 1;
  // Dünen in drei Ebenen
  const dune = (baseY, amp, freq, phase, color) => {
    ctx.fillStyle = color;
    for (let x = 0; x < w; x++) {
      const y = Math.floor(
        baseY + Math.sin(x * freq + phase) * amp + Math.sin(x * freq * 2.7 + phase * 2) * amp * 0.3
      );
      ctx.fillRect(x, y, 1, h - y);
    }
  };
  dune(h * 0.55, 5, 0.05, 1, COL.duneFar);
  dune(h * 0.68, 6, 0.035, 3, COL.duneMid);
  dune(h * 0.8, 4, 0.06, 5, COL.duneNear);
  // Kakteen
  ctx.fillStyle = COL.greenDark;
  [12, 40, 150, 178].forEach((cx) => {
    const cy = Math.floor(h * 0.7);
    ctx.fillRect(cx, cy - 8, 2, 10);
    ctx.fillRect(cx - 2, cy - 5, 2, 1);
    ctx.fillRect(cx - 2, cy - 7, 1, 2);
    ctx.fillRect(cx + 2, cy - 4, 2, 1);
    ctx.fillRect(cx + 3, cy - 6, 1, 2);
  });
  // Oasen-Rasen unter den Beeten
  ctx.fillStyle = COL.greenDark;
  ctx.fillRect(0, Math.floor(h * 0.9), w, h);
  ctx.fillStyle = COL.green;
  for (let x = 0; x < w; x += 2) {
    ctx.fillRect(x, Math.floor(h * 0.9) - (x % 6 === 0 ? 2 : 1), 1, 2);
  }

  const big = document.createElement('canvas');
  big.width = W;
  big.height = H;
  const bctx = big.getContext('2d');
  bctx.imageSmoothingEnabled = false;
  bctx.drawImage(small, 0, 0, W, H);
  return big;
}

/** Pixel-Keks in drei Zuständen */
function renderCookie(size, base, chips) {
  const n = 12; // Pixel pro Durchmesser
  const small = document.createElement('canvas');
  small.width = n;
  small.height = n;
  const ctx = small.getContext('2d');
  const r = n / 2;
  const chipPos = [
    [3, 4],
    [7, 3],
    [5, 7],
    [8, 7],
    [3, 8],
  ];
  for (let y = 0; y < n; y++) {
    for (let x = 0; x < n; x++) {
      const dx = x + 0.5 - r;
      const dy = y + 0.5 - r;
      const d = Math.sqrt(dx * dx + dy * dy);
      if (d < r - 0.2) {
        ctx.fillStyle = d > r - 1.4 ? chips : base;
        ctx.fillRect(x, y, 1, 1);
      }
    }
  }
  ctx.fillStyle = chips;
  chipPos.forEach(([x, y]) => ctx.fillRect(x, y, 1, 1));
  const big = document.createElement('canvas');
  big.width = size;
  big.height = size;
  const bctx = big.getContext('2d');
  bctx.imageSmoothingEnabled = false;
  bctx.drawImage(small, 0, 0, size, size);
  return big;
}

function prerender() {
  updateColors();
  glowSprites = {};
  bgCanvas = renderBackground();
  cookieSprites = {
    raw: renderCookie(120, COL.cookieRaw, COL.choc),
    ripe: renderCookie(120, COL.cookieRipe, COL.choc),
    mirage: renderCookie(120, COL.mirage, COL.sky2),
  };
}

// --- Pixel-Zeichnen ---
var glowSprites = {};
/** radialer Leuchtschein pro Farbe, einmal gerendert */
function getGlowSprite(color) {
  if (!glowSprites[color]) {
    const size = 128;
    const c = document.createElement('canvas');
    c.width = size;
    c.height = size;
    const g = c.getContext('2d');
    const grad = g.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
    grad.addColorStop(0, color + 'aa');
    grad.addColorStop(0.5, color + '33');
    grad.addColorStop(1, color + '00');
    g.fillStyle = grad;
    g.fillRect(0, 0, size, size);
    glowSprites[color] = c;
  }
  return glowSprites[color];
}

/** zeichnet einen "Pixelklumpen": Raster aus Quadraten innerhalb eines Kreises */
function drawPixelBlob(ctx, x, y, radius, color, coreColor, time, seed) {
  const step = PIXEL * (radius > 80 ? 2 : 1.4);
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  // weicher Schein aus vorgerendertem Sprite statt teurem shadowBlur pro Pixel
  const glow = getGlowSprite(color);
  ctx.globalAlpha = 0.7;
  ctx.drawImage(glow, x - radius * 1.6, y - radius * 1.6, radius * 3.2, radius * 3.2);
  ctx.globalAlpha = 1;
  for (let gy = -radius; gy <= radius; gy += step) {
    for (let gx = -radius; gx <= radius; gx += step) {
      const d = Math.sqrt(gx * gx + gy * gy);
      const wobble = Math.sin(time * 8 + gx * 0.05 + gy * 0.07 + seed) * step * 0.6;
      if (d < radius * 0.8 + wobble) {
        ctx.fillStyle = d < radius * 0.35 ? coreColor : color;
        ctx.fillRect(Math.round(x + gx - step / 2), Math.round(y + gy - step / 2), step - 2, step - 2);
      }
    }
  }
  ctx.restore();
}

function renderSun(ctx) {
  ctx.save();
  ctx.translate(SUN_X, SUN_Y);
  // rotierende Pixelstrahlen
  ctx.globalCompositeOperation = 'lighter';
  const rays = 16;
  for (let i = 0; i < rays; i++) {
    const a = (i / rays) * Math.PI * 2 + gameTime * 0.25;
    const len = 150 + Math.sin(gameTime * 3 + i) * 30 + (i % 2) * 40;
    ctx.fillStyle = COL.sun;
    ctx.globalAlpha = 0.5;
    for (let r = 120; r < len; r += PIXEL * 2) {
      ctx.fillRect(
        Math.round((Math.cos(a) * r) / PIXEL) * PIXEL - PIXEL / 2,
        Math.round((Math.sin(a) * r) / PIXEL) * PIXEL - PIXEL / 2,
        PIXEL * 1.5,
        PIXEL * 1.5
      );
    }
  }
  ctx.globalAlpha = 1;
  ctx.restore();
  // Sonnenscheibe aus Pixeln
  const pulse = 100 + Math.sin(gameTime * 2) * 6;
  drawPixelBlob(ctx, SUN_X, SUN_Y, pulse * 1.25, COL.sun, COL.sunCore, gameTime * 0.3, 0);
  // Gesicht: grimmig, wird mit dem Level wütender
  ctx.save();
  ctx.fillStyle = COL.sky1;
  const anger = Math.min(1, (level - 1) / 5);
  ctx.fillRect(SUN_X - 45, SUN_Y - 20, 20, 20);
  ctx.fillRect(SUN_X + 25, SUN_Y - 20, 20, 20);
  ctx.fillRect(SUN_X - 55, SUN_Y - 40, 40, 8 + anger * 6);
  ctx.fillRect(SUN_X + 15, SUN_Y - 40, 40, 8 + anger * 6);
  ctx.fillRect(SUN_X - 30, SUN_Y + 35, 60, 10);
  ctx.restore();
}

/** Hitzeflimmern: ein paar horizontale Streifen über dem Sand */
function renderShimmer(ctx) {
  ctx.save();
  ctx.globalAlpha = 0.08;
  ctx.fillStyle = COL.sun;
  for (let i = 0; i < 6; i++) {
    const y = 560 + i * 45 + Math.sin(gameTime * 2 + i) * 10;
    const x = ((gameTime * (40 + i * 15)) % (W + 600)) - 600;
    ctx.fillRect(x, y, 600, 6);
  }
  ctx.restore();
}

// --- Beete & Kekse ---
function bedX(i) {
  const margin = 200;
  return margin + (i * (W - 2 * margin)) / (DIFFICULTY.bedCount - 1);
}

function createBed(index) {
  const bed = {
    index,
    x: bedX(index),
    y: BED_Y,
    ripen: 0, // 0..1
    ripeTime: 0,
    scorch: 0, // Brand-Effekt
    button: null,
  };
  bed.button = guiPixelFillButton({
    label: '',
    posX: bed.x,
    posY: bed.y - 70,
    radius: 70,
    edges: 8,
    lineWidth: 4,
    fullPercent: DIFFICULTY.cookieFullPercent,
    speedUp: 100 / DIFFICULTY.cookieHarvestTime,
    speedDown: 150,
    minValue: 1,
    activeValue: 99,
    counterReset: true,
    normalColor: COL.greenDark,
    growColor: COL.cookie,
    activeColor: COL.textHi,
    onEnterActive: () => {
      if (gameState !== 'game') return;
      if (bed.ripen >= 1) harvest(bed);
      else crumble(bed);
    },
  });
  const original = bed.button.handle;
  bed.button.handle = (grid, elapsed, ctx) => {
    const ripenTime = DIFFICULTY.ripenTime + DIFFICULTY.ripenTimePerLevel * (level - 1);
    if (bed.ripen < 1) {
      bed.ripen = Math.min(1, bed.ripen + elapsed / ripenTime);
      if (bed.ripen >= 1) bed.ripeTime = 0;
    } else {
      bed.ripeTime += elapsed;
      if (bed.ripeTime > DIFFICULTY.ripeDuration) {
        // überreif: zerfällt ohne Strafe, aber verschenkt
        burst(bed.x, bed.y - 70, COL.cookieRaw, 10, 150);
        addFloatingText('zu spät!', bed.x, bed.y - 160, COL.text, 36);
        bed.ripen = 0;
      }
    }
    bed.scorch = Math.max(0, bed.scorch - elapsed);
    renderBed(ctx, bed);
    // Hinweis-Farbe: reif = leuchtend, unreif = Warnfarbe wenn beleuchtet
    const ripe = bed.ripen >= 1;
    bed.button.setGrowColor(ripe ? COL.cookieRipe : COL.bad);
    bed.button.setColor(ripe ? COL.cookieRipe : COL.greenDark);
    bed.button.setLineWidth(ripe ? 6 + Math.sin(gameTime * 8) * 3 : 3);
    original(grid, elapsed);
  };
  return bed;
}

function renderBed(ctx, bed) {
  const { x, y } = bed;
  // Erdhügel
  ctx.save();
  ctx.fillStyle = COL.choc;
  for (let i = -6; i <= 6; i++) {
    const hgt = (6 - Math.abs(i)) * 4 + 12;
    ctx.fillRect(x + i * PIXEL * 1.5 - PIXEL * 0.75, y + 20 - hgt, PIXEL * 1.5, hgt + 40);
  }
  // Pflanze: Stängel + Blätter
  ctx.fillStyle = bed.scorch > 0 ? COL.bad : COL.green;
  const stem = 20 + bed.ripen * 30;
  ctx.fillRect(x - PIXEL / 2, y - stem, PIXEL, stem);
  ctx.fillRect(x - PIXEL * 3, y - stem * 0.5, PIXEL * 2.5, PIXEL);
  ctx.fillRect(x + PIXEL * 0.5, y - stem * 0.7, PIXEL * 2.5, PIXEL);
  ctx.restore();

  // Keks wächst
  const size = 40 + bed.ripen * 80;
  const ripe = bed.ripen >= 1;
  const sprite = ripe ? cookieSprites.ripe : cookieSprites.raw;
  const pulse = ripe ? 1 + Math.sin(gameTime * 8) * 0.06 : 1;
  const s = size * pulse;
  ctx.save();
  if (ripe) {
    ctx.shadowColor = COL.cookieRipe;
    ctx.shadowBlur = 40;
  }
  ctx.imageSmoothingEnabled = false;
  ctx.drawImage(sprite, x - s / 2, y - 70 - s / 2, s, s);
  ctx.restore();
  // Reife-Balken
  if (!ripe) {
    ctx.save();
    ctx.fillStyle = COL.sky1;
    ctx.fillRect(x - 50, y + 30, 100, 14);
    ctx.fillStyle = COL.cookie;
    ctx.fillRect(x - 50, y + 30, 100 * bed.ripen, 14);
    ctx.restore();
  } else {
    // Rest-Zeit bis zum Zerfall
    const rest = 1 - bed.ripeTime / DIFFICULTY.ripeDuration;
    ctx.save();
    ctx.fillStyle = COL.cookieRipe;
    ctx.fillRect(x - 50 * rest, y + 30, 100 * rest, 14);
    ctx.restore();
  }
}

function harvest(bed) {
  bed.ripen = 0;
  score += DIFFICULTY.scoreHarvest;
  water = Math.min(DIFFICULTY.waterMax, water + DIFFICULTY.waterGainHarvest);
  harvestedInLevel++;
  stats.harvested++;
  burst(bed.x, bed.y - 70, COL.cookieRipe, 30, 420);
  addFloatingText(`+${DIFFICULTY.scoreHarvest} Keks!`, bed.x, bed.y - 170, COL.cookieRipe);
  playSound(soundPop, 0.8);
}

function crumble(bed) {
  bed.ripen = 0;
  score += DIFFICULTY.scoreCrumble;
  stats.crumbled++;
  shake = Math.max(shake, 0.25);
  burst(bed.x, bed.y - 70, COL.cookieRaw, 20, 250);
  addFloatingText(`${DIFFICULTY.scoreCrumble} zerkrümelt!`, bed.x, bed.y - 170, COL.bad);
}

// --- Hitze-Pixel ---
function createHeat({ x, y, big = false, zigzag = false, targetBed } = {}) {
  const startX = x !== undefined ? x : SUN_X + (Math.random() - 0.5) * 200;
  const startY = y !== undefined ? y : SUN_Y + 60;
  const bed = targetBed || beds[Math.floor(Math.random() * beds.length)];
  const radius = big ? DIFFICULTY.glutRadius : 55 + Math.random() * 20;
  const baseSpeed = lv(DIFFICULTY.heatSpeedStart, DIFFICULTY.heatSpeedPerLevel, DIFFICULTY.heatSpeedCap);
  const speed = (big ? 0.45 : 0.8 + Math.random() * 0.4) * baseSpeed;
  const hitTime = big ? DIFFICULTY.glutHitTime : DIFFICULTY.heatHitTime;
  // Bogenflug: Start -> Kontrollpunkt (weit seitlich) -> Beet, damit die ganze Fläche genutzt wird
  const ctrlX = Math.random() * W;
  const ctrlY = 250 + Math.random() * 250;
  const dist = Math.hypot(bed.x - startX, bed.y - startY) + Math.abs(ctrlX - startX) * 0.5;
  const duration = dist / speed;
  const heat = {
    big,
    zigzag,
    t: 0,
    duration,
    seed: Math.random() * 100,
    radius,
    bed,
    button: null,
  };
  const color = big ? COL.glut : COL.heat;
  heat.button = guiPixelFillButton({
    label: '',
    posX: startX,
    posY: startY,
    radius,
    edges: 4,
    angle: Math.PI / 4,
    lineWidth: 3,
    fullPercent: big ? DIFFICULTY.glutFullPercent : DIFFICULTY.heatFullPercent,
    speedUp: 100 / hitTime,
    speedDown: DIFFICULTY.heatDecay * (big ? 0.4 : 1),
    minValue: 0,
    activeValue: 99,
    normalColor: color,
    growColor: COL.textHi,
    activeColor: COL.textHi,
    onEnterActive: () => destroyHeat(heat),
  });
  const original = heat.button.handle;
  heat.button.handle = (grid, elapsed, ctx) => {
    heat.t += elapsed / heat.duration;
    const t = Math.min(1, heat.t);
    const u = 1 - t;
    let px = u * u * startX + 2 * u * t * ctrlX + t * t * bed.x;
    const py = u * u * startY + 2 * u * t * ctrlY + t * t * (bed.y - 70);
    if (heat.zigzag) px += Math.sin(heat.t * 18 + heat.seed) * 120 * (1 - t);
    heat.button.setX(px);
    heat.button.setY(py);
    if (heat.t >= 1) {
      hitBed(heat);
      return;
    }
    // Glutspur
    if (Math.random() < elapsed * (big ? 30 : 12) && particles.length < DIFFICULTY.maxParticles) {
      particles.push({
        x: px,
        y: py,
        vx: (Math.random() - 0.5) * 40,
        vy: -30,
        life: 0,
        maxLife: 0.5,
        size: PIXEL,
        color,
      });
    }
    const hp = heat.button.getValue() / 100;
    const r = radius * (1 - hp * 0.35);
    drawPixelBlob(ctx, px, py, r, color, COL.heatCore, gameTime, heat.seed);
    original(grid, elapsed);
  };
  heats.push(heat);
  return heat;
}

function destroyHeat(heat) {
  if (!heats.includes(heat)) return;
  removeItemFromArray(heats, heat);
  const x = heat.button.getX();
  const y = heat.button.getY();
  if (heat.big) {
    stats.glut++;
    score += DIFFICULTY.scoreGlut;
    burst(x, y, COL.glut, 50, 600);
    addFloatingText(`+${DIFFICULTY.scoreGlut} TEAMWORK!`, x, y - 60, COL.textHi, 56);
    shake = Math.max(shake, 0.3);
    playSound(soundBoom, 0.6);
    // zerfällt in kleine Hitze-Pixel
    for (let i = 0; i < DIFFICULTY.glutSplit; i++) {
      createHeat({ x: x + (Math.random() - 0.5) * 100, y: y + (Math.random() - 0.5) * 100 });
    }
  } else {
    stats.heat++;
    score += DIFFICULTY.scoreHeat;
    burst(x, y, COL.heat, 16, 350);
    addFloatingText(`+${DIFFICULTY.scoreHeat}`, x, y - 40, COL.text, 38);
    playSound(soundPop, 0.4);
  }
}

function hitBed(heat) {
  removeItemFromArray(heats, heat);
  const bed = heat.bed;
  const loss = DIFFICULTY.waterLossHeat * (heat.big ? 2 : 1);
  water -= loss;
  stats.burned++;
  bed.ripen = 0;
  bed.scorch = 1.2;
  shake = Math.max(shake, heat.big ? 0.6 : 0.35);
  burst(bed.x, bed.y - 70, COL.bad, 30, 400);
  addFloatingText(`-${loss} Wasser`, bed.x, bed.y - 180, COL.bad);
  playSound(soundBoom, 0.5);
  if (water <= 0) {
    water = 0;
    gameState = 'gameover';
    stateTime = 0;
    buttonsGameOver = createGameOverButtons();
  }
}

// --- Fata Morgana ---
function createMirage() {
  const radius = 75;
  const mirage = {
    life: 0,
    seed: Math.random() * 100,
    baseX: 250 + Math.random() * (W - 500),
    baseY: 380 + Math.random() * 300,
    button: null,
  };
  mirage.button = guiPixelFillButton({
    label: '',
    posX: mirage.baseX,
    posY: mirage.baseY,
    radius,
    edges: 12,
    lineWidth: 2,
    fullPercent: 30,
    speedUp: 100 / 0.5,
    speedDown: 150,
    minValue: 1,
    activeValue: 99,
    normalColor: COL.mirage,
    growColor: COL.bad,
    activeColor: COL.bad,
    onEnterActive: () => {
      if (!mirages.includes(mirage)) return;
      removeItemFromArray(mirages, mirage);
      water -= DIFFICULTY.waterLossMirage;
      stats.mirages++;
      shake = Math.max(shake, 0.4);
      burst(mirage.button.getX(), mirage.button.getY(), COL.mirage, 25, 300);
      addFloatingText(
        `Fata Morgana! -${DIFFICULTY.waterLossMirage} Wasser`,
        mirage.button.getX(),
        mirage.button.getY() - 100,
        COL.bad
      );
      playSound(soundSplash, 0.7);
      if (water <= 0) {
        water = 0;
        gameState = 'gameover';
        stateTime = 0;
        buttonsGameOver = createGameOverButtons();
      }
    },
  });
  const original = mirage.button.handle;
  mirage.button.handle = (grid, elapsed, ctx) => {
    mirage.life += elapsed;
    if (mirage.life > DIFFICULTY.mirageLifetime) {
      removeItemFromArray(mirages, mirage);
      return;
    }
    const x = mirage.baseX + Math.sin(mirage.life * 1.3 + mirage.seed) * 60;
    const y = mirage.baseY + Math.sin(mirage.life * 2.1 + mirage.seed) * 20;
    mirage.button.setX(x);
    mirage.button.setY(y);
    // ein- und ausblenden, flimmernd in Streifen gezeichnet
    const fade = Math.min(1, mirage.life, DIFFICULTY.mirageLifetime - mirage.life);
    ctx.save();
    ctx.globalAlpha = 0.55 * fade;
    const s = 130;
    const sprite = cookieSprites.mirage;
    for (let row = 0; row < s; row += PIXEL) {
      const off = Math.sin(gameTime * 10 + row * 0.15) * 8;
      ctx.drawImage(
        sprite,
        0,
        (row / s) * sprite.height,
        sprite.width,
        (PIXEL / s) * sprite.height,
        x - s / 2 + off,
        y - s / 2 + row,
        s,
        PIXEL
      );
    }
    ctx.restore();
    original(grid, elapsed);
  };
  mirages.push(mirage);
}

// --- Spielfluss ---
function levelGoal() {
  return DIFFICULTY.cookiesGoalStart + DIFFICULTY.cookiesGoalPerLevel * (level - 1);
}

function startLevelUp() {
  gameState = 'levelup';
  stateTime = 0;
  flash = 1;
  heats.slice().forEach((h) => {
    burst(h.button.getX(), h.button.getY(), COL.heat, 8, 200);
  });
  heats = [];
  mirages = [];
  playSound(soundLevel, 0.8);
}

function startNextLevel() {
  level++;
  harvestedInLevel = 0;
  spawnTimer = 0;
  mirageTimer = 0;
  stormTimer = 0;
  gameState = 'game';
}

function newElementText(lvl) {
  if (lvl === DIFFICULTY.mirageLevel)
    return 'NEU: Fata-Morgana-Kekse!\nDie schimmernden Kekse NICHT anleuchten!';
  if (lvl === DIFFICULTY.glutLevel)
    return 'NEU: Glutklumpen!\nAlle zusammen draufhalten – sie zerfallen in kleine Pixel!';
  if (lvl === DIFFICULTY.zigzagLevel) return 'NEU: Zickzack-Pixel!\nGut zielen!';
  if (lvl === DIFFICULTY.stormLevel) return 'NEU: Sonnenstürme!\nGanze Salven auf einmal!';
  if (lvl > DIFFICULTY.stormLevel) return 'Die Sonne wird wütender …';
  return '';
}

function resetGame() {
  updateColors();
  level = 1;
  score = 0;
  water = DIFFICULTY.waterMax;
  harvestedInLevel = 0;
  gameTime = 0;
  stateTime = 0;
  spawnTimer = 0;
  mirageTimer = 0;
  stormTimer = 0;
  shake = 0;
  flash = 0;
  heats = [];
  mirages = [];
  particles = [];
  floatingTexts = [];
  stats = { heat: 0, glut: 0, harvested: 0, crumbled: 0, burned: 0, mirages: 0 };
  beds = [];
  for (let i = 0; i < DIFFICULTY.bedCount; i++) {
    const bed = createBed(i);
    bed.ripen = 0.3 + Math.random() * 0.4; // gestaffelt, damit nicht alle gleichzeitig reif sind
    beds.push(bed);
  }
  lastTime = performance.now();
}

function bigButton(onEnter) {
  return guiFillButton({
    label: 'START',
    posX: W / 2,
    posY: H / 2 + 230,
    speedDown: 12,
    speedUp: 25,
    edges: 12,
    activeValue: 90,
    radius: 150,
    normalColor: COL.cookie,
    activeColor: COL.textHi,
    growColor: COL.cookieRipe,
    onEnterActive: onEnter,
    onExitActive: () => {},
  });
}

function createStartButtons() {
  return [
    bigButton(() => {
      resetGame();
      gameState = 'game';
    }),
  ];
}

function createGameOverButtons() {
  return [
    bigButton(() => {
      resetGame();
      gameState = 'game';
    }),
  ];
}

// --- Rendering gemeinsam ---
function renderWorld(ctx, elapsed) {
  ctx.drawImage(bgCanvas, 0, 0);
  renderShimmer(ctx);
  renderSun(ctx);
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
    p.vy += 500 * elapsed;
    p.x += p.vx * elapsed;
    p.y += p.vy * elapsed;
    ctx.globalAlpha = 1 - p.life / p.maxLife;
    ctx.fillStyle = p.color;
    ctx.fillRect(Math.round(p.x / 4) * 4, Math.round(p.y / 4) * 4, p.size, p.size);
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
      y: t.y - t.time * 70,
    });
    ctx.restore();
  }
}

function renderHud(ctx) {
  util.renderTextDropShadow({
    ctx,
    text: `Level ${level}   Punkte ${score}`,
    fontSize: '48px',
    dropDistX: 4,
    dropDistY: 4,
    fillStyle: COL.text,
    align: 'left',
    x: 40,
    y: 70,
  });
  util.renderTextDropShadow({
    ctx,
    text: `Kekse ${harvestedInLevel} / ${levelGoal()}`,
    fontSize: '48px',
    dropDistX: 4,
    dropDistY: 4,
    fillStyle: COL.cookieRipe,
    align: 'right',
    x: W - 40,
    y: 70,
  });
  // Wassertank
  const bw = 420;
  const x = W - 40 - bw;
  const y = 100;
  ctx.save();
  ctx.fillStyle = COL.sky1;
  ctx.fillRect(x, y, bw, 34);
  const ratio = water / DIFFICULTY.waterMax;
  const low = ratio < 0.3 && Math.floor(gameTime * 4) % 2 === 0;
  ctx.fillStyle = low ? COL.bad : COL.water;
  ctx.shadowColor = COL.water;
  ctx.shadowBlur = 15;
  for (let i = 0; i < Math.ceil((bw * ratio) / 14); i++) {
    ctx.fillRect(x + i * 14 + 2, y + 4 + Math.sin(gameTime * 4 + i * 0.5) * 2, 10, 26);
  }
  ctx.restore();
  util.renderText({
    ctx,
    text: 'Oasen-Wasser',
    fontSize: '30px',
    fillStyle: COL.water,
    align: 'right',
    x: x - 15,
    y: y + 28,
  });
}

// --- Bildschirme ---
function handleStart(grid, elapsed, ctx) {
  gameTime += elapsed;
  renderWorld(ctx, elapsed);
  // Deko: ein paar Kekse wippen über den Bildschirm
  for (let i = 0; i < 5; i++) {
    const x = 250 + i * 355;
    const y = 900 + Math.sin(gameTime * 2 + i) * 20;
    const s = 110 + Math.sin(gameTime * 3 + i * 2) * 10;
    ctx.save();
    ctx.shadowColor = COL.cookieRipe;
    ctx.shadowBlur = 30;
    ctx.drawImage(cookieSprites.ripe, x - s / 2, y - s / 2, s, s);
    ctx.restore();
  }
  if (Math.random() < elapsed * 10) {
    burst(SUN_X + (Math.random() - 0.5) * 250, SUN_Y + (Math.random() - 0.5) * 250, COL.sun, 3, 200);
  }
  updateParticles(ctx, elapsed);
  util.renderTextDropShadow({
    ctx,
    text: 'KEKS-OASE',
    fontSize: '150px',
    fillStyle: COL.cookieRipe,
    x: W / 2,
    y: 420,
  });
  util.renderTextDropShadow({
    ctx,
    text: 'Schiesst die Hitze-Pixel der Sonne ab und erntet nur REIFE Kekse!',
    fontSize: '44px',
    dropDistX: 4,
    dropDistY: 4,
    fillStyle: COL.text,
    x: W / 2,
    y: 510,
  });
  buttonsStart.forEach((b) => b.handle(grid, elapsed));
  if (keyPressedOnce('Space')) {
    resetGame();
    gameState = 'game';
  }
}

function handleGame(grid, elapsed, ctx) {
  gameTime += elapsed;
  stateTime += elapsed;

  // Tastatur-Testmodus
  if (keyPressedOnce('KeyH')) beds.filter((b) => b.ripen >= 1).forEach((b) => harvest(b));
  if (keyPressedOnce('KeyX')) heats.slice().forEach((h) => destroyHeat(h));
  if (keyPressedOnce('KeyL')) harvestedInLevel = levelGoal();

  // Hitze-Pixel spawnen
  spawnTimer += elapsed;
  const interval = Math.max(
    DIFFICULTY.spawnIntervalMin,
    DIFFICULTY.spawnIntervalStart * Math.pow(DIFFICULTY.spawnIntervalFactor, level - 1)
  );
  const maxHeat = lv(DIFFICULTY.maxHeatStart, DIFFICULTY.maxHeatPerLevel, DIFFICULTY.maxHeatCap);
  if (spawnTimer >= interval && heats.length < maxHeat) {
    spawnTimer = 0;
    const big = level >= DIFFICULTY.glutLevel && Math.random() < DIFFICULTY.glutChance;
    const zigzag =
      !big && level >= DIFFICULTY.zigzagLevel && Math.random() < DIFFICULTY.zigzagChance;
    createHeat({ big, zigzag });
  }

  // Fata Morgana
  if (level >= DIFFICULTY.mirageLevel) {
    mirageTimer += elapsed;
    if (mirageTimer >= DIFFICULTY.mirageInterval && mirages.length < DIFFICULTY.mirageMax) {
      mirageTimer = 0;
      createMirage();
    }
  }

  // Sonnensturm
  if (level >= DIFFICULTY.stormLevel) {
    stormTimer += elapsed;
    if (stormTimer >= DIFFICULTY.stormInterval) {
      stormTimer = 0;
      const count =
        DIFFICULTY.stormCountStart + DIFFICULTY.stormCountPerLevel * (level - DIFFICULTY.stormLevel);
      for (let i = 0; i < count; i++) {
        createHeat({ zigzag: Math.random() < 0.3 });
      }
      flash = 0.5;
      shake = Math.max(shake, 0.5);
      addFloatingText('SONNENSTURM!', W / 2, 380, COL.bad, 80);
      playSound(soundBoom, 0.8);
    }
  }

  // Bildschirm-Wackeln
  shake = Math.max(0, shake - elapsed);
  ctx.save();
  if (shake > 0) {
    const s = shake * 30;
    ctx.translate((Math.random() - 0.5) * s, (Math.random() - 0.5) * s);
  }
  renderWorld(ctx, elapsed);
  mirages.slice().forEach((m) => m.button.handle(grid, elapsed, ctx));
  beds.forEach((b) => b.button.handle(grid, elapsed, ctx));
  heats.slice().forEach((h) => h.button.handle(grid, elapsed, ctx));
  updateParticles(ctx, elapsed);
  updateFloatingTexts(ctx, elapsed);
  ctx.restore();

  renderHud(ctx);
  renderFlash(ctx, elapsed);

  if (gameState === 'game' && harvestedInLevel >= levelGoal()) {
    startLevelUp();
  }
}

function renderFlash(ctx, elapsed) {
  if (flash <= 0) return;
  ctx.save();
  ctx.globalAlpha = Math.min(0.6, flash * 0.6);
  ctx.fillStyle = COL.sunCore;
  ctx.fillRect(0, 0, W, H);
  ctx.restore();
  flash = Math.max(0, flash - elapsed * 1.5);
}

function handleLevelUp(grid, elapsed, ctx) {
  gameTime += elapsed;
  stateTime += elapsed;
  renderWorld(ctx, elapsed);
  beds.forEach((b) => renderBed(ctx, b));
  // Konfetti aus Keks-Pixeln
  if (Math.random() < elapsed * 25) {
    burst(Math.random() * W, H + 20, Math.random() < 0.5 ? COL.cookieRipe : COL.water, 4, 700);
  }
  updateParticles(ctx, elapsed);
  const t = Math.min(1, stateTime * 3);
  const scale = 0.5 + t * 0.5 + Math.sin(stateTime * 6) * 0.03;
  ctx.save();
  ctx.translate(W / 2, 430);
  ctx.scale(scale, scale);
  util.renderTextDropShadow({
    ctx,
    text: `LEVEL ${level + 1}`,
    fontSize: '170px',
    fillStyle: COL.cookieRipe,
    x: 0,
    y: 0,
  });
  ctx.restore();
  util.renderTextDropShadow({
    ctx,
    text: `${harvestedInLevel} Kekse geerntet!\n${newElementText(level + 1)}`,
    fontSize: '50px',
    lineHeight: 70,
    dropDistX: 4,
    dropDistY: 4,
    fillStyle: COL.text,
    x: W / 2,
    y: 560,
  });
  renderHud(ctx);
  renderFlash(ctx, elapsed);
  if (stateTime >= DIFFICULTY.levelUpDuration) startNextLevel();
}

function handleGameOver(grid, elapsed, ctx) {
  gameTime += elapsed;
  stateTime += elapsed;
  renderWorld(ctx, elapsed);
  updateParticles(ctx, elapsed);
  if (Math.random() < elapsed * 6) {
    burst(Math.random() * W, 950, COL.duneNear, 3, 150);
  }
  util.renderTextDropShadow({
    ctx,
    text: 'Oase vertrocknet!',
    fontSize: '130px',
    fillStyle: COL.bad,
    x: W / 2,
    y: 380,
  });
  util.renderTextDropShadow({
    ctx,
    text:
      `Level ${level} erreicht – ${score} Punkte\n` +
      `${stats.harvested} Kekse geerntet, ${stats.crumbled} zerkrümelt\n` +
      `${stats.heat} Hitze-Pixel und ${stats.glut} Glutklumpen abgeschossen\n` +
      `${stats.burned} Beete verbrannt, ${stats.mirages} Fata Morganas beschossen`,
    fontSize: '44px',
    lineHeight: 62,
    dropDistX: 4,
    dropDistY: 4,
    fillStyle: COL.text,
    x: W / 2,
    y: 480,
  });
  buttonsGameOver.forEach((b) => b.handle(grid, elapsed));
  if (keyPressedOnce('Space')) {
    resetGame();
    gameState = 'game';
  }
}

export default {
  name: 'Keks-Oase',
  description: `
Mitten in der Pixel-Wüste liegt ein Keksgarten.
Die wütende Sonne wirft glühende Hitze-Pixel auf die Beete!

Schiesst die Hitze-Pixel ab, bevor sie ein Beet treffen.
Leuchtet nur REIFE Kekse an (golden, pulsierend) – das ist die Ernte.
Unreife Kekse zerkrümeln, schimmernde Fata-Morgana-Kekse kosten Wasser.

Grosse Glutklumpen schafft ihr nur gemeinsam.
Ist das Oasen-Wasser leer, ist alles vertrocknet.`,
  image: 'media/img/gametitles/laser-paradise-###4###.png',
  init: function () {
    prerender();
    resetGame();
    gameState = 'start';
    buttonsStart = createStartButtons();
    buttonsGameOver = [];
    previousKeys = {};
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
