/**
 * Fractal-Oribts
 * 
 * // achtung aktuell noch kopie von 022 dem letzten von christian gemachtem game
 * 
 * hier geht es um folgendes>
 * 
 * / es werden orbits gezeigt, als verbundene linien mit punkten an den konkreten werten
 * // es wird random ein 3er orbit am anfang gezeigt, es gibt geschlossene und offene orbits
 * // mit cardioid methode werden koordinaten nah am rand gefunden
 * / und naja aufgabe ist es den punkt des orbits im mandelbrot mit der laser gruppe zu treffen
 * // es wird verschiedene hints geben, also es wird immer der orbit der laser mitte angezeigt
 * // wenn man nah dran ist pulsiert es im rythmus schneller quasi so ist die idee
 * //
 * // hier noch die anderen fraktal games die christian vorhat, er will ja 100 games schaffen, weia
 * // 
 * morgen fange ich den tag mit fraktal  spielen an>

1. tes spiel> nur die iteration x anleuchten mit den lasern
2. tes spiel> finde die julia position, es wird julia gezeigt, aufgabe ist die position im mandelbrot zu finden
3. mal sehen ki bis jetzt nur doofe vorschlaege gemacht
3tes wird was mit fraktal-simon, also iterationen leuchten auf, und man muss die zum leuchten bringen, wart ab wird geil fraktal
 * Alle Stellschrauben stehen gesammelt in DIFFICULTY.
 */

import util, {
  drawNgon,
  getRgbSpread,
  getRgbSpreadHex,
  removeItemFromArray,
} from '../util.js';
var laserConfig = require('../LaserApiConfig.js').default;
var MasterCanvas = require('../MasterCanvas.js').default;
var guiFillButton = require('./gui/fillButton.js').default;
import highscoreManager from '../util/highscore.js'
import soundSpawn from '../../../public/media/369952__mischy__plop-1.wav';

const highScoreInstance=highscoreManager("Fractal Bakery","Score");  // Make highscore instance, will be global until reloaded, but manages saving itself
const DIFFICULTY = {
  levelDuration: 20, // Sekunden pro Level
  // Anzahl gleichzeitig fallender Julias
  maxActiveStart: 4,
  maxActivePerLevel: 2,
  maxActiveCap: 24,
  // Spawn-Intervall in Sekunden
  spawnIntervalStart: 1.6,
  spawnIntervalFactor: 0.85, // pro Level
  spawnIntervalMin: 0.25,
  // Fallgeschwindigkeit in px/s
  fallSpeedMin: 80,
  fallSpeedRandom: 100,
  fallSpeedPerLevel: 0.12,
  fallSpeedCap: 2.5,
  goodProbability: 0.35,
  // Trefferzeit in Sekunden für einen einzelnen Laser
  badHitTime: 0.25,
  badHitTimePerLevel: 0.15,
  goodHitTime: 0.7, // gute Rosinen sind zäher, damit kurzes Drüberwischen nicht gleich verbrennt
  hitDecay: 1.2, // Trefferfortschritt-Abbau pro Sekunde ohne Treffer
  // Teamwork: ab wie vielen leuchtenden Grid-Zellen zählt es wie ein weiterer Laser
  hitCellsPerLaser: 4,
  hitMaxMultiplier: 3,
  // Teig-Auswirkungen in Vielfachen des Julia-Radius
  doughBadLands: 1.0,
  doughGoodBurned: 1.0,
  doughGoodLands: -0.5,
  // Farbhinweis (gut/schlecht) am Umriss bis einschliesslich diesem Level
  colorHintMaxLevel: 3,
};

const minDoughHeight = 100;
const maxDoughHeight = 600; // Verstopfungs-Linie = Game Over
const CLASSIFY_ITER = 150;
const RENDER_ITER = 80;

var doughHeight = minDoughHeight;
var doughTargetHeight = minDoughHeight;
var activePlops = [];
var floatingTexts = [];
var pieces = [];
var breads = [];
var buttonsGameOverScreen = [];
var gameState = 'game';
var gameTime = 0;
var gameScore = 0;
var level = 1;
var spawnTimer = 0;
var breadSpawnTimer = 0;
const breadSpawnInterval = 1.5;
var stats = { shot: 0, burned: 0, raisins: 0, clumps: 0 };
var legend = undefined;
var lastTime = 0;

