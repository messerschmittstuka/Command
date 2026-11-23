(function (C) {
  'use strict';
  const { clamp } = C.util;
  /* Comms: how orders and information travel. Nothing is instant except a shout to your own section within earshot.
     Orders to other units go by runner and can be late, garbled, or lost; reports flow back the same way, with noise, so the player's
     picture of the battle (his `know`) is always delayed and imperfect. The tactical map draws ONLY `know`, never the true state. */
  const RUNNER_SPEED = 3.8, VOICE = 35;
  class Comms {
    constructor(b) { this.b = b; this.runners = []; this.reports = []; this.inbox = []; this.nextId = 1; this.know = { enemies: {}, friends: {} }; this.phoneCut = false; this.sentOrders = []; this.phoneT = 0; }
    get rng() { return this.b.rng; }
    msg(from, text, kind) { this.inbox.push({ t: this.b.t, from, text, kind: kind || 'report' }); this.b.note('msg', `${from}: ${text}`, { kind }); }
    nearHQ() { const h = this.b.def.hq[this.b.playerSide], p = this.b.player; return Math.hypot(h.x - p.x, h.z - p.z) < 8; }
    knownPos(unit) { const f = this.know.friends[unit.id]; return f ? { x: f.x, z: f.z } : { x: unit.x, z: unit.z }; }
    /* Player gives an order to one of his side's units. Returns how it is travelling. */
    order(unitId, order) {
      const b = this.b, u = b.units.find(x => x.id === unitId); if (!u || u.side !== b.playerSide || !u.alive) return null;
      const record = { t: b.t, unit: unitId, order: Object.assign({}, order), ctx: this.context(u, order) }; this.sentOrders.push(record); u.playerControlled = true; let via;
      if (u.isPlayerUnit && Math.hypot(u.x - b.player.x, u.z - b.player.z) <= VOICE) { via = 'voice'; this.deliver(u, order, 'player', b.t + this.rng.int(1, 3), record); }
      else { via = 'runner'; const kp = this.knownPos(u); this.runners.push({ id: this.nextId++, x: b.player.x, z: b.player.z, tx: kp.x, tz: kp.z, kind: 'order', unitId, payload: order, record, age: 0, alive: true }); }
      record.via = via; return { via };
    }
    /* What the player believed when he gave the order: used later to judge the decision fairly. */
    context(u, order) {
      const tx = order.tx != null ? order.tx : u.x, tz = order.tz != null ? order.tz : u.z; let est = 0, seen = 0;
      for (const id in this.know.enemies) { const k = this.know.enemies[id]; if (Math.hypot(k.x - tx, k.z - tz) < 90 && this.b.t - k.t < 90) { est += k.strength; seen++; } }
      let truth = 0; for (const e of this.b.units) if (e.side !== u.side && e.alive && Math.hypot(e.x - tx, e.z - tz) < 90) truth += e.strength;
      return { knownEnemy: est, knownContacts: seen, trueEnemy: truth, unitStrength: u.strength, unitMorale: u.morale, unitSup: u.sup, ammo: u.rounds / Math.max(1, u.strength), hqOrder: this.hqOrderFor(u) };
    }
    hqOrderFor(u) { return this.b.side && null; }
    /* The unit's leader interprets the order: he may understand it, be slow, misread it, or use his own initiative. */
    deliver(u, order, src, at, record) {
      const b = this.b, L = u.leader, outcome = { kind: 'ok' };
      if (!L.alive) { outcome.kind = 'no_leader'; }
      if (u.routed && !(L.reliability > .8 && u.morale > .25)) outcome.kind = 'routed';
      else if (u.sup > .6 && u.morale < .3 && this.rng.chance(.5)) outcome.kind = 'pinned';
      else if (L.initiative > .7 && (order.kind === 'assault' || order.kind === 'advance') && u.strength < .4 * u.established && this.rng.chance(.6)) outcome.kind = 'initiative_hold';
      else if (!this.rng.chance(clamp(.55 + .4 * L.reliability - (u.sup > .3 ? .1 : 0)))) outcome.kind = this.rng.chance(.5) ? 'late' : 'misread';
      let applied = order;
      if (outcome.kind === 'late') at += this.rng.int(25, 45);
      if (outcome.kind === 'misread') applied = { kind: 'hold', fire: 'free' };
      if (outcome.kind === 'initiative_hold') applied = { kind: 'hold', fire: 'free' };
      if (outcome.kind === 'routed' || outcome.kind === 'pinned' || outcome.kind === 'no_leader') applied = null;
      if (applied) u.pending.push({ at, order: applied, src });
      if (record) record.outcome = outcome.kind;
      b.note('order_delivered', `${u.name}: ${order.kind} -> ${outcome.kind}`, { unit: u.id, outcome: outcome.kind });
      if (src === 'player') { const text = { ok: `Understood: ${order.kind}.`, late: `Order ${order.kind} received late.`, misread: `Order ${order.kind} was misunderstood; holding.`, initiative_hold: `We are too few to ${order.kind}; holding on my own judgement.`, routed: `The section has broken and cannot carry out the order.`, pinned: `Pinned down; cannot move.`, no_leader: `No leader left to receive the order.` }[outcome.kind];
        this.reports.push({ arrive: b.t + Math.round(Math.hypot(u.x - b.player.x, u.z - b.player.z) / 3 + 4), from: u.leader.name, text, kind: 'ack' }); }
      return outcome;
    }
    request(kind, x, z) {
      const b = this.b, p = b.player, h = b.def.hq[b.playerSide]; let delay, via;
      if (this.nearHQ() && !this.phoneCut) { via = 'phone'; delay = this.rng.int(10, 25); this.runners.push({ id: this.nextId++, x: h.x, z: h.z, tx: h.x, tz: h.z, kind: 'request', req: { kind, x, z }, age: -delay, alive: true, phone: true, silent: true }); }
      else { via = 'runner'; this.runners.push({ id: this.nextId++, x: p.x, z: p.z, tx: h.x, tz: h.z, kind: 'request', req: { kind, x, z }, age: 0, alive: true }); }
      b.note('request', `You request ${kind}${x != null ? ` on (${Math.round(x)}, ${Math.round(z)})` : ''} via ${via}.`, { kind, via, x, z }); return { via };
    }
    /* The captain decides, with his own information and priorities, not the player's. */
    captainDecides(req) {
      const b = this.b, side = b.playerSide, cap = 'Capt. ' + b.game.superior.name, rel = b.game.env.relationships.get(b.game.superior.id, b.game.player.id);
      if (req.kind === 'artillery') {
        if (b.artillery[side] <= 0) return this.msg(cap, 'No guns to spare. The battery is out of shells.', 'refusal');
        let tx = req.x, tz = req.z, shifted = false; const friends = b.units.filter(u => u.side === side && u.alive);
        const nearest = friends.map(f => ({ f, d: Math.hypot(f.x - tx, f.z - tz) })).sort((a, c) => a.d - c.d)[0];
        if (nearest && nearest.d < 32) { const ang = Math.atan2(tz - nearest.f.z, tx - nearest.f.x); tx = nearest.f.x + Math.cos(ang) * 45; tz = nearest.f.z + Math.sin(ang) * 45; shifted = true; }
        const delay = this.rng.int(70, 140); b.callFire(side, tx, tz, delay); b.stats.artilleryRequests = (b.stats.artilleryRequests || 0) + 1;
        return this.msg(cap, shifted ? `Guns will fire, but I have shifted the target away from our own men. About ${delay} seconds.` : `Guns will fire on your target in about ${delay} seconds.`, 'approval');
      }
      if (req.kind === 'reinforce') {
        const pool = b.units.filter(u => u.side === side && !u.isPlayerUnit && u.alive && !u.routed && (side === 'D' ? u.reserve && !u.committed : u.wave === 2 && !u.released));
        if (!pool.length) return this.msg(cap, 'There is nothing left to send you.', 'refusal');
        const need = u => 1 - u.strength / u.established + (b.enemies(u).some(e => Math.hypot(e.x - u.x, e.z - u.z) < 40) ? .3 : 0);
        const mine = need(b.pu), others = Math.max(0, ...b.units.filter(u => u.side === side && !u.isPlayerUnit && !u.reserve && u.wave !== 2 && u.alive && u.kind !== 'mg').map(need));
        if (mine + .15 * (rel.respect - .5) < others) return this.msg(cap, 'The reserve is needed elsewhere on the line. Hold on.', 'refusal');
        const r = pool[0], dly = this.rng.int(50, 110); r.committed = r.released = true; r.playerControlled = false;
        b.units.find(x => x === r).pending.push({ at: b.t + dly, order: { kind: 'advance', tx: b.pu.x + (b.playerSide === 'D' ? 6 : -6), tz: b.pu.z + (b.playerSide === 'D' ? -6 : 8), fire: 'free' }, src: 'hq' });
        return this.msg(cap, `${r.name} is on its way to you. A minute or two.`, 'approval');
      }
    }
    /* Reports from units flow to the player after a travel delay. */
    status(u) {
      const b = this.b, L = u.leader, noisy = (v, s) => v + (this.rng.next() - .5) * 2 * s, rel = 1 - L.reliability * .8;
      const enemies = [...u.sees].map(id => b.units.find(x => x.id === id)).filter(Boolean).map(e => ({ id: e.id, x: noisy(e.x, 4 + 8 * rel), z: noisy(e.z, 4 + 8 * rel), strength: Math.max(1, Math.round(noisy(e.strength, 1 + 3 * rel))), kind: e.kind }));
      const d = Math.hypot(u.x - b.player.x, u.z - b.player.z), delay = Math.round(4 + d / 2.5);
      this.reports.push({ arrive: b.t + delay, gen: b.t, from: L.name, kind: 'status', friend: { id: u.id, x: noisy(u.x, 2 + 4 * rel), z: noisy(u.z, 2 + 4 * rel), strength: Math.max(1, Math.round(noisy(u.strength, 1.5 * rel + .5))), morale: u.morale, routed: u.routed, ammoLow: u.rounds < u.strength * 30 }, enemies });
    }
    tick() {
      const b = this.b, t = b.t, pl = b.player;
      // direct observation: what the player can see himself is exact and immediate
      for (const u of b.units) { if (!u.alive) continue; if (u.side === b.playerSide) { if (Math.hypot(u.x - pl.x, u.z - pl.z) < 60 && !b.space.sightBlocked(pl.x, pl.z, u.x, u.z)) this.know.friends[u.id] = { x: u.x, z: u.z, strength: u.strength, morale: u.morale, routed: u.routed, ammoLow: u.rounds < u.strength * 30, t, conf: 1, name: u.name }; }
        else if (b.playerSees(u)) this.know.enemies[u.id] = { x: u.x, z: u.z, strength: Math.max(1, Math.round(u.strength * (1 + (this.rng.next() - .5) * .3))), t, conf: .9, kind: u.kind }; }
      // routine status reports from every friendly unit that still has a leader
      for (const u of b.units) if (u.side === b.playerSide && u.alive && u.leader.alive && !u.isPlayerUnit && (t + u.id.length * 7) % 30 === 0) this.status(u);
      // runners
      for (const r of this.runners) { if (!r.alive) continue; r.age++; if (r.age < 0) continue;
        if (r.kind === 'order') { const u = b.units.find(x => x.id === r.unitId); if (u && Math.hypot(u.x - r.x, u.z - r.z) < 45) { r.tx = u.x; r.tz = u.z; } }
        const d = Math.hypot(r.tx - r.x, r.tz - r.z);
        if (d < 3) { r.alive = false; if (r.kind === 'order') { const u = b.units.find(x => x.id === r.unitId); if (u && u.alive && Math.hypot(u.x - r.x, u.z - r.z) < 40) this.deliver(u, r.payload, 'player', b.t + 1, r.record); else { if (r.record) r.record.outcome = 'lost'; this.msg('Runner', `Could not find ${r.unitId}; the order was not delivered.`, 'ack'); } } else if (r.kind === 'request') this.captainDecides(r.req); continue; }
        const v = RUNNER_SPEED; r.x += (r.tx - r.x) / d * Math.min(v, d); r.z += (r.tz - r.z) / d * Math.min(v, d);
        let exposure = 0; for (const e of b.units) if (e.side !== b.playerSide && e.active && e.order.fire !== 'hold' && Math.hypot(e.x - r.x, e.z - r.z) < 100 && e.rounds > 0 && !b.space.sightBlocked(e.x, e.z, r.x, r.z)) exposure += Math.min(2, e.strength / 8);
        if (!r.phone && this.rng.chance(.0035 * exposure * (1 - .4 * (1 - b.vis)))) { r.alive = false; if (r.record) r.record.outcome = 'lost'; b.note('runner_lost', 'A runner is shot down.', { kind: r.kind }); this.msg('Runner', 'A runner went down on the way; the message may not have arrived.', 'ack'); }
        else if (r.age > 160) { r.alive = false; if (r.record) r.record.outcome = 'lost'; }
      }
      this.runners = this.runners.filter(r => r.alive || r.age < 0);
      // reports arrive
      const due = this.reports.filter(r => r.arrive <= t); this.reports = this.reports.filter(r => r.arrive > t);
      for (const r of due) { if (r.kind === 'status') { this.know.friends[r.friend.id] = Object.assign({}, r.friend, { t: r.gen, conf: .6, name: b.units.find(u => u.id === r.friend.id).name }); for (const e of r.enemies) { const old = this.know.enemies[e.id]; if (!old || old.t < r.gen) this.know.enemies[e.id] = { x: e.x, z: e.z, strength: e.strength, t: r.gen, conf: .55, kind: e.kind }; } } else this.msg(r.from, r.text, r.kind); }
      if (b.t % 40 === 0 && b.t > 60 && !this.phoneCut && b.impacts.some(i => b.t > i.start && b.t < i.end && Math.hypot(i.x - b.def.hq[b.playerSide].x, i.z - b.def.hq[b.playerSide].z) < 60) && this.rng.chance(.3)) { this.phoneCut = true; b.note('phone', 'The telephone line to headquarters is cut by shellfire.'); }
    }
  }
  C.Comms = Comms;
})(Command);
