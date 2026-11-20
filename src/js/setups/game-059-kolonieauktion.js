/**
 * Kolonie-Auktion – vier Fraktal-Kolonien, ein Planet, ein Markt
 *
 * Auf einem Julia-Mengen-Planeten landen vier Kolonien. Jede Runde wird Land verteilt, ausgebaut, geerntet
 * und gehandelt. Gewinner ist die Kolonie mit dem höchsten Wert – aber der gemeinsame KOLONIE-WERT
 * (Highscore) wächst nur, wenn niemand hungert. Also: hart verhandeln, aber nicht verhungern lassen.
 *
 * FRAKTIONEN = SAAL-VIERTEL (Entscheidung): vier Kolonien, je eine Bildschirmecke = ein Saalviertel
 *   1 JULIA (oben links) · 2 KOCH (oben rechts) · 3 SIERPINSKI (unten links) · 4 FARN (unten rechts).
 *   Begründung: Vier Parteien wie im Vorbild, und Laser sind nicht unterscheidbar – also entscheidet der ORT.
 *   Jede Kolonie hat ein eigenes Pult in ihrer Ecke (oben Anzeige, unten schwarzes Aktions-Pad). Die Pads
 *   liegen so weit auseinander wie möglich (kein versehentliches Fremdleuchten), die Mitte (Planet) ist reine
 *   Anzeige und darf bunt sein. Bei kleinen Gruppen (< 12 Leute) einfach zwei Ecken pro Saalhälfte bespielen.
 *   Auf dem Titelbildschirm zeigt gui/zoneSplit (2×2) live, wie viele Laser in welcher Ecke sind – Teams finden sich.
 *
 * ABLAUF einer Runde (6 Runden, alles Echtzeit, große Phasenanzeige + Countdown oben):
 *   0) RUNDE X      (3 s)  Neuigkeiten der Runde (neue Ereignisse, mehr Preisschwankung).
 *   1) LANDNAHME    (3 Felder, je max. 5,5 s) Ein Feld blinkt auf dem Planeten. Alle Kolonien füllen ihr
 *                   LAND-Pad (gui/voteGroup, eine Option pro Kolonie) – wer zuerst voll ist, bekommt das Feld.
 *                   Zeit um: das vollste Pad gewinnt, alle leer = Feld bleibt frei. Wer 2 Felder mehr hat als
 *                   die kleinste Kolonie, ist "satt" und setzt aus (Pad ausgegraut).
 *   2) AUSBAU       (12 s) Jede Kolonie stimmt im eigenen Pad ab, was ALLE ihre Felder produzieren:
 *                   ALGEN / ENERGIE / KRISTALL (gui/voteGroup, 3 Felder). Passendes Gelände = 4, sonst 1 pro Feld.
 *                   Keine Wahl = es bleibt bei der letzten. Sind alle fertig, geht es früher weiter.
 *   3) PRODUKTION   (9 s, keine Eingabe – alle Pads aus) Ernte fliegt in die Lager. Jedes Nicht-Energie-Feld
 *                   braucht 1 Energie, sonst halbe Ernte (Stromausfall). Zufallsereignisse, steigend pro Runde:
 *                   Sonnensturm, Kristallsegen, Algenblüte (hilft der Ärmsten), ab R2 Meteor + Schleimpilz,
 *                   ab R3 Weltraum-Piraten (besuchen die Reichste) + Kristall-Boom, ab R4 Planetenbeben.
 *   4) AUKTION      (20 s, Kern) Gehandelt wird der knappste Rohstoff; in Runde 3 und 6 ist Mutterschiff-Tag
 *                   (Kristall-Börse), ebenso wenn nichts knapp ist.
 *                   Wer mehr hat als braucht = VERKÄUFER, wer zu wenig hat = KÄUFER, sonst Zuschauer.
 *                   Das Aktions-Pad ist ein Preisbalken (gui/steerStrip, links billig, rechts teuer): Der
 *                   Laser-Schwerpunkt ist euer Preis. Ohne Laser rutscht der Preis zurück ans gierige Ende
 *                   (Verkäufer teuer, Käufer billig) – Preis HALTEN heißt Laser draufhalten.
 *                   Höchstes Gebot ≥ niedrigste Forderung → Handel (Mitte der Preise), Stück für Stück.
 *                   Depot: kauft billig an, verkauft teuer (solange Vorrat). Kristall: das Mutterschiff zahlt einen
 *                   schwankenden Kurs – Forderung unter den Kurs schieben = verkauft. Timing!
 *                   STÖRUNG IST HIER ERLAUBT: Fremde Laser im eigenen Balken verschieben den Schwerpunkt –
 *                   kostet aber die Laser, die dann im eigenen Balken fehlen.
 *   5) BILANZ       (7 s) Jede Kolonie isst Algen (3, ab Runde 3: 4, ab Runde 5: 5). Fehlt etwas: Notkauf im Depot
 *                   (teuer), danach HUNGER (kostet Taler und den gemeinsamen Kolonie-Wert). Alle satt = Bonus.
 *   Ende nach Runde 6: Sieger = höchster Kolonie-Wert (Taler + Felder×60 + Lager × Grundpreis).
 *   Highscore (Pflicht, wie zu C64-Zeiten – nur ohne Kassettenrecorder): gemeinsamer Kolonie-Wert.
 *
 * VORSCHLAG FÜR DIE PLATTFORM – rundenbasierte Spiele ("Interferenz embracen oder einschränken?"):
 *   Antwort hier: BEIDES, aber pro Phase entschieden und sichtbar gemacht.
 *   a) Echtzeit-Phasen mit fester Höchstdauer und Countdown. Nie auf Eingaben warten: Zeitablauf entscheidet
 *      (voteGroup.timeLimit → Führender, sonst sinnvoller Standard). Früher fertig = früher weiter.
 *   b) Simultane Züge statt reihum: alle Fraktionen spielen JEDE Phase gleichzeitig, jede an ihrem eigenen Pad.
 *      Wer mit sich selbst beschäftigt ist, stört nicht ("immer mit den eigenen Sachen beschäftigt").
 *   c) Pro Phase sind nur die Zonen aktiv, die gebraucht werden. Inaktive Pads werden NICHT ge-handle-t
 *      (messen nichts) und gestrichelt/grau gezeichnet. Phasen ohne Eingabe (Produktion, Bilanz) sind Atempausen.
 *   d) Interferenz-Matrix je Phase festlegen und im Spiel kommunizieren:
 *        Landnahme: fremde Laser auf meinem Pad HELFEN mir → Stören sinnlos.
 *        Ausbau:    fremde Laser könnten meine Wahl kippen → schwach: alle wählen gleichzeitig, erste volle
 *                   Wahl wird gesperrt (lockAfterDecide).
 *        Auktion:   Stören ausdrücklich erlaubt, kostet aber eigene Laser (Schwerpunkt-Messung).
 *   e) Kandidat für gui/: eine kleine "phaseClock"-Komponente (Phasenliste, Dauer, Countdown, onPhase,
 *      aktive Zonen je Phase) – dieses Spiel macht das noch selbst.
 *
 * ONE-PIXEL-NETZWERK: Jede Eingabe ist ein Flächen-/Schwerpunkt-Pad. Ein Netzspieler mit genau einem Pixel
 *   zählt wie ein Laserpunkt; der Server müsste nur die Fraktion (Ecke) zuweisen oder den Pixel auf
 *   die Pads der eigenen Fraktion beschränken – dann wäre sogar "Störung nur in der Auktion" serverseitig
 *   durchsetzbar. Mit Millionen Pixeln wird die Auktion zum echten Markt (Schwerpunkt = Durchschnittsgebot).
 *
 * TASTATUR (Test ohne Laser):
 *   Leertaste: Start / Nochmal · N: nächste Phase sofort
 *   1–4: Testkolonie wählen; in der Landnahme füllt die Taste zusätzlich das Land-Pad dieser Kolonie
 *   A / E / K: im Ausbau Algen / Energie / Kristall für die Testkolonie wählen
 *   Pfeil links / rechts: in der Auktion Preis der Testkolonie runter / rauf
 *   (d v g r m h t f F s, PageUp/PageDown/Home sind Debug-Tasten von view.js und bleiben frei)
 *
 * KLASSIKER: M.U.L.E. (Ozark Softscape, C64/Atari 800, 1983) – Landvergabe, Ausbau, Produktion mit
 *   Zufallsereignissen und die berühmte Echtzeit-Auktion mit Käufer-/Verkäufer-Linien. Kein Nachbau: keine Roboter,
 *   eigene Rohstoffe (Algen/Energie/Kristall), Fraktal-Planet, simultane Landnahme per Füll-Wettrennen,
 *   Preise per Laser-Schwerpunkt, gemeinsamer Kolonie-Score statt nur Einzelsieger.
 * ÄHNLICHKEITEN IM BESTAND: game-018-voter / game-048-umfrage (Abstimmen über Flächen – hier nur ein Werkzeug
 *   innerhalb der Phasen), game-047-wuerfelreiche (Sechseck-Karte, aber reihum + KI; hier simultan, ohne Kampf),
 *   game-012-reversi (rundenbasiert auf Feldern, aber ohne Fraktionsflächen/Echtzeit-Phasen),
 *   game-026-tauziehen/game-033-kicker (Teams nach Saalbereich).
 *
 * Licht-Disziplin: Alle Aktions-Pads sind schwarz, nur konturiert; der Planet (vorgerenderte, gedimmte
 * Julia-Menge) und die Anzeigen sind bunt, aber nie in der Laserfarbe (Hue 0.25..0.75).
 */

import util, { getRgbSpreadHex, getRgbSpread, renderTextDropShadow } from '../util.js';
import { createKeyEdge, isKeyDown, approach, clamp } from './gui/gridScan.js';
import soundClaim from '../../../public/media/opengameart/Accept.mp3';
import soundTrade from '../../../public/media/369952__mischy__plop-1.wav';
import soundMeteor from '../../../public/media/414346__bykgames__explosion-far.wav';
import soundPhase from '../../../public/media/opengameart/Transition.ogg';
import soundVote from '../../../public/media/opengameart/Menu Confirm.ogg';
import soundHunger from '../../../public/media/opengameart/Menu Error.ogg';
import soundRound from '../../../public/media/opengameart/Level Up.ogg';
import soundCoin from '../../../public/media/opengameart/Item Pickup.ogg';
import soundStorm from '../../../public/media/flash-253597_4508519-lq.mp3';
import soundMusic from '../../../public/media/522110__setuniman__cheeky-1t41b.wav';
import soundJingle from '../../../public/media/521966__kastenfrosch__ready-to-start-jingle.ogg';
import soundGameOver from '../../../public/media/opengameart/Music Box Game Over III.wav';
var laserConfig = require('../LaserApiConfig.js').default;
var MasterCanvas = require('../MasterCanvas').default;
var guiFillButton = require('./gui/fillButton-ai2').default;
var guiVoteGroup = require('./gui/voteGroup').default;
var guiSteerStrip = require('./gui/steerStrip').default;
var guiZoneSplit = require('./gui/zoneSplit').default;
var createHighscore = require('../util/highscore').default;

const W = 1920;
const H = 1080;
const MAP = { cx: 960, cy: 600, r: 462 };
const HEX_R = 80;
const PANEL_W = 400;
const PANEL_H = 468;
const PAD_TOP = 236; // ab hier ist das Pult schwarz (Aktionsbereich)
const STRIP = { dy: 8, w: 372, h: 150 }; // Preisbalken im Pad (links billig, rechts teuer)
const PANELS = [
  { x: 10, y: 112 },
  { x: 1510, y: 112 },
  { x: 10, y: 600 },
  { x: 1510, y: 600 },
];

// ---------------------------------------------------------------------------------------------------------
// Einstellungen
// ---------------------------------------------------------------------------------------------------------

const SETTINGS = {
  rounds: 6,
  kristallRounds: [3, 6], // Mutterschiff-Tage: Auktion = Kristall-Börse
  startTaler: 120,
  startAlgen: 4,
  startEnergie: 3,
  startKristall: 0,
  landValue: 60,
  fieldsPerRound: 3,
  claimTime: 5.5, // s pro Feld (dann gewinnt das vollste Pad)
  claimPause: 1.3, // Ergebnisanzeige nach jedem Feld
  fieldLead: 2, // so viele Felder Vorsprung vor der kleinsten Kolonie = Landnahme aussetzen
  introTime: 3.2,
  ausbauTime: 12,
  produktionTime: 9,
  auktionTime: 20,
  bilanzTime: 7,
  priceFollow: 7, // wie schnell der Preis dem Laser-Schwerpunkt folgt (1/s)
  priceDrift: 0.16, // ohne Laser: Preis rutscht so schnell (Anteil/s) zurück ans gierige Ende
  keyPriceSpeed: 0.55,
  depotBuyFactor: 0.6, // Depot kauft zu Grundpreis × 0.6
  depotSellFactor: 1.5, // Depot verkauft zu Grundpreis × 1.5
  emergencyFactor: 1.7, // Notkauf in der Bilanz
  depotStart: { algen: 8, energie: 8, kristall: 0 },
  depotRestock: { algen: 3, energie: 3, kristall: 0 },
  colonyAllFedBonus: 150,
  colonyHungerPenalty: 80,
  colonyTradeBonus: 6,
  colonyBlackoutPenalty: 10,
  hungerTalerPerUnit: 12,
  barMax: 20,
  maxParticles: 400,
  maxFloaters: 30,
  maxTokens: 160,
  againDelay: 2,
};

