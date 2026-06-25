Here's a comprehensive audit of the current state and a full list of improvements to implement. I'll organize it so you can paste this directly to Claude in VS Code.

Full Audit & Improvement Spec — Simple Asana

🔍 What I Found (Current State)
Smart Task Discovery — 5 steps:

User story / objective (Required)
Key stakeholders (Optional / skippable)
Acceptance criteria (Optional / skippable)
Blockers / delays (Optional / skippable)
Task complexity (Optional / skippable) → "Create Task"

Task card (board): Shows title + priority badge (MEDIUM). Nothing else visible on the card itself.
Task detail panel (right slide-in): Template selector, Description (AI-generated), Assigned To, Status, Priority, Due Date, Subtasks (AI-generated list), Attachments (Google Drive), Comments.

❌ What's Missing or Wrong
Smart Task Discovery — Missing Fields
The wizard only covers 5 steps. Per your spec, the following are entirely absent:

Task/project name (explicit title input — currently AI-infers it, which is hit or miss)
Responsible person (Owner/Assignee — not asked during discovery)
Goal of the task (partially covered by user story, but not clearly separated)
Expected output (no dedicated field)
Deadline or frequency (no date field in wizard)
Quality requirements (not asked)
Required input or information (not asked)
People involved (stakeholders step exists but is vague and skippable)
Current status (not settable during creation)
Next steps (not captured)
Blockers or risks (step 4 exists but is skippable and vague)
Documentation location (not asked)
Possible automation opportunities (not asked)
Possible long-term value for BaliDoc (not asked)

Task Detail Panel — Missing Fields
All of the above are also absent from the task detail/edit panel. The current fields are: Description (blob), Assigned To, Status, Priority, Due Date, Subtasks, Attachments, Comments. There's no structured place for goal, expected output, quality requirements, next steps, documentation link, automation notes, or long-term value.
Task Board (Kanban) — Issues

Cards show only a title and a priority badge — no owner avatar, no due date, no subtask progress, no assignee name visible at a glance
No drag-and-drop between columns
No drag-and-drop for subtasks (you asked for this specifically)
Columns have no task count
No "Add task" shortcut directly in a column (you have to click the header buttons)
Empty columns are just blank white boxes — no empty state / call-to-action

UX / Language Issues

"Step 1 of 5" is too technical/sterile — no visual indication of what's coming
The "You said earlier:" recap panel is a good idea but visually cramped
"What is the user story or objective?" — too Scrum-jargon-y for non-tech users
"What are the acceptance criteria?" — very tech-oriented language
"How complex is this task?" with a free-text answer is vague (should be a selector)
No task title field — the AI auto-generates the title but users can't edit it until after creation
The progress bar (top right) is too thin and barely noticeable
"Cancel" button sits dangerously close to "Next →" and "Create Task" — easy to accidentally cancel
The "General Task / Automation Brief / Documentation / Process Improvement / Project Coordination" template dropdown in the detail panel is hidden/obscure — users don't know it exists
Subtask list has no drag-and-drop handles — reordering is impossible
Subtasks have no assignee, no due date, no status of their own
No keyboard shortcuts (Enter to go next, etc.)
"Smart Discovery" button stays highlighted/active even when not in wizard mode — confusing
No save indicator — users don't know if changes are auto-saved
The task title in the detail panel is truncated ("Track website redesign pro…") with no way to see/edit the full title
No way to add a task directly to a specific column
"MEDIUM" badge uses an ugly yellow/olive color
No sprint/iteration concept even loosely present


✅ Full Improvement Spec for Claude in VS Code
1. Smart Task Discovery — Redesign
Replace the 5 wizard steps with 8 friendlier, scrum-lite steps:
StepNew Label (plain language)Field NameRequired?1"What are we working on?"title + goalRequired2"Who owns this and who's involved?"owner (dropdown from members) + people_involved (multi-select or free text)Required3"What does 'done' look like?"expected_output + quality_requirementsOptional4"When does it need to happen?"deadline (date picker) + frequency (toggle: one-time / recurring)Optional5"What do we need to get started?"required_inputOptional6"What could slow us down?"blockers_risksOptional7"Where do we document this?"documentation_location (URL or text)Optional8"Could this be automated or grow into something bigger?"automation_opportunities + long_term_valueOptional

