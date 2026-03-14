import { useState } from "react";
import { InterventionRail } from "../components/InterventionRail.js";
import { MissionGrid } from "../components/MissionGrid.js";
import { OperatorMetricsPanel } from "../components/OperatorMetricsPanel.js";
import { RelationshipGraph } from "../components/RelationshipGraph.js";
import { RuntimeControlsPanel } from "../components/RuntimeControlsPanel.js";
import { WorkflowPipelineViz } from "../components/WorkflowPipelineViz.js";
import { useOrchestratorState } from "../hooks/useOrchestratorState.js";
import type { OperatorMetrics, MetricsHistory } from "../hooks/useOrchestratorState.js";
import type { Agent, AgentRelationship, ApprovalRequest, WorkflowDefinition, WorkflowExecution } from "@ade/types";

type Tab = "dashboard" | "workflows" | "approvals" | "agents" | "metrics";

const AGENT_STATE_COLOR: Record<string, string> = {
  queued: "#6b7280",
  planning: "#5fa8ff",
  executing: "#3fb950",
  waiting_approval: "#f7b267",
  waiting_input: "#e38cff",
  blocked: "#f25f5c",
  retrying: "#ffd166",
  completed: "#2cb67d",
  failed: "#ef476f",
  cancelled: "#6b7280"
};

/* ── shared card shell ────────────────────────────────────────────── */
function Card({ children, style }: { children: React.ReactNode; style?: React.CSSProperties }): JSX.Element {
  return (
    <div
      style={{
        background: "#161b22",
        border: "1px solid #30363d",
        borderRadius: 10,
        padding: 16,
        ...style
      }}
    >
      {children}
    </div>
  );
}

/* ── stat tile ────────────────────────────────────────────────────── */
function StatTile({ label, value, sub, accent }: { label: string; value: string | number; sub?: string; accent?: string }): JSX.Element {
  return (
    <Card style={{ textAlign: "center" }}>
      <div style={{ fontSize: 28, fontWeight: 700, color: accent ?? "#e6edf3", lineHeight: 1.1 }}>{value}</div>
      <div style={{ fontSize: 12, color: "#8b949e", marginTop: 4 }}>{label}</div>
      {sub ? <div style={{ fontSize: 11, color: "#6e7681", marginTop: 2 }}>{sub}</div> : null}
    </Card>
  );
}

