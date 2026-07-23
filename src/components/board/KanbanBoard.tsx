"use client";

import { useEffect, useState } from "react";
import {
  DragDropContext,
  Droppable,
  Draggable,
  type DropResult,
} from "@hello-pangea/dnd";
import { CheckIcon, PlusIcon, RefreshIcon } from "@/components/ui/icons";

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
  repeatEvery?: string;
}

interface KanbanBoardProps {
  columns: Column[];
  tasks: Task[];
  projectId: string;
  onTaskUpdate?: (taskId: string, updates: any) => Promise<void>;
  onTaskClick?: (taskId: string) => void;
  onCreateTask?: (columnId: string, title: string) => Promise<void> | void;
}

const accent = (name: string) => {
  const n = name.toLowerCase();
  if (n.includes("block")) return "bg-red-600";
  if (n.includes("progress")) return "bg-blue-500";
  if (n.includes("review")) return "bg-amber-500";
  if (n.includes("done")) return "bg-green-500";
  return "bg-gray-400";
};

const initials = (name: string) =>
  name
    .split(" ")
    .map((p) => p[0])
    .filter(Boolean)
    .slice(0, 2)
    .join("")
    .toUpperCase();

// Avatar identity colors: deterministic per name so the same person always
// gets the same muted tint. Identity, not state — red stays reserved for
// actions/alerts (see DESIGN.md).
const AVATAR_COLORS = [
  "bg-sky-100 text-sky-700",
  "bg-emerald-100 text-emerald-700",
  "bg-violet-100 text-violet-700",
  "bg-amber-100 text-amber-700",
  "bg-teal-100 text-teal-700",
  "bg-slate-200 text-slate-700",
];
export const avatarColor = (name: string) =>
  AVATAR_COLORS[
    [...name].reduce((sum, ch) => sum + ch.charCodeAt(0), 0) % AVATAR_COLORS.length
  ];

// New order value for an item inserted at `index` into `list` (list excludes
// the moved item). Uses fractional ordering so only the moved card is saved.
function orderForIndex(list: Task[], index: number): number {
  const before = list[index - 1]?.order;
  const after = list[index]?.order;
  if (before == null && after == null) return 0;
  if (before == null) return (after as number) - 1;
  if (after == null) return (before as number) + 1;
  return (before + after) / 2;
}

