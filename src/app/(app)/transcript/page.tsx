"use client";

import { useEffect, useState } from "react";

interface Column {
  id: string;
  name: string;
  order: number;
}
interface Project {
  id: string;
  name: string;
  columns?: Column[];
}
interface TeamUser {
  id: string;
  name: string;
  email: string;
}
// A draft returned by Claude, plus the per-task board + assignee the user picks.
interface DraftTask {
  title: string;
  description: string;
  priority: "LOW" | "MEDIUM" | "HIGH";
  subtasks: string[];
  projectId: string;
  assigneeId: string;
}

const PRIORITY_STYLES: Record<string, string> = {
  HIGH: "bg-red-100 text-red-700",
  MEDIUM: "bg-amber-100 text-amber-700",
  LOW: "bg-gray-100 text-gray-600",
};

// The destination column for a new task on a board: prefer "To Do", else the first.
function firstColumnId(project?: Project): string | null {
  const cols = project?.columns || [];
  return (cols.find((c) => c.name === "To Do") || cols[0])?.id ?? null;
}

// Feedback #6: paste a meeting transcript → Claude drafts organized tasks → set
// each task's board + assignee → create. Uses real Anthropic Claude.
export default function TranscriptToTasksPage() {
  const [transcript, setTranscript] = useState("");
  const [analyzing, setAnalyzing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [tasks, setTasks] = useState<DraftTask[] | null>(null);
  const [selected, setSelected] = useState<Set<number>>(new Set());

  const [projects, setProjects] = useState<Project[]>([]);
  const [users, setUsers] = useState<TeamUser[]>([]);
  const [defaultProjectId, setDefaultProjectId] = useState("");

  const [creating, setCreating] = useState(false);
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null);
  const [createdCount, setCreatedCount] = useState<number | null>(null);

  useEffect(() => {
    fetch("/api/projects")
      .then((r) => (r.ok ? r.json() : []))
      .then((data) => {
        const list: Project[] = Array.isArray(data) ? data : [];
        setProjects(list);
        if (list[0]) setDefaultProjectId(list[0].id);
      })
      .catch(() => setProjects([]));
    fetch("/api/users")
      .then((r) => (r.ok ? r.json() : []))
      .then((data) => setUsers(Array.isArray(data) ? data : []))
      .catch(() => setUsers([]));
  }, []);

  const analyze = async () => {
    setError(null);
    setCreatedCount(null);
    setAnalyzing(true);
    setTasks(null);
    try {
      const res = await fetch("/api/ai/transcript-to-tasks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ transcript }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to analyze transcript.");
      const drafts: DraftTask[] = (data.tasks || []).map((t: any) => ({
        title: t.title,
        description: t.description || "",
        priority: t.priority,
        subtasks: Array.isArray(t.subtasks) ? t.subtasks : [],
        projectId: defaultProjectId, // per-task, defaults to the current default board
        assigneeId: "", // unassigned by default
      }));
      setTasks(drafts);
      setSelected(new Set(drafts.map((_: DraftTask, i: number) => i)));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong.");
    } finally {
      setAnalyzing(false);
    }
  };

  const toggle = (i: number) => {
    setSelected((prev) => {
      const next = new Set(prev);
      next.has(i) ? next.delete(i) : next.add(i);
      return next;
    });
  };

  const updateTask = (i: number, patch: Partial<DraftTask>) => {
    setTasks((prev) => (prev ? prev.map((t, idx) => (idx === i ? { ...t, ...patch } : t)) : prev));
  };

  // Bulk helpers — apply a board / assignee to every draft at once.
  const setAllBoards = (projectId: string) =>
    setTasks((prev) => (prev ? prev.map((t) => ({ ...t, projectId })) : prev));
  const setAllAssignees = (assigneeId: string) =>
    setTasks((prev) => (prev ? prev.map((t) => ({ ...t, assigneeId })) : prev));

  const createSelected = async () => {
    if (!tasks) return;
    const chosen = tasks.map((t, i) => ({ t, i })).filter(({ i }) => selected.has(i));
    if (chosen.length === 0) return;
    if (chosen.some(({ t }) => !t.projectId)) {
      setError("Every selected task needs a board.");
      return;
    }

    setCreating(true);
    setError(null);
    setProgress({ done: 0, total: chosen.length });
    let created = 0;
    try {
      for (const { t } of chosen) {
        const project = projects.find((p) => p.id === t.projectId);
        const columnId = firstColumnId(project); // <-- the fix: tasks must land in a column to show

        // 1) create the parent task IN a column so it shows on the board
        const res = await fetch("/api/tasks", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            projectId: t.projectId,
            title: t.title,
            description: t.description || undefined,
            priority: t.priority,
            assigneeId: t.assigneeId || undefined,
            columnId: columnId || undefined,
            template: "general",
          }),
        });
        if (!res.ok) throw new Error(`Failed to create "${t.title}"`);
        const parent = await res.json();

        // 2) create its subtasks (best-effort; a failed subtask doesn't abort the batch)
        for (let s = 0; s < t.subtasks.length; s++) {
          await fetch("/api/tasks", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              projectId: t.projectId,
              title: t.subtasks[s],
              parentTaskId: parent.id,
              assigneeId: t.assigneeId || undefined,
              columnId: columnId || undefined,
              template: "general",
              order: s,
            }),
          }).catch(() => {});
        }

        created += 1;
        setProgress({ done: created, total: chosen.length });
      }
      setCreatedCount(created);
      setTasks(null);
      setTranscript("");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to create tasks.");
    } finally {
      setCreating(false);
      setProgress(null);
    }
  };

  return (
    <div className="max-w-3xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Meeting → Tasks</h1>
        <p className="text-sm text-gray-500 mt-1">
          Paste a meeting transcript and Claude will draft organized tasks. Set each task&apos;s board
          and assignee, then create — nothing is created until you click <strong>Create</strong>.
        </p>
      </div>

      {createdCount !== null && (
        <div className="mb-4 p-3 rounded-lg bg-green-50 border border-green-200 text-green-800 text-sm">
          ✅ Created {createdCount} task{createdCount === 1 ? "" : "s"}. They appear in the “To Do”
          column of each chosen board. Paste another transcript below to continue.
        </div>
      )}

      {/* Transcript input */}
      <label className="block text-sm font-semibold text-gray-900 mb-2">Meeting transcript</label>
      <textarea
        value={transcript}
        onChange={(e) => setTranscript(e.target.value)}
        placeholder="Paste the meeting notes or transcript here…"
        className="w-full min-h-[180px] border border-gray-300 rounded-lg p-3 text-sm focus:outline-none focus:border-red-500 focus:ring-1 focus:ring-red-500"
        disabled={analyzing || creating}
      />
      <div className="mt-3 flex items-center gap-3">
        <button
          onClick={analyze}
          disabled={analyzing || creating || transcript.trim().length < 20}
          className="bg-red-600 hover:bg-red-700 disabled:bg-red-300 text-white font-semibold py-2 px-5 rounded-lg text-sm transition"
        >
          {analyzing ? "Analyzing with Claude…" : tasks ? "Re-analyze" : "Generate tasks"}
        </button>
        <span className="text-xs text-gray-400">{transcript.length.toLocaleString()} characters</span>
      </div>

      {error && (
        <div className="mt-4 p-3 rounded-lg bg-red-50 border border-red-200 text-red-700 text-sm">
          {error}
        </div>
      )}

      {/* Draft tasks */}
      {tasks && (
        <div className="mt-8">
          {tasks.length === 0 ? (
            <div className="p-4 rounded-lg bg-gray-50 border border-gray-200 text-sm text-gray-600">
              No action items found in that transcript. Try a longer or more detailed one.
            </div>
          ) : (
            <>
              {/* Bulk controls */}
              <div className="flex flex-wrap items-center gap-3 mb-3 p-3 rounded-lg bg-gray-50 border border-gray-200">
                <span className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
                  Apply to all
                </span>
                <select
                  onChange={(e) => e.target.value && setAllBoards(e.target.value)}
                  defaultValue=""
                  className="border border-gray-300 rounded p-1.5 text-xs focus:outline-none focus:border-red-500"
                >
                  <option value="">Board…</option>
                  {projects.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name}
                    </option>
                  ))}
                </select>
                <select
                  onChange={(e) => setAllAssignees(e.target.value)}
                  defaultValue=""
                  className="border border-gray-300 rounded p-1.5 text-xs focus:outline-none focus:border-red-500"
                >
                  <option value="">Assignee…</option>
                  <option value="">Unassigned</option>
                  {users.map((u) => (
                    <option key={u.id} value={u.id}>
                      {u.name}
                    </option>
                  ))}
                </select>
                <div className="flex-1" />
                <button
                  onClick={() =>
                    setSelected(
                      selected.size === tasks.length ? new Set() : new Set(tasks.map((_, i) => i))
                    )
                  }
                  className="text-xs text-red-600 hover:underline"
                >
                  {selected.size === tasks.length ? "Deselect all" : "Select all"}
                </button>
              </div>

              <h2 className="text-sm font-semibold text-gray-900 mb-2">
                {selected.size} of {tasks.length} task{tasks.length === 1 ? "" : "s"} selected
              </h2>

              <div className="space-y-2">
                {tasks.map((t, i) => (
                  <div
                    key={i}
                    className={`border rounded-lg p-3 transition ${
                      selected.has(i) ? "border-red-300 bg-red-50/40" : "border-gray-200 bg-white"
                    }`}
                  >
                    <div className="flex items-start gap-3">
                      <input
                        type="checkbox"
                        checked={selected.has(i)}
                        onChange={() => toggle(i)}
                        className="mt-1 accent-red-600"
                      />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <input
                            value={t.title}
                            onChange={(e) => updateTask(i, { title: e.target.value })}
                            className="flex-1 font-medium text-gray-900 text-sm bg-transparent border-b border-transparent focus:border-gray-300 focus:outline-none"
                          />
                          <select
                            value={t.priority}
                            onChange={(e) => updateTask(i, { priority: e.target.value as DraftTask["priority"] })}
                            className={`text-[11px] font-semibold rounded px-1.5 py-0.5 ${PRIORITY_STYLES[t.priority]}`}
                          >
                            <option value="HIGH">HIGH</option>
                            <option value="MEDIUM">MEDIUM</option>
                            <option value="LOW">LOW</option>
                          </select>
                        </div>
                        {t.description && (
                          <p className="text-xs text-gray-500 mt-1">{t.description}</p>
                        )}

                        {/* Per-task board + assignee */}
                        <div className="flex flex-wrap items-center gap-2 mt-2">
                          <label className="text-[11px] text-gray-400">Board</label>
                          <select
                            value={t.projectId}
                            onChange={(e) => updateTask(i, { projectId: e.target.value })}
                            className="border border-gray-300 rounded px-1.5 py-1 text-xs focus:outline-none focus:border-red-500"
                          >
                            {projects.length === 0 && <option value="">No boards</option>}
                            {projects.map((p) => (
                              <option key={p.id} value={p.id}>
                                {p.name}
                              </option>
                            ))}
                          </select>
                          <label className="text-[11px] text-gray-400 ml-2">Assignee</label>
                          <select
                            value={t.assigneeId}
                            onChange={(e) => updateTask(i, { assigneeId: e.target.value })}
                            className="border border-gray-300 rounded px-1.5 py-1 text-xs focus:outline-none focus:border-red-500"
                          >
                            <option value="">Unassigned</option>
                            {users.map((u) => (
                              <option key={u.id} value={u.id}>
                                {u.name}
                              </option>
                            ))}
                          </select>
                        </div>

                        {t.subtasks.length > 0 && (
                          <ul className="mt-2 space-y-0.5">
                            {t.subtasks.map((s, si) => (
                              <li key={si} className="text-xs text-gray-600 flex gap-1.5">
                                <span className="text-gray-300">•</span>
                                {s}
                              </li>
                            ))}
                          </ul>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              {/* Create bar */}
              <div className="mt-5 flex flex-wrap items-center gap-3 border-t pt-4">
                <button
                  onClick={createSelected}
                  disabled={creating || selected.size === 0}
                  className="bg-red-600 hover:bg-red-700 disabled:bg-red-300 text-white font-semibold py-2 px-5 rounded-lg text-sm transition"
                >
                  {creating
                    ? progress
                      ? `Creating ${progress.done}/${progress.total}…`
                      : "Creating…"
                    : `Create ${selected.size} task${selected.size === 1 ? "" : "s"}`}
                </button>
                <span className="text-xs text-gray-400">
                  Each task goes to its own board &amp; assignee (set above).
                </span>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}
