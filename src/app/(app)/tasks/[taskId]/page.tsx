"use client";

import { useRouter, useParams } from "next/navigation";
import { TaskDetailPanel } from "@/components/tasks/TaskDetailPanel";

// Standalone task view — the landing spot for task GUESTS, who can open this
// one task but not its project board. Members get redirected here too if they
// follow a task link to a board they can't load.
export default function TaskPage() {
  const router = useRouter();
  const params = useParams();
  const taskId = params.taskId as string;

  return (
    <div className="max-w-2xl mx-auto">
      <div className="mb-4 p-3 rounded-lg bg-gray-50 border border-gray-200 text-sm text-gray-600">
        You&apos;re viewing a single task you were invited to — the rest of this
        project isn&apos;t visible to you.
      </div>
      <TaskDetailPanel
        taskId={taskId}
        onClose={() => router.push("/dashboard")}
        onOpenTask={(id) => router.push(`/tasks/${id}`)}
      />
    </div>
  );
}
