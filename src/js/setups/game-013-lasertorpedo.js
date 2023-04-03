import util, {
  getRgbSpreadHex,
  getRgbSpreadRandomHex,
  getRgbSpreadRandomHexTriplet,
} from '../util.js';

var laserConfig = require('../LaserApiConfig.js').default;
var MasterCanvas = require('../MasterCanvas').default;
var guiFillButton = require('./gui/fillButton').default;
var knobPositions = [];

import sonarSound from '../../../public/media/72218__benboncan__sonar.wav';
import drownSound from '../../../public/media/485066__javierserrat__object-falls-into-the-water.wav';
import explodeSmallSound from '../../../public/media/155235__zangrutz__bomb-small (1).mp3';
import explodeSound from '../../../public/media/414346__bykgames__explosion-far.wav';
var lastResolution = -1;
const leftStartX = 1920 * 0.05;
const rightStartX = 1920 - 1920 * 0.05;
const bottomBarStartY = 1080 * 0.75;
var help = false;
var won = -1;

function createTorpedo(
  torpedoSize = 1,
  posX,
  posY,
  edges = 3,
  label = '',
  radius = 25,
  direction = 1,
  colors
) {
  var audio = new Audio(sonarSound);
  audio.play();

  const torpedoParts = [];
  for (var i = 0; i < torpedoSize; i++) {
    torpedoParts.push(
      guiFillButton({
        label: '',
        posX: posX + direction * i * radius * 2,
        posY: posY,
        activeColor: colors[0],
        growColor: colors[1],
        normalColor: colors[2],
        edges: edges,
        angle: Math.PI / 2 - (Math.PI / 2) * direction,
        speedDown: 0,
        scaleX: 3,
        speedUp: 25,
        radius: radius,
        onEnterActive: () => {
          // kill torpedo
          removeItemFromArray(torpedos, thething);
          var audio = new Audio(drownSound);
          audio.play();
        },
      })
    );
  }
  var currentTorpedoSize = torpedoSize;
  var currentSpeed = 50;
  const thething = {
    getGui: () => torpedoParts[0],
    getDirection: () => direction,
    getTorpedoSize: () => currentTorpedoSize,
    handle: (grid, elapsed) => {
      torpedoParts.forEach((item, index) => {
        item.handle(grid, elapsed);
        item.setX(item.getX() + currentSpeed * direction * elapsed);
        if (item.getX() < 0) won = 2;
        if (item.getX() > 1920) won = 1;
      });

      const maxTorp = torpedoParts.reduce((prev, curr) => {
        return Math.max(prev, curr.getValue());
      }, 0);
      torpedoParts.forEach((item) => item.setValue(maxTorp));
      if (direction > 0) {
        MasterCanvas.get2dContext().strokeRect(
          torpedoParts[0].getX() - radius,
          torpedoParts[0].getY() - radius,
          currentTorpedoSize * radius * 2,
          radius * 2
        );
      } else {
        MasterCanvas.get2dContext().strokeRect(
          torpedoParts[0].getX() + radius - currentTorpedoSize * radius * 2,
          torpedoParts[0].getY() - radius,
          currentTorpedoSize * radius * 2,
          radius * 2
        );
      }
    },
  };
  return thething;
}
var activeButtons = [false, false];
var startScreenButtons = [];

