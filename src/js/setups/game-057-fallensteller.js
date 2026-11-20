/**
 * Fallensteller – zwei Hausmeister-Roboter, ein Haus voller Fallen
 *
 * Team LINKS (linke Saalhälfte) spielt KEHRBERT (Roboter mit Besen), Team RECHTS spielt WISCHA (Roboterin mit
 * Mopp). Beide laufen AUTOMATISCH durch ein Puppenhaus im Querschnitt und sammeln Gegenstände (Schlüssel, Pass,
 * Geld, Koffer, Ticket). Wer genug Sachen hat und durch die AUSGANGSTÜR (Erdgeschoss, Mitte) entkommt, gewinnt
 * die Runde. Jeder Gegenstand liegt nur EINMAL im Haus – es wird gerannt, gerauft und geklaut.
 *
 * Regeln:
 * - ZIEL WÄHLEN: In der EIGENEN Randleiste (schwarz, links bzw. rechts) liegen die Ziel-Pads (gui/voteGroup,
 *   Dauerabstimmung). Ein Pad voll leuchten → die Figur des Teams läuft zu diesem Gegenstand (durchsucht das
 *   Möbel und nimmt ihn mit). Hat ihn schon die gegnerische Figur, jagt sie diese („Klauen!“). Das letzte Pad
 *   ist der AUSGANG – geht erst, wenn genug Sachen eingesammelt sind. Ohne Abstimmung wählt der Autopilot
 *   nach ein paar Sekunden das nächste freie Ziel.
 * - FALLEN: Jeder Raum hat einen Fallen-Slot (schwarze Scheibe am Möbel). Slot anleuchten bis voll → Falle
 *   SCHARF (Eimer über der Tür / Bombe im Schrank / Sprungfeder im Boden). Danach ist sie ein paar Sekunden
 *   unantastbar und kann dann wieder entschärft werden: nochmal anleuchten (dauert länger), dann ist der Slot
 *   kurz kaputt. Läuft eine Figur in einen Raum mit scharfer Falle: PLATSCH (nass, Pause) / RUMMS (rußschwarz,
 *   lässt einen Gegenstand fallen) / BOING (fliegt zurück ins Startzimmer). Fallen sind für ALLE gefährlich –
 *   auch für die eigene Figur. Man sieht, wohin der Gegner will (gestrichelte Ziellinie) → genau dort Falle legen!
 * - BLENDEN: Laser direkt auf einer Figur blenden sie – sie schleicht nur noch. Kostet aber Laser, die
 *   woanders fehlen.
 * - KAMPF: Treffen sich beide Figuren auf einem Stockwerk, gibt es eine Staubwolke. In jeder Randleiste
 *   erscheint ein großes KLOPP-Pad; wer seins dauerhaft stärker (mehr Fläche) beleuchtet, schiebt den Balken.
 *   Der Verlierer sieht Sternchen, der Gewinner klaut ihm einen Gegenstand.
 * - RUNDEN: Best of 5 (wer zuerst 3 Runden hat). Jede Runde hat ein Zeitlimit; läuft es ab, gewinnt, wer mehr
 *   Sachen hat (gleich = unentschieden). Das Haus wächst (3×2 → 5×2 → 5×3 Räume), neue Fallenarten kommen dazu
 *   (Eimer → +Bombe → +Sprungfeder), die Figuren werden schneller, Fallen laden schneller.
 * - Highscore: „Chaos-Punkte“ des ganzen Matches (Entkommen, Fallen-Treffer, Entschärfungen, Kämpfe, Diebstähle).
 *
 * Teamzugehörigkeit: Laser sind nicht unterscheidbar. Ein Team ist NUR über die Pad-Position definiert:
 * Die Ziel-Pads und das Klopp-Pad in der linken Randleiste gehören Kehrbert, die in der rechten Wischa.
 * Das Haus in der Mitte ist Niemandsland – jeder darf überall Fallen legen und entschärfen.
 *
 * Interferenz („sollen wir sie embracen?“) – hier: JA, als Spielprinzip, wie beim Vorbild.
 * - Fallen legen IST Störung. Der Gegner sieht dieselbe Falle und kann sie entschärfen – ein Wettlauf um Laser.
 * - Wer die gegnerischen Ziel-Pads anleuchtet, kann dessen Figur umlenken (Sabotage der Abstimmung). Das kostet
 *   aber Laser, die beim eigenen Team fehlen; und die Abstimmung braucht volle Pads, ein paar Störer reichen
 *   nicht gegen ein ganzes Team.
 * - Das Klopp-Pad des Gegners anleuchten hilft dem Gegner (wie game-026-tauziehen) – Sabotage lohnt dort nicht.
 * - Arm-/Entschärf-Kollision: Da Legen und Entschärfen dieselbe Geste ist, schützt die Schonzeit nach dem
 *   Scharfmachen die Leger davor, ihre eigene Falle gleich wieder zu entschärfen.
 * - Offene Frage (bewusst so gelassen): ein „Fair-Play“-Modus mit nur eigener Hälfte wäre über Slots, die nur
 *   in der GEGNERISCHEN Haushälfte liegen, machbar – nimmt aber den Spy-vs-Spy-Kern weg.
 *
 * One-Pixel-Netzwerk-Tauglichkeit: Alles ist Flächenanteil (voteGroup/pixelFillButton). Ein Netz-Spieler mit
 * genau einem Pixel trägt seinen Anteil bei; die Team-Zuordnung kommt wie bei Lasern aus der Pad-Position
 * (oder serverseitig aus der Bildschirmhälfte, in der sein Pixel startet). Bei Millionen Pixeln skaliert es,
 * weil alle Schwellen relativ (fullPercent) sind.
 *
 * Licht-Disziplin: Randleisten, Ziel-Pads, Klopp-Pads und Fallen-Slots sind schwarz hinterlegt und nur
 * konturiert. Die Fraktal-Tapeten (Julia-Mengen) werden einmal vorgerendert und stark gedimmt.
 * Farben nur aus der Laserfarbe, Hue 0.25..0.75 (Team Links 0.3, Team Rechts 0.7).
 *
 * Tastatur (Test ohne Laser):
 * - Leertaste: Start / Rundenpause überspringen / Nochmal
 * - Team Links Ziele: 1 2 3 4 (5) halten, letzte Ziffer (5 bzw. 6) = Ausgang
 * - Team Rechts Ziele: U I O P (J) halten, letzte Taste (J bzw. K) = Ausgang
 * - Kampf: A halten = Kehrbert drückt, L halten = Wischa drückt
 * - B: Falle im Zielraum von Wischa scharf machen · N: Falle im Zielraum von Kehrbert · X: alle Fallen entschärfen
 * - Q: Rundenzeit sofort ablaufen lassen
 *   (d v g r m h t f F s, PageUp/PageDown/Home sind in view.js Debug-Tasten und hier bewusst frei)
 *
 * Klassiker: Spy vs. Spy (First Star Software, C64, 1984) – zwei Agenten, ein Haus, Gegenstände sammeln,
 * Fallen in Möbel und Türen legen, Prügelwolke beim Treffen, Ausgang erst mit allem Nötigen. Anders hier: Die
 * Figuren laufen selbst (Lemmings-artig), das Publikum wählt Ziele per Abstimmung, Fallen sind sichtbar und
 * entschärfbar (das Publikum sieht eh alles). Eigene Figuren, kein MAD-Look.
 * Ähnlichkeiten im Bestand: Teams links/rechts wie game-026-tauziehen (das Klopp-Pad ist ein Mini-Tauziehen),
 * game-033-kicker und game-011-basefight; die selbstlaufende Figur wie game-053-dschungeldussel.
 */

import util, { getRgbSpreadHex, renderTextDropShadow, hexToRgb } from '../util.js';
import { createKeyEdge, isKeyDown } from './gui/gridScan.js';
import soundSplash from '../../../public/media/485066__javierserrat__object-falls-into-the-water.wav';
import soundPlop from '../../../public/media/369952__mischy__plop-1.wav';
import soundBomb from '../../../public/media/155235__zangrutz__bomb-small (1).mp3';
import soundBoing from '../../../public/media/bounce_523088_11537497-lq.mp3';
import soundMusic from '../../../public/media/522110__setuniman__cheeky-1t41b.wav';
import soundWhistle from '../../../public/media/trillerpfeife.mp3';
import soundMatchWin from '../../../public/media/goal2.mp3';
import soundPickup from '../../../public/media/opengameart/Item Pickup.ogg';
import soundArm from '../../../public/media/opengameart/Menu Confirm.ogg';
import soundDefuse from '../../../public/media/opengameart/Menu Move.ogg';
import soundError from '../../../public/media/opengameart/Menu Error.ogg';
import soundRoundWin from '../../../public/media/opengameart/Level Up.ogg';
import soundEscape from '../../../public/media/opengameart/Ability Learn.ogg';
var laserConfig = require('../LaserApiConfig.js').default;
var MasterCanvas = require('../MasterCanvas').default;
var guiFillButton = require('./gui/fillButton-ai2').default;
var guiPixelFillButton = require('./gui/pixelFillButton').default;
var guiVoteGroup = require('./gui/voteGroup').default;
var createHighscore = require('../util/highscore').default;

const W = 1920;
const H = 1080;
const STRIP = 230; // Breite der Randleisten (Team-Pads)
const HOUSE = { x0: 250, x1: 1670, top: 250, bottom: 1040, roofTop: 140 };

// ---------------------------------------------------------------------------------------------------------
// Einstellungen
// ---------------------------------------------------------------------------------------------------------

const SETTINGS = {
  winsNeeded: 3,
  maxRounds: 5,
  countdown: 2.5,
  roundEndDuration: 4.5,
  againDelay: 1.5,
  maxParticles: 400,
  maxFloaters: 30,
  slotRadius: 52,
  padRadius: 56,
  fightPadRadius: 95,
  sensorRadius: 50,
  autoDelay: 3, // so lange ohne Ziel, dann wählt der Autopilot
  searchTime: 0.9,
  fightDuration: 7,
  fightCooldown: 6,
  fightReach: 0.45, // Anteil der Raumbreite, ab dem sich die Figuren „treffen“
  armGrace: 2.5, // Schonzeit nach dem Scharfmachen
  brokenTime: 5, // Slot nach Entschärfen kaputt
  triggerBrokenTime: 8, // Slot nach Auslösen kaputt
  dazzleThreshold: 50,
  dazzleSlow: 0.35,
  flyDuration: 1.3,
};

const DIFFICULTY = {
  speedStart: 200, // px/s
  speedPerRound: 18,
  climbFactor: 0.7,
  armSpeed: 42, // Füllung/s bei voller Abdeckung
  armFullPercent: 25,
  defuseFactor: 0.6, // Entschärfen ist langsamer als Legen
  slotSpeedDown: 12,
  voteSpeed: 45,
  voteSpeedDown: 15,
  voteFullPercent: 25,
  stunEimer: 2.4,
  stunBombe: 3.2,
  stunFight: 2.0,
  fightPull: 0.32, // Balken pro Sekunde bei voller Überlegenheit
  fightFullPercent: 25,
};

const ROUNDS = [
  { cols: 3, rows: 2, items: 4, need: 2, traps: ['eimer'], time: 80, armBonus: 1, news: 'Eimer über der Tür: Slot anleuchten = Falle scharf!' },
  { cols: 5, rows: 2, items: 4, need: 2, traps: ['eimer', 'bombe'], time: 90, armBonus: 1, news: 'Das Haus wächst – neu: Bomben im Schrank!' },
  { cols: 5, rows: 3, items: 5, need: 3, traps: ['eimer', 'bombe', 'feder'], time: 100, armBonus: 1.1, news: 'Drei Stockwerke – neu: Sprungfedern!' },
  { cols: 5, rows: 3, items: 5, need: 3, traps: ['eimer', 'bombe', 'feder'], time: 95, armBonus: 1.25, news: 'Schneller! Fallen laden schneller.' },
  { cols: 5, rows: 3, items: 5, need: 3, traps: ['eimer', 'bombe', 'feder'], time: 90, armBonus: 1.4, news: 'Entscheidungsrunde!' },
];

