"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";

interface Result {
  projects: { id: string; name: string }[];
  tasks: {
    id: string;
    title: string;
    projectId: string;
    projectName: string;
    isSubtask: boolean;
  }[];
}

export function GlobalSearch() {
  const router = useRouter();
  const [q, setQ] = useState("");
  const [res, setRes] = useState<Result>({ projects: [], tasks: [] });
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const boxRef = useRef<HTMLDivElement>(null);

  // Debounced fetch
  useEffect(() => {
    if (q.trim().length < 2) {
      setRes({ projects: [], tasks: [] });
      return;
    }
    setLoading(true);
    const id = setTimeout(() => {
      fetch(`/api/search?q=${encodeURIComponent(q.trim())}`)
        .then((r) => (r.ok ? r.json() : { projects: [], tasks: [] }))
        .then((d) => setRes(d))
        .catch(() => setRes({ projects: [], tasks: [] }))
        .finally(() => setLoading(false));
    }, 250);
    return () => clearTimeout(id);
  }, [q]);

  // Close on outside click
  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      if (boxRef.current && !boxRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, []);

  const go = (href: string) => {
    setOpen(false);
    setQ("");
    router.push(href);
  };

  const hasResults = res.projects.length > 0 || res.tasks.length > 0;

  return (
    <div ref={boxRef} className="relative w-full max-w-md">
      <div className="relative">
        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm">
          🔍
        </span>
        <input
          value={q}
          onChange={(e) => {
            setQ(e.target.value);
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          onKeyDown={(e) => e.key === "Escape" && setOpen(false)}
          placeholder="Search projects & tasks…"
          className="w-full bg-gray-50 border border-gray-200 rounded-lg pl-9 pr-3 py-2 text-sm focus:outline-none focus:border-red-400 focus:bg-white transition"
        />
      </div>

      {open && q.trim().length >= 2 && (
        <div className="absolute z-50 mt-1.5 w-full bg-white rounded-xl border border-gray-200 shadow-xl overflow-hidden max-h-[70vh] overflow-y-auto">
          {loading && !hasResults && (
            <div className="px-4 py-3 text-sm text-gray-400">Searching…</div>
          )}
          {!loading && !hasResults && (
            <div className="px-4 py-3 text-sm text-gray-400">
              No matches for “{q.trim()}”
            </div>
          )}

          {res.projects.length > 0 && (
            <div className="py-1">
              <div className="px-4 pt-2 pb-1 text-[10px] font-semibold uppercase tracking-wider text-gray-400">
                Projects
              </div>
              {res.projects.map((p) => (
                <button
                  key={p.id}
                  onClick={() => go(`/projects/${p.id}`)}
                  className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-red-50 hover:text-red-700 flex items-center gap-2"
                >
                  <span className="text-gray-400">📁</span>
                  <span className="truncate">{p.name}</span>
                </button>
              ))}
            </div>
          )}

          {res.tasks.length > 0 && (
            <div className="py-1 border-t border-gray-100">
              <div className="px-4 pt-2 pb-1 text-[10px] font-semibold uppercase tracking-wider text-gray-400">
                Tasks
              </div>
              {res.tasks.map((t) => (
                <button
                  key={t.id}
                  onClick={() => go(`/projects/${t.projectId}?task=${t.id}`)}
                  className="w-full text-left px-4 py-2 hover:bg-red-50 group flex items-start gap-2"
                >
                  <span className="text-gray-400 mt-0.5">
                    {t.isSubtask ? "↳" : "✓"}
                  </span>
                  <span className="min-w-0">
                    <span className="block text-sm text-gray-700 group-hover:text-red-700 truncate">
                      {t.title}
                    </span>
                    <span className="block text-xs text-gray-400 truncate">
                      {t.projectName}
                      {t.isSubtask ? " · subtask" : ""}
                    </span>
                  </span>
                </button>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
