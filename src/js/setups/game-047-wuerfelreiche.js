/**
 * Würfelreiche – Brettspiel für bis zu 4 Spieler (Teams), freie Plätze spielt die KI
 *
 * Eine Inselkarte aus Sechseck-Gebieten ist unter bis zu 4 Reichen aufgeteilt. Auf jedem Gebiet liegt
 * ein Würfelstapel (1–8 Würfel). Gespielt wird reihum, wer dran ist, steuert mit ALLEN Lasern.
 *
 * Regeln:
 * - Startbildschirm: die 4 Plätze anleuchten schaltet um: Mensch → KI → aus (mindestens 2 Reiche).
 * - ANGREIFEN: Ein feindliches (oder neutrales) Nachbargebiet anleuchten, bis der Ring voll ist
 *   (gui/pixelFillButton). Angegriffen wird aus dem stärksten eigenen Nachbargebiet mit mindestens 2 Würfeln.
 *   Stark verteidigte Gebiete füllen sich langsamer – je mehr Laser zusammen draufleuchten, desto schneller.
 * - WÜRFELDUELL: Angreifer und Verteidiger würfeln mit allen Würfeln ihres Gebiets, die höhere Summe gewinnt
 *   (Gleichstand = Verteidiger). Sieg: alle Würfel bis auf einen ziehen ins eroberte Gebiet.
 *   Niederlage: im angreifenden Gebiet bleibt nur 1 Würfel.
 * - Wildes Herumleuchten rächt sich: jedes volle Gebiet greift sofort an, auch wenn es aussichtslos ist,
 *   und wer den ENDE-Knopf anleuchtet, beendet den Zug.
 * - ZUGENDE (ENDE-Knopf, Zeit abgelaufen oder kein Angriff mehr möglich): Nachschub = Anzahl Gebiete der
 *   größten zusammenhängenden Gruppe (+ Goldminen). Die Würfel landen zufällig auf eigenen Gebieten,
 *   was nicht passt, wird gelagert.
 * - Wer kein Gebiet mehr hat, ist raus. Wer als letzter übrig bleibt, gewinnt die Karte.
 * - LEVEL: Gewinnt ein Mensch gegen die KI, geht es auf eine größere Karte mit neuen Elementen
 *   (neutrale Gebiete, Festungen, Goldminen) und mutigerer KI. Sind alle Menschen raus: Game Over.
 *
 * Tastatur-Test: 1–4 = Plätze umschalten, Leertaste = Start, A = besten Angriff ausführen,
 * Enter = Zug beenden, L = Level gewinnen.
 */

import util, { getRgbSpreadHex, removeItemFromArray } from '../util.js';
import soundPop from '../../../public/media/369952__mischy__plop-1.wav';
import soundBoom from '../../../public/media/414346__bykgames__explosion-far.wav';
import soundLevel from '../../../public/media/521966__kastenfrosch__ready-to-start-jingle.ogg';
import soundSpawn from '../../../public/media/496199__luminousfridge__player-spawned.ogg';
import soundStomp from '../../../public/media/517267__foolboymedia__cinematic-stomp.wav';
import soundRoll from '../../../public/media/bounce_523088_11537497-lq.mp3';

var laserConfig = require('../LaserApiConfig.js').default;
var MasterCanvas = require('../MasterCanvas').default;
var guiFillButton = require('./gui/fillButton').default;
var guiPixelFillButton = require('./gui/pixelFillButton').default;

// --- Balancing ---
const DIFFICULTY = {
  maxLevel: 5,
  // Karte
  hexSize: 24,
  regionsStart: 20,
  regionsPerLevel: 4,
  landShare: 0.7,
  startDicePerRegion: 2.6,
  maxDice: 8,
  maxStock: 40,
  // Züge
  turnTimeStart: 35,
  turnTimePerLevel: -3,
  turnTimeMin: 20,
  noMoveDelay: 1.5,
  reinforceTime: 1.3,
  // Angriff per Laser
  attackFillSpeed: 120, // Füllrate bei voller Abdeckung (pro Sekunde)
  attackFillPerDie: 0.2, // jeder Verteidiger-Würfel macht das Füllen langsamer
  attackFullPercent: 25, // ab diesem Flächenanteil volle Geschwindigkeit
  attackSpeedDown: 45,
  endTurnSpeed: 45,
  // KI
  aiThinkStart: 0.9,
  aiThinkPerLevel: -0.1,
  aiThinkMin: 0.45,
  aiBoldnessStart: 0.1,
  aiBoldnessPerLevel: 0.15,
  // Würfelduell
  battleRollTime: 0.9,
  battleShowTime: 0.9,
  aiBattleSpeed: 1.5,
  // neue Elemente pro Level
  neutralFromLevel: 2,
  neutralShare: 0.15,
  fortFromLevel: 3,
  fortCount: 3,
  fortBonus: 2,
  goldFromLevel: 4,
  goldCount: 3,
  goldBonus: 2,
  // Sonstiges
  levelUpDuration: 3.2,
  maxParticles: 400,
};

const LEVEL_NEWS = [
  '',
  'Erobert alle Reiche!',
  'NEU: Neutrale Gebiete (grau) – leichte Beute',
  'NEU: Festungen – Verteidiger +2 auf die Augensumme',
  'NEU: Goldminen – +2 Würfel Nachschub pro Zug',
  'FINALE: Riesige Karte, gnadenlose KI!',
];

const W = 1920;
const H = 1080;
const HEADER_H = 150;
const MAP_LEFT = 40;
const MAP_RIGHT = 1880;
const MAP_TOP = 165;
const MAP_BOTTOM = 1065;
const BUTTON_RADIUS = 62;
const END_X = 1832;
const END_Y = 76;
const PLAYER_HUES = [0.15, 0.4, 0.62, 0.85];
// axiale Nachbarn; Richtung k liegt zwischen Ecke k und k+1
const DIRS = [
  [1, 0],
  [0, 1],
  [-1, 1],
  [-1, 0],
  [0, -1],
  [1, -1],
];
const PIPS = {
  1: [4],
  2: [0, 8],
  3: [0, 4, 8],
  4: [0, 2, 6, 8],
  5: [0, 2, 4, 6, 8],
  6: [0, 2, 3, 5, 6, 8],
};

// --- Zustand ---
var gameState = 'setup';
var lastTime = 0;
var time = 0;
var level = 1;
var slotTypes = ['human', 'ai', 'ai', 'ai'];
var players = [];
var cells = [];
var cellIndex = {};
var corners = [];
var regions = [];
var currentPlayer = 0;
var turnTimer = 0;
var aiTimer = 0;
var noMoveTimer = 0;
var reinforceTimer = 0;
var battle = null;
var banner = null;
var levelUpTimer = 0;
var winnerIndex = -1;
var won = false;
var shake = 0;
var flash = 0;
var flashColor = '#000000';
var stats = {};
var particles = [];
var floaters = [];
var activeSounds = [];
var previousKeys = {};
var slotButtons = [];
var startButton = null;
var againButton = null;
var setupButton = null;
var endButton = null;
var mapCanvas = null;
var activeCanvas = null;
var dieSprites = [];
var C = {};

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

function playSound(snd, volume) {
  try {
    const audio = new Audio(snd);
    audio.volume = volume === undefined ? 1 : volume;
    activeSounds.push(audio);
    audio.addEventListener('ended', () => removeItemFromArray(activeSounds, audio));
    const p = audio.play();
    if (p && p.catch) p.catch(() => {});
  } catch (e) {
    // Ton ist nur Beiwerk
  }
}

function col(hue, sat, val) {
  return getRgbSpreadHex(laserConfig.testColor, hue, sat, val);
}

