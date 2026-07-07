"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";

interface LinkedTask {
  id: string;
  title: string;
  projectId: string;
  status: string;
}
interface PlannerItem {
  id: string;
  quadrant: "PRIORITY" | "TODO" | "CALL";
  title: string;
  done: boolean;
  rolledOver: boolean;
  order: number;
  task: LinkedTask | null;
}
interface MyTask {
  id: string;
  title: string;
  projectId?: string;
  status: string;
}

const todayStr = () => {
  const d = new Date();
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
};

const QUADRANT_META: Record<
  "PRIORITY" | "TODO" | "CALL",
  { title: string; hint: string; accent: string }
> = {
  PRIORITY: {
    title: "Priorities",
    hint: "Max 3 — today's high-impact work. Link one to a board task if it belongs there.",
    accent: "border-red-200 bg-red-50/40",
  },
  TODO: {
    title: "To-Do",
    hint: "Tactical micro-tasks and quick wins.",
    accent: "border-gray-200 bg-white",
  },
  CALL: {
    title: "Calls / Emails",
    hint: "People to reach today.",
    accent: "border-blue-200 bg-blue-50/30",
  },
};

// Personal Daily Dashboard (Sidney's request, minus gamification for now).
// Private to each user. Unfinished items roll over to the next day
// automatically; finished ones are archived at the day change.
export default function PlannerPage() {
  const date = todayStr();
  const [items, setItems] = useState<PlannerItem[]>([]);
  const [note, setNote] = useState("");
  const [noteStatus, setNoteStatus] = useState<"idle" | "saving" | "saved">("idle");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [inputs, setInputs] = useState<Record<string, string>>({});
  const [linkTask, setLinkTask] = useState("");
  const [myTasks, setMyTasks] = useState<MyTask[]>([]);
  const noteTimer = useRef<NodeJS.Timeout | null>(null);

  const load = useCallback(async () => {
    try {
      const res = await fetch(`/api/planner?date=${date}`);
      if (!res.ok) throw new Error("Couldn't load your planner.");
      const data = await res.json();
      setItems(Array.isArray(data.items) ? data.items : []);
      setNote(typeof data.note === "string" ? data.note : "");
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't load your planner.");
    } finally {
      setLoading(false);
    }
  }, [date]);

  useEffect(() => {
    load();
    // My open board tasks, for linking a Priority to a real task.
    fetch("/api/dashboard")
      .then((r) => (r.ok ? r.json() : { tasks: [] }))
      .then((d) =>
        setMyTasks(
          (d.tasks || []).filter((t: MyTask) => t.status !== "DONE").slice(0, 100)
        )
      )
      .catch(() => setMyTasks([]));
  }, [load]);

  const addItem = async (quadrant: "PRIORITY" | "TODO" | "CALL") => {
    const title = (inputs[quadrant] || "").trim();
    if (!title) return;
    const res = await fetch("/api/planner", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        quadrant,
        title,
        date,
        taskId: quadrant === "PRIORITY" && linkTask ? linkTask : undefined,
      }),
    });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setError(data.error || "Couldn't add that.");
      return;
    }
    setError(null);
    setInputs((prev) => ({ ...prev, [quadrant]: "" }));
    if (quadrant === "PRIORITY") setLinkTask("");
    load();
  };

  const toggle = async (item: PlannerItem) => {
    setItems((prev) =>
      prev.map((i) => (i.id === item.id ? { ...i, done: !i.done } : i))
    );
    await fetch("/api/planner", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: item.id, done: !item.done }),
    }).catch(() => {});
  };

  const dismiss = async (item: PlannerItem) => {
    setItems((prev) => prev.filter((i) => i.id !== item.id));
    await fetch("/api/planner", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: item.id, dismissed: true }),
    }).catch(() => {});
  };

  const remove = async (item: PlannerItem) => {
    setItems((prev) => prev.filter((i) => i.id !== item.id));
    await fetch(`/api/planner?id=${item.id}`, { method: "DELETE" }).catch(() => {});
  };

  const saveNote = (value: string) => {
    setNote(value);
    setNoteStatus("saving");
    if (noteTimer.current) clearTimeout(noteTimer.current);
    noteTimer.current = setTimeout(async () => {
      await fetch("/api/planner/note", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ date, body: value }),
      }).catch(() => {});
      setNoteStatus("saved");
      setTimeout(() => setNoteStatus("idle"), 1500);
    }, 800);
  };

  const byQuadrant = (q: PlannerItem["quadrant"]) => items.filter((i) => i.quadrant === q);
  const prioritiesFull = byQuadrant("PRIORITY").length >= 3;

  const renderQuadrant = (q: "PRIORITY" | "TODO" | "CALL") => {
    const meta = QUADRANT_META[q];
    const list = byQuadrant(q);
    return (
      <div className={`rounded-2xl border ${meta.accent} p-4 flex flex-col`}>
        <div className="mb-1 flex items-baseline justify-between">
          <h2 className="text-sm font-bold text-gray-900">{meta.title}</h2>
          {q === "PRIORITY" && (
            <span className="text-[11px] text-gray-400">{list.length}/3</span>
          )}
        </div>
        <p className="text-[11px] text-gray-400 mb-3">{meta.hint}</p>

        <div className="space-y-1.5 flex-1">
          {list.map((item) => (
            <div key={item.id} className="group flex items-start gap-2">
              <input
                type="checkbox"
                checked={item.done}
                onChange={() => toggle(item)}
                className="mt-1 accent-red-600 h-4 w-4"
              />
              <div className="flex-1 min-w-0">
                <span
                  className={`text-sm break-words ${
                    item.done ? "text-gray-400 line-through" : "text-gray-800"
                  }`}
                >
                  {item.title}
                </span>
                <span className="ml-1.5 inline-flex items-center gap-1.5 align-middle">
                  {item.rolledOver && (
                    <span
                      className="text-[10px] text-amber-600 bg-amber-50 rounded px-1 py-0.5"
                      title="Rolled over from a previous day"
                    >
                      ↻ carried over
                    </span>
                  )}
                  {item.task && (
                    <Link
                      href={`/projects/${item.task.projectId}?task=${item.task.id}`}
                      className="text-[10px] text-red-600 hover:underline"
                      title={`Open board task: ${item.task.title}`}
                    >
                      open task ↗
                    </Link>
                  )}
                </span>
              </div>
              <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition">
                {item.rolledOver && !item.done && (
                  <button
                    onClick={() => dismiss(item)}
                    title="No longer relevant — remove without completing"
                    className="text-[10px] text-gray-400 hover:text-amber-600"
                  >
                    dismiss
                  </button>
                )}
                <button
                  onClick={() => remove(item)}
                  title="Delete"
                  className="text-xs text-gray-300 hover:text-red-500 px-1"
                >
                  ✕
                </button>
              </div>
            </div>
          ))}
          {list.length === 0 && (
            <p className="text-xs text-gray-300 py-2">Nothing here yet.</p>
          )}
        </div>

        <div className="mt-3 space-y-1.5">
          {q === "PRIORITY" && !prioritiesFull && myTasks.length > 0 && (
            <select
              value={linkTask}
              onChange={(e) => setLinkTask(e.target.value)}
              className="w-full text-[11px] border border-gray-200 rounded px-1.5 py-1 text-gray-500 focus:outline-none focus:border-red-400 bg-white"
            >
              <option value="">Link to a board task (optional)…</option>
              {myTasks.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.title}
                </option>
              ))}
            </select>
          )}
          <div className="flex gap-1.5">
            <input
              value={inputs[q] || ""}
              onChange={(e) => setInputs((prev) => ({ ...prev, [q]: e.target.value }))}
              onKeyDown={(e) => e.key === "Enter" && addItem(q)}
              placeholder={
                q === "PRIORITY" && prioritiesFull ? "3/3 — day is full" : "Add…"
              }
              disabled={q === "PRIORITY" && prioritiesFull}
              className="flex-1 min-w-0 text-sm border border-gray-200 rounded-lg px-2.5 py-1.5 focus:outline-none focus:border-red-400 bg-white disabled:bg-gray-50 disabled:placeholder:text-gray-300"
            />
            <button
              onClick={() => addItem(q)}
              disabled={!(inputs[q] || "").trim() || (q === "PRIORITY" && prioritiesFull)}
              className="text-sm font-semibold text-white bg-red-600 hover:bg-red-700 disabled:bg-gray-200 rounded-lg px-3 transition"
            >
              +
            </button>
          </div>
        </div>
      </div>
    );
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="animate-spin h-8 w-8 border-2 border-red-500 border-t-transparent rounded-full" />
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto">
      <div className="mb-5">
        <h1 className="text-2xl font-bold text-gray-900">My Day</h1>
        <p className="text-sm text-gray-500 mt-1">
          {new Date().toLocaleDateString(undefined, {
            weekday: "long",
            day: "numeric",
            month: "long",
          })}{" "}
          · private to you. Unfinished items follow you to tomorrow; finished ones are
          archived overnight.
        </p>
      </div>

      {error && (
        <div className="mb-4 p-3 rounded-lg bg-red-50 border border-red-200 text-red-700 text-sm">
          {error}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {renderQuadrant("PRIORITY")}
        {renderQuadrant("TODO")}
        {renderQuadrant("CALL")}

        {/* Notes scratchpad */}
        <div className="rounded-2xl border border-amber-200 bg-amber-50/30 p-4 flex flex-col">
          <div className="mb-1 flex items-baseline justify-between">
            <h2 className="text-sm font-bold text-gray-900">Notes</h2>
            <span className="text-[11px] text-gray-400">
              {noteStatus === "saving" ? "Saving…" : noteStatus === "saved" ? "Saved ✓" : ""}
            </span>
          </div>
          <p className="text-[11px] text-gray-400 mb-3">
            Scratchpad for the day — autosaves as you type.
          </p>
          <textarea
            value={note}
            onChange={(e) => saveNote(e.target.value)}
            placeholder="Quick thoughts, reminders, anything…"
            className="flex-1 min-h-[140px] w-full text-sm bg-transparent border border-transparent hover:border-amber-200 focus:border-amber-300 rounded-lg p-2 focus:outline-none resize-none"
          />
        </div>
      </div>
    </div>
  );
}
