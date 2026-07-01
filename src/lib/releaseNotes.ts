// In-app release notes / changelog (shown to admins at /admin/release-notes).
// Add a new entry at the TOP of RELEASES for each shipped update. Keep the
// wording user-friendly — this is what the team reads, not a git log.

export type ReleaseItemType = "new" | "improved" | "fixed";

export interface ReleaseItem {
  type: ReleaseItemType;
  title: string;
  detail: string;
  requestedBy?: string;
}

export interface Release {
  version: string;
  date: string; // ISO yyyy-mm-dd
  title: string;
  items: ReleaseItem[];
}

export const RELEASES: Release[] = [
  {
    version: "1.0",
    date: "2026-07-01",
    title: "Feedback round 1 — everything you asked for",
    items: [
      {
        type: "fixed",
        title: "Saving a task no longer loses your title or comment",
        detail:
          "Editing a task's title and posting a comment at the same time used to drop one of the two. Now both always save, and a comment never disappears after saving other edits.",
        requestedBy: "Meilinda",
      },
      {
        type: "improved",
        title: "The comment box grows as you type",
        detail:
          "No more cramped 2-line box. Both the “add comment” and “edit comment” boxes expand to fit what you write, then scroll for very long text.",
        requestedBy: "Sidney",
      },
      {
        type: "fixed",
        title: "@mentioning teammates now works reliably",
        detail:
          "The tag dropdown used to vanish on names with a space (e.g. “@John Smith”). Multi-word names now stay selectable, the member list retries if it fails to load, and a missing name can no longer break the box.",
        requestedBy: "Meilinda",
      },
      {
        type: "new",
        title: "Move tasks between project boards",
        detail:
          "Open a task and use the new “Project board” dropdown to move it (and its subtasks) to any board you can access. It lands in the matching column, and the move is audit-logged.",
        requestedBy: "Meilinda",
      },
      {
        type: "new",
        title: "Drag to reorder your project list",
        detail:
          "Grab the handle next to a project in the left sidebar and drag it up or down. Your order is saved.",
        requestedBy: "Sidney",
      },
      {
        type: "new",
        title: "Turn a meeting transcript into tasks (AI)",
        detail:
          "New “Meeting → Tasks” page: paste a meeting transcript and Claude drafts organized tasks with priorities and subtasks. Set each task's board and assignee (individually or all at once), review, and create — nothing is created until you click Create. Tasks land in the “To Do” column of the chosen board.",
        requestedBy: "Meilinda",
      },
    ],
  },
];
