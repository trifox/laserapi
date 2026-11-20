/**
 * Zellphysik (Fallsand / Felssturz) – wiederverwendbares Plattform-Modul
 *
 * Ein grobes Raster aus Zellen (cols × rows), jede Zelle hat genau EINEN Typ (0..255, Uint8Array).
 * Was ein Typ tut, legen Flags in einer Typ-Tabelle fest – das Modul kennt keine Spielbegriffe:
 *
 *   falls         fällt nach unten in leere Zellen (Felsen, Diamanten, Sand ...)
 *   round         Dinge, die auf dieser Zelle liegen, rollen seitlich ab (Felsen, Diamanten, Ziegel)
 *   crushable     wird von einem FALLENDEN Objekt getroffen -> onCrush (Spielfigur, Gegner)
 *   indestructible  übersteht explode() (Stahlrand, Ausgang)
 *   grows         wächst mit growChance pro Schritt in eine zufällige Nachbarzelle, deren Typ in growInto steht
 *   growInto      Liste von Typen, in die gewachsen werden darf (z. B. [EMPTY, EARTH])
 *   growChance    Wahrscheinlichkeit pro Zelle und Schritt (zur Laufzeit: setGrowChance)
 *
 * Regeln pro step() (Boulder-Dash-Physik, Zeilen von unten nach oben, Spaltenrichtung wechselt jeden Schritt,
 * damit nichts systematisch nach links driftet; jede Zelle bewegt sich höchstens einmal pro Schritt):
 *   1. Unter einem falls-Objekt ist leer        -> es fällt eine Zelle, ist ab jetzt "fallend".
 *   2. Darunter liegt crushable und es fällt     -> onCrush(...) (Spiel entscheidet: Leben weg, Explosion ...).
 *   3. Darunter liegt etwas round, das nicht fällt -> rollt nach links (bzw. rechts), wenn Seite UND
 *      Seite-unten leer sind (zuerst links, dann rechts; abwechselnd bevorzugt bei alternate: true).
 *   4. Sonst: war es fallend -> onLand(...), Ruhe.
 *   5. grows-Zellen wachsen zufällig; step() meldet, ob überhaupt noch Platz zum Wachsen da ist.
 * Ruhende Felsen zerdrücken nichts: Nur wer im Fallen getroffen wird, wird platt (wie im Original).
 *
 * Komplexität: O(cols · rows) pro Schritt, O(1) pro Zelle, keine Allokation im Schritt (nur Typed Arrays).
 * Gemessen (Node): 48×24 = 1152 Zellen ≈ 0,03 ms pro Schritt; 480×270 (130 k Zellen) ≈ 3 ms – dort lohnt GPU/Aktivliste.
 * Mit fester Schrittrate (z. B. 10/s) ist das unabhängig von der Bildrate. Ausbau: eine Liste "aktiver"
 * Zellen (nur Zellen neben Änderungen prüfen) macht es O(Anzahl bewegter Objekte).
 *
 * GPU-tauglich: Das ist ein Zellautomat. Für gpu.js formuliert man die Regeln als "Gather" statt "Push":
 * jede Zelle entscheidet aus ihrer 3×3-Nachbarschaft, was sie im NÄCHSTEN Zustand ist (kommt von oben etwas
 * herunter? rollt von oben-links etwas herein?). Konflikte (zwei Felsen wollen in dieselbe Zelle) löst eine
 * feste Priorität (oben vor oben-links vor oben-rechts) oder Margolus-2×2-Blöcke mit wechselndem Versatz.
 * Dann ist ein Schritt ein einziger Kernel-Aufruf, O(1) pro Zelle parallel – auch für Fallsand in Pixelauflösung.
 *
 * Verwendung:
 *   import createCellPhysics from './game-055-cellphysics';
 *   const phys = createCellPhysics({
 *     cols: 48, rows: 24, empty: 0,
 *     types: { 3: { falls: true, round: true }, 5: { crushable: true }, 2: { indestructible: true } },
 *     onLand: (x, y, type, index) => {}, onCrush: (x, y, victimType, byType, victimIndex) => {},
 *     onGrow: (x, y, type, index) => {},
 *   });
 *   phys.set(x, y, 3); phys.step(); phys.cells[index]; phys.consumeChanged((index) => redraw(index));
 *
 * Schnittstelle (Index = x + y * cols):
 *   cells (Uint8Array, nur lesen!), cols, rows, index(x, y), xOf(i), yOf(i), inside(x, y)
 *   get(x, y), getAt(i), set(x, y, type), setAt(i, type), move(from, to) (Ziel wird überschrieben)
 *   isFalling(i), setFalling(i, bool), getCameFrom(i) (Herkunft der letzten Bewegung, -1 = keine; zum Interpolieren)
 *   step() -> { moved, landed, growCells, canGrow }, settle(n) (n stille Schritte, keine Callbacks)
 *   explode(cx, cy, radius, fillType, onCell) – Quadrat um (cx, cy); onCell(i, oldType) vor dem Überschreiben
 *   count(type), replaceAll(fromType, toType), fill(type), setGrowChance(type, p), getTick()
 *   consumeChanged(fn) – fn(i) für jede Zelle, deren Typ sich seit dem letzten Aufruf geändert hat
 *   setCallbacks({ onLand, onCrush, onGrow })
 */

