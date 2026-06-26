"use client";

import { useEffect, useState, useCallback } from "react";
import { TaskDetailPanel } from "@/components/tasks/TaskDetailPanel";

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

export default function StagingPage() {
  const [projects, setProjects] = useState<StagedProject[]>([]);
  const [destinations, setDestinations] = useState<Dest[]>([]);
  const [people, setPeople] = useState<Person[]>([]);
  const [loading, setLoading] = useState(true);
  const [openTaskId, setOpenTaskId] = useState<string | null>(null);
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});

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

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="animate-spin h-8 w-8 border-2 border-red-500 border-t-transparent rounded-full" />
      </div>
    );
  }

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Staging (Asana import)</h1>
        <p className="text-sm text-gray-600 mt-1">
          Imported Asana work — hidden from everyone except admins. Open a task to
          review its subtasks and comments, then <strong>Copy</strong> it into a real
          project for someone. Distributed tasks turn green so you can see what&apos;s
          already handed out.
        </p>
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
                <div className="flex items-center gap-3">
                  <a
                    href={`/projects/${proj.id}`}
                    className="text-xs text-red-600 hover:text-red-700 hover:underline whitespace-nowrap"
                    title="See this project as a To Do / In Progress / Review / Done board"
                  >
                    Open as board →
                  </a>
                  <span className="text-xs text-gray-500">{proj.taskCount} tasks</span>
                </div>
              </div>

              {isOpen && (
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
