import { test } from "node:test";
import assert from "node:assert/strict";
import { eventJobs, tilePath } from "./behavior.ts";
import { tiles } from "./planet.ts";
test("real event kinds select the correct worker", () => {
  const base = {
    ids: ["node-a"],
    source: "mcp:brain_get",
    timestamp: new Date().toISOString(),
  };
  for (const [kind, role] of [
    ["note", "courier"],
    ["node_added", "builder"],
    ["ingest_done", "builder"],
    ["sort", "archivist"],
    ["mcp_read", "scout"],
  ])
    assert.equal(eventJobs({ ...base, kind })[0].role, role);
  assert.equal(
    eventJobs({ ...base, kind: "mcp_read", source: "http:brain" }).length,
    0,
  );
});
test("robot routes use neighboring tiles and reach the destination", () => {
  const path = tilePath(17, 803);
  assert.equal(path[0], 17);
  assert.equal(path.at(-1), 803);
  for (let i = 1; i < path.length; i++)
    assert.ok(tiles[path[i - 1]].neighbors.includes(path[i]));
});
