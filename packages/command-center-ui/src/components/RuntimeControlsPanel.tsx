import { useMemo, useState } from "react";
import type { WorkflowExecution } from "@ade/types";

interface RuntimeControlsPanelProps {
  workflows: WorkflowExecution[];
  onTickAll: () => Promise<void>;
  onSetFailureMode: (executionId: string, stageId: string, mode: "none" | "random" | "always_fail") => Promise<void>;
  onToggleTool: (toolId: string, enabled: boolean) => Promise<void>;
}

export function RuntimeControlsPanel({ workflows, onTickAll, onSetFailureMode, onToggleTool }: RuntimeControlsPanelProps): JSX.Element {
  const [busy, setBusy] = useState(false);

  const activeExecution = useMemo(() => workflows.find((workflow) => workflow.status === "running") ?? workflows[0], [workflows]);

  return (
    <section
      style={{
        borderRadius: 12,
        border: "1px solid rgba(255,255,255,0.12)",
        background: "rgba(11, 22, 40, 0.72)",
        padding: 10,
        display: "grid",
        gap: 10
      }}
    >
      <h3 style={{ margin: 0, fontSize: 14 }}>Runtime Controls</h3>
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
        <button
          type="button"
          disabled={busy}
          onClick={async () => {
            setBusy(true);
            try {
              await onTickAll();
            } finally {
              setBusy(false);
            }
          }}
          style={{
            border: "1px solid rgba(130, 188, 255, 0.7)",
            borderRadius: 8,
            background: "rgba(32, 64, 98, 0.6)",
            color: "#e7f1ff",
            padding: "4px 10px",
            fontSize: 12,
            cursor: "pointer",
            opacity: busy ? 0.6 : 1
          }}
        >
          Tick All Workflows
        </button>
        <button
          type="button"
          disabled={busy || !activeExecution}
          onClick={async () => {
            if (!activeExecution || !activeExecution.currentStageId) {
              return;
            }
            setBusy(true);
            try {
              await onSetFailureMode(activeExecution.id, activeExecution.currentStageId, "always_fail");
            } finally {
              setBusy(false);
            }
          }}
          style={{
            border: "1px solid rgba(255, 150, 138, 0.75)",
            borderRadius: 8,
            background: "rgba(94, 34, 34, 0.58)",
            color: "#ffe2df",
            padding: "4px 10px",
            fontSize: 12,
            cursor: "pointer",
            opacity: busy || !activeExecution ? 0.6 : 1
          }}
        >
          Fail Current Stage
        </button>
        <button
          type="button"
          disabled={busy || !activeExecution}
          onClick={async () => {
            if (!activeExecution || !activeExecution.currentStageId) {
              return;
            }
            setBusy(true);
            try {
              await onSetFailureMode(activeExecution.id, activeExecution.currentStageId, "none");
            } finally {
              setBusy(false);
            }
          }}
          style={{
            border: "1px solid rgba(123, 222, 171, 0.75)",
            borderRadius: 8,
            background: "rgba(28, 83, 58, 0.58)",
            color: "#dfffee",
            padding: "4px 10px",
            fontSize: 12,
            cursor: "pointer",
            opacity: busy || !activeExecution ? 0.6 : 1
          }}
        >
          Clear Failure Mode
        </button>
      </div>

      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
        <button
          type="button"
          disabled={busy}
          onClick={async () => {
            setBusy(true);
            try {
              await onToggleTool("filesystem.write", false);
            } finally {
              setBusy(false);
            }
          }}
          style={{
            border: "1px solid rgba(255, 185, 113, 0.7)",
            borderRadius: 8,
            background: "rgba(96, 65, 20, 0.6)",
            color: "#ffe5bf",
            padding: "4px 10px",
            fontSize: 12,
            cursor: "pointer",
            opacity: busy ? 0.6 : 1
          }}
        >
          Disable Filesystem Write
        </button>
        <button
          type="button"
          disabled={busy}
          onClick={async () => {
            setBusy(true);
            try {
              await onToggleTool("filesystem.write", true);
            } finally {
              setBusy(false);
            }
          }}
          style={{
            border: "1px solid rgba(117, 215, 167, 0.7)",
            borderRadius: 8,
            background: "rgba(24, 74, 54, 0.6)",
            color: "#dbffef",
            padding: "4px 10px",
            fontSize: 12,
            cursor: "pointer",
            opacity: busy ? 0.6 : 1
          }}
        >
          Enable Filesystem Write
        </button>
      </div>

      {activeExecution ? (
        <p style={{ margin: 0, fontSize: 12, opacity: 0.82 }}>
          Active execution: {activeExecution.id} | status {activeExecution.status}
          {activeExecution.currentStageId ? ` | stage ${activeExecution.currentStageId}` : ""}
        </p>
      ) : (
        <p style={{ margin: 0, fontSize: 12, opacity: 0.82 }}>No workflow executions available</p>
      )}
    </section>
  );
}
