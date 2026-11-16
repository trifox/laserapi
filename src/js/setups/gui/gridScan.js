/**
 * gridScan – gemeinsame Hilfsfunktionen für GUI-Komponenten, die das Laser-Grid auswerten.
 *
 * Das Grid ist ein flaches, quadratisches Array (Wert > 0 = Laser), seine Auflösung kann sich zur Laufzeit
 * ändern. Alle Funktionen hier arbeiten deshalb in Canvas-Pixeln und rechnen intern auf Grid-Zellen um.
 * Gescannt wird immer nur der angefragte Bereich (am Rand geclampt), nie das ganze Grid.
 *
 * Nur für Komponenten in gui/ gedacht – Spielcode liest das Grid nie selbst (siehe AGENTS.md).
 *
 * Ergebnis von scanRect/scanCircle ("Scan-Statistik"):
 *   { count,    // leuchtende Zellen im Bereich
 *     total,    // Zellen im Bereich
 *     percent,  // count / total * 100 (auflösungsunabhängiger Flächenanteil)
 *     hasLaser, // count > 0
 *     x, y,     // Schwerpunkt der leuchtenden Zellen in Canvas-Pixeln (0, wenn keine)
 *     spread }  // Standardabweichung der leuchtenden Zellen um den Schwerpunkt in Pixeln
 */
var MasterCanvas = require('../../MasterCanvas').default;
var laserConfig = require('../../LaserApiConfig').default;

/**
 * Grid-Kantenlänge und Pixel pro Zelle.
 * canvas (optional) = { width, height } der Zeichenfläche; Standard ist der MasterCanvas.
 * (Nötig z. B. im iframe, wo ein eigener Canvas benutzt wird.)
 */
export function getGridGeometry(grid, canvas) {
  canvas = canvas || MasterCanvas.getCanvas();
  const size = grid && grid.length ? Math.floor(Math.sqrt(grid.length)) : 0;
  return {
    size,
    fx: size ? canvas.width / size : 1,
    fy: size ? canvas.height / size : 1,
    width: canvas.width,
    height: canvas.height,
  };
}

/**
 * Zellbereich {x0, x1, y0, y1} (inklusive) für ein Rechteck in Canvas-Pixeln, null wenn leer.
 * Die rechte/untere Kante ist exklusiv: Endet das Rechteck genau auf einer Zellgrenze, gehört die
 * nächste Zelle nicht mehr dazu (sonst würden benachbarte Bereiche dieselben Laser doppelt zählen).
 */
export function getCellRange(geo, x, y, w, h) {
  if (!geo.size || w <= 0 || h <= 0) return null;
  const x0 = Math.max(0, Math.floor(x / geo.fx));
  const x1 = Math.min(geo.size - 1, Math.ceil((x + w) / geo.fx) - 1);
  const y0 = Math.max(0, Math.floor(y / geo.fy));
  const y1 = Math.min(geo.size - 1, Math.ceil((y + h) / geo.fy) - 1);
  if (x1 < x0 || y1 < y0) return null;
  return { x0, x1, y0, y1 };
}

function finishStats(count, total, sx, sy, sxx, syy) {
  const res = {
    count,
    total,
    percent: total > 0 ? (count / total) * 100 : 0,
    hasLaser: count > 0,
    x: 0,
    y: 0,
    spread: 0,
  };
  if (count > 0) {
    res.x = sx / count;
    res.y = sy / count;
    res.spread = Math.sqrt(Math.max(0, sxx / count - res.x * res.x + syy / count - res.y * res.y));
  }
  return res;
}

