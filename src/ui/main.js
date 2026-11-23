(function (C) {
  'use strict';
  if (typeof document === 'undefined') return;
  const $ = id => document.getElementById(id);
  const SPEEDS = [0, 1, 10, 60];
  /* Entry point: regiment choice -> build game and world -> main loop. Rules live in sim/; this file only wires input, rendering and the clock. */
  C.main = async function () {
    window.addEventListener('error', e => { const x = $('err'); x.style.display = 'block'; x.textContent += (e.message || e.error) + '\n'; });
    window.addEventListener('unhandledrejection', e => { const x = $('err'); x.style.display = 'block'; x.textContent += 'Promise: ' + (e.reason && e.reason.stack || e.reason) + '\n'; });
    const opts = await new Promise(res => {
      const box = $('regs'); for (const id in C.data.regiments) { const r = C.data.regiments[id], b = document.createElement('button'); b.textContent = `${r.name} (${r.army === 'french' ? 'French' : 'German'})`; b.onclick = () => res({ regiment: id, name: $('offname').value.trim() || null }); box.appendChild(b); }
    });
    $('menu').style.display = 'none'; $('loading').style.display = 'block';
    const game = new C.Game({ regiment: opts.regiment, name: opts.name, seed: (Date.now() % 100000) | 0 });
    const eng = await C.Engine.create($('c')), THREE = eng.THREE, world = await C.World.build(eng, game);
    const army = game.regiment.army, player = new C.Player(game.space, C.data.layout.places.start);
    const me = C.People.make(eng, army, 'officer'); eng.scene.add(me.group);
    const mkNpc = (kind, x, z) => { const p = C.People.make(eng, army, kind); eng.scene.add(p.group); return { mesh: p, x, y: 0, z, heading: 0, speed: 0 }; };
    const nco = mkNpc('nco', C.data.layout.places.yard.x, C.data.layout.places.yard.z), sup = mkNpc('officer', C.data.layout.places.hq.x, C.data.layout.places.hq.z);
    const men = [];
    $('loading').style.display = 'none'; $('hud').style.display = 'block';
    let scale = 1, acc = 0, dialogOpen = null, ended = false, battleUI = null; const keys = {};
    const setScale = s => { scale = s; HUD.clock(game, scale); }; const HUD = C.HUD;
    const names = { nco: `Sgt. ${game.nco.name}`, sup: `Capt. ${game.superior.name}` };
    function openDialogue(who) {
      dialogOpen = who; if (document.pointerLockElement) document.exitPointerLock();
      const key = who === 'nco' ? 'nco' : 'sup', talk = (text) => HUD.dialogue(names[key], text, game.interactions.topics(who === 'nco' ? 'nco' : 'sup'), id => talk(game.interactions.say(who === 'nco' ? 'nco' : 'sup', id).text), closeDialogue);
      talk(who === 'nco' ? '"Sir?"' : '"Lieutenant."');
    }
    function closeDialogue() { dialogOpen = null; HUD.closeDialogue(); HUD.journal(game); }
    function nearestNpc() { let best = null, bd = 2.6; for (const [k, n] of [['nco', nco], ['sup', sup]]) { const d = Math.hypot(n.x - player.x, n.z - player.z); if (d < bd) { bd = d; best = k; } } return best; }
    $('c').addEventListener('click', () => { if (!dialogOpen && !ended && !(battleUI && battleUI.mapOpen)) $('c').requestPointerLock(); });
    document.addEventListener('mousemove', e => { if (document.pointerLockElement === $('c')) player.look(e.movementX, e.movementY); });
    document.addEventListener('keydown', e => {
      if (battleUI) { if (!battleUI.key(e)) keys[e.code] = true; return; }
      if (e.code === 'Escape' && dialogOpen) return closeDialogue();
      if (dialogOpen || ended) return; keys[e.code] = true;
      if (e.code === 'KeyV') { player.view = player.view === 'first' ? 'third' : 'first'; HUD.banner(player.view === 'first' ? 'First person' : 'Third person', 1200); }
      if (e.code === 'KeyE') { const n = nearestNpc(); if (n) openDialogue(n); }
      if (e.code === 'KeyT') setScale(SPEEDS[(SPEEDS.indexOf(scale) + 1) % SPEEDS.length] || 1);
      if (e.code === 'KeyP') setScale(scale === 0 ? 1 : 0);
      const ord = { Digit1: 'follow', Digit2: 'extend', Digit3: 'halt', Digit4: 'dismiss' }[e.code];
      if (ord) { const r = game.squad.order(ord, { x: player.x, z: player.z, heading: player.heading }); const label = { follow: 'Section, follow me!', extend: 'Section, extend!', halt: 'Section, halt!', dismiss: 'Section, dismiss!' }[ord]; HUD.banner(`${label}  (${r.obeyed}/${r.obeyed + r.ignored} responded)`, 2500); }
    });
    document.addEventListener('keyup', e => { keys[e.code] = false; });
    document.querySelectorAll('[data-speed]').forEach(b => b.onclick = () => setScale(+b.dataset.speed));
    game.env.bus.on('deployment', () => { ended = true; if (document.pointerLockElement) document.exitPointerLock(); HUD.summary(game); $('march').onclick = async () => { $('summary').style.display = 'none'; $('hud').style.display = 'none'; $('loading').textContent = 'Moving up to the line...'; $('loading').style.display = 'block'; try { battleUI = await C.BattleUI.create(eng, game, { onEnd: alive => { battleUI = null; $('c').style.display = 'block'; $('hud').style.display = 'block'; ended = !alive; if (!alive) HUD.banner('Your career has ended.', 20000); else { ended = false; HUD.banner('Back in billets. Time moves on.', 6000); } } }); } catch (err) { $('err').style.display = 'block'; $('err').textContent += 'Battle: ' + (err.stack || err) + '\n'; } $('loading').style.display = 'none'; }; });
    HUD.journal(game); HUD.clock(game, scale); HUD.bars(game);
    let last = performance.now(), hudT = 0, moved = new THREE.Vector3();
    const place = (n, dt, tx, tz, sp) => { const dx = tx - n.x, dz = tz - n.z, d = Math.hypot(dx, dz); let v = 0; if (d > .3) { v = Math.min(sp, d / dt); const p = { x: n.x, y: n.y, z: n.z }; game.space.move(p, dx / d * v * dt, dz / d * v * dt, .35, 1.7); n.x = p.x; n.z = p.z; n.heading = Math.atan2(dx, dz); } n.speed = v; };
    function frame(now) {
      const dt = Math.min(.1, (now - last) / 1000); last = now;
      if (battleUI) { battleUI.frame(dt, keys); requestAnimationFrame(frame); return; }
      if (!dialogOpen && !ended) {
        player.update(dt, keys);
        acc += dt * scale; let n = 0; while (acc >= 1 && n++ < 240) { acc -= 1; game.time.advance(1); if (game.time.stopped) { scale = 1; acc = 0; const j = game.env.journal.last(1)[0]; if (j) HUD.banner(j.text, 6000); HUD.journal(game); HUD.clock(game, scale); break; } }
        game.squad.update(dt, { x: player.x, z: player.z, heading: player.heading });
        // the NCO stays with the section; the captain waits at headquarters
        const ag = game.squad.agents, f = game.squad.mode === 'follow' || game.squad.mode === 'extend'; let cx = 0, cz = 0; for (const a of ag) { cx += a.x; cz += a.z; } cx /= Math.max(1, ag.length); cz /= Math.max(1, ag.length);
        const h = player.heading; place(nco, dt, f ? player.x - Math.sin(h) * 1.5 + Math.cos(h) * 1.3 : cx + 1.5, f ? player.z - Math.cos(h) * 1.5 - Math.sin(h) * 1.3 : cz + 1.5, f ? 3 : 1.5);
      }
      while (men.length < game.squad.agents.length) { const m = C.People.make(eng, army, 'private'); eng.scene.add(m.group); men.push(m); }
      while (men.length > game.squad.agents.length) eng.scene.remove(men.pop().group);
      game.squad.agents.forEach((a, i) => { const m = men[i]; m.group.position.set(a.x, a.y, a.z); m.group.rotation.y = a.heading; m.animate(a.speed, dt); });
      nco.mesh.group.position.set(nco.x, nco.y, nco.z); nco.mesh.group.rotation.y = nco.heading; nco.mesh.animate(nco.speed, dt);
      sup.mesh.group.position.set(sup.x, 0, sup.z); sup.mesh.group.rotation.y = 0;
      me.group.visible = player.view === 'third'; me.group.position.set(player.x, player.y, player.z); me.group.rotation.y = player.heading; me.animate(player.speed, dt);
      player.place(eng.camera, THREE); C.World.light(eng, world, player, game);
      hudT -= dt; if (hudT <= 0) { hudT = .25; HUD.bars(game); HUD.journal(game); HUD.clock(game, scale); const n = nearestNpc(); HUD.prompt(dialogOpen ? null : n ? `E: speak to ${names[n]}` : null); }
      eng.renderer.render(eng.scene, eng.camera); requestAnimationFrame(frame);
    }
    HUD.banner(`${game.player.name} reports for duty. WASD move, mouse look (click to capture), V camera, E talk, 1-4 orders, T speed.`, 9000);
    requestAnimationFrame(frame);
  };
})(Command);
