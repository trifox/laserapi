/**
 * Laser-Leuchtturm
 *
 * Nachts auf See. Das Publikum ist der Leuchtturm:
 * - Schiffe tauchen am rechten Rand auf und folgen dem Laserlicht (gui/followCircle, follow = true).
 * - Ohne Licht treiben sie mit der Strömung langsam nach links (eigene Drift per Handle-Wrapping).
 * - Unten links liegt der Hafen. Liegt der Mittelpunkt eines Schiffes im Hafenbecken, ist es
 *   sicher angekommen (+Punkte). Die Einfahrt ist nur von oben möglich, die Kaimauer ist hart.
 * - Felsen/Riffe (ab Level 2 auch treibende Eisberge) versenken jedes Schiff, das sie berührt.
 * - Treibt ein Schiff links aus dem Bild, ist es verloren.
 * - Gesunkene und verirrte Schiffe kosten je ein Leben, bei 0 Leben ist das Spiel vorbei.
 *
 * Mehrere Schiffe gleichzeitig: die Menge muss sich aufteilen (Teamwork).
 * Pro Level: mehr Schiffe gleichzeitig, mehr Felsen, stärkere Strömung.
 *
 * Alle Stellschrauben stehen gesammelt in DIFFICULTY.
 */

import util, { drawNgon, getRgbSpreadHex, removeItemFromArray } from '../util.js';
var laserConfig = require('../LaserApiConfig.js').default;
var MasterCanvas = require('../MasterCanvas').default;
var guiFillButton = require('./gui/fillButton').default;
import guiFollowCircle from './gui/followCircle.js';
import { repellAll } from './game-017-thehorde.js';
import { drawSineLine } from './game-016b-lasersharkpool.js';
import soundHarbor from '../../../public/media/485066__javierserrat__object-falls-into-the-water.wav';
import soundSink from '../../../public/media/414346__bykgames__explosion-far.wav';
import soundShipSpawn from '../../../public/media/72218__benboncan__sonar.wav';
import soundLevelUp from '../../../public/media/opengameart/Level Up.ogg';

const DIFFICULTY = {
  lives: 5,
  // Schiffe (Geschwindigkeiten in followCircle-Einheiten: 0.1 = 100 px/s)
  shipRadius: 55,
  shipScanFactor: 2.2, // so weit (Vielfaches des Radius) sieht ein Schiff das Licht
  shipFollowRate: 0.08, // followCircle speedUp: wie schnell ein Schiff aufs Licht reagiert
  shipMaxSpeed: 0.3,
  driftResponse: 1.5, // pro Sekunde: wie schnell die Strömung ein unbeleuchtetes Schiff übernimmt
  // Strömung nach links. Achtung: followCircle bewegt sich nur jeden zweiten Frame,
  // effektiv also etwa halbe Geschwindigkeit (0.06 ~ 30 px/s)
  currentStart: 0.06,
  currentPerLevel: 0.015,
  currentCap: 0.14,
  currentWobble: 0.4, // Anteil der vertikalen Schwankung
  // gleichzeitige Schiffe und Spawn-Intervall (Sekunden)
  maxShipsStart: 2,
  maxShipsPerLevel: 1,
  maxShipsCap: 7,
  spawnIntervalStart: 6,
  spawnIntervalFactor: 0.9,
  spawnIntervalMin: 2.5,
  // Level-Fortschritt: so viele Schiffe müssen pro Level ankommen
  shipsPerLevelStart: 4,
  shipsPerLevelAdd: 1,
  // Felsen
  rocksStart: 3,
  rocksPerLevel: 1,
  rocksCap: 9,
  rockRadiusMin: 45,
  rockRadiusRandom: 45,
  rockGap: 30, // zusätzlicher Mindestabstand zwischen Felsen (zusätzlich zu einer Schiffsbreite)
  // Eisberge
  icebergStartLevel: 2,
  icebergsPerLevel: 1,
  icebergsCap: 4,
  icebergRadius: 60,
  icebergSpeed: 25, // px/s
  // Punkte
  pointsHarbor: 100, // mal Level
  // Kollision
  collisionFactor: 0.75, // Anteil des Schiffsradius, der bei Felsen zählt (etwas gnädig)
  repellBounce: 2,
};

