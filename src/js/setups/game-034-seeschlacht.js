/**
 * Laser-Seeschlacht
 *
 * Strategie-Duell Team Links gegen Team Rechts (ca. 5–10 Minuten), in der Tradition von Laser-Torpedo.
 *
 * - Jedes Team hat am eigenen Rand ein Hauptquartier (HQ) mit Lebenspunkten und einen Hafen
 *   mit 5 horizontalen Fahrrinnen.
 * - Wirtschaft: Energie regeneriert langsam. Pro Rinne gibt es 3 Werft-Buttons (gui/fillButton, counterReset)
 *   für Schnellboot, Zerstörer und Schlachtschiff. Ohne genug Energie sind sie gesperrt (grau, Füllstand 0).
 * - Schiffe fahren ihre Rinne entlang zum gegnerischen Hafen. Jedes Schiff ist ein gui/pixelFillButton:
 *   mehr Laser = schneller versenkt, Panzer = längere Füllzeit. Bewegung/Zeichnen per Handle-Wrapping.
 * - Erreicht ein Schiff den gegnerischen Hafen, bekommt das gegnerische HQ Schaden je Klasse.
 * - Treffen sich gegnerische Schiffe in einer Rinne, wird der Restpanzer verrechnet: das schwächere sinkt,
 *   das stärkere behält dauerhaften Schaden (Untergrenze des Füllstands).
 * - Friendly Fire: der Laser kennt kein Team. Wird ein Schiff in der EIGENEN Hälfte per Laser versenkt,
 *   gilt das als Friendly Fire (dort verteidigt ja das eigene Team) und kostet zusätzlich Energie.
 * - Upgrades (fillButton, lange Füllzeit, teuer): Energie+, Panzer+ (für neu gebaute Schiffe) und
 *   Küstenbatterie (schiesst automatisch auf das vorderste gegnerische Schiff in Reichweite).
 * - Nach DIFFICULTY.suddenDeathTime beginnt Sudden Death: doppelter HQ-Schaden, mehr Energie.
 * - Sieg: gegnerisches HQ auf 0.
 *
 * Test ohne Laser: Q/W/E baut Boot/Zerstörer/Schlachtschiff für Links (zufällige Rinne), I/O/P für Rechts,
 * A/S/D kauft Energie+/Panzer+/Batterie für Links, J/K/L für Rechts, Leertaste startet / Revanche.
 *
 * Alle Stellschrauben stehen gesammelt in DIFFICULTY.
 */

import util, { drawLine, drawNgon, getRgbSpreadHex, removeItemFromArray } from '../util.js';
var laserConfig = require('../LaserApiConfig.js').default;
var MasterCanvas = require('../MasterCanvas').default;
var guiFillButton = require('./gui/fillButton').default;
var guiPixelFillButton = require('./gui/pixelFillButton').default;
import soundBuild from '../../../public/media/72218__benboncan__sonar.wav';
import soundSink from '../../../public/media/485066__javierserrat__object-falls-into-the-water.wav';
import soundShot from '../../../public/media/155235__zangrutz__bomb-small (1).mp3';
import soundHqHit from '../../../public/media/414346__bykgames__explosion-far.wav';
import soundSuddenDeath from '../../../public/media/517267__foolboymedia__cinematic-stomp.wav';
import soundUpgrade from '../../../public/media/369952__mischy__plop-1.wav';
import soundWin from '../../../public/media/goal2.mp3';

const DIFFICULTY = {
  hqHealth: 100,
  // Wirtschaft
  energyStart: 60,
  energyMax: 300,
  energyRegen: 3, // Energie pro Sekunde
  maxShipsPerTeam: 16, // Deckel für Performance und Übersicht
  // Schiffsklassen: hp = Panzer im Gefecht, sinkTime = Sekunden Laser bei voller Bedeckung bis versenkt,
  // buildTime = Sekunden Laser auf der Werft bis das Schiff vom Stapel läuft, speed in px/s
  ships: [
    {
      name: 'Schnellboot',
      short: 'Boot',
      cost: 20,
      speed: 95,
      hp: 2,
      hqDamage: 4,
      radius: 50,
      edges: 3,
      edges2: undefined,
      sinkTime: 0.6,
      buildTime: 1.2,
    },
    {
      name: 'Zerstörer',
      short: 'Zerst.',
      cost: 45,
      speed: 55,
      hp: 5,
      hqDamage: 10,
      radius: 58,
      edges: 4,
      edges2: undefined,
      sinkTime: 1.5,
      buildTime: 2,
    },
    {
      name: 'Schlachtschiff',
      short: 'Schlacht',
      cost: 90,
      speed: 30,
      hp: 12,
      hqDamage: 25,
      radius: 68,
      edges: 6,
      edges2: 3,
      sinkTime: 3.5,
      buildTime: 3,
    },
  ],
  sinkFullPercent: 35, // ab diesem bedeckten Flächenanteil wird mit voller Geschwindigkeit versenkt
  sinkDecay: 25, // Abbau des Laser-Füllstands pro Sekunde (Prozentpunkte) ohne Treffer
  buildDecay: 25, // Abbau des Werft-Füllstands pro Sekunde
  friendlyFirePenalty: 0.5, // zusätzlicher Energieverlust als Anteil der Baukosten
  // Upgrades
  upgradeMaxLevel: 3,
  upgradeBuildTime: 4, // Sekunden Laser bis zum Kauf
  upgradeDecay: 10,
  energyUpgradeCosts: [80, 120, 170],
  energyUpgradeBonus: 0.35, // +35 % Regeneration pro Stufe
  armorUpgradeCosts: [100, 150, 200],
  armorUpgradeBonus: 0.25, // +25 % Panzer und Versenk-Zeit pro Stufe (nur neu gebaute Schiffe)
  batteryUpgradeCosts: [110, 160, 220],
  batteryRangeBase: 250, // px vor dem eigenen Hafen
  batteryRangePerLevel: 120,
  batteryInterval: 3, // Sekunden zwischen Schüssen auf Stufe 1, wird durch die Stufe geteilt
  batteryDamage: 2, // Panzerpunkte pro Treffer
  // Sudden Death
  suddenDeathTime: 480, // Sekunden
  suddenDeathHqFactor: 2,
  suddenDeathRegenFactor: 2,
  // Sonstiges
  gameOverLockTime: 3, // Sekunden, bevor der Revanche-Button reagiert
  hueLeft: 0.33, // Farbverschiebung gegenüber der Laserfarbe
  hueRight: 0.67,
};

