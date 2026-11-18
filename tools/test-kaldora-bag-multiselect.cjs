const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');

(async () => {
  const source = fs.readFileSync('tools/game-adapter.cjs', 'utf8');
  const code = source.slice(source.indexOf('function inputs()'), source.indexOf('function view('));
  const items = [
    {id:1,tid:10,name:'Reward',count:1,cash:true},
    {id:2,tid:20,name:'Manual',count:2,cash:true},
    {id:3,tid:30,name:'Locked',count:1,cash:true,locked:true},
    {id:4,tid:40,name:'Active buff',count:1,cash:true,inUse:true}
  ];
  const css = () => {
    const classes = new Set(['show']);
    return {contains: k=>classes.has(k), add:k=>classes.add(k), remove:k=>classes.delete(k),
      toggle(k,on){if(on)classes.add(k);else classes.delete(k)}};
  };
  const destroyed = [], listeners = {}, queued = [];
  let prompt, answer, cancelFocused=false;
  const bag = {id:'cashbag',classList:css(),getClientRects:()=>[1],closest:()=>null,matches:()=>false,
    querySelector: q=>q==='#cash-trash'?trash:null,querySelectorAll: q=>q==='#cash-grid .slot[data-item]'?slots:[...slots,trash],
    contains: node=>node===trash||slots.includes(node)};
  const grid={id:'cash-grid',parentElement:bag};
  const node = (id,x,selector,parent=bag) => ({
    id, dataset:{}, parentElement:parent, classList:css(), isConnected:true, matches: q=>q===selector,
    closest:q=>q===selector?this:bag, getAttribute:()=>null, getClientRects:()=>[1],
    getBoundingClientRect:()=>({left:x,top:0,width:50,height:50}), scrollIntoView(){},
    focus(){ if(id==='ask-no')cancelFocused=true; }
  });
  const trash = node('cash-trash',650,'#cash-trash');
  trash.closest=q=>q==='#cash-trash'?trash:null;
  trash.setAttribute=()=>{};trash.toggleAttribute=()=>{};
  const cancel=node('ask-no',0,'#ask-no');
  const slots=items.map((item,i)=>{
    const el=node('',i*100,'#cash-grid .slot[data-item]',grid);
    el.dataset.item=String(item.id);
    return el;
  });
  grid.children=slots;bag.children=[grid,trash];
  const context=vm.createContext({
    window:{addEventListener:(type,fn)=>(listeners[type]??=[]).push(fn)}, navigator:{}, Date,
    document:{
      head:{appendChild(){}},createElement:()=>({}),getElementById:id=>({cashbag:bag,'ask-no':cancel})[id],
      querySelector:q=>q==='#hud.show'?{}:null,
      querySelectorAll:q=>q==='.panel.show,[role="dialog"].show'?[bag]:[]
    },
    getComputedStyle:()=>({visibility:'visible',zIndex:'1'}),setInterval(){},setTimeout:fn=>queued.push(fn),
    inv:{items},Module:{ccall:(fn,ret,args,[id])=>{assert.equal(fn,'viewer_destroy_item');destroyed.push(id)}},
    ask:(...args)=>{prompt=args;return new Promise(resolve=>answer=resolve)}
  });
  vm.runInContext(code,context);
  context.inputs();
  const bridge=context.window.__thor;
  const bin=()=>listeners.click[0]({target:trash,preventDefault(){},stopImmediatePropagation(){}});
  assert.equal(bridge.navigate('right'),true);
  assert.equal(bridge.navigate('mark'),true);
  assert.equal(bridge.navigate('right'),true);
  assert.equal(bridge.navigate('downAccept'),true);
  assert.equal(bridge.menuContext().marked,2);
  bridge.navigate('right');
  assert.equal(bridge.navigate('mark'),false);
  bridge.navigate('right');
  assert.equal(bridge.navigate('mark'),false);
  bin();
  assert.match(prompt[0],/Destroy 2 items\?/);
  assert.equal(cancelFocused,true);
  assert.deepEqual(destroyed,[]);
  answer(false);
  await new Promise(setImmediate);
  assert.equal(bridge.menuContext().marked,2);
  bin();
  items[1].count=3;
  answer(true);
  await new Promise(setImmediate);
  for(const run of queued)run();
  assert.deepEqual(destroyed,[1], 'A changed stack must not be destroyed');
  assert.equal(bridge.menuContext().marked,null);
  bin();
  assert.equal(bridge.menuContext().marked,0,'Tapping an empty bin starts marking');
  assert.equal(bridge.navigate('back'),true);
  assert.equal(bridge.menuContext().marked,null);
  console.log('Kaldora Bag marks, confirmation, item protection and changed-stack check passed.');
})().catch(error=>{console.error(error);process.exitCode=1});
