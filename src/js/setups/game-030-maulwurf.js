/**
 * Laser-Maulwurf
 *
 * Hau-den-Maulwurf für viele Spieler gleichzeitig.
 * - 4 x 3 Erdhügel. Aus zufälligen Hügeln tauchen Figuren für kurze Zeit auf und wieder ab.
 * - Maulwurf (gui/pixelFillButton): anleuchten bis er voll ist = +1 Punkt.
 * - Gold-Maulwurf: selten und gross. Treffer zählen über den Flächenanteil (pixelFillButton),
 *   ein einzelner Laser reicht nicht - viele Laser gleichzeitig = +5 Punkte.
 * - Igel: das "gute" Objekt, NICHT treffen! Treffer = -3 Punkte, Combo weg, Bildschirm blitzt.
 * - Combo: Treffer in Folge erhöhen den Multiplikator, ein verpasster Maulwurf setzt sie zurück.
 * - Pro Level 90 Sekunden (Countdown-Balken oben). Zielpunktzahl erreicht = nächstes Level,
 *   sonst Game Over.
 * - Pro Level: höhere Zielpunktzahl, mehr Figuren gleichzeitig, kürzere Auftauchzeit, mehr Igel.
 *
 * Alle Stellschrauben stehen gesammelt in DIFFICULTY.
 */

import util, { drawNgon, drawLine, getRgbSpreadHex, removeItemFromArray } from '../util.js';
var laserConfig = require('../LaserApiConfig.js').default;
var MasterCanvas = require('../MasterCanvas').default;
var guiFillButton = require('./gui/fillButton').default;
var guiPixelFillButton = require('./gui/pixelFillButton').default;
import soundHit from '../../../public/media/369952__mischy__plop-1.wav';
import soundGold from '../../../public/media/opengameart/Item Pickup.ogg';
import soundHedgehog from '../../../public/media/414346__bykgames__explosion-far.wav';
import soundLevelUp from '../../../public/media/opengameart/Level Up.ogg';
import soundGameOver from '../../../public/media/opengameart/Music Box Game Over III.wav';

const DIFFICULTY = {
  levelTime: 90, // Sekunden pro Level
  levelPause: 3, // Sekunden Verschnaufpause nach geschafftem Level
  // Zielpunktzahl pro Level
  targetStart: 20,
  targetPerLevel: 10,
  // gleichzeitige Figuren
  maxFiguresStart: 2,
  maxFiguresPerLevel: 1,
  maxFiguresCap: 8,
  // Spawn-Intervall in Sekunden
  spawnIntervalStart: 1.0,
  spawnIntervalFactor: 0.9,
  spawnIntervalMin: 0.35,
  // so lange bleibt eine Figur oben (Sekunden)
  upTimeStart: 2.5,
  upTimeFactor: 0.88,
  upTimeMin: 1.0,
  goldUpTimeFactor: 1.3, // Gold bleibt etwas länger, damit sich die Menge sammeln kann
  riseTime: 0.25,
  sinkTime: 0.25,
  // Figurenmix
  goldProbability: 0.07,
  hedgehogStart: 0.12,
  hedgehogPerLevel: 0.05,
  hedgehogCap: 0.4,
  // Grösse und Treffer: hitTime = Sekunden bei voller Bedeckung (fullPercent der Fläche leuchtet)
  moleRadius: 70,
  moleFullPercent: 25,
  moleHitTime: 0.3,
  goldRadius: 130,
  goldFullPercent: 55, // braucht viele Laser gleichzeitig
  goldHitTime: 0.6,
  hedgehogRadius: 75,
  hedgehogFullPercent: 25,
  hedgehogHitTime: 0.4,
  hitDecay: 1.5, // Trefferfortschritt-Abbau pro Sekunde ohne Treffer (1 = komplett)
  // Punkte
  pointsMole: 1,
  pointsGold: 5,
  penaltyHedgehog: -3,
  comboStep: 5, // alle 5 Treffer in Folge +1 Multiplikator
  comboMaxMultiplier: 3,
  flashDuration: 0.5,
};

const HILL_COLS = 4;
const HILL_ROWS = 3;
const HILL_RADIUS = 105;
const FIGURE_OFFSET_Y = 30; // Figur sitzt etwas über der Hügel-Grundlinie

