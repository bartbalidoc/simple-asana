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

// ---------------------------------------------------------------------------
// SMART task breakdown (Phase 3, v2.9): turn a big or vague task into concrete,
// doable daily steps so "My Day" fills with things people can actually start.
//
// Two Claude calls, deliberately decoupled:
//   1. researchTaskForBreakdown — a web_search-enabled brainstorm + LIVE research
//      pass that returns free-text findings plus the real source URLs it used.
//   2. the structured pass below — turns the task + that briefing into SMART steps,
//      tips & tricks, and an emailable plan-of-approach report (json_schema).
// Keeping tools out of the structured call sidesteps the tool/structured-output
// incompatibility and keeps each request simple. This is the app's FIRST use of a
// server-side tool (web_search), so the research pass carries a small pause_turn
// resume loop, and web search is best-effort — if it's unavailable the breakdown
// still works from Claude's own knowledge.

export interface SmartStep {
  title: string; // the concrete action, a short imperative
  how: string; // plainly, how to do it
  where: string; // the tool, place, person, or resource to use
  doneWhen: string; // the measurable "done" condition
}
export interface ResearchFinding {
  title: string;
  detail: string;
  url: string; // "" when it came from general knowledge, not a web source
}
export interface SmartBreakdown {
  steps: SmartStep[];
  research: ResearchFinding[];
  tips: string[];
  report: string; // markdown plan-of-approach, emailable
}

const RESEARCH_SYSTEM = `You are a resourceful assistant helping a clinic team member actually DO a work task.
- Brainstorm the best real-world way to accomplish it from your own knowledge.
- Use the web_search tool to find current, concrete, practical information for THIS specific task: how-to guides, suppliers, tools, materials, real prices, examples, best practices. Prefer specific, actionable facts and real links over generic advice.
Then write a short, plain-English briefing a non-native English speaker can follow: the recommended approach, the key facts you found, and anything that would help someone start today. End with a "Sources:" list of the URLs you actually relied on. Stay focused on this one task.`;

// Run the research/brainstorm pass. `useWebSearch=false` is the fallback path when
// the web_search tool is unavailable (returns a pure brainstorm). Returns the
// briefing text and the deduped list of real sources the model searched.
async function researchTaskForBreakdown(
  taskDump: string,
  useWebSearch: boolean
): Promise<{ text: string; sources: { title: string; url: string }[] }> {
  const messages: any[] = [
    {
      role: "user",
      content: `Help me figure out how to do this task. Research it, then brief me:\n\n${taskDump.slice(0, 20000)}`,
    },
  ];
  const textParts: string[] = [];
  const seenUrls = new Set<string>();
  const sources: { title: string; url: string }[] = [];

  // web_search runs a server-side loop and can stop with pause_turn if it hits
  // its iteration cap — re-send to resume. Bound the loop so it always ends.
  let guard = 0;
  while (guard++ < 6) {
    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "x-api-key": ANTHROPIC_API_KEY as string,
        "anthropic-version": "2023-06-01",
        "content-type": "application/json",
      },
      body: JSON.stringify({
        model: ANTHROPIC_MODEL,
        max_tokens: 4096,
        system: RESEARCH_SYSTEM,
        messages,
        // web_search_20260209 needs Opus 4.8 (our default); no beta header, and
        // dynamic filtering is built in (do NOT also declare code_execution).
        ...(useWebSearch
          ? { tools: [{ type: "web_search_20260209", name: "web_search", max_uses: 5 }] }
          : {}),
        output_config: { effort: "medium" },
      }),
    });

    if (!res.ok) {
      const t = await res.text();
      throw new Error(`Anthropic API ${res.status}: ${t.slice(0, 300)}`);
    }

    const data = await res.json();
    if (data.stop_reason === "refusal") {
      throw new Error("The model declined to research this task.");
    }

    for (const b of data.content || []) {
      if (b?.type === "text" && b.text) textParts.push(b.text);
      // Collect the real URLs the search returned. On success `content` is a
      // list of web_search_result; on error it's a single error object — guard.
      if (b?.type === "web_search_tool_result" && Array.isArray(b.content)) {
        for (const r of b.content) {
          if (r?.type === "web_search_result" && r.url && !seenUrls.has(r.url)) {
            seenUrls.add(r.url);
            sources.push({ title: String(r.title || r.url), url: String(r.url) });
          }
        }
      }
    }

    if (data.stop_reason === "pause_turn") {
      messages.push({ role: "assistant", content: data.content });
      continue;
    }
    break; // end_turn (or any terminal reason) — done researching
  }

  return { text: textParts.join("\n\n").trim(), sources: sources.slice(0, 12) };
}

