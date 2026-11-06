// A stand-in for Firebase, kept in localStorage. Add ?demo=1 to any screen and it runs with
// no Firebase project, no network and no room code that means anything.
//
// It exists because the board, the control screen and a player cannot be judged apart from
// each other, and waiting on a database to look at them is a poor trade. Two tabs of the same
// browser share one store through the storage event, so control.html?demo=1 really does drive
// board.html?demo=1 - which is also how to show someone the board with no project set up.
//
// shortcut: same-browser only, and it implements just the slice of the compat API these pages
// use. It is a viewer and a test fixture, not an emulator. Delete it if the real project ever
// becomes easy enough to point a scratch room at.
(function () {
  if (!/[?&]demo\b/.test(location.search)) return;

  var KEY = "clueboard-demo-db";
  var STAMP = { ".sv": "timestamp" };

  // common.js refuses to start without this, and in demo mode it is deliberately blank.
  // The object is mutable even though the binding is const.
  if (typeof firebaseConfig === "object") firebaseConfig.databaseURL = "demo://local";

  var listeners = [];

  function load() {
    try { return JSON.parse(localStorage.getItem(KEY) || "{}") || {}; } catch (e) { return {}; }
  }
  function save(tree) {
    try { localStorage.setItem(KEY, JSON.stringify(tree)); } catch (e) {}
  }
  function parts(path) {
    return String(path == null ? "" : path).split("/").filter(function (p) { return p !== ""; });
  }
  function get(tree, path) {
    var node = tree;
    parts(path).forEach(function (p) {
      node = node && typeof node === "object" ? node[p] : undefined;
    });
    return node === undefined ? null : node;
  }
  function put(tree, path, value) {
    var ps = parts(path);
    if (!ps.length) return;
    var node = tree;
    for (var i = 0; i < ps.length - 1; i++) {
      if (!node[ps[i]] || typeof node[ps[i]] !== "object") node[ps[i]] = {};
      node = node[ps[i]];
    }
    var last = ps[ps.length - 1];
    if (value === null) delete node[last]; else node[last] = value;
  }
  function clone(v) {
    return v === null || typeof v !== "object" ? v : JSON.parse(JSON.stringify(v));
  }
  // Firebase replaces its server-time sentinel on write; so does this, with the local clock.
  // Nothing in demo mode depends on the clocks agreeing.
  function stamped(value) {
    if (value && typeof value === "object") {
      if (value[".sv"] === "timestamp") return Date.now();
      Object.keys(value).forEach(function (k) { value[k] = stamped(value[k]); });
    }
    return value;
  }

  function snap(path, value) {
    return {
      key: parts(path).pop() || null,
      exists: function () { return value !== null && value !== undefined; },
      val: function () { return value === undefined ? null : value; },
      child: function (p) { return snap(path + "/" + p, get(value === null ? {} : { x: value }, "x/" + p)); },
      forEach: function (cb) {
        if (!value || typeof value !== "object") return;
        // Sorted, because push keys are built to sort chronologically and the real database
        // hands children back in key order.
        Object.keys(value).sort().forEach(function (k) { cb(snap(path + "/" + k, value[k])); });
      }
    };
  }

  // Every listener is re-fired after every write. With a handful of listeners per page that
  // costs nothing, and it rules out the whole class of bug where a parent listener misses a
  // write to one of its children.
  function fire() {
    var tree = load();
    listeners.slice().forEach(function (l) {
      try { l.cb(snap(l.path, get(tree, l.path))); } catch (e) { console.error(e); }
    });
  }

  var pushes = 0;
  function ref(path) {
    path = parts(path).join("/");
    var self = {
      key: parts(path).pop() || null,
      toString: function () { return "demo://local/" + path; },
      child: function (p) { return ref(path + "/" + p); },
      parent: function () { return ref(parts(path).slice(0, -1).join("/")); },
      push: function () {
        pushes++;
        return ref(path + "/-d" + Date.now().toString(36) + String(pushes).padStart(3, "0"));
      },
      on: function (ev, cb) {
        listeners.push({ path: path, cb: cb });
        cb(snap(path, get(load(), path)));
        return cb;
      },
      off: function () {
        listeners = listeners.filter(function (l) { return l.path !== path; });
      },
      once: function () { return Promise.resolve(snap(path, get(load(), path))); },
      set: function (v) {
        var tree = load();
        put(tree, path, stamped(clone(v)));
        save(tree); fire();
        return Promise.resolve();
      },
      update: function (o) {
        var tree = load();
        // Update keys may themselves be paths, which is how the buzzer resets every team.
        Object.keys(o).forEach(function (k) { put(tree, path + "/" + k, stamped(clone(o[k]))); });
        save(tree); fire();
        return Promise.resolve();
      },
      remove: function () {
        var tree = load();
        put(tree, path, null);
        save(tree); fire();
        return Promise.resolve();
      }
    };
    return self;
  }

  addEventListener("storage", function (e) { if (e.key === KEY) fire(); });

  var database = function () { return { ref: ref }; };
  database.ServerValue = { TIMESTAMP: STAMP };

  window.firebase = { initializeApp: function () {}, database: database };
  window.DEMO = true;

  // A room that is always there, so a screen opened with no code still has something to show.
  var tree = load();
  if (!get(tree, "rooms/DEMO")) {
    put(tree, "rooms/DEMO/hostSeen", Date.now());
    [["Fermat", "Ada, Grace", 1200], ["Noether", "Alan, Kurt", 800],
     ["Ramanujan", "Edsger, Barbara", -400], ["Hypatia", "Tim, Radia", 2000]]
      .forEach(function (t, i) {
        put(tree, "rooms/DEMO/teams/-dseed" + i,
          { name: t[0], members: t[1], answer: "", locked: false, score: t[2] });
      });
    save(tree);
  }
})();
