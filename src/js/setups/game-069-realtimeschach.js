/**
 * Realtime-Schach – Schach ohne Warten, beide Seiten ziehen gleichzeitig (Spielidee: Georg)
 *
 * Regeln:
 * - 8×8-Brett quer: SCHWARZ links (Spalten 0–1), WEISS rechts (Spalten 6–7). Grundreihe T L L D K L L T –
 *   keine Springer, dafür doppelte Läufer. Bauern laufen nach rechts (Schwarz) bzw. links (Weiß).
 * - Echtzeit: Es gibt keine Züge im Wechsel. Jedes Team darf aber nur EINE Figur gleichzeitig bewegen.
 * - MARKIEREN: Laser auf eine Figur halten, bis der Ring voll ist (mehr Laser = schneller). Dann ist sie die
 *   aktive Figur ihres Teams, alle anderen Figuren dieses Teams sind gesperrt, bis sie wieder steht.
 *   Laser sind nicht unterscheidbar – wer eine GEGNERISCHE Figur markiert, blockiert damit deren Team-Slot
 *   (erlaubte Sabotage, durch den Timeout auf 3 s begrenzt).
 * - SCHIEBEN: Die erlaubten Zielfelder leuchten auf. Die Figur folgt den Lasern, aber nur auf ihren Schienen
 *   (Schachgangart, Weg muss frei sein) – durch Figuren gleitet nichts.
 * - LOSLASSEN: 0,5 s kein Laser auf der Figur → sie rastet auf dem nächsten erlaubten Feld ein.
 *   Spätestens nach 3 s rastet sie automatisch ein. Zurück aufs Startfeld = kein Zug.
 * - SCHLAGEN: Bewegte Figuren sind unverwundbar, geschlagen wird nur, was steht (beim Einrasten auf dessen Feld).
 *   Berühren sich die beiden aktiven Figuren unterwegs, sind BEIDE weg.
 * - Bauer an der gegnerischen Grundlinie wird automatisch zur Dame. Keine Rochade, kein en passant, kein Schach.
 * - Fällt ein König, ist das Spiel vorbei (fallen beide gleichzeitig: Remis).
 * - TEMPO: Jede Minute steigt die Tempo-Stufe – Figuren lassen sich schneller markieren.
 * - Highscore (util/highscore.js, Sortierfeld 'dauer'): High = zäheste Partie, Low = schnellster Königsmord.
 *   Sieger als Zahl codiert: 0 = Schwarz, 1 = Weiß, 0.5 = Remis.
 *
 * Tastatur (ohne Laser): Leertaste = Start/Nochmal, Pfeiltasten = Cursor übers Brett,
 * Enter = Figur unter dem Cursor greifen / am Cursor ablegen.
 *
 * Vorbilder: Kung-Fu Chess (2002, Echtzeitschach mit Sperrzeit), Archon (C64/Amiga 1983), Battle Chess (Amiga 1988).
 * Im Repo ähnlich: game-026-tauziehen (links gegen rechts), game-062-sortierspiel (Greifen per gui/dragHandle).
 *
 * Erstellt mit Claude Opus 5.5 (claude-opus-5-5) über die Skills laser-chris → laser-georg → new-laser-game.
 * Prompt (Kern): "Realtime-chess – wie Schach, nur ohne Springer, aber mit doppelten Läufern. Schwarz links, Weiß
 * rechts. Alle Steine können immer bewegt werden und schlagen, wenn der Weg frei ist und der andere Stein sich nicht
 * bewegt. Schlagen sich zwei gegenseitig, sind beide weg. Fällt ein König, ist das Spiel vorbei." + Nachtrag:
 * "nur eine Figur pro Team gleichzeitig bewegen, markieren, Ziele zeigen, hinschieben, loslassen" + "nach 3 Sekunden
 * einrasten".
 */
import util, { getRgbSpreadHex, getRgbSpread } from '../util.js';
import { createKeyEdge, approach } from './gui/gridScan.js';
import soundGrab from '../../../public/media/369952__mischy__plop-1.wav';
import soundCapture from '../../../public/media/414346__bykgames__explosion-far.wav';
import soundKingFall from '../../../public/media/517267__foolboymedia__cinematic-stomp.wav';
import soundLand from '../../../public/media/opengameart/Menu Move.ogg';
import soundTempo from '../../../public/media/opengameart/Level Up.ogg';
var laserConfig = require('../LaserApiConfig.js').default;
var MasterCanvas = require('../MasterCanvas').default;
var guiFillButton = require('./gui/fillButton').default;
var guiDragHandle = require('./gui/dragHandle').default;
var createHighscore = require('../util/highscore').default;

const W = 1920;
const H = 1080;

