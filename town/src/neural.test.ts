import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { layoutBrain } from "./layout.ts";
import { regionWeb } from "./neural.ts";
import type { Brain } from "./types.ts";
const fixture: Brain = {
  types: {},
  rels: {},
  meta: {},
  nodes: [
    { id: "me", type: "identity", title: "Me" },
    { id: "a", type: "goal", title: "A", parent: "me" },
    { id: "a1", type: "goal", title: "A1", parent: "a" },
    { id: "b", type: "project", title: "B", parent: "me" },
    { id: "b1", type: "project", title: "B1", parent: "b" },
    { id: "b2", type: "project", title: "B2", parent: "b1" },
    { id: "c", type: "skill", title: "C", parent: "me" },
  ],
  edges: [
    { id: "e1", from: "a1", to: "b1", rel: "supports" },
    { id: "e2", from: "b2", to: "a", rel: "supports" },
    { id: "e3", from: "b1", to: "b2", rel: "supports" },
  ],
};
test("regions count their places and cross-links; inner links are not axons", () => {
  const web = regionWeb(fixture, layoutBrain(fixture));
  assert.deepEqual(
    web.regions.map((r) => [r.title, r.places, r.links]),
    [
      ["A", 2, 2],
      ["B", 3, 2],
      ["C", 1, 0],
      ["Inbox", 0, 0],
    ],
  );
  assert.deepEqual(web.links, [{ a: 0, b: 1, count: 2 }]);
  assert.equal(web.inbox, 3);
});
test("the real brain yields a connected web with ordered pairs", () => {
  const brain = JSON.parse(
    readFileSync(new URL("../../brain/brain.json", import.meta.url), "utf8"),
  ) as Brain;
  const web = regionWeb(brain, layoutBrain(brain));
  assert.ok(web.links.length > 0);
  for (const l of web.links) assert.ok(l.a < l.b && l.count > 0);
  const total = web.links.reduce((sum, l) => sum + l.count, 0);
  assert.ok(total <= brain.edges.length);
  assert.equal(
    web.regions.reduce((sum, r) => sum + r.places, 0),
    brain.nodes.length - 1,
  );
});
