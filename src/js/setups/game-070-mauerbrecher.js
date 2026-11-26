/**
 * Mauerbrecher – mit Laser-Tempo Kanonenkugeln gegen eine Steinmauer (Spielidee: Georg, Komponente: laser-chris)
 *
 * Regeln:
 * - Links liegen 5 dunkle ABSCHUSSRAMPEN übereinander (gui/speedRail). Alle Laser einer Rampe zählen ZUSAMMEN
 *   (Teamkugel = Schwerpunkt): In der Startspalte (Pfeile) beginnen und gemeinsam nach rechts durchziehen.
 *   Die Kugel läuft mit, ihre Farbe zeigt live das Tempo: zu langsam / knapp / reicht für den Stein auf dieser Höhe.
 * - Rückwärts, Springen, Verstreuen oder Abreißen bricht den Lauf ab – wildes Herumleuchten bringt nichts.
 * - Am Ende der Rampe wird die Kugel zur KANONENKUGEL: Sie fliegt mit dem gemessenen Tempo nach rechts,
 *   leicht nach oben, und fällt mit SCHWERKRAFT im Bogen – langsame Kugeln sacken ab.
 * - Rechts steht die MAUER (Arkanoid-Gitter). Jeder Stein hat eine HÄRTE = Mindesttempo (Farbe + Punkte im Stein).
 *   Schnell genug → Stein zerbricht, die Kugel verliert Tempo und kann weitere Steine durchschlagen.
 *   Etwas zu langsam (≥ 60 %) → Riss (drei Risse = Bruch), Kugel prallt ab. Viel zu langsam → nur Abprallen.
 *   Stahlsteine (ab Level 4) sind unzerstörbar.
 * - DURCHBRUCH: Ist eine ganze Steinreihe frei, ist die Mauer durchbrochen → nächstes Level.
 * - Zeitlimit pro Mauer. Läuft es ab → Game-Over.
 * - TOPSPEED: Der schnellste Lauf der Partie steht groß oben, darunter der Allzeit-Rekord (Rekordjagd).
 *
 * Level: 1: 3 Spalten weich · 2: 4 Spalten, Härte 3 · 3: Mauer schwankt auf und ab · 4: 6 Spalten, Härte 4,
 * Stahlsteine · danach schwankt sie weiter und schneller.
 *
 * Highscore (util/highscore.js, Sortierfeld 'topspeed' in km/h): High = schnellster Lauf, Low = lahmster Topspeed.
 *
 * Tastatur (ohne Laser): Leertaste = Start/Nochmal, 1–5 = simulierter Lauf auf Rampe 1–5 (zufälliges Tempo).
 *
 * Vorbilder: Track & Field / Hyper Sports (Arcade 1983, C64: Anlauf-Tempo), 10th Frame (C64 1986, Kegeln),
 * Breakout (1976), Arkanoid (Amiga/C64 1987). Im Repo ähnlich: game-045-bollwerk (Kugeln gegen Ziel),
 * gui/swipeDetector (Schwerpunkt-Gesten) – neu ist das Messen des Lauf-TEMPOS über Spalten (gui/speedRail).
 *
 * Erstellt mit Claude Opus 5.5 (claude-opus-5-5) über die Skills laser-chris → new-laser-game.
 * Prompt (Kern): "Mauer durchbrechen – die Geschwindigkeit des Laserpointers von links nach rechts wird erfasst
 * durch Spalten. Nur Laserpunkte einer bestimmten Geschwindigkeit können die Mauer kaputt machen." + "die Messung
 * der Geschwindigkeiten sollten wir mit einer GUI-Komponente machen, die zu einer Kanonenkugel wird" + "Teamkugel
 * auf den Reihen, Abbruch bei Rückwärts/Wildleuchten, Live-Tempo-Ampel, rechts ein Arkanoid-Steingitter, das sich
 * auflöst, Kugeln mit Schwerkraft, Topspeed-Anzeige für die Rekordjagd".
 */
