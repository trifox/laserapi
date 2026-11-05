/**
 * Paradise Game
 *
 * The game switches between 2 game screens:
 * - one is the start screen where only one guiFillButton() triggers the gemeScreen in the onEnterActive()
 * - the other is the game screen with Utilizes multiple  guiFillButtons() that reposition after onEnterActive(),
 *    one guiFillButton() acts as the forbidden fruit, when that guiFillButton triggers an onEnterActive() the game is over.
 *
 */

import util, { getRgbSpreadHex, removeItemFromArray } from '../util.js';
var doughHeight = 150; // Start-Höhe des Teigs von unten
var doughTargetHeight = 150;
const minDoughHeight = 100; // Voller Bildschirm = Game Over
const maxDoughHeight = 600; // Voller Bildschirm = Game Over
var laserConfig = require('../LaserApiConfig.js').default;
var MasterCanvas = require('../MasterCanvas').default;
var guiFillButton = require('./gui/fillButton').default;
var knobPositions = [];
let activePlops = [];
import soundSpawn from '../../../public/media/369952__mischy__plop-1.wav'; 
var lastResolution = -1;
const bottomBarStartY = 1080 * 0.75;
var help = false;
var lastTime = 0;
var gameState = 'game';
var gameScore = 0;
function getDelta() {
  var currentTime = performance.now();
  if (lastTime === 0) {
    lastTime = currentTime;
    return 0; // Erster Frame hat 0 elapsed, verhindert Sprünge
  }
  const elapsed = (currentTime - lastTime) / 1000;
  lastTime = currentTime;
  // Optional cap gegen Tab-Inaktivität (z.B. max 0.1s pro Frame):
  return Math.min(elapsed, 0.1); 
}
var buttonsGameOverScreen = [];

const createButtonsGameOverScreen = () => [
  guiFillButton({
    label: '',
    posX: 1920 / 2,
    posY: 1080 / 2 + 200,
    speedDown: 12,
    keyCode: 'Space',
    speedUp: 25,
    edges: Math.floor(3 + Math.random() * 8),
    edges2: undefined, //Math.floor(3 + Math.random() * 8),
    angle: Math.random() * 360,
    activeValue: 90,
    radius: 200,
    normalColor: getRgbSpreadHex(laserConfig.testColor, 0.4),
    activeColor: getRgbSpreadHex(laserConfig.testColor, 0.5),
    growColor: getRgbSpreadHex(laserConfig.testColor, 0.6),
  onEnterActive: (sender) => {
      gameState = 'game';
      gameTime = 0;
      breads = [];
      gameScore = 0;
      doughHeight = minDoughHeight;
      doughTargetHeight = minDoughHeight;
      activePlops = [];
      buttons = createButtons();
      lastTime = performance.now(); // Zeitstempel beim Reset aktualisieren!
    },
    onExitActive: (sender) => { },
  }),
];
/**
 * Berechnet die (x, y) Koordinaten einer Kardioide für einen Winkel theta.
 * @param {number} theta - Der Winkel in Radiant (0 bis 2 * Math.PI).
 * @param {number} a - Skalierungsfaktor / Radius der Herzkurve.
 * @returns {{x: number, y: number}} Die berechneten Kooridnatennamen.
 */
function getCardioidPoint(theta, a = 1) {
  const x = a * (2 * Math.cos(theta) - Math.cos(2 * theta));
  const y = a * (2 * Math.sin(theta) - Math.sin(2 * theta));
  return { x, y };
}

function JuliaIter(cr, ci, maxIter =25) {
  let zr = 0, zi = 0, i = 0;
  while (zr * zr + zi * zi <= 4 && i < maxIter) {
    let temp = zr * zr - zi * zi +cr ;
    zi = 2 * zr * zi  +ci;
    zr = temp;
    i++;
  }
  return i;
} 

