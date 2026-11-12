/**
 * Brückenwächter
 *
 * Rundenbasiertes Rollenspiel für das ganze Publikum.
 * Eine Heldengruppe (gemeinsame Lebenspunkte) zieht durch die Wüste. An jeder Schlucht
 * bewacht ein Wächter die Brücke und muss Runde für Runde besiegt werden.
 *
 * Ablauf einer Runde:
 * - Der Wächter kündigt seinen nächsten Zug sichtbar an (Sprechblase über ihm),
 *   z. B. "lädt einen Feuerstoß!" (Schild ist richtig), "ist erschöpft" (Angriff),
 *   "murmelt einen Fluch" (Zauber bricht ihn). Jede Runde ist ein kleines Rätsel.
 * - Zugphase (Countdown): Das Publikum stimmt ab, indem es eins der vier Aktionsfelder
 *   unten anleuchtet: ANGRIFF, SCHILD, HEILEN, ZAUBER (je ein gui/pixelFillButton).
 *   Jedes Feld sammelt Stimmen: beleuchteter Flächenanteil (getFillPercent) mal Zeit.
 * - Gewinner = Feld mit den meisten Stimmen. Die STÄRKE der Aktion skaliert mit der Einigkeit
 *   (Anteil des Siegers an allen Stimmen) und der Beteiligung (Stimmen des Siegers, gedeckelt
 *   bei DIFFICULTY.fullPercent Bedeckung für engageVotes Sekunden). Gespaltene Stimmen bzw. wildes
 *   Herumleuchten auf alle Felder ergeben einen schwachen Zug.
 * - Danach Heldenaktion (Animation), dann führt der Wächter seinen angekündigten Zug aus.
 *
 * Wächter (Level), jeder mit neuer Mechanik:
 * 1. Steingolem       – Grundlagen: Schlag, Feuerstoß, Erschöpfung.
 * 2. Riesenskorpion   – Giftstachel: Gift schadet jede Runde, Schild verhindert es, Heilen entgiftet.
 * 3. Sandwurm         – taucht ab (Angriff verfehlt, Zauber lässt den Sand beben), bricht dann hervor.
 * 4. Trugbild-Dschinn – Fata Morgana: zwei Dschinns, nur der echte wirft einen Schatten.
 *                       Ein Teil des Publikums leuchtet das echte Ziel an, der Rest stimmt für Angriff.
 *                       Trifft der Angriff das Trugbild, platzt es und verletzt die Helden.
 *                       Ausserdem Flüche (halbieren eure Stärke), die nur ein Zauber bricht.
 * 5. Sphinx (Boss)    – stellt spätestens jede dritte Runde ein echtes Rätsel: die vier Felder werden
 *                       zu Antworten A–D. Richtig = schwerer Treffer, falsch = Schaden für die Helden.
 *                       Ihre Steinhaut halbiert Angriffe und Zauber.
 * Zwischen den Kämpfen: Oase – Heilung und Level-Up (mehr Lebenspunkte, stärkere Aktionen).
 * Game Over bei 0 Lebenspunkten, Sieg nach der Sphinx – jeweils mit Statistik.
 *
 * Eingabe nur über GUI-Komponenten: gui/pixelFillButton (Aktionsfelder, Zielflächen der Trugbilder),
 * gui/fillButton (Start).
 *
 * Tastatur-Test: Space = Start, 1–4 (halten) = für Angriff/Schild/Heilen/Zauber bzw. Antwort A–D stimmen,
 * A / D (halten) = linkes / rechtes Trugbild anvisieren, Enter = Abstimmung sofort beenden,
 * L = aktuellen Wächter sofort besiegen (Level überspringen).
 *
 * Alle Stellschrauben stehen gesammelt in DIFFICULTY.
 */

import util, { getRgbSpreadHex, removeItemFromArray } from '../util.js';
var laserConfig = require('../LaserApiConfig.js').default;
var MasterCanvas = require('../MasterCanvas').default;
var guiFillButton = require('./gui/fillButton').default;
var guiPixelFillButton = require('./gui/pixelFillButton').default;
import soundHit from '../../../public/media/414346__bykgames__explosion-far.wav';
import soundStomp from '../../../public/media/517267__foolboymedia__cinematic-stomp.wav';
import soundSpell from '../../../public/media/opengameart/Ability Learn.ogg';
import soundHeal from '../../../public/media/opengameart/Item Pickup.ogg';
import soundShield from '../../../public/media/opengameart/Menu Confirm.ogg';
import soundCorrect from '../../../public/media/opengameart/Accept.mp3';
import soundWrong from '../../../public/media/opengameart/Decline.wav';
import soundLevel from '../../../public/media/opengameart/Level Up.ogg';
import soundGameOver from '../../../public/media/opengameart/Music Box Game Over III.wav';
import soundWin from '../../../public/media/fans1-463918_9722681-lq.mp3';
import soundTick from '../../../public/media/opengameart/Menu Move.ogg';

const DIFFICULTY = {
  // Helden
  heroHp: 100,
  heroHpPerLevel: 15, // Zuwachs der maximalen Lebenspunkte pro Oase (Level-Up)
  oasisHeal: 0.5, // Anteil der fehlenden Lebenspunkte, der in der Oase geheilt wird
  heroPowerPerLevel: 0.12, // Aktionen werden pro Level um diesen Anteil stärker
  // Abstimmung
  voteTimeStart: 9, // Sekunden pro Zugphase in Level 1
  voteTimePerLevel: -0.6,
  voteTimeMin: 6,
  voteMinTime: 2.5, // frühestens nach so vielen Sekunden kann eine einige Abstimmung vorzeitig enden
  quickUnity: 0.85, // ab dieser Einigkeit ...
  quickVotes: 4, // ... und so vielen Sekunden voller Bedeckung (fullPercent) endet die Abstimmung vorzeitig
  fullPercent: 10, // beleuchteter Flächenanteil (%) eines Feldes, der als volle Beteiligung zählt
  minPercent: 1, // darunter Rauschen
  engageVotes: 2.5, // so viele Sekunden mit fullPercent Bedeckung auf dem Siegerfeld = volle Beteiligung
  minPower: 0.2, // Stärke bei völlig gespaltener Abstimmung (25 % Einigkeit)
  // Heldenaktionen bei Stärke 1 in Level 1
  attack: 24,
  spell: 14,
  heal: 30,
  shieldBlock: 0.9, // so viel Schaden hält ein voller Schild ab
  weakMultiplier: 2, // Angriff auf erschöpften Wächter
  burrowSpellMultiplier: 1.7, // Zauber gegen abgetauchten Sandwurm
  mirageAttackMultiplier: 1.5, // Angriff auf das echte Ziel der Fata Morgana
  riddleDamage: 60, // richtige Antwort bei der Sphinx
  riddleWrongDamage: 35, // falsche Antwort
  // Wächterzüge (Vielfache des Grundangriffs atk)
  fireMultiplier: 2.8,
  eruptMultiplier: 2.6,
  mirageMultiplier: 1.6,
  mirageReflect: 1, // Angriff auf das Trugbild: so viel Schaden bekommen die Helden
  stingMultiplier: 0.7,
  curseDamage: 0.5,
  curseRounds: 2, // so viele Runden halbiert der Fluch eure Stärke
  curseFactor: 0.5,
  poisonRounds: 3,
  poisonDamage: 6, // pro Runde
  poisonShieldMin: 0.45, // ab dieser Schildstärke prallt der Giftstachel ab
  enemyHpPerLevel: 0, // optionaler Zuschlag (Wächter haben eigene Werte in ENEMIES)
  // Phasen
  heroPhaseTime: 1.7,
  enemyPhaseTime: 1.7,
  defeatTime: 2.6,
  oasisTime: 6,
  maxParticles: 400,
};

const ENEMIES = [
  {
    kind: 'golem',
    name: 'Steingolem',
    hp: 110,
    atk: 12,
    intents: { hit: 4, fire: 2, weak: 2 },
    intro: 'Der Steingolem bewacht die erste Brücke.\nLest seine Ankündigung – dann wählt eure Aktion!',
  },
  {
    kind: 'scorpion',
    name: 'Riesenskorpion',
    hp: 130,
    atk: 12,
    intents: { hit: 2, sting: 4, fire: 1, weak: 2 },
    intro: 'NEU: Gift! Der Stachel schadet euch jede Runde.\nEin Schild hält ihn ab, Heilen entgiftet.',
  },
  {
    kind: 'worm',
    name: 'Sandwurm',
    hp: 150,
    atk: 13,
    intents: { hit: 2, burrow: 3, weak: 1, fire: 1 },
    intro: 'NEU: Der Sandwurm taucht ab – Angriffe verfehlen!\nZauber lassen den Sand beben. Dann bricht er hervor …',
  },
  {
    kind: 'djinn',
    name: 'Trugbild-Dschinn',
    hp: 165,
    atk: 14,
    intents: { hit: 1, mirage: 3, curse: 3, weak: 1, fire: 1 },
    intro:
      'NEU: Fata Morgana! Nur der echte Dschinn wirft einen Schatten –\nleuchtet ihn an und greift an. Zauber brechen Flüche.',
  },
  {
    kind: 'sphinx',
    name: 'Die Sphinx',
    hp: 260,
    atk: 15,
    armor: 0.5, // Steinhaut: Angriffe und Zauber machen nur halben Schaden, Rätsel vollen
    intents: { riddle: 4, fire: 2, curse: 2, weak: 1, hit: 1 },
    intro: 'ENDGEGNER: Die Sphinx stellt Rätsel! Ihre Steinhaut halbiert Angriffe –\nnur richtige Antworten treffen voll. Falsche tun weh.',
  },
];

const INTENTS = {
  hit: { text: 'holt zum Schlag aus', hint: 'Ein normaler Schlag – Angriff oder Schild, beides geht.' },
  fire: { text: 'lädt einen Feuerstoß!', hint: 'Ein gewaltiger Treffer kommt – SCHILD!' },
  weak: { text: 'ist erschöpft – verwundbar!', hint: 'Jetzt zählt ein ANGRIFF doppelt!' },
  curse: { text: 'murmelt einen Fluch …', hint: 'Nur ein ZAUBER bricht den Fluch.' },
  sting: { text: 'hebt den Giftstachel', hint: 'SCHILD hält das Gift ab, HEILEN entgiftet.' },
  burrow: { text: 'taucht in den Sand ab', hint: 'Angriffe verfehlen – ein ZAUBER lässt den Sand beben!' },
  erupt: { text: 'bricht gleich hervor!', hint: 'Riesiger Schaden – SCHILD!' },
  mirage: {
    text: 'spaltet sich in Trugbilder',
    hint: 'Das echte Ziel hat einen Schatten: anleuchten + ANGRIFF. Oder ZAUBER.',
  },
  riddle: { text: 'stellt ein Rätsel!', hint: 'Leuchtet die richtige Antwort an!' },
};

