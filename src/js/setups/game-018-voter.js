import { renderTextDropShadow, drawLine, renderTextOutline } from '../util.js';

var laserConfig = require('../LaserApiConfig.js').default;
var MasterCanvas = require('../MasterCanvas').default;
var guiFillButton = require('./gui/fillButton').default;
var pixelCountButton = require('./gui/pixelCountButton').default;

import { lerp2dArray, sin3, slerp } from '../math.js';
import pixelCount1D from './gui/pixelCount1D.js';
import pixelCount2D from './gui/pixelCount2D.js';
const TYPE_MULTIPLE_CHOICE = 'TYPE_MULTIPLE_CHOICE'
const TYPE_SCALE1D = 'TYPE_SCALE1D'
const TYPE_SCALE2D = 'TYPE_SCALE2D'
var bgSound;
var spawnButtons = [];
var help = false;
var helpButton = guiFillButton({
  label: 'Help',
  posX: 1920 - 100,
  posY: 1080 - 100,
  speedDown: 50,
  speedUp: 100,
  edges: 32,
  activeValue: 35,
  radius: 50,
  normalColor: '#00aa00',
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
});
var voteButtons = [
  // pixelCountButton({
  //   label: 'VIELLEICHT',
  //   posX: 1920 / 2 - 600,
  //   posY: 1080 / 2 + 300,
  //   scanRadiusFactor: 0.5,
  //   radius: 100,
  //   normalColor: 'green',
  // }),
  // pixelCountButton({
  //   label: 'NEIN',
  //   posX: 1920 / 2 - 200,
  //   posY: 1080 / 2 + 300,
  //   radius: 100,
  //   normalColor: 'green',
  //   scanRadiusFactor: 0.5,
  // }),

  // pixelCountButton({
  //   label: 'JA',
  //   posX: 1920 / 2 + 200,
  //   posY: 1080 / 2 + 300,
  //   scanRadiusFactor: 0.5,
  //   radius: 100,
  //   normalColor: 'green',
  // }),

  // pixelCountButton({
  //   label: 'VIELLEICHT',
  //   posX: 1920 / 2 + 600,
  //   posY: 1080 / 2 + 300,
  //   radius: 100,
  //   scanRadiusFactor: 0.5,
  //   normalColor: 'green',
  // }),
  // pixelCountButton({
  //   label: 'VIELLEICHT',
  //   posX: 200 + 1920 / 2 + 600,
  //   posY: 1080 / 2 - 200,
  //   radius: 100,
  //   scanRadiusFactor: 0.5,
  //   normalColor: 'green',
  // }),
  // pixelCountButton({
  //   label: 'VIELLEICHT',
  //   posX: 200 + 1920 / 2 + 200,
  //   posY: 1080 / 2 - 200,
  //   radius: 100,
  //   scanRadiusFactor: 0.5,
  //   normalColor: 'green',
  // }),
  // pixelCountButton({
  //   label: 'VIELLEICHT',
  //   posX: 200 + 1920 / 2 - 200,
  //   posY: 1080 / 2 - 200,
  //   radius: 100,
  //   scanRadiusFactor: 0.5,
  //   normalColor: 'green',
  // }),
  // pixelCountButton({
  //   label: 'VIELLEICHT',
  //   posX: 200 + 1920 / 2 - 600,
  //   posY: 1080 / 2 - 200,
  //   radius: 100,
  //   scanRadiusFactor: 0.5,
  //   normalColor: 'green',
  // }),
  // // pixelCountButton({
  // //   label: 'VIELLEICHT',
  // //   posX: 200 + 1920 / 2 - 1000,
  // //   posY: 1080 / 2 - 200,
  // //   radius: 100,
  // //   scanRadiusFactor: 0.5,
  // //   normalColor: 'green',
  // // }),
  // pixelCount1D({
  //   label: 'xxxxxx',
  //   posX: 200 + 1920 / 2 - 1000,
  //   posY: 1080 / 2 - 100,
  //   radius: 100,
  //   scanRadiusFactor: 0.5,
  //   normalColor: 'red',
  // }),
];
var presets = [
  {
    "text": "Welches Spiel?",
    "imageUrl": "",
    "type": "TYPE_MULTIPLE_CHOICE",
    "options": [
      { "text": "Laser-Fire" },
      { "text": "Laser-Paradise" },
      { "text": "Laser-Pong" },
      { "text": "Laser-Basefight" },
      { "text": "Laser-Torpedo" },
      { "text": "Laser-Flap" },
      { "text": "Laser-Shark" },
      { "text": "Laser-SharkPool" },
      { "text": "Laser-CowHorde" }
    ]
  },
  {
    "text": "Welches Thema?",
    "type": "TYPE_MULTIPLE_CHOICE",
    "options": [{ "text": "Ego" }, { "text": "Tod" }, { "text": "Hygiene" }, { "text": "Sex" }, { "text": "Gewalt" }, { "text": "Ängste" }, { "text": "lieber Retrogames" }]
  },

  {
    "text": "Allgemein 1", "imageUrl": "", "type": "TYPE_MULTIPLE_CHOICE", "options": [{ "text": "Ja" }, { "text": "Nein" }, { "text": "Vielleicht" }, { "text": "kein Kommentar" }]
  },

  {
    "text": "Allgemein 1D", "imageUrl": "", "type": "TYPE_SCALE1D", "options": [{ "text1": "1", "text2": "100" }]
  },

  {
    "text": "Ego1. Ich bin ... wie alle anderen",
    "fontSize": 10,
    "imageUrl": "",
    "type": "TYPE_MULTIPLE_CHOICE",
    "options": [
      { "text": "schlechter" },
      { "text": "besser" },
      { "text": "genauso gut" },
      { "text": "kein Kommentar" }
    ]
  },

  {
    "text": "Ego2 Ich bin ... ",
    "fontSize": 10,
    "imageUrl": "",
    "type": "TYPE_MULTIPLE_CHOICE",
    "options": [
      { "text": "besser, \n aber heimlich" },
      { "text": "schlechter und \n deswegen besser" },
      { "text": "schlechter, \n weil pech" },
      { "text": "besser, \n weil glück" },
      { "text": "kein Kommentar" }
    ]
  },

  {
    "text": "Wie oft am Tag halte ich mich für ein\nGenie und wie oft für einen Idioten ? ",
    "type": "TYPE_SCALE2D", "options": [{
      "text1": "Y",
      "text2": "",
      "text3": "0",
      "text4": "X"
    }]
  },

  {
    "text": "Ego3 Aufmerksamkeit von ... ist am schönsten ",
    "fontSize": 10,
    "imageUrl": "",
    "type": "TYPE_MULTIPLE_CHOICE",
    "options": [
      { "text": "Eltern und \n Familie" },
      { "text": "Partner und \n enge Freunde" },
      { "text": "lose Bekannte \n oder Fremde" },
      { "text": "kein Kommentar" }
    ]
  }

  ,

  {
    "text": "Angst 1  Was macht mir am meisten Angst? ",
    "fontSize": 10,
    "imageUrl": "",
    "type": "TYPE_MULTIPLE_CHOICE",
    "options": [
      { "text": "Tod" },
      { "text": "Schmerz" },
      { "text": "Verlust" },
      { "text": "Schuld" },
      { "text": "kein Kommentar" }
    ]
  }

  ,

  {
    "text": "Angst 2  Wer macht mir am meisten Angst? ",
    "fontSize": 10,
    "imageUrl": "",
    "type": "TYPE_MULTIPLE_CHOICE",
    "options": [
      { "text": "Ich" },
      { "text": "die anderen" },
      { "text": "Krankheit" },
      { "text": "die Regierung" },
      { "text": "kein Kommentar" }
    ]
  }

]
var presetIndex = 0
var windowMama;
var lastResolution = -1;
var time = Math.random() * 1000;
var lastTime = 0;
var elapsed = 0;


