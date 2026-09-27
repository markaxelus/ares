import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { depots, regionPath } from "./depots.ts";
import { layoutBrain } from "./layout.ts";
import { tiles } from "./planet.ts";
import type { Brain } from "./types.ts";
const brain = JSON.parse(
  readFileSync(new URL("../../brain/brain.json", import.meta.url), "utf8"),
) as Brain;
test("every region except the inbox gets a depot on its own free land", () => {
  const layout = layoutBrain(brain),
    homes = depots(layout),
    occupied = new Set(layout.positions.values()),
    used = new Set<number>();
  assert.equal(
    homes.length,
    layout.groups.filter((g) => g.id !== "inbox").length,
  );
  for (const d of homes) {
    const owner = layout.groups.findIndex((g) => g.id === d.region);
    assert.equal(layout.owners.get(d.pad), owner, d.region);
    assert.ok(!occupied.has(d.pad) && !used.has(d.pad));
    used.add(d.pad);
    if (d.home >= 0) {
      assert.ok(tiles[d.pad].neighbors.includes(d.home));
      assert.equal(layout.owners.get(d.home), owner);
      assert.ok(!occupied.has(d.home) && !used.has(d.home));
      used.add(d.home);
    }
  }
});
test("a region path stays on the region's land", () => {
  const layout = layoutBrain(brain),
    [d] = depots(layout),
    owner = layout.owners.get(d.pad);
  const target = [...layout.positions].find(
    ([id, t]) => layout.groupOf.get(id) === d.region && t !== d.pad && t >= 0,
  )![1];
  const path = regionPath(d.pad, target, (t) => layout.owners.get(t) === owner);
  assert.equal(path[0], d.pad);
  assert.equal(path.at(-1), target);
  for (const t of path) assert.equal(layout.owners.get(t), owner);
  for (let i = 1; i < path.length; i++)
    assert.ok(tiles[path[i - 1]].neighbors.includes(path[i]));
});
