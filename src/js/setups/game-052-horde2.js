/**
 * Laser-Horde II – Der grosse Almabtrieb
 *
 * Überarbeitete, feiner abgestimmte Fassung von game-017-thehorde.js (Laser-CowHorde).
 * Die Herde zieht durch eine fraktale Hügellandschaft, das Publikum sind die Hütehunde:
 * Kühe fliehen vor jedem Laserfleck. Ziel ist, die Herde möglichst weit und möglichst vollzählig
 * durch die Hindernisse zu treiben.
 *
 * Ablauf (Szenen): title → spawn → game ⇄ levelup → gameover
 * - TITEL: Start-Knopf füllen (oder Leertaste). Ein paar Probe-Kühe zeigen schon, wie sie flüchten.
 * - SPAWN: Nester anleuchten – jedes volle Nest brütet 4 Kühe aus. Sobald Kühe da sind, erscheint
 *   in der Mitte „LOS!“. Wer mehr Nester ausbrütet, startet mit grösserer (aber schwerer lenkbarer) Herde.
 * - SPIEL: Die Welt scrollt nach links, von rechts kommen Hindernisse – jedes kündigt sich vorher
 *   mit einem pulsierenden Balken am rechten Rand an. Kuh berührt Hindernis → Kuh weg.
 *   Ab und zu kommt ein WEIDE-TOR (zwei Pfosten): jede Kuh, die durch die Lücke läuft, gibt Bonus,
 *   geht mindestens die halbe Herde durch, gibt es „VOLLE HERDE“ obendrauf. Pfosten sind tödlich.
 * - LEVEL: alle DIFFICULTY.levelDuration Sekunden. Neu pro Level:
 *   L1 Felsen · L2 Wirbel (schlingernde Felsen) · L3 Felswände mit Lücke · L4 Kugelblitze, die die Herde
 *   jagen · danach schneller und dichter. Nach DIFFICULTY.maxLevel ist der Almabtrieb geschafft (Sieg),
 *   überlebende Kühe zählen extra.
 * - PUNKTE: pro Sekunde und Kuh, mal Zusammenhalt-Faktor (×1..×2 – eine kompakte Herde zählt doppelt),
 *   plus Tor-Boni. Wildes Herumleuchten mitten in die Herde zersprengt sie: Faktor fällt, Kühe geraten
 *   in Panik und rennen in Felsen.
 *
 * Herdenphysik: stepFlock() – Boids (Zusammenhalt, Ausrichtung, Abstand) plus weiche Fluchtkraft vor
 * Bedrohungen. Eigenständig und exportiert, damit andere Spiele sie wiederverwenden können.
 * Laserflecken kommen aus gui/blobTracker (jeder Fleck ein Hütehund) – kein direkter grid-Zugriff.
 *
 * Licht-Disziplin: Kühe sind nur Konturen mit schwarzem Kern, Landschaft stark gedimmt, Farben nur aus
 * der Laserfarbe mit Hue-Verschiebung 0.25..0.75 – damit die Kamera die Laser sauber erkennt.
 *
 * Tastatur (Test ohne Laser):
 * - Leertaste: Start / LOS / Nochmal
 * - Pfeiltasten: virtueller Hütehund (gestrichelter Ring)
 * - B (gedrückt halten): blobTracker-Test-Laser kreisen über das Bild
 * - 1: ein zufälliges Nest ausbrüten · 2: nächstes Level
 *   (d v g r m h t f F s, PageUp/PageDown/Home sind in view.js für Debug belegt – bewusst nicht genutzt)
 *
 * Unterschiede zu 017: echte Herdenphysik statt reiner Abstossung, Levelzeit läuft nur im Spiel,
 * Hindernisse mit Vorwarnung, Weide-Tore, Zusammenhalt-Faktor, Highscore, Sieg-Bedingung, saubere Resets.
 * Verwandt mit game-024-schaeferei (Schafe in einen Pferch treiben, Wölfe abschiessen) – hier gibt es keine
 * Gegner zum Abschiessen und kein Ziel-Gehege: es ist ein Lauf-und-Ausweich-Spiel mit scrollender Welt.
 *
 * Klassiker: Lemmings (Psygnosis, Amiga 1991) – die Herde läuft, man lenkt nur indirekt;
 * Flock (Mindscape, 1993) – Herdentreiben als Spielprinzip; das Ausweichen aus Scramble (Konami, 1981).
 */

import util, { getRgbSpreadHex, renderTextDropShadow } from '../util.js';
import { createKeyEdge, isKeyDown } from './gui/gridScan.js';
import soundSpawn from '../../../public/media/496199__luminousfridge__player-spawned.ogg';
import soundExplode from '../../../public/media/369952__mischy__plop-1.wav';
import soundGameOver from '../../../public/media/70299__kizilsungur__sonar.wav';
import soundBG from '../../../public/media/517267__foolboymedia__cinematic-stomp.wav';
import soundLevelUp from '../../../public/media/opengameart/Level Up.ogg';
import soundGate from '../../../public/media/opengameart/Item Pickup.ogg';
import soundWin from '../../../public/media/opengameart/Ability Learn.ogg';
var laserConfig = require('../LaserApiConfig.js').default;
var MasterCanvas = require('../MasterCanvas').default;
var guiFillButton = require('./gui/fillButton-ai2').default;
var guiBlobTracker = require('./gui/blobTracker').default;
var createHighscore = require('../util/highscore').default;

const W = 1920;
const H = 1080;

// ---------------------------------------------------------------------------------------------------------
// Einstellungen
// ---------------------------------------------------------------------------------------------------------

/** Herde, Darstellung, Eingabe */
const SETTINGS = {
  nestCols: 6,
  nestRows: 4,
  nestRadius: 62,
  cowsPerNest: 4,
  maxCows: 96,
  demoCows: 10,
  cowRadius: 22,
  // Boids
  neighborRadius: 150,
  separationRadius: 58,
  cohesion: 0.9,
  alignment: 1.1,
  separation: 320,
  fleeRadius: 240,
  fleeForce: 1500,
  maxSpeed: 250,
  panicSpeedFactor: 0.8, // bei voller Angst bis zu +80 % schneller
  drag: 1.4,
  wander: 28,
  borderMargin: 95,
  borderForce: 1100,
  homeX: 760, // die Herde zieht es sanft hierhin (Platz zum Ausweichen nach rechts und links)
  homePull: 0.12,
  rockShy: 0.45, // Gewicht der Scheu vor Felsen (Laser = 1)
  rockShyDistance: 70, // ab so viel px vor dem Felsrand
  // Sonstiges
  dogSpeed: 750,
  laserTestKey: 'KeyB',
  maxParticles: 400,
  maxFloaters: 40,
  levelUpDuration: 2.4,
  againDelay: 1.5,
};

