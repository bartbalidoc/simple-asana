# Release Notes

User-facing changelog for the Project Hub. Also shown in-app to admins at
**Admin → Release Notes** (`/admin/release-notes`), sourced from
[`src/lib/releaseNotes.ts`](src/lib/releaseNotes.ts). Keep the two in sync — add each
new release to the top of both.

For the engineering detail behind each change (root causes, files, tests), see
[FEEDBACK_FIXES.md](FEEDBACK_FIXES.md).

---

## v1.0 — 2026-07-01 · Feedback round 1 — everything you asked for

Six items submitted through the in-app feedback button, all shipped.

- **Fixed — Saving a task no longer loses your title or comment** _(requested by Meilinda)_
  Editing a task's title and posting a comment at the same time used to drop one of the two.
  Now both always save, and a comment never disappears after saving other edits.

- **Improved — The comment box grows as you type** _(requested by Sidney)_
  Both the "add comment" and "edit comment" boxes expand to fit what you write, then scroll for
  very long text.

- **Fixed — @mentioning teammates now works reliably** _(requested by Meilinda)_
  The tag dropdown used to vanish on names with a space (e.g. "@John Smith"). Multi-word names now
  stay selectable, the member list retries if it fails to load, and a missing name can no longer
  break the box.

- **New — Move tasks between project boards** _(requested by Meilinda)_
  Open a task and use the new "Project board" dropdown to move it (and its subtasks) to any board
  you can access. It lands in the matching column, and the move is audit-logged.

- **New — Drag to reorder your project list** _(requested by Sidney)_
  Grab the handle next to a project in the left sidebar and drag it up or down. Your order is saved.

- **New — Turn a meeting transcript into tasks (AI)** _(requested by Meilinda)_
  New "Meeting → Tasks" page: paste a meeting transcript and Claude drafts organized tasks with
  priorities and subtasks. Review, pick a board, and create them — nothing is created until you
  click Create.
