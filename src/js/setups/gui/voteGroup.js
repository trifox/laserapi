/**
 * voteGroup – Abstimmung über mehrere Felder.
 *
 * Jedes Feld füllt sich wie ein pixelFillButton (Füllrate ∝ beleuchteter Flächenanteil, gedeckelt über
 * fullPercent). Das Feld, das zuerst decideValue erreicht, gewinnt. Mit timeLimit gewinnt bei Zeitablauf
 * das Feld mit dem höchsten Füllstand (alle leer = Index -1). Danach ist die Gruppe gesperrt
 * (lockAfterDecide) bis reset() – oder sie läuft mit lockAfterDecide = false sofort weiter (Dauerabstimmung).
 *
 * Zusätzlich liefert getShares() die Stimmenverteilung in Echtzeit (Anteil an allen beleuchteten Feldern,
 * geglättet; bei Eingabe Summe ≈ 1, während des Glättens leicht abweichend, ohne Laser gehen alle Anteile
 * gegen 0) – für Balken, Live-Umfragen, "Publikum entscheidet mit".
 *
 * Gedacht für: Quiz-Antworten, Kartenauswahl, Menüs, Richtungsentscheidungen, Zugwahl in Rundenspielen.
 *
 * Optionen:
 *   options        [{ x, y, label, radius?, color? }, ...] Feldmittelpunkte in Canvas-Pixeln
 *                  (verschoben um posX/posY, Standard 0/0); radius/color überschreiben die Gruppenwerte
 *   radius = 100, edges = 8, label (Titel über der Gruppe), fontSize = 40
 *   speedUp = 40   Füllung pro Sekunde bei voller Abdeckung;  speedDown = 10
 *   fullPercent = 30, minPercent = 0, decideValue = 100
 *   timeLimit = 0  Sekunden bis zur Zwangsentscheidung (0 = keine)
 *   autoStart = true, lockAfterDecide = true, shareSmoothing = 4 (1/s)
 *   keyCodes       ['Digit1', 'Digit2', ...] – Taste i füllt Feld i mit voller Rate (Test ohne Laser)
 *   normalColor, growColor, activeColor (Gewinner), lineWidth = 4, visible = true, showShares = true
 *   onDecide(index, info, group)  info = { reason: 'full' | 'timeout', counters: [..], shares: [..] }
 *
 * Getter/Setter: X/Y (Verschiebung der ganzen Gruppe), Radius (Standardradius), Color, Label (Titel).
 * Steuerung: start(), stop() (pausiert), reset() (leert alles, startet neu), setTimeLimit(s).
 * Abfragen: getState() ('idle' | 'running' | 'decided'), isDecided(), getWinner(), getLeader(),
 *   getCounter(i)/getCounters(), getShare(i)/getShares(), getPercents() (roher Flächenanteil je Feld),
 *   getTimeLeft(), getOptionCount(); setOptionLabel(i, text), setOptionPosition(i, x, y).
 *
 * Beispiel:
 *   const frage = guiVoteGroup({
 *     options: [{ x: 480, y: 700, label: 'A' }, { x: 1440, y: 700, label: 'B' }],
 *     timeLimit: 15, keyCodes: ['Digit1', 'Digit2'],
 *     onDecide: (i) => auswerten(i),
 *   });
 *   frage.handle(grid, elapsed);
 */
import { scanCircle, isKeyDown, approach } from './gridScan.js';
var MasterCanvas = require('../../MasterCanvas').default;
var util = require('../../util.js').default;