/** Balancing pro Level */
const DIFFICULTY = {
  levelDuration: 22, // Sekunden pro Level
  maxLevel: 10, // danach: Almabtrieb geschafft
  scrollStart: 140, // px/s
  scrollPerLevel: 20,
  spawnIntervalStart: 2.6,
  spawnIntervalFactor: 0.88,
  spawnIntervalMin: 0.75,
  warningTime: 1.5, // Vorwarnung am rechten Rand
  rockRadiusMin: 45,
  rockRadiusMax: 105,
  wobbleFromLevel: 2,
  wobbleAmp: 160,
  wallFromLevel: 3,
  wallChance: 0.3,
  wallGapStart: 400,
  wallGapPerLevel: -18,
  wallGapMin: 260,
  ballFromLevel: 4,
  ballChance: 0.25,
  ballHunt: 70, // px/s vertikal Richtung Herde
  gateInterval: 10,
  gateGap: 320,
  gatePostRadius: 26,
  gateBonusPerCow: 20,
  fullHerdBonus: 250,
  distancePerPx: 0.02, // Meter pro Scroll-Pixel
  winBonusPerCow: 150,
};

const LEVEL_NEWS = {
  1: 'Felsen – drumherum treiben!',
  2: 'Wirbel: schlingernde Felsen',
  3: 'Felswände – findet die Lücke!',
  4: 'Kugelblitze jagen die Herde',
  5: 'Schneller!',
  6: 'Dichter!',
  7: 'Noch schneller!',
  8: 'Gewittersturm',
  9: 'Fast im Tal ...',
  10: 'Letzte Etappe!',
};

// ---------------------------------------------------------------------------------------------------------
// Zustand (vorbelegt, damit handle() auch ohne init() läuft)
// ---------------------------------------------------------------------------------------------------------

const STATE = {
  scene: 'title',
  sceneTime: 0,
  time: 0,
  level: 1,
  levelTime: 0,
  gameTime: 0,
  scroll: 0,
  distance: 0,
  score: 0,
  cohesionMult: 1,
  spawnTimer: 0,
  gateTimer: 0,
  shake: 0,
  flash: 0,
  nextId: 1,
  startAmount: 0,
  won: false,
  newHighscore: false,
  herdX: W / 2,
  herdY: H / 2,
  herdSpread: 0,
};

const STATS = {
  gatesPassed: 0,
  cowsThroughGates: 0,
  fullHerdGates: 0,
  lost: 0,
  panicSeconds: 0,
  maxHerd: 0,
};

const dog = { x: W / 2, y: H / 2, active: 0 };

var cows = [];
var nests = null; // wird in der Spawn-Szene lazy erzeugt
var obstacles = [];
var gates = [];
var particles = [];
var floaters = [];
var deathgram = [];
var threats = [];

var startButton = null;
var goButton = null;
var againButton = null;
var lasers = null;
var bgSound = null;
var keyEdge = createKeyEdge();
var highscore = createHighscore('Laser-Horde II', 'punkte');

var PAL = null;
var palKey = '';
var bgLayers = null;

// ---------------------------------------------------------------------------------------------------------
// Herdenphysik (wiederverwendbar)
// ---------------------------------------------------------------------------------------------------------

/**
 * Ein Schritt Boids-Herdenphysik.
 * agents: [{ x, y, vx, vy, seed, phase }] (werden verändert; agent.fear 0..1 wird gesetzt)
 * threats: [{ x, y, r?, w? }] – Punkte, vor denen geflohen wird (Laser, Hunde ...);
 *          optional eigener Radius r (Standard cfg.fleeRadius) und Gewicht w (Standard 1).
 *          Nur Bedrohungen mit w >= 1 erzeugen Angst (agent.fear) – schwache Scheu z. B. vor Felsen nicht.
 * cfg: wie SETTINGS (neighborRadius, separationRadius, cohesion, alignment, separation, fleeRadius,
 *      fleeForce, maxSpeed, panicSpeedFactor, drag, wander, borderMargin, borderForce, homeX, homePull)
 * bounds: { width, height }
 * O(n²) über die Herde – für ~100 Tiere unkritisch.
 */
export function stepFlock(agents, threatList, dt, cfg, bounds) {
  const n = agents.length;
  const nr2 = cfg.neighborRadius * cfg.neighborRadius;
  const sr = cfg.separationRadius;
  const sr2 = sr * sr;
  const fr = cfg.fleeRadius;
  const m = cfg.borderMargin;
  for (let i = 0; i < n; i++) {
    const a = agents[i];
    let cx = 0;
    let cy = 0;
    let avx = 0;
    let avy = 0;
    let sx = 0;
    let sy = 0;
    let count = 0;
    for (let j = 0; j < n; j++) {
      if (i === j) continue;
      const b = agents[j];
      const dx = b.x - a.x;
      const dy = b.y - a.y;
      const d2 = dx * dx + dy * dy;
      if (d2 >= nr2) continue;
      count++;
      cx += b.x;
      cy += b.y;
      avx += b.vx;
      avy += b.vy;
      if (d2 < sr2) {
        const d = Math.sqrt(d2) || 0.01;
        const f = 1 - d / sr;
        sx -= (dx / d) * f;
        sy -= (dy / d) * f;
      }
    }
    let ax = 0;
    let ay = 0;
    if (count > 0) {
      ax += (cx / count - a.x) * cfg.cohesion + (avx / count - a.vx) * cfg.alignment;
      ay += (cy / count - a.y) * cfg.cohesion + (avy / count - a.vy) * cfg.alignment;
    }
    ax += sx * cfg.separation;
    ay += sy * cfg.separation;

    // Flucht: weich mit (1 - d/R)²
    let fear = 0;
    for (let t = 0; t < threatList.length; t++) {
      const th = threatList[t];
      const dx = a.x - th.x;
      const dy = a.y - th.y;
      const d = Math.sqrt(dx * dx + dy * dy);
      const R = th.r || fr;
      if (d >= R) continue;
      const w = th.w === undefined ? 1 : th.w;
      const f = (1 - d / R) * (1 - d / R);
      if (d < 0.01) {
        ax += Math.cos(a.seed) * cfg.fleeForce * w;
        ay += Math.sin(a.seed) * cfg.fleeForce * w;
      } else {
        ax += (dx / d) * f * cfg.fleeForce * w;
        ay += (dy / d) * f * cfg.fleeForce * w;
      }
      if (w >= 1) fear = Math.max(fear, f);
    }
    a.fear = fear;

    // weiche Ränder
    if (a.x < m) ax += ((m - a.x) / m) * cfg.borderForce;
    if (a.x > bounds.width - m) ax -= ((a.x - (bounds.width - m)) / m) * cfg.borderForce;
    if (a.y < m) ay += ((m - a.y) / m) * cfg.borderForce;
    if (a.y > bounds.height - m) ay -= ((a.y - (bounds.height - m)) / m) * cfg.borderForce;

    // Heimweh + Grasen
    ax += (cfg.homeX - a.x) * cfg.homePull;
    a.phase += dt;
    ax += Math.cos(a.phase * 0.7 + a.seed) * cfg.wander;
    ay += Math.sin(a.phase * 0.9 + a.seed * 2) * cfg.wander;

    a.ax = ax;
    a.ay = ay;
  }
  // Integrieren erst nach allen Kräften (alle sehen denselben Stand)
  const damp = Math.max(0, 1 - cfg.drag * dt);
  for (let i = 0; i < n; i++) {
    const a = agents[i];
    a.vx = (a.vx + a.ax * dt) * damp;
    a.vy = (a.vy + a.ay * dt) * damp;
    const max = cfg.maxSpeed * (1 + a.fear * cfg.panicSpeedFactor);
    const sp = Math.sqrt(a.vx * a.vx + a.vy * a.vy);
    if (sp > max) {
      a.vx = (a.vx / sp) * max;
      a.vy = (a.vy / sp) * max;
    }
    a.x = Math.max(10, Math.min(bounds.width - 10, a.x + a.vx * dt));
    a.y = Math.max(10, Math.min(bounds.height - 10, a.y + a.vy * dt));
  }
}

