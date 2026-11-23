(function (C) {
  'use strict';
  const { clamp } = C.util;
  /* Battle: one small engagement, simulated in 1-second ticks. Ordinary soldiers are statistics inside units (sections); only the player,
     the unit leaders and the captain are individuals. Everything that happens here comes from the rules below: fire, cover, suppression,
     morale, fatigue, ammunition, movement, melee. Command, communication and fog of war are in comms.js; enemy decisions in ai.js. */
  const SPEED = { advance: 1.5, assault: 3.0, withdraw: 2.6 };
  const SIGHT = 130, RANGE = 170;
  const TUNE = { rate: .07, moving: .06, mg: .7, hit: .07 }; // balance knobs: aimed shots per man per second, etc.

  class Unit {
    constructor(def, side, army, rng, ammoPerMan) {
      Object.assign(this, { id: def.id, name: def.name, side, army, kind: def.kind, wave: def.wave || 0, reserve: !!def.reserve, x: def.x, z: def.z, heading: side === 'D' ? Math.PI : 0 });
      this.strength = def.strength; this.established = def.strength; this.killed = 0; this.wounded = 0;
      this.morale = clamp(.55 + .25 * def.quality + rng.range(-.05, .05)); this.fatigue = .1; this.skill = def.quality;
      this.rounds = def.strength * (def.kind === 'mg' ? 400 : ammoPerMan); this.sup = 0; this.routed = false; this.prone = false;
      this.leader = { name: def.leader, alive: true, initiative: def.initiative * rng.range(.8, 1.2), reliability: def.reliability * rng.range(.8, 1.2) };
      this.order = { kind: 'hold', fire: 'free' }; this.pending = []; this.lastFire = -99; this.lastHit = -99; this.sees = new Set(); this.hitsTaken = 0; this.shotsFired = 0; this.isPlayerUnit = false;
    }
    get alive() { return this.strength > 0; }
    get active() { return this.strength > 0 && !this.routed; }
  }

  class Battle {
    constructor(game, def, opts = {}) {
      this.game = game; this.def = def; this.env = game.env; this.rng = new C.RNG(opts.seed || game.env.rng.int(1, 1e9)); this.t = 0; this.ended = null; this.log = [];
      this.playerSide = game.regiment.army === 'french' ? 'D' : 'A'; this.enemySide = this.playerSide === 'D' ? 'A' : 'D';
      this.space = new C.Space();
      for (const b of def.solids) this.space.addBuilding(C.data.colliders[b.model], b.x, b.z, b.quarter);
      const trees = new C.RNG(11); for (let i = 0; i < 40; i++) { const a = trees.range(0, 6.28), r = trees.range(95, 130); this.space.addCircle(Math.cos(a) * r, Math.sin(a) * r * .85 - 5, .4, 6); }
      const sec = game.section, dm = game.env.difficulty;
      this.units = [];
      for (const d of def.defenders) this.units.push(new Unit(d, 'D', 'french', this.rng, 120));
      for (const d of def.attackers) this.units.push(new Unit(d, 'A', 'german', this.rng, 120));
      this.player = { x: 0, z: 0, alive: true, wounded: false, killed: false, hp: 1 };
      this.pu = this.units.find(u => u.id === def.playerSlot[this.playerSide]); this.pu.isPlayerUnit = true;
      // the player's own section brings its real state into the battle
      this.pu.strength = sec.strength; this.pu.established = sec.established; this.pu.morale = clamp(sec.morale * .8 + sec.cohesion * .2); this.pu.fatigue = sec.fatigue; this.pu.skill = clamp(sec.skills.rifle * .5 + sec.skills.coordination * .2 + sec.experience * .3 + .1);
      this.pu.rounds = sec.rounds; this.pu.leader = { name: 'Sgt. ' + game.nco.name, alive: true, initiative: game.nco.attributes.initiative, reliability: game.nco.attributes.reliability };
      this.start = { strength: this.pu.strength, rounds: this.pu.rounds, morale: this.pu.morale, fatigue: this.pu.fatigue };
      const hq = def.hq[this.playerSide]; this.player.x = hq.x; this.player.z = this.playerSide === 'D' ? def.trenchZ - 3 : def.trenchZ + 95;
      this.player.x = this.pu.x; this.player.z = this.pu.z + (this.playerSide === 'D' ? -3 : 3);
      this.vis = def.fog; this.artillery = { D: def.artillery.D, A: def.artillery.A }; this.impacts = []; this.mem = { D: {}, A: {} };
      this.stats = { orders: 0, enemyKilled: 0, enemyWounded: 0, artilleryFriendly: 0 };
      this.comms = new C.Comms(this); this.ai = { D: new C.EnemyAI(this, 'D'), A: new C.EnemyAI(this, 'A') }; this.accum = 0;
      this.note('start', `${def.name}: the action begins. ${this.playerSide === 'D' ? 'Hold the forward trench.' : 'Take the forward trench.'}`);
    }
    note(type, text, data) { this.log.push({ t: Math.round(this.t), type, text, data: data || null }); }
    enemies(of) { return this.units.filter(u => u.side !== of.side && u.alive); }
    friends(of) { return this.units.filter(u => u.side === of.side && u.alive); }
    zoneAt(x, z) { let c = 1, kind = 'open'; for (const zn of this.def.zones) { const inside = zn.r ? Math.hypot(x - zn.x, z - zn.z) < zn.r : x >= zn.x0 && x <= zn.x1 && z >= zn.z0 && z <= zn.z1; if (inside && zn.cover < c) { c = zn.cover; kind = zn.kind; } } return { cover: c, kind }; }
    sight(u, t) { return SIGHT * this.vis * (t.lastFire > this.t - 4 ? 1.5 : 1) * (this.zoneAt(t.x, t.z).kind === 'open' ? 1 : .8); }
    canSee(u, t) { const d = Math.hypot(t.x - u.x, t.z - u.z); return d < this.sight(u, t) && !this.space.sightBlocked(u.x, u.z, t.x, t.z); }
    playerSees(t) { const d = Math.hypot(t.x - this.player.x, t.z - this.player.z); return d < this.sight(null, t) && !this.space.sightBlocked(this.player.x, this.player.z, t.x, t.z); }

    /* Advance simulated time. The simulation steps at 1 Hz regardless of frame rate. */
    step(dt) { this.accum += dt; while (this.accum >= 1 && !this.ended) { this.accum -= 1; this.tick(); } }
    tick() {
      this.t += 1; const dt = 1;
      this.vis = this.def.fog + clamp((this.t / this.def.durationS), 0, 1) * (1 - this.def.fog) * .6;     // the morning fog thins
      for (const u of this.units) { u.sees.clear(); if (u.alive) for (const e of this.enemies(u)) if (this.canSee(u, e)) { u.sees.add(e.id); this.mem[u.side][e.id] = { x: e.x, z: e.z, strength: e.strength, t: this.t, wave: e.wave, kind: e.kind }; } }
      for (const u of this.units) this.applyPending(u);
      this.ai.D.think(); this.ai.A.think(); this.comms.tick();
      for (const u of this.units) if (u.alive) this.move(u, dt);
      for (const u of this.units) if (u.active) this.fire(u);
      this.melee(); this.artilleryTick(); this.moraleTick();
      this.checkEnd();
    }
    applyPending(u) { const due = u.pending.filter(p => p.at <= this.t); if (!due.length) return; u.pending = u.pending.filter(p => p.at > this.t); for (const p of due) this.setOrder(u, p.order, p.src); }
    setOrder(u, order, src) { if (!u.alive) return; u.order = Object.assign({ fire: 'free' }, order); u.prone = order.kind === 'cover'; if (src === 'player') this.stats.orders++; }

    move(u, dt) {
      const o = u.order; let sp = 0, tx = o.tx, tz = o.tz;
      if (u.routed) { const h = this.def.hq[u.side]; tx = h.x; tz = h.z; sp = SPEED.withdraw * 1.3; }
      else if (o.kind === 'advance' || o.kind === 'assault' || o.kind === 'withdraw') sp = SPEED[o.kind];
      if (sp > 0 && tx != null) {
        if (u.sup > .6 && o.kind === 'advance') sp *= .35; const d = Math.hypot(tx - u.x, tz - u.z);
        if (d < 1.5) { if (o.kind !== 'assault') u.order = { kind: 'hold', fire: 'free' }; }
        else { const v = Math.min(sp * (1 - .3 * u.fatigue) * (this.zoneAt(u.x, u.z).kind === 'hole' ? .8 : 1), d / dt), p = { x: u.x, y: 0, z: u.z }; this.space.move(p, (tx - u.x) / d * v * dt, (tz - u.z) / d * v * dt, 1.5, 1.7); u.x = p.x; u.z = p.z; u.heading = Math.atan2(tx - u.x, tz - u.z); u.moving = true; u.fatigue = clamp(u.fatigue + (o.kind === 'assault' ? .0022 : .0008)); return; }
      }
      u.moving = false; u.fatigue = clamp(u.fatigue - .0003);
    }
    hitProb(d) { return clamp(TUNE.hit - d * .0006, .008, TUNE.hit); }
    fire(u) {
      if (u.order.fire === 'hold' || u.prone || u.rounds <= 0) return;
      let target = null, td = 1e9; for (const id of u.sees) { const e = this.units.find(x => x.id === id); if (!e || !e.alive) continue; const d = Math.hypot(e.x - u.x, e.z - u.z); if (d < RANGE && d < td) { td = d; target = e; } }
      if (!target) return;
      const rate = (u.kind === 'mg' ? TUNE.mg * Math.min(4, u.strength) : u.strength * (u.moving ? TUNE.moving : TUNE.rate)) * (.6 + .8 * u.skill) * (1 - .8 * u.sup) * (1 - .4 * u.fatigue);
      let shots = Math.floor(rate + this.rng.next()); shots = Math.min(shots, Math.floor(u.rounds)); if (shots <= 0) return;
      u.rounds -= shots; u.shotsFired += shots; u.lastFire = this.t; u.heading = Math.atan2(target.x - u.x, target.z - u.z);
      const z = this.zoneAt(target.x, target.z), mult = z.cover * (target.prone ? .55 : 1) * (target.moving ? 1.15 : 1) * (.7 + .3 * this.vis), p = this.hitProb(td) * mult * (u.kind === 'mg' ? .5 : 1);
      let hits = 0; for (let i = 0; i < shots; i++) if (this.rng.next() < p) hits++;
      this.inflict(target, hits, shots, u);
    }
    inflict(t, hits, shots, src) {
      hits = Math.min(hits, t.strength); const killed = Math.round(hits * (src ? .45 : .35)), wounded = hits - killed;
      t.strength -= hits; t.killed += killed; t.wounded += wounded; t.sup = clamp(t.sup + shots * .006 + hits * .025); t.morale = clamp(t.morale - hits * .028 / (.6 + .8 * t.leader.reliability * (t.leader.alive ? 1 : .4))); t.hitsTaken += hits; if (hits) t.lastHit = this.t;
      if (src && src.side === this.playerSide) { this.stats.enemyKilled += killed; this.stats.enemyWounded += wounded; }
      if (t.isPlayerUnit && hits && this.player.alive) this.playerExposure(t, hits);
      if (t.strength <= 0) { t.routed = false; this.note('destroyed', `${t.name} is wiped out.`, { id: t.id }); }
      if (hits >= 2 && t.leader.alive && this.rng.chance(.025 * hits)) { t.leader.alive = false; this.note('leader', `${t.leader.name} of ${t.name} is hit.`, { id: t.id }); t.morale = clamp(t.morale - .08); }
    }
    /* The officer shares his section's danger: hits on the unit he stands with can strike him. Cover helps. */
    playerExposure(u, hits) {
      const d = Math.hypot(this.player.x - u.x, this.player.z - u.z); if (d > 14) return; const z = this.zoneAt(this.player.x, this.player.z).cover;
      for (let i = 0; i < hits; i++) if (this.rng.chance(.012 * z * (this.playerProne ? .5 : 1))) { this.player.alive = false; if (this.rng.chance(.4)) { this.player.killed = true; this.note('player', 'You are killed.'); } else { this.player.wounded = true; this.note('player', 'You are badly wounded and carried from the field.'); } return; }
    }
    melee() {
      for (const a of this.units) { if (!a.active || a.order.kind !== 'assault') continue;
        for (const d of this.enemies(a)) { if (!d.alive || Math.hypot(d.x - a.x, d.z - a.z) > 6) continue;
          const pa = a.strength * (.4 + a.morale) * (1 - a.sup * .5), pd = d.strength * (.4 + d.morale) * (1 - d.sup * .5) * (d.prone ? .6 : 1);
          const la = Math.min(a.strength, Math.round(pd * .06 + this.rng.next())), ld = Math.min(d.strength, Math.round(pa * .08 + this.rng.next()));
          this.inflict(a, la, 0, null); this.inflict(d, ld, 0, null); a.morale = clamp(a.morale - .01); d.morale = clamp(d.morale - .035 - (d.sup > .4 ? .03 : 0));
          if (d.morale < .3 && !d.routed) this.rout(d, 'breaks before the bayonets'); if (a.morale < .25 && !a.routed) this.rout(a, 'is thrown back');
        } }
    }
    rout(u, why) { if (u.routed || !u.alive) return; u.routed = true; u.order = { kind: 'withdraw', fire: 'hold' }; this.note('rout', `${u.name} ${why || 'breaks and runs'}.`, { id: u.id }); }
    moraleTick() {
      for (const u of this.units) { if (!u.alive) continue; u.sup = clamp(u.sup - .04);
        const near = this.friends(u).filter(f => f !== u && Math.hypot(f.x - u.x, f.z - u.z) < 25 && f.active).length, calm = u.sup < .2 && this.t - u.lastHit > 8;
        u.morale = clamp(u.morale - u.sup * .006 / (this.env.difficulty.moraleResilience) + (calm ? .003 : 0) + near * .0008 + (u.leader.alive ? .0004 : 0) + (u.rounds < u.strength * 8 ? -.002 : 0));
        if (!u.routed && u.morale < .13) this.rout(u);
        if (u.routed && u.morale > .38 && !this.enemies(u).some(e => Math.hypot(e.x - u.x, e.z - u.z) < 60)) { u.routed = false; u.order = { kind: 'hold', fire: 'free' }; this.note('rally', `${u.name} rallies.`, { id: u.id }); }
        if (u.routed) u.morale = clamp(u.morale + .0015);
      }
    }
    /* Artillery: a salvo lands on a point, saturating a circle for a while. It hurts anybody inside, friend or foe. */
    callFire(side, x, z, delay) { this.impacts.push({ side, x, z, r: 18, start: this.t + delay, end: this.t + delay + 45 }); this.artillery[side]--; this.note('artillery', `${side === this.playerSide ? 'Our' : 'Enemy'} guns are ordered to fire on (${Math.round(x)}, ${Math.round(z)}).`, { side, x, z }); }
    artilleryTick() {
      for (const im of this.impacts) { if (this.t < im.start || this.t > im.end) continue; if (this.t === im.start) this.note('shellfire', 'A barrage begins to fall.', { x: im.x, z: im.z, side: im.side });
        for (const u of this.units) { if (!u.alive || Math.hypot(u.x - im.x, u.z - im.z) > im.r) continue; const z = this.zoneAt(u.x, u.z).cover, hits = Math.min(u.strength, Math.floor(u.strength * .014 * z * (u.prone ? .7 : 1) + this.rng.next()));
          this.inflict(u, hits, 12, null); u.sup = clamp(u.sup + .2); if (u.side === im.side && hits) this.stats.artilleryFriendly += hits;
        }
        if (this.player.alive && Math.hypot(this.player.x - im.x, this.player.z - im.z) < im.r && this.rng.chance(.004 * this.zoneAt(this.player.x, this.player.z).cover)) { this.player.alive = false; this.player.wounded = true; this.note('player', 'A shell burst knocks you down, badly wounded.'); } }
    }
    /* Local and wider outcomes are computed separately. Sector control = who holds more men inside that stretch of the forward trench. */
    sectorControl() {
      const out = {}, tz = this.def.trenchZ;
      for (const s of this.def.sectors) { const inside = side => this.units.filter(u => u.side === side && u.active && u.x >= s.x0 && u.x <= s.x1 && Math.abs(u.z - tz) < 10).reduce((a, u) => a + u.strength, 0), d = inside('D'), a = inside('A');
        out[s.id] = a > d && a > 0 ? 'A' : 'D'; }
      return out;
    }
    outcome() {
      const sc = this.sectorControl(), me = this.playerSide, held = id => sc[id] === 'D', mine = me === 'D' ? held('center') : !held('center'), n = Object.values(sc).filter(v => v === 'D').length;
      const wider = me === 'D' ? n >= 2 : n <= 1;
      return { local: mine, wider, sectors: sc, localText: me === 'D' ? (mine ? 'You held your sector of the trench.' : 'Your sector of the trench was lost.') : (mine ? 'Your section took its objective.' : 'Your section failed to take its objective.'),
        widerText: me === 'D' ? (wider ? 'The battalion held its front.' : 'The battalion front was broken.') : (wider ? 'The assault carried the outpost line.' : 'The assault failed along the front.') };
    }
    checkEnd() {
      if (this.ended) return; const me = this.playerSide;
      if (!this.player.alive) return this.finish(this.player.killed ? 'player_killed' : 'player_wounded');
      const sc = this.sectorControl(), mine = this.units.filter(u => u.side === me && u.alive), foes = this.units.filter(u => u.side !== me && u.active);
      if (this.t >= this.def.durationS) return this.finish('time');
      if (!this.pu.alive || (this.pu.strength <= 2 && this.pu.routed)) return this.finish('section_lost');
      if (me === 'D' && !foes.some(u => u.side === 'A' && u.kind !== 'mg') && this.t > 200) return this.finish('enemy_broken');
      if (me === 'A' && !this.units.some(u => u.side === 'D' && u.active && u.kind !== 'mg')) return this.finish('enemy_broken');
    }
    finish(why) { this.ended = why; this.result = this.outcome(); this.result.why = why; this.note('end', `The action ends (${why}).`, this.result); this.env.bus.emit('battle_end', this.result); }
  }
  Battle.TUNE = TUNE; C.Battle = Battle; C.Unit = Unit;
})(Command);
