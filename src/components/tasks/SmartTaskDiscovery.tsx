"use client";

import { useState, useEffect } from "react";

interface SmartTaskDiscoveryProps {
  projectId: string;
  firstColumnId?: string;
  onTaskCreated?: () => void;
  onCancel?: () => void;
}

const DISCOVERY_QUESTIONS = [
  {
    id: 1,
    label: "What's the task name?",
    placeholder: "e.g., Automate weekly performance report",
    hint: "A short, clear title. This becomes the task's name.",
    required: true,
  },
  {
    id: 2,
    label: "What's the objective?",
    placeholder: "e.g., Save 2 hours every week and remove manual errors from the weekly report",
    hint: "What are we trying to achieve, and why does it matter?",
    required: true,
  },
  {
    id: 3,
    label: "Describe the problem or current situation",
    placeholder: "e.g., Right now the report is built by hand in Excel every Friday and often has copy-paste mistakes",
    hint: "What's happening today that this task addresses?",
    required: false,
  },
  {
    id: 4,
    label: "Who are the key stakeholders?",
    placeholder: "e.g., Project leads, finance team, engineering, design",
    hint: "Who needs to be consulted or involved in this task?",
    required: false,
  },
  {
    id: 5,
    label: "What are the acceptance criteria?",
    placeholder: "e.g., Report includes all metrics, sent every Friday 9am, team can customize data fields",
    hint: "What specific conditions must be met for this to be 'done'?",
    required: false,
  },
  {
    id: 6,
    label: "What could block or delay this?",
    placeholder: "e.g., Need API access to data sources, depends on design system completion",
    hint: "What dependencies, unknowns, or risks exist?",
    required: false,
  },
  {
    id: 7,
    label: "How complex is this task?",
    placeholder: "e.g., Small (1-2 days), Medium (1-2 weeks), Large (3+ weeks)",
    hint: "Rough estimate for planning and prioritization",
    required: false,
  },
  {
    id: 8,
    label: "Could any part of this be automated?",
    placeholder: "e.g., The weekly report is pulled and emailed by hand today — could be auto-generated from the CRM every Friday",
    hint: "What's done manually today, and what should it become? Leave blank if not applicable.",
    required: false,
  },
];

