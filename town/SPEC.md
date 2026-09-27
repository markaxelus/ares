# Ares town asset spec

Curated models for the town view. Plates themselves stay generated; these files are the decoration. Scene units are metres. A tile is 1.0 across the flats.

## Hex scale

Measured from the grass tile bounding box. X is flat-to-flat, Z is point-to-point.

| Pack | Model | Flat-to-flat | Point-to-point | Scale |
|---|---|---:|---:|---:|
| Kenney Hexagon Kit | `grass` | 1.000 | 1.155 | 1 |
| KayKit Medieval Hexagon | `hex_grass` | 2.000 | 2.309 | 0.5 |

After those scales both tiles are 1.0 across the flats. KayKit tiles include a skirt: the grass surface is already at y = 0 and the mesh extends to y = -1, so the y-offset stays 0. Kenney tiles sit on y = 0.

Other models are scaled so a building footprint is about 0.55–0.72 of a tile, a tree is about 0.8–1.05 tall, and station modules stay in Kenney's own 1-unit grid. `yOffset` is applied after scale and lifts the mesh so its lowest point sits on y = 0. Orbit pieces (`scout`, the courier drone) keep a centred origin and a y-offset of 0.

## Biomes

One patch per top-level group under `me`, plus Inbox. Ocean fills the gaps. The dock model is extra dressing for OceanAID; the windmill stands in for a tree on the Skills belt.

| Group | Title | Look | Tree | Rock |
|---|---|---|---|---|
| `startup-path` | Startup path | Highlands | `biome.startup-path.tree` | `biome.startup-path.rock` |
| `oceanaid` | OceanAID | Coast with a dock; dock `biome.oceanaid.dock` | `biome.oceanaid.tree` | `biome.oceanaid.rock` |
| `uvic` | University of Victoria | Campus green | `biome.uvic.tree` | `biome.uvic.rock` |
| `hackathons` | Hackathons | Festival ground | `biome.hackathons.tree` | `biome.hackathons.rock` |
| `projects` | Things I built | Workshop district | `biome.projects.tree` | `biome.projects.rock` |
| `victoria-network` | Victoria network | Harbour town | `biome.victoria-network.tree` | `biome.victoria-network.rock` |
| `ares` | Ares | Launch ground under the station | `biome.ares.tree` | `biome.ares.rock` |
| `self` | Self-knowledge | Forest garden | `biome.self.tree` | `biome.self.rock` |
| `skills` | Skills | Industrial belt | `biome.skills.tree` | `biome.skills.rock` |
| `inbox` | Inbox | Drop pad | `biome.inbox.tree` | `biome.inbox.rock` |

| Id | Source model | File | Scale | y-offset |
|---|---|---|---:|---:|
| `biome.startup-path.tree` | `tree_pineDefaultA` | `town/public/models/biomes/startup-path-tree.glb` | 0.6146 | 0.0307 |
| `biome.startup-path.rock` | `stone-mountain` | `town/public/models/biomes/startup-path-rock.glb` | 1 | 0 |
| `biome.oceanaid.tree` | `Reed001` | `town/public/models/biomes/oceanaid-tree.glb` | 0.0011 | 0 |
| `biome.oceanaid.rock` | `rock_single_A` | `town/public/models/biomes/oceanaid-rock.glb` | 0.7378 | 0 |
| `biome.oceanaid.dock` | `building-dock` | `town/public/models/biomes/oceanaid-dock.glb` | 1 | 0 |
| `biome.uvic.tree` | `tree_oak` | `town/public/models/biomes/uvic-tree.glb` | 0.6932 | 0.0347 |
| `biome.uvic.rock` | `rock_largeA` | `town/public/models/biomes/uvic-rock.glb` | 0.2757 | 0.0138 |
| `biome.hackathons.tree` | `CommonTree_1` | `town/public/models/biomes/hackathons-tree.glb` | 0.1308 | 0.0318 |
| `biome.hackathons.rock` | `rock_single_A` | `town/public/models/biomes/oceanaid-rock.glb` | 0.7378 | 0 |
| `biome.projects.tree` | `tree_default` | `town/public/models/biomes/projects-tree.glb` | 0.4684 | 0.0234 |
| `biome.projects.rock` | `rock_largeA` | `town/public/models/biomes/uvic-rock.glb` | 0.2954 | 0.0148 |
| `biome.victoria-network.tree` | `tree_palm` | `town/public/models/biomes/victoria-network-tree.glb` | 0.5942 | 0.0297 |
| `biome.victoria-network.rock` | `rock_largeA` | `town/public/models/biomes/uvic-rock.glb` | 0.256 | 0.0128 |
| `biome.ares.tree` | `cactus_tall` | `town/public/models/biomes/ares-tree.glb` | 0.6 | 0.03 |
| `biome.ares.rock` | `rock_A` | `town/public/models/biomes/ares-rock.glb` | 0.5253 | 0 |
| `biome.self.tree` | `CommonTree_1` | `town/public/models/biomes/hackathons-tree.glb` | 0.1445 | 0.0351 |
| `biome.self.rock` | `Rock_Medium_1` | `town/public/models/biomes/self-rock.glb` | 0.1085 | 0.0294 |
| `biome.skills.tree` | `windmill` | `town/public/models/biomes/skills-tree.glb` | 0.497 | 0 |
| `biome.skills.rock` | `rock_largeA` | `town/public/models/biomes/uvic-rock.glb` | 0.3151 | 0.0158 |
| `biome.inbox.tree` | `TreeLow001` | `town/public/models/biomes/inbox-tree.glb` | 0.0008 | 0 |
| `biome.inbox.rock` | `Rock001` | `town/public/models/biomes/inbox-rock.glb` | 0.0006 | 0 |

