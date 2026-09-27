import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { brief, levelStart, progress, streakLine } from "./game.ts";
import type { Brain } from "./types.ts";
const now = new Date(2026, 8, 27, 12);
const fixture: Brain = {
  types: {},
  rels: {},
  meta: {},
  nodes: [
    { id: "me", type: "identity", title: "Me", created: "2026-09-20" },
    {
      id: "a",
      type: "goal",
      title: "A",
      parent: "me",
      body: "x",
      confidence: "high",
      updated: "2026-09-27",
    },
    {
      id: "b",
      type: "question",
      title: "B?",
      parent: "a",
      updated: "2026-09-26",
    },
    {
      id: "c",
      type: "belief",
      title: "C",
      parent: "a",
      body: "y",
      confidence: "low",
      updated: "2026-09-26",
    },
    {
      id: "d",
      type: "project",
      title: "D",
      parent: "a",
      body: "z",
      updated: "2026-09-25",
    },
    {
      id: "e",
      type: "event",
      title: "E",
      parent: "a",
      body: "w",
      updated: "2025-01-01",
    },
    { id: "f", type: "tool", title: "F", parent: "a", updated: "2026-09-24" },
    { id: "inbox", type: "note", title: "Inbox", parent: "me" },
    {
      id: "n1",
      type: "note",
      title: "N1",
      parent: "inbox",
      created: "2026-09-27",
    },
  ],
  edges: [
    { id: "e1", from: "a", to: "b", rel: "about" },
    { id: "e2", from: "e", to: "a", rel: "about" },
    { id: "e3", from: "f", to: "a", rel: "about" },
  ],
};
test("points, level, streak and one quest per place", () => {
  const p = progress(fixture, now);
  assert.equal(p.points, 20);
  assert.equal(p.level, 2);
  assert.deepEqual([p.levelStart, p.levelEnd], [20, 60]);
  assert.equal(p.streak, 4);
  assert.equal(p.today, 2);
  assert.deepEqual(
    p.quests.map((q) => `${q.kind}:${q.id}`),
    ["inbox:n1", "question:b", "unsure:c", "orphan:d", "stale:e", "sketch:f"],
  );
  assert.equal(
    Object.values(p.counts).reduce((s, n) => s + n, 0),
    6,
  );
  assert.match(streakLine(p), /4-day streak · 2 tended today/);
  assert.match(brief(p), /^Ares: level 2, 4-day streak/);
  assert.match(brief(p), /Start with N1$/);
});
test("a streak survives a quiet today and breaks after a missed day", () => {
  const alive = progress(fixture, new Date(2026, 8, 28, 9));
  assert.equal(alive.streak, 4);
  assert.match(streakLine(alive), /nothing yet today/);
  const broken = progress(fixture, new Date(2026, 9, 2, 9));
  assert.equal(broken.streak, 0);
  assert.equal(broken.daysSince, 5);
  assert.match(streakLine(broken), /last tended 5 days ago/);
});
test("levels start at 0, 20, 60, 120 and the real brain scores", () => {
  assert.deepEqual([1, 2, 3, 4].map(levelStart), [0, 20, 60, 120]);
  const brain = JSON.parse(
    readFileSync(new URL("../../brain/brain.json", import.meta.url), "utf8"),
  ) as Brain;
  const p = progress(brain);
  assert.ok(p.points > 0 && p.level >= 1);
  assert.ok(p.quests.length > 0);
  assert.ok(p.quests.every((q) => brain.nodes.some((n) => n.id === q.id)));
  assert.equal(new Set(p.quests.map((q) => q.id)).size, p.quests.length);
});
