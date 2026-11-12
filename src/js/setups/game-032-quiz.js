/**
 * Laser-Quiz
 *
 * Publikumsquiz für viele Laser gleichzeitig.
 * Oben steht eine Frage, darunter vier große Antwortfelder (A-D). Das Publikum stimmt ab,
 * indem es das Feld seiner Wahl beleuchtet. Jedes Feld ist ein gui/pixelFillButton: es füllt
 * sich umso schneller, je größer der beleuchtete Flächenanteil ist. Das Feld, auf das die
 * meisten zielen, füllt sich also zuerst. Das erste volle Feld ist die gewählte Antwort,
 * danach sind alle Felder gesperrt.
 *
 * Pro Frage gibt es ein Zeitlimit. Läuft es ab, zählt das Feld mit dem höchsten Füllstand
 * (ist keines gefüllt, zählt das als falsch).
 * Danach wird die Lösung aufgelöst: richtig = +1 Punkt und die Serie wächst,
 * falsch = ein Leben weg. 3 Leben. Game Over bei 0 Leben, sind alle Fragen beantwortet: gewonnen.
 *
 * Unter jedem Feld zeigt ein Balken die aktuelle "Stimmung" (geglätteter Flächenanteil).
 * Zum Testen ohne Laser: Tasten 1-4 füllen die Felder.
 *
 * Alle Stellschrauben stehen gesammelt in DIFFICULTY.
 */

import util, { getRgbSpreadHex, removeItemFromArray } from '../util.js';
import { rgbToHsv } from '../color-conversion.js';
var laserConfig = require('../LaserApiConfig.js').default;
var MasterCanvas = require('../MasterCanvas').default;
var guiFillButton = require('./gui/fillButton').default;
var guiPixelFillButton = require('./gui/pixelFillButton').default;
import soundCorrect from '../../../public/media/opengameart/Accept.mp3';
import soundWrong from '../../../public/media/opengameart/Decline.wav';
import soundWin from '../../../public/media/fans1-463918_9722681-lq.mp3';
import soundLose from '../../../public/media/opengameart/Menu Error.ogg';

const DIFFICULTY = {
  lives: 3,
  questionsPerGame: 20, // höchstens so viele Fragen pro Spiel (begrenzt durch den Fragenpool)
  questionDuration: 20, // Sekunden pro Frage
  revealDuration: 3, // Sekunden Auflösung
  // Abstimmung: bei voller Bedeckung (fullPercent der Feldfläche leuchtet) ist das Feld nach voteTime voll
  voteTime: 4,
  fullPercent: 15,
  minPercent: 1, // darunter zählt es als Rauschen
  voteDecay: 10, // Füllstand-Verlust pro Sekunde ohne Licht
  activeValue: 99,
  moodSmoothing: 3, // je größer, desto schneller folgt der Stimmungsbalken
  fieldRadius: 170,
  fieldY: 590,
};

