# Feedback Fixes — Work Log

Tracking the fixes for the 7 items submitted through the in-app feedback system
(`./feedback.sh`, backed by the `Feedback` table on the prod droplet). Two team members
submitted them: **Meilinda** (5) and **Sidney** (2). Work proceeds **small → big**, each item
verified in the live app before moving on.

- **Live app (dev):** http://localhost:3001
- **Progress dashboard:** http://localhost:3001/progress.html
- **Plan:** `~/.claude/plans/ok-fix-them-all-buzzing-hamming.md`

Status legend: ✅ done · 🔶 in progress · ⬜ queued

| # | Type | Item | Submitter | Status |
|---|------|------|-----------|--------|
| 1 | Bug | Task save clobbers title/comment | Meilinda | 🔶 verifying |
| 2 | UI | Expandable comment box | Sidney | ⬜ |
| 3 | Bug | @mention tagging intermittent | Meilinda | ⬜ |
| 4 | Feature | Move tasks between boards | Meilinda | ⬜ |
| 5 | Feature | Drag-and-drop sidebar order | Sidney | ⬜ |
| 6 | Feature | Transcript → tasks (Claude) | Meilinda | ⬜ |

---

## 1 · [BUG] Task save clobbers title or comment — Meilinda

**Reported:** "When I changed both the title of the task and then added a comment and clicked
Save, only the title change was saved OR only the comment was saved."

**Root cause (two-directional data loss in the task detail panel):**
1. `handleCommentAdded()` refetched the **entire** task and did `setTask(data)`, replacing the whole
   in-memory object — clobbering other freshly-saved fields / loaded state.
2. The `PATCH /api/tasks/[taskId]` response **does not include `comments`**. So after posting a
   comment, hitting Save ran `setTask(patchResponse)` and the just-posted comment **vanished from
   view** (it was still in the DB, but the user saw it disappear → "comment not saved").

**Fix** — `src/components/tasks/TaskDetailPanel.tsx`:
- `handleCommentAdded()` now refreshes **only** the comments list via a functional update:
  `setTask(prev => ({ ...prev, comments: data.comments }))` — never touches the fields the user is
  editing.
- Every place that applies a PATCH response (`handleSave`, `handleAssigneeChange`,
  `handlePriorityChange`) now **preserves the already-loaded comments**:
  `setTask(prev => ({ ...prev, ...updated, comments: prev?.comments ?? updated.comments ?? [] }))`.

**Why it works:** field edits live in the separate `updates` state and are still sent on Save;
comments are only ever merged in, never replaced by a comment-less server response. Functional
`setTask` updates also make the concurrent comment-refetch vs. save-PATCH ordering safe.

**Files changed:** `src/components/tasks/TaskDetailPanel.tsx` (handleCommentAdded, handleSave,
handleAssigneeChange, handlePriorityChange).

**How to verify:**
1. Open a task, change the **title**, type a **comment**, post it, then click **Save**.
2. Reload the page → both the new title AND the comment persist.
3. Repeat changing priority/assignee while a comment is present → comment stays visible.

**Status:** 🔶 Implemented — verifying in the live app.

---

## 2 · [UI] Expandable comment box — Sidney
_Pending._

## 3 · [BUG] @mention tagging intermittent — Meilinda
_Pending. Deep-dive root causes: typeahead regex `/(?:^|\s)@(\w*)$/` breaks on the space in
multi-word names; project-members fetch fails silently; missing null-name guard._

## 4 · [FEATURE] Move tasks between boards — Meilinda
_Pending._

## 5 · [FEATURE] Drag-and-drop sidebar order — Sidney
_Pending._

## 6 · [FEATURE] Transcript → tasks via Anthropic Claude — Meilinda
_Pending. Needs `ANTHROPIC_API_KEY` on the server._
