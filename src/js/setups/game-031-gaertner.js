/**
 * Laser-Gärtner
 *
 * Umgekehrtes Prinzip: die Laser sind Sonnenlicht, die Pflanzen WOLLEN beleuchtet werden.
 *
 * Unten liegt ein Beet mit mehreren Pflanzplätzen. Dort wachsen Blumen und Unkraut:
 * - Blume: solange sie beleuchtet wird, wächst sie (Kopf wird größer, Stängel länger).
 *   Ist sie voll, erblüht sie (+Punkte), nach ein paar Sekunden wird der Platz wieder frei.
 *   Ohne Licht welkt sie langsam. Ist sie ganz verwelkt, ist sie verdorrt (-1 Leben).
 * - Unkraut: zackig und andersfarbig. Wird es beleuchtet und ist voll, wuchert es auf einen
 *   Nachbarplatz und verdrängt dort die Blume (-Punkte). Unkraut ohne Licht vertrocknet von selbst.
 * - Wolken ziehen als Deko durchs Bild.
 *
 * 5 Leben. Mit jedem Level welken die Blumen schneller, es kommt mehr Unkraut und es gibt
 * große Blumen, die mehrere Laser gleichzeitig brauchen (Teamwork).
 *
 * Jede Pflanze ist ein gui/pixelFillButton: das Wachstum skaliert mit dem beleuchteten Flächenanteil.
 * Alle Stellschrauben stehen gesammelt in DIFFICULTY.
 */

import util, { drawLine, getRgbSpreadHex, removeItemFromArray } from '../util.js';
var laserConfig = require('../LaserApiConfig.js').default;
var MasterCanvas = require('../MasterCanvas').default;
var guiFillButton = require('./gui/fillButton').default;
var guiPixelFillButton = require('./gui/pixelFillButton').default;
import soundBloom from '../../../public/media/369952__mischy__plop-1.wav';
import soundLevelUp from '../../../public/media/opengameart/Level Up.ogg';
import soundWither from '../../../public/media/opengameart/Menu Error.ogg';
import soundWeed from '../../../public/media/opengameart/Decline.wav';

const DIFFICULTY = {
  levelDuration: 30, // Sekunden pro Level
  lives: 5,
  plotCount: 8,
  startFlowers: 3, // so viele Blumen stehen beim Start schon im Beet
  // Pflanz-Intervall in Sekunden
  spawnIntervalStart: 2.5,
  spawnIntervalFactor: 0.9, // pro Level
  spawnIntervalMin: 0.8,
  plotCooldown: 1.5, // Sekunden, bis ein freier Platz wieder bepflanzt wird
  // Licht: ab diesem beleuchteten Flächenanteil (%) wächst eine Pflanze mit voller Geschwindigkeit
  fullPercent: 25,
  // Blumen
  flowerStartValue: 35, // Setzling startet mit diesem Füllstand (0..100)
  flowerActiveValue: 95, // ab hier erblüht die Blume
  flowerGrowTime: 4, // Sekunden von 0 auf 100 bei voller Beleuchtung
  bigFlowerGrowTime: 5,
  wiltSpeedStart: 4, // Füllstand-Verlust pro Sekunde ohne Licht
  wiltSpeedPerLevel: 1,
  wiltSpeedCap: 12,
  wiltWarnValue: 20, // darunter wird die Blume welk eingefärbt
  flowerRadiusMin: 50,
  flowerRadiusMax: 75,
  bigFlowerRadiusMin: 90,
  bigFlowerRadiusMax: 120,
  bigFlowerProbabilityPerLevel: 0.12, // ab Level 2
  bigFlowerProbabilityCap: 0.4,
  stemGrowth: 380, // so viele Pixel wächst der Stängel von 0 auf 100
  bloomDuration: 3, // Sekunden Blütezeit, danach wird der Platz frei
  bloomRadiusFactor: 1.2,
  // Unkraut
  weedProbabilityStart: 0.15,
  weedProbabilityPerLevel: 0.06,
  weedProbabilityCap: 0.45,
  weedSpreadTime: 3, // Sekunden bei voller Beleuchtung, bis es wuchert
  weedDecay: 15, // Füllstand-Verlust pro Sekunde ohne Licht
  weedLifetimeStart: 10, // Sekunden ohne Licht, bis Unkraut vertrocknet
  weedLifetimePerLevel: 1.5,
  weedLifetimeCap: 20,
  weedRadiusMin: 50,
  weedRadiusMax: 75,
  weedStemGrowth: 150,
  // Punkte
  scoreBloom: 10,
  scoreBigBloom: 25,
  penaltySpread: 5, // pro Wucherung
  penaltyDisplaced: 5, // zusätzlich, wenn dabei eine Blume verdrängt wird
};

