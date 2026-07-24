"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { Select } from "@/components/ui/Select";
import { Button } from "@/components/ui/Button";
import { StatCard } from "@/components/ui/StatCard";
import { useToast } from "@/components/ui/Toast";
import {
  AlertTriangleIcon,
  BoardIcon,
  CalendarIcon,
  CheckIcon,
} from "@/components/ui/icons";

interface DashTask {
  id: string;
  title: string;
  status: string;
  priority: string;
  priorityNumber?: number | null;
  parked?: boolean;
  dueDate: string | null;
  projectId?: string;
  projectName?: string;
  subtotal: number;
  subdone: number;
  // Invited to this one task without project access.
  guest?: boolean;
  // A subtask assigned to you inside someone else's task.
  isSubtask?: boolean;
  parentTitle?: string | null;
}

interface DashProject {
  id: string;
  name: string;
  description: string | null;
  total: number;
  todo: number;
  inProgress: number;
  inReview: number;
  done: number;
}

const STATUS_LABELS: Record<string, string> = {
  TODO: "To Do",
  IN_PROGRESS: "In Progress",
  BLOCKED: "Blocked",
  IN_REVIEW: "In Review",
  DONE: "Done",
};

// Medium is the default priority — it earns no chip, so the chips that do
// appear (High, Low) actually mean something.
function PriorityChip({ priority }: { priority: string }) {
  if (priority === "HIGH")
    return (
      <span className="text-[11px] font-medium px-2 py-0.5 rounded-full bg-red-50 text-red-700 whitespace-nowrap">
        High
      </span>
    );
  if (priority === "LOW")
    return (
      <span className="text-[11px] font-medium px-2 py-0.5 rounded-full bg-gray-100 text-gray-600 whitespace-nowrap">
        Low
      </span>
    );
  return null;
}

function startOfToday() {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
}

function dueBucket(dueDate: string | null, status: string): string {
  if (status === "DONE") return "Completed";
  if (!dueDate) return "No due date";
  const due = new Date(dueDate);
  const today = startOfToday();
  const endOfToday = new Date(today);
  endOfToday.setHours(23, 59, 59, 999);
  const weekEnd = new Date(today);
  weekEnd.setDate(weekEnd.getDate() + 7);

  if (due < today) return "Overdue";
  if (due <= endOfToday) return "Today";
  if (due <= weekEnd) return "This week";
  return "Later";
}

const BUCKET_ORDER = ["Overdue", "Today", "This week", "Later", "No due date", "Completed"];

