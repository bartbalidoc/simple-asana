# Simple Asana - Complete Feature Test Checklist

## Pre-Test Setup
```bash
cd "/home/barthofstee555/vs code /simple asana"
npm run dev
# Navigate to http://localhost:3000
# Sign in with a test account from your ALLOWED_EMAIL_DOMAIN
```

---

## Test 1: Create Project
- [ ] Click "New Project" button
- [ ] Fill in project name: "Test Project for Feature Review"
- [ ] Fill in description: "Comprehensive test of all features"
- [ ] Click "Create Project"
- [ ] **Expected:** Project card appears with 0 tasks, 1 member, all columns (To Do, In Progress, In Review, Done)

---

## Test 2: Smart Discovery - Fast Path (Q1 Only, Skip Rest)
- [ ] Click "Smart Discovery" button
- [ ] **Step 1 (Required):** Answer "What is the user story or objective?"
  - Input: "As a team member, I need to onboard new clients efficiently so we can scale revenue"
- [ ] Click **Next →**
- [ ] **Step 2 (Optional):** Click **Skip** (do not answer)
- [ ] **Step 3 (Optional):** Click **Skip**
- [ ] **Step 4 (Optional):** Click **Skip**
- [ ] **Step 5 (Optional):** Click **Skip**
- [ ] Click **Create Task**
- [ ] **Expected:** Task appears in To Do column with auto-generated title and description, includes 5-8 subtasks

---

## Test 3: Smart Discovery - Full Context (Answer All Questions)
- [ ] Click "Smart Discovery"
- [ ] **Q1:** "Automate weekly sales pipeline report delivery to VP"
- [ ] Click Next
- [ ] **Q2:** "VP of Sales, Sales team leads, Finance analyst"
- [ ] Click Next
- [ ] **Q3:** "Report delivered by 8am Friday, includes pipeline value, opportunity count, sales stage breakdown, team member attribution"
- [ ] Click Next
- [ ] **Q4:** "Need CRM API access, depends on IT approval, timeline is 2 weeks"
- [ ] Click Next
- [ ] **Q5:** "Medium - 1-2 weeks effort"
- [ ] Click **Create Task**
- [ ] **Expected:** Task created with title synthesizing all 5 answers, description includes stakeholders + acceptance criteria + dependencies, 6-8 subtasks traceable to answers

---

## Test 4: Always-Editable Task Fields (No Edit Button)
- [ ] Click on the task from Test 2 or 3 to open detail panel
- [ ] **Expected:** All fields are input/textarea (NOT read-only text)
- [ ] Click on task title → edit it directly to: "Updated Task Title Test"
- [ ] Click on Description field → add text: " - Updated with additional context"
- [ ] Change Priority dropdown from "Medium" to "High"
- [ ] Click on Due Date → set to 7 days from today
- [ ] **Expected:** "Save Changes" and "Discard" buttons appear at bottom
- [ ] Click **Save Changes**
- [ ] **Expected:** Buttons disappear, task is updated (refresh page to verify persistence)

---

## Test 5: Subtask Management
- [ ] Open the task from Test 4
- [ ] **Subtasks section:**
  - [ ] Check one subtask checkbox → it should strike-through and turn gray
  - [ ] Uncheck it → it returns to normal
  - [ ] Hover over a subtask → **✕ delete button appears**
  - [ ] Click ✕ button → confirm dialog appears
  - [ ] Click OK → subtask disappears
- [ ] **Add new subtask:**
  - [ ] Type in "Add a subtask..." field: "Test new subtask"
  - [ ] Click Add button (or press Enter)
  - [ ] **Expected:** New subtask appears at bottom of list with checkbox and ✕ button

---

## Test 6: Status Dropdown (Always Available)
- [ ] With task detail panel open
- [ ] Find Status dropdown
- [ ] Change from "To Do" → "In Progress"
- [ ] **Expected:** Dropdown updates immediately, task card on board moves to "In Progress" column
- [ ] Change to "In Review" → verify board updates
- [ ] Change to "Done" → verify board updates and task card may show different styling

---

## Test 7: Delete Task
- [ ] With task open, look for **🗑️ Delete** button in top-right corner (next to close X)
- [ ] Click Delete button
- [ ] **Expected:** Confirmation dialog: "Are you sure you want to delete this task?"
- [ ] Click OK
- [ ] **Expected:** Panel closes, task disappears from board, confirm with page refresh

---

## Test 8: Comments with Author Display
- [ ] Open a task detail panel
- [ ] Scroll to Comments section
- [ ] Type a comment: "This task looks good, starting implementation today"
- [ ] Click "Post Comment"
- [ ] **Expected:** Comment appears immediately with:
  - Your name (author)
  - Timestamp ("X minutes ago")
  - Comment text
