/**
 * regionButton – Füllfeld mit beliebiger Form (Polygon statt Kreis).
 *
 * Funktioniert wie pixelFillButton: gemessen wird der ANTEIL leuchtender Grid-Zellen innerhalb der Form
 * (getFillPercent(), 0..100), mehr Laser = schnelleres Füllen. Bei activeValue löst onEnterActive aus.
 * Gedacht für Länder/Gebiete auf Karten, Spielfelder, Sitzbereiche, unregelmässige Ziele.
 *
 * Füllrate pro Sekunde = speedUp * min(1, fillPercent / fullPercent); unter minPercent sinkt der Zähler
 * mit speedDown. Anders als bei pixelFillButton sind speedUp/speedDown/fullPercent zur Laufzeit änderbar
 * (z. B. "stark verteidigte Gebiete füllen sich langsamer").
 *
 * Optionen:
 *   polygon       [{x, y}, ...] oder [[x, y], ...] in Canvas-Pixeln: Umriss (Zeichnen + Suchbereich)
 *   contains      optional (x, y) => bool: genauer Test in ORIGINAL-Koordinaten (vor setX/setY/setRadius),
 *                 z. B. für Gebiete aus Sechseck-Zellen. Ohne contains gilt der Punkt-in-Polygon-Test.
 *   label, speedUp = 100, speedDown = 50, fullPercent = 50, minPercent = 0,
 *   activeValue = 75, minValue = 25, counterReset = false (nach Auslösen auf 0),
 *   enabled = true (false: misst nicht, Zähler bleibt stehen), visible = true,
 *   keyCode       Taste füllt ZUSÄTZLICH mit voller Rate (Laser bleiben aktiv) – zum Testen
 *   normalColor, growColor, activeColor, lineWidth = 3, fillAlpha = 0.25 (Deckkraft der Fläche),
 *   onEnterActive(button), onExitActive(button)
 *
 * Getter/Setter: X/Y (Schwerpunkt der Form; Setzen verschiebt die Form), Radius (grösster Abstand
 *   Schwerpunkt–Ecke; Setzen skaliert), Color/GrowColor/ActiveColor, Label, Value/Counter, SpeedUp,
 *   SpeedDown, FullPercent, Enabled; getFillPercent(), getState() ('normal' | 'grow' | 'active'),
 *   getPolygon() (aktuelle Eckpunkte), setPolygon(neu), containsPoint(x, y).
 *
 * Leistung: Die Zellen innerhalb der Form werden pro Grid-Auflösung und Form einmal berechnet und
 * gecacht – pro Frame wird nur noch gezählt.
 *
 * Beispiel:
 *   const land = guiRegionButton({
 *     polygon: [[200, 200], [500, 180], [560, 420], [260, 480]],
 *     speedUp: 60, fullPercent: 25, counterReset: true,
 *     onEnterActive: () => erobern(land),
 *   });
 *   land.handle(grid, elapsed); // jeden Frame
 */
import { getGridGeometry, getCellRange, pointInPolygon, isKeyDown } from './gridScan.js';
var MasterCanvas = require('../../MasterCanvas').default;
var util = require('../../util.js').default;

function toPoints(polygon) {
  return (polygon || []).map((p) => (Array.isArray(p) ? { x: p[0], y: p[1] } : { x: p.x, y: p.y }));
}

function polygonCentroid(pts) {
  if (!pts.length) return { x: 0, y: 0 };
  let a = 0;
  let cx = 0;
  let cy = 0;
  for (let i = 0; i < pts.length; i++) {
    const p = pts[i];
    const q = pts[(i + 1) % pts.length];
    const f = p.x * q.y - q.x * p.y;
    a += f;
    cx += (p.x + q.x) * f;
    cy += (p.y + q.y) * f;
  }
  if (Math.abs(a) < 1e-6) {
    // entartete Form: Mittelwert der Ecken
    return {
      x: pts.reduce((s, p) => s + p.x, 0) / pts.length,
      y: pts.reduce((s, p) => s + p.y, 0) / pts.length,
    };
  }
  return { x: cx / (3 * a), y: cy / (3 * a) };
}

