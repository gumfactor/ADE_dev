import type { DomainEvent } from "@ade/types";

export function timelineForAggregate(events: DomainEvent[], aggregateId: string): DomainEvent[] {
  return events
    .filter((event) => event.aggregateId === aggregateId)
    .sort((a, b) => a.timestamp.localeCompare(b.timestamp));
}

export function costRollupByAgent(events: DomainEvent[]): Record<string, number> {
  const result: Record<string, number> = {};

  for (const event of events) {
    if (event.aggregateType !== "agent") {
      continue;
    }
    const existing = result[event.aggregateId] ?? 0;
    result[event.aggregateId] = existing + (event.metadata.costUsd ?? 0);
  }

  return result;
}
