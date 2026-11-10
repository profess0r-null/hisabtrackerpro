/* Fit exact monetary values to narrow cards without rounding or changing account data. */
(function(){
 let pending=false;
 function fit(){pending=false;document.querySelectorAll('.balance-overview .sc-val,.balance-overview .net-val,.pcard .ps-v,.pcard .pamt,#cash-content .cash-stat-val,#cash-balance,#cash-content .wcard-amt').forEach(el=>{
  if(!el.getClientRects().length)return;
  el.style.removeProperty('font-size');
  let size=parseFloat(getComputedStyle(el).fontSize);
  while(el.scrollWidth>el.clientWidth+1&&size>12){size-=.5;el.style.fontSize=size+'px';}
 });}
 function schedule(){if(!pending){pending=true;requestAnimationFrame(fit);}}
 window.addEventListener('resize',schedule,{passive:true});
 const observer=new MutationObserver(schedule);observer.observe(document.getElementById('app'),{childList:true,subtree:true,characterData:true});
 if(document.fonts)document.fonts.ready.then(schedule);
 schedule();
})();