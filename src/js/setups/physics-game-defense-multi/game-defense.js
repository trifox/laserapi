import util, { getRgbSpread, getRgbSpreadHex, removeItemFromArray } from '../../util.js';
import { repellAll } from '../game-017-thehorde.js';
import guiFollowCircle from '../gui/followCircle.js';

var laserConfig = require('../../LaserApiConfig.js').default;
var MasterCanvas = require('../../MasterCanvas').default;
var PhysicsPong = require('./PhysicsDefense').default;
var guiFillButton = require('../gui/fillButton').default;

import soundPlop from '../../../../public/media/369952__mischy__plop-1.wav';
PhysicsPong.callbackBallOutside = () => {
    // init();
    enemyBalls = []
    paddles = []

};

PhysicsPong.callbackWaveBegin = () => {
    //    const spawnType = Math.random() > 0.5 ? OBSTACLE_TYPES.CIRCLE : Math.random() > 0.5 ? OBSTACLE_TYPES.DIAMOND : OBSTACLE_TYPES.BOX
    const spawnType = OBSTACLE_TYPES.CIRCLE
    var minX = 1920
    var maxX = 1920 / 2
    var minY = (1080 - 400)
    var maxY = (1080 - 400) / 2
    paddles.forEach(item => {
        minX = Math.min(item.paddle.getX(), minX)
        maxX = Math.max(item.paddle.getX(), maxX)
        minY = Math.min(item.paddle.getY(), minY)
        maxY = Math.max(item.paddle.getY(), maxY)
    })
    /** determine position
     * try to stack them vertically
     */
    var spawnPosY = minY - 200

    if (spawnPosY < 0) {
        spawnPosY = 1080 - 400
    }
    var spawnPosX = maxX + 200
    if (spawnPosX > 1920) {
        spawnPosX = minX - 200
        if (spawnPosX < 1920 / 2) {
            spawnPosX = minX
            spawnPosY = maxY
        }
    }
    PhysicsPong.addObstacle(spawnType, {
        posX: spawnPosX,
        posY: spawnPosY + 200,
        radius: 100
    })

}
PhysicsPong.callBackObstacleCreated = (enemy) => {

    paddles.push({ physics: enemy, paddle: createPaddle({ posX: enemy.position[0], posY: enemy.position[1], radius: enemy.shapes[0].radius ? enemy.shapes[0].radius : enemy.shapes[0].width / 2 }) })
}
PhysicsPong.callBackObstacleDeleted = (enemy) => {


    removeItemFromArray(paddles, paddles.find(item => (item.physics === enemy)))

}
PhysicsPong.callBackBallCreated = (enemy) => {
    let radios = enemy.circleBody.shapes[0].radius
    enemyBalls.push({
        physics: enemy,
        button: guiFillButton({
            label: '',
            visible: false,
            posX: enemy.circleBody.position[0],
            posY: enemy.circleBody.position[1],
            normalColor: getRgbSpreadHex(laserConfig.testColor, 0.7, 0.7, 0.7),
            angle: 0 + Math.PI / 4,
            edges: 32,
            visible: true,
            edges2: undefined,
            speedUp: 125 - (radios / 150) * 50,
            speedDown: 0,
            scanRadiusFactor: radios < 150 ? 1.75 : 1,
            radius: radios,
            singlePixel: radios < 100,
            onEnterActive: () => {
                PhysicsPong.removeBall(enemy)
                PhysicsPong.addKilledCount()

                var audio = new Audio(soundPlop);
                audio.play();
                currentMoneyScore += enemy.type == BALL_TYPES.NORMAL ? 5 : 20;
            }
        })
    })
};

PhysicsPong.callBackBallDeleted = (enemy) => {
    const balldef = enemyBalls.find(item => { return item.physics === enemy })
    removeItemFromArray(enemyBalls, balldef)
};
var currentMoneyScore = 100

import soundMotivation1 from '../../../../public/media/fans2-606958_6072659-lq.mp3';
import soundMotivation2 from '../../../../public/media/fans1-463918_9722681-lq.mp3';
import { BALL_TYPES, OBSTACLE_TYPES } from './PhysicsDefense';
var obstacleSizeY = 30;
var obstacleSizeX = 30;
var moveSpeed = 125;
var itemCount = 0;
var clampMovementX = true;
var lastTime = performance.now();
var countDown = 0;
console.log('init pong to state start');
var gameState = 'game';
var paddles = [];
var enemyBalls = [];
const isInsideRect = function (rect1, rect2) {
    //   console.log('comparing ', rect1, rect2)
    var p1 = rect1.topleft.x < rect2.topright.x;
    var p2 = rect1.topright.x > rect2.topleft.x;

    var p3 = rect1.topleft.y < rect2.bottomright.y;
    var p4 = rect1.bottomright.y > rect2.topleft.y;

    var result = p1 && p2 && p3 && p4;
    //    console.log('r======== ', result)
    return result;
};

function getDist(rect1, rect2) {
    // diostance to center of rects

    var p1 = {
        x: (rect1.topleft.x + rect1.bottomright.x) / 2,
        y: (rect1.topleft.y + rect1.bottomright.y) / 2,
    };
    var p2 = {
        x: (rect2.topleft.x + rect2.bottomright.x) / 2,
        y: (rect2.topleft.y + rect2.bottomright.y) / 2,
    };
    return {
        x: (p1.x - p2.x) / 2,
        y: (p1.y - p2.y) / 2,
    };
}
function createPaddle({ posX = 0, posY = 0, radius = 25 }) {
    const result = guiFollowCircle({
        label: '',
        posX: posX,
        posY: posY,
        normalColor: getRgbSpreadHex(laserConfig.testColor, 0.7, 0.7, 0.7),
        lineWidth: 2,
        speedDown: 0.1,
        angle: 0 + Math.PI,
        edges: 15,
        visible: false,
        edges2: undefined,
        speedUp: 0.1,
        scanRadiusFactor: 1,
        followTrueOrRepellFalse: true,
        radius: radius,
    })
    return result

}

