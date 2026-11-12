/**
 * Laser-Groovebox
 *
 * Das Publikum komponiert gemeinsam Musik: ein Step-Sequencer mit 16 Schritten (Spalten)
 * und 6 Spuren (Zeilen: Bassdrum, Snare, HiHat, Bass, Akkord, Melodie).
 * - jede Zelle ist ein gui/pixelFillButton: wer lange genug draufleuchtet, schaltet sie an bzw. aus
 *   (Füllzeit + Sperrzeit pro Zelle, damit wildes Herumleuchten nur Chaos erzeugt)
 * - eine Abspielleiste läuft von links nach rechts, aktive Zellen erklingen und pulsieren
 * - Bass, Akkord und Melodie spielen immer in einer pentatonischen Tonleiter: es klingt nie schief
 *
 * Zwei Modi:
 * 1. Freies Jammen: endlos, Regler-Buttons für Tempo, Tonart, Zufallsmuster und Löschen.
 * 2. Rhythmus-Challenge: ein Zielmuster wird 2 Takte lang vorgespielt und angezeigt, dann ausgeblendet.
 *    Das Publikum baut es nach, die Übereinstimmung (gemeinsame Noten / alle Noten) wird live angezeigt.
 *    Ab DIFFICULTY.matchToWin ist die Runde gewonnen, Punkte nach Restzeit, Muster werden pro Level
 *    komplexer. "Nochmal hören" kostet Punkte. Nach DIFFICULTY.maxMissed verpassten Runden ist Schluss.
 *
 * Audio: tone (package-lock: 0.10.0). Statt Tone.Transport läuft ein eigener Lookahead-Scheduler im
 * handle()-Loop (Noten werden ~150 ms im Voraus auf die Audio-Uhr gelegt) - so laufen Ton und Grafik
 * synchron und auf dem Intro-Screen bzw. nach stop() spielt garantiert nichts weiter.
 * Ohne laufenden AudioContext (Browser blockiert bis zur ersten Geste) läuft die Grafik mit der
 * Systemuhr weiter, ein Hinweis fordert zum Tastendruck auf.
 *
 * Tastatur: 1/Leertaste = Jammen, 2 = Challenge, Z = Zufallsmuster, C = Löschen,
 * Pfeil hoch/runter = Tempo, K = Tonart, N = Nochmal hören, Enter = Zielmuster setzen (Debug),
 * Escape = Menü.
 *
 * Alle Stellschrauben stehen gesammelt in DIFFICULTY.
 */

import util, { getRgbSpreadHex } from '../util.js';
var laserConfig = require('../LaserApiConfig.js').default;
var MasterCanvas = require('../MasterCanvas').default;
var guiFillButton = require('./gui/fillButton').default;
var guiPixelFillButton = require('./gui/pixelFillButton').default;
var Tone = require('tone');

const DIFFICULTY = {
  // Zellen umschalten: Füllzeit in Sekunden bei toggleFullPercent Bedeckung der Zelle
  toggleFillTime: 0.9,
  toggleFullPercent: 15, // ein einzelner Laserpunkt bedeckt etwa 10% einer Zelle
  toggleDecay: 80, // Abbau in Prozentpunkten pro Sekunde ohne Laser
  toggleLockTime: 1.5, // Sperrzeit nach dem Umschalten
  // Regler-Buttons (Füllzeit in Sekunden)
  controlFillTime: 0.8,
  clearFillTime: 4,
  menuFillTime: 2.5,
  startFillTime: 1.5,
  replayFillTime: 1.2,
  // Freies Jammen
  jamBpmStart: 110,
  jamBpmMin: 70,
  jamBpmMax: 160,
  jamBpmStep: 10,
  randomNotes: 22,
  // Rhythmus-Challenge
  challengeBpmStart: 96,
  challengeBpmPerLevel: 4,
  challengeBpmMax: 128,
  listenBars: 2, // so viele Takte wird das Zielmuster vorgespielt
  tracksStart: 1, // Anzahl Spuren im Zielmuster auf Level 1
  tracksPerLevel: 1,
  notesStart: 4,
  notesPerLevel: 2,
  notesMax: 24,
  matchToWin: 85, // Prozent Übereinstimmung (gemeinsame Noten / alle gesetzten Noten)
  roundTimeStart: 60,
  roundTimePerLevel: 6,
  roundTimeMax: 120,
  pointsPerLevel: 100,
  pointsPerSecond: 10,
  replayCost: 50,
  maxMissed: 3,
  resultTime: 4.5, // Sekunden Ergebnisanzeige nach einer Runde
};

const W = 1920;
const H = 1080;
const STEPS = 16;
const T_KICK = 0;
const T_SNARE = 1;
const T_HAT = 2;
const T_BASS = 3;
const T_CHORD = 4;
const T_MELODY = 5;
const TRACKS = [
  { name: 'Kick', hue: 0.2 },
  { name: 'Snare', hue: 0.3 },
  { name: 'HiHat', hue: 0.4 },
  { name: 'Bass', hue: 0.55 },
  { name: 'Akkord', hue: 0.67 },
  { name: 'Melodie', hue: 0.8 },
];
// Reihenfolge, in der die Challenge neue Spuren dazunimmt
const TRACK_INTRO_ORDER = [T_KICK, T_HAT, T_SNARE, T_BASS, T_MELODY, T_CHORD];

// Layout: links Spurnamen, oben HUD, unten Regler
const GRID_LEFT = 150;
const GRID_TOP = 120;
const GRID_BOTTOM = 900;
const COL_W = (W - GRID_LEFT - 10) / STEPS; // 110 px
const ROW_H = (GRID_BOTTOM - GRID_TOP) / TRACKS.length; // 130 px
const CELL_R = Math.floor(Math.min(COL_W, ROW_H) / 2) - 1; // 54 px
const CELL_HALF = CELL_R * Math.SQRT1_2; // halbe Kantenlänge des Quadrats im Kreis
const CONTROL_Y = 995;
const CONTROL_R = 72;
const LOOKAHEAD = 0.15; // Sekunden, so weit im Voraus werden Noten geplant
const MAX_RINGS = 60;

