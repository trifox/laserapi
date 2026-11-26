/**
 * Schlangenfutter – Snake umgekehrt: Die KI fährt, das Publikum füttert (Spielidee: Georg)
 *
 * Regeln:
 * - Eine KI-Schlange kriecht über ein Kachelraster (60 px). Sie fährt selbst – die Laser lenken NICHT.
 * - FUTTER LEGEN: Laser auf eine freie Kachel halten, bis ihr Ring voll ist (gui/paintLayer, Kacheln ausgerichtet).
 *   Dann liegt dort ein Futterbrocken. Leuchten mehrere Laser auf Nachbarkacheln mit, wird der Brocken größer
 *   (bis 3 Glieder Wachstum) – Teamwork lohnt sich. Futter verdirbt nach einer Weile.
 * - Die Schlange ist gierig: Sie fährt auf kürzestem Weg zum nächsten Futter, aber nur, wenn sie danach noch
 *   ihren Schwanz erreicht (Platzcheck). Sonst gerät sie in PANIK und weicht dorthin aus, wo am meisten Platz ist.
 *   Wer Futter an der falschen Stelle anbietet, lockt sie in die Enge.
 * - SATT-ZONE: Wo sie gefressen hat, ist die Stelle ein paar Sekunden gesperrt (dunkler Fleck) – dort entsteht
 *   kein Futter, man muss weiterwandern.
 * - HUNGER-UHR: Frisst sie zu lange nichts, schrumpft sie Glied für Glied.
 * - ENDE: Sackgasse (kein freies Nachbarfeld mehr) oder verhungert (nur noch 2 Glieder).
 * - Ziel: die LÄNGSTE Schlange. Level steigt mit der Länge: schneller, Hunger kürzer, ab Level 2 Felsen.
 * - Highscore (util/highscore.js, Sortierfeld 'laenge'): High = längste Schlange, Low = Schande-Tafel.
 *
 * Tastatur (ohne Laser): Leertaste = Start/Nochmal, Pfeiltasten = Futter-Cursor, Enter = Futter legen.
 *
 * Vorbilder: Blockade (Arcade 1976), Nibbler (1982), Snake Byte (C64 1982), Tron-Lichtzyklen (1982);
 * indirekte Steuerung wie Lemmings (Amiga 1991). Im Repo ähnlich: game-051-hydra – dort lenken die Laser die
 * Schlange als Köder, hier jagt die KI selbst und die Laser sind nur Futterlieferanten.
 *
 * Erstellt mit Claude Opus 5.5 (claude-opus-5-5) über die Skills laser-chris → new-laser-game.
 * Prompt (Kern): "Snake umgekehrt. Es gibt eine Schlange von der KI gesteuert, die frisst die Laserpunkte, auch wenn
 * die natürlich nicht zwangsläufig verschwinden. Die Schlange wird dann länger, bis es nicht mehr geht. Die längste
 * Schlange machen ist das Ziel." + Auswahl: Koop-Arcade-Puzzle, Futter legen + Satt-Zone + Hunger-Uhr,
 * Kachelraster, KI gierig mit Platzcheck.
 */
import util, { getRgbSpreadHex, getRgbSpread } from '../util.js';
import { createKeyEdge } from './gui/gridScan.js';
import soundPlop from '../../../public/media/369952__mischy__plop-1.wav';
import soundStomp from '../../../public/media/517267__foolboymedia__cinematic-stomp.wav';
import soundLay from '../../../public/media/opengameart/Item Pickup.ogg';
import soundPanic from '../../../public/media/opengameart/Menu Error.ogg';
import soundLevelUp from '../../../public/media/opengameart/Level Up.ogg';
import soundGameOver from '../../../public/media/opengameart/Music Box Game Over III.wav';
import soundShrink from '../../../public/media/opengameart/Decline.wav';
var laserConfig = require('../LaserApiConfig.js').default;
var MasterCanvas = require('../MasterCanvas').default;
var guiFillButton = require('./gui/fillButton').default;
var guiPaintLayer = require('./gui/paintLayer').default;
var createHighscore = require('../util/highscore').default;

const W = 1920;
const H = 1080;

// Spielwerte
const SETTINGS = {
  tile: 60,
  cols: 32,
  rows: 17,
  fieldY: 60, // oben 60 px HUD-Leiste
  startLength: 4,
  layTime: 1.2, // s Laser auf einer Kachel bis Futter entsteht
  layDecay: 0.6, // Abbau pro s ohne Laser
  bigFoodNeighbor: 0.5, // Nachbarkachel ab diesem Füllstand zählt mit (größerer Brocken)
  maxFoodValue: 3,
  maxFoods: 12,
  foodLifetime: 18, // s bis Futter verdirbt
  sattRadius: 100, // px
  sattTime: 6, // s
  shrinkInterval: 1.5, // s pro Glied beim Hungern
  minLength: 2,
  aiCandidates: 4, // so viele Futterziele prüft die KI auf Sicherheit
  maxParticles: 400,
  levelUpTime: 2.2,
  dieStepTime: 0.04, // s pro explodierendem Glied
};

