"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/Button";
import { SparklesIcon, CheckIcon } from "@/components/ui/icons";

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
  isSubtask?: boolean;
  parentTitle?: string | null;
  guest?: boolean; // task the user only guests on — the breakdown route 403s these
}

// SMART breakdown (v2.9) — mirrors the server's SmartBreakdown shape.
interface SmartStep {
  title: string;
  how: string;
  where: string;
  doneWhen: string;
}
interface ResearchFinding {
  title: string;
  detail: string;
  url: string;
}
interface SmartBreakdown {
  steps: SmartStep[];
  research: ResearchFinding[];
  tips: string[];
  report: string;
}

// Only ever link out to real web URLs — never a javascript:/data: scheme from
// model output (the same guard the board card links use).
const safeHref = (url: string) => (/^https?:\/\//i.test(url) ? url : undefined);

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

  // AI SMART breakdown (v2.9): pick a task → Claude researches it and proposes
  // concrete steps; accepted steps land in To-Do so the day fills with doable bites.
  const [bdTaskId, setBdTaskId] = useState("");
  const [bdLoading, setBdLoading] = useState(false);
  const [bdError, setBdError] = useState<string | null>(null);
  const [bdProposal, setBdProposal] = useState<SmartBreakdown | null>(null);
  // The task the current proposal was generated for — accepted steps link to THIS,
  // never the live picker (which stays editable while a proposal is shown).
  const [bdProposalTaskId, setBdProposalTaskId] = useState("");
  const [bdTaskTitle, setBdTaskTitle] = useState("");
  const [bdSelected, setBdSelected] = useState<Set<number>>(new Set());
  const [bdAdding, setBdAdding] = useState(false);
  const [copied, setCopied] = useState(false);

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

  // Ask Claude to research the picked task and propose SMART steps (preview only).
  const runBreakdown = async () => {
    if (!bdTaskId || bdLoading) return;
    const taskId = bdTaskId; // freeze the target — the picker can change later
    setBdLoading(true);
    setBdError(null);
    setBdProposal(null);
    setCopied(false);
    try {
      const res = await fetch("/api/ai/breakdown-task", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ taskId }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(
          res.status === 403
            ? "You can only break down tasks in a project you belong to."
            : data.error || "Couldn't break down that task."
        );
      }
      const proposal = data.proposal as SmartBreakdown;
      setBdProposal(proposal);
      setBdProposalTaskId(taskId); // accepted steps link to this task, not the live picker
      setBdTaskTitle(typeof data.taskTitle === "string" ? data.taskTitle : "");
      // Pre-select every step — the common case is "add them all".
      setBdSelected(new Set(proposal.steps.map((_, i) => i)));
    } catch (e) {
      setBdError(e instanceof Error ? e.message : "Couldn't break down that task.");
    } finally {
      setBdLoading(false);
    }
  };

  const toggleStep = (i: number) =>
    setBdSelected((prev) => {
      const next = new Set(prev);
      next.has(i) ? next.delete(i) : next.add(i);
      return next;
    });

  // Persist the chosen steps as To-Do items, linked back to the task.
  const addSteps = async () => {
    if (!bdProposal || bdAdding) return;
    // Snapshot the chosen indices; we drop each from bdSelected as it saves, so a
    // retry after a partial failure only re-posts the steps that didn't make it.
    const indices = bdProposal.steps.map((_, i) => i).filter((i) => bdSelected.has(i));
    if (!indices.length) return;
    setBdAdding(true);
    setBdError(null);
    try {
      for (const i of indices) {
        const step = bdProposal.steps[i];
        const res = await fetch("/api/planner", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            quadrant: "TODO",
            title: step.title.slice(0, 500),
            date,
            taskId: bdProposalTaskId || undefined,
          }),
        });
        if (!res.ok) throw new Error("save-failed");
        // Confirmed saved — drop it so a retry can't create a duplicate.
        setBdSelected((prev) => {
          const next = new Set(prev);
          next.delete(i);
          return next;
        });
      }
      setBdProposal(null);
      setBdProposalTaskId("");
      setBdSelected(new Set());
      setBdTaskId("");
      await load();
    } catch {
      setBdError(
        "Couldn't add every step — the ones that saved are in To-Do; click Add to retry the rest."
      );
      await load(); // reflect the steps that did persist
    } finally {
      setBdAdding(false);
    }
  };

  const copyReport = async () => {
    if (!bdProposal?.report) return;
    try {
      await navigator.clipboard.writeText(bdProposal.report);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      /* clipboard blocked — no-op */
    }
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
  // Only offer the AI breakdown for tasks the route can actually serve — guests
  // hit a 403 (they're never project members), so keep them out of the picker.
  const bdTasks = myTasks.filter((t) => !t.guest);

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

      {/* AI SMART breakdown — turn a big/vague task into concrete steps for today */}
      {bdTasks.length > 0 && (
        <div className="mb-4 rounded-2xl border border-gray-200 bg-white p-4">
          <div className="flex items-start gap-3">
            <div className="h-9 w-9 shrink-0 rounded-lg bg-red-50 text-red-600 flex items-center justify-center">
              <SparklesIcon size={18} />
            </div>
            <div className="min-w-0 flex-1">
              <h2 className="text-sm font-bold text-gray-900">Break a task into today&apos;s steps</h2>
              <p className="text-[11px] text-gray-400 mt-0.5">
                Pick a task and let AI research it and propose concrete, doable steps — add the ones
                you want to your To-Do.
              </p>
              <div className="mt-3 flex flex-col sm:flex-row gap-2">
                <select
                  value={bdTaskId}
                  onChange={(e) => setBdTaskId(e.target.value)}
                  disabled={bdLoading}
                  className="flex-1 min-w-0 text-sm border border-gray-200 rounded-lg px-2.5 py-2 text-gray-700 bg-white focus:outline-none focus-visible:ring-2 focus-visible:ring-red-400 disabled:bg-gray-50"
                >
                  <option value="">Choose one of your tasks…</option>
                  {bdTasks.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.isSubtask && t.parentTitle ? `↳ ${t.title}  (in ${t.parentTitle})` : t.title}
                    </option>
                  ))}
                </select>
                <Button
                  variant="primary"
                  onClick={runBreakdown}
                  disabled={!bdTaskId || bdLoading}
                  leftIcon={<SparklesIcon size={15} />}
                >
                  {bdLoading ? "Researching…" : "Break down with AI"}
                </Button>
              </div>

              {bdError && (
                <div className="mt-3 p-2.5 rounded-lg bg-red-50 border border-red-200 text-red-700 text-xs">
                  {bdError}
                </div>
              )}

              {bdLoading && (
                <div className="mt-3 flex items-center gap-2 text-xs text-gray-400">
                  <div className="animate-spin h-4 w-4 border-2 border-red-400 border-t-transparent rounded-full" />
                  Researching the task and drafting a plan… this can take up to a minute.
                </div>
              )}

              {bdProposal && (
                <div className="mt-4 space-y-4">
                  {bdTaskTitle && (
                    <p className="text-xs text-gray-500">
                      Plan for <span className="font-semibold text-gray-700">{bdTaskTitle}</span>
                    </p>
                  )}

                  {/* SMART steps — select which to add */}
                  {bdProposal.steps.length > 0 && (
                    <div>
                      <h3 className="text-xs font-semibold text-gray-700 uppercase tracking-wide mb-2">
                        Steps
                      </h3>
                      <div className="space-y-1.5">
                        {bdProposal.steps.map((s, i) => {
                          const on = bdSelected.has(i);
                          return (
                            <label
                              key={i}
                              className={`flex items-start gap-2.5 rounded-lg border p-2.5 cursor-pointer transition ${
                                on ? "border-red-300 bg-red-50/40" : "border-gray-200 bg-white hover:border-gray-300"
                              }`}
                            >
                              <input
                                type="checkbox"
                                checked={on}
                                onChange={() => toggleStep(i)}
                                className="mt-0.5 accent-red-600 h-4 w-4 shrink-0"
                              />
                              <div className="min-w-0">
                                <p className="text-sm font-medium text-gray-800">{s.title}</p>
                                <dl className="mt-1 space-y-0.5 text-[11px] text-gray-500">
                                  {s.how && (
                                    <div className="flex gap-1.5">
                                      <dt className="font-semibold text-gray-600 shrink-0">How</dt>
                                      <dd className="min-w-0">{s.how}</dd>
                                    </div>
                                  )}
                                  {s.where && (
                                    <div className="flex gap-1.5">
                                      <dt className="font-semibold text-gray-600 shrink-0">Where</dt>
                                      <dd className="min-w-0">{s.where}</dd>
                                    </div>
                                  )}
                                  {s.doneWhen && (
                                    <div className="flex gap-1.5">
                                      <dt className="font-semibold text-gray-600 shrink-0">Done when</dt>
                                      <dd className="min-w-0">{s.doneWhen}</dd>
                                    </div>
                                  )}
                                </dl>
                              </div>
                            </label>
                          );
                        })}
                      </div>
                      <div className="mt-2.5 flex items-center gap-3">
                        <Button
                          variant="primary"
                          size="sm"
                          onClick={addSteps}
                          disabled={bdSelected.size === 0 || bdAdding}
                          leftIcon={<CheckIcon size={14} />}
                        >
                          {bdAdding
                            ? "Adding…"
                            : `Add ${bdSelected.size} step${bdSelected.size === 1 ? "" : "s"} to To-Do`}
                        </Button>
                        <button
                          onClick={() => {
                            setBdProposal(null);
                            setBdProposalTaskId("");
                            setBdSelected(new Set());
                          }}
                          className="rounded text-xs text-gray-400 hover:text-gray-600 focus:outline-none focus-visible:ring-2 focus-visible:ring-red-400"
                        >
                          Dismiss
                        </button>
                      </div>
                    </div>
                  )}

                  {/* Research findings with real links */}
                  {bdProposal.research.length > 0 && (
                    <div>
                      <h3 className="text-xs font-semibold text-gray-700 uppercase tracking-wide mb-2">
                        What I found
                      </h3>
                      <ul className="space-y-1.5">
                        {bdProposal.research.map((r, i) => {
                          const href = safeHref(r.url);
                          return (
                            <li key={i} className="text-xs text-gray-600">
                              <span className="font-medium text-gray-700">{r.title}</span>
                              {r.detail && <span> — {r.detail}</span>}
                              {href && (
                                <>
                                  {" "}
                                  <a
                                    href={href}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="text-red-600 hover:underline"
                                  >
                                    source ↗
                                  </a>
                                </>
                              )}
                            </li>
                          );
                        })}
                      </ul>
                    </div>
                  )}

                  {/* Tips & tricks */}
                  {bdProposal.tips.length > 0 && (
                    <div>
                      <h3 className="text-xs font-semibold text-gray-700 uppercase tracking-wide mb-2">
                        Tips &amp; tricks
                      </h3>
                      <ul className="space-y-1 text-xs text-gray-600 list-disc pl-4">
                        {bdProposal.tips.map((t, i) => (
                          <li key={i}>{t}</li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {/* Plan-of-approach report (copyable / emailable) */}
                  {bdProposal.report && (
                    <div>
                      <div className="flex items-center justify-between mb-2">
                        <h3 className="text-xs font-semibold text-gray-700 uppercase tracking-wide">
                          Plan of approach
                        </h3>
                        <button
                          onClick={copyReport}
                          className="rounded text-[11px] text-gray-400 hover:text-red-600 focus:outline-none focus-visible:ring-2 focus-visible:ring-red-400"
                        >
                          {copied ? "Copied ✓" : "Copy"}
                        </button>
                      </div>
                      <pre className="text-xs text-gray-600 whitespace-pre-wrap font-sans bg-gray-50 border border-gray-100 rounded-lg p-3 max-h-64 overflow-y-auto">
                        {bdProposal.report}
                      </pre>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
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