function getDelta() {
  var currentTime = performance.now();
  if (lastTime === 0) {
    lastTime = currentTime;
    return 0;
  }
  const elapsed = (currentTime - lastTime) / 1000;
  lastTime = currentTime;
  // gegen Sprünge nach Tab-Inaktivität
  return Math.min(elapsed, 0.1);
}

function levelValue(start, perLevel, cap) {
  return Math.min(cap, start + perLevel * (level - 1));
}

/** Escape-Zeit von c=(cr,ci) unter z->z^2+c mit z0=0, maxIter = beschränkt */
function escapeIter(cr, ci, maxIter) {
  let zr = 0,
    zi = 0,
    i = 0;
  while (zr * zr + zi * zi <= 4 && i < maxIter) {
    const temp = zr * zr - zi * zi + cr;
    zi = 2 * zr * zi + ci;
    zr = temp;
    i++;
  }
  return i;
}

/** true wenn der Seed und alle Nachbarn im Abstand margin in der Mandelbrotmenge liegen */
function isDeepInside(cr, ci, margin) {
  if (escapeIter(cr, ci, CLASSIFY_ITER) < CLASSIFY_ITER) return false;
  if (margin <= 0) return true;
  for (let k = 0; k < 8; k++) {
    const a = (k * Math.PI) / 4;
    if (
      escapeIter(cr + Math.cos(a) * margin, ci + Math.sin(a) * margin, CLASSIFY_ITER) <
      CLASSIFY_ITER
    ) {
      return false;
    }
  }
  return true;
}

/**
 * sucht einen Seed passend zum Level: am Anfang klar unterscheidbar
 * (tief drinnen bzw. schnell entkommend), später immer näher am Rand
 */
function pickSeed(wantGood, lvl) {
  const margin = Math.max(0.01, 0.1 - 0.012 * (lvl - 1));
  const maxEsc = Math.min(40, 6 + 3 * (lvl - 1));
  const minEsc = Math.max(3, Math.floor(maxEsc / 2));
  for (let tries = 0; tries < 300; tries++) {
    const sr = -2 + Math.random() * 2.6;
    const si = -1.2 + Math.random() * 2.4;
    if (wantGood) {
      if (isDeepInside(sr, si, margin)) return { sr, si };
    } else {
      const n = escapeIter(sr, si, CLASSIFY_ITER);
      if (n >= minEsc && n <= maxEsc) return { sr, si };
    }
  }
  return wantGood ? { sr: -0.1, si: 0.2 } : { sr: 0.4, si: 0.4 };
}

/** rendert eine Julia-Menge in ein eigenes Canvas mit transparentem Hintergrund */
function renderJuliaSprite(size, seedr, seedi,renderModeOneOrTwo) {
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');
  const imgData = ctx.createImageData(size, size);
  const d = imgData.data;
  const tint = getRgbSpread(laserConfig.testColor, 0.6, 0.5, 1);
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      let zr = ((x - size / 2) * 3.5) / size;
      let zi = ((y - size / 2) * 3.5) / size;
      let i = 0;
      while (zr * zr + zi * zi <= 4 && i < RENDER_ITER) {
        const temp = zr * zr - zi * zi + seedr;
        zi = 2 * zr * zi + seedi;
        zr = temp;
        i++;
      }

      if(renderModeOneOrTwo){
      const idx = (y * size + x) * 4;
      if (i === RENDER_ITER) {
        d[idx] = 255;
        d[idx + 1] = 255;
        d[idx + 2] = 255;
        d[idx + 3] = 255;
      } else {
        const f = Math.sqrt(i / RENDER_ITER);
        d[idx] = tint[0] * f;
        d[idx + 1] = tint[1] * f;
        d[idx + 2] = tint[2] * f;
        d[idx + 3] = Math.min(255, f * 400);
      }
    }else{

{
      const idx = (y * size + x) * 4;
      if (i === RENDER_ITER) {
        d[idx] = 255;
        d[idx + 1] = 255;
        d[idx + 2] = 255;
        d[idx + 3] = 255;
      } else {
        let f =  Math.sqrt(i / RENDER_ITER);
        if(i>2&&i%4==1){
          f=1-f;
        }
        d[idx] = tint[0] * f;
        d[idx + 1] = tint[1] * f;
        d[idx + 2] = tint[2] * f;
        d[idx + 3] = Math.min(255, f * 400);
      }
    }

    }
    }
  }
  ctx.putImageData(imgData, 0, 0);
  return canvas;
}