// ---------------------------------------------------------------------------------------------------------
// Hilfen
// ---------------------------------------------------------------------------------------------------------

/** Farbe aus der Laserfarbe; Hue immer im Komplementärbereich 0.25..0.75 */
function col(h, s, v) {
  const hue = Math.max(0.25, Math.min(0.75, h));
  return getRgbSpreadHex(laserConfig.testColor, hue, s, v);
}

function ensurePalette() {
  const key = String(laserConfig.testColor);
  if (PAL && key === palKey) return;
  palKey = key;
  PAL = {
    cows: [col(0.3, 0.55, 0.9), col(0.42, 0.5, 0.9), col(0.56, 0.5, 0.9), col(0.66, 0.45, 0.9)],
    cowPanic: col(0.74, 0.85, 1),
    rock: col(0.5, 0.45, 0.65),
    rockInner: col(0.47, 0.45, 0.3),
    wobble: col(0.62, 0.6, 0.75),
    ball: col(0.72, 0.75, 0.95),
    ballCore: col(0.7, 0.5, 0.35),
    gate: col(0.3, 0.7, 0.9),
    gateDim: col(0.3, 0.6, 0.3),
    warn: col(0.7, 0.85, 0.95),
    hud: col(0.4, 0.45, 0.85),
    hudDim: col(0.4, 0.35, 0.5),
    title: col(0.36, 0.6, 0.95),
    sub: col(0.6, 0.45, 0.8),
    hillFar: col(0.58, 0.5, 0.08),
    hillFarEdge: col(0.58, 0.45, 0.24),
    hillNear: col(0.45, 0.5, 0.11),
    hillNearEdge: col(0.45, 0.45, 0.32),
    wave: col(0.52, 0.4, 0.2),
    deathgram: col(0.7, 0.6, 0.75),
    deathgramDim: col(0.7, 0.4, 0.3),
    flash: col(0.5, 0.25, 1),
    nest: [col(0.3, 0.6, 0.55), col(0.3, 0.6, 0.75), col(0.3, 0.6, 0.95)],
    go: [col(0.45, 0.6, 0.6), col(0.45, 0.6, 0.8), col(0.45, 0.6, 1)],
  };
  bgLayers = null; // neue Farben → Hintergrund neu vorrendern
}

function playSound(src, volume) {
  try {
    const a = new Audio(src);
    a.volume = volume === undefined ? 1 : volume;
    const p = a.play();
    if (p && p.catch) p.catch(() => {});
    return a;
  } catch (e) {
    return null;
  }
}

function stopMusic() {
  if (bgSound) {
    try {
      bgSound.pause();
    } catch (e) {
      // egal
    }
    bgSound = null;
  }
}

function setScene(name) {
  STATE.scene = name;
  STATE.sceneTime = 0;
}

function scrollSpeed() {
  return DIFFICULTY.scrollStart + (STATE.level - 1) * DIFFICULTY.scrollPerLevel;
}

function spawnInterval() {
  return Math.max(
    DIFFICULTY.spawnIntervalMin,
    DIFFICULTY.spawnIntervalStart * Math.pow(DIFFICULTY.spawnIntervalFactor, STATE.level - 1)
  );
}

function makeCow(x, y) {
  return {
    id: STATE.nextId++,
    x,
    y,
    vx: (Math.random() - 0.5) * 120,
    vy: (Math.random() - 0.5) * 120,
    ax: 0,
    ay: 0,
    seed: Math.random() * 100,
    phase: Math.random() * 10,
    edges: 5 + Math.floor(Math.random() * 3),
    tint: Math.floor(Math.random() * 4),
    fear: 0,
    lastGate: 0,
    age: 0,
  };
}

function addParticles(x, y, count, color, speed) {
  for (let i = 0; i < count && particles.length < SETTINGS.maxParticles; i++) {
    const a = Math.random() * Math.PI * 2;
    const s = (0.3 + Math.random()) * (speed || 220);
    const life = 0.5 + Math.random() * 0.7;
    particles.push({ x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s, life, max: life, color, size: 3 + Math.random() * 5 });
  }
}

function addFloater(x, y, text, color) {
  if (floaters.length >= SETTINGS.maxFloaters) floaters.shift();
  floaters.push({ x, y, text, color, life: 1.4 });
}

function resetRun() {
  cows = [];
  nests = null;
  obstacles = [];
  gates = [];
  particles = [];
  floaters = [];
  deathgram = [];
  threats = [];
  STATE.level = 1;
  STATE.levelTime = 0;
  STATE.gameTime = 0;
  STATE.distance = 0;
  STATE.score = 0;
  STATE.cohesionMult = 1;
  STATE.spawnTimer = 1.5;
  STATE.gateTimer = DIFFICULTY.gateInterval * 0.6;
  STATE.shake = 0;
  STATE.flash = 0;
  STATE.startAmount = 0;
  STATE.won = false;
  STATE.newHighscore = false;
  STATS.gatesPassed = 0;
  STATS.cowsThroughGates = 0;
  STATS.fullHerdGates = 0;
  STATS.lost = 0;
  STATS.panicSeconds = 0;
  STATS.maxHerd = 0;
  goButton = null;
  againButton = null;
  if (lasers) lasers.reset();
}

function resetAll() {
  stopMusic();
  resetRun();
  startButton = null;
  lasers = null;
  keyEdge = createKeyEdge();
  dog.active = 0;
  setScene('title');
}

// ---------------------------------------------------------------------------------------------------------
// Komponenten (lazy)
// ---------------------------------------------------------------------------------------------------------

function ensureLasers() {
  if (lasers) return;
  lasers = guiBlobTracker({
    minCells: 1,
    mergeDistance: 40,
    maxBlobs: 48,
    keepTime: 0.15,
    testKey: SETTINGS.laserTestKey,
  });
}

function makeButton(label, x, y, radius, colors, onActive) {
  return guiFillButton({
    label,
    posX: x,
    posY: y,
    radius,
    edges: 6 + Math.floor(Math.random() * 4),
    angle: Math.random() * 360,
    speedUp: 45,
    speedDown: 20,
    activeValue: 85,
    lineWidth: 4,
    normalColor: colors[0],
    growColor: colors[1],
    activeColor: colors[2],
    onEnterActive: onActive,
  });
}