var hills = [];
var figures = [];
var floatingTexts = [];
var effects = [];
var activeSounds = [];
var buttonsGameOverScreen = [];
var gameState = 'gameover';
var roundPhase = 'play'; // 'play' | 'pause' (Level geschafft)
var pauseTimer = 0;
var hasPlayed = false;
var gameTime = 0;
var levelTime = 0;
var level = 1;
var score = 0;
var levelScore = 0;
var combo = 0;
var spawnTimer = 0;
var flashTimer = 0;
var stats = { hits: 0, gold: 0, hedgehogs: 0, missed: 0, maxCombo: 0 };
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

function levelTarget() {
  return DIFFICULTY.targetStart + DIFFICULTY.targetPerLevel * (level - 1);
}

function currentUpTime() {
  return Math.max(
    DIFFICULTY.upTimeMin,
    DIFFICULTY.upTimeStart * Math.pow(DIFFICULTY.upTimeFactor, level - 1)
  );
}

function comboMultiplier() {
  return Math.min(DIFFICULTY.comboMaxMultiplier, 1 + Math.floor(combo / DIFFICULTY.comboStep));
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
  floatingTexts.push({ text, x, y, time: 0, duration: 1.2, color });
}

function createHills() {
  const result = [];
  for (let row = 0; row < HILL_ROWS; row++) {
    for (let col = 0; col < HILL_COLS; col++) {
      result.push({
        x: (1920 / HILL_COLS) * (col + 0.5),
        y: 360 + row * 260,
        busy: false,
      });
    }
  }
  return result;
}

const FIGURE_TYPES = {
  mole: {
    radius: () => DIFFICULTY.moleRadius,
    fullPercent: () => DIFFICULTY.moleFullPercent,
    hitTime: () => DIFFICULTY.moleHitTime,
    edges: 10,
    hue: 0.4,
    sat: 0.5,
    val: 0.85,
  },
  gold: {
    radius: () => DIFFICULTY.goldRadius,
    fullPercent: () => DIFFICULTY.goldFullPercent,
    hitTime: () => DIFFICULTY.goldHitTime,
    edges: 8,
    hue: 0.25,
    sat: 0.9,
    val: 1,
  },
  hedgehog: {
    radius: () => DIFFICULTY.hedgehogRadius,
    fullPercent: () => DIFFICULTY.hedgehogFullPercent,
    hitTime: () => DIFFICULTY.hedgehogHitTime,
    edges: 14,
    hue: 0.65,
    sat: 1,
    val: 1,
  },
};

function typeColor(type, valFactor = 1) {
  const t = FIGURE_TYPES[type];
  return getRgbSpreadHex(laserConfig.testColor, t.hue, t.sat, t.val * valFactor);
}

function addBurst(x, y, color) {
  effects.push({ x, y, color, time: 0, duration: 0.5 });
}

function onFigureHit(figure) {
  const x = figure.getX();
  const y = figure.getY();
  switch (figure.type) {
    case 'mole':
    case 'gold': {
      combo++;
      stats.maxCombo = Math.max(stats.maxCombo, combo);
      const isGold = figure.type === 'gold';
      const points =
        (isGold ? DIFFICULTY.pointsGold : DIFFICULTY.pointsMole) * comboMultiplier();
      score += points;
      levelScore += points;
      if (isGold) {
        stats.gold++;
        playSound(soundGold);
      } else {
        stats.hits++;
        playSound(soundHit);
      }
      addFloatingText(`+${points}`, x, y - 60, typeColor(figure.type));
      addBurst(x, y, typeColor(figure.type));
      break;
    }
    case 'hedgehog':
      combo = 0;
      score += DIFFICULTY.penaltyHedgehog;
      levelScore += DIFFICULTY.penaltyHedgehog;
      stats.hedgehogs++;
      flashTimer = DIFFICULTY.flashDuration;
      playSound(soundHedgehog);
      addFloatingText(`Autsch! ${DIFFICULTY.penaltyHedgehog}`, x, y - 60, '#ffffff');
      addBurst(x, y, typeColor('hedgehog'));
      break;
  }
}

