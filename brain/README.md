# Second brain

Everything known about me as a graph: who I am, what I want, believe, decided,
built, and am still figuring out. One JSON file, a Python CLI + tiny local
server, and a graph UI. Standard library only, nothing to install.

**What goes in:** context about me and my goals, written as my own notes.
Nothing about how an assistant should behave, no tooling trivia, no research
snapshots. If a fact doesn't help understand me or my goals, it doesn't belong.

**How it's organized:** a tree. Every node can sit inside another (`parent`),
so OceanAID holds Marlin, which holds MarlinBot. Top level: Startup path,
OceanAID, University of Victoria, Hackathons, Things I built, Victoria network,
Ares, Self-knowledge, Skills. Groups open on click in the graph; the Outline
view shows the whole tree. Cross-links between nodes are separate (`edges`).

```bash
py -3.13 brain/brain.py serve
```

That opens http://127.0.0.1:8765. Every change in the UI saves straight back to
`brain.json`, and the previous version is snapshotted into `brain/history/`
(last 30, ignored by git).

## Files

| File | What it is |
|---|---|
| `brain.json` | The data. Nodes, links, node types, relation kinds. The single source of truth. |
| `brain.py` | CLI and server. `py -3.13 brain/brain.py --help` |
| `index.html` | The UI. Served by `brain.py serve`; opening the file directly shows a "not connected" screen. |
| `history/` | Automatic snapshots before each save. `brain.py history`, `brain.py restore <name>` |
| `EXTRACT_PROMPT.md` | Prompt to paste into other Claude chats (web, phone, other machines) to pull my context out as JSON, then `brain.py import` it. |
| `inbox/` | Drop transcripts, meeting notes or any text here; the running server extracts facts and merges them (see below). Processed files move to `inbox/done/`. |

## In the UI

- **Groups**: click a closed group to open it and see what's inside; click it again to close. `X` toggles the selected group. The `⋯` menu has Overview / top-level / open everything.
- **Search / command palette**: `Ctrl K` or `/`. Type to find nodes (results show their path), run a command, or press Enter on a query to filter the graph.
- **Select** a node to open its panel: breadcrumb, what it contains, connections. "Add inside" creates a child. Double-click a leaf to see only its neighbours.
- **Edit** with `E`, **connect** with `L` then click another node, **pin** with `P`, **delete** with `⌫` (with undo).
- **Links**: click a line to change its relation, add a note, swap direction, or remove it.
- **Legend chips** hide a type; shift-click shows only that type.
- **Outline view** (`G`) is the tree: collapsible groups, same filter syntax, same open/closed state as the graph.
- **Drag** a node to place it; it stays put and the position is saved. "Re-run layout" forgets placements.
- Export JSON, copy everything as Markdown (handy for pasting into a prompt), import JSON, dark mode: in the `⋯` menu.

## Query syntax (UI and CLI)

```
free words               matches title, summary, details, tags or id
type:goal   t:goal       node type (key, or label prefix like type:open)
tag:startup   #startup   has tag
conf:high|medium|low
is:pinned  is:orphan  is:recent
since:2026-09-01         updated on or after
rel:supports             touches a link with this relation
link:htn-2026            that node plus everything connected to it
in:oceanaid              everything inside that group, any depth
is:group  is:root        groups; top-level nodes
-type:tool               negate anything
"quoted phrase"          exact phrase
```

Everything is ANDed. Example: `#startup -type:question since:2026-09-01`.

## CLI

```bash
py -3.13 brain/brain.py tree                    # the whole outline; add --long for summaries, --depth 1 for top level
py -3.13 brain/brain.py tree oceanaid
py -3.13 brain/brain.py find "in:oceanaid type:project"
py -3.13 brain/brain.py show marlinbot          # id or a title fragment; prints its path and children
py -3.13 brain/brain.py add --type project --parent marlin --title "Garmin integration" --summary "..."
py -3.13 brain/brain.py mv dockside projects    # move a node into another group (or 'root')
py -3.13 brain/brain.py add --type belief --title "Ship weekly" --summary "..." --tags startup --link supports:start-a-startup
py -3.13 brain/brain.py edit ares --add-tag active --conf high
py -3.13 brain/brain.py link htn-2026 supports things-that-should-exist --note "..."
py -3.13 brain/brain.py unlink htn-2026 things-that-should-exist
py -3.13 brain/brain.py merge duplicate-node canonical-node
py -3.13 brain/brain.py rm some-node
py -3.13 brain/brain.py types | rels | tags | stats | validate
py -3.13 brain/brain.py export            # markdown, for reading or pasting into an LLM
py -3.13 brain/brain.py export --json
py -3.13 brain/brain.py history ; py -3.13 brain/brain.py restore brain-20260921-180000.json
py -3.13 brain/brain.py import ~/Downloads/brain-extract.json   # merge facts from another chat, skips known ids/titles
py -3.13 brain/brain.py import extract.json --update             # same, but overwrite existing nodes
```

