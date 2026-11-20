/**
 * Platinen-Duell – Strompulse um die Mittelspalte
 *
 * Zwei Teams, linke gegen rechte Saalhälfte. In der Bildmitte sitzt ein Chip mit 12 Schaltfeldern
 * (senkrechte Mittelspalte). Von links und rechts führen Leiterbahnen mit Splittern, Blockern und
 * Verstärkern zu den Feldern. Am eigenen Bildrand hat jedes Team 6 dunkle Eingangs-Pads.
 *
 * Regeln:
 * - Pad mit Lasern füllen → ein Strompuls läuft (sichtbar, braucht Zeit) die Leiterbahn entlang.
 *   Ein Splitter teilt ihn auf zwei Felder auf. Kommt er an, leuchtet das Schaltfeld für die Haltezeit
 *   in Teamfarbe – danach fällt es zurück auf neutral. Ein Puls auf ein gegnerisches Feld kapert es.
 * - Pro Runde hat jedes Team nur begrenzt Pulse (Anzeige oben). Wer am Rundenende (30 s) mehr Felder hält,
 *   gewinnt die Runde. Wer zuerst DIFFICULTY.winsNeeded Runden hat, gewinnt das Duell
 *   (spätestens nach DIFFICULTY.maxRounds Runden entscheidet die Summe der Rundensiege bzw. Feldsekunden).
 * - Blocker (Balken mit Kreuz) schlucken den Puls. Verstärker (Raute) verlängern die Haltezeit (×1.8).
 * - ÜBERHITZEN (die Störregel): Laser sind nicht unterscheidbar, die Teamzugehörigkeit steckt nur in der
 *   Position. Darum: Ein Pad, das nach dem Feuern WEITER angeleuchtet wird (Abkühlphase), heizt auf.
 *   Bei 100 % ist es ÜBERHITZT: alle Pulse, die von diesem Pad noch unterwegs sind, verpuffen, und das Pad
 *   ist DIFFICULTY.overheatTime Sekunden gesperrt. Das eigene Team muss also kurz füllen und sofort
 *   loslassen – wer Laser übrig hat, hält sie dagegen in die Pads des Gegners und lässt dessen Pulse verpuffen.
 *   Ein gegnerisches Pad nur kurz anzutippen, hilft dem Gegner dagegen (es feuert für ihn!).
 *
 * Runden (neu pro Runde):
 *   R1 gerade Bahnen mit Splittern · R2 gekreuzte Bahnen, erste Blocker, fester Verstärker ·
 *   R3 wandernder Verstärker pro Seite (springt alle paar Sekunden ein Pad weiter) · R4 Sackgassen-Pad ·
 *   R5 Kurzschlüsse (zufällige Felder fallen aus) · R6+ weniger Pulse, kürzere Haltezeit, mehr Blocker.
 *   Vor jeder Runde wird die neue Platine 3 s lang gezeigt – Zeit zum Lesen der Bahnen (wie im Original).
 *
 * Szenen: title → levelup (Rundenintro) → game ⇄ levelup (Rundenergebnis + nächste Runde) → gameover
 *
 * Tastatur (Test ohne Laser):
 * - Leertaste: Start / Nochmal
 * - 1 2 3 4 5 6: linke Pads (oben → unten) antippen · 7 8 9 0 ß(Minus) ´(Equal): rechte Pads
 *   Taste GEDRÜCKT HALTEN = wie Dauerleuchten → Pad überhitzt (Störregel testen)
 * - A: Autopilot umschalten (aus → beide Teams → nur links → nur rechts → aus)
 * - N: Runde sofort beenden
 *   (d v g r m h t f F s, PageUp/PageDown/Home sind in view.js für Debug belegt – bewusst nicht genutzt)
 *
 * Licht-Disziplin: Pads am Rand sind schwarz hinterlegt und nur konturiert, der Rand des Hintergrunds ist
 * zu Schwarz abgedunkelt. Hell und farbig ist nur die Mitte (Chip + Felder, reiner Anzeigebereich).
 * Farben nur aus der Laserfarbe mit Hue-Verschiebung 0.25..0.75. Das fraktale Platinenmuster (H-Baum)
 * wird einmal in einen Offscreen-Canvas vorgerendert.
 *
 * Klassiker: Paradroid (Andrew Braybrook / Hewson, C64 1985) – das Transfer-Minispiel, bei dem man auf
 * einer Schaltplatine mit begrenzten Pulsen um eine Mittelspalte aus Feldern kämpft. Hier: eigene Namen,
 * eigener Look, Teams statt Droiden, Überhitzen als Saal-Störregel.
 * Ähnlich im Bestand: game-026-tauziehen (Teams links/rechts nach Saalhälfte, Kräftemessen in der Mitte),
 * game-033-kicker (zwei Saalhälften gegeneinander). Neu hier: begrenzte Ressource + Timing statt Dauerdruck,
 * Lesen einer Platine, Sabotage durch Überhitzen.
 *
 * One-Pixel-Netzwerkspiel: funktioniert gut. Jeder Netzspieler steuert einen Pixel; die Seite (Team) kann
 * beim Einloggen zugeteilt werden – die Regeln bleiben trotzdem rein positionsbasiert (wer in welchem Pad
 * leuchtet), Sabotage per Überhitzen funktioniert also genauso. Ein einzelner Pixel füllt ein Pad nur
 * langsam (Flächenanteil) – Teamwork bleibt nötig.
 *
 * Eingabe nur über gui/pixelFillButton (Pads, unsichtbar, eigene Darstellung) und gui/fillButton-ai2
 * (Start/Nochmal) – kein direkter grid-Zugriff.
 */

import util, { getRgbSpreadHex, renderTextDropShadow } from '../util.js';
import { createKeyEdge, isKeyDown } from './gui/gridScan.js';
import soundPulse from '../../../public/media/opengameart/Menu Move.ogg';
import soundCapture from '../../../public/media/opengameart/Item Pickup.ogg';
import soundOverheat from '../../../public/media/opengameart/Menu Error.ogg';
import soundBlock from '../../../public/media/369952__mischy__plop-1.wav';
import soundRound from '../../../public/media/opengameart/Level Up.ogg';
import soundWin from '../../../public/media/opengameart/Ability Learn.ogg';
import soundStart from '../../../public/media/521966__kastenfrosch__ready-to-start-jingle.ogg';
import soundTick from '../../../public/media/opengameart/Menu Selection Click.wav';
import soundShort from '../../../public/media/414346__bykgames__explosion-far.wav';
import soundBG from '../../../public/media/517267__foolboymedia__cinematic-stomp.wav';
var laserConfig = require('../LaserApiConfig.js').default;
var MasterCanvas = require('../MasterCanvas').default;
var guiFillButton = require('./gui/fillButton-ai2').default;
var guiPixelFillButton = require('./gui/pixelFillButton').default;
var createHighscore = require('../util/highscore').default;

const W = 1920;
const H = 1080;
const TEAM_NAMES = ['LINKS', 'RECHTS'];

// ---------------------------------------------------------------------------------------------------------
// Einstellungen
// ---------------------------------------------------------------------------------------------------------

/** Geometrie, Darstellung, Eingabe */
const SETTINGS = {
  rows: 12, // Schaltfelder in der Mittelspalte
  pads: 6, // Eingangs-Pads pro Seite
  padRadius: 62,
  padX: 125, // Abstand Pad-Mitte vom Bildrand
  traceStartX: 200, // Leiterbahn beginnt hier (linke Seite, rechts gespiegelt)
  ampX: 262, // wandernder Verstärker sitzt auf dem ersten geraden Bahnstück
  fieldW: 170,
  fieldH: 54,
  fieldTop: 178,
  fieldBottom: 1020,
  pulseSpeed: 420, // px/s auf der Leiterbahn
  padCooldown: 1.1, // s nach dem Feuern (in dieser Zeit heizt Licht das Pad auf)
  emptyCooldown: 0.8,
  heatGrace: 0.35, // so lange darf man nach dem Feuern noch drauf sein, ohne zu heizen
  heatRate: 140, // Hitze/s bei voll bedecktem Pad
  heatDecay: 50, // Hitze/s Abbau, wenn das Pad dunkel ist
  maxParticles: 400,
  maxFloaters: 30,
  resultDuration: 2.8,
  introDuration: 4.2, // davon die ersten introTextTime s mit grossem Text, danach freie Sicht auf die Platine
  firstIntroDuration: 4.8,
  introTextTime: 1.8,
  againDelay: 2,
  keys: [
    ['Digit1', 'Digit2', 'Digit3', 'Digit4', 'Digit5', 'Digit6'],
    ['Digit7', 'Digit8', 'Digit9', 'Digit0', 'Minus', 'Equal'],
  ],
  keyLabels: [
    ['1', '2', '3', '4', '5', '6'],
    ['7', '8', '9', '0', 'ß', '´'],
  ],
  autoKey: 'KeyA',
  nextKey: 'KeyN',
};

/** Balancing pro Runde */
const DIFFICULTY = {
  roundTime: 30,
  winsNeeded: 3, // Best of 5
  maxRounds: 7, // bei Unentschieden-Runden spätestens hier Schluss
  pulsesStart: 12,
  pulsesPerRound: -1,
  pulsesMin: 8,
  holdStart: 7.5, // Sekunden, die ein Feld nach einem Puls gehalten wird
  holdPerRound: -0.4,
  holdMin: 5,
  ampFactor: 1.8,
  padFillSpeed: 110, // Füllung/s bei voll bedecktem Pad (Auslösen bei 75)
  padFullPercent: 35, // ab diesem Flächenanteil volle Füllgeschwindigkeit
  overheatTime: 5,
  singleTraces: 2, // Bahnen ohne Splitter pro Seite
  crossFromRound: 2,
  blockersFromRound: 2,
  blockersPerRound: 1,
  blockersMax: 4,
  staticAmpFromRound: 2,
  wanderAmpFromRound: 3,
  ampMoveInterval: 3.5,
  trapFromRound: 4,
  shortFromRound: 5,
  shortInterval: 5,
  stealShake: 8,
  overheatShake: 14,
};

