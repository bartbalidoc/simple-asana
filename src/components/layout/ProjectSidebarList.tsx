"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  DragDropContext,
  Droppable,
  Draggable,
  DropResult,
} from "@hello-pangea/dnd";

interface SidebarProject {
  id: string;
  name: string;
  order?: number;
}

// Live list of the signed-in user's projects, shown indented under the
// "Projects" nav item (Asana-style left nav). Staging projects are already
// excluded by /api/projects, so they never appear here.
//
// Drag the grip handle to reorder (feedback #5). Order is persisted globally
// via /api/projects/reorder and reflected on next load for everyone.
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

  const onDragEnd = (result: DropResult) => {
    const { source, destination } = result;
    if (!destination || destination.index === source.index) return;

    const reordered = Array.from(projects);
    const [moved] = reordered.splice(source.index, 1);
    reordered.splice(destination.index, 0, moved);

    const previous = projects;
    setProjects(reordered); // optimistic

    fetch("/api/projects/reorder", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ orderedIds: reordered.map((p) => p.id) }),
    })
      .then((r) => {
        if (!r.ok) throw new Error("reorder failed");
      })
      .catch(() => setProjects(previous)); // revert on failure
  };

  if (loading) {
    return <div className="px-4 py-1.5 text-xs text-gray-400">Loading projects…</div>;
  }
  if (projects.length === 0) {
    return <div className="px-4 py-1.5 text-xs text-gray-400">No projects yet</div>;
  }

  return (
    <DragDropContext onDragEnd={onDragEnd}>
      <Droppable droppableId="sidebar-projects">
        {(dropProvided) => (
          <div
            ref={dropProvided.innerRef}
            {...dropProvided.droppableProps}
            className="space-y-0.5"
          >
            {projects.map((p, index) => {
              const href = `/projects/${p.id}`;
              const isActive = pathname === href;
              return (
                <Draggable key={p.id} draggableId={p.id} index={index}>
                  {(dragProvided, snapshot) => (
                    <div
                      ref={dragProvided.innerRef}
                      {...dragProvided.draggableProps}
                      className={`group flex items-center rounded-lg ${
                        snapshot.isDragging ? "bg-white shadow ring-1 ring-red-200" : ""
                      }`}
                    >
                      {/* Drag handle — keeps clicks on the link working for navigation */}
                      <span
                        {...dragProvided.dragHandleProps}
                        title="Drag to reorder"
                        aria-label="Drag to reorder"
                        className="pl-2 pr-1 text-gray-300 group-hover:text-gray-500 cursor-grab active:cursor-grabbing select-none leading-none"
                      >
                        ⠿
                      </span>
                      <Link
                        href={href}
                        title={p.name}
                        className={`flex-1 block py-1.5 pr-4 rounded-lg text-sm truncate transition ${
                          isActive
                            ? "bg-red-50 text-red-700 font-semibold"
                            : "text-gray-600 hover:bg-red-50 hover:text-red-700"
                        }`}
                      >
                        {p.name}
                      </Link>
                    </div>
                  )}
                </Draggable>
              );
            })}
            {dropProvided.placeholder}
          </div>
        )}
      </Droppable>
    </DragDropContext>
  );
}
