import type { StageFailureMode, WorkflowDefinition, WorkflowExecution } from "./workflow.js";

export type WorkflowCommandType =
  | "workflow.start"
  | "workflow.pause"
  | "workflow.resume"
  | "workflow.cancel"
  | "workflow.tick"
  | "workflow.set_failure_mode"
  | "workflow.update_assignment";

export interface WorkflowStartCommand {
  commandId: string;
  type: "workflow.start";
  actorId: string;
  issuedAt: string;
  payload: {
    workflowId?: string;
  };
}

export interface WorkflowPauseCommand {
  commandId: string;
  type: "workflow.pause";
  actorId: string;
  issuedAt: string;
  payload: {
    executionId: string;
  };
}

export interface WorkflowResumeCommand {
  commandId: string;
  type: "workflow.resume";
  actorId: string;
  issuedAt: string;
  payload: {
    executionId: string;
  };
}

export interface WorkflowCancelCommand {
  commandId: string;
  type: "workflow.cancel";
  actorId: string;
  issuedAt: string;
  payload: {
    executionId: string;
  };
}

export interface WorkflowTickCommand {
  commandId: string;
  type: "workflow.tick";
  actorId: string;
  issuedAt: string;
  payload: {
    executionId: string;
    forceFailCurrentStage?: boolean;
  };
}

export interface WorkflowSetFailureModeCommand {
  commandId: string;
  type: "workflow.set_failure_mode";
  actorId: string;
  issuedAt: string;
  payload: {
    executionId: string;
    stageId: string;
    mode: StageFailureMode;
  };
}

export interface WorkflowUpdateAssignmentCommand {
  commandId: string;
  type: "workflow.update_assignment";
  actorId: string;
  issuedAt: string;
  payload: {
    executionId: string;
    stageId: string;
    agentId: string;
  };
}

export type WorkflowCommand =
  | WorkflowStartCommand
  | WorkflowPauseCommand
  | WorkflowResumeCommand
  | WorkflowCancelCommand
  | WorkflowTickCommand
  | WorkflowSetFailureModeCommand
  | WorkflowUpdateAssignmentCommand;

export interface CommandAccepted {
  commandId: string;
  commandType: WorkflowCommandType;
  actorId: string;
  acceptedAt: string;
}

export interface CommandRejected {
  commandId: string;
  commandType: WorkflowCommandType;
  actorId: string;
  rejectedAt: string;
  reason: string;
}

export interface CommandApplied {
  commandId: string;
  commandType: WorkflowCommandType;
  actorId: string;
  appliedAt: string;
  execution?: WorkflowExecution;
  definition?: WorkflowDefinition;
}