export function KanbanBoard({
  columns,
  tasks,
  onTaskUpdate,
  onTaskClick,
  onCreateTask,
}: KanbanBoardProps) {
  // Local copy so drag reorders feel instant; re-sync when the server data changes.
  const [items, setItems] = useState<Task[]>(tasks);
  useEffect(() => setItems(tasks), [tasks]);

  // In-column quick-add
  const [addCol, setAddCol] = useState<string | null>(null);
  const [addText, setAddText] = useState("");
  const [adding, setAdding] = useState(false);

  const submitAdd = async (columnId: string) => {
    const title = addText.trim();
    if (!title) return;
    setAdding(true);
    try {
      await onCreateTask?.(columnId, title);
      setAddText(""); // keep the composer open for rapid entry
    } finally {
      setAdding(false);
    }
  };

  const byColumn = (columnId: string) =>
    items
      .filter((t) => t.columnId === columnId)
      .sort((a, b) => a.order - b.order);

  const onDragEnd = (result: DropResult) => {
    const { source, destination, draggableId } = result;
    if (!destination) return;
    if (
      source.droppableId === destination.droppableId &&
      source.index === destination.index
    )
      return;

    const moved = items.find((t) => t.id === draggableId);
    if (!moved) return;

    const destList = byColumn(destination.droppableId).filter(
      (t) => t.id !== draggableId
    );
    const newOrder = orderForIndex(destList, destination.index);

    // Optimistic local update
    setItems((prev) =>
      prev.map((t) =>
        t.id === draggableId
          ? { ...t, columnId: destination.droppableId, order: newOrder }
          : t
      )
    );

    // Persist (column may be unchanged on a pure reorder)
    onTaskUpdate?.(draggableId, {
      columnId: destination.droppableId,
      order: newOrder,
    });
  };

  return (
    <DragDropContext onDragEnd={onDragEnd}>
      {/* Phones: one nearly-full-width column per swipe (scroll-snap), bleeding
          to the screen edge so the next column peeks. sm+: classic flex row. */}
      <div className="flex gap-3 sm:gap-4 overflow-x-auto pb-4 items-start snap-x snap-mandatory sm:snap-none -mx-4 px-4 sm:mx-0 sm:px-0 scroll-px-4">
        {columns.map((column) => {
          const list = byColumn(column.id);
          return (
            <div
              key={column.id}
              className="snap-start shrink-0 w-[84vw] max-w-[340px] sm:w-auto sm:max-w-none sm:shrink sm:flex-1 sm:basis-0 sm:min-w-[260px] bg-gray-50/80 rounded-2xl border border-gray-200/70"
            >
              <div className="flex items-center justify-between px-4 pt-3.5 pb-2">
                <h3 className="flex items-center gap-2 text-sm font-semibold text-gray-800">
                  <span className={`h-2.5 w-2.5 rounded-full ${accent(column.name)}`} />
                  {column.name}
                </h3>
                <span className="text-xs font-semibold text-gray-500 bg-white rounded-full px-2 py-0.5 border border-gray-200 tabular-nums">
                  {list.length}
                </span>
              </div>

              <Droppable droppableId={column.id}>
                {(provided, snapshot) => (
                  <div
                    ref={provided.innerRef}
                    {...provided.droppableProps}
                    className={`px-3 pb-3 space-y-2.5 min-h-[120px] rounded-b-2xl transition-colors ${
                      snapshot.isDraggingOver ? "bg-red-50/60" : ""
                    }`}
                  >
                    {list.map((task, index) => {
                      const overdue =
                        task.dueDate &&
                        new Date(task.dueDate) < new Date() &&
                        task.status !== "DONE";
                      return (
                        <Draggable key={task.id} draggableId={task.id} index={index}>
                          {(dp, snap) => (
                            <div
                              ref={dp.innerRef}
                              {...dp.draggableProps}
                              {...dp.dragHandleProps}
                              onClick={() => onTaskClick?.(task.id)}
                              role="button"
                              aria-label={task.title}
                              className={`group bg-white rounded-xl p-3.5 border transition cursor-pointer ${
                                snap.isDragging
                                  ? "border-red-300 shadow-lg rotate-[0.5deg]"
                                  : "border-gray-200 shadow-sm hover:shadow-md hover:border-red-200"
                              }`}
                            >
                              {/* Done: calm fade + green check, no strikethrough
                                  (struck-through titles read as errors at a glance). */}
                              <div className="flex items-start gap-1.5 mb-2.5">
                                {task.status === "DONE" && (
                                  <CheckIcon
                                    size={14}
                                    className="mt-0.5 flex-shrink-0 text-green-600"
                                  />
                                )}
                                <p
                                  className={`font-medium text-sm line-clamp-2 break-words ${
                                    task.status === "DONE" ? "text-gray-500" : "text-gray-900"
                                  }`}
                                  title={task.title || "Untitled Task"}
                                >
                                  {task.title || "Untitled Task"}
                                </p>
                                {task.repeatEvery && task.repeatEvery !== "NONE" && (
                                  <RefreshIcon
                                    size={13}
                                    className="mt-0.5 flex-shrink-0 text-gray-400"
                                  />
                                )}
                              </div>

                              {/* Medium is the default — only High/Low earn a chip,
                                  so color on the board always means something. */}
                              {(task.priority === "HIGH" ||
                                task.priority === "LOW" ||
                                task.assignee) && (
                                <div className="flex items-center justify-between gap-2">
                                  {task.priority === "HIGH" ? (
                                    <span className="inline-flex items-center gap-1 text-[11px] font-medium px-2 py-0.5 rounded-full bg-red-50 text-red-700">
                                      <span className="h-1.5 w-1.5 rounded-full bg-red-500" />
                                      High
                                    </span>
                                  ) : task.priority === "LOW" ? (
                                    <span className="inline-flex items-center gap-1 text-[11px] font-medium px-2 py-0.5 rounded-full bg-gray-100 text-gray-600">
                                      <span className="h-1.5 w-1.5 rounded-full bg-gray-400" />
                                      Low
                                    </span>
                                  ) : (
                                    <span />
                                  )}

                                  {task.assignee && (
                                    <span
                                      title={task.assignee.name}
                                      className={`flex-shrink-0 h-6 w-6 rounded-full text-[10px] font-bold flex items-center justify-center ${avatarColor(
                                        task.assignee.name
                                      )}`}
                                    >
                                      {initials(task.assignee.name)}
                                    </span>
                                  )}
                                </div>
                              )}

                              {((task.subtasks && task.subtasks.length > 0) || task.dueDate) && (
                                <div className="flex items-center gap-3 mt-2.5 pt-2.5 border-t border-gray-100 text-[11px] tabular-nums">
                                  {task.subtasks && task.subtasks.length > 0 && (
                                    <span className="text-gray-500">
                                      ✓ {task.subtasks.filter((s) => s.status === "DONE").length}/
                                      {task.subtasks.length}
                                    </span>
                                  )}
                                  {task.dueDate && (
                                    <span className={overdue ? "text-red-600 font-medium" : "text-gray-500"}>
                                      {new Date(task.dueDate).toLocaleDateString()}
                                    </span>
                                  )}
                                </div>
                              )}
                            </div>
                          )}
                        </Draggable>
                      );
                    })}
                    {provided.placeholder}
                    {list.length === 0 && !snapshot.isDraggingOver && (
                      <div className="text-xs text-gray-400 text-center py-6 border border-dashed border-gray-200 rounded-xl">
                        No tasks yet — drag one here or use “Add task”
                      </div>
                    )}
                  </div>
                )}
              </Droppable>

              {/* In-column quick add (the natural Asana way to add tasks) */}
              {onCreateTask && (
                <div className="px-3 pb-3">
                  {addCol === column.id ? (
                    <div className="bg-white rounded-xl border border-red-200 p-2 shadow-sm">
                      <textarea
                        autoFocus
                        rows={2}
                        value={addText}
                        onChange={(e) => setAddText(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter" && !e.shiftKey) {
                            e.preventDefault();
                            submitAdd(column.id);
                          }
                          if (e.key === "Escape") {
                            setAddCol(null);
                            setAddText("");
                          }
                        }}
                        placeholder="Task title — Enter to add"
                        className="w-full text-sm resize-none border-0 focus:outline-none placeholder:text-gray-400"
                      />
                      <div className="flex items-center gap-2 mt-1">
                        <button
                          onClick={() => submitAdd(column.id)}
                          disabled={adding || !addText.trim()}
                          className="text-xs bg-red-600 hover:bg-red-700 disabled:bg-gray-300 text-white rounded-md px-2.5 py-1 font-medium"
                        >
                          Add task
                        </button>
                        <button
                          onClick={() => {
                            setAddCol(null);
                            setAddText("");
                          }}
                          className="text-xs text-gray-500 hover:text-gray-700"
                        >
                          Cancel
                        </button>
                      </div>
                    </div>
                  ) : (
                    <button
                      onClick={() => {
                        setAddCol(column.id);
                        setAddText("");
                      }}
                      className="w-full flex items-center gap-1.5 text-sm text-gray-400 hover:text-red-600 hover:bg-white rounded-lg px-2 py-1.5 transition"
                    >
                      <PlusIcon size={15} /> Add task
                    </button>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </DragDropContext>
  );
}
