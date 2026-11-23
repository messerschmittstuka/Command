(function (C) {
  'use strict';
  const $ = id => document.getElementById(id);
  /* HUD: thin DOM layer. It displays simulation state and forwards choices; it contains no game rules. */
  C.HUD = {
    bars(game) {
      const s = game.section, r = s.report(), set = (id, v, bad) => { const e = $(id); e.style.width = Math.round(v) + '%'; e.className = 'fill' + (bad ? ' bad' : ''); };
      set('b-morale', r.morale, r.morale < 35); set('b-fatigue', r.fatigue, r.fatigue > 70); set('b-cohesion', r.cohesion, r.cohesion < 35); set('b-ready', r.readiness, r.readiness < 50);
      set('b-ammo', Math.min(100, r.roundsPerMan / 1.2), r.roundsPerMan < 40);
      $('strength').textContent = `${s.strength}/${s.established} men`;
      const act = { sleep: 'sleeping', meal: 'at breakfast', rest: 'resting', leisure: 'off duty', duty: 'on fatigues', train: 'training: ' + (s.plan.focus || '-') }[s.activityAt(game.time.hour)];
      $('activity').textContent = act + (s.plan.restDay ? ' (rest day)' : '') + (game.squad.mode !== 'activity' ? ' | ' + game.squad.mode : '');
    },
    clock(game, scale) { $('clock').textContent = game.time.format() + '  x' + scale; },
    journal(game) { $('journal').innerHTML = game.env.journal.last(7).reverse().map(e => `<div class="j j-${e.category}"><span>${e.when.slice(5)}</span> ${e.text.replace(/</g, '&lt;')}</div>`).join(''); },
    prompt(text) { const p = $('prompt'); p.style.display = text ? 'block' : 'none'; p.textContent = text || ''; },
    banner(text, ms = 4000) { const b = $('banner'); b.textContent = text; b.style.opacity = 1; clearTimeout(this._bt); this._bt = setTimeout(() => b.style.opacity = 0, ms); },
    dialogue(title, text, options, onPick, onClose) {
      const d = $('dialogue'); d.style.display = 'block'; $('dlg-title').textContent = title; $('dlg-text').textContent = text;
      const box = $('dlg-opts'); box.innerHTML = '';
      for (const o of options) { const b = document.createElement('button'); b.textContent = o.label; b.onclick = () => onPick(o.id); box.appendChild(b); }
      const c = document.createElement('button'); c.textContent = 'Leave (Esc)'; c.className = 'leave'; c.onclick = onClose; box.appendChild(c);
    },
    closeDialogue() { $('dialogue').style.display = 'none'; },
    summary(game) {
      const s = game.section, r = s.report(), rel = game.env.relationships.get(game.nco.id, game.player.id), sup = game.env.relationships.get(game.superior.id, game.player.id);
      $('summary-body').innerHTML = `<p>The regiment marches for the line. Here is how you leave the rear area:</p><ul><li>Strength ${r.strength}, morale ${r.morale}%, tiredness ${r.fatigue}%, cohesion ${r.cohesion}%, readiness ${r.readiness}%</li><li>${r.roundsPerMan} rounds a man</li><li>Skills: ${Object.entries(r.skills).map(([k, v]) => k + ' ' + v).join(', ')}</li><li>Sergeant ${game.nco.name} trusts you ${Math.round(rel.trust * 100)}%, respects you ${Math.round(rel.respect * 100)}%</li><li>Capt. ${game.superior.name}: ${game.lastReview ? game.lastReview.kind : 'no inspection held'}</li></ul><p><button id="march">March to the line</button></p>`;
      $('summary').style.display = 'flex';
    }
  };
})(Command);