function createNests() {
  nests = [];
  const r = SETTINGS.nestRadius;
  for (let i = 0; i < SETTINGS.nestCols; i++) {
    for (let j = 0; j < SETTINGS.nestRows; j++) {
      const x = 210 + (i * (W - 420)) / (SETTINGS.nestCols - 1);
      const y = 190 + (j * (H - 380)) / (SETTINGS.nestRows - 1);
      // Mitte für den LOS-Knopf frei lassen
      if (Math.abs(x - W / 2) < 260 && Math.abs(y - H / 2) < 200) continue;
      const nest = guiFillButton({
        label: '',
        posX: x + (Math.random() - 0.5) * 40,
        posY: y + (Math.random() - 0.5) * 40,
        radius: r,
        edges: 5 + Math.floor(Math.random() * 4),
        angle: Math.random() * 360,
        speedUp: 55,
        speedDown: 12,
        activeValue: 90,
        lineWidth: 3,
        normalColor: PAL.nest[0],
        growColor: PAL.nest[1],
        activeColor: PAL.nest[2],
        onEnterActive: () => hatch(nest),
      });
      nests.push(nest);
    }
  }
}

function hatch(nest) {
  const idx = nests ? nests.indexOf(nest) : -1;
  if (idx < 0) return;
  nests.splice(idx, 1);
  playSound(soundSpawn, 0.7);
  addParticles(nest.getX(), nest.getY(), 24, PAL.nest[2], 260);
  for (let i = 0; i < SETTINGS.cowsPerNest && cows.length < SETTINGS.maxCows; i++) {
    const a = (i / SETTINGS.cowsPerNest) * Math.PI * 2;
    cows.push(makeCow(nest.getX() + Math.cos(a) * 30, nest.getY() + Math.sin(a) * 30));
  }
}

// ---------------------------------------------------------------------------------------------------------
// Szenenwechsel
// ---------------------------------------------------------------------------------------------------------

function goToSpawn() {
  resetRun();
  setScene('spawn');
}

function startGame() {
  if (cows.length === 0) return;
  STATE.startAmount = cows.length;
  STATS.maxHerd = cows.length;
  nests = null;
  goButton = null;
  setScene('game');
  stopMusic();
  bgSound = playSound(soundBG, 0.5);
  if (bgSound) bgSound.loop = true;
}

function finish(won) {
  STATE.won = won;
  if (won) {
    STATE.score += cows.length * DIFFICULTY.winBonusPerCow;
    playSound(soundWin);
  } else {
    playSound(soundGameOver);
  }
  stopMusic();
  highscore.addEntry({
    punkte: Math.round(STATE.score),
    distanz: Math.round(STATE.distance),
    ueberlebt: cows.length,
    level: STATE.level,
    tore: STATS.gatesPassed,
  });
  STATE.newHighscore = highscore.lastEntryNewHighscore();
  againButton = null;
  setScene('gameover');
}

// ---------------------------------------------------------------------------------------------------------
// Spiel-Logik
// ---------------------------------------------------------------------------------------------------------

function updateThreats(grid, dt) {
  ensureLasers();
  lasers.handle(grid, dt);
  threats.length = 0;
  lasers.getBlobs().forEach((b) => threats.push({ x: b.x, y: b.y }));

  // virtueller Hund (Pfeiltasten)
  let mx = 0;
  let my = 0;
  if (isKeyDown('ArrowLeft')) mx -= 1;
  if (isKeyDown('ArrowRight')) mx += 1;
  if (isKeyDown('ArrowUp')) my -= 1;
  if (isKeyDown('ArrowDown')) my += 1;
  if (mx || my) {
    dog.active = 1.5;
    dog.x = Math.max(0, Math.min(W, dog.x + mx * SETTINGS.dogSpeed * dt));
    dog.y = Math.max(0, Math.min(H, dog.y + my * SETTINGS.dogSpeed * dt));
  } else {
    dog.active = Math.max(0, dog.active - dt);
  }
  if (dog.active > 0) threats.push({ x: dog.x, y: dog.y });
}

function updateHerdStats() {
  if (cows.length === 0) {
    STATE.herdSpread = 0;
    return;
  }
  let sx = 0;
  let sy = 0;
  cows.forEach((c) => {
    sx += c.x;
    sy += c.y;
  });
  STATE.herdX = sx / cows.length;
  STATE.herdY = sy / cows.length;
  let sd = 0;
  cows.forEach((c) => {
    sd += Math.hypot(c.x - STATE.herdX, c.y - STATE.herdY);
  });
  STATE.herdSpread = sd / cows.length;
}

function spawnObstacle() {
  const lvl = STATE.level;
  const roll = Math.random();
  if (lvl >= DIFFICULTY.wallFromLevel && roll < DIFFICULTY.wallChance) {
    // Felswand mit Lücke
    const gap = Math.max(
      DIFFICULTY.wallGapMin,
      DIFFICULTY.wallGapStart + (lvl - DIFFICULTY.wallFromLevel) * DIFFICULTY.wallGapPerLevel
    );
    const gapY = 120 + gap / 2 + Math.random() * (H - 240 - gap);
    const r = 58;
    for (let y = r; y < H; y += r * 1.7) {
      if (Math.abs(y - gapY) < gap / 2 + r * 0.6) continue;
      obstacles.push(makeObstacle('rock', y, r));
    }
    return;
  }
  if (lvl >= DIFFICULTY.ballFromLevel && roll < DIFFICULTY.wallChance + DIFFICULTY.ballChance) {
    obstacles.push(makeObstacle('ball', 150 + Math.random() * (H - 300), 42));
    return;
  }
  const r = DIFFICULTY.rockRadiusMin + Math.random() * (DIFFICULTY.rockRadiusMax - DIFFICULTY.rockRadiusMin);
  const type = lvl >= DIFFICULTY.wobbleFromLevel && Math.random() < 0.4 ? 'wobble' : 'rock';
  obstacles.push(makeObstacle(type, r + Math.random() * (H - 2 * r), r));
}

function makeObstacle(type, y, r) {
  return {
    type,
    x: W + r + 10,
    y,
    baseY: y,
    r,
    warn: DIFFICULTY.warningTime,
    t: Math.random() * 10,
    angle: Math.random() * Math.PI * 2,
    spin: (Math.random() - 0.5) * 1.2,
    edges: 5 + Math.floor(Math.random() * 5),
  };
}

function spawnGate() {
  const gap = DIFFICULTY.gateGap;
  gates.push({
    id: STATE.nextId++,
    x: W + 60,
    y: 160 + gap / 2 + Math.random() * (H - 320 - gap),
    gap,
    passed: 0,
    done: false,
    warn: DIFFICULTY.warningTime,
  });
  STATE.spawnTimer = Math.max(STATE.spawnTimer, 1.6); // Tor nicht direkt mit Felsen zukleistern
}

