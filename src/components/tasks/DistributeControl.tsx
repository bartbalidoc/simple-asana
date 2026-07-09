"use client";

import { useState } from "react";
import { SparklesIcon } from "@/components/ui/icons";

interface Dest {
  id: string;
  name: string;
}
interface Person {
  id: string;
  name: string;
  email?: string;
}

// Copy a staged task/subtask into a real project for someone. For subtasks the
// AI option turns a bare title into a full task (description + subtasks).
export function DistributeControl({
  taskId,
  destinations,
  people,
  defaultAi = false,
  buttonLabel = "Copy to project →",
  onDone,
}: {
  taskId: string;
  destinations: Dest[];
  people: Person[];
  defaultAi?: boolean;
  buttonLabel?: string;
  onDone?: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [destId, setDestId] = useState("");
  const [newName, setNewName] = useState("");
  const [assigneeId, setAssigneeId] = useState("");
  const [ai, setAi] = useState(defaultAi);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [done, setDone] = useState<string | null>(null);

  const submit = async () => {
    setMsg(null);
    if (destId === "__new__" ? !newName.trim() : !destId) {
      setMsg("Pick a destination project (or name a new one).");
      return;
    }
    setBusy(true);
    try {
      const res = await fetch(`/api/admin/tasks/${taskId}/distribute`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...(destId === "__new__"
            ? { newProjectName: newName.trim() }
            : { destProjectId: destId }),
          assigneeId: assigneeId || null,
          aiGenerate: ai,
        }),
      });
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        throw new Error(d.error || "Failed");
      }
      const data = await res.json();
      setOpen(false);
      setDone(
        `→ ${data.destProjectName}${data.aiGenerated ? " (AI-generated)" : ""}`
      );
      onDone?.();
    } catch (err) {
      setMsg(err instanceof Error ? err.message : "Failed");
    } finally {
      setBusy(false);
    }
  };

  if (!open) {
    return (
      <div className="flex items-center gap-2">
        {done && <span className="text-xs text-green-700">{done}</span>}
        <button
          onClick={() => {
            setOpen(true);
            setDone(null);
          }}
          className="text-xs bg-red-600 hover:bg-red-700 text-white rounded px-2 py-1 whitespace-nowrap transition"
        >
          {buttonLabel}
        </button>
      </div>
    );
  }

  return (
    <div className="flex flex-wrap items-center gap-1.5 bg-white border border-gray-200 rounded p-2 w-full">
      <select
        value={destId}
        onChange={(e) => setDestId(e.target.value)}
        className="text-xs border border-gray-300 rounded px-1.5 py-1 focus:outline-none focus:border-red-500"
      >
        <option value="">Destination project…</option>
        {destinations.map((d) => (
          <option key={d.id} value={d.id}>
            {d.name}
          </option>
        ))}
        <option value="__new__">➕ New project…</option>
      </select>
      {destId === "__new__" && (
        <input
          type="text"
          value={newName}
          onChange={(e) => setNewName(e.target.value)}
          placeholder="New project name"
          className="text-xs border border-gray-300 rounded px-1.5 py-1 focus:outline-none focus:border-red-500"
        />
      )}
      <select
        value={assigneeId}
        onChange={(e) => setAssigneeId(e.target.value)}
        className="text-xs border border-gray-300 rounded px-1.5 py-1 focus:outline-none focus:border-red-500"
      >
        <option value="">Unassigned</option>
        {people.map((p) => (
          <option key={p.id} value={p.id}>
            {p.name}
          </option>
        ))}
      </select>
      <label className="flex items-center gap-1 text-xs text-gray-600">
        <input
          type="checkbox"
          checked={ai}
          onChange={(e) => setAi(e.target.checked)}
        />
        <SparklesIcon size={12} className="text-red-500" /> AI-generate full task
      </label>
      <button
        onClick={submit}
        disabled={busy}
        className="text-xs bg-red-600 hover:bg-red-700 disabled:bg-gray-400 text-white rounded px-2 py-1"
      >
        {busy ? (ai ? "Generating…" : "Copying…") : "Create"}
      </button>
      <button
        onClick={() => setOpen(false)}
        className="text-xs text-gray-500 hover:text-gray-700 px-1"
      >
        Cancel
      </button>
      {msg && <span className="text-xs text-red-600">{msg}</span>}
    </div>
  );
}
