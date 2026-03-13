import type { ApprovalRequest } from "@ade/types";

interface InterventionRailProps {
  approvals: ApprovalRequest[];
  onResolveApproval: (approvalId: string, resolution: "approved" | "rejected") => void;
}

export function InterventionRail({ approvals, onResolveApproval }: InterventionRailProps): JSX.Element {
  return (
    <section style={{ display: "grid", gap: 10 }}>
      <h2 style={{ margin: 0, fontSize: 18, letterSpacing: 0.3 }}>Intervention Rail</h2>
      <div
        style={{
          borderRadius: 14,
          border: "1px solid rgba(255,255,255,0.15)",
          background: "rgba(22, 12, 32, 0.65)",
          padding: 14,
          minHeight: 120
        }}
      >
        {approvals.length === 0 ? (
          <p style={{ margin: 0, opacity: 0.7 }}>No pending approvals</p>
        ) : (
          approvals.map((approval) => (
            <div
              key={approval.id}
              style={{
                borderBottom: "1px solid rgba(255,255,255,0.08)",
                marginBottom: 10,
                paddingBottom: 10
              }}
            >
              <p style={{ margin: "0 0 4px", fontWeight: 700 }}>
                {approval.action.toolName} - {approval.riskLevel}
              </p>
              <p style={{ margin: "0 0 4px", fontSize: 12, opacity: 0.85 }}>
                Rule {approval.policyMatch.ruleId} score {approval.policyMatch.riskScore}
              </p>
              <p style={{ margin: 0, fontSize: 12, opacity: 0.85 }}>
                Signers: {approval.requiredSigners.join(", ")} | status: {approval.status}
              </p>
              {approval.status === "pending" ? (
                <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
                  <button
                    type="button"
                    onClick={() => {
                      onResolveApproval(approval.id, "approved");
                    }}
                    style={{
                      border: "1px solid rgba(92, 208, 145, 0.8)",
                      borderRadius: 8,
                      background: "rgba(34, 88, 60, 0.55)",
                      color: "#d9ffee",
                      padding: "4px 8px",
                      cursor: "pointer"
                    }}
                  >
                    Approve
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      onResolveApproval(approval.id, "rejected");
                    }}
                    style={{
                      border: "1px solid rgba(255, 122, 110, 0.8)",
                      borderRadius: 8,
                      background: "rgba(88, 34, 34, 0.55)",
                      color: "#ffe2df",
                      padding: "4px 8px",
                      cursor: "pointer"
                    }}
                  >
                    Reject
                  </button>
                </div>
              ) : null}
            </div>
          ))
        )}
      </div>
    </section>
  );
}
