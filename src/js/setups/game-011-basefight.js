import {
  renderTextDropShadow,
  removeItemFromArray,
  renderTextOutline,
  getRgbSpreadHex,
  getRgbSpreadRandomHex,
} from '../util.js';

var laserConfig = require('../LaserApiConfig.js').default;
var MasterCanvas = require('../MasterCanvas').default;
var guiFillButton = require('./gui/fillButton').default;
var guiFollowCircle = require('./gui/followCircle').default;

/**
 * audio imports
 */
import soundSpawn from '../../../public/media/496199__luminousfridge__player-spawned.ogg';
import soundGrow from '../../../public/media/521966__kastenfrosch__ready-to-start-jingle.ogg';
import soundSmash from '../../../public/media/369952__mischy__plop-1.wav';
import soundBaseCrash from '../../../public/media/155235__zangrutz__bomb-small (1).mp3';
import soundBaseDestroy from '../../../public/media/414346__bykgames__explosion-far.wav';
import soundGameOver from '../../../public/media/70299__kizilsungur__sonar.wav';

var won = { getLabel: () => 'Start Game' }; // indicator for winning team, used to initialise game
var lastResolution = -1; // used to reset stuff wether resolution of grid changes between calls
var help = false; // flag for displaying help screen
/**
 * the create enemy button spawns a moveable object that shrinks over time
 * @param {*} posX
 * @param {*} posY
 * @param {*} color
 * @param {*} label
 * @param {*} edges
 * @param {*} radius
 * @param {*} spawningBaseRef
 * @returns
 */
function createEnemyButton(
  posX,
  posY,
  color,
  label,
  edges,
  radius = 50,
  spawningBaseRef
) {
  const enemy = guiFollowCircle({
    label: '',
    posX: posX,
    posY: posY,
    shrinkSpeed: 8,
    normalColor: color,
    edges,
    speedDown: 0.01,
    scanRadiusFactor: 1.5,
    speedUp: 0.1,
    radius: radius / 2,
  });

  var myself = {
    getGui: () => enemy,
    getSpawningBase: () => spawningBaseRef,
    getBaseDistance: () => {
      const res = Math.sqrt(
        Math.pow(spawningBaseRef.getX() - enemy.getX(), 2) +
        Math.pow(spawningBaseRef.getY() - enemy.getY(), 2)
      );
      //console.log('Base distance is', res);
      return res;
    },
    handle: (grid, elapsed) => {
      enemy.handle(grid, elapsed);
      if (enemy.getRadius() > 150) {
        //        enemy.setRadius(100);
        enemy.setX(enemy.getX() + Math.random() * 6 - 3);
        enemy.setY(enemy.getY() + Math.random() * 6 - 3);
      }
      if (enemy.getRadius() > 200 || enemy.getRadius() <= 5) {
        removeItemFromArray(enemies, myself);
      }
    },
  };
  return myself;
}
var enemies = [];
var startScreenButtons = [];

const createStartScreenButtons = () => [
  guiFillButton({
    label: 'Start Game',
    posX: 970,
    posY: 640,
    keyCode: 'Space',
    speedDown: 25,
    speedUp: 50,
    edges: 4,
    radius: 200,
    normalColor: getRgbSpreadHex(
      laserConfig.testColor,
      Math.random() * 0.5 + 0.25,
      1,
      1
    ),
    activeColor: getRgbSpreadHex(
      laserConfig.testColor,
      Math.random() * 0.5 + 0.25,
      1,
      1
    ),
    growColor: getRgbSpreadHex(
      laserConfig.testColor,
      Math.random() * 0.5 + 0.25,
      1,
      1
    ),
    onEnterActive: (sender) => {
      // initialise game
      basesButtons = initialiseTeams();
      enemies = [];
      help = false;
      won = undefined;
    },
  }),
  // guiFillButton({
  //   label: 'Help',
  //   posX: 1920 - 100,
  //   posY: 1080 - 100,
  //   speedDown: 200,
  //   speedUp: 200,
  //   edges: 32,
  //   activeValue: 35,
  //   radius: 50,
  //   normalColor: getRgbSpreadHex(laserConfig.testColor, 0.5),
  //   growColor: getRgbSpreadHex(laserConfig.testColor, 0.5),
  //   activeColor: getRgbSpreadHex(laserConfig.testColor, 0.5),
  //   onEnterActive: (sender) => {
  //     // initialise game
  //     // buttons = initialiseTeams();
  //     // enemies = [];
  //     help = true;
  //     // won = undefined;
  //   },
  //   onExitActive: (sender) => {
  //     // initialise game
  //     // buttons = initialiseTeams();
  //     // enemies = [];
  //     help = false;
  //     // won = undefined;
  //   },
  // }),
];
var basesButtons = initialiseTeams();
function makeBase({
  posX,
  posY,
  name,
  color = '#00ff00',
  edges = 6,
  radius = 100,
}) {
  var bases = [
    guiFillButton({
      label: name,
      posX: posX,
      posY: posY,
      speedDown: 200,
      speedUp: 200,
      edges,
      edges2: undefined,
      radius: radius,
      normalColor: color,
      activeColor: color,
      growColor: color,
    }),
  ];
  var currentRadius = 100;
  for (var i = 0; i < 4; i++) {
    for (var j = 0; j < 4; j++) {
      if (i == 0 || j == 0 || i == 3 || j == 3) {
        var item = guiFillButton({
          label: '',
          posX: posX + (i * radius) / 2 - radius + radius / 4,
          posY: posY + (j * radius) / 2 - radius + radius / 4,
          speedDown: 200,
          speedUp: 200,
          edges,
          counterReset: false,
          radius: radius / 4,
          normalColor: color,
          activeColor: color,
          growColor: color,
          onEnterActive: (sender) => {
            var audio = new Audio(soundSpawn);
            audio.play();
            // spawn enemy at location
            enemies.push(
              createEnemyButton(
                sender.getX() + (sender.getX() - posX),
                sender.getY() + (sender.getY() - posY),
                color,
                name,
                edges,
                sender.getRadius() * 2,
                myself
              )
            );
          },
        });
        bases.push(item);
      }
    }
  }

  var myself = {
    getColor() {
      return color;
    },
    getX() {
      return posX;
    },
    getY() {
      return posY;
    },
    getRadius() {
      return currentRadius;
    },
    getLabel() {
      return name;
    },
    setRadius(x) {
      currentRadius = x;
      bases[0].setRadius(x);
    },
    handle(grid, elapsed) {
      bases.forEach((item) => item.handle(grid, elapsed));
    },
  };
  return myself;
}
function initialiseTeams() {
  return [
    makeBase({
      posX: 1920 / 2 - 4 * 100,
      posY: 1080 / 2 - 4 * 100,
      name: 'Team 1',
      edges: 3,
      color: getRgbSpreadRandomHex(laserConfig.testColor),
    }),
    makeBase({
      posX: 1920 / 2 + 4 * 100,
      posY: 1080 / 2 - 4 * 100,
      name: 'Team 2',
      edges: 4,
      color: getRgbSpreadRandomHex(laserConfig.testColor),
    }),
    makeBase({
      posX: 1920 / 2 + 4 * 100,
      posY: 1080 / 2 + 4 * 100,
      name: 'Team 3',
      edges: 5,
      color: getRgbSpreadRandomHex(laserConfig.testColor),
    }),
    makeBase({
      posX: 1920 / 2 - 4 * 100,
      posY: 1080 / 2 + 4 * 100,
      name: 'Team 4',
      edges: 6,
      color: getRgbSpreadRandomHex(laserConfig.testColor),
    }),
  ];
}