// Musik: pentatonische Tonleitern, Tonhöhe ergibt sich aus der Spalte
const SCALES = { major: [0, 2, 4, 7, 9], minor: [0, 3, 5, 7, 10] };
const CHORD_SHAPES = { major: [0, 2, 3], minor: [0, 1, 3] };
const KEYS = [
  { name: 'C-Dur', root: 0, mode: 'major' },
  { name: 'A-Moll', root: -3, mode: 'minor' },
  { name: 'G-Dur', root: -5, mode: 'major' },
  { name: 'E-Moll', root: 4, mode: 'minor' },
  { name: 'D-Dur', root: 2, mode: 'major' },
  { name: 'F-Moll', root: 5, mode: 'minor' },
];
const BASS_DEG = [0, 0, 5, 0, 3, 3, 3, 4, 0, 0, 5, 0, 2, 2, 3, 4];
const CHORD_DEG = [0, 0, 0, 0, 0, 0, 0, 0, 3, 3, 3, 3, 1, 1, 1, 1];
const MELODY_DEG = [5, 7, 8, 7, 5, 4, 5, 7, 9, 8, 7, 5, 4, 3, 4, 2];

const KEY_CODES = [
  'Space',
  'Digit1',
  'Digit2',
  'Enter',
  'KeyZ',
  'KeyC',
  'KeyK',
  'KeyN',
  'ArrowUp',
  'ArrowDown',
  'Escape',
];

var gameState = 'menu'; // menu | play | gameover
var mode = 'jam'; // jam | challenge
var phase = 'build'; // Challenge: listen | build | won | lost
var lastTime = 0;
var clockTime = 0;
var colors = null;
var cells = [];
var target = [];
var lockUntil = [];
var pulse = [];
var cellButtons = [];
var controls = [];
var menuButtons = [];
var gameOverButtons = [];
var rings = [];
var snareFlash = 0;
var menuRingTimer = 0;
var prevKeys = {};
var bpm = DIFFICULTY.jamBpmStart;
var keyIndex = 0;

// Challenge-Zustand
var level = 1;
var missed = 0;
var score = 0;
var roundsWon = 0;
var bestTime = null;
var replays = 0;
var roundTimeTotal = 0;
var roundTimeLeft = 0;
var phaseTimer = 0;
var lastRoundPoints = 0;
var listenStepsSeen = 0;
var replayActive = false;
var currentMatch = 0;

// Sequencer-Zustand
var seq = {
  step: 0,
  nextTime: 0,
  queue: [],
  clockAudio: false,
  currentStep: -1,
  targetStepsLeft: 0,
};

// Audio-Zustand
var synths = null;
var audioFailed = false;
var audioRetryTimer = 0;
const isModernTone = typeof Tone.start === 'function';

/* ---------------------------------------------------------------- Hilfsfunktionen */

function getDelta() {
  var currentTime = performance.now();
  if (lastTime === 0) {
    lastTime = currentTime;
    return 0;
  }
  const elapsed = (currentTime - lastTime) / 1000;
  lastTime = currentTime;
  // gegen Sprünge nach Tab-Inaktivität
  return Math.min(elapsed, 0.1);
}

function colX(step) {
  return GRID_LEFT + COL_W * (step + 0.5);
}

function rowY(track) {
  return GRID_TOP + ROW_H * (track + 0.5);
}

function emptyPattern(value = false) {
  return TRACKS.map(() => new Array(STEPS).fill(value));
}

function copyPattern(pattern) {
  return pattern.map((row) => row.slice());
}

function countNotes(pattern) {
  let n = 0;
  pattern.forEach((row) => row.forEach((on) => (n += on ? 1 : 0)));
  return n;
}

/** Übereinstimmung in Prozent: gemeinsame Noten / alle gesetzten Noten (zu viel UND zu wenig zählt) */
function computeMatch() {
  let inter = 0;
  let union = 0;
  for (let t = 0; t < TRACKS.length; t++) {
    for (let s = 0; s < STEPS; s++) {
      const a = cells[t][s];
      const b = target[t][s];
      if (a && b) inter++;
      if (a || b) union++;
    }
  }
  return union > 0 ? (inter / union) * 100 : 0;
}

function levelValue(start, perLevel, cap) {
  return Math.min(cap, start + perLevel * (level - 1));
}

/** alle Farben einmal aus der Laserfarbe ableiten (nie die Laserfarbe selbst) */
function createColors() {
  const tc = laserConfig.testColor;
  return {
    off: TRACKS.map((tr) => getRgbSpreadHex(tc, tr.hue, 0.7, 0.35)),
    offBright: TRACKS.map((tr) => getRgbSpreadHex(tc, tr.hue, 0.7, 0.6)),
    on: TRACKS.map((tr) => getRgbSpreadHex(tc, tr.hue, 0.8, 0.9)),
    flash: TRACKS.map((tr) => getRgbSpreadHex(tc, tr.hue, 0.3, 1)),
    grow: TRACKS.map((tr) => getRgbSpreadHex(tc, tr.hue, 0.15, 1)),
    locked: TRACKS.map((tr) => getRgbSpreadHex(tc, tr.hue, 0.2, 0.25)),
    ui: getRgbSpreadHex(tc, 0.5, 0.6, 0.95),
    uiDim: getRgbSpreadHex(tc, 0.5, 0.5, 0.4),
    warn: getRgbSpreadHex(tc, 0.12, 0.8, 1),
    playhead: getRgbSpreadHex(tc, 0.5, 0.3, 0.6),
    good: getRgbSpreadHex(tc, 0.35, 0.8, 1),
  };
}

/* ---------------------------------------------------------------- Musterzeugung */

/** Wahrscheinlichkeitsgewicht einer Note: betonte Zählzeiten sind wahrscheinlicher (gut merkbar) */
function stepWeight(t, s) {
  const beat = s % 4 === 0;
  const even = s % 2 === 0;
  switch (t) {
    case T_KICK:
      return beat ? 6 : even ? 2 : 1;
    case T_SNARE:
      return s % 8 === 4 ? 8 : even ? 1.5 : 0.7;
    case T_HAT:
      return even ? 4 : 1.5;
    case T_BASS:
      return beat ? 3 : even ? 2 : 1;
    case T_CHORD:
      return s % 8 === 0 ? 5 : beat ? 2 : 0.5;
    default:
      return even ? 2 : 1;
  }
}

