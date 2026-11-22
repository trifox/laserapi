/**
 * Domination – Kästchen-Eroberung (Spielidee: Georg)
 *
 * Jede Mitspielerin / jeder Mitspieler hat ein Kästchen mit seiner Laserpointer-Nummer (1 … Anzahl). Jedes Kästchen
 * hat vier PFEILE (Felder an jeder Seite). Ein Counter zählt herunter. Im Moment, in dem er NULL erreicht, wird
 * ausgewertet, welche Pfeile gerade von einem Laser markiert sind:
 *
 * Regeln der Auswertung (gleichzeitig, auf Basis der Besitzverhältnisse VOR der Runde):
 * - Ein markierter Pfeil von Kästchen s (Reich A) auf das Nachbarkästchen t ist ein Expansionsversuch.
 *   Pfeile ins Leere (Kartenrand, leerer Platz) oder auf ein Kästchen des eigenen Reichs zählen nicht.
 * - Ist in t der Pfeil markiert, der genau zurück auf s zeigt, canceln sich beide Pfeile.
 * - Zeigen danach noch ungeblockte Pfeile aus GENAU EINEM Reich auf t, wird t von diesem Reich erobert.
 *   Zeigen Pfeile aus zwei oder mehr verschiedenen Reichen auf t, blockieren sie sich – t bleibt, wie es ist.
 *   Beispiel Georg: L und R zeigen auf X, X zeigt auf L → L und X canceln sich, R erobert X.
 * - Feintuning (nicht in Georgs Text): Zwei Kästchen DESSELBEN Reichs, die beide auf t zeigen, blockieren
 *   sich NICHT, sie zählen als ein Angriff (sie gehören ja zusammen). Konstante SAME_EMPIRE_BLOCKS unten
 *   auf true setzen, falls auch das blockieren soll.
 * - Ein Reich expandiert aus JEDEM seiner Kästchen (Ursprung oder erobert).
 * - Wird ein Ursprungskästchen erobert, wechselt NUR dieses Kästchen den Besitzer. Der Rest des Reichs bleibt
 *   beim alten Besitzer, der weiterspielt.
 * - Mehrere Laser auf demselben Pfeil = ein markierter Pfeil. Jede/r darf jeden Pfeil markieren.
 *   Laser sind ohnehin nicht unterscheidbar – das Spiel kennt nur „Pfeil markiert / nicht markiert“.
 * - Markiert gilt ein Pfeil, wenn in den letzten ~0,3 s ein Laser darauf war (überbrückt Flackern).
 *   Markierte Pfeile leuchten live auf, damit man sieht, was man gerade markiert.
 *
 * Spielende: Ein Reich besitzt alle Kästchen, ODER 4 Runden hintereinander ohne jede Besitzänderung.
 * Dann gewinnt das größte Reich, bei Gleichstand ist es ein geteilter Sieg.
 *
 * KI-Spieler (auf dem Startbildschirm zuschaltbar):
 * - Jedes ursprüngliche KI-Kästchen bringt pro Runde EINEN KI-Laser für den, dem dieses Kästchen gerade gehört.
 *   Erobert eine KI eine andere KI, markiert sie also zweimal; eine eroberte KI markiert für ihren Eroberer
 *   (auch für einen Menschen).
 * - Die KI wählt sofort beim Start des Counters und ändert ihre Wahl nicht mehr. Ihr künstlicher Laser ist
 *   als Ring mit „KI“ auf dem Pfeil zu sehen. Heuristik: schwache/kleine Nachbarn bevorzugt, KI-Kästchen
 *   und das eigene verlorene Ursprungskästchen sind wertvoll, Kästchen, auf die schon viele Reiche zeigen
 *   könnten (umkämpft), werden gemieden, dazu etwas Zufall. Nie zweimal derselbe Pfeil, nie zwei KI-Laser
 *   desselben Reichs auf dasselbe Ziel.
 *
 * Georgs offene Fragen:
 * 1. Macht KI Sinn? – Sie ist auf dem Startbildschirm von 0 bis (60 − Menschen) einstellbar, also einfach
 *    ausprobieren. Erwartung: Mit wenigen Menschen füllt sie die Karte und erzeugt Konflikte; mit vielen
 *    Menschen eher weglassen. Da sie sofort festlegt, können Menschen auf ihre Ringe reagieren (z. B. den
 *    Gegenpfeil markieren, um sie zu blocken) – das ist gewollt und macht sie berechenbar.
 * 2. Sind 60 Kästchen lesbar/bedienbar? – 60 Kästchen werden als 10×6 angeordnet: Zelle ca. 190×160 px,
 *    Kästchen ca. 150 px. Jeder Pfeil ist ein Trapez mit ca. 4.500 px² Fläche. Bei einer Kamera-Auflösung von
 *    64×64 Zellen (30×17 px pro Zelle) sind das ca. 9 Grid-Zellen pro Pfeil, bei 128er Auflösung ca. 35 –
 *    das reicht zum Treffen. Die Nummer (ca. 45 px) ist aus der Mitte des Saals lesbar, von hinten wird es
 *    knapp. Bedienbar ja, aber Zielen braucht etwas Ruhe; der Counter sollte bei 60 Spielern eher lang sein.
 *    Mit ≤ 30 Spielern (z. B. 6×5) wird alles deutlich größer.
 *
 * Wie sich eroberte Spieler verhalten (Absprachen, Laser abgeben …) regelt das Spiel bewusst nicht.
 *
 * Licht-Disziplin (Überarbeitung): Kästchen und Pfeile sind Aktionsflächen → schwarz hinterlegt, nur konturiert.
 * Ein markierter Pfeil zeigt sich durch dicke, helle Kontur + Doppel-Chevron statt heller Füllung, damit die
 * Kamera Laser auch auf bereits markierten Pfeilen sicher erkennt. Keine Lichtpunkte im Hintergrund, Reichsfarben
 * als Tönung nur mit Helligkeit ≤ 0.12. Pfeilfläche vergrößert (Zahlenfeld kleiner, Kästchen 90 % der Zelle).
 * Farben: nur Farbton 0.25 … 0.75 (Komplement der Laserfarbe); 60 Spielerfarben unterscheiden sich daher
 * zusätzlich über drei Sättigungs- und zwei Helligkeitsstufen.
 *
 * Highscore: größtes Reich (Kästchen) am Spielende, mit Runden und Spielerzahl – wie früher die Tafel im
 * Automaten: wer sich nicht einträgt, war nie da.
 *
 * Klassiker: Am nächsten ist „Diplomacy“ (1959, Brettspiel; Computerfassungen u. a. für C64/Amiga/PC ab 1984):
 * Alle Befehle werden GLEICHZEITIG ausgewertet, gleich starke
 * Angriffe auf ein Feld blockieren sich (Standoff), gegenläufige Züge canceln sich. Georgs Regeln sind im Kern
 * ein Diplomacy-Standoff ohne Unterstützungsbefehle. Ähnlichkeiten im Bestand: game-059-kolonieauktion und
 * game-047-wuerfelreiche (Gebiete/Reiche erobern); neu hier: rundensimultane Auswertung per Pfeil-Markierung.
 *
 * Interferenz: Rundenbasiert und jede/r darf jeden Pfeil markieren – Stören (Gegenpfeil markieren, fremde
 * Pfeile auf eigene Kästchen setzen) ist ausdrücklich Teil des Spiels, wie bei Diplomacy wird verhandelt.
 *
 * One-Pixel-Netzwerk: Ein Pfeil gilt als markiert, sobald irgendeine Zelle darin leuchtet – ein einzelnes
 * Netz-Pixel reicht also. Bei sehr vielen Pixeln bleibt die Regel gleich (markiert/nicht markiert), Skalierung
 * ist unkritisch: pro Pfeil eine gecachte Zellenliste (regionButton), Auswertung O(Kästchen).
 *
 * Tastatur (Spielleiter):
 *   Startbildschirm: Pfeil hoch/runter = Menschen ±1, Pfeil links/rechts = Counter-Zeit, J/K = KI −/+,
 *                    Leertaste oder Enter = Start
 *   Im Spiel:        Leertaste oder Enter = Counter sofort auslösen, Escape = zurück zum Startbildschirm,
 *                    1 2 3 4 = (Test) Pfeil oben/rechts/unten/links in ALLEN Kästchen markieren (gedrückt halten)
 *   Spielende:       Leertaste/Enter = Nochmal mit denselben Einstellungen, Escape = Startbildschirm
 *   (d v g r m h t f F s, PageUp/PageDown/Home sind in view.js Debug-Tasten und hier bewusst frei)
 */

