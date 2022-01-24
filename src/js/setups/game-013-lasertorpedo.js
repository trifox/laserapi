import util from "../util.js";

var laserConfig = require("../LaserApiConfig.js").default;
var MasterCanvas = require("../MasterCanvas").default;
var guiFillButton = require("./gui/fillButton").default;
var knobPositions = [];

import sonarSound from "../../../public/media/72218__benboncan__sonar.wav";
import drownSound from "../../../public/media/485066__javierserrat__object-falls-into-the-water.wav";
import explodeSmallSound from "../../../public/media/155235__zangrutz__bomb-small (1).mp3";
import explodeSound from "../../../public/media/414346__bykgames__explosion-far.wav";
var lastResolution = -1;
const leftStartX = 1920 * 0.05;
const rightStartX = 1920 - 1920 * 0.05;
const bottomBarStartY = 1080 * 0.75;
var help = false;
var won = -1;
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
    speedDown: 0,
    speedUp: 25,
    radius: radius,
    onEnterActive: () => {
      // kill torpedo
      removeItemFromArray(torpedos, thething);
      var audio = new Audio(drownSound);
      audio.play();
    },
  });
  var currentTorpedoSize = torpedoSize;
  var currentSpeed = 0;
  const thething = {
    getGui: () => enemy,
    getDirection: () => direction,
    getTorpedoSize: () => currentTorpedoSize,
    handle: (grid) => {
      enemy.setX(
        enemy.getX() +
          (4 - currentTorpedoSize) * direction * currentSpeed * elapsed
      );
      currentSpeed = Math.max(currentSpeed + 2 * elapsed, 10, 1);
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
    },
  };
  return thething;
}
var activeButtons = 0;
var startScreenButtons = [
  guiFillButton({
    label: "Team 2",
    posX: 1920 / 2 - 250,
    posY: 1080 / 2 + 250,
    speedDown: 25,
    speedUp: 50,
    edges: 5,
    radius: 200,
    onEnterActive: () => {
      console.log("hrhr enter active1", activeButtons);
      activeButtons++;
      if (activeButtons === 2) {
        won = 0;
        activeButtons = 0;
      }
    },
    onExitActive: () => {
      activeButtons--;
      console.log("hrhr exit active1", activeButtons);
    },
  }),
  guiFillButton({
    label: "Team 1",
    posX: 1920 / 2 + 250,
    posY: 1080 / 2 + 250,
    speedDown: 25,
    speedUp: 50,
    edges: 5,
    radius: 200,
    onEnterActive: () => {
      console.log("hrhr enter active2", activeButtons);
      activeButtons++;
      if (activeButtons === 2) {
        won = 0;
        activeButtons = 0;
      }
    },
    onExitActive: () => {
      activeButtons--;
      console.log("hrhr exit active2", activeButtons);
    },
  }),
  guiFillButton({
    label: "Help",
    posX: 1920 - 100,
    posY: 1080 - 100,
    speedDown: 10,
    speedUp: 50,
    edges: 32,
    activeValue: 35,
    radius: 50,
    normalColor: "#00aaff",
    onEnterActive: (sender) => {
      help = true;
    },
    onExitActive: (sender) => {
      help = false;
    },
  }),
];

