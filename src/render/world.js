(function (C) {
  'use strict';
  /* World: builds the rear-area village from the reused Hailstorm models and textures, and handles lighting by time of day. */
  C.World = {
    async build(eng, game) {
      const T = eng.THREE, scene = eng.scene, L = C.data.layout;
      scene.background = new T.Color(0xa9b3b8); scene.fog = new T.FogExp2(0xa9b3b8, 0.012);
      const hemi = new T.HemisphereLight(0xcfd8e0, 0x4a4a38, 0.9); scene.add(hemi);
      const sun = new T.DirectionalLight(0xfff0d8, 1.1); sun.castShadow = true; sun.shadow.mapSize.set(2048, 2048);
      const sc = sun.shadow.camera; sc.left = -45; sc.right = 45; sc.top = 45; sc.bottom = -45; sc.near = 1; sc.far = 160; sun.shadow.bias = -0.0004; scene.add(sun); scene.add(sun.target);
      // ground: reused ambientCG ground and gravel textures
      const ground = new T.Mesh(new T.PlaneGeometry(500, 500), new T.MeshLambertMaterial({ map: C.Engine.loadTexture(eng, 'Ground037', 90), color: 0xb0b0a0 })); ground.rotation.x = -Math.PI / 2; ground.receiveShadow = true; scene.add(ground);
      const road = new T.Mesh(new T.PlaneGeometry(220, 7), new T.MeshLambertMaterial({ map: C.Engine.loadTexture(eng, 'Gravel043', 40) })); road.rotation.x = -Math.PI / 2; road.position.set(10, 0.02, 2); road.receiveShadow = true; scene.add(road);
      const parade = new T.Mesh(new T.PlaneGeometry(22, 14), new T.MeshLambertMaterial({ map: C.Engine.loadTexture(eng, 'Grass004', 10) })); parade.rotation.x = -Math.PI / 2; parade.position.set(L.places.parade.x, 0.015, L.places.parade.z + 2); parade.receiveShadow = true; scene.add(parade);
      // buildings (visual meshes only; the col_* nodes are empties used for collision)
      const bg = await C.Engine.loadGLB(eng, 'buildings');
      for (const b of L.buildings) { const src = bg.scene.children.find(o => o.name === b.model); if (!src) { console.warn('missing building', b.model); continue; } const o = src.clone(true); o.position.set(b.x, 0, b.z); o.rotation.y = b.quarter * Math.PI / 2; o.traverse(m => { if (m.isMesh) { m.castShadow = true; m.receiveShadow = true; } }); scene.add(o); }
      // props
      for (const f of ['props_1', 'props_2', 'props_3']) await C.Engine.loadGLB(eng, f);
      for (const [name, x, z, yaw] of L.props) {
        let src = null; for (const f of ['props_1', 'props_2', 'props_3']) { src = eng.gltf[f].scene.children.find(o => o.name === name); if (src) break; } if (!src) { console.warn('missing prop', name); continue; }
        const o = src.clone(true); o.position.set(x, 0, z); o.rotation.y = yaw; o.traverse(m => { if (/^COL_/i.test(m.name)) m.visible = false; if (m.isMesh) { m.castShadow = true; m.receiveShadow = true; } }); scene.add(o);
      }
      // a ring of trees for depth
      const trunk = new T.MeshLambertMaterial({ color: 0x4a3b2a }), leaf = new T.MeshLambertMaterial({ color: 0x3d5230 }), rng = new C.RNG(4); let placed = 0;
      while (placed < 70) { const a = rng.range(0, 6.283), r = rng.range(75, 150), x = Math.cos(a) * r + 10, z = Math.sin(a) * r;
        const t = new T.Mesh(new T.CylinderGeometry(.25, .35, 5, 6), trunk); t.position.set(x, 2.5, z); t.castShadow = true; scene.add(t); const k = new T.Mesh(new T.ConeGeometry(2.2, 6, 7), leaf); k.position.set(x, 7, z); k.castShadow = true; scene.add(k); game.space.addCircle(x, z, .4, 6); placed++; }
      return { sun, hemi, ground };
    },
    /* Light follows the clock: dim and bluish at night, warm low sun at dawn and dusk. */
    light(eng, env, player, game) {
      const h = game.time.hour + game.time.date.getUTCMinutes() / 60, day = Math.max(0, Math.sin((h - 6.5) / 11 * Math.PI)), T = eng.THREE;
      env.hemi.intensity = 0.18 + 0.75 * day; env.sun.intensity = 1.15 * day;
      const ang = (h - 6) / 12 * Math.PI; env.sun.position.set(player.x + Math.cos(ang) * 60, 40 + 30 * Math.sin(ang), player.z + 25); env.sun.target.position.set(player.x, 0, player.z);
      const sky = new T.Color(0x0b0f18).lerp(new T.Color(0xa9b3b8), Math.min(1, day * 1.4)); eng.scene.background.copy(sky); eng.scene.fog.color.copy(sky);
    }
  };
})(Command);