function killCow(cow, color) {
  const idx = cows.indexOf(cow);
  if (idx < 0) return;
  cows.splice(idx, 1);
  STATS.lost++;
  addParticles(cow.x, cow.y, 18, color || PAL.cowPanic, 300);
  STATE.shake = Math.min(18, STATE.shake + 6);
  deathgram.push({ time: STATE.gameTime, count: cows.length });
  playSound(soundExplode, 0.6);
}

function updateObstacles(dt) {
  const speed = scrollSpeed();
  obstacles.slice().forEach((o) => {
    o.t += dt;
    o.angle += o.spin * dt;
    if (o.warn > 0) {
      o.warn -= dt;
      return;
    }
    if (o.type === 'ball') {
      o.x -= speed * 0.75 * dt;
      const dy = STATE.herdY - o.y;
      o.y += Math.max(-1, Math.min(1, dy / 80)) * DIFFICULTY.ballHunt * dt;
    } else {
      o.x -= speed * dt;
      if (o.type === 'wobble') o.y = o.baseY + Math.sin(o.t * 1.3) * DIFFICULTY.wobbleAmp * 0.5;
    }
    if (o.x < -o.r - 20) {
      obstacles.splice(obstacles.indexOf(o), 1);
      return;
    }
    cows.slice().forEach((c) => {
      const d = Math.hypot(c.x - o.x, c.y - o.y);
      if (d < o.r + SETTINGS.cowRadius * 0.8) killCow(c, o.type === 'ball' ? PAL.ball : PAL.rock);
    });
  });
}

function updateGates(dt) {
  const speed = scrollSpeed();
  gates.slice().forEach((g) => {
    if (g.warn > 0) {
      g.warn -= dt;
      return;
    }
    g.x -= speed * dt;
    const pr = DIFFICULTY.gatePostRadius;
    const postA = g.y - g.gap / 2;
    const postB = g.y + g.gap / 2;
    cows.slice().forEach((c) => {
      // Pfosten sind Felsen
      if (Math.hypot(c.x - g.x, c.y - postA) < pr + SETTINGS.cowRadius * 0.8 ||
          Math.hypot(c.x - g.x, c.y - postB) < pr + SETTINGS.cowRadius * 0.8) {
        killCow(c, PAL.gate);
        return;
      }
      if (c.lastGate !== g.id && Math.abs(c.x - g.x) < 25 && c.y > postA + pr && c.y < postB - pr) {
        c.lastGate = g.id;
        g.passed++;
        STATS.cowsThroughGates++;
        const bonus = DIFFICULTY.gateBonusPerCow * STATE.level;
        STATE.score += bonus;
        addFloater(c.x, c.y - 30, '+' + bonus, PAL.gate);
        addParticles(c.x, c.y, 6, PAL.gate, 160);
      }
    });
    if (!g.done && g.x < STATE.herdX - 260) {
      g.done = true;
      if (g.passed > 0) {
        STATS.gatesPassed++;
        playSound(soundGate, 0.7);
        if (g.passed >= Math.max(1, cows.length) / 2) {
          const bonus = DIFFICULTY.fullHerdBonus * STATE.level;
          STATE.score += bonus;
          STATS.fullHerdGates++;
          STATE.flash = 0.5;
          addFloater(g.x, g.y, 'VOLLE HERDE +' + bonus, PAL.gate);
        }
      }
    }
    if (g.x < -100) gates.splice(gates.indexOf(g), 1);
  });
}

function updateParticles(dt) {
  particles.slice().forEach((p) => {
    p.life -= dt;
    if (p.life <= 0) {
      particles.splice(particles.indexOf(p), 1);
      return;
    }
    p.x += p.vx * dt;
    p.y += p.vy * dt;
    p.vx *= 1 - 2 * dt;
    p.vy *= 1 - 2 * dt;
  });
  floaters.slice().forEach((f) => {
    f.life -= dt;
    f.y -= 60 * dt;
    if (f.life <= 0) floaters.splice(floaters.indexOf(f), 1);
  });
}

function updatePlay(dt, allowSpawns) {
  // Kühe scheuen Hindernisse leicht aus nächster Nähe – ausweichen müsst ihr sie trotzdem lassen
  obstacles.forEach((o) => {
    if (o.warn <= 0) threats.push({ x: o.x, y: o.y, r: o.r + SETTINGS.rockShyDistance, w: SETTINGS.rockShy });
  });
  gates.forEach((g) => {
    if (g.warn > 0) return;
    const pr = DIFFICULTY.gatePostRadius + SETTINGS.rockShyDistance;
    threats.push({ x: g.x, y: g.y - g.gap / 2, r: pr, w: SETTINGS.rockShy });
    threats.push({ x: g.x, y: g.y + g.gap / 2, r: pr, w: SETTINGS.rockShy });
  });
  stepFlock(cows, threats, dt, SETTINGS, { width: W, height: H });
  updateHerdStats();
  cows.forEach((c) => {
    c.age += dt;
    if (c.fear > 0.6) STATS.panicSeconds += dt / Math.max(1, cows.length);
  });

  const speed = scrollSpeed();
  STATE.scroll += speed * dt;
  STATE.distance += speed * dt * DIFFICULTY.distancePerPx;
  STATE.gameTime += dt;

  // Zusammenhalt: kompakte Herde zählt bis doppelt
  const targetMult = 1 + Math.max(0, Math.min(1, (360 - STATE.herdSpread) / 260));
  STATE.cohesionMult += (targetMult - STATE.cohesionMult) * Math.min(1, dt * 2);
  STATE.score += dt * cows.length * STATE.cohesionMult;

  if (allowSpawns) {
    STATE.spawnTimer -= dt;
    if (STATE.spawnTimer <= 0) {
      spawnObstacle();
      STATE.spawnTimer = spawnInterval() * (0.75 + Math.random() * 0.5);
    }
    STATE.gateTimer -= dt;
    if (STATE.gateTimer <= 0) {
      spawnGate();
      STATE.gateTimer = DIFFICULTY.gateInterval * (0.8 + Math.random() * 0.4);
    }
  }
  updateObstacles(dt);
  updateGates(dt);
}

function levelUp() {
  if (STATE.level >= DIFFICULTY.maxLevel) {
    finish(true);
    return;
  }
  STATE.level++;
  STATE.levelTime = 0;
  STATE.flash = 0.8;
  playSound(soundLevelUp);
  addParticles(W / 2, H / 2, 60, PAL.flash, 500);
  setScene('levelup');
}

// ---------------------------------------------------------------------------------------------------------
// Zeichnen
// ---------------------------------------------------------------------------------------------------------

