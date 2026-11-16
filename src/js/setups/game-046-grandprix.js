/**
 * Laser-Grand-Prix – Autorennen für viele Laser
 *
 * Das ganze Publikum fährt GEMEINSAM einen Rennwagen über eine nach unten scrollende Strecke.
 *
 * Regeln:
 * - LENKEN: Unten liegt der Lenkstreifen. Der Wagen zieht zum Schwerpunkt aller Laser im Streifen
 *   (gui/aimTurret, unsichtbar). Leuchten alle an dieselbe Stelle (hoher Fokus), lenkt der Wagen
 *   scharf und direkt. Leuchten alle durcheinander, lenkt er träge.
 * - TURBO-FELDER (Pfeile) auf der Strecke: mit Lasern aufladen (gui/pixelFillButton, mehr Laser =
 *   schneller) und dann DRÜBERFAHREN = Turbo + Punkte. Schraubenschlüssel-Felder reparieren den Wagen.
 *   Teamwork: eine Gruppe lenkt, eine Gruppe lädt die Felder.
 * - NICHT ANLEUCHTEN: Ölflecken (fangen Feuer und werden grösser) und Streckenposten am Rand
 *   (geblendet = Strafe). Wildes Herumleuchten lohnt sich also nicht.
 * - Rivalen überholen (+Punkte), nicht rammen. Öl, Feuer, Rammen und Fahren neben der Strecke
 *   erhöhen den Schaden. Schaden voll = Game Over.
 * - Jede Runde ist ein Level und bringt etwas Neues: Gegenverkehr, Kurven, Nachtfahrt, Regen.
 *   In Runde 3 und 6 blockiert der Brummi-Boss die Strecke: alle zusammen auf den Boss leuchten,
 *   bis er Platz macht.
 *
 * Tastatur-Test: Leertaste = Start, Pfeil links/rechts = lenken, 1 = sichtbare Felder aufladen,
 * 2 = Boss weghupen, L = Runde überspringen.
 */

import util, { getRgbSpreadHex, removeItemFromArray } from '../util.js';
import soundPop from '../../../public/media/369952__mischy__plop-1.wav';
import soundBoom from '../../../public/media/414346__bykgames__explosion-far.wav';
import soundLevel from '../../../public/media/521966__kastenfrosch__ready-to-start-jingle.ogg';
import soundBoss from '../../../public/media/70299__kizilsungur__sonar.wav';
import soundPower from '../../../public/media/496199__luminousfridge__player-spawned.ogg';
import soundStomp from '../../../public/media/517267__foolboymedia__cinematic-stomp.wav';
import soundWhistle from '../../../public/media/trillerpfeife.mp3';

var laserConfig = require('../LaserApiConfig.js').default;
var MasterCanvas = require('../MasterCanvas').default;
var guiFillButton = require('./gui/fillButton').default;
var guiPixelFillButton = require('./gui/pixelFillButton').default;
var guiAimTurret = require('./gui/aimTurret').default;

// --- Balancing ---
const DIFFICULTY = {
  maxLevel: 6,
  // Strecke
  startLapLength: 16000, // Rundenlänge in Pixeln
  lapLengthPerLevel: 2500,
  startSpeed: 380, // Scroll-Tempo in px/s
  speedPerLevel: 25,
  boostFactor: 1.55,
  boostDuration: 3,
  offroadSpeedFactor: 0.55,
  crashSpeedFactor: 0.5,
  crashSlowDuration: 1.2,
  // Lenkung
  steerRateMin: 1.2, // 1/s bei Fokus 0 (alle leuchten durcheinander)
  steerRateMax: 5.5, // 1/s bei Fokus 1 (alle einig)
  focusSpread: 450,
  gripDry: 12,
  gripRain: 2.2,
  maxSideSpeed: 900,
  // Spawns
  startSpawnGap: 620, // Abstand zwischen zwei Ereignissen in px
  spawnGapFactor: 0.9,
  minSpawnGap: 360,
  weightRival: 4,
  weightOil: 2,
  weightTurbo: 2.4,
  weightRepair: 0.5,
  weightMarshal: 1.5,
  weightOncoming: 1.6,
  rivalSpeedFactor: 0.62,
  oncomingSpeed: 150,
  oncomingSpeedPerLevel: 15,
  doubleRivalFromLevel: 4,
  // Kurven
  curveFromLevel: 3,
  curveStart: 150,
  curvePerLevel: 30,
  // Schaden (0..100)
  damageRival: 18,
  damageOncoming: 25,
  damageOil: 10,
  damageFire: 16,
  damageOffroadPerSecond: 7,
  damageMarshal: 8,
  repairAmount: 25,
  repairPerLevel: 20,
  // Punkte
  scorePerPixel: 0.05,
  scoreOvertake: 50,
  scoreTurbo: 100,
  scoreRepair: 60,
  scoreBoss: 500,
  scoreLevel: 300,
  penaltyMarshal: 100,
  penaltyOilFire: 50,
  // Boss
  bossEvery: 3,
  bossAtLapPercent: 0.55,
  bossOilInterval: 2.4,
  bossFillSpeed: 20,
  bossFullPercent: 30,
  // Sonstiges
  levelUpDuration: 2.8,
  maxParticles: 400,
};

const LEVEL_NEWS = [
  '',
  'Turbo-Felder laden und drüberfahren!',
  'NEU: Gegenverkehr auf der linken Spur!',
  'NEU: Kurven – und der Brummi-Boss!',
  'NEU: Nachtfahrt – nur der Lichtkegel hilft!',
  'NEU: Regen – die Lenkung schwimmt!',
  'FINALE: Nacht, Regen und der Boss!',
];

const W = 1920;
const H = 1080;
const CAR_Y = 820;
const STRIP_Y = 900; // ab hier liegt der Lenkstreifen
const ROAD_HALF = 500;
const LANES = [-0.75, -0.25, 0.25, 0.75];

// --- Zustand ---
var gameState = 'start';
var lastTime = 0;
var time = 0;
var level = 1;
var score = 0;
var damage = 0;
var dist = 0;
var finishD = 0;
var curSpeed = 0;
var nextSpawnD = 0;
var levelUpTimer = 0;
var shake = 0;
var flash = 0;
var won = false;
var bossDone = true;
var boss = null;
var bossOilTimer = 0;
var stats = { overtakes: 0, turbos: 0, penalties: 0, crashes: 0 };
var car = { x: W / 2, vx: 0, angle: 0, spin: 0, boost: 0, slow: 0 };
var objects = [];
var particles = [];
var marks = [];
var floaters = [];
var activeSounds = [];
var previousKeys = {};
var turret = null;
var startButton = null;
var restartButton = null;
var C = {};
var sprites = {};
var grassTile = null;

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

function clamp(v, a, b) {
  return Math.max(a, Math.min(b, v));
}

function col(hue, sat, val) {
  return getRgbSpreadHex(laserConfig.testColor, hue, sat, val);
}