const groundY = 930; // Oberkante des Beets
const cloudCount = 5;

var plots = [];
var clouds = [];
var floatingTexts = [];
var activeSounds = [];
var buttonsGameOverScreen = [];
var gameState = 'gameover';
var hasPlayed = false;
var gameTime = 0;
var level = 1;
var score = 0;
var lives = DIFFICULTY.lives;
var spawnTimer = 0;
var stats = { blooms: 0, withered: 0, spreads: 0, displaced: 0 };
var lastTime = 0;

function getDelta() {
  var currentTime = performance.now();
  if (lastTime === 0) {
    lastTime = currentTime;
    return 0;
  }
  const elapsed = (currentTime - lastTime) / 1000;
  lastTime = currentTime;
  // gegen Sprünge nach Intro-Screen oder Tab-Inaktivität
  return Math.min(elapsed, 0.1);
}

function levelValue(start, perLevel, cap) {
  return Math.min(cap, start + perLevel * (level - 1));
}

function playSound(src) {
  const audio = new Audio(src);
  activeSounds.push(audio);
  audio.onended = () => removeItemFromArray(activeSounds, audio);
  audio.play().catch(() => {});
}

function addFloatingText(text, x, y, color) {
  floatingTexts.push({ text, x, y, time: 0, duration: 1.5, color });
}

function createPlots() {
  const result = [];
  const margin = 120;
  const step = (1920 - 2 * margin) / (DIFFICULTY.plotCount - 1);
  for (let i = 0; i < DIFFICULTY.plotCount; i++) {
    result.push({ x: margin + i * step, plant: null, cooldown: 0 });
  }
  return result;
}

function createClouds() {
  const result = [];
  for (let i = 0; i < cloudCount; i++) {
    result.push({
      x: Math.random() * 1920,
      y: 120 + Math.random() * 300,
      scale: 0.6 + Math.random() * 0.8,
      speed: 15 + Math.random() * 25,
    });
  }
  return result;
}

/** gibt den Platz frei, falls dort noch genau diese Pflanze steht */
function freePlot(plotIndex, plant) {
  plant.removed = true;
  const plot = plots[plotIndex];
  if (plot.plant === plant) {
    plot.plant = null;
    plot.cooldown = DIFFICULTY.plotCooldown;
  }
}

function loseLife() {
  lives--;
  if (lives <= 0) {
    lives = 0;
    gameState = 'gameover';
    buttonsGameOverScreen = createButtonsGameOverScreen();
  }
}

function drawStem(ctx, x, topY, color, wobble) {
  ctx.save();
  ctx.lineWidth = 6;
  drawLine(ctx, x, groundY, x, topY, color);
  // zwei Blätter auf halber Höhe
  const midY = (groundY + topY) / 2;
  const leaf = 25 + wobble * 15;
  ctx.lineWidth = 5;
  drawLine(ctx, x, midY + 20, x - leaf, midY - 5, color);
  drawLine(ctx, x, midY + 50, x + leaf, midY + 25, color);
  ctx.restore();
}

function drawZigzagStem(ctx, x, topY, color) {
  ctx.save();
  ctx.lineWidth = 5;
  ctx.strokeStyle = color;
  ctx.beginPath();
  ctx.moveTo(x, groundY);
  const steps = 6;
  for (let i = 1; i <= steps; i++) {
    const y = groundY + ((topY - groundY) * i) / steps;
    ctx.lineTo(x + (i % 2 === 0 ? -14 : 14), y);
  }
  ctx.lineTo(x, topY);
  ctx.stroke();
  ctx.restore();
}