function pickWeighted(candidates, filter) {
  let total = 0;
  candidates.forEach((c) => {
    if (!filter || filter(c)) total += c.w;
  });
  if (total <= 0) return null;
  let r = Math.random() * total;
  for (let i = 0; i < candidates.length; i++) {
    const c = candidates[i];
    if (filter && !filter(c)) continue;
    r -= c.w;
    if (r <= 0) {
      candidates.splice(i, 1);
      return c;
    }
  }
  return null;
}

/** Zufallsmuster über die gegebenen Spuren, jede Spur bekommt mindestens eine Note */
function generatePattern(trackList, noteCount) {
  const pattern = emptyPattern();
  const candidates = [];
  trackList.forEach((t) => {
    for (let s = 0; s < STEPS; s++) candidates.push({ t, s, w: stepWeight(t, s) });
  });
  let placed = 0;
  trackList.forEach((t) => {
    const c = pickWeighted(candidates, (x) => x.t === t);
    if (c) {
      pattern[c.t][c.s] = true;
      placed++;
    }
  });
  while (placed < noteCount && candidates.length) {
    const c = pickWeighted(candidates);
    if (!c) break;
    pattern[c.t][c.s] = true;
    placed++;
  }
  return pattern;
}

function starterPattern() {
  const pattern = emptyPattern();
  for (let s = 0; s < STEPS; s += 4) {
    pattern[T_KICK][s] = true;
    pattern[T_HAT][s + 2] = true;
  }
  return pattern;
}

/* ---------------------------------------------------------------- Audio (tone) */

function rawContext() {
  const c = Tone.context;
  if (!c) return null;
  return c.rawContext || c._context || c;
}

function audioRunning() {
  const r = rawContext();
  return !audioFailed && !!synths && !!r && r.state === 'running';
}

/** AudioContext starten - klappt erst nach einer Nutzer-Geste (Klick/Taste) */
function tryStartAudio() {
  try {
    createSynths();
    if (isModernTone) {
      const p = Tone.start();
      if (p && p.catch) p.catch(() => {});
    } else {
      const r = rawContext();
      if (r && r.state !== 'running' && r.resume) {
        const p = r.resume();
        if (p && p.catch) p.catch(() => {});
      }
    }
  } catch (e) {
    console.warn('Groovebox: Audio-Start fehlgeschlagen', e);
  }
}

function toOut(node) {
  return node.toDestination ? node.toDestination() : node.toMaster();
}

function createSynths() {
  if (synths || audioFailed) return;
  try {
    const kick = toOut(
      new Tone.MembraneSynth({
        pitchDecay: 0.04,
        octaves: 6,
        envelope: { attack: 0.001, decay: 0.35, sustain: 0, release: 0.1 },
      })
    );
    kick.volume.value = -4;
    const snare = toOut(
      new Tone.NoiseSynth({
        noise: { type: 'white' },
        envelope: { attack: 0.001, decay: 0.16, sustain: 0 },
      })
    );
    snare.volume.value = -14;
    const hatIsMetal = !!Tone.MetalSynth;
    const hat = hatIsMetal
      ? toOut(
          new Tone.MetalSynth({
            frequency: 250,
            envelope: { attack: 0.001, decay: 0.06, release: 0.02 },
            harmonicity: 5.1,
            modulationIndex: 32,
            resonance: 5000,
            octaves: 1.5,
          })
        )
      : toOut(
          new Tone.NoiseSynth({
            noise: { type: 'pink' },
            envelope: { attack: 0.001, decay: 0.04, sustain: 0 },
          })
        );
    hat.volume.value = -24;
    const bass = toOut(
      new Tone.MonoSynth({
        oscillator: { type: 'square' },
        filter: { Q: 2, type: 'lowpass' },
        envelope: { attack: 0.005, decay: 0.2, sustain: 0.4, release: 0.3 },
        filterEnvelope: {
          attack: 0.001,
          decay: 0.2,
          sustain: 0.3,
          release: 0.3,
          baseFrequency: 200,
          octaves: 2.5,
        },
      })
    );
    bass.volume.value = -12;
    // drei einzelne Synths statt PolySynth (dessen Konstruktor unterscheidet sich zwischen tone-Versionen)
    const chord = [0, 1, 2].map(() => {
      const s = toOut(
        new Tone.Synth({
          oscillator: { type: 'triangle' },
          envelope: { attack: 0.04, decay: 0.3, sustain: 0.5, release: 0.8 },
        })
      );
      s.volume.value = -20;
      return s;
    });
    const melody = toOut(
      new Tone.Synth({
        oscillator: { type: 'triangle' },
        envelope: { attack: 0.005, decay: 0.15, sustain: 0.2, release: 0.3 },
      })
    );
    melody.volume.value = -12;
    synths = { kick, snare, hat, hatIsMetal, bass, chord, melody };
  } catch (e) {
    console.warn('Groovebox: Synths konnten nicht erzeugt werden', e);
    audioFailed = true;
    synths = null;
  }
}

function disposeSynths() {
  if (!synths) return;
  [synths.kick, synths.snare, synths.hat, synths.bass, synths.melody]
    .concat(synths.chord)
    .forEach((node) => {
      try {
        node.dispose();
      } catch (e) {
        // ignorieren, Node ist evtl. schon weg
      }
    });
  synths = null;
}

function midiToFreq(m) {
  return 440 * Math.pow(2, (m - 69) / 12);
}

/** Tonleiterstufe -> MIDI-Note in der aktuellen Tonart */
function degToMidi(base, deg) {
  const key = KEYS[keyIndex];
  const scale = SCALES[key.mode];
  const octave = Math.floor(deg / scale.length);
  return base + key.root + 12 * octave + scale[deg - scale.length * octave];
}

function stepDuration() {
  return 60 / bpm / 4;
}

