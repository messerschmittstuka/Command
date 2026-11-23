(function (C) {
  'use strict';
  const { clamp } = C.util;
  /* Individually simulated people: the player, officers, NCOs, selected soldiers, recurring characters.
     Ordinary soldiers are statistics inside a Section, not Character objects. */
  const FR_NAMES = { first: ['Henri', 'Louis', 'Marcel', 'Joseph', 'Émile', 'Lucien', 'Gaston', 'Pierre', 'Albert', 'Jules'], last: ['Dubois', 'Marchand', 'Lefèvre', 'Bernard', 'Rousseau', 'Moreau', 'Girard', 'Faure', 'Chevalier', 'Lambert'] };
  const DE_NAMES = { first: ['Karl', 'Friedrich', 'Hermann', 'Wilhelm', 'Otto', 'Ernst', 'Heinrich', 'Paul', 'Georg', 'Fritz'], last: ['Müller', 'Schneider', 'Fischer', 'Weber', 'Becker', 'Hoffmann', 'Koch', 'Richter', 'Klein', 'Wolf'] };
  class CharacterManager {
    constructor(rng) { this.rng = rng; this.list = []; this.nextId = 1; }
    create(opts) {
      const r = this.rng, tbl = opts.army === 'french' ? FR_NAMES : DE_NAMES;
      const ch = {
        id: this.nextId++, army: opts.army, regiment: opts.regiment || null,
        name: opts.name || `${r.pick(tbl.first)} ${r.pick(tbl.last)}`, rank: opts.rank, role: opts.role || 'soldier',
        historical: !!opts.historical, alive: true, status: 'active',
        personality: Object.assign({ courage: r.range(.3, .9), diligence: r.range(.3, .9), temper: r.range(.1, .8), pride: r.range(.2, .8), sociability: r.range(.2, .8) }, opts.personality),
        attributes: Object.assign({ leadership: r.range(.35, .8), experience: r.range(.1, .6), reliability: r.range(.4, .9), initiative: r.range(.2, .8), morale: r.range(.5, .8) }, opts.attributes),
        reputation: opts.reputation == null ? 0.5 : opts.reputation, history: []
      };
      this.list.push(ch); return ch;
    }
    get(id) { return this.list.find(c => c.id === id); }
    byRole(role) { return this.list.filter(c => c.role === role && c.alive); }
    note(ch, text, t) { ch.history.push({ t, text }); }
    kill(ch, t, how) { ch.alive = false; ch.status = 'dead'; this.note(ch, `Killed: ${how || 'in action'}`, t); }
    toJSON() { return { list: this.list, nextId: this.nextId }; }
  }
  C.CharacterManager = CharacterManager;
})(Command);