function loadIntoWindow(presetName) {
  if (!windowMama) {
    // console.log('loading preset into window', presetName);
    // console.log('loading preset into window', currentPresets);
    // var cpre = currentPresets.presets[presetName];
    // console.log('loading preset into window', cpre);

    const winHtml = `

    < html >
  <head>
  <link rel="stylesheet" href="https://www.w3schools.com/w3css/4/w3.css">
  <style>
  
  body{
    display:grid;
    grid-template-columns: 1fr 3fr
  }
  .buttonclass{
    background-color:red;
   cursor:pointer;
  }

  .buttonclass:hover {
    background-color: green;}
  </style>
  </head>
  <body>

  <label>Presets</label>
  <div>
       ${presets.map((item) => {
      return `<div class='buttonclass'>${item.text}</div ><br/>`;
    }).join('')} 
  </div> 
  </body>
  </html >
  `;
    const winUrl = URL.createObjectURL(
      new Blob([winHtml], { type: 'text/html' })
    );
    windowMama = window.open(winUrl, 'laser api voter', 'height=600,width=600');


    if (windowMama) {
      windowMama.addEventListener('onbeforeunload ', () => {
        windowMama = null
      })
      windowMama.addEventListener('load', () => {

        // register callbacks  
        Array.from(
          windowMama.document
            .getElementsByClassName("buttonclass")).forEach((item, index) => {
              console.log('registering click listener', item)
              item.addEventListener('click', (evt) => {
                console.log('register inner window button clicked')
                mode = modes.VIEW
                voteButtons = []

                presetIndex = index
              })
            })
      }, true);
    }
  }
}

