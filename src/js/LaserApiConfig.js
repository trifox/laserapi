var config = {
    debugVideo: false,
    testColor: [255, 32, 32],
    gridResolution: 6,
    tickIntervalMilliseconds: 25,
    videoResolution: {
        width: 640,
        height: 480
    },
    canvasResolution: {
        width: 640,
        height: 480
    },
    treshold: 120,

    transform: {
        topleft: {
            x: 0,
            y: 0.5
        },
        topright: {
            x: 1,
            y: 0
        },
        bottomleft: {
            x: 0,
            y: 1
        },
        bottomright: {
            x: 1,
            y: 1
        }

    }

};

export default config
