// Unit test for the "move task to another board" column remapping (feedback #4).
// When a task moves to a new project, its old columnId belongs to the OLD board,
// so the server must land it in the destination column matching its status (or
// the destination's first column as a fallback). This mirrors the logic in
// src/app/api/tasks/[taskId]/route.ts — keep them in sync.
//
// Run:  node scripts/test-move-task.mjs

const STATUS_TO_COLUMN = {
  TODO: "To Do",
  IN_PROGRESS: "In Progress",
  IN_REVIEW: "In Review",
  DONE: "Done",
};

function pickDestColumn(columns, status) {
  return (
    columns.find((c) => c.name === STATUS_TO_COLUMN[status]) ||
    columns[0] ||
    null
  );
}

const STANDARD = [
  { id: "c1", name: "To Do" },
  { id: "c2", name: "In Progress" },
  { id: "c3", name: "In Review" },
  { id: "c4", name: "Done" },
];

let pass = 0,
  fail = 0;
function check(label, got, want) {
  const ok = got === want;
  if (ok) pass++;
  else fail++;
  console.log(`  ${ok ? "✓" : "✗"} ${label}${ok ? "" : `  (got ${got}, want ${want})`}`);
}

console.log("1) Status maps to the same-named column on the destination board:");
check("TODO → To Do", pickDestColumn(STANDARD, "TODO")?.id, "c1");
check("IN_PROGRESS → In Progress", pickDestColumn(STANDARD, "IN_PROGRESS")?.id, "c2");
check("IN_REVIEW → In Review", pickDestColumn(STANDARD, "IN_REVIEW")?.id, "c3");
check("DONE → Done", pickDestColumn(STANDARD, "DONE")?.id, "c4");

console.log("2) Destination missing the matching column → first column fallback:");
const ONLY_TODO = [{ id: "x1", name: "To Do" }];
check("IN_REVIEW with no In Review col → first col", pickDestColumn(ONLY_TODO, "IN_REVIEW")?.id, "x1");

console.log("3) Destination with a custom column set → first column fallback:");
const CUSTOM = [
  { id: "k1", name: "Backlog" },
  { id: "k2", name: "Shipping" },
];
check("DONE with custom cols → first col", pickDestColumn(CUSTOM, "DONE")?.id, "k1");

console.log("4) Destination with NO columns → null (task lands column-less, not crash):");
check("no columns → null", pickDestColumn([], "TODO"), null);

console.log(`\n${fail === 0 ? "✅ ALL PASSED" : "❌ FAILURES"} — ${pass} passed, ${fail} failed`);
process.exit(fail === 0 ? 0 : 1);
