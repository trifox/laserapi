/**
 * Labyrinth – Kugeln durch den Irrgarten lotsen (Spielidee: Georg)
 *
 * Aufbau:
 * - Links liegt eine runde START-ARENA. Dort entstehen die Kugeln. Die Arena hat rechts eine enge Öffnung
 *   (Flaschenhals), die in den Eingang des Labyrinths führt.
 * - Der Rest des Bildschirms ist das Labyrinth mit Abzweigungen und Sackgassen. Am rechten Rand liegt das ZIEL.
 *
 * Regeln:
 * - STEUERN: Ein Laserpunkt IN einer Kugel zieht sie zu sich hin (Tempo ∝ Abstand zur Kugelmitte, gedeckelt).
 *   Man "schiebt" die Kugel also, indem man den Punkt immer ein Stück vor ihre Mitte hält.
 *   Verlässt der Punkt die Kugel, bleibt sie stehen.
 * - Kugel ohne Laser: bremst schnell ab und bleibt stehen – sie platzt NICHT.
 * - Zwei oder mehr Laser in einer Kugel: sie blockieren sich – die Kugel bleibt stehen.
 * - Berührt eine Kugel eine Wand (Labyrinth, Arena-Rand, Flaschenhals), ZERPLATZT sie und entsteht nach
 *   kurzer Zeit neu in der Arena.
 * - Treffen sich zwei Kugeln, prallen sie voneinander ab (elastischer Stoss) – Vorsicht, das kann eine Kugel
 *   in die Wand stossen!
 * - Erreicht EINE Kugel das Ziel, ist das Level geschafft. Gemeinsames Ziel, kein Game Over.
 * - Level: Level 1 ist ein einfaches Labyrinth (Abzweigungen, eine Sackgasse, breite Gänge). Mit jedem Level
 *   wird das Raster feiner (mehr Gänge, schmaler – aber immer mind. ~2,9 Kugelradien breit), es bleiben mehr
 *   Sackgassen stehen, und es gibt mehr Kugeln. Ab Level 6 sind es "perfekte" Irrgärten ohne Abkürzungen.
 *   Nach Level 8: Schluss-Bildschirm mit Statistik, dann Neustart.
 *
 * Laser-Erkennung: Ein blobTracker über den ganzen Bildschirm findet die einzelnen Laserflecken.
 * Pro Kugel zählt, wie viele Flecken im Fangkreis (Radius * catchFactor) liegen.
 * Hinweis: Zwei Laserpunkte, die sich (im groben Kamera-Grid) berühren, verschmelzen zu EINEM Fleck – dann
 * zählt das als ein Laser, und die Kugel fährt zum gemeinsamen Schwerpunkt. Erst deutlich getrennte Punkte
 * blockieren die Kugel.
 *
 * Tastatur (Test ohne Laser):
 * - Leertaste: Start / Level-Übergang überspringen / Neustart
 * - Pfeiltasten: virtueller Laser in der ausgewählten Kugel, schiebt sie in Pfeilrichtung
 * - B: nächste Kugel auswählen
 * - X (halten): zwei virtuelle Laser in der ausgewählten Kugel (Blockade testen)
 * - N: Level sofort geschafft
 *   (d v g r m h t f F s, PageUp/PageDown/Home sind Debug-Tasten in view.js und hier bewusst frei)
 *
 * Spielbarkeit (Überarbeitung):
 * - STOSS-SCHONUNG: Eine Kugel, die gerade von einer anderen Kugel gestossen wurde (bumpGrace, 0,6 s),
 *   platzt an der Wand NICHT, sondern prallt gedämpft ab. Wer fremde Kugeln anrempelt, schadet also nicht
 *   sofort – nur selbst gesteuert an die Wand fahren lässt sie platzen. Nach einem Stoss bremst sie stärker.
 * - Etwas langsamer (maxSpeed 380) und weicher (steerGain 6), größerer Fangkreis (1,4 × Radius) –
 *   bei 20–60 Leuten im Saal wackeln die Punkte, das verzeiht mehr.
 * - Mehr Kugeln (5 → 8) und schnellerer Respawn (1 s), damit mehr Leute gleichzeitig etwas zu tun haben.
 *
 * Licht-Disziplin: Gänge, Arena und Kugel-Inneres sind die Aktionsflächen der Laser → schwarz. Wände nur als
 * schmale Kontur mit wenig Glühen (kein Licht, das in die Gänge blutet), Kugeln dunkel mit hellem Rand,
 * Ziel nur als Umriss. Farben nur aus der Laserfarbe, Hue 0.25..0.75.
 *
 * Highscore: Punkte = 1000 pro Level + Zeitbonus (max. 2400, −2 pro Sekunde) − 20 pro geplatzter Kugel.
 * Eingetragen nach Level 8. Ohne Highscore wär's wie ein C64-Modul ohne Bestenliste – undenkbar, 1984 hätte
 * man dafür die Joystick-Kabel gekreuzt.
 *
 * Klassiker: Marble Madness (Atari, 1984 / Amiga 1986) – Murmel durch ein Labyrinth lotsen, Abgründe =
 * platzen; und das hölzerne Labyrinth-Kippspiel (BRIO, seit 1946), bei dem die Kugel in Löcher fällt.
 * Anders hier: keine Neigung, sondern direktes Ziehen per Laserpunkt, viele Kugeln gleichzeitig, und zwei
 * Laser blockieren sich (Gedränge statt Kippen).
 * Ähnlichkeiten im Bestand: Objekte per Laser lotsen wie game-017-thehorde / game-024-schaeferei (Herde
 * treiben), Kugelstösse wie game-003-pong.
 *
 * One-Pixel-Netzwerk: Ein Netz-Spieler = ein Pixel = ein "Blob". Er steuert eine Kugel, indem er seinen
 * Pixel hineinsetzt; zwei Pixel in derselben Kugel blockieren sie – genau wie bei Lasern. Bei sehr vielen
 * Spielern bräuchte es serverseitig mehr/größere Kugeln oder mehrere Labyrinthe (Shards), weil jede Kugel
 * nur genau EINEN Steuernden verträgt.
 */

