/**
 * iframe_renderRaster-ai2 – überarbeitete Fassung von ./iframe_renderRaster.js
 *
 * Original: src/js/setups/gui/iframe_renderRaster.js (bleibt unverändert erhalten).
 * Drop-in-Ersatz für game-iframe-loader.js:
 *   require('./gui/iframe_renderRaster.js').default  →  require('./gui/iframe_renderRaster-ai2.js').default
 *
 * Das Original war ein leerer Platzhalter: handle() rechnete nur die Zellgrösse aus und zeichnete nichts,
 * und der Aufruf ohne Argument (renderRaster()) warf einen Fehler (Destrukturierung von undefined).
 *
 * Jetzt: zeichnet das Laser-Grid als Debug-Raster in den iframe-Canvas – leuchtende Zellen gefüllt,
 * optional Gitterlinien. handle(grid, elapsed, ctx) wie beim Original.
 *
 * Optionen: color = '#335577' (Zellfarbe; nie reine Laserfarbe), lineColor = '#222222', showLines = false,
 *           alpha = 0.6, visible = true
 * Methoden: setVisible(v), getVisible()
 */
function renderRaster(options) {
  const o = options || {};
  const color = o.color || '#335577';
  const lineColor = o.lineColor || '#222222';
  const showLines = !!o.showLines;
  const alpha = o.alpha === undefined ? 0.6 : o.alpha;
  var visible = o.visible === undefined ? true : o.visible;

  var result = {
    name: 'GUI renderRaster',
    init: function () {},
    setVisible(v) {
      visible = v;
    },
    getVisible() {
      return visible;
    },
    handle: function (grid, elapsed, ctx) {
      if (!visible || !ctx || !grid || !grid.length) return;
      const size = Math.floor(Math.sqrt(grid.length));
      const fx = ctx.canvas.width / size;
      const fy = ctx.canvas.height / size;
      ctx.save();
      ctx.globalAlpha = alpha;
      ctx.fillStyle = color;
      for (let y = 0; y < size; y++) {
        const row = y * size;
        for (let x = 0; x < size; x++) {
          if (grid[row + x] > 0) ctx.fillRect(x * fx, y * fy, fx, fy);
        }
      }
      if (showLines) {
        ctx.globalAlpha = 1;
        ctx.strokeStyle = lineColor;
        ctx.lineWidth = 1;
        ctx.beginPath();
        for (let i = 0; i <= size; i++) {
          ctx.moveTo(i * fx, 0);
          ctx.lineTo(i * fx, ctx.canvas.height);
          ctx.moveTo(0, i * fy);
          ctx.lineTo(ctx.canvas.width, i * fy);
        }
        ctx.stroke();
      }
      ctx.restore();
    },
  };
  return result;
}

export default renderRaster;