const ITEM_TYPES = [
  { key: 'schluessel', name: 'Schlüssel' },
  { key: 'pass', name: 'Pass' },
  { key: 'geld', name: 'Geld' },
  { key: 'koffer', name: 'Koffer' },
  { key: 'ticket', name: 'Ticket' },
];

const TEAMS = [
  {
    name: 'Kehrbert',
    side: 'Links',
    hue: 0.3,
    keys: ['Digit1', 'Digit2', 'Digit3', 'Digit4', 'Digit5', 'Digit6'],
    pullKey: 'KeyA',
  },
  {
    name: 'Wischa',
    side: 'Rechts',
    hue: 0.7,
    keys: ['KeyU', 'KeyI', 'KeyO', 'KeyP', 'KeyJ', 'KeyK'],
    pullKey: 'KeyL',
  },
];

const TRAP_INFO = {
  eimer: { name: 'Eimer', hit: 'PLATSCH!' },
  bombe: { name: 'Bombe', hit: 'RUMMS!' },
  feder: { name: 'Sprungfeder', hit: 'BOING!' },
};

const QUIPS = ['Wo ist mein Koffer?', 'Sauber hier.', 'Verdächtig ruhig.', 'Hihi.', 'Erst mal fegen.', 'Psst!'];

// ---------------------------------------------------------------------------------------------------------
// Zustand (vorbelegt – handle() läuft auch ohne init())
// ---------------------------------------------------------------------------------------------------------

const STATE = {
  scene: 'title',
  sceneTime: 0,
  time: 0,
  round: 0,
  wins: [0, 0],
  clock: ROUNDS[0].time,
  countdown: 0,
  shake: 0,
  flash: 0,
  flashColor: '#000000',
  lastWinner: -1,
  lastReason: '',
  matchWinner: -1,
  newHighscore: false,
  fight: null,
  fightCooldown: 0,
  score: 0,
  quipTimer: 5,
};

const STATS = {
  armed: 0,
  defused: 0,
  trapHits: [0, 0], // erlittene Fallen je Team
  fights: 0,
  fightWins: [0, 0],
  steals: 0,
  escapes: [0, 0],
  itemsGrabbed: [0, 0],
  dazzleSeconds: [0, 0],
};

var layout = null; // { cols, rows, roomW, roomH, exitF, exitC, def }
var rooms = [];
var items = [];
var robots = [makeRobot(0), makeRobot(1)];
var particles = [];
var floaters = [];
var votes = [null, null];
var fightPads = [null, null];
var startButton = null;
var againButton = null;
var music = null;
var keyEdge = createKeyEdge();
var highscore = createHighscore('Fallensteller', 'punkte');

var PAL = null;
var palKey = '';
var wallpaper = null;
var wallpaperKey = '';
var stars = [];
for (let i = 0; i < 90; i++) stars.push({ x: Math.random() * W, y: Math.random() * HOUSE.top, p: Math.random() * 6 });

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
    team: [col(0.3, 0.7, 0.95), col(0.7, 0.6, 0.95)],
    teamDim: [col(0.3, 0.6, 0.5), col(0.7, 0.5, 0.5)],
    teamDark: [col(0.3, 0.6, 0.2), col(0.7, 0.5, 0.2)],
    wall: col(0.5, 0.35, 0.75),
    wallDim: col(0.5, 0.3, 0.35),
    roof: col(0.42, 0.45, 0.45),
    sky: col(0.6, 0.6, 0.07),
    star: col(0.45, 0.3, 0.6),
    warn: col(0.5, 0.9, 1), // neutral zwischen den Teamfarben (0.3 / 0.7)
    trapEmpty: col(0.45, 0.3, 0.55),
    trapBroken: col(0.5, 0.15, 0.35),
    defuse: col(0.55, 0.6, 1),
    water: col(0.55, 0.6, 0.9),
    soot: col(0.5, 0.05, 0.25),
    spark: col(0.26, 0.7, 1),
    item: col(0.36, 0.45, 0.95),
    itemDim: col(0.36, 0.3, 0.45),
    cloud: col(0.5, 0.15, 0.55),
    hud: col(0.45, 0.4, 0.9),
    hudDim: col(0.45, 0.3, 0.55),
    title: col(0.32, 0.7, 0.95),
    sub: col(0.58, 0.45, 0.85),
    flash: col(0.5, 0.25, 1),
    start: [col(0.35, 0.6, 0.6), col(0.35, 0.6, 0.8), col(0.35, 0.6, 1)],
  };
  wallpaper = null;
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

function roundDef() {
  return ROUNDS[Math.max(0, Math.min(ROUNDS.length - 1, STATE.round))];
}

function approach(cur, target, rate, dt) {
  return cur + (target - cur) * Math.min(1, rate * dt);
}

function addParticles(x, y, count, color, speed, gravity, kind) {
  for (let i = 0; i < count && particles.length < SETTINGS.maxParticles; i++) {
    const a = Math.random() * Math.PI * 2;
    const s = (0.3 + Math.random()) * (speed || 220);
    const life = 0.5 + Math.random() * 0.8;
    particles.push({
      x,
      y,
      vx: Math.cos(a) * s,
      vy: Math.sin(a) * s - (gravity ? 160 : 0),
      g: gravity || 0,
      life,
      max: life,
      color,
      size: 3 + Math.random() * 5,
      kind: kind || 'dot',
    });
  }
}

function addFloater(x, y, text, color, size) {
  if (floaters.length >= SETTINGS.maxFloaters) floaters.shift();
  floaters.push({ x, y, text, color, life: 1.8, size: size || 44 });
}

function shuffle(arr) {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    const t = arr[i];
    arr[i] = arr[j];
    arr[j] = t;
  }
  return arr;
}

// ---------------------------------------------------------------------------------------------------------
// Haus / Geometrie
// ---------------------------------------------------------------------------------------------------------

function roomCX(c) {
  return HOUSE.x0 + (c + 0.5) * layout.roomW;
}

function roomTop(f) {
  return HOUSE.top + f * layout.roomH;
}

function floorY(f) {
  return HOUSE.top + (f + 1) * layout.roomH - 8;
}

function roomAt(f, c) {
  return rooms[f * layout.cols + c] || null;
}

function startRoom(side) {
  return { f: 0, c: side === 0 ? 0 : layout.cols - 1 };
}

function robotHeight() {
  return Math.min(150, layout.roomH * 0.42);
}

function buildRound(index) {
  STATE.round = index;
  const def = roundDef();
  layout = {
    cols: def.cols,
    rows: def.rows,
    roomW: (HOUSE.x1 - HOUSE.x0) / def.cols,
    roomH: (HOUSE.bottom - HOUSE.top) / def.rows,
    exitF: def.rows - 1,
    exitC: Math.floor(def.cols / 2),
    def,
  };
  const mid = layout.exitC;
  rooms = [];
  for (let f = 0; f < def.rows; f++) {
    for (let c = 0; c < def.cols; c++) {
      // Slot zur Außenseite (Nachbar-Slots über die Wand hinweg nie dicht beieinander), Mitte nach rechts
      const dir = c < mid ? -1 : 1;
      const type = def.traps[Math.floor(Math.random() * def.traps.length)];
      const cx = HOUSE.x0 + (c + 0.5) * layout.roomW;
      const top = HOUSE.top + f * layout.roomH;
      const fl = HOUSE.top + (f + 1) * layout.roomH - 8;
      let sy;
      if (type === 'eimer') sy = top + Math.max(SETTINGS.slotRadius + 22, layout.roomH * 0.3);
      else if (type === 'bombe') sy = top + layout.roomH * 0.6;
      else sy = fl - Math.max(58, layout.roomH * 0.2);
      rooms.push({
        f,
        c,
        dir,
        type,
        sx: cx + dir * layout.roomW * 0.27,
        sy,
        state: 'empty', // empty | armed | broken
        grace: 0,
        cooldown: 0,
        button: null,
        prevValue: 0,
        wobble: Math.random() * 6,
      });
    }
  }
  placeItems(def.items);
  robots = [makeRobot(0), makeRobot(1)];
  votes = [null, null];
  fightPads = [null, null];
  particles = [];
  floaters = [];
  STATE.fight = null;
  STATE.fightCooldown = 3;
  STATE.clock = def.time;
  STATE.countdown = SETTINGS.countdown;
  wallpaper = null;
}

/** Gegenstände gespiegelt verteilen (fair für beide Seiten): Paare (c, cols-1-c), Rest in die Mittelspalte. */
function placeItems(count) {
  const cols = layout.cols;
  const mid = layout.exitC;
  const isStart = (f, c) => f === 0 && (c === 0 || c === cols - 1);
  const pairs = [];
  const centers = [];
  for (let f = 0; f < layout.rows; f++) {
    for (let c = 0; c < mid; c++) {
      if (!isStart(f, c)) pairs.push({ f, c });
    }
    centers.push({ f, c: mid });
  }
  shuffle(pairs);
  shuffle(centers);
  const types = shuffle([0, 1, 2, 3, 4].slice(0, count));
  items = [];
  let k = 0;
  while (k < count) {
    const left = count - k;
    if (left % 2 === 1 && centers.length) {
      const r = centers.pop();
      items.push({ type: types[k++], f: r.f, c: r.c, holder: -1 });
    } else if (left >= 2 && pairs.length) {
      const p = pairs.pop();
      items.push({ type: types[k++], f: p.f, c: p.c, holder: -1 });
      items.push({ type: types[k++], f: p.f, c: cols - 1 - p.c, holder: -1 });
    } else if (centers.length) {
      const r = centers.pop();
      items.push({ type: types[k++], f: r.f, c: r.c, holder: -1 });
    } else {
      // Notfall: in den Ausgangsraum
      items.push({ type: types[k++], f: layout.rows - 1, c: mid, holder: -1 });
    }
  }
  // Index im items-Array = Typ-Reihenfolge der Pads: nach Typ sortieren
  items.sort((a, b) => a.type - b.type);
}

function makeRobot(side) {
  return {
    side,
    f: 0,
    c: side === 0 ? 0 : 2,
    tf: 0,
    tc: 0,
    t: 0,
    moving: false,
    vertical: false,
    x: side === 0 ? 400 : 1500,
    y: 600,
    face: side === 0 ? 1 : -1,
    state: 'idle', // idle | walk | search | stun | fly | fight | escaped
    stateTime: 0,
    stun: 0,
    effect: '', // wet | soot | stars
    goal: null, // { kind: 'item', idx } | { kind: 'exit' }
    idle: 0,
    items: [],
    say: '',
    sayTime: 0,
    walkPhase: 0,
    dazzle: 0,
    sensor: null,
    flyFromX: 0,
    flyFromY: 0,
    force: 0,
    initialised: false,
  };
}

function placeRobot(r) {
  const s = startRoom(r.side);
  r.f = s.f;
  r.c = s.c;
  r.moving = false;
  r.initialised = true;
  updateRobotPos(r);
}

function updateRobotPos(r) {
  if (r.moving) {
    const x0 = roomCX(r.c);
    const x1 = roomCX(r.tc);
    const y0 = floorY(r.f);
    const y1 = floorY(r.tf);
    r.x = x0 + (x1 - x0) * r.t;
    r.y = y0 + (y1 - y0) * r.t;
  } else {
    r.x = roomCX(r.c);
    r.y = floorY(r.f);
  }
}

