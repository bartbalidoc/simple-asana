# Simple Asana — Comprehensive Test Specification

## Test Scope
Full end-to-end functional testing, UX flow testing, stress testing, and edge case handling for Simple Asana MVP.

---

## 1. AUTHENTICATION & SESSION MANAGEMENT

### 1.1 Login Flow
- [ ] Navigate to `http://localhost:3000`
- [ ] Verify redirect to `/login` page
- [ ] Click "Sign in with Google"
- [ ] Complete OAuth flow with test Google account (balidoc.com domain)
- [ ] Verify user lands on Dashboard after login
- [ ] Verify user info (name, email) displays correctly in UI
- [ ] Check that non-balidoc.com accounts are rejected with clear error

### 1.2 Session Management
- [ ] After login, verify JWT token in localStorage/cookies
- [ ] Navigate away and back — session should persist
- [ ] Hard refresh page — user should remain logged in
- [ ] Test logout flow (if available) — should clear session and redirect to login
- [ ] Open DevTools → Network → verify auth headers on API requests
- [ ] **Stress test**: Open app in 3 tabs simultaneously, log in one, verify all tabs are authenticated

### 1.3 Session Timeout (30-min timeout requirement)
- [ ] After login, check if there's any visible countdown or warning
- [ ] **Note**: Manual testing for actual 30-min timeout (not automated in browser extension)

---

## 2. PROJECT MANAGEMENT

### 2.1 Project List & Navigation
- [ ] Dashboard displays all projects
- [ ] Each project card shows: name, task count, member count
- [ ] Click project → navigate to Kanban board
- [ ] Back button returns to dashboard
- [ ] **Stress test**: Create 5 projects, verify all load without lag

