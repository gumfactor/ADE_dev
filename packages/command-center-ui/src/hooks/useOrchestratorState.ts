import { useCallback, useEffect, useMemo, useState } from "react";
import type { Agent, AgentRelationship, ApprovalRequest, MessageEnvelope } from "@ade/types";
import { mockAgents, mockApprovals, mockChats, mockRelationships } from "./mockState.js";

export interface CommandCenterState {
  agents: Agent[];
  relationships: AgentRelationship[];
  approvals: ApprovalRequest[];
  chats: Record<string, MessageEnvelope[]>;
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

const DEFAULT_RUNTIME_BASE_URL = "http://127.0.0.1:8787";

export function useOrchestratorState(): CommandCenterState {
  const [snapshot, setSnapshot] = useState<SnapshotPayload>({
    agents: mockAgents,
    relationships: mockRelationships,
    approvals: mockApprovals,
    chats: mockChats
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | undefined>(undefined);

  const resolveApproval = useCallback(async (approvalId: string, resolution: "approved" | "rejected") => {
    const response = await fetch(`${DEFAULT_RUNTIME_BASE_URL}/api/approvals/${approvalId}/resolve`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ resolution, signerId: "manager" })
    });

    if (!response.ok) {
      throw new Error(`Failed to resolve approval ${approvalId}`);
    }

    const fresh = await fetch(`${DEFAULT_RUNTIME_BASE_URL}/api/snapshot`);
    if (!fresh.ok) {
      throw new Error("Failed to refresh snapshot after approval update");
    }

    const payload = (await fresh.json()) as SnapshotPayload;
    setSnapshot(payload);
  }, []);

  useEffect(() => {
    let disposed = false;
    let socket: WebSocket | undefined;

    async function bootstrap(): Promise<void> {
      try {
        const response = await fetch(`${DEFAULT_RUNTIME_BASE_URL}/api/snapshot`);
        if (response.ok) {
          const payload = (await response.json()) as SnapshotPayload;
          if (!disposed) {
            setSnapshot(payload);
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
        socket = new WebSocket(`${DEFAULT_RUNTIME_BASE_URL.replace("http", "ws")}/ws`);
        socket.onmessage = (event) => {
          const packet = JSON.parse(event.data as string) as { snapshot?: SnapshotPayload };
          if (!disposed && packet.snapshot) {
            setSnapshot(packet.snapshot);
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
      loading,
      error,
      resolveApproval
    }),
    [snapshot, loading, error, resolveApproval]
  );
}