// Layout (Canvas 1920x1080)
const CENTER_X = 1920 / 2;
const LANES = [235, 380, 525, 670, 815];
const LANE_TOP = 165;
const LANE_BOTTOM = 885;
const HARBOR_LEFT = 440;
const HARBOR_RIGHT = 1480;
const FIELD_LENGTH = HARBOR_RIGHT - HARBOR_LEFT;
const YARD_OFFSETS = [115, 230, 345]; // Abstand der Werften vom Bildrand je Klasse
const YARD_RADIUS = 50;
const UPGRADE_Y = 960;
const UPGRADE_RADIUS = 58;
const UPGRADE_OFFSETS = [110, 260, 410];
const BAR_X = 330;
const BAR_WIDTH = 420;

const UPGRADES = [
  { key: 'energy', label: 'Energie+', edges: 8, costs: DIFFICULTY.energyUpgradeCosts },
  { key: 'armor', label: 'Panzer+', edges: 5, costs: DIFFICULTY.armorUpgradeCosts },
  { key: 'battery', label: 'Batterie', edges: 32, costs: DIFFICULTY.batteryUpgradeCosts },
];

var lastTime = 0;
var gameState = 'start'; // 'start' | 'game' | 'gameover'
var gameTime = 0;
var gameOverTime = 0;
var suddenDeath = false;
var winner = null; // Team oder null bei Unentschieden
var teams = {};
var ships = [];
var shots = [];
var floatingTexts = [];
var activeSounds = [];
var startButtons = [];
var gameOverButtons = [];
var ready = { left: false, right: false };
var previousKeys = {};
var nextShipId = 0;
var colors = {};

function getDelta() {
  var currentTime = performance.now();
  if (lastTime === 0) {
    lastTime = currentTime;
    return 0;
  }
  const elapsed = (currentTime - lastTime) / 1000;
  lastTime = currentTime;
  // gegen Sprünge nach Tab-Inaktivität / Intro-Screen
  return Math.min(elapsed, 0.1);
}

function playSound(src) {
  const audio = new Audio(src);
  activeSounds.push(audio);
  audio.addEventListener('ended', () => {
    const index = activeSounds.indexOf(audio);
    if (index > -1) activeSounds.splice(index, 1);
  });
  audio.play().catch(() => {});
}

function stopAllSounds() {
  activeSounds.forEach((audio) => audio.pause());
  activeSounds = [];
}

/** true nur im Frame, in dem die Taste gedrückt wird */
function keyPressedOnce(code) {
  const down = !!laserConfig.pressedKeys[code];
  const was = !!previousKeys[code];
  previousKeys[code] = down;
  return down && !was;
}

function addFloatingText(text, x, y, color, size = 40) {
  floatingTexts.push({ text, x, y, time: 0, duration: 1.6, color, size });
}

function formatTime(seconds) {
  const s = Math.max(0, Math.floor(seconds));
  const m = Math.floor(s / 60);
  const rest = s % 60;
  return `${m}:${rest < 10 ? '0' : ''}${rest}`;
}

/** alle Farben aus der Laserfarbe ableiten (nie die Laserfarbe selbst) */
function createColors() {
  const tc = laserConfig.testColor;
  const teamColors = (hue) => ({
    color: getRgbSpreadHex(tc, hue, 0.8, 0.95),
    dark: getRgbSpreadHex(tc, hue, 0.8, 0.55),
    grow: getRgbSpreadHex(tc, hue, 0.5, 0.85),
    active: getRgbSpreadHex(tc, hue, 0.2, 1),
  });
  return {
    left: teamColors(DIFFICULTY.hueLeft),
    right: teamColors(DIFFICULTY.hueRight),
    neutral: getRgbSpreadHex(tc, 0.5, 0.2, 0.45),
    locked: getRgbSpreadHex(tc, 0.5, 0, 0.3),
    text: getRgbSpreadHex(tc, 0.5, 0.3, 0.9),
    title: getRgbSpreadHex(tc, 0.4),
    warning: getRgbSpreadHex(tc, 0.5, 0.9, 1),
  };
}

// ---------------------------------------------------------------------------
// Geometrie
// ---------------------------------------------------------------------------

/** x-Position eines Schiffs aus seinem Fortschritt (px ab eigenem Hafen) */
function xForProgress(team, progress) {
  return team.isLeft ? HARBOR_LEFT + progress : HARBOR_RIGHT - progress;
}

function harborX(team) {
  return team.isLeft ? HARBOR_LEFT : HARBOR_RIGHT;
}

