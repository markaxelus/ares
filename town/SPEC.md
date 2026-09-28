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

One patch per top-level group under `me`, plus Inbox. Ocean fills the gaps. Every region uses the same KayKit Medieval Hexagon buildings and trees, so the planet reads as one world; regions differ by plate colour and by what stands on them. Trees alternate between the pack's two single trees by region and stand only on shore tiles.

| Group | Title | Look | Tree |
|---|---|---|---|
| `startup-path` | Startup path | Highlands | `biome.startup-path.tree` |
| `oceanaid` | OceanAID | Coast | `biome.oceanaid.tree` |
| `uvic` | University of Victoria | Campus green | `biome.uvic.tree` |
| `hackathons` | Hackathons | Festival ground | `biome.hackathons.tree` |
| `projects` | Things I built | Workshop district | `biome.projects.tree` |
| `victoria-network` | Victoria network | Harbour town | `biome.victoria-network.tree` |
| `ares` | Ares | Launch ground under the station | `biome.ares.tree` |
| `self` | Self-knowledge | Forest garden | `biome.self.tree` |
| `skills` | Skills | Mill row | `biome.skills.tree` |
| `inbox` | Inbox | Drop pad | `biome.inbox.tree` |

| Id | Source model | File | Scale | y-offset |
|---|---|---|---:|---:|
| `biome.startup-path.tree` | `tree_single_A` | `town/public/models/biomes/startup-path-tree.glb` | 0.7523 | 0.0772 |
| `biome.oceanaid.tree` | `tree_single_B` | `town/public/models/biomes/oceanaid-tree.glb` | 0.7421 | 0.0742 |
| `biome.uvic.tree` | `tree_single_A` | `town/public/models/biomes/startup-path-tree.glb` | 0.7523 | 0.0772 |
| `biome.hackathons.tree` | `tree_single_B` | `town/public/models/biomes/oceanaid-tree.glb` | 0.7421 | 0.0742 |
| `biome.projects.tree` | `tree_single_A` | `town/public/models/biomes/startup-path-tree.glb` | 0.7523 | 0.0772 |
| `biome.victoria-network.tree` | `tree_single_B` | `town/public/models/biomes/oceanaid-tree.glb` | 0.7421 | 0.0742 |
| `biome.ares.tree` | `tree_single_A` | `town/public/models/biomes/startup-path-tree.glb` | 0.7523 | 0.0772 |
| `biome.self.tree` | `tree_single_B` | `town/public/models/biomes/oceanaid-tree.glb` | 0.7421 | 0.0742 |
| `biome.skills.tree` | `tree_single_A` | `town/public/models/biomes/startup-path-tree.glb` | 0.7523 | 0.0772 |
| `biome.inbox.tree` | `tree_single_B` | `town/public/models/biomes/oceanaid-tree.glb` | 0.7421 | 0.0742 |

## Node types

One KayKit Medieval Hexagon building per type, all at one world scale (0.38) so sizes compare: the castle is the town hall, goals are towers, projects are workshops, beliefs are churches, decisions are archery ranges (aim taken), questions are tents under fog, events are taverns, people live in homes, environments are markets, skills are windmills, tools are mines, notes are open crates. Goals and projects also have the three growth stages below.

| Id | Source model | File | Scale | y-offset |
|---|---|---|---:|---:|
| `node.identity` | `building_castle_blue` | `town/public/models/nodes/identity.glb` | 0.38 | 0 |
| `node.goal` | `building_tower_B_blue` | `town/public/models/nodes/goal.glb` | 0.38 | 0 |
| `node.project` | `building_blacksmith_blue` | `town/public/models/nodes/project.glb` | 0.38 | 0.0019 |
| `node.belief` | `building_church_blue` | `town/public/models/nodes/belief.glb` | 0.38 | 0 |
| `node.decision` | `building_archeryrange_blue` | `town/public/models/nodes/decision.glb` | 0.38 | 0 |
| `node.question` | `tent` | `town/public/models/nodes/question.glb` | 0.62 | 0 |
| `node.event` | `building_tavern_blue` | `town/public/models/nodes/event.glb` | 0.38 | 0 |
| `node.person` | `building_home_A_blue` | `town/public/models/nodes/person.glb` | 0.38 | 0 |
| `node.environment` | `building_market_blue` | `town/public/models/nodes/environment.glb` | 0.38 | 0.0021 |
| `node.skill` | `building_windmill_blue` | `town/public/models/nodes/skill.glb` | 0.38 | 0 |
| `node.tool` | `building_mine_blue` | `town/public/models/nodes/tool.glb` | 0.38 | 0 |
| `node.note` | `crate_open` | `town/public/models/nodes/note.glb` | 0.38 | 0.0021 |

