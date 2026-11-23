(function (C) {
  'use strict';
  /* Space: the walkable world as axis-aligned boxes (building walls, floors, stairs, props) plus circles (trees).
     Pure data and maths, no rendering, so the same collision runs in tests, for the player and for every soldier.
     Boxes come from the collision proxies baked into the Hailstorm building models. */
  const CELL = 8, STEP = 0.45;
  class Space {
    constructor() { this.boxes = []; this.circles = []; this.grid = new Map(); }
    cellKey(i, j) { return i * 4096 + j; }
    _index(o, x0, x1, z0, z1) { for (let i = Math.floor(x0 / CELL); i <= Math.floor(x1 / CELL); i++) for (let j = Math.floor(z0 / CELL); j <= Math.floor(z1 / CELL); j++) { const k = this.cellKey(i, j); let a = this.grid.get(k); if (!a) this.grid.set(k, a = []); a.push(o); } }
    addBox(x0, x1, y0, y1, z0, z1) { const b = { x0, x1, y0, y1, z0, z1 }; this.boxes.push(b); this._index(b, x0, x1, z0, z1); return b; }
    addCircle(x, z, r, h) { const c = { x, z, r, h, circle: true }; this.circles.push(c); this._index(c, x - r, x + r, z - r, z + r); return c; }
    /* Place a building from its collision data. `quarter` = number of 90 degree turns about Y (matches three.js rotation.y = quarter * PI/2). */
    addBuilding(data, x, z, quarter = 0, y = 0) {
      const q = ((quarter % 4) + 4) % 4, out = [];
      for (const [cx, cy, cz, hx, hy, hz] of data.boxes) {
        let wx, wz, ex = hx, ez = hz;
        if (q === 0) { wx = cx; wz = cz; } else if (q === 1) { wx = cz; wz = -cx; ex = hz; ez = hx; } else if (q === 2) { wx = -cx; wz = -cz; } else { wx = -cz; wz = cx; ex = hz; ez = hx; }
        out.push(this.addBox(x + wx - ex, x + wx + ex, y + cy - hy, y + cy + hy, z + wz - ez, z + wz + ez));
      }
      return out;
    }
    _near(x, z, r) { const seen = new Set(), res = []; for (let i = Math.floor((x - r) / CELL); i <= Math.floor((x + r) / CELL); i++) for (let j = Math.floor((z - r) / CELL); j <= Math.floor((z + r) / CELL); j++) { const a = this.grid.get(this.cellKey(i, j)); if (a) for (const o of a) if (!seen.has(o)) { seen.add(o); res.push(o); } } return res; }
    /* Height of the surface a body at (x,z,y) can stand on: the highest box top within step height, else the terrain (0). */
    groundAt(x, z, y) { let g = 0; for (const o of this._near(x, z, 0.1)) { if (o.circle) continue; if (x >= o.x0 && x <= o.x1 && z >= o.z0 && z <= o.z1 && o.y1 <= y + STEP && o.y1 > g) g = o.y1; } return g; }
    /* Move a body (cylinder radius r, height h) in the xz plane, sliding along solid boxes. Mutates and returns pos {x,y,z}. */
    move(pos, dx, dz, r = 0.4, h = 1.75) {
      pos.x += dx; pos.z += dz;
      for (let pass = 0; pass < 3; pass++) {
        let hit = false;
        for (const o of this._near(pos.x, pos.z, r + 0.2)) {
          if (o.circle) { if (pos.y > o.h) continue; const ex = pos.x - o.x, ez = pos.z - o.z, d = Math.hypot(ex, ez), m = r + o.r; if (d < m && d > 1e-6) { pos.x = o.x + ex / d * m; pos.z = o.z + ez / d * m; hit = true; } continue; }
          if (o.y1 <= pos.y + STEP || o.y0 >= pos.y + h) continue;                 // steppable, or overhead
          const nx = Math.max(o.x0, Math.min(pos.x, o.x1)), nz = Math.max(o.z0, Math.min(pos.z, o.z1)); let ex = pos.x - nx, ez = pos.z - nz, d2 = ex * ex + ez * ez;
          if (d2 >= r * r) continue; hit = true;
          if (d2 > 1e-9) { const d = Math.sqrt(d2); pos.x = nx + ex / d * r; pos.z = nz + ez / d * r; }
          else { const l = pos.x - o.x0, rr = o.x1 - pos.x, t = pos.z - o.z0, b = o.z1 - pos.z, m = Math.min(l, rr, t, b); if (m === l) pos.x = o.x0 - r; else if (m === rr) pos.x = o.x1 + r; else if (m === t) pos.z = o.z0 - r; else pos.z = o.z1 + r; }
        }
        if (!hit) break;
      }
      return pos;
    }
    /* Settle vertically: step up onto stairs and floors, fall under gravity otherwise. */
    settle(pos, vy, dt) { const g = this.groundAt(pos.x, pos.z, pos.y); if (pos.y < g) pos.y = Math.min(g, pos.y + 6 * dt + .05); else if (pos.y > g + .02) { vy -= 12 * dt; pos.y += vy * dt; if (pos.y < g) { pos.y = g; vy = 0; } } else vy = 0; return vy; }
  }
  C.Space = Space;
})(Command);