function shipAngle(team) {
  return team.isLeft ? 0 : Math.PI;
}

function otherTeam(team) {
  return team.isLeft ? teams.right : teams.left;
}

function regenFactor(team) {
  return (
    (1 + DIFFICULTY.energyUpgradeBonus * team.levels.energy) *
    (suddenDeath ? DIFFICULTY.suddenDeathRegenFactor : 1)
  );
}

function batteryRange(team) {
  return DIFFICULTY.batteryRangeBase + DIFFICULTY.batteryRangePerLevel * team.levels.battery;
}

// ---------------------------------------------------------------------------
// Schiffe
// ---------------------------------------------------------------------------

function canBuild(team, classIndex) {
  return (
    gameState === 'game' &&
    team.shipCount < DIFFICULTY.maxShipsPerTeam &&
    team.energy >= DIFFICULTY.ships[classIndex].cost
  );
}

function buildShip(team, classIndex, laneIndex) {
  if (!canBuild(team, classIndex)) return;
  const cls = DIFFICULTY.ships[classIndex];
  team.energy -= cls.cost;
  team.stats.built[classIndex]++;
  team.shipCount++;
  ships.push(createShip(team, classIndex, laneIndex));
  playSound(soundBuild);
}

/** blockiert, wenn ein eigenes Schiff in derselben Rinne direkt davor fährt (Konvoi statt Stapel) */
function isBlocked(ship) {
  const r = DIFFICULTY.ships[ship.classIndex].radius;
  for (let i = 0; i < ships.length; i++) {
    const other = ships[i];
    if (other === ship || other.team !== ship.team || other.laneIndex !== ship.laneIndex) continue;
    const ahead =
      other.progress > ship.progress || (other.progress === ship.progress && other.id < ship.id);
    if (!ahead) continue;
    const gap = other.progress - ship.progress;
    if (gap < r + DIFFICULTY.ships[other.classIndex].radius + 10) return true;
  }
  return false;
}

function remainingHp(ship) {
  return ship.maxHp * Math.max(0, 1 - ship.gui.getValue() / 100);
}

/** dauerhafter Schaden (Gefecht, Batterie): erhöht den Füllstand und seine Untergrenze */
function applyDamage(ship, hp, cause) {
  const percent = (hp / ship.maxHp) * 100;
  ship.damage = Math.min(100, ship.damage + percent);
  const value = Math.min(100, Math.max(ship.gui.getValue() + percent, ship.damage));
  ship.gui.setValue(value);
  if (value >= 99) {
    sinkShip(ship, cause);
  }
}

function sinkShip(ship, cause) {
  if (ships.indexOf(ship) < 0) return;
  removeItemFromArray(ships, ship);
  const team = ship.team;
  const cls = DIFFICULTY.ships[ship.classIndex];
  team.shipCount--;
  team.stats.lost[ship.classIndex]++;
  const x = ship.gui.getX();
  const y = ship.gui.getY();
  // Laser-Abschuss in der eigenen Hälfte = dort verteidigt das eigene Team = Friendly Fire
  if (cause === 'laser' && ship.progress < FIELD_LENGTH / 2) {
    const penalty = Math.round(cls.cost * DIFFICULTY.friendlyFirePenalty);
    team.energy = Math.max(0, team.energy - penalty);
    team.stats.friendly++;
    team.stats.friendlyCost += penalty;
    addFloatingText(`Eigenes Schiff! -${penalty} Energie`, x, y - 60, '#ffffff', 40);
  } else {
    addFloatingText(`${cls.name} versenkt!`, x, y - 60, team.color, 35);
  }
  playSound(soundSink);
}

function shipArrives(ship) {
  if (ships.indexOf(ship) < 0) return;
  removeItemFromArray(ships, ship);
  const team = ship.team;
  const enemy = otherTeam(team);
  const cls = DIFFICULTY.ships[ship.classIndex];
  team.shipCount--;
  const damage = cls.hqDamage * (suddenDeath ? DIFFICULTY.suddenDeathHqFactor : 1);
  enemy.hq = Math.max(0, enemy.hq - damage);
  enemy.hqFlash = 0.6;
  team.stats.hqDamage += damage;
  team.stats.breakthroughs[ship.classIndex]++;
  addFloatingText(`HQ -${damage}!`, harborX(enemy), LANES[ship.laneIndex] - 70, team.color, 50);
  playSound(soundHqHit);
}

