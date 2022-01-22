import util from "../util.js";

var laserConfig = require("../LaserApiConfig.js").default;
var MasterCanvas = require("../MasterCanvas").default;
var guiFillButton = require("./gui/fillButton").default;
var guiFlipButton = require("./gui/flipButton").default;
var guiRangeSlider = require("./gui/rangeSlider").default;
var guiFollowCircle = require("./gui/followCircle").default;
var knobPositions = [];
var won = { getLabel: () => "Start Game" };
var lastResolution = -1;
const leftStartX = 1920 * 0.05;
const rightStartX = 1920 - 1920 * 0.05;
const bottomBarStartY = 1080 * 0.75;
var help = false;
const bottomBarCenterY = (1080 - bottomBarStartY) / 2 + bottomBarStartY;

function createEnemyButton(posX, posY, color, label, edges, radius = 50) {
  const enemy = guiFollowCircle({
    label: "",
    posX: posX,
    posY: posY,
    normalColor: color,
    edges,
    speedDown: 0.1,
    speedUp: 0.01,
    radius: radius,
    onEnterActive: () => {
      // enemy.setX(0);
      // var audio = new Audio(
      //   "https://freesound.org/data/previews/19/19988_37876-lq.mp3"
      // );
      // audio.play();
    },
  });

  return {
    getGui: () => enemy,
    handle: (grid) => {
      // grow element at constant rate up to certain size
      if (enemy.getRadius() < 250) {
        enemy.setRadius(enemy.getRadius() + 0.1);
      } else {
        enemy.setRadius(250);
      }
      enemy.handle(grid);
    },
  };
}
var enemies = [];
var startScreenButtons = [
  guiFillButton({
    label: "Start Game",
    posX: 970,
    posY: 640,
    speedDown: 25,
    speedUp: 100,
    edges: 4,
    radius: 200,
    normalColor: "#00aaff",
    onEnterActive: (sender) => {
      // initialise game
      buttons = initialiseTeams();
      enemies = [];
      help = false;
      won = undefined;
    },
  }),
  guiFillButton({
    label: "Help",
    posX: 1920 - 100,
    posY: 1080 - 100,
    speedDown: 5,
    speedUp: 100,
    edges: 32,
    activeValue: 35,
    radius: 50,
    normalColor: "#00aaff",
    onEnterActive: (sender) => {
      // initialise game
      // buttons = initialiseTeams();
      // enemies = [];
      help = true;
      // won = undefined;
    },
    onExitActive: (sender) => {
      // initialise game
      // buttons = initialiseTeams();
      // enemies = [];
      help = false;
      // won = undefined;
    },
  }),
];
var buttons = initialiseTeams();

function initialiseTeams() {
  return [
    guiFillButton({
      label: "Team1",
      posX: 100,
      posY: 100,
      speedDown: 25,
      speedUp: 100,
      edges: 6,
      radius: 100,
      normalColor: "#00aaff",
      onEnterActive: (sender) => {
        // spawn buttons
        enemies.push(
          createEnemyButton(100, 100, "#00aaff", "Team1", 6, sender.getRadius())
        );
      },
    }),
    guiFillButton({
      label: "Team2",
      posX: 1920 - 100,
      posY: 100,
      speedDown: 25,
      speedUp: 100,
      edges: 5,

      radius: 100,
      normalColor: "#00aaff",
      onEnterActive: (sender) => {
        // spawn buttons
        enemies.push(
          createEnemyButton(
            1920 - 100,
            100,
            "#00ffaa",
            "Team2",
            5,
            sender.getRadius()
          )
        );
      },
    }),
    guiFillButton({
      label: "Team3",
      posX: 1920 - 100,
      posY: 1080 - 100,
      speedDown: 25,
      speedUp: 100,
      edges: 4,

      radius: 100,
      normalColor: "#00aaff",
      onEnterActive: (sender) => {
        // spawn buttons
        enemies.push(
          createEnemyButton(
            1920 - 100,
            100,
            "#00ffaa",
            "Team3",
            4,
            sender.getRadius()
          )
        );
      },
    }),
    guiFillButton({
      label: "Team4",
      posX: 100,
      posY: 1080 - 100,
      speedDown: 25,
      speedUp: 100,
      edges: 3,

      radius: 100,
      normalColor: "#00aaff",
      onEnterActive: (sender) => {
        // spawn buttons
        enemies.push(
          createEnemyButton(
            1920 - 100,
            100,
            "#00ffaa",
            "Team4",
            3,
            sender.getRadius()
          )
        );
      },
    }),
  ];
}

var GPU = require("gpu.js").GPU;
var lastResolution = -1;
function removeItemFromArray(arr, value) {
  console.log("Removing from array", arr, value);
  var index = arr.indexOf(value);
  if (index > -1) {
    arr.splice(index, 1);
  }
  return arr;
}

