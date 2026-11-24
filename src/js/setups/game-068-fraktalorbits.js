/**
 * Fraktal-Orbits – Heiss/Kalt in der komplexen Ebene
 *
 * Erstellt mit Claude Opus 5.5 (claude-opus-5-5), Idee: Christian Kleinhuis.
 *
 * Bildschirm (Nutzervorgabe):
 *   ┌──────────────────────┬──────────────────────┐
 *   │ ZIEL: Julia-Menge    │ ZIEL: Orbit von c    │   oben: Vorgabe (darf hell glowen)
 *   ├────────┬─────────────┴──────────┬───────────┤
 *   │ EURE   │ MANDELBROT-KARTE       │ EUER      │   unten Mitte: dunkler Aktionsbereich,
 *   │ Julia  │ hier sucht der Saal c  │ Orbit     │   links/rechts: live für den Cursor-Punkt
 *   ├────────┴────────────────────────┴───────────┤
 *   │ HUD                                         │
 *   └─────────────────────────────────────────────┘
 *   Ziel: Die beiden unteren Panels sollen so aussehen wie die oberen – dann seid ihr am richtigen c.
 *
 * Worum geht's:
 *   Gezeigt wird der Orbit z → z² + c eines unbekannten Punktes c (verbundene Linien, Punkte an den
 *   konkreten Werten) und die Julia-Menge zu diesem c. Der Saal sucht gemeinsam diesen Punkt c in der
 *   Mandelbrot-Karte: Eingabe ist der SCHWERPUNKT aller Laser in der Karte (gui/blobTracker).
 *   Für diesen Cursor-Punkt laufen unten links Julia-Menge und unten rechts Orbit live mit (Nutzerwunsch) –
 *   so sieht man, wo man gerade sucht und ob die Form passt.
 *   Hinweis: Je näher der Schwerpunkt am Ziel, desto schneller schlägt der HERZSCHLAG (Ring, Panel-Rahmen,
 *   leiser Tick). Den Schwerpunkt im Fangkreis halten füllt die Fang-Energie → Orbit gefangen.
 *   Wildes Herumleuchten: Sind die Laser zu weit verstreut, füllt sich nichts („bündelt euch!“).
 *
 * Ziele über die KARDIOID-METHODE: c(θ, ρ) = ρ·e^{iθ}/2 − ρ²·e^{2iθ}/4. Mit ρ = 1 liegt c auf dem Rand der
 *   Hauptkardioide, bei θ = 2π·p/q hängt dort die Knospe der Periode q. Mit ρ leicht > 1 landet man in
 *   der Knospe (geschlossener Orbit) oder knapp ausserhalb der Menge (offener Orbit, fliegt davon).
 *   Die Periode wird numerisch bestimmt (Transient iterieren, Zyklus suchen) – Rejection-Sampling, bis die
 *   gewünschte Periode passt. Level 1: zufälliger 3er-Orbit.
 *   Der Ziel-Orbit wird ab z₂ gezeigt – z₁ = c würde die Lösung direkt verraten.
 *
 * Level: pro Level DIFFICULTY.targetsPerLevel Orbits. Neue Elemente: Perioden 4–5, offene Orbits,
 *   gezoomte Karte (genauer zielen), höhere Perioden, … Zeit pro Orbit sinkt, Fangkreis schrumpft.
 *   Zeit abgelaufen = Leben weg, die Lösung wird kurz gezeigt. 0 Leben = Game Over.
 *
 * Multiplayer / One-Pixel-Plattform: jeder Laser bzw. Netz-Pixel ist eine Stimme im Schwerpunkt.
 *
 * Tastatur (Test ohne Laser): Leertaste = Start/Neustart, Pfeiltasten = Test-Cursor statt Laser,
 *   1 = Orbit sofort fangen, 2 = Level überspringen, B (halten) = drei kreisende Test-Laser.
 *
 * Ähnlichkeiten / Herkunft:
 *   - game-066 Fractal-Iteration: Orbit pro Laser als Hinweis – hier ist der Orbit selbst das Rätsel.
 *   - game-067 Fraktal-Simon: Technik (progressive Buffer, Bloom, WebAudio).
 *   - Schwerpunkt-Steuerung wie bei aimTurret-/steerStrip-Spielen.
 *   - Klassiker: Fractints Orbit-Plot (DOS, 1988), Heiss/Kalt-Suche wie „Hunt the Wumpus“ (1973)
 *     und das Koordinaten-Raten von Battleship (Milton Bradley, 1967).
 *
 * Engine-Rücksichten (CLAUDE.md): dt geclampt, Zustand vorbelegt (handle() ohne init()), keine
 * Debug-Tasten belegt, kein Spread-Operator, kein grid-Zugriff, Fraktale progressiv mit Zeitbudget.
 */
/**
 * laser-chris:
 * 
 * mega gut geworden, habs schon mit scrolling versehen, mega!
 * aber natuerlich noch viel potencial, insbesondere mit live gpu rendering fractals aber ist erstmal okay
 * 
 * und noch opus55 input log 
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
 *  */
import { getRgbSpread, getRgbSpreadHex } from '../util.js';
var util = require('../util.js').default;
var laserConfig = require('../LaserApiConfig.js').default;
var MasterCanvas = require('../MasterCanvas').default;
var guiFillButton = require('./gui/fillButton-ai2').default;
var guiBlobTracker = require('./gui/blobTracker').default;
var createHighscore = require('../util/highscore').default;
import soundCatch from '../../../public/media/opengameart/Item Pickup.ogg';
import soundLevelUp from '../../../public/media/opengameart/Level Up.ogg';
import soundError from '../../../public/media/opengameart/Menu Error.ogg';
import soundGameOver from '../../../public/media/opengameart/Music Box Game Over III.wav'; 

// ---------------------------------------------------------------------------------------------
// Einstellungen
// ---------------------------------------------------------------------------------------------

const DIFFICULTY = {
  lives: 3,
  targetsPerLevel: 3, //  
  holdTime: 2.5, // Sekunden im Fangkreis bis gefangen
  energyDecay: 0.5,
  maxSpreadFactor: 3.5, // Laser-Streuung > catchRadius * Faktor = „zu verstreut“, nichts füllt sich
  smoothing: 1, // Glättung des Schwerpunkts (1/s)
  beatSlow: 0.7, // Herzschlag fern (Hz)
  beatFast: 6, // Herzschlag nah (Hz)
  beatRange: 650, // ab dieser Entfernung (px) ganz langsam, tbd sollte aber an scrollScale gebunden werden, aber mit scaling soll ja schon spannend sein
  computeBudgetMs: 7,
  levelUpTime: 2.6,
  caughtTime: 1.6,
  missedTime: 2.4,
  // Level-Kurve: was kommt pro Level dazu
  levels: [
    { kind: 'closed', periods: [2,3], zoom: 1, catchRadius: 40, time: 150, info: 'Gesucht: ein 3er-Orbit. Drei Punkte, ein Kreislauf.' },
    { kind: 'closed', periods: [4, 5], zoom: 1, catchRadius: 40, time: 150, info: 'Jetzt Periode 4 und 5 – die Knospen werden kleiner.' },
    { kind: 'open', zoom: 1, catchRadius: 30, time: 150, info: 'NEU: offene Orbits! Sie fliegen davon – c liegt knapp AUSSERHALB.' },
    { kind: 'closed', periods: [3, 4, 5, 6], zoom: 2.5, catchRadius: 30, time: 150, info: 'NEU: Zoom-Karte. Genauer zielen!' },
    { kind: 'open', zoom: 3.5, catchRadius: 25, time: 150, info: 'Offene Orbits im Zoom. Der Rand ist dünn.' },
    { kind: 'closed', periods: [5, 6, 7], zoom: 5, catchRadius: 25, time: 350, info: 'Periode 7. Selbst Fractint würde schwitzen.' },
    { kind: 'closed', periods: [6, 7, 8], zoom: 6, catchRadius: 25, time: 450, info: 'Periode 8. Aber viel zeit :)' },
    { kind: 'closed', periods: [7, 8, 9], zoom: 7, catchRadius: 25, time: 550, info: 'Periode 9. Eh ja, viel spass!' },
  ],
  endlessZoomFactor: 1.6,
  endlessZoomMax: 60,
  endlessCatchRadius: 55,
  endlessTime: 35, 
   scrollScale:3 // todo: wie gross ist unsichtbarer bereich welcher erscrollt werden muss, 2 soll bedeuten gerendertes fraktal wird x2 dargestellt, am rand scrollt hintergrund und cursor wird mitbewegt

};

