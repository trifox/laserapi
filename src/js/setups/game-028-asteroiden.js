/**
 * Laser-Asteroiden
 *
 * Ein Planet in der Bildschirmmitte wird von Asteroiden aus allen Richtungen angeflogen.
 * - Asteroiden (gui/pixelFillButton) werden per Laser abgeschossen. Gemessen wird der beleuchtete
 *   Flächenanteil: grosse Brocken brauchen mehrere Laser gleichzeitig (Teamwork).
 * - Grosse Asteroiden zerbrechen in 2-3 mittlere, mittlere in 2 kleine, kleine verschwinden.
 * - Trifft ein Asteroid den Planeten, sinkt der Schild proportional zur Asteroidengrösse.
 * - Satelliten kreisen auf einer Umlaufbahn um den Planeten. Jeder kreisende Satellit lädt den
 *   Schild langsam wieder auf. Wer einen Satelliten abschiesst, kostet Schild, und der Satellit ist weg.
 *   Wildes Herumleuchten lohnt sich also nicht.
 * - Alle DIFFICULTY.levelDuration Sekunden steigt das Level: mehr, schnellere und grössere Asteroiden.
 *   Alle 2 Level kommt ein neuer Satellit dazu.
 * - Schild 0 % = Game Over. Statistik: zerstörte Asteroiden je Grösse, verlorene Satelliten, Zeit.
 *
 * Tastatur zum Testen ohne Laser: D zerstört den Asteroiden, der dem Planeten am nächsten ist.
 *
 * Alle Stellschrauben stehen gesammelt in DIFFICULTY.
 */

import util, { drawNgon, getRgbSpreadHex, removeItemFromArray } from '../util.js';
var laserConfig = require('../LaserApiConfig.js').default;
var MasterCanvas = require('../MasterCanvas').default;
var guiFillButton = require('./gui/fillButton').default;
var guiPixelFillButton = require('./gui/pixelFillButton').default;
import soundPlop from '../../../public/media/369952__mischy__plop-1.wav';
import soundExplosion from '../../../public/media/414346__bykgames__explosion-far.wav';
import soundLevelUp from '../../../public/media/opengameart/Level Up.ogg';
import soundError from '../../../public/media/opengameart/Menu Error.ogg';

const DIFFICULTY = {
  levelDuration: 20, // Sekunden pro Level
  // Spawns
  spawnIntervalStart: 2.4, // Sekunden
  spawnIntervalFactor: 0.85, // pro Level
  spawnIntervalMin: 0.5,
  maxActiveStart: 4, // gleichzeitig fliegende Asteroiden
  maxActivePerLevel: 2,
  maxActiveCap: 22,
  // Grössenverteilung beim Spawnen (Rest = klein)
  bigProbStart: 0.3,
  bigProbPerLevel: 0.05,
  bigProbCap: 0.65,
  mediumProb: 0.35,
  // Geschwindigkeit in px/s je Grösse, mal Level-Faktor
  speedFactorPerLevel: 0.12,
  speedFactorCap: 2.5,
  steering: 0.8, // wie schnell Bruchstücke wieder auf den Planeten einschwenken (pro s)
  // Trefferzeit in Sekunden bei voller Bedeckung (hitFullPercent der Fläche leuchtet)
  hitFullPercent: 20,
  hitDecay: 0.8, // Trefferfortschritt-Abbau pro Sekunde ohne Treffer (1 = komplett)
  // Schild in Prozent
  impactDamagePerRadius: 0.15, // Schaden = Radius * Faktor (gross 18, mittel ~11, klein 7.5)
  satelliteShotPenalty: 15,
  satelliteRegenPerSecond: 0.6, // pro kreisendem Satellit
  // Satelliten
  satellitesStart: 2,
  satelliteEveryLevels: 2,
  satellitesMax: 6,
  satelliteRadius: 55,
  satelliteHitTime: 0.7, // zäher als Asteroiden, damit kurzes Drüberwischen nicht gleich zerstört
  orbitRadius: 290,
  orbitSpeed: 0.25, // rad/s
};

