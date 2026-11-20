/**
 * Dschungel-Dussel – ein Forscher, kein Plan, viele Laser
 *
 * Jump & Run, bei dem nicht die Figur gesteuert wird, sondern die Welt.
 * Professor Pfefferkorn stapft mit Tropenhelm und Schnurrbart AUTOMATISCH nach rechts durch den Dschungel.
 * Er ist ein Dussel: Er schaut nie hin. Das Publikum räumt ihm die Welt zurecht – an mehreren Stellen gleichzeitig.
 *
 * Gefahren (jede ist eine Laser-„Station“ – unsichtbare GUI-Komponente, gezeichnet wird im Spiel):
 * - KROKODILE (ab L1): Im Teich liegen Krokodile als Trittsteine. Ihre Mäuler gehen von selbst auf und zu.
 *   Schnauze anleuchten → Maul bleibt zu. Steht er auf einem offenen Maul: „Mama!“ – Leben weg.
 * - LIANEN (ab L2): Über einer Schlucht hängt ein Ast. Ast anleuchten, bis er voll ist → die Liane fällt herab
 *   und hält ein paar Sekunden. Ist sie unten, wenn er an der Kante ankommt, schwingt er rüber. Sonst: „Huuuch!“
 * - TEERGRUBEN (ab L3): Breite Fläche – alle zusammen trockenleuchten (mehr Laser = schneller, gui/regionButton).
 *   Ist der Teer nicht hart genug: „Blubb.“ Nur noch eine Silhouette und Bläschen.
 * - ROLLENDE STÄMME (ab L4): Rollen ihm am Hang entgegen. Anleuchten, bis sie zerbröseln.
 *   Trifft ihn einer: „Autsch!“ – kein Leben weg, aber er sitzt kurz auf dem Hosenboden und es kostet Zeit.
 * - SCHÄTZE: schweben über dem Weg. Anleuchten = einsammeln (Punkte + Zeit). Darunter auch Unsinn (Socke, Quietscheente).
 *
 * Strafe für Wildleuchten: Laser auf dem PROFESSOR blenden ihn („Ich seh nix!“) – er schleicht nur noch
 * und setzt sich bei Dauerblendung auf den Hintern. Die Expeditions-Uhr läuft weiter.
 *
 * Level: Am Ende jeder Etappe steht ein Lager (Lagerfeuer) → Level-Up, +Zeit, neue Gefahrenart, schneller.
 * Game Over: keine Leben mehr oder Expeditions-Uhr abgelaufen. Highscore: Punkte, Schätze, Distanz, Leben, Level.
 *
 * Licht-Disziplin: Laufebene und alle Aktionsstellen sind schwarz hinterlegt und nur als Kontur gezeichnet.
 * Der Dschungel im Hintergrund ist ein fraktales L-System, einmal vorgerendert und stark gedimmt.
 *
 * Tastatur (Test ohne Laser):
 * - Leertaste: Start / Nochmal
 * - 1 (halten): alle Krokomäuler zu · 2: Lianen bereit · 3: Teer trocken · 4: Stämme zerbröseln
 * - 5: Schätze auf dem Bildschirm einsammeln · 0 (halten): Professor blenden · 9: zum nächsten Lager springen
 *   (d v g r m h t f F s, PageUp/PageDown/Home sind in view.js Debug-Tasten und hier bewusst frei)
 *
 * Klassiker: Pitfall! (Activision, Atari 2600, 1982) – Lianen, Krokodile, Teer, Stämme, Schätze, Zeitlimit.
 * Anders hier: Die Figur läuft von selbst, das Publikum steuert die Welt – wie bei Lemmings (Amiga 1991),
 * nur mit einem einzigen, sehr tollpatschigen Lemming.
 * Ähnlichkeiten im Bestand: Auto-Läufer wie game-015-flap; „Maul zuhalten“ erinnert an game-030-maulwurf.
 */

import util, { getRgbSpreadHex, renderTextDropShadow } from '../util.js';
import { createKeyEdge, isKeyDown } from './gui/gridScan.js';
import soundSplash from '../../../public/media/485066__javierserrat__object-falls-into-the-water.wav';
import soundPlop from '../../../public/media/369952__mischy__plop-1.wav';
import soundCrumble from '../../../public/media/155235__zangrutz__bomb-small (1).mp3';
import soundMusic from '../../../public/media/522110__setuniman__cheeky-1t41b.wav';
import soundJingle from '../../../public/media/521966__kastenfrosch__ready-to-start-jingle.ogg';
import soundTreasure from '../../../public/media/opengameart/Item Pickup.ogg';
import soundSwing from '../../../public/media/opengameart/Menu Confirm.ogg';
import soundHit from '../../../public/media/opengameart/Menu Error.ogg';
import soundGameOver from '../../../public/media/opengameart/Music Box Game Over III.wav';
var laserConfig = require('../LaserApiConfig.js').default;
var MasterCanvas = require('../MasterCanvas').default;
var guiFillButton = require('./gui/fillButton-ai2').default;
var guiPixelFillButton = require('./gui/pixelFillButton').default;
var guiRegionButton = require('./gui/regionButton').default;
var createHighscore = require('../util/highscore').default;

const W = 1920;
const H = 1080;
const GROUND = 780; // Laufebene (Bildschirm-y)
const HERO_X = 400; // feste Bildschirmposition des Professors
// Krokodil-Station sitzt auf der Schnauze (dort zielen die Leute hin), unterhalb der Blend-Zone des Professors
const CROC_SNOUT_DX = 95;
const CROC_SNOUT_DY = 30;

// ---------------------------------------------------------------------------------------------------------
// Einstellungen
// ---------------------------------------------------------------------------------------------------------

const SETTINGS = {
  startLives: 3,
  startClock: 100, // Sekunden Expeditions-Uhr
  campBonusTime: 35,
  treasureBonusTime: 2,
  logPenaltyTime: 3,
  fallDuration: 2.3,
  tripDuration: 1.3,
  invulTime: 1.8,
  swingDuration: 1.25,
  blindSlow: 0.3, // Tempo-Faktor, wenn geblendet
  blindThreshold: 0.45,
  blindSitTime: 1.4, // so lange Vollblendung → hinsetzen
  levelUpDuration: 2.8,
  againDelay: 1.5,
  maxParticles: 400,
  maxFloaters: 30,
  stationRadius: 64,
};

const DIFFICULTY = {
  walkStart: 150, // px/s
  walkPerLevel: 14,
  walkMax: 300,
  hazardsStart: 4,
  hazardsPerLevel: 1,
  hazardsMax: 10,
  gapStart: 900, // Abstand zwischen Gefahren
  gapPerLevel: -45,
  gapMin: 520,
  crocMouthSpeed: 0.9, // Maul-Zyklus (rad/s)
  crocMouthPerLevel: 0.1,
  crocMaxCount: 4,
  vineFromLevel: 2,
  vineHold: 4.5, // so lange hält eine volle Liane
  pitWidthStart: 360,
  pitWidthPerLevel: 12,
  pitWidthMax: 470,
  tarFromLevel: 3,
  tarWidthStart: 300,
  tarWidthPerLevel: 10,
  tarDryNeed: 80, // Teer-Wert (0..100), ab dem man drüber kann
  logsFromLevel: 4,
  logSpeed: 230,
  logIntervalStart: 2.6,
  logIntervalPerLevel: -0.12,
  logsPerSlope: 3,
  treasureChance: 0.8,
};

const LEVEL_NEWS = {
  1: 'Krokodile: Schnauze anleuchten = Maul zu!',
  2: 'Lianen: Ast anleuchten, dann schwingt er rüber',
  3: 'Teergruben: ALLE zusammen trockenleuchten!',
  4: 'Rollende Stämme: zerbröseln lassen!',
  5: 'Schneller!',
  6: 'Mehr Krokos!',
  7: 'Noch schneller!',
};

const TREASURES = [
  { kind: 'gold', points: 300, label: 'Gold!', weight: 4 },
  { kind: 'diamond', points: 500, label: 'Diamant!', weight: 2 },
  { kind: 'ring', points: 200, label: 'Ring!', weight: 3 },
  { kind: 'sock', points: 5, label: 'Eine ... Socke?', weight: 1 },
  { kind: 'duck', points: 50, label: 'Quietsch!', weight: 1 },
];

const QUIPS = [
  'Hübsch hier!',
  'Ich hab Hunger.',
  'Wo ist die Karte?',
  'Ganz ruhig, Pfefferkorn.',
  'Hab ich den Herd aus?',
  'Ein Schmetterling!',
  'Tropisch!',
  "Schönes Wetter!",
  "Ach, guck mal dort, eine Blume!",
  "Alles grün, ich liebe grün!",
  "Dup di dup dee duu!",
  "Schubidubiduh",
  "Meinter: ist schön hier!",
  "Spazieren gehen ist toll!",
  "Seltsam das mir nix passiert!",
  "Ein vierblättriges Kleeblatt!",  
  "Ein achtlättriges Kleeblatt!",
];

