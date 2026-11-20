/**
 * Felssturz – das Publikum gräbt, der Grubenwurm rennt, die Felsen fallen
 *
 * Ein Höhlenquerschnitt aus 48 × 24 Erdzellen (à 40 px). Der Bildschirm ist die Erde – ihr seid die Schaufel.
 * - GRABEN: Erde, die ihr anleuchtet, bröckelt nach kurzer Zeit weg (gui/paintLayer, Wert füllt sich pro Zelle).
 *   Mehr Laser = mehr Zellen gleichzeitig. Kurzes Drüberwischen gräbt nichts, man muss draufbleiben.
 * - KURT, der Grubenwurm, kriecht AUTOMATISCH (Breitensuche über freie Zellen) zum nächsten erreichbaren Diamanten.
 *   Kommt er nirgends hin, sitzt er da und zeigt mit einem Pfeil, wo der nächste Diamant liegt: "Grabt mir einen Weg!"
 * - Felsen und Diamanten folgen Boulder-Dash-Physik (Modul game-055-cellphysics.js): sie fallen in Gänge
 *   und rollen von runden Dingen seitlich ab. Fällt ein Fels auf Kurt: PLATT – ein Leben weg.
 *   Wer wild unter Felsen gräbt, löst Steinschläge aus. Fallende Diamanten fängt Kurt dagegen mit dem Mund.
 * - Genug Diamanten → der Ausgang öffnet sich → Kurt kriecht hin → Level geschafft (Restzeit-Bonus).
 * - Strafe fürs Wildleuchten: Wer Kurt ins Gesicht leuchtet, blendet ihn – er bleibt stehen ("Ich seh nix!"),
 *   und stehende Würmer sind Ziele für fallende Felsen.
 *
 * Level: jedes Level mehr Felsen, mehr Diamanten nötig, härtere Erde, weniger Zeit.
 *   ab L2 Ziegelmauern (Felsen rollen davon ab), ab L3 Glühwürmchen, die an den Gangwänden entlangwandern –
 *   berühren sie Kurt, knallt es; trifft sie ein Fels, explodieren sie zu Diamanten (Fels drüber freigraben!).
 *   ab L4 wachsender Fraktal-Schleim (Julia-Muster): frisst Erde und Gänge. Wird er zu groß, versteinert er zu
 *   Felsen (Lawine!), wird er eingeschlossen, wird er zu Diamanten. Anleuchten verbrennt ihn langsam.
 *   Zeit abgelaufen → die Höhle stürzt ein, ein Leben weg, Level beginnt neu. Keine Leben mehr → Game Over.
 *
 * Licht-Disziplin: Die ganze Höhle ist Aktionsfläche und daher schwarz – Erde nur als dunkle Texturpunkte und
 * Kanten, Felsen nur als Kontur. Leuchtend sind nur kleine Objekte (Diamanten, Kurt, Glühwürmchen) und die
 * HUD-Leiste oben (reiner Anzeigebereich). Nie die reine Laserfarbe, Hue nur 0.25..0.75 der Laserfarbe.
 *
 * Tastatur (Test ohne Laser):
 * - Leertaste: Start / Nochmal
 * - Pfeiltasten: Grabe-Cursor bewegen – die Zelle, in die er fährt, wird sofort abgegraben; Enter: Zelle unter
 *   dem Cursor graben
 * - 1: Tunnel von Kurt Richtung nächster Diamant graben (bis 6 Zellen) · 9: Level überspringen
 * - 0 (halten): Kurt blenden · 8: Fels über Kurt fallen lassen (Platt-Test)
 *   (d v g r m h t f F s, PageUp/PageDown/Home sind Debug-Tasten in view.js und hier bewusst frei)
 *
 * Klassiker: Boulder Dash (First Star Software, Peter Liepa, C64/Atari 8-bit, 1984) – fallende Felsen, rollende
 * Diamanten, Glühwürmchen, Amöbe, Ausgang nach Diamantenquote. Anders hier: nicht die Figur wird gesteuert,
 * sondern die Erde – das Publikum gräbt, die Figur läuft selbst (ein bisschen Lemmings, Amiga 1991).
 * Ähnlichkeiten im Bestand: game-036-ausgrabung (Erde per paintLayer abtragen – dort ruhige Archäologie ohne
 * Physik), game-053-dschungeldussel (Publikum baut die Welt für eine autonome, tollpatschige Figur).
 *
 * One-Pixel-Netzwerkspiel: funktioniert direkt – jeder Mitspieler steuert genau einen Pixel = eine Schaufel.
 * Jede Zelle braucht Ausdauer (Akkumulation), viele Pixel graben parallel; Server-seitig wäre die Zellphysik
 * ein Zellautomat, der für Millionen Pixel auf der GPU laufen kann (siehe Kopf von game-055-cellphysics.js).
 *
 * Highscore: Punkte, Level, Diamanten, gegrabene Zellen, wie oft Kurt platt war. (Wie früher am C64-Automaten:
 * ohne Highscore-Tafel kein Grund für "nur noch eine Runde".)
 */

import util, { getRgbSpreadHex, renderTextDropShadow } from '../util.js';
import { createKeyEdge, isKeyDown } from './gui/gridScan.js';
import createCellPhysics from './game-055-cellphysics.js';
import soundRock from '../../../public/media/155235__zangrutz__bomb-small (1).mp3';
import soundBoom from '../../../public/media/414346__bykgames__explosion-far.wav';
import soundStomp from '../../../public/media/517267__foolboymedia__cinematic-stomp.wav';
import soundPlop from '../../../public/media/369952__mischy__plop-1.wav';
import soundMusic from '../../../public/media/522110__setuniman__cheeky-1t41b.wav';
import soundJingle from '../../../public/media/521966__kastenfrosch__ready-to-start-jingle.ogg';
import soundGem from '../../../public/media/opengameart/Item Pickup.ogg';
import soundExit from '../../../public/media/opengameart/Ability Learn.ogg';
import soundLevelUp from '../../../public/media/opengameart/Level Up.ogg';
import soundHurt from '../../../public/media/opengameart/Menu Error.ogg';
import soundDig from '../../../public/media/opengameart/Menu Move.ogg';
import soundGameOver from '../../../public/media/opengameart/Music Box Game Over III.wav';
var laserConfig = require('../LaserApiConfig.js').default;
var MasterCanvas = require('../MasterCanvas').default;
var guiFillButton = require('./gui/fillButton-ai2').default;
var guiPaintLayer = require('./gui/paintLayer').default;
var createHighscore = require('../util/highscore').default;

const W = 1920;
const H = 1080;
const COLS = 48;
const ROWS = 24;
const CS = 40; // Zellgröße in px
const OY = 100; // Höhle beginnt unter der HUD-Leiste
const FIELD_H = ROWS * CS;

// Zelltypen
const T = {
  EMPTY: 0,
  EARTH: 1,
  STEEL: 2,
  BRICK: 3,
  ROCK: 4,
  GEM: 5,
  DIGGER: 6,
  FLY: 7,
  AMOEBA: 8,
  EXIT: 9,
};

// Richtungen im Uhrzeigersinn: rechts, unten, links, oben
const DIRX = [1, 0, -1, 0];
const DIRY = [0, 1, 0, -1];

// ---------------------------------------------------------------------------------------------------------
// Einstellungen
// ---------------------------------------------------------------------------------------------------------

const SETTINGS = {
  startLives: 3,
  physicsHz: 10, // Physik-Ticks pro Sekunde (feste Schrittrate)
  maxTicksPerFrame: 3,
  digSpeedDown: 0.7, // Grabfortschritt verfällt ohne Laser
  amoebaBurnHits: 2, // so oft muss eine Schleimzelle "voll" geleuchtet werden
  amoebaGemChance: 0.12,
  blindRadius: 30, // nur Kurts eigene Zelle
  blindThreshold: 0.5, // Anteil beleuchteter Zellen im Radius
  blindHold: 0.35, // so lange muss geblendet werden, bis er stehen bleibt
  squashTime: 2.4,
  invulTime: 2.5,
  collapseTime: 2.6,
  levelUpDuration: 3.2,
  againDelay: 1.5,
  maxParticles: 400,
  maxFloaters: 30,
  rockSoundGap: 0.12,
  digSoundGap: 0.09,
  pointsDig: 1,
  pointsGem: 50,
  pointsGemPerLevel: 10,
  pointsExtraGem: 100,
  pointsFly: 150,
  pointsAmoeba: 5,
  pointsTimeBonus: 5, // pro Restsekunde
};

const DIFFICULTY = {
  rockDensityStart: 0.1,
  rockDensityPerLevel: 0.025,
  rockDensityMax: 0.27,
  gemsStart: 14,
  gemsPerLevel: 2,
  gemsMax: 28,
  needStart: 6,
  needPerLevel: 1,
  needMax: 16,
  timeStart: 150, // Sekunden pro Level
  timePerLevel: -8,
  timeMin: 90,
  digSpeedStart: 1.7, // Grabfortschritt pro Sekunde bei voller Beleuchtung (1 = Zelle in 1 s weg)
  digSpeedPerLevel: -0.1,
  digSpeedMin: 0.95,
  diggerTicksStart: 3, // Kurt bewegt sich alle n Physik-Ticks
  diggerTicksFastFrom: 5, // ab diesem Level alle 2 Ticks
  pocketsStart: 2,
  pocketsPerLevel: 1,
  pocketsMax: 7,
  brickFromLevel: 2,
  bricksStart: 2,
  bricksPerLevel: 1,
  bricksMax: 6,
  flyFromLevel: 3,
  fliesStart: 2,
  fliesPerLevel: 1,
  fliesMax: 6,
  flyTicks: 2,
  amoebaFromLevel: 4,
  amoebaGrowStart: 0.012, // Wachstumschance pro Zelle und Tick
  amoebaGrowPerLevel: 0.003,
  amoebaGrowMax: 0.03,
  amoebaMax: 130, // ab dieser Größe versteinert er
};

const LEVEL_NEWS = {
  1: 'Grabt Kurt Wege zu den Diamanten!',
  2: 'Ziegelmauern: Felsen rollen davon ab',
  3: 'Glühwürmchen! Fels drauf = Diamanten',
  4: 'Fraktal-Schleim wächst – brennt ihn weg!',
  5: 'Kurt wird flinker – Felsen auch',
  6: 'Mehr Felsen, weniger Zeit',
};

const QUIPS = [
  'Lecker Erde!', 
  'Ich riech Diamanten!', 
  'Hier unten ist es gemütlich.', 
  'Bitte keine Felsen.', 
  'Kurt kriecht!',
  'Dunkel hier. Genau mein Ding.',
  'Noch fünf Meter bis zum Schatz. Oder zum Erdkern.', 
  'Wer braucht schon Tageslicht?',
  'Tiefer, immer tiefer!',
  'Ist das Gold oder nur ein gelber Käfer?',
  'Mein Lieblingskanal: Der Tunnelkanal.',
  'Kein WLAN, aber super Akustik!'
];

