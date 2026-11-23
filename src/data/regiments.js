(function (C) {
  'use strict';
  /* Starting regiments for the vertical slice (Verdun, February 1916). More are added as data only. */
  C.data = C.data || {};
  C.data.regiments = {
    fr_146ri: { id: 'fr_146ri', army: 'french', name: '146e Régiment d\'Infanterie', short: '146e RI', home: 'Toul', founded: 1793,
      kit: { rifle: 'lebel', helmet: 'adrian' }, notes: 'Held the Meuse sector before the German offensive.' },
    fr_95ri: { id: 'fr_95ri', army: 'french', name: '95e Régiment d\'Infanterie', short: '95e RI', home: 'Bourges', founded: 1793,
      kit: { rifle: 'lebel', helmet: 'adrian' }, notes: 'Line infantry on the Côtes de Meuse.' },
    de_ir87: { id: 'de_ir87', army: 'german', name: 'Infanterie-Regiment Nr. 87', short: 'IR 87', home: 'Mainz', founded: 1813,
      kit: { rifle: 'gew98', helmet: 'pickelhaube' }, notes: 'Attacked north of Verdun on 21 February 1916.' },
    de_ir24: { id: 'de_ir24', army: 'german', name: 'Infanterie-Regiment Nr. 24', short: 'IR 24', home: 'Neuruppin', founded: 1813,
      kit: { rifle: 'gew98', helmet: 'pickelhaube' }, notes: 'Brandenburg regiment in the Verdun offensive.' }
  };
})(Command);
