import { prisma } from "@/lib/prisma";
import { encrypt } from "@/lib/encryption";
import { RepeatEvery } from "@prisma/client";

// Recurring tasks (Meilinda, v2.2).
//
// Design: a task carries its own repeat rule (repeatEvery / repeatOnDay /
// nextRunAt). When nextRunAt passes, the engine spawns a FRESH copy of the task
// — cloned subtasks, assignees, description, priority, template — into the To Do
// column, and HANDS the repeat rule off to that new copy (advancing nextRunAt).
// The old task loses its rule and becomes a plain historical task. So exactly
// one task per series is ever "live", and finished copies can be archived.
//
// All wall-clock reasoning is in Bali time (WITA = UTC+8, no DST). Copies spawn
// at 06:00 WITA so a task is waiting when the team starts the day.

const BALI_OFFSET_HOURS = 8;
const SPAWN_HOUR_WITA = 6; // 06:00 Bali
export const LAST_DAY_SENTINEL = 0; // repeatOnDay = 0 → last day of the month

// A Date's Bali wall-clock parts (year, month 0-11, day 1-31, dow 0-6).
function baliParts(d: Date) {
  const b = new Date(d.getTime() + BALI_OFFSET_HOURS * 3600_000);
  return {
    year: b.getUTCFullYear(),
    month: b.getUTCMonth(),
    day: b.getUTCDate(),
    dow: b.getUTCDay(),
  };
}

// UTC instant for a given Bali wall-clock (y, m 0-11, d, hour). Because WITA is
// a fixed +8, wall-clock hour H Bali = (H - 8) UTC; Date.UTC normalizes any
// negative hour into the previous day, so this is exact year-round.
function baliWallToUtc(year: number, month: number, day: number, hour: number): Date {
  return new Date(Date.UTC(year, month, day, hour - BALI_OFFSET_HOURS, 0, 0, 0));
}

function daysInMonth(year: number, month: number): number {
  return new Date(Date.UTC(year, month + 1, 0)).getUTCDate();
}

/**
 * The first occurrence strictly AFTER `after`, for the given rule, as a UTC Date.
 * Returns null for NONE / invalid input.
 *
 * MONTHLY: repeatOnDay = 1-31 (clamped to the month's length), or 0 = last day.
 * WEEKLY:  repeatOnDay = 0(Sun)-6(Sat).
 */
export function nextOccurrence(
  repeatEvery: RepeatEvery,
  repeatOnDay: number | null | undefined,
  after: Date
): Date | null {
  if (repeatEvery === "NONE" || repeatOnDay == null) return null;
  const p = baliParts(after);

  if (repeatEvery === "MONTHLY") {
    // Try this Bali month, then roll forward until the candidate is > after.
    for (let i = 0; i < 3; i++) {
      const year = p.year + Math.floor((p.month + i) / 12);
      const month = (p.month + i) % 12;
      const dim = daysInMonth(year, month);
      const day =
        repeatOnDay === LAST_DAY_SENTINEL ? dim : Math.min(repeatOnDay, dim);
      const candidate = baliWallToUtc(year, month, day, SPAWN_HOUR_WITA);
      if (candidate.getTime() > after.getTime()) return candidate;
    }
    return null; // unreachable in practice
  }

  // WEEKLY — find the next matching day-of-week at 06:00 Bali, strictly after.
  const target = ((repeatOnDay % 7) + 7) % 7;
  for (let add = 0; add <= 7; add++) {
    const dow = (p.dow + add) % 7;
    if (dow !== target) continue;
    const candidate = baliWallToUtc(p.year, p.month, p.day + add, SPAWN_HOUR_WITA);
    if (candidate.getTime() > after.getTime()) return candidate;
  }
  return null;
}

// A short human phrase for the rule, e.g. "monthly on day 15", "monthly on the
// last day", "weekly on Monday". Used in UI + audit.
const DOW_NAMES = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
export function describeRecurrence(
  repeatEvery: RepeatEvery,
  repeatOnDay: number | null | undefined
): string {
  if (repeatEvery === "NONE" || repeatOnDay == null) return "Doesn't repeat";
  if (repeatEvery === "MONTHLY") {
    return repeatOnDay === LAST_DAY_SENTINEL
      ? "Monthly on the last day"
      : `Monthly on day ${repeatOnDay}`;
  }
  return `Weekly on ${DOW_NAMES[((repeatOnDay % 7) + 7) % 7]}`;
}

/**
 * Find every recurring task whose next copy is due and spawn each one. Cheap and
 * safe to call from any authenticated request (best-effort) or the cron.
 */
