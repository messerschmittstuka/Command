(function (C) {
  'use strict';
  const clamp = (v, lo = 0, hi = 1) => v < lo ? lo : v > hi ? hi : v;
  const lerp = (a, b, t) => a + (b - a) * t;
  /* Seeded RNG (mulberry32) so a campaign is reproducible and save/load is exact. State is one integer. */
  class RNG {
    constructor(seed) { this.s = (seed >>> 0) || 1; }
    next() { let t = this.s += 0x6D2B79F5; t = Math.imul(t ^ t >>> 15, t | 1); t ^= t + Math.imul(t ^ t >>> 7, t | 61); this.s = this.s >>> 0; return ((t ^ t >>> 14) >>> 0) / 4294967296; }
    range(a, b) { return a + (b - a) * this.next(); }
    int(a, b) { return Math.floor(this.range(a, b + 1)); }
    chance(p) { return this.next() < p; }
    pick(arr) { return arr[Math.floor(this.next() * arr.length)]; }
  }
  /* Tiny publish/subscribe bus. Systems talk through events instead of importing each other. */
  class EventBus {
    constructor() { this.h = {}; }
    on(type, fn) { (this.h[type] = this.h[type] || []).push(fn); return () => this.off(type, fn); }
    off(type, fn) { this.h[type] = (this.h[type] || []).filter(f => f !== fn); }
    emit(type, data) { for (const f of (this.h[type] || []).slice()) f(data); }
  }
  C.util = { clamp, lerp };
  C.RNG = RNG;
  C.EventBus = EventBus;
})(Command);