// Spielwerte
const SETTINGS = {
  square: 128, // Feldgröße in px
  pieceRadius: 54, // Greifkreis einer Figur (≥ 50 px)
  grabSpeed: 110, // Füllung/s bei voller Abdeckung
  grabSpeedDown: 70,
  grabFullPercent: 15, // ab diesem Flächenanteil volle Füllgeschwindigkeit
  catchFactor: 1.8, // Fangkreis beim Ziehen = Radius × Faktor
  followSmoothing: 12,
  maxSpeed: 1600, // px/s beim Ziehen
  releaseDelay: 0.5, // s ohne Laser → einrasten
  activeTimeout: 3, // s, dann rastet die Figur automatisch ein
  collideFactor: 0.7, // aktive Figuren näher als Feld × Faktor → beide weg
  glide: 18, // Glättung der gezeichneten Position (1/s)
  hueSchwarz: 0.3, // Farbton-Abstand zur Laserfarbe (erlaubt: 0.25..0.75)
  hueWeiss: 0.7,
  maxParticles: 400,
  gameOverDelay: 2.5, // s Explosion zeigen, bevor der Game-Over-Screen kommt
};

// Steigerung über die Partiedauer
const DIFFICULTY = {
  tempoInterval: 60, // s pro Tempo-Stufe
  grabBoostPerTempo: 0.3, // zusätzliche Füllgeschwindigkeit pro Stufe (Anteil)
  maxTempo: 4,
};

const BOARD = { x: (W - 8 * SETTINGS.square) / 2, y: (H - 8 * SETTINGS.square) / 2 };
const BACK_RANK = ['T', 'L', 'L', 'D', 'K', 'L', 'L', 'T'];
const TYPE_NAMES = { K: 'König', D: 'Dame', T: 'Turm', L: 'Läufer', B: 'Bauer' };
const TEAMS = [
  { name: 'SCHWARZ', dir: 1, pawnHome: 1, promoteCol: 7, panelX: BOARD.x / 2 },
  { name: 'WEISS', dir: -1, pawnHome: 6, promoteCol: 0, panelX: W - BOARD.x / 2 },
];
const DIRS_ROOK = [[1, 0], [-1, 0], [0, 1], [0, -1]];
const DIRS_BISHOP = [[1, 1], [1, -1], [-1, 1], [-1, -1]];
const DIRS_ALL = DIRS_ROOK.concat(DIRS_BISHOP);

// Zustand (so vorbelegt, dass handle() auch ohne init() läuft)
let gameState = 'start'; // 'start' | 'play' | 'gameover'
let pieces = [];
let teamActive = [null, null];
let stats = newStats();
let particles = [];
let floatTexts = [];
let time = 0;
let tempo = 1;
let tempoBanner = 0;
let shake = 0;
let ending = false;
let endTimer = 0;
let winner = -1;
let newHigh = false;
let newLow = false;
let cursor = { c: 3, r: 3, visible: false };
let keyPiece = null;
let startButton = null;
let againButton = null;
let fractalCanvas = null;
let palCache = null;
let palKey = '';
const keyEdge = createKeyEdge();
const highscore = createHighscore('Realtime-Schach', 'dauer');

function newStats() {
  return { matchTime: 0, moves: [0, 0], captured: [[], []] };
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
    fractalCanvas = null; // Hintergrund neu einfärben
    palCache = {
      team: [getRgbSpreadHex(tc, SETTINGS.hueSchwarz, 0.75, 0.95), getRgbSpreadHex(tc, SETTINGS.hueWeiss, 0.75, 0.95)],
      teamDim: [getRgbSpreadHex(tc, SETTINGS.hueSchwarz, 0.8, 0.4), getRgbSpreadHex(tc, SETTINGS.hueWeiss, 0.8, 0.4)],
      squareA: getRgbSpreadHex(tc, 0.5, 0.5, 0.06),
      squareB: getRgbSpreadHex(tc, 0.5, 0.5, 0.12),
      frame: getRgbSpreadHex(tc, 0.5, 0.6, 0.5),
      hud: getRgbSpreadHex(tc, 0.5, 0.35, 0.95),
      warn: getRgbSpreadHex(tc, 0.42, 0.9, 1),
    };
  }
  return palCache;
}

function squareCenter(c, r) {
  return { x: BOARD.x + (c + 0.5) * SETTINGS.square, y: BOARD.y + (r + 0.5) * SETTINGS.square };
}

function fmtTime(s) {
  return `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`;
}

function isActive(p) {
  return teamActive[p.team] === p;
}

// ---------- Fraktal-Hintergrund (einmal vorrendern) ----------

