/**
 * Hydra – Leuchtschlange im Fraktal-Aquarium
 *
 * Eine lange Leuchtschlange mit Julia-Schuppen gleitet ständig vorwärts durch ein dunkles Fraktal-Aquarium.
 *
 * Regeln:
 * - Lenken: Haltet den Laser als „Köder“ VOR die Nase der Schlange. Der Kopf ist ein gui/followCircle-ai2,
 *   der nur als Richtungs-Sensor dient: Er schaut in einem Quadrat knapp vor dem Kopf nach Lasern
 *   (Seitenlänge 2 · sensorRadius · sensorScanFactor) und meldet den Schwerpunkt. Laser weit weg bewirken nichts.
 *   Die Schlange dreht sich mit begrenzter Winkelgeschwindigkeit (DIFFICULTY.turnRate) zum Köder –
 *   so kann niemand sie mit einem Ruck in den eigenen Schwanz reißen.
 * - Ohne Laser schwimmt sie leicht schlängelnd geradeaus, weicht Felsen aus und dreht an Wänden weich ab.
 *   Wände kosten nichts (verzeihend).
 * - Früchte (gui/pixelFillButton, 8-Eck) sind unreif. Leuchtet sie an, bis sie voll sind – je mehr Laser
 *   auf einer Frucht, desto schneller (gedeckelt über fullPercent). Erst REIFE Früchte kann die Schlange
 *   fressen. Reife Früchte verfaulen nach einiger Zeit wieder. → Viele Leute reifen parallel Früchte über
 *   die ganze Fläche, andere lenken die Schlange.
 * - Giftfrüchte (ab Level 2, 4-Eck mit Dreieck, andere Farbe): Anleuchten lässt sie platzen (+Punkte),
 *   fressen kostet Segmente. Ab Level 4 schwimmen sie langsam auf die Köpfe zu.
 * - Korallen-Felsen (ab Level 2): Kopf prallt ab und verliert ein Segment.
 * - Biss in den eigenen Schwanz (ab Segment DIFFICULTY.selfBiteFrom) oder in eine andere Schlange
 *   kostet Segmente. Danach blinkt die Schlange kurz und ist unverwundbar.
 * - Hat ein Kopf keine Segmente mehr, stirbt er. Sind alle Köpfe tot: Game Over.
 * - Wildes Herumleuchten (gui/calmMeter über das ganze Bild) macht die Hydra nervös: sie zittert,
 *   wird schneller und lenkt schlechter – und es gibt Punktabzug.
 * - Level-Ziel: N Früchte fressen. Pro Level schneller, mehr Früchte, kürzere Reifezeit, ab Level 2
 *   Giftfrüchte + Felsen, AB LEVEL 3 HYDRA-TEILUNG: die Schlange teilt sich in zwei Köpfe (zwei getrennte
 *   Schlangen, jede mit eigenem Sensor) – das Publikum muss sich aufteilen. Ab Level 5 drei Köpfe.
 *   Ein verlorener Kopf wächst beim nächsten Level-Up durch Teilung nach.
 *
 * Tastatur (Test ohne Laser):
 * - Leertaste: Start / Neustart
 * - Pfeil links/rechts: Kopf 1 drehen
 * - Q/W: Kopf 2 drehen, O/P: Kopf 3 drehen
 *   (A/D/R/S/F/G/H/M/T/V sind in view.js schon für Debug-Funktionen belegt, deshalb diese Tasten)
 * - 1: alle Früchte sofort reif, 2: alle Giftfrüchte platzen lassen
 * - 9 (gedrückt halten): Wildleuchten simulieren (calmMeter chaosKey)
 * - N: nächstes Level
 *
 * Klassiker: Blockade (Gremlin, 1976), Nibbler (Rock-Ola, 1982), Snake auf dem Nokia 6110 (1997).
 * Anders hier: kein Joystick, sondern ein Köder aus Licht vor der Nase; Früchte müssen erst gemeinsam
 * per Laser reif geleuchtet werden; die Schlange teilt sich wie die Hydra in mehrere Köpfe.
 * Verwandt mit game-029-leuchtturm (followCircle folgt dem Licht) – dort Schiffe, hier ein Körper,
 * der sich selbst im Weg ist.
 *
 * Zukunftsideen:
 * - Teammodus „Tron“: zwei Schlangen, linke vs. rechte Saalhälfte (zoneSplit), wer zuerst beißt, verliert.
 * - Ein-Pixel-Netzspiel: jeder Pixel / jeder Laserfleck eine eigene kleine Schlange (gui/blobTracker,
 *   stabile ids) – Massen-Snake mit tausenden Köpfen.
 */

import util, { getRgbSpreadHex, getRgbSpread, removeItemFromArray } from '../util.js';
import { createKeyEdge, isKeyDown } from './gui/gridScan.js';
import soundEat from '../../../public/media/369952__mischy__plop-1.wav';
import soundHit from '../../../public/media/414346__bykgames__explosion-far.wav';
import soundSplit from '../../../public/media/517267__foolboymedia__cinematic-stomp.wav';
import soundBurst from '../../../public/media/opengameart/Item Pickup.ogg';
import soundRipe from '../../../public/media/opengameart/Menu Move.ogg';
import soundLevelUp from '../../../public/media/opengameart/Level Up.ogg';
import soundGameOver from '../../../public/media/opengameart/Music Box Game Over III.wav';
var laserConfig = require('../LaserApiConfig.js').default;
var MasterCanvas = require('../MasterCanvas').default;
var guiFillButton = require('./gui/fillButton-ai2').default;
var guiFollowCircle = require('./gui/followCircle-ai2').default;
var guiPixelFillButton = require('./gui/pixelFillButton').default;
var guiCalmMeter = require('./gui/calmMeter').default;
var createHighscore = require('../util/highscore').default;

const W = 1920;
const H = 1080;

const DIFFICULTY = {
  // Schlange
  startLength: 10,
  segSpacing: 26, // Abstand der Segmente in px
  headRadius: 42,
  segRadius: 30,
  segRadiusMin: 12,
  maxSegments: 70, // pro Schlange (Performance + Kollision)
  speedStart: 150, // px/s
  speedPerLevel: 16,
  speedCap: 290,
  turnRate: 1.9, // rad/s, maximale Drehung zum Köder (Wendekreis ≈ speed / turnRate, Dauerkreisen beißt nicht)
  turnRateKeys: 2.0, // rad/s mit Pfeiltasten
  turnRateWall: 3.2, // rad/s, weiches Abdrehen an Wänden
  wallMargin: 150,
  wiggleAmp: 0.5, // Schlängeln ohne Laser (rad/s)
  wiggleFreq: 1.4,
  // Sensor (followCircle-ai2 als Richtungs-Sensor)
  sensorRadius: 60,
  sensorScanFactor: 4.2, // Scan-Quadrat: halbe Seitenlänge = 60 · 4.2 = 252 px
  sensorForward: 120, // Scan-Mitte liegt so weit VOR dem Kopf
  sensorFollowRate: 0.35, // followCircle speedUp (Glättung des Schwerpunkts)
  sensorReleaseRate: 0.25,
  baitMinDist: 35, // Köder näher am Kopf wird ignoriert
  // Unruhe (calmMeter)
  chaosThreshold: 0.55,
  chaosHoldTime: 0.6,
  nervousFrom: 0.3, // ab dieser Unruhe wird die Hydra nervös …
  nervousFull: 0.7, // … bis hier voll nervös
  chaosTurnFactor: 0.5, // Wendekreis bei voller Nervosität (Anteil von turnRate)
  chaosSpeedFactor: 1.3,
  chaosJitter: 2.5,
  chaosPenalty: 5, // Punkte · Level
  // Früchte
  fruitRadius: 62,
  fruitsStart: 4,
  fruitsPerLevel: 1,
  fruitsCap: 8,
  fruitSpeedUp: 70, // pixelFillButton: Füllung/s bei voller Abdeckung
  fruitSpeedDown: 8,
  fruitFullPercent: 20, // ab diesem Flächenanteil volle Reifegeschwindigkeit (Teamwork gedeckelt)
  fruitActiveValue: 92,
  rotTimeStart: 16, // s bis eine reife Frucht verfault
  rotTimePerLevel: -1,
  rotTimeMin: 8,
  fruitRespawnDelay: 1.2,
  growPerFruit: 2,
  eatFactor: 0.6, // Anteil des Fruchtradius für "gefressen"
  // Level-Ziel
  goalStart: 5,
  goalPerLevel: 2,
  // Giftfrüchte
  poisonStartLevel: 2,
  poisonStart: 1,
  poisonPerLevel: 1,
  poisonCap: 4,
  poisonRadius: 58,
  poisonSpeedUp: 90,
  poisonFullPercent: 15,
  poisonRespawnDelay: 4,
  poisonDriftLevel: 4,
  poisonDriftSpeed: 30,
  poisonLoss: 3,
  // Felsen
  rocksStartLevel: 2,
  rocksStart: 2,
  rocksPerLevel: 1,
  rocksCap: 6,
  rockRadiusMin: 60,
  rockRadiusRandom: 50,
  rockLoss: 1,
  // Bisse
  selfBiteFrom: 6,
  selfBiteLoss: 3,
  selfBiteFactor: 0.5, // Anteil der Radien, der beim Selbstbiss zählt (gnädig: nur echtes Überkreuzen)
  otherBiteLoss: 1,
  invulnTime: 1.6,
  // Hydra-Teilung
  twoHeadsLevel: 3,
  threeHeadsLevel: 5,
  minSplitLength: 6,
  minHeadLength: 6, // nach der Teilung wächst jeder Kopf mindestens auf so viele Segmente nach
  // Ablauf / Punkte
  levelUpTime: 2.8,
  splitAt: 1.1,
  gameOverButtonDelay: 1.5,
  pointsFruit: 10, // · Level
  pointsPoison: 5, // · Level
  pointsLevel: 50, // · Level
  maxParticles: 400,
};

