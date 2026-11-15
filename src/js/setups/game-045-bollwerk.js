/**
 * Laser-Bollwerk – Pseudo-Tower-Defense für viele Laser (Weiterentwicklung von game-020-defender)
 *
 * In der Mitte steht der Kern. Vom Rand rollen Kugeln in Wellen auf ihn zu.
 * - ABSCHIESSEN: Kugeln anleuchten, bis sie platzen (mehr Laser = schneller). Gibt Energie.
 * - TÜRME BAUEN: Unten liegen drei Bau-Knöpfe. Knopf füllen = Turm kaufen (kostet Energie).
 *   Der neue Turm erscheint als Bauplan und FOLGT den Lasern (wie die Base-Babys in 020).
 *   Nach ein paar Sekunden rastet er ein und richtet sich von selbst zum Kern aus.
 * - Türme schiessen nicht, sie LENKEN AB – und nehmen bei jeder Kollision Schaden, bis sie zerbrechen:
 *     Kreis   (billig)  : lenkt je nach Auftreffpunkt irgendwohin ab – Glückssache
 *     Dreieck (mittel)  : Spitze zeigt nach aussen, teilt den Strom links/rechts am Kern vorbei
 *     Viereck (teuer)   : flache Seite nach aussen, wirft Kugeln genau dorthin zurück, wo sie herkamen
 * - Abgelenkte Kugeln, die das Spielfeld verlassen, sind erledigt.
 * - Erreicht eine Kugel den Kern, nimmt er Schaden. Kern kaputt = Game Over.
 *
 * 12 Wellen, jede bringt etwas Neues:
 *  1 Kugeln + Kreis-Turm        2 Dreieck-Turm            3 Viereck-Turm + Flitzer
 *  4 Panzerkugeln (Schild hält Laser ab, erst ein Turm knackt ihn)
 *  5 Energiekapseln (NICHT abschiessen – sie laden den Kern auf)
 *  6 Brocken (zäh, Teamwork)    7 Teiler (zerfallen)      8 Zickzack
 *  9 Zangenangriff (2 Seiten)  10 Koloss (walzt Türme platt, jeder Turm schwächt ihn)
 * 11 Sturm (3 Seiten)          12 Finale mit zwei Kolossen
 *
 * Eingabe nur über gui-Komponenten: pixelFillButton (Gegner, Bau-Knöpfe), followCircle (Bauplan),
 * fillButton (Start).
 *
 * Tastatur-Test: Space = Start, 1/2/3 = Kreis/Dreieck/Viereck kaufen und zufällig platzieren,
 *                K = alle Gegner abschiessen, L = Welle überspringen, E = +100 Energie.
 *
 * Alle Stellschrauben stehen gesammelt in DIFFICULTY, TOWER_TYPES, ENEMY_TYPES und LEVELS.
 */

import util, { getRgbSpreadHex, removeItemFromArray } from '../util.js';
var laserConfig = require('../LaserApiConfig.js').default;
var MasterCanvas = require('../MasterCanvas').default;
var guiFillButton = require('./gui/fillButton').default;
var guiPixelFillButton = require('./gui/pixelFillButton').default;
var guiFollowCircle = require('./gui/followCircle').default;
import soundPop from '../../../public/media/369952__mischy__plop-1.wav';
import soundBoom from '../../../public/media/414346__bykgames__explosion-far.wav';
import soundLevel from '../../../public/media/521966__kastenfrosch__ready-to-start-jingle.ogg';
import soundBoss from '../../../public/media/70299__kizilsungur__sonar.wav';
import soundStomp from '../../../public/media/517267__foolboymedia__cinematic-stomp.wav';

const W = 1920;
const H = 1080;
const CORE = { x: W / 2, y: H / 2, r: 95 };

const DIFFICULTY = {
  coreHp: 20,
  coreRepairPerLevel: 2,
  startEnergy: 80,
  levelBonusBase: 30, // Energie nach jeder Welle
  levelBonusPerLevel: 8,
  levelUpDuration: 7, // Sekunden Baupause zwischen den Wellen
  speedPerLevel: 0.035, // Gegner-Tempo +3,5 % pro Welle
  toughPerLevel: 0.05, // Gegner halten +5 % länger pro Welle
  // Türme
  maxTowers: 16,
  maxGhosts: 3,
  buildTime: 6, // Sekunden, die ein Bauplan den Lasern folgt
  minCoreDist: 240,
  minTowerDist: 170,
  buyFillTime: 1.4, // Sekunden bei voller Abdeckung, bis ein Bau-Knopf auslöst
  deflectSpeedUp: 1.15,
  circleJitter: 0.45, // zufällige Zusatzstreuung des Kreis-Turms (rad)
  // Punkte / Energie
  deflectEnergy: 2,
  capsuleEnergy: 20,
  capsulePenalty: 15,
  maxParticles: 400,
};

// Türme: Preis, Haltbarkeit (Kollisionen), Umkreisradius, ab welcher Welle kaufbar
const TOWER_TYPES = {
  kreis: { label: 'Kreis', cost: 20, hp: 2, r: 58, unlock: 1, hue: 0.4, key: 'Digit1' },
  dreieck: { label: 'Dreieck', cost: 40, hp: 3, r: 85, unlock: 2, hue: 0.5, key: 'Digit2' },
  viereck: { label: 'Viereck', cost: 70, hp: 5, r: 85, unlock: 3, hue: 0.6, key: 'Digit3' },
};
const TOWER_ORDER = ['kreis', 'dreieck', 'viereck'];
const SHOP_Y = 975;
const SHOP_X = { kreis: 700, dreieck: 960, viereck: 1220 };
const SHOP_RADIUS = 80;

// Gegner: killTime = Sekunden bei voller Abdeckung, fullPercent = ab diesem Flächenanteil volle Wirkung
const ENEMY_TYPES = {
  kugel: { r: 34, speed: 85, killTime: 0.6, fullPercent: 12, regen: 20, core: 1, tower: 1, reward: 4, hue: 0.8 },
  flitzer: { r: 28, speed: 190, killTime: 0.35, fullPercent: 12, regen: 20, core: 1, tower: 1, reward: 5, hue: 0.2 },
  panzer: { r: 40, speed: 75, killTime: 0.8, fullPercent: 12, regen: 15, core: 2, tower: 1, reward: 8, hue: 0.7, shield: true },
  brocken: { r: 62, speed: 55, killTime: 3.5, fullPercent: 14, regen: 6, core: 3, tower: 2, reward: 15, hue: 0.75 },
  teiler: { r: 46, speed: 80, killTime: 1.0, fullPercent: 12, regen: 15, core: 2, tower: 1, reward: 6, hue: 0.25, split: 2 },
  splitter: { r: 26, speed: 130, killTime: 0.35, fullPercent: 12, regen: 20, core: 1, tower: 1, reward: 3, hue: 0.25 },
  zickzack: { r: 34, speed: 115, killTime: 0.7, fullPercent: 12, regen: 20, core: 1, tower: 1, reward: 6, hue: 0.84, sway: 0.65 },
  koloss: { r: 110, speed: 30, killTime: 16, fullPercent: 10, regen: 0, core: 10, tower: 99, reward: 80, hue: 0.78, crush: 6 },
  kapsel: { r: 36, speed: 70, killTime: 0.9, fullPercent: 12, regen: 25, core: 0, tower: 0, reward: 0, hue: 0.33, friendly: true },
};

