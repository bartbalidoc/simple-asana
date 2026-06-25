# Simple Asana — Complete Test Specification & Product Review

**Live staging URL:** http://206.189.200.138:3000
**Last updated:** 2026-06-18

This is the single source of truth for testing Simple Asana. Four parts:
1. **Setup & credentials**
2. **End-to-end user workflow** (the real-world story to validate)
3. **Detailed test cases** (functional, edge, stress, security)
4. **Product gap analysis** (missing features & recommendations — read even if all tests pass)

> ⚠️ This document supersedes the old checklist. The app now uses **email/password login** (not Google), runs at the **staging IP** (not localhost), has **always-editable** task fields (no Edit button), a **Smart Discovery** wizard (not a 6-step Polish wizard), and **member/assignment** features.

---

# PART 1 — Setup & Credentials

- App: http://206.189.200.138:3000 (HTTP only on staging — no HTTPS yet)
- Login: **email + password**. Google sign-in is intentionally disabled for the MVP.
- All accounts MUST use an **`@balidoc.com`** email.

**Test accounts** (created in Tests 1.1 / 1.3):
| Role | Name | Email | Password |
|------|------|-------|----------|
| Primary | Test User | `testuser@balidoc.com` | `TestPass123` |
| Secondary | Second Teammate | `teammate@balidoc.com` | `TeamPass123` |

**Reporting:** For each test record PASS / FAIL / PARTIAL, what you did, what happened, expected result, and a screenshot of any error. Watch the browser console (F12) and report red errors and failed network requests.

---

# PART 2 — End-to-End User Workflow (the story to validate)

Simple Asana is for a **Project & Automation Coordinator** at a healthcare org. The intended flow:

1. **Sign in** → create a project (e.g. "Q3 Client Onboarding").
2. **Add teammates** so work can be assigned.
3. **Capture work** two ways: *Quick Task* (simple to-dos) and *Smart Discovery* (Scrum-style questions → well-defined task with stakeholders, acceptance criteria, auto-generated subtasks).
4. **Organize & assign** — priority, due date, assignee; break into subtasks; move across the board (To Do → In Progress → In Review → Done).
5. **Collaborate** — comments, attachments, subtask completion tracking.
6. **Track progress** — what's overdue, what's assigned to whom, what's done.

> **Continuous question for the tester:** *"Could a real coordinator run their whole week with only these features?"* Log any friction in PART 4.

**Golden path (must pass end-to-end):**
Register → create project → add teammate → create task via Smart Discovery → assign to teammate → set priority/due date → add & complete a subtask → comment → move to Done → refresh → everything persists.

---

# PART 3 — Detailed Test Cases

## Section 1 — Authentication & Session
- [ ] **1.1 Register primary:** login page shows email+password (no Google). Register `Test User` / `testuser@balidoc.com` / `TestPass123` → auto-logged-in to dashboard.
- [ ] **1.2 Domain restriction:** register `someone@gmail.com` → error "Only @balidoc.com email addresses are allowed".
- [ ] **1.3 Register secondary:** `Second Teammate` / `teammate@balidoc.com` / `TeamPass123`.
- [ ] **1.4 Login + wrong password:** correct creds → dashboard; `testuser@balidoc.com` + `wrongpass` → "Invalid email or password", not logged in.
- [ ] **1.5 Duplicate registration:** re-register `testuser@balidoc.com` → "An account with this email already exists".
- [ ] **1.6 Short password:** register with a 5-char password → "Password must be at least 8 characters".
- [ ] **1.7 Session persistence:** refresh → still logged in; close tab + reopen → still logged in.
- [ ] **1.8 Logout:** sign out → redirected to login; protected pages require login.
- [ ] **1.9 Multi-tab:** log in on one tab → other tabs authenticated after refresh.

## Section 2 — Projects
- [ ] **2.1 Create:** name `Q3 Client Onboarding`, description set → card shows 0 tasks, 1 member; board has 4 columns in order (To Do, In Progress, In Review, Done).
- [ ] **2.2 Special chars / long name:** create a project with `é @ #` and a 100+ char name → persists, wraps gracefully.
- [ ] **2.3 Invalid URL:** visit `/projects/invalid-id-xyz` → "Project not found" page with working "← Back to Projects".
- [ ] **2.4 Multiple projects:** create 5 → all load from the Projects list without lag.