const settings = {
  W: 1920,
  H: 1080,
  TOP_H: 330, // Höhe der oberen Panels
  MAP_X: 480,
  MAP_Y: 340,
  MAP_W: 960,
  MAP_H: 676,
  HUD_Y: 1020,
  MAP_BW: 400, // Buffer der Karte
  MAP_BH: 282,
  LIVE_BW: 115, // Buffer der Live-Julia unten links
  LIVE_BH: 168,
  liveOrbitScale: 100,
  JUL_BW: 316, // Buffer der Julia-Menge
  JUL_BH: 110,
  baseMapH: 2.7, // Kartenhöhe in der komplexen Ebene bei Zoom 1
  orbitScale: 120, // Pixel pro Einheit im Orbit-Panel
  maxParticles: 200,
};

const scrollOffset={x:0,y:0} // scroll offset ist halt die verschiedung x/y, sie geht von plusminus  (W*SCALE-W)/2, wenn dieser wert sich aendert sollte cursor zurueckflutschen

const JUL = { x: 10, y: 10, w: 945, h: 320 };
const ORB = { x: 965, y: 10, w: 945, h: 320 };
const LJUL = { x: 10, y: 345, w: 460, h: 668 };
const LORB = { x: 1450, y: 345, w: 460, h: 668 };

const QUIPS_CATCH = ['ORBIT GEFANGEN!', 'Punktlandung in ℂ!', 'Julia ist begeistert!', 'Wie am Amiga – nur ohne Guru Meditation!', 'z² + c = Volltreffer!'];
const QUIPS_MISS = ['Der Orbit ist entkommen.', 'Divergiert – leider in die falsche Richtung.', 'Knapp daneben ist auch im Komplexen daneben.'];

const stats = {
  score: 0,
  lives: DIFFICULTY.lives,
  level: 1,
  caught: 0,
  caughtInLevel: 0,
  playTime: 0,
};

// ---------------------------------------------------------------------------------------------
// Zustand (vorbelegt, damit handle() auch ohne init() läuft)
// ---------------------------------------------------------------------------------------------

var gameState = 'start'; // start | levelup | prepare | play | caught | missed | gameover
var stateTime = 0;
var time = 0;
var shake = 0;
var quipText = '';
var newHighscore = false;

// Ziel: { re, im, kind, period, escape, orbit: [{re,im}], cycleStart }
var target = { re: -0.1226, im: 0.7449, kind: 'closed', period: 3, escape: 0, orbit: [], cycleStart: 0 };
var demoTarget = { re: -0.1226, im: 0.7449 }; // Douady-Kaninchen, Periode 3
var timeLeft = 50;
var timeMax = 50;
var energy = 0;
var flash = 0;

var cursor = { x: 960, y: 680, has: false, spread: 0, count: 0 };
var testCursor = { x: 960, y: 680, active: false };
var beatPhase = 0;
var beatPulse = 0;
var particles = [];
var floaters = [];

var mapView = { cx: -0.55, cy: 0, h: settings.baseMapH  /** h ist hier die gesamthoehe */};
var canvases = null;
var mapJob = null;
var julJob = null;
var liveJob = null;
var liveJobC = null;
var colors = {};
var colorKey = null;

var prevKeys = {};
function keyPressed(code) {
  const down = keyDown(code);
  const was = !!prevKeys[code];
  prevKeys[code] = down;
  return down && !was;
}
function keyDown(code) {
  return !!(laserConfig.pressedKeys && laserConfig.pressedKeys[code]);
}
function pick(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

// ---------------------------------------------------------------------------------------------
// Sound
// ---------------------------------------------------------------------------------------------

function playSound(snd, volume) {
  try {
    const a = new Audio(snd);
    a.volume = volume === undefined ? 0.6 : volume;
    const p = a.play();
    if (p && p.catch) p.catch(() => {});
  } catch (e) {
    // Deko
  }
}

var audioCtx = null;
function tick(freq, vol) {
  try {
    if (!audioCtx) {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return;
      audioCtx = new AC();
    }
    if (audioCtx.state === 'suspended') audioCtx.resume();
    const t = audioCtx.currentTime;
    const o = audioCtx.createOscillator();
    const g = audioCtx.createGain();
    o.type = 'sine';
    o.frequency.value = freq;
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(vol, t + 0.01);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.09);
    o.connect(g);
    g.connect(audioCtx.destination);
    o.start(t);
    o.stop(t + 0.12);
  } catch (e) {
    // kein Audio
  }
}

// ---------------------------------------------------------------------------------------------
// Farben (Komplementärbereich 0.25..0.75)
// ---------------------------------------------------------------------------------------------

function refreshColors() {
  const tc = laserConfig.testColor;
  const key = tc[0] + ',' + tc[1] + ',' + tc[2];
  if (colorKey === key) return;
  colorKey = key;
  colors = {
    hud: getRgbSpreadHex(tc, 0.5, 0.7, 0.95),
    hudDim: getRgbSpreadHex(tc, 0.42, 0.6, 0.55),
    target: getRgbSpreadHex(tc, 0.32, 0.9, 1),
    targetDim: getRgbSpreadHex(tc, 0.32, 0.7, 0.55),
    live: getRgbSpreadHex(tc, 0.62, 0.8, 1),
    liveDim: getRgbSpreadHex(tc, 0.62, 0.6, 0.6),
    warm: getRgbSpreadHex(tc, 0.3, 0.9, 1),
    accent: getRgbSpreadHex(tc, 0.55, 0.9, 1),
    danger: getRgbSpreadHex(tc, 0.27, 1, 0.9),
    frame: getRgbSpreadHex(tc, 0.5, 0.6, 0.6),
    barBg: getRgbSpreadHex(tc, 0.5, 0.5, 0.15),
    button: getRgbSpreadHex(tc, 0.45, 0.8, 0.5),
    buttonGrow: getRgbSpreadHex(tc, 0.5, 0.8, 0.75),
    buttonActive: getRgbSpreadHex(tc, 0.55, 0.8, 1),
  };
}

function rgbToU32(c) {
  return (255 << 24) | ((c[2] & 255) << 16) | ((c[1] & 255) << 8) | (c[0] & 255);
}

// ---------------------------------------------------------------------------------------------
// Mathe: Iteration, Periode, Kardioid-Methode
// ---------------------------------------------------------------------------------------------

function mandelIter(cr, ci, maxI) {
  const xq = cr - 0.25;
  const q = xq * xq + ci * ci;
  if (q * (q + xq) <= 0.25 * ci * ci) return maxI;
  if ((cr + 1) * (cr + 1) + ci * ci <= 0.0625) return maxI;
  let x = 0;
  let y = 0;
  for (let i = 1; i < maxI; i++) {
    const x2 = x * x;
    const y2 = y * y;
    y = 2 * x * y + ci;
    x = x2 - y2 + cr;
    if (x * x + y * y > 4) return i;
  }
  return maxI;
}

function juliaIter(zr, zi, cr, ci, maxI) {
  let x = zr;
  let y = zi;
  for (let i = 1; i < maxI; i++) {
    const x2 = x * x;
    const y2 = y * y;
    if (x2 + y2 > 4) return i;
    y = 2 * x * y + ci;
    x = x2 - y2 + cr;
  }
  return maxI;
}