function renderJulia(ctx, width, height,seedr=0,seedi=0, color,maxIter = 25) {
  const isConnected=JuliaIter(seedr,seedi,maxIter)==maxIter; 
  const imgData = ctx.createImageData(width, height), d = imgData.data;
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      let cr =seedr, ci =seedi, zr = (x - width / 2) * 3.5 / width, zi = (y - height / 2) * 3.5 / height;
      let i = 0;

      while (zr * zr + zi * zi <= 4 && i < maxIter) {
        let temp = zr * zr - zi * zi + cr;
        zi = 2 * zr * zi + ci;
        zr = temp;
        i++;
      }

      let idx = (y * width + x) * 4;
      
      if(isConnected){
      let color = i === maxIter ? 255: (i * 255 / maxIter);
 
      d[idx] = color;     // R
      d[idx + 1] = color; // G
      d[idx + 2] = color; // B
      d[idx + 3] = 255;   // A
      }else{
      let color = i === maxIter ? 0 : (i * 255 / maxIter);
     
      if((i/2)%2==1){
        color=255
      }else{
        color=0
      }
      d[idx] = color;     // R
      d[idx + 1] = color; // G
      d[idx + 2] = color; // B
      d[idx + 3] = 255;   // A

      }
    
    }
  }
 // ctx.putImageData(imgData, 0, 0);
 return imgData;
}


function renderMandelbrot(ctx, width, height,seedr=0,seedi=0, color,maxIter = 25) {
  const imgData = ctx.createImageData(width, height), d = imgData.data;
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      let zr =seedr, zi =seedi, cr = (x - width / 2) * 3.5 / width, ci = (y - height / 2) * 3.5 / height;
      let i = 0;

      while (zr * zr + zi * zi <= 4 && i < maxIter) {
        let temp = zr * zr - zi * zi + cr;
        zi = 2 * zr * zi + ci;
        zr = temp;
        i++;
      }

      let idx = (y * width + x) * 4;
      
    
      let color = i === maxIter ? 255: (i * 255 / maxIter);
 
      d[idx] = color;     // R
      d[idx + 1] = color; // G
      d[idx + 2] = color; // B
      d[idx + 3] = 255;   // A
     
  }
  }
 // ctx.putImageData(imgData, 0, 0);
 return imgData;
}

function createEnemyButton( ) {
 const seedi=Math.random()*2.-1.-0.5;
 const seedr=Math.random()*2.-1.;
  const isApple= JuliaIter(seedr,seedi,25)==25;
 

  var delay = isApple ? 0 : Math.random() * 10;
  delay=0
        var ctx = MasterCanvas.get2dContext();
const radius=  Math.random() * 50 + 25;
const speed=Math.random()*200+100;
    const posX= Math.random() * (1920-750)+375;
    const posY= Math.random() * radius*2-radius*2;
  const enemy = guiFillButton({
    label: '',
    posX ,
    posY ,
    speedDown: 150,
    speedUp: isApple ? 300 : 600,
    radius,
    lineWidth: isApple ? 4 : 2,
    counterReset: true,
    normalColor: isApple
      ? getRgbSpreadHex(laserConfig.testColor, 0.3, 0.9, 0.9)
      : getRgbSpreadHex(
        laserConfig.testColor,
        0.5 + Math.random() * 0.2,
        0.9,
        0.9
      ),
    growColor: isApple
      ? getRgbSpreadHex(laserConfig.testColor, 0.3, 0.75, 0.75)
      : getRgbSpreadHex(laserConfig.testColor, 0.6, 0.75, 0.75),
    activeColor: isApple
      ? getRgbSpreadHex(laserConfig.testColor, 0.3, 0.5, 0.5)
      : getRgbSpreadHex(laserConfig.testColor, 0.65, 0.5, 0.5),
    edges: 3 + Math.round(Math.random() * 12),
    edges2: undefined, //3 + Math.round(Math.random() * 12),
    onEnterActive: () => { 
//      if (isApple) {
//        gameState = 'gameover';
//        buttonsGameOverScreen = createButtonsGameOverScreen();
//      }
//      gameScore++;
      removeItemFromArray(buttons, enemy);
      buttons.push(createEnemyButton());

      var audio = new Audio(soundSpawn);
      audio.play();
      delay = Math.random() * 10;
    },
  });



  const image=renderJulia(ctx,Math.floor(radius*2),Math.floor(radius*2),seedr,seedi,enemy.getColor(),250);
  //****************************************************************************************************/
  //****************************************************************************************************/
  //****************************************************************************************************/
  //****************************************************************************************************/
  //*****************************************handler***********************************************************/
  //****************************************************************************************************/
  //****************************************************************************************************/
  //****************************************************************************************************/
  //****************************************************************************************************/

  var origHandle = enemy.handle;
  enemy.handle = (grid, elapsed) => {
  
    delay -= elapsed;
    if (delay > 0) {
      return;
   
    }

    enemy.setY(enemy.getY()+speed*elapsed)

if(enemy.getY()>1080-doughHeight){
if(isApple){
  doughTargetHeight -= radius;
  if(doughTargetHeight < minDoughHeight){
    doughTargetHeight = minDoughHeight;
  }
}else{
  doughTargetHeight += radius;
  if(doughTargetHeight > maxDoughHeight){
    doughTargetHeight = maxDoughHeight;
    gameState = 'gameover';
    buttonsGameOverScreen = createButtonsGameOverScreen();
  }
}
      removeItemFromArray(buttons, enemy);
      buttons.push(createEnemyButton());


// Plopp an genau dieser X-Position starten
        activePlops.push({ 
          time: 0, 
          duration: 1.0, 
          maxAmplitude: 50, 
          posX: posX 
        }); 

    }
    ctx.putImageData(image, enemy.getX()-radius, enemy.getY()-radius);
 

    origHandle(grid, elapsed);
  };
  return enemy;
}
var buttons = [];

