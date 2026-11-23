(function (C) {
  'use strict';
  const { clamp } = C.util;
  /* Directional relationships: how A regards B. Axes run 0..1 and start neutral (0.5; rivalry starts 0).
     They change only through interactions and shared experiences, and other systems read them
     (e.g. an NCO who trusts the officer trains the section better). */
  const NEUTRAL = { trust: .5, respect: .5, friendship: .3, rivalry: 0, loyalty: .5 };
  /* Each interaction kind has base effects; the target's personality scales them. `deserved` (0..1) in ctx
     says how justified the interaction was - an undeserved reprimand hurts trust, a deserved one can raise respect. */
  const KINDS = {
    praise:       (b, ctx) => ({ trust: +.04, respect: +.02, friendship: +.03 * (0.5 + b.personality.sociability), loyalty: +.03 }),
    reprimand:    (b, ctx) => { const d = ctx.deserved == null ? .5 : ctx.deserved, sting = .5 + b.personality.pride; return { trust: (d - .6) * .08 * sting, respect: (d - .4) * .06, friendship: -.03 * sting, rivalry: d < .4 ? .05 * sting : 0, loyalty: (d - .5) * .05 }; },
    consult:      (b, ctx) => ({ trust: +.05, respect: +.04 * (0.5 + b.attributes.leadership), loyalty: +.02 }),
    overrule:     (b, ctx) => ({ respect: ctx.wise ? +.01 : -.05, trust: ctx.wise ? 0 : -.03, rivalry: ctx.wise ? 0 : +.03 * b.personality.pride }),
    shareHardship:(b, ctx) => ({ trust: +.06, friendship: +.07 * (0.5 + b.personality.sociability), loyalty: +.05, respect: +.03 }),
    ignoreAdvice: (b, ctx) => ({ trust: -.04, respect: -.03 * (0.5 + b.attributes.initiative), friendship: -.02 })
  };
  class RelationshipManager {
    constructor(characters) { this.ch = characters; this.map = {}; }
    key(a, b) { return a + '>' + b; }
    get(a, b) { const k = this.key(a, b); return this.map[k] || (this.map[k] = Object.assign({}, NEUTRAL)); }
    adjust(a, b, delta) { const r = this.get(a, b); for (const k in delta) r[k] = clamp(r[k] + delta[k]); return r; }
    /* `actor` does something to `target`; the target's view of the actor changes, the actor's view changes a little. */
    interact(actorId, targetId, kind, ctx = {}) {
      const target = this.ch.get(targetId), f = KINDS[kind]; if (!f) throw new Error('unknown interaction ' + kind);
      const d = f(target, ctx); this.adjust(targetId, actorId, d);
      if (d.friendship) this.adjust(actorId, targetId, { friendship: d.friendship * .4 });
      return this.get(targetId, actorId);
    }
    trust(a, b) { return this.get(a, b).trust; }
    toJSON() { return this.map; }
  }
  C.RelationshipManager = RelationshipManager;
})(Command);