// Grössenklassen der Asteroiden
const SIZES = {
  gross: { radius: 120, speed: 55, hitTime: 0.6, label: 'grosse' },
  mittel: { radius: 75, speed: 75, hitTime: 0.45, label: 'mittlere' },
  klein: { radius: 50, speed: 95, hitTime: 0.3, label: 'kleine' },
};

const PLANET = { x: 1920 / 2, y: 1080 / 2, radius: 75 };

var lastTime = 0;
var gameState = 'gameover';
var gameTime = 0;
var level = 1;
var shield = 100;
var spawnTimer = 0;
var asteroids = [];
var satellites = [];
var floatingTexts = [];
var booms = [];
var stars = [];
var planetHitTimer = 0;
var buttonsGameOverScreen = [];
var hasPlayed = false;
var stats = { gross: 0, mittel: 0, klein: 0, satellitesLost: 0, impacts: 0 };
var prevKeys = {};
var runningSounds = [];

function getDelta() {
  var currentTime = performance.now();
  if (lastTime === 0) {
    lastTime = currentTime;
    return 0;
  }
  const elapsed = (currentTime - lastTime) / 1000;
  lastTime = currentTime;
  return Math.min(elapsed, 0.1);
}

function levelValue(start, perLevel, cap) {
  return Math.min(cap, start + perLevel * (level - 1));
}

function playSound(src) {
  const audio = new Audio(src);
  runningSounds.push(audio);
  audio.onended = () => {
    const idx = runningSounds.indexOf(audio);
    if (idx >= 0) runningSounds.splice(idx, 1);
  };
  audio.play().catch(() => {});
}

function addFloatingText(text, x, y, color) {
  floatingTexts.push({ text, x, y, time: 0, duration: 1.5, color });
}

function addBoom(x, y, radius, color) {
  booms.push({ x, y, radius, color, time: 0, duration: 0.5 });
}

function changeShield(delta) {
  shield = Math.max(0, Math.min(100, shield + delta));
  if (shield <= 0 && gameState === 'game') {
    gameState = 'gameover';
    hasPlayed = true;
    buttonsGameOverScreen = createButtonsGameOverScreen();
  }
}

function createStars() {
  const result = [];
  for (let i = 0; i < 140; i++) {
    result.push({
      x: Math.random() * 1920,
      y: Math.random() * 1080,
      size: Math.random() < 0.15 ? 3 : 2,
    });
  }
  return result;
}

/**
 * Asteroid der Grösse sizeKey an Position (x, y) mit Startgeschwindigkeit (vx, vy).
 * Bruchstücke starten mit gespreizter Geschwindigkeit und schwenken über steering
 * wieder auf den Planeten ein.
 */
