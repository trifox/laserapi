// the main canvas is organized here

var laserConfig = require('./LaserApiConfig.js').default
var video = null

export default {

    getVideo: function () {
        return video
    },
    init: function (videoIn) {
        video = videoIn
        console.log('Initialising VIDEO from canvas DOM element', video)
        navigator.getUserMedia({
            video: {
                width: laserConfig.videoResolution.width,
                height: laserConfig.videoResolution.height
            }
        }, function (stream) {

            console.log('Stream received', stream)
            video.srcObject = stream;
            video.onloadedmetadata = function (e) {
                console.log('Metadata received', this)
                console.log('Metadata received', e)
                // Do something with the video here.
                video.play();
            };

        }, function () {

        })

    }

}