export default {
  name: "Laser-Basefight",
  init: function (data) {
    console.log("init game mandelbrot ", knobPositions);
  },
  handle: function (grid) {
    if (lastResolution != grid.length) {
      // init();
      lastResolution = grid.length;
    }
    this.handleGameScreen(grid);
  },

  handleGameScreen(grid) {
    const ctx = MasterCanvas.get2dContext();
    if (!won) {
      buttons.forEach((item) => {
        item.handle(grid);

        // item.setX(item.getX() + 1 * Math.random() * 4);
      });
      enemies.forEach((item) => {
        item.handle(grid);

        // item.setX(item.getX() + 1 * Math.random() * 4);
      });
      // make a colision check for each knobEntry
      var toDelete = [];
      var toGrow = [];
      var toShrink = [];
      var handled = [];
      enemies.forEach((item, index) => {
        if (!handled.includes(item)) {
          enemies.forEach((item2, index2) => {
            if (!handled.includes(item2) && item !== item2) {
              const dist = Math.sqrt(
                Math.pow(item.getGui().getX() - item2.getGui().getX(), 2) +
                  Math.pow(item.getGui().getY() - item2.getGui().getY(), 2)
              );
              if (
                dist <
                item.getGui().getRadius() + item2.getGui().getRadius()
              ) {
                // colision
                console.log("collision", dist, item, item2);

                toDelete.push({ item1: item, item2: item2 });
                handled.push(item);
                handled.push(item2);
              }
            }
          });
        }
      });
      // perform the decided actions, grow/unite and delete smaller colided objects
      toDelete.forEach((item) => {
        if (item.item1.getGui().getColor() === item.item2.getGui().getColor()) {
          // same

          if (
            item.item1.getGui().getRadius() > item.item2.getGui().getRadius()
          ) {
            // keep item1 remove item2
            item.item1
              .getGui()
              .setRadius(
                item.item2.getGui().getRadius() * 0.5 +
                  item.item1.getGui().getRadius()
              );
            enemies = removeItemFromArray(enemies, item.item2);
          } else {
            // keep item2 remove item1
            item.item2
              .getGui()
              .setRadius(
                item.item2.getGui().getRadius() +
                  item.item1.getGui().getRadius() * 0.5
              );
            enemies = removeItemFromArray(enemies, item.item1);
          }
        } else {
          // different
          if (
            item.item1.getGui().getRadius() > item.item2.getGui().getRadius()
          ) {
            // keep item1 remove item2
            item.item1
              .getGui()
              .setRadius(
                item.item1.getGui().getRadius() -
                  item.item2.getGui().getRadius() * 0.5
              );
            enemies = removeItemFromArray(enemies, item.item2);
          } else {
            // keep item2 remove item1
            item.item2
              .getGui()
              .setRadius(
                item.item2.getGui().getRadius() -
                  item.item1.getGui().getRadius() * 0.5
              );
            enemies = removeItemFromArray(enemies, item.item1);
          }
        }
      });

      // and check any collisions with spawn area
      const baseCollisions = [];
      enemies.forEach((enemy) => {
        buttons.forEach((base) => {
          if (base.getColor() !== enemy.getGui().getColor()) {
            const dist = Math.sqrt(
              Math.pow(base.getX() - enemy.getGui().getX(), 2) +
                Math.pow(base.getY() - enemy.getGui().getY(), 2)
            );
            if (dist < base.getRadius() + enemy.getGui().getRadius()) {
              //
              baseCollisions.push({ base, enemy });
            }
          }
        });
      });

      baseCollisions.forEach((baseCollision) => {
        baseCollision.base.setRadius(
          baseCollision.base.getRadius() -
            baseCollision.enemy.getGui().getRadius() * 0.1
        );
        removeItemFromArray(enemies, baseCollision.enemy);
        if (baseCollision.base.getRadius() <= 50) {
          removeItemFromArray(buttons, baseCollision.base);
          //  check if game over
          if (buttons.length === 1) {
            won = buttons[0];
          }
        }
      });

      // clamp outside elements and delete them as well
      const toDeleteClamp = [];
      enemies = enemies.filter((enemy) => {
        return (
          enemy.getGui().getX() > 0 &&
          enemy.getGui().getY() > 0 &&
          enemy.getGui().getX() < 1920 &&
          enemy.getGui().getY() < 1080
        );
      });
    }
    if (won) {
      util.renderTextDropShadow({
        ctx,
        text: "Laser-BaseFight",
        fontSize: "150px",
        fillStyle: "green",
        x: laserConfig.canvasResolution.width / 2,
        y: 200,
      });
      util.renderTextDropShadow({
        ctx,
        text: "Winner " + won.getLabel(),
        fontSize: "150px",
        fillStyle: "green",
        x: laserConfig.canvasResolution.width / 2,
        y: 350,
      });
      startScreenButtons.forEach((item) => item.handle(grid));
    }
    if (help) {
      util.renderTextDropShadow({
        ctx,
        text: "Laser-BaseFight",
        fontSize: "150px",
        fillStyle: "red",
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
because you hovered over the HELP button in the bottom right corner.

Start a new 4 Player game using the triangle button in the center.

The game provides each team a base of certain size in the screen corners, 
new minions are spawned by hovering over the corner area.

Each spawned minion grows with time.
Each minion follow to the center of mass of pointing lasers.

When 2 minions of opposite parties collide:
- the bigger is subtracted by the smaller, the smaller dies.

When 2 minions of same party collide:
- they join forces into the bigger of the 2.

When an opposite base is hit:
- the life of the base is subtracted by the minion size.
- when the size of the base falls under a certain value the base is lost.

The team that is last to survive wins the game.

Have Fun!

Copyright 2022 C.Kleinhuis 
Copyright 2022 Frontend Solutions GmbH
Copyright 2022 I-Love-Chaos`,
        fontSize: "26px",
        lineHeight: 25,
        fillStyle: "#00ffff",
        x: laserConfig.canvasResolution.width / 2,
        y: 250,
        dropDistX: 4,
        dropDistY: 4,
      });
    }
  },
};