/** Tilebare fraktale Hügel (fBm aus Sinus-Oktaven mit ganzzahligen Frequenzen) einmal vorrendern */
function buildLayer(baseY, amp, octaves, seed, fill, edge) {
  const c = document.createElement('canvas');
  c.width = W;
  c.height = H;
  const g = c.getContext('2d');
  const ys = [];
  for (let x = 0; x <= W; x += 4) {
    let y = 0;
    let a = 1;
    let f = 2;
    for (let k = 0; k < octaves; k++) {
      y += a * Math.sin((x / W) * Math.PI * 2 * f + seed * (k + 1));
      a *= 0.5;
      f *= 2;
    }
    ys.push(baseY + y * amp);
  }
  g.beginPath();
  g.moveTo(0, H);
  ys.forEach((y, i) => g.lineTo(i * 4, y));
  g.lineTo(W, H);
  g.closePath();
  g.fillStyle = fill;
  g.fill();
  g.beginPath();
  ys.forEach((y, i) => (i === 0 ? g.moveTo(0, y) : g.lineTo(i * 4, y)));
  g.strokeStyle = edge;
  g.lineWidth = 3;
  g.stroke();
  return c;
}

function ensureBackground() {
  if (bgLayers) return;
  bgLayers = [
    { canvas: buildLayer(H * 0.55, 110, 6, 1.7, PAL.hillFar, PAL.hillFarEdge), factor: 0.25 },
    { canvas: buildLayer(H * 0.78, 70, 5, 4.2, PAL.hillNear, PAL.hillNearEdge), factor: 0.6 },
  ];
}

