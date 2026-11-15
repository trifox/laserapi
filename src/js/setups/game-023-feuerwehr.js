/**
 * Laser-Feuerwehr
 *
 * Eine Häuserzeile mit vier Häusern (je 3x3 Fenster) steht in Flammen:
 * - in zufälligen Fenstern brechen Brände aus. Jeder Brand ist ein gui/pixelFillButton,
 *   dessen Radius mit der Zeit wächst. Gelöscht wird, indem man den Brand mit Lasern "füllt".
 * - die Füllrate hängt vom leuchtenden Flächenanteil ab: kleine Brände schafft ein Laser,
 *   große Brände brauchen mehrere Laser gleichzeitig (Teamwork, früh löschen lohnt sich).
 * - erreicht ein Brand den Maximalradius, springt er auf ein Nachbarfenster über
 *   (auch auf das Nachbarhaus).
 * - in manchen Fenstern sitzen Katzen (auch pixelFillButtons). Wer eine Katze nass spritzt,
 *   bekommt Punktabzug und die Katze flieht. Wildes Herumleuchten lohnt sich also nicht.
 * - jedes brennende Fenster erhöht den Brandschaden seines Hauses. Bei 100 % ist das Haus
 *   abgebrannt (grau), dort brennt nichts mehr. Sind alle Häuser abgebrannt: Game Over.
 * - alle DIFFICULTY.levelDuration Sekunden steigt das Level: mehr gleichzeitige Brände,
 *   kürzere Abstände, schnelleres Wachstum.
 *
 * Alle Stellschrauben stehen gesammelt in DIFFICULTY.
 */

import util, { drawNgon, getRgbSpreadHex, removeItemFromArray } from '../util.js';
import highscoreManager from '../util/highscore.js'
var laserConfig = require('../LaserApiConfig.js').default;
var MasterCanvas = require('../MasterCanvas').default;
var guiFillButton = require('./gui/fillButton').default;
var guiPixelFillButton = require('./gui/pixelFillButton').default;
import soundPlop from '../../../public/media/369952__mischy__plop-1.wav';
import soundExplosion from '../../../public/media/414346__bykgames__explosion-far.wav';
import soundLevelUp from '../../../public/media/opengameart/Level Up.ogg';
import soundError from '../../../public/media/opengameart/Menu Error.ogg';  
const DIFFICULTY = {
  levelDuration: 25, // Sekunden pro Level
  // Anzahl gleichzeitiger Brände (übergesprungene Brände zählen mit, werden aber nicht begrenzt)
  maxFiresStart: 2,
  maxFiresPerLevel: 1,
  maxFiresCap: 14,
  // Abstand zwischen neuen Bränden in Sekunden
  spawnIntervalStart: 4,
  spawnIntervalFactor: 0.85, // pro Level
  spawnIntervalMin: 0.8,
  // Brandgröße in Pixel
  fireRadiusStart: 40,
  fireRadiusMax: 95,
  // Wachstum in px/s, steigt pro Level um fireGrowPerLevel (relativ), gedeckelt
  fireGrowSpeed: 5,
  fireGrowPerLevel: 0.15,
  fireGrowCap: 3,
  // Sekunden, bis ein ausgewachsener Brand erneut überspringt
  spreadCooldown: 5,
  // Löschen: volle Löschrate ab fireFullPercent leuchtender Fläche
  fireFullPercent: 25,
  fireExtinguishTime: 1.0, // Sekunden bei voller Löschrate
  fireRecover: 35, // Löschfortschritt-Abbau pro Sekunde ohne Wasser
  // Brandschaden in Prozent pro Sekunde und Brand: damageBase + damageGrow * Wachstum (0..1)
  damageBase: 1.2,
  damageGrow: 2.5,
  // Punkte pro gelöschtem Brand: früh löschen gibt Bonus
  pointsBase: 10,
  pointsEarlyBonus: 20,
  // Katzen
  catSpawnInterval: 9,
  catMaxCount: 2,
  catStayTime: 15, // danach klettert die Katze von selbst weg
  catRadius: 50,
  catFullPercent: 25,
  catWetTime: 0.6, // Sekunden bei voller Bedeckung bis die Katze nass ist
  catRecover: 60,
  catPenalty: 25,
  catFleeSpeed: 400, // px/s
};

