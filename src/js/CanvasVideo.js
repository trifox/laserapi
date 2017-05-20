// the main canvas is organized here

var laserConfig = require('./LaserApiConfig.js').default
export default {

    video: null,

    init: (video) => {
        this.video = video
        console.log('Initialising VIDEO from canvas DOM element', video)
        navigator.getUserMedia({
            video: {
                width: laserConfig.videoResolution.width,
                height: laserConfig.videoResolution.height
            }
        }, (stream) => {

            console.log('Stream received', stream)
            video.srcObject = stream;
            video.onloadedmetadata = (e) => {
                console.log('Metadata received', this)
                console.log('Metadata received', e)
                // Do something with the video here.
                video.play();
            };

        }, () => {

        })

    }

}
