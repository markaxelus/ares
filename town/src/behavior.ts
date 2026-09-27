// Pure rules: which robot answers which brain event, which packages ride the tunnel.
import type { BrainEvent } from "./types.ts";
import { tilePath as planetPath, tiles, type Tile } from "./planet.ts";
export type Role = "courier" | "builder" | "archivist" | "scout" | "ares";
export type Job = { role: Role; ids: string[]; event: BrainEvent };
export function eventJobs(event: BrainEvent): Job[] {
  if (event.kind === "note")
    return [{ role: "courier", ids: event.ids, event }];
  if (event.kind === "node_added" || event.kind === "ingest_done")
    return event.ids.map((id) => ({ role: "builder", ids: [id], event }));
  if (event.kind === "sort")
    return event.ids.map((id) => ({ role: "archivist", ids: [id], event }));
  if (event.kind === "mcp_read" && event.source.startsWith("mcp:"))
    return [{ role: "scout", ids: event.ids, event }];
  return [];
}
/**
 * Knowledge packages. Agent reads carry places from the planet to the factory,
 * where the thinking happens; writes ship the output back to the planet.
 */
export type Transfer = {
  to: "factory" | "brain";
  ids: string[];
  event: BrainEvent;
};
export function eventTransfers(event: BrainEvent): Transfer[] {
  if (!event.ids.length) return [];
  if (event.kind === "mcp_read" && event.source.startsWith("mcp:"))
    return [{ to: "factory", ids: event.ids, event }];
  if (["node_added", "node_updated", "ingest_done"].includes(event.kind))
    return [{ to: "brain", ids: event.ids, event }];
  return [];
}
/**
 * Breadth-first route over neighbouring tiles, inclusive of both ends.
 * @param set the planet's tiles; the knowledge planet by default
 */
export function tilePath(start: number, end: number, set: Tile[] = tiles) {
  return planetPath(start, end, set);
}