/* ── dashboard view ───────────────────────────────────────────────── */
function DashboardView({
  agents,
  metrics,
  workflows,
  workflowDefinitions,
  pendingApprovals,
  onApprove,
  onReject
}: {
  agents: Agent[];
  metrics: OperatorMetrics;
  workflows: WorkflowExecution[];
  workflowDefinitions: WorkflowDefinition[];
  pendingApprovals: ApprovalRequest[];
  onApprove: (id: string) => void;
  onReject: (id: string) => void;
}): JSX.Element {
  const running = workflows.filter((w) => w.status === "running");
  return (
    <div style={{ display: "grid", gap: 20 }}>
      {/* urgent approvals banner */}
      {pendingApprovals.length > 0 && (
        <div
          style={{
            background: "rgba(218, 54, 51, 0.12)",
            border: "1px solid rgba(218, 54, 51, 0.5)",
            borderRadius: 10,
            padding: "12px 16px"
          }}
        >
          <p style={{ margin: "0 0 10px", fontWeight: 700, color: "#ff7b72", fontSize: 14 }}>
            ⚡ {pendingApprovals.length} approval{pendingApprovals.length > 1 ? "s" : ""} need your attention
          </p>
          <div style={{ display: "grid", gap: 8 }}>
            {pendingApprovals.map((a) => (
              <div
                key={a.id}
                style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}
              >
                <span style={{ fontSize: 13, color: "#e6edf3", flex: 1 }}>
                  <strong>{a.action.toolName}</strong> — {a.riskLevel} risk
                  <span style={{ color: "#8b949e", marginLeft: 8 }}>
                    by agent {a.agentId}
                  </span>
                </span>
                <div style={{ display: "flex", gap: 6 }}>
                  <button
                    type="button"
                    onClick={() => onApprove(a.id)}
                    style={{ background: "#238636", border: "1px solid #2ea043", borderRadius: 6, color: "#fff", padding: "4px 12px", cursor: "pointer", fontSize: 12, fontWeight: 600 }}
                  >
                    Approve
                  </button>
                  <button
                    type="button"
                    onClick={() => onReject(a.id)}
                    style={{ background: "transparent", border: "1px solid #da3633", borderRadius: 6, color: "#ff7b72", padding: "4px 12px", cursor: "pointer", fontSize: 12, fontWeight: 600 }}
                  >
                    Reject
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* stat strip */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))", gap: 12 }}>
        <StatTile label="Agents" value={agents.length} sub={`${agents.filter((a) => a.state === "executing").length} executing`} />
        <StatTile label="Workflows running" value={running.length} accent={running.length > 0 ? "#3fb950" : undefined} />
        <StatTile label="Completion rate" value={`${metrics.workflowTotals.completionRate}%`} />
        <StatTile label="Pending approvals" value={pendingApprovals.length} accent={pendingApprovals.length > 0 ? "#f7b267" : undefined} />
        <StatTile label="Retry events" value={metrics.reliability.retryEvents} />
        <StatTile label="Cost" value={`$${metrics.efficiency.totalCostUsd.toFixed(2)}`} sub="total usd" />
      </div>

      {/* active pipeline */}
      {workflows.length > 0 && (
        <div>
          <p style={{ margin: "0 0 10px", fontSize: 13, fontWeight: 600, color: "#8b949e", textTransform: "uppercase", letterSpacing: 0.6 }}>
            Active workflow
          </p>
          <WorkflowPipelineViz workflows={workflows} workflowDefinitions={workflowDefinitions} />
        </div>
      )}

      {/* agent quick-status */}
      <div>
        <p style={{ margin: "0 0 10px", fontSize: 13, fontWeight: 600, color: "#8b949e", textTransform: "uppercase", letterSpacing: 0.6 }}>
          Agent status
        </p>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 10 }}>
          {agents.map((agent) => (
            <Card key={agent.id} style={{ display: "flex", alignItems: "flex-start", gap: 10, padding: 12 }}>
              <span
                style={{
                  marginTop: 4,
                  width: 9,
                  height: 9,
                  borderRadius: "50%",
                  background: AGENT_STATE_COLOR[agent.state] ?? "#6b7280",
                  flexShrink: 0
                }}
              />
              <div style={{ overflow: "hidden" }}>
                <div style={{ fontSize: 13, fontWeight: 600, color: "#e6edf3", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                  {agent.name}
                </div>
                <div style={{ fontSize: 11, color: "#8b949e", marginTop: 2 }}>{agent.state}</div>
                {agent.activeStep ? (
                  <div style={{ fontSize: 11, color: "#6e7681", marginTop: 2, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                    {agent.activeStep}
                  </div>
                ) : null}
              </div>
            </Card>
          ))}
        </div>
      </div>
    </div>
  );
}

/* ── root layout ──────────────────────────────────────────────────── */
export function CommandCenterLayout(): JSX.Element {
  const {
    agents,
    approvals,
    relationships,
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

  const [activeTab, setActiveTab] = useState<Tab>("dashboard");

  const pendingApprovals = approvals.filter((a) => a.status === "pending");
  const runningWorkflows = workflows.filter((w) => w.status === "running");

  const tabs: { id: Tab; label: string; badge?: number }[] = [
    { id: "dashboard", label: "Dashboard" },
    { id: "workflows", label: "Workflows", badge: runningWorkflows.length || undefined },
    { id: "approvals", label: "Approvals", badge: pendingApprovals.length || undefined },
    { id: "agents", label: "Agents" },
    { id: "metrics", label: "Metrics" }
  ];

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        height: "100vh",
        background: "#0d1117",
        color: "#e6edf3",
        fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', system-ui, sans-serif",
        overflow: "hidden"
      }}
    >
      {/* ── top bar ── */}
      <header
        style={{
          display: "flex",
          alignItems: "center",
          gap: 24,
          padding: "0 16px",
          height: 48,
          background: "#161b22",
          borderBottom: "1px solid #30363d",
          flexShrink: 0
        }}
      >
        <span style={{ fontWeight: 700, fontSize: 14, letterSpacing: 1.5, color: "#58a6ff" }}>◆ ADE</span>
        <nav style={{ display: "flex", gap: 2 }}>
          {tabs.map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveTab(tab.id)}
              style={{
                background: activeTab === tab.id ? "#21262d" : "transparent",
                border: activeTab === tab.id ? "1px solid #30363d" : "1px solid transparent",
                borderRadius: 6,
                color: activeTab === tab.id ? "#e6edf3" : "#8b949e",
                cursor: "pointer",
                padding: "5px 12px",
                fontSize: 13,
                fontWeight: activeTab === tab.id ? 600 : 400,
                display: "flex",
                alignItems: "center",
                gap: 6
              }}
            >
              {tab.label}
              {tab.badge != null && (
                <span
                  style={{
                    background: tab.id === "approvals" ? "#da3633" : "#388bfd",
                    borderRadius: 999,
                    fontSize: 10,
                    padding: "1px 5px",
                    fontWeight: 700,
                    color: "#fff",
                    lineHeight: 1.4
                  }}
                >
                  {tab.badge}
                </span>
              )}
            </button>
          ))}
        </nav>
        <div style={{ marginLeft: "auto", fontSize: 12, color: "#8b949e" }}>
          {loading ? (
            "Syncing…"
          ) : error ? (
            <span style={{ color: "#f85149" }}>⚠ {error}</span>
          ) : (
            <span style={{ color: "#3fb950" }}>● Live</span>
          )}
        </div>
      </header>

      {/* ── body ── */}
      <div style={{ display: "flex", flex: 1, overflow: "hidden" }}>
        {/* sidebar */}
        <aside
          style={{
            width: 196,
            background: "#161b22",
            borderRight: "1px solid #30363d",
            padding: "12px 0",
            overflowY: "auto",
            flexShrink: 0
          }}
        >
          <p
            style={{
              margin: "0 0 6px",
              padding: "0 12px",
              fontSize: 11,
              fontWeight: 600,
              textTransform: "uppercase",
              letterSpacing: 0.8,
              color: "#8b949e"
            }}
          >
            Agents
          </p>
          {agents.map((agent) => (
            <div
              key={agent.id}
              style={{ padding: "6px 12px", display: "flex", alignItems: "center", gap: 8 }}
            >
              <span
                style={{
                  width: 8,
                  height: 8,
                  borderRadius: "50%",
                  background: AGENT_STATE_COLOR[agent.state] ?? "#6b7280",
                  flexShrink: 0
                }}
              />
              <span
                title={agent.name}
                style={{ fontSize: 13, color: "#e6edf3", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}
              >
                {agent.name}
              </span>
            </div>
          ))}
        </aside>

        {/* content */}
        <main style={{ flex: 1, overflow: "auto", padding: 20 }}>
          {activeTab === "dashboard" && (
            <DashboardView
              agents={agents}
              metrics={metrics}
              workflows={workflows}
              workflowDefinitions={workflowDefinitions}
              pendingApprovals={pendingApprovals}
              onApprove={(id) => void resolveApproval(id, "approved")}
              onReject={(id) => void resolveApproval(id, "rejected")}
            />
          )}
          {activeTab === "workflows" && (
            <WorkflowPipelineViz workflows={workflows} workflowDefinitions={workflowDefinitions} />
          )}
          {activeTab === "approvals" && (
            <InterventionRail
              approvals={approvals}
              onResolveApproval={(id, res) => void resolveApproval(id, res)}
            />
          )}
          {activeTab === "agents" && (
            <div style={{ display: "grid", gap: 20 }}>
              <MissionGrid agents={agents} />
              <RelationshipGraph agents={agents} relationships={relationships} />
            </div>
          )}
          {activeTab === "metrics" && (
            <div style={{ display: "grid", gap: 16 }}>
              <OperatorMetricsPanel metrics={metrics} history={metricsHistory} />
              <RuntimeControlsPanel
                workflows={workflows}
                onTickAll={tickAllWorkflows}
                onSetFailureMode={setStageFailureMode}
                onToggleTool={toggleToolEnabled}
              />
            </div>
          )}
        </main>
      </div>

      {/* ── status bar ── */}
      <footer
        style={{
          height: 26,
          background: "#238636",
          borderTop: "1px solid #30363d",
          display: "flex",
          alignItems: "center",
          padding: "0 14px",
          gap: 14,
          fontSize: 11,
          color: "#fff",
          fontWeight: 500,
          flexShrink: 0
        }}
      >
        <span>◆ ADE</span>
        <span>{agents.length} agent{agents.length !== 1 ? "s" : ""}</span>
        <span>{runningWorkflows.length} running</span>
        {pendingApprovals.length > 0 && (
          <button
            type="button"
            onClick={() => setActiveTab("approvals")}
            style={{
              background: "#da3633",
              border: "none",
              borderRadius: 4,
              padding: "1px 8px",
              cursor: "pointer",
              color: "#fff",
              fontWeight: 700,
              fontSize: 11
            }}
          >
            ⚡ {pendingApprovals.length} approval{pendingApprovals.length > 1 ? "s" : ""} pending
          </button>
        )}
      </footer>
    </div>
  );
}
