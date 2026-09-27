import { test } from "node:test";
import assert from "node:assert/strict";
import { tiles } from "./planet.ts";
test("Goldberg topology: 1002 tiles, twelve pentagons, reciprocal adjacency", () => {
  assert.equal(tiles.length, 1002);
  assert.equal(tiles.filter((t) => t.neighbors.length === 5).length, 12);
  for (const t of tiles) {
    assert.ok([5, 6].includes(t.boundary.length));
    assert.equal(t.boundary.length, t.neighbors.length);
    for (const n of t.neighbors) assert.ok(tiles[n].neighbors.includes(t.id));
  }
});
