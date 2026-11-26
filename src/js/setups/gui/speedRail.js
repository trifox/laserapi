/**
 * speedRail – Abschussrampe: misst, wie schnell die Laser GEMEINSAM durch einen Streifen laufen,
 * und wird am Ende zur Kanonenkugel (onRelease mit der gemessenen Geschwindigkeit).
 *
 * Der Streifen ist in `columns` Spalten geteilt (Lichtschranken). Verfolgt wird der Schwerpunkt ALLER Laser im
 * Streifen – es zählt also immer die ganze Reihe zusammen (Teamkugel), einzelne Laser sind nicht unterscheidbar.
 *
 * Ablauf:
 *   'idle'      Wartet, bis der Schwerpunkt in der Startspalte liegt (Spalte 0 bzw. die letzte bei direction 'left').
 *   'run'       Die Kugel läuft mit. Jede neu erreichte Spalte bekommt einen Zeitstempel, die Geschwindigkeit ist
 *               (zurückgelegte Spalten × Spaltenbreite) / Zeit seit der Startspalte (px/s).
 *               Erreicht der Schwerpunkt die letzte Spalte → onRelease(speed, info), dann 'cooldown'.
 *   'abort'     Lauf abgebrochen (kurz sichtbar), danach 'idle'. Gründe (onAbort(reason)):
 *                 'rueckwaerts' Schwerpunkt mehr als backTolerance Spalten zurück
 *                 'sprung'      mehr als maxSkip Spalten in einem Frame übersprungen (Laser springt rein/raus)
 *                 'uneinig'     Laser zu weit verstreut (spread > maxSpread) – wildes Herumleuchten
 *                 'verloren'    länger als lostDelay keine Laser im Streifen
 *                 'zeit'        Lauf dauert länger als maxRunTime
 *   'cooldown'  Kurze Sperre nach dem Abschuss (cooldown s), danach 'idle'. Neuer Lauf = wieder in der Startspalte beginnen.
 *
 * Tempo-Ampel: Mit setTargetSpeed(v) bekommt die Kugel live eine Bewertung (getRating()):
 *   'slow'  speed < targetSpeed * closeFactor   (zu langsam)
 *   'close' speed < targetSpeed                 (knapp)
 *   'ok'    speed >= targetSpeed                (reicht)
 * Die Kugel wird entsprechend in slowColor / closeColor / okColor gezeichnet und wächst mit dem Fortschritt.
 *
 * Hinweis Kamera/Engine: Bei ~30 fps und Nachleuchten springt ein schneller Laser 150–250 px pro Frame.
 * Spalten deshalb nicht schmaler als ~120 px machen; maxSkip erlaubt übersprungene Spalten (werden interpoliert).
 *
 * Optionen:
 *   posX, posY (Mittelpunkt), width = 840, height = 150, columns = 7, direction = 'right' | 'left'
 *   targetSpeed = 1000 (px/s), closeFactor = 0.75
 *   maxSkip = 2, backTolerance = 1, maxSpread (Standard: 1.5 Spaltenbreiten), lostDelay = 0.25 s,
 *   maxRunTime = 4 s, cooldown = 0.4 s, abortShowTime = 0.5 s
 *   keyCode – Taste startet einen simulierten Lauf mit keySpeed (px/s, Standard 1100) zum Testen ohne Laser
 *   visible = true, label, normalColor (Rahmen/Spalten), slowColor, closeColor, okColor, lineWidth = 3
 *   onStart(rail), onRelease(speed, info, rail), onAbort(reason, rail)
 *     info = { x, y (Abschusspunkt = Ende des Streifens), duration, rating, direction (+1/-1) }
 *
 * Getter/Setter: X, Y, Width, Height, Radius (halbe Höhe), Color, Label, TargetSpeed, KeySpeed, Enabled.
 * Abfragen: getState(), getSpeed() (live), getLastSpeed(), getRating(), getProgress() (0..1),
 *   getBallX()/getBallY(), getAbortReason(), reset().
 *
 * Beispiel:
 *   const rampe = guiSpeedRail({
 *     posX: 460, posY: 300, targetSpeed: 900, keyCode: 'Digit1',
 *     onRelease: (speed, info) => kugeln.push({ x: info.x, y: info.y, vx: speed, vy: 0 }),
 *   });
 *   rampe.handle(grid, elapsed);
 */
import { scanRect, createKeyEdge } from './gridScan.js';
var MasterCanvas = require('../../MasterCanvas').default;
var util = require('../../util.js').default;

// Anzeige-Texte der Abbruchgründe
const ABORT_TEXT = { rueckwaerts: 'rückwärts!', sprung: 'Sprung!', uneinig: 'uneinig!', verloren: 'verloren', zeit: 'zu lahm' };