// Periode des Attraktors bestimmen: { escaped, escape, period } (period 0 = keine gefunden)
function analyse(cr, ci) {
  let x = 0;
  let y = 0;
  for (let i = 1; i <= 3000; i++) {
    const x2 = x * x;
    const y2 = y * y;
    y = 2 * x * y + ci;
    x = x2 - y2 + cr;
    if (x * x + y * y > 4) return { escaped: true, escape: i, period: 0 };
  }
  const sx = x;
  const sy = y;
  for (let k = 1; k <= 64; k++) {
    const x2 = x * x;
    const y2 = y * y;
    y = 2 * x * y + ci;
    x = x2 - y2 + cr;
    if (Math.abs(x - sx) < 1e-7 && Math.abs(y - sy) < 1e-7) return { escaped: false, escape: 0, period: k };
  }
  return { escaped: false, escape: 0, period: 0 };
}

function cardioidPoint(theta, rho) {
  return {
    re: (rho * Math.cos(theta)) / 2 - (rho * rho * Math.cos(2 * theta)) / 4,
    im: (rho * Math.sin(theta)) / 2 - (rho * rho * Math.sin(2 * theta)) / 4,
  };
}

function gcd(a, b) {
  return b === 0 ? a : gcd(b, a % b);
}

function levelDef(level) {
  const L = DIFFICULTY.levels;
  if (level <= L.length) 
 {
    return L[level - 1];

}
  const k = level - L.length;
  return {
    kind: k % 2 === 1 ? 'open' : 'closed',
    periods: [3, 4, 5, 6, 7],
    zoom: Math.min(DIFFICULTY.endlessZoomMax, L[L.length - 1].zoom * Math.pow(DIFFICULTY.endlessZoomFactor, k)),
    catchRadius: DIFFICULTY.endlessCatchRadius,
    time: DIFFICULTY.endlessTime,
    info: 'Endlos-Orbit. Jetzt zählt nur noch Ehre (und der Highscore).',
  };
}

function findTarget(def) {
  for (let attempt = 0; attempt < 6000; attempt++) {
    let theta;
    let rho;
    if (def.kind === 'closed') {
      const q = pick(def.periods);
      let p = 1 + Math.floor(Math.random() * (q - 1));
      if (gcd(p, q) !== 1) continue;
      if (Math.random() < 0.5) p = q - p; // obere oder untere Hälfte
      theta = (2 * Math.PI * p) / q + (Math.random() - 0.5) * 0.03;
      const bulb = Math.sin((Math.PI * p) / q) / (q * q);
      rho = 1 + Math.random() * bulb * 5;
      const c = cardioidPoint(theta, rho);
      const a = analyse(c.re, c.im);
      if (!a.escaped && a.period === q) return { re: c.re, im: c.im, kind: 'closed', period: q, escape: 0 };
    } else {
      theta = Math.random() * Math.PI * 2;
      rho = 1 + Math.random() * 0.25;
      const c = cardioidPoint(theta, rho);
      const a = analyse(c.re, c.im);
      if (a.escaped && a.escape >= 8 && a.escape <= 40) return { re: c.re, im: c.im, kind: 'open', period: 0, escape: a.escape };
    }
  }
  // Notfall: Douady-Kaninchen
  return { re: -0.1226, im: 0.7449, kind: 'closed', period: 3, escape: 0 };
}

// Orbit-Punkte z0..zn (für offene bis zum Entkommen, für geschlossene Transient + 1 Zyklus)
function computeOrbit(cr, ci, kind, period) {
  const pts = [];
  let x = 0;
  let y = 0;
  pts.push({ re: 0, im: 0 });
  const n = kind === 'open' ? 60 : 24;
  for (let i = 1; i <= n; i++) {
    const x2 = x * x;
    const y2 = y * y;
    y = 2 * x * y + ci;
    x = x2 - y2 + cr;
    pts.push({ re: x, im: y });
    if (x * x + y * y > 30) break;
  }
  let cycleStart = pts.length;
  if (kind === 'closed' && period > 0) {
    // auf den Attraktor einschwingen und den Zyklus anhängen
    for (let i = 0; i < 2000; i++) {
      const x2 = x * x;
      const y2 = y * y;
      y = 2 * x * y + ci;
      x = x2 - y2 + cr;
    }
    cycleStart = pts.length;
    for (let k = 0; k <= period; k++) {
      pts.push({ re: x, im: y });
      const x2 = x * x;
      const y2 = y * y;
      y = 2 * x * y + ci;
      x = x2 - y2 + cr;
    }
  }
  return { pts: pts, cycleStart: cycleStart };
}

// ---------------------------------------------------------------------------------------------
// Progressive Bild-Jobs (Karte, Julia)
// ---------------------------------------------------------------------------------------------

function ensureCanvases() {
  if (canvases) return;
  const mk = (w, h) => {
    const c = document.createElement('canvas');
    c.width = w;
    c.height = h;
    const ctx = c.getContext('2d');
    const image = ctx.createImageData(w, h);
    return { canvas: c, ctx: ctx, image: image, pix: new Uint32Array(image.data.buffer) };
  };
  canvases = {
    map: mk(settings.MAP_BW, settings.MAP_BH),
    mapOld: mk(settings.MAP_BW, settings.MAP_BH),
    jul: mk(settings.JUL_BW, settings.JUL_BH),
    julGlow: mk(settings.JUL_BW / 4, Math.round(settings.JUL_BH / 4)),
    live: mk(settings.LIVE_BW, settings.LIVE_BH),
    liveGlow: mk(Math.round(settings.LIVE_BW / 4), settings.LIVE_BH / 4),
  };
}

function makeLut(maxI, bright) {
  const tc = laserConfig.testColor;
  const lut = new Uint32Array(maxI + 1);
  for (let it = 0; it < maxI; it++) {
    const u = Math.sqrt(it / maxI);
    const hue = 0.25 + 0.5 * (0.5 + 0.5 * Math.sin(Math.log(it + 1) * 2.2));
    const val = bright ? 0.15 + 0.85 * Math.min(1, u * 1.6) : 0.04 + 0.3 * Math.min(1, u * 1.5);
    lut[it] = rgbToU32(getRgbSpread(tc, hue, 0.85, val));
  }
  lut[maxI] = 0xff000000;
  return lut;
}

function startMapJob() {
  ensureCanvases();
  const def = levelDef(stats.level);
  const maxI = Math.round(120 * (1 + Math.log2(Math.max(1, def.zoom )) * 0.6));
  mapJob = { row: 0, done: false, maxI: maxI, lut: makeLut(maxI, false), view: { cx: mapView.cx, cy: mapView.cy, h: mapView.h } };
}

function makeJuliaJob(cr, ci, img, P, maxI) {
  return { row: 0, done: false, maxI: maxI, lut: makeLut(maxI, true), cr: cr, ci: ci, img: img, P: P };
}

function startJuliaJob(cr, ci) {
  ensureCanvases();
  julJob = makeJuliaJob(cr, ci, canvases.jul, JUL, 160);
  canvases.jul.pix.fill(0xff000000);
}

// Live-Julia für den Cursor: nur neu rechnen, wenn sich c merklich bewegt hat
function updateLiveJulia(liveC) {
  if (!liveC) return;
  const eps = mapW() * 0.004;
  if (liveJobC && Math.abs(liveJobC.re - liveC.re) < eps && Math.abs(liveJobC.im - liveC.im) < eps) return;
  if (liveJob && !liveJob.done) return; // erst fertig rechnen (dauert meist nur 1 Frame)
  liveJobC = { re: liveC.re, im: liveC.im };
  liveJob = makeJuliaJob(liveC.re, liveC.im, canvases.live, LJUL, 90);
}

function runJuliaJob(job, t0, budgetMs) {
  if (!job || job.done) return;
  const img = job.img;
  const BW = img.canvas.width;
  const BH = img.canvas.height;
  // Ausschnitt so wählen, dass die Julia-Menge (ca. 3.4 breit, 3.0 hoch) in beide Richtungen passt
  let h = 3.0;
  let w = (h * job.P.w) / job.P.h;
  if (w < 3.4) {
    w = 3.4;
    h = (w * job.P.h) / job.P.w;
  }
  while (job.row < BH) {
    const by = job.row;
    const zi = h / 2 - ((by + 0.5) / BH) * h;
    let idx = by * BW;
    for (let bx = 0; bx < BW; bx++, idx++) {
      const zr = -w / 2 + ((bx + 0.5) / BW) * w;
      img.pix[idx] = job.lut[juliaIter(zr, zi, job.cr, job.ci, job.maxI)];
    }
    job.row++;
    if (performance.now() - t0 > budgetMs) break;
  }
  img.ctx.putImageData(img.image, 0, 0);
  if (job.row >= BH) job.done = true;
}