import util, { getRgbSpreadHex } from '../util.js';
import { createKeyEdge } from './gui/gridScan.js';
import soundPlop from '../../../public/media/369952__mischy__plop-1.wav';
import soundExplosion from '../../../public/media/414346__bykgames__explosion-far.wav';
import soundStomp from '../../../public/media/517267__foolboymedia__cinematic-stomp.wav';
import soundLaunch from '../../../public/media/opengameart/Menu Confirm.ogg';
import soundBounce from '../../../public/media/opengameart/Menu Error.ogg';
import soundAbort from '../../../public/media/opengameart/Decline.wav';
import soundLevelUp from '../../../public/media/opengameart/Level Up.ogg';
import soundGameOver from '../../../public/media/opengameart/Music Box Game Over III.wav';
import soundRecord from '../../../public/media/opengameart/Ability Learn.ogg';
var laserConfig = require('../LaserApiConfig.js').default;
var MasterCanvas = require('../MasterCanvas').default;
var guiFillButton = require('./gui/fillButton').default;
var guiSpeedRail = require('./gui/speedRail').default;
var createHighscore = require('../util/highscore').default;

const W = 1920;
const H = 1080;

// Spielwerte
const SETTINGS = {
  rails: 5,
  railX: 460, // Mitte der Rampen
  railWidth: 840, // 7 Spalten à 120 px
  railColumns: 7,
  railHeight: 150,
  railTop: 140,
  railGap: 30,
  wallX: 1300,
  wallTop: 170,
  brickW: 96,
  brickH: 56,
  brickGap: 4,
  wallRows: 14,
  ballRadius: 20,
  launchLift: 0.18, // Anteil des Tempos nach oben
  gravity: 1400, // px/s²
  hardSpeed: [0, 500, 800, 1100, 1400], // Mindesttempo je Härte (px/s)
  crackFactor: 0.6, // ab diesem Anteil des Mindesttempos gibt es Risse
  crackPerHit: 0.34,
  energyLoss: 0.55, // Tempoverlust beim Durchschlagen = Mindesttempo × Faktor
  minBallSpeed: 200,
  kmhFactor: 0.12, // px/s → "km/h" (1400 px/s = 168 km/h)
  maxParticles: 400,
  levelUpTime: 2.5,
  stars: 140,
};

// Steigerung pro Level
const DIFFICULTY = {
  startColumns: 3,
  maxColumns: 6,
  levelTime: 100, // s pro Mauer
  moveFromLevel: 3,
  moveAmplitude: 60, // px, +moveAmplitudePerLevel pro weiterem Level
  moveAmplitudePerLevel: 20,
  maxMoveAmplitude: 150,
  moveSpeed: 0.6, // rad/s, +moveSpeedPerLevel
  moveSpeedPerLevel: 0.1,
  steelFromLevel: 4,
  steelRowChance: 0.3,
};

// Zustand (so vorbelegt, dass handle() auch ohne init() läuft)
let gameState = 'start'; // 'start' | 'play' | 'levelup' | 'gameover'
let level = 1;
let wall = null; // { cols, bricks: [col][row], offsetY, amp, speed }
let balls = [];
let particles = [];
let floatTexts = [];
let rails = [];
let railInfo = []; // pro Rampe: letzter Abschuss-Text
let practiceRail = null;
let stars = [];
let stats = newStats();
let levelTimer = DIFFICULTY.levelTime;
let stateTimer = 0;
let time = 0;
let shake = 0;
let flash = 0;
let allTimeTop = 0; // px/s
let newHigh = false;
let newLow = false;
let startButton = null;
let againButton = null;
let palCache = null;
let palKey = '';
let lastPlop = 0;
const keyEdge = createKeyEdge();
const highscore = createHighscore('Mauerbrecher', 'topspeed');

function newStats() {
  return { topSpeed: 0, walls: 0, bricks: 0, shots: 0, okShots: 0, aborts: 0 };
}

// ---------- Hilfen ----------

function play(snd, volume = 0.5) {
  try {
    const a = new Audio(snd);
    a.volume = volume;
    a.play().catch(() => {});
  } catch (e) {}
}

const kmh = (pxs) => Math.round(pxs * SETTINGS.kmhFactor);