function createAsteroid(sizeKey, x, y, vx, vy) {
  const size = SIZES[sizeKey];
  const radius = size.radius;
  const speed =
    size.speed * levelValue(1, DIFFICULTY.speedFactorPerLevel, DIFFICULTY.speedFactorCap);
  const edges = 5 + Math.floor(Math.random() * 5); // 5..9
  // unregelmässiger Umriss: pro Ecke ein Radius-Faktor
  const bumps = [];
  for (let k = 0; k < edges; k++) bumps.push(0.72 + Math.random() * 0.33);
  const rotSpeed = (Math.random() - 0.5) * 2.0; // rad/s
  let angle = Math.random() * Math.PI * 2;
  let velX = vx;
  let velY = vy;
  const rockFill = getRgbSpreadHex(laserConfig.testColor, 0.52, 0.35, 0.22);
  const rockLine = getRgbSpreadHex(laserConfig.testColor, 0.52, 0.45, 0.75);
  const hitColor = getRgbSpreadHex(laserConfig.testColor, 0.45, 0.8, 1);

  const asteroid = guiPixelFillButton({
    label: '',
    posX: x,
    posY: y,
    radius,
    edges,
    angle,
    lineWidth: 2,
    fullPercent: DIFFICULTY.hitFullPercent,
    speedUp: 100 / size.hitTime,
    speedDown: 100 * DIFFICULTY.hitDecay,
    minValue: 0,
    activeValue: 99,
    normalColor: getRgbSpreadHex(laserConfig.testColor, 0.12, 0.3, 0.4),
    growColor: hitColor,
    activeColor: hitColor,
    onEnterActive: () => destroy(),
  });

  function destroy() {
    if (asteroids.indexOf(asteroid) < 0) return;
    removeItemFromArray(asteroids, asteroid);
    stats[sizeKey]++;
    const ax = asteroid.getX();
    const ay = asteroid.getY();
    addBoom(ax, ay, radius, hitColor);
    playSound(soundPlop);
    // zerbrechen: gross -> 2-3 mittel, mittel -> 2 klein, klein -> weg
    const childKey = sizeKey === 'gross' ? 'mittel' : sizeKey === 'mittel' ? 'klein' : undefined;
    if (!childKey) return;
    const count = sizeKey === 'gross' ? 2 + Math.floor(Math.random() * 2) : 2;
    const baseDir = Math.atan2(velY, velX);
    const childSpeed = SIZES[childKey].speed * 1.3;
    for (let c = 0; c < count; c++) {
      // Bruchstücke fächern seitlich auf
      const spread = (c - (count - 1) / 2) * 1.2 + (Math.random() - 0.5) * 0.4;
      const dir = baseDir + spread;
      asteroids.push(
        createAsteroid(
          childKey,
          ax + Math.cos(dir) * radius * 0.5,
          ay + Math.sin(dir) * radius * 0.5,
          Math.cos(dir) * childSpeed,
          Math.sin(dir) * childSpeed
        )
      );
    }
  }
  asteroid.destroy = destroy;
  asteroid.sizeKey = sizeKey;

  const handleOriginal = asteroid.handle;
  asteroid.handle = (grid, elapsed) => {
    let px = asteroid.getX();
    let py = asteroid.getY();
    const dx = PLANET.x - px;
    const dy = PLANET.y - py;
    const dist = Math.max(1, Math.sqrt(dx * dx + dy * dy));

    // Einschlag
    if (dist < PLANET.radius + radius * 0.6) {
      removeItemFromArray(asteroids, asteroid);
      stats.impacts++;
      planetHitTimer = 0.4;
      addBoom(px, py, radius * 1.5, '#ffffff');
      addFloatingText(
        `Schild -${Math.round(radius * DIFFICULTY.impactDamagePerRadius)}%`,
        px,
        py - 40,
        '#ffffff'
      );
      playSound(soundExplosion);
      changeShield(-radius * DIFFICULTY.impactDamagePerRadius);
      return;
    }

    // auf den Planeten zusteuern
    const desiredX = (dx / dist) * speed;
    const desiredY = (dy / dist) * speed;
    const steer = Math.min(1, DIFFICULTY.steering * elapsed);
    velX += (desiredX - velX) * steer;
    velY += (desiredY - velY) * steer;
    px += velX * elapsed;
    py += velY * elapsed;
    asteroid.setX(px);
    asteroid.setY(py);
    angle += rotSpeed * elapsed;
    asteroid.setAngle(angle);

    // unregelmässigen Felsbrocken zeichnen (gleiche Drehrichtung wie drawNgon)
    const ctx = MasterCanvas.get2dContext();
    ctx.save();
    ctx.beginPath();
    for (let k = 0; k <= edges; k++) {
      const a = -angle + (k * 2 * Math.PI) / edges;
      const r = radius * bumps[k % edges];
      const vx2 = px + Math.cos(a) * r;
      const vy2 = py + Math.sin(a) * r;
      if (k === 0) ctx.moveTo(vx2, vy2);
      else ctx.lineTo(vx2, vy2);
    }
    ctx.fillStyle = rockFill;
    ctx.fill();
    ctx.lineWidth = 4;
    ctx.strokeStyle = asteroid.getValue() > 0 ? hitColor : rockLine;
    ctx.stroke();
    ctx.restore();

    handleOriginal(grid, elapsed);
  };
  return asteroid;
}