const ROUND_NEWS = {
  1: 'Pad kurz füllen → Puls → Feld leuchtet!\nDanach sofort loslassen – sonst überhitzt es.',
  2: 'Gekreuzte Bahnen, erste Blocker\nund ein Verstärker (Raute = länger halten)',
  3: 'Wandernder Verstärker!\nEr springt von Bahn zu Bahn – passt ihn ab.',
  4: 'Sackgasse: ein Pad pro Seite führt ins Nichts',
  5: 'Kurzschlüsse lassen Felder ausfallen',
  6: 'Weniger Pulse, kürzere Haltezeit',
  7: 'Entscheidungsrunde!',
};

const AUTO_MODES = ['aus', 'beide', 'nur links', 'nur rechts'];

// ---------------------------------------------------------------------------------------------------------
// Zustand (vorbelegt, damit handle() auch ohne init() läuft)
// ---------------------------------------------------------------------------------------------------------

const STATE = {
  scene: 'title',
  sceneTime: 0,
  time: 0,
  round: 0,
  roundTime: 0,
  phase: 'intro', // in der levelup-Szene: 'result' oder 'intro'
  wins: [0, 0],
  pulsesLeft: [0, 0],
  lastResult: null, // { winner, counts }
  matchOver: false,
  matchWinner: -1,
  shake: 0,
  flash: 0,
  flashColor: null,
  shortTimer: 0,
  lastTick: -1,
  demoTimer: 0,
  autoMode: 0,
  newHighscore: false,
};

const STATS = {
  fieldSeconds: [0, 0],
  roundFieldSeconds: [0, 0],
  pulsesFired: [0, 0],
  captures: [0, 0],
  steals: [0, 0],
  overheats: [0, 0],
  blocked: [0, 0],
  fizzled: [0, 0],
  shorts: 0,
};

var layout = null; // { round, traces: [[6], [6]] }
var pads = null; // [[6], [6]]
var fields = [];
var pulses = [];
var particles = [];
var floaters = [];
var amps = [
  { active: false, pad: 0, y: 0, timer: 0 },
  { active: false, pad: 0, y: 0, timer: 0 },
];
var bots = [
  { timer: 1 },
  { timer: 1.4 },
];

var startButton = null;
var againButton = null;
var bgSound = null;
var keyEdge = createKeyEdge();
var highscore = createHighscore('Platinen-Duell', 'punkte');
var soundTimes = {};

var PAL = null;
var palKey = '';
var bgCanvas = null; // fraktales Platinenmuster (pro Palette)
var boardCanvas = null; // Hintergrund + Leiterbahnen (pro Layout)
var boardKey = '';

// ---------------------------------------------------------------------------------------------------------
// Hilfen
// ---------------------------------------------------------------------------------------------------------

/** Farbe aus der Laserfarbe; Hue immer im Komplementärbereich 0.25..0.75 */
function col(h, s, v) {
  const hue = Math.max(0.25, Math.min(0.75, h));
  return getRgbSpreadHex(laserConfig.testColor, hue, s, v);
}

function ensurePalette() {
  const key = String(laserConfig.testColor);
  if (PAL && key === palKey) return;
  palKey = key;
  const hues = [0.3, 0.58];
  PAL = {
    team: hues.map((h) => col(h, 0.75, 1)),
    teamMid: hues.map((h) => col(h, 0.65, 0.7)),
    teamDim: hues.map((h) => col(h, 0.55, 0.4)),
    teamDark: hues.map((h) => col(h, 0.6, 0.2)),
    traceDead: col(0.45, 0.2, 0.22),
    hot: col(0.74, 0.85, 1),
    hotDim: col(0.74, 0.7, 0.5),
    amp: col(0.44, 0.35, 1),
    ampDim: col(0.44, 0.35, 0.55),
    blocker: col(0.72, 0.5, 0.8),
    neutral: col(0.45, 0.18, 0.2),
    neutralEdge: col(0.45, 0.2, 0.45),
    chip: col(0.45, 0.35, 0.1),
    chipEdge: col(0.45, 0.35, 0.4),
    bgLine: col(0.47, 0.45, 0.2),
    bgVia: col(0.47, 0.4, 0.28),
    hud: col(0.45, 0.35, 0.9),
    hudDim: col(0.45, 0.3, 0.55),
    title: col(0.4, 0.6, 0.95),
    sub: col(0.55, 0.45, 0.85),
    flash: col(0.5, 0.2, 1),
    go: [col(0.45, 0.6, 0.55), col(0.45, 0.6, 0.8), col(0.45, 0.6, 1)],
  };
  bgCanvas = null;
  boardCanvas = null;
}

function playSound(src, volume, minGap) {
  const now = STATE.time;
  if (minGap && soundTimes[src] !== undefined && now - soundTimes[src] < minGap) return null;
  soundTimes[src] = now;
  try {
    const a = new Audio(src);
    a.volume = volume === undefined ? 1 : volume;
    const p = a.play();
    if (p && p.catch) p.catch(() => {});
    return a;
  } catch (e) {
    return null;
  }
}

function stopMusic() {
  if (bgSound) {
    try {
      bgSound.pause();
    } catch (e) {
      // egal
    }
    bgSound = null;
  }
}

function setScene(name) {
  STATE.scene = name;
  STATE.sceneTime = 0;
}

function rowY(r) {
  return SETTINGS.fieldTop + (r * (SETTINGS.fieldBottom - SETTINGS.fieldTop)) / (SETTINGS.rows - 1);
}

function padY(i) {
  return (rowY(2 * i) + rowY(2 * i + 1)) / 2;
}

function padX(team) {
  return team === 0 ? SETTINGS.padX : W - SETTINGS.padX;
}

function mirrorY(y) {
  return SETTINGS.fieldTop + SETTINGS.fieldBottom - y;
}

function pulsesForRound(r) {
  return Math.max(DIFFICULTY.pulsesMin, DIFFICULTY.pulsesStart + (r - 1) * DIFFICULTY.pulsesPerRound);
}

function holdTime() {
  return Math.max(DIFFICULTY.holdMin, DIFFICULTY.holdStart + (Math.max(1, STATE.round) - 1) * DIFFICULTY.holdPerRound);
}

function addParticles(x, y, count, color, speed, life) {
  for (let i = 0; i < count && particles.length < SETTINGS.maxParticles; i++) {
    const a = Math.random() * Math.PI * 2;
    const s = (0.3 + Math.random()) * (speed || 220);
    const l = (life || 0.6) * (0.6 + Math.random() * 0.8);
    particles.push({ x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s, life: l, max: l, color, size: 2 + Math.random() * 4 });
  }
}

function addFloater(x, y, text, color, size) {
  if (floaters.length >= SETTINGS.maxFloaters) floaters.shift();
  floaters.push({ x, y, text, color, size: size || 40, life: 1.4, max: 1.4 });
}

function shake(amount) {
  STATE.shake = Math.max(STATE.shake, amount);
}

// ---------------------------------------------------------------------------------------------------------
// Polylinien (Leiterbahnen)
// ---------------------------------------------------------------------------------------------------------

function makePoly(pts) {
  const cum = [0];
  let len = 0;
  for (let i = 1; i < pts.length; i++) {
    len += Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]);
    cum.push(len);
  }
  return { pts, cum, len };
}

function mirrorPoly(poly) {
  return makePoly(poly.pts.map((p) => [W - p[0], mirrorY(p[1])]));
}

/** Punkt bei Bogenlänge d */
function pointAt(poly, d) {
  const pts = poly.pts;
  if (d <= 0) return { x: pts[0][0], y: pts[0][1] };
  if (d >= poly.len) return { x: pts[pts.length - 1][0], y: pts[pts.length - 1][1] };
  for (let i = 1; i < pts.length; i++) {
    if (d <= poly.cum[i]) {
      const seg = poly.cum[i] - poly.cum[i - 1] || 1;
      const t = (d - poly.cum[i - 1]) / seg;
      return { x: pts[i - 1][0] + (pts[i][0] - pts[i - 1][0]) * t, y: pts[i - 1][1] + (pts[i][1] - pts[i - 1][1]) * t };
    }
  }
  return { x: pts[pts.length - 1][0], y: pts[pts.length - 1][1] };
}

// ---------------------------------------------------------------------------------------------------------
// Platinen-Layout
// ---------------------------------------------------------------------------------------------------------

function pickDistinct(n, count) {
  const list = [];
  for (let i = 0; i < n; i++) list.push(i);
  for (let i = list.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    const t = list[i];
    list[i] = list[j];
    list[j] = t;
  }
  return list.slice(0, Math.min(n, count));
}

/**
 * Baut die linke Seite und spiegelt sie punktsymmetrisch für rechts (fair: gleiche Struktur,
 * aber andere Felder, damit keine Zeile für beide unerreichbar ist).
 */
