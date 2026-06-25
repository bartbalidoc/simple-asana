"use client";

import { useEffect, useState, useCallback } from "react";

interface Feedback {
  id: string;
  rawText: string;
  pageContext?: string | null;
  url?: string | null;
  title?: string | null;
  category?: string | null;
  complexity?: string | null;
  summary?: string | null;
  aiProcessed: boolean;
  status: string;
  triageNotes?: string | null;
  resolvedCommit?: string | null;
  createdAt: string;
  submittedBy?: { email: string; name: string } | null;
}

const STATUSES = ["NEW", "TRIAGED", "FIXED", "NEEDS_OWNER", "WONT_FIX"];
const statusColors: Record<string, string> = {
  NEW: "bg-blue-100 text-blue-800",
  TRIAGED: "bg-yellow-100 text-yellow-800",
  FIXED: "bg-green-100 text-green-800",
  NEEDS_OWNER: "bg-red-100 text-red-800",
  WONT_FIX: "bg-gray-100 text-gray-600",
};

export default function FeedbackAdminPage() {
  const [items, setItems] = useState<Feedback[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/admin/feedback${filter ? `?status=${filter}` : ""}`);
      if (res.ok) {
        const data = await res.json();
        setItems(data.feedback || []);
      }
    } finally {
      setLoading(false);
    }
  }, [filter]);

  useEffect(() => {
    load();
  }, [load]);

  const setStatus = async (id: string, status: string) => {
    setItems((prev) => prev.map((f) => (f.id === id ? { ...f, status } : f)));
    await fetch("/api/admin/feedback", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, status }),
    });
  };

  const needsOwner = items.filter((f) => f.status === "NEEDS_OWNER");

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-2xl font-bold text-gray-900">Feedback</h2>
        <select
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          className="border border-gray-300 rounded px-3 py-1.5 text-sm focus:outline-none focus:border-red-500"
        >
          <option value="">All statuses</option>
          {STATUSES.map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </select>
      </div>

      {!filter && needsOwner.length > 0 && (
        <div className="mb-6 border border-red-300 bg-red-50 rounded-lg p-4">
          <h3 className="font-semibold text-red-800 mb-3">
            ⚠ Needs your attention ({needsOwner.length})
          </h3>
          <div className="space-y-3">
            {needsOwner.map((f) => (
              <div key={f.id} className="bg-white rounded p-3 border border-red-200">
                <div className="font-medium text-gray-900 break-words">
                  {f.title || f.rawText.slice(0, 90)}
                </div>
                {f.summary && <div className="text-sm text-gray-600 break-words">{f.summary}</div>}
                {f.triageNotes && (
                  <div className="text-sm text-red-700 mt-1 break-words">🔧 {f.triageNotes}</div>
                )}
                <div className="text-xs text-gray-400 mt-1">
                  from {f.submittedBy?.name || f.submittedBy?.email || "?"} ·{" "}
                  {new Date(f.createdAt).toLocaleString()}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {loading ? (
        <div className="text-gray-500">Loading…</div>
      ) : items.length === 0 ? (
        <div className="bg-white rounded-lg shadow p-6 text-gray-600">No feedback yet.</div>
      ) : (
        <div className="space-y-3">
          {items.map((f) => (
            <div key={f.id} className="bg-white rounded-lg shadow p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 flex-wrap mb-1">
                    <span
                      className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded ${
                        statusColors[f.status] || "bg-gray-100"
                      }`}
                    >
                      {f.status}
                    </span>
                    {f.category && (
                      <span className="text-[10px] text-gray-500 bg-gray-100 px-2 py-0.5 rounded">
                        {f.category}
                      </span>
                    )}
                    {f.complexity && <span className="text-[10px] text-gray-500">{f.complexity}</span>}
                    {!f.aiProcessed && <span className="text-[10px] text-amber-600">raw (no AI)</span>}
                  </div>
                  <div className="font-medium text-gray-900 break-words">
                    {f.title || "Untitled feedback"}
                  </div>
                  {f.summary && <div className="text-sm text-gray-600 break-words">{f.summary}</div>}
                  <details className="mt-1">
                    <summary className="text-xs text-gray-400 cursor-pointer">show raw feedback</summary>
                    <p className="text-sm text-gray-700 whitespace-pre-wrap break-words mt-1">{f.rawText}</p>
                  </details>
                  {f.triageNotes && (
                    <div className="text-sm text-gray-700 mt-1 break-words">🔧 {f.triageNotes}</div>
                  )}
                  <div className="text-xs text-gray-400 mt-1 break-words">
                    {f.submittedBy?.email} · {f.url || f.pageContext || "—"} ·{" "}
                    {new Date(f.createdAt).toLocaleString()}
                  </div>
                </div>
                <select
                  value={f.status}
                  onChange={(e) => setStatus(f.id, e.target.value)}
                  className="border border-gray-300 rounded px-2 py-1 text-xs flex-shrink-0"
                >
                  {STATUSES.map((s) => (
                    <option key={s} value={s}>
                      {s}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