// Hafenbecken unten links, Einfahrt nur von oben
const HARBOR = { x: 0, y: 780, w: 320, h: 300 };
// Felsen/Eisberge nur in diesem Bereich (rechts bleibt Platz zum Auftauchen)
const SEA_ZONE = { x0: 450, x1: 1600, y0: 90, y1: 1000 };

var ships = [];
var rocks = [];
var icebergs = [];
var pier = [];
var effects = [];
var floatingTexts = [];
var activeSounds = [];
var buttonsGameOverScreen = [];
var gameState = 'gameover';
var hasPlayed = false;
var gameTime = 0;
var level = 1;
var lives = DIFFICULTY.lives;
var score = 0;
var arrivedThisLevel = 0;
var spawnTimer = 0;
var stats = { harbor: 0, sunk: 0, lost: 0 };
var lastTime = 0;

function getDelta() {
  var currentTime = performance.now();
  if (lastTime === 0) {
    lastTime = currentTime;
    return 0;
  }
  const elapsed = (currentTime - lastTime) / 1000;
  lastTime = currentTime;
  // gegen Sprünge nach Intro/Tab-Inaktivität
  return Math.min(elapsed, 0.1);
}

function levelValue(start, perLevel, cap) {
  return Math.min(cap, start + perLevel * (level - 1));
}

function currentStrength() {
  return levelValue(DIFFICULTY.currentStart, DIFFICULTY.currentPerLevel, DIFFICULTY.currentCap);
}

function shipsNeeded() {
  return DIFFICULTY.shipsPerLevelStart + DIFFICULTY.shipsPerLevelAdd * (level - 1);
}

function playSound(src) {
  const audio = new Audio(src);
  activeSounds.push(audio);
  audio.onended = () => removeItemFromArray(activeSounds, audio);
  audio.play().catch(() => {});
}

function stopSounds() {
  activeSounds.forEach((audio) => audio.pause());
  activeSounds = [];
}

function addFloatingText(text, x, y, color) {
  floatingTexts.push({ text, x, y, time: 0, duration: 1.5, color });
}

function dist(ax, ay, bx, by) {
  const dx = ax - bx;
  const dy = ay - by;
  return Math.sqrt(dx * dx + dy * dy);
}

/** Kaimauer rechts am Hafenbecken + Leuchtturm-Sockel als feste Hindernisse */
function createPier() {
  const result = [];
  const wallX = HARBOR.x + HARBOR.w + 12;
  for (let y = HARBOR.y; y <= 1080; y += 35) {
    result.push({ x: wallX, y, r: 18 });
  }
  result.push({ x: wallX, y: HARBOR.y - 10, r: 30 }); // Leuchtturm
  return result;
}

/** Felsen zufällig verteilen: nicht zu dicht, nicht vor der Hafeneinfahrt, nicht auf Schiffen */
function createRocks() {
  const count = Math.round(levelValue(DIFFICULTY.rocksStart, DIFFICULTY.rocksPerLevel, DIFFICULTY.rocksCap));
  const result = [];
  const harborEntranceX = HARBOR.x + HARBOR.w / 2;
  const harborEntranceY = HARBOR.y;
  for (let tries = 0; tries < 500 && result.length < count; tries++) {
    const r = DIFFICULTY.rockRadiusMin + Math.random() * DIFFICULTY.rockRadiusRandom;
    const x = SEA_ZONE.x0 + r + Math.random() * (SEA_ZONE.x1 - SEA_ZONE.x0 - 2 * r);
    const y = SEA_ZONE.y0 + r + Math.random() * (SEA_ZONE.y1 - SEA_ZONE.y0 - 2 * r);
    if (dist(x, y, harborEntranceX, harborEntranceY) < r + 300) continue;
    const tooClose = result.some(
      (o) => dist(x, y, o.x, o.y) < r + o.r + 2 * DIFFICULTY.shipRadius + DIFFICULTY.rockGap
    );
    if (tooClose) continue;
    const onShip = ships.some((s) => dist(x, y, s.getX(), s.getY()) < r + s.getRadius() + 100);
    if (onShip) continue;
    result.push({
      x,
      y,
      r,
      edges: 5 + Math.floor(Math.random() * 4),
      angle: Math.random() * Math.PI * 2,
    });
  }
  return result;
}

