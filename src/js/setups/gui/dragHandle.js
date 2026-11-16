/**
 * dragHandle – Objekt greifen, ziehen und ablegen.
 *
 * Zustände:
 *   'idle'     Laser auf dem Objekt füllen den Greif-Zähler (Füllrate ∝ Flächenanteil, wie pixelFillButton).
 *              Ist er voll (grabValue) → 'grabbed', onGrab.
 *   'grabbed'  Das Objekt folgt dem Schwerpunkt der Laser in seinem Fangkreis (radius * catchFactor),
 *              weich (followSmoothing) und mit Höchsttempo (maxSpeed). Sind dropDelay Sekunden lang keine
 *              Laser im Fangkreis → Ablegen: optional Einrasten am nächsten Punkt aus snapPoints
 *              (innerhalb snapDistance), dann onDrop und zurück nach 'idle'.
 *
 * Unterschied zu followCircle: Dort folgt das Objekt immer und jedem Laser in der Nähe. dragHandle
 * braucht erst ein bewusstes Greifen (Füllen) und kennt Loslassen – wildes Drüberleuchten reicht nicht.
 * Gedacht für: Puzzles, Kisten schieben, Karten legen, Türme platzieren, Sortierspiele.
 *
 * Optionen:
 *   posX, posY, radius = 60, edges = 0 (0 = Kreis, sonst n-Eck), label
 *   grabSpeed = 120 (Füllung/s bei voller Abdeckung), speedDown = 60, fullPercent = 25, grabValue = 100
 *   catchFactor = 1.6, followSmoothing = 10 (1/s), maxSpeed = 1500 (px/s), dropDelay = 0.4 (s)
 *   bounds        { x, y, width, height } – Bewegungsbereich (Standard: ganzer Bildschirm)
 *   snapPoints    [{ x, y }, ...], snapDistance = 80
 *   enabled = true, visible = true
 *   keyCodes      { grab, left, right, up, down } – grab greift/legt ab, Pfeile bewegen (Test ohne Laser),
 *                 per Taste gegriffen bleibt es gegriffen (kein Auto-Ablegen), bis grab erneut gedrückt wird,
 *                 keySpeed = 600 (px/s)
 *   normalColor, grabColor (beim Greifen), activeColor (gegriffen), lineWidth = 4
 *   onGrab(handle), onDrop(handle, snapIndex) (snapIndex = -1 ohne Einrasten), onMove(handle) (pro Frame
 *   während des Ziehens)
 *
 * Getter/Setter: X, Y, Radius, Color, Label, Value (Greif-Zähler), Enabled, SnapPoints.
 * Abfragen/Steuerung: getState(), isGrabbed(), getSnapIndex() (letztes Einrasten), grab(), drop().
 *
 * Beispiel:
 *   const kiste = guiDragHandle({
 *     posX: 300, posY: 500, edges: 4, snapPoints: zielFelder,
 *     onDrop: (k, i) => { if (i >= 0) belegt[i] = true; },
 *   });
 *   kiste.handle(grid, elapsed);
 */
import { scanCircle, isKeyDown, createKeyEdge, approach, clamp } from './gridScan.js';
var MasterCanvas = require('../../MasterCanvas').default;
var util = require('../../util.js').default;

