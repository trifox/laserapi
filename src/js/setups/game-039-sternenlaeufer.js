/**
 * Sternenläufer – Run & Gun für viele Laser
 *
 * Unten läuft der Sternenläufer über eine endlos scrollende Alien-Landschaft. Sein Geschütz zielt
 * IMMER auf den Schwerpunkt aller Laserpunkte (gui/aimTurret) und feuert automatisch.
 * Von rechts ziehen Gegnerwellen durch den Himmel und müssen abgeschossen werden.
 *
 * Teamwork: Der Schwerpunkt ALLER Laser ist das Ziel. Leuchten alle auf dasselbe Ziel, ist der Fokus
 * hoch und das Geschütz feuert schnell. Leuchten alle wild durcheinander, zielt es ins Leere und
 * feuert langsam.
 *
 * Regeln:
 * - Gegner, die links entkommen, kosten 1 Schild. Bomben, die den Läufer treffen, auch.
 * - Rettungskapseln (mit Kreuz) NICHT abschiessen: -1 Schild, -100 Punkte. Entkommen sie, gibt es Bonus.
 * - Waffenkapseln (W) abschiessen = Mehrfachschuss für eine Weile.
 * - Schild leer = Game Over.
 *
 * Level = Welle. Neue Elemente:
 * - Level 2: Schwarm-Formationen (alle 6 erwischt = Bonus) und Rettungskapseln
 * - Level 3: Bomber, die Bomben auf den Läufer werfen (Bomben kann man abschiessen)
 * - Level 4: Panzerschiffe (zäh)
 * - Level 5, 8, 11 …: Mutterschiff (Boss) mit Bombensalven und Drohnen-Nachschub
 *
 * Tastatur-Test: Space = Start, Pfeiltasten = Zielpunkt bewegen (ersetzt die Laser),
 *                K = alle Gegner zerstören, L = Welle beenden.
 *
 * Alle Stellschrauben stehen gesammelt in DIFFICULTY.
 */

import util, { getRgbSpreadHex, removeItemFromArray } from '../util.js';
var laserConfig = require('../LaserApiConfig.js').default;
var MasterCanvas = require('../MasterCanvas').default;
var guiFillButton = require('./gui/fillButton').default;
var guiAimTurret = require('./gui/aimTurret').default;
import soundPop from '../../../public/media/369952__mischy__plop-1.wav';
import soundBoom from '../../../public/media/414346__bykgames__explosion-far.wav';
import soundLevel from '../../../public/media/521966__kastenfrosch__ready-to-start-jingle.ogg';
import soundBoss from '../../../public/media/70299__kizilsungur__sonar.wav';
import soundPower from '../../../public/media/496199__luminousfridge__player-spawned.ogg';

const DIFFICULTY = {
  shieldMax: 10,
  // Welle
  waveCountStart: 8,
  waveCountPerLevel: 3,
  spawnIntervalStart: 1.2,
  spawnIntervalFactor: 0.9,
  spawnIntervalMin: 0.35,
  hpPerLevel: 0.12,
  speedPerLevel: 0.05,
  levelUpDuration: 3,
  // Geschütz
  fireIntervalBase: 0.26, // bei Fokus 0.5
  focusSpread: 450, // Streuung in px, ab der der Fokus 0 ist
  bulletSpeed: 1700,
  bulletRadius: 20, // grosszügige Trefferzone
  weaponDuration: 15,
  // Neue Elemente ab Level
  schwarmLevel: 2,
  friendlyLevel: 2,
  friendlyChance: 0.22,
  bomberLevel: 3,
  panzerLevel: 4,
  bossLevel: 5,
  bossEvery: 3,
  powerupEvery: 7, // jede n-te Wellen-Position eine Waffenkapsel
  // Punkte
  formationBonus: 100,
  friendlyBonus: 50,
  friendlyPenalty: -100,
  maxParticles: 400,
};

// Gegnertypen: hp, Tempo, Radius, Wellen-Amplitude, Punkte
const ENEMY_TYPES = {
  drohne: { hp: 2, speed: 260, radius: 45, amp: 60, reward: 10 },
  bomber: { hp: 5, speed: 170, radius: 60, amp: 25, reward: 30 },
  panzer: { hp: 14, speed: 120, radius: 72, amp: 15, reward: 60 },
  boss: { hp: 100, speed: 160, radius: 160, amp: 0, reward: 500 },
};

const W = 1920;
const H = 1080;
const GROUND_Y = 950;
const RUNNER_X = 360;
const SKY_TOP = 90;
const SKY_BOTTOM = 650;

// --- Zustand ---
var gameState = 'start';
var level = 1;
var score = 0;
var shield = DIFFICULTY.shieldMax;
var gameTime = 0;
var stateTime = 0;
var scroll = 0;
var spawnTimer = 0;
var spawnQueue = [];
var enemies = [];
var bullets = [];
var bombs = [];
var friendlies = [];
var powerups = [];
var particles = [];
var floatingTexts = [];
var formations = {};
var formationCounter = 0;
var weaponLevel = 1;
var weaponTimer = 0;
var invulnerable = 0;
var shake = 0;
var flash = 0;
var turret = null;
var buttonsStart = [];
var buttonsGameOver = [];
var stats = { kills: 0, shots: 0, formations: 0, rescued: 0, friendlyHit: 0, bosses: 0, maxFocus: 0 };
var previousKeys = {};
var lastTime = 0;
var activeSounds = [];
var layers = null;
var sprites = {};
var glowSprites = {};