Each step should show a friendly icon, a plain-language label, and a short hint below (no Scrum jargon)
Step 1 "user story" format should be optional/suggested, not the default prompt
The progress bar should be thicker, show step dots/numbers, and label the current step
"Skip" should read "Skip for now →" for clarity
Add keyboard support: Enter → Next, Esc → Cancel with confirmation
The "You said earlier" recap should be a collapsible sidebar, not a cramped panel at the bottom

2. Task Detail Panel — Redesign
Replace the current single Description blob with structured sections using tabs or an accordion:
Section 1 — Overview

Title (editable, full-width, large)
Goal (what this is for)
Expected output (what done looks like)
Owner (dropdown)
People involved (multi-tag)
Status (current Kanban column — auto-synced)
Priority (Low / Medium / High — pill selector, not dropdown)
Deadline / Frequency
Size/Complexity (XS / S / M / L / XL — pill selector)

Section 2 — Requirements

Quality requirements
Required input or information

Section 3 — Progress

Current status (free text note, e.g. "waiting for design files")
Next steps (ordered list)
Subtasks (with drag-and-drop reorder, each subtask has: title, assignee, due date, status checkbox)

Section 4 — Risks & Blockers

Blockers or risks (free text or list)

Section 5 — Documentation & Future

Documentation location (clickable URL field)
Automation opportunities
Long-term value for BaliDoc

Section 6 — Activity

Attachments (keep as-is, Google Drive link)
Comments (keep as-is)

3. Kanban Board — Redesign
Task cards should show:

Title (2 lines max, truncated)
Owner avatar + name (small, bottom left)
Due date (with red color if overdue)
Priority badge (better colors: Low=green, Medium=blue, High=red — not yellow/olive)
Subtask progress bar (e.g. "3/7 done")
A subtle drag handle (⠿) on hover

Board improvements:

Full drag-and-drop between columns (update status automatically)
Subtask drag-and-drop within the detail panel
Column headers show task count (e.g. "To Do (3)")
Each column has a "+ Add task" button at the bottom
Empty columns show a friendly empty state: "Nothing here yet — drag a task here or click + to add one"
Add a "Backlog" column before "To Do" (optional, togglable)

4. General UX / Navigation

Auto-save indicator: Small "Saved ✓" or spinning indicator in the detail panel header
Full title visible: Don't truncate the task title in the panel header — make it a large editable <h2> input
"Smart Discovery" button: Should deactivate visually when the wizard is closed
Quick Task button: Should open a minimal inline form (title + owner + due date only) — not the full wizard
Session persistence: Currently clicking the close (×) button appears to log out — fix this bug (closing the task panel should NOT navigate away or log out)
Keyboard shortcuts: N = new task, E = edit, D = toggle done, Esc = close panel
Search/filter bar on the board: filter by owner, priority, due date
Board vs. List view toggle: A simple list/table view is easier to audit for a PM
Sidebar navigation: "Projects" is just a link — it should expand to show sub-items. "Dashboard" should show an overview of all tasks across projects
Project name ("12334") should be editable inline — that's clearly a placeholder/ID, not a real name


🎨 Visual / Style Issues

The "MEDIUM" badge uses an olive/yellow color that looks unfinished — define a clean color system
The task detail panel is too narrow (fixed right-side drawer) — it should be wider or expandable, since it now needs to show many more fields
The Smart Discovery wizard card has too much whitespace — the progress bar, question, and recap should all be more compact and visually engaging
Typography: section labels in the detail panel are too similar in weight to content — use clearer hierarchy (smaller caps labels vs. larger content text)
Add subtle section dividers in the detail panel so it doesn't feel like one long form
The "Delete" link in the panel header is red and prominent — make it a small icon (🗑) that only turns red on hover, or move it to a "..." menu to prevent accidents
Mobile: the current layout is not responsive — the Kanban board overflows on smaller screens


🐛 Bug
Critical bug found: Clicking the × (close) button on the task detail panel appears to trigger a full sign-out / session reset. The task also disappeared from the board after closing the panel. This needs to be investigated — the close button may be navigating to a route that clears auth state, or the task wasn't being persisted properly before panel close.

This gives you a complete picture of everything to rebuild. When you take this to Claude in VS Code, I'd suggest tackling it in this order: (1) fix the session/close bug, (2) redesign the task detail panel with structured fields, (3) redesign the Smart Discovery wizard steps, (4) improve the Kanban cards with drag-and-drop, (5) clean up visual styling. Let me know when you're ready to iterate!