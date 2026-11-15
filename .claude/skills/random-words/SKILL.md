---
name: random-words
description: Erzeugt zufällige Wörter (Deutsch oder Englisch, Alltag/Natur oder Computerspiel-Begriffe) per Shell-Skript. Verwenden, wenn zufällige Wörter, Namen, Platzhalter, Inspiration für Spielnamen o. Ä. gebraucht werden.
---

# Zufällige Wörter

Führe das Skript `random-words.sh` in diesem Skill-Ordner aus:

```bash
bash .claude/skills/random-words/random-words.sh [ANZAHL] [-s TRENNER] [-l de|en|sys] [-t basis|game|mix]
```

- `ANZAHL` – Anzahl der Wörter (Standard 5)
- `-s` – Trennzeichen (Standard: Zeilenumbruch), z. B. `-s ' '` oder `-s -`
- `-l` – `de` (Standard), `en` oder `sys` (`/usr/share/dict/words`, falls vorhanden)
- `-t` – Thema: `basis` (Alltag/Natur, Standard), `game` (Computerspiel-Begriffe wie Endgegner, Hitbox, Powerup), `mix` (beides)

Beispiele:

```bash
bash .claude/skills/random-words/random-words.sh 3            # drei deutsche Wörter
bash .claude/skills/random-words/random-words.sh 4 -s - -l en # z. B. comet-owl-pixel-harp
bash .claude/skills/random-words/random-words.sh 4 -s ' ' -t game  # z. B. Endgegner Hitbox Turbo Schatztruhe
bash .claude/skills/random-words/random-words.sh 5 -t mix     # Alltag und Spielbegriffe gemischt
```

Gib dem Nutzer die Ausgabe direkt zurück. Wenn Argumente übergeben wurden ($ARGUMENTS), reiche sie an das Skript weiter.
