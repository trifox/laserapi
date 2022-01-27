var config = {
  gameIndex: 0,
  debugVideo: true,
  testColor: [255, 32, 32],
  colorWeights: [1, 1, 0.1],
  gridResolution: 64,
  playfieldScale: 1,
  tickIntervalMilliseconds: 25,
  videoResolution: {
    width: 1920,
    height: 1080,
  },
  testResolution: {
    width: 1920,
    height: 1080,
  },
  canvasResolution: {
    width: 1920,
    height: 1080,
  },
  threshold: 120,

  videoTransform: {
    scale: 0,
    rotate: 0,
    skew: {
      x: 0,
      y: 0,
    },
    translate: {
      x: 0,
      y: 0.5,
    },
  },
  transform: {
    topleft: {
      x: 0,
      y: 0.5,
      slopex: 0,
      slopey: 1,
    },
    topright: {
      x: 1,
      y: 0,
      slopex: 0,
      slopey: 1,
    },
    bottomleft: {
      x: 0,
      y: 1,
      slopex: 0,
      slopey: 1,
    },
    bottomright: {
      x: 1,
      y: 1,
      slopex: 0,
      slopey: 1,
    },
  },
};

export default config;
