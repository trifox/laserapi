/**
 * paintLayer ist eine Belichtungs-/Malschicht: ein Rechteck auf dem Canvas (posX, posY, width, height)
 * mit eigener, FESTER interner Auflösung (cellSize in Canvas-Pixeln, z. B. 20px).
 *
 * Pro Frame wird für jede interne Zelle geprüft, ob das Laser-Grid an dieser Stelle leuchtet, und ein
 * Wert 0..1 pro Zelle akkumuliert:
 * - speedUp:     Zunahme pro Sekunde bei voller Beleuchtung (1 = Zelle in einer Sekunde voll)
 * - speedDown:   Abbau pro Sekunde, solange die Zelle nicht beleuchtet ist (0 = bleibt stehen)
 * - brushRadius: Pinselradius in px, beleuchtete Zellen wirken mit linearem Abfall auf Nachbarzellen
 * - threshold:   ab diesem Wert zählt eine Zelle als "voll" (getCoverage, onCellChange)
 *
 * Abbildung Grid -> interne Zellen: eine interne Zelle gilt als beleuchtet, wenn ihr Mittelpunkt in
 * einer leuchtenden Grid-Zelle liegt. Ist die Grid-Zelle kleiner als eine interne Zelle, wird die interne
 * Zelle unter dem Mittelpunkt der Grid-Zelle markiert. Dadurch ist das Ergebnis unabhängig von der
 * (zur Laufzeit änderbaren) Grid-Auflösung. Gescannt werden nur die Grid-Zellen innerhalb des Rechtecks.
 *
 * Zeichnen (visible = true):
 * - render 'mask':  deckende Schicht in color, Deckkraft pro Zelle = (1 - Wert) -> "freilegen/abtragen"
 * - render 'paint': Schicht in color, Deckkraft = Wert -> "anmalen/belichten"
 * - optional texture (Canvas/Bild in Rechteckgrösse): wird statt der Einfarbfläche durch die Maske gezeigt
 * Die Maske ist ein kleines Offscreen-Canvas (1 Pixel je Zelle), das nur bei Änderungen neu geschrieben
 * und dann skaliert gezeichnet wird (smooth = weiche Kanten).
 *
 * Abfragen (alle Koordinaten in Canvas-Pixeln):
 * getValueAt, setValueAt, addInCircle, getCoverage, getCoverageInCircle, getAverageInCircle,
 * getLitInCircle (Anteil der GERADE beleuchteten Zellen, ohne Pinsel), getLitCount, reset, fill.
 *
 * onCellChange({ index, x, y, value, full }) wird nur aufgerufen, wenn eine Zelle threshold
 * über- oder unterschreitet (nicht bei jeder kleinen Änderung, aus Performance-Gründen).
 */
var MasterCanvas = require('../../MasterCanvas').default;
var laserConfig = require('../../LaserApiConfig').default;

function parseColor(color) {
  if (Array.isArray(color)) {
    return [color[0] | 0, color[1] | 0, color[2] | 0];
  }
  const match = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})/i.exec(String(color));
  if (!match) return [0, 0, 0];
  return [parseInt(match[1], 16), parseInt(match[2], 16), parseInt(match[3], 16)];
}

function clamp01(v) {
  return v < 0 ? 0 : v > 1 ? 1 : v;
}

