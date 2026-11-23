(function (C) {
  'use strict';
  /* Engine: Three.js bootstrap and asset decoding. Three.js is imported from a CDN (see the importmap in the page shell);
     models and textures are embedded in the page as base64 (Command.assets) so the game is one file. */
  const b64ToBytes = b64 => { const s = atob(b64), a = new Uint8Array(s.length); for (let i = 0; i < s.length; i++) a[i] = s.charCodeAt(i); return a; };
  C.Engine = {
    async create(canvas) {
      const THREE = await import('three');
      const { GLTFLoader } = await import('three/addons/loaders/GLTFLoader.js');
      const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
      renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2)); renderer.setSize(window.innerWidth, window.innerHeight);
      renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap;
      const scene = new THREE.Scene(), camera = new THREE.PerspectiveCamera(70, window.innerWidth / window.innerHeight, 0.1, 500);
      scene.add(camera);
      const eng = { THREE, GLTFLoader, renderer, scene, camera, gltf: {}, tex: {} };
      window.addEventListener('resize', () => { renderer.setSize(window.innerWidth, window.innerHeight); camera.aspect = window.innerWidth / window.innerHeight; camera.updateProjectionMatrix(); });
      return eng;
    },
    loadGLB(eng, name) {
      if (eng.gltf[name]) return Promise.resolve(eng.gltf[name]);
      const bytes = b64ToBytes(C.assets.glb[name]);
      return new Promise((res, rej) => new eng.GLTFLoader().parse(bytes.buffer, '', g => { eng.gltf[name] = g; res(g); }, rej));
    },
    loadTexture(eng, name, repeat) {
      const T = eng.THREE, t = new T.TextureLoader().load('data:image/jpeg;base64,' + C.assets.tex[name]);
      t.wrapS = t.wrapT = T.RepeatWrapping; t.repeat.set(repeat, repeat); t.colorSpace = T.SRGBColorSpace; t.anisotropy = 4; return t;
    }
  };
})(Command);
