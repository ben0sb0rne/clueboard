// The .xlsx file: a game's save. A small zip and SpreadsheetML reader and writer of our own,
// because the file needs only a sliver of the format and a library for it would be most of
// this site's weight. The tables in it are clues.js's setToTables and setFromTables; this is
// only how they sit on disk.
//
// Writing: every entry stored, not compressed, with its CRC32 - Excel, Sheets and Numbers all
// open that, and it needs no compressor. Category, Clue and Answer are Text-formatted columns,
// so Excel cannot turn 3/4 into a date, 1:2 into a time or -x+2 into #NAME?, and Value is a
// number shown as dollars.
//
// Pictures are real Excel pictures, in xl/media with the drawing parts that place them, each
// anchored inside its clue's row - which is made tall enough to hold it - so Excel, Sheets and
// Numbers all show them. A picture read back belongs to the row its top-left corner is in.
//
// Reading: DecompressionStream for the entries a spreadsheet app compressed, and DOMParser for
// the XML, so it runs only in a browser. Strings come from shared strings, inline strings or
// formula results, whichever the app wrote.

var XLSX_NS = "http://schemas.openxmlformats.org/spreadsheetml/2006/main";
var REL_NS = "http://schemas.openxmlformats.org/officeDocument/2006/relationships";
var PKG_REL_NS = "http://schemas.openxmlformats.org/package/2006/relationships";
var XML_HEAD = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n';

/* ---------- zip ---------- */

var CRC_TABLE = (function () {
  var t = new Uint32Array(256);
  for (var n = 0; n < 256; n++) {
    var c = n;
    for (var k = 0; k < 8; k++) c = c & 1 ? 0xEDB88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c >>> 0;
  }
  return t;
})();

function crc32(bytes) {
  var c = 0xFFFFFFFF;
  for (var i = 0; i < bytes.length; i++) c = CRC_TABLE[(c ^ bytes[i]) & 0xFF] ^ (c >>> 8);
  return (c ^ 0xFFFFFFFF) >>> 0;
}

