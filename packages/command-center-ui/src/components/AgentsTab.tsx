import { useCallback, useRef, useState } from "react";
import type { Agent, AgentRelationship, MessageEnvelope } from "@ade/types";
import type { AgentDetail } from "../hooks/useOrchestratorState.js";

/* ── helpers ────────────────────────────────────────────────────────── */

const ROLE_ICON: Record<string, string> = {
  manager: "◆",
  worker: "◈",
  validator: "◇",
  reviewer: "○",
  planner: "▸"
};

const STATE_COLOR: Record<string, string> = {
  executing: "#3fb950",
  waiting_approval: "#d29922",
  waiting_input: "#b083f0",
  retrying: "#e3b341",
  blocked: "#f85149",
  completed: "#2cb67d",
  failed: "#f85149",
  cancelled: "#8b949e",
  planning: "#58a6ff",
  queued: "#8b949e"
};

function fmtDate(iso?: string): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" });
}

/* ── chat panel ─────────────────────────────────────────────────────── */

interface ChatMessage { id: string; from: string; text: string; sentAt: string; }

function ChatPanel({
  agentId, agentName,
  onSend
}: {
  agentId: string;
  agentName: string;
  onSend: (text: string) => Promise<MessageEnvelope | undefined>;
}): JSX.Element {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  const send = useCallback(async () => {
    const text = input.trim();
    if (!text || sending) return;
    setInput("");
    setSending(true);

    const userMsg: ChatMessage = { id: `u-${Date.now()}`, from: "You", text, sentAt: new Date().toISOString() };
    setMessages((prev) => [...prev, userMsg]);

    try {
      const reply = await onSend(text);
      if (reply) {
        const replyText = (reply.payload as { text?: string }).text ?? "(no text)";
        const agentMsg: ChatMessage = { id: reply.id, from: agentName, text: replyText, sentAt: reply.sentAt };
        setMessages((prev) => [...prev, agentMsg]);
      }
    } catch {
      setMessages((prev) => [...prev, {
        id: `err-${Date.now()}`, from: "system",
        text: "Failed to reach agent — runtime may be unavailable.",
        sentAt: new Date().toISOString()
      }]);
    } finally {
      setSending(false);
      setTimeout(() => { bottomRef.current?.scrollIntoView({ behavior: "smooth" }); }, 50);
    }
  }, [input, sending, onSend, agentName]);

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%", gap: 0 }}>
      <p style={{ margin: "0 0 8px", fontSize: 12, fontWeight: 600, color: "#8b949e",
                  textTransform: "uppercase", letterSpacing: 0.5 }}>
        Chat with {agentName}
      </p>

      {/* message list */}
      <div style={{ flex: 1, overflow: "auto", display: "flex", flexDirection: "column",
                    gap: 8, paddingBottom: 8 }}>
        {messages.length === 0 ? (
          <p style={{ fontSize: 13, color: "#6e7681", margin: "12px 0" }}>
            Send a message to guide this agent — ask for a status update, redirect its focus, or assign a specific task.
          </p>
        ) : (
          messages.map((m) => {
            const isUser = m.from === "You";
            const isSystem = m.from === "system";
            return (
              <div key={m.id} style={{
                alignSelf: isUser ? "flex-end" : "flex-start",
                maxWidth: "88%",
                background: isSystem ? "#2d1f00" : isUser ? "#1a3550" : "#21262d",
                border: `1px solid ${isSystem ? "#d29922" : isUser ? "#388bfd" : "#30363d"}`,
                borderRadius: 10,
                padding: "8px 12px"
              }}>
                <div style={{ fontSize: 11, color: "#8b949e", marginBottom: 3 }}>
                  {m.from} · {fmtDate(m.sentAt)}
                </div>
                <div style={{ fontSize: 13, color: isSystem ? "#f0c060" : "#e6edf3", lineHeight: 1.5 }}>
                  {m.text}
                </div>
              </div>
            );
          })
        )}
        <div ref={bottomRef} />
      </div>

      {/* input row */}
      <div style={{ display: "flex", gap: 8, marginTop: "auto", paddingTop: 8,
                    borderTop: "1px solid #21262d" }}>
        <input
          type="text"
          placeholder={`Message ${agentName}…`}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { void send(); } }}
          style={{ flex: 1, background: "#161b22", border: "1px solid #30363d", borderRadius: 8,
                   color: "#e6edf3", padding: "7px 10px", fontSize: 13, outline: "none" }}
          disabled={sending}
        />
        <button
          type="button"
          disabled={!input.trim() || sending}
          onClick={() => void send()}
          style={{ background: "#238636", border: "1px solid #2ea043", borderRadius: 8,
                   color: "#fff", padding: "7px 14px", fontSize: 13, fontWeight: 600,
                   cursor: !input.trim() || sending ? "not-allowed" : "pointer",
                   opacity: !input.trim() || sending ? 0.5 : 1 }}
        >
          {sending ? "…" : "Send"}
        </button>
      </div>
    </div>
  );
}

