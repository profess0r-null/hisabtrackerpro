/* Presentation hooks: no balance calculations, storage writes, or delayed saves. */
(function(){
 'use strict';
 const reduce=matchMedia('(prefers-reduced-motion: reduce)'),running=new Set(),slots=new WeakMap();
 let before=null;
 const nav=document.getElementById('bottom-nav');
 if(nav){
  const marker=document.createElement('span');marker.className='ht-nav-marker';marker.setAttribute('aria-hidden','true');nav.append(marker);
  function positionMarker(){
   const icon=nav.querySelector('.bnav-btn.on .bnav-icon');if(!icon)return;
   const r=icon.getBoundingClientRect(),n=nav.getBoundingClientRect();
   marker.style.width=r.width+'px';marker.style.height=r.height+'px';
   marker.style.transform='translate('+(r.left-n.left)+'px,'+(r.top-n.top)+'px)';
  }
  for(const button of nav.querySelectorAll('.bnav-btn'))new MutationObserver(positionMarker).observe(button,{attributes:true,attributeFilter:['class']});
  new ResizeObserver(positionMarker).observe(nav);requestAnimationFrame(positionMarker);
  document.addEventListener('hisab:unlocked',()=>requestAnimationFrame(positionMarker));
 }
 document.addEventListener('click',event=>{
  const wallet=event.target.closest('.wallet-card,.wsel-btn,.pws-btn');
  if(wallet&&!wallet.disabled)requestAnimationFrame(()=>{if(wallet.isConnected)play(wallet,[{scale:'.96'},{scale:'1.025',offset:.55},{scale:'1'}],280,'wallet');});
 });
 const saved=document.createElement('div');saved.className='ht-save-success';saved.setAttribute('role','status');saved.setAttribute('aria-live','polite');document.body.append(saved);
 let savedTimer;
 document.addEventListener('hisab:published',()=>{
  saved.innerHTML='<svg aria-hidden="true" viewBox="0 0 24 24"><path d="m5 12 4 4L19 6"/></svg><span></span>';
  saved.querySelector('span').textContent=document.documentElement.dataset.lang==='bn'?'সেভ হয়েছে':'Saved';
  saved.classList.add('on');clearTimeout(savedTimer);savedTimer=setTimeout(()=>saved.classList.remove('on'),1600);
 });
 for(const name of ['hisab:locked','hisab:signed-out'])document.addEventListener(name,()=>{saved.classList.remove('on');clearTimeout(savedTimer);});

 function visible(el){return el.getClientRects().length>0&&getComputedStyle(el).visibility!=='hidden';}
 function play(el,frames,duration=200,channel='feedback',delay=0){
  if(reduce.matches||!visible(el)||typeof el.animate!=='function')return;
  let channels=slots.get(el);if(!channels){channels=new Map();slots.set(el,channels);}
  channels.get(channel)?.cancel();
  const animation=el.animate(frames,{duration,delay,fill:'backwards',easing:'cubic-bezier(.2,.7,.2,1)'});
  channels.set(channel,animation);running.add(animation);
  const cleanup=()=>{running.delete(animation);if(channels.get(channel)===animation)channels.delete(channel);};
  animation.addEventListener('finish',cleanup,{once:true});animation.addEventListener('cancel',cleanup,{once:true});
 }
 // Count only a visual overlay. The real amount text remains unchanged and accessible.
 const counters=new Map();let counterFrame=0;
 function finishCounter(el){
  const item=counters.get(el);if(!item)return;
  counters.delete(el);el.classList.remove('ht-count-up');el.removeAttribute('data-count-display');
  if(item.color)el.style.setProperty('--count-color',item.color);else el.style.removeProperty('--count-color');
 }
 function stopCounters(){
  cancelAnimationFrame(counterFrame);counterFrame=0;for(const el of [...counters.keys()])finishCounter(el);
 }
 function tickCounters(now){
  counterFrame=0;
  for(const [el,item] of counters){
   if(!el.isConnected||el.textContent!==item.original||!visible(el)){finishCounter(el);continue;}
   const progress=Math.min(1,Math.max(0,(now-item.start)/500));
   if(progress===1){finishCounter(el);continue;}
   const eased=1-Math.pow(1-progress,3);
   el.setAttribute('data-count-display',item.format(item.value*eased));
  }
  if(counters.size)counterFrame=requestAnimationFrame(tickCounters);
 }
 function countAmount(el,delay){
  if(reduce.matches||el.children.length)return;
  const original=el.textContent;
  const latin=original.replace(/[০-৯]/g,d=>String('০১২৩৪৫৬৭৮৯'.indexOf(d)));
  const match=latin.match(/^([^0-9]*)([0-9,]+(?:\.[0-9]+)?)([^0-9]*)$/);
  if(!match)return;
  const value=Number(match[2].replaceAll(',',''));if(!Number.isFinite(value)||value===0)return;
  const decimals=(match[2].split('.')[1]||'').length,bengali=/[০-৯]/.test(original);
  const formatter=new Intl.NumberFormat('en-IN',{minimumFractionDigits:decimals,maximumFractionDigits:Math.min(decimals,20)});
  const format=n=>{let digits=formatter.format(n);if(bengali)digits=digits.replace(/[0-9]/g,d=>'০১২৩৪৫৬৭৮৯'[Number(d)]);return match[1]+digits+match[3];};
  finishCounter(el);
  const item={original,value,format,start:performance.now()+delay,color:el.style.getPropertyValue('--count-color')};
  const color=getComputedStyle(el).color;counters.set(el,item);
  el.style.setProperty('--count-color',color);el.setAttribute('data-count-display',format(0));el.classList.add('ht-count-up');
  if(!counterFrame)counterFrame=requestAnimationFrame(tickCounters);
 }
 document.addEventListener('hisab:before-publish',()=>{
  stopCounters();
  if(reduce.matches)return;
  before=new Set([...document.querySelectorAll('[data-motion-key]')].map(el=>el.dataset.motionKey));
 });
 document.addEventListener('hisab:published',()=>{
  const previous=before;before=null;if(!previous||reduce.matches)return;
  // Only confirmed new entries receive a highlight; filtering/search never triggers it.
  let highlighted=0;
  for(const el of document.querySelectorAll('[data-motion-key]')){
   if(!previous.has(el.dataset.motionKey)&&visible(el)&&highlighted<2){
    play(el,[{backgroundColor:'rgba(59,130,246,.055)'},{backgroundColor:'rgba(59,130,246,0)'}],320);highlighted++;
   }
  }
 });
 // Reveal confirmed balances once after account load, and on the other tab's first visit.
 let entranceReady=false,enteredTabs=new WeakSet();
 function inView(el){const r=el.getBoundingClientRect();return visible(el)&&r.bottom>0&&r.top<innerHeight;}
 function revealLoadedTab(tab){
  if(!entranceReady||reduce.matches||enteredTabs.has(tab)||!visible(tab))return;
  enteredTabs.add(tab);
  const cards='.balance-overview .sc,.balance-overview .sc-net,.hisab-mini-wallets,.top-card,.pcard,.expense-balance-panel,.expense-period-panel,.expense-ledger';
  [...tab.querySelectorAll(cards)].filter(inView).slice(0,12).forEach((el,i)=>{
   play(el,[{opacity:.2,transform:'translateY(12px)'},{opacity:1,transform:'translateY(0)'}],460,'entrance',Math.min(i*55,220));
  });
  const amounts='#sv-r,#sv-g,#sv-n,#cash-balance';
  [...tab.querySelectorAll(amounts)].filter(inView).slice(0,16).forEach((el,i)=>{
   const delay=30+Math.min(i*25,50);
   play(el,[{opacity:.15,transform:'translateY(6px)'},{opacity:1,transform:'translateY(0)'}],340,'amount-entrance',delay);
   countAmount(el,delay);
  });
 }
 document.addEventListener('hisab:unlocked',()=>{
  entranceReady=true;enteredTabs=new WeakSet();
  requestAnimationFrame(()=>{for(const tab of document.querySelectorAll('#hisab-content,#cash-content'))revealLoadedTab(tab);});
 });
 for(const event of ['hisab:locked','hisab:signed-out'])document.addEventListener(event,()=>{
  stopCounters();entranceReady=false;enteredTabs=new WeakSet();for(const animation of [...running])animation.cancel();
 });
 for(const tab of document.querySelectorAll('#hisab-content,#cash-content')){
  let shown=tab.style.display!=='none';
  new MutationObserver(()=>{
   const next=tab.style.display!=='none';
   if(next&&!shown)play(tab.querySelector('.wrap')||tab,[{opacity:.5,transform:'translateY(8px)'},{opacity:1,transform:'translateY(0)'}],260,'tab');
   if(next&&!shown)requestAnimationFrame(()=>revealLoadedTab(tab));
   shown=next;
  }).observe(tab,{attributes:true,attributeFilter:['style']});
 }
 // Height transitions make card opening and history expansion visibly continuous.
 const expansions=new WeakMap();
 function expand(el,frames,duration,settle){
  const previous=expansions.get(el),token={};
  expansions.set(el,token);previous?.cancel();
  const overflow=el.style.overflow;el.style.overflow='hidden';
  const animation=el.animate(frames,{duration,easing:'cubic-bezier(.22,.75,.25,1)',fill:'both'});
  token.cancel=()=>{animation.cancel();el.style.overflow=overflow;};running.add(animation);
  let completed=false;
  function finish(){
   if(completed)return;completed=true;running.delete(animation);
   if(expansions.get(el)!==token)return;
   expansions.delete(el);settle();el.style.overflow=overflow;animation.cancel();
  }
  animation.addEventListener('finish',finish,{once:true});
  animation.addEventListener('cancel',finish,{once:true});
 }
 window.HisabMotion=Object.freeze({
  toggleCard(header,opening){
   const body=header.nextElementSibling;
   const start=body.getBoundingClientRect().height,style=getComputedStyle(body);
   const from={height:start+'px',opacity:start?style.opacity:0,paddingTop:start?style.paddingTop:'0px',paddingBottom:start?style.paddingBottom:'0px',borderTopWidth:start?style.borderTopWidth:'0px'};
   let arrow=header.querySelector('.ht-card-arrow');
   if(!arrow){arrow=document.createElement('span');arrow.className='ht-card-arrow';arrow.setAttribute('aria-hidden','true');arrow.innerHTML='<svg viewBox="0 0 24 24"><path d="m6 9 6 6 6-6"/></svg>';header.querySelector('.pt-r')?.append(arrow);}
   header.setAttribute('aria-expanded',String(opening));body.inert=!opening;
   if(reduce.matches||typeof body.animate!=='function'){
    expansions.get(body)?.cancel();body.classList.toggle('on',opening);return;
   }
   // Measure natural size without the previous animation affecting it.
   const old=expansions.get(body);expansions.delete(body);old?.cancel();
   body.classList.add('on');
   const natural=getComputedStyle(body),height=body.getBoundingClientRect().height;
   const to=opening?{height:height+'px',opacity:1,paddingTop:natural.paddingTop,paddingBottom:natural.paddingBottom,borderTopWidth:natural.borderTopWidth}:{height:'0px',opacity:0,paddingTop:'0px',paddingBottom:'0px',borderTopWidth:'0px'};
   expand(body,[from,to],opening?340:280,()=>body.classList.toggle('on',opening));
  },
  resizeHistory(wrap,previousHeight){
   if(reduce.matches||typeof wrap.animate!=='function')return;
   const old=expansions.get(wrap);expansions.delete(wrap);old?.cancel();
   const arrow=wrap.querySelector('.btn-hist-toggle svg');
   if(arrow)play(arrow,[{transform:'rotate(180deg)'},{transform:'rotate(0deg)'}],280,'history-arrow');
   const height=wrap.getBoundingClientRect().height;
   expand(wrap,[{height:previousHeight+'px',opacity:.7},{height:height+'px',opacity:1}],300,()=>{});
  }
 });
 document.addEventListener('visibilitychange',()=>{if(document.visibilityState==='hidden')stopCounters();});
 reduce.addEventListener('change',()=>{if(reduce.matches){stopCounters();for(const animation of running)animation.cancel();running.clear();}});
})();