function createShip(team, classIndex, laneIndex) {
  const cls = DIFFICULTY.ships[classIndex];
  const armorFactor = 1 + DIFFICULTY.armorUpgradeBonus * team.levels.armor;
  const ship = {
    id: nextShipId++,
    team,
    classIndex,
    laneIndex,
    maxHp: cls.hp * armorFactor,
    progress: cls.radius,
    damage: 0, // dauerhafter Schaden in Prozent (Untergrenze des Füllstands)
    gui: null,
  };

  // Treffer über den Flächenanteil: Schlachtschiffe brauchen viele Laser gleichzeitig (Teamwork)
  const gui = guiPixelFillButton({
    label: '',
    posX: xForProgress(team, ship.progress),
    posY: LANES[laneIndex],
    radius: cls.radius,
    edges: cls.edges,
    edges2: cls.edges2,
    angle: shipAngle(team),
    lineWidth: 4,
    fullPercent: DIFFICULTY.sinkFullPercent,
    speedUp: 100 / (cls.sinkTime * armorFactor),
    speedDown: DIFFICULTY.sinkDecay,
    minValue: 0,
    activeValue: 99,
    normalColor: team.color,
    growColor: team.grow,
    activeColor: team.active,
    onEnterActive: () => sinkShip(ship, 'laser'),
  });
  ship.gui = gui;

  const handleOriginal = gui.handle;
  gui.handle = (grid, elapsed) => {
    if (!isBlocked(ship)) {
      ship.progress += cls.speed * elapsed;
    }
    if (ship.progress + cls.radius >= FIELD_LENGTH) {
      shipArrives(ship);
      return;
    }
    const x = xForProgress(team, ship.progress);
    const y = LANES[laneIndex];
    gui.setX(x);
    // Laser-Füllstand baut sich ab, aber nie unter den dauerhaften Gefechtsschaden
    if (gui.getValue() < ship.damage) {
      gui.setValue(ship.damage);
    }

    const ctx = MasterCanvas.get2dContext();
    // Kielwasser
    const back = x - team.dir * cls.radius;
    const wave = Math.sin(gameTime * 8 + ship.id) * 6;
    ctx.save();
    ctx.lineWidth = 3;
    drawLine(ctx, back, y - 12, back - team.dir * 45, y - 22 + wave, team.dark);
    drawLine(ctx, back, y + 12, back - team.dir * 45, y + 22 - wave, team.dark);
    ctx.restore();

    handleOriginal(grid, elapsed);

    // Panzeranzeige über dem Schiff
    const barWidth = cls.radius * 1.6;
    const left = x - barWidth / 2;
    const top = y - cls.radius - 18;
    ctx.save();
    ctx.fillStyle = colors.locked;
    ctx.fillRect(left, top, barWidth, 9);
    ctx.fillStyle = team.color;
    ctx.fillRect(left, top, barWidth * Math.max(0, 1 - gui.getValue() / 100), 9);
    ctx.restore();
  };
  return ship;
}

/** vorderstes Schiff eines Teams in einer Rinne */
function frontShip(team, laneIndex) {
  let front = null;
  for (let i = 0; i < ships.length; i++) {
    const s = ships[i];
    if (s.team === team && s.laneIndex === laneIndex && (!front || s.progress > front.progress)) {
      front = s;
    }
  }
  return front;
}

/** gegnerische Schiffe in derselben Rinne: Restpanzer verrechnen */
function resolveFights() {
  for (let lane = 0; lane < LANES.length; lane++) {
    const a = frontShip(teams.left, lane);
    const b = frontShip(teams.right, lane);
    if (!a || !b) continue;
    const ra = DIFFICULTY.ships[a.classIndex].radius;
    const rb = DIFFICULTY.ships[b.classIndex].radius;
    const xa = xForProgress(a.team, a.progress);
    const xb = xForProgress(b.team, b.progress);
    if (xb - xa >= ra + rb) continue;

    const hpA = remainingHp(a);
    const hpB = remainingHp(b);
    const midX = (xa + xb) / 2;
    const y = LANES[lane];
    shots.push({ x1: xa, y1: y, x2: xb, y2: y, time: 0, duration: 0.3, color: '#ffffff' });
    addFloatingText('Gefecht!', midX, y - 90, colors.warning, 40);
    playSound(soundShot);
    if (Math.abs(hpA - hpB) < 0.05) {
      sinkShip(a, 'kampf');
      sinkShip(b, 'kampf');
    } else if (hpA > hpB) {
      sinkShip(b, 'kampf');
      applyDamage(a, hpB, 'kampf');
    } else {
      sinkShip(a, 'kampf');
      applyDamage(b, hpA, 'kampf');
    }
  }
}

/** Küstenbatterie: schiesst auf das gegnerische Schiff, das dem eigenen Hafen am nächsten ist */
function updateBattery(team, elapsed) {
  const level = team.levels.battery;
  if (level <= 0) return;
  team.batteryTimer = Math.max(0, team.batteryTimer - elapsed);
  if (team.batteryTimer > 0) return;
  const enemy = otherTeam(team);
  const range = batteryRange(team);
  let target = null;
  for (let i = 0; i < ships.length; i++) {
    const s = ships[i];
    if (s.team !== enemy) continue;
    const distance = FIELD_LENGTH - s.progress - DIFFICULTY.ships[s.classIndex].radius;
    if (distance <= range && (!target || s.progress > target.progress)) {
      target = s;
    }
  }
  if (!target) return; // bleibt geladen, bis ein Ziel in Reichweite kommt
  team.batteryTimer = DIFFICULTY.batteryInterval / level;
  shots.push({
    x1: harborX(team) - team.dir * 20,
    y1: LANES[target.laneIndex],
    x2: target.gui.getX(),
    y2: target.gui.getY(),
    time: 0,
    duration: 0.25,
    color: team.active,
  });
  playSound(soundShot);
  applyDamage(target, DIFFICULTY.batteryDamage, 'batterie');
}

// ---------------------------------------------------------------------------
// Werften und Upgrades
// ---------------------------------------------------------------------------

