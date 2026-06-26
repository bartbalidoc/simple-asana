"use client";

import { useState } from "react";

interface Column {
  id: string;
  name: string;
  order: number;
}

interface Task {
  id: string;
  titleEnc?: string;
  title?: string;
  status: string;
  priority: string;
  columnId: string | null;
  assigneeId?: string | null;
  assignee?: { id: string; name: string; email: string } | null;
  dueDate?: string | null;
  order: number;
  subtasks?: { id: string; status: string }[];
}

interface KanbanBoardProps {
  columns: Column[];
  tasks: Task[];
  projectId: string;
  onTaskUpdate?: (taskId: string, updates: any) => Promise<void>;
  onTaskClick?: (taskId: string) => void;
}

export function KanbanBoard({
  columns,
  tasks,
  projectId,
  onTaskUpdate,
  onTaskClick,
}: KanbanBoardProps) {
  const [draggedTask, setDraggedTask] = useState<Task | null>(null);

  const handleDragStart = (task: Task) => {
    setDraggedTask(task);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
  };

  const handleDrop = async (columnId: string) => {
    if (!draggedTask || !onTaskUpdate) return;

    if (draggedTask.columnId === columnId) {
      setDraggedTask(null);
      return;
    }

    try {
      await onTaskUpdate(draggedTask.id, { columnId });
    } catch (error) {
      console.error("Failed to update task:", error);
    } finally {
      setDraggedTask(null);
    }
  };

  const tasksByColumn = columns.reduce((acc, column) => {
    acc[column.id] = tasks
      .filter((t) => t.columnId === column.id)
      .sort((a, b) => a.order - b.order);
    return acc;
  }, {} as Record<string, Task[]>);

  // A status accent (dot + header tint) per column, by name.
  const accent = (name: string) => {
    const n = name.toLowerCase();
    if (n.includes("progress")) return { dot: "bg-blue-500", text: "text-blue-700" };
    if (n.includes("review")) return { dot: "bg-amber-500", text: "text-amber-700" };
    if (n.includes("done")) return { dot: "bg-green-500", text: "text-green-700" };
    return { dot: "bg-gray-400", text: "text-gray-600" }; // To Do / default
  };

  const initials = (name: string) =>
    name
      .split(" ")
      .map((p) => p[0])
      .filter(Boolean)
      .slice(0, 2)
      .join("")
      .toUpperCase();

  return (
    <div className="flex gap-4 overflow-x-auto pb-4 items-start">
      {columns.map((column) => {
        const a = accent(column.name);
        const list = tasksByColumn[column.id] || [];
        return (
          <div
            key={column.id}
            className="flex-1 basis-0 min-w-[240px] bg-gray-50/70 rounded-xl p-3 border border-gray-200/70"
            onDragOver={handleDragOver}
            onDrop={() => handleDrop(column.id)}
          >
            <div className="flex items-center justify-between px-1 mb-3">
              <h3 className="flex items-center gap-2 text-sm font-semibold text-gray-800">
                <span className={`h-2 w-2 rounded-full ${a.dot}`} />
                {column.name}
              </h3>
              <span className="text-xs font-medium text-gray-400 bg-white rounded-full px-2 py-0.5 border border-gray-200">
                {list.length}
              </span>
            </div>

            <div className="space-y-2.5 min-h-[40px]">
              {list.map((task) => {
                const overdue =
                  task.dueDate &&
                  new Date(task.dueDate) < new Date() &&
                  task.status !== "DONE";
                return (
                  <div
                    key={task.id}
                    draggable
                    onDragStart={() => handleDragStart(task)}
                    onClick={() => onTaskClick?.(task.id)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" || e.key === " ") {
                        e.preventDefault();
                        onTaskClick?.(task.id);
                      }
                    }}
                    tabIndex={0}
                    role="button"
                    aria-label={task.title}
                    className={`group w-full text-left bg-white rounded-xl p-3 shadow-sm hover:shadow-md border border-gray-200 hover:border-red-300 transition cursor-grab active:cursor-grabbing focus:outline-none focus:ring-2 focus:ring-red-400 ${
                      draggedTask?.id === task.id ? "opacity-50" : ""
                    }`}
                  >
                    <p
                      className={`font-medium text-sm mb-2.5 line-clamp-2 break-words ${
                        task.status === "DONE"
                          ? "text-gray-400 line-through"
                          : "text-gray-900"
                      }`}
                      title={task.title || "Untitled Task"}
                    >
                      {task.title || "Untitled Task"}
                    </p>

                    <div className="flex items-center justify-between gap-2">
                      <span
                        className={`inline-flex items-center gap-1 text-[11px] font-medium px-2 py-0.5 rounded-full ${
                          task.priority === "HIGH"
                            ? "bg-red-50 text-red-700"
                            : task.priority === "LOW"
                            ? "bg-green-50 text-green-700"
                            : "bg-amber-50 text-amber-700"
                        }`}
                      >
                        <span
                          className={`h-1.5 w-1.5 rounded-full ${
                            task.priority === "HIGH"
                              ? "bg-red-500"
                              : task.priority === "LOW"
                              ? "bg-green-500"
                              : "bg-amber-500"
                          }`}
                        />
                        {task.priority === "HIGH"
                          ? "High"
                          : task.priority === "LOW"
                          ? "Low"
                          : "Medium"}
                      </span>

                      {task.assignee && (
                        <span
                          title={task.assignee.name}
                          className="flex-shrink-0 h-6 w-6 rounded-full bg-red-100 text-red-700 text-[10px] font-bold flex items-center justify-center"
                        >
                          {initials(task.assignee.name)}
                        </span>
                      )}
                    </div>

                    {((task.subtasks && task.subtasks.length > 0) || task.dueDate) && (
                      <div className="flex items-center gap-3 mt-2.5 pt-2.5 border-t border-gray-100 text-[11px]">
                        {task.subtasks && task.subtasks.length > 0 && (
                          <span className="text-gray-500">
                            ✓ {task.subtasks.filter((s) => s.status === "DONE").length}/
                            {task.subtasks.length}
                          </span>
                        )}
                        {task.dueDate && (
                          <span className={overdue ? "text-red-600 font-medium" : "text-gray-500"}>
                            {overdue ? "⚠ " : "📅 "}
                            {new Date(task.dueDate).toLocaleDateString()}
                          </span>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
              {list.length === 0 && (
                <div className="text-xs text-gray-300 text-center py-6 border border-dashed border-gray-200 rounded-lg">
                  Drop tasks here
                </div>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
