// node ui.test.js
// A button with no style of its own falls through to the project's `border: 0` reset and
// renders as bare text. That has now shipped twice - "Show the clue" and "Lock Wager" - and
// both times a screenshot caught it rather than use, because each only appears in a state
// that is easy to miss. This is cheaper than a third review.

const assert = require("assert");
const fs = require("fs");

const css = ["style.css", "board.css"].map((f) => fs.readFileSync(f, "utf8")).join("\n");
const pages = ["index.html", "control.html", "board.html"];
const unstyled = [];

pages.forEach((page) => {
  const html = fs.readFileSync(page, "utf8");
  for (const tag of html.match(/<button\b[^>]*>/g) || []) {
    const id = (tag.match(/\sid="([^"]+)"/) || [])[1];
    const classes = ((tag.match(/\sclass="([^"]+)"/) || [])[1] || "").split(/\s+/).filter(Boolean);
    // Styled if its own id is a selector, or any of its classes is.
    const byId = id && new RegExp("#" + id + "\\b").test(css);
    const byClass = classes.some((c) => new RegExp("\\." + c + "\\b").test(css));
    if (!byId && !byClass) unstyled.push(page + ": " + (id ? "#" + id : tag.slice(0, 48)));
  }
});

if (unstyled.length) {
  console.log("  FAIL buttons with no style of their own:");
  unstyled.forEach((u) => console.log("         " + u));
} else {
  console.log("  ok   every button carries a style of its own");
}
console.log("\n" + (unstyled.length ? unstyled.length + " unstyled" : "0 unstyled"));
process.exit(unstyled.length ? 1 : 0);