function pal() {
  const tc = laserConfig.testColor;
  const key = tc.join(',');
  if (key !== palKey) {
    palKey = key;
    palCache = {
      hard: [0, 1, 2, 3, 4].map((h) => getRgbSpreadHex(tc, 0.3 + (h - 1) * 0.13, 0.75, 0.9)),
      steel: getRgbSpreadHex(tc, 0.5, 0.1, 0.55),
      rail: getRgbSpreadHex(tc, 0.5, 0.5, 0.45),
      slow: getRgbSpreadHex(tc, 0.33, 0.9, 1),
      close: getRgbSpreadHex(tc, 0.5, 0.8, 1),
      ok: getRgbSpreadHex(tc, 0.68, 0.8, 1),
      hud: getRgbSpreadHex(tc, 0.5, 0.35, 0.95),
      star: getRgbSpreadHex(tc, 0.55, 0.3, 0.7),
      ball: getRgbSpreadHex(tc, 0.6, 0.5, 1),
      warn: getRgbSpreadHex(tc, 0.42, 0.9, 1),
    };
  }
  return palCache;
}

function railY(i) {
  return SETTINGS.railTop + i * (SETTINGS.railHeight + SETTINGS.railGap) + SETTINGS.railHeight / 2;
}

function brickRect(col, row) {
  const cw = SETTINGS.brickW + SETTINGS.brickGap;
  const ch = SETTINGS.brickH + SETTINGS.brickGap;
  return { x: SETTINGS.wallX + col * cw, y: SETTINGS.wallTop + row * ch + (wall ? wall.offsetY : 0), w: SETTINGS.brickW, h: SETTINGS.brickH };
}

/** Stein unter einem Punkt (O(1)) oder null */
function brickAt(px, py) {
  if (!wall) return null;
  const cw = SETTINGS.brickW + SETTINGS.brickGap;
  const ch = SETTINGS.brickH + SETTINGS.brickGap;
  const col = Math.floor((px - SETTINGS.wallX) / cw);
  const row = Math.floor((py - SETTINGS.wallTop - wall.offsetY) / ch);
  if (col < 0 || col >= wall.cols || row < 0 || row >= SETTINGS.wallRows) return null;
  const b = wall.bricks[col][row];
  return b.alive ? b : null;
}

// ---------- Mauer ----------

function buildWall(lvl) {
  const cols = Math.min(DIFFICULTY.maxColumns, DIFFICULTY.startColumns + lvl - 1);
  const maxHard = Math.min(4, 1 + Math.ceil(lvl / 1.5));
  const bricks = [];
  for (let c = 0; c < cols; c++) {
    bricks.push([]);
    for (let r = 0; r < SETTINGS.wallRows; r++) {
      // hinten härter als vorne, dazu Zufall
      const bias = (c / Math.max(1, cols - 1)) * 0.5;
      const hard = Math.max(1, Math.min(maxHard, 1 + Math.floor((Math.random() * 0.8 + bias) * maxHard)));
      bricks[c].push({ col: c, row: r, hard, damage: 0, alive: true, steel: false, wobble: 0 });
    }
  }
  if (lvl >= DIFFICULTY.steelFromLevel) {
    for (let r = 0; r < SETTINGS.wallRows; r++) {
      if (Math.random() < DIFFICULTY.steelRowChance) bricks[Math.floor(Math.random() * cols)][r].steel = true;
    }
  }
  const moving = lvl >= DIFFICULTY.moveFromLevel;
  const extra = lvl - DIFFICULTY.moveFromLevel;
  wall = {
    cols,
    bricks,
    offsetY: 0,
    phase: 0,
    amp: moving ? Math.min(DIFFICULTY.maxMoveAmplitude, DIFFICULTY.moveAmplitude + extra * DIFFICULTY.moveAmplitudePerLevel) : 0,
    speed: DIFFICULTY.moveSpeed + Math.max(0, extra) * DIFFICULTY.moveSpeedPerLevel,
  };
  levelTimer = DIFFICULTY.levelTime;
  balls = [];
}

/** Mindesttempo für den ersten Stein auf Höhe der Rampe (sonst der weichste Stein) */
function targetForLane(y) {
  if (!wall) return SETTINGS.hardSpeed[1];
  const ch = SETTINGS.brickH + SETTINGS.brickGap;
  const row = Math.floor((y - SETTINGS.wallTop - wall.offsetY) / ch);
  if (row >= 0 && row < SETTINGS.wallRows) {
    for (let c = 0; c < wall.cols; c++) {
      const b = wall.bricks[c][row];
      if (b.alive && !b.steel) return SETTINGS.hardSpeed[b.hard];
      if (b.alive && b.steel) break;
    }
  }
  let min = Infinity;
  wall.bricks.forEach((col) => col.forEach((b) => b.alive && !b.steel && (min = Math.min(min, SETTINGS.hardSpeed[b.hard]))));
  return min === Infinity ? SETTINGS.hardSpeed[1] : min;
}

