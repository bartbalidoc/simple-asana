// Anthropic Claude client for turning meeting transcripts into tasks (feedback #6).
// Uses the Messages API with structured outputs (json_schema) so the model always
// returns schema-valid JSON — no brittle text parsing.
//
// This is the app's first REAL Anthropic integration (the older /api/ai/* routes
// call OpenAI despite their "Claude" comments).

const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY;
// Default to Claude Opus 4.8 (most capable). Override with ANTHROPIC_MODEL —
// e.g. "claude-haiku-4-5" for ~5x lower cost on this extraction task.
const ANTHROPIC_MODEL = process.env.ANTHROPIC_MODEL || "claude-opus-4-8";

export interface DraftTask {
  title: string;
  description: string;
  priority: "LOW" | "MEDIUM" | "HIGH";
  subtasks: string[];
  // Assignee inferred by Claude from the transcript and matched to the real roster.
  // assigneeId is a valid user id (or "" when nobody clear was named); assigneeName
  // is the raw name as heard in the transcript ("kadel"), kept for UI transparency.
  assigneeId: string;
  assigneeName: string;
}

// A team member Claude can assign work to. Passed in so the model can correct
// transcription mishears ("kadel" → "Adel") by matching against real names.
export interface RosterMember {
  id: string;
  name: string;
}

export function anthropicEnabled(): boolean {
  return !!ANTHROPIC_API_KEY;
}

// JSON Schema for the model's output. Built per-request so assigneeId is an enum
// of the actual roster ids (+ "") — the model can only ever return a valid user id
// or leave it unassigned. Kept within the structured-outputs subset.
function tasksSchema(rosterIds: string[]) {
  return {
    type: "object",
    additionalProperties: false,
    properties: {
      tasks: {
        type: "array",
        items: {
          type: "object",
          additionalProperties: false,
          properties: {
            title: { type: "string" },
            description: { type: "string" },
            priority: { type: "string", enum: ["LOW", "MEDIUM", "HIGH"] },
            subtasks: { type: "array", items: { type: "string" } },
            assigneeId: { type: "string", enum: [...rosterIds, ""] },
            assigneeName: { type: "string" },
          },
          required: ["title", "description", "priority", "subtasks", "assigneeId", "assigneeName"],
        },
      },
    },
    required: ["tasks"],
  };
}

const SYSTEM_PROMPT = `You turn meeting transcripts into an organized, actionable task list for a project-management board.
Extract only real action items and decisions that imply follow-up work. For each task:
- title: a short outcome-focused imperative (e.g. "Set up SEO tracking for touristpharmacy.com").
- description: 1-3 sentences of context taken from the transcript — the what and the why. Never invent facts, dates, names, or numbers that are not in the transcript.
- priority: LOW, MEDIUM, or HIGH based on the urgency expressed in the meeting (default MEDIUM).
- subtasks: 0-6 concrete verb-noun steps when the task clearly breaks down; otherwise an empty array.
- assigneeName: the name of the person the task is given to, exactly as it appears in the transcript. Empty string if no one is clearly named.
- assigneeId: the id of the matching team member from the ROSTER below. Transcripts are auto-transcribed and names are often misheard or misspelled (e.g. "kadel" or "Adele" for "Adel", "Jon" for "John"). Match on how the name SOUNDS and looks, picking the single closest roster member. If no roster name is a plausible match, or nobody is clearly assigned, use an empty string — never guess a random person.
Ignore chit-chat, FYI status updates with no follow-up, and anything that isn't actionable. If there are no action items at all, return an empty tasks array.`;

/**
 * Extract a draft task list from a raw meeting transcript. Returns a preview only —
 * the caller decides which tasks to actually create. Pass the team roster so Claude
 * can attribute each task to a real person despite transcription errors.
 */
