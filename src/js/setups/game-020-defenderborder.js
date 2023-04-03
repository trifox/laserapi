/**
 * Paradise Game
 *
 * The game switches between 2 game screens:
 * - one is the start screen where only one guiFillButton() triggers the gemeScreen in the onEnterActive()
 * - the other is the game screen with Utilizes multiple  guiFillButtons() that reposition after onEnterActive(),
 *    one guiFillButton() acts as the forbidden fruit, when that guiFillButton triggers an onEnterActive() the game is over.
 *
 */

import util, { drawNgon, getRgbSpreadHex, removeItemFromArray } from '../util.js';
const synth = window.speechSynthesis;
var laserConfig = require('../LaserApiConfig.js').default;
var MasterCanvas = require('../MasterCanvas').default;
var guiFillButton = require('./gui/fillButton').default;
var knobPositions = [];

import soundSpawn from '../../../public/media/369952__mischy__plop-1.wav';
import guiFollowCircle from './gui/followCircle.js';
import { checkBorderAndSlowDown, repellAll } from './game-017-thehorde.js';
var lastResolution = -1;
const bottomBarStartY = 1080 * 0.75;
var help = false;
var level = 1
var lastTime = 0;
var gameState = 'game';
var gameScore = [0, 0];
const intervalSpawn = 15;
const maxAllowed = 10
var baseHealth = 100;
var baseDef = [{
    corners: 4, color: getRgbSpreadHex(
        laserConfig.testColor,
        0.5 + 0.25,
        1,
        1
    )
}, {
    corners: 16, color: getRgbSpreadHex(
        laserConfig.testColor,
        0.5 - 0.25,
        1,
        1
    )
}]
function getItemDistance(item1, item2) {
    const distx = item1.getX() - item2.getX()
    const disty = item1.getY() - item2.getY()
    const dist = Math.sqrt(distx * distx + disty * disty)
    return dist
}

function getDelta() {
    var currentTime = performance.now();
    const elapsed = (currentTime - lastTime) / 1000;

    lastTime = currentTime;
    return elapsed;
}

const createButtonBaseCreatorBaby = (x, y, radius) => {
    let timer = 0;
    const result = guiFollowCircle({
        label: 'Baby',
        posX: x,
        posY: y,
        speedDown: 1,
        speedUp: 1,
        edges: 4,
        edges2: 5,
        angle: Math.PI / 4,
        activeValue: 90,
        radius: radius,
        normalColor: getRgbSpreadHex(laserConfig.testColor, 0.25),
        activeColor: getRgbSpreadHex(laserConfig.testColor, 0.35),
        growColor: getRgbSpreadHex(laserConfig.testColor, 0.45),

    })

    const handleOriginal = result.handle
    result.handle = (grid, elapsed) => {
        handleOriginal(grid, elapsed)

    }
    return result
}
const createButtonBase = (x = 1920 / 2, y = 1080 / 2, radius = 200) => {
    let timer = 0
    const result = guiFillButton({
        label: 'Base',
        posX: x,
        posY: y,
        speedDown: 25,
        speedUp: 25,
        edges: 4,
        edges2: 4,
        angle: Math.PI / 4,
        activeValue: 50,
        radius: radius,
        normalColor: getRgbSpreadHex(laserConfig.testColor, 0.45),
        activeColor: getRgbSpreadHex(laserConfig.testColor, 0.55),
        growColor: getRgbSpreadHex(laserConfig.testColor, 0.65),
        onEnterActive: (sender) => {
            // buttonsBabyBases.push(createButtonBaseCreatorBaby(result.getX(), result.getY(), result.getRadius() / 2))
            // result.setValue(0)
            // removeItemFromArray(buttonsBases, result)
        },
        onExitActive: (sender) => { },
    })
    result.getSpeedX = () => (0)
    result.getSpeedY = () => (0)
    result.setSpeedX = () => { }
    result.setSpeedY = () => { }
    return result
}
const createButtonsGameOverScreen = () => [
    guiFillButton({
        label: 'Start',
        posX: 1920 / 2,
        posY: 1080 / 2 + 200,
        speedDown: 12,
        keyCode: 'Space',
        speedUp: 25,
        edges: Math.floor(3 + Math.random() * 8),
        edges2: undefined, //Math.floor(3 + Math.random() * 8),
        angle: 0,
        activeValue: 90,
        radius: 200,
        normalColor: getRgbSpreadHex(laserConfig.testColor, 0.4),
        activeColor: getRgbSpreadHex(laserConfig.testColor, 0.5),
        growColor: getRgbSpreadHex(laserConfig.testColor, 0.6),
        onEnterActive: (sender) => {
            gameState = 'game';
            buttonsBases = [createButtonBaseCreatorBaby()];
            buttonsBabyBases = []
            gameTime = 0;
            baseHealth = 100;
            buttons = createButtons();
        },
        onExitActive: (sender) => { },
    }),
];
var buttonsGameOverScreen = createButtonsGameOverScreen();
function renderBases(ctx) {


    // util.drawNgon({
    //     ctx,
    //     color: baseDef[0].color,
    //     Xcenter: 1920 / 2,
    //     Ycenter: 1080 / 2,
    //     size: baseHealth,
    //     numberOfSides: 7,
    //     filled: false,
    //     angle: 45,
    //     lineWidth: 5,
    // });


}