const createButtons = () => [
  createEnemyButton(),   
];
var lastResolution = -1;
var gameTime = 0;



/** 
 * die breads machen wir als visuelles element, ohne interaktionsmoeglichkeit,
 * idee ist halt sie werden gespawnet, laufen nach rechts und sterben :D
 * 
 */

let breads=[]

const createBread=(seedx,seedy)=>{
  let posiX=250;
  let posiY=975;
  
    var ctx = MasterCanvas.get2dContext();

// der seed ist random normalisiert maximale teighoehe, also max ist 1 quasi
const seedR = Math.random() * (doughHeight - minDoughHeight) / (maxDoughHeight - minDoughHeight);
const seedI = Math.random() * (doughHeight - minDoughHeight) / (maxDoughHeight - minDoughHeight);

const image = renderMandelbrot(ctx, 64, 64, seedR, seedI, 0xff00ff, 250);
const bread = (elapsed) => {
  ctx.putImageData(image, Math.trunc(posiX), Math.trunc(posiY));
  posiX += 100 * elapsed;
  if (posiX > 1920) {
    removeItemFromArray(breads, bread);
    const inner = seedR * seedR + seedI * seedI;
    gameScore += 1 - Math.sqrt(Math.max(0, inner));
  }
}

  breads.push(bread)
}

var breadSpawnTimer = 0;
const breadSpawnInterval = 1.5; // Zeit in Sekunden (z.B. alle 1.5 Sekunden ein Brot)

