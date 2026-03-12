import type { MessageDeliveryReceipt, MessageEnvelope } from "@ade/types";

export class MessageBus {
  private readonly subscribers = new Map<string, (msg: MessageEnvelope) => void>();

  subscribe(agentId: string, handler: (msg: MessageEnvelope) => void): void {
    this.subscribers.set(agentId, handler);
  }

  unsubscribe(agentId: string): void {
    this.subscribers.delete(agentId);
  }

  publish(message: MessageEnvelope): MessageDeliveryReceipt[] {
    const receipts: MessageDeliveryReceipt[] = [];

    for (const target of message.to) {
      const handler = this.subscribers.get(target);
      if (handler) {
        handler(message);
        receipts.push({
          messageId: message.id,
          deliveredTo: target,
          deliveredAt: new Date().toISOString(),
          success: true
        });
      } else {
        receipts.push({
          messageId: message.id,
          deliveredTo: target,
          deliveredAt: new Date().toISOString(),
          success: false,
          failureReason: "No active subscriber"
        });
      }
    }

    return receipts;
  }
}