function renderFractal() {
  const w = 384;
  const h = 216;
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const g = canvas.getContext('2d');
  const img = g.createImageData(w, h);
  const maxIter = 48;
  const lut = [];
  for (let i = 0; i <= maxIter; i++) {
    const t = i / maxIter;
    lut.push(getRgbSpread(laserConfig.testColor, 0.38 + 0.24 * t, 0.7, 0.03 + 0.4 * Math.pow(t, 0.6)));
  }
  // Julia-Menge c = -0.8 + 0.156i – Tentakel am linken und rechten Rand, Mitte liegt unter dem Brett
  const cr = -0.8;
  const ci = 0.156;
  for (let py = 0; py < h; py++) {
    for (let px = 0; px < w; px++) {
      let zr = ((px / w) * 2 - 1) * 1.9;
      let zi = ((py / h) * 2 - 1) * 1.07;
      let i = 0;
      while (i < maxIter && zr * zr + zi * zi < 4) {
        const t = zr * zr - zi * zi + cr;
        zi = 2 * zr * zi + ci;
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

function drawBackground(ctx) {
  pal();
  if (!fractalCanvas) fractalCanvas = renderFractal();
  const zoom = 1.08 + Math.sin(time * 0.07) * 0.03;
  const ox = Math.sin(time * 0.05) * 30;
  const oy = Math.cos(time * 0.04) * 20;
  ctx.save();
  ctx.globalAlpha = 0.6;
  ctx.drawImage(fractalCanvas, (W - W * zoom) / 2 + ox, (H - H * zoom) / 2 + oy, W * zoom, H * zoom);
  ctx.restore();
}

// ---------- Figuren ----------

function createPiece(team, type, c, r) {
  const pos = squareCenter(c, r);
  const p = { team, type, c, r, drawX: pos.x, drawY: pos.y, activeTime: 0, keyHeld: false, removed: false };
  p.handle = guiDragHandle({
    posX: pos.x,
    posY: pos.y,
    radius: SETTINGS.pieceRadius,
    grabSpeed: SETTINGS.grabSpeed,
    speedDown: SETTINGS.grabSpeedDown,
    fullPercent: SETTINGS.grabFullPercent,
    catchFactor: SETTINGS.catchFactor,
    followSmoothing: SETTINGS.followSmoothing,
    maxSpeed: SETTINGS.maxSpeed,
    dropDelay: SETTINGS.releaseDelay,
    visible: false, // gezeichnet wird selbst (Figurensymbole)
    onGrab: () => onPieceGrab(p),
    onMove: () => projectOnRails(p),
    onDrop: () => finishMove(p),
  });
  return p;
}

function setupBoard() {
  pieces = [];
  for (let r = 0; r < 8; r++) {
    pieces.push(createPiece(0, BACK_RANK[r], 0, r), createPiece(0, 'B', 1, r));
    pieces.push(createPiece(1, BACK_RANK[r], 7, r), createPiece(1, 'B', 6, r));
  }
}

// nur STEHENDE Figuren belegen Felder – aktive (bewegte) sind unterwegs und unverwundbar
function buildOccupancy() {
  const occ = new Array(64);
  pieces.forEach((p) => {
    if (!p.removed && !isActive(p)) occ[p.c + p.r * 8] = p;
  });
  return occ;
}

/** erlaubte Zielfelder + Schienen-Endpunkte (vom Startfeld aus) */
function getMoves(p) {
  const occ = buildOccupancy();
  const targets = [];
  const rails = [];
  // mode: 'both' = ziehen und schlagen, 'move' = nur auf leere Felder, 'capture' = nur schlagen
  const slide = (dirs, maxSteps, mode) => {
    dirs.forEach(([dc, dr]) => {
      let last = null;
      for (let s = 1; s <= maxSteps; s++) {
        const c = p.c + dc * s;
        const r = p.r + dr * s;
        if (c < 0 || c > 7 || r < 0 || r > 7) break;
        const other = occ[c + r * 8];
        if (other) {
          if (other.team !== p.team && mode !== 'move') {
            targets.push({ c, r, capture: other });
            last = { c, r };
          }
          break;
        }
        if (mode === 'capture') break;
        targets.push({ c, r, capture: null });
        last = { c, r };
      }
      if (last) rails.push(last);
    });
  };
  if (p.type === 'K') slide(DIRS_ALL, 1, 'both');
  else if (p.type === 'D') slide(DIRS_ALL, 7, 'both');
  else if (p.type === 'T') slide(DIRS_ROOK, 7, 'both');
  else if (p.type === 'L') slide(DIRS_BISHOP, 7, 'both');
  else {
    const team = TEAMS[p.team];
    slide([[team.dir, 0]], p.c === team.pawnHome ? 2 : 1, 'move');
    slide([[team.dir, 1], [team.dir, -1]], 1, 'capture');
  }
  return { targets, rails };
}

/** Handle-Position auf die nächste Schiene (Strecke Startfeld → Schienenende) zwingen */
function projectOnRails(p) {
  const { rails } = getMoves(p);
  const o = squareCenter(p.c, p.r);
  const px = p.handle.getX();
  const py = p.handle.getY();
  let best = o;
  let bestD = Math.hypot(px - o.x, py - o.y);
  rails.forEach((end) => {
    const e = squareCenter(end.c, end.r);
    const vx = e.x - o.x;
    const vy = e.y - o.y;
    const t = Math.max(0, Math.min(1, ((px - o.x) * vx + (py - o.y) * vy) / (vx * vx + vy * vy)));
    const q = { x: o.x + vx * t, y: o.y + vy * t };
    const d = Math.hypot(px - q.x, py - q.y);
    if (d < bestD) {
      bestD = d;
      best = q;
    }
  });
  p.handle.setX(best.x);
  p.handle.setY(best.y);
}

function setTeamEnabled(team, enabled) {
  pieces.forEach((q) => {
    if (q.team === team && !q.removed && !isActive(q)) q.handle.setEnabled(enabled);
  });
}

function onPieceGrab(p) {
  teamActive[p.team] = p;
  p.activeTime = 0;
  setTeamEnabled(p.team, false);
  play(soundGrab, 0.4);
}

function releaseSlot(p) {
  if (teamActive[p.team] === p) teamActive[p.team] = null;
  p.activeTime = 0;
  p.keyHeld = false;
  if (keyPiece === p) keyPiece = null;
  setTeamEnabled(p.team, true);
}

/** Einrasten auf dem nächsten erlaubten Feld (Startfeld zählt mit = kein Zug) */
function finishMove(p) {
  if (!isActive(p) || p.removed) return;
  const { targets } = getMoves(p);
  const px = p.handle.getX();
  const py = p.handle.getY();
  const o = squareCenter(p.c, p.r);
  let best = null;
  let bestD = Math.hypot(px - o.x, py - o.y);
  targets.forEach((t) => {
    const cc = squareCenter(t.c, t.r);
    const d = Math.hypot(px - cc.x, py - cc.y);
    if (d < bestD) {
      bestD = d;
      best = t;
    }
  });
  releaseSlot(p);
  if (best) {
    p.c = best.c;
    p.r = best.r;
    stats.moves[p.team]++;
    if (best.capture) capturePiece(best.capture, p.team);
    else play(soundLand, 0.35);
    if (p.type === 'B' && p.c === TEAMS[p.team].promoteCol) {
      p.type = 'D';
      const cc = squareCenter(p.c, p.r);
      addFloat('DAME!', cc.x, cc.y - 60, pal().team[p.team]);
      burst(cc.x, cc.y, pal().team[p.team], 50);
    }
  }
  const cc = squareCenter(p.c, p.r);
  p.handle.setX(cc.x);
  p.handle.setY(cc.y);
}

function removePiece(victim, color) {
  victim.removed = true;
  if (isActive(victim)) releaseSlot(victim);
  if (keyPiece === victim) keyPiece = null;
  pieces = pieces.filter((q) => q !== victim);
  burst(victim.drawX, victim.drawY, color, 70);
}

function capturePiece(victim, byTeam) {
  stats.captured[byTeam].push(victim.type);
  removePiece(victim, pal().team[victim.team]);
  play(soundCapture, 0.5);
  shake = Math.max(shake, 0.25);
  addFloat(victim.type === 'K' ? 'SCHACHMATT!' : 'GESCHLAGEN!', victim.drawX, victim.drawY - 70, pal().warn);
  if (victim.type === 'K') endGame(byTeam);
}

/** beide aktiven Figuren berühren sich → beide weg */
function checkCollision() {
  const a = teamActive[0];
  const b = teamActive[1];
  if (!a || !b) return;
  if (Math.hypot(a.handle.getX() - b.handle.getX(), a.handle.getY() - b.handle.getY()) > SETTINGS.square * SETTINGS.collideFactor) return;
  stats.captured[0].push(b.type);
  stats.captured[1].push(a.type);
  removePiece(a, pal().team[0]);
  removePiece(b, pal().team[1]);
  play(soundCapture, 0.7);
  shake = Math.max(shake, 0.5);
  addFloat('ZUSAMMENSTOSS!', (a.drawX + b.drawX) / 2, (a.drawY + b.drawY) / 2 - 70, pal().warn);
  const kingA = a.type === 'K';
  const kingB = b.type === 'K';
  if (kingA && kingB) endGame(0.5);
  else if (kingA) endGame(1);
  else if (kingB) endGame(0);
}

// ---------- Effekte ----------

function burst(x, y, color, n) {
  for (let i = 0; i < n && particles.length < SETTINGS.maxParticles; i++) {
    const a = Math.random() * Math.PI * 2;
    const v = 100 + Math.random() * 500;
    const life = 0.5 + Math.random() * 0.8;
    particles.push({ x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v, life, max: life, color, size: 3 + Math.random() * 6 });
  }
}

function addFloat(text, x, y, color) {
  floatTexts.push({ text, x, y, life: 1.4, color });
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
    p.vx *= 0.94;
    p.vy *= 0.94;
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
    f.y -= 50 * dt;
    ctx.save();
    ctx.globalAlpha = Math.min(1, f.life);
    util.renderText({ ctx, text: f.text, x: f.x, y: f.y, fontSize: '44px', fillStyle: f.color });
    ctx.restore();
  });
}

// ---------- Zeichnen ----------

/** Figurensymbol als Pfad, Ursprung = Figurenmitte, s = Größe */
function pieceSymbol(ctx, type, s) {
  ctx.beginPath();
  if (type === 'B') {
    ctx.moveTo(-0.3 * s, 0.3 * s);
    ctx.lineTo(-0.15 * s, 0);
    ctx.lineTo(0.15 * s, 0);
    ctx.lineTo(0.3 * s, 0.3 * s);
    ctx.closePath();
    ctx.moveTo(0.24 * s, -0.25 * s);
    ctx.arc(0, -0.25 * s, 0.24 * s, 0, Math.PI * 2);
  } else if (type === 'T') {
    const pts = [
      [-0.35, 0.3], [-0.35, -0.3], [-0.45, -0.3], [-0.45, -0.62], [-0.25, -0.62], [-0.25, -0.47], [-0.08, -0.47],
      [-0.08, -0.62], [0.08, -0.62], [0.08, -0.47], [0.25, -0.47], [0.25, -0.62], [0.45, -0.62], [0.45, -0.3],
      [0.35, -0.3], [0.35, 0.3],
    ];
    pts.forEach(([x, y], i) => (i ? ctx.lineTo(x * s, y * s) : ctx.moveTo(x * s, y * s)));
    ctx.closePath();
  } else if (type === 'L') {
    ctx.moveTo(0, -0.68 * s);
    ctx.quadraticCurveTo(0.55 * s, -0.15 * s, 0.28 * s, 0.3 * s);
    ctx.lineTo(-0.28 * s, 0.3 * s);
    ctx.quadraticCurveTo(-0.55 * s, -0.15 * s, 0, -0.68 * s);
    ctx.moveTo(0.14 * s, -0.4 * s);
    ctx.lineTo(-0.14 * s, -0.05 * s);
    ctx.moveTo(0.09 * s, -0.78 * s);
    ctx.arc(0, -0.78 * s, 0.09 * s, 0, Math.PI * 2);
  } else if (type === 'D') {
    const pts = [[-0.48, 0.3], [-0.6, -0.45], [-0.28, -0.1], [0, -0.62], [0.28, -0.1], [0.6, -0.45], [0.48, 0.3]];
    pts.forEach(([x, y], i) => (i ? ctx.lineTo(x * s, y * s) : ctx.moveTo(x * s, y * s)));
    ctx.closePath();
    [[-0.6, -0.45], [0, -0.62], [0.6, -0.45]].forEach(([x, y]) => {
      ctx.moveTo((x + 0.08) * s, (y - 0.08) * s);
      ctx.arc(x * s, (y - 0.08) * s, 0.08 * s, 0, Math.PI * 2);
    });
  } else {
    ctx.moveTo(-0.45 * s, 0.3 * s);
    ctx.quadraticCurveTo(-0.65 * s, -0.35 * s, 0, -0.32 * s);
    ctx.quadraticCurveTo(0.65 * s, -0.35 * s, 0.45 * s, 0.3 * s);
    ctx.closePath();
    ctx.moveTo(0, -0.32 * s);
    ctx.lineTo(0, -0.82 * s);
    ctx.moveTo(-0.16 * s, -0.64 * s);
    ctx.lineTo(0.16 * s, -0.64 * s);
  }
  ctx.rect(-0.5 * s, 0.3 * s, s, 0.16 * s); // Sockel
}

function drawPieceShape(ctx, type, x, y, s, color, alpha = 1, lineWidth = 5) {
  ctx.save();
  ctx.translate(x, y);
  ctx.globalAlpha = alpha * 0.18;
  ctx.fillStyle = color;
  pieceSymbol(ctx, type, s);
  ctx.fill();
  ctx.globalAlpha = alpha;
  ctx.strokeStyle = color;
  ctx.lineWidth = lineWidth;
  ctx.lineJoin = 'round';
  pieceSymbol(ctx, type, s);
  ctx.stroke();
  ctx.restore();
}

function drawBoard(ctx, alpha = 1) {
  const P = pal();
  const sq = SETTINGS.square;
  ctx.save();
  ctx.globalAlpha = alpha;
  for (let c = 0; c < 8; c++) {
    for (let r = 0; r < 8; r++) {
      ctx.fillStyle = (c + r) % 2 ? P.squareB : P.squareA;
      ctx.fillRect(BOARD.x + c * sq, BOARD.y + r * sq, sq, sq);
    }
  }
  ctx.strokeStyle = P.frame;
  ctx.lineWidth = 4;
  ctx.shadowColor = P.frame;
  ctx.shadowBlur = 20 + Math.sin(time * 2) * 8;
  ctx.strokeRect(BOARD.x - 2, BOARD.y - 2, 8 * sq + 4, 8 * sq + 4);
  ctx.restore();
}

function drawTargets(ctx) {
  const P = pal();
  const sq = SETTINGS.square;
  [0, 1].forEach((team) => {
    const p = teamActive[team];
    if (!p) return;
    const { targets, rails } = getMoves(p);
    const o = squareCenter(p.c, p.r);
    ctx.save();
    ctx.strokeStyle = P.teamDim[team];
    ctx.lineWidth = 3;
    rails.forEach((end) => {
      const e = squareCenter(end.c, end.r);
      ctx.beginPath();
      ctx.moveTo(o.x, o.y);
      ctx.lineTo(e.x, e.y);
      ctx.stroke();
    });
    ctx.setLineDash([14, 10]);
    ctx.lineDashOffset = -time * 40;
    ctx.strokeRect(o.x - sq / 2 + 8, o.y - sq / 2 + 8, sq - 16, sq - 16);
    targets.forEach((t) => {
      const cc = squareCenter(t.c, t.r);
      if (t.capture) {
        ctx.strokeStyle = P.warn;
        ctx.lineWidth = 5;
        ctx.beginPath();
        ctx.arc(cc.x, cc.y, sq * 0.46 + Math.sin(time * 8) * 3, 0, Math.PI * 2);
        ctx.stroke();
      } else {
        ctx.strokeStyle = P.team[team];
        ctx.lineWidth = 3;
        ctx.strokeRect(cc.x - sq / 2 + 12, cc.y - sq / 2 + 12, sq - 24, sq - 24);
      }
    });
    ctx.restore();
  });
}

function drawPiece(ctx, p) {
  const P = pal();
  const active = isActive(p);
  const enabled = active || p.handle.getEnabled();
  const fill = active || !enabled ? 0 : p.handle.getValue();
  const wobble = fill > 0 ? Math.sin(time * 40) * (fill / 100) * 6 : 0;
  const s = SETTINGS.pieceRadius * (active ? 1.12 : 0.95);
  ctx.save();
  if (active) {
    ctx.shadowColor = P.team[p.team];
    ctx.shadowBlur = 25;
  }
  drawPieceShape(ctx, p.type, p.drawX + wobble, p.drawY, s, P.team[p.team], enabled ? 1 : 0.4, active ? 6 : 5);
  ctx.restore();
  ctx.save();
  ctx.strokeStyle = P.team[p.team];
  if (fill > 0) {
    // Markier-Ring füllt sich
    ctx.lineWidth = 8;
    ctx.beginPath();
    ctx.arc(p.drawX, p.drawY, SETTINGS.pieceRadius + 6, -Math.PI / 2, -Math.PI / 2 + (Math.PI * 2 * fill) / 100);
    ctx.stroke();
  }
  if (active) {
    // Countdown bis zum automatischen Einrasten
    const rest = Math.max(0, 1 - p.activeTime / SETTINGS.activeTimeout);
    ctx.strokeStyle = rest < 0.34 ? P.warn : P.team[p.team];
    ctx.lineWidth = 6;
    ctx.setLineDash([10, 8]);
    ctx.beginPath();
    ctx.arc(p.drawX, p.drawY, SETTINGS.pieceRadius * SETTINGS.catchFactor * 0.8, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * rest);
    ctx.stroke();
  }
  ctx.restore();
}

function drawPanels(ctx) {
  const P = pal();
  ctx.save();
  ctx.fillStyle = 'rgba(0,0,0,0.45)';
  ctx.fillRect(0, 0, BOARD.x - 20, H);
  ctx.fillRect(W - BOARD.x + 20, 0, BOARD.x - 20, H);
  ctx.restore();
  TEAMS.forEach((team, i) => {
    const x = team.panelX;
    const col = P.team[i];
    const a = teamActive[i];
    util.renderText({ ctx, text: team.name, x, y: 110, fontSize: '60px', fillStyle: col });
    const status = a
      ? `${TYPE_NAMES[a.type]} ${Math.max(0, SETTINGS.activeTimeout - a.activeTime).toFixed(1)} s`
      : 'bereit';
    util.renderText({ ctx, text: status, x, y: 190, fontSize: '42px', fillStyle: a ? col : P.hud });
    util.renderText({ ctx, text: `Züge: ${stats.moves[i]}`, x, y: 270, fontSize: '42px', fillStyle: P.hud });
    util.renderText({ ctx, text: 'Geschlagen:', x, y: 350, fontSize: '36px', fillStyle: P.hud });
    stats.captured[i].forEach((type, k) => {
      const cx = x - 150 + (k % 6) * 60;
      const cy = 410 + Math.floor(k / 6) * 70;
      drawPieceShape(ctx, type, cx, cy, 26, P.team[1 - i], 0.9, 3);
    });
  });
  util.renderText({ ctx, text: `Zeit ${fmtTime(stats.matchTime)}`, x: TEAMS[0].panelX, y: 1010, fontSize: '42px', fillStyle: P.hud });
  util.renderText({ ctx, text: `Tempo ${tempo}`, x: TEAMS[1].panelX, y: 1010, fontSize: '42px', fillStyle: P.hud });
}

function drawCursor(ctx) {
  if (!cursor.visible) return;
  const cc = squareCenter(cursor.c, cursor.r);
  const sq = SETTINGS.square;
  ctx.save();
  ctx.strokeStyle = pal().hud;
  ctx.lineWidth = 3;
  ctx.setLineDash([6, 6]);
  ctx.strokeRect(cc.x - sq / 2 + 3, cc.y - sq / 2 + 3, sq - 6, sq - 6);
  ctx.restore();
}

// ---------- Tastatur (Test ohne Laser) ----------

function handleKeyboard() {
  const moves = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1] };
  Object.keys(moves).forEach((code) => {
    if (!keyEdge(code)) return;
    cursor.visible = true;
    cursor.c = Math.max(0, Math.min(7, cursor.c + moves[code][0]));
    cursor.r = Math.max(0, Math.min(7, cursor.r + moves[code][1]));
  });
  if (!keyEdge('Enter')) return;
  cursor.visible = true;
  if (keyPiece) {
    keyPiece.handle.drop();
    return;
  }
  const p = pieces.find((q) => q.c === cursor.c && q.r === cursor.r && !isActive(q));
  if (p && !teamActive[p.team]) {
    keyPiece = p;
    p.keyHeld = true;
    p.handle.grab();
  }
}

