(function (C) {
  'use strict';
  /* Period-correct infantry equipment for 1916 (introduced = year the item enters service in this game). */
  C.data = C.data || {};
  C.data.equipment = {
    lebel: { name: 'Fusil Lebel Mle 1886/93', army: 'french', type: 'rifle', introduced: 1893, magazine: 8, roundsPerMan: 120 },
    berthier: { name: 'Fusil Berthier Mle 1907/15', army: 'french', type: 'rifle', introduced: 1915, magazine: 3, roundsPerMan: 120 },
    adrian: { name: 'Casque Adrian', army: 'french', type: 'helmet', introduced: 1915 },
    gew98: { name: 'Gewehr 98', army: 'german', type: 'rifle', introduced: 1898, magazine: 5, roundsPerMan: 120 },
    stahlhelm: { name: 'Stahlhelm M1916', army: 'german', type: 'helmet', introduced: 1916 },
    pickelhaube: { name: 'Pickelhaube (cloth cover)', army: 'german', type: 'helmet', introduced: 1842 }
  };
})(Command);