function buildLayout(round) {
  const n = SETTINGS.pads;
  const perm = [];
  for (let i = 0; i < n; i++) perm.push(i);
  if (round >= DIFFICULTY.crossFromRound) {
    const swaps = Math.min(3, round - 1);
    for (let s = 0, tries = 0; s < swaps && tries < 30; tries++) {
      const i = Math.floor(Math.random() * (n - 1));
      const j = Math.min(n - 1, i + 1 + (Math.random() < 0.4 ? 1 : 0));
      // nur Vertauschungen, bei denen keine Bahn mehr als 2 Pads weit springt (lesbar bleiben)
      if (Math.abs(perm[j] - i) > 2 || Math.abs(perm[i] - j) > 2) continue;
      const t = perm[i];
      perm[i] = perm[j];
      perm[j] = t;
      s++;
    }
  }
  const singles = pickDistinct(n, DIFFICULTY.singleTraces);
  const fieldEdge = W / 2 - SETTINGS.fieldW / 2 - 6;
  const left = [];
  for (let i = 0; i < n; i++) {
    const p = perm[i];
    const y0 = padY(i);
    const ty = padY(p);
    const sx = SETTINGS.traceStartX;
    let jx = 560 + Math.random() * 90;
    let pts;
    if (Math.abs(ty - y0) < 1) {
      pts = [[sx, y0], [jx, y0]];
    } else {
      const xa = 300 + i * 26;
      const xb = xa + Math.abs(ty - y0) * 0.42;
      jx = Math.max(jx, xb + 50);
      pts = [[sx, y0], [xa, y0], [xb, ty], [jx, ty]];
    }
    const rows = singles.indexOf(i) >= 0 ? [2 * p + (Math.random() < 0.5 ? 0 : 1)] : [2 * p, 2 * p + 1];
    const branches = rows.map((r) => {
      const ry = rowY(r);
      const bx = jx + 34;
      return {
        poly: makePoly([[jx, ty], [bx, ty], [bx + Math.abs(ry - ty), ry], [fieldEdge, ry]]),
        row: r,
        blockAt: -1,
        ampAt: -1,
      };
    });
    left.push({ team: 0, pad: i, stem: makePoly(pts), stemBlockAt: -1, branches, trap: false });
  }

  // Blocker: höchstens einer pro Bahn, nur auf Splitter-Bahnen (es bleibt immer ein Weg)
  if (round >= DIFFICULTY.blockersFromRound) {
    const count = Math.min(DIFFICULTY.blockersMax, (round - DIFFICULTY.blockersFromRound + 1) * DIFFICULTY.blockersPerRound);
    const splits = left.filter((t) => t.branches.length > 1);
    pickDistinct(splits.length, count).forEach((k) => {
      const b = splits[k].branches[Math.random() < 0.5 ? 0 : 1];
      b.blockAt = b.poly.len * 0.6;
    });
  }
  // Sackgasse: eine Bahn endet vor dem Splitter
  if (round >= DIFFICULTY.trapFromRound) {
    const t = left[Math.floor(Math.random() * n)];
    t.trap = true;
    t.stemBlockAt = t.stem.len * 0.72;
  }
  // fester Verstärker auf einem freien Ast
  if (round >= DIFFICULTY.staticAmpFromRound) {
    const free = [];
    left.forEach((t) => {
      if (t.trap) return;
      t.branches.forEach((b) => {
        if (b.blockAt < 0) free.push(b);
      });
    });
    if (free.length > 0) {
      const b = free[Math.floor(Math.random() * free.length)];
      b.ampAt = b.poly.len * 0.45;
    }
  }

  const right = [];
  for (let i = 0; i < n; i++) right.push(null);
  left.forEach((t) => {
    right[n - 1 - t.pad] = {
      team: 1,
      pad: n - 1 - t.pad,
      stem: mirrorPoly(t.stem),
      stemBlockAt: t.stemBlockAt,
      trap: t.trap,
      branches: t.branches.map((b) => ({ poly: mirrorPoly(b.poly), row: SETTINGS.rows - 1 - b.row, blockAt: b.blockAt, ampAt: b.ampAt })),
    };
  });
  layout = { round, traces: [left, right] };
  boardCanvas = null;
}

function ensureLayout() {
  if (!layout) buildLayout(Math.max(1, STATE.round));
}

function resetFields() {
  fields = [];
  for (let r = 0; r < SETTINGS.rows; r++) fields.push({ owner: -1, timer: 0, max: 1, amp: false, flash: 0, shortFx: 0 });
}

function ensureFields() {
  if (fields.length !== SETTINGS.rows) resetFields();
}

function resetAmps() {
  for (let t = 0; t < 2; t++) {
    const k = Math.floor(Math.random() * SETTINGS.pads);
    amps[t].active = STATE.round >= DIFFICULTY.wanderAmpFromRound;
    amps[t].pad = k;
    amps[t].y = padY(k);
    amps[t].timer = DIFFICULTY.ampMoveInterval;
  }
}

// ---------------------------------------------------------------------------------------------------------
// Pads (lazy)
// ---------------------------------------------------------------------------------------------------------

function ensurePads() {
  if (pads) return;
  pads = [[], []];
  for (let t = 0; t < 2; t++) {
    for (let i = 0; i < SETTINGS.pads; i++) {
      const pad = { team: t, index: i, cooldown: 0, coolAge: 9, heat: 0, overheat: 0, botTap: false, fired: 0, btn: null };
      pad.btn = guiPixelFillButton({
        label: '',
        posX: padX(t),
        posY: padY(i),
        radius: SETTINGS.padRadius,
        speedUp: DIFFICULTY.padFillSpeed,
        speedDown: 40,
        fullPercent: DIFFICULTY.padFullPercent,
        activeValue: 75,
        counterReset: true,
        visible: false,
        onEnterActive: () => firePad(pad),
      });
      pads[t].push(pad);
    }
  }
}

function resetPads() {
  if (!pads) return;
  for (let t = 0; t < 2; t++) {
    pads[t].forEach((p) => {
      p.cooldown = 0;
      p.coolAge = 9;
      p.heat = 0;
      p.overheat = 0;
      p.botTap = false;
      p.fired = 0;
      p.btn.setValue(0);
    });
  }
}

function makeButton(label, x, y, radius, onActive) {
  return guiFillButton({
    label,
    posX: x,
    posY: y,
    radius,
    edges: 8,
    angle: Math.PI / 8,
    speedUp: 45,
    speedDown: 20,
    activeValue: 85,
    lineWidth: 5,
    normalColor: PAL.go[0],
    growColor: PAL.go[1],
    activeColor: PAL.go[2],
    onEnterActive: onActive,
  });
}

// ---------------------------------------------------------------------------------------------------------
// Spiel-Logik
// ---------------------------------------------------------------------------------------------------------

function spawnPulse(trace, team, demo) {
  pulses.push({ team, trace, stage: 'stem', poly: trace.stem, branch: null, dist: 0, amp: false, demo: !!demo, age: 0 });
}

function firePad(pad) {
  if (STATE.scene !== 'game') return;
  if (pad.cooldown > 0 || pad.overheat > 0) return;
  ensureLayout();
  const t = pad.team;
  const x = padX(t);
  const y = padY(pad.index);
  if (STATE.pulsesLeft[t] <= 0) {
    pad.cooldown = SETTINGS.emptyCooldown;
    pad.coolAge = 0;
    addFloater(x + (t === 0 ? 150 : -150), y, 'LEER', PAL.hudDim, 34);
    playSound(soundBlock, 0.4, 0.3);
    return;
  }
  STATE.pulsesLeft[t]--;
  STATS.pulsesFired[t]++;
  pad.cooldown = SETTINGS.padCooldown;
  pad.coolAge = 0;
  pad.fired = 1;
  spawnPulse(layout.traces[t][pad.index], t, false);
  addParticles(x + (t === 0 ? 70 : -70), y, 8, PAL.team[t], 160, 0.4);
  playSound(soundPulse, 0.5, 0.06);
}

function overheatPad(pad) {
  const t = pad.team;
  pad.heat = 0;
  pad.overheat = DIFFICULTY.overheatTime;
  pad.cooldown = 0;
  STATS.overheats[t]++;
  const x = padX(t);
  const y = padY(pad.index);
  let killed = 0;
  pulses.slice().forEach((p) => {
    if (p.trace.team === t && p.trace.pad === pad.index) {
      const pos = pointAt(p.poly, p.dist);
      addParticles(pos.x, pos.y, 14, PAL.hot, 260, 0.5);
      removePulse(p);
      killed++;
    }
  });
  STATS.fizzled[t] += killed;
  addParticles(x, y, 24, PAL.hot, 300, 0.7);
  addFloater(x + (t === 0 ? 170 : -170), y - 10, killed > 0 ? 'ÜBERHITZT – verpufft!' : 'ÜBERHITZT!', PAL.hot, 38);
  shake(DIFFICULTY.overheatShake);
  playSound(soundOverheat, 0.7, 0.15);
}

function removePulse(p) {
  const i = pulses.indexOf(p);
  if (i >= 0) pulses.splice(i, 1);
}

function capture(team, row, amp, demo) {
  const f = fields[row];
  if (!f) return;
  const hold = holdTime() * (amp ? DIFFICULTY.ampFactor : 1);
  const stolen = f.owner === 1 - team && f.timer > 0;
  if (f.owner === team) {
    f.timer = Math.max(f.timer, hold);
  } else {
    f.timer = hold;
  }
  f.owner = team;
  f.max = Math.max(f.timer, 0.1);
  f.amp = amp || (f.amp && f.timer > hold);
  f.flash = 1;
  const fx = W / 2 + (team === 0 ? -SETTINGS.fieldW / 2 : SETTINGS.fieldW / 2);
  const y = rowY(row);
  addParticles(fx, y, stolen ? 22 : 12, PAL.team[team], stolen ? 320 : 200, 0.6);
  if (demo) return;
  STATS.captures[team]++;
  if (stolen) {
    STATS.steals[team]++;
    addFloater(W / 2 + (team === 0 ? 250 : -250) + (Math.random() - 0.5) * 120, y + 14, 'GEKAPERT!', PAL.team[team], 36);
    shake(DIFFICULTY.stealShake);
  } else if (amp) {
    addFloater(W / 2 + (team === 0 ? 250 : -250), y + 14, 'VERSTÄRKT', PAL.amp, 32);
  }
  playSound(soundCapture, 0.45, 0.08);
}

