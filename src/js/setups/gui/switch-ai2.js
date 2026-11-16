/**
 * switch-ai2 – überarbeitete Fassung von ./switch.js
 *
 * Original: src/js/setups/gui/switch.js (bleibt unverändert erhalten).
 * Drop-in-Ersatz: gleiche Optionen und Methoden, Default- und Named-Export (guiSwitch) wie im Original.
 *   require('./gui/switch').default  →  require('./gui/switch-ai2').default
 *
 * Funktion: Umschalter auf Basis eines fillButton. Jedes Volllaufen des Buttons kippt den Zustand
 * (label ⇄ label2, Fünfeck ⇄ Dreieck) und ruft onChange(isChecked).
 *
 * Behobene Fehler gegenüber dem Original:
 * - reset() und setStep() schrieben in die nicht deklarierte Variable currentStep → ReferenceError
 *   (ES-Module laufen im Strict Mode).
 * - Nutzt fillButton-ai2: Randüberlauf behoben, und beim Umschalten passt die Füllung zur neuen Eckenzahl
 *   (im Original blieb die Füllung immer ein Fünfeck).
 * - Ungenutzte Imports (Sound, flipButton) entfernt – der Sound wurde nie abgespielt.
 *
 * Hinweis: getValue()/setStep() stammen aus rangeSlider und sind beim Schalter ohne Bedeutung; sie bleiben nur
 * für Kompatibilität erhalten. Für den Zustand getIsChecked() bzw. neu setChecked(v) benutzen.
 * Zusätzlich: setChecked, getX/getY/getRadius/setX/setY/setRadius, getColor/setColor, getLabel.
 */
import { explerp } from './../../math';
var guiFillButton = require('./fillButton-ai2').default;

export const guiSwitch = ({
  label = 'Switch',
  label2 = 'Switch2',
  posX,
  posY,
  onChange,
  startValue = 0.4,
  minValue = 0.00001,
  maxValue = 1,
  radius = 50,
  step = 0.1,
  activeColor,
  normalColor,
  growColor,
  exponential = false,
}) => {
  var down = true;
  var currentValue = startValue;
  var currentStep = step; // nur Kompatibilität, siehe Kopfkommentar
  var updateView = () => {
    if (down) {
      button.setLabel(label);
      button.setEdges(5);
    } else {
      button.setLabel(label2);
      button.setEdges(3);
    }
  };
  var button = guiFillButton({
    label: label,
    posX: posX,
    posY: posY,
    activeColor,
    normalColor,
    growColor,
    radius: radius,
    onEnterActive: () => {
      down = !down;
      updateView();
      if (onChange) {
        onChange(down);
      }
    },
  });
  updateView();
  return {
    getValue: () =>
      exponential
        ? explerp(minValue, maxValue, Math.abs(currentValue - minValue) / Math.abs(maxValue - minValue))
        : currentValue,
    name: 'GUI switch',
    init: function () {},
    data: {
      fillState: 0,
    },
    getIsChecked() {
      return down;
    },
    /** Zustand setzen, ohne onChange auszulösen */
    setChecked(v) {
      down = !!v;
      updateView();
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
    getX: () => button.getX(),
    setX: (v) => button.setX(v),
    getY: () => button.getY(),
    setY: (v) => button.setY(v),
    getRadius: () => button.getRadius(),
    setRadius: (v) => button.setRadius(v),
    getColor: () => button.getColor(),
    setColor: (v) => button.setColor(v),
    getLabel: () => button.getLabel(),
    handle: function (grid, elapsed) {
      button.handle(grid, elapsed);
    },
  };
};

export default guiSwitch;