/** spawnt einen Asteroiden knapp ausserhalb eines zufälligen Bildschirmrands */
function spawnAsteroid() {
  const bigProb = levelValue(
    DIFFICULTY.bigProbStart,
    DIFFICULTY.bigProbPerLevel,
    DIFFICULTY.bigProbCap
  );
  const r = Math.random();
  const sizeKey = r < bigProb ? 'gross' : r < bigProb + DIFFICULTY.mediumProb ? 'mittel' : 'klein';
  const radius = SIZES[sizeKey].radius;
  let x;
  let y;
  switch (Math.floor(Math.random() * 4)) {
    case 0: // oben
      x = Math.random() * 1920;
      y = -radius;
      break;
    case 1: // unten
      x = Math.random() * 1920;
      y = 1080 + radius;
      break;
    case 2: // links
      x = -radius;
      y = Math.random() * 1080;
      break;
    default: // rechts
      x = 1920 + radius;
      y = Math.random() * 1080;
      break;
  }
  const dx = PLANET.x - x;
  const dy = PLANET.y - y;
  const dist = Math.sqrt(dx * dx + dy * dy);
  const speed =
    SIZES[sizeKey].speed * levelValue(1, DIFFICULTY.speedFactorPerLevel, DIFFICULTY.speedFactorCap);
  asteroids.push(createAsteroid(sizeKey, x, y, (dx / dist) * speed, (dy / dist) * speed));
}

/** Satellit auf der Umlaufbahn: gutes Objekt, nicht abschiessen! */
function createSatellite(orbitAngle) {
  let currentOrbit = orbitAngle;
  const radius = DIFFICULTY.satelliteRadius;
  const color = getRgbSpreadHex(laserConfig.testColor, 0.3, 0.8, 0.9);
  const warnColor = '#ffffff';
  const satellite = guiPixelFillButton({
    label: '',
    posX: PLANET.x + Math.cos(currentOrbit) * DIFFICULTY.orbitRadius,
    posY: PLANET.y + Math.sin(currentOrbit) * DIFFICULTY.orbitRadius,
    radius,
    edges: 32,
    edges2: 4,
    lineWidth: 4,
    fullPercent: DIFFICULTY.hitFullPercent,
    speedUp: 100 / DIFFICULTY.satelliteHitTime,
    speedDown: 100 * DIFFICULTY.hitDecay,
    minValue: 0,
    activeValue: 99,
    normalColor: color,
    growColor: color,
    activeColor: warnColor,
    onEnterActive: () => {
      if (satellites.indexOf(satellite) < 0) return;
      removeItemFromArray(satellites, satellite);
      stats.satellitesLost++;
      addBoom(satellite.getX(), satellite.getY(), radius * 1.5, warnColor);
      addFloatingText(
        `Satellit zerstört! Schild -${DIFFICULTY.satelliteShotPenalty}%`,
        satellite.getX(),
        satellite.getY() - 70,
        warnColor
      );
      playSound(soundError);
      changeShield(-DIFFICULTY.satelliteShotPenalty);
    },
  });

  const handleOriginal = satellite.handle;
  satellite.handle = (grid, elapsed) => {
    currentOrbit += DIFFICULTY.orbitSpeed * elapsed;
    const sx = PLANET.x + Math.cos(currentOrbit) * DIFFICULTY.orbitRadius;
    const sy = PLANET.y + Math.sin(currentOrbit) * DIFFICULTY.orbitRadius;
    satellite.setX(sx);
    satellite.setY(sy);

    // blinkt weiss, sobald er beschossen wird
    const warn = satellite.getValue() > 0 && Math.floor(gameTime * 10) % 2 === 0;
    satellite.setGrowColor(warn ? warnColor : color);
    satellite.setLineWidth(warn ? 7 : 4);

    // Solarpaneele quer zur Umlaufbahn
    const ctx = MasterCanvas.get2dContext();
    ctx.save();
    ctx.translate(sx, sy);
    ctx.rotate(currentOrbit);
    ctx.strokeStyle = warn ? warnColor : color;
    ctx.lineWidth = 3;
    ctx.strokeRect(-12, -radius - 45, 24, 40);
    ctx.strokeRect(-12, radius + 5, 24, 40);
    ctx.restore();

    handleOriginal(grid, elapsed);
  };
  return satellite;
}

