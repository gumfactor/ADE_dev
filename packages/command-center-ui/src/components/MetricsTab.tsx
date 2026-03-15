import { useState } from "react";
import { OperatorMetricsPanel } from "./OperatorMetricsPanel.js";
import type { MetricDetail, MetricsHistory, OperatorMetrics } from "../hooks/useOrchestratorState.js";

/* ── sparkline ──────────────────────────────────────────────────────── */
function Sparkline({ points, color }: { points: number[]; color: string }): JSX.Element {
  const W = 200;
  const H = 40;
  if (points.length < 2) {
    return <svg width={W} height={H} />;
  }
  const min = Math.min(...points);
  const max = Math.max(...points);
  const range = Math.max(max - min, 0.0001);
  const step = W / (points.length - 1);
  const d = points
    .map((v, i) => {
      const x = (step * i).toFixed(1);
      const y = (H - 4 - ((v - min) / range) * (H - 8)).toFixed(1);
      return `${i === 0 ? "M" : "L"}${x} ${y}`;
    })
    .join(" ");
  return (
    <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`}>
      <path d={d} fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}

/* ── metric tile ────────────────────────────────────────────────────── */
interface Tile {
  id: string;
  label: string;
  value: string;
  sub?: string;
  sparkColor: string;
  points: number[];
}

function MetricTile({
  tile, selected, onClick
}: {
  tile: Tile;
  selected: boolean;
  onClick: () => void;
}): JSX.Element {
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        background: selected ? "#1a2a3a" : "#161b22",
        border: `1px solid ${selected ? "#388bfd" : "#30363d"}`,
        borderRadius: 10, padding: "12px 14px", textAlign: "left",
        cursor: "pointer", transition: "border-color 0.15s",
        display: "flex", flexDirection: "column", gap: 4
      }}
    >
      <div style={{ fontSize: 11, color: "#8b949e", fontWeight: 600,
                    textTransform: "uppercase", letterSpacing: 0.6 }}>
        {tile.label}
      </div>
      <div style={{ fontSize: 24, fontWeight: 700, color: "#e6edf3", lineHeight: 1 }}>
        {tile.value}
      </div>
      {tile.sub && <div style={{ fontSize: 11, color: "#6e7681" }}>{tile.sub}</div>}
      <Sparkline points={tile.points} color={tile.sparkColor} />
      {selected && <div style={{ fontSize: 11, color: "#388bfd", marginTop: 2 }}>▾ details below</div>}
    </button>
  );
}

/* ── drill-down panel ───────────────────────────────────────────────── */
function DrillDownPanel({
  detail
}: {
  detail: MetricDetail | null | "loading";
}): JSX.Element {
  if (detail === "loading") {
    return (
      <div style={{ padding: 20, color: "#8b949e", fontSize: 13 }}>Loading metric detail…</div>
    );
  }
  if (!detail) {
    return (
      <div style={{ padding: 20, color: "#8b949e", fontSize: 13 }}>No detail available.</div>
    );
  }
  return (
    <div style={{ display: "grid", gap: 14, padding: 20 }}>
      <div>
        <h3 style={{ margin: 0, fontSize: 15, fontWeight: 700 }}>{detail.title}</h3>
        <p style={{ margin: "6px 0 0", fontSize: 13, color: "#8b949e" }}>{detail.description}</p>
      </div>
      <div style={{ display: "flex", gap: 16, flexWrap: "wrap", fontSize: 12, color: "#8b949e" }}>
        <span>Current: <strong style={{ color: "#e6edf3" }}>{detail.value}{detail.unit ? ` ${detail.unit}` : ""}</strong></span>
        <span>Samples: <strong style={{ color: "#e6edf3" }}>{detail.eventCount}</strong></span>
      </div>
      {detail.samples.length > 1 && (
        <div>
          <p style={{ margin: "0 0 6px", fontSize: 11, color: "#8b949e", textTransform: "uppercase", letterSpacing: 0.5 }}>
            Trend ({detail.samples.length} points)
          </p>
          <Sparkline points={detail.samples} color="#58a6ff" />
        </div>
      )}
    </div>
  );
}

/* ── main export ─────────────────────────────────────────────────────── */

interface MetricsTabProps {
  metrics: OperatorMetrics;
  metricsHistory: MetricsHistory;
  getMetricDetail: (metricId: string) => Promise<MetricDetail>;
}

export function MetricsTab({ metrics, metricsHistory, getMetricDetail }: MetricsTabProps): JSX.Element {
  const [selectedMetricId, setSelectedMetricId] = useState<string | null>(null);
  const [detailState, setDetailState] = useState<MetricDetail | null | "loading">(null);

  const tiles: Tile[] = [
    {
      id: "completionRate",
      label: "Completion rate",
      value: `${metrics.workflowTotals.completionRate}%`,
      sub: `${metrics.workflowTotals.completed} / ${metrics.workflowTotals.total} workflows`,
      sparkColor: "#3fb950",
      points: metricsHistory.completionRate
    },
    {
      id: "running",
      label: "Running",
      value: String(metrics.workflowTotals.running),
      sub: `${metrics.workflowTotals.paused} paused`,
      sparkColor: "#58a6ff",
      points: metricsHistory.completionRate.map(() => metrics.workflowTotals.running)
    },
    {
      id: "pendingApprovals",
      label: "Pending approvals",
      value: String(metrics.reliability.pendingApprovals),
      sparkColor: "#d29922",
      points: metricsHistory.pendingApprovals
    },
    {
      id: "retryEvents",
      label: "Retry events",
      value: String(metrics.reliability.retryEvents),
      sub: `${metrics.reliability.escalationEvents} escalations`,
      sparkColor: "#f0883e",
      points: metricsHistory.retryEvents
    },
    {
      id: "escalationEvents",
      label: "Escalations",
      value: String(metrics.reliability.escalationEvents),
      sparkColor: "#f85149",
      points: metricsHistory.escalationEvents
    },
    {
      id: "totalCostUsd",
      label: "Total cost",
      value: `$${metrics.efficiency.totalCostUsd.toFixed(2)}`,
      sub: `${(metrics.efficiency.totalTokenCost / 1000).toFixed(1)}k tokens`,
      sparkColor: "#d2a8ff",
      points: metricsHistory.totalCostUsd
    },
    {
      id: "meanDuration",
      label: "Mean workflow duration",
      value: `${Math.round(metrics.efficiency.meanWorkflowDurationMs / 1000)}s`,
      sparkColor: "#79c0ff",
      points: metricsHistory.completionRate.map(() => metrics.efficiency.meanWorkflowDurationMs / 1000)
    }
  ];

  async function selectMetric(id: string): Promise<void> {
    if (selectedMetricId === id) {
      setSelectedMetricId(null);
      setDetailState(null);
      return;
    }
    setSelectedMetricId(id);
    setDetailState("loading");
    try {
      const detail = await getMetricDetail(id);
      setDetailState(detail);
    } catch {
      setDetailState(null);
    }
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      {/* tile grid */}
      <div>
        <p style={{ margin: "0 0 10px", fontSize: 11, fontWeight: 600, color: "#8b949e",
                    textTransform: "uppercase", letterSpacing: 0.6 }}>
          Click any metric for details
        </p>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(170px, 1fr))", gap: 12 }}>
          {tiles.map((tile) => (
            <MetricTile
              key={tile.id}
              tile={tile}
              selected={selectedMetricId === tile.id}
              onClick={() => void selectMetric(tile.id)}
            />
          ))}
        </div>
      </div>

      {/* drill-down */}
      {selectedMetricId && (
        <div style={{ background: "#161b22", border: "1px solid #388bfd", borderRadius: 10 }}>
          <DrillDownPanel detail={detailState} />
        </div>
      )}

      {/* alerts section */}
      <OperatorMetricsPanel metrics={metrics} history={metricsHistory} />
    </div>
  );
}
