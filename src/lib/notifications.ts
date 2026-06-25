import { prisma } from "./prisma";
import { sendMail } from "./email";
import { findMentionedUserIds } from "./mentions";

// When false (the default + HIPAA-safe), emails contain NO PHI: no task
// titles, comment text, or project names — only a notice + a deep link into
// the app, where content stays encrypted behind login. Flip EMAIL_INCLUDE_PHI
// to "true" only on a BAA-covered sending setup (e.g. Google Workspace + BAA).
const INCLUDE_PHI = process.env.EMAIL_INCLUDE_PHI === "true";

function appUrl(): string {
  const url =
    process.env.APP_URL || process.env.NEXTAUTH_URL || "http://localhost:3000";
  return url.replace(/\/$/, "");
}

function taskUrl(projectId: string, taskId: string): string {
  return `${appUrl()}/projects/${projectId}?task=${taskId}`;
}

function projectUrl(projectId: string): string {
  return `${appUrl()}/projects/${projectId}`;
}

function firstName(name?: string | null): string {
  return (name || "").trim().split(/\s+/)[0] || "there";
}

function esc(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

interface LayoutOpts {
  greetingName?: string | null;
  heading: string;
  body: string; // plain text; escaped internally
  buttonText: string;
  buttonUrl: string;
}

function buildEmail(opts: LayoutOpts): { html: string; text: string } {
  const greeting = `Hi ${esc(firstName(opts.greetingName))},`;
  const heading = esc(opts.heading);
  const body = esc(opts.body);
  const { buttonText, buttonUrl } = opts;

  const html = `<!doctype html>
<html>
  <body style="margin:0;background:#f3f4f6;font-family:-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;">
    <table width="100%" cellpadding="0" cellspacing="0" style="background:#f3f4f6;padding:24px 0;">
      <tr><td align="center">
        <table width="480" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:8px;overflow:hidden;border:1px solid #e5e7eb;">
          <tr><td style="background:#dc2626;padding:16px 24px;color:#ffffff;font-weight:700;font-size:18px;">BaliDoc</td></tr>
          <tr><td style="padding:24px;color:#111827;">
            <p style="margin:0 0 12px;font-size:14px;color:#374151;">${greeting}</p>
            <h1 style="margin:0 0 12px;font-size:18px;color:#111827;">${heading}</h1>
            <p style="margin:0 0 20px;font-size:14px;color:#374151;line-height:1.5;">${body}</p>
            <a href="${esc(buttonUrl)}" style="display:inline-block;background:#dc2626;color:#ffffff;text-decoration:none;font-weight:600;font-size:14px;padding:10px 20px;border-radius:6px;">${esc(buttonText)}</a>
            <p style="margin:20px 0 0;font-size:12px;color:#9ca3af;">Details are kept in the app, behind your secure login.</p>
          </td></tr>
        </table>
        <p style="margin:16px 0 0;font-size:11px;color:#9ca3af;">You received this because you're a member of a BaliDoc workspace.</p>
      </td></tr>
    </table>
  </body>
</html>`;

  const text = `${greeting}\n\n${opts.heading}\n${opts.body}\n\n${buttonText}: ${buttonUrl}\n\nDetails are kept in the app, behind your secure login.`;

  return { html, text };
}

/** Notify a user they were assigned a task. No-ops on self-assignment. */
export async function notifyTaskAssigned(params: {
  taskId: string;
  projectId: string;
  assigneeId: string;
  actorId: string;
  actorName?: string | null;
  taskTitle?: string | null;
}): Promise<void> {
  try {
    const { taskId, projectId, assigneeId, actorId, actorName, taskTitle } = params;
    if (!assigneeId || assigneeId === actorId) return;

    const assignee = await prisma.user.findUnique({
      where: { id: assigneeId },
      select: { email: true, name: true, isActive: true },
    });
    if (!assignee?.email || !assignee.isActive) return;

    const who = firstName(actorName);
    const phi = INCLUDE_PHI && taskTitle ? ` Task: "${taskTitle}".` : "";

    const { html, text } = buildEmail({
      greetingName: assignee.name,
      heading: "You've been assigned a task",
      body: `${who} assigned a task to you in BaliDoc.${phi}`,
      buttonText: "Open the task",
      buttonUrl: taskUrl(projectId, taskId),
    });

    await sendMail({
      to: assignee.email,
      // PHI (task title) never goes in the Subject even in PHI mode — subjects are
      // logged by mail servers and shown in lock-screen previews. Detail (if any)
      // stays in the body, gated by INCLUDE_PHI above.
      subject: "You were assigned a task in BaliDoc",
      html,
      text,
    });
  } catch (err) {
    console.error("[notifications] notifyTaskAssigned failed:", err);
  }
}

/** Notify a user they were added to a project. No-ops when they added themself. */
export async function notifyProjectMemberAdded(params: {
  projectId: string;
  userId: string;
  actorId: string;
  actorName?: string | null;
}): Promise<void> {
  try {
    const { projectId, userId, actorId, actorName } = params;
    if (!userId || userId === actorId) return;

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { email: true, name: true, isActive: true },
    });
    if (!user?.email || !user.isActive) return;

    const who = firstName(actorName);

    const { html, text } = buildEmail({
      greetingName: user.name,
      heading: "You've been added to a project",
      body: `${who} added you to a project in BaliDoc.`,
      buttonText: "Open the project",
      buttonUrl: projectUrl(projectId),
    });

    await sendMail({
      to: user.email,
      subject: "You were added to a project in BaliDoc",
      html,
      text,
    });
  } catch (err) {
    console.error("[notifications] notifyProjectMemberAdded failed:", err);
  }
}