const DIFFICULTY = {
  foodStart: 3, // Algen pro Kolonie und Runde
  foodEveryRounds: 2, // alle 2 Runden +1 (Runde 3: 4, Runde 5: 5)
  yieldMatch: 4, // Produktion passend zum Gelände
  yieldOther: 1,
  yieldJitter: 1, // ±
  eventChanceStart: 0.6,
  eventChancePerRound: 0.1,
  eventsMaxStart: 1,
  eventsMaxPerRound: 0.34, // ab Runde 4 bis zu 2 Ereignisse, Runde 7: 3
  volatilityStart: 0.08, // Preisschwankung Grundpreis pro Runde
  volatilityPerRound: 0.05,
  kursAmpStart: 0.22, // Kristall-Kurs-Schwankung am Mutterschiff
  kursAmpPerRound: 0.08,
  kursAmpMax: 0.65,
  kursSpeedStart: 0.9,
  kursSpeedPerRound: 0.15,
  tradeIntervalStart: 0.75,
  tradeIntervalPerRound: -0.06,
  tradeIntervalMin: 0.4,
};

const RESOURCES = ['algen', 'energie', 'kristall'];
const RES_INFO = {
  algen: { label: 'ALGEN', base: 30, min: 8, max: 70 },
  energie: { label: 'ENERGIE', base: 26, min: 8, max: 60 },
  kristall: { label: 'KRISTALL', base: 45, min: 15, max: 120 },
};
const TERRAIN_NAME = { algen: 'ALGEN-SEE', energie: 'SONNEN-EBENE', kristall: 'KRISTALL-GEBIRGE' };
const CHOICE_KEYS = ['KeyA', 'KeyE', 'KeyK']; // Reihenfolge wie RESOURCES

const FACTION_DEFS = [
  { name: 'JULIA', hue: 0.3, motto: 'Wir hängen zusammen!' },
  { name: 'KOCH', hue: 0.7, motto: 'Unendlich Küste, null Strand.' },
  { name: 'SIERPINSKI', hue: 0.44, motto: 'Löcher sind auch Land.' },
  { name: 'FARN', hue: 0.58, motto: 'Wir wachsen selbstähnlich.' },
];

const PHASES = ['land', 'ausbau', 'ernte', 'auktion', 'bilanz'];
const PHASE_LABEL = {
  intro: 'NEUE RUNDE',
  land: 'LANDNAHME',
  ausbau: 'AUSBAU',
  ernte: 'PRODUKTION',
  auktion: 'AUKTION',
  bilanz: 'BILANZ',
};
const PHASE_HELP = {
  intro: 'Gleich geht’s los – sucht eure Ecke!',
  land: 'Feld blinkt → euer LAND-Pad füllen!',
  ausbau: 'Was bauen eure Felder? Im Pad abstimmen!',
  ernte: 'Laser runter – der Planet arbeitet.',
  auktion: 'Laser = Preis. Kauf trifft Verkauf = Handel!',
  bilanz: 'Abrechnung: Jede Kolonie muss essen.',
};

const ROUND_NEWS = {
  1: 'Landen, bauen, ernten, handeln – alle gleichzeitig!',
  2: 'Neu: Meteore und Schleimpilz. Der Planet wird frech.',
  3: 'Mutterschiff-Tag: Kristall-Börse! Und: Piraten.',
  4: 'Neu: Planetenbeben – und bis zu 2 Ereignisse!',
  5: 'Die Preise spielen verrückt. Laser ruhig halten!',
  6: 'Letzte Runde + Kristall-Börse! Jeder Taler zählt.',
};

const EVENTS = [
  { kind: 'sonnensturm', from: 1, weight: 3 },
  { kind: 'kristallsegen', from: 1, weight: 3 },
  { kind: 'algenbluete', from: 1, weight: 3 },
  { kind: 'meteor', from: 2, weight: 3 },
  { kind: 'schleim', from: 2, weight: 2 },
  { kind: 'piraten', from: 3, weight: 2 },
  { kind: 'boom', from: 3, weight: 2 },
  { kind: 'beben', from: 4, weight: 2 },
];

const HUNGER_QUIPS = [
  'Sie kochen Suppe aus Steinen.',
  'Jemand isst heimlich Kabel.',
  'Der Koch kündigt.',
  'Magenknurren auf allen Frequenzen.',
];

const JULIA_PRESETS = [
  [-0.8, 0.156],
  [-0.7269, 0.1889],
  [-0.4, 0.6],
  [0.285, 0.01],
  [-0.835, -0.2321],
  [-0.70176, -0.3842],
];

// ---------------------------------------------------------------------------------------------------------
// Zustand (vorbelegt – handle() läuft auch ohne init())
// ---------------------------------------------------------------------------------------------------------

const STATE = {
  scene: 'title',
  sceneTime: 0,
  time: 0,
  round: 1,
  phase: 'intro',
  phaseTime: 0,
  phaseDuration: SETTINGS.introTime,
  claimIndex: 0,
  claimField: -1,
  claimDone: false,
  claimPauseLeft: 0,
  claimResult: '',
  claimWinner: -1,
  auctionRes: 'algen',
  auctionIdle: 0,
  tradeTimer: 0,
  kurs: RES_INFO.kristall.base,
  kursPhase: 0,
  depotBuy: 0,
  depotSell: 0,
  lastTrade: null,
  priceFactor: { algen: 1, energie: 1, kristall: 1 },
  depot: { algen: 8, energie: 8, kristall: 0 },
  events: [],
  bilanzRows: [],
  bilanzHeadline: '',
  colonyBonus: 0,
  testFaction: 0,
  juliaCx: -0.8,
  juliaCy: 0.156,
  planetRot: 0,
  shake: 0,
  flash: 0,
  newHighscore: false,
  winner: 0,
  ranking: [],
  finalColony: 0,
};

const STATS = {
  claimed: 0,
  unclaimed: 0,
  trades: 0,
  tradeVolume: 0,
  depotSales: 0,
  depotBuys: 0,
  mothershipSales: 0,
  emergencyBuys: 0,
  hungerCount: 0,
  blackouts: 0,
  meteors: 0,
  events: 0,
  allFedRounds: 0,
};

function makeFaction(i) {
  const d = FACTION_DEFS[i];
  return {
    index: i,
    name: d.name,
    hue: d.hue,
    motto: d.motto,
    taler: SETTINGS.startTaler,
    res: { algen: SETTINGS.startAlgen, energie: SETTINGS.startEnergie, kristall: SETTINGS.startKristall },
    disp: { algen: SETTINGS.startAlgen, energie: SETTINGS.startEnergie, kristall: SETTINGS.startKristall, taler: SETTINGS.startTaler },
    choice: 'algen',
    chosen: false,
    role: 'idle',
    wants: 0,
    sellable: 0,
    price: 0.5,
    keyHold: 0,
    hungry: false,
    shake: 0,
    flash: 0,
    lastProd: { algen: 0, energie: 0, kristall: 0 },
    trades: 0,
  };
}

var factions = [0, 1, 2, 3].map(makeFaction);
var fields = [];
var particles = [];
var floaters = [];
var tokens = [];
var stars = [];

var claimGroup = null;
var claimAllowed = [];
var voteGroups = [null, null, null, null];
var strips = null;
var titleZones = null;
var startButton = null;
var againButton = null;
var music = null;
var keyEdge = createKeyEdge();
var highscore = createHighscore('Kolonie-Auktion', 'kolonie');
var lastSoundTime = {};

var PAL = null;
var palKey = '';
var planetCanvas = null;

// ---------------------------------------------------------------------------------------------------------
// Hilfen
// ---------------------------------------------------------------------------------------------------------

/** Farbe aus der Laserfarbe; Hue immer im Komplementärbereich 0.25..0.75 */
function col(h, s, v) {
  const hue = Math.max(0.25, Math.min(0.75, h));
  return getRgbSpreadHex(laserConfig.testColor, hue, s, v);
}

function colRgb(h, s, v) {
  const hue = Math.max(0.25, Math.min(0.75, h));
  const c = getRgbSpread(laserConfig.testColor, hue, s, v);
  return [Math.round(c[0]) || 0, Math.round(c[1]) || 0, Math.round(c[2]) || 0];
}

const RES_HUE = { algen: 0.45, energie: 0.3, kristall: 0.64 };

function ensurePalette() {
  const key = String(laserConfig.testColor);
  if (PAL && key === palKey) return;
  palKey = key;
  PAL = {
    fac: FACTION_DEFS.map((d) => col(d.hue, 0.7, 0.98)),
    facMid: FACTION_DEFS.map((d) => col(d.hue, 0.5, 0.75)),
    facDim: FACTION_DEFS.map((d) => col(d.hue, 0.5, 0.42)),
    facDark: FACTION_DEFS.map((d) => col(d.hue, 0.6, 0.13)),
    res: { algen: col(RES_HUE.algen, 0.65, 0.92), energie: col(RES_HUE.energie, 0.75, 0.98), kristall: col(RES_HUE.kristall, 0.55, 0.98) },
    resDim: { algen: col(RES_HUE.algen, 0.5, 0.3), energie: col(RES_HUE.energie, 0.5, 0.3), kristall: col(RES_HUE.kristall, 0.5, 0.3) },
    hud: col(0.5, 0.3, 0.95),
    hudDim: col(0.5, 0.25, 0.55),
    title: col(0.55, 0.6, 0.98),
    sub: col(0.4, 0.45, 0.88),
    warn: col(0.27, 0.9, 1),
    good: col(0.42, 0.7, 1),
    bad: col(0.74, 0.75, 1),
    field: col(0.5, 0.25, 0.42),
    fieldHi: col(0.5, 0.15, 1),
    star: col(0.5, 0.15, 0.75),
    atmo: col(0.52, 0.6, 0.65),
    flash: col(0.5, 0.25, 1),
    depot: col(0.36, 0.35, 0.85),
    kurs: col(0.64, 0.7, 1),
    start: [col(0.52, 0.6, 0.6), col(0.52, 0.6, 0.8), col(0.52, 0.6, 1)],
  };
  planetCanvas = null;
}

function playSound(src, volume, minGap) {
  if (minGap) {
    const last = lastSoundTime[src] || -99;
    if (STATE.time - last < minGap) return null;
    lastSoundTime[src] = STATE.time;
  }
  try {
    const a = new Audio(src);
    a.volume = volume === undefined ? 1 : volume;
    const p = a.play();
    if (p && p.catch) p.catch(() => {});
    return a;
  } catch (e) {
    return null;
  }
}

function stopMusic() {
  if (music) {
    try {
      music.pause();
    } catch (e) {
      // egal
    }
    music = null;
  }
}

function setScene(name) {
  STATE.scene = name;
  STATE.sceneTime = 0;
}

function txt(ctx, text, x, y, size, color, align) {
  util.renderText({ ctx, text, x, y, fontSize: size + 'px', fillStyle: color, align: align || 'center' });
}

function addParticles(x, y, count, color, speed) {
  for (let i = 0; i < count && particles.length < SETTINGS.maxParticles; i++) {
    const a = Math.random() * Math.PI * 2;
    const s = (0.3 + Math.random()) * (speed || 220);
    const life = 0.5 + Math.random() * 0.8;
    particles.push({ x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s, life, max: life, color, size: 3 + Math.random() * 5 });
  }
}

function addFloater(x, y, text, color, size) {
  if (floaters.length >= SETTINGS.maxFloaters) floaters.shift();
  floaters.push({ x, y, text, color, life: 1.8, size: size || 42 });
}

function addToken(x0, y0, x1, y1, kind, delay, color) {
  if (tokens.length >= SETTINGS.maxTokens) return;
  tokens.push({ x0, y0, x1, y1, kind, delay: delay || 0, t: 0, dur: 0.9 + Math.random() * 0.3, color });
}

function randInt(n) {
  return Math.floor(Math.random() * n);
}

