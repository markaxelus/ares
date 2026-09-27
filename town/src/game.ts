// The play loop, derived from the brain alone: points and a level from how
// mature the places are, a streak from the days the brain was tended, and
// quests for whatever needs tending. Nothing here is stored anywhere.
import { maturity } from "./layout.ts";
import type { Brain, BrainNode } from "./types.ts";
export type QuestKind =
  "inbox" | "question" | "unsure" | "orphan" | "stale" | "sketch";
export type Quest = { kind: QuestKind; id: string; title: string };
export type Progress = {
  points: number;
  level: number;
  levelStart: number;
  levelEnd: number;
  streak: number;
  lastTended: string | null;
  daysSince: number | null;
  today: number;
  quests: Quest[];
  counts: Record<QuestKind, number>;
};
export const STALE_DAYS = 90;
const POINTS = [0, 1, 3, 6];
const ORDER: QuestKind[] = [
  "inbox",
  "question",
  "unsure",
  "orphan",
  "stale",
  "sketch",
];
/** What each quest asks of you. */
export const ASKS: Record<QuestKind, string> = {
  inbox: "Sort the inbox",
  question: "Answer it",
  unsure: "Confirm it or drop it",
  orphan: "Link it to something",
  stale: "Still true? Touch it",
  sketch: "Write the details",
};
/** How a finished quest is announced. */
export const DONE: Record<QuestKind, string> = {
  inbox: "Sorted",
  question: "Answered",
  unsure: "Settled",
  orphan: "Linked",
  stale: "Refreshed",
  sketch: "Written up",
};
/** Points at which a level begins: 0, 20, 60, 120, 200, 300 and so on. */
export function levelStart(level: number) {
  return 10 * level * (level - 1);
}
const pad = (n: number) => String(n).padStart(2, "0");
const dayOf = (d: Date) =>
  `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const dayBefore = (d: Date) =>
  new Date(d.getFullYear(), d.getMonth(), d.getDate() - 1);
/**
 * Score the brain. One quest per place, the most pressing kind first: inbox
 * notes, open questions, low confidence, no links, older than STALE_DAYS,
 * no details. The root and the inbox itself are never quests.
 * @param now the moment to measure from; defaults to the wall clock
 */
export function progress(brain: Brain, now = new Date()): Progress {
  const linked = new Set<string>();
  for (const e of brain.edges) {
    linked.add(e.from);
    linked.add(e.to);
  }
  const parents = new Set(brain.nodes.map((n) => n.parent).filter(Boolean));
  const root = brain.nodes.find((n) => n.type === "identity" && !n.parent);
  const today = dayOf(now),
    days = new Set<string>(),
    quests: Quest[] = [];
  let points = 0,
    tendedToday = 0;
  const stale = (n: BrainNode) => {
    const when = Date.parse(n.updated || n.created || "");
    return (
      Number.isFinite(when) && now.getTime() - when > STALE_DAYS * 86400000
    );
  };
  for (const n of brain.nodes) {
    points += POINTS[maturity(n, brain)];
    for (const day of [n.created, n.updated])
      if (day) days.add(day.slice(0, 10));
    if ((n.updated || n.created || "").slice(0, 10) === today) tendedToday++;
    if (n.id === root?.id || n.id === "inbox") continue;
    const kind: QuestKind | null =
      n.parent === "inbox"
        ? "inbox"
        : n.type === "question"
          ? "question"
          : n.confidence === "low"
            ? "unsure"
            : !linked.has(n.id) && !parents.has(n.id)
              ? "orphan"
              : stale(n)
                ? "stale"
                : !n.body?.trim()
                  ? "sketch"
                  : null;
    if (kind) quests.push({ kind, id: n.id, title: n.title });
  }
  quests.sort((a, b) => ORDER.indexOf(a.kind) - ORDER.indexOf(b.kind));
  const counts = Object.fromEntries(ORDER.map((k) => [k, 0])) as Record<
    QuestKind,
    number
  >;
  for (const q of quests) counts[q.kind]++;
  let level = 1;
  while (levelStart(level + 1) <= points) level++;
  let streak = 0,
    cursor = days.has(today) ? now : dayBefore(now);
  while (days.has(dayOf(cursor))) {
    streak++;
    cursor = dayBefore(cursor);
  }
  const lastTended = [...days].sort().at(-1) ?? null;
  const daysSince = lastTended
    ? Math.round(
        (new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime() -
          new Date(`${lastTended}T00:00`).getTime()) /
          86400000,
      )
    : null;
  return {
    points,
    level,
    levelStart: levelStart(level),
    levelEnd: levelStart(level + 1),
    streak,
    lastTended,
    daysSince,
    today: tendedToday,
    quests,
    counts,
  };
}
/** The streak in words. */
export function streakLine(p: Progress) {
  if (p.streak)
    return `${p.streak}-day streak · ${
      p.today ? `${p.today} tended today` : "nothing yet today"
    }`;
  if (p.daysSince === null) return "Nothing tended yet";
  return `Streak broken · last tended ${
    p.daysSince === 1 ? "yesterday" : `${p.daysSince} days ago`
  }`;
}
/** One line for Ares to say when the town opens. */
export function brief(p: Progress) {
  const tend = `${p.quests.length} ${p.quests.length === 1 ? "thing" : "things"} to tend`;
  const first = p.quests[0];
  return `Ares: level ${p.level}, ${streakLine(p).toLowerCase()}, ${tend}${
    first ? `. Start with ${first.title}` : ""
  }`;
}
