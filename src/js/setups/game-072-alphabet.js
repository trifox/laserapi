/**
 * Alphabet – Kühlschrankpoesie mit Lasern (Spielidee: Georg)
 *
 * Eine entspannte Sandbox ohne Ziel, ohne Level und ohne Highscore (bewusste Entscheidung): Buchstaben legen,
 * Wörter bilden, Sprüche und Titel bauen – nach Lust und Laune.
 *
 * Regeln:
 * - Oben und unten liegen Leisten mit allen Buchstaben A–Z, dem Löschzeichen ⌫ und NEU.
 *   Laser auf ein Feld halten, bis es voll ist (gui/pixelFillButton) → der Buchstabe springt ins Feld.
 * - GREIFEN: Laser auf einen Buchstaben halten, bis sein Ring voll ist (gui/dragHandle) → er folgt dem Laser.
 *   Kein Laser mehr → er wird abgelegt.
 * - Freie Buchstaben prallen voneinander ab und kommen durch Reibung zur Ruhe.
 * - MAGNET-ZEILEN: Wird ein Buchstabe direkt neben einem anderen abgelegt, rastet er auf dessen Zeile ein und klebt.
 *   Geklebte Buchstaben stehen fest (freie prallen an ihnen ab). Wegziehen löst ihn wieder.
 * - Ketten geklebter Buchstaben sind WÖRTER: Sie bekommen einen leuchtenden Unterstrich, neue Wörter funkeln.
 * - Das ⌫ löscht den ersten Buchstaben, den es berührt – und verschwindet dabei selbst.
 * - NEU (lange füllen) räumt alles ab.
 * - PRÄSENTATIONSMODUS: Ist ein paar Sekunden lang kein Laser aktiv, blenden die Leisten aus – das Gelegte
 *   steht als Titel oder Spaßmeldung da. Laser auf den Rand holt die Leisten zurück.
 * - Höchstens 60 Buchstaben – danach verpufft der älteste freie.
 *
 * Tastatur (ohne Laser): Pfeiltasten = Cursor, Leertaste = Zufallsbuchstabe am Cursor, Backspace = ⌫ am Cursor,
 * Enter = Buchstaben am Cursor greifen / ablegen. (Buchstabentasten sind wegen der Debug-Tasten nicht belegt.)
 *
 * Vorbilder: Magnetic Poetry (1993, Wortmagnete am Kühlschrank), Scrabble, Amiga Workbench SAY (1985).
 * Im Repo ähnlich: game-040-wortlicht (auch Buchstaben, aber Suchspiel mit Ziel); Greifen wie game-069.
 *
 * Erstellt mit Claude Opus 5.5 (claude-opus-5-5) über die Skills laser-chris → new-laser-game.
 * Prompt (Kern): "ein entspannendes nur Wörter legen Spiel, ohne wirkliches Ziel einfach Buchstaben legen und Wörter
 * bilden nach Lust und Laune, dass es auch als Titel genommen werden kann oder für Spaßmeldungen. Alphabet: Am Rande
 * sind alle Buchstaben in Groß und ein Löschzeichen. Die Buchstaben und das Löschzeichen können gespawned werden und
 * bewegt. Das Löschzeichen kann einen Buchstaben löschen und verschwindet dann selbst auch. Die Buchstaben prallen
 * voneinander ab." + Auswahl: Chill-Sandbox, Magnet-Zeilen, kein Highscore.
 */
import util, { getRgbSpreadHex, getRgbSpread } from '../util.js';
import { createKeyEdge, isKeyDown } from './gui/gridScan.js';
import soundPlop from '../../../public/media/369952__mischy__plop-1.wav';
import soundClick from '../../../public/media/opengameart/Menu Selection Click.wav';
import soundDelete from '../../../public/media/opengameart/Decline.wav';
import soundWord from '../../../public/media/opengameart/Accept.mp3';
import soundClear from '../../../public/media/opengameart/Transition.ogg';
var laserConfig = require('../LaserApiConfig.js').default;
var MasterCanvas = require('../MasterCanvas').default;
var guiPixelFillButton = require('./gui/pixelFillButton').default;
var guiDragHandle = require('./gui/dragHandle').default;

