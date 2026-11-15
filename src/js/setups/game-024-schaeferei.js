/**
 * Laser-Schäferei
 *
 * Eine Schafherde steht links auf der Weide, rechts ist ein Pferch mit einer Öffnung:
 * - Schafe sind gui/followCircle mit followTrueOrRepellFalse: false, sie fliehen vor den Lasern.
 *   So treibt man die Herde durch die Öffnung in den Pferch. Liegt der Mittelpunkt eines Schafs
 *   im Pferch, ist es gerettet (Punkte).
 * - von links, oben und unten schleichen Wölfe herein (gui/pixelFillButton) und laufen langsam
 *   auf das nächste Schaf zu. Erreicht ein Wolf ein Schaf, frisst er es.
 * - Wölfe werden abgeschossen, indem man sie mit Lasern füllt (Flächenanteil, mehr Laser = schneller).
 *   Achtung: Laser auf einem Wolf treiben auch die Schafe in der Nähe weg.
 *   Teamwork: eine Gruppe treibt die Herde, eine Gruppe jagt Wölfe.
 * - eine Runde ist vorbei, wenn alle Schafe gerettet oder gefressen sind. Dann kommt eine größere
 *   Herde und mehr Wölfe. Wird in einer Runde mehr als die Hälfte der Herde gefressen: Game Over.
 *
 * Alle Stellschrauben stehen gesammelt in DIFFICULTY.
 */

import util, { drawNgon, getRgbSpreadHex, removeItemFromArray } from '../util.js';
var laserConfig = require('../LaserApiConfig.js').default;
var MasterCanvas = require('../MasterCanvas').default;
var guiFillButton = require('./gui/fillButton').default;
var guiPixelFillButton = require('./gui/pixelFillButton').default;
import guiFollowCircle from './gui/followCircle.js';
import { repellAll, checkBorderAndSlowDown } from './game-017-thehorde.js';
import soundPlop from '../../../public/media/369952__mischy__plop-1.wav';
import soundExplosion from '../../../public/media/414346__bykgames__explosion-far.wav';
import soundLevelUp from '../../../public/media/opengameart/Level Up.ogg';
import soundError from '../../../public/media/opengameart/Menu Error.ogg';

import highscoreManager from '../util/highscore.js' 
const highScoreInstance=highscoreManager("Schäferei","Score");  // Make highscore instance, will be global until reloaded, but manages saving itself


const DIFFICULTY = {
  // Herde pro Runde
  sheepStart: 6,
  sheepPerRound: 2,
  sheepCap: 20,
  // Schafe (followCircle), Geschwindigkeiten in px/ms wie in followCircle
  sheepRadius: 50,
  sheepScanFactor: 2.2, // wie weit ein Schaf Laser "sieht" (Vielfaches des Radius)
  sheepSpeedUp: 0.04, // Lerp-Faktor Richtung Fluchtgeschwindigkeit
  sheepSpeedDown: 0.06, // Lerp-Faktor zum Abbremsen ohne Laser
  sheepMaxSpeed: 0.45,
  sheepBounce: 1, // Abstoßung der Schafe untereinander
  // Wölfe pro Runde
  wolvesStart: 2,
  wolvesPerRound: 1,
  wolvesCap: 12,
  wolfMaxActiveStart: 2,
  wolfMaxActivePerRound: 0.5,
  wolfMaxActiveCap: 6,
  wolfFirstDelay: 4, // Sekunden bis zum ersten Wolf einer Runde
  wolfSpawnInterval: 6,
  wolfSpawnIntervalFactor: 0.9, // pro Runde
  wolfSpawnIntervalMin: 2,
  // Wolf-Verhalten
  wolfRadius: 55,
  wolfSpeed: 45, // px/s
  wolfSpeedPerRound: 0.1, // relativ
  wolfSpeedCap: 2.5,
  wolfHitSlowdown: 0.7, // ein voll getroffener Wolf läuft nur noch 30 % so schnell
  wolfSatedTime: 2.5, // Sekunden Pause nach dem Fressen
  wolfCatchFactor: 0.6, // Wolf erreicht Schaf bei Abstand < wolfRadius*Faktor + Schafradius
  // Abschießen: volle Rate ab wolfFullPercent leuchtender Fläche
  wolfFullPercent: 30,
  wolfKillTime: 0.8, // Sekunden bei voller Bedeckung
  wolfRecover: 40, // Abbau pro Sekunde ohne Treffer
  // Punkte
  pointsSheep: 10,
  pointsWolf: 5,
  pointsRoundBonus: 20,
  roundPause: 3, // Sekunden zwischen den Runden
};

