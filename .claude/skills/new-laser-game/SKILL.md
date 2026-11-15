---
name: new-laser-game
description: Baut ein neues, komplettes Laser-Spiel (game-NNN-<name>.js) für viele gleichzeitige Spieler mit Levelanstieg und starker Optik. Entwirft zwei verschiedene Spielideen (je mit einem zufälligen Genre als Impuls) und lässt den Nutzer wählen. Das Argument ist ein freier Inspirationstext (Thema, Stichwörter, Stimmung). Verwenden, wenn ein neues Laserpointer-Spiel erstellt werden soll.
argument-hint: <Inspirationstext, z. B. "Garten Pixel Wüste Sonne Keks" oder "Tower Defense im Weltall">
---

# Neues Laser-Spiel bauen

Inspiration vom Aufruf: **$ARGUMENTS**

Ziel: ein fertiges, spielbares Spiel in `src/js/setups/`, das 10–50 Leute gleichzeitig mit Laserpointern
auf einer Projektion spielen. Alle Regeln aus `AGENTS.md` gelten verbindlich – dieser Skill ergänzt sie nur.

## 0. Inspiration klären

- Ist `$ARGUMENTS` leer, hol dir Inspiration mit `bash .claude/skills/random-words/random-words.sh 4 -s ' '`.
- **Genre-Impuls:** Hol dir immer zwei verschiedene Spielgenres mit Beschreibung – eins pro Konzept (siehe 2.):
  `bash .claude/skills/game-genres/game-genres.sh 2 -d`
  Nennt `$ARGUMENTS` schon ein Genre (z. B. „Tower Defense“, „Jump and Run“), gilt es für Konzept A,
  und nur für Konzept B wird gezogen (`game-genres.sh 1 -d`). Passt ein gezogenes Genre gar nicht zur Laser-Steuerung
  oder doppelt sich mit einem bestehenden Spiel, einmal neu ziehen.
- Nimm Text und Genre als **Inspiration, nicht als Pflichtenheft**: Thema, Stimmung, Bildwelt, Wortspiele aus dem
  Text, Spielprinzip aus dem Genre – übersetzt auf viele gleichzeitige Laser (z. B. Echtzeitstrategie → Laser
  markieren Sammelpunkte, Einheiten folgen; Rhythmusspiel → alle treffen gemeinsam Ziele im Takt).
  Mehrere unzusammenhängende Wörter dürfen zu *einer* stimmigen Spielidee verschmelzen.
- Kein Nachbau eines existierenden kommerziellen Spiels (Name, Figuren, Look) – eigene Idee.

## 1. Bestand lesen (kurz, gezielt)

1. `AGENTS.md` (Regeln, GUI-Tabelle, Design-Regeln).
2. Vorlage `src/js/setups/game-022-fractal-bakery.js` (aktueller Stil: Zustände, DIFFICULTY, HUD, Game-Over).
3. Die GUI-Komponenten in `src/js/setups/gui/`, die du nutzen willst (Optionen/Getter stehen in der Datei).
4. Nächste freie Nummer: `ls src/js/setups/ | grep -o 'game-[0-9]*' | sort | tail -1` → +1.
5. Kurz die Namen bestehender Spiele ansehen, damit sich die Idee nicht mit einem vorhandenen doppelt.

## 2. Zwei Konzepte entwerfen und den Nutzer wählen lassen

Entwirf aus derselben Inspiration **zwei deutlich verschiedene Spiele** – nicht zwei Varianten derselben Idee.
Konzept A baut auf dem ersten gezogenen Genre auf, Konzept B auf dem zweiten (siehe 0.).
Sie sollen sich in der Kernmechanik bzw. Rolle der Laser unterscheiden (z. B. Abschiessen vs. Bauen/Malen,
Zielen über Schwerpunkt vs. Flächen abdecken, Reaktion vs. Kooperation/Rätsel) und dürfen sich nicht mit
bestehenden Spielen doppeln.

Pro Konzept 5–8 Zeilen: Name (deutsch, griffig), Genre (und wie es auf Laser übertragen wird), Kernmechanik, Rolle der Laser, Gewinn/Verlust,
Levelkurve (was kommt pro Level neu), Look, genutzte bzw. neu nötige GUI-Komponenten.

Zeige beide Konzepte kurz im Chat und frage dann mit dem **AskUserQuestion-Tool**, welches umgesetzt werden soll:
- eine Frage, zwei Optionen; `label` = Spielname, `description` = Genre + Kernidee in einem Satz,
  `preview` = das Konzept in Kurzform (Mechanik, Laser-Rolle, Level, Look), damit man es nebeneinander vergleichen kann
- keine Empfehlung aufdrängen; „Other“ bleibt für eigene Wünsche/Mischformen
- **Erst nach der Antwort** weitermachen und nur das gewählte (ggf. angepasste) Konzept umsetzen.

Jedes der beiden Konzepte muss alle drei Säulen erfüllen:

### A. Mehrspieler (10–50 Leute gleichzeitig)
- **Viele parallele Ziele**: immer mehrere aktive Objekte über die ganze Fläche verteilt, damit nicht alle auf
  denselben Punkt zielen und sich gegenseitig blockieren.
- **Teamwork lohnt sich**: große/zähe Objekte (`pixelFillButton`, `paintLayer`-Abdeckung), deren Wirkung mit dem
  bedeckten Flächenanteil wächst (gedeckelt) – „alle zusammen auf den Boss“.