const QUESTIONS = [
  { q: 'Wie viele Beine hat eine Spinne?', a: ['8', '6', '10', '12'] },
  { q: 'Welcher Planet ist der Sonne am nächsten?', a: ['Merkur', 'Venus', 'Mars', 'Erde'] },
  { q: 'Wie heißt die Hauptstadt von Australien?', a: ['Canberra', 'Sydney', 'Melbourne', 'Perth'] },
  { q: 'Wie viele Minuten hat ein Tag?', a: ['1440', '1240', '1600', '2400'] },
  {
    q: 'Welches ist das größte lebende Tier der Erde?',
    a: ['Blauwal', 'Afrikanischer Elefant', 'Pottwal', 'Walhai'],
  },
  {
    q: 'Welches Element hat das chemische Symbol O?',
    a: ['Sauerstoff', 'Gold', 'Osmium', 'Wasserstoff'],
  },
  { q: 'Wie viele Spieler einer Fußballmannschaft stehen auf dem Feld?', a: ['11', '10', '9', '12'] },
  {
    q: 'Wer malte die Mona Lisa?',
    a: ['Leonardo da Vinci', 'Michelangelo', 'Raffael', 'Pablo Picasso'],
  },
  { q: 'Welche Farbe hat die Haut eines Eisbären?', a: ['Schwarz', 'Weiß', 'Rosa', 'Hellgrau'] },
  { q: 'Wie heißt die Hauptstadt von Kanada?', a: ['Ottawa', 'Toronto', 'Vancouver', 'Montreal'] },
  { q: 'In welchem Jahr fiel die Berliner Mauer?', a: ['1989', '1990', '1987', '1991'] },
  { q: 'Wie viele Herzen hat ein Oktopus?', a: ['3', '1', '2', '8'] },
  { q: 'Was ist die Quadratwurzel aus 144?', a: ['12', '14', '11', '16'] },
  {
    q: 'Welches Gas nehmen Pflanzen für die Photosynthese auf?',
    a: ['Kohlendioxid', 'Sauerstoff', 'Stickstoff', 'Helium'],
  },
  { q: 'Wie nennt man ein Känguru-Baby?', a: ['Joey', 'Kitz', 'Welpe', 'Fohlen'] },
  {
    q: 'In welcher Programmiersprache ist dieses Spiel geschrieben?',
    a: ['JavaScript', 'Python', 'Java', 'COBOL'],
  },
  { q: 'Wie viele Bits hat ein Byte?', a: ['8', '4', '16', '10'] },
  {
    q: 'Welcher Ozean ist der größte?',
    a: ['Pazifik', 'Atlantik', 'Indischer Ozean', 'Arktischer Ozean'],
  },
  {
    q: 'Was misst ein Barometer?',
    a: ['Luftdruck', 'Temperatur', 'Windstärke', 'Luftfeuchtigkeit'],
  },
  {
    q: 'Welches ist das flächenmäßig kleinste Bundesland?',
    a: ['Bremen', 'Saarland', 'Hamburg', 'Berlin'],
  },
  { q: 'Wie viele Saiten hat eine normale Gitarre?', a: ['6', '4', '5', '7'] },
  {
    q: 'Welche dieser Früchte ist botanisch eine Beere?',
    a: ['Banane', 'Erdbeere', 'Himbeere', 'Kirsche'],
  },
  { q: 'Wer schrieb den "Faust"?', a: ['Goethe', 'Schiller', 'Lessing', 'Heine'] },
  { q: 'Was ist die Hauptzutat von Guacamole?', a: ['Avocado', 'Gurke', 'Erbsen', 'Limette'] },
  {
    q: 'Wie lange braucht Sonnenlicht ungefähr bis zur Erde?',
    a: ['8 Minuten', '8 Sekunden', '8 Stunden', '1 Minute'],
  },
  { q: 'Welches Instrument hat meistens 88 Tasten?', a: ['Klavier', 'Akkordeon', 'Orgel', 'Mundharmonika'] },
  {
    q: 'Wie heißt der höchste Berg Deutschlands?',
    a: ['Zugspitze', 'Watzmann', 'Brocken', 'Feldberg'],
  },
  { q: 'Wofür steht das L in LASER?', a: ['Light', 'Lumen', 'Line', 'Laser'] },
  { q: 'Wie viele Zähne hat ein Erwachsener normalerweise?', a: ['32', '28', '30', '36'] },
  {
    q: 'Welches Land hat die meisten Einwohner?',
    a: ['Indien', 'China', 'USA', 'Indonesien'],
  },
  { q: 'Welches Tier ist das Wappentier von Berlin?', a: ['Bär', 'Adler', 'Löwe', 'Hirsch'] },
  { q: 'Was ergibt 7 mal 8?', a: ['56', '54', '48', '64'] },
  { q: 'Wie viele Ecken hat ein Sechseck?', a: ['6', '5', '7', '8'] },
  { q: 'Welche Farbe entsteht aus Blau und Gelb?', a: ['Grün', 'Lila', 'Orange', 'Braun'] },
  {
    q: 'Wer erfand den Buchdruck mit beweglichen Lettern in Europa?',
    a: ['Gutenberg', 'Luther', 'Dürer', 'Kepler'],
  },
  { q: 'Welcher Vogel kann rückwärts fliegen?', a: ['Kolibri', 'Spatz', 'Adler', 'Pinguin'] },
  { q: 'Welche Stadt ist die Bundesstadt der Schweiz?', a: ['Bern', 'Zürich', 'Genf', 'Basel'] },
  {
    q: 'Wie viel der Erdoberfläche ist etwa mit Wasser bedeckt?',
    a: ['71 Prozent', '50 Prozent', '60 Prozent', '85 Prozent'],
  },
  { q: 'Was fressen Pandas hauptsächlich?', a: ['Bambus', 'Fisch', 'Eukalyptus', 'Honig'] },
  { q: 'Wie viele Tage hat ein Schaltjahr?', a: ['366', '365', '364', '360'] },
];

const LETTERS = ['A', 'B', 'C', 'D'];
const FIELD_HUES = [0.15, 0.4, 0.6, 0.85]; // Farbdrehung je Feld relativ zur Laserfarbe
const FIELD_KEYS = ['Digit1', 'Digit2', 'Digit3', 'Digit4'];

