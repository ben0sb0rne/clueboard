// Clue and answer maths, with nothing else attached: the board and the control screen load it
// beside common.js, and the designer, which has no Firebase and so no common.js, loads it
// alone. One copy of the rule for what counts as maths, so the designer's preview cannot
// disagree with the projector.
//
// Clue and answer text may carry $...$ maths, because 8th grade algebra needs stacked
// fractions and multi-term radicals that Unicode cannot do. KaTeX renders it on the
// screens that load KaTeX - the board, the control screen, the designer, and a student's
// device while the clue card is on. It is committed to the repo, so
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
