import { prisma } from "@/lib/prisma";

// One shared answer to "may this user touch this task?" — replaces the
// per-route copies of checkTaskAccess and adds task-level guests.
//
// Levels:
//   ADMIN  — site admin (full access everywhere)
//   MEMBER — member of the task's project (full access to the task)
//   GUEST  — invited to this task (or its parent): may view and comment,
//            but not edit or delete the task itself
//   null   — no access

export type TaskAccessLevel = "ADMIN" | "MEMBER" | "GUEST" | null;

export async function taskAccessLevel(
  taskId: string,
  userId: string,
  role?: string
): Promise<TaskAccessLevel> {
  if (role === "ADMIN") return "ADMIN";

  const task = await prisma.task.findUnique({
    where: { id: taskId },
    select: {
      parentTaskId: true,
      project: { select: { members: { where: { userId }, select: { id: true } } } },
    },
  });
  if (!task) return null;
  if (task.project.members.length > 0) return "MEMBER";

  // Guest of the task, or of its parent (the panel drills into subtasks).
  const guest = await prisma.taskGuest.findFirst({
    where: {
      userId,
      taskId: { in: [taskId, ...(task.parentTaskId ? [task.parentTaskId] : [])] },
    },
    select: { id: true },
  });
  return guest ? "GUEST" : null;
}

/** View/comment access: any level. */
export async function canViewTask(taskId: string, userId: string, role?: string) {
  return (await taskAccessLevel(taskId, userId, role)) !== null;
}

/** Edit/delete access: members and admins only — guests are reviewers. */
export async function canEditTask(taskId: string, userId: string, role?: string) {
  const level = await taskAccessLevel(taskId, userId, role);
  return level === "ADMIN" || level === "MEMBER";
}
