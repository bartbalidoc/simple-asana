"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { formatDistanceToNow } from "date-fns";
import { StatCard } from "@/components/ui/StatCard";
import { AlertTriangleIcon, BoardIcon, CheckIcon, SearchIcon } from "@/components/ui/icons";

interface Person {
  id: string;
  name: string;
  email: string;
  role: string;
}

interface Cockpit {
  user: { id: string; name: string; email: string; role: string; isActive: boolean };
  metrics: {
    openCount: number;
    overdueCount: number;
    onTimePct: number | null;
    completedInWindow: number;
    commentsInWindow: number;
    lastLoginAt: string | null;
    lastActiveAt: string | null;
    planFilled: boolean;
    windowDays: number;
  };
  tasks: {
    id: string;
    title: string;
    status: string;
    priorityNumber: number | null;
    dueDate: string | null;
    overdue: boolean;
    projectId?: string;
    projectName?: string;
    subtotal: number;
    subdone: number;
  }[];
  plan: Record<string, { title: string; done: boolean }[]>;
}

const STATUS_LABELS: Record<string, string> = {
  TODO: "To Do",
  IN_PROGRESS: "In Progress",
  BLOCKED: "Blocked",
  IN_REVIEW: "In Review",
  DONE: "Done",
};

const QUADRANTS: { key: string; label: string }[] = [
  { key: "PRIORITY", label: "Priorities" },
  { key: "TODO", label: "To-dos" },
  { key: "CALL", label: "Calls / emails" },
];

const ago = (d: string | null) => (d ? formatDistanceToNow(new Date(d), { addSuffix: true }) : "never");

