import { ActivityConsole } from "../components/ActivityConsole.js";
import { ChatMultiplexer } from "../components/ChatMultiplexer.js";
import { CodeEditorPane } from "../components/CodeEditorPane.js";
import { InterventionRail } from "../components/InterventionRail.js";
import { MissionGrid } from "../components/MissionGrid.js";
import { OperatorMetricsPanel } from "../components/OperatorMetricsPanel.js";
import { RelationshipGraph } from "../components/RelationshipGraph.js";
import { RuntimeControlsPanel } from "../components/RuntimeControlsPanel.js";
import { WorkflowPipelineViz } from "../components/WorkflowPipelineViz.js";
import { WorkspaceExplorer } from "../components/WorkspaceExplorer.js";
import { useOrchestratorState } from "../hooks/useOrchestratorState.js";
import { useWorkspaceEditor } from "../hooks/useWorkspaceEditor.js";

export function CommandCenterLayout(): JSX.Element {
  const {
    agents,
    approvals,
    relationships,
    chats,
    workflows,
    workflowDefinitions,
    metrics,
    metricsHistory,
    loading,
    error,
    resolveApproval,
    tickAllWorkflows,
    setStageFailureMode,
    toggleToolEnabled
  } = useOrchestratorState();
  const workspace = useWorkspaceEditor();

  return (
    <main
      style={{
        minHeight: "100vh",
        color: "#f5f7ff",
        background:
          "radial-gradient(circle at 14% 20%, rgba(14,122,111,0.35), rgba(10,10,27,0) 45%), radial-gradient(circle at 86% 14%, rgba(241,114,59,0.35), rgba(10,10,27,0) 35%), linear-gradient(145deg, #090c1d 10%, #111738 60%, #0f2c35 100%)",
        padding: 18,
        fontFamily: "'Space Grotesk', 'Manrope', sans-serif"
      }}
    >
      <header style={{ marginBottom: 16 }}>
        <h1 style={{ margin: 0, fontSize: 30, letterSpacing: 0.4 }}>ADE Mission Control</h1>
        <p style={{ margin: "6px 0 0", fontSize: 13, opacity: 0.85 }}>
          Manager-worker authority on top of a flexible DAG, with additive approvals and balanced optimization.
        </p>
        <p style={{ margin: "6px 0 0", fontSize: 12, opacity: 0.8 }}>
          {loading ? "Syncing runtime snapshot..." : error ?? "Live runtime connected"}
        </p>
      </header>

      <section style={{ display: "grid", gridTemplateColumns: "1.1fr 2fr 1.6fr", gap: 14, marginBottom: 14 }}>
        <WorkspaceExplorer
          tree={workspace.tree}
          selectedPath={workspace.selectedPath}
          onSelect={(path) => {
            void workspace.selectFile(path);
          }}
        />
        <CodeEditorPane
          selectedPath={workspace.selectedPath}
          content={workspace.content}
          loading={workspace.loading}
          saving={workspace.saving}
          dirty={workspace.dirty}
          onChange={workspace.updateContent}
          onSave={() => {
            void workspace.saveFile();
          }}
        />
        <div style={{ display: "grid", gap: 14 }}>
          <MissionGrid agents={agents} />
          <InterventionRail
            approvals={approvals}
            onResolveApproval={(approvalId, resolution) => {
              void resolveApproval(approvalId, resolution);
            }}
          />
        </div>
      </section>

      <section style={{ marginBottom: 14 }}>
        <ActivityConsole activities={workspace.activities} />
      </section>

      <section style={{ marginBottom: 14 }}>
        <WorkflowPipelineViz workflows={workflows} workflowDefinitions={workflowDefinitions} />
      </section>

      <section style={{ marginBottom: 14 }}>
        <RuntimeControlsPanel
          workflows={workflows}
          onTickAll={tickAllWorkflows}
          onSetFailureMode={setStageFailureMode}
          onToggleTool={toggleToolEnabled}
        />
      </section>

      <section style={{ marginBottom: 14 }}>
        <OperatorMetricsPanel metrics={metrics} history={metricsHistory} />
      </section>

      <section style={{ display: "grid", gridTemplateColumns: "1.2fr 1.8fr", gap: 14 }}>
        <RelationshipGraph agents={agents} relationships={relationships} />
        <ChatMultiplexer chats={chats} />
      </section>
    </main>
  );
}
