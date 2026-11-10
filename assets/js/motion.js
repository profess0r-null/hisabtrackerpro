/* Presentation hooks: no balance calculations, storage writes, or delayed saves. */
(function(){
 'use strict';
 const reduce=matchMedia('(prefers-reduced-motion: reduce)'),running=new Set(),slots=new WeakMap();
 const amounts='.sc-val,.net-val,.pamt,#cash-balance,.wcard-amt,.hmw-pill-amt,.cash-stat-val';
 let before=null;
 function visible(el){return el.getClientRects().length>0&&getComputedStyle(el).visibility!=='hidden';}
 function play(el,frames,duration=200,channel='feedback'){
  if(reduce.matches||!visible(el)||typeof el.animate!=='function')return;
  let channels=slots.get(el);if(!channels){channels=new Map();slots.set(el,channels);}
  channels.get(channel)?.cancel();
  const animation=el.animate(frames,{duration,easing:'cubic-bezier(.2,.7,.2,1)'});
  channels.set(channel,animation);running.add(animation);
  const cleanup=()=>{running.delete(animation);if(channels.get(channel)===animation)channels.delete(channel);};
  animation.addEventListener('finish',cleanup,{once:true});animation.addEventListener('cancel',cleanup,{once:true});
 }
 function money(){
  const result=new Map();
  document.querySelectorAll(amounts).forEach(el=>{
   const scope=el.closest('.pcard[data-id],[data-wallet],.hmw-pill')||el.parentElement;
   const key=el.id||[scope.id||scope.dataset.wallet||scope.getAttribute('onclick')||'',el.className].join(':');
   result.set(key,{el,text:el.textContent.trim()});
  });return result;
 }
 document.addEventListener('hisab:before-publish',()=>{
  before={amounts:money(),rows:new Set([...document.querySelectorAll('[data-motion-key]')].map(el=>el.dataset.motionKey))};
 });
 document.addEventListener('hisab:published',()=>{
  const previous=before;before=null;if(!previous||reduce.matches)return;
  for(const [key,{el,text}]of money()){
   const old=previous.amounts.get(key);
   if(old&&old.text!==text)play(el,[{opacity:.6},{opacity:1}],230);
  }
  // Only confirmed new entries receive a highlight; filtering/search never triggers it.
  let highlighted=0;
  for(const el of document.querySelectorAll('[data-motion-key]')){
   if(!previous.rows.has(el.dataset.motionKey)&&visible(el)&&highlighted<6){
    play(el,[{backgroundColor:'rgba(59,130,246,.09)'},{backgroundColor:'rgba(59,130,246,0)'}],550);highlighted++;
   }
  }
 });
 for(const tab of document.querySelectorAll('#hisab-content,#cash-content')){
  let shown=tab.style.display!=='none';
  new MutationObserver(()=>{
   const next=tab.style.display!=='none';
   if(next&&!shown)play(tab.querySelector('.wrap')||tab,[{opacity:0,transform:'translateY(5px)'},{opacity:1,transform:'translateY(0)'}],190,'tab');
   shown=next;
  }).observe(tab,{attributes:true,attributeFilter:['style']});
 }
 reduce.addEventListener('change',()=>{if(reduce.matches){for(const animation of running)animation.cancel();running.clear();}});
})();
