import { useState } from "react";
import type { Agent, WorkflowDefinition, WorkflowExecution } from "@ade/types";

/* ── helpers ────────────────────────────────────────────────────────── */

const STATUS_CHIP: Record<string, { bg: string; color: string }> = {
  running:   { bg: "#1a4a2e", color: "#3fb950" },
  paused:    { bg: "#3a3000", color: "#d29922" },
  completed: { bg: "#0e3b2b", color: "#2cb67d" },
  failed:    { bg: "#3a1111", color: "#f85149" },
  cancelled: { bg: "#21262d", color: "#8b949e" }
};

const STAGE_STATUS_COLORS: Record<string, { bg: string; border: string; text: string; glow?: string }> = {
  completed: { bg: "#1a3a26", border: "#3fb950", text: "#7ee2a8" },
  running:   { bg: "#0d2a4a", border: "#58a6ff", text: "#b8d7ff", glow: "#58a6ff" },
  retrying:  { bg: "#3a2200", border: "#d29922", text: "#f0c060" },
  escalated: { bg: "#3a1010", border: "#f85149", text: "#ffb0ae" },
  pending:   { bg: "#161b22", border: "#30363d", text: "#8b949e" }
};

type StageMeta = { id: string; displayName: string; primitive: string; status: string; retryCount: number };

function buildStages(def: WorkflowDefinition, exec: WorkflowExecution): StageMeta[] {
  const done = new Set(exec.completedStageIds);
  return def.stages.map((s) => {
    let status = "pending";
    if (done.has(s.id)) status = "completed";
    else if (exec.escalationStageId === s.id) status = "escalated";
    else if (exec.currentStageId === s.id)
      status = (exec.retryCountByStage[s.id] ?? 0) > 0 ? "retrying" : "running";
    return { id: s.id, displayName: s.displayName, primitive: s.primitive,
             status, retryCount: exec.retryCountByStage[s.id] ?? 0 };
  });
}

function pct(exec: WorkflowExecution, def: WorkflowDefinition): number {
  if (!def.stages.length) return 0;
  return Math.round((exec.completedStageIds.length / def.stages.length) * 100);
}

function fmtDate(iso?: string): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" });
}

/* ── sub-components ─────────────────────────────────────────────────── */

function Chip({ label, status }: { label: string; status: string }): JSX.Element {
  const s = STATUS_CHIP[status] ?? { bg: "#21262d", color: "#8b949e" };
  return (
    <span style={{ background: s.bg, color: s.color, borderRadius: 99, padding: "2px 8px", fontSize: 11, fontWeight: 700 }}>
      {label}
    </span>
  );
}

function Btn({
  label, variant = "default", disabled, busy, onClick
}: {
  label: string;
  variant?: "primary" | "danger" | "default" | "ghost";
  disabled?: boolean;
  busy?: boolean;
  onClick: () => void;
}): JSX.Element {
  const styles: Record<string, React.CSSProperties> = {
    primary: { background: "#238636", border: "1px solid #2ea043", color: "#fff" },
    danger:  { background: "transparent", border: "1px solid #da3633", color: "#ff7b72" },
    default: { background: "#21262d", border: "1px solid #30363d", color: "#e6edf3" },
    ghost:   { background: "transparent", border: "1px solid #30363d", color: "#8b949e" }
  };
  return (
    <button
      type="button"
      disabled={disabled || busy}
      onClick={onClick}
      style={{ ...styles[variant], borderRadius: 6, padding: "5px 12px", fontSize: 12,
               fontWeight: 600, cursor: disabled || busy ? "not-allowed" : "pointer",
               opacity: disabled || busy ? 0.5 : 1, transition: "opacity 0.15s" }}
    >
      {busy ? "…" : label}
    </button>
  );
}

/* ── workflow detail pane ────────────────────────────────────────────── */