function init(data) {
    if (!data) {
        data = {};
    }
    if (data) {
        if (data.itemCount !== undefined) {
            itemCount = data.itemCount;
        }
        if (data.moveSpeed !== undefined) {
            moveSpeed = data.moveSpeed;
        }
        if (data.obstacleSize !== undefined) {
            obstacleSizeX = data.obstacleSize * laserConfig.playfieldScale;
            obstacleSizeY = data.obstacleSize * laserConfig.playfieldScale;
        }

        if (data.obstacleSizeX !== undefined) {
            obstacleSizeX = data.obstacleSizeX * laserConfig.playfieldScale;
        }

        if (data.clampMovementX !== undefined) {
            clampMovementX = data.clampMovementX * laserConfig.playfieldScale;
        }

        if (data.obstacleSizeY !== undefined) {
            obstacleSizeY = data.obstacleSizeY * laserConfig.playfieldScale;
        }
    }
    PhysicsPong.init(data);
    // knobPositions = [];
    paddles = [];
    for (var i = 0; i < itemCount; i++) {
        paddles.push(
            createPaddle({
                posX: 1920 - 200,
                posY: i * 100 + 100
            })
        );


    }
    lastTime = performance.now();
    // console.log('initialised pong ', knobPositions);
}
var activeButtons = [false, false];
var lastResolution = -1;
const buttons = [
    guiFillButton({
        label: 'Team 1',
        posX: 1920 / 2 - 400,
        posY: 650,
        keyCode: 'Space',
        radius: 200,
        onEnterActive: () => {
            console.log('hrhr enter active1');
            activeButtons[0] = true;
            if (
                activeButtons.reduce(
                    (previousValue, currentValue) => previousValue && currentValue
                ) === true
            ) {
                PhysicsPong.init();
                gameState = 'game';
            }
        },
        onExitActive: () => {
            activeButtons[0] = false;
            console.log('hrhr exit active1');
        },
    }),
    guiFillButton({
        label: 'Team 2',
        keyCode: 'Space',
        posX: 1920 / 2 + 400,
        posY: 650,
        radius: 200,
        onEnterActive: () => {
            activeButtons[1] = true;
            console.log('hrhr enter active2', gameState);
            if (
                activeButtons.reduce(
                    (previousValue, currentValue) => previousValue && currentValue
                ) === true
            ) {
                PhysicsPong.init();

                gameState = 'game';
            }
        },
        onExitActive: () => {
            activeButtons[1] = false;
            console.log('hrhr exit active2', gameState);
        },
    }),
];


export default {
    name: 'Laser-Defense Multiplayer',
    description: `
    Verteidige die Rechte Seite: 
    Schütze vor Angriffen!

    Setze Barrieren ein, 
    um die Angreifer aufzuhalten und ihre Angriffe umzulenken!

    Zerstöre Angreifer mit deinem Laser!
  `,
    image: 'media/img/gametitles/laser-defense-###8###.png',
    init: function (data) {
        init(data);

        // console.log('init game pong ', knobPositions);
    },
    handle: function (grid, elapsed) {
        const ctx = MasterCanvas.get2dContext()
        if (lastResolution != grid.length) {
            init();
            lastResolution = grid.length;
        }

        if (gameState == 'start') {
            this.handleStartGame(grid, elapsed);
        } else {
            // util.renderText({
            //     ctx: MasterCanvas.get2dContext(),
            //     text: `Money: ${currentMoneyScore}`,
            //     fontSize: '50px',
            //     fillStyle: 'green',
            //     x: laserConfig.canvasResolution.width / 2 + 100,
            //     y: 1080 - 100,
            // });
            // spawButtons.forEach((item) => item.handle(grid, elapsed));
            // update physics positions



            repellAll({ workArray: paddles, targetArray: paddles, elapsed, fieldName: 'paddle' });
            paddles.forEach((item) => {
                item.paddle.handle(grid, elapsed);
            });

            PhysicsPong.step(elapsed);
            PhysicsPong.render(ctx);
            enemyBalls.forEach((item) => {
                item.button.setX(item.physics.circleBody.position[0])
                item.button.setY(item.physics.circleBody.position[1])
                item.button.handle(grid, elapsed)
            })
            paddles.forEach((item) => {
                item.physics.position[0] = item.paddle.getX()
                item.physics.position[1] = item.paddle.getY()
            })

        }
    },

    handleStartGame(grid, elapsed) {
        util.renderText({
            ctx: MasterCanvas.get2dContext(),
            text: 'Laser-Pong',
            fontSize: '150px',
            fillStyle: 'green',
            x: laserConfig.canvasResolution.width / 2,
            y: 200,
        });
        util.renderText({
            ctx: MasterCanvas.get2dContext(),
            text: 'Activate Both buttons to start game and indicate you are ready',
            fontSize: '50px',
            x: laserConfig.canvasResolution.width / 2,
            y: 300,
        });
        buttons.forEach((item) => item.handle(grid, elapsed));
    },
};
