# Town changelog

One entry per change to the town. Newest first.

## 2026-09-27, the play loop: level, streak and quests

- A Quests panel in the header: level and points bar, streak line, and one quest per place that
  needs tending (inbox note, open question, low confidence, no links, stale for 90 days, no
  details), most pressing first, twelve shown with the rest a click away. Clicking a quest
  flies to the place.
- Points come from maturity (1, 3, 6 per place); levels begin at 0, 20, 60, 120, 200 and so on.
  The streak counts consecutive tended days, alive through a quiet today.
- Ares briefs you on the activity line when the town opens. Tended quests, a new level and a
  longer streak are celebrated in toasts as soon as the brain refreshes.
- `game.ts` holds the pure rules with tests; `README.md` has a Tending the planet section.

## 2026-09-27, the neural web is the brain's own regions

- The twelve invented neurons (Attention, Recall and so on) and their nearest-neighbour axons
  are gone. Neurons are now the brain's top-level regions, in continent order and colour, sized
  by place count; axons are the real cross-links between regions, thicker and brighter with
  more links. The intake feeds the Inbox, the core joins the intake, and a region without
  cross-links joins through the core. Today that is ten neurons and eleven linked pairs, with
  Startup path and Hackathons the busiest pair.
- Idle signals pick axons by link weight. Agent reads light the neurons of the regions read;
  writes pulse the regions written. Hover labels name the region with its place and link counts,
  and each axon with the pair it joins and its link count.
- `neural.ts` holds the pure region web with tests; `Factory.tsx` takes the layout and brain.

## 2026-09-27, an idle town no longer floods the event log

- The town polled the brain every three seconds and every poll was logged as a read carrying
  all 76 place ids, so `brain/events.jsonl` had grown to 5.7 MB in which 4,548 of 4,560 records
  were poll audits, and every event-stream client received each one. `GET /api/brain` now
  answers with an `ETag`; a request whose `If-None-Match` matches gets 304 and is not logged,
  since no knowledge moved. The town refreshes from the event stream instead: every record, a
  reconnect and a tab coming back trigger a conditional fetch, and a conditional poll every
  30 s covers anything missed. Graph UI saves refresh the town without dispatching robots, as
  before. Existing log records were left as they are.
- Frame rate at full resolution measured in the built-in browser at emulated 1920 by 1080 and
  2560 by 1440 viewports: 82 to 83 fps in the system, knowledge planet and factory views alike,
  which is the pane's refresh cap rather than the GPU. Recorded in `README.md`.

## 2026-09-27, globe camera and a neural factory

- Camera written from scratch after feedback that the previous one felt stuck. The anchor
  stays on the surface: left drag slides the planet under the cursor, right drag or Shift
  orbits, the wheel zooms toward the cursor and crosses to the other planet, arrows and WASD
  pan, Q E turn, R F tilt, plus and minus zoom. It goes down to 0.7 units and almost to the
  horizon. A drag never counts as a click. The camera-controls dependency is gone.
- The belt follows an exact circle through the intake with evenly spaced pieces, so it is one
  clean loop instead of a zigzag over tile centres.
- The factory is a neural network: twelve named neurons on pedestals joined by axons, signals
  firing all the time and cascading from the intake on every download; twelve named stations
  beside the belt in processing order; a core district with the crane; a robot yard by the
  gate; memory domes on the pentagons; every piece labelled on hover. Random scatter removed.

## 2026-09-27, the factory, the space tunnel and a camera that lands on tiles

- Camera rebuilt on camera-controls. Clicking a tile on either planet lands there: the tile
  becomes the orbit centre with its own normal as up, so buildings are seen from the side and
  as close as 1.2 units. Explore has Everything, Knowledge planet and Factory views; Escape
  backs out one step at a time. Panning is gone on purpose.