## Section 3 — Members & Assignment
- [ ] **3.1 Add member:** 👥 Members → add `teammate@balidoc.com` → appears in list, count "Members (2)".
- [ ] **3.2 Errors:** add `nobody@balidoc.com` → "User not found"; add `teammate@balidoc.com` again → "already a member".
- [ ] **3.3 Assign:** open a task → **Assigned To** lists Unassigned, Test User, Second Teammate → pick Second Teammate → saves instantly, card shows name, persists on reopen; set back to Unassigned → name clears.
- [ ] **3.4 Cross-user visibility:** log in as `teammate@balidoc.com` → can see the project they were added to and the task assigned to them.

## Section 4 — Task Creation
- [ ] **4.1 Quick Task happy path:** `Set up onboarding email template` → appears in To Do, no full-page error.
- [ ] **4.2 Validation (inline):** spaces-only → inline "Task title is required"; 256+ chars → inline "must be less than 255 characters". **Errors must show inline, NOT replace the page with "Project not found".**
- [ ] **4.3 Special chars:** create a task with emoji 🎯 and accents → persists correctly.
- [ ] **4.4 Smart Discovery fast path:** Q1 = a user story, skip Q2–Q5 → Create Task → AI title + description + 5–8 subtasks. *(If "AI service not configured", note it.)*
- [ ] **4.5 Smart Discovery full context:** answer all 5 → description synthesizes objective + stakeholders + acceptance criteria + dependencies; 6–8 traceable subtasks.
- [ ] **4.6 Skipped-question context:** answer Q1, skip Q2 → Step 3 "📝 You said earlier" shows Q1 text and Q2 "(Skipped)" in grey.
- [ ] **4.7 Escape & Cancel:** press **Escape** → wizard closes; reopen → Cancel button also closes it.
- [ ] **4.8 Rapid creation:** create 10 quick tasks quickly → all appear.

## Section 5 — Task Detail & Editing
- [ ] **5.1 Always-editable:** open a task → fields are editable inputs (no Edit button). Change title, description, Priority→High, set Due Date → "Save Changes"/"Discard" appear → Save → refresh → persisted.
- [ ] **5.2 Discard:** make changes → Discard → reverts.
- [ ] **5.3 Template switch:** change Template dropdown → template-specific fields appear/change (goal, problem, workflow, automation opportunity, etc.); save → persists.
- [ ] **5.4 Status moves card:** change Status To Do→In Progress→In Review→Done → card moves each time; refresh → stays.
- [ ] **5.5 Subtasks:** check one → strikethrough + progress count updates; hover → ✕ delete → confirm → removed; add `Draft welcome email copy` → appears with checkbox + ✕.
- [ ] **5.6 Comments:** post a comment → appears immediately with your name + timestamp; post a second → appends; refresh → both persist.
- [ ] **5.7 Attachments:** click 📎 Upload File → OS picker opens (NOT the wizard). Upload → **(Drive not configured):** friendly error; **(configured):** file listed with name/size.
- [ ] **5.8 Delete task:** 🗑️ Delete → confirm → removed; refresh → gone.

## Section 6 — Board & Accessibility
- [ ] **6.1 Board consistency:** create 3 tasks, move each to a different column → refresh → each stays (none jump to Done).
- [ ] **6.2 Drag & drop:** drag a card between columns → status updates, persists on refresh; drag to same column → no change.
- [ ] **6.3 Keyboard:** Tab through cards → visible focus ring → Enter opens task → Escape closes overlays.
- [ ] **6.4 Long content:** very long task title → truncates/wraps on the card, no layout break.

## Section 7 — Performance & Stress
- [ ] **7.1 Volume:** create 50 tasks in one project → board still renders/loads reasonably.
- [ ] **7.2 Many subtasks:** add 20 subtasks to one task → panel stays responsive; mark 10 done → progress correct; refresh → persists.
- [ ] **7.3 Many comments:** post 20 comments → list stays responsive, all persist.
- [ ] **7.4 Slow network:** DevTools → Slow 3G → create a task → clear loading state, eventual success.
- [ ] **7.5 Memory:** open/close the detail panel 10× → no slowdown or leak.

## Section 8 — Data Integrity & Security
- [ ] **8.1 Encryption in transit:** DevTools → Network → create task → GET response shows decrypted `title`/`description` (readable), and PHI is not exposed in plaintext logs.
- [ ] **8.2 Access control:** logged-out user hitting a project URL is redirected/blocked; a user only sees projects they're a member of.
- [ ] **8.3 Audit logging:** create/view/update task and post comment → confirm corresponding audit entries (admin view or server logs): TASK_CREATED, TASK_VIEWED, TASK_UPDATED, COMMENT_CREATED.
- [ ] **8.4 No plaintext PHI in DB:** task titles/descriptions are stored encrypted (verify if DB access available).

