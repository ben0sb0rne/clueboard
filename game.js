// Every move a host can make on a running game, with no screen attached.
//
// Two screens drive a room now - the control screen, and the board itself when the teacher
// is running the game from the projector with nothing else open. What is in here is the
// rules rather than the look of them: a Daily Double belongs to whoever's turn it was, a
// cell is spent when its answer is revealed and not when it is opened, the next pick follows
// the award. Written once, because two copies of a rule is two rules, and the one that
// drifts is always the one you are not looking at.
//
// Nothing here touches the DOM or reads a global. The screen hands in how to read its own
// state and how to tell its user that something failed, which is an alert on a laptop and
// something quieter on a projector.
//
// ctx: {
//   db,         the Firebase database
//   code,       the room
//   game(),     the last snapshot of rooms/<code>/game
//   teams(),    the teams, for a name and a score
//   clueSet(),  the parsed set, held on this device and never published whole
//   fail(msg)   how this screen says something went wrong
// }
function hostMoves(ctx) {
  var db = ctx.db;
  var base = "rooms/" + ctx.code;
  var gameRef = db.ref(base + "/game");
  var teamsRef = db.ref(base + "/teams");
  var fail = ctx.fail || function () {};
  var beatTimer = null;

  // The show gives 30 seconds. An 8th grade algebra problem needs longer, and a teacher who
  // wants a different length can say so out loud - the timer shows the room the same number
  // either way, and nothing is enforced by it.
  var THINK_MS = 60 * 1000;

  function caught(what) {
    return function (err) { fail("Could not " + what + ": " + err.message); };
  }

  function teamName(id) {
    var found = ctx.teams().filter(function (t) { return t.id === id; })[0];
    return found ? found.name : "";
  }

  // The answer is held on the host's own device. game/clue carries one only from the moment
  // the teacher reveals it, so this is the lookup every screen uses in the meantime.
  function answerFor(clue) {
    var set = ctx.clueSet();
    if (!clue || !set) return "";
    if (clue.final) return ((set.final || [])[0] || {}).answer || "";
    var found = clueAt(set, Number(ctx.game().round) || 1, clue.cat, clue.row);
    return found ? found.answer : "";
  }

  // Says the room still has a host. Students read it to tell a live game from an abandoned
  // one, and the sweep reads it to clear up rooms nobody closed.
  function startHeartbeat(onRefused) {
    var ref = db.ref(base + "/hostSeen");
    var beat = function () { ref.set(SERVER_TIME).catch(onRefused || function () {}); };
    beat();
    clearInterval(beatTimer);
    beatTimer = setInterval(beat, 60000);
  }

  function stopHeartbeat() {
    clearInterval(beatTimer);
    beatTimer = null;
  }

  function resetBuzzers() {
    return teamsRef.once("value").then(function (snap) {
      var updates = {};
      snap.forEach(function (child) {
        updates[child.key + "/answer"] = "";
        updates[child.key + "/buzzedAt"] = null;
        updates[child.key + "/locked"] = false;
        updates[child.key + "/wager"] = null;
      });
      if (Object.keys(updates).length) return teamsRef.update(updates);
    });
  }

  // Someone has to pick first and nothing before now decides it, so pick at random - from
  // the teams that are actually in, because a team still in the lobby cannot pick and would
  // own a Daily Double nobody could answer. Drawn here rather than from a listener: this is
  // the moment the question is asked, and it is one write. Only if nobody holds the turn
  // already, so starting again can never re-roll it mid-game.
  function start(intro) {
    var able = ctx.teams().filter(function (t) { return t.ready; });
    var first = able.length ? able[Math.floor(Math.random() * able.length)].id : null;
    gameRef.update({ started: true, intro: intro, turn: ctx.game().turn || first || null })
      .catch(caught("start the game"));
  }

  function nextIntro() {
    var stops = (((ctx.game().grid || {}).cats) || []).length + 1;  // the title, then each one
    var at = Number(ctx.game().intro) || 0;
    gameRef.update({ intro: at + 1 >= stops ? null : at + 1 })
      .catch(caught("move the intro on"));
  }

  // Publishes the clue text, which is about to be on the projector anyway. It does not spend
  // the cell - reveal() does that - so a mis-tap costs nothing and a clue can be held over.
  function select(cat, row) {
    var game = ctx.game();
    var round = Number(game.round) || 1;
    var clue = clueAt(ctx.clueSet(), round, cat, row);
    if (!clue || (game.used || {})[cellKey(round, cat, row)]) return;

    // A Daily Double belongs to the team whose turn it is, whether they picked it themselves
    // or the teacher picked for them. The owner is frozen onto the clue, so awarding another
    // team mid-clue cannot hand the Daily Double over. With nobody to own it, it plays as a
    // normal clue rather than stranding the board on a wager that can never arrive.
    var owner = (clue.dd && game.turn) ? game.turn : null;
    gameRef.update({
      clue: {
        cat: cat, row: row, category: clue.category, value: clue.value,
        text: clue.text, image: clue.image || "", dd: !!owner,
        owner: owner, ownerName: owner ? teamName(owner) : null
      },
      wagering: owner ? true : null,
      reveal: false,
      pick: null,
      picker: null,
      shown: null,
      timerEnds: null
    })
      .then(resetBuzzers)
      .catch(caught("open that clue"));
  }

  function reveal() {
    var game = ctx.game();
    var clue = game.clue;
    if (!clue) return;
    // The answer reaches the database here and nowhere else: at this point it is going on
    // the projector, so a student reading it out of devtools gains nothing.
    var update = { "clue/answer": answerFor(clue), reveal: true };
    // The cell is spent here rather than when it was opened, so going back from a clue that
    // was never revealed - a mis-tap, or one held over - leaves it on the board. A teacher
    // who reads answers out instead of revealing them never empties it, which is the trade.
    if (!clue.final) {
      update["used/" + cellKey(Number(game.round) || 1, clue.cat, clue.row)] = true;
    }
    gameRef.update(update).catch(caught("reveal"));
  }

  // The way back from a clue revealed by mistake: the cell goes unspent and the board has it
  // again. It cannot unsee the answer, so it is not an undo - it is for the clue you opened
  // instead of the one you meant, which on a projected board you are clicking by hand.
  function restore(cat, row) {
    var key = cellKey(Number(ctx.game().round) || 1, cat, row);
    gameRef.child("used").child(key).remove().catch(caught("put that clue back"));
  }

  function dismiss() {
    gameRef.update({ clue: null, reveal: false, pick: null, wagering: null, shown: null,
                     timerEnds: null })
      .then(resetBuzzers)
      .catch(caught("close that clue"));
  }

  function setRound(next) {
    var set = ctx.clueSet();
    if (!set.rounds[next]) { fail("This clue set has no round " + next + "."); return; }
    gameRef.update({ round: next, grid: roundGrid(set, next), clue: null, reveal: false,
                     pick: null, picker: null, wagering: null, shown: null, timerEnds: null })
      .then(resetBuzzers)
      .catch(caught("change round"));
  }

  // The teacher can trigger the final clue at any point - the class is about to end and the
  // board is half full. It leaves `used` alone, so dismissing it returns to the board as it
  // was.
  function startFinal() {
    var f = ((ctx.clueSet() || {}).final || [])[0];
    if (!f) { fail("This clue set has no final clue. Add a row with round = final."); return; }
    gameRef.update({
      clue: {
        final: true, category: f.category, value: 0,
        text: f.text, image: f.image || "", dd: false
      },
      wagering: true, reveal: false, pick: null, shown: null, timerEnds: null
    })
      .then(resetBuzzers)
      .catch(caught("start the final clue"));
  }

  // Advances when a team dithers; it advances on its own once every wager is in.
  function showClue() {
    gameRef.update({ wagering: null }).catch(caught("show the clue"));
  }

  // Visual only, and started by hand rather than when the clue appears: the teacher reads it
  // out first, and a timer that began without them would already be running.
  function startTimer() {
    gameRef.update({ timerEnds: serverNow() + THINK_MS }).catch(caught("start the timer"));
  }

  // Manual, always. No automatic marking and no first-correct rule: several teams can be
  // right, or none, and the teacher reads what they typed and decides.
  function score(team, sign) {
    var game = ctx.game();
    var clue = game.clue;
    if (!clue || game.wagering) return;
    var updates = {};
    updates[base + "/teams/" + team.id + "/score"] = team.score + sign * stake(clue, team);
    // The pick follows the award, as on the show. An override by the teacher does not move
    // it, which is what makes a Daily Double belong to the right team later. The final clue
    // moves nothing: there is no next pick.
    if (sign > 0 && !clue.final) updates[base + "/game/turn"] = team.id;
    db.ref().update(updates).catch(caught("score that"));
  }

  // One pick, handed to the team whose turn it is. Deliberately not a mode: the board comes
  // straight back once the clue opens.
  function giveBoard(id, has) {
    gameRef.child("picker").set(has ? null : id).catch(caught("hand the board over"));
  }

  // The final clue reveals one team at a time, so the board does not spoil the rest.
  function toggleShown(id, on) {
    gameRef.child("shown").child(id).set(on ? null : true).catch(caught("change the board"));
  }

  // Ending a game stops the play and puts the scores on the board. It destroys nothing: the
  // teams, their members and their scores are what the results screen is made of.
  function end() {
    gameRef.update({ over: true, clue: null, reveal: false, wagering: null, pick: null,
                     picker: null, shown: null, timerEnds: null, intro: null })
      .then(resetBuzzers)
      .catch(caught("end the game"));
  }

  return {
    gameRef: gameRef, teamsRef: teamsRef,
    teamName: teamName, answerFor: answerFor,
    startHeartbeat: startHeartbeat, stopHeartbeat: stopHeartbeat,
    resetBuzzers: resetBuzzers,
    start: start, nextIntro: nextIntro,
    select: select, reveal: reveal, restore: restore, dismiss: dismiss,
    setRound: setRound, startFinal: startFinal, showClue: showClue, startTimer: startTimer,
    score: score, giveBoard: giveBoard, toggleShown: toggleShown, end: end
  };
}