const IDLE_QUIPS = [
  'Grabt mir einen Weg!', 
  'Hallo? Schaufel?', 
  'Ich komm da nicht hin!', 
  'Da drüben glitzert was!',
  'Sackgasse! Macht mal Platz!',
  'Ich steck fest... naja, fast.',
  'Hello? Bagger-Support?',
  'Hier geht’s nicht weiter, Chef!',
  'Ich hab nicht den ganzen Tag Zeit – doch, eigentlich schon.',
  'Ein Tunnel wäre jetzt echt praktisch.',
  'Soll ich mich hier durchbeißen oder was?',
  'Warte auf Freigabe der Baustelle...'
];

const SQUASH_QUIPS = [
  'PLATT!', 
  'Autsch!', 
  'Mein Helm!', 
  'Uff!', 
  'Ich seh Sterne!',
  'Pfannkuchen-Modus aktiviert!',
  'Wer hat hier die Schwerkraft hochgedreht?!',
  'Das gibt ’ne Beule!',
  'Ich bin jetzt 1D!',
  'Steinschlag! Und ich hab keinen Regenschirm!',
  'Aua, mein Rücken!',
  'Das war nicht im Tarifvertrag!'
];
// ---------------------------------------------------------------------------------------------------------
// Zustand (vorbelegt – handle() läuft auch ohne init())
// ---------------------------------------------------------------------------------------------------------

const STATE = {
  scene: 'title',
  sceneTime: 0,
  time: 0,
  level: 1,
  lives: SETTINGS.startLives,
  score: 0,
  levelTime: DIFFICULTY.timeStart,
  gems: 0, // in diesem Level eingesammelt
  need: DIFFICULTY.needStart,
  gemsTotal: 0, // im Level vorhanden (zu Beginn)
  exitOpen: false,
  exitIndex: -1,
  startIndex: -1,
  acc: 0,
  tickPhase: 0,
  tickCount: 0,
  shake: 0,
  flash: 0,
  collapse: 0,
  rockSoundT: 0,
  digSoundT: 0,
  newHighscore: false,
  endReason: '',
  cursor: COLS * 3 + 3,
  cursorShow: 0,
  amoebaCount: 0,
  juliaC: [-0.8, 0.156],
  worldReady: false,
  lastBonus: 0,
};

const STATS = {
  gems: 0,
  dug: 0,
  squashed: 0,
  flies: 0,
  amoebaBurned: 0,
  rocksFallen: 0,
  levelsDone: 0,
  blindSeconds: 0,
  caught: 0,
};

const digger = {
  i: -1,
  trail: [-1, -1, -1, -1],
  state: 'walk', // walk | squashed | gone
  ticksSinceMove: 0,
  dir: 0,
  invul: 0,
  blind: 0,
  blindTime: 0,
  stateT: 0,
  idle: 0,
  say: '',
  sayTime: 0,
  hintTarget: -1,
  cause: '',
};

var flies = [];
var particles = [];
var floaters = [];
var rings = [];
var digQueue = [];

var phys = null;
var digLayer = null;
var amoebaHits = new Uint8Array(COLS * ROWS);
var bfsPrev = new Int32Array(COLS * ROWS);
var bfsQueue = new Int32Array(COLS * ROWS);
var bfsSeen = new Uint32Array(COLS * ROWS);
var bfsStamp = 1;

var startButton = null;
var againButton = null;
var music = null;
var keyEdge = createKeyEdge();
var highscore = createHighscore('Felssturz', 'punkte');

var PAL = null;
var palKey = '';
var terrainCanvas = null;
var terrainCtx = null;
var terrainFull = true;
var rockSprites = null;
var gemSprite = null;
var juliaCanvas = null;
var juliaKey = '';

// ---------------------------------------------------------------------------------------------------------
// Hilfen
// ---------------------------------------------------------------------------------------------------------

/** Farbe aus der Laserfarbe; Hue immer im Komplementärbereich 0.25..0.75 */
function col(h, s, v) {
  const hue = Math.max(0.25, Math.min(0.75, h));
  return getRgbSpreadHex(laserConfig.testColor, hue, s, v);
}

function hexToRgb(hex) {
  const m = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})/i.exec(String(hex));
  return m ? [parseInt(m[1], 16), parseInt(m[2], 16), parseInt(m[3], 16)] : [128, 128, 128];
}

