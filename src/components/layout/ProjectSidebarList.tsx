"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";

interface SidebarProject {
  id: string;
  name: string;
}

// Live list of the signed-in user's projects, shown indented under the
// "Projects" nav item (Asana-style left nav). Staging projects are already
// excluded by /api/projects, so they never appear here.
export function ProjectSidebarList() {
  const pathname = usePathname();
  const [projects, setProjects] = useState<SidebarProject[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    fetch("/api/projects")
      .then((r) => (r.ok ? r.json() : []))
      .then((data) => {
        if (active) setProjects(Array.isArray(data) ? data : []);
      })
      .catch(() => {
        if (active) setProjects([]);
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, []);

  if (loading) {
    return <div className="px-4 py-1.5 text-xs text-gray-400">Loading projects…</div>;
  }
  if (projects.length === 0) {
    return <div className="px-4 py-1.5 text-xs text-gray-400">No projects yet</div>;
  }

  return (
    <div className="space-y-0.5">
      {projects.map((p) => {
        const href = `/projects/${p.id}`;
        const isActive = pathname === href;
        return (
          <Link
            key={p.id}
            href={href}
            title={p.name}
            className={`block py-1.5 pl-7 pr-4 rounded-lg text-sm truncate transition ${
              isActive
                ? "bg-red-50 text-red-700 font-semibold"
                : "text-gray-600 hover:bg-red-50 hover:text-red-700"
            }`}
          >
            {p.name}
          </Link>
        );
      })}
    </div>
  );
}
