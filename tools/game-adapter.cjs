function inputs() {
  if(window.__thor?.version===47){
    if(Date.now()>=window.__thor.until){window.__thor.pk=false;window.__thor.clearCashMarks?.()}
    window.__thor.until=Date.now()+4000;return;
  }
  if(window.__thor)window.__thor.until=0;
  document.querySelectorAll('.thor-nav,.thor-drag').forEach(x=>x.classList.remove('thor-nav','thor-drag'));
  const state=window.__thor={version:47,until:Date.now()+4000,held:new Map(),bind:{},pk:false};
  // Kaldora uses part 9 for both shields and off-hand weapons. Its own
  // drawDoll / stoneRisk code identifies a weapon by positive max damage.
  state.socketGearType=item=>{
    if(!item||!Number.isInteger(item.part))return null;
    if(item.part===9){
      const damage=item.st?.dmax;
      return typeof damage==='number'&&Number.isFinite(damage)&&damage>=0?(damage>0?'weapon':'shield'):null;
    }
    return ({2:'armour',3:'helmet',4:'gloves',5:'gloves',6:'leggings',7:'boots',10:'weapon',11:'ring',12:'ring',13:'necklace'})[item.part]||null;
  };
  state.socketCompatible=(item,stone)=>{
    const part=state.socketGearType(item);
    if(!part||!stone||stone.equipped||stone.shop||stone.bank||stone.trade||!(stone.count>0)||stone.conv!==2||!/^Fits:\s*/i.test(stone.fx||''))return false;
    return stone.fx.slice(5).split(',').some(value=>value.trim().toLowerCase()===part);
  };
  let retarget=null;
  state.runMacro=(row)=>{
    row=Number(row);
    if(!Number.isInteger(row)||row<0||row>3||typeof toggleMacro!=='function'||typeof bar==='undefined'||!bar||typeof BAR_COLS==='undefined')return false;
    const isBuff=row===(bar.bRow??1)||row===(bar.bRow2??-1);
    const skills=typeof macroIds==='function'?macroIds(row):BAR_COLS.map(col=>slotSkill(10*row+col)).filter(Boolean).map(skill=>skill.id);
    if(!skills.length&&!isBuff)return false;
    // A manual attack-macro command takes precedence over an automatic restart.
    if(!isBuff&&retarget){
      const alreadyStopping=retarget.row===row;
      retarget=null;
      if(alreadyStopping)return true;
    }
    // The native implementation owns row chaining and buff behavior.
    const before=typeof macroRow==='number'?macroRow:null;
    toggleMacro(row);
    return isBuff||before===row||typeof macroRow!=='number'||macroRow===row;
  };
  state.chainInfo=()=>{
    if(typeof bar==='undefined'||!bar||typeof macroSpan!=='function'||typeof rowHasItems!=='function'||typeof ITEM_ROW!=='number')return null;
    const flags=Number(bar.chain)||0;
    return [0,1,2].map(row=>{
      const next=row+1,buffs=[bar.bRow??1,bar.bRow2??-1],linked=macroSpan(row).length>1;
      const sourceBuff=buffs.includes(row),targetBuff=buffs.includes(next),itemRow=next===ITEM_ROW,items=rowHasItems(next);
      const reason=sourceBuff?'This row is a buff row.':targetBuff?'The next row is reserved for buffs.':itemRow?'The next row is reserved for items.':items?'The next row contains items.':'';
      return {row,linked,canToggle:linked||!reason,reason,expected:flags};
    });
  };
  const menuSelectors=['#npc-menu','#menu-win','#inventory','#shop','#petbag','#bank','#skills','#macro-win','#missions','#character'];
  const visible=x=>x&&x.getClientRects().length&&getComputedStyle(x).visibility!=='hidden';
  let highlighted, highlightOwner, dragSource, dragItem, dragMoved=false, anchor, dragStartedAt=0, lastItemTap=null, cardReturn=null;
  const panels=()=>[...document.querySelectorAll('.panel.show,[role="dialog"].show')]
    .filter(x=>visible(x)&&!x.closest('[hidden]'));
  const panel=()=>{
    const dialogs=[...document.querySelectorAll('dialog[open],[role="dialog"][aria-modal="true"]')]
      .filter(x=>visible(x)&&!x.closest('[hidden]'));
    if(dialogs.length)return dialogs[dialogs.length-1];
    const portal=document.querySelector('#portal.show');
    if(visible(portal))return portal;
    const characterPicker=document.querySelector('#select.show #pick-view:not([hidden]) #pick');
    if(visible(characterPicker))return characterPicker;
    const available=panels();
    const selected=available.find(x=>highlighted&&x.contains(highlighted)) ||
      (highlighted&&!highlighted.isConnected&&available.includes(highlightOwner)?highlightOwner:null);
    return selected || available
      .sort((a,b)=>(parseInt(getComputedStyle(b).zIndex)||0)-(parseInt(getComputedStyle(a).zIndex)||0))[0]
      ||menuSelectors.map(s=>document.querySelector(s)).find(x=>x?.classList.contains('show')&&visible(x));
  };
  const controlSelector='button,[role=button],select,input:not([type=hidden]),textarea,.skill-card,[draggable=true],[onclick],[tabindex]:not([tabindex="-1"]),#shop-list .row,#inv-grid .slot,#pet-grid .slot,#bank-grid .slot,#cash-grid .slot,#doll-slots .equip-slot,#inv-trash,#pet-trash,#cash-trash,#mw-rows .skill,#mw-skills .skill';
  const buttons=p=>{
    const list=[...p.querySelectorAll(controlSelector)].filter(x=>!x.disabled&&x.getAttribute('aria-disabled')!=='true'&&visible(x));
    if(p.id==='portal'){
      const priority=node=>node.matches('#portal-list button')?0:node.matches('.close,[data-close]')?2:1;
      return list.sort((a,b)=>priority(a)-priority(b));
    }
    return list.sort((a,b)=>Number(a.matches('.close,[data-close]'))-Number(b.matches('.close,[data-close]')));
  };
  const ownedItem=id=>(typeof inv!=='undefined'&&inv?.items?.find(x=>String(x.id)===String(id)))||(typeof bankItems!=='undefined'&&bankItems?.find(x=>String(x.id)===String(id)))||null;
  const lockedSlot=node=>!!(node?.dataset?.item&&ownedItem(node.dataset.item)?.locked);
  const anchors=new WeakMap();
  const activeCard=owner=>{
    const card=document.querySelector('#inv-card:not([hidden])');
    return visible(card)&&owner?.contains(card)?card:null;
  };
  function restoreAnchor(owner,list){
    const card=activeCard(owner);
    const saved=anchors.get(card||owner);
    if(!saved)return (card&&list.find(node=>card.contains(node)))||list[0];
    const byId=saved.id&&document.getElementById(saved.id);
    if(list.includes(byId))return byId;
    const item=saved.item&&list.find(node=>node.dataset.item===saved.item);
    if(item)return item;
    let node=owner;
    for(const index of saved.path||[])node=node?.children?.[index];
    if(saved.path?.length&&list.includes(node))return node;
    const parent=saved.parent&&document.getElementById(saved.parent);
    const slot=parent?.children?.[saved.index];
    return list.includes(slot)?slot:list[0];
  }
  function highlight(next){
    if(highlighted===next)return;
    highlighted?.classList.remove('thor-nav');
    highlighted=next;
    highlightOwner=next?.closest('#pick,.panel.show,[role="dialog"].show,dialog[open],[role="dialog"][aria-modal="true"]')||null;
    if(next){
      const parent=next.parentElement;
      const path=[];let node=next;
      while(node&&node!==highlightOwner&&node.parentElement){path.unshift([...node.parentElement.children].indexOf(node));node=node.parentElement}
      anchor={parent:parent?.id,index:parent?[...parent.children].indexOf(next):-1,id:next.id,item:next.dataset.item||'',path:node===highlightOwner?path:[]};
      const owner=highlightOwner;
      if(owner){const card=activeCard(owner);anchors.set(card?.contains(next)?card:owner,anchor);}
next.classList.add('thor-nav');next.scrollIntoView({block:'nearest',inline:'nearest'});}
  }
  const style=document.createElement('style');
  style.textContent='.thor-nav{outline:3px solid #9bdafe!important;outline-offset:2px;box-shadow:0 0 10px #5dbcf2!important}.thor-drag{outline:3px solid #e9bf70!important;outline-offset:2px}';
  style.textContent+='#shop-list .row.thor-nav,#portal-list button.thor-nav{outline:none!important;box-shadow:inset 0 0 0 3px #9bdafe!important}';
  style.textContent+='#cash-grid .thor-cash-mark:not(.thor-nav){outline:2px solid #e9bf70;outline-offset:-2px}#cash-grid .thor-cash-mark::after{content:"✓";position:absolute;inset:2px auto auto 2px;width:auto;height:auto;color:#ffe3a7;background:#251d11;border-radius:3px;padding:0 3px;pointer-events:none}#cash-trash[data-thor-marking]{width:auto;min-width:82px;border-color:#e08778}#cash-trash[data-thor-marking]::after{content:attr(data-thor-marking);padding-right:3px}';
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

  const cashSlot='#cash-grid .slot[data-item]';
  const bagSlot='#inv-grid .slot[data-item]';
  let cashMarks=null,cashConfirming=false;
  const cashItem=id=>{
    const item=ownedItem(id);
    return item?.cash&&!item.locked&&!item.inUse&&!item.equipped&&!item.trade&&!item.shop&&!item.bank?item:null;
  };
  const canMarkCash=owner=>owner?.id==='cashbag'&&!activeCard(owner)&&typeof ask==='function'&&
    typeof Module!=='undefined'&&typeof Module.ccall==='function'&&typeof inv!=='undefined'&&Array.isArray(inv.items);
  function refreshCashMarks(owner){
    if(!owner?.classList.contains('show'))cashMarks=null;
    if(cashMarks)for(const id of cashMarks)if(!cashItem(id))cashMarks.delete(id);
    owner?.querySelector('#cash-trash')?.toggleAttribute('data-thor-marking',!!cashMarks);
    if(cashMarks)owner.querySelector('#cash-trash')?.setAttribute('data-thor-marking','Destroy '+cashMarks.size);
    owner?.querySelectorAll(cashSlot).forEach(slot=>slot.classList.toggle('thor-cash-mark',!!cashMarks?.has(slot.dataset.item)));
  }
  function markCashSlot(owner,slot){
    const id=slot?.dataset.item;
    if(!canMarkCash(owner)||cashConfirming||!cashItem(id))return false;
    cashMarks??=new Set();
    if(!cashMarks.delete(id))cashMarks.add(id);
    lastItemTap=null;
    refreshCashMarks(owner);
    return true;
  }
  async function destroyMarkedCash(owner){
    const selected=[...(cashMarks||[])].map(cashItem).filter(Boolean)
      .map(({id,tid,name,count})=>({id:String(id),tid,name,count}));
    if(cashConfirming||!selected.length)return;
    cashConfirming=true;
    try{
      const lines=selected.slice(0,8).map(({name,count})=>name+(count>1?' × '+count:''));
      if(selected.length>8)lines.push('and '+(selected.length-8)+' more');
      const confirmed=ask('Destroy '+selected.length+' item'+(selected.length===1?'':'s')+'?\n'+lines.join('\n'),'',false,{ok:'Destroy',danger:true});
      const cancel=document.getElementById('ask-no');
      if(visible(cancel)){highlight(cancel);cancel.focus()}
      if(!await confirmed||!owner.classList.contains('show')||!cashMarks)return;
      const checked=selected.filter(({id,tid,count})=>{
        const item=cashItem(id);
        return cashMarks.has(id)&&item?.tid===tid&&item.count===count;
      });
      cashMarks=null;
      refreshCashMarks(owner);
      checked.forEach(({id,tid,count},index)=>setTimeout(()=>{
        const item=cashItem(id);
        if(window.__thor===state&&document.querySelector('#hud.show')&&item?.tid===tid&&item.count===count)
          Module.ccall('viewer_destroy_item',null,['number'],[Number(id)]);
      },100*Math.floor(index/10)));
    }finally{cashConfirming=false}
  }
  const cashOwner=document.getElementById('cashbag');
  state.clearCashMarks=()=>{if(cashMarks){cashMarks=null;refreshCashMarks(cashOwner)}};
  if(cashOwner&&typeof MutationObserver==='function'){
    const observer=new MutationObserver(()=>refreshCashMarks(cashOwner));
    observer.observe(cashOwner,{attributes:true,attributeFilter:['class']});
    const grid=cashOwner.querySelector('#cash-grid');
    if(grid)observer.observe(grid,{childList:true});
  }
  window.addEventListener('click',event=>{
    if(window.__thor!==state||Date.now()>=state.until||!canMarkCash(panel()))return;
    const trash=event.target?.closest?.('#cash-trash');
    const slot=event.target?.closest?.(cashSlot);
    if(trash){
      if(!cashMarks&&typeof picked==='function'&&picked()?.cash)return;
      event.preventDefault();event.stopImmediatePropagation();
      if(!cashMarks){cashMarks=new Set();refreshCashMarks(cashOwner)}
      else if(cashMarks.size)void destroyMarkedCash(cashOwner);
      else{cashMarks=null;refreshCashMarks(cashOwner)}
    }else if(cashMarks&&slot){
      event.preventDefault();event.stopImmediatePropagation();markCashSlot(cashOwner,slot);
    }
  },true);
  for(const type of ['dblclick','dragstart','drop'])window.addEventListener(type,event=>{
    if(window.__thor===state&&cashMarks&&event.target?.closest?.('#cashbag')){
      event.preventDefault();event.stopImmediatePropagation();
    }
  },true);

  const canMarkBag=owner=>owner?.id==='inventory'&&!activeCard(owner)&&
    typeof markMode==='function'&&typeof bagMarks!=='undefined'&&typeof inTab==='function';
  const markingBag=owner=>canMarkCash(owner)?cashMarks!==null:canMarkBag(owner)&&bagMarks!==null;
  const markableSlot=owner=>owner.id==='cashbag'?cashSlot:bagSlot;
  function markBagSlot(owner){
    if(dragSource||!highlighted?.matches(markableSlot(owner)))return false;
    if(canMarkCash(owner))return markCashSlot(owner,highlighted);
    if(!canMarkBag(owner))return false;
    const id=highlighted.dataset.item,item=ownedItem(id);
    if(!item||item.locked||!inTab(item,item.layer))return false;
    lastItemTap=null;
    if(!markingBag(owner))markMode(true);
    const findSlot=()=>[...owner.querySelectorAll('#inv-grid .slot[data-item]')].find(slot=>slot.dataset.item===id);
    const slot=findSlot();
    if(!slot)return false;
    slot.click();
    highlight(findSlot()||restoreAnchor(owner,buttons(owner)));
    return true;
  }
  state.menuContext=()=>{
    const current=panel();
    if(canMarkCash(current))return {kind:'bag',marked:cashMarks?.size??null};
    if(canMarkBag(current))return {kind:'bag',marked:markingBag(current)?bagMarks.size:null};
    if(activeCard(current))return {kind:'card'};
    if(current?.matches('dialog[open],[role="dialog"][aria-modal="true"]'))return {kind:'confirm'};
    return null;
  };

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
    if(command==='mark')return markBagSlot(current);
    const list=buttons(current);
    const card=activeCard(current), cardHere=!!card;
    if(command==='back'){
      if(dragSource){dragSource.classList.remove('thor-drag');dragSource=null;dragItem=null;dragMoved=false;return true}
      if(markingBag(current)){
        if(canMarkCash(current)){cashMarks=null;refreshCashMarks(current)}else markMode(false);
        highlight(restoreAnchor(current,buttons(current)));return true}
      if(cardHere){card.hidden=true;const previous=cardReturn;cardReturn=null;highlight(previous?.isConnected&&visible(previous)?previous:restoreAnchor(current,buttons(current)));return true}
      const close=current.querySelector('h3 .close,.close,[data-close="'+current.id+'"],#ask-no,[data-action="cancel"],button[value="cancel"]');
      if(close&&visible(close))close.click();
      else if(current.id==='menu-win')document.getElementById('menu-btn')?.click();
      else return false;
      highlight(undefined);return true;
    }
    if(!list.length)return false;
    if(!list.includes(highlighted)){
      highlight(restoreAnchor(current,list));
      if(command!=='accept'&&command!=='downAccept')return true;
    }
    if(command==='downAccept'){
      if(markingBag(current)&&highlighted.matches(markableSlot(current)))return markBagSlot(current);
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
          const opened=document.querySelector('#inv-card:not([hidden])');
          if(opened&&visible(opened)&&current.contains(opened)){
            const first=buttons(opened)[0];
            if(first){cardReturn=source;highlight(first)}
          }
        }
      }
      dragMoved=false;return true;
    }
    if(command==='accept'){
      if(markingBag(current)&&highlighted.matches(markableSlot(current)))return markBagSlot(current);
      const selected=highlighted;
      selected.click();
      if(selected.isConnected&&visible(selected))highlight(selected);
      return true;
    }
    const horizontal=command==='left'||command==='right', sign=command==='left'||command==='up'?-1:1;
    if(horizontal&&cardHere&&card.contains(highlighted)){
      const actions=buttons(card), next=actions[actions.indexOf(highlighted)+sign];
      if(next){highlight(next);return true}
    }
    if(!horizontal&&highlighted.matches('#shop-list .row')){
      const rows=[...document.querySelectorAll('#shop-list .row')].filter(visible);
      const next=rows[rows.indexOf(highlighted)+sign];
      if(next){highlight(next);return true}
    }
    if(horizontal&&highlighted.matches('select,input[type=range]')){
      if(highlighted.tagName==='SELECT')highlighted.selectedIndex=Math.max(0,Math.min(highlighted.options.length-1,highlighted.selectedIndex+sign));
      else highlighted.value=String(Math.max(Number(highlighted.min||0),Math.min(Number(highlighted.max||100),Number(highlighted.value)+sign*Number(highlighted.step||1))));
      highlighted.dispatchEvent(new Event('input',{bubbles:true}));highlighted.dispatchEvent(new Event('change',{bubbles:true}));return true;
    }
    const center=x=>{const r=x.getBoundingClientRect();return [r.left+r.width/2,r.top+r.height/2]};
    const [x,y]=center(highlighted);
    let best=null,score=Infinity;
    const modal=current.matches('dialog[open],[role="dialog"][aria-modal="true"]');
    const candidates=(modal||current.id==='pick'||current.id==='portal'||markingBag(current))?list:[...new Set(panels().flatMap(buttons))];
    for(const candidate of candidates){
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
  state.menu=()=>{
    const current=panel();
    // Keep the portal selection visible when the lower screen has focus.
    if(current?.id==='portal'){
      const list=buttons(current);
      if(!list.includes(highlighted))highlight(restoreAnchor(current,list));
    }
    return current?.id||"";
  };
  state.selectedShopItem=()=>{
    if(!highlighted?.isConnected||!highlighted.matches('#shop-list .row')||
       typeof shopItems!=='function'||typeof shopTab==='undefined')return null;
    const rows=[...document.querySelectorAll('#shop-list .row')];
    const index=rows.indexOf(highlighted);
    const items=shopItems().filter(item=>shopTab==='All'||item.cat===shopTab);
    return index>=0&&index<items.length?{item:items[index],slot:highlighted}:null;
  };
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
    const target=event.target?.closest?.(controlSelector);
    const current=panel();
    if(current&&target&&current.contains(target)&&buttons(current).includes(target))highlight(target);
  },true);
  const hasNativePad=()=>typeof pad!=='undefined'&&Array.isArray(pad?.map)&&typeof padFrame==='function';
  const hasNewNativePad=()=>typeof padTapValue==='function'&&typeof padFrame==='function'&&typeof macroSpan==='function';
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
  function active(){return window.__thor===state&&Date.now()<state.until&&document.hasFocus()&&!!document.querySelector('#hud.show,#select.show #pick-view:not([hidden])')}
  if(rawPads){
    navigator.getGamepads=()=>{
      const pads=rawPads();
      if(!active())return pads;
      const menu=!!panel();
      return Array.from(pads,pad=>pad&&new Proxy(pad,{get(target,prop){
        if(prop==='buttons')return Array.from(target.buttons,(button,i)=>(menu?blocked.has(i):((hasNativePad()&&!hasNewNativePad()?[0,1,2,3,4,5,6,7,8,9,10,11,12,13,14,15]:[4,8,9,10,11,12,13,14,15]).includes(i)||!!state.bind[physicalKeys[i]]||(target.buttons[4]?.pressed&&!!state.bind['C4_'+i])))?{pressed:false,touched:false,value:0}:button);
        if(prop==='axes'&&!target.mapping&&target.axes.length>=8)return Array.from(target.axes,(axis,i)=>i===6||i===7?0:axis);
        const value=Reflect.get(target,prop,target);
        return typeof value==='function'?value.bind(target):value;
      }}));
    };
    let previous=new Set(),l1Used=false,l1Ready=false,l1Armed=false;
    const repeatAt=new Map();
    function poll(){
      if(window.__thor!==state)return;
      requestAnimationFrame(poll);
      if(!active()){previous.clear();repeatAt.clear();l1Ready=l1Armed=false;state.pressed=[];return}
      const menu=panel();
      if(menu&&!buttons(menu).includes(highlighted)){
        const list=buttons(menu);
        highlight(restoreAnchor(menu,list));
      }
      if(!menu&&highlighted)highlight(undefined);
      const pad=Array.from(rawPads()).find(x=>x?.connected);
      if(!pad){previous.clear();l1Ready=l1Armed=false;state.pressed=[];return}
      const now=new Set(watched.filter(i=>pad.buttons[i]?.pressed));
      if(!pad.mapping&&pad.axes.length>=8){
        if(pad.axes[6]<-.65)now.add(14);else if(pad.axes[6]>.65)now.add(15);
        if(pad.axes[7]<-.65)now.add(12);else if(pad.axes[7]>.65)now.add(13);
      }
      state.pressed=[...now];
      for(const i of [12,13,14,15]){
        if(!menu||!now.has(i)){repeatAt.delete(i);continue}
        if(!previous.has(i))repeatAt.set(i,performance.now()+360);
        else if(performance.now()>=(repeatAt.get(i)||Infinity)){
          navigate(navButtons[i]);repeatAt.set(i,performance.now()+110);
        }
      }
      if(now.has(4)&&!previous.has(4)){l1Used=false;l1Armed=l1Ready}
      if(!now.has(4))l1Ready=true;
      for(const i of now){
        if(previous.has(i))continue;
        state.lastPress={button:i,at:Date.now()};
        if(menu){
          const combo=now.has(4)&&i!==4?'C4_'+i:null,key=physicalKeys[i];
          if(combo&&state.bind[combo]?.type==='action'&&state.bind[combo].value==='itemLock'){l1Used=true;state.performBinding(combo)}
          else if(key&&!navButtons[i]&&i!==4&&state.bind[key]?.type==='action'&&state.bind[key].value==='itemLock')state.performBinding(key);
          else if(i===2&&!now.has(4))navigate('mark');
          else if(i===9)navigate('start');else if(navButtons[i])navigate(i===0?'downAccept':navButtons[i]);continue;
        }
        if(i===4)continue;
        if(now.has(4)&&state.bind['C4_'+i]){l1Used=true;state.performBinding('C4_'+i);continue}
        const key=physicalKeys[i];
        if(key&&state.bind[key]){state.performBinding(key);continue}
        if(hasNewNativePad()&&[0,1,2,3,5,6,7].includes(i))continue;
        if(hasNativePad()&&[0,1,2,3,5,6,7].includes(i))state.performPad(i);
        else if(i===9)navigate('start');
        else if(i===8)state.select=(state.select||0)+1;
        else if(i===10||i===11)state.combat(i===10?'target':'attack');
      }
      if(menu&&previous.has(0)&&!now.has(0))navigate('upAccept');
      if(!now.has(4)&&l1Armed){
        l1Armed=false;
        if(!l1Used&&state.bind.L1&&(!menu||(state.bind.L1.type==='action'&&state.bind.L1.value==='itemLock')))state.performBinding('L1');
      }
      previous=now;
    }
    requestAnimationFrame(poll);
  }
  state.performBinding=key=>{
    const binding=state.bind[key];
    if(binding?.type==='macro'){const ok=state.runMacro(binding.value);state.lastMacro={row:binding.value,ok,at:Date.now()};return ok}
    if(binding?.type==='spell'){
      const value=String(binding.value||''),stable=/^t:(\d{1,9})$/.exec(value);
      if(stable){
        const tile=[...document.querySelectorAll('#bar-rows .skill[data-skill-tip]')].find(x=>x.dataset.skillTip===stable[1]);
        if(tile){if(tile.classList.contains('nomp'))return false;tile.click();return true}
        if(typeof padTapValue==='function'&&typeof skillList!=='undefined'){
          const skill=skillList.find(x=>String(x.tid)===stable[1]&&!x.passive);
          if(skill){if(pkEnabled())castSkill(skill,true);else padTapValue('s:'+stable[1]);return true}
        }
        return false;
      }
      // Old instance IDs can point at a different skill after reconnecting.
      if(hasNewNativePad())return false;
      const tile=[...document.querySelectorAll('#bar-rows .skill[data-id]')].find(x=>x.dataset.id===value&&!x.classList.contains('nomp'));
      if(!tile)return false;tile.click();return true;
    }
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
    if(binding?.type==='spell')return state.performBinding((altKey?'A':'')+key);
    if(index===0&&typeof Module!=='undefined'&&Module.ccall('viewer_interact','number',[],[]))return true;
    for(const type of ['keydown','keyup'])window.dispatchEvent(new KeyboardEvent(type,{code,key,altKey:!!altKey,bubbles:true,cancelable:true}));
    return true;
  };
  const liveMonster=()=>typeof targetData!=='undefined'&&targetData?.monster&&!targetData.pc&&!targetData.dead?targetData.id:null;
  const macroIndicator=()=>document.getElementById('macro-on');
  const activeAttackRow=()=>{
    const indicator=macroIndicator();
    if(!indicator||indicator.hidden||typeof macroRow!=='number'||macroRow<0||
       typeof bar==='undefined'||!bar||macroRow===(bar.bRow??1)||macroRow===(bar.bRow2??-1)||
       typeof macroIds!=='function'||typeof toggleMacro!=='function')return null;
    return macroRow;
  };
  function followRetarget(pending){
    if(retarget!==pending)return;
    if(window.__thor!==state||Date.now()>=pending.until||Date.now()>=state.until||
       !document.querySelector('#hud.show')||document.querySelector('#respawn.show')||
       (macroRow>=0&&macroRow!==pending.row)){
      retarget=null;return;
    }
    const target=liveMonster();
    pending.frames++;
    // A newly drawn target is ready immediately. If Tab kept the same target,
    // give the viewer one more frame to publish its selection before resuming.
    if(macroIndicator()?.hidden&&macroRow===-1&&target!==null&&
       (target!==pending.previous||pending.frames>=2)){
      retarget=null;
      if(macroIds(pending.row).length)toggleMacro(pending.row);
      return;
    }
    requestAnimationFrame(()=>followRetarget(pending));
  }
  function nextMonster(){
    const previous=liveMonster(), row=activeAttackRow();
    if(retarget){
      retarget.previous=previous;
      retarget.frames=0;
    }else if(row!==null&&typeof requestAnimationFrame==='function'){
      const pending=retarget={row,previous,frames:0,until:Date.now()+1600};
      // Clear the native macro before Tab changes the target. Otherwise the
      // viewer can send the new target while the previous attack is still active.
      Module.ccall('viewer_macro',null,['string'],['']);
      requestAnimationFrame(()=>followRetarget(pending));
    }
    Module.ccall('viewer_tab_target',null,[],[]);
    document.getElementById('canvas')?.focus?.();
    return true;
  }
  const canTarget=()=>window.__thor===state&&Date.now()<state.until&&!!document.querySelector('#hud.show')&&
    !panel()&&typeof Module!=='undefined'&&typeof Module.ccall==='function';
  window.addEventListener('click',event=>{
    if(!event.isTrusted||!event.target?.closest?.('#t-target')||!canTarget()||(retarget===null&&activeAttackRow()===null))return;
    event.preventDefault();event.stopImmediatePropagation();nextMonster();
  },true);
  window.addEventListener('keydown',event=>{
    // The game also synthesizes Tab during its own pad processing.
    if(!event.isTrusted||event.code!=='Tab'||event.target!==document.getElementById('canvas')||event.repeat||event.altKey||event.ctrlKey||event.metaKey||event.shiftKey||
       (retarget===null&&activeAttackRow()===null)||!canTarget()||
       (typeof typing==='function'&&typing())||event.target?.closest?.('input,select,textarea,[contenteditable=true]'))return;
    event.preventDefault();event.stopImmediatePropagation();nextMonster();
  },true);
  state.combat=type=>{
    const x=document.getElementById(type==='target'?'t-target':'t-attack');
    if(type==='target'&&canTarget())return nextMonster();
    if(type==='attack'&&pkEnabled()&&!panel())return forcedAttack();
    if(!x)return false;
    if(type==='attack'&&typeof x.onclick==='function'){x.click();return true}
    x.dispatchEvent(new PointerEvent('pointerdown',{bubbles:true,cancelable:true}));return true;
  };
  state.pkSupported=()=>typeof castSkill==='function'&&typeof Module!=='undefined'&&typeof Module.ccall==='function'&&
    typeof skillList!=='undefined'&&Array.isArray(skillList)&&skillList.some(skill=>skill.tree===undefined);
  const pkEnabled=()=>state.pk&&window.__thor===state&&Date.now()<state.until;
  const forcedAttack=()=>{
    if(!state.pkSupported())return false;
    if(!Module.ccall('viewer_target_if_none','number',[],[]))castSkill(skillList.find(skill=>skill.tree===undefined),true);
    return true;
  };
  window.addEventListener('keydown',event=>{
    if(!pkEnabled()||event.ctrlKey||event.metaKey||!document.querySelector('#hud.show')||panel()||
        (typeof typing==='function'&&typing())||event.target?.closest?.('input,select,textarea,[contenteditable=true]'))return;
    if(/^(Digit[0-9]|Minus|Equal)$/.test(event.code))Object.defineProperty(event,'ctrlKey',{value:true,configurable:true});
    else if(event.code==='Space'&&!event.altKey&&!event.shiftKey&&(event.repeat||forcedAttack())){
      event.preventDefault();event.stopImmediatePropagation();
    }
  },true);
  window.addEventListener('click',event=>{
    if(!pkEnabled()||!document.querySelector('#hud.show'))return;
    if(event.target?.closest?.('#t-attack')&&forcedAttack()){
      event.preventDefault();event.stopImmediatePropagation();
    }else if(event.target?.closest?.('#bar-rows .skill[data-id]')){
      Object.defineProperty(event,'ctrlKey',{value:true,configurable:true});
    }
  },true);
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
    if(!panel()&&typeof Module!=='undefined'){
      let cameraSettings={};try{cameraSettings=JSON.parse(localStorage.getItem('archlord.settings')||'{}')?.pad||{}}catch{}
      const [x,y]=camera, dead=(Number(cameraSettings.dead)||40)/200;
      const elapsed=Math.min(50,cameraTime?now-cameraTime:16);
      if(Math.hypot(x,y)>dead){
        const scale=(Number(cameraSettings.cam)||2.5)*elapsed/(1000/60);
        Module.ccall('viewer_cam_rotate',null,['number','number'],[(cameraSettings.invert?-y:y)*scale,x*scale]);
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
    if(hasNativePad()||hasNewNativePad())return;
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
      state.performBinding(key);
    }
  }
  window.addEventListener('keydown',handle,true);
  window.addEventListener('keyup',handle,true);
}
function view(install) {
  const q=s=>document.querySelector(s), txt=s=>q(s)?.textContent.trim().slice(0,400)||'';
  if(!q('#hud.show')){
    if(window.__thor){window.__thor.pk=false;window.__thor.clearCashMarks?.()}
    const characterSelect=!!q('#select.show #pick-view:not([hidden])');
    if(characterSelect)install();
    return {online:false,characterSelect,nativeMenu:characterSelect?'pick':null};
  }
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
  let catalog=[], realRows=[], heroes=null;
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
  if(typeof heroData!=='undefined'&&heroData&&Array.isArray(heroData.chars)&&typeof heroSkill==='function'&&typeof icon==='function'){
    const excluded=new Set((heroData.off||[]).map(String));
    heroes=heroData.chars.flatMap(character=>(character.buffs||[]).map(buff=>{
      const skill=heroSkill(buff),src=icon('skill',buff.tid)?.src||'';
      return {tid:String(buff.tid),name:String(skill.name||''),hero:String(character.name||''),level:Number(buff.lv)||0,enabled:!excluded.has(String(buff.tid)),icon:src.startsWith(location.origin+'/')?src:'',description:Array.isArray(skill.tip)?skill.tip.map(String):[]};
    }));
  }
  let itemDetails=null;
  try{
    const shopSelection=window.__thor.selectedShopItem?.();
    const slot=shopSelection?.slot||window.__thor.selectedItem?.();
    const itemId=Number(slot?.dataset.item);
    const item=shopSelection?.item||(itemId&&((typeof inv!=='undefined'&&inv.items?.find(x=>x.id===itemId))||
      (typeof bankItems!=='undefined'&&bankItems.find(x=>x.id===itemId))));
    if(item&&typeof tipCard==='function'){
      const equipped=!item.equipped&&item.part&&typeof inv!=='undefined'?inv.items.find(x=>x.equipped&&x.part===item.part):null;
      const build=(value,heading,comparison,hint)=>{
        const card=tipCard(value,heading,comparison,hint||'');
        const selector='.head,.name,.req,.row,.up,.down,.hint,.gear-buff,.stone-fx,.combo-head,.combo';
        const lines=[...card.querySelectorAll(selector)].filter(el=>!el.parentElement?.closest(selector)).map(el=>({
          kind:typeof el.className==='string'?el.className:'',
          text:el.classList.contains('row')||el.classList.contains('name')?[...el.children].map(x=>x.textContent.trim()).filter(Boolean).join(el.classList.contains('row')?'  ':' '):el.textContent.trim()
        })).filter(line=>line.text);
        const art=value===item?slot.querySelector('img.icon'):[...document.querySelectorAll('#doll-slots [data-item]')].find(el=>el.dataset.item===String(value.id))?.querySelector('img.icon');
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
      const part=!shopSelection&&window.__thor.socketGearType?.(item);
      const socketOptions=part&&inv.items.includes(item)&&item.sockets>(item.stones||[]).length?inv.items.filter(x=>window.__thor.socketCompatible(item,x)).map(x=>{
        const art=icon('item',x.tid)?.src||'',risk=typeof stoneRisk==='function'?stoneRisk(x,item):null;
        return {id:String(x.id),name:x.name,count:x.count,icon:art.startsWith(location.origin+'/')?art:'',description:(x.opts||[]).join(' · '),risk:risk?{chance:risk.chance||'',note:risk.note||''}:null};
      }):[];
      itemDetails={id:shopSelection?'shop:'+String(item.tid):String(item.id),merchant:!!shopSelection,locked:!!item.locked,lockPending:!shopSelection&&window.__thor.lockPending?.id===String(item.id),socketOptions,socketSupported:!!part&&inv.items.includes(item),cards:[
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
  const chatLog=q('#chat-log');
  const chatState=window.__thorChat ||= {session:String(performance.timeOrigin),seen:new WeakSet(),total:0};
  for(const line of chatLog?.children||[]){
    if(chatState.seen.has(line))continue;
    chatState.seen.add(line);
    const sender=line.querySelector('b[data-whisper]');
    if(sender&&!line.classList.contains('system')&&!line.hasAttribute('data-ai')&&
      !(line.classList.contains('ch-whisper')&&sender.textContent.startsWith('To ')))chatState.total++;
  }
  return {online:true,potions,pk:window.__thor.pkSupported()?window.__thor.pk:null,effects:typeof settings!=='undefined'?String(settings.effects):null,sets,itemDetails,pressed:window.__thor.pressed||[],lastPress:window.__thor.lastPress,
    chatActivity:{session:chatState.session,total:chatState.total},
    nativePad:typeof pad!=='undefined'&&Array.isArray(pad?.map)&&typeof padFrame==='function',
    nativePadMap:typeof pad!=='undefined'&&Array.isArray(pad?.map)?pad.map.map(value=>({value,label:(typeof PAD_ACTIONS!=='undefined'?PAD_ACTIONS.flatMap(group=>group[1]).find(option=>option[0]===value)?.[1]:null)||value||'Nothing'})):[],
    buffRows:typeof bar!=='undefined'&&bar?[bar.bRow??1,bar.bRow2??-1]:[],attackRow:typeof bar!=='undefined'&&bar?bar.mRow??0:null,
    fullscreen:!!document.fullscreenElement,nativeMenu:window.__thor.menu(),menuContext:window.__thor.menuContext(),bindings:window.__thor.bind,lastMacro:window.__thor.lastMacro,nativeUpdate:typeof macroSpan==='function'&&typeof padTapValue==='function',macroChains:window.__thor.chainInfo?.(),
    activeRow:typeof macroRow==='number'?String(macroRow):'',inventory,npc,catalog,realRows,heroes,select:window.__thor.select||0,focused:document.hasFocus(),level:txt('#level'),hp:txt('#hp-text'),mp:txt('#mp-text'),xp:txt('#exp-text'),
    bars:['hp','mp','exp'].map(k=>parseFloat(q('#'+k+'-fill')?.style.width)||0),
    macro:q('#macro-on')?!q('#macro-on').hidden:null,map,
    macroRows:[...document.querySelectorAll('#t-rows [data-row]')].map(b=>{
      const row=Number(b.dataset.row);
      const line=q('#bar-rows')?.children[row];
      const icons=[...(line?.querySelectorAll('.skill[data-id] img.icon')||[])].map(x=>x.src).filter(src=>src.startsWith(location.origin+'/'));
      return {row:b.dataset.row,on:b.classList.contains('run'),icons};
    }),
    filters:[...document.querySelectorAll('#chat-tabs button')].map(b=>({name:b.textContent.trim(),on:b.classList.contains('on')})),
    chat:[...(chatLog?.children||[])].filter(x=>!x.hidden).slice(-25).map(x=>({text:x.textContent.trim().slice(0,300),color:getComputedStyle(x).color})),
    slots:[...document.querySelectorAll('#bar-rows .skill')].slice(0,40).map(x=>{
      const src=x.querySelector('img.icon')?.src||'';
      return {key:x.querySelector('.key')?.textContent.trim(),id:x.dataset.id||'',tid:x.dataset.skillTip||'',name:skillNames.get(x.dataset.id)||'',group:skillGroups.get(x.dataset.id)||'Other',icon:src.startsWith(location.origin+'/')?src:'',
        disabled:x.classList.contains('nomp'),cooldown:x.querySelector('.cd')?.textContent.trim()||''};
    })};
}
function action(a) {
  const q=s=>document.querySelector(s);
  if(a.type==='nav'&&q('#select.show #pick-view:not([hidden])'))return window.__thor?.navigate(a.value)||false;
  if(!q('#hud.show'))return false;
  if(a.type==='pk'){
    const state=window.__thor;
    if(!state||typeof a.value!=='boolean'||(a.value&&!state.pkSupported?.()))return false;
    state.pk=a.value;
    return true;
  }
  if(a.type==='heroBuff'){
    if(typeof heroUse!=='function'||typeof heroUsed!=='function'||!heroUsed().length||typeof heroReady!=='number'||performance.now()<heroReady)return false;
    heroUse();return true;
  }
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
    if(binding?.type==='spell')return window.__thor.performBinding((altKey?'A':'')+key);
    if(typeof padTapValue==='function'&&typeof macroSpan==='function'){
      const index={'2':2,'3':3,'4':5,'5':6,'6':0,'7':1,'8':7}[a.value];
      let nativeBindings;try{nativeBindings=JSON.parse(localStorage.getItem('archlord.settings')||'{}')?.pad?.bind}catch{}
      const value=nativeBindings?.[String(index)];
      if(typeof value!=='string'||!value)return false;
      if(value==='k:Tab')return window.__thor?.combat('target')||false;
      padTapValue(value);return true;
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
  if(a.type==='macroChain'){
    if(typeof bar==='undefined'||!bar||!window.__thor?.chainInfo)return false;
    const {row,expected}=a.value,info=window.__thor.chainInfo()?.find(x=>x.row===row);
    if(!info||info.expected!==expected||!info.canToggle)return false;
    const win=q('#macro-win'),open=q('#macro-btn');if(!win||!open)return false;
    const wasOpen=win.classList.contains('show');
    try{
      if(!wasOpen)open.click();
      const button=q('#mw-rows .mw-chain[data-row="'+row+'"]');
      if(!win.classList.contains('show')||!button||button.disabled||typeof button.onclick!=='function')return false;
      button.click();return (Number(bar.chain)||0)===(expected^(1<<row));
    }finally{if(!wasOpen&&win.classList.contains('show'))open.click()}
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
  if(a.type==='bind'){if(!window.__thor)return false;window.__thor.bind=a.value;return true}
  if(a.type==='spell'){
    const x=[...document.querySelectorAll('#bar-rows .skill[data-id]')].find(x=>x.dataset.id===a.value&&!x.classList.contains('nomp'));
    if(!x)return false;x.click();return true;
  }
  if(a.type==='macroOnce'){const row=Number(a.value);if(typeof bar==='undefined'||!bar||typeof macroOnce!=='function'||typeof macroIds!=='function'||(typeof macroRow==='number'&&macroRow>=0)||row===(bar.bRow??1)||row===(bar.bRow2??-1)||!macroIds(row).length)return false;macroOnce(row);return true}
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
  if(a.type==='heroBuff')return true;
  const digits=v=>typeof v==='string'&&/^\d{1,9}$/.test(v);
  const row=v=>typeof v==='string'&&/^[0-3]$/.test(v);
  if(a.type==='nativePad')return Number.isInteger(a.value)&&a.value>=0&&a.value<=15;
  if(a.type==='combo')return typeof a.value==='string'&&/^(?:[4-6]|A[3-6]|C4_[0-35-7]|L1|L3|R3|START|SELECT|UP|DOWN|LEFT|RIGHT)$/.test(a.value);
  if(a.type==='pk')return typeof a.value==='boolean';
  if(a.type==='itemLock')return !!a.value&&digits(a.value.id)&&typeof a.value.locked==='boolean';
  if(a.type==='socketInsert')return !!a.value&&digits(a.value.item)&&digits(a.value.stone);
  if(a.type==='effects')return ['0','1','2'].includes(String(a.value));
  if(a.type==='nav')return ['start','back','left','right','up','down','accept','downAccept','upAccept','mark'].includes(a.value);
  if(a.type==='combat')return ['target','attack'].includes(a.value);
  if(a.type==='bind'){
    if(!a.value||typeof a.value!=='object')return false;
    const used=new Set();
    return Object.entries(a.value).every(([k,v])=>{
      if(!/^(?:[4-6]|A[3-6]|C4_[0-3]|C4_[5-7]|L1|L3|R3|START|SELECT|UP|DOWN|LEFT|RIGHT)$/.test(k)||!v)return false;
      if(v.type==='spell')return digits(v.value)||(typeof v.value==='string'&&/^t:\d{1,9}$/.test(v.value));
      if(v.type==='action')return ['target','attack','interact','menu','companion','buff','map','bag','skills','macro','character','quests','itemLock'].includes(v.value);
      if(v.type!=='macro'||!row(v.value)||used.has(v.value))return false;
      used.add(v.value);return true;
    });
  }
  if(a.type==='macroSlot')return a.value&&Number.isInteger(a.value.row)&&a.value.row>=0&&a.value.row<4&&Number.isInteger(a.value.slot)&&a.value.slot>=0&&a.value.slot<10&&Number.isInteger(a.value.tid)&&a.value.tid>=0&&Number.isInteger(a.value.expected)&&a.value.expected>=0;
  if(a.type==='macroChain')return !!a.value&&Number.isInteger(a.value.row)&&a.value.row>=0&&a.value.row<3&&Number.isInteger(a.value.expected)&&a.value.expected>=0&&a.value.expected<=7;
  if(a.type==='macroSwap')return a.value&&Number.isInteger(a.value.row)&&a.value.row>=0&&a.value.row<4&&['from','to'].every(k=>Number.isInteger(a.value[k])&&a.value[k]>=0&&a.value[k]<10)&&['expectedFrom','expectedTo'].every(k=>Number.isSafeInteger(a.value[k]));
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
  if(a.type==='macroOnce')return row(a.value);
  if(a.type==='macro')return row(a.value);
  if(a.type==='buff')return true;
  if(a.type==='chat')return typeof a.value==='string'&&a.value.trim()&&a.value.length<=120&&!/[\r\n]/.test(a.value);
  if(a.type==='filter')return typeof a.value==='string'&&a.value.length<=50;
  if(a.type==='menu')return ['map','bag','pet','macro','skills','character','quests'].includes(a.value);
  return false;
}
let snapshot, currentPage;