export function SmartTaskDiscovery({
  projectId,
  firstColumnId,
  onTaskCreated,
  onCancel,
}: SmartTaskDiscoveryProps) {
  const [step, setStep] = useState(1);
  const [answers, setAnswers] = useState<Record<number, string>>({});
  const [skipped, setSkipped] = useState<Set<number>>(new Set());
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const currentQuestion = DISCOVERY_QUESTIONS.find((q) => q.id === step);
  const isAnswered = answers[step]?.trim().length > 0;
  const canSkip = currentQuestion && !currentQuestion.required;
  const canProceed = isAnswered || canSkip;

  const handleNext = () => {
    if (!isAnswered && !canSkip) {
      setError(`Question ${step} is required. Please provide an answer.`);
      return;
    }
    setError(null);
    if (step < DISCOVERY_QUESTIONS.length) {
      setStep(step + 1);
    }
  };

  const handleSkip = () => {
    setError(null);
    setSkipped(new Set([...skipped, step]));
    if (step < DISCOVERY_QUESTIONS.length) {
      setStep(step + 1);
    }
  };

  const handleBack = () => {
    setError(null);
    if (step > 1) {
      setSkipped(new Set([...skipped].filter((s) => s !== step)));
      setStep(step - 1);
    }
  };

  const handleCreate = async () => {
    if (!answers[1]?.trim()) {
      setError("A task name (Question 1) is required to create a task");
      return;
    }
    if (!answers[2]?.trim()) {
      setError("An objective (Question 2) is required to create a task");
      return;
    }

    try {
      setLoading(true);
      setError(null);

      // Send all answers and skipped questions to Claude for analysis
      const aiResponse = await fetch("/api/ai/generate-task-with-subtasks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          answers,
          skipped: Array.from(skipped),
          questions: DISCOVERY_QUESTIONS,
        }),
      });

      if (!aiResponse.ok) {
        const err = await aiResponse.json();
        throw new Error(err.error || "Failed to generate task");
      }

      const { description, subtasks, automationOpportunity } =
        await aiResponse.json();

      // Use the user's explicit task name as the title (Q1), not an AI guess.
      const title = answers[1].trim();

      console.log("Generated task:", { title, description, subtasks });

      // Create the task. Fall back to the user's raw automation answer if the
      // AI didn't return a distilled one.
      const taskResponse = await fetch("/api/tasks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          projectId,
          columnId: firstColumnId,
          title,
          description,
          automationOpportunity: automationOpportunity || answers[8] || null,
          template: "general",
        }),
      });

      if (!taskResponse.ok) throw new Error("Failed to create task");
      const createdTask = await taskResponse.json();

      // Create subtasks
      if (subtasks && subtasks.length > 0) {
        for (const subtaskTitle of subtasks) {
          await fetch("/api/tasks", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              projectId,
              title: subtaskTitle,
              parentTaskId: createdTask.id,
              template: "general",
            }),
          });
        }
      }

      console.log("Task created with subtasks");
      onTaskCreated?.();
    } catch (err) {
      console.error("Task creation error:", err);
      setError(err instanceof Error ? err.message : "Failed to create task");
    } finally {
      setLoading(false);
    }
  };

  // Close the wizard on Escape from anywhere (document-level, not just when a
  // field inside is focused).
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        onCancel?.();
      }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onCancel]);

  return (
    <div
      className="bg-white rounded-lg shadow p-6 mb-6"
      onClick={(e) => e.stopPropagation()}
    >
      <h3 className="text-lg font-semibold text-gray-900 mb-2">
        Smart Task Discovery
      </h3>
      <p className="text-xs text-gray-500 mb-6">
        Answer the required question, then skip or answer optional ones. We&apos;ll create your task with professional subtasks.
      </p>

      {error && (
        <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded text-red-700 text-sm">
          {error}
        </div>
      )}

      {/* Progress */}
      <div className="mb-6">
        <div className="flex justify-between items-center mb-2">
          <span className="text-sm font-medium text-gray-900">
            Step {step} of {DISCOVERY_QUESTIONS.length}
          </span>
          <div className="w-32 h-2 bg-gray-200 rounded-full overflow-hidden">
            <div
              className="h-full bg-red-600 transition-all"
              style={{ width: `${(step / DISCOVERY_QUESTIONS.length) * 100}%` }}
            />
          </div>
        </div>
      </div>

      {/* Current Question */}
      {currentQuestion && (
        <div className="mb-6">
          <label className="block text-sm font-semibold text-gray-900 mb-2">
            {currentQuestion.label}
            <span
              className={`text-xs ml-2 font-normal ${
                currentQuestion.required
                  ? "text-red-600"
                  : "text-gray-500"
              }`}
            >
              {currentQuestion.required ? "(Required)" : "(Optional)"}
            </span>
          </label>
          <p className="text-xs text-gray-500 mb-3">{currentQuestion.hint}</p>
          <textarea
            value={answers[step] || ""}
            onChange={(e) =>
              setAnswers({ ...answers, [step]: e.target.value })
            }
            placeholder={currentQuestion.placeholder}
            className="w-full border border-gray-300 rounded p-3 text-sm focus:outline-none focus:border-red-500 min-h-24"
          />
        </div>
      )}

      {/* Context from previous answers */}
      {step > 1 && (
        <div className="mb-6 p-3 bg-gray-50 rounded border border-gray-200">
          <p className="text-xs font-semibold text-gray-900 mb-2">
            📝 You said earlier:
          </p>
          <div className="space-y-2">
            {Array.from({ length: step - 1 }).map((_, i) => {
              const q = DISCOVERY_QUESTIONS[i];
              const wasSkipped = skipped.has(q.id);
              return (
                <div key={i} className="text-xs text-gray-700">
                  <span className="font-medium text-gray-900">{q.label}</span>
                  {wasSkipped ? (
                    <p className="text-gray-400 italic mt-1">(Skipped)</p>
                  ) : (
                    <p className="text-gray-600 mt-1">{answers[q.id]}</p>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Navigation */}
      <div className="flex gap-2 justify-between">
        <div className="flex gap-2">
          {step > 1 && (
            <button
              onClick={handleBack}
              className="px-4 py-2 border border-gray-300 rounded text-gray-700 hover:bg-gray-50 text-sm"
            >
              ← Back
            </button>
          )}
        </div>

        <div className="flex gap-2">
          {step < DISCOVERY_QUESTIONS.length ? (
            <>
              <button
                onClick={handleNext}
                disabled={!isAnswered}
                className="px-4 py-2 bg-red-600 hover:bg-red-700 disabled:bg-gray-400 text-white rounded text-sm"
              >
                Next →
              </button>
              {canSkip && (
                <button
                  onClick={handleSkip}
                  className="px-4 py-2 border border-gray-300 rounded text-gray-700 hover:bg-gray-100 text-sm"
                >
                  Skip
                </button>
              )}
            </>
          ) : (
            <>
              <button
                onClick={handleCreate}
                disabled={loading || !answers[1]?.trim()}
                className="px-4 py-2 bg-green-600 hover:bg-green-700 disabled:bg-gray-400 text-white rounded text-sm"
              >
                {loading ? "Creating task & subtasks..." : "Create Task"}
              </button>
            </>
          )}

          <button
            type="button"
            onClick={() => {
              setAnswers({});
              setStep(1);
              setError(null);
              setSkipped(new Set());
              onCancel?.();
            }}
            className="px-4 py-2 border border-gray-300 rounded text-gray-700 hover:bg-gray-50 text-sm"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}
