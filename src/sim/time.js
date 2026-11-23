(function (C) {
  'use strict';
  /* TimeManager: the world advances continuously in game minutes. Systems subscribe to 'hour' and 'day'.
     Scheduled events fire at exact times and can interrupt fast-forward (the advance loop stops after an
     event flagged `interrupt`). */
  const START = Date.UTC(1916, 1, 21, 6, 0); // 21 Feb 1916, the opening of the German offensive at Verdun
  class TimeManager {
    constructor(bus) { this.bus = bus; this.minutes = 0; this.queue = []; this.nextId = 1; this.stopped = null; }
    get date() { return new Date(START + this.minutes * 60000); }
    get hour() { return this.date.getUTCHours(); }
    get day() { return Math.floor((this.date.getTime() - Date.UTC(1916, 1, 21)) / 86400000); }
    format() { return this.date.toISOString().slice(0, 16).replace('T', ' '); }
    schedule(atMinutes, type, data, opts = {}) { const ev = { id: this.nextId++, at: atMinutes, type, data, interrupt: !!opts.interrupt }; this.queue.push(ev); this.queue.sort((a, b) => a.at - b.at); return ev.id; }
    scheduleIn(minutes, type, data, opts) { return this.schedule(this.minutes + minutes, type, data, opts); }
    cancel(id) { this.queue = this.queue.filter(e => e.id !== id); }
    /* Advance by `minutes`; returns the minutes actually advanced (less than asked if an event interrupted). */
    advance(minutes) {
      this.stopped = null; let left = minutes, done = 0;
      while (left > 0) {
        const toHour = 60 - (this.minutes % 60);
        const nextEv = this.queue.length ? this.queue[0].at - this.minutes : Infinity;
        const step = Math.max(0, Math.min(left, toHour, nextEv));
        this.minutes += step; left -= step; done += step;
        while (this.queue.length && this.queue[0].at <= this.minutes) {
          const ev = this.queue.shift(); this.bus.emit(ev.type, ev.data);
          if (ev.interrupt) { this.stopped = ev; return done; }
        }
        if (this.minutes % 60 === 0 && step > 0) {
          this.bus.emit('hour', { hour: this.hour, minutes: this.minutes });
          if (this.hour === 6) this.bus.emit('day', { day: this.day });
        }
        if (step === 0 && !this.queue.length) break;
      }
      return done;
    }
    toJSON() { return { minutes: this.minutes, queue: this.queue, nextId: this.nextId }; }
    static fromJSON(bus, j) { const t = new TimeManager(bus); t.minutes = j.minutes; t.queue = j.queue; t.nextId = j.nextId; return t; }
  }
  C.TimeManager = TimeManager;
})(Command);
