// The clue set: reading one in, and what a game is allowed to know about it. Pure - no DOM,
// no Firebase - so clues.test.js can run it under node. Nothing here reaches the database:
// the control screen keeps the set on its own device and publishes only the grid, plus the
// current clue once it is on the projector.
//
// A set is what the designer edits, and what a device keeps under clueboard-set:
//   { title, rounds: [{ id, name, cats: [name], prices: [one per row], cells: [cat][row] }],
//     final: { cat, clue, answer, media } or null }
// A square is { clue, answer, media, dd }, or null when it is empty. One with a clue and no
// answer, or an answer and no clue, is a draft: kept, shown in the designer, never played.

var MAX_COLS = 6;   // the board every screen is built for, and the most a phone's pick grid fits
var MAX_ROWS = 5;
var FINAL_TAB = "Final Clue";   // fixed: its tab name in the file, so no round may take it

// The prices a round starts with: round 1 is $200 to $1,000, round 2 double that, and so on.
function ladder(round, row) { return (row + 1) * 200 * round; }

// A round's name is its tab's name in the file, so it keeps to Excel's rules for one: 31
// characters at most, none of : \ / ? * [ ], and no apostrophe at either end.
function cleanRoundName(v) {
  return String(v == null ? "" : v).replace(/[:\\\/?*\[\]]/g, "").replace(/\s+/g, " ")
    .trim().slice(0, 31).replace(/^['\s]+|['\s]+$/g, "");
}

// What the Picture or video column, and the designer's link box, can hold. YouTube and
// Google Drive play on the board; a link straight to a picture or an .mp4 shows as it is.
function parseLink(v) {
  var u;
  try { u = new URL(String(v).trim()); } catch (err) { return null; }
  if (!/^https?:$/.test(u.protocol)) return null;
  var host = u.hostname.replace(/^(www|m)\./, "");
  var url = u.href;
  if (host === "youtu.be" || host === "youtube.com" || host === "youtube-nocookie.com") {
    var t = u.searchParams.get("t") || u.searchParams.get("start");
    return { kind: "video", host: "YouTube", url: url, start: t ? clock(t) : "" };
  }
  if (host === "drive.google.com") return { kind: "link", host: "Google Drive", url: url };
  if (/\.(png|jpe?g|gif|webp)$/i.test(u.pathname)) {
    return { kind: "picture", name: decodeURIComponent(u.pathname.split("/").pop()), url: url };
  }
  if (/\.mp4$/i.test(u.pathname)) return { kind: "video", host: "MP4", url: url, start: "" };
  return null;
}

// YouTube's t=42, 42s or 1m30s, as seconds, and as 0:42 for a person to read.
function seconds(t) {
  var m = /^(?:(\d+)m)?(\d+)s?$/.exec(t || "");
  return m ? Number(m[1] || 0) * 60 + Number(m[2]) : 0;
}
function clock(t) {
  var s = seconds(t);
  return s || /^0+s?$/.test(t) ? Math.floor(s / 60) + ":" + String(s % 60).padStart(2, "0") : "";
}

// Where the board plays a video from: YouTube's privacy-enhanced player, or Drive's own, or
// nothing for a link the board shows as it is.
function embedURL(media) {
  var u;
  try { u = new URL(media.url); } catch (e) { return ""; }
  if (media.host === "YouTube") {
    var id = u.hostname.indexOf("youtu.be") !== -1 ? u.pathname.slice(1).split("/")[0]
      : u.searchParams.get("v") || (/^\/(?:shorts|embed|live)\/([\w-]+)/.exec(u.pathname) || [])[1];
    if (!/^[\w-]{6,}$/.test(id || "")) return "";
    var start = seconds(u.searchParams.get("t") || u.searchParams.get("start"));
    return "https://www.youtube-nocookie.com/embed/" + id + "?rel=0&playsinline=1" + (start ? "&start=" + start : "");
  }
  if (media.host === "Google Drive") {
    var file = (/\/file\/d\/([\w-]+)/.exec(u.pathname) || [])[1] || u.searchParams.get("id");
    return /^[\w-]+$/.test(file || "") ? "https://drive.google.com/file/d/" + file + "/preview" : "";
  }
  return "";
}