var lastResolution = -1;
export default {
  name: 'Laser-Basefight',
  description: `Es existieren 4 Basen, 
  such dir als Team eine Basis aus.
  
  Die Basen erzeugen Blasen,
   welche ausserhalb der Basis vereinigt werden können.
  
  Trifft eine Blase auf eine gegnerische Blase,
   so gewinnt die jeweils größere.

  Trifft eine Blase eine Base, 
  verringert sich das Leben der Base.

  Überlebe so lange du kannst mit deiner Base.
   `,
  image: 'media/img/gametitles/laser-basefight-###8###.png',
  init: function (data) {
    console.log('init game basefight ');
    startScreenButtons = createStartScreenButtons();
  },
  handle: function (grid, elapsed) {
    if (lastResolution != grid.length) {
      // init();
      lastResolution = grid.length;
    }
    this.handleGameScreen(grid, elapsed);
  },

  handleGameScreen(grid, elapsed) {
    const ctx = MasterCanvas.get2dContext();
    if (!won) {
      basesButtons.forEach((item) => {
        item.handle(grid, elapsed);

        // item.setX(item.getX() + 1 * Math.random() * 4);
      });
      enemies.forEach((item) => {
        item.handle(grid, elapsed);

        // item.setX(item.getX() + 1 * Math.random() * 4);
      });
      // make a colision check for each knobEntry
      var toDelete = [];
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
                //console.log('collision', dist, item, item2);

                toDelete.push({ item1: item, item2: item2 });
                handled.push(item);
                handled.push(item2);
              }
            }
          });
        }
      });

      var playGrow = false;
      var playFlop = false;

      // perform the decided actions, grow/unite and delete smaller colided objects
      toDelete.forEach((item) => {
        if (item.item1.getGui().getColor() === item.item2.getGui().getColor()) {
          // same, check that only outside of base joining cann happen
          if (
            item.item1.getBaseDistance() > 125 &&
            item.item2.getBaseDistance() > 125
          ) {
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
            playGrow = true;
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
          playFlop = true;
        }
      });
      if (playFlop) {
        var audio = new Audio(soundSmash);
        audio.play();
      }
      if (playGrow) {
        var audio = new Audio(soundGrow);
        audio.play();
      }
      // and check any collisions with spawn area
      const baseCollisions = [];
      enemies.forEach((enemy) => {
        basesButtons.forEach((base) => {
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
          baseCollision.enemy.getGui().getRadius() * 0.5
        );
        //('Remove Enemy collisition with base item');
        removeItemFromArray(enemies, baseCollision.enemy);
        var audio = new Audio(soundBaseCrash);
        audio.play();
        if (baseCollision.base.getRadius() <= 25) {
          removeItemFromArray(basesButtons, baseCollision.base);

          var audio = new Audio(soundBaseDestroy);
          audio.play();
          //  check if game over
          if (basesButtons.length === 1) {
            won = basesButtons[0];
            var audio = new Audio(soundGameOver);
            audio.play();
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
    } else {
      renderTextDropShadow({
        ctx,
        text: 'Laser-BaseFight',
        fontSize: '150px',
        fillStyle: getRgbSpreadHex(laserConfig.testColor, 0.6),
        x: laserConfig.canvasResolution.width / 2,
        y: 200,
      });
      renderTextDropShadow({
        ctx,
        text: (won.getX ? 'Winner Is ' : '') + won.getLabel(),
        fontSize: '150px',
        fillStyle: getRgbSpreadHex(laserConfig.testColor, 0.4),
        x: laserConfig.canvasResolution.width / 2,
        y: 350,
      });
      startScreenButtons.forEach((item) => item.handle(grid, elapsed));
    }
  },
};