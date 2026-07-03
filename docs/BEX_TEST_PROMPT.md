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
