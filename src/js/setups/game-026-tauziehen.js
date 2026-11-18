/**
 * Laser-Tauziehen
 *
 * Zwei Teams: die linke Hälfte des Publikums gegen die rechte.
 * Quer über den Bildschirm liegt ein Seil, der Knoten startet in der Mitte.
 *
 * - Jedes Team hat in SEINER Bildschirmhälfte ein grosses Ziel (gui/pixelFillButton), das langsam
 *   und zufällig umherwandert und regelmässig schrumpft und wächst.
 * - Die Zugkraft eines Teams ist der leuchtende Flächenanteil seines Ziels (getFillPercent(), geglättet).
 *   Je mehr Laser auf dem eigenen Ziel, desto stärker zieht das Team.
 * - Der Knoten wandert mit (KraftLinks - KraftRechts) * pullFactor * elapsed zur stärkeren Seite.
 * - Erreicht der Knoten die Siegmarkierung eines Teams, gewinnt es die Runde (Trillerpfeife).
 *   Best-of-5: wer zuerst 3 Runden gewinnt, gewinnt das Match.
 * - Bonus-Sterne erscheinen ab und zu nahe der Mitte. Wird ein Stern ausgelöst, bekommt das Team,
 *   auf dessen Seite der Stern liegt, für kurze Zeit doppelte Zugkraft.
 * - Sabotage lohnt sich nicht: Laser auf dem gegnerischen Ziel erhöhen die Zugkraft des Gegners.
 *
 * Kein klassisches Game Over: nach dem Match kommt ein Siegerscreen mit Statistik.
 * Zum Testen ohne Laser: Taste A zieht für Links, Taste L für Rechts.
 *
 * Alle Stellschrauben stehen gesammelt in DIFFICULTY.
 */

import util, { drawLine, drawNgon, getRgbSpreadHex } from '../util.js';
var laserConfig = require('../LaserApiConfig.js').default;
var MasterCanvas = require('../MasterCanvas').default;
var guiFillButton = require('./gui/fillButton').default;
var guiPixelFillButton = require('./gui/pixelFillButton').default;
import soundWhistle from '../../../public/media/trillerpfeife.mp3';
import soundMatchWin from '../../../public/media/goal2.mp3';
import soundBonus from '../../../public/media/opengameart/Level Up.ogg';

const DIFFICULTY = {
  roundsToWin: 3, // Best-of-5
  winDistance: 600, // px von der Mitte bis zur Siegmarkierung
  pullFactor: 6, // px/s pro Prozentpunkt Kraftdifferenz
  forceSmoothing: 3, // Glättung der Zugkraft (1/s, grösser = schneller)
  // Team-Ziele
  targetRadiusMin: 100,
  targetRadiusMax: 190,
  targetPulsePeriod: 7, // Sekunden für einmal schrumpfen und wachsen
  targetSpeed: 110, // px/s
  targetMargin: 40, // Abstand zur Mittellinie und zum Rand
  targetTop: 120,
  targetBottom: 1080 - 110,
  targetFullPercent: 30, // nur für die Füllanzeige des Ziels
  // Bonus-Sterne
  bonusIntervalMin: 6,
  bonusIntervalRandom: 6,
  bonusLifetime: 6, // Sekunden, dann verschwindet der Stern
  bonusRadius: 70,
  bonusDistanceMin: 80, // Abstand des Sterns zur Mitte
  bonusDistanceRandom: 200,
  bonusFillTime: 0.8, // Sekunden bei voller Bedeckung bis zum Auslösen
  bonusFullPercent: 30,
  bonusDuration: 3, // Sekunden doppelte Zugkraft
  bonusMultiplier: 2,
  roundPause: 3, // Sekunden Pause nach einer Runde
  debugKeyForce: 40, // Zugkraft in % per Taste A / L (Test ohne Laser)
};

const CENTER_X = 1920 / 2;
const ROPE_Y = 1080 / 2;