const FALL_TEXT = {
  croc: 'Mama!',
  pit: 'Huuuuch!',
  tar: 'Blubb.',
  tar: 'Oweia.',
  tar: 'Ouuuuuuuuuuumph.',
  tar: 'Ups.',
  tar: 'Weia.',
  tar: 'Herrjeh.',
};

// ---------------------------------------------------------------------------------------------------------
// Zustand (vorbelegt – handle() läuft auch ohne init())
// ---------------------------------------------------------------------------------------------------------

const STATE = {
  scene: 'title',
  sceneTime: 0,
  time: 0,
  level: 1,
  clock: SETTINGS.startClock,
  score: 0,
  camX: 0,
  startX: 0,
  campX: 0,
  shake: 0,
  flash: 0,
  newHighscore: false,
  endReason: '',
  quipTimer: 6,
  levelStartX: 0,
  dryAll: false,
};

const STATS = {
  treasures: 0,
  treasurePoints: 0,
  socks: 0,
  crocsPassed: 0,
  swings: 0,
  tarsCrossed: 0,
  logsCrumbled: 0,
  logHits: 0,
  falls: 0,
  blindSeconds: 0,
};

const hero = {
  x: HERO_X,
  state: 'walk', // walk | swing | trip | fall
  t: 0,
  lives: SETTINGS.startLives,
  invul: 0,
  fallKind: '',
  fallHazard: null,
  swingHazard: null,
  blind: 0,
  blindTime: 0,
  say: '',
  sayTime: 0,
  walkPhase: 0,
};

var hazards = [];
var treasures = [];
var logs = [];
var particles = [];
var floaters = [];

var startButton = null;
var againButton = null;
var blindSensor = null;
var music = null;
var keyEdge = createKeyEdge();
var highscore = createHighscore('Dschungel-Dussel', 'punkte');

var PAL = null;
var palKey = '';
var jungleLayers = null;

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
    hero: col(0.42, 0.35, 0.95),
    helmet: col(0.32, 0.55, 0.95),
    heroBlind: col(0.7, 0.6, 1),
    ground: col(0.4, 0.5, 0.55),
    water: col(0.55, 0.6, 0.6),
    waterDim: col(0.55, 0.5, 0.3),
    croc: col(0.36, 0.75, 0.8),
    crocHeld: col(0.45, 0.6, 1),
    crocTeeth: col(0.3, 0.2, 0.95),
    vine: col(0.33, 0.65, 0.75),
    vineReady: col(0.3, 0.8, 1),
    tar: col(0.66, 0.55, 0.75),
    tarDry: col(0.38, 0.4, 0.8),
    log: col(0.28, 0.55, 0.75),
    logRing: col(0.28, 0.45, 0.45),
    gold: col(0.28, 0.8, 1),
    diamond: col(0.52, 0.5, 1),
    ring: col(0.6, 0.6, 0.95),
    junk: col(0.7, 0.35, 0.8),
    meter: col(0.45, 0.7, 0.95),
    meterDim: col(0.45, 0.4, 0.35),
    hud: col(0.4, 0.45, 0.9),
    hudDim: col(0.4, 0.35, 0.55),
    warn: col(0.72, 0.85, 1),
    title: col(0.32, 0.7, 0.95),
    sub: col(0.58, 0.45, 0.85),
    fire: col(0.27, 0.85, 1),
    flash: col(0.5, 0.25, 1),
    jungleFar: col(0.42, 0.55, 0.16),
    jungleNear: col(0.36, 0.6, 0.26),
    canopy: col(0.4, 0.5, 0.2),
    firefly: col(0.3, 0.6, 0.5),
    start: [col(0.35, 0.6, 0.6), col(0.35, 0.6, 0.8), col(0.35, 0.6, 1)],
  };
  jungleLayers = null;
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
  if (music) {
    try {
      music.pause();
    } catch (e) {
      // egal
    }
    music = null;
  }
}

function setScene(name) {
  STATE.scene = name;
  STATE.sceneTime = 0;
}

function sx(worldX) {
  return worldX - STATE.camX;
}

function onScreen(x0, x1, margin) {
  const m = margin === undefined ? 200 : margin;
  return sx(x1) > -m && sx(x0) < W + m;
}

function walkSpeed() {
  return Math.min(DIFFICULTY.walkMax, DIFFICULTY.walkStart + (STATE.level - 1) * DIFFICULTY.walkPerLevel);
}

function say(text, duration) {
  hero.say = text;
  hero.sayTime = duration || 1.8;
}

function addParticles(x, y, count, color, speed, gravity) {
  for (let i = 0; i < count && particles.length < SETTINGS.maxParticles; i++) {
    const a = Math.random() * Math.PI * 2;
    const s = (0.3 + Math.random()) * (speed || 220);
    const life = 0.5 + Math.random() * 0.8;
    particles.push({
      x,
      y,
      vx: Math.cos(a) * s,
      vy: Math.sin(a) * s - (gravity ? 150 : 0),
      g: gravity || 0,
      life,
      max: life,
      color,
      size: 3 + Math.random() * 5,
    });
  }
}

function addFloater(x, y, text, color) {
  if (floaters.length >= SETTINGS.maxFloaters) floaters.shift();
  floaters.push({ x, y, text, color, life: 1.6 });
}

function pickTreasure() {
  let total = 0;
  TREASURES.forEach((t) => (total += t.weight));
  let r = Math.random() * total;
  for (let i = 0; i < TREASURES.length; i++) {
    r -= TREASURES[i].weight;
    if (r <= 0) return TREASURES[i];
  }
  return TREASURES[0];
}

// ---------------------------------------------------------------------------------------------------------
// Level-Generator
// ---------------------------------------------------------------------------------------------------------

function makeHazard(type, x0, lvl) {
  if (type === 'croc') {
    const n = Math.min(DIFFICULTY.crocMaxCount, 1 + Math.floor(lvl / 2) + Math.floor(Math.random() * 2));
    const width = n * 170 + 60;
    const crocs = [];
    for (let i = 0; i < n; i++) {
      crocs.push({
        x: x0 + 30 + 85 + i * 170,
        open: 0,
        seed: Math.random() * Math.PI * 2,
        speed: DIFFICULTY.crocMouthSpeed + (lvl - 1) * DIFFICULTY.crocMouthPerLevel + Math.random() * 0.3,
        hold: 0,
        station: null,
        snap: 0,
      });
    }
    return { type, x0, x1: x0 + width, crocs, passed: false };
  }
  if (type === 'vine') {
    const width = Math.min(DIFFICULTY.pitWidthMax, DIFFICULTY.pitWidthStart + (lvl - 1) * DIFFICULTY.pitWidthPerLevel);
    return { type, x0, x1: x0 + width, ready: 0, drop: 0, station: null, crossed: false };
  }
  if (type === 'tar') {
    const width = DIFFICULTY.tarWidthStart + (lvl - 1) * DIFFICULTY.tarWidthPerLevel;
    return { type, x0, x1: x0 + width, station: null, crossed: false, bubbleT: 0 };
  }
  // Hang mit rollenden Stämmen
  return {
    type: 'logs',
    x0,
    x1: x0 + 420,
    logsLeft: DIFFICULTY.logsPerSlope + Math.floor(lvl / 3),
    timer: 0.5,
  };
}

function generateLevel(startX, lvl) {
  const types = ['croc'];
  if (lvl >= DIFFICULTY.vineFromLevel) types.push('vine');
  if (lvl >= DIFFICULTY.tarFromLevel) types.push('tar');
  if (lvl >= DIFFICULTY.logsFromLevel) types.push('logs');
  const newest = types[types.length - 1];
  const count = Math.min(DIFFICULTY.hazardsMax, DIFFICULTY.hazardsStart + (lvl - 1) * DIFFICULTY.hazardsPerLevel);
  const gap = Math.max(DIFFICULTY.gapMin, DIFFICULTY.gapStart + (lvl - 1) * DIFFICULTY.gapPerLevel);
  let x = startX + 900;
  let last = '';
  for (let i = 0; i < count; i++) {
    let type;
    if (i === 0 || (i === 2 && lvl <= 4)) type = newest; // die neue Gefahr gleich vorstellen
    else {
      type = types[Math.floor(Math.random() * types.length)];
      if (type === last && types.length > 1) type = types[Math.floor(Math.random() * types.length)];
    }
    last = type;
    const h = makeHazard(type, x, lvl);
    hazards.push(h);
    // Schätze in der Lücke danach
    if (Math.random() < DIFFICULTY.treasureChance) {
      const n = 1 + (Math.random() < 0.35 ? 1 : 0);
      for (let k = 0; k < n; k++) {
        treasures.push({
          x: h.x1 + gap * (0.3 + 0.4 * (k + 1) / (n + 1)),
          y: 360 + Math.random() * 180,
          info: pickTreasure(),
          station: null,
          phase: Math.random() * 10,
        });
      }
    }
    x = h.x1 + gap;
  }
  STATE.campX = x + 200;
}

// ---------------------------------------------------------------------------------------------------------
// Stationen (lazy, nur für sichtbare Gefahren)
// ---------------------------------------------------------------------------------------------------------