var img = new Image();
var modes = {
  VIEW: 'VIEW',
  COUNTDOWN: 'COUNTDOWN',
  RESULT: 'RESULT',
}
var mode = 'VIEW' // VIEW COUNTDOWN RESULT
var counter = 0;
var resultSnapshot = {
  type: '',

}
function doTimeout() {
  counter--
  console.log('Counting down', counter)
  if (counter > 0) {

    setTimeout(doTimeout, 1000)
  } else {
    mode = modes.RESULT
    // grab current result
    switch (presets[presetIndex].type) {
      case TYPE_MULTIPLE_CHOICE:
        console.log('Result choice')

        const totalValue = voteButtons.reduce(
          (prev, curr) => prev + curr.getFillPercent(),
          0
        );
        const maxValue = voteButtons.reduce(
          (prev, curr) => Math.max(prev, curr.getFillPercent()),
          0
        );
        voteButtons.forEach((item, index) => {
          // var newtext = currentPreset.options[index].text;
          // item.setLabel(newtext);
          if (item.getFillPercent() == maxValue) {
            console.log('RES is', item.getLabel())
            resultSnapshot = {
              type: TYPE_MULTIPLE_CHOICE,
              buttonIndex: index
            }
          } else {
          }

        });
        break;
      case TYPE_SCALE1D:
        console.log('RESULT IS', voteButtons[0].getMeanX())
        resultSnapshot = {
          type: TYPE_SCALE1D,
          meanX: voteButtons[0].getMeanX(),
        }
        break;
      case TYPE_SCALE2D:
        console.log('RESULT IS', voteButtons[0].getMeanX())
        console.log('RESULT IS', voteButtons[0].getMeanY())
        resultSnapshot = {
          type: TYPE_SCALE2D,
          meanX: voteButtons[0].getMeanX(),
          meanY: voteButtons[0].getMeanY()
        }
        break;
    }
  }
}
const handleKeyEvent = (e) => {
  if (e.code === 'Space' && mode === modes.VIEW) {
    counter = 3
    mode = modes.COUNTDOWN
    console.log('A SPACE KEY HAS BEEN PRESSED ')
    setTimeout(doTimeout, 1000)
  } else if (e.code == 'ArrowUp') {
    // up arrow
    console.log('xxxxxxxxxxxxxxxxxxxUp', presetIndex)
    presetIndex++
    mode = modes.VIEW
    voteButtons = []
    if (presetIndex > presets.length - 1) {
      presetIndex = 0
    }
  }
  else if (e.code == 'ArrowDown') {
    // down arrow
    console.log('xxxxxxxxxxxxxxxxxxxxUp')
    presetIndex--
    mode = modes.VIEW
    voteButtons = []
    if (presetIndex < 0) {
      presetIndex = presets.length - 1
    }
  }
}
export default {
  name: 'Laser-Voter',
  description: `Dies ist ein Umfrage System.
  
  Georg wird euch Fragen zur auswahl vorstellen.`,
  init: function (data) {
    console.log('init game laser voter ');

    // if (localStorage.getItem('laserVoter')) {
    //   currentPresets = JSON.parse(localStorage.getItem('laserVoter'));
    // }
    loadIntoWindow();
    console.log('window', window, windowMama);



    document.addEventListener('keydown', handleKeyEvent)
    // windowMama.document.write();
  },
  stop() {
    if (windowMama) {
      windowMama.close();
    }
    document.removeEventListener('keydown', handleKeyEvent)
  },
  handle: function (grid) {
    var currentTime = performance.now();
    elapsed = (currentTime - lastTime) / 1000;

    // registerListener('presets', handlePresetChange);
    lastTime = currentTime;

    if (lastResolution != grid.length) {
      // init();
      lastResolution = grid.length;
    }
    const ctx = MasterCanvas.get2dContext();

    time += elapsed * 0.1;

    this.handleSpawnScreen(grid);
  },

  handleSpawnScreen(grid) {
    const ctx = MasterCanvas.get2dContext();
    // const currentPreset = {
    //   text: psychoGetElementInOpenedWindow('text'),
    //   imageUrl: psychoGetElementInOpenedWindow('imageUrl'),
    //   options: [
    //     { text: psychoGetElementInOpenedWindow('option-1') },
    //     { text: psychoGetElementInOpenedWindow('option-2') },
    //     { text: psychoGetElementInOpenedWindow('option-3') },
    //     { text: psychoGetElementInOpenedWindow('option-4') },
    //   ],
    // };
    var currentPreset = presets[presetIndex]

    if (currentPreset.imageUrl && img.src !== currentPreset.imageUrl) {
      img.src = currentPreset.imageUrl;
    }
    if (img.complete) {
      try {
        ctx.drawImage(img, 0, 0);
      } catch (e) {
        // silent catchy
      }
    }
    // if (
    //   windowMama.document.activeElement &&
    //   windowMama.document.activeElement.id !== 'preset-name'
    // ) {
    //   console.log('tryinbg to0 save');
    //   currentPresets.presets[psychoGetElementInOpenedWindow('preset-name')] =
    //     currentPreset;
    //   if (
    //     JSON.stringify(currentPresets) !== localStorage.getItem('laserVoter')
    //   ) {
    //     console.log('saved Presets');

    //     localStorage.setItem('laserVoter', JSON.stringify(currentPresets));
    //   }
    // }
    // console.log('Laservoter is', currentPresets);

    // voteButtons = []
    if (voteButtons.length === 0) {
      switch (currentPreset.type) {
        case TYPE_MULTIPLE_CHOICE:

          var textRowCount = currentPreset.text.split('\n').length;
          var itemDynamicColumns = Math.ceil(currentPreset.options.length / 2)
          var itemDynamicWidth = 100
          var itemDynamicGap = 100
          if (currentPreset.options.length > 6) {
            // itemDynamicColumns = 5
            itemDynamicWidth = 100
            itemDynamicGap = 100
          } else {
            itemDynamicColumns = 3
            itemDynamicWidth = 100
            itemDynamicGap = 400

          }

          var row = 0
          var column = 0
          currentPreset.options.forEach((option, index) => {
            console.log('Option is', option)

            voteButtons.push(pixelCountButton({
              live: false,
              label: option.text,
              posX: 100 + 1920 / 2 - 850 + itemDynamicWidth + column * (itemDynamicWidth * 2 + itemDynamicGap),
              posY: 1080 / 2 + row * (itemDynamicWidth * 2 + 125) - 275 + textRowCount * 50,
              radius: itemDynamicWidth,
              scanRadiusFactor: 1,
              normalColor: 'green',
            }),)
            column += 1
            if (column >= itemDynamicColumns) {
              row += 1
              column = 0
            }
          })
          // voteButtons.forEach((item, index) => {
          //   var newtext = currentPreset.options[index].text;
          //   item.setLabel(newtext);
          //   if (item.getFillPercent() == maxValue) {
          //     ctx.fillStyle = 'green';
          //   } else {
          //     ctx.fillStyle = 'blue';
          //   }
          //   ctx.fillRect(
          //     item.getX() - item.getRadius(),
          //     item.getY() + item.getRadius(),
          //     item.getRadius() * 2,
          //     item.getRadius() * 2 * (item.getFillPercent() / maxValue)
          //   );
          // });
          break;
        case TYPE_SCALE1D:
          var row = 0
          var column = 0
          console.log('Current is scale1d')

          currentPreset.options.forEach((option, index) => {
            console.log('Option 1d is', option)

            voteButtons.push(pixelCount1D({
              live: false,
              label1: option.text1,
              label2: option.text2,
              posX: 1920 / 2,
              posY: 1080 / 2,
              radius: 500,
              scanRadiusFactor: 1,
              normalColor: 'green',
            }),)
            column += 1
            if (column > 5) {
              row += 1
              column = 0
            }
          })
          break;
        case TYPE_SCALE2D:
          var row = 0
          var column = 0
          console.log('Current is scale2d')

          currentPreset.options.forEach((option, index) => {
            console.log('Option 2d is', option)

            voteButtons.push(pixelCount2D({
              live: false,
              label1: option.text1,
              label2: option.text2,
              label3: option.text3,
              label4: option.text4,
              posX: 1920 / 2,
              posY: 1080 / 2 + 125,
              radius: 250,
              scanRadiusFactor: 1,
              normalColor: 'green',
            }),)
            column += 1
            if (column > 5) {
              row += 1
              column = 0
            }
          })
          break;
      }
    }


    // console.log('Buttons are', voteButtons)

    voteButtons.forEach((item) => item.handle(grid));

    // console.log('total fill percent is', totalValue);
    // calculate sum values

    // console.log('window', window, windowMama, windowMama.document);
    renderTextOutline({
      ctx,
      text: `${currentPreset.text} `,
      fontSize: '56px',
      lineHeight: 56,
      fillStyle: '#0088ff',
      x: laserConfig.canvasResolution.width / 2,
      y: 100,
      dropDistX: 4,
      dropDistY: 4,
    });
    switch (mode) {
      case modes.VIEW:
        renderTextDropShadow({
          ctx,
          text: 'PREPARE',
          fontSize: '50px',
          fillStyle: 'cyan',
          x: 200,
          y: 1080 - 50,
        });
        break;
      case modes.COUNTDOWN:
        renderTextDropShadow({
          ctx,
          text: counter,
          fontSize: '200px',
          fillStyle: 'cyan',
          x: 200,
          y: 1080 - 50,
        });
        break;
      case modes.RESULT:
        renderTextDropShadow({
          ctx,
          text: 'RESULT',
          fontSize: '50px',
          fillStyle: 'cyan',
          x: 200,
          y: 1080 - 50,
        });


        switch (resultSnapshot.type) {
          case TYPE_MULTIPLE_CHOICE:
            var button = voteButtons[resultSnapshot.buttonIndex]

            ctx.fillStyle = '#00ffff';
            ctx.fillRect(
              button.getX() - button.getRadius(), button.getY() - button.getRadius(),
              button.getRadius() * 2, button.getRadius() * 2);
            break;
          case TYPE_SCALE1D:
            // console.log('Rendering result 2d', resultSnapshot)
            ctx.fillStyle = '#0000ff88';
            var posix = Math.floor(resultSnapshot.meanX / voteButtons[0].getRadius())


            ctx.fillStyle = '#00ff00';
            ctx.fillRect(
              voteButtons[0].getX() - voteButtons[0].getRadius() + resultSnapshot.meanX - 25,
              voteButtons[0].getY() - voteButtons[0].getRadiusY(),
              50, voteButtons[0].getRadiusY() * 2);
            break;
          case TYPE_SCALE2D:
            // console.log('Rendering result 2d', resultSnapshot)
            ctx.fillStyle = '#0000ff88';
            var posix = Math.floor(resultSnapshot.meanX / voteButtons[0].getRadius())
            var posiy = Math.floor(resultSnapshot.meanY / voteButtons[0].getRadius())

            ctx.fillRect(
              voteButtons[0].getX() - voteButtons[0].getRadius() + posix * voteButtons[0].getRadius(),
              voteButtons[0].getY() - voteButtons[0].getRadius() + posiy * voteButtons[0].getRadius(),
              voteButtons[0].getRadius(),
              voteButtons[0].getRadius()
            );

            ctx.fillStyle = '#00ff00';
            ctx.fillRect(
              voteButtons[0].getX() - voteButtons[0].getRadius() + resultSnapshot.meanX - 25,
              voteButtons[0].getY() - voteButtons[0].getRadius() + resultSnapshot.meanY - 25,
              50, 50);

            break;
        }

        break;
    }
    if (help) {
      renderTextDropShadow({
        ctx,
        text: 'Laser-Voter',
        fontSize: '150px',
        fillStyle: 'cyan',
        x: laserConfig.canvasResolution.width / 2,
        y: 200,
      });
      ctx.fillStyle = '#00000088';
      ctx.fillRect(
        laserConfig.canvasResolution.width * 0.05,
        220,
        laserConfig.canvasResolution.width * 0.9,
        laserConfig.canvasResolution.height * 0.5
      );
      renderTextOutline({
        ctx,
        text: `
This HELP text is displayed,
  because you hovered over the HELP button in the bottom right corner.

This is the realisation of Christian's oldest game ideas, the goal is to lead
a horde of 'cows' through the mountains

The game starts with a spawn area, each player can spawn bunches of small cows,
  these cows flee from the laserpointers, but are cool and chumming weed when left alone,
    the goal is to survive with that crazy horde for as long as humanly possible

Have Fun!

Copyright 2022 C.Kleinhuis and Georg Buchrucker 
Copyright 2022 Frontend Solutions GmbH
Copyright 2022 I - Love - Chaos`,
        fontSize: '26px',
        lineHeight: 25,
        fillStyle: '#0088ff',
        x: laserConfig.canvasResolution.width / 2,
        y: 250,
        dropDistX: 4,
        dropDistY: 4,
      });
    }
  },
};