import util, { getRgbSpreadHex } from '../util.js';
import { createKeyEdge, isKeyDown } from './gui/gridScan.js';
import soundPop from '../../../public/media/369952__mischy__plop-1.wav';
import soundLevelUp from '../../../public/media/opengameart/Level Up.ogg';
import soundSpawn from '../../../public/media/opengameart/Menu Selection Click.wav';
import soundFinal from '../../../public/media/opengameart/Ability Learn.ogg';
import soundBump from '../../../public/media/opengameart/Menu Move.ogg';
var laserConfig = require('../LaserApiConfig.js').default;
var MasterCanvas = require('../MasterCanvas').default;
var guiFillButton = require('./gui/fillButton-ai2').default;
var guiBlobTracker = require('./gui/blobTracker').default;
var createHighscore = require('../util/highscore').default;

// MAZE-GEN-START (reine Geometrie, ohne Canvas – wird auch im Node-Test benutzt)
const W = 1920;
const H = 1080;

const DIFFICULTY = {
  ballRadius: 50,
  wall: 14, // Wanddicke in px
  arenaX: 265,
  arenaR: 230,
  mazeLeft: 560,
  mazeRight: 1830, // dahinter liegt das Ziel
  mazeTop: 90, // darüber das HUD
  mazeBottom: 1060,
  steerGain: 6, // 1/s: Tempo = Abstand Punkt–Mitte * steerGain
  maxSpeed: 380,
  catchFactor: 1.4, // Fangkreis für Laser = Radius * catchFactor (Kamera-Rauschen verzeihen)
  accel: 12, // 1/s, wie schnell die Kugel das Wunschtempo annimmt
  brake: 9, // 1/s, Abbremsen ohne Laser
  respawnDelay: 1.0,
  spawnGrow: 0.5,
  levelupTime: 2.8,
  warnDist: 28, // ab diesem Abstand zur Wand blinkt die Kugel
  maxParticles: 400,
  bumpGrace: 0.6, // s: nach einem Kugelstoss platzt die Kugel an der Wand nicht, sondern prallt ab
  bumpBrake: 14, // 1/s: stärkeres Abbremsen während der Stoss-Schonung
  wallBounce: 0.35, // Rest-Tempo beim Abprallen (Schonung)
  // Pro Level: Ziel-Zellgrösse (px), Kugelanzahl, wie viele Sackgassen bleiben (-1 = perfekter Irrgarten)
  levels: [
    { cell: 300, balls: 5, keep: 1 },
    { cell: 250, balls: 5, keep: 2 },
    { cell: 220, balls: 6, keep: 3 },
    { cell: 200, balls: 6, keep: 4 },
    { cell: 185, balls: 7, keep: 6 },
    { cell: 175, balls: 7, keep: -1 },
    { cell: 160, balls: 8, keep: -1 },
    { cell: 150, balls: 8, keep: -1 },
  ],
};

function shuffle(a) {
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    const t = a[i];
    a[i] = a[j];
    a[j] = t;
  }
  return a;
}

// open[r][c].r = Durchgang nach rechts, .d = Durchgang nach unten
function isOpen(open, r1, c1, r2, c2) {
  if (r1 === r2) return open[r1][Math.min(c1, c2)].r;
  return open[Math.min(r1, r2)][c1].d;
}
function setOpen(open, r1, c1, r2, c2) {
  if (r1 === r2) open[r1][Math.min(c1, c2)].r = true;
  else open[Math.min(r1, r2)][c1].d = true;
}
function neighbours(cols, rows, r, c) {
  const n = [];
  if (r > 0) n.push([r - 1, c]);
  if (r < rows - 1) n.push([r + 1, c]);
  if (c > 0) n.push([r, c - 1]);
  if (c < cols - 1) n.push([r, c + 1]);
  return n;
}
function degree(maze, r, c) {
  let d = 0;
  neighbours(maze.cols, maze.rows, r, c).forEach((n) => {
    if (isOpen(maze.open, r, c, n[0], n[1])) d++;
  });
  if (c === 0 && r === maze.entranceRow) d++;
  if (c === maze.cols - 1 && r === maze.exitRow) d++;
  return d;
}
function deadEnds(maze) {
  const list = [];
  for (let r = 0; r < maze.rows; r++) for (let c = 0; c < maze.cols; c++) if (degree(maze, r, c) <= 1) list.push([r, c]);
  return list;
}

/** Irrgarten per Recursive Backtracker, danach Sackgassen bis auf `keep` aufbrechen (Schleifen = Abzweigungen) */
function generateMaze(cols, rows, keep) {
  const open = [];
  const seen = [];
  for (let r = 0; r < rows; r++) {
    open.push([]);
    seen.push([]);
    for (let c = 0; c < cols; c++) {
      open[r].push({ r: false, d: false });
      seen[r].push(false);
    }
  }
  const entranceRow = Math.floor((rows - 1) / 2);
  const stack = [[entranceRow, 0]];
  seen[entranceRow][0] = true;
  while (stack.length) {
    const cur = stack[stack.length - 1];
    const free = neighbours(cols, rows, cur[0], cur[1]).filter((n) => !seen[n[0]][n[1]]);
    if (!free.length) {
      stack.pop();
      continue;
    }
    const nx = free[Math.floor(Math.random() * free.length)];
    setOpen(open, cur[0], cur[1], nx[0], nx[1]);
    seen[nx[0]][nx[1]] = true;
    stack.push(nx);
  }
  // Ausgang: rechte Spalte, möglichst weit weg von der Eingangszeile
  let exitRow = entranceRow;
  if (rows > 1) {
    const cands = [];
    for (let r = 0; r < rows; r++) if (Math.abs(r - entranceRow) >= Math.max(1, Math.floor(rows / 3))) cands.push(r);
    exitRow = cands.length ? cands[Math.floor(Math.random() * cands.length)] : rows - 1;
  }
  const maze = { cols, rows, open, entranceRow, exitRow };
  if (keep >= 0) {
    let guard = 1000;
    let ends = shuffle(deadEnds(maze));
    while (ends.length > keep && guard-- > 0) {
      const e = ends[0];
      const closed = shuffle(neighbours(cols, rows, e[0], e[1]).filter((n) => !isOpen(open, e[0], e[1], n[0], n[1])));
      // bevorzugt zu einer anderen Sackgasse durchbrechen (baut zwei auf einmal ab)
      closed.sort((a, b) => (degree(maze, a[0], a[1]) <= 1 ? 0 : 1) - (degree(maze, b[0], b[1]) <= 1 ? 0 : 1));
      if (closed.length) setOpen(open, e[0], e[1], closed[0][0], closed[0][1]);
      ends = shuffle(deadEnds(maze));
    }
  }
  return maze;
}

