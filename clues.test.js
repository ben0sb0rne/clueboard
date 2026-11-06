// node clues.test.js
// Plain asserts, no framework and no dependency. The parser is the only piece of real logic
// in the project that is not driven by a browser, so it is the piece worth pinning down.

var assert = require("assert");
var C = require("./clues.js");

var HEAD = ["round", "category", "value", "clue", "image", "answer", "dd"];
function tsv(rows) {
  return [HEAD].concat(rows).map(function (r) { return r.join("\t"); }).join("\n");
}
function row(round, cat, value, clue, answer, dd) {
  return [round, cat, value || "", clue, "", answer, dd || ""];
}
// Five clues in one category, so a round is easy to build in a line.
function column(round, cat, prefix) {
  return [1, 2, 3, 4, 5].map(function (i) {
    return row(round, cat, "", prefix + " clue " + i, prefix + " answer " + i);
  });
}

var tests = {};

tests["a missing header column is reported, not guessed at"] = function () {
  var set = C.parseClueSet("round\tcategory\tclue\nUnhelpful\tROW\tText");
  assert.deepStrictEqual(set.rounds, {});
  assert.strictEqual(set.errors.length, 1);
  assert.match(set.errors[0], /header/);
  assert.match(set.errors[0], /answer/);
};

tests["nothing pasted says so rather than throwing"] = function () {
  assert.match(C.parseClueSet("").errors[0], /Nothing pasted/);
  assert.match(C.parseClueSet("   \n  \n").errors[0], /Nothing pasted/);
  assert.match(C.parseClueSet(null).errors[0], /Nothing pasted/);
};

tests["a blank value derives from row order, per round"] = function () {
  var set = C.parseClueSet(tsv(column(1, "ONE", "a").concat(column(2, "TWO", "b"))));
  assert.deepStrictEqual(
    set.rounds[1].cells[0].map(function (c) { return c.value; }),
    [200, 400, 600, 800, 1000]
  );
  assert.deepStrictEqual(
    set.rounds[2].cells[0].map(function (c) { return c.value; }),
    [400, 800, 1200, 1600, 2000]
  );
  assert.strictEqual(set.errors.length, 0);
};

tests["an explicit value is kept, currency and commas and all"] = function () {
  var set = C.parseClueSet(tsv([
    row(1, "ONE", "$1,500", "Odd money", "A"),
    row(1, "ONE", "600", "Plain", "B")
  ]));
  assert.strictEqual(set.rounds[1].cells[0][0].value, 1500);
  assert.strictEqual(set.rounds[1].cells[0][1].value, 600);
};

tests["an unparseable value falls back to the ladder, it does not become NaN"] = function () {
  var set = C.parseClueSet(tsv([row(1, "ONE", "lots", "Clue", "A")]));
  assert.strictEqual(set.rounds[1].cells[0][0].value, 200);
};

tests["a bad round is reported and that row is dropped"] = function () {
  var set = C.parseClueSet(tsv([
    row(9, "ONE", "", "Wrong round", "A"),
    row(1, "ONE", "", "Right round", "B")
  ]));
  assert.strictEqual(set.rounds[1].cats.length, 1);
  assert.strictEqual(set.rounds[1].cells[0][0].text, "Right round");
  assert.match(set.errors.join(" "), /Row 2.*expected 1, 2 or final/);
};

tests["a row missing its clue or its answer is reported"] = function () {
  var set = C.parseClueSet(tsv([
    row(1, "ONE", "", "", "Answer with no clue"),
    row(1, "ONE", "", "Clue with no answer", "")
  ]));
  assert.strictEqual(set.rounds[1], undefined);
  assert.strictEqual(set.errors.length, 2);
  assert.match(set.errors[0], /Row 2: needs both/);
  assert.match(set.errors[1], /Row 3: needs both/);
};

tests["a seventh category is left out and reported"] = function () {
  var rows = [];
  ["A", "B", "C", "D", "E", "F", "G"].forEach(function (name) {
    rows.push(row(1, name, "", "Clue " + name, "Answer " + name));
  });
  var set = C.parseClueSet(tsv(rows));
  assert.strictEqual(set.rounds[1].cats.length, 6);
  assert.ok(set.rounds[1].cats.indexOf("G") === -1);
  assert.match(set.errors.join(" "), /already has 6 categories.*"G"/);
};

tests["a sixth clue in one category is left out and reported"] = function () {
  var rows = column(1, "ONE", "a");
  rows.push(row(1, "ONE", "", "One too many", "Z"));
  var set = C.parseClueSet(tsv(rows));
  assert.strictEqual(set.rounds[1].cells[0].length, 5);
  assert.ok(JSON.stringify(set.rounds[1]).indexOf("One too many") === -1);
  assert.match(set.errors.join(" "), /already has 5 clues/);
};

tests["a short category is padded with blanks and reported"] = function () {
  var set = C.parseClueSet(tsv([
    row(1, "ONE", "", "Only clue", "A"),
    row(1, "TWO", "", "Another", "B")
  ]));
  assert.strictEqual(set.rounds[1].cells[0].length, 5);
  assert.deepStrictEqual(set.rounds[1].cells[0].slice(1), [null, null, null, null]);
  assert.match(set.errors.join(" "), /only 1 of 5 clues/);
};