export default {
  name: 'Fractal-Bakery',
  description: `
  
Willkommen in der Fraktal Bäckerei!


Ziel ist die Teigmasse solange wie möglich stabil zu halten,
nur die guten Julia Rosinen dürfen in den Teig, wenn schlechte julias kommen
so verklumpen sie den teig und die teigmaschine verstopf.
  `,

  image: 'media/img/gametitles/laser-paradise-###4###.png',
  init: function (data) {
    console.log('init game fractal bakery ', knobPositions);
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
      text: 'Fractal-Bakery',
      fontSize: '150px',
      fillStyle: getRgbSpreadHex(laserConfig.testColor, 0.4),
      x: laserConfig.canvasResolution.width / 2,
      y: 200,
    });
    util.renderTextDropShadow({
      ctx,
      text: `
      You baked for solid ${gameTime.toFixed(2)}s and
      managed to serve ${Math.floor(gameScore)} 'Mandelbrötchen' 
      (In average! Nice one, people!)
      `,
      fontSize: '50px',
      fillStyle: getRgbSpreadHex(laserConfig.testColor, 0.5),
      x: laserConfig.canvasResolution.width / 2,
      y: 200,
    });
  },
  handleGameScreen(grid, elapsed) {
    gameTime += elapsed;
    const ctx = MasterCanvas.get2dContext();

// --- Automatischer Brot-Spawner ---
    breadSpawnTimer += elapsed;
    if (breadSpawnTimer >= breadSpawnInterval) {
      breadSpawnTimer = 0;
      createBread();
    }
// --- Plopps aktualisieren (abgelaufene entfernen) ---
    for (let i = activePlops.length - 1; i >= 0; i--) {
      activePlops[i].time += elapsed;
      if (activePlops[i].time >= activePlops[i].duration) {
        activePlops.splice(i, 1);
      }
    }

    // Weiche Interpolation (Lerp) von doughHeight hin zu doughTargetHeight
  const lerpSpeed = 6.0; // Höher = schneller, niedriger = träger/flüssiger
  doughHeight += (doughTargetHeight - doughHeight) * lerpSpeed * elapsed;

// --- Wabernde Teig-Sinuskurve mit organischen, kreisförmig expandierenden Wellen ---
    ctx.save();
    ctx.fillStyle = getRgbSpreadHex(laserConfig.testColor, 0.3);
    ctx.beginPath();
    ctx.moveTo(0, 1080);
    
    const waveFrequency = 0.005;
    const waveAmplitude = 25;
    const currentBaseY = 1080 - doughHeight;

    for (let x = 0; x <= 1920; x += 10) {
      // Basis-Teigwelle
      let y = currentBaseY + Math.sin(x * waveFrequency + gameTime * 3) * waveAmplitude;

      // Asymmetrische, ausbreitende Wellen-Plopps ohne Mittelknick
      activePlops.forEach(plop => {
        let progress = plop.time / plop.duration; // 0 bis 1
        
        // Gedämpfte Sinus-Hüllkurve (sanftes Ein- und Ausfaden)
        let timeFade = Math.sin(progress * Math.PI);

        let deltaX = x - plop.posX;
        let distFromCenter = Math.abs(deltaX);

        // Wie weit sich die Welle nach außen ausgebreitet hat (wächst mit der Zeit)
        let wavefront = plop.time * 250; 
        
        // Abstand zur wandernden Wellenfront
        let ringDist = distFromCenter - wavefront;
        let ringWidth = 80; // Breite des Wellenbergs

        // Gaussian-Kurve erzeugt einen wunderschönen, glatten Hügel ohne Kanten
        let bell = Math.exp(-(ringDist * ringDist) / (ringWidth * ringWidth));
        
        // Leichte Oszillation im Ring für den Wasser-/Teig-Effekt
        let ripple = bell * Math.cos(ringDist * 0.08);

        // Nach außen hin weich abklingen lassen
        let spatialFade = Math.max(0, 1 - distFromCenter / 450);

        y -= ripple * plop.maxAmplitude * timeFade * spatialFade;
      });

      ctx.lineTo(x, y);
    }

    ctx.lineTo(1920, 1080);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
    // --------------------------------------------------------
/// ofen und foerderband
// --- 1. PERSPEKTIVISCHER HINTERGRUND (Räumlicher Eindruck) ---
    ctx.save();
    ctx.fillStyle = '#1a1008'; // Dunkler Ofen-Hintergrund
   // ctx.fillRect(0, 0, 1920, 1080);

    // Eingeengte Seitenwände für den 3D-Tunnelblick
    ctx.fillStyle = '#2b1a0e';
    ctx.beginPath();
    ctx.moveTo(0, 0); ctx.lineTo(250, 1080); ctx.lineTo(0, 1080); ctx.fill();
    ctx.beginPath();
    ctx.moveTo(1920, 0); ctx.lineTo(1670, 1080); ctx.lineTo(1920, 1080); ctx.fill();
    ctx.restore();

    // --- 2. OFEN LINKS & FÖRDERBAND ---
    ctx.save();
    // Ofen-Tor links
    ctx.fillStyle = '#4a2c11';
    ctx.fillRect(0, 700, 300, 380);
    ctx.fillStyle = '#ff5500'; // Glühendes Ofenfeuer
    ctx.shadowColor = '#ff5500';
    ctx.shadowBlur = 30;
    ctx.fillRect(50, 750, 200, 280);
    ctx.restore();

    // Förderband-Linie unten
    ctx.save();
    ctx.strokeStyle = '#555';
    ctx.lineWidth = 15;
    ctx.beginPath();
    ctx.moveTo(250, 1050);
    ctx.lineTo(1920, 1050);
    ctx.stroke();
    ctx.restore();
/////////////////


    buttons.forEach((item) => {
      item.handle(grid, elapsed);
    });


    breads.forEach(bread=>bread(elapsed));

    util.renderTextDropShadow({
      ctx,
      text: `${gameTime.toFixed(2)}s - ${gameScore.toFixed(2)} Score `,
      fontSize: '50px',
      fillStyle: getRgbSpreadHex(laserConfig.testColor, 0.3),
      align: 'left',
      x: 200,
      y: 100,
    });
  },
};