function createYard(team, classIndex, laneIndex) {
  const cls = DIFFICULTY.ships[classIndex];
  const button = guiFillButton({
    label: String(cls.cost),
    posX: team.isLeft ? YARD_OFFSETS[classIndex] : 1920 - YARD_OFFSETS[classIndex],
    posY: LANES[laneIndex],
    radius: YARD_RADIUS,
    edges: cls.edges,
    edges2: cls.edges2,
    angle: shipAngle(team),
    counterReset: true,
    speedUp: 75 / cls.buildTime,
    speedDown: DIFFICULTY.buildDecay,
    normalColor: team.dark,
    growColor: team.grow,
    activeColor: team.active,
    onEnterActive: () => buildShip(team, classIndex, laneIndex),
  });
  const handleOriginal = button.handle;
  button.handle = (grid, elapsed) => {
    // gesperrt: grau und Füllstand festhalten, damit nichts ausgelöst wird
    if (canBuild(team, classIndex)) {
      button.setColor(team.dark);
    } else {
      button.setColor(colors.locked);
      button.setValue(0);
    }
    handleOriginal(grid, elapsed);
  };
  return button;
}

function upgradeCost(team, upgradeIndex) {
  const upgrade = UPGRADES[upgradeIndex];
  const level = team.levels[upgrade.key];
  return level < DIFFICULTY.upgradeMaxLevel ? upgrade.costs[level] : Infinity;
}

function canUpgrade(team, upgradeIndex) {
  return gameState === 'game' && team.energy >= upgradeCost(team, upgradeIndex);
}

function buyUpgrade(team, upgradeIndex) {
  if (!canUpgrade(team, upgradeIndex)) return;
  const upgrade = UPGRADES[upgradeIndex];
  team.energy -= upgradeCost(team, upgradeIndex);
  team.levels[upgrade.key]++;
  if (upgrade.key === 'battery') team.batteryTimer = 0;
  const x = team.isLeft ? UPGRADE_OFFSETS[upgradeIndex] : 1920 - UPGRADE_OFFSETS[upgradeIndex];
  addFloatingText(`${upgrade.label} Stufe ${team.levels[upgrade.key]}`, x + team.dir * 120, UPGRADE_Y - 90, team.color, 40);
  playSound(soundUpgrade);
}

function createUpgradeButton(team, upgradeIndex) {
  const upgrade = UPGRADES[upgradeIndex];
  const x = team.isLeft ? UPGRADE_OFFSETS[upgradeIndex] : 1920 - UPGRADE_OFFSETS[upgradeIndex];
  const button = guiFillButton({
    label: upgrade.label,
    posX: x,
    posY: UPGRADE_Y,
    radius: UPGRADE_RADIUS,
    edges: upgrade.edges,
    counterReset: true,
    speedUp: 75 / DIFFICULTY.upgradeBuildTime,
    speedDown: DIFFICULTY.upgradeDecay,
    normalColor: team.dark,
    growColor: team.grow,
    activeColor: team.active,
    onEnterActive: () => buyUpgrade(team, upgradeIndex),
  });
  const handleOriginal = button.handle;
  button.handle = (grid, elapsed) => {
    const level = team.levels[upgrade.key];
    const cost = upgradeCost(team, upgradeIndex);
    button.setLabel(`${upgrade.label}\n${cost === Infinity ? 'MAX' : cost}`);
    if (canUpgrade(team, upgradeIndex)) {
      button.setColor(team.dark);
    } else {
      button.setColor(colors.locked);
      button.setValue(0);
    }
    handleOriginal(grid, elapsed);
    util.renderTextDropShadow({
      ctx: MasterCanvas.get2dContext(),
      text: `Stufe ${level}/${DIFFICULTY.upgradeMaxLevel}`,
      fontSize: '28px',
      dropDistX: 2,
      dropDistY: 2,
      fillStyle: team.color,
      x,
      y: UPGRADE_Y + UPGRADE_RADIUS + 32,
    });
  };
  return button;
}

// ---------------------------------------------------------------------------
// Teams und Spielzustand
// ---------------------------------------------------------------------------

function createTeam(side) {
  const isLeft = side === 'left';
  const c = colors[side];
  const team = {
    side,
    isLeft,
    dir: isLeft ? 1 : -1,
    name: isLeft ? 'Links' : 'Rechts',
    color: c.color,
    dark: c.dark,
    grow: c.grow,
    active: c.active,
    energy: DIFFICULTY.energyStart,
    hq: DIFFICULTY.hqHealth,
    hqFlash: 0,
    shipCount: 0,
    levels: { energy: 0, armor: 0, battery: 0 },
    batteryTimer: 0,
    buildKeys: isLeft ? ['KeyQ', 'KeyW', 'KeyE'] : ['KeyI', 'KeyO', 'KeyP'],
    upgradeKeys: isLeft ? ['KeyA', 'KeyS', 'KeyD'] : ['KeyJ', 'KeyK', 'KeyL'],
    yards: [],
    upgradeButtons: [],
    stats: {
      built: [0, 0, 0],
      lost: [0, 0, 0],
      breakthroughs: [0, 0, 0],
      friendly: 0,
      friendlyCost: 0,
      hqDamage: 0,
    },
  };
  for (let lane = 0; lane < LANES.length; lane++) {
    for (let classIndex = 0; classIndex < DIFFICULTY.ships.length; classIndex++) {
      team.yards.push(createYard(team, classIndex, lane));
    }
  }
  for (let i = 0; i < UPGRADES.length; i++) {
    team.upgradeButtons.push(createUpgradeButton(team, i));
  }
  return team;
}

function resetGame() {
  colors = createColors();
  gameState = 'game';
  gameTime = 0;
  suddenDeath = false;
  winner = null;
  ships = [];
  shots = [];
  floatingTexts = [];
  nextShipId = 0;
  teams = { left: createTeam('left'), right: createTeam('right') };
  addFloatingText('Leinen los!', CENTER_X, 520, colors.title, 80);
  playSound(soundSuddenDeath);
}