var gameState = 'gameover';
var hasPlayed = false;
var won = false;
var phase = 'question'; // 'question' | 'reveal'
var questionQueue = [];
var questionNumber = 0;
var totalQuestions = 0;
var currentQuestion = null; // { text, answers: [4 Strings], correctIndex }
var questionTime = 0;
var revealTime = 0;
var chosenIndex = -1;
var lastAnswerCorrect = false;
var lives = DIFFICULTY.lives;
var streak = 0;
var mood = [0, 0, 0, 0];
var fields = [];
var activeSounds = [];
var buttonsGameOverScreen = [];
var stats = { correct: 0, bestStreak: 0, fastest: Infinity };
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

function playSound(src) {
  const audio = new Audio(src);
  activeSounds.push(audio);
  audio.onended = () => removeItemFromArray(activeSounds, audio);
  audio.play().catch(() => {});
}

function shuffle(arr) {
  const result = arr.slice();
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    const tmp = result[i];
    result[i] = result[j];
    result[j] = tmp;
  }
  return result;
}

/** bricht Text an Wortgrenzen nach maxChars Zeichen um */
function wrapText(text, maxChars) {
  const words = String(text).split(' ');
  const lines = [];
  let line = '';
  words.forEach((word) => {
    if (line.length > 0 && line.length + 1 + word.length > maxChars) {
      lines.push(line);
      line = word;
    } else {
      line = line.length > 0 ? line + ' ' + word : word;
    }
  });
  if (line.length > 0) lines.push(line);
  return lines.join('\n');
}

/** Farbe "richtig": grünlich, aber nie in der Nähe der Laserfarbe */
function getCorrectColor() {
  const c = laserConfig.testColor;
  const hue = rgbToHsv(c[0], c[1], c[2])[0];
  let target = 0.33; // grün
  const dist = Math.min(Math.abs(hue - target), 1 - Math.abs(hue - target));
  if (dist < 0.15) target = 0.5; // Laser ist selbst grün: auf Türkis ausweichen
  const shift = (target - hue + 1) % 1;
  return getRgbSpreadHex(c, shift, 0.9, 1);
}

function getFieldColor(i, val) {
  return getRgbSpreadHex(laserConfig.testColor, FIELD_HUES[i], 0.6, val);
}

function fieldX(i) {
  return (1920 / 8) * (2 * i + 1);
}

function resetFieldColors() {
  fields.forEach((field, i) => {
    field.setColor(getFieldColor(i, 0.7));
    field.setGrowColor(getFieldColor(i, 0.9));
    field.setActiveColor(getFieldColor(i, 1));
    field.setLineWidth(4);
  });
}

function createFields() {
  return LETTERS.map((letter, i) =>
    guiPixelFillButton({
      label: '',
      posX: fieldX(i),
      posY: DIFFICULTY.fieldY,
      radius: DIFFICULTY.fieldRadius,
      edges: 6,
      angle: Math.PI / 6,
      lineWidth: 4,
      fullPercent: DIFFICULTY.fullPercent,
      minPercent: DIFFICULTY.minPercent,
      speedUp: 100 / DIFFICULTY.voteTime,
      speedDown: DIFFICULTY.voteDecay,
      minValue: 0,
      activeValue: DIFFICULTY.activeValue,
      normalColor: getFieldColor(i, 0.7),
      growColor: getFieldColor(i, 0.9),
      activeColor: getFieldColor(i, 1),
      onEnterActive: () => {
        if (gameState === 'game' && phase === 'question') chooseAnswer(i);
      },
    })
  );
}

function nextQuestion() {
  const raw = questionQueue[questionNumber];
  questionNumber++;
  const order = shuffle([0, 1, 2, 3]);
  currentQuestion = {
    text: raw.q,
    answers: order.map((k) => raw.a[k]),
    correctIndex: order.indexOf(0), // a[0] ist immer die richtige Antwort
  };
  phase = 'question';
  questionTime = 0;
  revealTime = 0;
  chosenIndex = -1;
  mood = [0, 0, 0, 0];
  fields.forEach((field) => field.setValue(0));
  resetFieldColors();
}

