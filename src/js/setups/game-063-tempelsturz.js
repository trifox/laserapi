/**
 * Tempelsturz – Professorin Ada Kranich und die zwölf Fallen-Tempel
 *
 * Erstellt mit Claude Opus 5.5 (claude-opus-5-5).
 *
 * Der ganze Saal hilft der Archäologin ADA KRANICH (runde Brille, langer Schal, Laterne) durch zwölf
 * Tempel. Jeder Tempel ist eine feste Folge von 3–6 STATIONEN. Wer eine Station verbockt, verliert eine
 * der 3 Laternen (Leben) und die Station beginnt von vorn. Alle Laternen aus = Game Over.
 *
 * Stationen:
 * - ALTAR (4-Punkte-Balance): Das Artefakt liegt auf einer Trage mit 4 Tragepunkten – je ein großes, dunkles
 *   Feld in jeder Saal-Ecke. Alle vier gleich stark beleuchten = waagerecht, dann hebt sich das Artefakt.
 *   Eine Seite zu schwach → es kippt, der Wackel-Balken steigt, bei voll fällt es herunter.
 * - KUGEL-FLUCHT: Seitenansicht. Ada rennt von selbst, die Steinkugel rollt hinterher. Hindernisse (Ranken,
 *   Bretter, Türen, Spinnweben) VOR ihr wegleuchten, sonst bleibt sie stehen. Das SPRUNG-Feld unten
 *   aufladen – an einem Loch springt sie dann automatisch. Die Wächter-Statuen NICHT anleuchten (Ada
 *   erschrickt und wird langsam). Kugel holt ein oder Ada fällt ins Loch = Laterne weg.
 * - PFEILWAND: Löcher in der Wand glühen kurz auf, dann schießt ein Pfeil. Glühendes Loch zuleuchten =
 *   verstopft. Jeder Pfeil füllt den Schaden-Balken.
 * - SEILBRÜCKE: Die Bretter unter Ada müssen beleuchtet sein, wenn sie darauf tritt. Windböen saugen das
 *   Licht schneller ab.
 * - FALLGITTER: Schwere Gitter – das Hebel-Feld darüber gemeinsam voll beleuchten (mehr Fläche = schneller)
 *   und halten, bis Ada durch ist. Sackt das Gitter, während sie drunter steht: autsch.
 * - SCHLANGENGRUBE: Schlangen kriechen auf Ada zu. Licht auf den Kopf scheucht sie zurück. Adas Laterne
 *   NICHT anleuchten (blendet sie – Schaden).
 * - WASSERKAMMER: Wasser steigt. Alle Ventile müssen GLEICHZEITIG voll sein, dann läuft es ab.
 * - BOSS (Tempel 5, 10, 12): EINSTURZHALLE – Kugel-Flucht und 4-Punkte-Balance zugleich, dazu fallen
 *   Felsbrocken von der Decke (Brocken anleuchten zerbröselt sie).
 *
 * Punkte: pro Station, Zeitbonus, Bonus für ein unversehrtes Artefakt (wenig Wackeln). Highscore am Ende.
 *
 * Licht-Disziplin: Alle Laser-Felder (Pads) sind schwarz gefüllt und nur konturiert, der Füllstand ist ein
 * Ring außen. Bunt gezeichnet wird nur, wo keine Laser hin müssen (Artefakt, Ada, Kugel, Wasser).
 * Farben nur aus der Laserfarbe, Hue 0.25 … 0.75. Tempelwände: vorgerenderte, stark gedimmte Julia-Ornamente.
 *
 * Tastatur (Test ohne Laser):
 * - Leertaste: Start / Stationskarte, Fehlerkarte, Tempel-Übergang überspringen / Nochmal
 * - K halten: „Helfer-Laser“ – alle Felder der aktuellen Station werden beleuchtet
 * - Pfeiltasten (im Altar / Boss): eine Seite schwächer beleuchten (mit oder ohne K) – Kippen testen
 * - N: aktuelle Station sofort geschafft · B: ganzen Tempel überspringen · X: Laterne verlieren (Test)
 *   (d v g r m h t f F s, PageUp/PageDown/Home sind Debug-Tasten in view.js und hier bewusst frei)
 *
 * Klassiker: Rick Dangerous (Core Design, Amiga/C64/Atari ST, 1989) – Fallen-Tempel, rollende Kugel gleich im
 * ersten Raum; Pitfall! (Activision, Atari 2600, 1982) – automatisches Laufen, Löcher, Schlangen, Ranken.
 * Anders hier: Ada läuft selbst, das Publikum ist „die Hand Gottes“ und räumt den Weg frei. Eigene Figur,
 * kein Hut, keine Peitsche.
 * Ähnlichkeiten im Bestand: game-053-dschungeldussel (selbstlaufende Figur, Publikum räumt den Weg),
 * game-026-tauziehen (Saalbereiche gegeneinander – hier MITEINANDER: Balance über 4 Viertel),
 * game-058-heliretter (Rettungsmission mit Stationen-Charakter).
 *
 * Interferenz: Es gibt keine Teams – alle spielen mit Ada. Störung kommt trotzdem vor: Wer wild leuchtet,
 * trifft Wächter-Statuen und Adas Laterne (Strafe) oder kippt die Balance, weil er nur in „seiner“ Ecke
 * zu viel leuchtet. Die Balance ist also eine Einladung zur Selbstorganisation des Saals.
 *
 * One-Pixel-Netzwerk-Tauglichkeit: Alles ist Flächenanteil (pixelFillButton). Ein Netz-Spieler mit einem
 * Pixel füllt langsam, viele schnell; die Balance vergleicht relative Anteile der vier Ecken – mit
 * Millionen Pixeln funktioniert sie genauso (die Ecke ergibt sich aus der Position des Pixels).
 */

import util, { getRgbSpreadHex } from '../util.js';
import { createKeyEdge, isKeyDown, clamp } from './gui/gridScan.js';
import soundPlop from '../../../public/media/369952__mischy__plop-1.wav';
import soundStomp from '../../../public/media/517267__foolboymedia__cinematic-stomp.wav';
import soundSplash from '../../../public/media/485066__javierserrat__object-falls-into-the-water.wav';
import soundExplosion from '../../../public/media/414346__bykgames__explosion-far.wav';
import soundPickup from '../../../public/media/opengameart/Item Pickup.ogg';
import soundError from '../../../public/media/opengameart/Menu Error.ogg';
import soundLevelUp from '../../../public/media/opengameart/Level Up.ogg';
import soundConfirm from '../../../public/media/opengameart/Menu Confirm.ogg';
var laserConfig = require('../LaserApiConfig.js').default;
var MasterCanvas = require('../MasterCanvas').default;
var guiFillButton = require('./gui/fillButton-ai2').default;
var guiPixelFillButton = require('./gui/pixelFillButton').default;
var createHighscore = require('../util/highscore').default;

const W = 1920;
const H = 1080;
const GROUND = 780; // Bodenlinie der Seitenansicht-Stationen
const ADA_X = 760; // feste Bildschirmposition von Ada beim Rennen

// ---------------------------------------------------------------------------------------------------------
// Einstellungen
// ---------------------------------------------------------------------------------------------------------

const SETTINGS = {
  lives: 3,
  introDuration: 1.8, // Stationskarte
  failDuration: 2.2, // Fehlerkarte
  templeDoneDuration: 3.2, // Tempel-Übergang
  maxParticles: 400,
  padColorHue: 0.5,
};

// Schwierigkeit: Startwerte + Steigerung pro Tempel (l = 1 … 12)
const DIFFICULTY = {
  // Altar
  altarTol: (l) => Math.max(0.12, 0.36 - 0.022 * (l - 1)), // erlaubte Schieflage (0..1)
  altarLiftTime: (l) => 4 + 0.35 * l, // Sekunden waagerecht halten
  altarWobbleRate: (l) => 1.4 + 0.08 * l, // Wackelzunahme pro Einheit Schieflage
  altarMinLight: 0.2, // mittlere Mindest-Beleuchtung der 4 Ecken, damit überhaupt gehoben wird
  // Kugel-Flucht
  runSpeed: (l) => 250 + 14 * l, // px/s
  boulderFactor: (l) => Math.min(0.92, 0.74 + 0.014 * l), // Kugel relativ zu Ada
  runLength: (l) => 4200 + 380 * l, // Strecke in px
  obstacleGap: (l) => Math.max(330, 640 - 26 * l), // Abstand der Hindernisse
  holeChance: (l) => Math.min(0.35, 0.12 + 0.02 * l),
  idolChance: (l) => Math.min(0.25, 0.06 + 0.016 * l),
  startGap: 520, // Vorsprung vor der Kugel
  // Pfeilwand
  arrowSlots: (l) => Math.min(12, 6 + Math.floor(l / 2)),
  arrowWarn: (l) => Math.max(1.3, 2.8 - 0.12 * l),
  arrowInterval: (l) => Math.max(0.55, 1.5 - 0.08 * l),
  arrowDamage: 0.22,
  arrowWalkTime: (l) => 22 + l,
  // Seilbrücke
  planks: (l) => Math.min(14, 8 + Math.floor(l / 2)),
  bridgeSpeed: (l) => 90 + 4 * l,
  bridgeGrace: 0.7, // s, die ein Brett ohne Licht unter Ada noch hält
  gustDrain: (l) => 40 + 6 * l,
  // Fallgitter
  gates: (l) => Math.min(3, 1 + Math.floor(l / 4)),
  gateFall: (l) => 26 + 3 * l, // Absinken/s
  gateTorch: 45, // s, bis die Fackel ausgeht
  // Schlangengrube
  snakeDuration: (l) => 22 + 1.5 * l,
  snakeInterval: (l) => Math.max(0.9, 2.4 - 0.12 * l),
  snakeSpeed: (l) => 70 + 6 * l,
  snakeDamage: 0.25,
  // Wasserkammer
  valves: (l) => (l < 8 ? 3 : 4),
  waterRise: (l) => 18 + 1.8 * l, // px/s
  drainTime: (l) => 3 + 0.2 * l, // s alle Ventile gleichzeitig offen
  // Boss
  debrisInterval: (l) => Math.max(0.9, 2.2 - 0.1 * l),
};

const SCORE = { station: 200, perLevel: 25, timeBonus: 6, artifact: 300, obstacle: 10, jump: 15 };

const STATION_INFO = {
  altar: { name: 'DER ALTAR', hint: 'Alle 4 Ecken gleich stark beleuchten – das Artefakt waagerecht heben!' },
  kugel: { name: 'DIE KUGEL!', hint: 'Hindernisse vor Ada wegleuchten, SPRUNG-Feld aufladen, Statuen in Ruhe lassen!' },
  pfeil: { name: 'PFEILWAND', hint: 'Glühende Löcher zuleuchten, bevor der Pfeil kommt!' },
  bruecke: { name: 'SEILBRÜCKE', hint: 'Die Bretter unter Ada beleuchten – Windböen fressen Licht!' },
  gitter: { name: 'FALLGITTER', hint: 'Alle zusammen auf den Hebel – halten, bis Ada durch ist!' },
  schlangen: { name: 'SCHLANGENGRUBE', hint: 'Schlangenköpfe anleuchten, Adas Laterne NICHT!' },
  wasser: { name: 'WASSERKAMMER', hint: 'Alle Ventile GLEICHZEITIG voll halten!' },
  boss: { name: 'EINSTURZHALLE', hint: 'Kugel, Balance und Felsbrocken – alles auf einmal!' },
};