### 2.2 Project Creation
- [ ] Click "Create Project" (if button exists)
- [ ] Enter project name, verify it's required
- [ ] Create project with special characters (é, @, #, etc.) — verify they persist
- [ ] Create project with very long name (100+ chars) — verify truncation/wrapping works
- [ ] Verify new project appears immediately in list
- [ ] Refresh page — project persists

### 2.3 Project Settings & Deletion
- [ ] Open project settings (if available)
- [ ] Edit project name, verify changes save
- [ ] **Critical if available**: Delete project, verify confirmation dialog, verify it disappears
- [ ] Verify deleted project's tasks are also removed

---

## 3. KANBAN BOARD FUNCTIONALITY

### 3.1 Board Layout & Columns
- [ ] Verify 4 columns exist: "To Do", "In Progress", "In Review", "Done"
- [ ] Columns are in correct order
- [ ] Each column displays task count
- [ ] Scroll horizontally if columns overflow — verify smooth scrolling
- [ ] **Stress test**: Create tasks until columns overflow, verify horizontal scroll works

### 3.2 Task Visibility & Filtering
- [ ] All tasks in project appear in correct column
- [ ] Task count in column matches actual task cards
- [ ] Tasks without explicit status default to "To Do"
- [ ] Verify no tasks appear in multiple columns (data integrity)
- [ ] **Stress test**: Create 50 tasks, verify all load without performance degradation

### 3.3 Task Card Display
- [ ] Each task card shows: title, priority badge, assignee name (if assigned), due date (if set)
- [ ] Task title truncates gracefully if too long (ellipsis or wrapping)
- [ ] Priority badge colors are distinct (LOW=green, MEDIUM=yellow, HIGH=red or similar)
- [ ] Hovering over task card shows tooltip or highlight
- [ ] Click task card → detail panel opens on right side
- [ ] Subtask count appears on card if subtasks exist (e.g., "3 subtasks, 1 done")

### 3.4 Drag & Drop
- [ ] **CRITICAL**: Drag task from "To Do" to "In Progress"
- [ ] Card moves smoothly, no lag or visual glitches
- [ ] After drop, status in DB updates (verify via GET /api/projects/:id)
- [ ] Refresh page — card stays in new column
- [ ] Drag task back to original column — works correctly
- [ ] **Stress test**: Drag 20 tasks rapidly between columns, verify no data loss

### 3.5 Column Interaction
- [ ] Drag task to all 4 columns in sequence — all work correctly
- [ ] Drag task to same column it's in — no change (idempotent)
- [ ] Verify card order in column is preserved (drag doesn't reorder other cards randomly)

---

## 4. QUICK TASK CREATION

### 4.1 Quick Task Form
- [ ] Click "+ New Task" or "Quick Task" button
- [ ] Inline form appears with title input
- [ ] Type task title, click "Add"
- [ ] Task appears in "To Do" column immediately
- [ ] Task title contains special characters (é, emoji 🎯, etc.) — verify they persist
- [ ] Empty title attempt → error message appears, task not created
- [ ] **Stress test**: Create 10 tasks in rapid succession, all should appear

### 4.2 Quick Task Validation
- [ ] After adding task, form clears for next entry
- [ ] Cancel button closes form without creating task
- [ ] Verify task has default values: status=TODO, priority=MEDIUM, template=general

---

## 5. GUIDED TASK CREATION (6-STEP WIZARD)

### 5.1 Wizard Navigation
- [ ] Click "Guided Task" button
- [ ] Step 1 renders: "What is the task about?" field
- [ ] Enter title, click "Next" → Step 2 renders
- [ ] Step 2: "Brief description" appears
- [ ] Click "Back" → returns to Step 1, values preserved
- [ ] Navigate through all 6 steps without error
- [ ] Verify progress indicator (e.g., "Step 3 of 6")

### 5.2 Field Validation
- [ ] Step 1 title is required — "Next" button disabled if empty
- [ ] All other steps are optional — can skip with empty fields
- [ ] Click "Next" through all steps with only title filled — should work
- [ ] Click "Create Task" on step 6 → task created with only title

### 5.3 Guided Task Creation & Persistence
- [ ] Fill all 6 steps with detailed text
- [ ] Click "Create Task"
- [ ] Wizard closes
- [ ] New task appears on board immediately
- [ ] Verify task has template="processImprovement"
- [ ] Refresh page → task persists
- [ ] Open task detail panel → all 6 fields populated correctly
- [ ] **Stress test**: Create 5 guided tasks with different templates, all persist

### 5.4 Polish Button (AI Enhancement)
- [ ] On any step, type text that could be improved (e.g., "make video")
- [ ] Click ✨ "Polish" button
- [ ] Button shows "Polishing..." state
- [ ] After 2-3 seconds, text updates with improved version
- [ ] Example: "make video" → "Create and record marketing video"
- [ ] Wizard stays open after Polish (doesn't close)
- [ ] Polish on each field type: title, description, problem, workflow, improvement, automation
- [ ] **Edge case**: Polish on already-perfect text → should make minimal changes or show "Already polished"
- [ ] **Stress test**: Polish same field 5 times — each should improve further (or stabilize)

### 5.5 Wizard Closing Issues
- [ ] While wizard is open, verify clicking on board cards behind wizard doesn't trigger panel opens
- [ ] Close wizard with "Cancel" → returns to clean state
- [ ] Verify no state leakage between multiple wizard openings

---

## 6. TASK DETAIL PANEL

### 6.1 Panel Opening & Closing
- [ ] Click task card → detail panel slides in from right
- [ ] Panel shows task title as heading
- [ ] Click X button → panel closes
- [ ] Verify panel doesn't block board (should be overlay or side panel)
- [ ] Close panel, open different task → new panel content loads

### 6.2 Task Information Display
- [ ] Displays: Title, Description, Status, Priority, Due Date
- [ ] Displays: Template type
- [ ] Displays: Subtasks with count and progress (e.g., "2 of 4 done")
- [ ] Displays: Comments section
- [ ] Displays: Attachments section
- [ ] All fields decrypt and display correctly (no encrypted text visible)
- [ ] Due date displays in readable format (e.g., "June 20, 2026")

### 6.3 Edit Mode
- [ ] Click "Edit" button → panel switches to edit mode
- [ ] Title becomes editable text field
- [ ] Description becomes textarea
- [ ] Priority becomes dropdown
- [ ] Due date becomes date picker
- [ ] Template selector appears as dropdown
- [ ] Save button enabled when changes made
- [ ] Cancel button discards changes

### 6.4 Template Selector
- [ ] Template dropdown shows all 5 options: General, Automation Brief, Documentation, Process Improvement, Project Coordination
- [ ] Selecting new template → form fields change dynamically
- [ ] General template shows: Title, Description, Priority, Due Date
- [ ] Automation Brief shows: Title, Problem, Current Workflow, Desired Improvement, Blockers
- [ ] Documentation shows: Title, Description, Goal, Expected Output, Quality Requirements
- [ ] Process Improvement shows: Title, Problem, Workflow, Improvement, Automation Opportunity, Blockers
- [ ] Field changes are immediate (no page reload needed)
- [ ] Save with template change → template persists after refresh

### 6.5 Status Dropdown (Move Tasks)
- [ ] Status dropdown visible (always visible, even when not editing)
- [ ] Change status from "To Do" → "In Progress"
- [ ] Status updates in DB immediately
- [ ] Board card moves to new column immediately
- [ ] Try all 4 status transitions: TODO → IN_PROGRESS → IN_REVIEW → DONE → TODO
- [ ] Refresh page → status persists in correct column

### 6.6 Save & Cancel
- [ ] Edit title, click Save → title updates, detail panel still open
- [ ] Close panel → reopen task → changes persisted
- [ ] Edit field, click Cancel → changes discarded, original values shown
- [ ] **Validation**: Try to save empty title → error shown, title not cleared

---

## 7. SUBTASKS

### 7.1 Subtask Display
- [ ] Open task with subtasks → subtasks section visible
- [ ] Each subtask shows: checkbox, title, status indicator
- [ ] Progress bar visible: "2 of 5 complete" with visual progress
- [ ] Subtask list scrollable if many subtasks

### 7.2 Subtask Creation
- [ ] "Add a subtask..." input field visible
- [ ] Type subtask title, press Enter → subtask created and added to list
- [ ] Type subtask title, click "Add" button → same result
- [ ] New subtask appears immediately in list
- [ ] Subtask counter updates (e.g., "1 of 5")
- [ ] **Validation**: Try empty subtask → error or no-op
- [ ] **Stress test**: Add 20 subtasks to one task, verify performance

### 7.3 Subtask Completion
- [ ] Click subtask checkbox → status changes to DONE
- [ ] Text gets strikethrough ✓
- [ ] Progress updates immediately (e.g., "1 of 3" → "2 of 3")
- [ ] Progress bar fills further
- [ ] Refresh page → subtask state persists
- [ ] Click checkbox again → reverts to TODO
- [ ] Verify no API errors in console

### 7.4 Subtask Persistence
- [ ] Add subtask, close detail panel, reopen task → subtask still there
- [ ] Refresh page → all subtasks persist
- [ ] **Stress test**: Add 50 subtasks, mark 25 complete, refresh → all persist correctly

---

## 8. COMMENTS

### 8.1 Comment Display
- [ ] Comments section shows all comments in chronological order (oldest first or newest first — consistent)
- [ ] Each comment shows: author name, timestamp, comment text
- [ ] No comments initially → "No comments yet" message
- [ ] Comments decrypt and display correctly (no encrypted text)

### 8.2 Comment Creation
- [ ] Comment textarea visible with placeholder "Add a comment..."
- [ ] Type comment text, click "Post Comment"
- [ ] Comment appears immediately in list (no refresh needed)
- [ ] Textarea clears after posting
- [ ] Comment persists after page refresh
- [ ] Multiple comments appear in correct order
- [ ] **Stress test**: Post 20 comments in rapid succession, verify all persist

### 8.3 Comment Validation
- [ ] Try posting empty comment → error message, comment not created
- [ ] Post comment with special characters and emoji → persist correctly
- [ ] Post very long comment (500+ chars) → wraps correctly, doesn't break layout

### 8.4 Comment Persistence
- [ ] Close detail panel, reopen task → comments still visible
- [ ] Refresh page → all comments persist with correct author and timestamp
- [ ] Comments are encrypted in DB (no plaintext PHI)

---

## 9. ATTACHMENTS

### 9.1 File Upload
- [ ] Click "Upload File" button
- [ ] File picker opens (or file input appears)
- [ ] Select small file (< 1MB, e.g., .txt or .pdf)
- [ ] File uploads and appears in attachment list
- [ ] Attachment shows: filename, file size, upload timestamp
- [ ] **Stress test**: Upload 10 different file types (pdf, doc, xls, img, etc.)

### 9.2 File Persistence
- [ ] Refresh page → attachments still visible
- [ ] Close and reopen task detail panel → attachments still there
- [ ] Click download/view link (if available) → file opens or downloads correctly

### 9.3 Attachment List
- [ ] Multiple attachments display as list or grid
- [ ] File size displays in human-readable format (KB, MB)
- [ ] No broken images or placeholder for file icons
- [ ] **Stress test**: Add 20 attachments, verify no UI lag or breaking

---

## 10. PERFORMANCE & STRESS TESTING

### 10.1 Load Performance
- [ ] Dashboard loads in < 2 seconds with 5 projects
- [ ] Project board loads in < 2 seconds with 50 tasks
- [ ] **Stress test**: Navigate between 5 projects rapidly, no lag
- [ ] Open/close detail panel 10 times — no slowdown

### 10.2 Data Volume
- [ ] Create 100 tasks in one project — board still loads and renders
- [ ] Add 30 subtasks to one task — panel doesn't crash
- [ ] Post 50 comments on one task — comment section still responsive
- [ ] Monitor browser DevTools → Memory usage stable (no memory leaks)

### 10.3 Network Resilience
- [ ] Simulate slow network (DevTools → Network → Slow 3G)
- [ ] Create task — verify loading state, eventual success
- [ ] Drag task with slow network — verify optimistic update or clear loading state
- [ ] Refresh page with slow network — verify app still loads

### 10.4 Concurrent Actions
- [ ] Have task detail panel open
- [ ] While panel is open, create new task on board
- [ ] Board updates, panel stays open showing old task
- [ ] Close and reopen panel → shows updated data
- [ ] **Stress test**: Rapidly switch between tasks while creating new ones

---

## 11. ERROR HANDLING & EDGE CASES

### 11.1 Missing/Invalid Data
- [ ] Try to access task with invalid ID directly via URL — shows error or 404
- [ ] Try to access project user doesn't have access to — shows error
- [ ] Task with missing title field → graceful handling or error message
- [ ] Task with null due date → displays "No due date" not "null"

### 11.2 Form Validation
- [ ] Submit task form with only whitespace in title — treat as empty, show error
- [ ] Edit task, change title to empty, try to save — prevent save, show error
- [ ] Very long task title (1000+ chars) — truncate gracefully or warn user

### 11.3 Network Errors
- [ ] Simulate offline mode (DevTools → offline)
- [ ] Try to create task — clear error message shown
- [ ] Try to update task — clear error message, allows retry
- [ ] Come back online — app recovers gracefully

### 11.4 Duplicate Prevention
- [ ] Create task with same title twice → both created (no dedup on client side, expected)
- [ ] Post same comment twice rapidly → both created (or second prevented by debounce)

---

## 12. UI/UX & ACCESSIBILITY

### 12.1 Visual Consistency
- [ ] All buttons have consistent styling
- [ ] All input fields have consistent styling
- [ ] Color scheme is consistent throughout
- [ ] No garbled text, broken layouts, or overlapping elements
- [ ] Mobile responsiveness (if applicable) — resize browser, UI adapts

### 12.2 Readability
- [ ] All text is readable (good contrast, font size)
- [ ] No text appears encrypted or corrupted
- [ ] Timestamps are readable and relative ("2 hours ago" or "June 20")
- [ ] Priority badges are visually distinct

### 12.3 Intuitiveness
- [ ] First-time user can create task without instructions
- [ ] Status/column change is obvious (dropdown visible)
- [ ] Edit mode is visually distinct from view mode
- [ ] Wizard step progression is clear
- [ ] Error messages are helpful (not cryptic error codes)

### 12.4 Responsiveness (if not mobile-only)
- [ ] Drag and drop works on keyboard (Tab to task, use arrow keys)
- [ ] Tab order is logical (can navigate without mouse)
- [ ] Forms are keyboard-navigable
- [ ] Focus indicators visible for keyboard navigation

---

## 13. DATA INTEGRITY & SECURITY

### 13.1 Encryption Verification
- [ ] Open DevTools → Network → Create task
- [ ] Verify POST payload contains encrypted fields (titleEnc, descriptionEnc, etc.) — not plaintext
- [ ] Verify GET response decrypts fields (title, description visible) — not encrypted
- [ ] Check Database: task titles should be encrypted in DB, not readable in plaintext

### 13.2 Audit Logging
- [ ] Create task → check API logs for TASK_CREATED audit entry
- [ ] View task → check API logs for TASK_VIEWED audit entry
- [ ] Update task → check API logs for TASK_UPDATED audit entry
- [ ] Post comment → check API logs for COMMENT_CREATED audit entry

### 13.3 Access Control
- [ ] Only logged-in users can access app (redirect to login if not authenticated)
- [ ] Users can only see projects they're a member of (if multi-user access available)
- [ ] Domain restriction works (balidoc.com email required)

---

## 14. SPECIFIC BUG REGRESSION TESTS

### 14.1 Previously Fixed Bugs
- [ ] Guided task saves and appears on board (FIXED)
- [ ] Polish button improves text and stays in wizard (FIXED)
- [ ] Status dropdown moves card to new column (FIXED)
- [ ] Subtask checkboxes update status and progress (FIXED)
- [ ] Comments display immediately after posting (FIXED)
- [ ] Subtasks persist after page refresh (FIXED)
- [ ] Wizard navigation doesn't open task panels (FIXED)

---

## 15. AUTOMATED TEST SCRIPT CHECKLIST

Create automated browser extension tests for:

- [ ] Login & session persistence
- [ ] Create project (if available)
- [ ] Navigate to project board
- [ ] Create quick task
- [ ] Create guided task (all 6 steps)
- [ ] Polish text on guided task
- [ ] Change task status (drag or dropdown)
- [ ] Verify task moves to new column
- [ ] Add subtask
- [ ] Complete subtask (checkbox)
- [ ] Verify progress counter updates
- [ ] Post comment
- [ ] Verify comment appears immediately
- [ ] Refresh page
- [ ] Verify all data persists (tasks, subtasks, comments)
- [ ] Check console for errors (should be none)
- [ ] Check Network tab for failed requests (should be none)
- [ ] Test with 50+ tasks for performance
- [ ] Test status transitions: TODO → IN_PROGRESS → IN_REVIEW → DONE

---

## 16. REPORTING TEMPLATE

For each issue found, report:

```
**ISSUE**: [Brief title]
**SEVERITY**: Critical | High | Medium | Low
**CATEGORY**: Functional | Performance | UX | Security | Data Integrity
**STEPS TO REPRODUCE**:
1. [Step 1]
2. [Step 2]
3. [Step 3]

**EXPECTED**: [What should happen]
**ACTUAL**: [What actually happened]
**EVIDENCE**: [Console errors, screenshots, network requests]
**SUGGESTED FIX**: [If applicable]
```

---

## End-to-End Flow (Golden Path)

1. User logs in with balidoc.com account ✓
2. Lands on dashboard with projects ✓
3. Clicks project → sees empty Kanban board with 4 columns ✓
4. Creates quick task "Review code" → appears in To Do ✓
5. Creates guided task with all 6 steps + Polish button usage ✓
6. Drag task to In Progress ✓
7. Click task → detail panel opens ✓
8. Add 3 subtasks, complete 1 ✓
9. Post 2 comments ✓
10. Upload 1 attachment ✓
11. Change status to Done via dropdown ✓
12. Close panel, verify board shows card in Done column ✓
13. Refresh page, verify all data persists ✓
14. Check audit logs for TASK_CREATED, COMMENT_CREATED, TASK_UPDATED entries ✓

**PASS CONDITION**: All steps complete without errors, all data persists.

---