function addSatellite() {
  if (satellites.length >= DIFFICULTY.satellitesMax) return;
  // möglichst weit weg von den vorhandenen: zufällig, aber gegenüber dem letzten
  const angle =
    satellites.length === 0
      ? Math.random() * Math.PI * 2
      : satellites[satellites.length - 1].orbitStart + Math.PI + (Math.random() - 0.5);
  const satellite = createSatellite(angle);
  satellite.orbitStart = angle;
  satellites.push(satellite);
}

function resetGame() {
  gameState = 'game';
  gameTime = 0;
  level = 1;
  shield = 100;
  spawnTimer = DIFFICULTY.spawnIntervalStart * 0.5;
  asteroids = [];
  satellites = [];
  floatingTexts = [];
  booms = [];
  planetHitTimer = 0;
  stats = { gross: 0, mittel: 0, klein: 0, satellitesLost: 0, impacts: 0 };
  prevKeys = {};
  for (let i = 0; i < DIFFICULTY.satellitesStart; i++) {
    const angle = (i * 2 * Math.PI) / DIFFICULTY.satellitesStart;
    const satellite = createSatellite(angle);
    satellite.orbitStart = angle;
    satellites.push(satellite);
  }
  lastTime = performance.now();
}

const createButtonsGameOverScreen = () => [
  guiFillButton({
    label: 'Start',
    posX: 1920 / 2,
    posY: 1080 / 2 + 250,
    radius: 180,
    edges: 7,
    speedUp: 25,
    speedDown: 12,
    activeValue: 90,
    keyCode: 'Space',
    normalColor: getRgbSpreadHex(laserConfig.testColor, 0.4),
    activeColor: getRgbSpreadHex(laserConfig.testColor, 0.5),
    growColor: getRgbSpreadHex(laserConfig.testColor, 0.6),
    onEnterActive: () => resetGame(),
  }),
];

/** Tastatur-Fallback: D zerstört den Asteroiden, der dem Planeten am nächsten ist */
function handleKeyboard() {
  const down = !!laserConfig.pressedKeys['KeyD'];
  if (down && !prevKeys.KeyD && asteroids.length > 0) {
    let nearest = asteroids[0];
    let best = Infinity;
    asteroids.forEach((a) => {
      const d = Math.hypot(a.getX() - PLANET.x, a.getY() - PLANET.y);
      if (d < best) {
        best = d;
        nearest = a;
      }
    });
    nearest.destroy();
  }
  prevKeys.KeyD = down;
}

function renderStars(ctx) {
  ctx.save();
  ctx.fillStyle = getRgbSpreadHex(laserConfig.testColor, 0.5, 0.1, 0.45);
  stars.forEach((s) => ctx.fillRect(s.x, s.y, s.size, s.size));
  ctx.restore();
}

