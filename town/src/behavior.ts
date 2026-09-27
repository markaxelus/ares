import type { BrainEvent } from "./types.ts";
import { tiles } from "./planet.ts";
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
export function tilePath(start: number, end: number) {
  const queue = [start],
    previous = new Map<number, number | null>([[start, null]]);
  for (let i = 0; i < queue.length && !previous.has(end); i++)
    for (const n of tiles[queue[i]].neighbors)
      if (!previous.has(n)) {
        previous.set(n, queue[i]);
        queue.push(n);
      }
  const path: number[] = [];
  let next: number | null = end;
  while (next !== null) {
    path.unshift(next);
    next = previous.get(next) ?? null;
  }
  return path;
}
