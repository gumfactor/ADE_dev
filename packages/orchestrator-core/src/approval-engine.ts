import type { ApprovalRequest, RiskLevel } from "@ade/types";

const THRESHOLDS = {
  autoApprove: 9,
  teamLeadApproval: 19,
  multiApproval: 34
};

export interface ApprovalDecision {
  decision: "auto_approve" | "requires_approval" | "requires_multi_approval" | "block";
  riskLevel: RiskLevel;
  riskScore: number;
}

export class ApprovalEngine {
  // Permissive/additive baseline: low-risk actions are auto-approved.
  evaluateRiskScore(toolName: string, scope: "single_file" | "workspace" | "repo" | "system"): number {
    let score = 0;

    if (toolName.includes("deploy") || toolName.includes("push")) {
      score += 20;
    }
    if (toolName.includes("http") || toolName.includes("network")) {
      score += 15;
    }
    if (toolName.includes("write") || toolName.includes("delete")) {
      score += 10;
    }

    if (scope === "workspace") {
      score += 5;
    } else if (scope === "repo") {
      score += 10;
    } else if (scope === "system") {
      score += 25;
    }

    return score;
  }

  decide(score: number): ApprovalDecision {
    if (score <= THRESHOLDS.autoApprove) {
      return { decision: "auto_approve", riskLevel: "low", riskScore: score };
    }
    if (score <= THRESHOLDS.teamLeadApproval) {
      return { decision: "requires_approval", riskLevel: "medium", riskScore: score };
    }
    if (score <= THRESHOLDS.multiApproval) {
      return { decision: "requires_multi_approval", riskLevel: "high", riskScore: score };
    }
    return { decision: "block", riskLevel: "critical", riskScore: score };
  }

  isResolved(request: ApprovalRequest): boolean {
    return request.status === "approved" || request.status === "rejected" || request.status === "expired";
  }
}
