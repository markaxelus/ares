# Pull my context out of another chat

Paste the prompt below into any other Claude conversation (claude.ai, the phone app, another machine's Claude Code). It writes a JSON file in the shape this brain imports. Save the output as a `.json` file, then run:

```bash
py -3.13 brain/brain.py import path/to/file.json
```

Nodes whose id or title already exist are skipped, so importing the same file twice is safe. Add `--update` to let the import overwrite existing nodes.

---

## The prompt

```
You have context about me from this conversation and from your memory of me. Extract everything you know about ME into JSON for my personal knowledge graph. Follow these rules exactly.

WHAT TO INCLUDE
Facts about me and my life: who I am, what I want, what I believe, decisions I made, open questions I have, things that happened, people I work with or know, places and organizations I am part of, skills I have, tools I use, projects I built or am building.

WHAT TO LEAVE OUT
Anything about you or how you should talk to me. Formatting preferences, tone preferences, tooling quirks, pricing research, generic advice. If it does not help understand me or my goals, leave it out.

VOICE
Write every summary and body as if they were my own notes: terse, factual, first person where a pronoun is needed. Never write "the user" or "you". Never use the phrasing "not X but Y". Never use em dashes. Do not add commentary about how confident you are inside the text; use the confidence field.

SHAPE
Output only a JSON object, no prose before or after:

{
  "nodes": [
    {
      "id": "short-kebab-slug",
      "type": "identity | goal | project | belief | decision | question | event | person | environment | skill | tool",
      "title": "Short title, under 60 characters",
      "summary": "One or two sentences. What shows first.",
      "body": "Optional detail. Bullets start with '- '. Blank line between paragraphs.",
      "tags": ["lowercase", "tags"],
      "confidence": "high | medium | low",
      "source": "where this came from, e.g. 'chat 2026-09-21' or 'claude.ai memory'",
      "created": "YYYY-MM-DD when this became true or was learned, if known",
      "parent": "id-or-exact-title of the group this belongs inside",
      "pinned": false
    }
  ],
  "edges": [
    { "from": "node-id-or-exact-title", "rel": "relation", "to": "node-id-or-exact-title", "note": "optional" }
  ]
}

TYPES
identity: only if you learn a core fact about who I am (one node titled "Mark Axelus", id "me").
goal: what I am aiming at. project: things I built or build. belief: principles, insights, self-knowledge.
decision: something I decided. question: something I am still figuring out. event: dated happenings.
person: people. environment: places, schools, companies, programs, communities. skill: what I can do. tool: hardware, accounts, software I rely on.

RELATIONS
Containment is expressed with "parent", so do not add edges for "part of" or "belongs to". Edges are for cross-links only:
leads_to, supports, informs, tension_with, constrains, about, asks_about, said, runs, uses, preceded, relates_to, works_with, located_in, met_at, made_at, teaches.
Direction reads "from rel to": {"from":"start-a-startup","rel":"leads_to","to":"get-into-next-36"}.

GROUPING
Every node sits inside a group via "parent". Use these existing groups (by id): startup-path (goals, plan, Next 36, co-founders), oceanaid (my job, Marlin), uvic (school, Startup Studio), hackathons, projects (things I built), victoria-network (local ecosystem, Lautaro, VIBE), ares, self (self-knowledge), skills. Nest deeper when it fits: a project's parts go inside the project. Make a new group only for a topic with several nodes.

QUALITY
Prefer fewer, denser nodes over many thin ones. Merge near-duplicates. Dates as YYYY-MM-DD. If you are unsure whether something is true, set confidence to low and say what is unconfirmed in the summary. Skip anything you cannot attribute to me.

These nodes already exist, so link to them by id instead of recreating them:
me, startup-path, get-into-next-36, ambitious-room, start-a-startup, find-cofounders, the-idea, what-to-optimize-for, oceanaid, marlin, marlinbot, uvic, startup-studio, compliance-team, hackathons, htn-2026, projects, portfolio, chronos, telco, victoria-network, lautaro, vibe, sahaj, peggy-storey, ares, self, skills.
```

---

## Where the other context lives

- **claude.ai web and phone app**: open a chat there, paste the prompt. Its memory of you is separate from Claude Code's, so this is the main source this machine cannot see.
- **Another computer with Claude Code**: its memory sits in `~/.claude/projects/*/memory/*.md` and its prompt history in `~/.claude/history.jsonl`. Paste the prompt into a session there, or copy those files over and ask a session here to read them.
- **This machine**: already swept on 2026-09-21 (7 projects of memory, prompt history, transcripts, repos, portfolio copy).