// Wellen: groups × size Gegner je Angriffsrichtung (sectors), gap = Abstand in der Gruppe, pause = zwischen Gruppen
const MIX_ALL = { kugel: 3, flitzer: 2, panzer: 2, brocken: 1, teiler: 2, zickzack: 3 };
const LEVELS = [
  { neu: 'Leuchtet die Kugeln an, bis sie platzen!\nUnten: Kreis-Turm kaufen und mit den Lasern ziehen', groups: 3, size: 5, gap: 0.9, pause: 5, mix: { kugel: 1 } },
  { neu: 'Neu: Dreieck-Turm\nteilt den Strom am Kern vorbei', groups: 4, size: 6, gap: 0.8, pause: 4.5, mix: { kugel: 1 } },
  { neu: 'Neu: Viereck-Turm wirft alles zurück\nAchtung, Flitzer!', groups: 4, size: 7, gap: 0.75, pause: 4.5, mix: { kugel: 4, flitzer: 2 } },
  { neu: 'Panzerkugeln!\nLaser prallen am Schild ab – nur Türme knacken ihn', groups: 4, size: 7, gap: 0.75, pause: 4, mix: { kugel: 4, flitzer: 1, panzer: 3 } },
  { neu: 'Helle Energiekapseln NICHT abschiessen!\nSie laden den Kern auf', groups: 5, size: 7, gap: 0.7, pause: 4, mix: { kugel: 4, flitzer: 2, panzer: 2 }, kapsel: 0.9 },
  { neu: 'Brocken!\nNur gemeinsam kriegt ihr die klein', groups: 5, size: 8, gap: 0.7, pause: 4, mix: { kugel: 4, flitzer: 2, panzer: 2, brocken: 1.5 }, kapsel: 0.5 },
  { neu: 'Teiler zerfallen beim Abschuss\nin zwei flinke Splitter', groups: 5, size: 8, gap: 0.65, pause: 3.5, mix: { kugel: 3, flitzer: 2, panzer: 2, brocken: 1, teiler: 3 }, kapsel: 0.5 },
  { neu: 'Zickzack-Kugeln\nschlängeln sich an Türmen vorbei', groups: 5, size: 9, gap: 0.6, pause: 3.5, mix: MIX_ALL, kapsel: 0.5 },
  { neu: 'Zangenangriff!\nSie kommen von zwei Seiten', groups: 5, size: 6, gap: 0.6, pause: 3.5, sectors: 2, mix: MIX_ALL, kapsel: 0.5 },
  { neu: 'DER KOLOSS\nwalzt Türme platt – alle Laser drauf!', groups: 4, size: 6, gap: 0.6, pause: 4, sectors: 2, mix: MIX_ALL, kapsel: 0.6, boss: 1 },
  { neu: 'Sturm von drei Seiten!', groups: 6, size: 6, gap: 0.5, pause: 3, sectors: 3, mix: MIX_ALL, kapsel: 0.6 },
  { neu: 'FINALE\nZwei Kolosse und alles, was rollt', groups: 6, size: 6, gap: 0.5, pause: 3, sectors: 3, mix: MIX_ALL, kapsel: 0.7, boss: 2 },
];

// --- Zustand ---
var gameState = 'start';
var level = 1;
var score = 0;
var energy = 0;
var coreHp = DIFFICULTY.coreHp;
var gameTime = 0;
var stateTime = 0;
var waveTime = 0;
var lastTime = 0;
var shake = 0;
var coreFlash = 0;
var won = false;
var stats = { shot: 0, deflected: 0, built: 0, lost: 0 };
var spawnQueue = [];
var enemies = [];
var towers = [];
var ghosts = [];
var shopButtons = [];
var particles = [];
var rings = [];
var floatingTexts = [];
var buttonsStart = [];
var buttonsGameOver = [];
var previousKeys = {};
var activeSounds = [];
var lastSoundTime = {};
var COL = {};
var sprites = {};
var background = null;

// --- Helfer ---
function col(hue, sat = 1, val = 1) {
  return getRgbSpreadHex(laserConfig.testColor, hue, sat, val);
}

function hexA(hex, alpha) {
  const a = Math.round(Math.max(0, Math.min(1, alpha)) * 255).toString(16);
  return hex + (a.length === 1 ? '0' + a : a);
}

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

function playSound(snd, volume = 1, minGap = 0.12) {
  if (gameTime - (lastSoundTime[snd] || -10) < minGap) return;
  lastSoundTime[snd] = gameTime;
  const audio = new Audio(snd);
  audio.volume = volume;
  activeSounds.push(audio);
  audio.addEventListener('ended', () => removeItemFromArray(activeSounds, audio));
  audio.play().catch(() => {});
}

function addFloatingText(text, x, y, color, size = 40) {
  floatingTexts.push({ text, x, y, color, size, time: 0, duration: 1.3 });
}

function burst(x, y, color, count = 14, speed = 300) {
  for (let i = 0; i < count && particles.length < DIFFICULTY.maxParticles; i++) {
    const a = Math.random() * Math.PI * 2;
    const s = speed * (0.3 + Math.random() * 0.7);
    particles.push({
      x,
      y,
      vx: Math.cos(a) * s,
      vy: Math.sin(a) * s,
      life: 0,
      maxLife: 0.4 + Math.random() * 0.6,
      size: 4 + Math.random() * 7,
      color,
    });
  }
}

function addRing(x, y, range, color, maxLife = 0.5) {
  rings.push({ x, y, range, color, life: 0, maxLife });
}

function pickWeighted(mix) {
  const keys = Object.keys(mix);
  let sum = 0;
  keys.forEach((k) => (sum += mix[k]));
  let r = Math.random() * sum;
  for (let i = 0; i < keys.length; i++) {
    r -= mix[keys[i]];
    if (r <= 0) return keys[i];
  }
  return keys[0];
}

// --- Farben und vorgerenderte Grafiken (einmal pro init) ---
function makeSprite(size, draw) {
  const c = document.createElement('canvas');
  c.width = c.height = Math.ceil(size);
  const g = c.getContext('2d');
  g.translate(c.width / 2, c.height / 2);
  draw(g);
  return c;
}

// Turmform in lokalen Koordinaten, "aussen" (vom Kern weg) ist +x
function traceTowerShape(g, type, r) {
  g.beginPath();
  if (type === 'kreis') {
    g.arc(0, 0, r, 0, Math.PI * 2);
    return;
  }
  const n = type === 'dreieck' ? 3 : 4;
  const offset = type === 'dreieck' ? 0 : Math.PI / 4;
  for (let i = 0; i < n; i++) {
    const a = offset + (i * Math.PI * 2) / n;
    if (i === 0) g.moveTo(Math.cos(a) * r, Math.sin(a) * r);
    else g.lineTo(Math.cos(a) * r, Math.sin(a) * r);
  }
  g.closePath();
}

function buildTowerSprite(type) {
  const t = TOWER_TYPES[type];
  const light = col(t.hue, 0.35, 1);
  const mid = col(t.hue, 0.85, 0.95);
  const dark = col(t.hue, 1, 0.3);
  return makeSprite((t.r + 40) * 2, (g) => {
    g.lineJoin = 'round';
    g.shadowColor = mid;
    g.shadowBlur = 30;
    const grad = g.createRadialGradient(-t.r * 0.25, -t.r * 0.25, t.r * 0.1, 0, 0, t.r);
    grad.addColorStop(0, hexA(light, 0.9));
    grad.addColorStop(0.6, hexA(mid, 0.6));
    grad.addColorStop(1, hexA(dark, 0.75));
    g.fillStyle = grad;
    traceTowerShape(g, type, t.r);
    g.fill();
    g.shadowBlur = 12;
    g.lineWidth = 7;
    g.strokeStyle = light;
    g.stroke();
    g.shadowBlur = 0;
    g.lineWidth = 3;
    g.strokeStyle = hexA(light, 0.7);
    traceTowerShape(g, type, t.r * 0.55);
    g.stroke();
    g.fillStyle = hexA(light, 0.9);
    g.beginPath();
    g.arc(0, 0, t.r * 0.14, 0, Math.PI * 2);
    g.fill();
  });
}

