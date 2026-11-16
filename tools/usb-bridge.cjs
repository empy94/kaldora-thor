const http = require('node:http');
const fs = require('node:fs');
const {readNativeControllerSettings} = require('./native-controller-contract.cjs');
const key = fs.readFileSync(require('node:path').join(__dirname,'../assets/usb-key.txt'),'utf8').trim();
const origin = 'https://play.kaldora.eu';
const port = 49225;

async function pages() {
  const all = await (await fetch('http://127.0.0.1:'+port+'/json',{signal:AbortSignal.timeout(800)})).json();
  return all.filter(p=>p.type==='page'&&new URL(p.url).origin===origin);
}
function call(page, expression, userGesture=false) {
  return new Promise((resolve,reject)=>{
    const ws=new WebSocket(page.webSocketDebuggerUrl);
    const timer=setTimeout(()=>{ws.close();reject(Error('timeout'))},1300);
    ws.onopen=()=>ws.send(JSON.stringify({id:1,method:'Runtime.evaluate',params:{expression,returnByValue:true,userGesture,awaitPromise:true}}));
    ws.onmessage=e=>{
      const msg=JSON.parse(e.data);if(msg.id!==1)return;
      clearTimeout(timer);ws.close();resolve(msg.result?.result?.value);
    };
    ws.onerror=()=>{clearTimeout(timer);reject(Error('Chrome unavailable'))};
  });
}
function inputs() {
  if(window.__thor?.version==='native-preview-1')return;
  if(window.__thor)window.__thor.until=0;
  const state=window.__thor={version:'native-preview-1',mapOwned:false};
  // No gamepad wrapping, keyboard listeners, event simulation or input polling.
  state.menu=()=>[...document.querySelectorAll('.panel.show,[role="dialog"].show,dialog[open]')].find(x=>x.getClientRects().length)?.id||'';
  // A native selection signal is not specified yet. Avoid showing a stale item.
  state.selectedItem=()=>null;
  state.socketGearType=item=>{
    if(!item||!Number.isInteger(item.part))return null;
    if(item.part===9){const n=item.st?.dmax;return typeof n==='number'&&Number.isFinite(n)&&n>=0?(n>0?'weapon':'shield'):null}
    return ({2:'armour',3:'helmet',4:'gloves',5:'gloves',6:'leggings',7:'boots',10:'weapon',11:'ring',12:'ring',13:'necklace'})[item.part]||null;
  };
  state.socketCompatible=(item,stone)=>{
    const part=state.socketGearType(item);
    return !!part&&!!stone&&!stone.equipped&&!stone.shop&&!stone.bank&&!stone.trade&&stone.count>0&&stone.conv===2&&/^Fits:\s*/i.test(stone.fx||'')&&stone.fx.slice(5).split(',').some(v=>v.trim().toLowerCase()===part);
  };
  // END_SOCKET_RULES
}
function view(install,parseNative) {
  const q=s=>document.querySelector(s), txt=s=>q(s)?.textContent.trim().slice(0,400)||'';
  if(!q('#hud.show'))return {online:false};
  install();
  let nativeSettings;try{nativeSettings=parseNative(localStorage.getItem('archlord.settings'))}catch{nativeSettings={available:false,bindings:{}}}
  let map='';
  const c=q('#map-canvas');
  if(window.__thor.mapOwned&&typeof drawMap==='function')drawMap();
  if(c?.width&&c.height&&c.getClientRects().length)try{
    const copy=document.createElement('canvas');copy.width=400;copy.height=Math.max(1,Math.min(480,Math.round(400*c.height/c.width)));
    copy.getContext('2d').drawImage(c,0,0,copy.width,copy.height);map=copy.toDataURL('image/webp',.70);
  }catch{}
  const domIcon=x=>{const src=x.querySelector('img.icon')?.src||'';return src.startsWith(location.origin+'/')?src:''};
  const inventory={};
  for(const name of ['inv','pet','bank']){
    inventory[name]={
      tabs:[...(q('#'+name+'-tabs')?.querySelectorAll('button')||[])].map(b=>({name:b.textContent.trim(),on:b.classList.contains('on')})),
      slots:[...(q('#'+name+'-grid')?.children||[])].map(x=>({id:x.dataset.item||'',icon:domIcon(x),count:x.querySelector('.count')?.textContent||'',hint:x.dataset.hint||''}))
    };
  }
  const npc=q('#npc-menu.show')?{name:txt('#npc-name'),choices:[...q('#npc-functions').querySelectorAll('button')].map(b=>({label:b.textContent.trim(),disabled:b.disabled}))}:null;
  let catalog=[], realRows=[];
  const skillNames=new Map(), skillGroups=new Map();
  if(typeof skillList!=='undefined'&&typeof bar!=='undefined'&&bar&&typeof BAR_COLS!=='undefined') {
    for(const skill of skillList){skillNames.set(String(skill.id),skill.name);skillGroups.set(String(skill.id),skill.passive?'Passive':(SKILL_TABS.find(([id])=>id===skillGroup(skill))?.[1]||'Other'));}
    catalog=skillList.filter(s=>!s.passive&&skillGroup(s)!==6).map(s=>({tid:String(s.tid),name:s.name,icon:iconFor(s),level:Number(s.lv)||0,bonus:Number(s.bonus)||0,max:Number(s.max)||0,description:Array.isArray(s.tip)?s.tip.map(String):[],brief:briefFor(s)}));
    function briefFor(skill){
      if(typeof skillBrief!=='function')return null;
      try{
      const card=document.createElement('div');card.innerHTML=skillBrief(skill);
      if(!card.querySelector('.hd'))return null;
      const nodes=[...card.querySelectorAll('.stats > span')],stats=[];
      for(let i=0;i+1<nodes.length;i+=2)stats.push({label:nodes[i].textContent.trim(),value:nodes[i+1].textContent.trim()});
      return {level:card.querySelector('.hd span')?.textContent.trim()||'',kind:card.querySelector('.kind')?.textContent.trim()||'',notes:[...card.querySelectorAll('.ln')].map(x=>x.textContent.trim()).filter(Boolean),stats,cost:card.querySelector('.cost')?.textContent.trim()||''};
      }catch{return null}
    }
    function iconFor(skill){const node=skillTile(skill);return domIcon(node)}
    realRows=[0,1,2,3].map(row=>BAR_COLS.map((col)=>{
      const tid=bar.slots[10*row+col]||0;
      return {tid:String(tid),item:tid<0};
    }));
  }
  let itemDetails=null;
  try{
    const slot=window.__thor.selectedItem?.();
    const itemId=Number(slot?.dataset.item);
    const item=itemId&&((typeof inv!=='undefined'&&inv.items?.find(x=>x.id===itemId))||
      (typeof bankItems!=='undefined'&&bankItems.find(x=>x.id===itemId)));
    if(item&&typeof tipCard==='function'){
      const equipped=!item.equipped&&item.part&&typeof inv!=='undefined'?inv.items.find(x=>x.equipped&&x.part===item.part):null;
      const build=(value,heading,comparison,hint)=>{
        const card=tipCard(value,heading,comparison,hint||'');
        const selector='.head,.name,.req,.row,.up,.down,.hint,.gear-buff,.stone-fx,.combo-head,.combo';
        const lines=[...card.querySelectorAll(selector)].filter(el=>!el.parentElement?.closest(selector)).map(el=>({
          kind:typeof el.className==='string'?el.className:'',
          text:el.classList.contains('row')||el.classList.contains('name')?[...el.children].map(x=>x.textContent.trim()).filter(Boolean).join(el.classList.contains('row')?'  ':' '):el.textContent.trim()
        })).filter(line=>line.text);
        const art=value.id===item.id?slot.querySelector('img.icon'):[...document.querySelectorAll('#doll-slots [data-item]')].find(el=>el.dataset.item===String(value.id))?.querySelector('img.icon');
        const socketNodes=[...card.querySelectorAll('.stones > img,.stones > .stone')];
        const names=Array.isArray(value.stones)?value.stones:[];
        const sockets=socketNodes.map((node,index)=>{
          const src=node.tagName==='IMG'?node.src:'';
          return {
            filled:index<names.length,
            name:typeof names[index]==='string'?names[index]:'',
            icon:src.startsWith(location.origin+'/')?src:''
          };
        });
        return {lines,sockets,icon:art?.src?.startsWith(location.origin+'/')?art.src:''};
      };
      const pending=window.__thor.lockPending;
      if(pending?.id===String(item.id)&&(!!item.locked!==pending.expected||Date.now()>=pending.until))window.__thor.lockPending=null;
      const part=window.__thor.socketGearType?.(item);
      const socketOptions=part&&inv.items.includes(item)&&item.sockets>(item.stones||[]).length?inv.items.filter(x=>window.__thor.socketCompatible(item,x)).map(x=>{
        const art=icon('item',x.tid)?.src||'',risk=typeof stoneRisk==='function'?stoneRisk(x,item):null;
        return {id:String(x.id),name:x.name,count:x.count,icon:art.startsWith(location.origin+'/')?art:'',description:(x.opts||[]).join(' · '),risk:risk?{chance:risk.chance||'',note:risk.note||''}:null};
      }):[];
      itemDetails={id:String(item.id),locked:!!item.locked,lockPending:window.__thor.lockPending?.id===String(item.id),socketOptions,socketSupported:!!part&&inv.items.includes(item),cards:[
        ...(equipped?[build(equipped,'Equipped',null,'')]:[]),
        build(item,equipped?'This item':'',equipped,slot.dataset.hint)
      ]};
    }
  }catch{}
  let potions=null;
  if(typeof bar!=='undefined'&&Array.isArray(bar?.potions)&&typeof inv!=='undefined'&&Array.isArray(inv?.items)&&typeof icon==='function'){
    const bag=inv.items.filter(item=>!item.equipped&&!item.shop&&!item.part&&!item.bank&&!item.trade&&Number(item.count)>0&&[1,2,4].includes(Number(item.pot)));
    const art=tid=>{const src=icon('item',tid)?.src||'';return src.startsWith(location.origin+'/')?src:''};
    potions=[0,1].map(slot=>{
      const tid=Number(bar.potions[slot]?.tid)||0,compatible=bag.filter(item=>Number(item.pot)===slot+1||Number(item.pot)===4),byType=new Map();
      for(const item of compatible){const existing=byType.get(item.tid);if(existing)existing.count+=Number(item.count)||0;else byType.set(item.tid,{id:String(item.id),tid:Number(item.tid),name:String(item.name||''),count:Number(item.count)||0,icon:art(item.tid),description:String(item.opts?.[0]||'')})}
      const options=[...byType.values()],selected=options.find(item=>item.tid===tid);
      return {slot,tid,name:selected?.name||(!tid?'Not assigned':'No longer in inventory'),count:selected?.count||0,icon:tid?art(tid):'',options};
    });
  }
  const sets=typeof gearSets!=='undefined'&&Array.isArray(gearSets)?
    Array.from({length:4},(_,i)=>{const set=gearSets[i];return {name:set?.n||'Set '+(i+1),saved:!!set,gear:!!set?.g,skills:!!set?.b}}):null;
  return {online:true,potions,effects:typeof settings!=='undefined'?String(settings.effects):null,sets,itemDetails,pressed:[],lastPress:null,
    nativePad:nativeSettings.available,nativePadMap:[],nativeSettings,
    buffRows:typeof bar!=='undefined'&&bar?[bar.bRow??1,bar.bRow2??-1]:[],attackRow:typeof bar!=='undefined'&&bar?bar.mRow??0:null,
    fullscreen:!!document.fullscreenElement,nativeMenu:window.__thor.menu(),bindings:{},lastMacro:null,
    activeRow:typeof macroRow==='number'?String(macroRow):'',inventory,npc,catalog,realRows,select:window.__thor.select||0,focused:document.hasFocus(),level:txt('#level'),hp:txt('#hp-text'),mp:txt('#mp-text'),xp:txt('#exp-text'),
    bars:['hp','mp','exp'].map(k=>parseFloat(q('#'+k+'-fill')?.style.width)||0),
    macro:q('#macro-on')?!q('#macro-on').hidden:null,map,
    macroRows:[...document.querySelectorAll('#t-rows [data-row]')].map(b=>{
      const row=Number(b.dataset.row);
      const line=q('#bar-rows')?.children[row];
      const icons=[...(line?.querySelectorAll('.skill[data-id] img.icon')||[])].map(x=>x.src).filter(src=>src.startsWith(location.origin+'/'));
      return {row:b.dataset.row,on:b.classList.contains('run'),icons};
    }),
    filters:[...document.querySelectorAll('#chat-tabs button')].map(b=>({name:b.textContent.trim(),on:b.classList.contains('on')})),
    chat:[...q('#chat-log').children].filter(x=>!x.hidden).slice(-25).map(x=>({text:x.textContent.trim().slice(0,300),color:getComputedStyle(x).color})),
    slots:[...document.querySelectorAll('#bar-rows .skill')].slice(0,40).map(x=>{
      const src=x.querySelector('img.icon')?.src||'';
      return {key:x.querySelector('.key')?.textContent.trim(),id:x.dataset.id||'',name:skillNames.get(x.dataset.id)||'',group:skillGroups.get(x.dataset.id)||'Other',icon:src.startsWith(location.origin+'/')?src:'',
        disabled:x.classList.contains('nomp'),cooldown:x.querySelector('.cd')?.textContent.trim()||''};
    })};
}
function action(a) {
  const q=s=>document.querySelector(s);
  if(!q('#hud.show'))return false;
  if(a.type==='effects'){
    const el=q('#set-effects');if(!el||!['0','1','2'].includes(String(a.value)))return false;
    el.value=String(a.value);el.dispatchEvent(new Event('change',{bubbles:true}));return true;
  }
  if(a.type==='socketInsert'){
    if(typeof inv==='undefined'||typeof socketStone!=='function')return false;
    const item=inv.items.find(x=>String(x.id)===a.value.item),stone=inv.items.find(x=>String(x.id)===a.value.stone);
    if(!item||!stone||window.__thor?.selectedItem?.()?.dataset.item!==String(item.id)||!inv.items.includes(item)||item.sockets<=(item.stones||[]).length||!window.__thor?.socketCompatible?.(item,stone))return false;
    return socketStone(stone,item);
  }
  if(a.type==='potionAssign'){
    if(typeof inv==='undefined'||typeof bar==='undefined'||!Array.isArray(inv?.items)||!Array.isArray(bar?.potions))return false;
    const {slot,id}=a.value;
    const item=inv.items.find(x=>String(x.id)===id&&!x.equipped&&!x.shop&&!x.part&&!x.bank&&!x.trade&&Number(x.count)>0&&(Number(x.pot)===slot+1||Number(x.pot)===4));
    const target=q('#potions .potion:nth-child('+(slot+1)+') .skill');
    if(!item||!target)return false;
    const transfer=new DataTransfer();transfer.setData('text/plain',id);
    target.dispatchEvent(new DragEvent('drop',{bubbles:true,cancelable:true,dataTransfer:transfer}));
    return Number(bar.potions[slot]?.tid)===Number(item.tid);
  }
  if(a.type==='gear'){
    if(typeof gearSets==='undefined'||typeof setWear!=='function')return false;
    const set=gearSets[a.value];
    if(!set){if(typeof show!=='function'||typeof drawSetsWin!=='function')return false;show('sets-win',true);drawSetsWin();return true}
    setWear(set);return true;
  }
  if(a.type==='gearEdit'){
    if(typeof show!=='function'||typeof drawSetsWin!=='function')return false;
    show('sets-win',true);drawSetsWin();return true;
  }
  if(a.type==='npc'){
    if(!q('#npc-menu.show'))return false;
    const b=[...q('#npc-functions').querySelectorAll('button')].find(x=>x.textContent.trim()===a.value);
    if(!b||b.disabled)return false;b.click();return true;
  }
  if(a.type==='bagMove'){
    const {group,from,to,target}=a.value;
    const grid=q('#'+group+'-grid');
    const source=[...(grid?.children||[])].find(s=>s.dataset.item===from);
    const dest=grid?.children[to];
    if(!source||!source.draggable||!dest||source===dest||(dest.dataset.item||'')!==target)return false;
    const owned=id=>(typeof inv!=='undefined'&&inv?.items?.find(x=>String(x.id)===String(id)))||(typeof bankItems!=='undefined'&&bankItems?.find(x=>String(x.id)===String(id)));
    if(owned(from)?.locked||(target&&owned(target)?.locked))return false;
    const dataTransfer=new DataTransfer();
    source.dispatchEvent(new DragEvent('dragstart',{bubbles:true,cancelable:true,dataTransfer}));
    if(!dataTransfer.types.length)return false;
    dest.dispatchEvent(new DragEvent('drop',{bubbles:true,cancelable:true,dataTransfer}));
    source.dispatchEvent(new DragEvent('dragend',{bubbles:true,dataTransfer}));
    return true;
  }
  if(a.type==='bagTab'){
    const b=q('#'+a.value.group+'-tabs')?.querySelectorAll('button')[a.value.index];if(!b)return false;b.click();return true;
  }
  if(a.type==='mapView'){
    const root=q('#worldmap');
    if(!root||!window.__thor||typeof drawMap!=='function')return false;
    if(root.classList.contains('show'))q('#map-btn')?.click();
    window.__thor.mapOwned=true;
    root.style.setProperty('display','block');
    root.style.setProperty('opacity','0');
    root.style.setProperty('pointer-events','none');
    if(typeof mapView!=='undefined'){mapView.follow=true;mapView.outside=false}
    drawMap();
    return true;
  }
  if(a.type==='mapRestore'){
    const root=q('#worldmap');
    if(!root||!window.__thor?.mapOwned)return false;
    window.__thor.mapOwned=false;
    for(const name of ['display','opacity','pointer-events'])root.style.removeProperty(name);
    return true;
  }
  if(a.type==='macroSwap'){
    const {row,from,to,expectedFrom,expectedTo}=a.value;
    if(typeof bar==='undefined'||!bar||typeof BAR_COLS==='undefined'||typeof dropOnSlot!=='function')return false;
    const source=10*row+BAR_COLS[from],target=10*row+BAR_COLS[to];
    if(source===target||Number(bar.slots[source]||0)!==expectedFrom||Number(bar.slots[target]||0)!==expectedTo||!expectedFrom)return false;
    if((expectedFrom<0&&!itemOk(target))||(expectedTo<0&&!itemOk(source)))return false;
    dropOnSlot({preventDefault(){},dataTransfer:{getData:()=>`slot:${source}`}},target);
    return Number(bar.slots[target]||0)===expectedFrom&&Number(bar.slots[source]||0)===expectedTo;
  }
  if(a.type==='macroSlot'){
    const {row,slot,tid,expected}=a.value;
    if(typeof bar==='undefined'||!bar||typeof mwPlace!=='function'||typeof BAR_COLS==='undefined')return false;
    const index=10*row+BAR_COLS[slot];
    if(bar.slots[index]<0||Number(bar.slots[index]||0)!==expected)return false;
    if(tid&&!skillList.some(s=>s.tid===tid&&!s.passive&&skillGroup(s)!==6))return false;
    mwPlace(index,tid);return true;
  }
  if(a.type==='spell'){
    const x=[...document.querySelectorAll('#bar-rows .skill[data-id]')].find(x=>x.dataset.id===a.value&&!x.classList.contains('nomp'));
    if(!x)return false;x.click();return true;
  }
  if(a.type==='macro'){if(typeof toggleMacro!=='function')return false;toggleMacro(Number(a.value));return true}
  if(a.type==='buff'){
    const b=q('#t-buffs');
    if(!b)return false;b.dispatchEvent(new PointerEvent('pointerdown',{bubbles:true,cancelable:true}));return true;
  }
  if(a.type==='chat'){
    const x=q('#chat-input');if(!x||x.value.trim())return false;
    x.value=a.value;x.dispatchEvent(new KeyboardEvent('keydown',{key:'Enter',code:'Enter',bubbles:true,cancelable:true}));return !x.value.trim();
  }
  if(a.type==='filter'){
    const b=[...document.querySelectorAll('#chat-tabs button')].find(x=>x.textContent.trim()===a.value);
    if(!b)return false;b.click();return true;
  }
  const menus={map:'map-btn',bag:'bag-btn',pet:'pet-btn',macro:'macro-btn',skills:'skills-btn',character:'char-btn',quests:'missions-btn'};
  if(a.type==='menu'&&Object.hasOwn(menus,a.value)){
    const b=document.getElementById(menus[a.value]);if(!b)return false;
    if(a.value==='pet'&&!b.getClientRects().length)q('#bag-btn')?.click();
    if(a.value!=='map'||!q('#map-canvas')?.getClientRects().length)b.click();return true;
  }
  return false;
}
function valid(a) {
  if(!a||typeof a!=='object')return false;
  const digits=v=>typeof v==='string'&&/^\d{1,9}$/.test(v);
  const row=v=>typeof v==='string'&&/^[0-3]$/.test(v);
  if(a.type==='socketInsert')return !!a.value&&digits(a.value.item)&&digits(a.value.stone);
  if(a.type==='effects')return ['0','1','2'].includes(String(a.value));
  if(a.type==='macroSlot')return a.value&&Number.isInteger(a.value.row)&&a.value.row>=0&&a.value.row<4&&Number.isInteger(a.value.slot)&&a.value.slot>=0&&a.value.slot<10&&Number.isInteger(a.value.tid)&&a.value.tid>=0&&Number.isInteger(a.value.expected)&&a.value.expected>=0;
  if(a.type==='macroSwap')return a.value&&Number.isInteger(a.value.row)&&a.value.row>=0&&a.value.row<4&&['from','to'].every(k=>Number.isInteger(a.value[k])&&a.value[k]>=0&&a.value[k]<10)&&['expectedFrom','expectedTo'].every(k=>Number.isSafeInteger(a.value[k]));
  if(a.type==='potionAssign')return a.value&&Number.isInteger(a.value.slot)&&a.value.slot>=0&&a.value.slot<=1&&digits(a.value.id);
  if(a.type==='gear')return Number.isInteger(a.value)&&a.value>=0&&a.value<4;
  if(a.type==='gearEdit')return true;
  if(a.type==='npc')return typeof a.value==='string'&&a.value.length<=80;
  if(a.type==='bagMove')return a.value&&['inv','pet','bank'].includes(a.value.group)&&digits(a.value.from)&&
    (a.value.target===''||digits(a.value.target))&&Number.isInteger(a.value.to)&&a.value.to>=0&&a.value.to<25;
  if(a.type==='bagTab')return a.value&&['inv','pet','bank'].includes(a.value.group)&&Number.isInteger(a.value.index)&&a.value.index>=0&&a.value.index<8;
  if(a.type==='mapView'||a.type==='mapRestore')return true;
  if(a.type==='spell')return digits(a.value);
  if(a.type==='macro')return row(a.value);
  if(a.type==='buff')return true;
  if(a.type==='chat')return typeof a.value==='string'&&a.value.trim()&&a.value.length<=120&&!/[\r\n]/.test(a.value);
  if(a.type==='filter')return typeof a.value==='string'&&a.value.length<=50;
  if(a.type==='menu')return ['map','bag','pet','macro','skills','character','quests'].includes(a.value);
  return false;
}
let snapshot, currentPage;
async function fullscreen(page){
  try{
    await call(page,`(async()=>{
      const state=window.__thor;
      if(!state||state.fullscreenEntered||Date.now()<(state.fullscreenRetry||0)
        ||document.fullscreenElement||!document.hasFocus()||!document.querySelector('#hud.show'))return;
      state.fullscreenRetry=Date.now()+3000;
      try{
        await document.documentElement.requestFullscreen({navigationUI:'hide'});
        state.fullscreenEntered=!!document.fullscreenElement;
      }catch{}
    })()`,true);
  }catch{}
}
async function read() {
  if(snapshot)return snapshot;
  snapshot=(async()=>{
    const list=await pages();
    const states=await Promise.all(list.map(p=>call(p,'('+view.toString()+')('+inputs.toString()+','+readNativeControllerSettings.toString()+')').catch(()=>null)));
    const playing=states.map((d,i)=>d?.online?i:-1).filter(i=>i>=0);
    const focus=states.findIndex(d=>d?.online&&d.focused);
    const i=focus>=0?focus:playing.length===1?playing[0]:-1;
    currentPage=i>=0?list[i]:null;
    if(focus>=0&&!states[focus].fullscreen)void fullscreen(list[focus]);
    return i>=0?{page:currentPage,data:states[i]}:{data:{online:false}};
  })().finally(()=>{snapshot=null});
  return snapshot;
}
http.createServer(async(req,res)=>{
  const post=req.method==='POST'&&req.url==='/action';
  if((!post&&(req.method!=='GET'||req.url!=='/game'))||req.headers.authorization!=='Bearer '+key){res.writeHead(404).end();return}
  res.setHeader('Content-Type','application/json');res.setHeader('Cache-Control','no-store');
  try {
    if(post){
      let body='';
      for await(const piece of req){body+=piece;if(body.length>4096){res.writeHead(413).end();return}}
      const a=JSON.parse(body);
      const page=valid(a)?(await read()).page:null;
      const ok=page&&await call(page,'('+action.toString()+')('+JSON.stringify(a)+')');
      res.end(JSON.stringify({ok:!!ok}));
    } else res.end(JSON.stringify((await read()).data));
  }catch {res.end(JSON.stringify(post?{ok:false}:{online:false}))}
}).listen(49226,'127.0.0.1',()=>console.log('Kaldora · liaison USB'));
