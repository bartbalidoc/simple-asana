# BEX test prompt — release v1.1 (2026-07-03)

Copy everything below the line into BEX to have it test the new release in the browser.

---

You are testing a project-management web app for a clinic team. Base URL: **http://206.189.200.138:3000**

Log in with a Google account that is a team member, or email/password credentials the operator gives you. Note: everyone was logged out by a security update, so a fresh login is expected. If login fails, report that first and stop.

Work through these 7 test scenarios **in order**. For each one, report PASS or FAIL with a one-line observation (and a screenshot where possible).

**1. Attachment viewing (the bug Meilinda reported)**
Open any project board → open a task → in the Attachments section, upload a small PDF. After it appears in the list, click the file name. Expected: the PDF opens in a new browser tab rendered by the app itself (URL starts with `/api/tasks/...`), NOT a Google Drive "request access" page. Also try an image file.

**2. Upload error messages**
Still in Attachments, try uploading again. If anything fails, the error shown should be a specific reason (not a generic "Failed to upload file").

**3. Notification bell + deep links (Sidney's request)**
You need two accounts for this (or ask the operator to comment with a second account). With account A, assign a task to account B. Then, as account B: a red badge should appear on the 🔔 bell in the top bar (may take up to a minute — it refreshes when you click the bell). Open the bell: there should be a "…assigned you…" notification. Click it. Expected: you land directly on the right board WITH that task's panel open. Then have account A add a comment on that task and change its status to In Progress; account B should get both notifications. "Mark all read" should clear the badge.

**4. Markdown descriptions (Gabriel's request)**
Open any task → Description → type:
```
# Plan
**Important:** call the *supplier*
- order stock
- check invoice
1. first step
2. second step
```
Click the "Preview" toggle above the field. Expected: a real heading, bold, italic, bullet list and numbered list — no visible `**` or `#` characters. Click "Write" to go back, then Save; reopen the task and check Preview still renders.

**5. Admin loading speed (Gabriel's complaint)**
Log in as an admin. Time how long the Projects page and a large board take to appear (rough count is fine). Expected: both load within a couple of seconds. Report the rough timings.

**6. Transcript → tasks with AI assignee matching**
Go to "Meeting → Tasks". Paste a short fake meeting transcript that misspells a real teammate's name (e.g. if there is an "Adel", write: "kadel will update the price list this week, and sidney should review the supplier contract, high priority"). Click Generate tasks. Expected: the drafted tasks have the Assignee dropdown pre-selected with the correctly-spelled real teammates, with a small gray note like `heard "kadel"`. Also test: edit the description inline, add and remove a subtask, and type in the "Fix with AI" box (e.g. "rewrite in clear English and make it about the pharmacy price list") and click ✨ Fix — the task should be rewritten in place. Do NOT click Create unless the operator says it's okay.

**7. Notifications list survives navigation**
After the tests above, click the bell again from a different page (e.g. Dashboard). The same notifications should be listed, newest first, with read ones dimmed.

Finally, report anything else odd you noticed (console errors, layout glitches, slow pages) as a bulleted list.

---

# BEX test prompt — release v1.2 mobile (2026-07-04)

You are testing the same app (http://206.189.200.138:3000) on a PHONE-SIZED screen. Use browser device emulation (e.g. iPhone 12, 390×844) if available; otherwise resize the browser window to ~390 px wide. Log in as Bart (session may still be active). Report PASS/FAIL per scenario with a screenshot.

**M1. App shell.** At phone width there must be NO horizontal page scroll anywhere. The left sidebar should be gone; a ☰ button appears in the top bar. Tap ☰ → a drawer slides in from the left with the BaliDoc logo, all nav links, your email, and a Sign out button; the page behind dims. Tap the dark backdrop → drawer closes. Open it again, tap a nav link → it navigates AND the drawer closes.

**M2. Header.** The top bar shows ☰, the search box, and the 🔔 bell — no overlapping or clipped elements. Search still opens results; the bell still opens the notifications panel and it fits on screen.

**M3. Board swipe.** Open a project board. Columns should appear one at a time (~full width) with the next column peeking at the right edge; swiping horizontally snaps column to column. Cards look intact (title, priority chip, avatar). "+ Add task" still works.

**M4. Task panel.** Tap a task card → the detail panel covers the full screen and scrolls; the title area stays visible (sticky) while scrolling. Edit something, save, close. Confirm you land back on the board.

**M5. Pages.** Visit Dashboard, Projects, and Meeting → Tasks at phone width: cards stack in one column, nothing overflows sideways, buttons wrap onto new lines instead of being cut off. On an admin page with a table (Activity), the table scrolls sideways inside its own box — the page itself doesn't.

**M6. Desktop regression.** Set the viewport back to desktop size (≥1280 px): classic fixed sidebar returns, no ☰ button, sign-out visible in the header, board shows all columns side by side as before.

---

# BEX test prompt — release v1.3 task guests (2026-07-04)

Same app (http://206.189.200.138:3000), desktop viewport, logged in as Bart (ADMIN).

**G1. Guests row.** Open a task on a board that some teammate (e.g. Meilinda) is NOT a member of (ask the operator which board if unsure). In the task panel below "Assigned To" there is a "Guests" row. Use "+ Add guest" to add that teammate. Expected: a purple chip with their name appears and a toast confirms.

**G2. Mention an outsider.** On another task in the same project, write a comment @mentioning a teammate who is NOT on the project (the @ dropdown should now offer the whole team). Post it. Expected: the comment posts normally; if you reopen the task, the mentioned person now appears in the Guests row automatically.

**G3. Members unchanged.** Open the board's Members list — the guests from G1/G2 must NOT have become project members, and the project must not appear in their sidebar (verify from their account if available).

**G4. Guest chip removal.** Remove a guest with the ✕ on their chip. Expected: chip disappears with a toast.

**G5. (needs the guest's account, optional)** As the guest: the Dashboard shows the task under My Tasks with a purple "Guest" badge; clicking it opens a standalone task view at /tasks/… with a purple "you're a guest" note; commenting works; editing the title/status does not (server rejects it); the Projects page still does NOT list that project.
