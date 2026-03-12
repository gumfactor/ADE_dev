import type { Agent, AgentRelationship } from "@ade/types";

interface RelationshipGraphProps {
  agents: Agent[];
  relationships: AgentRelationship[];
}

function relationLabel(type: AgentRelationship["type"]): string {
  if (type === "manager_worker") {
    return "Manager -> Worker";
  }
  if (type === "peer_specialist") {
    return "Peer Route";
  }
  if (type === "delegated_authority") {
    return "Delegated Authority";
  }
  return "Reviewer Oversight";
}

export function RelationshipGraph({ agents, relationships }: RelationshipGraphProps): JSX.Element {
  const names = new Map(agents.map((a) => [a.id, a.name]));

  return (
    <section style={{ display: "grid", gap: 10 }}>
      <h2 style={{ margin: 0, fontSize: 18, letterSpacing: 0.3 }}>Relationship Graph</h2>
      <div
        style={{
          borderRadius: 14,
          padding: 14,
          border: "1px solid rgba(255,255,255,0.15)",
          background: "linear-gradient(160deg, rgba(27,30,72,0.5), rgba(0, 27, 42, 0.55))"
        }}
      >
        {relationships.map((rel) => (
          <div
            key={`${rel.sourceAgentId}-${rel.targetAgentId}-${rel.type}`}
            style={{
              display: "grid",
              gridTemplateColumns: "1fr auto 1fr",
              gap: 10,
              alignItems: "center",
              marginBottom: 10,
              fontSize: 13
            }}
          >
            <span>{names.get(rel.sourceAgentId) ?? rel.sourceAgentId}</span>
            <span style={{ fontWeight: 700, color: "#ffd166" }}>{relationLabel(rel.type)}</span>
            <span>{names.get(rel.targetAgentId) ?? rel.targetAgentId}</span>
          </div>
        ))}
      </div>
    </section>
  );
}