function renderBackground(ctx) {
  ensureBackground();
  bgLayers.forEach((l) => {
    const off = (STATE.scroll * l.factor) % W;
    ctx.drawImage(l.canvas, -off, 0);
    ctx.drawImage(l.canvas, W - off, 0);
  });
  // dünne Wind-Wellen (Erbe von 017), stark gedimmt
  ctx.save();
  ctx.strokeStyle = PAL.wave;
  ctx.lineWidth = 2;
  ctx.globalAlpha = 0.6;
  for (let k = 0; k < 3; k++) {
    ctx.beginPath();
    const base = 120 + k * 90;
    for (let x = 0; x <= W; x += 16) {
      const t = STATE.time * (0.3 + k * 0.15) + (x + STATE.scroll * (0.1 + k * 0.05)) * 0.004;
      const y = base + (Math.sin(t) + Math.sin(t * 2.1) * 0.5 + Math.sin(t * 0.5) * 0.7) * 25;
      if (x === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.stroke();
  }
  ctx.restore();
}

function polyPath(ctx, x, y, r, edges, angle, wobble) {
  ctx.beginPath();
  for (let i = 0; i <= edges; i++) {
    const a = angle + (i / edges) * Math.PI * 2;
    const rr = r * (1 + (wobble || 0) * Math.sin((i % edges) * 2.3 + angle * 3)); // letzte = erste Ecke
    const px = x + Math.cos(a) * rr;
    const py = y + Math.sin(a) * rr;
    if (i === 0) ctx.moveTo(px, py);
    else ctx.lineTo(px, py);
  }
  ctx.closePath();
}

function renderCows(ctx) {
  const r = SETTINGS.cowRadius;
  ctx.save();
  ctx.lineWidth = 3;
  cows.forEach((c) => {
    const heading = Math.atan2(c.vy, c.vx);
    const pop = Math.min(1, c.age * 4);
    const panic = c.fear > 0.6;
    const jitter = panic ? Math.sin(STATE.time * 40 + c.seed) * 3 : 0;
    const x = c.x + jitter;
    const y = c.y;
    const color = panic ? PAL.cowPanic : PAL.cows[c.tint];
    // Körper: Kontur mit schwarzem Kern (Laser auf der Kuh bleibt gut sichtbar)
    polyPath(ctx, x, y, r * pop, c.edges, heading + Math.sin(c.phase * 2) * 0.15, 0.08);
    ctx.fillStyle = '#000000';
    ctx.fill();
    ctx.strokeStyle = color;
    ctx.stroke();
    // Kopf
    const hx = x + Math.cos(heading) * r * 1.15 * pop;
    const hy = y + Math.sin(heading) * r * 1.15 * pop;
    ctx.beginPath();
    ctx.arc(hx, hy, r * 0.42 * pop, 0, Math.PI * 2);
    ctx.fillStyle = '#000000';
    ctx.fill();
    ctx.stroke();
    // Hörner
    ctx.beginPath();
    const hornA = heading + Math.PI / 2;
    ctx.moveTo(hx + Math.cos(hornA) * r * 0.35, hy + Math.sin(hornA) * r * 0.35);
    ctx.lineTo(hx + Math.cos(hornA + 0.6) * r * 0.75, hy + Math.sin(hornA + 0.6) * r * 0.75);
    ctx.moveTo(hx - Math.cos(hornA) * r * 0.35, hy - Math.sin(hornA) * r * 0.35);
    ctx.lineTo(hx - Math.cos(hornA - 0.6) * r * 0.75, hy - Math.sin(hornA - 0.6) * r * 0.75);
    ctx.stroke();
  });
  ctx.restore();
}

function renderObstacles(ctx) {
  ctx.save();
  obstacles.forEach((o) => {
    if (o.warn > 0) return;
    if (o.type === 'ball') {
      const pulse = 1 + Math.sin(o.t * 12) * 0.12;
      ctx.shadowBlur = 25;
      ctx.shadowColor = PAL.ball;
      ctx.strokeStyle = PAL.ball;
      ctx.lineWidth = 4;
      polyPath(ctx, o.x, o.y, o.r * pulse, 9, o.t * 3, 0.35);
      ctx.fillStyle = '#000000';
      ctx.fill();
      ctx.stroke();
      ctx.shadowBlur = 0;
      ctx.strokeStyle = PAL.ballCore;
      polyPath(ctx, o.x, o.y, o.r * 0.5, 5, -o.t * 4, 0.3);
      ctx.stroke();
      return;
    }
    ctx.fillStyle = '#000000';
    ctx.strokeStyle = o.type === 'wobble' ? PAL.wobble : PAL.rock;
    ctx.lineWidth = 4;
    polyPath(ctx, o.x, o.y, o.r, o.edges, o.angle, 0.12);
    ctx.fill();
    ctx.stroke();
    ctx.strokeStyle = PAL.rockInner;
    ctx.lineWidth = 2;
    polyPath(ctx, o.x, o.y, o.r * 0.6, o.edges, -o.angle * 1.5, 0.1);
    ctx.stroke();
  });
  ctx.restore();
}

function renderGates(ctx) {
  const pr = DIFFICULTY.gatePostRadius;
  ctx.save();
  gates.forEach((g) => {
    if (g.warn > 0) return;
    const a = g.y - g.gap / 2;
    const b = g.y + g.gap / 2;
    // gestrichelte Durchgangslinie (dunkel, nur Kontur)
    ctx.setLineDash([14, 14]);
    ctx.lineDashOffset = -STATE.time * 40;
    ctx.strokeStyle = g.done ? PAL.gateDim : PAL.gate;
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(g.x, a + pr);
    ctx.lineTo(g.x, b - pr);
    ctx.stroke();
    ctx.setLineDash([]);
    [a, b].forEach((py) => {
      ctx.beginPath();
      ctx.arc(g.x, py, pr, 0, Math.PI * 2);
      ctx.fillStyle = '#000000';
      ctx.fill();
      ctx.lineWidth = 5;
      ctx.stroke();
    });
    util.renderText({ ctx, text: 'TOR', x: g.x, y: a - pr - 14, fontSize: '32px', fillStyle: PAL.gate });
    if (g.passed > 0) {
      util.renderText({ ctx, text: String(g.passed), x: g.x, y: b + pr + 40, fontSize: '34px', fillStyle: PAL.gate });
    }
  });
  ctx.restore();
}

/** Vorwarnung am rechten Rand (dort laufen keine Kühe – Randkraft) */
function renderWarnings(ctx) {
  ctx.save();
  const pulse = 0.5 + 0.5 * Math.sin(STATE.time * 14);
  obstacles.forEach((o) => {
    if (o.warn <= 0) return;
    ctx.globalAlpha = 0.4 + 0.6 * pulse;
    ctx.fillStyle = o.type === 'ball' ? PAL.ball : PAL.warn;
    ctx.fillRect(W - 16, o.y - o.r, 16, o.r * 2);
    ctx.beginPath();
    ctx.moveTo(W - 24, o.y);
    ctx.lineTo(W - 44, o.y - 14);
    ctx.lineTo(W - 44, o.y + 14);
    ctx.closePath();
    ctx.fill();
  });
  gates.forEach((g) => {
    if (g.warn <= 0) return;
    ctx.globalAlpha = 0.4 + 0.6 * pulse;
    ctx.fillStyle = PAL.gate;
    ctx.fillRect(W - 16, g.y - g.gap / 2 - 20, 16, 40);
    ctx.fillRect(W - 16, g.y + g.gap / 2 - 20, 16, 40);
  });
  ctx.restore();
}

function renderParticles(ctx) {
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  particles.forEach((p) => {
    ctx.globalAlpha = Math.max(0, p.life / p.max);
    ctx.fillStyle = p.color;
    ctx.fillRect(p.x - p.size / 2, p.y - p.size / 2, p.size, p.size);
  });
  ctx.restore();
  floaters.forEach((f) => {
    ctx.save();
    ctx.globalAlpha = Math.min(1, f.life);
    util.renderText({ ctx, text: f.text, x: f.x, y: f.y, fontSize: '40px', fillStyle: f.color });
    ctx.restore();
  });
}

function renderDog(ctx) {
  if (dog.active <= 0) return;
  ctx.save();
  ctx.strokeStyle = PAL.hud;
  ctx.lineWidth = 3;
  ctx.setLineDash([10, 10]);
  ctx.beginPath();
  ctx.arc(dog.x, dog.y, 40, 0, Math.PI * 2);
  ctx.stroke();
  ctx.restore();
}

function renderHerdRing(ctx) {
  if (cows.length < 3) return;
  ctx.save();
  ctx.globalAlpha = 0.35;
  ctx.strokeStyle = STATE.cohesionMult > 1.5 ? PAL.gate : PAL.hudDim;
  ctx.lineWidth = 2;
  ctx.setLineDash([6, 18]);
  ctx.beginPath();
  ctx.arc(STATE.herdX, STATE.herdY, Math.max(60, STATE.herdSpread * 1.4), 0, Math.PI * 2);
  ctx.stroke();
  ctx.restore();
}

function renderHud(ctx) {
  const y = 58;
  util.renderText({ ctx, text: 'Level ' + STATE.level, x: 300, y, fontSize: '46px', fillStyle: PAL.hud });
  util.renderText({ ctx, text: Math.round(STATE.score) + ' Punkte', x: W / 2, y, fontSize: '46px', fillStyle: PAL.hud });
  util.renderText({ ctx, text: Math.round(STATE.distance) + ' m', x: W - 300, y, fontSize: '46px', fillStyle: PAL.hud });
  util.renderText({
    ctx,
    text: 'Herde ' + cows.length + '/' + STATE.startAmount + '    Zusammenhalt ×' + STATE.cohesionMult.toFixed(1),
    x: W / 2,
    y: H - 30,
    fontSize: '40px',
    fillStyle: PAL.hudDim,
  });
  // Level-Fortschritt als dünner Balken oben
  ctx.save();
  ctx.fillStyle = PAL.hudDim;
  ctx.fillRect(0, 0, (W * STATE.levelTime) / DIFFICULTY.levelDuration, 5);
  ctx.restore();
}

function renderFlash(ctx, dt) {
  if (STATE.flash <= 0) return;
  ctx.save();
  ctx.globalAlpha = Math.min(0.35, STATE.flash * 0.4);
  ctx.fillStyle = PAL.flash;
  ctx.fillRect(0, 0, W, H);
  ctx.restore();
  STATE.flash -= dt;
}

function renderWorld(ctx, dt) {
  ctx.save();
  if (STATE.shake > 0) {
    ctx.translate((Math.random() - 0.5) * STATE.shake, (Math.random() - 0.5) * STATE.shake);
    STATE.shake = Math.max(0, STATE.shake - dt * 40);
  }
  renderBackground(ctx);
  renderGates(ctx);
  renderObstacles(ctx);
  renderHerdRing(ctx);
  renderCows(ctx);
  renderParticles(ctx);
  ctx.restore();
  renderWarnings(ctx);
  renderDog(ctx);
}

function renderDeathgram(ctx) {
  const x0 = 560;
  const x1 = 1360;
  const y0 = 640;
  const y1 = 850;
  ctx.save();
  ctx.strokeStyle = PAL.deathgramDim;
  ctx.lineWidth = 2;
  ctx.strokeRect(x0, y0, x1 - x0, y1 - y0);
  const total = Math.max(1, STATE.startAmount);
  const tMax = Math.max(0.001, STATE.gameTime);
  ctx.strokeStyle = PAL.deathgram;
  ctx.lineWidth = 6;
  ctx.beginPath();
  ctx.moveTo(x0, y0);
  let lastY = y0;
  deathgram.forEach((d) => {
    const x = x0 + (d.time / tMax) * (x1 - x0);
    ctx.lineTo(x, lastY); // Treppe: Bestand bleibt bis zum nächsten Verlust
    lastY = y1 - (d.count / total) * (y1 - y0);
    ctx.lineTo(x, lastY);
  });
  ctx.lineTo(x1, lastY);
  ctx.stroke();
  ctx.restore();
  util.renderText({ ctx, text: 'Herdenverlauf', x: (x0 + x1) / 2, y: y0 - 14, fontSize: '30px', fillStyle: PAL.deathgramDim });
}

// ---------------------------------------------------------------------------------------------------------
// Szenen
// ---------------------------------------------------------------------------------------------------------

function handleTitle(grid, dt, ctx) {
  if (cows.length === 0) {
    for (let i = 0; i < SETTINGS.demoCows; i++) cows.push(makeCow(500 + Math.random() * 900, 300 + Math.random() * 500));
  }
  STATE.scroll += 30 * dt;
  stepFlock(cows, threats, dt, SETTINGS, { width: W, height: H });
  cows.forEach((c) => (c.age += dt));
  renderBackground(ctx);
  renderCows(ctx);
  renderParticles(ctx);
  renderDog(ctx);

  renderTextDropShadow({ ctx, text: 'Laser-Horde II', x: W / 2, y: 220, fontSize: '150px', fillStyle: PAL.title });
  util.renderText({ ctx, text: 'Der grosse Almabtrieb', x: W / 2, y: 310, fontSize: '56px', fillStyle: PAL.sub });
  util.renderText({
    ctx,
    text: 'Ihr seid die Hütehunde: Kühe fliehen vor dem Laser.\nTreibt die Herde an Felsen vorbei und durch die Weide-Tore!',
    x: W / 2,
    y: 880,
    fontSize: '40px',
    lineHeight: 56,
    fillStyle: PAL.hudDim,
  });
  if (!startButton) startButton = makeButton('START', W / 2, H / 2 + 60, 130, PAL.go, () => goToSpawn());
  startButton.handle(grid, dt);
  if (keyEdge('Space')) goToSpawn();
  highscore.renderHighAndLowScores(ctx);
}

function handleSpawn(grid, dt, ctx) {
  if (!nests) createNests();
  STATE.scroll += 30 * dt;
  stepFlock(cows, threats, dt, SETTINGS, { width: W, height: H });
  cows.forEach((c) => (c.age += dt));
  renderBackground(ctx);
  nests.slice().forEach((n) => n.handle(grid, dt));
  renderCows(ctx);
  renderParticles(ctx);
  renderDog(ctx);

  util.renderText({
    ctx,
    text: cows.length === 0 ? 'Nester anleuchten – je 4 Kühe schlüpfen!' : 'Mehr Kühe = mehr Punkte, aber schwerer zu hüten',
    x: W / 2,
    y: 70,
    fontSize: '46px',
    fillStyle: PAL.hud,
  });
  util.renderText({ ctx, text: 'Herde: ' + cows.length, x: W / 2, y: H - 30, fontSize: '46px', fillStyle: PAL.hudDim });

  if (keyEdge('Digit1') && nests.length > 0) hatch(nests[Math.floor(Math.random() * nests.length)]);
  if (cows.length > 0) {
    if (!goButton) goButton = makeButton('LOS!', W / 2, H / 2, 110, PAL.go, () => startGame());
    goButton.handle(grid, dt);
  }
  if (keyEdge('Space')) {
    if (cows.length === 0) {
      for (let i = 0; i < 6 && nests.length > 0; i++) hatch(nests[Math.floor(Math.random() * nests.length)]);
    } else {
      startGame();
    }
  }
}

function handleGame(grid, dt, ctx) {
  STATE.levelTime += dt;
  updatePlay(dt, true);
  updateParticles(dt);
  STATS.maxHerd = Math.max(STATS.maxHerd, cows.length);
  renderWorld(ctx, dt);
  renderHud(ctx);
  renderFlash(ctx, dt);

  if (cows.length === 0) {
    finish(false);
    return;
  }
  if (keyEdge('Digit2') || STATE.levelTime >= DIFFICULTY.levelDuration) levelUp();
}

function handleLevelUp(grid, dt, ctx) {
  updatePlay(dt, false);
  updateParticles(dt);
  renderWorld(ctx, dt);
  renderHud(ctx);
  renderFlash(ctx, dt);

  const s = 1 + Math.max(0, 0.4 - STATE.sceneTime) * 1.5;
  ctx.save();
  ctx.translate(W / 2, H / 2 - 40);
  ctx.scale(s, s);
  renderTextDropShadow({ ctx, text: 'LEVEL ' + STATE.level, x: 0, y: 0, fontSize: '150px', fillStyle: PAL.title });
  ctx.restore();
  util.renderText({ ctx, text: LEVEL_NEWS[STATE.level] || 'Weiter so!', x: W / 2, y: H / 2 + 80, fontSize: '56px', fillStyle: PAL.sub });

  if (cows.length === 0) {
    finish(false);
    return;
  }
  if (STATE.sceneTime >= SETTINGS.levelUpDuration) setScene('game');
}

function handleGameOver(grid, dt, ctx) {
  STATE.scroll += 20 * dt;
  stepFlock(cows, threats, dt, SETTINGS, { width: W, height: H });
  renderBackground(ctx);
  renderCows(ctx);
  renderParticles(ctx);

  renderTextDropShadow({
    ctx,
    text: STATE.won ? 'Almabtrieb geschafft!' : 'Herde verloren',
    x: W / 2,
    y: 190,
    fontSize: '130px',
    fillStyle: PAL.title,
  });
  util.renderText({
    ctx,
    text:
      Math.round(STATE.score) + ' Punkte' + (STATE.newHighscore ? '   – NEUER HIGHSCORE!' : '') + '\n' +
      Math.round(STATE.distance) + ' m · Level ' + STATE.level + ' · ' + cows.length + '/' + STATE.startAmount + ' Kühe im Tal\n' +
      STATS.gatesPassed + ' Tore (' + STATS.fullHerdGates + '× volle Herde) · ' + STATS.cowsThroughGates + ' Kühe durch Tore',
    x: W / 2,
    y: 310,
    fontSize: '44px',
    lineHeight: 64,
    fillStyle: PAL.sub,
  });
  renderDeathgram(ctx);
  highscore.renderHighAndLowScores(ctx);

  if (STATE.sceneTime > SETTINGS.againDelay) {
    if (!againButton) againButton = makeButton('NOCHMAL', W / 2, 960, 90, PAL.go, () => goToSpawn());
    againButton.handle(grid, dt);
    if (keyEdge('Space')) goToSpawn();
  } else {
    keyEdge('Space'); // Flanke verbrauchen, damit ein gehaltenes Space nicht sofort neu startet
  }
}

// ---------------------------------------------------------------------------------------------------------
// Export
// ---------------------------------------------------------------------------------------------------------

export default {
  name: 'Laser-Horde II',
  description: `
  Der grosse Almabtrieb!

  Ihr seid die Hütehunde: Die Kühe fliehen vor eurem Laser.
  Erst Nester anleuchten – jedes brütet 4 Kühe aus –, dann LOS.

  Treibt die Herde an Felsen, Wirbeln und Kugelblitzen vorbei
  und durch die Weide-Tore. Eine kompakte Herde zählt doppelt.

  Nicht mitten in die Herde leuchten – sonst gibt's Panik!
  `,
  image: 'media/img/gametitles/laser-cowhorde-###4###.png',

  init: function () {
    resetAll();
  },

  handle: function (grid, elapsed) {
    const dt = Math.min(elapsed || 0, 0.1);
    const ctx = MasterCanvas.get2dContext();
    ensurePalette();
    STATE.time += dt;
    STATE.sceneTime += dt;

    updateThreats(grid, dt);
    if (STATE.scene !== 'game' && STATE.scene !== 'levelup') updateParticles(dt);

    switch (STATE.scene) {
      case 'title':
        handleTitle(grid, dt, ctx);
        break;
      case 'spawn':
        handleSpawn(grid, dt, ctx);
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
      default:
        setScene('title');
    }
  },

  stop: function () {
    stopMusic();
  },
};