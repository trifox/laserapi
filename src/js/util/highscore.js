var laserConfig = require('../LaserApiConfig.js').default;
import util, { 
  getRgbSpreadHex, 
} from '../util.js';

export default function (highscoreGameName, highscoreGameKeyPointsFieldName) {
  const currentHighscore = [];
  const currentLowscore = [];
  let lastEntryDidItHighscore = false;
  let lastEntryDidItLowscore = false;

  const resultInstance = {
    lastEntryNewHighscore: () => lastEntryDidItHighscore,
    lastEntryNewLowscore: () => lastEntryDidItLowscore,
    getHighscore: () => currentHighscore[0],
    getLowScore: () => currentLowscore[0],

    printHighscoreOneLine: () => {
      let result = highscoreGameName + ' High:\n';
      if (resultInstance.lastEntryNewHighscore()) {
        result += 'Jawoll, neuer Highscore\n';
      }
      for (const [key, value] of Object.entries(currentHighscore[0] || {})) {
        result += `${key}: ${value.toFixed(2)}\n`;
      }
      return result;
    },

    printLowscoreOneLine: () => {
      let result = highscoreGameName + ' Low:\n';
      if (resultInstance.lastEntryNewLowscore()) { // Gefixit: result -> resultInstance
        result += 'Jawoll, neuer Lowscore\n';
      }
      for (const [key, value] of Object.entries(currentLowscore[0] || {})) {
        result += `${key}: ${value.toFixed(2)}\n`;
      }
      return result;
    },

    renderHighAndLowScores: (ctx) => {
      // 1. Highscore (Links)
      util.renderTextDropShadow({
        ctx: ctx,
        text:
          ' ' +
          (resultInstance.lastEntryNewHighscore() ? 'Neuer Highscore! Congrats!' : '') + // Gefixit: result -> resultInstance
          '\n' +
          resultInstance.printHighscoreOneLine(), // Gefixit: result -> resultInstance
        fontSize: '25px',
        lineHeight: 70,
        dropDistX: 5,
        dropDistY: 5,
        fillStyle: getRgbSpreadHex(laserConfig.testColor, 0.4),
        x: 250,
        y: laserConfig.canvasResolution.height / 2 + 64,
      });

      // 2. Lowscore (Rechts)
      util.renderTextDropShadow({
        ctx: ctx,
        text:
          ' ' +
          (resultInstance.lastEntryNewLowscore() ? 'Neuer Lowscore! Congrats!' : '') + // Gefixit: result -> resultInstance
          '\n' +
          resultInstance.printLowscoreOneLine(), // Gefixit: result -> resultInstance
        fontSize: '25px',
        lineHeight: 70,
        dropDistX: 5,
        dropDistY: 5,
        fillStyle: getRgbSpreadHex(laserConfig.testColor, 0.6),
        x: laserConfig.canvasResolution.width - 500,
        y: laserConfig.canvasResolution.height / 2 + 64,
      });
    },

    addEntry: (objectNewDataHighscoreCandidate) => {
      console.log('ADD ENTRY HIGHSCORE:', objectNewDataHighscoreCandidate);
      lastEntryDidItHighscore = false;
      lastEntryDidItLowscore = false;

      if (currentHighscore.length == 0) {
        currentHighscore.push(objectNewDataHighscoreCandidate);
        lastEntryDidItHighscore = true;
      } else {
        if (
          currentHighscore[0][highscoreGameKeyPointsFieldName] <
          objectNewDataHighscoreCandidate[highscoreGameKeyPointsFieldName]
        ) {
          lastEntryDidItHighscore = true;
          currentHighscore.unshift(objectNewDataHighscoreCandidate);
        }
      }

      // Lowscore
      if (currentLowscore.length == 0) {
        currentLowscore.push(objectNewDataHighscoreCandidate);
        lastEntryDidItLowscore = true;
      } else {
        if (
          currentLowscore[0][highscoreGameKeyPointsFieldName] >
          objectNewDataHighscoreCandidate[highscoreGameKeyPointsFieldName]
        ) {
          lastEntryDidItLowscore = true;
          currentLowscore.unshift(objectNewDataHighscoreCandidate);
        }
      }

      console.log('NEW HIGHSCORE IS', currentHighscore, 'low', currentLowscore);
    },
  };

  return resultInstance;
}