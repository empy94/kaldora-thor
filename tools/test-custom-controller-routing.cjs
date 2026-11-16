const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const code=fs.readFileSync(require('node:path').join(__dirname,'usb-bridge.cjs'),'utf8');
const fragment=code.slice(code.indexOf('function inputs() {'),code.indexOf('function view('));
const handlers={},output=[];let skillTiles=[],tileClicks=0;const window={addEventListener:(type,fn)=>(handlers[type]??=[]).push(fn)};
const gamepad={mapping:'',axes:[.5,-.6,0,0],buttons:Array.from({length:17},()=>({pressed:true,touched:true,value:1}))};
const navigator={getGamepads:()=>[gamepad]};const canvas={dispatchEvent:e=>output.push(e)};
const document={head:{appendChild(){}},documentElement:{classList:{add(){}}},querySelectorAll:s=>s.startsWith('#bar-rows .skill')?skillTiles:[],querySelector:s=>s==='#hud.show'?{}:null,getElementById:id=>id==='canvas'?canvas:null,createElement:()=>({textContent:''}),hasFocus:()=>true};
class KeyboardEvent{constructor(type,options){this.type=type;Object.assign(this,options)}}
const bar={bRow:1,bRow2:-1};let calls=[],nativeCalls=[];const ctx={window,document,navigator,KeyboardEvent,localStorage:{getItem:()=>null},requestAnimationFrame(){},setInterval(){},Date,Module:{ccall(){}},bar,BAR_COLS:[0],macroRow:-1,macroIds:()=>[42,43],toggleMacro:row=>{calls.push(row);ctx.macroRow=row},slotSkill:()=>({id:42}),skillList:[{id:80,tid:670,passive:false}],padTapValue:v=>nativeCalls.push(v),padFrame(){},macroSpan(){},getComputedStyle:()=>({visibility:'visible'})};
vm.createContext(ctx);vm.runInContext(fragment,ctx);ctx.inputs();window.__thor.bind={'4':{type:'spell',value:'55'},'6':{type:'macro',value:'1'}};
const pad=navigator.getGamepads()[0];assert.equal(pad.buttons[2].pressed,false,'custom X masked from native');assert.equal(pad.buttons[5].pressed,false,'custom R1 masked from native');assert.equal(pad.buttons[0].pressed,true,'unbound A remains native');assert.equal(pad.buttons[4].pressed,false,'L1 controlled by companion');assert.deepEqual([...pad.axes],[.5,-.6,0,0]);
let stopped=false;for(const fn of handlers.keydown||[])fn({type:'keydown',target:window,isTrusted:false,code:'KeyW',stopImmediatePropagation(){stopped=true}});assert.equal(stopped,true);assert.equal(output.length,1);assert.equal(output[0].code,'KeyW');assert.equal(output[0].keyCode,87);
window.__thor.bind['4']={type:'spell',value:'t:670'};assert.equal(window.__thor.performBinding('4'),true);assert.deepEqual(nativeCalls,['s:670']);
skillTiles=[{dataset:{skillTip:'670',id:'80'},classList:{contains:c=>c==='nomp'},click(){tileClicks++}}];assert.equal(window.__thor.performBinding('4'),false);assert.equal(tileClicks,0);assert.deepEqual(nativeCalls,['s:670']);
skillTiles[0].classList.contains=()=>false;assert.equal(window.__thor.performBinding('4'),true);assert.equal(tileClicks,1);
skillTiles=[{dataset:{skillTip:'999',id:'55'},classList:{contains:()=>false},click(){tileClicks++}}];window.__thor.bind['4']={type:'spell',value:'55'};assert.equal(window.__thor.performBinding('4'),false);assert.equal(tileClicks,1);assert.deepEqual(nativeCalls,['s:670']);
assert.equal(window.__thor.runMacro('0'),true);assert.deepEqual(calls,[0]);assert.equal(window.__thor.runMacro('1'),true);assert.deepEqual(calls,[0,1]);
console.log('Custom/native input ownership, movement translation and native macro execution passed.');