// ---------- Spielablauf ----------

function resetMatch() {
  pieces = [];
  teamActive = [null, null];
  stats = newStats();
  particles = [];
  floatTexts = [];
  tempo = 1;
  tempoBanner = 0;
  shake = 0;
  ending = false;
  endTimer = 0;
  winner = -1;
  keyPiece = null;
  cursor = { c: 3, r: 3, visible: false };
}

function startGame() {
  resetMatch();
  setupBoard();
  gameState = 'play';
  play(soundKingFall, 0.35);
}

function endGame(w) {
  if (ending) return;
  ending = true;
  endTimer = SETTINGS.gameOverDelay;
  winner = w;
  shake = 0.9;
  play(soundKingFall, 0.7);
  highscore.addEntry({
    dauer: stats.matchTime,
    sieger: w,
    zuegeSchwarz: stats.moves[0],
    zuegeWeiss: stats.moves[1],
    geschlagenVonSchwarz: stats.captured[0].length,
    geschlagenVonWeiss: stats.captured[1].length,
  });
  newHigh = highscore.lastEntryNewHighscore();
  newLow = highscore.lastEntryNewLowscore();
}

function createButtons() {
  const P = pal();
  const opts = {
    posX: W / 2,
    radius: 110,
    edges: 8,
    speedUp: 60,
    speedDown: 30,
    lineWidth: 5,
    normalColor: P.teamDim[0],
    growColor: P.team[0],
    activeColor: P.team[1],
  };
  
  startButton = guiFillButton(Object.assign({}, opts, { label: 'START', posY: 760, onEnterActive: () => startGame() }));
  againButton = guiFillButton(Object.assign({}, opts, { label: 'NOCHMAL', posY: 900, onEnterActive: () => startGame() }));
}

