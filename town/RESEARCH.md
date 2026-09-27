# Ares town: research

Ideation only, 2026-09-26. Nothing here is built. The goal: the second brain drawn as a
small 3D planet of hexagonal plates, everything 3D, robots as the agent workers, cute and
playable, near zero running cost.

## 1. The world

### The planet is the brain

- **Planet** = `brain.json`. No second data store. The town view reads the same file as the
  graph and outline views and derives everything from it.
- **Continents** = the top-level groups. Each is a contiguous patch of tiles with its own
  biome: Startup path is highlands with towers, OceanAID a coast with docks, UVic a campus
  green, Hackathons a festival ground, Things I built a workshop district, Victoria network a
  harbour town, Self-knowledge a forest garden, Skills an industrial belt with factories and
  wind turbines. Ocean fills the gaps between groups.
- **Buildings** = nodes. The node type picks the model: goal tower, project workshop, person
  house with a mailbox, belief shrine or statue, decision signpost, event plaza, skill machine,
  tool shed, note crate.
- **Roads, rails and bridges** = cross-links. The relation picks the style. Links across
  continents become rail bridges over the water.
- **Growth** = node maturity. Summary only is a hut, a body upgrades it, high confidence plus
  links makes it the full building. Quaternius Ultimate Fantasy RTS ships buildings in
  evolution stages, which maps to this directly.
- **Fog** = open questions and unexplored tiles. Answering one clears the fog.
- **Weather and wear**: low confidence shows scaffolding, 90 days untouched grows moss and the
  lights dim, pinned nodes fly a flag. A real sun light follows the clock so the planet has day
  and night.

### Ares is in orbit

- **Ares HQ** is a space station orbiting the planet. Agents are robots that shuttle down.
- **Courier** (inbox watcher) lands a drop pod on the Inbox pad; crates spill out.
- **Builder** (ingest) raises new buildings.
- **Archivist** (sort) hauls crates from the pad into the right continent.
- **Scout** (search and context pack) is a satellite that sweeps the surface when a Claude
  session calls the brain over MCP, lighting up the buildings it reads.
- **Ares** (the mayor) is the one you talk to, at the station or at the town hall tile.

### Making a hex sphere

- A sphere cannot be tiled with hexagons alone. Subdividing an icosahedron gives hexagons plus
  exactly 12 pentagons (a Goldberg polyhedron). Red Blob Games covers the trade-offs:
  https://www.redblobgames.com/x/1640-hexagon-tiling-of-sphere/
- Tile count for subdivision n is 10n² + 2: n=8 gives 642 tiles, n=10 gives 1002, n=12 gives
  1442. The brain has 76 nodes today, so 642 to 1002 tiles is plenty and leaves ocean.
- **Before We Leave** (Balancing Monkey Games) is a hex-planet city builder that hides its 12
  pentagons under mountains and oceans. We do the same.
- **hexasphere.js** (MIT, no dependencies) generates the tiles: each tile has a centre, ordered
  boundary points and neighbours, and it exports JSON or OBJ.
  https://github.com/arscan/hexasphere.js