function clamp(v, a, b) {
  return Math.max(a, Math.min(b, v));
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

function roundRectPath(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

function levelTurnTime() {
  return Math.max(DIFFICULTY.turnTimeMin, DIFFICULTY.turnTimeStart + DIFFICULTY.turnTimePerLevel * (level - 1));
}

function aiThinkTime() {
  return Math.max(DIFFICULTY.aiThinkMin, DIFFICULTY.aiThinkStart + DIFFICULTY.aiThinkPerLevel * (level - 1));
}

function aiBoldness() {
  return DIFFICULTY.aiBoldnessStart + DIFFICULTY.aiBoldnessPerLevel * (level - 1);
}

// --- Farben und Sprites (alles aus der Laserfarbe abgeleitet, nie die Laserfarbe selbst) ---
function playerColors(i) {
  const h = PLAYER_HUES[i];
  return {
    main: col(h, 0.75, 0.95),
    fill: col(h, 0.55, 0.55),
    light: col(h, 0.3, 1),
    dark: col(h, 0.7, 0.28),
  };
}

function buildPalette() {
  C = {
    seaTop: col(0.55, 0.6, 0.14),
    seaBottom: col(0.6, 0.7, 0.05),
    wave: col(0.55, 0.4, 0.4),
    border: col(0.55, 0.5, 0.12),
    coast: col(0.5, 0.25, 0.85),
    neutralFill: col(0.5, 0.06, 0.4),
    neutralMain: col(0.5, 0.05, 0.75),
    neutralLight: col(0.5, 0.04, 0.95),
    neutralDark: col(0.5, 0.05, 0.25),
    title: col(0.3, 0.7, 1),
    text: col(0.5, 0.12, 0.95),
    gold: col(0.2, 0.85, 1),
    fort: col(0.5, 0.1, 0.85),
    bad: col(0.08, 0.85, 1),
  };
}

function makeDieSprite(top, left, right, pip) {
  const canvas = document.createElement('canvas');
  canvas.width = 38;
  canvas.height = 42;
  const g = canvas.getContext('2d');
  g.translate(1, 1);
  g.lineJoin = 'round';
  g.strokeStyle = pip;
  g.lineWidth = 2;
  // obere Fläche
  g.fillStyle = top;
  g.beginPath();
  g.moveTo(18, 1);
  g.lineTo(35, 10);
  g.lineTo(18, 19);
  g.lineTo(1, 10);
  g.closePath();
  g.fill();
  g.stroke();
  // linke Fläche
  g.fillStyle = left;
  g.beginPath();
  g.moveTo(1, 10);
  g.lineTo(18, 19);
  g.lineTo(18, 39);
  g.lineTo(1, 30);
  g.closePath();
  g.fill();
  g.stroke();
  // rechte Fläche
  g.fillStyle = right;
  g.beginPath();
  g.moveTo(18, 19);
  g.lineTo(35, 10);
  g.lineTo(35, 30);
  g.lineTo(18, 39);
  g.closePath();
  g.fill();
  g.stroke();
  // Augen
  g.fillStyle = pip;
  g.beginPath();
  g.ellipse(18, 10, 3.5, 2, 0, 0, Math.PI * 2);
  g.fill();
  [
    [6, 18],
    [13, 30],
  ].forEach((p) => {
    g.beginPath();
    g.arc(p[0], p[1], 2.2, 0, Math.PI * 2);
    g.fill();
  });
  [
    [23, 31],
    [26.5, 24.5],
    [30, 18],
  ].forEach((p) => {
    g.beginPath();
    g.arc(p[0], p[1], 2.2, 0, Math.PI * 2);
    g.fill();
  });
  return canvas;
}

function buildSprites() {
  // Index 0 = neutral, 1..4 = Spieler
  dieSprites = [makeDieSprite(C.neutralLight, C.neutralMain, C.neutralFill, C.neutralDark)];
  for (let i = 0; i < 4; i++) {
    const pc = playerColors(i);
    dieSprites.push(makeDieSprite(pc.light, pc.main, pc.fill, pc.dark));
  }
  mapCanvas = document.createElement('canvas');
  mapCanvas.width = W;
  mapCanvas.height = H;
  activeCanvas = document.createElement('canvas');
  activeCanvas.width = W;
  activeCanvas.height = H;
}

// --- Sechseck-Raster und Kartengenerator ---
function buildCells() {
  cells = [];
  cellIndex = {};
  const s = DIFFICULTY.hexSize;
  const w = Math.sqrt(3) * s;
  const h = 1.5 * s;
  for (let r = 0; ; r++) {
    const y = MAP_TOP + s + r * h;
    if (y > MAP_BOTTOM - s) break;
    for (let c = 0; ; c++) {
      const x = MAP_LEFT + w / 2 + w * (c + (r % 2) * 0.5);
      if (x > MAP_RIGHT - w / 2) break;
      const q = c - Math.floor(r / 2);
      cellIndex[q + ',' + r] = cells.length;
      cells.push({ q, r, x, y, region: -1, nb: null });
    }
  }
  cells.forEach((cell) => {
    cell.nb = DIRS.map((d) => {
      const k = cellIndex[cell.q + d[0] + ',' + (cell.r + d[1])];
      return k === undefined ? -1 : k;
    });
  });
  corners = [];
  for (let k = 0; k < 6; k++) {
    const a = ((60 * k - 30) * Math.PI) / 180;
    corners.push({ x: Math.cos(a) * s, y: Math.sin(a) * s });
  }
}

function tryGenerate(n) {
  cells.forEach((c) => (c.region = -1));
  const area = (MAP_RIGHT - MAP_LEFT) * (MAP_BOTTOM - MAP_TOP);
  const minD = Math.sqrt(area / n) * 0.8;
  const seeds = [];
  for (let i = 0; i < 4000 && seeds.length < n; i++) {
    const ci = Math.floor(Math.random() * cells.length);
    const c = cells[ci];
    const free = seeds.every((si) => {
      const dx = cells[si].x - c.x;
      const dy = cells[si].y - c.y;
      return dx * dx + dy * dy > minD * minD;
    });
    if (free) seeds.push(ci);
  }
  const avg = (cells.length * DIFFICULTY.landShare) / n;
  const grow = seeds.map((si, i) => {
    cells[si].region = i;
    return {
      seed: cells[si],
      cells: [si],
      frontier: cells[si].nb.filter((x) => x >= 0),
      target: Math.round(avg * (0.75 + Math.random() * 0.5)),
    };
  });

  // alle Gebiete wachsen gleichzeitig, bevorzugt kompakt um ihren Keim
  let progress = true;
  while (progress) {
    progress = false;
    const order = shuffle(grow.map((g, i) => i));
    order.forEach((i) => {
      const g = grow[i];
      if (g.cells.length >= g.target) return;
      while (g.frontier.length) {
        let best = -1;
        let bestD = Infinity;
        for (let t = 0; t < 3; t++) {
          const k = Math.floor(Math.random() * g.frontier.length);
          const c = cells[g.frontier[k]];
          const d = (c.x - g.seed.x) * (c.x - g.seed.x) + (c.y - g.seed.y) * (c.y - g.seed.y);
          if (d < bestD) {
            bestD = d;
            best = k;
          }
        }
        const ci = g.frontier[best];
        g.frontier[best] = g.frontier[g.frontier.length - 1];
        g.frontier.pop();
        if (cells[ci].region === -1) {
          cells[ci].region = i;
          g.cells.push(ci);
          cells[ci].nb.forEach((x) => {
            if (x >= 0 && cells[x].region === -1) g.frontier.push(x);
          });
          progress = true;
          break;
        }
      }
    });
  }

  // einzelne Wasserlöcher mitten in einem Gebiet füllen
  cells.forEach((c, ci) => {
    if (c.region !== -1) return;
    const r0 = c.nb[0] >= 0 ? cells[c.nb[0]].region : -1;
    if (r0 >= 0 && c.nb.every((x) => x >= 0 && cells[x].region === r0)) {
      c.region = r0;
      grow[r0].cells.push(ci);
    }
  });

  // zu kleine Gebiete versenken
  const minSize = Math.max(6, avg * 0.4);
  grow.forEach((g) => {
    if (g.cells.length < minSize) {
      g.cells.forEach((ci) => (cells[ci].region = -1));
      g.cells = [];
    }
  });

  // nur die grösste zusammenhängende Landmasse behalten
  const adj = grow.map(() => ({}));
  cells.forEach((c) => {
    if (c.region < 0) return;
    c.nb.forEach((x) => {
      if (x >= 0 && cells[x].region >= 0 && cells[x].region !== c.region) adj[c.region][cells[x].region] = true;
    });
  });
  let bestComp = [];
  const seen = {};
  grow.forEach((g, i) => {
    if (!g.cells.length || seen[i]) return;
    const comp = [];
    const queue = [i];
    seen[i] = true;
    while (queue.length) {
      const a = queue.pop();
      comp.push(a);
      Object.keys(adj[a]).forEach((b) => {
        if (!seen[b]) {
          seen[b] = true;
          queue.push(Number(b));
        }
      });
    }
    if (comp.length > bestComp.length) bestComp = comp;
  });
  const keep = {};
  bestComp.forEach((i) => (keep[i] = true));

  // Gebiete neu durchnummerieren
  const remap = {};
  regions = [];
  grow.forEach((g, i) => {
    if (!keep[i] || !g.cells.length) {
      g.cells.forEach((ci) => (cells[ci].region = -1));
      return;
    }
    remap[i] = regions.length;
    regions.push({
      id: regions.length,
      cells: g.cells,
      owner: -1,
      dice: 1,
      neighbors: [],
      cx: 0,
      cy: 0,
      fort: false,
      gold: false,
      btn: null,
    });
  });
  cells.forEach((c) => {
    if (c.region >= 0) c.region = remap[c.region];
  });
  regions.forEach((r) => {
    const nbs = {};
    r.cells.forEach((ci) => {
      cells[ci].nb.forEach((x) => {
        if (x >= 0 && cells[x].region >= 0 && cells[x].region !== r.id) nbs[cells[x].region] = true;
      });
    });
    r.neighbors = Object.keys(nbs).map(Number);
    computeCenter(r);
  });
  return regions.length >= n * 0.75;
}

/** Mittelpunkt = Zelle, die am weitesten vom Gebietsrand entfernt ist (liegt sicher im Gebiet) */
function computeCenter(r) {
  const depth = {};
  const queue = [];
  let mx = 0;
  let my = 0;
  r.cells.forEach((ci) => {
    const c = cells[ci];
    mx += c.x;
    my += c.y;
    if (c.nb.some((x) => x < 0 || cells[x].region !== r.id)) {
      depth[ci] = 0;
      queue.push(ci);
    }
  });
  mx /= r.cells.length;
  my /= r.cells.length;
  for (let qi = 0; qi < queue.length; qi++) {
    const ci = queue[qi];
    cells[ci].nb.forEach((x) => {
      if (x >= 0 && cells[x].region === r.id && depth[x] === undefined) {
        depth[x] = depth[ci] + 1;
        queue.push(x);
      }
    });
  }
  let best = r.cells[0];
  r.cells.forEach((ci) => {
    const d = depth[ci] || 0;
    const bd = depth[best] || 0;
    const c = cells[ci];
    const b = cells[best];
    if (d > bd || (d === bd && (c.x - mx) * (c.x - mx) + (c.y - my) * (c.y - my) < (b.x - mx) * (b.x - mx) + (b.y - my) * (b.y - my))) {
      best = ci;
    }
  });
  r.cx = cells[best].x;
  r.cy = cells[best].y;
}

function generateMap(n) {
  for (let attempt = 0; attempt < 8; attempt++) {
    if (tryGenerate(n)) return;
  }
}

// --- Aufstellung ---
function createPlayers() {
  players = [0, 1, 2, 3].map((i) => {
    const pc = playerColors(i);
    return {
      index: i,
      type: slotTypes[i],
      alive: slotTypes[i] !== 'off',
      stock: 0,
      main: pc.main,
      fill: pc.fill,
      light: pc.light,
      dark: pc.dark,
    };
  });
}

function setupOwners(lvl, previewOnly) {
  const ids = shuffle(regions.map((r) => r.id));
  const active = players.filter((p) => p.type !== 'off');
  const neutralCount = !previewOnly && lvl >= DIFFICULTY.neutralFromLevel ? Math.round(regions.length * DIFFICULTY.neutralShare) : 0;
  const per = Math.floor((regions.length - neutralCount) / Math.max(1, active.length));
  let k = 0;
  active.forEach((p) => {
    for (let i = 0; i < per; i++) regions[ids[k++]].owner = p.index;
  });
  for (; k < ids.length; k++) regions[ids[k]].owner = -1;
  regions.forEach((r) => {
    r.dice = r.owner < 0 ? 1 + Math.floor(Math.random() * 3) : 1;
    r.fort = false;
    r.gold = false;
  });
  // gleich viele Würfel für alle Reiche
  active.forEach((p) => {
    const own = regions.filter((r) => r.owner === p.index);
    let extra = Math.round(own.length * (DIFFICULTY.startDicePerRegion - 1));
    while (extra > 0) {
      const cand = own.filter((r) => r.dice < DIFFICULTY.maxDice);
      if (!cand.length) break;
      cand[Math.floor(Math.random() * cand.length)].dice++;
      extra--;
    }
  });
  if (previewOnly) return;
  const pool = shuffle(regions.slice());
  if (lvl >= DIFFICULTY.fortFromLevel) {
    pool.splice(0, DIFFICULTY.fortCount).forEach((r) => (r.fort = true));
  }
  if (lvl >= DIFFICULTY.goldFromLevel) {
    pool.splice(0, DIFFICULTY.goldCount).forEach((r) => (r.gold = true));
  }
}

function createRegionButtons() {
  regions.forEach((r) => {
    r.btn = guiPixelFillButton({
      label: '',
      posX: r.cx,
      posY: r.cy,
      radius: BUTTON_RADIUS,
      speedUp: DIFFICULTY.attackFillSpeed,
      speedDown: DIFFICULTY.attackSpeedDown,
      fullPercent: DIFFICULTY.attackFullPercent,
      activeValue: 90,
      visible: false,
      onEnterActive: () => onHumanAttack(r),
    });
    // Handle-Wrapping: starke Gebiete füllen sich langsamer (Zeit wird gestaucht)
    const handleOriginal = r.btn.handle;
    r.btn.handle = (grid, elapsed) => {
      const factor = 1 / (1 + r.dice * DIFFICULTY.attackFillPerDie + (r.fort ? 0.5 : 0));
      handleOriginal(grid, elapsed * factor);
    };
  });
}

// --- Karte zeichnen (nur bei Änderungen, in Offscreen-Canvas) ---
function hexPath(g, x, y, scale) {
  g.beginPath();
  for (let k = 0; k < 6; k++) {
    const px = x + corners[k].x * scale;
    const py = y + corners[k].y * scale;
    if (k === 0) g.moveTo(px, py);
    else g.lineTo(px, py);
  }
  g.closePath();
}

function edge(g, c, k) {
  const a = corners[k];
  const b = corners[(k + 1) % 6];
  g.moveTo(c.x + a.x, c.y + a.y);
  g.lineTo(c.x + b.x, c.y + b.y);
}

function ownerFill(owner) {
  return owner < 0 ? C.neutralFill : players[owner].fill;
}

function renderMap() {
  const g = mapCanvas.getContext('2d');
  g.clearRect(0, 0, W, H);
  g.save();
  cells.forEach((c) => {
    if (c.region < 0) return;
    g.fillStyle = ownerFill(regions[c.region].owner);
    hexPath(g, c.x, c.y, 1.04);
    g.fill();
  });
  // feine Wabenstruktur für Tiefe
  g.strokeStyle = 'rgba(0,0,0,0.12)';
  g.lineWidth = 1;
  cells.forEach((c) => {
    if (c.region < 0) return;
    hexPath(g, c.x, c.y, 0.85);
    g.stroke();
  });
  // Gebietsgrenzen
  g.lineCap = 'round';
  g.strokeStyle = C.border;
  g.lineWidth = 4;
  g.beginPath();
  cells.forEach((c, ci) => {
    if (c.region < 0) return;
    c.nb.forEach((n, k) => {
      if (n > ci && cells[n].region >= 0 && cells[n].region !== c.region) edge(g, c, k);
    });
  });
  g.stroke();
  // Küste mit Glow
  g.strokeStyle = C.coast;
  g.shadowColor = C.coast;
  g.shadowBlur = 16;
  g.lineWidth = 4;
  g.beginPath();
  cells.forEach((c) => {
    if (c.region < 0) return;
    c.nb.forEach((n, k) => {
      if (n < 0 || cells[n].region < 0) edge(g, c, k);
    });
  });
  g.stroke();
  g.restore();
}

function renderActive() {
  const g = activeCanvas.getContext('2d');
  g.clearRect(0, 0, W, H);
  const p = players[currentPlayer];
  if (!p || !p.alive) return;
  g.save();
  g.lineCap = 'round';
  g.strokeStyle = p.light;
  g.shadowColor = p.main;
  g.shadowBlur = 18;
  g.lineWidth = 5;
  g.beginPath();
  cells.forEach((c) => {
    if (c.region < 0 || regions[c.region].owner !== p.index) return;
    c.nb.forEach((n, k) => {
      if (n < 0 || cells[n].region < 0 || regions[cells[n].region].owner !== p.index) edge(g, c, k);
    });
  });
  g.stroke();
  g.restore();
}

// --- Effekte ---
function addParticle(x, y, vx, vy, life, color, size) {
  if (particles.length >= DIFFICULTY.maxParticles) particles.shift();
  particles.push({ x, y, vx, vy, life, maxLife: life, color, size });
}

function burst(x, y, color, count, speed) {
  for (let i = 0; i < count; i++) {
    const a = Math.random() * Math.PI * 2;
    const s = speed * (0.3 + Math.random() * 0.7);
    addParticle(x, y, Math.cos(a) * s, Math.sin(a) * s, 0.5 + Math.random() * 0.7, color, 4 + Math.random() * 8);
  }
}

function addFloater(x, y, text, color, size) {
  floaters.push({ x, y, text, color, life: 1.5, size: size || 46 });
}

function showBanner(text, color, duration) {
  banner = { text, color, life: duration, maxLife: duration };
}

// --- Spielregeln ---
function attackSource(target, pi) {
  if (target.owner === pi) return null;
  let best = null;
  target.neighbors.forEach((id) => {
    const r = regions[id];
    if (r.owner === pi && r.dice >= 2 && (!best || r.dice > best.dice)) best = r;
  });
  return best;
}

function largestGroup(pi) {
  const seen = {};
  let best = 0;
  regions.forEach((r) => {
    if (r.owner !== pi || seen[r.id]) return;
    let size = 0;
    const stack = [r.id];
    seen[r.id] = true;
    while (stack.length) {
      const a = regions[stack.pop()];
      size++;
      a.neighbors.forEach((b) => {
        if (!seen[b] && regions[b].owner === pi) {
          seen[b] = true;
          stack.push(b);
        }
      });
    }
    best = Math.max(best, size);
  });
  return best;
}

/** sucht den besten Angriff; boldness = Bereitschaft für riskante Angriffe */
function pickMove(pi, boldness) {
  let best = null;
  let bestScore = -Infinity;
  regions.forEach((from) => {
    if (from.owner !== pi || from.dice < 2) return;
    from.neighbors.forEach((id) => {
      const to = regions[id];
      if (to.owner === pi) return;
      const diff = from.dice - (to.dice + (to.fort ? 0.6 : 0));
      let ok = diff > 0 || from.dice === DIFFICULTY.maxDice;
      if (!ok && diff >= 0 && Math.random() < boldness) ok = true;
      if (!ok && diff >= -1 && Math.random() < boldness * 0.3) ok = true;
      if (!ok) return;
      const score = diff + (to.gold ? 1.5 : 0) + (to.owner < 0 ? 0.5 : 0) + Math.random() * 0.4;
      if (score > bestScore) {
        bestScore = score;
        best = { from, to };
      }
    });
  });
  return best;
}

function isHumanTurn() {
  const p = players[currentPlayer];
  return gameState === 'game' && p && p.type === 'human' && !battle && reinforceTimer <= 0;
}

function onHumanAttack(target) {
  if (!isHumanTurn()) return;
  const src = attackSource(target, currentPlayer);
  if (src) startBattle(src, target);
}

function rollDice(n) {
  const res = [];
  for (let i = 0; i < n; i++) res.push(1 + Math.floor(Math.random() * 6));
  return res;
}

function sum(arr) {
  return arr.reduce((a, b) => a + b, 0);
}

function startBattle(from, to) {
  const att = rollDice(from.dice);
  const def = rollDice(to.dice);
  const attSum = sum(att);
  const defSum = sum(def) + (to.fort ? DIFFICULTY.fortBonus : 0);
  const attacker = players[from.owner];
  battle = {
    from,
    to,
    att,
    def,
    attSum,
    defSum,
    win: attSum > defSum,
    t: 0,
    speed: attacker.type === 'ai' ? DIFFICULTY.aiBattleSpeed : 1,
    shownAtt: rollDice(att.length),
    shownDef: rollDice(def.length),
    tick: 0,
    revealed: false,
  };
  if (attacker.type === 'human') stats.attacks++;
  playSound(soundRoll, 0.5);
}

function updateBattle(dt) {
  const b = battle;
  b.t += dt * b.speed;
  if (b.t < DIFFICULTY.battleRollTime) {
    b.tick -= dt;
    if (b.tick <= 0) {
      b.tick = 0.07;
      b.shownAtt = rollDice(b.att.length);
      b.shownDef = rollDice(b.def.length);
    }
    return;
  }
  if (!b.revealed) {
    b.revealed = true;
    b.shownAtt = b.att;
    b.shownDef = b.def;
    if (b.win) playSound(soundStomp, 0.6);
    else playSound(soundPop, 0.6);
  }
  if (b.t >= DIFFICULTY.battleRollTime + DIFFICULTY.battleShowTime) resolveBattle();
}

function resolveBattle() {
  const b = battle;
  const attacker = players[b.from.owner];
  const human = attacker.type === 'human';
  if (b.win) {
    const prev = b.to.owner;
    b.to.owner = b.from.owner;
    b.to.dice = b.from.dice - 1;
    b.from.dice = 1;
    burst(b.to.cx, b.to.cy, attacker.main, 36, 520);
    burst(b.to.cx, b.to.cy, attacker.light, 16, 300);
    addFloater(b.to.cx, b.to.cy - 70, 'EROBERT!', attacker.light);
    if (human) {
      stats.wins++;
      stats.conquered++;
    }
    if (prev >= 0 && players[prev].type === 'human') stats.lost++;
    if (prev >= 0 && !regions.some((r) => r.owner === prev)) {
      players[prev].alive = false;
      showBanner('SPIELER ' + (prev + 1) + ' IST RAUS!', players[prev].light, 2);
      flash = 0.8;
      flashColor = players[prev].main;
      shake = 20;
      playSound(soundBoom, 0.8);
    }
  } else {
    b.from.dice = 1;
    burst(b.from.cx, b.from.cy, C.neutralMain, 20, 300);
    addFloater(b.to.cx, b.to.cy - 70, 'ABGEWEHRT!', C.bad);
    shake = Math.max(shake, human ? 14 : 6);
  }
  battle = null;
  regions.forEach((r) => r.btn.setValue(0));
  renderMap();
  renderActive();
  if (human) stats.bestGroup = Math.max(stats.bestGroup, largestGroup(currentPlayer));
  checkGameEnd();
}

function startTurn(pi) {
  currentPlayer = pi;
  const p = players[pi];
  turnTimer = levelTurnTime();
  aiTimer = aiThinkTime() * 1.4;
  noMoveTimer = 0;
  reinforceTimer = 0;
  regions.forEach((r) => r.btn.setValue(0));
  endButton.setValue(0);
  endButton.setColor(p.dark);
  endButton.setGrowColor(p.main);
  endButton.setActiveColor(p.light);
  renderActive();
  showBanner('SPIELER ' + (pi + 1) + (p.type === 'ai' ? ' (KI)' : '') + ' IST DRAN', p.light, 1.4);
  if (p.type === 'human') {
    stats.turns++;
    playSound(soundPop, 0.5);
  }
}

function endTurn() {
  if (battle || reinforceTimer > 0 || gameState !== 'game') return;
  const p = players[currentPlayer];
  const group = largestGroup(p.index);
  const gold = regions.filter((r) => r.owner === p.index && r.gold).length * DIFFICULTY.goldBonus;
  p.stock = Math.min(DIFFICULTY.maxStock, p.stock + group + gold);
  const gained = {};
  let cand = regions.filter((r) => r.owner === p.index && r.dice < DIFFICULTY.maxDice);
  while (p.stock > 0 && cand.length) {
    const r = cand[Math.floor(Math.random() * cand.length)];
    r.dice++;
    p.stock--;
    gained[r.id] = (gained[r.id] || 0) + 1;
    if (r.dice >= DIFFICULTY.maxDice) cand = cand.filter((x) => x !== r);
  }
  Object.keys(gained).forEach((id) => {
    const r = regions[id];
    addFloater(r.cx, r.cy - 60, '+' + gained[id], p.light, 40);
    burst(r.cx, r.cy - 20, p.light, 6, 160);
  });
  showBanner('+' + (group + gold) + ' WÜRFEL NACHSCHUB', p.light, DIFFICULTY.reinforceTime);
  if (Object.keys(gained).length) playSound(soundSpawn, 0.4);
  reinforceTimer = DIFFICULTY.reinforceTime;
}

function nextPlayer() {
  let n = currentPlayer;
  for (let i = 0; i < 4; i++) {
    n = (n + 1) % 4;
    if (players[n].alive) break;
  }
  startTurn(n);
}

function checkGameEnd() {
  const alive = players.filter((p) => p.alive);
  const humansIn = players.filter((p) => p.type === 'human').length;
  const humansAlive = alive.filter((p) => p.type === 'human').length;
  const aiIn = players.filter((p) => p.type === 'ai').length;
  if (humansIn > 0 && humansAlive === 0) {
    const ai = alive[0];
    endGame(false, alive.length === 1 ? ai.index : -1);
    return;
  }
  if (alive.length === 1) {
    const w = alive[0];
    if (w.type === 'human' && aiIn > 0 && level < DIFFICULTY.maxLevel) levelUp(w.index);
    else endGame(w.type === 'human', w.index);
  }
}

// --- Spielablauf ---
function setupLevel(lvl) {
  level = lvl;
  createPlayers();
  generateMap(DIFFICULTY.regionsStart + (lvl - 1) * DIFFICULTY.regionsPerLevel);
  setupOwners(lvl, false);
  createRegionButtons();
  particles = [];
  floaters = [];
  battle = null;
  renderMap();
  gameState = 'game';
  const alive = players.filter((p) => p.alive);
  startTurn(alive[Math.floor(Math.random() * alive.length)].index);
}

function startGame() {
  stats = { attacks: 0, wins: 0, conquered: 0, lost: 0, turns: 0, bestGroup: 0 };
  won = false;
  winnerIndex = -1;
  shake = 0;
  flash = 0;
  setupLevel(1);
  playSound(soundLevel, 0.7);
}

function levelUp(wi) {
  gameState = 'levelup';
  winnerIndex = wi;
  levelUpTimer = DIFFICULTY.levelUpDuration;
  flash = 1;
  flashColor = players[wi].main;
  for (let i = 0; i < 8; i++) {
    burst(200 + Math.random() * (W - 400), 250 + Math.random() * 600, i % 2 ? players[wi].main : players[wi].light, 22, 500);
  }
  playSound(soundLevel, 0.8);
}

function endGame(humansWon, wi) {
  gameState = 'gameover';
  won = humansWon;
  winnerIndex = wi;
  flash = 1;
  flashColor = wi >= 0 ? players[wi].main : C.bad;
  if (wi >= 0) {
    for (let i = 0; i < 6; i++) burst(300 + Math.random() * (W - 600), 300 + Math.random() * 500, players[wi].light, 20, 450);
  }
  playSound(humansWon ? soundSpawn : soundBoom, 0.9);
  againButton.setCounter(0);
  setupButton.setCounter(0);
}

function cycleSlot(i) {
  const order = ['human', 'ai', 'off'];
  let next = order[(order.indexOf(slotTypes[i]) + 1) % 3];
  const othersActive = slotTypes.filter((t, j) => j !== i && t !== 'off').length;
  if (next === 'off' && othersActive < 2) next = 'human';
  slotTypes[i] = next;
  playSound(soundPop, 0.5);
}

function createMenuButton(x, y, radius, color, onActive) {
  return guiFillButton({
    label: '',
    posX: x,
    posY: y,
    radius,
    speedUp: 60,
    speedDown: 25,
    activeValue: 90,
    counterReset: true,
    edges: 8,
    normalColor: color.fill,
    growColor: color.main,
    activeColor: color.light,
    onEnterActive: onActive,
  });
}

// --- Zeichnen pro Frame ---
function drawSea(ctx) {
  const grad = ctx.createLinearGradient(0, 0, 0, H);
  grad.addColorStop(0, C.seaTop);
  grad.addColorStop(1, C.seaBottom);
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, W, H);
  ctx.save();
  ctx.strokeStyle = C.wave;
  ctx.lineWidth = 2;
  for (let i = 0; i < 20; i++) {
    const baseY = 170 + i * 48;
    ctx.globalAlpha = 0.08 + 0.06 * Math.sin(time * 0.7 + i);
    ctx.beginPath();
    for (let x = 0; x <= W; x += 60) {
      const y = baseY + Math.sin(x * 0.006 + time * 0.9 + i * 1.7) * 9;
      if (x === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.stroke();
  }
  ctx.restore();
}

function drawStack(ctx, r) {
  const sprite = dieSprites[r.owner + 1];
  for (let i = 0; i < r.dice; i++) {
    const column = i < 4 ? 0 : 1;
    const lvl = i % 4;
    const x = r.cx + (column === 0 ? -11 : 9) - 19;
    const y = r.cy + (column === 0 ? -8 : 4) - 22 - lvl * 13;
    ctx.drawImage(sprite, x, y);
  }
  util.renderTextDropShadow({
    ctx,
    text: String(r.dice),
    x: r.cx,
    y: r.cy + 52,
    fontSize: '30px',
    fillStyle: C.text,
    dropDistX: 3,
    dropDistY: 3,
  });
}

function drawStar(ctx, x, y, rOut, rIn) {
  ctx.beginPath();
  for (let i = 0; i < 10; i++) {
    const a = -Math.PI / 2 + (i * Math.PI) / 5;
    const rr = i % 2 ? rIn : rOut;
    if (i === 0) ctx.moveTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr);
    else ctx.lineTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr);
  }
  ctx.closePath();
}

function drawIcons(ctx) {
  regions.forEach((r) => {
    if (r.fort) {
      ctx.save();
      ctx.fillStyle = C.fort;
      ctx.strokeStyle = C.border;
      ctx.lineWidth = 3;
      const x = r.cx + 42;
      const y = r.cy - 38;
      ctx.beginPath();
      ctx.moveTo(x - 14, y + 22);
      ctx.lineTo(x - 14, y - 10);
      ctx.lineTo(x - 8, y - 10);
      ctx.lineTo(x - 8, y - 4);
      ctx.lineTo(x - 3, y - 4);
      ctx.lineTo(x - 3, y - 10);
      ctx.lineTo(x + 3, y - 10);
      ctx.lineTo(x + 3, y - 4);
      ctx.lineTo(x + 8, y - 4);
      ctx.lineTo(x + 8, y - 10);
      ctx.lineTo(x + 14, y - 10);
      ctx.lineTo(x + 14, y + 22);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
      ctx.restore();
    }
    if (r.gold) {
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      ctx.fillStyle = C.gold;
      ctx.shadowColor = C.gold;
      ctx.shadowBlur = 14 + 8 * Math.sin(time * 4 + r.id);
      drawStar(ctx, r.cx - 44, r.cy - 40, 17, 7);
      ctx.fill();
      ctx.restore();
    }
  });
}

function drawArrow(ctx, x1, y1, x2, y2, color, alpha) {
  const dx = x2 - x1;
  const dy = y2 - y1;
  const len = Math.sqrt(dx * dx + dy * dy) || 1;
  const ux = dx / len;
  const uy = dy / len;
  const sx = x1 + ux * 30;
  const sy = y1 + uy * 30;
  const ex = x2 - ux * 40;
  const ey = y2 - uy * 40;
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.strokeStyle = color;
  ctx.fillStyle = color;
  ctx.shadowColor = color;
  ctx.shadowBlur = 16;
  ctx.lineWidth = 9;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(sx, sy);
  ctx.lineTo(ex, ey);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(ex + ux * 26, ey + uy * 26);
  ctx.lineTo(ex - uy * 20, ey + ux * 20);
  ctx.lineTo(ex + uy * 20, ey - ux * 20);
  ctx.closePath();
  ctx.fill();
  ctx.restore();
}

function drawTargets(ctx, targets, p) {
  targets.forEach((r) => {
    const v = r.btn.getValue();
    ctx.save();
    ctx.strokeStyle = p.light;
    ctx.lineWidth = 4;
    ctx.globalAlpha = 0.4 + 0.25 * Math.sin(time * 4 + r.id);
    ctx.setLineDash([14, 10]);
    ctx.lineDashOffset = -time * 40;
    ctx.beginPath();
    ctx.arc(r.cx, r.cy, BUTTON_RADIUS, 0, Math.PI * 2);
    ctx.stroke();
    ctx.setLineDash([]);
    if (v > 0) {
      ctx.globalAlpha = 1;
      ctx.strokeStyle = p.main;
      ctx.shadowColor = p.main;
      ctx.shadowBlur = 18;
      ctx.lineWidth = 12;
      ctx.beginPath();
      ctx.arc(r.cx, r.cy, BUTTON_RADIUS, -Math.PI / 2, -Math.PI / 2 + (Math.PI * 2 * Math.min(100, v)) / 90);
      ctx.stroke();
    }
    ctx.restore();
    if (v > 5) {
      const src = attackSource(r, p.index);
      if (src) drawArrow(ctx, src.cx, src.cy, r.cx, r.cy, p.light, Math.min(1, v / 40));
    }
  });
}

function drawFace(ctx, x, y, size, value, fill, pip) {
  ctx.fillStyle = fill;
  roundRectPath(ctx, x - size / 2, y - size / 2, size, size, size * 0.18);
  ctx.fill();
  ctx.fillStyle = pip;
  (PIPS[value] || []).forEach((idx) => {
    const px = x + ((idx % 3) - 1) * size * 0.27;
    const py = y + (Math.floor(idx / 3) - 1) * size * 0.27;
    ctx.beginPath();
    ctx.arc(px, py, size * 0.09, 0, Math.PI * 2);
    ctx.fill();
  });
}

function ownerColors(owner) {
  if (owner < 0) return { main: C.neutralMain, light: C.neutralLight, fill: C.neutralFill, dark: C.neutralDark };
  return players[owner];
}

function drawBattle(ctx) {
  const b = battle;
  const ac = ownerColors(b.from.owner);
  const dc = ownerColors(b.to.owner);
  const size = 46;
  const step = 54;
  const rows = Math.max(b.att.length, b.def.length);
  const pw = rows * step + 230;
  const ph = 170;
  const px = clamp(b.to.cx, pw / 2 + 20, W - pw / 2 - 20);
  const py = clamp(b.to.cy > 600 ? b.to.cy - 220 : b.to.cy + 220, HEADER_H + ph / 2 + 10, H - ph / 2 - 10);
  const reveal = b.revealed;

  drawArrow(ctx, b.from.cx, b.from.cy, b.to.cx, b.to.cy, ac.light, 0.9);

  ctx.save();
  ctx.fillStyle = 'rgba(0,0,0,0.8)';
  ctx.strokeStyle = ac.main;
  ctx.shadowColor = ac.main;
  ctx.shadowBlur = 20;
  ctx.lineWidth = 4;
  roundRectPath(ctx, px - pw / 2, py - ph / 2, pw, ph, 20);
  ctx.fill();
  ctx.stroke();
  ctx.restore();

  const startX = px - pw / 2 + 40;
  [
    { dice: b.shownAtt, total: b.attSum, c: ac, y: py - 38, winner: b.win, bonus: 0 },
    { dice: b.shownDef, total: b.defSum, c: dc, y: py + 42, winner: !b.win, bonus: b.to.fort ? DIFFICULTY.fortBonus : 0 },
  ].forEach((row) => {
    ctx.save();
    ctx.globalAlpha = reveal && !row.winner ? 0.45 : 1;
    const wobble = reveal ? 0 : 1;
    row.dice.forEach((v, i) => {
      ctx.save();
      ctx.translate(startX + i * step, row.y);
      ctx.rotate(wobble * (Math.random() - 0.5) * 0.5);
      drawFace(ctx, 0, 0, size, v, row.c.light, row.c.dark);
      ctx.restore();
    });
    const label = reveal ? '= ' + row.total + (row.bonus ? ' (+' + row.bonus + ')' : '') : '= ?';
    if (reveal && row.winner) {
      ctx.shadowColor = row.c.main;
      ctx.shadowBlur = 20;
    }
    util.renderText({
      ctx,
      text: label,
      x: startX + rows * step,
      y: row.y + 16,
      align: 'left',
      fontSize: '46px',
      fillStyle: row.c.light,
    });
    ctx.restore();
  });
}

function updateAndDrawParticles(ctx, dt) {
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  particles.slice().forEach((p) => {
    p.life -= dt;
    if (p.life <= 0) {
      removeItemFromArray(particles, p);
      return;
    }
    p.x += p.vx * dt;
    p.y += p.vy * dt;
    p.vx *= 0.98;
    p.vy *= 0.98;
    ctx.globalAlpha = Math.min(1, p.life / p.maxLife);
    ctx.fillStyle = p.color;
    ctx.fillRect(p.x - p.size / 2, p.y - p.size / 2, p.size, p.size);
  });
  ctx.restore();
}

function drawFloaters(ctx, dt) {
  floaters.slice().forEach((fl) => {
    fl.life -= dt;
    if (fl.life <= 0) {
      removeItemFromArray(floaters, fl);
      return;
    }
    fl.y -= 60 * dt;
    ctx.save();
    ctx.globalAlpha = Math.min(1, fl.life);
    util.renderTextDropShadow({
      ctx,
      text: fl.text,
      x: fl.x,
      y: fl.y,
      fontSize: fl.size + 'px',
      fillStyle: fl.color,
      dropDistX: 4,
      dropDistY: 4,
    });
    ctx.restore();
  });
}

function drawBanner(ctx, dt) {
  if (!banner) return;
  banner.life -= dt;
  if (banner.life <= 0) {
    banner = null;
    return;
  }
  const t = 1 - banner.life / banner.maxLife;
  ctx.save();
  ctx.globalAlpha = Math.min(1, banner.life * 2, t * 8);
  ctx.fillStyle = 'rgba(0,0,0,0.5)';
  ctx.fillRect(0, H / 2 - 80, W, 130);
  util.renderTextDropShadow({
    ctx,
    text: banner.text,
    x: W / 2,
    y: H / 2 + 20,
    fontSize: '80px',
    fillStyle: banner.color,
    dropDistX: 6,
    dropDistY: 6,
  });
  ctx.restore();
}

function drawHeader(ctx) {
  ctx.save();
  ctx.fillStyle = 'rgba(0,0,0,0.6)';
  ctx.fillRect(0, 0, W, HEADER_H);
  let j = 0;
  players.forEach((p) => {
    if (p.type === 'off') return;
    const x = 20 + j * 335;
    const y = 12;
    j++;
    const isCurrent = p.index === currentPlayer && gameState === 'game';
    const own = regions.filter((r) => r.owner === p.index);
    const dice = own.reduce((a, r) => a + r.dice, 0);
    ctx.save();
    ctx.globalAlpha = p.alive ? 1 : 0.35;
    ctx.fillStyle = p.dark;
    roundRectPath(ctx, x, y, 320, 126, 16);
    ctx.fill();
    if (isCurrent) {
      ctx.strokeStyle = p.light;
      ctx.shadowColor = p.main;
      ctx.shadowBlur = 16 + 10 * Math.sin(time * 5);
      ctx.lineWidth = 6;
      ctx.stroke();
      ctx.shadowBlur = 0;
    }
    ctx.drawImage(dieSprites[p.index + 1], x + 268, y + 12);
    util.renderText({
      ctx,
      text: 'SPIELER ' + (p.index + 1) + (p.type === 'ai' ? ' KI' : ''),
      x: x + 16,
      y: y + 44,
      align: 'left',
      fontSize: '38px',
      fillStyle: p.light,
    });
    if (p.alive) {
      util.renderText({
        ctx,
        text: own.length + ' Gebiete',
        x: x + 16,
        y: y + 82,
        align: 'left',
        fontSize: '30px',
        fillStyle: C.text,
      });
      util.renderText({
        ctx,
        text: dice + ' Würfel' + (p.stock > 0 ? '  (+' + p.stock + ')' : ''),
        x: x + 16,
        y: y + 116,
        align: 'left',
        fontSize: '30px',
        fillStyle: C.text,
      });
    } else {
      util.renderText({ ctx, text: 'RAUS', x: x + 160, y: y + 104, fontSize: '50px', fillStyle: C.bad });
    }
    ctx.restore();
  });

  util.renderTextDropShadow({
    ctx,
    text: 'LEVEL ' + level + '/' + DIFFICULTY.maxLevel,
    x: 1560,
    y: 56,
    fontSize: '44px',
    fillStyle: C.title,
    dropDistX: 4,
    dropDistY: 4,
  });
  const p = players[currentPlayer];
  if (gameState === 'game' && p) {
    if (p.type === 'human') {
      const frac = clamp(turnTimer / levelTurnTime(), 0, 1);
      ctx.fillStyle = 'rgba(255,255,255,0.12)';
      roundRectPath(ctx, 1390, 82, 340, 30, 15);
      ctx.fill();
      ctx.fillStyle = frac < 0.25 ? C.bad : p.main;
      roundRectPath(ctx, 1390, 82, Math.max(30, 340 * frac), 30, 15);
      ctx.fill();
      util.renderText({ ctx, text: Math.ceil(turnTimer) + ' s', x: 1560, y: 140, fontSize: '28px', fillStyle: C.text });
    } else {
      util.renderText({
        ctx,
        text: 'KI denkt' + '...'.slice(0, 1 + (Math.floor(time * 3) % 3)),
        x: 1560,
        y: 112,
        fontSize: '36px',
        fillStyle: p.light,
      });
    }
  }
  ctx.restore();
}

function applyShake(ctx, dt) {
  shake = Math.max(0, shake - 40 * dt);
  if (shake > 0.5) ctx.translate((Math.random() - 0.5) * shake, (Math.random() - 0.5) * shake);
}

function drawFlash(ctx, dt) {
  if (flash <= 0) return;
  ctx.save();
  ctx.globalAlpha = Math.min(0.5, flash * 0.5);
  ctx.fillStyle = flashColor;
  ctx.fillRect(0, 0, W, H);
  ctx.restore();
  flash = Math.max(0, flash - dt * 1.5);
}

function drawBoard(ctx, dt, alpha) {
  ctx.save();
  applyShake(ctx, dt);
  drawSea(ctx);
  ctx.globalAlpha = alpha;
  ctx.drawImage(mapCanvas, 0, 0);
  if (gameState === 'game') {
    ctx.globalCompositeOperation = 'lighter';
    ctx.globalAlpha = 0.55 + 0.35 * Math.sin(time * 3);
    ctx.drawImage(activeCanvas, 0, 0);
    ctx.globalCompositeOperation = 'source-over';
    ctx.globalAlpha = alpha;
  }
  drawIcons(ctx);
  regions.forEach((r) => drawStack(ctx, r));
  ctx.restore();
}

// --- Zustände ---
function handleGame(grid, dt) {
  const ctx = MasterCanvas.get2dContext();
  time += dt;
  drawBoard(ctx, dt, 1);

  const p = players[currentPlayer];
  if (battle) {
    updateBattle(dt);
  } else if (reinforceTimer > 0) {
    reinforceTimer -= dt;
    if (reinforceTimer <= 0) nextPlayer();
  } else if (p.type === 'ai') {
    aiTimer -= dt;
    if (aiTimer <= 0) {
      aiTimer = aiThinkTime();
      const move = pickMove(p.index, aiBoldness());
      if (move) startBattle(move.from, move.to);
      else endTurn();
    }
  } else {
    turnTimer -= dt;
    const targets = regions.filter((r) => attackSource(r, p.index));
    targets.forEach((r) => {
      if (!battle) r.btn.handle(grid, dt);
    });
    if (!battle) {
      drawTargets(ctx, targets, p);
      endButton.handle(grid, dt);
      util.renderText({ ctx, text: 'ENDE', x: END_X, y: END_Y + 11, fontSize: '30px', fillStyle: p.light });
    }
    if (!battle && reinforceTimer <= 0) {
      if (keyPressedOnce('KeyA')) {
        const m = pickMove(p.index, 0);
        if (m) startBattle(m.from, m.to);
      } else if (keyPressedOnce('Enter')) {
        endTurn();
      } else if (targets.length === 0) {
        noMoveTimer += dt;
        if (noMoveTimer > DIFFICULTY.noMoveDelay) endTurn();
      } else if (turnTimer <= 0) {
        endTurn();
      }
    }
  }
  if (battle) drawBattle(ctx);

  updateAndDrawParticles(ctx, dt);
  drawFloaters(ctx, dt);
  drawHeader(ctx);
  drawBanner(ctx, dt);
  drawFlash(ctx, dt);

  if (keyPressedOnce('KeyL') && gameState === 'game' && !battle) {
    const h = players.find((pl) => pl.alive && pl.type === 'human');
    if (h) {
      regions.forEach((r) => (r.owner = h.index));
      players.forEach((pl) => {
        if (pl !== h) pl.alive = false;
      });
      renderMap();
      checkGameEnd();
    }
  }
}

function handleLevelUp(grid, dt) {
  const ctx = MasterCanvas.get2dContext();
  time += dt;
  levelUpTimer -= dt;
  drawBoard(ctx, dt, 0.5);
  updateAndDrawParticles(ctx, dt);
  drawFlash(ctx, dt);
  const w = players[winnerIndex];
  const zoom = 1 + Math.max(0, levelUpTimer - (DIFFICULTY.levelUpDuration - 0.4)) * 1.5;
  ctx.save();
  ctx.translate(W / 2, 420);
  ctx.scale(zoom, zoom);
  util.renderTextDropShadow({ ctx, text: 'LEVEL ' + (level + 1), x: 0, y: 0, fontSize: '170px', fillStyle: C.title });
  ctx.restore();
  util.renderTextDropShadow({
    ctx,
    text: 'Spieler ' + (winnerIndex + 1) + ' hat die Karte erobert!',
    x: W / 2,
    y: 560,
    fontSize: '56px',
    fillStyle: w.light,
    dropDistX: 5,
    dropDistY: 5,
  });
  util.renderTextDropShadow({
    ctx,
    text: LEVEL_NEWS[level + 1] || '',
    x: W / 2,
    y: 660,
    fontSize: '50px',
    fillStyle: C.gold,
    dropDistX: 5,
    dropDistY: 5,
  });
  if (levelUpTimer <= 0) setupLevel(level + 1);
}

function handleSetup(grid, dt) {
  const ctx = MasterCanvas.get2dContext();
  time += dt;
  drawBoard(ctx, dt, 0.3);
  ctx.save();
  ctx.fillStyle = 'rgba(0,0,0,0.35)';
  ctx.fillRect(0, 0, W, H);
  ctx.restore();
  // schwebende Würfel im Hintergrund
  for (let i = 0; i < 12; i++) {
    const x = (i * 173 + time * (30 + i * 4)) % (W + 80) - 40;
    const y = 150 + ((i * 97) % 800) + Math.sin(time + i) * 20;
    ctx.save();
    ctx.globalAlpha = 0.35;
    ctx.translate(x, y);
    ctx.rotate(Math.sin(time * 0.8 + i) * 0.5);
    ctx.drawImage(dieSprites[(i % 4) + 1], -19, -21);
    ctx.restore();
  }
  util.renderTextDropShadow({ ctx, text: 'Würfelreiche', x: W / 2, y: 190, fontSize: '150px', fillStyle: C.title });
  util.renderTextDropShadow({
    ctx,
    text:
      'Freie Plätze spielt die KI\n' ,
    x: W / 2,
    y: 300,
    lineHeight: 64,
    fontSize: '48px',
    fillStyle: C.text,
    dropDistX: 4,
    dropDistY: 4,
  });
  slotButtons.forEach((b, i) => {
    b.handle(grid, dt);
    const pc = playerColors(i);
    const t = slotTypes[i];
    ctx.save();
    ctx.globalAlpha = t === 'off' ? 0.45 : 1;
    ctx.drawImage(dieSprites[i + 1], b.getX() - 19, b.getY() - 95);
    util.renderText({ ctx, text: 'SPIELER ' + (i + 1), x: b.getX(), y: b.getY() - 6, fontSize: '40px', fillStyle: pc.light });
    util.renderText({
      ctx,
      text: t === 'human' ? 'MENSCH' : t === 'ai' ? 'KI' : 'AUS',
      x: b.getX(),
      y: b.getY() + 54,
      fontSize: '50px',
      fillStyle: t === 'human' ? pc.main : C.text,
    });
    ctx.restore();
  });
  startButton.handle(grid, dt);
  util.renderTextDropShadow({ ctx, text: 'START', x: W / 2, y: 925, fontSize: '60px', fillStyle: C.title, dropDistX: 4, dropDistY: 4 });
  ['Digit1', 'Digit2', 'Digit3', 'Digit4'].forEach((k, i) => {
    if (keyPressedOnce(k)) cycleSlot(i);
  });
  if (keyPressedOnce('Space')) startGame();
}

function handleGameOver(grid, dt) {
  const ctx = MasterCanvas.get2dContext();
  time += dt;
  drawBoard(ctx, dt, 0.4);
  updateAndDrawParticles(ctx, dt);
  drawFlash(ctx, dt);
  const w = winnerIndex >= 0 ? players[winnerIndex] : null;
  const humansIn = players.filter((p) => p.type === 'human').length;
  let title = 'Game Over';
  let sub = '';
  if (humansIn === 0) {
    title = 'Spieler ' + (winnerIndex + 1) + ' gewinnt!';
    sub = 'KI gegen KI – nächstes Mal mitspielen!';
  } else if (won && players.filter((p) => p.type === 'ai').length > 0) {
    title = 'Weltherrschaft!';
    sub = 'Spieler ' + (winnerIndex + 1) + ' hat alle ' + DIFFICULTY.maxLevel + ' Level erobert!';
  } else if (won) {
    title = 'Spieler ' + (winnerIndex + 1) + ' gewinnt!';
    sub = 'Die ganze Karte gehört Spieler ' + (winnerIndex + 1) + '.';
  } else {
    title = 'Niederlage!';
    sub = 'Alle Menschen sind raus – Level ' + level + ' von ' + DIFFICULTY.maxLevel;
  }
  util.renderTextDropShadow({ ctx, text: title, x: W / 2, y: 220, fontSize: '140px', fillStyle: w ? w.light : C.bad });
  util.renderTextDropShadow({
    ctx,
    text:
      sub +
      '\n' +
      stats.attacks +
      ' Angriffe · ' +
      stats.wins +
      ' gewonnen · ' +
      stats.lost +
      ' Gebiete verloren\n' +
      'Größtes Reich: ' +
      stats.bestGroup +
      ' Gebiete · ' +
      stats.turns +
      ' Züge',
    x: W / 2,
    y: 350,
    lineHeight: 72,
    fontSize: '48px',
    fillStyle: C.text,
    dropDistX: 4,
    dropDistY: 4,
  });
  againButton.handle(grid, dt);
  setupButton.handle(grid, dt);
  util.renderTextDropShadow({ ctx, text: 'NOCHMAL', x: againButton.getX(), y: againButton.getY() + 20, fontSize: '50px', fillStyle: C.title, dropDistX: 4, dropDistY: 4 });
  util.renderTextDropShadow({ ctx, text: 'PLÄTZE', x: setupButton.getX(), y: setupButton.getY() + 20, fontSize: '50px', fillStyle: C.title, dropDistX: 4, dropDistY: 4 });
  if (gameState === 'gameover' && keyPressedOnce('Space')) startGame();
}

export default {
  name: 'Würfelreiche',
  description: `
Bis zu 4 Reiche kämpfen um eine Inselkarte 
freie Plätze übernimmt die KI.

Leuchtet ein feindliches Nachbargebiet an, 
bis der Ring voll ist: euer stärkstes Gebiet daneben greift an. 
Beide würfeln, die höhere Summe gewinnt.

Starke Gebiete brauchen viele Laser gleichzeitig!

Vorsicht: jedes volle Gebiet greift sofort an 
auch aussichtslos.

Nachschub gibt es für die größte zusammenhängende Gruppe von Gebieten.
  `,
  image: 'media/img/gametitles/laser-basefight-###4###.png',
  init: function () {
    buildPalette();
    buildSprites();
    buildCells();
    gameState = 'setup';
    lastTime = 0;
    time = 0;
    level = 1;
    slotTypes = ['human', 'ai', 'ai', 'ai'];
    stats = { attacks: 0, wins: 0, conquered: 0, lost: 0, turns: 0, bestGroup: 0 };
    battle = null;
    banner = null;
    particles = [];
    floaters = [];
    previousKeys = {};
    shake = 0;
    flash = 0;
    winnerIndex = -1;
    won = false;
    currentPlayer = 0;
    reinforceTimer = 0;
    // Vorschau-Karte für den Startbildschirm
    slotTypes = ['human', 'human', 'human', 'human'];
    createPlayers();
    generateMap(DIFFICULTY.regionsStart + 4);
    setupOwners(1, true);
    slotTypes = ['human', 'ai', 'ai', 'ai'];
    createPlayers();
    renderMap();
    slotButtons = [0, 1, 2, 3].map((i) => {
      const pc = playerColors(i);
      return guiFillButton({
        label: '',
        posX: 330 + i * 420,
        posY: 620,
        radius: 125,
        speedUp: 70,
        speedDown: 30,
        activeValue: 90,
        counterReset: true,
        edges: 6,
        normalColor: pc.fill,
        growColor: pc.main,
        activeColor: pc.light,
        onEnterActive: () => cycleSlot(i),
      });
    });
    const menuColor = { fill: col(0.3, 0.6, 0.45), main: col(0.3, 0.7, 0.9), light: col(0.3, 0.35, 1) };
    startButton = createMenuButton(W / 2, 905, 120, menuColor, () => startGame());
    againButton = createMenuButton(700, 880, 120, menuColor, () => startGame());
    setupButton = createMenuButton(1220, 880, 120, menuColor, () => {
      gameState = 'setup';
      startButton.setCounter(0);
      slotButtons.forEach((b) => b.setCounter(0));
    });
    endButton = guiPixelFillButton({
      label: '',
      posX: END_X,
      posY: END_Y,
      radius: 58,
      speedUp: DIFFICULTY.endTurnSpeed,
      speedDown: 30,
      fullPercent: 30,
      activeValue: 90,
      edges: 8,
      onEnterActive: () => {
        if (isHumanTurn()) endTurn();
      },
    });
  },
  handle: function (grid, elapsed) {
    const dt = getDelta();
    switch (gameState) {
      case 'setup':
        handleSetup(grid, dt);
        break;
      case 'game':
        handleGame(grid, dt);
        break;
      case 'levelup':
        handleLevelUp(grid, dt);
        break;
      case 'gameover':
        handleGameOver(grid, dt);
        break;
    }
  },
  stop: function () {
    activeSounds.slice().forEach((a) => a.pause());
    activeSounds = [];
    particles = [];
    floaters = [];
    battle = null;
  },
};