function ensureLayout() {
  if (!layout) buildRound(0);
  robots.forEach((r) => {
    if (!r.initialised) placeRobot(r);
  });
}

// ---------------------------------------------------------------------------------------------------------
// Fraktal-Tapete (Julia-Mengen, einmal vorgerendert, stark gedimmt)
// ---------------------------------------------------------------------------------------------------------

function makeCanvas(w, h) {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  return c;
}

function buildJuliaTile(size, cr, ci, hue) {
  const canvas = makeCanvas(size, size);
  const g = canvas.getContext('2d');
  const img = g.createImageData(size, size);
  const steps = 16;
  const grad = [];
  for (let k = 0; k < steps; k++) {
    const rgb = hexToRgb(col(hue + k * 0.008, 0.6, 0.03 + (0.17 * k) / (steps - 1))) || { r: 0, g: 0, b: 0 };
    grad.push(rgb);
  }
  const maxIt = 40;
  for (let py = 0; py < size; py++) {
    for (let px = 0; px < size; px++) {
      let zr = ((px / size) * 2 - 1) * 1.6;
      let zi = ((py / size) * 2 - 1) * 1.6;
      let it = 0;
      while (it < maxIt && zr * zr + zi * zi < 4) {
        const t = zr * zr - zi * zi + cr;
        zi = 2 * zr * zi + ci;
        zr = t;
        it++;
      }
      const k = it >= maxIt ? steps - 1 : Math.floor(((it / maxIt) * (steps - 1)) * 0.8);
      const rgb = grad[k];
      const o = (py * size + px) * 4;
      img.data[o] = rgb.r;
      img.data[o + 1] = rgb.g;
      img.data[o + 2] = rgb.b;
      img.data[o + 3] = 255;
    }
  }
  g.putImageData(img, 0, 0);
  return canvas;
}

function ensureWallpaper() {
  const key = palKey + '|' + layout.cols + 'x' + layout.rows;
  if (wallpaper && key === wallpaperKey) return;
  wallpaperKey = key;
  const tiles = [
    buildJuliaTile(140, -0.8, 0.156, 0.35),
    buildJuliaTile(140, 0.285, 0.01, 0.5),
    buildJuliaTile(140, -0.4, 0.6, 0.62),
  ];
  const w = HOUSE.x1 - HOUSE.x0;
  const h = HOUSE.bottom - HOUSE.top;
  wallpaper = makeCanvas(w, h);
  const g = wallpaper.getContext('2d');
  g.fillStyle = '#000000';
  g.fillRect(0, 0, w, h);
  for (let f = 0; f < layout.rows; f++) {
    for (let c = 0; c < layout.cols; c++) {
      const tile = tiles[(f + c) % tiles.length];
      const x = c * layout.roomW;
      const y = f * layout.roomH;
      g.save();
      g.beginPath();
      g.rect(x, y, layout.roomW, layout.roomH);
      g.clip();
      for (let ty = y; ty < y + layout.roomH; ty += 140) {
        for (let tx = x; tx < x + layout.roomW; tx += 140) g.drawImage(tile, tx, ty);
      }
      g.restore();
    }
  }
}

// ---------------------------------------------------------------------------------------------------------
// Komponenten (lazy)
// ---------------------------------------------------------------------------------------------------------

function voteCount() {
  return layout.def.items + 1; // Gegenstände + Ausgang
}

function votePos(side, i) {
  const n = voteCount();
  const spacing = n >= 6 ? 132 : 150;
  const y0 = 600 - (spacing * (n - 1)) / 2;
  return { x: side === 0 ? STRIP / 2 : W - STRIP / 2, y: y0 + i * spacing };
}

function ensureVotes() {
  for (let side = 0; side < 2; side++) {
    if (votes[side]) continue;
    const n = voteCount();
    const options = [];
    const keys = [];
    for (let i = 0; i < n; i++) {
      const p = votePos(side, i);
      options.push({ x: p.x, y: p.y, label: '' });
      keys.push(TEAMS[side].keys[i]);
    }
    const s = side;
    votes[side] = guiVoteGroup({
      options,
      radius: SETTINGS.padRadius,
      speedUp: DIFFICULTY.voteSpeed,
      speedDown: DIFFICULTY.voteSpeedDown,
      fullPercent: DIFFICULTY.voteFullPercent,
      decideValue: 100,
      lockAfterDecide: false,
      keyCodes: keys,
      visible: false,
      onDecide: (i) => applyVote(s, i),
    });
  }
}

function ensureFightPads() {
  for (let side = 0; side < 2; side++) {
    if (fightPads[side]) continue;
    fightPads[side] = guiPixelFillButton({
      label: '',
      posX: side === 0 ? STRIP / 2 : W - STRIP / 2,
      posY: 600,
      radius: SETTINGS.fightPadRadius,
      speedUp: 100,
      speedDown: 60,
      fullPercent: DIFFICULTY.fightFullPercent,
      activeValue: 200,
      visible: false,
    });
  }
}

function ensureSlot(room) {
  if (room.button) return;
  room.button = guiPixelFillButton({
    label: '',
    posX: room.sx,
    posY: room.sy,
    radius: SETTINGS.slotRadius,
    speedUp: DIFFICULTY.armSpeed * layout.def.armBonus,
    speedDown: DIFFICULTY.slotSpeedDown,
    fullPercent: DIFFICULTY.armFullPercent,
    activeValue: 200, // wir werten den Zähler selbst aus
    visible: false,
  });
}

function ensureSensor(r) {
  if (r.sensor) return;
  r.sensor = guiPixelFillButton({
    label: '',
    posX: r.x,
    posY: r.y - robotHeight() * 0.6,
    radius: SETTINGS.sensorRadius,
    speedUp: 140,
    speedDown: 90,
    fullPercent: 25,
    activeValue: 200,
    visible: false,
  });
}

// ---------------------------------------------------------------------------------------------------------
// Ziele, Abstimmung, Autopilot
// ---------------------------------------------------------------------------------------------------------

function say(r, text, duration) {
  r.say = text;
  r.sayTime = duration || 1.8;
}

function applyVote(side, i) {
  if (STATE.scene !== 'game' || i < 0) return;
  const r = robots[side];
  if (r.state === 'escaped') return;
  const color = PAL.team[side];
  if (i >= layout.def.items) {
    if (r.items.length >= layout.def.need) {
      r.goal = { kind: 'exit' };
      say(r, 'Nix wie raus!');
    } else {
      say(r, 'Mir fehlt noch was!');
      addFloater(votePos(side, i).x, votePos(side, i).y - 70, 'Noch ' + (layout.def.need - r.items.length) + '!', color, 36);
      playSound(soundError, 0.4);
      return;
    }
  } else {
    const it = items[i];
    if (!it) return;
    if (it.holder === side) {
      say(r, 'Hab ich schon!');
      return;
    }
    r.goal = { kind: 'item', idx: i };
    say(r, it.holder >= 0 ? 'Klauen: ' + ITEM_TYPES[it.type].name + '!' : ITEM_TYPES[it.type].name + '!');
  }
  r.idle = 0;
  playSound(soundPlop, 0.35);
}

function autopilot(r) {
  const need = layout.def.need;
  if (r.items.length >= need) {
    r.goal = { kind: 'exit' };
    say(r, 'Autopilot: Ausgang!');
    return;
  }
  let best = -1;
  let bestD = Infinity;
  items.forEach((it, i) => {
    if (it.holder !== -1) return;
    const d = Math.abs(it.c - r.c) + Math.abs(it.f - r.f) + Math.random() * 0.3;
    if (d < bestD) {
      bestD = d;
      best = i;
    }
  });
  if (best < 0) {
    items.forEach((it, i) => {
      if (it.holder === 1 - r.side && best < 0) best = i;
    });
  }
  if (best >= 0) {
    r.goal = { kind: 'item', idx: best };
    say(r, 'Autopilot: ' + ITEM_TYPES[items[best].type].name);
  }
}

/** Zielraum der Figur (oder null) */
function goalRoom(r) {
  if (!r.goal) return null;
  if (r.goal.kind === 'exit') return { f: layout.exitF, c: layout.exitC };
  const it = items[r.goal.idx];
  if (!it || it.holder === r.side) {
    r.goal = null;
    return null;
  }
  if (it.holder >= 0) {
    const o = robots[it.holder];
    return { f: o.f, c: o.c };
  }
  return { f: it.f, c: it.c };
}

// ---------------------------------------------------------------------------------------------------------
// Fallen
// ---------------------------------------------------------------------------------------------------------

function armRoom(room) {
  if (!room || room.state !== 'empty') return;
  room.state = 'armed';
  room.grace = SETTINGS.armGrace;
  if (room.button) room.button.setValue(0);
  room.prevValue = 0;
  STATS.armed++;
  addFloater(room.sx, room.sy - 70, 'SCHARF!', PAL.warn, 40);
  addParticles(room.sx, room.sy, 14, PAL.warn, 160, 0, 'star');
  playSound(soundArm, 0.5);
}

function defuseRoom(room) {
  if (!room || room.state !== 'armed') return;
  room.state = 'broken';
  room.cooldown = SETTINGS.brokenTime;
  if (room.button) room.button.setValue(0);
  room.prevValue = 0;
  STATS.defused++;
  addFloater(room.sx, room.sy - 70, 'Entschärft', PAL.defuse, 38);
  addParticles(room.sx, room.sy, 10, PAL.defuse, 120, 200);
  playSound(soundDefuse, 0.5);
}

function updateSlots(grid, dt) {
  rooms.forEach((room) => {
    ensureSlot(room);
    const b = room.button;
    room.prevValue = b.getValue();
    b.handle(grid, dt);
    const cur = b.getValue();
    if (room.state === 'empty') {
      if (cur >= 99) armRoom(room);
    } else if (room.state === 'armed') {
      if (room.grace > 0) {
        room.grace -= dt;
        b.setValue(0);
      } else {
        if (cur > room.prevValue) b.setValue(room.prevValue + (cur - room.prevValue) * DIFFICULTY.defuseFactor);
        if (b.getValue() >= 99) defuseRoom(room);
      }
    } else {
      b.setValue(0);
      room.cooldown -= dt;
      if (room.cooldown <= 0) room.state = 'empty';
    }
  });
}

function triggerTrap(r, room) {
  const info = TRAP_INFO[room.type];
  room.state = 'broken';
  room.cooldown = SETTINGS.triggerBrokenTime;
  if (room.button) room.button.setValue(0);
  STATS.trapHits[r.side]++;
  STATE.shake = Math.max(STATE.shake, room.type === 'bombe' ? 26 : 14);
  addFloater(r.x, r.y - robotHeight() - 40, info.hit, PAL.warn, 60);
  r.moving = false;
  updateRobotPos(r);
  if (room.type === 'eimer') {
    r.state = 'stun';
    r.stun = DIFFICULTY.stunEimer;
    r.effect = 'wet';
    addParticles(r.x, r.y - robotHeight(), 40, PAL.water, 200, 600, 'drop');
    playSound(soundSplash, 0.7);
    say(r, 'Blubb!', 1.5);
  } else if (room.type === 'bombe') {
    r.state = 'stun';
    r.stun = DIFFICULTY.stunBombe;
    r.effect = 'soot';
    STATE.flash = 0.25;
    STATE.flashColor = PAL.flash;
    addParticles(r.x, r.y - robotHeight() * 0.5, 60, PAL.spark, 380, 200);
    addParticles(r.x, r.y - robotHeight() * 0.5, 30, PAL.soot, 160, -60);
    playSound(soundBomb, 0.8);
    if (r.items.length) {
      const idx = r.items.splice(Math.floor(Math.random() * r.items.length), 1)[0];
      const it = items[idx];
      it.holder = -1;
      it.f = r.f;
      it.c = r.c;
      addFloater(r.x, r.y - robotHeight() - 100, ITEM_TYPES[it.type].name + ' verloren!', PAL.team[r.side], 36);
    }
    say(r, '...hust.', 2);
  } else {
    // Sprungfeder: zurück ins Startzimmer
    r.state = 'fly';
    r.stateTime = 0;
    r.flyFromX = r.x;
    r.flyFromY = r.y;
    r.effect = '';
    addParticles(r.x, r.y, 24, PAL.spark, 260, 300, 'star');
    playSound(soundBoing, 0.8);
    say(r, 'Huiiii!', 1.4);
  }
}

