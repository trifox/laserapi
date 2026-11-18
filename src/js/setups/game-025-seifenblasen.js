/**
 * Laser-Seifenblasen
 *
 * Seifenblasen steigen von unten nach oben und wackeln dabei leicht hin und her.
 * Jede Blase hat eine von 4 Farben, zusätzlich trägt sie eine innere Form
 * (Dreieck, Quadrat, Sechseck, Strich) als Hinweis für Farbenblinde.
 *
 * - Oben in der Mitte steht die aktuelle Zielfarbe, sie wechselt alle DIFFICULTY.targetInterval
 *   Sekunden (mit Countdown-Ankündigung der nächsten Zielfarbe).
 * - Blase in Zielfarbe zerplatzen = Punkte (grosse Blasen geben mehr, brauchen aber mehrere Laser,
 *   da jede Blase ein gui/pixelFillButton ist und der leuchtende Flächenanteil zählt).
 * - Blase in falscher Farbe zerplatzen = ein Leben weg, Combo weg.
 * - Blase in Zielfarbe entkommt oben = Combo weg (kein Lebensverlust).
 * - Aufeinanderfolgende richtige Treffer erhöhen den Combo-Multiplikator.
 * - 3 Leben, danach Game Over.
 * - Level steigt mit der Zeit: mehr Blasen, schneller, die Farben werden einander ähnlicher.
 *
 * Alle Stellschrauben stehen gesammelt in DIFFICULTY.
 */

import util, { drawNgon, getRgbSpreadHex, removeItemFromArray } from '../util.js';
var laserConfig = require('../LaserApiConfig.js').default;
var MasterCanvas = require('../MasterCanvas').default;
var guiFillButton = require('./gui/fillButton').default;
var guiPixelFillButton = require('./gui/pixelFillButton').default;
import soundPop from '../../../public/media/369952__mischy__plop-1.wav';
import soundError from '../../../public/media/opengameart/Menu Error.ogg';
import soundLevelUp from '../../../public/media/opengameart/Level Up.ogg';
import soundTransition from '../../../public/media/opengameart/Transition.ogg';

import highscoreManager from '../util/highscore.js' 
const highScoreInstance=highscoreManager("Seifenblasen","Score");  // Make highscore instance, will be global until reloaded, but manages saving itself

const DIFFICULTY = {
  levelDuration: 25, // Sekunden pro Level
  lives: 3,
  // Anzahl gleichzeitig aufsteigender Blasen
  maxActiveStart: 6,
  maxActivePerLevel: 1,
  maxActiveCap: 18,
  // Spawn-Intervall in Sekunden
  spawnIntervalStart: 1.3,
  spawnIntervalFactor: 0.88, // pro Level
  spawnIntervalMin: 0.3,
  // Aufstiegsgeschwindigkeit in px/s
  riseSpeedMin: 70,
  riseSpeedRandom: 70,
  riseSpeedPerLevel: 0.12, // Faktor-Zuwachs pro Level
  riseSpeedCap: 2.4,
  // Blasengrösse in px
  radiusMin: 50,
  radiusMax: 110,
  // seitliches Sinus-Wackeln
  wobbleAmplitudeMin: 15,
  wobbleAmplitudeRandom: 35,
  wobbleFrequencyMin: 0.3, // Schwingungen pro Sekunde
  wobbleFrequencyRandom: 0.4,
  // Anteil der Blasen, die in der aktuellen Zielfarbe erscheinen
  targetProbability: 0.4,
  // Zielfarbe
  targetInterval: 12, // Sekunden bis zum Wechsel
  targetWarning: 3, // Sekunden Countdown vor dem Wechsel
  // Farbabstand (Hue) zwischen den 4 Blasenfarben, wird pro Level kleiner
  hueSpacingStart: 0.2,
  hueSpacingPerLevel: 0.025,
  hueSpacingMin: 0.07,
  // Zerplatzen: popTime Sekunden bei popFullPercent leuchtender Fläche, weniger Fläche = langsamer
  popFullPercent: 35,
  popTime: 0.5,
  popDecay: 0.8, // Abbau pro Sekunde ohne Treffer (1 = komplett)
  // Punkte
  pointsBase: 10, // Punkte für eine Blase mit radiusMin, skaliert linear mit dem Radius
  comboStep: 3, // alle comboStep richtigen Treffer steigt der Multiplikator um 1
  comboMaxMultiplier: 5,
};

