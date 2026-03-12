import type { AgentState } from "@ade/types";

const ALLOWED_TRANSITIONS: Record<AgentState, AgentState[]> = {
  queued: ["planning", "cancelled"],
  planning: ["executing", "waiting_input", "blocked", "failed", "cancelled"],
  executing: [
    "waiting_approval",
    "waiting_input",
    "blocked",
    "retrying",
    "completed",
    "failed",
    "cancelled"
  ],
  waiting_approval: ["executing", "blocked", "cancelled", "failed"],
  waiting_input: ["executing", "blocked", "cancelled", "failed"],
  blocked: ["executing", "retrying", "cancelled", "failed"],
  retrying: ["executing", "failed", "cancelled"],
  completed: [],
  failed: [],
  cancelled: []
};

export class AgentStateMachine {
  canTransition(from: AgentState, to: AgentState): boolean {
    return ALLOWED_TRANSITIONS[from].includes(to);
  }

  assertTransition(from: AgentState, to: AgentState): void {
    if (!this.canTransition(from, to)) {
      throw new Error(`Invalid transition: ${from} -> ${to}`);
    }
  }
}