`--link` on `add` takes `rel:node` for an outgoing link or `<rel:node` for an incoming one.

## Data shape

```jsonc
{
  "meta":  { "name": "Second brain", "owner": "...", "version": 1, "updated": "2026-09-21" },
  "types": { "goal": { "label": "Goals", "color": "#d9764f" }, ... },   // "ink" = theme text colour
  "rels":  { "supports": "supports", "leads_to": "leads to", ... },
  "nodes": [{
    "id": "get-into-next-36",          // slug, stable, used in links and URLs (#id)
    "type": "goal",
    "title": "Get into Next 36",
    "summary": "One or two sentences, shown first.",
    "body": "Optional details. **bold**, `code`, - bullets.",
    "tags": ["startup", "career"],
    "confidence": "high",              // high | medium | low: how sure this is
    "source": "Conversation 2026-09-21",
    "created": "2026-09-21", "updated": "2026-09-21",
    "parent": "startup-path",          // optional: the group this node sits inside
    "order": 4,                        // optional: position among siblings
    "pinned": true,                    // optional
    "pos": { "x": 120, "y": -40 }      // optional, set when you drag a node
  }],
  "edges": [{ "id": "a--rel--b", "from": "a", "to": "b", "rel": "supports", "note": "optional" }]
}
```

Types: identity, goal, project, belief, decision, question, event, person, environment (places, schools, companies, programs), skill, tool. Add a type by adding a key to `types`; add a relation by using it (the CLI and UI register unknown relations automatically).

## For agents

The brain is an MCP server, so any Claude Code session or agent can read and write it without pasting anything. It is registered at user scope on this machine (`claude mcp list` shows `brain`). On another machine:

```bash
claude mcp add --scope user brain -- py -3.13 C:/path/to/ares/brain/brain.py mcp
```

Tools: `brain_context` (call first: who I am, the map, pinned nodes, and matches for a topic with paths and cross-links), `brain_search`, `brain_get`, `brain_tree`, `brain_add`, `brain_update`, `brain_link`, `brain_note`, `brain_ingest`.

Without MCP, the same pack comes from the CLI for pasting into any chat:

```bash
py -3.13 brain/brain.py context                 # overview, about 2.5K tokens
py -3.13 brain/brain.py context "co-founders"   # plus everything matching a topic
```

## Adding without friction

- **Quick note**: type plain text in the palette (`Ctrl K`) and pick "Quick note", or `py -3.13 brain/brain.py log "..."`. It lands in Inbox; the status bar shows how many are waiting.
- **Drop a file**: put a transcript or notes (`.txt .md .vtt .srt .json`, or a Claude Code `.jsonl`) in `brain/inbox/`. While `brain.py serve` runs it picks the file up within about 20 seconds, extracts what it says about me, files it into the right groups, links it, and moves the file to `inbox/done/`. Existing nodes never lose text: new facts get appended as dated lines, links are only added, and the identity node is never touched.
- **Sort the inbox**: `py -3.13 brain/brain.py sort` turns the quick notes into proper nodes in the right groups.
- **One file by hand**: `py -3.13 brain/brain.py ingest meeting.txt` (add `--dry-run` to see the proposal first, `--move` to archive the file).

The extractor runs `claude -p` on my own subscription (run `claude login` once in a terminal if it reports an expired session; pick a model with `--model sonnet`). `--local` uses Ollama instead, free but rougher: `--local qwen3.5:9b` after `ollama pull qwen3.5:9b`. `brain.py serve --local` makes the watcher use the local model too; `--no-watch` turns the watcher off.

## For Ares / Claude

This file is meant to be read and updated by the assistant as it learns things.
Rules:

- Only context about Mark: facts, goals, beliefs, decisions, questions, events, people, places, skills, tools, projects. Never notes about how to talk to him, never tooling or pricing research.
- Write as his notes: terse, factual, first person where needed. Never "the user" or "you". Never "not X but Y". No em dashes.
- Put every new node inside the group it belongs to (`--parent`); make a subgroup when a topic grows past a few nodes.
- Prefer editing an existing node over adding a near-duplicate (`find` first, `merge` if needed).
- New facts get `confidence` and `source`. Inferences are `medium` or `low`.
- Open questions are first-class nodes (`type: question`) linked to what they're about.
- Keep summaries to one or two sentences; put detail in `body`.
