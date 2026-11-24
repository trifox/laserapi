# AGENTS.md – Laser-Spiele-Entwicklung

Spiele für **1–50 Leute gleichzeitig mit Laserpointern** auf einer Projektion. Eine Kamera welche den bildschirm aufnimmt dient als input, ihr bild wird transformiert und auf ein raster mit farb abstandsfunktion zur erkennung der Laserpunkte.

## Arbeitsbereich
- die original quellcodes im setups ordner bis 022-fractal-bakery nicht anfassen oder veraendern die sind speciel da sie komplett ohne ki erzeugt wurden
- Nur `src/js/setups/`: Spiele als `game-NNN-<name>.js`, Eingabe-Bausteine in `gui/`.
- Engine nicht ändern (`LaserApi.js`, `view.js`-Loop, `MasterCanvas.js`, `LaserApiConfig.js`, `util.js`, `math.js`,
  `gpuTools.js`, Webpack). Ausnahme: Spiel in `src/js/view.js` registrieren:  `new GameWrapper(require('./setups/game-NNN-name').default),`
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
- `gameState`: Start ⇄ Spiel ⇄ Game-Over; `init()` setzt alles zurück. Start-`fillButton` OHNE `keyCode` (sonst ignoriert er die Laser), Leertaste separat abfragen (`pressedKeys['Space']`) [laser-chris: lol hier ist ja was gehoerig schiefgegangen, unbedingt fixen],
  Game-Over mit Statistik. Balancing-Werte im `DIFFICULTY`-Objekt oben. Vorlage: `game-022-fractal-bakery.js`.
- immer highscore.js interface nutzen
-- mehrere teams in wert codieren, kann beliebig viele eigenschaften speichern, ein sortierfeld
-- sie pflegt automatisch high und low score auch wenn es nicht sinnvoll ist, aber der schlechteste zu sein ist manchmal genauso herausfordernd, wie etwa bei einem abraeumspiel, dort kann ja eine maximal und eine minimalzahl erreicht wird, etwa wenn anzahl gleichzeitig weggenommener ja punktzahl bestimmt, man kann also feld auf 2 arten abraeumen mit maximal punkten oder weniger, ersma nur geschwafel hier aber das ist sozusagen der grund mit high und low
-- also: es wird keine liste per team/region whatever anglegt
-- api wird weiterentwickelt aktuell noch nicht persistiert


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
- Kopfkommentar mit Name + Regeln; Kommentare und Texte auf **Deutsch**. Prettier: 2 Spaces, Single Quotes, Semikolons. und dem verwendeten llm modell.
- Arrays, aus denen in `handle()` entfernt wird, mit `.slice()` iterieren.
- immer die moderne `` string variante nutzen, nicht anfangen mit + und /n shit zu arbeiten, das muss ich alles nun anpassen, da wollte die ki wohl nur token erzeugen, also bleib bei kompakter schreibweise, aber variablen und kommentare natuerlich schoen sprechend
- nutze immer highscore.js es ist das interface was fuer highscore funktionalitaet genutzt werden soll
-- special sachen wie mehrere teams muessen halt als entry codiert werden, wir aber nur high/lowscore listen geben nicht noch extra listen fuer teams
-- persistens ist aktuell noch nicht implementiert, wird aber impl des interfaces dann bald machen


## graphify
This project has a knowledge graph at graphify-out/ with god nodes, community structure, and cross-file relationships.

Rules:

When graphify-out/graph.json exists, run graphify query "<question>" before your first grep, search or source-file read for a codebase question, and put this rule in every subagent prompt that explores code. Read raw files only for lines the graph or an earlier read already located. Use graphify path "<A>" "<B>" for relationships and graphify explain "<concept>" for focused concepts. When the answer is under a Markdown heading, graphify section "<heading>" prints that section's text, so the .md need not be opened. These return a scoped subgraph, usually much smaller than GRAPH_REPORT.md or raw grep output.

If graphify-out/wiki/index.md exists, use it for broad navigation instead of raw source browsing.

Read graphify-out/GRAPH_REPORT.md only for broad architecture review or when query/path/explain do not surface enough context.

After modifying code, run graphify update . to keep the graph current (AST-only, no API cost).

A committed graphify-out/graph.json is rewritten whole on every build, so a large diff to it in a pull request is expected. Do not flag it as churn or suggest skipping the graph rebuild or its hooks.

## Engine Status remarks

Engine-Pipeline (vor handle(grid, elapsed))

Aktueller Fokus: nur Spiele entwickeln. Die Engine (view.js ausser Spielregistrierung, LaserApi.js, game-000000000-lowpassfilter.js, game-wrapper.js, CanvasVideo.js, MasterCanvas.js) wird nicht angefasst. Die unten gelisteten Engine-Fehler existieren aktuell und werden in Zukunft gefixt – nicht jetzt nebenbei reparieren, sondern in Spielen darum herum bauen.

Ablauf pro Frame (view.js frameHandler)
elapsed = Sekunden seit letztem Frame (ungeclampt).
animationHandler() liest HTML-Regler in laserConfig, speichert alles in localStorage.
Canvas schwarz; bei debugVideo Kamerabild drüber.
LaserApi.getFine(video) – ein kombinierter GPU-Kernel: Blur → Sharpen → Perspektiv-Entzerrung (4 Ecken, Hermite) → Farbmatrix → RGB-Abstand zu testColor/testColor2 < threshold → Downscale auf gridResolution² Zellen (Pixel-Zählung).
Lowpassfilter.handle() – Zelle an, wenn sie oder ein 4er-Nachbar leuchtet (+100/s, −10/s), Ausgabe nochmals um Nachbarn dilatiert, binär 0/1.
Spielwechsel: stop() alt, init() neu, dann Intro über 1000 Frames (kein handle()).
games[i].handle(grid, elapsed) in try/catch.
Für Spiele heisst das: grid ist binär (0/1), zeilenweise, y=0 oben. Ein Laserpunkt erscheint als verbreitertes Kreuz mit ~100 ms Nachleuchten – „Flächenanteil“ misst also verbreiterte Punkte, nicht echte Laserfläche.

Bekannte Engine-Fehler (aktuell vorhanden, Fix später)
In Spielen berücksichtigen:

elapsed ist ungeclampt (erster Frame = Zeit seit Seitenstart, Tab-Wechsel = riesig) → in jedem Spiel const dt = Math.min(elapsed, 0.1);.
Aus localStorage wiederhergestelltes Spiel bekommt beim Start kein init() (nur Spiel 0 wird initialisiert, lastGameIndex = -1) → Spielzustand im Modul so vorbelegen, dass handle() auch ohne init() nicht crasht.
Debug-Tasten in view.js (d v g r m h t f F s, PageUp/PageDown/Home) feuern zusätzlich zu Spieltasten → diese Tasten in Spielen nicht belegen. (Bekannte Kollision: game-049 nutzt T für Teammodus.)
Eine einmal geworfene Exception bleibt als rote ERROR-Zeile bis zum Reload stehen (error wird nie zurückgesetzt) → Fehler in Spielen vermeiden, nicht auf Neustart verlassen.
Intro-Dauer zählt Frames statt Sekunden (60 Hz ≈ 17 s).
Nur Engine-intern (für spätere Fixes):

 