const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');

const source = fs.readFileSync('tools/game-adapter.cjs', 'utf8');
const code = source.slice(source.indexOf('function inputs()'), source.indexOf('let snapshot, currentPage;'));
let now = 100, online = true, hasTarget = true;
const callbacks = {};
const casts = [];
const window = {addEventListener(name, handler) { (callbacks[name] ??= []).push(handler); }};
const basic = {id: 1};
const document = {
  hasFocus: () => true,
  getElementById: () => null,
  querySelector: selector => selector === '#hud.show' && online ? {} : null,
  querySelectorAll: () => [],
  createElement: () => ({}),
  head: {appendChild() {}}
};
const context = vm.createContext({
  window, document, navigator: {}, setInterval() {},
  Date: {now: () => now},
  skillList: [basic],
  Module: {ccall(name) { assert.equal(name, 'viewer_target_if_none'); return hasTarget ? 0 : 1; }},
  castSkill: (skill, forced) => casts.push([skill.id, forced])
});
vm.runInContext(code, context);
context.inputs();
const setPK = value => context.action({type:'pk', value});
const key = (code, options = {}) => {
  const event = {code, stopped:false, preventDefault() {}, stopImmediatePropagation() { this.stopped = true; }, ...options};
  for (const handler of callbacks.keydown) { handler(event); if (event.stopped) break; }
  return event;
};
assert.equal(window.__thor.pk, false);
assert.equal(context.valid({type:'pk', value:'on'}), false);
assert.equal(setPK(true), true);
assert.deepEqual(casts, [], 'Toggling does not attack');
assert.equal(key('Space').stopped, true);
assert.deepEqual(casts, [[1, true]]);
key('Space', {repeat:true});
assert.equal(casts.length, 1);
assert.equal(key('Digit4').ctrlKey, true);
assert.equal(key('KeyI').ctrlKey, undefined);
assert.equal(key('Space', {target:{closest: () => true}}).stopped, false);
assert.equal(window.__thor.combat('attack'), true);
assert.equal(casts.length, 2);
hasTarget = false;
assert.equal(window.__thor.combat('attack'), true);
assert.equal(casts.length, 2, 'With no target, native selection runs first');
assert.equal(setPK(false), true);
assert.equal(key('Digit4').ctrlKey, undefined);
assert.equal(key('Space').stopped, false);
assert.equal(setPK(true), true);
now = 5000;
context.inputs();
assert.equal(window.__thor.pk, false, 'An expired bridge resets to OFF');
assert.equal(setPK(true), true);
online = false;
context.view(context.inputs);
assert.equal(window.__thor.pk, false, 'Leaving the character resets to OFF');
console.log('PK arm/disarm, attack routing and reset checks passed.');

