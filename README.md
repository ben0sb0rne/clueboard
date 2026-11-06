# Clueboard

A Jeopardy-style quiz board for the classroom: a board on the projector, a control screen for
the teacher, and student devices that buzz and answer. Forked from
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
then the clue, then the teacher reveals the teams one at a time by tapping each answer. A
team that wrote nothing still reveals, as "No answer" - the reveal is yours to make, so it
has to do something visible whatever that team typed.

**A wager is a whole number of dollars.** `$1,200` and ` 500 ` are the same wager; letters, a
decimal point and a minus sign are refused outright and the student is told why. They used to
be stripped down to a silent `$0`, which in Final is a team's whole game thrown away without
a word to them.

During Final there is a think timer: `Start the timer` puts a draining bar and a countdown on
the board for 60 seconds. It is yours to start, because you read the clue out first and a timer
that began on its own would already be running. It locks nothing when it runs out - this game
is marked by hand, and a slow Chromebook is not a wrong answer.

Start Final from the cog, at any point - the class is about to end and the board is half
full. It leaves spent cells alone, so dismissing it returns to the board as it was.

**You pick the clues.** Pacing the game is the teacher's job, and a class that can open a
clue whenever it likes takes that away, so student devices cannot touch the board by default.
An icon sits beside whoever is up next: tap it to hand them the board for one pick, and it
comes back on its own the moment the clue opens. If you want a whole game where teams choose,
`Let teams pick their own clues` in the cog restores that, and is remembered between games.

**Every game has a title**, asked for before the room is made and remembered between games.
It heads the welcome card the class joins on, and it is the first card of the intro.

**Two ways to open a game.** `Start game` drops the class straight onto the board.
`Start intro` runs the show's opening instead: the board dissolves to a bare grid, the values
appear five at a time in no order, then the game's title fills the screen, and then each
category in turn, each one centred with an equal dark border either side and its neighbours
just off screen - a peek of the next card gave the pan a direction and told the room what was
coming. You press on; the
board never moves on its own, because you are the one reading the categories out. Past the
last one the button becomes `Start the game`, which is also the way out of an intro started
by mistake. Round 2 has no intro.

**Only the board moves, and it moves calmly.** The show is low energy by design, so nothing
here overshoots or springs: one easing that leaves rest and arrives at rest, and one duration
- a second and a half - for every move the room watches, so the board keeps a single tempo
instead of five. It is `SLOW` in `board.html` and `--slow` in `board.css`; change both. The
opening is three beats of it end to end, none of them overlapping: the welcome card fades
out as the bare board dissolves in underneath it, then the values fill it five at a time - the sweep ticks five times to the beat, each
value fading over a third of one - then the title card rises. The card is held off in CSS
rather than fired by a timer, so it is on the same clock as the values and cannot drift from
them. A clue expands out of its own cell, a
Daily Double arrives with weight, and a score counts up with the podium flashing which way it
went. The player screen stays deliberately still - a student should be looking up, not down -
and the control screen is a working surface. Anyone whose system asks for reduced motion gets
the same board with none of it.

**The reveal is the one beat that takes its time.** The clue eases up out of the way while the
answer and its rule fade in underneath, both over the same span, so they are fully there
exactly as the clue comes to rest.

**A clue screen is the words and nothing else**, as on the show: no value, no category, no
room code, and the answer in white with the clue when you reveal it. Every word on the board
carries the show's hard black edge - a thin stroke and a sharp shadow thrown down and right
at 45 degrees, both in `em` so they hold their proportion from a podium to an 86px clue. The
white type takes a deeper one than the gold does, because against white the black collapses
into the stroke and the letter just looks outlined, which from the back of a room is no
shadow at all. **Maths is the exception and carries its own, smaller edge**: KaTeX sets type
at 1.21em in a thin serif, where an offset tuned to Anton's slab of a stem clears the stroke
entirely and reads as a shadow floating free of the digit. A fraction bar is a border and a
radical is an SVG path, so neither `text-shadow` nor `text-stroke` reaches them at all; they
get the same two moves from `box-shadow` and `drop-shadow` instead. Nothing names whose turn
it is either - the gold line under a podium already says that, and it is the only one in the
game: the dashboard says whose pick it is in words instead. `Show the room code on the
board` in the cog puts the code and the join address back in the corner between clues; it is
off, because a class that has already joined has no use for it.