function fieldsOf(f) {
  let n = 0;
  for (let i = 0; i < fields.length; i++) if (fields[i].owner === f) n++;
  return n;
}

function foodNeed() {
  return DIFFICULTY.foodStart + Math.floor((STATE.round - 1) / DIFFICULTY.foodEveryRounds);
}

function energyNeed(f) {
  let n = 0;
  for (let i = 0; i < fields.length; i++) if (fields[i].owner === f && factions[f].choice !== 'energie') n++;
  return n;
}

function needOf(f, res) {
  if (res === 'algen') return foodNeed();
  if (res === 'energie') return energyNeed(f);
  return 0;
}

function basePrice(res) {
  return RES_INFO[res].base * STATE.priceFactor[res];
}

function factionValue(f) {
  const fa = factions[f];
  return Math.round(
    fa.taler +
      fieldsOf(f) * SETTINGS.landValue +
      fa.res.algen * RES_INFO.algen.base +
      fa.res.energie * RES_INFO.energie.base +
      fa.res.kristall * RES_INFO.kristall.base
  );
}

function colonyValue() {
  let sum = 0;
  for (let f = 0; f < 4; f++) sum += factionValue(f);
  return Math.max(0, Math.round(sum + STATE.colonyBonus));
}

function padCenter(f) {
  const p = PANELS[f];
  return { x: p.x + PANEL_W / 2, y: p.y + PAD_TOP + 128 };
}

function barPos(f, res) {
  const p = PANELS[f];
  const k = RESOURCES.indexOf(res);
  return { x: p.x + 180, y: p.y + 128 + k * 40 };
}

function hexPoints(x, y, r) {
  const pts = [];
  for (let k = 0; k < 6; k++) {
    const a = Math.PI / 6 + (k * Math.PI) / 3;
    pts.push({ x: x + r * Math.cos(a), y: y + r * Math.sin(a) });
  }
  return pts;
}

function pathPoly(ctx, pts) {
  ctx.beginPath();
  pts.forEach((p, i) => {
    if (i === 0) ctx.moveTo(p.x, p.y);
    else ctx.lineTo(p.x, p.y);
  });
  ctx.closePath();
}

// ---------------------------------------------------------------------------------------------------------
// Planet: Julia-Menge
// ---------------------------------------------------------------------------------------------------------

function juliaAt(px, py, maxIter) {
  const u = (px - MAP.cx) / MAP.r;
  const v = (py - MAP.cy) / MAP.r;
  const c = Math.cos(STATE.planetRot);
  const s = Math.sin(STATE.planetRot);
  let zx = (u * c - v * s) * 1.55;
  let zy = (u * s + v * c) * 1.55;
  let i = 0;
  for (; i < maxIter; i++) {
    const xx = zx * zx;
    const yy = zy * zy;
    if (xx + yy > 16) break;
    zy = 2 * zx * zy + STATE.juliaCy;
    zx = xx - yy + STATE.juliaCx;
  }
  if (i >= maxIter) return maxIter;
  const m = Math.sqrt(zx * zx + zy * zy);
  return Math.max(0, i + 1 - Math.log(Math.log(m)) / Math.LN2);
}

function ensurePlanet() {
  if (planetCanvas || typeof document === 'undefined') return;
  const size = Math.round(MAP.r); // halbe Auflösung, wird 2× gezeichnet
  const cnv = document.createElement('canvas');
  cnv.width = size;
  cnv.height = size;
  const g = cnv.getContext('2d');
  if (!g || !g.createImageData) return;
  const img = g.createImageData(size, size);
  const data = img.data;
  const maxIter = 48;
  const lut = [];
  for (let k = 0; k <= 32; k++) {
    const t = k / 32;
    lut.push(colRgb(0.3 + t * 0.4, 0.55, 0.1 + 0.26 * Math.pow(t, 0.7)));
  }
  const inside = colRgb(RES_HUE.kristall, 0.45, 0.3);
  const half = size / 2;
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const dx = (x + 0.5 - half) / half;
      const dy = (y + 0.5 - half) / half;
      const d2 = dx * dx + dy * dy;
      const o = (y * size + x) * 4;
      if (d2 > 1) {
        data[o + 3] = 0;
        continue;
      }
      const n = juliaAt(MAP.cx + dx * MAP.r, MAP.cy + dy * MAP.r, maxIter);
      let c;
      if (n >= maxIter) c = inside;
      else c = lut[Math.min(32, Math.floor((n / maxIter) * 32 * 2.2) % 33)];
      const limb = 1 - 0.65 * d2 * d2; // Randverdunkelung
      data[o] = c[0] * limb;
      data[o + 1] = c[1] * limb;
      data[o + 2] = c[2] * limb;
      data[o + 3] = 255;
    }
  }
  g.putImageData(img, 0, 0);
  planetCanvas = cnv;
}

function generateWorld() {
  const preset = JULIA_PRESETS[randInt(JULIA_PRESETS.length)];
  STATE.juliaCx = preset[0] + (Math.random() - 0.5) * 0.02;
  STATE.juliaCy = preset[1] + (Math.random() - 0.5) * 0.02;
  STATE.planetRot = Math.random() * Math.PI * 2;
  planetCanvas = null;
  fields = [];
  const dx = Math.sqrt(3) * HEX_R;
  const dy = 1.5 * HEX_R;
  for (let j = -3; j <= 3; j++) {
    for (let i = -5; i <= 5; i++) {
      const x = MAP.cx + (i + (j & 1 ? 0.5 : 0)) * dx;
      const y = MAP.cy + j * dy;
      if (Math.hypot(x - MAP.cx, y - MAP.cy) > MAP.r - HEX_R * 0.75) continue;
      // Gelände aus der Julia-Menge: Mittel über 7 Messpunkte
      let n = juliaAt(x, y, 40);
      for (let k = 0; k < 6; k++) {
        const a = (k * Math.PI) / 3;
        n += juliaAt(x + Math.cos(a) * HEX_R * 0.5, y + Math.sin(a) * HEX_R * 0.5, 40);
      }
      fields.push({
        x,
        y,
        n: n / 7,
        terrain: 'algen',
        owner: -1,
        crater: false,
        craterVisible: false,
        produced: 0,
        prodKind: '',
        blackout: false,
        flash: 0,
        pulse: Math.random() * 6,
        poly: hexPoints(x, y, HEX_R - 5),
      });
    }
  }
  // Drittel: schnelle Flucht = Sonnen-Ebene, mittel = Algen-See, Julia-Inneres = Kristall-Gebirge
  const order = fields.map((f, i) => i).sort((a, b) => fields[a].n - fields[b].n);
  order.forEach((idx, rank) => {
    const t = rank / order.length;
    fields[idx].terrain = t < 0.34 ? 'energie' : t < 0.67 ? 'algen' : 'kristall';
  });
}

// ---------------------------------------------------------------------------------------------------------
// Spielablauf
// ---------------------------------------------------------------------------------------------------------

function resetRun() {
  factions = [0, 1, 2, 3].map(makeFaction);
  particles = [];
  floaters = [];
  tokens = [];
  generateWorld();
  STATE.round = 1;
  STATE.colonyBonus = 0;
  STATE.depot = { algen: SETTINGS.depotStart.algen, energie: SETTINGS.depotStart.energie, kristall: SETTINGS.depotStart.kristall };
  STATE.priceFactor = { algen: 1, energie: 1, kristall: 1 };
  STATE.events = [];
  STATE.bilanzRows = [];
  STATE.shake = 0;
  STATE.flash = 0;
  STATE.claimField = -1;
  STATE.lastTrade = null;
  Object.keys(STATS).forEach((k) => (STATS[k] = 0));
  claimGroup = null;
  voteGroups = [null, null, null, null];
  // Startfelder: jede Kolonie ein Feld, möglichst verschiedene Gelände, möglichst in ihrer Ecke
  const wanted = ['algen', 'energie', 'kristall', 'algen'];
  for (let f = 0; f < 4; f++) {
    const p = padCenter(f);
    let best = -1;
    let bestD = Infinity;
    fields.forEach((fd, i) => {
      if (fd.owner >= 0 || fd.terrain !== wanted[f]) return;
      const d = Math.hypot(fd.x - p.x, fd.y - p.y);
      if (d < bestD) {
        bestD = d;
        best = i;
      }
    });
    if (best < 0) best = fields.findIndex((fd) => fd.owner < 0);
    if (best >= 0) {
      fields[best].owner = f;
      factions[f].choice = fields[best].terrain;
    }
  }
  startPhase('intro');
}

function resetAll() {
  stopMusic();
  resetRun();
  startButton = null;
  againButton = null;
  titleZones = null;
  strips = null;
  keyEdge = createKeyEdge();
  setScene('title');
}

function startGame() {
  resetRun();
  setScene('game');
  playSound(soundJingle, 0.7);
  stopMusic();
  music = playSound(soundMusic, 0.25);
  if (music) music.loop = true;
}

function startPhase(name) {
  STATE.phase = name;
  STATE.phaseTime = 0;
  if (name === 'intro') {
    STATE.phaseDuration = SETTINGS.introTime;
    const vol = DIFFICULTY.volatilityStart + (STATE.round - 1) * DIFFICULTY.volatilityPerRound;
    RESOURCES.forEach((r) => (STATE.priceFactor[r] = 1 + (Math.random() * 2 - 1) * vol));
    if (STATE.round > 1) {
      RESOURCES.forEach((r) => (STATE.depot[r] += SETTINGS.depotRestock[r]));
    }
    if (STATE.scene === 'game') playSound(soundRound, 0.6);
  } else if (name === 'land') {
    STATE.phaseDuration = SETTINGS.fieldsPerRound * (SETTINGS.claimTime + SETTINGS.claimPause) + 0.5;
    STATE.claimIndex = 0;
    if (!setupClaim()) STATE.phaseDuration = 1.5;
  } else if (name === 'ausbau') {
    STATE.phaseDuration = SETTINGS.ausbauTime;
    setupAusbau();
  } else if (name === 'ernte') {
    STATE.phaseDuration = SETTINGS.produktionTime;
    runProduction();
  } else if (name === 'auktion') {
    STATE.phaseDuration = SETTINGS.auktionTime;
    setupAuction();
  } else if (name === 'bilanz') {
    STATE.phaseDuration = SETTINGS.bilanzTime;
    runBilanz();
  }
  if (name !== 'intro' && STATE.scene === 'game') playSound(soundPhase, 0.5);
}

function nextPhase() {
  const p = STATE.phase;
  if (p === 'intro') startPhase('land');
  else if (p === 'land') startPhase('ausbau');
  else if (p === 'ausbau') startPhase('ernte');
  else if (p === 'ernte') startPhase('auktion');
  else if (p === 'auktion') startPhase('bilanz');
  else if (STATE.round >= SETTINGS.rounds) endGame();
  else {
    STATE.round++;
    startPhase('intro');
  }
}

function endGame() {
  stopMusic();
  playSound(soundGameOver, 0.8);
  const ranking = [0, 1, 2, 3].map((f) => ({ f, value: factionValue(f) })).sort((a, b) => b.value - a.value);
  STATE.ranking = ranking;
  STATE.winner = ranking[0].f;
  STATE.finalColony = colonyValue();
  highscore.addEntry({
    kolonie: STATE.finalColony,
    sieger: ranking[0].value,
    handel: STATS.trades,
    satt: STATS.allFedRounds,
  });
  STATE.newHighscore = highscore.lastEntryNewHighscore();
  againButton = null;
  setScene('gameover');
}

// --- Landnahme -------------------------------------------------------------------------------------------

function setupClaim() {
  const free = [];
  fields.forEach((fd, i) => {
    if (fd.owner < 0) free.push(i);
  });
  claimGroup = null;
  if (!free.length) {
    STATE.claimField = -1;
    return false;
  }
  STATE.claimField = free[randInt(free.length)];
  STATE.claimDone = false;
  STATE.claimPauseLeft = 0;
  STATE.claimResult = '';
  STATE.claimWinner = -1;
  let minFields = Infinity;
  for (let f = 0; f < 4; f++) minFields = Math.min(minFields, fieldsOf(f));
  claimAllowed = [];
  for (let f = 0; f < 4; f++) if (fieldsOf(f) - minFields < SETTINGS.fieldLead) claimAllowed.push(f);
  claimGroup = guiVoteGroup({
    options: claimAllowed.map((f) => {
      const c = padCenter(f);
      return { x: c.x, y: c.y + 10, radius: 88 };
    }),
    edges: 6,
    speedUp: 55,
    speedDown: 15,
    fullPercent: 20,
    decideValue: 100,
    timeLimit: SETTINGS.claimTime,
    keyCodes: claimAllowed.map((f) => 'Digit' + (f + 1)),
    visible: false,
    onDecide: (i) => onClaimDecided(i),
  });
  return true;
}