export default ({
  label = '',
  polygon = [],
  contains,
  speedUp = 100,
  speedDown = 50,
  fullPercent = 50,
  minPercent = 0,
  activeValue = 75,
  minValue = 25,
  counterReset = false,
  enabled = true,
  visible = true,
  keyCode,
  lineWidth = 3,
  fillAlpha = 0.25,
  normalColor = '#0044ff',
  growColor = '#0088ff',
  activeColor = '#00bbff',
  onEnterActive,
  onExitActive,
}) => {
  var basePoints = [];
  var base = { x: 0, y: 0 };
  var baseRadius = 50;
  var points = [];
  var offX = 0;
  var offY = 0;
  var scale = 1;
  var version = 0;
  var cacheKey = '';
  var cacheCells = [];
  var counter = 0;
  var fillPercent = 0;
  var state = 'normal';
  var currentLabel = label;
  var currentColor = normalColor;
  var currentGrowColor = growColor;
  var currentActiveColor = activeColor;
  var currentSpeedUp = speedUp;
  var currentSpeedDown = speedDown;
  var currentFullPercent = fullPercent;
  var currentEnabled = enabled;

  function setBase(polygonInput) {
    basePoints = toPoints(polygonInput);
    base = polygonCentroid(basePoints);
    baseRadius = basePoints.reduce((m, p) => Math.max(m, Math.hypot(p.x - base.x, p.y - base.y)), 0) || 50;
    offX = 0;
    offY = 0;
    scale = 1;
    transform();
  }

  function transform() {
    points = basePoints.map((p) => ({
      x: base.x + (p.x - base.x) * scale + offX,
      y: base.y + (p.y - base.y) * scale + offY,
    }));
    version++;
  }

  function centerX() {
    return base.x + offX;
  }

  function centerY() {
    return base.y + offY;
  }

  function containsPoint(x, y) {
    if (contains) {
      return !!contains(base.x + (x - offX - base.x) / scale, base.y + (y - offY - base.y) / scale);
    }
    return pointInPolygon(x, y, points);
  }

  /** Indizes der Grid-Zellen in der Form (gecacht pro Auflösung + Form) */
  function cellsInside(grid) {
    const geo = getGridGeometry(grid);
    const key = geo.size + ':' + version;
    if (key === cacheKey) return cacheCells;
    cacheKey = key;
    cacheCells = [];
    if (!points.length || !geo.size) return cacheCells;
    let minX = Infinity;
    let minY = Infinity;
    let maxX = -Infinity;
    let maxY = -Infinity;
    points.forEach((p) => {
      minX = Math.min(minX, p.x);
      minY = Math.min(minY, p.y);
      maxX = Math.max(maxX, p.x);
      maxY = Math.max(maxY, p.y);
    });
    const r = getCellRange(geo, minX, minY, maxX - minX, maxY - minY);
    if (r) {
      for (let gy = r.y0; gy <= r.y1; gy++) {
        for (let gx = r.x0; gx <= r.x1; gx++) {
          if (containsPoint((gx + 0.5) * geo.fx, (gy + 0.5) * geo.fy)) cacheCells.push(gx + gy * geo.size);
        }
      }
    }
    if (!cacheCells.length) {
      // Form kleiner als eine Zelle: die Zelle unter dem Schwerpunkt zählt
      const gx = Math.floor(centerX() / geo.fx);
      const gy = Math.floor(centerY() / geo.fy);
      if (gx >= 0 && gx < geo.size && gy >= 0 && gy < geo.size) cacheCells.push(gx + gy * geo.size);
    }
    return cacheCells;
  }

  function polygonPath(ctx, f) {
    const cx = centerX();
    const cy = centerY();
    ctx.beginPath();
    points.forEach((p, i) => {
      const x = cx + (p.x - cx) * f;
      const y = cy + (p.y - cy) * f;
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    });
    ctx.closePath();
  }

  setBase(polygon);

  var result = {
    name: 'GUI regionButton',
    init: function () {},
    getX() {
      return centerX();
    },
    setX(v) {
      offX = v - base.x;
      transform();
    },
    getY() {
      return centerY();
    },
    setY(v) {
      offY = v - base.y;
      transform();
    },
    getRadius() {
      return baseRadius * scale;
    },
    setRadius(v) {
      scale = Math.max(0.001, v / baseRadius);
      transform();
    },
    getColor() {
      return currentColor;
    },
    setColor(v) {
      currentColor = v;
    },
    getGrowColor() {
      return currentGrowColor;
    },
    setGrowColor(v) {
      currentGrowColor = v;
    },
    getActiveColor() {
      return currentActiveColor;
    },
    setActiveColor(v) {
      currentActiveColor = v;
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
    setCounter(v) {
      counter = v;
    },
    getSpeedUp() {
      return currentSpeedUp;
    },
    setSpeedUp(v) {
      currentSpeedUp = v;
    },
    getSpeedDown() {
      return currentSpeedDown;
    },
    setSpeedDown(v) {
      currentSpeedDown = v;
    },
    getFullPercent() {
      return currentFullPercent;
    },
    setFullPercent(v) {
      currentFullPercent = v;
    },
    getEnabled() {
      return currentEnabled;
    },
    setEnabled(v) {
      currentEnabled = !!v;
    },
    getFillPercent() {
      return fillPercent;
    },
    getState() {
      return state;
    },
    getPolygon() {
      return points.map((p) => ({ x: p.x, y: p.y }));
    },
    setPolygon(v) {
      setBase(v);
    },
    containsPoint,
    handle: function (grid, elapsed) {
      if (currentEnabled) {
        const cells = cellsInside(grid);
        let hits = 0;
        for (let i = 0; i < cells.length; i++) {
          if (grid[cells[i]] > 0) hits++;
        }
        fillPercent = cells.length ? (hits / cells.length) * 100 : 0;
        if (isKeyDown(keyCode)) fillPercent = 100;
        if (fillPercent > 0 && fillPercent > minPercent) {
          const rate = Math.min(1, fillPercent / Math.max(0.001, currentFullPercent));
          counter = Math.min(100, counter + Math.abs(currentSpeedUp * rate * elapsed));
        } else {
          counter = Math.max(0, counter - Math.abs(currentSpeedDown * elapsed));
        }
      } else {
        fillPercent = 0;
      }

      const oldstate = state;
      let color;
      if (counter > activeValue) {
        color = currentActiveColor;
        state = 'active';
      } else if (counter > minValue) {
        color = currentGrowColor;
        state = 'grow';
      } else {
        color = currentColor;
        state = 'normal';
      }

      if (visible && points.length) {
        const ctx = MasterCanvas.get2dContext();
        ctx.save();
        ctx.fillStyle = color;
        ctx.globalAlpha = fillAlpha;
        polygonPath(ctx, 1);
        ctx.fill();
        if (counter > 0) {
          ctx.globalAlpha = Math.min(1, fillAlpha * 2.5);
          polygonPath(ctx, counter / 100);
          ctx.fill();
        }
        ctx.globalAlpha = 1;
        ctx.strokeStyle = color;
        ctx.lineWidth = lineWidth;
        ctx.lineJoin = 'round';
        polygonPath(ctx, 1);
        ctx.stroke();
        ctx.restore();
        if (currentLabel) {
          util.renderText({ ctx, text: currentLabel, x: centerX(), y: centerY() + 10, fillStyle: color, fontSize: '30px' });
        }
      }

      // auch normal -> active, da hohe Füllraten grow in einem Frame überspringen können
      if (oldstate !== state) {
        if (state === 'active') {
          if (onEnterActive) onEnterActive(result);
          if (counterReset) {
            counter = 0;
            state = 'normal';
          }
        }
        if (oldstate === 'active' && onExitActive) onExitActive(result);
      }
    },
  };
  return result;
};