function createLaunchTorpedoButton(
  posX,
  posY,
  label = "",
  direction = -1,
  radius = 50,
  edges = 3
) {
  const base = guiFillButton({
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
      base.setValue(0);
    },
  });
  var currentHealth = Number(label) * 2;

  return {
    getGui: () => base,
    getDirection: () => direction,
    getHealth: () => {
      return currentHealth;
    },
    setHealth: (x) => {
      currentHealth = x;
    },
    handle: (grid) => {
      // // grow element at constant rate up to certain size
      // if (enemy.getRadius() < 250) {
      //   enemy.setRadius(enemy.getRadius() + 0.1);
      // } else {
      //   enemy.setRadius(250);
      // }
      base.handle(grid);
      const ctx = MasterCanvas.get2dContext();
      for (var i = 0; i < currentHealth; i++) {
        ctx.fillRect(posX - radius, posY + i * 11 - radius, 10, 10);
      }
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
      lastResolution = grid.length;
    }
    if (won == 0) {
      this.handleGameScreen(grid);
      // check collisions torpedo torpedo
      // check collisions torpedos bases

      //torpedo torpedo collision check
      // var handled = [];
      // var toDeleteTorpedos = [];
      // torpedos.forEach((torp) => {
      //   if (torp.getGui().getX() < 0) {
      //     toDeleteTorpedos.push(torp);
      //   }
      //   if (torp.getGui().getX() > 1920) {
      //     toDeleteTorpedos.push(torp);
      //   }
      //   if (!handled.includes(torp)) {
      //     torpedos.forEach((torp2) => {
      //       if (!handled.includes(torp2) && torp !== torp2) {
      //         if (torp2.getDirection() !== torp.getDirection()) {
      //           if (
      //             torp2.getGui().getY() === torp.getGui().getY() &&
      //             Math.abs(torp2.getGui().getX() - torp.getGui().getX()) <
      //               torp.getGui().getRadius()
      //           ) {
      //             console.log("torpedo collision", torp, torp2);
      //             handled.push(torp);
      //             handled.push(torp2);
      //             toDeleteTorpedos.push(torp);
      //             toDeleteTorpedos.push(torp2);

      //             var audio = new Audio(sonarSound);
      //             audio.play();
      //           }
      //         }
      //       }
      //     });
      //   }
      // });
      // toDeleteTorpedos.forEach((torp) => {
      //   removeItemFromArray(torpedos, torp);
      // });

      // torpedo base
      const toDeleteBaseCollisions = [];
      torpedos.forEach((torpRef) => {
        launchBases.forEach((baseRef) => {
          if (torpRef.getDirection() !== baseRef.getDirection()) {
            if (
              baseRef.getGui().getY() === torpRef.getGui().getY() &&
              Math.abs(baseRef.getGui().getX() - torpRef.getGui().getX()) <
                baseRef.getGui().getRadius()
            ) {
              console.log("basecollision");
              toDeleteBaseCollisions.push({ baseRef, torpRef });
            }
          }
        });
      });

      toDeleteBaseCollisions.forEach((coll) => {
        coll.baseRef.setHealth(
          coll.baseRef.getHealth() - coll.torpRef.getTorpedoSize()
        );
        if (coll.baseRef.getHealth() <= 0) {
          removeItemFromArray(launchBases, coll.baseRef);
          var audio = new Audio(explodeSound);
          audio.play();
        } else {
          var audio = new Audio(explodeSmallSound);
          audio.play();
        }
        removeItemFromArray(torpedos, coll.torpRef);
      });

      // lastly check game over wether one player has no bases anymore
      var count1 = 0;
      var count2 = 0;
      launchBases.forEach((item) => {
        if (item.getDirection() == -1) {
          count1++;
        } else {
          count2++;
        }
      });
      if (count1 === 0) {
        won = 2;
      }
      if (count2 === 0) {
        won = 11;
      }
    } else {
      this.handleStartScreenScreen(grid);
    }
  },

  handleStartScreenScreen(grid) {
    const ctx = MasterCanvas.get2dContext();
    startScreenButtons.forEach((item) => item.handle(grid));
    if (won === -1) {
      const ctx = MasterCanvas.get2dContext();
      util.renderTextDropShadow({
        ctx,
        text: "Laser-Torpedo",
        fontSize: "150px",
        fillStyle: "red",
        x: laserConfig.canvasResolution.width / 2,
        y: 200,
      });
      util.renderTextDropShadow({
        ctx,
        text: `Play Laser Torpedo
Signal that you are ready by activating both buttons
        `,
        fontSize: "50px",
        fillStyle: "gold",
        x: laserConfig.canvasResolution.width / 2,
        y: 300,
      });
    }
    if (won == 1 || won == 2) {
      const ctx = MasterCanvas.get2dContext();
      util.renderTextDropShadow({
        ctx,
        text: "Laser-Torpedo",
        fontSize: "150px",
        fillStyle: "green",
        x: laserConfig.canvasResolution.width / 2,
        y: 200,
      });
      util.renderTextDropShadow({
        ctx,
        text: `Team ${won} won the game!`,
        fontSize: "50px",
        fillStyle: "gold",
        x: laserConfig.canvasResolution.width / 2,
        y: 200,
      });
    }
    this.handleHelp(grid);
  },
  handleGameScreen(grid) {
    const ctx = MasterCanvas.get2dContext();
    torpedos.forEach((item) => {
      item.handle(grid);
    });
    launchBases.forEach((item) => {
      item.handle(grid);
    });
    enemies.forEach((item) => {
      item.handle(grid);
    });
  },
  handleHelp(grid) {
    if (help) {
      const ctx = MasterCanvas.get2dContext();

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
because you hovered over the HELP button in the bottom right corner.

This game is about torpedo firing. Each team has a battery of torpedo launch apparatuses.

Three sizes are available, differing in impact power and speed.

When 2 Torpedos collide - they vanish.
When a torpedo hits a launch location - health of launch location is reduced by torpedo size.

Using your laserpoint can sink torpedos as well, hitting moving targets.

Have Fun!

Copyright 2022 C.Kleinhuis and Georg Buchrucker
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
