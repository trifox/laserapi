var config = {
    gameIndex: 0,
    debugVideo: true,
    testColor: [255, 32, 32],
    gridResolution: 64,
    playfieldScale: 1,
    tickIntervalMilliseconds: 25,
    videoResolution: {
        width: 640,
        height: 480
    },
    testResolution: {
        width: 320,
        height: 240
    },
    canvasResolution: {
        width: 640,
        height: 480
    },
    canvasOriginalResolution: {
        width: 640,
        height: 480
    },
    treshold: 120,

    videoTransform: {
        scale: 0,
        rotate: 0,
        skew: {
            x: 0,
            y: 0
        },
        translate: {
            x: 0,
            y: 0.5
        }
    },
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
