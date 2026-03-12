import type { DomainEvent, EventStoreQuery } from "@ade/types";

// In-memory adapter for MVP. Replace with Postgres table-backed append/query.
export class InMemoryEventStore {
  private readonly events: DomainEvent[] = [];

  append(event: DomainEvent): void {
    this.events.push(event);
  }

  query(filter: EventStoreQuery): DomainEvent[] {
    const limit = filter.limit ?? 200;

    return this.events
      .filter((event) => (filter.aggregateId ? event.aggregateId === filter.aggregateId : true))
      .filter((event) => (filter.aggregateType ? event.aggregateType === filter.aggregateType : true))
      .filter((event) => (filter.eventType ? event.eventType === filter.eventType : true))
      .filter((event) => (filter.workspaceId ? event.metadata.workspaceId === filter.workspaceId : true))
      .filter((event) => (filter.fromTimestamp ? event.timestamp >= filter.fromTimestamp : true))
      .filter((event) => (filter.toTimestamp ? event.timestamp <= filter.toTimestamp : true))
      .slice(-limit);
  }
}
