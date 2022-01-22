import util from "../util.js";

var laserConfig = require("../LaserApiConfig.js").default;
var MasterCanvas = require("../MasterCanvas").default;
var guiFillButton = require("./gui/fillButton").default;
var guiFlipButton = require("./gui/flipButton").default;
var guiRangeSlider = require("./gui/rangeSlider").default;
var guiFollowCircle = require("./gui/followCircle").default;
var knobPositions = [];

var lastResolution = -1;
const leftStartX = 1920 * 0.05;
const rightStartX = 1920 - 1920 * 0.05;
const bottomBarStartY = 1080 * 0.75;
var help = false;

var lastTime = 0;
var elapsed = 0;
function getDelta() {
  var currentTime = performance.now();
  const elapsed = (currentTime - lastTime) / 1000;

  lastTime = currentTime;
  return elapsed;
}

function createTorpedo(
  torpedoSize = 1,
  posX,
  posY,
  edges = 3,
  label = "",
  radius = 25,
  direction = 1
) {
  var audio = new Audio(
    "https://freesound.org/data/previews/35/35530_35187-lq.mp3"
  );
  audio.play();

  const enemy = guiFillButton({
    label: "",
    posX: posX,
    posY: posY,
    normalColor: "#00ffaa",
    edges: edges,
    speedDown: 5,
    speedUp: 100,
    radius: radius,
    onEnterActive: () => {
      // kill torpedo
      removeItemFromArray(torpedos, thething);
    },
  });
  var currentTorpedoSize = torpedoSize;
  var currentSpeed = 0;
  const thething = {
    getGui: () => enemy,
    getDirection: () => direction,
    handle: (grid) => {
      // // grow element at constant rate up to certain size
      // if (enemy.getRadius() < 250) {
      //   enemy.setRadius(enemy.getRadius() + 0.1);
      // } else {
      //   enemy.setRadius(250);
      // }
      enemy.setX(
        enemy.getX() +
          (4 - currentTorpedoSize) * direction * currentSpeed * elapsed
      );
      currentSpeed = Math.max(currentSpeed + 1, 10, 1);
      enemy.handle(grid);

      if (direction > 0) {
        MasterCanvas.get2dContext().strokeRect(
          enemy.getX() - radius,
          enemy.getY() - radius,
          currentTorpedoSize * radius * 2,
          radius * 2
        );
      } else {
        MasterCanvas.get2dContext().strokeRect(
          enemy.getX() + radius - currentTorpedoSize * radius * 2,
          enemy.getY() - radius,
          currentTorpedoSize * radius * 2,
          radius * 2
        );
      }
      // if (enemy.getX() < 200 || enemy.getX() > 1920 - 200) {
      //   console.log("killing torpedo");
      //   removeItemFromArray(torpedos, thething);
      // }
    },
  };
  return thething;
}
function createLaunchTorpedoButton(
  posX,
  posY,
  label = "",
  direction = -1,
  radius = 50,
  edges = 3
) {
  const enemy = guiFillButton({
    label: "",
    posX: posX,
    posY: posY,
    normalColor: "#00ffaa",
    edges: edges,
    speedDown: 25,
    speedUp: 50,
    radius: radius,
    onEnterActive: () => {
      // fire torpedo
      torpedos.push(
        createTorpedo(
          Number(label),
          posX + radius * 2 * direction,
          posY,
          edges,
          "torpedo",
          25,
          direction
        )
      );
    },
  });

  return {
    getGui: () => enemy,
    handle: (grid) => {
      // // grow element at constant rate up to certain size
      // if (enemy.getRadius() < 250) {
      //   enemy.setRadius(enemy.getRadius() + 0.1);
      // } else {
      //   enemy.setRadius(250);
      // }
      enemy.handle(grid);
    },
  };
}
var enemies = [];
var torpedos = [];
var launchBases = [];
for (var i = 0; i < 3; i++) {
  for (var j = 0; j < 6; j++) {
    launchBases.push(
      createLaunchTorpedoButton(
        100 + i * 110,
        150 + j * 150,
        i + 1,
        1,
        5 + 20 * (3 - i),
        5
      )
    );
    launchBases.push(
      createLaunchTorpedoButton(
        1920 - 100 - i * 110,
        150 + j * 150,
        i + 1,
        -1,
        5 + 20 * (3 - i),
        4
      )
    );
  }
}
var GPU = require("gpu.js").GPU;
var lastResolution = -1;
function removeItemFromArray(arr, value) {
  // const arr = [...arrIn];
  //  console.log("Removing from array", arr, value);
  var index = arr.indexOf(value);
  if (index > -1) {
    arr.splice(index, 1);
  }
  return arr;
}

export default {
  name: "Laser-Torpedo",
  init: function (data) {
    console.log("init game torpedo ", knobPositions);
  },
  handle: function (grid) {
    elapsed = getDelta();
    if (lastResolution != grid.length) {
      // init();
      lastResolution = grid.length;
    }
    this.handleGameScreen(grid);
    // check collisions torpedo torpedo
    // check collisions torpedos bases

    //torpedo torpedo
    const handled = [];
    torpedos.forEach((torp) => {
      handled.push(torp);
      torpedos.forEach((torp2) => {
        if (!handled.includes(torp2)) {
          if (torp2.getDirection() != torp.getDirection()) {
            if (
              Math.abs(torp2.getGui().getX() - torp.getGui().getX()) >
              torp.getGui().getRadius()
            ) {
            }
          }
        }
      });
    });

    // torpedo base
    torpedos.forEach((torp) => {
      launchBases.forEach((torp2) => {});
    });
  },

  handleGameScreen(grid) {
    const ctx = MasterCanvas.get2dContext();
    torpedos.forEach((item) => {
      item.handle(grid);

      // item.setX(item.getX() + 1 * Math.random() * 4);
    });
    launchBases.forEach((item) => {
      item.handle(grid);

      // item.setX(item.getX() + 1 * Math.random() * 4);
    });
    enemies.forEach((item) => {
      item.handle(grid);

      // item.setX(item.getX() + 1 * Math.random() * 4);
    });

    if (help) {
      util.renderTextDropShadow({
        ctx,
        text: "Laser-Torpedo",
        fontSize: "150px",
        fillStyle: "green",
        x: laserConfig.canvasResolution.width / 2,
        y: 200,
      });
      ctx.fillStyle = "#00000088";
      ctx.fillRect(
        laserConfig.canvasResolution.width * 0.05,
        220,
        laserConfig.canvasResolution.width * 0.9,
        laserConfig.canvasResolution.height * 0.5
      );
      util.renderTextOutline({
        ctx,
        text: `
This HELP text is displayed,
because you hovered over the HELP button in the bottom left corner.

You Can Reset to start location by targeting the RESET button with your laser for some time.

To control the location inside the Mandelbrot Set:
we have the Coordinates X/Y for horizontal/vertical positioning
and the ZOOM which is controlling the magnification at that location

Each of those control parameters are controlled using the sliders at the bottom,
by hovering with the laser above the right or left 
area of the bars below the labels X(Horizontal)/Y(Vertical)/ZOOM
the corresponding values are changed

Have Fun!

Copyright 2022 C.Kleinhuis 
Copyright 2022 Frontend Solutions GmbH
Copyright 2022 I-Love-Chaos`,
        fontSize: "26px",
        lineHeight: 25,
        fillStyle: "#ffffff",
        x: laserConfig.canvasResolution.width / 2,
        y: 250,
        dropDistX: 4,
        dropDistY: 4,
      });
    }
  },
};
