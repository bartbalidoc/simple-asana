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
  const [showNewTaskForm, setShowNewTaskForm] = useState(false);
  const [showGuidedForm, setShowGuidedForm] = useState(false);

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
    if (!newTaskName.trim()) {
      setError("Task title is required");
      return;
    }

    if (newTaskName.length > 255) {
      setError("Task title must be less than 255 characters");
      return;
    }

    try {
      const firstColumn = project?.columns?.[0];

      if (!firstColumn) {
        setError("No columns in project. Please refresh the page.");
        return;
      }

      const response = await fetch("/api/tasks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          projectId,
          title: newTaskName,
          columnId: firstColumn.id,
        }),
      });

      if (!response.ok) throw new Error("Failed to create task");

      setNewTaskName("");
      setShowNewTaskForm(false);
      await fetchProject();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create task");
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
      setError(err instanceof Error ? err.message : "Failed to update task");
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
        <h2 className="text-2xl font-bold text-gray-900">{project.name}</h2>
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
        </div>
      </div>

      {showNewTaskForm && (
        <form onSubmit={handleCreateTask} className="mb-6 bg-white rounded-lg shadow p-4 flex gap-2">
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
            onClick={() => setShowNewTaskForm(false)}
            className="bg-gray-300 text-gray-700 px-4 py-2 rounded hover:bg-gray-400 text-sm"
          >
            Cancel
          </button>
        </form>
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