// Layout der Häuserzeile
const HOUSE_COUNT = 4;
const HOUSE_WIDTH = 380;
const HOUSE_TOP = 430;
const HOUSE_BOTTOM = 990;
const ROOF_HEIGHT = 120;
const WINDOW_DX = 115;
const WINDOW_ROWS_Y = [540, 680, 820];
const WINDOW_W = 80;
const WINDOW_H = 90;

var houses = [];
var windows = [];
var fires = [];
var cats = [];
var floatingTexts = [];
var activeSounds = [];
var buttonsGameOverScreen = [];
var gameState = 'gameover';
var hasPlayed = false;
var gameTime = 0;
var level = 1;
var score = 0;
var spawnTimer = 0;
var catTimer = 0;
var stats = { extinguished: 0, savedTime: 0, wetCats: 0, spread: 0 };
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

// Farben, alle von der Laserfarbe abgeleitet
const colors = () => ({
  fire: getRgbSpreadHex(laserConfig.testColor, 0.22, 1, 1),
  fireInner: getRgbSpreadHex(laserConfig.testColor, 0.26, 0.6, 1),
  fireGlow: getRgbSpreadHex(laserConfig.testColor, 0.22, 1, 0.35),
  water: getRgbSpreadHex(laserConfig.testColor, 0.55, 0.8, 1),
  cat: getRgbSpreadHex(laserConfig.testColor, 0.75, 0.5, 1),
  houseFill: getRgbSpreadHex(laserConfig.testColor, 0.6, 0.4, 0.18),
  houseLine: getRgbSpreadHex(laserConfig.testColor, 0.6, 0.4, 0.75),
  windowFill: getRgbSpreadHex(laserConfig.testColor, 0.55, 0.3, 0.12),
  hud: getRgbSpreadHex(laserConfig.testColor, 0.4),
  hud2: getRgbSpreadHex(laserConfig.testColor, 0.3),
});
var palette = {}; // wird in init()/resetGame() gesetzt, wenn testColor bekannt ist

function playSound(src) {
  const audio = new Audio(src);
  activeSounds.push(audio);
  audio.onended = () => removeItemFromArray(activeSounds, audio);
  audio.play().catch(() => {});
}

function addFloatingText(text, x, y, color) {
  floatingTexts.push({ text, x, y, time: 0, duration: 1.5, color });
}

function houseCenterX(h) {
  return 260 + h * ((1660 - 260) / (HOUSE_COUNT - 1));
}

/** Fenster als globales Raster: Spalte 0..(HOUSE_COUNT*3-1), Zeile 0..2 */
function createWindows() {
  const result = [];
  for (let h = 0; h < HOUSE_COUNT; h++) {
    for (let i = 0; i < 3; i++) {
      for (let row = 0; row < 3; row++) {
        result.push({
          house: h,
          col: h * 3 + i,
          row,
          x: houseCenterX(h) + (i - 1) * WINDOW_DX,
          y: WINDOW_ROWS_Y[row],
          fire: null,
          cat: null,
        });
      }
    }
  }
  return result;
}

function windowAt(col, row) {
  return windows.find((w) => w.col === col && w.row === row);
}

function isWindowFree(win) {
  return win && !houses[win.house].burnt && !win.fire && !win.cat;
}

function pickRandom(arr) {
  return arr.length > 0 ? arr[Math.floor(Math.random() * arr.length)] : undefined;
}

function pickFreeWindow() {
  return pickRandom(windows.filter(isWindowFree));
}

function drawFlames(ctx, x, y, radius, t) {
  ctx.save();
  ctx.globalAlpha = 0.35;
  for (let k = 0; k < 3; k++) {
    const size = radius * (0.9 - k * 0.25) * (1 + 0.08 * Math.sin(t * 9 + k * 2));
    drawNgon({
      ctx,
      numberOfSides: 5 + k,
      size,
      Xcenter: x + Math.sin(t * 5 + k) * 4,
      Ycenter: y - k * radius * 0.12,
      color: k === 2 ? palette.fireInner : palette.fire,
      filled: false,
      angle: t * (k + 1),
      lineWidth: 2,
    });
  }
  ctx.restore();
}

