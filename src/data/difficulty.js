(function (C) {
  'use strict';
  /* Presets only. None of these just scale enemy health or numbers: they change information quality,
     supply, morale resilience, discipline and how hard the chain of command judges failure. */
  C.data = C.data || {};
  C.data.difficulty = {
    cadet:   { name: 'Cadet',   aiSkill: 0.4, aiAdapt: 0.3, intelReliability: 0.9, supply: 1.2, moraleResilience: 1.2, discipline: 1.1, careerHarshness: 0.6 },
    officer: { name: 'Officer', aiSkill: 0.6, aiAdapt: 0.55, intelReliability: 0.75, supply: 1.0, moraleResilience: 1.0, discipline: 1.0, careerHarshness: 1.0 },
    veteran: { name: 'Veteran', aiSkill: 0.8, aiAdapt: 0.8, intelReliability: 0.55, supply: 0.8, moraleResilience: 0.85, discipline: 0.9, careerHarshness: 1.4 }
  };
})(Command);