// A .csv file. Fields may be quoted, with "" for a quote and line breaks inside the quotes.
function csvRows(text) {
  var s = String(text || "").replace(/^﻿/, "");
  var rows = [], row = [], field = "", quoted = false;
  for (var i = 0; i < s.length; i++) {
    var ch = s[i];
    if (quoted) {
      if (ch !== '"') field += ch;
      else if (s[i + 1] === '"') { field += '"'; i++; }
      else quoted = false;
    } else if (ch === '"' && field === "") quoted = true;
    else if (ch === ",") { row.push(field); field = ""; }
    else if (ch === "\n" || ch === "\r") {
      if (ch === "\r" && s[i + 1] === "\n") i++;
      row.push(field); rows.push(row); row = []; field = "";
    } else field += ch;
  }
  if (field || row.length) { row.push(field); rows.push(row); }
  return rows;
}

// Pasted rows, or a .tsv file. Copying a range out of a spreadsheet gives tab-separated text,
// so this is a split rather than a CSV parser - which also means a clue may contain a comma,
// a quote or a semicolon without any escaping.
function parseClueSet(text) {
  var rows = String(text || "").replace(/^﻿/, "").split(/\r?\n/)
    .map(function (line) { return line.split("\t"); });
  if (!rows.some(filled)) return { set: { title: "", rounds: [], final: null }, errors: ["Nothing pasted."] };
  return setFromTables([{ name: "", rows: rows }]);
}

var HEADS = {
  round: "round", category: "category", value: "value", clue: "clue", answer: "answer",
  "picture or video": "media", picture: "media", image: "media", video: "media",
  "daily double": "dd", dd: "dd"
};

function filled(cells) {
  return (cells || []).some(function (v) { return String(v == null ? "" : v).trim() !== ""; });
}

