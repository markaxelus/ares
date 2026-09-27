# Ares town

A local 3D view of `brain/brain.json` as a small solar system: the knowledge planet, where every brain node is a building, and the factory, an industrial world where the robots live and work. A space tunnel joins them and carries knowledge packages whenever an agent reads or writes the brain. Build once, then run the existing brain server:

```powershell
cd town
npm ci
npm run build
cd ..
py -3.13 brain/brain.py serve
```

Open http://127.0.0.1:8765/town/ or choose **Town** from the graph menu.
Node 22.18+ or 23.6+ supports the native TypeScript config and test runner. Python stays standard library only. Models, Meshopt decoder, fonts and scripts are local. Existing ingestion still uses whichever extractor you configure in the brain CLI; the town does not invoke an extractor.

## Controls

- Left drag slides the planet under your cursor. Right drag, or Shift and drag, orbits around the point you are looking at. The wheel zooms toward the cursor; zoom in over the other planet and you cross to it, zoom in from the whole-system view and you dive into the nearest planet. The camera goes as low as 0.7 units above the surface and tilts almost to the horizon, so nothing is out of reach.
- Keyboard: arrows or WASD pan, Q and E turn, R and F tilt, plus and minus zoom.
- Click any tile, on either planet, to centre on it; from far away that also brings you in close. A drag never counts as a click. Click a building for its fields, breadcrumb and connections.
- Escape backs out one step: it closes what is open, then leaves the tile for its planet, then returns to the whole system.
- Drag a building onto an empty hex to save its optional `tile` field. Occupied tiles and pentagons reject moves. Revision conflicts reload the brain and ask you to retry.
- Ctrl K / Cmd K searches titles and flies to a place. Escape closes the panel or search.
- Explore offers Everything, Knowledge planet and Factory views, lists the regions, shows all rails, and offers a Look: Full resolution, Fine pixels or Classic pixels. Full resolution is the default after feedback that the pixel looks were too coarse; it renders at the native size of the canvas, so a 1440p window is a 1440p render. The choice is remembered in this browser. Device pixel ratio is honored up to 2.
- Rails appear for the selected building by default. Hover one for its relation.
- The footer measures FPS from the R3F frame loop. Explore also shows the initial model-ready time. These are measurements on your browser, not claimed hardware benchmarks.

## Layout and rendering

Two Goldberg planets share one scene. The knowledge planet (radius 9, 1,002 tiles) sits at x = -14 and the factory (radius 5.5, 362 tiles) at x = 17; each is drawn inside its own group, so everything on a planet works in that planet's local frame and only the camera, the tunnel and the commuting robots think in world space.

The knowledge planet is the dual of a frequency-10 geodesic icosahedron: 1,002 tiles, 990 hexagons and 12 pentagons. Pentagon tiles remain ocean. Boundaries are extruded along the tile normal. Canonical geometry groups produce 50 instanced plate batches; GLB mesh parts are instanced by asset too.

Hash-based region seeds and breadth-first placement follow the brain's stored node order. New siblings and new top-level groups append without relocating existing buildings. Region land grows by descendant count plus a margin, with ocean separation and subgroup patches. Moving a building keeps its inferred slot reserved, so siblings do not shift into the gap. All reservations are recalculated from the same brain; no layout database or localStorage is used. Reordering or deleting nodes may change inferred positions; explicit tiles remain reserved.

Goal and project assets have three authored growth models. Other types use their manifest model with maturity-dependent scale. Low confidence gets scaffolding, pinned nodes get flags, stale nodes get moss and dim lamps, and questions get fog. Great-circle rails use bridge pieces over ocean. The sun follows local wall-clock time and casts shadows from a 4096 map; the station, satellite and moons never shade the ground.

Full resolution draws straight to the canvas with 4x MSAA. The pixel looks route through Three's RenderPixelatedPass, which renders depth and normal edges at a fraction of the canvas size and snaps the camera projection to the pixel grid.

The factory is fixed by geometry and never reads the brain. It is laid out as a neural network with a production line through it. The conveyor belt follows an exact great circle through the intake gate, with belt pieces spaced evenly along the circle so the loop is seamless, and sixteen packages ride it forever, faster while the factory is busy. Twelve named stations stand beside the belt in processing order, alternating sides and facing the belt: Sorter, Parser, Assembler (a robot arm), Memory press, Planner, Compressor, Core press, Welder (an arm), Router, Sorter, Tokenizer, Monitor. A crane and a console mark the core district beside the Core press. Twelve neurons (Attention, Recall, Curiosity, Planning, Memory, Language, Vision, Reasoning, Intuition, Focus, Empathy, Habit) sit on a Fibonacci sphere, each a glowing core on a pedestal, joined by axons that arch over the surface: every neuron links to its two nearest, and the intake and the core join the web. Signals run along the axons all the time, a couple a second when idle; a download lights the intake neuron, fires three signals, and every arrival fans out again while the factory is busy, so activity ripples across the planet. Three charging pads with pulsing rings form the robot yard two steps from the gate, each with a container of spare parts; a warning cone and an intake monitor flank the gate; four cogs spin on free tiles; geodesic domes cap the pentagons as memory domes. The download scanner stands on the gate tile with a ring above it that burns bright while knowledge is being processed. Two relay satellites circle in low orbit, and the Ares station circles higher with Ares aboard. Every piece has a hover label.

