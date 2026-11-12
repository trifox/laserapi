/**
 * Laser-Shark 2 – Der Schwarm schlägt zurück
 *
 * Neuauflage von game-016-lasershark (das alte Spiel bleibt unverändert bestehen).
 *
 * Regeln:
 * - Auf dem Startbildschirm liegen leuchtende Fisch-Eier. Ein Laser auf einem Ei lässt einen Fisch
 *   schlüpfen. Jeder Fisch folgt danach dem Laser in seiner Nähe – jede Person lenkt "ihren" Fisch.
 * - Plankton fressen lässt Fische wachsen. Grosse Fische sind stärker, aber langsamer.
 *   Goldenes Plankton gibt einen grossen Wachstumsschub.
 * - Haie jagen kleine Fische. Ein Hai wird nur besiegt, wenn die Fische, die ihn GLEICHZEITIG
 *   berühren, zusammen grösser sind als er. Der Ring um den Hai zeigt die aktuelle Schwarm-Stärke.
 *   Ist der Schwarm zu schwach, beisst der Hai zu: Fische schrumpfen oder werden gefressen.
 * - Haie fliehen vor einem überlegenen Schwarm – treibt sie gemeinsam in die Ecke.
 * - Am Riff liegen Ersatz-Eier (Vorrat). Wer gefressen wurde, lässt dort einen neuen Fisch schlüpfen.
 *   Plankton und besiegte Haie füllen den Vorrat auf.
 * - Level geschafft, wenn alle Haie des Levels besiegt sind.
 * - Game Over, wenn kein Fisch mehr lebt und keine Eier mehr übrig sind.
 *
 * Neue Elemente pro Level:
 * - Level 2: Quallen – Berührung betäubt und lässt den Fisch schrumpfen (Strafe für wildes Leuchten).
 * - Level 3: Hammerhaie – zielen kurz (gestrichelte Linie) und sprinten dann los.
 * - Level 4: Strömungen – treiben alles für einige Sekunden zur Seite.
 * - Level 5, 10, …: Mega-Hai (Boss) mit Lebensbalken, ruft kleine Haie zu Hilfe.
 * - Ab Level 6: Tiefsee – es wird dunkel, nur Fische, Plankton und Haiaugen leuchten.
 *
 * Mehrspieler: Viele Fische gleichzeitig (bis 40), jeder per gui/followCircle gelenkt. Teamwork über
 * die Summe der Fischgrössen am Hai, Strafe für wildes Leuchten über Quallen und Haibisse.
 *
 * Tastatur-Test: Space = Start/Neustart, F = Fisch schlüpfen lassen, G = alle Fische wachsen,
 *                K = alle Haie besiegen, L = Level überspringen.
 *
 * Alle Stellschrauben stehen gesammelt in DIFFICULTY.
 */

import util, { getRgbSpreadHex, removeItemFromArray } from '../util.js';
import { lerp } from '../math.js';
var laserConfig = require('../LaserApiConfig.js').default;
var MasterCanvas = require('../MasterCanvas').default;
var guiFillButton = require('./gui/fillButton').default;
var guiFollowCircle = require('./gui/followCircle').default;
import soundSpawn from '../../../public/media/496199__luminousfridge__player-spawned.ogg';
import soundExplode from '../../../public/media/414346__bykgames__explosion-far.wav';
import soundGameOver from '../../../public/media/70299__kizilsungur__sonar.wav';
import soundBG from '../../../public/media/522110__setuniman__cheeky-1t41b.wav';
import soundEat from '../../../public/media/369952__mischy__plop-1.wav';
import soundSplash from '../../../public/media/485066__javierserrat__object-falls-into-the-water.wav';
import soundBoss from '../../../public/media/517267__foolboymedia__cinematic-stomp.wav';
import soundLevel from '../../../public/media/521966__kastenfrosch__ready-to-start-jingle.ogg';
import soundSonar from '../../../public/media/72218__benboncan__sonar.wav';

const DIFFICULTY = {
  // Fische
  fishMax: 40,
  fishStartRadius: 34,
  fishMinRadius: 22, // wird ein Fisch kleiner, ist er gefressen
  fishMaxRadius: 80, // kleiner als grosse Haie: ab Level 3–4 geht es nur noch gemeinsam
  fishScanRadius: 120, // so nah muss ein Laser am Fisch sein, um ihn zu lenken
  fishSpeedMax: 520, // px/s für einen frisch geschlüpften Fisch
  fishSpeedExponent: 0.45, // grössere Fische werden langsamer
  fishSteer: 0.16, // followCircle speedUp
  fishBrake: 0.05, // followCircle speedDown
  fishSpawnProtect: 1.5, // Sekunden Schutz nach dem Schlüpfen
  // Eier
  startEggCols: 12,
  startEggRows: 6,
  startFishMin: 4, // so viele schlüpfen automatisch, wenn beim Start noch niemand gebrütet hat
  eggReserveStart: 8,
  eggReserveCap: 15, // mehr Ersatz-Eier gibt es nicht
  eggSlots: 10, // so viele Eier liegen höchstens gleichzeitig am Riff
  eggHatchSpeed: 70, // Füllrate pro Sekunde
  eggDecay: 30,
  eggRadius: 55,
  eggPerPlankton: 12, // alle X gefressenen Plankton ein neues Ei
  eggPerShark: 1,
  eggPerBoss: 5,
  eggPerLevel: 3,
  // Plankton
  planktonBase: 8,
  planktonPerFish: 0.7,
  planktonCap: 45,
  planktonInterval: 0.35,
  planktonGrow: 2.2,
  goldChance: 0.07,
  goldGrow: 9,
  // Haie
  sharksStart: 2, // Haie im ersten Level
  sharksPerLevel: 1,
  sharksCap: 9,
  activeStart: 2, // gleichzeitig aktive Haie
  activeEveryLevels: 2, // alle X Level einer mehr
  activeCap: 5,
  sharkSpawnDelay: 2.5,
  sharkSizeStart: 70,
  sharkSizePerLevel: 5,
  sharkSizeCap: 125,
  sharkSpeedStart: 120,
  sharkSpeedPerLevel: 12,
  sharkSpeedCap: 250,
  sharkTurn: 2.5,
  fleeRange: 2.3, // Bedrohung wird im Umkreis size * fleeRange gemessen
  fleeThreshold: 1.0, // Hai flieht, wenn die Fische dort zusammen >= size * fleeThreshold sind
  fleeSpeedFactor: 1.1,
  contactFactor: 0.75, // Berührung: Abstand < Fischradius + size * contactFactor
  swarmDps: 1.7, // Schaden pro Sekunde bei Schwarm-Stärke 1 (Haie haben 1 Leben)
  swarmPowerCap: 2.5,
  biteCooldown: 0.8,
  dashBiteCooldown: 0.25,
  biteDamage: 12,
  killGrow: 6, // so viel wachsen die beteiligten Fische
  // Hammerhai
  hammerLevel: 3,
  hammerChance: 0.4,
  hammerSizeFactor: 1.2,
  hammerHp: 1.3,
  hammerAimTime: 0.9,
  hammerDashTime: 0.65,
  hammerDashSpeed: 900,
  hammerCooldown: 4.5,
  hammerAimRange: 750,
  // Mega-Hai (Boss)
  bossLevel: 5,
  bossEvery: 5,
  bossSize: 230,
  bossSizePerAppearance: 15,
  bossHp: 14, // bei voller Schwarm-Stärke (Deckel 2.5) etwa 3–4 s Dauerkontakt
  bossHpPerAppearance: 4,
  bossSpeed: 80,
  bossBiteDamage: 18,
  bossBiteCooldown: 0.6,
  bossMinionInterval: 9,
  bossMinionMax: 2,
  // Quallen
  jellyLevel: 2,
  jellyStart: 2,
  jellyPerLevel: 1,
  jellyCap: 6,
  jellySize: 55,
  jellySpeed: 45,
  jellyStun: 1.3,
  jellyShrink: 9,
  // Strömung
  currentLevel: 4,
  currentInterval: 13,
  currentWarn: 1.8,
  currentDuration: 4,
  currentStrength: 230, // px/s
  // Tiefsee
  darkLevel: 6,
  darkStart: 0.85,
  darkPerLevel: 0.02,
  darkCap: 0.94,
  // Punkte
  scorePlankton: 5,
  scoreGold: 25,
  scoreShark: 100,
  scoreSharkPerLevel: 20,
  scoreHammer: 150,
  scoreBoss: 1000,
  scoreSurvivor: 10,
  // Sonstiges
  levelUpDuration: 3,
  maxParticles: 400,
};

const W = 1920;
const H = 1080;
const HUD_H = 90;
const REEF_Y = H - 70; // Höhe der Ersatz-Eier

// --- Zustand ---
var gameState = 'start';
var level = 1;
var score = 0;
var bestScore = 0;
var eggReserve = 0;
var planktonForEgg = 0;
var gameTime = 0;
var stateTime = 0;
var time = 0; // Animationszeit, läuft immer
var fishes = [];
var sharks = [];
var sharkQueue = [];
var plankton = [];
var jellies = [];
var eggs = [];
var particles = [];
var floatingTexts = [];
var ambientBubbles = [];
var seaweeds = [];
var streaks = [];
var buttonsStart = [];
var buttonsGameOver = [];
var sharkSpawnTimer = 0;
var planktonTimer = 0;
var currentTimer = 0;
var currentPhase = 'idle'; // idle | warn | flow
var currentDir = 1;
var currentStrengthNow = 0;
var shake = 0;
var flash = 0;
var stats = {};
var previousKeys = {};
var lastTime = 0;
var activeSounds = [];
var bgMusic = null;

function resetStats() {
  stats = {
    hatched: 0,
    plankton: 0,
    gold: 0,
    sharks: 0,
    bosses: 0,
    lost: 0,
    stung: 0,
    bites: 0,
    maxFish: 0,
    biggest: DIFFICULTY.fishStartRadius,
  };
}

