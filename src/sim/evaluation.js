(function (C) {
  'use strict';
  const { clamp } = C.util;
  /* Evaluation: judges the player's battle in context (not by win/lose alone): what he knew, what he was ordered, whether he kept to the chain of command,
     how it turned out, and his record. The local objective and the wider battle are scored separately. Returns lines for the report and
     reputation changes with the superior; persisted in the career record. */
  C.Evaluation = {
    assess(battle, game) {
      const res = battle.result || battle.outcome(), me = battle.playerSide, items = [], orders = battle.comms.sentOrders, sec = battle.pu, rel = game.env.relationships;
      let rep = 0;
      items.push({ tag: 'local', text: res.localText }); items.push({ tag: 'wider', text: res.widerText });
      if (res.local && !res.wider) items.push({ tag: 'note', text: 'Your own sector was secure, but the battle was lost elsewhere. That was not for you to fix from your position.' });
      if (!res.local && res.wider) items.push({ tag: 'note', text: 'Your sector was lost, but the wider battle was won; the failure was not decisive.' });
      for (const o of orders) {
        const c = o.ctx, k = o.order.kind;
        if (k === 'withdraw' && me === 'D') {
          const overwhelmed = c.knownEnemy >= 2.2 * Math.max(1, c.unitStrength) || c.unitMorale < .25, trulyOverwhelmed = c.trueEnemy >= 2 * Math.max(1, c.unitStrength);
          if (overwhelmed && trulyOverwhelmed) { items.push({ tag: 'decision', text: `You ordered a withdrawal at ${this.mm(o.t)} when the odds against ${o.unit} were overwhelming. Understandable, and justified by what you could see.`, rep: +.02 }); rep += .02; }
          else if (overwhelmed && !trulyOverwhelmed) { items.push({ tag: 'decision', text: `You withdrew at ${this.mm(o.t)} on reports of a larger force than was really there. The reports were wrong, so the blame is shared.`, rep: -.01 }); rep -= .01; }
          else { items.push({ tag: 'decision', text: `You pulled back at ${this.mm(o.t)} without orders and without good reason to think the position was lost. That was a breach of your instructions to hold.`, rep: -.08 }); rep -= .08; }
        }
        if (k === 'assault' && c.unitStrength < 5 && c.knownEnemy > c.unitStrength * 1.5) { items.push({ tag: 'decision', text: `At ${this.mm(o.t)} you ordered a charge with ${c.unitStrength} men against a force you believed larger. Brave, but it was unlikely to succeed.`, rep: -.02 }); rep -= .02; }
        if (o.outcome === 'lost') items.push({ tag: 'comms', text: `Your order to ${o.unit} (${k}) never arrived: the runner was lost.` });
        if (o.outcome === 'misread') items.push({ tag: 'comms', text: `Your order to ${o.unit} (${k}) was misunderstood. Communications, not your intent, failed here.` });
      }
      const heldOn = me === 'D' ? sec.strength > 0 && !sec.routed : true;
      if (battle.stats.artilleryFriendly > 0) { items.push({ tag: 'decision', text: `Our own shells killed or wounded ${battle.stats.artilleryFriendly} of our men. Your fire request was close to friendly troops, or your map was out of date.`, rep: -.05 }); rep -= .05; }
      if (res.local && heldOn) rep += .05; else if (!res.local && !orders.length) { items.push({ tag: 'decision', text: 'You gave no orders at all during the action. That was noticed.', rep: -.05 }); rep -= .05; }
      if (res.wider && !res.local) rep += .0;
      if (!battle.player.alive && battle.player.killed) items.push({ tag: 'death', text: 'You died in action. Your career ends here.' });
      return { items, repDelta: rep, local: res.local, wider: res.wider };
    },
    mm(t) { return `${Math.floor(t / 60)}:${String(t % 60).padStart(2, '0')}`; },
    /* Apply the battle to persistent state: casualties and condition return to the Section; reputation and the career record update. */
    commit(battle, game) {
      const a = this.assess(battle, game), s = game.section, pu = battle.pu, startN = battle.start.strength, lost = startN - pu.strength;
      s.applyCasualties(Math.round(pu.killed), Math.round(pu.wounded)); s.strength = Math.max(1, pu.strength); s.morale = clamp(pu.morale); s.fatigue = clamp(pu.fatigue + .15); s.rounds = Math.max(0, pu.rounds); s.experience = clamp(s.experience + .12);
      for (const k of C.Section.SKILLS) s.skills[k] = clamp(s.skills[k] + .02);
      game.player.reputation = clamp(game.player.reputation + a.repDelta); game.superior.reputation = game.superior.reputation;
      if (a.repDelta > 0) game.env.relationships.interact(game.superior.id, game.player.id, 'praise'); else if (a.repDelta < -.04) game.env.relationships.interact(game.superior.id, game.player.id, 'reprimand', { deserved: .6 });
      const rec = { battle: battle.def.id, name: battle.def.name, date: battle.def.date, local: a.local, wider: a.wider, casualties: { killed: pu.killed, wounded: pu.wounded }, enemyCasualties: battle.stats.enemyKilled + battle.stats.enemyWounded, roundsFired: Math.round(battle.start.rounds - pu.rounds), why: battle.ended };
      game.career = game.career || { battles: [] }; game.career.battles.push(rec); game.player.history.push({ t: game.env.time.minutes, text: `${battle.def.name}: ${a.local ? 'local objective achieved' : 'local objective failed'}; ${a.wider ? 'wider battle won' : 'wider battle lost'}.` });
      game.env.journal.add('career', `${battle.def.name}: ${a.local ? 'objective achieved' : 'objective failed'}; battle ${a.wider ? 'won' : 'lost'}. Section: ${lost} casualties.`, { kind: 'battle' });
      if (battle.player.killed) { game.player.alive = false; game.player.status = 'dead'; game.env.characters.kill(game.player, game.env.time.minutes, 'in action'); }
      return { assessment: a, record: rec };
    }
  };
})(Command);