function updateTempo() {
  const t = Math.min(DIFFICULTY.maxTempo, 1 + Math.floor(stats.matchTime / DIFFICULTY.tempoInterval));
  if (t > tempo) {
    tempo = t;
    tempoBanner = 2;
    play(soundTempo, 0.4);
  }
}

function updatePiece(p, grid, dt) {
  if (p.keyHeld) {
    const target = squareCenter(cursor.c, cursor.r);
    p.handle.setX(approach(p.handle.getX(), target.x, 10, dt));
    p.handle.setY(approach(p.handle.getY(), target.y, 10, dt));
    projectOnRails(p);
  } else {
    // Handle-Wrapping: höhere Tempo-Stufe = schneller markieren
    const before = p.handle.getValue();
    p.handle.handle(grid, dt);
    const after = p.handle.getValue();
    const boost = (tempo - 1) * DIFFICULTY.grabBoostPerTempo;
    if (!p.removed && !p.handle.isGrabbed() && after > before && boost > 0) {
      p.handle.setValue(Math.min(100, after + (after - before) * boost));
    }
  }
  p.drawX = approach(p.drawX, p.handle.getX(), SETTINGS.glide, dt);
  p.drawY = approach(p.drawY, p.handle.getY(), SETTINGS.glide, dt);
}

