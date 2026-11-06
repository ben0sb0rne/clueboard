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

function cellKey(cat, row) { return cat + "-" + row; }

function clueAt(set, round, cat, row) {
  var r = set.rounds[round];
  return (r && r.cells[cat] && r.cells[cat][row]) || null;
}

// How many clues are still on the board, so the control screen can say when a round is spent.
function clueCount(set, round, used) {
  var r = set.rounds[round];
  if (!r) return 0;
  var left = 0;
  r.cells.forEach(function (column, c) {
    column.forEach(function (clue, row) {
      if (clue && !(used || {})[cellKey(c, row)]) left++;
    });
  });
  return left;
}

if (typeof module !== "undefined" && module.exports) {
  module.exports = {
    parseClueSet: parseClueSet, roundGrid: roundGrid, cellKey: cellKey,
    clueAt: clueAt, clueCount: clueCount, ROUND_VALUES: ROUND_VALUES
  };
}
