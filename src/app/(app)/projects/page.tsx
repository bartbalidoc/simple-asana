"use client";

import { useState, useEffect } from "react";
import { useSession } from "next-auth/react";
import Link from "next/link";
import { Button } from "@/components/ui/Button";
import { PlusIcon, TrashIcon } from "@/components/ui/icons";

interface Project {
  id: string;
  name: string;
  description: string | null;
  tasks: any[];
  members: any[];
}

export default function ProjectsPage() {
  const { data: session } = useSession();
  const isAdmin = (session?.user as any)?.role === "ADMIN";
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [newProject, setNewProject] = useState({ name: "", description: "" });
  const [error, setError] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);

  const fetchProjects = async () => {
    try {
      const response = await fetch("/api/projects");
      if (response.ok) {
        const data = await response.json();
        setProjects(data);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load projects");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchProjects();
  }, []);

  const handleCreateProject = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newProject.name.trim()) {
      setError("Project name is required");
      return;
    }

    setCreating(true);
    setError(null);

    try {
      const response = await fetch("/api/projects", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(newProject),
      });

      if (!response.ok) throw new Error("Failed to create project");

      setNewProject({ name: "", description: "" });
      setShowForm(false);
      await fetchProjects();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create project");
    } finally {
      setCreating(false);
    }
  };

  const handleDeleteProject = async (projectId: string, name?: string) => {
    if (
      !confirm(
        `Delete "${name || "this project"}" and all of its tasks? This cannot be undone.`
      )
    )
      return;

    try {
      const response = await fetch(`/api/projects/${projectId}`, {
        method: "DELETE",
      });

      if (!response.ok) throw new Error("Failed to delete project");

      await fetchProjects();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to delete project");
    }
  };

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-2xl font-bold text-gray-900">Projects</h2>
        {isAdmin && (
          <Button
            onClick={() => setShowForm(!showForm)}
            variant={showForm ? "subtle" : "primary"}
            leftIcon={showForm ? undefined : <PlusIcon size={16} />}
          >
            {showForm ? "Cancel" : "New Project"}
          </Button>
        )}
      </div>

      {showForm && (
        <form onSubmit={handleCreateProject} className="bg-white rounded-xl border border-gray-200 shadow-sm p-6 mb-6 space-y-5">
          <div>
            <label className="block text-sm font-medium text-gray-900 mb-1.5">
              Project Name
            </label>
            <input
              type="text"
              value={newProject.name}
              onChange={(e) => setNewProject({ ...newProject, name: e.target.value })}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:border-red-500"
              placeholder="e.g., Website Redesign"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-900 mb-1.5">
              Description (optional)
            </label>
            <textarea
              value={newProject.description}
              onChange={(e) => setNewProject({ ...newProject, description: e.target.value })}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:border-red-500"
              rows={3}
            />
          </div>

          {error && <p className="text-sm text-red-600">{error}</p>}

          <div className="pt-1">
            <Button type="submit" variant="primary" disabled={creating}>
              {creating ? "Creating…" : "Create Project"}
            </Button>
          </div>
        </form>
      )}

      {loading ? (
        <div className="text-center py-12">
          <div className="animate-spin h-8 w-8 border-2 border-red-500 border-t-transparent rounded-full mx-auto" />
        </div>
      ) : projects.length === 0 ? (
        <div className="bg-white rounded-lg shadow p-6 text-center">
          <p className="text-gray-600">No projects yet. Create one to get started.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {projects.map((project) => {
            const total = project.tasks?.length || 0;
            const todoCount = project.tasks?.filter((t) => t.status === "TODO").length || 0;
            const inProgressCount = project.tasks?.filter((t) => t.status === "IN_PROGRESS").length || 0;
            const doneCount = project.tasks?.filter((t) => t.status === "DONE").length || 0;
            const pct = total > 0 ? Math.round((doneCount / total) * 100) : 0;

            return (
              <Link key={project.id} href={`/projects/${project.id}`} className="group">
                <div className="h-full bg-white rounded-xl border border-gray-200 shadow-sm p-5 hover:shadow-md hover:border-red-200 transition cursor-pointer flex flex-col">
                  <div className="flex items-start justify-between gap-2 mb-3">
                    <h3 className="text-base font-semibold text-gray-900 line-clamp-2 break-words" title={project.name}>
                      {project.name}
                    </h3>
                    {isAdmin && (
                      <button
                        onClick={(e) => {
                          e.preventDefault();
                          handleDeleteProject(project.id, project.name);
                        }}
                        className="flex-shrink-0 inline-flex items-center gap-1 text-xs text-gray-400 hover:text-white hover:bg-red-600 border border-gray-200 hover:border-red-600 rounded-md px-2 py-1 transition"
                        title="Delete project"
                      >
                        <TrashIcon size={13} /> Delete
                      </button>
                    )}
                  </div>

                  {project.description && (
                    <p className="text-sm text-gray-500 mb-4 line-clamp-2">{project.description}</p>
                  )}

                  <div className="mt-auto space-y-3">
                    {/* Progress bar */}
                    <div>
                      <div className="flex items-center justify-between text-[11px] text-gray-400 mb-1">
                        <span>{pct}% done</span>
                        <span>{total} tasks</span>
                      </div>
                      <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
                        <div className="h-full bg-green-500 transition-all" style={{ width: `${pct}%` }} />
                      </div>
                    </div>

                    <div className="flex items-center gap-2 text-[11px]">
                      <span className="inline-flex items-center gap-1 text-gray-500">
                        <span className="h-1.5 w-1.5 rounded-full bg-gray-400" /> {todoCount}
                      </span>
                      <span className="inline-flex items-center gap-1 text-gray-500">
                        <span className="h-1.5 w-1.5 rounded-full bg-blue-500" /> {inProgressCount}
                      </span>
                      <span className="inline-flex items-center gap-1 text-gray-500">
                        <span className="h-1.5 w-1.5 rounded-full bg-green-500" /> {doneCount}
                      </span>
                      <span className="ml-auto text-gray-400">👥 {project.members?.length || 0}</span>
                    </div>
                  </div>
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