function createIcebergs() {
  if (level < DIFFICULTY.icebergStartLevel) return [];
  const count = Math.round(
    Math.min(
      DIFFICULTY.icebergsCap,
      DIFFICULTY.icebergsPerLevel * (level - DIFFICULTY.icebergStartLevel + 1)
    )
  );
  const result = [];
  for (let i = 0; i < count; i++) {
    const r = DIFFICULTY.icebergRadius;
    const a = Math.random() * Math.PI * 2;
    let x = SEA_ZONE.x0 + r + Math.random() * (SEA_ZONE.x1 - SEA_ZONE.x0 - 2 * r);
    let y = SEA_ZONE.y0 + r + Math.random() * (SEA_ZONE.y1 - SEA_ZONE.y0 - 2 * r);
    // nicht direkt auf einem Schiff erzeugen
    for (let tries = 0; tries < 30; tries++) {
      if (!ships.some((s) => dist(x, y, s.getX(), s.getY()) < r + s.getRadius() + 150)) break;
      x = SEA_ZONE.x0 + r + Math.random() * (SEA_ZONE.x1 - SEA_ZONE.x0 - 2 * r);
      y = SEA_ZONE.y0 + r + Math.random() * (SEA_ZONE.y1 - SEA_ZONE.y0 - 2 * r);
    }
    result.push({
      x,
      y,
      r,
      vx: Math.cos(a) * DIFFICULTY.icebergSpeed,
      vy: Math.sin(a) * DIFFICULTY.icebergSpeed,
      angle: Math.random() * Math.PI * 2,
      spin: (Math.random() - 0.5) * 0.3,
    });
  }
  return result;
}

function updateIcebergs(elapsed) {
  icebergs.forEach((ice) => {
    ice.x += ice.vx * elapsed;
    ice.y += ice.vy * elapsed;
    ice.angle += ice.spin * elapsed;
    if (ice.x < SEA_ZONE.x0 + ice.r || ice.x > SEA_ZONE.x1 + 50 - ice.r) {
      ice.vx = -ice.vx;
      ice.x = Math.max(SEA_ZONE.x0 + ice.r, Math.min(SEA_ZONE.x1 + 50 - ice.r, ice.x));
    }
    if (ice.y < SEA_ZONE.y0 + ice.r || ice.y > SEA_ZONE.y1 - ice.r) {
      ice.vy = -ice.vy;
      ice.y = Math.max(SEA_ZONE.y0 + ice.r, Math.min(SEA_ZONE.y1 - ice.r, ice.y));
    }
  });
}

function findSpawnY() {
  const r = DIFFICULTY.shipRadius;
  const x = 1920 - 100;
  let y = 120 + Math.random() * 580;
  for (let tries = 0; tries < 40; tries++) {
    y = 120 + Math.random() * 580;
    const blocked =
      ships.some((s) => dist(x, y, s.getX(), s.getY()) < 2 * r + 30) ||
      rocks.concat(icebergs).some((o) => dist(x, y, o.x, o.y) < o.r + r + 40);
    if (!blocked) return y;
  }
  return y;
}