function createFlower(plotIndex) {
  const plot = plots[plotIndex];
  const bigProbability =
    level >= 2
      ? Math.min(
          DIFFICULTY.bigFlowerProbabilityCap,
          DIFFICULTY.bigFlowerProbabilityPerLevel * (level - 1)
        )
      : 0;
  const isBig = Math.random() < bigProbability;
  const rMin = isBig ? DIFFICULTY.bigFlowerRadiusMin : DIFFICULTY.flowerRadiusMin;
  const rMax = isBig ? DIFFICULTY.bigFlowerRadiusMax : DIFFICULTY.flowerRadiusMax;
  const growTime = isBig ? DIFFICULTY.bigFlowerGrowTime : DIFFICULTY.flowerGrowTime;
  const wiltSpeed = levelValue(
    DIFFICULTY.wiltSpeedStart,
    DIFFICULTY.wiltSpeedPerLevel,
    DIFFICULTY.wiltSpeedCap
  );
  const color = getRgbSpreadHex(laserConfig.testColor, isBig ? 0.2 : 0.3, 0.7, 0.95);
  const bloomColor = getRgbSpreadHex(laserConfig.testColor, isBig ? 0.75 : 0.85, 0.6, 1);
  const stemColor = getRgbSpreadHex(laserConfig.testColor, 0.35, 0.8, 0.6);
  const wiltColor = getRgbSpreadHex(laserConfig.testColor, 0.12, 0.5, 0.45);

  const plant = { kind: 'flower', isBig, phase: 'grow', bloomTimer: 0, removed: false };

  const button = guiPixelFillButton({
    label: '',
    posX: plot.x,
    posY: groundY - rMin - 40,
    radius: rMin,
    edges: isBig ? 10 : 8,
    edges2: 5,
    lineWidth: 4,
    fullPercent: DIFFICULTY.fullPercent,
    speedUp: 100 / growTime,
    speedDown: wiltSpeed,
    minValue: 0,
    activeValue: DIFFICULTY.flowerActiveValue,
    normalColor: color,
    growColor: color,
    activeColor: bloomColor,
    onEnterActive: () => {
      if (plant.removed || plant.phase !== 'grow') return;
      plant.phase = 'bloom';
      plant.bloomTimer = 0;
      const points = isBig ? DIFFICULTY.scoreBigBloom : DIFFICULTY.scoreBloom;
      score += points;
      stats.blooms++;
      addFloatingText(`+${points}`, plot.x, button.getY() - rMax, bloomColor);
      playSound(soundBloom);
    },
  });
  button.setValue(DIFFICULTY.flowerStartValue);

  const handleOriginal = button.handle;
  button.handle = (grid, elapsed) => {
    const ctx = MasterCanvas.get2dContext();
    if (plant.phase === 'bloom') {
      plant.bloomTimer += elapsed;
      if (plant.bloomTimer >= DIFFICULTY.bloomDuration) {
        freePlot(plotIndex, plant);
        return;
      }
      // Blüte bleibt voll, egal ob beleuchtet
      button.setValue(100);
    }

    const t = button.getValue() / 100;
    const radius =
      plant.phase === 'bloom' ? rMax * DIFFICULTY.bloomRadiusFactor : rMin + (rMax - rMin) * t;
    const headY = groundY - radius - 40 - DIFFICULTY.stemGrowth * t;
    button.setRadius(radius);
    button.setY(headY);

    const wilting = plant.phase === 'grow' && button.getValue() < DIFFICULTY.wiltWarnValue;
    button.setColor(wilting ? wiltColor : color);
    button.setGrowColor(wilting ? wiltColor : color);

    drawStem(ctx, plot.x, headY + radius, wilting ? wiltColor : stemColor, t);

    if (plant.phase === 'bloom') {
      // Blütenblätter rund um den Kopf, drehen sich langsam
      const petals = isBig ? 10 : 7;
      for (let k = 0; k < petals; k++) {
        const a = (k * 2 * Math.PI) / petals + plant.bloomTimer;
        util.drawNgon({
          ctx,
          color: bloomColor,
          Xcenter: plot.x + Math.cos(a) * radius * 1.15,
          Ycenter: headY + Math.sin(a) * radius * 1.15,
          size: radius * 0.35,
          numberOfSides: 12,
          lineWidth: 4,
        });
      }
    }

    handleOriginal(grid, elapsed);

    if (plant.phase === 'grow' && button.getValue() <= 0) {
      // verdorrt
      stats.withered++;
      freePlot(plotIndex, plant);
      addFloatingText('verdorrt! -1 Leben', plot.x, groundY - 150, wiltColor);
      playSound(soundWither);
      loseLife();
    }
  };

  plant.button = button;
  return plant;
}