function renderPlanet(ctx, elapsed) {
  planetHitTimer = Math.max(0, planetHitTimer - elapsed);
  // Umlaufbahn
  ctx.save();
  ctx.setLineDash([12, 18]);
  drawNgon({
    ctx,
    numberOfSides: 64,
    size: DIFFICULTY.orbitRadius,
    Xcenter: PLANET.x,
    Ycenter: PLANET.y,
    color: getRgbSpreadHex(laserConfig.testColor, 0.3, 0.4, 0.35),
    lineWidth: 2,
  });
  ctx.restore();
  // Planet
  drawNgon({
    ctx,
    numberOfSides: 14,
    size: PLANET.radius,
    Xcenter: PLANET.x,
    Ycenter: PLANET.y,
    color:
      planetHitTimer > 0
        ? getRgbSpreadHex(laserConfig.testColor, 0.6, 0.5, 0.9)
        : getRgbSpreadHex(laserConfig.testColor, 0.38, 0.6, 0.5),
    lineWidth: 4,
    filled: true,
    angle: gameTime * 0.1,
  });
  // Schild als Ring, Dicke und Helligkeit je nach Schildstärke
  if (shield > 0) {
    ctx.save();
    ctx.globalAlpha = 0.25 + 0.75 * (shield / 100);
    drawNgon({
      ctx,
      numberOfSides: 48,
      size: PLANET.radius + 30,
      Xcenter: PLANET.x,
      Ycenter: PLANET.y,
      color: getRgbSpreadHex(laserConfig.testColor, 0.5, 0.6, 1),
      lineWidth: 2 + (shield / 100) * 10,
    });
    ctx.restore();
  }
}

function renderShieldBar(ctx) {
  const w = 600;
  const h = 40;
  const x = 1920 / 2 - w / 2;
  const y = 30;
  ctx.save();
  ctx.strokeStyle = getRgbSpreadHex(laserConfig.testColor, 0.5, 0.5, 0.8);
  ctx.lineWidth = 3;
  ctx.strokeRect(x, y, w, h);
  ctx.fillStyle =
    shield > 30
      ? getRgbSpreadHex(laserConfig.testColor, 0.5, 0.6, 0.85)
      : getRgbSpreadHex(laserConfig.testColor, 0.6, 0.9, 1);
  ctx.fillRect(x, y, (w * shield) / 100, h);
  ctx.restore();
  util.renderTextDropShadow({
    ctx,
    text: `Schild ${Math.round(shield)}%`,
    fontSize: '40px',
    dropDistX: 3,
    dropDistY: 3,
    fillStyle: getRgbSpreadHex(laserConfig.testColor, 0.3, 0.6, 1),
    x: 1920 / 2,
    y: y + h + 45,
  });
}

function renderEffects(ctx, elapsed) {
  for (let i = booms.length - 1; i >= 0; i--) {
    const b = booms[i];
    b.time += elapsed;
    if (b.time >= b.duration) {
      booms.splice(i, 1);
      continue;
    }
    const p = b.time / b.duration;
    ctx.save();
    ctx.globalAlpha = 1 - p;
    drawNgon({
      ctx,
      numberOfSides: 16,
      size: b.radius * (0.5 + p),
      Xcenter: b.x,
      Ycenter: b.y,
      color: b.color,
      lineWidth: 6,
    });
    ctx.restore();
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
      fontSize: '40px',
      dropDistX: 3,
      dropDistY: 3,
      fillStyle: t.color,
      x: t.x,
      y: t.y - t.time * 60,
    });
  }
}