function killPulseAt(p, text) {
  const pos = pointAt(p.poly, p.dist);
  addParticles(pos.x, pos.y, 16, PAL.blocker, 240, 0.5);
  if (!p.demo) {
    STATS.blocked[p.team]++;
    if (text) addFloater(pos.x, pos.y - 30, text, PAL.blocker, 32);
    playSound(soundBlock, 0.5, 0.1);
  }
  removePulse(p);
}

function updatePulses(dt) {
  const ampDist = SETTINGS.ampX - SETTINGS.traceStartX;
  pulses.slice().forEach((p) => {
    const prev = p.dist;
    p.dist += SETTINGS.pulseSpeed * dt;
    p.age += dt;
    if (p.stage === 'stem') {
      const amp = amps[p.team];
      if (amp.active && !p.amp && prev < ampDist && p.dist >= ampDist && amp.pad === p.trace.pad && Math.abs(amp.y - padY(amp.pad)) < 25) {
        p.amp = true;
        const pos = pointAt(p.poly, ampDist);
        addParticles(pos.x, pos.y, 12, PAL.amp, 200, 0.5);
      }
      if (p.trace.stemBlockAt >= 0 && p.dist >= p.trace.stemBlockAt) {
        p.dist = p.trace.stemBlockAt;
        killPulseAt(p, 'SACKGASSE');
        return;
      }
      if (p.dist >= p.poly.len) {
        const rest = p.dist - p.poly.len;
        p.trace.branches.forEach((b) => {
          pulses.push({ team: p.team, trace: p.trace, stage: 'branch', poly: b.poly, branch: b, dist: rest, amp: p.amp, demo: p.demo, age: p.age });
        });
        const pos = pointAt(p.poly, p.poly.len);
        addParticles(pos.x, pos.y, 5, PAL.team[p.team], 120, 0.3);
        removePulse(p);
      }
    } else {
      const b = p.branch;
      if (b.ampAt >= 0 && !p.amp && prev < b.ampAt && p.dist >= b.ampAt) {
        p.amp = true;
        const pos = pointAt(p.poly, b.ampAt);
        addParticles(pos.x, pos.y, 12, PAL.amp, 200, 0.5);
      }
      if (b.blockAt >= 0 && p.dist >= b.blockAt) {
        p.dist = b.blockAt;
        killPulseAt(p, 'BLOCK');
        return;
      }
      if (p.dist >= p.poly.len) {
        capture(p.team, b.row, p.amp, p.demo);
        removePulse(p);
      }
    }
  });
}

function updateFields(dt, countStats) {
  fields.forEach((f, r) => {
    f.flash = Math.max(0, f.flash - dt * 2);
    f.shortFx = Math.max(0, f.shortFx - dt * 1.5);
    if (f.owner < 0) return;
    f.timer -= dt;
    if (countStats) {
      STATS.fieldSeconds[f.owner] += dt;
      STATS.roundFieldSeconds[f.owner] += dt;
    }
    if (f.timer <= 0) {
      addParticles(W / 2, rowY(r), 6, PAL.teamDim[f.owner], 120, 0.4);
      f.owner = -1;
      f.timer = 0;
      f.amp = false;
    }
  });
}

function updateAmps(dt) {
  for (let t = 0; t < 2; t++) {
    const a = amps[t];
    if (!a.active) continue;
    a.timer -= dt;
    if (a.timer <= 0) {
      a.timer = DIFFICULTY.ampMoveInterval;
      let k = a.pad + (Math.random() < 0.5 ? -1 : 1);
      if (k < 0) k = 1;
      if (k >= SETTINGS.pads) k = SETTINGS.pads - 2;
      a.pad = k;
    }
    const target = padY(a.pad);
    a.y += (target - a.y) * Math.min(1, dt * 6);
  }
}

function updatePads(grid, dt, active) {
  ensurePads();
  for (let t = 0; t < 2; t++) {
    for (let i = 0; i < SETTINGS.pads; i++) {
      const pad = pads[t][i];
      const key = SETTINGS.keys[t][i];
      const tap = keyEdge(key) || pad.botTap;
      pad.botTap = false;
      const held = isKeyDown(key);
      pad.overheat = Math.max(0, pad.overheat - dt);
      pad.cooldown = Math.max(0, pad.cooldown - dt);
      pad.coolAge += dt;
      pad.fired = Math.max(0, pad.fired - dt * 2);
      const ready = active && pad.overheat <= 0 && pad.cooldown <= 0;
      if (!ready) pad.btn.setValue(0);
      else if (tap) pad.btn.setValue(100);
      pad.btn.handle(grid, dt); // misst Flächenanteil, feuert ggf. firePad()
      if (!ready) pad.btn.setValue(0);
      const fill = held ? 100 : pad.btn.getFillPercent();
      const lit = fill > 0;
      if (active && pad.cooldown > 0 && pad.overheat <= 0 && pad.coolAge > SETTINGS.heatGrace && lit) {
        pad.heat += SETTINGS.heatRate * Math.min(1, fill / DIFFICULTY.padFullPercent) * dt;
      } else if (!lit || pad.overheat > 0) {
        pad.heat = Math.max(0, pad.heat - SETTINGS.heatDecay * dt);
      }
      if (active && pad.heat >= 100) overheatPad(pad);
    }
  }
}

/** Autopilot (Tastatur-Testmodus): tippt sinnvolle Pads an und spart Pulse fürs Rundenende */
function updateBots(dt) {
  const mode = STATE.autoMode;
  if (mode === 0) return;
  for (let t = 0; t < 2; t++) {
    if (mode === 2 && t !== 0) continue;
    if (mode === 3 && t !== 1) continue;
    const bot = bots[t];
    bot.timer -= dt;
    if (bot.timer > 0) continue;
    bot.timer = 0.5 + Math.random() * 1.1;
    const left = STATE.pulsesLeft[t];
    if (left <= 0) continue;
    // Reserve fürs Finale: vor den letzten Sekunden nur feuern, wenn genug übrig ist
    const late = STATE.roundTime < holdTime() + 1.5;
    if (!late && left <= 5) continue;
    let best = null;
    let bestScore = 0.4;
    pads[t].forEach((pad) => {
      if (pad.cooldown > 0 || pad.overheat > 0) return;
      const tr = layout.traces[t][pad.index];
      if (tr.trap) return;
      let score = Math.random() * 0.3;
      tr.branches.forEach((b) => {
        if (b.blockAt >= 0) return;
        const f = fields[b.row];
        if (f.owner !== t) score += f.owner < 0 ? 1 : 1.3;
        else if (f.timer < 2.5) score += 0.6;
      });
      if (score > bestScore) {
        bestScore = score;
        best = pad;
      }
    });
    if (best) best.botTap = true;
  }
}

function updateShorts(dt) {
  if (STATE.round < DIFFICULTY.shortFromRound) return;
  STATE.shortTimer -= dt;
  if (STATE.shortTimer > 0) return;
  STATE.shortTimer = DIFFICULTY.shortInterval * (0.7 + Math.random() * 0.6);
  const owned = [];
  fields.forEach((f, r) => {
    if (f.owner >= 0) owned.push(r);
  });
  if (owned.length === 0) return;
  const r = owned[Math.floor(Math.random() * owned.length)];
  const f = fields[r];
  addParticles(W / 2, rowY(r), 26, PAL.hot, 340, 0.6);
  f.owner = -1;
  f.timer = 0;
  f.amp = false;
  f.shortFx = 1;
  STATS.shorts++;
  addFloater(W / 2, rowY(r) - 34, 'KURZSCHLUSS', PAL.hot, 34);
  shake(10);
  playSound(soundShort, 0.4, 0.3);
}

function updateParticles(dt) {
  particles.slice().forEach((p) => {
    p.life -= dt;
    if (p.life <= 0) {
      const i = particles.indexOf(p);
      if (i >= 0) particles.splice(i, 1);
      return;
    }
    p.x += p.vx * dt;
    p.y += p.vy * dt;
    p.vx *= 1 - Math.min(1, dt * 2.5);
    p.vy *= 1 - Math.min(1, dt * 2.5);
  });
  floaters.slice().forEach((f) => {
    f.life -= dt;
    f.y -= 45 * dt;
    if (f.life <= 0) {
      const i = floaters.indexOf(f);
      if (i >= 0) floaters.splice(i, 1);
    }
  });
}

function countFields() {
  const c = [0, 0];
  fields.forEach((f) => {
    if (f.owner >= 0 && f.timer > 0) c[f.owner]++;
  });
  return c;
}

// ---------------------------------------------------------------------------------------------------------
// Runden / Match
// ---------------------------------------------------------------------------------------------------------

function resetMatch() {
  STATE.round = 0;
  STATE.wins = [0, 0];
  STATE.pulsesLeft = [0, 0];
  STATE.lastResult = null;
  STATE.matchOver = false;
  STATE.matchWinner = -1;
  STATE.shake = 0;
  STATE.flash = 0;
  STATE.newHighscore = false;
  STATS.fieldSeconds = [0, 0];
  STATS.roundFieldSeconds = [0, 0];
  STATS.pulsesFired = [0, 0];
  STATS.captures = [0, 0];
  STATS.steals = [0, 0];
  STATS.overheats = [0, 0];
  STATS.blocked = [0, 0];
  STATS.fizzled = [0, 0];
  STATS.shorts = 0;
  pulses = [];
  particles = [];
  floaters = [];
  againButton = null;
  resetFields();
  resetPads();
}

function resetAll() {
  stopMusic();
  resetMatch();
  layout = null;
  startButton = null;
  keyEdge = createKeyEdge();
  STATE.autoMode = 0;
  STATE.demoTimer = 0;
  setScene('title');
}

function startMatch() {
  resetMatch();
  playSound(soundStart, 0.7);
  stopMusic();
  bgSound = playSound(soundBG, 0.35);
  if (bgSound) bgSound.loop = true;
  beginIntro();
}

