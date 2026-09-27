// The factory's neural web derived from the brain: one neuron per region and
// one axon per pair of regions that real cross-links join, weighted by count.
import type { Layout } from "./layout.ts";
import type { Brain } from "./types.ts";
export type Region = {
  id: string;
  title: string;
  places: number;
  links: number;
};
/** Indices into `regions`, with a < b. */
export type RegionLink = { a: number; b: number; count: number };
export type RegionWeb = {
  regions: Region[];
  links: RegionLink[];
  inbox: number;
};
/**
 * Count places per region and links between regions.
 * @param layout the planet layout of the same brain, for region membership
 */
export function regionWeb(brain: Brain, layout: Layout): RegionWeb {
  const regions: Region[] = layout.groups.map((g) => ({
    id: g.id,
    title: g.title,
    places: 0,
    links: 0,
  }));
  const index = new Map(regions.map((r, i) => [r.id, i]));
  const regionOf = (id: string) => index.get(layout.groupOf.get(id) || "");
  for (const n of brain.nodes) {
    const i = regionOf(n.id);
    if (i !== undefined) regions[i].places++;
  }
  const counts = new Map<string, RegionLink>();
  for (const e of brain.edges) {
    const a = regionOf(e.from),
      b = regionOf(e.to);
    if (a === undefined || b === undefined || a === b) continue;
    const [lo, hi] = a < b ? [a, b] : [b, a],
      key = `${lo}:${hi}`;
    const link = counts.get(key) || { a: lo, b: hi, count: 0 };
    link.count++;
    counts.set(key, link);
    regions[lo].links++;
    regions[hi].links++;
  }
  return {
    regions,
    links: [...counts.values()].sort((u, v) => u.a - v.a || u.b - v.b),
    inbox: index.get("inbox") ?? -1,
  };
}
