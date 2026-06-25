"use client";

import { useState, useEffect } from "react";
import Link from "next/link";

interface DashTask {
  id: string;
  title: string;
  status: string;
  priority: string;
  dueDate: string | null;
  projectId?: string;
  projectName?: string;
  subtotal: number;
  subdone: number;
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
  IN_REVIEW: "In Review",
  DONE: "Done",
};

function priorityClasses(priority: string) {
  if (priority === "HIGH") return "bg-red-100 text-red-800";
  if (priority === "LOW") return "bg-green-100 text-green-800";
  return "bg-yellow-100 text-yellow-800";
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

  useEffect(() => {
    fetch("/api/dashboard")
      .then((r) => (r.ok ? r.json() : { tasks: [], projects: [] }))
      .then(setData)
      .catch(() => setData({ tasks: [], projects: [] }))
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="animate-spin h-8 w-8 border-2 border-red-500 border-t-transparent rounded-full" />
      </div>
    );
  }

  const tasks = data?.tasks || [];
  const projects = data?.projects || [];

  const overdue = tasks.filter((t) => dueBucket(t.dueDate, t.status) === "Overdue").length;
  const dueToday = tasks.filter((t) => dueBucket(t.dueDate, t.status) === "Today").length;
  const done = tasks.filter((t) => t.status === "DONE").length;
  const active = tasks.filter((t) => t.status !== "DONE").length;

  // Apply status filter
  const filteredTasks = tasks.filter((t) => {
    if (statusFilter === "ALL") return true;
    if (statusFilter === "ACTIVE") return t.status !== "DONE";
    return t.status === statusFilter;
  });

  // Group
  const groups: Record<string, DashTask[]> = {};
  for (const t of filteredTasks) {
    let key: string;
    if (groupBy === "due") key = dueBucket(t.dueDate, t.status);
    else if (groupBy === "status") key = STATUS_LABELS[t.status] || t.status;
    else key = t.projectName || "No project";
    (groups[key] ||= []).push(t);
  }
  const groupKeys = Object.keys(groups).sort((a, b) => {
    if (groupBy === "due") return BUCKET_ORDER.indexOf(a) - BUCKET_ORDER.indexOf(b);
    return a.localeCompare(b);
  });

  const statusChips = [
    { key: "ACTIVE", label: "Active" },
    { key: "ALL", label: "All" },
    { key: "TODO", label: "To Do" },
    { key: "IN_PROGRESS", label: "In Progress" },
    { key: "IN_REVIEW", label: "In Review" },
    { key: "DONE", label: "Done" },
  ];

  return (
    <div>
      <h2 className="text-2xl font-bold text-gray-900">
        Welcome back, {data?.name?.split(" ")[0] || "there"} 👋
      </h2>
      <p className="text-gray-500 text-sm mb-6">Here&apos;s what&apos;s on your plate.</p>

      {/* Stat cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
        <StatCard label="Assigned to me" value={active} accent="text-gray-900" />
        <StatCard label="Overdue" value={overdue} accent="text-red-600" />
        <StatCard label="Due today" value={dueToday} accent="text-amber-600" />
        <StatCard label="Completed" value={done} accent="text-green-600" />
      </div>

      {/* View toggle */}
      <div className="flex items-center gap-2 mb-5">
        <TabButton active={view === "tasks"} onClick={() => setView("tasks")}>
          My Tasks ({active})
        </TabButton>
        <TabButton active={view === "projects"} onClick={() => setView("projects")}>
          My Projects ({projects.length})
        </TabButton>
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
                  className={`px-3 py-1 rounded-full text-xs font-medium transition ${
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
              <span className="text-gray-500">Group by</span>
              <select
                value={groupBy}
                onChange={(e) => setGroupBy(e.target.value as any)}
                className="border border-gray-300 rounded px-2 py-1 text-sm focus:outline-none focus:border-red-500"
              >
                <option value="due">Due date</option>
                <option value="status">Status</option>
                <option value="project">Project</option>
              </select>
            </div>
          </div>

          {filteredTasks.length === 0 ? (
            <EmptyState text="No tasks here. When someone assigns you work, it'll show up automatically." />
          ) : (
            <div className="space-y-6">
              {groupKeys.map((key) => (
                <div key={key}>
                  <h3 className="text-xs font-semibold uppercase tracking-wider text-gray-400 mb-2">
                    {key} <span className="text-gray-300">({groups[key].length})</span>
                  </h3>
                  <div className="space-y-2">
                    {groups[key].map((t) => (
                      <Link
                        key={t.id}
                        href={`/projects/${t.projectId}?task=${t.id}`}
                        className="block bg-white rounded-lg border border-gray-200 hover:border-red-300 hover:shadow-sm transition p-4"
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <p className="font-medium text-gray-900 line-clamp-2 break-words" title={t.title}>{t.title}</p>
                            <div className="flex items-center gap-2 mt-1 text-xs text-gray-500">
                              <span className="bg-gray-100 px-2 py-0.5 rounded">
                                {t.projectName}
                              </span>
                              <span>{STATUS_LABELS[t.status] || t.status}</span>
                              {t.subtotal > 0 && (
                                <span>
                                  ✓ {t.subdone}/{t.subtotal}
                                </span>
                              )}
                            </div>
                          </div>
                          <div className="flex flex-col items-end gap-1 shrink-0">
                            <span
                              className={`text-[10px] px-2 py-0.5 rounded ${priorityClasses(
                                t.priority
                              )}`}
                            >
                              {t.priority}
                            </span>
                            {t.dueDate && (
                              <span
                                className={`text-xs ${
                                  dueBucket(t.dueDate, t.status) === "Overdue"
                                    ? "text-red-600 font-medium"
                                    : "text-gray-500"
                                }`}
                              >
                                {new Date(t.dueDate).toLocaleDateString()}
                              </span>
                            )}
                          </div>
                        </div>
                      </Link>
                    ))}
                  </div>
                </div>
              ))}
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
                className="block bg-white rounded-lg border border-gray-200 hover:border-red-300 hover:shadow-md transition p-5"
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

function StatCard({ label, value, accent }: { label: string; value: number; accent: string }) {
  return (
    <div className="bg-white rounded-lg border border-gray-200 p-4">
      <div className={`text-3xl font-bold ${accent}`}>{value}</div>
      <div className="text-xs text-gray-500 mt-1">{label}</div>
    </div>
  );
}

function TabButton({
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
      className={`px-4 py-2 rounded-lg text-sm font-medium transition ${
        active ? "bg-red-600 text-white" : "bg-white border border-gray-200 text-gray-600 hover:bg-gray-50"
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
