/**
 * Kristallwacht – Tower Defense für viele Laser
 *
 * Gegner ziehen auf einem gewundenen Leuchtpfad zum Kristall. Neben dem Pfad stehen Puls-Türme.
 * Die Laser sind die ENERGIE der Türme:
 * - Ein Turm feuert nur, solange er beleuchtet wird. Seine Feuerrate wächst mit dem beleuchteten
 *   Flächenanteil (gedeckelt) – mehr Laser auf einem Turm = mehr Wumms (Teamwork).
 * - Bleibt ein Turm lange beleuchtet, füllt er sich und steigt eine Stufe auf (max. 3):
 *   mehr Schaden, mehr Reichweite. Das ist dauerhaft.
 * - Jeder Puls ist eine Schockwelle, die ALLES in Reichweite trifft – auch die friedlichen Pilger.
 *   Kommt ein Pilger vorbei, Turm kurz in Ruhe lassen! (Strafe für wildes Herumleuchten)
 * - Erreicht ein Gegner den Kristall, nimmt dieser Schaden. Kristall kaputt = Game Over.
 *
 * Jedes Level ist eine Welle. Neue Elemente:
 * - Level 2: Pilger (nicht treffen, sicher durchbringen gibt Bonus)
 * - Level 3: Panzerkäfer (Panzerung zieht Schaden ab – aufgerüstete Türme nötig)
 * - Level 4: Flitzer-Schwärme
 * - Level 5: Koloss (Boss, braucht mehrere voll bestromte Türme)
 * - Level 6: Teiler (zerfallen in zwei Krabbler)
 * Zusätzlich wird mit jedem Level ein weiterer Bauplatz freigeschaltet.
 *
 * Eingabe nur über gui/pixelFillButton (ein Button pro Turm, getFillPercent() = Energie).
 * Gegner und Pilger lesen keine Eingabe, sie werden nur von den Türmen getroffen.
 *
 * Tastatur-Test: Space = Start, P (gedrückt halten) = alle Türme voll bestromt,
 *                U = alle Türme aufrüsten, L = Welle sofort beenden.
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
import soundBoss from '../../../public/media/70299__kizilsungur__sonar.wav';
import soundStomp from '../../../public/media/517267__foolboymedia__cinematic-stomp.wav';

const DIFFICULTY = {
  crystalHp: 20,
  // Welle
  waveCountStart: 8,
  waveCountPerLevel: 4,
  spawnIntervalStart: 1.3,
  spawnIntervalFactor: 0.92,
  spawnIntervalMin: 0.35,
  hpPerLevel: 0.15, // Gegner-HP +15 % pro Level
  speedPerLevel: 0.05, // Gegner-Tempo +5 % pro Level
  levelUpDuration: 3,
  // Türme
  socketsStart: 6,
  socketsPerLevel: 1,
  towerRadius: 75,
  towerFullPercent: 30, // ab diesem beleuchteten Anteil volle Leistung (ein Laser ≈ ein Drittel)
  pulseInterval: 0.7, // Sekunden zwischen Pulsen bei voller Leistung
  towerDamage: [1, 2, 3.5], // pro Stufe
  towerRange: [220, 265, 310],
  upgradeFillTime: 4, // Sekunden voll beleuchtet bis zur nächsten Ladung
  upgradeCharges: [1, 2], // Ladungen für Stufe 2 bzw. 3
  // Neue Elemente ab Level
  pilgrimLevel: 2,
  pilgrimChance: 0.18,
  panzerLevel: 3,
  flitzerLevel: 4,
  bossLevel: 5,
  teilerLevel: 6,
  // Punkte
  pilgrimBonus: 30,
  pilgrimPenalty: -50,
  maxParticles: 400,
};

// Gegnertypen: hp, Tempo (px/s), Radius, Panzerung, Punkte, Kristallschaden, Ecken
const ENEMY_TYPES = {
  krabbler: { hp: 3, speed: 90, radius: 26, armor: 0, reward: 10, damage: 1, edges: 3 },
  panzer: { hp: 10, speed: 60, radius: 34, armor: 1, reward: 25, damage: 2, edges: 4 },
  flitzer: { hp: 2, speed: 190, radius: 22, armor: 0, reward: 15, damage: 1, edges: 3 },
  teiler: { hp: 6, speed: 80, radius: 32, armor: 0, reward: 20, damage: 2, edges: 6 },
  koloss: { hp: 70, speed: 38, radius: 62, armor: 1, reward: 200, damage: 8, edges: 8 },
  pilger: { hp: 5, speed: 70, radius: 28, armor: 0, reward: 0, damage: 0, edges: 12 },
};

const W = 1920;
const H = 1080;
const PATH = [
  [-60, 250],
  [1550, 250],
  [1550, 560],
  [370, 560],
  [370, 860],
  [1700, 860],
];
const CRYSTAL = { x: 1760, y: 860 };
// Bauplätze in Freischalt-Reihenfolge (über die Fläche verteilt)
const SOCKETS = [
  [750, 405],
  [1050, 710],
  [300, 405],
  [1450, 710],
  [1200, 405],
  [650, 710],
  [1760, 450],
  [800, 120],
  [170, 710],
  [900, 1000],
  [1250, 120],
  [1400, 1000],
];

// --- Zustand ---
var gameState = 'start';
var level = 1;
var score = 0;
var crystalHp = DIFFICULTY.crystalHp;
var gameTime = 0;
var stateTime = 0;
var spawnTimer = 0;
var spawnQueue = [];
var enemies = [];
var towers = [];
var rings = [];
var particles = [];
var floatingTexts = [];
var buttonsStart = [];
var buttonsGameOver = [];
var shake = 0;
var flash = 0;
var stats = { kills: 0, pilgrimsSaved: 0, pilgrimsHit: 0, leaked: 0, upgrades: 0, bosses: 0 };
var previousKeys = {};
var lastTime = 0;
var activeSounds = [];
var pathSegments = [];
var pathLength = 0;
var bgCanvas = null;
var glowSprites = {};

// --- Farben (alle aus testColor abgeleitet, nie die reine Laserfarbe) ---
var COL = {};
function updateColors() {
  const c = laserConfig.testColor;
  COL = {
    bg1: getRgbSpreadHex(c, 0.6, 0.6, 0.08),
    bg2: getRgbSpreadHex(c, 0.55, 0.6, 0.18),
    grid: getRgbSpreadHex(c, 0.55, 0.5, 0.3),
    path: getRgbSpreadHex(c, 0.5, 0.5, 0.35),
    pathEdge: getRgbSpreadHex(c, 0.5, 0.8, 0.8),
    flow: getRgbSpreadHex(c, 0.48, 0.4, 1),
    tower: getRgbSpreadHex(c, 0.35, 0.7, 0.9),
    towerHi: getRgbSpreadHex(c, 0.35, 0.3, 1),
    towerOff: getRgbSpreadHex(c, 0.35, 0.4, 0.4),
    pulse: getRgbSpreadHex(c, 0.33, 0.8, 1),
    enemy: getRgbSpreadHex(c, 0.62, 0.9, 1),
    armor: getRgbSpreadHex(c, 0.7, 0.5, 0.85),
    boss: getRgbSpreadHex(c, 0.66, 1, 1),
    pilgrim: getRgbSpreadHex(c, 0.2, 0.6, 1),
    crystal: getRgbSpreadHex(c, 0.45, 0.8, 1),
    crystalCore: getRgbSpreadHex(c, 0.45, 0.2, 1),
    text: getRgbSpreadHex(c, 0.45, 0.4, 1),
    textHi: getRgbSpreadHex(c, 0.38, 0.8, 1),
    bad: getRgbSpreadHex(c, 0.65, 0.9, 1),
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

function addFloatingText(text, x, y, color, size = 40) {
  floatingTexts.push({ text, x, y, color, size, time: 0, duration: 1.3 });
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
      maxLife: 0.4 + Math.random() * 0.6,
      size: 4 + Math.random() * 8,
      color,
    });
  }
}

function getGlowSprite(color) {
  if (!glowSprites[color]) {
    const size = 128;
    const c = document.createElement('canvas');
    c.width = size;
    c.height = size;
    const g = c.getContext('2d');
    const grad = g.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
    grad.addColorStop(0, color + 'cc');
    grad.addColorStop(0.4, color + '44');
    grad.addColorStop(1, color + '00');
    g.fillStyle = grad;
    g.fillRect(0, 0, size, size);
    glowSprites[color] = c;
  }
  return glowSprites[color];
}

function drawGlow(ctx, x, y, radius, color, alpha = 1) {
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  ctx.globalAlpha = alpha;
  ctx.drawImage(getGlowSprite(color), x - radius, y - radius, radius * 2, radius * 2);
  ctx.restore();
}

// --- Pfad ---
function buildPath() {
  pathSegments = [];
  pathLength = 0;
  for (let i = 0; i < PATH.length - 1; i++) {
    const [x1, y1] = PATH[i];
    const [x2, y2] = PATH[i + 1];
    const len = Math.hypot(x2 - x1, y2 - y1);
    pathSegments.push({ x1, y1, x2, y2, len, start: pathLength });
    pathLength += len;
  }
}

function pointAt(d) {
  for (const s of pathSegments) {
    if (d <= s.start + s.len) {
      const t = Math.max(0, (d - s.start) / s.len);
      return { x: s.x1 + (s.x2 - s.x1) * t, y: s.y1 + (s.y2 - s.y1) * t };
    }
  }
  const last = pathSegments[pathSegments.length - 1];
  return { x: last.x2, y: last.y2 };
}

// --- Hintergrund einmal vorrendern ---
function renderBackground() {
  const c = document.createElement('canvas');
  c.width = W;
  c.height = H;
  const ctx = c.getContext('2d');
  const grad = ctx.createLinearGradient(0, 0, 0, H);
  grad.addColorStop(0, COL.bg1);
  grad.addColorStop(1, COL.bg2);
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, W, H);
  // Hex-Raster
  ctx.strokeStyle = COL.grid;
  ctx.globalAlpha = 0.25;
  ctx.lineWidth = 1;
  const r = 40;
  const hw = Math.sqrt(3) * r;
  for (let row = 0; row * r * 1.5 < H + r; row++) {
    for (let col = 0; col * hw < W + hw; col++) {
      const x = col * hw + (row % 2 ? hw / 2 : 0);
      const y = row * r * 1.5;
      util.drawNgon({ ctx, numberOfSides: 6, size: r, Xcenter: x, Ycenter: y, color: COL.grid, lineWidth: 1, angle: Math.PI / 6 });
    }
  }
  ctx.globalAlpha = 1;
  // Pfad: breites Band mit leuchtendem Rand
  const stroke = (width, color, alpha, blur) => {
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.strokeStyle = color;
    ctx.lineWidth = width;
    ctx.lineJoin = 'round';
    ctx.lineCap = 'round';
    ctx.shadowColor = color;
    ctx.shadowBlur = blur;
    ctx.beginPath();
    PATH.forEach(([x, y], i) => (i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y)));
    ctx.stroke();
    ctx.restore();
  };
  stroke(110, COL.pathEdge, 0.5, 40);
  stroke(96, COL.path, 1, 0);
  stroke(4, COL.pathEdge, 0.4, 0);
  return c;
}

// --- Türme ---
function createTower(index) {
  const [x, y] = SOCKETS[index];
  const tower = {
    index,
    x,
    y,
    tier: 0, // 0..2
    charges: 0,
    pulseTimer: 0,
    power: 0,
    unlockedAt: level > 1 ? gameTime : -100,
    button: null,
  };
  tower.button = guiPixelFillButton({
    label: '',
    posX: x,
    posY: y,
    radius: DIFFICULTY.towerRadius,
    edges: 6,
    angle: Math.PI / 6,
    lineWidth: 4,
    fullPercent: DIFFICULTY.towerFullPercent,
    speedUp: 100 / DIFFICULTY.upgradeFillTime,
    speedDown: 8, // Aufrüst-Fortschritt geht nur langsam verloren
    minValue: 1,
    activeValue: 99,
    counterReset: true,
    normalColor: COL.towerOff,
    growColor: COL.tower,
    activeColor: COL.towerHi,
    onEnterActive: () => chargeTower(tower),
  });
  const original = tower.button.handle;
  tower.button.handle = (grid, elapsed, ctx) => {
    original(grid, elapsed);
    const testPower = !!laserConfig.pressedKeys['KeyP'];
    tower.power = testPower
      ? 1
      : Math.min(1, tower.button.getFillPercent() / DIFFICULTY.towerFullPercent);
    if (tower.power > 0.02 && gameState === 'game') {
      tower.pulseTimer += (elapsed * tower.power) / DIFFICULTY.pulseInterval;
      if (tower.pulseTimer >= 1) {
        tower.pulseTimer = 0;
        firePulse(tower);
      }
    } else {
      tower.pulseTimer = Math.max(0, tower.pulseTimer - elapsed);
    }
    renderTower(ctx, tower);
  };
  return tower;
}

function chargeTower(tower) {
  if (tower.tier >= 2) return;
  tower.charges++;
  if (tower.charges >= DIFFICULTY.upgradeCharges[tower.tier]) {
    tower.charges = 0;
    tower.tier++;
    stats.upgrades++;
    burst(tower.x, tower.y, COL.towerHi, 30, 400);
    addFloatingText(`Stufe ${tower.tier + 1}!`, tower.x, tower.y - 100, COL.textHi, 46);
    playSound(soundStomp, 0.4);
  } else {
    addFloatingText('Ladung +1', tower.x, tower.y - 100, COL.tower, 34);
  }
}

function firePulse(tower) {
  const range = DIFFICULTY.towerRange[tower.tier];
  const dmg = DIFFICULTY.towerDamage[tower.tier];
  rings.push({ x: tower.x, y: tower.y, range, life: 0, maxLife: 0.45, tier: tower.tier });
  enemies.slice().forEach((e) => {
    const dx = e.x - tower.x;
    const dy = e.y - tower.y;
    const r = range + e.radius;
    if (dx * dx + dy * dy <= r * r) damageEnemy(e, dmg);
  });
}

function renderTower(ctx, tower) {
  const { x, y, tier, power } = tower;
  const range = DIFFICULTY.towerRange[tier];
  // Reichweite andeuten, wenn bestromt
  if (power > 0.02) {
    ctx.save();
    ctx.globalAlpha = 0.15 + power * 0.25;
    ctx.strokeStyle = COL.pulse;
    ctx.lineWidth = 3;
    ctx.setLineDash([16, 14]);
    ctx.lineDashOffset = -gameTime * 40;
    ctx.beginPath();
    ctx.arc(x, y, range, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();
    drawGlow(ctx, x, y, 110 + power * 40, COL.pulse, 0.4 + power * 0.6);
  }
  // Turmkörper: gefüllter Kern + Ringe pro Stufe
  const spin = gameTime * (0.5 + power * 4);
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(spin);
  util.drawNgon({
    ctx,
    numberOfSides: 3 + tier,
    size: 30 + tier * 6,
    Xcenter: 0,
    Ycenter: 0,
    color: power > 0.02 ? COL.towerHi : COL.tower,
    filled: true,
    lineWidth: 2,
  });
  ctx.restore();
  for (let i = 0; i <= tier; i++) {
    const a = gameTime * 2 + (i * Math.PI * 2) / (tier + 1);
    ctx.save();
    ctx.fillStyle = COL.towerHi;
    ctx.beginPath();
    ctx.arc(x + Math.cos(a) * 52, y + Math.sin(a) * 52, 7, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }
  // frisch freigeschaltet
  if (gameTime - tower.unlockedAt < 6 && Math.floor(gameTime * 3) % 2 === 0) {
    util.renderTextDropShadow({
      ctx,
      text: 'NEU',
      fontSize: '34px',
      dropDistX: 3,
      dropDistY: 3,
      fillStyle: COL.textHi,
      x,
      y: y - 90,
    });
  }
}

function renderLockedSocket(ctx, index) {
  const [x, y] = SOCKETS[index];
  ctx.save();
  ctx.globalAlpha = 0.25;
  ctx.setLineDash([10, 10]);
  util.drawNgon({ ctx, numberOfSides: 6, size: DIFFICULTY.towerRadius, Xcenter: x, Ycenter: y, color: COL.towerOff, lineWidth: 3, angle: Math.PI / 6 });
  ctx.restore();
}

// --- Gegner ---
function hpScale() {
  return 1 + DIFFICULTY.hpPerLevel * (level - 1);
}

function createEnemy(type, startD = 0) {
  const t = ENEMY_TYPES[type];
  const hp = type === 'pilger' ? t.hp : t.hp * hpScale();
  const e = {
    type,
    d: startD,
    hp,
    maxHp: hp,
    speed: t.speed * (1 + DIFFICULTY.speedPerLevel * (level - 1)) * (0.9 + Math.random() * 0.2),
    radius: t.radius,
    armor: t.armor,
    reward: t.reward,
    damage: t.damage,
    edges: t.edges,
    seed: Math.random() * 100,
    hitFlash: 0,
    x: 0,
    y: 0,
  };
  const p = pointAt(e.d);
  e.x = p.x;
  e.y = p.y;
  enemies.push(e);
  return e;
}

function damageEnemy(e, dmg) {
  if (!enemies.includes(e)) return;
  const effective = Math.max(dmg * 0.25, dmg - e.armor);
  e.hp -= effective;
  e.hitFlash = 0.15;
  if (e.hp > 0) return;
  removeItemFromArray(enemies, e);
  if (e.type === 'pilger') {
    stats.pilgrimsHit++;
    score += DIFFICULTY.pilgrimPenalty;
    damageCrystal(1, false);
    burst(e.x, e.y, COL.pilgrim, 30, 350);
    addFloatingText(`Pilger getroffen! ${DIFFICULTY.pilgrimPenalty}`, e.x, e.y - 60, COL.bad, 44);
    shake = Math.max(shake, 0.4);
    return;
  }
  stats.kills++;
  score += e.reward;
  burst(e.x, e.y, e.type === 'koloss' ? COL.boss : COL.enemy, e.type === 'koloss' ? 80 : 14, e.type === 'koloss' ? 700 : 300);
  addFloatingText(`+${e.reward}`, e.x, e.y - 40, COL.text, e.type === 'koloss' ? 70 : 36);
  if (e.type === 'koloss') {
    stats.bosses++;
    shake = Math.max(shake, 0.6);
    flash = 0.6;
    playSound(soundBoom, 0.8);
  } else if (Math.random() < 0.35) {
    playSound(soundPop, 0.25);
  }
  if (e.type === 'teiler') {
    createEnemy('krabbler', Math.max(0, e.d - 20));
    createEnemy('krabbler', e.d + 20);
  }
}

function damageCrystal(amount, fromEnemy = true) {
  crystalHp -= amount;
  shake = Math.max(shake, 0.3 + amount * 0.05);
  burst(CRYSTAL.x, CRYSTAL.y, COL.crystal, 20 + amount * 4, 400);
  if (fromEnemy) {
    stats.leaked++;
    addFloatingText(`-${amount}`, CRYSTAL.x, CRYSTAL.y - 120, COL.bad, 50);
    playSound(soundBoom, 0.5);
  }
  if (crystalHp <= 0) {
    crystalHp = 0;
    gameState = 'gameover';
    stateTime = 0;
    buttonsGameOver = [startButton()];
  }
}

function updateEnemies(ctx, elapsed) {
  enemies.slice().forEach((e) => {
    e.d += e.speed * elapsed;
    const p = pointAt(e.d);
    e.x = p.x;
    e.y = p.y;
    e.hitFlash = Math.max(0, e.hitFlash - elapsed);
    if (e.d >= pathLength) {
      removeItemFromArray(enemies, e);
      if (e.type === 'pilger') {
        stats.pilgrimsSaved++;
        score += DIFFICULTY.pilgrimBonus;
        addFloatingText(`Pilger sicher! +${DIFFICULTY.pilgrimBonus}`, CRYSTAL.x - 100, CRYSTAL.y - 160, COL.pilgrim, 40);
      } else {
        damageCrystal(e.damage);
      }
      return;
    }
    renderEnemy(ctx, e);
  });
}

function renderEnemy(ctx, e) {
  const isPilgrim = e.type === 'pilger';
  const color = e.hitFlash > 0 ? COL.text : isPilgrim ? COL.pilgrim : e.type === 'koloss' ? COL.boss : COL.enemy;
  const wobble = 1 + Math.sin(gameTime * 10 + e.seed) * 0.08;
  drawGlow(ctx, e.x, e.y, e.radius * 2.2, color, isPilgrim ? 0.7 : 0.9);
  ctx.save();
  ctx.translate(e.x, e.y);
  ctx.rotate(isPilgrim ? 0 : gameTime * 2 + e.seed);
  util.drawNgon({ ctx, numberOfSides: e.edges, size: e.radius * wobble, Xcenter: 0, Ycenter: 0, color, filled: true, lineWidth: 2 });
  if (e.armor > 0) {
    util.drawNgon({ ctx, numberOfSides: e.edges, size: e.radius * 1.25, Xcenter: 0, Ycenter: 0, color: COL.armor, lineWidth: 5 });
  }
  ctx.restore();
  if (isPilgrim) {
    // Heiligenschein
    ctx.save();
    ctx.strokeStyle = COL.pilgrim;
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.ellipse(e.x, e.y - e.radius - 14, 22, 8, 0, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();
  }
  // Lebensbalken
  if (e.hp < e.maxHp) {
    const w = e.radius * 2;
    ctx.save();
    ctx.fillStyle = COL.bg1;
    ctx.fillRect(e.x - w / 2, e.y - e.radius - 22, w, 8);
    ctx.fillStyle = isPilgrim ? COL.bad : COL.textHi;
    ctx.fillRect(e.x - w / 2, e.y - e.radius - 22, (w * Math.max(0, e.hp)) / e.maxHp, 8);
    ctx.restore();
  }
}

// --- Welle ---
function buildWave() {
  const queue = [];
  const count = DIFFICULTY.waveCountStart + DIFFICULTY.waveCountPerLevel * (level - 1);
  for (let i = 0; i < count; i++) {
    const pool = ['krabbler'];
    if (level >= DIFFICULTY.panzerLevel) pool.push('panzer');
    if (level >= DIFFICULTY.teilerLevel) pool.push('teiler');
    let type = pool[Math.floor(Math.random() * pool.length)];
    queue.push(type);
    // Flitzer kommen als Schwarm
    if (level >= DIFFICULTY.flitzerLevel && i % 6 === 5) {
      for (let k = 0; k < 4; k++) queue.push('flitzer');
    }
    if (level >= DIFFICULTY.pilgrimLevel && Math.random() < DIFFICULTY.pilgrimChance) {
      queue.push('pilger');
    }
  }
  if (level >= DIFFICULTY.bossLevel) {
    const bosses = 1 + Math.floor((level - DIFFICULTY.bossLevel) / 2);
    for (let b = 0; b < bosses; b++) {
      queue.splice(Math.floor(queue.length * (0.6 + 0.3 * (b / bosses))), 0, 'koloss');
    }
  }
  return queue;
}

function socketCount() {
  return Math.min(SOCKETS.length, DIFFICULTY.socketsStart + DIFFICULTY.socketsPerLevel * (level - 1));
}

function startWave() {
  spawnQueue = buildWave();
  spawnTimer = 0;
  while (towers.length < socketCount()) towers.push(createTower(towers.length));
  gameState = 'game';
  stateTime = 0;
}

function spawnTick(elapsed) {
  if (spawnQueue.length === 0) return;
  spawnTimer += elapsed;
  const interval = Math.max(
    DIFFICULTY.spawnIntervalMin,
    DIFFICULTY.spawnIntervalStart * Math.pow(DIFFICULTY.spawnIntervalFactor, level - 1)
  );
  const next = spawnQueue[0];
  const wait = next === 'flitzer' ? interval * 0.3 : interval;
  if (spawnTimer >= wait) {
    spawnTimer = 0;
    spawnQueue.shift();
    createEnemy(next);
    if (next === 'koloss') {
      addFloatingText('KOLOSS!', W / 2, 180, COL.boss, 90);
      playSound(soundBoss, 0.8);
      flash = 0.4;
    }
  }
}

function newElementText(lvl) {
  if (lvl === DIFFICULTY.pilgrimLevel) return 'NEU: Pilger mit Heiligenschein!\nTürme kurz ausschalten, wenn sie vorbeiziehen!';
  if (lvl === DIFFICULTY.panzerLevel) return 'NEU: Panzerkäfer!\nTürme lange beleuchten = aufrüsten!';
  if (lvl === DIFFICULTY.flitzerLevel) return 'NEU: Flitzer-Schwärme!';
  if (lvl === DIFFICULTY.bossLevel) return 'NEU: Der KOLOSS!\nAlle Türme gleichzeitig bestromen!';
  if (lvl === DIFFICULTY.teilerLevel) return 'NEU: Teiler – zerfallen in zwei!';
  return 'Die Wellen werden härter …';
}

// --- Spielfluss ---
function resetGame() {
  updateColors();
  glowSprites = {};
  buildPath();
  bgCanvas = renderBackground();
  level = 1;
  score = 0;
  crystalHp = DIFFICULTY.crystalHp;
  gameTime = 0;
  stateTime = 0;
  enemies = [];
  towers = [];
  rings = [];
  particles = [];
  floatingTexts = [];
  shake = 0;
  flash = 0;
  stats = { kills: 0, pilgrimsSaved: 0, pilgrimsHit: 0, leaked: 0, upgrades: 0, bosses: 0 };
  lastTime = performance.now();
}

function startButton() {
  return guiFillButton({
    label: 'START',
    posX: W / 2,
    posY: H / 2 + 230,
    speedDown: 12,
    speedUp: 25,
    edges: 6,
    activeValue: 90,
    radius: 150,
    normalColor: COL.tower,
    activeColor: COL.towerHi,
    growColor: COL.pulse,
    onEnterActive: () => {
      resetGame();
      startWave();
    },
    onExitActive: () => {},
  });
}

// --- Rendering ---
function renderFlow(ctx) {
  // fliessende Lichtpunkte zeigen die Laufrichtung
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  ctx.fillStyle = COL.flow;
  ctx.globalAlpha = 0.35;
  const spacing = 70;
  const offset = (gameTime * 80) % spacing;
  for (let d = offset; d < pathLength; d += spacing) {
    const p = pointAt(d);
    ctx.fillRect(p.x - 4, p.y - 4, 8, 8);
  }
  ctx.restore();
}

function renderCrystal(ctx) {
  const pulse = 1 + Math.sin(gameTime * 3) * 0.06;
  const ratio = crystalHp / DIFFICULTY.crystalHp;
  drawGlow(ctx, CRYSTAL.x, CRYSTAL.y, 170 * pulse, COL.crystal, 0.5 + ratio * 0.5);
  ctx.save();
  ctx.translate(CRYSTAL.x, CRYSTAL.y);
  ctx.scale(pulse, pulse);
  ctx.fillStyle = COL.crystal;
  ctx.beginPath();
  ctx.moveTo(0, -100);
  ctx.lineTo(50, -10);
  ctx.lineTo(30, 70);
  ctx.lineTo(-30, 70);
  ctx.lineTo(-50, -10);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = COL.crystalCore;
  ctx.globalAlpha = 0.7;
  ctx.beginPath();
  ctx.moveTo(0, -100);
  ctx.lineTo(18, -10);
  ctx.lineTo(0, 70);
  ctx.lineTo(-18, -10);
  ctx.closePath();
  ctx.fill();
  ctx.restore();
}

function updateRings(ctx, elapsed) {
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  for (let i = rings.length - 1; i >= 0; i--) {
    const r = rings[i];
    r.life += elapsed;
    if (r.life >= r.maxLife) {
      rings.splice(i, 1);
      continue;
    }
    const t = r.life / r.maxLife;
    ctx.globalAlpha = 1 - t;
    ctx.strokeStyle = COL.pulse;
    ctx.lineWidth = 6 + r.tier * 4;
    ctx.beginPath();
    ctx.arc(r.x, r.y, r.range * (0.2 + 0.8 * Math.sqrt(t)), 0, Math.PI * 2);
    ctx.stroke();
  }
  ctx.restore();
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
    p.vy *= 1 - 2 * elapsed;
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
      y: t.y - t.time * 60,
    });
    ctx.restore();
  }
}

function renderFlash(ctx, elapsed) {
  if (flash <= 0) return;
  ctx.save();
  ctx.globalAlpha = Math.min(0.5, flash * 0.5);
  ctx.fillStyle = COL.crystalCore;
  ctx.fillRect(0, 0, W, H);
  ctx.restore();
  flash = Math.max(0, flash - elapsed * 1.5);
}

function renderHud(ctx) {
  const remaining = spawnQueue.length + enemies.filter((e) => e.type !== 'pilger').length;
  util.renderTextDropShadow({
    ctx,
    text: `Welle ${level}   ${score} Punkte`,
    fontSize: '48px',
    dropDistX: 4,
    dropDistY: 4,
    fillStyle: COL.text,
    align: 'left',
    x: 30,
    y: 65,
  });
  util.renderTextDropShadow({
    ctx,
    text: `noch ${remaining}`,
    fontSize: '40px',
    dropDistX: 3,
    dropDistY: 3,
    fillStyle: COL.enemy,
    align: 'left',
    x: 30,
    y: 115,
  });
  // Kristall-Leben als Splitter
  const n = DIFFICULTY.crystalHp;
  const size = 18;
  const x0 = W - 30 - n * (size + 4);
  for (let i = 0; i < n; i++) {
    const alive = i < crystalHp;
    ctx.save();
    ctx.globalAlpha = alive ? 1 : 0.2;
    ctx.fillStyle = alive && crystalHp <= 5 && Math.floor(gameTime * 4) % 2 === 0 ? COL.bad : COL.crystal;
    ctx.beginPath();
    const x = x0 + i * (size + 4) + size / 2;
    ctx.moveTo(x, 30);
    ctx.lineTo(x + size / 2, 50);
    ctx.lineTo(x, 70);
    ctx.lineTo(x - size / 2, 50);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  }
  util.renderText({ ctx, text: 'Kristall', fontSize: '30px', fillStyle: COL.crystal, align: 'right', x: W - 30, y: 105 });
}

function renderWorld(ctx) {
  ctx.drawImage(bgCanvas, 0, 0);
  renderFlow(ctx);
  renderCrystal(ctx);
}

// --- Bildschirme ---
function handleStart(grid, elapsed, ctx) {
  gameTime += elapsed;
  renderWorld(ctx);
  // Deko: Demo-Pulse an zufälligen Bauplätzen
  if (Math.random() < elapsed * 2) {
    const [x, y] = SOCKETS[Math.floor(Math.random() * SOCKETS.length)];
    rings.push({ x, y, range: 260, life: 0, maxLife: 0.6, tier: 1 });
  }
  updateRings(ctx, elapsed);
  util.renderTextDropShadow({ ctx, text: 'KRISTALLWACHT', fontSize: '150px', fillStyle: COL.crystal, x: W / 2, y: 400 });
  util.renderTextDropShadow({
    ctx,
    text: 'Leuchtet auf die Türme – nur bestromte Türme feuern!\nMehr Laser = mehr Feuer. Pilger nicht treffen!',
    fontSize: '44px',
    lineHeight: 60,
    dropDistX: 4,
    dropDistY: 4,
    fillStyle: COL.text,
    x: W / 2,
    y: 490,
  });
  buttonsStart.forEach((b) => b.handle(grid, elapsed));
  if (keyPressedOnce('Space')) {
    resetGame();
    startWave();
  }
}

function handleGame(grid, elapsed, ctx) {
  gameTime += elapsed;
  stateTime += elapsed;

  if (keyPressedOnce('KeyU')) towers.forEach((t) => chargeTower(t));
  if (keyPressedOnce('KeyL')) {
    spawnQueue = [];
    enemies.slice().forEach((e) => removeItemFromArray(enemies, e));
  }

  spawnTick(elapsed);

  shake = Math.max(0, shake - elapsed);
  ctx.save();
  if (shake > 0) {
    const s = shake * 30;
    ctx.translate((Math.random() - 0.5) * s, (Math.random() - 0.5) * s);
  }
  renderWorld(ctx);
  for (let i = towers.length; i < SOCKETS.length; i++) renderLockedSocket(ctx, i);
  towers.forEach((t) => t.button.handle(grid, elapsed, ctx));
  updateEnemies(ctx, elapsed);
  updateRings(ctx, elapsed);
  updateParticles(ctx, elapsed);
  updateFloatingTexts(ctx, elapsed);
  ctx.restore();

  renderHud(ctx);
  renderFlash(ctx, elapsed);

  if (gameState === 'game' && spawnQueue.length === 0 && enemies.length === 0) {
    gameState = 'levelup';
    stateTime = 0;
    flash = 1;
    playSound(soundLevel, 0.8);
  }
}

function handleLevelUp(grid, elapsed, ctx) {
  gameTime += elapsed;
  stateTime += elapsed;
  renderWorld(ctx);
  // Türme weiter bedienbar (Aufrüsten in der Pause erlaubt), feuern aber nicht
  towers.forEach((t) => t.button.handle(grid, elapsed, ctx));
  if (Math.random() < elapsed * 20) burst(Math.random() * W, Math.random() * H, COL.crystal, 6, 250);
  updateRings(ctx, elapsed);
  updateParticles(ctx, elapsed);
  updateFloatingTexts(ctx, elapsed);
  const t = Math.min(1, stateTime * 3);
  ctx.save();
  ctx.translate(W / 2, 430);
  ctx.scale(0.5 + 0.5 * t, 0.5 + 0.5 * t);
  util.renderTextDropShadow({ ctx, text: `WELLE ${level + 1}`, fontSize: '170px', fillStyle: COL.crystal, x: 0, y: 0 });
  ctx.restore();
  util.renderTextDropShadow({
    ctx,
    text: `Welle ${level} abgewehrt!\n${newElementText(level + 1)}`,
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
  if (stateTime >= DIFFICULTY.levelUpDuration) {
    level++;
    startWave();
  }
}

function handleGameOver(grid, elapsed, ctx) {
  gameTime += elapsed;
  stateTime += elapsed;
  renderWorld(ctx);
  updateParticles(ctx, elapsed);
  if (Math.random() < elapsed * 8) burst(CRYSTAL.x, CRYSTAL.y, COL.bad, 4, 300);
  util.renderTextDropShadow({ ctx, text: 'Kristall zerstört!', fontSize: '130px', fillStyle: COL.bad, x: W / 2, y: 330 });
  util.renderTextDropShadow({
    ctx,
    text:
      `Welle ${level} erreicht – ${score} Punkte\n` +
      `${stats.kills} Gegner zerstört, ${stats.bosses} Kolosse besiegt\n` +
      `${stats.upgrades} Turm-Aufrüstungen, ${stats.leaked} Durchbrüche\n` +
      `${stats.pilgrimsSaved} Pilger gerettet, ${stats.pilgrimsHit} getroffen`,
    fontSize: '44px',
    lineHeight: 62,
    dropDistX: 4,
    dropDistY: 4,
    fillStyle: COL.text,
    x: W / 2,
    y: 430,
  });
  buttonsGameOver.forEach((b) => b.handle(grid, elapsed));
  if (keyPressedOnce('Space')) {
    resetGame();
    startWave();
  }
}

export default {
  name: 'Kristallwacht (Opus55)',
  description: `Gegner ziehen über den Leuchtpfad 
  zum Kristall in der Mitte

Die Türme feuern NUR
solange ihr sie anleuchtet

je mehr Laser auf einem Turm
 desto besser

Lange beleuchtete Türme
 werden besser

Pilger mit Heiligenschein
sollten überleben`,
  image: 'media/img/gametitles/laser-defense-###4###.png',
  init: function () {
    resetGame();
    gameState = 'start';
    spawnQueue = [];
    buttonsStart = [startButton()];
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
