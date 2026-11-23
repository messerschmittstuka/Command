(function (C) {
  'use strict';
  /* Rank tables per army. `level` is a common scale used for seniority and command limits.
     `command` is the formation a holder of that rank normally commands. */
  C.data = C.data || {};
  C.data.ranks = {
    french: [
      { id: 'soldat', name: 'Soldat', level: 1, nco: false }, { id: 'caporal', name: 'Caporal', level: 2, nco: true },
      { id: 'sergent', name: 'Sergent', level: 3, nco: true }, { id: 'adjudant', name: 'Adjudant', level: 4, nco: true },
      { id: 'souslieutenant', name: 'Sous-lieutenant', level: 5, nco: false, command: 'section' },
      { id: 'lieutenant', name: 'Lieutenant', level: 6, nco: false, command: 'section' },
      { id: 'capitaine', name: 'Capitaine', level: 7, nco: false, command: 'company' },
      { id: 'commandant', name: 'Commandant', level: 8, nco: false, command: 'battalion' },
      { id: 'lieutenantcolonel', name: 'Lieutenant-colonel', level: 9, nco: false, command: 'battalion' },
      { id: 'colonel', name: 'Colonel', level: 10, nco: false, command: 'regiment' }
    ],
    german: [
      { id: 'musketier', name: 'Musketier', level: 1, nco: false }, { id: 'gefreiter', name: 'Gefreiter', level: 2, nco: true },
      { id: 'unteroffizier', name: 'Unteroffizier', level: 3, nco: true }, { id: 'feldwebel', name: 'Feldwebel', level: 4, nco: true },
      { id: 'leutnant', name: 'Leutnant', level: 5, nco: false, command: 'section' },
      { id: 'oberleutnant', name: 'Oberleutnant', level: 6, nco: false, command: 'section' },
      { id: 'hauptmann', name: 'Hauptmann', level: 7, nco: false, command: 'company' },
      { id: 'major', name: 'Major', level: 8, nco: false, command: 'battalion' },
      { id: 'oberstleutnant', name: 'Oberstleutnant', level: 9, nco: false, command: 'battalion' },
      { id: 'oberst', name: 'Oberst', level: 10, nco: false, command: 'regiment' }
    ]
  };
  C.data.rank = (army, id) => C.data.ranks[army].find(r => r.id === id);
})(Command);