function createWeed(plotIndex) {
  const plot = plots[plotIndex];
  const color = getRgbSpreadHex(laserConfig.testColor, 0.6, 0.9, 0.85);
  const angryColor = getRgbSpreadHex(laserConfig.testColor, 0.65, 1, 1);
  const stemColor = getRgbSpreadHex(laserConfig.testColor, 0.55, 0.8, 0.55);
  const lifetime = levelValue(
    DIFFICULTY.weedLifetimeStart,
    DIFFICULTY.weedLifetimePerLevel,
    DIFFICULTY.weedLifetimeCap
  );
  const rMin = DIFFICULTY.weedRadiusMin;
  const rMax = DIFFICULTY.weedRadiusMax;

  const plant = { kind: 'weed', unlitTimer: 0, angle: Math.random() * Math.PI * 2, removed: false };

  const button = guiPixelFillButton({
    label: '',
    posX: plot.x,
    posY: groundY - rMin - 20,
    radius: rMin,
    edges: 3,
    edges2: 3,
    lineWidth: 5,
    fullPercent: DIFFICULTY.fullPercent,
    speedUp: 100 / DIFFICULTY.weedSpreadTime,
    speedDown: DIFFICULTY.weedDecay,
    minValue: 0,
    activeValue: 95,
    counterReset: true, // kann mehrfach wuchern
    normalColor: color,
    growColor: angryColor,
    activeColor: angryColor,
    onEnterActive: () => {
      if (plant.removed) return;
      spreadWeed(plotIndex);
    },
  });

  const handleOriginal = button.handle;
  button.handle = (grid, elapsed) => {
    const ctx = MasterCanvas.get2dContext();
    const t = button.getValue() / 100;
    // dreht sich schneller, je mehr Licht es bekommt
    plant.angle += elapsed * (0.5 + t * 4);
    button.setAngle(plant.angle);
    const radius = rMin + (rMax - rMin) * t;
    const headY = groundY - radius - 20 - DIFFICULTY.weedStemGrowth * t;
    button.setRadius(radius);
    button.setY(headY);

    drawZigzagStem(ctx, plot.x, headY + radius, stemColor);

    handleOriginal(grid, elapsed);
    if (plant.removed) return;

    if (button.getFillPercent() > 0) {
      plant.unlitTimer = 0;
    } else {
      plant.unlitTimer += elapsed;
    }
    // kurz vor dem Vertrocknen blasser werden
    const dying = plant.unlitTimer > lifetime - 2;
    button.setColor(dying ? stemColor : color);
    if (plant.unlitTimer >= lifetime) {
      freePlot(plotIndex, plant);
      addFloatingText('vertrocknet', plot.x, headY, stemColor);
    }
  };

  plant.button = button;
  return plant;
}