// Zwölf Tempel – Stationen werden nach und nach eingeführt; 5, 10 und 12 enden mit dem Boss
const TEMPLES = [
  { name: 'Tempel der Kraniche', julia: [-0.8, 0.156], stations: ['altar', 'gitter', 'kugel'] },
  { name: 'Halle der Echos', julia: [-0.4, 0.6], stations: ['altar', 'pfeil', 'kugel'] },
  { name: 'Schlund der Spiralen', julia: [0.285, 0.01], stations: ['altar', 'bruecke', 'pfeil', 'kugel'] },
  { name: 'Grube der Zungen', julia: [-0.70176, -0.3842], stations: ['altar', 'schlangen', 'gitter', 'kugel'] },
  { name: 'Mandel-Krypta', julia: [-0.835, -0.2321], stations: ['altar', 'pfeil', 'boss'], boss: true },
  { name: 'Brunnen der Tiefe', julia: [0.355, 0.355], stations: ['altar', 'wasser', 'bruecke', 'kugel'] },
  { name: 'Natterngewölbe', julia: [-0.75, 0.11], stations: ['altar', 'schlangen', 'pfeil', 'gitter', 'kugel'] },
  { name: 'Kathedrale des Regens', julia: [-0.1, 0.651], stations: ['altar', 'wasser', 'bruecke', 'schlangen', 'kugel'] },
  { name: 'Labyrinth der Pfeile', julia: [0.37, 0.1], stations: ['altar', 'pfeil', 'wasser', 'gitter', 'bruecke', 'kugel'] },
  { name: 'Julia-Gewölbe', julia: [-0.7269, 0.1889], stations: ['altar', 'schlangen', 'wasser', 'boss'], boss: true },
  { name: 'Spiegel der Ahnen', julia: [-0.62, 0.43], stations: ['altar', 'bruecke', 'pfeil', 'schlangen', 'wasser', 'kugel'] },
  { name: 'Herz des Fraktals', julia: [-0.123, 0.745], stations: ['altar', 'gitter', 'wasser', 'pfeil', 'schlangen', 'boss'], boss: true },
];

// ---------------------------------------------------------------------------------------------------------
// Zustand (vorbelegt, damit handle() auch ohne init() läuft)
// ---------------------------------------------------------------------------------------------------------

var scene = 'title'; // 'title' | 'intro' | 'station' | 'fail' | 'templeDone' | 'gameover' | 'victory'
var sceneTime = 0;
var templeIndex = 0;
var stationIndex = 0;
var station = null;
var lives = SETTINGS.lives;
var score = 0;
var clock = 0;
var shake = 0;
var flash = 0;
var failReason = '';
var particles = [];
var floaters = [];
var startButton = null;
var againButton = null;
var keyEdge = createKeyEdge();
var highscore = createHighscore('Tempelsturz', 'punkte');
var newHighscore = false;
var bestScore = 0;
var STATS = newStats();
var pal = null;
var palKey = '';
var bgCanvas = null;
var bgTemple = -1;
var boulderSprite = null;

function newStats() {
  return {
    stations: 0,
    fails: 0,
    obstacles: 0,
    jumps: 0,
    arrowsPlugged: 0,
    snakesScared: 0,
    idolsAngered: 0,
    debris: 0,
    artifacts: 0,
    time: 0,
  };
}

// ---------------------------------------------------------------------------------------------------------
// Farben – nur Komplementärbereich der Laserfarbe (Hue 0.25 … 0.75)
// ---------------------------------------------------------------------------------------------------------

function col(h, s, v) {
  return getRgbSpreadHex(laserConfig.testColor, clamp(h, 0.25, 0.75), s, v);
}

function ensurePalette() {
  const key = laserConfig.testColor.join(',');
  if (pal && key === palKey) return;
  palKey = key;
  pal = {
    text: col(0.5, 0.15, 0.95),
    dim: col(0.5, 0.3, 0.55),
    gold: col(0.33, 0.75, 1),
    goldDark: col(0.33, 0.8, 0.45),
    pad: col(0.5, 0.55, 0.75),
    padActive: col(0.45, 0.8, 1),
    padDim: col(0.5, 0.4, 0.35),
    good: col(0.4, 0.8, 1),
    bad: col(0.72, 0.85, 1),
    warn: col(0.3, 0.9, 1),
    stone: col(0.55, 0.15, 0.32),
    stoneDark: col(0.55, 0.2, 0.16),
    stoneLight: col(0.55, 0.12, 0.5),
    wall: col(0.6, 0.35, 0.09),
    wallB: col(0.45, 0.4, 0.05),
    ada: col(0.62, 0.55, 0.85),
    adaCoat: col(0.3, 0.45, 0.6),
    scarf: col(0.7, 0.75, 0.95),
    skin: col(0.28, 0.35, 0.95),
    lantern: col(0.33, 0.6, 1),
    water: col(0.55, 0.75, 0.75),
    waterDeep: col(0.58, 0.8, 0.35),
    vine: col(0.38, 0.75, 0.75),
    wood: col(0.28, 0.6, 0.6),
    snake: col(0.42, 0.8, 0.85),
    fire: col(0.27, 0.85, 1),
  };
  bgCanvas = null;
  boulderSprite = null;
}

// ---------------------------------------------------------------------------------------------------------
// Kleine Helfer: Text, Ton, Partikel
// ---------------------------------------------------------------------------------------------------------

function txt(ctx, text, x, y, size, color, align, lineHeight) {
  util.renderText({
    ctx,
    text: String(text),
    x,
    y,
    fontSize: size + 'px',
    lineHeight: lineHeight || Math.round(size * 1.25),
    fillStyle: color,
    align: align || 'center',
  });
}

function playSound(src, volume) {
  try {
    const a = new Audio(src);
    a.volume = volume === undefined ? 0.6 : volume;
    const p = a.play();
    if (p && p.catch) p.catch(() => {});
  } catch (e) {
    // Ton ist optional
  }
}

function burst(x, y, color, count, speed) {
  for (let i = 0; i < count && particles.length < SETTINGS.maxParticles; i++) {
    const a = Math.random() * Math.PI * 2;
    const s = (0.3 + Math.random()) * (speed || 300);
    particles.push({ x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s - 80, life: 0.5 + Math.random() * 0.7, max: 1.2, color, size: 3 + Math.random() * 5, grav: 500 });
  }
}

function dust(x, y, count) {
  for (let i = 0; i < count && particles.length < SETTINGS.maxParticles; i++) {
    particles.push({
      x: x + (Math.random() - 0.5) * 60,
      y: y + (Math.random() - 0.5) * 20,
      vx: (Math.random() - 0.5) * 120,
      vy: -Math.random() * 90,
      life: 0.6 + Math.random() * 0.8,
      max: 1.4,
      color: pal.stoneLight,
      size: 4 + Math.random() * 8,
      grav: 60,
    });
  }
}

function addFloater(x, y, text, color) {
  if (floaters.length > 30) floaters.shift();
  floaters.push({ x, y, text, color, life: 1.3 });
}

function updateEffects(dt, ctx) {
  particles.slice().forEach((p) => {
    p.life -= dt;
    if (p.life <= 0) {
      particles.splice(particles.indexOf(p), 1);
      return;
    }
    p.vy += p.grav * dt;
    p.x += p.vx * dt;
    p.y += p.vy * dt;
  });
  floaters.slice().forEach((f) => {
    f.life -= dt;
    f.y -= 60 * dt;
    if (f.life <= 0) floaters.splice(floaters.indexOf(f), 1);
  });
  ctx.save();
  particles.forEach((p) => {
    ctx.globalAlpha = Math.max(0, Math.min(1, p.life / 0.6));
    ctx.fillStyle = p.color;
    ctx.fillRect(p.x - p.size / 2, p.y - p.size / 2, p.size, p.size);
  });
  ctx.globalAlpha = 1;
  ctx.restore();
  floaters.forEach((f) => {
    ctx.save();
    ctx.globalAlpha = Math.min(1, f.life);
    txt(ctx, f.text, f.x, f.y, 40, f.color);
    ctx.restore();
  });
}

// Schaden/Fehlschlag einer Station melden (über die Station → Szene 'fail')
function addScore(points, x, y) {
  score += points;
  if (x !== undefined) addFloater(x, y, (points > 0 ? '+' : '') + points, points > 0 ? pal.good : pal.bad);
}

// ---------------------------------------------------------------------------------------------------------
// Laser-Felder (Pads): unsichtbarer pixelFillButton (Eingabe) + eigene, dunkle Zeichnung (Licht-Disziplin)
// ---------------------------------------------------------------------------------------------------------

// K gedrückt = „Helfer-Laser“ auf allen Feldern der aktuellen Station
function helperDown() {
  return isKeyDown('KeyK');
}

function makePad(x, y, r, opts) {
  const o = opts || {};
  const btn = guiPixelFillButton({
    label: '',
    posX: x,
    posY: y,
    radius: r,
    speedUp: o.speedUp || 120,
    speedDown: o.speedDown === undefined ? 50 : o.speedDown,
    fullPercent: o.fullPercent || 30,
    activeValue: 100,
    minValue: 0,
    visible: false,
  });
  const pad = {
    btn,
    x,
    y,
    r,
    label: o.label || '',
    shape: o.shape || 'circle', // 'circle' | 'rect'
    w: o.w || r * 2,
    h: o.h || r * 2,
    value: 0, // 0..100
    strength: 0, // geglätteter Flächenanteil relativ zu fullPercent (0..1)
    sim: 0, // Simulationsstärke für Tastaturtests (0..1)
    fullPercent: o.fullPercent || 30,
    speedUp: o.speedUp || 120,
    noHelper: !!o.noHelper, // „gute“ Objekte (Statuen, Laterne): K-Helfer beleuchtet sie nicht
    update(grid, dt) {
      btn.setX(pad.x);
      btn.setY(pad.y);
      btn.handle(grid, dt);
      let s = Math.min(1, btn.getFillPercent() / pad.fullPercent);
      // Tastatur-Simulation: pad.sim (von der Station gesetzt) oder K = alles beleuchtet
      const simS = pad.noHelper ? 0 : pad.sim > 0 ? pad.sim : helperDown() ? 1 : 0;
      if (simS > 0) {
        s = Math.max(s, simS);
        btn.setValue(Math.min(100, btn.getValue() + pad.speedUp * simS * dt));
      }
      pad.strength += (s - pad.strength) * Math.min(1, dt * 6);
      pad.value = btn.getValue();
    },
    setValue(v) {
      btn.setValue(v);
      pad.value = v;
    },
    lit() {
      return pad.strength > 0.08;
    },
  };
  return pad;
}

