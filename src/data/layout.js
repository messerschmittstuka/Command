(function (C) {
  'use strict';
  /* Where things stand in the rear-area village (metres, x east, z south). Pure data: renderer and simulation share it. */
  C.data = C.data || {};
  C.data.layout = {
    buildings: [
      { id: 'hq', model: 'bld_house_i3_w12_d10_f3', x: -24, z: -16, quarter: 0, label: 'Battalion headquarters' },
      { id: 'billet', model: 'bld_house_i2_w12_d10_f2', x: 6, z: -16, quarter: 0, label: 'Section billet' },
      { id: 'church', model: 'bld_church_w9_d23_f4', x: 40, z: -24, quarter: 0, label: 'Church' },
      { id: 'ruin1', model: 'bld_ruin_f2_w14_d12_f2', x: -24, z: 18, quarter: 2, label: 'Ruined house' },
      { id: 'ruin2', model: 'bld_ruin_f3_w14_d12_f3', x: 4, z: 20, quarter: 2, label: 'Ruined house' },
      { id: 'ruin3', model: 'bld_ruin_f4_w14_d12_f4', x: 36, z: 18, quarter: 2, label: 'Ruined house' }
    ],
    places: { billet: { x: 6, z: -4 }, parade: { x: -6, z: 6 }, yard: { x: 12, z: -2 }, dump: { x: -34, z: 6 }, hq: { x: -24, z: -4 }, start: { x: -10, z: 2, heading: 0 } },
    props: [ // [glbRoot, x, z, yaw radians, collide half-extents hx, hz or null]
      ['prop_sandbag_wall', -34, 12, 0, 1.4, .4], ['prop_sandbag_wall', -31, 12, 0, 1.4, .4], ['prop_crate_ammo', -36, 4, .3, .5, .4], ['prop_crate_ammo', -35.4, 5, 1, .5, .4],
      ['prop_crate_wood', -33, 3, 0, .6, .5], ['prop_barrel_oil', -32, 6, 0, .35, .35], ['prop_fence_wood', 14, -9, 0, 1.5, .1], ['prop_fence_wood', 17, -9, 0, 1.5, .1],
      ['prop_wire_coil', 46, 4, 0, 1, 1], ['prop_hedgehog', 49, 7, .5, .9, .9], ['prop_rubble_pile_a', -6, 24, 0, 1.2, 1.2], ['prop_rock_boulder_a', 22, 12, 0, .9, .9]
    ]
  };
})(Command);