function makeStation(x, y, opts) {
  return guiPixelFillButton({
    label: '',
    posX: x,
    posY: y,
    radius: opts.radius || SETTINGS.stationRadius,
    speedUp: opts.speedUp,
    speedDown: opts.speedDown,
    fullPercent: opts.fullPercent || 25,
    activeValue: opts.activeValue || 80,
    visible: false,
    onEnterActive: opts.onEnterActive,
  });
}

function ensureBlindSensor() {
  if (blindSensor) return;
  blindSensor = makeStation(HERO_X, GROUND - 85, { radius: 62, speedUp: 160, speedDown: 90, fullPercent: 25 });
}

function ensureStations(h) {
  if (h.type === 'croc') {
    h.crocs.forEach((c) => {
      if (!c.station) c.station = makeStation(sx(c.x) + CROC_SNOUT_DX, GROUND + CROC_SNOUT_DY, { radius: 56, speedUp: 180, speedDown: 45 });
    });
  } else if (h.type === 'vine') {
    if (!h.station) {
      h.station = makeStation(sx((h.x0 + h.x1) / 2), 230, {
        radius: 70,
        speedUp: 95,
        speedDown: 30,
        onEnterActive: () => {
          h.ready = DIFFICULTY.vineHold;
          playSound(soundSwing, 0.6);
        },
      });
    }
  } else if (h.type === 'tar') {
    if (!h.station) {
      h.station = guiRegionButton({
        polygon: tarPolygon(h),
        speedUp: 30,
        speedDown: 4,
        fullPercent: 45,
        activeValue: DIFFICULTY.tarDryNeed,
        visible: false,
      });
    }
  }
}

function tarPolygon(h) {
  const a = sx(h.x0);
  const b = sx(h.x1);
  return [
    [a, GROUND + 8],
    [b, GROUND + 8],
    [b, GROUND + 115],
    [a, GROUND + 115],
  ];
}

// ---------------------------------------------------------------------------------------------------------
// Szenen-Steuerung
// ---------------------------------------------------------------------------------------------------------

function resetRun() {
  hazards = [];
  treasures = [];
  logs = [];
  particles = [];
  floaters = [];
  STATE.level = 1;
  STATE.clock = SETTINGS.startClock;
  STATE.score = 0;
  STATE.shake = 0;
  STATE.flash = 0;
  STATE.newHighscore = false;
  STATE.endReason = '';
  STATE.quipTimer = 6;
  hero.x = HERO_X;
  hero.state = 'walk';
  hero.t = 0;
  hero.lives = SETTINGS.startLives;
  hero.invul = 0;
  hero.blind = 0;
  hero.blindTime = 0;
  hero.say = '';
  hero.sayTime = 0;
  STATE.camX = hero.x - HERO_X;
  STATE.startX = hero.x;
  STATE.levelStartX = hero.x;
  Object.keys(STATS).forEach((k) => (STATS[k] = 0));
  generateLevel(hero.x, 1);
  againButton = null;
}

function resetAll() {
  stopMusic();
  resetRun();
  startButton = null;
  blindSensor = null;
  keyEdge = createKeyEdge();
  setScene('title');
}

function startGame() {
  resetRun();
  setScene('game');
  say('Auf geht’s! Was soll schon passieren?', 2.5);
  stopMusic();
  music = playSound(soundMusic, 0.35);
  if (music) music.loop = true;
}

function distanceMeters() {
  return Math.max(0, (hero.x - STATE.startX) / 50);
}

function endGame(reason) {
  STATE.endReason = reason;
  stopMusic();
  playSound(soundGameOver, 0.8);
  const dist = Math.round(distanceMeters());
  STATE.score += dist * 2;
  highscore.addEntry({
    punkte: Math.round(STATE.score),
    schaetze: STATS.treasures,
    distanz: dist,
    leben: Math.max(0, hero.lives),
    level: STATE.level,
  });
  STATE.newHighscore = highscore.lastEntryNewHighscore();
  againButton = null;
  setScene('gameover');
}

function reachCamp() {
  STATE.level++;
  STATE.clock += SETTINGS.campBonusTime;
  STATE.score += 100 * STATE.level;
  STATE.flash = 0.8;
  playSound(soundJingle, 0.8);
  addParticles(sx(STATE.campX), GROUND - 60, 60, PAL.fire, 420, 300);
  say('Lagerfeuer! Marshmallows!', 2.6);
  // alte Gefahren hinter ihm aufräumen, neue Etappe dahinter
  hazards = hazards.filter((h) => h.x1 > hero.x - W);
  treasures = treasures.filter((t) => t.x > hero.x - W && !t.collected);
  generateLevel(STATE.campX, STATE.level);
  setScene('levelup');
}

// ---------------------------------------------------------------------------------------------------------
// Logik
// ---------------------------------------------------------------------------------------------------------

function startFall(kind, h) {
  hero.state = 'fall';
  hero.t = 0;
  hero.fallKind = kind;
  hero.fallHazard = h;
  hero.lives--;
  STATS.falls++;
  STATE.shake = 16;
  say(FALL_TEXT[kind] || 'Huch!', SETTINGS.fallDuration);
  if (kind === 'tar') playSound(soundPlop, 0.9);
  else playSound(soundSplash, 0.9);
  if (kind === 'croc') addParticles(hero.x - STATE.camX, GROUND + 30, 30, PAL.water, 260, 500);
}

function startTrip(text) {
  hero.state = 'trip';
  hero.t = 0;
  STATE.shake = 10;
  say(text, SETTINGS.tripDuration);
  playSound(soundHit, 0.7);
}

function updateHero(dt) {
  hero.sayTime = Math.max(0, hero.sayTime - dt);
  hero.invul = Math.max(0, hero.invul - dt);
  hero.t += dt;

  if (hero.state === 'walk') {
    const blinded = hero.blind > SETTINGS.blindThreshold;
    const speed = walkSpeed() * (blinded ? SETTINGS.blindSlow : 1);
    hero.x += speed * dt;
    hero.walkPhase += speed * dt * 0.035;
    if (blinded) {
      STATS.blindSeconds += dt;
      if (hero.sayTime <= 0) say('Ich seh nix!', 1.2);
      if (hero.blind > 0.9) hero.blindTime += dt;
      else hero.blindTime = Math.max(0, hero.blindTime - dt);
      if (hero.blindTime > SETTINGS.blindSitTime) {
        hero.blindTime = 0;
        startTrip('Aua, meine Augen!');
        return;
      }
    } else {
      hero.blindTime = 0;
      STATE.quipTimer -= dt;
      if (STATE.quipTimer <= 0 && hero.sayTime <= 0) {
        say(QUIPS[Math.floor(Math.random() * QUIPS.length)], 1.8);
        STATE.quipTimer = 7 + Math.random() * 6;
      }
    }
    checkHazardsUnderFeet();
    if (hero.state === 'walk' && hero.x >= STATE.campX) reachCamp();
  } else if (hero.state === 'swing') {
    const h = hero.swingHazard;
    const p = Math.min(1, hero.t / SETTINGS.swingDuration);
    hero.x = h.x0 - 10 + (h.x1 - h.x0 + 20) * p;
    if (p >= 1) {
      hero.state = 'walk';
      h.crossed = true;
      STATS.swings++;
      say('Juhuuu!', 1.2);
    }
  } else if (hero.state === 'trip') {
    if (hero.t >= SETTINGS.tripDuration) {
      hero.state = 'walk';
      hero.invul = 0.6;
    }
  } else if (hero.state === 'fall') {
    if (hero.t >= SETTINGS.fallDuration) {
      if (hero.lives <= 0) {
        endGame(hero.fallKind === 'croc' ? 'Die Krokodile hatten Hunger.' : hero.fallKind === 'tar' ? 'Der Teer war stärker.' : 'Ganz schön tief, die Schlucht.');
        return;
      }
      // Neustart hinter der Gefahr (verzeihend), mit kurzer Unverwundbarkeit
      const h = hero.fallHazard;
      hero.x = h ? h.x1 + 40 : hero.x + 100;
      if (h) {
        h.crossed = true;
        h.passed = true;
      }
      hero.state = 'walk';
      hero.invul = SETTINGS.invulTime;
      say('Nix passiert! Weiter!', 1.6);
    }
  }
  // Kamera folgt (beim Sturz bleibt sie stehen)
  if (hero.state !== 'fall') STATE.camX = hero.x - HERO_X;
}

