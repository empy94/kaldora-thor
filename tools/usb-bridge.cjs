const http = require('node:http');
const fs = require('node:fs');
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
  if(window.__thor?.version===11){window.__thor.until=Date.now()+4000;return}
  if(window.__thor)window.__thor.until=0;
  const state=window.__thor={version:11,until:Date.now()+4000,held:new Map(),bind:{}};
  state.runMacro=(row)=>{
    row=Number(row);
    if(typeof toggleMacro!=='function'||typeof bar==='undefined'||!bar)return false;
    if(typeof BAR_COLS==='undefined')return false;
    const skills=BAR_COLS.map(col=>slotSkill(10*row+col)).filter(Boolean);
    if(!skills.length)return false;
    if(row===(bar.bRow??1)||row===(bar.bRow2??-1)){
      Module.ccall('viewer_buff_macro',null,['string'],[skills.map(s=>s.id).join(',')]);
      return true;
    }
    if(typeof macroRow!=='undefined'&&macroRow===row){toggleMacro(row);return true}
    toggleMacro(row);
    return typeof macroRow!=='undefined'&&macroRow===row;
  };
  const menuSelectors=['#npc-menu','#menu-win','#inventory','#petbag','#bank','#skills','#macro-win','#missions','#character'];
  const visible=x=>x&&x.getClientRects().length&&getComputedStyle(x).visibility!=='hidden';
  const panel=()=>menuSelectors.map(s=>document.querySelector(s)).find(x=>x?.classList.contains('show')&&visible(x));
  const buttons=p=>{
    const list=[...p.querySelectorAll('button,[role=button]')].filter(x=>!x.disabled&&x.getAttribute('aria-disabled')!=='true'&&visible(x));
    return list.sort((a,b)=>Number(a.matches('.close,[data-close]'))-Number(b.matches('.close,[data-close]')));
  };
  let highlighted;
  function highlight(next){
    if(highlighted===next)return;
    highlighted?.classList.remove('thor-nav');
    highlighted=next;
    if(next){next.classList.add('thor-nav');next.scrollIntoView({block:'nearest',inline:'nearest'});}
  }
  const style=document.createElement('style');
  style.textContent='.thor-nav{outline:3px solid #9bdafe!important;outline-offset:2px;box-shadow:0 0 10px #5dbcf2!important}';
  document.head.appendChild(style);
  function navigate(command){
    const current=panel();
    if(command==='start'){
      if(current)return navigate('back');
      document.getElementById('menu-btn')?.click();
      const menu=panel();
      if(menu)highlight(buttons(menu)[0]);
      return !!menu;
    }
    if(!current)return false;
    const list=buttons(current);
    if(command==='back'){
      const close=current.querySelector('h3 .close,.close,[data-close="'+current.id+'"]');
      if(close&&visible(close))close.click();
      else if(current.id==='menu-win')document.getElementById('menu-btn')?.click();
      else return false;
      highlight(undefined);return true;
    }
    if(!list.length)return false;
    if(!list.includes(highlighted)){highlight(list[0]);if(command!=='accept')return true}
    if(command==='accept'){highlighted.click();highlight(undefined);return true}
    const horizontal=command==='left'||command==='right', sign=command==='left'||command==='up'?-1:1;
    const center=x=>{const r=x.getBoundingClientRect();return [r.left+r.width/2,r.top+r.height/2]};
    const [x,y]=center(highlighted);
    let best=null,score=Infinity;
    for(const candidate of list){
      if(candidate===highlighted)continue;
      const [cx,cy]=center(candidate), along=(horizontal?cx-x:cy-y)*sign, across=Math.abs(horizontal?cy-y:cx-x);
      if(along<=3)continue;
      const distance=along+across*3;
      if(distance<score){best=candidate;score=distance}
    }
    if(best)highlight(best);
    return true;
  }
  state.navigate=navigate;
  state.menu=()=>panel()?.id||"";
  const rawPads=navigator.getGamepads?.bind(navigator);
  const navButtons={0:'accept',1:'back',9:'start',12:'up',13:'down',14:'left',15:'right'};
  const watched=[...Object.keys(navButtons).map(Number),4,5,6,7,8,10,11,2,3];
  const trustedNav={ArrowUp:'up',ArrowDown:'down',ArrowLeft:'left',ArrowRight:'right',Enter:'accept',Escape:'back',Backspace:'back'};
  window.addEventListener('keydown',e=>{
    if(!active()||!e.isTrusted||e.repeat||/^(INPUT|SELECT|TEXTAREA)$/.test(e.target?.tagName)||!panel()||!trustedNav[e.key])return;
    if(navigate(trustedNav[e.key])){e.preventDefault();e.stopImmediatePropagation()}
  },true);
  const blocked=new Set([...watched,4]);
  function active(){return window.__thor===state&&Date.now()<state.until&&document.hasFocus()&&!!document.querySelector('#hud.show')}
  if(rawPads){
    navigator.getGamepads=()=>{
      const pads=rawPads();
      if(!active())return pads;
      const menu=!!panel();
      return Array.from(pads,pad=>pad&&new Proxy(pad,{get(target,prop){
        if(prop==='buttons')return Array.from(target.buttons,(button,i)=>(menu?blocked.has(i):([4,9,10,11].includes(i)||(target.buttons[4]?.pressed&&!!state.bind['C4_'+i])))?{pressed:false,touched:false,value:0}:button);
        const value=Reflect.get(target,prop,target);
        return typeof value==='function'?value.bind(target):value;
      }}));
    };
    let previous=new Set();
    function poll(){
      if(window.__thor!==state)return;
      requestAnimationFrame(poll);
      if(!active()){previous.clear();highlight(undefined);state.pressed=[];return}
      const menu=panel();
      if(menu&&!buttons(menu).includes(highlighted))highlight(buttons(menu)[0]);
      if(!menu&&highlighted)highlight(undefined);
      const pad=Array.from(rawPads()).find(x=>x?.connected);
      if(!pad){previous.clear();state.pressed=[];return}
      const now=new Set(watched.filter(i=>pad.buttons[i]?.pressed));
      if(!pad.mapping&&pad.axes.length>=8){
        if(pad.axes[6]<-.65)now.add(14);else if(pad.axes[6]>.65)now.add(15);
        if(pad.axes[7]<-.65)now.add(12);else if(pad.axes[7]>.65)now.add(13);
      }
      state.pressed=[...now];
      for(const i of now){
        if(previous.has(i))continue;
        state.lastPress={button:i,at:Date.now()};
        if(!menu&&i!==4&&now.has(4)&&state.bind['C4_'+i]){
          const binding=state.bind['C4_'+i];
          if(binding.type==='macro')state.lastMacro={row:binding.value,ok:state.runMacro(binding.value),at:Date.now()};
          else [...document.querySelectorAll('#bar-rows .skill[data-id]')].find(x=>x.dataset.id===binding.value&&!x.classList.contains('nomp'))?.click();
        }
        else if(i===9)navigate('start');
        else if(menu&&navButtons[i])navigate(navButtons[i]);
        else if(!menu&&i===10)state.combat('target');
        else if(!menu&&i===11)state.combat('attack');
      }
      previous=now;
    }
    requestAnimationFrame(poll);
  }
  state.combat=type=>{
    const x=document.getElementById(type==='target'?'t-target':'t-attack');
    if(!x)return false;
    x.dispatchEvent(new PointerEvent('pointerdown',{bubbles:true,cancelable:true}));return true;
  };
  const codes={KeyW:87,KeyA:65,KeyS:83,KeyD:68};
  const dispatch=(type,code,keyCode)=>{
    const e=new KeyboardEvent(type,{code,key:code.slice(-1).toLowerCase(),bubbles:true,cancelable:true,keyCode,which:keyCode});
    for(const name of ['keyCode','which']) if(e[name]!==keyCode)Object.defineProperty(e,name,{value:keyCode});
    document.getElementById('canvas')?.dispatchEvent(e);
  };
  const lower=new Map();
  let lowerUntil=0;
  state.move=(dir)=>{
    const next=new Set(dir.map(k=>'Key'+k));
    for(const [code,n] of lower)if(!next.has(code)){dispatch('keyup',code,n);lower.delete(code)}
    for(const code of next)if(!lower.has(code)){lower.set(code,codes[code]);dispatch('keydown',code,codes[code])}
    lowerUntil=Date.now()+550;
  };
  setInterval(()=>{
    if(lower.size&&Date.now()>=lowerUntil)state.move([]);
    if(state.mapOwned&&Date.now()>=state.until){
      const map=document.getElementById('worldmap');
      map?.style.removeProperty('opacity');map?.style.removeProperty('pointer-events');map?.style.removeProperty('display');
      state.mapOwned=false;
    }
  },100);
  const release=()=>{for(const [code,n] of state.held)dispatch('keyup',code,n);state.held.clear()};
  window.addEventListener('blur',release);
  setInterval(()=>{if(Date.now()>=state.until&&state.held.size)release()},400);
  function handle(e){
    if(e.isTrusted||e.target!==window||Date.now()>=state.until||!document.querySelector('#hud.show'))return;
    const down=e.type==='keydown';
    if(codes[e.code]){
      e.stopImmediatePropagation();
      if(down)state.held.set(e.code,codes[e.code]);else state.held.delete(e.code);
      dispatch(e.type,e.code,codes[e.code]);
      return;
    }
    const key=(e.altKey?'A':'')+e.code.replace(/^Digit/,'');
    if(e.code==='KeyM'&&down){e.stopImmediatePropagation();state.select=(state.select||0)+1;return}
    const b=key==='3'?null:state.bind[key];
    if(!b&&key!=='3')return;
    e.stopImmediatePropagation();
    if(!down)return;
    if(!b)return;
    if(b.type==='macro'){
      state.lastMacro={row:b.value,ok:state.runMacro(b.value),at:Date.now()};
    } else {
      [...document.querySelectorAll('#bar-rows .skill[data-id]')].find(x=>x.dataset.id===b.value&&!x.classList.contains('nomp'))?.click();
    }
  }
  window.addEventListener('keydown',handle,true);
  window.addEventListener('keyup',handle,true);
}
function view(install) {
  const q=s=>document.querySelector(s), txt=s=>q(s)?.textContent.trim().slice(0,400)||'';
  if(!q('#hud.show'))return {online:false};
  install();
  let map='';
  const c=q('#map-canvas');
  if(window.__thor.mapOwned&&typeof drawMap==='function')drawMap();
  if(c?.width&&c.height&&c.getClientRects().length)try{
    const copy=document.createElement('canvas');copy.width=400;copy.height=Math.max(1,Math.min(480,Math.round(400*c.height/c.width)));
    copy.getContext('2d').drawImage(c,0,0,copy.width,copy.height);map=copy.toDataURL('image/webp',.70);
  }catch{}
  const icon=x=>{const src=x.querySelector('img.icon')?.src||'';return src.startsWith(location.origin+'/')?src:''};
  const inventory={};
  for(const name of ['inv','pet','bank']){
    inventory[name]={
      tabs:[...(q('#'+name+'-tabs')?.querySelectorAll('button')||[])].map(b=>({name:b.textContent.trim(),on:b.classList.contains('on')})),
      slots:[...(q('#'+name+'-grid')?.children||[])].map(x=>({id:x.dataset.item||'',icon:icon(x),count:x.querySelector('.count')?.textContent||'',hint:x.dataset.hint||''}))
    };
  }
  const npc=q('#npc-menu.show')?{name:txt('#npc-name'),choices:[...q('#npc-functions').querySelectorAll('button')].map(b=>({label:b.textContent.trim(),disabled:b.disabled}))}:null;
  let catalog=[], realRows=[];
  const skillNames=new Map();
  if(typeof skillList!=='undefined'&&typeof bar!=='undefined'&&bar&&typeof BAR_COLS!=='undefined') {
    for(const skill of skillList)skillNames.set(String(skill.id),skill.name);
    catalog=skillList.filter(s=>!s.passive&&skillGroup(s)!==6).map(s=>({tid:String(s.tid),name:s.name,icon:iconFor(s)}));
    function iconFor(skill){const node=skillTile(skill);return icon(node)}
    realRows=[0,1,2,3].map(row=>BAR_COLS.map((col)=>{
      const tid=bar.slots[10*row+col]||0;
      return {tid:String(tid),item:tid<0};
    }));
  }
  return {online:true,pressed:window.__thor.pressed||[],lastPress:window.__thor.lastPress,
    buffRows:typeof bar!=='undefined'&&bar?[bar.bRow??1,bar.bRow2??-1]:[],
    fullscreen:!!document.fullscreenElement,nativeMenu:window.__thor.menu(),bindings:window.__thor.bind,lastMacro:window.__thor.lastMacro,
    activeRow:typeof macroRow==='number'?String(macroRow):'',inventory,npc,catalog,realRows,select:window.__thor.select||0,focused:document.hasFocus(),level:txt('#level'),hp:txt('#hp-text'),mp:txt('#mp-text'),xp:txt('#exp-text'),
    bars:['hp','mp','exp'].map(k=>parseFloat(q('#'+k+'-fill')?.style.width)||0),
    macro:!!q('#macro-on:not([hidden])'),map,
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
      return {key:x.querySelector('.key')?.textContent.trim(),id:x.dataset.id||'',name:skillNames.get(x.dataset.id)||'',icon:src.startsWith(location.origin+'/')?src:'',
        disabled:x.classList.contains('nomp'),cooldown:x.querySelector('.cd')?.textContent.trim()||''};
    })};
}
function action(a) {
  const q=s=>document.querySelector(s);
  if(!q('#hud.show'))return false;
  if(a.type==='nav')return window.__thor?.navigate(a.value)||false;
  if(a.type==='combat')return window.__thor?.combat(a.value)||false;
  if(a.type==='combo'){
    const b=window.__thor?.bind[a.value];
    if(!b||window.__thor.menu())return false;
    if(b.type==='macro')return window.__thor.runMacro(b.value);
    const skill=[...document.querySelectorAll('#bar-rows .skill[data-id]')].find(x=>x.dataset.id===b.value&&!x.classList.contains('nomp'));
    if(!skill)return false;skill.click();return true;
  }
  if(a.type==='move'){window.__thor?.move(a.value);return !!window.__thor}
  if(a.type==='pad'){
    const keys={1:['Digit3','3'],2:['Digit4','4'],3:['Digit5','5'],4:['Digit6','6'],5:['Digit3','3',true],6:['Digit4','4',true],7:['Digit5','5',true],8:['Digit6','6',true]};
    const [code,key,altKey]=keys[a.value];
    const binding=window.__thor?.bind[(altKey?'A':'')+key];
    if(binding?.type==='macro'){
      const ok=window.__thor.runMacro(binding.value);
      window.__thor.lastMacro={row:binding.value,ok,at:Date.now()};
      return ok;
    }
    if(a.value==='1')return false;
    if(a.value==='6'&&!window.__thor?.bind.A4&&typeof Module!=='undefined'&&Module.ccall('viewer_interact','number',[],[]))return true;
    for(const type of ['keydown','keyup'])window.dispatchEvent(new KeyboardEvent(type,{code,key,altKey,bubbles:true,cancelable:true}));
    return true;
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
  if(a.type==='macroSlot'){
    const {row,slot,tid}=a.value;
    if(typeof bar==='undefined'||!bar||typeof mwPlace!=='function'||typeof BAR_COLS==='undefined')return false;
    const index=10*row+BAR_COLS[slot];
    if(bar.slots[index]<0)return false;
    if(tid&&!skillList.some(s=>s.tid===tid&&!s.passive&&skillGroup(s)!==6))return false;
    mwPlace(index,tid);return true;
  }
  if(a.type==='bind'){if(!window.__thor)return false;window.__thor.bind=a.value;return true}
  if(a.type==='spell'){
    const x=[...document.querySelectorAll('#bar-rows .skill[data-id]')].find(x=>x.dataset.id===a.value&&!x.classList.contains('nomp'));
    if(!x)return false;x.click();return true;
  }
  if(a.type==='macro')return window.__thor?.runMacro(a.value)||false;
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
  if(a.type==='combo')return typeof a.value==='string'&&/^C4_[0-35-7]$/.test(a.value);
  if(a.type==='nav')return ['start','back','left','right','up','down','accept'].includes(a.value);
  if(a.type==='combat')return ['target','attack'].includes(a.value);
  if(a.type==='bind'){
    if(!a.value||typeof a.value!=='object')return false;
    const used=new Set();
    return Object.entries(a.value).every(([k,v])=>{
      if(!/^(?:[4-6]|A[3-6]|C4_[0-3]|C4_[5-7])$/.test(k)||!v)return false;
      if(v.type==='spell')return digits(v.value);
      if(v.type!=='macro'||!row(v.value)||used.has(v.value))return false;
      used.add(v.value);return true;
    });
  }
  if(a.type==='macroSlot')return a.value&&Number.isInteger(a.value.row)&&a.value.row>=0&&a.value.row<4&&Number.isInteger(a.value.slot)&&a.value.slot>=0&&a.value.slot<10&&Number.isInteger(a.value.tid)&&a.value.tid>=0;
  if(a.type==='move')return Array.isArray(a.value)&&a.value.length<=2&&a.value.every(v=>['W','A','S','D'].includes(v));
  if(a.type==='pad')return /^[1-8]$/.test(a.value);
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
    const states=await Promise.all(list.map(p=>call(p,'('+view.toString()+')('+inputs.toString()+')').catch(()=>null)));
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
      const page=valid(a)?(a.type==='move'?currentPage:(await read()).page):null;
      const ok=page&&await call(page,'('+action.toString()+')('+JSON.stringify(a)+')');
      res.end(JSON.stringify({ok:!!ok}));
    } else res.end(JSON.stringify((await read()).data));
  }catch {res.end(JSON.stringify(post?{ok:false}:{online:false}))}
}).listen(49226,'127.0.0.1',()=>console.log('Kaldora · liaison USB'));