/** Scan-Statistik für ein Rechteck (x, y = linke obere Ecke, in Canvas-Pixeln); canvas optional wie oben */
export function scanRect(grid, x, y, w, h, canvas) {
  const geo = getGridGeometry(grid, canvas);
  const r = getCellRange(geo, x, y, w, h);
  if (!r) return finishStats(0, 0, 0, 0, 0, 0);
  let count = 0;
  let sx = 0;
  let sy = 0;
  let sxx = 0;
  let syy = 0;
  for (let gy = r.y0; gy <= r.y1; gy++) {
    const row = gy * geo.size;
    const cy = (gy + 0.5) * geo.fy;
    for (let gx = r.x0; gx <= r.x1; gx++) {
      if (grid[gx + row] > 0) {
        const cx = (gx + 0.5) * geo.fx;
        count++;
        sx += cx;
        sy += cy;
        sxx += cx * cx;
        syy += cy * cy;
      }
    }
  }
  return finishStats(count, (r.x1 - r.x0 + 1) * (r.y1 - r.y0 + 1), sx, sy, sxx, syy);
}

/**
 * Scan-Statistik für einen Kreis: zählt Zellen, deren Mittelpunkt im Kreis liegt.
 * Ist der Kreis kleiner als eine Zelle, zählt die Zelle unter dem Mittelpunkt.
 */
export function scanCircle(grid, x, y, radius, canvas) {
  const geo = getGridGeometry(grid, canvas);
  const r = getCellRange(geo, x - radius, y - radius, radius * 2, radius * 2);
  let count = 0;
  let total = 0;
  let sx = 0;
  let sy = 0;
  let sxx = 0;
  let syy = 0;
  if (r) {
    const r2 = radius * radius;
    for (let gy = r.y0; gy <= r.y1; gy++) {
      const row = gy * geo.size;
      const cy = (gy + 0.5) * geo.fy;
      const dy = cy - y;
      for (let gx = r.x0; gx <= r.x1; gx++) {
        const cx = (gx + 0.5) * geo.fx;
        const dx = cx - x;
        if (dx * dx + dy * dy > r2) continue;
        total++;
        if (grid[gx + row] > 0) {
          count++;
          sx += cx;
          sy += cy;
          sxx += cx * cx;
          syy += cy * cy;
        }
      }
    }
  }
  if (total === 0 && geo.size) {
    const gx = Math.floor(x / geo.fx);
    const gy = Math.floor(y / geo.fy);
    if (gx >= 0 && gx < geo.size && gy >= 0 && gy < geo.size) {
      total = 1;
      if (grid[gx + gy * geo.size] > 0) {
        count = 1;
        sx = x;
        sy = y;
        sxx = x * x;
        syy = y * y;
      }
    }
  }
  return finishStats(count, total, sx, sy, sxx, syy);
}

/** Punkt-in-Polygon-Test (Strahl-Methode), points = [{x, y}, ...] */
export function pointInPolygon(x, y, points) {
  let inside = false;
  for (let i = 0, j = points.length - 1; i < points.length; j = i++) {
    const a = points[i];
    const b = points[j];
    if (a.y > y !== b.y > y && x < ((b.x - a.x) * (y - a.y)) / (b.y - a.y) + a.x) inside = !inside;
  }
  return inside;
}

/** true, solange die Taste (KeyboardEvent.code, z. B. 'Space') gedrückt ist */
export function isKeyDown(code) {
  return !!(code && laserConfig.pressedKeys[code]);
}

/**
 * Liefert eine Funktion pressedOnce(code), die nur im ersten Frame eines Tastendrucks true ist.
 * Jede Komponente bekommt ihren eigenen Zustand.
 */
export function createKeyEdge() {
  const previous = {};
  return (code) => {
    const down = isKeyDown(code);
    const was = !!previous[code];
    previous[code] = down;
    return down && !was;
  };
}

/** Bildratenunabhängige Glättung: bewegt current mit rate (1/s) auf target zu */
export function approach(current, target, rate, elapsed) {
  return current + (target - current) * Math.min(1, Math.max(0, rate * elapsed));
}

export function clamp(v, a, b) {
  return Math.max(a, Math.min(b, v));
}