function drawCatFace(ctx, x, y, r, color) {
  ctx.save();
  ctx.strokeStyle = color;
  ctx.fillStyle = color;
  ctx.lineWidth = 4;
  // Ohren
  ctx.beginPath();
  ctx.moveTo(x - r * 0.75, y - r * 0.55);
  ctx.lineTo(x - r * 0.6, y - r * 1.2);
  ctx.lineTo(x - r * 0.2, y - r * 0.9);
  ctx.moveTo(x + r * 0.75, y - r * 0.55);
  ctx.lineTo(x + r * 0.6, y - r * 1.2);
  ctx.lineTo(x + r * 0.2, y - r * 0.9);
  ctx.stroke();
  // Augen
  drawNgon({ ctx, numberOfSides: 8, size: r * 0.14, Xcenter: x - r * 0.35, Ycenter: y - r * 0.15, color, filled: true, lineWidth: 2 });
  drawNgon({ ctx, numberOfSides: 8, size: r * 0.14, Xcenter: x + r * 0.35, Ycenter: y - r * 0.15, color, filled: true, lineWidth: 2 });
  // Schnurrhaare
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(x - r * 0.2, y + r * 0.2);
  ctx.lineTo(x - r * 0.9, y + r * 0.1);
  ctx.moveTo(x - r * 0.2, y + r * 0.28);
  ctx.lineTo(x - r * 0.9, y + r * 0.38);
  ctx.moveTo(x + r * 0.2, y + r * 0.2);
  ctx.lineTo(x + r * 0.9, y + r * 0.1);
  ctx.moveTo(x + r * 0.2, y + r * 0.28);
  ctx.lineTo(x + r * 0.9, y + r * 0.38);
  ctx.stroke();
  ctx.restore();
}

function removeFire(fire) {
  removeItemFromArray(fires, fire);
  if (fire.win.fire === fire) {
    fire.win.fire = null;
  }
}

function startFire(win) {
  const fire = createFire(win);
  win.fire = fire;
  fires.push(fire);
  return fire;
}

/** ein ausgewachsener Brand springt auf ein freies Nachbarfenster über (auch ins Nachbarhaus) */
function spreadFire(win) {
  const neighbours = [
    windowAt(win.col - 1, win.row),
    windowAt(win.col + 1, win.row),
    windowAt(win.col, win.row - 1),
    windowAt(win.col, win.row + 1),
  ].filter(isWindowFree);
  const target = pickRandom(neighbours);
  if (target) {
    startFire(target);
    stats.spread++;
    addFloatingText('übergesprungen!', target.x, target.y - 60, palette.fire);
  }
}

function createFire(win) {
  const growSpeed =
    DIFFICULTY.fireGrowSpeed * levelValue(1, DIFFICULTY.fireGrowPerLevel, DIFFICULTY.fireGrowCap);
  let radius = DIFFICULTY.fireRadiusStart;
  let spreadTimer = 0;
  let flicker = Math.random() * 10;
  const getGrowth = () =>
    (radius - DIFFICULTY.fireRadiusStart) /
    (DIFFICULTY.fireRadiusMax - DIFFICULTY.fireRadiusStart);

  // Löschen über den Flächenanteil: große Brände brauchen mehrere Laser
  const fire = guiPixelFillButton({
    label: '',
    posX: win.x,
    posY: win.y,
    radius,
    edges: 7,
    fullPercent: DIFFICULTY.fireFullPercent,
    speedUp: 100 / DIFFICULTY.fireExtinguishTime,
    speedDown: DIFFICULTY.fireRecover,
    minValue: 0,
    activeValue: 99,
    lineWidth: 5,
    normalColor: palette.fire,
    growColor: palette.water,
    activeColor: palette.water,
    onEnterActive: () => {
      const points = Math.round(
        DIFFICULTY.pointsBase + DIFFICULTY.pointsEarlyBonus * (1 - getGrowth())
      );
      score += points;
      stats.extinguished++;
      // so viele Sekunden hätte der Brand noch bis zum Überspringen gebraucht
      stats.savedTime += (DIFFICULTY.fireRadiusMax - radius) / growSpeed;
      removeFire(fire);
      addFloatingText(`+${points}`, win.x, win.y, palette.water);
      playSound(soundPlop);
    },
  });
  fire.win = win;
  fire.getGrowth = getGrowth;

  const handleOriginal = fire.handle;
  fire.handle = (grid, elapsed, ctx) => {
    flicker += elapsed;
    // solange gelöscht wird, wächst der Brand nicht
    if (fire.getValue() <= 0) {
      radius = Math.min(DIFFICULTY.fireRadiusMax, radius + growSpeed * elapsed);
      fire.setRadius(radius);
    }
    if (radius >= DIFFICULTY.fireRadiusMax) {
      spreadTimer -= elapsed;
      if (spreadTimer <= 0) {
        spreadTimer = DIFFICULTY.spreadCooldown;
        spreadFire(win);
      }
    }
    drawFlames(ctx, win.x, win.y, radius, flicker);
    fire.setAngle(flicker * 0.7);
    handleOriginal(grid, elapsed);
  };
  return fire;
}