function runJobs(budgetMs) {
  const t0 = performance.now();
  if (mapJob && !mapJob.done) {
    const BW = settings.MAP_BW;
    const BH = settings.MAP_BH;
    const v = mapJob.view;
    const w = (v.h * settings.MAP_W) / settings.MAP_H;
    const pix = canvases.map.pix;
    while (mapJob.row < BH) {
      const by = mapJob.row;
      const ci = v.cy + v.h / 2 - ((by + 0.5) / BH) * v.h;
      let idx = by * BW;
      for (let bx = 0; bx < BW; bx++, idx++) {
        const cr = v.cx - w / 2 + ((bx + 0.5) / BW) * w;
        pix[idx] = mapJob.lut[mandelIter(cr, ci, mapJob.maxI)];
      }
      mapJob.row++;
      if (performance.now() - t0 > budgetMs) return;
    }
    mapJob.done = true;
    canvases.map.ctx.putImageData(canvases.map.image, 0, 0);
  }
  runJuliaJob(julJob, t0, budgetMs);
  runJuliaJob(liveJob, t0, budgetMs + 3);
}

// Karte: Bildschirm ↔ komplexe Ebene
function mapW() {
  return (mapView.h * settings.MAP_W) / settings.MAP_H;
}

/** original screen mappers without scroll 
function screenToC(x, y) {
  return { re: mapView.cx - mapW() / 2 + ((x - settings.MAP_X) / settings.MAP_W) * mapW(), im: mapView.cy + mapView.h / 2 - ((y - settings.MAP_Y) / settings.MAP_H) * mapView.h };
}
function cToScreen(re, im) {
  return { x: settings.MAP_X + ((re - (mapView.cx - mapW() / 2)) / mapW()) * settings.MAP_W, y: settings.MAP_Y + ((mapView.cy + mapView.h / 2 - im) / mapView.h) * settings.MAP_H };
}

*/

/** gemini created the scroll mapper methods, hehe but i did the scroll update, jay */
function getMapDrawBox() {
  const scale = DIFFICULTY.scrollScale;
  const drawW = settings.MAP_W * scale;
  const drawH = settings.MAP_H * scale;
  const offsetX = -(settings.MAP_W * (scale - 1)) / 2;
  const offsetY = -(settings.MAP_H * (scale - 1)) / 2;
  const drawX = settings.MAP_X + offsetX + scrollOffset.x;
  const drawY = settings.MAP_Y + offsetY + scrollOffset.y;
  return { drawX, drawY, drawW, drawH };
}

function screenToC(x, y) {
  const { drawX, drawY, drawW, drawH } = getMapDrawBox();
  const cw = mapW();
  const ch = mapView.h;

  const u = (x - drawX) / drawW;
  const v = (y - drawY) / drawH;

  return {
    re: mapView.cx - cw / 2 + u * cw,
    im: mapView.cy + ch / 2 - v * ch
  };
}

function cToScreen(re, im) {
  const { drawX, drawY, drawW, drawH } = getMapDrawBox();
  const cw = mapW();
  const ch = mapView.h;

  const u = (re - (mapView.cx - cw / 2)) / cw;
  const v = (mapView.cy + ch / 2 - im) / ch;

  return {
    x: drawX + u * drawW,
    y: drawY + v * drawH
  };
}

// ---------------------------------------------------------------------------------------------
// Ablauf
// ---------------------------------------------------------------------------------------------

function setState(s) {
  gameState = s;
  stateTime = 0;
}

function newTarget() {
  const def = levelDef(stats.level);
  const t = findTarget(def);
  const orb = computeOrbit(t.re, t.im, t.kind, t.period);
  target = { re: t.re, im: t.im, kind: t.kind, period: t.period, escape: t.escape, orbit: orb.pts, cycleStart: orb.cycleStart };
  timeMax = def.time;
  timeLeft = def.time;
  energy = 0;
  // Karte: Zoom 1 = ganzes Apfelmännchen, sonst um das Ziel mit Zufallsversatz
  const old = { cx: mapView.cx, cy: mapView.cy, h: mapView.h };
  if (def.zoom <= 1) {
    mapView.cx = -0.55;
    mapView.cy = 0;
    mapView.h = settings.baseMapH;
  } else {
    mapView.h = settings.baseMapH / def.zoom;
    const w = (mapView.h * settings.MAP_W) / settings.MAP_H;
    mapView.cx = t.re + (Math.random() - 0.5) * w * 0.6;
    mapView.cy = t.im + (Math.random() - 0.5) * mapView.h * 0.55;
  }
  if (!mapJob || old.cx !== mapView.cx || old.cy !== mapView.cy || old.h !== mapView.h) {
    if (canvases) canvases.mapOld.ctx.drawImage(canvases.map.canvas, 0, 0);
    startMapJob();
  }
  startJuliaJob(t.re, t.im);
  setState('prepare');
}

function startGame() {
  stats.score = 0;
  stats.lives = DIFFICULTY.lives;
  stats.level = 1;
  stats.caught = 0;
  stats.caughtInLevel = 0;
  stats.playTime = 0;
  particles = [];
  floaters = [];
  newHighscore = false;
  quipText = levelDef(1).info;
  setState('levelup');
}

function catchTarget() {
  const def = levelDef(stats.level);
  const pts = 100 * stats.level + Math.round(timeLeft * 5) + (def.kind === 'open' ? 50 : target.period * 10);
  stats.score += pts;
  stats.caught++;
  stats.caughtInLevel++;
  flash = 1;
  quipText = pick(QUIPS_CATCH);
  playSound(soundCatch, 0.8);
  const p = cToScreen(target.re, target.im);
  burst(p.x, p.y, 70);
  floaters.push({ x: p.x, y: p.y - 60, text: '+' + pts, life: 1.6, max: 1.6, size: 90 });
  setState('caught');
}

function missTarget() {
  stats.lives--;
  shake = 0.6;
  quipText = pick(QUIPS_MISS);
  playSound(soundError, 0.8);
  if (stats.lives <= 0) endGame();
  else setState('missed');
}

function nextAfterTarget() {
  if (stats.caughtInLevel >= DIFFICULTY.targetsPerLevel) {
    stats.level++;
    stats.caughtInLevel = 0;
    quipText = levelDef(stats.level).info;
    playSound(soundLevelUp, 0.6);
    setState('levelup');
  } else {
    newTarget();
  }
}

function endGame() {
  highscore.addEntry({ punkte: stats.score, level: stats.level, orbits: stats.caught });
  newHighscore = highscore.lastEntryNewHighscore();
  playSound(soundGameOver, 0.7);
  setState('gameover');
}

// ---------------------------------------------------------------------------------------------
// Eingabe: Schwerpunkt der Laser in der Karte
// ---------------------------------------------------------------------------------------------