/** Farbpalette, komplett aus der Laserfarbe abgeleitet (nie die Laserfarbe selbst) */
function buildPalette() {
  C = {
    grass: col(0.35, 0.55, 0.11),
    grass2: col(0.38, 0.5, 0.17),
    grass3: col(0.3, 0.45, 0.22),
    road: col(0.55, 0.25, 0.15),
    roadDark: col(0.55, 0.3, 0.1),
    kerbA: col(0.18, 0.85, 0.9),
    kerbB: col(0.5, 0.08, 0.8),
    lane: col(0.5, 0.12, 0.65),
    neon: col(0.6, 0.8, 1),
    car: col(0.62, 0.85, 1),
    carAccent: col(0.2, 0.7, 1),
    glass: col(0.5, 0.35, 0.3),
    tire: col(0.5, 0.1, 0.08),
    light: col(0.25, 0.25, 1),
    turbo: col(0.42, 0.9, 1),
    turboDark: col(0.42, 0.8, 0.45),
    repair: col(0.7, 0.7, 1),
    repairDark: col(0.7, 0.6, 0.45),
    oil: col(0.5, 0.4, 0.05),
    oilShine: col(0.75, 0.5, 0.45),
    fire: col(0.15, 0.95, 1),
    fire2: col(0.22, 0.8, 1),
    marshal: col(0.28, 0.75, 0.95),
    marshalFlag: col(0.22, 0.9, 1),
    boss: col(0.8, 0.6, 0.7),
    bossAccent: col(0.85, 0.8, 1),
    warn: col(0.2, 0.9, 1),
    text: col(0.5, 0.15, 0.9),
    title: col(0.45, 0.8, 1),
    hud: col(0.55, 0.5, 1),
    strip: col(0.6, 0.55, 0.8),
    dust: col(0.3, 0.3, 0.5),
    spark: col(0.2, 0.6, 1),
  };
}