**Back to grid without revealing leaves the clue on the board.** A cell is spent when you
reveal its answer, not when you open it, so a mis-tap costs nothing and a question can be held
over. The trade is that a teacher who reads answers out instead of revealing them never
empties the board.

**One palette, three screens.** The board, the dashboard and a student's phone are the same
show: board blue, near-black, and the value gold. It is `palette.css`, which all three load
before their own stylesheet. **A student handed the board gets the board**: the same six
columns, the same five rows, the same spent cells, rather than a list of categories that
asked them to find on a phone a thing already on the wall in front of them. The type is set
in the system font there, not Anton - a webfont on thirty phones for a screen that is up for
five seconds is not a trade worth making.

**While a clue is open, a team that has rung in is at full strength and everyone still
thinking is pulled back** - on the podiums and on the dashboard's team list alike. Lighting
the background alone was not a difference anyone read from the back of a room. It is only
while a clue is open: with nothing to ring in to, a screen of dimmed podiums is the normal
state of the screen rather than a signal. Gold is the thing to press; red only ever takes something
away, which is a deduction, a negative score or ending a game.

**One region for the buttons, and one gold button in it.** Every control the game has lives
in the strip above the stage, right-aligned. Exactly one of them is gold, it is whatever comes
next - `Start intro`, then `Next`, then `Show the clue` once the wagers are in, then `Reveal
answer`, then `Back to grid` - and **it is always the last button in the row**, so the one to
press is in the same corner in every state of the game. CSS orders it there rather than the
markup, which is what lets a button keep its place in the source and still end up under your
thumb. **`Back to grid` is deliberately not the easy one to hit** until the answer is up,
because an accidental press there is the one that costs a clue.

`Open projector` is not in that strip: it belongs to the room rather than to the state of the
game, so it sits up in the header, where it never moves. The cog goes to its left rather than
into the corner, so that `Open projector` and the gold button below it end on one line down
the side of the screen.

The cog holds two kinds of thing and keeps them apart: what is true for the whole game, then
the three ways out of where it is now. `End the game` is the one that cannot be taken back,
so it sits on its own at the far end of that row.

The control screen is built around checking answers, which is most of what you do with it.
The clue runs full width across the top, and the correct answer sits at the head of the same
column the teams' submissions are in, so marking is one glance down a column.

**Nothing in that table moves while the game runs.** The grid and the open clue share one
cell of the layout and only one is ever visible, so the stage is always the height of the
grid; the correct-answer row is always there and empty between clues; and the column the
hand-over icon appears in is as wide as that icon whether or not one is in it. Each of those
was shifting the whole team list a different amount at a different moment.

Things worth knowing that the screen does not say, because a dashboard used during a lesson
is no place for a paragraph of instructions:

- Tap a team's name to rename it, or its score to correct it. Who is in the team is listed
  under its name, wrapping onto as many lines as it needs.
- `Mute all buzzers` in the cog silences the whole room, student devices included, not just
  the dashboard. It is remembered between games.
- During Final, tap a team's answer to put it on the board.
- Open the cog to remove a team, with the `x` beside its row.
- A game ends by itself an hour after you last touch the control screen, or an hour after it
  is closed. You get a warning five minutes before.

- `board.html` - student-facing, on the TV. Never touched during a game.
- `control.html` - everything the teacher does. Holds the clue set, in memory.
- `index.html` - student devices: buzz, answer, wager, and pick a clue when handed the board.
- `clues.js` - parses a clue set, and works out what a clue is worth. `node clues.test.js`.
- `ui.test.js` - checks every button carries a style of its own. `node ui.test.js`.
- `demo.js` - a localStorage stand-in for Firebase, see below.
- `sample-clues.tsv` - a working clue set, and the template to copy.
- `katex/` - KaTeX, committed rather than loaded from a CDN. woff2 fonts only.
- `fonts/` - Anton, the board font. Self-hosted, OFL licence alongside it.
- `icons/` - the icons, from Lucide. ISC licence alongside them. They are pasted into the
  page as inline SVG rather than linked, because an `<img>` cannot take its colour from the
  button it sits in; copy the next one in the same way.
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

Before the room opens, `Check the clues` lays the whole set out the way the board will show
it: every clue and answer in order, with its value, its Daily Double mark and its picture. It
flags maths KaTeX cannot read and images that are not there, and puts the count in the summary
line, so a broken set is visible without opening it. A typo found in the staffroom costs
nothing; the same typo found on the projector costs the room.

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
