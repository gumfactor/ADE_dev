import type { WorkflowDefinition, WorkflowExecution } from "@ade/types";

interface WorkflowPipelineVizProps {
  workflows: WorkflowExecution[];
  workflowDefinitions: WorkflowDefinition[];
}

type StageStatus = "completed" | "running" | "retrying" | "escalated" | "pending";

interface StageNode {
  id: string;
  displayName: string;
  primitive: string;
  status: StageStatus;
  retryCount: number;
  dependsOn: string[];
}

const STATUS_COLORS: Record<StageStatus, { bg: string; border: string; text: string; label: string }> = {
  completed: { bg: "rgba(30, 96, 60, 0.6)", border: "rgba(100, 210, 150, 0.8)", text: "#b6ffda", label: "Done" },
  running:   { bg: "rgba(20, 70, 130, 0.6)", border: "rgba(90, 170, 255, 0.8)", text: "#c6e5ff", label: "Running" },
  retrying:  { bg: "rgba(110, 72, 10, 0.6)", border: "rgba(255, 185, 80, 0.8)", text: "#ffe0a0", label: "Retrying" },
  escalated: { bg: "rgba(120, 30, 30, 0.6)", border: "rgba(255, 110, 105, 0.8)", text: "#ffd4d2", label: "Escalated" },
  pending:   { bg: "rgba(30, 30, 50, 0.5)", border: "rgba(100, 100, 140, 0.5)", text: "#a0a0c0", label: "Pending" }
};

function buildStageNodes(definition: WorkflowDefinition, execution: WorkflowExecution): StageNode[] {
  const completedSet = new Set(execution.completedStageIds);
  return definition.stages.map((stage) => {
    let status: StageStatus = "pending";
    if (completedSet.has(stage.id)) {
      status = "completed";
    } else if (execution.escalationStageId === stage.id) {
      status = "escalated";
    } else if (execution.currentStageId === stage.id) {
      const retryCount = execution.retryCountByStage[stage.id] ?? 0;
      status = retryCount > 0 ? "retrying" : "running";
    }
    return {
      id: stage.id,
      displayName: stage.displayName,
      primitive: stage.primitive,
      status,
      retryCount: execution.retryCountByStage[stage.id] ?? 0,
      dependsOn: stage.dependsOnStageIds
    };
  });
}

export function WorkflowPipelineViz({ workflows, workflowDefinitions }: WorkflowPipelineVizProps): JSX.Element {
  // Find the most interesting (running first, then latest) execution
  const activeExecution =
    workflows.find((w) => w.status === "running") ??
    workflows.find((w) => w.status === "paused") ??
    workflows[workflows.length - 1];

  const definition = activeExecution
    ? workflowDefinitions.find((d) => d.id === activeExecution.workflowId)
    : undefined;

  const nodes = definition && activeExecution ? buildStageNodes(definition, activeExecution) : [];

  const progressPct =
    definition && activeExecution && definition.stages.length > 0
      ? Math.round((activeExecution.completedStageIds.length / definition.stages.length) * 100)
      : 0;

  return (
    <section
      style={{
        borderRadius: 12,
        border: "1px solid rgba(255,255,255,0.11)",
        background: "rgba(9, 16, 38, 0.72)",
        padding: "12px 16px",
        display: "grid",
        gap: 10
      }}
    >
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <h3 style={{ margin: 0, fontSize: 14 }}>
          Workflow Pipeline
          {definition ? ` — ${definition.name}` : ""}
        </h3>
        {activeExecution && (
          <span
            style={{
              fontSize: 11,
              opacity: 0.75,
              background: "rgba(255,255,255,0.07)",
              borderRadius: 6,
              padding: "2px 8px"
            }}
          >
            {activeExecution.status} · {progressPct}%
          </span>
        )}
      </div>

      {nodes.length === 0 ? (
        <p style={{ margin: 0, fontSize: 12, opacity: 0.55 }}>No active workflow execution.</p>
      ) : (
        <>
          {/* Progress bar */}
          <div
            style={{
              height: 3,
              borderRadius: 2,
              background: "rgba(255,255,255,0.1)",
              overflow: "hidden"
            }}
          >
            <div
              style={{
                height: "100%",
                width: `${progressPct}%`,
                background: "linear-gradient(90deg, #3bcf8a, #60c7ff)",
                transition: "width 0.4s ease"
              }}
            />
          </div>

          {/* Stage pipeline */}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 0,
              flexWrap: "wrap",
              rowGap: 6
            }}
          >
            {nodes.map((node, index) => {
              const colors = STATUS_COLORS[node.status];
              return (
                <div key={node.id} style={{ display: "flex", alignItems: "center" }}>
                  {/* Stage pill */}
                  <div
                    title={`Stage: ${node.id} (${node.primitive})${node.retryCount > 0 ? ` · ${node.retryCount} retries` : ""}`}
                    style={{
                      borderRadius: 8,
                      border: `1px solid ${colors.border}`,
                      background: colors.bg,
                      color: colors.text,
                      padding: "5px 11px",
                      fontSize: 12,
                      display: "flex",
                      flexDirection: "column",
                      alignItems: "center",
                      gap: 2,
                      minWidth: 72,
                      cursor: "default",
                      transition: "box-shadow 0.2s",
                      boxShadow: node.status === "running" || node.status === "retrying"
                        ? `0 0 8px ${colors.border}`
                        : "none"
                    }}
                  >
                    <span style={{ fontWeight: 600, fontSize: 11 }}>{node.displayName}</span>
                    <span style={{ fontSize: 10, opacity: 0.8 }}>{colors.label}</span>
                    {node.retryCount > 0 && (
                      <span style={{ fontSize: 9, opacity: 0.7 }}>↺ {node.retryCount}</span>
                    )}
                  </div>

                  {/* Arrow connector (not after last node) */}
                  {index < nodes.length - 1 && (
                    <div
                      style={{
                        width: 20,
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        color: "rgba(180,180,210,0.45)",
                        fontSize: 14,
                        flexShrink: 0
                      }}
                    >
                      →
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {/* Execution metadata */}
          <p style={{ margin: 0, fontSize: 11, opacity: 0.6 }}>
            Execution {activeExecution?.id}
            {activeExecution?.lastTransitionAt
              ? ` · last transition ${new Date(activeExecution.lastTransitionAt).toLocaleTimeString()}`
              : ""}
          </p>
        </>
      )}
    </section>
  );
}
