const assert = require('node:assert/strict');
const fs = require('node:fs');
const source = fs.readFileSync(require('node:path').join(__dirname, 'usb-bridge.cjs'), 'utf8');
const start = source.indexOf('  state.socketGearType=item=>{');
const end = source.indexOf('  state.runMacro=(row)=>{', start);
assert(start >= 0 && end > start, 'socket rules missing');
const state = {};
new Function('state', source.slice(start, end))(state);
const makeStone = fx => ({conv:2,fx,count:1});
const weapon = makeStone('Fits: weapon');
const shield = makeStone('Fits: leggings, shield');
const pairs = [[2,'armour'],[3,'helmet'],[4,'gloves'],[5,'gloves'],[6,'leggings'],[7,'boots'],[10,'weapon'],[11,'ring'],[12,'ring'],[13,'necklace']];
for (const [part,category] of pairs) {
  const item={part,st:{dmax:0}};
  assert.equal(state.socketGearType(item),category,`part ${part}`);
  assert.equal(state.socketCompatible(item,makeStone(`Fits: ${category}`)),true,`part ${part} matches`);
  assert.equal(state.socketCompatible(item,makeStone('Fits: unrelated')),false,`part ${part} mismatch`);
}
const dagger={part:9,st:{dmax:24}}, buckler={part:9,st:{dmax:0}};
assert.equal(state.socketGearType(dagger),'weapon');
assert.equal(state.socketGearType(buckler),'shield');
assert.equal(state.socketCompatible(dagger,weapon),true);
assert.equal(state.socketCompatible(dagger,shield),false);
assert.equal(state.socketCompatible(buckler,weapon),false);
assert.equal(state.socketCompatible(buckler,shield),true);
assert.equal(state.socketCompatible({part:9,st:{}},shield),false);
assert.equal(state.socketCompatible({part:99,st:{dmax:10}},weapon),false);
for(const extra of [{equipped:true},{shop:true},{bank:true},{trade:true},{count:0},{conv:1},{fx:''}])
 assert.equal(state.socketCompatible(dagger,{...weapon,...extra}),false,JSON.stringify(extra));
console.log('Socket compatibility: all category, dagger, shield and unknown cases passed.');
