/**
 * Laser-Umfrage – einfache Live-Abstimmung fürs ganze Publikum
 *
 * Aufbau:
 * - Oben ein zusammenhängender Bereich mit 4 Antwort-Buttons UNTEREINANDER: JA, NEIN, VIELLEICHT,
 *   KEIN KOMMENTAR (gui/zoneSplit, 1 Spalte × 4 Zeilen). Die ganze Zeile ist Stimmfläche; links steht die
 *   Antwort, rechts füllt sich ein Balken mit dem Anteil der Antwort an allen Lasern im oberen Bereich –
 *   die Prozente zusammen ergeben 100 %.
 * - Unten ein Balken (gui/steerStrip) mit einer Skala von 0 bis 100 %. Wer dort hinleuchtet, gibt
 *   eine Einschätzung ab; die Markierung zeigt die Mitte aller Laser im Balken.
 * Beide Bereiche messen ständig, es gibt keine Runden und kein Ende.
 * Die Fragen werden mündlich gestellt – auf dem Bildschirm stehen nur die Antworten.
 *
 * Tastatur: 1–4 = Antwort halten, Pfeil links/rechts = Balken bewegen.
 */
import util, { getRgbSpreadHex } from '../util.js';

var laserConfig = require('../LaserApiConfig.js').default;
var MasterCanvas = require('../MasterCanvas').default;
var guiZoneSplit = require('./gui/zoneSplit').default;
var guiSteerStrip = require('./gui/steerStrip').default;

// --- Einstellungen ---
const SETTINGS = {
  smoothing: 3, // wie schnell die Prozente nachziehen (1/s)
  stripSmoothing: 4,
};

const ANSWERS = ['JA', 'NEIN', 'VIELLEICHT', 'KEIN KOMMENTAR'];
const ANSWER_HUES = [0.35, 0.45, 0.55, 0.65];

const W = 1920;
const H = 1080;
const TOP = { x: 960, y: 395, width: 1840, height: 730 };
const STRIP = { x: 960, y: 910, width: 1700, height: 180 };
const LABEL_WIDTH = 540; // Breite des Antwort-Textes links in jeder Zeile
const PERCENT_WIDTH = 210; // Platz für die Prozentzahl rechts

// --- Zustand ---
var zones = null;
var strip = null;
var time = 0;
var lastTime = 0;
var C = {};

function getDelta() {
  const now = performance.now();
  if (lastTime === 0) {
    lastTime = now;
    return 0;
  }
  const elapsed = (now - lastTime) / 1000;
  lastTime = now;
  return Math.min(elapsed, 0.1);
}

function col(hue, sat, val) {
  return getRgbSpreadHex(laserConfig.testColor, hue, sat, val);
}

function roundRectPath(ctx, x, y, w, h, r) {
  const rr = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + rr, y);
  ctx.arcTo(x + w, y, x + w, y + h, rr);
  ctx.arcTo(x + w, y + h, x, y + h, rr);
  ctx.arcTo(x, y + h, x, y, rr);
  ctx.arcTo(x, y, x + w, y, rr);
  ctx.closePath();
}

function buildPalette() {
  C = {
    bgTop: col(0.6, 0.6, 0.12),
    bgBottom: col(0.65, 0.7, 0.04),
    text: col(0.5, 0.1, 0.95),
    title: col(0.45, 0.6, 1),
    dim: col(0.55, 0.3, 0.45),
    answers: ANSWER_HUES.map((h) => ({
      main: col(h, 0.75, 0.95),
      dark: col(h, 0.6, 0.3),
      light: col(h, 0.3, 1),
    })),
    stripLow: col(0.6, 0.6, 0.55),
    stripHigh: col(0.35, 0.7, 0.9),
    marker: col(0.15, 0.5, 1),
  };
}