export default ({
  label = '',
  posX,
  posY,
  radius = 60,
  edges = 0,
  grabSpeed = 120,
  speedDown = 60,
  fullPercent = 25,
  grabValue = 100,
  catchFactor = 1.6,
  followSmoothing = 10,
  maxSpeed = 1500,
  dropDelay = 0.4,
  bounds,
  snapPoints = [],
  snapDistance = 80,
  enabled = true,
  visible = true,
  keyCodes,
  keySpeed = 600,
  normalColor = '#0044ff',
  grabColor = '#0088ff',
  activeColor = '#00bbff',
  lineWidth = 4,
  onGrab,
  onDrop,
  onMove,
}) => {
  var x = posX;
  var y = posY;
  var currentRadius = radius;
  var currentColor = normalColor;
  var currentLabel = label;
  var currentEnabled = enabled;
  var currentSnapPoints = snapPoints;
  var state = 'idle';
  var counter = 0;
  var lostTimer = 0;
  var snapIndex = -1;
  var pressedOnce = createKeyEdge();

  function clampToBounds() {
    const canvas = MasterCanvas.getCanvas();
    const b = bounds || { x: 0, y: 0, width: canvas.width, height: canvas.height };
    x = clamp(x, b.x + currentRadius, b.x + b.width - currentRadius);
    y = clamp(y, b.y + currentRadius, b.y + b.height - currentRadius);
  }

  var heldByKey = false;

  function grab() {
    if (state === 'grabbed') return;
    state = 'grabbed';
    counter = grabValue;
    lostTimer = 0;
    if (onGrab) onGrab(result);
  }

  function drop() {
    if (state !== 'grabbed') return;
    snapIndex = -1;
    let bestD = snapDistance;
    currentSnapPoints.forEach((p, i) => {
      const d = Math.hypot(p.x - x, p.y - y);
      if (d <= bestD) {
        bestD = d;
        snapIndex = i;
      }
    });
    if (snapIndex >= 0) {
      x = currentSnapPoints[snapIndex].x;
      y = currentSnapPoints[snapIndex].y;
    }
    state = 'idle';
    counter = 0;
    heldByKey = false;
    if (onDrop) onDrop(result, snapIndex);
  }

  function shapePath(ctx, r) {
    ctx.beginPath();
    if (!edges) {
      ctx.arc(x, y, r, 0, Math.PI * 2);
    } else {
      for (let i = 0; i <= edges; i++) {
        const a = -Math.PI / 2 + (i * Math.PI * 2) / edges + (edges === 4 ? Math.PI / 4 : 0);
        if (i === 0) ctx.moveTo(x + Math.cos(a) * r, y + Math.sin(a) * r);
        else ctx.lineTo(x + Math.cos(a) * r, y + Math.sin(a) * r);
      }
      ctx.closePath();
    }
  }

  function draw() {
    const ctx = MasterCanvas.get2dContext();
    const grabbed = state === 'grabbed';
    const color = grabbed ? activeColor : counter > 0 ? grabColor : currentColor;
    ctx.save();
    if (grabbed) {
      ctx.shadowColor = color;
      ctx.shadowBlur = 20;
      ctx.globalAlpha = 0.35;
      ctx.strokeStyle = color;
      ctx.lineWidth = 2;
      ctx.setLineDash([10, 10]);
      ctx.beginPath();
      ctx.arc(x, y, currentRadius * catchFactor, 0, Math.PI * 2);
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.globalAlpha = 1;
    }
    ctx.globalAlpha = 0.25;
    ctx.fillStyle = color;
    shapePath(ctx, currentRadius);
    ctx.fill();
    ctx.globalAlpha = 1;
    ctx.strokeStyle = color;
    ctx.lineWidth = grabbed ? lineWidth * 1.5 : lineWidth;
    shapePath(ctx, currentRadius);
    ctx.stroke();
    if (!grabbed && counter > 0) {
      ctx.lineWidth = 10;
      ctx.beginPath();
      ctx.arc(x, y, currentRadius + 12, -Math.PI / 2, -Math.PI / 2 + (Math.PI * 2 * counter) / grabValue);
      ctx.stroke();
    }
    ctx.restore();
    if (currentLabel) util.renderText({ ctx, text: currentLabel, x, y: y + 10, fontSize: '30px', fillStyle: color });
  }

  var result = {
    name: 'GUI dragHandle',
    init: function () {},
    getX() {
      return x;
    },
    setX(v) {
      x = v;
    },
    getY() {
      return y;
    },
    setY(v) {
      y = v;
    },
    getRadius() {
      return currentRadius;
    },
    setRadius(v) {
      currentRadius = v;
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
    getValue() {
      return counter;
    },
    setValue(v) {
      counter = v;
    },
    getEnabled() {
      return currentEnabled;
    },
    setEnabled(v) {
      currentEnabled = !!v;
      if (!currentEnabled && state === 'grabbed') drop();
    },
    getSnapPoints() {
      return currentSnapPoints;
    },
    setSnapPoints(v) {
      currentSnapPoints = v || [];
    },
    getState() {
      return state;
    },
    isGrabbed() {
      return state === 'grabbed';
    },
    getSnapIndex() {
      return snapIndex;
    },
    grab,
    drop,
    handle: function (grid, elapsed) {
      if (currentEnabled) {
        if (keyCodes && pressedOnce(keyCodes.grab)) {
          if (state === 'grabbed') drop();
          else {
            grab();
            heldByKey = true; // per Taste gegriffen: bleibt gegriffen, bis grab erneut gedrückt wird
          }
        }
        if (state === 'idle') {
          const s = scanCircle(grid, x, y, currentRadius);
          if (s.count > 0) {
            const rate = Math.min(1, s.percent / Math.max(0.001, fullPercent));
            counter = Math.min(grabValue, counter + grabSpeed * rate * elapsed);
          } else {
            counter = Math.max(0, counter - speedDown * elapsed);
          }
          if (counter >= grabValue) grab();
        } else {
          let kx = 0;
          let ky = 0;
          if (keyCodes) {
            if (isKeyDown(keyCodes.left)) kx -= 1;
            if (isKeyDown(keyCodes.right)) kx += 1;
            if (isKeyDown(keyCodes.up)) ky -= 1;
            if (isKeyDown(keyCodes.down)) ky += 1;
          }
          if (kx || ky) {
            x += kx * keySpeed * elapsed;
            y += ky * keySpeed * elapsed;
            lostTimer = 0;
          } else {
            const s = scanCircle(grid, x, y, currentRadius * catchFactor);
            if (s.count > 0) {
              const nx = approach(x, s.x, followSmoothing, elapsed);
              const ny = approach(y, s.y, followSmoothing, elapsed);
              const dx = nx - x;
              const dy = ny - y;
              const d = Math.sqrt(dx * dx + dy * dy);
              const max = maxSpeed * elapsed;
              const f = d > max && d > 0 ? max / d : 1;
              x += dx * f;
              y += dy * f;
              lostTimer = 0;
            } else if (!heldByKey) {
              lostTimer += elapsed;
            }
          }
          clampToBounds();
          if (onMove) onMove(result);
          if (lostTimer >= dropDelay) drop();
        }
      }
      if (visible) draw();
    },
  };
  return result;
};
