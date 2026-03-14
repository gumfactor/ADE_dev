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

interface MetricsHistory {
  completionRate: number[];
  pendingApprovals: number[];
  retryEvents: number[];
  escalationEvents: number[];
  totalCostUsd: number[];
}

interface OperatorMetricsPanelProps {
  metrics: OperatorMetrics;
  history: MetricsHistory;
}

function renderSparkline(points: number[], color: string): JSX.Element {
  const width = 120;
  const height = 28;
  if (points.length === 0) {
    return <svg width={width} height={height} aria-hidden="true" />;
  }

  const min = Math.min(...points);
  const max = Math.max(...points);
  const range = Math.max(max - min, 0.0001);
  const step = points.length === 1 ? 0 : width / (points.length - 1);
  const path = points
    .map((value, index) => {
      const x = step * index;
      const normalized = (value - min) / range;
      const y = height - normalized * (height - 4) - 2;
      return `${index === 0 ? "M" : "L"}${x.toFixed(1)} ${y.toFixed(1)}`;
    })
    .join(" ");

  return (
    <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} aria-hidden="true">
      <path d={path} fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}

function metricCard(label: string, value: string, hint: string, sparkline: JSX.Element): JSX.Element {
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
      <div style={{ marginTop: 8, opacity: 0.9 }}>{sparkline}</div>
    </article>
  );
}

export function OperatorMetricsPanel({ metrics, history }: OperatorMetricsPanelProps): JSX.Element {
  const completionPct = `${Math.round(metrics.workflowTotals.completionRate * 100)}%`;
  const meanDurationSeconds = `${Math.round(metrics.efficiency.meanWorkflowDurationMs / 1000)}s`;

  const alerts: string[] = [];
  if (metrics.reliability.pendingApprovals >= 3) {
    alerts.push("Approval backlog is elevated (>= 3 pending). Consider batching or delegation.");
  }
  if (metrics.reliability.escalationEvents > 0) {
    alerts.push("Escalations detected. Investigate failure-mode policy and retry budgets.");
  }
  if (metrics.workflowTotals.total > 0 && metrics.workflowTotals.completionRate < 0.4) {
    alerts.push("Workflow completion rate is low (< 40%). Consider reducing concurrency or tuning stages.");
  }

  return (
    <section style={{ display: "grid", gap: 10 }}>
      <h2 style={{ margin: 0, fontSize: 18, letterSpacing: 0.3 }}>Operator Metrics</h2>
      {alerts.length > 0 ? (
        <div
          style={{
            borderRadius: 12,
            border: "1px solid rgba(255, 163, 102, 0.55)",
            background: "rgba(80, 39, 14, 0.45)",
            padding: 10
          }}
        >
          {alerts.map((alert) => (
            <p key={alert} style={{ margin: "0 0 4px", fontSize: 12, color: "#ffd7b5" }}>
              {alert}
            </p>
          ))}
        </div>
      ) : null}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 10 }}>
        {metricCard(
          "Workflow Completion",
          completionPct,
          `${metrics.workflowTotals.completed}/${metrics.workflowTotals.total} complete`,
          renderSparkline(history.completionRate, "#4ed491")
        )}
        {metricCard(
          "Running Workflows",
          String(metrics.workflowTotals.running),
          `Paused ${metrics.workflowTotals.paused} | Failed ${metrics.workflowTotals.failed}`,
          renderSparkline(history.completionRate.map((v) => (v > 0 ? 1 : 0)), "#66c2ff")
        )}
        {metricCard(
          "Retry Events",
          String(metrics.reliability.retryEvents),
          `Escalations ${metrics.reliability.escalationEvents}`,
          renderSparkline(history.retryEvents, "#ffcf70")
        )}
        {metricCard(
          "Pending Approvals",
          String(metrics.reliability.pendingApprovals),
          `Resolved interventions ${metrics.reliability.approvalInterventions}`,
          renderSparkline(history.pendingApprovals, "#f7b267")
        )}
        {metricCard(
          "Token Spend",
          metrics.efficiency.totalTokenCost.toLocaleString(),
          "Accumulated tool token cost",
          renderSparkline(history.retryEvents.map((v, i) => v + (history.escalationEvents[i] ?? 0)), "#cba6f7")
        )}
        {metricCard(
          "Cost (USD)",
          `$${metrics.efficiency.totalCostUsd.toFixed(4)}`,
          `Mean workflow duration ${meanDurationSeconds}`,
          renderSparkline(history.totalCostUsd, "#7ce2ff")
        )}
      </div>
    </section>
  );
}
