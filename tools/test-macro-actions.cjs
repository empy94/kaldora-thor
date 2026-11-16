const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const source=fs.readFileSync(require('node:path').join(__dirname,'usb-bridge.cjs'),'utf8');
const fragment=source.slice(source.indexOf('function action(a) {'),source.indexOf('let snapshot, currentPage;'));
const bar={slots:Array(50).fill(0),mRow:0,bRow:1,bRow2:-1};
const element={value:'-1',options:[-1,0,1,2,3].map(x=>({value:String(x)})),dispatchEvent(){bar.bRow2=Number(this.value)}};
let saved=0,buffs=0;
const ctx={bar,BAR_COLS:[2,3,4,5,6,7,8,9,0,1],document:{querySelector:s=>s==='#hud.show'?{}:s==='#set-brow2'?element:null},Event:function(){},itemOk:index=>index>=20,
 dropOnSlot(event,target){const source=Number(event.dataTransfer.getData().split(':')[1]);[bar.slots[target],bar.slots[source]]=[bar.slots[source],bar.slots[target]];saved++},
 runBuffs(){buffs++},window:{},skillList:[{tid:222,passive:false}],skillGroup:()=>1,mwPlace(index,tid){bar.slots[index]=tid}};
vm.createContext(ctx);vm.runInContext(fragment,ctx);const act=(type,value)=>ctx.action({type,value});
bar.slots[2]=222;bar.slots[3]=333;
assert.equal(act('macroSwap',{row:0,from:0,to:1,expectedFrom:222,expectedTo:333}),true);assert.equal(bar.slots[2],333);assert.equal(bar.slots[3],222);assert.equal(saved,1);
assert.equal(act('macroSwap',{row:0,from:0,to:2,expectedFrom:333,expectedTo:0}),true);assert.equal(bar.slots[2],0);assert.equal(bar.slots[4],333);
assert.equal(act('macroSwap',{row:0,from:2,to:1,expectedFrom:999,expectedTo:222}),false);assert.equal(saved,2);
bar.slots[4]=-23;assert.equal(act('macroSwap',{row:0,from:2,to:1,expectedFrom:-23,expectedTo:222}),false);assert.equal(saved,2);
assert.equal(act('macroSlot',{row:0,slot:0,tid:222,expected:0}),true);assert.equal(bar.slots[2],222);assert.equal(act('macroSlot',{row:0,slot:0,tid:0,expected:0}),false);
assert.equal(act('extraBuffRow',2),true);assert.equal(bar.bRow2,2);assert.equal(act('extraBuffRow',0),false);assert.equal(act('extraBuffRow',1),false);assert.equal(act('extraBuffRow',-1),true);assert.equal(bar.bRow2,-1);
assert.equal(act('allBuffs',null),true);assert.equal(buffs,1);
console.log('Macro swap, stale state, item restrictions, skill confirmation and buff row checks passed.');
