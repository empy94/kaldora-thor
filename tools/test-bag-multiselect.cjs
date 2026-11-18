const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');

const source = fs.readFileSync('tools/game-adapter.cjs', 'utf8');
const code = source.slice(source.indexOf('function inputs()'), source.indexOf('let snapshot, currentPage;'));
const selector = '#inv-grid .slot[data-item]';
const items = [{id:1,layer:0},{id:2,layer:0},{id:3,layer:0,locked:true}];
const classList = {add() {}, remove() {}};
let focused = null, nativeClicks = 0, nextFrame;
const inventory = {
  id:'inventory', classList, closest:()=>null, matches:()=>false,
  contains: node=>node?.parentElement===grid, getClientRects:()=>[1],
  querySelectorAll: ()=>grid.children
};
const grid = {id:'inv-grid',parentElement:inventory,children:[]};
inventory.children=[grid];
const pad={mapping:'standard',connected:true,axes:[0,0],buttons:Array.from({length:17},()=>({pressed:false}))};
const ctx = vm.createContext({
  window:{addEventListener() {}},
  document:{
    head:{appendChild() {}},createElement:()=>({}),hasFocus:()=>true,getElementById:()=>null,
    querySelector: q=>q.startsWith('#hud.show')?{}:null,
    querySelectorAll: q=>q==='.panel.show,[role="dialog"].show'?[inventory]:[]
  },
  navigator:{getGamepads:()=>[pad]}, performance, Date, setInterval() {},
  requestAnimationFrame: cb=>{ nextFrame=cb; },
  getComputedStyle:()=>({visibility:'visible',zIndex:'1'}),
  inv:{items}, inTab:()=>true, bagMarks:null,
  markMode: value=>{ctx.bagMarks=value?new Set():null;draw();}
});
function draw(){
  for(const old of grid.children)old.isConnected=false;
  grid.children=items.map(item=>({
    dataset:{item:String(item.id)}, id:'', isConnected:true, parentElement:grid,
    classList:{...classList,add(name){if(name==='thor-nav')focused=item.id;}},
    closest:()=>inventory, scrollIntoView() {}, getAttribute:()=>null,
    getBoundingClientRect:()=>({left:item.id*100,top:0,width:50,height:50}),
    getClientRects:()=>[1], matches:s=>s===selector||s==='#inv-grid .slot'||s==='.slot,.skill',
    click(){
      if(!ctx.bagMarks){nativeClicks++;return;}
      if(!item.locked&&!ctx.bagMarks.delete(item.id))ctx.bagMarks.add(item.id);
      draw();
    }
  }));
}
draw();
vm.runInContext(code,ctx);
ctx.inputs();nextFrame();
const bridge = ctx.window.__thor;
assert.equal(ctx.valid({type:'nav',value:'mark'}),true);
assert.equal(focused,1);
pad.buttons[2].pressed=true;nextFrame();
assert.deepEqual([...ctx.bagMarks],[1],'X starts the native mode and marks the focused item');
nextFrame();
assert.deepEqual([...ctx.bagMarks],[1],'A held X does not repeatedly change the mark');
pad.buttons[2].pressed=false;nextFrame();
assert.equal(focused,1,'Focus survives the native redraw');
bridge.navigate('right');
bridge.navigate('downAccept');bridge.navigate('upAccept');
assert.deepEqual([...ctx.bagMarks],[1,2],'A adds an item without beginning a drag');
bridge.navigate('mark');
assert.deepEqual([...ctx.bagMarks],[1],'X also removes a mark');
bridge.navigate('right');
assert.equal(bridge.navigate('mark'),false);
assert.deepEqual([...ctx.bagMarks],[1],'Locked item cannot be marked');
assert.equal(bridge.menuContext().marked,1);
bridge.navigate('back');
assert.equal(ctx.bagMarks,null,'B cancels the marks');
assert.equal(bridge.menu(),'inventory');
assert.equal(focused,3);
assert.equal(nativeClicks,0);
console.log('Native bag marking, locked slots, redraw focus, and cancel passed.');
