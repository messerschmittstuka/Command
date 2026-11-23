/* Reads the collision boxes baked into Hailstorm's buildings.glb (nodes named col_*, size-2 cubes so scale = half extents)
   and writes src/data/colliders.js so the simulation can walk through doors and up stairs without parsing GLB at runtime. */
const fs = require('fs'), path = require('path');
const d = fs.readFileSync(path.join(__dirname, '../assets/buildings.glb')); const n = d.readUInt32LE(12); const j = JSON.parse(d.slice(20, 20 + n).toString());
const out = {};
for (const ri of j.scenes[0].nodes) {
  const root = j.nodes[ri]; const boxes = [];
  for (const ci of root.children || []) { const c = j.nodes[ci]; if (!/^col_/.test(c.name || '') || c.mesh != null) continue;
    const t = c.translation || [0, 0, 0], s = c.scale || [1, 1, 1]; boxes.push([t[0], t[1], t[2], s[0], s[1], s[2]].map(v => Math.round(v * 1000) / 1000)); }
  const m = /^bld_(\w+?)_(?:i\d_)?w(\d+)_d(\d+)/.exec(root.name) || []; out[root.name] = { kind: m[1], w: +m[2], d: +m[3], boxes };
}
fs.writeFileSync(path.join(__dirname, '../src/data/colliders.js'), '(function (C) { C.data = C.data || {}; C.data.colliders = ' + JSON.stringify(out) + '; })(Command);\n');
for (const k in out) console.log(k, out[k].boxes.length, 'boxes');