- Tiles on a Goldberg sphere are all slightly different, so the plates must be generated
  geometry (extrude each tile's boundary along its normal, which is the normalised centre).
  Hex asset packs are for the decoration on top, not the plate itself.
- **The pixel look** in the reference image is a post-process, not pixel art. Three.js ships
  it as RenderPixelatedPass with depth and normal edge outlines and pixel snapping:
  https://threejs.org/examples/webgl_postprocessing_pixel.html
  It also hides style seams between asset packs, which matters below.
- Other references: Dyson Sphere Program (grid planets with machines and orbit), Astroneer
  (cute planets, bases, machines), Super Mario Galaxy and Outer Wilds (tiny planets),
  Hexplorando (cozy hex builder, Gamescom 2026), Dorfromantik (mood), Deep-Fold's Pixel Planet
  Generator (2D, same feel).

### Engine options

| Option | Fit | Trade-off |
|---|---|---|
| react-three-fiber + drei + postprocessing | Matches TS and React skills, most examples | Build step |
| Plain Three.js from a CDN in a single file | Zero install, same ethos as the brain | More boilerplate |
| Babylon.js | Batteries included | Bigger, less React |
| Godot 4 web export | Real editor | Second toolchain, heavy for a daily tool |

Recommendation: react-three-fiber as a small Vite app served as static files by `brain.py`.

## 2. Asset catalog

Verified 2026-09-26 by fetching each page. Counts are as the pages state them. All Kenney
packs ship GLB, FBX and OBJ (site-level statement). Quaternius packs list glTF only where
marked; older ones are FBX/OBJ/Blend and need a Blender export. KayKit packs ship glTF and use
one 1024 gradient atlas, so they recolour easily.

### Shortlist (what I would actually start with)

| Layer | Pack | Why |
|---|---|---|
| Plates | Generated from hexasphere.js | Sphere tiles are irregular; packs cannot supply them |
| Ground decoration, houses | KayKit Medieval Hexagon Pack, 200+, CC0 | Cutest hex-native set, buildings in 4 colours, roads, rivers, coasts |
| Towns and cities | Kenney City Kit Suburban 40, Commercial 50, Industrial 40; Quaternius Downtown City MegaKit 300+ | Flat, clean, colour variations |
| Space station and orbit | Kenney Space Station Kit 90, Modular Space Kit 40, Quaternius Ultimate Space Kit 92 | Station parts, base domes, rovers, planets |
| Machines | Kenney Factory Kit 140 (conveyors, machines, colour map) | The industrial belt for Skills |
| Satellites | Polyy.AI 3D Satellites Pack, 25, CC0 GLB | Scout |
| Robots | Quaternius Sci-Fi Essentials Kit (animated robots), Animated Mech Pack 4, plus our own | Placeholders until custom robots exist |
| Nature | Quaternius Stylized Nature MegaKit 116; Gobkit Nature 41 (has clouds) | Ghibli-ish trees, 7 leaf variants |
| Crates and resources | KayKit Resource Bits 75+ | Inbox crates, ore piles |
| Rails and bridges | Kenney Train Kit 100; Ward727 Train Pack (Kenney scale) | Cross-continent links |
| Growth stages | Quaternius Ultimate Fantasy RTS 128; Ultimate Crops 102 (5 stages) | Node maturity, question ripening |
| Pets | Kenney Cube Pets 24 (2026, animated) | Life on the planet |

### Hex tiles and terrain

| Pack | Maker | What | Count | glTF | Licence | Link |
|---|---|---|---|---|---|---|
| Hexagon Kit | Kenney | Hex terrain, buildings, colour map and variations (v2) | 70 | GLB | CC0 | https://kenney.nl/assets/hexagon-kit |
| Medieval Hexagon Pack | KayKit | Hex tiles (roads, rivers, coasts), buildings in 4 colours, nature, units | 200+ free, 150+ extra ($9.99) | yes | CC0 | https://kaylousberg.itch.io/kaykit-medieval-hexagon |
| Medieval Builder Pack (legacy) | KayKit | Hex, square and free-placed medieval tiles | 200+ | yes | CC0 | https://kaylousberg.itch.io/kaykit-medieval-builder-pack |
| Block Bits | KayKit | Blocky terrain, diorama, mining blocks | 32+ | yes | CC0 | https://kaylousberg.itch.io/block-bits |
| Free Hexagon Tileset | Xeeh | Hex tiles, 3 heights, biomes, props | 45+ | no, OBJ | CC0 | https://xeeh.itch.io/free-hexagon-tileset |

### Houses, towns, cities

| Pack | Maker | What | Count | glTF | Licence | Link |
|---|---|---|---|---|---|---|
| City Kit (Suburban) | Kenney | Suburban houses, v2 remade | 40 | GLB | CC0 | https://kenney.nl/assets/city-kit-suburban |
| City Kit (Commercial) | Kenney | Skyscrapers and shops | 50 | GLB | CC0 | https://kenney.nl/assets/city-kit-commercial |
| City Kit (Roads) | Kenney | Roads, signs, traffic lights | 90 | GLB | CC0 | https://kenney.nl/assets/city-kit-roads |
| City Kit (Industrial) | Kenney | Factories, warehouses, solar and wind (2025) | 40 | GLB | CC0 | https://kenney.nl/assets/city-kit-industrial |
| Modular Buildings | Kenney | Modular town houses, v2 remake | 100 | GLB | CC0 | https://kenney.nl/assets/modular-buildings |
| Building Kit | Kenney | Buildings and structures (2024) | 80 | GLB | CC0 | https://kenney.nl/assets/building-kit |
| Fantasy Town Kit | Kenney | Medieval town, walls, v2 remade | 160 | GLB | CC0 | https://kenney.nl/assets/fantasy-town-kit |
| Castle Kit | Kenney | Castle pieces, v2 remake | 75 | GLB | CC0 | https://kenney.nl/assets/castle-kit |
| Holiday Kit | Kenney | Cabins, snow, trees, v2 remade | 100 | GLB | CC0 | https://kenney.nl/assets/holiday-kit |
| Retro Urban Kit | Kenney | Retro city look (different style) | 120 | GLB | CC0 | https://kenney.nl/assets/retro-urban-kit |
| Retro Fantasy Kit | Kenney | Retro castle and town (different style) | 100 | GLB | CC0 | https://kenney.nl/assets/retro-fantasy-kit |
| Tower Defense Kit | Kenney | Towers, tiles, turrets | 160 | GLB | CC0 | https://kenney.nl/assets/tower-defense-kit |
| Pirate Kit | Kenney | Ships, islands, tropical props | 70 | GLB | CC0 | https://kenney.nl/assets/pirate-kit |
| Medieval Village MegaKit | Quaternius | Grid-snapping roofs, walls, stairs, vines (2025) | 304 | yes | CC0 | https://quaternius.com/packs/medievalvillagemegakit.html |
| Downtown City MegaKit | Quaternius | Modular city blocks, shared textures (May 2026) | 300+ | yes | CC0 | https://quaternius.com/packs/downtowncitymegakit.html |
| Ultimate Fantasy RTS | Quaternius | Buildings in evolution stages plus nature | 128 | yes | CC0 | https://quaternius.com/packs/ultimatefantasyrts.html |
| Ultimate Buildings Pack | Quaternius | Modular buildings, swappable palette atlases | 76 | no | CC0 | https://quaternius.com/packs/ultimatetexturedbuildings.html |
| Cyberpunk Game Kit | Quaternius | Animated character, platforms, turrets | 71 | yes | CC0 | https://quaternius.com/packs/cyberpunkgamekit.html |
| Farm Buildings Pack | Quaternius | Farm buildings | 13 | no | CC0 | https://quaternius.com/packs/farmbuildings.html |
| City Builder Bits | KayKit | City buildings for builder and RTS games | 32+ (+16 park, paid) | yes | CC0 | https://kaylousberg.itch.io/city-builder-bits |
| Low-Poly 3D Buildings | FreePixel.Art | Castles, taverns, towers, houses (100 MB) | 12 | GLB | custom, commercial OK | https://freepixelart.itch.io/low-poly-3d-buildings-12-glb-models |
| Cozy Village | threejsassets.com | Cottages, shops, roads, gardens, 10 prebuilds, Draco GLB, 511 KB | 91 | GLB | one person or team, no redistribution | https://threejsassets.com/packs/cozy-village ($29) |
| Other threejsassets packs | threejsassets.com | Railway 132, Suburban 63, City 66, Metropolis 87, Farm 66, Arctic Station 62, Viking Fjord 63 | 22 packs | GLB | same | https://threejsassets.com/packs ($29 to $59, $197 lifetime) |
| POLYGON Town | Synty | 125 buildings, 412 props, 8 vehicles | 636 | no, FBX | Synty one-time licence | https://syntystore.com/products/polygon-town-pack ($49.99) |

### Space stations, bases, orbit

| Pack | Maker | What | Count | glTF | Licence | Link |
|---|---|---|---|---|---|---|
| Space Kit | Kenney | Planets, ships, buildings, rocks, ores, characters | 150 | GLB | CC0 | https://kenney.nl/assets/space-kit |
| Space Station Kit | Kenney | Station pieces, bridges, quarters (2024) | 90 | GLB | CC0 | https://kenney.nl/assets/space-station-kit |
| Modular Space Kit | Kenney | Modular station tiles, animation and variations (2026) | 40 | GLB | CC0 | https://kenney.nl/assets/modular-space-kit |
| Ultimate Space Kit | Quaternius | Astronauts, mechs, planets, rovers, ships, base pieces, domes, solar panels | 92 | yes | CC0 | https://quaternius.com/packs/ultimatespacekit.html |
| Modular Sci-Fi MegaKit | Quaternius | Grid-snapping corridors, rooms, platforms | 270+ | yes | CC0 | https://quaternius.com/packs/modularscifimegakit.html |
| Sci-Fi Essentials Kit | Quaternius | Animated robot enemies, screens, crates | 65 | yes | CC0 | https://quaternius.com/packs/scifiessentialskit.html |
| Ultimate Spaceships Pack | Quaternius | 10 ships in 5 colours | 10 | yes | CC0 | https://quaternius.com/packs/ultimatespaceships.html |
| Space Base Bits | KayKit | Modular space base, mining colony | 48+ (+12 paid) | yes | CC0 | https://kaylousberg.itch.io/space-base-bits |
| 3D Satellites Pack | Polyy.AI | Comms, weather, radar satellites, telescopes, probes (PBR, LODs) | 25 | GLB | CC0 | https://polyyai.itch.io/3d-satellites-pack |
| 3D Spaceships Pack 1 and 2 | Polyy.AI | Fighters, miners, cruisers (PBR, higher poly) | 35 + 25 | GLB | CC0 | https://polyyai.itch.io/3d-spaceships-pack |
| Free Pack 3D Game Assets | MetaWorldOS | Spaceship hull, asteroids, hazard drones, gate | 20 | GLB Draco | mostly CC0, some CC BY | https://metaworldos.itch.io/pack-3d-game-assets-glb-for-unity-godot-threejs |
| Low Poly Planets Pack | Heck | Earth, Moon, Mars, gas giants | 10 | no, FBX/OBJ | CC0 | https://heckinghecker.itch.io/low-poly-planets-pack |
| Solar System and Astronauts; Rocket Launch Pad | 3dassets.dev | Planetary bodies, astronauts; launch pad kit | 49; 64 | GLB | CC0 | https://3dassets.dev/packs |
| Low-Poly Space Station (3December) | Šimon Ustal, Sketchfab | Game-ready station, 9.5k tris | 1 | yes | CC BY 4.0 | https://sketchfab.com/3d-models/low-poly-space-station-3december-df0259b2555d41fabed95c2fdcf23daa |
| Low-Poly Space Station | ThatRandomThinkr, Sketchfab | Tiny station, 642 tris | 1 | yes | CC BY 4.0 | https://sketchfab.com/3d-models/low-poly-space-station-for-low-poly-games-8b7ca0079a6e487089bb13ca4ff8048e |
| Low Poly Space Station | Anaïs3Dcraft, Sketchfab | Modular station with docking, 4.7k faces | 1 | yes | CC BY | https://sketchfab.com/3d-models/low-poly-space-station-a9c8166a582444719a9b149b5bd6db6b |
| Low Poly Space Sci-Fi Pack | Akochan | Rockets, planets, satellites, astronauts | 46 | GLB | royalty-free, no resale | https://akochan-lu.itch.io/low-poly-space-scifi-pack-46 ($2.99) |
| POLYGON Sci-Fi Space | Synty | Ships, stations, planets, 20 characters incl. robots | 660 | no, FBX | Synty licence | https://syntystore.com/products/polygon-sci-fi-space-pack ($149.99) |

### Machines, factories, industry

| Pack | Maker | What | Count | glTF | Licence | Link |
|---|---|---|---|---|---|---|
| Factory Kit | Kenney | Conveyors, warehouse machines, colour map, animation (v3 remade) | 140 | GLB | CC0 | https://kenney.nl/assets/factory-kit |
| City Kit (Industrial) | Kenney | Factories, warehouses, solar and wind | 40 | GLB | CC0 | https://kenney.nl/assets/city-kit-industrial |
| Coaster Kit | Kenney | Rides and track, whimsical machines | 180 | GLB | CC0 | https://kenney.nl/assets/coaster-kit |
| Marble Kit | Kenney | Marble run tracks, good for pipeline visuals | 160 | GLB | CC0 | https://kenney.nl/assets/marble-kit |
| Steampunk Turret Pack | Quaternius | 37 steampunk machines | 37 | no | CC0 | https://quaternius.com/packs/turretpack.html |
| RPG Tools Bits | KayKit | Anvils, wrenches, pickaxes, lanterns | 45+ | yes | CC0 | https://kaylousberg.itch.io/rpg-tools-bits |
| Resource Bits | KayKit | Wood, stone, ore, textile, fuel piles | 75+ | yes | CC0 | https://kaylousberg.itch.io/resource-bits |
| Robots and Drones Kit | 3dassets.dev | Robots and drones (rigging not stated) | 53 | GLB | CC0 | https://3dassets.dev/packs |
| Low Poly Sci-Fi Industrial Props | Assets.fun | Containers, generators, piping, catwalks, server racks | not stated | not stated | not stated | https://assetsdotfun.itch.io/low-poly-sci-fi-industrial-props-pack |
| Sci-Fi Industrial Asset Pack | Conejos3D | Customisable colour industrial objects | 13 | not stated | not stated | https://conejos3d.itch.io/sci-fi-industrial-asset-pack-low-poly-customizable-colors-14-objects |
| Industrial pack | Akochan | Industrial props | 60 | GLB | royalty-free | via https://akochan-lu.itch.io ($2.99+) |
| POLYGON Mech Pack | Synty | Modular mechs, rigged | 148 | no, FBX | Synty licence | https://syntystore.com/products/polygon-mech-pack ($99.99) |

### Vehicles: cars, trains, boats, rockets

| Pack | Maker | What | Count | glTF | Licence | Link |
|---|---|---|---|---|---|---|
| Car Kit | Kenney | Cars, kart racers | 45 | GLB | CC0 | https://kenney.nl/assets/car-kit |
| Toy Car Kit | Kenney | Toy cars and track | 100 | GLB | CC0 | https://kenney.nl/assets/toy-car-kit |
| Train Kit | Kenney | Trains, trams, tracks (2024) | 100 | GLB | CC0 | https://kenney.nl/assets/train-kit |
| Watercraft Kit | Kenney | Boats and ships | 45 | GLB | CC0 | https://kenney.nl/assets/watercraft-kit |
| Racing Kit | Kenney | Track tiles and cars | 110 | GLB | CC0 | https://kenney.nl/assets/racing-kit |
| 3D Road Tiles | Kenney | Road tiles | 300 | GLB | CC0 | https://kenney.nl/assets/3d-road-tiles |
| Train Pack | Ward727 | Train, rail, containers, sized to Kenney City Kit | not stated | GLB | CC0 | https://ward727.itch.io/train-pack |
| Low Poly Cars | Cosmo | Stylised cars, one atlas | 12 free | yes | CC0 | https://cosmo-art.itch.io/low-poly-cars |
| Tiny Traffic | Retgun | Cars and trucks | 10 | GLB | credit required, no AI use | https://retgun.itch.io/tiny-traffic-low-poly-stylized-cars-trucks-for-gamedev |
| Cars, Public Transport, Modular Train, Ships | Quaternius | Small older packs | 8, 12, 15, 6 | no | CC0 | https://quaternius.com |

### Nature, weather, growth

| Pack | Maker | What | Count | glTF | Licence | Link |
|---|---|---|---|---|---|---|
| Nature Kit | Kenney | Trees, rocks, foliage | 330 | GLB | CC0 | https://kenney.nl/assets/nature-kit |
| Survival Kit | Kenney | Camp and nature props | 80 | GLB | CC0 | https://kenney.nl/assets/survival-kit |
| Mini Forest | Kenney | Forest, tents, base (2026) | 20 | GLB | CC0 | https://kenney.nl/assets/mini-forest |
| Stylized Nature MegaKit | Quaternius | 40 trees, 35 plants, 27 rocks, 7 leaf variants | 116 | yes | CC0 | https://quaternius.com/packs/stylizednaturemegakit.html |
| Ultimate Stylized Nature | Quaternius | Nature with textures and normal maps | 63 | yes | CC0 | https://quaternius.com/packs/ultimatestylizednature.html |
| Ultimate Nature Pack | Quaternius | Trees, rocks, plants, several biomes | 150 | no | CC0 | https://quaternius.com/packs/ultimatenature.html |
| Ultimate Crops Pack | Quaternius | Crops in 5 growth stages | 102 | no | CC0 | https://quaternius.com/packs/ultimatecrops.html |
| Forest Nature Pack | KayKit | Trees, bushes, rocks, grass, terrain | 100+ | yes | CC0 | https://kaylousberg.itch.io/kaykit-forest |
| Free Low-Poly Nature Kit | Gobkit | Trees, cliffs, mountains, clouds, one texture | 41 | GLB | CC0 | https://gobkit.itch.io/gobkit-free-low-poly-nature-kit-41-cc0-environment-assets-glb |
| Pine Trees | happykeys | Pine groups | 1 file | GLB | CC0 | https://happykeys.itch.io/pine-trees |
| POLYGON Nature | Synty | Trees, terrain, water shader | not stated | no, FBX | Synty licence | https://syntystore.com/products/polygon-nature-pack ($49.99) |

### Characters, robots, animals

| Pack | Maker | What | Count | glTF | Licence | Link |
|---|---|---|---|---|---|---|
| Animated Robot Pack | Quaternius | One cute animated robot | 1 | no (glTF on Poly Pizza) | CC0 | https://quaternius.com/packs/animatedrobot.html |
| Animated Mech Pack | Quaternius | 4 mechs with animation sets, textured | 4 | yes | CC0 | https://quaternius.com/packs/animatedmech.html |
| Sci-Fi Essentials Kit | Quaternius | Animated robot enemies | 65 | yes | CC0 | https://quaternius.com/packs/scifiessentialskit.html |
| Animated Alien Pack | Quaternius | Cute animated aliens | 2 | no | CC0 | https://quaternius.com/packs/animatedalien.html |
| Modular Low-Poly Robot (Rigged) | SagePeeker, Sketchfab | Rigged stylised robot, 944 tris | 1 | yes | CC BY 4.0 | https://sketchfab.com/3d-models/modular-low-poly-robot-character-rigged-92b59e83f55d4f8f9f9f455cb4c12f80 |
| Cute Home Robot | Yandrack, Sketchfab | Wheeled home robot, 1 animation | 1 | yes | CC BY | https://sketchfab.com/3d-models/cute-home-robot-7b75f204eb3e42b6babd883773e0789d |
| cute robot | Paleo Modelist, Sketchfab | Simple robot, 1 animation | 1 | yes | CC BY | https://sketchfab.com/3d-models/cute-robot-6aadb75f596742ada2814ad4593f0032 |
| Futuristic flying robot | Shayan, Sketchfab | EVE-like flyer, 1 animation | 1 | yes | CC BY | https://sketchfab.com/3d-models/futuristic-flying-animated-robot-low-poly-c5b92c281dc444448e64c0607719c7a2 |
| Rigged robot | joney_lol, Poly Pizza | Rigged sci-fi robot | 1 | yes | CC BY 3.0 | https://poly.pizza/m/BwjA6Thdzd |
| A8-Lo-T | Dreamloft3D | Axolotl-styled robot, unrigged | 1 | GLB | free with credit | https://dreamloft3d.itch.io/a8-lo-t-free-retro-low-poly-3d-model |
| Y Bot / X Bot | Adobe Mixamo | Mannequin robots, auto-rig, 2000+ animations | 2 | no, FBX | royalty free, no redistribution as packs | https://www.mixamo.com |
| Mini Characters | Kenney | Small people, animated (2024) | 25 | GLB | CC0 | https://kenney.nl/assets/mini-characters |
| Blocky Characters | Kenney | Blocky people, v2 remade | 20 | GLB | CC0 | https://kenney.nl/assets/blocky-characters |
| Animated Characters (3 packs) | Kenney | Rigged people | 8 each | GLB | CC0 | https://kenney.nl/assets/animated-characters-protagonists |
| Cube Pets | Kenney | Dogs, cats, animals, animated (2026) | 24 | GLB | CC0 | https://kenney.nl/assets/cube-pets |
| Ultimate Animated Character Pack | Quaternius | 50+ animated characters | 52 | no | CC0 | https://quaternius.com/packs/ultimatedanimatedcharacter.html |
| Universal Base Characters + Animation Library 1 and 2 | Quaternius | 6 bodies, 20 hairstyles, 250+ animations | 26 + 250 | yes | CC0 | https://quaternius.com/packs/universalbasecharacters.html |
| Ultimate Animated Animal Pack | Quaternius | 12 animals, 12+ animations each | 12 | yes | CC0 | https://quaternius.com/packs/ultimateanimatedanimals.html |
| Adventurers, Skeletons, Character Animations | KayKit | Rigged characters, 161 animations | 5, 4, 161 | yes | CC0 | https://kaylousberg.itch.io/kaykit-adventurers |
| Free Minions, Animal Pack B | Gobkit | Rigged minions and animals with idle, walk, attack | 8, 10 | GLB | CC0 | https://gobkit.com/freebies |
| Sidekick Sci-Fi Robots | Synty | 140 modular rigged robot parts | 140 | no, Unity/Unreal only | Synty licence | https://syntystore.com/products/sci-fi-robots-sidekick-modular-characters ($199.99) |

Custom robots stay the plan: primitives built in code first, then Blockbench (free, exports
glTF with animation) once the silhouette is settled. AI generators need an NVIDIA card locally
and the hosted free tiers carry licence strings, so they are a last resort.

### Props, resources, game feel

| Pack | Maker | What | Count | glTF | Licence | Link |
|---|---|---|---|---|---|---|
| Resource Bits | KayKit | Wood, stone, ore, textile, fuel piles | 75+ | yes | CC0 | https://kaylousberg.itch.io/resource-bits |
| Board Game Bits | KayKit | Meeples, tokens, dice, cards (UI markers) | 75+ | yes | CC0 | https://kaylousberg.itch.io/board-game-bits |
| Furniture Bits, Restaurant Bits, Halloween Bits, Holiday Bits, Mixed Bag 1 | KayKit | Interiors, food, spooky, presents and a train, misc | 50+, 140+, 60+, 55+, 16+ | yes | CC0 | https://kaylousberg.itch.io |
| Platformer Kit | Kenney | Coins, gems, flags, characters | 150 | GLB | CC0 | https://kenney.nl/assets/platformer-kit |
| Food Kit, Furniture Kit, Mini Market, Mini Arcade | Kenney | Props | 200, 140, 20, 20 | GLB | CC0 | https://kenney.nl/assets/food-kit |
| Graveyard Kit | Kenney | Spooky props, animated (v5) | 90 | GLB | CC0 | https://kenney.nl/assets/graveyard-kit |
| Blaster Kit | Kenney | Crates, targets, smoke | 40 | GLB | CC0 | https://kenney.nl/assets/blaster-kit |
| Fantasy Props MegaKit | Quaternius | Stalls, chests, tools, potions, furniture (2025) | 211 | yes | CC0 | https://quaternius.com/packs/fantasypropsmegakit.html |
| Survival Pack, Ultimate RPG, Ultimate Food | Quaternius | Props | 53, 106, 100+ | no | CC0 | https://quaternius.com |

### Aggregators and pipelines

| Source | What | Licence | Link |
|---|---|---|---|
| Poly Pizza | 10,700+ low-poly models, licence dropdown, animated toggle; API returns a direct .glb URL, free hobby key | CC0 and CC BY per model | https://poly.pizza/explore |
| 3dassets.dev | 22,849 GLB, WebP textures, quantised, CDN and REST API, no login; quality unchecked, sample a few first | CC0 | https://3dassets.dev/packs |
| Sketchfab | Filter Downloadable + CC0 or CC BY; login to download; API `api.sketchfab.com/v3/search?type=models&downloadable=true&license=cc0` works | per model | https://sketchfab.com/search |
| pmndrs market | Web-ready CC0 models, textures, HDRIs for react-three-fiber | CC0 | https://github.com/pmndrs/market |
| Gobkit freebies | 79 CC0 GLB with a JSON manifest | CC0 | https://gobkit.com/freebies |
| OpenGameArt 3D | 4,946 entries, licence checkboxes, no glTF filter | per entry | https://opengameart.org/art-search-advanced?field_art_type_tid%5B%5D=10 |
| awesome-cc0 | Curated list: The Base Mesh, Polyhaven, Smithsonian, Retro3D PSX, more | CC0 | https://github.com/madjin/awesome-cc0 |
| Kenney All-in-1 | Every Kenney pack in one download, 60,000+ assets, future packs included | CC0 | https://kenney.itch.io/kenney-game-assets ($19.95) |
| Synty Humble Bundle, Best of Synty 6 (posted 23 Sep 2026) | 13 items incl. SIMPLE Buildings, Prototype, Particle FX, Alpine Nature, Viking Realm, Shops | Synty licence, FBX | https://syntystore.com/products/humble-bundle-the-best-of-synty-game-dev-assets-6 ($30) |

### Gotchas

- **Style seams.** Kenney, KayKit and Quaternius are all flat low-poly but with different
  palettes and scales. Pick one family per layer and unify colours: Kenney colour maps, the
  KayKit gradient atlas and Quaternius atlases all recolour. The pixelation pass hides the rest.
- **Scale.** Ward727 trains match Kenney City Kit. No page states KayKit vs Kenney hex tile
  size, so measure and scale in code.
- **PBR packs** (Polyy.AI satellites and ships) are textured and 3.5k to 137k triangles. They
  will not match flat-shaded packs without the pixel pass, and need the LOD variants.
- **Licences.** CC BY needs a credit line (title, author, link). Sketchfab "Free Standard" is
  not CC. Poly Pizza mixes CC0 and CC BY; filter. Several itch pages state no licence
  (Dipper98, whynomakethings, Unemployed_Engineer, Assets.fun, Conejos3D): treat as all rights
  reserved until the author answers. Tiny Traffic requires credit and forbids AI use.
- **Synty** ships FBX plus engine packages only, never glTF, and the licence forbids sharing
  source files outside the team while never naming web or browser use. Ask support before
  buying for a web app. Sidekick Robots has no FBX at all.
- **Eclair Assets "GLB packs"** on itch are repackaged Kenney kits. Legitimate, but not new.
- **glTF gaps.** Quaternius packs from before about 2021 (Ultimate Nature, Crops, Buildings,
  Turrets, Cars) are FBX/OBJ/Blend and need a Blender export.
