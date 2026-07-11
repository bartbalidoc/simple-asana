"use client";

import { useEffect, useRef, useState } from "react";
import { SparklesIcon } from "@/components/ui/icons";

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


      const response = await fetch("/api/ai/enhance-description", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          fieldType: field,
          text,
        }),
      });


      if (!response.ok) {
        const errorText = await response.text();
        console.error(`AI error: ${errorText}`);
        throw new Error(`Failed to enhance description (${response.status})`);
      }

      const data = await response.json();

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

      setTitle("");
      setDescription("");
      setProblem("");
      setCurrentWorkflow("");
      setDesiredImprovement("");
      setAutomationOpportunity("");
      setStep(1);

      // Wait a moment then trigger refresh
      setTimeout(() => {
        onTaskCreated?.();
      }, 500);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create task");
    } finally {
      setCreating(false);
    }
  };

  // Bring each newly revealed question into view; with the sticky action bar
  // below, Next never has to be hunted for (Bart's feedback).
  const cardRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (step <= 1) return;
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    cardRef.current
      ?.querySelector(`[data-step="${step}"]`)
      ?.scrollIntoView({ behavior: reduce ? "auto" : "smooth", block: "nearest" });
  }, [step]);

  return (
    <div
      ref={cardRef}
      className="bg-white rounded-lg shadow p-6 mb-6"
      onClick={(e) => e.stopPropagation()}
    >
      <h3 className="text-lg font-semibold text-gray-900 mb-4">AI task creator</h3>

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
        <div data-step="1" className="mb-6 pb-6 border-b">
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
              className="mt-2 inline-flex items-center gap-1.5 text-sm text-red-600 hover:text-red-700 disabled:text-gray-400 transition"
            >
              <SparklesIcon size={14} /> {aiLoading ? "Polishing…" : "Polish"}
            </button>
          )}
        </div>
      )}

      {/* Step 2: Description */}
      {step >= 2 && (
        <div data-step="2" className="mb-6 pb-6 border-b">
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
              className="mt-2 inline-flex items-center gap-1.5 text-sm text-red-600 hover:text-red-700 disabled:text-gray-400 transition"
            >
              <SparklesIcon size={14} /> {aiLoading ? "Polishing…" : "Polish"}
            </button>
          )}
        </div>
      )}

      {/* Step 3: Problem */}
      {step >= 3 && (
        <div data-step="3" className="mb-6 pb-6 border-b">
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
              className="mt-2 inline-flex items-center gap-1.5 text-sm text-red-600 hover:text-red-700 disabled:text-gray-400 transition"
            >
              <SparklesIcon size={14} /> {aiLoading ? "Polishing…" : "Polish"}
            </button>
          )}
        </div>
      )}

      {/* Step 4: Current Workflow */}
      {step >= 4 && (
        <div data-step="4" className="mb-6 pb-6 border-b">
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
              className="mt-2 inline-flex items-center gap-1.5 text-sm text-red-600 hover:text-red-700 disabled:text-gray-400 transition"
            >
              <SparklesIcon size={14} /> {aiLoading ? "Polishing…" : "Polish"}
            </button>
          )}
        </div>
      )}

      {/* Step 5: Desired Improvement */}
      {step >= 5 && (
        <div data-step="5" className="mb-6 pb-6 border-b">
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
              className="mt-2 inline-flex items-center gap-1.5 text-sm text-red-600 hover:text-red-700 disabled:text-gray-400 transition"
            >
              <SparklesIcon size={14} /> {aiLoading ? "Polishing…" : "Polish"}
            </button>
          )}
        </div>
      )}

      {/* Step 6: Automation Opportunity */}
      {step >= 6 && (
        <div data-step="6" className="mb-6 pb-6 border-b">
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
              className="mt-2 inline-flex items-center gap-1.5 text-sm text-red-600 hover:text-red-700 disabled:text-gray-400 transition"
            >
              <SparklesIcon size={14} /> {aiLoading ? "Polishing…" : "Polish"}
            </button>
          )}
        </div>
      )}

      {/* Navigation — sticky so Next/Create never scrolls out of reach as
          answered questions stack up (Bart's feedback). */}
      <div className="sticky bottom-0 -mx-6 -mb-6 px-6 py-3 bg-white border-t border-gray-100 rounded-b-lg flex gap-2 justify-between items-center">
        <div className="flex items-center gap-3">
          {step > 1 && (
            <button
              onClick={() => setStep(step - 1)}
              className="px-4 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50 text-sm transition focus:outline-none focus-visible:ring-2 focus-visible:ring-red-400"
            >
              ← Back
            </button>
          )}
          <span className="text-xs text-gray-400 tabular-nums">Step {step} of 6</span>
        </div>

        <div className="flex gap-2">
          {step < 6 ? (
            <button
              onClick={() => setStep(step + 1)}
              disabled={step === 1 && !title.trim()}
              className="px-4 py-2 bg-red-600 hover:bg-red-700 disabled:bg-gray-400 text-white rounded-md text-sm transition focus:outline-none focus-visible:ring-2 focus-visible:ring-red-400 focus-visible:ring-offset-1"
            >
              Next →
            </button>
          ) : (
            <>
              <button
                onClick={handleCreate}
                disabled={creating || !title.trim()}
                className="px-4 py-2 bg-green-600 hover:bg-green-700 disabled:bg-gray-400 text-white rounded-md text-sm transition focus:outline-none focus-visible:ring-2 focus-visible:ring-green-500 focus-visible:ring-offset-1"
              >
                {creating ? "Creating…" : "Create task"}
              </button>
            </>
          )}

          <button
            onClick={onCancel}
            className="px-4 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50 text-sm transition focus:outline-none focus-visible:ring-2 focus-visible:ring-red-400"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}
