// the main canvas is organized here

var laserConfig = require('./LaserApiConfig.js').default
export default {
    canvas: null,

    init: (canvas) => {
        this.canvas = canvas
        canvas.width = laserConfig.canvasResolution.width
        canvas.height = laserConfig.canvasResolution.height
        console.log('Initialising from canvas DOM element', canvas)
        var ctx = canvas.getContext("2d");

        ctx.beginPath();
        ctx.rect(0, 0, canvas.width, canvas.height);
        ctx.fillStyle = "black";
        ctx.fill();

    }

}
