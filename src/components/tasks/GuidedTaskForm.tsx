"use client";

import { useState } from "react";

interface GuidedTaskFormProps {
  projectId: string;
  firstColumnId?: string;
  onTaskCreated?: () => void;
  onCancel?: () => void;
}

export function GuidedTaskForm({
  projectId,
  firstColumnId,
  onTaskCreated,
  onCancel,
}: GuidedTaskFormProps) {
  const [step, setStep] = useState(1);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [problem, setProblem] = useState("");
  const [currentWorkflow, setCurrentWorkflow] = useState("");
  const [desiredImprovement, setDesiredImprovement] = useState("");
  const [automationOpportunity, setAutomationOpportunity] = useState("");

  const [aiLoading, setAiLoading] = useState(false);
  const [aiError, setAiError] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleAiEnhance = async (field: string, text: string) => {
    if (!text.trim()) return;

    try {
      setAiLoading(true);
      setAiError(null);

      console.log(`Enhancing ${field}:`, text);

      const response = await fetch("/api/ai/enhance-description", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          fieldType: field,
          text,
        }),
      });

      console.log(`AI response status: ${response.status}`);

      if (!response.ok) {
        const errorText = await response.text();
        console.error(`AI error: ${errorText}`);
        throw new Error(`Failed to enhance description (${response.status})`);
      }

      const data = await response.json();
      console.log(`AI returned:`, data.enhanced);

      if (!data.enhanced || data.enhanced === text) {
        setAiError("Text is already polished!");
        setTimeout(() => setAiError(null), 2000);
        return;
      }

      switch (field) {
        case "problem":
          setProblem(data.enhanced);
          break;
        case "currentWorkflow":
          setCurrentWorkflow(data.enhanced);
          break;
        case "desiredImprovement":
          setDesiredImprovement(data.enhanced);
          break;
        case "automationOpportunity":
          setAutomationOpportunity(data.enhanced);
          break;
        case "title":
          setTitle(data.enhanced);
          break;
        case "description":
          setDescription(data.enhanced);
          break;
      }
    } catch (err) {
      console.error("AI enhancement error:", err);
      setAiError(err instanceof Error ? err.message : "AI enhancement failed");
    } finally {
      setAiLoading(false);
    }
  };

  const handleCreate = async () => {
    if (!title.trim()) {
      setError("Task title is required");
      return;
    }

    try {
      setCreating(true);
      setError(null);

      const response = await fetch("/api/tasks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          projectId,
          columnId: firstColumnId,
          title,
          description: description || undefined,
          problem: problem || undefined,
          currentWorkflow: currentWorkflow || undefined,
          desiredImprovement: desiredImprovement || undefined,
          automationOpportunity: automationOpportunity || undefined,
          template: "processImprovement",
        }),
      });

      if (!response.ok) throw new Error("Failed to create task");

      console.log("Task created successfully, calling onTaskCreated");
      setTitle("");
      setDescription("");
      setProblem("");
      setCurrentWorkflow("");
      setDesiredImprovement("");
      setAutomationOpportunity("");
      setStep(1);

      // Wait a moment then trigger refresh
      setTimeout(() => {
        console.log("Calling onTaskCreated callback");
        onTaskCreated?.();
      }, 500);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create task");
    } finally {
      setCreating(false);
    }
  };

  return (
    <div
      className="bg-white rounded-lg shadow p-6 mb-6"
      onClick={(e) => e.stopPropagation()}
    >
      <h3 className="text-lg font-semibold text-gray-900 mb-4">
        Create Task with Guided Discovery
      </h3>

      {error && (
        <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded text-red-700 text-sm">
          {error}
        </div>
      )}

      {aiError && (
        <div className="mb-4 p-3 bg-yellow-50 border border-yellow-200 rounded text-yellow-700 text-sm">
          {aiError}
        </div>
      )}

      {/* Step 1: Title */}
      {step >= 1 && (
        <div className="mb-6 pb-6 border-b">
          <label className="block text-sm font-semibold text-gray-900 mb-2">
            1. What is the task about? <span className="text-red-600">*</span>
          </label>
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="e.g., Streamline patient intake process"
            className="w-full border border-gray-300 rounded px-3 py-2 focus:outline-none focus:border-red-500 text-sm"
          />
          {title.trim() && (
            <button
              type="button"
              onClick={() => handleAiEnhance("title", title)}
              disabled={aiLoading}
              className="mt-2 text-blue-600 hover:text-blue-700 text-sm disabled:text-gray-400"
            >
              ✨ {aiLoading ? "Polishing..." : "Polish"}
            </button>
          )}
        </div>
      )}

      {/* Step 2: Description */}
      {step >= 2 && (
        <div className="mb-6 pb-6 border-b">
          <label className="block text-sm font-semibold text-gray-900 mb-2">
            2. Brief description <span className="text-gray-500">(optional)</span>
          </label>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Add any additional context or details..."
            className="w-full border border-gray-300 rounded px-3 py-2 focus:outline-none focus:border-red-500 text-sm"
            rows={2}
          />
          {description.trim() && (
            <button
              onClick={() => handleAiEnhance("description", description)}
              disabled={aiLoading}
              className="mt-2 text-blue-600 hover:text-blue-700 text-sm disabled:text-gray-400"
            >
              ✨ {aiLoading ? "Enhancing..." : "Polish"}
            </button>
          )}
        </div>
      )}

      {/* Step 3: Problem */}
      {step >= 3 && (
        <div className="mb-6 pb-6 border-b">
          <label className="block text-sm font-semibold text-gray-900 mb-2">
            3. What&apos;s the problem? <span className="text-gray-500">(optional)</span>
          </label>
          <textarea
            value={problem}
            onChange={(e) => setProblem(e.target.value)}
            placeholder="Describe the issue or pain point..."
            className="w-full border border-gray-300 rounded px-3 py-2 focus:outline-none focus:border-red-500 text-sm"
            rows={3}
          />
          {problem.trim() && (
            <button
              onClick={() => handleAiEnhance("problem", problem)}
              disabled={aiLoading}
              className="mt-2 text-blue-600 hover:text-blue-700 text-sm disabled:text-gray-400"
            >
              ✨ {aiLoading ? "Polishing..." : "Polish"}
            </button>
          )}
        </div>
      )}

      {/* Step 4: Current Workflow */}
      {step >= 4 && (
        <div className="mb-6 pb-6 border-b">
          <label className="block text-sm font-semibold text-gray-900 mb-2">
            4. How is it currently done? <span className="text-gray-500">(optional)</span>
          </label>
          <textarea
            value={currentWorkflow}
            onChange={(e) => setCurrentWorkflow(e.target.value)}
            placeholder="Describe the current process or workflow..."
            className="w-full border border-gray-300 rounded px-3 py-2 focus:outline-none focus:border-red-500 text-sm"
            rows={3}
          />
          {currentWorkflow.trim() && (
            <button
              onClick={() => handleAiEnhance("currentWorkflow", currentWorkflow)}
              disabled={aiLoading}
              className="mt-2 text-blue-600 hover:text-blue-700 text-sm disabled:text-gray-400"
            >
              ✨ {aiLoading ? "Polishing..." : "Polish"}
            </button>
          )}
        </div>
      )}

      {/* Step 5: Desired Improvement */}
      {step >= 5 && (
        <div className="mb-6 pb-6 border-b">
          <label className="block text-sm font-semibold text-gray-900 mb-2">
            5. What should change? <span className="text-gray-500">(optional)</span>
          </label>
          <textarea
            value={desiredImprovement}
            onChange={(e) => setDesiredImprovement(e.target.value)}
            placeholder="Describe the desired outcome or improvement..."
            className="w-full border border-gray-300 rounded px-3 py-2 focus:outline-none focus:border-red-500 text-sm"
            rows={3}
          />
          {desiredImprovement.trim() && (
            <button
              onClick={() => handleAiEnhance("desiredImprovement", desiredImprovement)}
              disabled={aiLoading}
              className="mt-2 text-blue-600 hover:text-blue-700 text-sm disabled:text-gray-400"
            >
              ✨ {aiLoading ? "Polishing..." : "Polish"}
            </button>
          )}
        </div>
      )}

      {/* Step 6: Automation Opportunity */}
      {step >= 6 && (
        <div className="mb-6 pb-6 border-b">
          <label className="block text-sm font-semibold text-gray-900 mb-2">
            6. How could we automate this? <span className="text-gray-500">(optional)</span>
          </label>
          <textarea
            value={automationOpportunity}
            onChange={(e) => setAutomationOpportunity(e.target.value)}
            placeholder="Describe potential automation opportunities or solutions..."
            className="w-full border border-gray-300 rounded px-3 py-2 focus:outline-none focus:border-red-500 text-sm"
            rows={3}
          />
          {automationOpportunity.trim() && (
            <button
              onClick={() => handleAiEnhance("automationOpportunity", automationOpportunity)}
              disabled={aiLoading}
              className="mt-2 text-blue-600 hover:text-blue-700 text-sm disabled:text-gray-400"
            >
              ✨ {aiLoading ? "Polishing..." : "Polish"}
            </button>
          )}
        </div>
      )}

      {/* Navigation */}
      <div className="flex gap-2 justify-between">
        <div className="flex gap-2">
          {step > 1 && (
            <button
              onClick={() => setStep(step - 1)}
              className="px-4 py-2 border border-gray-300 rounded text-gray-700 hover:bg-gray-50 text-sm"
            >
              ← Back
            </button>
          )}
        </div>

        <div className="flex gap-2">
          {step < 6 ? (
            <button
              onClick={() => setStep(step + 1)}
              disabled={step === 1 && !title.trim()}
              className="px-4 py-2 bg-red-600 hover:bg-red-700 disabled:bg-gray-400 text-white rounded text-sm"
            >
              Next →
            </button>
          ) : (
            <>
              <button
                onClick={handleCreate}
                disabled={creating || !title.trim()}
                className="px-4 py-2 bg-green-600 hover:bg-green-700 disabled:bg-gray-400 text-white rounded text-sm"
              >
                {creating ? "Creating..." : "Create Task"}
              </button>
            </>
          )}

          <button
            onClick={onCancel}
            className="px-4 py-2 border border-gray-300 rounded text-gray-700 hover:bg-gray-50 text-sm"
          >
            Cancel
          </button>
        </div>
      </div>

      <div className="mt-4 text-xs text-gray-500">
        Step {step} of 6 — Questions build a complete task that can become an automation project
      </div>
    </div>
  );
}
