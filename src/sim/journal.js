(function (C) {
  'use strict';
  /* Routine information lands in the journal; urgent orders go through the CommunicationSystem (later stage). */
  class Journal {
    constructor(time) { this.time = time; this.entries = []; }
    add(category, text, meta) { const e = { t: this.time.minutes, when: this.time.format(), category, text, meta: meta || null }; this.entries.push(e); return e; }
    last(n = 10, category) { const l = category ? this.entries.filter(e => e.category === category) : this.entries; return l.slice(-n); }
  }
  C.Journal = Journal;
})(Command);