## Growth

Goals rise from a tower base to tower A to tower B; projects start as a lumber stack on site, become a blacksmith, then a lumber mill. One scale for all, so growth is real height.

| Id | Source model | File | Scale | y-offset |
|---|---|---|---:|---:|
| `growth.goal.1` | `building_tower_base_blue` | `town/public/models/growth/goal-1.glb` | 0.38 | 0 |
| `growth.goal.2` | `building_tower_A_blue` | `town/public/models/growth/goal-2.glb` | 0.38 | 0 |
| `growth.goal.3` | `building_tower_B_blue` | `town/public/models/nodes/goal.glb` | 0.38 | 0 |
| `growth.project.1` | `resource_lumber` | `town/public/models/growth/project-1.glb` | 0.38 | 0 |
| `growth.project.2` | `building_blacksmith_blue` | `town/public/models/nodes/project.glb` | 0.38 | 0.0019 |
| `growth.project.3` | `building_lumbermill_blue` | `town/public/models/growth/project-3.glb` | 0.38 | 0.0013 |

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

## Robots

The robots in the app are built from primitives in code. These Animated Mech Pack flat-colour models stay curated but unused; each keeps its animation clips and is scaled to 0.35 tall.

| Id | Source model | File | Scale | y-offset |
|---|---|---|---:|---:|
| `robot.courier` | `Leela` | `town/public/models/robots/courier.glb` | 0.0663 | 0.0013 |
| `robot.builder` | `Stan` | `town/public/models/robots/builder.glb` | 0.0542 | -0.0008 |
| `robot.archivist` | `Mike` | `town/public/models/robots/archivist.glb` | 0.0656 | -0.001 |
| `robot.ares` | `George` | `town/public/models/robots/ares.glb` | 0.0536 | 0.001 |

## Ares ground and sky

Ultimate Space Kit pieces: the base module at the tunnel gate, one radar mast on the Ares ground, the shuttle that flies between the station and the Inbox pad, and the geodesic dome that caps the factory's pentagons. Three Space Kit planets serve as moons in the sky; the app sets their scale and distance.

| Id | Source model | File | Scale | y-offset |
|---|---|---|---:|---:|
| `ares.dome` | `GeodesicDome` | `town/public/models/ares/dome.glb` | 0.0938 | -0.0004 |
| `ares.base` | `Base_Large` | `town/public/models/ares/base.glb` | 0.1055 | -0.0004 |
| `ares.radar` | `Roof_Radar` | `town/public/models/ares/radar.glb` | 0.1474 | -0.5997 |
| `ares.shuttle` | `Spaceship_RaeTheRedPanda` | `town/public/models/ares/shuttle.glb` | 0.0537 | 0 |
| `sky.moon.1` | `Planet_6` | `town/public/models/sky/moon-1.glb` | 1 | 0 |
| `sky.moon.2` | `Planet_8` | `town/public/models/sky/moon-2.glb` | 1 | 0 |
| `sky.moon.3` | `Planet_5` | `town/public/models/sky/moon-3.glb` | 1 | 0 |

## Scout, inbox, links, pentagons, keepers

Scout is the Polyy low-poly radar satellite (about 5.4k triangles; the full-detail twin is 52–55k and was not curated). Inbox crates are KayKit. The rail is one Kenney train-kit track, 1 unit long. The bridge is the Kenney hex bridge, one tile across. The twelve pentagons share one KayKit mountain, scaled to about 1.15 across. The keeper quarters are the pack's second home.

| Id | Source model | File | Scale | y-offset |
|---|---|---|---:|---:|
| `hex.kenney` | `grass` | `town/public/models/hex/kenney-grass.glb` | 1 | 0 |
| `hex.kaykit` | `hex_grass` | `town/public/models/hex/kaykit-grass.glb` | 0.5 | 0 |
| `keeper.home` | `building_home_B_blue` | `town/public/models/keepers/home.glb` | 0.38 | 0 |
| `scout.satellite` | `11_radar_sat` | `town/public/models/orbit/scout.glb` | 0.7 | 0 |
| `inbox.pad` | `landingpad_small` | `town/public/models/inbox/pad.glb` | 0.5 | 0 |
| `inbox.crate` | `crate_A_big` | `town/public/models/inbox/crate.glb` | 1.3333 | 0 |
| `inbox.crate-open` | `crate_open` | `town/public/models/nodes/note.glb` | 0.965 | 0.0054 |
| `link.rail` | `track` | `town/public/models/links/rail.glb` | 1 | 0 |
| `link.bridge` | `bridge` | `town/public/models/links/bridge.glb` | 1 | 0 |
| `pentagon.mountain` | `mountain_A_grass` | `town/public/models/pentagons/mountain.glb` | 0.6129 | 0 |
| `life.dog` | `animal-dog` | `town/public/models/life/dog.glb` | 0.1389 | 0 |

