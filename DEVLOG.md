# Command - development log

## Decisions (agreed with the user)
- Fresh codebase. **No Hailstorm code is reused; only its graphic assets** (user instruction, overrides the spec's "reuse code" wording).
- Modular source in `src/`, bundled by `node build.js` into one `dist/index.html` (works on GitHub Pages).
- Vertical slice: **French and German** armies, Verdun, 21 Feb 1916. British added later as data.
- Redoubt is to be removed from this repo (user decision); do at commit time once the repo is renamed to `Command`.
- Tests: `node test/sim.test.js` (headless, same source files as the browser build).

## Stage 1 - simulation core (DONE, tested headlessly)
Files: `src/core/{namespace,util}.js`, `src/data/{ranks,equipment,regiments,difficulty}.js`,
`src/sim/{time,journal,characters,relationships,section,game}.js`, `src/ui/stub.js`, `build.js`, `test/sim.test.js`.
- TimeManager: continuous minutes, hour/day events, scheduled events that interrupt fast-forward.
- Section: morale, fatigue, cohesion, discipline, skills, ammo, equipment; hourly timetable (sleep/duty/train/rest/leisure);
  training gains depend on fatigue, NCO quality (his skill + trust in the officer) and cohesion; replacements dilute cohesion and integrate over days;
  ammo shortage cuts firepower and morale; order response derived from discipline/morale/cohesion/fatigue.
- Relationships: directional trust/respect/friendship/rivalry/loyalty changed by interactions scaled by target personality.
- Superior's deployment review reacts to the officer's earlier rest/training choices in context.
- 14 headless tests pass.

## Stage 2 - rear-area 3D scene (CODE COMPLETE, 28 headless tests pass, NOT yet seen in a browser)
Files: `src/sim/{space,squad,interactions}.js`, `src/data/{layout,colliders}.js`, `src/render/{engine,people,world}.js`, `src/ui/{player,hud,main}.js`, `src/shell.html`, `tools/extract_colliders.js`.
- Village built from Hailstorm `buildings.glb` (houses, ruins, church) + `props_1-3.glb` + three ambientCG textures (downscaled to 512px). Embedded as base64 in the page.
- Collision comes from the `col_*` boxes already baked into the Hailstorm building models (extracted by `tools/extract_colliders.js`): walls block, the front door admits a body, stairs climb to upper floors (tested).
- Player: WASD, mouse look, first/third person (V), speak (E), quick orders 1-4 (follow, extend, halt, dismiss), time controls (T, P, buttons).
- Squad: ten agents obey orders after a delay; ignoring/lagging depends on section discipline, morale, cohesion and fatigue (tested). Otherwise they follow the timetable (parade ground, billet, fatigues).
- Conversations with the NCO and captain read real state: advice from section condition, plans set the real training plan, going against asked-for advice costs trust, ammo/replacement requests are delayed and can be refused, assignment schedules the pre-deployment inspection and the deployment.
- Time: 1 game minute per real second at x1; x10/x60 fast-forward, interrupted by scheduled events.
- Lighting follows the clock.
- Soldiers are primitive boxes (no soldier model exists in the reused assets).

## Known limits / not done
- Rendering has never been run in a real browser by me (no Three.js reachable in my sandbox). Expect visual bugs; the page has an on-screen error box.
- No battle, tactical map, communication system, saving, weather yet.
- Numbers (rates, thresholds) are first-pass and need balancing against play.
- Tests exercise logic only; nothing has been run in a real browser or measured for performance.

## Reused Hailstorm assets (planned, none wired in yet)
Directly: `textures/` (ambientCG CC0 ground sets), `props_1-3.glb` (sandbags, wire, crates, fences, barrels, rubble).
After modification: `buildings.glb` (needs ruined variants and style check); Kar98k/bayonets as reference for a Gewehr 98 (1935 rifle, not period).
Not suitable: Pz IV, T-34, Stuka, Arisaka/Carcano/MAS36 rifles.

## Next
Fix whatever the first browser run shows. Then stage 3: small battlefield (trench/no-man's-land), orders over distance (runner/telephone), fog of war, enemy AI, local vs wider outcome.

## Stage 3 - small playable battle (integrated)
- Simulation: sim/battle.js, comms.js, ai.js, evaluation.js (54 headless tests pass: `node test/sim.test.js`, `node test/battle.test.js`).
- Integration: the stage-2 departure summary now has "March to the line", which builds a battlefield (render/battlefield.js, ui/battle_ui.js) for the Outpost action at Verdun, 22 Feb 1916. Controls: WASD/mouse, V camera, C prone, 1-5 voice orders to your own section, M tactical map (draws only what you know; orders to other sections and artillery/reserve requests travel by runner, voice or telephone), P pause. The aftermath screen reports local vs wider outcome, losses and an assessment of your decisions; results persist into the section and career record, and death is permanent.
- Not verified: no rendering code has been run in a real browser (Three.js could not be loaded in the build sandbox). Expect visual/runtime bugs; the red error box at the bottom shows any script error.
- Balance numbers are first-pass; the German-side centre section is hard to hold/take and needs tuning with real play.
- Still missing from the spec: campaign map, weather, saves/Ironman, regimental history, battle replay, British army, animation fixes for Redoubt.