/** index = gewähltes Feld, -1 = keine Antwort */
function chooseAnswer(index) {
  phase = 'reveal';
  revealTime = 0;
  chosenIndex = index;
  lastAnswerCorrect = index === currentQuestion.correctIndex;

  if (lastAnswerCorrect) {
    stats.correct++;
    streak++;
    stats.bestStreak = Math.max(stats.bestStreak, streak);
    stats.fastest = Math.min(stats.fastest, questionTime);
    playSound(soundCorrect);
  } else {
    streak = 0;
    lives--;
    playSound(soundWrong);
  }

  // Auflösung einfärben
  const correctColor = getCorrectColor();
  fields.forEach((field, i) => {
    if (i === currentQuestion.correctIndex) {
      field.setColor(correctColor);
      field.setGrowColor(correctColor);
      field.setActiveColor(correctColor);
      field.setLineWidth(10);
    } else {
      const dim = getFieldColor(i, i === index ? 0.5 : 0.3);
      field.setColor(dim);
      field.setGrowColor(dim);
      field.setActiveColor(dim);
    }
  });
}

function endGame(hasWon) {
  won = hasWon;
  gameState = 'gameover';
  buttonsGameOverScreen = createButtonsGameOverScreen();
  playSound(hasWon ? soundWin : soundLose);
}

function resetGame() {
  gameState = 'game';
  hasPlayed = true;
  won = false;
  lives = DIFFICULTY.lives;
  streak = 0;
  stats = { correct: 0, bestStreak: 0, fastest: Infinity };
  questionQueue = shuffle(QUESTIONS);
  totalQuestions = Math.min(DIFFICULTY.questionsPerGame, questionQueue.length);
  questionNumber = 0;
  fields = createFields();
  nextQuestion();
  lastTime = performance.now();
}