function WorkflowDetail({
  execution, definition, agents,
  onPause, onResume, onCancel, onTick, onSetFailureMode, onUpdateAssignment
}: {
  execution: WorkflowExecution;
  definition?: WorkflowDefinition;
  agents: Agent[];
  onPause: () => Promise<void>;
  onResume: () => Promise<void>;
  onCancel: () => Promise<void>;
  onTick: () => Promise<void>;
  onSetFailureMode: (stageId: string, mode: "none" | "random" | "always_fail") => Promise<void>;
  onUpdateAssignment: (stageId: string, agentId: string) => Promise<void>;
}): JSX.Element {
  const [busy, setBusy] = useState<string | null>(null);
  const [assignMap, setAssignMap] = useState<Record<string, string>>({});

  const stages = definition ? buildStages(definition, execution) : [];
  const progress = definition ? pct(execution, definition) : 0;

  async function run(key: string, fn: () => Promise<void>): Promise<void> {
    setBusy(key);
    try { await fn(); } finally { setBusy(null); }
  }

  const isTerminal = ["completed", "failed", "cancelled"].includes(execution.status);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16, overflow: "auto", height: "100%" }}>
      {/* header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: 8 }}>
        <div>
          <h2 style={{ margin: 0, fontSize: 17, fontWeight: 700 }}>
            {definition?.name ?? execution.workflowId}
          </h2>
          <p style={{ margin: "4px 0 0", fontSize: 11, color: "#6e7681", fontFamily: "monospace" }}>
            {execution.id}
          </p>
        </div>
        <Chip label={execution.status} status={execution.status} />
      </div>

      {/* timestamps */}
      <div style={{ display: "flex", gap: 16, fontSize: 12, color: "#8b949e" }}>
        <span>Started: <strong style={{ color: "#e6edf3" }}>{fmtDate(execution.startedAt)}</strong></span>
        {execution.completedAt && (
          <span>Finished: <strong style={{ color: "#e6edf3" }}>{fmtDate(execution.completedAt)}</strong></span>
        )}
      </div>

      {/* progress bar */}
      <div>
        <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4, fontSize: 11, color: "#8b949e" }}>
          <span>Progress</span><span>{progress}%</span>
        </div>
        <div style={{ height: 6, borderRadius: 3, background: "#21262d", overflow: "hidden" }}>
          <div style={{ height: "100%", width: `${progress}%`, background: "#238636", transition: "width 0.4s ease" }} />
        </div>
      </div>

      {/* action toolbar */}
      {!isTerminal && (
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          {execution.status === "running" && (
            <Btn label="Pause" variant="ghost" busy={busy === "pause"}
              onClick={() => void run("pause", onPause)} />
          )}
          {execution.status === "paused" && (
            <Btn label="Resume" variant="primary" busy={busy === "resume"}
              onClick={() => void run("resume", onResume)} />
          )}
          {execution.status === "running" && (
            <Btn label="Tick" variant="default" busy={busy === "tick"}
              onClick={() => void run("tick", onTick)} />
          )}
          <Btn label="Cancel" variant="danger" busy={busy === "cancel"}
            onClick={() => void run("cancel", onCancel)} />
        </div>
      )}

      {/* stage pipeline */}
      {stages.length > 0 && (
        <div>
          <p style={{ margin: "0 0 8px", fontSize: 12, fontWeight: 600, color: "#8b949e", textTransform: "uppercase", letterSpacing: 0.5 }}>
            Pipeline
          </p>
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
            {stages.map((stage) => {
              const c = (STAGE_STATUS_COLORS[stage.status] ?? STAGE_STATUS_COLORS.pending)!;
              return (
                <div
                  key={stage.id}
                  style={{
                    border: `1px solid ${c.border}`,
                    background: c.bg,
                    color: c.text,
                    borderRadius: 8,
                    padding: "6px 12px",
                    fontSize: 12,
                    minWidth: 76,
                    textAlign: "center",
                    boxShadow: c.glow != null ? `0 0 8px ${c.glow}44` : "none"
                  }}
                >
                  <div style={{ fontWeight: 600 }}>{stage.displayName}</div>
                  <div style={{ fontSize: 10, marginTop: 2, opacity: 0.75 }}>{stage.status}</div>
                  {stage.retryCount > 0 && (
                    <div style={{ fontSize: 10, color: "#d29922" }}>↻ {stage.retryCount}</div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* per-stage controls */}
      {!isTerminal && stages.length > 0 && (
        <div>
          <p style={{ margin: "0 0 8px", fontSize: 12, fontWeight: 600, color: "#8b949e", textTransform: "uppercase", letterSpacing: 0.5 }}>
            Stage Controls
          </p>
          <div style={{ display: "grid", gap: 6 }}>
            {stages.filter((s) => s.status !== "completed").map((stage) => (
              <div key={stage.id} style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                <span style={{ fontSize: 12, color: "#e6edf3", minWidth: 90 }}>{stage.displayName}</span>
                <select
                  defaultValue="none"
                  onChange={(e) => {
                    const mode = e.target.value as "none" | "random" | "always_fail";
                    void onSetFailureMode(stage.id, mode);
                  }}
                  style={{ background: "#161b22", border: "1px solid #30363d", color: "#e6edf3",
                           borderRadius: 6, padding: "3px 8px", fontSize: 11, cursor: "pointer" }}
                >
                  <option value="none">Normal</option>
                  <option value="random">Random fail</option>
                  <option value="always_fail">Always fail</option>
                </select>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* stage assignment */}
      {agents.length > 0 && stages.length > 0 && (
        <div>
          <p style={{ margin: "0 0 8px", fontSize: 12, fontWeight: 600, color: "#8b949e", textTransform: "uppercase", letterSpacing: 0.5 }}>
            Agent Assignments
          </p>
          <div style={{ display: "grid", gap: 6 }}>
            {stages.map((stage) => {
              const currentAgentId = execution.stageAgentAssignments[stage.id] ?? "";
              return (
                <div key={stage.id} style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <span style={{ fontSize: 12, color: "#e6edf3", minWidth: 90 }}>{stage.displayName}</span>
                  <select
                    value={assignMap[stage.id] ?? currentAgentId}
                    onChange={(e) => {
                      const agentId = e.target.value;
                      setAssignMap((prev) => ({ ...prev, [stage.id]: agentId }));
                      void onUpdateAssignment(stage.id, agentId);
                    }}
                    style={{ background: "#161b22", border: "1px solid #30363d", color: "#e6edf3",
                             borderRadius: 6, padding: "3px 8px", fontSize: 11, cursor: "pointer" }}
                  >
                    <option value="">— unassigned —</option>
                    {agents.map((a) => (
                      <option key={a.id} value={a.id}>{a.name}</option>
                    ))}
                  </select>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

/* ── main exports ────────────────────────────────────────────────────── */

interface WorkflowsTabProps {
  workflows: WorkflowExecution[];
  workflowDefinitions: WorkflowDefinition[];
  agents: Agent[];
  onStart: (workflowId?: string) => Promise<void>;
  onPause: (executionId: string) => Promise<void>;
  onResume: (executionId: string) => Promise<void>;
  onCancel: (executionId: string) => Promise<void>;
  onTick: () => Promise<void>;
  onSetFailureMode: (executionId: string, stageId: string, mode: "none" | "random" | "always_fail") => Promise<void>;
  onUpdateAssignment: (executionId: string, stageId: string, agentId: string) => Promise<void>;
}

export function WorkflowsTab({
  workflows, workflowDefinitions, agents,
  onStart, onPause, onResume, onCancel, onTick, onSetFailureMode, onUpdateAssignment
}: WorkflowsTabProps): JSX.Element {
  const [selectedId, setSelectedId] = useState<string | null>(
    workflows.find((w) => w.status === "running")?.id ?? workflows[0]?.id ?? null
  );
  const [startBusy, setStartBusy] = useState(false);
  const [showStartMenu, setShowStartMenu] = useState(false);

  const selected = workflows.find((w) => w.id === selectedId) ?? null;
  const selectedDef = selected ? workflowDefinitions.find((d) => d.id === selected.workflowId) : undefined;

  // Ensure selectedId stays valid when workflows changes
  if (selectedId && !workflows.find((w) => w.id === selectedId) && workflows.length > 0) {
    setSelectedId(workflows[0]?.id ?? null);
    }

  async function startWithDef(workflowId?: string): Promise<void> {
    setShowStartMenu(false);
    setStartBusy(true);
    try {
      await onStart(workflowId);
    } finally {
      setStartBusy(false);
    }
  }

  return (
    <div style={{ display: "grid", gridTemplateColumns: "260px 1fr", gap: 16, height: "100%" }}>
      {/* ── list panel ── */}
      <div style={{ display: "flex", flexDirection: "column", gap: 8, overflow: "hidden" }}>
        {/* start button */}
        <div style={{ position: "relative" }}>
          <button
            type="button"
            disabled={startBusy}
            onClick={() => setShowStartMenu((v) => !v)}
            style={{ width: "100%", background: "#238636", border: "1px solid #2ea043", color: "#fff",
                     borderRadius: 8, padding: "7px 12px", fontSize: 13, fontWeight: 600,
                     cursor: "pointer", display: "flex", justifyContent: "space-between", alignItems: "center" }}
          >
            {startBusy ? "Starting…" : "＋ New Workflow"}
            <span style={{ opacity: 0.7 }}>▾</span>
          </button>
          {showStartMenu && (
            <div style={{ position: "absolute", top: "100%", left: 0, right: 0, zIndex: 20,
                          background: "#161b22", border: "1px solid #30363d", borderRadius: 8,
                          marginTop: 4, overflow: "hidden" }}>
              <div
                onClick={() => void startWithDef(undefined)}
                style={{ padding: "8px 12px", cursor: "pointer", fontSize: 13,
                         borderBottom: "1px solid #21262d" }}
                onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.background = "#21262d"; }}
                onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.background = ""; }}
              >
                Default workflow
              </div>
              {workflowDefinitions.map((def) => (
                <div
                  key={def.id}
                  onClick={() => void startWithDef(def.id)}
                  style={{ padding: "8px 12px", cursor: "pointer", fontSize: 13 }}
                  onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.background = "#21262d"; }}
                  onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.background = ""; }}
                >
                  {def.name}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* workflow list */}
        <div style={{ flex: 1, overflow: "auto", display: "flex", flexDirection: "column", gap: 4 }}>
          {workflows.length === 0 ? (
            <p style={{ fontSize: 13, color: "#8b949e", textAlign: "center", marginTop: 24 }}>
              No workflows yet. Start one above.
            </p>
          ) : (
            workflows.map((wf) => {
              const def = workflowDefinitions.find((d) => d.id === wf.workflowId);
              const p = def ? pct(wf, def) : 0;
              const isActive = wf.id === selectedId;
              return (
                <button
                  key={wf.id}
                  type="button"
                  onClick={() => setSelectedId(wf.id)}
                  style={{
                    background: isActive ? "#21262d" : "transparent",
                    border: `1px solid ${isActive ? "#388bfd" : "#30363d"}`,
                    borderRadius: 8, padding: "10px 12px", cursor: "pointer",
                    textAlign: "left", width: "100%"
                  }}
                >
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
                    <span style={{ fontSize: 13, fontWeight: 600, color: "#e6edf3",
                                   overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", maxWidth: 140 }}>
                      {def?.name ?? wf.workflowId}
                    </span>
                    <Chip label={wf.status} status={wf.status} />
                  </div>
                  <div style={{ height: 3, borderRadius: 2, background: "#30363d", overflow: "hidden" }}>
                    <div style={{ height: "100%", width: `${p}%`, background: "#238636" }} />
                  </div>
                  <div style={{ fontSize: 10, color: "#6e7681", marginTop: 4 }}>
                    {fmtDate(wf.startedAt)} · {p}%
                  </div>
                </button>
              );
            })
          )}
        </div>
      </div>

      {/* ── detail pane ── */}
      <div style={{ background: "#161b22", border: "1px solid #30363d", borderRadius: 10,
                    padding: 20, overflow: "auto" }}>
        {selected ? (
          <WorkflowDetail
            execution={selected}
            definition={selectedDef}
            agents={agents}
            onPause={() => onPause(selected.id)}
            onResume={() => onResume(selected.id)}
            onCancel={() => onCancel(selected.id)}
            onTick={onTick}
            onSetFailureMode={(stageId, mode) => onSetFailureMode(selected.id, stageId, mode)}
            onUpdateAssignment={(stageId, agentId) => onUpdateAssignment(selected.id, stageId, agentId)}
          />
        ) : (
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
                        height: "100%", color: "#8b949e", gap: 8 }}>
            <span style={{ fontSize: 28 }}>◉</span>
            <p style={{ margin: 0, fontSize: 14 }}>Select a workflow to inspect and control it</p>
          </div>
        )}
      </div>
    </div>
  );
}