## Factory

Kenney Factory Kit and Space Station Kit pieces for the work planet: a conveyor belt that rings the planet, machines and hoppers beside it, robot arms, the download scanner at the tunnel mouth, glass pipe for the tunnel mouths, a crane landmark, cogs, pistons, warning cones, packages, round floor buttons as robot rest pads, and station containers and consoles.

| Id | Source model | File | Scale | y-offset |
|---|---|---|---:|---:|
| `factory.conveyor` | `conveyor-long` | `town/public/models/factory/conveyor.glb` | 0.5 | 0 |
| `factory.machine` | `machine` | `town/public/models/factory/machine.glb` | 0.4667 | 0 |
| `factory.machine-fortified` | `machine-fortified` | `town/public/models/factory/machine-fortified.glb` | 0.4688 | 0 |
| `factory.press` | `machine-bed` | `town/public/models/factory/press.glb` | 0.5106 | 0 |
| `factory.hopper` | `hopper-high-round` | `town/public/models/factory/hopper.glb` | 0.5366 | 0 |
| `factory.arm` | `robot-arm-a` | `town/public/models/factory/arm.glb` | 0.2812 | 0 |
| `factory.arm-b` | `robot-arm-b` | `town/public/models/factory/arm-b.glb` | 0.2833 | 0 |
| `factory.scanner` | `scanner-high` | `town/public/models/factory/scanner.glb` | 0.451 | 0 |
| `factory.screen` | `screen-panel-wide` | `town/public/models/factory/screen.glb` | 0.4583 | 0 |
| `factory.pipe` | `pipe-glass-large-long` | `town/public/models/factory/pipe.glb` | 0.5 | 0 |
| `factory.crane` | `crane` | `town/public/models/factory/crane.glb` | 0.4347 | 0 |
| `factory.cog` | `cog-a` | `town/public/models/factory/cog.glb` | 0.5 | 0.075 |
| `factory.piston` | `piston-round` | `town/public/models/factory/piston.glb` | 0.45 | 0 |
| `factory.warning` | `warning-orange` | `town/public/models/factory/warning.glb` | 0.248 | 0 |
| `factory.box` | `box-small` | `town/public/models/factory/box.glb` | 0.4706 | 0 |
| `factory.pad` | `button-floor-round` | `town/public/models/factory/pad.glb` | 1.2 | 0 |
| `factory.container` | `container-tall` | `town/public/models/factory/container.glb` | 0.5833 | 0 |
| `factory.console` | `computer-system` | `town/public/models/factory/console.glb` | 0.5 | 0 |

## Optimisation

Each chosen file was run through `@gltf-transform/cli` 4.5 `optimize`: dedupe, prune, meshopt, textures clamped to 512px. Simplification was left off so silhouettes stay as authored. Meshopt needs `MeshoptDecoder` at load time.

Unique files: 64. Source bytes of those files and their external buffers and images: 18,134,301. Curated GLBs: 5,216,012 (4.97 MB).

