/**
 * Laser-Simon
 *
 * "Simon sagt" für die ganze Menge: 6 grosse Felder liegen im Kreis um die Bildschirmmitte.
 * - Phase 'zeigen': die Sequenz wird abgespielt, das jeweilige Feld leuchtet kurz auf und spielt
 *   seinen Ton. Währenddessen ist die Eingabe gesperrt (die Felder bekommen ein leeres Grid).
 * - Phase 'nachmachen': die Menge muss die Felder in derselben Reihenfolge auslösen.
 *   Ein Feld löst erst aus, wenn es eine Weile beleuchtet wurde (die Menge muss sich einigen).
 *   Richtiges Feld = Ton + nächster Schritt. Falsches Feld oder abgelaufene Zeit = ein Leben weg,
 *   die Sequenz wird erneut gezeigt.
 * - Sequenz komplett = Runde geschafft, die Sequenz wird um ein Feld länger.
 * - Ab Runde DIFFICULTY.speedUpFromRound wird schneller gezeigt.
 * 3 Leben, danach Game Over mit Statistik (längste Sequenz, Fehler, Zeit).
 *
 * Tastatur zum Testen ohne Laser: Ziffern 1-6 lösen die Felder aus.
 *
 * Alle Stellschrauben stehen gesammelt in DIFFICULTY.
 */

import util, { drawNgon, getRgbSpreadHex } from '../util.js';
var laserConfig = require('../LaserApiConfig.js').default;
var MasterCanvas = require('../MasterCanvas').default;
var guiFillButton = require('./gui/fillButton').default;
import soundLevelUp from '../../../public/media/opengameart/Level Up.ogg';
import soundError from '../../../public/media/opengameart/Menu Error.ogg';
import soundConfirm from '../../../public/media/opengameart/Menu Confirm.ogg';

const DIFFICULTY = {
  lives: 3,
  startLength: 1, // Länge der ersten Sequenz
  // Zeigen-Phase in Sekunden
  showOnTime: 0.7, // so lange leuchtet ein Feld
  showOffTime: 0.35, // Pause zwischen zwei Feldern
  showLeadIn: 1.2, // Pause vor dem ersten Feld ("Schaut zu!")
  speedUpFromRound: 5, // ab dieser Runde werden die Zeigen-Zeiten kürzer
  showTimeFactor: 0.88, // pro Runde ab speedUpFromRound
  showOnTimeMin: 0.3,
  showOffTimeMin: 0.15,
  // Nachmachen-Phase
  inputTimeStart: 12, // Sekunden pro Eingabeschritt
  inputTimePerRound: -0.4,
  inputTimeMin: 6,
  // Füllrate der Felder: moderat, damit sich die Menge einigen muss
  buttonSpeedUp: 35, // pro Sekunde (activeValue 75 => gut 2 s Dauerbeleuchtung)
  buttonSpeedDown: 30,
  buttonActiveValue: 75,
  // Zwischenpausen
  pauseRoundDone: 1.6,
  pauseMistake: 2.0,
  flashTime: 0.35, // Aufleuchten nach richtiger Eingabe
};

// 6 Felder: Form, Farbton (nie 0/1 = Laserfarbe), Ton
const FIELDS = [
  { label: 'Dreieck', edges: 3, edges2: undefined, angle: Math.PI / 2, hue: 0.25, freq: 262 },
  { label: 'Quadrat', edges: 4, edges2: undefined, angle: Math.PI / 4, hue: 0.35, freq: 330 },
  { label: 'Fünfeck', edges: 5, edges2: undefined, angle: Math.PI / 2, hue: 0.45, freq: 392 },
  { label: 'Sechseck', edges: 6, edges2: 3, angle: 0, hue: 0.55, freq: 440 },
  { label: 'Achteck', edges: 8, edges2: 4, angle: Math.PI / 8, hue: 0.65, freq: 523 },
  { label: 'Kreis', edges: 32, edges2: 32, angle: 0, hue: 0.75, freq: 659 },
];
const FIELD_RADIUS = 150;
const RING_RX = 450;
const RING_RY = 330;

var lastTime = 0;
var gameState = 'gameover';
var phase = 'pause'; // 'zeigen' | 'nachmachen' | 'pause'
var gameTime = 0;
var round = 1;
var lives = DIFFICULTY.lives;
var sequence = [];
var showIndex = 0;
var showTimer = 0;
var inputIndex = 0;
var inputTimer = 0;
var pauseTimer = 0;
var pauseText = '';
var flashTimers = [];
var fieldButtons = [];
var buttonsGameOverScreen = [];
var hasPlayed = false;
var gameOverText = '';
var stats = { longest: 0, mistakes: 0, inputs: 0 };
var emptyGrid = [];
var prevKeys = {};
var audioCtx = undefined;
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