/** wie fillButton, aber zählt die leuchtenden Grid-Zellen im Kreis (mehr Laser = mehr Wirkung) */
function countHitCells(grid, x, y, radius) {
  const gridSize = Math.floor(Math.sqrt(grid.length));
  const factx = MasterCanvas.getCanvas().width / gridSize;
  const facty = MasterCanvas.getCanvas().height / gridSize;
  const r = radius + Math.max(factx, facty) / 2;
  const x0 = Math.max(0, Math.floor((x - r) / factx));
  const x1 = Math.min(gridSize - 1, Math.floor((x + r) / factx));
  const y0 = Math.max(0, Math.floor((y - r) / facty));
  const y1 = Math.min(gridSize - 1, Math.floor((y + r) / facty));
  let hits = 0;
  for (let gy = y0; gy <= y1; gy++) {
    for (let gx = x0; gx <= x1; gx++) {
      if (grid[gx + gy * gridSize] > 0) {
        const dx = (gx + 0.5) * factx - x;
        const dy = (gy + 0.5) * facty - y;
        if (dx * dx + dy * dy <= r * r) hits++;
      }
    }
  }
  return hits;
}

function addFloatingText(text, x, y, color) {
  floatingTexts.push({ text, x, y, time: 0, duration: 1.5, color });
}

function changeDough(delta) {
  doughTargetHeight = Math.max(minDoughHeight, doughTargetHeight + delta);
  if (doughTargetHeight >= maxDoughHeight) {
    doughTargetHeight = maxDoughHeight;
    gameState = 'gameover';
    buttonsGameOverScreen = createButtonsGameOverScreen();
    highScoreInstance.addEntry({
      "Score": gameScore,
      "Time":gameTime,
      "Level":level,
    
    })
  }
}

function playPlop() {
  var audio = new Audio(soundSpawn);
  audio.play().catch((e) => {console.error(e)});
}

function createPiece() {
  const isGood = Math.random() < DIFFICULTY.goodProbability;
  const { sr, si } = pickSeed(isGood, level);
  const radius = Math.random() * 50 + 25;
  const speed =
    (DIFFICULTY.fallSpeedMin + Math.random() * DIFFICULTY.fallSpeedRandom) *
    levelValue(1, DIFFICULTY.fallSpeedPerLevel, DIFFICULTY.fallSpeedCap);
  const hitTime = isGood
    ? DIFFICULTY.goodHitTime
    : DIFFICULTY.badHitTime *
      (1 + DIFFICULTY.badHitTimePerLevel * (level - 1)) *
      (radius / 50);
  const showHint = level <= DIFFICULTY.colorHintMaxLevel;
  const hintColor = showHint
    ? getRgbSpreadHex(laserConfig.testColor, isGood ? 0.4 : 0.6, 0.9, 0.9)
    : getRgbSpreadHex(laserConfig.testColor, isGood ? 0.45 : 0.55, 0.5, 0.9);
  const sprite = renderJuliaSprite(Math.floor(radius * 2), sr, si);
  const edges = 3 + Math.round(Math.random() * 12);
  let x = Math.random() * (1920 - 750) + 375;
  let y = -radius;
  let hit = 0;

  const piece = {
    isGood,
    handle(grid, elapsed, ctx) {
      y += speed * elapsed;

      const cells = countHitCells(grid, x, y, radius);
      if (cells > 0) {
        const power = Math.min(
          DIFFICULTY.hitMaxMultiplier,
          Math.max(1, cells / DIFFICULTY.hitCellsPerLaser)
        );
        hit += (power * elapsed) / hitTime;
      } else {
        hit = Math.max(0, hit - DIFFICULTY.hitDecay * elapsed);
      }

      if (hit >= 1) {
        removeItemFromArray(pieces, piece);
        if (isGood) {
          stats.burned++;
          changeDough(radius * DIFFICULTY.doughGoodBurned);
          addFloatingText('Raisin burnt!', x, y, '#ffffff');
        } else {
          stats.shot++;
          addFloatingText('+', x, y, hintColor);
          playPlop();
        }
        return;
      }

      if (y > 1080 - doughHeight) {
        removeItemFromArray(pieces, piece);
        if (isGood) {
          stats.raisins++;
          changeDough(radius * DIFFICULTY.doughGoodLands);
          addFloatingText('yummy', x, y - 40, hintColor);
        } else {
          stats.clumps++;
          changeDough(radius * DIFFICULTY.doughBadLands);
          addFloatingText('clumpy', x, y - 40, '#ffffff');
        }
        activePlops.push({ time: 0, duration: 1.0, maxAmplitude: 50, posX: x });
        return;
      }

      ctx.drawImage(sprite, x - radius, y - radius);
      // gute Rosinen blinken weiss, sobald sie beschossen werden
      const warn = isGood && hit > 0 && Math.floor(gameTime * 10) % 2 === 0;
      const color = warn ? '#ffffff' : hintColor;
      drawNgon({
        ctx,
        color,
        Xcenter: x,
        Ycenter: y,
        size: radius,
        numberOfSides: edges,
        lineWidth: warn ? 6 : 3,
      });
      if (hit > 0) {
        drawNgon({
          ctx,
          color,
          Xcenter: x,
          Ycenter: y,
          size: radius * hit,
          numberOfSides: edges,
          lineWidth: 3,
        });
      }
    },
  };
  return piece;
}