export default ({
  posX,
  posY,
  width = 840,
  height = 150,
  columns = 7,
  direction = 'right',
  targetSpeed = 1000,
  closeFactor = 0.75,
  maxSkip = 2,
  backTolerance = 1,
  maxSpread,
  lostDelay = 0.25,
  maxRunTime = 4,
  cooldown = 0.4,
  abortShowTime = 0.5,
  keyCode,
  keySpeed = 1100,
  visible = true,
  enabled = true,
  label = '',
  normalColor = '#335577',
  slowColor = '#aa3355',
  closeColor = '#aa8833',
  okColor = '#33aa77',
  lineWidth = 3,
  onStart,
  onRelease,
  onAbort,
}) => {
  var x = posX;
  var y = posY;
  var w = width;
  var h = height;
  var currentColor = normalColor;
  var currentLabel = label;
  var currentTarget = targetSpeed;
  var currentKeySpeed = keySpeed;
  var currentEnabled = enabled;
  var dirSign = direction === 'left' ? -1 : 1;
  var state = 'idle';
  var clock = 0; // interne Zeit in s (aus elapsed summiert)
  var stateTimer = 0;
  var lostTimer = 0;
  var headCol = 0; // höchste erreichte Spalte (in Laufrichtung gezählt, 0 = Start)
  var startTime = 0;
  var headTime = 0;
  var speed = 0;
  var lastSpeed = 0;
  var ballX = 0;
  var abortReason = '';
  var keyRunX = null; // simulierter Schwerpunkt beim Tastatur-Lauf
  var pressedOnce = createKeyEdge();

  const colWidth = () => w / columns;
  const left = () => x - w / 2;
  const top = () => y - h / 2;
  const startX = () => (dirSign > 0 ? left() : left() + w);

  /** Pixel-x → Spalte in Laufrichtung (0 = Startspalte) */
  function toCol(px) {
    const c = Math.floor((px - left()) / colWidth());
    const clamped = Math.max(0, Math.min(columns - 1, c));
    return dirSign > 0 ? clamped : columns - 1 - clamped;
  }

  /** Mitte einer Spalte (in Laufrichtung gezählt) in Pixeln */
  function colCenter(col) {
    return startX() + dirSign * (col + 0.5) * colWidth();
  }

  function rating() {
    if (speed >= currentTarget) return 'ok';
    if (speed >= currentTarget * closeFactor) return 'close';
    return 'slow';
  }

  function setState(s) {
    state = s;
    stateTimer = 0;
  }

  function abort(reason) {
    abortReason = reason;
    keyRunX = null;
    setState('abort');
    if (onAbort) onAbort(reason, result);
  }

  function release() {
    lastSpeed = speed;
    keyRunX = null;
    const info = {
      x: startX() + dirSign * w,
      y,
      duration: headTime - startTime,
      rating: rating(),
      direction: dirSign,
    };
    setState('cooldown');
    if (onRelease) onRelease(lastSpeed, info, result);
  }

  function update(grid, elapsed) {
    clock += elapsed;
    stateTimer += elapsed;

    if (keyCode && pressedOnce(keyCode) && state === 'idle') {
      keyRunX = startX() + dirSign * colWidth() * 0.5;
    }

    // Schwerpunkt bestimmen: simulierter Lauf oder Scan des Streifens
    let has = false;
    let cx = 0;
    let spread = 0;
    if (keyRunX !== null) {
      keyRunX += dirSign * currentKeySpeed * elapsed;
      has = true;
      cx = keyRunX;
    } else if (grid) {
      const s = scanRect(grid, left(), top(), w, h);
      has = s.hasLaser;
      cx = s.x;
      spread = s.spread;
    }

    if (state === 'abort' && stateTimer >= abortShowTime) setState('idle');
    if (state === 'cooldown' && stateTimer >= cooldown) setState('idle');

    if (state === 'idle') {
      speed = 0;
      if (has && toCol(cx) === 0) {
        headCol = 0;
        startTime = clock;
        headTime = clock;
        lostTimer = 0;
        ballX = colCenter(0);
        setState('run');
        if (onStart) onStart(result);
      }
      return;
    }

    if (state !== 'run') return;

    if (!has) {
      lostTimer += elapsed;
      if (lostTimer >= lostDelay) abort('verloren');
      return;
    }
    lostTimer = 0;
    const limitSpread = maxSpread === undefined ? colWidth() * 1.5 : maxSpread;
    if (spread > limitSpread) return abort('uneinig');
    if (clock - startTime > maxRunTime) return abort('zeit');

    const col = toCol(cx);
    if (col < headCol - backTolerance) return abort('rueckwaerts');
    if (col > headCol) {
      if (col - headCol > maxSkip + 1) return abort('sprung');
      headCol = col;
      headTime = clock;
      const dt = headTime - startTime;
      speed = dt > 0 ? (headCol * colWidth()) / dt : 0;
    }
    // Kugel folgt dem Schwerpunkt, aber nie hinter die Startspalte und nie über das Ende hinaus
    const minX = Math.min(startX(), startX() + dirSign * w);
    const maxX = Math.max(startX(), startX() + dirSign * w);
    ballX = Math.max(minX, Math.min(maxX, cx));
    if (headCol >= columns - 1) release();
  }

  function draw() {
    const ctx = MasterCanvas.get2dContext();
    const cw = colWidth();
    ctx.save();
    ctx.strokeStyle = currentColor;
    ctx.lineWidth = lineWidth;
    ctx.strokeRect(left(), top(), w, h);
    ctx.globalAlpha = 0.35;
    ctx.lineWidth = 1;
    for (let i = 1; i < columns; i++) {
      ctx.beginPath();
      ctx.moveTo(left() + i * cw, top() + 8);
      ctx.lineTo(left() + i * cw, top() + h - 8);
      ctx.stroke();
    }
    // Startspalte markieren (Pfeile in Laufrichtung)
    ctx.globalAlpha = state === 'idle' ? 0.5 + 0.3 * Math.sin(clock * 5) : 0.25;
    ctx.lineWidth = lineWidth;
    const sx = colCenter(0);
    for (let k = -1; k <= 1; k++) {
      const ax = sx + k * 18 * dirSign;
      ctx.beginPath();
      ctx.moveTo(ax - 10 * dirSign, y - 18);
      ctx.lineTo(ax + 6 * dirSign, y);
      ctx.lineTo(ax - 10 * dirSign, y + 18);
      ctx.stroke();
    }
    ctx.globalAlpha = 1;

    if (state === 'run') {
      const progress = headCol / Math.max(1, columns - 1);
      const r = h * (0.15 + 0.2 * progress);
      const col = { slow: slowColor, close: closeColor, ok: okColor }[rating()];
      // Fortschrittsbalken unten im Streifen
      ctx.fillStyle = col;
      ctx.globalAlpha = 0.5;
      const barW = (headCol + 1) * cw;
      ctx.fillRect(dirSign > 0 ? left() : left() + w - barW, top() + h - 8, barW, 5);
      ctx.globalAlpha = 1;
      ctx.shadowColor = col;
      ctx.shadowBlur = 25;
      ctx.strokeStyle = col;
      ctx.lineWidth = 5;
      ctx.beginPath();
      ctx.arc(ballX, y, r, 0, Math.PI * 2);
      ctx.stroke();
      ctx.shadowBlur = 0;
      if (speed > 0) {
        util.renderText({ ctx, text: `${Math.round(speed)}`, x: ballX, y: top() + 34, fontSize: '28px', fillStyle: col });
      }
    } else if (state === 'abort') {
      ctx.globalAlpha = 1 - stateTimer / abortShowTime;
      util.renderText({ ctx, text: ABORT_TEXT[abortReason] || abortReason, x, y: y + 12, fontSize: '40px', fillStyle: slowColor });
    }
    if (currentLabel) {
      ctx.globalAlpha = 0.7;
      util.renderText({ ctx, text: currentLabel, x: left() + 30, y: top() + 34, fontSize: '28px', fillStyle: currentColor });
    }
    ctx.restore();
  }

  var result = {
    name: 'GUI speedRail',
    init: function () {},
    getX: () => x,
    setX(v) {
      x = v;
    },
    getY: () => y,
    setY(v) {
      y = v;
    },
    getWidth: () => w,
    setWidth(v) {
      w = v;
    },
    getHeight: () => h,
    setHeight(v) {
      h = v;
    },
    getRadius: () => h / 2,
    setRadius(v) {
      h = v * 2;
    },
    getColor: () => currentColor,
    setColor(v) {
      currentColor = v;
    },
    getLabel: () => currentLabel,
    setLabel(v) {
      currentLabel = v;
    },
    getTargetSpeed: () => currentTarget,
    setTargetSpeed(v) {
      currentTarget = v;
    },
    getKeySpeed: () => currentKeySpeed,
    setKeySpeed(v) {
      currentKeySpeed = v;
    },
    getEnabled: () => currentEnabled,
    setEnabled(v) {
      currentEnabled = !!v;
      if (!currentEnabled) result.reset();
    },
    getState: () => state,
    getSpeed: () => speed,
    getLastSpeed: () => lastSpeed,
    getRating: rating,
    getProgress: () => (state === 'run' ? headCol / Math.max(1, columns - 1) : 0),
    getBallX: () => ballX,
    getBallY: () => y,
    getAbortReason: () => abortReason,
    reset() {
      keyRunX = null;
      speed = 0;
      setState('idle');
    },
    handle(grid, elapsed) {
      if (currentEnabled) update(grid, elapsed);
      if (visible) draw();
    },
  };
  return result;
};
