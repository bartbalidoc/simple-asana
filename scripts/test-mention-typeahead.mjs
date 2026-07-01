// Unit test for the @mention typeahead logic (feedback #3).
// Verifies the detection + insertion regexes handle multi-word names like
// "@John Smith" — the case that used to make the dropdown vanish at the space.
//
// Run:  node scripts/test-mention-typeahead.mjs
// These regexes MUST stay in sync with src/components/tasks/CommentForm.tsx.

const DETECT = /(?:^|\s)@([^@\n]{0,40})$/;
const INSERT = /@[^@\n]{0,40}$/;

// Mirror of CommentForm's suggestion filter.
function suggest(query, members) {
  if (query === null) return [];
  const q = query.toLowerCase();
  return members
    .filter(
      (m) =>
        (m.name || "").toLowerCase().includes(q) ||
        (m.email || "").toLowerCase().includes(q)
    )
    .slice(0, 6);
}

// Simulate typing `text` (cursor at end) and picking the first suggestion.
function typeAndPick(text, members) {
  const m = text.match(DETECT);
  const query = m ? m[1] : null;
  const suggestions = suggest(query, members);
  const picked = suggestions[0];
  let inserted = null;
  if (picked) {
    const label = picked.name || picked.email || "user";
    inserted = text.replace(INSERT, `@${label} `);
  }
  return { query, suggestionNames: suggestions.map((s) => s.name), picked, inserted };
}

const MEMBERS = [
  { id: "1", name: "John Smith", email: "john@balidoc.com" },
  { id: "2", name: "Meilinda", email: "meilinda@balidoc.com" },
  { id: "3", name: "Sidney", email: "sidney@balidoc.com" },
  { id: "4", name: null, email: "noname@balidoc.com" }, // null-name edge case
];

let pass = 0;
let fail = 0;
function check(label, cond, detail = "") {
  if (cond) {
    pass++;
    console.log(`  ✓ ${label}`);
  } else {
    fail++;
    console.log(`  ✗ ${label}  ${detail}`);
  }
}

console.log("1) Single-word name still works ('@Meil'):");
{
  const r = typeAndPick("@Meil", MEMBERS);
  check("dropdown shows Meilinda", r.suggestionNames.includes("Meilinda"), JSON.stringify(r));
  check("inserts '@Meilinda '", r.inserted === "@Meilinda ", `got: ${r.inserted}`);
}

console.log("2) THE BUG: multi-word name past the space ('@John Sm'):");
{
  const r = typeAndPick("@John Sm", MEMBERS);
  check("dropdown STILL shows John Smith", r.suggestionNames.includes("John Smith"), JSON.stringify(r));
  check("inserts full '@John Smith '", r.inserted === "@John Smith ", `got: ${r.inserted}`);
}

console.log("3) Mention mid-sentence with text before it ('Hey @John Smi'):");
{
  const r = typeAndPick("Hey @John Smi", MEMBERS);
  check("inserts 'Hey @John Smith '", r.inserted === "Hey @John Smith ", `got: ${r.inserted}`);
}

console.log("4) Second mention after a finished one ('@Sidney thanks, @John Sm'):");
{
  const r = typeAndPick("@Sidney thanks, @John Sm", MEMBERS);
  check(
    "only the last mention is replaced",
    r.inserted === "@Sidney thanks, @John Smith ",
    `got: ${r.inserted}`
  );
}

console.log("5) Emails do NOT trigger the menu ('email me foo@bar'):");
{
  const r = typeAndPick("email me foo@bar", MEMBERS);
  check("no mention query (menu closed)", r.query === null, `query: ${JSON.stringify(r.query)}`);
}

console.log("6) Null-name member does not crash the filter ('@no'):");
{
  let threw = false;
  try {
    typeAndPick("@no", MEMBERS);
  } catch {
    threw = true;
  }
  check("filter survives null name", threw === false);
}

console.log("7) Finished mention + more words closes the menu ('@John Smith thanks for'):");
{
  const r = typeAndPick("@John Smith thanks for", MEMBERS);
  check("no member matches the long query → menu closed", r.suggestionNames.length === 0, JSON.stringify(r));
}

console.log(`\n${fail === 0 ? "✅ ALL PASSED" : "❌ FAILURES"} — ${pass} passed, ${fail} failed`);
process.exit(fail === 0 ? 0 : 1);