// ---------------------------------------------------------------------------------------------------------
// Figuren
// ---------------------------------------------------------------------------------------------------------

function robotSpeed(r) {
  let s = DIFFICULTY.speedStart + STATE.round * DIFFICULTY.speedPerRound;
  if (r.dazzle > SETTINGS.dazzleThreshold) s *= SETTINGS.dazzleSlow;
  return s;
}

function onArrive(r) {
  const room = roomAt(r.f, r.c);
  if (room && room.state === 'armed') triggerTrap(r, room);
}

function goalReached(r) {
  if (r.goal.kind === 'exit') {
    if (r.items.length >= layout.def.need) escape(r);
    else {
      r.goal = null;
      say(r, 'Mir fehlt noch was!');
    }
    return;
  }
  const it = items[r.goal.idx];
  if (it.holder === -1) {
    r.state = 'search';
    r.stateTime = 0;
  }
  // gehört dem Gegner: hier warten, der Kampf startet von selbst
}

function updateRobot(r, dt) {
  r.sayTime = Math.max(0, r.sayTime - dt);
  r.stateTime += dt;
  if (r.state === 'escaped' || r.state === 'fight') return;
  if (r.state === 'stun') {
    r.stun -= dt;
    if (r.stun <= 0) {
      r.state = 'idle';
      r.effect = '';
    }
    return;
  }
  if (r.state === 'fly') {
    const t = Math.min(1, r.stateTime / SETTINGS.flyDuration);
    const s = startRoom(r.side);
    const tx = roomCX(s.c);
    const ty = floorY(s.f);
    r.x = r.flyFromX + (tx - r.flyFromX) * t;
    r.y = r.flyFromY + (ty - r.flyFromY) * t - Math.sin(Math.PI * t) * 320;
    if (t >= 1) {
      r.f = s.f;
      r.c = s.c;
      r.moving = false;
      r.state = 'stun';
      r.stun = 0.9;
      r.effect = 'stars';
      updateRobotPos(r);
      addParticles(r.x, r.y, 16, PAL.spark, 200, 300, 'star');
    }
    return;
  }
  if (r.state === 'search') {
    if (r.stateTime >= SETTINGS.searchTime) {
      r.state = 'idle';
      const it = r.goal && r.goal.kind === 'item' ? items[r.goal.idx] : null;
      if (it && it.holder === -1 && it.f === r.f && it.c === r.c) {
        it.holder = r.side;
        r.items.push(r.goal.idx);
        STATS.itemsGrabbed[r.side]++;
        addFloater(r.x, r.y - robotHeight() - 50, ITEM_TYPES[it.type].name + '!', PAL.team[r.side], 46);
        addParticles(r.x, r.y - robotHeight(), 20, PAL.item, 200, 200, 'star');
        playSound(soundPickup, 0.6);
        if (r.items.length >= layout.def.need) say(r, 'Genug! Zum Ausgang!', 2.2);
      } else {
        say(r, 'Weg?!');
      }
      r.goal = null;
    }
    return;
  }

  // idle / walk
  if (STATE.countdown > 0) return;
  if (r.moving) {
    const dist = r.vertical ? layout.roomH : layout.roomW;
    const sp = robotSpeed(r) * (r.vertical ? DIFFICULTY.climbFactor : 1);
    r.t += (sp * dt) / dist;
    r.walkPhase += dt * (r.dazzle > SETTINGS.dazzleThreshold ? 4 : 11);
    if (r.t >= 1) {
      r.f = r.tf;
      r.c = r.tc;
      r.t = 0;
      r.moving = false;
      updateRobotPos(r);
      onArrive(r);
      if (r.state !== 'walk') return;
    } else {
      updateRobotPos(r);
      return;
    }
  }
  const g = goalRoom(r);
  if (!g) {
    r.state = 'idle';
    r.idle += dt;
    if (r.idle > SETTINGS.autoDelay) {
      r.idle = 0;
      autopilot(r);
    }
    return;
  }
  r.idle = 0;
  if (g.f === r.f && g.c === r.c) {
    r.state = 'idle';
    goalReached(r);
    return;
  }
  // nächster Schritt: erst waagerecht, dann senkrecht (Leiter)
  r.state = 'walk';
  r.moving = true;
  r.t = 0;
  if (g.c !== r.c) {
    r.vertical = false;
    r.tf = r.f;
    r.tc = r.c + (g.c > r.c ? 1 : -1);
    r.face = g.c > r.c ? 1 : -1;
  } else {
    r.vertical = true;
    r.tc = r.c;
    r.tf = r.f + (g.f > r.f ? 1 : -1);
  }
}

function updateSensors(grid, dt) {
  robots.forEach((r) => {
    ensureSensor(r);
    r.sensor.setX(r.x);
    r.sensor.setY(r.y - robotHeight() * 0.6);
    r.sensor.handle(grid, dt);
    r.dazzle = r.state === 'escaped' ? 0 : r.sensor.getValue();
    if (r.dazzle > SETTINGS.dazzleThreshold) {
      STATS.dazzleSeconds[r.side] += dt;
      if (r.sayTime <= 0 && Math.random() < dt * 0.8) say(r, 'Ich seh nix!', 1.2);
    }
  });
}

function escape(r) {
  r.state = 'escaped';
  r.stateTime = 0;
  STATS.escapes[r.side]++;
  addParticles(r.x, r.y - 60, 80, PAL.team[r.side], 320, 250, 'star');
  playSound(soundEscape, 0.8);
  endRound(r.side, TEAMS[r.side].name + ' ist entkommen!');
}

// ---------------------------------------------------------------------------------------------------------
// Kampf
// ---------------------------------------------------------------------------------------------------------

function canFight(r) {
  return (r.state === 'idle' || r.state === 'walk' || r.state === 'search') && !(r.moving && r.vertical);
}

function checkFight() {
  if (STATE.fight || STATE.fightCooldown > 0 || STATE.countdown > 0) return;
  const a = robots[0];
  const b = robots[1];
  if (!canFight(a) || !canFight(b)) return;
  if (a.f !== b.f) return;
  if (Math.abs(a.x - b.x) > layout.roomW * SETTINGS.fightReach) return;
  STATE.fight = { x: (a.x + b.x) / 2, y: a.y - robotHeight() * 0.5, balance: 0, time: 0 };
  a.state = 'fight';
  b.state = 'fight';
  a.force = 0;
  b.force = 0;
  STATS.fights++;
  STATE.shake = Math.max(STATE.shake, 10);
  playSound(soundWhistle, 0.6);
  addFloater(STATE.fight.x, STATE.fight.y - 140, 'KLOPPEREI!', PAL.warn, 60);
}

function updateFight(grid, dt) {
  const fight = STATE.fight;
  ensureFightPads();
  fight.time += dt;
  for (let side = 0; side < 2; side++) {
    const pad = fightPads[side];
    pad.handle(grid, dt);
    let target = Math.min(1, pad.getFillPercent() / DIFFICULTY.fightFullPercent);
    if (isKeyDown(TEAMS[side].pullKey)) target = 1;
    robots[side].force = approach(robots[side].force, target, 5, dt);
  }
  fight.balance += (robots[0].force - robots[1].force) * DIFFICULTY.fightPull * dt;
  if (Math.random() < dt * 8) addParticles(fight.x + (Math.random() - 0.5) * 160, fight.y + (Math.random() - 0.5) * 80, 2, PAL.cloud, 120, 0);
  if (Math.abs(fight.balance) >= 1 || fight.time >= SETTINGS.fightDuration) {
    let winner;
    if (fight.balance > 0.001) winner = 0;
    else if (fight.balance < -0.001) winner = 1;
    else winner = Math.random() < 0.5 ? 0 : 1;
    endFight(winner);
  }
}

function endFight(winner) {
  const w = robots[winner];
  const l = robots[1 - winner];
  STATE.fight = null;
  STATE.fightCooldown = SETTINGS.fightCooldown;
  STATS.fightWins[winner]++;
  w.state = w.moving ? 'walk' : 'idle';
  l.state = 'stun';
  l.stun = DIFFICULTY.stunFight;
  l.effect = 'stars';
  STATE.shake = Math.max(STATE.shake, 16);
  addParticles(l.x, l.y - robotHeight(), 24, PAL.spark, 220, 0, 'star');
  if (l.items.length) {
    const idx = l.items.splice(Math.floor(Math.random() * l.items.length), 1)[0];
    w.items.push(idx);
    items[idx].holder = winner;
    STATS.steals++;
    addFloater(w.x, w.y - robotHeight() - 60, 'GEKLAUT: ' + ITEM_TYPES[items[idx].type].name, PAL.team[winner], 44);
    if (w.goal && w.goal.kind === 'item' && w.goal.idx === idx) w.goal = null;
    playSound(soundPickup, 0.6);
  } else {
    addFloater(w.x, w.y - robotHeight() - 60, TEAMS[winner].name + ' siegt!', PAL.team[winner], 44);
  }
  say(w, 'Ha!', 1.2);
  say(l, 'Aua...', 1.6);
}

// ---------------------------------------------------------------------------------------------------------
// Runden & Match
// ---------------------------------------------------------------------------------------------------------

function resetMatch() {
  STATE.wins = [0, 0];
  STATE.lastWinner = -1;
  STATE.lastReason = '';
  STATE.matchWinner = -1;
  STATE.newHighscore = false;
  STATE.shake = 0;
  STATE.flash = 0;
  STATE.score = 0;
  STATS.armed = 0;
  STATS.defused = 0;
  STATS.trapHits = [0, 0];
  STATS.fights = 0;
  STATS.fightWins = [0, 0];
  STATS.steals = 0;
  STATS.escapes = [0, 0];
  STATS.itemsGrabbed = [0, 0];
  STATS.dazzleSeconds = [0, 0];
  buildRound(0);
  robots.forEach(placeRobot);
}

function resetAll() {
  stopMusic();
  resetMatch();
  startButton = null;
  againButton = null;
  keyEdge = createKeyEdge();
  setScene('title');
}

function startGame() {
  resetMatch();
  setScene('game');
  stopMusic();
  music = playSound(soundMusic, 0.3);
  if (music) music.loop = true;
}

function endRound(winner, reason) {
  if (STATE.scene !== 'game') return;
  STATE.lastWinner = winner;
  STATE.lastReason = reason;
  STATE.fight = null;
  robots.forEach((r) => {
    if (r.state === 'fight') r.state = 'idle';
  });
  if (winner >= 0) {
    STATE.wins[winner]++;
    STATE.flash = 0.4;
    STATE.flashColor = PAL.team[winner];
    playSound(soundRoundWin, 0.7);
  } else {
    playSound(soundError, 0.5);
  }
  setScene('levelup');
}

function timeoutRound() {
  const a = robots[0].items.length;
  const b = robots[1].items.length;
  if (a > b) endRound(0, 'Zeit um – ' + TEAMS[0].name + ' hat mehr Sachen (' + a + ':' + b + ')');
  else if (b > a) endRound(1, 'Zeit um – ' + TEAMS[1].name + ' hat mehr Sachen (' + b + ':' + a + ')');
  else endRound(-1, 'Zeit um – unentschieden (' + a + ':' + b + ')');
}

