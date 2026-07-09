"use client";

import { useState, useEffect } from "react";
import {
  DragDropContext,
  Droppable,
  Draggable,
  type DropResult,
} from "@hello-pangea/dnd";
import { CommentList } from "./CommentList";
import { CommentForm } from "./CommentForm";
import { AttachmentList } from "./AttachmentList";
import { DistributeControl } from "./DistributeControl";
import { Button } from "@/components/ui/Button";
import {
  ChevronDownIcon,
  CloseIcon,
  GripIcon,
  PlusIcon,
  SparklesIcon,
  TrashIcon,
  ZapIcon,
} from "@/components/ui/icons";
import { Select } from "@/components/ui/Select";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { useToast } from "@/components/ui/Toast";
import { Markdown } from "@/components/ui/Markdown";
import { TASK_TEMPLATES } from "@/lib/taskTemplates";

interface Subtask {
  id: string;
  title: string;
  status: string;
  order?: number;
  assigneeId?: string | null;
}

interface TaskDetailPanelProps {
  taskId: string;
  onClose?: () => void;
  onTaskUpdated?: () => void;
  // Open another task (e.g. a subtask, or this task's parent) in the panel.
  // Enables Asana-style drill-down into nested subtasks.
  onOpenTask?: (taskId: string) => void;
}