/** leeres Grid gleicher Länge: damit sperren wir die Eingabe, ohne das echte Grid zu lesen */
function getEmptyGrid(length) {
  if (emptyGrid.length !== length) {
    emptyGrid = new Array(length).fill(0);
  }
  return emptyGrid;
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

/** kurzer Sinuston pro Feld (WebAudio, keine Abhängigkeit) */
function playTone(freq, duration) {
  try {
    if (!audioCtx) {
      const Ctx = window.AudioContext || window.webkitAudioContext;
      if (!Ctx) return;
      audioCtx = new Ctx();
    }
    if (audioCtx.state === 'suspended') audioCtx.resume().catch(() => {});
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    osc.type = 'triangle';
    osc.frequency.value = freq;
    const now = audioCtx.currentTime;
    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.exponentialRampToValueAtTime(0.3, now + 0.03);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + duration);
    osc.connect(gain);
    gain.connect(audioCtx.destination);
    osc.start(now);
    osc.stop(now + duration + 0.05);
  } catch (e) {
    // Ton ist optional
  }
}

function fieldColors(field) {
  return {
    normal: getRgbSpreadHex(laserConfig.testColor, field.hue, 0.7, 0.45),
    grow: getRgbSpreadHex(laserConfig.testColor, field.hue, 0.7, 0.7),
    active: getRgbSpreadHex(laserConfig.testColor, field.hue, 0.7, 0.9),
    bright: getRgbSpreadHex(laserConfig.testColor, field.hue, 0.3, 1),
  };
}

function fieldPos(i) {
  const a = -Math.PI / 2 + (i * 2 * Math.PI) / FIELDS.length;
  return { x: 1920 / 2 + Math.cos(a) * RING_RX, y: 1080 / 2 + Math.sin(a) * RING_RY };
}

function createFieldButtons() {
  return FIELDS.map((field, i) => {
    const pos = fieldPos(i);
    const colors = fieldColors(field);
    return guiFillButton({
      label: field.label,
      posX: pos.x,
      posY: pos.y,
      radius: FIELD_RADIUS,
      edges: field.edges,
      edges2: field.edges2,
      angle: field.angle,
      lineWidth: 5,
      speedUp: DIFFICULTY.buttonSpeedUp,
      speedDown: DIFFICULTY.buttonSpeedDown,
      minValue: 10,
      activeValue: DIFFICULTY.buttonActiveValue,
      counterReset: true,
      normalColor: colors.normal,
      growColor: colors.grow,
      activeColor: colors.active,
      onEnterActive: () => registerInput(i),
    });
  });
}

/** Feld i hell oder normal einfärben */
function setHighlight(i, on) {
  const b = fieldButtons[i];
  if (!b) return;
  const colors = fieldColors(FIELDS[i]);
  b.setColor(on ? colors.bright : colors.normal);
  b.setGrowColor(on ? colors.bright : colors.grow);
  b.setActiveColor(on ? colors.bright : colors.active);
}

function resetAllCounters() {
  fieldButtons.forEach((b) => b.setCounter(0));
}

function currentShowOnTime() {
  const k = Math.max(0, round - DIFFICULTY.speedUpFromRound + 1);
  return Math.max(
    DIFFICULTY.showOnTimeMin,
    DIFFICULTY.showOnTime * Math.pow(DIFFICULTY.showTimeFactor, k)
  );
}

function currentShowOffTime() {
  const k = Math.max(0, round - DIFFICULTY.speedUpFromRound + 1);
  return Math.max(
    DIFFICULTY.showOffTimeMin,
    DIFFICULTY.showOffTime * Math.pow(DIFFICULTY.showTimeFactor, k)
  );
}

function currentInputTime() {
  return Math.max(
    DIFFICULTY.inputTimeMin,
    DIFFICULTY.inputTimeStart + DIFFICULTY.inputTimePerRound * (round - 1)
  );
}

function startShow() {
  phase = 'zeigen';
  showIndex = -1; // -1 = Vorlauf
  showTimer = DIFFICULTY.showLeadIn;
  resetAllCounters();
  FIELDS.forEach((f, i) => setHighlight(i, false));
}

function startInput() {
  phase = 'nachmachen';
  inputIndex = 0;
  inputTimer = currentInputTime();
  resetAllCounters();
  FIELDS.forEach((f, i) => setHighlight(i, false));
}

