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
  if(window.__thor?.version===38){window.__thor.until=Date.now()+4000;return}
  if(window.__thor)window.__thor.until=0;
  document.querySelectorAll('.thor-nav,.thor-drag').forEach(x=>x.classList.remove('thor-nav','thor-drag'));
  const state=window.__thor={version:38,until:Date.now()+4000,held:new Map(),bind:{}};
  state.runMacro=(row)=>{
    row=Number(row);
    if(typeof toggleMacro!=='function'||typeof bar==='undefined'||!bar)return false;
    if(typeof BAR_COLS==='undefined')return false;
    if(row===(bar.bRow??1)&&typeof runBuffs==='function'){runBuffs();return true}
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
  const panel=()=>{
    const dialogs=[...document.querySelectorAll('dialog[open],[role="dialog"][aria-modal="true"]')]
      .filter(x=>visible(x)&&!x.closest('[hidden]'));
    if(dialogs.length)return dialogs[dialogs.length-1];
    return [...document.querySelectorAll('.panel.show,[role="dialog"].show')]
      .filter(x=>visible(x)&&!x.closest('[hidden]'))
      .sort((a,b)=>(parseInt(getComputedStyle(b).zIndex)||0)-(parseInt(getComputedStyle(a).zIndex)||0))[0]
      ||menuSelectors.map(s=>document.querySelector(s)).find(x=>x?.classList.contains('show')&&visible(x));
  };
  const buttons=p=>{
    const list=[...p.querySelectorAll('button,[role=button],select,input:not([type=hidden]),textarea,.skill-card,[draggable=true],[onclick],[tabindex]:not([tabindex="-1"]),#inv-grid .slot,#pet-grid .slot,#bank-grid .slot,#cash-grid .slot,#doll-slots .equip-slot,#inv-trash,#pet-trash,#cash-trash,#mw-rows .skill,#mw-skills .skill')].filter(x=>!x.disabled&&x.getAttribute('aria-disabled')!=='true'&&visible(x));
    return list.sort((a,b)=>Number(a.matches('.close,[data-close]'))-Number(b.matches('.close,[data-close]')));
  };
  const ownedItem=id=>(typeof inv!=='undefined'&&inv?.items?.find(x=>String(x.id)===String(id)))||(typeof bankItems!=='undefined'&&bankItems?.find(x=>String(x.id)===String(id)))||null;
  const lockedSlot=node=>!!(node?.dataset?.item&&ownedItem(node.dataset.item)?.locked);
  let highlighted, dragSource, dragItem, dragMoved=false, anchor, dragStartedAt=0, lastItemTap=null;
  const anchors=new WeakMap();
  function highlight(next){
    if(highlighted===next)return;
    highlighted?.classList.remove('thor-nav');
    highlighted=next;
    if(next){
      const parent=next.parentElement;
      anchor=parent?.id?{parent:parent.id,index:[...parent.children].indexOf(next),id:next.id,item:next.dataset.item||''}:null;
      const owner=panel();if(owner&&anchor)anchors.set(owner,anchor);
next.classList.add('thor-nav');next.scrollIntoView({block:'nearest',inline:'nearest'});}
  }
  const style=document.createElement('style');
  style.textContent='.thor-nav{outline:3px solid #9bdafe!important;outline-offset:2px;box-shadow:0 0 10px #5dbcf2!important}.thor-drag{outline:3px solid #e9bf70!important;outline-offset:2px}';
  style.textContent+='html.touch .set-row:has(#set-effects),html.touch .set-row:has(#set-bufffx){display:flex!important}';
  document.head.appendChild(style);
  try {
    const saved=JSON.parse(localStorage.getItem('archlord.settings')||'{}');
    if(typeof settings!=='undefined'&&['0','1','2'].includes(String(saved.effects))&&typeof setEffects==='function'){
      settings.effects=String(saved.effects);setEffects(Number(saved.effects));
      const el=document.getElementById('set-effects');if(el)el.value=String(saved.effects);
    }
    if(typeof settings!=='undefined'&&typeof saved.buffFx==='boolean'){
      settings.buffFx=saved.buffFx;
      Module.ccall('viewer_set_buff_effects',null,['number'],[saved.buffFx?1:0]);
      const el=document.getElementById('set-bufffx');if(el)el.checked=saved.buffFx;
    }
  }catch{}

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
      if(dragSource){dragSource.classList.remove('thor-drag');dragSource=null;dragItem=null;dragMoved=false;return true}
      const close=current.querySelector('h3 .close,.close,[data-close="'+current.id+'"],#ask-no,[data-action="cancel"],button[value="cancel"]');
      if(close&&visible(close))close.click();
      else if(current.id==='menu-win')document.getElementById('menu-btn')?.click();
      else return false;
      highlight(undefined);return true;
    }
    if(!list.length)return false;
    if(!list.includes(highlighted)){
      const saved=anchors.get(current);
      const restored=saved&&(saved.id?document.getElementById(saved.id):document.getElementById(saved.parent)?.children[saved.index]);
      highlight(list.includes(restored)?restored:list[0]);
      if(command!=='accept'&&command!=='downAccept')return true;
    }
    if(command==='downAccept'){
      if(highlighted.matches('select')){
        highlighted.selectedIndex=(highlighted.selectedIndex+1)%highlighted.options.length;
        highlighted.dispatchEvent(new Event('change',{bubbles:true}));return true;
      }
      if(!highlighted.matches('.slot,.skill')){const selected=highlighted;selected.click();if(selected.isConnected&&visible(selected))highlight(selected);return true}
      dragSource=highlighted;dragItem=highlighted.dataset.item||null;dragMoved=false;dragStartedAt=Date.now();
      dragSource.classList.add('thor-drag');return true;
    }
    if(command==='upAccept'){
      if(!dragSource)return true;
      const source=dragSource, target=highlighted, item=dragItem;
      source.classList.remove('thor-drag');dragSource=null;dragItem=null;
      if(dragMoved&&target&&target!==source&&source.isConnected&&target.isConnected){
        lastItemTap=null;
        if(lockedSlot(source)||lockedSlot(target)){dragMoved=false;return false}
        const transfer=new DataTransfer();
        if(item)transfer.setData('text/plain',item);
        else source.dispatchEvent(new DragEvent('dragstart',{bubbles:true,cancelable:true,dataTransfer:transfer}));
        if(transfer.types.length){
          target.dispatchEvent(new DragEvent('dragover',{bubbles:true,cancelable:true,dataTransfer:transfer}));
          target.dispatchEvent(new DragEvent('drop',{bubbles:true,cancelable:true,dataTransfer:transfer}));
          source.dispatchEvent(new DragEvent('dragend',{bubbles:true,cancelable:true,dataTransfer:transfer}));
        }
      }else if(!dragMoved&&source.isConnected){
        const isItem=!!item&&(!!source.closest('#inv-grid,#pet-grid,#cash-grid')||(typeof source.ondblclick==='function'&&!!source.closest('#bank-grid,#doll-slots')));
        const now=Date.now();
        const repeated=isItem&&lastItemTap?.id===item&&lastItemTap.grid===source.parentElement&&now-lastItemTap.at<=650;
        if(isItem&&now-dragStartedAt>=700){
          lastItemTap=null;
        }else if(repeated){
          lastItemTap=null;
          source.dispatchEvent(new MouseEvent('dblclick',{bubbles:true,cancelable:true,detail:2}));
        }else{
          lastItemTap=isItem?{id:item,grid:source.parentElement,at:now}:null;
          source.click();
        }
      }
      dragMoved=false;return true;
    }
    if(command==='accept'){highlighted.click();highlight(undefined);return true}
    const horizontal=command==='left'||command==='right', sign=command==='left'||command==='up'?-1:1;
    if(horizontal&&highlighted.matches('select,input[type=range]')){
      if(highlighted.tagName==='SELECT')highlighted.selectedIndex=Math.max(0,Math.min(highlighted.options.length-1,highlighted.selectedIndex+sign));
      else highlighted.value=String(Math.max(Number(highlighted.min||0),Math.min(Number(highlighted.max||100),Number(highlighted.value)+sign*Number(highlighted.step||1))));
      highlighted.dispatchEvent(new Event('input',{bubbles:true}));highlighted.dispatchEvent(new Event('change',{bubbles:true}));return true;
    }
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
    if(best){if(dragSource)dragMoved=true;highlight(best)}
    return true;
  }
  state.navigate=navigate;
  state.menu=()=>panel()?.id||"";
  state.selectedItem=()=>{
    const current=panel(),selector='#inv-grid .slot,#pet-grid .slot,#bank-grid .slot,#cash-grid .slot,#doll-slots .equip-slot';
    if(!current||!highlighted)return null;
    if(!current.contains(highlighted)){
      const id=anchors.get(current)?.item;
      const replacement=id&&[...current.querySelectorAll(selector)].find(node=>node.dataset.item===id);
      if(replacement)highlight(replacement);
    }
    return current.contains(highlighted)&&highlighted.matches(selector)?highlighted:null;
  };
  state.toggleItemLock=(id,expected)=>{
    const slot=state.selectedItem(),item=ownedItem(id),pending=state.lockPending;
    if(!slot||slot.dataset.item!==String(id)||!item||!!item.locked!==expected||typeof Module==='undefined')return false;
    if(pending&&pending.id===String(id)&&Date.now()<pending.until)return false;
    state.lockPending={id:String(id),expected,until:Date.now()+5000};
    try{Module.ccall('viewer_toggle_lock',null,['number'],[item.id]);return true}catch{state.lockPending=null;return false}
  };
  window.addEventListener('pointerdown',event=>{
    if(window.__thor!==state||Date.now()>=state.until||!document.querySelector('#hud.show')||!event.isTrusted)return;
    const current=panel(),target=event.target?.closest?.('#inv-grid .slot,#pet-grid .slot,#bank-grid .slot,#cash-grid .slot,#doll-slots .equip-slot');
    if(current&&target&&current.contains(target))highlight(target);
  },true);
  const hasNativePad=()=>typeof pad!=='undefined'&&Array.isArray(pad?.map)&&typeof padFrame==='function';
  const rawPads=navigator.getGamepads?.bind(navigator);
  const navButtons={0:'accept',1:'back',9:'start',12:'up',13:'down',14:'left',15:'right'};
  const watched=[...Object.keys(navButtons).map(Number),4,5,6,7,8,10,11,2,3];
  const trustedNav={ArrowUp:'up',ArrowDown:'down',ArrowLeft:'left',ArrowRight:'right',Enter:'accept',Escape:'back',Backspace:'back'};
  window.addEventListener('keydown',e=>{
    if(!active()||!e.isTrusted||e.repeat||/^(INPUT|SELECT|TEXTAREA)$/.test(e.target?.tagName)||!trustedNav[e.key])return;
    if(panel())navigate(e.key==='Enter'?'downAccept':trustedNav[e.key]);
    if(panel()||e.key.startsWith('Arrow')){e.preventDefault();e.stopImmediatePropagation()}
  },true);
  window.addEventListener('keyup',e=>{
    if(!active()||!e.isTrusted||e.key!=='Enter'||!panel())return;
    navigate('upAccept');e.preventDefault();e.stopImmediatePropagation();
  },true);
  const blocked=new Set([...watched,4]);
  const physicalKeys={0:'A4',1:'A5',2:'4',3:'5',4:'L1',5:'6',6:'A3',7:'A6',8:'SELECT',9:'START',10:'L3',11:'R3',12:'UP',13:'DOWN',14:'LEFT',15:'RIGHT'};
  function active(){return window.__thor===state&&Date.now()<state.until&&document.hasFocus()&&!!document.querySelector('#hud.show')}
  if(rawPads){
    navigator.getGamepads=()=>{
      const pads=rawPads();
      if(!active())return pads;
      const menu=!!panel();
      return Array.from(pads,pad=>pad&&new Proxy(pad,{get(target,prop){
        if(prop==='buttons')return Array.from(target.buttons,(button,i)=>(menu?blocked.has(i):((hasNativePad()?[0,1,2,3,4,5,6,7,8,9,10,11,12,13,14,15]:[4,8,9,10,11,12,13,14,15]).includes(i)||!!state.bind[physicalKeys[i]]||(target.buttons[4]?.pressed&&!!state.bind['C4_'+i])))?{pressed:false,touched:false,value:0}:button);
        if(prop==='axes'&&!target.mapping&&target.axes.length>=8)return Array.from(target.axes,(axis,i)=>i===6||i===7?0:axis);
        const value=Reflect.get(target,prop,target);
        return typeof value==='function'?value.bind(target):value;
      }}));
    };
    let previous=new Set(),l1Used=false;
    function poll(){
      if(window.__thor!==state)return;
      requestAnimationFrame(poll);
      if(!active()){previous.clear();state.pressed=[];return}
      const menu=panel();
      if(menu&&!buttons(menu).includes(highlighted)){
        const list=buttons(menu), saved=anchors.get(menu), restored=saved&&(saved.id?document.getElementById(saved.id):document.getElementById(saved.parent)?.children[saved.index]);
        highlight(list.includes(restored)?restored:list[0]);
      }
      if(!menu&&highlighted)highlight(undefined);
      const pad=Array.from(rawPads()).find(x=>x?.connected);
      if(!pad){previous.clear();state.pressed=[];return}
      const now=new Set(watched.filter(i=>pad.buttons[i]?.pressed));
      if(!pad.mapping&&pad.axes.length>=8){
        if(pad.axes[6]<-.65)now.add(14);else if(pad.axes[6]>.65)now.add(15);
        if(pad.axes[7]<-.65)now.add(12);else if(pad.axes[7]>.65)now.add(13);
      }
      state.pressed=[...now];
      if(now.has(4)&&!previous.has(4))l1Used=false;
      for(const i of now){
        if(previous.has(i))continue;
        state.lastPress={button:i,at:Date.now()};
        if(menu){
          const combo=now.has(4)&&i!==4?'C4_'+i:null,key=physicalKeys[i];
          if(combo&&state.bind[combo]?.type==='action'&&state.bind[combo].value==='itemLock'){l1Used=true;state.performBinding(combo)}
          else if(key&&!navButtons[i]&&i!==4&&state.bind[key]?.type==='action'&&state.bind[key].value==='itemLock')state.performBinding(key);
          else if(i===9)navigate('start');else if(navButtons[i])navigate(i===0?'downAccept':navButtons[i]);continue;
        }
        if(i===4)continue;
        if(now.has(4)&&state.bind['C4_'+i]){l1Used=true;state.performBinding('C4_'+i);continue}
        const key=physicalKeys[i];
        if(key&&state.bind[key]){state.performBinding(key);continue}
        if(hasNativePad()&&[0,1,2,3,5,6,7].includes(i))state.performPad(i);
        else if(i===9)navigate('start');
        else if(i===8)state.select=(state.select||0)+1;
        else if(i===10||i===11)state.combat(i===10?'target':'attack');
      }
      if(menu&&previous.has(0)&&!now.has(0))navigate('upAccept');
      if(previous.has(4)&&!now.has(4)&&!l1Used&&state.bind.L1&&(!menu||(state.bind.L1.type==='action'&&state.bind.L1.value==='itemLock')))state.performBinding('L1');
      previous=now;
    }
    requestAnimationFrame(poll);
  }
  state.performBinding=key=>{
    const binding=state.bind[key];
    if(binding?.type==='macro'){const ok=state.runMacro(binding.value);state.lastMacro={row:binding.value,ok,at:Date.now()};return ok}
    if(binding?.type==='spell'){const skill=[...document.querySelectorAll('#bar-rows .skill[data-id]')].find(x=>x.dataset.id===binding.value&&!x.classList.contains('nomp'));if(!skill)return false;skill.click();return true}
    if(binding?.type==='action'){
      const action=binding.value;
      if(action==='target'||action==='attack')return state.combat(action);
      if(action==='itemLock'){const slot=state.selectedItem(),item=slot&&ownedItem(slot.dataset.item);return !!item&&state.toggleItemLock(String(item.id),!!item.locked)}
      if(action==='menu')return navigate('start');
      if(action==='companion'){state.select=(state.select||0)+1;return true}
      if(action==='interact')return !!Module.ccall('viewer_interact','number',[],[]);
      if(action==='buff'&&typeof runBuffs==='function'){runBuffs();return true}
      const ids={map:'map-btn',bag:'bag-btn',skills:'skills-btn',macro:'macro-btn',character:'char-btn',quests:'missions-btn'};
      const button=document.getElementById(ids[action]);if(button){button.click();return true}
    }
    return false;
  };
  state.performPad=index=>{
    const mapping={0:['Digit4','4',true],1:['Digit5','5',true],2:['Digit4','4'],3:['Digit5','5'],5:['Digit6','6'],6:['Digit3','3',true],7:['Digit6','6',true]};
    const [code,key,altKey]=mapping[index];
    const binding=state.bind[(altKey?'A':'')+key];
    if(binding?.type==='macro'){
      const ok=state.runMacro(binding.value);state.lastMacro={row:binding.value,ok,at:Date.now()};return ok;
    }
    if(binding?.type==='spell'){
      const skill=[...document.querySelectorAll('#bar-rows .skill[data-id]')].find(x=>x.dataset.id===binding.value&&!x.classList.contains('nomp'));
      if(!skill)return false;skill.click();return true;
    }
    if(index===0&&typeof Module!=='undefined'&&Module.ccall('viewer_interact','number',[],[]))return true;
    for(const type of ['keydown','keyup'])window.dispatchEvent(new KeyboardEvent(type,{code,key,altKey:!!altKey,bubbles:true,cancelable:true}));
    return true;
  };
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
  let lowerUntil=0, camera=[0,0], cameraTime=0;
  state.move=(dir,axes=[0,0])=>{
    camera=axes;
    if((dir.length||Math.hypot(...axes)>.12)&&!panel()&&typeof padShowTouch==='function'){
      if(typeof padHide!=='undefined')padHide=true;
      padShowTouch();
      document.documentElement.classList.add('padplay');
    }
    const next=new Set(dir.map(k=>'Key'+k));
    for(const [code,n] of lower)if(!next.has(code)){dispatch('keyup',code,n);lower.delete(code)}
    for(const code of next)if(!lower.has(code)){lower.set(code,codes[code]);dispatch('keydown',code,codes[code])}
    lowerUntil=Date.now()+550;
  };
  setInterval(()=>{
    const now=Date.now();
    if(now>=lowerUntil){
      if(lower.size||camera[0]||camera[1])state.move([],[0,0]);
      cameraTime=now;return;
    }
    if(!panel()&&typeof Module!=='undefined'&&typeof pad!=='undefined'){
      const [x,y]=camera, dead=(Number(pad.dead)||40)/200;
      const elapsed=Math.min(50,cameraTime?now-cameraTime:16);
      if(Math.hypot(x,y)>dead){
        const scale=(Number(pad.cam)||2.5)*elapsed/(1000/60);
        Module.ccall('viewer_cam_rotate',null,['number','number'],[(pad.invert?-y:y)*scale,x*scale]);
      }
    }
    cameraTime=now;
  },16);
  setInterval(()=>{
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
    if(hasNativePad())return;
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
    catalog=skillList.filter(s=>!s.passive&&skillGroup(s)!==6).map(s=>({tid:String(s.tid),name:s.name,icon:iconFor(s)}));
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
      const parts={2:'armour',3:'helmet',4:'gloves',5:'gloves',6:'leggings',7:'boots',9:'shield',10:'weapon',11:'ring',12:'ring',13:'necklace'};
      const part=parts[item.part];
      const socketOptions=part&&inv.items.includes(item)&&item.sockets>(item.stones||[]).length?inv.items.filter(x=>!x.equipped&&!x.shop&&!x.bank&&!x.trade&&x.count>0&&x.conv===2&&/^Fits:\s*/i.test(x.fx||'')&&(x.fx||'').slice(5).split(',').some(v=>v.trim().toLowerCase()===part)).map(x=>{
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
  return {online:true,potions,effects:typeof settings!=='undefined'?String(settings.effects):null,sets,itemDetails,pressed:window.__thor.pressed||[],lastPress:window.__thor.lastPress,
    nativePad:typeof pad!=='undefined'&&Array.isArray(pad?.map)&&typeof padFrame==='function',
    nativePadMap:typeof pad!=='undefined'&&Array.isArray(pad?.map)?pad.map.map(value=>({value,label:(typeof PAD_ACTIONS!=='undefined'?PAD_ACTIONS.flatMap(group=>group[1]).find(option=>option[0]===value)?.[1]:null)||value||'Nothing'})):[],
    buffRows:typeof bar!=='undefined'&&bar?[bar.bRow??1,bar.bRow2??-1]:[],
    fullscreen:!!document.fullscreenElement,nativeMenu:window.__thor.menu(),bindings:window.__thor.bind,lastMacro:window.__thor.lastMacro,
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
  if(a.type==='nativePad'){
    if(typeof pad==='undefined'||!Array.isArray(pad.map)||window.__thor?.menu())return false;
    const mapping=pad.map[a.value]||'';
    if(mapping==='macro'){if(typeof toggleMacro==='function')toggleMacro(bar.mRow||0);return true}
    if(mapping==='buffs'){if(typeof runBuffs==='function')runBuffs();return true}
    if(mapping==='act'){if(Module.ccall('viewer_interact','number',[],[]))return true;
      for(const type of ['keydown','keyup'])window.dispatchEvent(new KeyboardEvent(type,{code:'Space',key:' ',bubbles:true,cancelable:true}));return true}
    if(mapping.startsWith('k:')){
      const [,code,modifier]=mapping.split(':');
      for(const type of ['keydown','keyup'])window.dispatchEvent(new KeyboardEvent(type,{code,key:typeof padKeyName==='function'?padKeyName(code):code,shiftKey:modifier==='s',altKey:modifier==='a',bubbles:true,cancelable:true}));
      return true;
    }
    return !mapping;
  }
  if(a.type==='effects'){
    const el=q('#set-effects');if(!el||!['0','1','2'].includes(String(a.value)))return false;
    el.value=String(a.value);el.dispatchEvent(new Event('change',{bubbles:true}));return true;
  }
  if(a.type==='nav')return window.__thor?.navigate(a.value)||false;
  if(a.type==='combat')return window.__thor?.combat(a.value)||false;
  if(a.type==='combo'){if(window.__thor?.menu()&&window.__thor?.bind[a.value]?.value!=='itemLock')return false;return window.__thor?.performBinding(a.value)||false}
  if(a.type==='itemLock')return window.__thor?.toggleItemLock(a.value.id,a.value.locked)||false;
  if(a.type==='socketInsert'){
    if(typeof inv==='undefined'||typeof socketStone!=='function')return false;
    const item=inv.items.find(x=>String(x.id)===a.value.item),stone=inv.items.find(x=>String(x.id)===a.value.stone);
    const parts={2:'armour',3:'helmet',4:'gloves',5:'gloves',6:'leggings',7:'boots',9:'shield',10:'weapon',11:'ring',12:'ring',13:'necklace'},part=parts[item?.part];
    if(!item||!stone||window.__thor?.selectedItem?.()?.dataset.item!==String(item.id)||!part||item.sockets<=(item.stones||[]).length||stone.equipped||stone.shop||stone.bank||stone.trade||stone.count<=0||stone.conv!==2||!/^Fits:\s*/i.test(stone.fx||'')||!stone.fx.slice(5).split(',').some(x=>x.trim().toLowerCase()===part))return false;
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
  if(a.type==='move'){
    const dir=Array.isArray(a.value)?a.value:a.value.dir;
    const camera=Array.isArray(a.value)?[0,0]:a.value.camera;
    window.__thor?.move(dir,camera);return !!window.__thor
  }
  if(a.type==='pad'){
    const keys={1:['Digit3','3'],2:['Digit4','4'],3:['Digit5','5'],4:['Digit6','6'],5:['Digit3','3',true],6:['Digit4','4',true],7:['Digit5','5',true],8:['Digit6','6',true]};
    const [code,key,altKey]=keys[a.value];
    const binding=window.__thor?.bind[(altKey?'A':'')+key];
    if(binding?.type==='macro'){
      const ok=window.__thor.runMacro(binding.value);
      window.__thor.lastMacro={row:binding.value,ok,at:Date.now()};
      return ok;
    }
    if(binding?.type==='spell'){
      const skill=[...document.querySelectorAll('#bar-rows .skill[data-id]')].find(x=>x.dataset.id===binding.value&&!x.classList.contains('nomp'));
      if(!skill)return false;
      skill.click();return true;
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
  if(a.type==='nativePad')return Number.isInteger(a.value)&&a.value>=0&&a.value<=15;
  if(a.type==='combo')return typeof a.value==='string'&&/^(?:[4-6]|A[3-6]|C4_[0-35-7]|L1|L3|R3|START|SELECT|UP|DOWN|LEFT|RIGHT)$/.test(a.value);
  if(a.type==='itemLock')return !!a.value&&digits(a.value.id)&&typeof a.value.locked==='boolean';
  if(a.type==='socketInsert')return !!a.value&&digits(a.value.item)&&digits(a.value.stone);
  if(a.type==='effects')return ['0','1','2'].includes(String(a.value));
  if(a.type==='nav')return ['start','back','left','right','up','down','accept','downAccept','upAccept'].includes(a.value);
  if(a.type==='combat')return ['target','attack'].includes(a.value);
  if(a.type==='bind'){
    if(!a.value||typeof a.value!=='object')return false;
    const used=new Set();
    return Object.entries(a.value).every(([k,v])=>{
      if(!/^(?:[4-6]|A[3-6]|C4_[0-3]|C4_[5-7]|L1|L3|R3|START|SELECT|UP|DOWN|LEFT|RIGHT)$/.test(k)||!v)return false;
      if(v.type==='spell')return digits(v.value);
      if(v.type==='action')return ['target','attack','interact','menu','companion','buff','map','bag','skills','macro','character','quests','itemLock'].includes(v.value);
      if(v.type!=='macro'||!row(v.value)||used.has(v.value))return false;
      used.add(v.value);return true;
    });
  }
  if(a.type==='macroSlot')return a.value&&Number.isInteger(a.value.row)&&a.value.row>=0&&a.value.row<4&&Number.isInteger(a.value.slot)&&a.value.slot>=0&&a.value.slot<10&&Number.isInteger(a.value.tid)&&a.value.tid>=0;
  if(a.type==='potionAssign')return a.value&&Number.isInteger(a.value.slot)&&a.value.slot>=0&&a.value.slot<=1&&digits(a.value.id);
  if(a.type==='gear')return Number.isInteger(a.value)&&a.value>=0&&a.value<4;
  if(a.type==='gearEdit')return true;
  if(a.type==='move'){
    const dir=Array.isArray(a.value)?a.value:a.value?.dir;
    const camera=Array.isArray(a.value)?[0,0]:a.value?.camera;
    return Array.isArray(dir)&&dir.length<=2&&dir.every(v=>['W','A','S','D'].includes(v))&&
      Array.isArray(camera)&&camera.length===2&&camera.every(v=>typeof v==='number'&&Number.isFinite(v)&&Math.abs(v)<=1);
  }
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