/** Komplettes Level: Irrgarten + Wandsegmente + Arena-Geometrie */
function buildLayout(levelIndex) {
  const D = DIFFICULTY;
  const cfg = D.levels[Math.min(levelIndex, D.levels.length - 1)];
  const availW = D.mazeRight - D.mazeLeft;
  const availH = D.mazeBottom - D.mazeTop;
  const cols = Math.max(2, Math.floor(availW / cfg.cell));
  const rows = Math.max(2, Math.floor(availH / cfg.cell));
  const cw = availW / cols;
  const ch = availH / rows;
  const maze = generateMaze(cols, rows, cfg.keep);
  const x0 = D.mazeLeft;
  const y0 = D.mazeTop;
  const segs = [];
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const xa = x0 + c * cw;
      const ya = y0 + r * ch;
      if (r === 0 || !maze.open[r - 1][c].d) segs.push({ x1: xa, y1: ya, x2: xa + cw, y2: ya });
      if (c === 0 ? r !== maze.entranceRow : !maze.open[r][c - 1].r) segs.push({ x1: xa, y1: ya, x2: xa, y2: ya + ch });
      if (c === cols - 1 && r !== maze.exitRow) segs.push({ x1: xa + cw, y1: ya, x2: xa + cw, y2: ya + ch });
      if (r === rows - 1) segs.push({ x1: xa, y1: ya + ch, x2: xa + cw, y2: ya + ch });
    }
  }
  // Arena + Flaschenhals: Arena-Mitte auf Höhe der Eingangszeile
  const ay = y0 + (maze.entranceRow + 0.5) * ch;
  const ax = D.arenaX;
  const R = D.arenaR;
  const gapHalf = ch / 2;
  const gapAngle = Math.asin(Math.min(0.95, gapHalf / R));
  const ex = ax + R * Math.cos(gapAngle);
  segs.push({ x1: ex, y1: ay - gapHalf, x2: x0, y2: ay - gapHalf });
  segs.push({ x1: ex, y1: ay + gapHalf, x2: x0, y2: ay + gapHalf });
  return {
    level: levelIndex,
    cfg,
    maze,
    cols,
    rows,
    cw,
    ch,
    x0,
    y0,
    segs,
    arena: { x: ax, y: ay, r: R, gapAngle, gapHalf },
    exit: { x: D.mazeRight, y: y0 + (maze.exitRow + 0.5) * ch, h: ch },
  };
}

function distToSegment(px, py, s) {
  const dx = s.x2 - s.x1;
  const dy = s.y2 - s.y1;
  const l2 = dx * dx + dy * dy;
  let t = l2 > 0 ? ((px - s.x1) * dx + (py - s.y1) * dy) / l2 : 0;
  t = Math.max(0, Math.min(1, t));
  return Math.hypot(px - (s.x1 + t * dx), py - (s.y1 + t * dy));
}

/** Abstand zur Arena-Wand (Kreisbogen mit Lücke nach rechts) */
function distToArena(px, py, a) {
  const phi = Math.atan2(py - a.y, px - a.x);
  if (Math.abs(phi) > a.gapAngle) return Math.abs(Math.hypot(px - a.x, py - a.y) - a.r);
  const ex = a.x + a.r * Math.cos(a.gapAngle);
  return Math.min(Math.hypot(px - ex, py - (a.y - a.gapHalf)), Math.hypot(px - ex, py - (a.y + a.gapHalf)));
}

/** kleinster Abstand Kugelmitte → irgendeine Wandmitte-Linie */
function wallDistance(layout, px, py) {
  let best = distToArena(px, py, layout.arena);
  const segs = layout.segs;
  for (let i = 0; i < segs.length; i++) {
    const d = distToSegment(px, py, segs[i]);
    if (d < best) best = d;
  }
  return best;
}
// MAZE-GEN-END

// ---------------------------------------------------------------------------------------------------------
// Zustand (modulweit vorbelegt, damit handle() auch ohne init() läuft)
// ---------------------------------------------------------------------------------------------------------

var gameState = 'start'; // 'start' | 'play' | 'levelup' | 'final'
var level = 0; // Index in DIFFICULTY.levels
var layout = null;
var mazeCanvas = null;
var balls = [];
var particles = [];
var floaters = [];
var rings = [];
var time = 0;
var levelTime = 0;
var totalTime = 0;
var bursts = 0;
var levelBursts = 0;
var stateTimer = 0;
var shake = 0;
var nextBallId = 1;
var respawnQueue = []; // Zeitpunkte (time) für neue Kugeln
var selectedBall = 0;
var keyboardUsed = false;
var winner = null;
var palette = null;
var startButton = null;
var restartButton = null;
var tracker = null;
var pressedOnce = createKeyEdge();
var bgDots = [];
var highscore = createHighscore('Labyrinth', 'punkte');
var finalScore = 0;
var newHighscore = false;