// Pferch rechts, Öffnung links
const PEN = {
  left: 1480,
  right: 1780, // Lücke zum Bildrand, damit Schafe hinter dem Pferch nicht feststecken
  top: 280,
  bottom: 800,
  openTop: 410,
  openBottom: 670,
};

var sheeps = [];
var wolves = [];
var floatingTexts = [];
var activeSounds = [];
var buttonsGameOverScreen = [];
var gameState = 'gameover';
var hasPlayed = false;
var gameTime = 0;
var score = 0;
var round = 1;
var roundTotal = 0;
var roundSaved = 0;
var roundEaten = 0;
var roundActive = false;
var roundPauseTimer = 0;
var wolvesToSpawn = 0;
var wolfTimer = 0;
var stats = { saved: 0, eaten: 0, wolves: 0 };
var palette = {}; // wird in init()/resetGame() gesetzt, wenn testColor bekannt ist
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

function roundValue(start, perRound, cap) {
  return Math.min(cap, start + perRound * (round - 1));
}

// Farben, alle von der Laserfarbe abgeleitet
const colors = () => ({
  sheep: getRgbSpreadHex(laserConfig.testColor, 0.5, 0.25, .8),
  sheepHead: getRgbSpreadHex(laserConfig.testColor, 0.5, 0.2, 0.55),
  wolf: getRgbSpreadHex(laserConfig.testColor, 0.6, 0.6, 0.9),
  wolfHit: getRgbSpreadHex(laserConfig.testColor, 0.5, 0.8, .9),
  wolfEyes: getRgbSpreadHex(laserConfig.testColor, 0.35, .7, .9),
  fence: getRgbSpreadHex(laserConfig.testColor, 0.3, 0.6, 0.8),
  grass: getRgbSpreadHex(laserConfig.testColor, 0.35, 0.6, 0.12),
  hud: getRgbSpreadHex(laserConfig.testColor, 0.4),
  hud2: getRgbSpreadHex(laserConfig.testColor, 0.3),
});

function playSound(src) {
  const audio = new Audio(src);
  activeSounds.push(audio);
  audio.onended = () => removeItemFromArray(activeSounds, audio);
  audio.play().catch(() => {});
}

function addFloatingText(text, x, y, color) {
  floatingTexts.push({ text, x, y, time: 0, duration: 1.5, color });
}

function distance(a, b) {
  const dx = a.getX() - b.getX();
  const dy = a.getY() - b.getY();
  return Math.sqrt(dx * dx + dy * dy);
}

function nearestSheep(wolf) {
  let best = undefined;
  let bestDist = Infinity;
  sheeps.forEach((sheep) => {
    const d = distance(wolf, sheep);
    if (d < bestDist) {
      bestDist = d;
      best = sheep;
    }
  });
  return best;
}

