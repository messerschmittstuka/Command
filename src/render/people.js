(function (C) {
  'use strict';
  /* People: low-poly soldiers built from primitives (no soldier model exists in the reused assets).
     French: horizon blue with Adrian helmet. German (1916): field grey with cloth-covered Pickelhaube. Officers wear a peaked cap. */
  const LOOK = {
    french: { coat: 0x7d90ab, trousers: 0x6c7f9a, helmet: 0x6e82a0, boots: 0x3a2a20, officerCap: 0x7d90ab },
    german: { coat: 0x6e7166, trousers: 0x666a60, helmet: 0x6a6d63, boots: 0x2c2218, officerCap: 0x6e7166 }
  };
  C.People = {
    make(eng, army, kind) {
      const T = eng.THREE, look = LOOK[army], g = new T.Group(), M = c => new T.MeshLambertMaterial({ color: c });
      const box = (w, h, d, c, x, y, z) => { const m = new T.Mesh(new T.BoxGeometry(w, h, d), M(c)); m.position.set(x, y, z); m.castShadow = true; g.add(m); return m; };
      const officer = kind === 'officer' || kind === 'nco';
      const legL = box(.17, .85, .2, look.trousers, -.11, .45, 0), legR = box(.17, .85, .2, look.trousers, .11, .45, 0);
      legL.geometry.translate(0, -.1, 0); legR.geometry.translate(0, -.1, 0); legL.position.y = .85; legR.position.y = .85; // pivot at the hip
      box(.2, .12, .26, look.boots, -.11, .06, .03); box(.2, .12, .26, look.boots, .11, .06, .03);
      box(.44, .6, .26, look.coat, 0, 1.15, 0); box(.46, .08, .28, 0x4a3a2a, 0, .88, 0);
      box(.12, .5, .14, look.coat, -.28, 1.15, 0); box(.12, .5, .14, look.coat, .28, 1.15, 0);
      box(.2, .22, .2, 0xd9a98a, 0, 1.58, 0);
      if (kind === 'officer') { box(.26, .1, .3, look.officerCap, 0, 1.74, 0); box(.26, .02, .12, 0x222222, 0, 1.7, .2); }
      else if (army === 'french') { const h = new T.Mesh(new T.SphereGeometry(.15, 10, 6, 0, Math.PI * 2, 0, Math.PI / 2), M(look.helmet)); h.position.set(0, 1.64, 0); h.castShadow = true; g.add(h); box(.04, .1, .3, look.helmet, 0, 1.76, 0); }
      else { const h = new T.Mesh(new T.SphereGeometry(.15, 10, 6, 0, Math.PI * 2, 0, Math.PI / 2), M(look.helmet)); h.position.set(0, 1.66, 0); h.castShadow = true; g.add(h); const s = new T.Mesh(new T.ConeGeometry(.02, .1, 6), M(0x888888)); s.position.set(0, 1.84, 0); g.add(s); }
      if (kind !== 'officer') { const r = box(.04, .04, 1.3, 0x5a3b20, .26, 1.0, .35); r.rotation.x = -.3; }   // rifle slung forward
      box(.3, .3, .1, 0x5b4a33, 0, 1.1, -.17);                                                                // pack
      return { group: g, legL, legR, phase: Math.random() * 6, animate(speed, dt) { this.phase += speed * dt * 3.2; const a = Math.min(.7, speed * .3); this.legL.rotation.x = Math.sin(this.phase) * a; this.legR.rotation.x = -Math.sin(this.phase) * a; } };
    }
  };
})(Command);
