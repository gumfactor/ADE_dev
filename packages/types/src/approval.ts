export type ApprovalStatus = "pending" | "approved" | "rejected" | "escalated" | "expired";

export type RiskLevel = "low" | "medium" | "high" | "critical";

export interface ToolAction {
  toolName: string;
  parameters: Record<string, unknown>;
}

export interface PolicyMatch {
  ruleId: string;
  decision: "auto_approve" | "requires_approval" | "block";
  riskScore: number;
}

export interface Signature {
  signerId: string;
  signerRole: string;
  timestamp: string;
  publicKeyFingerprint: string;
  signatureHash: string;
}

export interface SignatureChain {
  id: string;
  entityType: "approval" | "handoff" | "policy_override";
  entityId: string;
  signatures: Signature[];
  chainHash: string;
}

export interface ApprovalRequest {
  id: string;
  agentId: string;
  action: ToolAction;
  riskLevel: RiskLevel;
  policyMatch: PolicyMatch;
  status: ApprovalStatus;
  requestedAt: string;
  expiresAt: string;
  resolvedAt?: string;
  requiredSigners: string[];
  signatureChain?: SignatureChain;
}
