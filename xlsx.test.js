// node xlsx.test.js
// The zip and the writer, which run under node. Reading needs DOMParser, so it is checked in a
// browser by xlsx.test.html, against this writer's files and against files from the apps.

var assert = require("assert");
var C = require("./clues.js");
global.setToTables = C.setToTables;
var X = require("./xlsx.js");

function set() {
  return {
    title: "T", final: { cat: "THE END", clue: "Last & best <one>", answer: "Done", media: null },
    rounds: [{ id: 1, name: "Round 1", cats: ["FRACTIONS", ""], prices: [200, 400],
      cells: [[{ clue: "3/4 of 8", answer: "6", media: null, dd: true }, null],
              [{ clue: "-x+2 when x = 1", answer: "1", media: null, dd: false }, null]] }]
  };
}

var tests = {};

tests["crc32 matches the standard check value"] = function () {
  assert.strictEqual(X.crc32(new TextEncoder().encode("123456789")), 0xCBF43926);
};

tests["column letters run A to Z, then AA"] = function () {
  assert.deepStrictEqual([0, 5, 25, 26, 27].map(X.colName), ["A", "F", "Z", "AA", "AB"]);
};

tests["a stored zip reads back byte for byte"] = function () {
  var blob = X.zipStored([{ name: "a.txt", data: "hello" }, { name: "dir/b.bin", data: new Uint8Array([0, 255, 7]) }]);
  return blob.arrayBuffer().then(X.unzip).then(function (files) {
    assert.deepStrictEqual(Object.keys(files).sort(), ["a.txt", "dir/b.bin"]);
    assert.strictEqual(new TextDecoder().decode(files["a.txt"]), "hello");
    assert.deepStrictEqual(Array.from(files["dir/b.bin"]), [0, 255, 7]);
  });
};

tests["a game is a workbook: one tab per round, Final Clue, Help"] = function () {
  return X.writeXlsx(set()).then(function (r) { return r.blob.arrayBuffer(); }).then(X.unzip).then(function (files) {
    var text = function (n) { return new TextDecoder().decode(files[n]); };
    assert.deepStrictEqual(Object.keys(files), ["[Content_Types].xml", "_rels/.rels", "xl/workbook.xml",
      "xl/_rels/workbook.xml.rels", "xl/styles.xml", "xl/sharedStrings.xml",
      "xl/worksheets/sheet1.xml", "xl/worksheets/sheet2.xml", "xl/worksheets/sheet3.xml"]);
    assert.deepStrictEqual(text("xl/workbook.xml").match(/name="[^"]*"/g),
      ['name="Round 1"', 'name="Final Clue"', 'name="Help"']);
    var sst = text("xl/sharedStrings.xml");
    assert.ok(sst.indexOf(">3/4 of 8<") !== -1, "a clue is a string, not a number or a date");
    assert.ok(sst.indexOf("Last &amp; best &lt;one&gt;") !== -1, "text is escaped");
    var sheet = text("xl/worksheets/sheet1.xml");
    assert.ok(/<c r="B2" s="2"><v>200<\/v><\/c>/.test(sheet), "Value is a number in the dollars style");
    assert.ok(/<c r="C2" s="1" t="s">/.test(sheet), "Clue is a string in the text style");
    assert.ok(/<col min="3" max="3" width="50" style="1"/.test(sheet), "the Clue column is Text before anything is typed in it");
    assert.ok(/<c r="A4" s="1"\/>/.test(sheet), "an unnamed category's cell is empty, and still Text");
    assert.ok(/<c r="C5" s="1"\/>/.test(sheet), "so is an empty square's clue: Numbers keeps a 3/4 typed there as text");
    assert.ok(/numFmtId="49"/.test(text("xl/styles.xml")), "the text style is Excel's @ format");
  });
};

