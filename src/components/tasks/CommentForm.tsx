"use client";

import { useState } from "react";

interface CommentFormProps {
  taskId: string;
  onCommentAdded?: () => void;
}

export function CommentForm({ taskId, onCommentAdded }: CommentFormProps) {
  const [body, setBody] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    console.log("Comment form submitted, body:", body);

    if (!body.trim()) {
      console.log("Comment is empty, aborting");
      setError("Comment cannot be empty");
      return;
    }

    setLoading(true);
    setError(null);

    try {
      console.log("Posting comment to /api/tasks/" + taskId + "/comments");
      const response = await fetch(`/api/tasks/${taskId}/comments`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ body }),
      });

      console.log("Comment response:", response.status);
      if (!response.ok) {
        const errText = await response.text();
        throw new Error(`Failed to create comment: ${errText}`);
      }

      setBody("");
      console.log("Comment posted successfully");
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
      <textarea
        value={body}
        onChange={(e) => setBody(e.target.value)}
        placeholder="Add a comment..."
        className="w-full border border-gray-300 rounded p-2 text-sm focus:outline-none focus:border-blue-600 focus:ring-1 focus:ring-blue-600"
        rows={2}
        disabled={loading}
      />

      {error && <p className="text-xs text-red-600">{error}</p>}

      <button
        type="submit"
        disabled={loading || !body.trim()}
        className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white font-semibold py-2 px-4 rounded text-sm transition"
      >
        {loading ? "Posting..." : "Post Comment"}
      </button>
    </form>
  );
}
