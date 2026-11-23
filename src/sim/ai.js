(function (C) {
  'use strict';
  const { clamp } = C.util;
  /* EnemyAI: plays one side's higher command. It starts from a historically grounded plan (defenders hold and counter-attack with the reserve;
     attackers advance in two waves behind a barrage) and adapts to casualties, morale and what its own units can see (mem), never to hidden truth.
     Each AI has its own commander traits. On the player's own side it commands only units the player has not taken direct control of. */
  class EnemyAI {
    constructor(battle, side) {
      this.b = battle; this.side = side; const r = battle.rng;
      this.aggression = r.range(.3, .9); this.caution = 1 - this.aggression * .7; this.state = 'wait'; this.lastArt = -999; this.stagingZ = battle.def.trenchZ + 32; this.w2At = null; this.log = [];
      this.t1 = 50 + (1 - this.aggression) * 110;
    }
    mine(filter) { return this.b.units.filter(u => u.side === this.side && u.alive && !u.playerControlled && (!filter || filter(u))); }
    order(u, o) { u.pending.push({ at: this.b.t + 1, order: Object.assign({ fire: 'free' }, o), src: 'ai' }); }
    think() { if (this.b.t % 5 !== 0) return; if (this.side === 'D') this.defend(); else this.attack(); }
    enemyMem() { const m = this.b.mem[this.side], out = []; for (const id in m) if (this.b.t - m[id].t < 60) out.push(Object.assign({ id }, m[id])); return out; }
    defend() {
      const b = this.b, t = b.t, tz = b.def.trenchZ;
      for (const u of this.mine(x => !x.reserve && x.kind !== 'mg' && !x.routed)) { if (u.order.kind !== 'hold' && u.order.kind !== 'cover') this.order(u, { kind: 'hold' }); }
      const res = this.mine(u => u.reserve && !u.committed && !u.routed)[0], threats = this.enemyMem();
      if (res) {
        const weak = this.b.units.filter(u => u.side === 'D' && u.alive && !u.reserve && u.kind !== 'mg' && (u.strength < .5 * u.established || threats.some(e => Math.abs(e.z - tz) < 14 && Math.abs(e.x - u.x) < 25))).sort((a, c) => a.strength - c.strength)[0];
        if (weak) { res.committed = true; this.order(res, { kind: 'advance', tx: weak.x, tz: tz - 8 }); b.note('ai', 'Defenders commit their reserve to a threatened sector.', { side: 'D' }); }
      } else {
        const r2 = this.b.units.find(u => u.side === 'D' && u.reserve && u.committed && u.active && !u.playerControlled); const inTrench = threats.find(e => Math.abs(e.z - tz) < 8 && e.kind !== 'mg');
        if (r2 && inTrench && r2.morale > .5 && r2.strength >= 6 && r2.order.kind !== 'assault') this.order(r2, { kind: 'assault', tx: inTrench.x, tz: inTrench.z });
      }
      const cluster = threats.filter(e => e.z < 25 && e.kind !== 'mg'), sum = cluster.reduce((a, e) => a + e.strength, 0);
      if (b.artillery.D > 0 && t - this.lastArt > 150 && sum >= 20) { const cx = cluster.reduce((a, e) => a + e.x * e.strength, 0) / sum, cz = cluster.reduce((a, e) => a + e.z * e.strength, 0) / sum; const fr = b.units.some(u => u.side === 'D' && u.alive && Math.hypot(u.x - cx, u.z - cz) < 28); if (!fr) { b.callFire('D', cx, cz, 60); this.lastArt = t; } }
    }
    attack() {
      const b = this.b, t = b.t, tz = b.def.trenchZ, w1 = this.mine(u => u.wave === 1 && !u.routed), all1 = b.units.filter(u => u.side === 'A' && u.wave === 1 && u.alive);
      const ratio = all1.reduce((a, u) => a + u.strength, 0) / Math.max(1, all1.reduce((a, u) => a + u.established, 0)), morale = all1.length ? all1.reduce((a, u) => a + u.morale, 0) / all1.length : 0;
      if (this.state === 'wait' && t >= this.t1 - 12 && b.artillery.A > 0 && !this.pre) { this.pre = true; b.callFire('A', 0, tz, 0); }
      if (this.state === 'wait' && t >= this.t1) { this.state = 'stage'; for (const u of w1) this.order(u, { kind: 'advance', tx: u.x, tz: this.stagingZ }); b.note('ai', 'The first wave leaves its trench.', { side: 'A' }); }
      if (this.state === 'stage') {
        const there = w1.every(u => Math.abs(u.z - this.stagingZ) < 6 || u.routed || !u.alive);
        if (ratio < .5 || morale < .33) { this.state = 'stalled'; this.stallT = t; for (const u of w1) this.order(u, { kind: 'cover' }); if (b.artillery.A > 0) { const k = this.enemyMem().filter(e => e.kind !== 'mg')[0]; if (k) b.callFire('A', k.x, k.z, 40); } b.note('ai', 'The first wave goes to ground.', { side: 'A' }); }
        else if (there || t > this.t1 + 110) { this.state = 'assault'; for (const u of w1) this.order(u, { kind: 'assault', tx: u.x, tz: tz + 4 }); b.note('ai', 'The first wave charges.', { side: 'A' }); this.w2At = t + 20 + (1 - this.aggression) * 90; }
      }
      if (this.state === 'stalled') { if (ratio >= .5 && morale > .42 && t - this.stallT > 40) { this.state = 'stage'; for (const u of w1) this.order(u, { kind: 'advance', tx: u.x, tz: this.stagingZ }); } else if (t - this.stallT > 150) { for (const u of w1) this.order(u, { kind: 'withdraw', tx: u.x, tz: 58 }); this.state = 'broken'; b.note('ai', 'The attack is called off.', { side: 'A' }); } }
      if (this.state === 'assault' && this.w2At != null && t >= this.w2At) {
        const w2 = this.mine(u => u.wave === 2 && !u.released && !u.routed), known = this.enemyMem().filter(e => e.kind !== 'mg'); this.w2At = null;
        if (ratio >= .3) for (const u of w2) { const tgtX = known.length ? known.sort((a, c) => a.strength - c.strength)[0].x : u.x; u.released = true; this.order(u, { kind: 'assault', tx: clamp(tgtX, -60, 60), tz: tz + 4 }); }
        b.note('ai', ratio >= .3 ? 'The second wave is thrown in.' : 'The second wave is held back.', { side: 'A' });
      }
    }
  }
  C.EnemyAI = EnemyAI;
})(Command);
