/* Minimal usage: signed-in account + first/last active time. No financial records or device fingerprint. */
(function(){
 'use strict';
 let lastInteraction=Date.now(),lastTouch=0,touching=false,timer=null,reportPage=0,reportGeneration=0;
 const text=(bn,en)=>LANG==='bn'?bn:en;
 function reset(){
  reportGeneration++;reportPage=0;lastTouch=0;clearInterval(timer);timer=null;
  document.getElementById('owner-usage-menu').hidden=true;
  const box=document.getElementById('usage-content');if(box)box.replaceChildren();
  document.getElementById('m-usage')?.classList.remove('on');
 }
 async function heartbeat(){
  if(touching||!security.isUnlocked||document.visibilityState!=='visible'||Date.now()-lastInteraction>5*60000||Date.now()-lastTouch<60000)return;
  touching=true;
  try{await security.touch();lastTouch=Date.now();}catch(error){if(!security.isUnlocked)lockApp();}finally{touching=false;}
 }
 function start(){
  reset();lastInteraction=Date.now();document.getElementById('owner-usage-menu').hidden=!security.isOwner;
  heartbeat();timer=setInterval(()=>{if(!security.isUnlocked){lockApp();return;}heartbeat();},60000);
 }
 function date(value){const d=new Date(value);return Number.isFinite(d.getTime())?d.toLocaleString(LANG==='bn'?'bn-BD':'en-GB',{dateStyle:'medium',timeStyle:'short'}):'—';}
 function add(parent,tag,content,cls){const el=document.createElement(tag);if(cls)el.className=cls;el.textContent=content;parent.appendChild(el);return el;}
 async function open(page=0){
  if(!security.isOwner)return;
  closeDrawer();const generation=++reportGeneration;reportPage=page;
  const modal=document.getElementById('m-usage'),content=document.getElementById('usage-content');
  modal.classList.add('on');content.replaceChildren();add(content,'p',text('তথ্য আসছে…','Loading usage…'),'usage-message');
  try{
   const report=await security.report(page);
   if(generation!==reportGeneration||!security.isOwner)return;
   content.replaceChildren();const stats=add(content,'div','','usage-stats');
   for(const [label,value]of [[text('মোট ব্যবহারকারী','Total users'),report.total],[text('গত ২৪ ঘণ্টায়','Last 24 hours'),report.active_24h],[text('গত ৫ মিনিটে','Last 5 minutes'),report.active_5m]]){
    const card=add(stats,'div','','usage-stat');add(card,'span',label);add(card,'strong',String(Number(value)||0));
   }
   add(content,'p',text('নতুন ব্যবস্থা চালুর পর লগইন করে অ্যাপ ব্যবহার করেছেন—এমন অ্যাকাউন্টের হিসাব। সময় আপনার ডিভাইসের স্থানীয় সময় অনুযায়ী।','Accounts that used the app after this feature was enabled. Times use your device’s local timezone.'),'usage-message');
   const list=add(content,'div','','usage-list');
   for(const user of report.users||[]){
    const row=add(list,'article','','usage-row');add(row,'strong',user.email||text('ইমেইল নেই','No email'),'usage-email');
    add(row,'span',text('সর্বশেষ: ','Last used: ')+date(user.last_seen),'usage-last');
    add(row,'small',text('প্রথম ব্যবহার: ','First used: ')+date(user.first_seen));
   }
   if(!report.users?.length)add(list,'p',text('এখনও ব্যবহারের তথ্য নেই।','No usage recorded yet.'),'usage-message');
   const footer=add(content,'div','','usage-footer');
   const previous=add(footer,'button',text('আগের','Previous'));previous.type='button';previous.disabled=page===0;previous.addEventListener('click',()=>open(page-1));
   add(footer,'span',text('পাতা ','Page ')+(page+1));
   const next=add(footer,'button',text('পরের','Next'));next.type='button';next.disabled=!report.has_more;next.addEventListener('click',()=>open(page+1));
  }catch(error){
   if(generation!==reportGeneration)return;
   content.replaceChildren();add(content,'p',text('রিপোর্ট আনা যায়নি। অনুমতি ও সংযোগ দেখে আবার চেষ্টা করুন।','Could not load usage. Check your permission and connection, then retry.'),'usage-message');
   const retry=add(content,'button',text('আবার চেষ্টা','Try again'),'usage-retry');retry.type='button';retry.addEventListener('click',()=>open(reportPage));
  }
 }
 for(const name of ['pointerdown','keydown','touchstart'])document.addEventListener(name,()=>{lastInteraction=Date.now();},{passive:true});
 document.addEventListener('visibilitychange',()=>{if(document.visibilityState==='visible'){lastInteraction=Date.now();heartbeat();}});
 document.addEventListener('hisab:unlocked',start);
 document.addEventListener('hisab:locked',reset);
 document.addEventListener('hisab:signed-out',reset);
 window.openUsageReport=open;
 if(security.isUnlocked&&document.getElementById('app').style.display==='block')start();
})();