// --- Zeichnen ---
function drawBackground(ctx) {
  const grad = ctx.createLinearGradient(0, 0, 0, H);
  grad.addColorStop(0, C.bgTop);
  grad.addColorStop(1, C.bgBottom);
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, W, H);
  // langsam wandernde Lichtbänder
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  for (let i = 0; i < 5; i++) {
    const x = ((i * 470 + time * (25 + i * 6)) % (W + 600)) - 300;
    ctx.globalAlpha = 0.04;
    ctx.fillStyle = C.answers[i % 4].main;
    ctx.beginPath();
    ctx.ellipse(x, 300 + i * 150, 320, 120, 0.3, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
}

function drawAnswers(ctx) {
  const shares = zones.getShares();
  const leader = zones.getLeader();
  for (let i = 0; i < 4; i++) {
    const z = zones.getZoneRect(i);
    const c = C.answers[i];
    const x = z.x + 10;
    const y = z.y + 8;
    const w = z.width - 20;
    const h = z.height - 16;
    const share = shares[i] || 0;
    const isLeader = leader === i;

    ctx.save();
    // Zeile (= Button)
    ctx.fillStyle = c.dark;
    ctx.globalAlpha = 0.55;
    roundRectPath(ctx, x, y, w, h, 24);
    ctx.fill();
    ctx.globalAlpha = 1;
    ctx.strokeStyle = isLeader ? c.light : c.main;
    ctx.lineWidth = isLeader ? 7 : 3;
    if (isLeader) {
      ctx.shadowColor = c.main;
      ctx.shadowBlur = 20 + 10 * Math.sin(time * 4);
    }
    roundRectPath(ctx, x, y, w, h, 24);
    ctx.stroke();
    ctx.restore();

    // Füllbalken rechts
    const bx = x + LABEL_WIDTH;
    const bw = w - LABEL_WIDTH - PERCENT_WIDTH;
    const bh = h - 44;
    const by = y + (h - bh) / 2;
    ctx.save();
    ctx.fillStyle = 'rgba(0,0,0,0.45)';
    roundRectPath(ctx, bx, by, bw, bh, bh / 2);
    ctx.fill();
    if (share > 0.002) {
      const fw = Math.max(bh, bw * share);
      ctx.fillStyle = c.main;
      ctx.shadowColor = c.main;
      ctx.shadowBlur = isLeader ? 22 : 10;
      roundRectPath(ctx, bx, by, fw, bh, bh / 2);
      ctx.fill();
      // Glanzstreifen, der durch die Füllung läuft
      ctx.save();
      roundRectPath(ctx, bx, by, fw, bh, bh / 2);
      ctx.clip();
      ctx.shadowBlur = 0;
      ctx.globalAlpha = 0.25;
      ctx.fillStyle = c.light;
      const sx = bx + ((time * 220 + i * 160) % (bw + 200)) - 100;
      ctx.beginPath();
      ctx.moveTo(sx, by);
      ctx.lineTo(sx + 50, by);
      ctx.lineTo(sx + 10, by + bh);
      ctx.lineTo(sx - 40, by + bh);
      ctx.closePath();
      ctx.fill();
      ctx.globalAlpha = 0.3;
      ctx.fillRect(bx, by + 6, fw, bh * 0.22);
      ctx.restore();
    }
    ctx.restore();

    util.renderTextDropShadow({
      ctx,
      text: ANSWERS[i],
      x: x + 34,
      y: y + h / 2 + 20,
      align: 'left',
      fontSize: ANSWERS[i].length > 10 ? '50px' : '60px',
      fillStyle: c.light,
      dropDistX: 4,
      dropDistY: 4,
    });
    util.renderTextDropShadow({
      ctx,
      text: Math.round(share * 100) + ' %',
      x: x + w - 30,
      y: y + h / 2 + 26,
      align: 'right',
      fontSize: '72px',
      fillStyle: C.text,
      dropDistX: 5,
      dropDistY: 5,
    });
  }
}

function drawStrip(ctx) {
  const left = STRIP.x - STRIP.width / 2;
  const top = STRIP.y - STRIP.height / 2;
  const barY = STRIP.y - 10;
  const barH = 56;

  ctx.save();
  // Skala
  const grad = ctx.createLinearGradient(left, 0, left + STRIP.width, 0);
  grad.addColorStop(0, C.stripLow);
  grad.addColorStop(1, C.stripHigh);
  ctx.fillStyle = grad;
  ctx.globalAlpha = 0.75;
  roundRectPath(ctx, left, barY - barH / 2, STRIP.width, barH, barH / 2);
  ctx.fill();
  ctx.globalAlpha = 1;
  ctx.strokeStyle = C.dim;
  ctx.lineWidth = 3;
  ctx.setLineDash([18, 14]);
  ctx.strokeRect(left - 20, top, STRIP.width + 40, STRIP.height);
  ctx.setLineDash([]);
  // Teilstriche
  ctx.strokeStyle = C.text;
  ctx.lineWidth = 3;
  for (let i = 0; i <= 10; i++) {
    const x = left + (STRIP.width * i) / 10;
    ctx.beginPath();
    ctx.moveTo(x, barY + barH / 2 + 6);
    ctx.lineTo(x, barY + barH / 2 + (i % 5 === 0 ? 30 : 18));
    ctx.stroke();
  }
  ctx.restore();
  util.renderText({ ctx, text: '0 %', x: left, y: barY + barH / 2 + 64, fontSize: '32px', fillStyle: C.text });
  util.renderText({ ctx, text: '50 %', x: STRIP.x, y: barY + barH / 2 + 64, fontSize: '32px', fillStyle: C.text });
  util.renderText({ ctx, text: '100 %', x: left + STRIP.width, y: barY + barH / 2 + 64, fontSize: '32px', fillStyle: C.text });

  // Markierung = Mitte der Laser im Balken
  const active = strip.hasInput();
  const mx = strip.getPosition();
  const focus = strip.getFocus();
  ctx.save();
  ctx.globalAlpha = active ? 1 : 0.35;
  ctx.fillStyle = C.marker;
  ctx.strokeStyle = C.marker;
  ctx.shadowColor = C.marker;
  ctx.shadowBlur = active ? 25 : 0;
  ctx.lineWidth = 8 + 10 * focus;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(mx, barY - barH / 2 - 18);
  ctx.lineTo(mx, barY + barH / 2 + 4);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(mx, barY - barH / 2 - 14);
  ctx.lineTo(mx - 24, barY - barH / 2 - 52);
  ctx.lineTo(mx + 24, barY - barH / 2 - 52);
  ctx.closePath();
  ctx.fill();
  ctx.restore();

  util.renderTextDropShadow({
    ctx,
    text: active ? 'MITTE: ' + Math.round(strip.getValue() * 100) + ' %' : 'Hier leuchten: 0 % … 100 %',
    x: STRIP.x,
    y: top - 12,
    fontSize: '42px',
    fillStyle: active ? C.marker : C.dim,
    dropDistX: 4,
    dropDistY: 4,
  });
}

export default {
  name: 'Laser-Umfrage',
  description: `
Live-Umfrage für Georg!

Oben: 
Leuchtet auf eure Antwort 

Der Balken jeder Antwort zeigt in Prozent, 
wie viele Laser gerade dafür stimmen.


Unten: 
Leuchtet auf die Skala von 0% bis 100%.
Die Markierung zeigt die Mitte aller Stimmen im Balken.

  `,
  image: 'media/img/gametitles/laser-sorter-###4###.png',
  init: function () {
    buildPalette();
    time = 0;
    lastTime = 0;
    zones = guiZoneSplit({
      posX: TOP.x,
      posY: TOP.y,
      width: TOP.width,
      height: TOP.height,
      columns: 1,
      rows: 4,
      smoothing: SETTINGS.smoothing,
      keyCodes: ['Digit1', 'Digit2', 'Digit3', 'Digit4'],
      visible: false, // eigenes Zeichnen als Buttons mit Füllbalken
    });
    strip = guiSteerStrip({
      posX: STRIP.x,
      posY: STRIP.y,
      width: STRIP.width + 40,
      height: STRIP.height,
      smoothing: SETTINGS.stripSmoothing,
      keyCodes: { minus: 'ArrowLeft', plus: 'ArrowRight' },
      keySpeed: 0.6,
      visible: false, // eigenes Zeichnen als Skala
    });
  },
  handle: function (grid, elapsed) {
    const dt = getDelta();
    const ctx = MasterCanvas.get2dContext();
    time += dt;

    // beide Bereiche messen immer
    zones.handle(grid, dt);
    strip.handle(grid, dt);

    drawBackground(ctx);
    drawAnswers(ctx);
    drawStrip(ctx);
  },
  stop: function () {},
};
