'use strict';
const assert = require('node:assert/strict');
const { readNativeControllerSettings: read } = require('./native-controller-contract.cjs');
for (const text of [null, '', '{', '{}', '{"pad":{"map":[]}}', '{"pad":{"bind":[]}}'])
  assert.equal(read(text).available, false);
const input = JSON.stringify({ pad: { bind: { '0':'act', '1':'m:3', '2':'s:681', '3':'k:KeyW:s', '16':'lock', 'C4_7':'buffs', 'C4_4':'menu', '17':'act', '4':'m:9', '5':'k:KeyW:evil', '6':'', '7':'interact' } } });
const result = read(input);
assert.equal(result.available, true);
assert.deepEqual(result.bindings, { '0':'act', '1':'m:3', '2':'s:681', '3':'k:KeyW:s', '6':'', '7':'interact', '16':'lock', 'C4_7':'buffs' });
assert.deepEqual(result.unsupported.sort(), ['17','4','5','C4_4'].sort());
assert.equal(read('{"pad":{"bind":{}}}').available, true);
assert.equal(read(JSON.stringify({pad:{bind:{'0':'act'}}})).bindings['0'], 'act');
console.log('Native controller contract: supported mappings, invalid values and missing settings passed.');
