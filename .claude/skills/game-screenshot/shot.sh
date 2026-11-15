#!/usr/bin/env bash
# Screenshots eines Laser-Spiels mit simulierten Lasern (headless Chromium).
#
# Aufruf: shot.sh <spiel> [-t ZEITEN] [-n SPIELER] [-k TASTEN] [-o ORDNER] [--title SEK] [--no-dots] [--seed N]
#   <spiel>     Nummer (044), Dateiname (game-044-lasershark2), Teil davon (lasershark2) oder Spielname ("Laser-Shark 2")
#   -t ZEITEN   Sekunden nach dem Start, kommagetrennt (Standard 3,15,40); der Titelbildschirm kommt immer dazu
#   -n SPIELER  Anzahl simulierter Laser (Standard 20)
#   -k TASTEN   Tastendrücke nach dem Start, z. B. "KeyL@10,KeyL@20" (Code@Sekunde)
#   -o ORDNER   Ausgabe (Standard <repo>/screenshots/<spieldatei>)
#   --title SEK Sekunden Titelbildschirm vor dem Start (Standard 2)
#   --no-dots   Laserpunkte nicht einzeichnen
#   --no-title  keinen Titelbildschirm aufnehmen
#   --seed N    Zufalls-Startwert (gleicher Wert = gleicher Ablauf; Standard: jedes Mal neu)
#
# Dateinamen: <spieldatei>-001.png, -002.png, ... – fortlaufend, vorhandene werden nie überschrieben.
set -euo pipefail

SKILL_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT="$(cd "$SKILL_DIR/../../.." && pwd)"
SETUPS="$ROOT/src/js/setups"

GAME=""; TIMES="3,15,40"; PLAYERS=20; KEYS=""; OUT=""; TITLE=2; DOTS=1; SEED=$RANDOM$RANDOM; NOTITLE=0
while [ $# -gt 0 ]; do
  case "$1" in
    -t) TIMES="$2"; shift 2 ;;
    -n) PLAYERS="$2"; shift 2 ;;
    -k) KEYS="$2"; shift 2 ;;
    -o) OUT="$2"; shift 2 ;;
    --title) TITLE="$2"; shift 2 ;;
    --no-dots) DOTS=0; shift ;;
    --no-title) NOTITLE=1; shift ;;
    --seed) SEED="$2"; shift 2 ;;
    -h|--help) sed -n '2,15p' "$0"; exit 0 ;;
    *) GAME="${GAME:+$GAME }$1"; shift ;;
  esac
done
[ -n "$GAME" ] || { echo "Fehler: Spielname fehlt (z. B. 044 oder lasershark2)" >&2; exit 2; }

# --- Spiel finden ---
mapfile -t ALL < <(cd "$SETUPS" && ls game-*.js 2>/dev/null)
match() { printf '%s\n' "${ALL[@]}" | grep -i -- "$1" || true; }
CANDS=""
if [ -f "$GAME" ]; then CANDS="$(basename "$GAME")"; fi
[ -z "$CANDS" ] && [[ "$GAME" =~ ^[0-9]+[a-z]?$ ]] && CANDS="$(match "^game-0*${GAME}-")"
[ -z "$CANDS" ] && CANDS="$(match "$GAME")"
if [ -z "$CANDS" ]; then
  # über das name-Feld suchen
  CANDS="$(cd "$SETUPS" && grep -il -- "name: *['\"\`][^'\"\`]*${GAME}" game-*.js || true)"
fi
COUNT=$(printf '%s' "$CANDS" | grep -c . || true)
if [ "$COUNT" -eq 0 ]; then echo "Kein Spiel passt zu '$GAME'." >&2; exit 2; fi
if [ "$COUNT" -gt 1 ]; then
  # exakter Treffer auf den Namensteil gewinnt
  EXACT="$(printf '%s\n' $CANDS | grep -iE -- "^game-[0-9a-z]+-${GAME}\.js$" || true)"
  if [ "$(printf '%s' "$EXACT" | grep -c .)" -eq 1 ]; then CANDS="$EXACT"; else
    echo "Mehrere Spiele passen zu '$GAME':" >&2; printf '  %s\n' $CANDS >&2; exit 3; fi