export default function DashboardPage() {
  const toast = useToast();
  const [data, setData] = useState<{
    name?: string;
    isAdmin?: boolean;
    tasks: DashTask[];
    projects: DashProject[];
  } | null>(null);
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState<"tasks" | "projects">("tasks");
  const [statusFilter, setStatusFilter] = useState<string>("ACTIVE");
  const [groupBy, setGroupBy] = useState<"due" | "status" | "project">("due");

  // Admin management widget (v2.5): multi-select to park, inline focus editing,
  // and a toggle to show/hide the greyed parked tasks.
  const [manageMode, setManageMode] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [showParked, setShowParked] = useState(true);
  const [editingFocus, setEditingFocus] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(() => {
    return fetch("/api/dashboard")
      .then((r) => (r.ok ? r.json() : { tasks: [], projects: [] }))
      .then(setData)
      .catch(() => setData({ tasks: [], projects: [] }));
  }, []);

  useEffect(() => {
    load().finally(() => setLoading(false));
  }, [load]);

  const isAdmin = !!data?.isAdmin;

  // Keep the selection to only tasks the admin can still see — changing the
  // status filter or hiding parked shouldn't leave off-screen ids selected
  // (bulk-park would then act on rows they can't see).
  useEffect(() => {
    setSelected((prev) => {
      if (prev.size === 0) return prev;
      const visible = new Set(
        (data?.tasks || [])
          .filter((t) => {
            if (t.parked && !showParked) return false;
            if (statusFilter === "ALL") return true;
            if (statusFilter === "ACTIVE") return t.status !== "DONE";
            return t.status === statusFilter;
          })
          .map((t) => t.id)
      );
      const next = [...prev].filter((id) => visible.has(id));
      return next.length === prev.size ? prev : new Set(next);
    });
  }, [statusFilter, showParked, data]);

  const toggleSelect = (id: string) => {
    if (busy) return;
    setSelected((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  // Bulk park / unpark the selected tasks (admin). Refetch so the greyed state
  // is authoritative from the server.
  const bulkPark = async (parked: boolean) => {
    const ids = [...selected];
    if (ids.length === 0) return;
    setBusy(true);
    try {
      const res = await fetch("/api/tasks/bulk-park", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ taskIds: ids, parked }),
      });
      if (!res.ok) throw new Error("bulk park failed");
      await load();
      setSelected(new Set());
      toast(
        parked
          ? `Parked ${ids.length} task${ids.length > 1 ? "s" : ""} — hidden from the board`
          : `${ids.length} task${ids.length > 1 ? "s" : ""} back on the board`
      );
    } catch {
      toast("Couldn't update those tasks. Please try again.", "error");
    } finally {
      setBusy(false);
    }
  };

  // Set a task's focus number inline (optimistic). Empty clears it.
  const setFocus = async (id: string, raw: string) => {
    setEditingFocus(null);
    const n = Number(raw);
    const value = raw.trim() === "" || !Number.isFinite(n) ? null : Math.min(99, Math.max(1, Math.round(n)));
    // No-op if unchanged — opening the editor and clicking away shouldn't PATCH.
    const current = (data?.tasks || []).find((t) => t.id === id)?.priorityNumber ?? null;
    if (value === current) return;
    // Optimistic local update.
    setData((prev) =>
      prev ? { ...prev, tasks: prev.tasks.map((t) => (t.id === id ? { ...t, priorityNumber: value } : t)) } : prev
    );
    try {
      const res = await fetch(`/api/tasks/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ priorityNumber: value }),
      });
      if (!res.ok) throw new Error("failed");
    } catch {
      toast("Couldn't save the focus number.", "error");
      load();
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="animate-spin h-8 w-8 border-2 border-red-500 border-t-transparent rounded-full" />
      </div>
    );
  }

  const tasks = data?.tasks || [];
  const projects = data?.projects || [];

  // Parked tasks are shelved — they don't count on your plate (stats/counts),
  // but admins still see them greyed in the list (v2.5).
  const living = tasks.filter((t) => !t.parked);
  const overdue = living.filter((t) => dueBucket(t.dueDate, t.status) === "Overdue").length;
  const dueToday = living.filter((t) => dueBucket(t.dueDate, t.status) === "Today").length;
  const done = living.filter((t) => t.status === "DONE").length;
  const active = living.filter((t) => t.status !== "DONE").length;
  const parkedCount = tasks.filter((t) => t.parked).length;

  // Apply status filter + the admin "show parked" toggle.
  const filteredTasks = tasks.filter((t) => {
    if (t.parked && !showParked) return false;
    if (statusFilter === "ALL") return true;
    if (statusFilter === "ACTIVE") return t.status !== "DONE";
    return t.status === statusFilter;
  });

  // Group. Parked tasks go into one "Parked" group at the bottom (rather than
  // scattering greyed into Overdue/Today/etc., which mismatched the stat counts
  // and put shelved work under a red "Overdue" header).
  const groups: Record<string, DashTask[]> = {};
  for (const t of filteredTasks) {
    let key: string;
    if (t.parked) key = "Parked";
    else if (groupBy === "due") key = dueBucket(t.dueDate, t.status);
    else if (groupBy === "status") key = STATUS_LABELS[t.status] || t.status;
    else key = t.projectName || "No project";
    (groups[key] ||= []).push(t);
  }
  const groupKeys = Object.keys(groups).sort((a, b) => {
    if (a === "Parked") return 1; // always last
    if (b === "Parked") return -1;
    if (groupBy === "due") return BUCKET_ORDER.indexOf(a) - BUCKET_ORDER.indexOf(b);
    return a.localeCompare(b);
  });

  const statusChips = [
    { key: "ACTIVE", label: "Active" },
    { key: "ALL", label: "All" },
    { key: "TODO", label: "To Do" },
    { key: "IN_PROGRESS", label: "In Progress" },
    { key: "BLOCKED", label: "Blocked" },
    { key: "IN_REVIEW", label: "In Review" },
    { key: "DONE", label: "Done" },
  ];

  return (
    <div className="max-w-5xl">
      <h2 className="text-2xl font-bold text-gray-900">
        Welcome back, {data?.name?.split(" ")[0] || "there"} 👋
      </h2>
      <p className="text-gray-500 text-sm mb-6">Here&apos;s what&apos;s on your plate.</p>

      {/* Stat cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
        <StatCard
          label="Assigned to me"
          value={active}
          icon={<BoardIcon size={18} />}
          tint="bg-gray-100 text-gray-500"
          accent="text-gray-900"
        />
        <StatCard
          label="Overdue"
          value={overdue}
          icon={<AlertTriangleIcon size={18} />}
          tint="bg-red-50 text-red-500"
          accent="text-red-600"
        />
        <StatCard
          label="Due today"
          value={dueToday}
          icon={<CalendarIcon size={18} />}
          tint="bg-amber-50 text-amber-500"
          accent="text-amber-600"
        />
        <StatCard
          label="Completed"
          value={done}
          icon={<CheckIcon size={18} />}
          tint="bg-green-50 text-green-600"
          accent="text-green-600"
        />
      </div>

      {/* View switcher — a segmented control, visually distinct from the
          status filter chips below so tabs and filters stop looking alike. */}
      <div className="inline-flex items-center rounded-lg bg-gray-100 p-0.5 mb-5" role="tablist">
        <SegmentButton active={view === "tasks"} onClick={() => setView("tasks")}>
          My tasks <span className="tabular-nums">({active})</span>
        </SegmentButton>
        <SegmentButton active={view === "projects"} onClick={() => setView("projects")}>
          My projects <span className="tabular-nums">({projects.length})</span>
        </SegmentButton>
      </div>

      {view === "tasks" ? (
        <>
          {/* Controls */}
          <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
            <div className="flex flex-wrap gap-1.5">
              {statusChips.map((c) => (
                <button
                  key={c.key}
                  onClick={() => setStatusFilter(c.key)}
                  className={`px-3 py-1 rounded-full text-xs font-medium transition focus:outline-none focus-visible:ring-2 focus-visible:ring-red-400 ${
                    statusFilter === c.key
                      ? "bg-red-600 text-white"
                      : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                  }`}
                >
                  {c.label}
                </button>
              ))}
            </div>
            <div className="flex items-center gap-2 text-sm">
              {/* Admin management widget (v2.5) */}
              {isAdmin && (
                <>
                  {parkedCount > 0 && (
                    <Button
                      variant={showParked ? "subtle" : "secondary"}
                      size="sm"
                      onClick={() => setShowParked((v) => !v)}
                      aria-pressed={showParked}
                    >
                      {showParked ? "Hide parked" : "Show parked"}
                      <span className="tabular-nums text-gray-400 ml-1">{parkedCount}</span>
                    </Button>
                  )}
                  <Button
                    variant={manageMode ? "primary" : "secondary"}
                    size="sm"
                    onClick={() => {
                      setManageMode((v) => !v);
                      setSelected(new Set());
                      setEditingFocus(null);
                    }}
                    aria-pressed={manageMode}
                  >
                    {manageMode ? "Done" : "Manage"}
                  </Button>
                </>
              )}
              <label htmlFor="dash-group-by" className="text-gray-500">
                Group by
              </label>
              <Select
                id="dash-group-by"
                value={groupBy}
                onChange={(e) => setGroupBy(e.target.value as any)}
                containerClassName="relative inline-block"
                className="!py-1.5"
              >
                <option value="due">Due date</option>
                <option value="status">Status</option>
                <option value="project">Project</option>
              </Select>
            </div>
          </div>

          {filteredTasks.length === 0 ? (
            <EmptyState text="No tasks here. When someone assigns you work, it'll show up automatically." />
          ) : (
            <div className="space-y-6">
              {groupKeys.map((key) => (
                <div key={key}>
                  <h3
                    className={`text-xs font-semibold uppercase tracking-wider mb-2 ${
                      key === "Overdue" ? "text-red-600" : "text-gray-400"
                    }`}
                  >
                    {key}{" "}
                    <span
                      className={`tabular-nums ${
                        key === "Overdue" ? "text-red-300" : "text-gray-300"
                      }`}
                    >
                      ({groups[key].length})
                    </span>
                  </h3>
                  {/* One bordered list per group, compact rows with a hairline
                      between them — calmer than a stack of separate cards. */}
                  <div className="bg-white rounded-lg border border-gray-200 divide-y divide-gray-100 overflow-hidden">
                    {groups[key].map((t) => {
                      const editable = !t.guest; // can set focus number
                      const selectable = isAdmin && !t.guest; // can bulk-park
                      return (
                        <div
                          key={t.id}
                          className={`flex items-center gap-2 px-3 py-2.5 transition ${
                            t.parked ? "bg-gray-50" : "hover:bg-gray-50"
                          }`}
                        >
                          {manageMode && selectable && (
                            <input
                              type="checkbox"
                              checked={selected.has(t.id)}
                              onChange={() => toggleSelect(t.id)}
                              disabled={busy}
                              aria-label={`Select ${t.title}`}
                              className="h-4 w-4 flex-shrink-0 rounded border-gray-300 accent-red-600 focus:outline-none focus-visible:ring-2 focus-visible:ring-red-400 disabled:opacity-50"
                            />
                          )}

                          {/* Focus # — editable badge on the left (read-only for
                              guests). Click to edit; 1 = do first. A management
                              control, so it stays crisp even on a parked row. */}
                          {editable ? (
                            editingFocus === t.id ? (
                              <input
                                type="number"
                                min={1}
                                max={99}
                                autoFocus
                                defaultValue={t.priorityNumber ?? ""}
                                onBlur={(e) => setFocus(t.id, e.target.value)}
                                onKeyDown={(e) => {
                                  if (e.key === "Enter") e.currentTarget.blur();
                                  if (e.key === "Escape") setEditingFocus(null);
                                }}
                                className="w-12 flex-shrink-0 text-center text-xs border border-gray-300 rounded-md px-1 py-1 bg-white focus:outline-none focus:border-red-400 focus:ring-2 focus:ring-red-100 tabular-nums"
                              />
                            ) : (
                              <button
                                onClick={() => setEditingFocus(t.id)}
                                title="Set focus number (1 = do first)"
                                aria-label="Set focus number"
                                className={`flex-shrink-0 inline-flex items-center justify-center min-w-[18px] h-[18px] px-1 rounded-md text-[11px] font-bold tabular-nums transition focus:outline-none focus-visible:ring-2 focus-visible:ring-red-400 ${
                                  t.priorityNumber != null
                                    ? "bg-gray-900 text-white"
                                    : "border border-dashed border-gray-300 text-gray-400 hover:text-gray-600 hover:border-gray-400"
                                }`}
                              >
                                {t.priorityNumber ?? "#"}
                              </button>
                            )
                          ) : (
                            t.priorityNumber != null && (
                              <span className="flex-shrink-0 inline-flex items-center justify-center min-w-[18px] h-[18px] px-1 rounded-md bg-gray-900 text-white text-[11px] font-bold tabular-nums">
                                {t.priorityNumber}
                              </span>
                            )
                          )}

                          {/* Dimmable content — one wrapper so a parked row greys
                              uniformly (checkbox, focus control and Parked chip
                              stay crisp). */}
                          <div className={`min-w-0 flex-1 flex items-center gap-2 ${t.parked ? "opacity-60" : ""}`}>
                            {/* Navigable title area (Link keeps cmd/middle-click) */}
                            <Link
                              href={t.guest ? `/tasks/${t.id}` : `/projects/${t.projectId}?task=${t.id}`}
                              className="min-w-0 flex-1 flex items-center gap-2 rounded focus:outline-none focus-visible:ring-2 focus-visible:ring-red-400"
                            >
                              {t.isSubtask && (
                                <span className="text-gray-400 flex-shrink-0" title="Subtask">
                                  ↳
                                </span>
                              )}
                              <p className="font-medium text-sm text-gray-900 truncate" title={t.title}>
                                {t.title}
                              </p>
                              {t.isSubtask && t.parentTitle && (
                                <span
                                  className="text-[11px] text-gray-400 truncate max-w-[200px]"
                                  title={`Subtask of “${t.parentTitle}”`}
                                >
                                  in “{t.parentTitle}”
                                </span>
                              )}
                              {t.subtotal > 0 && (
                                <span className="text-[11px] text-gray-400 whitespace-nowrap tabular-nums">
                                  ✓ {t.subdone}/{t.subtotal}
                                </span>
                              )}
                            </Link>

                            <span className="hidden sm:inline-block text-[11px] text-gray-500 bg-gray-100 px-2 py-0.5 rounded max-w-[160px] truncate">
                              {t.projectName}
                            </span>
                            {t.guest && (
                              <span
                                className="text-[11px] bg-purple-50 text-purple-700 px-2 py-0.5 rounded font-medium whitespace-nowrap"
                                title="You're a guest on this task — you see only this task, not its project"
                              >
                                Guest
                              </span>
                            )}
                            {groupBy !== "status" && (
                              <span className="hidden md:inline text-xs text-gray-400 whitespace-nowrap">
                                {STATUS_LABELS[t.status] || t.status}
                              </span>
                            )}
                            <PriorityChip priority={t.priority} />
                            {t.dueDate && (
                              <span
                                className={`text-xs whitespace-nowrap tabular-nums ${
                                  dueBucket(t.dueDate, t.status) === "Overdue"
                                    ? "text-red-600 font-medium"
                                    : "text-gray-500"
                                }`}
                              >
                                {new Date(t.dueDate).toLocaleDateString()}
                              </span>
                            )}
                          </div>

                          {/* Parked chip stays crisp so the reason for greying is
                              legible. */}
                          {t.parked && (
                            <span className="flex-shrink-0 text-[11px] font-medium px-1.5 py-0.5 rounded-full bg-gray-100 text-gray-600">
                              Parked
                            </span>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Sticky bulk action bar — appears when tasks are selected in
              Manage mode. Park hides them from the board; Unpark restores. */}
          {manageMode && selected.size > 0 && (
            <div className="sticky bottom-4 z-30 mt-4 flex items-center justify-between gap-3 rounded-xl border border-gray-200 bg-white shadow-lg px-4 py-2.5">
              <span className="text-sm text-gray-700">
                <span className="font-semibold tabular-nums">{selected.size}</span> selected
              </span>
              <div className="flex items-center gap-2">
                <Button variant="primary" size="sm" onClick={() => bulkPark(true)} disabled={busy}>
                  {busy ? "Working…" : "Park (hide)"}
                </Button>
                <Button variant="secondary" size="sm" onClick={() => bulkPark(false)} disabled={busy}>
                  Unpark
                </Button>
                <Button variant="ghost" size="sm" onClick={() => setSelected(new Set())} disabled={busy}>
                  Clear
                </Button>
              </div>
            </div>
          )}
        </>
      ) : projects.length === 0 ? (
        <EmptyState text="No projects assigned to you yet." />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {projects.map((p) => {
            const pct = p.total > 0 ? Math.round((p.done / p.total) * 100) : 0;
            return (
              <Link
                key={p.id}
                href={`/projects/${p.id}`}
                className="block bg-white rounded-lg border border-gray-200 hover:border-red-300 hover:shadow-md transition p-5 focus:outline-none focus-visible:ring-2 focus-visible:ring-red-400"
              >
                <h3 className="font-semibold text-gray-900 mb-1 line-clamp-2 break-words" title={p.name}>{p.name}</h3>
                {p.description && (
                  <p className="text-sm text-gray-500 mb-3 line-clamp-2">{p.description}</p>
                )}
                <div className="w-full h-2 bg-gray-100 rounded-full overflow-hidden mb-2">
                  <div className="h-full bg-green-500" style={{ width: `${pct}%` }} />
                </div>
                <div className="flex justify-between text-xs text-gray-500">
                  <span>{p.total} tasks</span>
                  <span>{pct}% done</span>
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}

function SegmentButton({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      role="tab"
      aria-selected={active}
      className={`px-4 py-1.5 rounded-md text-sm font-medium transition focus:outline-none focus-visible:ring-2 focus-visible:ring-red-400 ${
        active
          ? "bg-white text-gray-900 shadow-sm"
          : "text-gray-500 hover:text-gray-800"
      }`}
    >
      {children}
    </button>
  );
}

function EmptyState({ text }: { text: string }) {
  return (
    <div className="bg-white rounded-lg border border-dashed border-gray-300 p-10 text-center text-gray-500 text-sm">
      {text}
    </div>
  );
}
