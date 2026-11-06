# Clueboard

A Jeopardy-style quiz board for the classroom: a board on the projector, a control screen for
the teacher, and student devices that buzz, answer and pick clues. Forked from
[the classroom buzzer](https://github.com/ben0sb0rne/buzzer), which stays as it is.

No framework, no build step. Plain files served by GitHub Pages.

**Status: prototype.** The files inherited from the buzzer (`index.html`, `host.html`) are
still the plain buzzer. The board, control and player screens are not built yet.

- `board.html` - student-facing, on the TV. Never touched during a game. *(not built)*
- `control.html` - everything the teacher does. Holds the clue set. *(not built)*
- `index.html` - student devices: buzz, answer, pick, wager.
- `firebase-config.js` - the only file you need to edit by hand
- `database.rules.json` - deployed by the CLI, not pasted into the console

## Its own Firebase project, always

Clueboard must have a **separate Firebase project** from the buzzer. This is not tidiness:
Firebase security rules are **one document per project**. Two repos each carrying a
`database.rules.json` means whoever publishes last wins, so publishing the buzzer's rules
would silently delete Clueboard's `game` branch and take down a live lesson.

## Setup

One interactive login, then everything else is a command.

```bash
npx firebase-tools login
```

```bash
npx firebase-tools projects:create clueboard --display-name Clueboard
```

Project ids are global, not per-account, so `clueboard` may already belong to a stranger. If
the CLI refuses it, add a short suffix and use that everywhere below - which is what the
console did on its own when it named the buzzer's project `buzzer-7cbfd`.

Create the Realtime Database once in the console (**Databases & Storage -> Realtime Database ->
Create Database**, nearest region, **locked mode** - the next step replaces the rules). Then:

```bash
npx firebase-tools use clueboard && npx firebase-tools deploy --only database
```

That publishes `database.rules.json` from this repo. **Nothing is pasted into the console**,
which is the one process difference from the buzzer: the rules are a version-controlled file,
so a rules change is a commit and a deploy rather than a hand-edit someone has to remember.

Fill `firebase-config.js` from:

```bash
npx firebase-tools apps:sdkconfig WEB
```

`databaseURL` is not in that output - copy it off the top of the Realtime Database page.

## GitHub Pages

**Settings -> Pages -> Source: Deploy from a branch**, branch `main`, folder `/ (root)`.
The board is then at `https://ben0sb0rne.github.io/clueboard/board.html`.

## Taking fixes from the buzzer

A fork drifts: a bug fixed in the buzzer's `common.js` does not arrive here on its own. The
buzzer is wired up as `upstream`, so cherry-pick when it matters.

```bash
git fetch upstream && git log --oneline upstream/main
```

## What the rules allow

Anyone with a room code can read that room and write to it - there are no accounts, so the
4-letter code is all that stands between a class and its room. Teams are pinned to their known
fields and `buzzedAt` must equal the server clock, so a student cannot fake an earlier buzz.

`game` is world-writable, because without auth the rules cannot tell a teacher from a student.
A determined student with devtools could clear the board. That is the same exposure the buzzer
already carries, where a student can delete another team. The one thing validated there is
`pick`: a team can only pick a clue when `game/turn` names them, so a stray tap from the wrong
team is rejected rather than stealing the pick.

**Clue answers are never written to the database.** The control screen holds the whole clue set
in memory and publishes only the current clue, plus the answer at the moment the teacher reveals
it - which is when it goes on the projector anyway.
