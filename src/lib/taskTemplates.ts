export interface TaskTemplate {
  id: string;
  name: string;
  description: string;
  fields: {
    title: boolean;
    description: boolean;
    priority: boolean;
    dueDate: boolean;
    assignee: boolean;
    goal?: boolean;
    expectedOutput?: boolean;
    qualityRequirements?: boolean;
    blockers?: boolean;
    problem?: boolean;
    currentWorkflow?: boolean;
    desiredImprovement?: boolean;
    automationOpportunity?: boolean;
  };
}

export const TASK_TEMPLATES: Record<string, TaskTemplate> = {
  general: {
    id: "general",
    name: "General Task",
    description: "Standard task with title, description, priority, and due date",
    fields: {
      title: true,
      description: true,
      priority: true,
      dueDate: true,
      assignee: true,
    },
  },

  automationBrief: {
    id: "automationBrief",
    name: "Automation Brief",
    description: "Structured brief for automation requests to the dev team",
    fields: {
      title: true,
      problem: true,
      currentWorkflow: true,
      desiredImprovement: true,
      blockers: true,
      dueDate: true,
      assignee: true,
    },
  },

  documentation: {
    id: "documentation",
    name: "Documentation",
    description: "Task for creating or improving documentation",
    fields: {
      title: true,
      description: true,
      goal: true,
      expectedOutput: true,
      qualityRequirements: true,
      dueDate: true,
      assignee: true,
    },
  },

  processImprovement: {
    id: "processImprovement",
    name: "Process Improvement",
    description: "Task for improving workflows and processes",
    fields: {
      title: true,
      problem: true,
      currentWorkflow: true,
      desiredImprovement: true,
      blockers: true,
      automationOpportunity: true,
      dueDate: true,
      assignee: true,
    },
  },

  projectCoordination: {
    id: "projectCoordination",
    name: "Project Coordination",
    description: "Task for coordinating team projects and follow-ups",
    fields: {
      title: true,
      goal: true,
      expectedOutput: true,
      blockers: true,
      qualityRequirements: true,
      dueDate: true,
      assignee: true,
      description: true,
    },
  },
};