export async function runDueRecurrences(limit = 25): Promise<number> {
  const now = new Date();
  const due = await prisma.task.findMany({
    where: {
      repeatEvery: { not: "NONE" },
      nextRunAt: { lte: now, not: null },
      parentTaskId: null,
    },
    select: { id: true },
    take: limit,
  });
  let spawned = 0;
  for (const { id } of due) {
    try {
      if (await spawnDue(id)) spawned++;
    } catch (err) {
      console.error(`recurrence: spawn failed for ${id}:`, err);
    }
  }
  return spawned;
}

/**
 * Spawn the next copy for one due task, moving the rule onto the copy. Returns
 * the new task id, or null if it wasn't spawned (already claimed / not due).
 */
export async function spawnDue(sourceId: string): Promise<string | null> {
  const now = new Date();

  // Read the live rule BEFORE claiming (we need repeatEvery/repeatOnDay to build
  // the copy and compute the following occurrence).
  const source = await prisma.task.findUnique({
    where: { id: sourceId },
    include: { subtasks: { orderBy: { order: "asc" } } },
  });
  if (
    !source ||
    source.repeatEvery === "NONE" ||
    source.repeatOnDay == null ||
    !source.nextRunAt ||
    source.nextRunAt.getTime() > now.getTime() ||
    source.parentTaskId
  ) {
    return null;
  }

  // Claim atomically — clears the rule off the source. Only the winner proceeds.
  const claim = await prisma.task.updateMany({
    where: { id: sourceId, repeatEvery: source.repeatEvery, nextRunAt: source.nextRunAt },
    data: { repeatEvery: "NONE", nextRunAt: null },
  });
  if (claim.count !== 1) return null;

  const firedAt = source.nextRunAt;
  const following = nextOccurrence(source.repeatEvery, source.repeatOnDay, firedAt);
  const seriesId = source.seriesId || source.id;

  // The new copy: a fresh TODO in the To Do column, rule handed off to it.
  const firstColumn = await prisma.column.findFirst({
    where: { projectId: source.projectId },
    orderBy: { order: "asc" },
    select: { id: true },
  });

  const created = await prisma.task.create({
    data: {
      titleEnc: source.titleEnc,
      descriptionEnc: source.descriptionEnc,
      goalEnc: source.goalEnc,
      expectedOutputEnc: source.expectedOutputEnc,
      qualityRequirementsEnc: source.qualityRequirementsEnc,
      problemEnc: source.problemEnc,
      currentWorkflowEnc: source.currentWorkflowEnc,
      desiredImprovementEnc: source.desiredImprovementEnc,
      automationOpportunityEnc: source.automationOpportunityEnc,
      status: "TODO",
      priority: source.priority,
      template: source.template,
      projectId: source.projectId,
      columnId: firstColumn?.id ?? null,
      assigneeId: source.assigneeId,
      createdById: source.createdById,
      // Hand the rule to the new copy and advance the clock.
      repeatEvery: source.repeatEvery,
      repeatOnDay: source.repeatOnDay,
      nextRunAt: following,
      seriesId,
      // Fresh copy: no dueDate carried (the recurrence date IS the schedule),
      // no archive/asana bookkeeping.
      subtasks: {
        create: source.subtasks.map((st) => ({
          titleEnc: st.titleEnc,
          descriptionEnc: st.descriptionEnc,
          status: "TODO" as const,
          priority: st.priority,
          template: st.template,
          order: st.order,
          projectId: source.projectId,
          assigneeId: st.assigneeId, // keep the handoff chain (Asima→Fafa→Mei)
          createdById: st.createdById,
        })),
      },
    },
    select: { id: true, assigneeId: true, subtasks: { select: { assigneeId: true } } },
  });

  // Backfill the source's seriesId so the whole chain is linkable, if it was the
  // original (its seriesId was null and now equals its own id).
  if (!source.seriesId) {
    await prisma.task.update({ where: { id: source.id }, data: { seriesId } });
  }

  // Notify everyone who has a piece of the new copy that it's waiting.
  try {
    const recipientIds = new Set<string>();
    if (created.assigneeId) recipientIds.add(created.assigneeId);
    for (const st of created.subtasks) if (st.assigneeId) recipientIds.add(st.assigneeId);
    if (recipientIds.size > 0) {
      const messageEnc = encrypt("A recurring task is ready for this month.");
      await prisma.notification.createMany({
        data: [...recipientIds].map((userId) => ({
          userId,
          actorName: "Plendex",
          type: "ASSIGNED",
          messageEnc,
          taskId: created.id,
          projectId: source.projectId,
        })),
      });
    }
  } catch (err) {
    console.error("recurrence: notify failed (non-fatal):", err);
  }

  return created.id;
}
