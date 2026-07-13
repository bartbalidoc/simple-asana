import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { NextRequest, NextResponse } from "next/server";

const OPENAI_API_KEY = process.env.OPENAI_API_KEY;

// Conversational feedback intake: the assistant asks short clarifying questions
// one at a time until the request is clear enough to act on, then returns a
// structured summary. Always returns a JSON object the client can act on; it
// never blocks the user from saving (graceful when AI is unavailable).
const SYSTEM_PROMPT = `You are a feedback intake assistant for an internal team web app called Plendex, by BaliDoc (a project & task manager). An admin is reporting feedback about the app — a bug, a request, or an idea.

Your job: ask SHORT, friendly clarifying questions, ONE at a time, until you clearly understand exactly what should change. Aim to learn: which page/feature it's about, what's wrong or desired, and what they expect to happen. Ask at most 3-4 questions total — don't over-ask. As soon as it's actionable, finish.

ALWAYS reply with ONE JSON object (no markdown), exactly this shape:
{
  "done": false,
  "message": "your next short question, OR a one-line confirmation when finishing",
  "title": null,
  "category": null,
  "complexity": null,
  "summary": null
}

While gathering info: "done" = false and "message" = your next single question (title/category/complexity/summary stay null).
When you have enough to act: "done" = true, "message" = a brief confirmation like "Got it — ready to save.", and fill:
- "title": a short headline, under 8 words
- "category": one of BUG, FEATURE_REQUEST, UI_UX, PERFORMANCE, COPY_TEXT, OTHER
- "complexity": SIMPLE (copy/label/typo/tiny isolated UI tweak), COMPLEX (touches data, auth, logic, or multiple areas), or UNKNOWN if unsure
- "summary": 1-2 sentences stating exactly what to change, concrete enough for a developer to act on`;

export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const { messages, pageContext } = body as {
      messages?: { role: string; content: string }[];
      pageContext?: string;
    };

    if (!Array.isArray(messages) || messages.length === 0) {
      return NextResponse.json({ error: "messages is required" }, { status: 400 });
    }

    // Graceful: with no key, let the user save as-is rather than blocking.
    if (!OPENAI_API_KEY) {
      return NextResponse.json({
        done: true,
        message: "AI help is unavailable right now — go ahead and save your feedback and we'll sort it.",
        title: null,
        category: null,
        complexity: null,
        summary: null,
      });
    }

    const chatMessages = [
      {
        role: "system",
        content:
          SYSTEM_PROMPT +
          (pageContext ? `\n\nThe user was on this page when they opened feedback: ${pageContext}` : ""),
      },
      ...messages.map((m) => ({
        role: m.role === "assistant" ? "assistant" : "user",
        content: String(m.content || ""),
      })),
    ];

    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${OPENAI_API_KEY}`,
      },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        messages: chatMessages,
        max_tokens: 400,
        temperature: 0.4,
        response_format: { type: "json_object" },
      }),
    });

    if (!response.ok) {
      console.error("OpenAI API error:", await response.text());
      return NextResponse.json({
        done: true,
        message: "I couldn't reach the AI just now — you can save your feedback as-is.",
        title: null,
        category: null,
        complexity: null,
        summary: null,
      });
    }

    const data = await response.json();
    let parsed: any = {};
    try {
      parsed = JSON.parse(data.choices?.[0]?.message?.content || "{}");
    } catch {
      parsed = {
        done: true,
        message: "Thanks — I'll save what you've written.",
      };
    }

    return NextResponse.json({
      done: !!parsed.done,
      message: typeof parsed.message === "string" ? parsed.message : "Could you tell me a bit more?",
      title: parsed.title ?? null,
      category: parsed.category ?? null,
      complexity: parsed.complexity ?? null,
      summary: parsed.summary ?? null,
    });
  } catch (error) {
    console.error("POST /api/feedback/chat error:", error);
    return NextResponse.json({
      done: true,
      message: "Something went wrong with the assistant — you can still save your feedback.",
      title: null,
      category: null,
      complexity: null,
      summary: null,
    });
  }
}
