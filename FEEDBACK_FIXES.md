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
| 1 | Bug | Task save clobbers title/comment | Meilinda | ✅ live |
| 2 | UI | Expandable comment box | Sidney | ✅ live |
| 3 | Bug | @mention tagging intermittent | Meilinda | ✅ live |
| 4 | Feature | Move tasks between boards | Meilinda | ✅ built |
| 5 | Feature | Drag-and-drop sidebar order | Sidney | ✅ built |
| 6 | Feature | Transcript → tasks (Claude) | Meilinda | ✅ live |

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

**Status:** ✅ Live on production (commit `c729778`, deployed 2026-07-01). Prod DB backed up first;
data intact (12 users / 18 projects / 183 comments / 1648 tasks).

---

## 2 · [UI] Expandable comment box — Sidney

**Reported:** "The comment text box is too small — writing/reviewing longer feedback is hard when you
only see a couple of lines. Make it dynamic/expandable (or resizable)."

**Fix — auto-grow the textarea to fit its content, up to a max, then scroll:**
- `src/components/tasks/CommentForm.tsx` — the "add a comment" box. Removed the fixed `rows={2}`; added
  a `useLayoutEffect` keyed on the comment text that sets the height to `scrollHeight` (capped at
  260px, then it scrolls). Keeps a ~2-line minimum via `min-height`. Covers typing, @mention
  insertion, and the reset-to-small after posting. Disabled the manual resize grip (`resize-none`)
  since it now grows on its own.
- `src/components/tasks/CommentList.tsx` — the inline "edit comment" box gets the same auto-grow (via a
  `ref` + `onChange` sizer) so editing a long existing comment opens at the right height.

No new dependency (no `react-textarea-autosize`) — plain DOM measurement.

**How to verify:** open a task, start typing a long multi-line comment → the box grows as you type,
and stops growing (scrolls) past ~a dozen lines. Edit an existing long comment → opens tall enough to
read.

**Status:** ✅ Live on production (commit `f759ec7`, deployed 2026-07-01). Prod DB backed up first.

## 3 · [BUG] @mention tagging intermittent — Meilinda

**Reported:** "Tagging people in the comment box worked before but is not working always."

**Deep-dive root causes (ranked) and fixes:**
1. **PRIMARY — typeahead regex broke on spaces.** `CommentForm.tsx` used `/(?:^|\s)@(\w*)$/`; `\w`
   stops at a space, so typing `@John Smith` made the dropdown **vanish the moment you hit space**
   after "John" — multi-word names were untaggable. Fixed to `/(?:^|\s)@([^@\n]{0,40})$/` (allows
   spaces, bounded). The **insertion** regex was widened to match (`/@[^@\n]{0,40}$/`) so picking a
   suggestion replaces the whole `@John Sm` → `@John Smith `.
2. **Members fetch failed silently.** `TaskDetailPanel.tsx` swallowed any error loading project
   members, leaving the dropdown empty with no clue. Now **retries once** and logs a visible warning.
3. **Null-name crash.** `CommentForm.tsx` filter called `m.name.toLowerCase()` with no guard; a member
   with a null name could throw and break the box. Now `(m.name || "")`; insertion also falls back to
   email/`"user"`.

**Test:** `scripts/test-mention-typeahead.mjs` — 9 assertions covering single- and multi-word names,
mid-sentence mentions, a second mention after a finished one, emails NOT triggering the menu, and the
null-name edge case. Run with `node scripts/test-mention-typeahead.mjs`. **All 9 pass.**

**How to verify in the app:** open a task, type `@John Smith` (a real multi-word teammate) → the
dropdown stays open through the space and inserts the full name; they get the mention email.

**Status:** ✅ Implemented + unit-tested — deploying to live now.

## 4 · [FEATURE] Move tasks between boards — Meilinda

**Reported:** "How can I move tasks to someone else's project board?" + a one-off "move this task to
Projects with Bart". Flagged by the owner as **core — must work well and be easy.**

**What was missing:** the task-update API accepted a new `columnId` but never a new `projectId`, and
there was no UI to move a task. Tasks were stuck on the board they were created in.

**Implemented:**
- **API** (`src/app/api/tasks/[taskId]/route.ts`, PATCH): now accepts `projectId`. When it differs
  from the task's current project it:
  - **Authorizes the destination** — the mover must be a member of the destination board (admins may
    move anywhere); access to the source board was already checked. Rejects non-members with 403.
  - **Remaps the column** — the old `columnId` belongs to the source board, so the task lands in the
    destination column matching its status (To Do / In Progress / In Review / Done), falling back to
    the destination's first column. Placed at the top (`order = 0`).
  - **Carries subtasks along** (`updateMany` on `parentTaskId`) so nothing is orphaned on the old
    board. Subtasks can't be moved on their own (they follow the parent).
  - **Refuses** moving onto a staging/import board or a non-existent project.
  - **Audit-logs** the move explicitly (`from → to` project ids).
- **UI** (`src/components/tasks/TaskDetailPanel.tsx`): a clear **"Project board"** dropdown at the top
  of the task's detail panel showing the current board plus "→ Move to: <board>" for every board the
  user can access. Picking one confirms, moves, toasts, refreshes the source board, and closes the
  panel. Only shown for real (non-staged) top-level tasks.
- Also fixed one more instance of the item-#1 comment-wipe (the inline **Status** change handler now
  preserves loaded comments too).