function updateCursor(dt) {
  // Test-Cursor per Pfeiltasten
  let mx = 0;
  let my = 0;
  if (keyDown('ArrowLeft')) mx -= 1;
  if (keyDown('ArrowRight')) mx += 1;
  if (keyDown('ArrowUp')) my -= 1;
  if (keyDown('ArrowDown')) my += 1;
  if (mx || my) {
    if (!testCursor.active) {
      testCursor.x = cursor.has ? cursor.x : settings.MAP_X + settings.MAP_W / 2;
      testCursor.y = cursor.has ? cursor.y : settings.MAP_Y + settings.MAP_H / 2;
    }
    testCursor.active = true;
    testCursor.x = Math.max(settings.MAP_X, Math.min(settings.MAP_X + settings.MAP_W, testCursor.x + mx * 420 * dt));
    testCursor.y = Math.max(settings.MAP_Y, Math.min(settings.MAP_Y + settings.MAP_H, testCursor.y + my * 420 * dt));
  }

  const blobs = tracker.getBlobs();
  let sx = 0;
  let sy = 0;
  blobs.forEach((b) => {
    sx += b.x;
    sy += b.y;
  });
  let rawX;
  let rawY;
  let spread = 0;
  if (blobs.length > 0) {
    rawX = sx / blobs.length;
    rawY = sy / blobs.length;
    let v = 0;
    blobs.forEach((b) => {
      v += (b.x - rawX) * (b.x - rawX) + (b.y - rawY) * (b.y - rawY);
    });
    spread = Math.sqrt(v / blobs.length);
    testCursor.active = false;
  } else if (testCursor.active) {
    rawX = testCursor.x;
    rawY = testCursor.y;
  }
  if (rawX === undefined) {
    cursor.has = false;
    cursor.count = 0;
    return;
  }
  if (!cursor.has) {
    cursor.x = rawX;
    cursor.y = rawY;
  }
  const k = Math.min(1, DIFFICULTY.smoothing * dt);
  cursor.x += (rawX - cursor.x) * k;
  cursor.y += (rawY - cursor.y) * k;
  cursor.spread = spread;
  cursor.count = blobs.length;
  cursor.has = true;


  updateScroll();
}

// ---------------------------------------------------------------------------------------------
// Partikel
// ---------------------------------------------------------------------------------------------

function burst(x, y, n) {
  for (let i = 0; i < n && particles.length < settings.maxParticles; i++) {
    const a = Math.random() * Math.PI * 2;
    const sp = 120 + Math.random() * 520;
    particles.push({ x: x, y: y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, life: 1.2, max: 1.2, hue: 0.25 + Math.random() * 0.5, size: 3 + Math.random() * 5 });
  }
}

function updateAndDrawParticles(ctx, dt) {
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  particles.slice().forEach((p) => {
    p.life -= dt;
    if (p.life <= 0) {
      const i = particles.indexOf(p);
      if (i >= 0) particles.splice(i, 1);
      return;
    }
    p.x += p.vx * dt;
    p.y += p.vy * dt;
    p.vx *= 1 - 2 * dt;
    p.vy *= 1 - 2 * dt;
    const u = p.life / p.max;
    ctx.globalAlpha = u;
    ctx.fillStyle = getRgbSpreadHex(laserConfig.testColor, p.hue, 0.8, 1);
    ctx.beginPath();
    ctx.arc(p.x, p.y, p.size * (0.5 + u), 0, Math.PI * 2);
    ctx.fill();
  });
  ctx.restore();
  floaters.slice().forEach((f) => {
    f.life -= dt;
    if (f.life <= 0) {
      const i = floaters.indexOf(f);
      if (i >= 0) floaters.splice(i, 1);
      return;
    }
    const u = f.life / f.max;
    ctx.save();
    ctx.globalAlpha = Math.min(1, u * 2);
    ctx.shadowColor = colors.warm;
    ctx.shadowBlur = 30;
    util.renderTextDropShadow({ ctx, text: f.text, x: f.x, y: f.y - (1 - u) * 100, fontSize: f.size + 'px', lineHeight: f.size, fillStyle: colors.warm, dropDistX: 4, dropDistY: 4 });
    ctx.restore();
  });
}

// ---------------------------------------------------------------------------------------------
// Zeichnen
// ---------------------------------------------------------------------------------------------

function panelFrame(ctx, P, color, glow) {
  ctx.save();
  ctx.strokeStyle = color;
  ctx.shadowColor = color;
  ctx.shadowBlur = glow;
  ctx.lineWidth = 2 + glow / 12;
  ctx.strokeRect(P.x, P.y, P.w, P.h);
  ctx.restore();
}

function drawJuliaPanel(ctx, P, img, glow, job, title, titleColor, frameGlow) {
  ctx.save();
  ctx.fillStyle = '#000000';
  ctx.fillRect(P.x, P.y, P.w, P.h);
  if (job) {
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(img.canvas, P.x, P.y, P.w, P.h);
    glow.ctx.imageSmoothingEnabled = true;
    glow.ctx.drawImage(img.canvas, 0, 0, glow.canvas.width, glow.canvas.height);
    ctx.imageSmoothingEnabled = true;
    ctx.globalCompositeOperation = 'lighter';
    ctx.globalAlpha = Math.min(1, 0.45 + 0.15 * Math.sin(time * 1.5) + flash * 0.5);
    ctx.drawImage(glow.canvas, P.x - 10, P.y - 6, P.w + 20, P.h + 12);
  }
  ctx.restore();
  util.renderText({ ctx, text: title, x: P.x + 16, y: P.y + 34, fontSize: '26px', fillStyle: titleColor, align: 'left', font: 'Verdana' });
  if (job && !job.done) {
    const y = P.y + (job.row / img.canvas.height) * P.h;
    ctx.save();
    ctx.fillStyle = colors.accent;
    ctx.fillRect(P.x, y - 1, P.w, 3);
    ctx.restore();
  }
  panelFrame(ctx, P, colors.frame, frameGlow);
}

function drawTopJulia(ctx) {
  drawJuliaPanel(ctx, JUL, canvases.jul, canvases.julGlow, julJob, 'ZIEL: Julia-Menge J(c)', colors.target, 6 + flash * 40);
}

function drawLiveJulia(ctx) {
  const has = cursor.has && liveJob;
  drawJuliaPanel(ctx, LJUL, canvases.live, canvases.liveGlow, has ? liveJob : null, 'EURE Julia', colors.live, 4 + beatPulse * 25);
  if (!cursor.has) util.renderText({ ctx, text: 'kein Laser\nin der Karte', x: LJUL.x + LJUL.w / 2, y: LJUL.y + LJUL.h / 2, fontSize: '30px', lineHeight: 40, fillStyle: colors.hudDim });
}

var orbitMap = { P: ORB, scale: 120 };
function orbitToPanel(p) {
  return { x: orbitMap.P.x + orbitMap.P.w / 2 + p.re * orbitMap.scale, y: orbitMap.P.y + orbitMap.P.h / 2 + 10 - p.im * orbitMap.scale };
}

function drawOrbitPath(ctx, pts, from, cycleStart, color, dimColor, dotR) {
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  ctx.lineJoin = 'round';
  // Transient (schwach)
  ctx.strokeStyle = dimColor;
  ctx.lineWidth = 2;
  ctx.beginPath();
  let first = true;
  for (let i = from; i < Math.min(cycleStart, pts.length); i++) {
    const q = orbitToPanel(pts[i]);
    if (first) ctx.moveTo(q.x, q.y);
    else ctx.lineTo(q.x, q.y);
    first = false;
  }
  ctx.stroke();
  for (let i = from; i < Math.min(cycleStart, pts.length); i++) {
    const q = orbitToPanel(pts[i]);
    ctx.fillStyle = dimColor;
    ctx.beginPath();
    ctx.arc(q.x, q.y, dotR * 0.6, 0, Math.PI * 2);
    ctx.fill();
  }
  // Zyklus (hell)
  if (cycleStart < pts.length) {
    ctx.strokeStyle = color;
    ctx.shadowColor = color;
    ctx.shadowBlur = 18;
    ctx.lineWidth = 4;
    ctx.beginPath();
    for (let i = cycleStart; i < pts.length; i++) {
      const q = orbitToPanel(pts[i]);
      if (i === cycleStart) ctx.moveTo(q.x, q.y);
      else ctx.lineTo(q.x, q.y);
    }
    ctx.stroke();
    for (let i = cycleStart; i < pts.length; i++) {
      const q = orbitToPanel(pts[i]);
      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.arc(q.x, q.y, dotR, 0, Math.PI * 2);
      ctx.fill();
    }
  }
  ctx.restore();
}