/** nächste Runde vorbereiten: neue Platine zeigen, Pads ruhen */
function beginIntro() {
  STATE.round++;
  buildLayout(STATE.round);
  resetFields();
  resetPads();
  pulses = [];
  resetAmps();
  STATE.pulsesLeft = [pulsesForRound(STATE.round), pulsesForRound(STATE.round)];
  STATE.roundTime = DIFFICULTY.roundTime;
  STATE.shortTimer = DIFFICULTY.shortInterval;
  STATE.lastTick = -1;
  STATS.roundFieldSeconds = [0, 0];
  STATE.phase = 'intro';
  STATE.flash = 0.8;
  setScene('levelup');
}

function endRound() {
  const c = countFields();
  let winner = -1;
  if (c[0] > c[1]) winner = 0;
  else if (c[1] > c[0]) winner = 1;
  if (winner >= 0) STATE.wins[winner]++;
  STATE.lastResult = { winner, counts: c, round: STATE.round };
  pulses = [];
  if (STATE.wins[0] >= DIFFICULTY.winsNeeded || STATE.wins[1] >= DIFFICULTY.winsNeeded || STATE.round >= DIFFICULTY.maxRounds) {
    STATE.matchOver = true;
    if (STATE.wins[0] > STATE.wins[1]) STATE.matchWinner = 0;
    else if (STATE.wins[1] > STATE.wins[0]) STATE.matchWinner = 1;
    else if (STATS.fieldSeconds[0] > STATS.fieldSeconds[1] + 0.5) STATE.matchWinner = 0;
    else if (STATS.fieldSeconds[1] > STATS.fieldSeconds[0] + 0.5) STATE.matchWinner = 1;
    else STATE.matchWinner = -1;
  }
  STATE.phase = 'result';
  STATE.flash = 1;
  STATE.flashColor = winner >= 0 ? PAL.team[winner] : PAL.flash;
  if (winner >= 0) {
    const fx = W / 2;
    for (let r = 0; r < SETTINGS.rows; r++) {
      if (fields[r].owner === winner) addParticles(fx, rowY(r), 10, PAL.team[winner], 300, 0.8);
    }
  }
  playSound(soundRound, 0.7);
  setScene('levelup');
}

function finish() {
  stopMusic();
  playSound(soundWin, 0.8);
  const w = STATE.matchWinner;
  const ws = w >= 0 ? STATS.fieldSeconds[w] : Math.max(STATS.fieldSeconds[0], STATS.fieldSeconds[1]);
  // nur 3 Felder – renderHighAndLowScores schreibt jedes Feld in eine eigene 70-px-Zeile
  highscore.addEntry({
    punkte: Math.round(ws * 10),
    runden: STATE.round,
    siege: Math.max(STATE.wins[0], STATE.wins[1]),
  });
  STATE.newHighscore = highscore.lastEntryNewHighscore();
  againButton = null;
  setScene('gameover');
}

// ---------------------------------------------------------------------------------------------------------
// Vorrendern: fraktales Platinenmuster + Leiterbahnen
// ---------------------------------------------------------------------------------------------------------

function makeCanvas() {
  const c = document.createElement('canvas');
  c.width = W;
  c.height = H;
  return c;
}

/** H-Baum: Linie, an beiden Enden quer halbiert weiter – klassisches Fraktal-Leiterbahnmuster */
function hTree(g, x, y, len, depth, horizontal) {
  if (depth <= 0 || len < 6) {
    g.beginPath();
    g.arc(x, y, Math.max(2, len * 0.35), 0, Math.PI * 2);
    g.stroke();
    return;
  }
  const dx = horizontal ? len / 2 : 0;
  const dy = horizontal ? 0 : len / 2;
  g.lineWidth = Math.max(1, depth * 0.55);
  g.beginPath();
  g.moveTo(x - dx, y - dy);
  g.lineTo(x + dx, y + dy);
  g.stroke();
  const next = len / Math.SQRT2;
  hTree(g, x - dx, y - dy, next, depth - 1, !horizontal);
  hTree(g, x + dx, y + dy, next, depth - 1, !horizontal);
}

function ensureBackground() {
  if (bgCanvas) return;
  bgCanvas = makeCanvas();
  const g = bgCanvas.getContext('2d');
  g.fillStyle = '#000000';
  g.fillRect(0, 0, W, H);
  g.strokeStyle = PAL.bgLine;
  g.lineCap = 'round';
  // Kacheln aus H-Bäumen, leicht versetzt
  for (let ty = 0; ty < 3; ty++) {
    for (let tx = 0; tx < 5; tx++) {
      const x = 190 + tx * 385 + (ty % 2) * 190;
      const y = 180 + ty * 360;
      g.globalAlpha = 0.55 + 0.45 * ((tx + ty) % 2);
      hTree(g, x, y, 250, 8, (tx + ty) % 2 === 0);
    }
  }
  g.globalAlpha = 1;
  // Vias (kleine Ringe) verstreut
  g.strokeStyle = PAL.bgVia;
  g.lineWidth = 2;
  for (let i = 0; i < 160; i++) {
    g.beginPath();
    g.arc(Math.random() * W, Math.random() * H, 3 + Math.random() * 5, 0, Math.PI * 2);
    g.stroke();
  }
  // Ränder (Pad-Zonen) zu Schwarz abdunkeln – dort leuchten die Laser
  const edge = 330;
  let gr = g.createLinearGradient(0, 0, edge, 0);
  gr.addColorStop(0, 'rgba(0,0,0,0.97)');
  gr.addColorStop(0.65, 'rgba(0,0,0,0.85)');
  gr.addColorStop(1, 'rgba(0,0,0,0)');
  g.fillStyle = gr;
  g.fillRect(0, 0, edge, H);
  gr = g.createLinearGradient(W, 0, W - edge, 0);
  gr.addColorStop(0, 'rgba(0,0,0,0.97)');
  gr.addColorStop(0.65, 'rgba(0,0,0,0.85)');
  gr.addColorStop(1, 'rgba(0,0,0,0)');
  g.fillStyle = gr;
  g.fillRect(W - edge, 0, edge, H);
  // Chip in der Mitte
  const cw = SETTINGS.fieldW + 90;
  const glow = g.createRadialGradient(W / 2, H / 2 + 40, 50, W / 2, H / 2 + 40, 620);
  glow.addColorStop(0, PAL.chip);
  glow.addColorStop(1, 'rgba(0,0,0,0)');
  g.fillStyle = glow;
  g.fillRect(W / 2 - 620, 0, 1240, H);
  g.fillStyle = PAL.chip;
  g.strokeStyle = PAL.chipEdge;
  g.lineWidth = 4;
  g.fillRect(W / 2 - cw / 2, SETTINGS.fieldTop - 50, cw, SETTINGS.fieldBottom - SETTINGS.fieldTop + 100);
  g.strokeRect(W / 2 - cw / 2, SETTINGS.fieldTop - 50, cw, SETTINGS.fieldBottom - SETTINGS.fieldTop + 100);
  // Chip-Beinchen
  g.lineWidth = 3;
  for (let r = 0; r <= SETTINGS.rows; r++) {
    const y = rowY(0) - 38 + r * ((rowY(SETTINGS.rows - 1) - rowY(0) + 76) / SETTINGS.rows);
    g.beginPath();
    g.moveTo(W / 2 - cw / 2 - 12, y);
    g.lineTo(W / 2 - cw / 2, y);
    g.moveTo(W / 2 + cw / 2, y);
    g.lineTo(W / 2 + cw / 2 + 12, y);
    g.stroke();
  }
}

function strokePoly(g, pts, from, to) {
  // zeichnet die Polylinie von Bogenlänge from bis to (für Blocker: Rest gedimmt)
  g.beginPath();
  let started = false;
  let acc = 0;
  for (let i = 1; i < pts.length; i++) {
    const ax = pts[i - 1][0];
    const ay = pts[i - 1][1];
    const bx = pts[i][0];
    const by = pts[i][1];
    const seg = Math.hypot(bx - ax, by - ay);
    const s0 = Math.max(from, acc);
    const s1 = Math.min(to, acc + seg);
    if (s1 > s0 && seg > 0) {
      const t0 = (s0 - acc) / seg;
      const t1 = (s1 - acc) / seg;
      if (!started) {
        g.moveTo(ax + (bx - ax) * t0, ay + (by - ay) * t0);
        started = true;
      }
      g.lineTo(ax + (bx - ax) * t1, ay + (by - ay) * t1);
    }
    acc += seg;
  }
  g.stroke();
}

function drawDiamond(g, x, y, r) {
  g.beginPath();
  g.moveTo(x, y - r);
  g.lineTo(x + r, y);
  g.lineTo(x, y + r);
  g.lineTo(x - r, y);
  g.closePath();
}

function drawBlocker(g, poly, d) {
  const a = pointAt(poly, Math.max(0, d - 4));
  const b = pointAt(poly, d + 4);
  const ang = Math.atan2(b.y - a.y, b.x - a.x) + Math.PI / 2;
  const p = pointAt(poly, d);
  g.save();
  g.strokeStyle = PAL.blocker;
  g.lineWidth = 9;
  g.beginPath();
  g.moveTo(p.x - Math.cos(ang) * 24, p.y - Math.sin(ang) * 24);
  g.lineTo(p.x + Math.cos(ang) * 24, p.y + Math.sin(ang) * 24);
  g.stroke();
  g.lineWidth = 3;
  g.beginPath();
  g.moveTo(p.x - 10, p.y - 10);
  g.lineTo(p.x + 10, p.y + 10);
  g.moveTo(p.x + 10, p.y - 10);
  g.lineTo(p.x - 10, p.y + 10);
  g.stroke();
  g.restore();
}