function playNote(t, step, time) {
  if (!synths) return;
  const d = stepDuration();
  try {
    switch (t) {
      case T_KICK:
        synths.kick.triggerAttackRelease(55, 0.3, time);
        break;
      case T_SNARE:
        synths.snare.triggerAttackRelease(0.15, time);
        break;
      case T_HAT:
        // MetalSynth: ab tone 14 mit Note als erstem Parameter
        if (synths.hatIsMetal && isModernTone) {
          synths.hat.triggerAttackRelease(250, 0.05, time, 0.6);
        } else {
          synths.hat.triggerAttackRelease(0.05, time, 0.6);
        }
        break;
      case T_BASS:
        synths.bass.triggerAttackRelease(midiToFreq(degToMidi(36, BASS_DEG[step])), d * 0.9, time);
        break;
      case T_CHORD: {
        const shape = CHORD_SHAPES[KEYS[keyIndex].mode];
        shape.forEach((off, i) => {
          synths.chord[i].triggerAttackRelease(
            midiToFreq(degToMidi(48, CHORD_DEG[step] + off)),
            d * 1.8,
            time
          );
        });
        break;
      }
      case T_MELODY:
        synths.melody.triggerAttackRelease(
          midiToFreq(degToMidi(60, MELODY_DEG[step])),
          d * 0.8,
          time
        );
        break;
    }
  } catch (e) {
    // z. B. Zeitkonflikt bei monophonen Synths - einzelne Note auslassen
  }
}

/* ---------------------------------------------------------------- Sequencer */

function clockNow() {
  if (audioRunning()) return rawContext().currentTime;
  return performance.now() / 1000;
}

/** Sequencer ab Schritt 0 neu ansetzen (verwirft geplante Grafik-Ereignisse) */
function restartSequencer() {
  seq.queue = [];
  seq.step = 0;
  seq.nextTime = 0;
}

function scheduleStep(step, time, withSound) {
  let pattern = cells;
  let fromTarget = false;
  let hidden = false;
  if (mode === 'challenge') {
    if (phase === 'won' || phase === 'lost') {
      pattern = target;
      fromTarget = true;
    } else if (seq.targetStepsLeft > 0) {
      seq.targetStepsLeft--;
      pattern = target;
      fromTarget = true;
      hidden = phase === 'build'; // "Nochmal hören": nur Ton, Zellen nicht verraten
    }
  }
  const notes = new Array(TRACKS.length);
  for (let t = 0; t < TRACKS.length; t++) {
    notes[t] = pattern[t][step];
    if (notes[t] && withSound) playNote(t, step, time);
  }
  seq.queue.push({ step, time, notes, fromTarget, hidden });
}

function runSequencer() {
  const running = audioRunning();
  if (running !== seq.clockAudio) {
    // Uhr gewechselt (Audio ist angesprungen): Zeiten neu ansetzen
    seq.clockAudio = running;
    seq.queue = [];
    seq.nextTime = 0;
  }
  const now = clockNow();
  if (seq.nextTime < now) seq.nextTime = now + 0.05;
  const dur = stepDuration();
  let guard = 0;
  while (seq.nextTime < now + LOOKAHEAD && guard++ < STEPS) {
    scheduleStep(seq.step, seq.nextTime, running);
    seq.step = (seq.step + 1) % STEPS;
    seq.nextTime += dur;
  }
  while (seq.queue.length && seq.queue[0].time <= now) {
    onVisualStep(seq.queue.shift());
  }
}

/** wird aufgerufen, wenn ein geplanter Schritt tatsächlich erklingt */
function onVisualStep(e) {
  seq.currentStep = e.step;
  if (mode === 'challenge') {
    if (phase === 'listen') {
      if (e.fromTarget) listenStepsSeen++;
      else startBuildPhase();
    } else if (phase === 'build' && replayActive && !e.fromTarget) {
      replayActive = false;
    }
  }
  for (let t = 0; t < TRACKS.length; t++) {
    if (!e.notes[t]) continue;
    if (!e.hidden) {
      pulse[t][e.step] = 1;
      spawnRing(colX(e.step), rowY(t), CELL_R * 0.8, CELL_R * 1.9, 0.45, colors.on[t], 4);
    }
  }
  if (e.notes[T_KICK]) {
    spawnRing(
      GRID_LEFT + (W - GRID_LEFT) / 2,
      (GRID_TOP + GRID_BOTTOM) / 2,
      60,
      1000,
      0.9,
      colors.off[T_KICK],
      16
    );
  }
  if (e.notes[T_SNARE]) snareFlash = 1;
}

/* ---------------------------------------------------------------- Visualisierung */

function spawnRing(x, y, r0, r1, duration, color, width) {
  if (rings.length >= MAX_RINGS) rings.shift();
  rings.push({ x, y, r0, r1, duration, color, width, time: 0 });
}

function renderBackground(ctx, dt) {
  if (snareFlash > 0) {
    ctx.save();
    ctx.globalAlpha = 0.12 * snareFlash;
    ctx.fillStyle = colors.off[T_SNARE];
    ctx.fillRect(0, 0, W, H);
    ctx.restore();
    snareFlash = Math.max(0, snareFlash - dt * 5);
  }
  ctx.save();
  for (let i = rings.length - 1; i >= 0; i--) {
    const r = rings[i];
    r.time += dt;
    if (r.time >= r.duration) {
      rings.splice(i, 1);
      continue;
    }
    const p = r.time / r.duration;
    ctx.globalAlpha = 1 - p;
    ctx.strokeStyle = r.color;
    ctx.lineWidth = r.width * (1 - p * 0.5);
    ctx.beginPath();
    ctx.arc(r.x, r.y, r.r0 + (r.r1 - r.r0) * p, 0, Math.PI * 2);
    ctx.stroke();
  }
  ctx.restore();
}

function renderPlayhead(ctx) {
  ctx.save();
  // Taktviertel-Trenner
  ctx.strokeStyle = colors.uiDim;
  ctx.lineWidth = 2;
  ctx.beginPath();
  for (let s = 4; s < STEPS; s += 4) {
    const x = GRID_LEFT + COL_W * s;
    ctx.moveTo(x, GRID_TOP + 10);
    ctx.lineTo(x, GRID_BOTTOM - 10);
  }
  ctx.stroke();
  if (seq.currentStep >= 0) {
    ctx.globalAlpha = replayActive ? 0.35 : 0.22;
    ctx.fillStyle = replayActive ? colors.warn : colors.playhead;
    const x = GRID_LEFT + COL_W * seq.currentStep;
    ctx.fillRect(x + 3, GRID_TOP, COL_W - 6, GRID_BOTTOM - GRID_TOP);
  }
  ctx.restore();
}

