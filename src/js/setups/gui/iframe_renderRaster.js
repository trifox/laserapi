import { renderText } from '../../util.js';

/**
 * fillButton is a circular area that becomes filled, once filled the state switches to 'ON'
 *
 */
var util = require('../../util.js').default;

function moveToHelper_getGridPixel(data, x, y) {
  const gridSize = Math.floor(Math.sqrt(data.length));
  return data[Math.floor(x) + Math.floor(y) * gridSize];
}
/**
 * Both of these will link to the bar function.
 * @see {@link bar}
 * @see bar
 */
function renderRaster({}) {
  var result = {
    name: 'GUI flipButton',
    init: function () {},
    handle: function (grid, elapsed, ctx) {
      const gridSize = Math.sqrt(grid.length);

      const factx = ctx.canvas.clientWidth / gridSize;
      const facty = ctx.canvas.clientHeight / gridSize;
    },
  };
  return result;
}

export default renderRaster;