// --- Farben (alle aus testColor abgeleitet, nie die reine Laserfarbe) ---
var COL = {};
function updateColors() {
  const c = laserConfig.testColor;
  COL = {
    sky1: getRgbSpreadHex(c, 0.6, 0.7, 0.06),
    sky2: getRgbSpreadHex(c, 0.68, 0.6, 0.3),
    star: getRgbSpreadHex(c, 0.5, 0.15, 1),
    far: getRgbSpreadHex(c, 0.65, 0.5, 0.25),
    mid: getRgbSpreadHex(c, 0.58, 0.55, 0.38),
    ground: getRgbSpreadHex(c, 0.55, 0.6, 0.2),
    groundLine: getRgbSpreadHex(c, 0.5, 0.8, 0.9),
    hero: getRgbSpreadHex(c, 0.33, 0.6, 1),
    heroDark: getRgbSpreadHex(c, 0.33, 0.7, 0.55),
    visor: getRgbSpreadHex(c, 0.45, 0.8, 1),
    bullet: getRgbSpreadHex(c, 0.4, 0.5, 1),
    drohne: getRgbSpreadHex(c, 0.6, 0.9, 1),
    bomber: getRgbSpreadHex(c, 0.7, 0.8, 1),
    panzer: getRgbSpreadHex(c, 0.52, 0.6, 0.85),
    boss: getRgbSpreadHex(c, 0.64, 1, 1),
    bomb: getRgbSpreadHex(c, 0.56, 1, 1),
    friendly: getRgbSpreadHex(c, 0.22, 0.6, 1),
    power: getRgbSpreadHex(c, 0.42, 0.9, 1),
    text: getRgbSpreadHex(c, 0.45, 0.35, 1),
    textHi: getRgbSpreadHex(c, 0.4, 0.8, 1),
    bad: getRgbSpreadHex(c, 0.62, 0.9, 1),
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
      size: 4 + Math.random() * 9,
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

// --- Vorrendern: Landschaft und Sprites ---
function makeCanvas(w, h) {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  return c;
}

/** kachelbare Bergkette: nur ganzzahlige Frequenzen über die Breite, damit der Übergang nahtlos ist */
function renderRidge(height, base, waves, color, spikes) {
  const c = makeCanvas(W, height);
  const ctx = c.getContext('2d');
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.moveTo(0, height);
  for (let x = 0; x <= W; x += 8) {
    let y = base;
    waves.forEach(([k, amp, ph]) => (y += Math.sin((x / W) * Math.PI * 2 * k + ph) * amp));
    if (spikes && (x / 8) % 23 === 0) y -= 60;
    ctx.lineTo(x, y);
  }
  ctx.lineTo(W, height);
  ctx.closePath();
  ctx.fill();
  return c;
}

function renderLayers() {
  const sky = makeCanvas(W, H);
  const ctx = sky.getContext('2d');
  const grad = ctx.createLinearGradient(0, 0, 0, H);
  grad.addColorStop(0, COL.sky1);
  grad.addColorStop(0.75, COL.sky2);
  grad.addColorStop(1, COL.sky1);
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, W, H);
  // Planet
  ctx.save();
  ctx.globalAlpha = 0.5;
  ctx.fillStyle = COL.mid;
  ctx.beginPath();
  ctx.arc(1500, 260, 140, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = COL.groundLine;
  ctx.lineWidth = 6;
  ctx.beginPath();
  ctx.ellipse(1500, 260, 240, 40, -0.3, 0, Math.PI * 2);
  ctx.stroke();
  ctx.restore();
  const stars = makeCanvas(W, H);
  const sctx = stars.getContext('2d');
  sctx.fillStyle = COL.star;
  for (let i = 0; i < 220; i++) {
    sctx.globalAlpha = 0.2 + Math.random() * 0.8;
    const s = Math.random() < 0.1 ? 4 : 2;
    sctx.fillRect(Math.random() * W, Math.random() * H * 0.8, s, s);
  }
  return {
    sky,
    stars,
    far: renderRidge(400, 220, [[2, 60, 0.3], [5, 30, 1.2], [11, 12, 2]], COL.far, true),
    mid: renderRidge(300, 170, [[3, 40, 1], [7, 25, 0.4], [13, 8, 2.5]], COL.mid, false),
  };
}

function renderSprite(size, draw) {
  const c = makeCanvas(size, size);
  const ctx = c.getContext('2d');
  ctx.translate(size / 2, size / 2);
  draw(ctx, size / 2);
  return c;
}

function poly(ctx, pts, fill, stroke, lw = 4) {
  ctx.beginPath();
  pts.forEach(([x, y], i) => (i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y)));
  ctx.closePath();
  if (fill) {
    ctx.fillStyle = fill;
    ctx.fill();
  }
  if (stroke) {
    ctx.strokeStyle = stroke;
    ctx.lineWidth = lw;
    ctx.stroke();
  }
}

function renderSprites() {
  sprites = {
    drohne: renderSprite(110, (ctx, r) => {
      poly(ctx, [[-r * 0.8, 0], [0, -r * 0.45], [r * 0.6, 0], [0, r * 0.45]], COL.drohne, COL.text, 3);
      poly(ctx, [[-r * 0.1, -r * 0.4], [r * 0.5, -r * 0.85], [r * 0.3, -r * 0.2]], COL.drohne);
      poly(ctx, [[-r * 0.1, r * 0.4], [r * 0.5, r * 0.85], [r * 0.3, r * 0.2]], COL.drohne);
      ctx.fillStyle = COL.sky1;
      ctx.beginPath();
      ctx.arc(-r * 0.2, 0, r * 0.15, 0, Math.PI * 2);
      ctx.fill();
    }),
    bomber: renderSprite(140, (ctx, r) => {
      poly(ctx, [[-r * 0.9, 0], [-r * 0.4, -r * 0.4], [r * 0.8, -r * 0.3], [r * 0.9, r * 0.2], [-r * 0.4, r * 0.35]], COL.bomber, COL.text, 3);
      ctx.fillStyle = COL.sky1;
      for (let i = 0; i < 3; i++) ctx.fillRect(-r * 0.3 + i * r * 0.35, -r * 0.12, r * 0.18, r * 0.18);
      poly(ctx, [[-r * 0.1, r * 0.3], [r * 0.15, r * 0.55], [r * 0.35, r * 0.3]], COL.bomb);
    }),
    panzer: renderSprite(170, (ctx, r) => {
      const pts = [];
      for (let i = 0; i < 6; i++) pts.push([Math.cos((i * Math.PI) / 3) * r * 0.85, Math.sin((i * Math.PI) / 3) * r * 0.7]);
      poly(ctx, pts, COL.panzer, COL.text, 6);
      poly(ctx, pts.map(([x, y]) => [x * 0.55, y * 0.55]), COL.sky2, COL.panzer, 4);
      ctx.fillStyle = COL.bad;
      ctx.beginPath();
      ctx.arc(0, 0, r * 0.18, 0, Math.PI * 2);
      ctx.fill();
    }),
    boss: renderSprite(380, (ctx, r) => {
      poly(ctx, [[-r * 0.95, 0], [-r * 0.5, -r * 0.55], [r * 0.6, -r * 0.6], [r * 0.95, -r * 0.1], [r * 0.95, r * 0.3], [r * 0.4, r * 0.6], [-r * 0.5, r * 0.5]], COL.boss, COL.text, 6);
      poly(ctx, [[-r * 0.6, 0], [-r * 0.2, -r * 0.3], [r * 0.5, -r * 0.3], [r * 0.5, r * 0.25], [-r * 0.2, r * 0.3]], COL.sky2, COL.boss, 4);
      ctx.fillStyle = COL.bad;
      ctx.beginPath();
      ctx.arc(-r * 0.05, 0, r * 0.2, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = COL.text;
      for (let i = 0; i < 5; i++) ctx.fillRect(-r * 0.4 + i * r * 0.22, r * 0.4, r * 0.1, r * 0.1);
    }),
    friendly: renderSprite(120, (ctx, r) => {
      ctx.fillStyle = COL.friendly;
      ctx.strokeStyle = COL.text;
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.arc(0, 0, r * 0.8, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = COL.sky1;
      ctx.fillRect(-r * 0.12, -r * 0.5, r * 0.24, r);
      ctx.fillRect(-r * 0.5, -r * 0.12, r, r * 0.24);
    }),
    power: renderSprite(120, (ctx, r) => {
      const pts = [];
      for (let i = 0; i < 6; i++) pts.push([Math.cos((i * Math.PI) / 3 + Math.PI / 6) * r * 0.8, Math.sin((i * Math.PI) / 3 + Math.PI / 6) * r * 0.8]);
      poly(ctx, pts, COL.power, COL.text, 4);
      ctx.fillStyle = COL.sky1;
      ctx.font = `bold ${Math.floor(r)}px Verdana`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('W', 0, 4);
    }),
  };
}

// --- Geschütz (Eingabe) ---
function fireInterval(focus) {
  return DIFFICULTY.fireIntervalBase / (0.4 + 1.2 * focus);
}

function createTurret() {
  return guiAimTurret({
    posX: RUNNER_X + 20,
    posY: GROUND_Y - 120,
    focusSpread: DIFFICULTY.focusSpread,
    barrelLength: 70,
    lineWidth: 14,
    radius: 55,
    fireInterval: fireInterval(0.5),
    normalColor: COL.heroDark,
    crosshairColor: COL.textHi,
    keyCodes: { left: 'ArrowLeft', right: 'ArrowRight', up: 'ArrowUp', down: 'ArrowDown' },
    onShoot: ({ x, y, angle }) => shoot(x, y, angle),
  });
}

function shoot(x, y, angle) {
  if (gameState !== 'game') return;
  const spreads = weaponLevel === 1 ? [0] : weaponLevel === 2 ? [-0.07, 0.07] : [-0.15, 0, 0.15];
  spreads.forEach((s) => {
    const a = angle + s;
    bullets.push({
      x,
      y,
      vx: Math.cos(a) * DIFFICULTY.bulletSpeed,
      vy: Math.sin(a) * DIFFICULTY.bulletSpeed,
      angle: a,
      life: 0,
    });
  });
  stats.shots++;
  burst(x, y, COL.bullet, 3, 150);
}

// --- Spawnen ---
function hpScale() {
  return 1 + DIFFICULTY.hpPerLevel * (level - 1);
}
function speedScale() {
  return 1 + DIFFICULTY.speedPerLevel * (level - 1);
}

function spawnEnemy(type, opts = {}) {
  const t = ENEMY_TYPES[type];
  const r = t.radius;
  const hp = t.hp * hpScale() * (type === 'boss' ? 1 + 0.3 * Math.floor((level - DIFFICULTY.bossLevel) / DIFFICULTY.bossEvery) : 1);
  const e = {
    type,
    x: W + r + 20,
    baseY: opts.baseY !== undefined ? opts.baseY : SKY_TOP + r + Math.random() * (SKY_BOTTOM - SKY_TOP - 2 * r),
    y: 0,
    t: 0,
    hp,
    maxHp: hp,
    radius: r,
    speed: t.speed * speedScale() * (type === 'drohne' && opts.formation === undefined ? 0.85 + Math.random() * 0.3 : 1),
    amp: t.amp,
    phase: opts.phase !== undefined ? opts.phase : Math.random() * Math.PI * 2,
    reward: t.reward,
    formation: opts.formation,
    shootTimer: 1 + Math.random() * 2,
    spawnTimer: 3,
    flash: 0,
  };
  e.y = e.baseY;
  enemies.push(e);
  return e;
}

function spawnFriendly() {
  friendlies.push({
    x: W + 60,
    baseY: SKY_TOP + 80 + Math.random() * (SKY_BOTTOM - SKY_TOP - 160),
    y: 0,
    t: 0,
    radius: 55,
    speed: 190 * speedScale(),
  });
}

function spawnPowerup() {
  powerups.push({
    x: W + 60,
    baseY: SKY_TOP + 80 + Math.random() * (SKY_BOTTOM - SKY_TOP - 160),
    y: 0,
    t: 0,
    radius: 55,
    speed: 160,
  });
}

function dropBomb(x, y, vxExtra = 0) {
  const g = 380;
  const fall = Math.sqrt((2 * Math.max(50, GROUND_Y - 60 - y)) / g);
  bombs.push({ x, y, vx: (RUNNER_X - x) / fall + vxExtra, vy: 0, g, radius: 28 });
}

function buildWave() {
  const q = [];
  const count = DIFFICULTY.waveCountStart + DIFFICULTY.waveCountPerLevel * (level - 1);
  for (let i = 0; i < count; i++) {
    const pool = ['drohne', 'drohne'];
    if (level >= DIFFICULTY.schwarmLevel) pool.push('schwarm');
    if (level >= DIFFICULTY.bomberLevel) pool.push('bomber');
    if (level >= DIFFICULTY.panzerLevel) pool.push('panzer');
    q.push(pool[Math.floor(Math.random() * pool.length)]);
    if (level >= DIFFICULTY.friendlyLevel && Math.random() < DIFFICULTY.friendlyChance) q.push('friendly');
    if (i % DIFFICULTY.powerupEvery === DIFFICULTY.powerupEvery - 1) q.push('power');
  }
  if (level >= DIFFICULTY.bossLevel && (level - DIFFICULTY.bossLevel) % DIFFICULTY.bossEvery === 0) {
    q.push('boss');
  }
  return q;
}

function spawnTick(elapsed) {
  if (spawnQueue.length === 0) return;
  // Boss erst, wenn der Himmel frei ist
  if (spawnQueue[0] === 'boss' && enemies.length > 0) return;
  spawnTimer += elapsed;
  const interval = Math.max(
    DIFFICULTY.spawnIntervalMin,
    DIFFICULTY.spawnIntervalStart * Math.pow(DIFFICULTY.spawnIntervalFactor, level - 1)
  );
  if (spawnTimer < interval) return;
  spawnTimer = 0;
  const next = spawnQueue.shift();
  if (next === 'schwarm') {
    const id = ++formationCounter;
    const size = 6;
    formations[id] = { size, killed: 0, lost: false };
    const baseY = SKY_TOP + 120 + Math.random() * (SKY_BOTTOM - SKY_TOP - 240);
    const phase = Math.random() * Math.PI * 2;
    for (let k = 0; k < size; k++) {
      const e = spawnEnemy('drohne', { baseY, phase, formation: id });
      e.t = -k * 0.42; // hintereinander (Startverzögerung)
      e.amp = 110;
      e.reward = 15;
    }
  } else if (next === 'friendly') {
    spawnFriendly();
  } else if (next === 'power') {
    spawnPowerup();
  } else if (next === 'boss') {
    spawnEnemy('boss', { baseY: 330 });
    addFloatingText('MUTTERSCHIFF!', W / 2, 250, COL.boss, 100);
    playSound(soundBoss, 0.8);
    flash = 0.5;
  } else {
    spawnEnemy(next);
  }
}

// --- Treffer & Schaden ---
function killEnemy(e) {
  removeItemFromArray(enemies, e);
  stats.kills++;
  score += e.reward;
  const big = e.type === 'boss';
  burst(e.x, e.y, COL[e.type] || COL.drohne, big ? 120 : e.type === 'panzer' ? 40 : 18, big ? 900 : 380);
  addFloatingText(`+${e.reward}`, e.x, e.y - e.radius, COL.text, big ? 80 : 38);
  if (big) {
    stats.bosses++;
    shake = 0.8;
    flash = 0.8;
    playSound(soundBoom, 1);
  } else if (e.type !== 'drohne' || Math.random() < 0.3) {
    playSound(e.type === 'drohne' ? soundPop : soundBoom, e.type === 'drohne' ? 0.25 : 0.4);
  }
  if (e.formation !== undefined) {
    const f = formations[e.formation];
    f.killed++;
    if (f.killed === f.size && !f.lost) {
      score += DIFFICULTY.formationBonus;
      stats.formations++;
      addFloatingText(`FORMATION! +${DIFFICULTY.formationBonus}`, e.x, e.y - 90, COL.textHi, 56);
      flash = Math.max(flash, 0.3);
    }
  }
}

function damageShield(amount, x, y, text) {
  shield -= amount;
  shake = Math.max(shake, 0.4);
  burst(x, y, COL.bad, 20, 350);
  if (text) addFloatingText(text, x, y - 60, COL.bad, 44);
  if (shield <= 0) {
    shield = 0;
    gameState = 'gameover';
    stateTime = 0;
    buttonsGameOver = [startButton()];
    burst(RUNNER_X, GROUND_Y - 80, COL.hero, 80, 600);
    playSound(soundBoom, 1);
  }
}

function hitTest(b, obj) {
  const dx = b.x - obj.x;
  const dy = b.y - obj.y;
  const r = obj.radius + DIFFICULTY.bulletRadius;
  return dx * dx + dy * dy <= r * r;
}

function updateBullets(ctx, elapsed) {
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  ctx.strokeStyle = COL.bullet;
  ctx.lineCap = 'round';
  ctx.lineWidth = 10;
  for (let i = bullets.length - 1; i >= 0; i--) {
    const b = bullets[i];
    b.x += b.vx * elapsed;
    b.y += b.vy * elapsed;
    b.life += elapsed;
    if (b.x < -50 || b.x > W + 50 || b.y < -50 || b.y > H + 50) {
      bullets.splice(i, 1);
      continue;
    }
    let hit = false;
    for (const e of enemies) {
      if (hitTest(b, e)) {
        e.hp -= 1;
        e.flash = 0.08;
        if (e.hp <= 0) killEnemy(e);
        else burst(b.x, b.y, COL.bullet, 3, 200);
        hit = true;
        break;
      }
    }
    if (!hit) {
      for (const bomb of bombs) {
        if (hitTest(b, bomb)) {
          removeItemFromArray(bombs, bomb);
          burst(bomb.x, bomb.y, COL.bomb, 14, 300);
          score += 5;
          hit = true;
          break;
        }
      }
    }
    if (!hit) {
      for (const f of friendlies) {
        if (hitTest(b, f)) {
          removeItemFromArray(friendlies, f);
          stats.friendlyHit++;
          score += DIFFICULTY.friendlyPenalty;
          burst(f.x, f.y, COL.friendly, 40, 400);
          damageShield(1, f.x, f.y, `Rettungskapsel! ${DIFFICULTY.friendlyPenalty}`);
          hit = true;
          break;
        }
      }
    }
    if (!hit) {
      for (const p of powerups) {
        if (hitTest(b, p)) {
          removeItemFromArray(powerups, p);
          weaponLevel = Math.min(3, weaponLevel + 1);
          weaponTimer = DIFFICULTY.weaponDuration;
          burst(p.x, p.y, COL.power, 40, 450);
          addFloatingText(weaponLevel === 3 ? 'DREIFACHSCHUSS!' : 'DOPPELSCHUSS!', p.x, p.y - 70, COL.power, 54);
          playSound(soundPower, 0.7);
          hit = true;
          break;
        }
      }
    }
    if (hit) {
      bullets.splice(i, 1);
      continue;
    }
    const tail = 0.025;
    ctx.beginPath();
    ctx.moveTo(b.x - b.vx * tail, b.y - b.vy * tail);
    ctx.lineTo(b.x, b.y);
    ctx.stroke();
  }
  ctx.restore();
}

// --- Bewegung & Zeichnen der Objekte ---
function drawSprite(ctx, sprite, x, y, scale = 1, rot = 0) {
  ctx.save();
  ctx.translate(x, y);
  if (rot) ctx.rotate(rot);
  ctx.drawImage(sprite, (-sprite.width / 2) * scale, (-sprite.height / 2) * scale, sprite.width * scale, sprite.height * scale);
  ctx.restore();
}

function updateEnemies(ctx, elapsed) {
  enemies.slice().forEach((e) => {
    e.t += elapsed;
    e.flash = Math.max(0, e.flash - elapsed);
    if (e.t < 0) return; // Formation wartet noch
    if (e.type === 'boss') {
      // fliegt ein, bleibt dann rechts und kämpft
      if (e.x > 1450) e.x -= e.speed * elapsed;
      e.y = e.baseY + Math.sin(e.t * 0.8) * 140;
      e.shootTimer -= elapsed;
      if (e.shootTimer <= 0) {
        e.shootTimer = Math.max(1.6, 3.2 - 0.2 * (level - DIFFICULTY.bossLevel));
        for (let k = -2; k <= 2; k++) dropBomb(e.x - 60, e.y + 80, k * 60);
      }
      e.spawnTimer -= elapsed;
      if (e.spawnTimer <= 0) {
        e.spawnTimer = 4;
        const d = spawnEnemy('drohne', { baseY: e.y });
        d.x = e.x - 100;
      }
    } else {
      e.x -= e.speed * elapsed;
      e.y = e.baseY + Math.sin(e.t * 2.5 + e.phase) * e.amp;
      if (e.type === 'bomber') {
        e.shootTimer -= elapsed;
        if (e.shootTimer <= 0 && e.x > RUNNER_X + 200 && e.x < W - 50) {
          e.shootTimer = Math.max(1.4, 2.8 - 0.1 * level);
          dropBomb(e.x, e.y + 40);
        }
      }
      if (e.x < -e.radius - 20) {
        removeItemFromArray(enemies, e);
        if (e.formation !== undefined) formations[e.formation].lost = true;
        damageShield(1, 80, e.y, 'entkommen!');
        return;
      }
    }
    const color = COL[e.type];
    drawGlow(ctx, e.x, e.y, e.radius * 2, color, 0.55 + Math.sin(gameTime * 6 + e.phase) * 0.15);
    drawSprite(ctx, sprites[e.type], e.x, e.y, 1, Math.sin(e.t * 3 + e.phase) * 0.08);
    if (e.flash > 0) drawGlow(ctx, e.x, e.y, e.radius * 1.4, COL.text, 1);
    if (e.maxHp > 3 && e.hp < e.maxHp) {
      const w = e.type === 'boss' ? 300 : e.radius * 2;
      ctx.save();
      ctx.fillStyle = COL.sky1;
      ctx.fillRect(e.x - w / 2, e.y - e.radius - 26, w, 10);
      ctx.fillStyle = COL.textHi;
      ctx.fillRect(e.x - w / 2, e.y - e.radius - 26, (w * Math.max(0, e.hp)) / e.maxHp, 10);
      ctx.restore();
    }
  });
}

function updateFriendlies(ctx, elapsed) {
  friendlies.slice().forEach((f) => {
    f.t += elapsed;
    f.x -= f.speed * elapsed;
    f.y = f.baseY + Math.sin(f.t * 2) * 25;
    if (f.x < -80) {
      removeItemFromArray(friendlies, f);
      stats.rescued++;
      score += DIFFICULTY.friendlyBonus;
      addFloatingText(`gerettet! +${DIFFICULTY.friendlyBonus}`, 200, f.y, COL.friendly, 40);
      return;
    }
    drawGlow(ctx, f.x, f.y, 110, COL.friendly, 0.6);
    drawSprite(ctx, sprites.friendly, f.x, f.y, 1, Math.sin(f.t * 1.5) * 0.2);
  });
  powerups.slice().forEach((p) => {
    p.t += elapsed;
    p.x -= p.speed * elapsed;
    p.y = p.baseY + Math.sin(p.t * 3) * 40;
    if (p.x < -80) {
      removeItemFromArray(powerups, p);
      return;
    }
    drawGlow(ctx, p.x, p.y, 120 + Math.sin(p.t * 8) * 15, COL.power, 0.8);
    drawSprite(ctx, sprites.power, p.x, p.y, 1, p.t * 1.5);
  });
}

function updateBombs(ctx, elapsed) {
  bombs.slice().forEach((b) => {
    b.vy += b.g * elapsed;
    b.x += b.vx * elapsed;
    b.y += b.vy * elapsed;
    const dx = b.x - RUNNER_X;
    const dy = b.y - (GROUND_Y - 80);
    if (dx * dx + dy * dy < 75 * 75) {
      removeItemFromArray(bombs, b);
      burst(b.x, b.y, COL.bomb, 30, 400);
      if (invulnerable <= 0) {
        invulnerable = 1.2;
        damageShield(1, RUNNER_X, GROUND_Y - 160, 'Treffer!');
        playSound(soundBoom, 0.6);
      }
      return;
    }
    if (b.y > GROUND_Y) {
      removeItemFromArray(bombs, b);
      burst(b.x, GROUND_Y, COL.bomb, 16, 250);
      return;
    }
    drawGlow(ctx, b.x, b.y, 60, COL.bomb, 0.8);
    ctx.save();
    ctx.fillStyle = COL.bomb;
    ctx.beginPath();
    ctx.arc(b.x, b.y, b.radius * (0.85 + Math.sin(gameTime * 20) * 0.15), 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  });
}

// --- Landschaft & Läufer ---
function drawLayer(ctx, img, speed, y) {
  const off = ((scroll * speed) % W + W) % W;
  ctx.drawImage(img, -off, y);
  ctx.drawImage(img, W - off, y);
}

function renderWorld(ctx) {
  ctx.drawImage(layers.sky, 0, 0);
  drawLayer(ctx, layers.stars, 0.03, 0);
  drawLayer(ctx, layers.far, 0.15, GROUND_Y - 380);
  drawLayer(ctx, layers.mid, 0.4, GROUND_Y - 260);
  // Boden mit scrollenden Kacheln
  ctx.save();
  ctx.fillStyle = COL.ground;
  ctx.fillRect(0, GROUND_Y, W, H - GROUND_Y);
  ctx.strokeStyle = COL.groundLine;
  ctx.lineWidth = 4;
  ctx.shadowColor = COL.groundLine;
  ctx.shadowBlur = 20;
  ctx.beginPath();
  ctx.moveTo(0, GROUND_Y);
  ctx.lineTo(W, GROUND_Y);
  ctx.stroke();
  ctx.shadowBlur = 0;
  ctx.globalAlpha = 0.5;
  ctx.lineWidth = 3;
  const tile = 160;
  const off = scroll % tile;
  for (let x = -off; x < W + tile; x += tile) {
    // perspektivische Bodenlinien
    ctx.beginPath();
    ctx.moveTo(x, GROUND_Y);
    ctx.lineTo(x - (W / 2 - x) * 0.6, H);
    ctx.stroke();
  }
  ctx.restore();
}

function renderRunner(ctx) {
  if (invulnerable > 0 && Math.floor(gameTime * 15) % 2 === 0) return;
  const phase = scroll * 0.035;
  const bob = Math.abs(Math.sin(phase)) * 8;
  const x = RUNNER_X;
  const hip = GROUND_Y - 70 - bob;
  ctx.save();
  ctx.lineCap = 'round';
  // Beine
  ctx.strokeStyle = COL.heroDark;
  ctx.lineWidth = 16;
  [0, Math.PI].forEach((p) => {
    const s = Math.sin(phase + p);
    const kneeX = x + s * 28;
    const kneeY = hip + 38;
    const footX = x + s * 40 - Math.max(0, -Math.cos(phase + p)) * 20;
    const footY = GROUND_Y - Math.max(0, Math.cos(phase + p)) * 22;
    ctx.beginPath();
    ctx.moveTo(x, hip);
    ctx.lineTo(kneeX, kneeY);
    ctx.lineTo(footX, footY);
    ctx.stroke();
  });
  // Körper
  ctx.fillStyle = COL.hero;
  ctx.fillRect(x - 26, hip - 75, 52, 80);
  // Rucksack mit Glüh-Düse
  ctx.fillStyle = COL.heroDark;
  ctx.fillRect(x - 44, hip - 70, 20, 55);
  ctx.restore();
  drawGlow(ctx, x - 40, hip - 5, 35 + Math.sin(gameTime * 30) * 6, COL.bullet, 0.8);
  // Kopf mit Visier
  ctx.save();
  ctx.fillStyle = COL.hero;
  ctx.beginPath();
  ctx.arc(x, hip - 100, 28, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = COL.visor;
  ctx.shadowColor = COL.visor;
  ctx.shadowBlur = 20;
  ctx.fillRect(x + 2, hip - 110, 26, 14);
  ctx.restore();
  // Geschütz-Drehpunkt an der Schulter
  if (turret) {
    turret.setX(x + 20);
    turret.setY(hip - 55);
  }
}

// --- Effekte ---
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
    p.vx *= 1 - 1.5 * elapsed;
    p.vy = p.vy * (1 - 1.5 * elapsed) + 200 * elapsed;
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
  ctx.fillStyle = COL.star;
  ctx.fillRect(0, 0, W, H);
  ctx.restore();
  flash = Math.max(0, flash - elapsed * 1.5);
}

function renderHud(ctx) {
  const remaining = spawnQueue.filter((q) => q !== 'friendly' && q !== 'power').length + enemies.length;
  util.renderTextDropShadow({
    ctx,
    text: `Level ${level}   ${score} Punkte   noch ${remaining}`,
    fontSize: '46px',
    dropDistX: 4,
    dropDistY: 4,
    fillStyle: COL.text,
    align: 'left',
    x: 30,
    y: 60,
  });
  // Schild
  const n = DIFFICULTY.shieldMax;
  const bw = 34;
  const x0 = W - 30 - n * (bw + 6);
  for (let i = 0; i < n; i++) {
    ctx.save();
    ctx.globalAlpha = i < shield ? 1 : 0.2;
    ctx.fillStyle = i < shield && shield <= 3 && Math.floor(gameTime * 4) % 2 === 0 ? COL.bad : COL.hero;
    ctx.fillRect(x0 + i * (bw + 6), 28, bw, 34);
    ctx.restore();
  }
  // Fokus-Anzeige beim Läufer (Teamwork-Feedback)
  const focus = turret ? turret.getFocus() : 0;
  const fx = 560;
  const fy = GROUND_Y + 45;
  ctx.save();
  ctx.fillStyle = COL.sky1;
  ctx.fillRect(fx, fy, 400, 30);
  ctx.fillStyle = focus > 0.7 ? COL.textHi : COL.hero;
  ctx.fillRect(fx, fy, 400 * focus, 30);
  ctx.restore();
  util.renderText({
    ctx,
    text: focus > 0.7 ? 'FOKUS – Dauerfeuer!' : 'FOKUS: alle auf ein Ziel!',
    fontSize: '32px',
    fillStyle: COL.text,
    align: 'left',
    x: fx + 420,
    y: fy + 27,
  });
  if (weaponLevel > 1) {
    util.renderText({
      ctx,
      text: `${weaponLevel === 3 ? 'Dreifach' : 'Doppel'}schuss ${Math.ceil(weaponTimer)}s`,
      fontSize: '32px',
      fillStyle: COL.power,
      align: 'right',
      x: W - 30,
      y: 105,
    });
  }
}

// --- Spielfluss ---
function resetGame() {
  updateColors();
  glowSprites = {};
  layers = renderLayers();
  renderSprites();
  level = 1;
  score = 0;
  shield = DIFFICULTY.shieldMax;
  gameTime = 0;
  stateTime = 0;
  spawnTimer = 0;
  spawnQueue = [];
  enemies = [];
  bullets = [];
  bombs = [];
  friendlies = [];
  powerups = [];
  particles = [];
  floatingTexts = [];
  formations = {};
  formationCounter = 0;
  weaponLevel = 1;
  weaponTimer = 0;
  invulnerable = 0;
  shake = 0;
  flash = 0;
  stats = { kills: 0, shots: 0, formations: 0, rescued: 0, friendlyHit: 0, bosses: 0, maxFocus: 0 };
  turret = createTurret();
  lastTime = performance.now();
}

function startWave() {
  spawnQueue = buildWave();
  spawnTimer = 0;
  gameState = 'game';
  stateTime = 0;
}

function startButton() {
  return guiFillButton({
    label: 'START',
    posX: W / 2 + 200,
    posY: H / 2 + 120,
    speedDown: 12,
    speedUp: 25,
    edges: 3,
    activeValue: 90,
    radius: 150,
    normalColor: COL.hero,
    activeColor: COL.textHi,
    growColor: COL.visor,
    onEnterActive: () => {
      resetGame();
      startWave();
    },
    onExitActive: () => {},
  });
}

function newElementText(lvl) {
  if (lvl === DIFFICULTY.schwarmLevel) return 'NEU: Schwarm-Formationen und Rettungskapseln!\nKapseln mit Kreuz NICHT abschiessen!';
  if (lvl === DIFFICULTY.bomberLevel) return 'NEU: Bomber!\nBomben lassen sich abschiessen.';
  if (lvl === DIFFICULTY.panzerLevel) return 'NEU: Panzerschiffe – alle zusammen draufhalten!';
  if (lvl >= DIFFICULTY.bossLevel && (lvl - DIFFICULTY.bossLevel) % DIFFICULTY.bossEvery === 0)
    return 'ACHTUNG: Ein Mutterschiff nähert sich!';
  return 'Die Wellen werden schneller …';
}

// --- Bildschirme ---
function handleStart(grid, elapsed, ctx) {
  gameTime += elapsed;
  scroll += 220 * elapsed;
  renderWorld(ctx);
  renderRunner(ctx);
  updateParticles(ctx, elapsed);
  util.renderTextDropShadow({ ctx, text: 'STERNENLÄUFER', fontSize: '150px', fillStyle: COL.hero, x: W / 2, y: 260 });
  util.renderTextDropShadow({
    ctx,
    text: 'Das Geschütz zielt auf die MITTE aller Laser.\nAlle auf ein Ziel = Dauerfeuer!',
    fontSize: '44px',
    lineHeight: 60,
    dropDistX: 4,
    dropDistY: 4,
    fillStyle: COL.text,
    x: W / 2,
    y: 350,
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
  scroll += (220 + 15 * (level - 1)) * elapsed;
  invulnerable = Math.max(0, invulnerable - elapsed);
  if (weaponTimer > 0) {
    weaponTimer -= elapsed;
    if (weaponTimer <= 0) weaponLevel = 1;
  }

  if (keyPressedOnce('KeyK')) enemies.slice().forEach((e) => killEnemy(e));
  if (keyPressedOnce('KeyL')) {
    spawnQueue = [];
    enemies = [];
  }

  spawnTick(elapsed);

  shake = Math.max(0, shake - elapsed);
  ctx.save();
  if (shake > 0) {
    const s = shake * 30;
    ctx.translate((Math.random() - 0.5) * s, (Math.random() - 0.5) * s);
  }
  renderWorld(ctx);
  updateFriendlies(ctx, elapsed);
  updateEnemies(ctx, elapsed);
  updateBombs(ctx, elapsed);
  renderRunner(ctx);
  // Feuerrate nach Fokus (Teamwork), dann Eingabe + Zeichnen
  turret.setFireInterval(fireInterval(turret.getFocus()));
  turret.handle(grid, elapsed);
  stats.maxFocus = Math.max(stats.maxFocus, turret.getFocus());
  updateBullets(ctx, elapsed);
  updateParticles(ctx, elapsed);
  updateFloatingTexts(ctx, elapsed);
  ctx.restore();

  renderHud(ctx);
  renderFlash(ctx, elapsed);

  if (gameState === 'game' && spawnQueue.length === 0 && enemies.length === 0) {
    gameState = 'levelup';
    stateTime = 0;
    flash = 1;
    bombs = [];
    playSound(soundLevel, 0.8);
  }
}

function handleLevelUp(grid, elapsed, ctx) {
  gameTime += elapsed;
  stateTime += elapsed;
  scroll += 500 * elapsed; // Sprint zwischen den Wellen
  renderWorld(ctx);
  updateFriendlies(ctx, elapsed);
  renderRunner(ctx);
  turret.handle(grid, elapsed); // Zielen weiter sichtbar, Schüsse werden ignoriert
  if (Math.random() < elapsed * 20) burst(Math.random() * W, Math.random() * 600, COL.textHi, 5, 250);
  updateBullets(ctx, elapsed);
  updateParticles(ctx, elapsed);
  updateFloatingTexts(ctx, elapsed);
  const t = Math.min(1, stateTime * 3);
  ctx.save();
  ctx.translate(W / 2, 380);
  ctx.scale(0.5 + 0.5 * t, 0.5 + 0.5 * t);
  util.renderTextDropShadow({ ctx, text: `LEVEL ${level + 1}`, fontSize: '170px', fillStyle: COL.hero, x: 0, y: 0 });
  ctx.restore();
  util.renderTextDropShadow({
    ctx,
    text: `Welle ${level} geschafft!\n${newElementText(level + 1)}`,
    fontSize: '50px',
    lineHeight: 70,
    dropDistX: 4,
    dropDistY: 4,
    fillStyle: COL.text,
    x: W / 2,
    y: 500,
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
  util.renderTextDropShadow({ ctx, text: 'Läufer gestoppt!', fontSize: '130px', fillStyle: COL.bad, x: W / 2, y: 230 });
  util.renderTextDropShadow({
    ctx,
    text:
      `Level ${level} erreicht – ${score} Punkte\n` +
      `${stats.kills} Gegner abgeschossen, ${stats.bosses} Mutterschiffe\n` +
      `${stats.formations} komplette Formationen, bester Fokus ${Math.round(stats.maxFocus * 100)} %\n` +
      `${stats.rescued} Kapseln gerettet, ${stats.friendlyHit} abgeschossen`,
    fontSize: '44px',
    lineHeight: 62,
    dropDistX: 4,
    dropDistY: 4,
    fillStyle: COL.text,
    x: W / 2,
    y: 330,
  });
  buttonsGameOver.forEach((b) => b.handle(grid, elapsed));
  if (keyPressedOnce('Space')) {
    resetGame();
    startWave();
  }
}

export default {
  name: 'Sternenläufer',
  description: `
Run & Gun auf einem fremden Planeten!

Der Sternenläufer rennt unten durch die Landschaft.
Sein Geschütz zielt automatisch auf die MITTE aller Laserpunkte.
Leuchtet alle gemeinsam auf denselben Gegner – je enger ihr zusammen seid,
desto schneller feuert er.

Rettungskapseln mit Kreuz NICHT abschiessen.
Waffenkapseln mit W abschiessen = Mehrfachschuss.
Entkommene Gegner und Bomben kosten Schild.`,
  image: 'media/img/gametitles/laser-torpedo-###4###.png',
  init: function () {
    resetGame();
    gameState = 'start';
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