function endGame() {
  const l = teams.left.hq;
  const r = teams.right.hq;
  winner = l <= 0 && r <= 0 ? null : l <= 0 ? teams.right : teams.left;
  gameState = 'gameover';
  gameOverTime = 0;
  gameOverButtons = createGameOverButtons();
  playSound(soundWin);
}

function createStartButtons() {
  colors = createColors();
  ready = { left: false, right: false };
  const make = (side) => {
    const c = colors[side];
    return guiFillButton({
      label: '',
      posX: side === 'left' ? 1920 / 4 : (1920 * 3) / 4,
      posY: 700,
      radius: 170,
      edges: 6,
      angle: side === 'left' ? 0 : Math.PI,
      speedUp: 40,
      speedDown: 10, // wer bereit ist, darf kurz loslassen
      normalColor: c.dark,
      growColor: c.grow,
      activeColor: c.active,
      onEnterActive: () => {
        ready[side] = true;
        if (ready.left && ready.right) resetGame();
      },
      onExitActive: () => {
        ready[side] = false;
      },
    });
  };
  return [make('left'), make('right')];
}

function createGameOverButtons() {
  return [
    guiFillButton({
      label: '',
      posX: CENTER_X,
      posY: 930,
      radius: 120,
      edges: 6,
      speedUp: 30,
      speedDown: 12,
      activeValue: 90,
      normalColor: colors.title,
      growColor: getRgbSpreadHex(laserConfig.testColor, 0.5),
      activeColor: getRgbSpreadHex(laserConfig.testColor, 0.6),
      onEnterActive: () => resetGame(),
    }),
  ];
}

// ---------------------------------------------------------------------------
// Zeichnen
// ---------------------------------------------------------------------------

function renderField(ctx) {
  // Rinnen
  ctx.save();
  ctx.setLineDash([15, 25]);
  ctx.lineWidth = 2;
  LANES.forEach((y) => drawLine(ctx, HARBOR_LEFT, y, HARBOR_RIGHT, y, colors.neutral));
  ctx.setLineDash([20, 20]);
  drawLine(ctx, CENTER_X, LANE_TOP, CENTER_X, LANE_BOTTOM, colors.neutral);
  ctx.restore();

  [teams.left, teams.right].forEach((team) => {
    const hx = harborX(team);
    // Hafenmauer = HQ-Linie, blinkt bei Treffern
    const flash = team.hqFlash > 0 && Math.floor(gameTime * 12) % 2 === 0;
    ctx.save();
    ctx.lineWidth = flash ? 14 : 8;
    drawLine(ctx, hx, LANE_TOP, hx, LANE_BOTTOM, flash ? '#ffffff' : team.color);
    ctx.restore();
    // HQ-Balken am äusseren Rand
    const edgeX = team.isLeft ? 10 : 1920 - 40;
    const height = (LANE_BOTTOM - LANE_TOP) * (team.hq / DIFFICULTY.hqHealth);
    ctx.save();
    ctx.lineWidth = 3;
    ctx.strokeStyle = team.dark;
    ctx.strokeRect(edgeX, LANE_TOP, 30, LANE_BOTTOM - LANE_TOP);
    ctx.fillStyle = flash ? '#ffffff' : team.color;
    ctx.fillRect(edgeX, LANE_BOTTOM - height, 30, height);
    ctx.restore();
    // Reichweite der Küstenbatterie
    if (team.levels.battery > 0) {
      const rx = hx + team.dir * batteryRange(team);
      ctx.save();
      ctx.setLineDash([6, 18]);
      ctx.lineWidth = 3;
      drawLine(ctx, rx, LANE_TOP, rx, LANE_BOTTOM, team.dark);
      ctx.restore();
    }
    // Klassen-Überschriften der Werften
    DIFFICULTY.ships.forEach((cls, i) => {
      util.renderText({
        ctx,
        text: cls.short,
        fontSize: '22px',
        fillStyle: team.color,
        x: team.isLeft ? YARD_OFFSETS[i] : 1920 - YARD_OFFSETS[i],
        y: LANE_TOP + 12,
      });
    });
  });
}

function renderBar(ctx, team, y, fraction, color) {
  const x = team.isLeft ? BAR_X : 1920 - BAR_X - BAR_WIDTH;
  const w = BAR_WIDTH * Math.max(0, Math.min(1, fraction));
  ctx.save();
  ctx.lineWidth = 3;
  ctx.strokeStyle = team.dark;
  ctx.strokeRect(x, y, BAR_WIDTH, 30);
  ctx.fillStyle = color;
  // Balken füllt sich vom äusseren Rand her
  ctx.fillRect(team.isLeft ? x : x + BAR_WIDTH - w, y, w, 30);
  ctx.restore();
}