function createSheep(x, y) {
  const r = DIFFICULTY.sheepRadius;
  const sheep = guiFollowCircle({
    label: '',
    posX: x,
    posY: y,
    radius: r,
    edges: 9,
    lineWidth: 4,
    normalColor: palette.sheep,
    speedUp: DIFFICULTY.sheepSpeedUp,
    speedDown: DIFFICULTY.sheepSpeedDown,
    scanRadiusFactor: DIFFICULTY.sheepScanFactor,
    followTrueOrRepellFalse: false,
  });
  let wobble = Math.random() * 10;
  let dirX = 1;
  let dirY = 0;
  const handleOriginal = sheep.handle;
  sheep.handle = (grid, elapsed) => {
    // Fluchtgeschwindigkeit begrenzen (repellAll kann sie aufschaukeln)
    const sx = sheep.getSpeedX();
    const sy = sheep.getSpeedY();
    const speed = Math.sqrt(sx * sx + sy * sy);
    if (speed > DIFFICULTY.sheepMaxSpeed) {
      sheep.setSpeedX((sx / speed) * DIFFICULTY.sheepMaxSpeed);
      sheep.setSpeedY((sy / speed) * DIFFICULTY.sheepMaxSpeed);
    }
    if (speed > 0.02) {
      dirX = sx / speed;
      dirY = sy / speed;
    }
    wobble += elapsed;
    sheep.setAngle(Math.sin(wobble * 2) * 0.2);
    handleOriginal(grid, elapsed);
    // Kopf in Laufrichtung
    const ctx = MasterCanvas.get2dContext();
    drawNgon({
      ctx,
      numberOfSides: 12,
      size: r * 0.35,
      Xcenter: sheep.getX() + dirX * r * 0.95,
      Ycenter: sheep.getY() + dirY * r * 0.95,
      color: palette.sheepHead,
      filled: true,
      lineWidth: 2,
    });
  };
  return sheep;
}

/** hält Schafe aus den Zaunwänden heraus, nur durch die Öffnung kommt man hinein */
function collideWithPen(sheep) {
  const r = sheep.getRadius();
  const x = sheep.getX();
  const y = sheep.getY();
  if (x <= PEN.left - r || x >= PEN.right + r || y <= PEN.top - r || y >= PEN.bottom + r) {
    return;
  }
  // Mittelpunkt auf Höhe der Öffnung und noch nicht drin: darf hinein
  if (y > PEN.openTop && y < PEN.openBottom && x < PEN.left) {
    return;
  }
  const dl = x - (PEN.left - r);
  const dr = PEN.right + r - x;
  const dt = y - (PEN.top - r);
  const db = PEN.bottom + r - y;
  const m = Math.min(dl, dr, dt, db);
  if (m === dl) {
    sheep.setX(PEN.left - r);
    sheep.setSpeedX(Math.min(0, sheep.getSpeedX()));
  } else if (m === dr) {
    sheep.setX(PEN.right + r);
    sheep.setSpeedX(Math.max(0, sheep.getSpeedX()));
  } else if (m === dt) {
    sheep.setY(PEN.top - r);
    sheep.setSpeedY(Math.min(0, sheep.getSpeedY()));
  } else {
    sheep.setY(PEN.bottom + r);
    sheep.setSpeedY(Math.max(0, sheep.getSpeedY()));
  }
}

function isInPen(sheep) {
  const x = sheep.getX();
  const y = sheep.getY();
  return x > PEN.left-5 && x < PEN.right+5 && y > PEN.top && y < PEN.bottom;
}

function eatSheep(sheep) {
  removeItemFromArray(sheeps, sheep);
  stats.eaten++;
  roundEaten++;
  addFloatingText('gefressen!', sheep.getX(), sheep.getY() - 60, '#ffffff');
  playSound(soundError);
  if (roundEaten > roundTotal / 2) {
    gameOver();
  }
}

