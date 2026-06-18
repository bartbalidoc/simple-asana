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

  return (
    <div className="flex gap-4 overflow-x-auto pb-4">
      {columns.map((column) => (
        <div
          key={column.id}
          className="flex-shrink-0 w-80 bg-gray-50 rounded-lg p-4"
          onDragOver={handleDragOver}
          onDrop={() => handleDrop(column.id)}
        >
          <h3 className="font-semibold text-gray-900 mb-4">{column.name}</h3>

          <div className="space-y-3">
            {(tasksByColumn[column.id] || []).map((task) => (
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
                className={`w-full text-left bg-white rounded-lg p-3 shadow-sm hover:shadow-md border border-gray-200 hover:border-blue-300 transition cursor-move focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                  draggedTask?.id === task.id ? "opacity-50" : ""
                }`}
              >
                <p className="font-medium text-gray-900 text-sm mb-2 truncate">
                  {task.title || "Untitled Task"}
                </p>

                <div className="flex items-center justify-between gap-2">
                  <span
                    className={`text-xs px-2 py-1 rounded ${
                      task.priority === "HIGH"
                        ? "bg-red-100 text-red-800"
                        : task.priority === "LOW"
                        ? "bg-green-100 text-green-800"
                        : "bg-yellow-100 text-yellow-800"
                    }`}
                  >
                    {task.priority}
                  </span>

                  {task.assignee && (
                    <span className="text-xs bg-gray-100 text-gray-700 px-2 py-1 rounded truncate">
                      {task.assignee.name}
                    </span>
                  )}
                </div>

                {task.subtasks && task.subtasks.length > 0 && (
                  <p className="text-xs text-gray-500 mt-2">
                    ✓ {task.subtasks.filter((s) => s.status === "DONE").length}/
                    {task.subtasks.length} subtasks
                  </p>
                )}

                {task.dueDate && (
                  <p
                    className={`text-xs mt-2 ${
                      new Date(task.dueDate) < new Date() && task.status !== "DONE"
                        ? "text-red-600 font-medium"
                        : "text-gray-500"
                    }`}
                  >
                    Due {new Date(task.dueDate).toLocaleDateString()}
                  </p>
                )}
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