function startPause(text, duration) {
  phase = 'pause';
  pauseText = text;
  pauseTimer = duration;
  resetAllCounters();
}

function triggerGameOver(reason) {
  gameState = 'gameover';
  hasPlayed = true;
  gameOverText = reason;
  buttonsGameOverScreen = createButtonsGameOverScreen();
}

function mistake(reason) {
  stats.mistakes++;
  lives--;
  playSound(soundError);
  if (lives <= 0) {
    triggerGameOver(reason);
    return;
  }
  startPause(`${reason}\nNochmal zuschauen!`, DIFFICULTY.pauseMistake);
}

/** wird von den Feldern (onEnterActive) und der Tastatur aufgerufen */
function registerInput(i) {
  if (gameState !== 'game' || phase !== 'nachmachen') return;
  stats.inputs++;
  if (sequence[inputIndex] === i) {
    playTone(FIELDS[i].freq, 0.4);
    flashTimers[i] = DIFFICULTY.flashTime;
    inputIndex++;
    // jeder Schritt ist eine neue Abstimmung
    resetAllCounters();
    if (inputIndex >= sequence.length) {
      stats.longest = Math.max(stats.longest, sequence.length);
      playSound(soundLevelUp);
      round++;
      sequence.push(Math.floor(Math.random() * FIELDS.length));
      startPause(`Runde geschafft!\nJetzt ${sequence.length} Felder`, DIFFICULTY.pauseRoundDone);
    } else {
      inputTimer = currentInputTime();
    }
  } else {
    flashTimers[i] = DIFFICULTY.flashTime;
    mistake(`Falsch! Richtig wäre: ${FIELDS[sequence[inputIndex]].label}`);
  }
}

function resetGame() {
  gameState = 'game';
  gameTime = 0;
  round = 1;
  lives = DIFFICULTY.lives;
  stats = { longest: 0, mistakes: 0, inputs: 0 };
  sequence = [];
  for (let k = 0; k < DIFFICULTY.startLength; k++) {
    sequence.push(Math.floor(Math.random() * FIELDS.length));
  }
  flashTimers = FIELDS.map(() => 0);
  fieldButtons = createFieldButtons();
  prevKeys = {};
  playSound(soundConfirm);
  startShow();
  lastTime = performance.now();
}

