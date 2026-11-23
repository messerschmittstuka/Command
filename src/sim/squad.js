(function (C) {
  'use strict';
  const { clamp } = C.util;
  /* Squad: the physical men of a Section. Each is an agent that walks, collides with the world and obeys orders.
     Orders are not instant: each man responds after a delay, and whether he responds at all depends on the section's
     discipline, morale, cohesion and fatigue (Section.orderResponse), so poor sections visibly lag or ignore commands. */
  const SPEED = { walk: 1.5, march: 2.2, run: 4 };
  class Squad {
    constructor(section, space, env, layout) {
      this.section = section; this.space = space; this.env = env; this.layout = layout;
      this.mode = 'activity'; this.agents = []; this.leader = { x: 0, z: 0, heading: 0 }; this.lastOrder = null; this.sync();
      env.bus.on('hour', () => { if (this.mode === 'activity') this.assignActivity(); });
    }
    sync() { // keep one agent per man of strength
      const s = this.section, bill = this.layout.places.billet;
      while (this.agents.length < s.strength) { const i = this.agents.length; this.agents.push({ i, x: bill.x + (i % 5) * .8 - 1.6, y: 0, vy: 0, z: bill.z + Math.floor(i / 5) * .8, heading: 0, goal: null, delay: 0, ignore: 0, speed: 0, wait: this.env.rng.range(0, 2), pace: this.env.rng.range(.9, 1.1) }); }
      while (this.agents.length > s.strength) this.agents.pop();
    }
    assignActivity() {
      const L = this.layout.places, act = this.section.activityAt(this.env.time.hour), rng = this.env.rng;
      const place = act === 'train' ? L.parade : act === 'sleep' ? L.billet : act === 'duty' ? L.dump : L.yard;
      for (const a of this.agents) { a.goal = { x: place.x + (a.i % 5 - 2) * 1.3 + rng.range(-.5, .5), z: place.z + Math.floor(a.i / 5) * 1.3 + rng.range(-.5, .5), speed: act === 'train' ? 'march' : 'walk' }; a.delay = rng.range(0, 6); }
      this.activity = act;
    }
    /* Slot in a column of twos behind the officer (follow) or a line abreast (extend). */
    slot(i, n, leader, kind) {
      const h = leader.heading, fx = Math.sin(h), fz = Math.cos(h), rx = Math.cos(h), rz = -Math.sin(h);
      if (kind === 'extend') { const off = (i - (n - 1) / 2) * 1.8; return { x: leader.x + fx * 3 + rx * off, z: leader.z + fz * 3 + rz * off }; }
      const row = Math.floor(i / 2), side = i % 2 ? 1 : -1; return { x: leader.x - fx * (2 + row * 1.5) + rx * side * .9, z: leader.z - fz * (2 + row * 1.5) + rz * side * .9 };
    }
    /* Issue an order. Returns {kind, obeyed, ignored, avgDelay} so the interface and tests can see what really happened. */
    order(kind, leader) {
      const resp = this.section.orderResponse(), rng = this.env.rng, n = this.agents.length; this.leader = leader;
      const mode = { follow: 'follow', extend: 'extend', halt: 'halt', dismiss: 'activity' }[kind]; if (!mode) throw new Error('unknown order ' + kind);
      let ignored = 0, total = 0;
      for (const a of this.agents) {
        a.delay = rng.range(.2, 1.2) * (2.2 - 1.6 * resp); total += a.delay;
        if (rng.chance((1 - resp) * .45)) { a.ignore = rng.range(3, 8); ignored++; } else a.ignore = 0;   // misheard, hesitating, or looking the other way
      }
      this.mode = mode; if (mode === 'activity') this.assignActivity();
      this.lastOrder = { kind, obeyed: n - ignored, ignored, avgDelay: total / Math.max(1, n), t: this.env.time.minutes };
      if (ignored > n * .3) this.env.journal.add('section', `${this.section.name}: the order to ${kind} was ragged; several men were slow to react.`, { kind: 'order', ignored });
      return this.lastOrder;
    }
    update(dt, leader) {
      this.leader = leader; this.sync(); const n = this.agents.length;
      for (let i = 0; i < n; i++) {
        const a = this.agents[i]; let gx = null, gz = null, sp = 'walk';
        if (a.ignore > 0) { a.ignore -= dt; } else if (a.delay > 0) { a.delay -= dt; }
        else if (this.mode === 'follow' || this.mode === 'extend') { const s = this.slot(i, n, leader, this.mode); gx = s.x; gz = s.z; const d = Math.hypot(gx - a.x, gz - a.z); sp = d > 6 ? 'run' : d > 2 ? 'march' : 'walk'; if (d < .25) { gx = null; a.heading = leader.heading; } }
        else if (this.mode === 'activity' && a.goal) { if (a.wait > 0) a.wait -= dt; else { gx = a.goal.x; gz = a.goal.z; sp = a.goal.speed; if (Math.hypot(gx - a.x, gz - a.z) < .3) gx = null; } }
        let vx = 0, vz = 0;
        if (gx != null) { const dx = gx - a.x, dz = gz - a.z, d = Math.hypot(dx, dz), v = Math.min(SPEED[sp] * a.pace * (1 - .35 * this.section.fatigue), d / dt); vx = dx / d * v; vz = dz / d * v; a.heading = Math.atan2(vx, vz); }
        a.speed = Math.hypot(vx, vz);
        for (let k = 0; k < n; k++) { if (k === i) continue; const o = this.agents[k], ex = a.x - o.x, ez = a.z - o.z, d2 = ex * ex + ez * ez; if (d2 < .36 && d2 > 1e-6) { const d = Math.sqrt(d2); vx += ex / d * .8; vz += ez / d * .8; } }
        const p = { x: a.x, y: a.y, z: a.z }; this.space.move(p, vx * dt, vz * dt, .35, 1.7); a.x = p.x; a.z = p.z; a.vy = this.space.settle(p, a.vy, dt); a.y = p.y;
      }
    }
  }
  C.Squad = Squad;
})(Command);