/**
 * die breads machen wir als visuelles element, ohne interaktionsmoeglichkeit,
 * idee ist halt sie werden gespawnet, laufen nach rechts und sterben :D
 * je niedriger der Teig, desto näher am Original-Mandelbrot und desto mehr Punkte
 */
function renderMandelbrotSprite(size, seedr, seedi, maxIter = 100) {
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');
  const imgData = ctx.createImageData(size, size);
  const d = imgData.data;
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      let zr = seedr,
        zi = seedi;
      const cr = ((x - size / 2) * 3.5) / size - 0.5;
      const ci = ((y - size / 2) * 3.5) / size;
      let i = 0;
      while (zr * zr + zi * zi <= 4 && i < maxIter) {
        const temp = zr * zr - zi * zi + cr;
        zi = 2 * zr * zi + ci;
        zr = temp;
        i++;
      }
      const idx = (y * size + x) * 4;
      const color = i === maxIter ? 255 : (i * 255) / maxIter;
      d[idx] = color;
      d[idx + 1] = color;
      d[idx + 2] = color;
      d[idx + 3] = i === maxIter ? 255 : Math.min(255, color * 3);
    }
  }
  ctx.putImageData(imgData, 0, 0);
  return canvas;
}

function createBread() {
  let posX = 250;
  const posY = 975;
  const ctx = MasterCanvas.get2dContext();
  // der seed ist random normalisierte teighoehe, also max ist 1 quasi
  const norm = (doughHeight - minDoughHeight) / (maxDoughHeight - minDoughHeight);
  const seedR = Math.random() * norm;
  const seedI = Math.random() * norm;
  const sprite = renderMandelbrotSprite(64, seedR, seedI);
  const bread = (elapsed) => {
    ctx.drawImage(sprite, Math.trunc(posX), posY);
    posX += 100 * elapsed;
    if (posX > 1920) {
      removeItemFromArray(breads, bread);
      gameScore += 1 - Math.min(1, Math.sqrt(seedR * seedR + seedI * seedI));
    }
  };
  breads.push(bread);
}

function createLegend() {
  const good = pickSeed(true, 1);
  const bad = pickSeed(false, 1);
  return {
    good: renderJuliaSprite(100, good.sr, good.si,true),
    bad: renderJuliaSprite(100, bad.sr, bad.si,false),
  };
}

function resetGame() {
  gameState = 'game';
  gameTime = 0;
  gameScore = 0;
  level = 1;
  spawnTimer = DIFFICULTY.spawnIntervalStart;
  breadSpawnTimer = 0;
  doughHeight = minDoughHeight;
  doughTargetHeight = minDoughHeight;
  activePlops = [];
  floatingTexts = [];
  pieces = [];
  breads = [];
  stats = { shot: 0, burned: 0, raisins: 0, clumps: 0 };
  legend = createLegend();
  lastTime = performance.now();
}

