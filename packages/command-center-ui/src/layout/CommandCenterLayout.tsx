import { ChatMultiplexer } from "../components/ChatMultiplexer.js";
import { InterventionRail } from "../components/InterventionRail.js";
import { MissionGrid } from "../components/MissionGrid.js";
import { RelationshipGraph } from "../components/RelationshipGraph.js";
import { useOrchestratorState } from "../hooks/useOrchestratorState.js";

export function CommandCenterLayout(): JSX.Element {
  const { agents, approvals, relationships, chats } = useOrchestratorState();

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
      </header>

      <section style={{ display: "grid", gridTemplateColumns: "2fr 1fr", gap: 14, marginBottom: 14 }}>
        <MissionGrid agents={agents} />
        <InterventionRail approvals={approvals} />
      </section>

      <section style={{ display: "grid", gridTemplateColumns: "1.2fr 1.8fr", gap: 14 }}>
        <RelationshipGraph agents={agents} relationships={relationships} />
        <ChatMultiplexer chats={chats} />
      </section>
    </main>
  );
}
