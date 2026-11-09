// node clues.test.js
// Plain asserts, no framework and no dependency. The parser is the only piece of real logic
// in the project that is not driven by a browser, so it is the piece worth pinning down.

var assert = require("assert");
var C = require("./clues.js");

// The paste from before the designer: one clue per row, with a round column.
var HEAD = ["round", "category", "value", "clue", "image", "answer", "dd"];
function tsv(rows) {
  return [HEAD].concat(rows).map(function (r) { return r.join("\t"); }).join("\n");
}
function row(round, cat, value, clue, answer, dd, image) {
  return [round, cat, value || "", clue, image || "", answer, dd || ""];
}
// Five clues in one category, so a round is easy to build in a line.
function column(round, cat, prefix) {
  return [1, 2, 3, 4, 5].map(function (i) {
    return row(round, cat, "", prefix + " clue " + i, prefix + " answer " + i);
  });
}
function parse(rows) { return C.parseClueSet(tsv(rows)); }
function first(p) { return p.set.rounds[0]; }
function sq(clue, answer, more) {
  return Object.assign({ clue: clue, answer: answer, media: null, dd: false }, more);
}
// A set the way the designer holds one.
function designed() {
  return {
    title: "", final: { cat: "THE END", clue: "Last one", answer: "Done", media: null },
    rounds: [{
      id: 1, name: "Round 1", cats: ["ALGEBRA", "", ""], prices: [100, 300],
      cells: [[sq("3/4 of 8", "6", { dd: true }), null],
              [null, sq("A clue still being written", "")],
              [sq("", "An answer with no clue yet"), sq("Watch this", "Vertical angles",
                { media: C.parseLink("https://youtu.be/abc?t=42") })]]
    }, {
      id: 2, name: "Wrap-up", cats: ["", "", "", "", "", ""], prices: [400, 800, 1200, 1600, 2000],
      cells: [0, 1, 2, 3, 4, 5].map(function () { return [null, null, null, null, null]; })
    }]
  };
}
function shape(set) {
  return set.rounds.map(function (R) { return { name: R.name, cats: R.cats, prices: R.prices, cells: R.cells }; });
}

var tests = {};

tests["a missing header column is reported, not guessed at"] = function () {
  var p = C.parseClueSet("round\tcategory\tclue\nUnhelpful\tROW\tText");
  assert.deepStrictEqual(p.set.rounds, []);
  assert.strictEqual(p.errors.length, 1);
  assert.match(p.errors[0], /header/);
  assert.match(p.errors[0], /answer/);
};

tests["nothing pasted says so rather than throwing"] = function () {
  assert.match(C.parseClueSet("").errors[0], /Nothing pasted/);
  assert.match(C.parseClueSet("   \n  \n").errors[0], /Nothing pasted/);
  assert.match(C.parseClueSet(null).errors[0], /Nothing pasted/);
};

tests["a blank value derives from row order, per round"] = function () {
  var p = parse(column(1, "ONE", "a").concat(column(2, "TWO", "b")));
  assert.deepStrictEqual(p.set.rounds[0].prices, [200, 400, 600, 800, 1000]);
  assert.deepStrictEqual(p.set.rounds[1].prices, [400, 800, 1200, 1600, 2000]);
  assert.deepStrictEqual(p.set.rounds.map(function (R) { return R.name; }), ["Round 1", "Round 2"]);
  assert.strictEqual(p.errors.length, 0);
};

tests["an explicit value is kept, currency and commas and all"] = function () {
  var p = parse([row(1, "ONE", "$1,500", "Odd money", "A"), row(1, "ONE", "600", "Plain", "B")]);
  assert.deepStrictEqual(first(p).prices, [1500, 600]);
};

tests["an unparseable or negative value falls back to the ladder, it does not become NaN"] = function () {
  var p = parse([row(1, "ONE", "lots", "Clue", "A"), row(1, "ONE", "-300", "Clue", "B")]);
  assert.deepStrictEqual(first(p).prices, [200, 400]);
};

// Prices go by row, as the designer has them, so a value that disagrees with its row is not
// quietly kept for one cell - it is overruled, and said so.
tests["prices go by row, and a clue priced against its row is reported"] = function () {
  var p = parse([row(1, "ONE", "200", "A", "a"), row(1, "TWO", "300", "B", "b")]);
  assert.deepStrictEqual(first(p).prices, [200]);
  assert.match(p.errors.join(" "), /Row 3: prices go by row, so this plays for \$200, not \$300/);
};

