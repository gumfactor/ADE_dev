import type {
  Agent,
  AgentRelationship,
  ApprovalRequest,
  DomainEvent,
  MessageEnvelope,
  WorkflowExecution
} from "@ade/types";

export interface RuntimeSnapshot {
  agents: Agent[];
  relationships: AgentRelationship[];
  workflows: WorkflowExecution[];
  approvals: ApprovalRequest[];
  chats: Record<string, MessageEnvelope[]>;
  events: DomainEvent[];
}

export interface RuntimeMetrics {
  workflowTotals: {
    running: number;
    paused: number;
    completed: number;
    failed: number;
    total: number;
    completionRate: number;
  };
  reliability: {
    retryEvents: number;
    escalationEvents: number;
    approvalInterventions: number;
    pendingApprovals: number;
  };
  efficiency: {
    totalTokenCost: number;
    totalCostUsd: number;
    meanWorkflowDurationMs: number;
  };
}

export class RuntimeProjectionStore {
  private agents: Agent[] = [];
  private relationships: AgentRelationship[] = [];
  private workflows: WorkflowExecution[] = [];
  private approvals: ApprovalRequest[] = [];
  private chats: Record<string, MessageEnvelope[]> = {};

  updateAgents(agents: Agent[]): void {
    this.agents = agents;
  }

  updateWorkflows(workflows: WorkflowExecution[]): void {
    this.workflows = workflows;
  }

  updateRelationships(relationships: AgentRelationship[]): void {
    this.relationships = relationships;
  }

  updateApprovals(approvals: ApprovalRequest[]): void {
    this.approvals = approvals;
  }

  appendChatMessage(message: MessageEnvelope): void {
    for (const target of message.to) {
      const existing = this.chats[target] ?? [];
      this.chats[target] = [...existing, message];
    }
  }

  snapshot(events: DomainEvent[]): RuntimeSnapshot {
    return {
      agents: this.agents,
      relationships: this.relationships,
      workflows: this.workflows,
      approvals: this.approvals,
      chats: this.chats,
      events
    };
  }

  metrics(events: DomainEvent[]): RuntimeMetrics {
    const workflowTotals = {
      running: this.workflows.filter((workflow) => workflow.status === "running").length,
      paused: this.workflows.filter((workflow) => workflow.status === "paused").length,
      completed: this.workflows.filter((workflow) => workflow.status === "completed").length,
      failed: this.workflows.filter((workflow) => workflow.status === "failed").length,
      total: this.workflows.length,
      completionRate: 0
    };

    workflowTotals.completionRate =
      workflowTotals.total === 0 ? 0 : Number((workflowTotals.completed / workflowTotals.total).toFixed(4));

    const retryEvents = events.filter(
      (event) =>
        event.eventType === "workflow.stage_advanced" &&
        typeof event.payload === "object" &&
        event.payload !== null &&
        "result" in event.payload &&
        event.payload.result === "retrying"
    ).length;

    const escalationEvents = events.filter(
      (event) =>
        event.eventType === "workflow.stage_advanced" &&
        typeof event.payload === "object" &&
        event.payload !== null &&
        "result" in event.payload &&
        event.payload.result === "escalated"
    ).length;

    const totalTokenCost = events.reduce((sum, event) => sum + (event.metadata.tokenCost ?? 0), 0);
    const totalCostUsd = events.reduce((sum, event) => sum + (event.metadata.costUsd ?? 0), 0);

    const completedDurations = this.workflows
      .filter((workflow) => workflow.startedAt && workflow.completedAt)
      .map((workflow) => {
        const startedAt = new Date(workflow.startedAt ?? 0).getTime();
        const completedAt = new Date(workflow.completedAt ?? 0).getTime();
        return completedAt - startedAt;
      })
      .filter((duration) => Number.isFinite(duration) && duration > 0);

    const meanWorkflowDurationMs =
      completedDurations.length === 0
        ? 0
        : Math.round(completedDurations.reduce((sum, duration) => sum + duration, 0) / completedDurations.length);

    return {
      workflowTotals,
      reliability: {
        retryEvents,
        escalationEvents,
        approvalInterventions: this.approvals.filter((approval) => approval.status !== "pending").length,
        pendingApprovals: this.approvals.filter((approval) => approval.status === "pending").length
      },
      efficiency: {
        totalTokenCost,
        totalCostUsd: Number(totalCostUsd.toFixed(4)),
        meanWorkflowDurationMs
      }
    };
  }
}