const createStartScreenButtons = () => {
  const randcol1 = getRgbSpreadRandomHexTriplet(laserConfig.testColor);
  const randcol2 = getRgbSpreadRandomHexTriplet(laserConfig.testColor);
  return [
    guiFillButton({
      label: 'Team 1',
      posX: 1920 / 2 - 250,
      posY: 1080 / 2 + 250,
      speedDown: 25,
      speedUp: 50,

      keyCode: 'Space',
      edges: 5,
      radius: 200,
      normalColor: randcol1[2],
      growColor: randcol1[1],
      activeColor: randcol1[0],
      onEnterActive: () => {
        console.log('hrhr enter active1', activeButtons);
        activeButtons[0] = true;
        if (
          activeButtons.reduce(
            (previousValue, currentValue) => previousValue && currentValue
          ) === true
        ) {
          won = 0;
          activeButtons = [false, false];
          torpedos = [];
          createBases();
        }
      },
      onExitActive: () => {
        activeButtons[0] = false;

        console.log('hrhr exit active1', activeButtons);
      },
    }),
    guiFillButton({
      label: 'Team 2',
      posX: 1920 / 2 + 250,
      posY: 1080 / 2 + 250,
      speedDown: 25,
      speedUp: 50,
      edges: 5,
      keyCode: 'Space',
      normalColor: randcol2[2],
      growColor: randcol2[1],
      activeColor: randcol2[0],
      radius: 200,
      onEnterActive: () => {
        console.log('hrhr enter active2', activeButtons);
        activeButtons[1] = true;

        if (
          activeButtons.reduce(
            (previousValue, currentValue) => previousValue && currentValue
          ) === true
        ) {
          won = 0;
          activeButtons = [false, false];
          torpedos = [];
          createBases();
        }
      },
      onExitActive: () => {
        activeButtons[1] = true;

        console.log('hrhr exit active2', activeButtons);
      },
    }),
    // guiFillButton({
    //   label: 'Help',
    //   posX: 1920 - 100,
    //   posY: 1080 - 100,
    //   speedDown: 10,
    //   speedUp: 50,
    //   edges: 32,
    //   activeValue: 35,
    //   radius: 50,
    //   normalColor: '#00aaff',
    //   onEnterActive: (sender) => {
    //     help = true;
    //   },
    //   onExitActive: (sender) => {
    //     help = false;
    //   },
    // }),
  ];
};

function createLaunchTorpedoButton(
  posX,
  posY,
  size = 1,
  direction = -1,
  radius = 50,
  edges = 3,
  speedUp = 50,
  callbackTrigger,
  colors
) {
  const base = guiFillButton({
    label: '',
    posX: posX,
    posY: posY,
    angle: Math.PI / 2 - (Math.PI / 2) * direction,
    counterReset: true,
    normalColor: colors[0],
    growColor: colors[1],
    activeColor: colors[2],
    edges: edges,
    speedDown: 25,
    speedUp: speedUp,
    radius: radius,
    onEnterActive: () => {
      // fire torpedo
      if (callbackTrigger) {
        callbackTrigger();
      }
      torpedos.push(
        createTorpedo(
          Number(size),
          1920 / 2 - direction * 550,
          posY + 30 * direction,
          edges,
          'torpedo',
          25,
          direction,
          colors
        )
      );
      // base.setValue(0);
    },
  });
  var currentHealth = Number(size) * 2;

  return {
    getGui: () => base,
    getDirection: () => direction,
    getHealth: () => {
      return currentHealth;
    },
    setValue(x) {
      base.setValue(x);
    },

    setHealth: (x) => {
      currentHealth = x;
    },
    handle: (grid, elapsed) => {
      // // grow element at constant rate up to certain size
      // if (enemy.getRadius() < 250) {
      //   enemy.setRadius(enemy.getRadius() + 0.1);
      // } else {
      //   enemy.setRadius(250);
      // }
      base.handle(grid, elapsed);
      const ctx = MasterCanvas.get2dContext();
      ctx.fillStyle = getRgbSpreadHex(laserConfig.testColor, 0.6);
      for (var i = 0; i < currentHealth; i++) {
        ctx.fillRect(
          posX - radius * direction - 10 * direction,
          posY - i * 11 + (currentHealth * 11) / 2 - 11,
          10,
          10
        );
      }
    },
  };
}
var enemies = [];
var torpedos = [];
var launchBases = [];

