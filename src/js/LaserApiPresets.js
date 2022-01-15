var preset1midi1 = {
  gameIndex: 0,
  showGame: true,
  testColor: [255, 32, 32],
  gridResolution: 4,

  tickIntervalMilliseconds: 25,
  videoResolution: {
    width: 640,
    height: 480,
  },
  testResolution: {
    width: 320,
    height: 240,
  },
  canvasResolution: {
    width: 640,
    height: 480,
  },
  canvasOriginalResolution: {
    width: 640,
    height: 480,
  },
};
var preset2midi2 = {
  gameIndex: 0,
  showGame: true,
  testColor: [255, 0, 0],
  gridResolution: 6,

  tickIntervalMilliseconds: 25,
  videoResolution: {
    width: 640,
    height: 480,
  },
  testResolution: {
    width: 320,
    height: 240,
  },
  canvasResolution: {
    width: 640,
    height: 480,
  },
  canvasOriginalResolution: {
    width: 640,
    height: 480,
  },
};

var preset2moorhuni = {
  gameIndex: 1,
  showGame: true,
  testColor: [255, 0, 0],
  gridResolution: 128,

  tickIntervalMilliseconds: 25,
  videoResolution: {
    width: 640,
    height: 480,
  },
  testResolution: {
    width: 320,
    height: 240,
  },
  canvasResolution: {
    width: 640,
    height: 480,
  },
  canvasOriginalResolution: {
    width: 640,
    height: 480,
  },
};
var preset3pong = {
  gameIndex: 2,
  showGame: true,
  testColor: [255, 0, 0],
  gridResolution: 64,

  tickIntervalMilliseconds: 25,
  videoResolution: {
    width: 640,
    height: 480,
  },
  testResolution: {
    width: 320,
    height: 240,
  },
  canvasResolution: {
    width: 640,
    height: 480,
  },
  canvasOriginalResolution: {
    width: 640,
    height: 480,
  },
};

var preset4fade = {
  gameIndex: 4,
  showGame: true,
  testColor: [255, 0, 0],
  gridResolution: 40,

  tickIntervalMilliseconds: 25,
  videoResolution: {
    width: 640,
    height: 480,
  },
  testResolution: {
    width: 320,
    height: 240,
  },
  canvasResolution: {
    width: 640,
    height: 480,
  },
  canvasOriginalResolution: {
    width: 640,
    height: 480,
  },
};

export default [
  {
    name: "Preset Midi",
    config: preset1midi1,
    initData: {},
  },
  {
    name: "Preset c64",
    config: {
      gameIndex: 6,
      showGame: true,
      testColor: [255, 0, 0],
      gridResolution: 40,

      tickIntervalMilliseconds: 25,
      videoResolution: {
        width: 640,
        height: 480,
      },
      testResolution: {
        width: 320,
        height: 240,
      },
      canvasResolution: {
        width: 640,
        height: 480,
      },
      canvasOriginalResolution: {
        width: 640,
        height: 480,
      },
    },
    initData: {
      fadeDuration: 1000,
    },
  },
  {
    name: "Preset c64 2",
    config: {
      gameIndex: 5,
      showGame: true,
      testColor: [255, 0, 0],
      gridResolution: 40,

      tickIntervalMilliseconds: 25,
      videoResolution: {
        width: 640,
        height: 480,
      },
      testResolution: {
        width: 320,
        height: 240,
      },
      canvasResolution: {
        width: 640,
        height: 480,
      },
      canvasOriginalResolution: {
        width: 640,
        height: 480,
      },
    },
    initData: {
      fadeDuration: 1000,
    },
  },
  {
    name: "Preset Fade1sec",
    config: preset4fade,
    initData: {
      fadeDuration: 1000,
    },
  },
  // , {
  //     name: 'Preset Midi2',
  //     config: preset2midi2,
  //     initData: {}
  // }
  // , {
  //     name: 'Preset Fade10Sec',
  //     config: preset4fade,
  //     initData: {
  //         fadeDuration: 10000,
  //     }
  // }

  {
    name: "Moorhuni One Block",
    config: preset2moorhuni,
    initData: {
      center: true,
      gameMode: "both",
      itemCount: 1,
      itemSize: 500,
    },
  },
  // {
  //     name: 'Moorhuni 2 Just Two',
  //     config: preset2moorhuni,
  //     initData: {
  //         center: false,
  //         gameMode: 'leftright',
  //         itemCount: 4,
  //         itemSize: 200
  //     }
  // },

  {
    name: "Moorhuni 8 Blocks",
    config: preset2moorhuni,
    initData: {
      center: false,
      gameMode: "leftright",
      itemCount: 16,
      itemSize: 200,
    },
  },
  {
    name: "Pong2",
    config: preset3pong,
    initData: {
      itemCount: 2,
      obstacleSizeX: 120,
      obstacleSizeY: 360,
      moveSpeed: 350,
      clampMovementX: true,
    },
  },
  {
    name: "Pong1",
    config: preset3pong,
    initData: {
      itemCount: 10,
      obstacleSize: 160,
      moveSpeed: 250,
      clampMovementX: false,
    },
  },
];