export async function transcriptToTasks(
  transcript: string,
  roster: RosterMember[] = []
): Promise<DraftTask[]> {
  if (!ANTHROPIC_API_KEY) throw new Error("ANTHROPIC_API_KEY is not configured");

  const validIds = new Set(roster.map((m) => m.id));
  const rosterBlock = roster.length
    ? `\n\nROSTER (id — name), the only people you may assign work to:\n${roster
        .map((m) => `${m.id} — ${m.name}`)
        .join("\n")}`
    : "\n\nROSTER: (none provided — leave every assigneeId empty)";

  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "x-api-key": ANTHROPIC_API_KEY,
      "anthropic-version": "2023-06-01",
      "content-type": "application/json",
    },
    body: JSON.stringify({
      model: ANTHROPIC_MODEL,
      max_tokens: 4096,
      system: SYSTEM_PROMPT + rosterBlock,
      messages: [{ role: "user", content: `Meeting transcript:\n\n${transcript}` }],
      output_config: {
        effort: "low", // extraction task — keep it fast and cheap
        format: { type: "json_schema", schema: tasksSchema(roster.map((m) => m.id)) },
      },
    }),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Anthropic API ${res.status}: ${text.slice(0, 300)}`);
  }

  const data = await res.json();
  // Safety classifiers may decline (HTTP 200 + stop_reason "refusal") — guard before reading content.
  if (data.stop_reason === "refusal") {
    throw new Error("The model declined to process this transcript.");
  }
  const textBlock = (data.content || []).find((b: any) => b.type === "text");
  if (!textBlock?.text) throw new Error("Claude returned no content.");

  let parsed: any;
  try {
    parsed = JSON.parse(textBlock.text);
  } catch {
    throw new Error("Claude returned malformed JSON.");
  }

  const tasks = Array.isArray(parsed?.tasks) ? parsed.tasks : [];
  // Normalize/guard everything before it reaches the UI.
  return tasks
    .filter((t: any) => t && typeof t.title === "string" && t.title.trim())
    .map((t: any) => ({
      title: String(t.title).trim(),
      description: typeof t.description === "string" ? t.description.trim() : "",
      priority: ["LOW", "MEDIUM", "HIGH"].includes(t.priority) ? t.priority : "MEDIUM",
      subtasks: Array.isArray(t.subtasks)
        ? t.subtasks
            .filter((s: any) => typeof s === "string" && s.trim())
            .map((s: any) => s.trim())
            .slice(0, 12)
        : [],
      // Only trust an assigneeId that is actually in the roster we sent.
      assigneeId: typeof t.assigneeId === "string" && validIds.has(t.assigneeId) ? t.assigneeId : "",
      assigneeName: typeof t.assigneeName === "string" ? t.assigneeName.trim() : "",
    })) as DraftTask[];
}

// ---------------------------------------------------------------------------
// Refine a single task ("Fix with AI"). Meeting drafts from non-native English
// speakers often need big corrections; the user gives a short instruction in
// their own words and Claude returns the fully rewritten task.
// ---------------------------------------------------------------------------

export interface RefinableTask {
  title: string;
  description: string;
  priority: "LOW" | "MEDIUM" | "HIGH";
  subtasks: string[];
}

const REFINE_SCHEMA = {
  type: "object",
  additionalProperties: false,
  properties: {
    title: { type: "string" },
    description: { type: "string" },
    priority: { type: "string", enum: ["LOW", "MEDIUM", "HIGH"] },
    subtasks: { type: "array", items: { type: "string" } },
  },
  required: ["title", "description", "priority", "subtasks"],
} as const;

const REFINE_SYSTEM = `You clean up and correct a single project-management task. The task was drafted from an auto-transcribed meeting held largely in non-native English, so wording, names and grammar are often rough.
Apply the user's correction instruction, then rewrite the task into clear, professional, concise English:
- title: short outcome-focused imperative.
- description: 1-3 tidy sentences of context.
- priority: LOW, MEDIUM or HIGH — only change it if the instruction implies a different urgency.
- subtasks: keep concrete verb-noun steps; add, remove or reorder only as the instruction requires.
Rules: follow the user's instruction faithfully; fix spelling/grammar/clarity throughout; preserve the task's original intent unless the instruction changes it; never invent facts, dates, names or numbers that are not in the task or the instruction. Return the complete corrected task.`;

/**
 * Rewrite one task according to a free-text correction instruction. Returns the
 * fully corrected task (all fields), leaving it to the caller to apply.
 */
export async function refineTask(
  task: RefinableTask,
  instruction: string
): Promise<RefinableTask> {
  if (!ANTHROPIC_API_KEY) throw new Error("ANTHROPIC_API_KEY is not configured");

  const userContent = `Current task (JSON):