// Each table is { name, rows }: a tab of an .xlsx file, or the one nameless table in a paste,
// a .csv or a .tsv, with rows as arrays of strings. A tab is a round when its header has
// Category, Value, Clue and Answer; Final Clue is the final and Help is ignored. A table with
// a round column is the one-clue-per-row paste from before the designer: round is a number,
// a name, or final.
function setFromTables(tables) {
  var errors = [];
  var rounds = [];   // { key, name, sort, at, old, rows }
  var byKey = {};
  var finals = [];
  var finalTab = false;

  function roundFor(raw, old) {
    var n = String(raw).trim();
    var numbered = /^\d+$/.test(n);
    var name = numbered ? "Round " + Number(n) : cleanRoundName(n);
    var key = name.toLowerCase();
    if (!byKey[key]) {
      rounds.push(byKey[key] = { key: key, name: name, sort: numbered ? Number(n) : Infinity,
                                 at: rounds.length, old: old, rows: [] });
    }
    return byKey[key];
  }

  tables.forEach(function (table) {
    var tab = String(table.name || "").trim();
    var low = tab.toLowerCase();
    var rows = table.rows || [];
    if (low === "help") return;
    var h = rows.findIndex(filled);
    if (h === -1) return;

    var col = {};
    rows[h].forEach(function (v, i) {
      var name = HEADS[String(v == null ? "" : v).trim().toLowerCase().replace(/\s+/g, " ")];
      if (name && !(name in col)) col[name] = i;   // a repeated header: first wins
    });
    var at = function (cells, name) {
      var v = col[name] === undefined ? "" : cells[col[name]];
      return String(v == null ? "" : v).trim();
    };
    var where = function (i) { return (tab ? tab + ", row " : "Row ") + (i + 1); };
    var isFinal = low === FINAL_TAB.toLowerCase();
    // A picture belongs to the row its top-left corner is anchored in, whatever the column.
    var pics = {};
    (table.pictures || []).forEach(function (p) {
      if (!pics[p.row]) pics[p.row] = p.media;
      else errors.push(where(p.row) + " has two pictures; the first one is kept.");
    });
    (table.errors || []).forEach(function (e) { errors.push(e); });
    if (isFinal) finalTab = true;   // an empty Final Clue tab is a Final Clue still to write

    var need = isFinal ? ["clue", "answer"] : ["category", "clue", "answer"];
    if (tab && !isFinal && !("round" in col)) need = need.concat("value");
    var missing = need.filter(function (n) { return !(n in col); });
    if (missing.length) {
      // A tab of notes is not a mistake. One with half the columns probably is.
      if (!tab) errors.push("The first row has to be the header. Missing: " + missing.join(", ") + ".");
      else if (isFinal || "category" in col || "clue" in col) {
        errors.push("The " + tab + " tab is left out: its first row has no " + missing.join(", ") + ".");
      }
      return;
    }

    for (var i = h + 1; i < rows.length; i++) {
      var cells = rows[i] || [];
      if (!filled(cells)) continue;
      var mediaRaw = at(cells, "media");
      var media = pics[i] || (mediaRaw ? parseLink(mediaRaw) : null);
      if (mediaRaw && !media) {
        errors.push(where(i) + ': "' + mediaRaw + '" is not a link the board can show, so it is left out.');
      }
      var row = {
        where: where(i), cat: at(cells, "category"), value: at(cells, "value"),
        clue: at(cells, "clue"), answer: at(cells, "answer"), media: media,
        dd: /^(x|yes|true)$/i.test(at(cells, "dd"))
      };
      if (isFinal) { finals.push(row); continue; }
      if ("round" in col) {
        var r = at(cells, "round");
        if (/^final( clue)?$/i.test(r)) finals.push(row);
        else if (!r) errors.push(row.where + ": needs a round - a number, a name, or final.");
        else roundFor(r, true).rows.push(row);
      } else {
        roundFor(tab || "1", false).rows.push(row);
      }
    }
  });

  // Numbered rounds play in number order, wherever their rows were; named ones in the order
  // they first appear. A name no round may take becomes the next free "Round n".
  rounds.sort(function (a, b) { return a.sort - b.sort || a.at - b.at; });
  var taken = { help: true };
  taken[FINAL_TAB.toLowerCase()] = true;
  var set = { title: "", rounds: [], final: null };
  rounds.forEach(function (R) {
    var name = R.name;
    for (var n = set.rounds.length + 1; !name || taken[name.toLowerCase()]; n++) name = "Round " + n;
    taken[name.toLowerCase()] = true;
    var built = buildRound(R, set.rounds.length + 1, name, errors);
    if (built) { built.id = set.rounds.length + 1; set.rounds.push(built); }
  });

  var withSomething = finals.filter(function (f) { return f.cat || f.clue || f.answer || f.media; });
  if (withSomething.length || finalTab) {
    var f = withSomething[0] || { cat: "", clue: "", answer: "", media: null };
    set.final = { cat: f.cat, clue: f.clue, answer: f.answer, media: f.media };
  }
  if (withSomething.length > 1) {
    errors.push("Only the first final clue is played; the other " + (withSomething.length - 1) +
      " " + (withSomething.length === 2 ? "is" : "are") + " ignored.");
  }
  return { set: set, errors: errors };
}