import util, { getRgbSpreadHex } from '../util.js';
import { createKeyEdge, isKeyDown } from './gui/gridScan.js';
import soundPlop from '../../../public/media/369952__mischy__plop-1.wav';
import soundStomp from '../../../public/media/517267__foolboymedia__cinematic-stomp.wav';
var laserConfig = require('../LaserApiConfig.js').default;
var MasterCanvas = require('../MasterCanvas').default;
var guiFillButton = require('./gui/fillButton-ai2').default;
var guiRegionButton = require('./gui/regionButton').default;
var createHighscore = require('../util/highscore').default;

const W = 1920;
const H = 1080;
const HUD_H = 110; // Höhe der Kopfleiste
const MAX_BOXES = 60;
const TIMER_STEPS = [10, 15, 20, 30, 45, 60, 90, 120, 180, 240, 300, 420, 600];
const NUMBER_FIELD = 0.19; // halbe Kantenlänge des Zahlenfelds relativ zur Kästchengröße (Rest = Pfeilfläche)
const SAME_EMPIRE_BLOCKS = false; // true: auch zwei Kästchen desselben Reichs blockieren sich auf einem Ziel

const SETTINGS = {
  holdTime: 0.3, // so lange gilt ein Pfeil nach dem letzten Laserkontakt noch als markiert
  resultDuration: 2.8, // Anzeige der Auswertung
  noChangeRoundsToEnd: 4,
  maxParticles: 400,
  arrowMinPercent: 0, // Mindest-Flächenanteil (%) im Pfeil, damit er als markiert gilt
};

// Richtungen: 0 = oben, 1 = rechts, 2 = unten, 3 = links
const DX = [0, 1, 0, -1];
const DY = [-1, 0, 1, 0];
const opp = (d) => (d + 2) % 4;

// ---------------------------------------------------------------------------------------------------------
// Zustand (vorbelegt, damit handle() auch ohne init() läuft)
// ---------------------------------------------------------------------------------------------------------

var config = { humans: 12, ki: 0, timerIndex: 3 };
var gameState = 'start'; // 'start' | 'play' | 'result' | 'over'
var boxes = [];
var layout = null;
var round = 1;
var countdown = 30;
var noChangeRounds = 0;
var kiMarks = []; // [{ s, d }]
var lastResult = null;
var resultTimer = 0;
var particles = [];
var clock = 0;
var shake = 0;
var winners = [];
var startButtons = [];
var overButtons = [];
var bgCanvas = null;
var bgColorKey = '';
var keyEdge = createKeyEdge();
var keys = {};
var highscore = createHighscore('Domination', 'felder');
var newHighscore = false;

// ---------------------------------------------------------------------------------------------------------
// Farben (nur aus der Laserfarbe abgeleitet, Laser-Farbton ±0.12 wird gemieden)
// ---------------------------------------------------------------------------------------------------------

function col(hue, sat, val) {
  return getRgbSpreadHex(laserConfig.testColor, hue, sat, val);
}

// Nur Komplementärbereich der Laserfarbe: Farbton 0.25 … 0.75 (goldener Schnitt verteilt die 60 Töne).
// In der halben Farbkreis-Breite liegen 60 Töne eng beieinander → zusätzlich Sättigungs-/Helligkeitsstufen.
function ownerHue(i) {
  return 0.25 + ((i * 0.618034) % 1) * 0.5;
}

// Wahrgenommene Helligkeit (0..1) einer #rrggbb-Farbe
function luminance(hex) {
  const n = parseInt(hex.slice(1, 7), 16);
  return (0.2126 * ((n >> 16) & 255) + 0.7152 * ((n >> 8) & 255) + 0.0722 * (n & 255)) / 255;
}

// Dunkle Töne (je nach Laserfarbe z. B. Blau/Violett) wirken bei gleichem val viel dunkler – deren Konturen
// wären kaum sichtbar. Deshalb wird pro Spieler die Sättigung so weit gesenkt (Richtung Pastell), bis die
// volle Farbe eine Mindesthelligkeit erreicht. Ergebnis gecacht (Laserfarbe als Schlüssel).
var satCache = {};
var satCacheKey = '';
function ownerSat(i) {
  const key = laserConfig.testColor.join(',');
  if (key !== satCacheKey) {
    satCache = {};
    satCacheKey = key;
  }
  if (satCache[i] !== undefined) return satCache[i];
  let sat = [0.85, 0.5, 1][i % 3];
  const base = [1, 0.78][Math.floor(i / 3) % 2];
  while (sat > 0.2 && luminance(col(ownerHue(i), sat, base)) < 0.42) sat -= 0.08;
  satCache[i] = sat;
  return sat;
}

function ownerColor(i, val) {
  const base = [1, 0.78][Math.floor(i / 3) % 2];
  return col(ownerHue(i), ownerSat(i), (val === undefined ? 1 : val) * base);
}

const UI = {
  text: () => col(0.5, 0.15, 0.95),
  dim: () => col(0.5, 0.3, 0.5),
  accent: () => col(0.45, 0.7, 1),
  warn: () => col(0.6, 0.8, 1),
  ki: () => col(0.5, 0.25, 1),
};

function playSound(snd, volume) {
  try {
    const a = new Audio(snd);
    a.volume = volume === undefined ? 0.6 : volume;
    a.play().catch(() => {});
  } catch (e) {
    // Ton ist optional
  }
}

// ---------------------------------------------------------------------------------------------------------
// Reine Spiellogik (ohne Zeichnen) – auch separat testbar
// ---------------------------------------------------------------------------------------------------------