// Steigerung pro Level
const DIFFICULTY = {
  startSpeed: 4, // Schritte pro Sekunde
  speedPerLevel: 0.6,
  maxSpeed: 9,
  startHunger: 14, // s bis die Schlange zu schrumpfen beginnt
  hungerPerLevel: -1.5,
  minHunger: 6,
  firstLevelLength: 12, // Länge für Level 2
  lengthStep: 8, // Abstand der Level-Schwellen, wächst pro Level um lengthStepGrow
  lengthStepGrow: 2,
  rocksFromLevel: 2,
  rocksPerLevel: 3,
};

const DIRS = [[1, 0], [0, 1], [-1, 0], [0, -1]];
const CELLS = SETTINGS.cols * SETTINGS.rows;

// Zustand (so vorbelegt, dass handle() auch ohne init() läuft)
let gameState = 'start'; // 'start' | 'play' | 'levelup' | 'dying' | 'gameover'
let level = 1;
let snake = []; // Kachel-Indizes, [0] = Kopf
let lastTail = -1; // zuletzt abgegebene Schwanzkachel (für weiches Gleiten)
let pendingGrowth = 0;
let foods = []; // { i, value, age }
let rocks = new Set();
let sattZones = []; // { x, y, timer }
let stepTimer = 0;
let hungerTimer = DIFFICULTY.startHunger;
let shrinkTimer = 0;
let panic = 0;
let nextLevelLength = DIFFICULTY.firstLevelLength;
let stats = newStats();
let particles = [];
let floatTexts = [];
let time = 0;
let stateTimer = 0;
let shake = 0;
let deathReason = '';
let newHigh = false;
let newLow = false;
let cursor = { c: 16, r: 8, visible: false };
let feedLayer = null;
let startButton = null;
let againButton = null;
let fractalCanvas = null;
let palCache = null;
let palKey = '';
let lastPlop = 0;
const keyEdge = createKeyEdge();
const highscore = createHighscore('Schlangenfutter', 'laenge');

function newStats() {
  return { maxLength: SETTINGS.startLength, eaten: 0, laid: 0, time: 0, panics: 0 };
}

// ---------- Hilfen ----------

function play(snd, volume = 0.5) {
  try {
    const a = new Audio(snd);
    a.volume = volume;
    a.play().catch(() => {});
  } catch (e) {}
}

function pal() {
  const tc = laserConfig.testColor;
  const key = tc.join(',');
  if (key !== palKey) {
    palKey = key;
    fractalCanvas = null;
    palCache = {
      body: Array.from({ length: 40 }, (_, k) => getRgbSpreadHex(tc, 0.3 + 0.4 * (0.5 + 0.5 * Math.sin((k / 40) * Math.PI * 2)), 0.75, 0.9)),
      head: getRgbSpreadHex(tc, 0.5, 0.6, 1),
      food: getRgbSpreadHex(tc, 0.62, 0.8, 1),
      ring: getRgbSpreadHex(tc, 0.62, 0.6, 0.6),
      grid: getRgbSpreadHex(tc, 0.5, 0.4, 0.12),
      satt: getRgbSpreadHex(tc, 0.4, 0.5, 0.35),
      rock: getRgbSpreadHex(tc, 0.45, 0.15, 0.45),
      hud: getRgbSpreadHex(tc, 0.5, 0.35, 0.95),
      warn: getRgbSpreadHex(tc, 0.35, 0.9, 1),
      good: getRgbSpreadHex(tc, 0.68, 0.8, 1),
    };
  }
  return palCache;
}

const colOf = (i) => i % SETTINGS.cols;
const rowOf = (i) => Math.floor(i / SETTINGS.cols);
const idx = (c, r) => c + r * SETTINGS.cols;
const centerX = (i) => (colOf(i) + 0.5) * SETTINGS.tile;
const centerY = (i) => SETTINGS.fieldY + (rowOf(i) + 0.5) * SETTINGS.tile;

function neighbors(i) {
  const c = colOf(i);
  const r = rowOf(i);
  const res = [];
  DIRS.forEach(([dc, dr]) => {
    const nc = c + dc;
    const nr = r + dr;
    if (nc >= 0 && nc < SETTINGS.cols && nr >= 0 && nr < SETTINGS.rows) res.push(idx(nc, nr));
  });
  return res;
}

function inSattZone(x, y) {
  return sattZones.some((z) => Math.hypot(z.x - x, z.y - y) < SETTINGS.sattRadius);
}

// ---------- KI (Breitensuche auf dem Kachelraster) ----------

/** Hindernisse: Felsen + Schlange (Schwanz frei, wenn er sich im nächsten Schritt wegbewegt) */
function buildBlocked(body, tailMoves) {
  const blocked = new Uint8Array(CELLS);
  rocks.forEach((i) => (blocked[i] = 1));
  const end = tailMoves ? body.length - 1 : body.length;
  for (let k = 0; k < end; k++) blocked[body[k]] = 1;
  return blocked;
}

