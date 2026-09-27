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

One patch per top-level group under `me`, plus Inbox. Ocean fills the gaps. The dock model is extra dressing for OceanAID; the windmill stands in for a tree on the Skills belt; the Ares launch ground uses a Space Kit spiral tree.

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
| `biome.ares.tree` | `Tree_Spiral_1` | `town/public/models/biomes/ares-tree.glb` | 0.1336 | 0.0007 |
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
| `node.goal` | `WatchTower_FirstAge_Level3` | `town/public/models/nodes/goal.glb` | 0.7 | 0 |
| `node.project` | `Barracks_FirstAge_Level3` | `town/public/models/nodes/project.glb` | 0.3 | 0.0022 |
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

Quaternius Ultimate Fantasy RTS first-age buildings: watchtower levels 1 to 3 for goals, barracks levels 1 to 3 for projects. Each family shares one scale so the footprint and height grow with the stage. Stage 3 is the mature node model.

| Id | Source model | File | Scale | y-offset |
|---|---|---|---:|---:|
| `growth.goal.1` | `WatchTower_FirstAge_Level1` | `town/public/models/growth/goal-1.glb` | 0.7 | 0 |
| `growth.goal.2` | `WatchTower_FirstAge_Level2` | `town/public/models/growth/goal-2.glb` | 0.7 | 0 |
| `growth.goal.3` | `WatchTower_FirstAge_Level3` | `town/public/models/nodes/goal.glb` | 0.7 | 0 |
| `growth.project.1` | `Barracks_FirstAge_Level1` | `town/public/models/growth/project-1.glb` | 0.3 | 0.0022 |
| `growth.project.2` | `Barracks_FirstAge_Level2` | `town/public/models/growth/project-2.glb` | 0.3 | 0.0022 |
| `growth.project.3` | `Barracks_FirstAge_Level3` | `town/public/models/nodes/project.glb` | 0.3 | 0.0022 |

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

Placeholders from the Animated Mech Pack, flat-colour variants, until the custom primitive robots exist. Each keeps its 18 to 20 animation clips (Idle, Walk, Hello, Dance and more) and is scaled to 0.35 tall. Leela is Courier, Stan is Builder, Mike is Archivist, George is Ares.

| Id | Source model | File | Scale | y-offset |
|---|---|---|---:|---:|
| `robot.courier` | `Leela` | `town/public/models/robots/courier.glb` | 0.0663 | 0.0013 |
| `robot.builder` | `Stan` | `town/public/models/robots/builder.glb` | 0.0542 | -0.0008 |
| `robot.archivist` | `Mike` | `town/public/models/robots/archivist.glb` | 0.0656 | -0.001 |
| `robot.ares` | `George` | `town/public/models/robots/ares.glb` | 0.0536 | 0.001 |

## Ares ground and sky

Ultimate Space Kit pieces for the Ares biome: a geodesic dome and a base module on the launch ground, a radar mast, a shuttle that flies between the station and the Inbox pad, and a rover. Three Space Kit planets serve as moons in the sky; the app sets their scale and distance.

| Id | Source model | File | Scale | y-offset |
|---|---|---|---:|---:|
| `ares.dome` | `GeodesicDome` | `town/public/models/ares/dome.glb` | 0.0938 | -0.0004 |
| `ares.base` | `Base_Large` | `town/public/models/ares/base.glb` | 0.1055 | -0.0004 |
| `ares.radar` | `Roof_Radar` | `town/public/models/ares/radar.glb` | 0.1474 | -0.5997 |
| `ares.shuttle` | `Spaceship_RaeTheRedPanda` | `town/public/models/ares/shuttle.glb` | 0.0537 | 0 |
| `ares.rover` | `Rover_1` | `town/public/models/ares/rover.glb` | 0.0678 | 0.0101 |
| `sky.moon.1` | `Planet_6` | `town/public/models/sky/moon-1.glb` | 1 | 0 |
| `sky.moon.2` | `Planet_8` | `town/public/models/sky/moon-2.glb` | 1 | 0 |
| `sky.moon.3` | `Planet_5` | `town/public/models/sky/moon-3.glb` | 1 | 0 |

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

Unique files: 80. Source bytes of those files and their external buffers and images: 50,989,039. Curated GLBs: 8,546,700 (8.15 MB).

| File | Before | After |
|---|---:|---:|
| `town/public/models/hex/kenney-grass.glb` | 4,680 | 18,076 |
| `town/public/models/hex/kaykit-grass.glb` | 21,205 | 55,440 |
| `town/public/models/nodes/identity.glb` | 336,587 | 127,596 |
| `town/public/models/nodes/goal.glb` | 130,098 | 20,796 |
| `town/public/models/nodes/project.glb` | 367,936 | 48,116 |
| `town/public/models/nodes/belief.glb` | 4,416 | 3,464 |
| `town/public/models/nodes/decision.glb` | 5,040 | 4,364 |
| `town/public/models/nodes/question.glb` | 21,150,296 | 2,325,552 |
| `town/public/models/nodes/event.glb` | 171,034 | 93,808 |
| `town/public/models/nodes/person.glb` | 74,221 | 69,364 |
| `town/public/models/nodes/environment.glb` | 108,936 | 33,908 |
| `town/public/models/nodes/skill.glb` | 38,812 | 25,832 |
| `town/public/models/nodes/tool.glb` | 63,644 | 29,404 |
| `town/public/models/nodes/note.glb` | 30,893 | 58,284 |
| `town/public/models/growth/goal-1.glb` | 52,593 | 10,824 |
| `town/public/models/growth/goal-2.glb` | 71,852 | 12,984 |
| `town/public/models/growth/project-1.glb` | 107,856 | 18,964 |
| `town/public/models/growth/project-2.glb` | 186,323 | 31,696 |
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
| `town/public/models/biomes/ares-tree.glb` | 42,018 | 9,896 |
| `town/public/models/biomes/ares-rock.glb` | 30,452 | 63,704 |
| `town/public/models/biomes/self-rock.glb` | 2,532,513 | 485,516 |
| `town/public/models/biomes/skills-tree.glb` | 46,292 | 27,592 |
| `town/public/models/biomes/inbox-tree.glb` | 16,260 | 36,200 |
| `town/public/models/biomes/inbox-rock.glb` | 15,756 | 36,172 |
| `town/public/models/life/dog.glb` | 119,544 | 52,064 |
| `town/public/models/robots/courier.glb` | 827,961 | 183,092 |
| `town/public/models/robots/builder.glb` | 1,707,926 | 374,344 |
| `town/public/models/robots/archivist.glb` | 1,695,510 | 370,976 |
| `town/public/models/robots/ares.glb` | 2,206,173 | 445,532 |
| `town/public/models/ares/dome.glb` | 115,880 | 21,676 |
| `town/public/models/ares/base.glb` | 164,167 | 28,832 |
| `town/public/models/ares/radar.glb` | 52,639 | 11,208 |
| `town/public/models/ares/shuttle.glb` | 142,993 | 22,080 |
| `town/public/models/ares/rover.glb` | 441,623 | 63,236 |
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