function makePalette() {
  const tc = laserConfig.testColor;
  palette = {
    // Ausserhalb des Labyrinths (keine Aktionsfläche) ein Hauch Farbe, Gänge/Arena tiefschwarz
    bgTop: getRgbSpreadHex(tc, 0.55, 0.7, 0.07),
    bgBottom: getRgbSpreadHex(tc, 0.7, 0.8, 0.03),
    floor: '#000000',
    wall: getRgbSpreadHex(tc, 0.5, 0.75, 0.85),
    wallGlow: getRgbSpreadHex(tc, 0.5, 0.9, 0.5),
    goal: getRgbSpreadHex(tc, 0.33, 0.8, 1),
    hud: getRgbSpreadHex(tc, 0.45, 0.35, 1),
    hudDim: getRgbSpreadHex(tc, 0.45, 0.4, 0.7),
    warn: getRgbSpreadHex(tc, 0.28, 0.9, 1),
    block: getRgbSpreadHex(tc, 0.72, 0.9, 1),
    title: getRgbSpreadHex(tc, 0.4, 0.6, 1),
    title2: getRgbSpreadHex(tc, 0.62, 0.7, 1),
    ballHues: [0.25, 0.38, 0.5, 0.62, 0.75, 0.3, 0.45, 0.68],
  };
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

// ---------------------------------------------------------------------------------------------------------
// Level aufbauen + vorrendern
// ---------------------------------------------------------------------------------------------------------

function renderMaze() {
  if (!mazeCanvas) {
    mazeCanvas = document.createElement('canvas');
    mazeCanvas.width = W;
    mazeCanvas.height = H;
  }
  const c = mazeCanvas.getContext('2d');
  const D = DIFFICULTY;
  c.clearRect(0, 0, W, H);
  const g = c.createLinearGradient(0, 0, 0, H);
  g.addColorStop(0, palette.bgTop);
  g.addColorStop(1, palette.bgBottom);
  c.fillStyle = g;
  c.fillRect(0, 0, W, H);

  // Boden: Gänge + Arena + Flaschenhals
  c.fillStyle = palette.floor;
  c.fillRect(layout.x0, layout.y0, D.mazeRight - layout.x0, D.mazeBottom - layout.y0);
  const a = layout.arena;
  c.fillRect(a.x, a.y - a.gapHalf, layout.x0 - a.x, a.gapHalf * 2);
  c.beginPath();
  c.arc(a.x, a.y, a.r, 0, Math.PI * 2);
  c.fill();

  // (kein Kachel-Raster: Gänge bleiben schwarz, damit die Kamera nur Laser sieht)

  // Wände: breites Glühen, dann harter Kern
  const drawWalls = (width, color, alpha, blur) => {
    c.save();
    c.globalAlpha = alpha;
    c.strokeStyle = color;
    c.lineWidth = width;
    c.lineCap = 'round';
    c.shadowColor = color;
    c.shadowBlur = blur;
    c.beginPath();
    layout.segs.forEach((s) => {
      c.moveTo(s.x1, s.y1);
      c.lineTo(s.x2, s.y2);
    });
    c.arc(a.x, a.y, a.r, a.gapAngle, Math.PI * 2 - a.gapAngle);
    c.stroke();
    c.restore();
  };
  // nur schmale Kontur, wenig Glühen – kein Licht soll in die Gänge bluten
  drawWalls(D.wall + 6, palette.wallGlow, 0.15, 6);
  drawWalls(D.wall * 0.6, palette.wall, 1, 0);

  util.renderText({ ctx: c, text: 'START', x: a.x, y: a.y - a.r - 18, fontSize: '36px', fillStyle: palette.hudDim });
}

function buildLevel(index) {
  if (!palette) makePalette();
  level = index;
  layout = buildLayout(index);
  balls = [];
  respawnQueue = [];
  winner = null;
  levelTime = 0;
  levelBursts = 0;
  selectedBall = 0;
  for (let i = 0; i < layout.cfg.balls; i++) respawnQueue.push(time + i * 0.35);
  renderMaze();
}

// ---------------------------------------------------------------------------------------------------------
// Kugeln
// ---------------------------------------------------------------------------------------------------------

function trySpawnBall() {
  const D = DIFFICULTY;
  const a = layout.arena;
  const maxR = a.r - D.ballRadius - D.wall / 2 - D.warnDist;
  for (let attempt = 0; attempt < 30; attempt++) {
    const ang = Math.random() * Math.PI * 2;
    const rr = Math.sqrt(Math.random()) * maxR;
    const x = a.x + Math.cos(ang) * rr;
    const y = a.y + Math.sin(ang) * rr;
    const free = balls.every((b) => Math.hypot(b.x - x, b.y - y) > D.ballRadius * 2 + 12);
    if (free) {
      const id = nextBallId++;
      const hue = palette.ballHues[id % palette.ballHues.length];
      balls.push({
        id,
        x,
        y,
        vx: 0,
        vy: 0,
        grow: 0,
        steer: 0,
        dot: null,
        near: 999,
        color: getRgbSpreadHex(laserConfig.testColor, hue, 0.75, 1),
        dark: getRgbSpreadHex(laserConfig.testColor, hue, 0.9, 0.1),
        bumpGrace: 0,
      });
      playSound(soundSpawn, 0.35);
      return true;
    }
  }
  return false;
}

function addParticles(x, y, color, count, speed) {
  for (let i = 0; i < count; i++) {
    if (particles.length >= DIFFICULTY.maxParticles) particles.shift();
    const ang = Math.random() * Math.PI * 2;
    const v = speed * (0.3 + Math.random());
    particles.push({ x, y, vx: Math.cos(ang) * v, vy: Math.sin(ang) * v, life: 0, max: 0.5 + Math.random() * 0.8, color, size: 3 + Math.random() * 7 });
  }
}

function burstBall(b) {
  addParticles(b.x, b.y, b.color, 45, 420);
  rings.push({ x: b.x, y: b.y, r: DIFFICULTY.ballRadius, life: 0, max: 0.5, color: b.color });
  floaters.push({ x: b.x, y: b.y - 60, text: 'PLOPP!', life: 0, max: 1.2, color: palette.warn });
  balls.splice(balls.indexOf(b), 1);
  bursts++;
  levelBursts++;
  shake = 0.3;
  respawnQueue.push(time + DIFFICULTY.respawnDelay);
  playSound(soundPop, 0.8);
}

/** Laserpunkte des Frames: Blobs + virtuelle Tastatur-Laser */
function collectDots() {
  const dots = tracker ? tracker.getBlobs().map((b) => ({ x: b.x, y: b.y })) : [];
  const alive = balls.filter((b) => b.grow >= 1);
  if (pressedOnce('KeyB') && alive.length) {
    selectedBall = (selectedBall + 1) % alive.length;
    keyboardUsed = true;
  }
  const sel = alive.length ? alive[selectedBall % alive.length] : null;
  if (sel) {
    let kx = 0;
    let ky = 0;
    if (isKeyDown('ArrowLeft')) kx -= 1;
    if (isKeyDown('ArrowRight')) kx += 1;
    if (isKeyDown('ArrowUp')) ky -= 1;
    if (isKeyDown('ArrowDown')) ky += 1;
    const r = DIFFICULTY.ballRadius;
    if (kx || ky) {
      keyboardUsed = true;
      const l = Math.hypot(kx, ky);
      dots.push({ x: sel.x + (kx / l) * r * 0.75, y: sel.y + (ky / l) * r * 0.75 });
    }
    if (isKeyDown('KeyX')) {
      keyboardUsed = true;
      dots.push({ x: sel.x - r * 0.5, y: sel.y });
      dots.push({ x: sel.x + r * 0.5, y: sel.y });
    }
  }
  return { dots, sel };
}

/** Stoss-Schonung: Kugel aus der Wand schieben und gedämpft abprallen lassen (Normale per Gradient) */
function bounceOffWall(b, depth) {
  const e = 2;
  let nx = wallDistance(layout, b.x + e, b.y) - wallDistance(layout, b.x - e, b.y);
  let ny = wallDistance(layout, b.x, b.y + e) - wallDistance(layout, b.x, b.y - e);
  const l = Math.hypot(nx, ny);
  if (l < 1e-6) {
    nx = -b.vx;
    ny = -b.vy;
  }
  const l2 = Math.hypot(nx, ny) || 1;
  nx /= l2;
  ny /= l2;
  b.x += nx * (depth + 1);
  b.y += ny * (depth + 1);
  const vn = b.vx * nx + b.vy * ny;
  if (vn < 0) {
    b.vx = (b.vx - 2 * vn * nx) * DIFFICULTY.wallBounce;
    b.vy = (b.vy - 2 * vn * ny) * DIFFICULTY.wallBounce;
  }
  b.near = 0;
  if (Math.random() < 0.5) addParticles(b.x - nx * DIFFICULTY.ballRadius, b.y - ny * DIFFICULTY.ballRadius, palette.hudDim, 5, 120);
}

function updateBalls(dt) {
  const D = DIFFICULTY;
  const r = D.ballRadius;
  const catchR = r * D.catchFactor;
  const res = collectDots();
  const dots = res.dots;

  balls.forEach((b) => {
    b.bumpGrace = Math.max(0, b.bumpGrace - dt);
    if (b.grow < 1) {
      b.grow = Math.min(1, b.grow + dt / D.spawnGrow);
      b.steer = 0;
      b.dot = null;
      return;
    }
    let count = 0;
    let dot = null;
    for (let i = 0; i < dots.length; i++) {
      if (Math.hypot(dots[i].x - b.x, dots[i].y - b.y) <= catchR) {
        count++;
        dot = dots[i];
      }
    }
    b.steer = count;
    b.dot = count === 1 ? dot : null;
    if (count === 1) {
      let tvx = (dot.x - b.x) * D.steerGain;
      let tvy = (dot.y - b.y) * D.steerGain;
      const sp = Math.hypot(tvx, tvy);
      if (sp > D.maxSpeed) {
        tvx *= D.maxSpeed / sp;
        tvy *= D.maxSpeed / sp;
      }
      const k = Math.min(1, D.accel * dt);
      b.vx += (tvx - b.vx) * k;
      b.vy += (tvy - b.vy) * k;
    } else {
      const k = Math.max(0, 1 - (b.bumpGrace > 0 ? D.bumpBrake : D.brake) * dt);
      b.vx *= k;
      b.vy *= k;
    }
    b.x += b.vx * dt;
    b.y += b.vy * dt;
  });

  // Kugel-Kugel: elastischer Stoss (gleiche Masse)
  for (let i = 0; i < balls.length; i++) {
    for (let j = i + 1; j < balls.length; j++) {
      const p = balls[i];
      const q = balls[j];
      const rp = r * Math.max(0.2, p.grow);
      const rq = r * Math.max(0.2, q.grow);
      const dx = q.x - p.x;
      const dy = q.y - p.y;
      const d = Math.hypot(dx, dy);
      if (d >= rp + rq || d === 0) continue;
      const nx = dx / d;
      const ny = dy / d;
      const overlap = (rp + rq - d) / 2;
      p.x -= nx * overlap;
      p.y -= ny * overlap;
      q.x += nx * overlap;
      q.y += ny * overlap;
      const vrel = (p.vx - q.vx) * nx + (p.vy - q.vy) * ny;
      if (vrel > 0) {
        p.vx -= vrel * nx;
        p.vy -= vrel * ny;
        q.vx += vrel * nx;
        q.vy += vrel * ny;
        if (vrel > 40) {
          p.bumpGrace = D.bumpGrace;
          q.bumpGrace = D.bumpGrace;
        }
        if (vrel > 80) {
          addParticles(p.x + nx * rp, p.y + ny * rp, palette.hud, 6, 150);
          playSound(soundBump, 0.3);
        }
      }
    }
  }

  // Wände + Ziel
  balls.slice().forEach((b) => {
    if (b.grow < 1) return;
    if (b.x > layout.exit.x && !winner) {
      winner = b;
      return;
    }
    const d = wallDistance(layout, b.x, b.y);
    b.near = d - r - D.wall / 2;
    if (b.near < 0) {
      if (b.bumpGrace > 0) bounceOffWall(b, -b.near);
      else burstBall(b);
    }
  });
}

// ---------------------------------------------------------------------------------------------------------
// Effekte
// ---------------------------------------------------------------------------------------------------------

function updateEffects(dt) {
  particles.slice().forEach((p) => {
    p.life += dt;
    if (p.life >= p.max) {
      particles.splice(particles.indexOf(p), 1);
      return;
    }
    p.x += p.vx * dt;
    p.y += p.vy * dt;
    p.vx *= 1 - 1.5 * dt;
    p.vy *= 1 - 1.5 * dt;
  });
  floaters.slice().forEach((f) => {
    f.life += dt;
    f.y -= 60 * dt;
    if (f.life >= f.max) floaters.splice(floaters.indexOf(f), 1);
  });
  rings.slice().forEach((g) => {
    g.life += dt;
    g.r += 400 * dt;
    if (g.life >= g.max) rings.splice(rings.indexOf(g), 1);
  });
  shake = Math.max(0, shake - dt);
}

function drawEffects(ctx) {
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  particles.forEach((p) => {
    const t = 1 - p.life / p.max;
    ctx.globalAlpha = t;
    ctx.fillStyle = p.color;
    ctx.beginPath();
    ctx.arc(p.x, p.y, p.size * t + 1, 0, Math.PI * 2);
    ctx.fill();
  });
  rings.forEach((g) => {
    ctx.globalAlpha = 1 - g.life / g.max;
    ctx.strokeStyle = g.color;
    ctx.lineWidth = 6;
    ctx.beginPath();
    ctx.arc(g.x, g.y, g.r, 0, Math.PI * 2);
    ctx.stroke();
  });
  ctx.restore();
  floaters.forEach((f) => {
    ctx.save();
    ctx.globalAlpha = 1 - f.life / f.max;
    util.renderText({ ctx, text: f.text, x: f.x, y: f.y, fontSize: '40px', fillStyle: f.color });
    ctx.restore();
  });
}

// ---------------------------------------------------------------------------------------------------------
// Zeichnen
// ---------------------------------------------------------------------------------------------------------

function drawGoal(ctx) {
  const e = layout.exit;
  const pulse = 0.6 + 0.4 * Math.sin(time * 4);
  ctx.save();
  // nur Umriss, keine Füllung (keine Lichtfläche)
  ctx.shadowColor = palette.goal;
  ctx.shadowBlur = 10 * pulse;
  ctx.strokeStyle = palette.goal;
  ctx.lineWidth = 6;
  ctx.strokeRect(e.x + 6, e.y - e.h / 2 + 8, W - e.x - 14, e.h - 16);
  // Pfeile Richtung Ziel
  ctx.fillStyle = palette.goal;
  for (let i = 0; i < 3; i++) {
    const ox = e.x - 70 + ((time * 60 + i * 30) % 90);
    ctx.globalAlpha = 0.25 * pulse;
    ctx.beginPath();
    ctx.moveTo(ox, e.y - 22);
    ctx.lineTo(ox + 22, e.y);
    ctx.lineTo(ox, e.y + 22);
    ctx.closePath();
    ctx.fill();
  }
  ctx.restore();
  ctx.save();
  ctx.translate(e.x + (W - e.x) / 2, e.y);
  ctx.rotate(-Math.PI / 2);
  util.renderText({ ctx, text: 'ZIEL', x: 0, y: 12, fontSize: '36px', fillStyle: '#ffffff' });
  ctx.restore();
}

function drawBall(ctx, b, isSel) {
  const D = DIFFICULTY;
  const r = D.ballRadius * (b.grow < 1 ? 0.2 + 0.8 * b.grow : 1);
  const wobble = 1 + 0.03 * Math.sin(time * 6 + b.id);
  ctx.save();
  // Körper fast schwarz (Aktionsfläche – der Laserpunkt darin muss gut erkennbar bleiben), heller Rand
  ctx.fillStyle = b.dark;
  ctx.beginPath();
  ctx.arc(b.x, b.y, r * wobble, 0, Math.PI * 2);
  ctx.fill();
  ctx.shadowColor = b.color;
  ctx.shadowBlur = b.steer === 1 ? 14 : 6;
  ctx.strokeStyle = b.color;
  ctx.lineWidth = 7;
  ctx.beginPath();
  ctx.arc(b.x, b.y, r * wobble - 3.5, 0, Math.PI * 2);
  ctx.stroke();
  ctx.shadowBlur = 0;
  // kleiner Glanz-Bogen am Rand statt leuchtender Kugelmitte
  ctx.globalAlpha = 0.7;
  ctx.strokeStyle = '#ffffff';
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.arc(b.x, b.y, r * wobble - 12, Math.PI * 1.1, Math.PI * 1.45);
  ctx.stroke();
  ctx.globalAlpha = 1;
  if (b.bumpGrace > 0) {
    // Stoss-Schonung sichtbar: dünner zweiter Ring
    ctx.globalAlpha = b.bumpGrace / DIFFICULTY.bumpGrace;
    ctx.strokeStyle = palette.hud;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(b.x, b.y, r + 14, 0, Math.PI * 2);
    ctx.stroke();
    ctx.globalAlpha = 1;
  }

  // Wandnähe: Warnring
  if (b.grow >= 1 && b.near < D.warnDist && b.bumpGrace <= 0) {
    const t = 1 - Math.max(0, b.near) / D.warnDist;
    ctx.globalAlpha = t * (0.5 + 0.5 * Math.sin(time * 25));
    ctx.strokeStyle = palette.warn;
    ctx.lineWidth = 6;
    ctx.beginPath();
    ctx.arc(b.x, b.y, r + 8, 0, Math.PI * 2);
    ctx.stroke();
    ctx.globalAlpha = 1;
  }

  if (b.steer === 1 && b.dot) {
    // gesteuert: Linie zum Laserpunkt + heller Ring
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.arc(b.x, b.y, r + 4, 0, Math.PI * 2);
    ctx.stroke();
    const ang = Math.atan2(b.dot.y - b.y, b.dot.x - b.x);
    ctx.fillStyle = '#ffffff';
    ctx.globalAlpha = 0.85;
    ctx.beginPath();
    ctx.moveTo(b.x + Math.cos(ang) * (r + 26), b.y + Math.sin(ang) * (r + 26));
    ctx.lineTo(b.x + Math.cos(ang + 0.35) * (r + 8), b.y + Math.sin(ang + 0.35) * (r + 8));
    ctx.lineTo(b.x + Math.cos(ang - 0.35) * (r + 8), b.y + Math.sin(ang - 0.35) * (r + 8));
    ctx.closePath();
    ctx.fill();
  } else if (b.steer >= 2) {
    // blockiert: rotierender gestrichelter Ring
    ctx.strokeStyle = palette.block;
    ctx.lineWidth = 6;
    ctx.setLineDash([14, 12]);
    ctx.lineDashOffset = time * 60;
    ctx.beginPath();
    ctx.arc(b.x, b.y, r + 10, 0, Math.PI * 2);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.restore();
    util.renderText({ ctx, text: 'STOP ' + b.steer + '×', x: b.x, y: b.y - r - 22, fontSize: '30px', fillStyle: palette.block });
    ctx.save();
  }
  if (isSel && keyboardUsed) {
    ctx.strokeStyle = palette.hud;
    ctx.lineWidth = 2;
    ctx.setLineDash([6, 8]);
    ctx.beginPath();
    ctx.arc(b.x, b.y, r * DIFFICULTY.catchFactor, 0, Math.PI * 2);
    ctx.stroke();
    ctx.setLineDash([]);
  }
  ctx.restore();
}

function formatTime(s) {
  const m = Math.floor(s / 60);
  const sec = Math.floor(s % 60);
  return m + ':' + (sec < 10 ? '0' : '') + sec;
}

function drawHud(ctx) {
  util.renderText({ ctx, text: 'LEVEL ' + (level + 1) + '/' + DIFFICULTY.levels.length, x: 40, y: 58, fontSize: '44px', fillStyle: palette.hud, align: 'left' });
  util.renderText({ ctx, text: 'Zeit ' + formatTime(levelTime), x: W / 2, y: 58, fontSize: '44px', fillStyle: palette.hud });
  util.renderText({ ctx, text: 'Geplatzt: ' + levelBursts + '  (gesamt ' + bursts + ')', x: W - 40, y: 58, fontSize: '44px', fillStyle: palette.hud, align: 'right' });
}

function drawBackgroundDots(ctx, dt) {
  if (!bgDots.length) {
    for (let i = 0; i < 60; i++) bgDots.push({ x: Math.random() * W, y: Math.random() * H, s: 10 + Math.random() * 40, r: 2 + Math.random() * 4 });
  }
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  ctx.fillStyle = palette.title2;
  bgDots.forEach((d) => {
    d.y -= d.s * dt;
    if (d.y < -10) {
      d.y = H + 10;
      d.x = Math.random() * W;
    }
    ctx.globalAlpha = 0.25 + 0.2 * Math.sin(time * 2 + d.x);
    ctx.beginPath();
    ctx.arc(d.x, d.y, d.r, 0, Math.PI * 2);
    ctx.fill();
  });
  ctx.restore();
}

// ---------------------------------------------------------------------------------------------------------
// Zustände
// ---------------------------------------------------------------------------------------------------------

function startGame() {
  bursts = 0;
  totalTime = 0;
  particles = [];
  floaters = [];
  rings = [];
  buildLevel(0);
  gameState = 'play';
  playSound(soundLevelUp, 0.5);
}

function levelDone() {
  const e = layout.exit;
  addParticles(W - 50, e.y, palette.goal, 80, 600);
  addParticles(W - 50, e.y, palette.title, 50, 400);
  if (winner && balls.indexOf(winner) >= 0) balls.splice(balls.indexOf(winner), 1);
  stateTimer = 0;
  if (level >= DIFFICULTY.levels.length - 1) {
    finalScore = Math.max(0, Math.round(DIFFICULTY.levels.length * 1000 + Math.max(0, 2400 - totalTime * 2) - bursts * 20));
    highscore.addEntry({ punkte: finalScore, level: DIFFICULTY.levels.length, sekunden: Math.round(totalTime), geplatzt: bursts });
    newHighscore = highscore.lastEntryNewHighscore();
    gameState = 'final';
    restartButton = null;
    playSound(soundFinal, 0.7);
  } else {
    gameState = 'levelup';
    playSound(soundLevelUp, 0.7);
  }
}

function createButton(label) {
  return guiFillButton({
    label,
    posX: W / 2,
    posY: 850,
    radius: 140,
    edges: 8,
    speedUp: 60,
    speedDown: 30,
    activeValue: 90,
    lineWidth: 6,
    normalColor: getRgbSpreadHex(laserConfig.testColor, 0.4, 0.7, 0.8),
    growColor: getRgbSpreadHex(laserConfig.testColor, 0.5, 0.7, 1),
    activeColor: getRgbSpreadHex(laserConfig.testColor, 0.6, 0.6, 1),
    onEnterActive: () => {
      startGame();
    },
  });
}

function handleStart(ctx, grid, dt) {
  if (!layout) buildLevel(0);
  ctx.save();
  ctx.globalAlpha = 0.45;
  ctx.drawImage(mazeCanvas, 0, 0);
  ctx.restore();
  ctx.save();
  ctx.fillStyle = '#000000';
  ctx.globalAlpha = 0.45;
  ctx.fillRect(0, 0, W, H);
  ctx.restore();
  drawBackgroundDots(ctx, dt);
  const wob = Math.sin(time * 1.5) * 8;
  ctx.save();
  ctx.shadowColor = palette.title;
  ctx.shadowBlur = 40;
  util.renderText({ ctx, text: 'LABYRINTH', x: W / 2, y: 260 + wob, fontSize: '150px', fillStyle: palette.title });
  ctx.restore();
  util.renderText({
    ctx,
    text: 'Leuchtet IN eine Kugel – sie rollt zu eurem Punkt.\nNicht an die Wände, sonst – PLOPP!\nZwei Laser in einer Kugel = Stillstand.\nEine Kugel ins Ziel = Level geschafft.',
    x: W / 2,
    y: 400,
    fontSize: '46px',
    lineHeight: 64,
    fillStyle: palette.hud,
  });
  if (!startButton) startButton = createButton('START');
  startButton.handle(grid, dt);
  util.renderText({ ctx, text: 'Leertaste = Start', x: W / 2, y: 1050, fontSize: '28px', fillStyle: palette.hudDim });
  highscore.renderHighAndLowScores(ctx);
  if (pressedOnce('Space')) startGame();
}

function handlePlay(ctx, grid, dt) {
  levelTime += dt;
  totalTime += dt;
  // Respawns
  respawnQueue.sort((a, b) => a - b);
  while (respawnQueue.length && respawnQueue[0] <= time && balls.length < layout.cfg.balls) {
    if (!trySpawnBall()) {
      respawnQueue[0] = time + 0.3;
      break;
    }
    respawnQueue.shift();
  }
  tracker.handle(grid, dt);
  updateBalls(dt);
  if (pressedOnce('KeyN') && !winner) winner = balls[0] || { x: 0, y: layout.exit.y };
  updateEffects(dt);

  ctx.save();
  if (shake > 0) ctx.translate((Math.random() - 0.5) * 16 * shake * 3, (Math.random() - 0.5) * 16 * shake * 3);
  ctx.drawImage(mazeCanvas, 0, 0);
  drawGoal(ctx);
  const alive = balls.filter((b) => b.grow >= 1);
  const sel = alive.length ? alive[selectedBall % alive.length] : null;
  balls.forEach((b) => drawBall(ctx, b, b === sel));
  drawEffects(ctx);
  ctx.restore();
  drawHud(ctx);
  if (winner) levelDone();
}

function handleLevelUp(ctx, grid, dt) {
  stateTimer += dt;
  updateEffects(dt);
  ctx.drawImage(mazeCanvas, 0, 0);
  drawGoal(ctx);
  balls.forEach((b) => drawBall(ctx, b, false));
  drawEffects(ctx);
  const flash = Math.max(0, 1 - stateTimer * 2);
  if (flash > 0) {
    ctx.save();
    ctx.globalAlpha = flash * 0.5;
    ctx.fillStyle = palette.goal;
    ctx.fillRect(0, 0, W, H);
    ctx.restore();
  }
  ctx.save();
  ctx.fillStyle = '#000000';
  ctx.globalAlpha = 0.5;
  ctx.fillRect(0, 380, W, 320);
  ctx.restore();
  const scale = 1 + 0.15 * Math.sin(Math.min(1, stateTimer * 2) * Math.PI);
  ctx.save();
  ctx.translate(W / 2, 540);
  ctx.scale(scale, scale);
  ctx.shadowColor = palette.goal;
  ctx.shadowBlur = 40;
  util.renderText({ ctx, text: 'GESCHAFFT!', x: 0, y: -30, fontSize: '110px', fillStyle: palette.goal });
  ctx.restore();
  util.renderText({
    ctx,
    text: 'Zeit ' + formatTime(levelTime) + '  ·  ' + levelBursts + ' geplatzt  ·  weiter mit LEVEL ' + (level + 2),
    x: W / 2,
    y: 640,
    fontSize: '44px',
    fillStyle: palette.hud,
  });
  drawHud(ctx);
  if (stateTimer >= DIFFICULTY.levelupTime || pressedOnce('Space')) {
    buildLevel(level + 1);
    gameState = 'play';
  }
}

function handleFinal(ctx, grid, dt) {
  stateTimer += dt;
  updateEffects(dt);
  if (Math.random() < dt * 4) addParticles(200 + Math.random() * (W - 400), 150 + Math.random() * 400, Math.random() < 0.5 ? palette.goal : palette.title2, 30, 350);
  ctx.save();
  ctx.globalAlpha = 0.35;
  ctx.drawImage(mazeCanvas, 0, 0);
  ctx.restore();
  drawBackgroundDots(ctx, dt);
  drawEffects(ctx);
  ctx.save();
  ctx.shadowColor = palette.goal;
  ctx.shadowBlur = 40;
  util.renderText({ ctx, text: 'ALLE LABYRINTHE', x: W / 2, y: 260, fontSize: '130px', fillStyle: palette.goal });
  ctx.restore();
  util.renderText({
    ctx,
    text:
      DIFFICULTY.levels.length + ' Level geschafft!  ' + finalScore + ' Punkte' + (newHighscore ? '  – NEUER HIGHSCORE!' : '') +
      '\nGesamtzeit ' + formatTime(totalTime) + '\n' + bursts + ' Kugeln geplatzt',
    x: W / 2,
    y: 420,
    fontSize: '56px',
    lineHeight: 80,
    fillStyle: palette.hud,
  });
  highscore.renderHighAndLowScores(ctx);
  if (stateTimer > 2) {
    if (!restartButton) restartButton = createButton('NOCHMAL');
    restartButton.handle(grid, dt);
    if (pressedOnce('Space')) startGame();
  }
}

// ---------------------------------------------------------------------------------------------------------

export default {
  name: 'Labyrinth',
  description:
    'LABYRINTH – lotst die Kugeln aus der Start-Arena durch den Irrgarten ins Ziel!\n' +
    'Leuchtet IN eine Kugel: Sie rollt zu eurem Laserpunkt. Haltet den Punkt immer ein Stück vor ihre Mitte.\n' +
    'Ohne Laser bleibt die Kugel stehen. Zwei Laser in einer Kugel blockieren sich – Stillstand!\n' +
    'Berührt eine Kugel eine Wand, zerplatzt sie. Kugeln prallen voneinander ab.\n' +
    'Eine Kugel im Ziel = Level geschafft. 8 Level, jedes enger und verzweigter.',
  image: 'media/img/gametitles/laser-pong-###4###.png',
  init: function () {
    makePalette();
    gameState = 'start';
    time = 0;
    bursts = 0;
    totalTime = 0;
    particles = [];
    floaters = [];
    rings = [];
    bgDots = [];
    startButton = null;
    restartButton = null;
    keyboardUsed = false;
    tracker = guiBlobTracker({ minCells: 1, mergeDistance: 20, keepTime: 0.15, smoothing: 20, maxBlobs: 64 });
    buildLevel(0);
  },
  handle: function (grid, elapsed) {
    const dt = Math.min(elapsed, 0.1);
    time += dt;
    if (!palette) makePalette();
    if (!tracker) tracker = guiBlobTracker({ minCells: 1, mergeDistance: 20, keepTime: 0.15, smoothing: 20, maxBlobs: 64 });
    if (!layout || !mazeCanvas) buildLevel(level);
    const ctx = MasterCanvas.get2dContext();
    if (gameState === 'start') handleStart(ctx, grid, dt);
    else if (gameState === 'play') handlePlay(ctx, grid, dt);
    else if (gameState === 'levelup') handleLevelUp(ctx, grid, dt);
    else handleFinal(ctx, grid, dt);
  },
  stop: function () {
    balls = [];
    particles = [];
    floaters = [];
    rings = [];
  },
};