${JSON.stringify(
    {
      title: task.title,
      description: task.description,
      priority: task.priority,
      subtasks: task.subtasks,
    },
    null,
    2
  )}

Correction instruction from the user:
${instruction}`;

  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "x-api-key": ANTHROPIC_API_KEY,
      "anthropic-version": "2023-06-01",
      "content-type": "application/json",
    },
    body: JSON.stringify({
      model: ANTHROPIC_MODEL,
      max_tokens: 2048,
      system: REFINE_SYSTEM,
      messages: [{ role: "user", content: userContent }],
      output_config: {
        effort: "low",
        format: { type: "json_schema", schema: REFINE_SCHEMA },
      },
    }),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Anthropic API ${res.status}: ${text.slice(0, 300)}`);
  }

  const data = await res.json();
  if (data.stop_reason === "refusal") {
    throw new Error("The model declined to process this task.");
  }
  const textBlock = (data.content || []).find((b: any) => b.type === "text");
  if (!textBlock?.text) throw new Error("Claude returned no content.");

  let parsed: any;
  try {
    parsed = JSON.parse(textBlock.text);
  } catch {
    throw new Error("Claude returned malformed JSON.");
  }

  return {
    title: typeof parsed?.title === "string" && parsed.title.trim() ? parsed.title.trim() : task.title,
    description: typeof parsed?.description === "string" ? parsed.description.trim() : task.description,
    priority: ["LOW", "MEDIUM", "HIGH"].includes(parsed?.priority) ? parsed.priority : task.priority,
    subtasks: Array.isArray(parsed?.subtasks)
      ? parsed.subtasks
          .filter((s: any) => typeof s === "string" && s.trim())
          .map((s: any) => s.trim())
          .slice(0, 12)
      : task.subtasks,
  };
}

// ---------------------------------------------------------------------------
// Proofread a comment. Fixes spelling/grammar for non-native English writers
// (feedback: GM Fafa's comments are hard to read) WITHOUT changing meaning,
// tone, or the writer's own words beyond what's needed for clarity.
// ---------------------------------------------------------------------------

const PROOFREAD_SCHEMA = {
  type: "object",
  additionalProperties: false,
  properties: { corrected: { type: "string" } },
  required: ["corrected"],
} as const;

const PROOFREAD_SYSTEM = `You are a careful proofreader for a work chat between colleagues, many of whom are non-native English speakers.
Given a comment, return a corrected version that fixes spelling, grammar, punctuation and word order so it reads clearly and professionally.
Rules:
- Preserve the original meaning exactly. Never add, remove or invent information, facts, names or numbers.
- Keep it roughly the same length and the same friendly, plain register — do not make it formal, verbose or robotic.
- Keep @mentions (e.g. @John Smith), URLs, numbers and any names exactly as written.
- If the text is already correct, return it unchanged.
- Output only the corrected comment text.`;

/**
 * Return a spelling/grammar-corrected version of a comment. Falls back to the
 * original text if the model returns nothing usable.
 */