function drawTrace(g, tr) {
  const t = tr.team;
  g.lineCap = 'round';
  g.lineJoin = 'round';
  // Stamm
  const stemEnd = tr.stemBlockAt >= 0 ? tr.stemBlockAt : tr.stem.len;
  g.shadowColor = PAL.teamMid[t];
  g.shadowBlur = 14;
  g.strokeStyle = PAL.teamDim[t];
  g.lineWidth = 8;
  strokePoly(g, tr.stem.pts, 0, stemEnd);
  g.shadowBlur = 0;
  if (tr.stemBlockAt >= 0) {
    g.strokeStyle = PAL.traceDead;
    g.lineWidth = 5;
    strokePoly(g, tr.stem.pts, stemEnd, tr.stem.len);
  }
  // Äste
  tr.branches.forEach((b) => {
    const dead = tr.stemBlockAt >= 0;
    const end = b.blockAt >= 0 ? b.blockAt : b.poly.len;
    g.strokeStyle = dead ? PAL.traceDead : PAL.teamDim[t];
    g.lineWidth = dead ? 5 : 6;
    if (!dead) {
      g.shadowColor = PAL.teamMid[t];
      g.shadowBlur = 10;
    }
    strokePoly(g, b.poly.pts, 0, dead ? b.poly.len : end);
    g.shadowBlur = 0;
    if (!dead && b.blockAt >= 0) {
      g.strokeStyle = PAL.traceDead;
      g.lineWidth = 4;
      strokePoly(g, b.poly.pts, end, b.poly.len);
      drawBlocker(g, b.poly, b.blockAt);
    }
    if (b.ampAt >= 0) {
      const p = pointAt(b.poly, b.ampAt);
      g.fillStyle = '#000000';
      g.strokeStyle = PAL.amp;
      g.lineWidth = 4;
      drawDiamond(g, p.x, p.y, 17);
      g.fill();
      g.stroke();
      drawDiamond(g, p.x, p.y, 7);
      g.stroke();
    }
    // Lötauge am Feld
    const e = b.poly.pts[b.poly.pts.length - 1];
    g.fillStyle = dead || b.blockAt >= 0 ? PAL.traceDead : PAL.teamMid[t];
    g.beginPath();
    g.arc(e[0], e[1], 7, 0, Math.PI * 2);
    g.fill();
  });
  if (tr.stemBlockAt >= 0) drawBlocker(g, tr.stem, tr.stemBlockAt);
  // Splitter-Knoten
  const j = tr.stem.pts[tr.stem.pts.length - 1];
  if (tr.branches.length > 1) {
    g.fillStyle = '#000000';
    g.strokeStyle = tr.stemBlockAt >= 0 ? PAL.traceDead : PAL.teamMid[t];
    g.lineWidth = 4;
    g.beginPath();
    g.arc(j[0], j[1], 13, 0, Math.PI * 2);
    g.fill();
    g.stroke();
  }
  // Knicke als Vias
  g.fillStyle = PAL.teamDark[t];
  for (let i = 1; i < tr.stem.pts.length - 1; i++) {
    g.beginPath();
    g.arc(tr.stem.pts[i][0], tr.stem.pts[i][1], 6, 0, Math.PI * 2);
    g.fill();
  }
}

function ensureBoard() {
  ensurePalette();
  ensureLayout();
  ensureBackground();
  const key = palKey + '|' + layout.round;
  if (boardCanvas && boardKey === key) return;
  boardKey = key;
  boardCanvas = makeCanvas();
  const g = boardCanvas.getContext('2d');
  g.drawImage(bgCanvas, 0, 0);
  layout.traces[0].forEach((tr) => drawTrace(g, tr));
  layout.traces[1].forEach((tr) => drawTrace(g, tr));
  // Bahnanfänge neben den Pads abdunkeln – die Aktionsfläche bleibt dunkel
  for (let t = 0; t < 2; t++) {
    const x0 = t === 0 ? SETTINGS.traceStartX - 10 : W - SETTINGS.traceStartX + 10;
    const x1 = t === 0 ? x0 + 150 : x0 - 150;
    const gr = g.createLinearGradient(x0, 0, x1, 0);
    gr.addColorStop(0, 'rgba(0,0,0,0.75)');
    gr.addColorStop(1, 'rgba(0,0,0,0)');
    g.fillStyle = gr;
    g.fillRect(Math.min(x0, x1), 0, 150, H);
  }
}

// ---------------------------------------------------------------------------------------------------------
// Zeichnen
// ---------------------------------------------------------------------------------------------------------

function renderBoard(ctx) {
  ensureBoard();
  ctx.drawImage(boardCanvas, 0, 0);
}

function renderFields(ctx) {
  const fw = SETTINGS.fieldW;
  const fh = SETTINGS.fieldH;
  const x0 = W / 2 - fw / 2;
  ctx.save();
  fields.forEach((f, r) => {
    const y = rowY(r) - fh / 2;
    if (f.owner < 0) {
      ctx.fillStyle = PAL.neutral;
      ctx.fillRect(x0, y, fw, fh);
      ctx.strokeStyle = PAL.neutralEdge;
      ctx.lineWidth = 2;
      ctx.strokeRect(x0, y, fw, fh);
    } else {
      const frac = Math.max(0, Math.min(1, f.timer / f.max));
      const blink = f.timer < 1.5 ? 0.5 + 0.5 * Math.sin(STATE.time * 20) : 1;
      ctx.globalAlpha = (0.35 + 0.65 * frac) * blink;
      ctx.shadowColor = PAL.team[f.owner];
      ctx.shadowBlur = 20 + f.flash * 30;
      ctx.fillStyle = PAL.teamMid[f.owner];
      ctx.fillRect(x0, y, fw, fh);
      ctx.shadowBlur = 0;
      ctx.globalAlpha = 1;
      ctx.fillStyle = PAL.team[f.owner];
      ctx.fillRect(x0 + 8, y + fh - 12, (fw - 16) * frac, 6);
      ctx.strokeStyle = f.amp ? PAL.amp : PAL.team[f.owner];
      ctx.lineWidth = f.amp ? 5 : 3;
      ctx.strokeRect(x0, y, fw, fh);
      // Pfeil zur Besitzerseite
      ctx.fillStyle = '#000000';
      const ax = f.owner === 0 ? x0 + 22 : x0 + fw - 22;
      const dir = f.owner === 0 ? -1 : 1;
      ctx.beginPath();
      ctx.moveTo(ax + dir * 12, rowY(r) - 4);
      ctx.lineTo(ax - dir * 6, rowY(r) - 16);
      ctx.lineTo(ax - dir * 6, rowY(r) + 8);
      ctx.closePath();
      ctx.fill();
    }
    if (f.flash > 0) {
      ctx.globalAlpha = f.flash * 0.6;
      ctx.fillStyle = PAL.flash;
      ctx.fillRect(x0, y, fw, fh);
      ctx.globalAlpha = 1;
    }
    if (f.shortFx > 0) {
      ctx.strokeStyle = PAL.hot;
      ctx.lineWidth = 3;
      ctx.globalAlpha = f.shortFx;
      ctx.beginPath();
      let lx = x0 - 30;
      ctx.moveTo(lx, rowY(r));
      while (lx < x0 + fw + 30) {
        lx += 18;
        ctx.lineTo(lx, rowY(r) + (Math.random() - 0.5) * 50);
      }
      ctx.stroke();
      ctx.globalAlpha = 1;
    }
  });
  ctx.restore();
}

function renderAmps(ctx) {
  for (let t = 0; t < 2; t++) {
    const a = amps[t];
    if (!a.active) continue;
    const x = t === 0 ? SETTINGS.ampX : W - SETTINGS.ampX;
    const pulse = 0.7 + 0.3 * Math.sin(STATE.time * 6);
    ctx.save();
    ctx.fillStyle = '#000000';
    ctx.strokeStyle = PAL.amp;
    ctx.shadowColor = PAL.amp;
    ctx.shadowBlur = 16 * pulse;
    ctx.lineWidth = 4;
    drawDiamond(ctx, x, a.y, 20);
    ctx.fill();
    ctx.stroke();
    ctx.shadowBlur = 0;
    drawDiamond(ctx, x, a.y, 8 * pulse);
    ctx.stroke();
    ctx.restore();
  }
}

function renderPulses(ctx) {
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  pulses.forEach((p) => {
    const c = p.amp ? PAL.amp : PAL.team[p.team];
    for (let k = 5; k >= 0; k--) {
      const pos = pointAt(p.poly, p.dist - k * 13);
      ctx.globalAlpha = 1 - k / 6;
      ctx.fillStyle = c;
      ctx.beginPath();
      ctx.arc(pos.x, pos.y, (p.amp ? 13 : 10) - k, 0, Math.PI * 2);
      ctx.fill();
    }
  });
  ctx.restore();
  ctx.save();
  pulses.forEach((p) => {
    const pos = pointAt(p.poly, p.dist);
    ctx.shadowColor = p.amp ? PAL.amp : PAL.team[p.team];
    ctx.shadowBlur = 25;
    ctx.fillStyle = PAL.flash;
    ctx.beginPath();
    ctx.arc(pos.x, pos.y, 6, 0, Math.PI * 2);
    ctx.fill();
  });
  ctx.restore();
}