function roundRectPath(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

/** Auto von oben (Front zeigt nach oben) einmal in ein Offscreen-Canvas rendern */
function makeCarSprite(body, accent, w, h, truck) {
  const canvas = document.createElement('canvas');
  canvas.width = w + 40;
  canvas.height = h + 40;
  const ctx = canvas.getContext('2d');
  ctx.translate(20, 20);
  // Reifen
  ctx.fillStyle = C.tire;
  const tw = w * 0.2;
  const th = h * 0.2;
  [0.12, 0.68].forEach((py) => {
    roundRectPath(ctx, -tw * 0.45, h * py, tw, th, 6);
    ctx.fill();
    roundRectPath(ctx, w - tw * 0.55, h * py, tw, th, 6);
    ctx.fill();
  });
  // Karosserie
  ctx.fillStyle = body;
  roundRectPath(ctx, 0, 0, w, h, truck ? 14 : w * 0.32);
  ctx.fill();
  if (truck) {
    // Fahrerhaus + Ladefläche
    ctx.fillStyle = accent;
    roundRectPath(ctx, 6, 6, w - 12, h * 0.22, 10);
    ctx.fill();
    ctx.fillStyle = C.glass;
    roundRectPath(ctx, 14, 14, w - 28, h * 0.09, 6);
    ctx.fill();
    ctx.strokeStyle = accent;
    ctx.lineWidth = 5;
    for (let i = 0; i < 5; i++) {
      const y = h * 0.34 + i * h * 0.12;
      ctx.beginPath();
      ctx.moveTo(10, y);
      ctx.lineTo(w - 10, y);
      ctx.stroke();
    }
  } else {
    // Rennstreifen, Scheibe, Heckflügel
    ctx.fillStyle = accent;
    ctx.fillRect(w * 0.42, 4, w * 0.16, h - 8);
    ctx.fillStyle = C.glass;
    roundRectPath(ctx, w * 0.16, h * 0.26, w * 0.68, h * 0.24, 10);
    ctx.fill();
    roundRectPath(ctx, w * 0.2, h * 0.62, w * 0.6, h * 0.12, 8);
    ctx.fill();
    ctx.fillStyle = accent;
    ctx.fillRect(-4, h * 0.9, w + 8, h * 0.07);
  }
  // Scheinwerfer
  ctx.fillStyle = C.light;
  ctx.fillRect(w * 0.1, 2, w * 0.2, 8);
  ctx.fillRect(w * 0.7, 2, w * 0.2, 8);
  return canvas;
}

function buildSprites() {
  sprites = {
    player: makeCarSprite(C.car, C.carAccent, 76, 136, false),
    rivals: [0.25, 0.33, 0.72, 0.8, 0.9].map((hue) =>
      makeCarSprite(col(hue, 0.7, 0.85), col(hue + 0.08, 0.4, 0.5), 72, 128, false)
    ),
    oncoming: makeCarSprite(C.warn, C.tire, 72, 128, false),
    boss: makeCarSprite(C.boss, C.bossAccent, 170, 330, true),
  };
  // Wiesen-Kachel
  grassTile = document.createElement('canvas');
  grassTile.width = W;
  grassTile.height = H;
  const g = grassTile.getContext('2d');
  g.fillStyle = C.grass;
  g.fillRect(0, 0, W, H);
  for (let i = 0; i < 700; i++) {
    const x = Math.random() * W;
    const y = Math.random() * H;
    g.fillStyle = Math.random() < 0.5 ? C.grass2 : C.grass3;
    const s = 3 + Math.random() * 9;
    g.fillRect(x, y, s, s * (1 + Math.random() * 2));
    // am Rand doppelt zeichnen, damit die Kachel nahtlos scrollt
    g.fillRect(x, y - H, s, s * 3);
  }
}

// --- Level-Eigenschaften ---
function levelFeatures(lvl) {
  return {
    oncoming: lvl >= 2,
    curveAmp:
      lvl >= DIFFICULTY.curveFromLevel
        ? DIFFICULTY.curveStart + (lvl - DIFFICULTY.curveFromLevel) * DIFFICULTY.curvePerLevel
        : 0,
    night: lvl === 4 || lvl >= 6,
    rain: lvl >= 5,
    boss: lvl % DIFFICULTY.bossEvery === 0,
    baseSpeed: DIFFICULTY.startSpeed + (lvl - 1) * DIFFICULTY.speedPerLevel,
    spawnGap: Math.max(
      DIFFICULTY.minSpawnGap,
      DIFFICULTY.startSpawnGap * Math.pow(DIFFICULTY.spawnGapFactor, lvl - 1)
    ),
    lapLength: DIFFICULTY.startLapLength + (lvl - 1) * DIFFICULTY.lapLengthPerLevel,
  };
}

var curveAmp = 0;
function roadCenter(d) {
  return W / 2 + curveAmp * Math.sin(d / 1500) + curveAmp * 0.45 * Math.sin(d / 617 + 1.3);
}

// --- Effekte ---
function addParticle(x, y, vx, vy, life, color, size, scroll) {
  if (particles.length >= DIFFICULTY.maxParticles) particles.shift();
  particles.push({ x, y, vx, vy, life, maxLife: life, color, size, scroll: !!scroll });
}

function burst(x, y, color, count, speed) {
  for (let i = 0; i < count; i++) {
    const a = Math.random() * Math.PI * 2;
    const s = speed * (0.3 + Math.random() * 0.7);
    addParticle(x, y, Math.cos(a) * s, Math.sin(a) * s, 0.4 + Math.random() * 0.6, color, 4 + Math.random() * 7);
  }
}

function addFloater(x, y, text, color) {
  floaters.push({ x, y, text, color, life: 1.4 });
}

function addScore(points, x, y, color) {
  score = Math.max(0, score + points);
  addFloater(x, y, (points > 0 ? '+' : '') + points, color || C.text);
}

function addDamage(amount) {
  damage = Math.min(100, damage + amount);
  shake = Math.max(shake, 10 + amount);
}

// --- Spielobjekte ---
/**
 * Alle Objekte hängen an der Strecke: d = Streckenposition, u = Position quer (-1..1 = Fahrbahn).
 * Objekte mit Laser-Eingabe besitzen einen pixelFillButton, dessen handle() umwickelt wird.
 */
function createObject(type, d, u) {
  const obj = {
    type,
    d,
    u,
    v: 0,
    xOff: 0,
    vxOff: 0,
    sx: 0,
    sy: -999,
    radius: 60,
    btn: null,
    charged: false,
    used: false,
    hit: false,
    counted: false,
    alive: true,
    seed: Math.random() * 100,
    sprite: null,
  };
  let options = null;
  if (type === 'rival') {
    obj.v = levelFeatures(level).baseSpeed * DIFFICULTY.rivalSpeedFactor * (0.9 + Math.random() * 0.2);
    obj.sprite = sprites.rivals[Math.floor(Math.random() * sprites.rivals.length)];
  } else if (type === 'oncoming') {
    obj.v = -(DIFFICULTY.oncomingSpeed + level * DIFFICULTY.oncomingSpeedPerLevel);
    obj.sprite = sprites.oncoming;
  } else if (type === 'turbo' || type === 'repair') {
    obj.radius = 90;
    const main = type === 'turbo' ? C.turbo : C.repair;
    const dark = type === 'turbo' ? C.turboDark : C.repairDark;
    options = {
      radius: 90,
      speedUp: 95,
      speedDown: 15,
      fullPercent: 25,
      activeValue: 90,
      edges: type === 'turbo' ? 3 : 8,
      angle: type === 'turbo' ? -90 : 0,
      normalColor: dark,
      growColor: main,
      activeColor: main,
      onEnterActive: () => {
        obj.charged = true;
        burst(obj.sx, obj.sy, main, 14, 260);
        playSound(soundPop, 0.5);
      },
    };
  } else if (type === 'oil') {
    obj.radius = 80;
    options = {
      radius: 80,
      speedUp: 45,
      speedDown: 30,
      fullPercent: 30,
      activeValue: 90,
      edges: 9,
      lineWidth: 2,
      normalColor: C.oilShine,
      growColor: C.fire2,
      activeColor: C.fire,
      onEnterActive: () => {
        // Öl angezündet: wird zum grösseren Feuer
        obj.type = 'fire';
        obj.radius = 125;
        obj.charged = true;
        stats.penalties++;
        addScore(-DIFFICULTY.penaltyOilFire, obj.sx, obj.sy - 60, C.fire);
        addFloater(obj.sx, obj.sy - 120, 'ÖL BRENNT!', C.fire);
        burst(obj.sx, obj.sy, C.fire, 30, 420);
        shake = Math.max(shake, 14);
        playSound(soundBoom, 0.5);
      },
    };
  } else if (type === 'marshal') {
    obj.radius = 62;
    options = {
      radius: 62,
      speedUp: 60,
      speedDown: 40,
      fullPercent: 30,
      activeValue: 90,
      edges: 6,
      lineWidth: 2,
      normalColor: C.marshal,
      growColor: C.warn,
      activeColor: C.fire,
      onEnterActive: () => {
        obj.charged = true; // geblendet
        stats.penalties++;
        addScore(-DIFFICULTY.penaltyMarshal, obj.sx, obj.sy - 60, C.fire);
        addFloater(obj.sx, obj.sy - 120, 'POSTEN GEBLENDET!', C.fire);
        addDamage(DIFFICULTY.damageMarshal);
        flash = Math.max(flash, 0.5);
        playSound(soundWhistle, 0.6);
      },
    };
  } else if (type === 'boss') {
    obj.radius = 150;
    obj.sprite = sprites.boss;
    obj.entry = 0;
    options = {
      radius: 150,
      speedUp: DIFFICULTY.bossFillSpeed,
      speedDown: 5,
      fullPercent: DIFFICULTY.bossFullPercent,
      activeValue: 95,
      edges: 10,
      lineWidth: 5,
      normalColor: C.bossAccent,
      growColor: C.warn,
      activeColor: C.turbo,
      onEnterActive: () => defeatBoss(obj),
    };
  }

  if (options) {
    options.label = '';
    options.posX = -500;
    options.posY = -500;
    obj.btn = guiPixelFillButton(options);
    // Handle-Wrapping: Position an der Strecke, eigenes Aussehen, dann Treffer + Füllanzeige
    const handleOriginal = obj.btn.handle;
    obj.btn.handle = (grid, elapsed) => {
      obj.btn.setX(obj.sx);
      obj.btn.setY(obj.sy);
      obj.btn.setRadius(obj.radius);
      drawObject(obj);
      const inPlay = obj.sy > -obj.radius * 0.5 && obj.sy < STRIP_Y - obj.radius * 0.6;
      if (inPlay && !obj.charged && !obj.used && obj.alive) {
        handleOriginal(grid, elapsed);
      }
    };
  }
  objects.push(obj);
  return obj;
}

function defeatBoss(obj) {
  if (!obj.alive) return;
  obj.alive = false;
  obj.v = curSpeed * 0.3;
  obj.vxOff = obj.u > 0 ? 330 : -330;
  bossDone = true;
  boss = null;
  finishD = Math.max(finishD, dist + 2600);
  nextSpawnD = Math.max(nextSpawnD, dist + CAR_Y + 300);
  addScore(DIFFICULTY.scoreBoss, obj.sx, obj.sy - 100, C.turbo);
  addFloater(W / 2, 420, 'BOSS MACHT PLATZ!', C.turbo);
  burst(obj.sx, obj.sy, C.bossAccent, 50, 600);
  flash = Math.max(flash, 0.6);
  playSound(soundPower, 0.8);
}

function pickWeighted(options) {
  let total = 0;
  options.forEach((o) => (total += o[1]));
  let r = Math.random() * total;
  for (let i = 0; i < options.length; i++) {
    r -= options[i][1];
    if (r <= 0) return options[i][0];
  }
  return options[0][0];
}

function spawnMarshal(d) {
  let side = Math.random() < 0.5 ? -1 : 1;
  for (let i = 0; i < 2; i++) {
    const x = roadCenter(d) + side * 1.15 * ROAD_HALF;
    if (x > 75 && x < W - 75) {
      createObject('marshal', d, side * 1.15);
      return;
    }
    side = -side;
  }
}

function spawnRow(d) {
  const f = levelFeatures(level);
  if (d > finishD - 400 && bossDone) return; // Zieleinlauf frei lassen
  const options = [
    ['turbo', DIFFICULTY.weightTurbo],
    ['repair', DIFFICULTY.weightRepair * (damage > 50 ? 4 : 1)],
    ['marshal', DIFFICULTY.weightMarshal],
  ];
  if (!boss) {
    options.push(['rival', DIFFICULTY.weightRival]);
    options.push(['oil', DIFFICULTY.weightOil]);
    if (f.oncoming) options.push(['oncoming', DIFFICULTY.weightOncoming]);
  }
  const type = pickWeighted(options);
  // linke Spur gehört ab Runde 2 dem Gegenverkehr
  const freeLanes = f.oncoming ? LANES.slice(1) : LANES.slice();
  const lane = () => freeLanes[Math.floor(Math.random() * freeLanes.length)];
  if (type === 'rival') {
    const u = lane();
    createObject('rival', d, u);
    if (level >= DIFFICULTY.doubleRivalFromLevel && Math.random() < 0.35) {
      const others = freeLanes.filter((l) => l !== u);
      createObject('rival', d + 180, others[Math.floor(Math.random() * others.length)]);
    }
  } else if (type === 'oncoming') {
    createObject('oncoming', d + 500, LANES[0]);
  } else if (type === 'oil') {
    createObject('oil', d, -0.75 + Math.random() * 1.5);
  } else if (type === 'marshal') {
    spawnMarshal(d);
  } else {
    createObject(type, d, LANES[Math.floor(Math.random() * LANES.length)]);
  }
}

// --- Zeichnen ---
function drawSprite(ctx, sprite, x, y, angle) {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(angle);
  ctx.drawImage(sprite, -sprite.width / 2, -sprite.height / 2);
  ctx.restore();
}

function drawObject(obj) {
  const ctx = MasterCanvas.get2dContext();
  const x = obj.sx;
  const y = obj.sy;
  if (y < -400 || y > H + 400) return;
  const pulse = Math.sin(time * 5 + obj.seed);
  ctx.save();
  if (obj.type === 'rival') {
    drawSprite(ctx, obj.sprite, x, y, obj.hit ? obj.xOff * 0.01 : Math.sin(time * 2 + obj.seed) * 0.03);
  } else if (obj.type === 'oncoming') {
    drawSprite(ctx, obj.sprite, x, y, Math.PI + (obj.hit ? obj.xOff * 0.01 : 0));
  } else if (obj.type === 'boss') {
    drawSprite(ctx, obj.sprite, x, y, obj.alive ? Math.sin(time * 0.7) * 0.06 : obj.xOff * 0.002);
  } else if (obj.type === 'turbo' || obj.type === 'repair') {
    const main = obj.type === 'turbo' ? C.turbo : C.repair;
    const dark = obj.type === 'turbo' ? C.turboDark : C.repairDark;
    const r = obj.radius * (obj.charged ? 1 + pulse * 0.06 : 1);
    ctx.globalAlpha = obj.used ? 0.25 : 1;
    ctx.fillStyle = obj.charged ? main : dark;
    ctx.globalAlpha *= obj.charged ? 0.55 : 0.35;
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = obj.used ? 0.25 : 1;
    ctx.strokeStyle = main;
    ctx.lineWidth = 12;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    if (obj.type === 'turbo') {
      // drei Pfeile nach vorn, laufen durch
      for (let i = 0; i < 3; i++) {
        const oy = ((i * 34 - time * 60) % 102) + 34;
        ctx.globalAlpha = (obj.used ? 0.25 : 1) * (0.4 + 0.6 * (1 - Math.abs(oy - 34) / 68));
        ctx.beginPath();
        ctx.moveTo(x - 42, y + oy - 20);
        ctx.lineTo(x, y + oy - 56);
        ctx.lineTo(x + 42, y + oy - 20);
        ctx.stroke();
      }
    } else {
      // Kreuz = Reparatur
      ctx.lineWidth = 22;
      ctx.beginPath();
      ctx.moveTo(x - 42, y);
      ctx.lineTo(x + 42, y);
      ctx.moveTo(x, y - 42);
      ctx.lineTo(x, y + 42);
      ctx.stroke();
    }
  } else if (obj.type === 'oil') {
    ctx.fillStyle = C.oil;
    for (let i = 0; i < 5; i++) {
      const a = obj.seed + i * 1.3;
      ctx.beginPath();
      ctx.ellipse(
        x + Math.cos(a) * obj.radius * 0.35,
        y + Math.sin(a) * obj.radius * 0.3,
        obj.radius * 0.6,
        obj.radius * 0.45,
        a,
        0,
        Math.PI * 2
      );
      ctx.fill();
    }
    ctx.strokeStyle = C.oilShine;
    ctx.lineWidth = 6;
    ctx.globalAlpha = 0.6 + pulse * 0.2;
    ctx.beginPath();
    ctx.arc(x - 12, y - 8, obj.radius * 0.4, Math.PI * 1.1, Math.PI * 1.7);
    ctx.stroke();
  } else if (obj.type === 'fire') {
    ctx.fillStyle = C.oil;
    ctx.beginPath();
    ctx.arc(x, y, obj.radius * 0.9, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalCompositeOperation = 'lighter';
    for (let i = 0; i < 7; i++) {
      const a = obj.seed + i * 0.9 + time * (1 + i * 0.2);
      const rr = obj.radius * (0.3 + 0.2 * Math.sin(time * 9 + i * 2));
      ctx.fillStyle = i % 2 ? C.fire : C.fire2;
      ctx.globalAlpha = 0.5;
      ctx.beginPath();
      ctx.arc(x + Math.cos(a) * obj.radius * 0.45, y + Math.sin(a) * obj.radius * 0.4, rr, 0, Math.PI * 2);
      ctx.fill();
    }
  } else if (obj.type === 'marshal') {
    // Streckenposten mit wedelnder Fahne
    ctx.fillStyle = obj.charged ? C.dust : C.marshal;
    ctx.beginPath();
    ctx.arc(x, y, 30, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = C.tire;
    ctx.beginPath();
    ctx.arc(x, y, 14, 0, Math.PI * 2);
    ctx.fill();
    if (!obj.charged) {
      const side = obj.u > 0 ? -1 : 1; // Fahne zeigt zur Strecke
      ctx.translate(x, y);
      ctx.rotate(Math.sin(time * 6 + obj.seed) * 0.5);
      ctx.strokeStyle = C.kerbB;
      ctx.lineWidth = 6;
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.lineTo(side * 70, -30);
      ctx.stroke();
      ctx.fillStyle = C.marshalFlag;
      ctx.fillRect(side > 0 ? 34 : -74, -62, 40, 30);
    }
  }
  ctx.restore();
}

function drawBackground(ctx, d) {
  const off = ((d % H) + H) % H;
  ctx.drawImage(grassTile, 0, off - H);
  ctx.drawImage(grassTile, 0, off);
}

function tracePolyline(ctx, pts, u) {
  ctx.beginPath();
  for (let i = 0; i < pts.length; i++) {
    const x = pts[i].cx + u * ROAD_HALF;
    if (i === 0) ctx.moveTo(x, pts[i].y);
    else ctx.lineTo(x, pts[i].y);
  }
}

function drawRoad(ctx, d, oncoming) {
  const pts = [];
  for (let y = -60; y <= H + 60; y += 60) {
    pts.push({ y, cx: roadCenter(d + (CAR_Y - y)) });
  }
  ctx.save();
  // Asphalt
  ctx.fillStyle = C.road;
  ctx.beginPath();
  for (let i = 0; i < pts.length; i++) {
    if (i === 0) ctx.moveTo(pts[i].cx - ROAD_HALF, pts[i].y);
    else ctx.lineTo(pts[i].cx - ROAD_HALF, pts[i].y);
  }
  for (let i = pts.length - 1; i >= 0; i--) ctx.lineTo(pts[i].cx + ROAD_HALF, pts[i].y);
  ctx.closePath();
  ctx.fill();

  // Randsteine, laufen mit der Strecke
  ctx.lineWidth = 28;
  const dashOff = -(((d % 140) + 140) % 140);
  [-1, 1].forEach((side) => {
    ctx.setLineDash([70, 70]);
    ctx.lineDashOffset = dashOff;
    ctx.strokeStyle = C.kerbA;
    tracePolyline(ctx, pts, side);
    ctx.stroke();
    ctx.lineDashOffset = dashOff + 70;
    ctx.strokeStyle = C.kerbB;
    tracePolyline(ctx, pts, side);
    ctx.stroke();
  });

  // Spurlinien
  ctx.lineWidth = 8;
  ctx.strokeStyle = C.lane;
  ctx.setLineDash([55, 85]);
  ctx.lineDashOffset = dashOff;
  [-0.5, 0, 0.5].forEach((u) => {
    if (oncoming && u === -0.5) return;
    tracePolyline(ctx, pts, u);
    ctx.stroke();
  });
  ctx.setLineDash([]);
  if (oncoming) {
    // durchgezogene Doppellinie zur Gegenspur
    ctx.strokeStyle = C.warn;
    ctx.lineWidth = 6;
    tracePolyline(ctx, pts, -0.515);
    ctx.stroke();
    tracePolyline(ctx, pts, -0.485);
    ctx.stroke();
  }

  // Neon-Kante
  ctx.globalCompositeOperation = 'lighter';
  ctx.strokeStyle = C.neon;
  ctx.shadowColor = C.neon;
  ctx.shadowBlur = 22;
  ctx.lineWidth = 4;
  ctx.globalAlpha = 0.7;
  tracePolyline(ctx, pts, -1.04);
  ctx.stroke();
  tracePolyline(ctx, pts, 1.04);
  ctx.stroke();
  ctx.restore();
}

function drawFinishLine(ctx) {
  const y = CAR_Y - (finishD - dist);
  if (y < -100 || y > H + 100) return;
  const cx = roadCenter(finishD);
  const size = 50;
  ctx.save();
  for (let row = 0; row < 2; row++) {
    for (let i = 0; i < (ROAD_HALF * 2) / size; i++) {
      ctx.fillStyle = (i + row) % 2 ? C.kerbB : C.tire;
      ctx.fillRect(cx - ROAD_HALF + i * size, y - size + row * size, size, size);
    }
  }
  ctx.restore();
}

function drawPlayerCar(ctx) {
  ctx.save();
  // Turbo-Flamme
  if (car.boost > 0) {
    ctx.globalCompositeOperation = 'lighter';
    ctx.fillStyle = C.turbo;
    ctx.globalAlpha = 0.7;
    ctx.beginPath();
    ctx.moveTo(car.x - 22, CAR_Y + 60);
    ctx.lineTo(car.x, CAR_Y + 130 + Math.random() * 60);
    ctx.lineTo(car.x + 22, CAR_Y + 60);
    ctx.fill();
  }
  ctx.restore();
  ctx.save();
  ctx.shadowColor = C.car;
  ctx.shadowBlur = 25;
  drawSprite(ctx, sprites.player, car.x, CAR_Y, car.angle + car.spin * 9);
  ctx.restore();
}

function drawNight(ctx) {
  ctx.save();
  const grad = ctx.createRadialGradient(car.x, CAR_Y - 280, 150, car.x, CAR_Y - 280, 640);
  grad.addColorStop(0, 'rgba(0,0,0,0)');
  grad.addColorStop(1, 'rgba(0,0,0,0.9)');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, W, H);
  // was selbst leuchtet, sieht man auch im Dunkeln
  ctx.globalCompositeOperation = 'lighter';
  objects.forEach((obj) => {
    let color = null;
    if ((obj.type === 'turbo' || obj.type === 'repair') && !obj.used) {
      color = obj.type === 'turbo' ? C.turbo : C.repair;
    } else if (obj.type === 'fire') color = C.fire;
    else if (obj.type === 'boss') color = C.bossAccent;
    else if (obj.type === 'oncoming') color = C.warn;
    if (!color) return;
    ctx.globalAlpha = obj.charged || obj.type !== 'turbo' ? 0.5 : 0.28;
    ctx.strokeStyle = color;
    ctx.lineWidth = 8;
    ctx.beginPath();
    ctx.arc(obj.sx, obj.sy, obj.radius * 0.9, 0, Math.PI * 2);
    ctx.stroke();
  });
  ctx.restore();
}

function drawRain(ctx) {
  ctx.save();
  ctx.strokeStyle = C.lane;
  ctx.globalAlpha = 0.35;
  ctx.lineWidth = 3;
  ctx.beginPath();
  for (let i = 0; i < 70; i++) {
    const x = (i * 197.3 + time * 260 + i * i * 7.1) % W;
    const y = (i * 91.7 + time * 1500) % H;
    ctx.moveTo(x, y);
    ctx.lineTo(x - 10, y + 46);
  }
  ctx.stroke();
  ctx.restore();
}

function drawWarnings(ctx) {
  // Warndreieck für Gegenverkehr, der noch nicht im Bild ist
  ctx.save();
  objects.forEach((obj) => {
    if (obj.type !== 'oncoming' || obj.sy > 0) return;
    const x = roadCenter(dist + CAR_Y) + obj.u * ROAD_HALF;
    ctx.globalAlpha = 0.5 + 0.5 * Math.sin(time * 14);
    ctx.fillStyle = C.warn;
    ctx.beginPath();
    ctx.moveTo(x, 190);
    ctx.lineTo(x - 55, 120);
    ctx.lineTo(x + 55, 120);
    ctx.closePath();
    ctx.fill();
    util.renderText({ ctx, text: '!', x, y: 168, fontSize: '50px', fillStyle: C.tire });
  });
  ctx.restore();
}

function drawSteeringStrip(ctx) {
  const f = turret.hasTarget() ? turret.getFocus() : 0;
  ctx.save();
  const grad = ctx.createLinearGradient(0, STRIP_Y, 0, H);
  grad.addColorStop(0, 'rgba(0,0,0,0.2)');
  grad.addColorStop(1, 'rgba(0,0,0,0.75)');
  ctx.fillStyle = grad;
  ctx.fillRect(0, STRIP_Y, W, H - STRIP_Y);
  ctx.strokeStyle = C.strip;
  ctx.lineWidth = 6;
  ctx.setLineDash([30, 20]);
  ctx.beginPath();
  ctx.moveTo(0, STRIP_Y);
  ctx.lineTo(W, STRIP_Y);
  ctx.stroke();
  ctx.setLineDash([]);
  util.renderText({
    ctx,
    text: '◄  LENKEN: HIER LEUCHTEN  ►',
    x: W / 2,
    y: H - 30,
    fontSize: '44px',
    fillStyle: C.strip,
  });
  if (turret.hasTarget()) {
    const tx = clamp(turret.getTargetX(), 60, W - 60);
    const r = 40 + f * 40;
    ctx.globalCompositeOperation = 'lighter';
    ctx.strokeStyle = C.hud;
    ctx.fillStyle = C.hud;
    ctx.lineWidth = 6;
    ctx.globalAlpha = 0.35;
    ctx.beginPath();
    ctx.moveTo(car.x, CAR_Y + 70);
    ctx.lineTo(tx, STRIP_Y + 80);
    ctx.stroke();
    ctx.globalAlpha = 0.9;
    // Lenkrad
    ctx.beginPath();
    ctx.arc(tx, STRIP_Y + 85, r, 0, Math.PI * 2);
    ctx.stroke();
    ctx.beginPath();
    const a = clamp((tx - car.x) / 300, -1.2, 1.2);
    for (let i = 0; i < 3; i++) {
      const aa = a + Math.PI / 2 + (i * Math.PI * 2) / 3;
      ctx.moveTo(tx, STRIP_Y + 85);
      ctx.lineTo(tx + Math.cos(aa) * r, STRIP_Y + 85 + Math.sin(aa) * r);
    }
    ctx.stroke();
  }
  ctx.restore();
}

function updateAndDrawParticles(ctx, dt, scroll) {
  ctx.save();
  // Reifenspuren
  ctx.fillStyle = C.roadDark;
  marks.slice().forEach((m) => {
    m.y += scroll * dt;
    if (m.y > H + 20) {
      removeItemFromArray(marks, m);
      return;
    }
    ctx.fillRect(m.x - 26, m.y, 12, 22);
    ctx.fillRect(m.x + 14, m.y, 12, 22);
  });
  ctx.globalCompositeOperation = 'lighter';
  particles.slice().forEach((p) => {
    p.life -= dt;
    if (p.life <= 0) {
      removeItemFromArray(particles, p);
      return;
    }
    p.x += p.vx * dt;
    p.y += (p.vy + (p.scroll ? scroll : 0)) * dt;
    ctx.globalAlpha = Math.min(1, p.life / p.maxLife);
    ctx.fillStyle = p.color;
    ctx.fillRect(p.x - p.size / 2, p.y - p.size / 2, p.size, p.size);
  });
  ctx.restore();
}

function drawFloaters(ctx, dt) {
  floaters.slice().forEach((fl) => {
    fl.life -= dt;
    if (fl.life <= 0) {
      removeItemFromArray(floaters, fl);
      return;
    }
    fl.y -= 70 * dt;
    ctx.save();
    ctx.globalAlpha = Math.min(1, fl.life);
    util.renderTextDropShadow({
      ctx,
      text: fl.text,
      x: fl.x,
      y: fl.y,
      fontSize: '50px',
      fillStyle: fl.color,
      dropDistX: 4,
      dropDistY: 4,
    });
    ctx.restore();
  });
}

function drawHud(ctx) {
  const f = levelFeatures(level);
  ctx.save();
  util.renderTextDropShadow({
    ctx,
    text: 'RUNDE ' + level + '/' + DIFFICULTY.maxLevel,
    x: 40,
    y: 64,
    align: 'left',
    fontSize: '46px',
    fillStyle: C.hud,
    dropDistX: 4,
    dropDistY: 4,
  });
  util.renderTextDropShadow({
    ctx,
    text: Math.floor(score) + ' PUNKTE',
    x: W - 40,
    y: 64,
    align: 'right',
    fontSize: '46px',
    fillStyle: C.hud,
    dropDistX: 4,
    dropDistY: 4,
  });
  util.renderTextDropShadow({
    ctx,
    text: Math.round(curSpeed * 0.5) + ' km/h',
    x: W - 40,
    y: 124,
    align: 'right',
    fontSize: '40px',
    fillStyle: car.boost > 0 ? C.turbo : C.text,
    dropDistX: 4,
    dropDistY: 4,
  });

  // Rundenfortschritt
  const bx = 520;
  const bw = 880;
  const progress = clamp(dist / Math.max(1, boss ? f.lapLength / DIFFICULTY.bossAtLapPercent : finishD), 0, 1);
  ctx.fillStyle = 'rgba(0,0,0,0.55)';
  roundRectPath(ctx, bx, 30, bw, 34, 17);
  ctx.fill();
  ctx.fillStyle = boss ? C.bossAccent : C.turbo;
  roundRectPath(ctx, bx, 30, Math.max(34, bw * progress), 34, 17);
  ctx.fill();
  ctx.fillStyle = C.kerbB;
  ctx.fillRect(bx + bw - 10, 22, 10, 50);
  if (boss) {
    util.renderText({
      ctx,
      text: 'ALLE AUF DEN BOSS!',
      x: W / 2,
      y: 118,
      fontSize: '44px',
      fillStyle: C.bossAccent,
    });
  }

  // Schaden
  util.renderTextDropShadow({
    ctx,
    text: 'SCHADEN',
    x: 40,
    y: 124,
    align: 'left',
    fontSize: '40px',
    fillStyle: damage > 70 ? C.fire : C.text,
    dropDistX: 4,
    dropDistY: 4,
  });
  ctx.fillStyle = 'rgba(0,0,0,0.55)';
  roundRectPath(ctx, 250, 94, 240, 32, 16);
  ctx.fill();
  if (damage > 0) {
    ctx.fillStyle = damage > 70 ? C.fire : C.warn;
    roundRectPath(ctx, 250, 94, Math.max(32, 240 * (damage / 100)), 32, 16);
    ctx.fill();
  }
  ctx.restore();
}

// --- Spielablauf ---
function startLevel(lvl) {
  const f = levelFeatures(lvl);
  level = lvl;
  curveAmp = f.curveAmp;
  dist = 0;
  finishD = f.lapLength;
  objects = [];
  marks = [];
  nextSpawnD = CAR_Y + 500;
  boss = null;
  bossDone = !f.boss;
  bossOilTimer = 0;
  curSpeed = f.baseSpeed;
  car.x = roadCenter(0);
  car.vx = 0;
  car.spin = 0;
  car.boost = 0;
  car.slow = 0;
  gameState = 'game';
}

function startGame() {
  score = 0;
  damage = 0;
  won = false;
  stats = { overtakes: 0, turbos: 0, penalties: 0, crashes: 0 };
  particles = [];
  floaters = [];
  shake = 0;
  flash = 0;
  startLevel(1);
  playSound(soundLevel, 0.7);
}

function finishLevel() {
  addScore(DIFFICULTY.scoreLevel * level, W / 2, 500, C.turbo);
  if (level >= DIFFICULTY.maxLevel) {
    won = true;
    endGame();
    return;
  }
  damage = Math.max(0, damage - DIFFICULTY.repairPerLevel);
  gameState = 'levelup';
  levelUpTimer = DIFFICULTY.levelUpDuration;
  flash = 1;
  for (let i = 0; i < 6; i++) {
    burst(200 + Math.random() * (W - 400), 200 + Math.random() * 500, i % 2 ? C.turbo : C.kerbA, 20, 500);
  }
  playSound(soundLevel, 0.8);
}

function endGame() {
  gameState = 'gameover';
  restartButton = createMenuButton(startGame);
  if (!won) {
    burst(car.x, CAR_Y, C.fire, 60, 700);
    burst(car.x, CAR_Y, C.car, 40, 500);
    playSound(soundBoom, 0.9);
  } else {
    playSound(soundPower, 0.9);
  }
}

function createMenuButton(onStart) {
  return guiFillButton({
    label: '',
    posX: W / 2,
    posY: 860,
    radius: 150,
    speedUp: 60,
    speedDown: 25,
    activeValue: 90,
    edges: 8,
    normalColor: C.turboDark,
    growColor: C.turbo,
    activeColor: C.kerbA,
    onEnterActive: () => onStart(),
  });
}

function updateCar(dt, f) {
  car.boost = Math.max(0, car.boost - dt);
  car.slow = Math.max(0, car.slow - dt);
  car.spin = Math.max(0, car.spin - dt);

  let desired = 0;
  if (turret.hasTarget() && car.spin <= 0) {
    const target = clamp(turret.getTargetX(), 70, W - 70);
    const rate =
      DIFFICULTY.steerRateMin + (DIFFICULTY.steerRateMax - DIFFICULTY.steerRateMin) * turret.getFocus();
    desired = clamp((target - car.x) * rate, -DIFFICULTY.maxSideSpeed, DIFFICULTY.maxSideSpeed);
  }
  const grip = f.rain ? DIFFICULTY.gripRain : DIFFICULTY.gripDry;
  car.vx += (desired - car.vx) * Math.min(1, grip * dt);
  car.x = clamp(car.x + car.vx * dt, 60, W - 60);
  car.angle = clamp(car.vx / DIFFICULTY.maxSideSpeed, -1, 1) * 0.45;

  const offroad = Math.abs(car.x - roadCenter(dist)) > ROAD_HALF - 10;
  let target = f.baseSpeed;
  if (car.boost > 0) target *= DIFFICULTY.boostFactor;
  if (offroad) target *= DIFFICULTY.offroadSpeedFactor;
  if (car.slow > 0) target *= DIFFICULTY.crashSpeedFactor;
  curSpeed += (target - curSpeed) * Math.min(1, 3 * dt);

  if (offroad) {
    damage = Math.min(100, damage + DIFFICULTY.damageOffroadPerSecond * dt);
    shake = Math.max(shake, 5);
    if (Math.random() < 0.6) {
      addParticle(car.x + (Math.random() - 0.5) * 60, CAR_Y + 60, (Math.random() - 0.5) * 120, 40, 0.6, C.dust, 10, true);
    }
  }
  // Reifenspuren beim scharfen Lenken, Schleudern und im Gras
  if ((Math.abs(car.vx) > 420 || car.spin > 0 || offroad) && marks.length < 120) {
    marks.push({ x: car.x, y: CAR_Y + 50 });
  }
  if (car.boost > 0 && Math.random() < 0.7) {
    addParticle(
      Math.random() * W,
      -20,
      0,
      900,
      0.9,
      C.lane,
      3 + Math.random() * 3
    );
    addParticle(car.x + (Math.random() - 0.5) * 30, CAR_Y + 80, (Math.random() - 0.5) * 80, 200, 0.4, C.turbo, 8, true);
  }
}

function crashInto(obj, dmg) {
  obj.hit = true;
  obj.vxOff = obj.sx >= car.x ? 420 : -420;
  car.slow = DIFFICULTY.crashSlowDuration;
  car.vx += obj.sx >= car.x ? -260 : 260;
  stats.crashes++;
  addDamage(dmg);
  burst((obj.sx + car.x) / 2, (obj.sy + CAR_Y) / 2, C.spark, 28, 520);
  addFloater(car.x, CAR_Y - 120, 'CRASH!', C.fire);
  playSound(soundStomp, 0.7);
}

function updateObjects(grid, dt) {
  objects.slice().forEach((obj) => {
    if (obj.type === 'boss' && obj.alive) {
      // Boss hält sich vor dem Wagen und pendelt über die Spuren
      obj.entry = Math.min(1, obj.entry + dt * 0.5);
      const bossY = -250 + obj.entry * 560;
      obj.d = dist + (CAR_Y - bossY);
      obj.u = 0.6 * Math.sin(time * 0.7);
      bossOilTimer += dt;
      if (obj.entry >= 1 && bossOilTimer > DIFFICULTY.bossOilInterval) {
        bossOilTimer = 0;
        createObject('oil', obj.d - 230, obj.u);
      }
    } else {
      obj.d += obj.v * dt;
    }
    obj.xOff += obj.vxOff * dt;
    obj.sy = CAR_Y - (obj.d - dist);
    obj.sx = roadCenter(obj.d) + obj.u * ROAD_HALF + obj.xOff;

    if (obj.sy > H + 300 || obj.sx < -400 || obj.sx > W + 400) {
      removeItemFromArray(objects, obj);
      return;
    }

    if (obj.btn) obj.btn.handle(grid, dt);
    else drawObject(obj);

    // Kollision / Einsammeln
    const dx = Math.abs(obj.sx - car.x);
    const dy = Math.abs(obj.sy - CAR_Y);
    if (obj.type === 'rival' || obj.type === 'oncoming') {
      if (!obj.hit && dx < 74 && dy < 120) {
        crashInto(obj, obj.type === 'rival' ? DIFFICULTY.damageRival : DIFFICULTY.damageOncoming);
      } else if (!obj.hit && !obj.counted && obj.sy > CAR_Y + 150) {
        obj.counted = true;
        stats.overtakes++;
        addScore(DIFFICULTY.scoreOvertake, obj.sx, obj.sy - 40, C.kerbA);
      }
    } else if (obj.type === 'turbo' || obj.type === 'repair') {
      if (!obj.used && obj.charged && dx < obj.radius + 40 && dy < obj.radius + 50) {
        obj.used = true;
        if (obj.type === 'turbo') {
          car.boost = DIFFICULTY.boostDuration;
          stats.turbos++;
          addScore(DIFFICULTY.scoreTurbo, car.x, CAR_Y - 130, C.turbo);
          addFloater(car.x, CAR_Y - 190, 'TURBO!', C.turbo);
          burst(car.x, CAR_Y, C.turbo, 30, 520);
        } else {
          damage = Math.max(0, damage - DIFFICULTY.repairAmount);
          addScore(DIFFICULTY.scoreRepair, car.x, CAR_Y - 130, C.repair);
          addFloater(car.x, CAR_Y - 190, 'REPARIERT!', C.repair);
          burst(car.x, CAR_Y, C.repair, 30, 420);
        }
        playSound(soundPower, 0.6);
      }
    } else if (obj.type === 'oil' || obj.type === 'fire') {
      if (!obj.used && dx < obj.radius * 0.8 && dy < obj.radius * 0.8) {
        obj.used = true;
        car.spin = 0.7;
        car.slow = DIFFICULTY.crashSlowDuration;
        addDamage(obj.type === 'fire' ? DIFFICULTY.damageFire : DIFFICULTY.damageOil);
        addFloater(car.x, CAR_Y - 120, obj.type === 'fire' ? 'FEUER!' : 'ÖL!', C.fire);
        burst(car.x, CAR_Y, obj.type === 'fire' ? C.fire : C.oilShine, 20, 380);
        playSound(soundStomp, 0.5);
      }
    }
  });
}

function handleTestKeys() {
  if (keyPressedOnce('Digit1')) {
    objects.forEach((obj) => {
      if ((obj.type === 'turbo' || obj.type === 'repair') && !obj.charged && obj.sy > 0 && obj.sy < STRIP_Y) {
        obj.charged = true;
        burst(obj.sx, obj.sy, C.turbo, 14, 260);
      }
    });
  }
  if (keyPressedOnce('Digit2') && boss) defeatBoss(boss);
  if (keyPressedOnce('KeyL')) {
    objects = [];
    boss = null;
    finishLevel();
  }
}

function applyShake(ctx, dt) {
  shake = Math.max(0, shake - 40 * dt);
  if (shake > 0.5) {
    ctx.translate((Math.random() - 0.5) * shake, (Math.random() - 0.5) * shake);
  }
}

function drawFlash(ctx, dt, color) {
  if (flash <= 0) return;
  ctx.save();
  ctx.globalAlpha = Math.min(0.6, flash * 0.6);
  ctx.fillStyle = color;
  ctx.fillRect(0, 0, W, H);
  ctx.restore();
  flash = Math.max(0, flash - dt * 2);
}

function handleGame(grid, dt) {
  const ctx = MasterCanvas.get2dContext();
  const f = levelFeatures(level);
  time += dt;

  // Lenkung zuerst auswerten (unsichtbar, nur Schwerpunkt im Lenkstreifen)
  turret.handle(grid, dt);
  updateCar(dt, f);

  const step = curSpeed * dt;
  dist += step;
  score += step * DIFFICULTY.scorePerPixel;

  // Boss-Auftritt
  if (!bossDone && !boss && dist > f.lapLength * DIFFICULTY.bossAtLapPercent) {
    boss = createObject('boss', dist + CAR_Y + 300, 0);
    addFloater(W / 2, 420, 'DER BRUMMI BLOCKIERT!', C.bossAccent);
    playSound(soundBoss, 0.8);
  }
  if (boss) finishD = Math.max(finishD, dist + 3000);

  // Nachschub
  while (dist + CAR_Y + 200 >= nextSpawnD) {
    spawnRow(nextSpawnD);
    nextSpawnD += f.spawnGap * (0.8 + Math.random() * 0.4);
  }

  ctx.save();
  applyShake(ctx, dt);
  drawBackground(ctx, dist);
  drawRoad(ctx, dist, f.oncoming);
  if (!boss) drawFinishLine(ctx);
  updateAndDrawParticles(ctx, dt, curSpeed);
  updateObjects(grid, dt);
  drawPlayerCar(ctx);
  if (f.night) drawNight(ctx);
  if (f.rain) drawRain(ctx);
  drawWarnings(ctx);
  ctx.restore();

  drawSteeringStrip(ctx);
  drawFloaters(ctx, dt);
  drawHud(ctx);
  drawFlash(ctx, dt, C.fire);

  handleTestKeys();
  if (gameState !== 'game') return;

  if (damage >= 100) {
    endGame();
  } else if (bossDone && dist >= finishD) {
    finishLevel();
  }
}

function handleLevelUp(grid, dt) {
  const ctx = MasterCanvas.get2dContext();
  time += dt;
  levelUpTimer -= dt;
  dist += curSpeed * 1.5 * dt;
  ctx.save();
  drawBackground(ctx, dist);
  drawRoad(ctx, dist, false);
  updateAndDrawParticles(ctx, dt, curSpeed);
  drawPlayerCar(ctx);
  ctx.restore();
  drawFlash(ctx, dt, C.turbo);
  const zoom = 1 + Math.max(0, levelUpTimer - (DIFFICULTY.levelUpDuration - 0.4)) * 1.5;
  ctx.save();
  ctx.translate(W / 2, 430);
  ctx.scale(zoom, zoom);
  util.renderTextDropShadow({
    ctx,
    text: 'RUNDE ' + (level + 1),
    x: 0,
    y: 0,
    fontSize: '190px',
    fillStyle: C.title,
  });
  ctx.restore();
  util.renderTextDropShadow({
    ctx,
    text: LEVEL_NEWS[level + 1] || '',
    x: W / 2,
    y: 580,
    fontSize: '56px',
    fillStyle: C.kerbA,
    dropDistX: 5,
    dropDistY: 5,
  });
  drawFloaters(ctx, dt);
  if (levelUpTimer <= 0) startLevel(level + 1);
}

function drawMenuBackdrop(ctx, dt) {
  time += dt;
  dist += 300 * dt;
  curveAmp = 170;
  drawBackground(ctx, dist);
  drawRoad(ctx, dist, false);
  car.x = roadCenter(dist) + Math.sin(time * 0.9) * 260;
  car.angle = Math.cos(time * 0.9) * 0.25;
  car.spin = 0;
  updateAndDrawParticles(ctx, dt, 300);
  drawPlayerCar(ctx);
  ctx.save();
  ctx.fillStyle = 'rgba(0,0,0,0.45)';
  ctx.fillRect(0, 0, W, H);
  ctx.restore();
}

function handleStart(grid, dt) {
  const ctx = MasterCanvas.get2dContext();
  drawMenuBackdrop(ctx, dt);
  util.renderTextDropShadow({
    ctx,
    text: 'Laser-Grand-Prix',
    x: W / 2,
    y: 230,
    fontSize: '150px',
    fillStyle: C.title,
  });
  util.renderTextDropShadow({
    ctx,
    text:
      'Unten im Lenkstreifen leuchten = gemeinsam lenken\n' +
      'Turbo-Pfeile aufladen und drüberfahren\n' +
      'Öl und Streckenposten NICHT anleuchten!',
    x: W / 2,
    y: 370,
    lineHeight: 70,
    fontSize: '50px',
    fillStyle: C.text,
    dropDistX: 4,
    dropDistY: 4,
  });
  startButton.handle(grid, dt);
  util.renderTextDropShadow({
    ctx,
    text: 'START',
    x: W / 2,
    y: 880,
    fontSize: '60px',
    fillStyle: C.kerbB,
    dropDistX: 4,
    dropDistY: 4,
  });
  if (keyPressedOnce('Space')) startGame();
}

function handleGameOver(grid, dt) {
  const ctx = MasterCanvas.get2dContext();
  drawMenuBackdrop(ctx, dt);
  drawFlash(ctx, dt, C.fire);
  util.renderTextDropShadow({
    ctx,
    text: won ? 'Zielflagge!' : 'Totalschaden!',
    x: W / 2,
    y: 220,
    fontSize: '150px',
    fillStyle: won ? C.title : C.fire,
  });
  util.renderTextDropShadow({
    ctx,
    text:
      (won ? 'Grand Prix gewonnen – alle ' + DIFFICULTY.maxLevel + ' Runden geschafft!' : 'Ausgeschieden in Runde ' + level + ' von ' + DIFFICULTY.maxLevel) +
      '\n' +
      Math.floor(score) +
      ' Punkte\n' +
      stats.overtakes +
      ' überholt · ' +
      stats.turbos +
      ' Turbos · ' +
      stats.crashes +
      ' Crashs · ' +
      stats.penalties +
      ' Strafen',
    x: W / 2,
    y: 360,
    lineHeight: 80,
    fontSize: '50px',
    fillStyle: C.text,
    dropDistX: 4,
    dropDistY: 4,
  });
  restartButton.handle(grid, dt);
  util.renderTextDropShadow({
    ctx,
    text: 'NOCHMAL',
    x: W / 2,
    y: 880,
    fontSize: '54px',
    fillStyle: C.kerbB,
    dropDistX: 4,
    dropDistY: 4,
  });
  if (gameState === 'gameover' && keyPressedOnce('Space')) startGame();
}

export default {
  name: 'Laser-Grand-Prix',
  description: `

Ihr alle fahrt EINEN Rennwagen. Leuchtet unten in den Lenkstreifen:
der Wagen zieht dorthin, wo die meisten Laser sind. Seid euch einig!

Ladet die Turbo-Pfeile auf der Strecke mit euren Lasern auf und fahrt drüber.
Überholt die Rivalen, weicht Öl und Gegenverkehr aus.

Finger weg von Ölflecken und Streckenposten – wer sie anleuchtet, wird bestraft.
Sechs Runden, jede bringt etwas Neues. 

Ist der Schaden voll, ist das Rennen vorbei.
  `,
  image: 'media/img/gametitles/laser-pong-###4###.png',
  init: function () {
    buildPalette();
    buildSprites();
    gameState = 'start';
    lastTime = 0;
    time = 0;
    level = 1;
    score = 0;
    damage = 0;
    dist = 0;
    curveAmp = 170;
    curSpeed = DIFFICULTY.startSpeed;
    shake = 0;
    flash = 0;
    won = false;
    boss = null;
    bossDone = true;
    objects = [];
    particles = [];
    marks = [];
    floaters = [];
    previousKeys = {};
    stats = { overtakes: 0, turbos: 0, penalties: 0, crashes: 0 };
    car = { x: W / 2, vx: 0, angle: 0, spin: 0, boost: 0, slow: 0 };
    turret = guiAimTurret({
      posX: W / 2,
      posY: CAR_Y,
      scanX: 0,
      scanY: STRIP_Y,
      scanWidth: W,
      scanHeight: H - STRIP_Y,
      focusSpread: DIFFICULTY.focusSpread,
      targetSmoothing: 8,
      fireInterval: 999,
      keyCodes: { left: 'ArrowLeft', right: 'ArrowRight', up: 'none', down: 'none' },
      keySpeed: 1100,
      visible: false,
    });
    startButton = createMenuButton(startGame);
    restartButton = createMenuButton(startGame);
  },
  handle: function (grid, elapsed) {
    const dt = getDelta();
    switch (gameState) {
      case 'start':
        handleStart(grid, dt);
        break;
      case 'game':
        handleGame(grid, dt);
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
    objects = [];
    particles = [];
    marks = [];
    floaters = [];
  },
};