var buttons = [];
var buttonsBabyBases = [];
var buttonsBases = [createButtonBaseCreatorBaby(1920 / 2, 1080 / 2, 100)];
const radius = 1920 / 2


function createEnemy() {
    const edges = 12
    const randi = Math.random()
    const swayRadius = Math.random() * 25;

    const result = guiFillButton({
        label: '',
        posX: 105,
        posY: (1080 / 2) + Math.cos(randi * Math.PI * 2) * radius,
        normalColor: getRgbSpreadHex(
            laserConfig.testColor,
            0.65,
            1,
            1
        ),
        edges: edges,
        edges2: edges,
        speedDown: 0,
        activeValue: 50,
        speedUp: 250,
        angle: 0,
        radius: 55 / 2,
        onEnterActive: () => {

            removeItemFromArray(buttons, result)
        }
    })
    let sintimer = 0;
    const index = Math.floor(Math.random() * buttonsBases.length)
    let speedX = 1
    let speedY = Math.random() - 0.5
    const speed = Math.random() * 2 + 2;
    const handleOriginal = result.handle
    result.handle = (grid, elapsed) => {
        sintimer += elapsed;
        result.setX(result.getX() + speedX * speed)
        result.setY(result.getY() + speedY * speed)


        handleOriginal(grid, elapsed)
        if (sintimer > 25) {
            removeItemFromArray(buttons, result)
        }
        if (result.getX() > 1920 - 250) {
            removeItemFromArray(buttons, result)
            gameState = 'gameover'
        }

    }
    result.getSpeedX = () => (speedX)
    result.getSpeedY = () => (speedY)
    result.setSpeedX = (x) => { speedX = x; }
    result.setSpeedY = (x) => { speedY = x }
    return result
}
const createButtons = () => [
];
var lastResolution = -1;
var gameTime = 0;

export default {
    name: 'Laser-Defender',
    description: `
  
  Willkommen beim Verteidigen!

  Das Spiel funktioniert so:

  Verteidigt zusammen die Base in der Mitte vor angreifenden elementen.
  
 .`,
    image: 'media/img/gametitles/laser-defense-###4###.png',
    init: function (data) {
        console.log('init game paradise ', knobPositions);
        buttons = createButtons();
    },
    handle: function (grid, elapsed) {
        elapsed = getDelta();
        if (lastResolution != grid.length) {
            // init();
            lastResolution = grid.length;
        }
        switch (gameState) {
            case 'game':
                this.handleGameScreen(grid, elapsed);
                break;
            case 'gameover':
                this.handleGameOverScreen(grid, elapsed);
                break;
        }
    },

    handleGameOverScreen(grid, elapsed) {
        const ctx = MasterCanvas.get2dContext();
        buttonsGameOverScreen.forEach((item) => item.handle(grid, elapsed));
        util.renderTextDropShadow({
            ctx,
            text: 'Laser-Defender',
            fontSize: '150px',
            fillStyle: getRgbSpreadHex(laserConfig.testColor, 0.4),
            x: laserConfig.canvasResolution.width / 2,
            y: 200,
        });
        util.renderTextDropShadow({
            ctx,
            text: `
Team 1 Points: ${gameScore[0]}
Team 2 Points: ${gameScore[1]}
      `,
            fontSize: '50px',
            fillStyle: getRgbSpreadHex(laserConfig.testColor, 0.5),
            x: laserConfig.canvasResolution.width / 2,
            y: 200,
        });
    },
    handleGameScreen(grid, elapsed) {




        gameTime += elapsed;
        if (gameTime > intervalSpawn) {
            level++
            for (let i = 0; i < 5 * Math.pow(level, 1.5); i++) {
                buttons.push(createEnemy())
            }
            gameTime = 0
        }
        const ctx = MasterCanvas.get2dContext();
        buttons.forEach((item) => {
            item.handle(grid, elapsed);
        });
        buttonsBases.forEach((item) => {
            item.handle(grid, elapsed);
        });
        buttonsBabyBases.forEach((item) => {
            item.handle(grid, elapsed);
        });
        repellAll({ workArray: buttonsBases, targetArray: buttons, elapsed })

        buttons.forEach(item => checkBorderAndSlowDown(item));
        // checkcollisions
        function checkCollision(item1, item2) {
            const distx = item1.getX() - item2.getX()
            const disty = item1.getY() - item2.getY()
            const dist = Math.sqrt(distx * distx + disty * disty)

            return dist < item2.getRadius()
        }
        buttons.forEach(button => {
            buttonsBases.forEach(base => {
                if (checkCollision(button, base)) {
                    base.setRadius(base.getRadius() - 10)
                    if (base.getRadius() <= 0) {
                        removeItemFromArray(buttonsBases, base)
                    }
                    removeItemFromArray(buttons, button)
                }
            })
        })
        renderBases(ctx);
        util.renderTextDropShadow({
            ctx,
            text: `Wave ${level} next wave in ${Math.floor(intervalSpawn - gameTime % intervalSpawn)}s `,
            fontSize: '50px',
            fillStyle: getRgbSpreadHex(laserConfig.testColor, 0.3),
            align: 'left',
            x: 100,
            y: 1080 - 100,
        });
    },
};