function checkBreakthrough() {
  for (let r = 0; r < SETTINGS.wallRows; r++) {
    let free = true;
    for (let c = 0; c < wall.cols && free; c++) free = !wall.bricks[c][r].alive;
    if (free) return r;
  }
  return -1;
}

function destroyBrick(b) {
  b.alive = false;
  stats.bricks++;
  const rc = brickRect(b.col, b.row);
  burst(rc.x + rc.w / 2, rc.y + rc.h / 2, pal().hard[b.hard], 24);
  if (time - lastPlop > 0.05) {
    play(soundPlop, 0.35);
    lastPlop = time;
  }
  const row = checkBreakthrough();
  if (row >= 0 && gameState === 'play') {
    stats.walls++;
    gameState = 'levelup';
    stateTimer = 0;
    flash = 1;
    shake = 0.6;
    play(soundLevelUp, 0.6);
    // Lichtstrahl durch die freie Reihe
    const y = brickRect(0, row).y + SETTINGS.brickH / 2;
    for (let i = 0; i < 60; i++) burst(SETTINGS.wallX + Math.random() * wall.cols * 100, y, pal().ok, 1);
  }
}

// ---------- Kugeln ----------

function launchBall(speed, info, railIndex) {
  stats.shots++;
  if (info.rating === 'ok') stats.okShots++;
  balls.push({ x: info.x, y: info.y, vx: speed, vy: -speed * SETTINGS.launchLift, trail: [] });
  play(soundLaunch, 0.4);
  railInfo[railIndex] = { text: `${kmh(speed)} km/h`, rating: info.rating, timer: 2 };
  if (speed > stats.topSpeed) {
    stats.topSpeed = speed;
    if (speed > allTimeTop) {
      allTimeTop = speed;
      addFloat('NEUER REKORD!', SETTINGS.railX, railY(railIndex) - 60, pal().ok);
      play(soundRecord, 0.5);
    }
  }
  burst(info.x, info.y, pal().ball, 16);
}

function updateBalls(dt) {
  const P = pal();
  balls.slice().forEach((ball) => {
    ball.vy += SETTINGS.gravity * dt;
    const dist = Math.hypot(ball.vx, ball.vy) * dt;
    const steps = Math.max(1, Math.ceil(dist / 12));
    let dead = false;
    for (let s = 0; s < steps && !dead; s++) {
      ball.x += (ball.vx * dt) / steps;
      ball.y += (ball.vy * dt) / steps;
      if (ball.y < 125) {
        ball.y = 125;
        ball.vy = Math.abs(ball.vy) * 0.5;
      }
      const b = brickAt(ball.x, ball.y);
      if (!b) continue;
      const sp = Math.hypot(ball.vx, ball.vy);
      const req = SETTINGS.hardSpeed[b.hard];
      if (!b.steel && sp >= req) {
        destroyBrick(b);
        const newSp = sp - req * SETTINGS.energyLoss;
        if (newSp < SETTINGS.minBallSpeed) dead = true;
        else {
          ball.vx *= newSp / sp;
          ball.vy *= newSp / sp;
        }
        if (gameState !== 'play') dead = true;
      } else {
        if (!b.steel && sp >= req * SETTINGS.crackFactor) {
          b.damage += SETTINGS.crackPerHit;
          b.wobble = 0.3;
          if (b.damage >= 1) destroyBrick(b);
          else play(soundBounce, 0.25);
        } else {
          b.wobble = 0.2;
          play(soundBounce, 0.2);
          const rc = brickRect(b.col, b.row);
          addFloat(b.steel ? 'Stahl!' : 'zu langsam', rc.x + rc.w / 2, rc.y - 10, b.steel ? P.steel : P.slow);
        }
        ball.x -= (ball.vx * dt) / steps; // zurück aus dem Stein
        ball.vx = -Math.abs(ball.vx) * 0.35;
        burst(ball.x, ball.y, P.hud, 6);
      }
    }
    ball.trail.push({ x: ball.x, y: ball.y });
    if (ball.trail.length > 12) ball.trail.shift();
    if (dead || ball.y > H + 50 || ball.x > W + 50 || (ball.vx < 0 && ball.x < SETTINGS.railX + SETTINGS.railWidth / 2)) {
      balls.splice(balls.indexOf(ball), 1);
      if (dead) burst(ball.x, ball.y, P.ball, 20);
    }
  });
}