function handlePlay(grid, dt, ctx) {
  if (!ending) {
    stats.matchTime += dt;
    updateTempo();
    handleKeyboard();
    pieces.slice().forEach((p) => {
      if (!p.removed && !ending) updatePiece(p, grid, dt);
    });
    [0, 1].forEach((team) => {
      const a = teamActive[team];
      if (!a || ending) return;
      a.activeTime += dt;
      if (a.activeTime >= SETTINGS.activeTimeout) {
        a.handle.drop();
        if (teamActive[team] === a) finishMove(a); // Sicherheitsnetz, falls das Handle nicht gegriffen war
      }
    });
    if (!ending) checkCollision();
  } else {
    pieces.forEach((p) => {
      p.drawX = approach(p.drawX, p.handle.getX(), SETTINGS.glide, dt);
      p.drawY = approach(p.drawY, p.handle.getY(), SETTINGS.glide, dt);
    });
    endTimer -= dt;
    if (endTimer <= 0) {
      gameState = 'gameover';
      createButtons();
    }
  }

  drawPanels(ctx);
  drawBoard(ctx);
  drawTargets(ctx);
  drawCursor(ctx);
  pieces.forEach((p) => !isActive(p) && drawPiece(ctx, p));
  pieces.forEach((p) => isActive(p) && drawPiece(ctx, p));
  drawEffects(ctx, dt);

  if (tempoBanner > 0) {
    tempoBanner -= dt;
    ctx.save();
    ctx.globalAlpha = Math.min(1, tempoBanner);
    util.renderText({ ctx, text: `TEMPO ${tempo}`, x: W / 2, y: H / 2, fontSize: '150px', fillStyle: pal().warn });
    util.renderText({ ctx, text: 'schneller markieren!', x: W / 2, y: H / 2 + 80, fontSize: '50px', fillStyle: pal().hud });
    ctx.restore();
  }
}

