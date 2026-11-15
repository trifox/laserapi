---
name: game-genres
description: Liefert Arten/Genres von Computerspielen (z. B. Side-Scroller, Jump and Run, Tower Defense, Match-3), zufällig oder komplett, optional mit Kurzbeschreibung und nach Kategorie gefiltert. Verwenden, wenn Spielgenres, Spielarten oder Inspiration für einen Spieltyp gebraucht werden.
argument-hint: "[ANZAHL|all] [-d] [-k KATEGORIE] [-l]"
---

# Spielgenres

Führe das Skript `game-genres.sh` in diesem Skill-Ordner aus:

```bash
bash .claude/skills/game-genres/game-genres.sh [ANZAHL|all] [-s TRENNER] [-d] [-k KATEGORIE] [-l]
```

- `ANZAHL` – Anzahl zufälliger Genres ohne Wiederholung (Standard 1), `all` = alle (~120)
- `-s` – Trennzeichen (Standard: Zeilenumbruch), z. B. `-s ', '`
- `-d` – mit Kurzbeschreibung („Genre – Beschreibung“)
- `-k` – nur eine Kategorie (Teilstring, gross/klein egal): Action, Action-Adventure, Adventure,
  Rollenspiel, Strategie, Simulation, Puzzle, Party, Klassiker, Experimentell
- `-l` – Kategorien auflisten

Beispiele:

```bash
bash .claude/skills/game-genres/game-genres.sh 3              # drei zufällige Genres
bash .claude/skills/game-genres/game-genres.sh all -s ', '    # alle Genres in einer Zeile
bash .claude/skills/game-genres/game-genres.sh 2 -d -k puzzle # zwei Puzzle-Genres mit Beschreibung
bash .claude/skills/game-genres/game-genres.sh -l             # Kategorien
```

Gib dem Nutzer die Ausgabe direkt zurück. Wenn Argumente übergeben wurden ($ARGUMENTS), reiche sie an das Skript weiter.
