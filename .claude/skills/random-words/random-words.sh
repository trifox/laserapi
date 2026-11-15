#!/usr/bin/env bash
# Erzeugt zufällige Wörter.
# Nutzung: random-words.sh [ANZAHL] [-s TRENNER] [-l de|en|sys] [-t basis|game|mix]
#   ANZAHL   Anzahl Wörter (Standard: 5)
#   -s       Trennzeichen (Standard: Zeilenumbruch)
#   -l       Sprache der eingebauten Liste (Standard: de)
#   -t       Thema: basis (Alltag/Natur, Standard), game (Computerspiel-Begriffe), mix (beides)
# Wenn /usr/share/dict/words existiert und -l sys gesetzt ist, wird diese Liste genutzt (ohne Thema).

count=5; sep=$'\n'; lang=de; theme=basis
# Zeilen mit beliebigem (auch mehrzeichigem) Trenner verbinden
join() { awk -v s="$sep" 'NR>1{printf "%s", s}{printf "%s", $0}END{print ""}'; }
while [ $# -gt 0 ]; do
  case "$1" in
    -s) sep="$2"; shift 2 ;;
    -l) lang="$2"; shift 2 ;;
    -t) theme="$2"; shift 2 ;;
    -h|--help) sed -n '2,9p' "$0"; exit 0 ;;
    *) count="$1"; shift ;;
  esac
done
[[ "$count" =~ ^[0-9]+$ ]] || { echo "Ungültige Anzahl: $count" >&2; exit 1; }

de="Apfel Baum Wolke Laser Drache Kerze Fenster Brücke Insel Spiegel Feuer Wasser Stern Mond Sonne Nebel Blitz Donner Wald Berg Fluss Meer Kristall Schatten Funke Glocke Krone Schwert Schild Turm Burg Garten Rakete Komet Planet Pinguin Igel Fuchs Eule Bär Wal Biene Schmetterling Tulpe Kaktus Pilz Zauber Rätsel Schatz Karte Kompass Laterne Leuchtturm Anker Segel Welle Strand Muschel Vulkan Gletscher Wüste Oase Regenbogen Echo Pixel Roboter Zahnrad Magnet Prisma Linse Kamera Trommel Gitarre Flöte Harfe Melodie Tanz Ballon Drachen Kreisel Murmel Würfel Puzzle Labyrinth Brezel Kuchen Keks Honig Zimt Pfeffer Zitrone Kirsche Erdbeere Mango Teekanne Löffel Gabel Teller Bürste Schlüssel Schloss Tür Treppe Dach Kamin Uhr Kalender Feder Tinte Papier Buch Brief Stempel"
en="apple tree cloud laser dragon candle window bridge island mirror fire water star moon sun fog lightning thunder forest mountain river ocean crystal shadow spark bell crown sword shield tower castle garden rocket comet planet penguin hedgehog fox owl bear whale bee butterfly tulip cactus mushroom magic riddle treasure map compass lantern lighthouse anchor sail wave beach shell volcano glacier desert oasis rainbow echo pixel robot gear magnet prism lens camera drum guitar flute harp melody dance balloon kite spinner marble dice puzzle maze pretzel cake cookie honey cinnamon pepper lemon cherry strawberry mango teapot spoon fork plate brush key lock door stairs roof chimney clock calendar feather ink paper book letter stamp"

# Computerspiel-Begriffe (Genres, Mechaniken, Spielobjekte – keine Marken- oder Spielenamen)
game_de="Level Boss Endgegner Highscore Extraleben Powerup Combo Checkpoint Speicherpunkt Joystick Gamepad Konsole Arcade Spielhalle Pixelgrafik Sprite Hitbox Respawn Lebensbalken Munition Raumschiff Laserkanone Schutzschild Teleporter Portal Geheimgang Bonuslevel Zeitlimit Punktestand Rangliste Mehrspieler Koop Duell Turnier Abenteuer Plattform Sprungkraft Doppelsprung Schalter Falltür Schatztruhe Münze Edelstein Trank Heiltrank Zauberstab Rüstung Inventar Questbuch Karte Minimap Nebel Dungeon Labyrinth Monster Zombie Roboter Alien Ninja Ritter Pirat Drache Panzer Rennwagen Rennstrecke Turbo Nitro Drift Ziellinie Startblock Countdown Kettenreaktion Explosion Bombe Rakete Schwarm Welle Verteidigung Turm Basis Festung Ressource Bauplan Werkbank Handwerk Zeitreise Pausenmenü Cheatcode Easteregg Bug Glitch Lag Speedrun Achievement Trophäe Bildschirm Lautsprecher Chiptune Soundchip Kassette Diskette Modul Pixel Polygon Avatar NPC"
game_en="level boss highscore extralife powerup combo checkpoint savepoint joystick gamepad console arcade pixelart sprite hitbox respawn healthbar ammo spaceship lasercannon shield teleporter portal secretpassage bonuslevel timer scoreboard leaderboard multiplayer coop duel tournament adventure platform jump doublejump switch trapdoor treasurechest coin gem potion wand armor inventory questlog map minimap fog dungeon maze monster zombie robot alien ninja knight pirate dragon tank racecar racetrack turbo nitro drift finishline countdown chainreaction explosion bomb rocket swarm wave defense tower base fortress resource blueprint workbench crafting timetravel pausemenu cheatcode easteregg bug glitch lag speedrun achievement trophy screen speaker chiptune soundchip cassette floppy cartridge polygon avatar npc"

case "$lang" in
  de) basis=$de; game=$game_de ;;
  en) basis=$en; game=$game_en ;;
  sys) [ -r /usr/share/dict/words ] || { echo "/usr/share/dict/words nicht vorhanden" >&2; exit 1; }
       shuf -n "$count" /usr/share/dict/words | join; exit 0 ;;
  *) echo "Unbekannte Sprache: $lang (de|en|sys)" >&2; exit 1 ;;
esac

case "$theme" in
  basis) words=$basis ;;
  game) words=$game ;;
  mix) words="$basis $game" ;;
  *) echo "Unbekanntes Thema: $theme (basis|game|mix)" >&2; exit 1 ;;
esac

tr ' ' '\n' <<<"$words" | shuf -r -n "$count" | join