## Node types

One model per type. Goals and projects also have the three growth stages below; the type entry is the mature building.

| Id | Source model | File | Scale | y-offset |
|---|---|---|---:|---:|
| `node.identity` | `building_castle_blue` | `town/public/models/nodes/identity.glb` | 0.3191 | 0 |
| `node.goal` | `building_tower_A_blue` | `town/public/models/nodes/goal.glb` | 0.4768 | 0 |
| `node.project` | `building_blacksmith_blue` | `town/public/models/nodes/project.glb` | 0.4815 | 0.0025 |
| `node.belief` | `statue_obelisk` | `town/public/models/nodes/belief.glb` | 0.7996 | 0.04 |
| `node.decision` | `sign` | `town/public/models/nodes/decision.glb` | 1.1008 | 0.055 |
| `node.question` | `Banner_1` | `town/public/models/nodes/question.glb` | 0.3135 | 0.4855 |
| `node.event` | `building_market_blue` | `town/public/models/nodes/event.glb` | 0.3446 | 0.0019 |
| `node.person` | `building_home_A_blue` | `town/public/models/nodes/person.glb` | 0.6443 | 0 |
| `node.environment` | `building-a` | `town/public/models/nodes/environment.glb` | 0.5851 | 0 |
| `node.skill` | `machine-window` | `town/public/models/nodes/skill.glb` | 0.3667 | 0 |
| `node.tool` | `building-h` | `town/public/models/nodes/tool.glb` | 0.4691 | 0 |
| `node.note` | `crate_open` | `town/public/models/nodes/note.glb` | 0.965 | 0.0054 |

## Growth

KayKit `building_stage_*` and the tower pieces stand in for Quaternius Ultimate Fantasy RTS, which could not be downloaded (see Skipped). Stage 3 of each reuses the mature node model.

| Id | Source model | File | Scale | y-offset |
|---|---|---|---:|---:|
| `growth.goal.1` | `building_stage_A` | `town/public/models/growth/goal-1.glb` | 0.5255 | 0.0031 |
| `growth.goal.2` | `building_tower_base_blue` | `town/public/models/growth/goal-2.glb` | 0.495 | 0 |
| `growth.goal.3` | `building_tower_A_blue` | `town/public/models/nodes/goal.glb` | 0.4768 | 0 |
| `growth.project.1` | `building_stage_A` | `town/public/models/growth/goal-1.glb` | 0.5923 | 0.0035 |
| `growth.project.2` | `building_stage_C` | `town/public/models/growth/project-2.glb` | 0.5345 | 0.0032 |
| `growth.project.3` | `building_blacksmith_blue` | `town/public/models/nodes/project.glb` | 0.4815 | 0.0025 |

## Ares station

Kenney station and space-kit modules share a 1-unit grid and are not scaled to a planet tile. The solar roof is a KayKit piece fitted to about 1.2 of that grid. The courier is the free Sci-Fi Essentials eye drone, a placeholder until a custom robot exists.

