/**
 * GUI-ai2-Test – Testszene für die überarbeiteten Original-Komponenten (*-ai2.js), kein Spiel.
 *
 * Zeigt fillButton-ai2, flipButton-ai2, followCircle-ai2, switch-ai2, rangeSlider-ai2,
 * pixelCount1D/2D/4D-ai2 und pixelCountButton-ai2 gleichzeitig, mit Ereignis-Log.
 * Nicht in view.js registriert; bei Bedarf eintragen:
 *   new GameWrapper(require('./setups/game-998-gui-ai2-test').default),
 *
 * Tastatur-Test: Leertaste = Tasten-fillButton (soll pro Druck genau EINMAL auslösen).
 */
import util, { getRgbSpreadHex } from '../util.js';

var laserConfig = require('../LaserApiConfig.js').default;
var MasterCanvas = require('../MasterCanvas').default;
var guiFillButton = require('./gui/fillButton-ai2').default;
var guiFlipButton = require('./gui/flipButton-ai2').default;
var guiFollowCircle = require('./gui/followCircle-ai2').default;
var guiSwitch = require('./gui/switch-ai2').default;
var guiRangeSlider = require('./gui/rangeSlider-ai2').default;
var pixelCount1D = require('./gui/pixelCount1D-ai2').default;
var pixelCount2D = require('./gui/pixelCount2D-ai2').default;
var pixelCount4D = require('./gui/pixelCount4D-ai2').default;
var pixelCountButton = require('./gui/pixelCountButton-ai2').default;

var components = [];
var log = [];
var counts = {};
var C = {};
var refs = {};

function col(h, s, v) {
  return getRgbSpreadHex(laserConfig.testColor, h, s, v);
}

function addLog(text) {
  counts[text] = (counts[text] || 0) + 1;
  log.unshift(text + ' (' + counts[text] + ')');
  if (log.length > 5) log.length = 5;
}

export default {
  name: 'GUI-ai2-Test',
  description: `
Testszene für die überarbeiteten Original-Komponenten (-ai2).
  `,
  image: 'media/img/gametitles/laser-defense-###4###.png',
  init: function () {
    C = {
      a: col(0.3, 0.6, 0.95),
      b: col(0.5, 0.5, 0.95),
      dim: col(0.5, 0.3, 0.5),
      text: col(0.5, 0.1, 0.95),
    };
    log = [];
    counts = {};
    refs.fill = guiFillButton({
      label: 'FILL',
      posX: 200,
      posY: 260,
      radius: 110,
      normalColor: C.dim,
      growColor: C.b,
      activeColor: C.a,
      onEnterActive: () => addLog('fill: an'),
      onExitActive: () => addLog('fill: aus'),
    });
    refs.key = guiFillButton({
      label: 'TASTE',
      posX: 480,
      posY: 260,
      radius: 110,
      keyCode: 'Space',
      normalColor: C.dim,
      growColor: C.b,
      activeColor: C.a,
      onEnterActive: () => addLog('taste: an'),
      onExitActive: () => addLog('taste: aus'),
    });
    refs.flip = guiFlipButton({
      label: 'FLIP',
      posX: 1860,
      posY: 260,
      radius: 90,
      normalColor: C.dim,
      activeColor: C.a,
      onEnter: () => addLog('flip: rein'),
      onExit: () => addLog('flip: raus'),
    });
    refs.follow = guiFollowCircle({
      label: 'FOLGT',
      posX: 960,
      posY: 540,
      radius: 70,
      edges: 6,
      scanRadiusFactor: 2,
      normalColor: C.b,
      onLaserEnter: () => addLog('follow: Laser'),
    });
    const origFollow = refs.follow.handle;
    refs.follow.handle = (grid, elapsed) => {
      origFollow(grid, elapsed);
      // im Bild halten
      refs.follow.setX(Math.max(80, Math.min(1840, refs.follow.getX())));
      refs.follow.setY(Math.max(80, Math.min(1000, refs.follow.getY())));
    };
    refs.sw = guiSwitch({
      label: 'AN',
      label2: 'AUS',
      posX: 760,
      posY: 260,
      radius: 100,
      normalColor: C.dim,
      growColor: C.b,
      activeColor: C.a,
      onChange: (v) => addLog('switch: ' + v),
    });
    refs.sw.setStep(0.2); // im Original ein ReferenceError
    refs.sw.reset();
    refs.slider = guiRangeSlider({ label: 'REGLER', posX: 1000, posY: 200, width: 600, height: 100, step: 0.3, normalColor: C.dim, growColor: C.a });
    const origSlider = refs.slider.handle;
    refs.slider.handle = (grid, elapsed) => origSlider(grid, elapsed); // Handle-Wrapping: im Original Absturz (this)
    refs.p1 = pixelCount1D({ label1: '1', label2: '100', posX: 330, posY: 820, radius: 280, radiusY: 120, normalColor: C.dim });
    refs.p2 = pixelCount2D({ label1: 'Y', label2: '', label3: '0', label4: 'X', posX: 960, posY: 820, radius: 150, normalColor: C.dim });
    refs.p4 = pixelCount4D({ label1: 'L', label2: 'R', label3: 'O', label4: 'U', posX: 1380, posY: 820, radius: 150, normalColor: C.dim });
    refs.pb = pixelCountButton({ label: 'ANTEIL', posX: 1760, posY: 820, radius: 90, normalColor: C.dim });
    components = [refs.fill, refs.key, refs.flip, refs.sw, refs.slider, refs.p1, refs.p2, refs.p4, refs.pb, refs.follow];
  },
  handle: function (grid, elapsed) {
    const dt = Math.min(elapsed || 0.016, 0.1);
    const ctx = MasterCanvas.get2dContext();
    components.forEach((c) => c.handle(grid, dt));
    const lines = [
      'Regler ' + refs.slider.getValue().toFixed(2),
      '1D x ' + Math.round(refs.p1.getMeanX()) + ' / ' + refs.p1.getFillPercent() + '%',
      '2D ' + Math.round(refs.p2.getMeanX()) + ',' + Math.round(refs.p2.getMeanY()),
      'Btn ' + refs.pb.getFillPercent() + '%',
      'Label1D ' + refs.p1.getLabel(),
    ];
    util.renderText({ ctx, text: lines.join('   ·   '), x: 960, y: 50, fontSize: '32px', fillStyle: C.text });
    util.renderText({ ctx, text: log.join('   |   '), x: 960, y: 100, fontSize: '26px', fillStyle: C.a });
  },
  stop: function () {
    components = [];
  },
};