tests["dd marks a daily double, whatever case it is typed in"] = function () {
  var set = C.parseClueSet(tsv([
    row(1, "ONE", "", "Plain", "A", ""),
    row(1, "ONE", "", "Lower", "B", "x"),
    row(1, "ONE", "", "Upper", "C", "X")
  ]));
  var dd = set.rounds[1].cells[0].slice(0, 3).map(function (c) { return c.dd; });
  assert.deepStrictEqual(dd, [false, true, true]);
};

tests["final rows are collected, and stay out of the board"] = function () {
  var set = C.parseClueSet(tsv([
    row(1, "ONE", "", "Board clue", "A"),
    row("final", "THE END", "", "Final clue", "Final answer")
  ]));
  assert.strictEqual(set.final.length, 1);
  assert.strictEqual(set.final[0].answer, "Final answer");
  assert.ok(JSON.stringify(set.rounds).indexOf("Final clue") === -1);
};

tests["blank lines and stray carriage returns are skipped"] = function () {
  var text = tsv(column(1, "ONE", "a")).split("\n").join("\r\n");
  var set = C.parseClueSet("\r\n" + text + "\r\n\r\n");
  assert.strictEqual(set.errors.length, 0);
  assert.strictEqual(set.rounds[1].cells[0].length, 5);
  assert.strictEqual(set.rounds[1].cells[0][4].text, "a clue 5");
};

tests["column order does not matter, the header decides"] = function () {
  var text = ["answer\tclue\tcategory\tround", "An answer\tA clue\tONE\t1"].join("\n");
  var set = C.parseClueSet(text);
  assert.strictEqual(set.rounds[1].cells[0][0].text, "A clue");
  assert.strictEqual(set.rounds[1].cells[0][0].answer, "An answer");
  assert.strictEqual(set.rounds[1].cells[0][0].value, 200);
};

// The one that matters: whatever else is wrong, the thing published to every student device
// must carry no clue text and no answers.
tests["the published grid leaks neither clue text nor answers"] = function () {
  var set = C.parseClueSet(tsv(
    column(1, "ALGEBRA", "secret").concat(column(1, "GEOMETRY", "hidden"))
  ));
  var published = JSON.stringify(C.roundGrid(set, 1));
  assert.ok(published.indexOf("secret") === -1, "clue text reached the grid");
  assert.ok(published.indexOf("hidden") === -1, "clue text reached the grid");
  assert.ok(published.indexOf("answer") === -1, "an answer reached the grid");
  assert.deepStrictEqual(JSON.parse(published).cats, ["ALGEBRA", "GEOMETRY"]);
  assert.deepStrictEqual(JSON.parse(published).values[0], [200, 400, 600, 800, 1000]);
};

tests["a blank cell publishes a zero value, so the board can blank it"] = function () {
  var set = C.parseClueSet(tsv([row(1, "ONE", "", "Only clue", "A")]));
  assert.deepStrictEqual(C.roundGrid(set, 1).values[0], [200, 0, 0, 0, 0]);
};

tests["roundGrid on a round that was never imported is null, not a crash"] = function () {
  var set = C.parseClueSet(tsv([row(1, "ONE", "", "Clue", "A")]));
  assert.strictEqual(C.roundGrid(set, 2), null);
};

tests["clueAt finds a clue and is null off the end of the board"] = function () {
  var set = C.parseClueSet(tsv(column(1, "ONE", "a")));
  assert.strictEqual(C.clueAt(set, 1, 0, 2).text, "a clue 3");
  assert.strictEqual(C.clueAt(set, 1, 0, 9), null);
  assert.strictEqual(C.clueAt(set, 1, 4, 0), null);
  assert.strictEqual(C.clueAt(set, 9, 0, 0), null);
};

tests["clueCount counts what is left, skipping spent cells and blanks"] = function () {
  var set = C.parseClueSet(tsv(
    column(1, "ONE", "a").concat([row(1, "TWO", "", "Lonely", "B")])
  ));
  assert.strictEqual(C.clueCount(set, 1, {}), 6);
  assert.strictEqual(C.clueCount(set, 1, undefined), 6);
  var used = {};
  used[C.cellKey(1, 0, 0)] = true;
  used[C.cellKey(1, 1, 0)] = true;
  assert.strictEqual(C.clueCount(set, 1, used), 4);
};

// Round 2 is a different board. Spending a cell in round 1 must not blank the cell behind it
// in round 2, and coming back to round 1 must find it as it was left.
tests["spent cells do not leak between rounds"] = function () {
  var set = C.parseClueSet(tsv(column(1, "ONE", "a").concat(column(2, "TWO", "b"))));
  var used = {};
  used[C.cellKey(1, 0, 0)] = true;
  assert.strictEqual(C.clueCount(set, 1, used), 4);
  assert.strictEqual(C.clueCount(set, 2, used), 5, "round 1 spent a round 2 cell");
  assert.notStrictEqual(C.cellKey(1, 0, 0), C.cellKey(2, 0, 0));
};