/* ── agent detail panel ─────────────────────────────────────────────── */

function AgentDetailPanel({
  agent, detail,
  onChat
}: {
  agent: Agent;
  detail: AgentDetail | null;
  onChat: (text: string) => Promise<MessageEnvelope | undefined>;
}): JSX.Element {
  const [activeView, setActiveView] = useState<"overview" | "chat">("overview");

  const tabs = [
    { id: "overview" as const, label: "Overview" },
    { id: "chat" as const, label: "Chat" }
  ];

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%", gap: 0 }}>
      {/* agent header */}
      <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 12, flexWrap: "wrap" }}>
        <span style={{ fontSize: 28, lineHeight: 1 }}>{ROLE_ICON[agent.role] ?? "◉"}</span>
        <div style={{ flex: 1 }}>
          <h2 style={{ margin: 0, fontSize: 17, fontWeight: 700 }}>{agent.name}</h2>
          <div style={{ display: "flex", gap: 8, marginTop: 2, alignItems: "center" }}>
            <span style={{ fontSize: 12, color: "#8b949e" }}>{agent.role}</span>
            <span style={{ width: 6, height: 6, borderRadius: "50%",
                           background: STATE_COLOR[agent.state] ?? "#8b949e", display: "inline-block" }} />
            <span style={{ fontSize: 12, color: STATE_COLOR[agent.state] ?? "#8b949e" }}>
              {agent.state}
            </span>
          </div>
        </div>
      </div>

      {/* sub-tabs */}
      <div style={{ display: "flex", gap: 2, marginBottom: 12 }}>
        {tabs.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => setActiveView(t.id)}
            style={{
              background: activeView === t.id ? "#21262d" : "transparent",
              border: `1px solid ${activeView === t.id ? "#388bfd" : "#30363d"}`,
              borderRadius: 6, color: activeView === t.id ? "#e6edf3" : "#8b949e",
              padding: "4px 12px", fontSize: 12, fontWeight: 600, cursor: "pointer"
            }}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* overview */}
      {activeView === "overview" && (
        <div style={{ flex: 1, overflow: "auto", display: "grid", gap: 14 }}>
          {/* mission */}
          <div style={{ background: "#21262d", border: "1px solid #30363d", borderRadius: 8, padding: 12 }}>
            <p style={{ margin: "0 0 6px", fontSize: 11, fontWeight: 600, color: "#8b949e",
                        textTransform: "uppercase", letterSpacing: 0.5 }}>Mission</p>
            <p style={{ margin: 0, fontSize: 13, color: "#e6edf3" }}>{agent.context.objective}</p>
            {agent.activeStep && (
              <p style={{ margin: "6px 0 0", fontSize: 12, color: "#8b949e" }}>
                Current step: <strong style={{ color: "#e6edf3" }}>{agent.activeStep}</strong>
              </p>
            )}
            {agent.statusNote && (
              <p style={{ margin: "4px 0 0", fontSize: 12, color: "#8b949e" }}>{agent.statusNote}</p>
            )}
          </div>

          {/* budget / telemetry */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 10 }}>
            {[
              { label: "Token budget", value: agent.budget.tokenBudget.toLocaleString() },
              { label: "Cost budget", value: `$${agent.budget.costBudgetUsd}` },
              { label: "Workspace", value: agent.context.workspaceId }
            ].map((stat) => (
              <div key={stat.label} style={{ background: "#21262d", border: "1px solid #30363d",
                                             borderRadius: 8, padding: 10, textAlign: "center" }}>
                <div style={{ fontSize: 14, fontWeight: 700, color: "#e6edf3" }}>{stat.value}</div>
                <div style={{ fontSize: 11, color: "#8b949e", marginTop: 2 }}>{stat.label}</div>
              </div>
            ))}
          </div>

          {/* active workflows */}
          {detail && detail.workflows.length > 0 && (
            <div>
              <p style={{ margin: "0 0 6px", fontSize: 11, fontWeight: 600, color: "#8b949e",
                          textTransform: "uppercase", letterSpacing: 0.5 }}>Active Workflows</p>
              {detail.workflows.map((wf) => (
                <div key={wf.id} style={{ background: "#21262d", border: "1px solid #30363d",
                                          borderRadius: 8, padding: "8px 12px", marginBottom: 6,
                                          display: "flex", justifyContent: "space-between", fontSize: 12 }}>
                  <span style={{ color: "#e6edf3", fontFamily: "monospace" }}>{wf.id.slice(0, 22)}…</span>
                  <span style={{ color: wf.status === "running" ? "#3fb950" : "#8b949e" }}>{wf.status}</span>
                </div>
              ))}
            </div>
          )}

          {/* peer agents */}
          {detail && detail.peerAgents.length > 0 && (
            <div>
              <p style={{ margin: "0 0 6px", fontSize: 11, fontWeight: 600, color: "#8b949e",
                          textTransform: "uppercase", letterSpacing: 0.5 }}>Peer Agents</p>
              <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                {detail.peerAgents.map((peer) => (
                  <span key={peer.id} style={{ background: "#21262d", border: "1px solid #30363d",
                                               borderRadius: 99, padding: "3px 10px", fontSize: 12, color: "#e6edf3" }}>
                    {ROLE_ICON[peer.role] ?? "◉"} {peer.name}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* pending approvals */}
          {detail && detail.approvals.filter((a) => a.status === "pending").length > 0 && (
            <div style={{ background: "rgba(218,54,51,0.08)", border: "1px solid rgba(218,54,51,0.4)",
                          borderRadius: 8, padding: "10px 12px" }}>
              <p style={{ margin: "0 0 6px", fontSize: 11, fontWeight: 700, color: "#ff7b72",
                          textTransform: "uppercase", letterSpacing: 0.5 }}>Pending Approvals</p>
              {detail.approvals.filter((a) => a.status === "pending").map((ap) => (
                <p key={ap.id} style={{ margin: "0 0 4px", fontSize: 12, color: "#e6edf3" }}>
                  {ap.action.toolName} — {ap.riskLevel} risk
                </p>
              ))}
            </div>
          )}

          {/* timestamps */}
          <div style={{ fontSize: 12, color: "#6e7681" }}>
            Created: {fmtDate(agent.createdAt)} · Started: {fmtDate(agent.startedAt)}
          </div>
        </div>
      )}

      {/* chat */}
      {activeView === "chat" && (
        <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden" }}>
          <ChatPanel agentId={agent.id} agentName={agent.name} onSend={onChat} />
        </div>
      )}
    </div>
  );
}

/* ── main export ─────────────────────────────────────────────────────── */

interface AgentsTabProps {
  agents: Agent[];
  relationships: AgentRelationship[];
  getAgentDetail: (agentId: string) => Promise<AgentDetail>;
  chatWithAgent: (agentId: string, text: string) => Promise<MessageEnvelope | undefined>;
}

export function AgentsTab({ agents, getAgentDetail, chatWithAgent }: AgentsTabProps): JSX.Element {
  const [selectedId, setSelectedId] = useState<string | null>(agents[0]?.id ?? null);
  const [detailCache, setDetailCache] = useState<Record<string, AgentDetail>>({});
  const [loadingDetail, setLoadingDetail] = useState(false);

  const selected = agents.find((a) => a.id === selectedId) ?? null;

  async function selectAgent(agentId: string): Promise<void> {
    setSelectedId(agentId);
    if (!detailCache[agentId]) {
      setLoadingDetail(true);
      try {
        const detail = await getAgentDetail(agentId);
        setDetailCache((prev) => ({ ...prev, [agentId]: detail }));
      } catch { /* detail is optional */ } finally {
        setLoadingDetail(false);
      }
    }
  }

  return (
    <div style={{ display: "grid", gridTemplateColumns: "220px 1fr", gap: 16, height: "100%" }}>
      {/* agent roster */}
      <div style={{ display: "flex", flexDirection: "column", gap: 4, overflow: "auto" }}>
        <p style={{ margin: "0 0 8px", fontSize: 11, fontWeight: 600, color: "#8b949e",
                    textTransform: "uppercase", letterSpacing: 0.8 }}>
          {agents.length} Agent{agents.length !== 1 ? "s" : ""}
        </p>
        {agents.map((agent) => {
          const isActive = agent.id === selectedId;
          return (
            <button
              key={agent.id}
              type="button"
              onClick={() => void selectAgent(agent.id)}
              style={{
                background: isActive ? "#21262d" : "transparent",
                border: `1px solid ${isActive ? "#388bfd" : "#30363d"}`,
                borderRadius: 8, padding: "10px 12px", cursor: "pointer",
                textAlign: "left", width: "100%", display: "flex", alignItems: "center", gap: 10
              }}
            >
              <span style={{ fontSize: 18, lineHeight: 1 }}>{ROLE_ICON[agent.role] ?? "◉"}</span>
              <div style={{ overflow: "hidden" }}>
                <div style={{ fontSize: 13, fontWeight: 600, color: "#e6edf3",
                              whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                  {agent.name}
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 4, marginTop: 2 }}>
                  <span style={{ width: 6, height: 6, borderRadius: "50%",
                                 background: STATE_COLOR[agent.state] ?? "#8b949e", flexShrink: 0 }} />
                  <span style={{ fontSize: 11, color: "#8b949e", whiteSpace: "nowrap",
                                 overflow: "hidden", textOverflow: "ellipsis" }}>
                    {agent.state}
                  </span>
                </div>
              </div>
            </button>
          );
        })}
      </div>

      {/* detail pane */}
      <div style={{ background: "#161b22", border: "1px solid #30363d", borderRadius: 10,
                    padding: 20, overflow: "hidden", display: "flex", flexDirection: "column" }}>
        {loadingDetail ? (
          <div style={{ display: "flex", alignItems: "center", justifyContent: "center",
                        height: "100%", color: "#8b949e", fontSize: 13 }}>
            Loading agent details…
          </div>
        ) : selected ? (
          <AgentDetailPanel
            agent={selected}
            detail={detailCache[selected.id] ?? null}
            onChat={(text) => chatWithAgent(selected.id, text)}
          />
        ) : (
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center",
                        justifyContent: "center", height: "100%", color: "#8b949e", gap: 8 }}>
            <span style={{ fontSize: 28 }}>◈</span>
            <p style={{ margin: 0, fontSize: 14 }}>Select an agent to inspect and communicate with it</p>
          </div>
        )}
      </div>
    </div>
  );
}