const createButtonsGameOverScreen = () => [
  guiFillButton({
    label: 'Start',
    posX: 1920 / 2,
    posY: 1080 / 2 + 250,
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

function renderBar(ctx, x, y, width, height, fraction, color) {
  ctx.save();
  ctx.lineWidth = 3;
  ctx.strokeStyle = color;
  ctx.strokeRect(x, y, width, height);
  ctx.fillStyle = color;
  ctx.fillRect(x, y, width * Math.max(0, Math.min(1, fraction)), height);
  ctx.restore();
}

export default {
  name: 'Laser-Quiz',
  description: `
Willkommen beim Laser-Quiz!

Oben steht eine Frage, darunter vier große Antwortfelder A, B, C und D.
Ihr stimmt ab, indem ihr das Feld eurer Wahl mit dem Laser beleuchtet.
Je mehr Laser auf ein Feld zielen, desto schneller füllt es sich.
Das erste volle Feld ist eure gemeinsame Antwort, danach ist alles gesperrt.
Der Balken unter jedem Feld zeigt die aktuelle Stimmung im Saal.

Pro Frage habt ihr 20 Sekunden. Läuft die Zeit ab, zählt das vollste Feld.
Richtig: +1 Punkt und die Serie wächst. Falsch oder keine Antwort: ein Leben weg.
Ihr habt 3 Leben. Sind sie weg, ist Game Over. Schafft ihr alle Fragen, habt ihr gewonnen!

Tipp: Einigt euch schnell! Wer auf verschiedene Felder leuchtet, bremst die ganze Gruppe.`,
  image: 'media/img/gametitles/laser-sorter-###4###.png',

  init: function () {
    gameState = 'gameover';
    hasPlayed = false;
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
      text: 'Laser-Quiz',
      fontSize: '150px',
      fillStyle: getRgbSpreadHex(laserConfig.testColor, 0.4),
      x: laserConfig.canvasResolution.width / 2,
      y: 200,
    });
    let text;
    if (hasPlayed) {
      const fastest = stats.fastest === Infinity ? '-' : `${stats.fastest.toFixed(1)}s`;
      text = `${won ? 'Gewonnen! Alle Fragen geschafft!' : 'Game Over - keine Leben mehr!'}
${stats.correct} von ${questionNumber} Fragen richtig
Längste Serie: ${stats.bestStreak} - Schnellste richtige Antwort: ${fastest}`;
    } else {
      text = `Beleuchtet gemeinsam die richtige Antwort!
Das Feld mit den meisten Lasern füllt sich am schnellsten.`;
    }
    util.renderTextDropShadow({
      ctx,
      text,
      fontSize: '45px',
      lineHeight: 70,
      dropDistX: 5,
      dropDistY: 5,
      fillStyle: getRgbSpreadHex(laserConfig.testColor, 0.5),
      x: laserConfig.canvasResolution.width / 2,
      y: 350,
    });
  },

  handleGameScreen(grid, elapsed) {
    const ctx = MasterCanvas.get2dContext();
    const textColor = getRgbSpreadHex(laserConfig.testColor, 0.5, 0.3, 1);

    if (phase === 'question') {
      questionTime += elapsed;
      // Tastatur-Fallback zum Testen ohne Laser
      fields.forEach((field, i) => {
        if (laserConfig.pressedKeys[FIELD_KEYS[i]]) {
          field.setValue(Math.min(100, field.getValue() + (100 / DIFFICULTY.voteTime) * elapsed));
        }
      });
    } else {
      revealTime += elapsed;
    }

    // Felder: während der Auflösung gesperrt (elapsed 0 = Füllstand eingefroren, nur Zeichnen)
    const fieldElapsed = phase === 'question' ? elapsed : 0;
    fields.forEach((field) => field.handle(grid, fieldElapsed));
    if (gameState !== 'game') return;

    // Zeitlimit: das vollste Feld zählt
    if (phase === 'question' && questionTime >= DIFFICULTY.questionDuration) {
      let best = -1;
      let bestValue = 0;
      fields.forEach((field, i) => {
        if (field.getValue() > bestValue) {
          bestValue = field.getValue();
          best = i;
        }
      });
      chooseAnswer(best);
    }

    // Stimmung glätten
    if (phase === 'question') {
      const k = Math.min(1, DIFFICULTY.moodSmoothing * elapsed);
      fields.forEach((field, i) => {
        mood[i] += (field.getFillPercent() - mood[i]) * k;
      });
    }
    const moodSum = mood.reduce((sum, m) => sum + m, 0);

    // Frage
    util.renderTextDropShadow({
      ctx,
      text: wrapText(currentQuestion.text, 48),
      fontSize: '55px',
      lineHeight: 65,
      dropDistX: 4,
      dropDistY: 4,
      fillStyle: textColor,
      x: 1920 / 2,
      y: 130,
    });

    // Zeitbalken
    if (phase === 'question') {
      const remaining = 1 - questionTime / DIFFICULTY.questionDuration;
      renderBar(
        ctx,
        160,
        265,
        1600,
        24,
        remaining,
        getRgbSpreadHex(laserConfig.testColor, remaining > 0.25 ? 0.45 : 0.2, 0.7, 0.9)
      );
    } else {
      let resultText;
      if (chosenIndex < 0) resultText = 'Keine Antwort! Ein Leben weg.';
      else if (lastAnswerCorrect) resultText = `Richtig! Serie: ${streak}`;
      else resultText = 'Leider falsch! Ein Leben weg.';
      util.renderTextDropShadow({
        ctx,
        text: resultText,
        fontSize: '60px',
        dropDistX: 4,
        dropDistY: 4,
        fillStyle: lastAnswerCorrect ? getCorrectColor() : textColor,
        x: 1920 / 2,
        y: 345,
      });
    }

    // Buchstaben, Antworttexte und Stimmungsbalken
    fields.forEach((field, i) => {
      const x = fieldX(i);
      const isCorrect = phase === 'reveal' && i === currentQuestion.correctIndex;
      const color = isCorrect ? getCorrectColor() : getFieldColor(i, 0.95);
      util.renderTextDropShadow({
        ctx,
        text: LETTERS[i],
        fontSize: '90px',
        dropDistX: 4,
        dropDistY: 4,
        fillStyle: color,
        x,
        y: DIFFICULTY.fieldY + 32,
      });
      util.renderTextDropShadow({
        ctx,
        text: wrapText(currentQuestion.answers[i], 18),
        fontSize: '40px',
        lineHeight: 45,
        dropDistX: 3,
        dropDistY: 3,
        fillStyle: color,
        x,
        y: DIFFICULTY.fieldY + DIFFICULTY.fieldRadius + 60,
      });
      const share = moodSum > 0.5 ? mood[i] / moodSum : 0;
      renderBar(ctx, x - 150, 900, 300, 28, share, getFieldColor(i, 0.8));
      util.renderText({
        ctx,
        text: `${Math.round(share * 100)}%`,
        fontSize: '30px',
        fillStyle: getFieldColor(i, 0.8),
        x,
        y: 965,
      });
    });

    // HUD
    util.renderTextDropShadow({
      ctx,
      text: `Frage ${questionNumber}/${totalQuestions} - Punkte: ${stats.correct} - Serie: ${streak} - Leben: ${lives}`,
      fontSize: '42px',
      dropDistX: 4,
      dropDistY: 4,
      fillStyle: getRgbSpreadHex(laserConfig.testColor, 0.3),
      x: 1920 / 2,
      y: 1050,
    });

    // nach der Auflösung weiter
    if (phase === 'reveal' && revealTime >= DIFFICULTY.revealDuration) {
      if (lives <= 0) {
        endGame(false);
      } else if (questionNumber >= totalQuestions) {
        endGame(true);
      } else {
        nextQuestion();
      }
    }
  },
};
