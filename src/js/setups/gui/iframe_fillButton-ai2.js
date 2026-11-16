/**
 * iframe_fillButton-ai2 – überarbeitete Fassung von ./iframe_fillButton.js
 *
 * Original: src/js/setups/gui/iframe_fillButton.js (bleibt unverändert erhalten).
 * Drop-in-Ersatz für game-iframe-loader.js:
 *   require('./gui/iframe_fillButton.js').default  →  require('./gui/iframe_fillButton-ai2.js').default
 *
 * Wie das Original ein fillButton für Spiele im iframe: handle(grid, elapsed, ctx) bekommt den
 * Zeichenkontext des iframe-Canvas mitgegeben. Die Logik ist identisch mit fillButton-ai2
 * (gleiche Fehlerbehebungen, siehe dort: Randüberlauf, Tastenmodus feuert nur einmal und baut ab,
 * normal → active löst aus, setEdges wirkt auf die Füllung, ctx.save/restore …).
 *
 * Zusätzlich behoben: Das Original rechnete Grid → Pixel über ctx.canvas.clientWidth/-Height (CSS-Grösse).
 * Gezeichnet wird aber in Canvas-Pixeln (canvas.width/height). Weicht die CSS-Grösse ab (Skalierung,
 * devicePixelRatio), lag der Scanbereich neben dem Button. Jetzt wird canvas.width/height benutzt.
 */
import { createFillButton } from './fillButton-ai2.js';

function iframeFillButton(options) {
  return createFillButton(options, {
    getCtx: (ctx) => ctx,
    getCanvas: (ctx) => ({ width: ctx.canvas.width, height: ctx.canvas.height }),
  });
}

export default iframeFillButton;
