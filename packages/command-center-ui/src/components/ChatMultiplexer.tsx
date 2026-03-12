import type { MessageEnvelope } from "@ade/types";

interface ChatMultiplexerProps {
  chats: Record<string, MessageEnvelope[]>;
}

export function ChatMultiplexer({ chats }: ChatMultiplexerProps): JSX.Element {
  return (
    <section style={{ display: "grid", gap: 10 }}>
      <h2 style={{ margin: 0, fontSize: 18, letterSpacing: 0.3 }}>Multi-Chat Surface</h2>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: 10 }}>
        {Object.entries(chats).map(([agentId, messages]) => (
          <article
            key={agentId}
            style={{
              borderRadius: 12,
              border: "1px solid rgba(255,255,255,0.12)",
              background: "rgba(4, 24, 30, 0.66)",
              padding: 12,
              minHeight: 140
            }}
          >
            <h3 style={{ margin: "0 0 8px", fontSize: 14 }}>{agentId}</h3>
            {messages.map((message) => (
              <p key={message.id} style={{ margin: "0 0 6px", fontSize: 12, opacity: 0.9 }}>
                <strong>{message.from}:</strong> {String((message.payload as { text?: string }).text ?? "payload")}
              </p>
            ))}
          </article>
        ))}
      </div>
    </section>
  );
}