/**
 * Wertet eine Runde aus.
 * owners[i]     Besitzer (Index des Ursprungskästchens) von Kästchen i
 * neighbors[i]  [oben, rechts, unten, links] → Kästchen-Index oder -1
 * marks[i]      [bool × 4] markierte Pfeile
 * Ergebnis: { owners (neu), captures: [{ t, from, to }], cancels: [{ s, d }], blocked: [t], changed }
 */
export function resolveRound(owners, neighbors, marks, sameEmpireBlocks) {
  const n = owners.length;
  const attacks = [];
  const cancels = [];
  for (let s = 0; s < n; s++) {
    for (let d = 0; d < 4; d++) {
      if (!marks[s][d]) continue;
      const t = neighbors[s][d];
      if (t < 0 || owners[t] === owners[s]) continue;
      if (marks[t][opp(d)]) {
        // Gegenpfeil markiert → beide canceln (wird vom anderen Kästchen aus symmetrisch ebenso erkannt)
        cancels.push({ s, d });
        continue;
      }
      attacks.push({ s, d, t, owner: owners[s] });
    }
  }
  const byTarget = {};
  attacks.forEach((a) => {
    if (!byTarget[a.t]) byTarget[a.t] = [];
    byTarget[a.t].push(a);
  });
  const newOwners = owners.slice();
  const captures = [];
  const blocked = [];
  Object.keys(byTarget).forEach((key) => {
    const t = Number(key);
    const list = byTarget[t];
    const distinct = {};
    list.forEach((a) => {
      distinct[a.owner] = true;
    });
    const ownerIds = Object.keys(distinct);
    if (ownerIds.length === 1 && (!sameEmpireBlocks || list.length === 1)) {
      const to = Number(ownerIds[0]);
      newOwners[t] = to;
      captures.push({ t, from: owners[t], to, attackers: list.map((a) => ({ s: a.s, d: a.d })) });
    } else {
      blocked.push(t);
    }
  });
  return { owners: newOwners, captures, cancels, blocked, changed: captures.length > 0, attacks };
}

/** KI-Wahl: für jedes Ursprungs-KI-Kästchen einen Pfeil für dessen aktuellen Besitzer */
function chooseKiMarks() {
  const owners = boxes.map((b) => b.owner);
  const sizes = {};
  owners.forEach((o) => {
    sizes[o] = (sizes[o] || 0) + 1;
  });
  const chosen = [];
  const usedArrow = {};
  const usedTarget = {};
  // Reihenfolge zufällig, damit nicht immer dieselbe KI zuerst wählt
  const kiBoxes = boxes.filter((b) => b.isKI).map((b) => b.index);
  kiBoxes.sort(() => Math.random() - 0.5);
  kiBoxes.forEach((k) => {
    const E = owners[k];
    let best = null;
    let bestScore = -Infinity;
    boxes.forEach((b) => {
      if (owners[b.index] !== E) return;
      for (let d = 0; d < 4; d++) {
        const t = b.neighbors[d];
        if (t < 0 || owners[t] === E) continue;
        const arrowKey = b.index + ':' + d;
        if (usedArrow[arrowKey]) continue;
        let score = Math.random() * 1.2;
        const victim = owners[t];
        score += 1.2 / Math.max(1, sizes[victim]); // kleine Reiche sind leichte Beute
        if (boxes[t].isKI) score += 0.4; // KI-Kästchen bringen zusätzliche KI-Laser
        if (t === E) score += 1.5; // eigenes verlorenes Ursprungskästchen zurückholen
        if (t === victim) score += 0.3; // Ursprungskästchen anderer sind symbolisch wertvoll
        // Umkämpft: wie viele andere fremde Reiche grenzen an t?
        const others = {};
        boxes[t].neighbors.forEach((nb) => {
          if (nb >= 0 && owners[nb] !== E && owners[nb] !== victim) others[owners[nb]] = true;
        });
        score -= 0.35 * Object.keys(others).length;
        if (usedTarget[E + ':' + t]) score -= 3; // gleiches Ziel doppelt bringt nichts
        if (score > bestScore) {
          bestScore = score;
          best = { s: b.index, d, t, k, owner: E };
        }
      }
    });
    if (best) {
      usedArrow[best.s + ':' + best.d] = true;
      usedTarget[E + ':' + best.t] = true;
      chosen.push(best);
    }
  });
  return chosen;
}

// ---------------------------------------------------------------------------------------------------------
// Aufbau
// ---------------------------------------------------------------------------------------------------------

function totalBoxes() {
  return Math.min(MAX_BOXES, config.humans + config.ki);
}

function computeLayout(n) {
  const areaW = W - 40;
  const areaH = H - HUD_H - 20;
  let best = null;
  for (let cols = 1; cols <= n; cols++) {
    const rows = Math.ceil(n / cols);
    const cw = areaW / cols;
    const ch = areaH / rows;
    const cell = Math.min(cw, ch);
    // Größtes Kästchen gewinnt; bei Gleichstand weniger leere Plätze
    const score = cell * 1000 - (cols * rows - n);
    if (!best || score > best.score) best = { cols, rows, cell, score };
  }
  const cellW = Math.min(areaW / best.cols, best.cell * 1.25);
  const cellH = Math.min(areaH / best.rows, best.cell * 1.25);
  const gridW = cellW * best.cols;
  const gridH = cellH * best.rows;
  return {
    cols: best.cols,
    rows: best.rows,
    cellW,
    cellH,
    x0: (W - gridW) / 2,
    y0: HUD_H + 10 + (areaH - gridH) / 2,
    boxSize: Math.min(cellW, cellH) * 0.9,
  };
}

/** Plätze für KI-Kästchen gleichmäßig über die Karte verteilen, Menschen der Reihe nach */
function assignSlots(n, kiCount) {
  const isKiSlot = [];
  for (let i = 0; i < n; i++) isKiSlot.push(false);
  for (let k = 0; k < kiCount; k++) {
    let slot = Math.floor(((k + 0.5) * n) / kiCount);
    while (isKiSlot[slot % n]) slot++;
    isKiSlot[slot % n] = true;
  }
  return isKiSlot;
}

function arrowPolygon(b, d) {
  // Trapez zwischen Kästchenkante und innerem Zahlenfeld
  const h = b.size / 2;
  const c = b.size * NUMBER_FIELD; // halbe Größe des Zahlenfelds
  const g = b.size * 0.035; // Fuge zwischen den Pfeilen
  const x = b.x;
  const y = b.y;
  let pts;
  if (d === 0) pts = [[x - h + g, y - h], [x + h - g, y - h], [x + c, y - c - g], [x - c, y - c - g]];
  else if (d === 1) pts = [[x + h, y - h + g], [x + h, y + h - g], [x + c + g, y + c], [x + c + g, y - c]];
  else if (d === 2) pts = [[x + h - g, y + h], [x - h + g, y + h], [x - c, y + c + g], [x + c, y + c + g]];
  else pts = [[x - h, y + h - g], [x - h, y - h + g], [x - c - g, y - c], [x - c - g, y + c]];
  return pts;
}

