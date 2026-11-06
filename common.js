// Shared by index.html (student), control.html (teacher) and board.html (projector).

if (!firebaseConfig.databaseURL) {
  document.body.innerHTML =
    '<p style="font:600 20px system-ui;color:#a8161c;padding:2rem;line-height:1.5">' +
    'Set <code>databaseURL</code> in firebase-config.js.<br>' +
    'Firebase Console &rarr; Databases &amp; Storage &rarr; Realtime Database &rarr; Create Database, then copy the URL at the top of that page.</p>';
  throw new Error("firebase-config.js is missing databaseURL");
}

firebase.initializeApp(firebaseConfig);
const db = firebase.database();
const SERVER_TIME = firebase.database.ServerValue.TIMESTAMP;

// How old rooms/<code>/hostSeen is, in ms, measured against the server's clock rather than
// this device's: a Chromebook with the wrong date must not get to decide whether a game is
// over. null means there is no stamp, or the read was refused.
function hostSeenAge(code) {
  return db.ref(".info/serverTimeOffset").once("value")
    .then((o) => db.ref("rooms/" + code + "/hostSeen").once("value")
      .then((s) => (s.val() ? Date.now() + (o.val() || 0) - s.val() : null)))
    .catch(() => null);
}

// The server's clock, as this device sees it. The control screen writes when the think time
// ends and the board decides when it is up, so the two have to agree even when they are
// different machines - the same reason hostSeenAge measures against the server rather than
// trusting a Chromebook's date. Until the first reading arrives this is the local clock,
// which is close enough: nothing reads it in the first seconds after a page loads.
let serverSkew = 0;
db.ref(".info/serverTimeOffset").on("value", (s) => { serverSkew = s.val() || 0; });
function serverNow() { return Date.now() + serverSkew; }

// Short square-wave buzz. Saves hosting an audio file and needs no preloading. The sweep sits
// at 400 Hz rather than down at 240: a tablet or Chromebook speaker is past its roll-off there,
// so the fundamental never reaches the room and the buzz reads as thin rather than loud.
// shortcut: a square wave has far lower RMS than a normalised recording, so this is as loud as
// it gets without hosting a real sound. Replace beep() with a WAV when that lands.
let actx;
function audio() {
  actx ||= new (window.AudioContext || window.webkitAudioContext)();
  if (actx.state === "suspended") actx.resume();
  return actx;
}
function beep() {
  const ctx = audio();
  const t = ctx.currentTime;
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type = "square";
  osc.frequency.setValueAtTime(400, t);
  osc.frequency.setValueAtTime(300, t + 0.16);
  gain.gain.setValueAtTime(0.0001, t);
  gain.gain.exponentialRampToValueAtTime(0.7, t + 0.012);
  gain.gain.setValueAtTime(0.7, t + 0.3);
  gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.42);
  osc.connect(gain).connect(ctx.destination);
  osc.start(t);
  osc.stop(t + 0.44);
}

// Browsers keep audio suspended until the page has been interacted with; the teacher's
// dashboard may sit untouched for a while, so arm it on the first touch of the page.
addEventListener("pointerdown", audio, { once: true });
addEventListener("keydown", audio, { once: true });

// Clue and answer text may carry $...$ maths, because 8th grade algebra needs stacked
// fractions and multi-term radicals that Unicode cannot do. KaTeX renders it on the two
// screens that load KaTeX - the board and the control screen. It is committed to the repo, so
// a blocked CDN cannot reach it; anywhere KaTeX is absent the raw text shows through, which
// looks wrong but is never blank mid-question.
//
// Only ever called on text from the teacher's own spreadsheet. Student-typed text goes
// through textContent and nothing else, here as in the buzzer.
const MATH_SPLIT = /(\$[^$]*\$)/;
function isMath(bit) {
  return bit.length > 2 && bit[0] === "$" && bit[bit.length - 1] === "$";
}

function mathText(el, text) {
  el.textContent = "";
  String(text == null ? "" : text).split(MATH_SPLIT).forEach(function (bit) {
    if (!bit) return;
    const span = document.createElement("span");
    if (window.katex && isMath(bit)) {
      // throwOnError: false so a typo in a clue shows as red text rather than blowing up the
      // projector in front of the class.
      katex.render(bit.slice(1, -1), span, { throwOnError: false, displayMode: false });
    } else {
      span.textContent = bit;
    }
    el.appendChild(span);
  });
}

// What KaTeX would refuse, if it were ever allowed to refuse. Used only by the pre-lesson
// check on the control screen, and it has to ask KaTeX a second time rather than read the
// rendering above: throwOnError: false turns a broken expression into a .katex-error span,
// but an *undefined command* - the likelier typo, \Frac for \frac - is drawn in red with no
// class on it at all. Same KaTeX, same split, one different option.
function mathErrors(text) {
  if (!window.katex) return [];
  return String(text == null ? "" : text).split(MATH_SPLIT).filter(isMath).map(function (bit) {
    try { katex.renderToString(bit.slice(1, -1), { throwOnError: true }); return null; }
    catch (e) { return e.message; }
  }).filter(Boolean);
}

function money(n) {
  const v = Number(n) || 0;
  return (v < 0 ? "-$" : "$") + Math.abs(v).toLocaleString("en-US");
}