function renderHud(ctx) {
  [teams.left, teams.right].forEach((team) => {
    const textX = team.isLeft ? 40 : 1880;
    const align = team.isLeft ? 'left' : 'right';
    const flash = team.hqFlash > 0 && Math.floor(gameTime * 12) % 2 === 0;
    util.renderTextDropShadow({
      ctx,
      text: `Energie ${Math.floor(team.energy)}`,
      fontSize: '40px',
      dropDistX: 3,
      dropDistY: 3,
      align,
      fillStyle: team.color,
      x: textX,
      y: 50,
    });
    renderBar(ctx, team, 22, team.energy / DIFFICULTY.energyMax, team.color);
    util.renderTextDropShadow({
      ctx,
      text: `HQ ${Math.ceil(team.hq)}`,
      fontSize: '40px',
      dropDistX: 3,
      dropDistY: 3,
      align,
      fillStyle: flash ? '#ffffff' : team.color,
      x: textX,
      y: 105,
    });
    renderBar(ctx, team, 78, team.hq / DIFFICULTY.hqHealth, flash ? '#ffffff' : team.active);
    util.renderTextDropShadow({
      ctx,
      text: `Energie+ ${team.levels.energy} · Panzer+ ${team.levels.armor} · Batterie ${team.levels.battery} · Flotte ${team.shipCount}/${DIFFICULTY.maxShipsPerTeam}`,
      fontSize: '24px',
      dropDistX: 2,
      dropDistY: 2,
      align,
      fillStyle: team.color,
      x: textX,
      y: 142,
    });
  });

  util.renderTextDropShadow({
    ctx,
    text: formatTime(gameTime),
    fontSize: '50px',
    dropDistX: 4,
    dropDistY: 4,
    fillStyle: colors.text,
    x: CENTER_X,
    y: 60,
  });
  if (suddenDeath) {
    util.renderTextDropShadow({
      ctx,
      text: 'SUDDEN DEATH',
      fontSize: '42px',
      dropDistX: 3,
      dropDistY: 3,
      fillStyle: Math.floor(gameTime * 3) % 2 === 0 ? colors.warning : '#ffffff',
      x: CENTER_X,
      y: 112,
    });
  } else {
    util.renderTextDropShadow({
      ctx,
      text: `Sudden Death in ${formatTime(DIFFICULTY.suddenDeathTime - gameTime)}`,
      fontSize: '30px',
      dropDistX: 2,
      dropDistY: 2,
      fillStyle: colors.neutral,
      x: CENTER_X,
      y: 105,
    });
  }
}

function renderShots(ctx, elapsed) {
  for (let i = shots.length - 1; i >= 0; i--) {
    const s = shots[i];
    s.time += elapsed;
    if (s.time >= s.duration) {
      shots.splice(i, 1);
      continue;
    }
    ctx.save();
    ctx.globalAlpha = 1 - s.time / s.duration;
    ctx.lineWidth = 6;
    drawLine(ctx, s.x1, s.y1, s.x2, s.y2, s.color);
    drawNgon({ ctx, numberOfSides: 8, size: 25, Xcenter: s.x2, Ycenter: s.y2, color: s.color, lineWidth: 4 });
    ctx.restore();
  }
}

function renderFloatingTexts(ctx, elapsed) {
  for (let i = floatingTexts.length - 1; i >= 0; i--) {
    const t = floatingTexts[i];
    t.time += elapsed;
    if (t.time >= t.duration) {
      floatingTexts.splice(i, 1);
      continue;
    }
    util.renderTextDropShadow({
      ctx,
      text: t.text,
      fontSize: `${t.size}px`,
      dropDistX: 3,
      dropDistY: 3,
      fillStyle: t.color,
      x: t.x,
      y: t.y - t.time * 50,
    });
  }
}

function classList(values) {
  return DIFFICULTY.ships.map((cls, i) => `${cls.short} ${values[i]}`).join(' · ');
}

function renderTeamStats(ctx, team, x) {
  const s = team.stats;
  util.renderTextDropShadow({
    ctx,
    text: `Team ${team.name}`,
    fontSize: '50px',
    dropDistX: 4,
    dropDistY: 4,
    fillStyle: team.color,
    x,
    y: 420,
  });
  util.renderTextDropShadow({
    ctx,
    text: `Gebaut: ${classList(s.built)}
Verloren: ${classList(s.lost)}
davon Friendly Fire: ${s.friendly} (-${s.friendlyCost} Energie)
Durchbrüche: ${classList(s.breakthroughs)}
Schaden am gegnerischen HQ: ${s.hqDamage}
Upgrades: Energie+ ${team.levels.energy} · Panzer+ ${team.levels.armor} · Batterie ${team.levels.battery}`,
    fontSize: '32px',
    lineHeight: 50,
    dropDistX: 3,
    dropDistY: 3,
    fillStyle: colors.text,
    x,
    y: 480,
  });
}

// ---------------------------------------------------------------------------
// Spiel
// ---------------------------------------------------------------------------