export default ({
  label = '',
  options = [],
  posX = 0,
  posY = 0,
  radius = 100,
  edges = 8,
  fontSize = 40,
  speedUp = 40,
  speedDown = 10,
  fullPercent = 30,
  minPercent = 0,
  decideValue = 100,
  timeLimit = 0,
  autoStart = true,
  lockAfterDecide = true,
  shareSmoothing = 4,
  keyCodes = [],
  normalColor = '#0044ff',
  growColor = '#0088ff',
  activeColor = '#00bbff',
  lineWidth = 4,
  visible = true,
  showShares = true,
  onDecide,
}) => {
  var offX = posX;
  var offY = posY;
  var defaultRadius = radius;
  var currentColor = normalColor;
  var currentLabel = label;
  var currentTimeLimit = timeLimit;
  var timeLeft = timeLimit;
  var state = autoStart ? 'running' : 'idle';
  var winner = -1;
  var opts = options.map((o) => ({
    x: o.x,
    y: o.y,
    label: o.label || '',
    radius: o.radius,
    color: o.color,
    counter: 0,
    percent: 0,
    share: 0,
  }));

  function optRadius(o) {
    return o.radius || defaultRadius;
  }

  function leader() {
    let best = -1;
    opts.forEach((o, i) => {
      if (o.counter > 0 && (best < 0 || o.counter > opts[best].counter)) best = i;
    });
    return best;
  }

  function clearCounters() {
    opts.forEach((o) => {
      o.counter = 0;
      o.percent = 0;
    });
  }

  function decide(index, reason) {
    winner = index;
    const info = {
      reason,
      counters: opts.map((o) => o.counter),
      shares: opts.map((o) => o.share),
    };
    if (lockAfterDecide) {
      state = 'decided';
    } else {
      clearCounters();
      timeLeft = currentTimeLimit;
    }
    if (onDecide) onDecide(index, info, result);
  }

  function draw() {
    const ctx = MasterCanvas.get2dContext();
    let minY = Infinity;
    let sumX = 0;
    opts.forEach((o, i) => {
      const x = offX + o.x;
      const y = offY + o.y;
      const r = optRadius(o);
      minY = Math.min(minY, y - r);
      sumX += x;
      const isWinner = state === 'decided' && winner === i;
      const color = isWinner ? activeColor : o.counter > 0 ? growColor : o.color || currentColor;
      util.drawNgon({ ctx, color, Xcenter: x, Ycenter: y, size: r, numberOfSides: edges, lineWidth: isWinner ? lineWidth * 2 : lineWidth });
      if (o.counter > 0) {
        ctx.save();
        ctx.globalAlpha = 0.35;
        util.drawNgon({ ctx, color, Xcenter: x, Ycenter: y, size: r * Math.min(1, o.counter / decideValue), numberOfSides: edges, lineWidth: 1, filled: true });
        ctx.restore();
      }
      if (o.label) util.renderText({ ctx, text: o.label, x, y: y + fontSize * 0.35, fontSize: fontSize + 'px', fillStyle: color });
      if (showShares) {
        util.renderText({ ctx, text: Math.round(o.share * 100) + '%', x, y: y + r * 0.6, fontSize: Math.round(fontSize * 0.7) + 'px', fillStyle: color });
      }
    });
    if (currentLabel && opts.length) {
      const t = currentTimeLimit > 0 && state === 'running' ? '  ·  ' + Math.ceil(timeLeft) + ' s' : '';
      util.renderText({ ctx, text: currentLabel + t, x: sumX / opts.length, y: minY - 30, fontSize: fontSize + 'px', fillStyle: currentColor });
    }
  }

  var result = {
    name: 'GUI voteGroup',
    init: function () {},
    getX() {
      return offX;
    },
    setX(v) {
      offX = v;
    },
    getY() {
      return offY;
    },
    setY(v) {
      offY = v;
    },
    getRadius() {
      return defaultRadius;
    },
    setRadius(v) {
      defaultRadius = v;
    },
    getColor() {
      return currentColor;
    },
    setColor(v) {
      currentColor = v;
    },
    getLabel() {
      return currentLabel;
    },
    setLabel(v) {
      currentLabel = v;
    },
    start() {
      if (state !== 'decided') state = 'running';
    },
    stop() {
      if (state === 'running') state = 'idle';
    },
    reset() {
      clearCounters();
      opts.forEach((o) => (o.share = 0));
      winner = -1;
      timeLeft = currentTimeLimit;
      state = 'running';
    },
    setTimeLimit(v) {
      currentTimeLimit = v;
      timeLeft = v;
    },
    getTimeLeft() {
      return timeLeft;
    },
    getState() {
      return state;
    },
    isDecided() {
      return state === 'decided';
    },
    getWinner() {
      return winner;
    },
    getLeader() {
      return leader();
    },
    getOptionCount() {
      return opts.length;
    },
    getCounter(i) {
      return opts[i] ? opts[i].counter : 0;
    },
    getCounters() {
      return opts.map((o) => o.counter);
    },
    getShare(i) {
      return opts[i] ? opts[i].share : 0;
    },
    getShares() {
      return opts.map((o) => o.share);
    },
    getPercents() {
      return opts.map((o) => o.percent);
    },
    setOptionLabel(i, text) {
      if (opts[i]) opts[i].label = text;
    },
    setOptionPosition(i, x, y) {
      if (opts[i]) {
        opts[i].x = x;
        opts[i].y = y;
      }
    },
    handle: function (grid, elapsed) {
      if (state === 'running') {
        let sum = 0;
        opts.forEach((o, i) => {
          const s = scanCircle(grid, offX + o.x, offY + o.y, optRadius(o));
          o.percent = isKeyDown(keyCodes[i]) ? 100 : s.percent;
          sum += o.percent;
          if (o.percent > 0 && o.percent > minPercent) {
            const rate = Math.min(1, o.percent / Math.max(0.001, fullPercent));
            o.counter = Math.min(decideValue, o.counter + speedUp * rate * elapsed);
          } else {
            o.counter = Math.max(0, o.counter - speedDown * elapsed);
          }
        });
        opts.forEach((o) => {
          o.share = approach(o.share, sum > 0 ? o.percent / sum : 0, shareSmoothing, elapsed);
        });
        let full = -1;
        opts.forEach((o, i) => {
          if (o.counter >= decideValue && (full < 0 || o.percent > opts[full].percent)) full = i;
        });
        if (full >= 0) {
          decide(full, 'full');
        } else if (currentTimeLimit > 0) {
          timeLeft -= elapsed;
          if (timeLeft <= 0) decide(leader(), 'timeout');
        }
      }
      if (visible) draw();
    },
  };
  return result;
};
