# Approval Workflows

## Policy Baseline

Permissive/additive policy with risk-based escalation.

- Score <= 9: auto-approve
- Score 10-19: single manager approval
- Score 20-34: multi-approver route
- Score >= 35: block and escalate

## Multi-Signer Path

1. Agent submits approval request.
2. Policy engine determines signer set.
3. Signers attest in sequence or quorum.
4. Resolution event is emitted.
5. Signature chain hash is updated.

## Human Handoff Path

1. Agent enters waiting_input.
2. Context snapshot captured in event stream.
3. Human provides direction/approval.
4. Agent resumes execution or workflow is cancelled.