function renderTrackLabels(ctx, highlightTracks) {
  for (let t = 0; t < TRACKS.length; t++) {
    const bright = !highlightTracks || highlightTracks[t];
    util.renderText({
      ctx,
      text: TRACKS[t].name,
      fontSize: '32px',
      align: 'left',
      fillStyle: bright ? colors.on[t] : colors.locked[t],
      x: 10,
      y: rowY(t) + 11,
    });
  }
}

/**
 * zeichnet die Füllungen des Musters und (wenn interactive) die Zell-Buttons, die das Grid prüfen.
 * ghost: optionales zweites Muster, das als Umriss darübergelegt wird (Lösung anzeigen)
 */
function renderCells(ctx, pattern, interactive, grid, dt, ghost) {
  for (let t = 0; t < TRACKS.length; t++) {
    for (let s = 0; s < STEPS; s++) {
      const x = colX(s);
      const y = rowY(t);
      const p = pulse[t][s];
      if (p > 0) pulse[t][s] = Math.max(0, p - dt * 4);
      if (pattern[t][s]) {
        const h = CELL_HALF * (0.85 + 0.25 * p);
        ctx.fillStyle = p > 0.4 ? colors.flash[t] : colors.on[t];
        ctx.fillRect(x - h, y - h, h * 2, h * 2);
      }
      if (interactive) {
        cellButtons[t][s].handle(grid, dt);
      } else {
        ctx.strokeStyle = s === seq.currentStep ? colors.offBright[t] : colors.off[t];
        ctx.lineWidth = 4;
        ctx.strokeRect(x - CELL_HALF, y - CELL_HALF, CELL_HALF * 2, CELL_HALF * 2);
      }
      if (ghost && ghost[t][s]) {
        const g = CELL_HALF * 1.18;
        ctx.strokeStyle = colors.flash[t];
        ctx.lineWidth = 6;
        ctx.strokeRect(x - g, y - g, g * 2, g * 2);
      }
    }
  }
}

/* ---------------------------------------------------------------- Zellen & Buttons */

function toggleCell(t, s) {
  cells[t][s] = !cells[t][s];
  lockUntil[t][s] = clockTime + DIFFICULTY.toggleLockTime;
  pulse[t][s] = 1;
  spawnRing(colX(s), rowY(t), CELL_R, CELL_R * 2.5, 0.6, colors.flash[t], 6);
  tryStartAudio();
  // Vorhören beim Einschalten
  if (cells[t][s] && audioRunning()) playNote(t, s, rawContext().currentTime + 0.02);
}

function createCellButtons() {
  cellButtons = TRACKS.map((track, t) =>
    new Array(STEPS).fill(0).map((_, s) => {
      const cell = guiPixelFillButton({
        label: '',
        posX: colX(s),
        posY: rowY(t),
        radius: CELL_R,
        edges: 4,
        angle: Math.PI / 4,
        lineWidth: 4,
        fullPercent: DIFFICULTY.toggleFullPercent,
        speedUp: 100 / DIFFICULTY.toggleFillTime,
        speedDown: DIFFICULTY.toggleDecay,
        counterReset: true,
        activeValue: 99,
        minValue: 3,
        normalColor: colors.off[t],
        growColor: colors.grow[t],
        activeColor: colors.flash[t],
        onEnterActive: () => toggleCell(t, s),
      });
      const handleOriginal = cell.handle;
      cell.handle = (grid, elapsed) => {
        const locked = lockUntil[t][s] > clockTime;
        // gesperrte Zellen können sich nicht füllen
        if (locked) cell.setValue(0);
        cell.setColor(
          locked ? colors.locked[t] : s === seq.currentStep ? colors.offBright[t] : colors.off[t]
        );
        handleOriginal(grid, elapsed);
      };
      return cell;
    })
  );
}

function resetCellCounters() {
  cellButtons.forEach((row) => row.forEach((cell) => cell.setValue(0)));
}

/** Regler-Button mit eigener, großer Beschriftung (kein keyCode, Tastatur läuft separat) */
function createControl({
  x,
  y = CONTROL_Y,
  radius = CONTROL_R,
  label,
  hue,
  fillTime,
  onTrigger,
  fontSize = 32,
}) {
  const tc = laserConfig.testColor;
  const btn = guiFillButton({
    label: '',
    posX: x,
    posY: y,
    radius,
    edges: 8,
    angle: Math.PI / 8,
    speedUp: 90 / fillTime,
    speedDown: 40,
    counterReset: true,
    activeValue: 90,
    minValue: 10,
    normalColor: getRgbSpreadHex(tc, hue, 0.7, 0.5),
    growColor: getRgbSpreadHex(tc, hue, 0.6, 0.85),
    activeColor: getRgbSpreadHex(tc, hue, 0.3, 1),
    onEnterActive: () => {
      tryStartAudio();
      onTrigger();
    },
  });
  const textColor = getRgbSpreadHex(tc, hue, 0.4, 1);
  const handleOriginal = btn.handle;
  btn.handle = (grid, elapsed) => {
    handleOriginal(grid, elapsed);
    const text = typeof label === 'function' ? label() : label;
    const lines = text.split('\n').length;
    const lineHeight = fontSize + 4;
    util.renderTextDropShadow({
      ctx: MasterCanvas.get2dContext(),
      text,
      fontSize: fontSize + 'px',
      lineHeight,
      dropDistX: 3,
      dropDistY: 3,
      fillStyle: textColor,
      x,
      y: y + fontSize * 0.35 - ((lines - 1) * lineHeight) / 2,
    });
  };
  return btn;
}

function changeTempo(delta) {
  bpm = Math.max(DIFFICULTY.jamBpmMin, Math.min(DIFFICULTY.jamBpmMax, bpm + delta));
}

function nextKey() {
  keyIndex = (keyIndex + 1) % KEYS.length;
}

function randomizeJam() {
  cells = generatePattern(
    TRACKS.map((_, t) => t),
    DIFFICULTY.randomNotes
  );
}

function clearCells() {
  cells = emptyPattern();
}