tests["any round makes a round, and numbered ones play in number order"] = function () {
  var p = parse([row(3, "THREE", "", "c", "C"), row(1, "ONE", "", "a", "A"),
                 row("Lightning", "FAST", "", "f", "F"), row(2, "TWO", "", "b", "B")]);
  assert.deepStrictEqual(p.set.rounds.map(function (R) { return R.name; }),
    ["Round 1", "Round 2", "Round 3", "Lightning"]);
  assert.deepStrictEqual(p.set.rounds.map(function (R) { return R.id; }), [1, 2, 3, 4]);
  assert.strictEqual(p.errors.length, 0);
};

tests["a row with no round is reported and dropped"] = function () {
  var p = parse([row("", "ONE", "", "Nowhere", "A"), row(1, "ONE", "", "Right round", "B")]);
  assert.strictEqual(first(p).cells[0][0].clue, "Right round");
  assert.match(p.errors.join(" "), /Row 2: needs a round/);
};

tests["round names keep to Excel's rules for a tab, and Help and Final Clue are taken"] = function () {
  assert.strictEqual(C.cleanRoundName("  Q1: Fractions / [part] *2*? "), "Q1 Fractions part 2");
  assert.strictEqual(C.cleanRoundName("'quoted'"), "quoted");
  assert.strictEqual(C.cleanRoundName("x".repeat(40)).length, 31);
  var p = parse([row("Help", "ONE", "", "a", "A")]);
  assert.strictEqual(first(p).name, "Round 1", "a round called Help would vanish on reopen");
};

// The old parser dropped these. A half-written square is work in progress: the designer keeps
// it and shows what is missing, and the game leaves it off the board.
tests["a half-written row is kept as a draft, and never reaches the board"] = function () {
  var p = parse([row(1, "ONE", "", "", "Answer with no clue"), row(1, "ONE", "", "Clue with no answer", ""),
                 row(1, "ONE", "", "Whole", "Yes")]);
  assert.strictEqual(p.errors.length, 0);
  assert.deepStrictEqual(first(p).cells[0].map(function (s) { return [s.clue, s.answer]; }),
    [["", "Answer with no clue"], ["Clue with no answer", ""], ["Whole", "Yes"]]);
  assert.deepStrictEqual(C.roundGrid(p.set, 1).values[0], [0, 0, 600]);
  assert.strictEqual(C.clueAt(p.set, 1, 0, 0), null);
  assert.strictEqual(C.clueAt(p.set, 1, 0, 1), null);
  assert.strictEqual(C.clueCount(p.set, 1, {}), 1);
};

tests["a seventh category is left out and reported"] = function () {
  var rows = ["A", "B", "C", "D", "E", "F", "G"].map(function (name) {
    return row(1, name, "", "Clue " + name, "Answer " + name);
  });
  var p = parse(rows);
  assert.strictEqual(first(p).cats.length, 6);
  assert.ok(first(p).cats.indexOf("G") === -1);
  assert.match(p.errors.join(" "), /Round 1 already has 6 categories, so "G" is left out/);
};

tests["a sixth clue in one category is left out and reported"] = function () {
  var rows = column(1, "ONE", "a");
  rows.push(row(1, "ONE", "", "One too many", "Z"));
  var p = parse(rows);
  assert.strictEqual(first(p).cells[0].length, 5);
  assert.ok(JSON.stringify(p.set).indexOf("One too many") === -1);
  assert.match(p.errors.join(" "), /already has 5 clues/);
};

tests["the board is as deep as the longest category, and a short one is padded and reported"] = function () {
  var p = parse(column(1, "ONE", "a").concat([row(1, "TWO", "", "Only clue", "B")]));
  assert.strictEqual(first(p).cells[1].length, 5);
  assert.deepStrictEqual(first(p).cells[1].slice(1), [null, null, null, null]);
  assert.match(p.errors.join(" "), /only 1 of 5 clues/);
  var shallow = parse([row(1, "ONE", "", "a", "A"), row(1, "TWO", "", "b", "B")]);
  assert.deepStrictEqual(first(shallow).prices, [200], "three clues a category is a three-row board");
  assert.strictEqual(shallow.errors.length, 0);
};

tests["a daily double is x or yes, whatever case it is typed in"] = function () {
  var p = parse([row(1, "ONE", "", "Plain", "A", ""), row(1, "ONE", "", "Lower", "B", "x"),
                 row(1, "ONE", "", "Upper", "C", "X"), row(1, "ONE", "", "Word", "D", "Yes")]);
  assert.deepStrictEqual(first(p).cells[0].slice(0, 4).map(function (s) { return s.dd; }),
    [false, true, true, true]);
};