function handleStart(grid, dt, ctx) {
  const P = pal();
  if (!startButton) createButtons();
  util.renderText({ ctx, text: 'REALTIME-SCHACH', x: W / 2, y: 220, fontSize: '150px', fillStyle: P.hud });
  util.renderText({
    ctx,
    text: `Beide Seiten ziehen gleichzeitig – aber jedes Team nur EINE Figur.\nFigur anleuchten bis der Ring voll ist, auf ihrer Bahn schieben, loslassen.\nNach 3 Sekunden rastet sie von selbst ein. Fällt ein König – aus!`,
    x: W / 2,
    y: 330,
    fontSize: '40px',
    lineHeight: 58,
    fillStyle: P.hud,
  });
  ['T', 'L', 'D', 'K', 'B'].forEach((type, i) => {
    const bob = Math.sin(time * 2 + i) * 10;
    drawPieceShape(ctx, type, 360 + i * 70, 550 + bob, 40, P.team[0]);
    drawPieceShape(ctx, type, W - 360 - i * 70, 550 - bob, 40, P.team[1]);
  });
  util.renderText({ ctx, text: 'SCHWARZ', x: 500, y: 470, fontSize: '50px', fillStyle: P.team[0] });
  util.renderText({ ctx, text: 'WEISS', x: W - 500, y: 470, fontSize: '50px', fillStyle: P.team[1] });
  util.renderText({ ctx, text: 'Leertaste = Start', x: W / 2, y: 940, fontSize: '36px', fillStyle: P.hud });
  highscore.renderHighAndLowScores(ctx);
  startButton.handle(grid, dt);
  if (keyEdge('Space')) startGame();
}