// --- Farben (alle aus testColor abgeleitet, nie die reine Laserfarbe) ---
var COL = {};
function updateColors() {
  const c = laserConfig.testColor;
  COL = {
    water1: getRgbSpreadHex(c, 0.5, 0.75, 0.42),
    water2: getRgbSpreadHex(c, 0.55, 0.8, 0.2),
    deep: getRgbSpreadHex(c, 0.6, 0.85, 0.06),
    ray: getRgbSpreadHex(c, 0.47, 0.3, 0.9),
    reefFar: getRgbSpreadHex(c, 0.62, 0.6, 0.14),
    reefNear: getRgbSpreadHex(c, 0.7, 0.55, 0.22),
    coral: getRgbSpreadHex(c, 0.78, 0.55, 0.45),
    weed: getRgbSpreadHex(c, 0.33, 0.65, 0.4),
    bubble: getRgbSpreadHex(c, 0.48, 0.25, 0.95),
    fish: [
      getRgbSpreadHex(c, 0.3, 0.6, 1),
      getRgbSpreadHex(c, 0.4, 0.55, 1),
      getRgbSpreadHex(c, 0.2, 0.65, 1),
    ],
    fishFin: [
      getRgbSpreadHex(c, 0.27, 0.8, 0.75),
      getRgbSpreadHex(c, 0.43, 0.8, 0.75),
      getRgbSpreadHex(c, 0.17, 0.8, 0.75),
    ],
    fishBelly: getRgbSpreadHex(c, 0.35, 0.15, 1),
    eyeWhite: getRgbSpreadHex(c, 0.5, 0.05, 1),
    pupil: getRgbSpreadHex(c, 0.6, 0.6, 0.12),
    shark: getRgbSpreadHex(c, 0.56, 0.3, 0.6),
    sharkDark: getRgbSpreadHex(c, 0.58, 0.35, 0.38),
    hammer: getRgbSpreadHex(c, 0.64, 0.35, 0.58),
    boss: getRgbSpreadHex(c, 0.68, 0.45, 0.45),
    belly: getRgbSpreadHex(c, 0.55, 0.1, 0.85),
    eye: getRgbSpreadHex(c, 0.15, 0.9, 1),
    mouth: getRgbSpreadHex(c, 0.6, 0.7, 0.1),
    hit: getRgbSpreadHex(c, 0.5, 0.05, 1),
    plankton: getRgbSpreadHex(c, 0.37, 0.5, 1),
    gold: getRgbSpreadHex(c, 0.16, 0.75, 1),
    jelly: getRgbSpreadHex(c, 0.78, 0.45, 1),
    jellyCore: getRgbSpreadHex(c, 0.82, 0.2, 1),
    egg: getRgbSpreadHex(c, 0.33, 0.3, 0.95),
    eggRim: getRgbSpreadHex(c, 0.3, 0.7, 0.9),
    team: getRgbSpreadHex(c, 0.33, 0.85, 1),
    ringBase: getRgbSpreadHex(c, 0.5, 0.2, 0.9),
    ringWeak: getRgbSpreadHex(c, 0.12, 0.85, 1),
    text: getRgbSpreadHex(c, 0.47, 0.35, 1),
    textHi: getRgbSpreadHex(c, 0.33, 0.75, 1),
    bad: getRgbSpreadHex(c, 0.85, 0.85, 1),
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

/** Wert für das aktuelle Level: Start + Steigerung pro Level, gedeckelt */
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

function startMusic() {
  stopMusic();
  bgMusic = new Audio(soundBG);
  bgMusic.loop = true;
  bgMusic.volume = 0.5;
  bgMusic.play().catch(() => {});
}

function stopMusic() {
  if (bgMusic) bgMusic.pause();
  bgMusic = null;
}

function lerpAngle(a, b, t) {
  let d = (b - a) % (Math.PI * 2);
  if (d > Math.PI) d -= Math.PI * 2;
  if (d < -Math.PI) d += Math.PI * 2;
  return a + d * t;
}

function fx(f) {
  return f.circle.getX();
}

function fy(f) {
  return f.circle.getY();
}

function addFloatingText(text, x, y, color, size = 44) {
  // am Rand nicht abschneiden
  const half = Math.min(W / 2 - 20, String(text).length * size * 0.3);
  x = Math.max(half + 20, Math.min(W - half - 20, x));
  y = Math.max(HUD_H + size, y);
  floatingTexts.push({ text, x, y, color, size, time: 0, duration: 1.5 });
}

/** Partikel unter Wasser: bremsen ab und steigen leicht auf */
function burst(x, y, color, count = 18, speed = 300, size = 8) {
  for (let i = 0; i < count && particles.length < DIFFICULTY.maxParticles; i++) {
    const a = Math.random() * Math.PI * 2;
    const s = speed * (0.3 + Math.random() * 0.7);
    particles.push({
      x,
      y,
      vx: Math.cos(a) * s,
      vy: Math.sin(a) * s,
      life: 0,
      maxLife: 0.5 + Math.random() * 0.7,
      size: size * (0.5 + Math.random()),
      color,
    });
  }
}

// --- vorgerenderte Grafik ---
var bgCanvas = null;
var glowSprites = {};
var lightSprite = null;
var darkCanvas = null;

function getGlowSprite(color) {
  if (!glowSprites[color]) {
    const size = 128;
    const c = document.createElement('canvas');
    c.width = size;
    c.height = size;
    const g = c.getContext('2d');
    const grad = g.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
    grad.addColorStop(0, color + 'aa');
    grad.addColorStop(0.45, color + '30');
    grad.addColorStop(1, color + '00');
    g.fillStyle = grad;
    g.fillRect(0, 0, size, size);
    glowSprites[color] = c;
  }
  return glowSprites[color];
}

/** weisser, weicher Lichtfleck zum Ausstanzen der Dunkelheit */
function renderLightSprite() {
  const size = 128;
  const c = document.createElement('canvas');
  c.width = size;
  c.height = size;
  const g = c.getContext('2d');
  const grad = g.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
  grad.addColorStop(0, 'rgba(255,255,255,1)');
  grad.addColorStop(0.5, 'rgba(255,255,255,0.7)');
  grad.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = grad;
  g.fillRect(0, 0, size, size);
  return c;
}

function drawCoral(g, x, y, a, len, width, depth) {
  if (depth <= 0 || len < 6) return;
  const x2 = x + Math.cos(a) * len;
  const y2 = y + Math.sin(a) * len;
  g.lineWidth = width;
  g.beginPath();
  g.moveTo(x, y);
  g.lineTo(x2, y2);
  g.stroke();
  drawCoral(g, x2, y2, a - 0.35 - Math.random() * 0.35, len * 0.72, width * 0.7, depth - 1);
  drawCoral(g, x2, y2, a + 0.35 + Math.random() * 0.35, len * 0.72, width * 0.7, depth - 1);
}

/** Meeresgrund mit Verlauf, Felsen und Korallen – einmal vorrendern */
function renderBackground() {
  const c = document.createElement('canvas');
  c.width = W;
  c.height = H;
  const g = c.getContext('2d');
  const grad = g.createLinearGradient(0, 0, 0, H);
  grad.addColorStop(0, COL.water1);
  grad.addColorStop(0.55, COL.water2);
  grad.addColorStop(1, COL.deep);
  g.fillStyle = grad;
  g.fillRect(0, 0, W, H);

  // Felsen in zwei Ebenen
  const reef = (baseY, amp, color, seed, spiky) => {
    g.fillStyle = color;
    g.beginPath();
    g.moveTo(0, H);
    for (let x = 0; x <= W; x += 16) {
      let y =
        baseY +
        Math.sin(x * 0.004 + seed) * amp +
        Math.sin(x * 0.013 + seed * 2) * amp * 0.4;
      if (spiky && Math.sin(x * 0.05 + seed) > 0.8) y -= amp * 0.9;
      g.lineTo(x, y);
    }
    g.lineTo(W, H);
    g.closePath();
    g.fill();
  };
  reef(H * 0.8, 45, COL.reefFar, 1, false);
  reef(H * 0.91, 25, COL.reefNear, 4, true);

  // Korallenbäumchen
  g.strokeStyle = COL.coral;
  g.lineCap = 'round';
  for (let i = 0; i < 16; i++) {
    const x = 60 + (i * (W - 120)) / 15 + (Math.random() - 0.5) * 50;
    g.globalAlpha = 0.55 + Math.random() * 0.35;
    drawCoral(g, x, H * 0.95, -Math.PI / 2 + (Math.random() - 0.5) * 0.4, 45 + Math.random() * 45, 9, 5);
  }
  g.globalAlpha = 1;

  // Schwebeteilchen
  g.fillStyle = COL.bubble;
  for (let i = 0; i < 160; i++) {
    g.globalAlpha = 0.05 + Math.random() * 0.15;
    g.fillRect(Math.random() * W, Math.random() * H * 0.85, 2, 2);
  }
  g.globalAlpha = 1;
  return c;
}

function prerender() {
  updateColors();
  glowSprites = {};
  bgCanvas = renderBackground();
  lightSprite = renderLightSprite();
  darkCanvas = document.createElement('canvas');
  darkCanvas.width = W / 4;
  darkCanvas.height = H / 4;
  seaweeds = [];
  for (let i = 0; i < 11; i++) {
    seaweeds.push({
      x: 90 + i * 172 + (Math.random() - 0.5) * 60,
      h: 120 + Math.random() * 160,
      w: 6 + Math.random() * 6,
      phase: Math.random() * 10,
    });
  }
  ambientBubbles = [];
  for (let i = 0; i < 40; i++) {
    ambientBubbles.push({
      x: Math.random() * W,
      y: Math.random() * H,
      r: 2 + Math.random() * 7,
      speed: 30 + Math.random() * 70,
      phase: Math.random() * 10,
    });
  }
  streaks = [];
  for (let i = 0; i < 30; i++) {
    streaks.push({ x: Math.random() * W, y: HUD_H + Math.random() * (H - 250), len: 80 + Math.random() * 180 });
  }
}

// --- Welt zeichnen ---
function renderWorld(ctx, dt) {
  ctx.drawImage(bgCanvas, 0, 0);

  // Lichtstrahlen von oben
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  ctx.fillStyle = COL.ray;
  for (let i = 0; i < 6; i++) {
    const x = 180 + i * 320 + Math.sin(time * 0.3 + i * 1.7) * 80;
    const w = 90 + (i % 3) * 45;
    const sway = Math.sin(time * 0.2 + i) * 200;
    ctx.globalAlpha = 0.045 + 0.03 * Math.sin(time * 0.7 + i * 2);
    ctx.beginPath();
    ctx.moveTo(x - w / 2, 0);
    ctx.lineTo(x + w / 2, 0);
    ctx.lineTo(x + w * 1.6 + sway, H * 0.85);
    ctx.lineTo(x - w * 0.6 + sway, H * 0.85);
    ctx.closePath();
    ctx.fill();
  }
  ctx.restore();

  // Seegras wiegt sich (und biegt sich mit der Strömung)
  ctx.save();
  ctx.strokeStyle = COL.weed;
  ctx.lineCap = 'round';
  seaweeds.forEach((s) => {
    ctx.lineWidth = s.w;
    ctx.beginPath();
    ctx.moveTo(s.x, H);
    for (let k = 1; k <= 10; k++) {
      const t = k / 10;
      const px = s.x + Math.sin(time * 1.2 + s.phase + t * 3) * t * 30 + currentStrengthNow * 0.2 * t;
      ctx.lineTo(px, H - t * s.h);
    }
    ctx.stroke();
  });
  ctx.restore();

  // aufsteigende Bläschen
  ctx.save();
  ctx.strokeStyle = COL.bubble;
  ctx.lineWidth = 2;
  ambientBubbles.forEach((b) => {
    b.y -= b.speed * dt;
    b.x += Math.sin(time * 2 + b.phase) * 10 * dt + currentStrengthNow * 0.5 * dt;
    if (b.y < -10) {
      b.y = H + 10;
      b.x = Math.random() * W;
    }
    if (b.x < -10) b.x = W + 10;
    if (b.x > W + 10) b.x = -10;
    ctx.globalAlpha = 0.35;
    ctx.beginPath();
    ctx.arc(b.x, b.y, b.r, 0, Math.PI * 2);
    ctx.stroke();
  });
  ctx.restore();

  // Strömungsschlieren
  if (currentPhase !== 'idle') {
    const strength = currentPhase === 'flow' ? 1 : 0.35;
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    ctx.strokeStyle = COL.ray;
    ctx.lineWidth = 3;
    ctx.globalAlpha = 0.25 * strength;
    streaks.forEach((s) => {
      s.x += currentDir * (300 + s.len) * strength * dt;
      if (s.x > W + s.len) s.x = -s.len;
      if (s.x < -s.len) s.x = W + s.len;
      ctx.beginPath();
      ctx.moveTo(s.x, s.y);
      ctx.lineTo(s.x - currentDir * s.len, s.y + Math.sin(time * 3 + s.y) * 6);
      ctx.stroke();
    });
    ctx.restore();
  }
}

// --- Eier ---
function createEgg(x, y, slot) {
  const egg = { x, y, slot, t: Math.random() * 10, button: null };
  egg.button = guiFillButton({
    label: '',
    posX: x,
    posY: y,
    radius: DIFFICULTY.eggRadius,
    speedUp: DIFFICULTY.eggHatchSpeed,
    speedDown: DIFFICULTY.eggDecay,
    activeValue: 90,
    minValue: 5,
    visible: false,
    onEnterActive: () => hatchEgg(egg),
    onExitActive: () => {},
  });
  return egg;
}

function hatchEgg(egg) {
  if (!eggs.includes(egg) || fishes.length >= DIFFICULTY.fishMax) return;
  removeItemFromArray(eggs, egg);
  if (gameState !== 'start') eggReserve = Math.max(0, eggReserve - 1);
  hatchFish(egg.x, egg.y - 10);
}

function createStartEggs() {
  const result = [];
  const cols = DIFFICULTY.startEggCols;
  const rows = DIFFICULTY.startEggRows;
  for (let i = 0; i < cols; i++) {
    for (let j = 0; j < rows; j++) {
      const x = 110 + (i * (W - 220)) / (cols - 1);
      const y = 390 + (j * (H - 470)) / (rows - 1);
      // Platz für den Start-Knopf freihalten
      if (Math.abs(x - W / 2) < 330 && Math.abs(y - 640) < 230) continue;
      result.push(createEgg(x + (Math.random() - 0.5) * 30, y + (Math.random() - 0.5) * 20, -1));
    }
  }
  return result;
}

/** Ersatz-Eier am Riff an den Vorrat anpassen */
function syncReefEggs() {
  const desired = Math.max(
    0,
    Math.min(DIFFICULTY.eggSlots, eggReserve, DIFFICULTY.fishMax - fishes.length)
  );
  while (eggs.length > desired) eggs.pop();
  if (eggs.length < desired) {
    const used = eggs.map((e) => e.slot);
    const free = [];
    for (let i = 0; i < DIFFICULTY.eggSlots; i++) if (!used.includes(i)) free.push(i);
    while (eggs.length < desired && free.length > 0) {
      const slot = free.splice(Math.floor(Math.random() * free.length), 1)[0];
      const x = 130 + (slot * (W - 260)) / (DIFFICULTY.eggSlots - 1);
      eggs.push(createEgg(x, REEF_Y, slot));
    }
  }
}

function drawEgg(ctx, egg, dt) {
  egg.t += dt;
  const v = egg.button.getValue() / 100;
  const wobble = Math.sin(egg.t * 25) * v * 0.18 + Math.sin(egg.t * 2) * 0.04;
  const pulse = 1 + Math.sin(egg.t * 3) * 0.04 + v * 0.15;
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  ctx.globalAlpha = 0.5 + v * 0.5;
  const gs = 150 * pulse;
  ctx.drawImage(getGlowSprite(COL.eggRim), egg.x - gs / 2, egg.y - gs / 2, gs, gs);
  ctx.restore();

  ctx.save();
  ctx.translate(egg.x, egg.y);
  ctx.rotate(wobble);
  ctx.scale(pulse, pulse);
  ctx.globalAlpha = 0.85;
  ctx.fillStyle = COL.egg;
  ctx.beginPath();
  ctx.ellipse(0, 0, 30, 38, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.globalAlpha = 1;
  ctx.strokeStyle = COL.eggRim;
  ctx.lineWidth = 4;
  ctx.stroke();
  // kleiner Fisch im Ei, wird beim Brüten sichtbar
  ctx.fillStyle = COL.fish[Math.floor(egg.t) % 3];
  ctx.globalAlpha = 0.3 + v * 0.7;
  const fs = 8 + v * 8;
  ctx.beginPath();
  ctx.ellipse(0, 0, fs, fs * 0.6, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.moveTo(-fs * 0.8, 0);
  ctx.lineTo(-fs * 1.6, -fs * 0.6);
  ctx.lineTo(-fs * 1.6, fs * 0.6);
  ctx.closePath();
  ctx.fill();
  ctx.restore();

  // Brut-Fortschritt als Ring
  if (v > 0.02) {
    ctx.save();
    ctx.strokeStyle = COL.team;
    ctx.lineWidth = 8;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.arc(egg.x, egg.y, DIFFICULTY.eggRadius, -Math.PI / 2, -Math.PI / 2 + v * Math.PI * 2);
    ctx.stroke();
    ctx.restore();
  }
}

// --- Fische ---
function fishMaxSpeed(f) {
  return (
    DIFFICULTY.fishSpeedMax *
    Math.min(1, Math.pow(DIFFICULTY.fishStartRadius / f.r, DIFFICULTY.fishSpeedExponent))
  );
}

function hatchFish(x, y) {
  if (fishes.length >= DIFFICULTY.fishMax) return null;
  const fish = {
    r: DIFFICULTY.fishStartRadius,
    displayR: 6,
    colorIdx: Math.floor(Math.random() * 3),
    angle: -Math.PI / 2,
    stun: 0,
    hurt: 0,
    protect: DIFFICULTY.fishSpawnProtect,
    t: Math.random() * 10,
    circle: null,
  };
  fish.circle = guiFollowCircle({
    label: '',
    posX: x,
    posY: y,
    radius: DIFFICULTY.fishScanRadius,
    scanRadiusFactor: 1,
    speedUp: DIFFICULTY.fishSteer,
    speedDown: DIFFICULTY.fishBrake,
    speedY: -0.25,
    visible: false,
  });
  fishes.push(fish);
  stats.hatched++;
  stats.maxFish = Math.max(stats.maxFish, fishes.length);
  burst(x, y, COL.egg, 20, 260, 7);
  playSound(soundSpawn, 0.35);
  return fish;
}

function addEggs(n) {
  eggReserve = Math.min(DIFFICULTY.eggReserveCap, eggReserve + n);
}

function growFish(f, amount) {
  f.r = Math.min(DIFFICULTY.fishMaxRadius, f.r + amount);
  stats.biggest = Math.max(stats.biggest, f.r);
}

function removeFish(f) {
  if (!fishes.includes(f)) return;
  removeItemFromArray(fishes, f);
  stats.lost++;
  burst(fx(f), fy(f), COL.fish[f.colorIdx], 35, 380, 9);
  burst(fx(f), fy(f), COL.bad, 15, 250, 6);
  addFloatingText('Gefressen!', fx(f), fy(f) - 50, COL.bad, 46);
  shake = Math.max(shake, 0.3);
  playSound(soundSplash, 0.6);
}

function updateFishes(grid, dt) {
  fishes.slice().forEach((f) => {
    f.t += dt;
    f.hurt = Math.max(0, f.hurt - dt);
    f.protect = Math.max(0, f.protect - dt);
    f.displayR = lerp(f.displayR, f.r, Math.min(1, dt * 6));
    const c = f.circle;
    const px = c.getX();
    const py = c.getY();
    c.handle(grid, dt);
    if (f.stun > 0) {
      // betäubt: Laser wirkt nicht
      f.stun -= dt;
      c.setX(px);
      c.setY(py);
      c.setSpeedX(0);
      c.setSpeedY(0);
    } else {
      // grosse Fische sind langsamer: Überschuss dieses Frames zurücknehmen
      const maxSp = fishMaxSpeed(f) / 1000; // followCircle rechnet in px/ms
      const sx = c.getSpeedX();
      const sy = c.getSpeedY();
      const sp = Math.sqrt(sx * sx + sy * sy);
      if (sp > maxSp) {
        const k = maxSp / sp;
        c.setX(c.getX() - sx * (1 - k) * dt * 1000);
        c.setY(c.getY() - sy * (1 - k) * dt * 1000);
        c.setSpeedX(sx * k);
        c.setSpeedY(sy * k);
      }
    }
    if (currentStrengthNow !== 0) c.setX(c.getX() + currentStrengthNow * 0.8 * dt);
    // Ränder
    const m = f.r * 0.8;
    if (c.getX() < m) {
      c.setX(m);
      c.setSpeedX(0);
    }
    if (c.getX() > W - m) {
      c.setX(W - m);
      c.setSpeedX(0);
    }
    if (c.getY() < HUD_H + m * 0.5) {
      c.setY(HUD_H + m * 0.5);
      c.setSpeedY(0);
    }
    if (c.getY() > H - m * 0.6) {
      c.setY(H - m * 0.6);
      c.setSpeedY(0);
    }
    // Blickrichtung aus der Bewegung
    const vx = c.getX() - px;
    const vy = c.getY() - py;
    if (vx * vx + vy * vy > 0.3) f.angle = lerpAngle(f.angle, Math.atan2(vy, vx), Math.min(1, dt * 8));
  });

  // Fische schieben sich auseinander, damit der Schwarm lesbar bleibt
  for (let i = 0; i < fishes.length; i++) {
    for (let j = i + 1; j < fishes.length; j++) {
      const a = fishes[i].circle;
      const b = fishes[j].circle;
      const dx = b.getX() - a.getX();
      const dy = b.getY() - a.getY();
      const min = (fishes[i].r + fishes[j].r) * 0.75;
      const d2 = dx * dx + dy * dy;
      if (d2 < min * min && d2 > 0.0001) {
        const d = Math.sqrt(d2);
        const push = Math.min((min - d) / 2, 400 * dt);
        a.setX(a.getX() - (dx / d) * push);
        a.setY(a.getY() - (dy / d) * push);
        b.setX(b.getX() + (dx / d) * push);
        b.setY(b.getY() + (dy / d) * push);
      }
    }
  }
}

function drawFish(ctx, f) {
  const x = fx(f);
  const y = fy(f) + Math.sin(f.t * 2) * 3;
  const r = f.displayR;
  const col = COL.fish[f.colorIdx];
  const fin = COL.fishFin[f.colorIdx];
  const blink = f.stun > 0 && Math.floor(f.t * 12) % 2 === 0;

  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  ctx.globalAlpha = 0.75;
  ctx.drawImage(getGlowSprite(col), x - r * 2.4, y - r * 2.4, r * 4.8, r * 4.8);
  ctx.restore();

  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(f.angle);
  if (Math.cos(f.angle) < 0) ctx.scale(1, -1);
  ctx.globalAlpha = blink ? 0.45 : 1;
  const wag = Math.sin(f.t * (f.stun > 0 ? 3 : 11)) * 0.35;
  // Schwanzflosse
  ctx.save();
  ctx.translate(-r * 0.8, 0);
  ctx.rotate(wag);
  ctx.fillStyle = fin;
  ctx.beginPath();
  ctx.moveTo(r * 0.1, 0);
  ctx.lineTo(-r * 0.75, -r * 0.6);
  ctx.lineTo(-r * 0.5, 0);
  ctx.lineTo(-r * 0.75, r * 0.6);
  ctx.closePath();
  ctx.fill();
  ctx.restore();
  // Rückenflosse
  ctx.fillStyle = fin;
  ctx.beginPath();
  ctx.moveTo(r * 0.3, -r * 0.5);
  ctx.quadraticCurveTo(-r * 0.1, -r * 1.05, -r * 0.5, -r * 0.42);
  ctx.closePath();
  ctx.fill();
  // Körper
  ctx.fillStyle = col;
  ctx.beginPath();
  ctx.ellipse(0, 0, r, r * 0.62, 0, 0, Math.PI * 2);
  ctx.fill();
  // Bauch-Glanz
  ctx.globalAlpha *= 0.55;
  ctx.fillStyle = COL.fishBelly;
  ctx.beginPath();
  ctx.ellipse(r * 0.1, r * 0.24, r * 0.62, r * 0.22, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.globalAlpha = blink ? 0.45 : 1;
  // Streifen
  ctx.strokeStyle = fin;
  ctx.lineWidth = Math.max(2, r * 0.09);
  [-0.3, 0.05].forEach((k) => {
    ctx.beginPath();
    ctx.moveTo(r * k, -r * 0.56);
    ctx.quadraticCurveTo(r * k + r * 0.14, 0, r * k, r * 0.56);
    ctx.stroke();
  });
  // Auge
  ctx.fillStyle = COL.eyeWhite;
  ctx.beginPath();
  ctx.arc(r * 0.5, -r * 0.12, r * 0.17, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = COL.pupil;
  ctx.beginPath();
  ctx.arc(r * 0.56, -r * 0.12, r * 0.08, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();

  // Schutzblase nach dem Schlüpfen, roter Ring nach einem Biss
  if (f.protect > 0 || f.hurt > 0) {
    ctx.save();
    ctx.strokeStyle = f.hurt > 0 ? COL.bad : COL.bubble;
    ctx.globalAlpha = f.hurt > 0 ? f.hurt * 2 : 0.4 + Math.sin(f.t * 15) * 0.2;
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.arc(x, y, r * 1.25, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();
  }
  // betäubt: Funken
  if (f.stun > 0) {
    ctx.save();
    ctx.strokeStyle = COL.jelly;
    ctx.lineWidth = 3;
    for (let i = 0; i < 3; i++) {
      const a = f.t * 6 + (i * Math.PI * 2) / 3;
      const sx = x + Math.cos(a) * r * 1.1;
      const sy = y - r * 0.9 + Math.sin(a) * r * 0.25;
      ctx.beginPath();
      ctx.moveTo(sx - 8, sy - 8);
      ctx.lineTo(sx, sy);
      ctx.lineTo(sx - 4, sy + 2);
      ctx.lineTo(sx + 6, sy + 10);
      ctx.stroke();
    }
    ctx.restore();
  }
}

// --- Plankton ---
function spawnPlankton() {
  plankton.push({
    x: 80 + Math.random() * (W - 160),
    y: HUD_H + 40 + Math.random() * (H - HUD_H - 220),
    vx: (Math.random() - 0.5) * 30,
    vy: (Math.random() - 0.5) * 30,
    gold: Math.random() < DIFFICULTY.goldChance,
    t: Math.random() * 10,
    life: 0,
  });
}

function updatePlankton(dt) {
  plankton.forEach((p) => {
    p.t += dt;
    p.life += dt;
    p.x += (p.vx + Math.sin(p.t * 1.3) * 15 + currentStrengthNow * 0.9) * dt;
    p.y += (p.vy + Math.cos(p.t * 1.1) * 15) * dt;
    if (p.x < 40) p.x = W - 40;
    if (p.x > W - 40) p.x = 40;
    if (p.y < HUD_H + 20 || p.y > H - 160) p.vy = -p.vy;
    p.y = Math.max(HUD_H + 20, Math.min(H - 160, p.y));
  });
}

function eatPlankton() {
  fishes.forEach((f) => {
    const x = fx(f);
    const y = fy(f);
    for (let i = plankton.length - 1; i >= 0; i--) {
      const p = plankton[i];
      const reach = f.r * 0.9 + (p.gold ? 16 : 10);
      const dx = p.x - x;
      const dy = p.y - y;
      if (dx * dx + dy * dy < reach * reach) {
        plankton.splice(i, 1);
        if (p.gold) {
          growFish(f, DIFFICULTY.goldGrow);
          score += DIFFICULTY.scoreGold;
          stats.gold++;
          burst(p.x, p.y, COL.gold, 18, 260, 6);
          addFloatingText(`+${DIFFICULTY.scoreGold}`, p.x, p.y - 30, COL.gold, 40);
        } else {
          growFish(f, DIFFICULTY.planktonGrow);
          score += DIFFICULTY.scorePlankton;
          burst(p.x, p.y, COL.plankton, 6, 140, 5);
        }
        stats.plankton++;
        playSound(soundEat, 0.2);
        planktonForEgg++;
        if (planktonForEgg >= DIFFICULTY.eggPerPlankton) {
          planktonForEgg = 0;
          addEggs(1);
          addFloatingText('+1 Ei', x, y - f.r - 40, COL.egg, 42);
        }
      }
    }
  });
}

function drawPlankton(ctx) {
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  plankton.forEach((p) => {
    const fade = Math.min(1, p.life * 2);
    const pulse = 1 + Math.sin(p.t * 5) * 0.25;
    const col = p.gold ? COL.gold : COL.plankton;
    const gs = (p.gold ? 80 : 44) * pulse;
    ctx.globalAlpha = fade;
    ctx.drawImage(getGlowSprite(col), p.x - gs / 2, p.y - gs / 2, gs, gs);
    ctx.fillStyle = col;
    ctx.beginPath();
    ctx.arc(p.x, p.y, (p.gold ? 8 : 5) * pulse, 0, Math.PI * 2);
    ctx.fill();
  });
  ctx.restore();
}

// --- Quallen ---
function spawnJelly(fromBelow = true) {
  jellies.push({
    baseX: 150 + Math.random() * (W - 300),
    x: 0,
    y: fromBelow ? H + 100 + Math.random() * 300 : HUD_H + 100 + Math.random() * (H - 400),
    phase: Math.random() * 10,
    size: DIFFICULTY.jellySize * (0.85 + Math.random() * 0.3),
    t: Math.random() * 10,
  });
}

function updateJellies(dt) {
  jellies.forEach((j) => {
    j.t += dt;
    const pulse = Math.max(0, Math.sin(j.t * 3));
    j.y -= DIFFICULTY.jellySpeed * (0.5 + pulse) * dt;
    j.baseX += currentStrengthNow * 0.6 * dt;
    j.baseX = Math.max(80, Math.min(W - 80, j.baseX));
    j.x = j.baseX + Math.sin(j.t * 0.7 + j.phase) * 60;
    if (j.y < -j.size * 2.5) {
      j.y = H + j.size * 2;
      j.baseX = 150 + Math.random() * (W - 300);
    }
  });
}

function jellyContacts() {
  jellies.forEach((j) => {
    fishes.forEach((f) => {
      if (f.stun > 0 || f.protect > 0) return;
      const dx = fx(f) - j.x;
      const dy = fy(f) - j.y;
      const reach = f.r * 0.8 + j.size * 0.7;
      if (dx * dx + dy * dy < reach * reach) {
        f.stun = DIFFICULTY.jellyStun;
        f.r = Math.max(DIFFICULTY.fishMinRadius, f.r - DIFFICULTY.jellyShrink);
        stats.stung++;
        burst(fx(f), fy(f), COL.jelly, 14, 240, 6);
        addFloatingText('Autsch!', fx(f), fy(f) - f.r - 30, COL.jelly, 40);
        playSound(soundEat, 0.4);
      }
    });
  });
}

function drawJelly(ctx, j) {
  const pulse = Math.sin(j.t * 3);
  const s = j.size;
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  ctx.globalAlpha = 0.6;
  ctx.drawImage(getGlowSprite(COL.jelly), j.x - s * 2, j.y - s * 1.6, s * 4, s * 4);
  ctx.restore();

  ctx.save();
  // Tentakel
  ctx.strokeStyle = COL.jelly;
  ctx.lineWidth = 3;
  ctx.globalAlpha = 0.7;
  for (let i = 0; i < 6; i++) {
    const tx = j.x - s * 0.7 + (i * s * 1.4) / 5;
    ctx.beginPath();
    ctx.moveTo(tx, j.y);
    for (let k = 1; k <= 6; k++) {
      const t = k / 6;
      ctx.lineTo(tx + Math.sin(j.t * 4 + i + t * 5) * 10 * t, j.y + t * s * (1.5 + pulse * 0.15));
    }
    ctx.stroke();
  }
  // Schirm
  const bw = s * (1 + pulse * 0.08);
  const bh = s * (0.85 - pulse * 0.08);
  ctx.globalAlpha = 0.75;
  ctx.fillStyle = COL.jelly;
  ctx.beginPath();
  ctx.ellipse(j.x, j.y, bw, bh, 0, Math.PI, 0);
  for (let k = 0; k <= 8; k++) {
    const t = k / 8;
    ctx.lineTo(j.x + bw - t * bw * 2, j.y + (k % 2 === 0 ? 0 : s * 0.15));
  }
  ctx.closePath();
  ctx.fill();
  ctx.globalAlpha = 0.9;
  ctx.fillStyle = COL.jellyCore;
  ctx.beginPath();
  ctx.ellipse(j.x, j.y - bh * 0.35, bw * 0.4, bh * 0.3, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

// --- Haie ---
function bossAppearance() {
  return Math.max(0, Math.floor(level / DIFFICULTY.bossEvery) - 1);
}

function spawnShark(type, minion = false) {
  const fromLeft = Math.random() < 0.5;
  let size = lv(DIFFICULTY.sharkSizeStart, DIFFICULTY.sharkSizePerLevel, DIFFICULTY.sharkSizeCap);
  size *= 0.9 + Math.random() * 0.2;
  let speed = lv(DIFFICULTY.sharkSpeedStart, DIFFICULTY.sharkSpeedPerLevel, DIFFICULTY.sharkSpeedCap);
  let hp = 1;
  if (type === 'hammer') {
    size *= DIFFICULTY.hammerSizeFactor;
    speed *= 0.85;
    hp = DIFFICULTY.hammerHp;
  } else if (type === 'mega') {
    size = DIFFICULTY.bossSize + DIFFICULTY.bossSizePerAppearance * bossAppearance();
    speed = DIFFICULTY.bossSpeed;
    hp = DIFFICULTY.bossHp + DIFFICULTY.bossHpPerAppearance * bossAppearance();
  }
  const s = {
    type,
    size,
    speed,
    hp,
    maxHp: hp,
    x: fromLeft ? -size * 1.5 : W + size * 1.5,
    y: type === 'mega' ? H / 2 : HUD_H + 120 + Math.random() * (H - HUD_H - 400),
    vx: fromLeft ? speed : -speed,
    vy: 0,
    angle: fromLeft ? 0 : Math.PI,
    entering: true,
    fleeing: false,
    biteTimer: 0.5,
    biteAnim: 0,
    power: 0,
    powerShown: 0,
    hurt: 0,
    t: Math.random() * 10,
    seed: Math.random() * 100,
    state: 'cruise',
    stateTime: 0,
    dashCooldown: DIFFICULTY.hammerCooldown * (0.5 + Math.random() * 0.5),
    dashX: 0,
    dashY: 0,
    aimX: 0,
    aimY: 0,
    minionTimer: 0,
    minion,
  };
  sharks.push(s);
  if (type === 'mega') {
    playSound(soundBoss, 0.9);
    shake = Math.max(shake, 0.8);
    flash = 0.5;
    addFloatingText('MEGA-HAI!', W / 2, 420, COL.bad, 120);
  }
  return s;
}

function buildWave() {
  const q = [];
  if (level >= DIFFICULTY.bossLevel && level % DIFFICULTY.bossEvery === 0) {
    q.push('mega');
    for (let i = 0; i < Math.floor(level / DIFFICULTY.bossEvery); i++) q.push('riff');
    return q;
  }
  const count = lv(DIFFICULTY.sharksStart, DIFFICULTY.sharksPerLevel, DIFFICULTY.sharksCap);
  for (let i = 0; i < count; i++) {
    const hammer = level >= DIFFICULTY.hammerLevel && Math.random() < DIFFICULTY.hammerChance;
    q.push(hammer ? 'hammer' : 'riff');
  }
  // im ersten Hammerhai-Level mindestens einer
  if (level === DIFFICULTY.hammerLevel && !q.includes('hammer')) q[q.length - 1] = 'hammer';
  return q;
}

function activeSharkMax() {
  return Math.min(
    DIFFICULTY.activeCap,
    DIFFICULTY.activeStart + Math.floor((level - 1) / DIFFICULTY.activeEveryLevels)
  );
}

function updateSharks(dt) {
  sharks.slice().forEach((s) => {
    s.t += dt;
    s.stateTime += dt;
    s.hurt = Math.max(0, s.hurt - dt);
    s.biteAnim = Math.max(0, s.biteAnim - dt);

    // nächster Fisch und Bedrohung durch den Schwarm in der Nähe
    let nearest = null;
    let nd = Infinity;
    let threat = 0;
    let tx = 0;
    let ty = 0;
    fishes.forEach((f) => {
      const dx = fx(f) - s.x;
      const dy = fy(f) - s.y;
      const d = Math.sqrt(dx * dx + dy * dy);
      if (d < nd && f.protect <= 0) {
        nd = d;
        nearest = f;
      }
      if (d < s.size * DIFFICULTY.fleeRange) {
        threat += f.r;
        tx += fx(f) * f.r;
        ty += fy(f) * f.r;
      }
    });
    s.fleeing =
      s.type !== 'mega' && !s.entering && threat >= s.size * DIFFICULTY.fleeThreshold;

    let dirX = 0;
    let dirY = 0;
    let sp = s.speed;
    let steer = true;
    if (s.entering) {
      dirX = s.x < W / 2 ? 1 : -1;
      if (s.x > s.size && s.x < W - s.size) s.entering = false;
    } else if (s.type === 'hammer' && s.state === 'aim') {
      steer = false;
      s.vx *= 1 - Math.min(1, dt * 6);
      s.vy *= 1 - Math.min(1, dt * 6);
      if (s.stateTime >= DIFFICULTY.hammerAimTime) {
        const d = Math.hypot(s.aimX - s.x, s.aimY - s.y) || 1;
        s.dashX = (s.aimX - s.x) / d;
        s.dashY = (s.aimY - s.y) / d;
        s.state = 'dash';
        s.stateTime = 0;
        playSound(soundSplash, 0.35);
      }
    } else if (s.type === 'hammer' && s.state === 'dash') {
      steer = false;
      s.vx = s.dashX * DIFFICULTY.hammerDashSpeed;
      s.vy = s.dashY * DIFFICULTY.hammerDashSpeed;
      if (Math.random() < dt * 30) burst(s.x, s.y, COL.bubble, 2, 80, 5);
      if (s.stateTime >= DIFFICULTY.hammerDashTime) {
        s.state = 'cruise';
        s.stateTime = 0;
        s.dashCooldown = DIFFICULTY.hammerCooldown * (0.7 + Math.random() * 0.6);
      }
    } else if (s.fleeing) {
      dirX = s.x - tx / threat;
      dirY = s.y - ty / threat;
      sp = s.speed * DIFFICULTY.fleeSpeedFactor;
    } else if (nearest) {
      dirX = fx(nearest) - s.x;
      dirY = fy(nearest) - s.y;
      if (s.type === 'hammer') {
        s.dashCooldown -= dt;
        if (s.dashCooldown <= 0 && nd < DIFFICULTY.hammerAimRange) {
          s.state = 'aim';
          s.stateTime = 0;
          s.aimX = fx(nearest);
          s.aimY = fy(nearest);
        }
      }
    } else {
      // keine Beute: gemächlich umherstreifen
      const a = Math.sin(s.t * 0.35 + s.seed) * Math.PI;
      dirX = Math.cos(a);
      dirY = Math.sin(a) * 0.5;
      sp = s.speed * 0.6;
    }
    if (steer) {
      const d = Math.sqrt(dirX * dirX + dirY * dirY);
      if (d > 0.001) {
        const k = Math.min(1, dt * DIFFICULTY.sharkTurn);
        s.vx += ((dirX / d) * sp - s.vx) * k;
        s.vy += ((dirY / d) * sp - s.vy) * k;
      }
    }
    s.x += (s.vx + currentStrengthNow * 0.4) * dt;
    s.y += s.vy * dt;

    // Ränder
    const m = s.size * 0.6;
    if (!s.entering) {
      if (s.x < m) {
        s.x = m;
        s.vx = Math.abs(s.vx) * 0.5;
      }
      if (s.x > W - m) {
        s.x = W - m;
        s.vx = -Math.abs(s.vx) * 0.5;
      }
    }
    const top = HUD_H + m * 0.5;
    const bottom = H - 40 - m * 0.5;
    if (s.y < top) {
      s.y = top;
      s.vy = Math.abs(s.vy) * 0.5;
    }
    if (s.y > bottom) {
      s.y = bottom;
      s.vy = -Math.abs(s.vy) * 0.5;
    }

    // Ausrichtung
    if (s.type === 'hammer' && s.state === 'aim') {
      s.angle = lerpAngle(s.angle, Math.atan2(s.aimY - s.y, s.aimX - s.x), Math.min(1, dt * 8));
    } else if (s.vx * s.vx + s.vy * s.vy > 25) {
      s.angle = lerpAngle(s.angle, Math.atan2(s.vy, s.vx), Math.min(1, dt * 5));
    }

    // der Mega-Hai ruft Verstärkung
    if (s.type === 'mega' && gameState === 'game') {
      s.minionTimer += dt;
      if (
        s.minionTimer >= DIFFICULTY.bossMinionInterval &&
        sharks.filter((o) => o.minion).length < DIFFICULTY.bossMinionMax
      ) {
        s.minionTimer = 0;
        spawnShark('riff', true);
        addFloatingText('Der Mega-Hai ruft Verstärkung!', W / 2, 300, COL.bad, 54);
      }
    }
  });
}

/** Schwarm gegen Hai: gemeinsam stark genug = Schaden, sonst beisst der Hai */
function resolveSharkContacts(dt) {
  sharks.slice().forEach((s) => {
    if (s.entering) {
      s.power = 0;
      s.powerShown = lerp(s.powerShown, 0, Math.min(1, dt * 8));
      return;
    }
    const contacts = [];
    let sum = 0;
    fishes.forEach((f) => {
      const dx = fx(f) - s.x;
      const dy = fy(f) - s.y;
      const reach = f.r + s.size * DIFFICULTY.contactFactor;
      if (dx * dx + dy * dy < reach * reach) {
        contacts.push(f);
        sum += f.r;
      }
    });
    s.power = sum / s.size;
    s.powerShown = lerp(s.powerShown, s.power, Math.min(1, dt * 8));
    if (contacts.length === 0) {
      s.biteTimer = Math.max(0, s.biteTimer - dt);
      return;
    }
    if (s.power >= 1) {
      s.hp -= dt * DIFFICULTY.swarmDps * Math.min(s.power, DIFFICULTY.swarmPowerCap);
      s.hurt = 0.15;
      shake = Math.max(shake, s.type === 'mega' ? 0.15 : 0.08);
      if (Math.random() < dt * 25) {
        burst(
          s.x + (Math.random() - 0.5) * s.size,
          s.y + (Math.random() - 0.5) * s.size * 0.5,
          COL.hit,
          3,
          220,
          6
        );
      }
      if (s.hp <= 0) killShark(s, contacts);
      return;
    }
    s.biteTimer -= dt;
    if (s.biteTimer <= 0) {
      const victims = contacts.filter((f) => f.protect <= 0);
      if (victims.length === 0) return;
      s.biteTimer =
        s.type === 'mega'
          ? DIFFICULTY.bossBiteCooldown
          : s.state === 'dash'
          ? DIFFICULTY.dashBiteCooldown
          : DIFFICULTY.biteCooldown;
      const victim = victims.reduce((a, b) => (b.r < a.r ? b : a));
      biteFish(s, victim);
    }
  });
}

function biteFish(s, f) {
  s.biteAnim = 0.3;
  stats.bites++;
  f.r -= s.type === 'mega' ? DIFFICULTY.bossBiteDamage : DIFFICULTY.biteDamage;
  f.hurt = 0.5;
  if (f.r < DIFFICULTY.fishMinRadius) {
    removeFish(f);
  } else {
    burst(fx(f), fy(f), COL.bad, 10, 220, 6);
    addFloatingText('Biss!', fx(f), fy(f) - f.r - 25, COL.bad, 40);
    shake = Math.max(shake, 0.15);
    playSound(soundEat, 0.35);
  }
}

function sharkScore(s) {
  if (s.type === 'mega') return DIFFICULTY.scoreBoss * (1 + bossAppearance());
  const base = s.type === 'hammer' ? DIFFICULTY.scoreHammer : DIFFICULTY.scoreShark;
  return base + DIFFICULTY.scoreSharkPerLevel * (level - 1);
}

function killShark(s, contacts) {
  if (!sharks.includes(s)) return;
  removeItemFromArray(sharks, s);
  const pts = sharkScore(s);
  score += pts;
  if (s.type === 'mega') stats.bosses++;
  else stats.sharks++;
  const grow = s.type === 'mega' ? DIFFICULTY.killGrow * 2 : DIFFICULTY.killGrow;
  contacts.forEach((f) => growFish(f, grow));
  addEggs(s.type === 'mega' ? DIFFICULTY.eggPerBoss : DIFFICULTY.eggPerShark);
  const body = s.type === 'mega' ? COL.boss : s.type === 'hammer' ? COL.hammer : COL.shark;
  burst(s.x, s.y, body, s.type === 'mega' ? 80 : 40, s.type === 'mega' ? 700 : 480, 10);
  burst(s.x, s.y, COL.team, 30, 400, 7);
  const teamText = contacts.length >= 3 ? `TEAMWORK x${contacts.length}! ` : '';
  addFloatingText(`${teamText}+${pts}`, s.x, s.y - s.size, COL.textHi, s.type === 'mega' ? 80 : 52);
  shake = Math.max(shake, s.type === 'mega' ? 1 : 0.4);
  if (s.type === 'mega') flash = 0.8;
  playSound(soundExplode, s.type === 'mega' ? 1 : 0.6);
}

function sharkPoint(s, lx, ly) {
  // lokale Hai-Koordinate in Weltkoordinate umrechnen (mit Spiegelung wie beim Zeichnen)
  const flip = Math.cos(s.angle) < 0 ? -1 : 1;
  const c = Math.cos(s.angle);
  const sn = Math.sin(s.angle);
  const y = ly * flip;
  return [s.x + lx * c - y * sn, s.y + lx * sn + y * c];
}

function drawShark(ctx, s) {
  const z = s.size;
  const body = s.type === 'mega' ? COL.boss : s.type === 'hammer' ? COL.hammer : COL.shark;
  const shiver = s.type === 'hammer' && s.state === 'aim' ? (Math.random() - 0.5) * 6 : 0;
  ctx.save();
  ctx.translate(s.x + shiver, s.y);
  ctx.rotate(s.angle);
  if (Math.cos(s.angle) < 0) ctx.scale(1, -1);
  const tailWag = Math.sin(s.t * (s.state === 'dash' ? 20 : s.fleeing ? 12 : 6)) * 0.3;

  // Schwanzflosse
  ctx.save();
  ctx.translate(-z * 0.95, 0);
  ctx.rotate(tailWag);
  ctx.fillStyle = COL.sharkDark;
  ctx.beginPath();
  ctx.moveTo(z * 0.05, 0);
  ctx.lineTo(-z * 0.5, -z * 0.62);
  ctx.lineTo(-z * 0.32, 0);
  ctx.lineTo(-z * 0.45, z * 0.45);
  ctx.closePath();
  ctx.fill();
  ctx.restore();
  // Rücken- und Brustflosse
  ctx.fillStyle = COL.sharkDark;
  ctx.beginPath();
  ctx.moveTo(z * 0.2, -z * 0.38);
  ctx.lineTo(-z * 0.18, -z * 0.95);
  ctx.lineTo(-z * 0.3, -z * 0.34);
  ctx.closePath();
  ctx.fill();
  ctx.beginPath();
  ctx.moveTo(z * 0.25, z * 0.3);
  ctx.lineTo(-z * 0.12, z * 0.78);
  ctx.lineTo(-z * 0.12, z * 0.3);
  ctx.closePath();
  ctx.fill();
  // Körper
  ctx.fillStyle = s.hurt > 0 ? COL.hit : body;
  ctx.beginPath();
  ctx.moveTo(z * 1.15, 0);
  ctx.quadraticCurveTo(z * 0.75, -z * 0.5, 0, -z * 0.42);
  ctx.quadraticCurveTo(-z * 0.6, -z * 0.32, -z * 1.0, -z * 0.08);
  ctx.lineTo(-z * 1.0, z * 0.08);
  ctx.quadraticCurveTo(-z * 0.6, z * 0.3, 0, z * 0.38);
  ctx.quadraticCurveTo(z * 0.75, z * 0.42, z * 1.15, 0);
  ctx.closePath();
  ctx.fill();
  // heller Bauch
  ctx.fillStyle = COL.belly;
  ctx.globalAlpha = 0.6;
  ctx.beginPath();
  ctx.ellipse(z * 0.2, z * 0.2, z * 0.7, z * 0.14, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.globalAlpha = 1;
  // Kiemen
  ctx.strokeStyle = COL.sharkDark;
  ctx.lineWidth = Math.max(2, z * 0.03);
  for (let i = 0; i < 3; i++) {
    const gx = z * (0.38 + i * 0.08);
    ctx.beginPath();
    ctx.moveTo(gx, -z * 0.18);
    ctx.quadraticCurveTo(gx - z * 0.05, 0, gx, z * 0.16);
    ctx.stroke();
  }
  // Maul: beim Biss offen mit Zähnen
  if (s.biteAnim > 0) {
    const open = Math.sin((s.biteAnim / 0.3) * Math.PI) * z * 0.22;
    ctx.fillStyle = COL.mouth;
    ctx.beginPath();
    ctx.moveTo(z * 1.1, 0);
    ctx.lineTo(z * 0.6, z * 0.12 - open * 0.3);
    ctx.lineTo(z * 0.6, z * 0.12 + open);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = COL.eyeWhite;
    for (let i = 0; i < 4; i++) {
      const tx = z * (0.65 + i * 0.11);
      ctx.beginPath();
      ctx.moveTo(tx, z * 0.1);
      ctx.lineTo(tx + z * 0.04, z * 0.1 + z * 0.06);
      ctx.lineTo(tx + z * 0.08, z * 0.1);
      ctx.closePath();
      ctx.fill();
    }
  } else {
    ctx.strokeStyle = COL.mouth;
    ctx.lineWidth = Math.max(2, z * 0.025);
    ctx.beginPath();
    ctx.moveTo(z * 0.62, z * 0.14);
    ctx.quadraticCurveTo(z * 0.85, z * 0.2, z * 1.02, z * 0.08);
    ctx.stroke();
  }
  // Hammerkopf
  if (s.type === 'hammer') {
    ctx.fillStyle = body;
    ctx.beginPath();
    ctx.ellipse(z * 1.05, 0, z * 0.12, z * 0.42, 0, 0, Math.PI * 2);
    ctx.fill();
  }
  // Narben beim Mega-Hai
  if (s.type === 'mega') {
    ctx.strokeStyle = COL.belly;
    ctx.lineWidth = 5;
    ctx.globalAlpha = 0.6;
    ctx.beginPath();
    ctx.moveTo(-z * 0.1, -z * 0.3);
    ctx.lineTo(z * 0.15, -z * 0.05);
    ctx.moveTo(z * 0.05, -z * 0.32);
    ctx.lineTo(z * 0.25, -z * 0.12);
    ctx.stroke();
    ctx.globalAlpha = 1;
  }
  ctx.restore();
  drawSharkEyes(ctx, s);
}

function drawSharkEyes(ctx, s) {
  const z = s.size;
  const eyes =
    s.type === 'hammer'
      ? [sharkPoint(s, z * 1.08, -z * 0.38), sharkPoint(s, z * 1.08, z * 0.38)]
      : [sharkPoint(s, z * 0.68, -z * 0.14)];
  const angry = s.fleeing ? 0.4 : 1;
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  eyes.forEach(([ex, ey]) => {
    const gs = z * 0.6;
    ctx.globalAlpha = angry;
    ctx.drawImage(getGlowSprite(COL.eye), ex - gs / 2, ey - gs / 2, gs, gs);
    ctx.fillStyle = COL.eye;
    ctx.beginPath();
    ctx.arc(ex, ey, Math.max(4, z * 0.06), 0, Math.PI * 2);
    ctx.fill();
  });
  ctx.restore();
}

/** Ring = Schwarm-Stärke, Lebensbalken, Ziellinie des Hammerhais */
function drawSharkInfo(ctx, s) {
  const R = s.size * 1.3;
  ctx.save();
  ctx.lineCap = 'round';
  ctx.strokeStyle = COL.ringBase;
  ctx.globalAlpha = 0.25;
  ctx.lineWidth = 4;
  ctx.beginPath();
  ctx.arc(s.x, s.y, R, 0, Math.PI * 2);
  ctx.stroke();
  const p = Math.min(1, s.powerShown);
  if (p > 0.02) {
    const strong = s.power >= 1;
    ctx.globalAlpha = strong ? 0.8 + Math.sin(time * 20) * 0.2 : 0.9;
    ctx.strokeStyle = strong ? COL.team : COL.ringWeak;
    ctx.lineWidth = strong ? 14 : 9;
    ctx.beginPath();
    ctx.arc(s.x, s.y, R, -Math.PI / 2, -Math.PI / 2 + p * Math.PI * 2);
    ctx.stroke();
  }
  ctx.restore();

  if (s.maxHp > 1) {
    const bw = Math.min(500, s.size * 1.8);
    // Balken über dem Hai, aber nie in der HUD oder ausserhalb des Bildes
    const by = Math.max(HUD_H + 10, s.y - R - 30);
    const bx = Math.max(10, Math.min(W - 10 - bw, s.x - bw / 2));
    ctx.save();
    ctx.globalAlpha = 0.5;
    ctx.fillStyle = COL.pupil;
    ctx.fillRect(bx, by, bw, 16);
    ctx.globalAlpha = 1;
    ctx.fillStyle = COL.bad;
    ctx.fillRect(bx, by, bw * Math.max(0, s.hp / s.maxHp), 16);
    ctx.restore();
  }

  if (s.type === 'hammer' && s.state === 'aim') {
    ctx.save();
    ctx.strokeStyle = COL.bad;
    ctx.lineWidth = 6;
    ctx.globalAlpha = 0.5 + Math.sin(time * 25) * 0.3;
    ctx.setLineDash([24, 18]);
    ctx.beginPath();
    ctx.moveTo(s.x, s.y);
    const d = Math.hypot(s.aimX - s.x, s.aimY - s.y) || 1;
    const len = DIFFICULTY.hammerDashSpeed * DIFFICULTY.hammerDashTime;
    ctx.lineTo(s.x + ((s.aimX - s.x) / d) * len, s.y + ((s.aimY - s.y) / d) * len);
    ctx.stroke();
    ctx.restore();
  }
}

// --- Strömung ---
function updateCurrent(dt) {
  if (level < DIFFICULTY.currentLevel) {
    currentPhase = 'idle';
    currentStrengthNow = 0;
    return;
  }
  currentTimer += dt;
  if (currentPhase === 'idle' && currentTimer >= DIFFICULTY.currentInterval) {
    currentPhase = 'warn';
    currentTimer = 0;
    currentDir = Math.random() < 0.5 ? -1 : 1;
    addFloatingText(currentDir > 0 ? 'STRÖMUNG  >>>' : '<<<  STRÖMUNG', W / 2, 360, COL.ray, 70);
    playSound(soundSonar, 0.4);
  } else if (currentPhase === 'warn' && currentTimer >= DIFFICULTY.currentWarn) {
    currentPhase = 'flow';
    currentTimer = 0;
  } else if (currentPhase === 'flow' && currentTimer >= DIFFICULTY.currentDuration) {
    currentPhase = 'idle';
    currentTimer = 0;
  }
  const target = currentPhase === 'flow' ? currentDir * DIFFICULTY.currentStrength : 0;
  currentStrengthNow = lerp(currentStrengthNow, target, Math.min(1, dt * 2));
  if (Math.abs(currentStrengthNow) < 1 && currentPhase !== 'flow') currentStrengthNow = 0;
}

// --- Tiefsee-Dunkelheit ---
function darkness() {
  if (level < DIFFICULTY.darkLevel) return 0;
  return Math.min(
    DIFFICULTY.darkCap,
    DIFFICULTY.darkStart + DIFFICULTY.darkPerLevel * (level - DIFFICULTY.darkLevel)
  );
}

function renderDarkness(ctx, amount) {
  const g = darkCanvas.getContext('2d');
  const k = darkCanvas.width / W;
  g.globalCompositeOperation = 'source-over';
  g.clearRect(0, 0, darkCanvas.width, darkCanvas.height);
  g.globalAlpha = amount;
  g.fillStyle = COL.deep;
  g.fillRect(0, 0, darkCanvas.width, darkCanvas.height);
  g.globalAlpha = 1;
  g.globalCompositeOperation = 'destination-out';
  fishes.forEach((f) => {
    const R = f.r * 4.5 * k;
    g.drawImage(lightSprite, fx(f) * k - R, fy(f) * k - R, R * 2, R * 2);
  });
  eggs.forEach((e) => {
    const R = 120 * k;
    g.drawImage(lightSprite, e.x * k - R, e.y * k - R, R * 2, R * 2);
  });
  g.globalCompositeOperation = 'source-over';
  ctx.drawImage(darkCanvas, 0, 0, W, H);
}

// --- Effekte ---
function updateParticles(ctx, dt) {
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  for (let i = particles.length - 1; i >= 0; i--) {
    const p = particles[i];
    p.life += dt;
    if (p.life >= p.maxLife) {
      particles.splice(i, 1);
      continue;
    }
    const drag = Math.pow(0.15, dt);
    p.vx *= drag;
    p.vy = p.vy * drag - 60 * dt;
    p.x += p.vx * dt;
    p.y += p.vy * dt;
    ctx.globalAlpha = 1 - p.life / p.maxLife;
    ctx.fillStyle = p.color;
    ctx.beginPath();
    ctx.arc(p.x, p.y, p.size / 2, 0, Math.PI * 2);
    ctx.fill();
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
      x: t.x,
      y: t.y - t.time * 60,
    });
    ctx.restore();
  }
}

function renderFlash(ctx, dt) {
  if (flash <= 0) return;
  ctx.save();
  ctx.globalAlpha = Math.min(0.6, flash * 0.6);
  ctx.fillStyle = COL.ray;
  ctx.fillRect(0, 0, W, H);
  ctx.restore();
  flash = Math.max(0, flash - dt * 1.5);
}

function renderHud(ctx) {
  ctx.save();
  ctx.globalAlpha = 0.45;
  ctx.fillStyle = COL.deep;
  ctx.fillRect(0, 0, W, HUD_H - 10);
  ctx.restore();
const common = { ctx, fontSize: '44px', dropDistX: 3, dropDistY: 3, y: 60 };
  
  util.renderTextDropShadow(Object.assign({}, common, { text: `Level ${level}`, align: 'left', x: 40, fillStyle: COL.textHi }));
  util.renderTextDropShadow(Object.assign({}, common, { text: `${score}`, x: W / 2, fillStyle: COL.text }));
  
  const sharksLeft = sharks.length + sharkQueue.length;
  util.renderTextDropShadow(
    Object.assign({}, common, {
      text: `Fische ${fishes.length}    Eier ${eggReserve}   Haie ${sharksLeft}`,
      align: 'right',
      x: W - 40,
      fillStyle: COL.text,
    })
  );
}

/** alles Lebendige zeichnen (gemeinsam für Spiel, Level-Up und Game Over) */
function renderScene(ctx, dt) {
  renderWorld(ctx, dt);
  drawPlankton(ctx);
  eggs.forEach((e) => drawEgg(ctx, e, dt));
  jellies.forEach((j) => drawJelly(ctx, j));
  sharks.forEach((s) => drawShark(ctx, s));
  fishes.forEach((f) => drawFish(ctx, f));
  updateParticles(ctx, dt);
  const dark = darkness();
  if (dark > 0) {
    renderDarkness(ctx, dark);
    // Biolumineszenz: Plankton, Quallen und Haiaugen leuchten durch die Dunkelheit
    drawPlankton(ctx);
    ctx.save();
    ctx.globalAlpha = 0.35;
    jellies.forEach((j) => drawJelly(ctx, j));
    ctx.restore();
    sharks.forEach((s) => drawSharkEyes(ctx, s));
  }
  sharks.forEach((s) => drawSharkInfo(ctx, s));
}

// --- Buttons ---
function bigButton(label, onEnter) {
  return guiFillButton({
    label,
    posX: W / 2,
    posY: 640,
    speedDown: 12,
    speedUp: 25,
    edges: 12,
    edges2: 6,
    activeValue: 90,
    radius: 150,
    normalColor: COL.text,
    growColor: COL.eggRim,
    activeColor: COL.textHi,
    onEnterActive: onEnter,
    onExitActive: () => {},
  });
}

// --- Zustandswechsel ---
function clearWorld() {
  fishes = [];
  sharks = [];
  sharkQueue = [];
  plankton = [];
  jellies = [];
  eggs = [];
  particles = [];
  floatingTexts = [];
  currentPhase = 'idle';
  currentStrengthNow = 0;
  currentTimer = 0;
  shake = 0;
  flash = 0;
}

function resetToStart() {
  clearWorld();
  stopMusic();
  level = 1;
  score = 0;
  eggReserve = 0;
  planktonForEgg = 0;
  gameTime = 0;
  stateTime = 0;
  resetStats();
  eggs = createStartEggs();
  for (let i = 0; i < 12; i++) spawnPlankton();
  buttonsStart = [bigButton('START', beginGame)];
  buttonsGameOver = [];
  gameState = 'start';
}

function beginGame() {
  if (gameState !== 'start') return;
  // niemand hat gebrütet: ein paar Fische schlüpfen automatisch
  const pool = eggs.slice();
  while (fishes.length < DIFFICULTY.startFishMin && pool.length > 0) {
    const egg = pool.splice(Math.floor(Math.random() * pool.length), 1)[0];
    hatchFish(egg.x, egg.y);
  }
  eggs = [];
  eggReserve = DIFFICULTY.eggReserveStart;
  level = 1;
  score = 0;
  gameTime = 0;
  fishes.forEach((f) => (f.protect = DIFFICULTY.fishSpawnProtect));
  startLevel();
  gameState = 'game';
  stateTime = 0;
  startMusic();
  playSound(soundSonar, 0.5);
  addFloatingText(`${fishes.length} Fische im Schwarm – los geht's!`, W / 2, 400, COL.textHi, 64);
}

function startLevel() {
  sharkQueue = buildWave();
  sharkSpawnTimer = DIFFICULTY.sharkSpawnDelay * 0.6;
  currentPhase = 'idle';
  currentTimer = 0;
  const jellyCount =
    level >= DIFFICULTY.jellyLevel
      ? Math.min(
          DIFFICULTY.jellyCap,
          DIFFICULTY.jellyStart + DIFFICULTY.jellyPerLevel * (level - DIFFICULTY.jellyLevel)
        )
      : 0;
  while (jellies.length < jellyCount) spawnJelly(true);
  while (jellies.length > jellyCount) jellies.pop();
}

function startLevelUp() {
  gameState = 'levelup';
  stateTime = 0;
  const bonus = fishes.length * DIFFICULTY.scoreSurvivor;
  score += bonus;
  addEggs(DIFFICULTY.eggPerLevel);
  levelUpBonus = bonus;
  flash = 0.6;
  currentPhase = 'idle';
  playSound(soundLevel, 0.8);
}
var levelUpBonus = 0;

function startGameOver() {
  gameState = 'gameover';
  stateTime = 0;
  bestScore = Math.max(bestScore, score);
  stopMusic();
  playSound(soundGameOver, 0.8);
  buttonsGameOver = [bigButton('NOCHMAL', resetToStart)];
}

function newElementText(lvl) {
  if (lvl >= DIFFICULTY.bossLevel && lvl % DIFFICULTY.bossEvery === 0) {
    return lvl === DIFFICULTY.bossLevel
      ? 'BOSS: Der Mega-Hai! Nur der ganze Schwarm zusammen ist stark genug.'
      : 'BOSS: Der Mega-Hai kehrt zurück – grösser als je zuvor!';
  }
  if (lvl === DIFFICULTY.jellyLevel) return 'Neu: Quallen! Nicht berühren – sie betäuben und lassen Fische schrumpfen.';
  if (lvl === DIFFICULTY.hammerLevel) return 'Neu: Hammerhaie! Sie zielen kurz – dann sprinten sie los. Ausweichen!';
  if (lvl === DIFFICULTY.currentLevel) return 'Neu: Strömungen treiben alles zur Seite.';
  if (lvl === DIFFICULTY.darkLevel) return 'Neu: Tiefsee – es wird dunkel. Nur eure Fische leuchten.';
  return 'Mehr, grössere und schnellere Haie!';
}

// --- Tastatur-Testmodus ---
function handleTestKeys() {
  if (keyPressedOnce('KeyF')) {
    const egg = eggs[0];
    if (egg) hatchEgg(egg);
    else hatchFish(200 + Math.random() * (W - 400), 300 + Math.random() * 500);
  }
  if (keyPressedOnce('KeyG')) fishes.forEach((f) => growFish(f, 10));
  if (keyPressedOnce('KeyK')) sharks.slice().forEach((s) => killShark(s, []));
  if (keyPressedOnce('KeyL')) {
    sharkQueue = [];
    sharks = [];
  }
}

// --- Zustände ---
function handleStart(grid, dt, ctx) {
  stateTime += dt;
  handleTestKeys();
  eggs.slice().forEach((e) => e.button.handle(grid, dt));
  updateFishes(grid, dt);
  updatePlankton(dt); // nur Deko – gefressen wird erst im Spiel

  renderWorld(ctx, dt);
  drawPlankton(ctx);
  eggs.forEach((e) => drawEgg(ctx, e, dt));
  fishes.forEach((f) => drawFish(ctx, f));
  updateParticles(ctx, dt);

  const bob = Math.sin(time * 1.5) * 8;
  util.renderTextDropShadow({
    ctx,
    text: 'Laser-Shark 2',
    fontSize: '150px',
    fillStyle: COL.textHi,
    x: W / 2,
    y: 175 + bob,
  });
  util.renderTextDropShadow({
    ctx,
    text: 'Der Schwarm schlägt zurück',
    fontSize: '50px',
    dropDistX: 4,
    dropDistY: 4,
    fillStyle: COL.text,
    x: W / 2,
    y: 255,
  });
  util.renderTextDropShadow({
    ctx,
    text: `Leuchtet auf ein Ei, damit euer Fisch schlüpft – ${fishes.length} geschlüpft`,
    fontSize: '40px',
    dropDistX: 3,
    dropDistY: 3,
    fillStyle: COL.egg,
    x: W / 2,
    y: 320,
  });
  buttonsStart.forEach((b) => b.handle(grid, dt));
  updateFloatingTexts(ctx, dt);
  if (keyPressedOnce('Space')) beginGame();
}

function handleGame(grid, dt, ctx) {
  gameTime += dt;
  stateTime += dt;
  handleTestKeys();

  // Haie nachschieben
  sharkSpawnTimer += dt;
  const regular = sharks.filter((s) => !s.minion).length;
  if (
    sharkQueue.length > 0 &&
    regular < activeSharkMax() &&
    sharkSpawnTimer >= DIFFICULTY.sharkSpawnDelay
  ) {
    sharkSpawnTimer = 0;
    spawnShark(sharkQueue.shift());
  }

  // Plankton wächst mit der Schwarmgrösse
  planktonTimer += dt;
  const wantPlankton = Math.min(
    DIFFICULTY.planktonCap,
    DIFFICULTY.planktonBase + fishes.length * DIFFICULTY.planktonPerFish
  );
  if (planktonTimer >= DIFFICULTY.planktonInterval && plankton.length < wantPlankton) {
    planktonTimer = 0;
    spawnPlankton();
  }

  updateCurrent(dt);
  syncReefEggs();
  eggs.slice().forEach((e) => e.button.handle(grid, dt));
  updateFishes(grid, dt);
  updatePlankton(dt);
  eatPlankton();
  updateJellies(dt);
  jellyContacts();
  updateSharks(dt);
  resolveSharkContacts(dt);
  stats.maxFish = Math.max(stats.maxFish, fishes.length);

  shake = Math.max(0, shake - dt);
  ctx.save();
  if (shake > 0) {
    const s = shake * 25;
    ctx.translate((Math.random() - 0.5) * s, (Math.random() - 0.5) * s);
  }
  renderScene(ctx, dt);
  updateFloatingTexts(ctx, dt);
  ctx.restore();
  renderHud(ctx);
  renderFlash(ctx, dt);

  if (fishes.length === 0 && eggReserve <= 0) {
    startGameOver();
  } else if (sharkQueue.length === 0 && sharks.length === 0) {
    startLevelUp();
  }
}

function handleLevelUp(grid, dt, ctx) {
  gameTime += dt;
  stateTime += dt;
  // Fische bleiben steuerbar und dürfen weiterfressen
  syncReefEggs();
  eggs.slice().forEach((e) => e.button.handle(grid, dt));
  updateFishes(grid, dt);
  updatePlankton(dt);
  eatPlankton();
  updateJellies(dt);
  if (Math.random() < dt * 20) {
    burst(Math.random() * W, H + 10, Math.random() < 0.5 ? COL.team : COL.gold, 3, 500, 8);
  }
  renderScene(ctx, dt);

  const t = Math.min(1, stateTime * 3);
  const scale = 0.5 + t * 0.5 + Math.sin(stateTime * 6) * 0.03;
  ctx.save();
  ctx.translate(W / 2, 420);
  ctx.scale(scale, scale);
  util.renderTextDropShadow({
    ctx,
    text: `LEVEL ${level + 1}`,
    fontSize: '170px',
    fillStyle: COL.textHi,
    x: 0,
    y: 0,
  });
  ctx.restore();
  util.renderTextDropShadow({
    ctx,
    text:
      `Alle Haie besiegt! ${fishes.length} Fische überlebt: +${levelUpBonus}, +${DIFFICULTY.eggPerLevel} Eier\n` +
      newElementText(level + 1),
    fontSize: '48px',
    lineHeight: 70,
    dropDistX: 4,
    dropDistY: 4,
    fillStyle: COL.text,
    x: W / 2,
    y: 560,
  });
  updateFloatingTexts(ctx, dt);
  renderHud(ctx);
  renderFlash(ctx, dt);
  if (stateTime >= DIFFICULTY.levelUpDuration) {
    level++;
    startLevel();
    gameState = 'game';
    stateTime = 0;
  }
}

function handleGameOver(grid, dt, ctx) {
  stateTime += dt;
  updateSharks(dt); // die Haie ziehen satt ihre Kreise
  updateJellies(dt);
  updatePlankton(dt);
  renderScene(ctx, dt);
  util.renderTextDropShadow({
    ctx,
    text: 'Der Schwarm ist gefressen!',
    fontSize: '110px',
    fillStyle: COL.bad,
    x: W / 2,
    y: 200,
  });
  const minutes = Math.floor(gameTime / 60);
  const seconds = Math.floor(gameTime % 60)
    .toString()
    .padStart(2, '0');
  util.renderTextDropShadow({
    ctx,
    text:
      `Level ${level} erreicht – ${score} Punkte (Bestwert heute: ${bestScore})\n` +
      `${stats.sharks} Haie und ${stats.bosses} Mega-Haie besiegt\n` +
      `${stats.hatched} Fische geschlüpft, ${stats.lost} gefressen, grösster Schwarm: ${stats.maxFish}\n` +
      `${stats.plankton} Plankton gefressen (${stats.gold} golden), ${stats.stung}x von Quallen erwischt\n` +
      `Spielzeit ${minutes}:${seconds}`,
    fontSize: '40px',
    lineHeight: 56,
    dropDistX: 3,
    dropDistY: 3,
    fillStyle: COL.text,
    x: W / 2,
    y: 290,
  });
  if (stateTime > 1.5) {
    buttonsGameOver.forEach((b) => b.handle(grid, dt));
    if (keyPressedOnce('Space')) resetToStart();
  }
  updateFloatingTexts(ctx, dt);
}

export default {
  name: 'Laser-Shark 2',
  description: `
Die Neuauflage von Laser-Shark: Der Schwarm schlägt zurück!

Leuchtet auf ein Ei – euer Fisch schlüpft und folgt ab dann eurem Laser.
Fresst leuchtendes Plankton, um zu wachsen.

Ein Hai ist nur zu besiegen, wenn mehrere Fische ihn GLEICHZEITIG berühren
und zusammen grösser sind als er – der Ring um den Hai zeigt eure Stärke.
Allein wird man gebissen!

Wer gefressen wurde, brütet am Riff ein neues Ei aus.
Vorsicht vor Quallen, Hammerhaien, Strömungen – und dem Mega-Hai.`,
  image: 'media/img/gametitles/laser-shark-###4###.png',
  init: function () {
    prerender();
    previousKeys = {};
    lastTime = 0;
    resetToStart();
  },
  handle: function (grid) {
    const dt = getDelta();
    time += dt;
    const ctx = MasterCanvas.get2dContext();
    switch (gameState) {
      case 'start':
        handleStart(grid, dt, ctx);
        break;
      case 'game':
        handleGame(grid, dt, ctx);
        break;
      case 'levelup':
        handleLevelUp(grid, dt, ctx);
        break;
      case 'gameover':
        handleGameOver(grid, dt, ctx);
        break;
    }
  },
  stop: function () {
    stopMusic();
    activeSounds.slice().forEach((a) => a.pause());
    activeSounds = [];
  },
};
