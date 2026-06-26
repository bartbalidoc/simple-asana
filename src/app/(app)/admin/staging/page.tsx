"use client";

import { useEffect, useState, useCallback } from "react";
import { TaskDetailPanel } from "@/components/tasks/TaskDetailPanel";
import { TrashIcon, BoardIcon } from "@/components/ui/icons";
import { useToast } from "@/components/ui/Toast";

interface StagedTask {
  id: string;
  title: string;
  status: string;
  priority: string;
  dueDate: string | null;
  assigneeId: string | null;
  assigneeName: string | null;
  originalAssignee: string | null;
  distributedAt: string | null;
  subtaskCount: number;
}

interface StagedProject {
  id: string;
  name: string;
  taskCount: number;
  tasks: StagedTask[];
}

interface Dest {
  id: string;
  name: string;
}

interface Person {
  id: string;
  name: string;
  email: string;
}

function CopyToProject({
  task,
  destinations,
  people,
  onDone,
}: {
  task: StagedTask;
  destinations: Dest[];
  people: Person[];
  onDone: () => void;
}) {
  const toast = useToast();
  const [open, setOpen] = useState(false);
  const [destId, setDestId] = useState("");
  const [newName, setNewName] = useState("");
  const [assigneeId, setAssigneeId] = useState(task.assigneeId || "");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  const submit = async () => {
    setMsg(null);
    if (destId === "__new__" ? !newName.trim() : !destId) {
      setMsg("Pick a destination project (or name a new one).");
      return;
    }
    setBusy(true);
    try {
      const res = await fetch(`/api/admin/tasks/${task.id}/distribute`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...(destId === "__new__"
            ? { newProjectName: newName.trim() }
            : { destProjectId: destId }),
          assigneeId: assigneeId || null,
        }),
      });
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        throw new Error(d.error || "Failed to copy");
      }
      const data = await res.json();
      setOpen(false);
      onDone();
      setMsg(`Copied to ${data.destProjectName}`);
      toast(
        `Copied to ${data.destProjectName}${data.aiGenerated ? " (AI-generated)" : ""}`
      );
    } catch (err) {
      setMsg(err instanceof Error ? err.message : "Failed to copy");
    } finally {
      setBusy(false);
    }
  };

  if (!open) {
    return (
      <div className="flex items-center gap-2">
        {msg && <span className="text-xs text-green-700">{msg}</span>}
        <button
          onClick={() => setOpen(true)}
          className="text-xs bg-red-600 hover:bg-red-700 text-white rounded px-2 py-1 transition whitespace-nowrap"
        >
          Copy to project →
        </button>
      </div>
    );
  }

  return (
    <div className="flex flex-wrap items-center gap-1.5 bg-white border border-gray-200 rounded p-2">
      <select
        value={destId}
        onChange={(e) => setDestId(e.target.value)}
        className="text-xs border border-gray-300 rounded px-1.5 py-1 focus:outline-none focus:border-red-500"
      >
        <option value="">Destination project…</option>
        {destinations.map((d) => (
          <option key={d.id} value={d.id}>
            {d.name}
          </option>
        ))}
        <option value="__new__">➕ New project…</option>
      </select>
      {destId === "__new__" && (
        <input
          type="text"
          value={newName}
          onChange={(e) => setNewName(e.target.value)}
          placeholder="New project name"
          className="text-xs border border-gray-300 rounded px-1.5 py-1 focus:outline-none focus:border-red-500"
        />
      )}
      <select
        value={assigneeId}
        onChange={(e) => setAssigneeId(e.target.value)}
        className="text-xs border border-gray-300 rounded px-1.5 py-1 focus:outline-none focus:border-red-500"
      >
        <option value="">Unassigned</option>
        {people.map((p) => (
          <option key={p.id} value={p.id}>
            {p.name}
          </option>
        ))}
      </select>
      <button
        onClick={submit}
        disabled={busy}
        className="text-xs bg-red-600 hover:bg-red-700 disabled:bg-gray-400 text-white rounded px-2 py-1"
      >
        {busy ? "Copying…" : "Copy"}
      </button>
      <button
        onClick={() => setOpen(false)}
        className="text-xs text-gray-500 hover:text-gray-700 px-1"
      >
        Cancel
      </button>
      {msg && <span className="text-xs text-red-600">{msg}</span>}
    </div>
  );
}

const STATUS_COLS: { key: string; label: string; dot: string }[] = [
  { key: "TODO", label: "To Do", dot: "bg-gray-400" },
  { key: "IN_PROGRESS", label: "In Progress", dot: "bg-blue-500" },
  { key: "IN_REVIEW", label: "In Review", dot: "bg-amber-500" },
  { key: "DONE", label: "Done", dot: "bg-green-500" },
];