tests["a final row is the final clue, and stays out of the board"] = function () {
  var p = parse([row(1, "ONE", "", "Board clue", "A"), row("final", "THE END", "", "Final clue", "Final answer")]);
  assert.deepStrictEqual(p.set.final, { cat: "THE END", clue: "Final clue", answer: "Final answer", media: null });
  assert.ok(JSON.stringify(p.set.rounds).indexOf("Final clue") === -1);
  assert.strictEqual(C.finalClue(p.set).answer, "Final answer");
};

tests["extra final rows are reported rather than silently dropped"] = function () {
  var rows = [row(1, "ONE", "", "Board clue", "A"), row("final", "END A", "", "First final", "X"),
              row("final", "END B", "", "Second final", "Y")];
  var p = parse(rows);
  assert.strictEqual(p.set.final.clue, "First final");
  assert.match(p.errors.join(" "), /Only the first final clue is played; the other 1 is ignored/);
  assert.strictEqual(parse(rows.slice(0, 2)).errors.length, 0, "one final reports nothing");
};

tests["a final clue needs both halves to be played"] = function () {
  var p = parse([row(1, "ONE", "", "Board clue", "A"), row("final", "THE END", "", "Half a final", "")]);
  assert.strictEqual(p.set.final.clue, "Half a final", "kept, for the designer");
  assert.strictEqual(C.finalClue(p.set), null, "not played");
};

tests["blank lines and stray carriage returns are skipped"] = function () {
  var text = tsv(column(1, "ONE", "a")).split("\n").join("\r\n");
  var p = C.parseClueSet("\r\n" + text + "\r\n\r\n");
  assert.strictEqual(p.errors.length, 0);
  assert.strictEqual(first(p).cells[0].length, 5);
  assert.strictEqual(first(p).cells[0][4].clue, "a clue 5");
};

tests["column order does not matter, the header decides"] = function () {
  var p = C.parseClueSet(["answer\tclue\tcategory\tround", "An answer\tA clue\tONE\t1"].join("\n"));
  assert.deepStrictEqual(first(p).cells[0][0], sq("A clue", "An answer"));
  assert.deepStrictEqual(first(p).prices, [200]);
};

tests["rows copied out of a round tab, with no round column, are one round"] = function () {
  var p = C.parseClueSet(["Category\tValue\tClue\tAnswer\tPicture or video\tDaily Double",
    "ONE\t$500\tA clue\tAn answer\t\tYes"].join("\n"));
  assert.strictEqual(first(p).name, "Round 1");
  assert.deepStrictEqual(first(p).prices, [500]);
  assert.strictEqual(first(p).cells[0][0].dd, true);
};

tests["a link in the picture column is kept; anything else is reported"] = function () {
  var p = parse([row(1, "ONE", "", "Watch", "A", "", "https://www.youtube.com/watch?v=abc&t=90"),
                 row(1, "ONE", "", "Look", "B", "", "triangle.png")]);
  assert.deepStrictEqual(first(p).cells[0][0].media,
    { kind: "video", host: "YouTube", url: "https://www.youtube.com/watch?v=abc&t=90", start: "1:30" });
  assert.strictEqual(first(p).cells[0][1].media, null);
  assert.match(p.errors.join(" "), /"triangle.png" is not a link the board can show/);
};

tests["parseLink knows the board's kinds of link, and nothing else"] = function () {
  assert.strictEqual(C.parseLink("https://youtu.be/abc").start, "");
  assert.strictEqual(C.parseLink("https://youtu.be/abc?t=42s").start, "0:42");
  assert.strictEqual(C.parseLink("https://drive.google.com/file/d/xyz/view").host, "Google Drive");
  assert.deepStrictEqual(C.parseLink("https://example.com/pics/right%20angle.PNG"),
    { kind: "picture", name: "right angle.PNG", url: "https://example.com/pics/right%20angle.PNG" });
  assert.strictEqual(C.parseLink("https://example.com/clip.mp4").host, "MP4");
  assert.strictEqual(C.parseLink("https://example.com/page"), null);
  assert.strictEqual(C.parseLink("javascript:alert(1)//x.png"), null);
  assert.strictEqual(C.parseLink("not a link"), null);
};

