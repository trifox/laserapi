/**
 * Laser-Kicker
 *
 * Tischkicker für zwei Teams: die linke Hälfte des Publikums (Team Links) gegen die rechte (Team Rechts).
 *
 * - 8 senkrechte Stangen wie beim echten Kicker, von links nach rechts:
 *   Torwart L, Abwehr L, Sturm R, Mittelfeld L, Mittelfeld R, Sturm L, Abwehr R, Torwart R.
 * - Jede Figur ist ein gui/followCircle (folgt dem Laser). Per Handle-Wrapping wird X fest auf der
 *   Stange gehalten, nur Y ist beweglich. Alle Figuren einer Stange bewegen sich gemeinsam:
 *   die Y-Bewegungen der Figuren einer Stange werden aufsummiert (gegensätzliche Laser heben sich auf).
 * - Jeder Laser kann jede Figur bewegen, auch die des Gegners – das ist gewollt (Chaos/Störung).
 * - Der Ball hat eine eigene einfache Physik: Bande, Figuren-Kreise, Reibung, Maximaltempo.
 *   Eine schnell bewegte Stange überträgt Impuls auf den Ball ("Schuss").
 * - Satzsystem: ein Satz geht bis DIFFICULTY.goalsPerSet Tore, das Match ist "Best of 3" Sätze.
 *   Nach jedem Satz kommt eine Pause mit Zwischenstand, der Ball wird pro Satz schneller.
 * - Anstoss nach einem Tor hat das Team, das das Tor kassiert hat.
 * - Anti-Stillstand: liegt der Ball zu lange fast still, gibt es einen Einwurf von der Mitte.
 *
 * Zum Testen ohne Laser: W/S bewegt alle Stangen von Team Links, Pfeil hoch/runter die von Team Rechts,
 * Leertaste startet das Spiel bzw. die Revanche.
 *
 * Alle Stellschrauben stehen gesammelt in DIFFICULTY.
 */

import util, { drawLine, drawNgon, getRgbSpreadHex } from '../util.js';
import guiFollowCircle from './gui/followCircle.js';
var laserConfig = require('../LaserApiConfig.js').default;
var MasterCanvas = require('../MasterCanvas').default;
var guiFillButton = require('./gui/fillButton').default;
import soundWhistle from '../../../public/media/trillerpfeife.mp3';
import soundGoal from '../../../public/media/goal148153_612195-lq.mp3';
import soundMatchWin from '../../../public/media/goal2.mp3';
import soundFans1 from '../../../public/media/fans1-463918_9722681-lq.mp3';
import soundFans2 from '../../../public/media/fans2-606958_6072659-lq.mp3';
import soundKick from '../../../public/media/ball-264601_3797507-lq.mp3';
import soundBounce from '../../../public/media/bounce_523088_11537497-lq.mp3';
import soundEinwurf from '../../../public/media/einwurf-486205_2524442-lq.mp3';

const DIFFICULTY = {
  // Satzsystem
  goalsPerSet: 5, // Tore für einen Satzgewinn
  setsToWin: 2, // Best of 3
  swapSides: false, // echter Seitenwechsel nach jedem Satz (Teams tauschen die Tore)
  // Pausen in Sekunden
  goalPause: 2.5,
  setBreak: 5, // Seitenwechsel-Pause mit Zwischenstand
  kickoffDelay: 1.5, // so lange klebt der Ball beim Anstoss an der Mittelfeldstange
  // Spielfeld
  goalHeight: 320,
  figureRadius: 50,
  ballRadius: 24,
  goalieRange: 230, // max. Abstand des Torwarts zur Tormitte
  // Figuren / Stangen
  figureScanFactor: 2, // Suchradius des followCircle = Radius * Faktor
  figureSpeedUp: 0.25,
  figureSpeedDown: 0.2,
  rodMaxSpeed: 1100, // px/s
  rodSpeedSmoothing: 12, // Glättung der Stangengeschwindigkeit (1/s)
  keyRodSpeed: 650, // px/s per Tastatur
  // Ball
  ballMaxSpeed: 1500, // px/s im ersten Satz
  ballSpeedPerSet: 0.15, // +15 % Tempo pro Satz
  friction: 0.3, // Geschwindigkeitsverlust pro Sekunde (exponentiell)
  wallRestitution: 0.85,
  figureRestitution: 0.7,
  kickBase: 220, // Grundabstoss bei jeder Berührung (px/s)
  shotThreshold: 120, // ab dieser Stangengeschwindigkeit wird es ein Schuss
  shotFactor: 1.6, // Stangentempo -> Schusstempo
  shotCarry: 0.4, // Anteil der Stangengeschwindigkeit, der in Y mitgegeben wird
  backheelFactor: 0.5, // Schüsse nach hinten sind schwächer
  contactCooldown: 0.25, // s, gleiche Figur zählt erst danach wieder als Ballkontakt
  // Anti-Stillstand
  stillSpeed: 45, // px/s, darunter gilt der Ball als liegend
  stillTime: 5, // Sekunden bis zum Einwurf
  einwurfSpeed: 420,
  // Anzeige: Fantasie-Umrechnung px/s -> km/h für die Schuss-Statistik
  kmhPerPxPerSecond: 0.04,
  shotTextMinKmh: 25, // ab diesem Tempo erscheint ein "Schuss!"-Text
};