var lastTime = 0;
var gameState = 'gameover';
var hasPlayed = false; // false = Startscreen, true = Siegerscreen mit Statistik
var roundState = 'play'; // 'play' | 'pause'
var pauseTimer = 0;
var round = 1;
var ropeX = CENTER_X;
var matchTime = 0;
var playTime = 0; // nur aktive Zugzeit, für die Durchschnittskraft
var matchWinner = null;
var lastRoundWinner = null;
var teams = {};
var bonus = null;
var bonusTimer = 0;
var floatingTexts = [];
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

function playSound(src) {
  const audio = new Audio(src);
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

function addFloatingText(text, x, y, color) {
  floatingTexts.push({ text, x, y, time: 0, duration: 1.5, color });
}

/** Bereich, in dem sich das Ziel eines Teams bewegen darf (Mittelpunkt) */
function getTeamArea(side) {
  const r = DIFFICULTY.targetRadiusMax;
  const m = DIFFICULTY.targetMargin;
  return side === 'left'
    ? { x0: m + r, x1: CENTER_X - m - r, y0: DIFFICULTY.targetTop + r, y1: DIFFICULTY.targetBottom - r }
    : { x0: CENTER_X + m + r, x1: 1920 - m - r, y0: DIFFICULTY.targetTop + r, y1: DIFFICULTY.targetBottom - r };
}

function randomPointInArea(area) {
  return {
    x: area.x0 + Math.random() * (area.x1 - area.x0),
    y: area.y0 + Math.random() * (area.y1 - area.y0),
  };
}

function createTeam(side) {
  const hue = side === 'left' ? 0.35 : 0.65;
  const color = getRgbSpreadHex(laserConfig.testColor, hue, 0.8, 0.95);
  const growColor = getRgbSpreadHex(laserConfig.testColor, hue, 0.35, 1);
  const area = getTeamArea(side);
  const start = randomPointInArea(area);
  const team = {
    side,
    name: side === 'left' ? 'Links' : 'Rechts',
    debugKey: side === 'left' ? 'KeyA' : 'KeyL',
    color,
    growColor,
    area,
    waypoint: randomPointInArea(area),
    pulsePhase: side === 'left' ? 0 : Math.PI, // Teams pulsieren gegenläufig
    pulseTime: 0,
    smoothForce: 0,
    force: 0, // effektive Zugkraft inkl. Bonus
    forceSum: 0,
    wins: 0,
    boostTimer: 0,
    bonusCount: 0,
    target: guiPixelFillButton({
      label: '',
      posX: start.x,
      posY: start.y,
      radius: (DIFFICULTY.targetRadiusMin + DIFFICULTY.targetRadiusMax) / 2,
      edges: 32,
      edges2: side === 'left' ? 3 : 4,
      lineWidth: 6,
      fullPercent: DIFFICULTY.targetFullPercent,
      speedUp: 150,
      speedDown: 80,
      minValue: 0,
      activeValue: 101, // löst nie aus, genutzt wird nur getFillPercent()
      normalColor: color,
      growColor,
      activeColor: growColor,
    }),
  };
  return team;
}

/** Ziel bewegen, pulsieren lassen, Eingabe auswerten und Zugkraft berechnen */
function updateTeam(team, grid, elapsed, pulling) {
  const target = team.target;

  // langsam zum nächsten zufälligen Wegpunkt wandern
  const dx = team.waypoint.x - target.getX();
  const dy = team.waypoint.y - target.getY();
  const dist = Math.sqrt(dx * dx + dy * dy);
  const step = DIFFICULTY.targetSpeed * elapsed;
  if (dist <= step) {
    target.setX(team.waypoint.x);
    target.setY(team.waypoint.y);
    team.waypoint = randomPointInArea(team.area);
  } else {
    target.setX(target.getX() + (dx / dist) * step);
    target.setY(target.getY() + (dy / dist) * step);
  }

  // regelmässig schrumpfen und wachsen
  team.pulseTime += elapsed;
  const pulse =
    0.5 + 0.5 * Math.sin((team.pulseTime / DIFFICULTY.targetPulsePeriod) * Math.PI * 2 + team.pulsePhase);
  target.setRadius(
    DIFFICULTY.targetRadiusMin + (DIFFICULTY.targetRadiusMax - DIFFICULTY.targetRadiusMin) * pulse
  );

  target.handle(grid, elapsed);

  let raw = target.getFillPercent();
  if (laserConfig.pressedKeys[team.debugKey]) {
    raw = Math.max(raw, DIFFICULTY.debugKeyForce);
  }
  team.smoothForce += (raw - team.smoothForce) * Math.min(1, DIFFICULTY.forceSmoothing * elapsed);

  if (team.boostTimer > 0) {
    team.boostTimer = Math.max(0, team.boostTimer - elapsed);
  }
  team.force = team.smoothForce * (team.boostTimer > 0 ? DIFFICULTY.bonusMultiplier : 1);
  if (pulling) {
    team.forceSum += team.force * elapsed;
  }
}

function createBonus() {
  const side = Math.random() < 0.5 ? -1 : 1;
  const x = CENTER_X + side * (DIFFICULTY.bonusDistanceMin + Math.random() * DIFFICULTY.bonusDistanceRandom);
  const y = 180 + Math.random() * (1080 - 360);
  const color = getRgbSpreadHex(laserConfig.testColor, 0.5, 0.5, 1);
  const growColor = getRgbSpreadHex(laserConfig.testColor, 0.5, 0.15, 1);
  let age = 0;

  const star = guiPixelFillButton({
    label: '',
    posX: x,
    posY: y,
    radius: DIFFICULTY.bonusRadius,
    edges: 5,
    edges2: 5,
    lineWidth: 5,
    fullPercent: DIFFICULTY.bonusFullPercent,
    speedUp: 100 / DIFFICULTY.bonusFillTime,
    speedDown: 60,
    minValue: 0,
    activeValue: 90,
    normalColor: color,
    growColor,
    activeColor: growColor,
    onEnterActive: () => {
      if (bonus === star) bonus = null;
      // die Seite des Sterns entscheidet, welches Team profitiert
      const team = star.getX() < CENTER_X ? teams.left : teams.right;
      team.boostTimer = DIFFICULTY.bonusDuration;
      team.bonusCount++;
      addFloatingText(`Team ${team.name}: doppelte Kraft!`, star.getX(), star.getY() - 60, team.color);
      playSound(soundBonus);
    },
  });

  const handleOriginal = star.handle;
  star.handle = (grid, elapsed) => {
    age += elapsed;
    if (age > DIFFICULTY.bonusLifetime) {
      if (bonus === star) bonus = null;
      return;
    }
    star.setAngle(star.getAngle() + 1.5 * elapsed);
    handleOriginal(grid, elapsed);
    const ctx = MasterCanvas.get2dContext();
    util.renderTextDropShadow({
      ctx,
      text: `x${DIFFICULTY.bonusMultiplier}`,
      fontSize: '40px',
      dropDistX: 3,
      dropDistY: 3,
      fillStyle: color,
      x: star.getX(),
      y: star.getY() + DIFFICULTY.bonusRadius + 45,
    });
  };
  return star;
}

function nextBonusTime() {
  return DIFFICULTY.bonusIntervalMin + Math.random() * DIFFICULTY.bonusIntervalRandom;
}

function startRound() {
  roundState = 'play';
  ropeX = CENTER_X;
  bonus = null;
  bonusTimer = nextBonusTime();
  [teams.left, teams.right].forEach((team) => {
    team.smoothForce = 0;
    team.force = 0;
    team.boostTimer = 0;
  });
  addFloatingText(`Runde ${round}`, CENTER_X, 300, getRgbSpreadHex(laserConfig.testColor, 0.4));
  playSound(soundWhistle);
}

function resetGame() {
  gameState = 'game';
  hasPlayed = true;
  round = 1;
  matchTime = 0;
  playTime = 0;
  matchWinner = null;
  lastRoundWinner = null;
  floatingTexts = [];
  teams = { left: createTeam('left'), right: createTeam('right') };
  startRound();
}

function winRound(team) {
  team.wins++;
  lastRoundWinner = team;
  roundState = 'pause';
  pauseTimer = DIFFICULTY.roundPause;
  bonus = null;
  playSound(soundWhistle);
  if (team.wins >= DIFFICULTY.roundsToWin) {
    matchWinner = team;
    playSound(soundMatchWin);
  }
}

function endMatch() {
  gameState = 'gameover';
  buttonsGameOverScreen = createButtonsGameOverScreen();
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

function renderField(ctx) {
  const neutral = getRgbSpreadHex(laserConfig.testColor, 0.5, 0.2, 0.6);

  // Mittellinie
  ctx.save();
  ctx.setLineDash([20, 20]);
  ctx.lineWidth = 3;
  drawLine(ctx, CENTER_X, 0, CENTER_X, 1080, neutral);
  ctx.restore();

  // Siegmarkierungen
  [teams.left, teams.right].forEach((team) => {
    const x = team.side === 'left' ? CENTER_X - DIFFICULTY.winDistance : CENTER_X + DIFFICULTY.winDistance;
    ctx.save();
    ctx.setLineDash([30, 15]);
    ctx.lineWidth = 6;
    drawLine(ctx, x, ROPE_Y - 120, x, ROPE_Y + 120, team.color);
    ctx.restore();
    util.renderTextDropShadow({
      ctx,
      text: `Sieg ${team.name}`,
      fontSize: '30px',
      dropDistX: 3,
      dropDistY: 3,
      fillStyle: team.color,
      x,
      y: ROPE_Y - 135,
    });
  });
}

function renderRope(ctx) {
  const ropeColor = getRgbSpreadHex(laserConfig.testColor, 0.5, 0.3, 0.75);
  const knotColor = getRgbSpreadHex(laserConfig.testColor, 0.5, 0.1, 1);

  // Hilfsleinen von den Team-Zielen zum Seil (zeigen, wer an welchem Ende zieht)
  [teams.left, teams.right].forEach((team) => {
    const ropeEndX = team.side === 'left' ? Math.max(40, ropeX - 300) : Math.min(1880, ropeX + 300);
    ctx.save();
    ctx.lineWidth = 2 + Math.min(10, team.force / 5);
    ctx.globalAlpha = 0.6;
    drawLine(ctx, team.target.getX(), team.target.getY(), ropeEndX, ROPE_Y, team.color);
    ctx.restore();
  });

  // Seil, leicht vibrierend wenn beide ziehen
  const tension = Math.min(1, (teams.left.force + teams.right.force) / 60);
  const wobble = Math.sin(matchTime * 40) * 3 * tension;
  ctx.save();
  ctx.lineWidth = 14;
  ctx.lineCap = 'round';
  drawLine(ctx, 40, ROPE_Y, ropeX, ROPE_Y + wobble, ropeColor);
  drawLine(ctx, ropeX, ROPE_Y + wobble, 1880, ROPE_Y, ropeColor);
  ctx.restore();

  // Knoten mit Fähnchen
  drawNgon({
    ctx,
    numberOfSides: 6,
    size: 32,
    Xcenter: ropeX,
    Ycenter: ROPE_Y + wobble,
    color: knotColor,
    lineWidth: 4,
    filled: true,
  });
  ctx.save();
  ctx.lineWidth = 5;
  drawLine(ctx, ropeX, ROPE_Y + wobble, ropeX, ROPE_Y - 90, knotColor);
  ctx.restore();
}

function renderHud(ctx) {
  const hudColor = getRgbSpreadHex(laserConfig.testColor, 0.4);
  util.renderTextDropShadow({
    ctx,
    text: `${teams.left.wins} : ${teams.right.wins}`,
    fontSize: '50px',
    dropDistX: 4,
    dropDistY: 4,
    fillStyle: hudColor,
    x: CENTER_X,
    y: 65,
  });
  util.renderTextDropShadow({
    ctx,
    text: `Team ${teams.left.name}`,
    fontSize: '45px',
    dropDistX: 4,
    dropDistY: 4,
    align: 'right',
    fillStyle: teams.left.color,
    x: CENTER_X - 90,
    y: 65,
  });
  util.renderTextDropShadow({
    ctx,
    text: `Team ${teams.right.name}`,
    fontSize: '45px',
    dropDistX: 4,
    dropDistY: 4,
    align: 'left',
    fillStyle: teams.right.color,
    x: CENTER_X + 90,
    y: 65,
  });
  util.renderTextDropShadow({
    ctx,
    text: `Runde ${round} - Best of ${DIFFICULTY.roundsToWin * 2 - 1}`,
    fontSize: '35px',
    dropDistX: 3,
    dropDistY: 3,
    fillStyle: getRgbSpreadHex(laserConfig.testColor, 0.3),
    x: CENTER_X,
    y: 115,
  });

  // Zugkraft-Balken unten
  [teams.left, teams.right].forEach((team) => {
    const isLeft = team.side === 'left';
    const barMax = 700;
    const barWidth = Math.min(1, team.force / 100) * barMax;
    ctx.save();
    ctx.fillStyle = team.color;
    ctx.fillRect(isLeft ? CENTER_X - 40 - barWidth : CENTER_X + 40, 1050, barWidth, 20);
    ctx.restore();
    const boostText = team.boostTimer > 0 ? `  DOPPELT ${team.boostTimer.toFixed(1)}s` : '';
    util.renderTextDropShadow({
      ctx,
      text: isLeft
        ? `Zugkraft ${team.force.toFixed(0)}%${boostText}`
        : `${boostText}Zugkraft ${team.force.toFixed(0)}%`,
      fontSize: '40px',
      dropDistX: 3,
      dropDistY: 3,
      align: isLeft ? 'right' : 'left',
      fillStyle: team.boostTimer > 0 && Math.floor(matchTime * 6) % 2 === 0 ? '#ffffff' : team.color,
      x: isLeft ? CENTER_X - 40 : CENTER_X + 40,
      y: 1035,
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
      fontSize: '45px',
      dropDistX: 3,
      dropDistY: 3,
      fillStyle: t.color,
      x: t.x,
      y: t.y - t.time * 50,
    });
  }
}

function averageForce(team) {
  return playTime > 0 ? team.forceSum / playTime : 0;
}

export default {
  name: 'Tauziehen ',
  description: ` 

Die linke Hälfte des Publikums spielt gegen die rechte.

Jedes Team hat in seiner Bildschirmhälfte ein bewegendes grosses Ziel, 
je mehr jedes Team bedeckt: desto stärker zieht Team am Seil.

Best of 5: wer zuerst ${DIFFICULTY.roundsToWin} Runden gewinnt, gewinnt das Match.

Ab und zu erscheint ein Bonus-Stern
und gilt für das team auf dessen seite er erscheint!
`,
  image: 'media/img/gametitles/laser-pong-###4###.png',

  init: function () {
    gameState = 'gameover';
    hasPlayed = false;
    lastTime = 0;
    bonus = null;
    floatingTexts = [];
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
      text: 'Laser-Tauziehen',
      fontSize: '150px',
      fillStyle: getRgbSpreadHex(laserConfig.testColor, 0.4),
      x: laserConfig.canvasResolution.width / 2,
      y: 200,
    });

    if (hasPlayed && matchWinner) {
      const left = teams.left;
      const right = teams.right;
      util.renderTextDropShadow({
        ctx,
        text: `Team ${matchWinner.name} gewinnt das Match ${left.wins} : ${right.wins}!`,
        fontSize: '60px',
        dropDistX: 5,
        dropDistY: 5,
        fillStyle: matchWinner.color,
        x: CENTER_X,
        y: 330,
      });
      util.renderTextDropShadow({
        ctx,
        text: `Rundensiege: Links ${left.wins} - Rechts ${right.wins}
Durchschnittliche Zugkraft: Links ${averageForce(left).toFixed(1)}% - Rechts ${averageForce(
          right
        ).toFixed(1)}%
Bonus-Sterne: Links ${left.bonusCount} - Rechts ${right.bonusCount}, Spielzeit ${matchTime.toFixed(0)}s`,
        fontSize: '45px',
        lineHeight: 65,
        dropDistX: 5,
        dropDistY: 5,
        fillStyle: getRgbSpreadHex(laserConfig.testColor, 0.5),
        x: CENTER_X,
        y: 420,
      });
    } else {
      util.renderTextDropShadow({
        ctx,
        text: 'Linke Hälfte gegen rechte Hälfte!\nAlle Laser auf das eigene Ziel, dann zieht euer Team am Seil.',
        fontSize: '45px',
        lineHeight: 65,
        dropDistX: 5,
        dropDistY: 5,
        fillStyle: getRgbSpreadHex(laserConfig.testColor, 0.5),
        x: CENTER_X,
        y: 340,
      });
      util.renderTextDropShadow({
        ctx,
        text: 'Team Links',
        fontSize: '60px',
        dropDistX: 5,
        dropDistY: 5,
        fillStyle: getRgbSpreadHex(laserConfig.testColor, 0.35, 0.8, 0.95),
        x: 1920 / 4,
        y: 560,
      });
      util.renderTextDropShadow({
        ctx,
        text: 'Team Rechts',
        fontSize: '60px',
        dropDistX: 5,
        dropDistY: 5,
        fillStyle: getRgbSpreadHex(laserConfig.testColor, 0.65, 0.8, 0.95),
        x: (1920 * 3) / 4,
        y: 560,
      });
    }
  },

  handleGameScreen(grid, elapsed) {
    matchTime += elapsed;
    const ctx = MasterCanvas.get2dContext();
    const pulling = roundState === 'play';

    renderField(ctx);

    // Team-Ziele: Bewegung, Eingabe, Zugkraft
    updateTeam(teams.left, grid, elapsed, pulling);
    updateTeam(teams.right, grid, elapsed, pulling);

    if (pulling) {
      playTime += elapsed;

      // Bonus-Sterne
      if (!bonus) {
        bonusTimer -= elapsed;
        if (bonusTimer <= 0) {
          bonus = createBonus();
          bonusTimer = nextBonusTime();
        }
      }
      if (bonus) {
        bonus.handle(grid, elapsed);
      }

      // Seil bewegen: positive Differenz = Links stärker = Knoten nach links
      const diff = teams.left.force - teams.right.force;
      ropeX -= diff * DIFFICULTY.pullFactor * elapsed;
      if (ropeX <= CENTER_X - DIFFICULTY.winDistance) {
        ropeX = CENTER_X - DIFFICULTY.winDistance;
        winRound(teams.left);
      } else if (ropeX >= CENTER_X + DIFFICULTY.winDistance) {
        ropeX = CENTER_X + DIFFICULTY.winDistance;
        winRound(teams.right);
      }
    } else {
      pauseTimer -= elapsed;
      if (lastRoundWinner) {
        util.renderTextDropShadow({
          ctx,
          text: matchWinner
            ? `Team ${matchWinner.name} gewinnt das Match!`
            : `Team ${lastRoundWinner.name} gewinnt Runde ${round}!`,
          fontSize: '80px',
          dropDistX: 6,
          dropDistY: 6,
          fillStyle: lastRoundWinner.color,
          x: CENTER_X,
          y: ROPE_Y + 220,
        });
      }
      if (pauseTimer <= 0) {
        if (matchWinner) {
          endMatch();
          return;
        }
        round++;
        startRound();
      }
    }

    renderRope(ctx);
    renderFloatingTexts(ctx, elapsed);
    renderHud(ctx);
  },
};
