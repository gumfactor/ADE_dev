export type AggregateType = "agent" | "workflow" | "approval" | "message" | "command";

export type EventType =
  | "command.accepted"
  | "command.rejected"
  | "command.applied"
  | "agent.created"
  | "agent.state_changed"
  | "agent.message_sent"
  | "approval.requested"
  | "approval.resolved"
  | "tool.executed"
  | "handoff.initiated"
  | "handoff.resumed"
  | "workflow.stage_advanced";

export interface EventActor {
  id: string;
  type: "agent" | "human" | "system";
}

export interface EventMetadata {
  workspaceId: string;
  branch?: string;
  tokenCost?: number;
  costUsd?: number;
  wallClockMs?: number;
}

export interface DomainEvent<TPayload = unknown> {
  eventId: string;
  eventType: EventType;
  aggregateId: string;
  aggregateType: AggregateType;
  timestamp: string;
  version: number;
  correlationId?: string;
  causationId?: string;
  actor: EventActor;
  payload: TPayload;
  metadata: EventMetadata;
}

export interface EventStoreQuery {
  aggregateId?: string;
  aggregateType?: AggregateType;
  eventType?: EventType;
  workspaceId?: string;
  fromTimestamp?: string;
  toTimestamp?: string;
  limit?: number;
}