const W = 1920;
const H = 1080;
const DELETE = '⌫';
const CLEAR = 'NEU';

const SETTINGS = {
  radius: 50, // Greif- und Stoßradius eines Buchstabens (≥ 50 px)
  spacing: 100, // Abstand geklebter Buchstaben in einer Zeile
  fontSize: 84,
  barY: [70, H - 70], // Mitte der Leisten oben/unten
  barHeight: 130,
  slotsPerBar: 14,
  slotRadius: 52,
  area: { x: 0, y: 140, width: W, height: H - 280 }, // Spielfläche zwischen den Leisten
  maxLetters: 60,
  friction: 2.2, // Abbremsung 1/s
  restitution: 0.7, // Abprall-Elastizität
  spawnSpeed: 260,
  glueDy: 0.9, // höchstens so viele Radien Höhenunterschied zum Einrasten
  glueDx: [1.2, 3.0], // horizontaler Abstand (in Radien) zum Einrasten
  deleteReach: 1.6, // ⌫ löscht unterhalb dieses Abstands (in Radien)
  idleToPresent: 8, // s ohne Laser → Leisten ausblenden
  cursorSpeed: 700,
  maxParticles: 400,
};

// Zustand (so vorbelegt, dass handle() auch ohne init() läuft)
let letters = []; // { ch, x, y, vx, vy, glued, keyHeld, handle, born }
let spawners = [];
let particles = [];
let floatTexts = [];
let knownWords = new Set();
let time = 0;
let idleTime = 0;
let barAlpha = 1;
let cursor = { x: W / 2, y: H / 2, visible: false };
let keyLetter = null;
let fractalCanvas = null;
let palCache = null;
let palKey = '';
let lastSound = 0;
const keyEdge = createKeyEdge();

// ---------- Hilfen ----------

function play(snd, volume = 0.3) {
  if (time - lastSound < 0.05) return;
  lastSound = time;
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
      // Alphabet als Farbverlauf durch den erlaubten Bereich 0.25..0.75
      letter: Array.from({ length: 26 }, (_, i) => getRgbSpreadHex(tc, 0.27 + (0.46 * i) / 25, 0.7, 1)),
      del: getRgbSpreadHex(tc, 0.35, 0.9, 1),
      clear: getRgbSpreadHex(tc, 0.5, 0.3, 0.8),
      bar: getRgbSpreadHex(tc, 0.5, 0.5, 0.35),
      word: getRgbSpreadHex(tc, 0.62, 0.8, 1),
      hud: getRgbSpreadHex(tc, 0.5, 0.35, 0.9),
    };
  }
  return palCache;
}

function letterColor(ch) {
  const P = pal();
  if (ch === DELETE) return P.del;
  const i = ch.charCodeAt(0) - 65;
  return i >= 0 && i < 26 ? P.letter[i] : P.hud;
}

const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

// ---------- Buchstaben ----------

function createLetter(ch, x, y, vx = 0, vy = 0) {
  if (letters.length >= SETTINGS.maxLetters && !makeRoom()) {
    addFloat('voll!', x, y, pal().del);
    return null;
  }
  const A = SETTINGS.area;
  const l = { ch, x, y, vx, vy, glued: false, keyHeld: false, born: time };
  l.handle = guiDragHandle({
    posX: x,
    posY: y,
    radius: SETTINGS.radius,
    grabSpeed: 140,
    speedDown: 80,
    fullPercent: 20,
    catchFactor: 1.7,
    followSmoothing: 12,
    dropDelay: 0.4,
    bounds: { x: A.x, y: A.y, width: A.width, height: A.height },
    visible: false,
    onGrab: () => {
      l.glued = false;
      play(soundClick, 0.2);
    },
    onDrop: () => {
      l.keyHeld = false;
      if (keyLetter === l) keyLetter = null;
      tryGlue(l);
    },
  });
  letters.push(l);
  burst(x, y, letterColor(ch), 12);
  play(soundPlop, 0.25);
  return l;
}

