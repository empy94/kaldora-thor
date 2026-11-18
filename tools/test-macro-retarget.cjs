const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');

const source = fs.readFileSync('tools/game-adapter.cjs', 'utf8');
const code = source.slice(source.indexOf('function inputs()'), source.indexOf('function view('));
const indicator = {hidden:false};
const canvas = {focus() {}};
const commands = [], frames = [], listeners = {};
let now = 100, alive = true, next = null;
const monster = id => ({id,monster:true,pc:false,dead:false});
const ctx = vm.createContext({
  navigator:{}, Date:{now:()=>now}, setInterval(){}, requestAnimationFrame:fn=>frames.push(fn),
  document:{
    head:{appendChild() {}},createElement:()=>({}),querySelectorAll:()=>[],
    getElementById:id=>id==='macro-on'?indicator:id==='canvas'?canvas:null,
    querySelector:selector=>selector==='#hud.show'?{}:selector==='#respawn.show'&&!alive?{}:null
  },
  window:{addEventListener:(event,fn)=>(listeners[event]??=[]).push(fn)},
  bar:{bRow:1,bRow2:-1}, BAR_COLS:[0], macroRow:0, targetData:monster(10),
  macroIds:()=>[101,102],
  Module:{ccall(name){assert.equal(name,'viewer_tab_target');commands.push('tab');}},
  toggleMacro(row){
    commands.push(ctx.macroRow===row?'stop':['start',row,ctx.targetData.id]);
    if(ctx.macroRow!==row){ctx.macroRow=row;indicator.hidden=false;}
  }
});
vm.runInContext(code,ctx);
ctx.inputs();
const bridge=ctx.window.__thor;
function render(count=1){
  for(let i=0;i<count;i++){
    now+=16;
    if(next){ctx.targetData=next;next=null;}
    for(const frame of frames.splice(0))frame();
  }
}
function ackOff(){indicator.hidden=true;ctx.macroRow=-1;}
assert.equal(bridge.combat('target'),true);
render(2);
assert.deepEqual(commands,['tab'],'The unchanged target must not restart the macro');
next=monster(20);render(2);
assert.deepEqual(commands,['tab','stop']);
next=monster(30);
assert.equal(bridge.combat('target'),true);
ackOff();
render();
assert.deepEqual(commands,['tab','stop','tab'],'Wait for the new target to be drawn');
render();
assert.deepEqual(commands,['tab','stop','tab',['start',0,30]]);
next=monster(40);bridge.combat('target');render(2);
assert.equal(commands.at(-1),'stop');
assert.equal(bridge.runMacro(0),true);
ackOff();render(2);
assert.equal(commands.at(-1),'stop','A manual stop cancels the pending restart');
next=monster(50);bridge.combat('target');render(2);
assert.equal(commands.at(-1),'tab','Selecting a monster with macro off never starts it');
ctx.macroRow=0;indicator.hidden=false;
next=monster(60);bridge.combat('target');render(2);
assert.equal(commands.at(-1),'stop');
alive=false;ackOff();render(2);
assert.equal(commands.at(-1),'stop','A death prevents the restart');
console.log('Next Monster waits for confirmed target and macro stop, skips unchanged targets, and respects manual stop.');
