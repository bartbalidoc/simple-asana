"use client";

import { useEffect, useMemo, useState } from "react";

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
  recent: { id: string; text: string; relativeTime: string }[];
}

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

export default function ActivityPage() {
  const [data, setData] = useState<ActivityData | null>(null);
  const [loading, setLoading] = useState(true);

  // filters
  const [timeMode, setTimeMode] = useState<"7" | "30" | "90" | "custom">("7");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [userId, setUserId] = useState("");
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
    if (userId) params.set("userId", userId);
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
  }, [timeMode, from, to, userId, role, projectId, engagement]);

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
    setUserId("");
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
    timeMode !== "7" || userId || role || projectId || engagement;

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

        <select value={userId} onChange={(e) => setUserId(e.target.value)} className="border border-gray-300 rounded-lg px-2 py-1.5 text-sm text-gray-700 focus:outline-none focus:border-red-500">
          <option value="">Everyone</option>
          {people.map((p) => (
            <option key={p.id} value={p.id}>{p.name}</option>
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

          {/* Recent activity feed */}
          <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-4">
            <h3 className="text-sm font-semibold text-gray-900 mb-3">Recent activity</h3>
            {data.recent.length === 0 ? (
              <p className="text-sm text-gray-400">No activity in this window.</p>
            ) : (
              <ul className="space-y-1.5">
                {data.recent.map((r) => (
                  <li key={r.id} className="flex items-center gap-2 text-sm">
                    <span className="h-1.5 w-1.5 rounded-full bg-red-400 flex-shrink-0" />
                    <span className="text-gray-700">{r.text}</span>
                    <span className="text-xs text-gray-400 ml-auto whitespace-nowrap">{r.relativeTime}</span>
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