// Innere Form je Blasentyp (Hinweis für Farbenblinde)
const BUBBLE_TYPES = [
  { edges2: 3, name: 'Dreieck' },
  { edges2: 4, name: 'Quadrat' },
  { edges2: 6, name: 'Sechseck' },
  { edges2: 2, name: 'Strich' },
];
const BUBBLE_EDGES = 28;

var lastTime = 0;
var gameState = 'gameover';
var hasPlayed = false; // false = Startscreen, true = Game-Over-Screen mit Statistik
var gameTime = 0;
var level = 1;
var score = 0;
var lives = DIFFICULTY.lives;
var combo = 0;
var bestCombo = 0;
var spawnTimer = 0;
var targetTimer = 0;
var targetType = 0;
var nextTargetType = 1;
var bubbles = [];
var pops = [];
var floatingTexts = [];
var typeColors = [];
var typeGrowColors = [];
var stats = { popped: 0, wrong: 0, escaped: 0 };
var activeSounds = [];
var buttonsGameOverScreen = [];

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

function levelValue(start, perLevel, cap) {
  return Math.min(cap, start + perLevel * (level - 1));
}

function playSound(src) {
  const audio = new Audio(src);
  activeSounds.push(audio);
  audio.addEventListener('ended', () => removeItemFromArray(activeSounds, audio));
  audio.play().catch(() => {});
}

function stopAllSounds() {
  activeSounds.forEach((audio) => audio.pause());
  activeSounds = [];
}

/** Farben der 4 Blasentypen, symmetrisch um die Gegenfarbe des Lasers (hueShift 0.5) */
function computeTypeColors() {
  const spacing = Math.max(
    DIFFICULTY.hueSpacingMin,
    DIFFICULTY.hueSpacingStart - DIFFICULTY.hueSpacingPerLevel * (level - 1)
  );
  typeColors = [];
  typeGrowColors = [];
  for (let i = 0; i < BUBBLE_TYPES.length; i++) {
    const hue = 0.25 + (i - (BUBBLE_TYPES.length - 1) / 2) * spacing;
    typeColors.push(getRgbSpreadHex(laserConfig.testColor, hue, 0.85, 0.5));
    typeGrowColors.push(getRgbSpreadHex(laserConfig.testColor, hue, 0.95, .7));
  }
}

function randomOtherType(exclude) {
  const t = Math.floor(Math.random() * (BUBBLE_TYPES.length - 1));
  return t >= exclude ? t + 1 : t;
}

function getComboMultiplier() {
  if (combo <= 0) return 1;
  return Math.min(DIFFICULTY.comboMaxMultiplier, 1 + Math.floor((combo - 1) / DIFFICULTY.comboStep));
}

function addFloatingText(text, x, y, color) {
  floatingTexts.push({ text, x, y, time: 0, duration: 1.5, color });
}

function endGame() {
  gameState = 'gameover';
  hasPlayed = true;
  bubbles = [];
  buttonsGameOverScreen = createButtonsGameOverScreen();
  highScoreInstance.addEntry({"Score":score,"Popped":stats.popped,"Escaped":stats.escaped,"Wrong":stats.wrong})
}

function popBubble(bubble, type, radius) {
  removeItemFromArray(bubbles, bubble);
  const x = bubble.getX();
  const y = bubble.getY();
  pops.push({ x, y, radius, type, time: 0, duration: 0.5 });
  if (type === targetType) {
    combo++;
    bestCombo = Math.max(bestCombo, combo);
    stats.popped++;
    const multiplier = getComboMultiplier();
    const points = Math.round((DIFFICULTY.pointsBase * radius) / DIFFICULTY.radiusMin) * multiplier;
    score += points;
    addFloatingText(multiplier > 1 ? `+${points} (x${multiplier})` : `+${points}`, x, y, typeColors[type]);
    playSound(soundPop);
  } else {
    combo = 0;
    lives--;
    stats.wrong++;
    addFloatingText('Falsche Farbe!', x, y, '#ffffff');
    playSound(soundError);
    if (lives <= 0) {
      endGame();
    }
  }
}

