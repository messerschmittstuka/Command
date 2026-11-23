(function (C) {
  'use strict';
  const { clamp } = C.util;
  /* Conversations as data + logic: each topic reads the real simulation state and changes it. What an NCO says comes from
     the section's actual condition and his personality, and what the player chooses changes relationships, plans or
     scheduled events. UI code only displays this structure. */
  class Interactions {
    constructor(game) { this.g = game; this.pending = { replacements: null, ammo: null }; this.lastAdvice = null; game.env.bus.on('replacements_arrive', e => this.arrive(e)); game.env.bus.on('ammo_arrives', e => this.ammoArrives(e)); game.env.bus.on('deployment', () => this.deploy()); }
    /* The NCO's honest assessment: the largest deficiency, coloured by his diligence. */
    advice() {
      const s = this.g.section, p = this.g.nco.personality;
      const needs = [['rest', s.fatigue > .6 ? s.fatigue : 0], ['ammo', s.roundsPerMan() < 50 ? 1 - s.roundsPerMan() / 50 : 0], ['train_rifle', (.5 - s.skills.rifle) * (.6 + p.diligence)], ['train_drill', (.5 - s.skills.drill) * (.6 + p.diligence)], ['train_trench', (.5 - s.skills.trench) * (.6 + p.diligence)], ['integrate', s.newcomers > 1 ? .5 : 0]];
      needs.sort((a, b) => b[1] - a[1]); return needs[0][1] > .08 ? needs[0][0] : 'carry_on';
    }
    adviceText(k) { return { rest: `The lads are dead on their feet, sir. A day's rest would do more good than another drill.`, ammo: `We are short of cartridges, sir. Someone ought to chase the supply.`, train_rifle: `Their shooting is rough, sir. A few hours on the range would help.`, train_drill: `They are sloppy on the parade ground, sir. Drill, I'd say.`, train_trench: `Few of them have the knack of trench work yet, sir.`, integrate: `The new men don't know us yet, sir. Keep them close and they'll come on.`, carry_on: `They're in fair shape, sir. I'd carry on as we are.` }[k]; }
    topics(who) {
      if (who === 'nco') return [
        { id: 'report', label: 'Ask for a report on the section' }, { id: 'advice', label: 'Ask his advice on what to do today' },
        { id: 'plan_rifle', label: 'Order rifle training (6 hours)' }, { id: 'plan_drill', label: 'Order drill (6 hours)' }, { id: 'plan_trench', label: 'Order trench work (6 hours)' }, { id: 'plan_endurance', label: 'Order a route march (6 hours)' },
        { id: 'plan_rest', label: 'Stand the section down for a rest day' }, { id: 'praise', label: 'Praise him' }, { id: 'reprimand', label: 'Reprimand him' }];
      return [{ id: 'assignment', label: 'Report for orders' }, { id: 'req_ammo', label: 'Request cartridges' }, { id: 'req_men', label: 'Request replacements' }, { id: 'status', label: 'Ask where the regiment stands' }];
    }
    plan(focus, line) { const g = this.g; g.section.plan = { focus, trainHours: 6, restDay: false }; return this.checkAdvice(focus, { text: `"${line}"` }); }
    say(who, topic) {
      const g = this.g, s = g.section, R = g.env.relationships, n = g.nco, pl = g.player;
      switch (topic) {
        case 'report': { const r = s.report(); R.interact(pl.id, n.id, 'consult'); return { text: `"${r.strength} men, sir. Morale ${r.morale}%, tiredness ${r.fatigue}%, ${r.roundsPerMan} rounds a man. Cohesion ${r.cohesion}%, readiness ${r.readiness}%${r.newcomers ? ', and ' + r.newcomers + ' new men still finding their feet' : ''}."` }; }
        case 'advice': this.lastAdvice = this.advice(); R.interact(pl.id, n.id, 'consult'); return { text: `"${this.adviceText(this.lastAdvice)}"` };
        case 'plan_rifle': return this.plan('rifle', 'Very good, sir. Rifle practice it is.');
        case 'plan_drill': return this.plan('drill', 'Very good, sir. Drill on the parade ground.');
        case 'plan_trench': return this.plan('trench', 'Very good, sir. Trench work, then.');
        case 'plan_endurance': return this.plan('endurance', 'Very good, sir. A route march.');
        case 'plan_rest': s.plan = { focus: null, trainHours: 0, restDay: true }; return this.checkAdvice('rest', { text: `"Stand easy, then. They'll be glad of it, sir."` });
        case 'praise': R.interact(pl.id, n.id, 'praise'); return { text: `"Thank you, sir."` };
        case 'reprimand': { const deserved = s.skills.discipline < .3 ? .7 : .2; R.interact(pl.id, n.id, 'reprimand', { deserved }); return { text: deserved > .5 ? `"Yes, sir. You're right. I'll see to it."` : `"Sir." His jaw tightens; he thought the section was doing well enough.` }; }
        case 'assignment': return this.assignment();
        case 'req_ammo': return this.requestAmmo();
        case 'req_men': return this.requestMen();
        case 'status': return { text: `"The Germans are massing across the Meuse. Keep your men ready. Nothing more I can tell you yet."` };
      }
      return { text: '...' };
    }
    /* Going against the NCO's advice (when it was asked for) is noticed by him: a relationship consequence. */
    checkAdvice(chosen, r) {
      const a = this.lastAdvice; this.lastAdvice = null; if (!a) return r;
      const match = a === 'rest' ? chosen === 'rest' : a.startsWith('train_') ? 'train_' + chosen === a : true;
      if (!match) { this.g.env.relationships.interact(this.g.player.id, this.g.nco.id, 'ignoreAdvice'); r.text += ' (He had advised otherwise.)'; } else this.g.env.relationships.interact(this.g.player.id, this.g.nco.id, 'consult');
      return r;
    }
    assignment() {
      const g = this.g, t = g.env.time, sup = g.superior;
      if (this.assigned) return { text: `"Your orders stand: we move up in ${Math.max(0, Math.round((this.deployAt - t.minutes) / 60))} hours. Make use of the time."` };
      this.assigned = true; this.deployAt = t.minutes + 60 * 72;
      t.schedule(this.deployAt - 60 * 48, 'deployment_review', {}, { interrupt: true }); t.schedule(this.deployAt, 'deployment', {}, { interrupt: true });
      g.env.journal.add('orders', `Orders from Capt. ${sup.name}: the regiment moves to the line in three days. Prepare the section.`, { kind: 'assignment' });
      return { text: `"The regiment moves up to the line in three days. Your section is to be ready. I will inspect it before we go."` };
    }
    requestAmmo() {
      if (this.pending.ammo) return { text: `"I've told you, it's been requested. Be patient."` };
      const g = this.g, t = g.env.time, rel = g.env.relationships.get(g.superior.id, g.player.id), supply = g.env.difficulty.supply;
      if (!g.env.rng.chance(clamp(.55 + .25 * supply + .3 * (rel.respect - .5)))) { g.env.journal.add('superior', `Capt. ${g.superior.name} refuses the request for cartridges; stocks are needed elsewhere.`); return { text: `"No. Other sections need them more. Make do."` }; }
      this.pending.ammo = t.scheduleIn(60 * 5, 'ammo_arrives', { n: g.section.strength * 80 }); return { text: `"Very well. A wagon will bring some. A few hours."` };
    }
    ammoArrives(e) { this.pending.ammo = null; this.g.section.resupply(e.n); this.g.env.journal.add('supply', `Cartridges arrive for ${this.g.section.name}: ${e.n} rounds.`, { kind: 'ammo' }); }
    requestMen() {
      if (this.pending.replacements) return { text: `"Already requested. They'll come when they come."` };
      const g = this.g, s = g.section, short = s.established - s.strength; if (short <= 0) return { text: `"You are at full strength. What do you want more men for?"` };
      const n = g.env.rng.int(1, short), delay = 60 * g.env.rng.int(24, 60);
      this.pending.replacements = g.env.time.scheduleIn(delay, 'replacements_arrive', { n }); return { text: `"I will put it to the adjutant. ${n === 1 ? 'One man' : n + ' men'} perhaps, in a day or two."` };
    }
    arrive(e) { this.pending.replacements = null; this.g.section.addReplacements(e.n); if (this.g.squad) this.g.squad.sync(); }
    deploy() { this.g.deployed = true; this.g.env.journal.add('campaign', 'The regiment marches for the line. The battle itself comes in the next stage.', { kind: 'deployment' }); }
  }
  C.Interactions = Interactions;
})(Command);
