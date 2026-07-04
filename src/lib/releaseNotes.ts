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
    version: "1.3",
    date: "2026-07-04",
    title: "Task guests — pull anyone into one task",
    items: [
      {
        type: "new",
        title: "Invite anyone to a single task, without sharing the board",
        detail:
          "Need a review from someone outside the project? @mention them in a comment (the dropdown now shows the whole team) or use the new Guests row on the task. They get a notification, can open and comment on that one task — and see nothing else of the project. Guest tasks appear on their Dashboard with a purple Guest badge; guests can be removed anytime and every change is audit-logged.",
        requestedBy: "Bart",
      },
    ],
  },
  {
    version: "1.2",
    date: "2026-07-04",
    title: "BaliDoc on your phone",
    items: [
      {
        type: "new",
        title: "The whole app now works on small screens",
        detail:
          "Open BaliDoc on your phone and everything fits: the menu tucks into a drawer behind the ☰ button (your account and sign-out live there too), boards swipe one column at a time with the next column peeking in, and tasks open as a full-screen panel. Search and the 🔔 bell stay in the top bar.",
        requestedBy: "Bart",
      },
    ],
  },
  {
    version: "1.1",
    date: "2026-07-03",
    title: "Feedback round 2 — attachments, speed, notifications & more",
    items: [
      {
        type: "fixed",
        title: "Attachments now open when you click them",
        detail:
          "Uploaded files (PDFs, images…) used to show a Google “request access” page. Clicking a file now opens it right in your browser, securely through the app — no Google account needed. Every view is audit-logged.",
        requestedBy: "Meilinda",
      },
      {
        type: "improved",
        title: "Much faster loading for admins",
        detail:
          "Opening the project list used to download every task in the company behind the scenes. It now loads just the counts, and boards send far less data — pages open noticeably faster, especially on admin accounts.",
        requestedBy: "Gabriel",
      },
      {
        type: "new",
        title: "In-app notifications with one-click deep links",
        detail:
          "The new 🔔 bell in the top bar shows updates on tasks you're involved in — comments, status changes, board moves, @mentions, and new assignments. Everyone on the task (assignee, subtask assignees, creator) is notified, and clicking a notification takes you straight to the task. No more searching.",
        requestedBy: "Sidney",
      },
      {
        type: "new",
        title: "Formatting in task descriptions (bold, lists…)",
        detail:
          "Task and subtask descriptions now support simple formatting: **bold**, *italic*, bullet and numbered lists, headings and links — with a Write/Preview toggle so you can check how it looks.",
        requestedBy: "Gabriel",
      },
      {
        type: "improved",
        title: "AI matches transcript names to real teammates",
        detail:
          "Meeting → Tasks now pre-fills each task's assignee: Claude matches names as heard in the transcript (even misheard ones like “kadel”) to the real team roster, and shows what it heard so you can double-check. Every task in the draft is also fully editable now — description, subtasks, and a “Fix with AI” box for bigger corrections in your own words.",
        requestedBy: "Bart",
      },
      {
        type: "improved",
        title: "Security hardening under the hood",
        detail:
          "Tighter access checks on attachments and member lists, no more sensitive fields in API responses, a corrected audit trail for project changes, and safer production defaults.",
      },
    ],
  },
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