function buildEnemySprite(name) {
  const t = ENEMY_TYPES[name];
  const sat = t.friendly ? 0.35 : 0.9;
  const light = col(t.hue, sat * 0.35, 1);
  const mid = col(t.hue, sat, 1);
  const dark = col(t.hue, Math.min(1, sat + 0.1), 0.28);
  const r = t.r;
  return makeSprite(r * 3.4, (g) => {
    // Glow
    const glow = g.createRadialGradient(0, 0, r * 0.7, 0, 0, r * 1.65);
    glow.addColorStop(0, hexA(mid, 0.55));
    glow.addColorStop(1, hexA(mid, 0));
    g.fillStyle = glow;
    g.beginPath();
    g.arc(0, 0, r * 1.65, 0, Math.PI * 2);
    //g.fill();
    // Körper (Fahrtrichtung = +x)
    const body = g.createRadialGradient(-r * 0.3, -r * 0.35, r * 0.05, 0, 0, r);
    body.addColorStop(0, mid);
    body.addColorStop(0.45, mid);
    body.addColorStop(1, dark);
    g.fillStyle = body;
    g.beginPath();
    if (name === 'brocken' || name === 'koloss') {
      const n = name === 'koloss' ? 14 : 9;
      for (let i = 0; i < n; i++) {
        const a = (i * Math.PI * 2) / n;
        const rr = r * (i % 2 === 0 ? 1 : name === 'koloss' ? 0.84 : 0.9);
        if (i === 0) g.moveTo(Math.cos(a) * rr, Math.sin(a) * rr);
        else g.lineTo(Math.cos(a) * rr, Math.sin(a) * rr);
      }
      g.closePath();
    } else {
      g.arc(0, 0, r, 0, Math.PI * 2);
    }
    //g.fill();
    g.lineWidth = Math.max(3, r * 0.08);
    g.strokeStyle = light;
    g.stroke();
    // Erkennungszeichen
    g.strokeStyle = hexA(dark, 0.9);
    g.fillStyle = hexA(dark, 0.9);
    g.lineWidth = Math.max(4, r * 0.13);
    g.lineCap = 'round';
    g.lineJoin = 'round';
    g.beginPath();
    if (name === 'flitzer') {
      for (let i = -1; i <= 0; i++) {
        g.moveTo(r * (0.05 + i * 0.4), -r * 0.4);
        g.lineTo(r * (0.45 + i * 0.4), 0);
        g.lineTo(r * (0.05 + i * 0.4), r * 0.4);
      }
      g.stroke();
    } else if (name === 'teiler' || name === 'splitter') {
      g.moveTo(-r * 0.85, 0);
      g.lineTo(r * 0.85, 0);
      g.stroke();
    } else if (name === 'zickzack') {
      g.moveTo(-r * 0.6, -r * 0.3);
      g.lineTo(-r * 0.2, r * 0.3);
      g.lineTo(r * 0.2, -r * 0.3);
      g.lineTo(r * 0.6, r * 0.3);
      g.stroke();
    } else if (name === 'panzer') {
      g.arc(0, 0, r * 0.5, 0, Math.PI * 2);
      g.stroke();
    } else if (name === 'brocken') {
      g.arc(-r * 0.25, -r * 0.1, r * 0.22, 0, Math.PI * 2);
      g.arc(r * 0.3, r * 0.3, r * 0.14, 0, Math.PI * 2);
    //  g.fill();
    } else if (name === 'koloss') {
      // böses Auge in Fahrtrichtung
      g.fillStyle = dark;
      g.arc(r * 0.3, 0, r * 0.38, 0, Math.PI * 2);
      g.fill();
      g.fillStyle = light;
      g.beginPath();
      g.arc(r * 0.42, 0, r * 0.16, 0, Math.PI * 2);
     g.fill();
    } else if (name === 'kapsel') {
      g.strokeStyle = hexA(light, 0.95);
      g.moveTo(-r * 0.45, 0);
      g.lineTo(r * 0.45, 0);
      g.moveTo(0, -r * 0.45);
      g.lineTo(0, r * 0.45);
      g.stroke();
    } else {
      g.arc(0, 0, r * 0.3, 0, Math.PI * 2);
       g.fill();
    }
  });
}

function buildGraphics() {
  COL = {
    text: col(0.5, 0.2, 1),
    hud: col(0.45, 0.45, 1),
    title: col(0.5, 0.7, 1),
    energy: col(0.62, 0.6, 1),
    warn: col(0.18, 0.9, 1),
    core: col(0.5, 0.7, 1),
    coreLight: col(0.5, 0.25, 1),
    coreDark: col(0.55, 0.9, 0.3),
    shield: col(0.6, 0.3, 1),
    crack: col(0.6, 1, 0.08),
    grid: col(0.6, 0.7, 0.35),
    good: col(0.33, 0.35, 1),
  };
  TOWER_ORDER.forEach((type) => {
    COL[type] = col(TOWER_TYPES[type].hue, 0.8, 1);
    sprites[type] = buildTowerSprite(type);
  });
  Object.keys(ENEMY_TYPES).forEach((name) => {
    const t = ENEMY_TYPES[name];
    COL[name] = col(t.hue, t.friendly ? 0.35 : 0.9, 1);
    sprites[name] = buildEnemySprite(name);
  });

  // Hintergrund: Verlauf, Radarringe, Speichen, Sterne
  background = document.createElement('canvas');
  background.width = W;
  background.height = H;
  const g = background.getContext('2d');
  const grad = g.createRadialGradient(CORE.x, CORE.y, 50, CORE.x, CORE.y, 1100);
  grad.addColorStop(0, col(0.58, 0.8, 0.2));
  grad.addColorStop(0.5, col(0.62, 0.9, 0.1));
  grad.addColorStop(1, col(0.66, 1, 0.03));
  g.fillStyle = grad;
  g.fillRect(0, 0, W, H);
  g.strokeStyle = hexA(COL.grid, 0.35);
  g.lineWidth = 2;
  for (let r = 150; r < 1200; r += 150) {
    g.beginPath();
    g.arc(CORE.x, CORE.y, r, 0, Math.PI * 2);
    g.stroke();
  }
  g.strokeStyle = hexA(COL.grid, 0.18);
  for (let i = 0; i < 24; i++) {
    const a = (i * Math.PI * 2) / 24;
    g.beginPath();
    g.moveTo(CORE.x + Math.cos(a) * 150, CORE.y + Math.sin(a) * 150);
    g.lineTo(CORE.x + Math.cos(a) * 1200, CORE.y + Math.sin(a) * 1200);
    g.stroke();
  }
  for (let i = 0; i < 160; i++) {
    g.fillStyle = hexA(col(0.5 + Math.random() * 0.2, 0.3, 0.8), 0.15 + Math.random() * 0.5);
    const s = 1 + Math.random() * 3;
    g.fillRect(Math.random() * W, Math.random() * H, s, s);
  }
}

// --- Türme ---
function towerVertices(type, x, y, angle) {
  if (type === 'kreis') return null;
  const t = TOWER_TYPES[type];
  const n = type === 'dreieck' ? 3 : 4;
  const offset = type === 'dreieck' ? 0 : Math.PI / 4;
  const verts = [];
  for (let i = 0; i < n; i++) {
    const a = angle + offset + (i * Math.PI * 2) / n;
    verts.push([x + Math.cos(a) * t.r, y + Math.sin(a) * t.r]);
  }
  return verts;
}

function createTower(type, x, y) {
  const t = TOWER_TYPES[type];
  const angle = Math.atan2(y - CORE.y, x - CORE.x);
  const cracks = [];
  for (let i = 0; i < t.hp; i++) {
    const a = Math.random() * Math.PI * 2;
    cracks.push([a, a + 0.5 + Math.random() * 0.8, 0.2 + Math.random() * 0.3]);
  }
  towers.push({ type, t, x, y, angle, hp: t.hp, verts: towerVertices(type, x, y, angle), cracks, flash: 0, age: 0 });
  stats.built++;
  burst(x, y, COL[type], 18, 260);
  addRing(x, y, t.r * 2.2, COL[type], 0.5);
  playSound(soundStomp, 0.35);
}

function destroyTower(tower) {
  removeItemFromArray(towers, tower);
  stats.lost++;
  burst(tower.x, tower.y, COL[tower.type], 30, 420);
  addRing(tower.x, tower.y, tower.t.r * 3, COL[tower.type], 0.6);
  addFloatingText('zerbrochen', tower.x, tower.y - 40, COL.warn, 34);
  playSound(soundBoom, 0.5);
  shake = Math.max(shake, 8);
}