function createWolf() {
  // Spawn knapp außerhalb: links, oben oder unten (rechts steht der Pferch)
  const side = Math.floor(Math.random() * 3);
  const r = DIFFICULTY.wolfRadius;
  let x;
  let y;
  if (side === 0) {
    x = -r;
    y = 150 + Math.random() * 780;
  } else if (side === 1) {
    x = 150 + Math.random() * 1150;
    y = -r;
  } else {
    x = 150 + Math.random() * 1150;
    y = 1080 + r;
  }
  const speed =
    DIFFICULTY.wolfSpeed * roundValue(1, DIFFICULTY.wolfSpeedPerRound, DIFFICULTY.wolfSpeedCap);
  let satedTimer = 0;
  let headingAngle = 0;

  const wolf = guiPixelFillButton({
    label: '',
    posX: x,
    posY: y,
    radius: r,
    edges: 3,
    edges2: 3,
    fullPercent: DIFFICULTY.wolfFullPercent,
    speedUp: 100 / DIFFICULTY.wolfKillTime,
    speedDown: DIFFICULTY.wolfRecover,
    minValue: 0,
    activeValue: 99,
    lineWidth: 5,
    normalColor: palette.wolf,
    growColor: palette.wolfHit,
    activeColor: palette.wolfHit,
    onEnterActive: () => {
      removeItemFromArray(wolves, wolf);
      score += DIFFICULTY.pointsWolf;
      stats.wolves++;
      addFloatingText(`+${DIFFICULTY.pointsWolf}`, wolf.getX(), wolf.getY(), palette.wolfHit);
      playSound(soundExplosion);
    },
  });

  const handleOriginal = wolf.handle;
  wolf.handle = (grid, elapsed) => {
    // nach Game Over im selben Frame nichts mehr fressen
    if (gameState !== 'game') return;
    const target = nearestSheep(wolf);
    if (satedTimer > 0) {
      satedTimer -= elapsed;
    } else if (target) {
      const dx = target.getX() - wolf.getX();
      const dy = target.getY() - wolf.getY();
      const dist = Math.sqrt(dx * dx + dy * dy);
      if (dist < r * DIFFICULTY.wolfCatchFactor + target.getRadius()) {
        eatSheep(target);
        satedTimer = DIFFICULTY.wolfSatedTime;
      } else {
        // getroffene Wölfe werden langsamer
        const slow = 1 - (wolf.getValue() / 100) * DIFFICULTY.wolfHitSlowdown;
        const step = Math.min(dist, speed * slow * elapsed);
        wolf.setX(wolf.getX() + (dx / dist) * step);
        wolf.setY(wolf.getY() + (dy / dist) * step);
        // drawNgon dreht mit -angle, Spitze des Dreiecks zeigt zum Schaf
        headingAngle = -Math.atan2(dy, dx);
      }
    }
    wolf.setAngle(headingAngle);
    if (gameState !== 'game') return;
    handleOriginal(grid, elapsed);
    // Augen
    const ctx = MasterCanvas.get2dContext();
    const fx = Math.cos(-headingAngle);
    const fy = Math.sin(-headingAngle);
    [-1, 1].forEach((side) => {
      drawNgon({
        ctx,
        numberOfSides: 6,
        size: 7,
        Xcenter: wolf.getX() + fx * r * 0.35 - fy * side * r * 0.22,
        Ycenter: wolf.getY() + fy * r * 0.35 + fx * side * r * 0.22,
        color: palette.wolfEyes,
        filled: true,
        lineWidth: 2,
      });
    });
  };
  return wolf;
}

function startRound() {
  roundTotal = roundValue(DIFFICULTY.sheepStart, DIFFICULTY.sheepPerRound, DIFFICULTY.sheepCap);
  roundSaved = 0;
  roundEaten = 0;
  roundActive = true;
  wolves = [];
  wolvesToSpawn = roundValue(DIFFICULTY.wolvesStart, DIFFICULTY.wolvesPerRound, DIFFICULTY.wolvesCap);
  wolfTimer = DIFFICULTY.wolfFirstDelay; // Countdown bis zum nächsten Wolf
  sheeps = [];
  const minDist = DIFFICULTY.sheepRadius * 2.1;
  for (let i = 0; i < roundTotal; i++) {
    let x = 0;
    let y = 0;
    // Schafe ohne große Überlappung auf der linken Weide verteilen
    for (let tries = 0; tries < 30; tries++) {
      x = 200 + Math.random() * 650;
      y = 200 + Math.random() * 680;
      const free = sheeps.every((s) => {
        const dx = s.getX() - x;
        const dy = s.getY() - y;
        return dx * dx + dy * dy > minDist * minDist;
      });
      if (free) break;
    }
    sheeps.push(createSheep(x, y));
  }
  addFloatingText(`Runde ${round}: ${roundTotal} Schafe`, 1920 / 2, 250, palette.hud);
}