// ---------- Effekte ----------

function burst(x, y, color, n) {
  for (let i = 0; i < n && particles.length < SETTINGS.maxParticles; i++) {
    const a = Math.random() * Math.PI * 2;
    const v = 80 + Math.random() * 450;
    const life = 0.4 + Math.random() * 0.8;
    particles.push({ x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v, life, max: life, color, size: 3 + Math.random() * 6 });
  }
}

function addFloat(text, x, y, color) {
  if (floatTexts.length > 20) return;
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
    p.vy += 600 * dt;
    p.x += p.vx * dt;
    p.y += p.vy * dt;
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
    util.renderText({ ctx, text: f.text, x: f.x, y: f.y, fontSize: '36px', fillStyle: f.color });
    ctx.restore();
  });
}

// ---------- Zeichnen ----------

function drawBackground(ctx, dt) {
  const P = pal();
  if (!stars.length) {
    for (let i = 0; i < SETTINGS.stars; i++) stars.push({ x: Math.random() * W, y: Math.random() * H, z: 0.2 + Math.random() });
  }
  ctx.save();
  ctx.fillStyle = P.star;
  stars.forEach((s) => {
    s.x -= s.z * 120 * dt;
    if (s.x < 0) {
      s.x = W;
      s.y = Math.random() * H;
    }
    ctx.globalAlpha = 0.25 + 0.5 * s.z;
    ctx.fillRect(s.x, s.y, 2 + s.z * 10, 2); // Tempostreifen
  });
  ctx.restore();
}

function drawRailArea(ctx) {
  // Aktionsbereich abdunkeln: kein Fremdlicht unter den Rampen
  ctx.save();
  ctx.fillStyle = 'rgba(0,0,0,0.85)';
  ctx.fillRect(0, SETTINGS.railTop - 15, SETTINGS.railX + SETTINGS.railWidth / 2 + 25, H - SETTINGS.railTop + 15);
  ctx.restore();
}

function drawWall(ctx, dt) {
  const P = pal();
  if (!wall) return;
  wall.bricks.forEach((col) =>
    col.forEach((b) => {
      if (!b.alive) return;
      b.wobble = Math.max(0, b.wobble - dt);
      const rc = brickRect(b.col, b.row);
      const wob = b.wobble > 0 ? Math.sin(time * 60) * 4 * b.wobble * 3 : 0;
      const color = b.steel ? P.steel : P.hard[b.hard];
      ctx.save();
      ctx.translate(wob, 0);
      ctx.globalAlpha = 0.35;
      ctx.fillStyle = color;
      ctx.fillRect(rc.x, rc.y, rc.w, rc.h);
      ctx.globalAlpha = 1;
      ctx.strokeStyle = color;
      ctx.lineWidth = 3;
      ctx.strokeRect(rc.x + 1.5, rc.y + 1.5, rc.w - 3, rc.h - 3);
      if (b.steel) {
        ctx.beginPath();
        ctx.moveTo(rc.x + 10, rc.y + 10);
        ctx.lineTo(rc.x + rc.w - 10, rc.y + rc.h - 10);
        ctx.moveTo(rc.x + rc.w - 10, rc.y + 10);
        ctx.lineTo(rc.x + 10, rc.y + rc.h - 10);
        ctx.stroke();
      } else {
        // Härte als Punkte
        ctx.fillStyle = color;
        for (let i = 0; i < b.hard; i++) {
          ctx.beginPath();
          ctx.arc(rc.x + rc.w / 2 + (i - (b.hard - 1) / 2) * 16, rc.y + rc.h / 2, 5, 0, Math.PI * 2);
          ctx.fill();
        }
        // Risse
        if (b.damage > 0) {
          ctx.strokeStyle = P.hud;
          ctx.lineWidth = 2;
          ctx.beginPath();
          const cracks = Math.ceil(b.damage / SETTINGS.crackPerHit);
          for (let k = 0; k < cracks; k++) {
            const sx = rc.x + 15 + k * 28;
            ctx.moveTo(sx, rc.y + 4);
            ctx.lineTo(sx + 10, rc.y + rc.h / 2);
            ctx.lineTo(sx - 4, rc.y + rc.h - 4);
          }
          ctx.stroke();
        }
      }
      ctx.restore();
    })
  );
}