function matchOver() {
  return STATE.wins[0] >= SETTINGS.winsNeeded || STATE.wins[1] >= SETTINGS.winsNeeded || STATE.round + 1 >= SETTINGS.maxRounds;
}

function computeScore() {
  return (
    1000 * (STATS.escapes[0] + STATS.escapes[1]) +
    150 * (STATS.trapHits[0] + STATS.trapHits[1]) +
    60 * STATS.defused +
    25 * STATS.armed +
    100 * STATS.fights +
    120 * STATS.steals
  );
}

function endMatch() {
  stopMusic();
  if (STATE.wins[0] > STATE.wins[1]) STATE.matchWinner = 0;
  else if (STATE.wins[1] > STATE.wins[0]) STATE.matchWinner = 1;
  else STATE.matchWinner = -1;
  STATE.score = computeScore();
  highscore.addEntry({
    punkte: Math.round(STATE.score),
    runden: STATE.round + 1,
    siegerRunden: Math.max(STATE.wins[0], STATE.wins[1]),
    fallenTreffer: STATS.trapHits[0] + STATS.trapHits[1],
    entschaerft: STATS.defused,
    kaempfe: STATS.fights,
  });
  STATE.newHighscore = highscore.lastEntryNewHighscore();
  playSound(soundMatchWin, 0.8);
  againButton = null;
  setScene('gameover');
}

function nextRound() {
  buildRound(STATE.round + 1);
  robots.forEach(placeRobot);
  setScene('game');
}

// ---------------------------------------------------------------------------------------------------------
// Tastatur-Testmodus
// ---------------------------------------------------------------------------------------------------------

function handleTestKeys() {
  if (keyEdge('KeyB')) armRoom(testTargetRoom(robots[1]));
  if (keyEdge('KeyN')) armRoom(testTargetRoom(robots[0]));
  if (keyEdge('KeyX')) {
    rooms.forEach((room) => {
      if (room.state === 'armed') {
        room.grace = 0;
        defuseRoom(room);
      }
    });
  }
  if (keyEdge('KeyQ')) STATE.clock = 0;
}

function testTargetRoom(r) {
  const g = goalRoom(r);
  if (g) return roomAt(g.f, g.c);
  if (r.moving) return roomAt(r.tf, r.tc);
  // sonst ein Nachbarraum
  const c = r.c + (r.c < layout.cols - 1 ? 1 : -1);
  return roomAt(r.f, c);
}

// ---------------------------------------------------------------------------------------------------------
// Partikel
// ---------------------------------------------------------------------------------------------------------

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
    p.vx *= 1 - Math.min(1, dt * 1.5);
  });
  floaters.slice().forEach((f) => {
    f.life -= dt;
    f.y -= 55 * dt;
    if (f.life <= 0) floaters.splice(floaters.indexOf(f), 1);
  });
  STATE.shake = Math.max(0, STATE.shake - dt * 40);
}

// ---------------------------------------------------------------------------------------------------------
// Zeichnen – Symbole
// ---------------------------------------------------------------------------------------------------------

function comicStroke(ctx, color, width) {
  ctx.lineJoin = 'round';
  ctx.lineCap = 'round';
  ctx.strokeStyle = '#000000';
  ctx.lineWidth = width + 6;
  ctx.stroke();
  ctx.strokeStyle = color;
  ctx.lineWidth = width;
  ctx.stroke();
}

function drawItemIcon(ctx, type, x, y, s, color) {
  ctx.save();
  ctx.translate(x, y);
  ctx.strokeStyle = color;
  ctx.fillStyle = color;
  ctx.lineWidth = Math.max(2, s * 0.12);
  ctx.lineJoin = 'round';
  ctx.lineCap = 'round';
  const key = ITEM_TYPES[type].key;
  ctx.beginPath();
  if (key === 'schluessel') {
    ctx.arc(-s * 0.45, 0, s * 0.32, 0, Math.PI * 2);
    ctx.moveTo(-s * 0.13, 0);
    ctx.lineTo(s * 0.8, 0);
    ctx.moveTo(s * 0.5, 0);
    ctx.lineTo(s * 0.5, s * 0.3);
    ctx.moveTo(s * 0.75, 0);
    ctx.lineTo(s * 0.75, s * 0.25);
  } else if (key === 'pass') {
    ctx.rect(-s * 0.5, -s * 0.65, s, s * 1.3);
    ctx.moveTo(s * 0.22, -s * 0.15);
    ctx.arc(0, -s * 0.15, s * 0.22, 0, Math.PI * 2);
    ctx.moveTo(-s * 0.3, s * 0.35);
    ctx.lineTo(s * 0.3, s * 0.35);
  } else if (key === 'geld') {
    ctx.arc(0, s * 0.15, s * 0.55, 0, Math.PI * 2);
    ctx.moveTo(-s * 0.25, -s * 0.5);
    ctx.lineTo(0, -s * 0.38);
    ctx.lineTo(s * 0.25, -s * 0.5);
    ctx.stroke();
    ctx.font = 'bold ' + Math.round(s * 0.8) + 'px Arvo';
    ctx.textAlign = 'center';
    ctx.fillText('€', 0, s * 0.42);
    ctx.restore();
    return;
  } else if (key === 'koffer') {
    ctx.rect(-s * 0.7, -s * 0.35, s * 1.4, s * 0.95);
    ctx.moveTo(-s * 0.25, -s * 0.35);
    ctx.lineTo(-s * 0.25, -s * 0.6);
    ctx.lineTo(s * 0.25, -s * 0.6);
    ctx.lineTo(s * 0.25, -s * 0.35);
    ctx.moveTo(-s * 0.7, s * 0.1);
    ctx.lineTo(s * 0.7, s * 0.1);
  } else {
    // Ticket
    ctx.moveTo(-s * 0.75, -s * 0.4);
    ctx.lineTo(s * 0.75, -s * 0.4);
    ctx.lineTo(s * 0.75, -s * 0.1);
    ctx.arc(s * 0.75, 0, s * 0.1, -Math.PI / 2, Math.PI / 2, true);
    ctx.lineTo(s * 0.75, s * 0.4);
    ctx.lineTo(-s * 0.75, s * 0.4);
    ctx.lineTo(-s * 0.75, -s * 0.4);
    ctx.moveTo(s * 0.3, -s * 0.3);
    ctx.lineTo(s * 0.3, s * 0.3);
  }
  ctx.stroke();
  ctx.restore();
}

function drawExitIcon(ctx, x, y, s, color) {
  ctx.save();
  ctx.strokeStyle = color;
  ctx.lineWidth = Math.max(2, s * 0.12);
  ctx.lineJoin = 'round';
  ctx.beginPath();
  ctx.rect(x - s * 0.45, y - s * 0.7, s * 0.9, s * 1.4);
  ctx.moveTo(x + s * 0.2, y);
  ctx.arc(x + s * 0.2, y, s * 0.06, 0, Math.PI * 2);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(x + s * 0.6, y - s * 0.3);
  ctx.lineTo(x + s * 0.95, y);
  ctx.lineTo(x + s * 0.6, y + s * 0.3);
  ctx.stroke();
  ctx.restore();
}

function drawTrapIcon(ctx, type, x, y, s, color, armed) {
  const t = STATE.time;
  ctx.save();
  ctx.translate(x, y);
  if (armed) ctx.rotate(Math.sin(t * 9) * 0.12);
  ctx.strokeStyle = color;
  ctx.lineWidth = 4;
  ctx.lineJoin = 'round';
  ctx.lineCap = 'round';
  ctx.beginPath();
  if (type === 'eimer') {
    ctx.moveTo(-s * 0.6, -s * 0.45);
    ctx.lineTo(-s * 0.42, s * 0.55);
    ctx.lineTo(s * 0.42, s * 0.55);
    ctx.lineTo(s * 0.6, -s * 0.45);
    ctx.closePath();
    ctx.moveTo(-s * 0.6, -s * 0.45);
    ctx.quadraticCurveTo(0, -s * 1.1, s * 0.6, -s * 0.45);
    ctx.stroke();
    if (armed) {
      ctx.beginPath();
      ctx.moveTo(-s * 0.5, -s * 0.3);
      ctx.quadraticCurveTo(0, -s * 0.1 + Math.sin(t * 6) * 4, s * 0.5, -s * 0.3);
      ctx.strokeStyle = PAL.water;
      ctx.stroke();
    }
  } else if (type === 'bombe') {
    ctx.arc(0, s * 0.12, s * 0.5, 0, Math.PI * 2);
    ctx.moveTo(s * 0.25, -s * 0.3);
    ctx.quadraticCurveTo(s * 0.45, -s * 0.75, s * 0.75, -s * 0.6);
    ctx.stroke();
    if (armed) {
      ctx.fillStyle = PAL.spark;
      const r = 5 + Math.random() * 6;
      ctx.beginPath();
      ctx.arc(s * 0.75, -s * 0.6, r, 0, Math.PI * 2);
      ctx.fill();
    }
  } else {
    // Sprungfeder
    const n = 5;
    const amp = s * 0.5;
    const hgt = armed ? s * (1.2 + Math.sin(t * 8) * 0.12) : s * 1.1;
    ctx.moveTo(-amp, s * 0.6);
    ctx.lineTo(amp, s * 0.6);
    let yy = s * 0.6;
    for (let i = 0; i < n; i++) {
      yy -= hgt / n;
      ctx.lineTo(i % 2 === 0 ? -amp : amp, yy);
    }
    ctx.moveTo(-amp, yy);
    ctx.lineTo(amp, yy);
    ctx.stroke();
  }
  ctx.restore();
}

function drawStar(ctx, x, y, r, color) {
  ctx.save();
  ctx.fillStyle = color;
  ctx.beginPath();
  for (let i = 0; i < 10; i++) {
    const a = (i * Math.PI) / 5 - Math.PI / 2;
    const rr = i % 2 === 0 ? r : r * 0.45;
    if (i === 0) ctx.moveTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr);
    else ctx.lineTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr);
  }
  ctx.closePath();
  ctx.fill();
  ctx.restore();
}

// ---------------------------------------------------------------------------------------------------------
// Zeichnen – Haus
// ---------------------------------------------------------------------------------------------------------

function renderSky(ctx) {
  ctx.save();
  ctx.fillStyle = PAL.sky;
  ctx.fillRect(STRIP, 0, W - 2 * STRIP, HOUSE.top);
  stars.forEach((s) => {
    if (s.x < STRIP || s.x > W - STRIP) return;
    ctx.globalAlpha = 0.4 + 0.4 * Math.sin(STATE.time * 1.5 + s.p);
    ctx.fillStyle = PAL.star;
    ctx.fillRect(s.x, s.y, 3, 3);
  });
  ctx.restore();
}

function renderRoof(ctx) {
  const cx = (HOUSE.x0 + HOUSE.x1) / 2;
  ctx.save();
  ctx.beginPath();
  ctx.moveTo(HOUSE.x0 - 30, HOUSE.top);
  ctx.lineTo(cx - 260, HOUSE.roofTop);
  ctx.lineTo(cx + 260, HOUSE.roofTop);
  ctx.lineTo(HOUSE.x1 + 30, HOUSE.top);
  ctx.closePath();
  ctx.fillStyle = '#000000';
  ctx.fill();
  comicStroke(ctx, PAL.roof, 4);
  // Dachziegel-Bögen
  ctx.strokeStyle = PAL.wallDim;
  ctx.lineWidth = 2;
  for (let row = 1; row < 3; row++) {
    const y = HOUSE.roofTop + row * 36;
    const t = (y - HOUSE.roofTop) / (HOUSE.top - HOUSE.roofTop);
    const xa = cx - 260 + t * (HOUSE.x0 - 30 - (cx - 260));
    const xb = cx + 260 + t * (HOUSE.x1 + 30 - (cx + 260));
    ctx.beginPath();
    for (let x = xa + 20; x < xb - 20; x += 40) {
      ctx.moveTo(x + 18, y);
      ctx.arc(x, y, 18, 0, Math.PI);
    }
    ctx.stroke();
  }
  ctx.restore();
}