function createBubble() {
  const type =
    Math.random() < DIFFICULTY.targetProbability ? targetType : randomOtherType(targetType);
  const radius =
    DIFFICULTY.radiusMin + Math.random() * (DIFFICULTY.radiusMax - DIFFICULTY.radiusMin);
  const margin = radius + DIFFICULTY.wobbleAmplitudeMin + DIFFICULTY.wobbleAmplitudeRandom + 20;
  const baseX = margin + Math.random() * (1920 - 2 * margin);
  const speed =
    (DIFFICULTY.riseSpeedMin + Math.random() * DIFFICULTY.riseSpeedRandom) *
    levelValue(1, DIFFICULTY.riseSpeedPerLevel, DIFFICULTY.riseSpeedCap);
  const wobbleAmplitude = DIFFICULTY.wobbleAmplitudeMin + Math.random() * DIFFICULTY.wobbleAmplitudeRandom;
  const wobbleFrequency = DIFFICULTY.wobbleFrequencyMin + Math.random() * DIFFICULTY.wobbleFrequencyRandom;
  const wobblePhase = Math.random() * Math.PI * 2;
  const spin = (Math.random() - 0.5) * 1.2; // Drehung der inneren Form in rad/s
  let age = 0;

  // Treffer über den Flächenanteil: kleine Blasen schafft ein Laser, grosse brauchen mehrere
  const bubble = guiPixelFillButton({
    label: '',
    posX: baseX,
    posY: 1080 + radius,
    radius,
    edges: BUBBLE_EDGES,
    edges2: BUBBLE_TYPES[type].edges2,
    angle: Math.random() * Math.PI * 2,
    lineWidth: 4,
    fullPercent: DIFFICULTY.popFullPercent,
    speedUp: 100 / DIFFICULTY.popTime,
    speedDown: 100 * DIFFICULTY.popDecay,
    minValue: 0,
    activeValue: 99,
    normalColor: typeColors[type],
    growColor: typeGrowColors[type],
    activeColor: typeGrowColors[type],
    onEnterActive: () => popBubble(bubble, type, radius),
  });

  const handleOriginal = bubble.handle;
  bubble.handle = (grid, elapsed) => {
    age += elapsed;
    bubble.setY(bubble.getY() - speed * elapsed);
    bubble.setX(baseX + Math.sin(age * wobbleFrequency * Math.PI * 2 + wobblePhase) * wobbleAmplitude);
    bubble.setAngle(bubble.getAngle() + spin * elapsed);
    // Farben können sich beim Levelwechsel ändern
    bubble.setColor(typeColors[type]);
    bubble.setGrowColor(typeGrowColors[type]);
    bubble.setActiveColor(typeGrowColors[type]);

    if (bubble.getY() < -radius) {
      removeItemFromArray(bubbles, bubble);
      if (type === targetType) {
        stats.escaped++;
        if (combo > 0) {
          addFloatingText('Combo weg!', bubble.getX(), 60, '#ffffff');
        }
        combo = 0;
      }
      return;
    }
    handleOriginal(grid, elapsed);
  };
  return bubble;
}

function resetGame() {
  gameState = 'game';
  hasPlayed = true;
  gameTime = 0;
  level = 1;
  score = 0;
  lives = DIFFICULTY.lives;
  combo = 0;
  bestCombo = 0;
  spawnTimer = 0;
  targetTimer = 0;
  targetType = Math.floor(Math.random() * BUBBLE_TYPES.length);
  nextTargetType = randomOtherType(targetType);
  bubbles = [];
  pops = [];
  floatingTexts = [];
  stats = { popped: 0, wrong: 0, escaped: 0 };
  computeTypeColors();
}