function drawBalls(ctx) {
  const P = pal();
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  balls.forEach((ball) => {
    ball.trail.forEach((t, i) => {
      ctx.globalAlpha = (i / ball.trail.length) * 0.4;
      ctx.fillStyle = P.ball;
      ctx.beginPath();
      ctx.arc(t.x, t.y, SETTINGS.ballRadius * (0.4 + (0.6 * i) / ball.trail.length), 0, Math.PI * 2);
      ctx.fill();
    });
    ctx.globalAlpha = 1;
    ctx.shadowColor = P.ball;
    ctx.shadowBlur = 25;
    ctx.fillStyle = P.ball;
    ctx.beginPath();
    ctx.arc(ball.x, ball.y, SETTINGS.ballRadius, 0, Math.PI * 2);
    ctx.fill();
    ctx.shadowBlur = 0;
  });
  ctx.restore();
}

function drawRailInfos(ctx, dt) {
  const P = pal();
  rails.forEach((rail, i) => {
    const info = railInfo[i];
    const x = SETTINGS.railX + SETTINGS.railWidth / 2 + 120;
    // Mindesttempo dieser Bahn
    util.renderText({
      ctx,
      text: `≥ ${kmh(rail.getTargetSpeed())}`,
      x,
      y: railY(i) + 50,
      fontSize: '26px',
      fillStyle: P.hud,
    });
    if (!info || info.timer <= 0) return;
    info.timer -= dt;
    ctx.save();
    ctx.globalAlpha = Math.min(1, info.timer);
    util.renderText({ ctx, text: info.text, x, y: railY(i) - 5, fontSize: '34px', fillStyle: P[info.rating] });
    ctx.restore();
  });
}

function drawHud(ctx) {
  const P = pal();
  util.renderText({ ctx, text: `Level ${level}`, x: 40, y: 75, fontSize: '50px', fillStyle: P.hud, align: 'left' });
  util.renderText({
    ctx,
    text: `TOPSPEED ${kmh(stats.topSpeed)} km/h`,
    x: W / 2 - 80,
    y: 70,
    fontSize: '60px',
    fillStyle: P.ok,
  });
  util.renderText({ ctx, text: `Rekord ${kmh(allTimeTop)} km/h`, x: W / 2 - 80, y: 110, fontSize: '30px', fillStyle: P.hud });
  util.renderText({
    ctx,
    text: `Zeit ${Math.ceil(levelTimer)}`,
    x: W - 40,
    y: 75,
    fontSize: '50px',
    fillStyle: levelTimer < 15 ? P.warn : P.hud,
    align: 'right',
  });
}

// ---------- Rampen ----------

function createRails() {
  const P = pal();
  const railOpts = {
    posX: SETTINGS.railX,
    width: SETTINGS.railWidth,
    height: SETTINGS.railHeight,
    columns: SETTINGS.railColumns,
    normalColor: P.rail,
    slowColor: P.slow,
    closeColor: P.close,
    okColor: P.ok,
  };
  rails = [];
  railInfo = [];
  for (let i = 0; i < SETTINGS.rails; i++) {
   const rail = guiSpeedRail(Object.assign({}, railOpts, {
      posY: railY(i),
      label: `${i + 1}`,
      keyCode: `Digit${i + 1}`,
      onRelease: (speed, info, r) => {
        launchBall(speed, info, i);
        randomKeySpeed(r);
      },
      onAbort: (reason, r) => {
        stats.aborts++;
        play(soundAbort, 0.25);
        randomKeySpeed(r);
      }
    }));
    randomKeySpeed(rail);
    rails.push(rail);
  }
  practiceRail = guiSpeedRail(Object.assign({}, railOpts, {
    posX: W / 2,
    posY: 640,
    width: 720,
    columns: 6,
    targetSpeed: SETTINGS.hardSpeed[2],
    label: 'Probe',
    keyCode: 'Digit1',
    onRelease: (speed, info, r) => {
      railInfo.practice = { text: `${kmh(speed)} km/h`, rating: info.rating, timer: 2.5 };
      burst(info.x, info.y, pal().ball, 20);
      play(soundLaunch, 0.4);
      randomKeySpeed(r);
    }
  }));
}