function drawTower(ctx, tower) {
  const s = sprites[tower.type];
  const grow = Math.min(1, tower.age * 4);
  ctx.save();
  ctx.translate(tower.x, tower.y);
  ctx.rotate(tower.angle);
  ctx.scale(grow, grow);
  ctx.drawImage(s, -s.width / 2, -s.height / 2);
  // Risse je verlorenem Haltbarkeitspunkt
  const lost = tower.t.hp - tower.hp;
  if (lost > 0) {
    ctx.strokeStyle = COL.crack;
    ctx.lineWidth = 5;
    ctx.lineCap = 'round';
    ctx.beginPath();
    for (let i = 0; i < lost; i++) {
      const c = tower.cracks[i];
      const r = tower.t.r * 0.62;
      ctx.moveTo(Math.cos(c[0]) * r, Math.sin(c[0]) * r);
      ctx.lineTo(Math.cos(c[0] + 0.4) * r * c[2], Math.sin(c[0] + 0.4) * r * c[2]);
      ctx.lineTo(Math.cos(c[1]) * r * 0.9, Math.sin(c[1]) * r * 0.9);
    }
    ctx.stroke();
  }
  if (tower.flash > 0) {
    ctx.globalCompositeOperation = 'lighter';
    ctx.globalAlpha = Math.min(1, tower.flash * 3);
    ctx.fillStyle = COL.text;
    traceTowerShape(ctx, tower.type, tower.t.r);
    ctx.fill();
  }
  ctx.restore();
  // Haltbarkeitspunkte
  ctx.fillStyle = COL.text;
  for (let i = 0; i < tower.hp; i++) {
    ctx.beginPath();
    ctx.arc(tower.x + (i - (tower.hp - 1) / 2) * 16, tower.y + tower.t.r * 0.32, 5, 0, Math.PI * 2);
    ctx.fill();
  }
}

/**
 * Kugel gegen Turm. Liefert bei Berührung { nx, ny, px, py } (Normale + herausgeschobene Position), sonst null.
 * Kreis: Normale vom Mittelpunkt (hängt vom Auftreffpunkt ab). Vieleck: Normale der getroffenen Kante.
 */
function collideTower(e, tower) {
  const dx = e.x - tower.x;
  const dy = e.y - tower.y;
  const dist = Math.sqrt(dx * dx + dy * dy);
  const reach = tower.t.r + e.t.r;
  if (dist > reach) return null;
  if (!tower.verts) {
    const nx = dist > 0.001 ? dx / dist : 1;
    const ny = dist > 0.001 ? dy / dist : 0;
    return { nx, ny, px: tower.x + nx * (reach + 1), py: tower.y + ny * (reach + 1) };
  }
  const v = tower.verts;
  let inside = true;
  let best = Infinity;
  let bestN = null;
  let bestQ = null;
  let maxS = -Infinity;
  let insideN = null;
  for (let i = 0; i < v.length; i++) {
    const a = v[i];
    const b = v[(i + 1) % v.length];
    const ex = b[0] - a[0];
    const ey = b[1] - a[1];
    const len = Math.sqrt(ex * ex + ey * ey);
    let nx = ey / len;
    let ny = -ex / len;
    if (nx * (a[0] - tower.x) + ny * (a[1] - tower.y) < 0) {
      nx = -nx;
      ny = -ny;
    }
    const s = (e.x - a[0]) * nx + (e.y - a[1]) * ny;
    if (s > 0) inside = false;
    if (s > maxS) {
      maxS = s;
      insideN = [nx, ny];
    }
    const tt = Math.max(0, Math.min(1, ((e.x - a[0]) * ex + (e.y - a[1]) * ey) / (len * len)));
    const qx = a[0] + ex * tt;
    const qy = a[1] + ey * tt;
    const d = Math.sqrt((e.x - qx) * (e.x - qx) + (e.y - qy) * (e.y - qy));
    if (d < best) {
      best = d;
      bestN = [nx, ny];
      bestQ = [qx, qy];
    }
  }
  if (inside) {
    const push = e.t.r - maxS + 1;
    return { nx: insideN[0], ny: insideN[1], px: e.x + insideN[0] * push, py: e.y + insideN[1] * push };
  }
  if (best < e.t.r) {
    return { nx: bestN[0], ny: bestN[1], px: bestQ[0] + bestN[0] * (e.t.r + 1), py: bestQ[1] + bestN[1] * (e.t.r + 1) };
  }
  return null;
}

// --- Baupläne (folgen den Lasern, rasten nach buildTime ein) ---
function clampBuildPosition(pos, ignore) {
  pos.x = Math.max(110, Math.min(W - 110, pos.x));
  pos.y = Math.max(110, Math.min(SHOP_Y - 150, pos.y));
  let dx = pos.x - CORE.x;
  let dy = pos.y - CORE.y;
  let d = Math.sqrt(dx * dx + dy * dy);
  if (d < DIFFICULTY.minCoreDist) {
    if (d < 1) {
      dx = 0;
      dy = -1;
      d = 1;
    }
    pos.x = CORE.x + (dx / d) * DIFFICULTY.minCoreDist;
    pos.y = CORE.y + (dy / d) * DIFFICULTY.minCoreDist;
  }
  towers.forEach((tower) => {
    if (tower === ignore) return;
    const tx = pos.x - tower.x;
    const ty = pos.y - tower.y;
    const td = Math.sqrt(tx * tx + ty * ty);
    if (td < DIFFICULTY.minTowerDist && td > 0.01) {
      pos.x = tower.x + (tx / td) * DIFFICULTY.minTowerDist;
      pos.y = tower.y + (ty / td) * DIFFICULTY.minTowerDist;
    }
  });
  return pos;
}

function createGhost(type) {
  const t = TOWER_TYPES[type];
  const follow = guiFollowCircle({
    label: '',
    posX: SHOP_X[type] + (Math.random() - 0.5) * 60,
    posY: SHOP_Y - 190,
    radius: 100,
    scanRadiusFactor: 1.5,
    speedUp: 0.12,
    speedDown: 0.2,
    visible: false,
  });
  const ghost = { type, t, follow, timer: 0 };
  ghost.handle = (grid, elapsed, ctx) => {
    ghost.timer += elapsed;
    follow.handle(grid, elapsed);
    const pos = clampBuildPosition({ x: follow.getX(), y: follow.getY() });
    follow.setX(pos.x);
    follow.setY(pos.y);
    if (ghost.timer >= DIFFICULTY.buildTime) {
      removeItemFromArray(ghosts, ghost);
      createTower(type, pos.x, pos.y);
      return;
    }
    // Zeichnen: gestrichelter Umriss, Linie zum Kern, Countdown-Bogen
    const angle = Math.atan2(pos.y - CORE.y, pos.x - CORE.x);
    const pulse = 0.6 + 0.3 * Math.sin(gameTime * 8);
    ctx.save();
    ctx.strokeStyle = hexA(COL[type], 0.35);
    ctx.lineWidth = 3;
    ctx.setLineDash([10, 14]);
    ctx.beginPath();
    ctx.moveTo(CORE.x, CORE.y);
    ctx.lineTo(pos.x, pos.y);
    ctx.stroke();
    ctx.translate(pos.x, pos.y);
    ctx.strokeStyle = hexA(COL.text, 0.8);
    ctx.lineWidth = 8;
    ctx.setLineDash([]);
    ctx.beginPath();
    ctx.arc(0, 0, t.r + 22, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * (1 - ghost.timer / DIFFICULTY.buildTime));
    ctx.stroke();
    ctx.rotate(angle);
    ctx.globalAlpha = pulse;
    ctx.fillStyle = hexA(COL[type], 0.25);
    ctx.strokeStyle = COL[type];
    ctx.lineWidth = 6;
    ctx.setLineDash([18, 12]);
    ctx.lineDashOffset = -gameTime * 40;
    traceTowerShape(ctx, type, t.r);
    ctx.fill();
    ctx.stroke();
    ctx.restore();
    util.renderText({ ctx, text: 'ziehen!', x: pos.x, y: pos.y + 10, fontSize: '28px', fillStyle: COL.text });
  };
  ghosts.push(ghost);
  playSound(soundPop, 0.5);
  return ghost;
}

