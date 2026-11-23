(function (C) {
  'use strict';
  const { clamp } = C.util;
  /* A Section: 8-12 men commanded by the player, tracked statistically. Everything a player decision can touch lives
     here, and each rule below is a consequence the rest of the game reads (readiness, firepower, order response). */
  const SKILLS = ['rifle', 'drill', 'endurance', 'trench', 'fieldcraft', 'coordination', 'discipline'];
  const WORK_START = 7, WORK_END = 17; // working window; 22:00-06:00 is sleep
  const FATIGUE_LIMIT = 0.75;

  class Section {
    constructor(opts, env) {
      this.env = env; // { bus, rng, time, journal, characters, relationships, difficulty }
      this.army = opts.army; this.regiment = opts.regiment; this.name = opts.name || 'Section';
      this.officerId = opts.officerId; this.ncoId = opts.ncoId;
      this.strength = opts.strength || 10; this.established = this.strength;
      this.morale = .65; this.fatigue = .15; this.cohesion = .6; this.newcomers = 0;
      this.skills = {}; for (const s of SKILLS) this.skills[s] = opts.skills && opts.skills[s] != null ? opts.skills[s] : .3;
      this.experience = .2;
      this.kit = { rifle: opts.rifle, helmet: opts.helmet };
      this.equipment = { condition: .85, availability: 1 }; // availability: share of men fully equipped
      this.rounds = this.strength * (opts.roundsPerMan || 120); this.roundsPerManNorm = opts.roundsPerMan || 120;
      this.plan = { focus: null, trainHours: 0, restDay: false };
      this.log = []; this.today = { train: 0, rest: 0, duty: 0 }; // rolling record of what the player chose, read by superiors
      this.casualties = { killed: 0, wounded: 0, sick: 0 };
      this.flags = {};
      env.bus.on('hour', e => this.onHour(e.hour));
      env.bus.on('day', () => this.onDay());
    }
    get nco() { return this.env.characters.get(this.ncoId); }
    get officer() { return this.env.characters.get(this.officerId); }

    /* How well the NCO actually delivers training: his ability, experience and how much he trusts the officer. */
    ncoQuality() {
      const n = this.nco; if (!n || !n.alive) return .2;
      const trust = this.env.relationships.trust(this.ncoId, this.officerId);
      return clamp(.3 + .35 * n.attributes.leadership + .15 * n.attributes.experience + .2 * (trust - .5));
    }
    activityAt(hour) {
      if (hour >= 22 || hour < 6) return 'sleep';
      if (hour < WORK_START) return 'meal';
      if (hour < WORK_END) { if (this.plan.restDay) return 'rest'; return hour - WORK_START < this.plan.trainHours ? 'train' : 'duty'; }
      return 'leisure';
    }
    onHour(hour) {
      const act = this.activityAt(hour), diff = this.env.difficulty, fat = this.fatigue;
      switch (act) {
        case 'sleep': this.fatigue -= .03; this.morale += .002; break;
        case 'meal': this.fatigue -= .01; this.morale += .001; break;
        case 'rest': this.fatigue -= .03; this.morale += .004; this.cohesion += .001; this.today.rest++; break;
        case 'leisure': this.fatigue -= .015; this.morale += .003 * diff.moraleResilience; this.cohesion += .0015; break;
        case 'duty': this.fatigue += .02; this.today.duty++; break;
        case 'train': this.trainHour(); this.today.train++; break;
      }
      if (this.fatigue > FATIGUE_LIMIT) this.morale -= .003 / diff.moraleResilience; // exhaustion eats morale
      if (this.fatigue > .85 && this.env.rng.chance(.01)) this.sickness();
      this.fatigue = clamp(this.fatigue); this.morale = clamp(this.morale);
      this.cohesion = clamp(this.cohesion, 0, this.cohesionCap());
    }
    trainHour() {
      const f = this.plan.focus; if (!f) return;
      const q = this.ncoQuality(), cap = this.cohesionCap();
      const gain = .012 * (1 - .6 * this.fatigue) * (.6 + .8 * q) * (.7 + .6 * this.cohesion) * (1 - this.skills[f]);
      this.skills[f] = clamp(this.skills[f] + gain);
      this.fatigue += .04 + (f === 'endurance' ? .02 : 0);
      this.experience = clamp(this.experience + .0004);
      this.cohesion += .0012;
      // Pushing exhausted men through drill sours them, and the NCO notices.
      if (this.fatigue > FATIGUE_LIMIT) this.morale -= .008;
    }
    sickness() { if (this.strength > 1) { this.strength--; this.casualties.sick++; this.env.journal.add('section', `${this.name}: a man is sent to the aid post with exhaustion and fever.`, { kind: 'sick' }); } }
    cohesionCap() { return clamp(1 - .5 * this.newcomers / Math.max(1, this.strength), .25, 1); }

    onDay() {
      this.log.push(Object.assign({ day: this.env.time.day }, this.today)); if (this.log.length > 14) this.log.shift();
      this.today = { train: 0, rest: 0, duty: 0 };
      // Replacements integrate over days, faster under a capable, trusted NCO.
      if (this.newcomers > 0) {
        const rate = .25 + .5 * this.ncoQuality();
        const before = this.newcomers; this.newcomers = Math.max(0, this.newcomers - rate);
        if (before >= 1 && this.newcomers < 1) this.env.journal.add('section', `${this.name}: the new men are settling in.`, { kind: 'integration' });
      }
      // Unused skills fade slowly; drill and fieldcraft keep the section sharp.
      for (const s of SKILLS) this.skills[s] = clamp(this.skills[s] - .0006);
      this.skills.discipline = clamp(this.skills.discipline - (this.morale < .35 ? .004 : 0));
    }
    /* Replacements arrive inexperienced: strength rises at once, cohesion pays for it and recovers as they integrate. */
    addReplacements(n, quality = .25) {
      const total = this.strength + n;
      this.experience = (this.experience * this.strength + quality * n) / total;
      for (const s of SKILLS) this.skills[s] = (this.skills[s] * this.strength + quality * .8 * n) / total;
      this.rounds += n * this.roundsPerManNorm * .5; // they arrive short of ammunition
      this.strength = total; this.newcomers += n;
      this.cohesion = Math.min(this.cohesion * (1 - .5 * n / total), this.cohesionCap());
      this.env.journal.add('section', `${this.name}: ${n} replacement${n > 1 ? 's' : ''} join the section.`, { kind: 'replacements', n });
    }
    applyCasualties(killed, wounded) {
      const lost = Math.min(this.strength - 1, killed + wounded);
      this.strength -= lost; this.casualties.killed += killed; this.casualties.wounded += wounded;
      this.morale = clamp(this.morale - .04 * killed - .02 * wounded);
      this.cohesion = clamp(this.cohesion - .03 * killed);
      this.rounds = Math.min(this.rounds, this.strength * this.roundsPerManNorm * 2);
    }
    consumeRounds(n) {
      const used = Math.min(this.rounds, n); this.rounds -= used;
      if (this.rounds < this.strength * 20 && !this.flags.ammoShort) { this.flags.ammoShort = true; this.morale = clamp(this.morale - .08); this.env.journal.add('section', `${this.name}: the men report they are running short of cartridges.`, { kind: 'ammo' }); }
      return used;
    }
    resupply(n) { this.rounds += n * this.env.difficulty.supply; if (this.rounds >= this.strength * 60) this.flags.ammoShort = false; }
    roundsPerMan() { return this.rounds / Math.max(1, this.strength); }
    /* Effective firepower multiplier: shortages cut it long before the last round is gone. */
    firepower() {
      const ammo = clamp(this.roundsPerMan() / 60), q = this.skills.rifle * .5 + this.skills.coordination * .2 + this.experience * .3;
      return (.4 + .6 * q) * ammo * (.7 + .3 * this.morale) * (this.strength / this.established);
    }
    /* Chance an order is carried out promptly and correctly; low discipline, morale and cohesion mean hesitation. */
    orderResponse() { return clamp(.35 + .25 * this.skills.discipline + .15 * this.morale + .15 * this.cohesion + .1 * this.skills.drill - .15 * this.fatigue); }
    readiness() {
      const avgSkill = SKILLS.reduce((a, s) => a + this.skills[s], 0) / SKILLS.length;
      return clamp(.2 * (this.strength / this.established) + .15 * this.morale + .2 * (1 - this.fatigue) + .15 * clamp(this.roundsPerMan() / 100) +
        .1 * this.equipment.condition * this.equipment.availability + .1 * avgSkill + .1 * this.cohesion);
    }
    avgSkill() { return SKILLS.reduce((a, s) => a + this.skills[s], 0) / SKILLS.length; }
    recentHours(kind, days = 3) { return this.log.slice(-days).reduce((a, d) => a + d[kind], 0) + this.today[kind]; }
    report() {
      const r = v => Math.round(v * 100);
      return { strength: `${this.strength}/${this.established}`, morale: r(this.morale), fatigue: r(this.fatigue), cohesion: r(this.cohesion), discipline: r(this.skills.discipline),
        readiness: r(this.readiness()), roundsPerMan: Math.round(this.roundsPerMan()), newcomers: Math.ceil(this.newcomers), skills: Object.fromEntries(SKILLS.map(s => [s, r(this.skills[s])])) };
    }
  }
  Section.SKILLS = SKILLS;
  C.Section = Section;
})(Command);
