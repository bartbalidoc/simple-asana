# Asana Import → Staging → Distribute

A system for bringing the team's real **Asana** work into Simple Asana so an admin
(Sidney) can organize it and hand it out, without exposing it to the whole team.

Built 2026-06-26. Lives entirely in the existing app; no external services beyond
the Asana data pull (done by Claude via the Asana MCP tools, not by the app server).

---

## Concept

1. **Import** Asana projects into a **hidden, admin-only "Staging" area**.
2. Staging is invisible to workers — it never appears in the normal projects list,
   the dashboard, global search, or via direct URL for non-admins.
3. From Staging, the admin **copies** a task (or subtask) into a **real project**
   (existing or newly created) and assigns it to a person. The staged original
   **stays in place and turns green** ("Copied ✓") so you can see what's been handed out.

The team's live working projects are completely untouched by any of this.

---

## Data model (additive — `prisma/schema.prisma`)

- `Project.isStaging Boolean @default(false)` — hidden/admin-only flag.
- `Project.asanaId String? @unique` — source Asana project GID (idempotent import).
- `Task.asanaId String? @unique` — source Asana task GID. Copies/distributed tasks have `null`.
- `Task.distributedAt DateTime?` — set when a staged task is copied out (drives the green color).
- `Task.originalAssignee String?` — the original Asana assignee's name/email, kept as
  **text** so it survives even for people who aren't Simple Asana users, and is carried
  onto copies so you always see who first owned it.
- `Comment.asanaId String? @unique` — source Asana story GID (idempotent import).

All changes are additive, so the boot-time `prisma db push` applies them with no migration.

### Where staging is hidden
- `GET /api/projects` — `isStaging:false` in both the admin and member branches.
- `GET /api/projects/[id]` — staging projects return 404 for non-admins.
- `GET /api/dashboard` — staging projects and their tasks are excluded.
- `GET /api/search` — global search excludes staging.

---

## Import API — `POST /api/admin/import`

Guarded by header `x-seed-secret: <SEED_SECRET>` (same secret as the user seed).
Get it from prod:
```bash
ssh root@206.189.200.138 'docker exec simple-asana-app-1 printenv SEED_SECRET'
```

**Idempotent**: every project/task/comment is keyed by its Asana GID and **upserted**,
so a payload can be re-sent safely and a big project can be POSTed in chunks
(same project block, a subset of tasks each time).

### Payload
```jsonc
{
  "adminEmail": "sidney@balidoc.com",      // owner/createdBy + comment-author fallback
  "project": {
    "asanaId": "<gid>",
    "name": "<project name>",
    "tasks": [ TaskNode, ... ]
  }
}
```
`TaskNode`:
```jsonc
{
  "asanaId": "<gid>",
  "title": "...",
  "notes": "...",                 // → encrypted description
  "completed": false,
  "status": "IN_PROGRESS",        // optional; overrides the completed→DONE/TODO default
  "assigneeEmail": "x@balidoc.com",
  "assigneeName": "X",
  "dueDate": "2026-07-02",
  "comments": [ { "asanaId","authorEmail","authorName","body","createdAt" } ],
  "subtasks": [ TaskNode, ... ]   // recursive
}
```

What it does per task: encrypts title/notes, maps `assigneeEmail`→`User` (else unassigned),
stores `originalAssignee`, resolves the column from the status, recursively creates subtasks,
and creates comments (author mapped by email, else the import admin with attribution
prepended). **Status precedence**: explicit `status` wins → else `completed ? DONE : TODO`.

⚠️ A re-import that omits a field **overwrites** it (e.g. sending a task without `notes`
clears its description). To update only the status, re-send the **full** task data plus the
new `status`. Sending `subtasks:[]` does **not** delete existing subtasks.

---

## Distribute API — `POST /api/admin/tasks/[taskId]/distribute`

Admin-only. Copies a staged task **or subtask** into a real project.
```jsonc
{ "destProjectId": "...",      // OR
  "newProjectName": "...",     // create a fresh real project
  "assigneeId": "...",         // optional override (else keep original)
  "aiGenerate": false }        // see below
```
- A distributed **subtask becomes a new top-level task** in the destination.
- Cloning copies the **encrypted ciphertext directly** (same key) — no decrypt/re-encrypt.
- `originalAssignee` is carried onto the copy; the assignee is auto-added as a project member.
- The staged original is left in place with `distributedAt = now()` (the green "Copied ✓" state).
- **`aiGenerate: true`** (default for the per-subtask "✨ Make into task" button): the bare
  subtask title is expanded by `gpt-4o-mini` into a full task (description + generated
  subtasks) before creating it. Falls back to a plain copy if AI is unavailable.

---

## Admin UI — `/admin/staging`

- Sidebar → **Staging (Asana import)** (admins only).
- Defaults to a **Board view** (tasks grouped into To Do / In Progress / In Review / Done),
  with a header toggle to **Rows** (a compact stacked list). Each card/row shows the
  **original owner**, the distributed color, **Copy to project**, and a quick **Delete**.
- Click a task → the detail panel opens with a "📥 Staged from Asana" banner, the
  Copy-to-project control, and on each subtask the "✨ Make into task for someone" action.
- "Open as board →" opens the staged project in the full drag-and-drop board.

---

## How the data was pulled from Asana

The app server has **no** Asana credentials — the Asana data is fetched by Claude through
the `mcp__claude_ai_Asana__*` tools (connected as `meilinda@balidoc.com`, workspace
`1203748720140065`) and POSTed to the import API. Large imports were run via parallel
general-purpose subagents (load `mcp__claude_ai_Asana__get_tasks`/`get_task` via ToolSearch
→ fetch + paginate → POST in chunks) to keep them reliable and out of the main context.

### Status from Asana sections (important)
Asana has **no** To Do / In Progress status — work is organized into **named sections**.
The importer maps a task's section → status:
`/progress|daily|hold/ → IN_PROGRESS`, `/review/ → IN_REVIEW`,
`/done|complete/ or completed → DONE`, else `TODO`.
(e.g. PT Sehat's "In Progress", "Daily Task" and "On Hold" sections all become In Progress.)

For **multi-homed** tasks (a task that lives in several Asana boards at once), the section
must be taken from the membership matching **this** project
(`memberships.find(m => m.project.gid === <projGid>).section.name`), not the first
membership — otherwise a task gets the status of whichever board Asana happened to list first.

### Multi-homing
Because `Task.asanaId` is globally unique, a multi-homed task can only live in **one** staging
project — whichever imported it **last** (last-writer-wins on `projectId`). So a task shared
between, say, PT Sehat and Marketing appears once, under one of them. Nothing is lost; counts
per project just reflect this. To pin shared tasks to a master board, import that project last.

---

## Re-running / maintenance

- **Re-import a project**: rebuild the payload from Asana and POST again (idempotent).
- **Backfill subtasks/comments**: for tasks with subtasks, `get_task(include_subtasks,
  include_comments)`, filter out bot comments (`created_by === null`), and re-POST the
  **full** task data + subtasks + comments.
- **Fix statuses**: re-POST full task data with the section-derived `status` (project-aware
  section selection for multi-homed tasks).
- **Delete a staged project/task**: from the Staging UI (admin), or `DELETE /api/projects/[id]`
  (cascades to its tasks) / `DELETE /api/tasks/[id]`.

## Current state (2026-06-26)
All 7 active Asana projects imported (~441 unique top-level tasks + ~430 subtasks + real
comments), statuses derived from each board's own section. The 11 "DO NOT USE" archives and
the empty "Sidney" project were intentionally skipped.