function createCat(win) {
  let time = 0;
  let fleeing = false;
  let fleeDirX = Math.random() < 0.5 ? -1 : 1;
  const r = DIFFICULTY.catRadius;

  const cat = guiPixelFillButton({
    label: '',
    posX: win.x,
    posY: win.y + 5,
    radius: r,
    edges: 32,
    fullPercent: DIFFICULTY.catFullPercent,
    speedUp: 100 / DIFFICULTY.catWetTime,
    speedDown: DIFFICULTY.catRecover,
    minValue: 0,
    activeValue: 99,
    lineWidth: 4,
    normalColor: palette.cat,
    growColor: '#ffffff',
    activeColor: '#ffffff',
    onEnterActive: () => {
      score -= DIFFICULTY.catPenalty;
      stats.wetCats++;
      addFloatingText(`Miau! -${DIFFICULTY.catPenalty}`, cat.getX(), cat.getY() - 80, '#ffffff');
      playSound(soundError);
      cat.flee();
    },
  });
  cat.win = win;
  cat.flee = () => {
    if (fleeing) return;
    fleeing = true;
    if (win.cat === cat) win.cat = null;
  };

  const handleOriginal = cat.handle;
  cat.handle = (grid, elapsed, ctx) => {
    time += elapsed;
    if (fleeing) {
      // flieht nach oben über das Dach, ist dabei nicht mehr treffbar
      cat.setX(cat.getX() + fleeDirX * DIFFICULTY.catFleeSpeed * 0.4 * elapsed);
      cat.setY(cat.getY() - DIFFICULTY.catFleeSpeed * elapsed);
      drawNgon({
        ctx,
        numberOfSides: 32,
        size: r,
        Xcenter: cat.getX(),
        Ycenter: cat.getY(),
        color: palette.cat,
        lineWidth: 4,
      });
      drawCatFace(ctx, cat.getX(), cat.getY(), r, palette.cat);
      if (cat.getY() < -r * 2) {
        removeItemFromArray(cats, cat);
      }
      return;
    }
    if (time > DIFFICULTY.catStayTime) {
      cat.flee();
    }
    handleOriginal(grid, elapsed);
    // Gesicht blinkt weiß, sobald die Katze nass wird
    const warn = cat.getValue() > 0 && Math.floor(gameTime * 10) % 2 === 0;
    drawCatFace(ctx, cat.getX(), cat.getY(), r, warn ? '#ffffff' : palette.cat);
  };
  return cat;
}

function burnDownHouse(h) {
  const house = houses[h];
  house.damage = 100;
  house.burnt = true;
  fires.slice().forEach((fire) => {
    if (fire.win.house === h) removeFire(fire);
  });
  cats.forEach((cat) => {
    if (cat.win.house === h) cat.flee();
  });
  addFloatingText('abgebrannt!', houseCenterX(h), HOUSE_TOP - 40, '#ffffff');
  playSound(soundExplosion);
  if (houses.every((item) => item.burnt)) {
    gameOver();
  }
}
 
function gameOver() {
  
  highScoreInstance.addEntry({
  "Score":score, 
  "Saved Time":stats.savedTime,
  "Extinguished":stats.extinguished,
  "Level": level
})

  gameState = 'gameover';
  hasPlayed = true;
  buttonsGameOverScreen = createButtonsGameOverScreen();
}

function resetGame() {
  gameState = 'game';
  gameTime = 0;
  level = 1;
  score = 0; 



  palette = colors();
  houses = [];
  for (let h = 0; h < HOUSE_COUNT; h++) {
    houses.push({ damage: 0, burnt: false });
  }
  windows = createWindows();
  fires = [];
  cats = [];
  floatingTexts = [];
  // erster Brand nach einer Sekunde
  spawnTimer = DIFFICULTY.spawnIntervalStart - 1;
  catTimer = DIFFICULTY.catSpawnInterval * 0.5;
  stats = { extinguished: 0, savedTime: 0, wetCats: 0, spread: 0 };
  lastTime = performance.now();
}