tests["a video plays from its own site's player, and only from there"] = function () {
  var yt = function (url) { return C.embedURL(C.parseLink(url)); };
  assert.strictEqual(yt("https://youtu.be/dQw4w9WgXcQ?t=1m5s"),
    "https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ?rel=0&playsinline=1&start=65");
  assert.strictEqual(yt("https://www.youtube.com/watch?v=dQw4w9WgXcQ"),
    "https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ?rel=0&playsinline=1");
  assert.strictEqual(yt("https://youtube.com/shorts/dQw4w9WgXcQ"),
    "https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ?rel=0&playsinline=1");
  assert.strictEqual(yt("https://www.youtube.com/watch?list=abc"), "", "a playlist with no video is not a video");
  assert.strictEqual(yt("https://drive.google.com/file/d/1AbC-xyz_9/view?usp=sharing"),
    "https://drive.google.com/file/d/1AbC-xyz_9/preview");
  assert.strictEqual(yt("https://drive.google.com/open?id=1AbC"), "https://drive.google.com/file/d/1AbC/preview");
  assert.strictEqual(yt("https://example.com/clip.mp4"), "", "an .mp4 plays as it is, in a video element");
  assert.strictEqual(C.parseLink("https://youtu.be/abc?t=0").start, "0:00");
};

tests["a .csv reads quotes, doubled quotes and line breaks inside a cell"] = function () {
  var rows = C.csvRows('\uFEFFcategory,clue,answer\r\nONE,"Say ""hi"", then, wave","two\nlines"\r\nTWO,plain,3/4\n');
  assert.deepStrictEqual(rows, [["category", "clue", "answer"],
    ["ONE", 'Say "hi", then, wave', "two\nlines"], ["TWO", "plain", "3/4"]]);
};

// What the designer writes is what it reads back: every round and its name, the grid's
// shape with its unnamed categories and empty squares, prices, drafts, Daily Doubles, links
// and the Final Clue. The .xlsx is only these tables on disk.
tests["a set written as tables reads back as the same set"] = function () {
  var set = designed();
  var back = C.setFromTables(C.setToTables(set));
  assert.deepStrictEqual(back.errors, []);
  assert.deepStrictEqual(shape(back.set), shape(set));
  assert.deepStrictEqual(back.set.final, set.final);
};

tests["the tables are one tab per round, then Final Clue, then Help"] = function () {
  var tables = C.setToTables(designed());
  assert.deepStrictEqual(tables.map(function (t) { return t.name; }), ["Round 1", "Wrap-up", "Final Clue", "Help"]);
  assert.deepStrictEqual(tables[0].rows[0], ["Category", "Value", "Clue", "Answer", "Picture or video", "Daily Double"]);
  assert.deepStrictEqual(tables[0].rows[1], ["ALGEBRA", 100, "3/4 of 8", "6", "", "Yes"]);
  assert.strictEqual(tables[0].rows.length, 1 + 3 * 2, "one row per square, empty ones too");
  assert.deepStrictEqual(tables[2].rows[0], ["Category", "Clue", "Answer", "Picture or video"]);
};

// A picture is not text in a cell: it sits over its clue's row. The writer says which row,
// and a picture read back from that row is that square's again - in the Final Clue too.
tests["a picture travels beside its row, and lands back in its square"] = function () {
  var set = designed();
  var pic = { kind: "picture", id: "abc123", name: "triangle.png", size: 1000, type: "image/png", w: 400, h: 300 };
  set.rounds[0].cells[1][1].media = pic;
  set.final.media = pic;
  var tables = C.setToTables(set);
  assert.deepStrictEqual(tables[0].pictures, [{ row: 4, col: 4, media: pic }]);
  assert.strictEqual(tables[0].rows[4][4], "", "the cell under a picture stays empty");
  assert.deepStrictEqual(tables[2].pictures, [{ row: 1, col: 3, media: pic }]);
  var back = C.setFromTables(tables);
  assert.deepStrictEqual(shape(back.set), shape(set));
  assert.deepStrictEqual(back.set.final.media, pic);
};

tests["a second picture in one row is reported, and the first is kept"] = function () {
  var one = { kind: "picture", id: "one" }, two = { kind: "picture", id: "two" };
  var p = C.setFromTables([{ name: "Round 1", rows: [["Category", "Value", "Clue", "Answer"], ["ONE", 200, "a", "A"]],
    pictures: [{ row: 1, col: 4, media: one }, { row: 1, col: 2, media: two }] }]);
  assert.strictEqual(p.set.rounds[0].cells[0][0].media, one);
  assert.deepStrictEqual(p.errors, ["Round 1, row 2 has two pictures; the first one is kept."]);
};