const RIDDLES = [
  { q: 'Was hat Zeiger, aber keine Finger?', a: ['Die Uhr', 'Der Kaktus', 'Die Sphinx', 'Die Brücke'] },
  {
    q: 'Morgens vier Beine, mittags zwei, abends drei. Wer ist es?',
    a: ['Der Mensch', 'Das Kamel', 'Der Skorpion', 'Der Tisch'],
  },
  { q: 'Je mehr man wegnimmt, desto größer wird es.', a: ['Ein Loch', 'Eine Düne', 'Die Oase', 'Der Schatten'] },
  { q: 'Was gehört dir, doch andere benutzen es öfter?', a: ['Dein Name', 'Dein Wasser', 'Dein Schild', 'Dein Sand'] },
  { q: 'Was wird nass, während es trocknet?', a: ['Das Handtuch', 'Der Sand', 'Die Sonne', 'Der Kaktus'] },
  { q: 'Was hat einen Hals, aber keinen Kopf?', a: ['Die Flasche', 'Die Sphinx', 'Das Kamel', 'Die Brücke'] },
  {
    q: 'Ich habe Städte ohne Häuser und Flüsse ohne Wasser.',
    a: ['Die Landkarte', 'Die Wüste', 'Der Traum', 'Die Fata Morgana'],
  },
  {
    q: 'Leichter als eine Feder, doch keiner hält es lange.',
    a: ['Der Atem', 'Der Sand', 'Der Schatten', 'Das Wasser'],
  },
  { q: 'Was zerbricht, sobald man seinen Namen sagt?', a: ['Die Stille', 'Ein Ei', 'Die Brücke', 'Ein Krug'] },
  { q: 'Wie viele Beine hat ein Skorpion?', a: ['8', '6', '10', '4'] },
  { q: 'Welches Tier trägt Fettvorräte im Höcker?', a: ['Das Kamel', 'Der Wüstenfuchs', 'Der Geier', 'Die Echse'] },
  {
    q: 'Je wärmer es ist, desto kleiner werde ich. Was bin ich?',
    a: ['Der Schatten', 'Die Düne', 'Die Brücke', 'Der Wurm'],
  },
  {
    q: 'Es läuft und läuft und hat doch keine Füße.',
    a: ['Die Zeit', 'Das Kamel', 'Der Skorpion', 'Die Düne'],
  },
  { q: 'Was kommt in jeder Minute zweimal vor, im Jahr aber nie?', a: ['Das N', 'Die Sonne', 'Der Mond', 'Das J'] },
];

const ACTIONS = [
  { key: 'attack', label: 'ANGRIFF', hue: 0.15 },
  { key: 'shield', label: 'SCHILD', hue: 0.4 },
  { key: 'heal', label: 'HEILEN', hue: 0.6 },
  { key: 'spell', label: 'ZAUBER', hue: 0.85 },
];
const LETTERS = ['A', 'B', 'C', 'D'];
const FIELD_KEYS = ['Digit1', 'Digit2', 'Digit3', 'Digit4'];

const W = 1920;
const H = 1080;
const BRIDGE_X0 = 300;
const BRIDGE_X1 = 1620;
const BRIDGE_Y = 590;
const BRIDGE_SAG = 40;
const HERO_X = [430, 515, 600, 685];
const ENEMY_X = 1360;
const MIRAGE_X = [1150, 1560];
const MIRAGE_R = 150;
const FIELD_Y = 880;
const FIELD_R = 105;

// --- Zustand ---
var gameState = 'start'; // start | game | levelup | gameover
var phase = 'vote'; // vote | hero | enemy | defeat
var phaseTime = 0;
var stateTime = 0;
var gameTime = 0;
var level = 1;
var won = false;
var heroHp = DIFFICULTY.heroHp;
var heroMaxHp = DIFFICULTY.heroHp;
var heroHurt = 0;
var enemy = null;
var round = 0;
var votes = [0, 0, 0, 0];
var aim = [0, 0];
var fields = [];
var aimButtons = [];
var action = null; // { type, power, unity, engage }
var applied = false;
var shieldBlock = 0;
var curse = 0; // Runden
var poison = 0; // Runden
var seenIntents = {};
var riddleQueue = [];
var lastIntents = [];
var travel = 0;
var particles = [];
var floatingTexts = [];
var shake = 0;
var flash = 0;
var flashColor = '#ffffff';
var resultText = '';
var oasisText = '';
var buttonsStart = [];
var buttonsGameOver = [];
var stats = null;
var previousKeys = {};
var lastTime = 0;
var activeSounds = [];
var sprites = {};
var lastTickSecond = -1;
var spacePressed = false; // Leertaste in diesem Frame neu gedrückt (Tastatur-Start)

// --- Farben (alle aus testColor abgeleitet, nie die reine Laserfarbe) ---
var COL = {};
function updateColors() {
  const c = laserConfig.testColor;
  COL = {
    skyTop: getRgbSpreadHex(c, 0.6, 0.6, 0.45),
    skyBottom: getRgbSpreadHex(c, 0.1, 0.45, 0.95),
    sun: getRgbSpreadHex(c, 0.14, 0.35, 1),
    duneFar: getRgbSpreadHex(c, 0.1, 0.35, 0.8),
    duneMid: getRgbSpreadHex(c, 0.09, 0.5, 0.7),
    duneNear: getRgbSpreadHex(c, 0.08, 0.6, 0.58),
    cliff: getRgbSpreadHex(c, 0.07, 0.55, 0.45),
    cliffDark: getRgbSpreadHex(c, 0.07, 0.6, 0.25),
    cliffLight: getRgbSpreadHex(c, 0.1, 0.4, 0.7),
    chasm: getRgbSpreadHex(c, 0.65, 0.5, 0.1),
    panel: getRgbSpreadHex(c, 0.62, 0.5, 0.12),
    rope: getRgbSpreadHex(c, 0.1, 0.4, 0.55),
    plank: getRgbSpreadHex(c, 0.08, 0.55, 0.5),
    plankDark: getRgbSpreadHex(c, 0.08, 0.6, 0.3),
    stone: getRgbSpreadHex(c, 0.1, 0.25, 0.6),
    stoneDark: getRgbSpreadHex(c, 0.1, 0.3, 0.38),
    scorpion: getRgbSpreadHex(c, 0.92, 0.6, 0.55),
    scorpionDark: getRgbSpreadHex(c, 0.92, 0.7, 0.3),
    worm: getRgbSpreadHex(c, 0.12, 0.45, 0.75),
    wormDark: getRgbSpreadHex(c, 0.1, 0.6, 0.45),
    djinn: getRgbSpreadHex(c, 0.55, 0.55, 0.85),
    djinnDark: getRgbSpreadHex(c, 0.6, 0.7, 0.5),
    sphinx: getRgbSpreadHex(c, 0.13, 0.45, 0.85),
    sphinxDark: getRgbSpreadHex(c, 0.12, 0.55, 0.55),
    nemes1: getRgbSpreadHex(c, 0.6, 0.75, 0.75),
    nemes2: getRgbSpreadHex(c, 0.14, 0.8, 0.95),
    eye: getRgbSpreadHex(c, 0.45, 0.9, 1),
    fire: getRgbSpreadHex(c, 0.12, 0.9, 1),
    fireHot: getRgbSpreadHex(c, 0.16, 0.5, 1),
    curse: getRgbSpreadHex(c, 0.78, 0.8, 0.9),
    poison: getRgbSpreadHex(c, 0.35, 0.85, 0.85),
    shield: getRgbSpreadHex(c, 0.5, 0.6, 1),
    heal: getRgbSpreadHex(c, 0.38, 0.6, 1),
    spell: getRgbSpreadHex(c, 0.8, 0.55, 1),
    slash: getRgbSpreadHex(c, 0.15, 0.15, 1),
    water: getRgbSpreadHex(c, 0.52, 0.7, 0.8),
    palm: getRgbSpreadHex(c, 0.32, 0.7, 0.55),
    trunk: getRgbSpreadHex(c, 0.08, 0.6, 0.35),
    hero: [
      getRgbSpreadHex(c, 0.15, 0.75, 0.9),
      getRgbSpreadHex(c, 0.45, 0.7, 0.85),
      getRgbSpreadHex(c, 0.6, 0.55, 0.95),
      getRgbSpreadHex(c, 0.82, 0.6, 0.9),
    ],
    skin: getRgbSpreadHex(c, 0.08, 0.35, 0.95),
    text: getRgbSpreadHex(c, 0.5, 0.2, 1),
    textHi: getRgbSpreadHex(c, 0.14, 0.75, 1),
    good: getRgbSpreadHex(c, 0.4, 0.75, 1),
    bad: getRgbSpreadHex(c, 0.9, 0.8, 1),
    hpHero: getRgbSpreadHex(c, 0.38, 0.75, 0.9),
    hpEnemy: getRgbSpreadHex(c, 0.9, 0.75, 0.9),
    shadow: getRgbSpreadHex(c, 0.62, 0.6, 0.08),
    white: getRgbSpreadHex(c, 0.5, 0.05, 1),
  };
}

function actionColor(i, val = 0.95, sat = 0.65) {
  return getRgbSpreadHex(laserConfig.testColor, ACTIONS[i].hue, sat, val);
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

function shuffle(arr) {
  const result = arr.slice();
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    const tmp = result[i];
    result[i] = result[j];
    result[j] = tmp;
  }
  return result;
}

function clamp01(v) {
  return Math.max(0, Math.min(1, v));
}

/** bricht Text an Wortgrenzen nach maxChars Zeichen um */
function wrapText(text, maxChars) {
  const words = String(text).split(' ');
  const lines = [];
  let line = '';
  words.forEach((word) => {
    if (line.length > 0 && line.length + 1 + word.length > maxChars) {
      lines.push(line);
      line = word;
    } else {
      line = line.length > 0 ? line + ' ' + word : word;
    }
  });
  if (line.length > 0) lines.push(line);
  return lines.join('\n');
}

function txt(ctx, text, x, y, size, color, align = 'center', lineHeight) {
  util.renderTextDropShadow({
    ctx,
    text,
    x,
    y,
    fontSize: `${size}px`,
    lineHeight: lineHeight || Math.round(size * 1.25),
    dropDistX: Math.max(2, size / 14),
    dropDistY: Math.max(2, size / 14),
    fillStyle: color,
    shadowStyle: COL.shadow,
    align,
  });
}

function addFloatingText(text, x, y, color, size = 50, duration = 1.6) {
  floatingTexts.push({ text, x, y, color, size, time: 0, duration });
}

function burst(x, y, color, count = 16, speed = 300, gravity = 300, size = 8) {
  for (let i = 0; i < count && particles.length < DIFFICULTY.maxParticles; i++) {
    const a = Math.random() * Math.PI * 2;
    const s = speed * (0.3 + Math.random() * 0.7);
    particles.push({
      x,
      y,
      vx: Math.cos(a) * s,
      vy: Math.sin(a) * s - speed * 0.2,
      life: 0,
      maxLife: 0.5 + Math.random() * 0.8,
      size: size * (0.6 + Math.random() * 0.8),
      color,
      gravity,
      glow: false,
    });
  }
}

function sparkle(x, y, color, vy = -120) {
  if (particles.length >= DIFFICULTY.maxParticles) return;
  particles.push({
    x,
    y,
    vx: (Math.random() - 0.5) * 60,
    vy: vy * (0.6 + Math.random() * 0.8),
    life: 0,
    maxLife: 0.8 + Math.random() * 0.6,
    size: 6 + Math.random() * 6,
    color,
    gravity: 0,
    glow: true,
  });
}

function makeCanvas(w, h) {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  return c;
}

function seededRandom(seed) {
  let s = seed;
  return () => {
    s = (s * 9301 + 49297) % 233280;
    return s / 233280;
  };
}

function bridgeY(x) {
  const u = clamp01((x - BRIDGE_X0) / (BRIDGE_X1 - BRIDGE_X0));
  return BRIDGE_Y + Math.sin(u * Math.PI) * BRIDGE_SAG + Math.sin(gameTime * 1.3 + u * 4) * 3 * Math.sin(u * Math.PI);
}

function heroLevelFactor() {
  return 1 + DIFFICULTY.heroPowerPerLevel * (level - 1);
}

function voteTime() {
  return Math.max(DIFFICULTY.voteTimeMin, DIFFICULTY.voteTimeStart + DIFFICULTY.voteTimePerLevel * (level - 1));
}

// --- Vorrendern ---
function renderSky() {
  const c = makeCanvas(W, H);
  const ctx = c.getContext('2d');
  const sky = ctx.createLinearGradient(0, 0, 0, 520);
  sky.addColorStop(0, COL.skyTop);
  sky.addColorStop(1, COL.skyBottom);
  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, W, H);
  // Sonne mit Hof
  const glow = ctx.createRadialGradient(1500, 220, 20, 1500, 220, 320);
  glow.addColorStop(0, COL.sun);
  glow.addColorStop(0.25, COL.sun);
  glow.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.globalAlpha = 0.55;
  ctx.fillStyle = glow;
  ctx.fillRect(1100, -200, 800, 800);
  ctx.globalAlpha = 1;
  ctx.fillStyle = COL.sun;
  ctx.beginPath();
  ctx.arc(1500, 220, 85, 0, Math.PI * 2);
  ctx.fill();
  return c;
}

