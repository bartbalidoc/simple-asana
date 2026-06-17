"use client";

import { Draggable } from "@hello-pangea/dnd";
import { TaskCard } from "./TaskCard";

interface Task {
  id: string;
  titleEnc?: string;
  title?: string;
  priority: string;
  assignee?: { id: string; name: string; email: string } | null;
  dueDate?: string | null;
  order: number;
}

interface KanbanColumnProps {
  columnId: string;
  tasks: Task[];
  onTaskClick?: (taskId: string) => void;
}

export function KanbanColumn({ columnId, tasks, onTaskClick }: KanbanColumnProps) {
  return (
    <div className="space-y-3">
      {tasks.map((task, index) => (
        <Draggable key={task.id} draggableId={task.id} index={index}>
          {(provided, snapshot) => (
            <div
              ref={provided.innerRef}
              {...provided.draggableProps}
              {...provided.dragHandleProps}
              className={`${snapshot.isDragging ? "shadow-lg" : ""}`}
            >
              <TaskCard task={task} onTaskClick={onTaskClick} />
            </div>
          )}
        </Draggable>
      ))}
    </div>
  );
}