function onClaimDecided(i) {
  STATE.claimDone = true;
  STATE.claimPauseLeft = SETTINGS.claimPause;
  const fd = fields[STATE.claimField];
  if (!fd) return;
  if (i < 0 || claimAllowed[i] === undefined) {
    STATE.claimWinner = -1;
    STATE.claimResult = 'Niemand will den ' + TERRAIN_NAME[fd.terrain] + '. Bleibt frei.';
    STATS.unclaimed++;
    addFloater(fd.x, fd.y - 40, 'frei', PAL.hudDim, 40);
    return;
  }
  const f = claimAllowed[i];
  fd.owner = f;
  fd.flash = 1.2;
  STATE.claimWinner = f;
  STATE.claimResult = factions[f].name + ' schnappt sich den ' + TERRAIN_NAME[fd.terrain] + '!';
  factions[f].flash = 1;
  STATS.claimed++;
  addParticles(fd.x, fd.y, 40, PAL.fac[f], 260);
  addFloater(fd.x, fd.y - 40, factions[f].name + '!', PAL.fac[f], 48);
  playSound(soundClaim, 0.6);
}

function updateLand(grid, dt) {
  if (STATE.claimField < 0 || !claimGroup) return;
  if (!STATE.claimDone) {
    claimGroup.handle(grid, dt);
    return;
  }
  STATE.claimPauseLeft -= dt;
  if (STATE.claimPauseLeft <= 0) {
    STATE.claimIndex++;
    if (STATE.claimIndex >= SETTINGS.fieldsPerRound || !setupClaim()) {
      STATE.claimField = -1;
      claimGroup = null;
      STATE.phaseDuration = Math.min(STATE.phaseDuration, STATE.phaseTime + 0.4);
    }
  }
}

// --- Ausbau ----------------------------------------------------------------------------------------------

function voteOptions(f) {
  const c = padCenter(f);
  return RESOURCES.map((r, k) => ({ x: c.x - 125 + k * 125, y: c.y + 12, radius: 56 }));
}

function setupAusbau() {
  for (let f = 0; f < 4; f++) {
    const fa = factions[f];
    fa.chosen = false;
    if (fieldsOf(f) === 0) {
      voteGroups[f] = null;
      fa.chosen = true; // ohne Land nichts zu wählen
      continue;
    }
    voteGroups[f] = guiVoteGroup({
      options: voteOptions(f),
      edges: 8,
      speedUp: 38,
      speedDown: 10,
      fullPercent: 25,
      decideValue: 100,
      timeLimit: SETTINGS.ausbauTime - 0.3,
      visible: false,
      onDecide: (i) => onChoice(f, i),
    });
  }
}

function onChoice(f, i) {
  const fa = factions[f];
  if (fa.chosen) return;
  fa.chosen = true;
  if (voteGroups[f]) voteGroups[f].stop();
  const c = padCenter(f);
  if (i >= 0 && RESOURCES[i]) {
    fa.choice = RESOURCES[i];
    fa.flash = 0.8;
    addFloater(c.x, c.y - 60, RES_INFO[fa.choice].label + '!', PAL.res[fa.choice], 44);
    addParticles(c.x, c.y, 25, PAL.fac[f], 200);
    playSound(soundVote, 0.5, 0.1);
  } else {
    addFloater(c.x, c.y - 60, 'bleibt ' + RES_INFO[fa.choice].label, PAL.hudDim, 36);
  }
}

function updateAusbau(grid, dt) {
  let allDone = true;
  for (let f = 0; f < 4; f++) {
    const fa = factions[f];
    if (fa.chosen) continue;
    allDone = false;
    if (f === STATE.testFaction) {
      for (let k = 0; k < 3; k++) {
        if (keyEdge(CHOICE_KEYS[k])) {
          onChoice(f, k);
          break;
        }
      }
    }
    if (!fa.chosen && voteGroups[f]) voteGroups[f].handle(grid, dt);
  }
  if (allDone) STATE.phaseDuration = Math.min(STATE.phaseDuration, STATE.phaseTime + 1.5);
}

// --- Produktion ------------------------------------------------------------------------------------------

function pickEvents() {
  const r = STATE.round;
  const chance = Math.min(1, DIFFICULTY.eventChanceStart + (r - 1) * DIFFICULTY.eventChancePerRound);
  const maxN = Math.floor(DIFFICULTY.eventsMaxStart + (r - 1) * DIFFICULTY.eventsMaxPerRound);
  const result = [];
  if (Math.random() >= chance) return result;
  const n = 1 + (maxN > 1 ? randInt(maxN) : 0);
  const pool = EVENTS.filter((e) => e.from <= r);
  for (let k = 0; k < n && pool.length; k++) {
    let total = 0;
    pool.forEach((e) => (total += e.weight));
    let x = Math.random() * total;
    let pick = 0;
    for (let i = 0; i < pool.length; i++) {
      x -= pool[i].weight;
      if (x <= 0) {
        pick = i;
        break;
      }
    }
    result.push(pool[pick].kind);
    pool.splice(pick, 1);
  }
  return result;
}

function richestFaction() {
  let best = 0;
  for (let f = 1; f < 4; f++) if (factionValue(f) > factionValue(best)) best = f;
  return best;
}

function poorestFaction() {
  let best = 0;
  for (let f = 1; f < 4; f++) if (factionValue(f) < factionValue(best)) best = f;
  return best;
}

/** Ereignis vorbereiten: Modifikatoren für die Produktion + Text */
function applyEvent(kind, mods) {
  const ev = { kind, title: '', text: '', field: -1, at: 0, impacted: false, faction: -1 };
  if (kind === 'sonnensturm') {
    mods.mult.energie *= 2;
    mods.mult.algen *= 0.5;
    ev.title = 'SONNENSTURM!';
    ev.text = 'Energie doppelt – die Algen kriegen Sonnenbrand.';
  } else if (kind === 'kristallsegen') {
    mods.bonus.kristall += 3;
    ev.title = 'KRISTALLSEGEN!';
    ev.text = 'Der Planet hustet Edelsteine. +3 je Kristall-Feld.';
  } else if (kind === 'algenbluete') {
    const f = poorestFaction();
    mods.bloom = f;
    ev.faction = f;
    ev.title = 'ALGENBLÜTE bei ' + factions[f].name + '!';
    ev.text = 'Grün, glibberig, lecker: +4 Algen frei Haus.';
  } else if (kind === 'meteor') {
    const owned = [];
    fields.forEach((fd, i) => {
      if (fd.owner >= 0) owned.push(i);
    });
    const idx = owned.length && Math.random() < 0.8 ? owned[randInt(owned.length)] : randInt(fields.length);
    const fd = fields[idx];
    if (fd) {
      fd.crater = true;
      ev.field = idx;
      ev.title = 'METEOR!';
      ev.text =
        fd.owner >= 0
          ? 'Volltreffer bei ' + factions[fd.owner].name + '. Aua. Aber: Kristall-Krater!'
          : 'Trifft Niemandsland. Puh. Jetzt mit Kristall.';
      STATS.meteors++;
    }
  } else if (kind === 'schleim') {
    STATE.depot.algen = Math.floor(STATE.depot.algen / 3);
    ev.title = 'SCHLEIMPILZ IM DEPOT!';
    ev.text = 'Die Algen-Reserve ist jetzt … lebendig. Und weg.';
  } else if (kind === 'piraten') {
    const f = richestFaction();
    const fa = factions[f];
    ev.faction = f;
    ev.title = 'WELTRAUM-PIRATEN!';
    if (fa.res.kristall > 0) {
      const loss = Math.ceil(fa.res.kristall / 2);
      fa.res.kristall = Math.max(0, fa.res.kristall - loss);
      ev.text = 'Besuch bei ' + fa.name + ': −' + loss + ' Kristall. Nur die Reichen. Wie immer.';
    } else {
      const loss = Math.floor(fa.taler * 0.25);
      fa.taler = Math.max(0, fa.taler - loss);
      ev.text = 'Besuch bei ' + fa.name + ': −' + loss + ' Taler. Kein Kristall? Dann Bargeld.';
    }
    fa.shake = 0.8;
  } else if (kind === 'boom') {
    STATE.priceFactor.kristall *= 1.4;
    ev.title = 'KRISTALL-BOOM!';
    ev.text = 'Das Mutterschiff zahlt Fantasiepreise. Verkaufen!';
  } else if (kind === 'beben') {
    for (let k = 0; k < 2; k++) {
      const fd = fields[randInt(fields.length)];
      if (!fd) continue;
      const others = RESOURCES.filter((r) => r !== fd.terrain);
      fd.terrain = others[randInt(others.length)];
      fd.flash = 1;
    }
    ev.title = 'PLANETENBEBEN!';
    ev.text = 'Zwei Felder haben jetzt eine neue Persönlichkeit.';
  }
  return ev;
}

function runProduction() {
  const kinds = pickEvents();
  const mods = { mult: { algen: 1, energie: 1, kristall: 1 }, bonus: { algen: 0, energie: 0, kristall: 0 }, bloom: -1 };
  STATE.events = kinds.map((k) => applyEvent(k, mods));
  if (!STATE.events.length) {
    STATE.events.push({ kind: 'ruhe', title: 'RUHIGE RUNDE', text: 'Nichts passiert. Verdächtig ruhig.', field: -1, at: 0, impacted: true, faction: -1 });
  }
  const slot = Math.min(3, (SETTINGS.produktionTime - 0.6) / STATE.events.length);
  STATE.events.forEach((ev, i) => (ev.at = 0.3 + i * slot));
  STATS.events += kinds.length;

  let blackouts = 0;
  for (let f = 0; f < 4; f++) {
    const fa = factions[f];
    const prod = { algen: 0, energie: 0, kristall: 0 };
    let energyLeft = fa.res.energie;
    let tokenDelay = 1.2;
    fields.forEach((fd) => {
      fd.produced = 0;
      fd.blackout = false;
      if (fd.owner !== f) return;
      const kind = fa.choice;
      let amount = fd.terrain === kind ? DIFFICULTY.yieldMatch : DIFFICULTY.yieldOther;
      amount += randInt(DIFFICULTY.yieldJitter * 2 + 1) - DIFFICULTY.yieldJitter;
      amount = Math.max(0, Math.round(amount * mods.mult[kind]));
      if (kind === 'kristall' && fd.terrain === 'kristall') amount += mods.bonus.kristall;
      if (kind !== 'energie') {
        if (energyLeft > 0) energyLeft--;
        else {
          amount = Math.floor(amount / 2);
          fd.blackout = true;
          blackouts++;
        }
      }
      if (fd.crater) amount = 0;
      fd.produced = amount;
      fd.prodKind = kind;
      prod[kind] += amount;
      const target = barPos(f, kind);
      for (let k = 0; k < Math.min(amount, 8); k++) {
        addToken(fd.x, fd.y, target.x, target.y, kind, tokenDelay + k * 0.12, PAL.res[kind]);
      }
      tokenDelay += 0.35;
    });
    if (mods.bloom === f) prod.algen += 4;
    fa.res.energie = Math.max(0, energyLeft);
    RESOURCES.forEach((r) => (fa.res[r] = Math.max(0, fa.res[r] + prod[r])));
    fa.lastProd = prod;
  }
  // Krater werden zu Kristall-Gelände (nach der Ernte)
  fields.forEach((fd) => {
    if (fd.crater) {
      fd.terrain = 'kristall';
      fd.crater = false;
    }
  });
  STATS.blackouts += blackouts;
  STATE.colonyBonus -= blackouts * SETTINGS.colonyBlackoutPenalty;
}

function updateErnte(dt) {
  STATE.events.forEach((ev) => {
    if (ev.impacted || STATE.phaseTime < ev.at) return;
    if (ev.kind === 'meteor') {
      if (STATE.phaseTime < ev.at + 0.8) return;
      const fd = fields[ev.field];
      if (fd) {
        fd.craterVisible = true;
        addParticles(fd.x, fd.y, 70, PAL.warn, 380);
        addParticles(fd.x, fd.y, 30, PAL.res.kristall, 200);
      }
      STATE.shake = 22;
      STATE.flash = 0.5;
      playSound(soundMeteor, 0.8);
    } else if (ev.kind === 'sonnensturm') {
      STATE.flash = 0.7;
      playSound(soundStorm, 0.6);
    } else if (ev.kind === 'piraten' || ev.kind === 'schleim') {
      playSound(soundHunger, 0.5);
      STATE.shake = 8;
    } else if (ev.kind !== 'ruhe') {
      playSound(soundCoin, 0.6);
    }
    ev.impacted = true;
  });
  // Ernte-Zahlen über den Feldern
  fields.forEach((fd) => {
    if (fd.owner < 0 || fd.prodShown === STATE.round || STATE.phaseTime < 1.1) return;
    fd.prodShown = STATE.round;
    if (fd.produced > 0) addFloater(fd.x, fd.y - 20, '+' + fd.produced, PAL.res[fd.prodKind], 40);
    else if (fd.blackout) addFloater(fd.x, fd.y - 20, 'kein Strom', PAL.bad, 30);
  });
}