function buildRound(R, k, name, errors) {
  var groups = [];   // { name, rows }, one per category
  var cap = 0;
  if (R.old) {
    // The paste from before the designer, one clue per row: a category is every row that
    // names it, wherever the row is, so a sheet sorted some other way still reads.
    var index = {};
    R.rows.forEach(function (row) {
      if (!row.cat) {
        if (row.clue || row.answer || row.media) errors.push(row.where + ": needs a category.");
        return;
      }
      if (!(row.cat in index)) { index[row.cat] = groups.length; groups.push({ name: row.cat, rows: [] }); }
      groups[index[row.cat]].rows.push(row);
    });
    groups.forEach(function (g) {
      g.rows.slice(MAX_ROWS).forEach(function (row) {
        errors.push(row.where + ': "' + g.name + '" already has ' + MAX_ROWS + ' clues, so this one is left out.');
      });
      g.rows = g.rows.slice(0, MAX_ROWS);
    });
  } else {
    // Board order, the way the designer writes a round: one row per square, empty ones
    // included, down the first category and then the next. A category is a run of rows with
    // one name, and a run longer than the board's rows is several categories side by side
    // that share a name - blank, most often, on a round still being written.
    var runs = [];
    R.rows.forEach(function (row) {
      var last = runs[runs.length - 1];
      if (last && last.name === row.cat) last.rows.push(row);
      else runs.push({ name: row.cat, rows: [row] });
    });
    // shortcut: the board's row count comes from the longest named category, or with none
    // named, from how many prices there are - so a round with every category unnamed, two
    // categories of one name side by side in a short round, or two rows at one price, can
    // reopen the wrong shape. Store the shape explicitly if anyone builds those.
    var named = runs.filter(function (run) { return run.name && run.rows.length <= MAX_ROWS; });
    var size = named.length
      ? Math.max.apply(null, named.map(function (run) { return run.rows.length; }))
      : Math.min(MAX_ROWS, distinctValues(R.rows) || MAX_ROWS);
    runs.forEach(function (run) {
      for (var i = 0; i < run.rows.length; i += size) {
        groups.push({ name: run.name, rows: run.rows.slice(i, i + size) });
      }
    });
  }

  groups.slice(MAX_COLS).forEach(function (g) {
    if (!g.rows.some(hasContent)) return;   // the empty columns a spreadsheet drags along
    errors.push(name + " already has " + MAX_COLS + " categories, so " +
      (g.name ? '"' + g.name + '"' : "an untitled one") + " is left out.");
  });
  groups = groups.slice(0, MAX_COLS);
  if (!groups.length) return null;

  groups.forEach(function (g) { cap = Math.max(cap, g.rows.length); });
  // Prices go by row, so a row's price is the first one its row gives, and the ladder fills
  // any row with none.
  var prices = [];
  for (var r = 0; r < cap; r++) {
    var given = groups.map(function (g) { return g.rows[r] && price(g.rows[r].value); })
      .filter(Boolean)[0];
    prices.push(given || ladder(k, r));
  }
  groups.forEach(function (g) {
    g.rows.forEach(function (row, r) {
      var p = price(row.value);
      if (p && p !== prices[r] && hasContent(row)) {
        errors.push(row.where + ": prices go by row, so this plays for $" + prices[r] +
          ", not $" + p + ".");
      }
    });
  });
  if (R.old) {
    groups.forEach(function (g) {
      if (g.rows.length < cap) {
        errors.push('"' + g.name + '" (' + name + ") has only " + g.rows.length + " of " + cap +
          " clues; the rest of that column stays blank.");
      }
    });
  }

  return {
    name: name,
    cats: groups.map(function (g) { return g.name; }),
    prices: prices,
    cells: groups.map(function (g) {
      var col = g.rows.map(function (row) {
        var s = { clue: row.clue, answer: row.answer, media: row.media, dd: row.dd };
        return hasContent(s) ? s : null;
      });
      while (col.length < cap) col.push(null);
      return col;
    })
  };
}

function hasContent(s) { return !!(s && (s.clue || s.answer || s.media || s.dd)); }

// A price is a whole number of dollars above nothing, as the designer's own box takes it;
// "$1,500" reads as 1500, and anything else falls back to the ladder.
function price(v) {
  var n = Math.round(Number(String(v == null ? "" : v).replace(/[^0-9.\-]/g, "")));
  return n > 0 ? Math.min(n, 99999) : 0;
}

function distinctValues(rows) {
  var seen = {};
  rows.forEach(function (row) { var p = price(row.value); if (p) seen[p] = true; });
  return Object.keys(seen).length;
}

