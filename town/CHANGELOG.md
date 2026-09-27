# Town changelog

One entry per change to the town. Newest first.

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