function onFigureEscaped(figure) {
  if (figure.type === 'mole' || figure.type === 'gold') {
    if (combo > 0) {
      addFloatingText('Combo weg!', figure.getX(), figure.getY() - 60, '#ffffff');
    }
    combo = 0;
    stats.missed++;
  }
}

function createFigure(hill, type) {
  const conf = FIGURE_TYPES[type];
  const fullRadius = conf.radius();
  const upTime = currentUpTime() * (type === 'gold' ? DIFFICULTY.goldUpTimeFactor : 1);
  const color = typeColor(type);
  let phase = 'rising';
  let phaseTime = 0;
  let done = false;

  const finish = () => {
    done = true;
    hill.busy = false;
    removeItemFromArray(figures, figure);
  };

  const figure = guiPixelFillButton({
    label: '',
    posX: hill.x,
    posY: hill.y - FIGURE_OFFSET_Y,
    radius: 1,
    edges: conf.edges,
    lineWidth: 5,
    fullPercent: conf.fullPercent(),
    speedUp: 100 / conf.hitTime(),
    speedDown: 100 * DIFFICULTY.hitDecay,
    minValue: 0,
    activeValue: 99,
    normalColor: color,
    growColor: typeColor(type, 0.8),
    activeColor: '#ffffff',
    onEnterActive: () => {
      if (done) return;
      finish();
      onFigureHit(figure);
    },
  });
  figure.type = type;

  const handleOriginal = figure.handle;
  figure.handle = (grid, elapsed) => {
    if (done) return;
    phaseTime += elapsed;
    let r = fullRadius;
    if (phase === 'rising') {
      r = fullRadius * Math.min(1, phaseTime / DIFFICULTY.riseTime);
      if (phaseTime >= DIFFICULTY.riseTime) {
        phase = 'up';
        phaseTime = 0;
      }
    } else if (phase === 'up') {
      if (phaseTime >= upTime) {
        phase = 'sinking';
        phaseTime = 0;
      }
    } else {
      r = fullRadius * Math.max(0, 1 - phaseTime / DIFFICULTY.sinkTime);
      if (phaseTime >= DIFFICULTY.sinkTime) {
        finish();
        onFigureEscaped(figure);
        return;
      }
    }
    figure.setRadius(Math.max(1, r));
    // winzige Figuren nicht auswerten (Kreis kleiner als eine Zelle würde die Mittelzelle zählen)
    if (r < 10) return;

    handleOriginal(grid, elapsed);
    if (done) return; // gerade getroffen

    renderFigureDetails(figure, r);
  };
  return figure;
}

function renderFigureDetails(figure, r) {
  const ctx = MasterCanvas.get2dContext();
  const x = figure.getX();
  const y = figure.getY();
  const eyeColor = typeColor(figure.type);
  if (figure.type === 'hedgehog') {
    // Stacheln
    ctx.lineWidth = 4;
    for (let k = 0; k < 14; k++) {
      const a = (k / 14) * Math.PI * 2;
      drawLine(
        ctx,
        x + Math.cos(a) * r,
        y + Math.sin(a) * r,
        x + Math.cos(a) * r * 1.3,
        y + Math.sin(a) * r * 1.3,
        eyeColor
      );
    }
    util.renderText({
      ctx,
      text: 'IGEL',
      fontSize: Math.round(r * 0.45) + 'px',
      fillStyle: eyeColor,
      x,
      y: y + r * 0.55,
    });
  }
  // Augen und Nase
  [-1, 1].forEach((side) => {
    drawNgon({
      ctx,
      numberOfSides: 10,
      size: r * 0.1,
      Xcenter: x + side * r * 0.3,
      Ycenter: y - r * 0.2,
      color: eyeColor,
      filled: true,
    });
  });
  drawNgon({
    ctx,
    numberOfSides: 10,
    size: r * 0.14,
    Xcenter: x,
    Ycenter: y + r * 0.1,
    color: eyeColor,
    filled: true,
  });
  if (figure.type === 'gold') {
    util.renderText({
      ctx,
      text: 'GOLD',
      fontSize: Math.round(r * 0.35) + 'px',
      fillStyle: eyeColor,
      x,
      y: y + r * 0.6,
    });
  }
}