function createJamControls() {
  const fill = DIFFICULTY.controlFillTime;
  return [
    createControl({
      x: 260,
      label: 'Tempo -',
      hue: 0.3,
      fillTime: fill,
      onTrigger: () => changeTempo(-DIFFICULTY.jamBpmStep),
    }),
    createControl({
      x: 540,
      label: 'Tempo +',
      hue: 0.3,
      fillTime: fill,
      onTrigger: () => changeTempo(DIFFICULTY.jamBpmStep),
    }),
    createControl({ x: 820, label: 'Tonart', hue: 0.6, fillTime: fill, onTrigger: nextKey }),
    createControl({
      x: 1100,
      label: 'Zufall',
      hue: 0.45,
      fillTime: fill * 1.5,
      onTrigger: randomizeJam,
    }),
    createControl({
      x: 1380,
      label: 'Alles\nlöschen',
      hue: 0.15,
      fillTime: DIFFICULTY.clearFillTime,
      onTrigger: clearCells,
    }),
    createControl({
      x: 1700,
      label: 'Menü',
      hue: 0.75,
      fillTime: DIFFICULTY.menuFillTime,
      onTrigger: goToMenu,
    }),
  ];
}

function createChallengeControls() {
  return [
    createControl({
      x: 1300,
      label: () => `Nochmal\nhören -${DIFFICULTY.replayCost}`,
      hue: 0.45,
      fillTime: DIFFICULTY.replayFillTime,
      fontSize: 28,
      onTrigger: requestReplay,
    }),
    createControl({
      x: 1700,
      label: 'Menü',
      hue: 0.75,
      fillTime: DIFFICULTY.menuFillTime,
      onTrigger: goToMenu,
    }),
  ];
}

function createMenuButtons() {
  return [
    createControl({
      x: 560,
      y: 640,
      radius: 170,
      label: 'Freies\nJammen',
      hue: 0.35,
      fillTime: DIFFICULTY.startFillTime,
      fontSize: 50,
      onTrigger: startJam,
    }),
    createControl({
      x: 1360,
      y: 640,
      radius: 170,
      label: 'Rhythmus-\nChallenge',
      hue: 0.65,
      fillTime: DIFFICULTY.startFillTime,
      fontSize: 50,
      onTrigger: startChallenge,
    }),
  ];
}

function createGameOverButtons() {
  return [
    createControl({
      x: W / 2,
      y: 840,
      radius: 150,
      label: 'Zum Menü',
      hue: 0.5,
      fillTime: DIFFICULTY.startFillTime,
      fontSize: 46,
      onTrigger: goToMenu,
    }),
  ];
}

/* ---------------------------------------------------------------- Zustände */

function resetBoard() {
  cells = emptyPattern();
  target = emptyPattern();
  lockUntil = TRACKS.map(() => new Array(STEPS).fill(0));
  pulse = TRACKS.map(() => new Array(STEPS).fill(0));
  rings = [];
  snareFlash = 0;
  seq.currentStep = -1;
  seq.targetStepsLeft = 0;
  replayActive = false;
  restartSequencer();
}

function goToMenu() {
  gameState = 'menu';
  resetBoard();
  menuButtons = createMenuButtons();
}

function startJam() {
  colors = createColors();
  createCellButtons();
  resetBoard();
  mode = 'jam';
  phase = 'build';
  gameState = 'play';
  bpm = DIFFICULTY.jamBpmStart;
  cells = starterPattern();
  controls = createJamControls();
}

function startChallenge() {
  colors = createColors();
  createCellButtons();
  resetBoard();
  mode = 'challenge';
  gameState = 'play';
  level = 1;
  missed = 0;
  score = 0;
  roundsWon = 0;
  bestTime = null;
  replays = 0;
  controls = createChallengeControls();
  startRound();
}

function tracksForLevel() {
  const count = Math.floor(
    levelValue(DIFFICULTY.tracksStart, DIFFICULTY.tracksPerLevel, TRACKS.length)
  );
  return TRACK_INTRO_ORDER.slice(0, count);
}

function startRound() {
  const trackList = tracksForLevel();
  const notes = Math.max(
    trackList.length,
    levelValue(DIFFICULTY.notesStart, DIFFICULTY.notesPerLevel, DIFFICULTY.notesMax)
  );
  target = generatePattern(trackList, notes);
  clearCells();
  lockUntil = TRACKS.map(() => new Array(STEPS).fill(0));
  resetCellCounters();
  bpm = levelValue(
    DIFFICULTY.challengeBpmStart,
    DIFFICULTY.challengeBpmPerLevel,
    DIFFICULTY.challengeBpmMax
  );
  roundTimeTotal = levelValue(
    DIFFICULTY.roundTimeStart,
    DIFFICULTY.roundTimePerLevel,
    DIFFICULTY.roundTimeMax
  );
  roundTimeLeft = roundTimeTotal;
  currentMatch = 0;
  replayActive = false;
  phase = 'listen';
  listenStepsSeen = 0;
  seq.targetStepsLeft = STEPS * DIFFICULTY.listenBars;
  restartSequencer();
}

function startBuildPhase() {
  phase = 'build';
  resetCellCounters();
}

function requestReplay() {
  if (mode !== 'challenge' || phase !== 'build' || replayActive) return;
  score = Math.max(0, score - DIFFICULTY.replayCost);
  replays++;
  replayActive = true;
  seq.targetStepsLeft = STEPS * DIFFICULTY.listenBars;
  restartSequencer();
}

function finishRound(won) {
  phase = won ? 'won' : 'lost';
  phaseTimer = DIFFICULTY.resultTime;
  replayActive = false;
  seq.targetStepsLeft = 0;
  if (won) {
    lastRoundPoints =
      DIFFICULTY.pointsPerLevel * level + Math.round(roundTimeLeft * DIFFICULTY.pointsPerSecond);
    score += lastRoundPoints;
    roundsWon++;
    const used = roundTimeTotal - roundTimeLeft;
    bestTime = bestTime === null ? used : Math.min(bestTime, used);
  } else {
    missed++;
  }
  restartSequencer();
}

function updateChallenge(dt) {
  if (phase === 'build') {
    roundTimeLeft = Math.max(0, roundTimeLeft - dt);
    currentMatch = computeMatch();
    if (currentMatch >= DIFFICULTY.matchToWin) {
      finishRound(true);
    } else if (roundTimeLeft <= 0) {
      finishRound(false);
    }
  } else if (phase === 'won' || phase === 'lost') {
    phaseTimer -= dt;
    if (phaseTimer <= 0) {
      if (phase === 'lost' && missed >= DIFFICULTY.maxMissed) {
        gameState = 'gameover';
        gameOverButtons = createGameOverButtons();
        return;
      }
      if (phase === 'won') level++;
      startRound();
    }
  }
}

