# Where Clueboard is going

Decided 6 November 2026, after the first games. This file records the decisions so they are
not re-litigated or half-remembered; [README.md](README.md) describes what is built.

## What this is becoming

**A tool Ben hosts and shares with teacher friends.** Not a business. It stays on GitHub
Pages and the existing Firebase project, which means it keeps the properties that made it
quick to build: no framework, no build step, no backend, no accounts.

A monetised version was costed and set aside. The code in it was a few weeks; the months
were Stripe onboarding, a company to take money, a lawyer on the trade dress, student-data
law, and a beta with strangers. None of that is needed to put this in a friend's hands.

## The four decisions

**1. Bugs and hardening come first.** Before any new screen. The list is at the bottom.

**2. A saved game lives on the device that made it, and travels as a file.** No sign-in, no
sync, no rewrite of `database.rules.json`, and **clue answers still never touch the
network** - which is the property the whole design is built on. The cost is real and
accepted: a game built on the laptop is not on the iPad unless you send yourself the file.

Sign-in and sync stay possible later and nothing here blocks them. They are not being built
now, and the file export is not a stepping stone to them - it is the answer.

**3. Board-only mode reveals first, then marks.** Today you mark before revealing, because
the answer is on a second screen only you can see. Project the board and there is nowhere
private, so the order has to change: the answer goes up, then you award. That is a change to
how the game plays, and it is deliberate.

**4. Testing means real teachers and real hardware**, not more test files. Ship rough to
friends, watch what they hit, and get it onto a projector and a Chromebook. Nothing has ever
been seen on either.

## The order of work

1. ~~**Bugs and hardening**~~ - see below.
2. ~~**Board-only mode.**~~ Built. `Run from the board` on the control screen hands the game
   to the projector; the rules of a game moved into `game.js` first, so both host screens
   drive a room through one copy of them.
3. **The designer.** Click a cell to write a clue, drag to swap, mark Daily Doubles, set the
   final clue. CSV and TSV import stays as the fast path for anyone who already has a
   spreadsheet.
4. **A landing page**, as the front door a friend arrives at.

## Known, and worth knowing

- **Firebase caps simultaneous connections on the free tier** (100 on Spark - confirm the
  current number). One class of thirty devices is thirty connections. Four friends teaching
  at once is over the line. This is the first thing that will break as this spreads, and it
  is a billing decision rather than a code one.
- **The buzzer is a square wave.** Planned sound work - real buzzers, dings for right and
  wrong, whooshes for transitions, a buzzer each team picks - is a project of its own, and
  most of it is curation rather than code. Nothing from the show: those cues are enforced.
- **Still a fork.** A fix in the buzzer's `common.js` does not arrive here on its own.

## The hardening list

- [x] **Room codes could collide.** `newCode()` picked four letters and never asked whether
      that room already existed. Four letters out of twenty-four is 331,776, which sounds
      like plenty until you remember that rooms linger for an hour and that teachers all
      start at nine o'clock. Two friends on the same code means one class joins the other's
      game.
- [x] **The control screen did not fit a phone.** It is the documented fallback for a teacher
      who cannot extend their display, and the table was wider than the screen.
- [ ] **A revealed clue cannot be put back** from either screen. Revealing spends the cell;
      opening one does not, so a mis-tap is already free. `game.js` has `restore()` written
      for it and nothing calls it yet - it wants a control that cannot itself be mis-tapped,
      which on a projected board is the hard part.
- [ ] **The player's grid is tight on a small phone.** 45px cells at 352px wide, against a
      48px guideline. Fine on a Chromebook. For the real device check.
