/* Presentation hooks: no balance calculations, storage writes, or delayed saves. */
(function(){
 'use strict';
 const reduce=matchMedia('(prefers-reduced-motion: reduce)'),running=new Set(),slots=new WeakMap();
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
 document.addEventListener('hisab:before-publish',()=>{
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
 for(const tab of document.querySelectorAll('#hisab-content,#cash-content')){
  let shown=tab.style.display!=='none';
  new MutationObserver(()=>{
   const next=tab.style.display!=='none';
   if(next&&!shown)play(tab.querySelector('.wrap')||tab,[{opacity:.5,transform:'translateY(8px)'},{opacity:1,transform:'translateY(0)'}],260,'tab');
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
   const height=wrap.getBoundingClientRect().height;
   expand(wrap,[{height:previousHeight+'px',opacity:.7},{height:height+'px',opacity:1}],300,()=>{});
  }
 });
 reduce.addEventListener('change',()=>{if(reduce.matches){for(const animation of running)animation.cancel();running.clear();}});
})();