## Section 9 — Error Handling & Edge Cases
- [ ] **9.1 Invalid task/project ID via URL** → graceful error, not a crash.
- [ ] **9.2 Null due date** → displays "No due date", never "null".
- [ ] **9.3 Offline** (DevTools offline) → create/update shows a clear error and allows retry; recovers when back online.
- [ ] **9.4 Whitespace title on edit** → save blocked with error, title not wiped.

---

# PART 4 — Product Gap Analysis & Recommendations

Not bugs — capabilities missing when you walk the Part 2 workflow. Prioritized for a Project & Automation Coordinator. **Tester: append any friction you noticed.**

## 🔴 High priority — blocks the core value proposition

### G1. Smart Discovery never asks about automation (the product's whole point)
The role is *Automation* Coordinator and the schema **already has an unused `automationOpportunity` field**, yet the wizard never asks about it. Add a question such as:
> **"Could any part of this be automated? What's the manual step today, and what should it become?"**
Wire the answer into `automationOpportunity` and bias the AI toward automation-oriented subtasks (e.g. "Identify trigger event", "Connect systems via API/Zapier", "Build the automated step", "Test an automated run end-to-end", "Document the fallback"). Without this, the tool is a generic task board, not an automation tool.

### G2. Subtasks have no order, sequence, or dependencies
Subtasks render in creation order with no way to express "do A before B." For onboarding/automation work, order is the whole point. Recommend:
- **Manual drag-to-reorder** (add an `order` field to subtasks)
- Have Smart Discovery **emit subtasks in logical execution order and number them** (1, 2, 3…)
- Stretch: "blocked by" links between subtasks; a subtask can't be marked done if a predecessor isn't.

### G3. No recurring tasks
"Weekly pipeline report", "monthly onboarding audit" are recurring — but must be recreated by hand each time. Add a "Repeats: none / daily / weekly / monthly" option that auto-creates the next instance.

### G4. No password reset / account recovery
A forgotten password = locked out, with no recovery. For a 14-person team this will happen fast. Add an admin "reset password" action and/or email-based reset.

## 🟡 Medium priority — significant workflow friction

### G5. No "My Tasks" / due-date awareness
A coordinator needs "what's assigned to me" and "what's overdue/this week" across projects. Due dates exist on tasks but nothing surfaces them. Verify the dashboard does this; if not, build an Overdue / Today / Upcoming view.

### G6. Subtasks can't be assigned or dated
Only parent tasks have assignee/due date, but real delegation happens at the subtask level. Add assignee + due date per subtask.

### G7. No board filtering or search
With many tasks there's no filter (by assignee/priority) or text search. Add a simple filter bar + search.

### G8. Members can only be added, not removed; no per-project roles
The panel only adds. Add a remove (✕) action and basic roles (viewer vs editor).

### G9. No notifications/reminders
Nothing tells an assignee they got a task or that a due date is near. Add in-app "assigned to you" indicators; email reminders for due dates would be ideal (esp. healthcare deadlines).

## 🟢 Lower priority — polish

- **G10.** Labels/tags beyond the template field.
- **G11.** @mentions in comments to notify a teammate.
- **G12.** Drag-to-reorder tasks *within* a column (currently only across columns).
- **G13.** Audit log exists in the data model — confirm there's an admin viewer; if not, expose one (HIPAA value).
- **G14.** 30-min session timeout has no warning dialog — users can lose unsaved edits silently. Add a 5-min warning.
- **G15.** No bulk actions (multi-select tasks to move/assign/delete).

## Intentional MVP gaps (not action items yet)
- Google sign-in disabled (email/password only)
- HTTP only on staging — **HTTPS + a real domain are required before any real PHI is entered** (HIPAA)
- Google Drive uploads need service-account config
- Smart Discovery requires an OpenAI key

---

# Result Summary Template

```
ENVIRONMENT: http://206.189.200.138:3000     DATE: __________
TESTER: __________

PART 3 RESULTS (pass/total)
1 Auth & Session:     __/9
2 Projects:           __/4
3 Members & Assign:   __/4
4 Task Creation:      __/8
5 Detail & Editing:   __/8
6 Board & a11y:       __/4
7 Performance/Stress: __/5
8 Data/Security:      __/4
9 Edge Cases:         __/4

GOLDEN PATH (Part 2): ✅ / ❌  ____________________
BLOCKING BUGS: ___________________________________
NEW FRICTION / GAPS (add to Part 4): _____________
VERDICT:  ✅ MVP-ready   ⚠️ Minor issues   ❌ Blocked
```