function createShip() {
  const radius = DIFFICULTY.shipRadius;
  const phase = Math.random() * Math.PI * 2;
  const color = getRgbSpreadHex(laserConfig.testColor, 0.35, 0.6, 1);
  const lanternColor = getRgbSpreadHex(laserConfig.testColor, 0.15, 0.5, 1);
  const scanColor = getRgbSpreadHex(laserConfig.testColor, 0.5, 0.4, 0.4);

  const ship = guiFollowCircle({
    label: '',
    posX: 1920 - 100,
    posY: findSpawnY(),
    radius,
    speedUp: DIFFICULTY.shipFollowRate,
    speedDown: 0, // das Abbremsen ohne Licht übernimmt die Strömung (siehe unten)
    speedX: -currentStrength(),
    speedY: 0,
    edges: 3,
    edges2: 16,
    innerRadiusFactor: 0.35,
    scanRadiusFactor: DIFFICULTY.shipScanFactor,
    lineWidth: 5,
    normalColor: color,
    followTrueOrRepellFalse: true,
  });

  const handleOriginal = ship.handle;
  ship.handle = (grid, elapsed) => {
    // Strömung: ohne Licht wird das Schiff langsam von der Drift übernommen
    if (!ship.getIsCurrentlyHavingMoreThanZeroLaserPointersDetected()) {
      const c = currentStrength();
      const targetX = -c;
      const targetY = Math.sin(gameTime * 0.5 + phase) * c * DIFFICULTY.currentWobble;
      const k = Math.min(1, DIFFICULTY.driftResponse * elapsed);
      ship.setSpeedX(ship.getSpeedX() + (targetX - ship.getSpeedX()) * k);
      ship.setSpeedY(ship.getSpeedY() + (targetY - ship.getSpeedY()) * k);
    }

    // Höchstgeschwindigkeit begrenzen
    const sx = ship.getSpeedX();
    const sy = ship.getSpeedY();
    const speed = Math.sqrt(sx * sx + sy * sy);
    if (speed > DIFFICULTY.shipMaxSpeed) {
      ship.setSpeedX((sx / speed) * DIFFICULTY.shipMaxSpeed);
      ship.setSpeedY((sy / speed) * DIFFICULTY.shipMaxSpeed);
    }

    // Ränder oben/unten/rechts sind fest, links geht es ins Verderben
    const r = ship.getRadius();
    if (ship.getY() < r) {
      ship.setY(r);
      ship.setSpeedY(Math.max(0, ship.getSpeedY()));
    }
    if (ship.getY() > 1080 - r) {
      ship.setY(1080 - r);
      ship.setSpeedY(Math.min(0, ship.getSpeedY()));
    }
    if (ship.getX() > 1920 - r) {
      ship.setX(1920 - r);
      ship.setSpeedX(Math.min(0, ship.getSpeedX()));
    }

    // Bug zeigt in Fahrtrichtung (drawNgon dreht mit -angle)
    if (speed > 0.005) {
      ship.setAngle(-Math.atan2(sy, sx));
    }

    // Lichtfang-Bereich andeuten
    drawNgon({
      ctx: MasterCanvas.get2dContext(),
      numberOfSides: 32,
      size: r * DIFFICULTY.shipScanFactor,
      Xcenter: ship.getX(),
      Ycenter: ship.getY(),
      color: scanColor,
      lineWidth: 1,
    });

    handleOriginal(grid, elapsed);

    // Laterne leuchtet, wenn das Schiff das Licht sieht
    if (ship.getIsCurrentlyHavingMoreThanZeroLaserPointersDetected()) {
      drawNgon({
        ctx: MasterCanvas.get2dContext(),
        numberOfSides: 12,
        size: 12,
        Xcenter: ship.getX(),
        Ycenter: ship.getY(),
        color: lanternColor,
        filled: true,
      });
    }
  };
  return ship;
}

function addExplosion(x, y) {
  effects.push({ x, y, time: 0, duration: 1.2 });
}

function loseLife() {
  lives--;
  if (lives <= 0) {
    lives = 0;
    gameState = 'gameover';
    buttonsGameOverScreen = createButtonsGameOverScreen();
  }
}

function nextLevel() {
  level++;
  arrivedThisLevel = 0;
  rocks = createRocks();
  icebergs = createIcebergs();
  addFloatingText(`Level ${level}`, 1920 / 2, 400, getRgbSpreadHex(laserConfig.testColor, 0.4));
  playSound(soundLevelUp);
}

