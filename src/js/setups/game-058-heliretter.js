/**
 * Heli-Retter – Hochwasser, Vulkan, Möwen. Und ein Rettungshubschrauber, den 50 Leute gleichzeitig fliegen.
 *
 * Seitlich scrollende Landschaft (drei Bildschirmbreiten), links die Basis mit Hangar und Landeplatz.
 * Auf Hügeln und Gipfeln warten Schafe, Touristen und Pinguine, während das Wasser steigt.
 *
 * Regeln:
 * - LENKEN: Unten liegt die LENK-KARTE (dunkles Feld, Minikarte der ganzen Welt). Der Heli fliegt träge zum
 *   Schwerpunkt aller Laser auf der Karte (gui/aimTurret, unsichtbar, nur als Schwerpunkt-Messer).
 *   Ohne Laser bleibt der letzte Wegpunkt stehen – der Heli fliegt ihn weiter an.
 * - LANDEN: Wegpunkt auf den Boden (die Bodenlinie der Karte) legen. Unterwegs hält der Heli selbst Abstand zum
 *   Gelände; erst in der Nähe des Wegpunkts sinkt er. Liegt der Wegpunkt TIEF unter dem Boden, sinkt er zu schnell
 *   → RUMMS: Bruchlandung, ein Leben weg, und wer darunter wartet, wird plattgedrückt (Punktabzug, Slapstick).
 * - EINSTEIGEN: Steht der Heli auf demselben Plateau, rennen die Wartenden zur Tür (max. 8 an Bord).
 * - ABLIEFERN: Auf der Basis landen → alle steigen aus (Punkte, volle Ladung = Bonus), Tank wird aufgefüllt.
 * - SPRIT: Fliegen kostet Sprit. Leer = Notlandung, ein Leben weg, Neustart an der Basis
 *   (die Passagiere warten wieder an ihrem Gipfel).
 * - FLUT: Das Wasser steigt. Erreicht es eine Gruppe, schwimmt sie davon (verloren, aber gut gelaunt).
 * - GEFAHREN (oben im Bild, pixelFillButton r ≥ 60): Möwen (L1), Lavabrocken (L2), Gewitterwolken (L4) –
 *   anleuchten, bis sie zerplatzen bzw. sich entladen. Treffen sie den Heli: ein Leben weg.
 * - LICHT-DISZIPLIN: Laser auf Wartenden erschreckt sie – sie rennen weg (Punktabzug, kostet Zeit).
 *   Teamwork: eine Gruppe lenkt unten auf der Karte, eine schützt oben den Heli – ohne die Wartenden zu blenden.
 * - LEVEL: alle Gruppen gerettet (oder weggeschwommen) → nächstes Level, +1 Leben.
 *   L1 Schafe+Möwen, L2 Vulkan+Lava, L3 Pinguine+Wind, L4 Gewitternacht mit Suchscheinwerfer, L5 alles, danach
 *   im Wechsel Tag/Nacht mit steigender Schwierigkeit (DIFFICULTY).
 * - Game Over bei 0 Leben. Highscore: Punkte, Gerettete, Level, Verlorene, Bruchlandungen.
 *
 * Licht-Disziplin: Lenk-Karte schwarz, nur dünne Konturen. Himmel dunkel, Gebirge gedimmt vorgerendert
 * (Midpoint-Displacement-Fraktale in zwei Parallax-Ebenen), Heli/Figuren/Gefahren schwarz gefüllt und konturiert.
 * Farben nur aus laserConfig.testColor (Hue 0.25..0.75), nie die reine Laserfarbe.
 *
 * Tastatur (Test ohne Laser):
 * - Leertaste: Start / Nochmal
 * - Pfeiltasten: Wegpunkt auf der Lenk-Karte verschieben (aimTurret keyCodes) – Runter = sinken/landen
 * - 1: alle Gefahren im Bild zerplatzen · 2: Autopilot zur nächsten wartenden Gruppe (landet selbst)
 * - 3: Autopilot zur Basis · 0: nächste Gruppe erschrecken (Strafe testen) · 9: Level sofort geschafft
 *   (Autopilot endet, sobald sich der Karten-Wegpunkt bewegt.)
 *   d v g r m h t f F s, PageUp/PageDown/Home sind in view.js Debug-Tasten und hier bewusst frei.
 *
 * Klassiker: Choplifter (Dan Gorlin, Brøderbund, 1982 – Apple II, C64, Atari): Heli fliegt seitlich hinaus,
 * landet, Leute rennen zur Tür, zurück zur Basis. Hier: kein Krieg, keine Geiseln – Hochwasser, Vulkan und
 * Schafe; und statt eines Joysticks lenkt ein ganzer Saal über eine Minikarte (wie das Radar in Defender,
 * Williams 1981). Steigende Flut als Zeitdruck erinnert an die Wasserlevel aus Sonic (1991).
 *
 * Ähnlichkeiten im Bestand:
 * - game-029-leuchtturm: Objekte folgen dem Licht. Hier folgt der Heli nicht dem Licht im Bild, sondern dem
 *   Schwerpunkt auf einer getrennten, dunklen Karte (Lenken und Schützen sind räumlich getrennt).
 * - game-020-defender: Name/Radar-Idee, aber dort Abwehr ohne Scrollen und ohne Transport.
 * - game-015-flap: Fluggerät seitlich, dort aber Auto-Scroller mit Flattern; hier freies Hin- und Zurückfliegen.
 *
 * One-Pixel-Netzwerk-Tauglichkeit: gut. Jeder Mitspieler steuert einen Punkt – entweder auf der Karte (sein Pixel
 * zieht am gemeinsamen Schwerpunkt = Mehrheitslenkung) oder im Bild (sein Pixel füllt Gefahren mit).
 * Die Strafe für Wartende-Anleuchten funktioniert pro Pixel genauso.
 */

import util, { getRgbSpreadHex, renderTextDropShadow } from '../util.js';
import { createKeyEdge, approach, clamp } from './gui/gridScan.js';
import soundSplash from '../../../public/media/485066__javierserrat__object-falls-into-the-water.wav';
import soundPlop from '../../../public/media/369952__mischy__plop-1.wav';
import soundBoom from '../../../public/media/155235__zangrutz__bomb-small (1).mp3';
import soundStomp from '../../../public/media/517267__foolboymedia__cinematic-stomp.wav';
import soundBoing from '../../../public/media/bounce_523088_11537497-lq.mp3';
import soundZap from '../../../public/media/flash-253597_4508519-lq.mp3';
import soundSonar from '../../../public/media/70299__kizilsungur__sonar.wav';
import soundMusic from '../../../public/media/522110__setuniman__cheeky-1t41b.wav';
import soundJingle from '../../../public/media/521966__kastenfrosch__ready-to-start-jingle.ogg';
import soundBoard from '../../../public/media/opengameart/Item Pickup.ogg';
import soundDeliver from '../../../public/media/opengameart/Accept.mp3';
import soundLevelUp from '../../../public/media/opengameart/Level Up.ogg';
import soundScare from '../../../public/media/opengameart/Decline.wav';
import soundHit from '../../../public/media/opengameart/Menu Error.ogg';
import soundGameOver from '../../../public/media/opengameart/Music Box Game Over III.wav';
var laserConfig = require('../LaserApiConfig.js').default;
var MasterCanvas = require('../MasterCanvas').default;
var guiFillButton = require('./gui/fillButton-ai2').default;
var guiPixelFillButton = require('./gui/pixelFillButton').default;
var guiAimTurret = require('./gui/aimTurret').default;
var createHighscore = require('../util/highscore').default;

const W = 1920;
const H = 1080;
const HUD_H = 84;
const VIEW_BOTTOM = 815; // Unterkante der Spielwelt-Ansicht
const WORLD_W = 5760; // drei Bildschirmbreiten
const SEGS = 512; // Geländestützpunkte
const SEG_W = WORLD_W / SEGS;
const PAD = { x: 40, y: 834, w: 1840, h: 216 }; // Lenk-Karte
const WY_TOP = 100; // Welt-y oben auf der Karte
const WY_BOT = 815; // Welt-y unten auf der Karte
const HELI_FOOT = 46; // Mittelpunkt → Kufen
const BASE = { x1: 640, pad: 340, y: 600 };

// ---------------------------------------------------------------------------------------------------------
// Einstellungen
// ---------------------------------------------------------------------------------------------------------

const SETTINGS = {
  startLives: 4,
  maxLives: 6,
  capacity: 8,
  fuelMax: 100,
  refuelRate: 45,
  unloadInterval: 0.22,
  invulTime: 2.5,
  respawnDelay: 2.2,
  levelUpDuration: 3.2,
  againDelay: 1.5,
  maxParticles: 400,
  maxFloaters: 30,
  maxSwimmers: 40,
  maxWalkers: 30,
  boardRange: 430, // Heli muss so nah am Gruppenzentrum landen
  plateauHalf: 190,
  fleeTime: 2.6,
  flatTime: 2.2,
  waterStart: 772,
  waterCap: 622, // höher steigt die Flut nie (Basis liegt trocken)
  sensorRadius: 115,
  gullRadius: 62,
  lavaRadius: 60,
  cloudRadius: 92,
  hitDistance: 80,
};

const DIFFICULTY = {
  maxVx: 430, // px/s
  vxGain: 1.1,
  accel: 2.2, // Annäherungsrate (1/s) – träge
  maxUp: 250,
  maxDown: 330,
  vyGain: 1.5,
  vAccel: 2.6,
  hardSideSpeed: 280,
  safeLandStart: 205, // Sinkrate (px/s), ab der es RUMMS macht
  safeLandPerLevel: -9,
  safeLandMin: 140,
  fuelBurnStart: 1.45, // pro Sekunde Flug
  fuelBurnPerLevel: 0.1,
  fuelBurnMax: 2.4,
  floodRiseStart: 0.75, // px/s
  floodRisePerLevel: 0.12,
  floodRiseMax: 1.7,
  gullIntervalStart: 5.5,
  gullIntervalPerLevel: -0.35,
  gullIntervalMin: 2.2,
  gullSpeedStart: 165,
  gullSpeedPerLevel: 12,
  gullSpeedMax: 300,
  lavaIntervalStart: 3.4,
  lavaIntervalPerLevel: -0.22,
  lavaIntervalMin: 1.4,
  lavaSpeedStart: 135,
  lavaSpeedPerLevel: 10,
  lavaSpeedMax: 240,
  boltIntervalStart: 7,
  boltIntervalPerLevel: -0.4,
  boltIntervalMin: 3.4,
  boltChargeStart: 3.6,
  boltChargePerLevel: -0.12,
  boltChargeMin: 2.3,
  windPerLevel: 6,
  maxHazardsStart: 3,
  maxHazardsCap: 10,
  groupsMax: 7,
  perGroupMin: 3,
  perGroupMax: 5,
  perGroupCap: 8,
  pointsRescue: 100,
  pointsRescuePerLevel: 20,
  pointsBoard: 10,
  fullLoadBonus: 300,
  levelBonus: 150,
  noLossBonus: 300,
  popPoints: 25,
  boltPoints: 60,
  scarePenalty: 30,
  squashPenalty: 60,
};

const LEVELS = [
  null,
  { title: 'Hochwasser auf der Schafweide', kind: 'schaf', groups: 3, gulls: true, lava: false, bolts: false, wind: 0, night: false, volcano: false, news: 'Möwen anleuchten – sie hauen ab!' },
  { title: 'Der Vulkan hustet', kind: 'tourist', groups: 4, gulls: true, lava: true, bolts: false, wind: 0, night: false, volcano: true, news: 'Neu: Lavabrocken – anleuchten = zerplatzen!' },
  { title: 'Pinguine im Sturm', kind: 'pinguin', groups: 4, gulls: true, lava: false, bolts: false, wind: 70, night: false, volcano: false, news: 'Neu: Wind! Der Heli wird abgetrieben.' },
  { title: 'Gewitternacht', kind: 'mix', groups: 5, gulls: false, lava: false, bolts: true, wind: 40, night: true, volcano: false, news: 'Nacht! Gewitterwolken anleuchten = entladen.' },
  { title: 'Alles auf einmal!', kind: 'mix', groups: 5, gulls: true, lava: true, bolts: true, wind: 60, night: false, volcano: true, news: 'Möwen, Lava, Blitze, Wind. Viel Glück!' },
];

const KINDS = ['schaf', 'tourist', 'pinguin'];

const TEXTS = {
  help: { schaf: ['Mäh!', 'Määäh!', 'Hilfe-mäh!'], tourist: ['Hilfe!', 'Huhu!', 'Hier oben!', 'Selfie?'], pinguin: ['Quiek!', 'Huhu!', 'Fisch?'] },
  scared: { schaf: 'Määäh! Licht!', tourist: 'Aaah, meine Augen!', pinguin: 'Iiiek!' },
  flooded: { schaf: 'Blubb-mäh … schwimmen halt.', tourist: 'Wir nehmen das Boot!', pinguin: 'Juhu, Wasser!' },
  squashed: ['Plattgedrückt!', 'Pfannkuchen!', 'Aua!'],
};

