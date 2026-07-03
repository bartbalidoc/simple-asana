import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { NextRequest, NextResponse } from "next/server";

const OPENAI_API_KEY = process.env.OPENAI_API_KEY;

export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    if (!OPENAI_API_KEY) {
      return NextResponse.json(
        { error: "AI service not configured" },
        { status: 503 }
      );
    }

    const body = await req.json();
    const { answers, skipped, questions } = body;

    // Build context: only include answered questions
    const answeredQuestions = questions
      .filter((q: any) => answers[q.id]?.trim())
      .map((q: any) => `**${q.label}**\n${answers[q.id]}`);

    const answersText = answeredQuestions.join("\n\n");

    // Field mapping (question ids): 1=task name, 2=objective, 3=problem,
    // 4=stakeholders, 5=acceptance criteria, 6=blockers, 7=complexity, 8=automation
    const taskName = answers[1]?.trim() ? `\nTask name (use this as the title): ${answers[1]}` : "";
    const problem = answers[3]?.trim() ? `\nProblem / current situation: ${answers[3]}` : "";
    const stakeholders = answers[4]?.trim() ? `\nKey stakeholders: ${answers[4]}` : "";
    const acceptanceCriteria = answers[5]?.trim()
      ? `\nAcceptance criteria: ${answers[5]}`
      : "";
    const blockers = answers[6]?.trim() ? `\nPotential blockers/dependencies: ${answers[6]}` : "";
    const complexity = answers[7]?.trim() ? `\nEstimated complexity: ${answers[7]}` : "";
    const automation = answers[8]?.trim() ? `\nAutomation idea from the user: ${answers[8]}` : "";

    const prompt = `You are a Scrum PM at an automation-focused team creating a clear, deliverable-focused task. Use this discovery:

${answersText}${taskName}${problem}${stakeholders}${acceptanceCriteria}${blockers}${complexity}${automation}

Your job:
1. Use the provided task name as the "title" verbatim (do not rewrite it).
2. Write a PROFESSIONAL task description that:
   - Opens with the core objective (the "why" and "what")
   - Summarizes the problem / current situation if provided
   - Includes stakeholders if relevant
   - Lists acceptance criteria if provided
   - Mentions key dependencies if any
3. Generate 5-8 CONCRETE subtasks in verb-noun format that break down the actual deliverable work
4. If the discovery mentions automation, distill a short "automationOpportunity" note (1-2 sentences: the manual step today and what it should become). If automation is NOT mentioned, return an empty string for it.

RULES:
- Do NOT invent details, dates, or technical specs not in the discovery
- Do NOT use "Q2 2024" or vague timelines
- DO use exact information from the discovery
- DO make subtasks small, actionable, and testable ("Implement X", "Review Y with Z", "Document A")
- If automation is in scope, DO include automation-oriented subtasks (e.g. "Identify the trigger event", "Connect systems via API", "Test an automated run end-to-end")
- DO group related work logically
- DO consider the complexity estimate when sizing subtasks

Respond ONLY with valid JSON (no markdown, no explanation, just JSON):
{
  "title": "Outcome-focused title",
  "description": "Professional description with objective, stakeholders (if any), acceptance criteria (if any), and key dependencies (if any)",
  "subtasks": [
    "Verb-noun subtask 1",
    "Verb-noun subtask 2",
    "Verb-noun subtask 3"
  ],
  "automationOpportunity": "Short note on what to automate, or empty string"
}`;


    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${OPENAI_API_KEY}`,
      },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        messages: [
          {
            role: "system",
            content:
              "You are a task management expert. Generate clear, actionable tasks based on user input. Output only valid JSON.",
          },
          {
            role: "user",
            content: prompt,
          },
        ],
        temperature: 0.7,
        max_tokens: 800,
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      console.error("OpenAI API error:", error);
      return NextResponse.json(
        { error: "Failed to generate task" },
        { status: 500 }
      );
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content;

    if (!content) {
      throw new Error("No content from AI");
    }


    // Parse the JSON response
    const parsed = JSON.parse(content);

    if (!parsed.title || !parsed.description || !parsed.subtasks) {
      throw new Error("Invalid AI response format");
    }

    return NextResponse.json({
      title: parsed.title,
      description: parsed.description,
      subtasks: parsed.subtasks,
      automationOpportunity: parsed.automationOpportunity || "",
    });
  } catch (error) {
    console.error("POST /api/ai/generate-task-with-subtasks error:", error);
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Failed to generate task",
      },
      { status: 500 }
    );
  }
}
