# Simple Asana - Complete Feature Test Checklist

**Live staging URL:** http://206.189.200.138:3000

This checklist is written so a browser-automation assistant (or a human) can run it end-to-end. Every test has explicit steps and an expected result. Start from the top — Test 1 creates the account you'll use for everything else.

---

## Test 1: Register a New Account (Email + Password)
- [ ] Go to http://206.189.200.138:3000
- [ ] You should be redirected to the login page showing **email + password** fields (NOT a Google button)
- [ ] Click the **Register** link (under the Sign In button)
- [ ] Fill in:
  - **Full Name:** `Test User`
  - **Email:** `testuser@balidoc.com` (must end in `@balidoc.com`)
  - **Password:** `TestPass123` (at least 8 characters)
- [ ] Click **Create Account**
- [ ] **Expected:** Account is created and you are logged in automatically, landing on the dashboard
- [ ] **If you see "Only @balidoc.com email addresses are allowed":** the email didn't end in `@balidoc.com` — fix and retry

---

## Test 2: Log Out and Log Back In
- [ ] Find and click the **Sign Out** / **Logout** option (sidebar or menu)
- [ ] **Expected:** Returns to login page
- [ ] Enter the same credentials:
  - **Email:** `testuser@balidoc.com`
  - **Password:** `TestPass123`
- [ ] Click **Sign In**
- [ ] **Expected:** Logged in, back on the dashboard
- [ ] **Also test a wrong password:** log out, try `testuser@balidoc.com` with password `wrongpass`
  - **Expected:** Error message "Invalid email or password" — does NOT log in

---

## Test 3: Register a Second User (for assignment testing later)
- [ ] Log out
- [ ] Click **Register**
- [ ] Fill in:
  - **Full Name:** `Second Teammate`
  - **Email:** `teammate@balidoc.com`
  - **Password:** `TeamPass123`
- [ ] Click **Create Account**
- [ ] **Expected:** Logged in as the second user
- [ ] Log out and log back in as `testuser@balidoc.com` / `TestPass123` for the remaining tests

---

## Test 4: Create a Project
- [ ] Click "New Project" button
- [ ] Fill in project name: `Test Project for Feature Review`
- [ ] Fill in description: `Comprehensive test of all features`
- [ ] Click "Create Project"
- [ ] **Expected:** Project card appears with 0 tasks, 1 member, all columns (To Do, In Progress, In Review, Done)
- [ ] Click into the project → board loads with all 4 columns

---

## Test 5: Smart Discovery - Fast Path (Q1 Only, Skip Rest)
- [ ] Click "Smart Discovery" button
- [ ] **Step 1 (Required):** Answer "What is the user story or objective?"
  - Input: `As a team member, I need to onboard new clients efficiently so we can scale revenue`
- [ ] Click **Next →**
- [ ] **Step 2 (Optional):** Click **Skip**
- [ ] **Step 3 (Optional):** Click **Skip**
- [ ] **Step 4 (Optional):** Click **Skip**
- [ ] **Step 5 (Optional):** Click **Skip**
- [ ] Click **Create Task**
- [ ] **Expected:** Task appears in To Do column with auto-generated title and description, includes 5-8 subtasks
- [ ] **Note:** If the AI key (OPENAI_API_KEY) is not configured, this may error — note it if so

---

## Test 6: Smart Discovery - Full Context (Answer All Questions)
- [ ] Click "Smart Discovery"
- [ ] **Q1:** `Automate weekly sales pipeline report delivery to VP`
- [ ] Click Next
- [ ] **Q2:** `VP of Sales, Sales team leads, Finance analyst`
- [ ] Click Next
- [ ] **Q3:** `Report delivered by 8am Friday, includes pipeline value, opportunity count, sales stage breakdown`
- [ ] Click Next
- [ ] **Q4:** `Need CRM API access, depends on IT approval, timeline is 2 weeks`
- [ ] Click Next
- [ ] **Q5:** `Medium - 1-2 weeks effort`
- [ ] Click **Create Task**
- [ ] **Expected:** Task created with title synthesizing all answers, description includes stakeholders + acceptance criteria + dependencies, 6-8 subtasks

---

## Test 7: Context Box Shows Skipped Questions
- [ ] Start Smart Discovery again
- [ ] Answer Q1, then Skip Q2
- [ ] On Step 3, look at the "📝 You said earlier:" section
- [ ] **Expected:** Q1 shows your answer text; Q2 shows **(Skipped)** in grey italic
- [ ] Click Cancel to close (or press Escape)

---

## Test 8: Add Members to the Project
- [ ] On the project page, click the **👥 Members** button (top right)
- [ ] **Expected:** A panel opens listing current members (just you)
- [ ] In the email field, enter: `teammate@balidoc.com` (the second user from Test 3)
- [ ] Click **Add Member**
- [ ] **Expected:** `Second Teammate` appears in the members list; button count updates to "Members (2)"
- [ ] **Test error case:** try adding `nobody@balidoc.com` (not registered)
  - **Expected:** Error "User not found"

---

## Test 9: Assign a Task to a Person
- [ ] Click any task to open the detail panel
- [ ] Find the **Assigned To** dropdown
- [ ] **Expected:** Dropdown lists "Unassigned", `Test User`, and `Second Teammate`
- [ ] Select `Second Teammate`
- [ ] **Expected:** Saves immediately; the task card on the board shows the assignee name
- [ ] Reopen the task → **Expected:** "Assigned To" still shows `Second Teammate`
- [ ] Change it back to "Unassigned" → card no longer shows a name

