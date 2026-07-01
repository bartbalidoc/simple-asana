"use client";

import { useState, useRef, useLayoutEffect } from "react";

interface Member {
  id: string;
  name: string;
  email?: string;
}

interface CommentFormProps {
  taskId: string;
  members?: Member[];
  onCommentAdded?: () => void;
}

export function CommentForm({ taskId, members = [], onCommentAdded }: CommentFormProps) {
  const [body, setBody] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // @mention autocomplete state
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const [mentionQuery, setMentionQuery] = useState<string | null>(null);
  const [activeIndex, setActiveIndex] = useState(0);

  // Auto-grow the comment box to fit its content (feedback #2): expand as the
  // user types, up to a max height, then scroll. Runs on every `body` change,
  // which covers typing, mention insertion, and clearing after submit.
  const MAX_TEXTAREA_HEIGHT = 260; // px — roughly a dozen lines before scrolling
  useLayoutEffect(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = "auto"; // reset so shrinking works too
    const next = Math.min(el.scrollHeight, MAX_TEXTAREA_HEIGHT);
    el.style.height = `${next}px`;
    el.style.overflowY = el.scrollHeight > MAX_TEXTAREA_HEIGHT ? "auto" : "hidden";
  }, [body]);

  const suggestions =
    mentionQuery === null
      ? []
      : members
          .filter((m) => {
            const q = mentionQuery.toLowerCase();
            return (
              m.name.toLowerCase().includes(q) ||
              (m.email || "").toLowerCase().includes(q)
            );
          })
          .slice(0, 6);

  // Look at the text just before the cursor to decide whether the user is
  // typing an @mention (an "@" followed by word characters, not mid-word).
  const updateMentionState = (value: string, cursor: number) => {
    const before = value.slice(0, cursor);
    const match = before.match(/(?:^|\s)@(\w*)$/);
    if (match) {
      setMentionQuery(match[1]);
      setActiveIndex(0);
    } else {
      setMentionQuery(null);
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const value = e.target.value;
    setBody(value);
    updateMentionState(value, e.target.selectionStart ?? value.length);
  };

  const insertMention = (member: Member) => {
    const el = textareaRef.current;
    const cursor = el?.selectionStart ?? body.length;
    const before = body.slice(0, cursor).replace(/@(\w*)$/, `@${member.name} `);
    const after = body.slice(cursor);
    const newBody = before + after;
    setBody(newBody);
    setMentionQuery(null);
    // Restore focus and put the cursor right after the inserted mention.
    requestAnimationFrame(() => {
      if (el) {
        el.focus();
        el.selectionStart = el.selectionEnd = before.length;
      }
    });
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (mentionQuery === null || suggestions.length === 0) return;

    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActiveIndex((i) => (i + 1) % suggestions.length);
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActiveIndex((i) => (i - 1 + suggestions.length) % suggestions.length);
    } else if (e.key === "Enter" || e.key === "Tab") {
      e.preventDefault();
      insertMention(suggestions[activeIndex]);
    } else if (e.key === "Escape") {
      setMentionQuery(null);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!body.trim()) {
      setError("Comment cannot be empty");
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const response = await fetch(`/api/tasks/${taskId}/comments`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ body }),
      });

      if (!response.ok) {
        const errText = await response.text();
        throw new Error(`Failed to create comment: ${errText}`);
      }

      setBody("");
      setMentionQuery(null);
      onCommentAdded?.();
    } catch (err) {
      console.error("Comment error:", err);
      setError(err instanceof Error ? err.message : "Failed to create comment");
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-2">
      <div className="relative">
        <textarea
          ref={textareaRef}
          value={body}
          onChange={handleChange}
          onKeyDown={handleKeyDown}
          placeholder="Add a comment... (use @ to mention a teammate)"
          className="w-full border border-gray-300 rounded p-2 text-sm resize-none focus:outline-none focus:border-red-500 focus:ring-1 focus:ring-blue-600"
          style={{ minHeight: "3.5rem" }}
          disabled={loading}
        />

        {mentionQuery !== null && suggestions.length > 0 && (
          <ul className="absolute z-10 left-0 right-0 mt-1 bg-white border border-gray-200 rounded shadow-lg max-h-48 overflow-y-auto text-sm">
            {suggestions.map((m, i) => (
              <li key={m.id}>
                <button
                  type="button"
                  // onMouseDown (not onClick) so the textarea doesn't blur first.
                  onMouseDown={(e) => {
                    e.preventDefault();
                    insertMention(m);
                  }}
                  className={`w-full text-left px-3 py-2 ${
                    i === activeIndex ? "bg-red-50" : "hover:bg-gray-50"
                  }`}
                >
                  <span className="font-medium text-gray-900">{m.name}</span>
                  {m.email && (
                    <span className="text-gray-500 ml-1 text-xs">{m.email}</span>
                  )}
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      {error && <p className="text-xs text-red-600">{error}</p>}

      <button
        type="submit"
        disabled={loading || !body.trim()}
        className="w-full bg-red-600 hover:bg-red-700 disabled:bg-red-300 text-white font-semibold py-2 px-4 rounded text-sm transition"
      >
        {loading ? "Posting..." : "Post Comment"}
      </button>
    </form>
  );
}