// Farbtöne (Hue-Shift zur Laserfarbe, nur 0.25 … 0.75)
const HUES = {
  snakes: [0.42, 0.6, 0.5],
  fruit: 0.3,
  poison: 0.72,
  rock: 0.36,
  water: 0.52,
  hud: 0.45,
};

// Tasten pro Kopf (KeyboardEvent.code)
const HEAD_KEYS = [
  { left: 'ArrowLeft', right: 'ArrowRight' },
  { left: 'KeyQ', right: 'KeyW' },
  { left: 'KeyO', right: 'KeyP' },
];

var highscore = createHighscore('Hydra', 'punkte');

var STATS = {};
var gameState = 'start';
var level = 1;
var score = 0;
var time = 0;
var stateTime = 0;
var eatenThisLevel = 0;
var snakes = [];
var demoSnake = null;
var fruits = [];
var rocks = [];
var particles = [];
var floatingTexts = [];
var motes = [];
var activeSounds = [];
var startButton = null;
var calm = null;
var fruitSpawnTimer = 0;
var poisonSpawnTimer = 0;
var shake = 0;
var flash = 0;
var splitDone = false;
var bubbleTimer = 0;
var lastTime = 0;
var keyEdge = createKeyEdge();
var assets = null;
var assetsKey = '';

/* ------------------------------------------------------------------ Hilfsfunktionen */

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

function clampHue(h) {
  return Math.max(0.25, Math.min(0.75, h));
}

function col(hue, sat, val) {
  return getRgbSpreadHex(laserConfig.testColor, clampHue(hue), sat, val);
}

function clamp(v, a, b) {
  return Math.max(a, Math.min(b, v));
}

function wrapAngle(a) {
  while (a > Math.PI) a -= Math.PI * 2;
  while (a < -Math.PI) a += Math.PI * 2;
  return a;
}

function turnToward(current, target, maxStep) {
  const diff = wrapAngle(target - current);
  return current + clamp(diff, -maxStep, maxStep);
}

function levelValue(start, perLevel, cap, fromLevel) {
  const steps = level - (fromLevel || 1);
  if (steps < 0) return 0;
  return Math.min(cap, start + perLevel * steps);
}

function currentSpeed() {
  return levelValue(DIFFICULTY.speedStart, DIFFICULTY.speedPerLevel, DIFFICULTY.speedCap);
}

function levelGoal() {
  return DIFFICULTY.goalStart + DIFFICULTY.goalPerLevel * (level - 1);
}

function fruitTarget() {
  return levelValue(DIFFICULTY.fruitsStart, DIFFICULTY.fruitsPerLevel, DIFFICULTY.fruitsCap);
}

function poisonTarget() {
  return levelValue(DIFFICULTY.poisonStart, DIFFICULTY.poisonPerLevel, DIFFICULTY.poisonCap, DIFFICULTY.poisonStartLevel);
}

function rockTarget() {
  return levelValue(DIFFICULTY.rocksStart, DIFFICULTY.rocksPerLevel, DIFFICULTY.rocksCap, DIFFICULTY.rocksStartLevel);
}

function rotTime() {
  return Math.max(DIFFICULTY.rotTimeMin, DIFFICULTY.rotTimeStart + DIFFICULTY.rotTimePerLevel * (level - 1));
}

function headsForLevel(l) {
  if (l >= DIFFICULTY.threeHeadsLevel) return 3;
  if (l >= DIFFICULTY.twoHeadsLevel) return 2;
  return 1;
}

function segRadius(i, n) {
  const t = n > 1 ? i / (n - 1) : 0;
  return Math.max(DIFFICULTY.segRadiusMin, DIFFICULTY.segRadius * (1 - 0.55 * t));
}

function totalLength() {
  var sum = 0;
  snakes.forEach((s) => {
    sum += s.body.length;
  });
  return sum;
}

function playSound(src, volume) {
  try {
    const audio = new Audio(src);
    audio.volume = volume === undefined ? 1 : volume;
    activeSounds.push(audio);
    audio.onended = () => removeItemFromArray(activeSounds, audio);
    const p = audio.play();
    if (p && p.catch) p.catch(() => {});
  } catch (e) {
    // Sound ist nur Kür
  }
}

function stopSounds() {
  activeSounds.forEach((a) => a.pause());
  activeSounds = [];
}

/* ------------------------------------------------------------------ Vorrendern (Fraktale) */

/** Farbtabelle für Fraktal-Sprites: dunkel, nur aus der Laserfarbe abgeleitet */
function makePalette(hue, hueSpread, sat, valMin, valMax, insideVal) {
  const steps = [];
  for (let i = 0; i <= 32; i++) {
    const t = i / 32;
    steps.push(
      getRgbSpread(
        laserConfig.testColor,
        clampHue(hue + hueSpread * Math.sin(t * 9)),
        sat,
        valMin + (valMax - valMin) * Math.pow(t, 0.7)
      )
    );
  }
  return { steps, inside: getRgbSpread(laserConfig.testColor, clampHue(hue), sat, insideVal) };
}

/** Julia-Menge in ein Offscreen-Canvas rendern; roundMask = kreisrunde, weich ausgeblendete Kante */
function renderJulia(w, h, cr, ci, zoom, maxIter, pal, roundMask) {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  const g = c.getContext('2d');
  const img = g.createImageData(w, h);
  const d = img.data;
  const aspect = w / h;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      let zr = (x / w - 0.5) * zoom * aspect;
      let zi = (y / h - 0.5) * zoom;
      let i = 0;
      let m = zr * zr + zi * zi;
      while (m <= 16 && i < maxIter) {
        const t = zr * zr - zi * zi + cr;
        zi = 2 * zr * zi + ci;
        zr = t;
        m = zr * zr + zi * zi;
        i++;
      }
      let rgb;
      if (i >= maxIter) {
        rgb = pal.inside;
      } else {
        const smooth = clamp(i + 1 - Math.log(Math.log(Math.sqrt(m))) / Math.LN2, 0, maxIter);
        rgb = pal.steps[Math.floor((smooth / maxIter) * 32)];
      }
      let a = 255;
      if (roundMask) {
        const rx = x / w - 0.5;
        const ry = y / h - 0.5;
        const rr = Math.sqrt(rx * rx + ry * ry) * 2;
        a = rr >= 1 ? 0 : rr > 0.8 ? ((1 - rr) / 0.2) * 255 : 255;
      }
      const idx = (y * w + x) * 4;
      d[idx] = rgb[0];
      d[idx + 1] = rgb[1];
      d[idx + 2] = rgb[2];
      d[idx + 3] = a;
    }
  }
  g.putImageData(img, 0, 0);
  return c;
}

function ensureAssets() {
  const key = String(laserConfig.testColor);
  if (assets && assetsKey === key) return;
  assetsKey = key;

  // Hintergrund: sehr dunkle Julia-Menge, etwas größer als das Bild (Parallax-Drift)
  const small = renderJulia(500, 285, -0.7269, 0.1889, 3.4, 48, makePalette(HUES.water, 0.08, 0.7, 0.02, 0.2, 0.03), false);
  const bg = document.createElement('canvas');
  bg.width = W + 100;
  bg.height = H + 60;
  const bgc = bg.getContext('2d');
  bgc.imageSmoothingEnabled = true;
  bgc.drawImage(small, 0, 0, bg.width, bg.height);
  const vignette = bgc.createRadialGradient(bg.width / 2, bg.height / 2, 200, bg.width / 2, bg.height / 2, bg.width * 0.62);
  vignette.addColorStop(0, 'rgba(0,0,0,0)');
  vignette.addColorStop(1, 'rgba(0,0,0,0.85)');
  bgc.fillStyle = vignette;
  bgc.fillRect(0, 0, bg.width, bg.height);

  assets = {
    bg,
    scales: HUES.snakes.map((hue) =>
      renderJulia(64, 64, -0.4, 0.6, 3.0, 40, makePalette(hue, 0.06, 0.75, 0.08, 0.55, 0.12), true)
    ),
    fruits: [
      renderJulia(128, 128, -0.123, 0.745, 3.0, 48, makePalette(HUES.fruit, 0.05, 0.8, 0.05, 0.4, 0.1), true),
      renderJulia(128, 128, 0.285, 0.01, 3.0, 48, makePalette(HUES.fruit, 0.05, 0.8, 0.05, 0.4, 0.1), true),
      renderJulia(128, 128, -0.8, 0.156, 3.0, 48, makePalette(HUES.fruit, 0.05, 0.8, 0.05, 0.4, 0.1), true),
    ],
    poison: renderJulia(128, 128, 0.355, 0.355, 3.0, 48, makePalette(HUES.poison, 0.03, 0.85, 0.05, 0.45, 0.08), true),
    rocks: [
      renderJulia(256, 256, -0.835, -0.2321, 3.0, 48, makePalette(HUES.rock, 0.06, 0.45, 0.03, 0.3, 0.06), true),
      renderJulia(256, 256, -0.7, 0.27015, 3.0, 48, makePalette(HUES.rock, 0.06, 0.45, 0.03, 0.3, 0.06), true),
    ],
  };
}

