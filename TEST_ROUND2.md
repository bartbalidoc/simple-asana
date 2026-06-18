# Simple Asana — Round 2 Test (post-fix verification)

**Live URL:** http://206.189.200.138:3000
**Login:** email/password, must be an `@balidoc.com` email. Use `testuser@balidoc.com` / `TestPass123` (or register it if missing).

This test focuses on the **bugs just fixed** and the **new features just added**. Run it after the latest deploy. For each item, mark PASS / FAIL and note what you saw vs. expected. Watch the browser console (F12) for red errors.

---

## A. Regression — bugs that were just fixed (these MUST pass now)

### A1. Sign Out works (was: infinite redirect loop)
- [ ] Log in, then click **Sign Out** (top-right)
- [ ] **Expected:** clean redirect to the login page within ~1 second. No growing/looping URL, no frozen tab.

### A2. Login shows errors + redirects (was: silent reset)
- [ ] On login, enter `testuser@balidoc.com` with a **wrong** password → Sign In
- [ ] **Expected:** visible red error "Invalid email or password"; you stay on login.
- [ ] Enter the **correct** password → Sign In
- [ ] **Expected:** you are redirected to the dashboard automatically (no manual navigation).

### A3. Comment body is visible (was: only name/time showed)
- [ ] Open any task → Comments → post `Testing comment visibility`
- [ ] **Expected:** the comment shows the **body text**, your name, and a timestamp. Refresh → still shows the body.

### A4. Priority saves instantly + card badge color (was: stuck on MEDIUM/yellow)
- [ ] Open a task → change **Priority** to **High**
- [ ] **Expected:** no "Save Changes" needed; the board card's badge turns **red** and reads HIGH immediately.
- [ ] Change to **Low** → card badge turns **green**. Change to **Medium** → yellow.

### A5. File upload to Google Drive works (was: 503)
- [ ] Open a task → **📎 Upload File** → pick a small file
- [ ] **Expected:** it uploads, appears in the Attachments list with name + size, and the "(view all)" link points to Google Drive. No 503.

### A6. Apostrophe renders correctly in Smart Discovery
- [ ] Start Smart Discovery → go to the **acceptance criteria** step (Q3)
- [ ] **Expected:** the hint reads ...for this to be 'done'? with a real apostrophe — NOT `&apos;`.

---

## B. New features

### B1. Automation question in Smart Discovery (NEW)
- [ ] Click **Smart Discovery**
- [ ] Q1: `As a coordinator, I want client onboarding emails sent automatically so clients get consistent info`
- [ ] Click Next through to **Step 6** — confirm there are now **6 steps**
- [ ] **Expected:** Step 6 reads **"Could any part of this be automated?"** (Optional)
- [ ] Answer Q6: `Right now I copy-paste each welcome email by hand; it should auto-send when a client is added`
- [ ] Click **Create Task**
- [ ] **Expected:** task is created; its subtasks lean toward automation steps (e.g. "Identify trigger", "Connect systems", "Test automated run").

### B2. Automation Opportunity field is visible & editable (NEW)
- [ ] Open the task you just created from B1
- [ ] **Expected:** an **"⚡ Automation Opportunity"** field is present and pre-filled with a short note about automating the manual step.
- [ ] Edit it to add ` — target: zero manual steps` → click **Save Changes** → refresh → the edit persisted.

### B3. Subtask progress on board cards (NEW)
- [ ] Find a task that has subtasks (e.g. from B1) on the board
- [ ] **Expected:** the card shows a subtask count like **"✓ 0/7 subtasks"**.
- [ ] Open the task, check one subtask done, close the panel
- [ ] **Expected:** the card count updates (e.g. "✓ 1/7 subtasks").

### B4. Overdue due-date highlight (NEW)
- [ ] Open a task → set **Due Date** to **yesterday** → Save Changes
- [ ] **Expected:** on the board card, the due date shows in **red/bold** (because it's overdue and not Done).
- [ ] Move that task to **Done** (Status dropdown) → reopen board
- [ ] **Expected:** the due date is no longer red (Done tasks aren't "overdue").

### B5. Editable project name (NEW)
- [ ] At the top of a project board, click the **project name** (it's now an editable field)
- [ ] Change it to `Q3 Onboarding (renamed)` and click elsewhere (blur)
- [ ] Refresh the page
- [ ] **Expected:** the new name persisted.

---

## C. Quick golden-path sanity (end to end)
- [ ] Register/login → create a project → add `teammate@balidoc.com` as a member → Smart Discovery task (answer Q1 + Q6) → assign the task to the teammate → set priority High → add+complete a subtask → comment → upload a file → move to Done → refresh
- [ ] **Expected:** every step persists after refresh; no console errors; no full-page "Project not found" crashes.

---

## Report format
```
DATE: ____  TESTER: ____
A1 Sign Out:        PASS/FAIL  notes:
A2 Login errors:    PASS/FAIL
A3 Comment body:    PASS/FAIL
A4 Priority:        PASS/FAIL
A5 Drive upload:    PASS/FAIL
A6 Apostrophe:      PASS/FAIL
B1 Automation Q:    PASS/FAIL
B2 Automation field:PASS/FAIL
B3 Subtask progress:PASS/FAIL
B4 Overdue red:     PASS/FAIL
B5 Editable name:   PASS/FAIL
C  Golden path:     PASS/FAIL
BLOCKING ISSUES:
NEW FRICTION:
```

> Note: the full feature/edge/security suite lives in **TEST_SPECIFICATION.md**. This Round 2 doc is the fast verification of the latest changes.