const createButtonsGameOverScreen = () => [
  // Start per Laser
  guiFillButton({
    label: 'Start',
    posX: 1920 / 2,
    posY: 1080 / 2 + 350,
    radius: 150,
    edges: 6,
    speedUp: 25,
    speedDown: 12,
    activeValue: 90,
    normalColor: getRgbSpreadHex(laserConfig.testColor, 0.4),
    activeColor: getRgbSpreadHex(laserConfig.testColor, 0.5),
    growColor: getRgbSpreadHex(laserConfig.testColor, 0.6),
    onEnterActive: () => resetGame(),
  }),
  // Start per Leertaste (zum Testen ohne Laser), unsichtbar an derselben Stelle
  guiFillButton({
    label: '',
    posX: 1920 / 2,
    posY: 1080 / 2 + 250,
    radius: 150,
    keyCode: 'Space',
    visible: false,
    activeValue: 90,
    onEnterActive: () => resetGame(),
  }),
];

function renderHouses(ctx) {
  houses.forEach((house, h) => {
    const cx = houseCenterX(h);
    const left = cx - HOUSE_WIDTH / 2;
    ctx.save();
    ctx.lineWidth = 5;
    ctx.strokeStyle = house.burnt ? '#444444' : palette.houseLine;
    ctx.fillStyle = house.burnt ? '#1a1a1a' : palette.houseFill;
//    ctx.fillRect(left, HOUSE_TOP, HOUSE_WIDTH, HOUSE_BOTTOM - HOUSE_TOP);
    ctx.strokeRect(left, HOUSE_TOP, HOUSE_WIDTH, HOUSE_BOTTOM - HOUSE_TOP);
    // Dach
    ctx.beginPath();
    ctx.moveTo(left - 20, HOUSE_TOP);
    ctx.lineTo(cx, HOUSE_TOP - ROOF_HEIGHT);
    ctx.lineTo(left + HOUSE_WIDTH + 20, HOUSE_TOP);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    // Brandschaden-Leiste unter dem Haus
    const barY = HOUSE_BOTTOM + 15;
    const barH = 40;
    ctx.fillStyle = house.burnt ? '#444444' : palette.fire;
    ctx.fillRect(left, barY, (HOUSE_WIDTH * house.damage) / 100, barH);
    ctx.lineWidth = 3;
    ctx.strokeRect(left, barY, HOUSE_WIDTH, barH);
    ctx.restore();
    util.renderTextDropShadow({
      ctx,
      text: house.burnt ? 'abgebrannt' : `${Math.floor(house.damage)} %`,
      fontSize: '32px',
      dropDistX: 3,
      dropDistY: 3,
      fillStyle: '#ffffff',
      x: cx,
      y: barY + 32,
    });
  });

  windows.forEach((win) => {
    const burnt = houses[win.house].burnt;
    const x = win.x - WINDOW_W / 2;
    const y = win.y - WINDOW_H / 2;
    ctx.save();
    ctx.lineWidth = 3;
    ctx.strokeStyle = burnt ? '#333333' : palette.houseLine;
    ctx.fillStyle = burnt ? '#000000' : win.fire ? palette.fireGlow : palette.windowFill;
    ctx.fillRect(x, y, WINDOW_W, WINDOW_H);
    ctx.strokeRect(x, y, WINDOW_W, WINDOW_H);
    ctx.beginPath();
    if (burnt) {
      // verkohltes Fenster
      ctx.moveTo(x, y);
      ctx.lineTo(x + WINDOW_W, y + WINDOW_H);
      ctx.moveTo(x + WINDOW_W, y);
      ctx.lineTo(x, y + WINDOW_H);
    } else {
      // Fensterkreuz
      ctx.moveTo(win.x, y);
      ctx.lineTo(win.x, y + WINDOW_H);
      ctx.moveTo(x, win.y);
      ctx.lineTo(x + WINDOW_W, win.y);
    }
    ctx.stroke();
    ctx.restore();
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
const highScoreInstance=highscoreManager("FeuerWehr","Score");
export default {
  name: 'Feuerwehr (Opus55)',
  description: `
In der Häuserzeile brechen in den Fenstern Brände aus.

Euer Laser ist der Löschstrahl Brände wachsen mit der Zeit.

Früh löschen gibt mehr Punkte (10 bis 30 pro Brand).

Ausgewachsene Brände springen auf Nachbarfenster und Nachbarhäuser über.

Achtung: Katzen nicht ärgern!

Bei 100 % brennt das Haus ab. Sind alle Häuser abgebrannt, ist Game Over.`,
  image: 'media/img/gametitles/laser-fire-###4###.png',

  init: function () {
    console.log('init game laser feuerwehr');
    gameState = 'gameover';
    hasPlayed = false;
    palette = colors();
    lastTime = 0;
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
    buttonsGameOverScreen.forEach((item) => item.handle(grid, elapsed));
    util.renderTextDropShadow({
      ctx,
      text: 'Laser-Feuerwehr',
      fontSize: '150px',
      fillStyle: getRgbSpreadHex(laserConfig.testColor, 0.4),
      x: laserConfig.canvasResolution.width / 2,
      y: 200,
    });
    util.renderTextDropShadow({
      ctx,
      text: hasPlayed
        ? `Die Straße ist abgebrannt! ${score} Punkte nach ${gameTime.toFixed(
            1
          )}s Einsatz, Level ${level}.
${stats.extinguished} Brände gelöscht, ${stats.savedTime.toFixed(1)}s Brandzeit verhindert,
${stats.spread} Brände übergesprungen, ${stats.wetCats} Katzen nass gespritzt.

`
        : `Löscht die Brände in den Fenstern mit euren Lasern.
Große Brände brauchen mehrere Laser - aber spritzt keine Katzen nass!
`,
      fontSize: '45px',
      lineHeight: 70,
      dropDistX: 5,
      dropDistY: 5,
      fillStyle: getRgbSpreadHex(laserConfig.testColor, 0.5),
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
      addFloatingText(`Level ${level}`, 1920 / 2, 250, palette.hud);
      playSound(soundLevelUp);
    }

    // neue Brände
    spawnTimer += elapsed;
    const spawnInterval = Math.max(
      DIFFICULTY.spawnIntervalMin,
      DIFFICULTY.spawnIntervalStart * Math.pow(DIFFICULTY.spawnIntervalFactor, level - 1)
    );
    const maxFires = levelValue(
      DIFFICULTY.maxFiresStart,
      DIFFICULTY.maxFiresPerLevel,
      DIFFICULTY.maxFiresCap
    );
    if (spawnTimer >= spawnInterval && fires.length < maxFires) {
      spawnTimer = 0;
      const win = pickFreeWindow();
      if (win) startFire(win);
    }

    // neue Katzen
    catTimer += elapsed;
    const sittingCats = cats.filter((cat) => cat.win.cat === cat).length;
    if (catTimer >= DIFFICULTY.catSpawnInterval && sittingCats < DIFFICULTY.catMaxCount) {
      catTimer = 0;
      const win = pickFreeWindow();
      if (win) {
        const cat = createCat(win);
        win.cat = cat;
        cats.push(cat);
      }
    }

    // Brandschaden
    fires.forEach((fire) => {
      const house = houses[fire.win.house];
      house.damage = Math.min(
        100,
        house.damage + (DIFFICULTY.damageBase + DIFFICULTY.damageGrow * fire.getGrowth()) * elapsed
      );
    });
    houses.forEach((house, h) => {
      if (!house.burnt && house.damage >= 100) burnDownHouse(h);
    });
    if (gameState !== 'game') return;

    renderHouses(ctx);

    // Kopien, da sich die Arrays beim Iterieren verändern
    fires.slice().forEach((fire) => fire.handle(grid, elapsed, ctx));
    cats.slice().forEach((cat) => cat.handle(grid, elapsed, ctx));

    renderFloatingTexts(ctx, elapsed);

    util.renderTextDropShadow({
      ctx,
      text: `Level ${level} - ${gameTime.toFixed(1)}s - ${score} Punkte`,
      fontSize: '50px',
      fillStyle: palette.hud2,
      align: 'left',
      x: 100,
      y: 100,
    });
    util.renderTextDropShadow({
      ctx,
      text: `${fires.length} Brände - ${stats.extinguished} gelöscht`,
      fontSize: '45px',
      fillStyle: palette.hud2,
      align: 'right',
      x: 1920 - 100,
      y: 100,
    });
    if (gameTime < 10) {
      util.renderTextDropShadow({
        ctx,
        text: 'Brände löschen - Katzen nicht nass spritzen!',
        fontSize: '45px',
        fillStyle: palette.hud,
        x: 1920 / 2,
        y: 200,
      });
    }
  },
};