function bfs(start, blocked) {
  const dist = new Int16Array(CELLS).fill(-1);
  const prev = new Int16Array(CELLS).fill(-1);
  const queue = [start];
  dist[start] = 0;
  for (let q = 0; q < queue.length; q++) {
    const cur = queue[q];
    neighbors(cur).forEach((n) => {
      if (dist[n] >= 0 || blocked[n]) return;
      dist[n] = dist[cur] + 1;
      prev[n] = cur;
      queue.push(n);
    });
  }
  return { dist, prev, area: queue.length };
}

function pathTo(prev, start, target) {
  const path = [];
  for (let cur = target; cur !== start && cur >= 0; cur = prev[cur]) path.unshift(cur);
  return path;
}

/** Platzcheck: Kann die Schlange nach diesem Weg noch ihren Schwanz erreichen bzw. hat sie genug Raum? */
function isSafeAfter(path, growth) {
  const virtual = path.slice().reverse().concat(snake).slice(0, snake.length + growth);
  const newHead = virtual[0];
  const newTail = virtual[virtual.length - 1];
  const { dist, area } = bfs(newHead, buildBlocked(virtual, true));
  return dist[newTail] > 0 || area > virtual.length * 1.5;
}

/** Ausweichen: Nachbarfeld mit der größten erreichbaren Fläche (-1 = Sackgasse) */
function escapeMove(blocked) {
  let best = -1;
  let bestScore = -1;
  neighbors(snake[0]).forEach((n) => {
    if (blocked[n]) return;
    const b2 = buildBlocked([n].concat(snake), true);
    const { dist, area } = bfs(n, b2);
    const tailBonus = dist[snake[snake.length - 1]] > 0 ? 50 : 0;
    const score = area + tailBonus + Math.random() * 3;
    if (score > bestScore) {
      bestScore = score;
      best = n;
    }
  });
  return best;
}

function chooseMove() {
  const head = snake[0];
  const blocked = buildBlocked(snake, pendingGrowth === 0);
  const { dist, prev } = bfs(head, blocked);
  const candidates = foods
    .filter((f) => dist[f.i] > 0)
    .sort((a, b) => dist[a.i] - dist[b.i])
    .slice(0, SETTINGS.aiCandidates);
  for (const f of candidates) {
    const path = pathTo(prev, head, f.i);
    if (path.length && isSafeAfter(path, pendingGrowth + f.value)) {
      panic = Math.max(0, panic - 0.5);
      return path[0];
    }
  }
  if (candidates.length) {
    // Futter da, aber jeder Weg wäre eine Falle → Panik
    if (panic <= 0) {
      stats.panics++;
      play(soundPanic, 0.25);
      addFloat('PANIK!', centerX(head), centerY(head) - 50, pal().warn);
    }
    panic = 1.5;
  }
  return escapeMove(blocked);
}

// ---------- Spielschritte ----------

function stepSnake() {
  const next = chooseMove();
  if (next < 0) return die('SACKGASSE!');
  snake.unshift(next);
  const food = foods.find((f) => f.i === next);
  if (food) eat(food);
  if (pendingGrowth > 0) {
    pendingGrowth--;
    lastTail = -1;
  } else {
    lastTail = snake.pop();
  }
  if (snake.length > stats.maxLength) stats.maxLength = snake.length;
  if (snake.length >= nextLevelLength) startLevelUp();
}

function eat(food) {
  foods.splice(foods.indexOf(food), 1);
  pendingGrowth += food.value;
  stats.eaten++;
  hungerTimer = currentHunger();
  shrinkTimer = 0;
  const x = centerX(food.i);
  const y = centerY(food.i);
  sattZones.push({ x, y, timer: SETTINGS.sattTime });
  burst(x, y, pal().food, 14 + food.value * 8);
  addFloat(`+${food.value}`, x, y - 40, pal().good);
  if (time - lastPlop > 0.06) {
    play(soundPlop, 0.4);
    lastPlop = time;
  }
}

function die(reason) {
  if (gameState !== 'play') return;
  deathReason = reason;
  gameState = 'dying';
  stateTimer = 0;
  shake = 0.7;
  play(soundStomp, 0.6);
}

function currentHunger() {
  return Math.max(DIFFICULTY.minHunger, DIFFICULTY.startHunger + (level - 1) * DIFFICULTY.hungerPerLevel);
}

function currentSpeed() {
  return Math.min(DIFFICULTY.maxSpeed, DIFFICULTY.startSpeed + (level - 1) * DIFFICULTY.speedPerLevel);
}

function startLevelUp() {
  gameState = 'levelup';
  stateTimer = 0;
  play(soundLevelUp, 0.6);
  snake.forEach((i, k) => k % 3 === 0 && burst(centerX(i), centerY(i), pal().good, 3));
}

