export type MessageIntent =
  | "request"
  | "inform"
  | "delegate"
  | "challenge"
  | "merge"
  | "clarify";

export type ChannelScope = "private" | "broadcast" | "scoped_channel";

export interface MessageEnvelope<TPayload = unknown> {
  id: string;
  correlationId?: string;
  from: string;
  to: string[];
  intent: MessageIntent;
  scope: ChannelScope;
  payload: TPayload;
  sentAt: string;
  expiresAt?: string;
}

export interface MessageDeliveryReceipt {
  messageId: string;
  deliveredTo: string;
  deliveredAt: string;
  success: boolean;
  failureReason?: string;
}

export interface ScopedChannel {
  id: string;
  name: string;
  agentIds: string[];
  createdAt: string;
}
