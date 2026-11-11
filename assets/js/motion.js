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
   if(next&&!shown)play(tab.querySelector('.wrap')||tab,[{opacity:.92,transform:'translateY(2px)'},{opacity:1,transform:'translateY(0)'}],140,'tab');
   shown=next;
  }).observe(tab,{attributes:true,attributeFilter:['style']});
 }
 reduce.addEventListener('change',()=>{if(reduce.matches){for(const animation of running)animation.cancel();running.clear();}});
})();