function drawOrbitFrame(ctx, P, scale) {
  orbitMap.P = P;
  orbitMap.scale = scale;
  ctx.fillStyle = '#000000';
  ctx.fillRect(P.x, P.y, P.w, P.h);
  ctx.beginPath();
  ctx.rect(P.x, P.y, P.w, P.h);
  ctx.clip();
  // Achsen + Fluchtkreis |z| = 2
  const o = orbitToPanel({ re: 0, im: 0 });
  ctx.strokeStyle = colors.barBg;
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(P.x, o.y);
  ctx.lineTo(P.x + P.w, o.y);
  ctx.moveTo(o.x, P.y);
  ctx.lineTo(o.x, P.y + P.h);
  ctx.stroke();
  ctx.setLineDash([6, 8]);
  ctx.strokeStyle = colors.frame;
  ctx.globalAlpha = 0.5;
  ctx.beginPath();
  ctx.arc(o.x, o.y, 2 * scale, 0, Math.PI * 2);
  ctx.stroke();
  ctx.setLineDash([]);
  ctx.globalAlpha = 1;
}

// oben rechts: Ziel-Orbit ab z2 (z1 = c wäre die Lösung)
function drawTopOrbit(ctx) {
  ctx.save();
  drawOrbitFrame(ctx, ORB, settings.orbitScale);
  if (target.orbit.length) {
    if (target.kind === 'open') drawOrbitPath(ctx, target.orbit, 2, 2, colors.target, colors.targetDim, 6);
    else drawOrbitPath(ctx, target.orbit, 2, target.cycleStart, colors.target, colors.targetDim, 7);
  }
  ctx.restore();
  const kindText = target.kind === 'open' ? 'offen – entkommt nach ' + target.escape + ' Schritten' : 'geschlossen – Periode ' + target.period;
  util.renderText({ ctx, text: 'ZIEL: Orbit z → z² + c   (' + kindText + ')', x: ORB.x + 16, y: ORB.y + 34, fontSize: '26px', fillStyle: colors.target, align: 'left', font: 'Verdana' });
  panelFrame(ctx, ORB, colors.frame, 4 + flash * 40);
}

// unten rechts: Orbit des Cursor-Punkts (live)
function drawLiveOrbit(ctx, liveC) {
  let label = 'EUER Orbit';
  ctx.save();
  drawOrbitFrame(ctx, LORB, settings.liveOrbitScale);
  if (liveC) {
    const a = analyse(liveC.re, liveC.im);
    const lo = computeOrbit(liveC.re, liveC.im, a.escaped ? 'open' : 'closed', a.period);
    drawOrbitPath(ctx, lo.pts, 2, a.escaped ? 2 : lo.cycleStart, colors.live, colors.liveDim, 6);
    label = a.escaped ? 'EUER Orbit: offen (' + a.escape + ')' : a.period > 0 ? 'EUER Orbit: Periode ' + a.period : 'EUER Orbit: chaotisch';
  }
  ctx.restore();
  util.renderText({ ctx, text: label, x: LORB.x + 16, y: LORB.y + 34, fontSize: '26px', fillStyle: colors.live, align: 'left', font: 'Verdana' });
  if (!liveC) util.renderText({ ctx, text: 'kein Laser\nin der Karte', x: LORB.x + LORB.w / 2, y: LORB.y + LORB.h / 2, fontSize: '30px', lineHeight: 40, fillStyle: colors.hudDim });
  panelFrame(ctx, LORB, colors.frame, 4 + beatPulse * 30);
}

function drawPanels(ctx, liveC) {
  drawTopJulia(ctx);
  drawTopOrbit(ctx);
  drawLiveJulia(ctx);
  drawLiveOrbit(ctx, liveC);
}


function updateScroll(){
  // scrollspeed should be tighed to the dt of frame :/
  const scrollSpeed=4; 
  const followSpeed=0.75;
// hier verschieben wir halt cursor wenn sich das untergrund bild verschiebt
// das untergrund bild verschiebt sich wenn am rand und noch scroll space moeglich
if(cursor.y>settings.TOP_H+settings.MAP_H-75 && scrollOffset.y> -settings.MAP_H*DIFFICULTY.scrollScale-settings.MAP_H ){
  scrollOffset.y-=scrollSpeed;
  cursor.y-=scrollSpeed*followSpeed;

}

if(cursor.x>(settings.W-settings.MAP_W+settings.MAP_W/2)-75 && scrollOffset.x> -settings.MAP_W*DIFFICULTY.scrollScale-settings.MAP_W ){

  scrollOffset.x-=scrollSpeed;
  cursor.x-=scrollSpeed*followSpeed;

}
if(cursor.y<settings.TOP_H+75 && scrollOffset.y<settings.MAP_H*DIFFICULTY.scrollScale-settings.MAP_H ){

  scrollOffset.y+=scrollSpeed;
  cursor.y+=scrollSpeed*followSpeed;

}

if(cursor.x<(settings.W-settings.MAP_W)/2+75 && scrollOffset.x<settings.MAP_W*DIFFICULTY.scrollScale-settings.MAP_W ){

  scrollOffset.x+=scrollSpeed;
  cursor.x+=scrollSpeed*followSpeed;

}

}


function drawMap(ctx, alpha) {
  ctx.save();
  if (shake > 0) ctx.translate((Math.random() - 0.5) * 24 * shake, (Math.random() - 0.5) * 24 * shake);
  ctx.globalAlpha = alpha;
  ctx.imageSmoothingEnabled = false;

  const drawW = settings.MAP_W * DIFFICULTY.scrollScale;
  const drawH = settings.MAP_H * DIFFICULTY.scrollScale;
const offsetX = -(settings.MAP_W * (DIFFICULTY.scrollScale - 1)) / 2;
const offsetY = -(settings.MAP_H * (DIFFICULTY.scrollScale - 1)) / 2;
const drawX = settings.MAP_X + offsetX+scrollOffset.x;
const drawY = settings.MAP_Y + offsetY+scrollOffset.y;
 
  if (mapJob && !mapJob.done) {
    // während der Berechnung: altes Bild + Fortschritt der neuen Zeilen
    ctx.drawImage(canvases.mapOld.canvas, drawX,drawY, drawW, drawH);
    canvases.map.ctx.putImageData(canvases.map.image, 0, 0, 0, 0, settings.MAP_BW, mapJob.row);
    const hRows = mapJob.row;
    if (hRows > 0) {
      ctx.drawImage(
        canvases.map.canvas,
        0,
        0,
        settings.MAP_BW,
        hRows,
         drawX,drawY,
        drawW,
        (hRows / settings.MAP_BH) * drawH
      );
    }
    const y = drawY + (hRows / settings.MAP_BH) * drawH;
    ctx.fillStyle = colors.accent;
    ctx.fillRect(drawX, y - 2, drawW, 4);
  } else {
    ctx.drawImage(canvases.map.canvas, drawX, drawY, drawW, drawH);
  }

  ctx.globalAlpha = 1;
  ctx.strokeStyle = colors.frame;
  ctx.lineWidth = 2;
  ctx.strokeRect(settings.MAP_X, settings.MAP_Y, drawW, drawH);
  ctx.restore();
}
function drawCursor(ctx, def) {
  if (!cursor.has) return;
  const p = 1 + beatPulse * 0.6;
  const col = colors.live;
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  ctx.strokeStyle = col;
  ctx.shadowColor = col;
  ctx.shadowBlur = 15 + beatPulse * 30;
  ctx.lineWidth = 3;
  // Fadenkreuz
  ctx.beginPath();
  ctx.moveTo(cursor.x - 30, cursor.y);
  ctx.lineTo(cursor.x - 10, cursor.y);
  ctx.moveTo(cursor.x + 10, cursor.y);
  ctx.lineTo(cursor.x + 30, cursor.y);
  ctx.moveTo(cursor.x, cursor.y - 30);
  ctx.lineTo(cursor.x, cursor.y - 10);
  ctx.moveTo(cursor.x, cursor.y + 10);
  ctx.lineTo(cursor.x, cursor.y + 30);
  ctx.stroke();
  // Fangkreis pulsiert im Herzschlag
  ctx.lineWidth = 3 + beatPulse * 5;
  ctx.globalAlpha = 0.6 + 0.4 * beatPulse;
  ctx.beginPath();
  ctx.arc(cursor.x, cursor.y, def.catchRadius * p, 0, Math.PI * 2);
  ctx.stroke();
  // Energie
  if (energy > 0) {
    ctx.strokeStyle = colors.warm;
    ctx.lineWidth = 8;
    ctx.globalAlpha = 1;
    ctx.beginPath();
    ctx.arc(cursor.x, cursor.y, def.catchRadius + 14, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * energy);
    ctx.stroke();
  }
  // Streuung der Laser
  if (cursor.count > 1) {
    ctx.setLineDash([8, 10]);
    ctx.lineWidth = 2;
    ctx.globalAlpha = 0.35;
    ctx.strokeStyle = cursor.spread > def.catchRadius * DIFFICULTY.maxSpreadFactor ? colors.danger : col;
    ctx.beginPath();
    ctx.arc(cursor.x, cursor.y, Math.max(20, cursor.spread), 0, Math.PI * 2);
    ctx.stroke();
    ctx.setLineDash([]);
  }
  ctx.restore();
}

