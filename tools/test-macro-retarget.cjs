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
    head:{appendChild() {}},hasFocus:()=>true,createElement:()=>({}),querySelectorAll:()=>[],
    getElementById:id=>id==='macro-on'?indicator:id==='canvas'?canvas:null,
    querySelector:selector=>selector==='#hud.show'?{}:selector==='#respawn.show'&&!alive?{}:null
  },
  window:{addEventListener:(event,fn)=>(listeners[event]??=[]).push(fn)},
  bar:{bRow:1,bRow2:-1}, BAR_COLS:[0], macroRow:0, targetData:monster(10),
  macroIds:()=>[101,102],
  Module:{ccall(name,returnType,types,args){
    if(name==='viewer_macro'){assert.deepEqual([...args],['']);commands.push('stop');}
    else{assert.equal(name,'viewer_tab_target');commands.push('tab');}
  }},
  toggleMacro(row){
    commands.push(ctx.macroRow===row?'stop':['start',row,ctx.targetData.id]);
    if(ctx.macroRow!==row){ctx.macroRow=row;indicator.hidden=false;}
  }
});
vm.runInContext(code,ctx);
ctx.inputs();
const bridge=ctx.window.__thor;
const passiveInput={
  code:'Tab',target:canvas,isTrusted:false,preventDefault(){throw Error('Synthetic input must not be captured');},
  stopImmediatePropagation(){throw Error('Synthetic input must not be captured');}
};
for(const handler of listeners.keydown)handler(passiveInput);
for(const handler of listeners.click)handler({...passiveInput,target:{closest:()=>true}});
assert.deepEqual(commands,[],'Synthetic keyboard and pointer events never restart the macro');
function render(count=1){
  for(let i=0;i<count;i++){
    now+=16;
    if(next){ctx.targetData=next;next=null;}
    for(const frame of frames.splice(0))frame();
  }
}
function ackOff(){indicator.hidden=true;ctx.macroRow=-1;}
render(5);
assert.deepEqual(commands,[],'An active macro does not restart during idle frames');
assert.equal(bridge.combat('target'),true);
assert.deepEqual(commands,['stop','tab'],'L1 cancels the active macro before changing targets');
next=monster(20);render();
assert.deepEqual(commands,['stop','tab'],'Do not restart while the server still reports ON');
next=monster(30);
assert.equal(bridge.combat('target'),true);
assert.deepEqual(commands,['stop','tab','tab'],'Rapid L1 presses share the same stop request');
ackOff();render();
assert.deepEqual(commands,['stop','tab','tab',['start',0,30]],'Restart on the first confirmed frame, on the most recent target');
render(8);
assert.equal(commands.length,4,'A completed restart never arms itself again');
bridge.combat('target');ackOff();render();
assert.equal(commands.at(-1),'tab','Wait for the viewer if the target has not changed yet');
render();
assert.deepEqual(commands.at(-1),['start',0,30],'The same monster remains valid when there is no alternative');
next=monster(40);bridge.combat('target');
assert.equal(bridge.runMacro(0),true);
ackOff();render(2);
assert.equal(commands.at(-1),'tab','A manual stop cancels the pending restart');
next=monster(50);bridge.combat('target');render(2);
assert.equal(commands.at(-1),'tab','Selecting a monster with macro off never starts it');
ctx.macroRow=0;indicator.hidden=false;
next=monster(60);bridge.combat('target');
alive=false;ackOff();render(2);
assert.equal(commands.at(-1),'tab','A death prevents the restart');
console.log('L1 stops before Tab, resumes on the first confirmed target, and respects manual stop.');

const panelSource = fs.readFileSync('assets/panel.html', 'utf8');
const releaseCode = panelSource.slice(panelSource.indexOf('window.padRelease='), panelSource.indexOf('window.resetPad='));
const releaseCalls = [];
const lower = vm.createContext({
  window:{},physical:{BUTTON_L1:4},localHeld:new Set(),drawController(){},capture:null,
  l1Used:false,mode:false,d:{nativeMenu:null},runAssigned:key=>releaseCalls.push(key)
});
vm.runInContext(releaseCode, lower);
lower.window.padRelease('BUTTON_L1');
assert.deepEqual(releaseCalls,[],'Losing focus mid-press can leave an orphan release');
lower.localHeld.add(4);
lower.window.padRelease('BUTTON_L1');
lower.window.padRelease('BUTTON_L1');
assert.deepEqual(releaseCalls,['L1'],'A paired release runs the binding exactly once');
console.log('Idle frames, synthetic events and unmatched controller releases do not restart macros.');
