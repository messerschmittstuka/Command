(function (C) {
  'use strict';
  const clamp = C.util.clamp;
  /* Player controller: movement with the shared collision world, plus first- and third-person cameras (toggle with V). */
  class Player {
    constructor(space, start) { this.space = space; this.x = start.x; this.z = start.z; this.y = 0; this.vy = 0; this.yaw = start.heading || 0; this.pitch = 0; this.view = 'first'; this.speed = 0; }
    look(dx, dy) { this.yaw -= dx * 0.0022; this.pitch = clamp(this.pitch - dy * 0.0022, -1.3, 1.3); }
    update(dt, keys) {
      const f = (keys.KeyW ? 1 : 0) - (keys.KeyS ? 1 : 0), r = (keys.KeyD ? 1 : 0) - (keys.KeyA ? 1 : 0), l = Math.hypot(f, r) || 1;
      const sp = (keys.ShiftLeft || keys.ShiftRight ? 4.2 : 2.4), fx = -Math.sin(this.yaw), fz = -Math.cos(this.yaw), rx = Math.cos(this.yaw), rz = -Math.sin(this.yaw);
      const vx = (fx * f + rx * r) / l * sp, vz = (fz * f + rz * r) / l * sp; this.speed = Math.hypot(vx, vz) * (f || r ? 1 : 0);
      const p = { x: this.x, y: this.y, z: this.z }; this.space.move(p, vx * dt, vz * dt, .4, 1.75); this.vy = this.space.settle(p, this.vy, dt);
      this.x = p.x; this.y = p.y; this.z = p.z;
    }
    /* Facing for NPC maths uses the same convention as soldiers: heading = atan2(x, z); the camera looks along (-sin yaw, -cos yaw). */
    get heading() { return this.yaw + Math.PI; }
    place(camera, THREE) {
      const eye = 1.65, fx = -Math.sin(this.yaw) * Math.cos(this.pitch), fy = Math.sin(this.pitch), fz = -Math.cos(this.yaw) * Math.cos(this.pitch);
      if (this.view === 'first') { camera.position.set(this.x, this.y + eye, this.z); camera.lookAt(this.x + fx, this.y + eye + fy, this.z + fz); }
      else { const d = 3.4; camera.position.set(this.x - fx * d, this.y + 2.1 - fy * d * .6, this.z - fz * d); camera.lookAt(this.x, this.y + 1.5, this.z); }
    }
  }
  C.Player = Player;
})(Command);