// ---------------------------------------------------------------------------------------------------------
// Zustand (vorbelegt – handle() läuft auch ohne init())
// ---------------------------------------------------------------------------------------------------------

const STATE = {
  scene: 'title',
  sceneTime: 0,
  time: 0,
  level: 1,
  def: LEVELS[1],
  score: 0,
  camX: 0,
  water: SETTINGS.waterStart,
  wind: 0,
  gust: 0,
  gustT: 6,
  shake: 0,
  flash: 0,
  gullT: 3,
  lavaT: 3,
  boltT: 4,
  msg: '',
  msgT: 0,
  levelTotal: 0,
  levelRescued: 0,
  levelLost: 0,
  lastBonus: 0,
  lastPerfect: false,
  newHighscore: false,
  endReason: '',
};

const STATS = {
  rescued: 0,
  lost: 0,
  squashed: 0,
  scared: 0,
  hardLandings: 0,
  hits: 0,
  gullsShooed: 0,
  lavaPopped: 0,
  boltsDefused: 0,
  flights: 0,
  fullLoads: 0,
  flightTime: 0,
  crashes: 0,
};

const heli = {
  x: BASE.pad,
  y: BASE.y - HELI_FOOT,
  vx: 0,
  vy: 0,
  landed: true,
  facing: 1,
  tilt: 0,
  rotor: 0,
  fuel: SETTINGS.fuelMax,
  lives: SETTINGS.startLives,
  invul: 0,
  engineOut: false,
  crashed: false,
  crashT: 0,
  cargo: [],
  unloadT: 0,
  landFull: false,
  fuelWarned: false,
  fullShown: false,
  lock: null,
  lockRef: null,
};

const TGT = { x: BASE.pad, y: BASE.y };

var terrain = null;
var groups = [];
var hazards = [];
var particles = [];
var floaters = [];
var swimmers = [];
var walkers = [];
var stars = [];

var turret = null;
var startButton = null;
var againButton = null;
var music = null;
var keyEdge = createKeyEdge();
var highscore = createHighscore('Heli-Retter', 'punkte');

var PAL = null;
var palKey = '';
var farLayer = null;
var nearLayer = null;
var groundLayer = null;
var layerKey = '';

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
    heli: col(0.5, 0.45, 1),
    heliWin: col(0.55, 0.55, 0.45),
    heliStripe: col(0.32, 0.7, 0.95),
    rotor: col(0.45, 0.2, 0.85),
    ground: col(0.38, 0.5, 0.6),
    groundDim: col(0.38, 0.45, 0.28),
    water: col(0.56, 0.65, 0.5),
    waterDim: col(0.56, 0.6, 0.22),
    farFill: col(0.64, 0.5, 0.13),
    farLine: col(0.64, 0.4, 0.3),
    nearFill: col(0.5, 0.5, 0.15),
    nearLine: col(0.5, 0.4, 0.38),
    snow: col(0.55, 0.15, 0.45),
    sheep: col(0.42, 0.12, 0.95),
    sheepFace: col(0.42, 0.3, 0.55),
    tourist: col(0.38, 0.6, 0.95),
    hat: col(0.3, 0.75, 0.95),
    penguin: col(0.6, 0.35, 0.95),
    penguinBelly: col(0.6, 0.1, 0.9),
    beak: col(0.27, 0.8, 1),
    gull: col(0.5, 0.1, 0.95),
    lava: col(0.27, 0.9, 1),
    lavaDark: col(0.27, 0.8, 0.16),
    cloud: col(0.7, 0.35, 0.75),
    bolt: col(0.3, 0.45, 1),
    meter: col(0.45, 0.7, 1),
    hud: col(0.45, 0.45, 0.92),
    hudDim: col(0.45, 0.35, 0.55),
    warn: col(0.72, 0.85, 1),
    good: col(0.38, 0.75, 1),
    title: col(0.33, 0.7, 0.95),
    sub: col(0.6, 0.45, 0.85),
    pad: col(0.45, 0.45, 0.5),
    padDim: col(0.45, 0.35, 0.28),
    padTerrain: col(0.38, 0.45, 0.4),
    padTarget: col(0.33, 0.6, 0.65),
    flash: col(0.5, 0.25, 1),
    search: col(0.32, 0.25, 0.9),
    base: col(0.42, 0.45, 0.8),
    star: col(0.5, 0.15, 0.75),
    fire: col(0.27, 0.85, 1),
    spark: col(0.3, 0.6, 1),
    feather: col(0.5, 0.05, 1),
    rain: col(0.58, 0.4, 0.45),
    start: [col(0.35, 0.6, 0.6), col(0.35, 0.6, 0.8), col(0.35, 0.6, 1)],
  };
  layerKey = '';
  groundLayer = null;
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

function rand(a, b) {
  return a + Math.random() * (b - a);
}

