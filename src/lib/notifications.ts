import { prisma } from "@/lib/prisma";
import { encrypt } from "@/lib/encryption";

// In-app notifications (feedback: multi-assignee broadcast + deep-linking).
// All helpers are best-effort: a notification failure must never break the
// comment/task write that triggered it.

export type NotificationType = "COMMENT" | "MENTION" | "STATUS" | "ASSIGNED" | "UPDATE";

/**
 * Everyone "involved" in a task: the task's assignee, its subtasks' assignees,
 * its creator, anyone who has commented on it — and, when the task is itself a
 * subtask, the same set for its parent. The actor is always excluded.
 */
export async function taskCollaboratorIds(taskId: string, excludeUserId?: string): Promise<{
  recipientIds: string[];
  anchorTaskId: string;
  projectId: string;
} | null> {
  const task = await prisma.task.findUnique({
    where: { id: taskId },
    select: { id: true, projectId: true, assigneeId: true, createdById: true, parentTaskId: true },
  });
  if (!task) return null;

  // Notifications deep-link to the parent task — that's the card the board opens.
  const anchorTaskId = task.parentTaskId || task.id;
  const anchor =
    anchorTaskId === task.id
      ? task
      : await prisma.task.findUnique({
          where: { id: anchorTaskId },
          select: { id: true, projectId: true, assigneeId: true, createdById: true, parentTaskId: true },
        });
  if (!anchor) return null;

  const subtasks = await prisma.task.findMany({
    where: { parentTaskId: anchorTaskId },
    select: { id: true, assigneeId: true },
  });

  // Commenters are involved too — e.g. an admin who assigned the task and
  // follows up in the comments should hear about later changes.
  const commenters = await prisma.comment.findMany({
    where: { taskId: { in: [anchorTaskId, ...subtasks.map((s) => s.id)] } },
    select: { authorId: true },
    distinct: ["authorId"],
  });

  // Task guests follow the task like anyone else on it.
  const guests = await prisma.taskGuest.findMany({
    where: { taskId: anchorTaskId },
    select: { userId: true },
  });

  const ids = new Set<string>();
  for (const id of [
    anchor.assigneeId,
    anchor.createdById,
    task.assigneeId,
    task.createdById,
    ...subtasks.map((s) => s.assigneeId),
    ...commenters.map((c) => c.authorId),
    ...guests.map((g) => g.userId),
  ]) {
    if (id) ids.add(id);
  }
  if (excludeUserId) ids.delete(excludeUserId);

  return { recipientIds: [...ids], anchorTaskId, projectId: anchor.projectId };
}

/**
 * Create one notification per recipient. Never throws.
 */
export async function createNotifications(args: {
  recipientIds: string[];
  actorName: string;
  type: NotificationType;
  message: string;
  taskId?: string;
  projectId?: string;
}): Promise<void> {
  try {
    const recipients = [...new Set(args.recipientIds)];
    if (recipients.length === 0) return;
    const messageEnc = encrypt(args.message);
    await prisma.notification.createMany({
      data: recipients.map((userId) => ({
        userId,
        actorName: args.actorName,
        type: args.type,
        messageEnc,
        taskId: args.taskId || null,
        projectId: args.projectId || null,
      })),
    });
  } catch (err) {
    console.error("createNotifications error:", err);
  }
}

/**
 * Broadcast a task update to everyone involved in the task (minus the actor).
 * Never throws.
 */
export async function notifyTaskCollaborators(args: {
  taskId: string;
  actorId: string;
  actorName: string;
  type: NotificationType;
  message: string;
  /** Extra recipients (e.g. a newly assigned user); actor still excluded. */
  alsoNotify?: string[];
  /** Recipients already notified another way (e.g. @mentioned); skipped here. */
  skip?: string[];
}): Promise<void> {
  try {
    const collab = await taskCollaboratorIds(args.taskId, args.actorId);
    if (!collab) return;
    const skip = new Set(args.skip || []);
    const recipients = [...new Set([...collab.recipientIds, ...(args.alsoNotify || [])])].filter(
      (id) => id !== args.actorId && !skip.has(id)
    );
    await createNotifications({
      recipientIds: recipients,
      actorName: args.actorName,
      type: args.type,
      message: args.message,
      taskId: collab.anchorTaskId,
      projectId: collab.projectId,
    });
  } catch (err) {
    console.error("notifyTaskCollaborators error:", err);
  }
}
