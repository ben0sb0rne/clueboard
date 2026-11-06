// Parsing a pasted clue set. Pure - no DOM, no Firebase - so clues.test.js can run it under
// node. Nothing here reaches the database: the control screen keeps the parsed set in memory
// and publishes only the grid, plus the current clue once it is on the projector.

var ROUND_VALUES = { 1: [200, 400, 600, 800, 1000], 2: [400, 800, 1200, 1600, 2000] };
var CATS_PER_ROUND = 6;
var ROWS_PER_CAT = 5;
var NEEDED = ["round", "category", "clue", "answer"];

// One clue per row beats a board-shaped grid: it parses in a few lines, it survives
// re-sorting, and long clue text does not fight a narrow column. Copying a range out of a
// spreadsheet gives tab-separated text, so this is a split rather than a CSV parser - which
// also means a clue may contain a comma, a quote or a semicolon without any escaping.
function parseClueSet(text) {
  var errors = [];
  var lines = String(text || "").split(/\r?\n/).filter(function (l) { return l.trim() !== ""; });
  if (!lines.length) return { rounds: {}, final: [], errors: ["Nothing pasted."] };

  var head = lines[0].split("\t").map(function (h) { return h.trim().toLowerCase(); });
  var col = {};
  head.forEach(function (h, i) { if (!(h in col)) col[h] = i; });   // a repeated header: first wins
  var missing = NEEDED.filter(function (n) { return !(n in col); });
  if (missing.length) {
    return { rounds: {}, final: [], errors: [
      "The first row has to be the header. Missing: " + missing.join(", ") + "."
    ] };
  }

  var at = function (cells, name) {
    return col[name] === undefined ? "" : String(cells[col[name]] || "").trim();
  };
  var rounds = {};
  var final = [];

  lines.slice(1).forEach(function (line, n) {
    var cells = line.split("\t");
    var where = "Row " + (n + 2);
    var roundRaw = at(cells, "round").toLowerCase();
    var category = at(cells, "category");
    var clueText = at(cells, "clue");
    var answer = at(cells, "answer");

    if (!clueText || !answer) {
      errors.push(where + ": needs both a clue and an answer.");
      return;
    }

    // Final is parsed and kept even though the board does not play it yet, so adding Final
    // Jeopardy later needs no change here and no re-import of anyone's spreadsheet.
    if (roundRaw === "final") {
      final.push({
        round: "final", cat: -1, row: -1, value: 0, category: category,
        text: clueText, image: at(cells, "image"), answer: answer, dd: false
      });
      return;
    }

    var round = Number(roundRaw);
    if (round !== 1 && round !== 2) {
      errors.push(where + ': round is "' + at(cells, "round") + '", expected 1, 2 or final.');
      return;
    }
    if (!category) {
      errors.push(where + ": needs a category.");
      return;
    }

    var r = rounds[round] || (rounds[round] = { cats: [], cells: [] });
    var c = r.cats.indexOf(category);
    if (c === -1) {
      if (r.cats.length >= CATS_PER_ROUND) {
        errors.push(where + ': round ' + round + ' already has ' + CATS_PER_ROUND +
          ' categories, so "' + category + '" is left out.');
        return;
      }
      c = r.cats.push(category) - 1;
      r.cells[c] = [];
    }
    if (r.cells[c].length >= ROWS_PER_CAT) {
      errors.push(where + ': "' + category + '" already has ' + ROWS_PER_CAT +
        ' clues, so this one is left out.');
      return;
    }

    var row = r.cells[c].length;
    // A blank value derives from row order. An explicit one is kept as typed, so a category
    // can run off the standard ladder without the grid disagreeing with the clue.
    var valRaw = at(cells, "value").replace(/[^0-9.\-]/g, "");
    var value = valRaw === "" ? ROUND_VALUES[round][row] : Number(valRaw);
    if (!isFinite(value)) value = ROUND_VALUES[round][row];

    r.cells[c].push({
      round: round, cat: c, row: row, value: value, category: category,
      text: clueText, image: at(cells, "image"), answer: answer,
      dd: at(cells, "dd").toLowerCase() === "x"
    });
  });

  if (final.length > 1) {
    errors.push("Only the first \"final\" row is played; the other " + (final.length - 1) +
      " are ignored.");
  }

  // Short categories are padded with blanks rather than rejected: a half-built board is worth
  // playing, and the gap is reported so it is a choice rather than a surprise at the lesson.
  Object.keys(rounds).forEach(function (k) {
    var r = rounds[k];
    while (r.cells.length < r.cats.length) r.cells.push([]);
    r.cells.forEach(function (column, c) {
      if (column.length && column.length < ROWS_PER_CAT) {
        errors.push('"' + r.cats[c] + '" (round ' + k + ') has only ' + column.length +
          ' of ' + ROWS_PER_CAT + ' clues; the rest of that column stays blank.');
      }
      while (column.length < ROWS_PER_CAT) column.push(null);
    });
  });

  return { rounds: rounds, final: final, errors: errors };
}