tests["a clue hands the board its media, and the published grid still has none"] = function () {
  var set = designed();
  set.rounds[0].cells[0][0].media = { kind: "picture", id: "secretpic" };
  assert.strictEqual(C.clueAt(set, 1, 0, 0).media.id, "secretpic");
  assert.ok(JSON.stringify(C.roundGrid(set, 1)).indexOf("secretpic") === -1);
};

tests["an empty Final Clue tab reopens as a Final Clue still to write"] = function () {
  var set = designed();
  set.final = { cat: "", clue: "", answer: "", media: null };
  assert.deepStrictEqual(C.setFromTables(C.setToTables(set)).set.final, set.final);
  delete set.final;
  set.final = null;
  assert.strictEqual(C.setFromTables(C.setToTables(set)).set.final, null);
};

tests["tabs that are not rounds are skipped, and a half-made one is reported"] = function () {
  var p = C.setFromTables([
    { name: "Notes", rows: [["Remember to bring the clicker"]] },
    { name: "Round 1", rows: [["Category", "Value", "Clue", "Answer"], ["ONE", 200, "a", "A"]] },
    { name: "Draft", rows: [["Category", "Clue", "Answer"], ["ONE", "b", "B"]] },
    { name: "Help", rows: [["Category", "Value", "Clue", "Answer"], ["ONE", 200, "c", "C"]] }
  ]);
  assert.deepStrictEqual(p.set.rounds.map(function (R) { return R.name; }), ["Round 1"]);
  assert.deepStrictEqual(p.errors, ["The Draft tab is left out: its first row has no value."]);
};

tests["two unnamed categories side by side reopen as two"] = function () {
  var rows = [["Category", "Value", "Clue", "Answer"]];
  ["A", "B", "", "", "E", "F"].forEach(function (cat) {
    rows.push([cat, 200, "", ""], [cat, 400, "", ""]);
  });
  var R = C.setFromTables([{ name: "Round 1", rows: rows }]).set.rounds[0];
  assert.deepStrictEqual(R.cats, ["A", "B", "", "", "E", "F"]);
  assert.deepStrictEqual(R.prices, [200, 400]);
};

tests["the stored set is the set itself, and a paste stored before the designer still loads"] = function () {
  var set = designed();
  assert.deepStrictEqual(C.readSet(JSON.stringify(set)), set);
  assert.strictEqual(C.readSet(tsv(column(1, "ONE", "a"))).rounds[0].cells[0][2].clue, "a clue 3");
  assert.strictEqual(C.readSet(""), null);
  assert.strictEqual(C.readSet(null), null);
  assert.strictEqual(C.readSet("{broken"), null);
  assert.strictEqual(C.readSet('{"rounds": "no"}'), null);
};

// A round the designer added and never filled is not a round to send a class to.
tests["the game starts on the first round with clues, and skips any without"] = function () {
  var set = designed();
  set.rounds.push({ id: 3, name: "Last", cats: ["ONE"], prices: [500], cells: [[sq("q", "a")]] });
  assert.strictEqual(C.firstRound(set), 1);
  assert.strictEqual(C.nextRound(set, 1), 3, "Wrap-up is empty");
  assert.strictEqual(C.nextRound(set, 3), 0);
  assert.strictEqual(C.firstRound({ rounds: [] }), 0);
  assert.strictEqual(C.firstRound(null), 0);
};

// The one that matters: whatever else is wrong, the thing published to every student device
// must carry no clue text and no answers.
tests["the published grid leaks neither clue text nor answers"] = function () {
  var p = parse(column(1, "ALGEBRA", "secret").concat(column(1, "GEOMETRY", "hidden")));
  var published = JSON.stringify(C.roundGrid(p.set, 1));
  assert.ok(published.indexOf("secret") === -1, "clue text reached the grid");
  assert.ok(published.indexOf("hidden") === -1, "clue text reached the grid");
  assert.ok(published.indexOf("answer") === -1, "an answer reached the grid");
  assert.deepStrictEqual(JSON.parse(published).cats, ["ALGEBRA", "GEOMETRY"]);
  assert.deepStrictEqual(JSON.parse(published).values[0], [200, 400, 600, 800, 1000]);
};

tests["a blank cell publishes a zero value, so the board can blank it"] = function () {
  var p = parse(column(1, "ONE", "a").concat([row(1, "TWO", "", "Only clue", "A")]));
  assert.deepStrictEqual(C.roundGrid(p.set, 1).values[1], [200, 0, 0, 0, 0]);
};