function createMotes() {
  motes = [];
  for (let i = 0; i < 80; i++) {
    motes.push({
      x: Math.random() * W,
      y: Math.random() * H,
      z: 0.3 + Math.random() * 0.7,
      r: 1 + Math.random() * 2.5,
      phase: Math.random() * 10,
    });
  }
}

/* ------------------------------------------------------------------ Partikel & Texte */

function addParticle(p) {
  if (particles.length >= DIFFICULTY.maxParticles) particles.shift();
  particles.push(p);
}

function burst(x, y, hue, count, speed, size) {
  for (let i = 0; i < count; i++) {
    const a = Math.random() * Math.PI * 2;
    const v = speed * (0.3 + Math.random() * 0.7);
    addParticle({
      type: 'dot',
      x,
      y,
      vx: Math.cos(a) * v,
      vy: Math.sin(a) * v,
      life: 0,
      max: 0.5 + Math.random() * 0.6,
      size: size * (0.5 + Math.random()),
      color: col(hue + (Math.random() - 0.5) * 0.06, 0.7, 0.9),
    });
  }
}

function ring(x, y, hue, maxR) {
  addParticle({ type: 'ring', x, y, vx: 0, vy: 0, life: 0, max: 0.6, size: maxR, color: col(hue, 0.6, 0.9) });
}

function bubble(x, y) {
  addParticle({
    type: 'bubble',
    x,
    y,
    vx: (Math.random() - 0.5) * 20,
    vy: -40 - Math.random() * 40,
    life: 0,
    max: 1.5 + Math.random() * 1.5,
    size: 3 + Math.random() * 6,
    color: col(HUES.water, 0.4, 0.55),
  });
}

function addText(text, x, y, hue, size) {
  floatingTexts.push({ text, x, y, t: 0, dur: 1.4, color: col(hue, 0.6, 0.95), size: size || 45 });
}

function updateAndDrawParticles(ctx, dt) {
  ctx.save();
  particles.slice().forEach((p) => {
    p.life += dt;
    if (p.life >= p.max) {
      removeItemFromArray(particles, p);
      return;
    }
    const k = 1 - p.life / p.max;
    p.x += p.vx * dt;
    p.y += p.vy * dt;
    if (p.type === 'dot') {
      p.vx *= Math.pow(0.15, dt);
      p.vy *= Math.pow(0.15, dt);
      ctx.globalCompositeOperation = 'lighter';
      ctx.globalAlpha = k;
      ctx.fillStyle = p.color;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.size * (0.4 + 0.6 * k), 0, Math.PI * 2);
      ctx.fill();
    } else if (p.type === 'ring') {
      ctx.globalCompositeOperation = 'source-over';
      ctx.globalAlpha = k;
      ctx.strokeStyle = p.color;
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.size * (1 - k * 0.8), 0, Math.PI * 2);
      ctx.stroke();
    } else {
      // Blase
      p.x += Math.sin(time * 3 + p.size) * 10 * dt;
      ctx.globalCompositeOperation = 'source-over';
      ctx.globalAlpha = Math.min(1, k * 2) * 0.7;
      ctx.strokeStyle = p.color;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
      ctx.stroke();
    }
  });
  ctx.restore();

  floatingTexts.slice().forEach((t) => {
    t.t += dt;
    if (t.t >= t.dur) {
      removeItemFromArray(floatingTexts, t);
      return;
    }
    ctx.save();
    ctx.globalAlpha = 1 - t.t / t.dur;
    util.renderTextDropShadow({
      ctx,
      text: t.text,
      fontSize: t.size + 'px',
      dropDistX: 3,
      dropDistY: 3,
      fillStyle: t.color,
      x: t.x,
      y: t.y - t.t * 70,
    });
    ctx.restore();
  });
}

/* ------------------------------------------------------------------ Hintergrund */

function drawBackground(ctx, dt) {
  ensureAssets();
  const ox = -50 + Math.sin(time * 0.05) * 45;
  const oy = -30 + Math.cos(time * 0.04) * 25;
  ctx.drawImage(assets.bg, ox, oy);

  // Schwebeteilchen in zwei Tiefen (Parallax)
  ctx.save();
  for (let layer = 0; layer < 2; layer++) {
    ctx.fillStyle = col(HUES.water, 0.4, layer === 0 ? 0.3 : 0.5);
    ctx.globalAlpha = layer === 0 ? 0.5 : 0.7;
    ctx.beginPath();
    motes.forEach((m) => {
      if ((m.z > 0.65 ? 1 : 0) !== layer) return;
      m.x += (6 + Math.sin(time * 0.3 + m.phase) * 10) * m.z * dt;
      m.y -= 12 * m.z * dt;
      if (m.x > W + 10) m.x = -10;
      if (m.y < -10) {
        m.y = H + 10;
        m.x = Math.random() * W;
      }
      const r = m.r * m.z;
      ctx.moveTo(m.x + r, m.y);
      ctx.arc(m.x, m.y, r, 0, Math.PI * 2);
    });
    ctx.fill();
  }
  ctx.restore();
}

/* ------------------------------------------------------------------ Schlange */

function createSensor(s) {
  const D = DIFFICULTY;
  const sensor = guiFollowCircle({
    label: '',
    posX: s.x,
    posY: s.y,
    radius: D.sensorRadius,
    scanRadiusFactor: D.sensorScanFactor,
    speedUp: D.sensorFollowRate,
    speedDown: D.sensorReleaseRate,
    followTrueOrRepellFalse: true,
    visible: false,
  });
  // Handle-Wrapping: followCircle nur als Richtungs-Sensor nutzen.
  // Scan-Mitte vor die Nase setzen, Komponente rechnen lassen, aus ihrer geglätteten Geschwindigkeit
  // (= Lage des Laser-Schwerpunkts im Scan-Quadrat, -0.5 … 0.5) den Köderpunkt zurückrechnen,
  // danach Position zurücksetzen – bewegt wird nur durch die Schlangenlogik.
  const handleOriginal = sensor.handle;
  sensor.handle = (grid, elapsed) => {
    const fx = s.x + Math.cos(s.angle) * D.sensorForward;
    const fy = s.y + Math.sin(s.angle) * D.sensorForward;
    sensor.setX(fx);
    sensor.setY(fy);
    handleOriginal(grid, elapsed);
    const scanR = sensor.getRadius() * sensor.getScanRadiusFactor();
    s.steering = sensor.hasInput();
    if (s.steering) {
      s.baitX = fx + sensor.getSpeedX() * 2 * scanR;
      s.baitY = fy + sensor.getSpeedY() * 2 * scanR;
    }
    sensor.setX(s.x);
    sensor.setY(s.y);
  };
  return sensor;
}

function createSnake(x, y, angle, length, index, bodyPoints) {
  const s = {
    x,
    y,
    angle,
    index,
    body: [],
    invuln: 0,
    phase: Math.random() * 10,
    steering: false,
    baitX: x,
    baitY: y,
    mouth: 0,
    lookX: Math.cos(angle),
    lookY: Math.sin(angle),
    bubbleTimer: Math.random(),
    sensor: null,
  };
  if (bodyPoints) {
    s.body = bodyPoints;
  } else {
    for (let i = 0; i < length; i++) {
      s.body.push({
        x: x - Math.cos(angle) * DIFFICULTY.segSpacing * (i + 1),
        y: y - Math.sin(angle) * DIFFICULTY.segSpacing * (i + 1),
      });
    }
  }
  s.sensor = createSensor(s);
  return s;
}

function avoidRocks(s, turn, dt) {
  const hx = Math.cos(s.angle);
  const hy = Math.sin(s.angle);
  const lx = s.x + hx * 150;
  const ly = s.y + hy * 150;
  rocks.forEach((r) => {
    const dx = lx - r.x;
    const dy = ly - r.y;
    const rr = r.r + DIFFICULTY.headRadius + 20;
    if (dx * dx + dy * dy < rr * rr) {
      const cross = hx * (r.y - s.y) - hy * (r.x - s.x);
      s.angle += (cross > 0 ? -1 : 1) * turn * 1.2 * dt;
    }
  });
}

/**
 * Bewegt eine Schlange. opts: { grid, allowLaser, useKeys, autoTarget {x,y}, nervous 0..1, speed }
 */
