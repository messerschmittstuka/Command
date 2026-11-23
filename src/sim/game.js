(function (C) {
  'use strict';
  /* Game: wires the systems together for one career. Deliberately thin: it owns no rules. */
  class Game {
    constructor(opts) {
      const bus = new C.EventBus(), rng = new C.RNG(opts.seed || 1916), time = new C.TimeManager(bus);
      const characters = new C.CharacterManager(rng), relationships = new C.RelationshipManager(characters), journal = new C.Journal(time);
      this.env = { bus, rng, time, journal, characters, relationships, difficulty: C.data.difficulty[opts.difficulty || 'officer'] };
      const reg = C.data.regiments[opts.regiment], rk = C.data.ranks[reg.army];
      this.regiment = reg;
      this.player = characters.create({ army: reg.army, regiment: reg.id, name: opts.name, rank: rk.find(r => r.level === 5).id, role: 'player', attributes: { leadership: .5, experience: .15 } });
      this.nco = characters.create({ army: reg.army, regiment: reg.id, rank: rk.find(r => r.level === 3).id, role: 'nco', attributes: { leadership: .65, experience: .55, reliability: .8 } });
      this.superior = characters.create({ army: reg.army, regiment: reg.id, rank: rk.find(r => r.level === 7).id, role: 'superior', attributes: { leadership: .6, experience: .6 } });
      this.section = new C.Section({ army: reg.army, regiment: reg.id, name: opts.sectionName || 'Your section', officerId: this.player.id, ncoId: this.nco.id,
        strength: opts.strength || 10, rifle: reg.kit.rifle, helmet: reg.kit.helmet, roundsPerMan: C.data.equipment[reg.kit.rifle].roundsPerMan }, this.env);
      // The walkable world (collision) is built here so tests, the player and every soldier share it.
      this.space = new C.Space(); const L = C.data.layout, col = C.data.colliders;
      for (const b of L.buildings) this.space.addBuilding(col[b.model], b.x, b.z, b.quarter);
      for (const p of L.props) if (p[4]) this.space.addBox(p[1] - p[4], p[1] + p[4], 0, 1.2, p[2] - p[5], p[2] + p[5]);
      this.squad = new C.Squad(this.section, this.space, this.env, L);
      this.interactions = new C.Interactions(this);
      journal.add('career', `${this.player.name} reports to ${reg.name} as ${C.data.rank(reg.army, this.player.rank).name}.`);
      bus.on('deployment_review', e => this.deploymentReview(e));
    }
    get time() { return this.env.time; }
    /* Scheduled by the campaign layer ~48h before a deployment: the superior inspects the state of the section and
       reacts to the officer's earlier choices (rest vs training) in context, not by a flat score. */
    deploymentReview(e) {
      const s = this.section, sup = this.superior, rel = this.env.relationships, ready = s.readiness(), recentRest = s.recentHours('rest', 3), recentTrain = s.recentHours('train', 3);
      let text, kind;
      if (ready >= .72) { kind = 'praise'; text = `Capt. ${sup.name} inspects the section and is satisfied: "${s.report().strength} men, fit and well supplied. Good."`; rel.interact(sup.id, this.player.id, 'praise'); }
      else if (recentRest >= 8 && recentTrain < 6 && s.avgSkill() < .4 && ready < .75) { kind = 'reprimand'; text = `Capt. ${sup.name} frowns at the section's state. "You rested them with the move so close and they have had no drill, Lieutenant. They are not ready."`; rel.interact(sup.id, this.player.id, 'reprimand', { deserved: .7 }); }
      else if (ready < .55) { kind = 'concern'; text = `Capt. ${sup.name} notes the section is not fit for the line and asks what you intend to do about it.`; }
      else { kind = 'neutral'; text = `Capt. ${sup.name} passes the section without comment.`; }
      this.env.journal.add('superior', text, { kind, ready, recentRest, recentTrain });
      this.lastReview = { kind, ready };
    }
    toJSON() { return { seed: this.env.rng.s, time: this.env.time, characters: this.env.characters, relationships: this.env.relationships, section: this.section }; }
  }
  C.Game = Game;
})(Command);
