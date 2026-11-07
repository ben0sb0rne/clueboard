// The board's colours, as a pair the teacher picks and everything else derives from.
//
// Only two are ever set here - the ground and the accent. Every other colour in the project
// is a step away from one of those, written as relative colour in palette.css: an absolute
// lightness, a share of the source's chroma, and a hue nudge. That is not a scheme invented
// for theming; it is what the hand-picked palette already was. Measured in OKLCH, every blue
// in the project sat between hue 265 and 282 and every gold between 63 and 69, with lightness
// doing all the other work, and the twenty derived lines reproduce their original hex exactly.
//
// Which is the property that matters: with no theme chosen, nothing moves at all.
//
// Lightness is what carries contrast, and every alternate keeps the original's lightness at
// every step. So the dim/normal/lit podium ladder reads the same in all of them, and a teacher
// cannot pick a pair that makes the board unreadable from the back of the room - only one that
// is not to their taste.

var THEMES = [
  { name: "Studio Blue", ground: "#04106e", accent: "#fea441" },
  { name: "Holly",       ground: "#480907", accent: "#28e114" },
  { name: "Aubergine",   ground: "#360a4c", accent: "#c4c313" },
  { name: "Pine",        ground: "#1a2a06", accent: "#b9affe" },
  { name: "Slate",       ground: "#072933", accent: "#fe9c9d" }
];

// `game` is world-writable with no auth, so a theme arrives from the network like everything
// else in the room: a student with devtools can put anything in it. Nothing but six hex digits
// is ever written into a style, because a custom property will carry whatever token it is given
// and var() will happily substitute it somewhere it was never meant to go.
function okColour(v) { return typeof v === "string" && /^#[0-9a-fA-F]{6}$/.test(v); }

// Removing the properties rather than setting the originals back: palette.css already holds
// them, so the default lives in one place instead of two that can drift.
function applyTheme(t) {
  var s = document.documentElement.style;
  if (t && okColour(t.ground) && okColour(t.accent)) {
    s.setProperty("--board-blue", t.ground);
    s.setProperty("--value-gold", t.accent);
  } else {
    s.removeProperty("--board-blue");
    s.removeProperty("--value-gold");
  }
}

// The one a room is using, by its colours rather than its name, so a custom pair picked with
// the colour inputs round-trips as readily as a preset.
function themeIndex(t) {
  if (!t) return 0;
  for (var i = 0; i < THEMES.length; i++) {
    if (THEMES[i].ground === t.ground && THEMES[i].accent === t.accent) return i;
  }
  return -1;   // a pair of their own
}