function checkHazardsUnderFeet() {
  for (let i = 0; i < hazards.length; i++) {
    const h = hazards[i];
    if (h.type === 'croc') {
      if (hero.x < h.x0 + 40 || hero.x > h.x1 - 40) {
        if (hero.x > h.x1 - 40 && !h.passed) {
          h.passed = true;
          STATS.crocsPassed += h.crocs.length;
          STATE.score += 50 * h.crocs.length;
          addFloater(HERO_X, GROUND - 200, '+' + 50 * h.crocs.length, PAL.croc);
        }
        continue;
      }
      if (hero.invul > 0 || h.passed) continue;
      let near = h.crocs[0];
      h.crocs.forEach((c) => {
        if (Math.abs(c.x - hero.x) < Math.abs(near.x - hero.x)) near = c;
      });
      if (near.open > 0.55) {
        near.snap = 1;
        startFall('croc', h);
        return;
      }
    } else if (h.type === 'vine') {
      if (h.crossed || hero.x < h.x0 - 10 || hero.x > h.x1) continue;
      if (h.drop > 0.8) {
        hero.state = 'swing';
        hero.t = 0;
        hero.swingHazard = h;
        STATE.score += 150;
        addFloater(HERO_X, GROUND - 220, '+150', PAL.vineReady);
        playSound(soundSwing, 0.7);
        say('Hoppla-hopp!', 1.2);
        return;
      }
      if (hero.invul <= 0 && hero.x > h.x0 + 15) {
        startFall('pit', h);
        return;
      }
    } else if (h.type === 'tar') {
      if (h.crossed || hero.x < h.x0 + 15 || hero.x > h.x1) {
        if (!h.crossed && hero.x > h.x1) {
          h.crossed = true;
          STATS.tarsCrossed++;
          STATE.score += 200;
          addFloater(HERO_X, GROUND - 200, '+200', PAL.tarDry);
        }
        continue;
      }
      const v = h.station ? h.station.getValue() : 0;
      if (v < DIFFICULTY.tarDryNeed && hero.invul <= 0) {
        startFall('tar', h);
        return;
      }
    }
  }
}

function updateHazards(grid, dt) {
  STATE.dryAll = keyEdge('Digit3');
  hazards.forEach((h) => {
    if (!onScreen(h.x0, h.x1, 250)) return;
    ensureStations(h);
    if (h.type === 'croc') {
      h.crocs.forEach((c) => {
        c.station.setX(sx(c.x) + CROC_SNOUT_DX);
        c.station.handle(grid, dt);
        c.hold = c.station.getValue() / 100;
        if (isKeyDown('Digit1')) c.hold = 1;
        const wants = Math.sin(STATE.time * c.speed + c.seed) > -0.1 ? 1 : 0;
        const target = c.hold > 0.25 ? 0 : wants;
        const rate = c.hold > 0.25 ? 7 : 2.2;
        c.open += (target - c.open) * Math.min(1, rate * dt);
        c.snap = Math.max(0, c.snap - dt * 2);
      });
    } else if (h.type === 'vine') {
      h.station.setX(sx((h.x0 + h.x1) / 2));
      h.station.handle(grid, dt);
      if (h.station.getValue() > 80 || isKeyDown('Digit2')) h.ready = Math.max(h.ready, DIFFICULTY.vineHold);
      h.ready = Math.max(0, h.ready - dt);
      const target = h.ready > 0 ? 1 : 0;
      h.drop += (target - h.drop) * Math.min(1, (target ? 4 : 1.5) * dt);
    } else if (h.type === 'tar') {
      h.station.setPolygon(tarPolygon(h));
      h.station.handle(grid, dt);
      if (STATE.dryAll) h.station.setValue(100);
      h.bubbleT -= dt;
      if (h.bubbleT <= 0 && h.station.getValue() < 50) {
        h.bubbleT = 0.3 + Math.random() * 0.6;
        addParticles(sx(h.x0 + Math.random() * (h.x1 - h.x0)), GROUND + 20, 2, PAL.tar, 40, -60);
      }
    } else if (h.type === 'logs') {
      // Stämme rollen los, sobald der Hang im Bild ist und der Professor noch davor ist
      if (h.logsLeft > 0 && hero.x < h.x1 && sx(h.x0) < W) {
        h.timer -= dt;
        if (h.timer <= 0) {
          h.logsLeft--;
          h.timer = Math.max(1.2, DIFFICULTY.logIntervalStart + (STATE.level - 1) * DIFFICULTY.logIntervalPerLevel);
          spawnLog(Math.max(h.x0, STATE.camX + W + 60));
        }
      }
    }
  });
}

function spawnLog(x) {
  const log = { x, rot: 0, station: null, dead: false, r: 46 };
  log.station = makeStation(sx(x), GROUND - log.r, {
    radius: 60,
    speedUp: 120,
    speedDown: 30,
    fullPercent: 25,
    onEnterActive: () => crumbleLog(log),
  });
  logs.push(log);
}

function crumbleLog(log) {
  if (log.dead) return;
  log.dead = true;
  STATS.logsCrumbled++;
  STATE.score += 75;
  addParticles(sx(log.x), GROUND - log.r, 40, PAL.log, 320, 600);
  addFloater(sx(log.x), GROUND - 140, '+75', PAL.log);
  playSound(soundCrumble, 0.6);
}

function updateLogs(grid, dt) {
  const crumbleAll = keyEdge('Digit4');
  logs.slice().forEach((log) => {
    if (log.dead) {
      logs.splice(logs.indexOf(log), 1);
      return;
    }
    log.x -= DIFFICULTY.logSpeed * dt;
    log.rot -= (DIFFICULTY.logSpeed / log.r) * dt;
    log.station.setX(sx(log.x));
    log.station.handle(grid, dt);
    if (crumbleAll) crumbleLog(log);
    if (!log.dead && hero.state === 'walk' && hero.invul <= 0 && Math.abs(log.x - hero.x) < 55) {
      log.dead = true;
      STATS.logHits++;
      STATE.clock = Math.max(0, STATE.clock - SETTINGS.logPenaltyTime);
      addFloater(HERO_X, GROUND - 240, '-' + SETTINGS.logPenaltyTime + ' s', PAL.warn);
      addParticles(HERO_X, GROUND - 40, 25, PAL.log, 260, 600);
      startTrip('Autsch!');
    }
    if (sx(log.x) < -120) logs.splice(logs.indexOf(log), 1);
  });
}

function updateTreasures(grid, dt) {
  const grabAll = keyEdge('Digit5');
  treasures.slice().forEach((t) => {
    if (t.collected) return;
    const x = sx(t.x);
    if (x < -120) {
      treasures.splice(treasures.indexOf(t), 1);
      return;
    }
    if (x > W + 150) return;
    t.phase += dt;
    const y = t.y + Math.sin(t.phase * 2) * 12;
    if (!t.station) {
      t.station = makeStation(x, y, { radius: 62, speedUp: 100, speedDown: 25, onEnterActive: () => collectTreasure(t) });
    }
    t.station.setX(x);
    t.station.setY(y);
    t.station.handle(grid, dt);
    if (grabAll && x > 0 && x < W) collectTreasure(t);
  });
}

function collectTreasure(t) {
  if (t.collected) return;
  t.collected = true;
  STATS.treasures++;
  STATS.treasurePoints += t.info.points;
  if (t.info.kind === 'sock') STATS.socks++;
  STATE.score += t.info.points;
  STATE.clock += SETTINGS.treasureBonusTime;
  const x = sx(t.x);
  addParticles(x, t.y, 30, treasureColor(t.info.kind), 300);
  addFloater(x, t.y - 70, '+' + t.info.points, treasureColor(t.info.kind));
  say(t.info.label, 1.5);
  playSound(soundTreasure, 0.7);
  treasures.splice(treasures.indexOf(t), 1);
}

function updateBlind(grid, dt) {
  ensureBlindSensor();
  blindSensor.setX(HERO_X);
  blindSensor.setY(GROUND - 85);
  blindSensor.handle(grid, dt);
  hero.blind = isKeyDown('Digit0') ? 1 : blindSensor.getValue() / 100;
}

function updateParticles(dt) {
  particles.slice().forEach((p) => {
    p.life -= dt;
    if (p.life <= 0) {
      particles.splice(particles.indexOf(p), 1);
      return;
    }
    p.vy += p.g * dt;
    p.x += p.vx * dt;
    p.y += p.vy * dt;
  });
  floaters.slice().forEach((f) => {
    f.life -= dt;
    f.y -= 55 * dt;
    if (f.life <= 0) floaters.splice(floaters.indexOf(f), 1);
  });
}

// ---------------------------------------------------------------------------------------------------------
// Zeichnen: Hintergrund (fraktales L-System, vorgerendert)
// ---------------------------------------------------------------------------------------------------------

function lsystem(axiom, rules, iterations) {
  let s = axiom;
  for (let i = 0; i < iterations; i++) {
    let out = '';
    for (let k = 0; k < s.length; k++) out += rules[s[k]] !== undefined ? rules[s[k]] : s[k];
    s = out;
  }
  return s;
}

function drawPlant(g, x, y, len, angleDeg, lean, program) {
  const stack = [];
  let px = x;
  let py = y;
  let a = -Math.PI / 2 + lean;
  const turn = (angleDeg * Math.PI) / 180;
  g.beginPath();
  g.moveTo(px, py);
  for (let i = 0; i < program.length; i++) {
    const c = program[i];
    if (c === 'F') {
      px += Math.cos(a) * len;
      py += Math.sin(a) * len;
      g.lineTo(px, py);
    } else if (c === '+') a += turn;
    else if (c === '-') a -= turn;
    else if (c === '[') stack.push([px, py, a]);
    else if (c === ']') {
      const st = stack.pop();
      px = st[0];
      py = st[1];
      a = st[2];
      g.moveTo(px, py);
    }
  }
  g.stroke();
}