const F_FALLS = 1;
const F_ROUND = 2;
const F_CRUSHABLE = 4;
const F_INDESTRUCTIBLE = 8;
const F_GROWS = 16;

export default function createCellPhysics(options) {
  const opts = options || {};
  const cols = Math.max(1, opts.cols | 0 || 40);
  const rows = Math.max(1, opts.rows | 0 || 25);
  const n = cols * rows;
  const EMPTY = opts.empty | 0;
  const random = opts.random || Math.random;

  const cells = new Uint8Array(n);
  const falling = new Uint8Array(n);
  const stamp = new Uint32Array(n); // Schritt, in dem die Zelle zuletzt bewegt wurde
  const cameFrom = new Int32Array(n).fill(-1);
  const movedList = new Int32Array(n);
  let movedCount = 0;
  const changedFlag = new Uint8Array(n);
  const changedList = new Int32Array(n);
  let changedCount = 0;

  const flags = new Uint8Array(256);
  const growMask = []; // pro Typ: Uint8Array(256) erlaubter Zieltypen
  const growChance = new Float32Array(256);

  let onLand = opts.onLand || null;
  let onCrush = opts.onCrush || null;
  let onGrow = opts.onGrow || null;
  let muted = false;
  let tick = 1;
  let leftFirst = true;

  const typeTable = opts.types || {};
  Object.keys(typeTable).forEach((key) => {
    const t = key | 0;
    const def = typeTable[key] || {};
    let f = 0;
    if (def.falls) f |= F_FALLS;
    if (def.round) f |= F_ROUND;
    if (def.crushable) f |= F_CRUSHABLE;
    if (def.indestructible) f |= F_INDESTRUCTIBLE;
    if (def.grows) {
      f |= F_GROWS;
      const mask = new Uint8Array(256);
      (def.growInto || [EMPTY]).forEach((g) => (mask[g & 255] = 1));
      growMask[t] = mask;
      growChance[t] = def.growChance === undefined ? 0.02 : def.growChance;
    }
    flags[t] = f;
  });

  function markChanged(i) {
    if (!changedFlag[i]) {
      changedFlag[i] = 1;
      changedList[changedCount++] = i;
    }
  }

  function setAt(i, type) {
    if (i < 0 || i >= n) return;
    const t = type & 255;
    if (cells[i] !== t) {
      cells[i] = t;
      markChanged(i);
    }
    falling[i] = 0;
  }

  function move(from, to) {
    if (from === to || from < 0 || to < 0 || from >= n || to >= n) return;
    const t = cells[from];
    cells[to] = t;
    falling[to] = falling[from];
    cells[from] = EMPTY;
    falling[from] = 0;
    stamp[to] = tick;
    cameFrom[to] = from;
    movedList[movedCount++] = to;
    markChanged(from);
    markChanged(to);
  }

  const DX4 = [1, -1, 0, 0];
  const DY4 = [0, 0, 1, -1];

  function step() {
    tick++;
    // Herkunftsmarken des letzten Schritts löschen
    for (let k = 0; k < movedCount; k++) cameFrom[movedList[k]] = -1;
    movedCount = 0;
    leftFirst = !leftFirst;
    const ltr = (tick & 1) === 0;
    let moved = 0;
    let landed = 0;
    let growCells = 0;
    let canGrow = false;

    for (let y = rows - 1; y >= 0; y--) {
      const rowBase = y * cols;
      for (let s = 0; s < cols; s++) {
        const x = ltr ? s : cols - 1 - s;
        const i = rowBase + x;
        const t = cells[i];
        if (t === EMPTY) continue;
        const f = flags[t];
        if (f === 0) continue;
        if (stamp[i] === tick) continue; // in diesem Schritt schon bewegt

        if (f & F_GROWS) {
          growCells++;
          const mask = growMask[t];
          // Platz zum Wachsen? (für "eingeschlossen"-Erkennung)
          if (!canGrow) {
            for (let d = 0; d < 4; d++) {
              const nx = x + DX4[d];
              const ny = y + DY4[d];
              if (nx >= 0 && ny >= 0 && nx < cols && ny < rows && mask[cells[nx + ny * cols]]) {
                canGrow = true;
                break;
              }
            }
          }
          if (random() < growChance[t]) {
            const d = (random() * 4) | 0;
            const nx = x + DX4[d];
            const ny = y + DY4[d];
            if (nx >= 0 && ny >= 0 && nx < cols && ny < rows) {
              const j = nx + ny * cols;
              if (mask[cells[j]]) {
                cells[j] = t;
                falling[j] = 0;
                stamp[j] = tick; // neue Zelle wächst erst im nächsten Schritt weiter
                markChanged(j);
                if (onGrow && !muted) onGrow(nx, ny, t, j);
              }
            }
          }
        }

        if (!(f & F_FALLS) || y === rows - 1) {
          if ((f & F_FALLS) && falling[i]) {
            falling[i] = 0;
            landed++;
            if (onLand && !muted) onLand(x, y, t, i);
          }
          continue;
        }

        const below = i + cols;
        const tb = cells[below];
        if (tb === EMPTY) {
          move(i, below);
          falling[below] = 1;
          moved++;
          continue;
        }
        const fb = flags[tb];
        if ((fb & F_CRUSHABLE) && falling[i]) {
          if (onCrush && !muted) onCrush(x, y + 1, tb, t, below);
          // Hat das Spiel das Opfer entfernt, fällt der Stein beim nächsten Schritt weiter.
          if (cells[i] === t && cells[below] !== EMPTY) {
            falling[i] = 0;
            landed++;
            if (onLand && !muted) onLand(x, y, t, i);
          }
          continue;
        }
        if ((fb & F_ROUND) && !falling[below]) {
          let done = false;
          for (let pass = 0; pass < 2 && !done; pass++) {
            const dir = (pass === 0) === leftFirst ? -1 : 1;
            const sx = x + dir;
            if (sx < 0 || sx >= cols) continue;
            const side = i + dir;
            if (cells[side] === EMPTY && cells[side + cols] === EMPTY) {
              move(i, side);
              falling[side] = 1;
              moved++;
              done = true;
            }
          }
          if (done) continue;
        }
        if (falling[i]) {
          falling[i] = 0;
          landed++;
          if (onLand && !muted) onLand(x, y, t, i);
        }
      }
    }
    return { moved, landed, growCells, canGrow };
  }

  const api = {
    cells,
    cols,
    rows,
    size: n,
    index: (x, y) => x + y * cols,
    xOf: (i) => i % cols,
    yOf: (i) => (i / cols) | 0,
    inside: (x, y) => x >= 0 && y >= 0 && x < cols && y < rows,
    get: (x, y) => (x >= 0 && y >= 0 && x < cols && y < rows ? cells[x + y * cols] : -1),
    getAt: (i) => (i >= 0 && i < n ? cells[i] : -1),
    set: (x, y, type) => {
      if (x >= 0 && y >= 0 && x < cols && y < rows) setAt(x + y * cols, type);
    },
    setAt,
    move,
    isFalling: (i) => i >= 0 && i < n && falling[i] === 1,
    setFalling: (i, v) => {
      if (i >= 0 && i < n) falling[i] = v ? 1 : 0;
    },
    getCameFrom: (i) => cameFrom[i],
    hasFlag: (type, name) => {
      const m = { falls: F_FALLS, round: F_ROUND, crushable: F_CRUSHABLE, indestructible: F_INDESTRUCTIBLE, grows: F_GROWS };
      return (flags[type & 255] & (m[name] || 0)) !== 0;
    },
    step,
    /** n Schritte ohne Callbacks (Level nach dem Erzeugen "setzen" lassen) */
    settle: (steps) => {
      muted = true;
      for (let k = 0; k < (steps | 0); k++) step();
      muted = false;
      for (let k = 0; k < movedCount; k++) cameFrom[movedList[k]] = -1;
      movedCount = 0;
    },
    /** Quadrat (2·radius+1)² um (cx, cy) mit fillType füllen, indestructible bleibt */
    explode: (cx, cy, radius, fillType, onCell) => {
      const r = radius === undefined ? 1 : radius;
      for (let y = cy - r; y <= cy + r; y++) {
        for (let x = cx - r; x <= cx + r; x++) {
          if (x < 0 || y < 0 || x >= cols || y >= rows) continue;
          const i = x + y * cols;
          if (flags[cells[i]] & F_INDESTRUCTIBLE) continue;
          if (onCell) onCell(i, cells[i]);
          setAt(i, fillType);
          stamp[i] = tick;
        }
      }
    },
    count: (type) => {
      let c = 0;
      for (let i = 0; i < n; i++) if (cells[i] === type) c++;
      return c;
    },
    replaceAll: (fromType, toType) => {
      for (let i = 0; i < n; i++) if (cells[i] === fromType) setAt(i, toType);
    },
    fill: (type) => {
      for (let i = 0; i < n; i++) setAt(i, type);
      falling.fill(0);
    },
    setGrowChance: (type, p) => {
      growChance[type & 255] = p;
    },
    getTick: () => tick,
    consumeChanged: (fn) => {
      for (let k = 0; k < changedCount; k++) {
        const i = changedList[k];
        changedFlag[i] = 0;
        if (fn) fn(i);
      }
      changedCount = 0;
    },
    setCallbacks: (cb) => {
      if (!cb) return;
      if (cb.onLand !== undefined) onLand = cb.onLand;
      if (cb.onCrush !== undefined) onCrush = cb.onCrush;
      if (cb.onGrow !== undefined) onGrow = cb.onGrow;
    },
  };
  return api;
}