- **Wildes Herumleuchten bestraft**: „gute“ Objekte, die man nicht treffen darf, oder Flächen, die Schaden nehmen.
- Optional Fraktionen/Zonen (linke vs. rechte Hälfte, Farbteams über `getRgbSpreadHex` mit Hue-Shift),
  gemeinsamer Team-Score statt Einzelpunkte (Laser sind nicht unterscheidbar).
- Alles grob und verzeihend: große Ziele (Radius ≥ 50 px), Treffer über Zeit akkumulieren, nie Einzelframes.

### B. Levelanstieg
- `DIFFICULTY`-Objekt oben mit Startwerten **und** Steigerung pro Level, z. B.
  `{ startSpawnInterval, spawnIntervalFactor, startSpeed, speedPerLevel, enemiesPerLevel, maxLevel ... }`.
- Klare Level-Ziele (z. B. „X Objekte gerettet“ oder „Zeit überlebt“), dann **Level-Übergang** als eigener kurzer
  Zustand (`gameState = 'levelup'`, ~2 s): großer Text „LEVEL 3“, kurzer Effekt, ggf. Sound.
- Jedes Level fügt spürbar etwas hinzu: mehr/schnellere Gegner, neue Objektsorte, kleinere Zeitfenster,
  ab einem Level ein Boss/Event. Nicht nur Zahlen skalieren – neue Elemente einführen.
- HUD zeigt Level, Score, ggf. Leben/Zeit (40–50 px). Game-Over-Screen mit erreichtem Level + Statistik.

### C. Sieht geil aus
- Farbpalette ausschließlich aus `laserConfig.testColor` via `getRgbSpreadHex(testColor, hueShift, sat, val)` –
  mehrere harmonische Töne, **nie** die reine Laserfarbe.
- Tiefe und Bewegung: Hintergrund-Ebene (Parallax, Partikel, Sterne, Wellen, Verläufe), leichtes Pulsieren/Wobbeln
  der Objekte (`Math.sin(time * …)`), `ctx.shadowBlur`/`globalCompositeOperation = 'lighter'` für Glow.
- **Feedback auf jede Aktion**: Partikel-Explosion bei Treffer, Screen-Shake bei Fehlern, aufsteigende
  Punktzahlen („+10“), Farbblitz beim Level-Up.
- Partikelsystem als einfaches Array im Modul (Position, Geschwindigkeit, Lebenszeit, Farbe), mit `.slice()` iterieren,
  Obergrenze (z. B. 400) für Performance.
- Teures (Sprites, Muster, Fraktale) einmal in Offscreen-Canvas vorrendern und per `drawImage` zeichnen.
- Titel-Screen mit animiertem Hintergrund, Titel 150 px, großem Start-`fillButton` **ohne** `keyCode` (mit `keyCode` ignoriert er die Laser!) – Leertaste separat abfragen.
- Transforms immer mit `ctx.save()/restore()` kapseln.

## 3. Umsetzen

- Datei `src/js/setups/game-NNN-<name>.js` nach Vorlage-Stil: deutscher Kopfkommentar (Name + Regeln),
  `export default { name, description, image, init(), handle(grid, elapsed), stop() }`.
- `description`: deutscher Mehrzeilentext für den Intro-Screen (Ziel, was man tun/lassen soll).
- `image`: passendes vorhandenes Bild aus `public/media/img/gametitles/` wählen (nichts erfinden).
- Eingabe **nur über GUI-Komponenten** + Handle-Wrapping; nie selbst `grid[...]` lesen.
  Fehlt eine Eingabe-Art → neue generische Komponente in `gui/` und in die Tabelle in `AGENTS.md` eintragen.
- `elapsed` begrenzen: `const dt = Math.min(elapsed, 0.1);` und alle Bewegungen damit skalieren.
- Tastatur-Testmodus über `laserConfig.pressedKeys` (z. B. Space = Start, Ziffern = Ziele auslösen/Level skippen).
- Sounds nur aus vorhandenen Dateien in `public/media/`; Musik in `stop()` beenden.
- Im Spiel `init()` alles zurücksetzen (Zustand, Arrays, Level, Score).
- Registrieren: in `src/js/view.js` in der `games`-Liste nach dem letzten Spiel
  `new GameWrapper(require('./setups/game-NNN-<name>').default),` einfügen. Sonst nichts an der Engine ändern.

## 4. Prüfen

1. `npm run build` muss ohne Fehler durchlaufen (Syntax/Imports).
2. Selbst-Review gegen diese Checkliste:
   - [ ] Mehrere Ziele parallel über die Fläche verteilt, Teamwork-Skalierung, Strafe für Wildleuchten
   - [ ] Levelanstieg mit sichtbarem Level-Up-Zustand und neuen Elementen pro Level
   - [ ] Glow/Partikel/Animation, Farben nur aus `testColor` abgeleitet, keine reine Laserfarbe
   - [ ] Kein direkter `grid`-Zugriff, keine hart codierten Grid-Zellzahlen
   - [ ] Start-, Spiel-, Level-Up-, Game-Over-Zustand; `init()` setzt zurück; `stop()` räumt Sound auf
   - [ ] Spiellogik leichtgewichtig (Partikel gedeckelt, Vorrendern)
3. Dem Nutzer zum Schluss knapp berichten: Spielname, Datei, Idee in 2–3 Sätzen, Level-Mechanik,
   Tastatur-Testbelegung, und dass er es mit `npm run dev` in der Selectbox testen kann.
   Ehrlich sagen, dass es nur gebaut, nicht im Browser mit Lasern getestet wurde.
