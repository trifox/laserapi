#!/usr/bin/env bash
# Liefert Computerspiel-Genres (Spielarten), zufällig oder alle.
# Nutzung: game-genres.sh [ANZAHL|all] [-s TRENNER] [-d] [-k KATEGORIE] [-l]
#   ANZAHL     Anzahl zufälliger Genres ohne Wiederholung (Standard: 1), "all" = alle
#   -s         Trennzeichen (Standard: Zeilenumbruch)
#   -d         mit Kurzbeschreibung ("Genre – Beschreibung")
#   -k         nur Genres einer Kategorie (Teilstring, z. B. action, puzzle, strategie)
#   -l         Kategorien auflisten

count=1; sep=$'\n'; desc=0; cat=""; listcats=0
# Zeilen mit beliebigem (auch mehrzeichigem) Trenner verbinden
join() { awk -v s="$sep" 'NR>1{printf "%s", s}{printf "%s", $0}END{print ""}'; }
while [ $# -gt 0 ]; do
  case "$1" in
    -s) sep="$2"; shift 2 ;;
    -d) desc=1; shift ;;
    -k) cat="$2"; shift 2 ;;
    -l) listcats=1; shift ;;
    -h|--help) sed -n '2,9p' "$0"; exit 0 ;;
    *) count="$1"; shift ;;
  esac
done
[[ "$count" =~ ^([0-9]+|all)$ ]] || { echo "Ungültige Anzahl: $count (Zahl oder all)" >&2; exit 1; }