fi
FILE="$SETUPS/$CANDS"
BASE="$(basename "$CANDS" .js)"
OUT="${OUT:-$ROOT/screenshots/$BASE}"

# --- Werkzeuge ---
need() { command -v "$1" >/dev/null 2>&1; }
if ! need node || ! need chromium; then
  echo "Installiere fehlende Werkzeuge (nodejs/chromium) ..." >&2
  sudo apt-get update -qq >/dev/null && sudo apt-get install -y -qq nodejs chromium >/dev/null
fi

# --- umwandeln und ausliefern ---
BUILD="$(mktemp -d "${TMPDIR:-/tmp}/game-shot.XXXXXX")"
PORT=$(python3 -c 'import socket;s=socket.socket();s.bind(("127.0.0.1",0));print(s.getsockname()[1]);s.close()')
SERVER_PID=""
cleanup() { [ -n "$SERVER_PID" ] && kill "$SERVER_PID" 2>/dev/null; rm -rf "$BUILD"; }
trap cleanup EXIT

MODULE="$(node "$SKILL_DIR/build.mjs" "$ROOT" "$FILE" "$BUILD")"
# LaserApiConfig wird von der Testseite direkt importiert – sicherstellen, dass es umgewandelt ist
node "$SKILL_DIR/build.mjs" "$ROOT" "$ROOT/src/js/LaserApiConfig.js" "$BUILD" >/dev/null
ln -s "$ROOT" "$BUILD/__repo"
cp "$SKILL_DIR/page.html" "$BUILD/index.html"
(cd "$BUILD" && exec python3 -m http.server "$PORT" --bind 127.0.0.1 >/dev/null 2>&1) &
SERVER_PID=$!
for _ in $(seq 1 50); do curl -s -o /dev/null "http://127.0.0.1:$PORT/index.html" && break; sleep 0.1; done

mkdir -p "$OUT"
CHROME=(chromium --headless --no-sandbox --disable-gpu --hide-scrollbars --mute-audio
  --window-size=1920,1080 --virtual-time-budget=60000 --run-all-compositor-stages-before-draw)
url() { echo "http://127.0.0.1:$PORT/index.html?game=$MODULE&until=$1&title=$TITLE&players=$PLAYERS&keys=$KEYS&dots=$DOTS&seed=$SEED"; }

# Dateinamen: <spieldatei>-<index>.png, fortlaufend – vorhandene Bilder werden nie überschrieben
NEXT=$(ls "$OUT" 2>/dev/null | sed -nE "s/^${BASE}-([0-9]+)\.png$/\1/p" | sed 's/^0*//' | sort -n | tail -1)
NEXT=$(( ${NEXT:-0} + 1 ))

shoot() { # $1 = until, $2 = Beschreibung
  local name
  name="$(printf '%s-%03d.png' "$BASE" "$NEXT")"
  NEXT=$((NEXT + 1))
  "${CHROME[@]}" --screenshot="$OUT/$name" "$(url "$1")" >/dev/null 2>&1 || true
  [ -s "$OUT/$name" ] && echo "  $OUT/$name  ($2)" || echo "  FEHLGESCHLAGEN: $name ($2)"
}

echo "Spiel: $BASE  (Seed $SEED)"
echo "Screenshots:"
[ "$NOTITLE" = 1 ] || shoot -1 "Titelbildschirm"
LAST=-1
IFS=',' read -ra TS <<< "$TIMES"
for t in "${TS[@]}"; do
  shoot "$t" "${t}s nach dem Start"
  LAST="$t"
done

# Bericht (Fehler, Frames) vom längsten Lauf
REPORT="$("${CHROME[@]}" --dump-dom "$(url "$LAST")" 2>/dev/null | grep -o '<pre id="report">[^<]*' | sed 's/<pre id="report">//; s/&quot;/"/g; s/&amp;/\&/g; s/&lt;/</g; s/&gt;/>/g' || true)"
echo "Bericht: ${REPORT:-(keiner – Seite hat nicht fertig geladen)}"
