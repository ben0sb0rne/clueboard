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

// Placeholder sounds until the real files land. The ids are what gets stored and are meant to
// be stable; the labels are not. Every one of them plays beep() for now - see the lobby grid.
// Eight to a group, because eight is what the grid flows in: 8 across, then 4, then 2.
// Nothing here is from the show: those cues are enforced. See ROADMAP.md.
const BUZZERS = [
  { group: "Animals", sounds: [
    { id: "duck",    label: "Duck" },
    { id: "cow",     label: "Cow" },
    { id: "sheep",   label: "Sheep" },
    { id: "cat",     label: "Cat" },
    { id: "dog",     label: "Dog" },
    { id: "chimp",   label: "Chimp" },
    { id: "rooster", label: "Rooster" },
    { id: "frog",    label: "Frog" }
  ] },
  { group: "Noises", sounds: [
    { id: "airhorn", label: "Airhorn" },
    { id: "carhorn", label: "Car horn" },
    { id: "scratch", label: "Record scratch" },
    { id: "gong",    label: "Gong" },
    { id: "boing",   label: "Boing" },
    { id: "whistle", label: "Whistle" },
    { id: "bell",    label: "Bell" },
    { id: "clang",   label: "Clang" }
  ] }
];

// Flat lookup, for turning a stored id back into something to show.
function buzzerLabel(id) {
  if (!id) return "";
  for (const g of BUZZERS) {
    for (const s of g.sounds) if (s.id === id) return s.label;
  }
  return id;      // a sound that has since been retired still reads as something
}

// A team exists before it is named: the code screen creates the row and the lobby is where
// the name is typed. Everywhere a team is named TO SOMEBODY ELSE - the dashboard, the board's
// welcome card - goes through here, so a team mid-lobby reads as joining rather than as a
// blank gap. The lobby's own name box stays genuinely empty, which is why "" is stored rather
// than a placeholder somebody would have to delete.
function teamLabel(t) {
  return (t && t.name) || "Joining...";
}

function money(n) {
  const v = Number(n) || 0;
  return (v < 0 ? "-$" : "$") + Math.abs(v).toLocaleString("en-US");
}