function arrowCenter(b, d) {
  const r = b.size * 0.36;
  return { x: b.x + DX[d] * r, y: b.y + DY[d] * r };
}

function buildBoard() {
  const n = totalBoxes();
  layout = computeLayout(n);
  const isKiSlot = assignSlots(n, config.ki);
  boxes = [];
  const slotToBox = {};
  let humanNo = 1;
  let kiNo = config.humans + 1;
  for (let slot = 0; slot < n; slot++) {
    const cx = slot % layout.cols;
    const row = Math.floor(slot / layout.cols);
    const isKI = isKiSlot[slot];
    const b = {
      index: slot,
      num: isKI ? kiNo++ : humanNo++,
      isKI,
      col: cx,
      row,
      x: layout.x0 + (cx + 0.5) * layout.cellW,
      y: layout.y0 + (row + 0.5) * layout.cellH,
      size: layout.boxSize,
      owner: slot,
      neighbors: [-1, -1, -1, -1],
      arrows: [null, null, null, null],
      hold: [0, 0, 0, 0],
      flash: 0,
      lostFlash: 0,
    };
    boxes.push(b);
    slotToBox[cx + ',' + row] = slot;
  }
  boxes.forEach((b) => {
    for (let d = 0; d < 4; d++) {
      const key = b.col + DX[d] + ',' + (b.row + DY[d]);
      b.neighbors[d] = slotToBox[key] === undefined ? -1 : slotToBox[key];
      if (b.neighbors[d] >= 0) {
        b.arrows[d] = guiRegionButton({
          polygon: arrowPolygon(b, d),
          visible: false,
          speedUp: 0,
          speedDown: 0,
          minPercent: SETTINGS.arrowMinPercent,
        });
      }
    }
  });
}

function startGame() {
  buildBoard();
  round = 1;
  noChangeRounds = 0;
  particles = [];
  winners = [];
  lastResult = null;
  startRound();
  gameState = 'play';
  playSound(soundStomp, 0.5);
}

function startRound() {
  countdown = TIMER_STEPS[config.timerIndex];
  boxes.forEach((b) => {
    b.hold = [0, 0, 0, 0];
  });
  kiMarks = chooseKiMarks();
}

function currentMarks() {
  const marks = boxes.map((b) => b.hold.map((h) => h > 0));
  kiMarks.forEach((m) => {
    marks[m.s][m.d] = true;
  });
  return marks;
}

function finishCountdown() {
  const owners = boxes.map((b) => b.owner);
  const neighbors = boxes.map((b) => b.neighbors);
  const marks = currentMarks();
  const res = resolveRound(owners, neighbors, marks, SAME_EMPIRE_BLOCKS);
  res.marks = marks;
  lastResult = res;
  res.captures.forEach((c) => {
    boxes[c.t].owner = c.to;
    boxes[c.t].flash = 1;
    burst(boxes[c.t].x, boxes[c.t].y, ownerColor(c.to), 26, boxes[c.t].size * 0.6);
  });
  res.cancels.forEach((c) => {
    const b = boxes[c.s];
    const h = b.size / 2 + (layout.cellW - b.size) / 4;
    burst(b.x + DX[c.d] * h, b.y + DY[c.d] * h, UI.warn(), 8, 40);
  });
  res.blocked.forEach((t) => {
    boxes[t].lostFlash = 1;
  });
  if (res.changed) {
    noChangeRounds = 0;
    playSound(soundStomp, 0.55);
    shake = 10;
  } else {
    noChangeRounds++;
    playSound(soundPlop, 0.5);
  }
  resultTimer = SETTINGS.resultDuration;
  gameState = 'result';
}

function empireSizes() {
  const sizes = {};
  boxes.forEach((b) => {
    sizes[b.owner] = (sizes[b.owner] || 0) + 1;
  });
  return Object.keys(sizes)
    .map((k) => ({ owner: Number(k), size: sizes[k] }))
    .sort((a, b) => b.size - a.size || boxes[a.owner].num - boxes[b.owner].num);
}

function checkEnd() {
  const ranking = empireSizes();
  if (ranking.length <= 1 || noChangeRounds >= SETTINGS.noChangeRoundsToEnd) {
    const top = ranking[0].size;
    winners = ranking.filter((r) => r.size === top).map((r) => r.owner);
    highscore.addEntry({ felder: top, runden: round, spieler: totalBoxes() });
    newHighscore = highscore.lastEntryNewHighscore();
    gameState = 'over';
    createOverButtons();
    playSound(soundStomp, 0.8);
    for (let i = 0; i < 6; i++) burst(Math.random() * W, Math.random() * H * 0.6, ownerColor(winners[i % winners.length]), 30, 300);
    return true;
  }
  return false;
}

// ---------------------------------------------------------------------------------------------------------
// Partikel
// ---------------------------------------------------------------------------------------------------------

function burst(x, y, color, count, speed) {
  for (let i = 0; i < count && particles.length < SETTINGS.maxParticles; i++) {
    const a = Math.random() * Math.PI * 2;
    const v = speed * (0.4 + Math.random());
    particles.push({ x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v, life: 0.6 + Math.random() * 0.6, max: 1.2, color, r: 3 + Math.random() * 5 });
  }
}

function updateParticles(ctx, dt) {
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  particles.slice().forEach((p) => {
    p.life -= dt;
    if (p.life <= 0) {
      particles.splice(particles.indexOf(p), 1);
      return;
    }
    p.x += p.vx * dt;
    p.y += p.vy * dt;
    p.vx *= 1 - 2 * dt;
    p.vy *= 1 - 2 * dt;
    ctx.globalAlpha = Math.min(1, p.life / 0.5);
    ctx.fillStyle = p.color;
    ctx.beginPath();
    ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
    ctx.fill();
  });
  ctx.restore();
}

// ---------------------------------------------------------------------------------------------------------
// Zeichnen
// ---------------------------------------------------------------------------------------------------------

function ensureBackground() {
  const key = laserConfig.testColor.join(',');
  if (bgCanvas && bgColorKey === key) return;
  bgColorKey = key;
  bgCanvas = document.createElement('canvas');
  bgCanvas.width = W;
  bgCanvas.height = H;
  const c = bgCanvas.getContext('2d');
  const g = c.createRadialGradient(W / 2, H / 2, 100, W / 2, H / 2, W * 0.7);
  g.addColorStop(0, col(0.5, 0.6, 0.05));
  g.addColorStop(1, col(0.45, 0.6, 0.01));
  c.fillStyle = g;
  c.fillRect(0, 0, W, H);
  // feines Rautenmuster
  c.strokeStyle = col(0.5, 0.5, 0.035);
  c.lineWidth = 1;
  for (let i = -H; i < W; i += 48) {
    c.beginPath();
    c.moveTo(i, 0);
    c.lineTo(i + H, H);
    c.moveTo(i + H, 0);
    c.lineTo(i, H);
    c.stroke();
  }
}