export function TaskDetailPanel({ taskId, onClose, onTaskUpdated, onOpenTask }: TaskDetailPanelProps) {
  const toast = useToast();
  const [task, setTask] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [updates, setUpdates] = useState<any>({});
  const [descPreview, setDescPreview] = useState(false);
  const [template, setTemplate] = useState("general");
  const [newSubtaskTitle, setNewSubtaskTitle] = useState("");
  const [creatingSubtask, setCreatingSubtask] = useState(false);
  const [hasChanges, setHasChanges] = useState(false);
  const [members, setMembers] = useState<any[]>([]);
  // This project's members — used to tell guests apart from members in the UI.
  // @mentions now match the WHOLE team: mentioning a non-member deliberately
  // adds them as a guest of this task (audit-logged, single-task access).
  const [projectMembers, setProjectMembers] = useState<any[]>([]);
  // Real (non-staging) projects to distribute staged tasks into.
  const [destProjects, setDestProjects] = useState<any[]>([]);
  // Projects this user can MOVE the task into (feedback #4).
  const [moveProjects, setMoveProjects] = useState<any[]>([]);
  const [moving, setMoving] = useState(false);
  // Task guests: teammates invited to just this task (no project access).
  const [guests, setGuests] = useState<any[]>([]);
  // Rarely-touched settings collapse behind "More settings"; deleting asks first.
  const [showMore, setShowMore] = useState(false);
  const [confirmDeleteTask, setConfirmDeleteTask] = useState(false);

  // Guests live inside More settings — open it when the task has guests so
  // they're never invisible.
  useEffect(() => {
    if (guests.length > 0) setShowMore(true);
  }, [guests.length]);
  const [addingGuest, setAddingGuest] = useState(false);
  // Rebuild with AI: Claude restructures a messy task; user previews, then applies.
  const [rebuildInput, setRebuildInput] = useState("");
  const [rebuilding, setRebuilding] = useState(false);
  const [proposal, setProposal] = useState<{
    title: string;
    description: string;
    priority: string;
    subtasks: string[];
  } | null>(null);
  const [applyingProposal, setApplyingProposal] = useState(false);
  const isStaged = !!task?.project?.isStaging;

  useEffect(() => {
    const fetchTask = async () => {
      try {
        const response = await fetch(`/api/tasks/${taskId}`);
        if (!response.ok) throw new Error("Failed to fetch task");
        const data = await response.json();
        setTask(data);
        setTemplate(data.template || "general");
        setError(null);

        // Load the whole team so the task can be assigned to anyone
        try {
          const usersRes = await fetch(`/api/users`);
          if (usersRes.ok) {
            setMembers(await usersRes.json());
          }
        } catch {
          // Non-fatal: assignee dropdown just won't have options
        }

        // For staged (Asana import) tasks, load real projects to distribute into.
        try {
          if (data.project?.isStaging) {
            const pr = await fetch(`/api/projects`);
            if (pr.ok) setDestProjects(await pr.json());
          }
        } catch {
          // Non-fatal: distribute dropdown just won't have options
        }

        // Load just this project's members for the @mention autocomplete.
        // Retry once on failure so a transient hiccup doesn't silently leave the
        // tag dropdown empty (a cause of "@mention sometimes doesn't work", #3).
        if (data.projectId) {
          const loadProjectMembers = async () => {
            const pmRes = await fetch(`/api/projects/${data.projectId}/members`);
            if (!pmRes.ok) throw new Error(`members request failed: ${pmRes.status}`);
            const pm = await pmRes.json();
            return (pm || [])
              .map((m: any) => m.user)
              .filter((u: any) => u && u.id);
          };
          try {
            setProjectMembers(await loadProjectMembers());
          } catch {
            try {
              setProjectMembers(await loadProjectMembers()); // one retry
            } catch (e) {
              // Surface it (don't swallow) so this is debuggable if it recurs.
              console.warn("@mention: couldn't load project members for tagging:", e);
            }
          }
        }

        // Load the projects this user can MOVE this task into (feedback #4).
        // /api/projects returns only the boards they belong to (all, for admins),
        // which is exactly the set they're allowed to move a task onto.
        try {
          if (!data.project?.isStaging && !data.parentTaskId) {
            const pr = await fetch(`/api/projects`);
            if (pr.ok) setMoveProjects(await pr.json());
          }
        } catch {
          // Non-fatal: the move dropdown just won't list other boards.
        }

        // Task guests (people invited to just this task).
        try {
          const gr = await fetch(`/api/tasks/${taskId}/guests`);
          if (gr.ok) setGuests(await gr.json());
        } catch {
          // Non-fatal: the guests row just stays empty.
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to load task");
      } finally {
        setLoading(false);
      }
    };

    fetchTask();
  }, [taskId]);

  const requestRebuild = async () => {
    setRebuilding(true);
    setProposal(null);
    try {
      const res = await fetch("/api/ai/rebuild-task", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ taskId, instruction: rebuildInput.trim() || undefined }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Couldn't rebuild the task.");
      setProposal(data.proposal);
    } catch (err) {
      toast(err instanceof Error ? err.message : "Couldn't rebuild the task.", "error");
    } finally {
      setRebuilding(false);
    }
  };

  const applyProposal = async () => {
    if (!proposal) return;
    setApplyingProposal(true);
    try {
      const res = await fetch(`/api/tasks/${taskId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: proposal.title,
          description: proposal.description,
          priority: proposal.priority,
        }),
      });
      if (!res.ok) throw new Error("Couldn't apply the rewrite.");

      // Add proposed subtasks that don't exist yet; never touch existing ones.
      const existing = new Set(
        (task.subtasks || []).map((s: Subtask) => s.title.trim().toLowerCase())
      );
      const fresh = proposal.subtasks.filter((s) => !existing.has(s.trim().toLowerCase()));
      const created: Subtask[] = [];
      for (let i = 0; i < fresh.length; i++) {
        const r = await fetch("/api/tasks", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            projectId: task.projectId,
            title: fresh[i],
            parentTaskId: taskId,
            columnId: task.columnId || undefined,
            template: "general",
            order: (task.subtasks?.length || 0) + i,
          }),
        }).catch(() => null);
        if (r?.ok) {
          const st = await r.json();
          created.push({ id: st.id, title: fresh[i], status: "TODO" });
        }
      }

      setTask((prev: any) => ({
        ...prev,
        title: proposal.title,
        description: proposal.description,
        priority: proposal.priority,
        subtasks: [...(prev.subtasks || []), ...created],
      }));
      setUpdates((prev: any) => {
        const { title: _t, description: _d, ...rest } = prev;
        return rest;
      });
      setProposal(null);
      setRebuildInput("");
      toast("Task rebuilt ✨");
      onTaskUpdated?.();
    } catch (err) {
      toast(err instanceof Error ? err.message : "Couldn't apply the rewrite.", "error");
    } finally {
      setApplyingProposal(false);
    }
  };

  const handleAddGuest = async (userId: string) => {
    if (!userId) return;
    setAddingGuest(true);
    try {
      const res = await fetch(`/api/tasks/${taskId}/guests`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Couldn't add guest");
      setGuests((prev) =>
        prev.some((g) => g.userId === data.userId) ? prev : [...prev, data]
      );
      toast(`${data.user?.name || "Guest"} can now see this task`);
    } catch (err) {
      toast(err instanceof Error ? err.message : "Couldn't add guest", "error");
    } finally {
      setAddingGuest(false);
    }
  };

  const handleRemoveGuest = async (userId: string, name: string) => {
    try {
      const res = await fetch(`/api/tasks/${taskId}/guests?userId=${userId}`, {
        method: "DELETE",
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || "Couldn't remove guest");
      }
      setGuests((prev) => prev.filter((g) => g.userId !== userId));
      toast(`${name} no longer sees this task`);
    } catch (err) {
      toast(err instanceof Error ? err.message : "Couldn't remove guest", "error");
    }
  };

  const handleAssigneeChange = async (assigneeId: string | null) => {
    try {
      const response = await fetch(`/api/tasks/${taskId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ assigneeId }),
      });

      if (!response.ok) throw new Error("Failed to update assignee");
      const updated = await response.json();
      // Preserve loaded comments (PATCH response omits them) so they don't vanish.
      setTask((prev: any) => ({
        ...prev,
        ...updated,
        comments: prev?.comments ?? updated.comments ?? [],
      }));
      onTaskUpdated?.();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to update assignee");
    }
  };

  // Move this task to a different project board (feedback #4). On success the
  // task leaves the current board, so we refresh it and close the panel.
  const handleMoveToProject = async (projectId: string) => {
    if (!projectId || projectId === task.projectId) return;
    const dest = moveProjects.find((p) => p.id === projectId);
    const destName = dest?.name || "the selected project";
    if (
      !confirm(
        `Move this task to "${destName}"? It will leave "${task.project?.name ?? "this board"}".`
      )
    ) {
      return;
    }
    try {
      setMoving(true);
      const response = await fetch(`/api/tasks/${taskId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ projectId }),
      });
      if (!response.ok) {
        const err = await response.json().catch(() => ({}));
        throw new Error(err.error || "Failed to move task");
      }
      toast(`Moved to ${destName}`);
      onTaskUpdated?.(); // refresh the source board — the task disappears from it
      onClose?.(); // the task now lives on another board
    } catch (err) {
      toast(err instanceof Error ? err.message : "Couldn't move task", "error");
      setMoving(false);
    }
  };

  const handlePriorityChange = async (priority: string) => {
    try {
      const response = await fetch(`/api/tasks/${taskId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ priority }),
      });

      if (!response.ok) throw new Error("Failed to update priority");
      const updated = await response.json();
      // Preserve loaded comments (PATCH response omits them) so they don't vanish.
      setTask((prev: any) => ({
        ...prev,
        ...updated,
        comments: prev?.comments ?? updated.comments ?? [],
      }));
      onTaskUpdated?.(); // refresh board so the card badge updates immediately
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to update priority");
    }
  };

  const handleSave = async () => {
    if (Object.keys(updates).length === 0) {
      setHasChanges(false);
      return;
    }

    try {
      const response = await fetch(`/api/tasks/${taskId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...updates, template }),
      });

      if (!response.ok) throw new Error("Failed to update task");
      const updated = await response.json();
      // The PATCH response does NOT include `comments`, so preserve the comments
      // already in state — otherwise a just-posted comment vanishes from view
      // after saving field edits (the other half of the "one change is lost" bug).
      setTask((prev: any) => ({
        ...prev,
        ...updated,
        comments: prev?.comments ?? updated.comments ?? [],
      }));
      setUpdates({});
      setHasChanges(false);
      onTaskUpdated?.(); // refresh the board so card priority/title update immediately
      toast("Changes saved");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save task");
      toast("Couldn't save changes", "error");
    }
  };

  const handleCreateSubtask = async () => {
    if (!newSubtaskTitle.trim()) return;

    try {
      setCreatingSubtask(true);

      const response = await fetch("/api/tasks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          projectId: task.projectId,
          title: newSubtaskTitle,
          parentTaskId: taskId,
          template: "general",
          order: task.subtasks?.length || 0,
        }),
      });

      if (!response.ok) {
        const errText = await response.text();
        throw new Error(`Failed to create subtask: ${errText}`);
      }
      const newSubtask = await response.json();

      setTask({
        ...task,
        subtasks: [...(task.subtasks || []), newSubtask],
      });
      setNewSubtaskTitle("");
    } catch (err) {
      console.error("Subtask error:", err);
      setError(err instanceof Error ? err.message : "Failed to create subtask");
    } finally {
      setCreatingSubtask(false);
    }
  };

  const handleToggleSubtaskStatus = async (subtaskId: string, currentStatus: string) => {
    const newStatus = currentStatus === "DONE" ? "TODO" : "DONE";

    try {
      const response = await fetch(`/api/tasks/${subtaskId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: newStatus }),
      });

      if (!response.ok) throw new Error("Failed to update subtask");

      setTask({
        ...task,
        subtasks: task.subtasks.map((s: Subtask) =>
          s.id === subtaskId ? { ...s, status: newStatus } : s
        ),
      });
    } catch (err) {
      console.error("Subtask error:", err);
      setError(err instanceof Error ? err.message : "Failed to update subtask");
    }
  };

  const handleDeleteSubtask = async (subtaskId: string) => {
    if (!confirm("Delete this subtask?")) return;

    try {
      const response = await fetch(`/api/tasks/${subtaskId}`, {
        method: "DELETE",
      });

      if (!response.ok) throw new Error("Failed to delete subtask");

      setTask({
        ...task,
        subtasks: task.subtasks.filter((s: Subtask) => s.id !== subtaskId),
      });
    } catch (err) {
      console.error("Subtask delete error:", err);
      setError(err instanceof Error ? err.message : "Failed to delete subtask");
    }
  };

  const handleUpdateSubtaskTitle = async (subtaskId: string, title: string) => {
    const trimmed = title.trim();
    if (!trimmed) return;

    // Optimistic update
    setTask({
      ...task,
      subtasks: task.subtasks.map((s: Subtask) =>
        s.id === subtaskId ? { ...s, title: trimmed } : s
      ),
    });

    try {
      const response = await fetch(`/api/tasks/${subtaskId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: trimmed }),
      });
      if (!response.ok) throw new Error("Failed to update subtask");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to update subtask");
    }
  };

  const handleSubtaskAssignee = async (
    subtaskId: string,
    assigneeId: string | null
  ) => {
    // Optimistic update
    setTask({
      ...task,
      subtasks: task.subtasks.map((s: Subtask) =>
        s.id === subtaskId ? { ...s, assigneeId } : s
      ),
    });
    try {
      const response = await fetch(`/api/tasks/${subtaskId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ assigneeId }),
      });
      if (!response.ok) throw new Error("Failed to assign subtask");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to assign subtask");
    }
  };

  // Esc closes the panel — feels like a proper drawer.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose?.();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const handleSubtaskDragEnd = async (result: DropResult) => {
    const { source, destination } = result;
    if (!destination || destination.index === source.index) return;

    const list = [...(task.subtasks || [])];
    const [moved] = list.splice(source.index, 1);
    list.splice(destination.index, 0, moved);
    setTask({ ...task, subtasks: list }); // optimistic

    try {
      await Promise.all(
        list.map((s: Subtask, i: number) =>
          fetch(`/api/tasks/${s.id}`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ order: i }),
          })
        )
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to reorder subtasks");
    }
  };

  const handleCommentAdded = async () => {
    try {
      const response = await fetch(`/api/tasks/${taskId}`);
      if (!response.ok) throw new Error("Failed to fetch task");
      const data = await response.json();
      // Only refresh the comments list — never replace the whole task object.
      // A full setTask() here would clobber the user's in-flight unsaved edits
      // (title/description live in `updates`, but other freshly-saved fields and
      // the loaded comments would be lost). This is the fix for the
      // "title OR comment is lost when you Save both at once" bug.
      setTask((prev: any) => (prev ? { ...prev, comments: data.comments } : data));
    } catch (err) {
      console.error("Failed to refresh comments:", err);
    }
  };

  const handleDeleteTask = async () => {
    setConfirmDeleteTask(false);
    try {
      const response = await fetch(`/api/tasks/${taskId}`, {
        method: "DELETE",
      });

      if (!response.ok) throw new Error("Failed to delete task");

      toast("Task deleted");
      onClose?.();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to delete task");
      toast("Couldn't delete task", "error");
    }
  };

  if (loading) {
    return (
      <div className="fixed right-0 top-0 h-screen [height:100dvh] w-full max-w-[540px] bg-white shadow-2xl border-l border-gray-200 p-4 sm:p-6 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin h-8 w-8 border-2 border-red-500 border-t-transparent rounded-full mx-auto mb-2" />
          <p className="text-gray-600">Loading...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="fixed right-0 top-0 h-screen [height:100dvh] w-full max-w-[540px] bg-white shadow-2xl border-l border-gray-200 p-4 sm:p-6">
        <div className="text-red-600 mb-4">{error}</div>
        <button onClick={onClose} className="text-sm text-gray-600 hover:text-gray-900 underline">
          Close
        </button>
      </div>
    );
  }

  if (!task) return null;

  const currentTemplate = TASK_TEMPLATES[template] || TASK_TEMPLATES.general;
  const completedSubtasks = (task.subtasks || []).filter((s: Subtask) => s.status === "DONE").length;
  const totalSubtasks = (task.subtasks || []).length;

  return (
    <>
      {/* Dimmed backdrop — click anywhere to close (feels like a drawer). */}
      <div
        className="fixed inset-0 bg-gray-900/20 z-40"
        onClick={onClose}
        aria-hidden
      />
      <div className="fixed right-0 top-0 h-screen [height:100dvh] w-full max-w-[540px] bg-white shadow-2xl border-l border-gray-200 overflow-y-auto z-50">
      <div className="p-4 sm:p-6 border-b sticky top-0 bg-white z-10">
        {task.accessLevel === "GUEST" && (
          <div className="mb-3 px-3 py-2 rounded-lg bg-purple-50 border border-purple-200 text-purple-800 text-xs">
            You&apos;re a guest on this task — you can read everything and comment,
            but not edit the task itself.
          </div>
        )}
        {task.parentTaskId && onOpenTask && (
          <button
            onClick={() => onOpenTask(task.parentTaskId)}
            className="w-full mb-3 flex items-center gap-2 rounded-lg border border-gray-200 bg-gray-50 hover:bg-red-50 hover:border-red-200 hover:text-red-700 text-gray-600 text-sm font-medium px-3 py-2 transition"
            title="Back to the parent task"
          >
            <span className="text-base leading-none">←</span>
            Back to parent task
          </button>
        )}
        <div className="flex items-start justify-between">
          <div className="flex-1">
            <textarea
              rows={1}
              value={updates.title !== undefined ? updates.title : task.title}
              onChange={(e) => {
                setUpdates({ ...updates, title: e.target.value });
                setHasChanges(true);
              }}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  e.currentTarget.blur();
                }
              }}
              ref={(el) => {
                if (el) {
                  el.style.height = "auto";
                  el.style.height = `${el.scrollHeight}px`;
                }
              }}
              onInput={(e) => {
                const el = e.currentTarget;
                el.style.height = "auto";
                el.style.height = `${el.scrollHeight}px`;
              }}
              className="w-full text-xl font-bold border-b-2 border-gray-200 hover:border-gray-400 focus:border-red-500 focus:outline-none mb-2 bg-transparent resize-none overflow-hidden break-words"
              placeholder="Task title..."
            />
            <p className="text-xs text-gray-500">
              Created by {task.createdBy?.name || "Unknown"}
            </p>
          </div>
          <div className="flex items-center gap-2 flex-shrink-0">
            {/* Delete moved to the panel footer — destructive actions don't
                belong next to the close button. */}
            <button
              onClick={onClose}
              className="p-1.5 rounded-lg text-gray-400 hover:text-gray-700 hover:bg-gray-100 transition focus:outline-none focus-visible:ring-2 focus-visible:ring-red-400"
              title="Close"
              aria-label="Close task panel"
            >
              <CloseIcon size={20} />
            </button>
          </div>
        </div>
      </div>

      <div className="p-4 sm:p-6 space-y-6">
        {/* Staged (Asana import) — distribute this task into a real project */}
        {isStaged && (
          <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 space-y-2">
            <div className="text-xs font-semibold text-amber-800">
              Staged from Asana
              {task.originalAssignee && (
                <span className="font-normal text-amber-700">
                  {" "}· original owner: {task.originalAssignee}
                </span>
              )}
            </div>
            <DistributeControl
              taskId={taskId}
              destinations={destProjects}
              people={members}
              defaultAi={false}
              buttonLabel="Copy this task to a project →"
              onDone={onTaskUpdated}
            />
          </div>
        )}

        {/* The fields people actually change live at the top: status,
            priority, due date, assignee, board. Template moved to More. */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label htmlFor="task-status" className="block text-sm font-semibold text-gray-900 mb-2">
              Status
            </label>
            <Select
              id="task-status"
              value={updates.status !== undefined ? updates.status : task.status}
              onChange={async (e) => {
                const newStatus = e.target.value;
                setUpdates({ ...updates, status: newStatus });
                setHasChanges(true);
                try {
                  const response = await fetch(`/api/tasks/${taskId}`, {
                    method: "PATCH",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ status: newStatus }),
                  });
                  if (!response.ok) {
                    const errorData = await response.json();
                    throw new Error(errorData.details || "Failed to update status");
                  }
                  const updated = await response.json();
                  // Preserve loaded comments (PATCH response omits them) — item #1.
                  setTask((prev: any) => ({
                    ...prev,
                    ...updated,
                    comments: prev?.comments ?? updated.comments ?? [],
                  }));
                  setUpdates({});
                  setHasChanges(false);
                  onTaskUpdated?.();
                } catch (err) {
                  console.error("Status update error:", err);
                  setError(err instanceof Error ? err.message : "Failed to update status");
                }
              }}
            >
              <option value="TODO">To Do</option>
              <option value="IN_PROGRESS">In Progress</option>
              <option value="BLOCKED">Blocked</option>
              <option value="IN_REVIEW">In Review</option>
              <option value="DONE">Done</option>
            </Select>
          </div>

          {currentTemplate.fields.priority && (
            <div>
              <label htmlFor="task-priority" className="block text-sm font-semibold text-gray-900 mb-2">
                Priority
              </label>
              <Select
                id="task-priority"
                value={updates.priority !== undefined ? updates.priority : task.priority}
                onChange={(e) => handlePriorityChange(e.target.value)}
              >
                <option value="LOW">Low</option>
                <option value="MEDIUM">Medium</option>
                <option value="HIGH">High</option>
              </Select>
            </div>
          )}

          {currentTemplate.fields.dueDate && (
            <div>
              <label htmlFor="task-due" className="block text-sm font-semibold text-gray-900 mb-2">
                Due date
              </label>
              <input
                id="task-due"
                type="date"
                value={
                  updates.dueDate !== undefined
                    ? updates.dueDate
                      ? new Date(updates.dueDate).toISOString().split("T")[0]
                      : ""
                    : task.dueDate
                    ? new Date(task.dueDate).toISOString().split("T")[0]
                    : ""
                }
                onChange={(e) => {
                  setUpdates({ ...updates, dueDate: e.target.value || null });
                  setHasChanges(true);
                }}
                className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm bg-white transition focus:outline-none focus:border-red-400 focus:ring-2 focus:ring-red-100"
              />
            </div>
          )}

          <div>
            <label htmlFor="task-assignee" className="block text-sm font-semibold text-gray-900 mb-2">
              Assigned to
            </label>
            <Select
              id="task-assignee"
              value={task.assigneeId || ""}
              onChange={(e) => handleAssigneeChange(e.target.value || null)}
            >
              <option value="">Unassigned</option>
              {members.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.name} ({u.email})
                </option>
              ))}
            </Select>
          </div>
        </div>

        {/* Move to another project board (feedback #4) */}
        {!isStaged && !task.parentTaskId && (
          <div>
            <label htmlFor="task-board" className="block text-sm font-semibold text-gray-900 mb-2">
              Project board
            </label>
            <Select
              id="task-board"
              value={task.projectId}
              disabled={moving}
              onChange={(e) => handleMoveToProject(e.target.value)}
            >
              <option value={task.projectId}>
                {task.project?.name ? `${task.project.name} (current)` : "Current board"}
              </option>
              {moveProjects
                .filter((p) => p.id !== task.projectId)
                .map((p) => (
                  <option key={p.id} value={p.id}>
                    → Move to: {p.name}
                  </option>
                ))}
            </Select>
            <p className="text-xs text-gray-500 mt-1">
              {moving ? "Moving…" : "Pick another board to move this task (and its subtasks) there."}
            </p>
          </div>
        )}

        {/* Dynamic Fields Based on Template */}

        {currentTemplate.fields.description && (
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-sm font-semibold text-gray-900">Description</label>
              {/* Markdown write/preview toggle (feedback: lists, bold, italic…) */}
              <div className="flex rounded-md border border-gray-200 overflow-hidden text-[11px]">
                <button
                  type="button"
                  onClick={() => setDescPreview(false)}
                  className={`px-2 py-0.5 ${!descPreview ? "bg-gray-800 text-white" : "bg-white text-gray-500 hover:bg-gray-50"}`}
                >
                  Write
                </button>
                <button
                  type="button"
                  onClick={() => setDescPreview(true)}
                  className={`px-2 py-0.5 ${descPreview ? "bg-gray-800 text-white" : "bg-white text-gray-500 hover:bg-gray-50"}`}
                >
                  Preview
                </button>
              </div>
            </div>
            {descPreview ? (
              <div className="w-full border border-gray-200 rounded p-2 bg-gray-50/50 min-h-[76px]">
                {(updates.description !== undefined ? updates.description : task.description || "").trim() ? (
                  <Markdown
                    text={updates.description !== undefined ? updates.description : task.description || ""}
                  />
                ) : (
                  <p className="text-sm text-gray-400">Nothing to preview.</p>
                )}
              </div>
            ) : (
              <>
                <textarea
                  value={updates.description !== undefined ? updates.description : task.description || ""}
                  onChange={(e) => {
                    setUpdates({ ...updates, description: e.target.value });
                    setHasChanges(true);
                  }}
                  className="w-full border border-gray-300 rounded p-2 text-sm focus:outline-none focus:border-red-500 bg-white"
                  rows={5}
                  placeholder="Add a description..."
                />
                <p className="text-[11px] text-gray-400 mt-1">
                  Formatting: **bold** · *italic* · `code` · - bullet list · 1. numbered list · # heading
                </p>
              </>
            )}

            {/* Rebuild with AI — restructure a messy task (great for old Asana imports) */}
            {task.accessLevel !== "GUEST" && (
              <div className="mt-3 border-t border-dashed border-gray-200 pt-2">
                {!proposal ? (
                  <div className="flex items-center gap-2">
                    <input
                      value={rebuildInput}
                      onChange={(e) => setRebuildInput(e.target.value)}
                      onKeyDown={(e) => e.key === "Enter" && !rebuilding && requestRebuild()}
                      placeholder="Rebuild with AI — optional hint, e.g. “split into clear steps”"
                      disabled={rebuilding}
                      className="flex-1 text-xs border border-gray-200 rounded px-2 py-1.5 focus:outline-none focus:border-red-500 disabled:bg-gray-50"
                    />
                    <button
                      onClick={requestRebuild}
                      disabled={rebuilding}
                      className="inline-flex items-center gap-1.5 text-xs font-semibold text-white bg-red-600 hover:bg-red-700 disabled:bg-red-300 rounded-md px-3 py-1.5 whitespace-nowrap transition focus:outline-none focus-visible:ring-2 focus-visible:ring-red-400 focus-visible:ring-offset-1"
                    >
                      <SparklesIcon size={13} />
                      {rebuilding ? "Rebuilding…" : "Rebuild"}
                    </button>
                  </div>
                ) : (
                  <div className="rounded-lg border border-gray-200 bg-white shadow-sm p-3 space-y-2">
                    <p className="flex items-center gap-1.5 text-[11px] font-semibold text-gray-400 uppercase tracking-wide">
                      <SparklesIcon size={12} /> AI proposal — nothing is saved until you apply
                    </p>
                    <p className="text-sm font-semibold text-gray-900">{proposal.title}</p>
                    {proposal.description && (
                      <p className="text-xs text-gray-600">{proposal.description}</p>
                    )}
                    {proposal.subtasks.length > 0 && (
                      <ul className="space-y-0.5">
                        {proposal.subtasks.map((s, i) => {
                          const isNew = !(task.subtasks || []).some(
                            (ex: Subtask) => ex.title.trim().toLowerCase() === s.trim().toLowerCase()
                          );
                          return (
                            <li key={i} className="text-xs text-gray-600 flex gap-1.5 items-baseline">
                              <span className="text-gray-300">•</span>
                              <span>{s}</span>
                              {isNew && (
                                <span className="text-[9px] font-bold text-green-700 bg-green-50 rounded px-1">
                                  NEW
                                </span>
                              )}
                            </li>
                          );
                        })}
                      </ul>
                    )}
                    <p className="text-[11px] text-gray-400">
                      Applying updates the title, description and priority, and adds the NEW
                      subtasks. Existing subtasks are never changed or removed.
                    </p>
                    <div className="flex gap-2 pt-1">
                      <button
                        onClick={applyProposal}
                        disabled={applyingProposal}
                        className="text-xs font-semibold text-white bg-red-600 hover:bg-red-700 disabled:bg-red-300 rounded px-3 py-1.5 transition"
                      >
                        {applyingProposal ? "Applying…" : "Apply rewrite"}
                      </button>
                      <button
                        onClick={() => setProposal(null)}
                        disabled={applyingProposal}
                        className="text-xs text-gray-500 hover:text-gray-700"
                      >
                        Discard
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {currentTemplate.fields.goal && (
          <div>
            <label className="block text-sm font-semibold text-gray-900 mb-2">Goal</label>
            <textarea
              value={updates.goal || task.goal || ""}
              onChange={(e) => {
                setUpdates({ ...updates, goal: e.target.value });
                setHasChanges(true);
              }}
              className="w-full border border-gray-300 rounded p-2 text-sm focus:outline-none focus:border-red-500 bg-white"
              rows={2}
              placeholder="What is the goal of this task?"
            />
          </div>
        )}

        {currentTemplate.fields.expectedOutput && (
          <div>
            <label className="block text-sm font-semibold text-gray-900 mb-2">
              Expected Output
            </label>
            <textarea
              value={updates.expectedOutput || task.expectedOutput || ""}
              onChange={(e) => {
                setUpdates({ ...updates, expectedOutput: e.target.value });
                setHasChanges(true);
              }}
              className="w-full border border-gray-300 rounded p-2 text-sm focus:outline-none focus:border-red-500 bg-white"
              rows={2}
              placeholder="What should be delivered?"
            />
          </div>
        )}

        {currentTemplate.fields.problem && (
          <div>
            <label className="block text-sm font-semibold text-gray-900 mb-2">
              Problem Statement
            </label>
            <textarea
              value={updates.problem || task.problem || ""}
              onChange={(e) => {
                setUpdates({ ...updates, problem: e.target.value });
                setHasChanges(true);
              }}
              className="w-full border border-gray-300 rounded p-2 text-sm focus:outline-none focus:border-red-500 bg-white"
              rows={2}
              placeholder="What's the problem?"
            />
          </div>
        )}

        {currentTemplate.fields.currentWorkflow && (
          <div>
            <label className="block text-sm font-semibold text-gray-900 mb-2">
              Current Workflow
            </label>
            <textarea
              value={updates.currentWorkflow || task.currentWorkflow || ""}
              onChange={(e) => {
                setUpdates({ ...updates, currentWorkflow: e.target.value });
                setHasChanges(true);
              }}
              className="w-full border border-gray-300 rounded p-2 text-sm focus:outline-none focus:border-red-500 bg-white"
              rows={2}
              placeholder="How is it currently done?"
            />
          </div>
        )}

        {currentTemplate.fields.desiredImprovement && (
          <div>
            <label className="block text-sm font-semibold text-gray-900 mb-2">
              Desired Improvement
            </label>
            <textarea
              value={updates.desiredImprovement || task.desiredImprovement || ""}
              onChange={(e) => {
                setUpdates({ ...updates, desiredImprovement: e.target.value });
                setHasChanges(true);
              }}
              className="w-full border border-gray-300 rounded p-2 text-sm focus:outline-none focus:border-red-500 bg-white"
              rows={2}
              placeholder="What should improve?"
            />
          </div>
        )}

        {currentTemplate.fields.qualityRequirements && (
          <div>
            <label className="block text-sm font-semibold text-gray-900 mb-2">
              Quality Requirements
            </label>
            <textarea
              value={updates.qualityRequirements || task.qualityRequirements || ""}
              onChange={(e) => {
                setUpdates({ ...updates, qualityRequirements: e.target.value });
                setHasChanges(true);
              }}
              className="w-full border border-gray-300 rounded p-2 text-sm focus:outline-none focus:border-red-500 bg-white"
              rows={2}
              placeholder="What quality standards?"
            />
          </div>
        )}

        {currentTemplate.fields.blockers && (
          <div>
            <label className="block text-sm font-semibold text-gray-900 mb-2">
              Blockers / Risks
            </label>
            <textarea
              value={updates.blockers || task.blockers || ""}
              onChange={(e) => {
                setUpdates({ ...updates, blockers: e.target.value });
                setHasChanges(true);
              }}
              className="w-full border border-gray-300 rounded p-2 text-sm focus:outline-none focus:border-red-500 bg-white"
              rows={2}
              placeholder="What could block this?"
            />
          </div>
        )}

        {/* Rarely-changed settings collapse behind one toggle so the panel
            stays calm. Opens automatically when the task has guests. */}
        <div className="border-t border-gray-100 pt-4">
          <button
            type="button"
            onClick={() => setShowMore(!showMore)}
            aria-expanded={showMore}
            className="flex items-center gap-1.5 text-sm font-semibold text-gray-700 hover:text-gray-900 transition rounded focus:outline-none focus-visible:ring-2 focus-visible:ring-red-400"
          >
            <ChevronDownIcon
              size={15}
              className={`text-gray-400 transition-transform motion-reduce:transition-none ${
                showMore ? "" : "-rotate-90"
              }`}
            />
            More settings
            <span className="font-normal text-xs text-gray-400">
              · template{!isStaged ? ", guests" : ""}
              {currentTemplate.fields.automationOpportunity ? ", automation" : ""}
              {guests.length > 0 && (
                <span className="text-purple-600"> · {guests.length} guest{guests.length > 1 ? "s" : ""}</span>
              )}
            </span>
          </button>

          {showMore && (
            <div className="mt-4 space-y-5">
              <div>
                <label htmlFor="task-template" className="block text-sm font-semibold text-gray-900 mb-2">
                  Template
                </label>
                <Select
                  id="task-template"
                  value={template}
                  onChange={(e) => {
                    setTemplate(e.target.value);
                    setHasChanges(true);
                  }}
                >
                  {Object.values(TASK_TEMPLATES).map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.name}
                    </option>
                  ))}
                </Select>
                <p className="text-xs text-gray-500 mt-1">{currentTemplate.description}</p>
              </div>

              {currentTemplate.fields.automationOpportunity && (
                <div>
                  <label
                    htmlFor="task-automation"
                    className="flex items-center gap-1.5 text-sm font-semibold text-gray-900 mb-2"
                  >
                    <ZapIcon size={14} className="text-amber-500" /> Automation opportunity
                  </label>
                  <textarea
                    id="task-automation"
                    value={
                      updates.automationOpportunity !== undefined
                        ? updates.automationOpportunity
                        : task.automationOpportunity || ""
                    }
                    onChange={(e) => {
                      setUpdates({ ...updates, automationOpportunity: e.target.value });
                      setHasChanges(true);
                    }}
                    className="w-full border border-gray-300 rounded-md p-2 text-sm bg-white transition focus:outline-none focus:border-red-400 focus:ring-2 focus:ring-red-100"
                    rows={2}
                    placeholder="What's done manually today, and what could it become?"
                  />
                </div>
              )}

              {/* Guests — invite anyone to just this task, without project
                  access. Hidden on staged tasks (admin-only imports). */}
              {!isStaged && (
                <div>
                  <label className="block text-sm font-semibold text-gray-900 mb-1">Guests</label>
                  <p className="text-xs text-gray-400 mb-2">
                    Guests see and comment on this task only — not the rest of the board.
                    @mentioning someone outside the project also adds them here.
                  </p>
                  <div className="flex flex-wrap items-center gap-1.5">
                    {guests.map((g) => (
                      <span
                        key={g.userId}
                        className="inline-flex items-center gap-1 bg-purple-50 text-purple-700 text-xs font-medium rounded-full pl-2.5 pr-1 py-1"
                      >
                        {g.user?.name || "Unknown"}
                        <button
                          onClick={() => handleRemoveGuest(g.userId, g.user?.name || "Guest")}
                          className="h-4 w-4 rounded-full hover:bg-purple-200 text-purple-500 flex items-center justify-center"
                          title="Remove guest"
                          aria-label={`Remove guest ${g.user?.name || ""}`}
                        >
                          <CloseIcon size={10} />
                        </button>
                      </span>
                    ))}
                    <select
                      value=""
                      disabled={addingGuest}
                      onChange={(e) => handleAddGuest(e.target.value)}
                      aria-label="Add a guest"
                      className="text-xs border border-dashed border-gray-300 rounded-full px-2 py-1 text-gray-500 focus:outline-none focus:border-red-400 bg-transparent"
                    >
                      <option value="">{addingGuest ? "Adding…" : "+ Add guest"}</option>
                      {members
                        .filter(
                          (u) =>
                            !guests.some((g) => g.userId === u.id) &&
                            !projectMembers.some((m) => m.id === u.id)
                        )
                        .map((u) => (
                          <option key={u.id} value={u.id}>
                            {u.name}
                          </option>
                        ))}
                    </select>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Subtasks */}
        <div>
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-semibold text-gray-900">
              Subtasks {totalSubtasks > 0 && `(${completedSubtasks}/${totalSubtasks})`}
            </h3>
            {totalSubtasks > 0 && (
              <div className="w-24 h-2 bg-gray-200 rounded-full overflow-hidden">
                <div
                  className="h-full bg-green-600 transition-all"
                  style={{
                    width: `${totalSubtasks > 0 ? (completedSubtasks / totalSubtasks) * 100 : 0}%`,
                  }}
                />
              </div>
            )}
          </div>

          {task.subtasks && task.subtasks.length > 0 && (
            <DragDropContext onDragEnd={handleSubtaskDragEnd}>
              <Droppable droppableId="subtasks">
                {(provided) => (
                  <div
                    ref={provided.innerRef}
                    {...provided.droppableProps}
                    className="space-y-2 mb-3"
                  >
                    {task.subtasks.map((subtask: Subtask, index: number) => (
                      <Draggable key={subtask.id} draggableId={subtask.id} index={index}>
                        {(dp, snap) => (
                          <div
                            ref={dp.innerRef}
                            {...dp.draggableProps}
                            className={`bg-white rounded-lg border transition ${
                              snap.isDragging
                                ? "border-red-300 shadow-lg"
                                : "border-gray-200 hover:border-gray-300"
                            }`}
                          >
                            <div className="flex items-start gap-2 p-2.5">
                              <span
                                {...dp.dragHandleProps}
                                className="mt-0.5 text-gray-300 hover:text-gray-500 cursor-grab active:cursor-grabbing"
                                title="Drag to reorder"
                              >
                                <GripIcon size={16} />
                              </span>
                              <input
                                type="checkbox"
                                checked={subtask.status === "DONE"}
                                onChange={() =>
                                  handleToggleSubtaskStatus(subtask.id, subtask.status)
                                }
                                className="mt-0.5 w-4 h-4 rounded border-gray-300 cursor-pointer accent-red-600"
                              />
                              <div className="flex-1 min-w-0">
                                {/* Click the title to open the subtask (drill-down). */}
                                <button
                                  onClick={() => onOpenTask?.(subtask.id)}
                                  title="Open subtask"
                                  className={`block w-full text-left text-sm break-words hover:text-red-600 ${
                                    subtask.status === "DONE"
                                      ? "line-through text-gray-400"
                                      : "text-gray-800"
                                  }`}
                                >
                                  {subtask.title}
                                </button>
                                <div className="flex items-center gap-2 mt-2">
                                  <select
                                    value={subtask.assigneeId || ""}
                                    onChange={(e) =>
                                      handleSubtaskAssignee(subtask.id, e.target.value || null)
                                    }
                                    title="Assign subtask"
                                    className="text-xs bg-gray-50 border border-gray-200 rounded-md px-2 py-1 text-gray-600 focus:outline-none focus:border-red-500 max-w-[160px]"
                                  >
                                    <option value="">Unassigned</option>
                                    {members.map((u) => (
                                      <option key={u.id} value={u.id}>
                                        {u.name}
                                      </option>
                                    ))}
                                  </select>
                                  <button
                                    onClick={() => handleDeleteSubtask(subtask.id)}
                                    className="ml-auto inline-flex items-center gap-1 text-xs text-gray-500 hover:text-white hover:bg-red-600 border border-gray-200 hover:border-red-600 rounded-md px-2 py-1 transition"
                                    title="Delete subtask"
                                  >
                                    <TrashIcon size={14} /> Delete
                                  </button>
                                </div>
                              </div>
                            </div>
                            {isStaged && (
                              <div className="px-2.5 pb-2.5">
                                <DistributeControl
                                  taskId={subtask.id}
                                  destinations={destProjects}
                                  people={members}
                                  defaultAi={true}
                                  buttonLabel="Make into a task for someone"
                                />
                              </div>
                            )}
                          </div>
                        )}
                      </Draggable>
                    ))}
                    {provided.placeholder}
                  </div>
                )}
              </Droppable>
            </DragDropContext>
          )}

          <div className="flex gap-2">
            <input
              type="text"
              value={newSubtaskTitle}
              onChange={(e) => setNewSubtaskTitle(e.target.value)}
              onKeyPress={(e) => e.key === "Enter" && handleCreateSubtask()}
              placeholder="Add a subtask…"
              className="flex-1 border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-red-500"
            />
            <Button
              onClick={handleCreateSubtask}
              disabled={creatingSubtask || !newSubtaskTitle.trim()}
              variant="primary"
              leftIcon={<PlusIcon size={16} />}
            >
              Add
            </Button>
          </div>
        </div>

        {/* Attachments */}
        <div>
          <h3 className="text-sm font-semibold text-gray-900 mb-3">Attachments</h3>
          <AttachmentList taskId={taskId} />
        </div>

        {/* Comments */}
        <div>
          <h3 className="text-sm font-semibold text-gray-900 mb-3">Comments</h3>
          <CommentList
            taskId={taskId}
            comments={task.comments}
            members={members.length ? members : projectMembers}
            onChanged={handleCommentAdded}
          />
          <CommentForm
            taskId={taskId}
            members={members.length ? members : projectMembers}
            onCommentAdded={handleCommentAdded}
          />
        </div>

        {/* Danger zone — at the far end of the panel, away from the ✕ close
            button, so deleting is always a deliberate act. */}
        {task.accessLevel !== "GUEST" && (
          <div className="border-t border-gray-100 pt-4 flex justify-end">
            <Button
              onClick={() => setConfirmDeleteTask(true)}
              variant="danger"
              size="sm"
              leftIcon={<TrashIcon size={14} />}
            >
              Delete task
            </Button>
          </div>
        )}

        {/* Actions */}
        {hasChanges && (
          <div className="flex gap-2 pt-4 border-t sticky bottom-0 bg-white -mx-6 px-6 pb-1">
            <Button onClick={handleSave} variant="primary" size="lg" className="flex-1">
              Save changes
            </Button>
            <button
              onClick={() => {
                setUpdates({});
                setHasChanges(false);
              }}
              className="flex-1 bg-gray-100 hover:bg-gray-200 text-gray-700 font-medium py-2.5 px-4 rounded-lg transition"
            >
              Discard
            </button>
          </div>
        )}
      </div>

      <ConfirmDialog
        open={confirmDeleteTask}
        title="Delete this task?"
        message="The task with its subtasks, comments and attachments is removed for everyone. This can't be undone."
        confirmLabel="Delete task"
        onConfirm={handleDeleteTask}
        onCancel={() => setConfirmDeleteTask(false)}
      />
      </div>
    </>
  );
}