function drawTargetMarker(ctx, color) {
  const p = cToScreen(target.re, target.im);
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  ctx.strokeStyle = color;
  ctx.shadowColor = color;
  ctx.shadowBlur = 30;
  ctx.lineWidth = 4;
  for (let i = 0; i < 3; i++) {
    const r = ((time * 120 + i * 40) % 120) + 10;
    ctx.globalAlpha = 1 - r / 130;
    ctx.beginPath();
    ctx.arc(p.x, p.y, r, 0, Math.PI * 2);
    ctx.stroke();
  }
  ctx.restore();
  util.renderTextDropShadow({ ctx, text: 'c = ' + target.re.toFixed(4) + (target.im >= 0 ? ' + ' : ' − ') + Math.abs(target.im).toFixed(4) + 'i', x: p.x, y: p.y - 60, fontSize: '30px', lineHeight: 30, fillStyle: color, dropDistX: 3, dropDistY: 3 });
}

function bigText(ctx, text, y, size, color, glow) {
  ctx.save();
  ctx.shadowColor = color;
  ctx.shadowBlur = glow === undefined ? 30 : glow;
  util.renderTextDropShadow({ ctx, text, x: settings.W / 2, y: y, fontSize: size + 'px', lineHeight: size * 1.1, fillStyle: color, dropDistX: 6, dropDistY: 6 });
  ctx.restore();
}

