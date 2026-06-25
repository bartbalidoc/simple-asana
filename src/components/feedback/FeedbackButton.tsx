"use client";

import { useState } from "react";
import { useSession } from "next-auth/react";

interface Msg {
  role: "user" | "assistant";
  content: string;
}

interface Structured {
  title: string;
  category: string;
  complexity: string;
  summary: string;
}

// Admin-only floating "Feedback" button. Opens a small chat where an AI asks
// clarifying questions until the request is clear, then saves it to the Feedback
// table. "Save now" is always available as an escape hatch, and saving never
// depends on the AI succeeding.
export function FeedbackButton() {
  const { data: session } = useSession();
  const isAdmin = (session?.user as any)?.role === "ADMIN";

  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<Msg[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);
  const [structured, setStructured] = useState<Structured | null>(null);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isAdmin) return null;

  const reset = () => {
    setMessages([]);
    setInput("");
    setLoading(false);
    setDone(false);
    setStructured(null);
    setSaving(false);
    setSaved(false);
    setError(null);
  };
  const close = () => {
    setOpen(false);
    reset();
  };

  const send = async () => {
    const text = input.trim();
    if (!text || loading) return;
    const next: Msg[] = [...messages, { role: "user", content: text }];
    setMessages(next);
    setInput("");
    setLoading(true);
    setError(null);
    try {
      const url = typeof window !== "undefined" ? window.location.pathname : undefined;
      const res = await fetch("/api/feedback/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: next, pageContext: url }),
      });
      const data = await res.json();
      setMessages([...next, { role: "assistant", content: data.message || "Thanks." }]);
      if (data.done) {
        setDone(true);
        if (data.title) {
          setStructured({
            title: data.title,
            category: data.category,
            complexity: data.complexity,
            summary: data.summary,
          });
        }
      }
    } catch {
      setError("Couldn't reach the assistant — you can still save your feedback below.");
      setDone(true);
    } finally {
      setLoading(false);
    }
  };

  const save = async () => {
    const firstUser = messages.find((m) => m.role === "user");
    const rawText = firstUser?.content || input.trim();
    if (!rawText) {
      setError("Please write your feedback first.");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const res = await fetch("/api/feedback", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          rawText,
          conversation: JSON.stringify(messages),
          pageContext: typeof document !== "undefined" ? document.title : undefined,
          url: typeof window !== "undefined" ? window.location.pathname : undefined,
          ...(structured || {}),
        }),
      });
      if (!res.ok) throw new Error();
      setSaved(true);
    } catch {
      setError("Failed to save. Please try again.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="fixed bottom-5 right-5 z-40 bg-red-600 hover:bg-red-700 text-white font-semibold text-sm px-4 py-2.5 rounded-full shadow-lg transition"
        title="Give feedback about the app"
      >
        💬 Feedback
      </button>

      {open && (
        <div
          className="fixed inset-0 z-50 bg-black/40 flex items-end sm:items-center justify-center p-4"
          onClick={close}
        >
          <div
            className="bg-white rounded-xl shadow-xl w-full max-w-md max-h-[85vh] flex flex-col"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between p-4 border-b">
              <h3 className="font-semibold text-gray-900">Give feedback</h3>
              <button onClick={close} className="text-gray-400 hover:text-gray-600 text-2xl leading-none">
                ×
              </button>
            </div>

            {saved ? (
              <div className="p-6 text-center space-y-3">
                <div className="text-3xl">✅</div>
                <p className="text-gray-800 font-medium">Thanks — your feedback was saved.</p>
                <p className="text-sm text-gray-500">
                  We&apos;ll review it and get the small things fixed quickly.
                </p>
                <button
                  onClick={close}
                  className="mt-2 bg-gray-100 hover:bg-gray-200 text-gray-800 px-4 py-2 rounded text-sm"
                >
                  Close
                </button>
              </div>
            ) : (
              <>
                <div className="flex-1 overflow-y-auto p-4 space-y-3">
                  {messages.length === 0 && (
                    <p className="text-sm text-gray-500">
                      Tell me what&apos;s broken or what you&apos;d like changed. I&apos;ll ask a couple of
                      quick questions to make it clear, then save it.
                    </p>
                  )}
                  {messages.map((m, i) => (
                    <div key={i} className={m.role === "user" ? "text-right" : "text-left"}>
                      <span
                        className={`inline-block px-3 py-2 rounded-lg text-sm break-words max-w-[85%] ${
                          m.role === "user" ? "bg-red-600 text-white" : "bg-gray-100 text-gray-800"
                        }`}
                      >
                        {m.content}
                      </span>
                    </div>
                  ))}
                  {loading && <p className="text-xs text-gray-400">Assistant is thinking…</p>}
                  {structured && (
                    <div className="mt-2 bg-gray-50 border rounded-lg p-3 text-xs text-gray-600">
                      <div className="font-medium text-gray-800">{structured.title}</div>
                      <div>{structured.summary}</div>
                      <div className="mt-1 text-gray-400">
                        {structured.category} · {structured.complexity}
                      </div>
                    </div>
                  )}
                  {error && <p className="text-xs text-red-600">{error}</p>}
                </div>

                <div className="p-3 border-t space-y-2">
                  {!done && (
                    <textarea
                      value={input}
                      onChange={(e) => setInput(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" && !e.shiftKey) {
                          e.preventDefault();
                          send();
                        }
                      }}
                      rows={2}
                      placeholder={messages.length === 0 ? "Describe the issue or idea…" : "Type your answer…"}
                      className="w-full border border-gray-300 rounded p-2 text-sm focus:outline-none focus:border-red-500 resize-none"
                      disabled={loading}
                    />
                  )}
                  <div className="flex gap-2">
                    {!done && (
                      <button
                        onClick={send}
                        disabled={loading || !input.trim()}
                        className="flex-1 bg-red-600 hover:bg-red-700 disabled:bg-red-300 text-white text-sm font-semibold py-2 rounded transition"
                      >
                        {messages.length === 0 ? "Start" : "Send"}
                      </button>
                    )}
                    <button
                      onClick={save}
                      disabled={saving || messages.length === 0}
                      className={`${
                        done ? "flex-1" : ""
                      } bg-gray-800 hover:bg-gray-900 disabled:bg-gray-400 text-white text-sm font-semibold py-2 px-4 rounded transition`}
                    >
                      {saving ? "Saving…" : done ? "Save feedback" : "Save now"}
                    </button>
                  </div>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </>
  );
}
