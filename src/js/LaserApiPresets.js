var preset1midi1 = {
    gameIndex: 0,
    debugVideo: true,
    testColor: [255, 32, 32],
    gridResolution: 4,

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
var preset2midi2 = {
    gameIndex: 0,
    debugVideo: true,
    testColor: [255, 0, 0],
    gridResolution: 6,

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

var preset2moorhuni = {
    gameIndex: 1,
    debugVideo: true,
    testColor: [255, 0, 0],
    gridResolution: 6,

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
var preset3pong = {
    gameIndex: 2,
    debugVideo: true,
    testColor: [255, 0, 0],
    gridResolution: 64,

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

var preset4fade = {
    gameIndex: 4,
    debugVideo: true,
    testColor: [255, 0, 0],
    gridResolution: 64,

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

export default [
    {
        name: 'Preset Midi',
        config: preset1midi1,
        initData: {}

    }, {
        name: 'Preset Midi2',
        config: preset2midi2,
        initData: {}
    }, {
        name: 'Moorhuni 1',
        config: preset2moorhuni,
        initData: {}
    }, {
        name: 'Pong1',
        config: preset3pong,
        initData: {itemCount:6}
    }
    ,{
        name: 'Pong2',
        config: preset3pong,
        initData: {
            itemCount:10
        }
    }
    , {
        name: 'Preset Fade1',
        config: preset4fade,
        initData: {}
    }

]