function updateSnake(s, dt, opts) {
  const D = DIFFICULTY;
  if (opts.allowLaser) {
    s.sensor.handle(opts.grid, dt);
  } else {
    s.steering = false;
  }
  const nervous = opts.nervous || 0;
  const turn = D.turnRate * (1 - (1 - D.chaosTurnFactor) * nervous);

  let keyTurn = 0;
  if (opts.useKeys) {
    const keys = HEAD_KEYS[s.index % HEAD_KEYS.length];
    if (isKeyDown(keys.left)) keyTurn -= 1;
    if (isKeyDown(keys.right)) keyTurn += 1;
  }

  const startAngle = s.angle;
  let desired = null;
  if (keyTurn !== 0) {
    s.angle += keyTurn * D.turnRateKeys * dt;
  } else if (s.steering) {
    const dx = s.baitX - s.x;
    const dy = s.baitY - s.y;
    if (dx * dx + dy * dy > D.baitMinDist * D.baitMinDist) desired = Math.atan2(dy, dx);
  } else if (opts.autoTarget) {
    desired = Math.atan2(opts.autoTarget.y - s.y, opts.autoTarget.x - s.x);
  } else {
    s.angle += Math.sin(time * D.wiggleFreq + s.phase) * D.wiggleAmp * dt;
  }
  if (desired !== null) s.angle = turnToward(s.angle, desired, turn * dt);
  if (!s.steering && keyTurn === 0) avoidRocks(s, turn, dt);

  // Wände: weich abdrehen
  const m = D.wallMargin;
  let ax = 0;
  let ay = 0;
  if (s.x < m) ax = (m - s.x) / m;
  else if (s.x > W - m) ax = -(s.x - (W - m)) / m;
  if (s.y < m) ay = (m - s.y) / m;
  else if (s.y > H - m) ay = -(s.y - (H - m)) / m;
  if (ax !== 0 || ay !== 0) {
    const hx = Math.cos(s.angle);
    const hy = Math.sin(s.angle);
    if (hx * ax + hy * ay < 0.2) {
      const strength = Math.min(1, Math.sqrt(ax * ax + ay * ay));
      s.angle = turnToward(s.angle, Math.atan2(ay, ax), D.turnRateWall * strength * dt);
    }
  }

  // Gesamtdrehung pro Frame deckeln (Köder + Wand + Felsen addieren sich sonst zu einem zu engen Wendekreis)
  const maxTurn = D.turnRateWall * dt;
  s.angle = startAngle + clamp(wrapAngle(s.angle - startAngle), -maxTurn, maxTurn);

  // Nervosität: Zittern
  if (nervous > 0) s.angle += (Math.random() - 0.5) * D.chaosJitter * nervous * dt * 4;
  s.angle = wrapAngle(s.angle);

  const speed = opts.speed * (1 + (D.chaosSpeedFactor - 1) * nervous);
  s.x += Math.cos(s.angle) * speed * dt;
  s.y += Math.sin(s.angle) * speed * dt;

  // harter Rand: abprallen
  const r = D.headRadius;
  if (s.x < r) {
    s.x = r;
    if (Math.cos(s.angle) < 0) s.angle = Math.PI - s.angle;
  } else if (s.x > W - r) {
    s.x = W - r;
    if (Math.cos(s.angle) > 0) s.angle = Math.PI - s.angle;
  }
  if (s.y < r) {
    s.y = r;
    if (Math.sin(s.angle) < 0) s.angle = -s.angle;
  } else if (s.y > H - r) {
    s.y = H - r;
    if (Math.sin(s.angle) > 0) s.angle = -s.angle;
  }

  followBody(s);

  // Blickrichtung + Maul (öffnet sich vor reifen Früchten)
  let lx = Math.cos(s.angle);
  let ly = Math.sin(s.angle);
  if (s.steering) {
    const dx = s.baitX - s.x;
    const dy = s.baitY - s.y;
    const d = Math.sqrt(dx * dx + dy * dy) || 1;
    lx = dx / d;
    ly = dy / d;
  }
  s.lookX += (lx - s.lookX) * Math.min(1, dt * 8);
  s.lookY += (ly - s.lookY) * Math.min(1, dt * 8);
  let near = 0;
  fruits.forEach((f) => {
    if (f.kind !== 'fruit' || !f.ripe) return;
    const dx = f.x - s.x;
    const dy = f.y - s.y;
    if (dx * dx + dy * dy < 220 * 220) near = 1;
  });
  s.mouth += (near - s.mouth) * Math.min(1, dt * 6);

  s.invuln = Math.max(0, s.invuln - dt);
  s.bubbleTimer -= dt;
  if (s.bubbleTimer <= 0) {
    s.bubbleTimer = 0.35 + Math.random() * 0.5;
    bubble(s.x + (Math.random() - 0.5) * 30, s.y + (Math.random() - 0.5) * 30);
  }
}

/** Glieder folgen dem Vorgänger mit festem Höchstabstand (Follow-the-Leader) */
function followBody(s) {
  const sp = DIFFICULTY.segSpacing;
  let px = s.x;
  let py = s.y;
  for (let i = 0; i < s.body.length; i++) {
    const seg = s.body[i];
    const dx = seg.x - px;
    const dy = seg.y - py;
    const d = Math.sqrt(dx * dx + dy * dy);
    if (d > sp) {
      seg.x = px + (dx / d) * sp;
      seg.y = py + (dy / d) * sp;
    }
    px = seg.x;
    py = seg.y;
  }
}

function growSnake(s, n) {
  for (let k = 0; k < n; k++) {
    if (s.body.length >= DIFFICULTY.maxSegments) return;
    const last = s.body.length ? s.body[s.body.length - 1] : { x: s.x, y: s.y };
    s.body.push({ x: last.x, y: last.y });
  }
  const len = s.body.length + 1;
  if (len > STATS.maxLength) STATS.maxLength = len;
}

function hurtSnake(s, loss, text) {
  for (let k = 0; k < loss && s.body.length > 0; k++) {
    const p = s.body.pop();
    burst(p.x, p.y, HUES.snakes[s.index % 3], 6, 220, 7);
  }
  s.invuln = DIFFICULTY.invulnTime;
  shake = Math.max(shake, 20);
  addText(text + ' -' + loss, s.x, s.y - 60, HUES.poison, 45);
  playSound(soundHit, 0.6);
  STATS.segmentsLost += loss;
  if (s.body.length === 0) killSnake(s);
}

function killSnake(s) {
  burst(s.x, s.y, HUES.snakes[s.index % 3], 40, 420, 10);
  ring(s.x, s.y, HUES.snakes[s.index % 3], 200);
  removeItemFromArray(snakes, s);
  STATS.headsLost++;
  shake = 30;
  if (snakes.length === 0) gameOver();
}