export default {
  name: 'Laser-Asteroids ',
  description: `

  Von allen Seiten fliegen Asteroiden 
  auf den Planeten in der Mitte zu
  und teilen sich...
  


Die Satelliten auf der Umlaufbahn 
laden den Schild langsam wieder auf
aber vorsicht die gehen kapott

`,
  image: 'media/img/gametitles/laser-defense-###4###.png',
  init: function () {
    gameState = 'gameover';
    hasPlayed = false;
    lastTime = 0;
    stars = createStars();
    buttonsGameOverScreen = createButtonsGameOverScreen();
  },
  stop: function () {
    runningSounds.slice().forEach((audio) => {
      audio.pause();
    });
    runningSounds = [];
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
    renderStars(ctx);
    buttonsGameOverScreen.forEach((item) => item.handle(grid, elapsed));
    util.renderTextDropShadow({
      ctx,
      text: 'Laser-Asteroiden',
      fontSize: '150px',
      fillStyle: getRgbSpreadHex(laserConfig.testColor, 0.4),
      x: laserConfig.canvasResolution.width / 2,
      y: 200,
    });
    const text = hasPlayed
      ? `Der Schild ist zusammengebrochen! ${gameTime.toFixed(1)}s überlebt, Level ${level}.
Zerstört: ${stats.gross} grosse, ${stats.mittel} mittlere, ${stats.klein} kleine Asteroiden.
${stats.impacts} Einschläge, ${stats.satellitesLost} Satelliten abgeschossen.`
      : `Schiesst die Asteroiden ab, bevor sie einschlagen -
aber lasst die Satelliten in Ruhe!`;
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
  },

  handleGameScreen(grid, elapsed) {
    gameTime += elapsed;
    const ctx = MasterCanvas.get2dContext();

    // Level
    const newLevel = 1 + Math.floor(gameTime / DIFFICULTY.levelDuration);
    if (newLevel !== level) {
      level = newLevel;
      addFloatingText(
        `Level ${level}`,
        1920 / 2,
        PLANET.y - 180,
        getRgbSpreadHex(laserConfig.testColor, 0.4, 0.6, 1)
      );
      playSound(soundLevelUp);
      if ((level - 1) % DIFFICULTY.satelliteEveryLevels === 0) {
        const before = satellites.length;
        addSatellite();
        if (satellites.length > before) {
          addFloatingText(
            'Neuer Satellit!',
            1920 / 2,
            PLANET.y + 200,
            getRgbSpreadHex(laserConfig.testColor, 0.3, 0.8, 0.9)
          );
        }
      }
    }

    // Asteroiden spawnen
    spawnTimer += elapsed;
    const spawnInterval = Math.max(
      DIFFICULTY.spawnIntervalMin,
      DIFFICULTY.spawnIntervalStart * Math.pow(DIFFICULTY.spawnIntervalFactor, level - 1)
    );
    const maxActive = levelValue(
      DIFFICULTY.maxActiveStart,
      DIFFICULTY.maxActivePerLevel,
      DIFFICULTY.maxActiveCap
    );
    if (spawnTimer >= spawnInterval && asteroids.length < maxActive) {
      spawnTimer = 0;
      spawnAsteroid();
    }

    // Schild-Regeneration durch kreisende Satelliten
    changeShield(satellites.length * DIFFICULTY.satelliteRegenPerSecond * elapsed);

    handleKeyboard();

    renderStars(ctx);
    renderPlanet(ctx, elapsed);

    // Kopien, da sich die Arrays beim Iterieren verändern
    satellites.slice().forEach((s) => s.handle(grid, elapsed));
    asteroids.slice().forEach((a) => {
      // bereits zerstörte (z. B. per Tastatur) nicht mehr behandeln
      if (asteroids.indexOf(a) >= 0) a.handle(grid, elapsed);
    });
    if (gameState !== 'game') return;

    renderEffects(ctx, elapsed);
    renderShieldBar(ctx);

    util.renderTextDropShadow({
      ctx,
      text: `Level ${level} - ${gameTime.toFixed(1)}s`,
      fontSize: '50px',
      fillStyle: getRgbSpreadHex(laserConfig.testColor, 0.3),
      align: 'left',
      x: 60,
      y: 90,
    });
    util.renderTextDropShadow({
      ctx,
      text: `Abgeschossen: ${stats.gross + stats.mittel + stats.klein} - Satelliten: ${
        satellites.length
      }`,
      fontSize: '40px',
      fillStyle: getRgbSpreadHex(laserConfig.testColor, 0.3),
      align: 'left',
      x: 60,
      y: 1080 - 60,
    });
  },
};