function renderHouse(ctx) {
  ensureWallpaper();
  const w = HOUSE.x1 - HOUSE.x0;
  const h = HOUSE.bottom - HOUSE.top;
  ctx.drawImage(wallpaper, HOUSE.x0, HOUSE.top);
  // Möbel, Leitern, Ausgang, Gegenstände
  rooms.forEach((room) => renderRoomFurniture(ctx, room));
  // Wände/Decken als Comic-Kontur
  ctx.save();
  ctx.beginPath();
  for (let f = 1; f < layout.rows; f++) {
    const y = HOUSE.top + f * layout.roomH;
    ctx.moveTo(HOUSE.x0, y);
    ctx.lineTo(HOUSE.x1, y);
  }
  for (let c = 1; c < layout.cols; c++) {
    const x = HOUSE.x0 + c * layout.roomW;
    for (let f = 0; f < layout.rows; f++) {
      // Wand mit Türöffnung unten
      const top = HOUSE.top + f * layout.roomH;
      ctx.moveTo(x, top);
      ctx.lineTo(x, top + layout.roomH * 0.35);
    }
  }
  comicStroke(ctx, PAL.wall, 4);
  ctx.beginPath();
  ctx.rect(HOUSE.x0, HOUSE.top, w, h);
  comicStroke(ctx, PAL.wall, 6);
  ctx.restore();
}

function renderRoomFurniture(ctx, room) {
  const cx = roomCX(room.c);
  const top = roomTop(room.f);
  const fl = floorY(room.f);
  const rh = layout.roomH;
  ctx.save();
  ctx.lineJoin = 'round';
  // Leiter (Verbindung nach oben)
  if (room.f > 0) {
    ctx.strokeStyle = PAL.wallDim;
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(cx - 18, fl);
    ctx.lineTo(cx - 18, top - 4);
    ctx.moveTo(cx + 18, fl);
    ctx.lineTo(cx + 18, top - 4);
    for (let y = fl - 25; y > top; y -= 32) {
      ctx.moveTo(cx - 18, y);
      ctx.lineTo(cx + 18, y);
    }
    ctx.stroke();
  }
  // Möbel passend zur Falle
  ctx.beginPath();
  if (room.type === 'eimer') {
    const dw = Math.min(110, layout.roomW * 0.34);
    const dt = room.sy + SETTINGS.slotRadius + 8;
    ctx.rect(room.sx - dw / 2, dt, dw, fl - dt);
    ctx.moveTo(room.sx + dw * 0.3, (dt + fl) / 2);
    ctx.arc(room.sx + dw * 0.3, (dt + fl) / 2, 4, 0, Math.PI * 2);
  } else if (room.type === 'bombe') {
    const sw = Math.min(140, layout.roomW * 0.42);
    const st = room.sy - SETTINGS.slotRadius - 24;
    ctx.rect(room.sx - sw / 2, st, sw, fl - st);
    ctx.moveTo(room.sx, st);
    ctx.lineTo(room.sx, fl);
  } else {
    ctx.moveTo(room.sx - 70, fl + 2);
    ctx.lineTo(room.sx + 70, fl + 2);
  }
  ctx.strokeStyle = PAL.wallDim;
  ctx.lineWidth = 4;
  ctx.stroke();
  // Ausgangstür
  if (room.f === layout.exitF && room.c === layout.exitC) {
    const ex = cx - room.dir * Math.min(layout.roomW * 0.28, layout.roomW / 2 - 75);
    const dh = Math.min(rh * 0.62, 170);
    ctx.beginPath();
    ctx.rect(ex - 45, fl - dh, 90, dh);
    comicStroke(ctx, PAL.warn, 4);
    util.renderText({ ctx, text: 'AUSGANG', x: ex, y: fl - dh - 12, fontSize: '26px', fillStyle: PAL.warn });
  }
  ctx.restore();
  // Gegenstände im Raum
  let k = 0;
  items.forEach((it) => {
    if (it.holder !== -1 || it.f !== room.f || it.c !== room.c) return;
    const ix = cx - room.dir * layout.roomW * 0.28 + k * 40 * -room.dir;
    const isExitRoom = room.f === layout.exitF && room.c === layout.exitC;
    const iy = top + rh * (isExitRoom ? 0.2 : 0.38) + Math.sin(STATE.time * 2 + k) * 5;
    ctx.save();
    ctx.shadowColor = PAL.item;
    ctx.shadowBlur = 16;
    drawItemIcon(ctx, it.type, ix, iy, 30, PAL.item);
    ctx.restore();
    k++;
  });
}

function renderSlots(ctx) {
  rooms.forEach((room) => {
    const r = SETTINGS.slotRadius;
    const v = room.button ? room.button.getValue() : 0;
    ctx.save();
    ctx.beginPath();
    ctx.arc(room.sx, room.sy, r, 0, Math.PI * 2);
    ctx.fillStyle = '#000000';
    ctx.fill();
    let ring = PAL.trapEmpty;
    if (room.state === 'armed') ring = room.grace > 0 && Math.floor(STATE.time * 8) % 2 === 0 ? PAL.flash : PAL.warn;
    if (room.state === 'broken') ring = PAL.trapBroken;
    ctx.strokeStyle = ring;
    ctx.lineWidth = room.state === 'armed' ? 5 : 3;
    if (room.state === 'empty') ctx.setLineDash([10, 8]);
    ctx.stroke();
    ctx.setLineDash([]);
    if (v > 0) {
      ctx.beginPath();
      ctx.arc(room.sx, room.sy, r - 7, -Math.PI / 2, -Math.PI / 2 + (Math.PI * 2 * v) / 100);
      ctx.strokeStyle = room.state === 'armed' ? PAL.defuse : PAL.warn;
      ctx.lineWidth = 8;
      ctx.stroke();
    }
    if (room.state === 'armed') {
      ctx.shadowColor = PAL.warn;
      ctx.shadowBlur = 18;
    }
    const iconColor = room.state === 'armed' ? PAL.warn : room.state === 'broken' ? PAL.trapBroken : PAL.trapEmpty;
    drawTrapIcon(ctx, room.type, room.sx, room.sy, 24, iconColor, room.state === 'armed');
    ctx.shadowBlur = 0;
    if (room.state === 'broken') {
      ctx.strokeStyle = PAL.trapBroken;
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.moveTo(room.sx - 25, room.sy - 25);
      ctx.lineTo(room.sx + 25, room.sy + 25);
      ctx.stroke();
    }
    ctx.restore();
  });
}

// ---------------------------------------------------------------------------------------------------------
// Zeichnen – Figuren
// ---------------------------------------------------------------------------------------------------------