function buildJungleLayer(count, len, color, lineWidth, seed, iterations) {
  const c = document.createElement('canvas');
  c.width = W;
  c.height = H;
  const g = c.getContext('2d');
  g.strokeStyle = color;
  g.lineWidth = lineWidth;
  g.lineCap = 'round';
  const fern = lsystem('X', { X: 'F+[[X]-X]-F[-FX]+X', F: 'FF' }, iterations);
  const tree = lsystem('F', { F: 'FF-[-F+F+F]+[+F-F-F]' }, iterations - 1);
  for (let i = 0; i < count; i++) {
    const t = (i + 0.5) / count;
    const x = 80 + t * (W - 160) + Math.sin(seed + i * 7.3) * 40;
    const lean = Math.sin(seed * 3 + i * 1.7) * 0.25;
    drawPlant(g, x, GROUND + 4, len * (0.8 + 0.4 * Math.abs(Math.sin(seed + i))), 22 + (i % 3) * 3, lean, i % 2 ? fern : tree);
  }
  return c;
}

function buildCanopy() {
  const c = document.createElement('canvas');
  c.width = W;
  c.height = 260;
  const g = c.getContext('2d');
  g.strokeStyle = PAL.canopy;
  g.lineWidth = 2;
  for (let i = 0; i < 26; i++) {
    const x = (i / 26) * W + 20;
    const len = 60 + ((i * 37) % 140);
    g.beginPath();
    g.moveTo(x, 0);
    for (let y = 0; y <= len; y += 6) g.lineTo(x + Math.sin(y * 0.05 + i) * 10, y);
    g.stroke();
    // Blättchen
    for (let y = 20; y < len; y += 24) {
      const lx = x + Math.sin(y * 0.05 + i) * 10;
      g.beginPath();
      g.ellipse(lx + 8, y, 9, 4, 0.5, 0, Math.PI * 2);
      g.stroke();
    }
  }
  return c;
}

function ensureJungle() {
  if (jungleLayers) return;
  jungleLayers = {
    far: buildJungleLayer(9, 5, PAL.jungleFar, 1.5, 1.3, 5),
    near: buildJungleLayer(6, 7, PAL.jungleNear, 2, 4.1, 5),
    canopy: buildCanopy(),
  };
}

function drawTiled(ctx, img, factor, y) {
  const off = (((STATE.camX * factor) % W) + W) % W;
  ctx.drawImage(img, -off, y || 0);
  ctx.drawImage(img, W - off, y || 0);
}

function renderBackground(ctx) {
  ensureJungle();
  drawTiled(ctx, jungleLayers.far, 0.2, -120);
  drawTiled(ctx, jungleLayers.near, 0.5, 0);
  drawTiled(ctx, jungleLayers.canopy, 0.8, 0);
  // Glühwürmchen
  ctx.save();
  ctx.fillStyle = PAL.firefly;
  for (let i = 0; i < 18; i++) {
    const x = (((i * 211 - STATE.camX * 0.6 + Math.sin(STATE.time * 0.5 + i) * 40) % W) + W) % W;
    const y = 300 + ((i * 97) % 380) + Math.sin(STATE.time * 0.8 + i * 2) * 20;
    ctx.globalAlpha = 0.3 + 0.3 * Math.sin(STATE.time * 3 + i);
    ctx.fillRect(x, y, 4, 4);
  }
  ctx.restore();
}

/** Boden als schwarze Fläche mit Kontur – Löcher für Teich, Schlucht, Teer */
function renderGround(ctx) {
  ctx.save();
  ctx.fillStyle = '#000000';
  ctx.fillRect(0, GROUND, W, H - GROUND);
  ctx.strokeStyle = PAL.ground;
  ctx.lineWidth = 4;
  ctx.beginPath();
  let x = 0;
  const holes = hazards
    .filter((h) => h.type !== 'logs' && onScreen(h.x0, h.x1, 50))
    .map((h) => [sx(h.x0), sx(h.x1)])
    .sort((a, b) => a[0] - b[0]);
  holes.forEach((hole) => {
    if (hole[0] > x) {
      ctx.moveTo(x, GROUND);
      ctx.lineTo(hole[0], GROUND);
    }
    // Kanten nach unten
    ctx.moveTo(hole[0], GROUND);
    ctx.lineTo(hole[0], GROUND + 120);
    ctx.moveTo(hole[1], GROUND);
    ctx.lineTo(hole[1], GROUND + 120);
    x = Math.max(x, hole[1]);
  });
  if (x < W) {
    ctx.moveTo(x, GROUND);
    ctx.lineTo(W, GROUND);
  }
  ctx.stroke();
  // Gras-Striche
  ctx.lineWidth = 2;
  ctx.globalAlpha = 0.5;
  ctx.beginPath();
  for (let i = 0; i < 60; i++) {
    const gx = (((i * 53 - STATE.camX) % W) + W) % W;
    const inHole = holes.some((hole) => gx > hole[0] - 6 && gx < hole[1] + 6);
    if (inHole) continue;
    ctx.moveTo(gx, GROUND);
    ctx.lineTo(gx - 4, GROUND - 12 - (i % 3) * 4);
  }
  ctx.stroke();
  ctx.restore();
}

// ---------------------------------------------------------------------------------------------------------
// Zeichnen: Gefahren, Schätze, Professor
// ---------------------------------------------------------------------------------------------------------

function renderMeter(ctx, x, y, r, value, color) {
  if (value <= 0.01) return;
  ctx.save();
  ctx.strokeStyle = color;
  ctx.lineWidth = 5;
  ctx.beginPath();
  ctx.arc(x, y, r, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * Math.min(1, value));
  ctx.stroke();
  ctx.restore();
}

function renderWater(ctx, a, b) {
  ctx.save();
  ctx.strokeStyle = PAL.water;
  ctx.lineWidth = 3;
  ctx.beginPath();
  for (let x = a; x <= b; x += 10) {
    const y = GROUND + 45 + Math.sin(x * 0.04 + STATE.time * 3) * 5;
    if (x === a) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  }
  ctx.stroke();
  ctx.strokeStyle = PAL.waterDim;
  ctx.beginPath();
  for (let x = a; x <= b; x += 10) {
    const y = GROUND + 75 + Math.sin(x * 0.05 - STATE.time * 2) * 4;
    if (x === a) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  }
  ctx.stroke();
  ctx.restore();
}

