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
}