// The cap is the rule that decides how much of a game a team can throw away, so it is worth
// pinning down - and it is two different rules, which is exactly why.
tests["a Daily Double wager is capped by the top value on the board, not by the score"] =
function () {
  var set = C.parseClueSet(tsv(column(1, "ONE", "a")));
  var grid = C.roundGrid(set, 1);                 // top value 1000
  assert.strictEqual(C.wagerCap(0, grid), 1000, "a team on zero must still be able to play");
  assert.strictEqual(C.wagerCap(-400, grid), 1000, "a team in the red must still be able to play");
  assert.strictEqual(C.wagerCap(2500, grid), 2500, "a team ahead may wager everything it has");
  assert.strictEqual(C.wagerCap(1000, grid), 1000);
};

tests["a final wager is capped by the score, unless there is no score to cap it by"] =
function () {
  var set = C.parseClueSet(tsv(column(1, "ONE", "a")));
  var grid = C.roundGrid(set, 1);                 // top value 1000
  assert.strictEqual(C.wagerCap(600, grid, true), 600, "never more money than the team has");
  assert.strictEqual(C.wagerCap(2500, grid, true), 2500);
  assert.strictEqual(C.wagerCap(1, grid, true), 1, "a dollar is a score, and caps at a dollar");
  assert.strictEqual(C.wagerCap(0, grid, true), 1000, "nothing to bet is not a reason to sit out");
  assert.strictEqual(C.wagerCap(-400, grid, true), 1000, "nor is being in the red");
  assert.strictEqual(C.wagerCap(0, null, true), 0, "with no board there is no stake either");
};

tests["wagerCap survives a missing or empty grid"] = function () {
  assert.strictEqual(C.wagerCap(800, null), 800);
  assert.strictEqual(C.wagerCap(800, { values: [] }), 800);
  assert.strictEqual(C.wagerCap(-50, null), 0, "a cap is never negative");
};

tests["readWager takes a whole number of dollars, and refuses anything else"] = function () {
  assert.strictEqual(C.readWager("600"), 600);
  assert.strictEqual(C.readWager("$1,200"), 1200, "written the way the board writes it back");
  assert.strictEqual(C.readWager(" 500 "), 500);
  assert.strictEqual(C.readWager("0"), 0, "zero is a legal wager");
  assert.strictEqual(C.readWager("lots"), null, "letters are not a quiet $0");
  assert.strictEqual(C.readWager("12.9"), null, "whole dollars only");
  assert.strictEqual(C.readWager("-300"), null, "a negative wager is not a way to gain");
  assert.strictEqual(C.readWager(""), null);
  assert.strictEqual(C.readWager(null), null);
};

// stake() is the only function that moves a score, so it is the one worth pinning hardest.
tests["a clue is worth its value, a wagered clue is worth the wager"] = function () {
  var plain = { value: 600, dd: false };
  var dd = { value: 800, dd: true };
  var fin = { final: true, value: 0 };
  assert.strictEqual(C.stake(plain, { wager: 1500 }), 600, "a normal clue ignores any wager");
  assert.strictEqual(C.stake(dd, { wager: 1500 }), 1500, "a Daily Double pays the wager");
  assert.strictEqual(C.stake(fin, { wager: 2000 }), 2000, "Final pays the wager");
};

tests["a wagered clue with no wager is worth nothing, never NaN"] = function () {
  var dd = { value: 800, dd: true };
  assert.strictEqual(C.stake(dd, {}), 0, "a team that never wagered scores 0, not the value");
  assert.strictEqual(C.stake(dd, { wager: null }), 0);
  assert.strictEqual(C.stake({ final: true }, undefined), 0);
  assert.strictEqual(C.stake(null, { wager: 5 }), 0, "no clue is worth nothing");
  assert.strictEqual(C.stake({ value: "lots" }, {}), 0, "an unparseable value is 0, not NaN");
};

tests["extra final rows are reported rather than silently dropped"] = function () {
  var rows = [row(1, "ONE", "", "Board clue", "A"),
              row("final", "END A", "", "First final", "X"),
              row("final", "END B", "", "Second final", "Y")];
  var set = C.parseClueSet(tsv(rows));
  assert.strictEqual(set.final.length, 2, "both are still parsed");
  assert.match(set.errors.join(" "), /Only the first "final" row is played.*1 are ignored/);
  // One final warns about nothing; the short round-1 column warns on its own account.
  var one = C.parseClueSet(tsv(rows.slice(0, 2))).errors.join(" ");
  assert.ok(one.indexOf("final") === -1, "one final must not be reported: " + one);
};

var failed = 0;
Object.keys(tests).forEach(function (name) {
  try {
    tests[name]();
    console.log("  ok   " + name);
  } catch (e) {
    failed++;
    console.log("  FAIL " + name + "\n         " + e.message.split("\n")[0]);
  }
});
console.log("\n" + (Object.keys(tests).length - failed) + " passed, " + failed + " failed");
process.exit(failed ? 1 : 0);