function drawBackground(ctx) {
  ensureBackground();
  ctx.drawImage(bgCanvas, 0, 0);
  // Keine Lichtpunkte mehr: das Spielfeld ist Aktionsfläche und muss dunkel bleiben (Laser-Erkennung).
}

function polyPath(ctx, pts) {
  ctx.beginPath();
  pts.forEach((p, i) => {
    if (i === 0) ctx.moveTo(p[0], p[1]);
    else ctx.lineTo(p[0], p[1]);
  });
  ctx.closePath();
}

function drawChevron(ctx, b, d, size) {
  const c = arrowCenter(b, d);
  const ax = DX[d];
  const ay = DY[d];
  const px = -ay;
  const py = ax;
  ctx.beginPath();
  ctx.moveTo(c.x - ax * size * 0.4 + px * size * 0.6, c.y - ay * size * 0.4 + py * size * 0.6);
  ctx.lineTo(c.x + ax * size * 0.4, c.y + ay * size * 0.4);
  ctx.lineTo(c.x - ax * size * 0.4 - px * size * 0.6, c.y - ay * size * 0.4 - py * size * 0.6);
  ctx.stroke();
}

function drawBridges(ctx) {
  // Fugen zwischen Kästchen desselben Reichs füllen → Reich wirkt zusammenhängend
  ctx.save();
  boxes.forEach((b) => {
    [1, 2].forEach((d) => {
      const t = b.neighbors[d];
      if (t < 0 || boxes[t].owner !== b.owner) return;
      ctx.fillStyle = ownerColor(b.owner, 0.12);
      ctx.globalAlpha = 0.8;
      const h = b.size / 2;
      const w = b.size * 0.5;
      if (d === 1) ctx.fillRect(b.x + h, b.y - w / 2, boxes[t].x - b.x - 2 * h, w);
      else ctx.fillRect(b.x - w / 2, b.y + h, w, boxes[t].y - b.y - 2 * h);
    });
  });
  ctx.restore();
}

function drawFrames(ctx) {
  // Rahmen um jedes Reich: Zellkante, wo der Nachbar einem anderen Reich gehört (oder keiner da ist)
  ctx.save();
  ctx.lineCap = 'round';
  const inset = 5;
  boxes.forEach((b) => {
    const color = ownerColor(b.owner, 0.85);
    const hw = layout.cellW / 2 - inset;
    const hh = layout.cellH / 2 - inset;
    ctx.strokeStyle = color;
    ctx.shadowColor = color;
    ctx.shadowBlur = 4;
    ctx.lineWidth = b.owner === b.index ? 4 : 3;
    for (let d = 0; d < 4; d++) {
      const t = b.neighbors[d];
      if (t >= 0 && boxes[t].owner === b.owner) continue;
      ctx.beginPath();
      if (d === 0) {
        ctx.moveTo(b.x - hw, b.y - hh);
        ctx.lineTo(b.x + hw, b.y - hh);
      } else if (d === 1) {
        ctx.moveTo(b.x + hw, b.y - hh);
        ctx.lineTo(b.x + hw, b.y + hh);
      } else if (d === 2) {
        ctx.moveTo(b.x - hw, b.y + hh);
        ctx.lineTo(b.x + hw, b.y + hh);
      } else {
        ctx.moveTo(b.x - hw, b.y - hh);
        ctx.lineTo(b.x - hw, b.y + hh);
      }
      ctx.stroke();
    }
  });
  ctx.restore();
}