function finishRound() {
  roundActive = false;
  wolves = [];
  score += DIFFICULTY.pointsRoundBonus;
  addFloatingText(`Runde geschafft! +${DIFFICULTY.pointsRoundBonus}`, 1920 / 2, 300, palette.hud);
  playSound(soundLevelUp);
  roundPauseTimer = DIFFICULTY.roundPause;
}

function gameOver() {
  gameState = 'gameover';
  hasPlayed = true;
  buttonsGameOverScreen = createButtonsGameOverScreen();
  highScoreInstance.addEntry({"Score":score,"Level":round,"Time":gameTime})
}

function resetGame() {
  gameState = 'game';
  gameTime = 0;
  score = 0;
  round = 1;
  palette = colors();
  floatingTexts = [];
  stats = { saved: 0, eaten: 0, wolves: 0 };
  startRound();
  lastTime = performance.now();
}

const createButtonsGameOverScreen = () => [
  // Start per Laser
  guiFillButton({
    label: 'Start',
    posX: 1920 / 2,
    posY: 1080 / 2 + 250,
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

function renderPen(ctx) {
  ctx.save();
  // Gras im Pferch
  ctx.fillStyle = palette.grass;
  ctx.fillRect(PEN.left, PEN.top, PEN.right - PEN.left, PEN.bottom - PEN.top);
  // Zaun mit Öffnung links
  ctx.strokeStyle = palette.fence;
  ctx.lineWidth = 10;
  ctx.beginPath();
  ctx.moveTo(PEN.left, PEN.openTop);
  ctx.lineTo(PEN.left, PEN.top);
  ctx.lineTo(PEN.right, PEN.top);
  ctx.lineTo(PEN.right, PEN.bottom);
  ctx.lineTo(PEN.left, PEN.bottom);
  ctx.lineTo(PEN.left, PEN.openBottom);
  ctx.stroke();
  // Zaunpfähle
  ctx.fillStyle = palette.fence;
  [
    [PEN.left, PEN.top],
    [PEN.right, PEN.top],
    [PEN.right, PEN.bottom],
    [PEN.left, PEN.bottom],
    [PEN.left, PEN.openTop],
    [PEN.left, PEN.openBottom],
  ].forEach(([px, py]) => ctx.fillRect(px - 12, py - 12, 24, 24));
  // Pfeil zur Öffnung
  ctx.lineWidth = 6;
  ctx.setLineDash([20, 15]);
  const midY = (PEN.openTop + PEN.openBottom) / 2;
  ctx.beginPath();
  ctx.moveTo(PEN.left - 200, midY);
  ctx.lineTo(PEN.left - 40, midY);
  ctx.stroke();
  ctx.setLineDash([]);
  ctx.beginPath();
  ctx.moveTo(PEN.left - 40, midY);
  ctx.lineTo(PEN.left - 70, midY - 25);
  ctx.moveTo(PEN.left - 40, midY);
  ctx.lineTo(PEN.left - 70, midY + 25);
  ctx.stroke();
  ctx.restore();

  util.renderTextDropShadow({
    ctx,
    text: 'Pferch',
    fontSize: '45px',
    dropDistX: 4,
    dropDistY: 4,
    fillStyle: palette.fence,
    x: (PEN.left + PEN.right) / 2,
    y: PEN.top - 25,
  });
  util.renderTextDropShadow({
    ctx,
    text: `${roundSaved}`,
    fontSize: '120px',
    dropDistX: 5,
    dropDistY: 5,
    fillStyle: palette.sheep*0.75,
    x: (PEN.left + PEN.right) / 2,
    y: (PEN.top + PEN.bottom) / 2 + 40,
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
  name: 'Schafspferch (Opus55)',
  description: `
Die Schafe fliehen vor euren Lasern. 

Treibt die Herde durch die Öffnung in den Pferch rechts.

Es schleichen Wölfe heran und fressen Schafe.

Sind alle Schafe gerettet, kommt die nächste Runde mit mehr Schafen und Wölfen.

Wird in einer Runde mehr als die Hälfte der Herde gefressen, ist Game Over.
`,
  image: 'media/img/gametitles/laser-cowhorde-###4###.png',

  init: function () {
    console.log('init game laser schaeferei');
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
      text: 'Laser-Schäferei',
      fontSize: '150px',
      fillStyle: getRgbSpreadHex(laserConfig.testColor, 0.4),
      x: laserConfig.canvasResolution.width / 2,
      y: 200,
    });
    util.renderTextDropShadow({
      ctx,
      text: hasPlayed
        ? `Die Wölfe waren zu hungrig! ${score} Punkte in Runde ${round} nach ${gameTime.toFixed(
            1
          )}s.
${stats.saved} Schafe gerettet, ${stats.eaten} Schafe gefressen,
${stats.wolves} Wölfe verjagt, ${round - 1} Runden geschafft.`
        : `Treibt die Schafe mit euren Lasern in den Pferch
und schießt die Wölfe ab, bevor sie die Herde fressen!`,
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

    // Pause zwischen den Runden
    if (!roundActive) {
      roundPauseTimer -= elapsed;
      if (roundPauseTimer <= 0) {
        round++;
        startRound();
      }
    }

    // Wölfe spawnen
    if (roundActive && wolvesToSpawn > 0) {
      wolfTimer -= elapsed;
      const maxActive = Math.floor(
        roundValue(
          DIFFICULTY.wolfMaxActiveStart,
          DIFFICULTY.wolfMaxActivePerRound,
          DIFFICULTY.wolfMaxActiveCap
        )
      );
      if (wolfTimer <= 0 && wolves.length < maxActive) {
        wolfTimer = Math.max(
          DIFFICULTY.wolfSpawnIntervalMin,
          DIFFICULTY.wolfSpawnInterval * Math.pow(DIFFICULTY.wolfSpawnIntervalFactor, round - 1)
        );
        wolvesToSpawn--;
        wolves.push(createWolf());
      }
    }

    renderPen(ctx);

    // Schafe: gegenseitig abstoßen, bewegen, im Bild und aus dem Zaun halten
    repellAll({
      workArray: sheeps,
      targetArray: sheeps,
      elapsed,
      bounce: DIFFICULTY.sheepBounce,
    });
    sheeps.slice().forEach((sheep) => sheep.handle(grid, elapsed));
    sheeps.slice().forEach((sheep) => {
      checkBorderAndSlowDown(sheep, sheep.getRadius());
      collideWithPen(sheep);
      if (isInPen(sheep)) {
        removeItemFromArray(sheeps, sheep);
        score += DIFFICULTY.pointsSheep;
        stats.saved++;
        roundSaved++;
        addFloatingText(`+${DIFFICULTY.pointsSheep}`, sheep.getX(), sheep.getY() - 60, palette.sheep);
        playSound(soundPlop);
      }
    });

    // Wölfe (können Schafe fressen und damit Game Over auslösen)
    wolves.slice().forEach((wolf) => wolf.handle(grid, elapsed));
    if (gameState !== 'game') return;

    if (roundActive && sheeps.length === 0) {
      finishRound();
    }

    renderFloatingTexts(ctx, elapsed);

    util.renderTextDropShadow({
      ctx,
      text: `Runde ${round} - ${score} Punkte`,
      fontSize: '50px',
      fillStyle: palette.hud2,
      align: 'left',
      x: 100,
      y: 100,
    });
    util.renderTextDropShadow({
      ctx,
      text: `Herde ${sheeps.length} - gerettet ${roundSaved} - gefressen ${roundEaten}/${Math.floor(
        roundTotal / 2
      )}`,
      fontSize: '40px',
      fillStyle: palette.hud2,
      align: 'right',
      x: 1920 - 80,
      y: 100,
    });
  },
};
