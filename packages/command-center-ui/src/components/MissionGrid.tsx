import type { Agent } from "@ade/types";

interface MissionGridProps {
  agents: Agent[];
}

const STATUS_COLORS: Record<string, string> = {
  queued: "#8b8f9b",
  planning: "#5fa8ff",
  executing: "#4ed491",
  waiting_approval: "#f7b267",
  waiting_input: "#e38cff",
  blocked: "#f25f5c",
  retrying: "#ffd166",
  completed: "#2cb67d",
  failed: "#ef476f",
  cancelled: "#6d6875"
};

export function MissionGrid({ agents }: MissionGridProps): JSX.Element {
  return (
    <section style={{ display: "grid", gap: 14 }}>
      <h2 style={{ margin: 0, fontSize: 18, letterSpacing: 0.3 }}>Mission Grid</h2>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))", gap: 12 }}>
        {agents.map((agent) => (
          <article
            key={agent.id}
            style={{
              border: "1px solid rgba(255,255,255,0.15)",
              borderRadius: 14,
              background: "rgba(6, 10, 28, 0.7)",
              padding: 14,
              boxShadow: "0 10px 25px rgba(0, 0, 0, 0.25)"
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <strong style={{ fontSize: 15 }}>{agent.name}</strong>
              <span
                style={{
                  fontSize: 12,
                  padding: "4px 8px",
                  borderRadius: 999,
                  background: STATUS_COLORS[agent.state],
                  color: "#08131f",
                  fontWeight: 700
                }}
              >
                {agent.state}
              </span>
            </div>
            <p style={{ margin: "8px 0", fontSize: 13, opacity: 0.9 }}>{agent.context.objective}</p>
            <p style={{ margin: "4px 0", fontSize: 12, opacity: 0.75 }}>Active: {agent.activeStep ?? "n/a"}</p>
            <p style={{ margin: "4px 0", fontSize: 12, opacity: 0.75 }}>Workspace: {agent.context.workspaceId}</p>
            <p style={{ margin: "4px 0", fontSize: 12, opacity: 0.75 }}>
              Budget ${agent.budget.costBudgetUsd.toFixed(2)} / {agent.budget.tokenBudget.toLocaleString()} tokens
            </p>
          </article>
        ))}
      </div>
    </section>
  );
}
