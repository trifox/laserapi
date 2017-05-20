// the main canvas is organized here

var laserConfig = require('./LaserApiConfig.js').default
var canvas = null
var context2d = null

export default {
    clear: () => {
        context2d.beginPath();
        context2d.rect(0, 0, canvas.width, canvas.height);
        context2d.fillStyle = "black";
        context2d.fill();
    },
    getCanvas: () => {
        return canvas
    },
    get2dContext: () => {
        return context2d
    },
    init: (canvasIn) => {
        canvas = canvasIn
        canvas.width = laserConfig.canvasResolution.width
        canvas.height = laserConfig.canvasResolution.height
        console.log('Initialising from canvas DOM element', this)
        console.log('Initialising from canvas DOM element', canvas)
        context2d = canvas.getContext("2d");

    },

}
