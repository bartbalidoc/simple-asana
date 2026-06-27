"use client";

import { useEffect, useMemo, useRef, useState } from "react";

interface ActivityUser {
  id: string;
  name: string;
  email: string;
  role: string;
  lastLoginAt: string | null;
  lastActiveAt: string | null;
  logins: number;
  activeDays: number;
  tasksCreated: number;
  tasksCompleted: number;
  commentsWritten: number;
  tasksUpdated: number;
  activitySpark: number[];
}
interface ActivityData {
  summary: {
    activeUsers: number;
    totalLogins: number;
    tasksCompleted: number;
    tasksCreated: number;
    commentsWritten: number;
  };
  users: ActivityUser[];
  recent: { id: string; text: string; relativeTime: string; occurredAt: string }[];
}

const ACTIVITY_TYPES = [
  { value: "", label: "All activity" },
  { value: "USER_LOGIN", label: "Logins" },
  { value: "TASK_CREATED", label: "Tasks created" },
  { value: "TASK_UPDATED", label: "Task updates" },
  { value: "TASK_VIEWED", label: "Task opens" },
  { value: "COMMENT_CREATED", label: "Comments" },
];

type SortKey =
  | "name"
  | "lastLoginAt"
  | "lastActiveAt"
  | "logins"
  | "activeDays"
  | "tasksCreated"
  | "tasksCompleted"
  | "commentsWritten";

function Spark({ data }: { data: number[] }) {
  const max = Math.max(1, ...data);
  const total = data.reduce((a, b) => a + b, 0);
  return (
    <div className="flex items-end gap-0.5 h-6" title={`${total} actions in last 14 days`}>
      {data.map((v, i) => (
        <div
          key={i}
          className="w-1 rounded-sm bg-red-400"
          style={{ height: `${Math.max(8, (v / max) * 100)}%`, opacity: v ? 1 : 0.2 }}
        />
      ))}
    </div>
  );
}

function StatCard({ label, value, accent }: { label: string; value: number; accent?: string }) {
  return (
    <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-4">
      <div className={`text-3xl font-bold ${accent || "text-gray-900"}`}>{value}</div>
      <div className="text-xs text-gray-500 mt-1">{label}</div>
    </div>
  );
}

const fmtDate = (s: string | null) =>
  s ? new Date(s).toLocaleDateString(undefined, { month: "short", day: "numeric" }) : "Never";

const fmtDateTime = (s: string) =>
  new Date(s).toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });

// Compact multi-select dropdown for people (button + checkbox popover).
function PeopleSelect({
  people,
  selected,
  onChange,
}: {
  people: { id: string; name: string }[];
  selected: string[];
  onChange: (ids: string[]) => void;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, []);
  const toggle = (id: string) =>
    onChange(selected.includes(id) ? selected.filter((x) => x !== id) : [...selected, id]);
  const label =
    selected.length === 0
      ? "Everyone"
      : selected.length === 1
      ? people.find((p) => p.id === selected[0])?.name || "1 person"
      : `${selected.length} people`;
  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen((o) => !o)}
        className="border border-gray-300 rounded-lg px-2 py-1.5 text-sm text-gray-700 focus:outline-none focus:border-red-500 min-w-[120px] text-left flex items-center justify-between gap-2"
      >
        <span className="truncate">{label}</span>
        <span className="text-gray-400 text-xs">▾</span>
      </button>
      {open && (
        <div className="absolute z-50 mt-1 w-56 max-h-72 overflow-y-auto bg-white border border-gray-200 rounded-lg shadow-xl p-1">
          {selected.length > 0 && (
            <button
              onClick={() => onChange([])}
              className="w-full text-left px-2 py-1.5 text-xs text-gray-500 hover:text-red-600"
            >
              Clear selection
            </button>
          )}
          {people.map((p) => (
            <label
              key={p.id}
              className="flex items-center gap-2 px-2 py-1.5 rounded-md hover:bg-gray-50 cursor-pointer text-sm text-gray-700"
            >
              <input
                type="checkbox"
                checked={selected.includes(p.id)}
                onChange={() => toggle(p.id)}
                className="accent-red-600"
              />
              <span className="truncate">{p.name}</span>
            </label>
          ))}
        </div>
      )}
    </div>
  );
}

