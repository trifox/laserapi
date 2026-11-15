---
name: game-screenshot
description: Macht 4 Screenshots eines Laser-Spiels aus src/js/setups/ (Titel + 3 Spielmomente) mit simulierten Lasern in headless Chromium, ohne npm-Build. Eingabe ist der Spielname (Nummer wie 044, Dateiname wie lasershark2 oder Anzeigename). Verwenden, wenn ein Spiel als Bild festgehalten werden soll.
argument-hint: <spiel> [-t 3,15,40] [-n 20] [-k "KeyL@10"]
# Token sparen: nur Skript ausführen, Bilder NICHT ansehen.
model: haiku
context: fork
agent: general-purpose
allowed-tools: Bash
---

Führe genau einen Befehl aus, im Vordergrund mit Bash-`timeout: 600000` (dauert 1–3 min), und sonst nichts
(Bilder nicht öffnen, nichts nachprüfen, nicht wiederholen):

```bash
bash "$(git rev-parse --show-toplevel)/.claude/skills/game-screenshot/shot.sh" $ARGUMENTS
```

Antworte danach mit höchstens zwei Zeilen:
- den Ordner der Bilder (`/c/...` zusätzlich als Windows-Pfad `C:\...`)
- nur falls die `Bericht:`-Zeile `errors` enthält oder das Skript fehlschlägt: die Fehlermeldung, sonst „keine Fehler“.

Passt der Name auf mehrere Spiele, gib die Liste aus dem Skript zurück und höre auf.