export async function proofreadText(text: string): Promise<string> {
  if (!ANTHROPIC_API_KEY) throw new Error("ANTHROPIC_API_KEY is not configured");

  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "x-api-key": ANTHROPIC_API_KEY,
      "anthropic-version": "2023-06-01",
      "content-type": "application/json",
    },
    body: JSON.stringify({
      model: ANTHROPIC_MODEL,
      max_tokens: 1024,
      system: PROOFREAD_SYSTEM,
      messages: [{ role: "user", content: `Comment to proofread:\n\n${text}` }],
      output_config: {
        effort: "low",
        format: { type: "json_schema", schema: PROOFREAD_SCHEMA },
      },
    }),
  });

  if (!res.ok) {
    const t = await res.text();
    throw new Error(`Anthropic API ${res.status}: ${t.slice(0, 300)}`);
  }

  const data = await res.json();
  if (data.stop_reason === "refusal") {
    throw new Error("The model declined to proofread this comment.");
  }
  const textBlock = (data.content || []).find((b: any) => b.type === "text");
  if (!textBlock?.text) throw new Error("Claude returned no content.");

  let parsed: any;
  try {
    parsed = JSON.parse(textBlock.text);
  } catch {
    throw new Error("Claude returned malformed JSON.");
  }

  return typeof parsed?.corrected === "string" && parsed.corrected.trim()
    ? parsed.corrected.trim()
    : text;
}

// ---------------------------------------------------------------------------
// Task archive summary (v1.10): when a DONE task is archived to Drive, Claude
// writes the executive summary that tops the archive document.

const ARCHIVE_SCHEMA = {
  type: "object",
  additionalProperties: false,
  properties: {
    summary: { type: "string" },
    outcome: { type: "string" },
    keyPoints: { type: "array", items: { type: "string" } },
  },
  required: ["summary", "outcome", "keyPoints"],
} as const;

const ARCHIVE_SYSTEM = `You summarize a completed project-management task for a permanent archive document. The readers are future teammates checking "what happened with this?" months later. Using ONLY the provided task data:
- summary: 2-4 plain sentences — what this task was about and what was done. No fluff, no marketing tone.
- outcome: one sentence stating the end result or deliverable (e.g. what was shipped, decided, fixed, or produced).
- keyPoints: 0-8 short bullet points capturing decisions, important facts, numbers, links, or agreements found in the description and comments that are worth keeping. Skip greetings, chit-chat and status pings. Never invent facts.
Write in simple English readable by non-native speakers.`;

export interface ArchiveSummary {
  summary: string;
  outcome: string;
  keyPoints: string[];
}

export async function summarizeTaskForArchive(taskDump: string): Promise<ArchiveSummary> {
  if (!ANTHROPIC_API_KEY) throw new Error("ANTHROPIC_API_KEY is not configured");

  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "x-api-key": ANTHROPIC_API_KEY,
      "anthropic-version": "2023-06-01",
      "content-type": "application/json",
    },
    body: JSON.stringify({
      model: ANTHROPIC_MODEL,
      max_tokens: 1500,
      system: ARCHIVE_SYSTEM,
      messages: [{ role: "user", content: `Task to summarize for the archive:\n\n${taskDump.slice(0, 60000)}` }],
      output_config: {
        effort: "low",
        format: { type: "json_schema", schema: ARCHIVE_SCHEMA },
      },
    }),
  });

  if (!res.ok) {
    const t = await res.text();
    throw new Error(`Anthropic API ${res.status}: ${t.slice(0, 300)}`);
  }

  const data = await res.json();
  if (data.stop_reason === "refusal") {
    throw new Error("The model declined to summarize this task.");
  }
  const textBlock = (data.content || []).find((b: any) => b.type === "text");
  if (!textBlock?.text) throw new Error("Claude returned no content.");
  const parsed = JSON.parse(textBlock.text);
  return {
    summary: String(parsed.summary || ""),
    outcome: String(parsed.outcome || ""),
    keyPoints: Array.isArray(parsed.keyPoints) ? parsed.keyPoints.map(String) : [],
  };
}