// Zeichnet ein Pad: schwarz gefüllt, Kontur, Füllring außen
function drawPad(ctx, pad, color, opts) {
  const o = opts || {};
  const c = color || pal.pad;
  ctx.save();
  ctx.fillStyle = '#000000';
  ctx.strokeStyle = c;
  ctx.lineWidth = o.lineWidth || 4;
  if (pad.shape === 'rect') {
    ctx.fillRect(pad.x - pad.w / 2, pad.y - pad.h / 2, pad.w, pad.h);
    ctx.strokeRect(pad.x - pad.w / 2, pad.y - pad.h / 2, pad.w, pad.h);
    if (pad.value > 0) {
      ctx.fillStyle = c;
      ctx.globalAlpha = 0.9;
      ctx.fillRect(pad.x - pad.w / 2, pad.y + pad.h / 2 + 6, (pad.w * pad.value) / 100, 8);
    }
  } else {
    ctx.beginPath();
    ctx.arc(pad.x, pad.y, pad.r, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    if (pad.value > 0) {
      ctx.lineWidth = 9;
      ctx.beginPath();
      ctx.arc(pad.x, pad.y, pad.r + 9, -Math.PI / 2, -Math.PI / 2 + (Math.PI * 2 * pad.value) / 100);
      ctx.stroke();
    }
  }
  ctx.restore();
  if (pad.label && !o.noLabel) {
    txt(ctx, pad.label, pad.x, pad.y + (pad.shape === 'rect' ? pad.h / 2 : pad.r) + 44, 28, c);
  }
}

// ---------------------------------------------------------------------------------------------------------
// Vorrendern: Tempelwand mit Julia-Ornamenten (pro Tempel), Steinkugel
// ---------------------------------------------------------------------------------------------------------

function makeCanvas(w, h) {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  return c;
}

function hexToRgbArr(hex) {
  const n = parseInt(hex.slice(1, 7), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

function renderJulia(size, cr, ci, colorHex, maxIter) {
  const c = makeCanvas(size, size);
  const g = c.getContext('2d');
  const img = g.createImageData(size, size);
  const d = img.data;
  const rgb = hexToRgbArr(colorHex);
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      let zr = ((x - size / 2) * 3.2) / size;
      let zi = ((y - size / 2) * 3.2) / size;
      let i = 0;
      while (zr * zr + zi * zi <= 4 && i < maxIter) {
        const t = zr * zr - zi * zi + cr;
        zi = 2 * zr * zi + ci;
        zr = t;
        i++;
      }
      const k = i >= maxIter ? 0 : Math.pow(i / maxIter, 0.6);
      const idx = (y * size + x) * 4;
      d[idx] = rgb[0] * k;
      d[idx + 1] = rgb[1] * k;
      d[idx + 2] = rgb[2] * k;
      d[idx + 3] = Math.round(255 * Math.min(1, k * 1.5));
    }
  }
  g.putImageData(img, 0, 0);
  return c;
}

function ensureBackground() {
  ensurePalette();
  if (bgCanvas && bgTemple === templeIndex) return;
  bgTemple = templeIndex;
  const t = TEMPLES[Math.min(templeIndex, TEMPLES.length - 1)];
  bgCanvas = makeCanvas(W, H);
  const g = bgCanvas.getContext('2d');
  const grad = g.createLinearGradient(0, 0, 0, H);
  grad.addColorStop(0, pal.wall);
  grad.addColorStop(1, '#000000');
  g.fillStyle = grad;
  g.fillRect(0, 0, W, H);
  // Quader-Fugen
  g.strokeStyle = pal.wallB;
  g.lineWidth = 2;
  for (let y = 100; y < H; y += 90) {
    const off = (y / 90) % 2 ? 0 : 80;
    g.beginPath();
    g.moveTo(0, y);
    g.lineTo(W, y);
    g.stroke();
    for (let x = off; x < W; x += 160) {
      g.beginPath();
      g.moveTo(x, y);
      g.lineTo(x, y + 90);
      g.stroke();
    }
  }
  // Julia-Ornamente: Fries oben + zwei Säulen-Medaillons, stark gedimmt
  const orn = renderJulia(180, t.julia[0], t.julia[1], col(0.4 + templeIndex * 0.03, 0.6, 0.22), 48);
  g.save();
  g.globalAlpha = 0.85;
  for (let x = 0; x < W; x += 170) g.drawImage(orn, x - 5, 92, 180, 90);
  const big = renderJulia(320, t.julia[0], t.julia[1], col(0.6 - templeIndex * 0.02, 0.55, 0.2), 64);
  g.globalAlpha = 0.6;
  g.drawImage(big, W / 2 - 160, 160, 320, 320);
  g.restore();
}

function ensureBoulder() {
  ensurePalette();
  if (boulderSprite) return;
  const R = 230;
  boulderSprite = makeCanvas(R * 2 + 8, R * 2 + 8);
  const g = boulderSprite.getContext('2d');
  const cx = R + 4;
  const grad = g.createRadialGradient(cx - 70, cx - 80, 20, cx, cx, R);
  grad.addColorStop(0, pal.stoneLight);
  grad.addColorStop(0.7, pal.stone);
  grad.addColorStop(1, pal.stoneDark);
  g.fillStyle = grad;
  g.beginPath();
  g.arc(cx, cx, R, 0, Math.PI * 2);
  g.fill();
  // Spiral-Gravur (Fraktal-Motiv) und Risse
  g.strokeStyle = pal.stoneDark;
  g.lineWidth = 6;
  g.beginPath();
  for (let a = 0; a < Math.PI * 7; a += 0.1) {
    const rr = 8 + a * 9;
    const x = cx + Math.cos(a) * rr;
    const y = cx + Math.sin(a) * rr;
    if (a === 0) g.moveTo(x, y);
    else g.lineTo(x, y);
  }
  g.stroke();
  g.lineWidth = 4;
  for (let i = 0; i < 7; i++) {
    const a = (i / 7) * Math.PI * 2;
    g.beginPath();
    g.moveTo(cx + Math.cos(a) * R * 0.75, cx + Math.sin(a) * R * 0.75);
    g.lineTo(cx + Math.cos(a + 0.15) * R * 0.98, cx + Math.sin(a + 0.15) * R * 0.98);
    g.stroke();
  }
}

// ---------------------------------------------------------------------------------------------------------
// Ada Kranich: runde Brille, langer Schal, Laterne
// state: 'run' | 'walk' | 'stand' | 'jump' | 'fall' | 'scared'
// ---------------------------------------------------------------------------------------------------------

function drawAda(ctx, x, y, phase, state, scale) {
  const s = scale || 1;
  const run = state === 'run' ? 1 : state === 'walk' ? 0.5 : 0;
  const leg = Math.sin(phase) * 0.7 * run;
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(s, s);
  if (state === 'fall') ctx.rotate(Math.sin(phase * 2) * 0.6);
  ctx.lineCap = 'round';
  // Beine
  ctx.strokeStyle = pal.adaCoat;
  ctx.lineWidth = 12;
  ctx.beginPath();
  ctx.moveTo(0, -70);
  ctx.lineTo(Math.sin(leg) * 34, -2);
  ctx.moveTo(0, -70);
  ctx.lineTo(-Math.sin(leg) * 34, -2);
  ctx.stroke();
  // Mantel
  ctx.fillStyle = pal.adaCoat;
  ctx.beginPath();
  ctx.moveTo(-20, -140);
  ctx.lineTo(20, -140);
  ctx.lineTo(28, -62);
  ctx.lineTo(-28, -62);
  ctx.closePath();
  ctx.fill();
  // Schal (flattert nach hinten)
  ctx.strokeStyle = pal.scarf;
  ctx.lineWidth = 9;
  ctx.beginPath();
  ctx.moveTo(-6, -142);
  for (let i = 1; i <= 6; i++) {
    ctx.lineTo(-6 - i * 12, -142 + Math.sin(phase * 1.5 + i) * (4 + i * 2) * (0.4 + run));
  }
  ctx.stroke();
  // Arm mit Laterne
  const armA = state === 'scared' ? -1.9 : -0.4 + Math.sin(phase) * 0.4 * run;
  const hx = Math.cos(armA) * 42;
  const hy = -128 + Math.sin(armA) * 42 + 40;
  ctx.strokeStyle = pal.adaCoat;
  ctx.lineWidth = 9;
  ctx.beginPath();
  ctx.moveTo(10, -130);
  ctx.lineTo(10 + hx, hy);
  ctx.stroke();
  ctx.fillStyle = pal.lantern;
  ctx.shadowColor = pal.lantern;
  ctx.shadowBlur = 18;
  ctx.fillRect(10 + hx - 7, hy, 14, 18);
  ctx.shadowBlur = 0;
  // Kopf
  ctx.fillStyle = pal.skin;
  ctx.beginPath();
  ctx.arc(0, -162, 20, 0, Math.PI * 2);
  ctx.fill();
  // Haarknoten
  ctx.fillStyle = pal.ada;
  ctx.beginPath();
  ctx.arc(-14, -176, 11, 0, Math.PI * 2);
  ctx.fill();
  // runde Brille
  ctx.strokeStyle = '#000000';
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.arc(6, -164, 6, 0, Math.PI * 2);
  ctx.moveTo(24, -164);
  ctx.arc(18, -164, 6, 0, Math.PI * 2);
  ctx.stroke();
  ctx.restore();
}

// ---------------------------------------------------------------------------------------------------------
// Balance-Modul (Altar und Boss): 4 Eck-Pads → Schieflage, Heben, Wackeln
// ---------------------------------------------------------------------------------------------------------

function createBalance(level, r, inset) {
  const ins = inset || 230;
  const pts = [
    [ins, ins + 60],
    [W - ins, ins + 60],
    [ins, H - ins - 10],
    [W - ins, H - ins - 10],
  ];
  const names = ['A', 'B', 'C', 'D'];
  const bal = {
    pads: pts.map((p, i) => makePad(p[0], p[1], r, { fullPercent: 22, speedUp: 140, speedDown: 60, label: 'TRAGE ' + names[i] })),
    tiltX: 0,
    tiltY: 0,
    mean: 0,
    wobble: 0,
    maxWobble: 0,
    tol: DIFFICULTY.altarTol(level),
    rate: DIFFICULTY.altarWobbleRate(level),
    level: true,
    update(grid, dt, strict) {
      // Tastatur: Pfeiltasten schwächen eine Seite (mit/ohne K)
      const arrows = isKeyDown('ArrowLeft') || isKeyDown('ArrowRight') || isKeyDown('ArrowUp') || isKeyDown('ArrowDown');
      bal.pads.forEach((p, i) => {
        let sim = 0;
        if (arrows || helperDown()) {
          sim = 1;
          const right = i % 2 === 1;
          const bottom = i >= 2;
          if (isKeyDown('ArrowLeft') && right) sim = 0.3;
          if (isKeyDown('ArrowRight') && !right) sim = 0.3;
          if (isKeyDown('ArrowUp') && bottom) sim = 0.3;
          if (isKeyDown('ArrowDown') && !bottom) sim = 0.3;
        }
        p.sim = sim;
        p.update(grid, dt);
      });
      const s = bal.pads.map((p) => p.strength);
      bal.mean = (s[0] + s[1] + s[2] + s[3]) / 4;
      const norm = Math.max(0.15, bal.mean * 2);
      bal.tiltX = clamp((s[1] + s[3] - s[0] - s[2]) / 2 / norm, -1, 1);
      bal.tiltY = clamp((s[2] + s[3] - s[0] - s[1]) / 2 / norm, -1, 1);
      const tilt = Math.max(Math.abs(bal.tiltX), Math.abs(bal.tiltY));
      bal.level = tilt <= bal.tol && bal.mean >= DIFFICULTY.altarMinLight;
      if (bal.mean >= DIFFICULTY.altarMinLight * 0.6 || strict) {
        if (tilt > bal.tol) bal.wobble += (tilt - bal.tol) * bal.rate * dt;
        else bal.wobble = Math.max(0, bal.wobble - 0.25 * dt);
      } else {
        bal.wobble = Math.max(0, bal.wobble - 0.15 * dt);
      }
      bal.maxWobble = Math.max(bal.maxWobble, bal.wobble);
      return bal.wobble >= 1;
    },
    drawPads(ctx) {
      bal.pads.forEach((p) => {
        const weak = bal.mean > 0.1 && p.strength < bal.mean - bal.tol;
        drawPad(ctx, p, weak ? pal.warn : p.strength > 0.15 ? pal.padActive : pal.pad);
      });
    },
    // Artefakt auf Trage zeichnen (Anzeige, bunt erlaubt)
    drawArtifact(ctx, x, y, lift, scale) {
      const sc = scale || 1;
      const ang = bal.tiltX * 0.5 + Math.sin(clock * 20) * bal.wobble * 0.08;
      ctx.save();
      ctx.translate(x, y - lift * 60 * sc);
      ctx.scale(sc, sc);
      ctx.rotate(ang);
      // Trage
      ctx.fillStyle = pal.wood;
      ctx.fillRect(-170, 0, 340, 18);
      ctx.fillStyle = pal.goldDark;
      [-150, 150].forEach((px) => ctx.fillRect(px - 8, 18, 16, 30 + bal.tiltY * 14 * (px > 0 ? 1 : -1)));
      // Artefakt: Kranich-Amulett (Spirale in Raute)
      const slide = bal.tiltX * 40;
      ctx.translate(slide, -50);
      ctx.shadowColor = pal.gold;
      ctx.shadowBlur = 25 + Math.sin(clock * 3) * 8;
      ctx.fillStyle = pal.gold;
      ctx.beginPath();
      ctx.moveTo(0, -48);
      ctx.lineTo(40, 0);
      ctx.lineTo(0, 48);
      ctx.lineTo(-40, 0);
      ctx.closePath();
      ctx.fill();
      ctx.shadowBlur = 0;
      ctx.strokeStyle = pal.goldDark;
      ctx.lineWidth = 4;
      ctx.beginPath();
      for (let a = 0; a < Math.PI * 5; a += 0.2) {
        const rr = 2 + a * 2.2;
        const px = Math.cos(a + clock) * rr;
        const py = Math.sin(a + clock) * rr;
        if (a === 0) ctx.moveTo(px, py);
        else ctx.lineTo(px, py);
      }
      ctx.stroke();
      ctx.restore();
    },
    drawMeters(ctx, x, y) {
      // Wackel-Balken + Wasserwaage
      ctx.save();
      ctx.strokeStyle = pal.dim;
      ctx.lineWidth = 3;
      ctx.strokeRect(x - 200, y, 400, 22);
      ctx.fillStyle = bal.wobble > 0.6 ? pal.bad : pal.warn;
      ctx.fillRect(x - 200, y, 400 * Math.min(1, bal.wobble), 22);
      // Libelle
      const lx = x + bal.tiltX * 180;
      const ly = y + 70 + bal.tiltY * 30;
      ctx.strokeStyle = pal.dim;
      ctx.beginPath();
      ctx.arc(x, y + 70, 36, 0, Math.PI * 2);
      ctx.stroke();
      ctx.strokeStyle = pal.good;
      ctx.beginPath();
      ctx.arc(x, y + 70, 36 * Math.max(0.15, bal.tol * 2.2), 0, Math.PI * 2);
      ctx.stroke();
      ctx.fillStyle = bal.level ? pal.good : pal.warn;
      ctx.beginPath();
      ctx.arc(clamp(lx, x - 34, x + 34), clamp(ly, y + 40, y + 100), 10, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
      txt(ctx, 'WACKELN', x, y - 10, 26, pal.dim);
    },
  };
  return bal;
}

// ---------------------------------------------------------------------------------------------------------
// Stationen – jede Factory liefert { type, t, par, update(grid, dt) → null | 'done' | { fail }, draw(ctx) }
// ---------------------------------------------------------------------------------------------------------

function drawFloor(ctx, scroll, holes) {
  // Boden der Seitenansicht: dunkler Stein, Löcher schwarz
  ctx.save();
  ctx.fillStyle = pal.stoneDark;
  ctx.fillRect(0, GROUND, W, 24);
  ctx.fillStyle = '#000000';
  ctx.fillRect(0, GROUND + 24, W, H - GROUND - 24);
  ctx.strokeStyle = pal.stone;
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(0, GROUND);
  ctx.lineTo(W, GROUND);
  ctx.stroke();
  // Fugen scrollen mit
  ctx.strokeStyle = pal.wallB;
  const off = -(scroll % 120);
  for (let x = off; x < W; x += 120) {
    ctx.beginPath();
    ctx.moveTo(x, GROUND);
    ctx.lineTo(x, GROUND + 24);
    ctx.stroke();
  }
  (holes || []).forEach((h) => {
    ctx.fillStyle = '#000000';
    ctx.fillRect(h.x0, GROUND - 2, h.x1 - h.x0, 30);
    ctx.strokeStyle = pal.bad;
    ctx.lineWidth = 2;
    ctx.globalAlpha = 0.6;
    ctx.beginPath();
    ctx.moveTo(h.x0, GROUND);
    ctx.lineTo(h.x0, GROUND + 26);
    ctx.moveTo(h.x1, GROUND);
    ctx.lineTo(h.x1, GROUND + 26);
    ctx.stroke();
    ctx.globalAlpha = 1;
  });
  ctx.restore();
}

function drawPillars(ctx, scroll) {
  // Parallax-Säulen (halbe Geschwindigkeit), sehr dunkel
  ctx.save();
  ctx.fillStyle = pal.wall;
  ctx.strokeStyle = pal.wallB;
  ctx.lineWidth = 3;
  const off = -((scroll * 0.5) % 520);
  for (let x = off; x < W + 100; x += 520) {
    ctx.fillRect(x, 190, 70, GROUND - 190);
    ctx.strokeRect(x, 190, 70, GROUND - 190);
  }
  ctx.restore();
}

// ---- ALTAR ------------------------------------------------------------------------------------------------
function stAltar(level) {
  const bal = createBalance(level, 150);
  const st = {
    type: 'altar',
    t: 0,
    lift: 0,
    need: DIFFICULTY.altarLiftTime(level),
    par: DIFFICULTY.altarLiftTime(level) + 10,
    update(grid, dt) {
      st.t += dt;
      if (bal.update(grid, dt)) return { fail: 'Das Artefakt ist heruntergefallen!' };
      if (bal.level) st.lift += dt / st.need;
      else st.lift = Math.max(0, st.lift - dt * 0.04);
      if (st.lift >= 1) {
        const bonus = Math.round(SCORE.artifact * (1 - Math.min(1, bal.maxWobble)));
        if (bonus > 0) addScore(bonus, W / 2, 380);
        STATS.artifacts++;
        playSound(soundPickup, 0.7);
        burst(W / 2, 500, pal.gold, 40, 420);
        return 'done';
      }
      return null;
    },
    draw(ctx) {
      bal.drawPads(ctx);
      // Sockel (Anzeige)
      ctx.save();
      ctx.fillStyle = pal.stone;
      ctx.fillRect(W / 2 - 110, 640, 220, 140);
      ctx.fillStyle = pal.stoneLight;
      ctx.fillRect(W / 2 - 140, 625, 280, 22);
      ctx.restore();
      bal.drawArtifact(ctx, W / 2, 600, st.lift, 1);
      // Hebe-Fortschritt
      ctx.save();
      ctx.strokeStyle = pal.dim;
      ctx.lineWidth = 3;
      ctx.strokeRect(W / 2 - 250, 830, 500, 26);
      ctx.fillStyle = bal.level ? pal.good : pal.padDim;
      ctx.fillRect(W / 2 - 250, 830, 500 * Math.min(1, st.lift), 26);
      ctx.restore();
      txt(ctx, bal.level ? 'WAAGERECHT – HEBEN!' : bal.mean < DIFFICULTY.altarMinLight ? 'Mehr Licht auf alle 4 Ecken!' : 'SCHIEF! Schwache Ecke stärken', W / 2, 900, 38, bal.level ? pal.good : pal.warn);
      bal.drawMeters(ctx, W / 2, 175);
    },
  };
  return st;
}

// ---- KUGEL-FLUCHT (und BOSS: Einsturzhalle) ---------------------------------------------------------------
const OBST = {
  ranke: { y: 600, label: 'RANKE' },
  brett: { y: 712, label: 'BRETTER' },
  tuer: { y: 660, label: 'TÜR' },
  netz: { y: 590, label: 'NETZ' },
};
const OBST_TYPES = ['ranke', 'brett', 'tuer', 'netz'];
const HOLE_W = 170;

function stKugel(level, boss) {
  const len = DIFFICULTY.runLength(level) * (boss ? 1.15 : 1);
  const items = [];
  let wx = 1100;
  const gapBase = DIFFICULTY.obstacleGap(level) * (boss ? 1.2 : 1);
  while (wx < len - 400) {
    const r = Math.random();
    if (r < DIFFICULTY.holeChance(level)) {
      items.push({ kind: 'hole', wx, done: false });
    } else if (r < DIFFICULTY.holeChance(level) + DIFFICULTY.idolChance(level)) {
      items.push({ kind: 'idol', wx, angry: false, pad: makePad(0, 540, 75, { fullPercent: 15, noHelper: true }) });
    } else {
      const type = OBST_TYPES[Math.floor(Math.random() * OBST_TYPES.length)];
      items.push({
        kind: 'obst',
        type,
        wx,
        done: false,
        pad: makePad(0, OBST[type].y, 72, { fullPercent: 25, speedUp: 110 + level * 4, speedDown: 15, label: OBST[type].label }),
      });
    }
    wx += gapBase * (0.75 + Math.random() * 0.5);
  }
  const jumpPad = makePad(1300, 915, 90, { fullPercent: 25, speedUp: 90, speedDown: 6, label: 'SPRUNG' });
  const st = {
    type: boss ? 'boss' : 'kugel',
    t: 0,
    par: len / DIFFICULTY.runSpeed(level) + 12,
    dist: 0,
    gap: DIFFICULTY.startGap,
    speed: DIFFICULTY.runSpeed(level),
    v: 0,
    phase: 0,
    jumpT: -1,
    adaState: 'run',
    bal: boss ? createBalance(level, 105, 165) : null,
    debris: [],
    debrisTimer: 2.5,
    damage: 0,
    update(grid, dt) {
      st.t += dt;
      const scr = (w) => ADA_X + (w - st.dist);
      // Eingaben der sichtbaren Objekte
      let blocked = false;
      let slow = 1;
      items.forEach((it) => {
        const x = scr(it.wx);
        if (x < -150 || x > W + 150) return;
        if (it.kind === 'obst' && !it.done) {
          it.pad.x = x;
          it.pad.update(grid, dt);
          if (it.pad.value >= 100) {
            it.done = true;
            STATS.obstacles++;
            addScore(SCORE.obstacle, x, it.pad.y - 90);
            burst(x, it.pad.y, it.type === 'ranke' ? pal.vine : pal.wood, 22, 320);
            playSound(soundPlop, 0.4);
          } else if (it.wx - st.dist < 75 && it.wx - st.dist > -40) {
            blocked = true;
          }
        } else if (it.kind === 'idol') {
          it.pad.x = x;
          it.pad.update(grid, dt);
          const angry = it.pad.strength > 0.25;
          if (angry && !it.angry) {
            STATS.idolsAngered++;
            addScore(-20, x, 420);
            playSound(soundError, 0.4);
          }
          it.angry = angry;
          if (angry) slow = Math.min(slow, 0.45);
        } else if (it.kind === 'hole' && !it.done) {
          const d = it.wx - st.dist;
          if (st.jumpT < 0 && d < 95 && d > 0 && jumpPad.value >= 100) {
            st.jumpT = 0;
            jumpPad.setValue(0);
            STATS.jumps++;
            addScore(SCORE.jump, ADA_X, GROUND - 260);
            playSound(soundConfirm, 0.5);
          }
          if (d < 0 && st.jumpT < 0) {
            it.done = true;
            st.adaState = 'fall';
            st.failing = 'Ada ist ins Loch gefallen!';
          }
          if (st.dist > it.wx + HOLE_W) it.done = true;
        }
      });
      if (st.failing) return { fail: st.failing };
      jumpPad.update(grid, dt);
      // Boss: Balance tragen + Felsbrocken
      if (st.bal) {
        if (st.bal.update(grid, dt, true)) return { fail: 'Das Artefakt ist heruntergefallen!' };
        if (!st.bal.level) slow = Math.min(slow, 0.6);
        st.debrisTimer -= dt;
        if (st.debrisTimer <= 0) {
          st.debrisTimer = DIFFICULTY.debrisInterval(level) * (0.7 + Math.random() * 0.6);
          const x = ADA_X - 80 + Math.random() * 760;
          st.debris.push({ wx: st.dist + (x - ADA_X), y: 140, vy: 40, pad: makePad(x, 140, 62, { fullPercent: 20, speedUp: 260, speedDown: 40 }) });
        }
        st.debris.slice().forEach((d) => {
          d.vy += 130 * dt;
          d.y += d.vy * dt;
          d.pad.x = scr(d.wx);
          d.pad.y = d.y;
          d.pad.update(grid, dt);
          if (d.pad.value >= 100) {
            st.debris.splice(st.debris.indexOf(d), 1);
            STATS.debris++;
            burst(d.pad.x, d.y, pal.stoneLight, 26, 380);
            addScore(SCORE.obstacle, d.pad.x, d.y - 60);
            playSound(soundPlop, 0.4);
          } else if (d.y >= GROUND - 50) {
            st.debris.splice(st.debris.indexOf(d), 1);
            dust(d.pad.x, GROUND, 14);
            shake = Math.max(shake, 0.25);
            playSound(soundStomp, 0.4);
            if (Math.abs(d.pad.x - ADA_X) < 90) {
              st.damage += 0.34;
              addFloater(ADA_X, GROUND - 240, 'AUTSCH!', pal.bad);
            }
          }
        });
        if (st.damage >= 1) return { fail: 'Von Felsbrocken getroffen!' };
      }
      // Bewegung
      const target = blocked ? 0 : st.speed * slow;
      st.v += (target - st.v) * Math.min(1, dt * 6);
      st.dist += st.v * dt*2;
      st.phase += st.v * dt * 0.035;
      if (st.jumpT >= 0) {
        st.jumpT += dt;
        if (st.jumpT > 0.75) st.jumpT = -1;
      }
      st.adaState = blocked ? 'scared' : st.jumpT >= 0 ? 'jump' : 'run';
      const vb = DIFFICULTY.runSpeed(level) * DIFFICULTY.boulderFactor(level);
      st.gap = Math.min(900, st.gap + (st.v - vb) * dt);
      if (st.gap < 320) shake = Math.max(shake, 0.08);
      if (Math.random() < dt * 8) dust(ADA_X - st.gap + 120, GROUND, 1);
      if (st.gap <= 70) return { fail: 'Die Kugel hat Ada erwischt!' };
      if (st.dist >= len) {
        playSound(soundConfirm, 0.6);
        return 'done';
      }
      return null;
    },
    draw(ctx) {
      const scr = (w) => ADA_X + (w - st.dist);
      drawPillars(ctx, st.dist);
      const holes = [];
      items.forEach((it) => {
        if (it.kind !== 'hole') return;
        const x = scr(it.wx);
        if (x > -HOLE_W && x < W + 50) holes.push({ x0: x, x1: x + HOLE_W });
      });
      drawFloor(ctx, st.dist, holes);
      // Ausgang
      const ex = scr(len);
      if (ex < W + 200) {
        ctx.save();
        ctx.strokeStyle = pal.good;
        ctx.lineWidth = 6;
        ctx.strokeRect(ex, GROUND - 300, 160, 300);
        ctx.restore();
        txt(ctx, 'AUSGANG', ex + 80, GROUND - 320, 36, pal.good);
      }
      // Objekte
      items.forEach((it) => {
        const x = scr(it.wx);
        if (x < -150 || x > W + 150) return;
        if (it.kind === 'obst' && !it.done) drawObstacle(ctx, it, x);
        if (it.kind === 'idol') drawIdol(ctx, it, x);
      });
      // Felsbrocken
      st.debris.forEach((d) => {
        ctx.save();
        ctx.globalAlpha = 0.35;
        ctx.fillStyle = pal.stoneDark;
        ctx.beginPath();
        ctx.ellipse(d.pad.x, GROUND + 6, 50, 10, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
        drawPad(ctx, d.pad, pal.warn, { noLabel: true });
      });
      // Ada
      const jy = st.jumpT >= 0 ? -Math.sin((st.jumpT / 0.75) * Math.PI) * 170 : 0;
      drawAda(ctx, ADA_X, GROUND + jy, st.phase, st.adaState === 'jump' ? 'run' : st.adaState, 1.1);
      if (st.bal) st.bal.drawArtifact(ctx, ADA_X + 10, GROUND - 210 + jy, 0, 0.35);
      // Kugel
      ensureBoulder();
      const bx = ADA_X - st.gap;
      if (bx > -240) {
        ctx.save();
        ctx.translate(bx, GROUND - 230);
        ctx.rotate(st.dist / 230);
        ctx.drawImage(boulderSprite, -boulderSprite.width / 2, -boulderSprite.height / 2);
        ctx.restore();
      } else {
        txt(ctx, '◀ KUGEL ' + Math.round((st.gap - ADA_X) / 10) + ' m', 140, GROUND - 120, 36, pal.warn);
      }
      // Sprung-Feld
      drawPad(ctx, jumpPad, jumpPad.value >= 100 ? pal.good : pal.pad);
      if (jumpPad.value >= 100) txt(ctx, 'BEREIT', jumpPad.x, jumpPad.y + 12, 30, pal.good);
      if (st.bal) {
        st.bal.drawPads(ctx);
        st.bal.drawMeters(ctx, 960, 175);
        // Schaden
        ctx.save();
        ctx.strokeStyle = pal.dim;
        ctx.lineWidth = 3;
        ctx.strokeRect(560, 1010, 300, 18);
        ctx.fillStyle = pal.bad;
        ctx.fillRect(560, 1010, 300 * Math.min(1, st.damage), 18);
        ctx.restore();
        txt(ctx, 'TREFFER', 710, 995, 24, pal.dim);
      }
      // Fortschritt oben
      drawProgress(ctx, st.dist / len, st.gap);
    },
  };
  return st;
}

function drawProgress(ctx, f, gap) {
  const x0 = 560;
  const x1 = 1360;
  const y = 125;
  ctx.save();
  ctx.strokeStyle = pal.dim;
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(x0, y);
  ctx.lineTo(x1, y);
  ctx.stroke();
  ctx.fillStyle = pal.ada;
  ctx.beginPath();
  ctx.arc(x0 + (x1 - x0) * Math.min(1, f), y, 10, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = pal.good;
  ctx.fillRect(x1 - 6, y - 14, 12, 28);
  ctx.restore();
  if (gap !== undefined) {
    const danger = gap < 300;
    txt(ctx, 'Vorsprung: ' + Math.max(0, Math.round(gap / 10)) + ' m', x1 + 160, y + 12, 30, danger ? pal.bad : pal.dim);
  }
}

function drawObstacle(ctx, it, x) {
  const y = it.pad.y;
  ctx.save();
  ctx.lineWidth = 5;
  if (it.type === 'ranke') {
    ctx.strokeStyle = pal.vine;
    for (let i = -2; i <= 2; i++) {
      ctx.beginPath();
      ctx.moveTo(x + i * 22, 190);
      ctx.quadraticCurveTo(x + i * 22 + Math.sin(clock * 2 + i) * 20, (190 + GROUND) / 2, x + i * 18, GROUND - 10);
      ctx.stroke();
    }
  } else if (it.type === 'brett') {
    ctx.strokeStyle = pal.wood;
    for (let i = 0; i < 3; i++) ctx.strokeRect(x - 70, GROUND - 40 - i * 48, 140, 36);
  } else if (it.type === 'tuer') {
    ctx.strokeStyle = pal.stoneLight;
    ctx.strokeRect(x - 80, GROUND - 330, 160, 330);
  } else {
    ctx.strokeStyle = pal.dim;
    ctx.lineWidth = 2;
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * Math.PI * 2;
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.lineTo(x + Math.cos(a) * 150, y + Math.sin(a) * 150);
      ctx.stroke();
    }
  }
  ctx.restore();
  drawPad(ctx, it.pad, pal.pad);
}

function drawIdol(ctx, it, x) {
  // Wächter-Statue: gute Figur, NICHT anleuchten – nur dunkle Kontur
  const c = it.angry ? pal.bad : pal.padDim;
  ctx.save();
  ctx.strokeStyle = c;
  ctx.lineWidth = 4;
  ctx.strokeRect(x - 45, 470, 90, 180);
  ctx.beginPath();
  ctx.arc(x, 440, 40, 0, Math.PI * 2);
  ctx.stroke();
  ctx.fillStyle = c;
  ctx.fillRect(x - 18, 432, 10, 10);
  ctx.fillRect(x + 8, 432, 10, 10);
  ctx.restore();
  txt(ctx, it.angry ? 'NICHT ANLEUCHTEN!' : 'Wächter', x, 700, 26, c);
}

// Schaden-Balken (Pfeilwand, Schlangen)
function drawDamage(ctx, damage, label) {
  ctx.save();
  ctx.strokeStyle = pal.dim;
  ctx.lineWidth = 3;
  ctx.strokeRect(W / 2 - 200, 112, 400, 22);
  ctx.fillStyle = damage > 0.6 ? pal.bad : pal.warn;
  ctx.fillRect(W / 2 - 200, 112, 400 * Math.min(1, damage), 22);
  ctx.restore();
  txt(ctx, label || 'SCHADEN', W / 2 - 230, 132, 26, pal.dim, 'right');
}

// ---- PFEILWAND --------------------------------------------------------------------------------------------
function stPfeil(level) {
  const n = DIFFICULTY.arrowSlots(level);
  const cols = Math.ceil(n / 2);
  const slots = [];
  for (let i = 0; i < n; i++) {
    const row = i % 2;
    const c = Math.floor(i / 2);
    const x = 300 + ((1620 - 300) * (c + 0.5)) / cols + (row ? 40 : -40);
    const y = row ? 520 : 320;
    slots.push({ state: 'idle', t: 0, pad: makePad(x, y, 62, { fullPercent: 25, speedUp: 170, speedDown: 40 }) });
  }
  const walk = DIFFICULTY.arrowWalkTime(level);
  const st = {
    type: 'pfeil',
    t: 0,
    par: walk + 6,
    x: 140,
    phase: 0,
    damage: 0,
    timer: 1.2,
    arrows: [],
    update(grid, dt) {
      st.t += dt;
      st.x += ((1780 - 140) / walk) * dt;
      st.phase += dt * 6;
      st.timer -= dt;
      if (st.timer <= 0) {
        st.timer = DIFFICULTY.arrowInterval(level) * (0.7 + Math.random() * 0.6);
        const idle = slots.filter((s) => s.state === 'idle');
        if (idle.length) {
          const s = idle[Math.floor(Math.random() * idle.length)];
          s.state = 'warn';
          s.t = DIFFICULTY.arrowWarn(level);
        }
      }
      slots.forEach((s) => {
        s.pad.update(grid, dt);
        if (s.state === 'idle') {
          s.pad.setValue(0);
        } else if (s.state === 'warn') {
          s.t -= dt;
          if (s.pad.value >= 100) {
            s.state = 'plugged';
            STATS.arrowsPlugged++;
            addScore(SCORE.obstacle, s.pad.x, s.pad.y - 80);
            burst(s.pad.x, s.pad.y, pal.good, 16, 250);
            playSound(soundPlop, 0.4);
          } else if (s.t <= 0) {
            s.state = 'idle';
            st.arrows.push({ x: s.pad.x, y: s.pad.y, tx: st.x, ty: GROUND - 110 });
            playSound(soundError, 0.25);
          }
        }
      });
      st.arrows.slice().forEach((a) => {
        const dx = a.tx - a.x;
        const dy = a.ty - a.y;
        const d = Math.hypot(dx, dy);
        const step = 1500 * dt;
        if (d <= step) {
          st.arrows.splice(st.arrows.indexOf(a), 1);
          st.damage += DIFFICULTY.arrowDamage;
          burst(a.tx, a.ty, pal.bad, 12, 260);
          shake = Math.max(shake, 0.2);
          addFloater(st.x, GROUND - 230, 'AU!', pal.bad);
        } else {
          a.x += (dx / d) * step;
          a.y += (dy / d) * step;
        }
      });
      if (st.damage >= 1) return { fail: 'Zu viele Pfeile!' };
      if (st.x >= 1780) return 'done';
      return null;
    },
    draw(ctx) {
      drawFloor(ctx, st.x, []);
      slots.forEach((s) => {
        if (s.state === 'plugged') {
          ctx.save();
          ctx.strokeStyle = pal.good;
          ctx.lineWidth = 4;
          ctx.beginPath();
          ctx.arc(s.pad.x, s.pad.y, 40, 0, Math.PI * 2);
          ctx.stroke();
          ctx.restore();
        } else {
          const warn = s.state === 'warn';
          const blink = warn && Math.sin(clock * 18) > 0;
          drawPad(ctx, s.pad, warn ? (blink ? pal.warn : pal.bad) : pal.padDim, { lineWidth: warn ? 7 : 3 });
        }
      });
      ctx.save();
      ctx.strokeStyle = pal.bad;
      ctx.lineWidth = 5;
      st.arrows.forEach((a) => {
        const ang = Math.atan2(a.ty - a.y, a.tx - a.x);
        ctx.beginPath();
        ctx.moveTo(a.x, a.y);
        ctx.lineTo(a.x - Math.cos(ang) * 60, a.y - Math.sin(ang) * 60);
        ctx.stroke();
      });
      ctx.restore();
      drawAda(ctx, st.x, GROUND, st.phase, 'walk', 1);
      drawDamage(ctx, st.damage);
    },
  };
  return st;
}

// ---- SEILBRÜCKE -------------------------------------------------------------------------------------------
function stBruecke(level) {
  const n = DIFFICULTY.planks(level);
  const x0 = 260;
  const x1 = 1660;
  const pw = (x1 - x0) / n;
  const planks = [];
  for (let i = 0; i < n; i++) {
    const cx = x0 + pw * (i + 0.5);
    planks.push({ unsafe: 0, broken: false, pad: makePad(cx, GROUND + 30, Math.min(70, pw / 2 - 4), { shape: 'rect', w: pw - 12, h: 60, fullPercent: 25, speedUp: 160, speedDown: 22 }) });
  }
  const st = {
    type: 'bruecke',
    t: 0,
    par: (1800 - 120) / DIFFICULTY.bridgeSpeed(level) + 8,
    x: 120,
    phase: 0,
    gust: 0,
    gustTimer: 4,
    update(grid, dt) {
      st.t += dt;
      st.x += DIFFICULTY.bridgeSpeed(level) * dt;
      st.phase += dt * 6;
      st.gustTimer -= dt;
      if (st.gustTimer <= 0) {
        st.gust = 2;
        st.gustTimer = 5 + Math.random() * 3;
      }
      st.gust = Math.max(0, st.gust - dt);
      const sway = st.gust > 0 ? Math.sin(clock * 9) * 14 : Math.sin(clock * 2) * 3;
      let fail = null;
      planks.forEach((p) => {
        p.pad.y = GROUND + 30 + sway;
        p.pad.update(grid, dt);
        if (st.gust > 0) p.pad.setValue(Math.max(0, p.pad.value - DIFFICULTY.gustDrain(level) * dt));
        const under = st.x > p.pad.x - pw / 2 && st.x <= p.pad.x + pw / 2;
        if (under) {
          if (p.pad.value < 50) {
            p.unsafe += dt;
            if (p.unsafe > DIFFICULTY.bridgeGrace) {
              p.broken = true;
              fail = 'Ein Brett ist gerissen!';
            }
          } else {
            p.unsafe = Math.max(0, p.unsafe - dt);
          }
        }
      });
      if (fail) return { fail };
      if (st.x >= 1790) return 'done';
      return null;
    },
    draw(ctx) {
      // Schlucht
      ctx.save();
      ctx.fillStyle = pal.stoneDark;
      ctx.fillRect(0, GROUND, x0, H - GROUND);
      ctx.fillRect(x1, GROUND, W - x1, H - GROUND);
      ctx.restore();
      const sway = st.gust > 0 ? Math.sin(clock * 9) * 14 : Math.sin(clock * 2) * 3;
      // Seile (Anzeige)
      ctx.save();
      ctx.strokeStyle = pal.wood;
      ctx.lineWidth = 4;
      [GROUND - 6, GROUND - 120].forEach((y) => {
        ctx.beginPath();
        ctx.moveTo(x0, y);
        ctx.quadraticCurveTo(W / 2, y + 40 + sway, x1, y);
        ctx.stroke();
      });
      ctx.restore();
      planks.forEach((p) => {
        const under = st.x > p.pad.x - pw / 2 && st.x <= p.pad.x + pw / 2;
        const c = p.broken ? pal.bad : under && p.pad.value < 50 ? pal.warn : p.pad.value >= 50 ? pal.good : pal.wood;
        drawPad(ctx, p.pad, c, { lineWidth: under ? 6 : 3 });
      });
      if (st.gust > 0) txt(ctx, '~ WINDBÖE ~', W / 2, 260, 60, pal.warn);
      drawAda(ctx, st.x, GROUND + sway * 0.6, st.phase, 'walk', 1);
    },
  };
  return st;
}

// ---- FALLGITTER -------------------------------------------------------------------------------------------
function stGitter(level) {
  const n = DIFFICULTY.gates(level);
  const xs = n === 1 ? [1100] : n === 2 ? [820, 1380] : [650, 1060, 1470];
  const gates = xs.map((x) => ({ x, pad: makePad(x, 250, 150, { fullPercent: 35, speedUp: 75, speedDown: DIFFICULTY.gateFall(level), label: 'HEBEL' }) }));
  const st = {
    type: 'gitter',
    t: 0,
    par: 25 + n * 6,
    x: 120,
    phase: 0,
    waiting: false,
    update(grid, dt) {
      st.t += dt;
      gates.forEach((g) => g.pad.update(grid, dt));
      st.waiting = false;
      let fail = null;
      gates.forEach((g) => {
        const h = g.pad.value / 100;
        const d = g.x - st.x;
        if (d > 0 && d < 75 && h < 0.75) st.waiting = true;
        if (Math.abs(d) <= 60 && h < 0.35) fail = 'Vom Fallgitter erwischt!';
      });
      if (fail) return { fail };
      if (!st.waiting) {
        st.x += 170 * dt;
        st.phase += dt * 6;
      }
      if (st.t > DIFFICULTY.gateTorch) return { fail: 'Die Fackel ist erloschen!' };
      if (st.x >= 1790) return 'done';
      return null;
    },
    draw(ctx) {
      drawFloor(ctx, 0, []);
      gates.forEach((g) => {
        const h = g.pad.value / 100;
        const top = GROUND - 340;
        const bottom = top + (GROUND - top) * (1 - h);
        ctx.save();
        ctx.strokeStyle = pal.stoneLight;
        ctx.lineWidth = 6;
        ctx.strokeRect(g.x - 90, top, 180, GROUND - top);
        ctx.strokeStyle = h < 0.75 ? pal.bad : pal.good;
        ctx.lineWidth = 5;
        for (let i = -3; i <= 3; i++) {
          ctx.beginPath();
          ctx.moveTo(g.x + i * 24, top);
          ctx.lineTo(g.x + i * 24, bottom);
          ctx.stroke();
        }
        ctx.beginPath();
        ctx.moveTo(g.x - 80, bottom);
        ctx.lineTo(g.x + 80, bottom);
        ctx.stroke();
        ctx.restore();
        drawPad(ctx, g.pad, g.pad.value >= 75 ? pal.padActive : pal.pad, { noLabel: true });
        txt(ctx, 'HEBEL ' + Math.round(h * 100) + '%', g.x, 262, 34, pal.dim);
      });
      drawAda(ctx, st.x, GROUND, st.phase, st.waiting ? 'stand' : 'walk', 1);
      const left = Math.max(0, DIFFICULTY.gateTorch - st.t);
      txt(ctx, 'Fackel: ' + Math.ceil(left) + ' s', 250, 560, 40, left < 10 ? pal.bad : pal.dim);
      if (st.waiting) txt(ctx, 'Ada wartet – Gitter hoch!', st.x, GROUND - 230, 34, pal.warn);
    },
  };
  return st;
}

// ---- SCHLANGENGRUBE ---------------------------------------------------------------------------------------
function stSchlangen(level) {
  const ax = W / 2;
  const ay = GROUND - 80; // Zielpunkt (Ada)
  const lantern = makePad(ax + 50, GROUND - 120, 70, { fullPercent: 15, noHelper: true });
  const dur = DIFFICULTY.snakeDuration(level);
  const spawns = [
    [-60, GROUND - 30],
    [W + 60, GROUND - 30],
    [-60, 430],
    [W + 60, 430],
    [300, 150],
    [W - 300, 150],
  ];
  const st = {
    type: 'schlangen',
    t: 0,
    par: dur + 2,
    damage: 0,
    timer: 0.5,
    snakes: [],
    blind: false,
    update(grid, dt) {
      st.t += dt;
      st.timer -= dt;
      const maxSpawn = level < 6 ? 4 : 6;
      if (st.timer <= 0 && st.t < dur - 2) {
        st.timer = DIFFICULTY.snakeInterval(level) * (0.7 + Math.random() * 0.6);
        const sp = spawns[Math.floor(Math.random() * maxSpawn)];
        st.snakes.push({ x: sp[0], y: sp[1], flee: false, recoil: 0, trail: [], pad: makePad(sp[0], sp[1], 60, { fullPercent: 20, speedUp: 180, speedDown: 50 }) });
      }
      lantern.update(grid, dt);
      st.blind = lantern.strength > 0.25;
      if (st.blind) st.damage += 0.18 * dt;
      st.snakes.slice().forEach((s) => {
        s.pad.x = s.x;
        s.pad.y = s.y;
        s.pad.update(grid, dt);
        const dx = ax - s.x;
        const dy = ay - s.y;
        const d = Math.hypot(dx, dy) || 1;
        let sp = DIFFICULTY.snakeSpeed(level);
        if (!s.flee && s.pad.value >= 100) {
          s.flee = true;
          STATS.snakesScared++;
          addScore(SCORE.obstacle, s.x, s.y - 70);
          playSound(soundPlop, 0.35);
        }
        if (s.flee) sp = -sp * 2.5;
        else if (s.pad.strength > 0.15) sp = -sp * 1.4; // zurückweichen, solange beleuchtet
        s.x += (dx / d) * sp * dt;
        s.y += (dy / d) * sp * dt + Math.sin(clock * 6 + s.x * 0.01) * 30 * dt;
        s.trail.unshift({ x: s.x, y: s.y });
        if (s.trail.length > 26) s.trail.pop();
        if (!s.flee && d < 80) {
          st.snakes.splice(st.snakes.indexOf(s), 1);
          st.damage += DIFFICULTY.snakeDamage;
          shake = Math.max(shake, 0.25);
          burst(ax, ay, pal.bad, 14, 260);
          addFloater(ax, ay - 180, 'BISS!', pal.bad);
          playSound(soundError, 0.4);
        } else if (s.flee && (s.x < -150 || s.x > W + 150 || s.y < -150 || s.y > H + 150)) {
          st.snakes.splice(st.snakes.indexOf(s), 1);
        }
      });
      if (st.damage >= 1) return { fail: st.blind ? 'Geblendet und gebissen!' : 'Zu viele Schlangenbisse!' };
      if (st.t >= dur) return 'done';
      return null;
    },
    draw(ctx) {
      drawFloor(ctx, 0, []);
      // Felsvorsprünge (Anzeige)
      ctx.save();
      ctx.strokeStyle = pal.stone;
      ctx.lineWidth = 4;
      [[0, 470, 380], [W - 380, 470, 380]].forEach((l) => ctx.strokeRect(l[0], l[1], l[2], 20));
      // Säule unter Ada
      ctx.fillStyle = pal.stoneDark;
      ctx.fillRect(ax - 70, GROUND - 10, 140, 30);
      ctx.restore();
      st.snakes.forEach((s) => {
        ctx.save();
        ctx.strokeStyle = s.flee ? pal.padDim : pal.snake;
        ctx.lineWidth = 12;
        ctx.lineCap = 'round';
        ctx.beginPath();
        s.trail.forEach((p, i) => {
          if (i === 0) ctx.moveTo(p.x, p.y);
          else ctx.lineTo(p.x, p.y);
        });
        ctx.stroke();
        ctx.restore();
        drawPad(ctx, s.pad, s.flee ? pal.padDim : s.pad.strength > 0.15 ? pal.good : pal.snake, { noLabel: true });
        if (!s.flee) {
          ctx.save();
          ctx.fillStyle = pal.warn;
          ctx.fillRect(s.x - 18, s.y - 10, 8, 8);
          ctx.fillRect(s.x + 10, s.y - 10, 8, 8);
          ctx.restore();
        }
      });
      drawAda(ctx, ax, GROUND - 10, clock * 3, 'scared', 1.1);
      // Laterne: gutes Objekt – Kontur zeigt, wo NICHT hinleuchten
      ctx.save();
      ctx.strokeStyle = st.blind ? pal.bad : pal.padDim;
      ctx.setLineDash([10, 8]);
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(lantern.x, lantern.y, lantern.r, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();
      if (st.blind) txt(ctx, 'NICHT IN DIE LATERNE LEUCHTEN!', W / 2, 330, 46, pal.bad);
      txt(ctx, 'Durchhalten: ' + Math.max(0, Math.ceil(dur - st.t)) + ' s', W / 2, 200, 40, pal.dim);
      drawDamage(ctx, st.damage);
    },
  };
  return st;
}

// ---- WASSERKAMMER -----------------------------------------------------------------------------------------
function stWasser(level) {
  const n = DIFFICULTY.valves(level);
  const pos = n === 3 ? [[330, 330], [1590, 330], [960, 270]] : [[330, 330], [1590, 330], [720, 280], [1200, 280]];
  const valves = pos.map((p, i) => ({ pad: makePad(p[0], p[1], 105, { fullPercent: 28, speedUp: 110, speedDown: 30, label: 'VENTIL ' + (i + 1) }) }));
  const headY = 560;
  const st = {
    type: 'wasser',
    t: 0,
    par: 30,
    water: H - 40,
    drain: 0,
    open: false,
    update(grid, dt) {
      st.t += dt;
      valves.forEach((v) => v.pad.update(grid, dt));
      st.open = valves.every((v) => v.pad.value >= 90);
      if (st.open) {
        st.drain += dt / DIFFICULTY.drainTime(level);
        st.water = Math.min(H - 40, st.water + DIFFICULTY.waterRise(level) * 2.5 * dt);
      } else {
        st.drain = Math.max(0, st.drain - dt * 0.05);
        st.water -= DIFFICULTY.waterRise(level) * dt;
      }
      if (st.water <= headY) return { fail: 'Ada ist abgesoffen!' };
      if (st.drain >= 1) {
        playSound(soundSplash, 0.6);
        return 'done';
      }
      return null;
    },
    draw(ctx) {
      // Steinblock + Ada
      ctx.save();
      ctx.fillStyle = pal.stoneDark;
      ctx.fillRect(W / 2 - 90, 740, 180, H - 740);
      ctx.restore();
      drawAda(ctx, W / 2, 740, clock * 2, 'scared', 1);
      // Wasser (Anzeige, bunt erlaubt)
      ctx.save();
      ctx.globalAlpha = 0.55;
      const grad = ctx.createLinearGradient(0, st.water, 0, H);
      grad.addColorStop(0, pal.water);
      grad.addColorStop(1, pal.waterDeep);
      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.moveTo(0, H);
      for (let x = 0; x <= W; x += 40) ctx.lineTo(x, st.water + Math.sin(clock * 3 + x * 0.01) * 10);
      ctx.lineTo(W, H);
      ctx.closePath();
      ctx.fill();
      ctx.restore();
      // Markierung Kopfhöhe
      ctx.save();
      ctx.strokeStyle = pal.bad;
      ctx.setLineDash([14, 10]);
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(W / 2 - 260, headY);
      ctx.lineTo(W / 2 + 260, headY);
      ctx.stroke();
      ctx.restore();
      valves.forEach((v) => {
        drawPad(ctx, v.pad, v.pad.value >= 90 ? pal.good : pal.pad);
        // Rad-Speichen als Kontur
        ctx.save();
        ctx.strokeStyle = v.pad.value >= 90 ? pal.good : pal.padDim;
        ctx.lineWidth = 3;
        const a0 = (v.pad.value / 100) * Math.PI * 2;
        for (let i = 0; i < 4; i++) {
          const a = a0 + (i * Math.PI) / 2;
          ctx.beginPath();
          ctx.moveTo(v.pad.x, v.pad.y);
          ctx.lineTo(v.pad.x + Math.cos(a) * v.pad.r * 0.8, v.pad.y + Math.sin(a) * v.pad.r * 0.8);
          ctx.stroke();
        }
        ctx.restore();
      });
      // Abfluss-Fortschritt
      ctx.save();
      ctx.strokeStyle = pal.dim;
      ctx.lineWidth = 3;
      ctx.strokeRect(W / 2 - 250, 120, 500, 22);
      ctx.fillStyle = pal.good;
      ctx.fillRect(W / 2 - 250, 120, 500 * Math.min(1, st.drain), 22);
      ctx.restore();
      txt(ctx, st.open ? 'ALLE OFFEN – ES LÄUFT AB!' : 'Alle Ventile gleichzeitig voll!', W / 2, 470, 40, st.open ? pal.good : pal.warn);
    },
  };
  return st;
}

const STATION_FACTORY = {
  altar: (l) => stAltar(l),
  kugel: (l) => stKugel(l, false),
  boss: (l) => stKugel(l, true),
  pfeil: (l) => stPfeil(l),
  bruecke: (l) => stBruecke(l),
  gitter: (l) => stGitter(l),
  schlangen: (l) => stSchlangen(l),
  wasser: (l) => stWasser(l),
};

// ---------------------------------------------------------------------------------------------------------
// Ablauf: Tempel → Stationen → Tempel-Übergang → … → Sieg / Game Over
// ---------------------------------------------------------------------------------------------------------

function currentLevel() {
  return templeIndex + 1;
}

function setScene(s) {
  scene = s;
  sceneTime = 0;
}

function resetGame() {
  ensurePalette();
  templeIndex = 0;
  stationIndex = 0;
  station = null;
  lives = SETTINGS.lives;
  score = 0;
  particles = [];
  floaters = [];
  shake = 0;
  flash = 0;
  failReason = '';
  newHighscore = false;
  STATS = newStats();
  bgCanvas = null;
}

function startGame() {
  resetGame();
  startStation();
}

function startStation() {
  const t = TEMPLES[templeIndex];
  station = STATION_FACTORY[t.stations[stationIndex]](currentLevel());
  setScene('intro');
}

function stationDone() {
  const l = currentLevel();
  const bonus = Math.max(0, Math.round((station.par - station.t) * SCORE.timeBonus));
  addScore(SCORE.station + l * SCORE.perLevel + bonus, W / 2, 300);
  STATS.stations++;
  flash = 0.6;
  stationIndex++;
  if (stationIndex >= TEMPLES[templeIndex].stations.length) {
    playSound(soundLevelUp, 0.7);
    if (templeIndex >= TEMPLES.length - 1) {
      endGame(true);
    } else {
      setScene('templeDone');
    }
  } else {
    startStation();
  }
}

function stationFailed(reason) {
  lives--;
  STATS.fails++;
  failReason = reason;
  shake = 0.6;
  playSound(soundExplosion, 0.5);
  if (lives <= 0) endGame(false);
  else setScene('fail');
}

function endGame(won) {
  highscore.addEntry({
    punkte: score,
    tempel: won ? TEMPLES.length : templeIndex,
    stationen: STATS.stations,
    laternen: Math.max(0, lives),
  });
  newHighscore = highscore.lastEntryNewHighscore();
  bestScore = Math.max(bestScore, score);
  againButton = null;
  setScene(won ? 'victory' : 'gameover');
}

function makeBigButton(label, y) {
  return guiFillButton({
    label,
    posX: W / 2,
    posY: y,
    radius: 140,
    edges: 6,
    speedUp: 45,
    speedDown: 20,
    activeValue: 85,
    lineWidth: 5,
    normalColor: pal.padDim,
    growColor: pal.pad,
    activeColor: pal.padActive,
    onEnterActive: () => startGame(),
  });
}

// Kleines Highscore-Panel (renderHighAndLowScores läge auf den Pads)
function drawHighscorePanel(ctx, x, y) {
  const best = highscore.getHighscore();
  txt(ctx, 'HIGHSCORE', x, y, 34, pal.gold, 'left');
  if (best) {
    txt(ctx, best.punkte + ' Punkte · Tempel ' + best.tempel + '/12', x, y + 44, 30, pal.text, 'left');
  } else {
    txt(ctx, 'noch leer – wie damals am C64: der Erste schreibt Geschichte', x, y + 44, 26, pal.dim, 'left');
  }
}

function drawHud(ctx) {
  const t = TEMPLES[templeIndex];
  ctx.save();
  ctx.fillStyle = '#000000';
  ctx.globalAlpha = 0.7;
  ctx.fillRect(0, 0, W, 90);
  ctx.restore();
  txt(ctx, 'TEMPEL ' + currentLevel() + '/12 · ' + t.name + (t.boss ? ' (BOSS)' : ''), 30, 60, 40, pal.text, 'left');
  txt(ctx, 'Station ' + Math.min(stationIndex + 1, t.stations.length) + '/' + t.stations.length, 1120, 60, 40, pal.dim);
  txt(ctx, score + ' P', 1560, 60, 44, pal.gold, 'right');
  // Laternen = Leben
  for (let i = 0; i < SETTINGS.lives; i++) {
    const x = 1640 + i * 80;
    ctx.save();
    ctx.strokeStyle = pal.lantern;
    ctx.lineWidth = 3;
    ctx.strokeRect(x, 22, 34, 48);
    if (i < lives) {
      ctx.fillStyle = pal.lantern;
      ctx.shadowColor = pal.lantern;
      ctx.shadowBlur = 14 + Math.sin(clock * 9 + i) * 4;
      ctx.fillRect(x + 7, 32, 20, 28);
    }
    ctx.restore();
  }
}

function drawTorches(ctx, dt) {
  // Wandfackeln mit Flackern (Anzeige, außerhalb der Pads)
  [[620, 150], [1300, 150]].forEach((p) => {
    if (Math.random() < dt * 30 && particles.length < SETTINGS.maxParticles) {
      particles.push({ x: p[0] + (Math.random() - 0.5) * 12, y: p[1], vx: (Math.random() - 0.5) * 30, vy: -60 - Math.random() * 60, life: 0.5, max: 0.5, color: pal.fire, size: 4 + Math.random() * 4, grav: -40 });
    }
    ctx.save();
    ctx.fillStyle = pal.wood;
    ctx.fillRect(p[0] - 6, p[1], 12, 40);
    ctx.fillStyle = pal.fire;
    ctx.shadowColor = pal.fire;
    ctx.shadowBlur = 20;
    ctx.beginPath();
    ctx.arc(p[0], p[1] - 4, 9 + Math.sin(clock * 20) * 2, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  });
}

// ---------------------------------------------------------------------------------------------------------
// Szenen
// ---------------------------------------------------------------------------------------------------------

function handleTitle(grid, dt, ctx) {
  templeIndex = 0;
  ensureBackground();
  ctx.drawImage(bgCanvas, 0, 0);
  drawTorches(ctx, dt);
  // Ada rennt unten vor der Kugel her (Endlosschleife)
  const loop = (clock * 260) % (W + 900);
  const ax = loop - 200;
  ensureBoulder();
  drawFloor(ctx, clock * 260, []);
  ctx.save();
  ctx.translate(ax - 420, GROUND - 230);
  ctx.rotate(clock * 1.2);
  ctx.drawImage(boulderSprite, -boulderSprite.width / 2, -boulderSprite.height / 2);
  ctx.restore();
  drawAda(ctx, ax, GROUND, clock * 9, 'run', 1.1);
  updateEffects(dt, ctx);
  txt(ctx, 'TEMPELSTURZ', W / 2, 250, 150, pal.gold);
  txt(ctx, 'Professorin Ada Kranich und die zwölf Fallen-Tempel', W / 2, 330, 44, pal.text);
  txt(ctx, 'Hindernisse wegleuchten · Artefakt auf 4 Ecken balancieren · Statuen und Laterne NICHT anleuchten', W / 2, 390, 30, pal.dim);
  if (!startButton) startButton = makeBigButton('START', 560);
  startButton.handle(grid, dt);
  drawHighscorePanel(ctx, 40, 960);
  txt(ctx, 'Rick Dangerous und Pitfall lassen grüßen', W - 40, 1050, 26, pal.dim, 'right');
  if (keyEdge('Space')) startGame();
}

function handleIntro(grid, dt, ctx) {
  sceneTime += dt;
  drawStationScene(ctx, dt, false);
  const info = STATION_INFO[station.type];
  ctx.save();
  ctx.fillStyle = '#000000';
  ctx.globalAlpha = 0.75;
  ctx.fillRect(0, 380, W, 280);
  ctx.restore();
  txt(ctx, info.name, W / 2, 500, 110, station.type === 'boss' ? pal.bad : pal.gold);
  txt(ctx, info.hint, W / 2, 590, 40, pal.text);
  if (sceneTime > SETTINGS.introDuration || (sceneTime > 0.3 && keyEdge('Space'))) setScene('station');
}

function handleStation(grid, dt, ctx) {
  sceneTime += dt;
  STATS.time += dt;
  let res = station.update(grid, dt);
  if (keyEdge('KeyN')) res = 'done';
  if (keyEdge('KeyX')) res = { fail: 'Test: Laterne verloren' };
  if (keyEdge('KeyB')) {
    stationIndex = TEMPLES[templeIndex].stations.length - 1;
    res = 'done';
  }
  drawStationScene(ctx, dt, true);
  if (res === 'done') stationDone();
  else if (res && res.fail) stationFailed(res.fail);
}

function drawStationScene(ctx, dt, live) {
  ensureBackground();
  ctx.drawImage(bgCanvas, 0, 0);
  drawTorches(ctx, dt);
  station.draw(ctx);
  updateEffects(live ? dt : dt * 0.3, ctx);
  drawHud(ctx);
}

function handleFail(grid, dt, ctx) {
  sceneTime += dt;
  drawStationScene(ctx, dt, false);
  ctx.save();
  ctx.fillStyle = '#000000';
  ctx.globalAlpha = 0.8;
  ctx.fillRect(0, 360, W, 320);
  ctx.restore();
  txt(ctx, 'AUTSCH!', W / 2, 480, 120, pal.bad);
  txt(ctx, failReason, W / 2, 560, 46, pal.text);
  txt(ctx, 'Noch ' + lives + (lives === 1 ? ' Laterne' : ' Laternen') + ' – die Station beginnt von vorn', W / 2, 630, 36, pal.dim);
  if (sceneTime > SETTINGS.failDuration || (sceneTime > 0.5 && keyEdge('Space'))) startStation();
}

function handleTempleDone(grid, dt, ctx) {
  sceneTime += dt;
  ensureBackground();
  ctx.drawImage(bgCanvas, 0, 0);
  if (Math.random() < 0.4) burst(Math.random() * W, 200 + Math.random() * 500, pal.gold, 16, 300);
  updateEffects(dt, ctx);
  const next = TEMPLES[templeIndex + 1];
  txt(ctx, 'TEMPEL ' + currentLevel() + ' GESCHAFFT!', W / 2, 330, 110, pal.gold);
  txt(ctx, TEMPLES[templeIndex].name + ' liegt hinter euch · ' + score + ' Punkte', W / 2, 430, 44, pal.text);
  txt(ctx, 'Als Nächstes: TEMPEL ' + (currentLevel() + 1) + ' – ' + next.name + (next.boss ? ' (BOSS!)' : ''), W / 2, 540, 50, next.boss ? pal.bad : pal.good);
  const newTypes = next.stations.filter((s) => !TEMPLES.slice(0, templeIndex + 1).some((t) => t.stations.indexOf(s) >= 0));
  if (newTypes.length) txt(ctx, 'NEU: ' + newTypes.map((s) => STATION_INFO[s].name).join(', '), W / 2, 620, 42, pal.warn);
  drawAda(ctx, W / 2, 900, clock * 4, 'stand', 1.3);
  if (sceneTime > SETTINGS.templeDoneDuration || (sceneTime > 0.6 && keyEdge('Space'))) {
    templeIndex++;
    stationIndex = 0;
    startStation();
  }
}

function handleEnd(grid, dt, ctx, won) {
  sceneTime += dt;
  ensureBackground();
  ctx.drawImage(bgCanvas, 0, 0);
  if (won && Math.random() < 0.5) burst(Math.random() * W, Math.random() * 600, pal.gold, 20, 360);
  updateEffects(dt, ctx);
  txt(ctx, won ? 'ALLE ZWÖLF TEMPEL!' : 'GAME OVER', W / 2, 220, won ? 120 : 150, won ? pal.gold : pal.bad);
  txt(
    ctx,
    (won ? 'Ada Kranich ist eine Legende.' : 'Ada kam bis ' + TEMPLES[templeIndex].name + ' (Tempel ' + currentLevel() + ').') + '\n' +
      score + ' Punkte' + (newHighscore ? '  – NEUER HIGHSCORE! Wie früher am Amiga: Initialen bitte selbst denken.' : '') + '\n' +
      'Stationen: ' + STATS.stations + '   Artefakte: ' + STATS.artifacts + '   Hindernisse: ' + STATS.obstacles + '   Sprünge: ' + STATS.jumps + '\n' +
      'Pfeile verstopft: ' + STATS.arrowsPlugged + '   Schlangen verscheucht: ' + STATS.snakesScared + '   Felsbrocken: ' + STATS.debris + '\n' +
      'Wächter verärgert: ' + STATS.idolsAngered + '   Fehlversuche: ' + STATS.fails + '   Zeit: ' + Math.floor(STATS.time / 60) + ':' + ('0' + Math.floor(STATS.time % 60)).slice(-2),
    W / 2,
    320,
    38,
    pal.text,
    'center',
    56
  );
  drawHighscorePanel(ctx, 40, 960);
  if (sceneTime > 2) {
    if (!againButton) againButton = makeBigButton('NOCHMAL', 780);
    againButton.handle(grid, dt);
    if (keyEdge('Space')) startGame();
  }
}

// ---------------------------------------------------------------------------------------------------------

export default {
  name: 'Tempelsturz',
  description:
    'Tempelsturz – Professorin Ada Kranich und die zwölf Fallen-Tempel\n\n' +
    'Der ganze Saal hilft Ada durch 12 Tempel voller Stationen:\n' +
    'Artefakt auf 4 Ecken waagerecht halten, vor der rollenden Kugel fliehen,\n' +
    'Pfeillöcher zuleuchten, Brücken halten, Gitter heben, Schlangen verscheuchen, Ventile öffnen.\n' +
    'Wächter-Statuen und Adas Laterne NICHT anleuchten!\n' +
    '3 Laternen = 3 Leben.',
  image: 'media/img/gametitles/laser-haystack-###4###.png',
  init() {
    ensurePalette();
    resetGame();
    startButton = null;
    againButton = null;
    setScene('title');
  },
  handle(grid, elapsed) {
    const dt = Math.min(elapsed || 0, 0.1);
    const ctx = MasterCanvas.get2dContext();
    ensurePalette();
    clock += dt;
    if (!station && scene !== 'title') setScene('title');
    ctx.save();
    if (shake > 0) {
      shake = Math.max(0, shake - dt);
      ctx.translate((Math.random() - 0.5) * shake * 40, (Math.random() - 0.5) * shake * 40);
    }
    if (scene === 'title') handleTitle(grid, dt, ctx);
    else if (scene === 'intro') handleIntro(grid, dt, ctx);
    else if (scene === 'station') handleStation(grid, dt, ctx);
    else if (scene === 'fail') handleFail(grid, dt, ctx);
    else if (scene === 'templeDone') handleTempleDone(grid, dt, ctx);
    else if (scene === 'gameover') handleEnd(grid, dt, ctx, false);
    else if (scene === 'victory') handleEnd(grid, dt, ctx, true);
    ctx.restore();
    if (flash > 0) {
      flash = Math.max(0, flash - dt);
      ctx.save();
      ctx.globalAlpha = flash * 0.12;
      ctx.fillStyle = pal.gold;
      ctx.fillRect(0, 0, W, H);
      ctx.restore();
    }
  },
  stop() {
    station = null;
    particles = [];
    floaters = [];
    scene = 'title';
  },
};