/** Tastatur-Testlauf: zufälliges Tempo rund um das Mindesttempo der Bahn */
function randomKeySpeed(rail) {
  rail.setKeySpeed(rail.getTargetSpeed() * (0.6 + Math.random() * 0.9));
}

// ---------- Spielablauf ----------

function createButtons() {
  const P = pal();
  const opts = { posX: W / 2, radius: 100, edges: 6, speedUp: 60, speedDown: 30, lineWidth: 5, normalColor: P.rail, growColor: P.close, activeColor: P.ok };
  startButton = guiFillButton(Object.assign({}, opts, { label: 'START', posY: 900, onEnterActive: () => startGame() }));
  againButton = guiFillButton(Object.assign({}, opts, { label: 'NOCHMAL', posY: 920, onEnterActive: () => startGame() }));
}

function startGame() {
  level = 1;
  stats = newStats();
  particles = [];
  floatTexts = [];
  createRails();
  buildWall(level);
  gameState = 'play';
  stateTimer = 0;
  play(soundStomp, 0.4);
}

function endGame() {
  gameState = 'gameover';
  stateTimer = 0;
  shake = 0.5;
  play(soundGameOver, 0.5);
  highscore.addEntry({
    topspeed: kmh(stats.topSpeed),
    mauern: stats.walls,
    steine: stats.bricks,
    level,
    schuesse: stats.shots,
  });
  newHigh = highscore.lastEntryNewHighscore();
  newLow = highscore.lastEntryNewLowscore();
  createButtons();
}

function handlePlay(grid, dt, ctx) {
  if (!wall) buildWall(level);
  if (!rails.length) createRails();
  levelTimer -= dt;
  if (levelTimer <= 0) {
    levelTimer = 0;
    endGame();
    return;
  }
  wall.phase += wall.speed * dt;
  wall.offsetY = Math.sin(wall.phase) * wall.amp;

  drawRailArea(ctx);
  rails.forEach((rail, i) => {
    rail.setTargetSpeed(targetForLane(railY(i)));
    rail.handle(grid, dt);
  });
  updateBalls(dt);
  drawWall(ctx, dt);
  drawBalls(ctx);
  drawRailInfos(ctx, dt);
  drawEffects(ctx, dt);
  drawHud(ctx);
}

function handleLevelUp(grid, dt, ctx) {
  const P = pal();
  stateTimer += dt;
  drawRailArea(ctx);
  drawWall(ctx, dt);
  drawEffects(ctx, dt);
  drawHud(ctx);
  ctx.save();
  ctx.globalAlpha = Math.min(1, stateTimer * 3);
  util.renderText({ ctx, text: 'DURCHBRUCH!', x: W / 2, y: 470, fontSize: '150px', fillStyle: P.ok });
  util.renderText({ ctx, text: `LEVEL ${level + 1}`, x: W / 2, y: 600, fontSize: '90px', fillStyle: P.hud });
  ctx.restore();
  if (stateTimer >= SETTINGS.levelUpTime) {
    level++;
    buildWall(level);
    rails.forEach((r) => r.reset());
    gameState = 'play';
    const news = level === DIFFICULTY.moveFromLevel ? 'Die Mauer schwankt!' : level === DIFFICULTY.steelFromLevel ? 'Stahlsteine!' : 'Härter, breiter!';
    addFloat(news, W / 2, 400, P.warn);
  }
}