// What this device keeps under clueboard-set: the set itself, as JSON. A set pasted before
// the designer existed was kept as the raw paste, so that still loads.
function readSet(raw) {
  if (!raw) return null;
  if (!/^\s*\{/.test(raw)) return parseClueSet(raw).set;
  try {
    var s = JSON.parse(raw);
    return s && Array.isArray(s.rounds) ? s : null;
  } catch (e) { return null; }
}

// The file, as tables: one tab per round, named after it, then the Final Clue, then Help.
// One row per square, empty ones included, in board order - down the first category, then
// the next - so the grid's shape survives a save and reopen. A picture is not in its cell:
// it sits over the clue's row, which the .xlsx writer draws.
var ROUND_HEAD = ["Category", "Value", "Clue", "Answer", "Picture or video", "Daily Double"];
var FINAL_HEAD = ["Category", "Clue", "Answer", "Picture or video"];
var HELP_ROWS = [
  "How this file works",
  "Every tab with Category, Value, Clue and Answer columns is a round, played in tab order. Rename and reorder them as you like.",
  "The " + FINAL_TAB + " tab is always last. This Help tab is ignored.",
  "One row per square, in board order: down the first category, then the next.",
  "Value is the square's price. A row with a category and a value but no clue is a square still to write.",
  "Maths goes between dollar signs:   $\\frac{3}{4}$    $x^2$    $\\sqrt{2}$    $180^\\circ$",
  "A picture sits in its clue's row. A video is a YouTube or Google Drive link.",
  "Daily Double: Yes, or leave it blank.",
  "Category, Clue and Answer are text columns, so 3/4 stays 3/4 and never turns into a date."
];
function setToTables(set) {
  var link = function (m) { return m && m.url && !m.id ? m.url : ""; };
  var tables = set.rounds.map(function (R) {
    var rows = [ROUND_HEAD.slice()], pictures = [];
    R.cats.forEach(function (cat, c) {
      R.prices.forEach(function (p, r) {
        var s = R.cells[c][r] || {};
        if (s.media && s.media.id) pictures.push({ row: rows.length, col: 4, media: s.media });
        rows.push([cat, p, s.clue || "", s.answer || "", link(s.media), s.dd ? "Yes" : ""]);
      });
    });
    return { name: R.name, kind: "round", rows: rows, pictures: pictures };
  });
  if (set.final) {
    var F = set.final;
    tables.push({ name: FINAL_TAB, kind: "final",
                  rows: [FINAL_HEAD.slice(), [F.cat, F.clue, F.answer, link(F.media)]],
                  pictures: F.media && F.media.id ? [{ row: 1, col: 3, media: F.media }] : [] });
  }
  tables.push({ name: "Help", kind: "help", rows: HELP_ROWS.map(function (t) { return [t]; }), pictures: [] });
  return tables;
}

// A square goes on the board once it has both halves.
function playable(s) {
  return !!(s && String(s.clue || "").trim() && String(s.answer || "").trim());
}

// What the board is allowed to know: category names and the value of each cell. No clue text
// and no answers, because every student device can read this. An empty square or a draft is
// a zero, which every screen draws as a cell with nothing behind it. Rounds count from 1.
function roundGrid(set, round) {
  var r = set && set.rounds[round - 1];
  if (!r) return null;
  return {
    cats: r.cats.slice(),
    values: r.cells.map(function (column) {
      return column.map(function (s, row) { return playable(s) ? r.prices[row] : 0; });
    })
  };
}

// The round is part of the key, so round 2 does not inherit round 1's spent cells - and
// going back to round 1 to fix a mis-tap finds it as it was left.
function cellKey(round, cat, row) { return round + "-" + cat + "-" + row; }

// A clue the way a game deals in it. Null for anything that is not on the board. Its media is
// for this device's own board, and is never published: game.js names what goes to the room.
function clueAt(set, round, cat, row) {
  var r = set && set.rounds[round - 1];
  var s = r && r.cells[cat] && r.cells[cat][row];
  if (!playable(s)) return null;
  return {
    round: round, cat: cat, row: row, value: r.prices[row], category: r.cats[cat],
    text: s.clue, answer: s.answer, dd: !!s.dd, media: s.media || null
  };
}

function finalClue(set) {
  var f = set && set.final;
  if (!playable(f)) return null;
  return { final: true, category: f.cat || "", text: f.clue, answer: f.answer, media: f.media || null };
}

// The first round with something to play, and the one after this; 0 when there is none.
// A round the designer added and never filled is skipped rather than put up empty.
function firstRound(set) { return nextRound(set, 0); }
function nextRound(set, round) {
  var rounds = (set && set.rounds) || [];
  for (var i = round; i < rounds.length; i++) if (clueCount(set, i + 1, {})) return i + 1;
  return 0;
}

// What one clue is worth to one team. A Daily Double and Final are worth the wager that team
// placed; every other clue is worth the value on the board. This is the only thing that moves
// a score, so it lives here where a test can reach it.
function stake(clue, team) {
  if (!clue) return 0;
  if (clue.final || clue.dd) return Number((team || {}).wager) || 0;
  return Number(clue.value) || 0;
}

// Who is still in the lobby. One rule, and it decides the whole of what a student sees: the
// name box, or the buzzer. Two halves, and both are load-bearing.
//
// Before the game there is nothing else to show. And a team that has not pressed Ready has
// not named itself - toggleReady refuses a blank name - so this is what catches the team
// joining after the intro has started, who used to arrive as "Joining..." and was never
// prompted out of it again.
//
// The !clue half is the guard: a room whose `started` write never landed would otherwise
// hold a ready team in here with a clue already on the board, which is the whole class.
//
// Says nothing about a game that is over - route() deals with that before it asks.
function inLobby(game, team) {
  return (!game.started && !game.clue) || !team.ready;
}

// What the clue card on a student's device shows, which is whatever the board is showing:
// the same rules as renderClue() in board.html, so a phone can never be ahead of the wall.
// While a Daily Double is wagered the board shows its splash and the team it belongs to;
// on that team's own phone the card names the category instead, because that is the one
// thing they are wagering on. The final clue shows its category while every team wagers.
// After that, the clue, and its answer only once the teacher has revealed it.
//
// key is the board's own key for a clue, so a buzz or a score arriving mid-clue is the same
// card and never restarts it.
function cardFor(game, myId) {
  var clue = game.clue;
  if (!clue) return { kind: "empty" };
  var key = clue.final ? "final" : clue.cat + "-" + clue.row;
  if (clue.dd && game.wagering) {
    return { kind: "title", key: key, title: "Daily Double",
             sub: clue.owner === myId ? clue.category || "" : clue.ownerName || "" };
  }
  if (clue.final && game.wagering) {
    return { kind: "title", key: key, title: "Final Clue", sub: clue.category || "" };
  }
  return { kind: "clue", key: key, text: clue.text || "",
           answer: game.reveal && clue.answer ? clue.answer : "" };
}

// The cap on a wager: the larger of what a team already has and the top value on the board.
// Taking the larger is what lets a team on zero, or in the red, still play - capping at the
// score alone would lock them out, and a classroom has no reason to do that.
//
// Read off the published grid rather than the set, so it caps against the board the students
// can actually see.
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
  var r = set && set.rounds[round - 1];
  if (!r) return 0;
  var left = 0;
  r.cells.forEach(function (column, c) {
    column.forEach(function (s, row) {
      if (playable(s) && !(used || {})[cellKey(round, c, row)]) left++;
    });
  });
  return left;
}

if (typeof module !== "undefined" && module.exports) {
  module.exports = {
    MAX_COLS: MAX_COLS, MAX_ROWS: MAX_ROWS, FINAL_TAB: FINAL_TAB, ladder: ladder,
    cleanRoundName: cleanRoundName, parseLink: parseLink, embedURL: embedURL, csvRows: csvRows,
    parseClueSet: parseClueSet, setFromTables: setFromTables, setToTables: setToTables,
    readSet: readSet,
    playable: playable, roundGrid: roundGrid, cellKey: cellKey, clueAt: clueAt,
    finalClue: finalClue, firstRound: firstRound, nextRound: nextRound, clueCount: clueCount,
    wagerCap: wagerCap, readWager: readWager, stake: stake, inLobby: inLobby, cardFor: cardFor
  };
}