// --- Bau-Knöpfe ---
function canBuy(type) {
  const t = TOWER_TYPES[type];
  return (
    level >= t.unlock &&
    energy >= t.cost &&
    ghosts.length < DIFFICULTY.maxGhosts &&
    towers.length + ghosts.length < DIFFICULTY.maxTowers
  );
}

function buy(type) {
  if (!canBuy(type)) return null;
  energy -= TOWER_TYPES[type].cost;
  addFloatingText('-' + TOWER_TYPES[type].cost, SHOP_X[type], SHOP_Y - 100, COL.energy, 40);
  return createGhost(type);
}

function createShopButton(type) {
  const t = TOWER_TYPES[type];
  const x = SHOP_X[type];
  const button = guiPixelFillButton({
    label: '',
    posX: x,
    posY: SHOP_Y,
    radius: SHOP_RADIUS,
    speedUp: 100 / DIFFICULTY.buyFillTime,
    speedDown: 60,
    fullPercent: 10,
    activeValue: 95,
    counterReset: true,
    visible: false,
    onEnterActive: () => buy(type),
  });
  const handleOriginal = button.handle;
  button.handle = (grid, elapsed, ctx) => {
    const unlocked = level >= t.unlock;
    const affordable = canBuy(type);
    if (affordable) {
      handleOriginal(grid, elapsed);
    } else {
      button.setValue(0);
    }
    if (keyPressedOnce(t.key)) {
      const ghost = buy(type);
      if (ghost) {
        // Tastatur-Test: sofort an zufälliger Stelle einrasten
        const pos = clampBuildPosition({ x: 200 + Math.random() * (W - 400), y: 150 + Math.random() * 650 });
        ghost.follow.setX(pos.x);
        ghost.follow.setY(pos.y);
        ghost.timer = DIFFICULTY.buildTime;
      }
    }
    // Zeichnen
    const s = sprites[type];
    ctx.save();
    ctx.translate(x, SHOP_Y);
    ctx.globalAlpha = unlocked ? (affordable ? 1 : 0.4) : 0.18;
    ctx.fillStyle = hexA(COL.crack, 0.75);
    ctx.strokeStyle = COL[type];
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.arc(0, 0, SHOP_RADIUS, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    const scale = (affordable ? 0.5 + 0.03 * Math.sin(gameTime * 4) : 0.5) * (58 / t.r) * 1.25;
    ctx.save();
    ctx.translate(0, -12);
    ctx.rotate(-Math.PI / 2);
    ctx.scale(scale, scale);
    ctx.drawImage(s, -s.width / 2, -s.height / 2);
    ctx.restore();
    if (button.getValue() > 0) {
      ctx.strokeStyle = COL.text;
      ctx.lineWidth = 10;
      ctx.beginPath();
      ctx.arc(0, 0, SHOP_RADIUS + 10, -Math.PI / 2, -Math.PI / 2 + (Math.PI * 2 * button.getValue()) / 95);
      ctx.stroke();
    }
    ctx.restore();
    util.renderText({
      ctx,
      text: unlocked ? '' + t.cost : 'Welle ' + t.unlock,
      x,
      y: SHOP_Y + 62,
      fontSize: unlocked ? '40px' : '26px',
      fillStyle: unlocked ? (energy >= t.cost ? COL.energy : COL.warn) : COL.hud,
    });
  };
  return button;
}

// --- Gegner ---
function removeEnemy(e) {
  e.dead = true;
  removeItemFromArray(enemies, e);
}

function shotDown(e) {
  if (e.dead) return;
  if (e.t.friendly) {
    energy = Math.max(0, energy - DIFFICULTY.capsulePenalty);
    score -= 30;
    burst(e.x, e.y, COL.warn, 20, 300);
    addFloatingText('Kapsel zerstört  -' + DIFFICULTY.capsulePenalty, e.x, e.y - 50, COL.warn, 40);
    shake = Math.max(shake, 10);
    playSound(soundBoom, 0.4);
  } else {
    stats.shot++;
    energy += e.t.reward;
    score += e.t.reward * 5;
    burst(e.x, e.y, COL[e.type], e.t.r > 60 ? 40 : 14, e.t.r > 60 ? 500 : 300);
    addRing(e.x, e.y, e.t.r * 2.2, COL[e.type], 0.4);
    addFloatingText('+' + e.t.reward, e.x, e.y - e.t.r, COL.energy, e.t.r > 60 ? 60 : 36);
    if (e.type === 'koloss') {
      shake = Math.max(shake, 25);
      playSound(soundBoom, 1);
    } else {
      playSound(soundPop, 0.3);
    }
    if (e.t.split) {
      for (let i = 0; i < e.t.split; i++) {
        const a = Math.atan2(e.dy, e.dx) + (i === 0 ? -0.6 : 0.6);
        const child = createEnemy('splitter', e.x, e.y, Math.cos(a), Math.sin(a));
        child.deflected = e.deflected;
      }
    }
  }
  removeEnemy(e);
}

function hitCore(e) {
  if (e.t.friendly) {
    energy += DIFFICULTY.capsuleEnergy;
    coreHp = Math.min(DIFFICULTY.coreHp, coreHp + 1);
    score += 20;
    burst(e.x, e.y, COL.good, 20, 250);
    addRing(CORE.x, CORE.y, 260, COL.good, 0.7);
    addFloatingText('+' + DIFFICULTY.capsuleEnergy + ' Energie', CORE.x, CORE.y - 130, COL.energy, 44);
    playSound(soundPop, 0.6);
  } else {
    coreHp -= e.t.core;
    coreFlash = 1;
    shake = Math.max(shake, 12 + e.t.core * 3);
    burst(e.x, e.y, COL.warn, 24, 380);
    addRing(CORE.x, CORE.y, 320, COL.warn, 0.6);
    addFloatingText('-' + e.t.core, CORE.x, CORE.y - 130, COL.warn, 60);
    playSound(soundBoom, 0.7);
  }
  removeEnemy(e);
}

function createEnemy(type, x, y, dx, dy) {
  const t = ENEMY_TYPES[type];
  const tough = 1 + DIFFICULTY.toughPerLevel * (level - 1);
  const e = {
    type,
    t,
    x,
    y,
    dx,
    dy,
    speed: t.speed * (1 + DIFFICULTY.speedPerLevel * (level - 1)),
    shield: !!t.shield,
    deflected: false,
    phase: Math.random() * Math.PI * 2,
    age: 0,
    hitCooldown: 0,
    dead: false,
  };
  e.button = guiPixelFillButton({
    label: '',
    posX: x,
    posY: y,
    radius: Math.max(50, t.r * 1.25),
    speedUp: 100 / (t.killTime * tough),
    speedDown: t.regen,
    fullPercent: t.fullPercent,
    activeValue: 95,
    visible: false,
    onEnterActive: () => shotDown(e),
  });
  e.handle = (grid, elapsed, ctx) => {
    e.age += elapsed;
    e.hitCooldown -= elapsed;
    // Bewegung (Zickzack pendelt um die Grundrichtung)
    let mx = e.dx;
    let my = e.dy;
    if (t.sway) {
      e.phase += elapsed * 2.6;
      const a = Math.sin(e.phase) * t.sway;
      mx = e.dx * Math.cos(a) - e.dy * Math.sin(a);
      my = e.dx * Math.sin(a) + e.dy * Math.cos(a);
    }
    e.x += mx * e.speed * elapsed;
    e.y += my * e.speed * elapsed;

    // Türme: ablenken bzw. plattwalzen (Kapseln schweben hindurch)
    if (!t.friendly) {
      towers.slice().forEach((tower) => {
        if (e.dead) return;
        const hit = collideTower(e, tower);
        if (!hit) return;
        if (t.crush) {
          destroyTower(tower);
          e.button.setValue(e.button.getValue() + t.crush);
          addFloatingText('Koloss geschwächt', e.x, e.y - t.r - 20, COL.text, 36);
          if (e.button.getValue() >= 95) shotDown(e);
          return;
        }
        e.x = hit.px;
        e.y = hit.py;
        const dot = mx * hit.nx + my * hit.ny;
        if (dot >= 0) return; // fliegt schon weg
        let rx = mx - 2 * dot * hit.nx;
        let ry = my - 2 * dot * hit.ny;
        if (!tower.verts) {
          // der billige Kreis streut zusätzlich
          const j = (Math.random() - 0.5) * 2 * DIFFICULTY.circleJitter;
          const jx = rx * Math.cos(j) - ry * Math.sin(j);
          const jy = rx * Math.sin(j) + ry * Math.cos(j);
          if (jx * hit.nx + jy * hit.ny > 0.1) {
            rx = jx;
            ry = jy;
          }
        }
        e.dx = rx;
        e.dy = ry;
        mx = rx;
        my = ry;
        e.phase = 0;
        e.speed *= DIFFICULTY.deflectSpeedUp;
        e.deflected = true;
        if (e.shield) {
          e.shield = false;
          burst(e.x, e.y, COL.shield, 16, 320);
          addFloatingText('Schild geknackt', e.x, e.y - 50, COL.shield, 32);
        }
        if (e.hitCooldown <= 0) {
          e.hitCooldown = 0.2;
          tower.hp -= t.tower;
          tower.flash = 0.35;
          burst(e.x - hit.nx * t.r, e.y - hit.ny * t.r, COL[tower.type], 8, 220);
          playSound(soundPop, 0.2);
          if (tower.hp <= 0) destroyTower(tower);
        }
      });
      if (e.dead) return;
    }

    // Kern
    const cx = e.x - CORE.x;
    const cy = e.y - CORE.y;
    if (cx * cx + cy * cy < (CORE.r + t.r * 0.6) * (CORE.r + t.r * 0.6)) {
      hitCore(e);
      return;
    }
    // Spielfeld verlassen (nur wer vom Kern wegfliegt)
    if ((e.x < -150 || e.x > W + 150 || e.y < -150 || e.y > H + 150) && cx * mx + cy * my > 0) {
      if (!t.friendly && e.deflected) {
        stats.deflected++;
        energy += DIFFICULTY.deflectEnergy;
        score += 5;
        addFloatingText(
          'abgelenkt +' + DIFFICULTY.deflectEnergy,
          Math.max(160, Math.min(W - 160, e.x)),
          Math.max(120, Math.min(H - 220, e.y)),
          COL.hud,
          30
        );
      }
      removeEnemy(e);
      return;
    }

    // Eingabe: Schild hält Laser ab
    e.button.setX(e.x);
    e.button.setY(e.y);
    if (e.shield) {
      e.button.setValue(0);
    } else {
      e.button.handle(grid, elapsed);
      if (e.dead) return;
    }

    // Zeichnen: Schweif, Sprite, Schadensring, Schild
    const s = sprites[type];
    ctx.fillStyle = COL[type];
    for (let i = 1; i <= 3; i++) {
      ctx.globalAlpha = 0.22 - i * 0.05;
      ctx.beginPath();
      ctx.arc(e.x - mx * t.r * 0.7 * i, e.y - my * t.r * 0.7 * i, t.r * (1 - i * 0.18), 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
    ctx.save();
    ctx.translate(e.x, e.y);
    const wobble = 1 + 0.05 * Math.sin(e.age * 7 + e.phase);
    ctx.save();
    ctx.rotate(Math.atan2(my, mx));
    ctx.scale(wobble, 2 - wobble);
    ctx.drawImage(s, -s.width / 2, -s.height / 2);
    ctx.restore();
    const value = e.button.getValue();
    if (value > 1) {
      ctx.strokeStyle = t.friendly ? COL.warn : COL.text;
      ctx.lineWidth = t.r > 60 ? 12 : 7;
      ctx.beginPath();
      ctx.arc(0, 0, t.r + 10, -Math.PI / 2, -Math.PI / 2 + (Math.PI * 2 * value) / 95);
      ctx.stroke();
    }
    if (e.shield) {
      ctx.rotate(e.age * 1.5);
      ctx.strokeStyle = hexA(COL.shield, 0.7 + 0.3 * Math.sin(e.age * 6));
      ctx.fillStyle = hexA(COL.shield, 0.15);
      ctx.lineWidth = 6;
      ctx.beginPath();
      for (let i = 0; i < 6; i++) {
        const a = (i * Math.PI) / 3;
        if (i === 0) ctx.moveTo(Math.cos(a) * (t.r + 16), Math.sin(a) * (t.r + 16));
        else ctx.lineTo(Math.cos(a) * (t.r + 16), Math.sin(a) * (t.r + 16));
      }
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
    }
    if (t.friendly) {
      ctx.strokeStyle = hexA(COL.good, 0.5 + 0.4 * Math.sin(e.age * 5));
      ctx.lineWidth = 4;
      ctx.setLineDash([8, 10]);
      ctx.beginPath();
      ctx.arc(0, 0, t.r + 18, 0, Math.PI * 2);
      ctx.stroke();
    }
    ctx.restore();
  };
  enemies.push(e);
  return e;
}

function spawnFromAngle(type, angle) {
  const cos = Math.cos(angle);
  const sin = Math.sin(angle);
  const margin = ENEMY_TYPES[type].r + 40;
  const reach = Math.min((W / 2 + margin) / Math.max(0.001, Math.abs(cos)), (H / 2 + margin) / Math.max(0.001, Math.abs(sin)));
  const x = CORE.x + cos * reach;
  const y = CORE.y + sin * reach;
  const tx = CORE.x + (Math.random() - 0.5) * 70 - x;
  const ty = CORE.y + (Math.random() - 0.5) * 70 - y;
  const len = Math.sqrt(tx * tx + ty * ty);
  const e = createEnemy(type, x, y, tx / len, ty / len);
  if (type === 'koloss') {
    playSound(soundBoss, 0.8);
    addFloatingText('KOLOSS!', Math.max(250, Math.min(W - 250, x)), Math.max(200, Math.min(H - 300, y)), COL.warn, 80);
  }
  return e;
}

// --- Wellen ---
function buildWave() {
  const L = LEVELS[level - 1];
  spawnQueue = [];
  let t = 1;
  const sectors = L.sectors || 1;
  for (let g = 0; g < L.groups; g++) {
    const base = Math.random() * Math.PI * 2;
    for (let s = 0; s < sectors; s++) {
      const angle = base + (s * Math.PI * 2) / sectors;
      for (let i = 0; i < L.size; i++) {
        spawnQueue.push({ time: t + i * L.gap, type: pickWeighted(L.mix), angle: angle + (Math.random() - 0.5) * 0.7 });
      }
    }
    if (L.kapsel && Math.random() < L.kapsel) {
      spawnQueue.push({ time: t + L.gap * 2, type: 'kapsel', angle: base + Math.PI / 2 + Math.random() * 0.6 });
    }
    t += L.size * L.gap + L.pause;
  }
  for (let b = 0; b < (L.boss || 0); b++) {
    spawnQueue.push({ time: 4 + b * t * 0.45, type: 'koloss', angle: Math.random() * Math.PI * 2 });
  }
  spawnQueue.sort((a, b) => a.time - b.time);
  waveTime = 0;
}

function enterLevelUp() {
  gameState = 'levelup';
  stateTime = 0;
  playSound(soundLevel, 0.6);
  addRing(CORE.x, CORE.y, 1100, COL.core, 1.2);
}

function finishWave() {
  if (level >= LEVELS.length) {
    won = true;
    enterGameOver();
    return;
  }
  const bonus = DIFFICULTY.levelBonusBase + DIFFICULTY.levelBonusPerLevel * level;
  energy += bonus;
  score += 100 * level;
  coreHp = Math.min(DIFFICULTY.coreHp, coreHp + DIFFICULTY.coreRepairPerLevel);
  addFloatingText('Welle geschafft!  +' + bonus + ' Energie', CORE.x, CORE.y - 180, COL.energy, 50);
  level++;
  enterLevelUp();
}

function enterGameOver() {
  gameState = 'gameover';
  stateTime = 0;
  buttonsGameOver = [startButton('Nochmal')];
  if (won) {
    playSound(soundLevel, 0.8);
  } else {
    playSound(soundBoom, 1);
    burst(CORE.x, CORE.y, COL.core, 80, 700);
  }
}

function resetGame() {
  level = 1;
  score = 0;
  energy = DIFFICULTY.startEnergy;
  coreHp = DIFFICULTY.coreHp;
  gameTime = 0;
  stateTime = 0;
  waveTime = 0;
  shake = 0;
  coreFlash = 0;
  won = false;
  stats = { shot: 0, deflected: 0, built: 0, lost: 0 };
  spawnQueue = [];
  enemies = [];
  towers = [];
  ghosts = [];
  particles = [];
  rings = [];
  floatingTexts = [];
  lastSoundTime = {};
  shopButtons = TOWER_ORDER.map((type) => createShopButton(type));
}

function startGame() {
  resetGame();
  enterLevelUp();
}

function startButton(label) {
  return guiFillButton({
    label,
    posX: W / 2,
    posY: 860,
    radius: 150,
    speedUp: 60,
    speedDown: 25,
    edges: 6,
    edges2: 3,
    activeValue: 90,
    normalColor: col(0.4, 0.8, 1),
    growColor: col(0.5, 0.8, 1),
    activeColor: col(0.6, 0.8, 1),
    onEnterActive: () => startGame(),
  });
}

// --- Zeichnen ---
function drawBackground(ctx) {
  ctx.drawImage(background, 0, 0);
  // langsam nach aussen laufende Radarwellen
  ctx.lineWidth = 3;
  for (let i = 0; i < 3; i++) {
    const f = (gameTime * 0.08 + i / 3) % 1;
    ctx.strokeStyle = hexA(COL.grid, 0.5 * (1 - f));
    ctx.beginPath();
    ctx.arc(CORE.x, CORE.y, 120 + f * 1000, 0, Math.PI * 2);
    ctx.stroke();
  }
}

function drawCore(ctx) {
  const hpRatio = Math.max(0, coreHp / DIFFICULTY.coreHp);
  const pulse = 1 + 0.04 * Math.sin(gameTime * 3);
  const main = coreFlash > 0.05 || hpRatio < 0.3 ? COL.warn : COL.core;
  ctx.save();
  ctx.translate(CORE.x, CORE.y);
  const glow = ctx.createRadialGradient(0, 0, 20, 0, 0, CORE.r * 2.3);
  glow.addColorStop(0, hexA(main, 0.5));
  glow.addColorStop(1, hexA(main, 0));
  ctx.fillStyle = glow;
  ctx.beginPath();
  ctx.arc(0, 0, CORE.r * 2.3, 0, Math.PI * 2);
  ctx.fill();
  // Lebensring in Segmenten
  ctx.lineWidth = 12;
  const segs = DIFFICULTY.coreHp;
  for (let i = 0; i < segs; i++) {
    const a0 = -Math.PI / 2 + (i * Math.PI * 2) / segs + 0.03;
    const a1 = -Math.PI / 2 + ((i + 1) * Math.PI * 2) / segs - 0.03;
    ctx.strokeStyle = i < coreHp ? main : hexA(COL.coreDark, 0.6);
    ctx.beginPath();
    ctx.arc(0, 0, CORE.r + 22, a0, a1);
    ctx.stroke();
  }
  // Kristall: zwei gegenläufige Sechsecke
  for (let k = 0; k < 2; k++) {
    ctx.save();
    ctx.rotate(gameTime * (k === 0 ? 0.4 : -0.6));
    const r = CORE.r * (k === 0 ? 1 : 0.62) * pulse;
    const grad = ctx.createRadialGradient(-r * 0.3, -r * 0.3, 2, 0, 0, r);
    grad.addColorStop(0, COL.coreLight);
    grad.addColorStop(0.6, hexA(main, 0.8));
    grad.addColorStop(1, hexA(COL.coreDark, 0.9));
    ctx.fillStyle = grad;
    ctx.strokeStyle = COL.coreLight;
    ctx.lineWidth = 5;
    ctx.beginPath();
    for (let i = 0; i < 6; i++) {
      const a = (i * Math.PI) / 3;
      if (i === 0) ctx.moveTo(Math.cos(a) * r, Math.sin(a) * r);
      else ctx.lineTo(Math.cos(a) * r, Math.sin(a) * r);
    }
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    ctx.restore();
  }
  ctx.restore();
  util.renderTextDropShadow({
    ctx,
    text: '' + Math.max(0, coreHp),
    x: CORE.x,
    y: CORE.y + 18,
    fontSize: '50px',
    fillStyle: COL.text,
    dropDistX: 3,
    dropDistY: 3,
  });
}

function updateEffects(ctx, elapsed) {
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  rings.slice().forEach((r) => {
    r.life += elapsed;
    const f = r.life / r.maxLife;
    if (f >= 1) {
      removeItemFromArray(rings, r);
      return;
    }
    ctx.strokeStyle = hexA(r.color, 0.8 * (1 - f));
    ctx.lineWidth = 10 * (1 - f) + 2;
    ctx.beginPath();
    ctx.arc(r.x, r.y, r.range * f, 0, Math.PI * 2);
    ctx.stroke();
  });
  particles.slice().forEach((p) => {
    p.life += elapsed;
    if (p.life >= p.maxLife) {
      removeItemFromArray(particles, p);
      return;
    }
    p.x += p.vx * elapsed;
    p.y += p.vy * elapsed;
    p.vx *= 1 - 1.5 * elapsed;
    p.vy *= 1 - 1.5 * elapsed;
    const f = 1 - p.life / p.maxLife;
    ctx.globalAlpha = f;
    ctx.fillStyle = p.color;
    ctx.fillRect(p.x - (p.size * f) / 2, p.y - (p.size * f) / 2, p.size * f, p.size * f);
  });
  ctx.restore();
  floatingTexts.slice().forEach((t) => {
    t.time += elapsed;
    if (t.time >= t.duration) {
      removeItemFromArray(floatingTexts, t);
      return;
    }
    ctx.globalAlpha = Math.min(1, (1 - t.time / t.duration) * 2);
    util.renderTextDropShadow({
      ctx,
      text: t.text,
      x: t.x,
      y: t.y - t.time * 60,
      fontSize: t.size + 'px',
      fillStyle: t.color,
      dropDistX: 3,
      dropDistY: 3,
    });
    ctx.globalAlpha = 1;
  });
}

function drawHud(ctx) {
  util.renderTextDropShadow({
    ctx,
    text: 'Welle ' + level + '/' + LEVELS.length,
    x: 50,
    y: 70,
    align: 'left',
    fontSize: '48px',
    fillStyle: COL.hud,
    dropDistX: 4,
    dropDistY: 4,
  });
  util.renderTextDropShadow({
    ctx,
    text: 'Punkte ' + score,
    x: W - 50,
    y: 70,
    align: 'right',
    fontSize: '48px',
    fillStyle: COL.hud,
    dropDistX: 4,
    dropDistY: 4,
  });
  util.renderTextDropShadow({
    ctx,
    text: 'Energie ' + Math.floor(energy),
    x: SHOP_X.kreis - 130,
    y: SHOP_Y + 20,
    align: 'right',
    fontSize: '50px',
    fillStyle: COL.energy,
    dropDistX: 4,
    dropDistY: 4,
  });
  util.renderTextDropShadow({
    ctx,
    text: 'Türme ' + towers.length + '/' + DIFFICULTY.maxTowers,
    x: SHOP_X.viereck + 130,
    y: SHOP_Y + 20,
    align: 'left',
    fontSize: '44px',
    fillStyle: COL.hud,
    dropDistX: 4,
    dropDistY: 4,
  });
}

// Welt aktualisieren und zeichnen (Spiel und Baupause teilen sich das)
function updateWorld(grid, elapsed, ctx, spawning) {
  gameTime += elapsed;
  shake = Math.max(0, shake - 40 * elapsed);
  coreFlash = Math.max(0, coreFlash - 2 * elapsed);

  if (spawning) {
    waveTime += elapsed;
    while (spawnQueue.length > 0 && spawnQueue[0].time <= waveTime) {
      const s = spawnQueue.shift();
      spawnFromAngle(s.type, s.angle);
    }
  }

  // Tastatur-Test
  if (keyPressedOnce('KeyK')) enemies.slice().forEach((e) => !e.t.friendly && shotDown(e));
  if (keyPressedOnce('KeyE')) energy += 100;

  ctx.save();
  if (shake > 0.5) ctx.translate((Math.random() - 0.5) * shake, (Math.random() - 0.5) * shake);
  drawBackground(ctx);
  towers.forEach((tower) => {
    tower.age += elapsed;
    tower.flash = Math.max(0, tower.flash - elapsed);
    drawTower(ctx, tower);
  });
  drawCore(ctx);
  ghosts.slice().forEach((ghost) => ghost.handle(grid, elapsed, ctx));
  enemies.slice().forEach((e) => e.handle(grid, elapsed, ctx));
  updateEffects(ctx, elapsed);
  ctx.restore();

  shopButtons.forEach((button) => button.handle(grid, elapsed, ctx));
  drawHud(ctx);
}

function handleGame(grid, elapsed, ctx) {
  updateWorld(grid, elapsed, ctx, true);
  if (coreHp <= 0) {
    enterGameOver();
    return;
  }
  if (keyPressedOnce('KeyL')) {
    spawnQueue = [];
    enemies = [];
  }
  if (spawnQueue.length === 0 && enemies.length === 0) {
    finishWave();
  }
}

function handleLevelUp(grid, elapsed, ctx) {
  stateTime += elapsed;
  updateWorld(grid, elapsed, ctx, false);
  if (coreHp <= 0) {
    enterGameOver();
    return;
  }
  const L = LEVELS[level - 1];
  const fade = Math.min(1, stateTime * 2) * Math.min(1, (DIFFICULTY.levelUpDuration - stateTime) * 2);
  ctx.globalAlpha = Math.max(0, fade);
  util.renderTextDropShadow({
    ctx,
    text: 'WELLE ' + level,
    x: W / 2,
    y: 230 + Math.sin(stateTime * 3) * 8,
    fontSize: '150px',
    fillStyle: COL.title,
  });
  util.renderTextDropShadow({
    ctx,
    text: L.neu,
    x: W / 2,
    y: 320,
    lineHeight: 60,
    fontSize: '46px',
    fillStyle: COL.text,
    dropDistX: 4,
    dropDistY: 4,
  });
  ctx.globalAlpha = 1;
  util.renderTextDropShadow({
    ctx,
    text: 'Bauzeit: ' + Math.max(0, Math.ceil(DIFFICULTY.levelUpDuration - stateTime)),
    x: W / 2,
    y: 760,
    fontSize: '44px',
    fillStyle: COL.energy,
    dropDistX: 4,
    dropDistY: 4,
  });
  if (stateTime >= DIFFICULTY.levelUpDuration || keyPressedOnce('KeyL')) {
    buildWave();
    gameState = 'game';
  }
}

function drawDemoTower(ctx, type, x, y, text) {
  const s = sprites[type];
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(-Math.PI / 2 + Math.sin(gameTime * 1.5 + x) * 0.15);
  ctx.drawImage(s, -s.width / 2, -s.height / 2);
  ctx.restore();
  util.renderTextDropShadow({
    ctx,
    text,
    x,
    y: y + 135,
    lineHeight: 40,
    fontSize: '32px',
    fillStyle: COL.text,
    dropDistX: 3,
    dropDistY: 3,
  });
}

function handleStart(grid, elapsed, ctx) {
  gameTime += elapsed;
  drawBackground(ctx);
  // kreisende Deko-Kugeln
  ['kugel', 'flitzer', 'panzer', 'teiler', 'zickzack', 'brocken'].forEach((name, i) => {
    const a = gameTime * 0.25 + (i * Math.PI) / 3;
    const s = sprites[name];
    ctx.save();
    ctx.translate(CORE.x + Math.cos(a) * 820, CORE.y + Math.sin(a) * 430);
    ctx.rotate(a + Math.PI / 2);
    ctx.drawImage(s, -s.width / 2, -s.height / 2);
    ctx.restore();
  });
  util.renderTextDropShadow({
    ctx,
    text: 'Laser-Bollwerk',
    x: W / 2,
    y: 210 + Math.sin(gameTime * 2) * 8,
    fontSize: '150px',
    fillStyle: COL.title,
  });
  util.renderTextDropShadow({
    ctx,
    text: 'Kugeln abschiessen – Türme bauen – Kern beschützen',
    x: W / 2,
    y: 300,
    fontSize: '46px',
    fillStyle: COL.text,
    dropDistX: 4,
    dropDistY: 4,
  });
  drawDemoTower(ctx, 'kreis', 560, 470, 'Kreis – 20\nstreut wild');
  drawDemoTower(ctx, 'dreieck', 960, 480, 'Dreieck – 40\nteilt den Strom');
  drawDemoTower(ctx, 'viereck', 1360, 470, 'Viereck – 70\nwirft zurück');
  buttonsStart.forEach((item) => item.handle(grid, elapsed));
  if (keyPressedOnce('Space')) startGame();
}

function handleGameOver(grid, elapsed, ctx) {
  stateTime += elapsed;
  gameTime += elapsed;
  drawBackground(ctx);
  towers.forEach((tower) => drawTower(ctx, tower));
  updateEffects(ctx, elapsed);
  util.renderTextDropShadow({
    ctx,
    text: won ? 'Das Bollwerk hält!' : 'Kern zerstört',
    x: W / 2,
    y: 220 + Math.sin(gameTime * 2) * 8,
    fontSize: '150px',
    fillStyle: won ? COL.title : COL.warn,
  });
  util.renderTextDropShadow({
    ctx,
    text:
      (won ? 'Alle ' + LEVELS.length + ' Wellen überstanden' : 'Welle ' + level + ' von ' + LEVELS.length) +
      '\nPunkte: ' +
      score +
      '\nAbgeschossen: ' +
      stats.shot +
      '   Abgelenkt: ' +
      stats.deflected +
      '\nTürme gebaut: ' +
      stats.built +
      '   zerbrochen: ' +
      stats.lost,
    x: W / 2,
    y: 350,
    lineHeight: 70,
    fontSize: '50px',
    fillStyle: COL.text,
    dropDistX: 4,
    dropDistY: 4,
  });
  if (stateTime > 1.5) {
    buttonsGameOver.forEach((item) => item.handle(grid, elapsed));
    if (keyPressedOnce('Space')) startGame();
  }
}

export default {
  name: 'Laser-Bollwerk',
  description: `
Beschützt den Kern in der Mitte!

Kugeln rollen in Wellen an: anleuchten, bis sie platzen 
das gibt Energie

Unten kauft ihr Türme: 
Knopf füllen, dann den Bauplan mit den Lasern an seinen Platz ziehen. 

Türme lenken Kugeln ab und zerbrechen dabei nach und nach.

Helle Energiekapseln NICHT abschiessen!`,
  image: 'media/img/gametitles/laser-defense-###4###.png',
  init: function () {
    buildGraphics();
    resetGame();
    gameState = 'start';
    lastTime = 0;
    buttonsStart = [startButton('Start')];
    buttonsGameOver = [];
    previousKeys = {};
  },
  handle: function (grid) {
    const elapsed = getDelta();
    const ctx = MasterCanvas.get2dContext();
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