function ensurePalette() {
  const key = String(laserConfig.testColor);
  if (PAL && key === palKey) return;
  palKey = key;
  PAL = {
    earthDot: col(0.3, 0.45, 0.3),
    earthDot2: col(0.36, 0.4, 0.22),
    earthEdge: col(0.32, 0.55, 0.42),
    dig: col(0.35, 0.6, 0.7),
    steel: col(0.6, 0.25, 0.4),
    steelRivet: col(0.6, 0.2, 0.55),
    brick: col(0.27, 0.5, 0.42),
    rock: col(0.28, 0.4, 0.75),
    rockCrack: col(0.28, 0.35, 0.4),
    gem: col(0.52, 0.55, 1),
    gemFacet: col(0.5, 0.3, 1),
    gemSpark: col(0.48, 0.1, 1),
    fly: col(0.72, 0.75, 1),
    fly2: col(0.68, 0.55, 0.8),
    worm: col(0.4, 0.55, 0.95),
    wormDark: col(0.4, 0.5, 0.55),
    helmet: col(0.28, 0.75, 0.95),
    lamp: col(0.27, 0.3, 1),
    exitClosed: col(0.6, 0.3, 0.45),
    exitOpen: col(0.45, 0.6, 1),
    exitOpen2: col(0.65, 0.6, 0.9),
    amoeba: col(0.62, 0.7, 0.8),
    hud: col(0.45, 0.5, 0.95),
    hudDim: col(0.45, 0.35, 0.6),
    warn: col(0.72, 0.85, 1),
    title: col(0.5, 0.6, 1),
    sub: col(0.35, 0.45, 0.85),
    flash: col(0.5, 0.15, 1),
    dust: col(0.3, 0.3, 0.55),
    cursor: col(0.55, 0.5, 0.8),
    hint: col(0.5, 0.45, 0.55),
    start: [col(0.42, 0.6, 0.6), col(0.42, 0.6, 0.8), col(0.42, 0.6, 1)],
  };
  rockSprites = null;
  gemSprite = null;
  juliaKey = '';
  terrainFull = true;
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

function rnd(a, b) {
  return a + Math.random() * (b - a);
}
function irnd(a, b) {
  return a + Math.floor(Math.random() * (b - a + 1));
}

/** deterministischer Zufall 0..1 pro Zelle (für Erdtextur) */
function hash(i, k) {
  let h = Math.imul(i + 1, 374761393) ^ Math.imul(k + 7, 668265263);
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}

function cellX(i) {
  return (i % COLS) * CS + CS / 2;
}
function cellY(i) {
  return OY + Math.floor(i / COLS) * CS + CS / 2;
}

function levelValue(start, perLevel, limit) {
  const v = start + (STATE.level - 1) * perLevel;
  return perLevel >= 0 ? Math.min(limit, v) : Math.max(limit, v);
}

function digSpeed() {
  return levelValue(DIFFICULTY.digSpeedStart, DIFFICULTY.digSpeedPerLevel, DIFFICULTY.digSpeedMin);
}

function diggerTicks() {
  return STATE.level >= DIFFICULTY.diggerTicksFastFrom ? 2 : DIFFICULTY.diggerTicksStart;
}

function say(text, duration) {
  digger.say = text;
  digger.sayTime = duration || 1.8;
}

function addParticles(x, y, count, color, speed, gravity) {
  for (let k = 0; k < count && particles.length < SETTINGS.maxParticles; k++) {
    const a = Math.random() * Math.PI * 2;
    const s = (0.3 + Math.random()) * (speed || 200);
    const life = 0.4 + Math.random() * 0.7;
    particles.push({ x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s - (gravity ? 120 : 0), g: gravity || 0, life, max: life, color, size: 2 + Math.random() * 4 });
  }
}

function addFloater(x, y, text, color, size) {
  if (floaters.length >= SETTINGS.maxFloaters) floaters.shift();
  floaters.push({ x, y, text, color, life: 1.6, size: size || 44 });
}

function addRing(x, y, color, maxR) {
  if (rings.length > 20) rings.shift();
  rings.push({ x, y, color, r: 10, maxR: maxR || 140, life: 0.6, max: 0.6 });
}

// ---------------------------------------------------------------------------------------------------------
// Welt: Physik + Grabeschicht (lazy)
// ---------------------------------------------------------------------------------------------------------

function ensureWorld() {
  if (!phys) {
    const types = {};
    types[T.ROCK] = { falls: true, round: true };
    types[T.GEM] = { falls: true, round: true };
    types[T.BRICK] = { round: true };
    types[T.STEEL] = { indestructible: true };
    types[T.EXIT] = { indestructible: true };
    types[T.DIGGER] = { crushable: true };
    types[T.FLY] = { crushable: true };
    types[T.AMOEBA] = { grows: true, growInto: [T.EMPTY, T.EARTH], growChance: DIFFICULTY.amoebaGrowStart };
    phys = createCellPhysics({ cols: COLS, rows: ROWS, empty: T.EMPTY, types, onLand: handleLand, onCrush: handleCrush });
  }
  if (!digLayer) {
    digLayer = guiPaintLayer({
      label: 'Erde',
      posX: 0,
      posY: OY,
      width: COLS * CS,
      height: FIELD_H,
      cellSize: CS,
      speedUp: digSpeed(),
      speedDown: SETTINGS.digSpeedDown,
      brushRadius: 0,
      threshold: 1,
      visible: false,
      render: 'paint',
      onCellChange: (ev) => {
        if (ev.full && digQueue.length < 2000) digQueue.push(ev.index);
      },
    });
  }
  if (!STATE.worldReady) {
    generateLevel();
  }
}

function generateLevel() {
  const lvl = STATE.level;
  const E = T.EARTH;
  phys.fill(E);
  for (let x = 0; x < COLS; x++) {
    phys.set(x, 0, T.STEEL);
    phys.set(x, ROWS - 1, T.STEEL);
  }
  for (let y = 0; y < ROWS; y++) {
    phys.set(0, y, T.STEEL);
    phys.set(COLS - 1, y, T.STEEL);
  }
  // Felsen
  const density = levelValue(DIFFICULTY.rockDensityStart, DIFFICULTY.rockDensityPerLevel, DIFFICULTY.rockDensityMax);
  for (let y = 1; y < ROWS - 1; y++) {
    for (let x = 1; x < COLS - 1; x++) {
      if (Math.random() < density) phys.set(x, y, T.ROCK);
    }
  }
  // Ziegelmauern
  if (lvl >= DIFFICULTY.brickFromLevel) {
    const nb = Math.min(DIFFICULTY.bricksMax, DIFFICULTY.bricksStart + (lvl - DIFFICULTY.brickFromLevel) * DIFFICULTY.bricksPerLevel);
    for (let b = 0; b < nb; b++) {
      const len = irnd(4, 9);
      const bx = irnd(8, COLS - 2 - len);
      const by = irnd(4, ROWS - 4);
      for (let k = 0; k < len; k++) phys.set(bx + k, by, T.BRICK);
    }
  }
  // Hohlräume (instabil – hier rutscht beim Start schon etwas nach)
  const np = levelValue(DIFFICULTY.pocketsStart, DIFFICULTY.pocketsPerLevel, DIFFICULTY.pocketsMax);
  for (let p = 0; p < np; p++) {
    const px = irnd(10, COLS - 4);
    const py = irnd(3, ROWS - 3);
    const len = irnd(2, 4);
    for (let k = 0; k < len; k++) phys.set(px + k, py, T.EMPTY);
  }
  // Start oben links, Kurt in einer kleinen Kammer, darüber nur Erde
  const sx = irnd(3, 6);
  const sy = irnd(2, 5);
  for (let y = 1; y <= sy + 1; y++) {
    for (let x = sx - 2; x <= sx + 2; x++) {
      if (phys.get(x, y) !== T.STEEL) phys.set(x, y, E);
    }
  }
  phys.set(sx - 1, sy, T.EMPTY);
  phys.set(sx + 1, sy, T.EMPTY);
  // Ausgang rechts
  const ex = irnd(COLS - 6, COLS - 3);
  const ey = irnd(ROWS - 9, ROWS - 3);
  for (let y = ey - 1; y <= ey + 1; y++) {
    for (let x = ex - 1; x <= ex + 1; x++) {
      if (phys.get(x, y) !== T.STEEL) phys.set(x, y, E);
    }
  }
  phys.set(ex, ey, T.EXIT);
  STATE.exitIndex = phys.index(ex, ey);
  // Glühwürmchen in eigenen Gängen
  flies = [];
  if (lvl >= DIFFICULTY.flyFromLevel) {
    const nf = Math.min(DIFFICULTY.fliesMax, DIFFICULTY.fliesStart + (lvl - DIFFICULTY.flyFromLevel) * DIFFICULTY.fliesPerLevel);
    for (let f = 0; f < nf; f++) {
      const len = irnd(5, 8);
      const tx = irnd(12, COLS - 3 - len);
      const ty = irnd(4, ROWS - 3);
      for (let k = -1; k <= len; k++) {
        if (phys.get(tx + k, ty - 1) !== T.STEEL) phys.set(tx + k, ty - 1, E);
        if (phys.get(tx + k, ty + 1) === T.EMPTY) phys.set(tx + k, ty + 1, E);
      }
      for (let k = 0; k < len; k++) phys.set(tx + k, ty, T.EMPTY);
      const fi = phys.index(tx + Math.floor(len / 2), ty);
      phys.setAt(fi, T.FLY);
      flies.push({ i: fi, dir: Math.random() < 0.5 ? 0 : 2, prev: fi });
    }
  }
  // Schleim
  if (lvl >= DIFFICULTY.amoebaFromLevel) {
    const axp = irnd(16, COLS - 10);
    const ayp = irnd(ROWS - 8, ROWS - 3);
    phys.set(axp, ayp, T.AMOEBA);
    phys.set(axp + 1, ayp, T.AMOEBA);
    phys.setGrowChance(
      T.AMOEBA,
      Math.min(DIFFICULTY.amoebaGrowMax, DIFFICULTY.amoebaGrowStart + (lvl - DIFFICULTY.amoebaFromLevel) * DIFFICULTY.amoebaGrowPerLevel)
    );
  }
  // Diamanten (nicht direkt beim Start)
  const ng = levelValue(DIFFICULTY.gemsStart, DIFFICULTY.gemsPerLevel, DIFFICULTY.gemsMax);
  let placed = 0;
  let guard = 0;
  while (placed < ng && guard++ < 5000) {
    const gx = irnd(1, COLS - 2);
    const gy = irnd(1, ROWS - 2);
    if (Math.abs(gx - sx) < 4 && Math.abs(gy - sy) < 3) continue;
    if (phys.get(gx, gy) !== E) continue;
    phys.set(gx, gy, T.GEM);
    placed++;
  }
  // Kurt
  STATE.startIndex = phys.index(sx, sy);
  placeDigger(STATE.startIndex);
  phys.settle(40);
  // Felsen, die beim Setzen auf Glühwürmchen gefallen sind, haben sie nicht erwischt (stille Schritte) – ok.
  phys.consumeChanged(null);
  STATE.gemsTotal = phys.count(T.GEM);
  STATE.need = Math.min(levelValue(DIFFICULTY.needStart, DIFFICULTY.needPerLevel, DIFFICULTY.needMax), Math.max(1, Math.floor(STATE.gemsTotal * 0.7)));
  STATE.gems = 0;
  STATE.exitOpen = false;
  STATE.levelTime = levelValue(DIFFICULTY.timeStart, DIFFICULTY.timePerLevel, DIFFICULTY.timeMin);
  STATE.acc = 0;
  STATE.tickPhase = 0;
  STATE.tickCount = 0;
  STATE.amoebaCount = phys.count(T.AMOEBA);
  STATE.juliaC = [-0.8 + rnd(-0.06, 0.06), 0.156 + rnd(-0.05, 0.05)];
  STATE.cursor = STATE.startIndex + 1;
  amoebaHits.fill(0);
  digQueue.length = 0;
  digLayer.fill(0);
  digLayer.setSpeedUp(digSpeed());
  digger.invul = 1;
  terrainFull = true;
  STATE.worldReady = true;
}

function placeDigger(i) {
  phys.setAt(i, T.DIGGER);
  digger.i = i;
  digger.trail = [i, i, i, i];
  digger.state = 'walk';
  digger.ticksSinceMove = 99;
  digger.stateT = 0;
  digger.blind = 0;
  digger.blindTime = 0;
  digger.idle = 0;
  digger.hintTarget = -1;
}

// ---------------------------------------------------------------------------------------------------------
// Physik-Ereignisse
// ---------------------------------------------------------------------------------------------------------

function handleLand(x, y, type, i) {
  if (STATE.scene !== 'game') return;
  const px = x * CS + CS / 2;
  const py = OY + y * CS + CS;
  if (type === T.ROCK) {
    STATS.rocksFallen++;
    STATE.shake = Math.max(STATE.shake, 3);
    addParticles(px, py, 5, PAL.dust, 90, 300);
    if (STATE.rockSoundT <= 0) {
      playSound(soundRock, 0.25);
      STATE.rockSoundT = SETTINGS.rockSoundGap;
    }
  } else if (type === T.GEM) {
    addParticles(px, py - CS / 2, 4, PAL.gemSpark, 80, 0);
  }
}

function handleCrush(x, y, victim, by, vi) {
  if (victim === T.DIGGER) {
    if (vi !== digger.i || digger.state !== 'walk') return;
    if (by === T.GEM) {
      // Fallender Diamant: Kurt fängt ihn
      const gi = vi - COLS;
      phys.setAt(gi, T.EMPTY);
      STATS.caught++;
      collectGem(vi, 'Gefangen!');
      return;
    }
    if (digger.invul > 0) return;
    squashDigger('crush');
    return;
  }
  if (victim === T.FLY) {
    STATS.flies++;
    STATE.score += SETTINGS.pointsFly;
    addFloater(cellX(vi), cellY(vi) - 30, '+' + SETTINGS.pointsFly + ' Glühwurm-Bumm!', PAL.fly);
    explodeAt(x, y, T.GEM);
  }
}

function explodeAt(x, y, fillType) {
  let killed = false;
  phys.explode(x, y, 1, fillType, (i, old) => {
    if (old === T.DIGGER && i === digger.i && digger.state === 'walk') killed = true;
  });
  flies = flies.filter((f) => phys.cells[f.i] === T.FLY);
  const px = x * CS + CS / 2;
  const py = OY + y * CS + CS / 2;
  addParticles(px, py, 40, PAL.fly, 380, 200);
  addParticles(px, py, 20, PAL.gem, 260, 0);
  addRing(px, py, PAL.fly, 200);
  addRing(px, py, PAL.gem, 130);
  STATE.shake = Math.max(STATE.shake, 18);
  STATE.flash = Math.max(STATE.flash, 0.35);
  playSound(soundBoom, 0.6);
  terrainFull = true;
  if (killed) squashDigger('boom');
}

function squashDigger(cause) {
  if (digger.state !== 'walk') return;
  digger.state = 'squashed';
  digger.stateT = 0;
  digger.cause = cause;
  STATE.lives--;
  STATS.squashed++;
  STATE.shake = Math.max(STATE.shake, 22);
  STATE.flash = Math.max(STATE.flash, 0.4);
  const px = cellX(digger.i);
  const py = cellY(digger.i);
  addParticles(px, py, 30, PAL.worm, 260, 400);
  addFloater(px, py - 50, cause === 'boom' ? 'BUMM!' : SQUASH_QUIPS[Math.floor(Math.random() * SQUASH_QUIPS.length)], PAL.warn, 56);
  playSound(soundStomp, 0.7);
  playSound(soundHurt, 0.6);
}

function collectGem(atIndex, text) {
  STATS.gems++;
  STATE.gems++;
  const extra = STATE.gems > STATE.need;
  const pts = extra ? SETTINGS.pointsExtraGem : SETTINGS.pointsGem + SETTINGS.pointsGemPerLevel * (STATE.level - 1);
  STATE.score += pts;
  const px = cellX(atIndex);
  const py = cellY(atIndex);
  addParticles(px, py, 18, PAL.gem, 220, 0);
  addRing(px, py, PAL.gem, 90);
  addFloater(px, py - 40, (text ? text + ' ' : '') + '+' + pts, PAL.gem);
  playSound(soundGem, 0.6);
  if (!STATE.exitOpen && STATE.gems >= STATE.need) openExit();
}

function openExit() {
  STATE.exitOpen = true;
  STATE.flash = Math.max(STATE.flash, 0.5);
  const px = cellX(STATE.exitIndex);
  const py = cellY(STATE.exitIndex);
  addRing(px, py, PAL.exitOpen, 300);
  addParticles(px, py, 40, PAL.exitOpen, 300, 0);
  addFloater(W / 2, OY + 120, 'AUSGANG OFFEN!', PAL.exitOpen, 70);
  say('Nix wie raus!', 2);
  playSound(soundExit, 0.8);
  terrainFull = true;
}

// ---------------------------------------------------------------------------------------------------------
// Graben (Eingabe über gui/paintLayer)
// ---------------------------------------------------------------------------------------------------------

function digCell(i, byKey) {
  const t = phys.cells[i];
  const px = cellX(i);
  const py = cellY(i);
  if (t === T.EARTH) {
    phys.setAt(i, T.EMPTY);
    STATS.dug++;
    STATE.score += SETTINGS.pointsDig;
    addParticles(px, py, 6, PAL.earthEdge, 140, 500);
    if (STATE.digSoundT <= 0) {
      playSound(soundDig, 0.25);
      STATE.digSoundT = SETTINGS.digSoundGap;
    }
  } else if (t === T.AMOEBA) {
    amoebaHits[i]++;
    addParticles(px, py, 8, PAL.amoeba, 160, 0);
    if (amoebaHits[i] >= SETTINGS.amoebaBurnHits || byKey) {
      amoebaHits[i] = 0;
      const gem = Math.random() < SETTINGS.amoebaGemChance;
      phys.setAt(i, gem ? T.GEM : T.EMPTY);
      STATS.amoebaBurned++;
      STATE.score += SETTINGS.pointsAmoeba;
      if (gem) addFloater(px, py - 30, 'Schleimdiamant!', PAL.gem, 36);
      if (STATE.digSoundT <= 0) {
        playSound(soundPlop, 0.35);
        STATE.digSoundT = SETTINGS.digSoundGap;
      }
    }
  }
}

function processDigQueue() {
  if (digQueue.length === 0) return;
  const q = digQueue;
  digQueue = [];
  for (let k = 0; k < q.length; k++) {
    const i = q[k];
    digCell(i, false);
    digLayer.setValueAt(cellX(i), cellY(i), 0);
  }
}

// ---------------------------------------------------------------------------------------------------------
// Kurt (Pfadsuche) und Glühwürmchen
// ---------------------------------------------------------------------------------------------------------

function nearFly(i) {
  const x = i % COLS;
  const y = (i / COLS) | 0;
  for (let d = 0; d < 4; d++) {
    const nx = x + DIRX[d];
    const ny = y + DIRY[d];
    if (nx >= 0 && ny >= 0 && nx < COLS && ny < ROWS && phys.cells[nx + ny * COLS] === T.FLY) return true;
  }
  return false;
}

/**
 * Breitensuche ab Kurt über freie Zellen. Ziel: offener Ausgang (bevorzugt), sonst nächster Diamant.
 * passEarth = true: Erde zählt als begehbar (für die Tastatur-Hilfe "Tunnel graben").
 * Liefert den Zielindex; den Weg über bfsPrev.
 */
function bfs(from, passEarth) {
  bfsStamp++;
  let head = 0;
  let tail = 0;
  bfsQueue[tail++] = from;
  bfsSeen[from] = bfsStamp;
  bfsPrev[from] = -1;
  let gem = -1;
  let exit = -1;
  const cells = phys.cells;
  while (head < tail) {
    const i = bfsQueue[head++];
    const t = cells[i];
    if (i !== from) {
      if (t === T.GEM && gem < 0) gem = i;
      if (t === T.EXIT && exit < 0) exit = i;
      if (t !== T.EMPTY && !(passEarth && t === T.EARTH)) continue; // Ziele/Erde nicht durchqueren
    }
    const x = i % COLS;
    const y = (i / COLS) | 0;
    for (let d = 0; d < 4; d++) {
      const nx = x + DIRX[d];
      const ny = y + DIRY[d];
      if (nx < 0 || ny < 0 || nx >= COLS || ny >= ROWS) continue;
      const j = nx + ny * COLS;
      if (bfsSeen[j] === bfsStamp) continue;
      const tj = cells[j];
      const ok = tj === T.EMPTY || tj === T.GEM || (tj === T.EXIT && STATE.exitOpen) || (passEarth && tj === T.EARTH);
      if (!ok) continue;
      if (!passEarth && nearFly(j)) continue; // Kurt hat Angst vor Glühwürmchen
      bfsSeen[j] = bfsStamp;
      bfsPrev[j] = i;
      bfsQueue[tail++] = j;
    }
  }
  if (exit >= 0) return exit;
  return gem;
}

function firstStep(from, target) {
  let s = target;
  while (s >= 0 && bfsPrev[s] !== from) s = bfsPrev[s];
  return s;
}

function nearestGemEuclid(from) {
  const fx = from % COLS;
  const fy = (from / COLS) | 0;
  let best = -1;
  let bestD = 1e9;
  const cells = phys.cells;
  for (let i = 0; i < cells.length; i++) {
    const t = cells[i];
    if (t !== T.GEM && !(t === T.EXIT && STATE.exitOpen)) continue;
    const dx = (i % COLS) - fx;
    const dy = ((i / COLS) | 0) - fy;
    const d = dx * dx + dy * dy - (t === T.EXIT ? 1e6 : 0);
    if (d < bestD) {
      bestD = d;
      best = i;
    }
  }
  return best;
}

function diggerStep() {
  if (digger.state !== 'walk') return;
  digger.ticksSinceMove++;
  if (digger.ticksSinceMove < diggerTicks()) return;
  if (digger.blindTime >= SETTINGS.blindHold) return; // geblendet – steht still
  const target = bfs(digger.i, false);
  if (target < 0) {
    digger.idle += 1;
    digger.hintTarget = nearestGemEuclid(digger.i);
    if (digger.sayTime <= 0 && digger.idle > 10) say(IDLE_QUIPS[Math.floor(Math.random() * IDLE_QUIPS.length)], 2.2);
    return;
  }
  digger.hintTarget = -1;
  const next = firstStep(digger.i, target);
  if (next < 0) return;
  // fällt gerade etwas in die Zielzelle? Dann kurz warten.
  const above = next - COLS;
  if (above >= 0 && phys.isFalling(above) && phys.hasFlag(phys.cells[above], 'falls')) {
    if (digger.sayTime <= 0) say('Uiuiui!', 1);
    return;
  }
  digger.idle = 0;
  const t = phys.cells[next];
  const nx = next % COLS;
  const cx = digger.i % COLS;
  if (nx !== cx) digger.dir = nx > cx ? 0 : 2;
  if (t === T.GEM) {
    phys.setAt(next, T.EMPTY);
    collectGem(next, '');
  }
  if (t === T.EXIT && STATE.exitOpen) {
    finishLevel();
    return;
  }
  phys.move(digger.i, next);
  digger.trail = [next, digger.trail[0], digger.trail[1], digger.trail[2]];
  digger.i = next;
  digger.ticksSinceMove = 0;
  if (digger.sayTime <= 0 && Math.random() < 0.01) say(QUIPS[Math.floor(Math.random() * QUIPS.length)], 1.8);
}

function fliesStep() {
  if (STATE.tickCount % DIFFICULTY.flyTicks !== 0) return;
  const list = flies.slice();
  for (let k = 0; k < list.length; k++) {
    const f = list[k];
    if (phys.cells[f.i] !== T.FLY) continue;
    // Kontakt mit Kurt → Explosion
    if (digger.state === 'walk' && digger.invul <= 0) {
      const x = f.i % COLS;
      const y = (f.i / COLS) | 0;
      let touch = false;
      for (let d = 0; d < 4; d++) {
        if (phys.get(x + DIRX[d], y + DIRY[d]) === T.DIGGER) touch = true;
      }
      if (touch) {
        explodeAt(x, y, T.EMPTY);
        continue;
      }
    }
    // Wandfolger: links abbiegen, sonst geradeaus, sonst rechts drehen
    const x = f.i % COLS;
    const y = (f.i / COLS) | 0;
    const left = (f.dir + 3) % 4;
    f.prev = f.i;
    if (phys.get(x + DIRX[left], y + DIRY[left]) === T.EMPTY) {
      f.dir = left;
    } else if (phys.get(x + DIRX[f.dir], y + DIRY[f.dir]) !== T.EMPTY) {
      f.dir = (f.dir + 1) % 4;
      continue;
    }
    const j = phys.index(x + DIRX[f.dir], y + DIRY[f.dir]);
    phys.move(f.i, j);
    f.i = j;
  }
  flies = flies.filter((f) => phys.cells[f.i] === T.FLY);
}

function amoebaCheck(res) {
  STATE.amoebaCount = res.growCells;
  if (res.growCells <= 0) return;
  if (res.growCells >= DIFFICULTY.amoebaMax) {
    phys.replaceAll(T.AMOEBA, T.ROCK);
    STATE.shake = Math.max(STATE.shake, 25);
    STATE.flash = 0.5;
    addFloater(W / 2, OY + 200, 'Der Schleim versteinert! LAWINE!', PAL.warn, 64);
    playSound(soundBoom, 0.8);
    STATE.amoebaCount = 0;
  } else if (!res.canGrow) {
    phys.replaceAll(T.AMOEBA, T.GEM);
    STATE.flash = 0.5;
    addFloater(W / 2, OY + 200, 'Schleim eingeschlossen – lauter Diamanten!', PAL.gem, 60);
    playSound(soundExit, 0.7);
    STATE.amoebaCount = 0;
  }
}

function physicsTick() {
  STATE.tickCount++;
  fliesStep();
  diggerStep();
  if (STATE.scene !== 'game') return;
  const res = phys.step();
  amoebaCheck(res);
}

// ---------------------------------------------------------------------------------------------------------
// Ablauf
// ---------------------------------------------------------------------------------------------------------

function resetRun() {
  STATE.level = 1;
  STATE.lives = SETTINGS.startLives;
  STATE.score = 0;
  STATE.shake = 0;
  STATE.flash = 0;
  STATE.collapse = 0;
  STATE.newHighscore = false;
  Object.keys(STATS).forEach((k) => (STATS[k] = 0));
  particles = [];
  floaters = [];
  rings = [];
  digger.say = '';
  digger.sayTime = 0;
  STATE.worldReady = false;
  ensureWorld();
  againButton = null;
}

function resetAll() {
  stopMusic();
  STATE.time = 0;
  resetRun();
  startButton = null;
  keyEdge = createKeyEdge();
  setScene('title');
}

function startGame() {
  resetRun();
  setScene('game');
  say('Ich bin Kurt! Grabt mir Wege!', 2.5);
  playSound(soundJingle, 0.7);
  stopMusic();
  music = playSound(soundMusic, 0.3);
  if (music) music.loop = true;
}

function finishLevel() {
  const bonus = Math.max(0, Math.round(STATE.levelTime)) * SETTINGS.pointsTimeBonus;
  STATE.score += bonus;
  STATS.levelsDone++;
  STATE.lastBonus = bonus;
  STATE.flash = 0.8;
  const px = cellX(STATE.exitIndex);
  const py = cellY(STATE.exitIndex);
  addParticles(px, py, 80, PAL.exitOpen, 420, 0);
  addRing(px, py, PAL.exitOpen, 400);
  if (phys.cells[digger.i] === T.DIGGER) phys.setAt(digger.i, T.EMPTY);
  digger.state = 'gone';
  playSound(soundLevelUp, 0.8);
  setScene('levelup');
}

function nextLevel() {
  STATE.level++;
  STATE.worldReady = false;
  ensureWorld();
  setScene('game');
  say(LEVEL_NEWS[STATE.level] ? 'Neues Level!' : 'Weiter geht’s!', 1.8);
}

function endGame(reason) {
  STATE.endReason = reason;
  stopMusic();
  playSound(soundGameOver, 0.8);
  highscore.addEntry({
    punkte: Math.round(STATE.score),
    level: STATE.level,
    diamanten: STATS.gems,
    gegraben: STATS.dug,
    platt: STATS.squashed,
  });
  STATE.newHighscore = highscore.lastEntryNewHighscore();
  againButton = null;
  setScene('gameover');
}

function respawnDigger() {
  if (phys.cells[digger.i] === T.DIGGER) phys.setAt(digger.i, T.EMPTY);
  if (STATE.lives <= 0) {
    endGame(digger.cause === 'boom' ? 'Kurt ist explodiert. Das letzte Mal.' : 'Kurt ist platt. Endgültig.');
    return;
  }
  // sicherste Zelle nahe Start: leer oder Erde, darüber nichts, was fällt
  const start = STATE.startIndex;
  bfsStamp++;
  let head = 0;
  let tail = 0;
  bfsQueue[tail++] = start;
  bfsSeen[start] = bfsStamp;
  let spot = -1;
  while (head < tail) {
    const i = bfsQueue[head++];
    const t = phys.cells[i];
    const above = i - COLS;
    const aboveT = above >= 0 ? phys.cells[above] : T.STEEL;
    if ((t === T.EMPTY || t === T.EARTH) && !phys.hasFlag(aboveT, 'falls') && !nearFly(i)) {
      spot = i;
      break;
    }
    const x = i % COLS;
    const y = (i / COLS) | 0;
    for (let d = 0; d < 4; d++) {
      const nx = x + DIRX[d];
      const ny = y + DIRY[d];
      if (nx < 1 || ny < 1 || nx >= COLS - 1 || ny >= ROWS - 1) continue;
      const j = nx + ny * COLS;
      if (bfsSeen[j] === bfsStamp) continue;
      bfsSeen[j] = bfsStamp;
      bfsQueue[tail++] = j;
    }
  }
  if (spot < 0) spot = start;
  placeDigger(spot);
  digger.invul = SETTINGS.invulTime;
  say('Ich lebe noch!', 1.8);
  addRing(cellX(spot), cellY(spot), PAL.worm, 120);
}

function updateDigger(dt) {
  digger.sayTime = Math.max(0, digger.sayTime - dt);
  digger.invul = Math.max(0, digger.invul - dt);
  digger.stateT += dt;
  if (digger.state === 'squashed') {
    if (digger.stateT >= SETTINGS.squashTime) respawnDigger();
    return;
  }
  if (digger.state !== 'walk') return;
  // Blenden: Laser direkt auf Kurt (über die Grabeschicht abgefragt, kein grid-Zugriff)
  const lit = digLayer.getLitInCircle(cellX(digger.i), cellY(digger.i), SETTINGS.blindRadius);
  const blinded = lit >= SETTINGS.blindThreshold || isKeyDown('Digit0');
  digger.blind = blinded ? Math.min(1, digger.blind + dt * 4) : Math.max(0, digger.blind - dt * 2);
  if (blinded) {
    digger.blindTime += dt;
    STATS.blindSeconds += dt;
    if (digger.blindTime > SETTINGS.blindHold && digger.sayTime <= 0) say('Ich seh nix!', 1.2);
  } else {
    digger.blindTime = Math.max(0, digger.blindTime - dt * 2);
  }
}

function handleKeys() {
  // Grabe-Cursor
  const cx = STATE.cursor % COLS;
  const cy = (STATE.cursor / COLS) | 0;
  let nx = cx;
  let ny = cy;
  if (keyEdge('ArrowLeft')) nx--;
  if (keyEdge('ArrowRight')) nx++;
  if (keyEdge('ArrowUp')) ny--;
  if (keyEdge('ArrowDown')) ny++;
  nx = Math.max(1, Math.min(COLS - 2, nx));
  ny = Math.max(1, Math.min(ROWS - 2, ny));
  if (nx !== cx || ny !== cy) {
    STATE.cursor = nx + ny * COLS;
    STATE.cursorShow = 4;
    digCell(STATE.cursor, true);
  }
  if (keyEdge('Enter')) {
    STATE.cursorShow = 4;
    digCell(STATE.cursor, true);
  }
  if (keyEdge('Digit1') && digger.state === 'walk') {
    const target = bfs(digger.i, true);
    if (target >= 0) {
      // Weg zurückverfolgen, die ersten (bis zu 6) Erdzellen graben
      const path = [];
      let s = target;
      while (s >= 0 && s !== digger.i) {
        path.push(s);
        s = bfsPrev[s];
      }
      let dug = 0;
      for (let k = path.length - 1; k >= 0 && dug < 6; k--) {
        if (phys.cells[path[k]] === T.EARTH) {
          digCell(path[k], true);
          dug++;
        }
      }
    }
  }
  if (keyEdge('Digit8') && digger.state === 'walk') {
    const x = digger.i % COLS;
    const y = (digger.i / COLS) | 0;
    if (y >= 3) {
      const a1 = phys.index(x, y - 1);
      const a2 = phys.index(x, y - 2);
      if (phys.cells[a1] !== T.STEEL && phys.cells[a2] !== T.STEEL) {
        phys.setAt(a1, T.EMPTY);
        phys.setAt(a2, T.ROCK);
        phys.setFalling(a2, true);
        digger.invul = 0;
      }
    }
  }
  if (keyEdge('Digit9')) {
    STATE.gems = Math.max(STATE.gems, STATE.need);
    finishLevel();
  }
}

// ---------------------------------------------------------------------------------------------------------
// Vorrendern
// ---------------------------------------------------------------------------------------------------------

function makeCanvas(w, h) {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  return c;
}

function ensureSprites() {
  if (!rockSprites) {
    rockSprites = [];
    for (let v = 0; v < 4; v++) {
      const c = makeCanvas(56, 56);
      const g = c.getContext('2d');
      g.translate(28, 28);
      g.beginPath();
      const pts = 9;
      for (let k = 0; k < pts; k++) {
        const a = (k / pts) * Math.PI * 2 + v;
        const r = 15 + hash(v * 31 + k, 3) * 5;
        if (k === 0) g.moveTo(Math.cos(a) * r, Math.sin(a) * r);
        else g.lineTo(Math.cos(a) * r, Math.sin(a) * r);
      }
      g.closePath();
      g.fillStyle = '#000000';
      g.fill();
      g.strokeStyle = PAL.rock;
      g.lineWidth = 3;
      g.lineJoin = 'round';
      g.stroke();
      g.strokeStyle = PAL.rockCrack;
      g.lineWidth = 2;
      g.beginPath();
      g.moveTo(-6 + v * 2, -8);
      g.lineTo(0, -1);
      g.lineTo(-3 + v, 7);
      g.stroke();
      rockSprites.push(c);
    }
  }
  if (!gemSprite) {
    const c = makeCanvas(64, 64);
    const g = c.getContext('2d');
    g.translate(32, 32);
    g.shadowColor = PAL.gem;
    g.shadowBlur = 10;
    g.strokeStyle = PAL.gem;
    g.lineWidth = 3;
    g.lineJoin = 'round';
    g.fillStyle = '#000000';
    g.beginPath();
    g.moveTo(0, -17);
    g.lineTo(15, -4);
    g.lineTo(0, 17);
    g.lineTo(-15, -4);
    g.closePath();
    g.fill();
    g.stroke();
    g.shadowBlur = 0;
    g.strokeStyle = PAL.gemFacet;
    g.lineWidth = 1.5;
    g.beginPath();
    g.moveTo(-15, -4);
    g.lineTo(15, -4);
    g.moveTo(-6, -4);
    g.lineTo(0, 17);
    g.lineTo(6, -4);
    g.moveTo(-6, -4);
    g.lineTo(0, -17);
    g.lineTo(6, -4);
    g.stroke();
    gemSprite = c;
  }
}

/** Julia-Fraktal als Schleimtextur: EINE Kachel (128²), einmal pro Level gerechnet, gekachelt gezeichnet */
const JULIA_TILE = 160; // Bildschirmgröße einer Kachel in px
function ensureJulia() {
  const key = STATE.juliaC[0].toFixed(3) + ',' + STATE.juliaC[1].toFixed(3) + palKey;
  if (juliaCanvas && juliaKey === key) return;
  juliaKey = key;
  const w = 128;
  if (!juliaCanvas) juliaCanvas = makeCanvas(w, w);
  const g = juliaCanvas.getContext('2d');
  const img = g.createImageData(w, w);
  const d = img.data;
  const c1 = hexToRgb(col(0.6, 0.55, 0.9)); // Inneres
  const c2 = hexToRgb(col(0.7, 0.8, 0.3)); // Aussen
  const c3 = hexToRgb(col(0.55, 0.6, 0.75)); // Rand der Menge
  const cr = STATE.juliaC[0];
  const ci = STATE.juliaC[1];
  const maxIt = 36;
  for (let py = 0; py < w; py++) {
    for (let px = 0; px < w; px++) {
      let zr = (px / w - 0.5) * 3.2;
      let zi = (py / w - 0.5) * 3.2;
      let it = 0;
      while (it < maxIt && zr * zr + zi * zi < 4) {
        const t = zr * zr - zi * zi + cr;
        zi = 2 * zr * zi + ci;
        zr = t;
        it++;
      }
      const p = (px + py * w) * 4;
      let c = c2;
      let a = 70;
      if (it >= maxIt) {
        c = c1;
        a = 170;
      } else if (it > 8) {
        c = c3;
        a = 120 + it * 3;
      } else {
        a = 50 + it * 8;
      }
      d[p] = c[0];
      d[p + 1] = c[1];
      d[p + 2] = c[2];
      d[p + 3] = Math.min(255, a);
    }
  }
  g.putImageData(img, 0, 0);
}

/** Erdkanten nur zu Gängen (leer, Kurt, Glühwürmchen) – Felsen/Diamanten in der Erde bleiben ohne Kasten */
function isSolidTerrain(t) {
  return !(t === T.EMPTY || t === T.DIGGER || t === T.FLY);
}

function drawTerrainCell(i) {
  const g = terrainCtx;
  const x = (i % COLS) * CS;
  const y = Math.floor(i / COLS) * CS;
  g.fillStyle = '#000000';
  g.fillRect(x, y, CS, CS);
  const t = phys.cells[i];
  if (t === T.EARTH) {
    for (let k = 0; k < 5; k++) {
      g.fillStyle = k < 3 ? PAL.earthDot : PAL.earthDot2;
      const r = 1.5 + hash(i, k + 20) * 2;
      g.fillRect(x + 4 + hash(i, k) * (CS - 8), y + 4 + hash(i, k + 10) * (CS - 8), r, r);
    }
    // Kanten zu Gängen
    g.strokeStyle = PAL.earthEdge;
    g.lineWidth = 3;
    g.beginPath();
    const cx = i % COLS;
    const cy = Math.floor(i / COLS);
    if (cy > 0 && !isSolidTerrain(phys.cells[i - COLS])) {
      g.moveTo(x, y + 1.5);
      g.lineTo(x + CS, y + 1.5);
    }
    if (cy < ROWS - 1 && !isSolidTerrain(phys.cells[i + COLS])) {
      g.moveTo(x, y + CS - 1.5);
      g.lineTo(x + CS, y + CS - 1.5);
    }
    if (cx > 0 && !isSolidTerrain(phys.cells[i - 1])) {
      g.moveTo(x + 1.5, y);
      g.lineTo(x + 1.5, y + CS);
    }
    if (cx < COLS - 1 && !isSolidTerrain(phys.cells[i + 1])) {
      g.moveTo(x + CS - 1.5, y);
      g.lineTo(x + CS - 1.5, y + CS);
    }
    g.stroke();
  } else if (t === T.STEEL) {
    g.strokeStyle = PAL.steel;
    g.lineWidth = 2;
    g.strokeRect(x + 4, y + 4, CS - 8, CS - 8);
    g.fillStyle = PAL.steelRivet;
    g.fillRect(x + 7, y + 7, 3, 3);
    g.fillRect(x + CS - 10, y + 7, 3, 3);
    g.fillRect(x + 7, y + CS - 10, 3, 3);
    g.fillRect(x + CS - 10, y + CS - 10, 3, 3);
  } else if (t === T.BRICK) {
    g.strokeStyle = PAL.brick;
    g.lineWidth = 2;
    g.strokeRect(x + 2, y + 2, CS - 4, CS - 4);
    g.beginPath();
    g.moveTo(x + 2, y + CS / 2);
    g.lineTo(x + CS - 2, y + CS / 2);
    g.moveTo(x + CS / 2, y + 2);
    g.lineTo(x + CS / 2, y + CS / 2);
    g.moveTo(x + CS / 4, y + CS / 2);
    g.lineTo(x + CS / 4, y + CS - 2);
    g.moveTo(x + (CS * 3) / 4, y + CS / 2);
    g.lineTo(x + (CS * 3) / 4, y + CS - 2);
    g.stroke();
  }
}

function updateTerrain() {
  if (!terrainCanvas) {
    terrainCanvas = makeCanvas(COLS * CS, FIELD_H);
    terrainCtx = terrainCanvas.getContext('2d');
    terrainFull = true;
  }
  if (terrainFull) {
    phys.consumeChanged(null);
    for (let i = 0; i < COLS * ROWS; i++) drawTerrainCell(i);
    terrainFull = false;
    return;
  }
  // inkrementell: geänderte Zellen + Nachbarn (Kanten hängen von den Nachbarn ab)
  phys.consumeChanged((i) => {
    drawTerrainCell(i);
    const x = i % COLS;
    if (i >= COLS) drawTerrainCell(i - COLS);
    if (i + COLS < COLS * ROWS) drawTerrainCell(i + COLS);
    if (x > 0) drawTerrainCell(i - 1);
    if (x < COLS - 1) drawTerrainCell(i + 1);
  });
}

// ---------------------------------------------------------------------------------------------------------
// Zeichnen
// ---------------------------------------------------------------------------------------------------------

function lerpPos(from, to, p) {
  const x0 = cellX(from);
  const y0 = cellY(from);
  return [x0 + (cellX(to) - x0) * p, y0 + (cellY(to) - y0) * p];
}

function renderField(ctx, dim) {
  ensureSprites();
  updateTerrain();
  ctx.save();
  if (dim) ctx.globalAlpha = dim;
  ctx.drawImage(terrainCanvas, 0, OY);

  const cells = phys.cells;
  const p = STATE.tickPhase;
  const time = STATE.time;

  // Grabfortschritt: Risse in der angeleuchteten Erde
  if (digLayer && !dim) {
    ctx.strokeStyle = PAL.dig;
    ctx.lineWidth = 3;
    for (let i = 0; i < cells.length; i++) {
      const t = cells[i];
      if (t !== T.EARTH && t !== T.AMOEBA) continue;
      const v = digLayer.getValueAt(cellX(i), cellY(i));
      if (v < 0.08) continue;
      const x = (i % COLS) * CS;
      const y = OY + Math.floor(i / COLS) * CS;
      ctx.globalAlpha = 0.25 + v * 0.6;
      const ins = 4 + (1 - v) * 10;
      ctx.strokeRect(x + ins, y + ins, CS - ins * 2, CS - ins * 2);
      if (v > 0.45) {
        ctx.beginPath();
        ctx.moveTo(x + 8, y + 10);
        ctx.lineTo(x + CS / 2, y + CS / 2);
        ctx.lineTo(x + CS - 9, y + CS - 8);
        ctx.moveTo(x + CS / 2, y + CS / 2);
        ctx.lineTo(x + CS - 10, y + 9);
        ctx.stroke();
      }
    }
    ctx.globalAlpha = 1;
  }

  // Schleim: Julia-Kacheln durch die Schleimzellen, dazu eine wabernde Kontur an den Rändern
  if (STATE.amoebaCount > 0) {
    ensureJulia();
    ctx.save();
    ctx.beginPath();
    let minX = 1e9;
    let minY = 1e9;
    let maxX = -1e9;
    let maxY = -1e9;
    for (let i = 0; i < cells.length; i++) {
      if (cells[i] !== T.AMOEBA) continue;
      const x = (i % COLS) * CS;
      const y = OY + Math.floor(i / COLS) * CS;
      ctx.rect(x, y, CS, CS);
      if (x < minX) minX = x;
      if (y < minY) minY = y;
      if (x + CS > maxX) maxX = x + CS;
      if (y + CS > maxY) maxY = y + CS;
    }
    if (maxX > minX) {
      ctx.clip();
      ctx.globalAlpha = (dim || 1) * (0.7 + 0.2 * Math.sin(time * 2));
      const ox = (time * 12) % JULIA_TILE;
      const oy = Math.sin(time * 0.5) * 20;
      const x0 = Math.floor((minX - ox) / JULIA_TILE) * JULIA_TILE + ox;
      const y0 = Math.floor((minY - oy) / JULIA_TILE) * JULIA_TILE + oy;
      for (let ty = y0; ty < maxY; ty += JULIA_TILE) {
        for (let tx = x0; tx < maxX; tx += JULIA_TILE) ctx.drawImage(juliaCanvas, tx, ty, JULIA_TILE, JULIA_TILE);
      }
    }
    ctx.restore();
    // Kontur: kleine Bögen an jeder Kante zu Nicht-Schleim
    ctx.save();
    ctx.globalAlpha = dim || 1;
    ctx.strokeStyle = PAL.amoeba;
    ctx.lineWidth = 3;
    ctx.beginPath();
    for (let i = 0; i < cells.length; i++) {
      if (cells[i] !== T.AMOEBA) continue;
      const cx = i % COLS;
      const x = cx * CS;
      const y = OY + Math.floor(i / COLS) * CS;
      const b = 5 + Math.sin(time * 4 + i * 1.7) * 3;
      if (cells[i - COLS] !== T.AMOEBA) {
        ctx.moveTo(x, y);
        ctx.quadraticCurveTo(x + CS / 2, y - b, x + CS, y);
      }
      if (cells[i + COLS] !== T.AMOEBA) {
        ctx.moveTo(x, y + CS);
        ctx.quadraticCurveTo(x + CS / 2, y + CS + b, x + CS, y + CS);
      }
      if (cells[i - 1] !== T.AMOEBA) {
        ctx.moveTo(x, y);
        ctx.quadraticCurveTo(x - b, y + CS / 2, x, y + CS);
      }
      if (cells[i + 1] !== T.AMOEBA) {
        ctx.moveTo(x + CS, y);
        ctx.quadraticCurveTo(x + CS + b, y + CS / 2, x + CS, y + CS);
      }
    }
    ctx.stroke();
    ctx.restore();
  }

  // Felsen, Diamanten, Ausgang
  for (let i = 0; i < cells.length; i++) {
    const t = cells[i];
    if (t !== T.ROCK && t !== T.GEM) continue;
    const from = phys.getCameFrom(i);
    let x = cellX(i);
    let y = cellY(i);
    if (from >= 0) {
      const q = lerpPos(from, i, p);
      x = q[0];
      y = q[1];
    }
    if (t === T.ROCK) {
      const spr = rockSprites[(i + (i / COLS) | 0) & 3];
      ctx.drawImage(spr, x - 28, y - 28);
    } else {
      const bob = Math.sin(time * 2 + i) * 1.5;
      ctx.drawImage(gemSprite, x - 32, y - 32 + bob);
      const sp = Math.sin(time * 2.7 + hash(i, 1) * 40);
      if (sp > 0.85) {
        const s = (sp - 0.85) * 120;
        ctx.strokeStyle = PAL.gemSpark;
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(x + 8 - s, y - 10);
        ctx.lineTo(x + 8 + s, y - 10);
        ctx.moveTo(x + 8, y - 10 - s);
        ctx.lineTo(x + 8, y - 10 + s);
        ctx.stroke();
      }
    }
  }
  renderExit(ctx);
  renderFlies(ctx, p);
  ctx.restore();
}

function renderExit(ctx) {
  const i = STATE.exitIndex;
  if (i < 0) return;
  const x = cellX(i);
  const y = cellY(i);
  ctx.save();
  if (!STATE.exitOpen) {
    ctx.strokeStyle = PAL.exitClosed;
    ctx.lineWidth = 3;
    ctx.strokeRect(x - 16, y - 18, 32, 36);
    ctx.beginPath();
    ctx.arc(x, y - 2, 5, 0, Math.PI * 2);
    ctx.moveTo(x, y + 3);
    ctx.lineTo(x, y + 10);
    ctx.stroke();
  } else {
    const t = STATE.time;
    ctx.translate(x, y);
    ctx.shadowColor = PAL.exitOpen;
    ctx.shadowBlur = 16;
    for (let k = 0; k < 4; k++) {
      ctx.save();
      ctx.rotate(t * (1.5 + k * 0.6) * (k % 2 ? -1 : 1));
      ctx.strokeStyle = k % 2 ? PAL.exitOpen2 : PAL.exitOpen;
      ctx.lineWidth = 3;
      const r = 8 + k * 7 + Math.sin(t * 5 + k) * 2;
      ctx.strokeRect(-r, -r, r * 2, r * 2);
      ctx.restore();
    }
    ctx.shadowBlur = 0;
    util.renderText({ ctx, text: 'AUSGANG', x: 0, y: -40, fontSize: '28px', fillStyle: PAL.exitOpen });
  }
  ctx.restore();
}

function renderFlies(ctx, p) {
  if (flies.length === 0) return;
  const t = STATE.time;
  ctx.save();
  ctx.shadowColor = PAL.fly;
  ctx.shadowBlur = 14;
  for (let k = 0; k < flies.length; k++) {
    const f = flies[k];
    if (phys.cells[f.i] !== T.FLY) continue;
    const q = f.prev >= 0 && f.prev !== f.i ? lerpPos(f.prev, f.i, Math.min(1, (STATE.tickCount % DIFFICULTY.flyTicks + p) / DIFFICULTY.flyTicks)) : [cellX(f.i), cellY(f.i)];
    ctx.save();
    ctx.translate(q[0], q[1]);
    ctx.rotate(t * 4 + k);
    ctx.strokeStyle = PAL.fly;
    ctx.lineWidth = 3;
    ctx.strokeRect(-12, -12, 24, 24);
    ctx.rotate(-t * 8);
    ctx.strokeStyle = PAL.fly2;
    ctx.strokeRect(-6, -6, 12, 12);
    ctx.restore();
  }
  ctx.restore();
}

function renderDigger(ctx) {
  if (digger.state === 'gone' || digger.i < 0) return;
  const t = STATE.time;
  ctx.save();
  if (digger.state === 'squashed') {
    const x = cellX(digger.i);
    const y = cellY(digger.i) + 12;
    const s = Math.min(1, digger.stateT * 6);
    ctx.fillStyle = '#000000';
    ctx.strokeStyle = PAL.worm;
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.ellipse(x, y, 18 + 10 * s, 12 - 7 * s, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    // Sterne kreisen
    for (let k = 0; k < 4; k++) {
      const a = t * 4 + (k * Math.PI) / 2;
      const sx = x + Math.cos(a) * 26;
      const sy = y - 26 + Math.sin(a) * 8;
      ctx.strokeStyle = PAL.helmet;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(sx - 5, sy);
      ctx.lineTo(sx + 5, sy);
      ctx.moveTo(sx, sy - 5);
      ctx.lineTo(sx, sy + 5);
      ctx.stroke();
    }
    ctx.restore();
    return;
  }
  if (digger.invul > 0 && Math.floor(t * 10) % 2 === 0) ctx.globalAlpha = 0.45;
  const prog = Math.min(1, (digger.ticksSinceMove + STATE.tickPhase) / diggerTicks());
  const tr = digger.trail;
  // Körpersegmente (hinten nach vorn)
  for (let k = 3; k >= 1; k--) {
    const a = tr[k] >= 0 ? tr[k] : tr[0];
    const b = tr[k - 1] >= 0 ? tr[k - 1] : tr[0];
    const q = lerpPos(a, b, prog);
    const r = 13 - k * 2 + Math.sin(t * 8 + k) * 1.2;
    ctx.fillStyle = '#000000';
    ctx.strokeStyle = PAL.wormDark;
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(q[0], q[1] + 4, r, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
  }
  const hp = lerpPos(tr[1] >= 0 ? tr[1] : tr[0], tr[0], prog);
  const hx = hp[0];
  const hy = hp[1] + Math.sin(t * 10) * 1.5;
  const face = digger.dir === 2 ? -1 : 1;
  ctx.fillStyle = '#000000';
  ctx.strokeStyle = PAL.worm;
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.arc(hx, hy, 16, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();
  // Grubenhelm mit Lampe
  ctx.strokeStyle = PAL.helmet;
  ctx.beginPath();
  ctx.arc(hx, hy - 4, 16, Math.PI * 1.05, Math.PI * 1.95);
  ctx.closePath();
  ctx.stroke();
  ctx.fillStyle = PAL.lamp;
  ctx.beginPath();
  ctx.arc(hx + face * 6, hy - 16, 4, 0, Math.PI * 2);
  ctx.fill();
  // Augen
  ctx.strokeStyle = PAL.worm;
  ctx.fillStyle = PAL.worm;
  ctx.lineWidth = 2;
  if (digger.blind > 0.3) {
    for (let e = -1; e <= 1; e += 2) {
      const ex = hx + face * 4 + e * 5;
      ctx.beginPath();
      ctx.moveTo(ex - 3, hy - 3);
      ctx.lineTo(ex + 3, hy + 3);
      ctx.moveTo(ex + 3, hy - 3);
      ctx.lineTo(ex - 3, hy + 3);
      ctx.stroke();
    }
  } else {
    for (let e = -1; e <= 1; e += 2) {
      const ex = hx + face * 4 + e * 5;
      ctx.beginPath();
      ctx.arc(ex, hy, 3.5, 0, Math.PI * 2);
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(ex + face * 1.5, hy + 0.5, 1.5, 0, Math.PI * 2);
      ctx.fill();
    }
  }
  // Mund
  ctx.beginPath();
  ctx.arc(hx + face * 4, hy + 7, 4, 0.1 * Math.PI, 0.9 * Math.PI);
  ctx.stroke();
  ctx.restore();
}

function renderHint(ctx) {
  if (digger.state !== 'walk' || digger.hintTarget < 0 || digger.idle < 6) return;
  const x0 = cellX(digger.i);
  const y0 = cellY(digger.i);
  const x1 = cellX(digger.hintTarget);
  const y1 = cellY(digger.hintTarget);
  const d = Math.hypot(x1 - x0, y1 - y0);
  if (d < 1) return;
  const ux = (x1 - x0) / d;
  const uy = (y1 - y0) / d;
  const len = Math.min(d - 30, 160);
  if (len < 30) return;
  const ax = x0 + ux * (30 + len);
  const ay = y0 + uy * (30 + len);
  ctx.save();
  ctx.strokeStyle = PAL.hint;
  ctx.lineWidth = 3;
  ctx.setLineDash([10, 10]);
  ctx.lineDashOffset = -STATE.time * 30;
  ctx.beginPath();
  ctx.moveTo(x0 + ux * 30, y0 + uy * 30);
  ctx.lineTo(ax, ay);
  ctx.stroke();
  ctx.setLineDash([]);
  ctx.beginPath();
  ctx.moveTo(ax, ay);
  ctx.lineTo(ax - ux * 16 - uy * 10, ay - uy * 16 + ux * 10);
  ctx.moveTo(ax, ay);
  ctx.lineTo(ax - ux * 16 + uy * 10, ay - uy * 16 - ux * 10);
  ctx.stroke();
  ctx.restore();
}

function renderSay(ctx) {
  if (digger.sayTime <= 0 || digger.i < 0 || digger.state === 'gone') return;
  const x = Math.max(200, Math.min(W - 200, cellX(digger.i)));
  const yy = cellY(digger.i);
  const y = yy < OY + 160 ? yy + 70 : yy - 60;
  ctx.save();
  ctx.font = 'bold 34px Verdana';
  const w = ctx.measureText(digger.say).width + 30;
  ctx.fillStyle = '#000000';
  ctx.strokeStyle = PAL.hud;
  ctx.lineWidth = 2;
  ctx.fillRect(x - w / 2, y - 30, w, 46);
  ctx.strokeRect(x - w / 2, y - 30, w, 46);
  ctx.restore();
  util.renderText({ ctx, text: digger.say, x, y: y + 3, fontSize: '34px', fillStyle: PAL.hud });
}

function renderCursor(ctx) {
  if (STATE.cursorShow <= 0) return;
  const x = (STATE.cursor % COLS) * CS;
  const y = OY + Math.floor(STATE.cursor / COLS) * CS;
  ctx.save();
  ctx.globalAlpha = Math.min(1, STATE.cursorShow);
  ctx.strokeStyle = PAL.cursor;
  ctx.lineWidth = 3;
  ctx.setLineDash([6, 6]);
  ctx.strokeRect(x + 2, y + 2, CS - 4, CS - 4);
  ctx.restore();
}

function updateParticles(dt) {
  const list = particles.slice();
  for (let k = 0; k < list.length; k++) {
    const q = list[k];
    q.life -= dt;
    q.vy += q.g * dt;
    q.x += q.vx * dt;
    q.y += q.vy * dt;
  }
  particles = particles.filter((q) => q.life > 0);
  floaters.forEach((f) => {
    f.life -= dt;
    f.y -= 50 * dt;
  });
  floaters = floaters.filter((f) => f.life > 0);
  rings.forEach((r) => {
    r.life -= dt;
    r.r = r.maxR * (1 - r.life / r.max);
  });
  rings = rings.filter((r) => r.life > 0);
}

function renderParticles(ctx) {
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  for (let k = 0; k < particles.length; k++) {
    const q = particles[k];
    ctx.globalAlpha = Math.max(0, q.life / q.max);
    ctx.fillStyle = q.color;
    ctx.fillRect(q.x - q.size / 2, q.y - q.size / 2, q.size, q.size);
  }
  for (let k = 0; k < rings.length; k++) {
    const r = rings[k];
    ctx.globalAlpha = Math.max(0, r.life / r.max);
    ctx.strokeStyle = r.color;
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.arc(r.x, r.y, Math.max(1, r.r), 0, Math.PI * 2);
    ctx.stroke();
  }
  ctx.restore();
  for (let k = 0; k < floaters.length; k++) {
    const f = floaters[k];
    ctx.save();
    ctx.globalAlpha = Math.max(0, Math.min(1, f.life));
    util.renderText({ ctx, text: f.text, x: f.x, y: f.y, fontSize: f.size + 'px', fillStyle: f.color });
    ctx.restore();
  }
}

function renderHud(ctx) {
  ctx.save();
  ctx.fillStyle = '#000000';
  ctx.fillRect(0, 0, W, OY);
  ctx.strokeStyle = PAL.hudDim;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(0, OY - 2);
  ctx.lineTo(W, OY - 2);
  ctx.stroke();
  ctx.restore();
  const y = 66;
  util.renderText({ ctx, text: 'LEVEL ' + STATE.level, x: 30, y, fontSize: '46px', fillStyle: PAL.hud, align: 'left' });
  // Diamanten
  ensureSprites();
  ctx.drawImage(gemSprite, 330, 18);
  const gemText = STATE.gems + ' / ' + STATE.need + (STATE.exitOpen ? '  OFFEN!' : '');
  util.renderText({ ctx, text: gemText, x: 400, y, fontSize: '46px', fillStyle: STATE.exitOpen ? PAL.exitOpen : PAL.gem, align: 'left' });
  // Zeit
  const tl = Math.max(0, Math.ceil(STATE.levelTime));
  const low = tl <= 20;
  util.renderText({
    ctx,
    text: 'Zeit ' + tl,
    x: 860,
    y,
    fontSize: low && Math.floor(STATE.time * 4) % 2 === 0 ? '52px' : '46px',
    fillStyle: low ? PAL.warn : PAL.hud,
    align: 'left',
  });
  // Leben als Wurmköpfe
  for (let k = 0; k < Math.max(0, STATE.lives); k++) {
    const x = 1170 + k * 50;
    ctx.save();
    ctx.strokeStyle = PAL.worm;
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(x, 50, 16, 0, Math.PI * 2);
    ctx.stroke();
    ctx.strokeStyle = PAL.helmet;
    ctx.beginPath();
    ctx.arc(x, 46, 16, Math.PI * 1.05, Math.PI * 1.95);
    ctx.closePath();
    ctx.stroke();
    ctx.restore();
  }
  if (STATE.amoebaCount > 0) {
    util.renderText({ ctx, text: 'Schleim ' + Math.round((STATE.amoebaCount / DIFFICULTY.amoebaMax) * 100) + '%', x: 1360, y: 62, fontSize: '34px', fillStyle: PAL.amoeba, align: 'left' });
  }
  util.renderText({ ctx, text: String(Math.round(STATE.score)), x: W - 30, y, fontSize: '50px', fillStyle: PAL.hud, align: 'right' });
}

function renderFlash(ctx, dt) {
  if (STATE.flash <= 0) return;
  ctx.save();
  ctx.globalAlpha = Math.min(0.5, STATE.flash);
  ctx.fillStyle = PAL.flash;
  ctx.fillRect(0, 0, W, OY); // nur die Anzeigeleiste blitzt hell ...
  ctx.globalAlpha = Math.min(0.18, STATE.flash * 0.3); // ... die Höhle nur ganz leicht
  ctx.fillRect(0, OY, W, H - OY);
  ctx.restore();
  STATE.flash = Math.max(0, STATE.flash - dt * 1.5);
}

function renderWorld(ctx, dt) {
  ctx.save();
  if (STATE.shake > 0) {
    ctx.translate((Math.random() - 0.5) * STATE.shake, (Math.random() - 0.5) * STATE.shake);
    STATE.shake = Math.max(0, STATE.shake - dt * 60);
  }
  renderField(ctx, 0);
  renderHint(ctx);
  renderDigger(ctx);
  renderCursor(ctx);
  renderParticles(ctx);
  renderSay(ctx);
  ctx.restore();
}

// ---------------------------------------------------------------------------------------------------------
// Szenen
// ---------------------------------------------------------------------------------------------------------

function handleTitle(grid, dt, ctx) {
  updateParticles(dt);
  // Hintergrund: die Höhle dunkel, ab und zu rieselt ein Diamant
  renderField(ctx, 0.35);
  if (Math.random() < dt * 3) {
    addParticles(rnd(100, W - 100), OY + 20, 3, PAL.gem, 40, 200);
  }
  renderParticles(ctx);
  renderTextDropShadow({ ctx, text: 'Felssturz', x: W / 2, y: 260, fontSize: '150px', fillStyle: PAL.title });
  util.renderText({ ctx, text: 'Ihr grabt. Kurt kriecht. Die Felsen fallen.', x: W / 2, y: 350, fontSize: '50px', fillStyle: PAL.sub });
  util.renderText({
    ctx,
    text: 'Erde anleuchten = graben · Kurt holt die Diamanten selbst · Genug Diamanten = Ausgang\nVorsicht: Wer unter Felsen gräbt, lässt sie fallen. Und Kurt nicht blenden!',
    x: W / 2,
    y: 950,
    fontSize: '34px',
    lineHeight: 50,
    fillStyle: PAL.hudDim,
  });
  if (!startButton) {
    startButton = guiFillButton({
      label: 'START',
      posX: W / 2,
      posY: 620,
      radius: 120,
      edges: 8,
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
  // schwarzer Grund hinter dem Startknopf (Aktionsfläche)
  ctx.save();
  ctx.fillStyle = '#000000';
  ctx.beginPath();
  ctx.arc(W / 2, 620, 135, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
  startButton.handle(grid, dt);
  if (keyEdge('Space')) startGame();
  highscore.renderHighAndLowScores(ctx);
}

function handleGame(grid, dt, ctx) {
  STATE.rockSoundT -= dt;
  STATE.digSoundT -= dt;
  STATE.cursorShow = Math.max(0, STATE.cursorShow - dt);

  if (STATE.collapse > 0) {
    // Einsturz-Animation, danach Level neu
    STATE.collapse -= dt;
    STATE.shake = Math.max(STATE.shake, 14);
    if (Math.random() < dt * 30) addParticles(rnd(0, W), OY + rnd(0, 200), 4, PAL.dust, 60, 600);
    updateParticles(dt);
    renderWorld(ctx, dt);
    renderHud(ctx);
    renderTextDropShadow({ ctx, text: 'EINSTURZ!', x: W / 2, y: 520, fontSize: '150px', fillStyle: PAL.warn });
    if (STATE.collapse <= 0) {
      if (STATE.lives <= 0) {
        endGame('Die Zeit ist um – die Höhle ist eingestürzt.');
      } else {
        STATE.worldReady = false;
        ensureWorld();
        say('Nochmal von vorn!', 2);
      }
    }
    return;
  }

  // Eingabe: Grabeschicht liest das Grid, gefüllte Zellen landen in digQueue
  digLayer.handle(grid, dt);
  processDigQueue();
  handleKeys();
  if (STATE.scene !== 'game') {
    renderWorld(ctx, dt);
    renderHud(ctx);
    return;
  }
  updateDigger(dt);
  if (STATE.scene !== 'game') return;

  // feste Physik-Schrittrate
  const tickLen = 1 / SETTINGS.physicsHz;
  STATE.acc += dt;
  let ticks = 0;
  while (STATE.acc >= tickLen && ticks < SETTINGS.maxTicksPerFrame && STATE.scene === 'game') {
    STATE.acc -= tickLen;
    physicsTick();
    ticks++;
  }
  if (STATE.acc > tickLen) STATE.acc = tickLen; // nicht aufstauen
  STATE.tickPhase = Math.min(1, STATE.acc / tickLen);

  updateParticles(dt);
  if (STATE.scene !== 'game') {
    renderWorld(ctx, dt);
    renderHud(ctx);
    return;
  }

  STATE.levelTime -= dt;
  if (STATE.levelTime <= 0 && digger.state === 'walk') {
    STATE.levelTime = 0;
    STATE.lives--;
    STATE.collapse = SETTINGS.collapseTime;
    playSound(soundBoom, 0.9);
    playSound(soundStomp, 0.7);
  }
  renderWorld(ctx, dt);
  renderHud(ctx);
  renderFlash(ctx, dt);
}

function handleLevelUp(grid, dt, ctx) {
  updateParticles(dt);
  if (Math.random() < dt * 12) {
    addParticles(rnd(200, W - 200), rnd(OY + 100, H - 200), 14, Math.random() < 0.5 ? PAL.gem : PAL.exitOpen, 260, 120);
  }
  renderWorld(ctx, dt);
  renderHud(ctx);
  renderFlash(ctx, dt);
  ctx.save();
  ctx.fillStyle = '#000000';
  ctx.globalAlpha = 0.75;
  ctx.fillRect(W / 2 - 620, 320, 1240, 330);
  ctx.restore();
  const s = 1 + Math.max(0, 0.4 - STATE.sceneTime) * 1.5;
  ctx.save();
  ctx.translate(W / 2, 450);
  ctx.scale(s, s);
  renderTextDropShadow({ ctx, text: 'LEVEL ' + (STATE.level + 1), x: 0, y: 0, fontSize: '150px', fillStyle: PAL.title });
  ctx.restore();
  util.renderText({ ctx, text: LEVEL_NEWS[STATE.level + 1] || 'Tiefer, Kurt, tiefer!', x: W / 2, y: 545, fontSize: '50px', fillStyle: PAL.sub });
  util.renderText({ ctx, text: 'Zeitbonus +' + (STATE.lastBonus || 0), x: W / 2, y: 615, fontSize: '42px', fillStyle: PAL.hud });
  if (STATE.sceneTime >= SETTINGS.levelUpDuration) nextLevel();
}

function handleGameOver(grid, dt, ctx) {
  updateParticles(dt);
  renderField(ctx, 0.25);
  renderParticles(ctx);
  renderTextDropShadow({ ctx, text: 'Verschüttet!', x: W / 2, y: 200, fontSize: '130px', fillStyle: PAL.title });
  util.renderText({ ctx, text: STATE.endReason, x: W / 2, y: 290, fontSize: '46px', fillStyle: PAL.warn });
  util.renderText({
    ctx,
    text:
      Math.round(STATE.score) + ' Punkte' + (STATE.newHighscore ? '  – NEUER HIGHSCORE!' : '') + '\n' +
      'Level ' + STATE.level + ' · ' + STATS.gems + ' Diamanten (' + STATS.caught + ' im Flug gefangen)\n' +
      STATS.dug + ' Zellen gegraben · ' + STATS.rocksFallen + ' Felsen gefallen\n' +
      STATS.squashed + '× platt · ' + STATS.flies + ' Glühwürmchen gesprengt · ' + STATS.amoebaBurned + ' Schleim verbrannt\n' +
      Math.round(STATS.blindSeconds) + ' s geblendet – Kurt hat sich das gemerkt.',
    x: W / 2,
    y: 380,
    fontSize: '38px',
    lineHeight: 56,
    fillStyle: PAL.sub,
  });
  highscore.renderHighAndLowScores(ctx);
  if (STATE.sceneTime > SETTINGS.againDelay) {
    if (!againButton) {
      againButton = guiFillButton({
        label: 'NOCHMAL',
        posX: W / 2,
        posY: 860,
        radius: 100,
        edges: 8,
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
    ctx.save();
    ctx.fillStyle = '#000000';
    ctx.beginPath();
    ctx.arc(W / 2, 860, 115, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
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
  name: 'Felssturz',
  description: `  Kurt, will Diamanten 
  aber graben kann er nicht
  
  Das macht ihr:
  Erde anleuchten, dranbleiben, sie bröckelt weg

  Kurt kriecht von selbst zum nächsten Diamanten, 
  den er erreichen kann.
  
  Genug Diamanten 
  der Ausgang öffnet sich

  Aber: Felsen fallen in jeden Gang, den ihr grabt!
  Fällt einer auf Kurt, ist er platt. Und leuchtet ihm nicht ins Gesicht
  `,
  image: 'media/img/gametitles/laser-mandelbrot-1-###4###.png',

  init: function () {
    resetAll();
  },

  handle: function (grid, elapsed) {
    const dt = Math.min(elapsed || 0, 0.1);
    const ctx = MasterCanvas.get2dContext();
    ensurePalette();
    ensureWorld(); // falls ohne init() gestartet
    STATE.time += dt;
    STATE.sceneTime += dt;

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