// --- Auktion ---------------------------------------------------------------------------------------------

function ensureStrips() {
  if (strips) return;
  strips = [0, 1, 2, 3].map((f) => {
    const c = padCenter(f);
    return guiSteerStrip({ posX: c.x, posY: c.y + STRIP.dy, width: STRIP.w, height: STRIP.h, axis: 'x', smoothing: 8, visible: false });
  });
}

function shortage(res) {
  let s = 0;
  for (let f = 0; f < 4; f++) s += Math.max(0, needOf(f, res) - factions[f].res[res]);
  return s;
}

function priceOf(f) {
  const info = RES_INFO[STATE.auctionRes];
  return Math.round(info.min + factions[f].price * (info.max - info.min));
}

function priceToX(price, x0, w) {
  const info = RES_INFO[STATE.auctionRes];
  return x0 + clamp((price - info.min) / (info.max - info.min), 0, 1) * w;
}

function setupAuction() {
  ensureStrips();
  const sa = shortage('algen');
  const se = shortage('energie');
  let res = 'kristall';
  const hasKristall = factions.some((fa) => fa.res.kristall > 0);
  if (SETTINGS.kristallRounds.indexOf(STATE.round) >= 0 && hasKristall) res = 'kristall';
  else if (sa > 0 || se > 0) res = sa >= se ? 'algen' : 'energie';
  else if (!hasKristall) res = STATE.round % 2 ? 'algen' : 'energie';
  STATE.auctionRes = res;
  const base = basePrice(res);
  STATE.depotBuy = Math.max(RES_INFO[res].min, Math.round(base * SETTINGS.depotBuyFactor));
  STATE.depotSell = Math.min(RES_INFO[res].max, Math.round(base * SETTINGS.depotSellFactor));
  STATE.kurs = base;
  STATE.kursPhase = Math.random() * Math.PI * 2;
  STATE.tradeTimer = 1;
  STATE.auctionIdle = 0;
  STATE.lastTrade = null;
  for (let f = 0; f < 4; f++) {
    const fa = factions[f];
    const surplus = fa.res[res] - needOf(f, res);
    fa.keyHold = 0;
    fa.wants = 0;
    fa.sellable = 0;
    if (res === 'kristall') {
      fa.role = fa.res.kristall > 0 ? 'sell' : 'idle';
      fa.sellable = fa.res.kristall;
    } else if (surplus > 0) {
      fa.role = 'sell';
      fa.sellable = surplus;
    } else if (surplus < 0 && fa.taler >= RES_INFO[res].min) {
      fa.role = 'buy';
      fa.wants = -surplus;
    } else {
      fa.role = 'idle';
    }
    fa.price = fa.role === 'buy' ? 0 : 1;
    strips[f].setValue(fa.price);
  }
}

function tradeInterval() {
  return Math.max(DIFFICULTY.tradeIntervalMin, DIFFICULTY.tradeIntervalStart + (STATE.round - 1) * DIFFICULTY.tradeIntervalPerRound);
}

function transfer(seller, buyer, price) {
  const res = STATE.auctionRes;
  let from;
  let to;
  if (seller >= 0) {
    const s = factions[seller];
    s.res[res] = Math.max(0, s.res[res] - 1);
    s.taler += price;
    s.sellable = Math.max(0, s.sellable - 1);
    s.trades++;
    from = barPos(seller, res);
  } else {
    STATE.depot[res] = Math.max(0, STATE.depot[res] - 1);
    from = { x: MAP.cx, y: 1040 };
  }
  if (buyer >= 0) {
    const b = factions[buyer];
    b.res[res] += 1;
    b.taler = Math.max(0, b.taler - price);
    b.wants = Math.max(0, b.wants - 1);
    b.trades++;
    to = barPos(buyer, res);
  } else if (buyer === -1) {
    STATE.depot[res] += 1;
    to = { x: MAP.cx, y: 1040 };
  } else {
    to = { x: MAP.cx, y: 120 }; // Mutterschiff
  }
  addToken(from.x, from.y, to.x, to.y, res, 0, PAL.res[res]);
  STATE.lastTrade = { seller, buyer, price, t: 0.9 };
  if (seller >= 0 && buyer >= 0) {
    STATS.trades++;
    STATS.tradeVolume += price;
    STATE.colonyBonus += SETTINGS.colonyTradeBonus;
    playSound(soundTrade, 0.6, 0.08);
  } else {
    playSound(soundCoin, 0.4, 0.15);
  }
}

function tradeTick() {
  const res = STATE.auctionRes;
  let bestBuyer = -1;
  let bestSeller = -1;
  for (let f = 0; f < 4; f++) {
    const fa = factions[f];
    if (fa.role === 'buy' && fa.wants > 0 && fa.taler >= priceOf(f)) {
      if (bestBuyer < 0 || priceOf(f) > priceOf(bestBuyer)) bestBuyer = f;
    }
    if (fa.role === 'sell' && fa.sellable > 0 && fa.res[res] > 0) {
      if (bestSeller < 0 || priceOf(f) < priceOf(bestSeller)) bestSeller = f;
    }
  }
  if (res === 'kristall') {
    if (bestSeller >= 0 && priceOf(bestSeller) <= STATE.kurs) {
      transfer(bestSeller, -2, Math.round(STATE.kurs));
      STATS.mothershipSales++;
    }
    return;
  }
  if (bestBuyer >= 0 && bestSeller >= 0 && priceOf(bestBuyer) >= priceOf(bestSeller)) {
    const price = Math.min(factions[bestBuyer].taler, Math.round((priceOf(bestBuyer) + priceOf(bestSeller)) / 2));
    transfer(bestSeller, bestBuyer, price);
    return;
  }
  if (bestSeller >= 0 && priceOf(bestSeller) <= STATE.depotBuy) {
    transfer(bestSeller, -1, STATE.depotBuy);
    STATS.depotSales++;
  }
  if (bestBuyer >= 0 && priceOf(bestBuyer) >= STATE.depotSell && STATE.depot[res] > 0 && factions[bestBuyer].taler >= STATE.depotSell) {
    transfer(-1, bestBuyer, STATE.depotSell);
    STATS.depotBuys++;
  }
}

function updateAuction(grid, dt) {
  const res = STATE.auctionRes;
  if (res === 'kristall') {
    const amp = Math.min(DIFFICULTY.kursAmpMax, DIFFICULTY.kursAmpStart + (STATE.round - 1) * DIFFICULTY.kursAmpPerRound);
    STATE.kursPhase += dt * (DIFFICULTY.kursSpeedStart + (STATE.round - 1) * DIFFICULTY.kursSpeedPerRound);
    const k = STATE.kursPhase;
    STATE.kurs = Math.round(basePrice('kristall') * (1 + amp * Math.sin(k) + amp * 0.35 * Math.sin(k * 2.7 + 1)));
    STATE.kurs = clamp(STATE.kurs, RES_INFO.kristall.min, RES_INFO.kristall.max);
  }
  let active = 0;
  for (let f = 0; f < 4; f++) {
    const fa = factions[f];
    if (fa.role === 'idle') continue;
    if ((fa.role === 'sell' && fa.sellable <= 0) || (fa.role === 'buy' && fa.wants <= 0)) {
      fa.role = 'done';
    }
    if (fa.role === 'done') continue;
    active++;
    const strip = strips[f];
    strip.handle(grid, dt);
    const target = fa.role === 'buy' ? 0 : 1;
    let dir = 0;
    if (f === STATE.testFaction) {
      if (isKeyDown('ArrowLeft')) dir -= 1;
      if (isKeyDown('ArrowRight')) dir += 1;
    }
    if (dir !== 0) {
      fa.price = clamp(fa.price + dir * SETTINGS.keyPriceSpeed * dt, 0, 1);
      fa.keyHold = 0.6;
      strip.setValue(fa.price);
    } else if (strip.hasInput()) {
      fa.price = approach(fa.price, strip.getValue(), SETTINGS.priceFollow, dt);
    } else if (fa.keyHold > 0) {
      fa.keyHold -= dt;
    } else {
      // ohne Laser: zurück ans gierige Ende
      const step = SETTINGS.priceDrift * dt;
      fa.price = fa.price < target ? Math.min(target, fa.price + step) : Math.max(target, fa.price - step);
    }
  }
  STATE.tradeTimer -= dt;
  if (STATE.tradeTimer <= 0) {
    STATE.tradeTimer = tradeInterval();
    tradeTick();
  }
  if (STATE.lastTrade) {
    STATE.lastTrade.t -= dt;
    if (STATE.lastTrade.t <= 0) STATE.lastTrade = null;
  }
  // niemand mehr zu handeln → früher weiter
  if (active === 0) {
    STATE.auctionIdle += dt;
    if (STATE.auctionIdle > 2.5) STATE.phaseDuration = Math.min(STATE.phaseDuration, STATE.phaseTime + 0.5);
  } else {
    STATE.auctionIdle = 0;
  }
}

// --- Bilanz ----------------------------------------------------------------------------------------------

function runBilanz() {
  const need = foodNeed();
  const emergencyPrice = Math.round(basePrice('algen') * SETTINGS.emergencyFactor);
  let hungry = 0;
  STATE.bilanzRows = [];
  for (let f = 0; f < 4; f++) {
    const fa = factions[f];
    fa.hungry = false;
    let bought = 0;
    while (fa.res.algen < need && STATE.depot.algen > 0 && fa.taler >= emergencyPrice) {
      STATE.depot.algen--;
      fa.taler -= emergencyPrice;
      fa.res.algen++;
      bought++;
    }
    STATS.emergencyBuys += bought;
    const eaten = Math.min(fa.res.algen, need);
    fa.res.algen = Math.max(0, fa.res.algen - eaten);
    const missing = need - eaten;
    let text;
    let color = PAL.fac[f];
    if (missing > 0) {
      fa.hungry = true;
      hungry++;
      const loss = Math.min(fa.taler, missing * SETTINGS.hungerTalerPerUnit);
      fa.taler = Math.max(0, fa.taler - loss);
      fa.shake = 1;
      text = fa.name + ': HUNGER! (−' + missing + ' Algen) ' + HUNGER_QUIPS[randInt(HUNGER_QUIPS.length)];
      color = PAL.bad;
      STATS.hungerCount++;
    } else if (bought > 0) {
      text = fa.name + ': satt – mit Notkauf ' + bought + '× für ' + bought * emergencyPrice + ' Taler';
    } else {
      text = fa.name + ': satt (' + need + ' Algen gegessen)';
    }
    STATE.bilanzRows.push({ text, color });
  }
  if (hungry === 0) {
    STATE.colonyBonus += SETTINGS.colonyAllFedBonus;
    STATS.allFedRounds++;
    STATE.bilanzHeadline = 'Alle satt! Kolonie +' + SETTINGS.colonyAllFedBonus;
    playSound(soundCoin, 0.6);
  } else {
    STATE.colonyBonus -= hungry * SETTINGS.colonyHungerPenalty;
    STATE.bilanzHeadline = 'Hunger trifft alle: Kolonie −' + hungry * SETTINGS.colonyHungerPenalty;
    playSound(soundHunger, 0.7);
    STATE.shake = 10;
  }
}

// ---------------------------------------------------------------------------------------------------------
// Update allgemein
// ---------------------------------------------------------------------------------------------------------

function updateParticles(dt) {
  particles.slice().forEach((p) => {
    p.life -= dt;
    if (p.life <= 0) {
      particles.splice(particles.indexOf(p), 1);
      return;
    }
    p.x += p.vx * dt;
    p.y += p.vy * dt;
    p.vx *= 1 - Math.min(1, dt * 1.5);
    p.vy *= 1 - Math.min(1, dt * 1.5);
  });
  floaters.slice().forEach((f) => {
    f.life -= dt;
    f.y -= 40 * dt;
    if (f.life <= 0) floaters.splice(floaters.indexOf(f), 1);
  });
  tokens.slice().forEach((t) => {
    if (t.delay > 0) {
      t.delay -= dt;
      return;
    }
    t.t += dt / t.dur;
    if (t.t >= 1) {
      tokens.splice(tokens.indexOf(t), 1);
      addParticles(t.x1, t.y1, 4, t.color, 90);
    }
  });
  factions.forEach((fa) => {
    RESOURCES.forEach((r) => (fa.disp[r] = approach(fa.disp[r], fa.res[r], 3, dt)));
    fa.disp.taler = approach(fa.disp.taler, fa.taler, 4, dt);
    fa.flash = Math.max(0, fa.flash - dt);
    fa.shake = Math.max(0, fa.shake - dt);
  });
  fields.forEach((fd) => (fd.flash = Math.max(0, fd.flash - dt)));
  STATE.shake = Math.max(0, STATE.shake - dt * 40);
}