tests["roundGrid on a round that was never imported is null, not a crash"] = function () {
  var p = parse([row(1, "ONE", "", "Clue", "A")]);
  assert.strictEqual(C.roundGrid(p.set, 2), null);
  assert.strictEqual(C.roundGrid(null, 1), null);
};

tests["clueAt finds a clue and is null off the end of the board"] = function () {
  var p = parse(column(1, "ONE", "a"));
  assert.strictEqual(C.clueAt(p.set, 1, 0, 2).text, "a clue 3");
  assert.strictEqual(C.clueAt(p.set, 1, 0, 2).value, 600);
  assert.strictEqual(C.clueAt(p.set, 1, 0, 9), null);
  assert.strictEqual(C.clueAt(p.set, 1, 4, 0), null);
  assert.strictEqual(C.clueAt(p.set, 9, 0, 0), null);
};

tests["clueCount counts what is left, skipping spent cells and blanks"] = function () {
  var p = parse(column(1, "ONE", "a").concat([row(1, "TWO", "", "Lonely", "B")]));
  assert.strictEqual(C.clueCount(p.set, 1, {}), 6);
  assert.strictEqual(C.clueCount(p.set, 1, undefined), 6);
  var used = {};
  used[C.cellKey(1, 0, 0)] = true;
  used[C.cellKey(1, 1, 0)] = true;
  assert.strictEqual(C.clueCount(p.set, 1, used), 4);
};

// Round 2 is a different board. Spending a cell in round 1 must not blank the cell behind it
// in round 2, and coming back to round 1 must find it as it was left.
tests["spent cells do not leak between rounds"] = function () {
  var p = parse(column(1, "ONE", "a").concat(column(2, "TWO", "b")));
  var used = {};
  used[C.cellKey(1, 0, 0)] = true;
  assert.strictEqual(C.clueCount(p.set, 1, used), 4);
  assert.strictEqual(C.clueCount(p.set, 2, used), 5, "round 1 spent a round 2 cell");
  assert.notStrictEqual(C.cellKey(1, 0, 0), C.cellKey(2, 0, 0));
};

// The cap is the rule that decides how much of a game a team can throw away, so it is worth
// pinning down - and it is two different rules, which is exactly why.
tests["a Daily Double wager is capped by the top value on the board, not by the score"] =
function () {
  var grid = C.roundGrid(parse(column(1, "ONE", "a")).set, 1);                 // top value 1000
  assert.strictEqual(C.wagerCap(0, grid), 1000, "a team on zero must still be able to play");
  assert.strictEqual(C.wagerCap(-400, grid), 1000, "a team in the red must still be able to play");
  assert.strictEqual(C.wagerCap(2500, grid), 2500, "a team ahead may wager everything it has");
  assert.strictEqual(C.wagerCap(1000, grid), 1000);
};

tests["a final wager is capped by the score, unless there is no score to cap it by"] =
function () {
  var grid = C.roundGrid(parse(column(1, "ONE", "a")).set, 1);                 // top value 1000
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

// The rule that decides whether a student sees the buzzer or the name box. Three booleans,
// so the whole table fits - and getting one of them wrong locks a class out of its own game.
var CLUE = { category: "SLOPE & INTERCEPT", value: 200 };

tests["a team that has not pressed Ready is in the lobby, whatever else is happening"] = function () {
  assert.strictEqual(C.inLobby({}, {}), true);                                   // nothing yet
  assert.strictEqual(C.inLobby({ started: true }, { ready: false }), true);      // joined late
  assert.strictEqual(C.inLobby({ started: true, clue: CLUE }, {}), true);        // mid-clue
  assert.strictEqual(C.inLobby({ clue: CLUE }, { ready: false }), true);
};

tests["a ready team is in the lobby until the game starts, and out of it after"] = function () {
  assert.strictEqual(C.inLobby({}, { ready: true }), true);
  assert.strictEqual(C.inLobby({ started: true }, { ready: true }), false);
  assert.strictEqual(C.inLobby({ started: true, clue: CLUE }, { ready: true }), false);
};

tests["a clue on the board lets a ready team through, even if started never landed"] = function () {
  // The guard. Without it one dropped write strands the whole class in the lobby with the
  // clue already up, and nothing on their phones says why.
  assert.strictEqual(C.inLobby({ clue: CLUE }, { ready: true }), false);
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
