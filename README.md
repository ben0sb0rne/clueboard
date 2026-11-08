# Clueboard

A Jeopardy-style quiz board for the classroom: a board on the projector, a control screen for
the teacher, and student devices that buzz and answer. Forked from
[the classroom buzzer](https://github.com/ben0sb0rne/buzzer), which stays as it is.

No framework, no build step. Plain files served by GitHub Pages.

**Status: playable prototype.** A whole game runs end to end: import a clue set, open a room,
teams join, clues are picked and answered, Daily Doubles and the final clue are wagered, the
teacher scores by hand, and the game ends on a results screen.

It is called **the final clue**, not Final Jeopardy. The format is the show's; the name is
not ours to use on a site with other people's tools on it.

Wagers work the same way in both: the team enters one on their device before the clue is
shown, and the clue is then worth that wager instead of the cell value. **The two caps are
different, and deliberately so.** A Daily Double is capped at the larger of the team's score
and the top value on the board, so a team on zero or in the red can still play the clue for
what it is worth. **The final clue is capped at the team's score** - a team cannot bet money
it has never won. The exception is a team on nothing, or in the red: its cap would be `$0`
and the last clue of the game would be over for it before it began, so it gets the top value
on the board as a stake instead.

A Daily Double belongs to the team whose turn it is - whoever picked it - and only that team
can answer it. The final clue is everyone's: the category goes up, every team wagers, then
the clue, then the teacher reveals the teams one at a time by tapping each answer. A team
that wrote nothing still reveals, as "No answer" - the reveal is yours to make, so it has to
do something visible whatever that team typed.

**A wager is a whole number of dollars, and no more than the team has.** `$1,200` and ` 500 `
are the same wager; letters, a decimal point, a minus sign and anything over the cap are all
refused outright with a reason. Nothing is quietly corrected: "five hundred" used to lock in
as `$0` and `900` used to lock in as `600`, both without a word, at the one moment of the
game that is entirely about the number.

**The wager screen is the answer screen.** One big box filling the device and the lock bar
under it, the same shape and the same places to put a thumb. And the moment a wager is in,
that team goes to the waiting screen rather than sitting on a dead gold button until the
slowest team in the room has finished typing - which is what "sending a wager takes ages"
actually was.

During the final clue there is a think timer: `Start the timer` puts a draining bar and a
countdown on the board for 60 seconds. It is yours to start, because you read the clue out
first and a timer that began on its own would already be running. It locks nothing when it
runs out - this game is marked by hand, and a slow Chromebook is not a wrong answer.

Start the final clue from the cog, at any point - the class is about to end and the board is
half full. It leaves spent cells alone, so dismissing it returns to the board as it was.

**Ending the game is not closing the room.** `End the game` puts the scores on the board and
leaves everything standing; it is offered in the cog at any time, and in the strip as the
gold button the moment the final clue has been revealed, because that is what follows a final
clue. `Close the room` is the separate step that wipes the teams and the scores and goes back
to setup. Both take two taps.

**The results come up last place first**, each place arriving a beat above the one before it,
so the room finishes on the winner at the top of the screen. Each line is the place, the team,
who was in it and the final score. Equal scores share a place and the next one down skips it.

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

**A wager takes the score's place for a beat** as that team is revealed, in gold and at the
score's own size. It was a ten-pixel line under the podium, which from the back of a room is
not there at all - and the number is the whole point of a final clue.

**A podium is a name and a number, at the same size.** The score is white and the name is the
quieter blue; it is the colour that tells them apart, not a caption set half the size. A name
too long for its sixth of the screen gives up its tail rather than wrapping, because six
podiums have to stay one row deep.

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

**Joining and being ready are two separate acts.** The front page takes the room code and
nothing else. That drops a team into a lobby, where they settle their name, who is in the
team and - if the cog has it switched on - which buzzer sound they want, and then press
`Ready`.

The reason is what the dashboard used to look like during the five minutes before a game. A
team that had entered the code and a team still arguing about its name were the same row, so
the only way to tell a tech problem from a naming committee was to walk over. The state line
now reads `3 of 5 ready`, and the ones that are not are visible as the ones still working.
It is the pattern a multiplayer lobby uses, for the same reason: you can see that somebody is
there and fiddling with their loadout rather than wondering whether they loaded at all.

**`Ready` never gates the start, and it is the only way in.** Press `Start game` with half
the room un-readied and the game starts - the teacher waits for nobody. What `Ready` holds up
is that team's own buzzer: a team that has not pressed it stays in the lobby, and the lobby
refuses a blank name. So every team that reaches the board is a named one, and a team joining
late - after the intro, or after the first clue - is asked who it is instead of landing on a
buzzer nobody can put a name to. Before the start a team can un-ready itself and go back to
fiddling for as long as it likes.

The only thing that stops them is the lock - the padlock at the left of each row, where the
hand-over icon sits once the game is running - which freezes that team's name, members and
buzzer where they are. Use it on the team that will not settle, or on a name you would rather
the class did not read off the board. Locking is gold, not red: it is a thing you chose, not
a fault. **It lapses when the game starts**, because the padlock is only drawn before then:
a team that was locked and never readied would otherwise have nobody left who could let it in.

A team that has joined and not named itself yet reads as `Joining...` in grey italic, on the
dashboard and on the board's welcome card. That is a display fallback, not a stored name -
the name field is genuinely empty until the team types one, so there is nothing to delete.

**The buzzer never leaves a student's screen.** It is the one screen a phone sits on for a
whole lesson, so between clues it stays exactly where it is and goes dead - empty box, grey
button - rather than being replaced by "Waiting for the next clue...", which is a sentence a
student reads once and then stares at for forty minutes. A control that is always in the same
place and lights up when it works is less to learn than a screen that keeps changing. Three
things take it off screen, and each is something to do rather than something to read: the
grid when this team has the pick, a Daily Double that belongs to somebody else, and the
wager. The box clears itself when the clue changes, so what somebody typed and never locked
in cannot follow them into the next question.

**`Buzzers only` in the cog takes the answer boxes away** for a whole game: teams ring in and
answer out loud, and the buzzer fills the phone. Use it for a room where the devices are a
show of hands with a buzz order attached. The dashboard still has the correct answer to mark
against, and the buzz order column is what it is read by. The final clue keeps its box in any
case - every team answers that one at the same time, so there is nobody to say it to. The
setting is remembered between games and can be flipped mid-game.

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

**One screen runs a whole game.** `Run from the board`, beside `Open projector`, turns the
tab you are in into the board: click a cell to open a clue, mark a team on its own podium, and
everything else is in a bar that comes up when the mouse moves and goes a few seconds later,
the way a video player's does. For all but a handful of seconds in a lesson there is nothing
on screen but the show.

The two buttons are the two answers to the same question. **Two screens**: `Open projector`
puts the board in its own window, you drag it across, and you keep the dashboard in front of
you. **One screen** - an iPad mirrored to the TV, a laptop with no second output - is
`Run from the board`. Take one or the other, never both.

**It reveals first and marks second**, which is the opposite way round from the control
screen. There is nowhere private on a projected board, so the answer going up is what you
mark against. That is a change to how the game plays, and it is deliberate.

`Dashboard`, at the left of that bar, is the way back, and it is how you reach the things the
board has no equivalent of: renaming a team, its members, correcting a score, removing a team,
and everything behind the cog. Mid-clue is fine - going back does not disturb the game, which
lives in the room rather than in either screen.

It is `?host=1` on the address rather than a flag on the room, because the mode belongs to
the tab that is in it: nothing is written, and no room is left carrying a setting that outlives
the lesson. A board can only host if **that device** has the clue set - it reads it from its
own storage, the same place the dashboard keeps it - so the button is on the dashboard, which
is the screen that has it. A board opened anywhere else has no clue text to publish and no
answers to reveal. That is the gate, not a permission.

Three buttons leave the bar the moment they have nothing left to do, because on a projected
board a button that cannot be pressed is not a hint - it is a thing the class is reading.
`Reveal answer` goes when the answer is up, and the timer and `Back to grid` go once a final
clue has been revealed, which leaves `End the game` on its own.

**The control screen also opens on a phone**, which is the other way to run a lesson without
a second display: the phone in your hand is the dashboard and the laptop stays on the board. Below 700px a team stops being a row and becomes a card: name, score
and the two scoring buttons on one line, the answer across the full width underneath. Six
columns on a 390px screen put the deduct button off the right edge and gave the answer six
characters a line, so the fallback was not one.

**The dashboard is as large as it will go and no larger.** The room code and the whole team
table are scaled by one number, wound down a twentieth at a time until the last team is on
screen - measured rather than counted, because one team writing a sentence wraps to three
lines and costs more height than three teams answering "42". It stops at seven tenths and
lets the page scroll instead: below that the answers are too small to read at arm's length,
which is the only thing this screen is for. The stage is deliberately left out of the
scaling, so that a long answer arriving cannot resize the grid above it.

**Nothing in that table moves while the game runs.** The grid and the open clue share one
cell of the layout and only one is ever visible, so the stage is always the height of the
grid; the correct-answer row is always there and empty between clues; and the column the
hand-over icon appears in is as wide as that icon whether or not one is in it. Each of those
was shifting the whole team list a different amount at a different moment.

Things worth knowing that the screen does not say, because a dashboard used during a lesson
is no place for a paragraph of instructions:

- Tap a team's name to rename it, or its score to correct it. Who is in the team is listed
  under its name, wrapping onto as many lines as it needs - tap that to edit it too.
- Before the game starts, the left-hand column is a padlock per team rather than the
  hand-over icon, and the answer column holds each team's buzzer with a menu to change it.
  Both columns go back to their usual jobs the moment the game starts, which is why the
  padlock cannot simply live beside the hand-over icon: that one is only ever on one row.
- `Mute all buzzers` in the cog silences the whole room, student devices included, not just
  the dashboard. It is remembered between games.
- `Buzzers only` in the cog runs the game with no answer boxes on the student devices, except
  on the final clue. Also remembered between games.
- `Let teams pick their own buzzer sound` in the cog adds a grid of sounds to the lobby, in
  groups of eight. Off by default, because it is five more minutes a class can spend on
  something that is not the quiz. Remembered between games.
- On the final clue, tap a team's answer to put it on the board.
- While wagers are coming in, the teams column says who is in, never how much. An amount
  there is a number you can read and do nothing with - it cannot go on the board until the
  clue is up - and the board's own rule is that a wager stays secret until its team is
  revealed. The state line counts them in.
- Open the cog to remove a team, with the `x` beside its row.
- A game ends by itself an hour after you last touch the control screen, or an hour after it
  is closed. You get a warning five minutes before.

- `board.html` - student-facing, on the TV. Never touched during a game.
- `control.html` - everything the teacher does. Holds the clue set, in memory.
- `index.html` - the front page, and student devices: buzz, answer, wager, and pick a clue
  when handed the board. The two are one page because the join address on the board is
  this directory, so whatever is at `/` has to be what gets a student into a game.
- `privacy.html` - the privacy and COPPA statement, linked from the front page. Every claim
  on it is a claim about this code; change it when the data model changes.
- `clues.js` - parses a clue set, and works out what a clue is worth. `node clues.test.js`.
- `game.js` - every move a host can make, with no screen attached. Both host screens drive a
  room through it, so the rules of a game are written once.
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
the CLI refuses it, add a short suffix and put that id in `.firebaserc` - which is what the
console did on its own when it named the buzzer's project `buzzer-7cbfd`.

Create the Realtime Database once in the console (**Databases & Storage -> Realtime Database ->
Create Database**, nearest region, **locked mode** - the next step replaces the rules). Then:

```bash
npx firebase-tools deploy --only database
```

That publishes `database.rules.json` from this repo; the project id comes from `.firebaserc`,
so there is no `use` step. **Nothing is pasted into the console**, which is the one process
difference from the buzzer: the rules are a version-controlled file, so a rules change is a
commit and a deploy rather than a hand-edit someone has to remember.

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
4-letter code is all that stands between a class and its room. A new code is checked against
the rooms that already exist and picked again if it is taken: four letters out of twenty-four
is 331,776, which sounds like plenty until you remember that a room lingers an hour after its
host closes and that teachers all start at nine o'clock. A code that is already somebody's
game sends their class into yours. Teams are pinned to their known
fields and `buzzedAt` must equal the server clock, so a student cannot fake an earlier buzz.

That pinning is a closed set: `"$other": { ".validate": false }` refuses any field the rules do
not name, so adding one to a team is a change to `database.rules.json` and a deploy, not just a
write. `buzzer`, `ready` and `frozen` went in that way. Nothing under `game` needs it - that
node has no such clause, which is why `buzzerPick` was free. Demo mode validates nothing at
all, so a missing deploy looks perfect locally and fails silently in a lesson.

**A recycled code is wiped before it is opened on.** An hour without a host makes a room
reusable, and nothing used to delete what the last game left there - so a code handed back out
could drop a stranger's teams, the first names they typed and their scores onto a dashboard in
front of a different class. `freeCode` wipes in the branch that has just established the room is
stale. It leaves the give-up branch alone, where the code was never checked and a wipe could
take a live game.

**A room nobody closed is cleaned up by the browser that opened it.** The rules do not let a
client list rooms - deliberately, since that list would be every live code - so the host's own
browser is the only thing that still knows the code. `clueboard-host-room` holds every room
this browser has opened and not closed, capped at twenty, and each one is wiped and dropped
from the list the next time the control screen loads. It used to hold a single code, which
meant a room abandoned two lessons ago was never cleaned up by anything at all. The key still
reads a bare code, from before it was a list.

`game` is world-writable, because without auth the rules cannot tell a teacher from a student.
A determined student with devtools could clear the board. That is the same exposure the buzzer
already carries, where a student can delete another team. The one thing validated there is
`pick`: a team can only pick a clue when `game/turn` names them, so a stray tap from the wrong
team is rejected rather than stealing the pick. Being open is also why a new field under
`game` - `muted`, `over` - needs no rules change and nothing re-published by hand.

**Clue answers are never written to the database.** The control screen holds the whole clue set
in memory and publishes only the current clue, plus the answer at the moment the teacher reveals
it - which is when it goes on the projector anyway.