// A picture is an Excel picture: its bytes in xl/media, once however many squares use it, and
// a drawing anchoring it inside its clue's row, which is made tall enough to hold it. One the
// browser has lost is left out and counted, rather than writing a broken part.
tests["pictures are real Excel pictures, anchored in their rows"] = function () {
  var png = new Uint8Array([137, 80, 78, 71, 1, 2, 3]);
  global.getPicture = function (id) {
    return Promise.resolve(id === "gone" ? undefined : new Blob([png], { type: "image/png" }));
  };
  var s = set(), pic = { kind: "picture", id: "p1", name: "tri & angle.png", w: 400, h: 200 };
  s.rounds[0].cells[0][1] = { clue: "This one", answer: "a", media: pic, dd: false };
  s.rounds[0].cells[1][1] = { clue: "And this", answer: "b", media: pic, dd: false };
  s.final.media = { kind: "picture", id: "gone", name: "lost.png" };
  return X.writeXlsx(s).then(function (r) {
    assert.strictEqual(r.missing, 1, "the lost picture is counted");
    return r.blob.arrayBuffer();
  }).then(X.unzip).then(function (files) {
    var text = function (n) { return new TextDecoder().decode(files[n]); };
    assert.deepStrictEqual(Object.keys(files).filter(function (n) { return /media|drawing|_rels\/sheet/.test(n); }),
      ["xl/worksheets/_rels/sheet1.xml.rels", "xl/drawings/drawing1.xml", "xl/drawings/_rels/drawing1.xml.rels", "xl/media/image1.png"]);
    assert.deepStrictEqual(Array.from(files["xl/media/image1.png"]), Array.from(png), "one copy of a picture used twice");
    var drawing = text("xl/drawings/drawing1.xml");
    assert.deepStrictEqual(drawing.match(/<xdr:row>\d+<\/xdr:row>/g), ["<xdr:row>2</xdr:row>", "<xdr:row>2</xdr:row>", "<xdr:row>4</xdr:row>", "<xdr:row>4</xdr:row>"],
      "anchored in sheet rows 3 and 5, top-left and bottom-right in the same row");
    assert.ok(/<xdr:col>4<\/xdr:col>/.test(drawing), "in the Picture or video column");
    assert.ok(drawing.indexOf('descr="tri &amp; angle.png"') !== -1, "named, and escaped");
    assert.ok(/cx="1371600" cy="685800"/.test(drawing), "a 2:1 picture fits the 176 by 72 box at 144 by 72, its shape kept");
    var sheet = text("xl/worksheets/sheet1.xml");
    assert.ok(/<row r="3" ht="60" customHeight="1">/.test(sheet), "the row grows to hold its picture");
    assert.ok(/<drawing r:id="rId1"\/><\/worksheet>$/.test(sheet));
    assert.ok(text("[Content_Types].xml").indexOf('PartName="/xl/drawings/drawing1.xml"') !== -1);
    assert.ok(text("xl/drawings/_rels/drawing1.xml.rels").indexOf('Target="../media/image1.png"') !== -1);
  });
};

// A designer opening in another tab lets go of stored pictures the control screen does not use,
// so one this page is still showing is saved from its own copy rather than lost from the file.
tests["a picture gone from the store is saved from the page's own copy"] = function () {
  var png = new Uint8Array([137, 80, 78, 71, 9, 9]);
  var fetchWas = global.fetch;
  global.getPicture = function () { return Promise.resolve(undefined); };
  global.pictureURLs = { mem: "blob:mem" };
  global.fetch = function (url) {
    assert.strictEqual(url, "blob:mem");
    return Promise.resolve({ blob: function () { return Promise.resolve(new Blob([png], { type: "image/png" })); } });
  };
  var s = set();
  s.rounds[0].cells[0][1] = { clue: "Kept", answer: "a", media: { kind: "picture", id: "mem", name: "m.png", w: 10, h: 10 }, dd: false };
  return X.writeXlsx(s).then(function (r) {
    assert.strictEqual(r.missing, 0);
    return r.blob.arrayBuffer();
  }).then(X.unzip).then(function (files) {
    assert.deepStrictEqual(Array.from(files["xl/media/image1.png"]), Array.from(png));
  }).finally(function () { delete global.pictureURLs; global.fetch = fetchWas; });
};

var names = Object.keys(tests), failed = 0;
names.reduce(function (p, name) {
  return p.then(function () { return tests[name](); })
    .then(function () { console.log("  ok   " + name); },
          function (e) { failed++; console.log("  FAIL " + name + "\n         " + e.message.split("\n")[0]); });
}, Promise.resolve()).then(function () {
  console.log("\n" + (names.length - failed) + " passed, " + failed + " failed");
  process.exit(failed ? 1 : 0);
});