export default {
  name: 'Torpedo-2Ai ',
  description: ` 
Zerstöre gegnerische Basis
indirekt durch schiffe

Energie lädt sich langsam auf 
(${DIFFICULTY.energyRegen} pro Sekunde, maximal ${DIFFICULTY.energyMax}).

Werften produzieren Schiffe
je nach Energie 

Graue Werften: 
zu wenig Energie oder Flotte voll (${DIFFICULTY.maxShipsPerTeam} Schiffe).

Upgrades durch lange draufhalten `,
  image: 'media/img/gametitles/laser-torpedo-###4###.png',

  init: function () {
    console.log('init game seeschlacht');
    gameState = 'start';
    lastTime = 0;
    ships = [];
    shots = [];
    floatingTexts = [];
    previousKeys = {};
    winner = null;
    startButtons = createStartButtons();
  },

  stop: function () {
    stopAllSounds();
  },

  handle: function (grid) {
    const elapsed = getDelta();
    switch (gameState) {
      case 'start':
        this.handleStartScreen(grid, elapsed);
        break;
      case 'game':
        this.handleGameScreen(grid, elapsed);
        break;
      case 'gameover':
        this.handleGameOverScreen(grid, elapsed);
        break;
    }
  },

  handleStartScreen(grid, elapsed) {
    const ctx = MasterCanvas.get2dContext();
    util.renderTextDropShadow({
      ctx,
      text: 'Laser-Seeschlacht',
      fontSize: '150px',
      fillStyle: colors.title,
      x: CENTER_X,
      y: 200,
    });
    util.renderTextDropShadow({
      ctx,
      text: 'Linke Hälfte gegen rechte Hälfte!\nBeide Teams halten ihren Button gleichzeitig voll, dann geht es los.',
      fontSize: '45px',
      lineHeight: 65,
      dropDistX: 4,
      dropDistY: 4,
      fillStyle: colors.text,
      x: CENTER_X,
      y: 320,
    });

    startButtons.slice().forEach((button) => button.handle(grid, elapsed));
    if (gameState !== 'start') return;

    ['left', 'right'].forEach((side, i) => {
      const x = side === 'left' ? 1920 / 4 : (1920 * 3) / 4;
      util.renderTextDropShadow({
        ctx,
        text: side === 'left' ? 'Team Links' : 'Team Rechts',
        fontSize: '60px',
        dropDistX: 4,
        dropDistY: 4,
        fillStyle: colors[side].color,
        x,
        y: 500,
      });
      util.renderTextDropShadow({
        ctx,
        text: ready[side] ? 'BEREIT!' : 'Laser drauf!',
        fontSize: '50px',
        dropDistX: 4,
        dropDistY: 4,
        fillStyle: ready[side] ? colors[side].active : colors[side].dark,
        x,
        y: 715,
      });
    });
    util.renderTextDropShadow({
      ctx,
      text: 'Ohne Laser: Leertaste startet',
      fontSize: '30px',
      dropDistX: 2,
      dropDistY: 2,
      fillStyle: colors.neutral,
      x: CENTER_X,
      y: 1040,
    });
    if (keyPressedOnce('Space')) {
      resetGame();
    }
  },

  handleGameOverScreen(grid, elapsed) {
    gameOverTime += elapsed;
    const ctx = MasterCanvas.get2dContext();
    util.renderTextDropShadow({
      ctx,
      text: winner ? `Team ${winner.name} gewinnt!` : 'Unentschieden!',
      fontSize: '130px',
      fillStyle: winner ? winner.color : colors.title,
      x: CENTER_X,
      y: 180,
    });
    util.renderTextDropShadow({
      ctx,
      text: `Spieldauer ${formatTime(gameTime)}  ·  HQ Links ${Math.ceil(teams.left.hq)} - HQ Rechts ${Math.ceil(
        teams.right.hq
      )}`,
      fontSize: '45px',
      dropDistX: 4,
      dropDistY: 4,
      fillStyle: colors.text,
      x: CENTER_X,
      y: 300,
    });
    renderTeamStats(ctx, teams.left, 1920 / 4);
    renderTeamStats(ctx, teams.right, (1920 * 3) / 4);

    if (gameOverTime < DIFFICULTY.gameOverLockTime) {
      keyPressedOnce('Space'); // Tastenzustand mitführen
      return;
    }
    gameOverButtons.slice().forEach((button) => button.handle(grid, elapsed));
    if (gameState !== 'gameover') return;
    util.renderTextDropShadow({
      ctx,
      text: 'Revanche',
      fontSize: '45px',
      dropDistX: 3,
      dropDistY: 3,
      fillStyle: colors.text,
      x: CENTER_X,
      y: 945,
    });
    if (keyPressedOnce('Space')) {
      resetGame();
    }
  },

  handleGameScreen(grid, elapsed) {
    gameTime += elapsed;
    const ctx = MasterCanvas.get2dContext();
    const left = teams.left;
    const right = teams.right;

    if (!suddenDeath && gameTime >= DIFFICULTY.suddenDeathTime) {
      suddenDeath = true;
      addFloatingText('SUDDEN DEATH! Doppelter HQ-Schaden!', CENTER_X, 520, colors.warning, 70);
      playSound(soundSuddenDeath);
    }

    [left, right].forEach((team) => {
      team.energy = Math.min(DIFFICULTY.energyMax, team.energy + DIFFICULTY.energyRegen * regenFactor(team) * elapsed);
      team.hqFlash = Math.max(0, team.hqFlash - elapsed);
      // Tastatur-Test ohne Laser
      team.buildKeys.forEach((code, classIndex) => {
        if (keyPressedOnce(code)) {
          buildShip(team, classIndex, Math.floor(Math.random() * LANES.length));
        }
      });
      team.upgradeKeys.forEach((code, upgradeIndex) => {
        if (keyPressedOnce(code)) {
          buyUpgrade(team, upgradeIndex);
        }
      });
    });

    renderField(ctx);

    // Werften und Upgrades (Eingabe + Zeichnen)
    [left, right].forEach((team) => {
      team.yards.forEach((yard) => yard.handle(grid, elapsed));
      team.upgradeButtons.forEach((button) => button.handle(grid, elapsed));
    });

    // Gefechte und Küstenbatterien vor der Bewegung
    resolveFights();
    updateBattery(left, elapsed);
    updateBattery(right, elapsed);

    // Schiffe: Bewegung, Laser-Treffer, Zeichnen (Kopie, da sich das Array verändert)
    ships.slice().forEach((ship) => ship.gui.handle(grid, elapsed));

    renderShots(ctx, elapsed);
    renderFloatingTexts(ctx, elapsed);
    renderHud(ctx);

    if (left.hq <= 0 || right.hq <= 0) {
      endGame();
    }
  },
};