---

## Test 10: Always-Editable Task Fields (No Edit Button)
- [ ] Click a task to open the detail panel
- [ ] **Expected:** All fields are editable inputs/textareas (NOT read-only text), no "Edit" button needed
- [ ] Edit the task title directly to: `Updated Task Title Test`
- [ ] Add to the Description: ` - Updated with additional context`
- [ ] Change Priority dropdown to "High"
- [ ] Set Due Date to 7 days from today
- [ ] **Expected:** "Save Changes" and "Discard" buttons appear at the bottom
- [ ] Click **Save Changes**
- [ ] **Expected:** Buttons disappear; refresh page → changes persisted

---

## Test 11: Subtask Management
- [ ] Open a task that has subtasks
- [ ] Check a subtask's checkbox → **Expected:** strike-through + grey, progress count updates
- [ ] Uncheck it → returns to normal
- [ ] Hover over a subtask → **Expected:** an **✕** delete button appears
- [ ] Click ✕ → confirm dialog → OK → **Expected:** subtask disappears
- [ ] In "Add a subtask..." field type `Test new subtask` → click Add (or Enter)
- [ ] **Expected:** New subtask appears with checkbox and ✕ button

---

## Test 12: Status Changes
- [ ] With a task panel open, find the **Status** dropdown
- [ ] Change "To Do" → "In Progress"
- [ ] **Expected:** Saves immediately; task card moves to the "In Progress" column
- [ ] Change to "In Review" → board updates
- [ ] Change to "Done" → board updates

---

## Test 13: Comments with Author Display
- [ ] Open a task, scroll to Comments
- [ ] Type: `This task looks good, starting today`
- [ ] Click "Post Comment"
- [ ] **Expected:** Comment appears immediately with your name (`Test User`), a timestamp ("X minutes ago"), and the text
- [ ] Post a second comment → appends below
- [ ] Refresh page → **Expected:** both comments persist

---

## Test 14: Delete a Task
- [ ] Open a task, find the **🗑️ Delete** button (top-right, next to the X)
- [ ] Click it → confirm dialog "Are you sure you want to delete this task?"
- [ ] Click OK
- [ ] **Expected:** Panel closes, task removed from board; refresh → still gone

---

## Test 15: Quick Task + Validation
- [ ] Click "Quick Task"
- [ ] Enter only spaces `     ` → click Add → **Expected:** "Task title is required"
- [ ] Enter a 150+ character title (paste this):
  `This is an extremely long task title that exceeds the maximum character limit and should trigger a validation error preventing the task from being created in the database`
  → click Add → **Expected:** "Task title must be less than 255 characters"
- [ ] Enter `Short valid task` → click Add → **Expected:** task created in To Do

---

## Test 16: Attachments
- [ ] Open a task, scroll to Attachments, click **📎 Upload File**
- [ ] **Expected:** OS file picker opens (NOT the Smart Discovery wizard)
- [ ] Select a file and try to upload
- [ ] **Expected (Google Drive not configured):** friendly error "File uploads are not configured. Please contact your administrator."
- [ ] **Expected (configured):** file appears in the attachment list

---

## Test 17: Keyboard Accessibility
- [ ] On the board, press **Tab** repeatedly → **Expected:** task cards get a visible focus ring
- [ ] With a card focused, press **Enter** → **Expected:** task detail panel opens
- [ ] Press **Escape** in Smart Discovery → wizard closes

---

## Test 18: Invalid Project URL
- [ ] Navigate to http://206.189.200.138:3000/projects/invalid-id-xyz123
- [ ] **Expected:** Friendly "Project not found" page with a blue "← Back to Projects" button
- [ ] Click button → returns to projects list

---

## Test 19: Session Persistence
- [ ] While logged in, refresh the page → **Expected:** still logged in
- [ ] Close the tab and reopen http://206.189.200.138:3000 → **Expected:** still logged in (session valid for 30 min)

---

## Quick Smoke Test (5 minutes)
1. ✅ Register a new account (`@balidoc.com`)
2. ✅ Create a project
3. ✅ Create a task with Smart Discovery
4. ✅ Add a second member and assign them a task
5. ✅ Edit a task, delete a subtask, delete a task
6. ✅ Refresh — everything persists

---

## Result Summary

✅ **All tests pass** = MVP ready for the team
⚠️ **Minor issues** = note them for iteration
❌ **Blocking issues** = report with steps to reproduce

---

## Notes for the Browser Extension Tester

1. **Start fresh:** the very first action is registering an account (Test 1). Use `testuser@balidoc.com` / `TestPass123`.
2. **Email domain:** all accounts MUST use an `@balidoc.com` email or registration is rejected.
3. **Watch the browser console** (F12 → Console) — report any red errors.
4. **Test real interactions** (clicks, typing, dropdowns), not just visual checks.
5. **On failure**, record: what you did, what happened, what was expected, and a screenshot.
6. **Known gaps to expect (not bugs):**
   - Google sign-in is intentionally disabled for this MVP (email/password only)
   - File uploads need Google Drive config — a friendly error is the expected result if unconfigured
   - Smart Discovery AI needs an OpenAI key — note if it errors