**Test:** `scripts/test-move-task.mjs` — 7 assertions on the destination-column remapping (status →
column, custom-column fallback, no-columns safety). **All 7 pass.**

**How to verify:** open a task → "Project board" dropdown → pick another board → confirm. The task
leaves the current board and appears on the destination board in the column matching its status; its
subtasks come with it. First real use: move Meilinda's "touristpharmacy.com" task → "Projects with
Bart".

**Status:** ✅ Live on production (commit `d62144f`, deployed 2026-07-01). Prod DB backed up first;
data intact (12 users / 18 projects / 1648 tasks).

## 5 · [FEATURE] Drag-and-drop sidebar order — Sidney

**Reported:** "The project list in the left sidebar is unorganized — let me reorder it (drag-and-drop
or A→Z)." Owner chose **drag-and-drop**.

**Implemented (global/shared order):**
- **Schema** (`prisma/schema.prisma`): added `order Float @default(0)` to `Project`. Applied to prod
  automatically on deploy (the container boots with `prisma db push`).
- **API:**
  - `GET /api/projects` now sorts by `order` (tiebreak by name).
  - `PATCH /api/projects/[projectId]` accepts `order`.
  - New `POST /api/projects/reorder` — takes the full `orderedIds[]` and renumbers `order = index` in
    one transaction (no colliding values — important because every project starts at order 0). A user
    can only reorder boards they can access (admins: all); unknown ids are ignored.
- **UI** (`src/components/layout/ProjectSidebarList.tsx`): rewritten with `@hello-pangea/dnd` (already
  used by the task board). Each project has a **grip handle (⠿)** to drag — clicks on the name still
  navigate normally. Optimistic reorder, persisted via the reorder endpoint, reverts on failure.

**Scope note:** order is **global/shared** (one order for everyone), stored on the project. Simple and
matches a small shared workspace. Per-user ordering would need per-membership order — noted as a
possible follow-up.

**Test:** `scripts/test-project-reorder.mjs` — 5 assertions on the array-move + renumber logic (unique
0..N-1, no collisions). **All 5 pass.**

**How to verify:** in the left sidebar, hover a project → grab the grip handle → drag it up/down →
release. The order sticks after reload.

**Status:** ✅ Live on production (commit `b40dc89`, deployed 2026-07-01). Verified: `Project.order`
column added on boot, all 18 projects intact, and `GET /api/projects` returns `order` (checked via an
authenticated admin request). Prod DB backed up first.

## 6 · [FEATURE] Transcript → tasks via Anthropic Claude — Meilinda

**Reported:** "I want to automate my monthly/weekly items and connect it from Claude — Claude looks at
the meeting transcripts, makes an action list, and creates organized tasks in this app."

**Implemented — the app's first REAL Anthropic Claude integration** (the older `/api/ai/*` routes call
OpenAI despite their "Claude" comments):
- **`src/lib/anthropic.ts`** — `transcriptToTasks()` calls the Claude **Messages API**
  (`POST https://api.anthropic.com/v1/messages`, headers `x-api-key` + `anthropic-version: 2023-06-01`)
  with **structured outputs** (`output_config.format` → `json_schema`) so Claude always returns
  schema-valid JSON (title, description, priority, subtasks). Model defaults to **`claude-opus-4-8`**,
  overridable via `ANTHROPIC_MODEL` (e.g. `claude-haiku-4-5` for ~5× lower cost). Guards the
  `stop_reason: "refusal"` case; normalizes/validates every field before it reaches the UI.
- **`POST /api/ai/transcript-to-tasks`** — auth-gated; input `{ transcript }`; returns a **draft** task
  list. Preview only — it never creates anything. Length guards (min ~20, max 100k chars).
- **UI `/transcript`** (+ "Meeting → Tasks" sidebar link, all users) — paste transcript → **Generate
  tasks** → review/edit/select drafts (editable title + priority, checkboxes) → pick a board →
  **Create**. Creation reuses `POST /api/tasks` (parent + subtasks via `parentTaskId`), with progress.

**Config:** `ANTHROPIC_API_KEY` added to `.env.local` (dev), the droplet `.env` (prod), and passed
through `docker-compose.yml`; documented in `.env.example`. Key validated with a live call (Opus 4.8
extracted 5 correctly-prioritized tasks from a sample transcript).

**How to verify:** open **Meeting → Tasks**, paste a meeting transcript → Generate → a draft task list
appears → tweak/select → pick a board → Create → the tasks (and subtasks) show up on that board.

**Status:** ✅ Live on production (commit `7fae9eb`, deployed 2026-07-01). Verified end-to-end on prod:
`ANTHROPIC_API_KEY` present in the container, and an authenticated admin request to
`/api/ai/transcript-to-tasks` returned 3 correctly-prioritized draft tasks (with subtasks) from a real
transcript — preview only, nothing created.

**Follow-up (2026-07-01):** created tasks weren't appearing on the board — they were created with
`columnId: null` (the board's `byColumn` filter hides column-less tasks). Fixed: the create flow now
sets each task's `columnId` to the destination board's "To Do" column (first column fallback). Also
**added per-task controls** — each draft now has its own **board** and **assignee** dropdown (plus
"apply to all" bulk setters); subtasks + assignee follow the parent. Rescued the 6 already-orphaned
tasks in "Future Projects" by attaching them to that board's To Do column.