function createArrayOfLaunchButtonsThatResetAllAfterALaunch({
  direction,
  xPos,
  yPos,
  colors,
}) {
  var launchies = [];
  const resetFunc = () => {
    launchies.forEach((launchie) => {
      launchie.setValue(0);
    });
  };
  for (var i = 0; i < 3; i++) {
    launchies.push(
      createLaunchTorpedoButton(
        xPos + i * direction * 110,
        yPos,
        i + 1,
        direction,
        15 + 12 * (3 - i),
        5,
        50 - (i + 1) * 10,
        resetFunc,
        colors
      )
    );
  }
  return launchies;
}
function createBases() {
  launchBases = [];
  var col1 = getRgbSpreadRandomHexTriplet(laserConfig.testColor);
  var col2 = getRgbSpreadRandomHexTriplet(laserConfig.testColor);
  col1 = [
    startScreenButtons[0].getActiveColor(),
    startScreenButtons[0].getGrowColor(),
    startScreenButtons[0].getColor(),
  ];
  col2 = [
    startScreenButtons[1].getActiveColor(),
    startScreenButtons[1].getGrowColor(),
    startScreenButtons[1].getColor(),
  ];
  for (var j = 0; j < 6; j++) {
    Array.prototype.push.apply(
      launchBases,
      createArrayOfLaunchButtonsThatResetAllAfterALaunch({
        xPos: 100,
        direction: 1,
        yPos: 150 + j * 150,
        colors: col1,
      })
    );
    Array.prototype.push.apply(
      launchBases,
      createArrayOfLaunchButtonsThatResetAllAfterALaunch({
        xPos: 1920 - 100,
        direction: -1,
        yPos: 150 + j * 150,
        colors: col2,
      })
    );
  }
  // launchBases.push(
  //   createLaunchTorpedoButton(
  //     1920 - 100 - i * 110,
  //     150 + j * 150,
  //     i + 1,
  //     -1,
  //     15 + 12 * (3 - i),
  //     4,
  //     50 - (i + 1) * 10
  //   )
  //);
}
var GPU = require('gpu.js').GPU;
var lastResolution = -1;
function removeItemFromArray(arr, value) {
  var index = arr.indexOf(value);
  if (index > -1) {
    arr.splice(index, 1);
  }
  return arr;
}

export default {
  name: 'Laser-Torpedo',
  description: `Spiel für 2 Teams.


  Jedes Team hat eine Torpedobatterie.
  
  Feuer verschieden große Torpedos.
  
  Ein Torpedo 
  kann mit dem Laser-Pointer zerstört werden.
  
  Sobald ein Torpedo 
  die Batterie durchbricht ist das Spiel vorbei.
  `,
  image: 'media/img/gametitles/laser-torpedo-###4###.png',
  init: function (data) {
    console.log('init game torpedo ', knobPositions);
    startScreenButtons = createStartScreenButtons();
  },
  handle: function (grid, elapsed) {
    if (lastResolution != grid.length) {
      lastResolution = grid.length;
    }
    if (won == 0) {
      this.handleGameScreen(grid, elapsed);
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
              Math.abs(baseRef.getGui().getY() - torpRef.getGui().getY()) <=
              50 &&
              Math.abs(baseRef.getGui().getX() - torpRef.getGui().getX()) <
              baseRef.getGui().getRadius()
            ) {
              console.log('basecollision');
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
    } else {
      this.handleStartScreenScreen(grid, elapsed);
    }
  },

  handleStartScreenScreen(grid, elapsed) {
    const ctx = MasterCanvas.get2dContext();
    startScreenButtons.forEach((item) => item.handle(grid, elapsed));
    if (won === -1) {
      const ctx = MasterCanvas.get2dContext();
      util.renderTextDropShadow({
        ctx,
        text: 'Laser-Torpedo',
        fontSize: '150px',
        fillStyle: getRgbSpreadHex(laserConfig.testColor, 0.5),
        x: laserConfig.canvasResolution.width / 2,
        y: 200,
      });
      util.renderTextDropShadow({
        ctx,
        text: `Play Laser Torpedo
Signal that you are ready by activating both buttons
        `,
        fontSize: '50px',
        fillStyle: getRgbSpreadHex(laserConfig.testColor, 0.5),
        x: laserConfig.canvasResolution.width / 2,
        y: 300,
      });
    }
    if (won == 1 || won == 2) {
      const ctx = MasterCanvas.get2dContext();
      util.renderTextDropShadow({
        ctx,
        text: 'Laser-Torpedo',
        fontSize: '150px',
        fillStyle: getRgbSpreadHex(laserConfig.testColor, 0.6),
        x: laserConfig.canvasResolution.width / 2,
        y: 200,
      });
      util.renderTextDropShadow({
        ctx,
        text: `Team ${won} won the game!`,
        fontSize: '50px',
        fillStyle: getRgbSpreadHex(laserConfig.testColor, 0.4),
        x: laserConfig.canvasResolution.width / 2,
        y: 500,
      });
    }
  },
  handleGameScreen(grid, elapsed) {
    const ctx = MasterCanvas.get2dContext();
    torpedos.forEach((item) => {
      item.handle(grid, elapsed);
    });
    launchBases.forEach((item) => {
      item.handle(grid, elapsed);
    });
    enemies.forEach((item) => {
      item.handle(grid, elapsed);
    });
  },
};