function handleGameOver(grid, dt, ctx) {
  const P = pal();
  if (!againButton) createButtons();
  drawBoard(ctx, 0.3);
  pieces.forEach((p) => drawPieceShape(ctx, p.type, p.drawX, p.drawY, SETTINGS.pieceRadius * 0.95, P.team[p.team], 0.3));
  drawEffects(ctx, dt);
  const title = winner === 0.5 ? 'REMIS!' : `${TEAMS[winner].name} GEWINNT!`;
  const col = winner === 0.5 ? P.hud : P.team[winner];
  util.renderText({ ctx, text: title, x: W / 2, y: 220, fontSize: '150px', fillStyle: col });
  util.renderText({
    ctx,
    text: `Dauer ${fmtTime(stats.matchTime)}   ·   Tempo-Stufe ${tempo}\nZüge   Schwarz ${stats.moves[0]}   ·   Weiß ${stats.moves[1]}\nGeschlagen   Schwarz ${stats.captured[0].length}   ·   Weiß ${stats.captured[1].length}`,
    x: W / 2,
    y: 340,
    fontSize: '46px',
    lineHeight: 66,
    fillStyle: P.hud,
  });
  const record = newLow
    ? 'Schnellster Königsmord aller Zeiten!'
    : newHigh
    ? 'Zäheste Partie aller Zeiten – wie damals am C64 nach Mitternacht.'
    : '';
  if (record) util.renderText({ ctx, text: record, x: W / 2, y: 580, fontSize: '44px', fillStyle: P.warn });
  highscore.renderHighAndLowScores(ctx);
  againButton.handle(grid, dt);
  if (keyEdge('Space')) startGame();
}

export default {
  name: 'Realtime-Schach',
  description: `Realtime-Schach – Schwarz (links) gegen Weiß (rechts), beide ziehen GLEICHZEITIG.
Ohne Springer, dafür mit doppelten Läufern.
Jedes Team darf nur EINE Figur auf einmal bewegen:
Figur anleuchten bis der Ring voll ist, dann auf ihrer Bahn zum Ziel schieben und loslassen.
Nach 3 Sekunden rastet sie automatisch ein.
Bewegte Figuren sind unverwundbar – geschlagen wird nur, was steht.
Stoßen beide bewegten Figuren zusammen, sind beide weg.
Fällt ein König, ist das Spiel aus!`,
  image: 'media/img/gametitles/laser-basefight-###8###.png',
  init() {
    resetMatch();
    gameState = 'start';
    newHigh = false;
    newLow = false;
    createButtons();
  },
  handle(grid, elapsed) {
    const dt = Math.min(elapsed, 0.1);
    const ctx = MasterCanvas.get2dContext();
    time += dt;
    if (gameState === 'play' && pieces.length === 0 && !ending) setupBoard();
    ctx.save();
    if (shake > 0) {
      shake = Math.max(0, shake - dt);
      ctx.translate((Math.random() - 0.5) * 40 * shake, (Math.random() - 0.5) * 40 * shake);
    }
    drawBackground(ctx);
    if (gameState === 'start') handleStart(grid, dt, ctx);
    else if (gameState === 'play') handlePlay(grid, dt, ctx);
    else handleGameOver(grid, dt, ctx);
    ctx.restore();
  },
  stop() {
    keyPiece = null;
    teamActive = [null, null];
  },
};