/** Dünenlage, doppelt so breit wie der Bildschirm, nahtlos kachelbar */
function renderDuneLayer(color, baseY, amp, seed, height = H) {
  const c = makeCanvas(W * 2, height);
  const ctx = c.getContext('2d');
  const rand = seededRandom(seed);
  const waves = [];
  for (let k = 0; k < 4; k++) waves.push({ f: (k + 1) * 2, p: rand() * Math.PI * 2, a: amp / (k + 1) });
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.moveTo(0, height);
  for (let x = 0; x <= W * 2; x += 10) {
    let y = baseY;
    waves.forEach((w) => (y -= Math.abs(Math.sin((x / (W * 2)) * Math.PI * w.f + w.p)) * w.a));
    ctx.lineTo(x, y);
  }
  ctx.lineTo(W * 2, height);
  ctx.closePath();
  ctx.fill();
  // Windrippel
  ctx.strokeStyle = COL.shadow;
  ctx.globalAlpha = 0.12;
  ctx.lineWidth = 3;
  for (let i = 0; i < 40; i++) {
    const x = rand() * W * 2;
    const y = baseY + 20 + rand() * 120;
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.quadraticCurveTo(x + 40, y - 8, x + 90, y);
    ctx.stroke();
  }
  ctx.globalAlpha = 1;
  return c;
}

/** Felswände links/rechts, Schlucht und dunkles Bedienfeld unten (transparent oben) */
function renderCanyon() {
  const c = makeCanvas(W, H);
  const ctx = c.getContext('2d');
  // Schlucht
  const chasm = ctx.createLinearGradient(0, BRIDGE_Y - 40, 0, 760);
  chasm.addColorStop(0, COL.cliffDark);
  chasm.addColorStop(1, COL.chasm);
  ctx.fillStyle = chasm;
  ctx.fillRect(0, BRIDGE_Y - 40, W, H);
  const rand = seededRandom(17);
  const cliff = (side) => {
    const x0 = side < 0 ? 0 : W;
    const edge = side < 0 ? BRIDGE_X0 + 20 : BRIDGE_X1 - 20;
    ctx.beginPath();
    ctx.moveTo(x0, BRIDGE_Y - 25);
    ctx.lineTo(edge, BRIDGE_Y - 25);
    let x = edge;
    for (let y = BRIDGE_Y - 25; y < 780; y += 30) {
      x = edge - side * (rand() * 60 + (y - BRIDGE_Y) * 0.35);
      ctx.lineTo(x, y);
    }
    ctx.lineTo(x0, 780);
    ctx.closePath();
    const g = ctx.createLinearGradient(0, BRIDGE_Y - 25, 0, 780);
    g.addColorStop(0, COL.cliffLight);
    g.addColorStop(0.15, COL.cliff);
    g.addColorStop(1, COL.cliffDark);
    ctx.fillStyle = g;
    ctx.fill();
    // Gesteinsschichten
    ctx.strokeStyle = COL.cliffDark;
    ctx.globalAlpha = 0.5;
    ctx.lineWidth = 4;
    for (let y = BRIDGE_Y + 10; y < 780; y += 34) {
      ctx.beginPath();
      ctx.moveTo(x0, y);
      ctx.lineTo(edge - side * ((y - BRIDGE_Y) * 0.35 + 30), y + rand() * 10);
      ctx.stroke();
    }
    ctx.globalAlpha = 1;
  };
  cliff(-1);
  cliff(1);
  // Bedienfeld unten
  const panel = ctx.createLinearGradient(0, 740, 0, H);
  panel.addColorStop(0, 'rgba(0,0,0,0)');
  panel.addColorStop(0.15, COL.panel);
  panel.addColorStop(1, COL.panel);
  ctx.fillStyle = panel;
  ctx.fillRect(0, 740, W, H - 740);
  return c;
}