const createButtonsGameOverScreen = () => [
  guiFillButton({
    label: '',
    posX: 1920 / 2,
    posY: 1080 / 2 + 250,
    speedDown: 12,
    keyCode: 'Space',
    speedUp: 25,
    edges: Math.floor(3 + Math.random() * 8),
    edges2: undefined,
    angle: Math.random() * 360,
    activeValue: 90,
    radius: 150,
    normalColor: getRgbSpreadHex(laserConfig.testColor, 0.4),
    activeColor: getRgbSpreadHex(laserConfig.testColor, 0.5),
    growColor: getRgbSpreadHex(laserConfig.testColor, 0.6),
    onEnterActive: () => resetGame(),
    onExitActive: () => {},
  }),
];

function renderDough(ctx, elapsed) {
  for (let i = activePlops.length - 1; i >= 0; i--) {
    activePlops[i].time += elapsed;
    if (activePlops[i].time >= activePlops[i].duration) {
      activePlops.splice(i, 1);
    }
  }

  // weiche Interpolation von doughHeight hin zu doughTargetHeight
  const lerpSpeed = 6.0;
  doughHeight += (doughTargetHeight - doughHeight) * Math.min(1, lerpSpeed * elapsed);

  // wabernde Teig-Sinuskurve mit kreisförmig expandierenden Wellen
  ctx.save();
  ctx.fillStyle = getRgbSpreadHex(laserConfig.testColor, 0.3);
  ctx.beginPath();
  ctx.moveTo(0, 1080);
  const waveFrequency = 0.005;
  const waveAmplitude = 25;
  const currentBaseY = 1080 - doughHeight;
  for (let x = 0; x <= 1920; x += 10) {
    let y = currentBaseY + Math.sin(x * waveFrequency + gameTime * 3) * waveAmplitude;
    activePlops.forEach((plop) => {
      const progress = plop.time / plop.duration;
      const timeFade = Math.sin(progress * Math.PI);
      const distFromCenter = Math.abs(x - plop.posX);
      const wavefront = plop.time * 250;
      const ringDist = distFromCenter - wavefront;
      const ringWidth = 80;
      const bell = Math.exp(-(ringDist * ringDist) / (ringWidth * ringWidth));
      const ripple = bell * Math.cos(ringDist * 0.08);
      const spatialFade = Math.max(0, 1 - distFromCenter / 450);
      y -= ripple * plop.maxAmplitude * timeFade * spatialFade;
    });
    ctx.lineTo(x, y);
  }
  ctx.lineTo(1920, 1080);
  ctx.closePath();
  ctx.fill();
  ctx.restore();

  // Verstopfungs-Linie
  const dangerY = 1080 - maxDoughHeight;
  ctx.save();
  ctx.setLineDash([30, 20]);
  ctx.lineWidth = 4;
  ctx.strokeStyle = getRgbSpreadHex(laserConfig.testColor, 0.75, 0.6, 0.3);
  ctx.beginPath();
  ctx.moveTo(300, dangerY);
  ctx.lineTo(1620, dangerY);
  ctx.stroke();
  ctx.restore();
  util.renderText({
    ctx,
    text: 'chlumpy',
    fontSize: '30px',
    align: 'right',
    fillStyle: getRgbSpreadHex(laserConfig.testColor, 0.5, 0.6, 0.4),
    x: 1620,
    y: dangerY - 10,
  });
}

function renderBakery(ctx) {
  // Seitenwände für den Tunnelblick
  ctx.save();
  ctx.fillStyle = '#2b1a0e';
  ctx.beginPath();
  ctx.moveTo(0, 0);
  ctx.lineTo(250, 1080);
  ctx.lineTo(0, 1080);
  ctx.fill();
  ctx.beginPath();
  ctx.moveTo(1920, 0);
  ctx.lineTo(1670, 1080);
  ctx.lineTo(1920, 1080);
  ctx.fill();
  ctx.restore();

  // Ofen links
  ctx.save();
  ctx.fillStyle = '#4a2c11';
  ctx.fillRect(0, 700, 300, 380);
  ctx.fillStyle = '#ff5500';
  ctx.shadowColor = '#ff5500';
  ctx.shadowBlur = 30;
  ctx.fillRect(50, 750, 200, 280);
  ctx.restore();

  // Förderband
  ctx.save();
  ctx.strokeStyle = '#555';
  ctx.lineWidth = 15;
  ctx.beginPath();
  ctx.moveTo(250, 1050);
  ctx.lineTo(1920, 1050);
  ctx.stroke();
  ctx.restore();
}