function finishLevelUp() {
  level++;
  nextLevelLength += DIFFICULTY.lengthStep + (level - 2) * DIFFICULTY.lengthStepGrow;
  hungerTimer = currentHunger();
  if (level >= DIFFICULTY.rocksFromLevel) addRocks(DIFFICULTY.rocksPerLevel);
  gameState = 'play';
  addFloat(level === DIFFICULTY.rocksFromLevel ? 'Felsen!' : 'Schneller!', W / 2, H / 2, pal().warn);
}

/** Felsen nur weit weg vom Kopf und nicht auf Schlange/Futter */
function addRocks(n) {
  const headX = centerX(snake[0]);
  const headY = centerY(snake[0]);
  const body = new Set(snake);
  for (let tries = 0, placed = 0; placed < n && tries < 200; tries++) {
    const i = Math.floor(Math.random() * CELLS);
    if (body.has(i) || rocks.has(i) || foods.some((f) => f.i === i)) continue;
    if (Math.hypot(centerX(i) - headX, centerY(i) - headY) < 300) continue;
    rocks.add(i);
    placed++;
    burst(centerX(i), centerY(i), pal().rock, 12);
  }
}

/** Futter legen, wo der Laser lange genug war (gui/paintLayer, eine Zelle = eine Kachel) */
function layFood(i, value) {
  if (foods.length >= SETTINGS.maxFoods) return;
  foods.push({ i, value, age: 0 });
  stats.laid++;
  burst(centerX(i), centerY(i), pal().food, 10);
  play(soundLay, 0.3);
}

function canLayAt(i, body) {
  return !body.has(i) && !rocks.has(i) && !foods.some((f) => f.i === i) && !inSattZone(centerX(i), centerY(i));
}

function updateFeeding(grid, dt) {
  feedLayer.update(grid, dt);
  const body = new Set(snake);
  // Satt-Zonen halten ihren Bereich leer
  sattZones.slice().forEach((z) => {
    z.timer -= dt;
    if (z.timer <= 0) sattZones.splice(sattZones.indexOf(z), 1);
    else feedLayer.setInCircle(z.x, z.y, SETTINGS.sattRadius, 0);
  });
  for (let i = 0; i < CELLS; i++) {
    const x = centerX(i);
    const y = centerY(i);
    const v = feedLayer.getValueAt(x, y);
    if (v < 0.999) continue;
    if (!canLayAt(i, body)) {
      feedLayer.setValueAt(x, y, 0);
      continue;
    }
    // Nachbarkacheln, die mitgefüllt wurden, machen den Brocken größer
    let value = 1;
    neighbors(i).forEach((n) => {
      if (value < SETTINGS.maxFoodValue && feedLayer.getValueAt(centerX(n), centerY(n)) >= SETTINGS.bigFoodNeighbor) value++;
    });
    feedLayer.setInCircle(x, y, SETTINGS.tile * 1.1, 0);
    layFood(i, value);
  }
  foods.slice().forEach((f) => {
    f.age += dt;
    if (f.age > SETTINGS.foodLifetime) {
      foods.splice(foods.indexOf(f), 1);
      burst(centerX(f.i), centerY(f.i), pal().rock, 6);
    }
  });
}

function updateHunger(dt) {
  hungerTimer -= dt;
  if (hungerTimer > 0) return;
  hungerTimer = 0;
  shrinkTimer += dt;
  if (shrinkTimer < SETTINGS.shrinkInterval) return;
  shrinkTimer = 0;
  if (snake.length <= SETTINGS.minLength) return die('VERHUNGERT!');
  const tail = snake.pop();
  lastTail = -1;
  burst(centerX(tail), centerY(tail), pal().warn, 10);
  play(soundShrink, 0.2);
}

function handleKeyboard() {
  const moves = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1] };
  Object.keys(moves).forEach((code) => {
    if (!keyEdge(code)) return;
    cursor.visible = true;
    cursor.c = Math.max(0, Math.min(SETTINGS.cols - 1, cursor.c + moves[code][0]));
    cursor.r = Math.max(0, Math.min(SETTINGS.rows - 1, cursor.r + moves[code][1]));
  });
  if (keyEdge('Enter')) {
    cursor.visible = true;
    const i = idx(cursor.c, cursor.r);
    if (canLayAt(i, new Set(snake))) layFood(i, 2);
  }
}

// ---------- Effekte ----------

function burst(x, y, color, n) {
  for (let i = 0; i < n && particles.length < SETTINGS.maxParticles; i++) {
    const a = Math.random() * Math.PI * 2;
    const v = 60 + Math.random() * 300;
    const life = 0.4 + Math.random() * 0.7;
    particles.push({ x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v, life, max: life, color, size: 3 + Math.random() * 5 });
  }
}

function addFloat(text, x, y, color) {
  if (floatTexts.length > 15) return;
  floatTexts.push({ text, x, y, life: 1.3, color });
}