/** ältesten FREIEN Buchstaben verpuffen lassen, um Platz zu schaffen */
function makeRoom() {
  const free = letters.filter((l) => !l.glued && !l.handle.isGrabbed() && !l.keyHeld);
  if (!free.length) return false;
  free.sort((a, b) => a.born - b.born);
  removeLetter(free[0]);
  return true;
}

function removeLetter(l) {
  if (keyLetter === l) keyLetter = null;
  letters = letters.filter((q) => q !== l);
  burst(l.x, l.y, letterColor(l.ch), 20);
}

/** Magnet-Zeile: neben einem liegenden Buchstaben einrasten (links oder rechts), wenn der Platz frei ist */
function tryGlue(l) {
  if (l.ch === DELETE) return;
  const r = SETTINGS.radius;
  let best = null;
  let bestD = Infinity;
  letters.forEach((o) => {
    if (o === l || o.ch === DELETE || o.handle.isGrabbed() || o.keyHeld) return;
    const dx = Math.abs(l.x - o.x);
    const dy = Math.abs(l.y - o.y);
    if (dy > r * SETTINGS.glueDy || dx < r * SETTINGS.glueDx[0] || dx > r * SETTINGS.glueDx[1]) return;
    const d = Math.hypot(dx, dy);
    if (d < bestD) {
      bestD = d;
      best = o;
    }
  });
  if (!best) return;
  const tx = best.x + Math.sign(l.x - best.x || 1) * SETTINGS.spacing;
  const ty = best.y;
  const A = SETTINGS.area;
  if (tx < A.x + r || tx > A.x + A.width - r) return;
  const occupied = letters.some((o) => o !== l && Math.hypot(o.x - tx, o.y - ty) < r * 1.2);
  if (occupied) return;
  l.x = tx;
  l.y = ty;
  l.vx = 0;
  l.vy = 0;
  l.glued = true;
  best.glued = true;
  best.vx = 0;
  best.vy = 0;
  l.handle.setX(tx);
  l.handle.setY(ty);
  burst(tx, ty, pal().word, 8);
  play(soundClick, 0.3);
}

const isStatic = (l) => l.glued || l.handle.isGrabbed() || l.keyHeld;

function updatePhysics(dt) {
  const A = SETTINGS.area;
  const r = SETTINGS.radius;
  const damp = Math.exp(-SETTINGS.friction * dt);
  letters.forEach((l) => {
    if (isStatic(l)) return;
    l.x += l.vx * dt;
    l.y += l.vy * dt;
    l.vx *= damp;
    l.vy *= damp;
    if (l.x < A.x + r) (l.x = A.x + r), (l.vx = Math.abs(l.vx) * SETTINGS.restitution);
    if (l.x > A.x + A.width - r) (l.x = A.x + A.width - r), (l.vx = -Math.abs(l.vx) * SETTINGS.restitution);
    if (l.y < A.y + r) (l.y = A.y + r), (l.vy = Math.abs(l.vy) * SETTINGS.restitution);
    if (l.y > A.y + A.height - r) (l.y = A.y + A.height - r), (l.vy = -Math.abs(l.vy) * SETTINGS.restitution);
  });
  // Paare: ⌫ löscht, sonst abprallen (n ≤ 60 → n² ist günstig)
  const list = letters.slice();
  for (let i = 0; i < list.length; i++) {
    for (let j = i + 1; j < list.length; j++) {
      const a = list[i];
      const b = list[j];
      if (!letters.includes(a) || !letters.includes(b)) continue;
      const dx = b.x - a.x;
      const dy = b.y - a.y;
      const d = Math.hypot(dx, dy) || 0.001;
      if ((a.ch === DELETE) !== (b.ch === DELETE) && d < r * SETTINGS.deleteReach) {
        const victim = a.ch === DELETE ? b : a;
        addFloat(`${victim.ch} weg`, victim.x, victim.y - 60, pal().del);
        removeLetter(a);
        removeLetter(b);
        play(soundDelete, 0.3);
        continue;
      }
      if (d >= 2 * r) continue;
      const nx = dx / d;
      const ny = dy / d;
      const overlap = 2 * r - d;
      const sa = isStatic(a);
      const sb = isStatic(b);
      if (sa && sb) continue;
      // auseinanderschieben
      const pa = sa ? 0 : sb ? 1 : 0.5;
      const pb = sb ? 0 : sa ? 1 : 0.5;
      a.x -= nx * overlap * pa;
      a.y -= ny * overlap * pa;
      b.x += nx * overlap * pb;
      b.y += ny * overlap * pb;
      // Impuls entlang der Normalen
      const rel = (b.vx - a.vx) * nx + (b.vy - a.vy) * ny;
      if (rel >= 0) continue;
      const imp = -(1 + SETTINGS.restitution) * rel;
      if (!sa && !sb) {
        a.vx -= (imp / 2) * nx;
        a.vy -= (imp / 2) * ny;
        b.vx += (imp / 2) * nx;
        b.vy += (imp / 2) * ny;
      } else if (sa) {
        b.vx += imp * nx;
        b.vy += imp * ny;
      } else {
        a.vx -= imp * nx;
        a.vy -= imp * ny;
      }
    }
  }
}