/** Unkraut auf Platz plotIndex wuchert auf einen Nachbarplatz */
function spreadWeed(plotIndex) {
  const candidates = [plotIndex - 1, plotIndex + 1].filter((i) => {
    if (i < 0 || i >= plots.length) return false;
    const p = plots[i].plant;
    // kein Unkraut auf Unkraut, Blüten sind schon "geerntet"
    return !p || (p.kind === 'flower' && p.phase === 'grow');
  });
  if (candidates.length === 0) return;
  const target = candidates[Math.floor(Math.random() * candidates.length)];
  const targetPlot = plots[target];
  stats.spreads++;
  let penalty = DIFFICULTY.penaltySpread;
  if (targetPlot.plant) {
    stats.displaced++;
    penalty += DIFFICULTY.penaltyDisplaced;
    targetPlot.plant.removed = true;
  }
  score -= penalty;
  targetPlot.plant = createWeed(target);
  targetPlot.cooldown = 0;
  addFloatingText(
    `Wucherung! -${penalty}`,
    targetPlot.x,
    groundY - 250,
    getRgbSpreadHex(laserConfig.testColor, 0.6, 0.9, 0.85)
  );
  playSound(soundWeed);
}

function plantSomething() {
  const free = [];
  plots.forEach((plot, i) => {
    if (!plot.plant && plot.cooldown <= 0) free.push(i);
  });
  if (free.length === 0) return;
  const index = free[Math.floor(Math.random() * free.length)];
  const weedProbability = levelValue(
    DIFFICULTY.weedProbabilityStart,
    DIFFICULTY.weedProbabilityPerLevel,
    DIFFICULTY.weedProbabilityCap
  );
  plots[index].plant =
    Math.random() < weedProbability ? createWeed(index) : createFlower(index);
}

function resetGame() {
  gameState = 'game';
  hasPlayed = true;
  gameTime = 0;
  level = 1;
  score = 0;
  lives = DIFFICULTY.lives;
  spawnTimer = 0;
  stats = { blooms: 0, withered: 0, spreads: 0, displaced: 0 };
  floatingTexts = [];
  plots = createPlots();
  // ein paar Blumen auf zufälligen Plätzen vorpflanzen
  const indices = plots.map((p, i) => i).sort(() => Math.random() - 0.5);
  indices.slice(0, DIFFICULTY.startFlowers).forEach((i) => {
    plots[i].plant = createFlower(i);
  });
  lastTime = performance.now();
}

const createButtonsGameOverScreen = () => [
  guiFillButton({
    label: 'Start',
    posX: 1920 / 2,
    posY: 1080 / 2 + 250,
    radius: 150,
    edges: 8,
    edges2: 5,
    speedUp: 25,
    speedDown: 12,
    activeValue: 90,
    keyCode: 'Space',
    normalColor: getRgbSpreadHex(laserConfig.testColor, 0.3),
    activeColor: getRgbSpreadHex(laserConfig.testColor, 0.35),
    growColor: getRgbSpreadHex(laserConfig.testColor, 0.4),
    onEnterActive: () => resetGame(),
  }),
];

function renderClouds(ctx, elapsed) {
  const color = getRgbSpreadHex(laserConfig.testColor, 0.5, 0.15, 0.35);
  ctx.save();
  ctx.fillStyle = color;
  clouds.forEach((cloud) => {
    cloud.x += cloud.speed * elapsed;
    if (cloud.x - 200 * cloud.scale > 1920) {
      cloud.x = -200 * cloud.scale;
      cloud.y = 120 + Math.random() * 300;
    }
    const s = cloud.scale;
    ctx.beginPath();
    ctx.arc(cloud.x, cloud.y, 60 * s, 0, 2 * Math.PI);
    ctx.arc(cloud.x + 70 * s, cloud.y + 10 * s, 50 * s, 0, 2 * Math.PI);
    ctx.arc(cloud.x - 70 * s, cloud.y + 15 * s, 45 * s, 0, 2 * Math.PI);
    ctx.fill();
  });
  ctx.restore();
}

