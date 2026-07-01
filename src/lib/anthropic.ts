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
}

export function anthropicEnabled(): boolean {
  return !!ANTHROPIC_API_KEY;
}

// JSON Schema for the model's output. Kept within the structured-outputs subset
// (object types, enum, array; every object has additionalProperties:false + required).
const TASKS_SCHEMA = {
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
        },
        required: ["title", "description", "priority", "subtasks"],
      },
    },
  },
  required: ["tasks"],
} as const;

const SYSTEM_PROMPT = `You turn meeting transcripts into an organized, actionable task list for a project-management board.
Extract only real action items and decisions that imply follow-up work. For each task:
- title: a short outcome-focused imperative (e.g. "Set up SEO tracking for touristpharmacy.com").
- description: 1-3 sentences of context taken from the transcript — the what and the why. Never invent facts, dates, names, or numbers that are not in the transcript.
- priority: LOW, MEDIUM, or HIGH based on the urgency expressed in the meeting (default MEDIUM).
- subtasks: 0-6 concrete verb-noun steps when the task clearly breaks down; otherwise an empty array.
Ignore chit-chat, FYI status updates with no follow-up, and anything that isn't actionable. If there are no action items at all, return an empty tasks array.`;

/**
 * Extract a draft task list from a raw meeting transcript. Returns a preview only —
 * the caller decides which tasks to actually create.
 */
export async function transcriptToTasks(transcript: string): Promise<DraftTask[]> {
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
      max_tokens: 4096,
      system: SYSTEM_PROMPT,
      messages: [{ role: "user", content: `Meeting transcript:\n\n${transcript}` }],
      output_config: {
        effort: "low", // extraction task — keep it fast and cheap
        format: { type: "json_schema", schema: TASKS_SCHEMA },
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
    })) as DraftTask[];
}