/* ---------------------------------------------------------------- Tastatur */

/** liefert die Tasten, die in diesem Frame neu gedrückt wurden (Flanke) */
function readKeyFlanks() {
  const flanks = {};
  let any = false;
  KEY_CODES.forEach((code) => {
    const down = !!laserConfig.pressedKeys[code];
    if (down && !prevKeys[code]) {
      flanks[code] = true;
      any = true;
    }
    prevKeys[code] = down;
  });
  if (any) tryStartAudio();
  return flanks;
}

function handleKeyboard(k) {
  if (gameState === 'menu') {
    if (k.Space || k.Digit1) startJam();
    else if (k.Digit2) startChallenge();
    return;
  }
  if (gameState === 'gameover') {
    if (k.Space) goToMenu();
    return;
  }
  if (k.Escape) {
    goToMenu();
    return;
  }
  if (mode === 'jam') {
    if (k.KeyZ) randomizeJam();
    if (k.KeyC) clearCells();
    if (k.KeyK) nextKey();
    if (k.ArrowUp) changeTempo(DIFFICULTY.jamBpmStep);
    if (k.ArrowDown) changeTempo(-DIFFICULTY.jamBpmStep);
  } else {
    if (k.KeyN) requestReplay();
    // Debug: Zielmuster sofort korrekt setzen
    if (k.Enter && phase === 'build') cells = copyPattern(target);
  }
}

/* ---------------------------------------------------------------- HUD */

function hudText(ctx, text, x, align, fillStyle, fontSize = '46px') {
  util.renderTextDropShadow({
    ctx,
    text,
    fontSize,
    align,
    dropDistX: 4,
    dropDistY: 4,
    fillStyle,
    x,
    y: 72,
  });
}

function renderAudioHint(ctx) {
  if (audioRunning()) return;
  util.renderText({
    ctx,
    text: audioFailed
      ? 'Audio nicht verfügbar - nur Grafik'
      : 'Kein Ton? Einmal eine Taste drücken oder ins Bild klicken.',
    fontSize: '28px',
    fillStyle: colors.warn,
    x: GRID_LEFT + (W - GRID_LEFT) / 2,
    y: 112,
  });
}

function renderJamHud(ctx) {
  hudText(ctx, 'Freies Jammen', 20, 'left', colors.ui);
  hudText(ctx, `Tempo ${bpm} BPM`, W / 2, 'center', colors.ui);
  hudText(ctx, `Tonart: ${KEYS[keyIndex].name}`, W - 20, 'right', colors.ui);
  renderAudioHint(ctx);
}

function renderChallengeHud(ctx) {
  hudText(ctx, `Level ${level}   ${score} Punkte`, 20, 'left', colors.ui, '44px');
  if (phase === 'listen') {
    const bar = Math.min(DIFFICULTY.listenBars, Math.floor(listenStepsSeen / STEPS) + 1);
    const text = `Zuhören! Takt ${bar}/${DIFFICULTY.listenBars}`;
    hudText(ctx, text, W / 2 + 120, 'center', colors.warn);
  } else if (phase === 'won') {
    hudText(ctx, `Geschafft! +${lastRoundPoints} Punkte`, W / 2 + 120, 'center', colors.good);
  } else if (phase === 'lost') {
    hudText(ctx, 'Zeit um! So klang es:', W / 2 + 120, 'center', colors.warn);
  } else {
    const text = replayActive ? 'Zielmuster läuft ...' : `${Math.floor(currentMatch)} % Treffer`;
    hudText(ctx, text, W / 2 + 60, 'center', replayActive ? colors.warn : colors.ui);
  }
  const lives = DIFFICULTY.maxMissed - missed;
  const timeColor = roundTimeLeft < 10 ? colors.warn : colors.ui;
  const timeText = `Zeit ${Math.ceil(roundTimeLeft)} s   Leben ${lives}`;
  hudText(ctx, timeText, W - 20, 'right', timeColor, '44px');

  // Übereinstimmungs-Balken mit Ziellinie
  if (phase === 'build' || phase === 'won') {
    const x0 = GRID_LEFT;
    const x1 = W - 10;
    ctx.save();
    ctx.fillStyle = colors.uiDim;
    ctx.fillRect(x0, 98, x1 - x0, 12);
    ctx.fillStyle = phase === 'won' ? colors.good : colors.ui;
    ctx.fillRect(x0, 98, ((x1 - x0) * Math.min(100, currentMatch)) / 100, 12);
    const xm = x0 + ((x1 - x0) * DIFFICULTY.matchToWin) / 100;
    ctx.fillStyle = colors.warn;
    ctx.fillRect(xm - 3, 90, 6, 28);
    ctx.restore();
  } else {
    renderAudioHint(ctx);
  }

  const used = {};
  let trackCount = 0;
  TRACKS.forEach((_, t) => {
    if (target[t].some((on) => on)) {
      used[t] = true;
      trackCount++;
    }
  });
  util.renderTextDropShadow({
    ctx,
    text: `Ziel: ${countNotes(target)} Noten\nin ${trackCount} Spur${trackCount === 1 ? '' : 'en'}`,
    fontSize: '38px',
    lineHeight: 46,
    align: 'left',
    dropDistX: 3,
    dropDistY: 3,
    fillStyle: colors.ui,
    x: 20,
    y: 980,
  });
  return used;
}

/* ---------------------------------------------------------------- Spiel-Export */