function drawSnake(ctx, s, nervous) {
  ensureAssets();
  const hue = HUES.snakes[s.index % 3];
  const rim = col(hue, 0.7, 0.85);
  const dark = col(hue, 0.6, 0.08);
  const n = s.body.length;
  const jit = nervous * 5;
  const blink = s.invuln > 0 && Math.floor(s.invuln * 10) % 2 === 0;

  // Positionen inkl. Zittern einmal berechnen
  const pts = [];
  for (let i = 0; i < n; i++) {
    const p = s.body[i];
    pts.push({
      x: p.x + (jit ? Math.sin(time * 37 + i * 1.7) * jit : 0),
      y: p.y + (jit ? Math.cos(time * 41 + i * 2.3) * jit : 0),
      r: segRadius(i, n),
    });
  }

  ctx.save();
  ctx.globalAlpha = blink ? 0.35 : 1;

  // 1) Kontur mit Glow: ein Pfad, ein Schatten
  ctx.shadowColor = rim;
  ctx.shadowBlur = 18;
  ctx.fillStyle = rim;
  ctx.beginPath();
  for (let i = n - 1; i >= 0; i--) {
    const p = pts[i];
    ctx.moveTo(p.x + p.r + 4, p.y);
    ctx.arc(p.x, p.y, p.r + 4, 0, Math.PI * 2);
  }
  ctx.moveTo(s.x + DIFFICULTY.headRadius + 5, s.y);
  ctx.arc(s.x, s.y, DIFFICULTY.headRadius + 5, 0, Math.PI * 2);
  ctx.fill();
  ctx.shadowBlur = 0;

  // 2) dunkle Füllung (bleibt Laser-tauglich dunkel)
  ctx.fillStyle = dark;
  ctx.beginPath();
  for (let i = n - 1; i >= 0; i--) {
    const p = pts[i];
    ctx.moveTo(p.x + p.r, p.y);
    ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
  }
  ctx.fill();

  // 3) Julia-Schuppen mit Shimmer-Welle
  const sprite = assets.scales[s.index % 3];
  const baseAlpha = blink ? 0.35 : 1;
  for (let i = n - 1; i >= 0; i--) {
    const p = pts[i];
    ctx.globalAlpha = baseAlpha * (0.35 + 0.3 * Math.sin(time * 5 - i * 0.45));
    ctx.drawImage(sprite, p.x - p.r * 0.9, p.y - p.r * 0.9, p.r * 1.8, p.r * 1.8);
  }

  // 4) Kopf: gefüllt, aber nicht grell
  const hr = DIFFICULTY.headRadius;
  ctx.globalAlpha = baseAlpha;
  ctx.fillStyle = col(hue, 0.65, 0.3);
  ctx.beginPath();
  ctx.arc(s.x, s.y, hr, 0, Math.PI * 2);
  ctx.fill();
  ctx.globalAlpha = baseAlpha * 0.6;
  ctx.drawImage(sprite, s.x - hr, s.y - hr, hr * 2, hr * 2);
  ctx.globalAlpha = baseAlpha;

  // Maul
  if (s.mouth > 0.05) {
    const open = 0.55 * s.mouth;
    ctx.fillStyle = col(hue, 0.6, 0.04);
    ctx.beginPath();
    ctx.moveTo(s.x, s.y);
    ctx.arc(s.x, s.y, hr + 2, s.angle - open, s.angle + open);
    ctx.closePath();
    ctx.fill();
  }

  // Augen, Pupillen schauen zum Köder
  for (let side = -1; side <= 1; side += 2) {
    const ea = s.angle + side * 0.75;
    const ex = s.x + Math.cos(ea) * hr * 0.55;
    const ey = s.y + Math.sin(ea) * hr * 0.55;
    ctx.fillStyle = col(hue, 0.3, 0.05);
    ctx.beginPath();
    ctx.arc(ex, ey, 10, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = col(hue + 0.08, 0.3, 0.9);
    ctx.beginPath();
    ctx.arc(ex + s.lookX * 4, ey + s.lookY * 4, 4.5, 0, Math.PI * 2);
    ctx.fill();
  }

  // Hinweis „hier Köder hinhalten“: dünner Bogen vor der Nase, solange niemand lenkt
  if (!s.steering) {
    const fx = s.x + Math.cos(s.angle) * DIFFICULTY.sensorForward;
    const fy = s.y + Math.sin(s.angle) * DIFFICULTY.sensorForward;
    ctx.globalAlpha = 0.25 + 0.15 * Math.sin(time * 3 + s.phase);
    ctx.strokeStyle = col(hue, 0.5, 0.6);
    ctx.lineWidth = 2;
    ctx.setLineDash([10, 14]);
    ctx.beginPath();
    ctx.arc(fx, fy, 70, 0, Math.PI * 2);
    ctx.stroke();
    ctx.setLineDash([]);
  }
  ctx.restore();
}

/* ------------------------------------------------------------------ Früchte, Gift, Felsen */

function findFreeSpot(r) {
  let best = null;
  let bestClear = -Infinity;
  for (let k = 0; k < 40; k++) {
    const x = 140 + r + Math.random() * (W - 280 - 2 * r);
    const y = 180 + r + Math.random() * (H - 280 - 2 * r);
    let clear = Infinity;
    rocks.forEach((o) => {
      clear = Math.min(clear, Math.hypot(o.x - x, o.y - y) - o.r - r);
    });
    fruits.forEach((o) => {
      clear = Math.min(clear, Math.hypot(o.x - x, o.y - y) - o.r - r);
    });
    snakes.forEach((s) => {
      clear = Math.min(clear, Math.hypot(s.x - x, s.y - y) - 220 - r);
    });
    if (clear > 40) return { x, y };
    if (clear > bestClear) {
      bestClear = clear;
      best = { x, y };
    }
  }
  return best;
}

function createFruit(kind) {
  const D = DIFFICULTY;
  const isFruit = kind === 'fruit';
  const r = isFruit ? D.fruitRadius : D.poisonRadius;
  const spot = findFreeSpot(r);
  const hue = isFruit ? HUES.fruit : HUES.poison;
  const f = {
    kind,
    x: spot.x,
    y: spot.y,
    r,
    ripe: false,
    ripeTime: 0,
    born: 0,
    spin: (Math.random() - 0.5) * 0.6,
    phase: Math.random() * 10,
    sprite: isFruit ? assets.fruits[Math.floor(Math.random() * assets.fruits.length)] : assets.poison,
    btn: null,
  };
  f.btn = guiPixelFillButton({
    label: '',
    posX: f.x,
    posY: f.y,
    radius: r,
    edges: isFruit ? 8 : 4,
    edges2: isFruit ? undefined : 3,
    angle: Math.random() * Math.PI,
    lineWidth: 4,
    speedUp: isFruit ? D.fruitSpeedUp : D.poisonSpeedUp,
    speedDown: D.fruitSpeedDown,
    fullPercent: isFruit ? D.fruitFullPercent : D.poisonFullPercent,
    activeValue: D.fruitActiveValue,
    minValue: 20,
    normalColor: col(hue, 0.6, 0.55),
    growColor: col(hue, 0.7, 0.75),
    activeColor: col(hue - 0.02, 0.8, 0.95),
    onEnterActive: () => {
      if (isFruit) ripenFruit(f);
      else burstPoison(f);
    },
  });

  const handleOriginal = f.btn.handle;
  f.btn.handle = (grid, dt) => {
    const ctx = MasterCanvas.get2dContext();
    f.born = Math.min(1, f.born + dt * 2.5);

    // Giftfrüchte treiben (ab poisonDriftLevel zum nächsten Kopf)
    if (!isFruit) {
      let vx = Math.sin(time * 0.7 + f.phase) * 12;
      let vy = Math.cos(time * 0.5 + f.phase) * 12;
      if (level >= D.poisonDriftLevel && snakes.length) {
        let best = null;
        let bd = Infinity;
        snakes.forEach((s) => {
          const d = (s.x - f.x) * (s.x - f.x) + (s.y - f.y) * (s.y - f.y);
          if (d < bd) {
            bd = d;
            best = s;
          }
        });
        const d = Math.sqrt(bd) || 1;
        vx += ((best.x - f.x) / d) * D.poisonDriftSpeed;
        vy += ((best.y - f.y) / d) * D.poisonDriftSpeed;
      }
      f.x = clamp(f.x + vx * dt, 140 + f.r, W - 140 - f.r);
      f.y = clamp(f.y + vy * dt, 180 + f.r, H - 100 - f.r);
      f.btn.setX(f.x);
      f.btn.setY(f.y);
    }

    const rr = f.r * (0.3 + 0.7 * f.born);
    f.btn.setRadius(rr);
    f.btn.setAngle(f.btn.getAngle() + f.spin * dt);

    // Reife Frucht bleibt voll, bis sie verfault
    if (f.ripe) {
      f.ripeTime += dt;
      f.btn.setValue(100);
      if (f.ripeTime >= rotTime()) {
        f.ripe = false;
        f.ripeTime = 0;
        f.btn.setValue(0);
        STATS.rotten++;
        burst(f.x, f.y, HUES.rock, 10, 120, 6);
        addText('verfault', f.x, f.y - 40, HUES.rock, 36);
      }
    }

    // dunkler Körper mit Fraktal (Laser-Fläche bleibt dunkel)
    const pulse = f.ripe ? 1 + 0.06 * Math.sin(time * 6 + f.phase) : 1;
    ctx.save();
    ctx.fillStyle = col(isFruit ? HUES.fruit : HUES.poison, 0.6, 0.06);
    ctx.beginPath();
    ctx.arc(f.x, f.y, rr * pulse, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = f.ripe ? 0.9 : 0.6;
    ctx.translate(f.x, f.y);
    ctx.rotate(time * f.spin);
    ctx.drawImage(f.sprite, -rr * pulse, -rr * pulse, rr * 2 * pulse, rr * 2 * pulse);
    ctx.restore();

    handleOriginal(grid, dt);

    if (f.ripe) {
      // heller Rand mit Glow + Restzeit-Bogen
      const left = 1 - f.ripeTime / rotTime();
      ctx.save();
      ctx.strokeStyle = col(HUES.fruit, 0.8, 0.95);
      ctx.shadowColor = ctx.strokeStyle;
      ctx.shadowBlur = 16;
      ctx.lineWidth = 5;
      ctx.beginPath();
      ctx.arc(f.x, f.y, rr * pulse + 12, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * left);
      ctx.stroke();
      ctx.restore();
    }
  };
  return f;
}

function ripenFruit(f) {
  if (f.ripe) return;
  f.ripe = true;
  f.ripeTime = 0;
  STATS.ripened++;
  ring(f.x, f.y, HUES.fruit, f.r + 40);
  burst(f.x, f.y, HUES.fruit, 10, 160, 5);
  addText('reif!', f.x, f.y - f.r - 10, HUES.fruit, 38);
  playSound(soundRipe, 0.5);
}

function burstPoison(f) {
  if (fruits.indexOf(f) < 0) return;
  removeItemFromArray(fruits, f);
  const pts = DIFFICULTY.pointsPoison * level;
  score += pts;
  STATS.poisonBurst++;
  burst(f.x, f.y, HUES.poison, 24, 320, 8);
  ring(f.x, f.y, HUES.poison, f.r + 60);
  addText('+' + pts, f.x, f.y, HUES.poison, 45);
  playSound(soundBurst, 0.6);
  poisonSpawnTimer = DIFFICULTY.poisonRespawnDelay;
}

function eatFruit(s, f) {
  removeItemFromArray(fruits, f);
  const pts = DIFFICULTY.pointsFruit * level;
  score += pts;
  STATS.fruitsEaten++;
  eatenThisLevel++;
  growSnake(s, DIFFICULTY.growPerFruit);
  burst(f.x, f.y, HUES.fruit, 18, 260, 7);
  ring(f.x, f.y, HUES.fruit, f.r + 30);
  addText('+' + pts, f.x, f.y - 20, HUES.fruit, 50);
  playSound(soundEat, 0.8);
  fruitSpawnTimer = DIFFICULTY.fruitRespawnDelay;
  if (eatenThisLevel >= levelGoal()) startLevelUp();
}

function createRocks() {
  rocks = [];
  const count = rockTarget();
  for (let k = 0; k < count; k++) {
    const r = DIFFICULTY.rockRadiusMin + Math.random() * DIFFICULTY.rockRadiusRandom;
    let spot = null;
    for (let t = 0; t < 40 && !spot; t++) {
      const x = 220 + r + Math.random() * (W - 440 - 2 * r);
      const y = 220 + r + Math.random() * (H - 380 - 2 * r);
      let ok = true;
      rocks.forEach((o) => {
        if (Math.hypot(o.x - x, o.y - y) < o.r + r + 140) ok = false;
      });
      snakes.forEach((s) => {
        if (Math.hypot(s.x - x, s.y - y) < r + 320) ok = false;
        s.body.forEach((p) => {
          if (Math.hypot(p.x - x, p.y - y) < r + 60) ok = false;
        });
      });
      if (ok) spot = { x, y };
    }
    if (spot) {
      rocks.push({
        x: spot.x,
        y: spot.y,
        r,
        born: 0,
        sprite: assets.rocks[k % assets.rocks.length],
        rot: Math.random() * Math.PI * 2,
        edges: 7 + Math.floor(Math.random() * 4),
      });
    }
  }
}

function drawRocks(ctx, dt) {
  rocks.forEach((r) => {
    r.born = Math.min(1, r.born + dt * 1.5);
    const rr = r.r * r.born;
    ctx.save();
    ctx.translate(r.x, r.y);
    ctx.rotate(r.rot + Math.sin(time * 0.3 + r.rot) * 0.05);
    // zackiger Korallenumriss
    ctx.beginPath();
    for (let i = 0; i <= r.edges * 2; i++) {
      const a = (i / (r.edges * 2)) * Math.PI * 2;
      const rad = rr * (i % 2 === 0 ? 1.08 : 0.9);
      if (i === 0) ctx.moveTo(Math.cos(a) * rad, Math.sin(a) * rad);
      else ctx.lineTo(Math.cos(a) * rad, Math.sin(a) * rad);
    }
    ctx.closePath();
    ctx.fillStyle = col(HUES.rock, 0.4, 0.07);
    ctx.fill();
    ctx.strokeStyle = col(HUES.rock, 0.45, 0.55);
    ctx.lineWidth = 4;
    ctx.stroke();
    ctx.globalAlpha = 0.85;
    ctx.drawImage(r.sprite, -rr, -rr, rr * 2, rr * 2);
    ctx.restore();
  });
}

/* ------------------------------------------------------------------ Kollisionen */

function checkCollisions(s) {
  const D = DIFFICULTY;
  const hr = D.headRadius;

  // Felsen: immer abprallen, Schaden nur ohne Unverwundbarkeit
  for (let k = 0; k < rocks.length; k++) {
    const r = rocks[k];
    const dx = s.x - r.x;
    const dy = s.y - r.y;
    const minD = r.r + hr * 0.8;
    if (dx * dx + dy * dy < minD * minD) {
      const d = Math.sqrt(dx * dx + dy * dy) || 1;
      const nx = dx / d;
      const ny = dy / d;
      s.x = r.x + nx * (minD + 1);
      s.y = r.y + ny * (minD + 1);
      let hx = Math.cos(s.angle);
      let hy = Math.sin(s.angle);
      const dot = hx * nx + hy * ny;
      if (dot < 0) {
        hx -= 2 * dot * nx;
        hy -= 2 * dot * ny;
        s.angle = Math.atan2(hy, hx);
      }
      if (s.invuln <= 0) {
        STATS.rockHits++;
        hurtSnake(s, D.rockLoss, 'Autsch!');
        if (snakes.indexOf(s) < 0) return;
      }
    }
  }

  // Früchte fressen / Gift
  const list = fruits.slice();
  for (let k = 0; k < list.length; k++) {
    const f = list[k];
    const dx = f.x - s.x;
    const dy = f.y - s.y;
    const d2 = dx * dx + dy * dy;
    if (f.kind === 'fruit') {
      const eatD = hr + f.r * D.eatFactor;
      if (f.ripe && d2 < eatD * eatD) {
        eatFruit(s, f);
        if (gameState !== 'play') return;
      }
    } else if (s.invuln <= 0) {
      const hitD = hr * 0.8 + f.r * D.eatFactor;
      if (d2 < hitD * hitD) {
        removeItemFromArray(fruits, f);
        STATS.poisonEaten++;
        burst(f.x, f.y, HUES.poison, 16, 240, 7);
        poisonSpawnTimer = D.poisonRespawnDelay;
        hurtSnake(s, D.poisonLoss, 'Gift!');
        if (snakes.indexOf(s) < 0) return;
      }
    }
  }

  if (s.invuln > 0) return;

  // eigener Schwanz (Abstand², ab Segment selfBiteFrom)
  const n = s.body.length;
  for (let i = D.selfBiteFrom; i < n; i++) {
    const p = s.body[i];
    const rr = (hr + segRadius(i, n)) * D.selfBiteFactor;
    const dx = p.x - s.x;
    const dy = p.y - s.y;
    if (dx * dx + dy * dy < rr * rr) {
      STATS.selfBites++;
      hurtSnake(s, D.selfBiteLoss, 'Biss!');
      return;
    }
  }

  // andere Schlangen
  for (let k = 0; k < snakes.length; k++) {
    const o = snakes[k];
    if (o === s) continue;
    const on = o.body.length;
    for (let i = -1; i < on; i++) {
      const px = i < 0 ? o.x : o.body[i].x;
      const py = i < 0 ? o.y : o.body[i].y;
      const pr = i < 0 ? hr : segRadius(i, on);
      const rr = hr * 0.6 + pr * 0.6;
      const dx = px - s.x;
      const dy = py - s.y;
      if (dx * dx + dy * dy < rr * rr) {
        STATS.otherBites++;
        hurtSnake(s, D.otherBiteLoss, 'Zusammenstoß!');
        return;
      }
    }
  }
}

/* ------------------------------------------------------------------ Ablauf */

function createStartButton(label) {
  return guiFillButton({
    label,
    posX: W / 2,
    posY: 840,
    radius: 115,
    edges: 8,
    edges2: 5,
    lineWidth: 5,
    speedUp: 40,
    speedDown: 25,
    normalColor: col(0.45, 0.7, 0.6),
    growColor: col(0.5, 0.8, 0.8),
    activeColor: col(0.55, 0.9, 1),
    onEnterActive: () => startGame(),
  });
}

function resetStats() {
  STATS = {
    fruitsEaten: 0,
    ripened: 0,
    rotten: 0,
    poisonBurst: 0,
    poisonEaten: 0,
    selfBites: 0,
    otherBites: 0,
    rockHits: 0,
    segmentsLost: 0,
    headsLost: 0,
    splits: 0,
    chaosCount: 0,
    maxLength: DIFFICULTY.startLength + 1,
    time: 0,
  };
}

function createCalmMeter() {
  return guiCalmMeter({
    chaosThreshold: DIFFICULTY.chaosThreshold,
    chaosHoldTime: DIFFICULTY.chaosHoldTime,
    chaosKey: 'Digit9',
    visible: false,
    onChaos: () => {
      if (gameState !== 'play') return;
      STATS.chaosCount++;
      const pen = DIFFICULTY.chaosPenalty * level;
      score = Math.max(0, score - pen);
      shake = Math.max(shake, 10);
      addText('Unruhe! -' + pen, W / 2, 260, HUES.poison, 50);
    },
  });
}

function startGame() {
  ensureAssets();
  resetStats();
  level = 1;
  score = 0;
  stateTime = 0;
  particles = [];
  floatingTexts = [];
  fruits = [];
  rocks = [];
  shake = 0;
  flash = 0.6;
  snakes = [createSnake(W / 2 - 300, H / 2 + 80, -0.2, DIFFICULTY.startLength, 0)];
  calm = createCalmMeter();
  setupLevel();
  gameState = 'play';
  playSound(soundLevelUp, 0.5);
}

function setupLevel() {
  eatenThisLevel = 0;
  fruits = [];
  createRocks();
  for (let i = 0; i < fruitTarget(); i++) fruits.push(createFruit('fruit'));
  for (let i = 0; i < poisonTarget(); i++) fruits.push(createFruit('poison'));
  fruitSpawnTimer = 0;
  poisonSpawnTimer = DIFFICULTY.poisonRespawnDelay;
  if (calm) calm.reset();
}

function startLevelUp() {
  score += DIFFICULTY.pointsLevel * level;
  addText('Level geschafft! +' + DIFFICULTY.pointsLevel * level, W / 2, 330, HUES.hud, 60);
  level++;
  eatenThisLevel = 0;
  gameState = 'levelup';
  stateTime = 0;
  splitDone = false;
  flash = 1;
  fruits.slice().forEach((f) => {
    burst(f.x, f.y, f.kind === 'fruit' ? HUES.fruit : HUES.poison, 8, 180, 6);
  });
  fruits = [];
  rocks.forEach((r) => burst(r.x, r.y, HUES.rock, 10, 200, 8));
  rocks = [];
  snakes.forEach((s) => {
    s.invuln = DIFFICULTY.levelUpTime + 1.5;
  });
  playSound(soundLevelUp, 0.8);
}

/** Hydra-Teilung: längste Schlange in der Mitte durchtrennen, bis genug Köpfe da sind */
function doSplits() {
  const want = headsForLevel(level);
  let guard = 0;
  while (snakes.length < want && snakes.length > 0 && guard++ < 5) {
    let s = snakes[0];
    snakes.forEach((o) => {
      if (o.body.length > s.body.length) s = o;
    });
    if (s.body.length < DIFFICULTY.minSplitLength) growSnake(s, DIFFICULTY.minSplitLength - s.body.length);
    const mid = Math.floor(s.body.length / 2);
    const cut = s.body[mid];
    const next = s.body[mid + 1] || { x: cut.x - Math.cos(s.angle), y: cut.y - Math.sin(s.angle) };
    const rest = s.body.slice(mid + 1);
    s.body = s.body.slice(0, mid);
    // freien Farb-/Tasten-Index suchen
    let index = 0;
    while (snakes.some((o) => o.index === index)) index++;
    const angle = Math.atan2(cut.y - next.y, cut.x - next.x) + (Math.random() - 0.5) * 1.6;
    const ns = createSnake(cut.x, cut.y, angle, 0, index, rest);
    // Hydra-Regel: abgetrennte Köpfe wachsen nach
    if (s.body.length < DIFFICULTY.minHeadLength) growSnake(s, DIFFICULTY.minHeadLength - s.body.length);
    if (ns.body.length < DIFFICULTY.minHeadLength) growSnake(ns, DIFFICULTY.minHeadLength - ns.body.length);
    ns.invuln = s.invuln;
    snakes.push(ns);
    STATS.splits++;
    burst(cut.x, cut.y, HUES.snakes[index % 3], 40, 380, 9);
    ring(cut.x, cut.y, HUES.snakes[index % 3], 220);
    addText('HYDRA!', cut.x, cut.y - 70, HUES.snakes[index % 3], 70);
    shake = 25;
    playSound(soundSplit, 0.8);
  }
}

function gameOver() {
  gameState = 'gameover';
  stateTime = 0;
  highscore.addEntry({ punkte: score, level: level, laenge: STATS.maxLength });
  startButton = createStartButton('NOCHMAL');
  playSound(soundGameOver, 0.8);
}

function levelNews(l) {
  if (l === DIFFICULTY.twoHeadsLevel) return 'HYDRA-TEILUNG! Zwei Köpfe – teilt euch auf!';
  if (l === DIFFICULTY.threeHeadsLevel) return 'Drei Köpfe! Jede Gruppe lenkt einen.';
  if (l === DIFFICULTY.poisonStartLevel) return 'Giftfrüchte: anleuchten lässt sie platzen – nicht fressen!';
  if (l === DIFFICULTY.poisonDriftLevel) return 'Die Giftfrüchte jagen jetzt die Köpfe!';
  return 'Schneller, mehr Früchte, kürzere Reifezeit!';
}

/* ------------------------------------------------------------------ HUD */

function drawHud(ctx) {
  const hudColor = col(HUES.hud, 0.6, 0.85);
  util.renderTextDropShadow({
    ctx,
    text: 'Level ' + level,
    fontSize: '46px',
    align: 'left',
    dropDistX: 4,
    dropDistY: 4,
    fillStyle: hudColor,
    x: 40,
    y: 70,
  });
  util.renderTextDropShadow({
    ctx,
    text: 'Punkte ' + score,
    fontSize: '46px',
    align: 'left',
    dropDistX: 4,
    dropDistY: 4,
    fillStyle: hudColor,
    x: 330,
    y: 70,
  });

  // Level-Fortschritt
  const goal = levelGoal();
  util.renderTextDropShadow({
    ctx,
    text: 'Früchte ' + Math.min(eatenThisLevel, goal) + ' / ' + goal,
    fontSize: '42px',
    dropDistX: 4,
    dropDistY: 4,
    fillStyle: col(HUES.fruit, 0.7, 0.9),
    x: W / 2 + 120,
    y: 62,
  });
  ctx.save();
  const bw = 420;
  const bx = W / 2 + 120 - bw / 2;
  ctx.fillStyle = col(HUES.fruit, 0.5, 0.15);
  ctx.fillRect(bx, 80, bw, 14);
  ctx.fillStyle = col(HUES.fruit, 0.8, 0.8);
  ctx.fillRect(bx, 80, bw * Math.min(1, eatenThisLevel / goal), 14);
  ctx.restore();

  util.renderTextDropShadow({
    ctx,
    text: 'Länge ' + totalLength() + (snakes.length > 1 ? '  (' + snakes.length + ' Köpfe)' : ''),
    fontSize: '46px',
    align: 'right',
    dropDistX: 4,
    dropDistY: 4,
    fillStyle: hudColor,
    x: W - 40,
    y: 70,
  });

  // Unruhe-Balken
  if (calm) {
    const c = calm.getChaos();
    ctx.save();
    const ux = W - 340;
    ctx.fillStyle = col(HUES.hud, 0.4, 0.15);
    ctx.fillRect(ux, 88, 300, 12);
    ctx.fillStyle = c > DIFFICULTY.chaosThreshold ? col(HUES.poison, 0.9, 0.95) : col(HUES.water, 0.6, 0.7);
    ctx.fillRect(ux, 88, 300 * c, 12);
    ctx.restore();
    util.renderText({
      ctx,
      text: 'Unruhe',
      fontSize: '22px',
      align: 'right',
      fillStyle: col(HUES.hud, 0.4, 0.6),
      x: ux - 12,
      y: 100,
    });
    if (calm.isChaotic() && Math.floor(time * 4) % 2 === 0) {
      util.renderTextDropShadow({
        ctx,
        text: 'Ruhig leuchten! Die Hydra wird nervös!',
        fontSize: '50px',
        dropDistX: 4,
        dropDistY: 4,
        fillStyle: col(HUES.poison, 0.8, 0.95),
        x: W / 2,
        y: 180,
      });
    }
  }
}

function drawFlash(ctx, dt) {
  if (flash <= 0) return;
  ctx.save();
  ctx.globalAlpha = flash * 0.35;
  ctx.fillStyle = col(HUES.water, 0.6, 0.6);
  ctx.fillRect(0, 0, W, H);
  ctx.restore();
  flash = Math.max(0, flash - dt * 1.5);
}

function drawTitle(ctx, y, size) {
  const letters = 'HYDRA';
  const step = size * 0.85;
  ctx.save();
  for (let i = 0; i < letters.length; i++) {
    const hue = 0.45 + 0.12 * Math.sin(time * 0.8 + i * 0.7);
    ctx.shadowColor = col(hue, 0.8, 0.8);
    ctx.shadowBlur = 25;
    util.renderTextDropShadow({
      ctx,
      text: letters[i],
      fontSize: size + 'px',
      dropDistX: 6,
      dropDistY: 6,
      fillStyle: col(hue, 0.7, 0.9),
      x: W / 2 + (i - 2) * step,
      y: y + Math.sin(time * 2.2 + i * 0.9) * 14,
    });
  }
  ctx.restore();
}

/* ------------------------------------------------------------------ Zustände */

function handleStart(grid, dt) {
  const ctx = MasterCanvas.get2dContext();
  drawBackground(ctx, dt);

  // Demo-Schlange: folgt Lasern in ihrer Nähe, sonst einer Lissajous-Bahn
  if (!demoSnake) demoSnake = createSnake(400, 600, 0, 18, 0);
  updateSnake(demoSnake, dt, {
    grid,
    allowLaser: true,
    useKeys: true,
    autoTarget: { x: W / 2 + Math.sin(time * 0.35) * 700, y: H / 2 + 60 + Math.sin(time * 0.6) * 320 },
    nervous: 0,
    speed: 170,
  });
  drawSnake(ctx, demoSnake, 0);
  updateAndDrawParticles(ctx, dt);

  drawTitle(ctx, 210, 150);
  util.renderTextDropShadow({
    ctx,
    text:
      'Haltet euren Laser als Köder VOR die Nase der Schlange.\n' +
      'Leuchtet Früchte reif – erst reife Früchte darf sie fressen.\n' +
      'Giftfrüchte platzen lassen, nicht in den Schwanz beißen, nicht wild leuchten!',
    fontSize: '40px',
    lineHeight: 58,
    dropDistX: 4,
    dropDistY: 4,
    fillStyle: col(0.5, 0.5, 0.85),
    x: W / 2,
    y: 340,
  });

  // dunkle Fläche unter dem Startknopf
  ctx.save();
  ctx.fillStyle = col(0.5, 0.6, 0.05);
  ctx.beginPath();
  ctx.arc(W / 2, 840, 130, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
  if (!startButton) startButton = createStartButton('START');
  startButton.handle(grid, dt);
  util.renderText({
    ctx,
    text: 'Hier hineinleuchten zum Starten (oder Leertaste)',
    fontSize: '30px',
    fillStyle: col(0.5, 0.4, 0.65),
    x: W / 2,
    y: 1010,
  });
  if (keyEdge('Space')) startGame();
}

function handlePlay(grid, dt) {
  const ctx = MasterCanvas.get2dContext();
  STATS.time += dt;

  // Tastatur-Testmodus
  if (keyEdge('Digit1')) {
    fruits.forEach((f) => {
      if (f.kind === 'fruit' && !f.ripe) f.btn.setValue(100);
    });
  }
  if (keyEdge('Digit2')) {
    fruits.slice().forEach((f) => {
      if (f.kind === 'poison') burstPoison(f);
    });
  }
  if (keyEdge('KeyN')) {
    startLevelUp();
    return;
  }

  calm.handle(grid, dt);
  const c = calm.getChaos();
  const nervous = clamp((c - DIFFICULTY.nervousFrom) / (DIFFICULTY.nervousFull - DIFFICULTY.nervousFrom), 0, 1);

  // Nachschub
  let fruitCount = 0;
  let poisonCount = 0;
  fruits.forEach((f) => {
    if (f.kind === 'fruit') fruitCount++;
    else poisonCount++;
  });
  fruitSpawnTimer -= dt;
  if (fruitCount < fruitTarget() && fruitSpawnTimer <= 0) {
    fruits.push(createFruit('fruit'));
    fruitSpawnTimer = DIFFICULTY.fruitRespawnDelay;
  }
  poisonSpawnTimer -= dt;
  if (poisonCount < poisonTarget() && poisonSpawnTimer <= 0) {
    fruits.push(createFruit('poison'));
    poisonSpawnTimer = DIFFICULTY.poisonRespawnDelay;
  }

  drawBackground(ctx, dt);
  ctx.save();
  if (shake > 0.5) ctx.translate((Math.random() - 0.5) * shake, (Math.random() - 0.5) * shake);
  shake *= Math.pow(0.02, dt);

  drawRocks(ctx, dt);
  fruits.slice().forEach((f) => f.btn.handle(grid, dt));

  const speed = currentSpeed();
  snakes.slice().forEach((s) => {
    if (gameState !== 'play' || snakes.indexOf(s) < 0) return;
    updateSnake(s, dt, { grid, allowLaser: true, useKeys: true, nervous, speed });
    checkCollisions(s);
  });
  snakes.forEach((s) => drawSnake(ctx, s, nervous));
  updateAndDrawParticles(ctx, dt);
  ctx.restore();

  drawFlash(ctx, dt);
  drawHud(ctx);
}

function handleLevelUp(grid, dt) {
  const ctx = MasterCanvas.get2dContext();
  stateTime += dt;
  drawBackground(ctx, dt);
  ctx.save();
  if (shake > 0.5) ctx.translate((Math.random() - 0.5) * shake, (Math.random() - 0.5) * shake);
  shake *= Math.pow(0.02, dt);

  if (!splitDone && stateTime >= DIFFICULTY.splitAt) {
    splitDone = true;
    doSplits();
  }
  const speed = currentSpeed() * 0.8;
  snakes.forEach((s) => {
    updateSnake(s, dt, { grid, allowLaser: false, useKeys: false, nervous: 0, speed });
  });
  snakes.forEach((s) => drawSnake(ctx, s, 0));
  updateAndDrawParticles(ctx, dt);
  ctx.restore();
  drawFlash(ctx, dt);

  const zoom = 1 + 0.15 * Math.max(0, 1 - stateTime * 2);
  ctx.save();
  ctx.translate(W / 2, 420);
  ctx.scale(zoom, zoom);
  ctx.shadowColor = col(HUES.hud, 0.8, 0.9);
  ctx.shadowBlur = 30;
  util.renderTextDropShadow({
    ctx,
    text: 'LEVEL ' + level,
    fontSize: '150px',
    dropDistX: 8,
    dropDistY: 8,
    fillStyle: col(HUES.hud + 0.05 * Math.sin(time * 4), 0.7, 0.95),
    x: 0,
    y: 0,
  });
  ctx.restore();
  util.renderTextDropShadow({
    ctx,
    text: levelNews(level),
    fontSize: '48px',
    dropDistX: 4,
    dropDistY: 4,
    fillStyle: col(HUES.fruit, 0.6, 0.9),
    x: W / 2,
    y: 540,
  });
  drawHud(ctx);

  if (stateTime >= DIFFICULTY.levelUpTime) {
    setupLevel();
    gameState = 'play';
  }
}

function handleGameOver(grid, dt) {
  const ctx = MasterCanvas.get2dContext();
  stateTime += dt;
  drawBackground(ctx, dt);
  ctx.save();
  if (shake > 0.5) ctx.translate((Math.random() - 0.5) * shake, (Math.random() - 0.5) * shake);
  shake *= Math.pow(0.02, dt);
  drawRocks(ctx, dt);
  updateAndDrawParticles(ctx, dt);
  ctx.restore();

  drawTitle(ctx, 170, 150);
  util.renderTextDropShadow({
    ctx,
    text: 'Die Hydra ist erschöpft!',
    fontSize: '50px',
    dropDistX: 4,
    dropDistY: 4,
    fillStyle: col(HUES.poison, 0.6, 0.9),
    x: W / 2,
    y: 270,
  });
  const minutes = Math.floor(STATS.time / 60);
  const seconds = Math.floor(STATS.time % 60);
  util.renderTextDropShadow({
    ctx,
    text:
      'Level ' + level + '   ·   ' + score + ' Punkte   ·   längste Schlange ' + STATS.maxLength + '\n' +
      STATS.fruitsEaten + ' Früchte gefressen, ' + STATS.ripened + ' reif geleuchtet, ' + STATS.rotten + ' verfault\n' +
      STATS.poisonBurst + ' Giftfrüchte geplatzt, ' + STATS.poisonEaten + ' gefressen   ·   ' + STATS.splits + ' Teilungen\n' +
      STATS.selfBites + ' Selbstbisse, ' + STATS.otherBites + ' Zusammenstöße, ' + STATS.rockHits + ' Felsen   ·   ' +
      STATS.chaosCount + 'x Unruhe\n' +
      'Spielzeit ' + minutes + ':' + (seconds < 10 ? '0' : '') + seconds,
    fontSize: '36px',
    lineHeight: 52,
    dropDistX: 3,
    dropDistY: 3,
    fillStyle: col(0.5, 0.5, 0.85),
    x: W / 2,
    y: 340,
  });

  // Highscore links (x≈250) und rechts (x≈width-500) ab Bildmitte+64
  highscore.renderHighAndLowScores(ctx);

  if (stateTime > DIFFICULTY.gameOverButtonDelay) {
    ctx.save();
    ctx.fillStyle = col(0.5, 0.6, 0.05);
    ctx.beginPath();
    ctx.arc(W / 2, 840, 130, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
    if (!startButton) startButton = createStartButton('NOCHMAL');
    startButton.handle(grid, dt);
    util.renderText({
      ctx,
      text: '(Leertaste startet auch)',
      fontSize: '30px',
      fillStyle: col(0.5, 0.4, 0.65),
      x: W / 2,
      y: 1010,
    });
    if (keyEdge('Space')) startGame();
  } else {
    keyEdge('Space'); // Flanke verbrauchen, damit kein versehentlicher Neustart
  }
}

/* ------------------------------------------------------------------ Export */

export default {
  name: 'Hydra',
  description: `
Hydra – die Leuchtschlange im Fraktal-Aquarium!

Die Schlange schwimmt ständig vorwärts. Haltet eure Laser als Köder
knapp VOR ihre Nase – dann dreht sie sich dorthin. Laser weit weg bewirken nichts.

Früchte sind unreif: leuchtet sie gemeinsam an, bis sie reif glühen.
Nur reife Früchte kann die Hydra fressen – dann wächst sie.
Giftfrüchte: anleuchten lässt sie platzen, fressen kostet Segmente.
Beißt sie sich in den Schwanz oder rammt Felsen, verliert sie Segmente.

Wildes Herumleuchten macht die Hydra nervös!
Ab Level 3 teilt sie sich in zwei Köpfe, ab Level 5 in drei – teilt euch auf!`,
  image: 'media/img/gametitles/laser-sharkpool-6-###4###.png',
  init: function () {
    ensureAssets();
    createMotes();
    resetStats();
    gameState = 'start';
    level = 1;
    score = 0;
    time = 0;
    stateTime = 0;
    eatenThisLevel = 0;
    snakes = [];
    demoSnake = null;
    fruits = [];
    rocks = [];
    particles = [];
    floatingTexts = [];
    shake = 0;
    flash = 0;
    splitDone = false;
    bubbleTimer = 0;
    lastTime = 0;
    calm = null;
    startButton = null;
    keyEdge = createKeyEdge();
  },
  stop: function () {
    stopSounds();
  },
  handle: function (grid) {
    const dt = getDelta();
    time += dt;
    bubbleTimer -= dt;
    if (bubbleTimer <= 0) {
      bubbleTimer = 0.25;
      bubble(Math.random() * W, H + 10);
    }
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
};
