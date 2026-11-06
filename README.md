# Clueboard

A Jeopardy-style quiz board for the classroom: a board on the projector, a control screen for
the teacher, and student devices that buzz, answer and pick clues. Forked from
[the classroom buzzer](https://github.com/ben0sb0rne/buzzer), which stays as it is.

No framework, no build step. Plain files served by GitHub Pages.

**Status: playable prototype.** A whole game runs end to end: import a clue set, open a room,
teams join, clues are picked and answered, Daily Doubles and Final Jeopardy are wagered, and
the teacher scores by hand.

Wagers work the same way in both: the team enters one on their device before the clue is
shown, and the clue is then worth that wager instead of the cell value. The cap is **the
larger of the team's score and the top value on the board**, so a team on zero or in the red
can still play. A Daily Double belongs to the team whose turn it is - whoever picked it - and
only that team can answer it. Final is everyone's: the category goes up, every team wagers,
then the clue, then the teacher reveals the teams one at a time by tapping each answer.

Start Final from the cog, at any point - the class is about to end and the board is half
full. It leaves spent cells alone, so dismissing it returns to the board as it was.

- `board.html` - student-facing, on the TV. Never touched during a game.
- `control.html` - everything the teacher does. Holds the clue set, in memory.
- `index.html` - student devices: buzz, answer, pick a clue.
- `clues.js` - parses a pasted clue set. `node clues.test.js` checks it.
- `demo.js` - a localStorage stand-in for Firebase, see below.
- `sample-clues.tsv` - a working clue set, and the template to copy.
- `firebase-config.js` - the only file you need to edit by hand
- `database.rules.json` - deployed by the CLI, not pasted into the console

## Looking at it with no Firebase project

Add `?demo=1` to any screen. `demo.js` swaps in an in-memory database kept in localStorage,
seeded with a room `DEMO` and four teams. Two tabs of the same browser share it, so
`control.html?room=DEMO&demo=1` really does drive `board.html?room=DEMO&demo=1`.

It is same-browser only and is not an emulator: it exists so the screens can be judged, and
tested, without waiting on a project.

## Writing a clue set

Copy `sample-clues.tsv` into a spreadsheet and edit it. One clue per row; the first row is the
header and the column order does not matter. A blank `value` derives from row order, `dd`
marks a Daily Double with an `x`, and `round` is `1`, `2` or `final`. Round 2 is the same
sheet with the round column changed.

Clue and answer text may carry `$...$` maths, rendered by KaTeX on the board and the control
screen. About twelve commands cover the year: `\frac`, `^`, `_`, `\sqrt`, `\times`, `\div`,
`\pm`, `\le`, `\ge`, `\ne`, `\pi`, `\angle`. Category names stay plain text on purpose, so
the player screen needs no KaTeX at all.

To load a set, paste it into the box on `control.html`. It is kept on that device, and never
sent anywhere.

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