const FIELD = { left: 110, right: 1810, top: 150, bottom: 1060 };
FIELD.width = FIELD.right - FIELD.left;
FIELD.height = FIELD.bottom - FIELD.top;
FIELD.centerX = (FIELD.left + FIELD.right) / 2;
FIELD.centerY = (FIELD.top + FIELD.bottom) / 2;

// Stangen wie beim echten Kicker, side = Torseite des Teams, dem die Stange gehört
const ROD_LAYOUT = [
  { side: 'left', role: 'Torwart', count: 1, spacing: 0 },
  { side: 'left', role: 'Abwehr', count: 2, spacing: 360 },
  { side: 'right', role: 'Sturm', count: 3, spacing: 300 },
  { side: 'left', role: 'Mittelfeld', count: 3, spacing: 300 },
  { side: 'right', role: 'Mittelfeld', count: 3, spacing: 300 },
  { side: 'left', role: 'Sturm', count: 3, spacing: 300 },
  { side: 'right', role: 'Abwehr', count: 2, spacing: 360 },
  { side: 'right', role: 'Torwart', count: 1, spacing: 0 },
];

var lastTime = 0;
var gameState = 'start'; // 'start' | 'play' | 'gameover'
var phase = 'kickoff'; // 'kickoff' | 'running' | 'goal' | 'setbreak'
var phaseTimer = 0;
var teams = {};
var sideToTeam = { left: 'L', right: 'R' };
var rods = [];
var ball = { x: 0, y: 0, vx: 0, vy: 0 };
var setNumber = 1;
var matchTime = 0;
var matchWinner = null;
var lastScorer = null;
var lastSetWinner = null;
var kickoffRod = null;
var stillTimer = 0;
var bounceSoundTimer = 0;
var rally = { contacts: 0, time: 0 };
var stats = {};
var floatingTexts = [];
var activeSounds = [];
var startButtons = [];
var readyFlags = { L: false, R: false };
var buttonsGameOverScreen = [];
var gameOverTime = 0;