| Id | Source model | File | Scale | y-offset |
|---|---|---|---:|---:|
| `station.core` | `structure` | `town/public/models/station/core.glb` | 1 | 0 |
| `station.floor` | `floor` | `town/public/models/station/floor.glb` | 1 | 0 |
| `station.wall` | `wall-window` | `town/public/models/station/wall.glb` | 1 | 0 |
| `station.corridor` | `corridor` | `town/public/models/station/corridor.glb` | 1 | 0 |
| `station.dish` | `satelliteDish` | `town/public/models/station/dish.glb` | 1 | 0 |
| `station.solar` | `roofmodule_solarpanels` | `town/public/models/station/solar.glb` | 0.8601 | 0.086 |
| `station.courier` | `Enemy_EyeDrone` | `town/public/models/station/courier.glb` | 0.4018 | 0 |

## Scout, inbox, links, pentagons

Scout is the Polyy low-poly radar satellite (about 5.4k triangles; the full-detail twin is 52–55k and was not curated). Inbox crates are KayKit. The rail is one Kenney train-kit track, 1 unit long. The bridge is the Kenney hex bridge, one tile across. The twelve pentagons share one Gobkit mountain, scaled to about 1.7 across.

| Id | Source model | File | Scale | y-offset |
|---|---|---|---:|---:|
| `hex.kenney` | `grass` | `town/public/models/hex/kenney-grass.glb` | 1 | 0 |
| `hex.kaykit` | `hex_grass` | `town/public/models/hex/kaykit-grass.glb` | 0.5 | 0 |
| `scout.satellite` | `11_radar_sat` | `town/public/models/orbit/scout.glb` | 0.7 | 0 |
| `inbox.pad` | `landingpad_small` | `town/public/models/inbox/pad.glb` | 0.5 | 0 |
| `inbox.crate` | `crate_A_big` | `town/public/models/inbox/crate.glb` | 1.3333 | 0 |
| `inbox.crate-small` | `crate_A_small` | `town/public/models/inbox/crate-small.glb` | 1.1429 | 0 |
| `inbox.crate-open` | `crate_open` | `town/public/models/nodes/note.glb` | 0.965 | 0.0054 |
| `inbox.planks` | `Wood_Planks_Stack_Small` | `town/public/models/inbox/planks.glb` | 0.25 | 0.0016 |
| `link.rail` | `track` | `town/public/models/links/rail.glb` | 1 | 0 |
| `link.bridge` | `bridge` | `town/public/models/links/bridge.glb` | 1 | 0 |
| `pentagon.mountain` | `Mountain001` | `town/public/models/pentagons/mountain.glb` | 0.0019 | 0 |
| `life.dog` | `animal-dog` | `town/public/models/life/dog.glb` | 0.1389 | 0 |

## Optimisation

Each chosen file was run through `@gltf-transform/cli` 4.5 `optimize`: dedupe, prune, meshopt, textures clamped to 512px. Simplification was left off so silhouettes stay as authored. Meshopt needs `MeshoptDecoder` at load time.

Unique files: 49. Source bytes of those files and their external buffers and images: 42,556,496. Curated GLBs: 6,799,788 (6.48 MB).