function renderOasis() {
  const c = makeCanvas(900, 420);
  const ctx = c.getContext('2d');
  ctx.fillStyle = COL.water;
  ctx.beginPath();
  ctx.ellipse(450, 340, 330, 60, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = COL.white;
  ctx.globalAlpha = 0.4;
  ctx.lineWidth = 4;
  for (let k = 0; k < 3; k++) {
    ctx.beginPath();
    ctx.ellipse(450, 340, 120 + k * 70, 14 + k * 9, 0, 0.2, Math.PI - 0.2);
    ctx.stroke();
  }
  ctx.globalAlpha = 1;
  const palm = (x, y, h, lean) => {
    ctx.strokeStyle = COL.trunk;
    ctx.lineWidth = 18;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.quadraticCurveTo(x + lean * 0.3, y - h * 0.6, x + lean, y - h);
    ctx.stroke();
    ctx.fillStyle = COL.palm;
    for (let k = 0; k < 7; k++) {
      const a = -Math.PI + (k / 6) * Math.PI;
      ctx.save();
      ctx.translate(x + lean, y - h);
      ctx.rotate(a);
      ctx.beginPath();
      ctx.ellipse(70, 10, 80, 18, 0.3, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }
  };
  palm(220, 330, 260, -40);
  palm(330, 320, 300, 30);
  palm(660, 330, 280, 50);
  palm(560, 320, 200, -30);
  return c;
}

function renderSprites() {
  sprites.sky = renderSky();
  sprites.duneFar = renderDuneLayer(COL.duneFar, 430, 90, 3);
  sprites.duneMid = renderDuneLayer(COL.duneMid, 500, 80, 11);
  sprites.duneNear = renderDuneLayer(COL.duneNear, 570, 60, 23);
  sprites.canyon = renderCanyon();
  sprites.oasis = renderOasis();
}

// --- GUI: Aktionsfelder und Zielflächen ---
function createFields() {
  return ACTIONS.map((a, i) =>
    guiPixelFillButton({
      label: '',
      posX: fieldX(i),
      posY: FIELD_Y,
      radius: FIELD_R,
      edges: 6,
      fullPercent: DIFFICULTY.fullPercent,
      minPercent: DIFFICULTY.minPercent,
      speedUp: 100 / 1.5,
      speedDown: 70,
      minValue: 0,
      activeValue: 100, // löst nie aus, der Füllstand ist nur die "Hitze"-Anzeige
      visible: false,
    })
  );
}

function createAimButtons() {
  return MIRAGE_X.map((x) =>
    guiPixelFillButton({
      label: '',
      posX: x,
      posY: BRIDGE_Y - 150,
      radius: MIRAGE_R,
      fullPercent: DIFFICULTY.fullPercent,
      minPercent: DIFFICULTY.minPercent,
      speedUp: 100 / 1.5,
      speedDown: 70,
      minValue: 0,
      activeValue: 100,
      visible: false,
    })
  );
}

function fieldX(i) {
  return (W / 8) * (2 * i + 1);
}

// --- Wächter ---
function createEnemy(lvl) {
  const def = ENEMIES[lvl - 1];
  const hp = def.hp + DIFFICULTY.enemyHpPerLevel * (lvl - 1);
  return {
    def,
    hp,
    maxHp: hp,
    shownHp: hp,
    intent: null,
    hurt: 0,
    lunge: 0,
    stunned: false,
    curseBroken: false,
    realIndex: 0,
    riddle: null,
    rise: 1,
  };
}

function pickIntent() {
  const prev = lastIntents[lastIntents.length - 1];
  if (prev === 'burrow') return 'erupt';
  // die Sphinx stellt spätestens jede dritte Runde ein Rätsel
  if (enemy.def.intents.riddle && round > 1 && !lastIntents.slice(-2).includes('riddle')) return 'riddle';
  const weights = Object.assign({}, enemy.def.intents);
  if (prev === 'weak') weights.weak = 0;
  if (lastIntents.length >= 2 && lastIntents[lastIntents.length - 2] === prev) weights[prev] = 0;
  // der erste Zug ist nie der gefährlichste
  if (round === 1) {
    weights.fire = 0;
    weights.erupt = 0;
  }
  let sum = 0;
  Object.keys(weights).forEach((k) => (sum += weights[k]));
  if (sum <= 0) return 'hit';
  let r = Math.random() * sum;
  for (const k of Object.keys(weights)) {
    r -= weights[k];
    if (r < 0) return k;
  }
  return 'hit';
}

function nextRiddle() {
  if (riddleQueue.length === 0) riddleQueue = shuffle(RIDDLES);
  const raw = riddleQueue.pop();
  const order = shuffle([0, 1, 2, 3]);
  return { q: raw.q, answers: order.map((k) => raw.a[k]), correct: order.indexOf(0) };
}

// --- Spielfluss ---
function startFight() {
  enemy = createEnemy(level);
  round = 0;
  lastIntents = [];
  curse = 0;
  poison = 0;
  gameState = 'game';
  stateTime = 0;
  nextRound();
}

function nextRound() {
  round++;
  const key = pickIntent();
  lastIntents.push(key);
  if (lastIntents.length > 4) lastIntents.shift();
  enemy.intent = { key, firstTime: !seenIntents[key] };
  seenIntents[key] = true;
  enemy.stunned = false;
  enemy.curseBroken = false;
  enemy.riddle = key === 'riddle' ? nextRiddle() : null;
  enemy.realIndex = Math.random() < 0.5 ? 0 : 1;
  votes = [0, 0, 0, 0];
  aim = [0, 0];
  fields.forEach((f) => f.setValue(0));
  aimButtons.forEach((b) => b.setValue(0));
  action = null;
  shieldBlock = 0;
  phase = 'vote';
  phaseTime = 0;
  lastTickSecond = -1;
  resultText = '';
}

function voteStatus() {
  let total = 0;
  let leader = -1;
  let best = 0;
  votes.forEach((v, i) => {
    total += v;
    if (v > best) {
      best = v;
      leader = i;
    }
  });
  const unity = total > 0 ? best / total : 0;
  return { total, leader, best, unity };
}

/** Stimmen unterhalb dieser Summe zählen als "niemand hat abgestimmt" */
function minVotes() {
  return DIFFICULTY.fullPercent * 0.1;
}

function computePower(best, unity) {
  const u = clamp01((unity - 0.25) / 0.75);
  const engage = clamp01(best / (DIFFICULTY.fullPercent * DIFFICULTY.engageVotes));
  let power = (DIFFICULTY.minPower + (1 - DIFFICULTY.minPower) * u) * (0.4 + 0.6 * engage);
  if (curse > 0) power *= DIFFICULTY.curseFactor;
  return { power, engage };
}

function decideAction() {
  const { total, leader, best, unity } = voteStatus();
  if (total < minVotes() || leader < 0) {
    action = { type: -1, power: 0, unity: 0, engage: 0 };
  } else {
    const { power, engage } = computePower(best, unity);
    action = { type: leader, power, unity, engage, aimTarget: enemy.realIndex };
    if (enemy.intent.key === 'mirage') {
      // das stärker beleuchtete Trugbild ist das Ziel; ohne Zielen entscheidet der Zufall
      action.aimTarget = aim[0] === aim[1] ? (Math.random() < 0.5 ? 0 : 1) : aim[0] > aim[1] ? 0 : 1;
    }
    stats.unitySum += unity;
    stats.votedRounds++;
    stats.bestUnity = Math.max(stats.bestUnity, unity);
  }
  stats.rounds++;
  phase = 'hero';
  phaseTime = 0;
  applied = false;
}

function damageEnemy(amount, x, y, color, label) {
  const dmg = Math.max(1, Math.round(amount));
  enemy.hp = Math.max(0, enemy.hp - dmg);
  enemy.hurt = 0.5;
  stats.dealt += dmg;
  shake = Math.max(shake, 0.25 + Math.min(0.5, dmg / 80));
  burst(x, y, color, 30, 450, 300, 10);
  addFloatingText(`${label ? label + ' ' : ''}−${dmg}`, x, y - 140, color, 60);
  playSound(soundHit, 0.5);
}

function damageHeroes(amount, label, color) {
  const dmg = Math.max(0, Math.round(amount));
  if (dmg <= 0) return;
  heroHp = Math.max(0, heroHp - dmg);
  heroHurt = 0.5;
  stats.taken += dmg;
  shake = Math.max(shake, 0.3 + Math.min(0.6, dmg / 50));
  flash = Math.max(flash, 0.5);
  flashColor = COL.bad;
  burst(HERO_X[1] + 40, BRIDGE_Y - 80, color || COL.bad, 24, 350);
  addFloatingText(`${label ? label + ' ' : ''}−${dmg}`, 560, BRIDGE_Y - 230, color || COL.bad, 56);
}

function heroCenter() {
  return { x: (HERO_X[0] + HERO_X[3]) / 2, y: BRIDGE_Y - 70 };
}

function enemyTarget() {
  if (enemy.intent.key === 'mirage') {
    const k = action && action.type === 0 ? action.aimTarget : enemy.realIndex;
    return { x: MIRAGE_X[k], y: BRIDGE_Y - 160 };
  }
  return { x: ENEMY_X, y: BRIDGE_Y - 160 };
}

/** Wirkung der gewählten Heldenaktion */
function resolveHero() {
  const it = enemy.intent.key;
  const mult = heroLevelFactor();
  const armor = enemy.def.armor || 1;
  const p = action.power;
  const t = enemyTarget();
  const pct = Math.round(p * 100);

  if (it === 'riddle') {
    const r = enemy.riddle;
    if (action.type === r.correct) {
      stats.riddlesRight++;
      damageEnemy(DIFFICULTY.riddleDamage * Math.max(0.5, p) * mult, t.x, t.y, COL.good, 'RICHTIG!');
      resultText = `Richtig: "${r.answers[r.correct]}" – die Sphinx wankt!`;
      playSound(soundCorrect, 0.8);
      flash = 0.6;
      flashColor = COL.good;
    } else {
      stats.riddlesWrong++;
      resultText =
        action.type < 0
          ? `Keine Antwort! Richtig wäre "${r.answers[r.correct]}" gewesen.`
          : `Falsch! Richtig wäre "${r.answers[r.correct]}" gewesen.`;
      damageHeroes(DIFFICULTY.riddleWrongDamage, 'FALSCH!', COL.bad);
      playSound(soundWrong, 0.8);
    }
    return;
  }

  switch (action.type) {
    case -1:
      resultText = 'Ihr zögert … niemand hat abgestimmt!';
      addFloatingText('Zögern!', heroCenter().x, BRIDGE_Y - 220, COL.bad, 56);
      break;
    case 0: {
      // Angriff
      if (it === 'burrow') {
        resultText = 'Verfehlt! Der Wurm ist abgetaucht.';
        addFloatingText('verfehlt!', ENEMY_X, BRIDGE_Y - 120, COL.text, 56);
        burst(ENEMY_X, BRIDGE_Y + 60, COL.worm, 20, 250);
        break;
      }
      if (it === 'mirage') {
        const target = action.aimTarget;
        if (target === enemy.realIndex) {
          enemy.stunned = true;
          stats.miragesHit++;
          damageEnemy(DIFFICULTY.attack * DIFFICULTY.mirageAttackMultiplier * p * mult * armor, t.x, t.y, COL.slash, 'ECHT!');
          resultText = `Volltreffer auf den echten Dschinn! (Stärke ${pct} %)`;
        } else {
          const fx = MIRAGE_X[target];
          burst(fx, BRIDGE_Y - 160, COL.djinn, 40, 500);
          addFloatingText('Trugbild!', fx, BRIDGE_Y - 300, COL.bad, 60);
          resultText = 'Ins Trugbild geschlagen – es platzt euch ins Gesicht!';
          damageHeroes(enemy.def.atk * DIFFICULTY.mirageReflect, '', COL.djinn);
        }
        break;
      }
      const crit = it === 'weak';
      damageEnemy(
        DIFFICULTY.attack * p * mult * armor * (crit ? DIFFICULTY.weakMultiplier : 1),
        t.x,
        t.y,
        COL.slash,
        crit ? 'KRITISCH!' : ''
      );
      resultText = `Angriff mit ${pct} % Stärke${crit ? ' – doppelter Schaden!' : ''}`;
      break;
    }
    case 1:
      shieldBlock = DIFFICULTY.shieldBlock * p;
      resultText = `Schild hält ${Math.round(shieldBlock * 100)} % ab`;
      playSound(soundShield, 0.7);
      break;
    case 2: {
      const amount = Math.round(DIFFICULTY.heal * p * mult);
      const before = heroHp;
      heroHp = Math.min(heroMaxHp, heroHp + amount);
      stats.healed += heroHp - before;
      const cured = poison > 0;
      poison = 0;
      resultText = `Heilung +${heroHp - before}${cured ? ' – Gift geheilt!' : ''}`;
      addFloatingText(`+${heroHp - before}`, heroCenter().x, BRIDGE_Y - 230, COL.heal, 60);
      for (let k = 0; k < 30; k++) sparkle(HERO_X[0] + Math.random() * 300, BRIDGE_Y - Math.random() * 120, COL.heal);
      playSound(soundHeal, 0.8);
      break;
    }
    case 3: {
      let factor = 1;
      let label = '';
      if (it === 'burrow') {
        factor = DIFFICULTY.burrowSpellMultiplier;
        label = 'BEBEN!';
        resultText = 'Der Sand bebt – der Wurm wird getroffen!';
      } else if (it === 'curse') {
        enemy.curseBroken = true;
        label = 'Fluch gebrochen!';
        resultText = 'Der Fluch ist gebrochen!';
      } else if (it === 'mirage') {
        enemy.stunned = true;
        label = 'Trugbilder weg!';
        resultText = 'Der Zauber lässt die Trugbilder verwehen!';
      } else {
        resultText = `Zauber mit ${pct} % Stärke`;
      }
      if (curse > 0) {
        curse = 0;
        resultText += ' Euer Fluch verfliegt.';
      }
      const x = it === 'mirage' ? MIRAGE_X[enemy.realIndex] : ENEMY_X;
      damageEnemy(DIFFICULTY.spell * p * mult * armor * factor, x, BRIDGE_Y - 160, COL.spell, label);
      playSound(soundSpell, 0.7);
      break;
    }
  }
}

/** der angekündigte Zug des Wächters */
function resolveEnemy() {
  const it = enemy.intent.key;
  const atk = enemy.def.atk;
  const block = 1 - shieldBlock;
  const blockedText = shieldBlock > 0.05 ? ' (Schild!)' : '';
  switch (it) {
    case 'hit':
      damageHeroes(atk * block, 'Schlag' + blockedText);
      playSound(soundStomp, 0.6);
      break;
    case 'fire':
      damageHeroes(atk * DIFFICULTY.fireMultiplier * block, 'Feuerstoß' + blockedText, COL.fire);
      for (let k = 0; k < 40; k++) burst(HERO_X[0] + Math.random() * 300, BRIDGE_Y - 80, COL.fire, 1, 300);
      playSound(soundHit, 0.8);
      break;
    case 'weak':
      addFloatingText('keuch …', ENEMY_X, BRIDGE_Y - 330, COL.text, 46);
      break;
    case 'curse':
      if (enemy.curseBroken) {
        addFloatingText('Fluch verpufft!', ENEMY_X, BRIDGE_Y - 330, COL.good, 50);
      } else {
        curse = DIFFICULTY.curseRounds;
        stats.curses++;
        damageHeroes(atk * DIFFICULTY.curseDamage, 'VERFLUCHT!', COL.curse);
        for (let k = 0; k < 30; k++) sparkle(HERO_X[0] + Math.random() * 300, BRIDGE_Y - Math.random() * 140, COL.curse, -60);
      }
      break;
    case 'sting':
      damageHeroes(atk * DIFFICULTY.stingMultiplier * block, 'Stich' + blockedText, COL.poison);
      if (shieldBlock >= DIFFICULTY.poisonShieldMin) {
        addFloatingText('Gift abgeprallt!', heroCenter().x, BRIDGE_Y - 300, COL.good, 46);
      } else {
        poison = DIFFICULTY.poisonRounds;
        stats.poisoned++;
        addFloatingText('VERGIFTET!', heroCenter().x, BRIDGE_Y - 300, COL.poison, 50);
      }
      playSound(soundStomp, 0.5);
      break;
    case 'burrow':
      addFloatingText('wühlt unter euch …', ENEMY_X, BRIDGE_Y - 120, COL.text, 46);
      break;
    case 'erupt':
      damageHeroes(atk * DIFFICULTY.eruptMultiplier * block, 'Ausbruch' + blockedText, COL.worm);
      burst(heroCenter().x, BRIDGE_Y + 20, COL.worm, 50, 600);
      playSound(soundHit, 0.9);
      break;
    case 'mirage':
      if (enemy.stunned) addFloatingText('gebannt!', MIRAGE_X[enemy.realIndex], BRIDGE_Y - 330, COL.good, 50);
      else {
        damageHeroes(atk * DIFFICULTY.mirageMultiplier * block, 'Trugbild-Hieb' + blockedText, COL.djinn);
        playSound(soundStomp, 0.6);
      }
      break;
    case 'riddle':
      break;
  }
  if (shieldBlock > 0.05 && ['hit', 'fire', 'sting', 'erupt', 'mirage'].includes(it)) {
    burst(heroCenter().x + 120, BRIDGE_Y - 90, COL.shield, 30, 350, 100);
    stats.blocked += 1;
  }
}

function endOfRound() {
  // Gift wirkt am Rundenende
  if (poison > 0) {
    poison--;
    damageHeroes(DIFFICULTY.poisonDamage, 'Gift', COL.poison);
  }
  if (heroHp <= 0) {
    endGame(false);
    return;
  }
  nextRound();
}

function enemyDefeated() {
  phase = 'defeat';
  phaseTime = 0;
  stats.enemies++;
  flash = 1;
  flashColor = COL.white;
  shake = 0.8;
  playSound(soundStomp, 0.9);
}

function enterOasis() {
  gameState = 'levelup';
  stateTime = 0;
  const before = heroHp;
  level++;
  heroMaxHp += DIFFICULTY.heroHpPerLevel;
  heroHp = Math.min(heroMaxHp, Math.round(heroHp + (heroMaxHp - heroHp) * DIFFICULTY.oasisHeal));
  curse = 0;
  poison = 0;
  enemy = null;
  oasisText = `Erholung: +${heroHp - before} Lebenspunkte (max. ${heroMaxHp})\nLevel-Up: eure Aktionen sind ${Math.round(
    (heroLevelFactor() - 1) * 100
  )} % stärker`;
  playSound(soundLevel, 0.8);
}

function endGame(hasWon) {
  won = hasWon;
  gameState = 'gameover';
  stateTime = 0;
  buttonsGameOver = [startButton(800)];
  playSound(hasWon ? soundWin : soundGameOver, 0.8);
}

function resetGame() {
  level = 1;
  heroMaxHp = DIFFICULTY.heroHp;
  heroHp = heroMaxHp;
  won = false;
  stats = {
    rounds: 0,
    votedRounds: 0,
    unitySum: 0,
    bestUnity: 0,
    dealt: 0,
    taken: 0,
    healed: 0,
    blocked: 0,
    riddlesRight: 0,
    riddlesWrong: 0,
    miragesHit: 0,
    curses: 0,
    poisoned: 0,
    enemies: 0,
  };
  seenIntents = {};
  riddleQueue = shuffle(RIDDLES);
  particles = [];
  floatingTexts = [];
  fields = createFields();
  aimButtons = createAimButtons();
  lastTime = performance.now();
  startFight();
}

function startButton(y = 760) {
  return guiFillButton({
    label: 'START',
    posX: W / 2,
    posY: y,
    speedDown: 12,
    speedUp: 25,
    // kein keyCode: sonst ignoriert fillButton das Laser-Grid; Leertaste wird separat abgefragt
    edges: 6,
    activeValue: 90,
    radius: 140,
    normalColor: COL.textHi,
    activeColor: COL.good,
    growColor: COL.sun,
    onEnterActive: () => resetGame(),
    onExitActive: () => {},
  });
}

// --- Zeichnen: Szene ---
function renderBackground(ctx) {
  ctx.drawImage(sprites.sky, 0, 0);
  const layers = [
    [sprites.duneFar, 0.15],
    [sprites.duneMid, 0.35],
    [sprites.duneNear, 0.7],
  ];
  layers.forEach(([img, speed]) => {
    const off = -((travel * speed) % (W * 2));
    ctx.drawImage(img, off, 0);
    ctx.drawImage(img, off + W * 2, 0);
  });
}

function renderBridge(ctx) {
  ctx.save();
  // hintere Seile
  ctx.strokeStyle = COL.rope;
  ctx.lineWidth = 5;
  ctx.beginPath();
  for (let x = BRIDGE_X0; x <= BRIDGE_X1; x += 20) {
    const y = bridgeY(x) - 95;
    if (x === BRIDGE_X0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  }
  ctx.stroke();
  // Planken
  for (let x = BRIDGE_X0; x < BRIDGE_X1; x += 34) {
    const y = bridgeY(x + 15);
    ctx.fillStyle = (x / 34) % 2 < 1 ? COL.plank : COL.plankDark;
    ctx.fillRect(x, y - 6, 30, 16);
  }
  // vordere Seile + Hänger
  ctx.strokeStyle = COL.rope;
  ctx.lineWidth = 6;
  ctx.beginPath();
  for (let x = BRIDGE_X0; x <= BRIDGE_X1; x += 20) {
    const y = bridgeY(x) - 70;
    if (x === BRIDGE_X0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  }
  ctx.stroke();
  ctx.lineWidth = 3;
  for (let x = BRIDGE_X0 + 40; x < BRIDGE_X1; x += 80) {
    ctx.beginPath();
    ctx.moveTo(x, bridgeY(x) - 70);
    ctx.lineTo(x, bridgeY(x));
    ctx.stroke();
  }
  // Pfosten
  ctx.fillStyle = COL.plankDark;
  [BRIDGE_X0 - 10, BRIDGE_X1 - 10].forEach((x) => ctx.fillRect(x, BRIDGE_Y - 120, 20, 130));
  ctx.restore();
}

function renderHeroes(ctx, elapsed) {
  let dash = 0;
  if (phase === 'hero' && action && action.type === 0 && enemy && enemy.intent.key !== 'riddle') {
    const t = phaseTime / DIFFICULTY.heroPhaseTime;
    dash = Math.sin(clamp01(t * 1.6) * Math.PI) * 280;
  }
  const hurtJitter = heroHurt > 0 ? (Math.random() - 0.5) * 16 : 0;
  HERO_X.forEach((hx, i) => {
    const x = hx + dash + hurtJitter;
    const y = bridgeY(x);
    const bob = Math.sin(gameTime * 4 + i * 1.3) * 4;
    ctx.save();
    ctx.translate(x, y + bob);
    // Umhang
    ctx.fillStyle = COL.hero[i];
    ctx.beginPath();
    ctx.moveTo(-24, -10);
    ctx.lineTo(24, -10);
    ctx.lineTo(16, -70);
    ctx.lineTo(-16, -70);
    ctx.closePath();
    ctx.fill();
    // Kopf
    ctx.fillStyle = COL.skin;
    ctx.beginPath();
    ctx.arc(0, -86, 17, 0, Math.PI * 2);
    ctx.fill();
    // Ausrüstung
    ctx.strokeStyle = COL.white;
    ctx.fillStyle = COL.hero[i];
    ctx.lineWidth = 5;
    ctx.lineCap = 'round';
    if (i === 0) {
      ctx.beginPath();
      ctx.moveTo(18, -50);
      ctx.lineTo(48, -100 + bob);
      ctx.stroke();
    } else if (i === 1) {
      ctx.beginPath();
      ctx.arc(26, -45, 20, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
    } else if (i === 2) {
      ctx.beginPath();
      ctx.moveTo(26, -10);
      ctx.lineTo(26, -110);
      ctx.stroke();
      ctx.fillStyle = COL.heal;
      ctx.fillRect(18, -122, 16, 16);
    } else {
      ctx.beginPath();
      ctx.moveTo(26, -10);
      ctx.lineTo(30, -115);
      ctx.stroke();
      ctx.save();
      ctx.shadowColor = COL.spell;
      ctx.shadowBlur = 20;
      ctx.fillStyle = COL.spell;
      ctx.beginPath();
      ctx.arc(30, -122, 10 + Math.sin(gameTime * 6) * 2, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
      // Spitzhut
      ctx.fillStyle = COL.hero[i];
      ctx.beginPath();
      ctx.moveTo(-20, -96);
      ctx.lineTo(20, -96);
      ctx.lineTo(4, -135);
      ctx.closePath();
      ctx.fill();
    }
    ctx.restore();
  });
  // Statuseffekte
  if (poison > 0 && Math.random() < elapsed * 12) sparkle(HERO_X[0] + Math.random() * 300, BRIDGE_Y - 20, COL.poison, -80);
  if (curse > 0 && Math.random() < elapsed * 12) sparkle(HERO_X[0] + Math.random() * 300, BRIDGE_Y - 140, COL.curse, 40);
  // Schildkuppel
  const showShield =
    shieldBlock > 0.05 && (phase === 'enemy' || (phase === 'hero' && phaseTime > DIFFICULTY.heroPhaseTime * 0.3));
  if (showShield) {
    const grow = phase === 'hero' ? clamp01((phaseTime / DIFFICULTY.heroPhaseTime - 0.3) * 3) : 1;
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    ctx.globalAlpha = 0.25 + 0.35 * shieldBlock;
    ctx.strokeStyle = COL.shield;
    ctx.fillStyle = COL.shield;
    ctx.shadowColor = COL.shield;
    ctx.shadowBlur = 40;
    ctx.lineWidth = 10;
    const c = heroCenter();
    ctx.beginPath();
    ctx.ellipse(c.x, BRIDGE_Y + 10, 230 * grow, 190 * grow, 0, Math.PI, 0);
    ctx.stroke();
    ctx.globalAlpha *= 0.3;
    ctx.fill();
    ctx.restore();
  }
}

/** Aura, die den angekündigten Zug sichtbar macht */
function renderIntentAura(ctx, x, y, size) {
  const it = enemy.intent.key;
  const charge = phase === 'vote' ? clamp01(phaseTime / voteTime()) : 1;
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  if (it === 'fire' || it === 'erupt') {
    const r = 30 + 70 * charge + Math.sin(gameTime * 20) * 6;
    ctx.shadowColor = COL.fire;
    ctx.shadowBlur = 50;
    ctx.fillStyle = COL.fire;
    ctx.globalAlpha = 0.8;
    ctx.beginPath();
    ctx.arc(x - size * 0.35, y - size * 0.75, r, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = COL.fireHot;
    ctx.beginPath();
    ctx.arc(x - size * 0.35, y - size * 0.75, r * 0.5, 0, Math.PI * 2);
    ctx.fill();
  } else if (it === 'curse') {
    ctx.strokeStyle = COL.curse;
    ctx.shadowColor = COL.curse;
    ctx.shadowBlur = 25;
    ctx.lineWidth = 6;
    for (let k = 0; k < 6; k++) {
      const a = gameTime * 2 + (k / 6) * Math.PI * 2;
      const rx = x + Math.cos(a) * size * 0.9;
      const ry = y - size * 0.6 + Math.sin(a) * size * 0.35;
      ctx.beginPath();
      ctx.moveTo(rx - 12, ry - 12);
      ctx.lineTo(rx + 12, ry + 12);
      ctx.moveTo(rx + 12, ry - 12);
      ctx.lineTo(rx, ry + 16);
      ctx.stroke();
    }
  } else if (it === 'weak') {
    ctx.fillStyle = COL.sun;
    for (let k = 0; k < 4; k++) {
      const a = gameTime * 3 + (k / 4) * Math.PI * 2;
      ctx.beginPath();
      ctx.arc(x + Math.cos(a) * 70, y - size * 1.25 + Math.sin(a) * 18, 9, 0, Math.PI * 2);
      ctx.fill();
    }
  } else if (it === 'riddle') {
    ctx.shadowColor = COL.eye;
    ctx.shadowBlur = 30;
    ctx.globalAlpha = 0.5 + 0.3 * Math.sin(gameTime * 4);
    ctx.font = 'bold 150px Verdana';
    ctx.textAlign = 'center';
    ctx.fillStyle = COL.eye;
    ctx.fillText('?', x + size * 0.7, y - size * 0.9);
  }
  ctx.restore();
}

function drawGolem(ctx, s, t, weak) {
  const sway = Math.sin(t * 2) * 0.05;
  ctx.save();
  if (weak) ctx.scale(1, 0.9);
  ctx.fillStyle = COL.stoneDark;
  ctx.fillRect(-90, -110, 60, 110);
  ctx.fillRect(30, -110, 60, 110);
  ctx.rotate(sway);
  ctx.fillStyle = COL.stone;
  ctx.fillRect(-130, -310, 260, 210);
  ctx.fillStyle = COL.stoneDark;
  ctx.fillRect(-130, -230, 260, 12);
  ctx.fillRect(-20, -300, 12, 200);
  // Arme
  const arm = Math.sin(t * 3) * 15;
  ctx.fillStyle = COL.stone;
  ctx.fillRect(-200, -300 + arm, 70, 190);
  ctx.fillRect(130, -300 - arm, 70, 190);
  // Kopf
  ctx.fillRect(-65, -400, 130, 95);
  ctx.shadowColor = COL.eye;
  ctx.shadowBlur = 25;
  ctx.fillStyle = COL.eye;
  ctx.fillRect(-45, -370, 30, 16);
  ctx.fillRect(15, -370, 30, 16);
  ctx.restore();
}

function drawScorpion(ctx, s, t, sting) {
  ctx.save();
  const walk = Math.sin(t * 5);
  ctx.strokeStyle = COL.scorpionDark;
  ctx.lineWidth = 10;
  ctx.lineCap = 'round';
  for (let k = 0; k < 4; k++) {
    for (const side of [-1, 1]) {
      ctx.beginPath();
      ctx.moveTo(-60 + k * 45, -60);
      ctx.lineTo(-80 + k * 45 + side * 20, -30 + side * walk * 6);
      ctx.lineTo(-90 + k * 45 + side * 10, 0);
      ctx.stroke();
    }
  }
  // Körper
  ctx.fillStyle = COL.scorpion;
  for (let k = 0; k < 4; k++) {
    ctx.beginPath();
    ctx.ellipse(-90 + k * 60, -70, 55, 40, 0, 0, Math.PI * 2);
    ctx.fill();
  }
  // Scheren (zu den Helden)
  for (const dy of [-30, 20]) {
    ctx.beginPath();
    ctx.ellipse(-200, -90 + dy + walk * 4, 50, 26, -0.2, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = COL.scorpionDark;
    ctx.beginPath();
    ctx.moveTo(-240, -95 + dy);
    ctx.lineTo(-290, -110 + dy - Math.abs(walk) * 10);
    ctx.lineTo(-245, -80 + dy);
    ctx.fill();
    ctx.fillStyle = COL.scorpion;
  }
  // Schwanz: Bogen nach oben über den Rücken
  const raise = sting ? 1.3 : 1;
  let px = 90;
  let py = -80;
  for (let k = 0; k < 6; k++) {
    const a = -Math.PI / 2 - k * 0.42 * raise + Math.sin(t * 2 + k) * 0.08;
    px += Math.cos(a) * 52 + 20;
    py += Math.sin(a) * 52;
    ctx.beginPath();
    ctx.arc(px - 20, py, 30 - k * 2, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.save();
  ctx.fillStyle = sting ? COL.poison : COL.scorpionDark;
  if (sting) {
    ctx.shadowColor = COL.poison;
    ctx.shadowBlur = 35;
  }
  ctx.beginPath();
  ctx.moveTo(px - 40, py);
  ctx.lineTo(px - 90, py + 40);
  ctx.lineTo(px - 30, py + 20);
  ctx.closePath();
  ctx.fill();
  ctx.restore();
  // Augen
  ctx.shadowColor = COL.eye;
  ctx.shadowBlur = 20;
  ctx.fillStyle = COL.eye;
  ctx.beginPath();
  ctx.arc(-130, -100, 8, 0, Math.PI * 2);
  ctx.arc(-110, -104, 8, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

function drawWorm(ctx, s, t, rise) {
  // rise 0 = abgetaucht, 1 = voll aufgerichtet; Körper kommt aus der Schlucht
  if (rise <= 0.02) return;
  ctx.save();
  const segs = 14;
  const pts = [];
  for (let k = 0; k <= segs; k++) {
    const u = k / segs;
    const y = 150 - u * 560 * rise;
    const x = Math.sin(u * 3 + t * 2) * 50 * u - u * 60;
    pts.push([x, y, 70 - u * 15]);
  }
  pts.forEach(([x, y, r], k) => {
    ctx.fillStyle = k % 2 === 0 ? COL.worm : COL.wormDark;
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();
  });
  const [hx, hy] = pts[pts.length - 1];
  // Maul mit Zahnkranz
  ctx.fillStyle = COL.shadow;
  ctx.beginPath();
  ctx.ellipse(hx - 30, hy, 40, 50, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = COL.white;
  for (let k = 0; k < 8; k++) {
    const a = (k / 8) * Math.PI * 2 + t;
    ctx.beginPath();
    ctx.arc(hx - 30 + Math.cos(a) * 34, hy + Math.sin(a) * 42, 6, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.shadowColor = COL.eye;
  ctx.shadowBlur = 20;
  ctx.fillStyle = COL.eye;
  ctx.beginPath();
  ctx.arc(hx + 10, hy - 50, 10, 0, Math.PI * 2);
  ctx.arc(hx + 30, hy - 40, 8, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

function drawDjinn(ctx, s, t) {
  ctx.save();
  const float = Math.sin(t * 2) * 15;
  ctx.translate(0, float - 20);
  // Rauchschweif
  ctx.fillStyle = COL.djinnDark;
  for (let k = 0; k < 8; k++) {
    ctx.globalAlpha = 0.9 - k * 0.08;
    ctx.beginPath();
    ctx.arc(Math.sin(t * 3 + k * 0.7) * (10 + k * 4), -150 + k * 28, 70 - k * 7, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.globalAlpha = 1;
  // Oberkörper
  ctx.fillStyle = COL.djinn;
  ctx.beginPath();
  ctx.moveTo(-90, -320);
  ctx.lineTo(90, -320);
  ctx.lineTo(50, -150);
  ctx.lineTo(-50, -150);
  ctx.closePath();
  ctx.fill();
  // Arme verschränkt
  ctx.fillStyle = COL.djinnDark;
  ctx.fillRect(-100, -260, 200, 40);
  // Kopf + Turban
  ctx.fillStyle = COL.djinn;
  ctx.beginPath();
  ctx.arc(0, -370, 50, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = COL.nemes2;
  ctx.beginPath();
  ctx.ellipse(0, -410, 60, 32, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.shadowColor = COL.eye;
  ctx.shadowBlur = 25;
  ctx.fillStyle = COL.eye;
  ctx.beginPath();
  ctx.arc(-18, -372, 8, 0, Math.PI * 2);
  ctx.arc(18, -372, 8, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

function drawSphinx(ctx, s, t) {
  ctx.save();
  // Körper (liegender Löwe)
  ctx.fillStyle = COL.sphinx;
  ctx.beginPath();
  ctx.moveTo(-170, -20);
  ctx.quadraticCurveTo(-160, -170, 0, -170);
  ctx.lineTo(170, -150);
  ctx.quadraticCurveTo(230, -120, 220, -10);
  ctx.closePath();
  ctx.fill();
  // Vorderpranken
  ctx.fillRect(-300, -50, 180, 45);
  ctx.fillStyle = COL.sphinxDark;
  ctx.fillRect(-300, -12, 180, 10);
  // Schwanz
  ctx.strokeStyle = COL.sphinxDark;
  ctx.lineWidth = 12;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(210, -40);
  ctx.quadraticCurveTo(290, -60 + Math.sin(t * 3) * 30, 270, -140 + Math.sin(t * 3) * 20);
  ctx.stroke();
  // Kopf mit Nemes-Tuch
  ctx.save();
  ctx.translate(-130, -190);
  ctx.rotate(Math.sin(t * 1.5) * 0.03);
  for (let k = 0; k < 7; k++) {
    ctx.fillStyle = k % 2 === 0 ? COL.nemes1 : COL.nemes2;
    ctx.beginPath();
    ctx.moveTo(-90 + k * 6, 40 - k * 20);
    ctx.lineTo(90 - k * 6, 40 - k * 20);
    ctx.lineTo(80 - k * 6, 20 - k * 20);
    ctx.lineTo(-80 + k * 6, 20 - k * 20);
    ctx.closePath();
    ctx.fill();
  }
  ctx.fillStyle = COL.sphinx;
  ctx.fillRect(-48, -110, 96, 120);
  ctx.fillStyle = COL.nemes2;
  ctx.fillRect(-60, -130, 120, 30);
  ctx.shadowColor = COL.eye;
  ctx.shadowBlur = 30;
  ctx.fillStyle = COL.eye;
  ctx.fillRect(-32, -70, 22, 10);
  ctx.fillRect(10, -70, 22, 10);
  ctx.shadowBlur = 0;
  ctx.fillStyle = COL.sphinxDark;
  ctx.fillRect(-20, -25, 40, 6);
  ctx.restore();
  ctx.restore();
}

function drawEnemyShape(ctx, x, y, t) {
  const it = enemy.intent ? enemy.intent.key : 'hit';
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(0.85, 0.85);
  switch (enemy.def.kind) {
    case 'golem':
      drawGolem(ctx, 1, t, it === 'weak');
      break;
    case 'scorpion':
      drawScorpion(ctx, 1, t, it === 'sting');
      break;
    case 'worm':
      drawWorm(ctx, 1, t, enemy.rise);
      break;
    case 'djinn':
      drawDjinn(ctx, 1, t);
      break;
    case 'sphinx':
      drawSphinx(ctx, 1, t);
      break;
  }
  ctx.restore();
}

function renderEnemy(ctx, elapsed) {
  if (!enemy) return;
  const it = enemy.intent ? enemy.intent.key : 'hit';
  enemy.hurt = Math.max(0, enemy.hurt - elapsed);
  // Sandwurm: ab- und auftauchen
  if (enemy.def.kind === 'worm') {
    const target = it === 'burrow' ? 0 : 1;
    enemy.rise += (target - enemy.rise) * Math.min(1, elapsed * 3);
    if (enemy.rise < 0.3 && Math.random() < elapsed * 20) burst(ENEMY_X + (Math.random() - 0.5) * 200, BRIDGE_Y + 60, COL.worm, 2, 150);
  }
  let lunge = 0;
  if (phase === 'enemy') {
    const t = phaseTime / DIFFICULTY.enemyPhaseTime;
    lunge = -Math.sin(clamp01(t * 1.5) * Math.PI) * 220;
  }
  let x = ENEMY_X + lunge + (enemy.hurt > 0 ? (Math.random() - 0.5) * 30 : 0);
  let y = BRIDGE_Y + (enemy.def.kind === 'djinn' ? 0 : 5);
  if (phase === 'defeat') {
    const d = phaseTime / DIFFICULTY.defeatTime;
    y += d * d * 700;
    if (Math.random() < elapsed * 30) burst(x + (Math.random() - 0.5) * 300, y - 200, COL.white, 3, 300);
  }
  const t = gameTime;

  if (it === 'mirage' && phase !== 'defeat') {
    const fadeOut = enemy.stunned && phase !== 'vote' ? clamp01(phaseTime * 2) : 0;
    MIRAGE_X.forEach((mx, k) => {
      const real = k === enemy.realIndex;
      ctx.save();
      if (real) {
        // nur das echte Ziel wirft einen Schatten
        ctx.fillStyle = COL.shadow;
        ctx.globalAlpha = 0.6;
        ctx.beginPath();
        ctx.ellipse(mx + 60, BRIDGE_Y + 40, 150, 22, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.globalAlpha = 1;
      } else {
        ctx.globalAlpha = (0.85 + 0.15 * Math.sin(t * 9)) * (1 - fadeOut);
      }
      const wob = real ? 0 : Math.sin(t * 7) * 6;
      drawEnemyShape(ctx, mx + wob + (real ? lunge : lunge * 0.6), y, t + k);
      ctx.restore();
      // Zielanzeige (gemessene Beleuchtung)
      if (phase === 'vote') {
        const v = aimButtons[k].getValue() / 100;
        ctx.save();
        ctx.strokeStyle = COL.textHi;
        ctx.globalAlpha = 0.5;
        ctx.lineWidth = 4;
        ctx.setLineDash([14, 12]);
        ctx.lineDashOffset = -t * 30;
        ctx.beginPath();
        ctx.arc(mx, BRIDGE_Y - 150, MIRAGE_R, 0, Math.PI * 2);
        ctx.stroke();
        ctx.setLineDash([]);
        ctx.globalAlpha = 1;
        ctx.lineWidth = 10;
        ctx.shadowColor = COL.textHi;
        ctx.shadowBlur = 20;
        ctx.beginPath();
        ctx.arc(mx, BRIDGE_Y - 150, MIRAGE_R, -Math.PI / 2, -Math.PI / 2 + v * Math.PI * 2);
        ctx.stroke();
        ctx.restore();
        const tot = aim[0] + aim[1];
        if (tot > minVotes()) txt(ctx, `${Math.round((aim[k] / tot) * 100)} %`, mx, BRIDGE_Y + 70, 40, COL.textHi);
      }
    });
    if (phase === 'vote') renderIntentAura(ctx, MIRAGE_X[enemy.realIndex], y, 200);
    return;
  }

  // Schatten
  ctx.save();
  ctx.fillStyle = COL.shadow;
  ctx.globalAlpha = 0.5;
  ctx.beginPath();
  ctx.ellipse(x + 20, BRIDGE_Y + 40, 220, 26, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
  ctx.save();
  if (phase === 'defeat') ctx.globalAlpha = 1 - clamp01(phaseTime / DIFFICULTY.defeatTime);
  drawEnemyShape(ctx, x, y, t);
  ctx.restore();
  if (phase === 'vote' || (phase === 'hero' && it !== 'riddle')) renderIntentAura(ctx, x, y, 220);
}

/** Effekte der Heldenaktion (Schwert-Bogen, Zauberkugel, Heilfunken) */
function renderHeroFx(ctx) {
  if (phase !== 'hero' || !action) return;
  const t = phaseTime / DIFFICULTY.heroPhaseTime;
  const tgt = enemyTarget();
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  if (action.type === 3 && enemy.intent.key !== 'riddle') {
    const u = clamp01(t / 0.3);
    const sx = HERO_X[3] + 30;
    const sy = BRIDGE_Y - 122;
    const x = sx + (tgt.x - sx) * u;
    const yy = sy + (tgt.y - sy) * u - Math.sin(u * Math.PI) * 150;
    if (u < 1) {
      ctx.shadowColor = COL.spell;
      ctx.shadowBlur = 40;
      ctx.fillStyle = COL.spell;
      ctx.beginPath();
      ctx.arc(x, yy, 30 + 20 * action.power, 0, Math.PI * 2);
      ctx.fill();
      sparkle(x, yy, COL.spell, 30);
    }
  } else if (action.type === 0 && enemy.intent.key !== 'riddle' && t > 0.25 && t < 0.6) {
    const a = (t - 0.25) / 0.35;
    ctx.strokeStyle = COL.slash;
    ctx.shadowColor = COL.slash;
    ctx.shadowBlur = 30;
    ctx.lineWidth = 18 * (1 - a) + 4;
    ctx.beginPath();
    ctx.arc(tgt.x - 60, tgt.y, 170, -Math.PI * 0.8 + a * 1.2, -Math.PI * 0.1 + a * 1.2);
    ctx.stroke();
  } else if (action.type === 2 && enemy.intent.key !== 'riddle') {
    ctx.strokeStyle = COL.heal;
    ctx.shadowColor = COL.heal;
    ctx.shadowBlur = 30;
    ctx.lineWidth = 8;
    ctx.globalAlpha = 1 - t;
    const c = heroCenter();
    ctx.beginPath();
    ctx.arc(c.x, c.y, 80 + t * 220, 0, Math.PI * 2);
    ctx.stroke();
  }
  ctx.restore();
}

// --- Zeichnen: Abstimmung und HUD ---
function hexPath(ctx, x, y, r) {
  ctx.beginPath();
  for (let k = 0; k < 6; k++) {
    const a = (k / 6) * Math.PI * 2;
    const px = x + Math.cos(a) * r;
    const py = y + Math.sin(a) * r;
    if (k === 0) ctx.moveTo(px, py);
    else ctx.lineTo(px, py);
  }
  ctx.closePath();
}

function drawActionIcon(ctx, i, x, y, color) {
  ctx.save();
  ctx.translate(x, y);
  ctx.strokeStyle = color;
  ctx.fillStyle = color;
  ctx.lineWidth = 9;
  ctx.lineCap = 'round';
  if (i === 0) {
    ctx.rotate(-Math.PI / 4);
    ctx.beginPath();
    ctx.moveTo(0, -42);
    ctx.lineTo(0, 30);
    ctx.moveTo(-18, 22);
    ctx.lineTo(18, 22);
    ctx.stroke();
  } else if (i === 1) {
    ctx.beginPath();
    ctx.moveTo(-32, -36);
    ctx.lineTo(32, -36);
    ctx.lineTo(28, 6);
    ctx.quadraticCurveTo(20, 32, 0, 42);
    ctx.quadraticCurveTo(-20, 32, -28, 6);
    ctx.closePath();
    ctx.stroke();
  } else if (i === 2) {
    ctx.fillRect(-12, -38, 24, 76);
    ctx.fillRect(-38, -12, 76, 24);
  } else {
    ctx.beginPath();
    for (let k = 0; k < 10; k++) {
      const r = k % 2 === 0 ? 42 : 18;
      const a = -Math.PI / 2 + (k / 10) * Math.PI * 2;
      if (k === 0) ctx.moveTo(Math.cos(a) * r, Math.sin(a) * r);
      else ctx.lineTo(Math.cos(a) * r, Math.sin(a) * r);
    }
    ctx.closePath();
    ctx.fill();
  }
  ctx.restore();
}

function renderFields(ctx) {
  const { total, leader } = voteStatus();
  const riddle = enemy.intent.key === 'riddle' ? enemy.riddle : null;
  const reveal = riddle && phase !== 'vote';
  fields.forEach((f, i) => {
    const x = fieldX(i);
    const share = total > 0 ? votes[i] / total : 0;
    const isLeader = i === leader && total > minVotes();
    const chosen = phase !== 'vote' && action && action.type === i;
    let color = actionColor(i);
    if (reveal && i === riddle.correct) color = COL.good;
    const dim = phase !== 'vote' && !chosen && !(reveal && i === riddle.correct);
    ctx.save();
    ctx.globalAlpha = dim ? 0.35 : 1;
    // Grundfläche
    hexPath(ctx, x, FIELD_Y, FIELD_R);
    ctx.fillStyle = COL.panel;
    ctx.fill();
    // Hitze (aktuell beleuchteter Anteil, geglättet durch die Komponente)
    const heat = f.getValue() / 100;
    if (heat > 0) {
      hexPath(ctx, x, FIELD_Y, FIELD_R * (0.3 + 0.7 * heat));
      ctx.globalAlpha *= 0.35;
      ctx.fillStyle = color;
      ctx.fill();
      ctx.globalAlpha = dim ? 0.35 : 1;
    }
    hexPath(ctx, x, FIELD_Y, FIELD_R);
    ctx.strokeStyle = color;
    ctx.lineWidth = isLeader || chosen ? 10 : 5;
    if (isLeader || chosen) {
      ctx.shadowColor = color;
      ctx.shadowBlur = 30 + Math.sin(gameTime * 8) * 10;
    }
    ctx.stroke();
    ctx.restore();

    ctx.save();
    ctx.globalAlpha = dim ? 0.35 : 1;
    if (riddle) {
      txt(ctx, LETTERS[i], x, FIELD_Y - 20, 64, color);
      txt(ctx, wrapText(riddle.answers[i], 13), x, FIELD_Y + 30, 30, COL.text, 'center', 34);
    } else {
      drawActionIcon(ctx, i, x, FIELD_Y - 25, color);
      txt(ctx, ACTIONS[i].label, x, FIELD_Y + 58, 36, color);
    }
    // Stimmbalken
    const bw = 280;
    const by = FIELD_Y + FIELD_R + 22;
    ctx.strokeStyle = color;
    ctx.lineWidth = 3;
    ctx.strokeRect(x - bw / 2, by, bw, 26);
    ctx.fillStyle = color;
    ctx.fillRect(x - bw / 2, by, bw * share, 26);
    ctx.restore();
    if (total > minVotes() && !dim) txt(ctx, `${Math.round(share * 100)} %`, x, by + 24, 26, COL.white);
    if (!riddle) txt(ctx, `${i + 1}`, x - FIELD_R + 6, FIELD_Y - FIELD_R + 30, 26, COL.text, 'left');
  });
}

function renderVoteInfo(ctx) {
  const { total, best, unity } = voteStatus();
  if (phase === 'vote') {
    const vt = voteTime();
    const remaining = clamp01(1 - phaseTime / vt);
    const bx = 360;
    const bw = W - 720;
    ctx.save();
    ctx.strokeStyle = COL.text;
    ctx.lineWidth = 3;
    ctx.strokeRect(bx, 718, bw, 20);
    ctx.fillStyle = remaining > 0.3 ? COL.textHi : COL.bad;
    ctx.fillRect(bx, 718, bw * remaining, 20);
    ctx.restore();
    const { power } = total > minVotes() ? computePower(best, unity) : { power: 0 };
    const label =
      total > minVotes()
        ? `Einigkeit ${Math.round(unity * 100)} %  ·  Stärke ${Math.round(power * 100)} %  ·  ${Math.ceil(vt - phaseTime)} s`
        : `Leuchtet eure Wahl an!  ·  ${Math.ceil(vt - phaseTime)} s`;
    txt(ctx, label, W / 2, 700, 42, unity > 0.7 ? COL.good : COL.text);
  } else if (resultText) {
    txt(ctx, resultText, W / 2, 712, 42, COL.textHi);
  }
}

function renderIntentBubble(ctx) {
  const it = enemy.intent.key;
  if (phase === 'defeat') return;
  const def = INTENTS[it];
  const bx = W / 2;
  if (it === 'riddle') {
    // Rätsel gross oben in der Mitte
    ctx.save();
    ctx.fillStyle = COL.panel;
    ctx.globalAlpha = 0.85;
    ctx.fillRect(260, 125, W - 520, 170);
    ctx.globalAlpha = 1;
    ctx.strokeStyle = COL.eye;
    ctx.lineWidth = 5;
    ctx.strokeRect(260, 125, W - 520, 170);
    ctx.restore();
    txt(ctx, `${enemy.def.name} fragt:`, W / 2, 170, 34, COL.eye);
    txt(ctx, wrapText(enemy.riddle.q, 52), W / 2, 225, 46, COL.white, 'center', 56);
    return;
  }
  const by = 195;
  const pulse = 1 + Math.sin(gameTime * 4) * 0.02;
  const border = it === 'fire' || it === 'erupt' ? COL.fire : COL.textHi;
  ctx.save();
  ctx.translate(bx, by);
  ctx.scale(pulse, pulse);
  ctx.fillStyle = COL.panel;
  ctx.globalAlpha = 0.85;
  ctx.beginPath();
  ctx.ellipse(0, 0, 440, 78, 0, 0, Math.PI * 2);
  ctx.fill();
  // Zipfel Richtung Wächter
  ctx.beginPath();
  ctx.moveTo(300, 40);
  ctx.lineTo(430, 130);
  ctx.lineTo(220, 60);
  ctx.closePath();
  ctx.fill();
  ctx.globalAlpha = 1;
  ctx.strokeStyle = border;
  ctx.lineWidth = 5;
  ctx.beginPath();
  ctx.ellipse(0, 0, 440, 78, 0, 0, Math.PI * 2);
  ctx.stroke();
  ctx.restore();
  txt(ctx, enemy.def.name, bx, by - 22, 32, COL.textHi);
  txt(ctx, def.text, bx, by + 32, 48, COL.white);
  if (phase === 'vote' && (level === 1 || enemy.intent.firstTime)) {
    txt(ctx, `Tipp: ${def.hint}`, bx, by + 120, 32, COL.textHi);
  }
}

function renderBar(ctx, x, y, w, h, frac, color, alignRight = false) {
  ctx.save();
  ctx.fillStyle = COL.panel;
  ctx.fillRect(x, y, w, h);
  ctx.fillStyle = color;
  const fw = w * clamp01(frac);
  ctx.fillRect(alignRight ? x + w - fw : x, y, fw, h);
  ctx.strokeStyle = COL.white;
  ctx.lineWidth = 3;
  ctx.strokeRect(x, y, w, h);
  ctx.restore();
}

function renderHud(ctx) {
  renderBar(ctx, 40, 30, 560, 34, heroHp / heroMaxHp, COL.hpHero);
  let status = '';
  if (poison > 0) status += `  Gift ${poison}`;
  if (curse > 0) status += `  Fluch ${curse}`;
  txt(ctx, `Helden ${heroHp}/${heroMaxHp}${status}`, 40, 105, 40, heroHurt > 0 ? COL.bad : COL.text, 'left');
  if (enemy) {
    enemy.shownHp += (enemy.hp - enemy.shownHp) * 0.15;
    renderBar(ctx, W - 600, 30, 560, 34, enemy.shownHp / enemy.maxHp, COL.hpEnemy, true);
    txt(ctx, `${enemy.def.name} ${Math.ceil(enemy.hp)}/${enemy.maxHp}`, W - 40, 105, 40, COL.text, 'right');
  }
  txt(ctx, `Brücke ${level}/${ENEMIES.length} · Runde ${round}`, W / 2, 62, 44, COL.textHi);
}

function updateParticles(ctx, elapsed) {
  ctx.save();
  for (let i = particles.length - 1; i >= 0; i--) {
    const p = particles[i];
    p.life += elapsed;
    if (p.life >= p.maxLife) {
      particles.splice(i, 1);
      continue;
    }
    p.vy += p.gravity * elapsed;
    p.x += p.vx * elapsed;
    p.y += p.vy * elapsed;
    ctx.globalAlpha = 1 - p.life / p.maxLife;
    ctx.globalCompositeOperation = p.glow ? 'lighter' : 'source-over';
    ctx.fillStyle = p.color;
    if (p.glow) {
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.size / 2, 0, Math.PI * 2);
      ctx.fill();
    } else ctx.fillRect(p.x - p.size / 2, p.y - p.size / 2, p.size, p.size);
  }
  ctx.restore();
}

function updateFloatingTexts(ctx, elapsed) {
  for (let i = floatingTexts.length - 1; i >= 0; i--) {
    const t = floatingTexts[i];
    t.time += elapsed;
    if (t.time >= t.duration) {
      floatingTexts.splice(i, 1);
      continue;
    }
    ctx.save();
    ctx.globalAlpha = 1 - t.time / t.duration;
    const pop = t.time < 0.15 ? 0.6 + (t.time / 0.15) * 0.4 : 1;
    txt(ctx, t.text, t.x, t.y - t.time * 60, Math.round(t.size * pop), t.color);
    ctx.restore();
  }
}

function renderFlash(ctx, elapsed) {
  if (flash <= 0) return;
  ctx.save();
  ctx.globalAlpha = Math.min(0.45, flash * 0.45);
  ctx.fillStyle = flashColor;
  ctx.fillRect(0, 0, W, H);
  ctx.restore();
  flash = Math.max(0, flash - elapsed * 2);
}

function renderScene(ctx, elapsed, withHeroes = true) {
  renderBackground(ctx);
  ctx.drawImage(sprites.canyon, 0, 0);
  // Sandwurm kommt aus der Schlucht: hinter der Brücke zeichnen
  if (enemy && enemy.def.kind === 'worm' && gameState === 'game') renderEnemy(ctx, elapsed);
  renderBridge(ctx);
  if (withHeroes) renderHeroes(ctx, elapsed);
  if (enemy && enemy.def.kind !== 'worm' && gameState === 'game') renderEnemy(ctx, elapsed);
}

// --- Bildschirme ---
function handleStart(grid, elapsed, ctx) {
  gameTime += elapsed;
  travel += elapsed * 40;
  renderBackground(ctx);
  ctx.drawImage(sprites.canyon, 0, 0);
  renderBridge(ctx);
  renderHeroes(ctx, elapsed);
  updateParticles(ctx, elapsed);
  ctx.save();
  ctx.shadowColor = COL.sun;
  ctx.shadowBlur = 40;
  txt(ctx, 'BRÜCKENWÄCHTER', W / 2, 260, 150, COL.textHi);
  ctx.restore();
  txt(
    ctx,
    'Fünf Wächter, fünf Brücken. Lest ihre Ankündigung und\nstimmt gemeinsam ab: Angriff, Schild, Heilen oder Zauber.\nJe einiger ihr seid, desto stärker der Zug!',
    W / 2,
    360,
    44,
    COL.white,
    'center',
    60
  );
  buttonsStart.forEach((b) => b.handle(grid, elapsed));
  if (spacePressed && gameState === 'start') resetGame();
}

function handleGame(grid, elapsed, ctx) {
  gameTime += elapsed;
  stateTime += elapsed;
  phaseTime += elapsed;
  travel += elapsed * 6;
  heroHurt = Math.max(0, heroHurt - elapsed);

  // Tastatur-Test
  if (keyPressedOnce('KeyL') && phase !== 'defeat') {
    enemy.hp = 0;
    enemy.hurt = 0.5;
    enemyDefeated();
  }
  const endVoteKey = keyPressedOnce('Enter');

  if (phase === 'vote') {
    // Stimmen sammeln: beleuchteter Flächenanteil pro Feld (gedeckelt)
    fields.forEach((f, i) => {
      f.handle(grid, elapsed);
      const fp = f.getFillPercent();
      if (fp > DIFFICULTY.minPercent) votes[i] += fp * elapsed;
      if (laserConfig.pressedKeys[FIELD_KEYS[i]]) {
        votes[i] += DIFFICULTY.fullPercent * elapsed;
        f.setValue(Math.min(100, f.getValue() + (100 / 1.5) * elapsed));
      }
    });
    if (enemy.intent.key === 'mirage') {
      aimButtons.forEach((b, k) => {
        b.handle(grid, elapsed);
        const fp = b.getFillPercent();
        if (fp > DIFFICULTY.minPercent) aim[k] += fp * elapsed;
        if (laserConfig.pressedKeys[k === 0 ? 'KeyA' : 'KeyD']) {
          aim[k] += DIFFICULTY.fullPercent * elapsed;
          b.setValue(Math.min(100, b.getValue() + (100 / 1.5) * elapsed));
        }
      });
    }
    const vt = voteTime();
    const sec = Math.ceil(vt - phaseTime);
    if (sec <= 3 && sec !== lastTickSecond && sec > 0) {
      lastTickSecond = sec;
      playSound(soundTick, 0.5);
    }
    const { best, unity } = voteStatus();
    const quick =
      phaseTime >= DIFFICULTY.voteMinTime &&
      best >= DIFFICULTY.fullPercent * DIFFICULTY.quickVotes &&
      unity >= DIFFICULTY.quickUnity;
    if (phaseTime >= vt || quick || endVoteKey) decideAction();
  } else if (phase === 'hero') {
    if (!applied && phaseTime >= DIFFICULTY.heroPhaseTime * 0.35) {
      applied = true;
      resolveHero();
      if (curse > 0 && action.type !== 3) curse--;
    }
    if (phaseTime >= DIFFICULTY.heroPhaseTime) {
      if (enemy.hp <= 0) enemyDefeated();
      else if (heroHp <= 0) endGame(false);
      else {
        phase = 'enemy';
        phaseTime = 0;
        applied = false;
      }
    }
  } else if (phase === 'enemy') {
    if (!applied && phaseTime >= DIFFICULTY.enemyPhaseTime * 0.4) {
      applied = true;
      resolveEnemy();
    }
    if (phaseTime >= DIFFICULTY.enemyPhaseTime) endOfRound();
  } else if (phase === 'defeat') {
    if (phaseTime >= DIFFICULTY.defeatTime) {
      if (level >= ENEMIES.length) endGame(true);
      else enterOasis();
    }
  }
  if (gameState !== 'game') return;

  shake = Math.max(0, shake - elapsed);
  ctx.save();
  if (shake > 0) {
    const s = shake * 30;
    ctx.translate((Math.random() - 0.5) * s, (Math.random() - 0.5) * s);
  }
  renderScene(ctx, elapsed);
  renderHeroFx(ctx);
  updateParticles(ctx, elapsed);
  ctx.restore();
  renderIntentBubble(ctx);
  renderFields(ctx);
  renderVoteInfo(ctx);
  updateFloatingTexts(ctx, elapsed);
  renderHud(ctx);
  if (phase === 'defeat') {
    txt(ctx, `${enemy.def.name} ist besiegt!`, W / 2, 420, 100, COL.textHi);
  }
  renderFlash(ctx, elapsed);
}

function handleLevelUp(grid, elapsed, ctx) {
  gameTime += elapsed;
  stateTime += elapsed;
  // die Karawane zieht weiter: Dünen ziehen schnell vorbei
  travel += elapsed * 260;
  renderBackground(ctx);
  ctx.drawImage(sprites.oasis, W / 2 - 450, 330);
  const walk = Math.sin(gameTime * 10) * 5;
  HERO_X.forEach((hx, i) => {
    ctx.save();
    ctx.translate(hx - 100, 690 + (i % 2 ? walk : -walk));
    ctx.fillStyle = COL.hero[i];
    ctx.fillRect(-20, -70, 40, 60);
    ctx.fillStyle = COL.skin;
    ctx.beginPath();
    ctx.arc(0, -86, 17, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  });
  if (Math.random() < elapsed * 25) sparkle(W / 2 + (Math.random() - 0.5) * 600, 680, COL.heal, -150);
  updateParticles(ctx, elapsed);
  const t = Math.min(1, stateTime * 3);
  ctx.save();
  ctx.translate(W / 2, 230);
  ctx.scale(0.5 + 0.5 * t, 0.5 + 0.5 * t);
  ctx.shadowColor = COL.water;
  ctx.shadowBlur = 40;
  txt(ctx, 'OASE', 0, 0, 170, COL.water);
  ctx.restore();
  txt(ctx, `LEVEL ${level}`, W / 2, 330, 70, COL.textHi);
  txt(ctx, oasisText, W / 2, 790, 42, COL.white, 'center', 56);
  const next = ENEMIES[level - 1];
  txt(ctx, `Nächste Brücke: ${next.name}\n${next.intro}`, W / 2, 920, 38, COL.textHi, 'center', 50);
  renderHud(ctx);
  if (stateTime >= DIFFICULTY.oasisTime) startFight();
}

function handleGameOver(grid, elapsed, ctx) {
  gameTime += elapsed;
  stateTime += elapsed;
  travel += elapsed * 20;
  renderBackground(ctx);
  ctx.drawImage(sprites.canyon, 0, 0);
  renderBridge(ctx);
  if (won) {
    renderHeroes(ctx, elapsed);
    if (Math.random() < elapsed * 8)
      burst(200 + Math.random() * (W - 400), 150 + Math.random() * 300, COL.hero[Math.floor(Math.random() * 4)], 25, 450, 150);
  }
  updateParticles(ctx, elapsed);
  updateFloatingTexts(ctx, elapsed);
  txt(ctx, won ? 'Die Sphinx ist besiegt!' : 'Die Helden sind gefallen', W / 2, 170, 110, won ? COL.textHi : COL.bad);
  const avgUnity = stats.votedRounds > 0 ? Math.round((stats.unitySum / stats.votedRounds) * 100) : 0;
  txt(
    ctx,
    `${won ? 'Alle fünf Brücken gehören euch!' : `Gescheitert an Brücke ${level}: ${ENEMIES[level - 1].name}`}\n` +
      `${stats.enemies} Wächter besiegt · ${stats.rounds} Runden · Ø Einigkeit ${avgUnity} % (beste ${Math.round(
        stats.bestUnity * 100
      )} %)\n` +
      `Schaden ausgeteilt ${stats.dealt} · erlitten ${stats.taken} · geheilt ${stats.healed}\n` +
      `Rätsel: ${stats.riddlesRight} richtig, ${stats.riddlesWrong} falsch · Trugbilder durchschaut: ${stats.miragesHit}`,
    W / 2,
    290,
    42,
    COL.white,
    'center',
    62
  );
  buttonsGameOver.forEach((b) => b.handle(grid, elapsed));
  if (spacePressed && gameState === 'gameover') resetGame();
}

export default {
  name: 'Brückenwächter',
  description: `
Rundenbasiertes Abenteuer für alle!

Eure Heldengruppe muss fünf Brücken in der Wüste überqueren.
Jede wird von einem Wächter bewacht – am Ende wartet die Sphinx.

Der Wächter kündigt seinen nächsten Zug an. Ihr stimmt ab,
indem ihr eins der vier Felder unten anleuchtet:
ANGRIFF, SCHILD, HEILEN oder ZAUBER.

Je einiger ihr euch seid, desto stärker wird der Zug!
Wer wild auf alle Felder leuchtet, schwächt die ganze Gruppe.

Die Sphinx stellt Rätsel – leuchtet die richtige Antwort an.`,
  image: 'media/img/gametitles/laser-basefight-###4###.png',
  init: function () {
    updateColors();
    renderSprites();
    gameState = 'start';
    phase = 'vote';
    enemy = null;
    level = 1;
    round = 0;
    heroMaxHp = DIFFICULTY.heroHp;
    heroHp = heroMaxHp;
    curse = 0;
    poison = 0;
    shieldBlock = 0;
    action = null;
    particles = [];
    floatingTexts = [];
    fields = [];
    aimButtons = [];
    gameTime = 0;
    travel = 0;
    shake = 0;
    flash = 0;
    buttonsStart = [startButton()];
    buttonsGameOver = [];
    previousKeys = {};
    lastTime = performance.now();
  },
  handle: function (grid) {
    const elapsed = getDelta();
    const ctx = MasterCanvas.get2dContext();
    // jeden Frame abfragen, damit der Tastenzustand nie veraltet
    spacePressed = keyPressedOnce('Space');
    switch (gameState) {
      case 'start':
        handleStart(grid, elapsed, ctx);
        break;
      case 'game':
        handleGame(grid, elapsed, ctx);
        break;
      case 'levelup':
        handleLevelUp(grid, elapsed, ctx);
        break;
      case 'gameover':
        handleGameOver(grid, elapsed, ctx);
        break;
    }
  },
  stop: function () {
    activeSounds.slice().forEach((a) => a.pause());
    activeSounds = [];
  },
};