- Second planet: the factory, a 362-tile industrial world at x = 17 where the robots live.
  A conveyor belt rings it with packages riding forever, machines and robot arms work beside
  it, cogs spin, a crane and domes mark the skyline, three charging pads glow near the gate,
  a download scanner stands on the gate tile, relay satellites and the Ares station orbit it.
  The knowledge planet moved to x = -14 and kept everything it had.
- Space tunnel between the gate tiles: glass tube, light rings, pulses toward the factory,
  glowing mouths. Agent reads send packages from the places read into the scanner and the
  factory speeds up while it works; node additions, updates and ingestion send output back.
- Robots rest on the charging pads and commute: Builder and Archivist ride the tunnel in a
  capsule and walk to the job, Courier flies the shuttle to the Inbox. Trips are planned as
  legs up front, and the activity line narrates each leg.
- Eighteen Kenney Factory Kit and Space Station Kit models baked into `town/public/models/factory`
  (conveyor, machines, hoppers, press, arms, scanner, screen, glass pipe, crane, cog, piston,
  warning cone, box, floor button, container, console); `SPEC.md` and the manifest regenerated.
- `planet.ts` takes a radius and hosts the frame helpers; `transit.ts` holds the tunnel curve
  and package maths; `Factory.tsx` and `Tunnel.tsx` are new.

## 2026-09-27, full resolution by default, shadows, planet dressing

- Full resolution is the default look. The canvas renders at its native size with 4x MSAA
  instead of the half-size pixel pass with nearest-neighbour upscaling that read as blurry.
  Fine pixels and Classic pixels stay as opt-in looks in Explore; the Sharp option is gone.
  The chosen look is remembered in localStorage.
- The sun casts shadows from a 4096 map. Plates, buildings, dressing and walking robots cast
  and receive; the station, satellite, moons and their riders do not, so nothing in orbit
  paints squares on the ocean.
- Placed the curated models that had no use yet: pentagon mountains, biome rocks, the
  OceanAID dock (aligned to its plate), the Ares dome, base, radar and rover, planks and a
  small crate at the Inbox pad, three moons in the sky, the shuttle as the courier pod, and a
  dog on the town hall land.
- `README.md` records the browser check and what the built-in browser pane cannot measure.

## 2026-09-26, Quaternius packs added by hand

- Ultimate Space Kit, Animated Mech Pack and Ultimate Fantasy RTS were downloaded manually
  (Google Drive blocks scripts), unpacked into `town/assets/raw/quaternius/`, and the zips
  removed. Only glTF, texture and licence files were kept. All three are CC0.
- Goals and projects now grow through real stages: Fantasy RTS watchtower levels 1 to 3 for
  goals and barracks levels 1 to 3 for projects, one shared scale per family. The KayKit
  stand-ins are gone.
- Four placeholder robots from the Animated Mech Pack (flat colours, animations kept):
  Leela as Courier, Stan as Builder, Mike as Archivist, George as Ares.
- Ares ground and sky from the Space Kit: geodesic dome, base module, radar mast, shuttle,
  rover, three planets as moons. The Ares biome tree is now a Space Kit spiral tree.
- Curated set: 70 manifest entries over 62 GLB files, 7.76 MB after meshopt.
- `town/SPEC.md`, `town/assets/manifest.json` and `town/assets/inventory.json` regenerated.
  `town/RESEARCH.md` committed.

## 2026-09-26, first curated asset set

- Fetched Kenney (12 packs), KayKit (4), Quaternius (3), Gobkit and Polyy.AI into the
  ignored raw folder; inventoried every glTF (triangles, bounding boxes).
- Picked one model per node type, biome trees and rocks per group, station parts, scout
  satellite, inbox crates, rail and bridge, pentagon mountain. Optimised with gltf-transform
  (dedupe, prune, meshopt, 512px textures). 49 files, 6.48 MB.
- Wrote `town/SPEC.md` (scale rules, biome table, per-model scale and y-offset),
  `town/assets/manifest.json`, `town/assets/inventory.json`, `town/CREDITS.md`.
