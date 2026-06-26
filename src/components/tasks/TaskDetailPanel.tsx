"use client";

import { useState, useEffect } from "react";
import { CommentList } from "./CommentList";
import { CommentForm } from "./CommentForm";
import { AttachmentList } from "./AttachmentList";
import { DistributeControl } from "./DistributeControl";
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
  const [task, setTask] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [updates, setUpdates] = useState<any>({});
  const [template, setTemplate] = useState("general");
  const [newSubtaskTitle, setNewSubtaskTitle] = useState("");
  const [creatingSubtask, setCreatingSubtask] = useState(false);
  const [hasChanges, setHasChanges] = useState(false);
  const [members, setMembers] = useState<any[]>([]);
  // Only people on this task's project can be @mentioned — a mention should
  // never silently grant a non-member access to PHI on the task.
  const [projectMembers, setProjectMembers] = useState<any[]>([]);
  // Real (non-staging) projects to distribute staged tasks into.
  const [destProjects, setDestProjects] = useState<any[]>([]);
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
        try {
          if (data.projectId) {
            const pmRes = await fetch(`/api/projects/${data.projectId}/members`);
            if (pmRes.ok) {
              const pm = await pmRes.json();
              setProjectMembers(
                (pm || [])
                  .map((m: any) => m.user)
                  .filter((u: any) => u && u.id)
              );
            }
          }
        } catch {
          // Non-fatal: mention autocomplete just won't have options
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to load task");
      } finally {
        setLoading(false);
      }
    };

    fetchTask();
  }, [taskId]);

  const handleAssigneeChange = async (assigneeId: string | null) => {
    try {
      const response = await fetch(`/api/tasks/${taskId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ assigneeId }),
      });

      if (!response.ok) throw new Error("Failed to update assignee");
      const updated = await response.json();
      setTask(updated);
      onTaskUpdated?.();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to update assignee");
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
      setTask(updated);
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
      setTask(updated);
      setUpdates({});
      setHasChanges(false);
      onTaskUpdated?.(); // refresh the board so card priority/title update immediately
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save task");
    }
  };

  const handleCreateSubtask = async () => {
    if (!newSubtaskTitle.trim()) return;

    try {
      setCreatingSubtask(true);
      console.log("Creating subtask with:", {
        projectId: task.projectId,
        title: newSubtaskTitle,
        parentTaskId: taskId,
      });

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

      console.log("Subtask creation response:", response.status);
      if (!response.ok) {
        const errText = await response.text();
        throw new Error(`Failed to create subtask: ${errText}`);
      }
      const newSubtask = await response.json();
      console.log("Created subtask:", newSubtask);

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
    console.log("Toggling subtask", subtaskId, "from", currentStatus, "to", newStatus);

    try {
      const response = await fetch(`/api/tasks/${subtaskId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: newStatus }),
      });

      console.log("Subtask update response:", response.status);
      if (!response.ok) throw new Error("Failed to update subtask");

      setTask({
        ...task,
        subtasks: task.subtasks.map((s: Subtask) =>
          s.id === subtaskId ? { ...s, status: newStatus } : s
        ),
      });
      console.log("Subtask updated in UI");
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

  const handleMoveSubtask = async (index: number, direction: -1 | 1) => {
    const list = [...(task.subtasks || [])];
    const target = index + direction;
    if (target < 0 || target >= list.length) return;

    // Swap positions locally, then persist the new order for both
    [list[index], list[target]] = [list[target], list[index]];
    setTask({ ...task, subtasks: list });

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
      setTask(data);
    } catch (err) {
      console.error("Failed to refresh comments:", err);
    }
  };

  const handleDeleteTask = async () => {
    if (!confirm("Are you sure you want to delete this task? This cannot be undone.")) {
      return;
    }

    try {
      const response = await fetch(`/api/tasks/${taskId}`, {
        method: "DELETE",
      });

      if (!response.ok) throw new Error("Failed to delete task");

      onClose?.();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to delete task");
    }
  };

  if (loading) {
    return (
      <div className="fixed right-0 top-0 h-screen w-full max-w-[460px] bg-white shadow-2xl border-l border-gray-200 p-6 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin h-8 w-8 border-2 border-red-500 border-t-transparent rounded-full mx-auto mb-2" />
          <p className="text-gray-600">Loading...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="fixed right-0 top-0 h-screen w-full max-w-[460px] bg-white shadow-2xl border-l border-gray-200 p-6">
        <div className="text-red-600 mb-4">{error}</div>
        <button onClick={onClose} className="text-blue-600 hover:underline">
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
    <div className="fixed right-0 top-0 h-screen w-full max-w-[460px] bg-white shadow-2xl border-l border-gray-200 overflow-y-auto">
      <div className="p-6 border-b sticky top-0 bg-white">
        {task.parentTaskId && onOpenTask && (
          <button
            onClick={() => onOpenTask(task.parentTaskId)}
            className="text-xs text-gray-500 hover:text-red-600 mb-2 flex items-center gap-1"
            title="Back to parent task"
          >
            ↑ Back to parent task
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
              className="w-full text-xl font-bold border-b-2 border-gray-200 hover:border-blue-400 focus:border-red-500 focus:outline-none mb-2 bg-transparent resize-none overflow-hidden break-words"
              placeholder="Task title..."
            />
            <p className="text-xs text-gray-500">
              Created by {task.createdBy?.name || "Unknown"}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={handleDeleteTask}
              className="text-red-400 hover:text-red-600 text-sm px-2 py-1"
              title="Delete task"
            >
              🗑️ Delete
            </button>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-600 text-2xl"
            >
              ×
            </button>
          </div>
        </div>
      </div>

      <div className="p-6 space-y-6">
        {/* Staged (Asana import) — distribute this task into a real project */}
        {isStaged && (
          <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 space-y-2">
            <div className="text-xs font-semibold text-amber-800">
              📥 Staged from Asana
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

        {/* Template Selector */}
        <div>
          <label className="block text-sm font-semibold text-gray-900 mb-2">
            Template
          </label>
          <select
            value={template}
            onChange={(e) => {
              setTemplate(e.target.value);
              setHasChanges(true);
            }}
            className="w-full border border-gray-300 rounded p-2 text-sm focus:outline-none focus:border-red-500"
          >
            {Object.values(TASK_TEMPLATES).map((t) => (
              <option key={t.id} value={t.id}>
                {t.name}
              </option>
            ))}
          </select>
          <p className="text-xs text-gray-500 mt-1">{currentTemplate.description}</p>
        </div>

        {/* Dynamic Fields Based on Template */}

        {currentTemplate.fields.description && (
          <div>
            <label className="block text-sm font-semibold text-gray-900 mb-2">
              Description
            </label>
            <textarea
              value={updates.description !== undefined ? updates.description : task.description || ""}
              onChange={(e) => {
                setUpdates({ ...updates, description: e.target.value });
                setHasChanges(true);
              }}
              className="w-full border border-gray-300 rounded p-2 text-sm focus:outline-none focus:border-red-500 bg-white"
              rows={3}
              placeholder="Add a description..."
            />
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

        {currentTemplate.fields.automationOpportunity && (
          <div>
            <label className="block text-sm font-semibold text-gray-900 mb-2">
              ⚡ Automation Opportunity
            </label>
            <textarea
              value={
                updates.automationOpportunity !== undefined
                  ? updates.automationOpportunity
                  : task.automationOpportunity || ""
              }
              onChange={(e) => {
                setUpdates({ ...updates, automationOpportunity: e.target.value });
                setHasChanges(true);
              }}
              className="w-full border border-gray-300 rounded p-2 text-sm focus:outline-none focus:border-red-500 bg-white"
              rows={2}
              placeholder="What's done manually today, and what could it become?"
            />
          </div>
        )}

        {/* Assignee */}
        <div>
          <label className="block text-sm font-semibold text-gray-900 mb-2">
            Assigned To
          </label>
          <select
            value={task.assigneeId || ""}
            onChange={(e) => handleAssigneeChange(e.target.value || null)}
            className="w-full border border-gray-300 rounded p-2 text-sm focus:outline-none focus:border-red-500"
          >
            <option value="">Unassigned</option>
            {members.map((u) => (
              <option key={u.id} value={u.id}>
                {u.name} ({u.email})
              </option>
            ))}
          </select>
        </div>

        {/* Status */}
        <div>
          <label className="block text-sm font-semibold text-gray-900 mb-2">Status</label>
          <select
            value={updates.status !== undefined ? updates.status : task.status}
            onChange={async (e) => {
              const newStatus = e.target.value;
              setUpdates({ ...updates, status: newStatus });
              setHasChanges(true);
              console.log("Updating status to:", newStatus);
              try {
                const response = await fetch(`/api/tasks/${taskId}`, {
                  method: "PATCH",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({ status: newStatus }),
                });
                console.log("Status update response:", response.status);
                if (!response.ok) {
                  const errorData = await response.json();
                  throw new Error(errorData.details || "Failed to update status");
                }
                const updated = await response.json();
                setTask(updated);
                setUpdates({});
                setHasChanges(false);
                console.log("Status updated, calling onTaskUpdated");
                onTaskUpdated?.();
              } catch (err) {
                console.error("Status update error:", err);
                setError(err instanceof Error ? err.message : "Failed to update status");
              }
            }}
            className="w-full border border-gray-300 rounded p-2 text-sm focus:outline-none focus:border-red-500"
          >
            <option value="TODO">To Do</option>
            <option value="IN_PROGRESS">In Progress</option>
            <option value="IN_REVIEW">In Review</option>
            <option value="DONE">Done</option>
          </select>
        </div>

        {/* Priority */}
        {currentTemplate.fields.priority && (
          <div>
            <label className="block text-sm font-semibold text-gray-900 mb-2">Priority</label>
            <select
              value={updates.priority !== undefined ? updates.priority : task.priority}
              onChange={(e) => handlePriorityChange(e.target.value)}
              className="w-full border border-gray-300 rounded p-2 text-sm focus:outline-none focus:border-red-500"
            >
              <option value="LOW">Low</option>
              <option value="MEDIUM">Medium</option>
              <option value="HIGH">High</option>
            </select>
          </div>
        )}

        {/* Due Date */}
        {currentTemplate.fields.dueDate && (
          <div>
            <label className="block text-sm font-semibold text-gray-900 mb-2">Due Date</label>
            <input
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
              className="w-full border border-gray-300 rounded p-2 text-sm focus:outline-none focus:border-red-500"
            />
          </div>
        )}

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
            <div className="space-y-2 mb-3">
              {task.subtasks.map((subtask: Subtask, index: number) => (
                <div key={subtask.id} className="bg-gray-50 rounded">
                <div className="flex items-center gap-1 p-2 text-sm hover:bg-gray-100 transition rounded">
                  <input
                    type="checkbox"
                    checked={subtask.status === "DONE"}
                    onChange={() =>
                      handleToggleSubtaskStatus(subtask.id, subtask.status)
                    }
                    className="w-4 h-4 rounded border-gray-300 cursor-pointer"
                  />
                  {/* Click the title to open the subtask in its own panel (Asana-style
                      drill-down — a subtask can itself have subtasks + an assignee). */}
                  <button
                    onClick={() => onOpenTask?.(subtask.id)}
                    title="Open subtask"
                    className={`flex-1 text-left truncate px-1 hover:text-red-600 hover:underline ${
                      subtask.status === "DONE"
                        ? "line-through text-gray-400"
                        : "text-gray-700"
                    }`}
                  >
                    {subtask.title}
                  </button>
                  {/* Inline assignee — hand the subtask to a specific person. */}
                  <select
                    value={subtask.assigneeId || ""}
                    onChange={(e) =>
                      handleSubtaskAssignee(subtask.id, e.target.value || null)
                    }
                    onClick={(e) => e.stopPropagation()}
                    title="Assign subtask"
                    className="max-w-[90px] text-xs bg-white border border-gray-200 rounded px-1 py-0.5 text-gray-600 focus:outline-none focus:border-red-500"
                  >
                    <option value="">— </option>
                    {members.map((u) => (
                      <option key={u.id} value={u.id}>
                        {u.name}
                      </option>
                    ))}
                  </select>
                  <div className="flex flex-col leading-none">
                    <button
                      onClick={() => handleMoveSubtask(index, -1)}
                      disabled={index === 0}
                      className="text-gray-400 hover:text-blue-600 disabled:opacity-30 text-[10px]"
                      title="Move up"
                    >
                      ▲
                    </button>
                    <button
                      onClick={() => handleMoveSubtask(index, 1)}
                      disabled={index === task.subtasks.length - 1}
                      className="text-gray-400 hover:text-blue-600 disabled:opacity-30 text-[10px]"
                      title="Move down"
                    >
                      ▼
                    </button>
                  </div>
                  <button
                    onClick={() => handleDeleteSubtask(subtask.id)}
                    className="text-gray-400 hover:text-red-600 transition text-xs px-1"
                    title="Delete subtask"
                  >
                    ✕
                  </button>
                </div>
                {isStaged && (
                  <div className="px-2 pb-2">
                    <DistributeControl
                      taskId={subtask.id}
                      destinations={destProjects}
                      people={members}
                      defaultAi={true}
                      buttonLabel="✨ Make into task for someone"
                    />
                  </div>
                )}
                </div>
              ))}
            </div>
          )}

          <div className="flex gap-2">
            <input
              type="text"
              value={newSubtaskTitle}
              onChange={(e) => setNewSubtaskTitle(e.target.value)}
              onKeyPress={(e) => e.key === "Enter" && handleCreateSubtask()}
              placeholder="Add a subtask..."
              className="flex-1 border border-gray-300 rounded px-2 py-1 text-sm focus:outline-none focus:border-red-500"
            />
            <button
              onClick={handleCreateSubtask}
              disabled={creatingSubtask || !newSubtaskTitle.trim()}
              className="bg-red-600 hover:bg-red-700 disabled:bg-gray-400 text-white px-3 py-1 rounded text-sm transition"
            >
              Add
            </button>
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
            members={projectMembers}
            onChanged={handleCommentAdded}
          />
          <CommentForm
            taskId={taskId}
            members={projectMembers}
            onCommentAdded={handleCommentAdded}
          />
        </div>

        {/* Actions */}
        {hasChanges && (
          <div className="flex gap-2 pt-4 border-t">
            <button
              onClick={handleSave}
              className="flex-1 bg-red-600 hover:bg-red-700 text-white font-semibold py-2 px-4 rounded transition"
            >
              Save Changes
            </button>
            <button
              onClick={() => {
                setUpdates({});
                setHasChanges(false);
              }}
              className="flex-1 bg-gray-300 hover:bg-gray-400 text-gray-900 font-semibold py-2 px-4 rounded transition"
            >
              Discard
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
