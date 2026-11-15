# AGENTS.md – Laser-Spiele-Entwicklung

Spiele für **10–50 Leute gleichzeitig mit Laserpointern** auf einer Projektion. Eine Kamera liefert pro Frame ein
grobes, verrauschtes Grid der Laserpunkte.

## Arbeitsbereich
- die original quellcodes im setups ordner bis 022-fractal-bakery nicht anfassen oder veraendern die sind speciel da sie komplett ohne ki erzeugt wurden
- Nur `src/js/setups/`: Spiele als `game-NNN-<name>.js`, Eingabe-Bausteine in `gui/`.
- Engine nicht ändern (`LaserApi.js`, `view.js`-Loop, `MasterCanvas.js`, `LaserApiConfig.js`, `util.js`, `math.js`,
  `gpuTools.js`, Webpack). Ausnahme: Spiel in `src/js/view.js` registrieren:
  `new GameWrapper(require('./setups/game-NNN-name').default),`
- Bestehende Spiele/GUI-Komponenten nur auf Anfrage ändern. Neue npm-Pakete nur nach Rückfrage (vorhanden: `gpu.js`, `p2`, `tone`).
- Prüfen: `npm run dev`, Spiel in der Selectbox wählen. Keine Tests/Linter; Fehler in `handle()` erscheinen rot oben links.

## Laufzeitmodell

- Pro Frame: Canvas (1920×1080) wird schwarz gelöscht, dann `game.handle(grid, elapsed)` – alles jeden Frame neu zeichnen.
- `grid`: flaches, quadratisches Array, Wert `> 0` = Laser. Auflösung ist **zur Laufzeit änderbar** – nie mit Zellzahlen rechnen.
- Spielwechsel: `stop()` alt → `init()` neu → Intro-Screen (ohne `handle()`).
- `elapsed` in Sekunden; Bewegung damit skalieren und begrenzen (`Math.min(elapsed, 0.1)`).

## Grundregel: Eingabe nur über GUI-Komponenten

Spielcode liest **nie** `grid[...]` (keine Scan-Schleifen) – er reicht `grid` an `component.handle(grid, elapsed)`
weiter und nutzt Callbacks/Getter. Eigenes Verhalten per **Handle-Wrapping**:

```js
const enemy = guiPixelFillButton({ /* ... */ onEnterActive: () => removeItemFromArray(enemies, enemy) });
const handleOriginal = enemy.handle;
enemy.handle = (grid, elapsed) => {
  enemy.setY(enemy.getY() + speed * elapsed); // Bewegung, Sprite, Farben per Setter …
  handleOriginal(grid, elapsed);              // Treffer + Zeichnen
};
```

Fehlt eine Eingabe-Art: neue generische Komponente in `gui/` (Factory mit Options-Objekt, `handle(grid, elapsed)`,
Getter/Setter wie die anderen, nur Bounding-Box scannen, am Rand clampen, über Flächenanteile auflösungsunabhängig)
und in die Tabelle eintragen. Ausnahme: Ganz-Grid-Effekte per `gpu.js`-Kernel (z. B. Fire/Fade).

## GUI-Library `src/js/setups/gui/`

Factory → Objekt mit `handle(grid, elapsed)` (jeden Frame: prüft **und** zeichnet), Getter/Setter `X`, `Y`, `Radius`,
`Color`, `Label`. Details in der jeweiligen Datei.

| Komponente | Zweck |
|---|---|
| `fillButton` | n-Eck füllt sich bei irgendeinem Laser (binär); `onEnterActive`. Standard für Menüs/Start. **Achtung:** mit `keyCode` reagiert er NUR noch auf die Taste, nicht mehr auf Laser |
| `pixelFillButton` | Füllrate ∝ bedecktem Flächenanteil (`getFillPercent()`, `fullPercent`) – mehr Laser, mehr Wirkung |
| `flipButton` | sofortiges `onEnter`/`onExit`, kein Füllen |
| `followCircle` | Objekt folgt dem Laser-Schwerpunkt oder flieht (Figuren, Schläger, Herden) |
| `rangeSlider`, `switch` | Regler bzw. Umschalter |
| `pixelCount1D/2D/4D`, `pixelCountButton` | Anteil/Schwerpunkt messen, z. B. Abstimmungen (löst nichts aus) |
| `aimTurret` | Geschütz zielt auf den Schwerpunkt aller Laser im Scanbereich, feuert per `onShoot` alle `fireInterval` s; `getFocus()` (0..1, wie eng die Laser beieinander sind), `getSpread`, `getTargetX/Y`; Pfeiltasten via `keyCodes` |
| `paintLayer` | Mal-/Belichtungsschicht: Wert 0..1 pro Zelle; `getValueAt`, `getCoverage(InCircle)`, `getAverageInCircle`, `getLitInCircle`, `setValueAt`/`addInCircle`; Modus `'mask'` oder `'paint'` |

Weitere Helfer: `repellAll`, `checkBorderAndSlowDown` aus `game-017-thehorde.js`.

## Read-only Imports

- `require('../LaserApiConfig.js').default` – `testColor` (`[r,g,b]`), `pressedKeys[code]`, `canvasResolution`.
- `require('../MasterCanvas').default` – `get2dContext()`; Transforms in `ctx.save()/restore()`, nie `clear()`.
- `../util.js` – `drawNgon`, `renderText*`, `getRgbSpreadHex(testColor, hueShift, sat, val)`, `removeItemFromArray`.
- `../math.js` – `lerp`, `slerp`, Vektorhelfer.
- Sounds: `import snd from '../../../public/media/<datei>.wav'; new Audio(snd).play();` – Musik in `stop()` beenden.

## Spielaufbau

- `export default { name, description, image, init(), handle(grid, elapsed), stop() }`; `description` deutscher
  Intro-Text, `image` aus `public/media/img/gametitles/` (`###N###` = Zufallsvariante 2…N+1).
- `gameState`: Start ⇄ Spiel ⇄ Game-Over; `init()` setzt alles zurück. Start-`fillButton` OHNE `keyCode` (sonst ignoriert er die Laser), Leertaste separat abfragen (`pressedKeys['Space']`),
  Game-Over mit Statistik. Balancing-Werte im `DIFFICULTY`-Objekt oben. Vorlage: `game-022-fractal-bakery.js`.

## Design-Regeln

- Große Ziele (Radius ≥ 50px), große Schrift (HUD 40–50px, Titel 150px), keine Feinmotorik.
- Treffer über Zeit akkumulieren (Füllen mit Abbau), nie auf Einzelframes reagieren.
- Wildes Herumleuchten bestrafen („gute“ Objekte); Teamwork über Flächenanteil belohnen (gedeckelt).
- Schwierigkeit über Zeit/Level steigern.
- Farben aus `laserConfig.testColor` ableiten, nie in Laserfarbe zeichnen (Kamera hält es sonst für Laser).
- Ohne Laser testbar (Tastatur via `pressedKeys`).
- Spiellogik < ~2 ms/Frame; Teures einmal in Offscreen-Canvas vorrendern.

## Code-Stil

- Wie bestehende Spiele: `import`/`require(...).default` gemischt, modul-globaler Zustand.
- Kopfkommentar mit Name + Regeln; Kommentare und Texte auf **Deutsch**. Prettier: 2 Spaces, Single Quotes, Semikolons.
- Arrays, aus denen in `handle()` entfernt wird, mit `.slice()` iterieren.
