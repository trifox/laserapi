/**
 * Nord gegen Süd im Fraktalreich – Echtzeit-Strategie mit Action-Schlachten für den ganzen Saal
 *
 * Erstellt mit Claude Opus 5.5 (claude-opus-5-5).
 *
 * Geschichte: Zwei verfeindete Fraktal-Reiche streiten um die UNENDLICHE KÜSTENLINIE.
 *   MANDELBROTIEN (Nord, linke Saalhälfte) – Apfelmännchen mit Pickelhaube.
 *   JULIANA (Süd, rechte Saalhälfte) – Spiralkringel mit Strohhut.
 * Da die Küstenlinie unendlich lang ist, dauert der Krieg theoretisch unendlich. Praktisch 8 Minuten.
 *
 * Regeln:
 * - Teams: Laser sind nicht unterscheidbar. Ein Team ist NUR über die Bildschirmhälfte definiert: links Nord,
 *   rechts Süd (Trennlinie MID). Erträge von Ereignissen (Eisenbahn) gehen an die Hälfte, auf der sie passieren.
 * - KARTE (Echtzeit, keine Runden): 6×4 Provinzen. Jede Armee ist ein dunkler Kreis (gui/dragHandle):
 *   anleuchten bis der Ring voll ist = greifen, auf eine NACHBAR-Provinz ziehen und loslassen = marschieren.
 *   Leere Feind-Provinz betreten = erobert. Eigene Armeen in einer Provinz verschmelzen (Stärke addiert).
 * - SCHLACHT: Betritt eine Armee eine Provinz mit Feind-Armee, startet eine Action-Schlacht (je nach Gelände):
 *   Feldschlacht (Feld), Fort-Sturm (Hauptstadt/Fort), Zugüberfall (Bahnlinie), Brückensprengung (Fluss).
 *   Beide Saalhälften spielen gleichzeitig auf ihrer Seite. Der Verlierer verliert die Armee (oder wird
 *   geschwächt und zieht sich zurück), die Provinz geht an den Sieger.
 * - ITERATIONS-GOLD: Minen und Hauptstädte liefern „Iterationen“ („JIPII, NEUE ITERATION!“). Alle
 *   DIFFICULTY.armyCost Iterationen erscheint eine neue Armee in der Hauptstadt.
 * - EREIGNISSE: Die Iterations-Eisenbahn fährt über die Karte – anleuchten bis voll = Beute für die Hälfte,
 *   auf der der Zug gerade ist. Der Konvergenz-Sturm friert eine Provinz ein (keine Bewegung, keine Mine).
 * - SIEG: alle Provinzen – oder nach Ablauf der Zeit die meisten Provinzen. Gleichstand = beide doof.
 *
 * Interferenz (laser-chris: „sollen wir sie embracen?“) – hier JA:
 *   Jede Armee kann von JEDEM gegriffen werden. Wer Laser übrig hat, kann gegnerische Armeen in schlechte
 *   Provinzen zerren oder in den Sturm schieben. Bremse: Armeen auf der fremden Bildschirmhälfte lassen sich
 *   nur halb so schnell greifen (SETTINGS.enemyGrabFactor) – Sabotage kostet also viele Laser.
 *   Offene Frage: Ein Fair-Play-Modus (nur eigene Hälfte) wäre über die Greifgeschwindigkeit 0 machbar.
 *
 * One-Pixel-Netzwerk: Greifen ist Flächenanteil am Armee-Kreis, Ziehen folgt dem Schwerpunkt – ein Netz-Pixel
 * trägt seinen Anteil bei. Die Team-Zuordnung käme serverseitig aus der Bildschirmhälfte des Pixels.
 *
 * Licht-Disziplin: Armeen und Knöpfe sind schwarz hinterlegt und nur konturiert, Provinzen nur sehr dunkel
 * getönt, Fraktal-Texturen vorgerendert und stark gedimmt. Farben nur Hue 0.25 … 0.75 der Laserfarbe.
 *
 * Tastatur (Test ohne Laser):
 *   Leertaste  Start / Karten weiterklicken      P        Schlacht-Test (im Titel)
 *   Q          nächste Armee auswählen           Pfeile   ausgewählte Armee marschieren lassen
 *   E          Ereignis auslösen                 B        laufende Schlacht: Angreifer gewinnt
 *   Escape     Karte → Hauptmenü                 J        Schlacht-Test: Schwierigkeit
 *   1–4        Schlacht-Test: Schlacht starten   K / L    in Schlachten: Helfer Nord / Süd
 *   (d v g r m h t f F s, PageUp/PageDown/Home sind Debug-Tasten in view.js und hier bewusst frei)
 *
 * Klassiker: North & South (Infogrames, Amiga/ST 1989) – Strategiekarte, Iterations-Gold statt Gold,
 * Eisenbahn, Action-Schlachten. Anders hier: Echtzeit für zwei Saalhälften, alles Fraktale, keine Geschichte
 * echter Kriege, nur infantile Witze.
 * Ähnlichkeiten im Bestand: game-011-basefight (zwei Seiten), game-026-tauziehen (links gegen rechts),
 * game-047-wuerfelreiche und game-060-domination (Gebiete erobern).
 *
 * Aufbau der Datei: Kern (Zustand, Karte, Szenen) – an der Marke „@@BATTLES@@“ stehen die 4 Schlachten.
 *
 * Offene Anmerkungen (Review Claude Fable 5.2, bewusst noch nicht umgesetzt):
 * - Brückensprengung eher verteidigerfreundlich (jeder kann das Fass greifen) → Idee: Fass sperren, solange
 *   die Lunte brennt; Kanone/Pioniere wirken auf der Brückenmitte schwach.
 * - Partie kann mit vielen Schlachten > 20 min dauern (Uhr pausiert in Schlachten) → Schlachten kürzen oder
 *   Uhr anteilig weiterlaufen lassen.
 * - Witz-Floater bei jedem Minen-Tick bringen viel Licht aufs Spielfeld → seltener/kleiner.
 * - Neue Armeen gehen verloren, wenn der Hauptstadt-Stapel schon Stärke 9 hat (spawnArmy).
 */

/**
 * laser-chris:
 * 
 * lol noch nicht ganz reviewed, topic nord sued auch wieder fraglich ob eher fraktalich sein sollte!
 * 
 * */
import util, { getRgbSpreadHex } from '../util.js';
import { createKeyEdge, isKeyDown as gsIsKeyDown } from './gui/gridScan.js';
import sndShot from '../../../public/media/flash-253597_4508519-lq.mp3';
import sndHit from '../../../public/media/155235__zangrutz__bomb-small (1).mp3';
import sndPlop from '../../../public/media/369952__mischy__plop-1.wav';
import sndError from '../../../public/media/opengameart/Menu Error.ogg';
import sndWin from '../../../public/media/opengameart/Level Up.ogg';
import sndBoom from '../../../public/media/414346__bykgames__explosion-far.wav';
import sndPickup from '../../../public/media/opengameart/Item Pickup.ogg';
import sndClick from '../../../public/media/opengameart/Menu Move.ogg';
import sndSplash from '../../../public/media/485066__javierserrat__object-falls-into-the-water.wav';
import sndSonar from '../../../public/media/70299__kizilsungur__sonar.wav';
import sndTransition from '../../../public/media/opengameart/Transition.ogg';
import sndGameOver from '../../../public/media/opengameart/Music Box Game Over III.wav';
import sndVictory from '../../../public/media/opengameart/Ability Learn.ogg';
import sndStep from '../../../public/media/opengameart/Menu Confirm.ogg';
var laserConfig = require('../LaserApiConfig.js').default;
var MasterCanvas = require('../MasterCanvas').default;
var createHighscore = require('../util/highscore').default;

// GUI-Bausteine (auch für die Schlachten)
var guiFillButton = require('./gui/fillButton-ai2').default;
var guiPixelFillButton = require('./gui/pixelFillButton').default;
var guiFollowCircle = require('./gui/followCircle-ai2').default;
var guiDragHandle = require('./gui/dragHandle').default;
var guiAimTurret = require('./gui/aimTurret').default;
var guiPaintLayer = require('./gui/paintLayer').default;
var guiSteerStrip = require('./gui/steerStrip').default;
var guiSwipeDetector = require('./gui/swipeDetector').default;
var guiBlobTracker = require('./gui/blobTracker').default;
var guiRegionButton = require('./gui/regionButton').default;
var guiVoteGroup = require('./gui/voteGroup').default;
var guiCalmMeter = require('./gui/calmMeter').default;
var guiRangeSlider = require('./gui/rangeSlider-ai2').default;

const W = 1920;
const H = 1080;
const TOP = 90; // HUD-Streifen oben, Spielfläche ist TOP..H
const MID = 960; // Trennlinie: links Nord, rechts Süd

// ---------------------------------------------------------------------------------------------------------
// Einstellungen
// ---------------------------------------------------------------------------------------------------------

const SETTINGS = {
  cols: 6,
  rows: 4,
  timeLimit: 8 * 60, // s
  armyRadius: 50,
  enemyGrabFactor: 0.5, // Greifen auf der fremden Bildschirmhälfte nur halb so schnell
  marchSpeed: 420, // px/s
  introDuration: 2.5,
  resultDuration: 3.5,
  maxParticles: 400,
  maxFloaters: 24,
  maxStrength: 9,
  stormDuration: 15,
  eventIntervalMin: 40,
  eventIntervalMax: 60,
  trainSpeed: 170,
};

const DIFFICULTY = {
  startStrength: 3,
  newArmyStrength: 2,
  armyCost: 10, // Iterationen pro neuer Armee
  mineInterval: 6, // s pro Iteration und Mine
  capitalInterval: 9,
  trainLoot: 8,
  // Schlacht-Level: steigt mit der Spielzeit (0 → 1 → 2)
  levelTimes: [0, 150, 300],
};

const SCORE = { province: 500, battle: 300 };

const BATTLE_NAMES = ['Feldschlacht', 'Fort-Sturm', 'Zugüberfall', 'Brückensprengung'];
const BATTLE_KEYS = ['Digit1', 'Digit2', 'Digit3', 'Digit4'];
const TERRAIN_BATTLE = { feld: 0, fort: 1, bahn: 2, fluss: 3 };

// ---------------------------------------------------------------------------------------------------------
// Witze (sehr infantil, mit voller Absicht)
// ---------------------------------------------------------------------------------------------------------

const JOKES_INTRO = [
  'Warum ist Mandelbrotien sauer? Weil Juliana immer sagt: „Du bist ja nur ein Sonderfall von mir!“',
  'Die Küstenlinie ist unendlich lang. Deshalb dauert der Krieg auch unendlich. Bitte Snacks bereithalten.',
  'Was sagt ein Apfelmännchen zum anderen? „Du hast da was am Rand. Und am Rand vom Rand. Und am Rand vom …“',
  'Der Nord-General hat gepupst. Die Wolke ist selbstähnlich. Alle fliehen. Auch die Wolke.',
  'Wie viele Juliana-Soldaten braucht man für eine Glühbirne? Unendlich viele, aber jeder dreht nur ein bisschen.',
  'Mandelbrotien hat die Grenze vermessen: mit dem Lineal 5 km, mit der Lupe 50 km, mit dem Mikroskop: Mittagspause.',
  'Juliana-Spione erkennt man sofort: Sie gehen immer im Kreis. Und dann im kleineren Kreis. Und dann …',
  'Warum spielen Fraktale nie Verstecken? Weil man sie in jedem Zoom wiederfindet.',
  'Die Apfelmännchen essen zum Frühstück Apfelmännchen. Die sind aber kleiner. Und dann noch kleiner. Bäh.',
  'Kriegsgrund Nr. 1: Juliana hat gesagt, Mandelbrotien sei „nicht zusammenhängend“. Riesen-Skandal.',
  'Kriegsgrund Nr. 2: Mandelbrotien hat Julianas Strohhut iteriert. Jetzt hat er 4000 Krempen.',
  'Was macht ein Fraktal im Urlaub? Es fährt an die Küste. Kommt aber nie an. Die ist ja unendlich.',
  'Achtung: Wer zu lange auf die Karte guckt, wird selbstähnlich. Erste Anzeichen: Man sagt alles zweimal. Alles zweimal.',
  'Der Süd-Kaiser trägt einen Strohhut, weil seine Haare divergieren.',
  'Die Nord-Pickelhaube hat einen Spitz. Und auf dem Spitz einen Spitz. Und … Autsch.',
  'Was ist braun und selbstähnlich? Ein Pups-Fraktal. Nächste Frage.',
  'Mandelbrotien und Juliana sind eigentlich verwandt. Aber über Mathe redet man an Weihnachten nicht.',
  'z = z² + c. Auf Deutsch: „Wir machen das jetzt so lange, bis einer weint.“',
];

const JOKES_LOADING = [
  'Berechne Apfelmännchen …',
  'Apfelmännchen hat Hunger …',
  'Apfelmännchen isst Julia-Keks …',
  'Julia-Keks iteriert im Bauch …',
  'Bauch divergiert …',
  'Pickelhauben werden geschärft …',
  'Strohhüte werden selbstähnlich gefaltet …',
  'Kanonenkugeln werden auf unendlich viele Nachkommastellen gerundet …',
  'Generäle zählen bis Unendlich (gleich fertig) …',
  'Soldaten üben „Rechts um, und um, und um …“',
  'Fülle Pulverfass mit Konfetti … äh, Pulver.',
  'Pferde werden quadriert …',
];

const JOKES_ITERATION = [
  'JIPII, NEUE ITERATION!',
  'JIPII, NEUE ITERATION!',
  'ITERATION! Wie Gold, nur runder!',
  'JIPII! z² + c = Geld!',
  'NOCH EINE ITERATION! Reich!',
  'Iteration gefunden! Nicht divergieren!',
];

const JOKES_EVENTS = [
  'Die Iterations-Eisenbahn! Tut tut, z² + c!',
  'Konvergenz-Sturm! Alles bleibt stehen und guckt komisch.',
  'Ein General ist in eine Rekursion gefallen. Er ist bald wieder da. Und wieder. Und wieder.',
];

const JOKES_END_NORD = [
  'NORD HAT GEWONNEN! Juliana divergiert jetzt ins Unendliche und weint in komplexen Zahlen.',
  'MANDELBROTIEN SIEGT! Die Apfelmännchen machen eine Polonaise. Sie ist natürlich selbstähnlich.',
  'Nord gewinnt! Der Süd-Kaiser isst vor Wut seinen eigenen Strohhut. Mit allen 4000 Krempen.',
  'Sieg für die Pickelhauben! Juliana sagt: „War eh nur ein Sonderfall.“ Keiner glaubt ihr.',
  'NORD! Die Apfelmännchen feiern mit Apfelkuchen, auf dem kleine Apfelmännchen sind, die Apfelkuchen essen …',
];

const JOKES_END_SUED = [
  'SÜD HAT GEWONNEN! Mandelbrotien zieht sich in die Hauptkardioide zurück und schmollt.',
  'JULIANA SIEGT! Die Spiralkringel drehen sich vor Freude so schnell, dass ihnen schwindelig wird. Bäh, Kotz-Spirale.',
  'Süd gewinnt! Die Nord-Pickelhaube wird ab sofort als Zahnstocher verwendet.',
  'Sieg für die Strohhüte! Mandelbrotien rechnet nach. Und nach. Und nach. Ergebnis: immer noch verloren.',
  'SÜD! Der Nord-General ruft „Das war nur Iteration 1!“ – und pupst vor Schreck selbstähnlich.',
];

const JOKES_END_DRAW = [
  'UNENTSCHIEDEN! Beide sind gleich selbstähnlich doof.',
  'Gleichstand! Die Küstenlinie ist immer noch unendlich. Morgen geht’s weiter. Und übermorgen. Und …',
  'Unentschieden! Die Generäle umarmen sich. Es entsteht ein neues Fraktal: der Kuschel-Kringel.',
];

