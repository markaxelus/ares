# Ares town

A local 3D view of `brain/brain.json`. Build once, then run the existing brain server:

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

- Drag the background to orbit; scroll to zoom.
- Click a building for its fields, breadcrumb and connections.
- Drag a building onto an empty hex to save its optional `tile` field. Occupied tiles and pentagons reject moves. Revision conflicts reload the brain and ask you to retry.
- Ctrl K / Cmd K searches titles and flies to a place. Escape closes the panel or search.
- Explore lists regions, returns to the whole planet, shows all rails, and offers a Look: Full resolution, Fine pixels or Classic pixels. Full resolution is the default after feedback that the pixel looks were too coarse; it renders at the native size of the canvas, so a 1440p window is a 1440p render. The choice is remembered in this browser. Device pixel ratio is honored up to 2.
- Rails appear for the selected building by default. Hover one for its relation.
- The footer measures FPS from the R3F frame loop. Explore also shows the initial model-ready time. These are measurements on your browser, not claimed hardware benchmarks.

## Layout and rendering

The dual of a frequency-10 geodesic icosahedron creates 1,002 tiles: 990 hexagons and 12 pentagons. Pentagon tiles remain ocean. Boundaries are extruded along the tile normal. Canonical geometry groups produce 50 instanced plate batches; GLB mesh parts are instanced by asset too.

Hash-based region seeds and breadth-first placement follow the brain's stored node order. New siblings and new top-level groups append without relocating existing buildings. Region land grows by descendant count plus a margin, with ocean separation and subgroup patches. Moving a building keeps its inferred slot reserved, so siblings do not shift into the gap. All reservations are recalculated from the same brain; no layout database or localStorage is used. Reordering or deleting nodes may change inferred positions; explicit tiles remain reserved.

Goal and project assets have three authored growth models. Other types use their manifest model with maturity-dependent scale. Low confidence gets scaffolding, pinned nodes get flags, stale nodes get moss and dim lamps, and questions get fog. Great-circle rails use bridge pieces over ocean. The sun follows local wall-clock time and casts shadows from a 4096 map; the station, satellite and moons never shade the ground.

Full resolution draws straight to the canvas with 4x MSAA. The pixel looks route through Three's RenderPixelatedPass, which renders depth and normal edges at a fraction of the canvas size and snaps the camera projection to the pixel grid.

Dressing is derived from the layout, so it never moves a building: a Gobkit mountain on each of the twelve pentagons, biome trees on a quarter of the free land tiles and biome rocks on an eighth, a Kenney dock on the first OceanAID tile that touches the sea, the Space Kit dome, base, radar mast and rover on the Ares launch ground, planks and a small crate beside the Inbox pad, and three Space Kit planets as moons. A Kenney dog wanders the town hall land.

## Events and robots

`brain/events.jsonl` is an append-only, gitignored visual event feed, not a second knowledge store. Every record includes `kind`, `ids`, `source`, and a UTC ISO timestamp. Saves derive node/link events by comparing the saved brain with its prior version. Reads and writes use the requested `mcp_read` / `mcp_write` kinds across CLI, HTTP, watcher and MCP; `source` identifies which path produced them. HTTP polling does not dispatch Scout.

`GET /api/events` tails complete records with byte offsets as SSE IDs, supports `Last-Event-ID`, and sends heartbeat comments. New connections start at the current end; reconnects resume missed records. Completed ingestion is emitted after a successful save; dry runs never emit completion. Log failures print to stderr without breaking existing commands.

- Courier lands the Space Kit shuttle and unloads crates for notes and inbox arrivals.
- Builder walks a neighbor-tile route and raises buildings for additions or completed ingestion.
- Archivist carries a crate from Inbox to sort destinations.
- Scout orbits, sweeps, and illuminates the IDs returned by MCP reads.
- Ares rides the station assembled from manifest modules.

All five robots share a primitive body with role accessories. Walk, idle and carry motion is generated in code. Animation state is transient. The manifest's old robot GLBs remain available but are not required by this version.

## Validation

```powershell
py -3.13 -m unittest discover -s brain/tests
cd town
npm test
npm run build
```

Tests cover geometry, deterministic placement, append stability, drag isolation, manifest paths, maturity, event routing, neighbor routes, core CLI commands, sort destinations, HTTP conflicts, path traversal and SSE resume. The real `brain.py log "test note"` path was checked against the running SSE endpoint; that temporary note was removed afterward.

Browser verification on 2026-09-27 used the desktop app's built-in browser against the running brain server: the canvas matched its CSS size at device pixel ratio 1 with 4x MSAA on the RX 7700 XT, regions loaded with buildings, trees, rocks, mountains and the dock, and there were no console errors. That pane does not run animation frames, so its fps readout is meaningless there; the 60-fps and under-three-second targets are still unmeasured in a normal browser window. No manifest file path was missing. Research currently contains an asset catalog and design notes rather than numbered phases; implementation follows the four phases in the request.