function renderRobot(ctx, r) {
  if (r.state === 'escaped' && STATE.scene !== 'levelup') return;
  const side = r.side;
  const s = robotHeight() / 120;
  const soot = r.effect === 'soot';
  const color = soot ? PAL.soot : PAL.team[side];
  const dark = soot ? '#000000' : PAL.teamDark[side];
  let x = r.x;
  let y = r.y;
  // beide im selben Raum: etwas auseinanderschieben
  const o = robots[1 - side];
  if (!r.moving && !o.moving && o.f === r.f && o.c === r.c && r.state !== 'fly') x += side === 0 ? -34 : 34;
  if (r.state === 'escaped') {
    const k = Math.max(0, 1 - r.stateTime / 1.5);
    if (k <= 0) return;
    ctx.save();
    ctx.globalAlpha = k;
  } else {
    ctx.save();
  }
  ctx.translate(x, y);
  if (r.state === 'fly') ctx.rotate(r.stateTime * 9 * (side === 0 ? 1 : -1));
  ctx.scale(s * r.face, s);
  const walk = r.moving && r.state === 'walk' ? Math.sin(r.walkPhase) : 0;
  const bob = Math.abs(walk) * 4;
  // Beine
  ctx.beginPath();
  ctx.moveTo(-12, -30);
  ctx.lineTo(-12 + walk * 12, 0);
  ctx.moveTo(12, -30);
  ctx.lineTo(12 - walk * 12, 0);
  comicStroke(ctx, color, 5);
  ctx.translate(0, -bob);
  // Werkzeug (Besen bzw. Mopp) hinter dem Körper
  ctx.beginPath();
  ctx.moveTo(-34, -40);
  ctx.lineTo(-12, -100);
  comicStroke(ctx, PAL.wallDim, 4);
  ctx.beginPath();
  if (side === 0) {
    ctx.moveTo(-48, -32);
    ctx.lineTo(-22, -42);
    ctx.lineTo(-30, -20);
    ctx.closePath();
  } else {
    for (let i = 0; i < 5; i++) {
      ctx.moveTo(-34, -40);
      ctx.lineTo(-46 + i * 6, -14 + Math.sin(STATE.time * 6 + i) * 3);
    }
  }
  comicStroke(ctx, PAL.wallDim, 3);
  // Körper
  ctx.beginPath();
  ctx.rect(-28, -82, 56, 52);
  ctx.fillStyle = dark;
  ctx.fill();
  comicStroke(ctx, color, 4);
  // Bauchklappe
  ctx.beginPath();
  ctx.rect(-14, -70, 28, 18);
  ctx.strokeStyle = color;
  ctx.lineWidth = 2;
  ctx.stroke();
  // Kopf
  ctx.beginPath();
  ctx.arc(0, -86, 24, Math.PI, 0);
  ctx.closePath();
  ctx.fillStyle = dark;
  ctx.fill();
  comicStroke(ctx, color, 4);
  // Visier + Auge
  ctx.beginPath();
  ctx.rect(-4, -102, 24, 10);
  ctx.fillStyle = '#000000';
  ctx.fill();
  ctx.fillStyle = soot ? '#ffffff' : color;
  ctx.fillRect(r.dazzle > SETTINGS.dazzleThreshold ? 2 : 10, -100, 7, 6);
  // Antenne
  ctx.beginPath();
  ctx.moveTo(0, -110);
  ctx.lineTo(0, -126);
  ctx.strokeStyle = color;
  ctx.lineWidth = 3;
  ctx.stroke();
  ctx.beginPath();
  ctx.arc(0, -130, 5, 0, Math.PI * 2);
  ctx.fillStyle = Math.sin(STATE.time * 5 + side) > 0 ? PAL.warn : dark;
  ctx.fill();
  // Arm (im Kampf wild)
  ctx.beginPath();
  ctx.moveTo(20, -70);
  if (r.state === 'fight') ctx.lineTo(42, -90 + Math.sin(STATE.time * 30) * 20);
  else if (r.dazzle > SETTINGS.dazzleThreshold) ctx.lineTo(16, -98);
  else ctx.lineTo(36, -50 - walk * 6);
  comicStroke(ctx, color, 5);
  ctx.restore();

  // Effekte (ohne Spiegelung)
  const top = y - robotHeight() * 1.1;
  if (r.effect === 'wet' && r.state === 'stun') {
    ctx.save();
    ctx.fillStyle = PAL.water;
    for (let i = 0; i < 5; i++) {
      const py = top + ((STATE.time * 140 + i * 30) % (robotHeight() * 1.1));
      ctx.fillRect(x - 30 + i * 15, py, 4, 10);
    }
    ctx.beginPath();
    ctx.ellipse(x, y + 4, 50, 8, 0, 0, Math.PI * 2);
    ctx.strokeStyle = PAL.water;
    ctx.lineWidth = 3;
    ctx.stroke();
    ctx.restore();
  }
  if (r.effect === 'soot' && r.state === 'stun') {
    ctx.save();
    ctx.globalAlpha = 0.6;
    ctx.fillStyle = PAL.cloud;
    for (let i = 0; i < 3; i++) {
      const t = (STATE.time * 0.8 + i / 3) % 1;
      ctx.beginPath();
      ctx.arc(x + Math.sin(i * 2 + STATE.time) * 12, top - t * 60, 8 + t * 14, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }
  if (r.effect === 'stars' && r.state === 'stun') {
    for (let i = 0; i < 3; i++) {
      const a = STATE.time * 4 + (i * Math.PI * 2) / 3;
      drawStar(ctx, x + Math.cos(a) * 38, top + 10 + Math.sin(a) * 10, 11, PAL.spark);
    }
  }
  // getragene Gegenstände über dem Kopf
  if (r.state !== 'escaped') {
    r.items.forEach((idx, i) => {
      const ix = x + (i - (r.items.length - 1) / 2) * 38;
      drawItemIcon(ctx, items[idx].type, ix, top - 18, 15, PAL.team[side]);
    });
  }
  // Sprechblase
  if (r.sayTime > 0 && r.say) renderBubble(ctx, x, top - (r.items.length ? 50 : 20), r.say, PAL.team[side]);
}

function renderBubble(ctx, x, y, text, color) {
  ctx.save();
  ctx.font = 'bold 30px Arvo';
  const w = Math.max(80, ctx.measureText(text).width + 30);
  const bx = Math.max(STRIP + 10 + w / 2, Math.min(W - STRIP - 10 - w / 2, x));
  ctx.beginPath();
  ctx.rect(bx - w / 2, y - 48, w, 44);
  ctx.moveTo(x - 8, y - 4);
  ctx.lineTo(x, y + 10);
  ctx.lineTo(x + 8, y - 4);
  ctx.fillStyle = '#000000';
  ctx.fill();
  ctx.strokeStyle = color;
  ctx.lineWidth = 3;
  ctx.stroke();
  util.renderText({ ctx, text, x: bx, y: y - 15, fontSize: '30px', fillStyle: color });
  ctx.restore();
}

function renderGoalLines(ctx) {
  robots.forEach((r) => {
    if (r.state === 'escaped') return;
    const g = goalRoom(r);
    if (!g) return;
    const gx = roomCX(g.c) + (r.side === 0 ? -12 : 12);
    const gy = floorY(g.f) - layout.roomH * 0.15;
    ctx.save();
    ctx.globalAlpha = 0.7;
    ctx.setLineDash([14, 12]);
    ctx.lineDashOffset = -STATE.time * 40;
    ctx.strokeStyle = PAL.teamDim[r.side];
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.moveTo(r.x, r.y - robotHeight() * 0.3);
    ctx.lineTo(gx, r.y - robotHeight() * 0.3);
    ctx.lineTo(gx, gy);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.beginPath();
    ctx.arc(gx, gy, 14 + Math.sin(STATE.time * 5) * 4, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();
  });
}

function renderFightCloud(ctx) {
  const fight = STATE.fight;
  if (!fight) return;
  const t = STATE.time;
  ctx.save();
  ctx.translate(fight.x, fight.y);
  // Gliedmaßen, die aus der Wolke ragen
  for (let i = 0; i < 6; i++) {
    const a = t * 3 + i * 1.3 + Math.sin(t * 7 + i) * 0.6;
    ctx.beginPath();
    ctx.moveTo(Math.cos(a) * 50, Math.sin(a) * 30);
    ctx.lineTo(Math.cos(a) * 125, Math.sin(a) * 80);
    comicStroke(ctx, PAL.team[i % 2], 6);
  }
  ctx.beginPath();
  for (let i = 0; i < 9; i++) {
    const a = (i / 9) * Math.PI * 2;
    const rr = 34 + Math.sin(t * 9 + i * 2) * 8;
    ctx.moveTo(Math.cos(a) * 75 + rr, Math.sin(a) * 42);
    ctx.arc(Math.cos(a) * 75, Math.sin(a) * 42, rr, 0, Math.PI * 2);
  }
  ctx.fillStyle = '#000000';
  ctx.fill();
  comicStroke(ctx, PAL.cloud, 3);
  const words = ['ZACK!', 'POW!', 'BONK!', 'KLONG!'];
  const wi = Math.floor(t * 3) % words.length;
  ctx.rotate(Math.sin(t * 4) * 0.2);
  util.renderText({ ctx, text: words[wi], x: 0, y: 14, fontSize: '44px', fillStyle: PAL.warn });
  ctx.restore();
  for (let i = 0; i < 3; i++) {
    const a = t * 5 + (i * Math.PI * 2) / 3;
    drawStar(ctx, fight.x + Math.cos(a) * 140, fight.y - 60 + Math.sin(a) * 30, 12, PAL.spark);
  }
  // Balken
  const bw = 420;
  const by = fight.y - 130;
  ctx.save();
  ctx.fillStyle = '#000000';
  ctx.fillRect(fight.x - bw / 2 - 6, by - 18, bw + 12, 36);
  const mid = fight.x + (fight.balance * bw) / 2;
  ctx.fillStyle = PAL.teamDim[0];
  ctx.fillRect(fight.x - bw / 2, by - 12, mid - (fight.x - bw / 2), 24);
  ctx.fillStyle = PAL.teamDim[1];
  ctx.fillRect(mid, by - 12, fight.x + bw / 2 - mid, 24);
  ctx.fillStyle = PAL.warn;
  ctx.fillRect(mid - 4, by - 20, 8, 40);
  ctx.restore();
}

function renderParticles(ctx) {
  ctx.save();
  particles.forEach((p) => {
    ctx.globalAlpha = Math.max(0, p.life / p.max);
    if (p.kind === 'star') drawStar(ctx, p.x, p.y, p.size * 1.6, p.color);
    else if (p.kind === 'drop') {
      ctx.fillStyle = p.color;
      ctx.fillRect(p.x, p.y, 3, p.size * 2);
    } else {
      ctx.fillStyle = p.color;
      ctx.fillRect(p.x - p.size / 2, p.y - p.size / 2, p.size, p.size);
    }
  });
  ctx.globalAlpha = 1;
  floaters.forEach((f) => {
    ctx.globalAlpha = Math.max(0, Math.min(1, f.life));
    renderTextDropShadow({ ctx, text: f.text, x: f.x, y: f.y, fontSize: f.size + 'px', lineHeight: f.size, fillStyle: f.color, dropDistX: 3, dropDistY: 3 });
  });
  ctx.restore();
}

// ---------------------------------------------------------------------------------------------------------
// Zeichnen – Randleisten & HUD
// ---------------------------------------------------------------------------------------------------------

function renderStrip(ctx, side) {
  const x0 = side === 0 ? 0 : W - STRIP;
  const cx = x0 + STRIP / 2;
  const color = PAL.team[side];
  const r = robots[side];
  ctx.save();
  ctx.fillStyle = '#000000';
  ctx.fillRect(x0, 0, STRIP, H);
  ctx.strokeStyle = PAL.teamDim[side];
  ctx.lineWidth = 3;
  ctx.strokeRect(x0 + 6, 6, STRIP - 12, H - 12);
  ctx.restore();
  util.renderText({ ctx, text: TEAMS[side].name, x: cx, y: 58, fontSize: '42px', fillStyle: color });
  // Inventar
  const need = layout.def.need;
  util.renderText({ ctx, text: r.items.length + '/' + need, x: cx, y: 112, fontSize: '40px', fillStyle: r.items.length >= need ? PAL.warn : PAL.teamDim[side] });
  // Rundensiege
  for (let i = 0; i < SETTINGS.winsNeeded; i++) {
    ctx.beginPath();
    ctx.arc(cx - 40 + i * 40, 145, 11, 0, Math.PI * 2);
    ctx.fillStyle = i < STATE.wins[side] ? color : '#000000';
    ctx.fill();
    ctx.strokeStyle = color;
    ctx.lineWidth = 2;
    ctx.stroke();
  }
  if (STATE.fight) {
    renderFightPad(ctx, side);
    return;
  }
  util.renderText({ ctx, text: 'ZIEL', x: cx, y: votePos(side, 0).y - SETTINGS.padRadius - 18, fontSize: '30px', fillStyle: PAL.teamDim[side] });
  const vg = votes[side];
  const n = voteCount();
  for (let i = 0; i < n; i++) {
    const p = votePos(side, i);
    const counter = vg ? vg.getCounter(i) : 0;
    const isExit = i === n - 1;
    const it = isExit ? null : items[i];
    const mine = it && it.holder === side;
    const theirs = it && it.holder === 1 - side;
    const isGoal = r.goal && ((isExit && r.goal.kind === 'exit') || (!isExit && r.goal.kind === 'item' && r.goal.idx === i));
    const blocked = mine || (isExit && r.items.length < need);
    const c = blocked ? PAL.teamDark[side] : color;
    ctx.save();
    util.drawNgon({ ctx, color: '#000000', Xcenter: p.x, Ycenter: p.y, size: SETTINGS.padRadius, numberOfSides: 8, lineWidth: 1, filled: true });
    util.drawNgon({ ctx, color: c, Xcenter: p.x, Ycenter: p.y, size: SETTINGS.padRadius, numberOfSides: 8, lineWidth: isGoal ? 6 : 3 });
    if (counter > 0) {
      ctx.globalAlpha = 0.35;
      util.drawNgon({ ctx, color: c, Xcenter: p.x, Ycenter: p.y, size: SETTINGS.padRadius * Math.min(1, counter / 100), numberOfSides: 8, lineWidth: 1, filled: true });
      ctx.globalAlpha = 1;
    }
    if (isExit) drawExitIcon(ctx, p.x - 8, p.y, 30, c);
    else if (it) drawItemIcon(ctx, it.type, p.x, p.y, 26, c);
    if (mine) util.renderText({ ctx, text: '✓', x: p.x + 38, y: p.y - 26, fontSize: '30px', fillStyle: color });
    if (theirs) util.renderText({ ctx, text: '!', x: p.x + 40, y: p.y - 22, fontSize: '36px', fillStyle: PAL.warn });
    ctx.restore();
  }
  // aktuelles Ziel
  let goalText = 'Autopilot…';
  if (r.state === 'escaped') goalText = 'Entkommen!';
  else if (r.goal && r.goal.kind === 'exit') goalText = '→ Ausgang';
  else if (r.goal && items[r.goal.idx]) goalText = '→ ' + ITEM_TYPES[items[r.goal.idx].type].name;
  util.renderText({ ctx, text: goalText, x: cx, y: 1035, fontSize: '28px', fillStyle: PAL.teamDim[side] });
}

function renderFightPad(ctx, side) {
  const x = side === 0 ? STRIP / 2 : W - STRIP / 2;
  const y = 600;
  const rr = SETTINGS.fightPadRadius;
  const color = PAL.team[side];
  const force = robots[side].force;
  ctx.save();
  util.drawNgon({ ctx, color: '#000000', Xcenter: x, Ycenter: y, size: rr, numberOfSides: 10, lineWidth: 1, filled: true });
  util.drawNgon({ ctx, color, Xcenter: x, Ycenter: y, size: rr + Math.sin(STATE.time * 10) * 4, numberOfSides: 10, lineWidth: 5 });
  if (force > 0.02) {
    ctx.beginPath();
    ctx.arc(x, y, rr - 10, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * force);
    ctx.strokeStyle = PAL.warn;
    ctx.lineWidth = 10;
    ctx.stroke();
  }
  ctx.restore();
  util.renderText({ ctx, text: 'KLOPPEN!', x, y: y - rr - 30, fontSize: '40px', fillStyle: color });
  util.renderText({ ctx, text: 'alle hier\nleuchten!', x, y: y + rr + 50, fontSize: '32px', lineHeight: 40, fillStyle: PAL.teamDim[side] });
}

function renderHud(ctx) {
  const cx = W / 2;
  util.renderText({
    ctx,
    text: 'Runde ' + (STATE.round + 1) + ' von max. ' + SETTINGS.maxRounds + '  ·  ' + STATE.wins[0] + ' : ' + STATE.wins[1],
    x: cx,
    y: 62,
    fontSize: '44px',
    fillStyle: PAL.hud,
  });
  const t = Math.max(0, Math.ceil(STATE.clock));
  const mm = Math.floor(t / 60);
  const ss = t % 60;
  util.renderText({
    ctx,
    text: mm + ':' + (ss < 10 ? '0' : '') + ss,
    x: cx,
    y: 222,
    fontSize: '50px',
    fillStyle: STATE.clock < 10 && Math.floor(STATE.time * 4) % 2 === 0 ? PAL.warn : PAL.hud,
  });
  util.renderText({ ctx, text: 'Brauche ' + layout.def.need + ' Sachen, dann zum Ausgang', x: cx, y: 112, fontSize: '30px', fillStyle: PAL.hudDim });
}

function renderFlash(ctx, dt) {
  if (STATE.flash <= 0) return;
  ctx.save();
  ctx.globalAlpha = Math.min(0.5, STATE.flash);
  ctx.fillStyle = STATE.flashColor;
  ctx.fillRect(STRIP, 0, W - 2 * STRIP, H);
  ctx.restore();
  STATE.flash = Math.max(0, STATE.flash - dt);
}

function renderWorld(ctx, dt) {
  renderSky(ctx);
  ctx.save();
  if (STATE.shake > 0) ctx.translate((Math.random() - 0.5) * STATE.shake, (Math.random() - 0.5) * STATE.shake);
  renderRoof(ctx);
  renderHouse(ctx);
  renderSlots(ctx);
  renderGoalLines(ctx);
  robots.forEach((r) => renderRobot(ctx, r));
  renderFightCloud(ctx);
  renderParticles(ctx);
  ctx.restore();
  renderFlash(ctx, dt);
}

// ---------------------------------------------------------------------------------------------------------
// Szenen
// ---------------------------------------------------------------------------------------------------------

function handleTitle(grid, dt, ctx) {
  // Demo: Figuren wandern durchs Haus, gedimmt
  robots.forEach((r) => {
    r.walkPhase += dt * 6;
    if (r.sayTime <= 0 && Math.random() < dt * 0.3) say(r, QUIPS[Math.floor(Math.random() * QUIPS.length)], 2);
    r.sayTime = Math.max(0, r.sayTime - dt);
  });
  ctx.save();
  ctx.globalAlpha = 0.45;
  renderSky(ctx);
  renderRoof(ctx);
  renderHouse(ctx);
  renderSlots(ctx);
  ctx.restore();
  robots.forEach((r) => renderRobot(ctx, r));
  // schwarze Leisten links/rechts
  ctx.save();
  ctx.fillStyle = '#000000';
  ctx.fillRect(0, 0, STRIP, H);
  ctx.fillRect(W - STRIP, 0, STRIP, H);
  // Titel-Panel (Aktionsfläche schwarz)
  ctx.fillStyle = '#000000';
  ctx.fillRect(560, 300, 800, 470);
  ctx.strokeStyle = PAL.wall;
  ctx.lineWidth = 4;
  ctx.strokeRect(560, 300, 800, 470);
  ctx.restore();
  renderTextDropShadow({ ctx, text: 'Fallensteller', x: W / 2, y: 190, fontSize: '150px', fillStyle: PAL.title });
  util.renderText({ ctx, text: 'Kehrbert gegen Wischa – ein Haus, zwei Teams, viele Eimer', x: W / 2, y: 268, fontSize: '42px', fillStyle: PAL.sub });
  util.renderText({ ctx, text: 'LINKS\n=\nKehrbert', x: STRIP / 2, y: 110, fontSize: '40px', lineHeight: 50, fillStyle: PAL.team[0] });
  util.renderText({ ctx, text: 'RECHTS\n=\nWischa', x: W - STRIP / 2, y: 110, fontSize: '40px', lineHeight: 50, fillStyle: PAL.team[1] });
  util.renderText({
    ctx,
    text: 'Ziel-Pads am eigenen Rand füllen · Fallen-Slots im Haus\nanleuchten = scharf · nochmal = entschärft',
    x: W / 2,
    y: 360,
    fontSize: '32px',
    lineHeight: 44,
    fillStyle: PAL.hudDim,
  });
  if (!startButton) {
    startButton = guiFillButton({
      label: 'START',
      posX: W / 2,
      posY: 590,
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
  util.renderText({ ctx, text: 'Best of 5 · Spy vs. Spy lässt grüßen', x: W / 2, y: 1000, fontSize: '36px', fillStyle: PAL.hudDim });
  if (keyEdge('Space')) startGame();
  highscore.renderHighAndLowScores(ctx);
}

function handleGame(grid, dt, ctx) {
  ensureVotes();
  handleTestKeys();
  if (STATE.countdown > 0) STATE.countdown -= dt;
  else if (!STATE.fight) STATE.clock -= dt;
  STATE.fightCooldown = Math.max(0, STATE.fightCooldown - dt);

  updateSlots(grid, dt);
  updateSensors(grid, dt);
  if (STATE.fight) updateFight(grid, dt);
  else {
    votes[0].handle(grid, dt);
    votes[1].handle(grid, dt);
  }
  robots.forEach((r) => updateRobot(r, dt));
  if (STATE.scene === 'game') checkFight();
  updateParticles(dt);

  renderWorld(ctx, dt);
  renderHud(ctx);
  renderStrip(ctx, 0);
  renderStrip(ctx, 1);
  if (STATE.scene !== 'game') return;
  if (STATE.countdown > 0) {
    const n = Math.ceil(STATE.countdown);
    renderTextDropShadow({ ctx, text: 'RUNDE ' + (STATE.round + 1), x: W / 2, y: 520, fontSize: '120px', fillStyle: PAL.title });
    util.renderText({ ctx, text: n > 0 ? String(n) : 'LOS!', x: W / 2, y: 640, fontSize: '90px', fillStyle: PAL.warn });
  }
  if (STATE.clock <= 0) timeoutRound();
}

function handleLevelUp(grid, dt, ctx) {
  updateParticles(dt);
  robots.forEach((r) => {
    r.stateTime += dt;
    r.sayTime = Math.max(0, r.sayTime - dt);
  });
  if (Math.random() < dt * 6 && STATE.lastWinner >= 0) {
    addParticles(STRIP + Math.random() * (W - 2 * STRIP), 300 + Math.random() * 400, 10, PAL.team[STATE.lastWinner], 200, 150, 'star');
  }
  renderWorld(ctx, dt);
  renderStrip(ctx, 0);
  renderStrip(ctx, 1);
  ctx.save();
  ctx.fillStyle = '#000000';
  ctx.globalAlpha = 0.75;
  ctx.fillRect(STRIP, 330, W - 2 * STRIP, 380);
  ctx.restore();
  const s = 1 + Math.max(0, 0.4 - STATE.sceneTime) * 1.5;
  const w = STATE.lastWinner;
  ctx.save();
  ctx.translate(W / 2, 470);
  ctx.scale(s, s);
  renderTextDropShadow({
    ctx,
    text: w >= 0 ? 'RUNDE AN ' + TEAMS[w].name.toUpperCase() + '!' : 'UNENTSCHIEDEN',
    x: 0,
    y: 0,
    fontSize: '110px',
    fillStyle: w >= 0 ? PAL.team[w] : PAL.title,
  });
  ctx.restore();
  util.renderText({ ctx, text: STATE.lastReason, x: W / 2, y: 555, fontSize: '44px', fillStyle: PAL.sub });
  util.renderText({ ctx, text: 'Stand ' + STATE.wins[0] + ' : ' + STATE.wins[1], x: W / 2, y: 625, fontSize: '50px', fillStyle: PAL.hud });
  if (!matchOver() && STATE.sceneTime > 1.8) {
    util.renderText({ ctx, text: 'Nächste Runde: ' + ROUNDS[Math.min(ROUNDS.length - 1, STATE.round + 1)].news, x: W / 2, y: 690, fontSize: '36px', fillStyle: PAL.warn });
  }
  if (STATE.sceneTime >= SETTINGS.roundEndDuration || (STATE.sceneTime > 1 && keyEdge('Space'))) {
    if (matchOver()) endMatch();
    else nextRound();
  }
}

function handleGameOver(grid, dt, ctx) {
  updateParticles(dt);
  const w = STATE.matchWinner;
  if (Math.random() < dt * 8) {
    addParticles(Math.random() * W, 200 + Math.random() * 300, 8, w >= 0 ? PAL.team[w] : PAL.title, 220, 160, 'star');
  }
  renderSky(ctx);
  renderParticles(ctx);
  renderTextDropShadow({
    ctx,
    text: w >= 0 ? TEAMS[w].name + ' gewinnt!' : 'Unentschieden!',
    x: W / 2,
    y: 190,
    fontSize: '130px',
    fillStyle: w >= 0 ? PAL.team[w] : PAL.title,
  });
  util.renderText({
    ctx,
    text: 'Team ' + (w >= 0 ? TEAMS[w].side : 'Links & Rechts') + ' · Endstand ' + STATE.wins[0] + ' : ' + STATE.wins[1],
    x: W / 2,
    y: 280,
    fontSize: '48px',
    fillStyle: PAL.sub,
  });
  util.renderText({
    ctx,
    text:
      Math.round(STATE.score) + ' Chaos-Punkte' + (STATE.newHighscore ? '  – NEUER HIGHSCORE!' : '') + '\n' +
      'Fallen gelegt: ' + STATS.armed + ' · entschärft: ' + STATS.defused + '\n' +
      'Reingetappt: Kehrbert ' + STATS.trapHits[0] + '× · Wischa ' + STATS.trapHits[1] + '×\n' +
      'Kloppereien: ' + STATS.fights + ' · geklaut: ' + STATS.steals + '\n' +
      'Geblendet: ' + Math.round(STATS.dazzleSeconds[0]) + ' s / ' + Math.round(STATS.dazzleSeconds[1]) + ' s',
    x: W / 2,
    y: 370,
    fontSize: '40px',
    lineHeight: 58,
    fillStyle: PAL.hud,
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
    ctx.save();
    ctx.beginPath();
    ctx.arc(W / 2, 880, 100, 0, Math.PI * 2);
    ctx.fillStyle = '#000000';
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
  name: 'Fallensteller',
  description: `
  Zwei Hausmeister-Roboter, ein Haus, viele Fallen!
  LINKE Saalhälfte = KEHRBERT, RECHTE Saalhälfte = WISCHA.

  Am eigenen Rand: Ziel-Pads füllen – eure Figur holt den Gegenstand.
  Genug Sachen? Dann das AUSGANG-Pad füllen und raus!

  Fallen-Slots im Haus anleuchten = Falle scharf (Eimer, Bombe, Sprungfeder).
  Nochmal anleuchten = entschärft. Fallen treffen JEDEN!
  Treffen sich die Figuren: KLOPP-Pad am eigenen Rand leuchten.
  `,
  image: 'media/img/gametitles/laser-basefight-9-###4###.png',

  init: function () {
    resetAll();
  },

  handle: function (grid, elapsed) {
    const dt = Math.min(elapsed || 0, 0.1);
    const ctx = MasterCanvas.get2dContext();
    ensurePalette();
    ensureLayout();
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