/** Hafen, Felsen, linker Rand */
function checkShips() {
  const obstacles = rocks.concat(icebergs, pier);
  ships.slice().forEach((ship) => {
    if (gameState !== 'game') return;
    const x = ship.getX();
    const y = ship.getY();
    const r = ship.getRadius();
    if (x >= HARBOR.x && x <= HARBOR.x + HARBOR.w && y >= HARBOR.y && y <= HARBOR.y + HARBOR.h) {
      removeItemFromArray(ships, ship);
      const points = DIFFICULTY.pointsHarbor * level;
      score += points;
      stats.harbor++;
      arrivedThisLevel++;
      addFloatingText(`+${points}`, x, y - 60, getRgbSpreadHex(laserConfig.testColor, 0.3, 0.8, 1));
      playSound(soundHarbor);
      if (arrivedThisLevel >= shipsNeeded()) {
        nextLevel();
      }
      return;
    }
    if (x < -r) {
      removeItemFromArray(ships, ship);
      stats.lost++;
      addFloatingText('verirrt!', 150, Math.max(100, Math.min(700, y)), '#ffffff');
      loseLife();
      return;
    }
    const hit = obstacles.some((o) => dist(x, y, o.x, o.y) < r * DIFFICULTY.collisionFactor + o.r);
    if (hit) {
      removeItemFromArray(ships, ship);
      stats.sunk++;
      addExplosion(x, y);
      addFloatingText('gesunken!', x, y - 60, '#ffffff');
      playSound(soundSink);
      loseLife();
    }
  });
}

function resetGame() {
  gameState = 'game';
  hasPlayed = true;
  gameTime = 0;
  level = 1;
  lives = DIFFICULTY.lives;
  score = 0;
  arrivedThisLevel = 0;
  spawnTimer = DIFFICULTY.spawnIntervalStart; // erstes Schiff sofort
  ships = [];
  effects = [];
  floatingTexts = [];
  stats = { harbor: 0, sunk: 0, lost: 0 };
  pier = createPier();
  rocks = createRocks();
  icebergs = createIcebergs();
  lastTime = performance.now();
}

const createButtonsGameOverScreen = () => [
  guiFillButton({
    label: 'Leinen los!',
    posX: 1920 / 2,
    posY: 1080 / 2 + 230,
    radius: 180,
    edges: 6,
    speedUp: 25,
    speedDown: 12,
    activeValue: 90,
    normalColor: getRgbSpreadHex(laserConfig.testColor, 0.4),
    activeColor: getRgbSpreadHex(laserConfig.testColor, 0.5),
    growColor: getRgbSpreadHex(laserConfig.testColor, 0.6),
    onEnterActive: () => resetGame(),
  }),
  // unsichtbarer Zwilling: per Leertaste startbar (fillButton mit keyCode reagiert nicht auf Laser)
  guiFillButton({
    label: '',
    posX: 1920 / 2,
    posY: 1080 / 2 + 230,
    radius: 180,
    keyCode: 'Space',
    visible: false,
    onEnterActive: () => resetGame(),
  }),
];

function renderSea(ctx) {
  for (let i = 0; i < 6; i++) {
    drawSineLine({
      ctx,
      yLevel: 120 + i * 170,
      width: 2 + i * 0.5,
      amplitude: 25,
      color: getRgbSpreadHex(laserConfig.testColor, 0.55, 0.6, 0.25 + i * 0.03),
      t: gameTime * 0.25 + i * 1.7,
      lineWidth: 2,
    });
  }
}

function renderHarbor(ctx) {
  ctx.save();
  ctx.fillStyle = getRgbSpreadHex(laserConfig.testColor, 0.55, 0.5, 0.2);
  ctx.fillRect(HARBOR.x, HARBOR.y, HARBOR.w, HARBOR.h);
  // Kaimauer
  ctx.fillStyle = getRgbSpreadHex(laserConfig.testColor, 0.1, 0.2, 0.45);
  ctx.fillRect(HARBOR.x + HARBOR.w, HARBOR.y, 25, HARBOR.h);
  // Einfahrt gestrichelt
  ctx.setLineDash([20, 15]);
  ctx.lineWidth = 3;
  ctx.strokeStyle = getRgbSpreadHex(laserConfig.testColor, 0.3, 0.6, 0.8);
  ctx.beginPath();
  ctx.moveTo(HARBOR.x, HARBOR.y);
  ctx.lineTo(HARBOR.x + HARBOR.w, HARBOR.y);
  ctx.stroke();
  ctx.restore();

  // Leuchtturm auf der Mole mit kreisendem Lichtkegel (nur Deko)
  const lx = HARBOR.x + HARBOR.w + 12;
  const ly = HARBOR.y - 10;
  const beamAngle = gameTime * 0.8;
  ctx.save();
  ctx.globalAlpha = 0.12;
  ctx.fillStyle = getRgbSpreadHex(laserConfig.testColor, 0.15, 0.4, 1);
  ctx.beginPath();
  ctx.moveTo(lx, ly);
  ctx.arc(lx, ly, 700, beamAngle - 0.12, beamAngle + 0.12);
  ctx.closePath();
  ctx.fill();
  ctx.restore();
  drawNgon({
    ctx,
    numberOfSides: 4,
    size: 30,
    Xcenter: lx,
    Ycenter: ly,
    color: getRgbSpreadHex(laserConfig.testColor, 0.1, 0.3, 0.9),
    lineWidth: 5,
    angle: Math.PI / 4,
  });
  drawNgon({
    ctx,
    numberOfSides: 12,
    size: 12,
    Xcenter: lx,
    Ycenter: ly,
    color: getRgbSpreadHex(laserConfig.testColor, 0.15, 0.5, 1),
    filled: true,
  });

  util.renderTextDropShadow({
    ctx,
    text: 'Hafen',
    fontSize: '45px',
    dropDistX: 3,
    dropDistY: 3,
    fillStyle: getRgbSpreadHex(laserConfig.testColor, 0.3, 0.6, 0.9),
    x: HARBOR.x + HARBOR.w / 2,
    y: HARBOR.y + HARBOR.h / 2 + 15,
  });
}