function renderBed(ctx) {
  ctx.save();
  ctx.fillStyle = getRgbSpreadHex(laserConfig.testColor, 0.1, 0.6, 0.3);
  ctx.fillRect(0, groundY, 1920, 1080 - groundY);
  ctx.restore();
  // Erdhügel für jeden Pflanzplatz
  plots.forEach((plot) => {
    util.drawNgon({
      ctx,
      color: getRgbSpreadHex(laserConfig.testColor, 0.1, 0.6, 0.5),
      Xcenter: plot.x,
      Ycenter: groundY + 30,
      size: 45,
      numberOfSides: 6,
      lineWidth: 3,
    });
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
  name: 'LS Sonnenblumen ',
  description: `
LANDWIRTSCHAFT SIMULATOR


Eure Laser sind das Sonnenlicht, 
die Pflanzen WOLLEN beleuchtet werden

Ohne Licht welken Blumen langsam 
und verdorren

Unkraut NICHT anleuchten 
sonst wuchert es`,
  image: 'media/img/gametitles/laser-paradise-###4###.png',

  init: function () {
    gameState = 'gameover';
    hasPlayed = false;
    lastTime = 0;
    plots = createPlots();
    clouds = createClouds();
    floatingTexts = [];
    buttonsGameOverScreen = createButtonsGameOverScreen();
  },

  stop: function () {
    activeSounds.forEach((audio) => audio.pause());
    activeSounds = [];
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
    renderClouds(ctx, elapsed);
    buttonsGameOverScreen.forEach((item) => item.handle(grid, elapsed));
    util.renderTextDropShadow({
      ctx,
      text: 'Laser-Gärtner',
      fontSize: '150px',
      fillStyle: getRgbSpreadHex(laserConfig.testColor, 0.3),
      x: laserConfig.canvasResolution.width / 2,
      y: 200,
    });
    const text = hasPlayed
      ? `Der Garten ist verdorrt! Level ${level} erreicht nach ${gameTime.toFixed(1)}s.
${score} Punkte - ${stats.blooms} Blüten - ${stats.withered} verdorrte Blumen
${stats.spreads} Wucherungen (${stats.displaced} Blumen verdrängt)`
      : `Ihr seid die Sonne: Blumen anleuchten, bis sie blühen!
Unkraut im Schatten lassen, sonst wuchert es.`;
    util.renderTextDropShadow({
      ctx,
      text,
      fontSize: '45px',
      lineHeight: 70,
      dropDistX: 5,
      dropDistY: 5,
      fillStyle: getRgbSpreadHex(laserConfig.testColor, 0.4),
      x: laserConfig.canvasResolution.width / 2,
      y: 350,
    });
  },

  handleGameScreen(grid, elapsed) {
    gameTime += elapsed;
    const ctx = MasterCanvas.get2dContext();

    const newLevel = 1 + Math.floor(gameTime / DIFFICULTY.levelDuration);
    if (newLevel !== level) {
      level = newLevel;
      addFloatingText(`Level ${level}`, 1920 / 2, 300, getRgbSpreadHex(laserConfig.testColor, 0.4));
      playSound(soundLevelUp);
    }

    // Plätze abkühlen lassen und neu bepflanzen
    plots.forEach((plot) => {
      if (plot.cooldown > 0) plot.cooldown -= elapsed;
    });
    spawnTimer += elapsed;
    const spawnInterval = Math.max(
      DIFFICULTY.spawnIntervalMin,
      DIFFICULTY.spawnIntervalStart * Math.pow(DIFFICULTY.spawnIntervalFactor, level - 1)
    );
    if (spawnTimer >= spawnInterval) {
      spawnTimer = 0;
      plantSomething();
    }

    renderClouds(ctx, elapsed);
    renderBed(ctx);

    // Liste vorher einsammeln: Pflanzen können sich beim Handeln gegenseitig ersetzen
    const plants = plots.map((plot) => plot.plant).filter((plant) => plant);
    for (const plant of plants) {
      if (gameState !== 'game') break;
      if (plant.removed) continue;
      plant.button.handle(grid, elapsed);
    }

    renderFloatingTexts(ctx, elapsed);

    util.renderTextDropShadow({
      ctx,
      text: `Level ${level} - ${score} Punkte - Leben: ${lives} - ${gameTime.toFixed(0)}s`,
      fontSize: '45px',
      fillStyle: getRgbSpreadHex(laserConfig.testColor, 0.3),
      dropDistX: 4,
      dropDistY: 4,
      align: 'left',
      x: 60,
      y: 80,
    });
  },
};