function spawnFigure() {
  const freeHills = hills.filter((h) => !h.busy);
  if (freeHills.length === 0) return;
  const hill = freeHills[Math.floor(Math.random() * freeHills.length)];
  const hedgehogShare = levelValue(
    DIFFICULTY.hedgehogStart,
    DIFFICULTY.hedgehogPerLevel,
    DIFFICULTY.hedgehogCap
  );
  const goldActive = figures.some((f) => f.type === 'gold');
  const rnd = Math.random();
  let type = 'mole';
  if (rnd < hedgehogShare) {
    type = 'hedgehog';
  } else if (!goldActive && rnd < hedgehogShare + DIFFICULTY.goldProbability) {
    type = 'gold';
  }
  hill.busy = true;
  figures.push(createFigure(hill, type));
}

function startLevel(newLevel) {
  level = newLevel;
  roundPhase = 'play';
  levelTime = 0;
  levelScore = 0;
  combo = 0;
  spawnTimer = 0;
  figures = [];
  hills.forEach((h) => (h.busy = false));
}

function resetGame() {
  gameState = 'game';
  hasPlayed = true;
  gameTime = 0;
  score = 0;
  flashTimer = 0;
  floatingTexts = [];
  effects = [];
  stats = { hits: 0, gold: 0, hedgehogs: 0, missed: 0, maxCombo: 0 };
  hills = createHills();
  startLevel(1);
  lastTime = performance.now();
}

function gameOver() {
  gameState = 'gameover';
  figures = [];
  playSound(soundGameOver);
  buttonsGameOverScreen = createButtonsGameOverScreen();
}

const createButtonsGameOverScreen = () => [
  guiFillButton({
    label: 'Start',
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

function renderHills(ctx) {
  ctx.save();
  hills.forEach((hill) => {
    ctx.fillStyle = getRgbSpreadHex(laserConfig.testColor, 0.45, 0.5, 0.3);
    ctx.beginPath();
    ctx.arc(hill.x, hill.y, HILL_RADIUS, Math.PI, 2 * Math.PI);
    ctx.closePath();
    ctx.fill();
    ctx.lineWidth = 4;
    ctx.strokeStyle = getRgbSpreadHex(laserConfig.testColor, 0.45, 0.5, 0.55);
    ctx.stroke();
    // Erdloch
    ctx.fillStyle = '#000000';
    ctx.beginPath();
    ctx.ellipse(hill.x, hill.y - 8, HILL_RADIUS * 0.5, 12, 0, 0, 2 * Math.PI);
    ctx.fill();
  });
  ctx.restore();
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
    drawNgon({
      ctx,
      numberOfSides: 12,
      size: 40 + p * 140,
      Xcenter: e.x,
      Ycenter: e.y,
      angle: p,
      color: e.color,
      lineWidth: 6 * (1 - p) + 1,
    });
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
      fontSize: '50px',
      dropDistX: 3,
      dropDistY: 3,
      fillStyle: t.color,
      x: t.x,
      y: t.y - t.time * 60,
    });
  }
}

function renderFlash(ctx, elapsed) {
  if (flashTimer <= 0) return;
  flashTimer = Math.max(0, flashTimer - elapsed);
  ctx.save();
  ctx.globalAlpha = 0.5 * (flashTimer / DIFFICULTY.flashDuration);
  ctx.fillStyle = getRgbSpreadHex(laserConfig.testColor, 0.65, 0.4, 1);
  ctx.fillRect(0, 0, 1920, 1080);
  ctx.restore();
}

function renderHud(ctx) {
  // Countdown-Balken
  const remaining = Math.max(0, DIFFICULTY.levelTime - levelTime);
  const fraction = remaining / DIFFICULTY.levelTime;
  const barX = 100;
  const barW = 1920 - 200;
  const urgent = remaining < 15 && Math.floor(gameTime * 4) % 2 === 0;
  ctx.save();
  ctx.lineWidth = 3;
  ctx.strokeStyle = getRgbSpreadHex(laserConfig.testColor, 0.3, 0.5, 0.7);
  ctx.strokeRect(barX, 20, barW, 30);
  ctx.fillStyle = urgent
    ? getRgbSpreadHex(laserConfig.testColor, 0.6, 0.9, 1)
    : getRgbSpreadHex(laserConfig.testColor, 0.3, 0.7, 0.8);
  ctx.fillRect(barX, 20, barW * fraction, 30);
  ctx.restore();

  const hudColor = getRgbSpreadHex(laserConfig.testColor, 0.3);
  util.renderTextDropShadow({
    ctx,
    text: `Level ${level} - ${levelScore}/${levelTarget()} Punkte`,
    fontSize: '50px',
    fillStyle: hudColor,
    align: 'left',
    x: 100,
    y: 115,
  });
  util.renderTextDropShadow({
    ctx,
    text: `${Math.ceil(remaining)}s`,
    fontSize: '50px',
    fillStyle: hudColor,
    x: 1920 / 2,
    y: 115,
  });
  util.renderTextDropShadow({
    ctx,
    text: `Combo ${combo} (x${comboMultiplier()})`,
    fontSize: '50px',
    fillStyle: hudColor,
    align: 'right',
    x: 1920 - 100,
    y: 115,
  });
}

