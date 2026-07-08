"use client";

import { useState, useEffect, useCallback } from "react";
import { useParams } from "next/navigation";
import { KanbanBoard } from "@/components/board/KanbanBoard";
import { TaskDetailPanel } from "@/components/tasks/TaskDetailPanel";
import { SmartTaskDiscovery } from "@/components/tasks/SmartTaskDiscovery";
import { Button } from "@/components/ui/Button";
import { PlusIcon, SparklesIcon, UsersIcon, TrashIcon } from "@/components/ui/icons";
import { useToast } from "@/components/ui/Toast";

interface Project {
  id: string;
  name: string;
  columns: any[];
  tasks: any[];
  members: any[];
}

export default function ProjectPage() {
  const params = useParams();
  const projectId = params.projectId as string;
  const toast = useToast();

  const [project, setProject] = useState<Project | null>(null);
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [assigneeFilter, setAssigneeFilter] = useState("");

  // Open a specific task when linked from the dashboard (?task=<id>)
  useEffect(() => {
    const taskParam = new URLSearchParams(window.location.search).get("task");
    if (taskParam) setSelectedTaskId(taskParam);
  }, []);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [newTaskName, setNewTaskName] = useState("");
  const [formError, setFormError] = useState<string | null>(null);
  const [showNewTaskForm, setShowNewTaskForm] = useState(false);
  const [showGuidedForm, setShowGuidedForm] = useState(false);
  const [showMembers, setShowMembers] = useState(false);
  const [memberEmail, setMemberEmail] = useState("");
  const [memberError, setMemberError] = useState<string | null>(null);
  const [addingMember, setAddingMember] = useState(false);
  const [allUsers, setAllUsers] = useState<any[]>([]);

  useEffect(() => {
    fetch("/api/users")
      .then((r) => (r.ok ? r.json() : []))
      .then(setAllUsers)
      .catch(() => setAllUsers([]));
  }, []);

  const handleAddMember = async (e: React.FormEvent) => {
    e.preventDefault();
    setMemberError(null);
    if (!memberEmail.trim()) return;

    try {
      setAddingMember(true);
      const res = await fetch(`/api/projects/${projectId}/members`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: memberEmail.toLowerCase().trim() }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to add member");
      }

      setMemberEmail("");
      await fetchProject();
    } catch (err) {
      setMemberError(err instanceof Error ? err.message : "Failed to add member");
    } finally {
      setAddingMember(false);
    }
  };

  const handleRemoveMember = async (userId?: string, name?: string) => {
    if (!userId) return;
    if (!confirm(`Remove ${name || "this person"} from the project?`)) return;
    setMemberError(null);

    try {
      const res = await fetch(`/api/projects/${projectId}/members?userId=${userId}`, {
        method: "DELETE",
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || "Failed to remove member");
      }
      await fetchProject();
    } catch (err) {
      setMemberError(err instanceof Error ? err.message : "Failed to remove member");
    }
  };

  const fetchProject = useCallback(async () => {
    try {
      const response = await fetch(`/api/projects/${projectId}`);
      if (!response.ok) {
        // Task guests can open a linked task but not its board — send them to
        // the standalone task view instead of a dead error page.
        const taskParam = new URLSearchParams(window.location.search).get("task");
        if (taskParam && (response.status === 403 || response.status === 404)) {
          window.location.replace(`/tasks/${taskParam}`);
          return;
        }
        throw new Error("Failed to fetch project");
      }
      const data = await response.json();
      setProject(data);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load project");
    } finally {
      setLoading(false);
    }
  }, [projectId]);

  useEffect(() => {
    fetchProject();
  }, [fetchProject]);

  const handleCreateTask = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);

    if (!newTaskName.trim()) {
      setFormError("Task title is required");
      return;
    }

    if (newTaskName.length > 255) {
      setFormError("Task title must be less than 255 characters");
      return;
    }

    try {
      const firstColumn = project?.columns?.[0];

      if (!firstColumn) {
        setFormError("No columns in project. Please refresh the page.");
        return;
      }

      const response = await fetch("/api/tasks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          projectId,
          title: newTaskName.trim(),
          columnId: firstColumn.id,
        }),
      });

      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        throw new Error(data.error || `Failed to create task (${response.status})`);
      }

      setNewTaskName("");
      setShowNewTaskForm(false);
      await fetchProject();
    } catch (err) {
      // Use formError so a creation failure doesn't replace the whole page
      setFormError(err instanceof Error ? err.message : "Failed to create task");
    }
  };

  const handleCreateTaskInColumn = async (columnId: string, title: string) => {
    try {
      const response = await fetch("/api/tasks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ projectId, title, columnId }),
      });
      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        throw new Error(data.error || "Failed to create task");
      }
      await fetchProject();
      toast("Task added");
    } catch (err) {
      toast(err instanceof Error ? err.message : "Failed to add task", "error");
    }
  };

  const handleTaskUpdate = async (taskId: string, updates: any) => {
    try {
      const response = await fetch(`/api/tasks/${taskId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(updates),
      });

      if (!response.ok) throw new Error("Failed to update task");
      await fetchProject();
    } catch (err) {
      // Don't replace the whole page on a drag-drop failure
      console.error("Task update failed:", err);
      setFormError(err instanceof Error ? err.message : "Failed to update task");
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="text-center">
          <div className="animate-spin h-8 w-8 border-2 border-red-500 border-t-transparent rounded-full mx-auto mb-2" />
          <p className="text-gray-600">Loading project...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-center py-12">
        <div className="bg-red-50 border border-red-200 rounded-lg p-6 max-w-md mx-auto">
          <p className="text-red-700 font-semibold mb-4">Project not found</p>
          <p className="text-red-600 text-sm mb-4">{error}</p>
          <a
            href="/projects"
            className="inline-block bg-red-600 hover:bg-red-700 text-white font-semibold py-2 px-4 rounded"
          >
            ← Back to Projects
          </a>
        </div>
      </div>
    );
  }

  if (!project) {
    return <div className="text-gray-600">Project not found.</div>;
  }

  const staged = (project as any).isStaging;

  return (
    <div>
      {/* Back navigation — always know how to return to the list */}
      <div className="mb-3">
        <a
          href={staged ? "/admin/staging" : "/projects"}
          className="inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-red-600 transition"
        >
          <span className="text-base leading-none">←</span>
          {staged ? "Back to Staging" : "Back to Projects"}
        </a>
      </div>

      {staged && (
        <div className="mb-4 flex items-center gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">
          📥 <span className="font-medium">Staging (Asana import)</span>
          <span className="text-amber-700">
            — imported, admin-only. Open a task to copy it into a real project for someone.
          </span>
        </div>
      )}

      <div className="mb-6 flex flex-wrap justify-between items-center gap-3">
        <textarea
          rows={1}
          value={project.name}
          onChange={(e) => setProject({ ...project, name: e.target.value })}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              e.currentTarget.blur();
            }
          }}
          onBlur={async (e) => {
            const newName = e.target.value.trim();
            if (!newName) return;
            await fetch(`/api/projects/${projectId}`, {
              method: "PATCH",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ name: newName }),
            });
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
          className="flex-1 min-w-0 mr-4 text-2xl font-bold text-gray-900 bg-transparent border-b-2 border-transparent hover:border-gray-200 focus:border-red-500 focus:outline-none resize-none overflow-hidden break-words"
          aria-label="Project name"
        />
        <div className="flex flex-wrap gap-2 flex-shrink-0">
          <Button
            active={showNewTaskForm}
            onClick={() => {
              setShowNewTaskForm(!showNewTaskForm);
              setShowGuidedForm(false);
            }}
            leftIcon={<PlusIcon size={16} />}
          >
            Quick Task
          </Button>
          <Button
            active={showGuidedForm}
            onClick={() => {
              setShowGuidedForm(!showGuidedForm);
              setShowNewTaskForm(false);
            }}
            leftIcon={<SparklesIcon size={16} />}
          >
            AI Task Creator
          </Button>
          <Button
            active={showMembers}
            onClick={() => setShowMembers(!showMembers)}
            leftIcon={<UsersIcon size={16} />}
          >
            Members ({project.members?.length || 0})
          </Button>
        </div>
      </div>

      {showMembers && (
        <div className="mb-6 bg-white rounded-lg shadow p-4">
          <h3 className="text-sm font-semibold text-gray-900 mb-3">Project Members</h3>

          <div className="space-y-2 mb-4">
            {(project.members || []).map((m: any) => (
              <div
                key={m.id}
                className="flex items-center justify-between text-sm bg-gray-50 rounded px-3 py-2"
              >
                <span className="text-gray-700">
                  {m.user?.name}{" "}
                  <span className="text-gray-400">({m.user?.email})</span>
                </span>
                <button
                  onClick={() => handleRemoveMember(m.user?.id, m.user?.name)}
                  className="inline-flex items-center gap-1 text-xs text-gray-500 hover:text-white hover:bg-red-600 border border-gray-200 hover:border-red-600 rounded-md px-2 py-1 transition"
                  title="Remove from project"
                >
                  <TrashIcon size={13} /> Remove
                </button>
              </div>
            ))}
          </div>

          {memberError && (
            <div className="mb-3 p-2 bg-red-50 border border-red-200 rounded text-red-700 text-xs">
              {memberError}
            </div>
          )}

          <form onSubmit={handleAddMember} className="flex gap-2">
            <select
              value={memberEmail}
              onChange={(e) => setMemberEmail(e.target.value)}
              className="flex-1 border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:border-red-500"
            >
              <option value="">Choose a person to assign…</option>
              {allUsers
                .filter(
                  (u) =>
                    !(project.members || []).some((m: any) => m.user?.email === u.email)
                )
                .map((u) => (
                  <option key={u.id} value={u.email}>
                    {u.name} ({u.email})
                  </option>
                ))}
            </select>
            <Button
              type="submit"
              variant="primary"
              disabled={addingMember || !memberEmail.trim()}
            >
              {addingMember ? "Adding…" : "Assign to project"}
            </Button>
          </form>
          <p className="text-xs text-gray-500 mt-2">
            Assigning a person to the project lets them see and work on its board.
          </p>
        </div>
      )}

      {showNewTaskForm && (
        <div className="mb-6 bg-white rounded-lg shadow p-4">
          {formError && (
            <div className="mb-3 p-2 bg-red-50 border border-red-200 rounded text-red-700 text-sm">
              {formError}
            </div>
          )}
          <form onSubmit={handleCreateTask} className="flex gap-2">
            <label htmlFor="quickTaskInput" className="sr-only">
              Task name
            </label>
            <input
              id="quickTaskInput"
              type="text"
              value={newTaskName}
              onChange={(e) => setNewTaskName(e.target.value)}
              placeholder="Task name…"
              className="flex-1 border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:border-red-500 text-sm"
              autoFocus
            />
            <Button type="submit" variant="primary" leftIcon={<PlusIcon size={16} />}>
              Add
            </Button>
            <Button
              type="button"
              variant="subtle"
              onClick={() => {
                setShowNewTaskForm(false);
                setFormError(null);
              }}
            >
              Cancel
            </Button>
          </form>
        </div>
      )}

      {showGuidedForm && (
        <SmartTaskDiscovery
          projectId={projectId}
          firstColumnId={project?.columns?.[0]?.id}
          onTaskCreated={() => {
            setShowGuidedForm(false);
            fetchProject();
          }}
          onCancel={() => setShowGuidedForm(false)}
        />
      )}

      {/* Search + assignee filter */}
      <div className="flex flex-wrap items-center gap-2 mb-4">
        <div className="relative flex-1 min-w-[200px] max-w-sm">
          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm">
            🔍
          </span>
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search tasks…"
            className="w-full border border-gray-300 rounded-lg pl-9 pr-3 py-2 text-sm focus:outline-none focus:border-red-500"
          />
        </div>
        <select
          value={assigneeFilter}
          onChange={(e) => setAssigneeFilter(e.target.value)}
          className="border border-gray-300 rounded-lg px-3 py-2 text-sm text-gray-700 focus:outline-none focus:border-red-500"
        >
          <option value="">Everyone</option>
          <option value="__unassigned__">Unassigned</option>
          {(project.members || []).map((m: any) => (
            <option key={m.user?.id} value={m.user?.id}>
              {m.user?.name}
            </option>
          ))}
        </select>
        {(search || assigneeFilter) && (
          <button
            onClick={() => {
              setSearch("");
              setAssigneeFilter("");
            }}
            className="text-sm text-gray-500 hover:text-red-600"
          >
            Clear
          </button>
        )}
      </div>

      {project.columns.length > 0 ? (
        <KanbanBoard
          columns={project.columns}
          tasks={(project.tasks || []).filter((t: any) => {
            const matchesSearch =
              !search ||
              (t.title || "").toLowerCase().includes(search.toLowerCase());
            const matchesAssignee =
              !assigneeFilter ||
              (assigneeFilter === "__unassigned__"
                ? !t.assigneeId
                : t.assigneeId === assigneeFilter);
            return matchesSearch && matchesAssignee;
          })}
          projectId={projectId}
          onTaskUpdate={handleTaskUpdate}
          onTaskClick={setSelectedTaskId}
          onCreateTask={handleCreateTaskInColumn}
        />
      ) : (
        <div className="bg-white rounded-lg shadow p-6 text-center">
          <p className="text-gray-600">No columns configured for this project.</p>
        </div>
      )}

      {selectedTaskId && (
        <TaskDetailPanel
          taskId={selectedTaskId}
          onClose={() => {
            setSelectedTaskId(null);
            fetchProject();
          }}
          onTaskUpdated={() => {
            console.log("Task updated, refreshing project");
            fetchProject();
          }}
          onOpenTask={(id) => setSelectedTaskId(id)}
        />
      )}
    </div>
  );
}
