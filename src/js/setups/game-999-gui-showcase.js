/**
 * GUI-Showcase – Testszene für die GUI-Komponenten (kein Spiel)
 *
 * Zeigt regionButton, voteGroup, dragHandle, blobTracker, swipeDetector, calmMeter, steerStrip und
 * zoneSplit gleichzeitig mit ihren Live-Werten. Dient als Testbett und als Beispielcode.
 * Nicht in view.js registriert; bei Bedarf eintragen:
 *   new GameWrapper(require('./setups/game-999-gui-showcase').default),
 *
 * Tastatur-Test: 1–3 = Abstimmen, R = Region füllen, G = Greifen/Ablegen + Pfeile = Ziehen,
 * B = Test-Blobs, Q/E = Wischen links/rechts, C = Chaos, V = Ruhe, J/K = Lenkstreifen.
 */
import util, { getRgbSpreadHex } from '../util.js';

var laserConfig = require('../LaserApiConfig.js').default;
var MasterCanvas = require('../MasterCanvas').default;
var guiRegionButton = require('./gui/regionButton').default;
var guiVoteGroup = require('./gui/voteGroup').default;
var guiDragHandle = require('./gui/dragHandle').default;
var guiBlobTracker = require('./gui/blobTracker').default;
var guiSwipeDetector = require('./gui/swipeDetector').default;
var guiCalmMeter = require('./gui/calmMeter').default;
var guiSteerStrip = require('./gui/steerStrip').default;
var guiZoneSplit = require('./gui/zoneSplit').default;

var components = [];
var zones = null;
var log = [];
var C = {};

function col(h, s, v) {
  return getRgbSpreadHex(laserConfig.testColor, h, s, v);
}

function addLog(text) {
  log.unshift(text);
  if (log.length > 4) log.length = 4;
}

function star(cx, cy, rOut, rIn, n) {
  const pts = [];
  for (let i = 0; i < n * 2; i++) {
    const a = -Math.PI / 2 + (i * Math.PI) / n;
    const r = i % 2 ? rIn : rOut;
    pts.push([cx + Math.cos(a) * r, cy + Math.sin(a) * r]);
  }
  return pts;
}

export default {
  name: 'GUI-Showcase',
  description: `
Testszene für die GUI-Komponenten:
regionButton, voteGroup, dragHandle, blobTracker,
swipeDetector, calmMeter, steerStrip, zoneSplit.
  `,
  image: 'media/img/gametitles/laser-defense-###4###.png',
  init: function () {
    C = {
      a: col(0.3, 0.6, 0.95),
      b: col(0.5, 0.5, 0.95),
      c: col(0.7, 0.6, 0.95),
      dim: col(0.5, 0.3, 0.5),
      text: col(0.5, 0.1, 0.95),
    };
    log = [];
    const region = guiRegionButton({
      label: 'REGION',
      polygon: star(250, 290, 170, 80, 5),
      speedUp: 60,
      fullPercent: 20,
      counterReset: true,
      keyCode: 'KeyR',
      normalColor: C.dim,
      growColor: C.b,
      activeColor: C.a,
      onEnterActive: () => addLog('regionButton: ausgelöst'),
    });
    const vote = guiVoteGroup({
      label: 'ABSTIMMUNG',
      options: [
        { x: 620, y: 300, label: 'A' },
        { x: 840, y: 300, label: 'B' },
        { x: 1060, y: 300, label: 'C' },
      ],
      radius: 90,
      timeLimit: 8,
      lockAfterDecide: false,
      keyCodes: ['Digit1', 'Digit2', 'Digit3'],
      normalColor: C.dim,
      growColor: C.b,
      activeColor: C.a,
      onDecide: (i, info) => addLog('voteGroup: ' + (i >= 0 ? 'ABC'[i] : 'keine') + ' (' + info.reason + ')'),
    });
    const drag = guiDragHandle({
      label: 'ZIEH',
      posX: 1380,
      posY: 300,
      radius: 70,
      edges: 4,
      bounds: { x: 1220, y: 140, width: 680, height: 330 },
      snapPoints: [
        { x: 1780, y: 220 },
        { x: 1780, y: 400 },
      ],
      keyCodes: { grab: 'KeyG', left: 'ArrowLeft', right: 'ArrowRight', up: 'ArrowUp', down: 'ArrowDown' },
      normalColor: C.dim,
      grabColor: C.b,
      activeColor: C.a,
      onGrab: () => addLog('dragHandle: gegriffen'),
      onDrop: (h, i) => addLog('dragHandle: abgelegt' + (i >= 0 ? ' auf Ziel ' + (i + 1) : '')),
    });
    const blobs = guiBlobTracker({
      label: 'BLOBS',
      posX: 330,
      posY: 690,
      width: 600,
      height: 380,
      testKey: 'KeyB',
      visible: true,
      normalColor: C.dim,
      blobColor: C.c,
    });
    const swipe = guiSwipeDetector({
      label: 'GESTEN',
      posX: 960,
      posY: 690,
      width: 600,
      height: 380,
      keyCodes: { left: 'KeyQ', right: 'KeyE' },
      normalColor: C.dim,
      trailColor: C.c,
      onSwipe: (d) => addLog('swipeDetector: ' + d),
      onCircle: (d) => addLog('swipeDetector: Kreis ' + d),
    });
    const calm = guiCalmMeter({
      label: 'RUHE',
      posX: 1590,
      posY: 690,
      width: 600,
      height: 380,
      chaosKey: 'KeyC',
      calmKey: 'KeyV',
      visible: true,
      normalColor: C.dim,
      calmColor: C.a,
      chaosColor: C.c,
      onChaos: () => addLog('calmMeter: CHAOS!'),
      onCalm: () => addLog('calmMeter: ruhig gehalten'),
    });
    const steer = guiSteerStrip({
      label: 'LENKSTREIFEN',
      posY: 1000,
      height: 130,
      keyCodes: { minus: 'KeyJ', plus: 'KeyK' },
      normalColor: C.dim,
      markerColor: C.a,
    });
    zones = guiZoneSplit({ columns: 2, visible: false });
    components = [zones, region, vote, drag, blobs, swipe, calm, steer];
    this.blobs = blobs;
    this.calm = calm;
    this.steer = steer;
  },
  handle: function (grid, elapsed) {
    const dt = Math.min(elapsed || 0.016, 0.1);
    const ctx = MasterCanvas.get2dContext();
    components.forEach((c) => c.handle(grid, dt));
    const lines = [
      'Blobs: ' + this.blobs.getCount(),
      'Chaos: ' + this.calm.getChaos().toFixed(2),
      'Lenkung: ' + (this.steer.hasInput() ? this.steer.getValue().toFixed(2) : '–') + ' Fokus ' + this.steer.getFocus().toFixed(2),
      'Links/Rechts: ' + zones.getBalanceX().toFixed(2),
    ];
    util.renderText({ ctx, text: lines.join('   ·   '), x: 960, y: 60, fontSize: '36px', fillStyle: C.text });
    util.renderText({ ctx, text: log.join('   |   '), x: 960, y: 110, fontSize: '28px', fillStyle: C.a });
  },
  stop: function () {
    components = [];
  },
};