function renderObstacles(ctx) {
  rocks.forEach((rock) => {
    drawNgon({
      ctx,
      numberOfSides: rock.edges,
      size: rock.r,
      Xcenter: rock.x,
      Ycenter: rock.y,
      angle: rock.angle,
      color: getRgbSpreadHex(laserConfig.testColor, 0.1, 0.25, 0.35),
      filled: true,
    });
    drawNgon({
      ctx,
      numberOfSides: rock.edges,
      size: rock.r,
      Xcenter: rock.x,
      Ycenter: rock.y,
      angle: rock.angle,
      color: getRgbSpreadHex(laserConfig.testColor, 0.1, 0.3, 0.75),
      lineWidth: 4,
    });
    // Brandung
    drawNgon({
      ctx,
      numberOfSides: 24,
      size: rock.r + 12 + Math.sin(gameTime * 2 + rock.x) * 4,
      Xcenter: rock.x,
      Ycenter: rock.y,
      color: getRgbSpreadHex(laserConfig.testColor, 0.55, 0.3, 0.6),
      lineWidth: 1,
    });
  });
  icebergs.forEach((ice) => {
    drawNgon({
      ctx,
      numberOfSides: 6,
      size: ice.r,
      Xcenter: ice.x,
      Ycenter: ice.y,
      angle: ice.angle,
      color: getRgbSpreadHex(laserConfig.testColor, 0.55, 0.3, 0.35),
      filled: true,
    });
    drawNgon({
      ctx,
      numberOfSides: 6,
      size: ice.r,
      Xcenter: ice.x,
      Ycenter: ice.y,
      angle: ice.angle,
      color: getRgbSpreadHex(laserConfig.testColor, 0.55, 0.2, 1),
      lineWidth: 4,
    });
  });
}

function renderEffects(ctx, elapsed) {
  for (let i = effects.length - 1; i >= 0; i--) {
    const e = effects[i];
    e.time += elapsed;
    if (e.time >= e.duration) {
      effects.splice(i, 1);
      continue;
    }
    const p = e.time / e.duration;
    for (let k = 0; k < 3; k++) {
      drawNgon({
        ctx,
        numberOfSides: 10,
        size: 20 + p * (120 + k * 40),
        Xcenter: e.x,
        Ycenter: e.y,
        angle: k + p,
        color: getRgbSpreadHex(laserConfig.testColor, 0.2 + k * 0.05, 0.8, 1 - p),
        lineWidth: 4,
      });
    }
  }
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
      fontSize: '45px',
      dropDistX: 3,
      dropDistY: 3,
      fillStyle: t.color,
      x: t.x,
      y: t.y - t.time * 60,
    });
  }
}