export default function ActivityPage() {
  const [data, setData] = useState<ActivityData | null>(null);
  const [loading, setLoading] = useState(true);

  // filters
  const [timeMode, setTimeMode] = useState<"7" | "30" | "90" | "custom">("7");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [userIds, setUserIds] = useState<string[]>([]);
  const [actionType, setActionType] = useState("");
  const [role, setRole] = useState("");
  const [projectId, setProjectId] = useState("");
  const [engagement, setEngagement] = useState("");

  // dropdown sources
  const [people, setPeople] = useState<{ id: string; name: string }[]>([]);
  const [projects, setProjects] = useState<{ id: string; name: string }[]>([]);

  // sort
  const [sortKey, setSortKey] = useState<SortKey>("lastActiveAt");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");

  useEffect(() => {
    fetch("/api/users")
      .then((r) => (r.ok ? r.json() : []))
      .then((u) => setPeople(Array.isArray(u) ? u : []))
      .catch(() => {});
    fetch("/api/projects")
      .then((r) => (r.ok ? r.json() : []))
      .then((p) => setProjects(Array.isArray(p) ? p.map((x: any) => ({ id: x.id, name: x.name })) : []))
      .catch(() => {});
  }, []);

  useEffect(() => {
    const params = new URLSearchParams();
    if (timeMode === "custom") {
      if (!from || !to) return; // wait for both
      params.set("from", from);
      params.set("to", to);
    } else {
      params.set("days", timeMode);
    }
    if (userIds.length) params.set("userId", userIds.join(","));
    if (actionType) params.set("action", actionType);
    if (role) params.set("role", role);
    if (projectId) params.set("projectId", projectId);
    if (engagement) params.set("engagement", engagement);

    setLoading(true);
    const id = setTimeout(() => {
      fetch(`/api/admin/activity?${params.toString()}`)
        .then((r) => (r.ok ? r.json() : null))
        .then(setData)
        .catch(() => setData(null))
        .finally(() => setLoading(false));
    }, 200);
    return () => clearTimeout(id);
  }, [timeMode, from, to, userIds, actionType, role, projectId, engagement]);

  const sortedUsers = useMemo(() => {
    if (!data) return [];
    const arr = [...data.users];
    arr.sort((a, b) => {
      let av: any = a[sortKey];
      let bv: any = b[sortKey];
      if (sortKey === "name") {
        av = a.name.toLowerCase();
        bv = b.name.toLowerCase();
      } else if (sortKey === "lastLoginAt" || sortKey === "lastActiveAt") {
        av = av ? new Date(av).getTime() : 0;
        bv = bv ? new Date(bv).getTime() : 0;
      }
      if (av < bv) return sortDir === "asc" ? -1 : 1;
      if (av > bv) return sortDir === "asc" ? 1 : -1;
      return 0;
    });
    return arr;
  }, [data, sortKey, sortDir]);

  const toggleSort = (k: SortKey) => {
    if (sortKey === k) setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    else {
      setSortKey(k);
      setSortDir(k === "name" ? "asc" : "desc");
    }
  };

  const clearFilters = () => {
    setTimeMode("7");
    setFrom("");
    setTo("");
    setUserIds([]);
    setActionType("");
    setRole("");
    setProjectId("");
    setEngagement("");
  };

  const Th = ({ k, label, right }: { k: SortKey; label: string; right?: boolean }) => (
    <th
      onClick={() => toggleSort(k)}
      className={`px-3 py-2 font-semibold text-gray-500 cursor-pointer select-none whitespace-nowrap hover:text-gray-800 ${
        right ? "text-right" : "text-left"
      }`}
    >
      {label}
      {sortKey === k ? (sortDir === "asc" ? " ↑" : " ↓") : ""}
    </th>
  );

  const filtersActive =
    timeMode !== "7" ||
    userIds.length > 0 ||
    actionType ||
    role ||
    projectId ||
    engagement;

  return (
    <div>
      <div className="mb-5">
        <h1 className="text-2xl font-bold text-gray-900">Team Activity</h1>
        <p className="text-sm text-gray-500 mt-1">
          Who&apos;s logging in and working on the projects. Login history is tracked from
          when this was switched on.
        </p>
      </div>

      {/* Filter bar */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-3 mb-6 flex flex-wrap items-center gap-2">
        <div className="inline-flex rounded-lg border border-gray-200 p-0.5">
          {(["7", "30", "90", "custom"] as const).map((m) => (
            <button
              key={m}
              onClick={() => setTimeMode(m)}
              className={`px-3 py-1.5 rounded-md text-sm font-medium transition ${
                timeMode === m ? "bg-red-600 text-white" : "text-gray-600 hover:text-gray-900"
              }`}
            >
              {m === "custom" ? "Custom" : `${m}d`}
            </button>
          ))}
        </div>
        {timeMode === "custom" && (
          <>
            <input
              type="date"
              value={from}
              onChange={(e) => setFrom(e.target.value)}
              className="border border-gray-300 rounded-lg px-2 py-1.5 text-sm focus:outline-none focus:border-red-500"
            />
            <span className="text-gray-400 text-sm">to</span>
            <input
              type="date"
              value={to}
              onChange={(e) => setTo(e.target.value)}
              className="border border-gray-300 rounded-lg px-2 py-1.5 text-sm focus:outline-none focus:border-red-500"
            />
          </>
        )}

        <PeopleSelect people={people} selected={userIds} onChange={setUserIds} />

        <select value={actionType} onChange={(e) => setActionType(e.target.value)} className="border border-gray-300 rounded-lg px-2 py-1.5 text-sm text-gray-700 focus:outline-none focus:border-red-500">
          {ACTIVITY_TYPES.map((a) => (
            <option key={a.value} value={a.value}>{a.label}</option>
          ))}
        </select>

        <select value={role} onChange={(e) => setRole(e.target.value)} className="border border-gray-300 rounded-lg px-2 py-1.5 text-sm text-gray-700 focus:outline-none focus:border-red-500">
          <option value="">All roles</option>
          <option value="ADMIN">Admins</option>
          <option value="MEMBER">Members</option>
        </select>

        <select value={projectId} onChange={(e) => setProjectId(e.target.value)} className="border border-gray-300 rounded-lg px-2 py-1.5 text-sm text-gray-700 focus:outline-none focus:border-red-500 max-w-[180px]">
          <option value="">All projects</option>
          {projects.map((p) => (
            <option key={p.id} value={p.id}>{p.name}</option>
          ))}
        </select>

        <select value={engagement} onChange={(e) => setEngagement(e.target.value)} className="border border-gray-300 rounded-lg px-2 py-1.5 text-sm text-gray-700 focus:outline-none focus:border-red-500">
          <option value="">Any engagement</option>
          <option value="active">Active</option>
          <option value="inactive">Inactive</option>
          <option value="never">Never logged in</option>
        </select>

        {filtersActive && (
          <button onClick={clearFilters} className="text-sm text-gray-500 hover:text-red-600 ml-auto">
            Clear filters
          </button>
        )}
      </div>

      {loading && !data ? (
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin h-8 w-8 border-2 border-red-500 border-t-transparent rounded-full" />
        </div>
      ) : !data ? (
        <div className="bg-white rounded-xl border border-gray-200 p-6 text-center text-gray-500">
          Couldn&apos;t load activity.
        </div>
      ) : (
        <>
          {/* Summary cards */}
          <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-6">
            <StatCard label="Active people" value={data.summary.activeUsers} />
            <StatCard label="Logins" value={data.summary.totalLogins} accent="text-blue-600" />
            <StatCard label="Tasks completed" value={data.summary.tasksCompleted} accent="text-green-600" />
            <StatCard label="Tasks created" value={data.summary.tasksCreated} />
            <StatCard label="Comments" value={data.summary.commentsWritten} accent="text-amber-600" />
          </div>

          {/* Team table */}
          <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-x-auto mb-6">
            <table className="w-full text-sm">
              <thead className="border-b border-gray-100 bg-gray-50/50">
                <tr>
                  <Th k="name" label="Person" />
                  <Th k="lastLoginAt" label="Last login" />
                  <Th k="lastActiveAt" label="Last active" />
                  <Th k="logins" label="Logins" right />
                  <Th k="activeDays" label="Active days" right />
                  <Th k="tasksCreated" label="Created" right />
                  <Th k="tasksCompleted" label="Completed" right />
                  <Th k="commentsWritten" label="Comments" right />
                  <th className="px-3 py-2 font-semibold text-gray-500 text-left">14-day</th>
                </tr>
              </thead>
              <tbody>
                {sortedUsers.map((u) => {
                  const inactive = u.activeDays === 0 && u.logins === 0;
                  return (
                    <tr
                      key={u.id}
                      className={`border-b border-gray-50 last:border-0 ${inactive ? "opacity-60" : ""}`}
                    >
                      <td className="px-3 py-2.5">
                        <div className="font-medium text-gray-900 flex items-center gap-2">
                          {u.name}
                          {u.role === "ADMIN" && (
                            <span className="text-[9px] font-bold uppercase bg-red-100 text-red-700 px-1.5 py-0.5 rounded-full">
                              Admin
                            </span>
                          )}
                          {inactive && (
                            <span className="text-[9px] font-medium uppercase bg-gray-100 text-gray-500 px-1.5 py-0.5 rounded-full">
                              Inactive
                            </span>
                          )}
                        </div>
                        <div className="text-xs text-gray-400">{u.email}</div>
                      </td>
                      <td className="px-3 py-2.5 text-gray-600 whitespace-nowrap">{fmtDate(u.lastLoginAt)}</td>
                      <td className="px-3 py-2.5 text-gray-600 whitespace-nowrap">{fmtDate(u.lastActiveAt)}</td>
                      <td className="px-3 py-2.5 text-right text-gray-700">{u.logins}</td>
                      <td className="px-3 py-2.5 text-right text-gray-700">{u.activeDays}</td>
                      <td className="px-3 py-2.5 text-right text-gray-700">{u.tasksCreated}</td>
                      <td className="px-3 py-2.5 text-right font-medium text-green-700">{u.tasksCompleted}</td>
                      <td className="px-3 py-2.5 text-right text-gray-700">{u.commentsWritten}</td>
                      <td className="px-3 py-2.5"><Spark data={u.activitySpark} /></td>
                    </tr>
                  );
                })}
                {sortedUsers.length === 0 && (
                  <tr>
                    <td colSpan={9} className="px-3 py-6 text-center text-gray-400">
                      No people match these filters.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          {/* Activity / event log */}
          <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-4">
            <h3 className="text-sm font-semibold text-gray-900 mb-3">
              {actionType
                ? `${ACTIVITY_TYPES.find((a) => a.value === actionType)?.label} log`
                : "Recent activity"}
            </h3>
            {data.recent.length === 0 ? (
              <p className="text-sm text-gray-400">No activity in this window.</p>
            ) : (
              <ul className="divide-y divide-gray-50">
                {data.recent.map((r) => (
                  <li key={r.id} className="flex items-center gap-3 text-sm py-1.5">
                    <span className="h-1.5 w-1.5 rounded-full bg-red-400 flex-shrink-0" />
                    <span className="text-gray-700 flex-1 min-w-0 truncate">{r.text}</span>
                    <span className="text-xs text-gray-600 tabular-nums whitespace-nowrap">
                      {fmtDateTime(r.occurredAt)}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </>
      )}
    </div>
  );
}