function updatePhase(grid, dt) {
  STATE.phaseTime += dt;
  if (STATE.phase === 'land') updateLand(grid, dt);
  else if (STATE.phase === 'ausbau') updateAusbau(grid, dt);
  else if (STATE.phase === 'ernte') updateErnte(dt);
  else if (STATE.phase === 'auktion') updateAuction(grid, dt);
  if (STATE.scene === 'game' && STATE.phaseTime >= STATE.phaseDuration) nextPhase();
}

// ---------------------------------------------------------------------------------------------------------
// Zeichnen
// ---------------------------------------------------------------------------------------------------------

function ensureStars() {
  if (stars.length) return;
  for (let i = 0; i < 140; i++) {
    stars.push({ x: Math.random() * W, y: Math.random() * H, s: 1 + Math.random() * 2.5, p: Math.random() * 6 });
  }
}

function renderStars(ctx) {
  ensureStars();
  ctx.save();
  ctx.fillStyle = PAL.star;
  stars.forEach((s) => {
    ctx.globalAlpha = 0.25 + 0.25 * Math.sin(STATE.time * 1.3 + s.p);
    ctx.fillRect(s.x, s.y, s.s, s.s);
  });
  ctx.restore();
}

function renderIcon(ctx, kind, x, y, s, color, lw) {
  ctx.save();
  ctx.strokeStyle = color;
  ctx.lineWidth = lw || 3;
  ctx.lineJoin = 'round';
  ctx.lineCap = 'round';
  ctx.beginPath();
  if (kind === 'kristall') {
    ctx.moveTo(x, y - s);
    ctx.lineTo(x + s * 0.65, y - s * 0.25);
    ctx.lineTo(x, y + s);
    ctx.lineTo(x - s * 0.65, y - s * 0.25);
    ctx.closePath();
    ctx.moveTo(x - s * 0.65, y - s * 0.25);
    ctx.lineTo(x + s * 0.65, y - s * 0.25);
  } else if (kind === 'energie') {
    ctx.moveTo(x + s * 0.3, y - s);
    ctx.lineTo(x - s * 0.4, y + s * 0.1);
    ctx.lineTo(x + s * 0.15, y + s * 0.1);
    ctx.lineTo(x - s * 0.3, y + s);
  } else {
    for (let k = -1; k <= 1; k++) {
      const bx = x + k * s * 0.55;
      ctx.moveTo(bx, y + s);
      for (let t = 1; t <= 8; t++) {
        const yy = y + s - (t / 8) * 2 * s;
        ctx.lineTo(bx + Math.sin(t * 1.3 + k + STATE.time * 2) * s * 0.18, yy);
      }
    }
  }
  ctx.stroke();
  ctx.restore();
}

function renderPlanet(ctx, dim) {
  ensurePlanet();
  ctx.save();
  if (planetCanvas) {
    ctx.globalAlpha = dim === undefined ? 1 : dim;
    ctx.drawImage(planetCanvas, MAP.cx - MAP.r, MAP.cy - MAP.r, MAP.r * 2, MAP.r * 2);
    ctx.globalAlpha = 1;
  }
  ctx.strokeStyle = PAL.atmo;
  ctx.lineWidth = 3;
  ctx.globalAlpha = 0.5 + 0.15 * Math.sin(STATE.time * 0.8);
  ctx.beginPath();
  ctx.arc(MAP.cx, MAP.cy, MAP.r + 6, 0, Math.PI * 2);
  ctx.stroke();
  ctx.restore();
}

