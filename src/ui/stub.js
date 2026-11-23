(function (C) {
  'use strict';
  /* Stage-1 status page: shows the simulation core running in the browser. This is NOT the game's UI. */
  if (typeof document === 'undefined') return;
  const game = new C.Game({ regiment: 'fr_146ri', name: 'Lt. Marchand', seed: 1916 });
  const out = document.getElementById('out');
  function show() { const s = game.section; out.textContent = `${game.time.format()}\n` + JSON.stringify(s.report(), null, 1) + '\n\n' + game.env.journal.last(8).map(e => `[${e.when}] ${e.text}`).join('\n'); }
  document.querySelectorAll('button[data-plan]').forEach(b => b.onclick = () => { const p = b.dataset.plan; game.section.plan = p === 'rest' ? { restDay: true, trainHours: 0, focus: null } : { restDay: false, trainHours: 6, focus: p }; show(); });
  document.getElementById('day').onclick = () => { game.time.advance(1440); show(); };
  show();
})(Command);
