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
    version: "1.10",
    date: "2026-07-09",
    title: "Archive finished tasks to Drive + see what's inside subtasks",
    items: [
      {
        type: "new",
        title: "Summarize & archive done tasks to Google Drive",
        detail:
          "Open any task that's marked Done and you'll see a green banner with “Summarize & archive”. One click and Claude writes a short summary, a Google Doc with the complete record (description, subtasks, every comment) is created in Drive under Task Archive → your project, and the task's files move into that same folder. The task stays in BaliDoc marked “Archived to Drive”, so we can clean old tasks out of the app later while keeping a tidy, searchable archive of everything we did.",
        requestedBy: "Bart",
      },
      {
        type: "improved",
        title: "Subtasks show what's inside them",
        detail:
          "Subtask rows now show small comment and file counters, so you can see at a glance which subtasks hold a discussion or documents — no more opening each one to check.",
        requestedBy: "Bart",
      },
    ],
  },
  {
    version: "1.9",
    date: "2026-07-09",
    title: "A calmer, cleaner BaliDoc — design polish everywhere",
    items: [
      {
        type: "improved",
        title: "Tasks you must act on stand out; everything else got quieter",
        detail:
          "Dashboard tasks are now compact rows grouped in neat lists, so twice as much fits on screen. The yellow “MEDIUM” badge is gone from every card — Medium is the normal setting, so only High (red) and Low (grey) show a label. Overdue groups are marked in red. On boards, finished cards show a green check instead of strike-through text, and each teammate's avatar now has their own colour.",
        requestedBy: "Bart",
      },
      {
        type: "improved",
        title: "The task panel puts the important fields first",
        detail:
          "Status, Priority, Due date and Assigned to now sit at the top of the task panel in a tidy grid — no more scrolling past Template to change a status. Rarely-used settings (Template, Automation opportunity, Guests) tuck behind “More settings”, and the Delete button moved to the bottom of the panel so it can't be hit by accident next to Close.",
        requestedBy: "Bart",
      },
      {
        type: "improved",
        title: "One consistent look for icons, menus and buttons",
        detail:
          "All the little symbols (bell, paperclip, sparkles, search…) are now crisp icons that match on every device instead of emoji that look different per phone. Dropdown menus share one style across the app, deleting anything now asks in a proper BaliDoc-styled dialog instead of a browser popup, and keyboard users get a visible red focus ring everywhere.",
        requestedBy: "Bart",
      },
    ],
  },
  {
    version: "1.8",
    date: "2026-07-08",
    title: "Notification cleanup + a tidier comment box",
    items: [
      {
        type: "new",
        title: "Clean up your notifications in one click",
        detail:
          "Every notification in the 🔔 bell now has a ✕ to dismiss it, and there's a “Clear all” at the top to empty the whole list at once — no more clicking them away one by one. “Mark all read” is still there too.",
        requestedBy: "Bart",
      },
      {
        type: "improved",
        title: "A cleaner, tidier comment box",
        detail:
          "The comment box is now one neat unit: 📎 Attach and ✨ Proofread sit in a proper toolbar under your text, next to the Post button — instead of floating around as faint grey words. The AI suggestion preview matches, and a few clashing colors (stray blue accents on our red theme, like the Upload File button) were cleaned up across the task panel.",
        requestedBy: "Bart",
      },
    ],
  },
  {
    version: "1.7",
    date: "2026-07-08",
    title: "Your old Asana content is back",
    items: [
      {
        type: "fixed",
        title: "Recovered task descriptions from the Asana migration",
        detail:
          "When we moved off Asana, task titles came across but the descriptions inside them didn't. We pulled the original text back from Asana and restored 346 task descriptions across every board — matched exactly to the right task, and only filling ones that were empty, so nothing you'd since written was touched.",
        requestedBy: "Sidney",
      },
      {
        type: "fixed",
        title: "Recovered missing comments too",
        detail:
          "185 human comments that only existed in the old Asana are back on the boards, each with its original author and date, so they sit in their correct place in the conversation. Duplicates and Asana's automated reminder messages were left out.",
        requestedBy: "Sidney",
      },
    ],
  },
  {
    version: "1.6",
    date: "2026-07-08",
    title: "Proofread comments with AI",
    items: [
      {
        type: "new",
        title: "✨ Proofread button on comments",
        detail:
          "Writing a comment and want it to read cleanly? Click ✨ Proofread in the comment box and Claude fixes the spelling and grammar while keeping your meaning, tone, @mentions and links exactly as you wrote them. You see the suggestion first and choose “Use this” or “Keep mine” — nothing is changed until you accept.",
        requestedBy: "Bart",
      },
    ],
  },
  {
    version: "1.5",
    date: "2026-07-08",
    title: "Feedback round 3 — bugs squashed, comments upgraded, Welcome Hub",
    items: [
      {
        type: "fixed",
        title: "Dragging a card to Done now really completes it",
        detail:
          "Moving a card between board columns updates the task's real status too — no more opening the task to set the dropdown by hand. Works for every column, including the new Blocked one.",
        requestedBy: "Sidney",
      },
      {
        type: "fixed",
        title: "Comments stay in the right order",
        detail:
          "Comment threads could show newer comments above older ones (especially after edits). They're now always oldest-to-newest.",
        requestedBy: "Sidney",
      },
      {
        type: "new",
        title: "React to comments and attach files to them",
        detail:
          "Every comment now has emoji reactions (👍 ❤️ 😂 🎉 👀 ✅) via the 🙂+ button, and the comment box has a 📎 Attach file option — images show as previews right inside the comment.",
        requestedBy: "Gabriel",
      },
      {
        type: "new",
        title: "Blocked column on every board",
        detail:
          "Each board gets a red “Blocked” column between In Progress and In Review — drag a stuck task there so blockers are visible at a glance. Blocked is also a status in the task panel and dashboard filters.",
        requestedBy: "Gabriel",
      },
      {
        type: "new",
        title: "Welcome Hub for new team members",
        detail:
          "A friendly onboarding page (sidebar → Welcome Hub) with modules for the Tech Stack Map, Compliance & Privacy, the Doctor's Clinical Guide, and the BSO Execution Guide. Admins click ✏️ on a card to set where it links.",
        requestedBy: "Sidney",
      },
      {
        type: "new",
        title: "Rebuild any task with AI",
        detail:
          "Old or messy tasks (hello, Asana imports) can be restructured in one click: open a task → “✨ Rebuild” under the description. You get a preview of the cleaned-up title, description and suggested subtasks, and nothing changes until you apply it. “Smart Discovery” is also renamed to what it is: AI Task Creator.",
        requestedBy: "Bart",
      },
      {
        type: "improved",
        title: "Filter your notifications",
        detail:
          "The 🔔 bell now has filter chips — All, Mentions, Assigned, Comments, Status — so you can find the notification you're looking for.",
        requestedBy: "Bart",
      },
    ],
  },
  {
    version: "1.4",
    date: "2026-07-06",
    title: "My Day planner + stay logged in all day",
    items: [
      {
        type: "new",
        title: "My Day — your private daily planner",
        detail:
          "New “My Day” page in the sidebar: plan your day in four areas — up to 3 Priorities (linkable to real board tasks), To-Dos, Calls/Emails, and an autosaving Notes scratchpad. It's completely private to you. Overnight, finished items are archived and unfinished ones follow you to the next day (marked “↻ carried over”, dismissible if no longer relevant). The suggested XP/levels and weekly AI review are on the backlog for a later release.",
        requestedBy: "Sidney",
      },
      {
        type: "improved",
        title: "Log in once per day, not every 30 minutes",
        detail:
          "Sessions now last 12 hours, so one morning login covers your shift. Idle tabs still sign out automatically after 2 hours of no activity (with the usual warning first).",
        requestedBy: "Fafa",
      },
    ],
  },
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
