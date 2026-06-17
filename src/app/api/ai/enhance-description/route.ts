import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { NextRequest, NextResponse } from "next/server";

const OPENAI_API_KEY = process.env.OPENAI_API_KEY;

const PROMPTS: Record<string, string> = {
  problem:
    "Improve this problem statement. Make it specific, measurable, and action-oriented. Fix grammar and clarity. Make it compelling so someone reading it understands the impact. Keep it under 3 sentences. Return only the improved text.",
  currentWorkflow:
    "Improve this workflow description. Make it clear, specific, and step-by-step. Remove vagueness. Fix grammar. Assume the reader has no context. Keep it under 4 sentences. Return only the improved text.",
  desiredImprovement:
    "Improve this improvement statement. Make it specific, measurable, and outcome-focused. What's the concrete result? Fix grammar and clarity. Keep it under 3 sentences. Return only the improved text.",
  automationOpportunity:
    "Improve this automation opportunity description. Make it specific about what could be automated and why. Be concrete. Fix grammar and clarity. Keep it under 4 sentences. Return only the improved text.",
  title:
    "Improve this task title. Make it action-oriented, specific, and scannable. Use strong action verbs. Fix grammar. Keep it concise (under 10 words). Return only the improved text.",
  description:
    "Improve this description. Make it clear, specific, and well-structured. Fix grammar and punctuation. Add clarity where needed. Keep the same length roughly. Return only the improved text.",
};

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
    const { fieldType, text } = body;

    if (!fieldType || !text) {
      return NextResponse.json(
        { error: "fieldType and text are required" },
        { status: 400 }
      );
    }

    const systemPrompt = PROMPTS[fieldType] || PROMPTS.problem;

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
            content: systemPrompt,
          },
          {
            role: "user",
            content: text,
          },
        ],
        max_tokens: 500,
        temperature: 0.7,
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      console.error("OpenAI API error:", error);
      return NextResponse.json(
        { error: "Failed to enhance description" },
        { status: 500 }
      );
    }

    const data = await response.json();
    const enhanced = data.choices?.[0]?.message?.content || text;

    return NextResponse.json({ enhanced });
  } catch (error) {
    console.error("POST /api/ai/enhance-description error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
