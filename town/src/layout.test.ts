import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, existsSync } from "node:fs";
import { tiles } from "./planet.ts";
import { layoutBrain, maturity } from "./layout.ts";
import type { Brain } from "./types.ts";
const brain = JSON.parse(
  readFileSync(new URL("../../brain/brain.json", import.meta.url), "utf8"),
) as Brain;
test("placement is deterministic and leaves twelve pentagons in ocean", () => {
  const a = layoutBrain(brain),
    b = layoutBrain(JSON.parse(JSON.stringify(brain)));
  assert.deepEqual([...a.positions], [...b.positions]);
  assert.equal(new Set(a.positions.values()).size, a.positions.size);
  assert.ok(a.owners.size < 900);
});
test("appending 200 siblings never moves an existing building", () => {
  const doc = structuredClone(brain),
    base = layoutBrain(doc);
  const parent = doc.nodes.find((n) => n.id === "projects")!.id;
  for (let i = 0; i < 200; i++)
    doc.nodes.push({
      id: `fixture-${i}`,
      title: `Fixture ${i}`,
      type: "project",
      parent,
    });
  const next = layoutBrain(doc);
  for (const [id, tile] of base.positions)
    assert.equal(next.positions.get(id), tile, id);
  assert.equal(new Set(next.positions.values()).size, next.positions.size);
});
test("an explicit tile is respected and no layout fields are written", () => {
  const doc = structuredClone(brain),
    before = JSON.stringify(doc),
    layout = layoutBrain(doc);
  assert.equal(JSON.stringify(doc), before);
  const used = new Set(layout.positions.values());
  const tile = Array.from({ length: 1002 }, (_, i) => i).find(
    (i) => !used.has(i) && i > 50,
  )!;
  doc.nodes[doc.nodes.length - 1].tile = tile;
  assert.equal(layoutBrain(doc).positions.get(doc.nodes.at(-1)!.id), tile);
});
test("maturity requires body, confidence and links", () => {
  const node = { id: "a", type: "goal", title: "A" };
  const doc = {
    ...brain,
    edges: [{ id: "ab", from: "a", to: "b", rel: "supports" }],
  };
  assert.equal(maturity(node, doc), 1);
  assert.equal(maturity({ ...node, body: "Details" }, doc), 2);
  assert.equal(
    maturity({ ...node, body: "Details", confidence: "high" }, doc),
    3,
  );
});
test("every manifest asset exists locally", () => {
  const manifest = JSON.parse(
    readFileSync(new URL("../assets/manifest.json", import.meta.url), "utf8"),
  );
  for (const e of manifest.entries)
    assert.ok(
      existsSync(new URL(`../public/${e.file}`, import.meta.url)),
      e.id,
    );
});

test("dragging to an empty tile does not move other buildings", () => {
  const doc = structuredClone(brain),
    before = layoutBrain(doc);
  const node = doc.nodes.find((n) => n.type === "project" && !n.tile)!;
  const occupied = new Set(before.positions.values());
  const tile = tiles.find(
    (t) => t.neighbors.length === 6 && !occupied.has(t.id),
  )!.id;
  node.tile = tile;
  const after = layoutBrain(doc);
  assert.equal(after.positions.get(node.id), tile);
  for (const [id, position] of before.positions)
    if (id !== node.id) assert.equal(after.positions.get(id), position, id);
});

test("appending a new top-level group preserves every existing building", () => {
  const doc = structuredClone(brain),
    before = layoutBrain(doc);
  const root = doc.nodes.find((n) => n.type === "identity" && !n.parent);
  doc.nodes.push({
    id: "new-region-fixture",
    title: "New region",
    type: "project",
    parent: root?.id,
  });
  const after = layoutBrain(doc);
  for (const [id, tile] of before.positions)
    assert.equal(after.positions.get(id), tile, id);
});
