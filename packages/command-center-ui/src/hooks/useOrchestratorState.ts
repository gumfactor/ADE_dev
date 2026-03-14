import { useCallback, useEffect, useMemo, useState } from "react";
import type { Agent, AgentRelationship, ApprovalRequest, MessageEnvelope } from "@ade/types";
import { mockAgents, mockApprovals, mockChats, mockMetrics, mockRelationships } from "./mockState.js";

export interface OperatorMetrics {
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

export interface MetricsHistory {
  completionRate: number[];
  pendingApprovals: number[];
  retryEvents: number[];
  escalationEvents: number[];
  totalCostUsd: number[];
}

export interface CommandCenterState {
  agents: Agent[];
  relationships: AgentRelationship[];
  approvals: ApprovalRequest[];
  chats: Record<string, MessageEnvelope[]>;
  metrics: OperatorMetrics;
  metricsHistory: MetricsHistory;
  loading: boolean;
  error?: string;
  resolveApproval: (approvalId: string, resolution: "approved" | "rejected") => Promise<void>;
}

interface SnapshotPayload {
  agents: Agent[];
  relationships: AgentRelationship[];
  approvals: ApprovalRequest[];
  chats: Record<string, MessageEnvelope[]>;
}

interface SnapshotPacket {
  snapshot?: SnapshotPayload;
  metrics?: OperatorMetrics;
}

const DEFAULT_RUNTIME_BASE_URL = typeof window === "undefined" ? "http://127.0.0.1:8787" : "";
const HISTORY_WINDOW = 24;

function runtimeUrl(path: string): string {
  return `${DEFAULT_RUNTIME_BASE_URL}${path}`;
}

function runtimeWebSocketUrl(path: string): string {
  if (DEFAULT_RUNTIME_BASE_URL) {
    return `${DEFAULT_RUNTIME_BASE_URL.replace("http://", "ws://").replace("https://", "wss://")}${path}`;
  }
  const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
  return `${protocol}//${window.location.host}${path}`;
}

function appendPoint(series: number[], value: number): number[] {
  const next = [...series, value];
  return next.length > HISTORY_WINDOW ? next.slice(next.length - HISTORY_WINDOW) : next;
}

function evolveHistory(previous: MetricsHistory, metrics: OperatorMetrics): MetricsHistory {
  return {
    completionRate: appendPoint(previous.completionRate, metrics.workflowTotals.completionRate),
    pendingApprovals: appendPoint(previous.pendingApprovals, metrics.reliability.pendingApprovals),
    retryEvents: appendPoint(previous.retryEvents, metrics.reliability.retryEvents),
    escalationEvents: appendPoint(previous.escalationEvents, metrics.reliability.escalationEvents),
    totalCostUsd: appendPoint(previous.totalCostUsd, metrics.efficiency.totalCostUsd)
  };
}

export function useOrchestratorState(): CommandCenterState {
  const [snapshot, setSnapshot] = useState<SnapshotPayload>({
    agents: mockAgents,
    relationships: mockRelationships,
    approvals: mockApprovals,
    chats: mockChats
  });
  const [metrics, setMetrics] = useState<OperatorMetrics>(mockMetrics);
  const [metricsHistory, setMetricsHistory] = useState<MetricsHistory>({
    completionRate: [mockMetrics.workflowTotals.completionRate],
    pendingApprovals: [mockMetrics.reliability.pendingApprovals],
    retryEvents: [mockMetrics.reliability.retryEvents],
    escalationEvents: [mockMetrics.reliability.escalationEvents],
    totalCostUsd: [mockMetrics.efficiency.totalCostUsd]
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | undefined>(undefined);

  const resolveApproval = useCallback(async (approvalId: string, resolution: "approved" | "rejected") => {
    const response = await fetch(runtimeUrl(`/api/approvals/${approvalId}/resolve`), {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ resolution, signerId: "manager" })
    });

    if (!response.ok) {
      throw new Error(`Failed to resolve approval ${approvalId}`);
    }

    const fresh = await fetch(runtimeUrl("/api/snapshot"));
    if (!fresh.ok) {
      throw new Error("Failed to refresh snapshot after approval update");
    }
    const metricsResponse = await fetch(runtimeUrl("/api/metrics"));
    if (!metricsResponse.ok) {
      throw new Error("Failed to refresh metrics after approval update");
    }

    const payload = (await fresh.json()) as SnapshotPayload;
    const updatedMetrics = (await metricsResponse.json()) as OperatorMetrics;
    setSnapshot(payload);
    setMetrics(updatedMetrics);
    setMetricsHistory((previous) => evolveHistory(previous, updatedMetrics));
  }, []);

  useEffect(() => {
    let disposed = false;
    let socket: WebSocket | undefined;

    async function bootstrap(): Promise<void> {
      try {
        const response = await fetch(runtimeUrl("/api/snapshot"));
        const metricsResponse = await fetch(runtimeUrl("/api/metrics"));
        if (response.ok) {
          const payload = (await response.json()) as SnapshotPayload;
          const metricsPayload = metricsResponse.ok ? ((await metricsResponse.json()) as OperatorMetrics) : mockMetrics;
          if (!disposed) {
            setSnapshot(payload);
            setMetrics(metricsPayload);
            setMetricsHistory((previous) => evolveHistory(previous, metricsPayload));
            setError(undefined);
          }
        } else if (!disposed) {
          setError("Runtime service returned a non-OK response");
        }
      } catch {
        if (!disposed) {
          setError("Runtime service unavailable; using fallback data");
        }
      } finally {
        if (!disposed) {
          setLoading(false);
        }
      }

      try {
        socket = new WebSocket(runtimeWebSocketUrl("/ws"));
        socket.onmessage = (event) => {
          const packet = JSON.parse(event.data as string) as SnapshotPacket;
          if (!disposed && packet.snapshot) {
            setSnapshot(packet.snapshot);
            if (packet.metrics) {
              setMetrics(packet.metrics);
              setMetricsHistory((previous) => evolveHistory(previous, packet.metrics as OperatorMetrics));
            }
            setError(undefined);
          }
        };
      } catch {
        if (!disposed) {
          setError("Live stream unavailable; polling disabled");
        }
      }
    }

    void bootstrap();

    return () => {
      disposed = true;
      socket?.close();
    };
  }, []);

  return useMemo(
    () => ({
      agents: snapshot.agents,
      relationships: snapshot.relationships,
      approvals: snapshot.approvals,
      chats: snapshot.chats,
      metrics,
      metricsHistory,
      loading,
      error,
      resolveApproval
    }),
    [snapshot, metrics, metricsHistory, loading, error, resolveApproval]
  );
}