/** Wörter = Ketten geklebter Buchstaben auf gleicher Höhe im Abstand spacing */
function findWords() {
  const glued = letters.filter((l) => l.glued);
  const rightOf = new Map();
  const hasLeft = new Set();
  glued.forEach((a) => {
    glued.forEach((b) => {
      if (a !== b && Math.abs(b.y - a.y) < 3 && Math.abs(b.x - a.x - SETTINGS.spacing) < 3) {
        rightOf.set(a, b);
        hasLeft.add(b);
      }
    });
  });
  const words = [];
  glued.forEach((start) => {
    if (hasLeft.has(start)) return;
    const chain = [start];
    for (let cur = rightOf.get(start); cur && chain.length < 40; cur = rightOf.get(cur)) chain.push(cur);
    if (chain.length >= 2) words.push(chain);
  });
  return words;
}

// ---------- Effekte ----------

function burst(x, y, color, n) {
  for (let i = 0; i < n && particles.length < SETTINGS.maxParticles; i++) {
    const a = Math.random() * Math.PI * 2;
    const v = 40 + Math.random() * 220;
    const life = 0.5 + Math.random() * 0.8;
    particles.push({ x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v, life, max: life, color, size: 2 + Math.random() * 5 });
  }
}

function addFloat(text, x, y, color) {
  if (floatTexts.length > 12) return;
  floatTexts.push({ text, x, y, life: 1.6, color });
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
    f.y -= 35 * dt;
    ctx.save();
    ctx.globalAlpha = Math.min(1, f.life);
    util.renderText({ ctx, text: f.text, x: f.x, y: f.y, fontSize: '40px', fillStyle: f.color });
    ctx.restore();
  });
}

// ---------- Zeichnen ----------

