import { tiles } from "./planet.ts";
import type { Brain, BrainNode } from "./types.ts";
export function hash(id: string) {
  let h = 2166136261;
  for (const c of id) {
    h ^= c.charCodeAt(0);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}
export type Layout = {
  positions: Map<string, number>;
  owners: Map<number, number>;
  groups: BrainNode[];
  groupOf: Map<string, string>;
  seeds: Map<string, number>;
  warnings: string[];
  patches: Map<number, number>;
};
export function layoutBrain(brain: Brain): Layout {
  const index = new Map(brain.nodes.map((n) => [n.id, n])),
    root = brain.nodes.find((n) => n.type === "identity" && !n.parent);
  const groups = brain.nodes.filter(
    (n) => n.id !== root?.id && (!n.parent || n.parent === root?.id),
  );
  if (!groups.some((n) => n.id === "inbox"))
    groups.push({ id: "inbox", type: "note", title: "Inbox" });
  const groupOf = new Map<string, string>();
  function group(n: BrainNode): string {
    if (groupOf.has(n.id)) return groupOf.get(n.id)!;
    const parent = index.get(n.parent || "");
    const g =
      n.id === root?.id
        ? "identity"
        : !parent || parent.id === root?.id
          ? n.id
          : group(parent);
    groupOf.set(n.id, g);
    return g;
  }
  brain.nodes.forEach(group);
  const positions = new Map<string, number>(),
    owners = new Map<number, number>(),
    seeds = new Map<string, number>(),
    occupied = new Set<number>(),
    warnings: string[] = [];
  const groupIndex = new Map(groups.map((g, i) => [g.id, i]));
  groupIndex.set("identity", groups.length);
  // Reserve explicit destinations before the append-only allocation pass.
  const explicit = new Map<string, number>(),
    reserved = new Set<number>();
  for (const n of brain.nodes) {
    if (
      Number.isInteger(n.tile) &&
      n.tile! >= 0 &&
      n.tile! < tiles.length &&
      tiles[n.tile!].neighbors.length === 6 &&
      !reserved.has(n.tile!)
    ) {
      explicit.set(n.id, n.tile!);
      reserved.add(n.tile!);
    }
  }
  // Seed lazily in stored node order. Appending a new group cannot reserve a
  // tile ahead of an existing building. Inbox is always present, even empty.
  function seed(id: string): number {
    const existing = seeds.get(id);
    if (existing !== undefined) return existing;
    const start = hash(id) % tiles.length;
    let best = -1,
      score = -Infinity;
    for (let k = 0; k < tiles.length; k++) {
      const t = tiles[(start + k) % tiles.length];
      if (t.neighbors.length === 5 || occupied.has(t.id) || reserved.has(t.id))
        continue;
      const separation = Math.min(
        2,
        ...[...seeds.values()].map((s) => 1 - t.normal.dot(tiles[s].normal)),
      );
      if (separation > 0.27) {
        best = t.id;
        break;
      }
      if (separation > score) {
        score = separation;
        best = t.id;
      }
    }
    if (best < 0) {
      warnings.push(`No tile available for region ${id}`);
      return -1;
    }
    seeds.set(id, best);
    occupied.add(best);
    owners.set(best, groupIndex.get(id)!);
    return best;
  }
  if (root) positions.set(root.id, seed("identity"));
  positions.set("inbox", seed("inbox"));
  function place(n: BrainNode): number {
    const exists = positions.get(n.id);
    if (exists !== undefined) return exists;
    const g = group(n),
      gi = groupIndex.get(g)!;
    if (groupIndex.has(n.id)) {
      const tile = seed(n.id);
      positions.set(n.id, tile);
      return tile;
    }
    const parent = index.get(n.parent || "");
    const anchor = parent && group(parent) === g ? place(parent) : seed(g);
    const queue = [anchor],
      seen = new Set(queue);
    for (let head = 0; head < queue.length; head++) {
      const id = queue[head],
        tile = tiles[id];
      if (
        tile.neighbors.length === 6 &&
        !occupied.has(id) &&
        !reserved.has(id) &&
        (!owners.has(id) || owners.get(id) === gi) &&
        tile.neighbors.every((k) => !owners.has(k) || owners.get(k) === gi)
      ) {
        positions.set(n.id, id);
        occupied.add(id);
        owners.set(id, gi);
        return id;
      }
      for (const next of tile.neighbors)
        if (!seen.has(next) && (!owners.has(next) || owners.get(next) === gi)) {
          seen.add(next);
          queue.push(next);
        }
    }
    const spare = tiles.find(
      (t) =>
        t.neighbors.length === 6 && !occupied.has(t.id) && !reserved.has(t.id),
    );
    if (!spare) {
      warnings.push(`No tile available for ${n.title}`);
      return -1;
    }
    positions.set(n.id, spare.id);
    occupied.add(spare.id);
    owners.set(spare.id, gi);
    warnings.push(
      `${n.title} is outside its region because the region is full.`,
    );
    return spare.id;
  }
  brain.nodes.forEach(place);
  // Breadth-first land growth adds a proportional margin without changing buildings.
  for (const [g, gi] of groupIndex) {
    const members = brain.nodes.filter((n) => group(n) === g),
      target = Math.max(7, Math.ceil(members.length * 1.65) + 5);
    const queue = [...owners]
        .filter(([, owner]) => owner === gi)
        .map(([id]) => id),
      seen = new Set(queue);
    let count = queue.length;
    for (let head = 0; head < queue.length && count < target; head++)
      for (const id of tiles[queue[head]].neighbors) {
        if (seen.has(id)) continue;
        seen.add(id);
        const tile = tiles[id];
        if (
          tile.neighbors.length === 5 ||
          owners.has(id) ||
          tile.neighbors.some((k) => owners.has(k) && owners.get(k) !== gi)
        )
          continue;
        owners.set(id, gi);
        queue.push(id);
        count++;
        if (count >= target) break;
      }
  }
  for (const [id, tile] of explicit) {
    const occupant = [...positions].find(
      ([other, at]) => other !== id && at === tile,
    );
    if (occupant) {
      warnings.push(
        `Saved tile for ${id} is occupied; using its inferred location.`,
      );
      continue;
    }
    positions.set(id, tile);
    owners.set(tile, groupIndex.get(group(index.get(id)!))!);
  }
  const patches = new Map<number, number>();
  const children = new Map<string, BrainNode[]>();
  for (const n of brain.nodes) {
    const list = children.get(n.parent || "") || [];
    list.push(n);
    children.set(n.parent || "", list);
  }
  const descendants = (id: string): number =>
    (children.get(id) || []).reduce(
      (count, n) => count + 1 + descendants(n.id),
      0,
    );
  for (const node of brain.nodes) {
    if (!node.parent || node.parent === root?.id || !children.has(node.id))
      continue;
    const seed = positions.get(node.id);
    if (seed === undefined || seed < 0) continue;
    const owner = groupIndex.get(group(node)),
      wanted = Math.ceil(descendants(node.id) * 1.4) + 2;
    const queue = [seed],
      seen = new Set(queue);
    let count = 0;
    for (let head = 0; head < queue.length && count < wanted; head++) {
      const tile = queue[head];
      if (patches.has(tile) || owners.get(tile) !== owner) continue;
      patches.set(tile, (hash(node.id) % 5) - 2);
      count++;
      for (const next of tiles[tile].neighbors)
        if (!seen.has(next)) {
          seen.add(next);
          queue.push(next);
        }
    }
  }
  return { positions, owners, groups, groupOf, seeds, warnings, patches };
}
export function maturity(n: BrainNode, brain: Brain) {
  return n.confidence === "high" &&
    !!n.body?.trim() &&
    brain.edges.some((e) => e.from === n.id || e.to === n.id)
    ? 3
    : n.body?.trim()
      ? 2
      : 1;
}
export function breadcrumb(n: BrainNode, brain: Brain) {
  const path: BrainNode[] = [];
  let cur: BrainNode | undefined = n;
  const seen = new Set<string>();
  while (cur && !seen.has(cur.id)) {
    path.unshift(cur);
    seen.add(cur.id);
    cur = brain.nodes.find((p) => p.id === cur!.parent);
  }
  return path;
}