function renderPads(ctx, active) {
  ensurePads();
  const r = SETTINGS.padRadius;
  for (let t = 0; t < 2; t++) {
    for (let i = 0; i < SETTINGS.pads; i++) {
      const pad = pads[t][i];
      const x = padX(t);
      const y = padY(i);
      const empty = STATE.pulsesLeft[t] <= 0;
      ctx.save();
      // schwarz hinterlegt – Aktionsfläche
      ctx.fillStyle = '#000000';
      ctx.beginPath();
      ctx.arc(x, y, r + 14, 0, Math.PI * 2);
      ctx.fill();
      let edge = PAL.teamMid[t];
      let width = 4;
      if (pad.overheat > 0) {
        edge = Math.sin(STATE.time * 14) > 0 ? PAL.hot : PAL.hotDim;
        width = 6;
      } else if (!active || empty) {
        edge = PAL.teamDark[t];
        width = 3;
      } else if (pad.cooldown > 0) {
        edge = PAL.teamDim[t];
      }
      if (empty && active) ctx.setLineDash([10, 12]);
      ctx.strokeStyle = edge;
      ctx.lineWidth = width;
      ctx.beginPath();
      ctx.arc(x, y, r, 0, Math.PI * 2);
      ctx.stroke();
      ctx.setLineDash([]);
      // Füllstand als Bogen (nur Kontur)
      const v = Math.min(1, pad.btn.getValue() / 75);
      if (v > 0.01 && pad.overheat <= 0) {
        ctx.strokeStyle = PAL.team[t];
        ctx.lineWidth = 8;
        ctx.beginPath();
        ctx.arc(x, y, r - 10, -Math.PI / 2, -Math.PI / 2 + v * Math.PI * 2);
        ctx.stroke();
      }
      // Hitze als äusserer Bogen
      if (pad.heat > 1) {
        ctx.strokeStyle = PAL.hot;
        ctx.lineWidth = 7;
        ctx.beginPath();
        ctx.arc(x, y, r + 9, -Math.PI / 2, -Math.PI / 2 + (pad.heat / 100) * Math.PI * 2);
        ctx.stroke();
      }
      // Feuer-Ring
      if (pad.fired > 0) {
        ctx.globalAlpha = pad.fired * 0.7;
        ctx.strokeStyle = PAL.teamDim[t];
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.arc(x, y, r + 10 + (1 - pad.fired) * 40, 0, Math.PI * 2);
        ctx.stroke();
        ctx.globalAlpha = 1;
      }
      // Innen: kleines Sechseck + Tasten-Hinweis, gedimmt
      ctx.strokeStyle = pad.overheat > 0 ? PAL.hotDim : PAL.teamDark[t];
      ctx.lineWidth = 2;
      util.drawNgon({ ctx, color: ctx.strokeStyle, Xcenter: x, Ycenter: y, size: r * 0.42, numberOfSides: 6, lineWidth: 2 });
      if (pad.overheat > 0) {
        ctx.lineWidth = 4;
        ctx.strokeStyle = PAL.hotDim;
        ctx.beginPath();
        ctx.moveTo(x - 26, y - 26);
        ctx.lineTo(x + 26, y + 26);
        ctx.moveTo(x + 26, y - 26);
        ctx.lineTo(x - 26, y + 26);
        ctx.stroke();
        util.renderText({ ctx, text: String(Math.ceil(pad.overheat)), x, y: y + r - 14, fontSize: '22px', fillStyle: PAL.hotDim });
      } else {
        util.renderText({ ctx, text: SETTINGS.keyLabels[t][i], x, y: y + 9, fontSize: '24px', fillStyle: PAL.teamDark[t] });
      }
      ctx.restore();
    }
  }
}

function renderParticles(ctx) {
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  particles.forEach((p) => {
    ctx.globalAlpha = Math.max(0, p.life / p.max);
    ctx.fillStyle = p.color;
    ctx.fillRect(p.x - p.size / 2, p.y - p.size / 2, p.size, p.size);
  });
  ctx.restore();
  floaters.forEach((f) => {
    ctx.save();
    ctx.globalAlpha = Math.max(0, Math.min(1, f.life / 0.4));
    util.renderText({ ctx, text: f.text, x: f.x, y: f.y, fontSize: f.size + 'px', fillStyle: f.color });
    ctx.restore();
  });
}

function renderPulseReserve(ctx, t, x, y) {
  const n = STATE.pulsesLeft[t];
  const total = pulsesForRound(Math.max(1, STATE.round));
  const step = 22;
  const dir = t === 0 ? 1 : -1;
  ctx.save();
  for (let k = 0; k < total; k++) {
    ctx.fillStyle = k < n ? PAL.team[t] : PAL.teamDark[t];
    ctx.fillRect(x + dir * k * step - 7, y - 14, 14, 28);
  }
  ctx.restore();
}

function renderHud(ctx) {
  const c = countFields();
  // Zeit
  const tLeft = Math.max(0, STATE.roundTime);
  const warn = STATE.scene === 'game' && tLeft <= 5;
  util.renderText({
    ctx,
    text: tLeft.toFixed(STATE.scene === 'game' && tLeft < 10 ? 1 : 0) + ' s',
    x: W / 2,
    y: 72,
    fontSize: warn ? 60 + 8 * Math.abs(Math.sin(STATE.time * 6)) + 'px' : '56px',
    fillStyle: warn ? PAL.hot : PAL.hud,
  });
  util.renderText({ ctx, text: 'Runde ' + Math.max(1, STATE.round) + '   Siege ' + STATE.wins[0] + ' : ' + STATE.wins[1], x: W / 2, y: 118, fontSize: '30px', fillStyle: PAL.hudDim });
  // Felder je Team
  util.renderText({ ctx, text: String(c[0]), x: W / 2 - 220, y: 92, fontSize: '80px', fillStyle: PAL.team[0] });
  util.renderText({ ctx, text: String(c[1]), x: W / 2 + 220, y: 92, fontSize: '80px', fillStyle: PAL.team[1] });
  // Teams + Pulse
  util.renderText({ ctx, text: TEAM_NAMES[0] + '  Pulse ' + STATE.pulsesLeft[0], x: 330, y: 62, fontSize: '42px', fillStyle: PAL.teamMid[0], align: 'left' });
  util.renderText({ ctx, text: 'Pulse ' + STATE.pulsesLeft[1] + '  ' + TEAM_NAMES[1], x: W - 330, y: 62, fontSize: '42px', fillStyle: PAL.teamMid[1], align: 'right' });
  renderPulseReserve(ctx, 0, 340, 104);
  renderPulseReserve(ctx, 1, W - 340, 104);
  if (STATE.autoMode > 0) {
    util.renderText({ ctx, text: 'Autopilot: ' + AUTO_MODES[STATE.autoMode], x: W / 2, y: H - 8, fontSize: '24px', fillStyle: PAL.hudDim });
  }
}

function renderFlash(ctx, dt) {
  if (STATE.flash <= 0) return;
  ctx.save();
  ctx.globalAlpha = Math.min(0.3, STATE.flash * 0.35);
  ctx.fillStyle = STATE.flashColor || PAL.flash;
  ctx.fillRect(SETTINGS.padX + SETTINGS.padRadius + 30, 0, W - 2 * (SETTINGS.padX + SETTINGS.padRadius + 30), H);
  ctx.restore();
  STATE.flash -= dt;
}

function renderWorld(ctx, dt, active) {
  ctx.save();
  if (STATE.shake > 0) {
    ctx.translate((Math.random() - 0.5) * STATE.shake, (Math.random() - 0.5) * STATE.shake);
    STATE.shake = Math.max(0, STATE.shake - dt * 40);
  }
  renderBoard(ctx);
  renderAmps(ctx);
  renderFields(ctx);
  renderPulses(ctx);
  renderParticles(ctx);
  ctx.restore();
  renderPads(ctx, active); // Pads ohne Wackeln – ruhige Ziele
  renderHud(ctx);
  renderFlash(ctx, dt);
}

/** schwarzes Textfeld in der Mitte (über dem Chip) */
function renderPanel(ctx, y0, y1, alpha) {
  ctx.save();
  ctx.globalAlpha = 0.82 * (alpha === undefined ? 1 : alpha);
  ctx.fillStyle = '#000000';
  ctx.fillRect(W / 2 - 640, y0, 1280, y1 - y0);
  ctx.globalAlpha = 1;
  ctx.restore();
}

// ---------------------------------------------------------------------------------------------------------
// Szenen
// ---------------------------------------------------------------------------------------------------------

