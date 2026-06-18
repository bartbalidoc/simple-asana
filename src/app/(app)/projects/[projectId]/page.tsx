"use client";

import { useState, useEffect, useCallback } from "react";
import { useParams } from "next/navigation";
import { KanbanBoard } from "@/components/board/KanbanBoard";
import { TaskDetailPanel } from "@/components/tasks/TaskDetailPanel";
import { SmartTaskDiscovery } from "@/components/tasks/SmartTaskDiscovery";

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

  const [project, setProject] = useState<Project | null>(null);
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);
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

  const fetchProject = useCallback(async () => {
    try {
      const response = await fetch(`/api/projects/${projectId}`);
      if (!response.ok) throw new Error("Failed to fetch project");
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
          <div className="animate-spin h-8 w-8 border-2 border-blue-600 border-t-transparent rounded-full mx-auto mb-2" />
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
            className="inline-block bg-blue-600 hover:bg-blue-700 text-white font-semibold py-2 px-4 rounded"
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

  return (
    <div>
      <div className="mb-6 flex justify-between items-center">
        <input
          value={project.name}
          onChange={(e) => setProject({ ...project, name: e.target.value })}
          onBlur={async (e) => {
            const newName = e.target.value.trim();
            if (!newName) return;
            await fetch(`/api/projects/${projectId}`, {
              method: "PATCH",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ name: newName }),
            });
          }}
          className="text-2xl font-bold text-gray-900 bg-transparent border-b-2 border-transparent hover:border-gray-200 focus:border-blue-600 focus:outline-none"
          aria-label="Project name"
        />
        <div className="flex gap-2">
          <button
            onClick={() => {
              setShowNewTaskForm(!showNewTaskForm);
              setShowGuidedForm(false);
            }}
            className={`px-4 py-2 rounded-lg text-sm transition ${
              showNewTaskForm
                ? "bg-blue-600 text-white hover:bg-blue-700"
                : "bg-gray-200 text-gray-700 hover:bg-gray-300"
            }`}
          >
            Quick Task
          </button>
          <button
            onClick={() => {
              setShowGuidedForm(!showGuidedForm);
              setShowNewTaskForm(false);
            }}
            className={`px-4 py-2 rounded-lg text-sm transition ${
              showGuidedForm
                ? "bg-purple-600 text-white hover:bg-purple-700"
                : "bg-gray-200 text-gray-700 hover:bg-gray-300"
            }`}
          >
            Smart Discovery
          </button>
          <button
            onClick={() => setShowMembers(!showMembers)}
            className={`px-4 py-2 rounded-lg text-sm transition ${
              showMembers
                ? "bg-green-600 text-white hover:bg-green-700"
                : "bg-gray-200 text-gray-700 hover:bg-gray-300"
            }`}
          >
            👥 Members ({project.members?.length || 0})
          </button>
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
              </div>
            ))}
          </div>

          {memberError && (
            <div className="mb-3 p-2 bg-red-50 border border-red-200 rounded text-red-700 text-xs">
              {memberError}
            </div>
          )}

          <form onSubmit={handleAddMember} className="flex gap-2">
            <input
              type="email"
              value={memberEmail}
              onChange={(e) => setMemberEmail(e.target.value)}
              placeholder="teammate@balidoc.com"
              className="flex-1 border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:border-blue-600"
            />
            <button
              type="submit"
              disabled={addingMember || !memberEmail.trim()}
              className="bg-green-600 hover:bg-green-700 disabled:bg-gray-400 text-white px-4 py-2 rounded text-sm"
            >
              {addingMember ? "Adding..." : "Add Member"}
            </button>
          </form>
          <p className="text-xs text-gray-500 mt-2">
            The person must already have an account (registered with their email).
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
              placeholder="Task name..."
              className="flex-1 border border-gray-300 rounded px-3 py-2 focus:outline-none focus:border-blue-600 text-sm"
              autoFocus
            />
            <button
              type="submit"
              className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700 text-sm"
            >
              Add
            </button>
            <button
              type="button"
              onClick={() => {
                setShowNewTaskForm(false);
                setFormError(null);
              }}
              className="bg-gray-300 text-gray-700 px-4 py-2 rounded hover:bg-gray-400 text-sm"
            >
              Cancel
            </button>
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

      {project.columns.length > 0 ? (
        <KanbanBoard
          columns={project.columns}
          tasks={project.tasks}
          projectId={projectId}
          onTaskUpdate={handleTaskUpdate}
          onTaskClick={setSelectedTaskId}
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
        />
      )}
    </div>
  );
}