export default {
  name: 'Laser-Groovebox',
  description: `
Die Laser-Groovebox: Ihr macht gemeinsam Musik!
16 Schritte, 6 Spuren: Kick, Snare, HiHat, Bass, Akkord, Melodie.
Leuchtet auf ein Feld, bis es sich füllt - dann schaltet es an oder aus.
Die Abspielleiste läuft durch, alle hellen Felder erklingen. Es klingt nie schief!

Freies Jammen: endlos, unten Tempo, Tonart, Zufall, Löschen (lange halten).
Rhythmus-Challenge: ein Muster wird vorgespielt und kurz gezeigt -
baut es aus dem Gedächtnis nach! Ab ${DIFFICULTY.matchToWin} % Treffer ist die Runde gewonnen,
Restzeit bringt Punkte, "Nochmal hören" kostet ${DIFFICULTY.replayCost}. ${DIFFICULTY.maxMissed} verpasste Runden = Ende.

Tipp: Jede Gruppe übernimmt eine Spur. Wildes Herumleuchten bringt nur Chaos.`,

  image: 'media/img/gametitles/laser-flapping-###4###.png',

  init: function () {
    console.log('init game groovebox');
    lastTime = 0;
    clockTime = 0;
    keyIndex = 0;
    bpm = DIFFICULTY.jamBpmStart;
    audioFailed = false;
    colors = createColors();
    createCellButtons();
    // gehaltene Tasten beim Spielwechsel nicht als neuen Druck werten
    prevKeys = {};
    KEY_CODES.forEach((code) => (prevKeys[code] = !!laserConfig.pressedKeys[code]));
    goToMenu();
    createSynths();
  },

  handle: function (grid) {
    const dt = getDelta();
    clockTime += dt;
    if (!colors) colors = createColors();

    // Audio-Start immer wieder versuchen, bis der Browser ihn erlaubt
    audioRetryTimer -= dt;
    if (audioRetryTimer <= 0 && !audioRunning() && !audioFailed) {
      audioRetryTimer = 1;
      tryStartAudio();
    }

    handleKeyboard(readKeyFlanks());

    switch (gameState) {
      case 'menu':
        this.handleMenuScreen(grid, dt);
        break;
      case 'play':
        this.handlePlayScreen(grid, dt);
        break;
      case 'gameover':
        this.handleGameOverScreen(grid, dt);
        break;
    }
  },

  handleMenuScreen(grid, dt) {
    const ctx = MasterCanvas.get2dContext();
    // ruhige Deko-Ringe im Hintergrund
    menuRingTimer -= dt;
    if (menuRingTimer <= 0) {
      menuRingTimer = 0.35;
      const t = Math.floor(Math.random() * TRACKS.length);
      const r1 = 200 + Math.random() * 200;
      spawnRing(Math.random() * W, Math.random() * H, 20, r1, 1.6, colors.off[t], 6);
    }
    renderBackground(ctx, dt);
    menuButtons.forEach((btn) => btn.handle(grid, dt));
    util.renderTextDropShadow({
      ctx,
      text: 'Laser-Groovebox',
      fontSize: '150px',
      fillStyle: colors.ui,
      x: W / 2,
      y: 200,
    });
    util.renderTextDropShadow({
      ctx,
      text: 'Gemeinsam Musik machen - jede Gruppe übernimmt eine Spur!',
      fontSize: '45px',
      dropDistX: 4,
      dropDistY: 4,
      fillStyle: colors.on[T_MELODY],
      x: W / 2,
      y: 310,
    });
    util.renderTextDropShadow({
      ctx,
      text: 'endlos, mit Reglern',
      fontSize: '40px',
      dropDistX: 3,
      dropDistY: 3,
      fillStyle: colors.on[T_HAT],
      x: 560,
      y: 880,
    });
    util.renderTextDropShadow({
      ctx,
      text: 'Muster nachbauen, Punkte',
      fontSize: '40px',
      dropDistX: 3,
      dropDistY: 3,
      fillStyle: colors.on[T_CHORD],
      x: 1360,
      y: 880,
    });
    util.renderText({
      ctx,
      text: 'Tastatur: Leertaste/1 = Jammen, 2 = Challenge',
      fontSize: '30px',
      fillStyle: colors.uiDim,
      x: W / 2,
      y: 1040,
    });
  },

  handlePlayScreen(grid, dt) {
    const ctx = MasterCanvas.get2dContext();
    runSequencer();
    if (gameState !== 'play') return;
    if (mode === 'challenge') updateChallenge(dt);
    if (gameState !== 'play') return;

    renderBackground(ctx, dt);
    renderPlayhead(ctx);

    if (mode === 'jam') {
      renderTrackLabels(ctx);
      renderCells(ctx, cells, true, grid, dt);
      renderJamHud(ctx);
    } else {
      const used = renderChallengeHud(ctx);
      if (phase === 'listen') {
        renderTrackLabels(ctx, used);
        renderCells(ctx, target, false, grid, dt);
      } else if (phase === 'build') {
        renderTrackLabels(ctx, used);
        renderCells(ctx, cells, true, grid, dt);
      } else {
        // Ergebnis: eigenes Muster gefüllt, Lösung als Umriss
        renderTrackLabels(ctx, used);
        renderCells(ctx, cells, false, grid, dt, target);
      }
    }
    controls.slice().forEach((btn) => btn.handle(grid, dt));
  },

  handleGameOverScreen(grid, dt) {
    const ctx = MasterCanvas.get2dContext();
    renderBackground(ctx, dt);
    gameOverButtons.forEach((btn) => btn.handle(grid, dt));
    util.renderTextDropShadow({
      ctx,
      text: 'Laser-Groovebox',
      fontSize: '150px',
      fillStyle: colors.ui,
      x: W / 2,
      y: 200,
    });
    util.renderTextDropShadow({
      ctx,
      text: `Die Band hat sich aufgelöst!
${roundsWon} ${roundsWon === 1 ? 'Runde' : 'Runden'} geschafft, Level ${level} erreicht.
Beste Zeit: ${bestTime === null ? '-' : bestTime.toFixed(1) + ' s'}   Nochmal gehört: ${replays}x
Gesamtpunkte: ${score}`,
      fontSize: '45px',
      lineHeight: 70,
      dropDistX: 5,
      dropDistY: 5,
      fillStyle: colors.on[T_MELODY],
      x: W / 2,
      y: 350,
    });
    util.renderText({
      ctx,
      text: 'Leertaste = Menü',
      fontSize: '30px',
      fillStyle: colors.uiDim,
      x: W / 2,
      y: 1040,
    });
  },

  stop: function () {
    // nichts läuft über Tone.Transport - Sequencer anhalten und Synths freigeben
    gameState = 'menu';
    seq.queue = [];
    seq.targetStepsLeft = 0;
    try {
      if (Tone.Transport && Tone.Transport.state === 'started') Tone.Transport.stop();
    } catch (e) {
      // ignorieren
    }
    disposeSynths();
    rings = [];
  },
};