| File | Before | After |
|---|---:|---:|
| `town/public/models/hex/kenney-grass.glb` | 4,680 | 18,076 |
| `town/public/models/hex/kaykit-grass.glb` | 21,205 | 55,440 |
| `town/public/models/nodes/identity.glb` | 336,587 | 127,596 |
| `town/public/models/nodes/goal.glb` | 151,787 | 86,048 |
| `town/public/models/nodes/project.glb` | 141,922 | 85,804 |
| `town/public/models/nodes/belief.glb` | 108,608 | 77,352 |
| `town/public/models/nodes/decision.glb` | 221,245 | 104,652 |
| `town/public/models/nodes/question.glb` | 24,939 | 56,224 |
| `town/public/models/nodes/event.glb` | 189,724 | 100,616 |
| `town/public/models/nodes/person.glb` | 74,221 | 69,364 |
| `town/public/models/nodes/environment.glb` | 171,034 | 93,808 |
| `town/public/models/nodes/skill.glb` | 164,791 | 92,552 |
| `town/public/models/nodes/tool.glb` | 84,887 | 72,352 |
| `town/public/models/nodes/note.glb` | 30,893 | 58,284 |
| `town/public/models/growth/goal-1.glb` | 100,556 | 73,860 |
| `town/public/models/growth/goal-2.glb` | 133,690 | 81,780 |
| `town/public/models/growth/project-1.glb` | 30,723 | 58,376 |
| `town/public/models/growth/project-3.glb` | 189,425 | 98,092 |
| `town/public/models/keepers/home.glb` | 100,993 | 75,148 |
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
| `town/public/models/links/rail.glb` | 8,464 | 21,288 |
| `town/public/models/links/bridge.glb` | 36,344 | 23,064 |
| `town/public/models/pentagons/mountain.glb` | 34,209 | 59,072 |
| `town/public/models/biomes/startup-path-tree.glb` | 22,176 | 55,876 |
| `town/public/models/biomes/oceanaid-tree.glb` | 26,207 | 57,052 |
| `town/public/models/life/dog.glb` | 119,544 | 52,064 |
| `town/public/models/robots/courier.glb` | 827,961 | 183,092 |
| `town/public/models/robots/builder.glb` | 1,707,926 | 374,344 |
| `town/public/models/robots/archivist.glb` | 1,695,510 | 370,976 |
| `town/public/models/robots/ares.glb` | 2,206,173 | 445,532 |
| `town/public/models/ares/dome.glb` | 115,880 | 21,676 |
| `town/public/models/ares/base.glb` | 164,167 | 28,832 |
| `town/public/models/ares/radar.glb` | 52,639 | 11,208 |
| `town/public/models/ares/shuttle.glb` | 142,993 | 22,080 |
| `town/public/models/sky/moon-1.glb` | 72,451 | 15,804 |
| `town/public/models/sky/moon-2.glb` | 54,397 | 13,320 |
| `town/public/models/sky/moon-3.glb` | 62,079 | 14,620 |
| `town/public/models/factory/conveyor.glb` | 18,688 | 22,052 |
| `town/public/models/factory/machine.glb` | 25,620 | 23,176 |
| `town/public/models/factory/machine-fortified.glb` | 29,828 | 23,432 |
| `town/public/models/factory/press.glb` | 52,136 | 28,056 |
| `town/public/models/factory/hopper.glb` | 16,644 | 21,920 |
| `town/public/models/factory/arm.glb` | 50,592 | 24,668 |
| `town/public/models/factory/arm-b.glb` | 44,524 | 24,848 |
| `town/public/models/factory/scanner.glb` | 21,656 | 22,384 |
| `town/public/models/factory/screen.glb` | 16,000 | 21,916 |
| `town/public/models/factory/pipe.glb` | 14,976 | 22,168 |
| `town/public/models/factory/crane.glb` | 53,396 | 27,128 |
| `town/public/models/factory/cog.glb` | 13,660 | 21,252 |
| `town/public/models/factory/piston.glb` | 37,736 | 31,460 |
| `town/public/models/factory/warning.glb` | 16,136 | 22,076 |
| `town/public/models/factory/box.glb` | 7,500 | 20,388 |
| `town/public/models/factory/pad.glb` | 14,628 | 25,208 |
| `town/public/models/factory/container.glb` | 13,052 | 15,352 |
| `town/public/models/factory/console.glb` | 17,552 | 16,436 |

## Licences

Every curated pack states CC0 1.0 on its own page or LICENSE file. Attribution is not required. Polyy's LICENSE also asks that the pack not be resold unmodified; that line is recorded in `town/CREDITS.md`.

## Skipped

- Quaternius Ultimate Space Kit, Animated Mech Pack and Ultimate Fantasy RTS come as Google Drive folders that block scripted downloads. They were downloaded by hand on 2026-09-26; only their glTF, texture and licence files were kept in the raw folder.
- Paid tiers (KayKit Extra/Source, Quaternius Pro/Source, Synty) were not fetched.
- FBX was not converted. Free Quaternius zips that include a glTF folder were used; the glTF folder was extracted and the FBX/OBJ copies left in the raw zip.
- Polyy's full-detail satellite zip was downloaded into the gitignored raw folder and not curated. The LOD set is the one in `town/public`.

