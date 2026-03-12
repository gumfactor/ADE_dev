import type { WorkflowStage } from "@ade/types";

export class DependencyGraphScheduler {
  getReadyStageIds(stages: WorkflowStage[], completedStageIds: Set<string>): string[] {
    return stages
      .filter((stage) => !completedStageIds.has(stage.id))
      .filter((stage) => stage.dependsOnStageIds.every((dep) => completedStageIds.has(dep)))
      .map((stage) => stage.id);
  }
}