function handleStart(grid, dt, ctx) {
  const P = pal();
  if (!startButton) createButtons();
  if (!practiceRail) createRails();
  util.renderText({ ctx, text: 'MAUERBRECHER', x: W / 2, y: 210, fontSize: '150px', fillStyle: P.hud });
  util.renderText({
    ctx,
    text: `Alle Laser einer Rampe zusammen: links bei den Pfeilen starten, gemeinsam nach rechts ziehen.\nJe schneller ihr seid, desto härter schlägt die Kanonenkugel in die Mauer ein.\nEine ganze Steinreihe frei = DURCHBRUCH. Probiert die Rampe hier unten aus!`,
    x: W / 2,
    y: 320,
    fontSize: '38px',
    lineHeight: 56,
    fillStyle: P.hud,
  });
  util.renderText({ ctx, text: `Rekord ${kmh(allTimeTop)} km/h`, x: W / 2, y: 520, fontSize: '44px', fillStyle: P.ok });
  ctx.save();
  ctx.fillStyle = 'rgba(0,0,0,0.85)';
  ctx.fillRect(W / 2 - 380, 640 - 90, 760, 180);
  ctx.restore();
  practiceRail.handle(grid, dt);
  const info = railInfo.practice;
  if (info && info.timer > 0) {
    info.timer -= dt;
    util.renderText({ ctx, text: info.text, x: W / 2, y: 780, fontSize: '50px', fillStyle: P[info.rating] });
  }
  highscore.renderHighAndLowScores(ctx);
  startButton.handle(grid, dt);
  util.renderText({ ctx, text: 'Leertaste = Start · Taste 1 = Probelauf', x: W / 2, y: 1050, fontSize: '30px', fillStyle: P.hud });
  drawEffects(ctx, dt);
  if (keyEdge('Space')) startGame();
}

function handleGameOver(grid, dt, ctx) {
  const P = pal();
  if (!againButton) createButtons();
  drawWall(ctx, dt);
  drawEffects(ctx, dt);
  util.renderText({ ctx, text: 'ZEIT UM!', x: W / 2, y: 200, fontSize: '150px', fillStyle: P.warn });
  const quote = stats.shots ? Math.round((stats.okShots / stats.shots) * 100) : 0;
  util.renderText({
    ctx,
    text: `Level ${level}   ·   Mauern durchbrochen ${stats.walls}\nSteine ${stats.bricks}   ·   Schüsse ${stats.shots} (${quote} % im Tempo)\nTOPSPEED ${kmh(stats.topSpeed)} km/h`,
    x: W / 2,
    y: 320,
    fontSize: '46px',
    lineHeight: 66,
    fillStyle: P.hud,
  });
  const record = newHigh
    ? 'NEUER HIGHSCORE – schneller als jeder Joystick-Rüttler am C64!'
    : newLow
    ? 'Neuer Lowscore – gemütlichster Lauf aller Zeiten.'
    : '';
  if (record) util.renderText({ ctx, text: record, x: W / 2, y: 560, fontSize: '42px', fillStyle: P.ok });
  highscore.renderHighAndLowScores(ctx);
  againButton.handle(grid, dt);
  if (keyEdge('Space')) startGame();
}

export default {
  name: 'Mauerbrecher',
  description: `Mauerbrecher – mit Tempo durch die Wand!
Links liegen 5 Abschussrampen. Alle Laser einer Rampe zählen ZUSAMMEN:
bei den Pfeilen starten und gemeinsam nach rechts durchziehen.
Je schneller, desto härter fliegt die Kanonenkugel – mit Schwerkraft im Bogen in die Mauer.
Jeder Stein braucht ein Mindesttempo (Punkte im Stein). Rückwärts oder wild herumleuchten bricht ab.
Eine ganze Steinreihe frei = DURCHBRUCH. Jagt den TOPSPEED-Rekord!`,
  image: 'media/img/gametitles/laser-defense-###9###.png',
  init() {
    gameState = 'start';
    level = 1;
    wall = null;
    balls = [];
    particles = [];
    floatTexts = [];
    stats = newStats();
    stateTimer = 0;
    shake = 0;
    flash = 0;
    newHigh = false;
    newLow = false;
    const best = highscore.getHighscore();
    allTimeTop = Math.max(allTimeTop, best ? best.topspeed / SETTINGS.kmhFactor : 0);
    createRails();
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
    drawBackground(ctx, dt);
    if (gameState === 'start') handleStart(grid, dt, ctx);
    else if (gameState === 'play') handlePlay(grid, dt, ctx);
    else if (gameState === 'levelup') handleLevelUp(grid, dt, ctx);
    else handleGameOver(grid, dt, ctx);
    if (flash > 0) {
      flash = Math.max(0, flash - dt * 2);
      ctx.fillStyle = pal().ok;
      ctx.globalAlpha = flash * 0.3;
      ctx.fillRect(0, 0, W, H);
      ctx.globalAlpha = 1;
    }
    ctx.restore();
  },
  stop() {
    balls = [];
  },
};