function getDelta() {
  var currentTime = performance.now();
  if (lastTime === 0) {
    lastTime = currentTime;
    return 0;
  }
  const elapsed = (currentTime - lastTime) / 1000;
  lastTime = currentTime;
  // gegen Sprünge nach Tab-Inaktivität / Intro-Screen
  return Math.min(elapsed, 0.1);
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function playSound(src, volume = 1) {
  const audio = new Audio(src);
  audio.volume = volume;
  activeSounds.push(audio);
  audio.addEventListener('ended', () => {
    const index = activeSounds.indexOf(audio);
    if (index > -1) activeSounds.splice(index, 1);
  });
  audio.play().catch(() => {});
}

function stopAllSounds() {
  activeSounds.forEach((audio) => audio.pause());
  activeSounds = [];
}

function addFloatingText(text, x, y, color, fontSize = 45) {
  floatingTexts.push({ text, x, y, time: 0, duration: 1.6, color, fontSize });
}

function createTeams() {
  const makeTeam = (key, name, hue, edges) => ({
    key,
    name,
    color: getRgbSpreadHex(laserConfig.testColor, hue, 0.8, 0.95),
    darkColor: getRgbSpreadHex(laserConfig.testColor, hue, 0.8, 0.35),
    lightColor: getRgbSpreadHex(laserConfig.testColor, hue, 0.35, 1),
    edges,
    goals: 0, // Tore im aktuellen Satz
    totalGoals: 0,
    sets: 0,
    keyUp: key === 'L' ? 'KeyW' : 'ArrowUp',
    keyDown: key === 'L' ? 'KeyS' : 'ArrowDown',
  });
  teams = {
    L: makeTeam('L', 'Links', 0.35, 8),
    R: makeTeam('R', 'Rechts', 0.65, 6),
  };
}

function teamOfSide(side) {
  return teams[sideToTeam[side]];
}

function teamOfRod(rod) {
  return teamOfSide(rod.side);
}

/** +1 = Stange spielt nach rechts, -1 = nach links */
function attackDir(rod) {
  return rod.side === 'left' ? 1 : -1;
}

function otherTeam(team) {
  return team === teams.L ? teams.R : teams.L;
}

function getSpeedScale() {
  return 1 + DIFFICULTY.ballSpeedPerSet * (setNumber - 1);
}

function createRods() {
  const r = DIFFICULTY.figureRadius;
  const rodSpacing = FIELD.width / ROD_LAYOUT.length;
  rods = ROD_LAYOUT.map((layout, index) => {
    const x = FIELD.left + rodSpacing * (index + 0.5);
    const slots = [];
    for (let i = 0; i < layout.count; i++) {
      slots.push((i - (layout.count - 1) / 2) * layout.spacing);
    }
    let minOffset = FIELD.top + r - slots[0];
    let maxOffset = FIELD.bottom - r - slots[slots.length - 1];
    if (layout.role === 'Torwart') {
      minOffset = Math.max(minOffset, FIELD.centerY - DIFFICULTY.goalieRange);
      maxOffset = Math.min(maxOffset, FIELD.centerY + DIFFICULTY.goalieRange);
    }
    const rod = {
      index,
      x,
      side: layout.side,
      role: layout.role,
      slots,
      minOffset,
      maxOffset,
      offset: FIELD.centerY,
      vy: 0,
      dys: slots.map(() => 0),
      figures: [],
      contactCooldowns: slots.map(() => 0),
    };
    rod.figures = slots.map((slot, i) => createFigure(rod, i));
    return rod;
  });
}

/** Figur = followCircle, X wird per Handle-Wrapping fest auf der Stange gehalten */
function createFigure(rod, slotIndex) {
  const figure = guiFollowCircle({
    label: '',
    posX: rod.x,
    posY: rod.offset + rod.slots[slotIndex],
    radius: DIFFICULTY.figureRadius,
    speedUp: DIFFICULTY.figureSpeedUp,
    speedDown: DIFFICULTY.figureSpeedDown,
    scanRadiusFactor: DIFFICULTY.figureScanFactor,
    followTrueOrRepellFalse: true,
    visible: false, // gezeichnet wird in renderRods, nachdem die Stange ausgerichtet ist
  });
  const handleOriginal = figure.handle;
  figure.handle = (grid, elapsed) => {
    figure.setX(rod.x);
    figure.setSpeedX(0);
    const yBefore = figure.getY();
    handleOriginal(grid, elapsed);
    // nur die Y-Bewegung zählt, sie wird auf die ganze Stange übertragen
    rod.dys[slotIndex] = figure.getY() - yBefore;
    figure.setX(rod.x);
    figure.setSpeedX(0);
  };
  return figure;
}

/** Laser-Eingabe aller Figuren einer Stange sammeln und die Stange gemeinsam bewegen */
function updateRod(rod, grid, elapsed) {
  rod.figures.forEach((figure) => figure.handle(grid, elapsed));
  let delta = rod.dys.reduce((sum, dy) => sum + dy, 0);

  // Tastatur-Steuerung zum Testen ohne Laser
  const team = teamOfRod(rod);
  if (laserConfig.pressedKeys[team.keyUp]) delta -= DIFFICULTY.keyRodSpeed * elapsed;
  if (laserConfig.pressedKeys[team.keyDown]) delta += DIFFICULTY.keyRodSpeed * elapsed;

  const maxStep = DIFFICULTY.rodMaxSpeed * elapsed;
  delta = clamp(delta, -maxStep, maxStep);
  const previous = rod.offset;
  rod.offset = clamp(previous + delta, rod.minOffset, rod.maxOffset);
  const atLimit = rod.offset === rod.minOffset || rod.offset === rod.maxOffset;
  rod.figures.forEach((figure, i) => {
    figure.setY(rod.offset + rod.slots[i]);
    if (atLimit) figure.setSpeedY(0);
  });

  const vy = elapsed > 0 ? (rod.offset - previous) / elapsed : 0;
  rod.vy += (vy - rod.vy) * Math.min(1, DIFFICULTY.rodSpeedSmoothing * elapsed);
  rod.contactCooldowns = rod.contactCooldowns.map((c) => Math.max(0, c - elapsed));
}

function resetRods() {
  rods.forEach((rod) => {
    rod.offset = clamp(FIELD.centerY, rod.minOffset, rod.maxOffset);
    rod.vy = 0;
    rod.figures.forEach((figure, i) => {
      figure.setY(rod.offset + rod.slots[i]);
      figure.setSpeedY(0);
      figure.setSpeedX(0);
    });
  });
}

function endRally() {
  if (rally.contacts > stats.longestRally.contacts) {
    stats.longestRally = { contacts: rally.contacts, time: rally.time };
  }
  rally = { contacts: 0, time: 0 };
}

/** Anstoss: der Ball liegt schräg vor der Mittelfeldstange des Teams */
function startKickoff(team) {
  phase = 'kickoff';
  phaseTimer = DIFFICULTY.kickoffDelay;
  kickoffRod = rods.find((rod) => teamOfRod(rod) === team && rod.role === 'Mittelfeld');
  placeBallAtKickoffRod();
  ball.vx = 0;
  ball.vy = 0;
  stillTimer = 0;
  addFloatingText(`Anstoss Team ${team.name}`, FIELD.centerX, 260, team.color, 50);
  playSound(soundWhistle);
}

function placeBallAtKickoffRod() {
  const dir = attackDir(kickoffRod);
  ball.x = kickoffRod.x + dir * (DIFFICULTY.figureRadius * 0.9);
  ball.y = clamp(
    kickoffRod.offset + DIFFICULTY.figureRadius * 1.5,
    FIELD.top + DIFFICULTY.ballRadius,
    FIELD.bottom - DIFFICULTY.ballRadius
  );
}

/** Einwurf von der Mitte (Anti-Stillstand) */
function einwurf() {
  endRally();
  stats.einwuerfe++;
  const scale = getSpeedScale();
  const fromTop = Math.random() < 0.5;
  ball.x = FIELD.centerX;
  ball.y = fromTop ? FIELD.top + DIFFICULTY.ballRadius + 5 : FIELD.bottom - DIFFICULTY.ballRadius - 5;
  ball.vx = (Math.random() - 0.5) * 300 * scale;
  ball.vy = (fromTop ? 1 : -1) * DIFFICULTY.einwurfSpeed * scale;
  stillTimer = 0;
  addFloatingText('Einwurf!', FIELD.centerX, 260, getRgbSpreadHex(laserConfig.testColor, 0.5, 0.3, 1), 50);
  playSound(soundEinwurf);
}

function startSet() {
  teams.L.goals = 0;
  teams.R.goals = 0;
  floatingTexts = [];
  resetRods();
  // Anstoss zu Satzbeginn abwechselnd
  startKickoff(setNumber % 2 === 1 ? teams.L : teams.R);
}

function resetMatch() {
  gameState = 'play';
  createTeams();
  sideToTeam = { left: 'L', right: 'R' };
  createRods();
  setNumber = 1;
  matchTime = 0;
  matchWinner = null;
  lastScorer = null;
  lastSetWinner = null;
  rally = { contacts: 0, time: 0 };
  stats = {
    longestRally: { contacts: 0, time: 0 },
    fastestShot: { speed: 0, team: null },
    einwuerfe: 0,
    contacts: { L: 0, R: 0 },
  };
  startSet();
}

function scoreGoal(team) {
  endRally();
  team.goals++;
  team.totalGoals++;
  lastScorer = team;
  phase = 'goal';
  phaseTimer = DIFFICULTY.goalPause;
  ball.vx = 0;
  ball.vy = 0;
  playSound(soundGoal);
  playSound(Math.random() < 0.5 ? soundFans1 : soundFans2, 0.7);
}

/** nach der Tor-Pause: Satz/Match prüfen oder Anstoss für das Team, das kassiert hat */
function afterGoalPause() {
  const scorer = lastScorer;
  if (scorer.goals >= DIFFICULTY.goalsPerSet) {
    scorer.sets++;
    lastSetWinner = scorer;
    if (scorer.sets >= DIFFICULTY.setsToWin) {
      matchWinner = scorer;
      endMatch();
      return;
    }
    phase = 'setbreak';
    phaseTimer = DIFFICULTY.setBreak;
    playSound(soundWhistle);
    return;
  }
  startKickoff(otherTeam(scorer));
}

function endMatch() {
  gameState = 'gameover';
  gameOverTime = 0;
  buttonsGameOverScreen = createButtonsGameOverScreen();
  playSound(soundMatchWin);
  playSound(soundFans1, 0.8);
}

function nextSet() {
  setNumber++;
  if (DIFFICULTY.swapSides) {
    sideToTeam = { left: sideToTeam.right, right: sideToTeam.left };
  }
  startSet();
}

/** Ballkontakt mit einer Figur: Abprallen, Grundabstoss und ggf. Schuss aus der Stangenbewegung */
function collideBallWithFigure(rod, slotIndex, figure) {
  const r = DIFFICULTY.ballRadius + figure.getRadius();
  const dx = ball.x - figure.getX();
  const dy = ball.y - figure.getY();
  const distSq = dx * dx + dy * dy;
  if (distSq >= r * r) return;
  const dist = Math.sqrt(distSq) || 0.001;
  const nx = dx / dist;
  const ny = dy / dist;

  // aus der Figur herausschieben
  ball.x = figure.getX() + nx * r;
  ball.y = figure.getY() + ny * r;

  // Abprallen relativ zur bewegten Figur (Figur bewegt sich nur in Y)
  const relVx = ball.vx;
  const relVy = ball.vy - rod.vy;
  const vn = relVx * nx + relVy * ny;
  if (vn < 0) {
    ball.vx -= (1 + DIFFICULTY.figureRestitution) * vn * nx;
    ball.vy -= (1 + DIFFICULTY.figureRestitution) * vn * ny;
  }

  if (rod.contactCooldowns[slotIndex] > 0) return;
  rod.contactCooldowns[slotIndex] = DIFFICULTY.contactCooldown;

  // Schuss: weg von der Figur, nach vorne voll, nach hinten schwächer
  const scale = getSpeedScale();
  const dir = attackDir(rod);
  const kickDir = Math.abs(nx) > 0.05 ? Math.sign(nx) : dir;
  const forward = kickDir === dir ? 1 : DIFFICULTY.backheelFactor;
  const rodSpeed = Math.abs(rod.vy);
  const power =
    (DIFFICULTY.kickBase + Math.max(0, rodSpeed - DIFFICULTY.shotThreshold) * DIFFICULTY.shotFactor) *
    forward *
    scale;
  ball.vx += kickDir * power;
  ball.vy += rod.vy * DIFFICULTY.shotCarry;
  limitBallSpeed();

  // Statistik
  const team = teamOfRod(rod);
  rally.contacts++;
  stats.contacts[team.key]++;
  const speed = Math.sqrt(ball.vx * ball.vx + ball.vy * ball.vy);
  const kmh = speed * DIFFICULTY.kmhPerPxPerSecond;
  if (speed > stats.fastestShot.speed) {
    stats.fastestShot = { speed, team };
  }
  if (rodSpeed > DIFFICULTY.shotThreshold) {
    playSound(soundKick, 0.8);
    if (kmh >= DIFFICULTY.shotTextMinKmh) {
      addFloatingText(`Schuss! ${kmh.toFixed(0)} km/h`, ball.x, ball.y - 60, team.lightColor, 40);
    }
  }
}

function limitBallSpeed() {
  const max = DIFFICULTY.ballMaxSpeed * getSpeedScale();
  const speed = Math.sqrt(ball.vx * ball.vx + ball.vy * ball.vy);
  if (speed > max) {
    ball.vx = (ball.vx / speed) * max;
    ball.vy = (ball.vy / speed) * max;
  }
}

function playBounce() {
  if (bounceSoundTimer <= 0) {
    bounceSoundTimer = 0.15;
    playSound(soundBounce, 0.5);
  }
}

/** Bande und Tore; gibt true zurück, wenn ein Tor gefallen ist */
function collideBallWithWalls() {
  const br = DIFFICULTY.ballRadius;
  if (ball.y < FIELD.top + br) {
    ball.y = FIELD.top + br;
    ball.vy = Math.abs(ball.vy) * DIFFICULTY.wallRestitution;
    playBounce();
  } else if (ball.y > FIELD.bottom - br) {
    ball.y = FIELD.bottom - br;
    ball.vy = -Math.abs(ball.vy) * DIFFICULTY.wallRestitution;
    playBounce();
  }
  const inGoalMouth = Math.abs(ball.y - FIELD.centerY) < DIFFICULTY.goalHeight / 2 - br * 0.5;
  if (ball.x < FIELD.left + br) {
    if (inGoalMouth) {
      if (ball.x < FIELD.left - br) {
        scoreGoal(teamOfSide('right'));
        return true;
      }
    } else {
      ball.x = FIELD.left + br;
      ball.vx = Math.abs(ball.vx) * DIFFICULTY.wallRestitution;
      playBounce();
    }
  } else if (ball.x > FIELD.right - br) {
    if (inGoalMouth) {
      if (ball.x > FIELD.right + br) {
        scoreGoal(teamOfSide('left'));
        return true;
      }
    } else {
      ball.x = FIELD.right - br;
      ball.vx = -Math.abs(ball.vx) * DIFFICULTY.wallRestitution;
      playBounce();
    }
  }
  return false;
}

function updateBall(elapsed) {
  bounceSoundTimer -= elapsed;
  rally.time += elapsed;

  // Unterschritte gegen das Durchtunneln schneller Bälle
  const speed = Math.sqrt(ball.vx * ball.vx + ball.vy * ball.vy);
  const steps = clamp(Math.ceil((speed * elapsed) / 10), 1, 20);
  const dt = elapsed / steps;
  for (let s = 0; s < steps; s++) {
    ball.x += ball.vx * dt;
    ball.y += ball.vy * dt;
    for (let i = 0; i < rods.length; i++) {
      const rod = rods[i];
      // nur Stangen in Reichweite prüfen
      if (Math.abs(ball.x - rod.x) > DIFFICULTY.figureRadius + DIFFICULTY.ballRadius) continue;
      rod.figures.forEach((figure, slotIndex) => collideBallWithFigure(rod, slotIndex, figure));
    }
    if (collideBallWithWalls()) return;
  }

  // Reibung
  const damping = Math.exp(-DIFFICULTY.friction * elapsed);
  ball.vx *= damping;
  ball.vy *= damping;
  limitBallSpeed();

  // Anti-Stillstand
  const newSpeed = Math.sqrt(ball.vx * ball.vx + ball.vy * ball.vy);
  if (newSpeed < DIFFICULTY.stillSpeed) {
    stillTimer += elapsed;
    if (stillTimer > DIFFICULTY.stillTime) {
      einwurf();
    }
  } else {
    stillTimer = 0;
  }
}

/* ---------- Buttons ---------- */

function createStartButtons() {
  readyFlags = { L: false, R: false };
  const makeButton = (key, x, hue) =>
    guiFillButton({
      label: '',
      posX: x,
      posY: 680,
      radius: 180,
      edges: key === 'L' ? 8 : 6,
      speedUp: 40,
      speedDown: 20,
      activeValue: 90,
      normalColor: getRgbSpreadHex(laserConfig.testColor, hue, 0.8, 0.7),
      growColor: getRgbSpreadHex(laserConfig.testColor, hue, 0.6, 0.9),
      activeColor: getRgbSpreadHex(laserConfig.testColor, hue, 0.35, 1),
      onEnterActive: () => {
        readyFlags[key] = true;
        if (readyFlags.L && readyFlags.R) {
          resetMatch();
        }
      },
      onExitActive: () => {
        readyFlags[key] = false;
      },
    });
  startButtons = [makeButton('L', 1920 / 4, 0.35), makeButton('R', (1920 * 3) / 4, 0.65)];
}

const createButtonsGameOverScreen = () => [
  guiFillButton({
    label: '',
    posX: 1920 / 2,
    posY: 1080 - 190,
    radius: 150,
    edges: 6,
    speedUp: 25,
    speedDown: 12,
    activeValue: 90,
    normalColor: getRgbSpreadHex(laserConfig.testColor, 0.4),
    activeColor: getRgbSpreadHex(laserConfig.testColor, 0.5),
    growColor: getRgbSpreadHex(laserConfig.testColor, 0.6),
    onEnterActive: () => resetMatch(),
  }),
];

/* ---------- Zeichnen ---------- */

function renderField(ctx) {
  const lineColor = getRgbSpreadHex(laserConfig.testColor, 0.5, 0.3, 0.55);
  ctx.save();
  ctx.fillStyle = getRgbSpreadHex(laserConfig.testColor, 0.4, 0.7, 0.12);
  ctx.fillRect(FIELD.left, FIELD.top, FIELD.width, FIELD.height);
  ctx.lineWidth = 6;
  ctx.strokeStyle = lineColor;
  ctx.strokeRect(FIELD.left, FIELD.top, FIELD.width, FIELD.height);
  ctx.lineWidth = 3;
  drawLine(ctx, FIELD.centerX, FIELD.top, FIELD.centerX, FIELD.bottom, lineColor);
  ctx.beginPath();
  ctx.arc(FIELD.centerX, FIELD.centerY, 130, 0, Math.PI * 2);
  ctx.stroke();
  // Strafräume
  const boxH = DIFFICULTY.goalHeight + 160;
  ctx.strokeRect(FIELD.left, FIELD.centerY - boxH / 2, 170, boxH);
  ctx.strokeRect(FIELD.right - 170, FIELD.centerY - boxH / 2, 170, boxH);
  ctx.restore();

  // Tore in der Farbe des verteidigenden Teams
  ['left', 'right'].forEach((side) => {
    const team = teamOfSide(side);
    const depth = 70;
    const x = side === 'left' ? FIELD.left - depth : FIELD.right;
    ctx.save();
    ctx.fillStyle = team.darkColor;
    ctx.fillRect(x, FIELD.centerY - DIFFICULTY.goalHeight / 2, depth, DIFFICULTY.goalHeight);
    ctx.lineWidth = 8;
    ctx.strokeStyle = team.color;
    ctx.strokeRect(x, FIELD.centerY - DIFFICULTY.goalHeight / 2, depth, DIFFICULTY.goalHeight);
    ctx.restore();
  });
}

function renderRods(ctx) {
  rods.forEach((rod) => {
    const team = teamOfRod(rod);
    const dir = attackDir(rod);
    ctx.save();
    ctx.lineWidth = 8;
    ctx.globalAlpha = 0.5;
    drawLine(ctx, rod.x, FIELD.top - 30, rod.x, FIELD.bottom + 20, team.darkColor);
    ctx.restore();

    rod.figures.forEach((figure) => {
      const x = figure.getX();
      const y = figure.getY();
      const r = figure.getRadius();
      drawNgon({
        ctx,
        numberOfSides: team.edges,
        size: r,
        Xcenter: x,
        Ycenter: y,
        color: team.darkColor,
        lineWidth: 6,
        filled: true,
      });
      drawNgon({
        ctx,
        numberOfSides: team.edges,
        size: r,
        Xcenter: x,
        Ycenter: y,
        color: figure.getIsCurrentlyHavingMoreThanZeroLaserPointersDetected() ? team.lightColor : team.color,
        lineWidth: 6,
      });
      // Fuss zeigt die Schussrichtung
      drawNgon({
        ctx,
        numberOfSides: 3,
        size: r * 0.45,
        Xcenter: x + dir * r * 0.35,
        Ycenter: y,
        angle: dir === 1 ? 0 : Math.PI,
        color: team.lightColor,
        lineWidth: 3,
        filled: true,
      });
    });
  });
}

function renderBall(ctx) {
  const color = getRgbSpreadHex(laserConfig.testColor, 0.5, 0.08, 1);
  ctx.save();
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.arc(ball.x, ball.y, DIFFICULTY.ballRadius, 0, Math.PI * 2);
  ctx.fill();
  ctx.lineWidth = 4;
  ctx.strokeStyle = getRgbSpreadHex(laserConfig.testColor, 0.5, 0.2, 0.4);
  ctx.stroke();
  ctx.restore();
  // Warnung kurz vor dem Einwurf
  if (phase === 'running' && stillTimer > DIFFICULTY.stillTime - 2) {
    util.renderTextDropShadow({
      ctx,
      text: `Einwurf in ${Math.ceil(DIFFICULTY.stillTime - stillTimer)}`,
      fontSize: '40px',
      dropDistX: 3,
      dropDistY: 3,
      fillStyle: color,
      x: ball.x,
      y: ball.y - 50,
    });
  }
}

function renderHud(ctx) {
  const leftTeam = teamOfSide('left');
  const rightTeam = teamOfSide('right');
  util.renderTextDropShadow({
    ctx,
    text: `${leftTeam.goals} : ${rightTeam.goals}`,
    fontSize: '60px',
    dropDistX: 4,
    dropDistY: 4,
    fillStyle: getRgbSpreadHex(laserConfig.testColor, 0.5, 0.2, 1),
    x: 1920 / 2,
    y: 70,
  });
  util.renderTextDropShadow({
    ctx,
    text: `Team ${leftTeam.name}  (${leftTeam.sets})`,
    fontSize: '45px',
    dropDistX: 4,
    dropDistY: 4,
    align: 'right',
    fillStyle: leftTeam.color,
    x: 1920 / 2 - 110,
    y: 68,
  });
  util.renderTextDropShadow({
    ctx,
    text: `(${rightTeam.sets})  Team ${rightTeam.name}`,
    fontSize: '45px',
    dropDistX: 4,
    dropDistY: 4,
    align: 'left',
    fillStyle: rightTeam.color,
    x: 1920 / 2 + 110,
    y: 68,
  });
  util.renderTextDropShadow({
    ctx,
    text: `Satz ${setNumber} - bis ${DIFFICULTY.goalsPerSet} Tore - Best of ${DIFFICULTY.setsToWin * 2 - 1} - ${formatTime(
      matchTime
    )}`,
    fontSize: '32px',
    dropDistX: 3,
    dropDistY: 3,
    fillStyle: getRgbSpreadHex(laserConfig.testColor, 0.3),
    x: 1920 / 2,
    y: 120,
  });
}

function renderFloatingTexts(ctx, elapsed) {
  for (let i = floatingTexts.length - 1; i >= 0; i--) {
    const t = floatingTexts[i];
    t.time += elapsed;
    if (t.time >= t.duration) {
      floatingTexts.splice(i, 1);
      continue;
    }
    util.renderTextDropShadow({
      ctx,
      text: t.text,
      fontSize: `${t.fontSize}px`,
      dropDistX: 3,
      dropDistY: 3,
      fillStyle: t.color,
      x: t.x,
      y: t.y - t.time * 50,
    });
  }
}

function formatTime(seconds) {
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s < 10 ? '0' : ''}${s}`;
}

function toKmh(speed) {
  return (speed * DIFFICULTY.kmhPerPxPerSecond).toFixed(0);
}

export default {
  name: 'Laser-Kicker',
  description: `
Willkommen beim Laser-Kicker!

Die linke Hälfte des Publikums (Team Links) spielt gegen die rechte (Team Rechts).
Wie beim Tischkicker gibt es 8 Stangen: Torwart, Abwehr, Mittelfeld und Sturm für jedes Team.
Leuchtet mit dem Laser auf eine Figur: sie folgt eurem Punkt nach oben oder unten,
und die ganze Stange bewegt sich mit. Eine schnelle Bewegung gibt einen kräftigen Schuss!
Schiesst den Ball ins gegnerische Tor: Team Links spielt nach rechts, Team Rechts nach links.

Achtung: Jeder Laser kann JEDE Figur bewegen – auch die des Gegners. Stören ist erlaubt!
Zwei Laser auf derselben Stange in verschiedene Richtungen heben sich auf.

Ein Satz geht bis ${DIFFICULTY.goalsPerSet} Tore, gespielt wird Best of ${DIFFICULTY.setsToWin * 2 - 1} Sätze.
Nach jedem Satz gibt es eine Pause mit Zwischenstand, und der Ball wird schneller.
Anstoss hat immer das Team, das das Tor kassiert hat.
Liegt der Ball zu lange still, gibt es einen Einwurf von der Mitte.

Tipp: Teilt euch auf! Pro Stange ein, zwei Leute, die nur diese Stange spielen –
dann gibt es keinen Laser-Salat und der Torwart ist nie allein.`,
  image: 'media/img/gametitles/laser-pong-###4###.png',

  init: function () {
    gameState = 'start';
    lastTime = 0;
    floatingTexts = [];
    createTeams();
    createStartButtons();
    buttonsGameOverScreen = createButtonsGameOverScreen();
  },

  stop: function () {
    stopAllSounds();
  },

  handle: function (grid) {
    const elapsed = getDelta();
    switch (gameState) {
      case 'start':
        this.handleStartScreen(grid, elapsed);
        break;
      case 'play':
        this.handleGameScreen(grid, elapsed);
        break;
      case 'gameover':
        this.handleGameOverScreen(grid, elapsed);
        break;
    }
  },

  handleStartScreen(grid, elapsed) {
    const ctx = MasterCanvas.get2dContext();
    util.renderTextDropShadow({
      ctx,
      text: 'Laser-Kicker',
      fontSize: '150px',
      fillStyle: getRgbSpreadHex(laserConfig.testColor, 0.4),
      x: 1920 / 2,
      y: 200,
    });
    util.renderTextDropShadow({
      ctx,
      text: 'Linke Hälfte gegen rechte Hälfte!\nBeide Teams füllen ihren Bereit-Button, dann geht es los.',
      fontSize: '45px',
      lineHeight: 65,
      dropDistX: 5,
      dropDistY: 5,
      fillStyle: getRgbSpreadHex(laserConfig.testColor, 0.5),
      x: 1920 / 2,
      y: 320,
    });
    startButtons.slice().forEach((button) => button.handle(grid, elapsed));
    if (gameState !== 'start') return; // beide bereit -> Match läuft schon

    [
      { team: teams.L, x: 1920 / 4 },
      { team: teams.R, x: (1920 * 3) / 4 },
    ].forEach(({ team, x }) => {
      const ready = readyFlags[team.key];
      util.renderTextDropShadow({
        ctx,
        text: `Team ${team.name}`,
        fontSize: '60px',
        dropDistX: 5,
        dropDistY: 5,
        fillStyle: team.color,
        x,
        y: 470,
      });
      util.renderTextDropShadow({
        ctx,
        text: ready ? 'Bereit!' : 'Hier leuchten',
        fontSize: '45px',
        dropDistX: 4,
        dropDistY: 4,
        fillStyle: ready ? team.lightColor : team.color,
        x,
        y: 695,
      });
    });
    util.renderTextDropShadow({
      ctx,
      text: 'Leertaste: sofort starten - W/S und Pfeil hoch/runter steuern die Teams',
      fontSize: '32px',
      dropDistX: 3,
      dropDistY: 3,
      fillStyle: getRgbSpreadHex(laserConfig.testColor, 0.3),
      x: 1920 / 2,
      y: 1040,
    });

    if (laserConfig.pressedKeys['Space']) {
      resetMatch();
    }
  },

  handleGameScreen(grid, elapsed) {
    const ctx = MasterCanvas.get2dContext();

    if (phase === 'setbreak') {
      this.handleSetBreak(ctx, elapsed);
      return;
    }

    matchTime += elapsed;
    renderField(ctx);
    rods.forEach((rod) => updateRod(rod, grid, elapsed));

    if (phase === 'kickoff') {
      placeBallAtKickoffRod();
      phaseTimer -= elapsed;
      if (phaseTimer <= 0) {
        phase = 'running';
        stillTimer = 0;
      }
    } else if (phase === 'running') {
      updateBall(elapsed);
    } else if (phase === 'goal') {
      phaseTimer -= elapsed;
      if (lastScorer) {
        util.renderTextDropShadow({
          ctx,
          text: `TOR für Team ${lastScorer.name}!`,
          fontSize: '120px',
          dropDistX: 8,
          dropDistY: 8,
          fillStyle: lastScorer.color,
          x: 1920 / 2,
          y: FIELD.centerY - 120,
        });
      }
      if (phaseTimer <= 0) {
        afterGoalPause();
        if (gameState !== 'play') return;
      }
    }

    renderRods(ctx);
    if (phase !== 'goal' && phase !== 'setbreak') {
      renderBall(ctx);
    }
    renderFloatingTexts(ctx, elapsed);
    renderHud(ctx);
  },

  handleSetBreak(ctx, elapsed) {
    matchTime += elapsed;
    phaseTimer -= elapsed;
    const winner = lastSetWinner;
    util.renderTextDropShadow({
      ctx,
      text: `Satz ${setNumber} an Team ${winner.name}!`,
      fontSize: '100px',
      dropDistX: 6,
      dropDistY: 6,
      fillStyle: winner.color,
      x: 1920 / 2,
      y: 220,
    });
    util.renderTextDropShadow({
      ctx,
      text: `Sätze: Links ${teams.L.sets} : ${teams.R.sets} Rechts`,
      fontSize: '90px',
      dropDistX: 6,
      dropDistY: 6,
      fillStyle: getRgbSpreadHex(laserConfig.testColor, 0.5, 0.2, 1),
      x: 1920 / 2,
      y: 400,
    });
    util.renderTextDropShadow({
      ctx,
      text: `Team Links: ${teams.L.totalGoals} Tore insgesamt
Team Rechts: ${teams.R.totalGoals} Tore insgesamt
Spielzeit ${formatTime(matchTime)}`,
      fontSize: '45px',
      lineHeight: 65,
      dropDistX: 4,
      dropDistY: 4,
      fillStyle: getRgbSpreadHex(laserConfig.testColor, 0.5),
      x: 1920 / 2,
      y: 540,
    });
    util.renderTextDropShadow({
      ctx,
      text: `${DIFFICULTY.swapSides ? 'Seitenwechsel! ' : ''}Satz ${setNumber + 1} startet in ${Math.ceil(
        Math.max(0, phaseTimer)
      )} - der Ball wird schneller!`,
      fontSize: '50px',
      dropDistX: 4,
      dropDistY: 4,
      fillStyle: getRgbSpreadHex(laserConfig.testColor, 0.3),
      x: 1920 / 2,
      y: 820,
    });
    if (phaseTimer <= 0) {
      nextSet();
    }
  },

  handleGameOverScreen(grid, elapsed) {
    const ctx = MasterCanvas.get2dContext();
    gameOverTime += elapsed;
    buttonsGameOverScreen.forEach((item) => item.handle(grid, elapsed));
    if (gameState !== 'gameover') return;

    util.renderTextDropShadow({
      ctx,
      text: 'Laser-Kicker',
      fontSize: '100px',
      fillStyle: getRgbSpreadHex(laserConfig.testColor, 0.4),
      x: 1920 / 2,
      y: 130,
    });
    if (matchWinner) {
      util.renderTextDropShadow({
        ctx,
        text: `Team ${matchWinner.name} gewinnt!`,
        fontSize: '130px',
        dropDistX: 8,
        dropDistY: 8,
        fillStyle: matchWinner.color,
        x: 1920 / 2,
        y: 290,
      });
      const fastest = stats.fastestShot.team
        ? `${toKmh(stats.fastestShot.speed)} km/h (Team ${stats.fastestShot.team.name})`
        : '-';
      util.renderTextDropShadow({
        ctx,
        text: `Sätze: Links ${teams.L.sets} - Rechts ${teams.R.sets}
Tore: Links ${teams.L.totalGoals} - Rechts ${teams.R.totalGoals}
Längster Ballwechsel: ${stats.longestRally.contacts} Ballkontakte (${stats.longestRally.time.toFixed(1)}s)
Schnellster Schuss: ${fastest}
Spieldauer: ${formatTime(matchTime)} - Einwürfe: ${stats.einwuerfe}`,
        fontSize: '45px',
        lineHeight: 65,
        dropDistX: 4,
        dropDistY: 4,
        fillStyle: getRgbSpreadHex(laserConfig.testColor, 0.5),
        x: 1920 / 2,
        y: 400,
      });
    }
    util.renderTextDropShadow({
      ctx,
      text: 'Revanche?',
      fontSize: '50px',
      dropDistX: 4,
      dropDistY: 4,
      fillStyle: getRgbSpreadHex(laserConfig.testColor, 0.4),
      x: 1920 / 2,
      y: 1080 - 360,
    });

    // Leertaste erst nach kurzer Zeit, damit niemand versehentlich sofort neu startet
    if (gameOverTime > 2 && laserConfig.pressedKeys['Space']) {
      resetMatch();
    }
  },
};
