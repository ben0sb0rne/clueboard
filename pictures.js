// Pictures: made small enough to keep, and kept on this device.
//
// Every picture is redrawn on the way in, however it arrives - pasted, dropped, chosen, or out
// of an .xlsx: at most 1920px on its long side, as a PNG if it came as one (or as a GIF, which
// is lines and screenshots) and a JPEG otherwise. Redrawing is also what turns an iPhone's
// HEIC into a JPEG and leaves its location behind, because a canvas carries no metadata.
//
// They live in IndexedDB, because localStorage holds a few megabytes and a game of pictures is
// more than that. The set refers to each by an id that is a hash of the picture, so the same
// one added twice, or a file opened twice, is stored once. This copy is how the board shows
// them on this device and where a save reads them back from; it is not a save itself - the
// .xlsx is - and Safari clears it after about a week without a visit.

var MAX_SIDE = 1920;
var pictureURLs = {};   // id -> object URL, for drawing a picture without waiting for it

function encodePicture(file) {
  return createImageBitmap(file).then(function (bmp) {
    var k = Math.min(1, MAX_SIDE / Math.max(bmp.width, bmp.height));
    var w = Math.max(1, Math.round(bmp.width * k));
    var h = Math.max(1, Math.round(bmp.height * k));
    var png = /^image\/(png|gif)$/.test(file.type);
    var canvas = document.createElement("canvas");
    canvas.width = w;
    canvas.height = h;
    var g = canvas.getContext("2d");
    if (!png) { g.fillStyle = "#fff"; g.fillRect(0, 0, w, h); }   // a JPEG has no transparency
    g.drawImage(bmp, 0, 0, w, h);
    if (bmp.close) bmp.close();
    return new Promise(function (resolve, reject) {
      canvas.toBlob(function (blob) {
        if (blob) resolve({ blob: blob, w: w, h: h });
        else reject(new Error("That picture could not be read."));
      }, png ? "image/png" : "image/jpeg", 0.88);
    });
  }, function () {
    throw new Error("That picture could not be opened here. A PNG or a JPEG always can.");
  });
}

// A picture from anywhere, made into the media a square holds.
function addPicture(file, name) {
  return encodePicture(file).then(function (p) {
    return storePicture(p.blob).then(function (id) {
      return { kind: "picture", id: id, name: name || file.name || "Picture", size: p.blob.size,
               type: p.blob.type, w: p.w, h: p.h };
    });
  });
}

function pictureId(blob) {
  if (!(window.crypto && crypto.subtle)) {   // only a page opened from a file has no subtle
    return Promise.resolve(Date.now().toString(36) + Math.random().toString(36).slice(2));
  }
  return blob.arrayBuffer().then(function (buf) { return crypto.subtle.digest("SHA-256", buf); })
    .then(function (hash) {
      return Array.from(new Uint8Array(hash).slice(0, 12), function (b) {
        return b.toString(16).padStart(2, "0");
      }).join("");
    });
}

var pictureDB = null;
function pictureStore(mode, work) {
  if (!pictureDB) {
    pictureDB = new Promise(function (resolve, reject) {
      var open = indexedDB.open("clueboard", 1);
      open.onupgradeneeded = function () { open.result.createObjectStore("pictures"); };
      open.onsuccess = function () { resolve(open.result); };
      open.onerror = function () { reject(open.error); };
    });
  }
  return pictureDB.then(function (db) {
    return new Promise(function (resolve, reject) {
      var t = db.transaction("pictures", mode);
      var req = work(t.objectStore("pictures"));
      t.oncomplete = function () { resolve(req && req.result); };
      t.onerror = t.onabort = function () {
        reject(new Error("This browser would not keep the picture: " + (t.error ? t.error.message : "no reason given")));
      };
    });
  });
}

function storePicture(blob) {
  return pictureId(blob).then(function (id) {
    return pictureStore("readwrite", function (s) { return s.put(blob, id); }).then(function () {
      if (!pictureURLs[id]) pictureURLs[id] = URL.createObjectURL(blob);
      return id;
    });
  });
}

function getPicture(id) {
  return pictureStore("readonly", function (s) { return s.get(id); });
}

// Fetches every picture a set uses into pictureURLs, so the screen can draw them at once.
// A missing one is simply left out: the square says it has a picture that is not here.
function loadPictures(ids) {
  return Promise.all(ids.filter(function (id) { return !pictureURLs[id]; }).map(function (id) {
    return getPicture(id).then(function (blob) {
      if (blob) pictureURLs[id] = URL.createObjectURL(blob);
    }, function () {});
  }));
}

// Drops every stored picture not in ids. The designer runs it as it opens, with the control
// screen's set, so stored pictures last as long as something on this device can show them.
function keepPictures(ids) {
  var keep = {};
  ids.forEach(function (id) { keep[id] = true; });
  return pictureStore("readwrite", function (s) {
    var req = s.openKeyCursor();
    req.onsuccess = function () {
      var c = req.result;
      if (!c) return;
      if (!keep[c.key]) s.delete(c.key);
      c.continue();
    };
    return null;
  }).catch(function () {});
}

// The pictures a set uses, by id.
function pictureIds(set) {
  var ids = [];
  var add = function (s) { if (s && s.media && s.media.kind === "picture" && s.media.id) ids.push(s.media.id); };
  ((set && set.rounds) || []).forEach(function (R) { R.cells.forEach(function (col) { col.forEach(add); }); });
  add(set && set.final);
  return ids;
}

// A clue's picture as the phones in the room get it: a copy made on this device, at most
// PHONE_SIDE on its long side, as a JPEG drawn on white - a picture with transparency would
// otherwise go black. From this device's store, or from its link when the site it is on lets a
// page read it; null when neither can be had, and the phones then show the words alone. Kept
// for the session, keyed by the picture, so a clue goes up with its copy at once.
var PHONE_SIDE = 800;
var phoneCopies = {};
function phoneCopy(media) {
  if (!media || media.kind !== "picture" || !(media.id || media.url)) return Promise.resolve(null);
  var key = media.id || media.url;
  if (!phoneCopies[key]) {
    var from = media.id
      ? loadPictures([media.id]).then(function () { return pictureURLs[media.id] || null; })
      : Promise.resolve(media.url);
    phoneCopies[key] = from.then(function (url) {
      if (!url) return null;
      return new Promise(function (resolve) {
        var img = new Image();
        if (!media.id) img.crossOrigin = "anonymous";
        img.onload = function () {
          try {
            var k = Math.min(1, PHONE_SIDE / Math.max(img.naturalWidth, img.naturalHeight));
            var c = document.createElement("canvas");
            c.width = Math.max(1, Math.round(img.naturalWidth * k));
            c.height = Math.max(1, Math.round(img.naturalHeight * k));
            var g = c.getContext("2d");
            g.fillStyle = "#fff";
            g.fillRect(0, 0, c.width, c.height);
            g.drawImage(img, 0, 0, c.width, c.height);
            resolve(c.toDataURL("image/jpeg", 0.75));
          } catch (e) { resolve(null); }   // a linked picture whose site will not let it be read
        };
        img.onerror = function () { resolve(null); };
        img.src = url;
      });
    });
  }
  return phoneCopies[key];
}

// Every picture a set uses, made ready for the phones before its clue is picked.
function warmPhoneCopies(set) {
  var add = function (s) { if (s && s.media) phoneCopy(s.media); };
  ((set && set.rounds) || []).forEach(function (R) { R.cells.forEach(function (col) { col.forEach(add); }); });
  add(set && set.final);
}