function drawEffects(ctx, dt) {
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  particles.slice().forEach((p) => {
    p.life -= dt;
    if (p.life <= 0) {
      particles.splice(particles.indexOf(p), 1);
      return;
    }
    p.x += p.vx * dt;
    p.y += p.vy * dt;
    p.vx *= 0.93;
    p.vy *= 0.93;
    ctx.globalAlpha = p.life / p.max;
    ctx.fillStyle = p.color;
    ctx.fillRect(p.x - p.size / 2, p.y - p.size / 2, p.size, p.size);
  });
  ctx.restore();
  floatTexts.slice().forEach((f) => {
    f.life -= dt;
    if (f.life <= 0) {
      floatTexts.splice(floatTexts.indexOf(f), 1);
      return;
    }
    f.y -= 45 * dt;
    ctx.save();
    ctx.globalAlpha = Math.min(1, f.life);
    util.renderText({ ctx, text: f.text, x: f.x, y: f.y, fontSize: '44px', fillStyle: f.color });
    ctx.restore();
  });
}

// ---------- Zeichnen ----------

function renderFractal() {
  const w = 384;
  const h = 216;
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const g = canvas.getContext('2d');
  const img = g.createImageData(w, h);
  const maxIter = 40;
  const lut = Array.from({ length: maxIter + 1 }, (_, i) => getRgbSpread(laserConfig.testColor, 0.3 + (0.4 * i) / maxIter, 0.7, 0.04 + 0.45 * Math.pow(i / maxIter, 0.7)));
  // Julia-Menge c = 0.285 + 0.01i – spiralige Schlangenschuppen
  for (let py = 0; py < h; py++) {
    for (let px = 0; px < w; px++) {
      let zr = ((px / w) * 2 - 1) * 1.7;
      let zi = ((py / h) * 2 - 1) * 0.96;
      let i = 0;
      while (i < maxIter && zr * zr + zi * zi < 4) {
        const t = zr * zr - zi * zi + 0.285;
        zi = 2 * zr * zi + 0.01;
        zr = t;
        i++;
      }
      const col = i >= maxIter ? [0, 0, 0] : lut[i];
      const o = (px + py * w) * 4;
      img.data[o] = col[0];
      img.data[o + 1] = col[1];
      img.data[o + 2] = col[2];
      img.data[o + 3] = 255;
    }
  }
  g.putImageData(img, 0, 0);
  return canvas;
}

function drawFractalBackground(ctx, alpha) {
  if (!fractalCanvas) fractalCanvas = renderFractal();
  const zoom = 1.1 + Math.sin(time * 0.08) * 0.05;
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.drawImage(fractalCanvas, (W - W * zoom) / 2, (H - H * zoom) / 2, W * zoom, H * zoom);
  ctx.restore();
}

function drawField(ctx) {
  const P = pal();
  const t = SETTINGS.tile;
  ctx.save();
  ctx.strokeStyle = P.grid;
  ctx.lineWidth = 1;
  ctx.beginPath();
  for (let c = 0; c <= SETTINGS.cols; c++) {
    ctx.moveTo(c * t, SETTINGS.fieldY);
    ctx.lineTo(c * t, H);
  }
  for (let r = 0; r <= SETTINGS.rows; r++) {
    ctx.moveTo(0, SETTINGS.fieldY + r * t);
    ctx.lineTo(W, SETTINGS.fieldY + r * t);
  }
  ctx.stroke();
  // Satt-Zonen
  sattZones.forEach((z) => {
    ctx.globalAlpha = Math.min(1, z.timer) * 0.8;
    ctx.strokeStyle = P.satt;
    ctx.lineWidth = 3;
    ctx.setLineDash([8, 8]);
    ctx.beginPath();
    ctx.arc(z.x, z.y, SETTINGS.sattRadius, 0, Math.PI * 2);
    ctx.stroke();
    ctx.setLineDash([]);
    util.renderText({ ctx, text: 'satt', x: z.x, y: z.y + 10, fontSize: '28px', fillStyle: P.satt });
  });
  ctx.globalAlpha = 1;
  // Felsen
  rocks.forEach((i) => {
    const x = centerX(i);
    const y = centerY(i);
    ctx.fillStyle = P.rock;
    ctx.strokeStyle = P.hud;
    ctx.lineWidth = 2;
    ctx.beginPath();
    for (let k = 0; k < 7; k++) {
      const a = (k / 7) * Math.PI * 2;
      const r = 24 + ((i * 7 + k * 13) % 5);
      k ? ctx.lineTo(x + Math.cos(a) * r, y + Math.sin(a) * r) : ctx.moveTo(x + Math.cos(a) * r, y + Math.sin(a) * r);
    }
    ctx.closePath();
    ctx.globalAlpha = 0.5;
    ctx.fill();
    ctx.globalAlpha = 1;
    ctx.stroke();
  });
  ctx.restore();
}