The tunnel is a quadratic curve from the knowledge planet's gate tile (the tile facing the factory) to the factory's gate tile, lifted in the middle: a glass tube, eleven light rings, pulses that always run toward the factory, and a glowing mouth at each end. Packages are instanced boxes: a package rises from its building, hops to the mouth, rides the tunnel at constant speed, hops to the far gate and drops onto its target, shrinking as it lands. Reads (`mcp_read` from an `mcp:` source) send up to twelve packages from the places read to the scanner, 260 ms apart, and each landing keeps the factory busy for 4.5 s. Node additions, updates and completed ingestion send output packages the other way, from the scanner to the building. Nothing about the packages is stored; they are a picture of the event feed.

Dressing on the knowledge planet is derived from the layout, so it never moves a building: a Gobkit mountain on each of the twelve pentagons, biome trees on a quarter of the free land tiles and biome rocks on an eighth, a Kenney dock on the first OceanAID tile that touches the sea, the Space Kit dome, base, radar mast and rover on the Ares launch ground, planks and a small crate beside the Inbox pad, and three Space Kit planets as moons. A Kenney dog wanders the town hall land.

## Events and robots

`brain/events.jsonl` is an append-only, gitignored visual event feed, not a second knowledge store. Every record includes `kind`, `ids`, `source`, and a UTC ISO timestamp. Saves derive node/link events by comparing the saved brain with its prior version. Reads and writes use the requested `mcp_read` / `mcp_write` kinds across CLI, HTTP, watcher and MCP; `source` identifies which path produced them. HTTP polling does not dispatch Scout.

`GET /api/events` tails complete records with byte offsets as SSE IDs, supports `Last-Event-ID`, and sends heartbeat comments. New connections start at the current end; reconnects resume missed records. Completed ingestion is emitted after a successful save; dry runs never emit completion. Log failures print to stderr without breaking existing commands.

Courier, Builder and Archivist live at the factory. Between jobs each stands on its charging pad. A job is planned as a list of legs, each with a duration and a function from progress to pose, so a whole trip is decided when it starts:

- Builder and Archivist walk to the factory gate, ride the tunnel in a glass capsule, walk from the planet's gate tile to the job, do it, walk back, ride home and walk to the pad. Builder raises buildings for additions or completed ingestion; the building stays sunk until Builder arrives, then rises. Archivist first walks to the Inbox, then carries the crate to its sort destination.
- Courier flies the Space Kit shuttle in an arc from its pad to the Inbox pad, lands, unloads two crates for 2.2 s, and flies back.
- Scout is a satellite over the knowledge planet; it sweeps and illuminates the IDs returned by MCP reads.
- Ares rides the station that circles the factory.

The activity line at the bottom left narrates the current leg. All five robots share a primitive body with role accessories. Walk, idle and carry motion is generated in code. Animation state is transient. The manifest's old robot GLBs remain available but are not required by this version.

## Validation

```powershell
py -3.13 -m unittest discover -s brain/tests
cd town
npm test
npm run build
```

Tests cover geometry, deterministic placement, append stability, drag isolation, manifest paths, maturity, event routing, neighbor routes, core CLI commands, sort destinations, HTTP conflicts, path traversal and SSE resume. The real `brain.py log "test note"` path was checked against the running SSE endpoint; that temporary note was removed afterward.

Browser verification on 2026-09-27 used the desktop app's built-in browser against the running brain server: the canvas matched its CSS size at device pixel ratio 1 with 4x MSAA on the RX 7700 XT, both planets, the tunnel, the belt, the neuron web and the charging pads rendered, scrolling from the system view dove into the factory, dragging slid the surface, scrolling zoomed toward the cursor, clicking a tile centred it, R F and Q E tilted and turned to a horizon view, Escape backed out, and there were no console errors. Three records appended to `brain/events.jsonl` by hand (a note, an `mcp_read` from an `mcp:` source, a `node_added`) drove the courier flight, eight packages down the tunnel and a builder trip, narrated by the activity line. The footer read 80 to 165 fps in an 800 by 450 pane; that is a pane measurement, not a benchmark, and the 60-fps target at full screen is still unmeasured. No manifest file path was missing. Research currently contains an asset catalog and design notes rather than numbered phases; implementation follows the four phases in the request.