function drawBox(ctx, b, marks, interactive) {
  const own = ownerColor(b.index);
  const ownerCol = ownerColor(b.owner);
  const conquered = b.owner !== b.index;
  const h = b.size / 2;
  ctx.save();
  // Grundfläche: eingefärbt nach Besitzer
  // Grundfläche fast schwarz (Aktionsfläche!), nur ein Hauch Besitzerfarbe
  ctx.fillStyle = '#000';
  ctx.fillRect(b.x - h, b.y - h, b.size, b.size);
  ctx.fillStyle = ownerColor(b.owner, 0.12);
  ctx.globalAlpha = conquered ? 0.6 : 0.35;
  ctx.fillRect(b.x - h, b.y - h, b.size, b.size);
  ctx.globalAlpha = 1;

  // Pfeile
  for (let d = 0; d < 4; d++) {
    if (!b.arrows[d]) continue;
    const pts = arrowPolygon(b, d);
    const t = b.neighbors[d];
    const useless = boxes[t].owner === b.owner;
    const marked = marks[b.index][d];
    // Pfeilfläche schwarz, nur konturiert – markiert = dicke helle Kontur + Doppel-Chevron, KEINE Füllung
    polyPath(ctx, pts);
    ctx.fillStyle = '#000';
    ctx.fill();
    const live = marked && !useless;
    ctx.globalAlpha = useless ? 0.2 : live ? 1 : 0.45;
    ctx.strokeStyle = live ? ownerCol : ownerColor(b.owner, 0.6);
    ctx.lineWidth = live ? 5 : 2;
    drawChevron(ctx, b, d, b.size * 0.13);
    if (live) {
      ctx.save();
      ctx.translate(-DX[d] * b.size * 0.06, -DY[d] * b.size * 0.06);
      drawChevron(ctx, b, d, b.size * 0.13);
      ctx.restore();
    }
    ctx.globalAlpha = useless ? 0.12 : live ? 1 : 0.35;
    ctx.strokeStyle = live ? ownerCol : ownerColor(b.owner, 0.6);
    ctx.lineWidth = live ? 6 : 2;
    ctx.lineJoin = 'round';
    polyPath(ctx, pts);
    ctx.stroke();
    ctx.globalAlpha = 1;
  }

  // Zahlenfeld
  const c = b.size * NUMBER_FIELD;
  ctx.fillStyle = col(0.5, 0.4, 0.03);
  ctx.fillRect(b.x - c, b.y - c, c * 2, c * 2);
  ctx.strokeStyle = own;
  ctx.globalAlpha = conquered ? 0.4 : 1;
  ctx.lineWidth = 2;
  ctx.strokeRect(b.x - c, b.y - c, c * 2, c * 2);
  const fs = Math.round(b.size * (b.num >= 10 ? 0.22 : 0.27));
  util.renderText({ ctx, text: String(b.num), x: b.x, y: b.y + fs * 0.36, fontSize: fs + 'px', fillStyle: own });
  ctx.globalAlpha = 1;
  if (b.isKI) {
    util.renderText({ ctx, text: 'KI', x: b.x, y: b.y + c - 3, fontSize: Math.round(b.size * 0.09) + 'px', fillStyle: UI.ki() });
  }
  // Badge: wem gehört das eroberte Kästchen?
  if (conquered) {
    const r = b.size * 0.13;
    const bx = b.x - h + r * 0.7;
    const by = b.y - h + r * 0.7;
    // Badge liegt in der Pfeilecke → dunkel gefüllt, nur Kontur + Zahl in Besitzerfarbe
    ctx.fillStyle = '#000';
    ctx.strokeStyle = ownerCol;
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(bx, by, r, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    util.renderText({ ctx, text: String(boxes[b.owner].num), x: bx, y: by + r * 0.38, fontSize: Math.round(r * 1.1) + 'px', fillStyle: ownerCol });
  }
  // Blitz bei Eroberung / Blockade
  if (b.flash > 0) {
    ctx.globalCompositeOperation = 'lighter';
    ctx.globalAlpha = b.flash * (0.25 + 0.15 * Math.sin(clock * 30));
    ctx.fillStyle = ownerCol;
    ctx.fillRect(b.x - h, b.y - h, b.size, b.size);
    ctx.globalCompositeOperation = 'source-over';
  }
  if (b.lostFlash > 0) {
    ctx.globalAlpha = b.lostFlash;
    ctx.strokeStyle = UI.warn();
    ctx.lineWidth = 6;
    ctx.beginPath();
    ctx.moveTo(b.x - h * 0.7, b.y - h * 0.7);
    ctx.lineTo(b.x + h * 0.7, b.y + h * 0.7);
    ctx.moveTo(b.x + h * 0.7, b.y - h * 0.7);
    ctx.lineTo(b.x - h * 0.7, b.y + h * 0.7);
    ctx.stroke();
  }
  ctx.restore();
}

function drawKiMarks(ctx) {
  ctx.save();
  kiMarks.forEach((m, i) => {
    const b = boxes[m.s];
    const c = arrowCenter(b, m.d);
    const r = b.size * 0.085 * (1 + 0.12 * Math.sin(clock * 5 + i));
    ctx.strokeStyle = UI.ki();
    ctx.fillStyle = '#000';
    ctx.lineWidth = 4;
    ctx.setLineDash([6, 5]);
    ctx.beginPath();
    ctx.arc(c.x, c.y, r, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    ctx.setLineDash([]);
    util.renderText({ ctx, text: 'KI', x: c.x, y: c.y + r * 0.35, fontSize: Math.round(r * 0.95) + 'px', fillStyle: UI.ki() });
  });
  ctx.restore();
}

function drawBoard(ctx, marks, interactive) {
  drawBridges(ctx);
  boxes.forEach((b) => drawBox(ctx, b, marks, interactive));
  drawFrames(ctx);
  if (gameState === 'play' || gameState === 'result') drawKiMarks(ctx);
}

function fmtTime(sec) {
  const s = Math.max(0, Math.ceil(sec));
  const m = Math.floor(s / 60);
  const r = s % 60;
  return m + ':' + (r < 10 ? '0' : '') + r;
}

function drawHud(ctx) {
  ctx.save();
  ctx.fillStyle = col(0.5, 0.5, 0.04);
  ctx.globalAlpha = 0.85;
  ctx.fillRect(0, 0, W, HUD_H);
  ctx.globalAlpha = 1;
  util.renderText({ ctx, text: 'DOMINATION', x: 30, y: 72, fontSize: '52px', fillStyle: UI.accent(), align: 'left' });
  util.renderText({ ctx, text: 'Runde ' + round, x: 470, y: 70, fontSize: '44px', fillStyle: UI.text(), align: 'left' });
  util.renderText({
    ctx,
    text: 'ohne Änderung: ' + noChangeRounds + '/' + SETTINGS.noChangeRoundsToEnd,
    x: 700,
    y: 70,
    fontSize: '36px',
    fillStyle: noChangeRounds >= SETTINGS.noChangeRoundsToEnd - 1 ? UI.warn() : UI.dim(),
    align: 'left',
  });
  const ranking = empireSizes();
  const leader = ranking[0];
  if (leader) {
    util.renderText({
      ctx,
      text: 'Größtes Reich: ' + boxes[leader.owner].num + ' (' + leader.size + ')',
      x: 1180,
      y: 70,
      fontSize: '36px',
      fillStyle: ownerColor(leader.owner),
      align: 'left',
    });
  }
  // Countdown
  let text;
  let color = UI.text();
  let size = 80;
  if (gameState === 'play') {
    text = fmtTime(countdown);
    if (countdown <= 5) {
      color = UI.warn();
      size = 80 + 14 * Math.abs(Math.sin(clock * Math.PI));
    }
  } else {
    text = lastResult && lastResult.changed ? lastResult.captures.length + ' erobert' : 'nichts passiert';
    size = 44;
    color = UI.accent();
  }
  util.renderText({ ctx, text, x: W - 30, y: 70 + (size - 44) * 0.3, fontSize: Math.round(size) + 'px', fillStyle: color, align: 'right' });
  ctx.restore();
}

// ---------------------------------------------------------------------------------------------------------
// Startbildschirm
// ---------------------------------------------------------------------------------------------------------

function clampConfig() {
  config.humans = Math.max(1, Math.min(MAX_BOXES, config.humans));
  config.ki = Math.max(0, Math.min(MAX_BOXES - config.humans, config.ki));
  if (config.humans + config.ki < 2) config.ki = config.humans < 2 ? 1 : config.ki;
  config.timerIndex = Math.max(0, Math.min(TIMER_STEPS.length - 1, config.timerIndex));
}

const SETTING_ROWS = [
  { key: 'humans', label: 'Mitspieler', y: 380 },
  { key: 'ki', label: 'KI-Spieler', y: 560 },
  { key: 'timerIndex', label: 'Counter', y: 740 },
];

function changeSetting(key, delta) {
  config[key] += delta;
  if (key === 'humans' && config.humans + config.ki > MAX_BOXES) config.ki = MAX_BOXES - config.humans;
  clampConfig();
  playSound(soundPlop, 0.3);
}

function createStartButtons() {
  startButtons = [];
  SETTING_ROWS.forEach((row) => {
    [-1, 1].forEach((delta) => {
      startButtons.push(
        guiFillButton({
          label: '',
          posX: W / 2 + delta * 420,
          posY: row.y,
          radius: 75,
          edges: delta < 0 ? 3 : 4,
          angle: delta < 0 ? 180 : 45,
          speedUp: 140,
          speedDown: 80,
          activeValue: 90,
          counterReset: true,
          normalColor: col(0.35, 0.6, 0.6),
          growColor: col(0.35, 0.6, 0.85),
          activeColor: col(0.35, 0.4, 1),
          onEnterActive: () => changeSetting(row.key, delta),
        })
      );
    });
  });
  startButtons.push(
    guiFillButton({
      label: '',
      posX: W / 2,
      posY: 940,
      radius: 110,
      edges: 6,
      speedUp: 50,
      speedDown: 30,
      activeValue: 90,
      counterReset: true,
      normalColor: col(0.55, 0.7, 0.7),
      growColor: col(0.55, 0.7, 0.9),
      activeColor: col(0.55, 0.4, 1),
      onEnterActive: () => startGame(),
    })
  );
}

/** Highscore-Tafel (eigene Position, damit sie keine Laser-Buttons überdeckt) */
function drawHighscore(ctx, x, y) {
  const best = highscore.getHighscore();
  const lines = ['HIGHSCORE'];
  if (best) {
    lines.push(best.felder + ' Kästchen');
    lines.push(best.runden + ' Runden · ' + best.spieler + ' Spieler');
  } else {
    lines.push('noch leer –');
    lines.push('erster Eintrag gewinnt');
  }
  if (gameState === 'over' && newHighscore) lines.push('NEUER HIGHSCORE!');
  lines.forEach((t, i) => {
    util.renderText({ ctx, text: t, x, y: y + i * 44, fontSize: i === 0 ? '40px' : '30px', fillStyle: i === 0 || i === 3 ? UI.accent() : UI.dim() });
  });
}

function handleStart(ctx, grid, dt) {
  if (keys.ArrowUp) changeSetting('humans', 1);
  if (keys.ArrowDown) changeSetting('humans', -1);
  if (keys.ArrowRight) changeSetting('timerIndex', 1);
  if (keys.ArrowLeft) changeSetting('timerIndex', -1);
  if (keys.KeyK) changeSetting('ki', 1);
  if (keys.KeyJ) changeSetting('ki', -1);

  // Titel
  const pulse = 1 + 0.03 * Math.sin(clock * 2);
  ctx.save();
  ctx.shadowColor = UI.accent();
  ctx.shadowBlur = 30;
  util.renderText({ ctx, text: 'DOMINATION', x: W / 2, y: 190, fontSize: Math.round(150 * pulse) + 'px', fillStyle: UI.accent() });
  ctx.restore();
  util.renderText({ ctx, text: 'Pfeile markieren – bei NULL wird expandiert', x: W / 2, y: 260, fontSize: '40px', fillStyle: UI.dim() });

  const values = {
    humans: String(config.humans),
    ki: String(config.ki),
    timerIndex: fmtTime(TIMER_STEPS[config.timerIndex]),
  };
  const hints = { humans: '↑ / ↓', ki: 'J / K', timerIndex: '← / →' };
  SETTING_ROWS.forEach((row) => {
    util.renderText({ ctx, text: row.label, x: W / 2, y: row.y - 25, fontSize: '42px', fillStyle: UI.dim() });
    util.renderText({ ctx, text: values[row.key], x: W / 2, y: row.y + 50, fontSize: '80px', fillStyle: UI.text() });
    util.renderText({ ctx, text: hints[row.key], x: W / 2 + 620, y: row.y + 14, fontSize: '32px', fillStyle: UI.dim() });
  });
  startButtons.forEach((b) => b.handle(grid, dt));
  SETTING_ROWS.forEach((row) => {
    util.renderText({ ctx, text: '−', x: W / 2 - 420, y: row.y + 22, fontSize: '70px', fillStyle: UI.text() });
    util.renderText({ ctx, text: '+', x: W / 2 + 420, y: row.y + 24, fontSize: '70px', fillStyle: UI.text() });
  });
  util.renderText({ ctx, text: 'START', x: W / 2, y: 955, fontSize: '50px', fillStyle: UI.text() });
  util.renderText({ ctx, text: 'oder Leertaste', x: W / 2, y: 1068, fontSize: '28px', fillStyle: UI.dim() });

  // Vorschau der Kartengröße
  const n = totalBoxes();
  const lay = computeLayout(n);
  util.renderText({
    ctx,
    text: n + ' Kästchen\n' + lay.cols + ' × ' + lay.rows + '\nje ' + Math.round(lay.boxSize) + ' px',
    x: 200,
    y: 500,
    lineHeight: 50,
    fontSize: '40px',
    fillStyle: UI.dim(),
  });
  // Mini-Karte
  const mw = 260;
  const mh = (mw * (H - HUD_H)) / W;
  const mx = W - 330;
  const my = 440;
  const isKiSlot = assignSlots(n, config.ki);
  ctx.save();
  for (let i = 0; i < n; i++) {
    const c = i % lay.cols;
    const r = Math.floor(i / lay.cols);
    const cw = (lay.cellW / (W - 40)) * mw;
    const ch = (lay.cellH / (H - HUD_H - 20)) * mh;
    const ox = mx + (mw - cw * lay.cols) / 2;
    const oy = my + (mh - ch * lay.rows) / 2;
    ctx.fillStyle = isKiSlot[i] ? UI.ki() : ownerColor(i, 0.8);
    ctx.globalAlpha = isKiSlot[i] ? 0.5 : 0.8;
    ctx.fillRect(ox + c * cw + 2, oy + r * ch + 2, cw - 4, ch - 4);
  }
  ctx.restore();

  drawHighscore(ctx, 230, 760);
  if (keys.Space || keys.Enter) startGame();
}

// ---------------------------------------------------------------------------------------------------------
// Spiel
// ---------------------------------------------------------------------------------------------------------

function handlePlay(ctx, grid, dt) {
  // Laser auf den Pfeilen messen (unsichtbare regionButtons, gecachte Zellen)
  const testDir = [isKeyDown('Digit1'), isKeyDown('Digit2'), isKeyDown('Digit3'), isKeyDown('Digit4')];
  boxes.forEach((b) => {
    for (let d = 0; d < 4; d++) {
      const a = b.arrows[d];
      if (!a) continue;
      a.handle(grid, dt);
      if (a.getFillPercent() > 0 || testDir[d]) b.hold[d] = SETTINGS.holdTime;
      else b.hold[d] = Math.max(0, b.hold[d] - dt);
    }
  });
  countdown -= dt;
  const marks = currentMarks();
  drawBoard(ctx, marks, true);
  drawHud(ctx);

  // Letzte Sekunden: großer Countdown in der Mitte, halbtransparent
  if (countdown <= 5 && countdown > 0) {
    ctx.save();
    ctx.globalAlpha = 0.25 + 0.15 * Math.sin(clock * Math.PI * 2);
    util.renderText({ ctx, text: String(Math.ceil(countdown)), x: W / 2, y: H / 2 + 150, fontSize: '420px', fillStyle: UI.warn() });
    ctx.restore();
  }
  if (keys.Space || keys.Enter) countdown = 0;
  if (keys.Escape) {
    gameState = 'start';
    return;
  }
  if (countdown <= 0) finishCountdown();
}

function handleResult(ctx, grid, dt) {
  resultTimer -= dt;
  boxes.forEach((b) => {
    b.flash = Math.max(0, b.flash - dt * 0.45);
    b.lostFlash = Math.max(0, b.lostFlash - dt * 0.45);
  });
  drawBoard(ctx, lastResult.marks, false);
  // Erfolgreiche Angriffe als leuchtende Pfeile über die Fuge
  ctx.save();
  ctx.lineCap = 'round';
  lastResult.captures.forEach((c) => {
    c.attackers.forEach((a) => {
      const s = boxes[a.s];
      const t = boxes[c.t];
      ctx.strokeStyle = ownerColor(c.to);
      ctx.shadowColor = ownerColor(c.to);
      ctx.shadowBlur = 20;
      ctx.lineWidth = 12;
      ctx.globalAlpha = Math.min(1, resultTimer);
      ctx.beginPath();
      ctx.moveTo(s.x, s.y);
      ctx.lineTo(t.x, t.y);
      ctx.stroke();
    });
  });
  ctx.restore();
  drawHud(ctx);
  const msg = lastResult.changed ? lastResult.captures.length + (lastResult.captures.length === 1 ? ' Kästchen erobert!' : ' Kästchen erobert!') : 'Keine Veränderung';
  ctx.save();
  ctx.globalAlpha = Math.min(1, resultTimer * 1.5);
  ctx.shadowColor = UI.accent();
  ctx.shadowBlur = 25;
  ctx.fillStyle = col(0.5, 0.5, 0.05);
  ctx.globalAlpha *= 0.75;
  ctx.fillRect(W / 2 - 520, H / 2 - 80, 1040, 140);
  ctx.globalAlpha = Math.min(1, resultTimer * 1.5);
  util.renderText({ ctx, text: msg, x: W / 2, y: H / 2 + 25, fontSize: '80px', fillStyle: UI.accent() });
  ctx.restore();
  if (keys.Space || keys.Enter) resultTimer = 0;
  if (keys.Escape) {
    gameState = 'start';
    return;
  }
  if (resultTimer <= 0) {
    boxes.forEach((b) => {
      b.flash = 0;
      b.lostFlash = 0;
    });
    if (!checkEnd()) {
      round++;
      startRound();
      gameState = 'play';
    }
  }
}

// ---------------------------------------------------------------------------------------------------------
// Spielende
// ---------------------------------------------------------------------------------------------------------

function createOverButtons() {
  overButtons = [
    guiFillButton({
      label: '',
      posX: W - 220,
      posY: H - 200,
      radius: 110,
      edges: 6,
      speedUp: 40,
      speedDown: 30,
      activeValue: 90,
      counterReset: true,
      normalColor: col(0.55, 0.7, 0.7),
      growColor: col(0.55, 0.7, 0.9),
      activeColor: col(0.55, 0.4, 1),
      onEnterActive: () => startGame(),
    }),
  ];
}

function handleOver(ctx, grid, dt) {
  ctx.save();
  ctx.globalAlpha = 0.35;
  drawBoard(ctx, boxes.map(() => [false, false, false, false]), false);
  ctx.restore();
  ctx.save();
  ctx.fillStyle = col(0.5, 0.5, 0.03);
  ctx.globalAlpha = 0.7;
  ctx.fillRect(0, 0, W, H);
  ctx.restore();

  const shared = winners.length > 1;
  const title = shared ? 'GETEILTER SIEG' : 'SIEG FÜR ' + boxes[winners[0]].num;
  const titleColor = ownerColor(winners[0]);
  ctx.save();
  ctx.shadowColor = titleColor;
  ctx.shadowBlur = 40;
  util.renderText({ ctx, text: title, x: W / 2, y: 210, fontSize: Math.round(130 * (1 + 0.03 * Math.sin(clock * 3))) + 'px', fillStyle: titleColor });
  ctx.restore();
  if (shared) {
    util.renderText({ ctx, text: winners.map((w) => boxes[w].num).join('  ·  '), x: W / 2, y: 300, fontSize: '60px', fillStyle: UI.text() });
  }
  const reason = empireSizes().length <= 1 ? 'Die ganze Karte ist erobert!' : SETTINGS.noChangeRoundsToEnd + ' Runden ohne Veränderung';
  util.renderText({ ctx, text: reason + ' – nach ' + round + ' Runden', x: W / 2, y: 370, fontSize: '40px', fillStyle: UI.dim() });

  const ranking = empireSizes().slice(0, 10);
  ranking.forEach((r, i) => {
    const y = 460 + i * 58;
    const b = boxes[r.owner];
    util.renderText({ ctx, text: i + 1 + '.', x: W / 2 - 330, y, fontSize: '44px', fillStyle: UI.dim(), align: 'right' });
    util.renderText({ ctx, text: 'Reich ' + b.num + (b.isKI ? ' (KI)' : ''), x: W / 2 - 290, y, fontSize: '44px', fillStyle: ownerColor(r.owner), align: 'left' });
    util.renderText({ ctx, text: r.size + (r.size === 1 ? ' Kästchen' : ' Kästchen'), x: W / 2 + 330, y, fontSize: '44px', fillStyle: UI.text(), align: 'right' });
  });

  drawHighscore(ctx, 260, 520);
  overButtons.forEach((b) => b.handle(grid, dt));
  util.renderText({ ctx, text: 'NOCHMAL', x: W - 220, y: H - 186, fontSize: '40px', fillStyle: UI.text() });
  util.renderText({ ctx, text: 'Leertaste = Nochmal · Esc = Einstellungen', x: W / 2, y: H - 40, fontSize: '30px', fillStyle: UI.dim() });
  if (Math.random() < dt * 1.5) burst(Math.random() * W, Math.random() * 400 + 50, ownerColor(winners[Math.floor(Math.random() * winners.length)]), 20, 250);
  if (keys.Space || keys.Enter) startGame();
  else if (keys.Escape) gameState = 'start';
}

// ---------------------------------------------------------------------------------------------------------
// Export
// ---------------------------------------------------------------------------------------------------------

const KEY_LIST = ['Space', 'Enter', 'Escape', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'KeyJ', 'KeyK'];

export default {
  name: 'Domination',
  description:
    'Domination – erobert die Karte!\n' +
    'Jede/r hat ein Kästchen mit der eigenen Laser-Nummer. Markiert einen der vier Pfeile.\n' +
    'Wenn der Counter NULL erreicht: Ein markierter Pfeil erobert das Nachbarkästchen –\n' +
    'außer der Nachbar zeigt zurück (beide canceln) oder ein anderes Reich zeigt auch drauf (Blockade).\n' +
    'Eroberte Kästchen gehören zum Reich und können selbst weiter expandieren.\n' +
    'Ende: ein Reich hat alles, oder 4 Runden ohne Veränderung – das größte Reich gewinnt.',
  image: 'media/img/gametitles/laser-basefight-###4###.png',
  init() {
    gameState = 'start';
    particles = [];
    boxes = [];
    winners = [];
    lastResult = null;
    kiMarks = [];
    newHighscore = false;
    clampConfig();
    createStartButtons();
  },
  handle(grid, elapsed) {
    const dt = Math.min(elapsed || 0, 0.1);
    clock += dt;
    keys = {};
    KEY_LIST.forEach((k) => {
      keys[k] = keyEdge(k);
    });
    if (!startButtons.length) createStartButtons();
    if ((gameState === 'play' || gameState === 'result' || gameState === 'over') && !boxes.length) gameState = 'start';
    if (gameState === 'result' && !lastResult) gameState = 'play';

    const ctx = MasterCanvas.get2dContext();
    ctx.save();
    if (shake > 0) {
      ctx.translate((Math.random() - 0.5) * shake, (Math.random() - 0.5) * shake);
      shake = Math.max(0, shake - dt * 30);
    }
    drawBackground(ctx);
    if (gameState === 'start') handleStart(ctx, grid, dt);
    else if (gameState === 'play') handlePlay(ctx, grid, dt);
    else if (gameState === 'result') handleResult(ctx, grid, dt);
    else if (gameState === 'over') handleOver(ctx, grid, dt);
    updateParticles(ctx, dt);
    ctx.restore();
  },
  stop() {
    particles = [];
  },
};
