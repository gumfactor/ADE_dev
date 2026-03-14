interface OperatorMetrics {
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

interface OperatorMetricsPanelProps {
  metrics: OperatorMetrics;
}

function metricCard(label: string, value: string, hint: string): JSX.Element {
  return (
    <article
      style={{
        borderRadius: 12,
        border: "1px solid rgba(255,255,255,0.12)",
        background: "rgba(10, 24, 42, 0.62)",
        padding: 12,
        minHeight: 95
      }}
    >
      <p style={{ margin: 0, fontSize: 12, opacity: 0.75 }}>{label}</p>
      <p style={{ margin: "6px 0 4px", fontSize: 24, fontWeight: 700 }}>{value}</p>
      <p style={{ margin: 0, fontSize: 11, opacity: 0.65 }}>{hint}</p>
    </article>
  );
}

export function OperatorMetricsPanel({ metrics }: OperatorMetricsPanelProps): JSX.Element {
  const completionPct = `${Math.round(metrics.workflowTotals.completionRate * 100)}%`;
  const meanDurationSeconds = `${Math.round(metrics.efficiency.meanWorkflowDurationMs / 1000)}s`;

  return (
    <section style={{ display: "grid", gap: 10 }}>
      <h2 style={{ margin: 0, fontSize: 18, letterSpacing: 0.3 }}>Operator Metrics</h2>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 10 }}>
        {metricCard("Workflow Completion", completionPct, `${metrics.workflowTotals.completed}/${metrics.workflowTotals.total} complete`)}
        {metricCard("Running Workflows", String(metrics.workflowTotals.running), `Paused ${metrics.workflowTotals.paused} | Failed ${metrics.workflowTotals.failed}`)}
        {metricCard("Retry Events", String(metrics.reliability.retryEvents), `Escalations ${metrics.reliability.escalationEvents}`)}
        {metricCard("Pending Approvals", String(metrics.reliability.pendingApprovals), `Resolved interventions ${metrics.reliability.approvalInterventions}`)}
        {metricCard("Token Spend", metrics.efficiency.totalTokenCost.toLocaleString(), "Accumulated tool token cost")}
        {metricCard("Cost (USD)", `$${metrics.efficiency.totalCostUsd.toFixed(4)}`, `Mean workflow duration ${meanDurationSeconds}`)}
      </div>
    </section>
  );
}