export default {
  name: 'Best Weed ' ,
  description: `


  Ein perfekten Rasen

aber auf keinen fall:
IGEL töten!

es gibt geruechte 
vom goldenen maulwurf
`,
  image: 'media/img/gametitles/laser-haystack-###4###.png',
  init: function () {
    gameState = 'gameover';
    hasPlayed = false;
    lastTime = 0;
    figures = [];
    floatingTexts = [];
    effects = [];
    flashTimer = 0;
    hills = createHills();
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
    buttonsGameOverScreen.forEach((item) => item.handle(grid, elapsed));
    util.renderTextDropShadow({
      ctx,
      text: 'Laser-Maulwurf',
      fontSize: '150px',
      fillStyle: getRgbSpreadHex(laserConfig.testColor, 0.4),
      x: laserConfig.canvasResolution.width / 2,
      y: 200,
    });
    const text = hasPlayed
      ? `Zeit um! Level ${level} mit ${levelScore}/${levelTarget()} Punkten nicht geschafft.
Gesamt ${score} Punkte: ${stats.hits} Maulwürfe, ${stats.gold} Gold-Maulwürfe,
${stats.hedgehogs} Igel-Unfälle, ${stats.missed} entwischt, beste Combo ${stats.maxCombo}.`
      : `Maulwürfe anleuchten, Gold-Maulwürfe gemeinsam anleuchten,
Igel in Ruhe lassen!`;
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

    renderHills(ctx);

    if (roundPhase === 'pause') {
      pauseTimer -= elapsed;
      renderEffects(ctx, elapsed);
      util.renderTextDropShadow({
        ctx,
        text: `Level ${level} geschafft!\nNächstes Ziel: ${
          DIFFICULTY.targetStart + DIFFICULTY.targetPerLevel * level
        } Punkte`,
        fontSize: '80px',
        lineHeight: 110,
        fillStyle: getRgbSpreadHex(laserConfig.testColor, 0.4),
        x: 1920 / 2,
        y: 1080 / 2 - 60,
      });
      if (pauseTimer <= 0) {
        startLevel(level + 1);
      }
      return;
    }

    levelTime += elapsed;

    // Figuren auftauchen lassen
    spawnTimer += elapsed;
    const spawnInterval = Math.max(
      DIFFICULTY.spawnIntervalMin,
      DIFFICULTY.spawnIntervalStart * Math.pow(DIFFICULTY.spawnIntervalFactor, level - 1)
    );
    const maxFigures = Math.round(
      levelValue(DIFFICULTY.maxFiguresStart, DIFFICULTY.maxFiguresPerLevel, DIFFICULTY.maxFiguresCap)
    );
    if (spawnTimer >= spawnInterval && figures.length < maxFigures) {
      spawnTimer = 0;
      spawnFigure();
    }

    // Kopie, da sich Figuren beim Treffen/Abtauchen selbst entfernen
    figures.slice().forEach((figure) => figure.handle(grid, elapsed));

    renderEffects(ctx, elapsed);
    renderFlash(ctx, elapsed);
    renderHud(ctx);

    if (levelScore >= levelTarget()) {
      roundPhase = 'pause';
      pauseTimer = DIFFICULTY.levelPause;
      figures = [];
      hills.forEach((h) => (h.busy = false));
      playSound(soundLevelUp);
    } else if (levelTime >= DIFFICULTY.levelTime) {
      gameOver();
    }
  },
};
