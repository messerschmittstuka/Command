(function (C) {
  'use strict';
  /* Battlefield renderer: builds the scene for a Battle from its data (reusing Hailstorm ruins, wire, sandbags, ground textures) and draws units as
     groups of soldiers. What is drawn obeys fog of war: an enemy appears only if the player can see him this moment. */
  const flashTex = T => { const c = document.createElement('canvas'); c.width = c.height = 64; const x = c.getContext('2d'), g = x.createRadialGradient(32, 32, 0, 32, 32, 32); g.addColorStop(0, 'rgba(255,240,180,1)'); g.addColorStop(.4, 'rgba(255,150,40,.7)'); g.addColorStop(1, 'rgba(255,100,0,0)'); x.fillStyle = g; x.fillRect(0, 0, 64, 64); return new T.CanvasTexture(c); };
  const smokeTex = T => { const c = document.createElement('canvas'); c.width = c.height = 64; const x = c.getContext('2d'), g = x.createRadialGradient(32, 32, 0, 32, 32, 32); g.addColorStop(0, 'rgba(60,55,50,.8)'); g.addColorStop(1, 'rgba(60,55,50,0)'); x.fillStyle = g; x.fillRect(0, 0, 64, 64); return new T.CanvasTexture(c); };
  C.Battlefield = {
    async build(eng, battle) {
      const T = eng.THREE, scene = new T.Scene(), def = battle.def; scene.background = new T.Color(0xb5bcbe); scene.fog = new T.FogExp2(0xb5bcbe, 0.03);
      scene.add(new T.HemisphereLight(0xdfe6ea, 0x55503c, 1.0)); const sun = new T.DirectionalLight(0xffe6c0, .8); sun.position.set(-40, 60, 30); scene.add(sun);
      const ground = new T.Mesh(new T.PlaneGeometry(600, 600), new T.MeshLambertMaterial({ map: C.Engine.loadTexture(eng, 'Ground037', 120), color: 0x9a9585 })); ground.rotation.x = -Math.PI / 2; scene.add(ground);
      const dark = new T.MeshLambertMaterial({ color: 0x3a3226 }), mound = new T.MeshLambertMaterial({ color: 0x5b4c36 });
      for (const z of def.zones) {
        if (z.kind === 'trench') { const m = new T.Mesh(new T.PlaneGeometry(z.x1 - z.x0, z.z1 - z.z0), dark); m.rotation.x = -Math.PI / 2; m.position.set((z.x0 + z.x1) / 2, .03, (z.z0 + z.z1) / 2); scene.add(m);
          for (const side of [z.z0 - .8, z.z1 + .8]) for (let x = z.x0 + 2; x < z.x1 - 18; x += 20) { const w = 16, p = new T.Mesh(new T.BoxGeometry(w, 1.0, 1.4), mound); p.position.set(x + w / 2, .5, side); scene.add(p); battle.space.addBox(x, x + w, 0, 1.0, side - .7, side + .7); } }
        else { const m = new T.Mesh(new T.CircleGeometry(z.r, 14), dark); m.rotation.x = -Math.PI / 2; m.position.set(z.x, .03, z.z); scene.add(m); }
      }
      const bg = await C.Engine.loadGLB(eng, 'buildings'); for (const b of def.solids) { const src = bg.scene.children.find(o => o.name === b.model); if (!src) continue; const o = src.clone(true); o.position.set(b.x, 0, b.z); o.rotation.y = b.quarter * Math.PI / 2; scene.add(o); }
      for (const f of ['props_1', 'props_2', 'props_3']) await C.Engine.loadGLB(eng, f);
      for (const [name, x, z, yaw] of def.props) { let src = null; for (const f of ['props_1', 'props_2', 'props_3']) { src = eng.gltf[f].scene.children.find(o => o.name === name); if (src) break; } if (!src) continue; const o = src.clone(true); o.position.set(x, 0, z); o.rotation.y = yaw; o.traverse(m => { if (/^COL_/i.test(m.name)) m.visible = false; }); scene.add(o); }
      const trunk = new T.MeshLambertMaterial({ color: 0x4a3b2a }), leaf = new T.MeshLambertMaterial({ color: 0x3d5230 });
      for (const c of battle.space.circles) { const t = new T.Mesh(new T.CylinderGeometry(.25, .35, 5, 6), trunk); t.position.set(c.x, 2.5, c.z); scene.add(t); const k = new T.Mesh(new T.ConeGeometry(2.2, 6, 7), leaf); k.position.set(c.x, 7, c.z); scene.add(k); }
      const fx = { flashes: [], smokes: [], ft: flashTex(T), st: smokeTex(T) };
      for (let i = 0; i < 30; i++) { const s = new T.Sprite(new T.SpriteMaterial({ map: fx.ft, transparent: true, depthWrite: false, blending: T.AdditiveBlending })); s.visible = false; s.scale.set(1.6, 1.6, 1); scene.add(s); fx.flashes.push({ s, life: 0 }); }
      for (let i = 0; i < 60; i++) { const s = new T.Sprite(new T.SpriteMaterial({ map: fx.st, transparent: true, depthWrite: false })); s.visible = false; scene.add(s); fx.smokes.push({ s, life: 0 }); }
      const views = {}; for (const u of battle.units) { const v = { people: [], unit: u, group: new T.Group() }; const n = u.established, army = u.army; for (let i = 0; i < n; i++) { const p = C.People.make(eng, army, i === 0 ? 'nco' : 'private'); v.group.add(p.group); v.people.push(p); } scene.add(v.group); views[u.id] = v; }
      return { scene, views, fx, sun };
    },
    /* Per-frame: place soldiers around each unit's centre, hide what the player cannot see, animate effects. */
    update(eng, bf, battle, dt, camPos) {
      const T = eng.THREE, now = battle.t; bf.scene.fog.density = 2.6 / (130 * battle.vis);
      for (const id in bf.views) {
        const v = bf.views[id], u = v.unit; let show = false;
        if (u.alive) { const d = Math.hypot(u.x - battle.player.x, u.z - battle.player.z); show = u.side === battle.playerSide ? (d < 18 || (d < 130 * battle.vis * 1.2 && !battle.space.sightBlocked(battle.player.x, battle.player.z, u.x, u.z))) : battle.playerSees(u); }
        v.group.visible = show; if (!show) continue;
        const h = u.heading, fx = Math.sin(h), fz = Math.cos(h), rx = Math.cos(h), rz = -Math.sin(h), n = u.strength, per = u.kind === 'mg' ? 4 : Math.ceil(n / 2), tight = u.prone ? .9 : (u.moving ? 2.4 : 1.7);
        v.people.forEach((p, i) => { const on = i < n; p.group.visible = on; if (!on) return; const row = i >= per ? 1 : 0, col = (row ? i - per : i) - (per - 1) / 2, back = row ? 1.8 : 0, jx = Math.sin(i * 12.9) * .3, jz = Math.cos(i * 7.7) * .3;
          p.group.position.set(u.x + rx * col * tight + jx - fx * back, 0, u.z + rz * col * tight + jz - fz * back); p.group.rotation.y = h; p.group.scale.y = u.prone ? .35 : 1; p.animate(u.moving || u.routed ? 2 : 0, dt); });
        if (u.lastFire > now - 1.2) { const f = bf.fx.flashes.find(x => x.life <= 0); if (f && Math.random() < .5) { f.life = .12; const i = Math.floor(Math.random() * Math.max(1, n)); f.s.position.set(u.x + fx * 2 + rx * (i - n / 2) * .9, 1.2, u.z + fz * 2 + rz * (i - n / 2) * .9); f.s.visible = true; } }
      }
      for (const f of bf.fx.flashes) { if (f.life > 0) { f.life -= dt; if (f.life <= 0) f.s.visible = false; } }
      for (const im of battle.impacts) { if (now < im.start || now > im.end) continue; for (let k = 0; k < 2; k++) { const s = bf.fx.smokes.find(x => x.life <= 0); if (s) { s.life = 2.5; s.s.position.set(im.x + (Math.random() - .5) * im.r * 2, .5, im.z + (Math.random() - .5) * im.r * 2); s.s.scale.set(5, 5, 1); s.s.visible = true; } }
        if (Math.random() < .3) { const f = bf.fx.flashes.find(x => x.life <= 0); if (f) { f.life = .15; f.s.position.set(im.x + (Math.random() - .5) * im.r * 2, 1.5, im.z + (Math.random() - .5) * im.r * 2); f.s.scale.set(5, 5, 1); f.s.visible = true; } } }
      for (const s of bf.fx.smokes) if (s.life > 0) { s.life -= dt; s.s.position.y += dt * 1.6; s.s.material.opacity = Math.max(0, s.life / 2.5); if (s.life <= 0) s.s.visible = false; }
    }
  };
})(Command);