export default {
  name: 'Hafen Lotse ',
  description: `

  Schiffe tauchen rechts auf
und fahren eurem Laserlicht hinterher.

Lotst jedes Schiff unten links in den Hafen
die Einfahrt ist nur von oben.

Treibt ein Schiff links aus dem Bild 
ist es verloren
`,
  image: 'media/img/gametitles/laser-torpedo-###4###.png',
  init: function () {
    gameState = 'gameover';
    hasPlayed = false;
    lastTime = 0;
    ships = [];
    effects = [];
    floatingTexts = [];
    buttonsGameOverScreen = createButtonsGameOverScreen();
  },
  stop: function () {
    stopSounds();
  },
  handle: function (grid) {
    const elapsed = getDelta();
    switch (gameState) {
      case 'game':
        this.handleGameScreen(grid, elapsed);
        break;
      case 'gameover':
        this.handleGameOverScreen(grid, elapsed);
        break;
    }
  },

  handleGameOverScreen(grid, elapsed) {
    const ctx = MasterCanvas.get2dContext();
    gameTime += elapsed;
    renderSea(ctx);
    buttonsGameOverScreen.forEach((item) => item.handle(grid, elapsed));
    util.renderTextDropShadow({
      ctx,
      text: 'Laser-Leuchtturm',
      fontSize: '150px',
      fillStyle: getRgbSpreadHex(laserConfig.testColor, 0.4),
      x: laserConfig.canvasResolution.width / 2,
      y: 200,
    });
    const text = hasPlayed
      ? `Die Nacht ist vorbei! Level ${level} erreicht, ${score} Punkte.
${stats.harbor} Schiffe im Hafen, ${stats.sunk} gesunken, ${stats.lost} verirrt.`
      : `Lotst die Schiffe mit eurem Licht in den Hafen unten links.
Vorsicht vor Felsen und Eisbergen - teilt euch auf!`;
    util.renderTextDropShadow({
      ctx,
      text,
      fontSize: '45px',
      lineHeight: 70,
      dropDistX: 5,
      dropDistY: 5,
      fillStyle: getRgbSpreadHex(laserConfig.testColor, 0.5),
      x: laserConfig.canvasResolution.width / 2,
      y: 330,
    });
    util.renderText({
      ctx,
      text: '(Leertaste startet auch)',
      fontSize: '30px',
      fillStyle: getRgbSpreadHex(laserConfig.testColor, 0.5, 0.3, 0.6),
      x: laserConfig.canvasResolution.width / 2,
      y: 1060,
    });
  },

  handleGameScreen(grid, elapsed) {
    gameTime += elapsed;
    const ctx = MasterCanvas.get2dContext();

    // Schiffe nachschicken
    spawnTimer += elapsed;
    const maxShips = Math.round(
      levelValue(DIFFICULTY.maxShipsStart, DIFFICULTY.maxShipsPerLevel, DIFFICULTY.maxShipsCap)
    );
    const spawnInterval = Math.max(
      DIFFICULTY.spawnIntervalMin,
      DIFFICULTY.spawnIntervalStart * Math.pow(DIFFICULTY.spawnIntervalFactor, level - 1)
    );
    if (ships.length < maxShips && (spawnTimer >= spawnInterval || ships.length === 0)) {
      spawnTimer = 0;
      ships.push(createShip());
      playSound(soundShipSpawn);
    }

    updateIcebergs(elapsed);

    renderSea(ctx);
    renderHarbor(ctx);
    renderObstacles(ctx);

    // Schiffe weichen einander aus
    repellAll({
      workArray: ships,
      targetArray: ships,
      elapsed,
      bounce: DIFFICULTY.repellBounce,
    });
    ships.slice().forEach((ship) => ship.handle(grid, elapsed));
    checkShips();

    renderEffects(ctx, elapsed);

    util.renderTextDropShadow({
      ctx,
      text: `Level ${level} - ${score} Punkte - Leben ${lives}`,
      fontSize: '50px',
      fillStyle: getRgbSpreadHex(laserConfig.testColor, 0.3),
      align: 'left',
      x: 100,
      y: 70,
    });
    util.renderTextDropShadow({
      ctx,
      text: `Hafen ${arrivedThisLevel}/${shipsNeeded()}`,
      fontSize: '50px',
      fillStyle: getRgbSpreadHex(laserConfig.testColor, 0.3),
      align: 'right',
      x: 1920 - 100,
      y: 70,
    });
  },
};
