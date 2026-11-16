/**
 * rangeSlider-ai2 – überarbeitete Fassung von ./rangeSlider.js
 *
 * Original: src/js/setups/gui/rangeSlider.js (bleibt unverändert erhalten).
 * Drop-in-Ersatz: gleiche Optionen und Methoden.
 *   require('./gui/rangeSlider').default  →  require('./gui/rangeSlider-ai2').default
 *
 * Funktion: Balken mit "-" links und "+" rechts (flipButtons). Solange ein Laser auf einem Knopf ist, läuft
 * der Wert mit step pro Sekunde in diese Richtung (geclampt auf min/max). exponential = true bildet den
 * linearen Reglerweg exponentiell auf minValue…maxValue ab (für Zoom o. Ä.).
 *
 * Behobene Fehler gegenüber dem Original:
 * - handle() benutzte this.getValue(). Mit dem in AGENTS.md empfohlenen Handle-Wrapping
 *   (const h = slider.handle; slider.handle = (g, e) => h(g, e)) war this undefined → Absturz.
 * - Nutzt flipButton-ai2: kein Randüberlauf mehr, kein Flackern bei einzelnen verrauschten Frames, kein
 *   falsches onExit im ersten Frame.
 * - Zeichnen in ctx.save()/restore(); Rahmenfarbe als Option (frameColor, Standard wie bisher '#8888ff').
 *
 * Zusätzlich: setValue(v) (linearer Reglerwert), getRawValue(), getStep(), getX/getY/getLabel/setLabel.
 */
import { explerp } from './../../math';
var MasterCanvas = require('../../MasterCanvas').default;
var util = require('../../util.js').default;
var guiFlipButton = require('./flipButton-ai2').default;

export default ({
  label = 'Range Slider',
  posX,
  posY,
  width = 200,
  height = 50,
  growColor = '#00ffff',
  normalColor = '#0088ff',
  frameColor = '#8888ff',
  startValue = 0.4,
  minValue = 0.00001,
  maxValue = 1,
  step = 0.02,
  exponential = false,
  upLabel = '-',
  downLabel = '+',
}) => {
  var currentStep = step;
  var currentValue = startValue;
  var currentLabel = label;
  const radius = height / 2;
  const lo = Math.min(minValue, maxValue);
  const hi = Math.max(minValue, maxValue);
  var buttonPlusActive = false;
  var buttonMinusActive = false;
  var buttons = [
    guiFlipButton({
      label: downLabel,
      posX: posX + width - radius,
      posY: posY + radius,
      radius: radius,
      normalColor,
      activeColor: growColor,
      onEnter: () => (buttonPlusActive = true),
      onExit: () => (buttonPlusActive = false),
    }),
    guiFlipButton({
      label: upLabel,
      posY: posY + radius,
      posX: posX + radius,
      radius: radius,
      normalColor,
      activeColor: growColor,
      onEnter: () => (buttonMinusActive = true),
      onExit: () => (buttonMinusActive = false),
    }),
  ];

  function linearFraction() {
    const range = Math.abs(maxValue - minValue);
    return range > 0 ? Math.abs(currentValue - minValue) / range : 0;
  }

  function getValue() {
    return exponential ? explerp(minValue, maxValue, linearFraction()) : currentValue;
  }

  return {
    getValue: getValue,
    /** linearer Reglerwert (ohne exponentielle Abbildung) */
    getRawValue() {
      return currentValue;
    },
    setValue(v) {
      currentValue = Math.max(lo, Math.min(hi, v));
    },
    name: 'GUI rangeSlider',
    init: function () {},
    data: {
      fillState: 0,
    },
    reset: () => {
      currentValue = startValue;
      currentStep = step;
    },
    setStep(newStep) {
      currentStep = newStep;
    },
    getStep() {
      return currentStep;
    },
    getX() {
      return posX;
    },
    getY() {
      return posY;
    },
    getLabel() {
      return currentLabel;
    },
    setLabel(v) {
      currentLabel = v;
    },
    handle: function (grid, elapsed) {
      const ctx = MasterCanvas.get2dContext();
      const dt = Math.min(Math.max(elapsed || 0, 0), 0.1);

      if (buttonMinusActive) {
        currentValue = Math.max(currentValue - currentStep * dt, lo);
      }
      if (buttonPlusActive) {
        currentValue = Math.min(currentValue + currentStep * dt, hi);
      }
      const value = getValue();
      const range = Math.abs(maxValue - minValue) || 1;

      ctx.save();
      ctx.lineWidth = height / 2;
      ctx.strokeStyle = normalColor;
      ctx.beginPath();
      ctx.moveTo(posX, posY + height / 2);
      ctx.lineTo(posX + (Math.abs(value - minValue) / range) * width, posY + height / 2);
      ctx.stroke();

      ctx.lineWidth = height / 8;
      ctx.strokeStyle = growColor;
      ctx.beginPath();
      ctx.moveTo(posX, posY + height / 2);
      ctx.lineTo(posX + linearFraction() * width, posY + height / 2);
      ctx.stroke();

      ctx.strokeStyle = frameColor;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.rect(posX, posY, width, height);
      ctx.stroke();
      ctx.restore();

      buttons.forEach((item) => item.handle(grid, elapsed));

      util.renderTextDropShadow({
        ctx,
        text: value.toFixed(5),
        x: posX + width / 2,
        y: posY + height / 2,
        fontSize: '20px',
        fillStyle: normalColor,
        dropDistX: 2,
        dropDistY: 2,
      });
      util.renderTextDropShadow({
        ctx,
        text: currentLabel,
        x: posX + 5,
        y: posY + 25,
        align: 'left',
        fontSize: '25px',
        fillStyle: normalColor,
        dropDistX: 2,
        dropDistY: 2,
      });
    },
  };
};