- [ ] Post a second comment to verify it appends
- [ ] Refresh page → **Expected:** Both comments persist

---

## Test 9: Attachments
- [ ] Open task detail panel, scroll to Attachments
- [ ] Click **📎 Upload File** button
- [ ] Select a test file (PDF, image, or document)
- [ ] **Expected (if Google Drive configured):** File uploads, appears in attachments list with name and size
- [ ] **Expected (if Google Drive NOT configured):** Friendly error message: "File uploads are not configured. Please contact your administrator."

---

## Test 10: Keyboard Accessibility
- [ ] On Kanban board, press **Tab** multiple times
- [ ] **Expected:** Task cards get focus ring (visible border)
- [ ] When focused on a task card, press **Enter**
- [ ] **Expected:** Task detail panel opens
- [ ] Press **Escape** → panel closes

---

## Test 11: Event Propagation (Upload File)
- [ ] Open task detail panel
- [ ] In Attachments section, click **📎 Upload File** label
- [ ] **Expected:** OS file picker opens (NOT Smart Discovery wizard)
- [ ] Cancel the picker

---

## Test 12: Long Title Validation
- [ ] Click "Quick Task" button
- [ ] Enter very long title (150+ characters):
  - "This is an extremely long task title that exceeds the maximum character limit and should trigger a validation error preventing the task from being created in the database"
- [ ] Click "Add"
- [ ] **Expected:** Error message: "Task title must be less than 255 characters"
- [ ] Clear field, enter valid title: "Short task title"
- [ ] Click Add → **Expected:** Task creates successfully

---

## Test 13: Empty/Whitespace Task Prevention
- [ ] Click "Quick Task"
- [ ] Enter only spaces: `     ` (5 spaces)
- [ ] Click Add
- [ ] **Expected:** Error message: "Task title is required"

---

## Test 14: Invalid Project URL Error
- [ ] Manually navigate to: `http://localhost:3000/projects/invalid-project-id-xyz123`
- [ ] **Expected:** Friendly error page with:
  - Heading: "Project not found"
  - Blue button: "← Back to Projects"
- [ ] Click button → returns to projects list

---

## Test 15: Board State Consistency
- [ ] Create 3 quick tasks in To Do column
- [ ] Drag Task 1 to "In Progress"
- [ ] Drag Task 2 to "In Review"
- [ ] Drag Task 3 to "Done"
- [ ] **Expected:** All tasks stay in their respective columns (no unexpected movement to Done)
- [ ] Refresh page
- [ ] **Expected:** All tasks remain in the columns you moved them to

---

## Test 16: Template Switching
- [ ] Open a task detail panel
- [ ] Find **Template** dropdown at top
- [ ] Currently selected: "general"
- [ ] Change to a different template (if available, e.g., "process_improvement")
- [ ] **Expected:** Template-specific fields appear/change (goal, problem, current workflow, etc.)
- [ ] Change back to "general"
- [ ] Make an edit (change title)
- [ ] Click Save → verify template persists

---

## Test 17: Context Box Shows Skipped Questions (Smart Discovery)
- [ ] Use Smart Discovery to create a task
- [ ] On Step 3 or later, look at "📝 You said earlier:" section
- [ ] For questions you skipped, look for **(Skipped)** in grey
- [ ] For answered questions, see the answer text
- [ ] **Expected:** Clear distinction between answered and skipped questions

---

## Quick Smoke Test (5 minutes)
1. ✅ Create project
2. ✅ Use Smart Discovery (skip 2-3 questions)
3. ✅ Edit task title directly (no Edit button)
4. ✅ Delete a subtask
5. ✅ Delete a task
6. ✅ Refresh page — everything persists

---

## Expected Result Summary

✅ **All tests pass** = MVP is production-ready for team deployment  
⚠️ **Minor issues** = Note them for iteration  
❌ **Blocking issues** = Report with steps to reproduce

---

## Browser Extension Testing Notes

**For Claude with browser extension:**
1. Start from http://localhost:3000 (assumes you're already signed in)
2. Each test is independent — you can skip around or reorder
3. Pay attention to console errors (F12 → Console tab) — report any red errors
4. Test on actual clicks and interactions, not just visual verification
5. If a test fails, note: what you did, what happened, what was expected
6. Take screenshots of any errors or unexpected behavior

---

## Copy-Paste Restart Commands

If dev server crashes:
```bash
pkill -f "node.*next"
cd "/home/barthofstee555/vs code /simple asana" && npm run dev
```

If you need to clear browser cache:
- DevTools → Application → Clear site data → Clear
- Then refresh page