// files: [{ name, data: Uint8Array or string }], in the order they go in.
function zipStored(files) {
  var enc = new TextEncoder();
  var now = new Date();
  var time = (now.getHours() << 11) | (now.getMinutes() << 5) | (now.getSeconds() >> 1);
  var date = ((now.getFullYear() - 1980) << 9) | ((now.getMonth() + 1) << 5) | now.getDate();
  var parts = [], central = [], offset = 0;
  files.forEach(function (f) {
    var name = enc.encode(f.name);
    var data = typeof f.data === "string" ? enc.encode(f.data) : f.data;
    var crc = crc32(data);
    var local = new DataView(new ArrayBuffer(30));
    local.setUint32(0, 0x04034b50, true);
    local.setUint16(4, 20, true);              // version needed: 2.0
    local.setUint16(6, 0x0800, true);          // names are UTF-8
    local.setUint16(8, 0, true);               // stored
    local.setUint16(10, time, true);
    local.setUint16(12, date, true);
    local.setUint32(14, crc, true);
    local.setUint32(18, data.length, true);
    local.setUint32(22, data.length, true);
    local.setUint16(26, name.length, true);
    local.setUint16(28, 0, true);
    parts.push(local.buffer, name, data);

    var cen = new DataView(new ArrayBuffer(46));
    cen.setUint32(0, 0x02014b50, true);
    cen.setUint16(4, 20, true);
    cen.setUint16(6, 20, true);
    cen.setUint16(8, 0x0800, true);
    cen.setUint16(10, 0, true);
    cen.setUint16(12, time, true);
    cen.setUint16(14, date, true);
    cen.setUint32(16, crc, true);
    cen.setUint32(20, data.length, true);
    cen.setUint32(24, data.length, true);
    cen.setUint16(28, name.length, true);
    cen.setUint32(42, offset, true);
    central.push(cen.buffer, name);
    offset += 30 + name.length + data.length;
  });
  var size = central.reduce(function (n, b) { return n + b.byteLength; }, 0);
  var end = new DataView(new ArrayBuffer(22));
  end.setUint32(0, 0x06054b50, true);
  end.setUint16(8, files.length, true);
  end.setUint16(10, files.length, true);
  end.setUint32(12, size, true);
  end.setUint32(16, offset, true);
  return new Blob(parts.concat(central, [end.buffer]),
    { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
}

// Every entry, by name, as bytes.
// shortcut: no ZIP64, so no file over 4GB or 65,535 entries - which no game is.
function unzip(buffer) {
  var view = new DataView(buffer);
  var bytes = new Uint8Array(buffer);
  var dec = new TextDecoder();
  var e = buffer.byteLength - 22;
  while (e >= 0 && view.getUint32(e, true) !== 0x06054b50) e--;
  if (e < 0) return Promise.reject(new Error("it is not an .xlsx file"));
  var count = view.getUint16(e + 10, true);
  var p = view.getUint32(e + 16, true);
  var entries = [];
  for (var i = 0; i < count; i++) {
    if (view.getUint32(p, true) !== 0x02014b50) return Promise.reject(new Error("the file is damaged"));
    var method = view.getUint16(p + 10, true);
    var size = view.getUint32(p + 20, true);
    var nameLen = view.getUint16(p + 28, true);
    var extraLen = view.getUint16(p + 30, true);
    var commentLen = view.getUint16(p + 32, true);
    var at = view.getUint32(p + 42, true);
    var name = dec.decode(bytes.subarray(p + 46, p + 46 + nameLen));
    // The local header's own name and extra field can differ in length from the central one's.
    var start = at + 30 + view.getUint16(at + 26, true) + view.getUint16(at + 28, true);
    entries.push({ name: name, method: method, data: bytes.subarray(start, start + size) });
    p += 46 + nameLen + extraLen + commentLen;
  }
  var files = {};
  return Promise.all(entries.map(function (en) {
    if (/\/$/.test(en.name)) return null;
    if (en.method === 0) { files[en.name] = en.data; return null; }
    if (en.method !== 8) return Promise.reject(new Error("it uses a kind of compression this page cannot read"));
    var stream = new Blob([en.data]).stream().pipeThrough(new DecompressionStream("deflate-raw"));
    return new Response(stream).arrayBuffer().then(function (out) { files[en.name] = new Uint8Array(out); });
  })).then(function () { return files; });
}

/* ---------- writing ---------- */

// XML 1.0 has no way to say most control characters at all, so they are dropped.
function xmlText(v) {
  return String(v).replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F￾￿]/g, "")
    .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

function colName(i) {
  var s = "";
  for (i++; i > 0; i = Math.floor((i - 1) / 26)) s = String.fromCharCode(65 + (i - 1) % 26) + s;
  return s;
}

// The cell styles in styles.xml, by position.
var S_TEXT = 1, S_MONEY = 2, S_HEAD = 3;
var STYLES = XML_HEAD +
  '<styleSheet xmlns="' + XLSX_NS + '">' +
  '<numFmts count="1"><numFmt numFmtId="164" formatCode="&quot;$&quot;#,##0"/></numFmts>' +
  '<fonts count="2"><font><sz val="11"/><name val="Calibri"/><family val="2"/></font>' +
  '<font><b/><sz val="11"/><name val="Calibri"/><family val="2"/></font></fonts>' +
  '<fills count="2"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill></fills>' +
  '<borders count="1"><border><left/><right/><top/><bottom/><diagonal/></border></borders>' +
  '<cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs>' +
  '<cellXfs count="4">' +
  '<xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/>' +
  '<xf numFmtId="49" fontId="0" fillId="0" borderId="0" xfId="0" applyNumberFormat="1" applyAlignment="1"><alignment vertical="top" wrapText="1"/></xf>' +
  '<xf numFmtId="164" fontId="0" fillId="0" borderId="0" xfId="0" applyNumberFormat="1" applyAlignment="1"><alignment vertical="top"/></xf>' +
  '<xf numFmtId="49" fontId="1" fillId="0" borderId="0" xfId="0" applyNumberFormat="1" applyFont="1"/>' +
  '</cellXfs>' +
  '<cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles>' +
  '</styleSheet>';

// Column widths, in characters, and each column's style - so a cell typed in later, in Excel,
// is text or dollars before anything is in it.
var COLS = {
  round: [[24, S_TEXT], [10, S_MONEY], [50, S_TEXT], [24, S_TEXT], [26, S_TEXT], [13, S_TEXT]],
  final: [[24, S_TEXT], [50, S_TEXT], [24, S_TEXT], [26, S_TEXT]],
  help: [[110, S_TEXT]]
};

// A picture is drawn inside its cell, in a box of this many pixels, the row grown to fit.
var EMU_PX = 9525, EMU_PT = 12700, PIC_W = 176, PIC_H = 72, PIC_PAD = 4, ROW_PT = 15, PIC_ROW_PT = 60;
function colPx(chars) { return Math.floor((256 * chars + Math.floor(128 / 7)) / 256 * 7); }

function sheetXml(table, first, str, picRows) {
  var cols = COLS[table.kind];
  var x = XML_HEAD + '<worksheet xmlns="' + XLSX_NS + '" xmlns:r="' + REL_NS + '">' +
    '<sheetViews><sheetView workbookViewId="0"' + (first ? ' tabSelected="1"' : "") + ">" +
    (table.kind === "help" ? "" : '<pane ySplit="1" topLeftCell="A2" activePane="bottomLeft" state="frozen"/>') +
    "</sheetView></sheetViews>" +
    '<sheetFormatPr defaultRowHeight="15"/><cols>' +
    cols.map(function (c, i) {
      return '<col min="' + (i + 1) + '" max="' + (i + 1) + '" width="' + c[0] + '" style="' + c[1] + '" customWidth="1"/>';
    }).join("") + "</cols><sheetData>";
  table.rows.forEach(function (row, r) {
    x += '<row r="' + (r + 1) + '"' + (picRows[r] ? ' ht="' + PIC_ROW_PT + '" customHeight="1"' : "") + ">";
    row.forEach(function (v, c) {
      var ref = colName(c) + (r + 1);
      if (typeof v === "number") x += '<c r="' + ref + '" s="' + S_MONEY + '"><v>' + v + "</v></c>";
      else if (v !== "") x += '<c r="' + ref + '" s="' + (r === 0 ? S_HEAD : S_TEXT) + '" t="s"><v>' + str(v) + "</v></c>";
      // An empty square's cells are written too, empty but Text: Excel and Sheets give new typing
      // its column's format, but Numbers only keeps a cell's own, and turned a 3/4 typed into an
      // unwritten cell into a number and 1:2 into a time.
      else x += '<c r="' + ref + '" s="' + S_TEXT + '"/>';
    });
    x += "</row>";
  });
  return x + "</sheetData>" + (Object.keys(picRows).length ? '<drawing r:id="rId1"/>' : "") + "</worksheet>";
}

// Where each picture sits: twoCellAnchor inside its own cell, which is what Excel itself
// writes for a picture placed over cells. The absolute offset is filled in too, for any app
// that reads that rather than the anchor.
function drawingXml(table, pics, picRows) {
  var cols = COLS[table.kind];
  var x = XML_HEAD + '<xdr:wsDr xmlns:xdr="http://schemas.openxmlformats.org/drawingml/2006/spreadsheetDrawing" ' +
    'xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:r="' + REL_NS + '">';
  pics.forEach(function (p, k) {
    var w = p.media.w || 4, h = p.media.h || 3, fit = Math.min(PIC_W / w, PIC_H / h);
    var cx = Math.max(1, Math.round(w * fit)) * EMU_PX, cy = Math.max(1, Math.round(h * fit)) * EMU_PX, pad = PIC_PAD * EMU_PX;
    var left = 0, top = 0;
    for (var c = 0; c < p.col; c++) left += colPx(cols[c][0]) * EMU_PX;
    for (var r = 0; r < p.row; r++) top += (picRows[r] ? PIC_ROW_PT : ROW_PT) * EMU_PT;
    var at = function (tag, dx, dy) {
      return "<xdr:" + tag + "><xdr:col>" + p.col + "</xdr:col><xdr:colOff>" + dx + "</xdr:colOff><xdr:row>" +
        p.row + "</xdr:row><xdr:rowOff>" + dy + "</xdr:rowOff></xdr:" + tag + ">";
    };
    x += '<xdr:twoCellAnchor editAs="oneCell">' + at("from", pad, pad) + at("to", pad + cx, pad + cy) +
      '<xdr:pic><xdr:nvPicPr><xdr:cNvPr id="' + (k + 2) + '" name="Picture ' + (k + 1) + '" descr="' + xmlText(p.media.name || "") + '"/>' +
      '<xdr:cNvPicPr><a:picLocks noChangeAspect="1"/></xdr:cNvPicPr></xdr:nvPicPr>' +
      '<xdr:blipFill><a:blip r:embed="rId' + (k + 1) + '"/><a:stretch><a:fillRect/></a:stretch></xdr:blipFill>' +
      '<xdr:spPr><a:xfrm><a:off x="' + (left + pad) + '" y="' + (top + pad) + '"/><a:ext cx="' + cx + '" cy="' + cy + '"/></a:xfrm>' +
      '<a:prstGeom prst="rect"><a:avLst/></a:prstGeom></xdr:spPr></xdr:pic><xdr:clientData/></xdr:twoCellAnchor>';
  });
  return x + "</xdr:wsDr>";
}

function relsXml(rels) {
  return XML_HEAD + '<Relationships xmlns="' + PKG_REL_NS + '">' + rels.map(function (r) {
    return '<Relationship Id="' + r[0] + '" Type="' + REL_NS + "/" + r[1] + '" Target="' + r[2] + '"/>';
  }).join("") + "</Relationships>";
}

// The whole file: { blob, missing }, missing being how many pictures were not on this device
// to put in it. A promise, because pictures are read out of IndexedDB.
function writeXlsx(set) {
  var tables = setToTables(set);
  var ids = [];
  tables.forEach(function (t) {
    t.pictures.forEach(function (p) { if (ids.indexOf(p.media.id) === -1) ids.push(p.media.id); });
  });
  return Promise.all(ids.map(function (id) {
    // From the store, or from this page's own copy: a designer opening in another tab lets go
    // of every stored picture the control screen is not using, this tab's included.
    return getPicture(id).then(function (b) {
      var url = !b && typeof pictureURLs !== "undefined" && pictureURLs[id];
      return url ? fetch(url).then(function (r) { return r.blob(); }) : b;
    }).then(function (b) { return b ? b.arrayBuffer().then(function (buf) { return { type: b.type, data: new Uint8Array(buf) }; }) : null; },
      function () { return null; });
  })).then(function (found) {
    var media = {};
    found.forEach(function (f, k) {
      if (f) media[ids[k]] = { file: "image" + (Object.keys(media).length + 1) + (f.type === "image/png" ? ".png" : ".jpeg"), data: f.data };
    });
    return buildXlsx(tables, media);
  });
}

function buildXlsx(tables, media) {
  var missing = 0;
  var strings = [], index = {};
  var str = function (v) {
    v = String(v);
    if (!Object.prototype.hasOwnProperty.call(index, v)) { index[v] = strings.length; strings.push(v); }
    return index[v];
  };
  var drawings = [];   // [{ sheet, pics, picRows }]
  var sheets = tables.map(function (t, k) {
    var pics = t.pictures.filter(function (p) { return media[p.media.id] || (missing++, false); });
    var picRows = {};
    pics.forEach(function (p) { picRows[p.row] = true; });
    if (pics.length) drawings.push({ sheet: k, table: t, pics: pics, picRows: picRows });
    return sheetXml(t, k === 0, str, picRows);
  });
  var types = XML_HEAD + '<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">' +
    '<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>' +
    '<Default Extension="xml" ContentType="application/xml"/>' +
    '<Default Extension="png" ContentType="image/png"/>' +
    '<Default Extension="jpeg" ContentType="image/jpeg"/>' +
    '<Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>' +
    sheets.map(function (s, k) {
      return '<Override PartName="/xl/worksheets/sheet' + (k + 1) + '.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>';
    }).join("") +
    drawings.map(function (d, k) {
      return '<Override PartName="/xl/drawings/drawing' + (k + 1) + '.xml" ContentType="application/vnd.openxmlformats-officedocument.drawing+xml"/>';
    }).join("") +
    '<Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>' +
    '<Override PartName="/xl/sharedStrings.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sharedStrings+xml"/>' +
    "</Types>";
  var workbook = XML_HEAD + '<workbook xmlns="' + XLSX_NS + '" xmlns:r="' + REL_NS + '">' +
    "<bookViews><workbookView/></bookViews><sheets>" +
    tables.map(function (t, k) {
      return '<sheet name="' + xmlText(t.name) + '" sheetId="' + (k + 1) + '" r:id="rId' + (k + 1) + '"/>';
    }).join("") + "</sheets></workbook>";
  var bookRels = tables.map(function (t, k) { return ["rId" + (k + 1), "worksheet", "worksheets/sheet" + (k + 1) + ".xml"]; })
    .concat([["rIdStyles", "styles", "styles.xml"], ["rIdStrings", "sharedStrings", "sharedStrings.xml"]]);
  var sst = XML_HEAD + '<sst xmlns="' + XLSX_NS + '" count="' + strings.length + '" uniqueCount="' + strings.length + '">' +
    strings.map(function (s) { return '<si><t xml:space="preserve">' + xmlText(s) + "</t></si>"; }).join("") + "</sst>";

  var files = [
    { name: "[Content_Types].xml", data: types },
    { name: "_rels/.rels", data: relsXml([["rId1", "officeDocument", "xl/workbook.xml"]]) },
    { name: "xl/workbook.xml", data: workbook },
    { name: "xl/_rels/workbook.xml.rels", data: relsXml(bookRels) },
    { name: "xl/styles.xml", data: STYLES },
    { name: "xl/sharedStrings.xml", data: sst }
  ].concat(sheets.map(function (s, k) { return { name: "xl/worksheets/sheet" + (k + 1) + ".xml", data: s }; }));
  drawings.forEach(function (d, k) {
    var n = k + 1;
    files.push({ name: "xl/worksheets/_rels/sheet" + (d.sheet + 1) + ".xml.rels", data: relsXml([["rId1", "drawing", "../drawings/drawing" + n + ".xml"]]) });
    files.push({ name: "xl/drawings/drawing" + n + ".xml", data: drawingXml(d.table, d.pics, d.picRows) });
    files.push({ name: "xl/drawings/_rels/drawing" + n + ".xml.rels", data: relsXml(d.pics.map(function (p, j) {
      return ["rId" + (j + 1), "image", "../media/" + media[p.media.id].file];
    })) });
  });
  Object.keys(media).forEach(function (id) { files.push({ name: "xl/media/" + media[id].file, data: media[id].data }); });
  return { blob: zipStored(files), missing: missing };
}

/* ---------- reading ---------- */

// Elements by local name, whatever prefix the app gave them.
function kids(el, name) {
  return Array.prototype.filter.call(el ? el.childNodes : [], function (n) { return n.localName === name; });
}
function all(el, name) { return el ? Array.prototype.slice.call(el.getElementsByTagNameNS("*", name)) : []; }

// A relationship attribute - r:id, r:embed - under whichever namespace prefix, or Strict
// OOXML's URI, it has.
function relAttr(el, name) {
  for (var i = 0; el && i < el.attributes.length; i++) {
    var a = el.attributes[i];
    if (a.localName === name && /relationships$/.test(a.namespaceURI || "")) return a.value;
  }
  return null;
}

// A relationship's target, as a path inside the zip.
function resolvePath(base, target) {
  if (target.charAt(0) === "/") return target.slice(1);
  var parts = base.split("/").slice(0, -1).concat(target.split("/")), out = [];
  parts.forEach(function (p) { if (p === "..") out.pop(); else if (p && p !== ".") out.push(p); });
  return out.join("/");
}

function colIndex(ref) {
  var m = /^[A-Z]+/i.exec(ref || ""), n = 0;
  if (!m) return -1;
  for (var i = 0; i < m[0].length; i++) n = n * 26 + (m[0].toUpperCase().charCodeAt(i) - 64);
  return n - 1;
}

// The text of a shared or inline string: every run's <t>, but not the phonetic guides.
function stringText(el) {
  return all(el, "t").filter(function (t) { return t.parentNode.localName !== "rPh"; })
    .map(function (t) { return t.textContent; }).join("");
}

// The row a point this many EMUs down the sheet falls in, for a picture placed by position
// rather than by cell.
function rowAt(doc, y) {
  var fmt = all(doc, "sheetFormatPr")[0];
  var base = Number(fmt && fmt.getAttribute("defaultRowHeight")) || ROW_PT;
  var heights = {};
  all(doc, "row").forEach(function (row, i) {
    if (row.getAttribute("ht")) heights[(Number(row.getAttribute("r")) || i + 1) - 1] = Number(row.getAttribute("ht"));
  });
  for (var r = 0, top = 0; r < 1048576; r++) {
    top += (heights[r] || base) * EMU_PT;
    if (y < top) return r;
  }
  return -1;
}

var PICTURE_TYPES = { png: "image/png", jpeg: "image/jpeg", jpg: "image/jpeg", gif: "image/gif", webp: "image/webp", bmp: "image/bmp", tif: "image/tiff", tiff: "image/tiff" };

// Every picture drawn on a sheet, with the row and column its top-left corner is in.
function sheetPictures(sheetPath, doc, xml, rels, zip) {
  var drawing = all(doc, "drawing")[0];
  var target = drawing && rels(sheetPath)[relAttr(drawing, "id")];
  var dd = target && xml(target.path);
  if (!dd) return [];
  var drels = rels(target.path), out = [];
  Array.prototype.forEach.call(dd.documentElement.childNodes, function (anchor) {
    if (!/Anchor$/.test(anchor.localName || "")) return;
    var from = kids(anchor, "from")[0], pos = kids(anchor, "pos")[0];
    var row = from ? Number(kids(from, "row")[0].textContent) : pos ? rowAt(doc, Number(pos.getAttribute("y"))) : -1;
    var col = from ? Number(kids(from, "col")[0].textContent) : 0;
    all(anchor, "pic").forEach(function (pic) {
      var blip = all(pic, "blip")[0], rel = blip && drels[relAttr(blip, "embed")];
      var nv = all(pic, "cNvPr")[0];
      if (!rel || !zip[rel.path]) return;
      out.push({ row: row, col: col, data: zip[rel.path], path: rel.path,
                 name: (nv && (nv.getAttribute("descr") || nv.getAttribute("name"))) || "Picture" });
    });
  });
  return out;
}

// The tables in a file: [{ name, rows, pictures, errors }], in tab order, ready for
// setFromTables. Each picture is redrawn and stored on this device on the way in
// (pictures.js), so what comes back is the media a square holds.
function readXlsx(file) {
  return file.arrayBuffer().then(unzip).then(function (zip) {
    var dec = new TextDecoder();
    var xml = function (path) {
      if (!zip[path]) return null;
      var doc = new DOMParser().parseFromString(dec.decode(zip[path]), "application/xml");
      return doc.getElementsByTagName("parsererror").length ? null : doc;
    };
    var rels = function (path) {
      var slash = path.lastIndexOf("/");
      var doc = xml(path.slice(0, slash + 1) + "_rels/" + path.slice(slash + 1) + ".rels");
      var out = {};
      all(doc, "Relationship").forEach(function (r) {
        out[r.getAttribute("Id")] = { type: r.getAttribute("Type") || "", path: resolvePath(path, r.getAttribute("Target") || "") };
      });
      return out;
    };
    var root = rels("");
    var main = Object.keys(root).map(function (k) { return root[k]; })
      .filter(function (r) { return /\/officeDocument$/.test(r.type); })[0];
    var bookPath = main ? main.path : "xl/workbook.xml";
    var book = xml(bookPath);
    if (!book) throw new Error("it is not an .xlsx file");
    var bookRels = rels(bookPath);
    var sst = Object.keys(bookRels).map(function (k) { return bookRels[k]; })
      .filter(function (r) { return /\/sharedStrings$/.test(r.type); })[0];
    var strings = all(xml(sst ? sst.path : "xl/sharedStrings.xml"), "si").map(stringText);

    return all(book, "sheet").map(function (s) {
      var rel = bookRels[relAttr(s, "id")];
      var doc = rel && xml(rel.path);
      var rows = [];
      all(doc, "row").forEach(function (row, i) {
        var r = (Number(row.getAttribute("r")) || i + 1) - 1;
        var cells = rows[r] = rows[r] || [];
        kids(row, "c").forEach(function (c, j) {
          var at = c.getAttribute("r") ? colIndex(c.getAttribute("r")) : j;
          var t = c.getAttribute("t"), v = kids(c, "v")[0], raw = v ? v.textContent : "";
          cells[at] = t === "s" ? (strings[Number(raw)] || "")
            : t === "inlineStr" ? stringText(kids(c, "is")[0])
            : t === "b" ? (raw === "1" ? "TRUE" : "FALSE")
            : raw;
        });
      });
      for (var k = 0; k < rows.length; k++) rows[k] = Array.from(rows[k] || [], function (v) { return v == null ? "" : v; });
      return { name: s.getAttribute("name") || "", rows: rows, raw: doc ? sheetPictures(rel.path, doc, xml, rels, zip) : [] };
    });
  }).then(function (tables) {
    return Promise.all(tables.map(function (t) {
      var errors = [];
      return Promise.all(t.raw.map(function (p) {
        var ext = (/\.([a-z]+)$/i.exec(p.path) || [])[1] || "";
        var where = (t.name ? t.name + ", row " : "Row ") + (p.row + 1);
        return addPicture(new Blob([p.data], { type: PICTURE_TYPES[ext.toLowerCase()] || "" }), p.name)
          .then(function (media) { return { row: p.row, col: p.col, media: media }; },
            function () { errors.push(where + ": that picture is in a kind of file this page cannot show, so it is left out."); return null; });
      })).then(function (pics) {
        return { name: t.name, rows: t.rows, pictures: pics.filter(Boolean), errors: errors };
      });
    }));
  });
}

// A game from a file of any kind the designer and the control screen open: the .xlsx Save
// wrote, or a .csv or .tsv from any spreadsheet. The game's title is the file's name, less the
// " (1)" a browser adds to a second download of it.
function openGameFile(file) {
  var name = file.name || "";
  var ext = ((/\.([a-z]+)$/i.exec(name) || [])[1] || "").toLowerCase();
  // The pickers no longer filter by type (see control.html), so anything can arrive here. A
  // PDF read as text failed on its header row, which says nothing useful about the real
  // mistake. A file with no extension is still tried, as a paste saved from a text editor.
  if (!/^(xlsx|csv|tsv|txt|)$/.test(ext)) {
    return Promise.reject(new Error("Clueboard opens .xlsx, .csv and .tsv files."));
  }
  var read = ext === "xlsx" ? readXlsx(file).then(setFromTables)
    : file.text().then(function (text) {
      return ext === "csv" ? setFromTables([{ name: "", rows: csvRows(text) }]) : parseClueSet(text);
    });
  return read.then(function (parsed) {
    parsed.set.title = name.replace(/\.[a-z]+$/i, "").replace(/\s*\(\d+\)$/, "").slice(0, 60);
    return parsed;
  });
}

// A finished file handed to the browser as a download: the designer's Save and the blank
// template both end here. The URL is let go a minute later, long enough for any browser to
// have read it.
function downloadBlob(blob, name) {
  var a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(function () { URL.revokeObjectURL(a.href); }, 60000);
}

// The blank template: an empty game written exactly as Save writes a full one, so the file a
// teacher fills in is the file both screens open.
var TEMPLATE_NAME = "Clueboard template.xlsx";
function downloadTemplate() {
  return writeXlsx(blankSet()).then(function (out) { downloadBlob(out.blob, TEMPLATE_NAME); });
}

if (typeof module !== "undefined" && module.exports) {
  module.exports = { crc32: crc32, zipStored: zipStored, unzip: unzip, writeXlsx: writeXlsx, colName: colName };
}