# Format: Kategorie|Genre|Beschreibung
genres=$(cat <<'EOF'
Action|Jump and Run|Figur springt über Abgründe und Gegner von Plattform zu Plattform
Action|Side-Scroller|Bild scrollt seitlich mit, die Figur läuft von links nach rechts
Action|Plattformer|Präzises Springen und Klettern auf Plattformen
Action|Run and Gun|Laufen und dabei ununterbrochen schiessen
Action|Endless Runner|Figur läuft automatisch, man weicht nur aus und springt
Action|Beat 'em up|Sich durch Gegnerhorden prügeln, meist seitlich scrollend
Action|Fighting Game|Eins-gegen-eins-Kämpfe mit Kombos
Action|Hack and Slash|Nahkampf gegen viele Gegner mit Waffen
Action|Shoot 'em up|Raumschiff schiesst Gegnerwellen ab (horizontal oder vertikal scrollend)
Action|Bullet Hell|Shoot 'em up mit extrem vielen Geschossen zum Ausweichen
Action|Twin-Stick Shooter|Bewegen und Zielen getrennt, Draufsicht
Action|Ego-Shooter|Schiessen aus der Ich-Perspektive
Action|Third-Person-Shooter|Schiessen mit Sicht über die Schulter
Action|Rail Shooter|Bewegung ist vorgegeben, man zielt nur
Action|Lightgun-Shooter|Mit einer Lichtpistole direkt auf den Bildschirm zielen
Action|Arena Shooter|Schnelle Gefechte in geschlossenen Arenen
Action|Stealth|Ungesehen bleiben, schleichen statt kämpfen
Action|Survival|Mit knappen Ressourcen überleben
Action|Battle Royale|Viele Spieler, die Spielfläche schrumpft, der Letzte gewinnt
Action|Maze Chase|Im Labyrinth Punkte sammeln und Verfolgern ausweichen
Action|Breakout|Mit Ball und Schläger Mauersteine zerschlagen
Action|Pinball|Flipperkugel mit Hebeln im Spiel halten
Action|Rhythmusspiel|Im Takt der Musik die richtigen Eingaben treffen
Action|Tanzspiel|Bewegungen oder Schritte zur Musik nachmachen
Action|Hau den Maulwurf|Auftauchende Ziele schnell treffen
Action|Reaktionsspiel|Schnell auf Signale reagieren
Action-Adventure|Action-Adventure|Kämpfen, Erkunden und Rätsel lösen kombiniert
Action-Adventure|Metroidvania|Grosse zusammenhängende Welt, neue Fähigkeiten öffnen neue Wege
Action-Adventure|Survival Horror|Gruseln, wenig Munition, Flucht statt Kampf
Action-Adventure|Open World|Frei erkundbare grosse Spielwelt
Action-Adventure|Soulslike|Schwere, taktische Kämpfe, Lernen aus Niederlagen
Adventure|Point and Click|Gegenstände anklicken, kombinieren und Rätsel lösen
Adventure|Textadventure|Spiel nur über Texteingaben und Beschreibungen
Adventure|Visual Novel|Interaktive Geschichte mit Bildern und Entscheidungen
Adventure|Walking Simulator|Erkunden und Geschichte erleben, kaum Herausforderung
Adventure|Escape Room|Aus einem Raum entkommen durch Rätsel
Adventure|Wimmelbild|Versteckte Gegenstände in einem vollen Bild finden
Adventure|Detektivspiel|Hinweise sammeln und einen Fall lösen
Rollenspiel|Rollenspiel|Figur entwickeln, Quests, Erfahrungspunkte
Rollenspiel|Action-Rollenspiel|Rollenspiel mit Echtzeitkämpfen
Rollenspiel|Rundenbasiertes Rollenspiel|Kämpfe abwechselnd in Zügen
Rollenspiel|Dungeon Crawler|Durch Verliese ziehen, Monster und Schätze
Rollenspiel|Roguelike|Zufällige Level, Tod ist endgültig, jeder Lauf ist anders
Rollenspiel|Roguelite|Zufällige Läufe mit dauerhaftem Fortschritt
Rollenspiel|MMORPG|Online-Rollenspiel mit sehr vielen Spielern gleichzeitig
Rollenspiel|Monster sammeln|Kreaturen fangen, trainieren und kämpfen lassen
Strategie|Echtzeitstrategie|Basis bauen, Rohstoffe sammeln, Armeen steuern in Echtzeit
Strategie|Rundenstrategie|Strategische Züge abwechselnd planen
Strategie|Tower Defense|Türme bauen, die Gegnerwellen auf einem Pfad aufhalten
Strategie|4X|Erkunden, Erweitern, Ausbeuten, Auslöschen
Strategie|Grand Strategy|Ganze Reiche über lange Zeit lenken
Strategie|Taktikspiel|Kleine Trupps auf einem Raster taktisch bewegen
Strategie|MOBA|Zwei Teams mit Helden kämpfen um gegnerische Basen
Strategie|Auto Battler|Einheiten aufstellen, Kampf läuft automatisch
Strategie|Deckbuilder|Kartendeck im Spielverlauf aufbauen und verbessern
Strategie|Sammelkartenspiel|Karten sammeln und gegeneinander ausspielen
Strategie|Artillerie|Abwechselnd mit Winkel und Kraft auf Gegner feuern
Simulation|Aufbausimulation|Stadt oder Siedlung planen und wachsen lassen
Simulation|Wirtschaftssimulation|Firma oder Handel führen, Geld verdienen
Simulation|Lebenssimulation|Alltag von Figuren gestalten
Simulation|Farmsimulation|Felder bestellen, Tiere versorgen, ernten
Simulation|Flugsimulation|Realistisch fliegen
Simulation|Fahrsimulation|Fahrzeuge realistisch steuern
Simulation|Rennspiel|Wettrennen mit Fahrzeugen
Simulation|Kart-Rennen|Lockere Rennen mit Extras und Hindernissen
Simulation|Sportspiel|Sportarten nachspielen (Fussball, Tennis ...)
Simulation|Managerspiel|Verein, Park oder Betrieb verwalten
Simulation|Haustier-Simulation|Ein virtuelles Tier pflegen
Simulation|Sandbox|Freies Bauen und Experimentieren ohne festes Ziel
Simulation|Crafting|Rohstoffe sammeln und zu Gegenständen verarbeiten
Simulation|Kolonie-Simulation|Eine Gruppe Siedler indirekt steuern
Simulation|God Game|Als höhere Macht eine Welt beeinflussen
Simulation|Physikspiel|Rätsel oder Spass auf Basis von Physik
Puzzle|Puzzle|Logische Rätsel lösen
Puzzle|Match-3|Drei gleiche Steine in eine Reihe bringen
Puzzle|Fallende Steine|Herabfallende Formen lückenlos stapeln
Puzzle|Bubble Shooter|Farbige Kugeln schiessen und Gruppen platzen lassen
Puzzle|Schiebepuzzle|Teile verschieben, bis das Bild stimmt
Puzzle|Kistenschieben|Kisten im Lager auf Zielfelder schieben
Puzzle|Lotsenspiel|Eine Gruppe Wesen über Werkzeuge sicher ins Ziel lotsen
Puzzle|Brückenbau|Konstruktionen bauen, die eine Last tragen
Puzzle|Kettenreaktion|Einen Auslöser setzen, der möglichst viel mitreisst
Puzzle|Licht- und Spiegelrätsel|Strahlen über Spiegel ins Ziel lenken
Puzzle|Memory|Kartenpaare aufdecken und merken
Puzzle|Merkspiel|Vorgegebene Sequenzen nachmachen
Puzzle|Wortspiel|Wörter bilden, suchen oder erraten
Puzzle|Quiz|Wissensfragen beantworten
Puzzle|Zeichnen und Raten|Einer zeichnet, die anderen raten
Puzzle|Labyrinth|Den Weg durch einen Irrgarten finden
Puzzle|Pixel-Malen|Felder nach Zahlen oder Hinweisen ausmalen
Puzzle|Logikrätsel|Zahlen- und Bilderrätsel nach festen Regeln
Party|Partyspiel|Viele kurze Minispiele für Gruppen
Party|Minispiel-Sammlung|Lose Sammlung schneller Spielchen
Party|Koop-Chaos|Gemeinsam unter Zeitdruck Aufgaben verteilen
Party|Tauziehen|Zwei Teams ziehen in entgegengesetzte Richtungen
Party|Abstimmungsspiel|Die Gruppe entscheidet per Mehrheit
Party|Musik-Jam|Gemeinsam Klänge und Rhythmen erzeugen
Party|Fangen|Einer jagt, die anderen fliehen
Party|Sammeln um die Wette|Wer sammelt am meisten in kurzer Zeit
Klassiker|Ball und Schläger|Ball zwischen zwei Schlägern hin und her spielen
Klassiker|Asteroiden-Shooter|Raumschiff zerschiesst treibende Felsbrocken
Klassiker|Invasion von oben|Gegnerformationen rücken von oben vor
Klassiker|Raketenabwehr|Herabstürzende Geschosse vor dem Einschlag abfangen
Klassiker|Schlange|Wachsende Linie frisst Futter und darf sich nicht treffen
Klassiker|Frosch über die Strasse|Zwischen fahrenden Hindernissen hindurchhüpfen
Klassiker|Lunar Lander|Gefühlvoll mit wenig Treibstoff landen
Klassiker|Vogeljagd|Vorbeifliegende Ziele abschiessen
Klassiker|Schiffe versenken|Verdeckte Ziele auf einem Raster finden
Klassiker|Billard|Kugeln mit Winkel und Kraft einlochen
Klassiker|Minigolf|Ball mit möglichst wenig Schlägen ins Loch
Klassiker|Brettspiel|Digitale Umsetzung von Brettspielen
Klassiker|Kartenspiel|Klassische Kartenspiele wie Solitär
Experimentell|Idle Game|Spielt sich weitgehend selbst, man optimiert
Experimentell|Clicker|Durch Klicken Ressourcen vermehren
Experimentell|Narratives Spiel|Fokus ganz auf Geschichte und Entscheidungen
Experimentell|Musikvisualisierung|Interaktive Bilder zur Musik
Experimentell|Malspiel|Gemeinsam Bilder oder Flächen gestalten
Experimentell|Exergame|Körperliche Bewegung als Steuerung
Experimentell|Augmented Reality|Spiel mischt sich mit der echten Umgebung
Experimentell|Asymmetrisches Multiplayer|Teams mit völlig unterschiedlichen Rollen
EOF
)

if [ "$listcats" = 1 ]; then
  cut -d'|' -f1 <<<"$genres" | sort -u | join
  exit 0
fi

if [ -n "$cat" ]; then
  genres=$(grep -i "^[^|]*${cat}[^|]*|" <<<"$genres")
  [ -n "$genres" ] || { echo "Keine Kategorie passt zu: $cat (Kategorien mit -l)" >&2; exit 1; }
fi

if [ "$count" = all ]; then
  selected=$genres
else
  selected=$(shuf -n "$count" <<<"$genres")
fi

if [ "$desc" = 1 ]; then
  awk -F'|' '{print $2 " – " $3}' <<<"$selected" | join
else
  cut -d'|' -f2 <<<"$selected" | join
fi
