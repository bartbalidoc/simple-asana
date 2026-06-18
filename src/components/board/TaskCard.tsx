"use client";

import { formatDistanceToNow } from "date-fns";

interface Task {
  id: string;
  titleEnc?: string;
  title?: string;
  priority: string;
  assignee?: { id: string; name: string; email: string } | null;
  dueDate?: string | null;
}

interface TaskCardProps {
  task: Task;
  onTaskClick?: (taskId: string) => void;
}

const priorityColors = {
  LOW: "bg-blue-100 text-blue-800",
  MEDIUM: "bg-yellow-100 text-yellow-800",
  HIGH: "bg-red-100 text-red-800",
};

export function TaskCard({ task, onTaskClick }: TaskCardProps) {
  const title = task.title || "Untitled Task";
  const dueIn = task.dueDate
    ? formatDistanceToNow(new Date(task.dueDate), { addSuffix: true })
    : null;

  return (
    <button
      onClick={() => onTaskClick?.(task.id)}
      className="w-full text-left bg-white rounded-lg p-3 shadow-sm hover:shadow-md border border-gray-200 hover:border-red-300 transition"
    >
      <p className="font-medium text-gray-900 text-sm mb-2 truncate">{title}</p>

      <div className="flex items-center justify-between gap-2">
        <span
          className={`text-xs px-2 py-1 rounded ${
            priorityColors[task.priority as keyof typeof priorityColors] ||
            "bg-gray-100 text-gray-800"
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

      {dueIn && (
        <p className="text-xs text-gray-500 mt-2">Due {dueIn}</p>
      )}
    </button>
  );
}