const createButtonsGameOverScreen = () => [
  guiFillButton({
    label: 'Start',
    posX: 1920 / 2,
    posY: 1080 / 2 + 270,
    radius: 150,
    edges: 6,
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

/** Blasen-Symbol (Umriss + innere Form) ohne Interaktion, für HUD und Legende */
function drawBubbleIcon(ctx, type, x, y, radius, lineWidth = 6) {
  drawNgon({
    ctx,
    numberOfSides: BUBBLE_EDGES,
    size: radius,
    Xcenter: x,
    Ycenter: y,
    color: typeColors[type],
    lineWidth,
  });
  drawNgon({
    ctx,
    numberOfSides: BUBBLE_TYPES[type].edges2,
    size: radius / 2,
    Xcenter: x,
    Ycenter: y,
    color: typeColors[type],
    lineWidth: lineWidth / 2,
    angle: Math.PI / 2,
  });
}

function renderPops(ctx, elapsed) {
  for (let i = pops.length - 1; i >= 0; i--) {
    const p = pops[i];
    p.time += elapsed;
    if (p.time >= p.duration) {
      pops.splice(i, 1);
      continue;
    }
    const t = p.time / p.duration;
    // auseinanderfliegende Tröpfchen
    for (let k = 0; k < 8; k++) {
      const a = (k * Math.PI) / 4;
      const dist = p.radius * (1 + t * 1.2);
      drawNgon({
        ctx,
        numberOfSides: 6,
        size: 8 * (1 - t) + 2,
        Xcenter: p.x + Math.cos(a) * dist,
        Ycenter: p.y + Math.sin(a) * dist,
        color: typeColors[p.type],
        lineWidth: 3,
        filled: true,
      });
    }
  }
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
      fontSize: '40px',
      dropDistX: 3,
      dropDistY: 3,
      fillStyle: t.color,
      x: t.x,
      y: t.y - t.time * 60,
    });
  }
}

function renderHud(ctx) {
  const hudColor = getRgbSpreadHex(laserConfig.testColor, 0.4);

  // Zielfarbe oben in der Mitte
  util.renderTextDropShadow({
    ctx,
    text: 'Zielfarbe',
    fontSize: '40px',
    dropDistX: 3,
    dropDistY: 3,
    fillStyle: hudColor,
    x: 1920 / 2,
    y: 50,
  });
  drawBubbleIcon(ctx, targetType, 1920 / 2, 140, 70, 8);

  // Ankündigung der nächsten Zielfarbe
  const remaining = DIFFICULTY.targetInterval - targetTimer;
  if (remaining <= DIFFICULTY.targetWarning) {
    const blink = Math.floor(gameTime * 4) % 2 === 0;
    util.renderTextDropShadow({
      ctx,
      text: `Wechsel in ${Math.ceil(remaining)}`,
      fontSize: '45px',
      dropDistX: 3,
      dropDistY: 3,
      align: 'left',
      fillStyle: blink ? '#ffffff' : hudColor,
      x: 1920 / 2 + 110,
      y: 155,
    });
    drawBubbleIcon(ctx, nextTargetType, 1920 / 2 + 460, 140, 45, 6);
  }

  // Punkte, Combo, Level links oben
  util.renderTextDropShadow({
    ctx,
    text: `${score} Punkte`,
    fontSize: '50px',
    dropDistX: 4,
    dropDistY: 4,
    align: 'left',
    fillStyle: hudColor,
    x: 60,
    y: 80,
  });
  util.renderTextDropShadow({
    ctx,
    text: `Combo ${combo} (x${getComboMultiplier()})`,
    fontSize: '40px',
    dropDistX: 3,
    dropDistY: 3,
    align: 'left',
    fillStyle: getRgbSpreadHex(laserConfig.testColor, 0.6),
    x: 60,
    y: 140,
  });
  util.renderTextDropShadow({
    ctx,
    text: `Level ${level}`,
    fontSize: '40px',
    dropDistX: 3,
    dropDistY: 3,
    align: 'left',
    fillStyle: getRgbSpreadHex(laserConfig.testColor, 0.3),
    x: 60,
    y: 195,
  });

  // Leben rechts oben als Blasen-Symbole
  const lifeColor = getRgbSpreadHex(laserConfig.testColor, 0.5, 0.2, 1);
  for (let i = 0; i < DIFFICULTY.lives; i++) {
    drawNgon({
      ctx,
      numberOfSides: 20,
      size: 28,
      Xcenter: 1920 - 70 - i * 80,
      Ycenter: 75,
      color: lifeColor,
      lineWidth: 4,
      filled: i < lives,
    });
  }
}