function drawMiniBrot(ctx, x, y, r, color) {
  ctx.save();
  ctx.fillStyle = color;
  ctx.beginPath();
  for (let i = 0; i <= 40; i++) {
    const t = (i / 40) * Math.PI * 2;
    const px = Math.cos(t) / 2 - Math.cos(2 * t) / 4 + 0.35;
    const py = Math.sin(t) / 2 - Math.sin(2 * t) / 4;
    if (i === 0) ctx.moveTo(x + px * r * 2, y + py * r * 2);
    else ctx.lineTo(x + px * r * 2, y + py * r * 2);
  }
  ctx.fill();
  ctx.beginPath();
  ctx.arc(x + (-1 + 0.35) * r * 2, y, 0.5 * r, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

function drawHud(ctx) {
  const W = settings.W;
  const top = settings.HUD_Y;
  ctx.save();
  ctx.fillStyle = '#05050a';
  ctx.fillRect(0, top, W, settings.H - top);
  ctx.strokeStyle = colors.frame;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(0, top + 1);
  ctx.lineTo(W, top + 1);
  ctx.stroke();
  ctx.restore();
  util.renderText({ ctx, text: 'LEVEL ' + stats.level + '   ·   Orbit ' + Math.min(stats.caughtInLevel + 1, DIFFICULTY.targetsPerLevel) + '/' + DIFFICULTY.targetsPerLevel, x: 24, y: top + 44, fontSize: '40px', fillStyle: colors.hud, align: 'left' });
  util.renderText({ ctx, text: 'PUNKTE ' + stats.score, x: W - 220, y: top + 44, fontSize: '40px', fillStyle: colors.hud, align: 'right' });
  for (let i = 0; i < DIFFICULTY.lives; i++) drawMiniBrot(ctx, W - 40 - i * 55, top + 30, 14, i < stats.lives ? colors.warm : '#222230');
  if (gameState === 'play') {
    const x0 = 640;
    const bw = 640;
    ctx.save();
    ctx.fillStyle = colors.barBg;
    ctx.fillRect(x0, top + 18, bw, 26);
    const tl = Math.max(0, timeLeft / timeMax);
    ctx.fillStyle = tl < 0.25 && Math.sin(time * 14) > 0 ? colors.danger : colors.accent;
    ctx.fillRect(x0, top + 18, bw * tl, 26);
    ctx.restore();
    util.renderText({ ctx, text: Math.ceil(timeLeft) + ' s', x: x0 + bw / 2, y: top + 40, fontSize: '24px', fillStyle: '#000000' });
  }
}

function drawHighscorePanel(ctx, y) {
  const best = highscore.getHighscore();
  util.renderTextDropShadow({
    ctx,
    text: best
      ? 'Highscore: ' + Math.round(best.punkte) + ' Punkte  ·  Level ' + best.level + '  ·  ' + best.orbits + ' Orbits'
      : 'Noch kein Highscore – wie am C64: leere Tabelle, volle Hoffnung.',
    x: settings.W / 2,
    y: y,
    fontSize: '30px',
    lineHeight: 32,
    fillStyle: colors.hudDim,
    dropDistX: 3,
    dropDistY: 3,
  });
}

function drawDarkSpot(ctx, x, y, r) {
  ctx.save();
  const g = ctx.createRadialGradient(x, y, r * 0.6, x, y, r);
  g.addColorStop(0, 'rgba(0,0,0,0.95)');
  g.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

// ---------------------------------------------------------------------------------------------
// GUI
// ---------------------------------------------------------------------------------------------

var highscore = createHighscore('Fraktal-Orbits', 'punkte');
const BUTTON_X = settings.MAP_X + settings.MAP_W * 0.86;

var tracker = guiBlobTracker({
  posX: settings.MAP_X + settings.MAP_W / 2,
  posY: settings.MAP_Y + settings.MAP_H / 2,
  width: settings.MAP_W,
  height: settings.MAP_H,
  minCells: 1,
  maxBlobs: 64,
  keepTime: 0.2,
  testKey: 'KeyB',
});

const RESTART_Y = 830;
function makeButton(label, onEnter, x, y) {
  // Start: rechts in der Karte (dunkler Raum ausserhalb der Menge).
  // Neustart: Kartenmitte unten – rechts steht beim Game Over die Lowscore-Anzeige von util/highscore.js.
  return guiFillButton({
    label: label,
    posX: x,
    posY: y,
    radius: 85,
    edges: 8,
    speedUp: 60,
    speedDown: 30,
    normalColor: '#203040',
    growColor: '#305070',
    activeColor: '#4080a0',
    onEnterActive: onEnter,
  });
}

var startButton = makeButton(
  'START',
  () => {
    if (gameState === 'start') startGame();
  },
  BUTTON_X,
  settings.MAP_Y + settings.MAP_H / 2
);
var restartButton = makeButton(
  'NOCHMAL',
  () => {
    if (gameState === 'gameover' && stateTime > 3) toStart();
  },
  settings.MAP_X + settings.MAP_W / 2,
  RESTART_Y
);

function styleButton(btn) {
  btn.setColor(colors.button);
  if (btn.setGrowColor) btn.setGrowColor(colors.buttonGrow);
  if (btn.setActiveColor) btn.setActiveColor(colors.buttonActive);
}

function toStart() {
  mapView.cx = -0.55;
  mapView.cy = 0;
  mapView.h = settings.baseMapH;
  stats.level = 1;
  if (canvases) canvases.mapOld.ctx.drawImage(canvases.map.canvas, 0, 0);
  startMapJob();
  startJuliaJob(demoTarget.re, demoTarget.im);
  const orb = computeOrbit(demoTarget.re, demoTarget.im, 'closed', 3);
  target = { re: demoTarget.re, im: demoTarget.im, kind: 'closed', period: 3, escape: 0, orbit: orb.pts, cycleStart: orb.cycleStart };
  setState('start');
}

// ---------------------------------------------------------------------------------------------
// Hauptschleife
// ---------------------------------------------------------------------------------------------

function handleFrame(grid, elapsed) {
  const dt = Math.min(elapsed || 0, 0.1);
  time += dt;
  stateTime += dt;
  shake = Math.max(0, shake - dt);
  flash = Math.max(0, flash - dt * 1.2);
  beatPulse = Math.max(0, beatPulse - dt * 4);
  const ctx = MasterCanvas.get2dContext();
  ensureCanvases();
  refreshColors();
  if (!mapJob) toStart();
  runJobs(DIFFICULTY.computeBudgetMs);

  tracker.handle(grid, dt);
  updateCursor(dt);
  const kSpace = keyPressed('Space');
  const k1 = keyPressed('Digit1');
  const k2 = keyPressed('Digit2');
  const def = levelDef(stats.level);
  const liveC = cursor.has ? screenToC(cursor.x, cursor.y) : null;
  updateLiveJulia(liveC);

  if (gameState === 'start') {
    drawMap(ctx, 0.9);
    drawPanels(ctx, liveC);
    drawCursor(ctx, def);
    bigText(ctx, 'FRAKTAL-ORBITS', 470, 110, colors.accent, 45);
    bigText(ctx, 'Oben: Ziel-Julia und Ziel-Orbit.  Unten: eure Julia und euer Orbit.', 545, 28, colors.hud, 10);
    bigText(ctx, 'Sucht c in der Karte, bis unten aussieht wie oben!', 590, 28, colors.hudDim, 0);
    drawDarkSpot(ctx, BUTTON_X, settings.MAP_Y + settings.MAP_H / 2, 140);
    styleButton(startButton);
    startButton.handle(grid, dt);
    drawHighscorePanel(ctx, 960);
    if (kSpace) startGame();
  } else if (gameState === 'levelup') {
    drawMap(ctx, 0.5);
    drawPanels(ctx, null);
    bigText(ctx, 'LEVEL ' + stats.level, 600, 150, colors.accent, 45);
    bigText(ctx, quipText, 700, 30, colors.hud, 10);
    if (stateTime >= DIFFICULTY.levelUpTime) newTarget();
  } else if (gameState === 'prepare') {
    drawMap(ctx, 1);
    drawPanels(ctx, null);
    bigText(ctx, target.kind === 'open' ? 'Neuer Orbit: OFFEN' : 'Neuer Orbit: PERIODE ' + target.period, 640, 70, colors.target, 25);
    if (mapJob.done && julJob.done && stateTime > 1.2) setState('play');
  } else if (gameState === 'play') {
    stats.playTime += dt;
    timeLeft -= dt;
    let d = Infinity;
    if (cursor.has) {
      const tp = cToScreen(target.re, target.im);
      d = Math.sqrt((cursor.x - tp.x) * (cursor.x - tp.x) + (cursor.y - tp.y) * (cursor.y - tp.y));
      const closeness = Math.max(0, 1 - d / DIFFICULTY.beatRange);
      const freq = DIFFICULTY.beatSlow + (DIFFICULTY.beatFast - DIFFICULTY.beatSlow) * closeness * closeness;
      beatPhase += freq * dt;
      if (beatPhase >= 1) {
        beatPhase -= Math.floor(beatPhase);
        beatPulse = 1;
        tick(300 + 600 * closeness, 0.05 + 0.08 * closeness);
      }
    }
    const tooSpread = cursor.count > 1 && cursor.spread > def.catchRadius * DIFFICULTY.maxSpreadFactor;
    if (d < def.catchRadius && !tooSpread) energy += dt / DIFFICULTY.holdTime;
    else energy = Math.max(0, energy - DIFFICULTY.energyDecay * dt);

    drawMap(ctx, 1);
    drawPanels(ctx, liveC);
    drawCursor(ctx, def);
    if (!cursor.has && stateTime > 3) bigText(ctx, 'Laser in die Mandelbrot-Karte!', settings.MAP_Y + 60, 36, colors.hudDim, 0);
    if (tooSpread) bigText(ctx, 'Zu verstreut – bündelt euch!', settings.MAP_Y + 60, 36, colors.danger, 10);
    if (k1) energy = 1;
    if (energy >= 1) catchTarget();
    else if (timeLeft <= 0) missTarget();
    if (k2 && gameState === 'play') {
      stats.caughtInLevel = DIFFICULTY.targetsPerLevel;
      nextAfterTarget();
    }
  } else if (gameState === 'caught') {
    drawMap(ctx, 1);
    drawPanels(ctx, liveC);
    drawTargetMarker(ctx, colors.warm);
    bigText(ctx, quipText, settings.MAP_Y + 70, 44, colors.accent, 25);
    if (stateTime >= DIFFICULTY.caughtTime) nextAfterTarget();
  } else if (gameState === 'missed') {
    drawMap(ctx, 0.8);
    drawPanels(ctx, null);
    drawTargetMarker(ctx, colors.danger);
    bigText(ctx, quipText + '\nHier wäre er gewesen:', settings.MAP_Y + 70, 36, colors.danger, 15);
    if (stateTime >= DIFFICULTY.missedTime) newTarget();
  } else if (gameState === 'gameover') {
    drawMap(ctx, 0.35);
    drawTopJulia(ctx);
    drawTopOrbit(ctx);
    bigText(ctx, 'GAME OVER', 460, 110, colors.danger, 50);
    bigText(ctx, 'Punkte: ' + stats.score + '  ·  Level ' + stats.level + '\n' + stats.caught + ' Orbits gefangen  ·  ' + Math.round(stats.playTime) + ' s', 540, 32, colors.hud, 10);
    if (newHighscore) bigText(ctx, 'NEUER HIGHSCORE! Am Amiga hätte das 3 Disketten gefüllt.', 650, 26, colors.warm, 25);
    if (stateTime > 3) {
      drawDarkSpot(ctx, settings.MAP_X + settings.MAP_W / 2, RESTART_Y, 140);
      styleButton(restartButton);
      restartButton.handle(grid, dt);
      if (kSpace) toStart();
    }
    highscore.renderHighAndLowScores(ctx); // Darstellung aus util/highscore.js (High links, Low rechts)
  }

  updateAndDrawParticles(ctx, dt);
  drawHud(ctx);
}

export default {
  name: 'Fraktal-Orbits',
  description:
    'Fraktal-Orbits – Heiss/Kalt in der komplexen Ebene!\n\n' +
    'Oben links: die Julia-Menge eines unbekannten Punktes c. Oben rechts: sein Orbit z → z² + c.\n' +
    'Unten: die Mandelbrot-Karte. Findet c – ALLE ZUSAMMEN: der Schwerpunkt aller Laser ist der Cursor,\n' +
    'unten links/rechts laufen eure Julia-Menge und euer Orbit live mit – macht sie gleich wie oben!\n' +
    'Je näher ihr dran seid, desto schneller schlägt das Herz.\n' +
    'Im Fangkreis halten = gefangen. Zu verstreut = nichts passiert.\n' +
    'Erst 3er-Orbits, dann höhere Perioden, offene Orbits und gezoomte Karten.',
  image: 'media/img/gametitles/laser-mandelbrot-###4###.png',
  init: () => {
    stats.score = 0;
    stats.lives = DIFFICULTY.lives;
    stats.level = 1;
    stats.caught = 0;
    stats.caughtInLevel = 0;
    stats.playTime = 0;
    particles = [];
    floaters = [];
    shake = 0;
    flash = 0;
    energy = 0;
    newHighscore = false;
    cursor.has = false;
    testCursor.active = false;
    tracker.reset();
    colorKey = null;
    mapJob = null; // erster Frame baut Startbildschirm neu auf
    liveJob = null;
    liveJobC = null;
  },
  handle: (grid, elapsed) => {
    try {
      handleFrame(grid, elapsed);
    } catch (e) {
      console.error('Fraktal-Orbits:', e);
    }
  },
  stop: () => {
    particles = [];
    floaters = [];
    try {
      if (audioCtx && audioCtx.close) audioCtx.close();
    } catch (e) {
      // egal
    }
    audioCtx = null;
  },
};