/**
 * Notify project members @mentioned in a comment. Only members of the task's
 * project are notified (they're the only ones who can open it), the comment
 * author is never notified, and on an edit only newly-added mentions are
 * notified (pass `previousBody`).
 */
export async function notifyMentions(params: {
  taskId: string;
  projectId: string;
  authorId: string;
  authorName?: string | null;
  body: string;
  previousBody?: string;
}): Promise<void> {
  try {
    const { taskId, projectId, authorId, authorName, body, previousBody } = params;

    const members = await prisma.projectMember.findMany({
      where: { projectId },
      include: { user: { select: { id: true, name: true, email: true, isActive: true } } },
    });

    const candidates = members.map((m) => ({
      id: m.user.id,
      name: m.user.name,
      email: m.user.email,
    }));

    const mentioned = new Set(findMentionedUserIds(body, candidates));

    // On edit, don't re-notify people who were already mentioned before.
    if (previousBody) {
      for (const id of findMentionedUserIds(previousBody, candidates)) {
        mentioned.delete(id);
      }
    }

    mentioned.delete(authorId); // never notify yourself
    if (mentioned.size === 0) return;

    const who = firstName(authorName);
    const phi =
      INCLUDE_PHI && body.trim()
        ? ` They said: "${body.trim().slice(0, 140)}${body.trim().length > 140 ? "…" : ""}"`
        : "";

    await Promise.all(
      Array.from(mentioned).map(async (id) => {
        const user = members.find((m) => m.user.id === id)?.user;
        if (!user?.email || !user.isActive) return;

        const { html, text } = buildEmail({
          greetingName: user.name,
          heading: "You were mentioned in a comment",
          body: `${who} mentioned you in a comment on a task in BaliDoc.${phi}`,
          buttonText: "View the comment",
          buttonUrl: taskUrl(projectId, taskId),
        });

        await sendMail({
          to: user.email,
          subject: "You were mentioned in a BaliDoc comment",
          html,
          text,
        });
      })
    );
  } catch (err) {
    console.error("[notifications] notifyMentions failed:", err);
  }
}