function pick(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

// ---------------------------------------------------------------------------------------------------------
// Farben (nur Komplementärbereich der Laserfarbe, Hue 0.25 … 0.75)
// ---------------------------------------------------------------------------------------------------------

function col(hue, sat, val) {
  return getRgbSpreadHex(laserConfig.testColor, hue, sat, val);
}

var PAL = {};
var palKey = '';
function ensurePalette() {
  const key = laserConfig.testColor.join(',');
  if (key === palKey) return;
  palKey = key;
  PAL.text = col(0.5, 0.12, 0.96);
  PAL.dim = col(0.5, 0.25, 0.55);
  PAL.accent = col(0.45, 0.7, 1);
  PAL.good = col(0.4, 0.75, 1);
  PAL.bad = col(0.6, 0.85, 1);
  PAL.warn = col(0.27, 0.9, 1);
  PAL.enemy = col(0.7, 0.7, 0.95);
  PAL.friend = col(0.32, 0.6, 1);
  PAL.water = col(0.55, 0.7, 0.75);
  PAL.jungle = col(0.38, 0.7, 0.55);
  PAL.ground = col(0.33, 0.45, 0.45);
  PAL.glow = col(0.47, 0.5, 1);
  PAL.dark = col(0.5, 0.4, 0.06);
  PAL.pad = col(0.47, 0.5, 0.85);
  PAL.padGrow = col(0.5, 0.65, 1);
  PAL.padActive = col(0.45, 0.8, 1);
  // Teams
  PAL.nord = col(0.3, 0.75, 1);
  PAL.sued = col(0.7, 0.7, 1);
  PAL.nordDim = col(0.3, 0.7, 0.3);
  PAL.suedDim = col(0.7, 0.65, 0.3);
  PAL.nordDark = col(0.3, 0.7, 0.1);
  PAL.suedDark = col(0.7, 0.65, 0.1);
  PAL.gold = col(0.27, 0.6, 1);
  PAL.storm = col(0.55, 0.3, 0.8);
  mapCanvas = null;
  titleCanvas = null;
}

// ---------------------------------------------------------------------------------------------------------
// Kleine Helfer (auch für die Schlachten)
// ---------------------------------------------------------------------------------------------------------

var keyEdgeInternal = createKeyEdge();
function keyEdge(code) {
  return keyEdgeInternal(code);
}
function isKeyDown(code) {
  return gsIsKeyDown(code);
}
function clamp(v, a, b) {
  return Math.max(a, Math.min(b, v));
}
function lerp(a, b, t) {
  return a + (b - a) * t;
}

const SND = {
  shot: sndShot,
  hit: sndHit,
  plop: sndPlop,
  error: sndError,
  win: sndWin,
  boom: sndBoom,
  pickup: sndPickup,
  click: sndClick,
  splash: sndSplash,
  sonar: sndSonar,
};

function playSound(src, volume) {
  try {
    const a = new Audio(src);
    a.volume = volume === undefined ? 0.5 : volume;
    const p = a.play();
    if (p && p.catch) p.catch(() => {});
  } catch (e) {
    // Ton ist optional
  }
}

var particles = [];
var floaters = [];
var shake = 0;

function burst(x, y, color, count, speed) {
  const n = Math.min(count || 12, SETTINGS.maxParticles - particles.length);
  const sp = speed || 250;
  for (let i = 0; i < n; i++) {
    const a = Math.random() * Math.PI * 2;
    const v = sp * (0.3 + Math.random() * 0.7);
    particles.push({ x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v, life: 0.5 + Math.random() * 0.6, color, size: 2 + Math.random() * 4 });
  }
}

function addFloater(x, y, text, color) {
  if (floaters.length >= SETTINGS.maxFloaters) floaters.shift();
  // nicht über den Bildrand hinaus (Texte sind zentriert und bis ~600 px breit)
  floaters.push({ x: clamp(x, 320, W - 320), y, text, color: color || PAL.text, life: 1.6 });
}

function addShake(amount) {
  shake = Math.min(30, shake + (amount || 8));
}

function updateEffects(dt, ctx) {
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  // rückwärts + swap-remove: keine Kopie, kein indexOf pro Partikel
  for (let i = particles.length - 1; i >= 0; i--) {
    const p = particles[i];
    p.life -= dt;
    if (p.life <= 0) {
      particles[i] = particles[particles.length - 1];
      particles.pop();
      continue;
    }
    p.x += p.vx * dt;
    p.y += p.vy * dt;
    p.vx *= Math.exp(-2 * dt);
    p.vy = p.vy * Math.exp(-2 * dt) + 120 * dt;
    ctx.globalAlpha = clamp(p.life / 0.6, 0, 1);
    ctx.fillStyle = p.color;
    ctx.fillRect(p.x - p.size / 2, p.y - p.size / 2, p.size, p.size);
  }
  ctx.restore();
  for (let i = floaters.length - 1; i >= 0; i--) {
    const f = floaters[i];
    f.life -= dt;
    if (f.life <= 0) {
      floaters.splice(i, 1);
      continue;
    }
    f.y -= 45 * dt;
    ctx.save();
    ctx.globalAlpha = clamp(f.life, 0, 1);
    util.renderText({ ctx, text: f.text, x: f.x, y: f.y, fontSize: '38px', fillStyle: f.color });
    ctx.restore();
  }
}

function makeCanvas(w, h) {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  return c;
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

function fmtClock(s) {
  const t = Math.max(0, Math.ceil(s));
  const m = Math.floor(t / 60);
  const r = t % 60;
  return m + ':' + (r < 10 ? '0' : '') + r;
}

// Dunkles Pad: schwarze Scheibe unter einem Laser-Feld (Licht-Disziplin)
function darkDisk(ctx, x, y, r) {
  ctx.save();
  ctx.fillStyle = '#000000';
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

// Standard-Knopf (Menüs): schwarz hinterlegt, konturiert, OHNE keyCode (sonst ignoriert er die Laser)
function makeButton(label, x, y, r, onEnter, edges) {
  ensurePalette();
  return guiFillButton({
    label,
    posX: x,
    posY: y,
    radius: r,
    edges: edges || 6,
    speedUp: 55,
    speedDown: 25,
    activeValue: 85,
    lineWidth: 4,
    normalColor: PAL.pad,
    growColor: PAL.padGrow,
    activeColor: PAL.padActive,
    onEnterActive: onEnter,
  });
}

// ---------------------------------------------------------------------------------------------------------
// Figuren: Apfelmännchen mit Pickelhaube (Nord), Spiralkringel mit Strohhut (Süd)
// ---------------------------------------------------------------------------------------------------------

function drawAppleMan(ctx, x, y, s, color) {
  ctx.save();
  ctx.translate(x, y);
  ctx.strokeStyle = color;
  ctx.lineWidth = Math.max(2, s * 0.08);
  // Hauptkardioide (Körper)
  ctx.beginPath();
  for (let i = 0; i <= 40; i++) {
    const t = (i / 40) * Math.PI * 2;
    const r = s * 0.5 * (1 - Math.cos(t));
    const px = -r * Math.cos(t) + s * 0.25;
    const py = -r * Math.sin(t);
    if (i === 0) ctx.moveTo(py * 0.9, px + s * 0.1);
    else ctx.lineTo(py * 0.9, px + s * 0.1);
  }
  ctx.closePath();
  ctx.stroke();
  // Kopf-Kreis
  ctx.beginPath();
  ctx.arc(0, -s * 0.55, s * 0.28, 0, Math.PI * 2);
  ctx.stroke();
  // Pickelhaube
  ctx.beginPath();
  ctx.moveTo(-s * 0.26, -s * 0.66);
  ctx.quadraticCurveTo(0, -s * 0.95, s * 0.26, -s * 0.66);
  ctx.moveTo(0, -s * 0.86);
  ctx.lineTo(0, -s * 1.15);
  ctx.stroke();
  // Augen
  ctx.fillStyle = color;
  ctx.fillRect(-s * 0.12, -s * 0.58, s * 0.06, s * 0.06);
  ctx.fillRect(s * 0.06, -s * 0.58, s * 0.06, s * 0.06);
  ctx.restore();
}

function drawSpiralCurl(ctx, x, y, s, color, spin) {
  ctx.save();
  ctx.translate(x, y);
  ctx.strokeStyle = color;
  ctx.lineWidth = Math.max(2, s * 0.08);
  // Körper: Spirale
  ctx.beginPath();
  for (let i = 0; i <= 60; i++) {
    const t = (i / 60) * Math.PI * 5 + (spin || 0);
    const r = (i / 60) * s * 0.55;
    const px = Math.cos(t) * r;
    const py = Math.sin(t) * r + s * 0.15;
    if (i === 0) ctx.moveTo(px, py);
    else ctx.lineTo(px, py);
  }
  ctx.stroke();
  // Kopf
  ctx.beginPath();
  ctx.arc(0, -s * 0.55, s * 0.24, 0, Math.PI * 2);
  ctx.stroke();
  // Strohhut: breite Krempe + Kuppel
  ctx.beginPath();
  ctx.ellipse(0, -s * 0.74, s * 0.52, s * 0.1, 0, 0, Math.PI * 2);
  ctx.moveTo(-s * 0.22, -s * 0.76);
  ctx.quadraticCurveTo(0, -s * 1.05, s * 0.22, -s * 0.76);
  ctx.stroke();
  ctx.fillStyle = color;
  ctx.fillRect(-s * 0.1, -s * 0.58, s * 0.05, s * 0.05);
  ctx.fillRect(s * 0.05, -s * 0.58, s * 0.05, s * 0.05);
  ctx.restore();
}

function drawTeamFigure(ctx, team, x, y, s, color) {
  if (team === 'N') drawAppleMan(ctx, x, y, s, color || PAL.nord);
  else drawSpiralCurl(ctx, x, y, s, color || PAL.sued, clock * 0.5);
}

// ---------------------------------------------------------------------------------------------------------
// Fraktale vorrendern (Mandelbrot links, Julia rechts – stark gedimmt)
// ---------------------------------------------------------------------------------------------------------

function fracIter(zr, zi, cr, ci, maxIter) {
  let i = 0;
  while (zr * zr + zi * zi <= 4 && i < maxIter) {
    const t = zr * zr - zi * zi + cr;
    zi = 2 * zr * zi + ci;
    zr = t;
    i++;
  }
  return i;
}

// Höhenlinien eines Fraktals: mode 'mandel' (c = Pixel) oder 'julia' (c = seed); Ausschnitt cx, cy, scale
function renderFractal(w, h, mode, cx, cy, scale, seedR, seedI, color, alpha) {
  const lw = Math.floor(w / 4);
  const lh = Math.floor(h / 4);
  const it = new Uint8Array(lw * lh);
  for (let y = 0; y < lh; y++) {
    for (let x = 0; x < lw; x++) {
      const pr = cx + ((x - lw / 2) / lw) * scale;
      const pi = cy + ((y - lh / 2) / lw) * scale;
      it[x + y * lw] = mode === 'mandel' ? fracIter(0, 0, pr, pi, 48) : fracIter(pr, pi, seedR, seedI, 48);
    }
  }
  const small = makeCanvas(lw, lh);
  const sctx = small.getContext('2d');
  const img = sctx.createImageData(lw, lh);
  const n = parseInt(color.slice(1, 7), 16);
  for (let y = 0; y < lh - 1; y++) {
    for (let x = 0; x < lw - 1; x++) {
      const a = it[x + y * lw];
      const band = Math.floor(a / 3);
      const edge = band !== Math.floor(it[x + 1 + y * lw] / 3) || band !== Math.floor(it[x + (y + 1) * lw] / 3);
      if (!edge) continue;
      const k = (x + y * lw) * 4;
      img.data[k] = (n >> 16) & 255;
      img.data[k + 1] = (n >> 8) & 255;
      img.data[k + 2] = n & 255;
      img.data[k + 3] = a >= 47 ? alpha * 0.5 : alpha;
    }
  }
  sctx.putImageData(img, 0, 0);
  const c = makeCanvas(w, h);
  const ctx = c.getContext('2d');
  ctx.imageSmoothingEnabled = true;
  ctx.drawImage(small, 0, 0, w, h);
  return c;
}

// ---------------------------------------------------------------------------------------------------------
// Zustand (vorbelegt, damit handle() auch ohne init() läuft)
// ---------------------------------------------------------------------------------------------------------

var scene = 'title'; // title | test | map | intro | battle | result | end
var sceneTime = 0;
var clock = 0;
var playTime = 0;
var provinces = []; // provinces[c][r] = { c, r, owner, terrain, mine, capital, storm, mineTimer }
var armies = []; // { id, team, strength, c, r, x, y, tx, ty, moving, handle, prevValue }
var nextArmyId = 1;
var iter = { N: 0, S: 0 }; // aktuelle Iterationen (Kasse)
var STATS = { earnedN: 0, earnedS: 0, battlesN: 0, battlesS: 0, battles: 0, captures: 0, trains: 0, storms: 0 };
var train = null; // { x, y, dir, button, done }
var eventTimer = SETTINGS.eventIntervalMin;
var selectedArmy = 0;
var selShow = 0; // s, solange die Tastatur-Auswahl sichtbar ist
var current = null; // laufende Schlacht { index, game, title, attacker, defender, prov, testMode, joke }
var lastResult = null; // { title, winner, lines[] }
var endInfo = null; // { winner: 'N'|'S'|'D', joke, score }
var newHighscore = false;
var testDifficulty = 0;
var testLastText = '';
var buttons = {};
var mapCanvas = null;
var titleCanvas = null;
var jokeIndex = 0;
var highscore = createHighscore('Fraktalreich', 'punkte');

function setScene(s) {
  scene = s;
  sceneTime = 0;
  buttons = {};
}

function teamName(t) {
  return t === 'N' ? 'Mandelbrotien' : 'Juliana';
}
function teamColor(t) {
  return t === 'N' ? PAL.nord : PAL.sued;
}
function other(t) {
  return t === 'N' ? 'S' : 'N';
}

// ---------------------------------------------------------------------------------------------------------
// Karte
// ---------------------------------------------------------------------------------------------------------

const MAP = { x0: 40, y0: TOP + 20, x1: W - 40, y1: H - 20 };
function cellW() {
  return (MAP.x1 - MAP.x0) / SETTINGS.cols;
}
function cellH() {
  return (MAP.y1 - MAP.y0) / SETTINGS.rows;
}
function cellCenter(c, r) {
  return { x: MAP.x0 + (c + 0.5) * cellW(), y: MAP.y0 + (r + 0.5) * cellH() };
}
function provinceAt(x, y) {
  const c = Math.floor((x - MAP.x0) / cellW());
  const r = Math.floor((y - MAP.y0) / cellH());
  if (c < 0 || r < 0 || c >= SETTINGS.cols || r >= SETTINGS.rows) return null;
  return provinces[c][r];
}
function railY() {
  return MAP.y0 + 2 * cellH(); // Bahnlinie zwischen Reihe 1 und 2
}

// Gelände: Hauptstädte = Fort, einige Forts, Fluss-Provinzen in der Mitte, Bahn-Provinzen an der Strecke
const TERRAIN_MAP = {
  '0,1': 'fort',
  '5,2': 'fort',
  '1,3': 'fort',
  '4,0': 'fort',
  '2,1': 'fluss',
  '3,2': 'fluss',
  '2,3': 'fluss',
  '3,0': 'fluss',
  '1,1': 'bahn',
  '4,2': 'bahn',
  '2,2': 'bahn',
  '3,1': 'bahn',
};
const MINES = ['1,0', '2,3', '3,3', '4,3', '2,0', '3,0'];
const CAPITAL = { N: { c: 0, r: 1 }, S: { c: 5, r: 2 } };

function buildMap() {
  provinces = [];
  for (let c = 0; c < SETTINGS.cols; c++) {
    provinces.push([]);
    for (let r = 0; r < SETTINGS.rows; r++) {
      const key = c + ',' + r;
      provinces[c].push({
        c,
        r,
        owner: c < SETTINGS.cols / 2 ? 'N' : 'S',
        terrain: TERRAIN_MAP[key] || 'feld',
        mine: MINES.indexOf(key) >= 0,
        capital: (c === CAPITAL.N.c && r === CAPITAL.N.r) || (c === CAPITAL.S.c && r === CAPITAL.S.r),
        storm: 0,
        mineTimer: Math.random() * DIFFICULTY.mineInterval,
      });
    }
  }
}

function countProvinces(team) {
  let n = 0;
  provinces.forEach((col) => col.forEach((p) => (n += p.owner === team ? 1 : 0)));
  return n;
}

// Karten-Hintergrund: Mandelbrot-Höhenlinien links, Julia-Höhenlinien rechts, einmal vorgerendert
function ensureMapCanvas() {
  if (mapCanvas) return mapCanvas;
  mapCanvas = makeCanvas(W, H);
  const ctx = mapCanvas.getContext('2d');
  ctx.fillStyle = '#000000';
  ctx.fillRect(0, 0, W, H);
  const left = renderFractal(MID, H, 'mandel', -0.6, 0, 3.0, 0, 0, PAL.nordDim, 110);
  const right = renderFractal(MID, H, 'julia', 0, 0, 3.2, -0.8, 0.156, PAL.suedDim, 110);
  ctx.drawImage(left, 0, 0);
  ctx.drawImage(right, MID, 0);
  // Die unendliche Küstenlinie: Koch-artige Zickzack-Linie an der Grenze
  ctx.strokeStyle = PAL.dim;
  ctx.lineWidth = 2;
  ctx.setLineDash([8, 10]);
  ctx.beginPath();
  for (let y = TOP; y <= H; y += 12) {
    const x = MID + Math.sin(y * 0.05) * 14 + Math.sin(y * 0.21) * 6 + Math.sin(y * 0.83) * 3;
    if (y === TOP) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  }
  ctx.stroke();
  ctx.setLineDash([]);
  // Bahnlinie
  const ry = MAP.y0 + 2 * cellH();
  ctx.strokeStyle = PAL.ground;
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(MAP.x0, ry - 6);
  ctx.lineTo(MAP.x1, ry - 6);
  ctx.moveTo(MAP.x0, ry + 6);
  ctx.lineTo(MAP.x1, ry + 6);
  ctx.stroke();
  for (let x = MAP.x0; x < MAP.x1; x += 26) {
    ctx.beginPath();
    ctx.moveTo(x, ry - 10);
    ctx.lineTo(x, ry + 10);
    ctx.stroke();
  }
  return mapCanvas;
}

function drawProvinceIcon(ctx, p, x, y) {
  ctx.save();
  ctx.lineWidth = 3;
  if (p.terrain === 'fort') {
    ctx.strokeStyle = PAL.dim;
    ctx.strokeRect(x - 40, y - 20, 80, 40);
    for (let i = 0; i < 4; i++) ctx.strokeRect(x - 40 + i * 22, y - 32, 14, 12);
  } else if (p.terrain === 'fluss') {
    ctx.strokeStyle = PAL.water;
    ctx.beginPath();
    for (let i = 0; i <= 20; i++) {
      const yy = y - 60 + i * 6;
      const xx = x + Math.sin(i * 0.8 + clock) * 10;
      if (i === 0) ctx.moveTo(xx, yy);
      else ctx.lineTo(xx, yy);
    }
    ctx.stroke();
  } else if (p.terrain === 'bahn') {
    ctx.strokeStyle = PAL.ground;
    ctx.strokeRect(x - 30, y - 14, 60, 28);
    ctx.beginPath();
    ctx.arc(x - 16, y + 18, 8, 0, Math.PI * 2);
    ctx.arc(x + 16, y + 18, 8, 0, Math.PI * 2);
    ctx.stroke();
  }
  if (p.mine) {
    ctx.strokeStyle = PAL.gold;
    ctx.beginPath();
    ctx.arc(x, y, 18, 0, Math.PI * 2);
    ctx.stroke();
    util.renderText({ ctx, text: 'z²+c', x, y: y + 8, fontSize: '18px', fillStyle: PAL.gold });
  }
  ctx.restore();
}

function drawMap(ctx) {
  ctx.drawImage(ensureMapCanvas(), 0, 0);
  const w = cellW();
  const h = cellH();
  provinces.forEach((col) =>
    col.forEach((p) => {
      const x = MAP.x0 + p.c * w;
      const y = MAP.y0 + p.r * h;
      ctx.save();
      // sehr dunkle Tönung (Provinzen sind Spielfläche – wenig Licht)
      ctx.globalAlpha = 0.5;
      ctx.fillStyle = p.owner === 'N' ? PAL.nordDark : PAL.suedDark;
      ctx.fillRect(x + 3, y + 3, w - 6, h - 6);
      ctx.globalAlpha = 1;
      ctx.strokeStyle = p.owner === 'N' ? PAL.nordDim : PAL.suedDim;
      ctx.lineWidth = 3;
      ctx.strokeRect(x + 4, y + 4, w - 8, h - 8);
      ctx.restore();
      // Ecken-Deko: Gelände/Mine in der linken oberen Ecke, damit die Mitte für Armeen frei bleibt
      drawProvinceIcon(ctx, p, x + 70, y + 70);
      if (p.capital) {
        util.renderText({ ctx, text: '★ Hauptstadt', x: x + w - 90, y: y + 34, fontSize: '22px', fillStyle: teamColor(p.owner) });
      }
      if (p.storm > 0) {
        ctx.save();
        ctx.strokeStyle = PAL.storm;
        ctx.lineWidth = 3;
        const cx = x + w / 2;
        const cy = y + h / 2;
        for (let k = 0; k < 3; k++) {
          ctx.beginPath();
          for (let i = 0; i <= 30; i++) {
            const t = (i / 30) * Math.PI * 4 + clock * 3 + k * 2.1;
            const rr = (i / 30) * Math.min(w, h) * 0.45;
            const px = cx + Math.cos(t) * rr;
            const py = cy + Math.sin(t) * rr;
            if (i === 0) ctx.moveTo(px, py);
            else ctx.lineTo(px, py);
          }
          ctx.stroke();
        }
        util.renderText({ ctx, text: 'KONVERGENZ-STURM ' + Math.ceil(p.storm), x: cx, y: y + h - 16, fontSize: '22px', fillStyle: PAL.storm });
        ctx.restore();
      }
    })
  );
}

// ---------------------------------------------------------------------------------------------------------
// Armeen
// ---------------------------------------------------------------------------------------------------------

function armyAt(c, r, team, exclude) {
  return armies.find((a) => a !== exclude && a.c === c && a.r === r && (!team || a.team === team) && !a.moving) || null;
}

function makeArmy(team, c, r, strength) {
  const p = cellCenter(c, r);
  const a = { id: nextArmyId++, team, strength, c, r, x: p.x, y: p.y, tx: p.x, ty: p.y, moving: false, handle: null, prevValue: 0 };
  a.handle = guiDragHandle({
    posX: p.x,
    posY: p.y,
    radius: SETTINGS.armyRadius,
    grabSpeed: 110,
    speedDown: 60,
    fullPercent: 20,
    catchFactor: 1.8,
    dropDelay: 0.5,
    visible: false,
    onGrab: () => playSound(SND.click, 0.3),
    onDrop: () => dropArmy(a),
  });
  armies.push(a);
  return a;
}

function removeArmy(a) {
  const i = armies.indexOf(a);
  if (i >= 0) armies.splice(i, 1);
}

// Armee sammelt sich (oder verschmilzt) in Provinz c,r
function placeOrMerge(team, c, r, strength) {
  const own = armyAt(c, r, team);
  if (own) {
    own.strength = Math.min(SETTINGS.maxStrength, own.strength + strength);
    return own;
  }
  return makeArmy(team, c, r, strength);
}

function dropArmy(a) {
  if (scene !== 'map') {
    // Schlacht hat im selben Frame begonnen / läuft: nicht marschieren, aber sauber zur Provinzmitte zurück
    const home = cellCenter(a.c, a.r);
    a.tx = home.x;
    a.ty = home.y;
    if (!a.moving) a.returning = true;
    return;
  }
  const p = provinceAt(a.handle.getX(), a.handle.getY());
  const from = provinces[a.c][a.r];
  if (p && Math.abs(p.c - a.c) + Math.abs(p.r - a.r) === 1 && from.storm <= 0) {
    marchTo(a, p.c, p.r);
  } else {
    if (p && (p.c !== a.c || p.r !== a.r)) {
      addFloater(a.handle.getX(), a.handle.getY() - 60, 'Zu weit! Fraktale sind unendlich, Beine nicht.', PAL.warn);
      playSound(SND.error, 0.3);
    }
    const back = cellCenter(a.c, a.r);
    a.tx = back.x;
    a.ty = back.y;
    a.moving = false;
    a.returning = true;
  }
}

function marchTo(a, c, r) {
  const t = cellCenter(c, r);
  a.moving = true;
  a.returning = false;
  a.destC = c;
  a.destR = r;
  a.tx = t.x;
  a.ty = t.y;
  playSound(sndStep, 0.3);
}

function arrive(a) {
  if (scene !== 'map') return; // eine andere Schlacht läuft schon – nach der Rückkehr erneut ankommen
  a.moving = false;
  const p = provinces[a.destC][a.destR];
  const enemy = armyAt(p.c, p.r, other(a.team));
  a.c = p.c;
  a.r = p.r;
  if (enemy) {
    startBattle(a, enemy, p);
    return;
  }
  const own = armyAt(p.c, p.r, a.team, a);
  if (own) {
    own.strength = Math.min(SETTINGS.maxStrength, own.strength + a.strength);
    addFloater(own.x, own.y - 70, 'Verschmolzen! Stärke ' + own.strength, teamColor(a.team));
    removeArmy(a);
  }
  if (p.owner !== a.team) {
    p.owner = a.team;
    STATS.captures++;
    const c = cellCenter(p.c, p.r);
    burst(c.x, c.y, teamColor(a.team), 30, 300);
    addFloater(c.x, c.y - 90, 'Erobert! Die Küste ist jetzt ' + (a.team === 'N' ? 'apfeliger' : 'kringeliger') + '.', teamColor(a.team));
    playSound(SND.pickup, 0.4);
    checkEnd();
  }
}

function updateArmies(grid, dt) {
  armies.slice().forEach((a) => {
    const h = a.handle;
    const storm = provinces[a.c][a.r].storm > 0;
    h.setEnabled(!storm && !a.moving);
    if (a.moving || a.returning) {
      const dx = a.tx - a.x;
      const dy = a.ty - a.y;
      const d = Math.hypot(dx, dy);
      const step = SETTINGS.marchSpeed * dt;
      if (d <= step) {
        a.x = a.tx;
        a.y = a.ty;
        a.returning = false;
        if (a.moving) arrive(a);
      } else {
        a.x += (dx / d) * step;
        a.y += (dy / d) * step;
      }
      h.setX(a.x);
      h.setY(a.y);
      h.handle(grid, dt);
      return;
    }
    if (!h.isGrabbed()) {
      h.setX(a.x);
      h.setY(a.y);
    }
    const before = h.getValue();
    h.handle(grid, dt);
    // Sabotage-Bremse: Greifen auf der fremden Bildschirmhälfte nur halb so schnell
    const onEnemyHalf = (a.team === 'N' && a.x > MID) || (a.team === 'S' && a.x < MID);
    if (onEnemyHalf && !h.isGrabbed() && h.getValue() > before) {
      h.setValue(before + (h.getValue() - before) * SETTINGS.enemyGrabFactor);
    }
    if (h.isGrabbed()) {
      a.x = h.getX();
      a.y = h.getY();
    }
  });
}

function drawArmies(ctx) {
  armies.forEach((a, i) => {
    const h = a.handle;
    const r = SETTINGS.armyRadius;
    const color = teamColor(a.team);
    darkDisk(ctx, a.x, a.y, r);
    ctx.save();
    ctx.strokeStyle = color;
    ctx.lineWidth = h.isGrabbed() ? 6 : 3;
    if (h.isGrabbed()) {
      ctx.shadowColor = color;
      ctx.shadowBlur = 16;
    }
    ctx.beginPath();
    ctx.arc(a.x, a.y, r, 0, Math.PI * 2);
    ctx.stroke();
    ctx.shadowBlur = 0;
    // Greif-Ring außen (Füllstand)
    if (!h.isGrabbed() && h.getValue() > 0) {
      ctx.lineWidth = 8;
      ctx.beginPath();
      ctx.arc(a.x, a.y, r + 10, -Math.PI / 2, -Math.PI / 2 + (Math.PI * 2 * h.getValue()) / 100);
      ctx.stroke();
    }
    if (selShow > 0 && i === selectedArmy % Math.max(1, armies.length)) {
      ctx.setLineDash([6, 8]);
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(a.x, a.y, r + 20, 0, Math.PI * 2);
      ctx.stroke();
      ctx.setLineDash([]);
    }
    ctx.restore();
    drawTeamFigure(ctx, a.team, a.x - 12, a.y + 14, 30, color);
    util.renderText({ ctx, text: String(a.strength), x: a.x + 26, y: a.y + 12, fontSize: '32px', fillStyle: color });
  });
}

// ---------------------------------------------------------------------------------------------------------
// Wirtschaft und Ereignisse
// ---------------------------------------------------------------------------------------------------------

function earn(team, amount, x, y) {
  iter[team] += amount;
  if (team === 'N') STATS.earnedN += amount;
  else STATS.earnedS += amount;
  addFloater(x, y, pick(JOKES_ITERATION), PAL.gold);
  burst(x, y, PAL.gold, 10, 160);
  while (iter[team] >= DIFFICULTY.armyCost) {
    iter[team] -= DIFFICULTY.armyCost;
    spawnArmy(team);
  }
}

function spawnArmy(team) {
  const cap = CAPITAL[team];
  let target = provinces[cap.c][cap.r].owner === team ? provinces[cap.c][cap.r] : null;
  if (!target) {
    const owned = [];
    provinces.forEach((col) => col.forEach((p) => p.owner === team && !armyAt(p.c, p.r, other(team)) && owned.push(p)));
    if (!owned.length) return;
    target = owned[Math.floor(Math.random() * owned.length)];
  }
  if (armyAt(target.c, target.r, other(team))) return;
  const a = placeOrMerge(team, target.c, target.r, DIFFICULTY.newArmyStrength);
  addFloater(a.x, a.y - 80, 'Neue Armee! Frisch iteriert!', teamColor(team));
  playSound(SND.win, 0.3);
}

function updateEconomy(dt) {
  provinces.forEach((col) =>
    col.forEach((p) => {
      if (p.storm > 0) {
        p.storm -= dt;
        return;
      }
      if (!p.mine && !p.capital) return;
      p.mineTimer -= dt;
      if (p.mineTimer <= 0) {
        p.mineTimer = p.capital ? DIFFICULTY.capitalInterval : DIFFICULTY.mineInterval;
        const c = cellCenter(p.c, p.r);
        earn(p.owner, 1, c.x - cellW() / 2 + 70, c.y - cellH() / 2 + 40);
      }
    })
  );
}

function spawnEvent() {
  if (!train && Math.random() < 0.55) {
    const dir = Math.random() < 0.5 ? 1 : -1;
    const x = dir > 0 ? MAP.x0 - 200 : MAP.x1 + 200;
    train = {
      x,
      y: railY(),
      dir,
      done: false,
      button: guiPixelFillButton({
        label: '',
        posX: x,
        posY: railY(),
        radius: 70,
        speedUp: 70,
        speedDown: 30,
        fullPercent: 25,
        edges: 4,
        visible: false,
        onEnterActive: () => robTrain(),
      }),
    };
    addFloater(W / 2, TOP + 80, JOKES_EVENTS[0], PAL.gold);
    playSound(SND.sonar, 0.4);
  } else {
    const all = [];
    provinces.forEach((col) => col.forEach((p) => p.storm <= 0 && all.push(p)));
    const p = all[Math.floor(Math.random() * all.length)];
    p.storm = SETTINGS.stormDuration;
    STATS.storms++;
    const c = cellCenter(p.c, p.r);
    addFloater(c.x, c.y - 100, JOKES_EVENTS[1], PAL.storm);
    playSound(SND.splash, 0.4);
  }
}

function robTrain() {
  if (!train || train.done) return;
  train.done = true;
  const team = train.x < MID ? 'N' : 'S';
  STATS.trains++;
  earn(team, DIFFICULTY.trainLoot, train.x, train.y - 90);
  addFloater(train.x, train.y - 140, teamName(team) + ' plündert den Iterations-Zug!', teamColor(team));
  burst(train.x, train.y, PAL.gold, 40, 350);
  addShake(8);
}

function updateEvents(grid, dt) {
  eventTimer -= dt;
  if (eventTimer <= 0 || keyEdge('KeyE')) {
    eventTimer = SETTINGS.eventIntervalMin + Math.random() * (SETTINGS.eventIntervalMax - SETTINGS.eventIntervalMin);
    spawnEvent();
  }
  if (train) {
    train.x += train.dir * SETTINGS.trainSpeed * dt;
    if (!train.done) {
      train.button.setX(train.x);
      train.button.handle(grid, dt);
    }
    if (train.x < MAP.x0 - 300 || train.x > MAP.x1 + 300) train = null;
  }
}

function drawTrain(ctx) {
  if (!train) return;
  ctx.save();
  const dir = train.dir;
  for (let i = 0; i < 4; i++) {
    const x = train.x - dir * i * 120;
    const y = train.y;
    ctx.fillStyle = '#000000';
    ctx.fillRect(x - 55, y - 34, 110, 52);
    ctx.strokeStyle = i === 0 ? PAL.accent : PAL.gold;
    ctx.lineWidth = 3;
    ctx.strokeRect(x - 55, y - 34, 110, 52);
    ctx.beginPath();
    ctx.arc(x - 30, y + 24, 10, 0, Math.PI * 2);
    ctx.arc(x + 30, y + 24, 10, 0, Math.PI * 2);
    ctx.stroke();
    if (i > 0 && !train.done) util.renderText({ ctx, text: 'z²+c', x, y: y + 2, fontSize: '22px', fillStyle: PAL.gold });
  }
  // Dampf: kleine selbstähnliche Wölkchen
  for (let k = 0; k < 4; k++) {
    ctx.globalAlpha = 0.35 - k * 0.07;
    ctx.strokeStyle = PAL.dim;
    ctx.beginPath();
    ctx.arc(train.x + dir * 20 - dir * k * 26, train.y - 60 - k * 18, 10 + k * 5, 0, Math.PI * 2);
    ctx.stroke();
  }
  ctx.globalAlpha = 1;
  if (!train.done) {
    const v = train.button.getValue();
    ctx.strokeStyle = PAL.gold;
    ctx.lineWidth = 8;
    ctx.beginPath();
    ctx.arc(train.x, train.y, 82, -Math.PI / 2, -Math.PI / 2 + (Math.PI * 2 * v) / 100);
    ctx.stroke();
    util.renderText({ ctx, text: 'ZUG ANLEUCHTEN!', x: train.x, y: train.y - 90, fontSize: '26px', fillStyle: PAL.gold });
  }
  ctx.restore();
}

// ---------------------------------------------------------------------------------------------------------
// Schlachten
// ---------------------------------------------------------------------------------------------------------

function battleLevel() {
  let l = 0;
  DIFFICULTY.levelTimes.forEach((t, i) => {
    if (playTime >= t) l = i;
  });
  return l;
}

function createBattle(index, opts) {
  try {
    return BATTLES[index](opts);
  } catch (e) {
    console.error('Schlacht', index, 'konnte nicht starten', e);
    return null;
  }
}

function startBattle(attacker, defender, prov) {
  const index = TERRAIN_BATTLE[prov.terrain];
  const opts = {
    level: battleLevel(),
    attacker: attacker.team,
    strengthN: attacker.team === 'N' ? attacker.strength : defender.strength,
    strengthS: attacker.team === 'S' ? attacker.strength : defender.strength,
    testMode: false,
  };
  const game = createBattle(index, opts);
  current = { index, game, title: BATTLE_NAMES[index], attacker, defender, prov, testMode: false, joke: pick(JOKES_LOADING), attackerTeam: attacker.team };
  if (!game) {
    finishBattle({ winner: attacker.team, lossN: 0, lossS: 0, text: 'Die Schlacht ist ausgefallen (Fehler) – Angreifer gewinnt.' });
    return;
  }
  playSound(SND.boom, 0.4);
  setScene('intro');
}

function startTestBattle(index) {
  const opts = { level: testDifficulty, attacker: Math.random() < 0.5 ? 'N' : 'S', strengthN: 3, strengthS: 3, testMode: true };
  const game = createBattle(index, opts);
  if (!game) {
    testLastText = BATTLE_NAMES[index] + ': Fehler beim Start';
    return;
  }
  current = { index, game, title: BATTLE_NAMES[index], attacker: null, defender: null, prov: null, testMode: true, joke: pick(JOKES_LOADING), attackerTeam: opts.attacker };
  setScene('intro');
}

function finishBattle(result) {
  const cur = current;
  const winner = result.winner === 'S' ? 'S' : 'N';
  const lossN = Math.max(0, Math.round(result.lossN || 0));
  const lossS = Math.max(0, Math.round(result.lossS || 0));
  const lines = [result.text || '', teamName(winner) + ' gewinnt die ' + cur.title + '!'];
  if (cur.testMode) {
    testLastText = cur.title + ': ' + teamName(winner) + ' gewinnt';
  } else {
    STATS.battles++;
    if (winner === 'N') STATS.battlesN++;
    else STATS.battlesS++;
    const winArmy = cur.attacker.team === winner ? cur.attacker : cur.defender;
    const loseArmy = winArmy === cur.attacker ? cur.defender : cur.attacker;
    const winLoss = winner === 'N' ? lossN : lossS;
    const loseLoss = winner === 'N' ? lossS : lossN;
    winArmy.strength = Math.max(1, winArmy.strength - winLoss);
    loseArmy.strength -= Math.max(2, loseLoss);
    const p = cur.prov;
    // Sieger steht in der Provinz
    const c = cellCenter(p.c, p.r);
    winArmy.c = p.c;
    winArmy.r = p.r;
    winArmy.x = c.x;
    winArmy.y = c.y;
    winArmy.moving = false;
    winArmy.returning = false;
    // ein vor der Schlacht gegriffener Sieger würde sonst nach der Rückkehr ungewollt losmarschieren
    if (winArmy.handle.isGrabbed()) winArmy.handle.drop();
    winArmy.handle.setValue(0);
    winArmy.x = c.x;
    winArmy.y = c.y;
    p.owner = winner;
    if (loseArmy.strength <= 0) {
      removeArmy(loseArmy);
      lines.push('Die Armee von ' + teamName(loseArmy.team) + ' ist aufgerieben. Sie divergiert nach Hause.');
    } else {
      // Rückzug in eine freie eigene Nachbarprovinz, sonst aufgerieben
      const dirs = [[1, 0], [-1, 0], [0, 1], [0, -1]];
      let retreat = null;
      dirs.forEach((d) => {
        const nc = p.c + d[0];
        const nr = p.r + d[1];
        if (retreat || nc < 0 || nr < 0 || nc >= SETTINGS.cols || nr >= SETTINGS.rows) return;
        const np = provinces[nc][nr];
        if (np.owner === loseArmy.team && !armyAt(nc, nr, winner)) retreat = np;
      });
      if (retreat) {
        removeArmy(loseArmy);
        const a = placeOrMerge(loseArmy.team, retreat.c, retreat.r, loseArmy.strength);
        lines.push(teamName(loseArmy.team) + ' zieht sich zurück (Stärke ' + a.strength + ').');
      } else {
        removeArmy(loseArmy);
        lines.push(teamName(loseArmy.team) + ' ist eingekesselt und aufgerieben!');
      }
    }
    // Sieger mit eigener Armee in der Provinz verschmelzen
    const twin = armyAt(p.c, p.r, winner, winArmy);
    if (twin) {
      twin.strength = Math.min(SETTINGS.maxStrength, twin.strength + winArmy.strength);
      removeArmy(winArmy);
    }
  }
  lastResult = { title: cur.title, winner, lines };
  playSound(winner === 'N' ? SND.win : SND.win, 0.5);
  setScene('result');
}

function checkEnd() {
  if (current && current.testMode) return;
  const n = countProvinces('N');
  const s = countProvinces('S');
  const total = SETTINGS.cols * SETTINGS.rows;
  let winner = null;
  if (n === total) winner = 'N';
  else if (s === total) winner = 'S';
  else if (playTime >= SETTINGS.timeLimit) winner = n > s ? 'N' : s > n ? 'S' : 'D';
  if (winner) goEnd(winner);
}

function computeScore(team) {
  return (
    countProvinces(team) * SCORE.province +
    (team === 'N' ? STATS.earnedN : STATS.earnedS) +
    (team === 'N' ? STATS.battlesN : STATS.battlesS) * SCORE.battle
  );
}

function goEnd(winner) {
  const team = winner === 'D' ? (computeScore('N') >= computeScore('S') ? 'N' : 'S') : winner;
  const score = computeScore(team);
  highscore.addEntry({
    punkte: score,
    sieger: winner === 'D' ? 0 : winner === 'N' ? 1 : 2,
    provinzen: countProvinces(team),
    schlachten: STATS.battles,
    minuten: playTime / 60,
  });
  newHighscore = highscore.lastEntryNewHighscore();
  endInfo = {
    winner,
    score,
    joke: winner === 'N' ? pick(JOKES_END_NORD) : winner === 'S' ? pick(JOKES_END_SUED) : pick(JOKES_END_DRAW),
  };
  playSound(winner === 'D' ? sndGameOver : sndVictory, 0.6);
  setScene('end');
}

function resetGame() {
  buildMap();
  armies = [];
  nextArmyId = 1;
  makeArmy('N', CAPITAL.N.c, CAPITAL.N.r, DIFFICULTY.startStrength);
  makeArmy('N', 2, 0, DIFFICULTY.startStrength);
  makeArmy('N', 2, 3, DIFFICULTY.startStrength);
  makeArmy('S', CAPITAL.S.c, CAPITAL.S.r, DIFFICULTY.startStrength);
  makeArmy('S', 3, 0, DIFFICULTY.startStrength);
  makeArmy('S', 3, 3, DIFFICULTY.startStrength);
  iter = { N: 0, S: 0 };
  STATS = { earnedN: 0, earnedS: 0, battlesN: 0, battlesS: 0, battles: 0, captures: 0, trains: 0, storms: 0 };
  train = null;
  eventTimer = SETTINGS.eventIntervalMin;
  playTime = 0;
  current = null;
  lastResult = null;
  endInfo = null;
  particles = [];
  floaters = [];
  selectedArmy = 0;
}

function startGame() {
  resetGame();
  playSound(sndTransition, 0.5);
  setScene('map');
}

// Tastatur-Test auf der Karte: Q wählt Armee, Pfeile lassen sie marschieren
function keyboardMap() {
  if (!armies.length) return;
  if (keyEdge('KeyQ')) {
    selectedArmy = (selectedArmy + 1) % armies.length;
    selShow = 3;
  }
  const a = armies[selectedArmy % armies.length];
  if (!a || a.moving || provinces[a.c][a.r].storm > 0) return;
  const d = keyEdge('ArrowLeft') ? [-1, 0] : keyEdge('ArrowRight') ? [1, 0] : keyEdge('ArrowUp') ? [0, -1] : keyEdge('ArrowDown') ? [0, 1] : null;
  if (!d) return;
  selShow = 3;
  const nc = a.c + d[0];
  const nr = a.r + d[1];
  if (nc < 0 || nr < 0 || nc >= SETTINGS.cols || nr >= SETTINGS.rows) return;
  marchTo(a, nc, nr);
}

// ---------------------------------------------------------------------------------------------------------
// HUD und Karten (Zeichnen)
// ---------------------------------------------------------------------------------------------------------

function drawHud(ctx, title) {
  ctx.save();
  ctx.fillStyle = '#000000';
  ctx.fillRect(0, 0, W, TOP);
  ctx.strokeStyle = PAL.dim;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(0, TOP);
  ctx.lineTo(W, TOP);
  ctx.stroke();
  ctx.restore();
  const nA = armies.filter((a) => a.team === 'N').length;
  const sA = armies.filter((a) => a.team === 'S').length;
  drawAppleMan(ctx, 40, 62, 34, PAL.nord);
  util.renderText({
    ctx,
    text: 'MANDELBROTIEN  ' + countProvinces('N') + ' Prov · ' + iter.N + ' It · ' + nA + ' Armeen',
    x: 380,
    y: 56,
    fontSize: '32px',
    fillStyle: PAL.nord,
  });
  drawSpiralCurl(ctx, W - 40, 62, 34, PAL.sued, clock);
  util.renderText({
    ctx,
    text: 'JULIANA  ' + countProvinces('S') + ' Prov · ' + iter.S + ' It · ' + sA + ' Armeen',
    x: W - 380,
    y: 56,
    fontSize: '32px',
    fillStyle: PAL.sued,
  });
  util.renderText({
    ctx,
    text: title || fmtClock(SETTINGS.timeLimit - playTime),
    x: W / 2,
    y: 60,
    fontSize: title ? '40px' : '54px',
    // Endspurt: die letzten 30 s blinkt die Uhr in Warnfarbe
    fillStyle: !title && scene === 'map' && SETTINGS.timeLimit - playTime <= 30 && Math.sin(clock * 8) > 0 ? PAL.warn : PAL.text,
  });
}

function drawCard(ctx, title, lines, color, sub) {
  ctx.save();
  ctx.fillStyle = 'rgba(0,0,0,0.82)';
  ctx.fillRect(160, 220, W - 320, 640);
  ctx.strokeStyle = color;
  ctx.lineWidth = 4;
  ctx.strokeRect(160, 220, W - 320, 640);
  ctx.restore();
  util.renderText({ ctx, text: title, x: W / 2, y: 340, fontSize: '96px', fillStyle: color });
  lines.forEach((l, i) => {
    util.renderText({ ctx, text: l, x: W / 2, y: 450 + i * 62, fontSize: '38px', fillStyle: PAL.text });
  });
  if (sub) util.renderText({ ctx, text: sub, x: W / 2, y: 820, fontSize: '28px', fillStyle: PAL.dim });
}

function drawHighscorePanel(ctx, x, y) {
  const best = highscore.getHighscore();
  util.renderText({
    ctx,
    text: best ? 'Highscore: ' + Math.round(best.punkte) + ' Punkte' : 'Noch kein Highscore – wie damals am C64: Leere Tabelle, volle Hoffnung.',
    x,
    y,
    fontSize: '30px',
    fillStyle: PAL.gold,
  });
}

// ---------------------------------------------------------------------------------------------------------
// Szenen
// ---------------------------------------------------------------------------------------------------------

function ensureTitleCanvas() {
  if (titleCanvas) return titleCanvas;
  titleCanvas = makeCanvas(W, H);
  const ctx = titleCanvas.getContext('2d');
  ctx.fillStyle = '#000000';
  ctx.fillRect(0, 0, W, H);
  ctx.drawImage(renderFractal(MID, H, 'mandel', -0.75, 0, 2.6, 0, 0, PAL.nordDim, 150), 0, 0);
  ctx.drawImage(renderFractal(MID, H, 'julia', 0, 0, 3.0, 0.285, 0.01, PAL.suedDim, 150), MID, 0);
  return titleCanvas;
}

function drawJokeTicker(ctx, y) {
  // Witz-Laufband: alle 7 s ein neuer Witz, sanft eingeblendet
  const period = 7;
  const i = Math.floor(clock / period) % JOKES_INTRO.length;
  const t = (clock % period) / period;
  ctx.save();
  ctx.globalAlpha = clamp(Math.min(t * 6, (1 - t) * 6), 0, 1);
  util.renderText({ ctx, text: JOKES_INTRO[(i + jokeIndex) % JOKES_INTRO.length], x: W / 2, y, fontSize: '32px', fillStyle: PAL.text });
  ctx.restore();
}

function handleTitle(grid, dt, ctx) {
  const bg = ensureTitleCanvas();
  ctx.drawImage(bg, Math.sin(clock * 0.1) * 20 - 20, 0, W + 40, H);
  // Figuren marschieren aufeinander zu
  for (let i = 0; i < 4; i++) {
    const p = (clock * 0.08 + i * 0.25) % 1;
    drawAppleMan(ctx, 80 + p * 700, 900 - i * 20, 46, PAL.nord);
    drawSpiralCurl(ctx, W - 80 - p * 700, 900 - i * 20, 46, PAL.sued, clock * 2);
  }
  util.renderText({ ctx, text: 'NORD gegen SÜD', x: W / 2, y: 210, fontSize: '150px', fillStyle: PAL.accent });
  util.renderText({ ctx, text: 'im Fraktalreich', x: W / 2, y: 290, fontSize: '60px', fillStyle: PAL.gold });
  util.renderText({
    ctx,
    text: 'Linke Saalhälfte = MANDELBROTIEN (Apfelmännchen)   ·   Rechte Saalhälfte = JULIANA (Spiralkringel)',
    x: W / 2,
    y: 360,
    fontSize: '32px',
    fillStyle: PAL.text,
  });
  drawJokeTicker(ctx, 430);
  if (!buttons.start) {
    buttons.start = makeButton('START', 760, 640, 140, () => startGame(), 8);
    buttons.test = makeButton('TEST', 1180, 640, 100, () => setScene('test'), 6);
  }
  // lokale Referenz: ein Knopf kann die Szene wechseln (setScene leert buttons)
  const bs = buttons;
  darkDisk(ctx, 760, 640, 150);
  darkDisk(ctx, 1180, 640, 110);
  bs.start.handle(grid, dt);
  bs.test.handle(grid, dt);
  util.renderText({ ctx, text: 'SCHLACHT-TEST (P)', x: 1180, y: 780, fontSize: '26px', fillStyle: PAL.dim });
  util.renderText({ ctx, text: 'Leertaste = Start', x: 760, y: 820, fontSize: '26px', fillStyle: PAL.dim });
  drawHighscorePanel(ctx, W / 2, 1000);
  util.renderText({ ctx, text: 'frei nach North & South (Amiga 1989)', x: W - 230, y: H - 20, fontSize: '20px', fillStyle: PAL.dim });
  if (scene !== 'title') return;
  if (sceneTime > 0.3 && keyEdge('Space')) startGame();
  else if (keyEdge('KeyP')) setScene('test');
}

function handleTest(grid, dt, ctx) {
  ctx.drawImage(ensureTitleCanvas(), 0, 0);
  ctx.save();
  ctx.fillStyle = 'rgba(0,0,0,0.6)';
  ctx.fillRect(0, 0, W, H);
  ctx.restore();
  util.renderText({ ctx, text: 'SCHLACHT-TEST', x: W / 2, y: 140, fontSize: '90px', fillStyle: PAL.accent });
  util.renderText({ ctx, text: 'Feld anleuchten oder 1–4 · J = Schwierigkeit · Escape = zurück', x: W / 2, y: 200, fontSize: '30px', fillStyle: PAL.dim });
  if (!buttons.bt) {
    buttons.bt = BATTLE_NAMES.map((n, i) => makeButton('', 330 + i * 420, 470, 110, () => startTestBattle(i), 6));
    buttons.diff = makeButton('', 1540, 860, 95, () => {
      testDifficulty = (testDifficulty + 1) % 3;
    }, 8);
    buttons.back = makeButton('', 380, 860, 95, () => setScene('title'), 8);
  }
  const bs = buttons;
  bs.bt.forEach((b, i) => {
    const x = 330 + i * 420;
    darkDisk(ctx, x, 470, 120);
    b.handle(grid, dt);
    util.renderText({ ctx, text: String(i + 1), x, y: 490, fontSize: '60px', fillStyle: PAL.pad });
    util.renderText({ ctx, text: BATTLE_NAMES[i], x, y: 640, fontSize: '34px', fillStyle: PAL.text });
  });
  darkDisk(ctx, 1540, 860, 104);
  bs.diff.handle(grid, dt);
  util.renderText({ ctx, text: 'Schwer ' + (testDifficulty + 1) + '/3', x: 1540, y: 870, fontSize: '28px', fillStyle: PAL.warn });
  darkDisk(ctx, 380, 860, 104);
  bs.back.handle(grid, dt);
  util.renderText({ ctx, text: 'ZURÜCK', x: 380, y: 870, fontSize: '28px', fillStyle: PAL.text });
  if (testLastText) util.renderText({ ctx, text: 'Zuletzt: ' + testLastText, x: W / 2, y: 760, fontSize: '34px', fillStyle: PAL.good });
  if (scene !== 'test') return;
  if (sceneTime > 0.3) {
    for (let i = 0; i < BATTLE_KEYS.length; i++) {
      if (keyEdge(BATTLE_KEYS[i])) {
        startTestBattle(i);
        return;
      }
    }
  }
  if (keyEdge('KeyJ')) testDifficulty = (testDifficulty + 1) % 3;
  if (keyEdge('Escape')) setScene('title');
}

function handleMap(grid, dt, ctx) {
  playTime += dt;
  selShow = Math.max(0, selShow - dt);
  drawMap(ctx);
  updateEconomy(dt);
  updateEvents(grid, dt);
  drawTrain(ctx);
  keyboardMap();
  updateArmies(grid, dt);
  if (scene !== 'map') return; // Schlacht gestartet
  drawArmies(ctx);
  checkEnd();
  if (scene !== 'map') return;
  if (keyEdge('Escape')) setScene('title');
}

function handleIntro(grid, dt, ctx) {
  ctx.drawImage(ensureMapCanvas(), 0, 0);
  const a = current.attackerTeam;
  drawCard(
    ctx,
    current.title.toUpperCase() + '!',
    [
      teamName(a) + ' greift an!',
      current.testMode ? 'Testschlacht' : 'Stärke: Nord ' + strengthOf('N') + '  ·  Süd ' + strengthOf('S'),
      'Linke Hälfte spielt NORD, rechte Hälfte spielt SÜD.',
      current.game && current.game.hint ? current.game.hint : '',
      current.joke,
    ],
    teamColor(a),
    'Gleich geht’s los … ' + Math.max(0, Math.ceil(SETTINGS.introDuration - sceneTime)) + ' (Leertaste = sofort)'
  );
  drawAppleMan(ctx, 300, 760, 70, PAL.nord);
  drawSpiralCurl(ctx, W - 300, 760, 70, PAL.sued, clock * 2);
  if (sceneTime >= SETTINGS.introDuration || (sceneTime > 0.3 && keyEdge('Space'))) setScene('battle');
}

function strengthOf(team) {
  if (!current || current.testMode) return 3;
  return current.attacker.team === team ? current.attacker.strength : current.defender.strength;
}

function handleBattle(grid, dt, ctx) {
  let result = null;
  ctx.save();
  if (shake > 0) ctx.translate((Math.random() - 0.5) * shake, (Math.random() - 0.5) * shake);
  try {
    result = current.game.update(grid, dt, ctx);
  } catch (e) {
    console.error('Schlacht-Fehler in', current.title, e);
    result = { winner: current.attackerTeam, lossN: 0, lossS: 0, text: 'Die Schlacht ist zusammengebrochen (Fehler) – Angreifer gewinnt.' };
  }
  ctx.restore();
  updateEffects(dt, ctx);
  drawHud(ctx, current.title);
  if (!result && keyEdge('KeyB')) result = { winner: current.attackerTeam, lossN: 0, lossS: 0, text: 'Test: Angreifer gewinnt' };
  if (result) finishBattle(result);
}

function handleResult(grid, dt, ctx) {
  ctx.drawImage(ensureMapCanvas(), 0, 0);
  drawCard(ctx, teamName(lastResult.winner).toUpperCase() + ' SIEGT!', lastResult.lines, teamColor(lastResult.winner), 'Weiter mit Leertaste');
  drawTeamFigure(ctx, lastResult.winner, W / 2, 760, 70);
  if (sceneTime >= SETTINGS.resultDuration || (sceneTime > 0.5 && keyEdge('Space'))) {
    const test = current && current.testMode;
    current = null;
    setScene(test ? 'test' : 'map');
    if (!test) checkEnd();
  }
}

function handleEnd(grid, dt, ctx) {
  ctx.drawImage(ensureTitleCanvas(), 0, 0);
  ctx.save();
  ctx.fillStyle = 'rgba(0,0,0,0.55)';
  ctx.fillRect(0, 0, W, H);
  ctx.restore();
  const w = endInfo.winner;
  const color = w === 'N' ? PAL.nord : w === 'S' ? PAL.sued : PAL.gold;
  if (Math.random() < 0.25) burst(Math.random() * W, 200 + Math.random() * 500, color, 18, 300);
  updateEffects(dt, ctx);
  util.renderText({
    ctx,
    text: w === 'N' ? 'MANDELBROTIEN SIEGT!' : w === 'S' ? 'JULIANA SIEGT!' : 'UNENTSCHIEDEN!',
    x: W / 2,
    y: 190,
    fontSize: '120px',
    fillStyle: color,
  });
  // der große infantile Witz – bei Bedarf auf zwei Zeilen umbrechen
  const words = endInfo.joke.split(' ');
  const half = Math.ceil(words.length / 2);
  util.renderText({ ctx, text: words.slice(0, half).join(' '), x: W / 2, y: 300, fontSize: '40px', fillStyle: PAL.text });
  util.renderText({ ctx, text: words.slice(half).join(' '), x: W / 2, y: 352, fontSize: '40px', fillStyle: PAL.text });
  // Sieger-Figur hüpft, Verlierer-Figur weint (bzw. beide doof)
  const hop = Math.abs(Math.sin(clock * 5)) * 40;
  if (w === 'N' || w === 'D') drawAppleMan(ctx, 420, 620 - (w === 'N' ? hop : 0), 90, PAL.nord);
  if (w === 'S' || w === 'D') drawSpiralCurl(ctx, W - 420, 620 - (w === 'S' ? hop : 0), 90, PAL.sued, clock * 3);
  if (w === 'N') drawSpiralCurl(ctx, W - 420, 660, 60, PAL.suedDim, 0);
  if (w === 'S') drawAppleMan(ctx, 420, 660, 60, PAL.nordDim);
  const statLines = [
    'Provinzen: Nord ' + countProvinces('N') + ' · Süd ' + countProvinces('S') + '   ·   Schlachten: ' + STATS.battles + ' (Nord ' + STATS.battlesN + ', Süd ' + STATS.battlesS + ')',
    'Iterationen verdient: Nord ' + STATS.earnedN + ' · Süd ' + STATS.earnedS + '   ·   Züge geplündert: ' + STATS.trains + '   ·   Stürme: ' + STATS.storms,
    'Punkte ' + (w === 'D' ? 'des Besseren' : 'des Siegers') + ': ' + endInfo.score + (newHighscore ? '   – NEUER HIGHSCORE! Wie damals am Amiga, nur fraktaler.' : ''),
  ];
  statLines.forEach((l, i) => util.renderText({ ctx, text: l, x: W / 2, y: 470 + i * 48, fontSize: '30px', fillStyle: i === 2 ? PAL.gold : PAL.dim }));
  if (sceneTime > 2) {
    if (!buttons.again) {
      buttons.again = makeButton('NOCHMAL', 760, 860, 100, () => startGame(), 8);
      buttons.menu = makeButton('MENÜ', 1160, 860, 90, () => setScene('title'), 6);
    }
    const bs = buttons;
    darkDisk(ctx, 760, 860, 110);
    darkDisk(ctx, 1160, 860, 100);
    bs.again.handle(grid, dt);
    bs.menu.handle(grid, dt);
    if (scene === 'end' && keyEdge('Space')) startGame();
  }
  drawHighscorePanel(ctx, W / 2, 1030);
}

// ---------------------------------------------------------------------------------------------------------
// Schlachten (eingefügt) – Vertrag siehe Kopf von startBattle / Agenten-Absprache:
//   function btXyz(opts) → { id, title, hint, update(grid, dt, ctx) }; update liefert null oder einmal
//   { winner: 'N'|'S', lossN, lossS, text }. opts = { level, attacker, strengthN, strengthS, testMode }.
// ---------------------------------------------------------------------------------------------------------

// @@BATTLES@@ (eingefügt: Schlachten 1–4)
// =========================================================================================================
// SCHLACHTEN A (1–2): Feldschlacht, Fort-Sturm
// Vertrag: btXyz(opts) → { id, title, hint, update(grid, dt, ctx) }; update liefert null, solange es läuft,
// und genau einmal { winner: 'N'|'S', lossN, lossS, text }.
// Nord (Mandelbrotien, Apfelmännchen mit Pickelhaube) steuert mit Pads LINKS (x < MID),
// Süd (Juliana, Spiralkringel mit Strohhut) mit Pads RECHTS. Pads schwarz + nur Kontur, Füllring außen.
// Interferenz („embraced“): Jeder Laser wirkt auf jedes Pad – wer drüben mitleuchtet, HILFT dem Gegner beim
// Füllen (Infanterie/Kavallerie/Sturm) bzw. verzieht dessen Kanone. Sabotage geht also nur übers Zielen
// (Kanone des Gegners auf dessen eigene Leute ziehen) – kostet aber Laser, die bei der eigenen Armee fehlen.
// Gemeinsame Helfer: Präfix bta…, Feldschlacht fs2…, Fort-Sturm fo2…
// =========================================================================================================

/** Unsichtbarer pixelFillButton als Laser-Ziel (Füllung ∝ bedeckter Fläche, gedeckelt). */
function btaPad(x, y, r, speedUp) {
  return guiPixelFillButton({
    label: '',
    posX: x,
    posY: y,
    radius: r,
    edges: 24,
    speedUp: speedUp || 120,
    speedDown: 30,
    fullPercent: 22,
    minPercent: 0,
    activeValue: 99,
    minValue: 1,
    visible: false,
  });
}

/** Test-Helfer: Taste füllt das Pad, als würde das Team draufleuchten. */
function btaKeyFill(pad, team, dt, rate) {
  if (isKeyDown(team === 'N' ? 'KeyK' : 'KeyL')) pad.setValue(Math.min(100, pad.getValue() + (rate || 160) * dt));
}

function btaHelper(team) {
  return isKeyDown(team === 'N' ? 'KeyK' : 'KeyL');
}

function btaTeamColor(team) {
  return team === 'N' ? PAL.nord : PAL.sued;
}

/** Pad: schwarz gefüllt, Kontur, Füllring außen, Beschriftung darunter. */
function btaDrawPad(ctx, x, y, r, value, color, label, disabled) {
  ctx.save();
  ctx.fillStyle = '#000000';
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = color;
  ctx.globalAlpha = disabled ? 0.35 : 1;
  ctx.lineWidth = 3;
  ctx.stroke();
  if (value > 0.5) {
    ctx.lineWidth = 9;
    ctx.beginPath();
    ctx.arc(x, y, r + 10, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * Math.min(1, value / 100));
    ctx.stroke();
  }
  ctx.restore();
  if (label) util.renderText({ ctx, text: label, x, y: y + r + 42, fontSize: '28px', fillStyle: color });
}

/** Zeitbalken + Stärke-Anzeige beider Teams oben im Schlachtbereich. */
function btaBar(ctx, frac, valN, valS, label) {
  const y = TOP + 26;
  ctx.save();
  ctx.fillStyle = '#000000';
  ctx.fillRect(MID - 300, y - 9, 600, 18);
  ctx.fillStyle = PAL.dim;
  ctx.fillRect(MID - 300, y - 9, 600 * clamp(frac, 0, 1), 18);
  ctx.restore();
  util.renderText({ ctx, text: label, x: MID, y: y + 46, fontSize: '30px', fillStyle: PAL.text });
  util.renderText({ ctx, text: 'NORD ' + valN, x: 220, y: y + 16, fontSize: '40px', fillStyle: PAL.nord });
  util.renderText({ ctx, text: valS + ' SÜD', x: W - 220, y: y + 16, fontSize: '40px', fillStyle: PAL.sued });
}

/**
 * Kartoon-Figur. Nord = Apfelmännchen (Kardioide aus zwei Kreisen) mit Pickelhaube,
 * Süd = Spiralkringel mit Strohhut. dir = +1 schaut nach rechts, -1 nach links. s = Grösse (≈ Höhe/2).
 */
function btaFigure(ctx, team, x, y, s, dir, phase, mounted) {
  const col = btaTeamColor(team);
  const bob = Math.sin(phase) * s * 0.08;
  ctx.save();
  ctx.translate(x, y + bob);
  ctx.strokeStyle = col;
  ctx.fillStyle = '#000000';
  ctx.lineWidth = Math.max(2, s * 0.12);
  if (mounted) {
    // Reittier: ein Fraktal-Pony (Ellipse + Beine), sehr infantil
    ctx.beginPath();
    ctx.ellipse(0, 0, s * 1.2, s * 0.5, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    for (let i = 0; i < 4; i++) {
      const lx = (i - 1.5) * s * 0.6;
      ctx.beginPath();
      ctx.moveTo(lx, s * 0.4);
      ctx.lineTo(lx + Math.sin(phase * 2 + i) * s * 0.3, s * 1.1);
      ctx.stroke();
    }
    ctx.beginPath();
    ctx.arc(dir * s * 1.3, -s * 0.4, s * 0.35, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    ctx.translate(0, -s * 0.9);
  } else {
    // Beinchen
    ctx.beginPath();
    ctx.moveTo(-s * 0.2, s * 0.5);
    ctx.lineTo(-s * 0.2 + Math.sin(phase * 2) * s * 0.25, s * 1.05);
    ctx.moveTo(s * 0.2, s * 0.5);
    ctx.lineTo(s * 0.2 - Math.sin(phase * 2) * s * 0.25, s * 1.05);
    ctx.stroke();
  }
  if (team === 'N') {
    // Apfelmännchen: großer Bauch + kleiner Kopf (wie Hauptkardioide + Periode-2-Knospe)
    ctx.beginPath();
    ctx.arc(0, 0, s * 0.55, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(0, -s * 0.8, s * 0.3, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    // Pickelhaube
    ctx.beginPath();
    ctx.moveTo(-s * 0.3, -s * 0.95);
    ctx.lineTo(s * 0.3, -s * 0.95);
    ctx.moveTo(0, -s * 1.1);
    ctx.lineTo(0, -s * 1.45);
    ctx.stroke();
  } else {
    // Spiralkringel
    ctx.beginPath();
    for (let a = 0; a < Math.PI * 5; a += 0.25) {
      const rr = (a / (Math.PI * 5)) * s * 0.6;
      const px = Math.cos(a * dir) * rr;
      const py = Math.sin(a) * rr;
      if (a === 0) ctx.moveTo(px, py);
      else ctx.lineTo(px, py);
    }
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(0, -s * 0.85, s * 0.28, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    // Strohhut
    ctx.beginPath();
    ctx.ellipse(0, -s * 1.08, s * 0.55, s * 0.12, 0, 0, Math.PI * 2);
    ctx.moveTo(-s * 0.22, -s * 1.1);
    ctx.lineTo(-s * 0.18, -s * 1.35);
    ctx.lineTo(s * 0.18, -s * 1.35);
    ctx.lineTo(s * 0.22, -s * 1.1);
    ctx.stroke();
  }
  // Äuglein in Blickrichtung
  ctx.fillStyle = col;
  ctx.beginPath();
  ctx.arc(dir * s * 0.12, -s * 0.82, Math.max(1.5, s * 0.06), 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

function btaPick(list) {
  return list[Math.floor(Math.random() * list.length)];
}

const BTA_JOKES_N = [
  'Nord gewinnt! Süd divergiert jetzt beleidigt ins Unendliche.',
  'Mandelbrotien siegt – das Apfelmännchen macht ein Bäuerchen in Form einer Kardioide.',
  'Sieg für Nord! Juliana ist jetzt nicht mehr zusammenhängend. Hihi.',
];
const BTA_JOKES_S = [
  'Süd gewinnt! Nord iteriert vor Wut bis z = Pups.',
  'Juliana siegt – der Spiralkringel dreht sich vor Freude bis ihm schlecht wird.',
  'Sieg für Süd! Das Apfelmännchen ist jetzt nur noch ein Apfelmännchenchen.',
];

function btaJoke(winner) {
  return btaPick(winner === 'N' ? BTA_JOKES_N : BTA_JOKES_S);
}

/** Boden + Himmel mit gedimmten Höhenlinien (einmal vorgerendert). */
function btaBattleground(groundY) {
  const c = makeCanvas(W, H);
  const g = c.getContext('2d');
  g.fillStyle = PAL.dark;
  g.fillRect(0, 0, W, H);
  g.globalAlpha = 0.25;
  g.strokeStyle = PAL.ground;
  g.lineWidth = 2;
  for (let i = 0; i < 9; i++) {
    g.beginPath();
    for (let x = 0; x <= W; x += 20) {
      const y = groundY + 40 + i * 22 + Math.sin(x * 0.01 + i) * 8 + Math.sin(x * 0.037 + i * 2) * 4;
      if (x === 0) g.moveTo(x, y);
      else g.lineTo(x, y);
    }
    g.stroke();
  }
  g.globalAlpha = 1;
  g.strokeStyle = PAL.ground;
  g.lineWidth = 4;
  g.beginPath();
  g.moveTo(0, groundY);
  g.lineTo(W, groundY);
  g.stroke();
  // Mittellinie (Grenze der Saalhälften), sehr dezent
  g.globalAlpha = 0.25;
  g.setLineDash([14, 18]);
  g.beginPath();
  g.moveTo(MID, TOP);
  g.lineTo(MID, H);
  g.stroke();
  return c;
}

// =========================================================================================================
// 1. FELDSCHLACHT – Seitenansicht. Pro Team 3 Pads: KANONE (Zielbereich, aimTurret), INFANTERIE, KAVALLERIE.
// =========================================================================================================

function btFeldschlacht(opts) {
  const level = opts.level || 0;
  const GROUND = 880;
  const DURATION = 45 + level * 5;
  const RES_PER_STRENGTH = 6;
  const INF_WAVE = 4;
  const CAV_WAVE = 3;
  const CAV_COOLDOWN = 12 - level * 2;
  const CANNON_INTERVAL = 3.2 - level * 0.5;
  const bg = btaBattleground(GROUND);

  const teams = ['N', 'S'];
  const T = {};
  teams.forEach((team) => {
    const left = team === 'N';
    const sx = (x) => (left ? x : W - x);
    const strength = clamp(Math.round(team === 'N' ? opts.strengthN || 5 : opts.strengthS || 5), 1, 10);
    T[team] = {
      team,
      dir: left ? 1 : -1,
      baseX: sx(90),
      reserve: strength * RES_PER_STRENGTH,
      initial: strength * RES_PER_STRENGTH,
      strength,
      inf: btaPad(sx(300), 600, 70, 110),
      cav: btaPad(sx(620), 600, 70, 70),
      cavCool: 0,
      aimArea: { x: left ? 80 : MID + 80, y: TOP + 90, w: MID - 160, h: 300 },
      turret: null,
      cannonTimer: CANNON_INTERVAL * (0.5 + Math.random() * 0.5),
      aimX: sx(900),
      cannonX: sx(150),
    };
    const t = T[team];
    t.turret = guiAimTurret({
      posX: t.cannonX,
      posY: GROUND - 40,
      scanX: t.aimArea.x,
      scanY: t.aimArea.y,
      scanWidth: t.aimArea.w,
      scanHeight: t.aimArea.h,
      minPercent: 0.3,
      fireInterval: 999,
      visible: false,
    });
  });

  const units = [];
  const balls = [];
  const smoke = [];
  let time = 0;
  let result = null;
  let done = 0;
  let phase = 0;

  function total(t) {
    let n = t.reserve;
    units.forEach((u) => {
      if (u.team === t.team) n++;
    });
    return n;
  }

  function spawn(t, type, count) {
    const n = Math.min(count, t.reserve);
    for (let i = 0; i < n; i++) {
      units.push({
        team: t.team,
        type,
        x: t.baseX - t.dir * i * 40,
        hp: type === 'cav' ? 2.2 : 1,
        speed: (type === 'cav' ? 240 : 70) * (1 + level * 0.15),
        phase: Math.random() * 6,
      });
    }
    t.reserve -= n;
    if (n > 0) {
      playSound(type === 'cav' ? SND.boom : SND.click, 0.35);
      addFloater(t.baseX + t.dir * 160, GROUND - 160, type === 'cav' ? 'HUII, KAVALLERIE!' : '+' + n + ' Infanterie', btaTeamColor(t.team));
    }
  }

  function fire(t) {
    // Zielpunkt im Zielbereich → Landepunkt quer übers Feld (links im Bereich = nah, rechts = weit)
    const a = t.aimArea;
    const f = clamp((t.aimX - a.x) / a.w, 0, 1);
    const dist = t.team === 'N' ? 250 + f * 1450 : 250 + (1 - f) * 1450;
    const tx = t.cannonX + t.dir * dist;
    balls.push({ team: t.team, x0: t.cannonX, x1: clamp(tx, 40, W - 40), t: 0, dur: 1.4 });
    playSound(SND.shot, 0.4);
    smoke.push({ x: t.cannonX + t.dir * 40, y: GROUND - 60, r: 20, life: 1 });
  }

  function explode(x) {
    burst(x, GROUND - 20, PAL.warn, 26, 420);
    addShake(10);
    playSound(SND.boom, 0.5);
    smoke.push({ x, y: GROUND - 40, r: 40, life: 1.5 });
    // trifft ALLE in der Nähe – auch eigene Leute (Kanone ins Getümmel = Eigentor)
    for (let i = units.length - 1; i >= 0; i--) {
      if (Math.abs(units[i].x - x) < 75) {
        units[i].hp -= 1.5;
      }
    }
  }

  function helperAim(t) {
    // Taste: Kanone zielt auf die vorderste gegnerische Einheit (keine da → nicht schießen)
    let best = null;
    units.forEach((u) => {
      if (u.team === t.team) return;
      if (!best || Math.abs(u.x - t.cannonX) < Math.abs(best.x - t.cannonX)) best = u;
    });
    if (!best) return false;
    const tx = best.x;
    const dist = Math.abs(tx - t.cannonX);
    const f = clamp((dist - 250) / 1450, 0, 1);
    const a = t.aimArea;
    t.aimX = a.x + (t.team === 'N' ? f : 1 - f) * a.w;
    return true;
  }

  function finish(winner) {
    const n = T.N;
    const s = T.S;
    const lossN = Math.round((1 - total(n) / n.initial) * n.strength);
    const lossS = Math.round((1 - total(s) / s.initial) * s.strength);
    result = { winner, lossN: clamp(lossN, 0, n.strength), lossS: clamp(lossS, 0, s.strength), text: btaJoke(winner) };
    playSound(SND.win, 0.6);
  }

  function update(grid, dt, ctx) {
    if (done > 0) {
      done -= dt;
      draw(ctx);
      return done <= 0 ? result : null;
    }
    time += dt;
    phase += dt * 6;

    teams.forEach((team) => {
      const t = T[team];
      t.inf.handle(grid, dt);
      t.cav.handle(grid, dt);
      btaKeyFill(t.inf, team, dt, 120);
      if (t.cavCool <= 0) btaKeyFill(t.cav, team, dt, 90);
      else t.cav.setValue(0);
      if (t.inf.getValue() >= 99) {
        t.inf.setValue(0);
        spawn(t, 'inf', INF_WAVE);
      }
      if (t.cavCool > 0) t.cavCool -= dt;
      else if (t.cav.getValue() >= 99) {
        t.cav.setValue(0);
        t.cavCool = CAV_COOLDOWN;
        spawn(t, 'cav', CAV_WAVE);
      }
      t.turret.handle(grid, dt);
      let aiming = false;
      if (btaHelper(team)) {
        aiming = helperAim(t);
      } else if (t.turret.hasTarget()) {
        t.aimX = t.turret.getTargetX();
        aiming = true;
      }
      t.cannonTimer -= dt;
      if (t.cannonTimer <= 0 && aiming) {
        t.cannonTimer = CANNON_INTERVAL;
        fire(t);
      }
    });

    // Einheiten: laufen, kämpfen bei Kontakt, Durchbruch am gegnerischen Rand
    units.forEach((u) => {
      const dir = u.team === 'N' ? 1 : -1;
      let enemy = null;
      units.forEach((o) => {
        if (o.team === u.team || o.hp <= 0) return;
        const d = (o.x - u.x) * dir;
        if (d >= 0 && d < 46 && (!enemy || d < (enemy.x - u.x) * dir)) enemy = o;
      });
      u.phase += dt * (u.type === 'cav' ? 14 : 7);
      if (enemy) {
        enemy.hp -= dt * (u.type === 'cav' ? 1.6 : 0.8);
        if (Math.random() < dt * 3) burst((u.x + enemy.x) / 2, GROUND - 40, PAL.dim, 3, 120);
      } else {
        u.x += dir * u.speed * dt;
      }
    });
    for (let i = units.length - 1; i >= 0; i--) {
      const u = units[i];
      if (u.hp <= 0) {
        burst(u.x, GROUND - 40, btaTeamColor(u.team), 10, 200);
        units.splice(i, 1);
        continue;
      }
      if ((u.team === 'N' && u.x > W - 60) || (u.team === 'S' && u.x < 60)) {
        // Durchbruch: Gegner verliert 3 Reservisten, der Held kehrt in die eigene Reserve zurück
        const foe = T[u.team === 'N' ? 'S' : 'N'];
        foe.reserve = Math.max(0, foe.reserve - 3);
        T[u.team].reserve++;
        addFloater(u.x, GROUND - 200, 'DURCHBRUCH!', btaTeamColor(u.team));
        units.splice(i, 1);
      }
    }

    balls.slice().forEach((b) => {
      b.t += dt / b.dur;
      if (b.t >= 1) {
        balls.splice(balls.indexOf(b), 1);
        explode(b.x1);
      }
    });
    smoke.slice().forEach((s) => {
      s.life -= dt;
      s.r += dt * 30;
      s.y -= dt * 20;
      if (s.life <= 0) smoke.splice(smoke.indexOf(s), 1);
    });

    const tn = total(T.N);
    const ts = total(T.S);
    if (tn === 0 || ts === 0 || time >= DURATION) {
      // Gleichstand: der Verteidiger hält die Provinz
      const defender = opts.attacker === 'S' ? 'N' : 'S';
      finish(tn === ts ? defender : tn > ts ? 'N' : 'S');
      done = 1.4;
    }
    draw(ctx);
    return null;
  }

  function draw(ctx) {
    ctx.drawImage(bg, 0, 0);
    teams.forEach((team) => {
      const t = T[team];
      const col = btaTeamColor(team);
      const a = t.aimArea;
      // Zielbereich der Kanone: schwarz, nur Kontur
      ctx.save();
      ctx.fillStyle = '#000000';
      ctx.fillRect(a.x, a.y, a.w, a.h);
      ctx.strokeStyle = col;
      ctx.lineWidth = 2;
      ctx.setLineDash([10, 10]);
      ctx.strokeRect(a.x, a.y, a.w, a.h);
      ctx.setLineDash([]);
      ctx.globalAlpha = 0.8;
      ctx.beginPath();
      ctx.moveTo(t.aimX, a.y + 10);
      ctx.lineTo(t.aimX, a.y + a.h - 10);
      ctx.stroke();
      ctx.restore();
      util.renderText({ ctx, text: 'KANONE: hier zielen (nah ↔ weit)', x: a.x + a.w / 2, y: a.y + a.h + 34, fontSize: '26px', fillStyle: col });
      // Kanone
      ctx.save();
      ctx.strokeStyle = col;
      ctx.fillStyle = '#000000';
      ctx.lineWidth = 6;
      ctx.beginPath();
      ctx.arc(t.cannonX, GROUND - 25, 25, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(t.cannonX, GROUND - 35);
      ctx.lineTo(t.cannonX + t.dir * 70, GROUND - 75);
      ctx.stroke();
      ctx.restore();
      btaDrawPad(ctx, t.inf.getX(), t.inf.getY(), 70, t.inf.getValue(), col, 'INFANTERIE');
      btaDrawPad(ctx, t.cav.getX(), t.cav.getY(), 70, t.cav.getValue(), col, t.cavCool > 0 ? 'KAVALLERIE ' + Math.ceil(t.cavCool) + 's' : 'KAVALLERIE', t.cavCool > 0);
      // Reserve als kleine Köpfchen-Reihe hinter der Kanone
      for (let i = 0; i < Math.min(t.reserve, 30); i++) {
        const x = t.baseX - t.dir * (20 + (i % 10) * 9);
        const y = GROUND - 120 - Math.floor(i / 10) * 12;
        ctx.fillStyle = col;
        ctx.fillRect(x, y, 5, 5);
      }
    });
    units.forEach((u) => {
      btaFigure(ctx, u.team, u.x, GROUND - (u.type === 'cav' ? 40 : 34), u.type === 'cav' ? 22 : 26, u.team === 'N' ? 1 : -1, u.phase, u.type === 'cav');
    });
    balls.forEach((b) => {
      const x = lerp(b.x0, b.x1, b.t);
      const y = GROUND - 60 - Math.sin(b.t * Math.PI) * 420;
      ctx.save();
      ctx.fillStyle = PAL.warn;
      ctx.beginPath();
      ctx.arc(x, y, 10, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    });
    smoke.forEach((s) => {
      ctx.save();
      ctx.globalAlpha = clamp(s.life * 0.3, 0, 0.35);
      ctx.fillStyle = PAL.dim;
      ctx.beginPath();
      ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    });
    btaBar(ctx, time / DURATION, total(T.N), total(T.S), 'FELDSCHLACHT · noch ' + Math.max(0, Math.ceil(DURATION - time)) + ' s');
  }

  return {
    id: 'feldschlacht',
    title: 'Feldschlacht',
    hint: 'Jede Hälfte: Kanone zielen, Infanterie und Kavallerie losschicken. Achtung, Kanonen treffen auch eigene Leute!',
    update,
  };
}

// =========================================================================================================
// 2. FORT-STURM – Seitenansicht, Fort auf der Seite des Verteidigers (3 Mauer-Bahnen in leichter Tiefe).
// Angreifer: Leitern (dragHandle) an die Mauer ziehen, STURM-Pad füllen → Kletterer klettern hoch.
// Verteidiger: Zielbereich (aimTurret, 3 Bänder = 3 Bahnen) schießt Kletterer ab, Leiter-Kopf anleuchten
// stößt die Leiter um. Angreifer gewinnen mit genug Kletterern oben, sonst der Verteidiger bei Zeitablauf.
// Die Leiter-Ziele liegen knapp hinter der Mittellinie auf der Verteidiger-Seite: Angreifer müssen hinüber-
// leuchten – Verteidiger können dort mitleuchten und die Leiter „festhalten“ (Interferenz, gewollt).
// =========================================================================================================

function btFortsturm(opts) {
  const level = opts.level || 0;
  const att = opts.attacker === 'S' ? 'S' : 'N';
  const def = att === 'N' ? 'S' : 'N';
  // Grund-Layout ist für Verteidiger = Süd (Fort rechts) gebaut und wird für Nord gespiegelt
  const mx = (x) => (def === 'S' ? x : W - x);
  const dirAtt = def === 'S' ? 1 : -1;
  const DURATION = 50 + level * 5;
  const CLIMB_TIME = 5.5 - level * 0.8;
  const SHOT_INTERVAL = 1.2 - level * 0.2;
  const strengthAtt = clamp(Math.round(att === 'N' ? opts.strengthN || 5 : opts.strengthS || 5), 1, 10);
  const strengthDef = clamp(Math.round(def === 'N' ? opts.strengthN || 5 : opts.strengthS || 5), 1, 10);
  let pool = strengthAtt * 3;
  // Ziel nie höher als 60 % der vorhandenen Kletterer – sonst kann eine schwache Armee (Stärke 1–2) gar nicht gewinnen
  const NEED = Math.min(4 + level * 2, Math.max(2, Math.ceil(pool * 0.6)));
  const bg = btaBattleground(1000);
  const colAtt = btaTeamColor(att);
  const colDef = btaTeamColor(def);

  const lanes = [0, 1, 2].map((i) => {
    const groundY = 720 + i * 110;
    const wallX = MID + 130 + i * 35; // Mauerfront (Basis-Layout)
    return {
      i,
      groundY,
      top: groundY - 300,
      wallX: mx(wallX),
      ladderX: mx(wallX - 55),
      ladderY: groundY - 150,
      ladder: -1,
      push: btaPad(mx(wallX - 20), groundY - 290, 55, 60),
      hot: false,
    };
  });

  const ladders = [0, 1, 2].map((i) => {
    const start = { x: mx(260 + i * 170), y: 960 };
    const l = { i, start, lane: -1, drag: null };
    l.drag = guiDragHandle({
      posX: start.x,
      posY: start.y,
      radius: 60,
      edges: 4,
      fullPercent: 20,
      snapPoints: lanes.map((ln) => ({ x: ln.ladderX, y: ln.ladderY })),
      snapDistance: 140,
      visible: false,
      onGrab: () => {
        if (l.lane >= 0) {
          lanes[l.lane].ladder = -1;
          l.lane = -1;
        }
      },
      onDrop: (h, idx) => {
        if (idx >= 0 && lanes[idx].ladder < 0) {
          lanes[idx].ladder = l.i;
          l.lane = idx;
          // stehende Leiter ist fest: runter geht sie nur über UMSTOSSEN (die Umstoß-Pads überlappen sonst den
          // Griff der Nachbar-Leiter und reißen sie samt Kletterern versehentlich weg)
          l.drag.setEnabled(false);
          playSound(SND.click, 0.4);
          addFloater(lanes[idx].ladderX, lanes[idx].top - 30, 'Leiter steht!', colAtt);
        } else {
          l.drag.setX(start.x);
          l.drag.setY(start.y);
        }
      },
    });
    return l;
  });

  const sturm = btaPad(mx(420), 430, 75, 90);
  const aim = {
    x: def === 'S' ? MID + 380 : 60,
    y: TOP + 80,
    w: MID - 440,
    h: 330,
  };
  const turret = guiAimTurret({
    posX: lanes[0].wallX,
    posY: lanes[0].top,
    scanX: aim.x,
    scanY: aim.y,
    scanWidth: aim.w,
    scanHeight: aim.h,
    minPercent: 0.3,
    fireInterval: 999,
    visible: false,
  });

  const climbers = [];
  let shotTimer = SHOT_INTERVAL;
  let aimLane = -1;
  let reached = 0;
  let killed = 0;
  let time = 0;
  let phase = 0;
  let result = null;
  let done = 0;

  function sendClimbers() {
    const free = lanes.filter((ln) => ln.ladder >= 0);
    if (!free.length) {
      addFloater(mx(420), 330, 'Erst Leiter anlegen!', PAL.warn);
      playSound(SND.error, 0.3);
      return;
    }
    const n = Math.min(2, pool);
    for (let k = 0; k < n; k++) {
      const ln = btaPick(free);
      climbers.push({ lane: ln.i, p: -0.25 - k * 0.12, phase: Math.random() * 6 });
    }
    pool -= n;
    if (n) playSound(SND.plop, 0.4);
  }

  function shootLane(laneIdx) {
    let best = null;
    climbers.forEach((c) => {
      if (c.lane === laneIdx && c.p >= 0 && (!best || c.p > best.p)) best = c;
    });
    const ln = lanes[laneIdx];
    playSound(SND.shot, 0.35);
    if (best) {
      const y = ln.groundY - best.p * 300;
      burst(ln.ladderX, y, colAtt, 12, 260);
      addFloater(ln.ladderX, y - 40, 'Plumps!', colDef);
      climbers.splice(climbers.indexOf(best), 1);
      killed++;
    }
  }

  function pushLadder(ln) {
    const l = ladders[ln.ladder];
    climbers.slice().forEach((c) => {
      if (c.lane === ln.i) {
        climbers.splice(climbers.indexOf(c), 1);
        killed++;
      }
    });
    burst(ln.ladderX, ln.top, PAL.ground, 20, 300);
    addShake(8);
    playSound(SND.boom, 0.45);
    addFloater(ln.ladderX, ln.top - 40, 'UMGESTOSSEN!', colDef);
    ln.ladder = -1;
    l.lane = -1;
    l.drag.setEnabled(true);
    l.drag.setX(l.start.x);
    l.drag.setY(l.start.y);
  }

  function finish(winner) {
    const lossAtt = clamp(Math.round(killed / 3), 0, strengthAtt);
    const lossDef = clamp(Math.round(reached / 2), 0, strengthDef);
    result = {
      winner,
      lossN: att === 'N' ? lossAtt : lossDef,
      lossS: att === 'S' ? lossAtt : lossDef,
      text: btaJoke(winner),
    };
    playSound(SND.win, 0.6);
  }

  function update(grid, dt, ctx) {
    if (done > 0) {
      done -= dt;
      draw(ctx);
      return done <= 0 ? result : null;
    }
    time += dt;
    phase += dt * 6;

    // Angreifer
    ladders.forEach((l) => l.drag.handle(grid, dt));
    if (btaHelper(att)) {
      ladders.forEach((l) => {
        if (l.lane >= 0) return;
        const ln = lanes.find((x) => x.ladder < 0);
        if (!ln) return;
        ln.ladder = l.i;
        l.lane = ln.i;
        l.drag.setEnabled(false);
        l.drag.setX(ln.ladderX);
        l.drag.setY(ln.ladderY);
      });
    }
    sturm.handle(grid, dt);
    btaKeyFill(sturm, att, dt, 110);
    if (sturm.getValue() >= 99) {
      sturm.setValue(0);
      sendClimbers();
    }

    // Verteidiger
    lanes.forEach((ln) => {
      if (ln.ladder < 0) {
        ln.push.setValue(0);
        ln.hot = false;
        return;
      }
      // Umstoßen lädt nur, solange ein Kletterer in der oberen Leiterhälfte hängt – sonst würde Dauerleuchten
      // auf die Leiter-Köpfe jede Leiter sofort kippen (Verteidiger gewinnt ohne Gegenwehr)
      ln.hot = climbers.some((c) => c.lane === ln.i && c.p > 0.5);
      if (ln.hot) ln.push.handle(grid, dt);
      else ln.push.setValue(Math.max(0, ln.push.getValue() - 30 * dt));
      if (btaHelper(def) && climbers.some((c) => c.lane === ln.i && c.p > 0.55)) btaKeyFill(ln.push, def, dt, 120);
      if (ln.push.getValue() >= 99) {
        ln.push.setValue(0);
        pushLadder(ln);
      }
    });
    turret.handle(grid, dt);
    aimLane = -1;
    if (btaHelper(def)) {
      let best = null;
      climbers.forEach((c) => {
        if (c.p >= 0 && (!best || c.p > best.p)) best = c;
      });
      if (best) aimLane = best.lane;
    } else if (turret.hasTarget()) {
      aimLane = clamp(Math.floor(((turret.getTargetY() - aim.y) / aim.h) * 3), 0, 2);
    }
    shotTimer -= dt;
    if (shotTimer <= 0 && aimLane >= 0) {
      shotTimer = SHOT_INTERVAL;
      shootLane(aimLane);
    }

    // Kletterer
    climbers.slice().forEach((c) => {
      const ln = lanes[c.lane];
      if (ln.ladder < 0) {
        climbers.splice(climbers.indexOf(c), 1);
        return;
      }
      c.p += dt / CLIMB_TIME;
      c.phase += dt * 10;
      if (c.p >= 1) {
        climbers.splice(climbers.indexOf(c), 1);
        reached++;
        burst(ln.wallX, ln.top, colAtt, 16, 260);
        addFloater(ln.wallX, ln.top - 50, 'OBEN! ' + reached + '/' + NEED, colAtt);
        playSound(SND.pickup, 0.5);
      }
    });

    if (reached >= NEED) {
      finish(att);
      done = 1.4;
    } else if (time >= DURATION || pool + climbers.length + reached < NEED) {
      // auch vorzeitig: wenn die restlichen Kletterer rechnerisch nicht mehr reichen
      finish(def);
      done = 1.4;
    }
    draw(ctx);
    return null;
  }

  function draw(ctx) {
    ctx.drawImage(bg, 0, 0);
    // Fort: Mauern (hinten zuerst), nur Kontur + dunkle Füllung
    lanes
      .slice()
      .reverse()
      .forEach((ln) => {
        ctx.save();
        ctx.fillStyle = '#05070a';
        ctx.strokeStyle = colDef;
        ctx.lineWidth = 3;
        const x0 = ln.wallX;
        const x1 = def === 'S' ? W - 40 : 40;
        ctx.beginPath();
        ctx.rect(Math.min(x0, x1), ln.top, Math.abs(x1 - x0), ln.groundY - ln.top);
        ctx.fill();
        ctx.stroke();
        // Zinnen
        for (let k = 0; k < 5; k++) {
          const zx = x0 + (def === 'S' ? 1 : -1) * (k * 60);
          ctx.strokeRect(def === 'S' ? zx : zx - 30, ln.top - 26, 30, 26);
        }
        ctx.restore();
      });
    // Fahne des Verteidigers
    util.renderText({ ctx, text: def === 'N' ? 'FORT APFELMANN' : 'FORT KRINGELBURG', x: mx(1600), y: lanes[0].top - 60, fontSize: '36px', fillStyle: colDef });

    // Leitern
    ladders.forEach((l) => {
      const placed = l.lane >= 0;
      const x = l.drag.getX();
      const y = l.drag.getY();
      ctx.save();
      ctx.strokeStyle = colAtt;
      ctx.lineWidth = 5;
      ctx.translate(x, y);
      if (placed) ctx.rotate(dirAtt * 0.18);
      else ctx.rotate(Math.PI / 2);
      ctx.beginPath();
      ctx.moveTo(-18, -150);
      ctx.lineTo(-18, 150);
      ctx.moveTo(18, -150);
      ctx.lineTo(18, 150);
      for (let k = -130; k <= 130; k += 40) {
        ctx.moveTo(-18, k);
        ctx.lineTo(18, k);
      }
      ctx.stroke();
      ctx.restore();
      if (!placed) {
        btaDrawPad(ctx, x, y, 60, l.drag.getValue(), colAtt, l.drag.isGrabbed() ? '' : 'LEITER');
      }
    });
    // Leiter-Köpfe (Verteidiger stößt um)
    lanes.forEach((ln) => {
      if (ln.ladder >= 0) btaDrawPad(ctx, ln.push.getX(), ln.push.getY(), 55, ln.push.getValue(), colDef, ln.hot ? 'UMSTOSSEN!' : 'UMSTOSSEN', !ln.hot);
    });
    // Kletterer
    climbers.forEach((c) => {
      if (c.p < 0) return;
      const ln = lanes[c.lane];
      btaFigure(ctx, att, ln.ladderX + dirAtt * c.p * 40, ln.groundY - 30 - c.p * 290, 22, dirAtt, c.phase, false);
    });
    // Angreifer-Pad + Reserve
    btaDrawPad(ctx, sturm.getX(), sturm.getY(), 75, sturm.getValue(), colAtt, 'STURM! (' + pool + ')');
    // Zielbereich Verteidiger: 3 Bänder = 3 Bahnen
    ctx.save();
    ctx.fillStyle = '#000000';
    ctx.fillRect(aim.x, aim.y, aim.w, aim.h);
    ctx.strokeStyle = colDef;
    ctx.lineWidth = 2;
    ctx.setLineDash([10, 10]);
    ctx.strokeRect(aim.x, aim.y, aim.w, aim.h);
    for (let k = 1; k < 3; k++) {
      ctx.beginPath();
      ctx.moveTo(aim.x, aim.y + (aim.h * k) / 3);
      ctx.lineTo(aim.x + aim.w, aim.y + (aim.h * k) / 3);
      ctx.stroke();
    }
    ctx.setLineDash([]);
    if (aimLane >= 0) {
      ctx.lineWidth = 5;
      ctx.strokeRect(aim.x + 4, aim.y + (aim.h * aimLane) / 3 + 4, aim.w - 8, aim.h / 3 - 8);
    }
    ctx.restore();
    ['oben', 'mitte', 'unten'].forEach((name, k) => {
      util.renderText({ ctx, text: 'Bahn ' + (k + 1), x: aim.x + aim.w / 2, y: aim.y + (aim.h * (k + 0.5)) / 3 + 10, fontSize: '26px', fillStyle: PAL.dim });
    });
    util.renderText({ ctx, text: 'SCHIESSEN: Bahn anleuchten', x: aim.x + aim.w / 2, y: aim.y + aim.h + 34, fontSize: '26px', fillStyle: colDef });
    const vN = att === 'N' ? reached + '/' + NEED : Math.max(0, Math.ceil(DURATION - time)) + 's';
    const vS = att === 'S' ? reached + '/' + NEED : Math.max(0, Math.ceil(DURATION - time)) + 's';
    btaBar(ctx, time / DURATION, vN, vS, 'FORT-STURM · ' + (att === 'N' ? 'Nord' : 'Süd') + ' stürmt, ' + (def === 'N' ? 'Nord' : 'Süd') + ' hält');
  }

  return {
    id: 'fortsturm',
    title: 'Fort-Sturm',
    hint: 'Angreifer: Leitern an die Mauer ziehen, STURM füllen. Verteidiger: Bahn anleuchten = schießen, Leiter-Kopf anleuchten = umstoßen!',
    update,
  };
}

// =========================================================================================================
// Schlachten 3–4 (Chunk bt-B): Zugüberfall, Brückensprengung
// Gemeinsame Helfer mit Präfix btb…, Zugüberfall zu…, Brückensprengung bs…
//
// Beide Teams spielen gleichzeitig: NORD (Mandelbrotien) nur über Pads in der LINKEN Hälfte (x < MID),
// SÜD (Juliana) über Pads in der RECHTEN Hälfte. Pads sind schwarz mit Kontur, Füllring außen.
// Interferenz (laser-chris): Laser sind nicht unterscheidbar – wer die Pads des Gegners anleuchtet, löst
// dessen Aktion aus und hilft ihm damit; Sabotage lohnt dort nicht. Bewusst offen (= embraced) sind die
// Objekte in der Mitte: Pulverfass greifen kann JEDER, Pioniere verscheuchen kann JEDER.
// Tasten: K hält alle Nord-Aktionen, L alle Süd-Aktionen (Test ohne Laser).
// =========================================================================================================

function btbTeamColor(team, dim) {
  if (team === 'N') return dim ? PAL.nordDim : PAL.nord;
  return dim ? PAL.suedDim : PAL.sued;
}

function btbOther(team) {
  return team === 'N' ? 'S' : 'N';
}

// Füllrate je nach Truppenstärke (1..10): stärkere Armee füllt etwas schneller, gedeckelt
function btbSpeed(strength) {
  return 70 + clamp(strength || 5, 1, 10) * 6;
}

// Pad-Positionen: 3 Plätze unten in der Team-Hälfte
function btbPadX(team, i) {
  return team === 'N' ? 200 + i * 260 : 1200 + i * 260;
}

function btbMakePad(x, y, r, team, label, speed) {
  var b = guiPixelFillButton({
    label: '',
    posX: x,
    posY: y,
    radius: r,
    speedUp: speed || 90,
    speedDown: 45,
    fullPercent: 20,
    edges: 32,
    activeValue: 100,
    minValue: 0,
    visible: false,
  });
  return { b: b, x: x, y: y, r: r, team: team, label: label, v: 0, cd: 0, cdMax: 1 };
}

// pro Frame: messen, Testhilfe, Abklingzeit; liefert Füllstand 0..100
function btbPadUpdate(p, grid, dt, helper) {
  p.b.handle(grid, dt);
  if (helper) p.b.setValue(Math.min(100, p.b.getValue() + 150 * dt));
  if (p.cd > 0) {
    p.cd -= dt;
    p.b.setValue(0);
  }
  p.v = clamp(p.b.getValue(), 0, 100);
  return p.v;
}

function btbPadFire(p, cooldown) {
  p.b.setValue(0);
  p.v = 0;
  p.cd = cooldown || 0;
  p.cdMax = Math.max(0.01, cooldown || 1);
}

function btbPadDraw(ctx, p, t, hint) {
  var col = btbTeamColor(p.team);
  ctx.save();
  darkDisk(ctx, p.x, p.y, p.r);
  ctx.strokeStyle = p.cd > 0 ? btbTeamColor(p.team, true) : col;
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
  ctx.stroke();
  if (p.cd > 0) {
    ctx.strokeStyle = btbTeamColor(p.team, true);
    ctx.lineWidth = 6;
    ctx.beginPath();
    ctx.arc(p.x, p.y, p.r + 12, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * (1 - p.cd / p.cdMax));
    ctx.stroke();
  } else if (p.v > 0) {
    ctx.strokeStyle = col;
    ctx.lineWidth = 10;
    ctx.beginPath();
    ctx.arc(p.x, p.y, p.r + 12, -Math.PI / 2, -Math.PI / 2 + (Math.PI * 2 * p.v) / 100);
    ctx.stroke();
  }
  if (hint) {
    ctx.globalAlpha = 0.5 + 0.5 * Math.sin(t * 8);
    ctx.strokeStyle = PAL.warn;
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(p.x, p.y, p.r + 26, 0, Math.PI * 2);
    ctx.stroke();
    ctx.globalAlpha = 1;
  }
  ctx.restore();
  util.renderText({ ctx: ctx, text: p.label, x: p.x, y: p.y - p.r - 30, fontSize: '28px', fillStyle: p.cd > 0 ? PAL.dim : col });
}

// Figur: Füße bei (x, y). Nord = Apfelmännchen mit Pickelhaube, Süd = Spiralkringel mit Strohhut.
function btbFigure(ctx, x, y, s, team, t, duck) {
  var col = btbTeamColor(team);
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(s, duck ? s * 0.6 : s);
  ctx.strokeStyle = col;
  ctx.fillStyle = PAL.dark;
  ctx.lineWidth = 3;
  var sw = Math.sin(t * 12) * 8;
  ctx.beginPath();
  ctx.moveTo(-4, -26);
  ctx.lineTo(-6 + sw, 0);
  ctx.moveTo(4, -26);
  ctx.lineTo(6 - sw, 0);
  ctx.stroke();
  if (team === 'N') {
    // Hauptkörper (Kardioide angedeutet) + Kopf-Knospe + Mini-Knospen
    ctx.beginPath();
    ctx.arc(0, -42, 17, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(0, -66, 9, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(-19, -46, 4, 0, Math.PI * 2);
    ctx.arc(19, -46, 4, 0, Math.PI * 2);
    ctx.stroke();
    // Pickelhaube
    ctx.beginPath();
    ctx.arc(0, -70, 10, Math.PI, 0);
    ctx.moveTo(0, -80);
    ctx.lineTo(0, -92);
    ctx.stroke();
  } else {
    // Spiralkörper
    ctx.beginPath();
    for (var k = 0; k < 40; k++) {
      var a = k * 0.45 + t * 2;
      var r = 1 + k * 0.42;
      var px = Math.cos(a) * r;
      var py = -42 + Math.sin(a) * r;
      if (k === 0) ctx.moveTo(px, py);
      else ctx.lineTo(px, py);
    }
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(0, -66, 9, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    // Strohhut
    ctx.beginPath();
    ctx.ellipse(0, -73, 18, 4, 0, 0, Math.PI * 2);
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(0, -74, 8, Math.PI, 0);
    ctx.stroke();
  }
  ctx.restore();
}

function btbTimer(ctx, left, total) {
  var w = 700;
  var x = W / 2 - w / 2;
  var y = TOP + 18;
  ctx.save();
  ctx.strokeStyle = PAL.dim;
  ctx.lineWidth = 2;
  ctx.strokeRect(x, y, w, 14);
  ctx.fillStyle = left < 8 ? PAL.warn : PAL.accent;
  ctx.fillRect(x + 2, y + 2, Math.max(0, (w - 4) * clamp(left / total, 0, 1)), 10);
  ctx.restore();
  util.renderText({ ctx: ctx, text: Math.ceil(Math.max(0, left)) + ' s', x: x + w + 40, y: y + 14, fontSize: '26px', fillStyle: PAL.dim });
}

function btbBanner(ctx, text, color, y) {
  util.renderText({ ctx: ctx, text: text, x: W / 2, y: y || 300, fontSize: '72px', fillStyle: color || PAL.text });
}

function btbTeamLabels(ctx, attacker) {
  util.renderText({ ctx: ctx, text: attacker === 'N' ? 'NORD greift an' : 'NORD verteidigt', x: 240, y: TOP + 70, fontSize: '30px', fillStyle: PAL.nord });
  util.renderText({ ctx: ctx, text: attacker === 'S' ? 'SÜD greift an' : 'SÜD verteidigt', x: W - 240, y: TOP + 70, fontSize: '30px', fillStyle: PAL.sued });
  ctx.save();
  ctx.strokeStyle = PAL.dim;
  ctx.globalAlpha = 0.35;
  ctx.setLineDash([10, 14]);
  ctx.beginPath();
  ctx.moveTo(MID, TOP + 760);
  ctx.lineTo(MID, H);
  ctx.stroke();
  ctx.restore();
}

function btbResult(winner, lossN, lossS, text) {
  return { winner: winner, lossN: Math.max(0, Math.round(lossN)), lossS: Math.max(0, Math.round(lossS)), text: text };
}

// =========================================================================================================
// 3. ZUGÜBERFALL
// Der Iterations-Zug des Verteidigers rast nach rechts (Seitenansicht, Landschaft scrollt). Der Räuber der
// Angreifer läuft vom letzten Waggon zur Lok:
//   Angreifer-Pads: LAUFEN (halten = rennen / Wächter schubsen), SPRUNG (laden, an der Waggonlücke springt
//   er), DUCKEN (halten, wenn eine Brücke kommt).
//   Verteidiger-Pads: WÄCHTER (stellt einen Wächter vor den Räuber), BRÜCKE (niedrige Brücke rauscht heran).
// Lok erreicht → Angreifer gewinnt. 3× von der Brücke erwischt oder Zeit um → Verteidiger gewinnt.
// =========================================================================================================

function btZugueberfall(opts) {
  var level = clamp(opts.level || 0, 0, 2);
  var att = opts.attacker === 'S' ? 'S' : 'N';
  var def = btbOther(att);
  var strength = { N: opts.strengthN || 5, S: opts.strengthS || 5 };
  var total = 45 + level * 5;
  var left = total;
  var t = 0;
  var done = null;
  var endTimer = 0;
  var delivered = false;

  var TRAIN_Y = 560; // Oberkante der Waggondächer
  var nWagons = 4 + level;
  var locoW = 260;
  var gap = 26;
  var x0 = 120;
  var x1 = W - 120;
  var wagonW = (x1 - x0 - locoW - gap * nWagons) / nWagons;
  var wagons = [];
  for (var i = 0; i < nWagons; i++) {
    var wx = x0 + i * (wagonW + gap);
    wagons.push({ x0: wx, x1: wx + wagonW });
  }
  var locoX0 = x0 + nWagons * (wagonW + gap);

  var runner = { x: wagons[0].x0 + 30, jump: 0, jumpFrom: 0, jumpTo: 0, knocks: 0, duck: false, flash: 0 };
  var guards = []; // { x, hp, fall }
  var bridge = null; // { warn, x }

  var spd = { att: btbSpeed(strength[att]), def: btbSpeed(strength[def]) };
  var padRun = btbMakePad(btbPadX(att, 0), 900, 80, att, 'LAUFEN', spd.att);
  var padJump = btbMakePad(btbPadX(att, 1), 900, 80, att, 'SPRUNG', spd.att);
  var padDuck = btbMakePad(btbPadX(att, 2), 900, 80, att, 'DUCKEN', spd.att * 1.4);
  var padGuard = btbMakePad(btbPadX(def, att === 'N' ? 0 : 2), 900, 80, def, 'WÄCHTER', spd.def);
  var padBridge = btbMakePad(btbPadX(def, 1), 900, 80, def, 'BRÜCKE', spd.def);
  var pads = [padRun, padJump, padDuck, padGuard, padBridge];

  function wagonIndexAt(x) {
    for (var k = 0; k < wagons.length; k++) if (x <= wagons[k].x1 + 1) return k;
    return wagons.length;
  }
  function edgeAhead() {
    var k = wagonIndexAt(runner.x);
    return k < wagons.length ? wagons[k].x1 - 12 : locoX0 + locoW;
  }
  function nextStart() {
    var k = wagonIndexAt(runner.x);
    return k + 1 < wagons.length ? wagons[k + 1].x0 + 14 : locoX0 + 14;
  }

  function knockBack() {
    runner.knocks++;
    runner.flash = 0.6;
    addShake(14);
    playSound(SND.hit, 0.6);
    burst(runner.x, TRAIN_Y - 40, btbTeamColor(att), 18, 280);
    addFloater(runner.x, TRAIN_Y - 120, 'AUA! ' + runner.knocks + '/3', PAL.bad);
    var k = wagonIndexAt(runner.x);
    var back = Math.max(0, k - 1);
    runner.x = wagons[back].x0 + 30;
    runner.jump = 0;
  }

  function finish(winner) {
    if (done) return;
    var attWin = winner === att;
    var lossAtt = attWin ? 0 : 2 + level;
    var lossDef = attWin ? 2 + level : runner.knocks >= 3 ? 0 : 1;
    var text = attWin
      ? 'Iterationen erbeutet! Der Zug war eh nur eine Teilmenge.'
      : runner.knocks >= 3
      ? 'Runtergefallen! Der Räuber divergiert jetzt neben den Gleisen.'
      : 'Zug weg! Fahrplan konvergiert, Räuber guckt dumm aus der Wäsche.';
    done = btbResult(winner, att === 'N' ? lossAtt : lossDef, att === 'S' ? lossAtt : lossDef, text);
    endTimer = 1.6;
    playSound(attWin ? SND.win : SND.error, 0.7);
    if (attWin) burst(locoX0 + locoW / 2, TRAIN_Y - 40, PAL.glow, 60, 420);
    addShake(attWin ? 10 : 18);
  }

  function update(grid, dt, ctx) {
    t += dt;
    if (done) {
      endTimer -= dt;
      drawScene(ctx);
      btbBanner(ctx, done.winner === 'N' ? 'NORD GEWINNT!' : 'SÜD GEWINNT!', btbTeamColor(done.winner), 330);
      if (endTimer <= 0 && !delivered) {
        delivered = true;
        return done;
      }
      return null;
    }
    left -= dt;

    var helpAtt = isKeyDown(att === 'N' ? 'KeyK' : 'KeyL');
    var helpDef = isKeyDown(def === 'N' ? 'KeyK' : 'KeyL');
    var atEdge = runner.jump <= 0 && runner.x >= edgeAhead() - 2 && wagonIndexAt(runner.x) < wagons.length;

    var vRun = btbPadUpdate(padRun, grid, dt, helpAtt);
    var vJump = btbPadUpdate(padJump, grid, dt, helpAtt && atEdge);
    var vDuck = btbPadUpdate(padDuck, grid, dt, helpAtt && bridge && bridge.warn < 0.9);
    btbPadUpdate(padGuard, grid, dt, helpDef);
    btbPadUpdate(padBridge, grid, dt, helpDef);

    // Verteidiger-Aktionen
    if (padGuard.v >= 100) {
      btbPadFire(padGuard, 6 - level);
      var k = wagonIndexAt(runner.x);
      var target = Math.min(k + 1, wagons.length - 1);
      if (k < wagons.length) {
        guards.push({ x: (wagons[target].x0 + wagons[target].x1) / 2 + (target === k ? 60 : 0), hp: 100, fall: 0 });
        playSound(SND.click, 0.5);
        addFloater(wagons[target].x0 + wagonW / 2, TRAIN_Y - 130, 'WÄCHTER!', btbTeamColor(def));
      }
    }
    if (padBridge.v >= 100 && !bridge) {
      btbPadFire(padBridge, 8 - level);
      bridge = { warn: 2.4 - level * 0.3 };
      playSound(SND.sonar, 0.5);
    }

    // Räuber
    runner.flash = Math.max(0, runner.flash - dt);
    runner.duck = vDuck >= 50;
    if (runner.jump > 0) {
      runner.jump -= dt;
      var f = clamp(1 - runner.jump / 0.55, 0, 1);
      runner.x = lerp(runner.jumpFrom, runner.jumpTo, f);
    } else {
      var blocker = null;
      guards.forEach(function (g) {
        if (g.fall <= 0 && g.x > runner.x && g.x - runner.x < 70) blocker = g;
      });
      var speed = (vRun / 100) * (240 + strength[att] * 8) * (runner.duck ? 0.25 : 1);
      if (blocker) {
        // schubsen: Laufen-Pad drückt, sonst schiebt der Wächter zurück
        blocker.hp -= (vRun / 100) * (55 + strength[att] * 3) * dt;
        if (vRun < 30) runner.x -= 40 * dt;
        if (blocker.hp <= 0) {
          blocker.fall = 1;
          playSound(SND.plop, 0.6);
          burst(blocker.x, TRAIN_Y - 40, btbTeamColor(def), 16, 260);
          addFloater(blocker.x, TRAIN_Y - 120, 'Wächter fraktal zerbröselt!', btbTeamColor(att));
        }
      } else {
        runner.x = Math.min(edgeAhead(), runner.x + speed * dt);
      }
      runner.x = Math.max(wagons[0].x0 + 20, runner.x);
      // geduckt wird nicht gesprungen – sonst gewinnt „alle drei Pads dauerhaft anleuchten“ ohne jedes Risiko
      if (atEdge && vJump >= 60 && !runner.duck) {
        runner.jump = 0.55;
        runner.jumpFrom = runner.x;
        runner.jumpTo = nextStart();
        btbPadFire(padJump, 0);
        playSound(SND.click, 0.4);
      }
    }
    guards.slice().forEach(function (g) {
      if (g.fall > 0) {
        g.fall -= dt;
        if (g.fall <= 0) guards.splice(guards.indexOf(g), 1);
      }
    });

    // Brücke
    if (bridge) {
      bridge.warn -= dt;
      if (bridge.warn <= 0) {
        if (runner.duck) {
          addFloater(runner.x, TRAIN_Y - 130, 'Geduckt! Selbstähnlich flach!', PAL.good);
          playSound(SND.pickup, 0.4);
        } else {
          knockBack();
        }
        bridge = null;
      }
    }

    if (runner.knocks >= 3) finish(def);
    else if (runner.x >= locoX0 + 10) finish(att);
    else if (left <= 0) finish(def);

    drawScene(ctx);
    btbTimer(ctx, left, total);
    btbTeamLabels(ctx, att);
    btbPadDraw(ctx, padRun, t, false);
    btbPadDraw(ctx, padJump, t, atEdge);
    btbPadDraw(ctx, padDuck, t, !!bridge);
    btbPadDraw(ctx, padGuard, t, false);
    btbPadDraw(ctx, padBridge, t, false);
    return null;
  }

  function drawScene(ctx) {
    var scroll = (t * 600) % 160;
    ctx.save();
    // ferne Hügel (selbstähnliche Zacken)
    ctx.strokeStyle = PAL.dim;
    ctx.globalAlpha = 0.35;
    ctx.lineWidth = 2;
    ctx.beginPath();
    for (var x = -160; x <= W + 160; x += 20) {
      var xx = x - ((t * 120) % 160);
      var y = 330 + Math.sin(xx * 0.01) * 30 + Math.sin(xx * 0.037) * 12 + Math.sin(xx * 0.11) * 4;
      if (x === -160) ctx.moveTo(xx, y);
      else ctx.lineTo(xx, y);
    }
    ctx.stroke();
    ctx.globalAlpha = 1;
    // Gleis
    ctx.strokeStyle = PAL.ground;
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.moveTo(0, TRAIN_Y + 92);
    ctx.lineTo(W, TRAIN_Y + 92);
    ctx.stroke();
    ctx.lineWidth = 3;
    for (var sx = -scroll; sx < W; sx += 160) {
      ctx.beginPath();
      ctx.moveTo(sx, TRAIN_Y + 92);
      ctx.lineTo(sx + 30, TRAIN_Y + 104);
      ctx.stroke();
    }
    // Waggons
    var dc = btbTeamColor(def);
    ctx.lineWidth = 3;
    wagons.forEach(function (w, i) {
      ctx.fillStyle = PAL.dark;
      ctx.strokeStyle = dc;
      ctx.fillRect(w.x0, TRAIN_Y, w.x1 - w.x0, 70);
      ctx.strokeRect(w.x0, TRAIN_Y, w.x1 - w.x0, 70);
      util.renderText({ ctx: ctx, text: i % 2 ? 'z²+c' : '∞ Iter.', x: (w.x0 + w.x1) / 2, y: TRAIN_Y + 46, fontSize: '24px', fillStyle: btbTeamColor(def, true) });
      [w.x0 + 30, w.x1 - 30].forEach(function (cx) {
        ctx.beginPath();
        ctx.arc(cx, TRAIN_Y + 80, 13, 0, Math.PI * 2);
        ctx.stroke();
        var a = -t * 20;
        ctx.beginPath();
        ctx.moveTo(cx + Math.cos(a) * 13, TRAIN_Y + 80 + Math.sin(a) * 13);
        ctx.lineTo(cx - Math.cos(a) * 13, TRAIN_Y + 80 - Math.sin(a) * 13);
        ctx.stroke();
      });
      if (i > 0) {
        ctx.beginPath();
        ctx.moveTo(wagons[i - 1].x1, TRAIN_Y + 55);
        ctx.lineTo(w.x0, TRAIN_Y + 55);
        ctx.stroke();
      }
    });
    // Lok
    ctx.fillStyle = PAL.dark;
    ctx.strokeStyle = dc;
    ctx.fillRect(locoX0, TRAIN_Y - 30, locoW, 100);
    ctx.strokeRect(locoX0, TRAIN_Y - 30, locoW, 100);
    ctx.strokeRect(locoX0 + 20, TRAIN_Y - 90, 70, 60);
    ctx.strokeRect(locoX0 + locoW - 70, TRAIN_Y - 75, 30, 45);
    for (var p = 0; p < 4; p++) {
      var age = (t * 1.6 + p * 0.25) % 1;
      ctx.globalAlpha = (1 - age) * 0.6;
      ctx.beginPath();
      ctx.arc(locoX0 + locoW - 55 - age * 220, TRAIN_Y - 90 - age * 90, 12 + age * 30, 0, Math.PI * 2);
      ctx.stroke();
    }
    ctx.globalAlpha = 1;
    util.renderText({ ctx: ctx, text: 'LOK', x: locoX0 + locoW / 2, y: TRAIN_Y + 30, fontSize: '30px', fillStyle: dc });
    // Brücke rauscht heran
    if (bridge) {
      var bx = runner.x + Math.max(0, bridge.warn) * 500;
      ctx.strokeStyle = PAL.warn;
      ctx.lineWidth = 6;
      ctx.beginPath();
      ctx.moveTo(bx - 60, TRAIN_Y - 75);
      ctx.lineTo(bx + 60, TRAIN_Y - 75);
      ctx.moveTo(bx - 50, TRAIN_Y - 75);
      ctx.lineTo(bx - 50, TRAIN_Y - 200);
      ctx.moveTo(bx + 50, TRAIN_Y - 75);
      ctx.lineTo(bx + 50, TRAIN_Y - 200);
      ctx.stroke();
      util.renderText({ ctx: ctx, text: 'BRÜCKE! DUCKEN!', x: W / 2, y: 250, fontSize: '56px', fillStyle: PAL.warn });
    }
    // Wächter
    guards.forEach(function (g) {
      var fy = g.fall > 0 ? (1 - g.fall) * 300 : 0;
      btbFigure(ctx, g.x + (g.fall > 0 ? (1 - g.fall) * 120 : 0), TRAIN_Y + fy, 1.3, def, t * 0.3, false);
      if (g.fall <= 0) {
        ctx.strokeStyle = btbTeamColor(def);
        ctx.lineWidth = 6;
        ctx.beginPath();
        ctx.moveTo(g.x - 40, TRAIN_Y - 140);
        ctx.lineTo(g.x - 40 + (80 * g.hp) / 100, TRAIN_Y - 140);
        ctx.stroke();
      }
    });
    // Räuber
    var jy = runner.jump > 0 ? -Math.sin(clamp(1 - runner.jump / 0.55, 0, 1) * Math.PI) * 90 : 0;
    if (runner.flash <= 0 || Math.sin(t * 40) > 0) btbFigure(ctx, runner.x, TRAIN_Y + jy, 1.3, att, t, runner.duck);
    ctx.restore();
  }

  return {
    id: 'zugueberfall',
    title: 'Zugüberfall',
    hint:
      (att === 'N' ? 'NORD' : 'SÜD') +
      ' entert den Iterations-Zug: LAUFEN halten, SPRUNG an der Lücke, DUCKEN bei Brücken. ' +
      (def === 'N' ? 'NORD' : 'SÜD') +
      ' schickt Wächter und Brücken!',
    update: update,
  };
}

// =========================================================================================================
// 4. BRÜCKENSPRENGUNG
// Eine Brücke über die Schlucht in der Mitte. Die Angreifer tragen das Pulverfass (guiDragHandle – greifen
// kann JEDER, auch der Gegner: Interferenz erlaubt) von ihrer Seite auf die Brückenmitte und füllen dann den
// ZÜNDER. Die Lunte brennt 2,5 s – wird das Fass in der Zeit weggezogen, geht sie aus.
// Verteidiger: PIONIERE-Pad schickt Pioniere, die das Fass zurückrollen und die Lunte austreten (Pioniere
// lassen sich von JEDEM verscheuchen, indem man sie voll anleuchtet). KANONE: alle Verteidiger-Laser im
// oberen Feld ihrer Hälfte bündeln (aimTurret, Fokus) → Schuss friert das Fass kurz ein.
// Explosion → Angreifer gewinnt. Zeit um → Verteidiger gewinnt.
// =========================================================================================================

function btBrueckensprengung(opts) {
  var level = clamp(opts.level || 0, 0, 2);
  var att = opts.attacker === 'S' ? 'S' : 'N';
  var def = btbOther(att);
  var strength = { N: opts.strengthN || 5, S: opts.strengthS || 5 };
  var total = 50 + level * 5;
  var left = total;
  var t = 0;
  var done = null;
  var endTimer = 0;
  var delivered = false;

  var GROUND = 700;
  var GORGE0 = 760;
  var GORGE1 = 1160;
  var MIDX = W / 2;
  var KEG_Y = GROUND - 60;
  var attSign = att === 'N' ? -1 : 1; // Richtung zur Angreiferseite
  var kegStartX = att === 'N' ? 330 : W - 330;

  var keg = guiDragHandle({
    posX: kegStartX,
    posY: KEG_Y,
    radius: 60,
    grabSpeed: 110 + strength[att] * 4,
    fullPercent: 22,
    dropDelay: 0.5,
    maxSpeed: 700,
    snapPoints: [{ x: MIDX, y: KEG_Y }],
    snapDistance: 110,
    visible: false,
  });
  var frozen = 0;
  var fuse = 0; // > 0 = Lunte brennt
  var push = null; // { from, to, t }

  var spd = { att: btbSpeed(strength[att]), def: btbSpeed(strength[def]) };
  var padFuse = btbMakePad(btbPadX(att, 1), 920, 80, att, 'ZÜNDER', spd.att);
  var padPio = btbMakePad(btbPadX(def, 1), 920, 80, def, 'PIONIERE', spd.def);
  var pioneers = []; // { x, b (pixelFillButton), flee }

  // Kanone: Scanbereich oben in der Verteidiger-Hälfte
  var scan = { x: def === 'N' ? 60 : MID + 60, y: TOP + 110, w: MID - 120, h: 300 };
  var turret = guiAimTurret({
    posX: def === 'N' ? 120 : W - 120,
    posY: GROUND - 40,
    scanX: scan.x,
    scanY: scan.y,
    scanWidth: scan.w,
    scanHeight: scan.h,
    focusSpread: 260,
    visible: false,
  });
  var charge = 0;
  var cannonCd = 0;
  var shotFx = 0;

  function kegNearMiddle() {
    return Math.abs(keg.getX() - MIDX) < 70 && Math.abs(keg.getY() - KEG_Y) < 70;
  }

  function finish(winner) {
    if (done) return;
    var attWin = winner === att;
    var text = attWin
      ? 'KAWUMM! Die Brücke ist jetzt Cantor-Staub. Überall Löcher, nix mehr da.'
      : 'Lunte aus! Das Pulver war nur komplex, nicht reell. Pfft.';
    var lossAtt = attWin ? 1 : 2 + level;
    var lossDef = attWin ? 2 + level : 1;
    done = btbResult(winner, att === 'N' ? lossAtt : lossDef, att === 'S' ? lossAtt : lossDef, text);
    endTimer = 1.8;
    if (attWin) {
      playSound(SND.boom, 0.9);
      addShake(30);
      for (var i = 0; i < 4; i++) burst(MIDX + (i - 1.5) * 90, GROUND - 20, i % 2 ? PAL.warn : PAL.glow, 40, 520);
    } else {
      playSound(SND.error, 0.7);
    }
  }

  function update(grid, dt, ctx) {
    t += dt;
    if (done) {
      endTimer -= dt;
      drawScene(ctx);
      btbBanner(ctx, done.winner === 'N' ? 'NORD GEWINNT!' : 'SÜD GEWINNT!', btbTeamColor(done.winner), 330);
      if (endTimer <= 0 && !delivered) {
        delivered = true;
        return done;
      }
      return null;
    }
    left -= dt;
    var helpAtt = isKeyDown(att === 'N' ? 'KeyK' : 'KeyL');
    var helpDef = isKeyDown(def === 'N' ? 'KeyK' : 'KeyL');

    // Fass: Laser greifen (jeder!), Testhilfe schiebt es zur Mitte
    if (frozen > 0) {
      frozen -= dt;
      if (frozen <= 0) keg.setEnabled(true);
    }
    keg.handle(grid, dt);
    if (helpAtt && frozen <= 0 && !push) {
      var dx = MIDX - keg.getX();
      var dy = KEG_Y - keg.getY();
      var d = Math.sqrt(dx * dx + dy * dy);
      if (d > 4) {
        var st = Math.min(d, 320 * dt);
        keg.setX(keg.getX() + (dx / d) * st);
        keg.setY(keg.getY() + (dy / d) * st);
      }
    }
    if (!keg.isGrabbed() && !helpAtt) {
      // abgelegt: fällt zurück auf Boden/Brücke
      keg.setY(keg.getY() + (KEG_Y - keg.getY()) * Math.min(1, 8 * dt));
    }
    if (push) {
      push.t += dt;
      var pf = clamp(push.t / 0.8, 0, 1);
      keg.setX(lerp(push.from, push.to, pf));
      if (pf >= 1) push = null;
    }

    // Zünder
    var vFuse = btbPadUpdate(padFuse, grid, dt, helpAtt && kegNearMiddle());
    if (fuse <= 0 && vFuse >= 100) {
      btbPadFire(padFuse, 1.5);
      if (kegNearMiddle()) {
        fuse = 2.5;
        playSound(SND.click, 0.6);
        addFloater(MIDX, KEG_Y - 120, 'LUNTE BRENNT!', PAL.warn);
      } else {
        addFloater(padFuse.x, padFuse.y - 150, 'Fass erst auf die Brücke!', PAL.bad);
        playSound(SND.error, 0.4);
      }
    }
    if (fuse > 0) {
      if (!kegNearMiddle()) {
        fuse = 0;
        addFloater(keg.getX(), KEG_Y - 120, 'Lunte aus!', PAL.good);
      } else {
        fuse -= dt;
        if (Math.random() < 0.6) burst(keg.getX() + 20, KEG_Y - 70, PAL.warn, 2, 120);
        if (fuse <= 0) finish(att);
      }
    }

    // Pioniere
    btbPadUpdate(padPio, grid, dt, helpDef);
    if (padPio.v >= 100) {
      btbPadFire(padPio, 4.5 - level);
      var startX = def === 'N' ? 60 : W - 60;
      var b = guiPixelFillButton({
        label: '',
        posX: startX,
        posY: GROUND - 50,
        radius: 55,
        speedUp: 90,
        speedDown: 30,
        fullPercent: 20,
        edges: 24,
        activeValue: 100,
        minValue: 0,
        visible: false,
      });
      pioneers.push({ x: startX, b: b, flee: 0 });
      playSound(SND.plop, 0.5);
    }
    var pioSpeed = 110 + level * 25 + strength[def] * 4;
    pioneers.slice().forEach(function (p) {
      if (p.flee > 0) {
        p.flee -= dt;
        p.x -= attSign * 380 * dt; // läuft zur eigenen Seite zurück
        if (p.flee <= 0) pioneers.splice(pioneers.indexOf(p), 1);
        return;
      }
      var dir = keg.getX() > p.x ? 1 : -1;
      p.x += dir * pioSpeed * dt;
      p.b.setX(p.x);
      p.b.handle(grid, dt);
      if (p.b.getValue() >= 100) {
        p.flee = 0.9;
        addFloater(p.x, GROUND - 160, 'Iiih, Licht!', PAL.text);
        playSound(SND.hit, 0.4);
        return;
      }
      if (Math.abs(p.x - keg.getX()) < 60 && !keg.isGrabbed() && !push) {
        // Fass zurückrollen + Lunte austreten
        var to = clamp(keg.getX() + attSign * 300, 120, W - 120);
        push = { from: keg.getX(), to: to, t: 0 };
        if (fuse > 0) {
          fuse = 0;
          addFloater(keg.getX(), KEG_Y - 140, 'Lunte ausgetreten!', btbTeamColor(def));
        }
        playSound(SND.splash, 0.5);
        p.flee = 0.9;
      }
    });

    // Kanone (Teamwork: Fokus der Verteidiger-Laser)
    turret.handle(grid, dt);
    if (cannonCd > 0) cannonCd -= dt;
    else {
      if (helpDef) charge += dt;
      else if (turret.hasTarget() && turret.getFocus() > 0.45) charge += dt * turret.getFocus();
      else charge = Math.max(0, charge - dt * 0.5);
      if (charge >= 1.6) {
        charge = 0;
        cannonCd = 5;
        shotFx = 0.4;
        frozen = 2.5;
        if (keg.isGrabbed()) keg.drop();
        keg.setEnabled(false);
        playSound(SND.shot, 0.7);
        addShake(8);
        burst(keg.getX(), KEG_Y, PAL.bad, 14, 260);
        addFloater(keg.getX(), KEG_Y - 130, 'BUMM! Fass eingefroren', btbTeamColor(def));
      }
    }
    shotFx = Math.max(0, shotFx - dt);

    if (left <= 0) finish(def);

    drawScene(ctx);
    btbTimer(ctx, left, total);
    btbTeamLabels(ctx, att);
    btbPadDraw(ctx, padFuse, t, kegNearMiddle() && fuse <= 0);
    btbPadDraw(ctx, padPio, t, false);
    drawCannonZone(ctx);
    return null;
  }

  function drawCannonZone(ctx) {
    var col = btbTeamColor(def);
    ctx.save();
    ctx.fillStyle = PAL.dark;
    ctx.fillRect(scan.x, scan.y, scan.w, scan.h);
    ctx.strokeStyle = cannonCd > 0 ? btbTeamColor(def, true) : col;
    ctx.lineWidth = 3;
    ctx.setLineDash([14, 10]);
    ctx.strokeRect(scan.x, scan.y, scan.w, scan.h);
    ctx.setLineDash([]);
    if (turret.hasTarget() && cannonCd <= 0) {
      var tx = turret.getTargetX();
      var ty = turret.getTargetY();
      var r = 30 + (1 - turret.getFocus()) * 90;
      ctx.beginPath();
      ctx.arc(tx, ty, r, 0, Math.PI * 2);
      ctx.moveTo(tx - r - 15, ty);
      ctx.lineTo(tx + r + 15, ty);
      ctx.moveTo(tx, ty - r - 15);
      ctx.lineTo(tx, ty + r + 15);
      ctx.stroke();
    }
    ctx.lineWidth = 8;
    ctx.beginPath();
    ctx.moveTo(scan.x + 20, scan.y + scan.h - 16);
    ctx.lineTo(scan.x + 20 + (scan.w - 40) * clamp(charge / 1.6, 0, 1), scan.y + scan.h - 16);
    ctx.stroke();
    ctx.restore();
    util.renderText({
      ctx: ctx,
      text: cannonCd > 0 ? 'KANONE lädt nach …' : 'KANONE – alle zusammen auf einen Punkt!',
      x: scan.x + scan.w / 2,
      y: scan.y + 40,
      fontSize: '28px',
      fillStyle: col,
    });
  }

  function drawScene(ctx) {
    ctx.save();
    // Klippen (Ränder mit selbstähnlichen Zacken)
    ctx.strokeStyle = PAL.ground;
    ctx.fillStyle = PAL.dark;
    ctx.lineWidth = 3;
    [[0, GORGE0], [GORGE1, W]].forEach(function (c) {
      ctx.beginPath();
      ctx.moveTo(c[0], H);
      ctx.lineTo(c[0], GROUND);
      ctx.lineTo(c[1], GROUND);
      var edge = c[1] === GORGE0 ? GORGE0 : GORGE1;
      for (var y = GROUND; y <= H; y += 18) {
        var j = Math.sin(y * 0.09) * 14 + Math.sin(y * 0.27) * 6;
        ctx.lineTo(edge + (c[1] === GORGE0 ? j : -j), y);
      }
      ctx.lineTo(c[0], H);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
    });
    // Brücke (Planken + Seile); nach Sprengung Lücke
    var broken = done && done.winner === att;
    ctx.strokeStyle = PAL.ground;
    for (var x = GORGE0 - 20; x < GORGE1 + 20; x += 34) {
      if (broken && Math.abs(x - MIDX) < 130) continue;
      var sag = Math.sin(((x - GORGE0) / (GORGE1 - GORGE0)) * Math.PI) * 18;
      ctx.strokeRect(x, GROUND + sag - 6, 28, 12);
    }
    ctx.beginPath();
    for (var x2 = GORGE0 - 20; x2 <= GORGE1 + 20; x2 += 20) {
      if (broken && Math.abs(x2 - MIDX) < 130) {
        ctx.moveTo(x2 + 20, GROUND - 40);
        continue;
      }
      var sag2 = Math.sin(((x2 - GORGE0) / (GORGE1 - GORGE0)) * Math.PI) * 18;
      ctx.lineTo(x2, GROUND - 40 + sag2);
    }
    ctx.stroke();
    // Ziel-Markierung Brückenmitte
    ctx.setLineDash([8, 10]);
    ctx.strokeStyle = btbTeamColor(att, true);
    ctx.beginPath();
    ctx.arc(MIDX, KEG_Y, 75, 0, Math.PI * 2);
    ctx.stroke();
    ctx.setLineDash([]);
    // Fass (dunkel, Kontur) – Aktionsfläche
    var kx = keg.getX();
    var ky = keg.getY();
    if (!broken) {
      darkDisk(ctx, kx, ky, 60);
      ctx.strokeStyle = frozen > 0 ? PAL.dim : btbTeamColor(att);
      ctx.lineWidth = keg.isGrabbed() ? 6 : 4;
      ctx.beginPath();
      ctx.ellipse(kx, ky, 40, 52, 0, 0, Math.PI * 2);
      ctx.moveTo(kx - 38, ky - 18);
      ctx.lineTo(kx + 38, ky - 18);
      ctx.moveTo(kx - 38, ky + 18);
      ctx.lineTo(kx + 38, ky + 18);
      ctx.stroke();
      util.renderText({ ctx: ctx, text: 'PULVER', x: kx, y: ky + 8, fontSize: '18px', fillStyle: ctx.strokeStyle });
      if (!keg.isGrabbed() && keg.getValue() > 0) {
        ctx.lineWidth = 8;
        ctx.beginPath();
        ctx.arc(kx, ky, 72, -Math.PI / 2, -Math.PI / 2 + (Math.PI * 2 * keg.getValue()) / 100);
        ctx.stroke();
      }
      if (fuse > 0) {
        ctx.strokeStyle = PAL.warn;
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.moveTo(kx + 10, ky - 52);
        ctx.quadraticCurveTo(kx + 30, ky - 80, kx + 20 + Math.sin(t * 30) * 4, ky - 70);
        ctx.stroke();
        util.renderText({ ctx: ctx, text: fuse.toFixed(1), x: kx, y: ky - 100, fontSize: '40px', fillStyle: PAL.warn });
      }
      if (frozen > 0) util.renderText({ ctx: ctx, text: '❄ ' + frozen.toFixed(1), x: kx, y: ky + 100, fontSize: '28px', fillStyle: PAL.dim });
    }
    // Pioniere
    pioneers.forEach(function (p) {
      btbFigure(ctx, p.x, GROUND, 1.1, def, t, false);
      var v = p.b.getValue();
      if (v > 0 && p.flee <= 0) {
        ctx.strokeStyle = PAL.text;
        ctx.lineWidth = 4;
        ctx.beginPath();
        ctx.arc(p.x, GROUND - 50, 62, -Math.PI / 2, -Math.PI / 2 + (Math.PI * 2 * v) / 100);
        ctx.stroke();
      }
    });
    // Kanone + Schuss
    var cx = turret.getX();
    var cy = turret.getY();
    ctx.strokeStyle = btbTeamColor(def);
    ctx.lineWidth = 5;
    ctx.beginPath();
    ctx.arc(cx, cy, 26, 0, Math.PI * 2);
    ctx.moveTo(cx, cy);
    ctx.lineTo(cx - attSign * -60, cy - 40);
    ctx.stroke();
    if (shotFx > 0) {
      ctx.strokeStyle = PAL.warn;
      ctx.globalAlpha = shotFx / 0.4;
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.moveTo(cx, cy - 30);
      ctx.quadraticCurveTo((cx + kx) / 2, cy - 260, kx, ky);
      ctx.stroke();
      ctx.globalAlpha = 1;
    }
    // Angreifer-Trupp am Start (Deko)
    for (var i = 0; i < 3; i++) btbFigure(ctx, kegStartX + attSign * (90 + i * 50), GROUND, 1, att, t * 0.2 + i, false);
    ctx.restore();
  }

  return {
    id: 'brueckensprengung',
    title: 'Brückensprengung',
    hint:
      (att === 'N' ? 'NORD' : 'SÜD') +
      ': Pulverfass greifen, auf die Brückenmitte tragen, ZÜNDER füllen! ' +
      (def === 'N' ? 'NORD' : 'SÜD') +
      ': PIONIERE schicken, KANONE gemeinsam zielen!',
    update: update,
  };
}

// @@BATTLES-ENDE@@
const BATTLES = [btFeldschlacht, btFortsturm, btZugueberfall, btBrueckensprengung];

// ---------------------------------------------------------------------------------------------------------
// Export
// ---------------------------------------------------------------------------------------------------------

export default {
  name: 'Nord gegen Süd im Fraktalreich',
  description:
    'frei nach North & South (Amiga 1989)\n\n' +
    'Linke Saalhälfte = MANDELBROTIEN (Apfelmännchen), rechte Saalhälfte = JULIANA (Spiralkringel).\n\n' +
    'Armeen anleuchten bis der Ring voll ist, auf eine Nachbar-Provinz ziehen, loslassen = marschieren.\n' +
    'Treffen sich Armeen, gibt es eine Action-Schlacht – beide Hälften gleichzeitig.\n\n' +
    'Minen liefern Iterationen (JIPII!) für neue Armeen. \nDen Iterations-Zug anleuchten = plündern.\n\n' +
    'Wer alle Provinzen hat – oder nach 8 Minuten die meisten – gewinnt. \n\nIm Menü: Schlacht-Test.',
  image: 'media/img/gametitles/laser-basefight-###4###.png',
  init() {
    ensurePalette();
    resetGame();
    jokeIndex = Math.floor(Math.random() * JOKES_INTRO.length);
    setScene('title');
  },
  handle(grid, elapsed) {
    const dt = Math.min(elapsed || 0, 0.1);
    const ctx = MasterCanvas.get2dContext();
    ensurePalette();
    if (!provinces.length) resetGame();
    clock += dt;
    sceneTime += dt;
    shake = Math.max(0, shake - dt * 40);
    if (scene === 'title') handleTitle(grid, dt, ctx);
    else if (scene === 'test') handleTest(grid, dt, ctx);
    else if (scene === 'map') {
      ctx.save();
      if (shake > 0) ctx.translate((Math.random() - 0.5) * shake, (Math.random() - 0.5) * shake);
      handleMap(grid, dt, ctx);
      ctx.restore();
      updateEffects(dt, ctx);
      drawHud(ctx);
    } else if (scene === 'intro') {
      if (!current || !current.game) setScene('map');
      else {
        handleIntro(grid, dt, ctx);
        drawHud(ctx, current.title);
      }
    } else if (scene === 'battle') {
      if (!current || !current.game) setScene('map');
      else handleBattle(grid, dt, ctx);
    } else if (scene === 'result') {
      if (!lastResult) setScene('map');
      else {
        handleResult(grid, dt, ctx);
        drawHud(ctx);
      }
    } else if (scene === 'end') {
      if (!endInfo) setScene('title');
      else handleEnd(grid, dt, ctx);
    }
  },
  stop() {
    current = null;
    train = null;
    particles = [];
    floaters = [];
    scene = 'title';
    buttons = {};
  },
};