export default {
  name: 'Seifenblasen Kamm ',
  description: ` 

  Seifenblasen in 4 Farben steigen von unten nach oben
(Dreieck, Quadrat, Sechseck, Strich)


Oben in der Mitte steht die Zielfarbe 
nur diese Blasen zerstören! 




Alle ${DIFFICULTY.targetInterval} Sekunden wechselt die Zielfarbe
`,
  image: 'media/img/gametitles/laser-paradise-###4###.png',

  init: function () {
    gameState = 'gameover';
    hasPlayed = false;
    lastTime = 0;
    level = 1;
    bubbles = [];
    pops = [];
    floatingTexts = [];
    computeTypeColors();
    buttonsGameOverScreen = createButtonsGameOverScreen();
  },

  stop: function () {
    stopAllSounds();
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
      text: 'Laser-Seifenblasen',
      fontSize: '150px',
      fillStyle: getRgbSpreadHex(laserConfig.testColor, 0.4),
      x: laserConfig.canvasResolution.width / 2,
      y: 200,
    });

    if (hasPlayed) {
      util.renderTextDropShadow({
        ctx,
        text: `Alle Leben verbraucht! Ihr habt Level ${level} erreicht (${gameTime.toFixed(1)}s).
${score} Punkte, beste Combo ${bestCombo}, ${stats.popped} richtige Blasen zerplatzt,
${stats.wrong} falsche Blasen zerplatzt, ${stats.escaped} Zielblasen entkommen.`,
        fontSize: '45px',
        lineHeight: 70,
        dropDistX: 5,
        dropDistY: 5,
        fillStyle: getRgbSpreadHex(laserConfig.testColor, 0.5),
        x: laserConfig.canvasResolution.width / 2,
        y: 340,
      });
    } else {
      util.renderTextDropShadow({
        ctx,
        text: 'Nur Blasen in der Zielfarbe zerplatzen!\nDie innere Form verrät die Farbe:',
        fontSize: '45px',
        lineHeight: 60,
        dropDistX: 5,
        dropDistY: 5,
        fillStyle: getRgbSpreadHex(laserConfig.testColor, 0.5),
        x: laserConfig.canvasResolution.width / 2,
        y: 330,
      });
      // Legende der 4 Blasentypen
      for (let i = 0; i < BUBBLE_TYPES.length; i++) {
        const x = 1920 / 2 + (i - (BUBBLE_TYPES.length - 1) / 2) * 260;
        drawBubbleIcon(ctx, i, x, 520, 70, 6);
        util.renderTextDropShadow({
          ctx,
          text: BUBBLE_TYPES[i].name,
          fontSize: '30px',
          dropDistX: 3,
          dropDistY: 3,
          fillStyle: typeColors[i],
          x,
          y: 630,
        });
      }
    }

    highScoreInstance.renderHighAndLowScores(ctx)
  },

  handleGameScreen(grid, elapsed) {
    gameTime += elapsed;
    const ctx = MasterCanvas.get2dContext();

    // Level
    const newLevel = 1 + Math.floor(gameTime / DIFFICULTY.levelDuration);
    if (newLevel !== level) {
      level = newLevel;
      computeTypeColors();
      addFloatingText(`Level ${level}`, 1920 / 2, 400, getRgbSpreadHex(laserConfig.testColor, 0.4));
      playSound(soundLevelUp);
    }

    // Zielfarbe wechseln
    targetTimer += elapsed;
    if (targetTimer >= DIFFICULTY.targetInterval) {
      targetTimer = 0;
      targetType = nextTargetType;
      nextTargetType = randomOtherType(targetType);
      addFloatingText('Neue Zielfarbe!', 1920 / 2, 300, typeColors[targetType]);
      playSound(soundTransition);
    }

    // Blasen spawnen
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
    if (spawnTimer >= spawnInterval && bubbles.length < maxActive) {
      spawnTimer = 0;
      bubbles.push(createBubble());
    }

    // Kopie, da sich Blasen in handle() selbst entfernen
    bubbles.slice().forEach((bubble) => {
      if (gameState === 'game') bubble.handle(grid, elapsed);
    });
    if (gameState !== 'game') return;

    renderPops(ctx, elapsed);
    renderFloatingTexts(ctx, elapsed);
    renderHud(ctx);
  },
};