function pick(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

function sx(worldX) {
  return worldX - STATE.camX;
}

function showMessage(text, duration) {
  STATE.msg = text;
  STATE.msgT = duration || 2.5;
}

function addParticles(x, y, count, color, speed, gravity, up) {
  for (let i = 0; i < count && particles.length < SETTINGS.maxParticles; i++) {
    const a = Math.random() * Math.PI * 2;
    const s = (0.3 + Math.random()) * (speed || 220);
    const life = 0.5 + Math.random() * 0.8;
    particles.push({
      x,
      y,
      vx: Math.cos(a) * s,
      vy: Math.sin(a) * s - (up || 0),
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
  floaters.push({ x, y, text, color, life: 1.7 });
}

function lvlValue(start, perLevel, limit) {
  const v = start + (STATE.level - 1) * perLevel;
  return perLevel < 0 ? Math.max(limit, v) : Math.min(limit, v);
}

function safeLand() {
  return lvlValue(DIFFICULTY.safeLandStart, DIFFICULTY.safeLandPerLevel, DIFFICULTY.safeLandMin);
}

function levelDef(lvl) {
  if (lvl < LEVELS.length) return LEVELS[lvl];
  const night = lvl % 2 === 0;
  return {
    title: (night ? 'Nachtschicht ' : 'Großeinsatz ') + (lvl - LEVELS.length + 1),
    kind: 'mix',
    groups: Math.min(DIFFICULTY.groupsMax, 5 + Math.floor((lvl - 5) / 2)),
    gulls: true,
    lava: true,
    bolts: true,
    wind: 60 + (lvl - 5) * DIFFICULTY.windPerLevel,
    night,
    volcano: !night,
    news: night ? 'Nachtflug mit allem!' : 'Schneller, mehr, nasser!',
  };
}

// ---------------------------------------------------------------------------------------------------------
// Gelände (Midpoint-Displacement) und Karte
// ---------------------------------------------------------------------------------------------------------

function midpoint(n, a, b, disp, rough) {
  const h = new Float32Array(n + 1);
  h[0] = a;
  h[n] = b;
  let step = n;
  let d = disp;
  while (step > 1) {
    const half = step >> 1;
    for (let i = half; i < n; i += step) h[i] = (h[i - half] + h[i + half]) / 2 + (Math.random() * 2 - 1) * d;
    d *= rough;
    step = half;
  }
  return h;
}

function buildTerrain(plateaus) {
  const h = midpoint(SEGS, BASE.y, rand(640, 760), 330, 0.56);
  for (let i = 0; i <= SEGS; i++) h[i] = clamp(h[i], 390, 800);
  plateaus.forEach((p) => {
    for (let i = 0; i <= SEGS; i++) {
      const x = i * SEG_W;
      const d = x < p.x0 ? p.x0 - x : x > p.x1 ? x - p.x1 : 0;
      if (d === 0) h[i] = p.y;
      else if (d < p.ramp) {
        const t = d / p.ramp;
        const s = t * t * (3 - 2 * t);
        h[i] = p.y * (1 - s) + h[i] * s;
      }
    }
  });
  return h;
}

function terrainAt(x) {
  if (!terrain) return 700;
  const f = clamp(x, 0, WORLD_W) / SEG_W;
  const i = Math.min(SEGS - 1, Math.floor(f));
  const t = f - i;
  return terrain[i] * (1 - t) + terrain[i + 1] * t;
}

/** Oberfläche: Gelände oder Wasser, was höher liegt (kleineres y) */
function surfaceAt(x) {
  return Math.min(terrainAt(x), STATE.water);
}

function isWaterAt(x) {
  return terrainAt(x) > STATE.water + 1;
}

function worldToPadX(x) {
  return PAD.x + (x / WORLD_W) * PAD.w;
}

function worldToPadY(y) {
  return PAD.y + ((y - WY_TOP) / (WY_BOT - WY_TOP)) * PAD.h;
}

function padToWorldX(px) {
  return clamp(((px - PAD.x) / PAD.w) * WORLD_W, 80, WORLD_W - 80);
}

function padToWorldY(py) {
  return clamp(WY_TOP + ((py - PAD.y) / PAD.h) * (WY_BOT - WY_TOP), WY_TOP + 40, WY_BOT + 60);
}

// ---------------------------------------------------------------------------------------------------------
// Level-Generator
// ---------------------------------------------------------------------------------------------------------

function generateLevel(lvl) {
  const def = levelDef(lvl);
  STATE.def = def;
  const n = def.groups;
  const x0 = 1150;
  const x1 = WORLD_W - 260;
  const slot = (x1 - x0) / n;
  const plateaus = [{ x0: 0, x1: BASE.x1, y: BASE.y, ramp: 220 }];
  const lowFirst = Math.random() < 0.5 ? 0 : 1;
  groups = [];
  let total = 0;
  for (let i = 0; i < n; i++) {
    const gx = Math.round(x0 + slot * (i + 0.5) + rand(-slot * 0.15, slot * 0.15));
    const low = i % 2 === lowFirst;
    const gy = Math.round(low ? rand(650, 708) : rand(480, 600));
    plateaus.push({ x0: gx - SETTINGS.plateauHalf, x1: gx + SETTINGS.plateauHalf, y: gy, ramp: 170 });
    const kind = def.kind === 'mix' ? pick(KINDS) : def.kind;
    const extra = Math.floor((lvl - 1) / 3);
    const count = Math.min(DIFFICULTY.perGroupCap, DIFFICULTY.perGroupMin + Math.floor(Math.random() * (DIFFICULTY.perGroupMax - DIFFICULTY.perGroupMin + 1)) + extra);
    const g = { x: gx, y: gy, kind, people: [], sensor: null, bubble: '', bubbleT: rand(1, 4), sayT: 0, flooded: false, warned: false };
    for (let k = 0; k < count; k++) {
      const off = (k - (count - 1) / 2) * 44;
      g.people.push({ x: gx + off, slot: gx + off, state: 'wait', t: 0, phase: rand(0, 6), dir: Math.random() < 0.5 ? -1 : 1, kind, g });
    }
    total += count;
    groups.push(g);
  }
  terrain = buildTerrain(plateaus);
  groundLayer = null;
  STATE.water = SETTINGS.waterStart;
  STATE.levelTotal = total;
  STATE.levelRescued = 0;
  STATE.levelLost = 0;
  STATE.gullT = 3;
  STATE.lavaT = 2.5;
  STATE.boltT = 4;
  STATE.gust = 0;
  STATE.wind = 0;
  hazards = [];
  swimmers = [];
  walkers = [];
  heli.cargo = [];
  resetHeliAtBase();
  STATE.camX = 0;
}

function ensureWorld() {
  if (!terrain) generateLevel(STATE.level);
  if (stars.length === 0) {
    for (let i = 0; i < 140; i++) stars.push({ x: Math.random() * W, y: HUD_H + Math.random() * 520, p: Math.random() * 6, s: 1 + Math.random() * 2.5 });
  }
}

// ---------------------------------------------------------------------------------------------------------
// Heli
// ---------------------------------------------------------------------------------------------------------

function ensureTurret() {
  if (turret) return;
  // aimTurret nur als Schwerpunkt-Messer auf der Lenk-Karte (unsichtbar); Startziel = über der Basis
  turret = guiAimTurret({
    posX: worldToPadX(BASE.pad),
    posY: worldToPadY(BASE.y - 150) + 300,
    scanX: PAD.x,
    scanY: PAD.y,
    scanWidth: PAD.w,
    scanHeight: PAD.h,
    minPercent: 0.3,
    focusSpread: 300,
    targetSmoothing: 5,
    fireInterval: 9999,
    keyCodes: { left: 'ArrowLeft', right: 'ArrowRight', up: 'ArrowUp', down: 'ArrowDown' },
    keySpeed: 420,
    keyHoldTime: 0.5,
    visible: false,
  });
  if (heli.lock && !heli.lockRef) heli.lockRef = { x: turret.getTargetX(), y: turret.getTargetY() };
}

/** Autopilot-Ziel (Welt), gilt bis sich der Karten-Wegpunkt bewegt */
function lockTarget(x, y) {
  heli.lock = { x, y };
  heli.lockRef = turret ? { x: turret.getTargetX(), y: turret.getTargetY() } : null;
}

function resetHeliAtBase() {
  heli.x = BASE.pad;
  heli.y = BASE.y - HELI_FOOT;
  heli.vx = 0;
  heli.vy = 0;
  heli.landed = true;
  heli.facing = 1;
  heli.tilt = 0;
  heli.fuel = SETTINGS.fuelMax;
  heli.engineOut = false;
  heli.crashed = false;
  heli.crashT = 0;
  heli.unloadT = 0;
  heli.landFull = false;
  heli.fuelWarned = false;
  heli.fullShown = false;
  lockTarget(BASE.pad, BASE.y + 4);
}

function updateTarget() {
  if (heli.lock) {
    if (turret && heli.lockRef) {
      const moved = Math.abs(turret.getTargetX() - heli.lockRef.x) + Math.abs(turret.getTargetY() - heli.lockRef.y);
      if (moved > 3) heli.lock = null;
    } else if (turret) {
      heli.lockRef = { x: turret.getTargetX(), y: turret.getTargetY() };
    }
  }
  if (heli.lock) {
    TGT.x = heli.lock.x;
    TGT.y = heli.lock.y;
  } else if (turret) {
    TGT.x = padToWorldX(turret.getTargetX());
    TGT.y = padToWorldY(turret.getTargetY());
  }
}

function loseLife(text) {
  if (heli.invul > 0 || STATE.scene !== 'game') return false;
  heli.lives--;
  heli.invul = SETTINGS.invulTime;
  STATE.shake = Math.max(STATE.shake, 22);
  addFloater(heli.x, heli.y - 90, text, PAL.warn);
  if (heli.lives <= 0) endGame(text);
  return true;
}

function updateHeli(dt) {
  if (heli.crashed) {
    heli.crashT += dt;
    if (Math.random() < dt * 14) addParticles(heli.x + rand(-40, 40), heli.y, 1, PAL.hudDim, 40, -60, 60);
    if (heli.crashT >= SETTINGS.respawnDelay && STATE.scene === 'game') {
      resetHeliAtBase();
      lockTarget(BASE.pad, BASE.y - 160);
      heli.invul = 2;
      showMessage('Ersatz-Heli startklar!', 2);
    }
    return;
  }
  heli.invul = Math.max(0, heli.invul - dt);
  heli.rotor += dt * (heli.engineOut ? 7 : heli.landed ? 16 : 30);
  updateTarget();

  if (heli.engineOut) {
    heli.vy = Math.min(420, heli.vy + 380 * dt);
    heli.vx *= 1 - Math.min(1, 0.6 * dt);
  } else if (heli.landed) {
    heli.vx = 0;
    heli.vy = 0;
    const surf = surfaceAt(heli.x);
    heli.y = surf - HELI_FOOT;
    if (TGT.y < surf - 35 || Math.abs(TGT.x - heli.x) > 160) {
      heli.landed = false;
      heli.vy = -80;
      heli.y -= 3;
      heli.fullShown = false;
      addParticles(heli.x, surf, 10, isWaterAt(heli.x) ? PAL.water : PAL.groundDim, 160, 0, 0);
    }
  } else {
    let tyC = TGT.y - HELI_FOOT + 14; // leicht unter den Wegpunkt, damit er wirklich aufsetzt
    const dxT = TGT.x - heli.x;
    if (Math.abs(dxT) > 160) {
      // unterwegs: Abstand zum Gelände voraus halten
      const dir = dxT > 0 ? 1 : -1;
      let top = surfaceAt(heli.x);
      for (let k = 1; k <= 5; k++) top = Math.min(top, surfaceAt(heli.x + dir * k * 70));
      tyC = Math.min(tyC, top - HELI_FOOT - 70);
    }
    const wantVx = clamp(dxT * DIFFICULTY.vxGain, -DIFFICULTY.maxVx, DIFFICULTY.maxVx);
    heli.vx = approach(heli.vx, wantVx, DIFFICULTY.accel, dt) + STATE.wind * dt;
    const wantVy = clamp((tyC - heli.y) * DIFFICULTY.vyGain, -DIFFICULTY.maxUp, DIFFICULTY.maxDown);
    heli.vy = approach(heli.vy, wantVy, DIFFICULTY.vAccel, dt);
    const burn = lvlValue(DIFFICULTY.fuelBurnStart, DIFFICULTY.fuelBurnPerLevel, DIFFICULTY.fuelBurnMax);
    heli.fuel -= burn * dt * (1 + 0.4 * Math.min(1, Math.abs(heli.vx) / DIFFICULTY.maxVx));
    STATS.flightTime += dt;
    if (heli.fuel < 25 && !heli.fuelWarned) {
      heli.fuelWarned = true;
      playSound(soundSonar, 0.6);
      showMessage('Sprit knapp! Zurück zur Basis!', 3);
    }
    if (heli.fuel <= 0) {
      heli.fuel = 0;
      heli.engineOut = true;
      addFloater(heli.x, heli.y - 90, 'Tank leer!', PAL.warn);
      playSound(soundHit, 0.7);
    }
  }

  if (!heli.landed) {
    heli.x += heli.vx * dt;
    heli.y += heli.vy * dt;
    if (heli.x < 70 || heli.x > WORLD_W - 70) {
      heli.x = clamp(heli.x, 70, WORLD_W - 70);
      heli.vx = 0;
    }
    if (heli.y < WY_TOP + 30) {
      heli.y = WY_TOP + 30;
      heli.vy = Math.max(0, heli.vy);
    }
    const surf = surfaceAt(heli.x);
    if (heli.y + HELI_FOOT >= surf) touchDown(surf);
  }
  if (Math.abs(heli.vx) > 25) heli.facing = heli.vx > 0 ? 1 : -1;
  heli.tilt = approach(heli.tilt, clamp(heli.vx / DIFFICULTY.maxVx, -1, 1) * 0.28, 5, dt);
  if (heli.fuel > 50) heli.fuelWarned = false;
}

function touchDown(surf) {
  const water = isWaterAt(heli.x);
  const impact = heli.vy;
  heli.y = surf - HELI_FOOT;
  if (heli.engineOut) {
    crash();
    return;
  }
  if (impact > safeLand() || Math.abs(heli.vx) > DIFFICULTY.hardSideSpeed) {
    hardLanding(water, surf);
    return;
  }
  heli.landed = true;
  heli.vx = 0;
  heli.vy = 0;
  heli.landFull = heli.cargo.length >= SETTINGS.capacity;
  addParticles(heli.x, surf, 8, water ? PAL.water : PAL.groundDim, 120, 0, 0);
  // wer direkt drunter steht, hüpft beiseite (keine Strafe)
  groups.forEach((g) => {
    g.people.forEach((p) => {
      if (Math.abs(p.x - heli.x) < 60 && (p.state === 'wait' || p.state === 'back')) {
        p.state = 'flee';
        p.t = 0.5;
        p.dir = p.x < heli.x ? -1 : 1;
      }
    });
  });
}

function hardLanding(water, surf) {
  heli.landed = false;
  heli.vy = -260;
  heli.y = surf - HELI_FOOT - 4;
  STATE.shake = 28;
  playSound(water ? soundSplash : soundStomp, 0.8);
  addParticles(heli.x, surf, 30, water ? PAL.water : PAL.groundDim, 300, 400, 200);
  const lost = loseLife(water ? 'PLATSCH! Zu schnell gesunken!' : 'RUMMS! Zu schnell gesunken!');
  if (lost) STATS.hardLandings++;
  // Wer darunter steht, wird plattgedrückt – Slapstick, aber Punktabzug
  let squashed = 0;
  groups.forEach((g) => {
    g.people.forEach((p) => {
      if (Math.abs(p.x - heli.x) < 130 && p.state !== 'flat' && Math.abs(surfaceAt(p.x) - surf) < 60) {
        p.state = 'flat';
        p.t = SETTINGS.flatTime;
        squashed++;
      }
    });
  });
  if (squashed > 0) {
    STATS.squashed += squashed;
    STATE.score = Math.max(0, STATE.score - squashed * DIFFICULTY.squashPenalty);
    playSound(soundBoing, 0.8);
    addFloater(heli.x, surf - 150, pick(TEXTS.squashed) + ' −' + squashed * DIFFICULTY.squashPenalty, PAL.warn);
  }
}

function crash() {
  heli.crashed = true;
  heli.crashT = 0;
  heli.landed = true;
  heli.vx = 0;
  heli.vy = 0;
  STATS.crashes++;
  STATE.shake = 30;
  playSound(soundBoom, 0.8);
  addParticles(heli.x, heli.y, 50, PAL.fire, 320, 300, 150);
  addFloater(heli.x, heli.y - 100, 'Notlandung! Alle raus!', PAL.warn);
  // Passagiere gehen zurück zu ihrem Gipfel (falls der noch trocken ist)
  heli.cargo.forEach((c) => {
    if (c.g.flooded) {
      STATS.lost++;
      STATE.levelLost++;
    } else {
      const off = rand(-60, 60);
      c.g.people.push({ x: c.g.x + off, slot: c.g.x + off, state: 'wait', t: 0, phase: rand(0, 6), dir: 1, kind: c.kind, g: c.g });
    }
  });
  heli.cargo = [];
  heli.lives--;
  heli.invul = 0;
  if (heli.lives <= 0) endGame('Kein Sprit mehr – und kein Ersatz-Heli.');
}

// ---------------------------------------------------------------------------------------------------------
// Wartende
// ---------------------------------------------------------------------------------------------------------

function runSpeed(kind) {
  return kind === 'pinguin' ? 105 : kind === 'schaf' ? 165 : 150;
}

function heliOnPlateau(g) {
  return heli.landed && !heli.crashed && Math.abs(heli.x - g.x) < SETTINGS.boardRange && Math.abs(surfaceAt(heli.x) - g.y) < 70;
}

function ensureSensor(g) {
  if (g.sensor) return;
  g.sensor = guiPixelFillButton({
    label: '',
    posX: sx(g.x),
    posY: g.y - 40,
    radius: SETTINGS.sensorRadius,
    speedUp: 140,
    speedDown: 70,
    fullPercent: 18,
    activeValue: 70,
    visible: false,
    onEnterActive: () => scareGroup(g),
  });
}

function scareGroup(g) {
  let n = 0;
  g.people.forEach((p) => {
    if (p.state === 'wait' || p.state === 'run' || p.state === 'back' || p.state === 'queue') {
      p.state = 'flee';
      p.t = SETTINGS.fleeTime;
      p.dir = Math.random() < 0.5 ? -1 : 1;
      n++;
    }
  });
  if (g.sensor) g.sensor.setValue(0);
  if (n === 0) return;
  STATS.scared += n;
  STATE.score = Math.max(0, STATE.score - DIFFICULTY.scarePenalty);
  playSound(soundScare, 0.6);
  addFloater(g.x, g.y - 140, TEXTS.scared[g.kind] + ' −' + DIFFICULTY.scarePenalty, PAL.warn);
}

function floodGroup(g) {
  g.flooded = true;
  const n = g.people.length;
  g.people.forEach((p) => {
    if (swimmers.length < SETTINGS.maxSwimmers) swimmers.push({ x: p.x, kind: p.kind, t: 6, dir: Math.random() < 0.5 ? -1 : 1, phase: p.phase });
  });
  g.people = [];
  STATS.lost += n;
  STATE.levelLost += n;
  playSound(soundSplash, 0.7);
  addFloater(g.x, g.y - 150, TEXTS.flooded[g.kind], PAL.water);
}

function board(p, g) {
  if (heli.cargo.length >= SETTINGS.capacity) {
    p.state = 'queue';
    if (!heli.fullShown) {
      heli.fullShown = true;
      addFloater(heli.x, heli.y - 110, 'VOLL! Zur Basis!', PAL.warn);
    }
    return;
  }
  g.people = g.people.filter((q) => q !== p);
  heli.cargo.push({ kind: p.kind, g });
  STATE.score += DIFFICULTY.pointsBoard;
  playSound(soundBoard, 0.4);
  addParticles(p.x, p.y - 30, 6, PAL.good, 120, 0, 40);
}

function updateGroups(grid, dt) {
  const scareKey = keyEdge('Digit0');
  const door = heli.x - heli.facing * 10;
  let nearest = null;
  groups.forEach((g) => {
    if (g.people.length === 0) return;
    if (!g.flooded && STATE.water <= g.y + 1) {
      floodGroup(g);
      return;
    }
    if (!g.warned && STATE.water - g.y < 35) {
      g.warned = true;
      addFloater(g.x, g.y - 150, 'Nasse Füße!', PAL.water);
    }
    const hx = sx(g.x);
    const visible = hx > -SETTINGS.plateauHalf && hx < W + SETTINGS.plateauHalf;
    if (visible) {
      ensureSensor(g);
      g.sensor.setX(hx);
      g.sensor.setY(g.y - 40);
      g.sensor.handle(grid, dt);
      if (!nearest || Math.abs(g.x - heli.x) < Math.abs(nearest.x - heli.x)) nearest = g;
    }
    // Hilferufe
    g.bubbleT -= dt;
    if (g.bubbleT <= 0) {
      g.bubbleT = rand(3, 6);
      g.bubble = pick(TEXTS.help[g.kind]);
      g.sayT = 1.6;
    }
    g.sayT = Math.max(0, g.sayT - dt);

    const near = heliOnPlateau(g);
    g.people.slice().forEach((p) => {
      p.phase += dt * 6;
      p.y = surfaceAt(p.x);
      const sp = runSpeed(p.kind);
      if (p.state === 'flat') {
        p.t -= dt;
        if (p.t <= 0) {
          p.state = 'flee';
          p.t = 1.4;
          p.dir = p.x < heli.x ? -1 : 1;
        }
        return;
      }
      if (p.state === 'flee') {
        p.t -= dt;
        p.x += p.dir * sp * 1.25 * dt;
        const lim = SETTINGS.plateauHalf + 10;
        if (p.x < g.x - lim) {
          p.x = g.x - lim;
          p.dir = 1;
        }
        if (p.x > g.x + lim) {
          p.x = g.x + lim;
          p.dir = -1;
        }
        if (p.t <= 0) p.state = 'back';
        return;
      }
      if (near) {
        if (p.state === 'wait' || p.state === 'back') p.state = 'run';
      } else if (p.state === 'run' || p.state === 'queue') {
        p.state = 'back';
      }
      if (p.state === 'run') {
        const d = door - p.x;
        p.dir = d > 0 ? 1 : -1;
        p.x += clamp(d, -sp * dt, sp * dt);
        if (Math.abs(d) < 16) board(p, g);
      } else if (p.state === 'back') {
        const d = p.slot - p.x;
        p.dir = d > 0 ? 1 : -1;
        p.x += clamp(d, -sp * 0.8 * dt, sp * 0.8 * dt);
        if (Math.abs(d) < 3) p.state = 'wait';
      }
    });
  });
  if (scareKey && nearest) scareGroup(nearest);
}

function updateBase(dt) {
  const atBase = heli.landed && !heli.crashed && heli.x < BASE.x1 - 30;
  if (!atBase) return;
  heli.fuel = Math.min(SETTINGS.fuelMax, heli.fuel + SETTINGS.refuelRate * dt);
  if (heli.cargo.length === 0) return;
  heli.unloadT += dt;
  if (heli.unloadT < SETTINGS.unloadInterval) return;
  heli.unloadT = 0;
  const c = heli.cargo.shift();
  const pts = DIFFICULTY.pointsRescue + (STATE.level - 1) * DIFFICULTY.pointsRescuePerLevel;
  STATE.score += pts;
  STATS.rescued++;
  STATE.levelRescued++;
  if (walkers.length < SETTINGS.maxWalkers) walkers.push({ x: heli.x - 30, kind: c.kind, phase: rand(0, 6) });
  addFloater(heli.x, heli.y - 120 - (heli.cargo.length % 3) * 10, '+' + pts, PAL.good);
  if (heli.cargo.length === 0) {
    STATS.flights++;
    playSound(soundDeliver, 0.7);
    if (heli.landFull) {
      STATS.fullLoads++;
      STATE.score += DIFFICULTY.fullLoadBonus;
      addFloater(heli.x, heli.y - 200, 'Volle Ladung! +' + DIFFICULTY.fullLoadBonus, PAL.title);
      addParticles(heli.x, heli.y - 60, 40, PAL.good, 300, 200, 100);
    }
    heli.landFull = false;
  } else {
    playSound(soundBoard, 0.3);
  }
}

// ---------------------------------------------------------------------------------------------------------
// Gefahren
// ---------------------------------------------------------------------------------------------------------

function makeStation(radius, speedUp, onEnter) {
  return guiPixelFillButton({
    label: '',
    posX: -500,
    posY: -500,
    radius,
    speedUp,
    speedDown: 60,
    fullPercent: 25,
    activeValue: 75,
    visible: false,
    onEnterActive: onEnter,
  });
}

function spawnGull() {
  const side = Math.random() < 0.5 ? -1 : 1;
  const speed = lvlValue(DIFFICULTY.gullSpeedStart, DIFFICULTY.gullSpeedPerLevel, DIFFICULTY.gullSpeedMax);
  hazards.push({
    type: 'gull',
    x: side < 0 ? STATE.camX - 120 : STATE.camX + W + 120,
    y: rand(170, 520),
    vx: -side * speed * rand(0.85, 1.15),
    vy: 0,
    t: 0,
    station: null,
    dead: false,
  });
}

function spawnLava() {
  hazards.push({
    type: 'lava',
    x: clamp(heli.x + rand(-750, 750), 100, WORLD_W - 100),
    y: HUD_H + 26,
    vx: rand(-40, 40),
    vy: lvlValue(DIFFICULTY.lavaSpeedStart, DIFFICULTY.lavaSpeedPerLevel, DIFFICULTY.lavaSpeedMax),
    warn: 0.9,
    rot: rand(0, 6),
    t: 0,
    station: null,
    dead: false,
  });
}

function spawnCloud() {
  hazards.push({
    type: 'cloud',
    x: clamp(heli.x + rand(-450, 450), 200, WORLD_W - 200),
    y: rand(170, 240),
    charge: 0,
    struck: false,
    strikeT: 0,
    path: null,
    t: 0,
    station: null,
    dead: false,
  });
}

function hazardRadius(h) {
  return h.type === 'cloud' ? SETTINGS.cloudRadius : h.type === 'lava' ? SETTINGS.lavaRadius : SETTINGS.gullRadius;
}

function ensureHazardStation(h) {
  if (h.station) return;
  h.station = makeStation(hazardRadius(h), h.type === 'cloud' ? 110 : 180, () => popHazard(h));
}

function removeHazard(h) {
  h.dead = true;
  hazards = hazards.filter((o) => o !== h);
}

function popHazard(h) {
  if (h.dead || h.struck) return;
  removeHazard(h);
  playSound(soundPlop, 0.6);
  if (h.type === 'gull') {
    STATS.gullsShooed++;
    STATE.score += DIFFICULTY.popPoints;
    addParticles(h.x, h.y, 22, PAL.feather, 200, 120, 60);
    addFloater(h.x, h.y - 50, 'Kreisch! +' + DIFFICULTY.popPoints, PAL.good);
  } else if (h.type === 'lava') {
    STATS.lavaPopped++;
    STATE.score += DIFFICULTY.popPoints;
    addParticles(h.x, h.y, 30, PAL.lava, 280, 300, 80);
    addFloater(h.x, h.y - 50, 'Zerplatzt! +' + DIFFICULTY.popPoints, PAL.good);
  } else {
    STATS.boltsDefused++;
    STATE.score += DIFFICULTY.boltPoints;
    for (let i = 0; i < 26 && particles.length < SETTINGS.maxParticles; i++) {
      particles.push({ x: h.x + rand(-80, 80), y: h.y + 30, vx: 0, vy: rand(250, 420), g: 0, life: 1.2, max: 1.2, color: PAL.rain, size: 4 });
    }
    addFloater(h.x, h.y - 60, 'Entladen! +' + DIFFICULTY.boltPoints, PAL.good);
  }
}

function hitHeliBy(h) {
  removeHazard(h);
  if (h.type === 'gull') {
    addParticles(h.x, h.y, 26, PAL.feather, 260, 150, 60);
    playSound(soundHit, 0.7);
    if (loseLife('Möwe im Rotor!')) STATS.hits++;
  } else {
    addParticles(h.x, h.y, 30, PAL.lava, 300, 300, 80);
    playSound(soundBoom, 0.7);
    if (loseLife('Heiß! Heiß! Heiß!')) STATS.hits++;
  }
}

function strike(h) {
  h.struck = true;
  h.strikeT = 0.45;
  const ground = surfaceAt(h.x);
  h.path = [];
  let y = h.y + 30;
  let x = h.x;
  while (y < ground) {
    h.path.push(x, y);
    y += rand(30, 60);
    x = h.x + rand(-28, 28);
  }
  h.path.push(h.x, ground);
  STATE.flash = Math.max(STATE.flash, 0.35);
  playSound(soundZap, 0.6);
  if (!heli.crashed && Math.abs(heli.x - h.x) < 100 && heli.y > h.y) {
    if (loseLife('Zzzapp! Blitz!')) STATS.hits++;
  }
  // Wartende darunter: Frisur ruiniert, sie laufen kurz weg
  groups.forEach((g) => {
    g.people.forEach((p) => {
      if (Math.abs(p.x - h.x) < 70 && p.state !== 'flat') {
        p.state = 'flee';
        p.t = 1.5;
        p.dir = p.x < h.x ? -1 : 1;
      }
    });
  });
  addParticles(h.x, ground, 20, PAL.bolt, 260, 300, 120);
}

function updateHazards(grid, dt) {
  const def = STATE.def;
  const maxH = Math.min(DIFFICULTY.maxHazardsCap, DIFFICULTY.maxHazardsStart + STATE.level);
  if (def.gulls) {
    STATE.gullT -= dt;
    if (STATE.gullT <= 0) {
      STATE.gullT = lvlValue(DIFFICULTY.gullIntervalStart, DIFFICULTY.gullIntervalPerLevel, DIFFICULTY.gullIntervalMin) * rand(0.7, 1.3);
      if (hazards.length < maxH) spawnGull();
    }
  }
  if (def.lava) {
    STATE.lavaT -= dt;
    if (STATE.lavaT <= 0) {
      STATE.lavaT = lvlValue(DIFFICULTY.lavaIntervalStart, DIFFICULTY.lavaIntervalPerLevel, DIFFICULTY.lavaIntervalMin) * rand(0.7, 1.3);
      if (hazards.length < maxH) spawnLava();
    }
  }
  if (def.bolts) {
    STATE.boltT -= dt;
    if (STATE.boltT <= 0) {
      STATE.boltT = lvlValue(DIFFICULTY.boltIntervalStart, DIFFICULTY.boltIntervalPerLevel, DIFFICULTY.boltIntervalMin) * rand(0.8, 1.2);
      if (hazards.length < maxH) spawnCloud();
    }
  }

  const popAll = keyEdge('Digit1');
  const charge = lvlValue(DIFFICULTY.boltChargeStart, DIFFICULTY.boltChargePerLevel, DIFFICULTY.boltChargeMin);
  hazards.slice().forEach((h) => {
    if (h.dead) return;
    h.t += dt;
    if (h.type === 'gull') {
      h.x += (h.vx + STATE.wind * 0.4) * dt;
      const homing = Math.min(0.45, 0.12 + STATE.level * 0.06); // L1 kaum, später zielstrebiger
      h.vy = approach(h.vy, clamp((heli.y - h.y) * homing, -70, 70), 1, dt);
      h.y = clamp(h.y + h.vy * dt, HUD_H + 60, VIEW_BOTTOM - 120);
      if ((h.vx > 0 && sx(h.x) > W + 300) || (h.vx < 0 && sx(h.x) < -300)) {
        removeHazard(h);
        return;
      }
    } else if (h.type === 'lava') {
      if (h.warn > 0) h.warn -= dt;
      else {
        h.vy += 40 * dt;
        h.x += (h.vx + STATE.wind * 0.3) * dt;
        h.y += h.vy * dt;
        h.rot += dt * 2.5;
        if (Math.random() < dt * 12) addParticles(h.x, h.y - 20, 1, PAL.fire, 40, -40, 40);
        const surf = surfaceAt(h.x);
        if (h.y >= surf - 12) {
          const water = isWaterAt(h.x);
          addParticles(h.x, surf, 18, water ? PAL.water : PAL.lava, 220, 400, 160);
          if (water && Math.random() < 0.5) addFloater(h.x, surf - 60, 'Zisch!', PAL.water);
          groups.forEach((g) => {
            g.people.forEach((p) => {
              if (Math.abs(p.x - h.x) < 70 && p.state !== 'flat') {
                p.state = 'flee';
                p.t = 1.6;
                p.dir = p.x < h.x ? -1 : 1;
              }
            });
          });
          removeHazard(h);
          return;
        }
      }
    } else if (h.type === 'cloud') {
      h.x += STATE.wind * 0.3 * dt;
      if (h.struck) {
        h.strikeT -= dt;
        if (h.strikeT <= 0) removeHazard(h);
        return;
      }
      h.charge += dt;
      if (h.charge >= charge) {
        strike(h);
        return;
      }
    }
    const hx = sx(h.x);
    if (hx < -600 || hx > W + 600) {
      removeHazard(h);
      return;
    }
    if (hx > -100 && hx < W + 100 && h.y < VIEW_BOTTOM) {
      ensureHazardStation(h);
      h.station.setX(hx);
      h.station.setY(h.y);
      h.station.handle(grid, dt);
      if (popAll) popHazard(h);
    }
    if (h.dead) return;
    if (h.type !== 'cloud' && !heli.crashed) {
      const dx = h.x - heli.x;
      const dy = h.y - heli.y;
      if (dx * dx + dy * dy < SETTINGS.hitDistance * SETTINGS.hitDistance) hitHeliBy(h);
    }
  });
}

// ---------------------------------------------------------------------------------------------------------
// Welt-Update
// ---------------------------------------------------------------------------------------------------------

function updateWind(dt) {
  const base = STATE.def.wind || 0;
  if (base <= 0) {
    STATE.wind = 0;
    return;
  }
  STATE.gustT -= dt;
  if (STATE.gustT <= 0) {
    STATE.gustT = rand(5, 10);
    STATE.gust = (Math.random() < 0.5 ? -1 : 1) * base * rand(1, 1.8);
  }
  STATE.gust = approach(STATE.gust, 0, 0.5, dt);
  STATE.wind = base * 0.6 * Math.sin(STATE.time * 0.21) + STATE.gust;
}

function updateParticles(dt) {
  particles = particles.filter((p) => {
    p.x += p.vx * dt;
    p.y += p.vy * dt;
    p.vy += p.g * dt;
    p.life -= dt;
    return p.life > 0;
  });
  floaters = floaters.filter((f) => {
    f.y -= 45 * dt;
    f.life -= dt;
    return f.life > 0;
  });
  swimmers = swimmers.filter((s) => {
    s.x += s.dir * 30 * dt;
    s.t -= dt;
    s.phase += dt * 3;
    return s.t > 0;
  });
  walkers = walkers.filter((w) => {
    w.x -= 110 * dt;
    w.phase += dt * 7;
    return w.x > 150;
  });
}

function updateCamera(dt) {
  const target = clamp(heli.x - W / 2 + heli.vx * 0.5, 0, WORLD_W - W);
  STATE.camX = approach(STATE.camX, target, 3, dt);
}

// ---------------------------------------------------------------------------------------------------------
// Szenen-Steuerung
// ---------------------------------------------------------------------------------------------------------

function resetRun() {
  particles = [];
  floaters = [];
  STATE.level = 1;
  STATE.score = 0;
  STATE.shake = 0;
  STATE.flash = 0;
  STATE.newHighscore = false;
  STATE.endReason = '';
  STATE.msg = '';
  STATE.msgT = 0;
  Object.keys(STATS).forEach((k) => (STATS[k] = 0));
  heli.lives = SETTINGS.startLives;
  heli.invul = 0;
  generateLevel(1);
  againButton = null;
}

function resetAll() {
  stopMusic();
  turret = null;
  resetRun();
  startButton = null;
  keyEdge = createKeyEdge();
  setScene('title');
}

function startGame() {
  resetRun();
  setScene('game');
  showMessage(STATE.def.title, 3.5);
  stopMusic();
  playSound(soundJingle, 0.7);
  music = playSound(soundMusic, 0.3);
  if (music) music.loop = true;
}

function endGame(reason) {
  if (STATE.scene === 'gameover') return;
  STATE.endReason = reason;
  stopMusic();
  playSound(soundGameOver, 0.8);
  highscore.addEntry({
    punkte: Math.round(STATE.score),
    gerettet: STATS.rescued,
    level: STATE.level,
    verloren: STATS.lost,
    bruchlandungen: STATS.hardLandings,
  });
  STATE.newHighscore = highscore.lastEntryNewHighscore();
  againButton = null;
  setScene('gameover');
}

function levelComplete() {
  const bonus = DIFFICULTY.levelBonus * STATE.level + (STATE.levelLost === 0 ? DIFFICULTY.noLossBonus : 0);
  STATE.score += bonus;
  STATE.lastBonus = bonus;
  STATE.lastPerfect = STATE.levelLost === 0;
  STATE.level++;
  heli.lives = Math.min(SETTINGS.maxLives, heli.lives + 1);
  STATE.flash = 0.8;
  playSound(soundLevelUp, 0.8);
  generateLevel(STATE.level);
  setScene('levelup');
}

function remainingPeople() {
  let n = 0;
  groups.forEach((g) => (n += g.people.length));
  return n;
}

function nextWaitingGroup() {
  let best = null;
  groups.forEach((g) => {
    if (g.people.length === 0) return;
    if (!best || Math.abs(g.x - heli.x) < Math.abs(best.x - heli.x)) best = g;
  });
  return best;
}

// ---------------------------------------------------------------------------------------------------------
// Vorrendern: Gebirge (Parallax) und Vordergrund
// ---------------------------------------------------------------------------------------------------------

function makeCanvas(w, h) {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  return c;
}

function buildMountainLayer(factor, baseY, amp, fill, line, volcano) {
  const w = Math.ceil((WORLD_W - W) * factor + W);
  const c = makeCanvas(w, VIEW_BOTTOM);
  const g = c.getContext('2d');
  const n = 256;
  const h = midpoint(n, baseY + rand(-60, 60), baseY + rand(-60, 60), amp, 0.55);
  let vx = -1;
  if (volcano) {
    vx = w * 0.62;
    for (let i = 0; i <= n; i++) {
      const x = (i / n) * w;
      const d = Math.abs(x - vx);
      const cone = 250 + d * 0.62 - (d < 60 ? (60 - d) * 0.5 : 0); // Krater-Delle
      h[i] = Math.min(h[i], cone);
    }
  }
  const grad = g.createLinearGradient(0, baseY - amp, 0, VIEW_BOTTOM);
  grad.addColorStop(0, fill);
  grad.addColorStop(1, '#000000');
  g.beginPath();
  g.moveTo(0, VIEW_BOTTOM);
  for (let i = 0; i <= n; i++) g.lineTo((i / n) * w, h[i]);
  g.lineTo(w, VIEW_BOTTOM);
  g.closePath();
  g.fillStyle = grad;
  g.fill();
  g.strokeStyle = line;
  g.lineWidth = 2;
  g.beginPath();
  for (let i = 0; i <= n; i++) {
    if (i === 0) g.moveTo(0, h[0]);
    else g.lineTo((i / n) * w, h[i]);
  }
  g.stroke();
  // Schnee-/Grat-Striche an den höchsten Stellen
  g.strokeStyle = PAL.snow;
  g.lineWidth = 1.5;
  g.globalAlpha = 0.5;
  for (let i = 1; i < n; i++) {
    if (h[i] < h[i - 1] && h[i] < h[i + 1] && h[i] < baseY - amp * 0.2) {
      const x = (i / n) * w;
      g.beginPath();
      g.moveTo(x - 30, h[i] + 26);
      g.lineTo(x, h[i] + 4);
      g.lineTo(x + 30, h[i] + 26);
      g.stroke();
    }
  }
  g.globalAlpha = 1;
  return { canvas: c, factor, volcanoX: vx };
}

function buildGroundLayer() {
  const c = makeCanvas(WORLD_W, VIEW_BOTTOM);
  const g = c.getContext('2d');
  g.beginPath();
  g.moveTo(0, VIEW_BOTTOM);
  for (let i = 0; i <= SEGS; i++) g.lineTo(i * SEG_W, terrain[i]);
  g.lineTo(WORLD_W, VIEW_BOTTOM);
  g.closePath();
  g.fillStyle = '#000000';
  g.fill();
  g.strokeStyle = PAL.ground;
  g.lineWidth = 4;
  g.beginPath();
  for (let i = 0; i <= SEGS; i++) {
    if (i === 0) g.moveTo(0, terrain[0]);
    else g.lineTo(i * SEG_W, terrain[i]);
  }
  g.stroke();
  // zweite, gedimmte Schichtlinie + Grasbüschel + Steine
  g.strokeStyle = PAL.groundDim;
  g.lineWidth = 2;
  g.beginPath();
  for (let i = 0; i <= SEGS; i++) {
    if (i === 0) g.moveTo(0, terrain[0] + 22);
    else g.lineTo(i * SEG_W, terrain[i] + 22);
  }
  g.stroke();
  for (let x = 20; x < WORLD_W; x += rand(30, 70)) {
    const y = terrainAt(x);
    g.beginPath();
    g.moveTo(x - 6, y);
    g.lineTo(x - 9, y - 10);
    g.moveTo(x, y);
    g.lineTo(x, y - 13);
    g.moveTo(x + 6, y);
    g.lineTo(x + 9, y - 10);
    g.stroke();
    if (Math.random() < 0.35) {
      g.beginPath();
      g.ellipse(x + rand(-20, 20), y + rand(35, 90), rand(6, 14), rand(4, 8), 0, 0, Math.PI * 2);
      g.stroke();
    }
  }
  return c;
}

function ensureLayers() {
  const key = palKey + '|' + (STATE.def.volcano ? 'v' : '-');
  if (layerKey !== key || !farLayer || !nearLayer) {
    layerKey = key;
    farLayer = buildMountainLayer(0.3, 420, 230, PAL.farFill, PAL.farLine, STATE.def.volcano);
    nearLayer = buildMountainLayer(0.6, 560, 170, PAL.nearFill, PAL.nearLine, false);
  }
  if (!groundLayer) groundLayer = buildGroundLayer();
}

// ---------------------------------------------------------------------------------------------------------
// Zeichnen
// ---------------------------------------------------------------------------------------------------------

function drawLayer(ctx, layer, alpha) {
  const srcX = Math.max(0, Math.min(layer.canvas.width - W, STATE.camX * layer.factor));
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.drawImage(layer.canvas, srcX, 0, W, VIEW_BOTTOM, 0, 0, W, VIEW_BOTTOM);
  ctx.restore();
  return srcX;
}

function renderSky(ctx) {
  const night = STATE.def.night;
  ctx.save();
  ctx.fillStyle = PAL.star;
  stars.forEach((s) => {
    const tw = 0.5 + 0.5 * Math.sin(STATE.time * 2 + s.p);
    ctx.globalAlpha = (night ? 0.7 : 0.25) * tw;
    const x = (((s.x - STATE.camX * 0.08) % W) + W) % W;
    ctx.fillRect(x, s.y, s.s, s.s);
  });
  ctx.restore();
}

function renderBackground(ctx) {
  const night = STATE.def.night;
  renderSky(ctx);
  const farX = drawLayer(ctx, farLayer, night ? 0.35 : 1);
  if (farLayer.volcanoX >= 0) {
    // Vulkan: glühender Krater + Rauch
    const vx = farLayer.volcanoX - farX;
    if (vx > -200 && vx < W + 200) {
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      const pulse = 0.5 + 0.5 * Math.sin(STATE.time * 3);
      ctx.globalAlpha = 0.25 + pulse * 0.2;
      ctx.fillStyle = PAL.lava;
      ctx.beginPath();
      ctx.ellipse(vx, 258, 46, 12, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.globalAlpha = 0.18;
      ctx.strokeStyle = PAL.hudDim;
      ctx.lineWidth = 3;
      for (let i = 0; i < 6; i++) {
        const k = (STATE.time * 0.25 + i / 6) % 1;
        ctx.beginPath();
        ctx.arc(vx + Math.sin(k * 6 + i) * 30 + k * 80, 240 - k * 160, 18 + k * 50, 0, Math.PI * 2);
        ctx.stroke();
      }
      ctx.restore();
    }
  }
  drawLayer(ctx, nearLayer, night ? 0.35 : 1);
}

function renderWater(ctx) {
  const wy = STATE.water;
  ctx.save();
  ctx.globalAlpha = 0.85;
  ctx.fillStyle = PAL.waterDim;
  ctx.fillRect(0, wy, W, VIEW_BOTTOM - wy);
  ctx.globalAlpha = 1;
  ctx.strokeStyle = PAL.water;
  ctx.lineWidth = 3;
  for (let row = 0; row < 3; row++) {
    ctx.globalAlpha = 0.8 - row * 0.25;
    ctx.beginPath();
    for (let x = 0; x <= W; x += 24) {
      const wx = x + STATE.camX;
      const y = wy + row * 22 + Math.sin(wx * 0.02 + STATE.time * (2 + row) + row) * (4 - row);
      if (x === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.stroke();
  }
  ctx.restore();
}

function renderGround(ctx) {
  ctx.drawImage(groundLayer, STATE.camX, 0, W, VIEW_BOTTOM, 0, 0, W, VIEW_BOTTOM);
}

function renderBase(ctx) {
  const bx = sx(0);
  if (bx < -BASE.x1) return;
  const gy = BASE.y;
  ctx.save();
  ctx.lineWidth = 4;
  ctx.strokeStyle = PAL.base;
  ctx.fillStyle = '#000000';
  // Hangar
  ctx.beginPath();
  ctx.moveTo(bx + 40, gy);
  ctx.lineTo(bx + 40, gy - 110);
  ctx.quadraticCurveTo(bx + 140, gy - 190, bx + 240, gy - 110);
  ctx.lineTo(bx + 240, gy);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
  ctx.strokeRect(bx + 90, gy - 90, 100, 90);
  util.renderText({ ctx, text: 'BASIS', x: bx + 140, y: gy - 112, fontSize: '30px', fillStyle: PAL.base });
  // Landeplatz
  const px = sx(BASE.pad);
  ctx.beginPath();
  ctx.ellipse(px, gy + 2, 120, 16, 0, 0, Math.PI * 2);
  ctx.stroke();
  util.renderText({ ctx, text: 'H', x: px, y: gy + 12, fontSize: '30px', fillStyle: PAL.base });
  // Tank
  ctx.strokeRect(bx + 520, gy - 70, 50, 70);
  ctx.beginPath();
  ctx.arc(bx + 545, gy - 70, 25, Math.PI, Math.PI * 2);
  ctx.stroke();
  // Windsack
  const wdir = STATE.wind === 0 ? 0.15 : clamp(STATE.wind / 80, -1, 1);
  ctx.beginPath();
  ctx.moveTo(bx + 600, gy);
  ctx.lineTo(bx + 600, gy - 120);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(bx + 600, gy - 120);
  ctx.lineTo(bx + 600 + wdir * 60, gy - 116 + (1 - Math.abs(wdir)) * 30 + Math.sin(STATE.time * 8) * 3);
  ctx.lineTo(bx + 600, gy - 100);
  ctx.stroke();
  ctx.restore();
  walkers.forEach((w) => renderPerson(ctx, w.kind, sx(w.x), gy, w.phase, 'run', -1, 1));
}

function renderPerson(ctx, kind, x, y, phase, state, dir, alpha) {
  ctx.save();
  ctx.globalAlpha = alpha === undefined ? 1 : alpha;
  ctx.translate(x, y);
  ctx.scale(1.3, 1.3);
  if (state === 'flat') ctx.scale(1.5, 0.25);
  const run = state === 'run' || state === 'flee' || state === 'back';
  ctx.translate(0, run ? -Math.abs(Math.sin(phase * 2)) * 5 : 0);
  ctx.lineWidth = 3;
  ctx.lineCap = 'round';
  ctx.fillStyle = '#000000';
  const leg = run ? Math.sin(phase * 2) * 5 : 0;
  if (kind === 'schaf') {
    ctx.strokeStyle = PAL.sheepFace;
    ctx.beginPath();
    ctx.moveTo(-11, -10);
    ctx.lineTo(-11 + leg, 0);
    ctx.moveTo(-4, -10);
    ctx.lineTo(-4 - leg, 0);
    ctx.moveTo(5, -10);
    ctx.lineTo(5 + leg, 0);
    ctx.moveTo(12, -10);
    ctx.lineTo(12 - leg, 0);
    ctx.stroke();
    ctx.strokeStyle = PAL.sheep;
    const puffs = [-11, -21, 10, 0, -26, 11, 11, -21, 10, 0, -15, 10];
    for (let i = 0; i < puffs.length; i += 3) {
      ctx.beginPath();
      ctx.arc(puffs[i], puffs[i + 1], puffs[i + 2], 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
    }
    ctx.strokeStyle = PAL.sheepFace;
    ctx.beginPath();
    ctx.ellipse(dir * 21, -24, 7, 9, dir * 0.4, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
  } else if (kind === 'tourist') {
    ctx.strokeStyle = PAL.tourist;
    ctx.beginPath();
    ctx.moveTo(0, -16);
    ctx.lineTo(-7 + leg, 0);
    ctx.moveTo(0, -16);
    ctx.lineTo(7 - leg, 0);
    ctx.moveTo(0, -16);
    ctx.lineTo(0, -36);
    const wave = state === 'wait' ? Math.sin(phase * 1.5) * 9 : 0;
    ctx.moveTo(0, -31);
    ctx.lineTo(-13, -22);
    ctx.moveTo(0, -31);
    ctx.lineTo(13, -46 + wave);
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(0, -44, 8, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    ctx.strokeStyle = PAL.hat;
    ctx.beginPath();
    ctx.moveTo(-13, -50);
    ctx.lineTo(13, -50);
    ctx.stroke();
    ctx.strokeRect(-7, -58, 14, 8);
    ctx.strokeRect(dir * 3 - 4, -30, 8, 6); // Kamera
  } else {
    ctx.strokeStyle = PAL.penguin;
    const flap = Math.sin(phase * (run ? 4 : 1.5)) * 6;
    ctx.beginPath();
    ctx.moveTo(-11, -26);
    ctx.lineTo(-20, -12 + flap);
    ctx.moveTo(11, -26);
    ctx.lineTo(20, -12 - flap);
    ctx.stroke();
    ctx.beginPath();
    ctx.ellipse(0, -22, 13, 22, run ? Math.sin(phase * 2) * 0.15 : 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    ctx.strokeStyle = PAL.penguinBelly;
    ctx.beginPath();
    ctx.ellipse(dir * 3, -18, 7, 14, 0, 0, Math.PI * 2);
    ctx.stroke();
    ctx.strokeStyle = PAL.beak;
    ctx.beginPath();
    ctx.moveTo(dir * 10, -36);
    ctx.lineTo(dir * 19, -33);
    ctx.lineTo(dir * 10, -30);
    ctx.moveTo(-6, 0);
    ctx.lineTo(-1, 0);
    ctx.moveTo(2, 0);
    ctx.lineTo(7, 0);
    ctx.stroke();
  }
  ctx.restore();
  if (state === 'flat') {
    // Sternchen über dem Pfannkuchen
    ctx.save();
    ctx.strokeStyle = PAL.title;
    ctx.lineWidth = 2;
    for (let i = 0; i < 3; i++) {
      const a = phase * 1.5 + (i * Math.PI * 2) / 3;
      const px = x + Math.cos(a) * 24;
      const py = y - 22 + Math.sin(a) * 7;
      ctx.beginPath();
      ctx.moveTo(px - 5, py);
      ctx.lineTo(px + 5, py);
      ctx.moveTo(px, py - 5);
      ctx.lineTo(px, py + 5);
      ctx.stroke();
    }
    ctx.restore();
  }
}

function inSearchlight(x) {
  return !heli.crashed && Math.abs(x - heli.x) < 60 + (surfaceAt(x) - heli.y) * 0.45;
}

function renderGroups(ctx) {
  const night = STATE.def.night;
  groups.forEach((g) => {
    const hx = sx(g.x);
    if (hx < -300 || hx > W + 300) return;
    if (g.people.length > 0) {
      // SOS-Fähnchen am Plateau
      const fx = hx + SETTINGS.plateauHalf - 30;
      ctx.save();
      ctx.strokeStyle = PAL.hudDim;
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(fx, g.y);
      ctx.lineTo(fx, g.y - 90);
      ctx.stroke();
      ctx.strokeStyle = PAL.warn;
      ctx.beginPath();
      const fl = Math.sin(STATE.time * 6) * 4;
      ctx.moveTo(fx, g.y - 90);
      ctx.lineTo(fx - 44, g.y - 80 + fl);
      ctx.lineTo(fx, g.y - 68);
      ctx.stroke();
      if (night && Math.sin(STATE.time * 5 + g.x) > 0.3) {
        ctx.fillStyle = PAL.warn;
        ctx.fillRect(fx - 4, g.y - 98, 8, 8);
      }
      ctx.restore();
    }
    g.people.forEach((p) => {
      const a = night && !inSearchlight(p.x) ? 0.35 : 1;
      renderPerson(ctx, p.kind, sx(p.x), p.y, p.phase, p.state, p.dir, a);
    });
    if (g.people.length > 0 && g.sayT > 0) {
      util.renderText({ ctx, text: g.bubble, x: hx, y: g.y - 100, fontSize: '36px', fillStyle: PAL.sub });
    }
    // Erschreck-Anzeige: gestrichelter Ring, je voller desto deutlicher (nur zur Warnung, sehr dunkel)
    if (g.sensor && g.people.length > 0) {
      const v = g.sensor.getValue();
      if (v > 5) {
        ctx.save();
        ctx.globalAlpha = Math.min(0.8, v / 80);
        ctx.strokeStyle = PAL.warn;
        ctx.lineWidth = 4;
        ctx.setLineDash([14, 12]);
        ctx.beginPath();
        ctx.arc(hx, g.y - 40, SETTINGS.sensorRadius, 0, Math.PI * 2);
        ctx.stroke();
        ctx.restore();
      }
    }
  });
  swimmers.forEach((s) => {
    const x = sx(s.x);
    const y = STATE.water + Math.sin(s.phase) * 4;
    ctx.save();
    ctx.globalAlpha = Math.min(1, s.t / 2);
    renderPerson(ctx, s.kind, x, y + 22, s.phase, 'wait', s.dir, 1);
    ctx.strokeStyle = PAL.hat;
    ctx.lineWidth = 5;
    ctx.beginPath();
    ctx.ellipse(x, y + 4, 26, 8, 0, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();
  });
}

function renderHeliShape(ctx, x, y, scale, facing, tilt, rotor, alpha, doorOpen) {
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.translate(x, y);
  ctx.rotate(tilt);
  ctx.scale(facing * scale, scale);
  ctx.lineJoin = 'round';
  ctx.lineCap = 'round';
  ctx.lineWidth = 4;
  ctx.fillStyle = '#000000';
  ctx.strokeStyle = PAL.heli;
  // Heckausleger
  ctx.beginPath();
  ctx.moveTo(-55, -14);
  ctx.lineTo(-165, -20);
  ctx.lineTo(-165, -6);
  ctx.lineTo(-55, 10);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
  // Leitwerk
  ctx.beginPath();
  ctx.moveTo(-150, -18);
  ctx.lineTo(-170, -52);
  ctx.lineTo(-180, -52);
  ctx.lineTo(-172, -8);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
  // Heckrotor
  ctx.save();
  ctx.translate(-172, -30);
  ctx.rotate(rotor * 1.7);
  ctx.strokeStyle = PAL.rotor;
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(-18, 0);
  ctx.lineTo(18, 0);
  ctx.moveTo(0, -18);
  ctx.lineTo(0, 18);
  ctx.stroke();
  ctx.restore();
  // Rumpf
  ctx.beginPath();
  ctx.moveTo(-60, -28);
  ctx.lineTo(25, -32);
  ctx.quadraticCurveTo(70, -30, 72, 4);
  ctx.quadraticCurveTo(68, 30, 30, 32);
  ctx.lineTo(-48, 32);
  ctx.quadraticCurveTo(-72, 20, -60, -28);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
  // Fenster
  ctx.strokeStyle = PAL.heliWin;
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(24, -26);
  ctx.quadraticCurveTo(60, -24, 63, 0);
  ctx.lineTo(24, 0);
  ctx.closePath();
  ctx.stroke();
  // Tür
  ctx.strokeStyle = PAL.heliStripe;
  if (doorOpen) {
    ctx.strokeRect(-26, -22, 34, 50);
    ctx.globalAlpha = alpha * 0.5;
    ctx.strokeRect(-60, -22, 30, 50);
    ctx.globalAlpha = alpha;
  } else {
    ctx.strokeRect(-12, -22, 30, 50);
  }
  // Streifen + Rettungsring-Emblem
  ctx.beginPath();
  ctx.moveTo(-62, 14);
  ctx.lineTo(70, 14);
  ctx.stroke();
  ctx.beginPath();
  ctx.arc(-40, -4, 11, 0, Math.PI * 2);
  ctx.stroke();
  ctx.beginPath();
  for (let i = 0; i < 4; i++) {
    const a = i * (Math.PI / 2) + Math.PI / 4;
    ctx.moveTo(-40 + Math.cos(a) * 6, -4 + Math.sin(a) * 6);
    ctx.lineTo(-40 + Math.cos(a) * 14, -4 + Math.sin(a) * 14);
  }
  ctx.stroke();
  // Kufen
  ctx.strokeStyle = PAL.heli;
  ctx.lineWidth = 4;
  ctx.beginPath();
  ctx.moveTo(-30, 32);
  ctx.lineTo(-36, HELI_FOOT);
  ctx.moveTo(30, 32);
  ctx.lineTo(36, HELI_FOOT);
  ctx.moveTo(-62, HELI_FOOT);
  ctx.lineTo(62, HELI_FOOT);
  ctx.quadraticCurveTo(76, HELI_FOOT, 78, HELI_FOOT - 8);
  ctx.stroke();
  // Mast + Hauptrotor
  ctx.beginPath();
  ctx.moveTo(0, -32);
  ctx.lineTo(0, -44);
  ctx.stroke();
  ctx.strokeStyle = PAL.rotor;
  ctx.lineWidth = 5;
  const c1 = Math.cos(rotor);
  const c2 = Math.cos(rotor + Math.PI / 2);
  ctx.beginPath();
  ctx.moveTo(-150 * c1, -46);
  ctx.lineTo(150 * c1, -46);
  ctx.moveTo(-150 * c2, -46);
  ctx.lineTo(150 * c2, -46);
  ctx.stroke();
  ctx.globalAlpha = alpha * 0.25;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.ellipse(0, -46, 150, 9, 0, 0, Math.PI * 2);
  ctx.stroke();
  ctx.restore();
}

function renderHeli(ctx) {
  const x = sx(heli.x);
  if (heli.crashed) {
    ctx.save();
    ctx.translate(x, heli.y + 20);
    ctx.rotate(0.5);
    renderHeliShape(ctx, 0, 0, 1, heli.facing, 0, 0.3, 0.6, false);
    ctx.restore();
    return;
  }
  const blink = heli.invul > 0 && Math.sin(STATE.time * 30) > 0;
  const atDoor = heli.landed && heli.x > BASE.x1 ? groups.some((g) => heliOnPlateau(g) && g.people.length > 0) : heli.landed && heli.cargo.length > 0;
  renderHeliShape(ctx, x, heli.y, 1, heli.facing, heli.tilt, heli.rotor, blink ? 0.35 : 1, atDoor);
  // Köpfe der Passagiere im Fenster
  if (heli.cargo.length > 0) {
    ctx.save();
    ctx.strokeStyle = PAL.sub;
    ctx.lineWidth = 2;
    for (let i = 0; i < Math.min(4, heli.cargo.length); i++) {
      ctx.beginPath();
      ctx.arc(x + heli.facing * (30 + i * 9), heli.y - 8 + (i % 2) * 3, 5, 0, Math.PI * 2);
      ctx.stroke();
    }
    ctx.restore();
  }
  // Sinkraten-Warnung
  if (!heli.landed && !heli.engineOut) {
    const gap = surfaceAt(heli.x) - (heli.y + HELI_FOOT);
    if (gap < 160 && heli.vy > safeLand() * 0.85) {
      util.renderText({ ctx, text: 'SINKRATE!', x, y: heli.y - 85, fontSize: '42px', fillStyle: PAL.warn });
    }
  }
  if (heli.engineOut) {
    util.renderText({ ctx, text: 'TANK LEER!', x, y: heli.y - 85, fontSize: '42px', fillStyle: PAL.warn });
  }
}

function renderMeterRing(ctx, x, y, r, value) {
  if (value <= 1) return;
  ctx.save();
  ctx.strokeStyle = PAL.meter;
  ctx.lineWidth = 6;
  ctx.beginPath();
  ctx.arc(x, y, r, -Math.PI / 2, -Math.PI / 2 + (Math.min(100, value) / 75) * Math.PI * 2);
  ctx.stroke();
  ctx.restore();
}

function renderHazards(ctx) {
  hazards.forEach((h) => {
    const x = sx(h.x);
    if (x < -200 || x > W + 200) return;
    const v = h.station ? h.station.getValue() : 0;
    ctx.save();
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    if (h.type === 'gull') {
      const flap = Math.sin(h.t * 11) * 16;
      const d = h.vx > 0 ? 1 : -1;
      ctx.strokeStyle = PAL.gull;
      ctx.lineWidth = 5;
      ctx.beginPath();
      ctx.moveTo(x - 48, h.y - 6 + flap);
      ctx.quadraticCurveTo(x - 24, h.y - 22 - flap * 0.5, x, h.y);
      ctx.quadraticCurveTo(x + 24, h.y - 22 - flap * 0.5, x + 48, h.y - 6 + flap);
      ctx.stroke();
      ctx.fillStyle = '#000000';
      ctx.beginPath();
      ctx.ellipse(x, h.y + 4, 20, 9, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
      ctx.strokeStyle = PAL.beak;
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.moveTo(x + d * 20, h.y + 2);
      ctx.lineTo(x + d * 32, h.y + 6);
      ctx.stroke();
      renderMeterRing(ctx, x, h.y, SETTINGS.gullRadius, v);
    } else if (h.type === 'lava') {
      if (h.warn > 0) {
        ctx.globalAlpha = 0.5 + 0.5 * Math.sin(STATE.time * 20);
        ctx.strokeStyle = PAL.warn;
        ctx.lineWidth = 5;
        ctx.beginPath();
        ctx.moveTo(x, HUD_H + 8);
        ctx.lineTo(x - 22, HUD_H + 46);
        ctx.lineTo(x + 22, HUD_H + 46);
        ctx.closePath();
        ctx.stroke();
        ctx.globalAlpha = 1;
      }
      ctx.save();
      ctx.translate(x, h.y);
      ctx.rotate(h.rot);
      ctx.shadowColor = PAL.lava;
      ctx.shadowBlur = 10;
      ctx.fillStyle = PAL.lavaDark;
      ctx.strokeStyle = PAL.lava;
      ctx.lineWidth = 5;
      ctx.beginPath();
      for (let i = 0; i < 9; i++) {
        const a = (i / 9) * Math.PI * 2;
        const r = 30 + (i % 3) * 6;
        if (i === 0) ctx.moveTo(Math.cos(a) * r, Math.sin(a) * r);
        else ctx.lineTo(Math.cos(a) * r, Math.sin(a) * r);
      }
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
      ctx.restore();
      renderMeterRing(ctx, x, h.y, SETTINGS.lavaRadius, v);
    } else {
      const ch = h.struck ? 1 : Math.min(1, h.charge / lvlValue(DIFFICULTY.boltChargeStart, DIFFICULTY.boltChargePerLevel, DIFFICULTY.boltChargeMin));
      // Warnsäule unter der Wolke
      if (!h.struck) {
        ctx.globalAlpha = 0.12 + ch * 0.35;
        ctx.strokeStyle = PAL.warn;
        ctx.lineWidth = 3;
        ctx.setLineDash([16, 18]);
        ctx.beginPath();
        ctx.moveTo(x - 100, h.y + 40);
        ctx.lineTo(x - 100, surfaceAt(h.x));
        ctx.moveTo(x + 100, h.y + 40);
        ctx.lineTo(x + 100, surfaceAt(h.x));
        ctx.stroke();
        ctx.setLineDash([]);
        ctx.globalAlpha = 1;
      }
      ctx.fillStyle = '#000000';
      ctx.strokeStyle = PAL.cloud;
      ctx.lineWidth = 4;
      const puffs = [-55, 10, 38, -15, -18, 48, 30, -10, 44, 62, 12, 34, 0, 20, 40];
      for (let i = 0; i < puffs.length; i += 3) {
        ctx.beginPath();
        ctx.arc(x + puffs[i], h.y + puffs[i + 1], puffs[i + 2], 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
      }
      if (!h.struck && Math.random() < ch * 0.5) {
        ctx.strokeStyle = PAL.bolt;
        ctx.lineWidth = 3;
        ctx.beginPath();
        const bx = x + rand(-40, 40);
        ctx.moveTo(bx, h.y);
        ctx.lineTo(bx + rand(-15, 15), h.y + 20);
        ctx.lineTo(bx + rand(-15, 15), h.y + 38);
        ctx.stroke();
      }
      if (h.struck && h.path) {
        ctx.globalCompositeOperation = 'lighter';
        ctx.strokeStyle = PAL.bolt;
        ctx.shadowColor = PAL.bolt;
        ctx.shadowBlur = 25;
        ctx.lineWidth = 8;
        ctx.beginPath();
        for (let i = 0; i < h.path.length; i += 2) {
          if (i === 0) ctx.moveTo(sx(h.path[i]), h.path[i + 1]);
          else ctx.lineTo(sx(h.path[i]), h.path[i + 1]);
        }
        ctx.stroke();
      }
      renderMeterRing(ctx, x, h.y, SETTINGS.cloudRadius, v);
    }
    ctx.restore();
  });
}

function renderRain(ctx) {
  if (!STATE.def.bolts) return;
  ctx.save();
  ctx.strokeStyle = PAL.rain;
  ctx.globalAlpha = 0.35;
  ctx.lineWidth = 2;
  const slant = clamp(STATE.wind * 0.15, -20, 20) - 6;
  ctx.beginPath();
  for (let i = 0; i < 70; i++) {
    const x = (i * 173 + STATE.time * 60 - STATE.camX * 0.9) % W;
    const xx = x < 0 ? x + W : x;
    const y = HUD_H + ((i * 97 + STATE.time * 700) % (VIEW_BOTTOM - HUD_H));
    ctx.moveTo(xx, y);
    ctx.lineTo(xx + slant, y + 22);
  }
  ctx.stroke();
  ctx.restore();
}

function renderNight(ctx) {
  if (!STATE.def.night) return;
  ctx.save();
  ctx.globalAlpha = 0.6;
  ctx.fillStyle = '#000000';
  ctx.fillRect(0, 0, W, VIEW_BOTTOM);
  ctx.restore();
  if (heli.crashed) return;
  // Suchscheinwerfer: schwacher Lichtkegel, kein Vollton (Licht-Disziplin)
  const x = sx(heli.x);
  const top = heli.y + 30;
  const gy = surfaceAt(heli.x);
  const spread = 60 + (gy - heli.y) * 0.45;
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  const grad = ctx.createLinearGradient(0, top, 0, gy);
  grad.addColorStop(0, PAL.search);
  grad.addColorStop(1, '#000000');
  ctx.globalAlpha = 0.16;
  ctx.fillStyle = grad;
  ctx.beginPath();
  ctx.moveTo(x - 14, top);
  ctx.lineTo(x + 14, top);
  ctx.lineTo(x + spread, gy);
  ctx.lineTo(x - spread, gy);
  ctx.closePath();
  ctx.fill();
  ctx.globalAlpha = 0.5;
  ctx.strokeStyle = PAL.search;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.ellipse(x, gy, spread, 10, 0, 0, Math.PI * 2);
  ctx.stroke();
  ctx.restore();
}

function renderParticles(ctx) {
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  particles.forEach((p) => {
    ctx.globalAlpha = Math.max(0, p.life / p.max);
    ctx.fillStyle = p.color;
    ctx.fillRect(sx(p.x) - p.size / 2, p.y - p.size / 2, p.size, p.size);
  });
  ctx.restore();
  floaters.forEach((f) => {
    ctx.save();
    ctx.globalAlpha = Math.min(1, f.life);
    util.renderText({ ctx, text: f.text, x: sx(f.x), y: f.y, fontSize: '44px', fillStyle: f.color });
    ctx.restore();
  });
}

function renderWorld(ctx, dt) {
  ensureLayers();
  ctx.save();
  ctx.beginPath();
  ctx.rect(0, 0, W, VIEW_BOTTOM);
  ctx.clip();
  if (STATE.shake > 0) {
    ctx.translate((Math.random() - 0.5) * STATE.shake, (Math.random() - 0.5) * STATE.shake);
    STATE.shake = Math.max(0, STATE.shake - dt * 40);
  }
  renderBackground(ctx);
  renderWater(ctx);
  renderGround(ctx);
  renderBase(ctx);
  renderNight(ctx);
  renderRain(ctx);
  renderGroups(ctx);
  renderHeli(ctx);
  renderHazards(ctx);
  renderParticles(ctx);
  ctx.restore();
}

function renderPad(ctx) {
  ctx.save();
  ctx.fillStyle = '#000000';
  ctx.fillRect(0, VIEW_BOTTOM, W, H - VIEW_BOTTOM);
  ctx.strokeStyle = PAL.pad;
  ctx.lineWidth = 3;
  ctx.strokeRect(PAD.x, PAD.y, PAD.w, PAD.h);
  ctx.beginPath();
  ctx.rect(PAD.x, PAD.y, PAD.w, PAD.h);
  ctx.clip();
  // Ausschnitt der Kamera
  ctx.strokeStyle = PAL.padDim;
  ctx.lineWidth = 2;
  ctx.setLineDash([10, 10]);
  ctx.strokeRect(worldToPadX(STATE.camX), PAD.y + 4, (W / WORLD_W) * PAD.w, PAD.h - 8);
  ctx.setLineDash([]);
  // Gelände + Wasser
  ctx.strokeStyle = PAL.padTerrain;
  ctx.lineWidth = 3;
  ctx.beginPath();
  for (let i = 0; i <= SEGS; i += 2) {
    const px = worldToPadX(i * SEG_W);
    const py = worldToPadY(Math.min(terrain[i], STATE.water));
    if (i === 0) ctx.moveTo(px, py);
    else ctx.lineTo(px, py);
  }
  ctx.stroke();
  ctx.strokeStyle = PAL.waterDim;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(PAD.x, worldToPadY(STATE.water) + 3);
  ctx.lineTo(PAD.x + PAD.w, worldToPadY(STATE.water) + 3);
  ctx.stroke();
  // Basis
  util.renderText({ ctx, text: 'H', x: worldToPadX(BASE.pad), y: worldToPadY(BASE.y) - 8, fontSize: '30px', fillStyle: PAL.base });
  // Gruppen
  groups.forEach((g) => {
    if (g.people.length === 0) return;
    const px = worldToPadX(g.x);
    const py = worldToPadY(g.y);
    ctx.strokeStyle = PAL.warn;
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(px, py - 14, 11, 0, Math.PI * 2);
    ctx.stroke();
    util.renderText({ ctx, text: String(g.people.length), x: px, y: py - 34, fontSize: '28px', fillStyle: PAL.warn });
  });
  // Gefahren
  ctx.fillStyle = PAL.lava;
  hazards.forEach((h) => {
    ctx.fillRect(worldToPadX(h.x) - 3, worldToPadY(h.y) - 3, 6, 6);
  });
  // Heli + Wegpunkt
  const hx = worldToPadX(heli.x);
  const hy = worldToPadY(heli.y);
  const tx = worldToPadX(TGT.x);
  const ty = worldToPadY(TGT.y);
  ctx.strokeStyle = PAL.padDim;
  ctx.lineWidth = 2;
  ctx.setLineDash([6, 8]);
  ctx.beginPath();
  ctx.moveTo(hx, hy);
  ctx.lineTo(tx, ty);
  ctx.stroke();
  ctx.setLineDash([]);
  const below = TGT.y > surfaceAt(TGT.x) + 50;
  ctx.strokeStyle = below ? PAL.warn : PAL.padTarget;
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.arc(tx, ty, 22, 0, Math.PI * 2);
  ctx.moveTo(tx - 34, ty);
  ctx.lineTo(tx - 12, ty);
  ctx.moveTo(tx + 12, ty);
  ctx.lineTo(tx + 34, ty);
  ctx.moveTo(tx, ty - 34);
  ctx.lineTo(tx, ty - 12);
  ctx.moveTo(tx, ty + 12);
  ctx.lineTo(tx, ty + 34);
  ctx.stroke();
  ctx.restore();
  renderHeliShape(ctx, hx, hy, 0.18, heli.facing, heli.tilt, heli.rotor, 1, false);
  // Beschriftung
  util.renderText({ ctx, text: 'LENK-KARTE: hier hinleuchten', x: PAD.x + 14, y: PAD.y + 34, fontSize: '28px', fillStyle: PAL.padDim, align: 'left' });
  if (below) util.renderText({ ctx, text: 'ZU TIEF!', x: PAD.x + PAD.w - 14, y: PAD.y + 34, fontSize: '30px', fillStyle: PAL.warn, align: 'right' });
}

function renderHud(ctx) {
  const y = 58;
  ctx.save();
  ctx.fillStyle = '#000000';
  ctx.globalAlpha = 0.7;
  ctx.fillRect(0, 0, W, HUD_H);
  ctx.restore();
  util.renderText({ ctx, text: 'Level ' + STATE.level, x: 30, y, fontSize: '44px', fillStyle: PAL.hud, align: 'left' });
  util.renderText({ ctx, text: Math.round(STATE.score) + ' Pkt', x: 300, y, fontSize: '44px', fillStyle: PAL.hud, align: 'left' });
  util.renderText({
    ctx,
    text: 'Gerettet ' + STATE.levelRescued + '/' + STATE.levelTotal,
    x: 640,
    y,
    fontSize: '44px',
    fillStyle: PAL.good,
    align: 'left',
  });
  // Ladung
  util.renderText({ ctx, text: 'Bord', x: 1000, y, fontSize: '40px', fillStyle: PAL.hudDim, align: 'left' });
  ctx.save();
  ctx.lineWidth = 3;
  for (let i = 0; i < SETTINGS.capacity; i++) {
    const bx = 1110 + i * 30;
    ctx.strokeStyle = i < heli.cargo.length ? PAL.good : PAL.hudDim;
    ctx.beginPath();
    ctx.arc(bx, 44, 11, 0, Math.PI * 2);
    ctx.stroke();
    if (i < heli.cargo.length) {
      ctx.fillStyle = PAL.good;
      ctx.beginPath();
      ctx.arc(bx, 44, 5, 0, Math.PI * 2);
      ctx.fill();
    }
  }
  // Sprit
  util.renderText({ ctx, text: 'Sprit', x: 1405, y, fontSize: '40px', fillStyle: PAL.hudDim, align: 'left' });
  const fx = 1515;
  const fw = 190;
  const f = heli.fuel / SETTINGS.fuelMax;
  const low = f < 0.25;
  ctx.strokeStyle = PAL.hudDim;
  ctx.strokeRect(fx, 26, fw, 34);
  ctx.fillStyle = low ? PAL.warn : PAL.hud;
  ctx.globalAlpha = low && Math.sin(STATE.time * 10) > 0 ? 0.4 : 0.8;
  ctx.fillRect(fx + 3, 29, (fw - 6) * clamp(f, 0, 1), 28);
  ctx.restore();
  // Leben: ein Heli-Symbol + Anzahl
  renderHeliShape(ctx, 1772, 40, 0.3, 1, 0, STATE.time * 20, 1, false);
  util.renderText({ ctx, text: '×' + Math.max(0, heli.lives), x: 1830, y, fontSize: '44px', fillStyle: heli.lives <= 1 ? PAL.warn : PAL.hud, align: 'left' });
  // Wind
  if (STATE.def.wind > 0) {
    const wv = clamp(STATE.wind / 100, -1, 1);
    ctx.save();
    ctx.strokeStyle = PAL.sub;
    ctx.lineWidth = 4;
    const cx = 960;
    ctx.beginPath();
    ctx.moveTo(cx - 60 * wv, HUD_H + 34);
    ctx.lineTo(cx + 60 * wv, HUD_H + 34);
    ctx.lineTo(cx + 60 * wv - 16 * Math.sign(wv || 1), HUD_H + 22);
    ctx.moveTo(cx + 60 * wv, HUD_H + 34);
    ctx.lineTo(cx + 60 * wv - 16 * Math.sign(wv || 1), HUD_H + 46);
    ctx.stroke();
    ctx.restore();
    util.renderText({ ctx, text: 'Wind', x: 960, y: HUD_H + 80, fontSize: '28px', fillStyle: PAL.sub });
  }
  if (STATE.msgT > 0) {
    ctx.save();
    ctx.globalAlpha = Math.min(1, STATE.msgT);
    renderTextDropShadow({ ctx, text: STATE.msg, x: W / 2, y: 190, fontSize: '64px', lineHeight: 70, fillStyle: PAL.title, dropDistX: 4, dropDistY: 4 });
    ctx.restore();
  }
}

function renderFlash(ctx, dt) {
  if (STATE.flash <= 0) return;
  ctx.save();
  ctx.globalAlpha = Math.min(0.3, STATE.flash * 0.4);
  ctx.fillStyle = PAL.flash;
  ctx.fillRect(0, 0, W, VIEW_BOTTOM);
  ctx.restore();
  STATE.flash -= dt;
}

// ---------------------------------------------------------------------------------------------------------
// Szenen
// ---------------------------------------------------------------------------------------------------------

function handleTitle(grid, dt, ctx) {
  STATE.camX = (Math.sin(STATE.time * 0.05) * 0.5 + 0.5) * (WORLD_W - W);
  ensureLayers();
  renderBackground(ctx);
  renderWater(ctx);
  renderGround(ctx);
  // Titel-Heli mit Schaf an der Strickleiter
  const hx = W / 2 + Math.sin(STATE.time * 0.45) * 620;
  const hy = 400 + Math.sin(STATE.time * 1.3) * 25;
  const face = Math.cos(STATE.time * 0.45) >= 0 ? 1 : -1;
  ctx.save();
  ctx.strokeStyle = PAL.hudDim;
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(hx, hy + HELI_FOOT);
  ctx.lineTo(hx - face * 30, hy + 130);
  ctx.stroke();
  ctx.restore();
  renderPerson(ctx, 'schaf', hx - face * 30, hy + 160, STATE.time * 5, 'run', face, 1);
  renderHeliShape(ctx, hx, hy, 1, face, face * 0.12, STATE.time * 30, 1, false);

  renderTextDropShadow({ ctx, text: 'Heli-Retter', x: W / 2, y: 210, fontSize: '150px', fillStyle: PAL.title });
  util.renderText({ ctx, text: 'Die Flut steigt. Die Schafe warten. Ihr fliegt – alle zusammen.', x: W / 2, y: 295, fontSize: '48px', fillStyle: PAL.sub });
  util.renderText({
    ctx,
    text: 'Unten auf der KARTE lenken · oben Möwen, Lava, Blitze wegleuchten\nNicht die Wartenden blenden – und SANFT landen!',
    x: W / 2,
    y: 900,
    fontSize: '36px',
    lineHeight: 52,
    fillStyle: PAL.hudDim,
  });
  if (!startButton) {
    startButton = guiFillButton({
      label: 'START',
      posX: W / 2,
      posY: 610,
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
  if (keyEdge('Space') && STATE.scene === 'title') startGame();
  highscore.renderHighAndLowScores(ctx);
}

function handleGame(grid, dt, ctx) {
  ensureTurret();
  turret.handle(grid, dt);
  STATE.msgT = Math.max(0, STATE.msgT - dt);
  updateWind(dt);
  STATE.water = Math.max(SETTINGS.waterCap, STATE.water - lvlValue(DIFFICULTY.floodRiseStart, DIFFICULTY.floodRisePerLevel, DIFFICULTY.floodRiseMax) * dt);

  // Test-Tasten
  if (keyEdge('Digit2')) {
    const g = nextWaitingGroup();
    if (g) lockTarget(g.x + (heli.x < g.x ? -110 : 110), g.y + 4);
  }
  if (keyEdge('Digit3')) lockTarget(BASE.pad, BASE.y + 4);
  if (keyEdge('Digit9')) {
    groups.forEach((g) => {
      STATS.rescued += g.people.length;
      STATE.levelRescued += g.people.length;
      g.people = [];
    });
    STATS.rescued += heli.cargo.length;
    STATE.levelRescued += heli.cargo.length;
    heli.cargo = [];
  }

  updateHeli(dt);
  if (STATE.scene !== 'game') {
    renderWorld(ctx, dt);
    renderPad(ctx);
    renderHud(ctx);
    return;
  }
  updateGroups(grid, dt);
  updateBase(dt);
  updateHazards(grid, dt);
  updateParticles(dt);
  updateCamera(dt);
  renderWorld(ctx, dt);
  renderPad(ctx);
  renderHud(ctx);
  renderFlash(ctx, dt);
  if (STATE.scene === 'game' && remainingPeople() === 0 && heli.cargo.length === 0 && !heli.crashed) levelComplete();
}

function handleLevelUp(grid, dt, ctx) {
  ensureTurret();
  turret.handle(grid, dt);
  updateParticles(dt);
  updateTarget();
  heli.rotor += dt * 16;
  STATE.camX = approach(STATE.camX, 0, 3, dt);
  renderWorld(ctx, dt);
  renderPad(ctx);
  renderHud(ctx);
  renderFlash(ctx, dt);
  const s = 1 + Math.max(0, 0.4 - STATE.sceneTime) * 1.5;
  ctx.save();
  ctx.translate(W / 2, 330);
  ctx.scale(s, s);
  renderTextDropShadow({ ctx, text: 'LEVEL ' + STATE.level, x: 0, y: 0, fontSize: '150px', fillStyle: PAL.title });
  ctx.restore();
  util.renderText({ ctx, text: STATE.def.title, x: W / 2, y: 430, fontSize: '60px', fillStyle: PAL.sub });
  util.renderText({ ctx, text: STATE.def.news, x: W / 2, y: 505, fontSize: '46px', fillStyle: PAL.hud });
  util.renderText({
    ctx,
    text: 'Level-Bonus +' + (STATE.lastBonus || 0) + (STATE.lastPerfect ? ' (niemand verloren!)' : '') + ' · +1 Ersatz-Heli',
    x: W / 2,
    y: 575,
    fontSize: '40px',
    fillStyle: PAL.good,
  });
  if (STATE.sceneTime >= SETTINGS.levelUpDuration) {
    lockTarget(BASE.pad, BASE.y + 4);
    showMessage(STATE.def.title, 3);
    setScene('game');
  }
}

function handleGameOver(grid, dt, ctx) {
  updateParticles(dt);
  ensureLayers();
  renderBackground(ctx);
  renderWater(ctx);
  renderGround(ctx);
  ctx.save();
  ctx.globalAlpha = 0.55;
  ctx.fillStyle = '#000000';
  ctx.fillRect(0, 0, W, H);
  ctx.restore();
  renderTextDropShadow({ ctx, text: 'Einsatz beendet', x: W / 2, y: 190, fontSize: '120px', fillStyle: PAL.title });
  util.renderText({ ctx, text: STATE.endReason, x: W / 2, y: 280, fontSize: '50px', fillStyle: PAL.warn });
  util.renderText({
    ctx,
    text:
      Math.round(STATE.score) + ' Punkte' + (STATE.newHighscore ? '  – NEUER HIGHSCORE!' : '') + '\n' +
      'Level ' + STATE.level + ' · ' + STATS.rescued + ' gerettet · ' + STATS.lost + ' weggeschwommen\n' +
      STATS.flights + ' Flüge (' + STATS.fullLoads + '× voll) · ' + Math.round(STATS.flightTime) + ' s in der Luft\n' +
      STATS.gullsShooed + ' Möwen · ' + STATS.lavaPopped + ' Lavabrocken · ' + STATS.boltsDefused + ' Gewitter entschärft\n' +
      STATS.hardLandings + ' Bruchlandungen · ' + STATS.squashed + ' plattgedrückt · ' + STATS.scared + '× erschreckt',
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
        posY: 870,
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
    if (keyEdge('Space') && STATE.scene === 'gameover') startGame();
  } else {
    keyEdge('Space');
  }
}

// ---------------------------------------------------------------------------------------------------------
// Export
// ---------------------------------------------------------------------------------------------------------

export default {
  name: 'Heli-Retter',
  description: `
  Hochwasser! Auf Hügeln und Gipfeln warten Schafe, Touristen und Pinguine.
  Ihr fliegt den Rettungshubschrauber – alle zusammen:

  UNTEN auf der Lenk-Karte hinleuchten = dorthin fliegt der Heli.
  Auf den Boden zeigen = landen. Die Wartenden rennen zur Tür (max. 8).
  Zurück zur Basis (links) = abliefern, Punkte, volltanken.

  OBEN Möwen, Lavabrocken und Gewitterwolken anleuchten, bis sie platzen.
  Aber: Wartende NICHT anleuchten – sie erschrecken und rennen weg.
  Und nicht zu tief zielen – sonst RUMMS!
  `,
  image: 'media/img/gametitles/laser-flapping-8-###4###.png',

  init: function () {
    resetAll();
  },

  handle: function (grid, elapsed) {
    const dt = Math.min(elapsed || 0, 0.1);
    const ctx = MasterCanvas.get2dContext();
    ensurePalette();
    ensureWorld();
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