function renderFractal() {
  const w = 320;
  const h = 180;
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const g = canvas.getContext('2d');
  const img = g.createImageData(w, h);
  const maxIter = 36;
  const lut = Array.from({ length: maxIter + 1 }, (_, i) => getRgbSpread(laserConfig.testColor, 0.35 + (0.3 * i) / maxIter, 0.6, 0.02 + 0.25 * (i / maxIter)));
  // Julia-Menge c = -0.4 + 0.6i – weiche Wolken für die Lavalampen-Stimmung
  for (let py = 0; py < h; py++) {
    for (let px = 0; px < w; px++) {
      let zr = ((px / w) * 2 - 1) * 1.8;
      let zi = ((py / h) * 2 - 1) * 1.0;
      let i = 0;
      while (i < maxIter && zr * zr + zi * zi < 4) {
        const t = zr * zr - zi * zi - 0.4;
        zi = 2 * zr * zi + 0.6;
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
  const zoom = 1.15 + Math.sin(time * 0.05) * 0.08;
  ctx.save();
  ctx.globalAlpha = 0.45;
  ctx.translate(W / 2, H / 2);
  ctx.rotate(Math.sin(time * 0.02) * 0.08);
  ctx.drawImage(fractalCanvas, (-W * zoom) / 2, (-H * zoom) / 2, W * zoom, H * zoom);
  ctx.restore();
}

function drawLetter(ctx, l) {
  const color = letterColor(l.ch);
  const grabbed = l.handle.isGrabbed() || l.keyHeld;
  const fill = grabbed ? 0 : l.handle.getValue();
  const pop = Math.max(0, 1 - (time - l.born) * 4); // kurzes Aufploppen beim Erscheinen
  const wobble = fill > 0 ? Math.sin(time * 35) * (fill / 100) * 4 : 0;
  ctx.save();
  ctx.translate(l.x + wobble, l.y);
  ctx.scale(1 + pop * 0.4, 1 + pop * 0.4);
  if (grabbed) {
    ctx.shadowColor = color;
    ctx.shadowBlur = 25;
  }
  ctx.font = `bold ${l.ch === DELETE ? 70 : SETTINGS.fontSize}px Arvo`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.globalAlpha = l.glued ? 0.55 : 0.2;
  ctx.fillStyle = color;
  ctx.fillText(l.ch, 0, 4);
  ctx.globalAlpha = 1;
  ctx.strokeStyle = color;
  ctx.lineWidth = 3;
  ctx.strokeText(l.ch, 0, 4);
  ctx.restore();
  if (fill > 0) {
    ctx.save();
    ctx.strokeStyle = color;
    ctx.lineWidth = 6;
    ctx.beginPath();
    ctx.arc(l.x, l.y, SETTINGS.radius + 6, -Math.PI / 2, -Math.PI / 2 + (Math.PI * 2 * fill) / 100);
    ctx.stroke();
    ctx.restore();
  }
}

function drawWords(ctx, words) {
  const P = pal();
  ctx.save();
  ctx.strokeStyle = P.word;
  ctx.lineCap = 'round';
  words.forEach((chain) => {
    const first = chain[0];
    const last = chain[chain.length - 1];
    const y = first.y + SETTINGS.radius + 4;
    ctx.globalAlpha = 0.5 + 0.25 * Math.sin(time * 2 + first.x * 0.01);
    ctx.lineWidth = 4;
    ctx.shadowColor = P.word;
    ctx.shadowBlur = 12;
    ctx.beginPath();
    ctx.moveTo(first.x - 35, y);
    ctx.lineTo(last.x + 35, y);
    ctx.stroke();
  });
  ctx.restore();
}

function drawBars(ctx) {
  ctx.save();
  ctx.globalAlpha = barAlpha;
  ctx.fillStyle = 'rgba(0,0,0,0.85)';
  SETTINGS.barY.forEach((y) => ctx.fillRect(0, y - SETTINGS.barHeight / 2, W, SETTINGS.barHeight));
  ctx.restore();
}

function drawCursor(ctx) {
  if (!cursor.visible) return;
  ctx.save();
  ctx.strokeStyle = pal().hud;
  ctx.lineWidth = 2;
  ctx.setLineDash([6, 6]);
  ctx.beginPath();
  ctx.arc(cursor.x, cursor.y, SETTINGS.radius + 14, 0, Math.PI * 2);
  ctx.stroke();
  ctx.restore();
}

// ---------- Leisten ----------

function createSpawners() {
  const P = pal();
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('').concat([DELETE, CLEAR]);
  const step = W / SETTINGS.slotsPerBar;
  spawners = chars.map((ch, k) => {
    const bar = Math.floor(k / SETTINGS.slotsPerBar);
    const x = step * (k % SETTINGS.slotsPerBar) + step / 2;
    const y = SETTINGS.barY[bar];
    const color = ch === CLEAR ? P.clear : letterColor(ch);
    const s = guiPixelFillButton({
      label: '',
      posX: x,
      posY: y,
      radius: SETTINGS.slotRadius,
      edges: 4,
      angle: Math.PI / 4,
      speedUp: ch === CLEAR ? 25 : 110, // NEU bewusst langsam
      speedDown: 60,
      fullPercent: 20,
      counterReset: true,
      lineWidth: 3,
      normalColor: P.bar,
      growColor: color,
      activeColor: color,
      onEnterActive: () => (ch === CLEAR ? clearAll() : spawnFromBar(ch, x, bar)),
    });
    s.ch = ch;
    return s;
  });
}

function spawnFromBar(ch, x, bar) {
  const dir = bar === 0 ? 1 : -1;
  const y = bar === 0 ? SETTINGS.area.y + SETTINGS.radius + 5 : SETTINGS.area.y + SETTINGS.area.height - SETTINGS.radius - 5;
  createLetter(ch, x, y, (Math.random() - 0.5) * 120, dir * SETTINGS.spawnSpeed);
}

function clearAll() {
  letters.slice().forEach((l, i) => setTimeout(() => letters.includes(l) && removeLetter(l), i * 25));
  knownWords = new Set();
  play(soundClear, 0.4);
  addFloat('alles neu!', W / 2, H / 2, pal().hud);
}

function drawSpawnerLetters(ctx) {
  ctx.save();
  spawners.forEach((s) => {
    const fill = s.getValue() / 100;
    // Leisten sind Aktionsbereich: Buchstaben gedimmt, erst beim Füllen heller
    ctx.globalAlpha = barAlpha * (0.45 + 0.55 * fill);
    const color = s.ch === CLEAR ? pal().clear : letterColor(s.ch);
    util.renderText({
      ctx,
      text: s.ch,
      x: s.getX(),
      y: s.getY() + (s.ch === CLEAR ? 12 : 20),
      fontSize: s.ch === CLEAR ? '36px' : `${54 + fill * 16}px`,
      fillStyle: color,
    });
  });
  ctx.restore();
}

// ---------- Tastatur ----------

function handleKeyboard(dt) {
  let mx = 0;
  let my = 0;
  if (isKeyDown('ArrowLeft')) mx -= 1;
  if (isKeyDown('ArrowRight')) mx += 1;
  if (isKeyDown('ArrowUp')) my -= 1;
  if (isKeyDown('ArrowDown')) my += 1;
  if (mx || my) {
    cursor.visible = true;
    const A = SETTINGS.area;
    cursor.x = clamp(cursor.x + mx * SETTINGS.cursorSpeed * dt, A.x + SETTINGS.radius, A.x + A.width - SETTINGS.radius);
    cursor.y = clamp(cursor.y + my * SETTINGS.cursorSpeed * dt, A.y + SETTINGS.radius, A.y + A.height - SETTINGS.radius);
  }
  if (keyEdge('Space')) {
    cursor.visible = true;
    createLetter(String.fromCharCode(65 + Math.floor(Math.random() * 26)), cursor.x, cursor.y);
  }
  if (keyEdge('Backspace')) {
    cursor.visible = true;
    createLetter(DELETE, cursor.x, cursor.y);
  }
  if (keyEdge('Enter')) {
    cursor.visible = true;
    if (keyLetter) {
      keyLetter.handle.drop();
    } else {
      const near = letters
        .filter((l) => Math.hypot(l.x - cursor.x, l.y - cursor.y) < SETTINGS.radius * 1.5)
        .sort((a, b) => Math.hypot(a.x - cursor.x, a.y - cursor.y) - Math.hypot(b.x - cursor.x, b.y - cursor.y))[0];
      if (near) {
        keyLetter = near;
        near.keyHeld = true;
        near.handle.grab();
      }
    }
  }
  if (mx || my) idleTime = 0;
}

// ---------- Ablauf ----------

function resetAll() {
  letters = [];
  particles = [];
  floatTexts = [];
  knownWords = new Set();
  idleTime = 0;
  barAlpha = 1;
  keyLetter = null;
  cursor = { x: W / 2, y: H / 2, visible: false };
  createSpawners();
}

export default {
  name: 'Alphabet',
  description: `Alphabet – Kühlschrankpoesie mit Lasern. Kein Ziel, kein Stress.
Oben und unten liegen alle Buchstaben: Laser draufhalten, bis das Feld voll ist – der Buchstabe springt heraus.
Buchstaben anleuchten bis der Ring voll ist, dann ziehen und loslassen.
Neben einem anderen Buchstaben abgelegt, rastet er ein und klebt – so entstehen Wörter.
Das ⌫ frisst den ersten Buchstaben, den es berührt. NEU räumt alles ab.
Ohne Laser blenden die Leisten aus – euer Spruch steht dann als Titel da.`,
  image: 'media/img/gametitles/all_comic.png',
  init() {
    resetAll();
  },
  handle(grid, elapsed) {
    const dt = Math.min(elapsed, 0.1);
    const ctx = MasterCanvas.get2dContext();
    time += dt;
    if (!spawners.length) createSpawners();

    // Aktivität messen → Präsentationsmodus
    const active =
      spawners.some((s) => s.getValue() > 0) || letters.some((l) => l.handle.getValue() > 0 || l.handle.isGrabbed() || l.keyHeld);
    idleTime = active ? 0 : idleTime + dt;
    const targetAlpha = idleTime > SETTINGS.idleToPresent ? 0 : 1;
    barAlpha += (targetAlpha - barAlpha) * Math.min(1, dt * (targetAlpha ? 6 : 1.2));

    handleKeyboard(dt);

    drawBackground(ctx);
    drawBars(ctx);
    // Leisten: auch ausgeblendet aktiv, damit ein Laser sie zurückholt
    ctx.save();
    ctx.globalAlpha = barAlpha;
    spawners.forEach((s) => s.handle(grid, dt));
    ctx.restore();
    drawSpawnerLetters(ctx);

    letters.slice().forEach((l) => {
      if (!letters.includes(l)) return;
      if (l.keyHeld) {
        l.x += (cursor.x - l.x) * Math.min(1, dt * 12);
        l.y += (cursor.y - l.y) * Math.min(1, dt * 12);
        l.handle.setX(l.x);
        l.handle.setY(l.y);
        return;
      }
      if (!l.handle.isGrabbed()) {
        l.handle.setX(l.x);
        l.handle.setY(l.y);
      }
      const ox = l.x;
      const oy = l.y;
      l.handle.handle(grid, dt);
      if (l.handle.isGrabbed()) {
        l.x = l.handle.getX();
        l.y = l.handle.getY();
        // Wurfgeschwindigkeit merken, damit losgelassene Buchstaben weitergleiten
        l.vx = (l.x - ox) / Math.max(dt, 0.001);
        l.vy = (l.y - oy) / Math.max(dt, 0.001);
      }
    });
    updatePhysics(dt);

    const words = findWords();
    words.forEach((chain) => {
      const text = chain.map((l) => l.ch).join('');
      if (text.length >= 3 && !knownWords.has(text)) {
        knownWords.add(text);
        addFloat(`✦ ${text} ✦`, (chain[0].x + chain[chain.length - 1].x) / 2, chain[0].y - 80, pal().word);
        chain.forEach((l) => burst(l.x, l.y, pal().word, 4));
        play(soundWord, 0.25);
      }
    });

    drawWords(ctx, words);
    letters.forEach((l) => drawLetter(ctx, l));
    drawCursor(ctx);
    drawEffects(ctx, dt);
    if (barAlpha < 0.05 && letters.length === 0) {
      util.renderText({ ctx, text: 'Laser auf den Rand – dann geht es los', x: W / 2, y: H / 2, fontSize: '44px', fillStyle: pal().hud });
    }
  },
  stop() {
    keyLetter = null;
  },
};