function renderFields(ctx) {
  const t = STATE.time;
  fields.forEach((fd, i) => {
    const owner = fd.owner;
    ctx.save();
    pathPoly(ctx, fd.poly);
    if (owner >= 0) {
      ctx.globalAlpha = 0.22 + fd.flash * 0.3;
      ctx.fillStyle = PAL.fac[owner];
      ctx.fill();
      ctx.globalAlpha = 1;
      ctx.strokeStyle = PAL.fac[owner];
      ctx.lineWidth = 4 + fd.flash * 4;
    } else {
      ctx.globalAlpha = 0.75;
      ctx.strokeStyle = PAL.field;
      ctx.lineWidth = 2;
    }
    ctx.stroke();
    ctx.restore();
    // Gelände-Symbol (klein, oben) und Produkt (gross, Mitte)
    renderIcon(ctx, fd.terrain, fd.x, fd.y - 40, 12, PAL.resDim[fd.terrain] && owner < 0 ? PAL.res[fd.terrain] : PAL.resDim[fd.terrain], 2);
    if (owner >= 0) {
      let kind = factions[owner].choice;
      if (STATE.phase === 'ausbau' && !factions[owner].chosen && voteGroups[owner]) {
        const lead = voteGroups[owner].getLeader();
        if (lead >= 0) kind = RESOURCES[lead];
      }
      const wob = 1 + 0.06 * Math.sin(t * 3 + fd.pulse);
      renderIcon(ctx, kind, fd.x, fd.y + 8, 24 * wob, PAL.res[kind], 4);
      if (fd.terrain === kind) {
        ctx.save();
        ctx.strokeStyle = PAL.res[kind];
        ctx.globalAlpha = 0.5;
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(fd.x, fd.y + 8, 36, 0, Math.PI * 2);
        ctx.stroke();
        ctx.restore();
      }
    }
    if (fd.craterVisible) {
      ctx.save();
      ctx.strokeStyle = PAL.warn;
      ctx.lineWidth = 3;
      ctx.setLineDash([6, 6]);
      ctx.beginPath();
      ctx.arc(fd.x, fd.y + 8, 44, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();
    }
    if (i === STATE.claimField && STATE.phase === 'land') renderClaimField(ctx, fd);
  });
}

function renderClaimField(ctx, fd) {
  const pulse = 0.5 + 0.5 * Math.sin(STATE.time * 8);
  ctx.save();
  ctx.strokeStyle = PAL.fieldHi;
  ctx.lineWidth = 5 + pulse * 5;
  ctx.shadowBlur = 25;
  ctx.shadowColor = PAL.fieldHi;
  pathPoly(ctx, hexPoints(fd.x, fd.y, HEX_R + 4 + pulse * 6));
  ctx.stroke();
  ctx.shadowBlur = 0;
  // Wettrennen: je Kolonie ein Ring-Viertel + gestrichelte Linie zum Pad
  if (claimGroup && !STATE.claimDone) {
    claimAllowed.forEach((f, i) => {
      const v = claimGroup.getCounter(i) / 100;
      const a0 = -Math.PI / 2 + (f * Math.PI) / 2;
      ctx.strokeStyle = PAL.fac[f];
      ctx.lineWidth = 12;
      ctx.globalAlpha = 0.25;
      ctx.beginPath();
      ctx.arc(fd.x, fd.y, HEX_R + 26, a0 + 0.08, a0 + Math.PI / 2 - 0.08);
      ctx.stroke();
      ctx.globalAlpha = 1;
      if (v > 0) {
        ctx.beginPath();
        ctx.arc(fd.x, fd.y, HEX_R + 26, a0 + 0.08, a0 + 0.08 + (Math.PI / 2 - 0.16) * v);
        ctx.stroke();
      }
      const c = padCenter(f);
      ctx.globalAlpha = 0.3;
      ctx.lineWidth = 3;
      ctx.setLineDash([14, 12]);
      ctx.lineDashOffset = -STATE.time * 60;
      ctx.beginPath();
      ctx.moveTo(fd.x, fd.y);
      ctx.lineTo(c.x + (c.x < MAP.cx ? 200 : -200), c.y);
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.globalAlpha = 1;
    });
  }
  ctx.restore();
}

function renderTokens(ctx) {
  tokens.forEach((t) => {
    if (t.delay > 0) return;
    const e = t.t * t.t * (3 - 2 * t.t);
    const x = t.x0 + (t.x1 - t.x0) * e;
    const y = t.y0 + (t.y1 - t.y0) * e - Math.sin(t.t * Math.PI) * 120;
    renderIcon(ctx, t.kind, x, y, 14, t.color, 3);
  });
}

function renderParticles(ctx) {
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  particles.forEach((p) => {
    ctx.globalAlpha = Math.max(0, p.life / p.max);
    ctx.fillStyle = p.color;
    ctx.fillRect(p.x - p.size / 2, p.y - p.size / 2, p.size, p.size);
  });
  ctx.restore();
  floaters.forEach((f) => {
    ctx.save();
    ctx.globalAlpha = Math.min(1, f.life);
    txt(ctx, f.text, f.x, f.y, f.size, f.color);
    ctx.restore();
  });
}

// --- Pulte -----------------------------------------------------------------------------------------------

function renderPanel(ctx, f) {
  const fa = factions[f];
  const p = PANELS[f];
  ctx.save();
  if (fa.shake > 0) ctx.translate((Math.random() - 0.5) * 14 * fa.shake, (Math.random() - 0.5) * 14 * fa.shake);
  // Anzeigeteil: dunkel getönt
  ctx.fillStyle = PAL.facDark[f];
  ctx.fillRect(p.x, p.y, PANEL_W, PAD_TOP - 4);
  // Aktionsteil: schwarz
  ctx.fillStyle = '#000000';
  ctx.fillRect(p.x, p.y + PAD_TOP, PANEL_W, PANEL_H - PAD_TOP);
  ctx.strokeStyle = fa.flash > 0 ? PAL.fac[f] : PAL.facDim[f];
  ctx.lineWidth = 3 + fa.flash * 4;
  ctx.strokeRect(p.x, p.y, PANEL_W, PANEL_H);
  const marker = f === STATE.testFaction ? '›' : '';
  txt(ctx, marker + (f + 1) + ' ' + fa.name, p.x + 16, p.y + 46, 40, PAL.fac[f], 'left');
  const nf = fieldsOf(f);
  txt(ctx, Math.round(fa.disp.taler) + ' Taler · ' + nf + (nf === 1 ? ' Feld' : ' Felder'), p.x + 16, p.y + 88, 32, PAL.facMid[f], 'left');
  RESOURCES.forEach((r, k) => {
    const by = p.y + 108 + k * 40;
    renderIcon(ctx, r, p.x + 28, by + 20, 14, PAL.res[r], 3);
    ctx.fillStyle = PAL.resDim[r];
    ctx.fillRect(p.x + 52, by + 8, 250, 24);
    ctx.fillStyle = PAL.res[r];
    ctx.fillRect(p.x + 52, by + 8, Math.min(1, fa.disp[r] / SETTINGS.barMax) * 250, 24);
    const need = needOf(f, r);
    if (need > 0) {
      const nx = p.x + 52 + Math.min(1, need / SETTINGS.barMax) * 250;
      ctx.fillStyle = fa.res[r] < need ? PAL.bad : PAL.hud;
      ctx.fillRect(nx - 2, by + 2, 4, 36);
    }
    txt(ctx, String(Math.round(fa.disp[r])), p.x + 388, by + 34, 36, fa.res[r] < need ? PAL.bad : PAL.res[r], 'right');
  });
  ctx.restore();
  renderPad(ctx, f);
}

function renderInactivePad(ctx, f, text) {
  const p = PANELS[f];
  ctx.save();
  ctx.strokeStyle = PAL.facDim[f];
  ctx.globalAlpha = 0.6;
  ctx.lineWidth = 2;
  ctx.setLineDash([10, 10]);
  ctx.strokeRect(p.x + 14, p.y + PAD_TOP + 14, PANEL_W - 28, PANEL_H - PAD_TOP - 28);
  ctx.restore();
  txt(ctx, text, p.x + PANEL_W / 2, p.y + PAD_TOP + 128, 32, PAL.facDim[f]);
}

function renderPad(ctx, f) {
  const fa = factions[f];
  const p = PANELS[f];
  const c = padCenter(f);
  const ph = STATE.phase;
  const labelY = p.y + PAD_TOP + 34;
  if (ph === 'land') {
    const i = claimAllowed.indexOf(f);
    if (STATE.claimField < 0 || !claimGroup) {
      renderInactivePad(ctx, f, 'Land verteilt');
      return;
    }
    if (i < 0) {
      renderInactivePad(ctx, f, 'SATT – erst die anderen');
      return;
    }
    const v = STATE.claimDone ? (STATE.claimWinner === f ? 1 : 0) : claimGroup.getCounter(i) / 100;
    const pulse = 0.5 + 0.5 * Math.sin(STATE.time * 6 + f);
    ctx.save();
    pathPoly(ctx, hexPoints(c.x, c.y + 10, 88));
    ctx.fillStyle = '#000000';
    ctx.fill();
    ctx.strokeStyle = PAL.fac[f];
    ctx.lineWidth = 4 + pulse * 3;
    ctx.stroke();
    if (v > 0) {
      pathPoly(ctx, hexPoints(c.x, c.y + 10, 88 * v));
      ctx.globalAlpha = 0.35;
      ctx.fillStyle = PAL.facDark[f];
      ctx.fill();
      ctx.globalAlpha = 1;
      ctx.strokeStyle = PAL.facMid[f];
      ctx.lineWidth = 2;
      ctx.stroke();
    }
    ctx.restore();
    const label = STATE.claimDone ? (STATE.claimWinner === f ? 'GESCHAFFT!' : 'zu langsam …') : 'LAND! hier füllen';
    txt(ctx, label, c.x, labelY, 34, PAL.fac[f]);
    return;
  }
  if (ph === 'ausbau') {
    const g = voteGroups[f];
    if (!g) {
      renderInactivePad(ctx, f, 'Kein Land – zuschauen');
      return;
    }
    const opts = voteOptions(f);
    opts.forEach((o, k) => {
      const r = RESOURCES[k];
      const chosenThis = fa.chosen && fa.choice === r;
      ctx.save();
      ctx.beginPath();
      ctx.arc(o.x, o.y, o.radius, 0, Math.PI * 2);
      ctx.fillStyle = '#000000';
      ctx.fill();
      ctx.strokeStyle = chosenThis ? PAL.res[r] : fa.chosen ? PAL.resDim[r] : PAL.facMid[f];
      ctx.lineWidth = chosenThis ? 7 : 3;
      ctx.stroke();
      const v = fa.chosen ? 0 : g.getCounter(k) / 100;
      if (v > 0) {
        ctx.beginPath();
        ctx.arc(o.x, o.y, o.radius + 8, -Math.PI / 2, -Math.PI / 2 + v * Math.PI * 2);
        ctx.strokeStyle = PAL.res[r];
        ctx.lineWidth = 6;
        ctx.stroke();
      }
      ctx.restore();
      renderIcon(ctx, r, o.x, o.y, 22, fa.chosen && !chosenThis ? PAL.resDim[r] : PAL.res[r], 3);
    });
    const label = fa.chosen ? 'Wir bauen ' + RES_INFO[fa.choice].label : 'Was bauen wir?';
    txt(ctx, label, c.x, labelY, 34, fa.chosen ? PAL.res[fa.choice] : PAL.fac[f]);
    return;
  }
  if (ph === 'auktion') {
    if (fa.role === 'idle') {
      renderInactivePad(ctx, f, 'Nix zu handeln … stören?');
      return;
    }
    const x0 = c.x - STRIP.w / 2;
    const y0 = c.y + STRIP.dy - STRIP.h / 2;
    const w = STRIP.w;
    const h = STRIP.h;
    const done = fa.role === 'done';
    ctx.save();
    ctx.fillStyle = '#000000';
    ctx.fillRect(x0, y0, w, h);
    ctx.strokeStyle = done ? PAL.facDim[f] : PAL.fac[f];
    ctx.lineWidth = 3;
    if (done) ctx.setLineDash([10, 10]);
    ctx.strokeRect(x0, y0, w, h);
    ctx.setLineDash([]);
    // Markierungen am Rand: Depot / Kurs
    const tick = (price, color) => {
      const x = priceToX(price, x0, w);
      ctx.fillStyle = color;
      ctx.fillRect(x - 2, y0 - 12, 4, 12);
      ctx.fillRect(x - 2, y0 + h, 4, 12);
    };
    if (STATE.auctionRes === 'kristall') tick(STATE.kurs, PAL.kurs);
    else {
      tick(STATE.depotBuy, PAL.depot);
      tick(STATE.depotSell, PAL.depot);
    }
    if (!done) {
      const mx = x0 + fa.price * w;
      ctx.strokeStyle = PAL.fac[f];
      ctx.lineWidth = 6;
      ctx.beginPath();
      ctx.moveTo(mx, y0 + 10);
      ctx.lineTo(mx, y0 + h - 10);
      ctx.stroke();
    }
    ctx.restore();
    let label;
    if (done) label = fa.role === 'done' ? 'Fertig gehandelt' : '';
    else if (fa.role === 'sell') label = 'VERKAUF ' + fa.sellable + ' ab ' + priceOf(f);
    else label = 'KAUF ' + fa.wants + ' bis ' + priceOf(f);
    txt(ctx, label, c.x, labelY, 34, PAL.fac[f]);
    return;
  }
  if (ph === 'ernte') renderInactivePad(ctx, f, 'Ernte läuft – Pause');
  else if (ph === 'bilanz') renderInactivePad(ctx, f, fa.hungry ? 'HUNGER!' : 'Abrechnung …');
  else renderInactivePad(ctx, f, 'Gleich geht’s los');
}

// --- Mitte: Phasen-Anzeigen ------------------------------------------------------------------------------

function renderAuctionBoard(ctx) {
  const res = STATE.auctionRes;
  const info = RES_INFO[res];
  ctx.save();
  ctx.fillStyle = '#000000';
  ctx.globalAlpha = 0.72;
  ctx.fillRect(425, 170, 1070, 860);
  ctx.restore();
  txt(ctx, 'AUKTION: ' + info.label, MAP.cx, 238, 62, PAL.res[res]);
  renderIcon(ctx, res, MAP.cx - 420, 218, 26, PAL.res[res], 4);
  renderIcon(ctx, res, MAP.cx + 420, 218, 26, PAL.res[res], 4);
  const x0 = 560;
  const w = 860;
  const rowY = (f) => 360 + f * 140;
  // Preisachse
  ctx.save();
  ctx.strokeStyle = PAL.hudDim;
  ctx.lineWidth = 2;
  for (let k = 0; k <= 4; k++) {
    const price = info.min + (k / 4) * (info.max - info.min);
    const x = priceToX(price, x0, w);
    ctx.globalAlpha = 0.4;
    ctx.beginPath();
    ctx.moveTo(x, 300);
    ctx.lineTo(x, 860);
    ctx.stroke();
    ctx.globalAlpha = 1;
    txt(ctx, String(Math.round(price)), x, 900, 28, PAL.hudDim);
  }
  // Depot-/Kurslinien
  const vline = (price, color, label, y) => {
    const x = priceToX(price, x0, w);
    ctx.strokeStyle = color;
    ctx.lineWidth = 4;
    ctx.setLineDash([16, 10]);
    ctx.beginPath();
    ctx.moveTo(x, 290);
    ctx.lineTo(x, 870);
    ctx.stroke();
    ctx.setLineDash([]);
    txt(ctx, label, x, y, 32, color);
  };
  if (res === 'kristall') {
    vline(STATE.kurs, PAL.kurs, 'Mutterschiff zahlt ' + STATE.kurs, 290);
  } else {
    vline(STATE.depotBuy, PAL.depot, 'Depot kauft ' + STATE.depotBuy, 290);
    vline(STATE.depotSell, PAL.depot, 'Depot verkauft ' + STATE.depotSell + (STATE.depot[res] > 0 ? '' : ' (leer)'), 950);
  }
  ctx.restore();
  // Zeilen je Kolonie
  for (let f = 0; f < 4; f++) {
    const fa = factions[f];
    const y = rowY(f);
    ctx.save();
    ctx.strokeStyle = PAL.facDim[f];
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(x0, y);
    ctx.lineTo(x0 + w, y);
    ctx.stroke();
    ctx.restore();
    let role = 'schaut zu';
    if (fa.role === 'sell') role = 'verkauft ' + fa.sellable;
    else if (fa.role === 'buy') role = 'kauft ' + fa.wants;
    else if (fa.role === 'done') role = 'fertig';
    txt(ctx, fa.name + ' · ' + role, x0 - 110, y - 32, 30, fa.role === 'idle' || fa.role === 'done' ? PAL.facDim[f] : PAL.fac[f], 'left');
    if (fa.role === 'sell' || fa.role === 'buy') {
      const price = priceOf(f);
      const x = priceToX(price, x0, w);
      const s = 26;
      ctx.save();
      ctx.fillStyle = PAL.fac[f];
      ctx.shadowBlur = 18;
      ctx.shadowColor = PAL.fac[f];
      ctx.beginPath();
      if (fa.role === 'sell') {
        ctx.moveTo(x - s, y - s);
        ctx.lineTo(x + s, y - s);
        ctx.lineTo(x, y + s * 0.6);
      } else {
        ctx.moveTo(x - s, y + s);
        ctx.lineTo(x + s, y + s);
        ctx.lineTo(x, y - s * 0.6);
      }
      ctx.closePath();
      ctx.fill();
      ctx.restore();
      txt(ctx, String(price), x, y + 66, 40, PAL.fac[f]);
    }
  }
  // letzter Handel: Blitz zwischen den Zeilen
  const lt = STATE.lastTrade;
  if (lt) {
    ctx.save();
    ctx.globalAlpha = Math.min(1, lt.t * 1.5);
    ctx.strokeStyle = PAL.flash;
    ctx.lineWidth = 5;
    const x = priceToX(lt.price, x0, w);
    const ya = lt.seller >= 0 ? rowY(lt.seller) : 960;
    const yb = lt.buyer >= 0 ? rowY(lt.buyer) : lt.buyer === -1 ? 960 : 290;
    ctx.beginPath();
    ctx.moveTo(x, ya);
    for (let k = 1; k <= 6; k++) ctx.lineTo(x + (k % 2 ? 16 : -16), ya + ((yb - ya) * k) / 6);
    ctx.stroke();
    ctx.restore();
    txt(ctx, 'HANDEL! ' + lt.price + ' Taler', MAP.cx, 1000, 44, PAL.flash);
  } else {
    txt(ctx, 'Verkäufer: Laser nach links · Käufer: nach rechts', MAP.cx, 1000, 34, PAL.hudDim);
  }
}

function renderEventBanner(ctx) {
  let ev = null;
  STATE.events.forEach((e) => {
    if (STATE.phaseTime >= e.at) ev = e;
  });
  if (!ev) return;
  const age = STATE.phaseTime - ev.at;
  // Meteor im Anflug
  if (ev.kind === 'meteor' && !ev.impacted && fields[ev.field]) {
    const fd = fields[ev.field];
    const k = clamp(age / 0.8, 0, 1);
    const mx = fd.x + 600 * (1 - k);
    const my = fd.y - 700 * (1 - k);
    ctx.save();
    ctx.strokeStyle = PAL.warn;
    ctx.lineWidth = 10;
    ctx.shadowBlur = 30;
    ctx.shadowColor = PAL.warn;
    ctx.beginPath();
    ctx.moveTo(mx, my);
    ctx.lineTo(mx + 160, my - 190);
    ctx.stroke();
    ctx.restore();
  }
  const s = 1 + Math.max(0, 0.3 - age) * 1.5;
  ctx.save();
  ctx.fillStyle = '#000000';
  ctx.globalAlpha = 0.75;
  ctx.fillRect(470, 440, 980, 200);
  ctx.globalAlpha = 1;
  ctx.strokeStyle = PAL.warn;
  ctx.lineWidth = 3;
  ctx.strokeRect(470, 440, 980, 200);
  ctx.translate(MAP.cx, 520);
  ctx.scale(s, s);
  renderTextDropShadow({ ctx, text: ev.title, x: 0, y: 0, fontSize: '64px', lineHeight: 64, fillStyle: PAL.warn, dropDistX: 4, dropDistY: 4 });
  ctx.restore();
  txt(ctx, ev.text, MAP.cx, 595, 34, PAL.sub);
}

function renderBilanzBoard(ctx) {
  ctx.save();
  ctx.fillStyle = '#000000';
  ctx.globalAlpha = 0.78;
  ctx.fillRect(425, 260, 1070, 560);
  ctx.restore();
  txt(ctx, 'Jede Kolonie isst ' + foodNeed() + ' Algen', MAP.cx, 340, 54, PAL.res.algen);
  STATE.bilanzRows.forEach((row, i) => {
    txt(ctx, row.text, MAP.cx, 430 + i * 72, 32, row.color);
  });
  txt(ctx, STATE.bilanzHeadline, MAP.cx, 760, 48, STATE.bilanzHeadline.indexOf('satt') >= 0 ? PAL.good : PAL.bad);
}

function renderIntroBoard(ctx) {
  const s = 1 + Math.max(0, 0.4 - STATE.phaseTime) * 1.5;
  ctx.save();
  ctx.fillStyle = '#000000';
  ctx.globalAlpha = 0.6;
  ctx.fillRect(425, 380, 1070, 300);
  ctx.restore();
  ctx.save();
  ctx.translate(MAP.cx, 540);
  ctx.scale(s, s);
  renderTextDropShadow({ ctx, text: 'RUNDE ' + STATE.round, x: 0, y: 0, fontSize: '150px', lineHeight: 150, fillStyle: PAL.title, dropDistX: 6, dropDistY: 6 });
  ctx.restore();
  txt(ctx, ROUND_NEWS[STATE.round] || 'Weiter so, Kolonisten!', MAP.cx, 630, 40, PAL.sub);
}

function renderLandBoard(ctx) {
  const fd = fields[STATE.claimField];
  if (fd) {
    const ty = fd.y < MAP.cy ? fd.y + HEX_R + 80 : fd.y - HEX_R - 50;
    txt(ctx, TERRAIN_NAME[fd.terrain], fd.x, ty, 40, PAL.res[fd.terrain]);
  }
  const info = 'Feld ' + Math.min(SETTINGS.fieldsPerRound, STATE.claimIndex + 1) + '/' + SETTINGS.fieldsPerRound;
  txt(ctx, STATE.claimDone ? STATE.claimResult : info + ' – wer zuerst voll ist!', MAP.cx, 1010, 38, STATE.claimDone ? PAL.hud : PAL.sub);
}

function renderTopBar(ctx) {
  ctx.save();
  ctx.fillStyle = '#000000';
  ctx.globalAlpha = 0.8;
  ctx.fillRect(0, 0, W, 104);
  ctx.restore();
  txt(ctx, 'RUNDE ' + STATE.round + '/' + SETTINGS.rounds, 30, 66, 46, PAL.hud, 'left');
  renderTextDropShadow({
    ctx,
    text: PHASE_LABEL[STATE.phase] || '',
    x: MAP.cx,
    y: 64,
    fontSize: '62px',
    lineHeight: 62,
    fillStyle: PAL.title,
    dropDistX: 4,
    dropDistY: 4,
  });
  const left = Math.max(0, STATE.phaseDuration - STATE.phaseTime);
  const low = left <= 3 && STATE.phase !== 'intro';
  txt(ctx, Math.ceil(left) + ' s', W - 30, 72, low && Math.sin(STATE.time * 10) > 0 ? 78 : 66, low ? PAL.warn : PAL.hud, 'right');
  // Phasen-Leiste (5 Segmente)
  const sx0 = 560;
  const sw = 800;
  const seg = sw / PHASES.length;
  const cur = PHASES.indexOf(STATE.phase);
  ctx.save();
  PHASES.forEach((ph, i) => {
    const x = sx0 + i * seg + 4;
    ctx.fillStyle = PAL.hudDim;
    ctx.globalAlpha = 0.5;
    ctx.fillRect(x, 88, seg - 8, 10);
    ctx.globalAlpha = 1;
    let fill = 0;
    if (i < cur) fill = 1;
    else if (i === cur) fill = clamp(STATE.phaseTime / Math.max(0.01, STATE.phaseDuration), 0, 1);
    ctx.fillStyle = i === cur ? PAL.title : PAL.hud;
    ctx.fillRect(x, 88, (seg - 8) * fill, 10);
  });
  ctx.restore();
  // Hinweiszeile über dem Planeten
  txt(ctx, PHASE_HELP[STATE.phase] || '', MAP.cx, 150, 38, PAL.sub);
}

function renderBottomLine(ctx) {
  if (STATE.phase === 'auktion' || STATE.phase === 'land') return;
  txt(ctx, 'Gemeinsamer Kolonie-Wert: ' + colonyValue(), MAP.cx, 1062, 36, PAL.hud);
}

function renderFlash(ctx, dt) {
  if (STATE.flash <= 0) return;
  ctx.save();
  ctx.globalAlpha = Math.min(0.3, STATE.flash * 0.4);
  ctx.fillStyle = PAL.flash;
  ctx.fillRect(420, 104, 1080, H - 104); // nur über der Mitte, nie über den Pads
  ctx.restore();
  STATE.flash -= dt;
}

function renderGame(ctx, dt) {
  renderStars(ctx);
  ctx.save();
  if (STATE.shake > 0) ctx.translate((Math.random() - 0.5) * STATE.shake, (Math.random() - 0.5) * STATE.shake);
  renderPlanet(ctx, STATE.phase === 'auktion' ? 0.5 : 1);
  renderFields(ctx);
  if (STATE.phase === 'land') renderLandBoard(ctx);
  else if (STATE.phase === 'ernte') renderEventBanner(ctx);
  else if (STATE.phase === 'auktion') renderAuctionBoard(ctx);
  else if (STATE.phase === 'bilanz') renderBilanzBoard(ctx);
  else if (STATE.phase === 'intro') renderIntroBoard(ctx);
  renderTokens(ctx);
  renderParticles(ctx);
  ctx.restore();
  renderFlash(ctx, dt);
  for (let f = 0; f < 4; f++) renderPanel(ctx, f);
  renderTopBar(ctx);
  renderBottomLine(ctx);
}

// ---------------------------------------------------------------------------------------------------------
// Szenen
// ---------------------------------------------------------------------------------------------------------

function ensureTitleZones() {
  if (titleZones) return;
  titleZones = guiZoneSplit({ columns: 2, rows: 2, visible: false, smoothing: 4 });
}

function handleTitle(grid, dt, ctx) {
  renderStars(ctx);
  ensurePlanet();
  if (planetCanvas) {
    ctx.save();
    ctx.translate(MAP.cx, 650);
    ctx.rotate(STATE.time * 0.04);
    ctx.globalAlpha = 0.85;
    ctx.drawImage(planetCanvas, -MAP.r * 0.72, -MAP.r * 0.72, MAP.r * 1.44, MAP.r * 1.44);
    ctx.restore();
  }
  renderTextDropShadow({ ctx, text: 'Kolonie-Auktion', x: W / 2, y: 190, fontSize: '150px', fillStyle: PAL.title });
  txt(ctx, 'Vier Kolonien. Ein Fraktal-Planet. Ein Markt.', W / 2, 275, 50, PAL.sub);
  // Ecken = Kolonien, live Laser-Anteil je Saalviertel
  ensureTitleZones();
  titleZones.handle(grid, dt);
  const shares = titleZones.getShares();
  const pos = [
    { x: 24, y: 120, a: 'left' },
    { x: W - 24, y: 120, a: 'right' },
    { x: 24, y: 1050, a: 'left' },
    { x: W - 24, y: 1050, a: 'right' },
  ];
  for (let f = 0; f < 4; f++) {
    const sh = Math.round((shares[f] || 0) * 100);
    txt(ctx, f + 1 + ' ' + FACTION_DEFS[f].name + ' ' + sh + '%', pos[f].x, pos[f].y, 44, PAL.fac[f], pos[f].a);
    txt(ctx, FACTION_DEFS[f].motto, pos[f].x, pos[f].y + (f < 2 ? 44 : -52), 28, PAL.facMid[f], pos[f].a);
  }
  // Start-Button auf schwarzem Grund
  ctx.save();
  ctx.fillStyle = '#000000';
  ctx.beginPath();
  ctx.arc(W / 2, 650, 140, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
  if (!startButton) {
    startButton = guiFillButton({
      label: 'START',
      posX: W / 2,
      posY: 650,
      radius: 115,
      edges: 6,
      speedUp: 45,
      speedDown: 20,
      activeValue: 85,
      lineWidth: 4,
      normalColor: PAL.start[0],
      growColor: PAL.start[1],
      activeColor: PAL.start[2],
      onEnterActive: () => startGame(),
    });
  }
  startButton.handle(grid, dt);
  util.renderText({
    ctx,
    text: 'Jede Ecke ist eine Kolonie – leuchtet auf das Pult in EURER Ecke.\nLand · Ausbau · Produktion · Auktion · Bilanz – 6 Runden, alle gleichzeitig.',
    x: W / 2,
    y: 1000,
    fontSize: '34px',
    lineHeight: 46,
    fillStyle: PAL.hudDim,
  });
  if (keyEdge('Space')) startGame();
  highscore.renderHighAndLowScores(ctx);
}

function handleGame(grid, dt, ctx) {
  for (let i = 0; i < 4; i++) if (keyEdge('Digit' + (i + 1))) STATE.testFaction = i;
  if (keyEdge('KeyN')) nextPhase();
  if (STATE.scene === 'game') updatePhase(grid, dt);
  updateParticles(dt);
  if (STATE.scene !== 'game') return; // endGame hat gewechselt – Game-Over zeichnet ab dem nächsten Frame
  renderGame(ctx, dt);
}

function handleGameOver(grid, dt, ctx) {
  updateParticles(dt);
  renderStars(ctx);
  if (Math.random() < dt * 3) addParticles(400 + Math.random() * 1120, 200 + Math.random() * 300, 20, PAL.fac[STATE.winner], 260);
  renderParticles(ctx);
  renderTextDropShadow({ ctx, text: 'Kolonie-Bilanz', x: W / 2, y: 150, fontSize: '120px', fillStyle: PAL.title });
  const win = factions[STATE.winner];
  txt(ctx, 'Sieger: ' + win.name + ' – ' + win.motto, W / 2, 245, 52, PAL.fac[STATE.winner]);
  STATE.ranking.forEach((r, i) => {
    txt(ctx, i + 1 + '. ' + factions[r.f].name + '  ' + r.value, W / 2, 330 + i * 52, 44, i === 0 ? PAL.fac[r.f] : PAL.facMid[r.f]);
  });
  txt(
    ctx,
    'Gemeinsamer Kolonie-Wert: ' + STATE.finalColony + (STATE.newHighscore ? '  NEU!' : ''),
    W / 2,
    570,
    50,
    PAL.good
  );
  util.renderText({
    ctx,
    text:
      STATS.trades + ' Handel · ' + STATS.claimed + ' Felder · ' + STATS.allFedRounds + '× alle satt\n' +
      STATS.hungerCount + '× Hunger · ' + STATS.meteors + ' Meteore · ' + STATS.blackouts + ' Stromausfälle',
    x: W / 2,
    y: 650,
    fontSize: '34px',
    lineHeight: 48,
    fillStyle: PAL.sub,
  });
  highscore.renderHighAndLowScores(ctx);
  if (STATE.sceneTime > SETTINGS.againDelay) {
    ctx.save();
    ctx.fillStyle = '#000000';
    ctx.beginPath();
    ctx.arc(W / 2, 880, 120, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
    if (!againButton) {
      againButton = guiFillButton({
        label: 'NOCHMAL',
        posX: W / 2,
        posY: 880,
        radius: 100,
        edges: 6,
        speedUp: 45,
        speedDown: 20,
        activeValue: 85,
        lineWidth: 4,
        normalColor: PAL.start[0],
        growColor: PAL.start[1],
        activeColor: PAL.start[2],
        onEnterActive: () => startGame(),
      });
    }
    againButton.handle(grid, dt);
    if (keyEdge('Space')) startGame();
  } else {
    keyEdge('Space');
  }
}

// ---------------------------------------------------------------------------------------------------------
// Export
// ---------------------------------------------------------------------------------------------------------

export default {
  name: 'Kolonie-Auktion',
  description: `
  Vier Kolonien landen auf einem Fraktal-Planeten.
  Jede Ecke des Saals ist eine Kolonie – leuchtet auf das Pult in EURER Ecke.

  LANDNAHME: Ein Feld blinkt – wer sein Pad zuerst füllt, bekommt es.
  AUSBAU: Algen, Energie oder Kristall? Im eigenen Pad abstimmen.
  PRODUKTION: Zurücklehnen. Meteore, Sonnenstürme, Piraten …
  AUKTION: Euer Laser ist euer Preis. Kauf trifft Verkauf = Handel!

  Wer am Ende am meisten wert ist, gewinnt.
  Aber hungert eine Kolonie, verliert der ganze Planet.
  `,
  image: 'media/img/gametitles/laser-mandelbrot-###4###.png',

  init: function () {
    resetAll();
  },

  handle: function (grid, elapsed) {
    const dt = Math.min(elapsed || 0, 0.1);
    const ctx = MasterCanvas.get2dContext();
    ensurePalette();
    STATE.time += dt;
    STATE.sceneTime += dt;
    if (!fields.length) generateWorld(); // falls ohne init() gestartet

    switch (STATE.scene) {
      case 'title':
        handleTitle(grid, dt, ctx);
        break;
      case 'game':
        handleGame(grid, dt, ctx);
        break;
      case 'gameover':
        handleGameOver(grid, dt, ctx);
        break;
      default:
        setScene('title');
    }
  },

  stop: function () {
    stopMusic();
  },
};