export default function TeamCockpitPage() {
  const [people, setPeople] = useState<Person[]>([]);
  const [q, setQ] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [cockpit, setCockpit] = useState<Cockpit | null>(null);
  const [loadingCockpit, setLoadingCockpit] = useState(false);
  const [cockpitError, setCockpitError] = useState(false);
  const [reloadToken, setReloadToken] = useState(0);

  useEffect(() => {
    fetch("/api/users")
      .then((r) => (r.ok ? r.json() : []))
      .then((u: Person[]) => {
        setPeople(u);
        // Auto-select the first non-admin member for a useful default.
        const first = u.find((x) => x.role === "MEMBER") || u[0];
        if (first) setSelectedId(first.id);
      })
      .catch(() => setPeople([]));
  }, []);

  useEffect(() => {
    if (!selectedId) return;
    // Guard against out-of-order responses when switching people quickly.
    let active = true;
    setLoadingCockpit(true);
    setCockpitError(false);
    setCockpit(null);
    fetch(`/api/admin/team?userId=${selectedId}`)
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error("failed"))))
      .then((d) => {
        if (active) setCockpit(d);
      })
      .catch(() => {
        if (active) setCockpitError(true);
      })
      .finally(() => {
        if (active) setLoadingCockpit(false);
      });
    return () => {
      active = false;
    };
  }, [selectedId, reloadToken]);

  const filteredPeople = people.filter(
    (p) =>
      !q ||
      (p.name || "").toLowerCase().includes(q.toLowerCase()) ||
      (p.email || "").toLowerCase().includes(q.toLowerCase())
  );

  return (
    <div className="max-w-6xl">
      <h2 className="text-2xl font-bold text-gray-900">Team</h2>
      <p className="text-gray-500 text-sm mb-6">
        Pick a person to see what they&apos;re working on, how they&apos;re tracking, and
        today&apos;s plan.
      </p>

      <div className="grid grid-cols-1 lg:grid-cols-[260px_1fr] gap-6">
        {/* Person picker */}
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden h-fit">
          <div className="p-2 border-b border-gray-100">
            <div className="relative">
              <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400">
                <SearchIcon size={14} />
              </span>
              <input
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="Find a person…"
                aria-label="Find a person"
                className="w-full bg-gray-50 border border-gray-200 rounded-lg pl-8 pr-2 py-1.5 text-sm focus:outline-none focus:border-red-400 focus:bg-white transition"
              />
            </div>
          </div>
          <div className="max-h-[70vh] overflow-y-auto">
            {filteredPeople.map((p) => (
              <button
                key={p.id}
                onClick={() => setSelectedId(p.id)}
                className={`w-full text-left px-3 py-2.5 border-b border-gray-100 transition focus:outline-none focus-visible:ring-2 focus-visible:ring-red-400 focus-visible:ring-inset ${
                  selectedId === p.id ? "bg-red-50" : "hover:bg-gray-50"
                }`}
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="text-sm font-medium text-gray-900 truncate">{p.name}</span>
                  {p.role === "ADMIN" && (
                    <span className="text-[10px] font-bold uppercase bg-gray-100 text-gray-500 px-1.5 py-0.5 rounded-full">
                      Admin
                    </span>
                  )}
                </div>
                <span className="block text-[11px] text-gray-400 truncate">{p.email}</span>
              </button>
            ))}
            {filteredPeople.length === 0 && (
              <p className="p-4 text-sm text-gray-400">No one matches.</p>
            )}
          </div>
        </div>

        {/* Cockpit */}
        <div className="min-w-0">
          {loadingCockpit ? (
            <div className="flex items-center justify-center h-64">
              <div className="animate-spin h-8 w-8 border-2 border-red-500 border-t-transparent rounded-full" />
            </div>
          ) : cockpitError ? (
            <div className="bg-white rounded-xl border border-red-200 bg-red-50/40 p-6 text-center text-sm text-red-700">
              Couldn&apos;t load this person&apos;s cockpit.{" "}
              <button
                onClick={() => setReloadToken((t) => t + 1)}
                className="font-semibold underline hover:no-underline focus:outline-none focus-visible:ring-2 focus-visible:ring-red-400 rounded"
              >
                Try again
              </button>
            </div>
          ) : !cockpit ? (
            <div className="bg-white rounded-xl border border-dashed border-gray-300 p-10 text-center text-gray-500 text-sm">
              Pick a person on the left to see their tasks, metrics, and today's plan.
            </div>
          ) : (
            <div className="space-y-6">
              {/* Header */}
              <div>
                <h3 className="text-lg font-bold text-gray-900">{cockpit.user.name}</h3>
                <p className="text-sm text-gray-500">
                  Last active {ago(cockpit.metrics.lastActiveAt)} · last login{" "}
                  {ago(cockpit.metrics.lastLoginAt)}
                </p>
              </div>

              {/* Metrics */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <StatCard
                  label="Open tasks"
                  value={cockpit.metrics.openCount}
                  icon={<BoardIcon size={18} />}
                  tint="bg-gray-100 text-gray-500"
                  accent="text-gray-900"
                />
                <StatCard
                  label="Overdue"
                  value={cockpit.metrics.overdueCount}
                  icon={<AlertTriangleIcon size={18} />}
                  tint="bg-red-50 text-red-500"
                  accent={cockpit.metrics.overdueCount > 0 ? "text-red-600" : "text-gray-900"}
                />
                <StatCard
                  label={`On-time (${cockpit.metrics.windowDays}d)`}
                  value={cockpit.metrics.onTimePct == null ? "—" : `${cockpit.metrics.onTimePct}%`}
                  icon={<CheckIcon size={18} />}
                  tint="bg-gray-100 text-gray-500"
                  accent={
                    cockpit.metrics.onTimePct == null
                      ? "text-gray-400"
                      : cockpit.metrics.onTimePct >= 80
                      ? "text-green-600"
                      : cockpit.metrics.onTimePct >= 50
                      ? "text-amber-600"
                      : "text-red-600"
                  }
                />
                <StatCard
                  label={`Completed (${cockpit.metrics.windowDays}d)`}
                  value={cockpit.metrics.completedInWindow}
                  icon={<CheckIcon size={18} />}
                  tint="bg-green-50 text-green-600"
                  accent="text-gray-900"
                />
              </div>

              {/* Open tasks */}
              <div>
                <h4 className="text-xs font-semibold uppercase tracking-wider text-gray-400 mb-2">
                  Open tasks{" "}
                  <span className="text-gray-300 tabular-nums">({cockpit.tasks.length})</span>
                </h4>
                {cockpit.tasks.length === 0 ? (
                  <div className="bg-white rounded-lg border border-gray-200 p-5 text-sm text-gray-400">
                    Nothing open — all clear.
                  </div>
                ) : (
                  <div className="bg-white rounded-lg border border-gray-200 divide-y divide-gray-100 overflow-hidden">
                    {cockpit.tasks.map((t) => (
                      <Link
                        key={t.id}
                        href={`/projects/${t.projectId}?task=${t.id}`}
                        className="flex items-center gap-2 px-4 py-2.5 hover:bg-gray-50 transition focus:outline-none focus-visible:ring-2 focus-visible:ring-red-400 focus-visible:ring-inset"
                      >
                        {t.priorityNumber != null && (
                          <span className="flex-shrink-0 inline-flex items-center justify-center min-w-[18px] h-[18px] px-1 rounded-md bg-gray-900 text-white text-[11px] font-bold tabular-nums">
                            {t.priorityNumber}
                          </span>
                        )}
                        <span className="min-w-0 flex-1 truncate text-sm font-medium text-gray-900" title={t.title}>
                          {t.title}
                        </span>
                        {t.subtotal > 0 && (
                          <span className="text-[11px] text-gray-400 whitespace-nowrap tabular-nums">
                            ✓ {t.subdone}/{t.subtotal}
                          </span>
                        )}
                        <span className="hidden sm:inline-block text-[11px] text-gray-500 bg-gray-100 px-2 py-0.5 rounded max-w-[150px] truncate">
                          {t.projectName}
                        </span>
                        <span className="hidden md:inline text-xs text-gray-400 whitespace-nowrap">
                          {STATUS_LABELS[t.status] || t.status}
                        </span>
                        {t.dueDate && (
                          <span
                            className={`text-xs whitespace-nowrap tabular-nums ${
                              t.overdue ? "text-red-600 font-medium" : "text-gray-500"
                            }`}
                          >
                            {new Date(t.dueDate).toLocaleDateString()}
                          </span>
                        )}
                      </Link>
                    ))}
                  </div>
                )}
              </div>

              {/* Today's plan */}
              <div>
                <h4 className="text-xs font-semibold uppercase tracking-wider text-gray-400 mb-2">
                  Today&apos;s plan{" "}
                  {!cockpit.metrics.planFilled && (
                    <span className="text-gray-300 normal-case font-normal">· not filled in yet</span>
                  )}
                </h4>
                {!cockpit.metrics.planFilled ? (
                  <div className="bg-white rounded-lg border border-gray-200 p-5 text-sm text-gray-400">
                    {cockpit.user.name.split(" ")[0]} hasn&apos;t planned their day yet.
                  </div>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    {QUADRANTS.map((quad) => (
                      <div key={quad.key} className="bg-white rounded-lg border border-gray-200 p-4">
                        <p className="text-[11px] font-semibold uppercase tracking-wide text-gray-400 mb-2">
                          {quad.label}
                        </p>
                        {(cockpit.plan[quad.key] || []).length === 0 ? (
                          <p className="text-xs text-gray-300">—</p>
                        ) : (
                          <ul className="space-y-1.5">
                            {(cockpit.plan[quad.key] || []).map((it, i) => (
                              <li key={i} className="flex items-start gap-1.5 text-sm">
                                <span
                                  className={`mt-0.5 flex-shrink-0 ${
                                    it.done ? "text-green-600" : "text-gray-300"
                                  }`}
                                >
                                  <CheckIcon size={13} />
                                </span>
                                <span className={it.done ? "text-gray-400 line-through" : "text-gray-700"}>
                                  {it.title}
                                </span>
                              </li>
                            ))}
                          </ul>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