function handleTitle(grid, dt, ctx) {
  ensureLayout();
  ensureFields();
  // Demo: Pulse laufen von selbst über die Platine
  STATE.demoTimer -= dt;
  if (STATE.demoTimer <= 0) {
    STATE.demoTimer = 0.35 + Math.random() * 0.5;
    const t = Math.random() < 0.5 ? 0 : 1;
    spawnPulse(layout.traces[t][Math.floor(Math.random() * SETTINGS.pads)], t, true);
  }
  updatePulses(dt);
  updateFields(dt, false);
  updateParticles(dt);

  renderBoard(ctx);
  renderFields(ctx);
  renderPulses(ctx);
  renderParticles(ctx);

  renderPanel(ctx, 90, 380);
  renderTextDropShadow({ ctx, text: 'Platinen-Duell', x: W / 2, y: 230, fontSize: '150px', fillStyle: PAL.title });
  util.renderText({ ctx, text: 'Links gegen Rechts – Strom um die Mittelspalte', x: W / 2, y: 320, fontSize: '50px', fillStyle: PAL.sub });

  // Start-Knopf: schwarz hinterlegt
  ctx.save();
  ctx.fillStyle = '#000000';
  ctx.beginPath();
  ctx.arc(W / 2, H / 2 + 60, 165, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
  if (!startButton) startButton = makeButton('START', W / 2, H / 2 + 60, 130, () => startMatch());
  startButton.handle(grid, dt);

  renderPanel(ctx, 770, 1000);
  util.renderText({
    ctx,
    text: 'Eure Saalhälfte = euer Team. Pads am eigenen Rand kurz füllen → Puls.\nWer am Rundenende mehr Felder hält, gewinnt. Pulse sind knapp!\nNach dem Feuern loslassen – Dauerlicht lässt Pads ÜBERHITZEN.',
    x: W / 2,
    y: 830,
    fontSize: '38px',
    lineHeight: 58,
    fillStyle: PAL.hud,
  });
  highscore.renderHighAndLowScores(ctx);
  if (keyEdge('Space')) startMatch();
}

function handleGame(grid, dt, ctx) {
  STATE.roundTime -= dt;
  if (keyEdge(SETTINGS.autoKey)) STATE.autoMode = (STATE.autoMode + 1) % AUTO_MODES.length;
  updateBots(dt);
  updatePads(grid, dt, true);
  updateAmps(dt);
  updatePulses(dt);
  updateFields(dt, true);
  updateShorts(dt);
  updateParticles(dt);

  // Countdown-Ticks
  const sec = Math.ceil(STATE.roundTime);
  if (sec <= 5 && sec >= 1 && sec !== STATE.lastTick) {
    STATE.lastTick = sec;
    playSound(soundTick, 0.6);
  }

  renderWorld(ctx, dt, true);
  if (STATE.roundTime > DIFFICULTY.roundTime - 1.2) {
    util.renderText({ ctx, text: 'LOS!', x: W / 2, y: H / 2 + 30, fontSize: '140px', fillStyle: PAL.title });
  }

  if (STATE.scene === 'game' && (STATE.roundTime <= 0 || keyEdge(SETTINGS.nextKey))) endRound();
}

function handleLevelUp(grid, dt, ctx) {
  if (keyEdge(SETTINGS.autoKey)) STATE.autoMode = (STATE.autoMode + 1) % AUTO_MODES.length;
  updatePads(grid, dt, false);
  updateAmps(dt);
  updatePulses(dt);
  updateFields(STATE.phase === 'intro' ? dt : 0, false);
  updateParticles(dt);
  renderWorld(ctx, dt, false);

  if (STATE.phase === 'result') {
    const res = STATE.lastResult;
    renderPanel(ctx, 330, 750);
    const head = res && res.winner >= 0 ? TEAM_NAMES[res.winner] + ' holt Runde ' + res.round + '!' : 'Runde ' + (res ? res.round : STATE.round) + ': Unentschieden';
    const s = 1 + Math.max(0, 0.4 - STATE.sceneTime) * 1.5;
    ctx.save();
    ctx.translate(W / 2, 480);
    ctx.scale(s, s);
    renderTextDropShadow({ ctx, text: head, x: 0, y: 0, fontSize: '100px', fillStyle: res && res.winner >= 0 ? PAL.team[res.winner] : PAL.title });
    ctx.restore();
    util.renderText({
      ctx,
      text: 'Felder ' + (res ? res.counts[0] + ' : ' + res.counts[1] : '-') + '      Siege ' + STATE.wins[0] + ' : ' + STATE.wins[1],
      x: W / 2,
      y: 600,
      fontSize: '56px',
      fillStyle: PAL.sub,
    });
    if (STATE.matchOver) util.renderText({ ctx, text: 'Das Duell ist entschieden ...', x: W / 2, y: 690, fontSize: '44px', fillStyle: PAL.hud });
    if (STATE.sceneTime >= SETTINGS.resultDuration) {
      if (STATE.matchOver) finish();
      else beginIntro();
    }
    return;
  }

  // Intro der nächsten Runde: erst Ansage, dann Text ausblenden und die neue Platine lesen lassen
  const dur = STATE.round === 1 ? SETTINGS.firstIntroDuration : SETTINGS.introDuration;
  const textTime = SETTINGS.introTextTime + (STATE.round === 1 ? 0.6 : 0);
  const fade = STATE.sceneTime < textTime ? 1 : Math.max(0, 1 - (STATE.sceneTime - textTime) / 0.5);
  if (fade > 0) {
    renderPanel(ctx, 340, 720, fade);
    ctx.save();
    ctx.globalAlpha = fade;
    const s = 1 + Math.max(0, 0.4 - STATE.sceneTime) * 1.5;
    ctx.save();
    ctx.translate(W / 2, 480);
    ctx.scale(s, s);
    renderTextDropShadow({ ctx, text: 'RUNDE ' + STATE.round, x: 0, y: 0, fontSize: '150px', fillStyle: PAL.title });
    ctx.restore();
    util.renderText({ ctx, text: ROUND_NEWS[STATE.round] || 'Weiter so!', x: W / 2, y: 580, fontSize: '46px', lineHeight: 60, fillStyle: PAL.sub });
    util.renderText({
      ctx,
      text: 'Pulse je Team: ' + STATE.pulsesLeft[0] + '   ·   Haltezeit ' + holdTime().toFixed(1) + ' s',
      x: W / 2,
      y: 700,
      fontSize: '34px',
      fillStyle: PAL.hudDim,
    });
    ctx.restore();
  }
  if (fade < 1) {
    ctx.save();
    ctx.globalAlpha = 0.7 * (1 - fade);
    renderTextDropShadow({ ctx, text: String(Math.max(1, Math.ceil(dur - STATE.sceneTime))), x: W / 2, y: H / 2 + 80, fontSize: '220px', fillStyle: PAL.title });
    ctx.restore();
    util.renderText({ ctx, text: 'Platine lesen ...', x: W / 2, y: H / 2 + 170, fontSize: '40px', fillStyle: PAL.hud });
  }
  if (STATE.sceneTime >= dur) {
    setScene('game');
    STATE.flash = 0.6;
    STATE.flashColor = PAL.flash;
  }
}

function handleGameOver(grid, dt, ctx) {
  ensureLayout();
  ensureFields();
  updatePulses(dt);
  updateFields(dt, false);
  updateParticles(dt);
  renderBoard(ctx);
  renderFields(ctx);
  renderParticles(ctx);

  renderPanel(ctx, 60, 690);
  const w = STATE.matchWinner;
  renderTextDropShadow({
    ctx,
    text: w >= 0 ? TEAM_NAMES[w] + ' gewinnt!' : 'Unentschieden!',
    x: W / 2,
    y: 200,
    fontSize: '130px',
    fillStyle: w >= 0 ? PAL.team[w] : PAL.title,
  });
  util.renderText({
    ctx,
    text: 'Siege ' + STATE.wins[0] + ' : ' + STATE.wins[1] + ' nach ' + STATE.round + ' Runden' + (STATE.newHighscore ? '   – NEUER HIGHSCORE!' : ''),
    x: W / 2,
    y: 300,
    fontSize: '48px',
    fillStyle: PAL.sub,
  });
  // Statistik in zwei Spalten
  const rows = [
    ['Feldsekunden', Math.round(STATS.fieldSeconds[0]), Math.round(STATS.fieldSeconds[1])],
    ['Pulse gefeuert', STATS.pulsesFired[0], STATS.pulsesFired[1]],
    ['Felder gekapert', STATS.steals[0], STATS.steals[1]],
    ['Überhitzt', STATS.overheats[0], STATS.overheats[1]],
    ['Verpufft / Blocker', STATS.fizzled[0] + STATS.blocked[0], STATS.fizzled[1] + STATS.blocked[1]],
  ];
  const cx = 270;
  util.renderText({ ctx, text: TEAM_NAMES[0], x: W / 2 - cx, y: 375, fontSize: '42px', fillStyle: PAL.team[0] });
  util.renderText({ ctx, text: TEAM_NAMES[1], x: W / 2 + cx, y: 375, fontSize: '42px', fillStyle: PAL.team[1] });
  rows.forEach((r, k) => {
    const y = 430 + k * 50;
    util.renderText({ ctx, text: r[0], x: W / 2, y, fontSize: '34px', fillStyle: PAL.hudDim });
    util.renderText({ ctx, text: String(r[1]), x: W / 2 - cx, y, fontSize: '40px', fillStyle: PAL.teamMid[0] });
    util.renderText({ ctx, text: String(r[2]), x: W / 2 + cx, y, fontSize: '40px', fillStyle: PAL.teamMid[1] });
  });
  highscore.renderHighAndLowScores(ctx);

  if (STATE.sceneTime > SETTINGS.againDelay) {
    ctx.save();
    ctx.fillStyle = '#000000';
    ctx.beginPath();
    ctx.arc(W / 2, 930, 125, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
    if (!againButton) againButton = makeButton('NOCHMAL', W / 2, 930, 100, () => startMatch());
    againButton.handle(grid, dt);
    if (keyEdge('Space')) startMatch();
  } else {
    keyEdge('Space'); // Flanke verbrauchen, damit ein gehaltenes Space nicht sofort neu startet
  }
}

// ---------------------------------------------------------------------------------------------------------
// Export
// ---------------------------------------------------------------------------------------------------------

export default {
  name: 'Platinen-Duell',
  description: `
  Links gegen Rechts – Strom um die Mittelspalte!

  Eure Saalhälfte ist euer Team. Am eigenen Bildrand liegen 6 Pads.
  Pad kurz füllen → ein Strompuls läuft die Leiterbahn entlang
  und färbt Schaltfelder in der Mitte für ein paar Sekunden.

  Pulse sind knapp! Wer am Rundenende mehr Felder hält, gewinnt.
  Nach dem Feuern sofort loslassen – Dauerlicht lässt Pads ÜBERHITZEN
  und die Pulse verpuffen. Genau das könnt ihr dem Gegner antun ...
  `,
  image: 'media/img/gametitles/laser-basefight-###4###.png',

  init: function () {
    resetAll();
  },

  handle: function (grid, elapsed) {
    const dt = Math.min(elapsed || 0, 0.1);
    const ctx = MasterCanvas.get2dContext();
    ensurePalette();
    STATE.time += dt;
    STATE.sceneTime += dt;

    switch (STATE.scene) {
      case 'title':
        handleTitle(grid, dt, ctx);
        break;
      case 'game':
        handleGame(grid, dt, ctx);
        break;
      case 'levelup':
        handleLevelUp(grid, dt, ctx);
        break;
      case 'gameover':
        handleGameOver(grid, dt, ctx);
        break;
      default:
        setScene('title');
    }
  },

  stop: function () {
    stopMusic();
  },
};