function renderLegend(ctx) {
  if (!legend) return;
  const x = 1870;
  ctx.drawImage(legend.good, x - 100, 130);
  ctx.drawImage(legend.bad, x - 100, 280);
  util.renderTextDropShadow({
    ctx,
    text: 'enjoy',
    fontSize: '30px',
    lineHeight: 35,
    align: 'right',
    dropDistX: 3,
    dropDistY: 3,
    fillStyle: getRgbSpreadHex(laserConfig.testColor, 0.3, 0.9, 0.9),
    x: x - 120,
    y: 175,
  });
  util.renderTextDropShadow({
    ctx,
    text: 'destroy',
    fontSize: '30px',
    lineHeight: 35,
    align: 'right',
    dropDistX: 3,
    dropDistY: 3,
    fillStyle: getRgbSpreadHex(laserConfig.testColor, 0.6, 0.9, 0.9),
    x: x - 120,
    y: 325,
  });
}

export default {
  name: 'Fractal-Orbits',
  description: `
Aufgabe ist es den Orbit im Mandelbrot zu finden

Es wird eine julia menge
links oben

Und der orbit dieser julia menge
rechts oben 

angezeigt
aufgabe ist

die stelle in der jeweiligen
Mandelbrot uebersicht zu finden

aber achtung:
es sind sehr viele unterschiedliche base mandelbrote implementiert
phoenix, burnings ship usw...

`,

image: 'media/img/gametitles/laser-fire-###4###.png',
  init: function () {
    console.log('init game fractal orbits');
    resetGame();
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
      text: 'Fractal-Bakery',
      fontSize: '150px',
      fillStyle: getRgbSpreadHex(laserConfig.testColor, 0.4,0.5,1.),
      x: laserConfig.canvasResolution.width / 2,
      y: 200,
    });
    util.renderTextDropShadow({
      ctx,
      text: `Ihr habt ${gameTime.toFixed(1)}s mandelbrot locations identifiziert und Level ${level} erreicht.
Insgesamt N Orbits klassifiziert, danke ey!`,
      fontSize: '45px',
      lineHeight: 70,
      dropDistX: 5,
      dropDistY: 5,
      fillStyle: getRgbSpreadHex(laserConfig.testColor, 0.5,0.5,1),
      x: laserConfig.canvasResolution.width / 2,
      y: 350,
    });
    
    highScoreInstance.renderHighAndLowScores(ctx)
  },

  handleGameScreen(grid, elapsed) {
    gameTime += elapsed;
    const ctx = MasterCanvas.get2dContext();

    const newLevel = 1 + Math.floor(gameTime / DIFFICULTY.levelDuration);
    if (newLevel !== level) {
      level = newLevel;
      addFloatingText(`Level ${level}`, 1920 / 2, 300, getRgbSpreadHex(laserConfig.testColor, 0.4,0.5,1));
      if (level > DIFFICULTY.colorHintMaxLevel) {
        legend = undefined;
      }
    }

    // Julias spawnen
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
    if (spawnTimer >= spawnInterval && pieces.length < maxActive) {
      spawnTimer = 0;
      pieces.push(createPiece());
    }

    breadSpawnTimer += elapsed;
    if (breadSpawnTimer >= breadSpawnInterval) {
      breadSpawnTimer = 0;
      createBread();
    }

    renderDough(ctx, elapsed);
    renderBakery(ctx);

    // Kopien, da sich die Arrays beim Iterieren verändern
    pieces.slice().forEach((piece) => piece.handle(grid, elapsed, ctx));
    breads.slice().forEach((bread) => bread(elapsed));

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

    renderLegend(ctx);

    util.renderTextDropShadow({
      ctx,
      text: `Level ${level} - ${gameTime.toFixed(1)}s - ${gameScore.toFixed(1)} Mandelbrötchen`,
      fontSize: '50px',
      fillStyle: getRgbSpreadHex(laserConfig.testColor, 0.3,0.5,1),
      align: 'left',
      x: 200,
      y: 100,
    });
  },
};