function drawFeedRings(ctx) {
  const P = pal();
  ctx.save();
  ctx.strokeStyle = P.ring;
  ctx.lineWidth = 5;
  for (let i = 0; i < CELLS; i++) {
    const v = feedLayer.getValueAt(centerX(i), centerY(i));
    if (v < 0.04) continue;
    ctx.beginPath();
    ctx.arc(centerX(i), centerY(i), 24, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * v);
    ctx.stroke();
  }
  ctx.restore();
}

function drawFoods(ctx) {
  const P = pal();
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  foods.forEach((f) => {
    const fade = Math.max(0.25, 1 - Math.max(0, f.age - SETTINGS.foodLifetime + 4) / 4);
    const r = 10 + f.value * 5 + Math.sin(time * 6 + f.i) * 2;
    ctx.globalAlpha = fade;
    ctx.fillStyle = P.food;
    ctx.shadowColor = P.food;
    ctx.shadowBlur = 20;
    ctx.beginPath();
    ctx.arc(centerX(f.i), centerY(f.i), r, 0, Math.PI * 2);
    ctx.fill();
  });
  ctx.restore();
}

function drawSnake(ctx) {
  if (!snake.length) return;
  const P = pal();
  const progress = gameState === 'play' ? Math.min(1, stepTimer * currentSpeed()) : 1;
  const hungry = hungerTimer <= 0;
  // Glied k gleitet von seiner alten Kachel (snake[k+1] bzw. lastTail) zur neuen
  const pos = snake.map((i, k) => {
    const from = k + 1 < snake.length ? snake[k + 1] : lastTail >= 0 ? lastTail : i;
    return {
      x: centerX(from) + (centerX(i) - centerX(from)) * progress,
      y: centerY(from) + (centerY(i) - centerY(from)) * progress,
    };
  });
  ctx.save();
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  for (let k = pos.length - 1; k >= 1; k--) {
    const a = pos[k];
    const b = pos[k - 1];
    const col = P.body[(k + Math.floor(time * 8)) % P.body.length];
    const width = 40 - Math.min(16, (k / pos.length) * 16);
    ctx.globalAlpha = hungry ? 0.5 + 0.3 * Math.sin(time * 10) : 1;
    ctx.strokeStyle = col;
    ctx.lineWidth = width;
    ctx.beginPath();
    ctx.moveTo(a.x, a.y);
    ctx.lineTo(b.x, b.y);
    ctx.stroke();
    // Schuppe
    ctx.fillStyle = '#000';
    ctx.globalAlpha = 0.35;
    ctx.beginPath();
    ctx.arc(a.x, a.y, width * 0.22, 0, Math.PI * 2);
    ctx.fill();
  }
  // Kopf
  const h = pos[0];
  const dirFrom = pos.length > 1 ? pos[1] : h;
  const ang = Math.atan2(h.y - dirFrom.y, h.x - dirFrom.x) || 0;
  ctx.globalAlpha = 1;
  ctx.translate(h.x, h.y);
  ctx.rotate(ang);
  ctx.shadowColor = P.head;
  ctx.shadowBlur = 20;
  ctx.fillStyle = P.head;
  ctx.beginPath();
  ctx.ellipse(0, 0, 30, 24, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.shadowBlur = 0;
  // Augen (weit aufgerissen bei Panik)
  const eye = panic > 0 ? 9 : 6;
  [-10, 10].forEach((ey) => {
    ctx.fillStyle = '#000';
    ctx.beginPath();
    ctx.arc(10, ey, eye, 0, Math.PI * 2);
    ctx.fill();
  });
  // Zunge
  if (Math.sin(time * 5) > 0.3) {
    ctx.strokeStyle = P.warn;
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(28, 0);
    ctx.lineTo(44, 0);
    ctx.lineTo(50, -6);
    ctx.moveTo(44, 0);
    ctx.lineTo(50, 6);
    ctx.stroke();
  }
  ctx.restore();
}

function drawCursor(ctx) {
  if (!cursor.visible) return;
  const t = SETTINGS.tile;
  ctx.save();
  ctx.strokeStyle = pal().hud;
  ctx.lineWidth = 3;
  ctx.setLineDash([6, 6]);
  ctx.strokeRect(cursor.c * t + 3, SETTINGS.fieldY + cursor.r * t + 3, t - 6, t - 6);
  ctx.restore();
}

function drawHud(ctx) {
  const P = pal();
  ctx.save();
  ctx.fillStyle = '#000';
  ctx.fillRect(0, 0, W, SETTINGS.fieldY);
  ctx.restore();
  util.renderText({ ctx, text: `Länge ${snake.length}`, x: 20, y: 46, fontSize: '42px', fillStyle: P.good, align: 'left' });
  util.renderText({ ctx, text: `Level ${level} · Ziel ${nextLevelLength}`, x: 420, y: 46, fontSize: '34px', fillStyle: P.hud, align: 'left' });
  // Hunger-Balken
  const frac = Math.max(0, hungerTimer / currentHunger());
  const bx = 900;
  const bw = 500;
  ctx.save();
  ctx.strokeStyle = P.hud;
  ctx.lineWidth = 2;
  ctx.strokeRect(bx, 16, bw, 28);
  ctx.fillStyle = frac < 0.25 ? P.warn : P.good;
  ctx.fillRect(bx + 3, 19, (bw - 6) * frac, 22);
  ctx.restore();
  util.renderText({ ctx, text: frac > 0 ? 'Hunger' : 'HUNGER!', x: bx - 20, y: 44, fontSize: '32px', fillStyle: frac > 0 ? P.hud : P.warn, align: 'right' });
  const best = highscore.getHighscore();
  util.renderText({
    ctx,
    text: `Rekord ${Math.max(stats.maxLength, best ? best.laenge : 0)}`,
    x: W - 20,
    y: 46,
    fontSize: '42px',
    fillStyle: P.hud,
    align: 'right',
  });
}

// ---------- Spielablauf ----------

function createFeedLayer() {
  feedLayer = guiPaintLayer({
    posX: 0,
    posY: SETTINGS.fieldY,
    width: SETTINGS.cols * SETTINGS.tile,
    height: SETTINGS.rows * SETTINGS.tile,
    cellSize: SETTINGS.tile,
    speedUp: 1 / SETTINGS.layTime,
    speedDown: SETTINGS.layDecay,
    threshold: 0.999,
    visible: false, // Fortschritt zeichnen wir selbst als Ring – der Aktionsbereich bleibt dunkel
  });
}

function createButtons() {
  const P = pal();
  const opts = { posX: W / 2, radius: 100, edges: 6, speedUp: 60, speedDown: 30, lineWidth: 5, normalColor: P.ring, growColor: P.food, activeColor: P.good };
startButton = guiFillButton(Object.assign({}, opts, { label: 'START', posY: 880, onEnterActive: () => startGame() }));
  againButton = guiFillButton(Object.assign({}, opts, { label: 'NOCHMAL', posY: 900, onEnterActive: () => startGame() }));
}

function startGame() {
  level = 1;
  const r = Math.floor(SETTINGS.rows / 2);
  snake = [];
  for (let k = 0; k < SETTINGS.startLength; k++) snake.push(idx(6 - k, r));
  lastTail = -1;
  pendingGrowth = 0;
  foods = [];
  rocks = new Set();
  sattZones = [];
  particles = [];
  floatTexts = [];
  stepTimer = 0;
  panic = 0;
  hungerTimer = DIFFICULTY.startHunger;
  shrinkTimer = 0;
  nextLevelLength = DIFFICULTY.firstLevelLength;
  stats = newStats();
  createFeedLayer();
  gameState = 'play';
  play(soundStomp, 0.35);
}

function handlePlay(grid, dt, ctx) {
  if (!feedLayer || !snake.length) startGame();
  stats.time += dt;
  handleKeyboard();
  updateFeeding(grid, dt);
  updateHunger(dt);
  panic = Math.max(0, panic - dt);
  stepTimer += dt;
  const interval = 1 / currentSpeed();
  while (stepTimer >= interval && gameState === 'play') {
    stepTimer -= interval;
    stepSnake();
  }
  drawField(ctx);
  drawFeedRings(ctx);
  drawFoods(ctx);
  drawSnake(ctx);
  drawCursor(ctx);
  drawEffects(ctx, dt);
  drawHud(ctx);
}

function handleLevelUp(grid, dt, ctx) {
  const P = pal();
  stateTimer += dt;
  drawField(ctx);
  drawFoods(ctx);
  drawSnake(ctx);
  drawEffects(ctx, dt);
  drawHud(ctx);
  ctx.save();
  ctx.globalAlpha = Math.min(1, stateTimer * 3);
  util.renderText({ ctx, text: `LEVEL ${level + 1}`, x: W / 2, y: H / 2, fontSize: '150px', fillStyle: P.good });
  util.renderText({ ctx, text: `Länge ${snake.length} – weiter füttern!`, x: W / 2, y: H / 2 + 80, fontSize: '50px', fillStyle: P.hud });
  ctx.restore();
  if (stateTimer >= SETTINGS.levelUpTime) finishLevelUp();
}

function handleDying(grid, dt, ctx) {
  stateTimer += dt;
  // Glied für Glied vom Kopf her zerplatzen lassen
  while (snake.length && stateTimer >= SETTINGS.dieStepTime) {
    stateTimer -= SETTINGS.dieStepTime;
    const i = snake.shift();
    burst(centerX(i), centerY(i), pal().body[snake.length % pal().body.length], 8);
  }
  lastTail = -1;
  drawField(ctx);
  drawFoods(ctx);
  drawSnake(ctx);
  drawEffects(ctx, dt);
  drawHud(ctx);
  util.renderText({ ctx, text: deathReason, x: W / 2, y: H / 2, fontSize: '150px', fillStyle: pal().warn });
  if (!snake.length && particles.length < 20) endGame();
}

function endGame() {
  gameState = 'gameover';
  stateTimer = 0;
  play(soundGameOver, 0.5);
  highscore.addEntry({ laenge: stats.maxLength, level, futter: stats.eaten, zeit: stats.time, panik: stats.panics });
  newHigh = highscore.lastEntryNewHighscore();
  newLow = highscore.lastEntryNewLowscore();
  createButtons();
}

function handleStart(grid, dt, ctx) {
  const P = pal();
  if (!startButton) createButtons();
  drawFractalBackground(ctx, 0.5);
  util.renderText({ ctx, text: 'SCHLANGENFUTTER', x: W / 2, y: 210, fontSize: '150px', fillStyle: P.hud });
  util.renderText({
    ctx,
    text: `Die Schlange fährt von selbst – ihr seid das Futter!\nLaser auf eine Kachel halten, bis der Ring voll ist: Dort liegt dann ein Brocken.\nMehrere Laser nebeneinander = größerer Brocken. Lockt sie nicht in die Sackgasse!`,
    x: W / 2,
    y: 320,
    fontSize: '40px',
    lineHeight: 58,
    fillStyle: P.hud,
  });
  // Deko-Schlange schlängelt über den Titel
  ctx.save();
  ctx.lineCap = 'round';
  for (let k = 0; k < 24; k++) {
    const x = W / 2 - 360 + k * 30;
    const y = 560 + Math.sin(time * 3 - k * 0.5) * 30;
    ctx.fillStyle = P.body[(k + Math.floor(time * 8)) % P.body.length];
    ctx.beginPath();
    ctx.arc(x, y, 18 - k * 0.4, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
  highscore.renderHighAndLowScores(ctx);
  startButton.handle(grid, dt);
  util.renderText({ ctx, text: 'Leertaste = Start', x: W / 2, y: 1040, fontSize: '32px', fillStyle: P.hud });
  if (keyEdge('Space')) startGame();
}

function handleGameOver(grid, dt, ctx) {
  const P = pal();
  if (!againButton) createButtons();
  drawFractalBackground(ctx, 0.35);
  drawEffects(ctx, dt);
  util.renderText({ ctx, text: deathReason || 'AUS!', x: W / 2, y: 200, fontSize: '150px', fillStyle: P.warn });
  util.renderText({
    ctx,
    text: `Längste Schlange ${stats.maxLength}   ·   Level ${level}\nGefressen ${stats.eaten}   ·   Gelegt ${stats.laid}   ·   Panik ${stats.panics}×\nZeit ${Math.floor(stats.time / 60)}:${String(Math.floor(stats.time % 60)).padStart(2, '0')}`,
    x: W / 2,
    y: 320,
    fontSize: '46px',
    lineHeight: 66,
    fillStyle: P.hud,
  });
  const record = newHigh
    ? 'NEUER HIGHSCORE – länger als jede Schlange im C64-Kassettenregal!'
    : newLow
    ? 'Neuer Lowscore – ab auf die Schande-Tafel.'
    : '';
  if (record) util.renderText({ ctx, text: record, x: W / 2, y: 560, fontSize: '42px', fillStyle: P.good });
  highscore.renderHighAndLowScores(ctx);
  againButton.handle(grid, dt);
  if (keyEdge('Space')) startGame();
}

export default {
  name: 'Schlangenfutter',
  description: `Schlangenfutter – Snake umgekehrt!
Die Schlange fährt von selbst, ihr lenkt sie NICHT – ihr füttert sie.
Laser auf eine Kachel halten, bis der Ring voll ist: Dort entsteht Futter.
Mehrere Laser nebeneinander machen größere Brocken.
Wo sie gefressen hat, ist es eine Weile "satt" – weiterwandern!
Frisst sie zu lange nichts, schrumpft sie. Lockt sie nicht in eine Sackgasse.
Ziel: die längste Schlange aller Zeiten.`,
  image: 'media/img/gametitles/laser-paradise-###8###.png',
  init() {
    gameState = 'start';
    snake = [];
    foods = [];
    rocks = new Set();
    sattZones = [];
    particles = [];
    floatTexts = [];
    stats = newStats();
    deathReason = '';
    newHigh = false;
    newLow = false;
    cursor = { c: 16, r: 8, visible: false };
    feedLayer = null;
    createButtons();
  },
  handle(grid, elapsed) {
    const dt = Math.min(elapsed, 0.1);
    const ctx = MasterCanvas.get2dContext();
    time += dt;
    pal();
    ctx.save();
    if (shake > 0) {
      shake = Math.max(0, shake - dt);
      ctx.translate((Math.random() - 0.5) * 40 * shake, (Math.random() - 0.5) * 40 * shake);
    }
    if (gameState === 'start') handleStart(grid, dt, ctx);
    else if (gameState === 'play') handlePlay(grid, dt, ctx);
    else if (gameState === 'levelup') handleLevelUp(grid, dt, ctx);
    else if (gameState === 'dying') handleDying(grid, dt, ctx);
    else handleGameOver(grid, dt, ctx);
    ctx.restore();
  },
  stop() {
    feedLayer = null;
  },
};