| File | Before | After |
|---|---:|---:|
| `town/public/models/hex/kenney-grass.glb` | 4,680 | 18,076 |
| `town/public/models/hex/kaykit-grass.glb` | 21,205 | 55,440 |
| `town/public/models/nodes/identity.glb` | 336,587 | 127,596 |
| `town/public/models/nodes/goal.glb` | 133,690 | 81,780 |
| `town/public/models/nodes/project.glb` | 141,922 | 85,804 |
| `town/public/models/nodes/belief.glb` | 4,416 | 3,464 |
| `town/public/models/nodes/decision.glb` | 5,040 | 4,364 |
| `town/public/models/nodes/question.glb` | 21,150,296 | 2,325,552 |
| `town/public/models/nodes/event.glb` | 171,034 | 93,808 |
| `town/public/models/nodes/person.glb` | 74,221 | 69,364 |
| `town/public/models/nodes/environment.glb` | 108,936 | 33,908 |
| `town/public/models/nodes/skill.glb` | 38,812 | 25,832 |
| `town/public/models/nodes/tool.glb` | 63,644 | 29,404 |
| `town/public/models/nodes/note.glb` | 30,893 | 58,284 |
| `town/public/models/growth/goal-1.glb` | 60,652 | 66,932 |
| `town/public/models/growth/goal-2.glb` | 100,556 | 73,860 |
| `town/public/models/growth/project-2.glb` | 87,768 | 73,132 |
| `town/public/models/station/core.glb` | 29,828 | 15,892 |
| `town/public/models/station/floor.glb` | 2,836 | 13,716 |
| `town/public/models/station/wall.glb` | 9,720 | 14,780 |
| `town/public/models/station/corridor.glb` | 6,876 | 4,712 |
| `town/public/models/station/dish.glb` | 19,528 | 5,812 |
| `town/public/models/station/solar.glb` | 45,293 | 67,572 |
| `town/public/models/station/courier.glb` | 4,709,112 | 764,020 |
| `town/public/models/orbit/scout.glb` | 3,134,616 | 532,864 |
| `town/public/models/inbox/pad.glb` | 55,300 | 70,680 |
| `town/public/models/inbox/crate.glb` | 25,838 | 56,720 |
| `town/public/models/inbox/crate-small.glb` | 25,842 | 56,704 |
| `town/public/models/inbox/planks.glb` | 44,195 | 60,448 |
| `town/public/models/links/rail.glb` | 8,464 | 21,288 |
| `town/public/models/links/bridge.glb` | 36,344 | 23,064 |
| `town/public/models/pentagons/mountain.glb` | 15,940 | 36,152 |
| `town/public/models/biomes/startup-path-tree.glb` | 17,220 | 5,968 |
| `town/public/models/biomes/startup-path-rock.glb` | 20,904 | 21,124 |
| `town/public/models/biomes/oceanaid-tree.glb` | 16,016 | 36,176 |
| `town/public/models/biomes/oceanaid-rock.glb` | 20,042 | 55,216 |
| `town/public/models/biomes/oceanaid-dock.glb` | 28,980 | 22,444 |
| `town/public/models/biomes/uvic-tree.glb` | 14,644 | 5,328 |
| `town/public/models/biomes/uvic-rock.glb` | 7,552 | 4,068 |
| `town/public/models/biomes/hackathons-tree.glb` | 8,933,525 | 964,260 |
| `town/public/models/biomes/projects-tree.glb` | 9,428 | 4,380 |
| `town/public/models/biomes/victoria-network-tree.glb` | 13,616 | 5,056 |
| `town/public/models/biomes/ares-tree.glb` | 9,668 | 3,496 |
| `town/public/models/biomes/ares-rock.glb` | 30,452 | 63,704 |
| `town/public/models/biomes/self-rock.glb` | 2,532,513 | 485,516 |
| `town/public/models/biomes/skills-tree.glb` | 46,292 | 27,592 |
| `town/public/models/biomes/inbox-tree.glb` | 16,260 | 36,200 |
| `town/public/models/biomes/inbox-rock.glb` | 15,756 | 36,172 |
| `town/public/models/life/dog.glb` | 119,544 | 52,064 |

## Licences

Every curated pack states CC0 1.0 on its own page or LICENSE file. Attribution is not required. Polyy's LICENSE also asks that the pack not be resold unmodified; that line is recorded in `town/CREDITS.md`.

## Skipped

- Quaternius Ultimate Space Kit, Animated Mech Pack, and Ultimate Fantasy RTS. The site serves them as Google Drive folders, and Drive returned a download quota error in both gdown and the browser. Drop a glTF zip in `town/assets/raw/quaternius/` if you want them added later.
  - Ultimate Space Kit: https://drive.google.com/drive/folders/17F8HlI2zPTlo32aieW5YPPwOk78xo-2m
  - Animated Mech Pack: https://drive.google.com/drive/folders/1sueV_4CGMpZC8y30mWfgKK9UaT3mkHBX
  - Ultimate Fantasy RTS: https://drive.google.com/drive/folders/1h7sztlZyavWla-JDk3jp6KiWDdMh08yd
- Paid tiers (KayKit Extra/Source, Quaternius Pro/Source, Synty) were not fetched.
- FBX was not converted. Free Quaternius zips that include a glTF folder were used; the glTF folder was extracted and the FBX/OBJ copies left in the raw zip.
- Polyy's full-detail satellite zip was downloaded into the gitignored raw folder and not curated. The LOD set is the one in `town/public`.

