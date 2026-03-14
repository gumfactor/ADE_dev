import { useMemo, useState } from "react";

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

type AlertSeverity = "critical" | "warning" | "info";

interface OperatorAlert {
  id: string;
  severity: AlertSeverity;
  message: string;
}

const ALERT_STYLE: Record<AlertSeverity, { border: string; background: string; text: string; badge: string }> = {
  critical: {
    border: "1px solid rgba(255, 118, 118, 0.65)",
    background: "rgba(82, 22, 22, 0.5)",
    text: "#ffd7d7",
    badge: "#ff9090"
  },
  warning: {
    border: "1px solid rgba(255, 185, 113, 0.6)",
    background: "rgba(80, 39, 14, 0.45)",
    text: "#ffd7b5",
    badge: "#ffca7a"
  },
  info: {
    border: "1px solid rgba(127, 205, 255, 0.55)",
    background: "rgba(14, 41, 70, 0.45)",
    text: "#d3eeff",
    badge: "#8fd8ff"
  }
};

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

  const alerts = useMemo<OperatorAlert[]>(() => {
    const next: OperatorAlert[] = [];

    if (metrics.reliability.pendingApprovals >= 5) {
      next.push({
        id: "approval_backlog_critical",
        severity: "critical",
        message: "Approval backlog is critical (>= 5 pending). Trigger delegate batch triage now."
      });
    } else if (metrics.reliability.pendingApprovals >= 3) {
      next.push({
        id: "approval_backlog_warning",
        severity: "warning",
        message: "Approval backlog is elevated (>= 3 pending). Consider batching or delegation."
      });
    }

    if (metrics.reliability.escalationEvents > 0) {
      next.push({
        id: "escalations_present",
        severity: "warning",
        message: "Escalations detected. Investigate failure-mode policy and retry budgets."
      });
    }

    if (metrics.workflowTotals.total > 0 && metrics.workflowTotals.completionRate < 0.4) {
      next.push({
        id: "low_completion_rate",
        severity: "warning",
        message: "Workflow completion rate is low (< 40%). Reduce concurrency or tune stage dependencies."
      });
    }

    if (metrics.efficiency.totalCostUsd > 5) {
      next.push({
        id: "cost_burn_info",
        severity: "info",
        message: "Cost burn exceeded $5.00. Review tool trust levels and optimize expensive stages."
      });
    }

    return next;
  }, [metrics]);

  const [acknowledgedAlerts, setAcknowledgedAlerts] = useState<Record<string, true>>({});
  const [mutedAlerts, setMutedAlerts] = useState<Record<string, true>>({});

  const visibleAlerts = alerts.filter((alert) => !mutedAlerts[alert.id]);
  const mutedCount = alerts.filter((alert) => mutedAlerts[alert.id]).length;

  const acknowledge = (alertId: string): void => {
    setAcknowledgedAlerts((previous) => ({ ...previous, [alertId]: true }));
  };

  const toggleMute = (alertId: string): void => {
    setMutedAlerts((previous) => {
      if (previous[alertId]) {
        const next = { ...previous };
        delete next[alertId];
        return next;
      }
      return { ...previous, [alertId]: true };
    });
  };

  return (
    <section style={{ display: "grid", gap: 10 }}>
      <h2 style={{ margin: 0, fontSize: 18, letterSpacing: 0.3 }}>Operator Metrics</h2>
      {visibleAlerts.length > 0 ? (
        <div style={{ display: "grid", gap: 8 }}>
          {visibleAlerts.map((alert) => {
            const style = ALERT_STYLE[alert.severity];
            return (
              <div
                key={alert.id}
                style={{
                  borderRadius: 12,
                  border: style.border,
                  background: style.background,
                  padding: 10,
                  display: "grid",
                  gap: 8
                }}
              >
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10 }}>
                  <span
                    style={{
                      fontSize: 11,
                      padding: "2px 8px",
                      borderRadius: 999,
                      background: "rgba(255,255,255,0.12)",
                      color: style.badge,
                      textTransform: "uppercase",
                      letterSpacing: 0.4,
                      fontWeight: 700
                    }}
                  >
                    {alert.severity}
                  </span>
                  <div style={{ display: "flex", gap: 8 }}>
                    <button
                      type="button"
                      onClick={() => {
                        acknowledge(alert.id);
                      }}
                      style={{
                        border: "1px solid rgba(255,255,255,0.28)",
                        borderRadius: 8,
                        background: acknowledgedAlerts[alert.id] ? "rgba(51, 104, 82, 0.55)" : "rgba(18, 38, 54, 0.45)",
                        color: "#e7f4ff",
                        padding: "4px 8px",
                        cursor: "pointer",
                        fontSize: 11
                      }}
                    >
                      {acknowledgedAlerts[alert.id] ? "Acknowledged" : "Acknowledge"}
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        toggleMute(alert.id);
                      }}
                      style={{
                        border: "1px solid rgba(255,255,255,0.28)",
                        borderRadius: 8,
                        background: "rgba(32, 22, 44, 0.5)",
                        color: "#f5dcff",
                        padding: "4px 8px",
                        cursor: "pointer",
                        fontSize: 11
                      }}
                    >
                      Mute
                    </button>
                  </div>
                </div>
                <p style={{ margin: 0, fontSize: 12, color: style.text }}>{alert.message}</p>
              </div>
            );
          })}
        </div>
      ) : null}
      {mutedCount > 0 ? (
        <p style={{ margin: 0, fontSize: 12, opacity: 0.78 }}>
          {mutedCount} alert{mutedCount > 1 ? "s" : ""} muted.
        </p>
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