export default ({
  label = '',
  posX = 0,
  posY = 0,
  width = laserConfig.canvasResolution.width,
  height = laserConfig.canvasResolution.height,
  cellSize = 20,
  speedUp = 1,
  speedDown = 0,
  brushRadius = 0,
  threshold = 0.5,
  initialValue = 0,
  visible = true,
  render = 'mask',
  color = '#553311',
  maxAlpha = 1,
  smooth = true,
  texture = undefined,
  onCellChange,
}) => {
  const cs = Math.max(1, cellSize);
  const cols = Math.max(1, Math.ceil(width / cs));
  const rows = Math.max(1, Math.ceil(height / cs));
  const cellCount = cols * rows;

  const values = new Float32Array(cellCount);
  const intensity = new Float32Array(cellCount);
  const lit = new Uint8Array(cellCount);
  const litList = new Int32Array(cellCount);
  let litCount = 0;
  let coverageCount = 0;

  var currentX = posX;
  var currentY = posY;
  var currentLabel = label;
  var currentColor = color;
  var currentRgb = parseColor(color);
  var currentSpeedUp = speedUp;
  var currentSpeedDown = speedDown;
  var currentThreshold = threshold;
  var currentVisible = visible;
  var currentRender = render;
  var currentTexture = texture;
  var currentMaxAlpha = maxAlpha;
  var currentBrushRadius = brushRadius;
  var kernel = [];

  // Zeichen-Puffer (lazy, damit die Komponente auch ohne DOM erzeugt werden kann)
  let maskCanvas = null;
  let maskCtx = null;
  let maskImage = null;
  let outCanvas = null;
  let outCtx = null;
  let imageDirty = true;
  let colorDirty = true;

  // Hilfsarrays für die Spalten-Abbildung Grid -> Zellen
  let colStart = new Int32Array(0);
  let colEnd = new Int32Array(0);

  function buildKernel() {
    kernel = [];
    const r = Math.max(0, currentBrushRadius);
    const reach = Math.floor(r / cs);
    for (let dy = -reach; dy <= reach; dy++) {
      for (let dx = -reach; dx <= reach; dx++) {
        const d = Math.sqrt(dx * dx + dy * dy) * cs;
        if (d > r && !(dx === 0 && dy === 0)) continue;
        // linearer Abfall, am Pinselrand noch ein kleiner Rest
        const w = dx === 0 && dy === 0 ? 1 : 1 - d / (r + cs * 0.5);
        if (w > 0) kernel.push(dx, dy, w);
      }
    }
  }
  buildKernel();

  function cellCenterX(i) {
    return currentX + ((i % cols) + 0.5) * cs;
  }
  function cellCenterY(i) {
    return currentY + (Math.floor(i / cols) + 0.5) * cs;
  }

  /** setzt einen Zellwert inkl. threshold-Buchhaltung und Callback */
  function setCell(i, newValue) {
    const v = values[i];
    const nv = clamp01(newValue);
    if (nv === v) return;
    values[i] = nv;
    imageDirty = true;
    const wasFull = v >= currentThreshold;
    const isFull = nv >= currentThreshold;
    if (wasFull !== isFull) {
      coverageCount += isFull ? 1 : -1;
      if (onCellChange) {
        onCellChange({ index: i, x: cellCenterX(i), y: cellCenterY(i), value: nv, full: isFull });
      }
    }
  }

  function recount() {
    coverageCount = 0;
    for (let i = 0; i < cellCount; i++) {
      if (values[i] >= currentThreshold) coverageCount++;
    }
  }

  function cellIndexAt(x, y) {
    const ix = Math.floor((x - currentX) / cs);
    const iy = Math.floor((y - currentY) / cs);
    if (ix < 0 || iy < 0 || ix >= cols || iy >= rows) return -1;
    return ix + iy * cols;
  }

  /**
   * ruft fn(index, distance) für alle Zellen auf, deren Mittelpunkt im Kreis liegt
   * (nur Bounding-Box, geclampt). Liegt kein Mittelpunkt im Kreis, zählt die Zelle unter (x, y).
   * @returns Anzahl der besuchten Zellen
   */
  function forEachCellInCircle(x, y, r, fn) {
    const lx = x - currentX;
    const ly = y - currentY;
    const ix0 = Math.max(0, Math.ceil((lx - r) / cs - 0.5));
    const ix1 = Math.min(cols - 1, Math.floor((lx + r) / cs - 0.5));
    const iy0 = Math.max(0, Math.ceil((ly - r) / cs - 0.5));
    const iy1 = Math.min(rows - 1, Math.floor((ly + r) / cs - 0.5));
    const r2 = r * r;
    let count = 0;
    for (let iy = iy0; iy <= iy1; iy++) {
      const dy = (iy + 0.5) * cs - ly;
      const base = iy * cols;
      for (let ix = ix0; ix <= ix1; ix++) {
        const dx = (ix + 0.5) * cs - lx;
        const d2 = dx * dx + dy * dy;
        if (d2 <= r2) {
          count++;
          fn(base + ix, Math.sqrt(d2));
        }
      }
    }
    if (count === 0) {
      const i = cellIndexAt(x, y);
      if (i >= 0) {
        count = 1;
        fn(i, 0);
      }
    }
    return count;
  }

  /** Zellbereich [start, end] (inkl.), dessen Mittelpunkte in [a, b) liegen; Fallback: Zelle unter der Mitte */
  function cellRange(a, b, maxIndex, out, k) {
    let s = Math.ceil(a / cs - 0.5);
    let e = Math.ceil(b / cs - 0.5) - 1;
    if (s > e) {
      s = e = Math.floor((a + b) / 2 / cs);
    }
    if (s < 0) s = 0;
    if (e > maxIndex) e = maxIndex;
    out[0][k] = s;
    out[1][k] = e;
  }

  /** liest das Grid ein und akkumuliert die Werte */
  function update(grid, elapsed) {
    const dt = elapsed > 0 ? elapsed : 0;

    // alte Beleuchtung zurücksetzen (nur die markierten Zellen)
    for (let k = 0; k < litCount; k++) lit[litList[k]] = 0;
    litCount = 0;
    intensity.fill(0);

    if (grid && grid.length > 0) {
      const gridSize = Math.floor(Math.sqrt(grid.length));
      const canvas = MasterCanvas.getCanvas();
      const canvasW = canvas ? canvas.width : laserConfig.canvasResolution.width;
      const canvasH = canvas ? canvas.height : laserConfig.canvasResolution.height;
      const factx = canvasW / gridSize;
      const facty = canvasH / gridSize;
      const right = currentX + cols * cs;
      const bottom = currentY + rows * cs;
      const gx0 = Math.max(0, Math.floor(currentX / factx));
      const gx1 = Math.min(gridSize - 1, Math.floor((right - 1e-6) / factx));
      const gy0 = Math.max(0, Math.floor(currentY / facty));
      const gy1 = Math.min(gridSize - 1, Math.floor((bottom - 1e-6) / facty));

      if (gx1 >= gx0 && gy1 >= gy0) {
        if (colStart.length < gridSize) {
          colStart = new Int32Array(gridSize);
          colEnd = new Int32Array(gridSize);
        }
        const colOut = [colStart, colEnd];
        for (let gx = gx0; gx <= gx1; gx++) {
          cellRange(gx * factx - currentX, (gx + 1) * factx - currentX, cols - 1, colOut, gx);
        }
        const rowOut = [[0], [0]];
        for (let gy = gy0; gy <= gy1; gy++) {
          cellRange(gy * facty - currentY, (gy + 1) * facty - currentY, rows - 1, rowOut, 0);
          const iy0 = rowOut[0][0];
          const iy1 = rowOut[1][0];
          if (iy0 > iy1) continue;
          const rowBase = gy * gridSize;
          for (let gx = gx0; gx <= gx1; gx++) {
            if (!(grid[rowBase + gx] > 0)) continue;
            const ix0 = colStart[gx];
            const ix1 = colEnd[gx];
            for (let iy = iy0; iy <= iy1; iy++) {
              for (let ix = ix0; ix <= ix1; ix++) {
                const i = ix + iy * cols;
                if (!lit[i]) {
                  lit[i] = 1;
                  litList[litCount++] = i;
                }
              }
            }
          }
        }
      }
    }

    // Pinsel: Beleuchtung mit Abfall auf die Nachbarn verteilen (Maximum, nicht Summe)
    const kLen = kernel.length;
    for (let k = 0; k < litCount; k++) {
      const i = litList[k];
      const cx = i % cols;
      const cy = (i - cx) / cols;
      for (let n = 0; n < kLen; n += 3) {
        const nx = cx + kernel[n];
        const ny = cy + kernel[n + 1];
        if (nx < 0 || ny < 0 || nx >= cols || ny >= rows) continue;
        const j = nx + ny * cols;
        if (kernel[n + 2] > intensity[j]) intensity[j] = kernel[n + 2];
      }
    }

    // Werte akkumulieren bzw. abbauen
    const up = currentSpeedUp * dt;
    const down = currentSpeedDown * dt;
    if (up === 0 && down === 0) return;
    for (let i = 0; i < cellCount; i++) {
      const inten = intensity[i];
      if (inten > 0) {
        if (up !== 0) setCell(i, values[i] + up * inten);
      } else if (down !== 0 && values[i] > 0) {
        setCell(i, values[i] - down);
      }
    }
  }

  function ensureBuffers() {
    if (!maskCanvas) {
      maskCanvas = document.createElement('canvas');
      maskCanvas.width = cols;
      maskCanvas.height = rows;
      maskCtx = maskCanvas.getContext('2d');
      maskImage = maskCtx.createImageData(cols, rows);
      colorDirty = true;
      imageDirty = true;
    }
  }

  function updateMaskImage() {
    const d = maskImage.data;
    const useTexture = !!currentTexture;
    if (colorDirty) {
      // bei Textur zählt nur Alpha, Farbe egal
      const r = useTexture ? 255 : currentRgb[0];
      const g = useTexture ? 255 : currentRgb[1];
      const b = useTexture ? 255 : currentRgb[2];
      for (let i = 0, p = 0; i < cellCount; i++, p += 4) {
        d[p] = r;
        d[p + 1] = g;
        d[p + 2] = b;
      }
      colorDirty = false;
    }
    const alphaScale = 255 * clamp01(currentMaxAlpha);
    const isMask = currentRender !== 'paint';
    for (let i = 0, p = 3; i < cellCount; i++, p += 4) {
      const v = values[i];
      d[p] = (isMask ? 1 - v : v) * alphaScale;
    }
    maskCtx.putImageData(maskImage, 0, 0);
    imageDirty = false;
  }

  function draw(ctx) {
    if (typeof document === 'undefined') return;
    ctx = ctx || MasterCanvas.get2dContext();
    ensureBuffers();
    const texDirty = imageDirty;
    if (imageDirty || colorDirty) updateMaskImage();
    const drawW = cols * cs;
    const drawH = rows * cs;

    if (currentTexture) {
      if (!outCanvas) {
        outCanvas = document.createElement('canvas');
        outCanvas.width = Math.ceil(width);
        outCanvas.height = Math.ceil(height);
        outCtx = outCanvas.getContext('2d');
        outCanvas._needsUpdate = true;
      }
      if (texDirty || outCanvas._needsUpdate) {
        outCtx.save();
        outCtx.globalCompositeOperation = 'source-over';
        outCtx.clearRect(0, 0, outCanvas.width, outCanvas.height);
        outCtx.imageSmoothingEnabled = smooth;
        outCtx.drawImage(maskCanvas, 0, 0, drawW, drawH);
        outCtx.globalCompositeOperation = 'source-in';
        outCtx.drawImage(currentTexture, 0, 0, outCanvas.width, outCanvas.height);
        outCtx.restore();
        outCanvas._needsUpdate = false;
      }
      ctx.drawImage(outCanvas, currentX, currentY);
      return;
    }

    ctx.save();
    ctx.beginPath();
    ctx.rect(currentX, currentY, width, height);
    ctx.clip();
    ctx.imageSmoothingEnabled = smooth;
    ctx.drawImage(maskCanvas, currentX, currentY, drawW, drawH);
    ctx.restore();
  }

  var result = {
    name: 'GUI paintLayer',
    init: function () {},
    /** Grid einlesen + (falls visible) zeichnen */
    handle: function (grid, elapsed) {
      update(grid, elapsed);
      if (currentVisible) draw(MasterCanvas.get2dContext());
    },
    /** nur Grid einlesen/akkumulieren, ohne zu zeichnen */
    update,
    /** nur zeichnen (z. B. in Pausen-/Zwischenbildschirmen) */
    draw,
    getX() {
      return currentX;
    },
    setX(newX) {
      currentX = newX;
    },
    getY() {
      return currentY;
    },
    setY(newY) {
      currentY = newY;
    },
    getWidth() {
      return width;
    },
    getHeight() {
      return height;
    },
    getCellSize() {
      return cs;
    },
    getCols() {
      return cols;
    },
    getRows() {
      return rows;
    },
    getColor() {
      return currentColor;
    },
    setColor(newColor) {
      currentColor = newColor;
      currentRgb = parseColor(newColor);
      colorDirty = true;
      imageDirty = true;
    },
    getLabel() {
      return currentLabel;
    },
    setLabel(newLabel) {
      currentLabel = newLabel;
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
    getBrushRadius() {
      return currentBrushRadius;
    },
    setBrushRadius(v) {
      currentBrushRadius = v;
      buildKernel();
    },
    getThreshold() {
      return currentThreshold;
    },
    setThreshold(v) {
      currentThreshold = v;
      recount();
    },
    getMaxAlpha() {
      return currentMaxAlpha;
    },
    setMaxAlpha(v) {
      currentMaxAlpha = v;
      imageDirty = true;
    },
    isVisible() {
      return currentVisible;
    },
    setVisible(v) {
      currentVisible = v;
    },
    getRender() {
      return currentRender;
    },
    setRender(mode) {
      currentRender = mode;
      imageDirty = true;
    },
    getTexture() {
      return currentTexture;
    },
    /** neue Textur (Canvas/Bild in Rechteckgrösse) oder undefined für Einfarbfläche */
    setTexture(tex) {
      currentTexture = tex;
      colorDirty = true;
      imageDirty = true;
      if (outCanvas) outCanvas._needsUpdate = true;
    },
    /** Wert 0..1 der Zelle an Canvas-Position (x, y), ausserhalb 0 */
    getValueAt(x, y) {
      const i = cellIndexAt(x, y);
      return i >= 0 ? values[i] : 0;
    },
    setValueAt(x, y, value) {
      const i = cellIndexAt(x, y);
      if (i >= 0) setCell(i, value);
    },
    /** true, wenn die Zelle an (x, y) gerade vom Laser beleuchtet wird */
    isLitAt(x, y) {
      const i = cellIndexAt(x, y);
      return i >= 0 && lit[i] === 1;
    },
    /**
     * addiert delta auf alle Zellen im Kreis; falloff 0..1: 0 = gleichmässig, 1 = linear bis 0 am Rand
     */
    addInCircle(x, y, r, delta, falloff = 0) {
      forEachCellInCircle(x, y, r, (i, d) => {
        const w = r > 0 ? 1 - falloff * Math.min(1, d / r) : 1;
        setCell(i, values[i] + delta * w);
      });
    },
    /** setzt alle Zellen im Kreis auf value */
    setInCircle(x, y, r, value) {
      forEachCellInCircle(x, y, r, (i) => setCell(i, value));
    },
    /** Anteil (0..1) aller Zellen mit Wert >= threshold */
    getCoverage() {
      return coverageCount / cellCount;
    },
    /** Anteil (0..1) der Zellen im Kreis mit Wert >= threshold */
    getCoverageInCircle(x, y, r) {
      let full = 0;
      const total = forEachCellInCircle(x, y, r, (i) => {
        if (values[i] >= currentThreshold) full++;
      });
      return total > 0 ? full / total : 0;
    },
    /** Durchschnittswert (0..1) der Zellen im Kreis */
    getAverageInCircle(x, y, r) {
      let sum = 0;
      const total = forEachCellInCircle(x, y, r, (i) => {
        sum += values[i];
      });
      return total > 0 ? sum / total : 0;
    },
    /** Anteil (0..1) der Zellen im Kreis, die GERADE beleuchtet sind (ohne Pinsel-Abfall) */
    getLitInCircle(x, y, r) {
      let hits = 0;
      const total = forEachCellInCircle(x, y, r, (i) => {
        if (lit[i]) hits++;
      });
      return total > 0 ? hits / total : 0;
    },
    /** Anzahl der gerade beleuchteten Zellen in der ganzen Schicht */
    getLitCount() {
      return litCount;
    },
    /** alle Zellen auf initialValue zurücksetzen */
    reset() {
      result.fill(initialValue);
    },
    /** alle Zellen auf value setzen (ohne onCellChange) */
    fill(value) {
      values.fill(clamp01(value));
      recount();
      imageDirty = true;
    },
  };
  result.fill(initialValue);
  return result;
};
