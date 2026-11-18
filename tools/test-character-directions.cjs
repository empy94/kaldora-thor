const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const src=fs.readFileSync('tools/game-adapter.cjs','utf8');
const code=src.slice(src.indexOf('function inputs() {'),src.indexOf('function view('));
let selected=null,frame;const cls=name=>({add(x){if(x==='thor-nav')selected=name},remove(){},contains(){return false}});
const pick={id:'pick',isConnected:true,children:[],classList:cls('pick'),getClientRects:()=>[1],contains(x){return this.children.includes(x)},matches:()=>false};
function button(name,x){return {id:name,dataset:{},parentElement:pick,isConnected:true,classList:cls(name),getClientRects:()=>[1],getBoundingClientRect:()=>({left:x,top:10,width:100,height:80}),getAttribute:()=>null,closest:()=>pick,matches:()=>false,scrollIntoView(){},click(){}}}
const one=button('one',10),two=button('two',130);pick.children=[one,two];pick.querySelectorAll=()=>pick.children;
const window={addEventListener(){}};
const document={head:{appendChild(){}},documentElement:{classList:cls('html')},hasFocus:()=>true,createElement:()=>({}),getElementById:id=>pick.children.find(x=>x.id===id),querySelector:s=>(s==='#select.show #pick-view:not([hidden]) #pick'||s==='#hud.show,#select.show #pick-view:not([hidden])')?pick:null,querySelectorAll:()=>[]};
const navigator={getGamepads:()=>[{connected:true,mapping:'standard',axes:[0,0],buttons:Array.from({length:17},()=>({pressed:false}))}]};
const ctx={window,document,navigator,Date,performance,requestAnimationFrame:f=>frame=f,setInterval(){},getComputedStyle:()=>({visibility:'visible',zIndex:'1'})};
vm.createContext(ctx);vm.runInContext(code,ctx);ctx.inputs();frame();assert.equal(selected,'one');window.__thor.navigate('right');assert.equal(selected,'two','Right must select the second character');window.__thor.navigate('left');assert.equal(selected,'one','Left must select the first character');console.log('Character selection moves left and right.');

// The portal can appear above an already selected window and lists its close button first.
const portal={...pick,id:'portal'};
let travelled=false;
const close={...button('close',120),closest:()=>portal,matches:s=>s==='.close,[data-close]'};
const destination={...button('destination',20),closest:()=>portal,matches:s=>s==='#portal-list button',click(){travelled=true}};
portal.children=[close,destination];
portal.querySelectorAll=()=>portal.children;
const previousQuery=document.querySelector;
document.querySelector=s=>s==='#portal.show'?portal:previousQuery(s);
document.hasFocus=()=>false;
assert.equal(window.__thor.menu(),'portal');
assert.equal(selected,'destination','The portal selects its destination even when Firefox lacks focus');
document.hasFocus=()=>true;
frame();
assert.equal(window.__thor.navigate('downAccept'),true);
assert.equal(travelled,true,'A activates the portal destination');
console.log('Portal takes focus and A activates the destination.');