function renderCroc(ctx, c) {
  const x = sx(c.x);
  const y = GROUND + 4;
  const open = Math.max(c.open, c.snap);
  const held = c.hold > 0.25;
  const color = held ? PAL.crocHeld : PAL.croc;
  ctx.save();
  ctx.translate(x, y);
  ctx.lineWidth = 4;
  ctx.strokeStyle = color;
  ctx.fillStyle = '#000000';
  // Rücken (Trittstein) – Professor läuft darüber
  ctx.beginPath();
  ctx.ellipse(-10, 18, 80, 22, 0, Math.PI, Math.PI * 2);
  ctx.fill();
  ctx.stroke();
  // Rückenzacken
  ctx.beginPath();
  for (let i = -3; i <= 2; i++) {
    ctx.moveTo(i * 22 - 10, 0);
    ctx.lineTo(i * 22 - 1, -10);
    ctx.lineTo(i * 22 + 8, 0);
  }
  ctx.stroke();
  // Schnauze rechts: Oberkiefer klappt auf
  const jaw = open * 0.75;
  ctx.save();
  ctx.translate(60, 10);
  ctx.rotate(-jaw);
  ctx.beginPath();
  ctx.moveTo(0, 0);
  ctx.lineTo(70, 6);
  ctx.lineTo(70, 16);
  ctx.lineTo(0, 16);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
  if (open > 0.15) {
    ctx.strokeStyle = PAL.crocTeeth;
    ctx.lineWidth = 2;
    ctx.beginPath();
    for (let i = 0; i < 5; i++) {
      ctx.moveTo(10 + i * 12, 16);
      ctx.lineTo(16 + i * 12, 25);
      ctx.lineTo(22 + i * 12, 16);
    }
    ctx.stroke();
  }
  ctx.restore();
  // Unterkiefer
  ctx.beginPath();
  ctx.moveTo(60, 26);
  ctx.lineTo(128, 26);
  ctx.lineTo(128, 34);
  ctx.lineTo(60, 40);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
  // Auge
  ctx.beginPath();
  ctx.arc(52, -2, 9, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();
  ctx.beginPath();
  ctx.arc(54, -2, 3, 0, Math.PI * 2);
  ctx.fillStyle = color;
  ctx.fill();
  ctx.restore();
  // Anzeige: Schnauze ist das Ziel
  renderMeter(ctx, x + CROC_SNOUT_DX, GROUND + CROC_SNOUT_DY, 60, c.hold, PAL.meter);
  if (!held && c.open > 0.5 && Math.sin(STATE.time * 10) > 0) {
    util.renderText({ ctx, text: '!', x: x + 95, y: GROUND - 25, fontSize: '44px', fillStyle: PAL.warn });
  }
}

function renderVine(ctx, h) {
  const ax = sx((h.x0 + h.x1) / 2);
  const ay = 230;
  // Ast
  ctx.save();
  ctx.fillStyle = '#000000';
  ctx.beginPath();
  ctx.arc(ax, ay, 72, 0, Math.PI * 2);
  ctx.fill(); // Ziel dunkel halten
  ctx.strokeStyle = h.ready > 0 ? PAL.vineReady : PAL.vine;
  ctx.lineWidth = 6;
  ctx.beginPath();
  ctx.moveTo(ax - 120, ay - 30);
  ctx.quadraticCurveTo(ax, ay + 20, ax + 120, ay - 40);
  ctx.stroke();
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.arc(ax, ay, 18, 0, Math.PI * 2);
  ctx.stroke();
  // Liane: aufgerollt oder herabhängend und schwingend
  const len = 70 + h.drop * (GROUND - 120 - ay);
  let angle = Math.sin(STATE.time * 2.4) * 0.35 * h.drop;
  if (hero.state === 'swing' && hero.swingHazard === h) {
    const p = Math.min(1, hero.t / SETTINGS.swingDuration);
    angle = 0.9 - 1.8 * p;
  }
  const ex = ax - Math.sin(angle) * len;
  const ey = ay + Math.cos(angle) * len;
  ctx.lineWidth = 4;
  ctx.beginPath();
  ctx.moveTo(ax, ay);
  const mx = (ax + ex) / 2 + Math.cos(STATE.time * 3) * 10;
  ctx.quadraticCurveTo(mx, (ay + ey) / 2, ex, ey);
  ctx.stroke();
  // Blätter an der Liane
  ctx.lineWidth = 2;
  for (let k = 1; k < 5; k++) {
    const t = k / 5;
    const lx = ax + (ex - ax) * t;
    const ly = ay + (ey - ay) * t;
    ctx.beginPath();
    ctx.ellipse(lx + 8, ly, 8, 4, 0.6, 0, Math.PI * 2);
    ctx.stroke();
  }
  ctx.restore();
  renderMeter(ctx, ax, ay, 76, h.station ? h.station.getValue() / 100 : 0, PAL.meter);
  if (h.ready > 0) {
    // Restzeit der Liane
    renderMeter(ctx, ax, ay, 88, h.ready / DIFFICULTY.vineHold, PAL.vineReady);
  }
  renderWater(ctx, sx(h.x0), sx(h.x1));
}

function renderTar(ctx, h) {
  const a = sx(h.x0);
  const b = sx(h.x1);
  const v = h.station ? h.station.getValue() / 100 : 0;
  const dry = v * 100 >= DIFFICULTY.tarDryNeed;
  ctx.save();
  ctx.strokeStyle = dry ? PAL.tarDry : PAL.tar;
  ctx.lineWidth = 3;
  // Oberfläche: flüssig wabernd → trocken mit Rissen
  ctx.beginPath();
  for (let x = a; x <= b; x += 8) {
    const y = GROUND + 12 + Math.sin(x * 0.05 + STATE.time * 2) * 5 * (1 - v);
    if (x === a) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  }
  ctx.stroke();
  if (v > 0.3) {
    ctx.lineWidth = 2;
    ctx.beginPath();
    const cracks = Math.floor(v * 10);
    for (let i = 0; i < cracks; i++) {
      const cx = a + ((i * 73) % Math.max(1, b - a));
      ctx.moveTo(cx, GROUND + 14);
      ctx.lineTo(cx + 12, GROUND + 40);
      ctx.lineTo(cx + 2, GROUND + 70);
    }
    ctx.stroke();
  }
  // Fortschrittsbalken unter der Grube
  ctx.fillStyle = PAL.meterDim;
  ctx.fillRect(a, GROUND + 125, b - a, 6);
  ctx.fillStyle = dry ? PAL.tarDry : PAL.meter;
  ctx.fillRect(a, GROUND + 125, (b - a) * v, 6);
  ctx.restore();
  util.renderText({
    ctx,
    text: dry ? 'HART!' : 'TEER',
    x: (a + b) / 2,
    y: GROUND + 180,
    fontSize: '38px',
    fillStyle: dry ? PAL.tarDry : PAL.tar,
  });
}

function renderSlope(ctx, h) {
  const a = sx(h.x0);
  const b = sx(h.x1);
  ctx.save();
  ctx.strokeStyle = PAL.log;
  ctx.globalAlpha = 0.6;
  ctx.lineWidth = 3;
  ctx.setLineDash([12, 12]);
  ctx.beginPath();
  ctx.moveTo(a, GROUND - 6);
  ctx.lineTo(b, GROUND - 6);
  ctx.stroke();
  ctx.setLineDash([]);
  ctx.restore();
  util.renderText({ ctx, text: 'Achtung Stämme!', x: (a + b) / 2, y: GROUND + 60, fontSize: '36px', fillStyle: PAL.log });
}

function renderLogs(ctx) {
  logs.forEach((log) => {
    const x = sx(log.x);
    const y = GROUND - log.r;
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(log.rot);
    ctx.fillStyle = '#000000';
    ctx.strokeStyle = PAL.log;
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.arc(0, 0, log.r, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    ctx.strokeStyle = PAL.logRing;
    ctx.lineWidth = 2;
    ctx.beginPath();
    for (let a = 0; a < Math.PI * 6; a += 0.2) {
      const rr = (a / (Math.PI * 6)) * log.r * 0.8;
      if (a === 0) ctx.moveTo(Math.cos(a) * rr, Math.sin(a) * rr);
      else ctx.lineTo(Math.cos(a) * rr, Math.sin(a) * rr);
    }
    ctx.stroke();
    ctx.restore();
    renderMeter(ctx, x, y, 62, log.station.getValue() / 100, PAL.meter);
  });
}

function treasureColor(kind) {
  if (kind === 'gold') return PAL.gold;
  if (kind === 'diamond') return PAL.diamond;
  if (kind === 'ring') return PAL.ring;
  return PAL.junk;
}

function renderTreasures(ctx) {
  treasures.forEach((t) => {
    if (t.collected) return;
    const x = sx(t.x);
    if (x < -100 || x > W + 100) return;
    const y = t.y + Math.sin(t.phase * 2) * 12;
    const color = treasureColor(t.info.kind);
    ctx.save();
    ctx.translate(x, y);
    ctx.fillStyle = '#000000';
    ctx.beginPath();
    ctx.arc(0, 0, 60, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = color;
    ctx.lineWidth = 4;
    ctx.shadowBlur = 18;
    ctx.shadowColor = color;
    ctx.beginPath();
    if (t.info.kind === 'gold') {
      ctx.moveTo(-34, 14);
      ctx.lineTo(34, 14);
      ctx.lineTo(22, -14);
      ctx.lineTo(-22, -14);
      ctx.closePath();
    } else if (t.info.kind === 'diamond') {
      ctx.moveTo(0, -30);
      ctx.lineTo(28, -6);
      ctx.lineTo(0, 30);
      ctx.lineTo(-28, -6);
      ctx.closePath();
      ctx.moveTo(-28, -6);
      ctx.lineTo(28, -6);
    } else if (t.info.kind === 'ring') {
      ctx.arc(0, 6, 22, 0, Math.PI * 2);
      ctx.moveTo(10, -24);
      ctx.arc(0, -24, 10, 0, Math.PI * 2);
    } else if (t.info.kind === 'sock') {
      ctx.moveTo(-10, -30);
      ctx.lineTo(10, -30);
      ctx.lineTo(10, 8);
      ctx.lineTo(28, 18);
      ctx.lineTo(22, 30);
      ctx.lineTo(-10, 20);
      ctx.closePath();
    } else {
      // Quietscheente
      ctx.arc(0, 10, 22, 0, Math.PI * 2);
      ctx.moveTo(26, -14);
      ctx.arc(14, -14, 12, 0, Math.PI * 2);
      ctx.moveTo(26, -16);
      ctx.lineTo(38, -12);
      ctx.lineTo(26, -8);
    }
    ctx.stroke();
    ctx.restore();
    renderMeter(ctx, x, y, 64, t.station ? t.station.getValue() / 100 : 0, color);
  });
}

function renderCamp(ctx) {
  const x = sx(STATE.campX);
  if (x < -200 || x > W + 200) return;
  ctx.save();
  ctx.strokeStyle = PAL.hud;
  ctx.lineWidth = 4;
  // Zelt
  ctx.beginPath();
  ctx.moveTo(x + 40, GROUND);
  ctx.lineTo(x + 120, GROUND - 120);
  ctx.lineTo(x + 200, GROUND);
  ctx.moveTo(x + 120, GROUND - 120);
  ctx.lineTo(x + 120, GROUND);
  ctx.stroke();
  // Fahne
  ctx.beginPath();
  ctx.moveTo(x + 120, GROUND - 120);
  ctx.lineTo(x + 120, GROUND - 200);
  ctx.lineTo(x + 170, GROUND - 185 + Math.sin(STATE.time * 6) * 6);
  ctx.lineTo(x + 120, GROUND - 170);
  ctx.stroke();
  // Lagerfeuer
  ctx.strokeStyle = PAL.fire;
  ctx.shadowBlur = 20;
  ctx.shadowColor = PAL.fire;
  ctx.beginPath();
  for (let i = 0; i < 3; i++) {
    const fx = x - 40 + i * 14;
    const fh = 40 + Math.sin(STATE.time * 9 + i * 2) * 14;
    ctx.moveTo(fx - 10, GROUND);
    ctx.quadraticCurveTo(fx, GROUND - fh, fx + 10, GROUND);
  }
  ctx.stroke();
  ctx.restore();
  util.renderText({ ctx, text: 'LAGER', x: x + 120, y: GROUND - 220, fontSize: '40px', fillStyle: PAL.hud });
}

function renderHero(ctx) {
  let x = HERO_X;
  if (hero.state === 'fall') x = hero.x - STATE.camX;
  let y = GROUND;
  let rot = 0;
  let sink = 0;
  let alpha = 1;
  const phase = hero.walkPhase;
  if (hero.state === 'swing') {
    const p = Math.min(1, hero.t / SETTINGS.swingDuration);
    y = GROUND - Math.sin(p * Math.PI) * 140;
    rot = (p - 0.5) * 0.8;
  } else if (hero.state === 'trip') {
    rot = -1.2 * Math.min(1, hero.t * 5);
    y = GROUND - 10;
  } else if (hero.state === 'fall') {
    const t = hero.t;
    if (hero.fallKind === 'pit') {
      y = GROUND + t * t * 600;
      rot = t * 4;
    } else if (hero.fallKind === 'croc') {
      y = GROUND + Math.min(1, t) * 90;
      rot = Math.sin(t * 20) * 0.3;
      alpha = Math.max(0, 1 - t / 1.5);
    } else {
      sink = Math.min(1, t / 1.6);
      y = GROUND + sink * 120;
    }
  }
  // Blinken während Unverwundbarkeit
  if (hero.invul > 0 && Math.sin(STATE.time * 30) > 0.3) alpha *= 0.35;

  const blinded = hero.blind > SETTINGS.blindThreshold;
  const color = hero.state === 'fall' && hero.fallKind === 'tar' ? PAL.tar : blinded ? PAL.heroBlind : PAL.hero;
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.translate(x, y);
  ctx.rotate(rot);
  ctx.lineWidth = 4;
  ctx.lineCap = 'round';
  ctx.strokeStyle = color;
  ctx.fillStyle = '#000000';
  const legSwing = hero.state === 'walk' ? Math.sin(phase) * 0.6 : hero.state === 'swing' ? 0.5 : 0.2;
  const hip = -55;
  // Beine
  ctx.beginPath();
  ctx.moveTo(0, hip);
  ctx.lineTo(Math.sin(legSwing) * 30, 0);
  ctx.moveTo(0, hip);
  ctx.lineTo(-Math.sin(legSwing) * 30, 0);
  ctx.stroke();
  // Rucksack
  ctx.beginPath();
  ctx.rect(-36, -112, 22, 46);
  ctx.fill();
  ctx.stroke();
  // Körper
  ctx.beginPath();
  ctx.ellipse(0, -88, 18, 36, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();
  // Arme
  ctx.beginPath();
  if (hero.state === 'swing') {
    ctx.moveTo(0, -105);
    ctx.lineTo(-6, -160);
    ctx.moveTo(0, -105);
    ctx.lineTo(6, -160);
  } else if (hero.state === 'fall') {
    ctx.moveTo(0, -105);
    ctx.lineTo(-30, -150 + Math.sin(STATE.time * 20) * 10);
    ctx.moveTo(0, -105);
    ctx.lineTo(30, -150 - Math.sin(STATE.time * 20) * 10);
  } else {
    ctx.moveTo(0, -105);
    ctx.lineTo(-Math.sin(legSwing) * 24, -70);
    ctx.moveTo(0, -105);
    ctx.lineTo(Math.sin(legSwing) * 24 + 6, -70);
  }
  ctx.stroke();
  // Kopf
  ctx.beginPath();
  ctx.arc(4, -140, 20, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();
  // Schnurrbart
  ctx.beginPath();
  ctx.moveTo(8, -132);
  ctx.quadraticCurveTo(18, -126, 28, -134);
  ctx.moveTo(8, -132);
  ctx.quadraticCurveTo(0, -126, -6, -132);
  ctx.stroke();
  // Augen (geblendet: Kreuzchen)
  ctx.lineWidth = 3;
  ctx.beginPath();
  if (blinded || hero.state === 'trip') {
    ctx.moveTo(8, -148);
    ctx.lineTo(16, -140);
    ctx.moveTo(16, -148);
    ctx.lineTo(8, -140);
  } else {
    ctx.arc(14, -144, 3, 0, Math.PI * 2);
  }
  ctx.stroke();
  // Tropenhelm
  ctx.strokeStyle = hero.state === 'fall' && hero.fallKind === 'tar' ? PAL.tar : PAL.helmet;
  ctx.lineWidth = 4;
  ctx.beginPath();
  ctx.arc(4, -152, 24, Math.PI, Math.PI * 2);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(-28, -152);
  ctx.lineTo(36, -152);
  ctx.stroke();
  ctx.restore();

  // Sternchen beim Hinsetzen
  if (hero.state === 'trip') {
    ctx.save();
    ctx.strokeStyle = PAL.gold;
    ctx.lineWidth = 3;
    for (let i = 0; i < 3; i++) {
      const a = STATE.time * 5 + (i * Math.PI * 2) / 3;
      const px = x - 60 + Math.cos(a) * 40;
      const py = GROUND - 120 + Math.sin(a) * 12;
      ctx.beginPath();
      ctx.moveTo(px - 8, py);
      ctx.lineTo(px + 8, py);
      ctx.moveTo(px, py - 8);
      ctx.lineTo(px, py + 8);
      ctx.stroke();
    }
    ctx.restore();
  }
  // Teer-Bläschen beim Versinken
  if (hero.state === 'fall' && hero.fallKind === 'tar' && Math.random() < 0.2) {
    addParticles(x + (Math.random() - 0.5) * 50, GROUND + 10, 1, PAL.tar, 30, -80);
  }
  renderBubble(ctx, x, Math.min(y, GROUND) - 210);
}

function renderBubble(ctx, x, y) {
  if (hero.sayTime <= 0 || !hero.say) return;
  ctx.save();
  ctx.font = 'bold 36px Arvo';
  const w = Math.max(120, ctx.measureText(hero.say).width + 44);
  const bx = Math.min(W - w - 20, Math.max(20, x - 30));
  const by = Math.max(70, y - 40);
  ctx.globalAlpha = Math.min(1, hero.sayTime * 3);
  ctx.fillStyle = '#000000';
  ctx.strokeStyle = PAL.sub;
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(bx + 20, by);
  ctx.lineTo(bx + w - 20, by);
  ctx.quadraticCurveTo(bx + w, by, bx + w, by + 20);
  ctx.lineTo(bx + w, by + 40);
  ctx.quadraticCurveTo(bx + w, by + 60, bx + w - 20, by + 60);
  ctx.lineTo(x + 20, by + 60);
  ctx.lineTo(x + 5, by + 85);
  ctx.lineTo(x + 2, by + 60);
  ctx.lineTo(bx + 20, by + 60);
  ctx.quadraticCurveTo(bx, by + 60, bx, by + 40);
  ctx.lineTo(bx, by + 20);
  ctx.quadraticCurveTo(bx, by, bx + 20, by);
  ctx.fill();
  ctx.stroke();
  ctx.restore();
  ctx.save();
  ctx.globalAlpha = Math.min(1, hero.sayTime * 3);
  util.renderText({ ctx, text: hero.say, x: bx + w / 2, y: by + 43, fontSize: '36px', fillStyle: PAL.sub });
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
    util.renderText({ ctx, text: f.text, x: f.x, y: f.y, fontSize: '44px', fillStyle: f.color });
    ctx.restore();
  });
}

function renderHud(ctx) {
  const y = 58;
  ctx.save();
  ctx.fillStyle = '#000000';
  ctx.globalAlpha = 0.6;
  ctx.fillRect(0, 0, W, 80);
  ctx.restore();
  util.renderText({ ctx, text: 'Level ' + STATE.level, x: 220, y, fontSize: '46px', fillStyle: PAL.hud });
  util.renderText({ ctx, text: Math.round(STATE.score) + ' Punkte', x: 760, y, fontSize: '46px', fillStyle: PAL.hud });
  const clock = Math.max(0, Math.ceil(STATE.clock));
  const low = STATE.clock < 15;
  util.renderText({
    ctx,
    text: 'Zeit ' + Math.floor(clock / 60) + ':' + String(clock % 60).padStart(2, '0'),
    x: 1260,
    y,
    fontSize: low && Math.sin(STATE.time * 8) > 0 ? '54px' : '46px',
    fillStyle: low ? PAL.warn : PAL.hud,
  });
  // Leben als kleine Helme
  ctx.save();
  ctx.strokeStyle = PAL.helmet;
  ctx.lineWidth = 4;
  for (let i = 0; i < hero.lives; i++) {
    const hx = 1560 + i * 70;
    ctx.beginPath();
    ctx.arc(hx, 52, 22, Math.PI, Math.PI * 2);
    ctx.closePath();
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(hx - 30, 52);
    ctx.lineTo(hx + 30, 52);
    ctx.stroke();
  }
  ctx.restore();
  // Fortschritt zum Lager
  const total = Math.max(1, STATE.campX - (STATE.levelStartX || STATE.startX));
  const p = Math.max(0, Math.min(1, (hero.x - (STATE.levelStartX || STATE.startX)) / total));
  ctx.save();
  ctx.fillStyle = PAL.meterDim;
  ctx.fillRect(0, 78, W, 4);
  ctx.fillStyle = PAL.hud;
  ctx.fillRect(0, 78, W * p, 4);
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
  renderGround(ctx);
  hazards.forEach((h) => {
    if (!onScreen(h.x0, h.x1, 250)) return;
    if (h.type === 'croc') {
      renderWater(ctx, sx(h.x0), sx(h.x1));
      h.crocs.forEach((c) => renderCroc(ctx, c));
    } else if (h.type === 'vine') renderVine(ctx, h);
    else if (h.type === 'tar') renderTar(ctx, h);
    else renderSlope(ctx, h);
  });
  renderCamp(ctx);
  renderTreasures(ctx);
  renderLogs(ctx);
  renderHero(ctx);
  renderParticles(ctx);
  ctx.restore();
}

// ---------------------------------------------------------------------------------------------------------
// Szenen
// ---------------------------------------------------------------------------------------------------------

function handleTitle(grid, dt, ctx) {
  STATE.camX += 60 * dt; // Dschungel zieht vorbei, Professor läuft auf der Stelle
  hero.walkPhase += dt * 6;
  hero.state = 'walk';
  renderBackground(ctx);
  ctx.save();
  ctx.fillStyle = '#000000';
  ctx.fillRect(0, GROUND, W, H - GROUND);
  ctx.strokeStyle = PAL.ground;
  ctx.lineWidth = 4;
  ctx.beginPath();
  ctx.moveTo(0, GROUND);
  ctx.lineTo(W, GROUND);
  ctx.stroke();
  ctx.restore();
  if (hero.sayTime <= 0 && Math.random() < dt * 0.5) say(QUIPS[Math.floor(Math.random() * QUIPS.length)], 2);
  hero.sayTime = Math.max(0, hero.sayTime - dt);
  ctx.save();
  ctx.translate(280, 0); // nicht unter die Highscore-Tafel links
  renderHero(ctx);
  ctx.restore();
  renderParticles(ctx);

  renderTextDropShadow({ ctx, text: 'Dschungel-Dussel', x: W / 2, y: 210, fontSize: '150px', fillStyle: PAL.title });
  util.renderText({ ctx, text: 'Ein Forscher. Kein Plan. Viele Laser.', x: W / 2, y: 300, fontSize: '54px', fillStyle: PAL.sub });
  util.renderText({
    ctx,
    text: 'Krokos zuhalten · Lianen fallen lassen · Teer trocknen · Stämme zerbröseln · Schätze schnappen\nAber NICHT dem Professor in die Augen leuchten!',
    x: W / 2,
    y: 930,
    fontSize: '36px',
    lineHeight: 52,
    fillStyle: PAL.hudDim,
  });
  if (!startButton) {
    startButton = guiFillButton({
      label: 'START',
      posX: W / 2 + 200,
      posY: 520,
      radius: 120,
      edges: 7,
      speedUp: 45,
      speedDown: 20,
      activeValue: 85,
      lineWidth: 4,
      normalColor: PAL.start[0],
      growColor: PAL.start[1],
      activeColor: PAL.start[2],
      onEnterActive: () => startGame(),
    });
  }
  startButton.handle(grid, dt);
  if (keyEdge('Space')) startGame();
  highscore.renderHighAndLowScores(ctx);
}

function handleGame(grid, dt, ctx) {
  STATE.clock -= dt;
  updateBlind(grid, dt);
  updateHazards(grid, dt);
  updateLogs(grid, dt);
  updateTreasures(grid, dt);
  updateHero(dt);
  updateParticles(dt);
  if (STATE.scene !== 'game') {
    // endGame/reachCamp hat gewechselt – trotzdem diesen Frame noch zeichnen
    renderWorld(ctx, dt);
    renderHud(ctx);
    return;
  }
  if (keyEdge('Digit9')) {
    hero.x = STATE.campX - 5;
    STATE.camX = hero.x - HERO_X;
  }
  renderWorld(ctx, dt);
  renderHud(ctx);
  renderFlash(ctx, dt);
  if (STATE.clock <= 0) endGame('Die Expeditions-Uhr ist abgelaufen.');
}

function handleLevelUp(grid, dt, ctx) {
  updateParticles(dt);
  hero.sayTime = Math.max(0, hero.sayTime - dt);
  hero.walkPhase += dt * 10; // Freudentanz
  renderWorld(ctx, dt);
  renderHud(ctx);
  renderFlash(ctx, dt);
  const s = 1 + Math.max(0, 0.4 - STATE.sceneTime) * 1.5;
  ctx.save();
  ctx.translate(W / 2, 330);
  ctx.scale(s, s);
  renderTextDropShadow({ ctx, text: 'LEVEL ' + STATE.level, x: 0, y: 0, fontSize: '150px', fillStyle: PAL.title });
  ctx.restore();
  util.renderText({ ctx, text: LEVEL_NEWS[STATE.level] || 'Weiter, Professor!', x: W / 2, y: 425, fontSize: '54px', fillStyle: PAL.sub });
  util.renderText({ ctx, text: '+' + SETTINGS.campBonusTime + ' s Expeditions-Uhr', x: W / 2, y: 495, fontSize: '42px', fillStyle: PAL.hud });
  if (STATE.sceneTime >= SETTINGS.levelUpDuration) {
    STATE.levelStartX = hero.x;
    setScene('game');
  }
}

function handleGameOver(grid, dt, ctx) {
  updateParticles(dt);
  renderBackground(ctx);
  ctx.save();
  ctx.fillStyle = '#000000';
  ctx.fillRect(0, GROUND, W, H - GROUND);
  ctx.restore();
  renderTextDropShadow({ ctx, text: 'Expedition beendet', x: W / 2, y: 190, fontSize: '120px', fillStyle: PAL.title });
  util.renderText({ ctx, text: STATE.endReason, x: W / 2, y: 280, fontSize: '50px', fillStyle: PAL.warn });
  util.renderText({
    ctx,
    text:
      Math.round(STATE.score) + ' Punkte' + (STATE.newHighscore ? '  – NEUER HIGHSCORE!' : '') + '\n' +
      'Level ' + STATE.level + ' · ' + Math.round(distanceMeters()) + ' m Dschungel\n' +
      STATS.treasures + ' Schätze (' + STATS.treasurePoints + ' Pkt)' + (STATS.socks ? ' · ' + STATS.socks + ' Socke(n)' : '') + '\n' +
      STATS.swings + '× geschwungen · ' + STATS.crocsPassed + ' Krokos überquert · ' + STATS.logsCrumbled + ' Stämme zerbröselt\n' +
      Math.round(STATS.blindSeconds) + ' s geblendet – der Professor ist nicht amüsiert.',
    x: W / 2,
    y: 380,
    fontSize: '40px',
    lineHeight: 60,
    fillStyle: PAL.sub,
  });
  highscore.renderHighAndLowScores(ctx);
  if (STATE.sceneTime > SETTINGS.againDelay) {
    if (!againButton) {
      againButton = guiFillButton({
        label: 'NOCHMAL',
        posX: W / 2,
        posY: 880,
        radius: 95,
        edges: 6,
        speedUp: 45,
        speedDown: 20,
        activeValue: 85,
        lineWidth: 4,
        normalColor: PAL.start[0],
        growColor: PAL.start[1],
        activeColor: PAL.start[2],
        onEnterActive: () => startGame(),
      });
    }
    againButton.handle(grid, dt);
    if (keyEdge('Space')) startGame();
  } else {
    keyEdge('Space');
  }
}

// ---------------------------------------------------------------------------------------------------------
// Export
// ---------------------------------------------------------------------------------------------------------

export default {
  name: 'Dschungel-Dussel',
  description: `  Professor Pfefferkorn stapft durch den Dschungel
  und schaut nie hin.
 
  Ihr steuert nicht ihn, sondern die WELT:

  Krokodil-Schnauzen anleuchten = Maul bleibt zu.

  Ast über der Schlucht füllen = Liane fällt, er schwingt rüber.

  Teergruben alle zusammen trockenleuchten.

  Rollende Stämme zerbröseln, Schätze einsammeln.

  Aber: Leuchtet ihm nicht in die Augen – dann sieht er nix!
  `,
  image: 'media/img/gametitles/laser-paradise-###4###.png',

  init: function () {
    resetAll();
  },

  handle: function (grid, elapsed) {
    const dt = Math.min(elapsed || 0, 0.1);
    const ctx = MasterCanvas.get2dContext();
    ensurePalette();
    STATE.time += dt;
    STATE.sceneTime += dt;
    if (hazards.length === 0) generateLevel(hero.x, STATE.level); // falls ohne init() gestartet

    switch (STATE.scene) {
      case 'title':
        handleTitle(grid, dt, ctx);
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