const SMART_SCHEMA = {
  type: "object",
  additionalProperties: false,
  properties: {
    steps: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        properties: {
          title: { type: "string" },
          how: { type: "string" },
          where: { type: "string" },
          doneWhen: { type: "string" },
        },
        required: ["title", "how", "where", "doneWhen"],
      },
    },
    research: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        properties: {
          title: { type: "string" },
          detail: { type: "string" },
          url: { type: "string" },
        },
        required: ["title", "detail", "url"],
      },
    },
    tips: { type: "array", items: { type: "string" } },
    report: { type: "string" },
  },
  required: ["steps", "research", "tips", "report"],
} as const;

const SMART_SYSTEM = `You are a project coach turning a work task into a concrete, doable daily plan for a clinic team member (often a non-native English speaker). Use ONLY the task details and the research briefing provided. Return:
- steps: 3-7 SMART steps to get this task done — Specific, Measurable, Achievable, Relevant, Time-bound. For each: title (a short imperative action), how (plainly how to do it), where (the tool, place, person, or resource to use), doneWhen (the concrete condition that means this step is finished). Order them so someone can start at step 1 today.
- research: 0-8 concrete findings from the briefing worth keeping — each a title, a one-line detail, and a source url. Use a url ONLY if it appears in the briefing's Sources; otherwise use an empty string.
- tips: 3-6 short, practical tips & tricks, including at least one on how AI can help with this task.
- report: a short plan-of-approach in Markdown the person could read or receive by email — a couple of sentences of framing, then the steps as a checklist, then the tips. Simple, encouraging, practical English.
Never invent facts, prices, names, or links that are not in the task or the briefing. Write in simple English readable by non-native speakers.`;

/**
 * Break a task into SMART, doable steps with live research, tips, and an emailable
 * plan-of-approach report. Preview only — the caller decides what to persist. Never
 * writes anything.
 */
export async function breakdownTaskToSmartSteps(taskDump: string): Promise<SmartBreakdown> {
  if (!ANTHROPIC_API_KEY) throw new Error("ANTHROPIC_API_KEY is not configured");

  // 1) Research + brainstorm. Web search is best-effort: if it's unavailable
  //    (e.g. not enabled on the key), fall back to a brainstorm-only pass so the
  //    feature still works; only give up on research if both attempts fail.
  let research: { text: string; sources: { title: string; url: string }[] } = {
    text: "",
    sources: [],
  };
  try {
    research = await researchTaskForBreakdown(taskDump, true);
  } catch {
    try {
      research = await researchTaskForBreakdown(taskDump, false);
    } catch {
      research = { text: "", sources: [] };
    }
  }

  const sourcesBlock = research.sources.length
    ? `\n\nSources found (title — url):\n${research.sources.map((s) => `${s.title} — ${s.url}`).join("\n")}`
    : "";
  const briefing = research.text
    ? `\n\nResearch briefing:\n${research.text.slice(0, 12000)}${sourcesBlock}`
    : "\n\n(No external research was available — plan from general knowledge.)";

  // 2) Structure into SMART steps + tips + emailable report.
  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "x-api-key": ANTHROPIC_API_KEY,
      "anthropic-version": "2023-06-01",
      "content-type": "application/json",
    },
    body: JSON.stringify({
      model: ANTHROPIC_MODEL,
      max_tokens: 3000,
      system: SMART_SYSTEM,
      messages: [
        { role: "user", content: `Task to break down:\n\n${taskDump.slice(0, 20000)}${briefing}` },
      ],
      output_config: {
        effort: "medium", // real reasoning for the plan, not the cheap extraction tier
        format: { type: "json_schema", schema: SMART_SCHEMA },
      },
    }),
  });

  if (!res.ok) {
    const t = await res.text();
    throw new Error(`Anthropic API ${res.status}: ${t.slice(0, 300)}`);
  }

  const data = await res.json();
  if (data.stop_reason === "refusal") {
    throw new Error("The model declined to break down this task.");
  }
  const textBlock = (data.content || []).find((b: any) => b.type === "text");
  if (!textBlock?.text) throw new Error("Claude returned no content.");

  let parsed: any;
  try {
    parsed = JSON.parse(textBlock.text);
  } catch {
    throw new Error("Claude returned malformed JSON.");
  }

  const str = (v: any) => (typeof v === "string" ? v.trim() : "");
  const steps: SmartStep[] = Array.isArray(parsed?.steps)
    ? parsed.steps
        .filter((s: any) => s && str(s.title))
        .map((s: any) => ({
          title: str(s.title),
          how: str(s.how),
          where: str(s.where),
          doneWhen: str(s.doneWhen),
        }))
        .slice(0, 10)
    : [];
  const findings: ResearchFinding[] = Array.isArray(parsed?.research)
    ? parsed.research
        .filter((r: any) => r && str(r.title))
        .map((r: any) => ({ title: str(r.title), detail: str(r.detail), url: str(r.url) }))
        .slice(0, 8)
    : [];
  const tips: string[] = Array.isArray(parsed?.tips)
    ? parsed.tips.filter((t: any) => typeof t === "string" && t.trim()).map((t: any) => t.trim()).slice(0, 8)
    : [];

  return { steps, research: findings, tips, report: str(parsed?.report) };
}