export default function StagingPage() {
  const toast = useToast();
  const [projects, setProjects] = useState<StagedProject[]>([]);
  const [destinations, setDestinations] = useState<Dest[]>([]);
  const [people, setPeople] = useState<Person[]>([]);
  const [loading, setLoading] = useState(true);
  const [openTaskId, setOpenTaskId] = useState<string | null>(null);
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  // Board is the default view; toggle to the stacked-row list.
  const [view, setView] = useState<"board" | "list">("board");

  const load = useCallback(async () => {
    try {
      const [s, d, u] = await Promise.all([
        fetch("/api/admin/staging").then((r) => (r.ok ? r.json() : [])),
        fetch("/api/projects").then((r) => (r.ok ? r.json() : [])),
        fetch("/api/users").then((r) => (r.ok ? r.json() : [])),
      ]);
      setProjects(Array.isArray(s) ? s : []);
      setDestinations(Array.isArray(d) ? d.map((p: any) => ({ id: p.id, name: p.name })) : []);
      setPeople(Array.isArray(u) ? u : []);
    } catch {
      setProjects([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const handleDeleteProject = async (id: string, name: string) => {
    if (
      !confirm(
        `Delete the staged project "${name}" and everything imported in it? This only removes it from Staging — your real projects are untouched.`
      )
    )
      return;
    try {
      const res = await fetch(`/api/projects/${id}`, { method: "DELETE" });
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        throw new Error(d.error || "Failed to delete");
      }
      load();
      toast("Staged project deleted");
    } catch (err) {
      toast(err instanceof Error ? err.message : "Failed to delete", "error");
    }
  };

  const handleDeleteTask = async (id: string, title: string) => {
    if (!confirm(`Delete the staged task "${title}"? This cannot be undone.`)) return;
    try {
      const res = await fetch(`/api/tasks/${id}`, { method: "DELETE" });
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        throw new Error(d.error || "Failed to delete");
      }
      load();
      toast("Task deleted");
    } catch (err) {
      toast(err instanceof Error ? err.message : "Failed to delete", "error");
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="animate-spin h-8 w-8 border-2 border-red-500 border-t-transparent rounded-full" />
      </div>
    );
  }

  return (
    <div>
      <div className="mb-6 flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Staging (Asana import)</h1>
          <p className="text-sm text-gray-600 mt-1 max-w-2xl">
            Imported Asana work — hidden from everyone except admins. Open a task to
            review its subtasks and comments, then <strong>Copy</strong> it into a real
            project for someone. Distributed tasks turn green so you can see what&apos;s
            already handed out.
          </p>
        </div>
        {/* View toggle — board by default, slide to stacked rows */}
        <div className="flex-shrink-0 inline-flex rounded-lg border border-gray-200 bg-white p-0.5 text-sm">
          <button
            onClick={() => setView("board")}
            className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md font-medium transition ${
              view === "board"
                ? "bg-red-600 text-white"
                : "text-gray-600 hover:text-gray-900"
            }`}
          >
            <BoardIcon size={14} /> Board
          </button>
          <button
            onClick={() => setView("list")}
            className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md font-medium transition ${
              view === "list"
                ? "bg-red-600 text-white"
                : "text-gray-600 hover:text-gray-900"
            }`}
          >
            ☰ Rows
          </button>
        </div>
      </div>

      {projects.length === 0 && (
        <div className="bg-white rounded-lg shadow p-6 text-center text-gray-600">
          Nothing imported yet.
        </div>
      )}

      <div className="space-y-4">
        {projects.map((proj) => {
          const isOpen = expanded[proj.id] ?? true;
          return (
            <div key={proj.id} className="bg-white rounded-lg shadow">
              <div className="flex items-center justify-between px-4 py-3">
                <button
                  onClick={() =>
                    setExpanded((e) => ({ ...e, [proj.id]: !isOpen }))
                  }
                  className="flex-1 flex items-center gap-2 text-left font-semibold text-gray-900"
                >
                  {isOpen ? "▾" : "▸"} {proj.name}
                </button>
                <div className="flex items-center gap-2">
                  <span className="text-xs text-gray-400 mr-1">{proj.taskCount} tasks</span>
                  <a
                    href={`/projects/${proj.id}?from=staging`}
                    className="inline-flex items-center gap-1 text-xs text-gray-600 hover:text-red-700 border border-gray-200 hover:border-red-300 rounded-md px-2 py-1 whitespace-nowrap transition"
                    title="See this project as a To Do / In Progress / Review / Done board"
                  >
                    <BoardIcon size={13} /> Open as board
                  </a>
                  <button
                    onClick={() => handleDeleteProject(proj.id, proj.name)}
                    className="inline-flex items-center gap-1 text-xs text-gray-500 hover:text-white hover:bg-red-600 border border-gray-200 hover:border-red-600 rounded-md px-2 py-1 transition"
                    title="Delete this staged project"
                  >
                    <TrashIcon size={13} /> Delete
                  </button>
                </div>
              </div>

              {isOpen && view === "board" && (
                <div className="border-t border-gray-100 p-3 overflow-x-auto">
                  <div className="flex gap-3 items-start">
                    {STATUS_COLS.map((col) => {
                      const colTasks = proj.tasks.filter((t) => t.status === col.key);
                      return (
                        <div
                          key={col.key}
                          className="flex-1 basis-0 min-w-[220px] bg-gray-50/70 rounded-xl border border-gray-200/70 p-2"
                        >
                          <div className="flex items-center justify-between px-1 mb-2">
                            <span className="flex items-center gap-1.5 text-xs font-semibold text-gray-700">
                              <span className={`h-2 w-2 rounded-full ${col.dot}`} />
                              {col.label}
                            </span>
                            <span className="text-[11px] font-medium text-gray-400">
                              {colTasks.length}
                            </span>
                          </div>
                          <div className="space-y-2">
                            {colTasks.map((t) => {
                              const distributed = !!t.distributedAt;
                              return (
                                <div
                                  key={t.id}
                                  className={`rounded-lg border p-2.5 text-sm shadow-sm ${
                                    distributed
                                      ? "bg-green-50 border-green-200"
                                      : "bg-white border-gray-200"
                                  }`}
                                >
                                  <div className="flex items-start gap-1">
                                    <button
                                      onClick={() => setOpenTaskId(t.id)}
                                      className={`flex-1 text-left break-words hover:text-red-600 ${
                                        t.status === "DONE"
                                          ? "text-gray-400 line-through"
                                          : "text-gray-800"
                                      }`}
                                      title="Open task"
                                    >
                                      {distributed && (
                                        <span className="text-green-700 mr-1">✓</span>
                                      )}
                                      {t.title}
                                    </button>
                                    <button
                                      onClick={() => handleDeleteTask(t.id, t.title)}
                                      className="flex-shrink-0 text-gray-300 hover:text-red-600"
                                      title="Delete this staged task"
                                    >
                                      <TrashIcon size={14} />
                                    </button>
                                  </div>
                                  <div className="mt-1.5 flex items-center gap-2 flex-wrap text-[11px] text-gray-400">
                                    {t.subtaskCount > 0 && <span>⌄ {t.subtaskCount}</span>}
                                    <span>{t.originalAssignee || "—"}</span>
                                    {distributed && (
                                      <span className="text-green-700 font-semibold">
                                        Copied ✓
                                      </span>
                                    )}
                                  </div>
                                  <div className="mt-2">
                                    <CopyToProject
                                      task={t}
                                      destinations={destinations}
                                      people={people}
                                      onDone={load}
                                    />
                                  </div>
                                </div>
                              );
                            })}
                            {colTasks.length === 0 && (
                              <div className="text-[11px] text-gray-300 text-center py-3">
                                —
                              </div>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {isOpen && view === "list" && (
                <div className="border-t border-gray-100 divide-y divide-gray-50">
                  {proj.tasks.map((t) => {
                    const distributed = !!t.distributedAt;
                    return (
                      <div
                        key={t.id}
                        className={`flex flex-wrap items-center gap-2 px-4 py-2.5 ${
                          distributed ? "bg-green-50" : ""
                        }`}
                      >
                        <button
                          onClick={() => setOpenTaskId(t.id)}
                          className={`flex-1 min-w-[180px] text-left text-sm hover:text-red-600 hover:underline ${
                            t.status === "DONE" ? "text-gray-400" : "text-gray-800"
                          }`}
                          title="Open task"
                        >
                          {distributed && <span className="text-green-700 mr-1">✓</span>}
                          {t.title}
                          {t.subtaskCount > 0 && (
                            <span className="ml-2 text-xs text-gray-400">
                              ⌄ {t.subtaskCount} subtasks
                            </span>
                          )}
                        </button>

                        <span className="text-xs text-gray-500 whitespace-nowrap">
                          Original owner:{" "}
                          <span className="text-gray-700">
                            {t.originalAssignee || "—"}
                          </span>
                        </span>

                        {distributed && (
                          <span className="text-[10px] font-bold uppercase bg-green-100 text-green-700 px-2 py-0.5 rounded-full">
                            Copied ✓
                          </span>
                        )}

                        <CopyToProject
                          task={t}
                          destinations={destinations}
                          people={people}
                          onDone={load}
                        />

                        <button
                          onClick={() => handleDeleteTask(t.id, t.title)}
                          className="inline-flex items-center gap-1 text-xs text-gray-400 hover:text-white hover:bg-red-600 border border-gray-200 hover:border-red-600 rounded-md px-2 py-1 transition"
                          title="Delete this staged task"
                        >
                          <TrashIcon size={13} /> Delete
                        </button>
                      </div>
                    );
                  })}
                  {proj.tasks.length === 0 && (
                    <div className="px-4 py-3 text-sm text-gray-400">No tasks.</div>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {openTaskId && (
        <TaskDetailPanel
          taskId={openTaskId}
          onClose={() => {
            setOpenTaskId(null);
            load();
          }}
          onTaskUpdated={load}
          onOpenTask={(id) => setOpenTaskId(id)}
        />
      )}
    </div>
  );
}
