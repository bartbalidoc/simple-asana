# Feedback loop — runbook for Claude

The admin (Sidney) submits feedback in the app via the floating **Feedback** button.
An AI asks clarifying questions, then saves a row to the **`Feedback`** table (plaintext —
readable directly via SQL). This file is how a future Claude session processes it.

**Trigger:** the user says **"process feedback"**. Then do the following.

## 1. Read NEW feedback (production DB, over SSH)
```bash
echo 'SELECT id, "createdAt", category, complexity, title, summary, "pageContext", url, "rawText", conversation FROM "Feedback" WHERE status='"'"'NEW'"'"' ORDER BY "createdAt";' \
  | ssh root@206.189.200.138 'docker exec -i simple-asana-db-1 psql -U postgres -d simplepm'
```
(Container `simple-asana-db-1`, db `simplepm`. The `conversation` column holds the full AI Q&A transcript — read it; it's where the precise intent lives.)

## 2. Triage each item

**Auto-fix (status → FIXED) only if ALL are true:**
- The request is **unambiguous** (the conversation transcript makes the intent clear).
- The change is confined to **copy/labels/wording**, a **CSS/Tailwind class**, or **one self-contained component**.
- It touches **NO** Prisma schema, auth, encryption (`*Enc` columns / `src/lib/encryption.ts`), API contract, money/role/permission logic, or data migration.
- It's localized (1–2 files) and obviously reversible, and you're confident it builds.

**Escalate (status → NEEDS_OWNER) if ANY are true:**
- Needs a schema change, new dependency, or auth/permission/role change.
- Ambiguous, needs a product decision, or affects multiple flows / shared logic.
- A real bug whose root cause is non-obvious, or you're not confident the fix is correct + safe.

**status → WONT_FIX** for out-of-scope / duplicate / by-design (put the reason in `triageNotes`).

## 3. Fix + deploy the auto-fixable ones (safely)
```bash
# make the minimal edit, then:
git add -A && git commit -m "feedback: <short desc> (feedback <id>)"
./deploy.sh    # commits must be clean; it backs up the prod DB first, then rebuilds + verifies
```
Note the commit SHA — store it on the row (`resolvedCommit`) so it can be reverted individually.

## 4. Update each row's status
Pipe SQL over stdin to avoid quoting pain:
```bash
# fixed:
echo "UPDATE \"Feedback\" SET status='FIXED', \"triageNotes\"='Auto-fixed: <what>', \"resolvedCommit\"='<sha>', \"resolvedAt\"=now(), \"updatedAt\"=now() WHERE id='<id>';" \
  | ssh root@206.189.200.138 'docker exec -i simple-asana-db-1 psql -U postgres -d simplepm'

# escalated:
echo "UPDATE \"Feedback\" SET status='NEEDS_OWNER', \"triageNotes\"='Escalated: <why Bart must handle it>', \"updatedAt\"=now() WHERE id='<id>';" \
  | ssh root@206.189.200.138 'docker exec -i simple-asana-db-1 psql -U postgres -d simplepm'
```
(`NEEDS_OWNER` rows show up in the red "Needs your attention" banner at `/admin/feedback`.)

## 5. Report to Bart
End the session with a short summary: what you auto-fixed (with commit SHAs) and what you escalated and why.

## Undo (if a fix goes wrong)
```bash
./rollback.sh                 # revert the most recent commit + redeploy
./rollback.sh <resolvedCommit>  # revert a specific feedback fix
```
Each deploy also wrote a DB backup to `/opt/backups/` first — restore one per DEPLOY.md if data needs undoing.

## Notes
- Feedback is plaintext (it's about the app, not PHI) — never put PHI in it, and read it freely.
- Auto-fixing is **manual-triggered** by design (a human starts each batch) — do not wire it to a cron without asking.
- AI structuring needs `OPENAI_API_KEY` on the droplet; if absent, feedback still saves raw (no title/category) and you triage from `rawText` + `conversation`.
