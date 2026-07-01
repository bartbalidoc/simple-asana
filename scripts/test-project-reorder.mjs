// Unit test for the sidebar project reorder logic (feedback #5).
// Mirrors ProjectSidebarList.onDragEnd (array move) and the /api/projects/reorder
// renumbering (order = index). Keep in sync with those two files.
//
// Run:  node scripts/test-project-reorder.mjs

// Move item from index `from` to index `to` (what onDragEnd does).
function reorder(list, from, to) {
  const r = Array.from(list);
  const [moved] = r.splice(from, 1);
  r.splice(to, 0, moved);
  return r;
}

// Server renumbering: assign order = position, top→bottom.
function renumber(orderedIds) {
  return orderedIds.map((id, index) => ({ id, order: index }));
}

const IDS = ["a", "b", "c", "d"]; // initial top→bottom

let pass = 0,
  fail = 0;
const eq = (a, b) => JSON.stringify(a) === JSON.stringify(b);
function check(label, got, want) {
  const ok = eq(got, want);
  if (ok) pass++;
  else fail++;
  console.log(`  ${ok ? "✓" : "✗"} ${label}${ok ? "" : `\n      got:  ${JSON.stringify(got)}\n      want: ${JSON.stringify(want)}`}`);
}

console.log("1) Drag first → last:");
check("order becomes b,c,d,a", reorder(IDS, 0, 3), ["b", "c", "d", "a"]);

console.log("2) Drag last → first:");
check("order becomes d,a,b,c", reorder(IDS, 3, 0), ["d", "a", "b", "c"]);

console.log("3) Drag middle (b) below c:");
check("order becomes a,c,b,d", reorder(IDS, 1, 2), ["a", "c", "b", "d"]);

console.log("4) Renumber assigns unique 0..N-1 in order:");
check(
  "a,c,b,d → 0,1,2,3",
  renumber(["a", "c", "b", "d"]),
  [{ id: "a", order: 0 }, { id: "c", order: 1 }, { id: "b", order: 2 }, { id: "d", order: 3 }]
);

console.log("5) No duplicate order values after renumber (the all-zeros collision is gone):");
{
  const orders = renumber(reorder(IDS, 0, 2)).map((x) => x.order);
  check("orders are all distinct", new Set(orders).size === orders.length, true);
}

console.log(`\n${fail === 0 ? "✅ ALL PASSED" : "❌ FAILURES"} — ${pass} passed, ${fail} failed`);
process.exit(fail === 0 ? 0 : 1);