// What the board is allowed to know: category names and the value of each cell. No clue text
// and no answers, because every student device can read this.
function roundGrid(set, round) {
  var r = set.rounds[round];
  if (!r) return null;
  return {
    cats: r.cats.slice(),
    values: r.cells.map(function (column) {
      return column.map(function (clue) { return clue ? clue.value : 0; });
    })
  };
}

// The round is part of the key, so round 2 does not inherit round 1's spent cells - and
// going back to round 1 to fix a mis-tap finds it as it was left.
function cellKey(round, cat, row) { return round + "-" + cat + "-" + row; }

function clueAt(set, round, cat, row) {
  var r = set.rounds[round];
  return (r && r.cells[cat] && r.cells[cat][row]) || null;
}

// What one clue is worth to one team. A Daily Double and Final are worth the wager that team
// placed; every other clue is worth the value on the board. This is the only thing that moves
// a score, so it lives here where a test can reach it.
function stake(clue, team) {
  if (!clue) return 0;
  if (clue.final || clue.dd) return Number((team || {}).wager) || 0;
  return Number(clue.value) || 0;
}

// The cap on a wager: the larger of what a team already has and the top value on the board.
// Taking the larger is what lets a team on zero, or in the red, still play - capping at the
// score alone would lock them out, and a classroom has no reason to do that.
//
// Read off the published grid rather than ROUND_VALUES, so a set with its own value ladder
// caps against the board the students can actually see.
function wagerCap(score, grid, final) {
  var s = Math.max(0, Number(score) || 0);
  var top = 0;
  ((grid && grid.values) || []).forEach(function (column) {
    column.forEach(function (v) { if (Number(v) > top) top = Number(v); });
  });
  // The final clue is played for what the team has, and no more: a team on $600 cannot bet
  // $1,000 it has never won. A team on nothing, or in the red, is the exception - with no
  // money its cap would be $0 and the last clue of the game would be over for it before it
  // began, so it gets the top value on the board as a stake instead.
  if (final) return s > 0 ? s : top;
  // A Daily Double keeps the show's own rule throughout: a team on $200 that lands a $1,000
  // clue has to be able to play it for what it is worth.
  return Math.max(s, top);
}

// What a team typed, or null if it is not a wager at all. A wager is a whole number of
// dollars: "$1,500" and " 500 " are the same one, and the money() the board shows back is in
// that form, so both are accepted. Everything else is refused rather than coerced - the old
// strip-and-floor turned "abc", "12.5" and "-100" alike into a silent $0, which in Final is
// a team's whole game thrown away without a word to them.
function readWager(raw) {
  var s = String(raw == null ? "" : raw).replace(/[$,\s]/g, "");
  return /^[0-9]+$/.test(s) ? Number(s) : null;
}

// How many clues are still on the board, so the control screen can say when a round is spent.
function clueCount(set, round, used) {
  var r = set.rounds[round];
  if (!r) return 0;
  var left = 0;
  r.cells.forEach(function (column, c) {
    column.forEach(function (clue, row) {
      if (clue && !(used || {})[cellKey(round, c, row)]) left++;
    });
  });
  return left;
}

if (typeof module !== "undefined" && module.exports) {
  module.exports = {
    parseClueSet: parseClueSet, roundGrid: roundGrid, cellKey: cellKey,
    clueAt: clueAt, clueCount: clueCount, ROUND_VALUES: ROUND_VALUES,
    wagerCap: wagerCap, readWager: readWager, stake: stake
  };
}