const createButtonsGameOverScreen = () => [
  guiFillButton({
    label: 'Start',
    posX: 1920 / 2,
    posY: 1080 / 2 + 250,
    radius: 180,
    edges: 6,
    edges2: 3,
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

/** Tastatur-Fallback: Ziffern 1-6 (nur Flanke "gedrückt") */
function handleKeyboard() {
  FIELDS.forEach((f, i) => {
    const code = `Digit${i + 1}`;
    const down = !!laserConfig.pressedKeys[code];
    if (down && !prevKeys[code]) registerInput(i);
    prevKeys[code] = down;
  });
}

function renderCenterText(ctx, text, hueShift) {
  util.renderTextDropShadow({
    ctx,
    text,
    fontSize: '70px',
    lineHeight: 80,
    fillStyle: getRgbSpreadHex(laserConfig.testColor, hueShift, 0.6, 1),
    x: 1920 / 2,
    y: 1080 / 2 - 20,
  });
}

function renderTimeBar(ctx, fraction) {
  const w = 500;
  const h = 30;
  const x = 1920 / 2 - w / 2;
  const y = 1080 / 2 + 60;
  ctx.save();
  ctx.strokeStyle = getRgbSpreadHex(laserConfig.testColor, 0.4, 0.5, 0.8);
  ctx.lineWidth = 3;
  ctx.strokeRect(x, y, w, h);
  ctx.fillStyle =
    fraction > 0.3
      ? getRgbSpreadHex(laserConfig.testColor, 0.4, 0.6, 0.8)
      : getRgbSpreadHex(laserConfig.testColor, 0.6, 0.9, 1);
  ctx.fillRect(x, y, w * Math.max(0, Math.min(1, fraction)), h);
  ctx.restore();
}

function renderLives(ctx) {
  for (let k = 0; k < DIFFICULTY.lives; k++) {
    drawNgon({
      ctx,
      numberOfSides: 32,
      size: 25,
      Xcenter: 1920 - 80 - k * 70,
      Ycenter: 80,
      color: getRgbSpreadHex(laserConfig.testColor, 0.35, 0.7, k < lives ? 0.9 : 0.25),
      lineWidth: 4,
      filled: k < lives,
    });
  }
}

export default {
  name: 'Melodien (simon) ',
  description: `



  Immer längere Melodien nachspielen.


  `,
  image: 'media/img/gametitles/laser-mandelbrot-###4###.png',
  init: function () {
    gameState = 'gameover';
    hasPlayed = false;
    lastTime = 0;
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
    buttonsGameOverScreen.forEach((item) => item.handle(grid, elapsed));
    util.renderTextDropShadow({
      ctx,
      text: 'Laser-Simon',
      fontSize: '150px',
      fillStyle: getRgbSpreadHex(laserConfig.testColor, 0.4),
      x: laserConfig.canvasResolution.width / 2,
      y: 200,
    });
    const text = hasPlayed
      ? `${gameOverText}
Game Over! Längste Sequenz: ${stats.longest} Felder (Runde ${round})
${stats.mistakes} Fehler - ${gameTime.toFixed(1)}s gespielt`
      : `Schaut zu, merkt euch die Reihenfolge
und leuchtet die Felder gemeinsam nach!`;
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

    // Phasenlogik
    if (phase === 'zeigen') {
      showTimer -= elapsed;
      if (showTimer <= 0) {
        if (showIndex >= 0) setHighlight(sequence[showIndex], false);
        showIndex++;
        if (showIndex >= sequence.length) {
          startInput();
        } else {
          // leuchten (onTime) + Pause (offTime) pro Feld
          setHighlight(sequence[showIndex], true);
          playTone(FIELDS[sequence[showIndex]].freq, currentShowOnTime());
          showTimer = currentShowOnTime() + currentShowOffTime();
        }
      } else if (showIndex >= 0 && showTimer <= currentShowOffTime()) {
        setHighlight(sequence[showIndex], false);
      }
    } else if (phase === 'nachmachen') {
      inputTimer -= elapsed;
      handleKeyboard();
      if (phase === 'nachmachen' && inputTimer <= 0) {
        mistake('Zeit abgelaufen!');
      }
    } else if (phase === 'pause') {
      pauseTimer -= elapsed;
      if (pauseTimer <= 0) {
        startShow();
      }
    }
    if (gameState !== 'game') return;

    // Felder: nur in 'nachmachen' bekommen sie das echte Grid, sonst ein leeres (Eingabe gesperrt)
    const inputGrid = phase === 'nachmachen' ? grid : getEmptyGrid(grid.length);
    fieldButtons.slice().forEach((button, i) => {
      // Hervorhebung beim Zeigen bzw. kurzes Aufleuchten nach Eingabe
      const showLit =
        phase === 'zeigen' &&
        showIndex >= 0 &&
        sequence[showIndex] === i &&
        showTimer > currentShowOffTime();
      flashTimers[i] = Math.max(0, flashTimers[i] - elapsed);
      if (showLit || flashTimers[i] > 0) {
        ctx.save();
        ctx.globalAlpha = 0.6;
        drawNgon({
          ctx,
          numberOfSides: FIELDS[i].edges,
          size: FIELD_RADIUS,
          Xcenter: button.getX(),
          Ycenter: button.getY(),
          color: fieldColors(FIELDS[i]).bright,
          angle: FIELDS[i].angle,
          lineWidth: 8,
          filled: true,
        });
        ctx.restore();
      }
      button.handle(inputGrid, elapsed);
      if (gameState !== 'game') return;
    });
    if (gameState !== 'game') return;

    // Mitte: Phase anzeigen
    if (phase === 'zeigen') {
      renderCenterText(ctx, 'Schaut zu!', 0.55);
    } else if (phase === 'nachmachen') {
      renderCenterText(ctx, `Nachmachen!\nSchritt ${inputIndex + 1} / ${sequence.length}`, 0.3);
      renderTimeBar(ctx, inputTimer / currentInputTime());
    } else {
      renderCenterText(ctx, pauseText, 0.45);
    }

    // HUD
    util.renderTextDropShadow({
      ctx,
      text: `Runde ${round} - ${gameTime.toFixed(1)}s`,
      fontSize: '50px',
      fillStyle: getRgbSpreadHex(laserConfig.testColor, 0.3),
      align: 'left',
      x: 60,
      y: 90,
    });
    util.renderTextDropShadow({
      ctx,
      text: `Fehler: ${stats.mistakes}`,
      fontSize: '40px',
      fillStyle: getRgbSpreadHex(laserConfig.testColor, 0.3),
      align: 'left',
      x: 60,
      y: 1080 - 60,
    });
    renderLives(ctx);
  },
};
