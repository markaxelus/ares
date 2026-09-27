// Where the keeper robots live: one depot per region, a charging pad by the
// region's square with quarters beside it, and paths that stay on region land.
import type { Layout } from "./layout.ts";
import {
  BRAIN_POS,
  FACTORY_POS,
  nearestTile,
  tilePath,
  tiles,
} from "./planet.ts";
export type Depot = { region: string; pad: number; home: number };
const gate = nearestTile(FACTORY_POS.clone().sub(BRAIN_POS), tiles).id;
/**
 * One depot per region except the inbox: the first free hex found breadth-first
 * from the region's seed over its own land becomes the pad, a free neighbour
 * the quarters (-1 when there is none). Depot tiles never overlap buildings.
 */
export function depots(layout: Layout): Depot[] {
  const occupied = new Set(layout.positions.values()),
    taken = new Set<number>(),
    out: Depot[] = [];
  layout.groups.forEach((g, owner) => {
    if (g.id === "inbox") return;
    const seed = layout.seeds.get(g.id);
    if (seed === undefined) return;
    const mine = (t: number) => layout.owners.get(t) === owner;
    const free = (t: number) =>
      mine(t) &&
      t !== gate &&
      tiles[t].neighbors.length === 6 &&
      !occupied.has(t) &&
      !taken.has(t);
    const queue = [seed],
      seen = new Set([seed]);
    let pad = -1;
    for (let i = 0; i < queue.length && pad < 0; i++) {
      if (free(queue[i])) {
        pad = queue[i];
        break;
      }
      for (const n of tiles[queue[i]].neighbors)
        if (!seen.has(n) && mine(n)) {
          seen.add(n);
          queue.push(n);
        }
    }
    if (pad < 0) return;
    taken.add(pad);
    const home = tiles[pad].neighbors.find(free) ?? -1;
    if (home >= 0) taken.add(home);
    out.push({ region: g.id, pad, home });
  });
  return out;
}
/**
 * Breadth-first route that only crosses allowed tiles, inclusive of both ends;
 * the end itself is always allowed. Falls back to the plain route when the
 * region's land does not connect the two.
 */
export function regionPath(
  start: number,
  end: number,
  allowed: (tile: number) => boolean,
) {
  const queue = [start],
    previous = new Map<number, number | null>([[start, null]]);
  for (let i = 0; i < queue.length && !previous.has(end); i++)
    for (const n of tiles[queue[i]].neighbors)
      if (!previous.has(n) && (n === end || allowed(n))) {
        previous.set(n, queue[i]);
        queue.push(n);
      }
  if (!previous.has(end)) return tilePath(start, end);
  const path: number[] = [];
  let next: number | null = end;
  while (next !== null) {
    path.unshift(next);
    next = previous.get(next) ?? null;
  }
  return path;
}
