(function(){
  const h=window.location.hash;
  const p=new URLSearchParams(window.location.search);
  const t=p.get('type')||new URLSearchParams(h.replace('#','?')).get('type');
  if(t==='signup'||t==='email_change'||h.includes('access_token')){
    sessionStorage.setItem('ht_verify_flow','1');
    window.history.replaceState(null,'',window.location.pathname);
  }
})();

const SB_URL='https://hmqckyecenigcjikfjob.supabase.co';
const SB_KEY='eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImhtcWNreWVjZW5pZ2NqaWtmam9iIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzY5MzUzMDMsImV4cCI6MjA5MjUxMTMwM30.1pyoIp6-GegOVERyroNm0MlkPe4VOAiBL-bU-iJP2gU';
const sb=supabase.createClient(SB_URL,SB_KEY);

// Track anonymous visit
(async()=>{try{await sb.from('visits').insert({user_agent:navigator.userAgent,logged_in:false});}catch(e){}})();

let DB={receive:[],give:[],activityLog:[]};
let CASH_DB={balance:0,history:[]};

// ── DEFAULT CATEGORIES ──
const DEFAULT_CATS={
  cashAdd:   [{e:'💰',l:'বেতন / Salary'},{e:'👨‍👩‍👧',l:'Family'},{e:'🛍️',l:'বিক্রয় / Sale'},{e:'✅',l:'পাওনা উসুল / Received'}],
  cashSub:   [{e:'🍔',l:'খাওয়া / Food'},{e:'🚌',l:'যাতায়াত / Transport'},{e:'🛒',l:'কেনাকাটা / Shopping'},{e:'💡',l:'বিল / Bill'},{e:'📱',l:'Recharge'}],
  hisabReceive:[{e:'',l:'Hawlat'},{e:'',l:'Recharge'},{e:'',l:'Send Money'},{e:'🏦',l:'Loan'}],
  hisabGive:   [{e:'',l:'Borrowed'},{e:'',l:'Recharge'}],
  hisabAddMore:[{e:'➕',l:'Extra Amount'},{e:'📈',l:'Interest Added'},{e:'🔄',l:'Adjusted'}],
  hisabPay:    [{e:'💸',l:'Cash'},{e:'📱',l:'bKash'},{e:'🏦',l:'Bank'},{e:'✅',l:'Full Payment'}]
};
function getCats(key){
  if(DB.categories&&DB.categories[key]&&DB.categories[key].length)return DB.categories[key];
  return DEFAULT_CATS[key]||[];
}
function saveCats(){saveData();}

// ── RENDER QTAGS ──
function renderQtags(containerId, catKey, targetInputId){
  const el=document.getElementById(containerId);
  if(!el)return;
  const cats=getCats(catKey);
  const esc=s=>String(s).replace(/&/g,'&amp;').replace(/"/g,'&quot;').replace(/'/g,'&#39;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
  el.innerHTML=cats.map(c=>{
    const label=c.l.split('/')[0].trim();
    const val=c.e?(c.e+' '+label):label;
    return `<span class="qtag" data-val="${esc(val)}" data-target="${esc(targetInputId)}">${c.e?c.e+' ':''}<span>${c.l}</span></span>`;
  }).join('');
  el.querySelectorAll('.qtag').forEach(t=>{
    t.addEventListener('click',()=>setQ(t.dataset.val,t.dataset.target));
  });
}
function renderAllQtags(){
  // Hisab forms (static containers in HTML)
  renderQtags('r-qtags','hisabReceive','r-no');
  renderQtags('g-qtags','hisabGive','g-no');
  // Cash & modal qtags rendered on open
}
let LANG=localStorage.getItem('ht_lang')||'bn';
let THEME=localStorage.getItem('ht_theme')||'dark';
let TAB='r',CTX={},SA={r:false,g:false},CUR_USER=null;
let CASH_FILTER='all';
let cashFormMode='add';
let pTr=0,pTg=0,pNet=0,pinBuf='',pinMode='unlock',pinTmp='';
let syncTimer=null;
let APP_MODE=localStorage.getItem('ht_mode')||'hisab'; // 'hisab' or 'cash'

// ── SLIDER SWITCH (hisab) ──
function sliderSwitch(type){
  TAB=type;
  const track=document.getElementById('slider-track');
  const btnR=document.getElementById('slider-r');
  const btnG=document.getElementById('slider-g');
  const btnA=document.getElementById('slider-a');
  // track position
  track.className='type-slider-track'+(type==='g'?' mid':type==='a'?' right':'');
  btnR.className='type-slider-opt '+(type==='r'?'active-r':'inactive');
  btnG.className='type-slider-opt '+(type==='g'?'active-g':'inactive');
  btnA.className='type-slider-opt '+(type==='a'?'active-a':'inactive');
  const secR=document.getElementById('sec-r');
  const secG=document.getElementById('sec-g');
  const secA=document.getElementById('sec-a');
  secR.style.display=''; secG.style.display=''; secA.style.display='';
  secR.classList.toggle('hidden',type!=='r');
  secG.classList.toggle('hidden',type!=='g');
  secA.classList.toggle('hidden',type!=='a');
  if(type==='a')renderAll();
}

function renderAll(){
  const q=document.getElementById('srch').value.toLowerCase().trim();
  const fl=list=>q?list.filter(p=>p.name.toLowerCase().includes(q)):list;
  const all=fl([...DB.receive.map(p=>({...p,_type:'receive'})),...DB.give.map(p=>({...p,_type:'give'}))]).sort((a,b)=>b.id-a.id);
  document.getElementById('lst-a').innerHTML=all.length
    ?all.map(p=>renderCard(p,p._type)).filter(Boolean).join('')
    :emptyS('কোনো রেকর্ড নেই','No records','<svg xmlns="http://www.w3.org/2000/svg" width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/></svg>');
  all.filter(p=>p.remaining>0).forEach(p=>{const el=document.getElementById('card-'+p.id);if(el)initSwipe(el,p._type,p.id);});
}

// ── SWIPE GESTURE on pcard ──
function initSwipe(el,type,id){
  let sx=0,sy=0,dx=0,dragging=false,moved=false,locked=false;
  const inner=el.querySelector('.pcard-inner');
  const leftHint=el.querySelector('.swipe-action.left');
  const rightHint=el.querySelector('.swipe-action.right');
  const THRESHOLD=65;

  function setPos(x,animated){
    inner.style.transition=animated?'transform .28s cubic-bezier(.25,.46,.45,.94)':'none';
    inner.style.transform=x===0?'':'translateX('+x+'px)';
  }
  function setHint(x){
    if(x>0){
      leftHint.style.opacity=Math.min(1,x/THRESHOLD).toFixed(2);
      rightHint.style.opacity=0;
    } else if(x<0){
      rightHint.style.opacity=Math.min(1,Math.abs(x)/THRESHOLD).toFixed(2);
      leftHint.style.opacity=0;
    } else {
      leftHint.style.opacity=0;
      rightHint.style.opacity=0;
    }
  }
  function snap(dir){
    // bounce out then snap back
    const out=dir*90;
    setPos(out,true);
    leftHint.style.opacity=0;
    rightHint.style.opacity=0;
    setTimeout(()=>{
      inner.style.transition='transform .22s cubic-bezier(.4,0,.2,1)';
      inner.style.transform='';
      setTimeout(()=>{inner.style.transition='';},250);
    },160);
    setTimeout(()=>{ dir>0?openAddMore(type,id):openPay(type,id); },90);
  }
  function reset(animated){
    setPos(0,animated);
    setHint(0);
  }

  el.addEventListener('touchstart',e=>{
    if(locked)return;
    const t=e.touches[0];
    sx=t.clientX; sy=t.clientY; dx=0; dragging=true; moved=false;
    inner.style.transition='none';
  },{passive:true});

  el.addEventListener('touchmove',e=>{
    if(!dragging||locked)return;
    const t=e.touches[0];
    dx=t.clientX-sx;
    const dy=t.clientY-sy;
    if(!moved){
      if(Math.abs(dy)>Math.abs(dx)+4){dragging=false;reset(false);return;}
      if(Math.abs(dx)>5) moved=true; else return;
    }
    e.preventDefault();
    // resistance at edges
    const raw=dx;
    const clamped=raw>0
      ?Math.min(110, raw*(raw<THRESHOLD?1:0.4))
      :Math.max(-110, raw*(raw>-THRESHOLD?1:0.4));
    inner.style.transform='translateX('+clamped+'px)';
    setHint(clamped);
  },{passive:false});

  el.addEventListener('touchend',()=>{
    if(!dragging)return;
    dragging=false;
    if(!moved){reset(false);return;}
    if(dx>THRESHOLD){
      locked=true;
      snap(1);
      setTimeout(()=>{locked=false;},500);
    } else if(dx<-THRESHOLD){
      locked=true;
      snap(-1);
      setTimeout(()=>{locked=false;},500);
    } else {
      // snap back with spring
      inner.style.transition='transform .3s cubic-bezier(.34,1.56,.64,1)';
      inner.style.transform='';
      setHint(0);
      setTimeout(()=>{inner.style.transition='';},350);
    }
  });
}

// ── BUDGET ──
function setBudget(){
  const cur=CASH_DB.budget||'';
  const val=prompt(LANG==='bn'?'মাসিক বাজেট দিন (৳):':'Set monthly budget (৳):',cur);
  if(val===null)return;
  const num=parseFloat(val);
  if(isNaN(num)||num<=0){toast('❌ '+(LANG==='bn'?'সঠিক পরিমাণ দিন':'Enter valid amount'));return;}
  CASH_DB.budget=num;
  saveCashData();
  renderCash();
  toast('✅ '+(LANG==='bn'?'বাজেট সেট হয়েছে':'Budget set!'));
}

// ── CASH FILTER ──
function filterCash(type,el){
  CASH_FILTER=type;
  document.querySelectorAll('.cat-pill').forEach(p=>p.classList.remove('on'));
  el.classList.add('on');
  renderCash();
}

// ── SETTLEMENT SUGGESTION ──
function renderSettlement(){
  const box=document.getElementById('settle-box');
  if(!box)return;
  const totalR=DB.receive.reduce((s,p)=>s+p.remaining,0);
  const totalG=DB.give.reduce((s,p)=>s+p.remaining,0);
  if(totalR===0&&totalG===0){box.style.display='none';return;}
  // find best settlement
  const topR=[...DB.receive].filter(p=>p.remaining>0).sort((a,b)=>b.remaining-a.remaining)[0];
  const topG=[...DB.give].filter(p=>p.remaining>0).sort((a,b)=>b.remaining-a.remaining)[0];
  if(!topR&&!topG){box.style.display='none';return;}
  let html='';
  if(topG){
    html+=`<div class="settle-suggest">
      <span class="settle-icon">💡</span>
      <span class="settle-text"><span class="bn">${topG.name} কে দিলে বড় দেনা শেষ হবে</span><span class="en">Pay ${topG.name} to clear biggest debt</span></span>
      <span class="settle-amt">৳${fmt(topG.remaining)}</span>
    </div>`;
  }
  box.innerHTML=html;
  box.style.display='block';
}


// init
document.documentElement.setAttribute('data-lang',LANG);
applyThemeSilent(THEME);

// PWA
if('serviceWorker' in navigator) navigator.serviceWorker.register('sw.js').catch(()=>{});

// ── EYE TOGGLE ──
function toggleEye(inputId,btn){
  const inp=document.getElementById(inputId);
  const show=inp.type==='password';
  inp.type=show?'text':'password';
  const eyeSVG=show
    ?`<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9.88 9.88a3 3 0 1 0 4.24 4.24"/><path d="M10.73 5.08A10.43 10.43 0 0 1 12 5c7 0 10 7 10 7a13.16 13.16 0 0 1-1.67 2.68"/><path d="M6.61 6.61A13.526 13.526 0 0 0 2 12s3 7 10 7a9.74 9.74 0 0 0 5.39-1.61"/><line x1="2" x2="22" y1="2" y2="22"/></svg>`
    :`<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z"/><circle cx="12" cy="12" r="3"/></svg>`;
  btn.innerHTML=`<span class="ic">${eyeSVG}</span>`;
}

// ── THEME ──
function applyThemeSilent(t){
  THEME=t;
  document.documentElement.setAttribute('data-theme',t);
  localStorage.setItem('ht_theme',t);
  const mc=document.getElementById('theme-color-meta');
  if(mc)mc.content=t==='dark'?'#141929':'#f0f4f8';
}
function applyTheme(t){applyThemeSilent(t);syncThemeBtns();}
function setTheme(t){applyTheme(t);}
function syncThemeBtns(){
  const dk=document.getElementById('th-dark');
  const lt=document.getElementById('th-light');
  if(!dk)return;
  dk.className='theme-opt'+(THEME==='dark'?' on':'');
  lt.className='theme-opt'+(THEME==='light'?' on':'');
}

// ── MODE SWITCH ──
function switchMode(){
  closeDrawer();
  APP_MODE=APP_MODE==='hisab'?'cash':'hisab';
  localStorage.setItem('ht_mode',APP_MODE);
  applyMode();
}
function applyMode(){
  const isHisab=APP_MODE==='hisab';
  document.getElementById('hisab-content').style.display=isHisab?'block':'none';
  document.getElementById('cash-content').style.display=isHisab?'none':'block';
  // header
  const logoText=document.getElementById('hdr-logo-text');
  const badge=document.getElementById('mode-badge');
  const switchBtn=document.getElementById('switch-mode-btn');
  const switchIcon=document.getElementById('switch-mode-icon');
  const switchText=document.getElementById('switch-mode-text');
  if(isHisab){
    logoText.textContent='হিসাব ট্র্যাকার';
    logoText.className='logo-main';
    badge.textContent='HISAB';
    badge.className='mode-badge hisab';
    switchBtn.className='drw-item switch-mode';
    switchIcon.innerHTML=`<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 12V7H5a2 2 0 0 1 0-4h14v4"/><path d="M3 5v14a2 2 0 0 0 2 2h16v-5"/><path d="M18 12a2 2 0 0 0 0 4h4v-4Z"/></svg>`;
    switchText.textContent='Cash Tracker এ যান';
  } else {
    logoText.textContent='Cash Tracker';
    logoText.className='logo-main cash-mode';
    badge.textContent='CASH';
    badge.className='mode-badge cash';
    switchBtn.className='drw-item switch-mode to-hisab';
    switchIcon.textContent='📒';
    switchText.textContent='হিসাব Tracker এ যান';
    renderCash();
  }
}

// ── DRAWER ──
function openDrawer(){
  syncThemeBtns();
  document.getElementById('drw').classList.add('on');
  document.getElementById('drw-overlay').classList.add('on');
  document.body.style.overflow='hidden';
}
function closeDrawer(){
  document.getElementById('drw').classList.remove('on');
  document.getElementById('drw-overlay').classList.remove('on');
  document.body.style.overflow='';
}

// ── SYNC ──
function setSyncState(state,txt){
  const p=document.getElementById('sync-pill');
  const t=document.getElementById('sync-txt');
  if(!p)return;
  if(state==='synced'){p.classList.remove('show');return;}
  p.className='sync-pill show '+(state||'');
  if(txt)t.textContent=txt;
  clearTimeout(syncTimer);
  if(state==='fail'){
    syncTimer=setTimeout(()=>{p.classList.remove('show');},3000);
  }
}

// ── ACTIVITY LOG ──
function logActivity(action,detail=''){
  if(!DB.activityLog)DB.activityLog=[];
  DB.activityLog.unshift({ts:Date.now(),action,detail});
  if(DB.activityLog.length>100)DB.activityLog=DB.activityLog.slice(0,100);
}
function openActivityLog(){
  closeDrawer();
  const logs=(DB.activityLog||[]).slice(0,30);
  document.getElementById('log-list').innerHTML=logs.length
    ?logs.map(l=>`<div class="alog-item"><div class="alog-action">${l.action}</div>${l.detail?`<div class="alog-meta">${l.detail}</div>`:''}<div class="alog-meta">${fmtD(l.ts)}</div></div>`).join('')
    :'<div class="empty"><div class="empty-i" style="color:var(--muted)"><svg xmlns="http://www.w3.org/2000/svg" width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="22 12 16 12 14 15 10 15 8 12 2 12"/><path d="M5.45 5.11 2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6l-3.45-6.89A2 2 0 0 0 16.76 4H7.24a2 2 0 0 0-1.79 1.11z"/></svg></div><div class="empty-t">কোনো log নেই</div></div>';
  document.getElementById('m-log').classList.add('on');
}


// ── ANALYTICS ──
function openAnalytics(){
  closeDrawer();
  const hist=CASH_DB.history||[];
  const now=new Date();
  
  // Monthly data last 6 months
  const months=[];
  for(let i=5;i>=0;i--){
    const d=new Date(now.getFullYear(),now.getMonth()-i,1);
    months.push({
      label:d.toLocaleDateString('en-GB',{month:'short',year:'2-digit'}),
      year:d.getFullYear(),month:d.getMonth(),
      income:0,expense:0
    });
  }
  hist.forEach(h=>{
    const d=new Date(h.date);
    const m=months.find(x=>x.year===d.getFullYear()&&x.month===d.getMonth());
    if(!m)return;
    if(h.type==='add')m.income+=h.amt;
    else m.expense+=h.amt;
  });

  // Category breakdown this month
  const thisMonthHist=hist.filter(h=>{
    const d=new Date(h.date);
    return d.getMonth()===now.getMonth()&&d.getFullYear()===now.getFullYear();
  });
  const catMap={};
  thisMonthHist.filter(h=>h.type==='sub').forEach(h=>{
    const key=h.note||'Other';
    catMap[key]=(catMap[key]||0)+h.amt;
  });
  const cats=Object.entries(catMap).sort((a,b)=>b[1]-a[1]).slice(0,6);
  const catTotal=cats.reduce((s,c)=>s+c[1],0)||1;

  // Hisab summary
  const totalReceive=DB.receive.reduce((s,p)=>s+p.remaining,0);
  const totalGive=DB.give.reduce((s,p)=>s+p.remaining,0);
  const overdueR=DB.receive.filter(p=>p.dueDate&&p.dueDate<Date.now()&&p.remaining>0).length;
  const overdueG=DB.give.filter(p=>p.dueDate&&p.dueDate<Date.now()&&p.remaining>0).length;

  const maxBar=Math.max(...months.map(m=>Math.max(m.income,m.expense)),1);

  const barHTML=months.map(m=>`
    <div style="flex:1;display:flex;flex-direction:column;align-items:center;gap:3px;">
      <div style="width:100%;display:flex;flex-direction:column;align-items:center;gap:2px;height:80px;justify-content:flex-end;">
        <div style="width:45%;background:var(--green);border-radius:3px 3px 0 0;height:${Math.round((m.income/maxBar)*76)}px;min-height:${m.income>0?2:0}px;opacity:.85;"></div>
        <div style="width:45%;background:var(--red);border-radius:3px 3px 0 0;height:${Math.round((m.expense/maxBar)*76)}px;min-height:${m.expense>0?2:0}px;opacity:.85;margin-top:2px;"></div>
      </div>
      <div style="font-size:9px;color:var(--muted);font-weight:600;">${m.label}</div>
    </div>`).join('');

  const catHTML=cats.length?cats.map(([name,amt])=>`
    <div style="margin-bottom:10px;">
      <div style="display:flex;justify-content:space-between;margin-bottom:4px;">
        <span style="font-size:12px;font-weight:600;color:var(--text);">${name}</span>
        <span style="font-size:12px;font-weight:700;color:var(--red);">৳${fmt(amt)}</span>
      </div>
      <div style="height:6px;background:var(--border);border-radius:99px;overflow:hidden;">
        <div style="height:100%;width:${Math.round((amt/catTotal)*100)}%;background:var(--red);border-radius:99px;opacity:.8;"></div>
      </div>
    </div>`).join('')
    :'<div style="color:var(--muted);font-size:13px;text-align:center;padding:16px;">এই মাসে কোনো খরচ নেই</div>';

  const thisM=months[months.length-1];
  const savings=thisM.income-thisM.expense;

  document.getElementById('analytics-content').innerHTML=`
    <!-- This month summary -->
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-bottom:16px;">
      <div style="background:rgba(16,185,129,.1);border:1px solid rgba(16,185,129,.3);border-radius:12px;padding:12px;">
        <div style="font-size:10px;font-weight:700;color:var(--green);text-transform:uppercase;margin-bottom:4px;">এই মাসে আয়</div>
        <div style="font-size:18px;font-weight:900;color:var(--green);">৳${fmt(thisM.income)}</div>
      </div>
      <div style="background:rgba(239,68,68,.1);border:1px solid rgba(239,68,68,.3);border-radius:12px;padding:12px;">
        <div style="font-size:10px;font-weight:700;color:var(--red);text-transform:uppercase;margin-bottom:4px;">এই মাসে খরচ</div>
        <div style="font-size:18px;font-weight:900;color:var(--red);">৳${fmt(thisM.expense)}</div>
      </div>
    </div>
    <div style="background:${savings>=0?'rgba(16,185,129,.08)':'rgba(239,68,68,.08)'};border:1px solid ${savings>=0?'rgba(16,185,129,.3)':'rgba(239,68,68,.3)'};border-radius:12px;padding:12px;margin-bottom:16px;display:flex;justify-content:space-between;align-items:center;">
      <div style="font-size:13px;font-weight:700;color:var(--text);">এই মাসে সেভিংস</div>
      <div style="font-size:20px;font-weight:900;color:${savings>=0?'var(--green)':'var(--red)'};">${savings>=0?'+':'-'}৳${fmt(Math.abs(savings))}</div>
    </div>

    <!-- Bar chart -->
    <div style="background:var(--surface);border:1px solid var(--border);border-radius:14px;padding:14px;margin-bottom:16px;">
      <div style="font-size:12px;font-weight:700;color:var(--text);margin-bottom:10px;">গত ৬ মাস</div>
      <div style="display:flex;gap:4px;align-items:flex-end;">${barHTML}</div>
      <div style="display:flex;gap:12px;margin-top:8px;justify-content:center;">
        <span style="font-size:10px;color:var(--green);font-weight:700;display:flex;align-items:center;gap:4px;"><span style="width:10px;height:10px;background:var(--green);border-radius:2px;display:inline-block;"></span>আয়</span>
        <span style="font-size:10px;color:var(--red);font-weight:700;display:flex;align-items:center;gap:4px;"><span style="width:10px;height:10px;background:var(--red);border-radius:2px;display:inline-block;"></span>খরচ</span>
      </div>
    </div>

    <!-- Category breakdown -->
    <div style="background:var(--surface);border:1px solid var(--border);border-radius:14px;padding:14px;margin-bottom:16px;">
      <div style="font-size:12px;font-weight:700;color:var(--text);margin-bottom:12px;">এই মাসের খরচ — Category অনুযায়ী</div>
      ${catHTML}
    </div>

    <!-- Hisab summary -->
    <div style="background:var(--surface);border:1px solid var(--border);border-radius:14px;padding:14px;">
      <div style="font-size:12px;font-weight:700;color:var(--text);margin-bottom:12px;">হিসাব সারসংক্ষেপ</div>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;">
        <div style="background:rgba(16,185,129,.08);border-radius:10px;padding:10px;">
          <div style="font-size:10px;color:var(--green);font-weight:700;text-transform:uppercase;margin-bottom:3px;">মোট পাওনা</div>
          <div style="font-size:16px;font-weight:900;color:var(--green);">৳${fmt(totalReceive)}</div>
          ${overdueR>0?`<div style="font-size:10px;color:var(--red);margin-top:3px;">⚠️ ${overdueR}টি overdue</div>`:''}
        </div>
        <div style="background:rgba(239,68,68,.08);border-radius:10px;padding:10px;">
          <div style="font-size:10px;color:var(--red);font-weight:700;text-transform:uppercase;margin-bottom:3px;">মোট দেনা</div>
          <div style="font-size:16px;font-weight:900;color:var(--red);">৳${fmt(totalGive)}</div>
          ${overdueG>0?`<div style="font-size:10px;color:var(--red);margin-top:3px;">⚠️ ${overdueG}টি overdue</div>`:''}
        </div>
      </div>
    </div>
  `;
  document.getElementById('m-analytics').classList.add('on');
}
// ── CATEGORY MANAGER ──
const CAT_SECTION_META={
  cashAdd:      {label:'💰 Cash — টাকা যোগ (Add Money)'},
  cashSub:      {label:'💸 Cash — খরচ (Expense)'},
  hisabReceive: {label:'📥 Hisab — পাওনা Note'},
  hisabGive:    {label:'📤 Hisab — দেনা Note'},
  hisabAddMore: {label:'➕ Hisab — Add More Note'},
  hisabPay:     {label:'💸 Hisab — Payment Note'},
};
function openCategoryManager(){
  closeDrawer();
  if(!DB.categories)DB.categories={};
  // init from defaults if empty
  Object.keys(DEFAULT_CATS).forEach(k=>{
    if(!DB.categories[k]||!DB.categories[k].length)DB.categories[k]=JSON.parse(JSON.stringify(DEFAULT_CATS[k]));
  });
  renderCatMgrSections();
  document.getElementById('m-catmgr').classList.add('on');
}
function renderCatMgrSections(){
  const cont=document.getElementById('catmgr-sections');
  let html='';
  Object.keys(CAT_SECTION_META).forEach(key=>{
    const meta=CAT_SECTION_META[key];
    const cats=DB.categories[key]||[];
    html+=`<div class="catmgr-section">
      <div class="catmgr-sec-lbl">${meta.label}</div>
      <div class="catmgr-tags" id="catmgr-tags-${key}">
        ${cats.map((c,i)=>`
          <div class="catmgr-tag-row" id="catrow-${key}-${i}">
            <input class="catmgr-emoji" type="text" maxlength="4" value="${c.e||''}" placeholder="🏷" oninput="updateCat('${key}',${i},'e',this.value)">
            <input class="catmgr-label" type="text" value="${c.l||''}" placeholder="Label" oninput="updateCat('${key}',${i},'l',this.value)">
            <button class="catmgr-del" onclick="deleteCat('${key}',${i})">✕</button>
          </div>`).join('')}
      </div>
      <button class="catmgr-add-btn" onclick="addCat('${key}')">+ Add Tag</button>
    </div>`;
  });
  cont.innerHTML=html;
}
function updateCat(key,idx,field,val){
  if(!DB.categories[key])return;
  DB.categories[key][idx][field]=val;
  saveCats();
}
function addCat(key){
  if(!DB.categories[key])DB.categories[key]=[];
  DB.categories[key].push({e:'',l:'New Tag'});
  saveCats();
  renderCatMgrSections();
}
function deleteCat(key,idx){
  if(!DB.categories[key])return;
  DB.categories[key].splice(idx,1);
  saveCats();
  renderCatMgrSections();
  toast('🗑️ Tag মুছে গেছে');
}

// ── AUTH ──
let authMode='login';
function switchAuthTab(mode,el){
  authMode=mode;
  document.querySelectorAll('.auth-tab').forEach(t=>t.classList.remove('on'));
  el.classList.add('on');
  document.getElementById('au-name-wrap').style.display=mode==='register'?'block':'none';
  const btnEl=document.getElementById('au-btn');
  btnEl.querySelector('.bn').textContent=mode==='login'?'লগইন করুন →':'রেজিস্টার করুন →';
  btnEl.querySelector('.en').textContent=mode==='login'?'Login →':'Register →';
  document.getElementById('au-forgot').style.display=mode==='login'?'block':'none';
  setAuthMsg('','');
}
function setAuthMsg(msg,type){
  const el=document.getElementById('au-msg');
  el.textContent=msg; el.className='auth-msg '+(type||'');
}
async function authSubmit(){
  const email=document.getElementById('au-email').value.trim();
  const pass=document.getElementById('au-pass').value;
  if(!email||!pass){setAuthMsg(LANG==='bn'?'Email ও Password দিন!':'Enter email and password!','err');return;}
  const btn=document.getElementById('au-btn');
  btn.querySelector('.bn').textContent='⏳ অপেক্ষা করুন...';
  btn.querySelector('.en').textContent='⏳ Please wait...';
  btn.disabled=true;
  const{data,error}=await(authMode==='login'
    ?sb.auth.signInWithPassword({email,password:pass})
    :sb.auth.signUp({email,password:pass}));
  btn.disabled=false;
  btn.querySelector('.bn').textContent=authMode==='login'?'লগইন করুন →':'রেজিস্টার করুন →';
  btn.querySelector('.en').textContent=authMode==='login'?'Login →':'Register →';
  if(error){
    const m=error.message;
    const msg=m.includes('Invalid login')?'❌ Email বা Password ভুল!':
      m.includes('already')?'❌ এই email-এ account আছে!':
      m.includes('Password')?'❌ Password কমপক্ষে ৬ অক্ষর!':'❌ '+m;
    setAuthMsg(msg,'err'); return;
  }
  if(authMode==='register'&&!data.session){
    setAuthMsg('✅ Registered! Email verify করে login করুন।','ok'); return;
  }
}
async function authForgot(){
  const email=document.getElementById('au-email').value.trim();
  if(!email){setAuthMsg('আগে email দিন!','err');return;}
  await sb.auth.resetPasswordForEmail(email);
  setAuthMsg('✅ Reset link পাঠানো হয়েছে!','ok');
}
async function signOut(){
  logActivity('Logout');
  if(CUR_USER)await saveData();
  await sb.auth.signOut();
  if(CUR_USER)localStorage.removeItem('ht_tr_'+CUR_USER.id);
  CUR_USER=null; DB={receive:[],give:[],activityLog:[]};
  closeDrawer();
  document.getElementById('app').style.display='none';
  document.getElementById('pin-screen').style.display='none';
  document.getElementById('auth-screen').style.display='flex';
  document.body.style.overflow='';
  setAuthMsg('','');
}

let _appInitialized=false;
sb.auth.onAuthStateChange(async(event,session)=>{
  if(sessionStorage.getItem('ht_verify_flow')==='1'){
    sessionStorage.removeItem('ht_verify_flow');
    document.getElementById('app').style.display='none';
    document.getElementById('pin-screen').style.display='none';
    document.getElementById('auth-screen').style.display='flex';
    document.getElementById('verified-banner').style.display='block';
    await sb.auth.signOut();
    return;
  }
  if(session&&session.user){
    CUR_USER=session.user;
    document.getElementById('auth-screen').style.display='none';
    const email=CUR_USER.email||'';
    document.getElementById('drw-av').textContent=email.charAt(0).toUpperCase();
    document.getElementById('drw-name').innerHTML =
  '<a href="https://profess0r-null.xyz" target="_blank" class="dev-link">profess0r.null ↗</a>';
    document.getElementById('drw-email').textContent=email;
    if(!_appInitialized){
      _appInitialized=true;
      await checkPin();
    }
  } else {
    _appInitialized=false;
    CUR_USER=null;
    DB={receive:[],give:[],activityLog:[]};
    document.getElementById('app').style.display='none';
    document.getElementById('pin-screen').style.display='none';
    document.getElementById('auth-screen').style.display='flex';
  }
});

// ── PROFILE ──
function openProfile(){
  closeDrawer();
  document.getElementById('m-profile-email').textContent=CUR_USER?.email||'';
  document.getElementById('pr-new').value='';
  document.getElementById('pr-cf').value='';
  document.getElementById('pr-msg').textContent='';
  document.getElementById('pr-msg').className='modal-msg';
  document.getElementById('m-profile').classList.add('on');
}
async function changePassword(){
  const np=document.getElementById('pr-new').value;
  const cf=document.getElementById('pr-cf').value;
  const msg=document.getElementById('pr-msg');
  if(np.length<6){msg.className='modal-msg err';msg.textContent='কমপক্ষে ৬ অক্ষর!';return;}
  if(np!==cf){msg.className='modal-msg err';msg.textContent='Password মিলছে না!';return;}
  const{error}=await sb.auth.updateUser({password:np});
  if(error){msg.className='modal-msg err';msg.textContent='❌ '+error.message;return;}
  logActivity('Password পরিবর্তন করা হয়েছে');
  await saveData();
  msg.className='modal-msg ok';msg.textContent='✅ পাসওয়ার্ড পরিবর্তন হয়েছে!';
  setTimeout(()=>cm('m-profile'),1500);
}

// ── PIN ──
function ph(p){let h=5381;for(let i=0;i<p.length;i++)h=(h*33)^p.charCodeAt(i);return(h>>>0).toString(36);}
function pk(){return'ht_pin_'+CUR_USER.id;}
function tk(){return'ht_tr_'+CUR_USER.id;}
function getPin(){return DB.pinHash||ph('1234');}
function isTrusted(){return localStorage.getItem(tk())==='1';}
function setTrusted(){localStorage.setItem(tk(),'1');}

async function checkPin(){
  if(isTrusted()){showApp();return;}
  try{
    const{data}=await sb.from('hisab_users').select('data').eq('id',CUR_USER.id).maybeSingle();
    if(data&&data.data&&data.data.pinHash){
      DB.pinHash=data.data.pinHash;
      localStorage.setItem(pk(),data.data.pinHash);
    }
  }catch(e){}
  document.getElementById('auth-screen').style.display='none';
  document.getElementById('app').style.display='none';
  pinMode='unlock';pinBuf='';updDots('');
  document.getElementById('pin-err').textContent='';
  document.getElementById('pin-title').textContent=LANG==='bn'?'PIN দিন':'Enter PIN';
  document.getElementById('pin-sub').textContent=LANG==='bn'?'আপনার ৪ সংখ্যার PIN লিখুন':'Enter your 4-digit PIN';
  document.getElementById('pin-screen').style.display='flex';
}
function openPinChange(){
  closeDrawer();
  pinMode='set-new1';pinBuf='';updDots('');
  document.getElementById('pin-err').textContent='';
  document.getElementById('pin-title').textContent=LANG==='bn'?'নতুন PIN দিন':'New PIN';
  document.getElementById('pin-sub').textContent=LANG==='bn'?'নতুন ৪ সংখ্যার PIN লিখুন':'Enter a new 4-digit PIN';
  document.getElementById('app').style.display='none';
  document.getElementById('pin-screen').style.display='flex';
}
function lockApp(){
  closeDrawer();
  logActivity('App লক করা হয়েছে');
  saveData();
  localStorage.removeItem(tk());
  _appInitialized=false;
  document.getElementById('app').style.display='none';
  document.getElementById('auth-screen').style.display='none';
  document.body.style.overflow='';
  pinMode='unlock';pinBuf='';updDots('');
  document.getElementById('pin-err').textContent='';
  document.getElementById('pin-title').textContent=LANG==='bn'?'PIN দিন':'Enter PIN';
  document.getElementById('pin-sub').textContent=LANG==='bn'?'আপনার ৪ সংখ্যার PIN লিখুন':'Enter your 4-digit PIN';
  document.getElementById('pin-screen').style.display='flex';
}
function updDots(buf,cls){
  for(let i=0;i<4;i++){const d=document.getElementById('pd'+i);d.className='pin-dot'+(i<buf.length?' '+(cls||'filled'):'');}
}
function pinKey(k){
  if(pinBuf.length>=4)return;
  pinBuf+=k;updDots(pinBuf);
  document.getElementById('pin-err').textContent='';
  if(pinBuf.length===4)setTimeout(handlePin,120);
}
function pinDel(){pinBuf=pinBuf.slice(0,-1);updDots(pinBuf);}
function handlePin(){
  const box=document.querySelector('.pin-box');
  if(pinMode==='unlock'){
    if(ph(pinBuf)===getPin()){
      setTrusted();
      document.getElementById('pin-screen').style.display='none';
      showApp();
    }else{
      updDots('1234','err');
      document.getElementById('pin-err').textContent=LANG==='bn'?'❌ ভুল PIN!':'❌ Wrong PIN!';
      box.classList.add('shake');
      setTimeout(()=>{box.classList.remove('shake');pinBuf='';updDots('');},500);
    }
  }else if(pinMode==='set-new1'){
    pinTmp=pinBuf;pinBuf='';updDots('');
    pinMode='set-new2';
    document.getElementById('pin-title').textContent=LANG==='bn'?'আবার দিন':'Confirm PIN';
    document.getElementById('pin-sub').textContent=LANG==='bn'?'PIN আবার লিখে নিশ্চিত করুন':'Re-enter your PIN to confirm';
  }else if(pinMode==='set-new2'){
    if(pinBuf===pinTmp){
      const hash=ph(pinBuf);
      localStorage.setItem(pk(),hash);
      DB.pinHash=hash;
      logActivity('PIN পরিবর্তন করা হয়েছে');
      saveData();
      pinBuf='';pinTmp='';pinMode='unlock';
      document.getElementById('pin-screen').style.display='none';
      document.getElementById('app').style.display='block';
      toast('✅ PIN পরিবর্তন হয়েছে!');
    }else{
      updDots('1234','err');
      document.getElementById('pin-err').textContent=LANG==='bn'?'❌ মিলেনি! আবার চেষ্টা করুন।':'❌ Mismatch! Try again.';
      box.classList.add('shake');
      setTimeout(()=>{
        box.classList.remove('shake');pinBuf='';pinTmp='';
        pinMode='set-new1';updDots('');
        document.getElementById('pin-title').textContent=LANG==='bn'?'নতুন PIN দিন':'New PIN';
        document.getElementById('pin-sub').textContent=LANG==='bn'?'নতুন ৪ সংখ্যার PIN লিখুন':'Enter a new 4-digit PIN';
      },500);
    }
  }
}

// ── DATA ──
function showSkeleton(){
  const app=document.getElementById('app');
  app.innerHTML=`<div class="skel-wrap">
    ${[1,2,3].map(()=>`<div class="skel-card"><div class="skel-line wide"></div><div class="skel-line med"></div><div class="skel-line short"></div></div>`).join('')}
  </div>`;
}
async function showApp(){
  document.getElementById('app').style.display='block';
  setSyncState('saving','Loading...');
  (async()=>{try{await sb.from('visits').insert({user_agent:navigator.userAgent,logged_in:true});}catch(e){}})();
  await loadData();
  await loadCashDataCloud();
  logActivity('Login সফল',CUR_USER.email);
  await saveData(true); // true = login toast
  applyMode();
  render();
  renderAllQtags();
  // set today default for hisab due dates
  const today=new Date().toISOString().split('T')[0];
  ['r-due','g-due'].forEach(id=>{const el=document.getElementById(id);if(el){el.value=today;el.classList.add('has-val');}});
  // floating label: track has-val on all cf-inputs
  document.querySelectorAll('.cf-input').forEach(inp=>{
    inp.addEventListener('input',()=>inp.classList.toggle('has-val',inp.value.length>0));
    inp.addEventListener('change',()=>inp.classList.toggle('has-val',inp.value.length>0));
    if(inp.value.length>0) inp.classList.add('has-val');
  });
}
async function loadData(){
  const{data,error}=await sb.from('hisab_users').select('data').eq('id',CUR_USER.id).maybeSingle();
  if(data&&data.data){
    DB=data.data;
    if(!DB.receive)DB.receive=[];
    if(!DB.give)DB.give=[];
    if(!DB.activityLog)DB.activityLog=[];
    if(!DB.categories)DB.categories={};
    // PIN cloud থেকে localStorage এ sync
    if(DB.pinHash) localStorage.setItem(pk(),DB.pinHash);
  }else if(!error){
    await sb.from('hisab_users').insert({id:CUR_USER.id,data:DB});
  }
}
async function saveData(showLoginToast=false){
  setSyncState('saving','Saving...');
  localStorage.setItem('ht_'+CUR_USER.id,JSON.stringify(DB));
  try{
    await sb.from('hisab_users').upsert({id:CUR_USER.id,data:DB,updated_at:new Date().toISOString()});
    if(showLoginToast){
      toast(LANG==='bn'?'👋 স্বাগতম!':'👋 Welcome!');
    }
    setSyncState('synced');
  }catch(e){
    setSyncState('fail','Sync failed ✕');
  }
}

// ── CASH DATA (local only) ──
function cashKey(){return'ht_cash_'+(CUR_USER?CUR_USER.id:'guest');}
function loadCashData(){
  const raw=localStorage.getItem(cashKey());
  if(raw)try{CASH_DB=JSON.parse(raw);}catch(e){CASH_DB={balance:0,history:[]};}
  if(!CASH_DB.history)CASH_DB.history=[];
}
async function loadCashDataCloud(){
  try{
    const{data,error}=await sb.from('hisab_cash').select('data').eq('id',CUR_USER.id).maybeSingle();
    if(data&&data.data){
      CASH_DB=data.data;
      if(!CASH_DB.history)CASH_DB.history=[];
      localStorage.setItem(cashKey(),JSON.stringify(CASH_DB));
    } else if(!error){
      // first time — check localStorage backup
      const raw=localStorage.getItem(cashKey());
      if(raw)try{CASH_DB=JSON.parse(raw);}catch(e){}
      if(!CASH_DB.history)CASH_DB.history=[];
      // save to cloud
      await sb.from('hisab_cash').insert({id:CUR_USER.id,data:CASH_DB});
    }
  }catch(e){
    // fallback to localStorage
    const raw=localStorage.getItem(cashKey());
    if(raw)try{CASH_DB=JSON.parse(raw);}catch(e2){}
    if(!CASH_DB.history)CASH_DB.history=[];
  }
}
function saveCashData(){
  localStorage.setItem(cashKey(),JSON.stringify(CASH_DB));
  // cloud sync async
  if(CUR_USER){
    sb.from('hisab_cash').upsert({id:CUR_USER.id,data:CASH_DB,updated_at:new Date().toISOString()}).then(({error})=>{
      if(error)setSyncState('fail','Sync failed ✕');
      else setSyncState('synced');
    });
  }
}

// ── CASH TRACKER FUNCTIONS ──
function openCashForm(mode){
  cashFormMode=mode;
  const form=document.getElementById('cash-form');
  const icon=document.getElementById('cash-form-icon');
  const submitBtn=document.getElementById('cash-submit-btn');
  if(mode==='add'){
    icon.innerHTML=`<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12h14"/><path d="M12 5v14"/></svg>`;
    icon.style.background='rgba(16,185,129,.15)';icon.style.color='var(--green)';
    document.getElementById('cash-form-title').style.color='var(--green)';
    submitBtn.className='sbtn sbtn-g';
    submitBtn.innerHTML='<span class="bn">যোগ করুন ✓</span><span class="en">Add ✓</span>';
    renderQtags('cash-qtags','cashAdd','cash-note');
  } else {
    icon.innerHTML=`<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12h14"/></svg>`;
    icon.style.background='rgba(239,68,68,.12)';icon.style.color='var(--red)';
    document.getElementById('cash-form-title').style.color='var(--red)';
    submitBtn.className='sbtn sbtn-r';
    submitBtn.innerHTML='<span class="bn">বিয়োগ করুন ✓</span><span class="en">Deduct ✓</span>';
    renderQtags('cash-qtags','cashSub','cash-note');
  }
  document.getElementById('cash-amt').value='';
  document.getElementById('cash-note').value='';
  const todayStr=new Date().toISOString().split('T')[0];
  const dateEl=document.getElementById('cash-date');
  dateEl.value=todayStr;
  dateEl.classList.add('has-val');
  document.getElementById('cash-amt').classList.remove('has-val');
  document.getElementById('cash-note').classList.remove('has-val');
  form.classList.remove('hidden');
  document.getElementById('cash-amt').focus();
}
function closeCashForm(){
  document.getElementById('cash-form').classList.add('hidden');
}
function submitCash(){
  const amt=parseFloat(document.getElementById('cash-amt').value);
  const note=document.getElementById('cash-note').value.trim()||( cashFormMode==='add'?'টাকা যোগ':'খরচ');
  if(isNaN(amt)||amt<=0){toast('❌ সঠিক পরিমাণ দিন!');return;}
  const ts=Date.now();
  const dateVal=document.getElementById('cash-date').value;
  const entryDate=dateVal?new Date(dateVal).getTime():ts;
  if(cashFormMode==='add'){
    CASH_DB.balance+=amt;
    CASH_DB.history.unshift({id:ts,type:'add',amt,note,date:entryDate});
    toast('✅ ৳'+fmt(amt)+' যোগ হয়েছে!');
  } else {
    if(amt>CASH_DB.balance){toast('❌ পর্যাপ্ত ব্যালেন্স নেই!');return;}
    CASH_DB.balance-=amt;
    CASH_DB.history.unshift({id:ts,type:'sub',amt,note,date:entryDate});
    toast('💸 ৳'+fmt(amt)+' খরচ হয়েছে!');
  }
  saveCashData();
  closeCashForm();
  renderCash();
}
function deleteCashEntry(id){
  const entry=CASH_DB.history.find(h=>h.id===id);
  if(!entry)return;
  const idx=CASH_DB.history.findIndex(h=>h.id===id);
  const snap=JSON.parse(JSON.stringify(entry));
  const balBefore=CASH_DB.balance;
  if(entry.type==='add') CASH_DB.balance-=entry.amt;
  else CASH_DB.balance+=entry.amt;
  CASH_DB.balance=Math.max(0,CASH_DB.balance);
  CASH_DB.history=CASH_DB.history.filter(h=>h.id!==id);
  saveCashData();renderCash();
  toast(LANG==='bn'?`🗑️ "${snap.note}" মুছে গেছে`:`🗑️ "${snap.note}" deleted`,()=>{
    CASH_DB.history.splice(Math.min(idx,CASH_DB.history.length),0,snap);
    CASH_DB.balance=balBefore;
    saveCashData();renderCash();toast(LANG==='bn'?'↩️ ফিরিয়ে আনা হয়েছে':'↩️ Restored');
  });
}
function clearCashHistory(){
  if(!confirm('সব ইতিহাস মুছবেন? ব্যালেন্স ০ হয়ে যাবে।'))return;
  CASH_DB={balance:0,history:[]};
  saveCashData();
  renderCash();
  toast('🗑️ সব মুছে গেছে');
}
function openCashEdit(id){
  const h=CASH_DB.history.find(x=>x.id===id);
  if(!h)return;
  document.getElementById('cedit-id').value=id;
  document.getElementById('cedit-amt').value=h.amt;
  document.getElementById('cedit-note').value=h.note||'';
  document.getElementById('cedit-type').value=h.type;
  document.getElementById('m-cedit').classList.add('on');
}
function confirmCashEdit(){
  const id=Number(document.getElementById('cedit-id').value);
  const amt=parseFloat(document.getElementById('cedit-amt').value);
  const note=document.getElementById('cedit-note').value.trim();
  if(!amt||amt<=0){toast('❌ সঠিক পরিমাণ দিন');return;}
  const h=CASH_DB.history.find(x=>x.id===id);
  if(!h)return;
  // adjust balance
  if(h.type==='add') CASH_DB.balance-=h.amt;
  else CASH_DB.balance+=h.amt;
  h.amt=amt;
  h.note=note||h.note;
  if(h.type==='add') CASH_DB.balance+=amt;
  else CASH_DB.balance-=amt;
  CASH_DB.balance=Math.max(0,CASH_DB.balance);
  saveCashData();renderCash();cm('m-cedit');
  toast(LANG==='bn'?'✏️ আপডেট হয়েছে':'✏️ Updated');
}
function renderCash(){
  const bal=CASH_DB.balance||0;
  const hist=CASH_DB.history||[];
  // balance
  document.getElementById('cash-balance').textContent='৳'+fmt(bal);
  // stats
  const totalIn=hist.filter(h=>h.type==='add').reduce((s,h)=>s+h.amt,0);
  const totalOut=hist.filter(h=>h.type==='sub').reduce((s,h)=>s+h.amt,0);
  document.getElementById('cash-total-in').textContent='৳'+fmt(totalIn);
  document.getElementById('cash-total-out').textContent='৳'+fmt(totalOut);
  document.getElementById('cash-txn-count').textContent=hist.length;
  // last txn
  const sub=document.getElementById('cash-hero-sub');
  if(hist.length>0){
    const last=hist[0];
    const prefix=last.type==='add'?'↑ ':'↓ ';
    const label=last.type==='add'?(LANG==='bn'?'শেষ যোগ: ':'Last in: '):(LANG==='bn'?'শেষ খরচ: ':'Last out: ');
    sub.textContent=prefix+label+'৳'+fmt(last.amt)+' — '+last.note;
  } else {
    sub.innerHTML='<span class="bn">কোনো লেনদেন নেই</span><span class="en" style="display:none">No transactions yet</span>';
  }
  // budget bar
  const budget=CASH_DB.budget||0;
  const budgetWrap=document.getElementById('budget-wrap');
  const budgetCta=document.getElementById('budget-cta');
  if(budget>0){
    budgetWrap.style.display='block';
    budgetCta.style.display='none';
    const pct=Math.min(100,Math.round((totalOut/budget)*100));
    const fill=document.getElementById('budget-fill');
    fill.style.width=pct+'%';
    fill.style.background=pct<60?'var(--green)':pct<85?'var(--yellow)':'var(--red)';
    document.getElementById('budget-pct').textContent=pct+'%';
    document.getElementById('budget-pct').style.color=pct<60?'var(--green)':pct<85?'var(--yellow)':'var(--red)';
    const rem=budget-totalOut;
    document.getElementById('budget-sub').textContent=LANG==='bn'
      ?(rem>0?`বাকি ৳${fmt(rem)} থেকে ৳${fmt(budget)}`:`বাজেট ৳${fmt(Math.abs(rem))} ছাড়িয়ে গেছে!`)
      :(rem>0?`৳${fmt(rem)} left of ৳${fmt(budget)}`:`Over budget by ৳${fmt(Math.abs(rem))}!`);
  } else {
    budgetWrap.style.display='none';
    budgetCta.style.display='block';
  }
  // filter history
  const filtered=CASH_FILTER==='all'?hist:hist.filter(h=>h.type===CASH_FILTER);
  // history list
  const list=document.getElementById('cash-history-list');
  if(filtered.length===0){
    list.innerHTML=`<div class="empty"><div class="empty-i" style="color:var(--muted)"><svg xmlns="http://www.w3.org/2000/svg" width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M21 12V7H5a2 2 0 0 1 0-4h14v4"/><path d="M3 5v14a2 2 0 0 0 2 2h16v-5"/><path d="M18 12a2 2 0 0 0 0 4h4v-4Z"/></svg></div><div class="empty-t"><span class="bn">${CASH_FILTER==='all'?'কোনো লেনদেন নেই':'কোনো রেকর্ড নেই'}</span><span class="en">${CASH_FILTER==='all'?'No transactions yet':'No records found'}</span></div><div class="empty-s"><span class="bn">উপরের বাটন দিয়ে শুরু করুন</span><span class="en">Use the buttons above to get started</span></div></div>`;
    return;
  }
  list.innerHTML=filtered.map(h=>`
    <div class="cash-entry">
      <div class="cash-entry-icon ${h.type==='add'?'plus':'minus'}">${h.type==='add'?'⬆️':'⬇️'}</div>
      <div class="cash-entry-info">
        <div class="cash-entry-note">${h.note}</div>
        <div class="cash-entry-date">${fmtD(h.date)}</div>
      </div>
      <div class="cash-entry-amt ${h.type==='add'?'plus':'minus'}">${h.type==='add'?'+':'-'}৳${fmt(h.amt)}</div>
      <button class="cash-edit-btn" onclick="openCashEdit(${h.id})"><svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4Z"/></svg></button>
      <button class="cash-del-btn" onclick="deleteCashEntry(${h.id})"><svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 6h18"/><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"/><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"/></svg></button>
    </div>
  `).join('');
}

// ── FORMAT ──
function fmt(n){return Math.round(Number(n)).toLocaleString('en-IN');}
function fmtD(v){
  let d=typeof v==='number'||(typeof v==='string'&&/^\d{10,}$/.test(v))?new Date(Number(v)):new Date(v);
  if(isNaN(d))return String(v);
  return `${String(d.getDate()).padStart(2,'0')}/${String(d.getMonth()+1).padStart(2,'0')}/${d.getFullYear()} ${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')}`;
}

// ── AGING ──
function firstTs(p){
  if(p.loanData && p.loanData.loanDate) return new Date(p.loanData.loanDate).getTime();
  if(p.clearedAt) return p.clearedAt;
  const a=p.history.filter(h=>h.t==='add');
  return a.length?Math.min(...a.map(h=>Number(h.id)||Number(p.id))):p.id;
}
function ageDays(p){
  if(p.loanData && p.loanData.loanDate){
    const ld = new Date(p.loanData.loanDate); ld.setHours(0,0,0,0);
    const now = new Date(); now.setHours(0,0,0,0);
    return Math.max(0, Math.floor((now - ld) / 86400000));
  }
  return Math.floor((Date.now()-firstTs(p))/86400000);
}
function ageBadge(d){const l=LANG==='bn'?`${d} দিন`:`${d}d`;return d<=7?{cls:'',l}:d<=30?{cls:'mid',l}:{cls:'old',l:l+' ⚠️'};}

// ── COUNT-UP ──
function countUp(el,target,pre=''){
  const dur=450,s=performance.now();
  const up=n=>{const p=Math.min((n-s)/dur,1),e=1-Math.pow(1-p,3);el.textContent=pre+fmt(Math.round(target*e));if(p<1)requestAnimationFrame(up);else el.textContent=pre+fmt(target);};
  requestAnimationFrame(up);
}

// ── UI ──
let _toastTimer=null;
function toast(msg,undoFn=null){
  const t=document.getElementById('toast');
  if(_toastTimer)clearTimeout(_toastTimer);
  t.innerHTML='';

  // Icon detection from message
  const iconMap={'🗑️':'trash','↩️':'undo','✅':'check','❌':'error','✏️':'edit','💸':'money','👋':'wave'};
  let iconSVG='';
  if(msg.startsWith('🗑️')||msg.startsWith('🗑')){
    iconSVG=`<span class="t-icon t-icon-del"><svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M3 6h18"/><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"/><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"/></svg></span>`;
    msg=msg.replace(/^🗑️?\s*/,'');
  } else if(msg.startsWith('↩️')){
    iconSVG=`<span class="t-icon t-icon-undo"><svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M3 7v6h6"/><path d="M21 17a9 9 0 0 0-9-9 9 9 0 0 0-6 2.3L3 13"/></svg></span>`;
    msg=msg.replace(/^↩️\s*/,'');
  } else if(msg.startsWith('✅')||msg.startsWith('✓')){
    iconSVG=`<span class="t-icon t-icon-ok"><svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M20 6 9 17l-5-5"/></svg></span>`;
    msg=msg.replace(/^✅\s*/,'');
  } else if(msg.startsWith('❌')){
    iconSVG=`<span class="t-icon t-icon-err"><svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><path d="m15 9-6 6"/><path d="m9 9 6 6"/></svg></span>`;
    msg=msg.replace(/^❌\s*/,'');
  } else if(msg.startsWith('✏️')){
    iconSVG=`<span class="t-icon t-icon-ok"><svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4Z"/></svg></span>`;
    msg=msg.replace(/^✏️\s*/,'');
  } else if(msg.startsWith('💸')){
    iconSVG=`<span class="t-icon t-icon-ok"><svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M12 5v14"/><path d="m19 12-7 7-7-7"/></svg></span>`;
    msg=msg.replace(/^💸\s*/,'');
  } else if(msg.startsWith('👋')){
    iconSVG=`<span class="t-icon t-icon-ok"><svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M20 6 9 17l-5-5"/></svg></span>`;
    msg=msg.replace(/^👋\s*/,'');
  }

  if(iconSVG) t.insertAdjacentHTML('beforeend',iconSVG);
  const msgSpan=document.createElement('span');
  msgSpan.className='t-msg';
  msgSpan.textContent=msg;
  t.appendChild(msgSpan);

  if(undoFn){
    const sep=document.createElement('span');sep.className='t-sep';t.appendChild(sep);
    const btn=document.createElement('button');
    btn.className='toast-undo-btn';
    btn.textContent='Undo';
    btn.addEventListener('click',()=>{
      undoFn();
      t.classList.remove('on');
      clearTimeout(_toastTimer);
      window._pendingUndo=null;
    });
    t.appendChild(btn);
    window._pendingUndo=undoFn;
  } else {
    window._pendingUndo=null;
  }
  t.classList.add('on');
  _toastTimer=setTimeout(()=>{
    t.classList.remove('on');
    window._pendingUndo=null;
  },undoFn?6000:3000);
}
function cm(id){document.getElementById(id).classList.remove('on');}
function toggleLang(){LANG=LANG==='bn'?'en':'bn';localStorage.setItem('ht_lang',LANG);document.documentElement.setAttribute('data-lang',LANG);render();}
function switchTab(t,ev){
  TAB=t;
  document.querySelectorAll('.tab').forEach(b=>b.classList.remove('on'));
  if(ev)ev.currentTarget.classList.add('on');
  ['r','g','a'].forEach(s=>document.getElementById('sec-'+s).style.display=s===t?'block':'none');
  render();
}
function setQ(v,id){
  const inp=document.getElementById(id);
  if(!inp) return;
  inp.value=v;
  inp.classList.add('has-val');
  // highlight all qtags with this value
  document.querySelectorAll('.qtag').forEach(tag=>{
    if(tag.textContent.includes(v.split(' ')[v.split(' ').length-1]) || tag.textContent.includes(v.split(' ')[0])){
      tag.classList.add('qtag-active');
    } else {
      tag.classList.remove('qtag-active');
    }
  });
}
function toggleSA(k){SA[k]=!SA[k];render();}

function parseFeeString(str){
  if(!str||typeof str!=='string')return 0;
  return str.split(',').map(s=>parseFloat(s.trim())).filter(n=>!isNaN(n)&&n>0).reduce((a,b)=>a+b,0);
}
function calculateLoanTotal(principal,fees=0,loanDateStr=null){
  const r=0.015,n=3;
  const emi=(principal*r*Math.pow(1+r,n))/(Math.pow(1+r,n)-1);
  const fullInterest=principal*0.030823;
  const processingFee=Math.round(principal*0.00575);
  const totalRepayment=principal+fullInterest+processingFee+fees;

  // Generate exact EMI schedule (reducing balance)
  let schedule=[];
  let bal=principal;
  for(let i=0;i<n;i++){
    const monthInterest=bal*r;
    const principalPart=emi-monthInterest;
    schedule.push({
      month:i+1,
      interest:monthInterest,
      principalPart,
      emi,
      openingBal:bal,
      closingBal:Math.max(0,bal-principalPart)
    });
    bal=Math.max(0,bal-principalPart);
  }

  let loanDate=loanDateStr?new Date(loanDateStr):new Date();
  loanDate.setHours(0,0,0,0);
  const now=new Date();now.setHours(0,0,0,0);
  const daysToCharge=Math.max(0,Math.min(90,Math.floor((now-loanDate)/86400000)));

  return{emi,fullInterest,processingFee,fees,daysToCharge,totalRepayment,schedule};
}
function calculateThisMonthDue(principal,fullInterest,processingFee,fees,paidAmount,daysToCharge,payments,loanStart){
  // Total payable = principal + fullInterest + processingFee + extraFee
  const totalPayable=principal+fullInterest+processingFee+fees;
  const monthlyEMI=Math.ceil(totalPayable/3);

  // Current month index (0-based), 30-day cycles from loan date
  const currentMonthIndex=Math.min(2,Math.floor(daysToCharge/30));

  // Calculate how much was paid in each 30-day cycle
  const paidPerCycle=[0,0,0];
  for(const pay of payments){
    const payDate=new Date(pay.date);payDate.setHours(0,0,0,0);
    const d=Math.max(0,Math.round((payDate-loanStart)/86400000));
    const cycleIdx=Math.min(2,Math.floor(d/30));
    paidPerCycle[cycleIdx]+=pay.amt;
  }

  // Walk through completed cycles to accumulate carry
  let carry=0;
  for(let i=0;i<currentMonthIndex;i++){
    const due=monthlyEMI+carry;
    const paid=paidPerCycle[i];
    carry=Math.max(0,due-paid);
  }

  // Current cycle due = this month EMI + carry - paid this cycle
  const currentCycleDue=monthlyEMI+carry;
  const paidThisCycle=paidPerCycle[currentMonthIndex];
  const thisMonthDue=Math.max(0,currentCycleDue-paidThisCycle);

  return{monthlyEMI,thisMonthDue,currentMonthIndex,carry};
}

function getLoanBreakdown(p){
  const isLoan=p.loanData||p.history.some(h=>h.note.toLowerCase().includes('loan'));
  if(!isLoan)return null;
  const loanDate=p.loanData?.loanDate?new Date(p.loanData.loanDate):new Date(firstTs(p));
  const fees=p.loanData?.fees||0;
  const loanDateStr=loanDate.toISOString().split('T')[0];
  const calc=calculateLoanTotal(p.original,fees,loanDateStr);

  const paidAmount=p.history.filter(h=>h.t==='pay').reduce((s,h)=>s+h.amt,0);

  // Determine current interest accrued based on days passed (pro-rate over schedule)
  const daysToCharge=calc.daysToCharge;
  // Which months have fully elapsed? (each month ~30 days)
  const monthsFullyDone=Math.floor(daysToCharge/30);
  const daysInCurrentMonth=daysToCharge%30;

  let currentInterest=0;
  for(let i=0;i<Math.min(monthsFullyDone,3);i++){
    currentInterest+=calc.schedule[i].interest;
  }
  // Add pro-rated interest for partial current month
  if(monthsFullyDone<3&&daysInCurrentMonth>0){
    const monthIdx=Math.min(monthsFullyDone,2);
    currentInterest+=calc.schedule[monthIdx].interest*(daysInCurrentMonth/30);
  }
  currentInterest=Math.round(currentInterest);

  // Partial payment: interest first, then principal
  const interestCovered=Math.min(paidAmount,currentInterest);
  const principalReduction=Math.max(0,paidAmount-interestCovered);
  const remainingPrincipal=Math.max(0,p.original-principalReduction);

  const remainingDue=Math.max(0,calc.totalRepayment-paidAmount);
  const progressPercent=calc.totalRepayment>0
    ?Math.min(100,Math.round((paidAmount/calc.totalRepayment)*100)):0;

  const loanStart=new Date(loanDate);loanStart.setHours(0,0,0,0);
  const payments=p.history.filter(h=>h.t==='pay').map(h=>({date:h.date,amt:h.amt})).sort((a,b)=>a.date-b.date);
  const emiCalc=calculateThisMonthDue(p.original,calc.fullInterest,calc.processingFee,fees,paidAmount,daysToCharge,payments,loanStart);

  return{
    emi:calc.emi,
    monthlyEMI:emiCalc.monthlyEMI,
    thisMonthDue:emiCalc.thisMonthDue,
    currentMonthIndex:emiCalc.currentMonthIndex,
    fullInterest:calc.fullInterest,
    processingFee:calc.processingFee,
    fees:calc.fees,
    daysToCharge:calc.daysToCharge,
    totalRepayment:calc.totalRepayment,
    schedule:calc.schedule,
    interest:currentInterest,
    paidAmount,
    remainingPrincipal,
    remainingDue,
    dailyAmount:Math.max(0,remainingPrincipal+currentInterest+calc.processingFee+fees),
    progressPercent
  };
}
function updateLoanNoteFields(){
  const note=document.getElementById('r-no').value.toLowerCase();
  const hasLoan=note.includes('loan');
  document.getElementById('r-loan-fields').style.display=hasLoan?'block':'none';
  if(hasLoan){
    const today=new Date().toISOString().split('T')[0];
    if(!document.getElementById('r-loan-date').value)document.getElementById('r-loan-date').value=today;
  }
}

// ── ENTRIES ──
function addEntry(type){
  const p=type==='receive'?'r':'g';
  const name=document.getElementById(p+'-na').value.trim();
  const amt=parseFloat(document.getElementById(p+'-am').value);
  const note=document.getElementById(p+'-no').value.trim()||'Entry';
  const dueVal=document.getElementById(p+'-due').value;
  if(!name||isNaN(amt)||amt<=0)return alert(LANG==='bn'?'সঠিক তথ্য দিন!':'Enter valid data!');
  
  let loanData=null;
  if(type==='receive'&&note.toLowerCase().includes('loan')){
    const fees=parseFeeString(document.getElementById('r-fee').value);
    const loanDate=document.getElementById('r-loan-date').value;
    loanData={fees,loanDate};
  }
  
  const ts=Date.now(),hist={id:ts,date:ts,amt,note,t:'add'};
  let person=DB[type].find(x=>x.name.toLowerCase()===name.toLowerCase());
  if(person){
    const wasSettled=person.remaining===0;
    if(wasSettled){
      person.original=amt;person.remaining=amt;
      person.clearedAt=ts;
      person.history.unshift(hist);
      if(loanData)person.loanData=loanData;
    } else {
      person.original+=amt;person.remaining+=amt;person.history.unshift(hist);
      if(loanData)person.loanData=loanData;
    }
  } else {
    DB[type].push({id:ts,name,original:amt,remaining:amt,history:[hist],loanData,dueDate:dueVal?new Date(dueVal).getTime():null});
  }
  document.getElementById(p+'-na').value='';
  document.getElementById(p+'-am').value='';
  document.getElementById(p+'-no').value='';
  document.getElementById(p+'-due').value='';
  if(type==='receive'){
    document.getElementById('r-fee').value='';
    document.getElementById('r-loan-date').value='';
    document.getElementById('r-loan-fields').style.display='none';
  }
  logActivity(`${type==='receive'?'পাওনা':'দেনা'} যোগ`,`${name} — ৳${fmt(amt)} (${note})`);
  saveData();render();toast(LANG==='bn'?'✅ যোগ হয়েছে!':'✅ Added!');
}
function openPay(type,id){
  const p=DB[type].find(x=>x.id===id);CTX={type,id};
  document.getElementById('m-pay-s').textContent=`${p.name} — Due: ৳${fmt(p.remaining)}`;
  document.getElementById('pa').value='';document.getElementById('pn').value='';
  renderQtags('pay-qtags','hisabPay','pn');
  document.getElementById('m-pay').classList.add('on');
}
function confirmPay(){
  const amt=parseFloat(document.getElementById('pa').value);
  const note=document.getElementById('pn').value||'Payment';
  if(isNaN(amt)||amt<=0)return;
  const p=DB[CTX.type].find(x=>x.id===CTX.id);
  
  const ts=Date.now();
  p.history.unshift({id:ts,date:ts,amt,note,t:'pay'});
  
  const breakdown = getLoanBreakdown(p);
  if(breakdown) {
    p.remaining = Math.max(0, breakdown.totalRepayment - breakdown.paidAmount);
  } else {
    p.remaining = Math.max(0, p.remaining - amt);
  }
  
  if(p.remaining===0) p.clearedAt=ts;
  logActivity('পরিশোধ',`${p.name} — ৳${fmt(amt)}`);
  cm('m-pay');saveData();render();toast(LANG==='bn'?'💸 পরিশোধ হয়েছে!':'💸 Recorded!');
}
function openAddMore(type,id){
  const p=DB[type].find(x=>x.id===id);CTX={type,id};
  document.getElementById('m-add-s').textContent=`${p.name} — Current: ৳${fmt(p.remaining)}`;
  document.getElementById('aa').value='';document.getElementById('an').value='';
  renderQtags('addmore-qtags', type==='receive'?'hisabReceive':'hisabGive', 'an');
  document.getElementById('m-add').classList.add('on');
}
function confirmAddMore(){
  const amt=parseFloat(document.getElementById('aa').value);
  const note=document.getElementById('an').value||'Added';
  if(isNaN(amt)||amt<=0)return;
  const p=DB[CTX.type].find(x=>x.id===CTX.id);
  const wasSettled=p.remaining===0;
  const ts=Date.now();
  const hist={id:ts,date:ts,amt,note,t:'add'};
  if(wasSettled){
    p.original=amt;
    p.remaining=amt;
    p.clearedAt=ts;
    p.history=[hist];
  } else {
    p.original+=amt;
    p.remaining+=amt;
    p.history.unshift(hist);
  }
  logActivity('পরিমাণ যোগ',`${p.name} — ৳${fmt(amt)}`);
  cm('m-add');saveData();render();toast(LANG==='bn'?'➕ যোগ হয়েছে!':'➕ Added!');
}
function openEdit(type,id){
  const p=DB[type].find(x=>x.id===id);CTX={type,id};
  const isLoan=p.loanData||p.history.some(h=>h.note.toLowerCase().includes('loan'));
  document.getElementById('ed-amt').value=p.original;
  document.getElementById('ed-name').value=p.name||'';
  document.getElementById('ed-due').value=p.dueDate?new Date(p.dueDate).toISOString().split('T')[0]:'';
  document.getElementById('m-edit-s').textContent=p.name;
  
  const loanWrap=document.getElementById('ed-loan-wrap');
  if(type==='receive'&&isLoan){
    loanWrap.style.display='block';
    document.getElementById('ed-fee').value=p.loanData?.fees||'';
    const loanDate=p.loanData?.loanDate?new Date(p.loanData.loanDate).toISOString().split('T')[0]:new Date(firstTs(p)).toISOString().split('T')[0];
    document.getElementById('ed-loan-date').value=loanDate;
    updateLoanCalcBreakdown(p);
  } else {
    loanWrap.style.display='none';
  }
  document.getElementById('m-edit').classList.add('on');
}
function updateLoanCalcBreakdown(p){
  const newAmt=parseFloat(document.getElementById('ed-amt').value)||p.original;
  const fees=parseFeeString(document.getElementById('ed-fee').value);
  const loanDateStr=document.getElementById('ed-loan-date').value;
  const calc=calculateLoanTotal(newAmt,fees,loanDateStr);

  const scheduleRows=calc.schedule.map(s=>`
    <tr>
      <td style="padding:4px 6px;text-align:center;">${s.month}</td>
      <td style="padding:4px 6px;text-align:right;">৳${fmt(Math.round(s.openingBal))}</td>
      <td style="padding:4px 6px;text-align:right;color:#f97316;">৳${fmt(Math.round(s.interest))}</td>
      <td style="padding:4px 6px;text-align:right;color:var(--primary);">৳${fmt(Math.round(s.principalPart))}</td>
      <td style="padding:4px 6px;text-align:right;font-weight:700;">৳${fmt(Math.round(s.emi))}</td>
    </tr>`).join('');

  const html=`
    <div>💵 Principal: ৳${fmt(newAmt)}</div>
    <div>📅 Days Passed: ${calc.daysToCharge}/90</div>
    <div>📈 Full Interest (×0.030823): ৳${fmt(Math.round(calc.fullInterest))}</div>
    <div>⚙️ Processing Fee (×0.00575): ৳${fmt(calc.processingFee)}</div>
    <div>💸 Extra Fees: ৳${fmt(fees)}</div>
    <div style="margin-top:8px;">
      <div style="font-weight:700;color:var(--primary);margin-bottom:4px;">🗓️ EMI Schedule (Reducing Balance)</div>
      <table style="width:100%;border-collapse:collapse;font-size:11px;">
        <thead><tr style="color:var(--muted);">
          <th style="padding:3px 6px;">Mo.</th>
          <th style="padding:3px 6px;">Opening</th>
          <th style="padding:3px 6px;">Interest</th>
          <th style="padding:3px 6px;">Principal</th>
          <th style="padding:3px 6px;">EMI</th>
        </tr></thead>
        <tbody>${scheduleRows}</tbody>
      </table>
    </div>
  `;
  document.getElementById('ed-calc-breakdown').innerHTML=html;
  document.getElementById('ed-total-due').textContent=fmt(Math.round(calc.totalRepayment));
}
function confirmEdit(){
  const amt=parseFloat(document.getElementById('ed-amt').value);
  if(isNaN(amt)||amt<=0)return alert(LANG==='bn'?'সঠিক তথ্য দিন!':'Enter valid data!');
  const p=DB[CTX.type].find(x=>x.id===CTX.id);
  const oldAmt=p.original;
  const newName=document.getElementById('ed-name').value.trim();
  const dueVal=document.getElementById('ed-due').value;
  if(newName)p.name=newName;
  p.original=amt;
  p.remaining=p.remaining+(amt-oldAmt);
  p.dueDate=dueVal?new Date(dueVal).getTime():null;
  
  if(CTX.type==='receive'&&(p.loanData||p.history.some(h=>h.note.toLowerCase().includes('loan')))){
    const fees=parseFeeString(document.getElementById('ed-fee').value);
    const loanDate=document.getElementById('ed-loan-date').value;
    if(!p.loanData)p.loanData={};
    p.loanData.fees=fees;
    p.loanData.loanDate=loanDate;
  }
  
  logActivity('এন্ট্রি এডিট',`${p.name} — ৳${oldAmt} → ৳${amt}`);
  cm('m-edit');saveData();render();toast(LANG==='bn'?'✏️ সংশোধন হয়েছে!':'✏️ Updated!');
}
function deleteEntry(type,id){
  const p=DB[type].find(x=>x.id===id);
  if(!p)return;
  const idx=DB[type].findIndex(x=>x.id===id);
  const snapshot=JSON.parse(JSON.stringify(p));
  logActivity('এন্ট্রি ডিলিট',p.name);
  DB[type]=DB[type].filter(x=>x.id!==id);
  saveData();render();
  toast(LANG==='bn'?`🗑️ "${p.name}" ডিলিট হয়েছে`:`🗑️ "${p.name}" deleted`,()=>{
    DB[type].splice(Math.min(idx,DB[type].length),0,snapshot);
    saveData();render();toast(LANG==='bn'?'↩️ ফিরিয়ে আনা হয়েছে':'↩️ Restored');
  });
}

// ── WHATSAPP ──
function copyWA(type,id){
  const p=DB[type].find(x=>x.id===id);
  const d=ageDays(p);
  const recent=p.history.slice(0,5);
  const breakdown=getLoanBreakdown(p);
  let remAmt=p.remaining;
  if(type==='receive'&&breakdown){
    remAmt=breakdown.totalRepayment-breakdown.paidAmount;
  }
  let t=`🧾 হিসাব | ${p.name}\n\n`;
  t+=`💵 পাওয়া: ৳${fmt(remAmt)}\n`;
  t+=`📅 বকেয়া: ${d} দিন\n`;
  if(recent.length){
    t+=`\nHistory:\n`;
    recent.forEach(h=>{
      const sign=h.t==='add'?'+':'-';
      t+=`${fmtD(h.date)} — ${h.note}: ${sign}৳${fmt(h.amt)}\n`;
    });
  }
  if(p.history.length>5) t+=`আরো ${p.history.length-5}টি\n`;
  t+=`\n— Hisab Tracker PRO`;
  const cp=()=>{const ta=document.createElement('textarea');ta.value=t;document.body.appendChild(ta);ta.select();document.execCommand('copy');document.body.removeChild(ta);toast('📋 Copied!');};
  navigator.clipboard?navigator.clipboard.writeText(t).then(()=>toast('📋 Copied!')).catch(cp):cp();
}

// ── RENDER CARD ──
function renderCard(p,type){
  const settled=p.remaining<=0;
  if(settled&&TAB!=='a')return'';
  const d=ageDays(p),b=ageBadge(d);
  const ageLbl=settled?(LANG==='bn'?'✅ শোধ হয়েছে':'✅ Settled'):(LANG==='bn'?`বকেয়া ${b.l}`:`Pending ${b.l}`);
  const col=type==='receive'?'var(--green)':'var(--red)';
  
  let displayAmt=p.remaining;
  let loanBreakdownHtml='';
  let pct=p.original>0?Math.round(Math.max(0,Math.min(100,(1-p.remaining/p.original)*100))):0;
  
  if(type==='receive'){
    const breakdown=getLoanBreakdown(p);
    if(breakdown){
      displayAmt=breakdown.dailyAmount;
      pct=breakdown.progressPercent;
      
      loanBreakdownHtml=`<div style="margin-top:10px;border-radius:12px;overflow:hidden;border:1px solid var(--border);font-size:12px;">

        <!-- Header -->
        <div style="background:var(--card);padding:8px 12px;display:flex;justify-content:space-between;align-items:center;border-bottom:1px solid var(--border);">
          <span style="font-weight:700;color:var(--primary);font-size:13px;">🏦 Loan Details</span>
          <span style="font-weight:700;color:var(--muted);font-size:11px;background:rgba(255,255,255,0.06);padding:2px 8px;border-radius:20px;">📅 ${breakdown.daysToCharge}/90 days</span>
        </div>

        <!-- Stats grid -->
        <div style="display:grid;grid-template-columns:1fr 1fr;background:var(--bg);">
          <div style="padding:10px 12px;border-right:1px solid var(--border);border-bottom:1px solid var(--border);">
            <div style="color:var(--muted);font-size:10px;text-transform:uppercase;letter-spacing:.5px;margin-bottom:2px;">Principal</div>
            <div style="font-weight:800;font-size:14px;">৳${fmt(p.original)}</div>
          </div>
          <div style="padding:10px 12px;border-bottom:1px solid var(--border);">
            <div style="color:var(--muted);font-size:10px;text-transform:uppercase;letter-spacing:.5px;margin-bottom:2px;">Paid</div>
            <div style="font-weight:800;font-size:14px;color:var(--green);">৳${fmt(breakdown.paidAmount)}</div>
          </div>
          <div style="padding:10px 12px;border-right:1px solid var(--border);border-bottom:1px solid var(--border);">
            <div style="color:var(--muted);font-size:10px;text-transform:uppercase;letter-spacing:.5px;margin-bottom:2px;">Remaining Principal</div>
            <div style="font-weight:800;font-size:14px;color:var(--primary);">৳${fmt(breakdown.remainingPrincipal)}</div>
          </div>
          <div style="padding:10px 12px;border-bottom:1px solid var(--border);">
            <div style="color:var(--muted);font-size:10px;text-transform:uppercase;letter-spacing:.5px;margin-bottom:2px;">Current Interest</div>
            <div style="font-weight:800;font-size:14px;color:var(--text);">৳${fmt(breakdown.interest)}</div>
          </div>
          <div style="padding:10px 12px;border-right:1px solid var(--border);">
            <div style="color:var(--muted);font-size:10px;text-transform:uppercase;letter-spacing:.5px;margin-bottom:2px;">Full Interest</div>
            <div style="font-weight:800;font-size:14px;color:var(--text);">৳${fmt(breakdown.fullInterest)}</div>
          </div>
          <div style="padding:10px 12px;">
            <div style="color:var(--muted);font-size:10px;text-transform:uppercase;letter-spacing:.5px;margin-bottom:2px;">Processing Fee</div>
            <div style="font-weight:800;font-size:14px;color:var(--text);">৳${fmt(breakdown.processingFee)}</div>
          </div>
        </div>

        <!-- This Month Due -->
        <div style="background:var(--card);padding:10px 12px;border-top:1px solid var(--border);display:flex;justify-content:space-between;align-items:center;">
          <div>
            <div style="color:var(--muted);font-size:10px;text-transform:uppercase;letter-spacing:.5px;margin-bottom:2px;">Month ${breakdown.currentMonthIndex+1}/3 — EMI ৳${fmt(breakdown.monthlyEMI)}</div>
            <div style="font-weight:700;font-size:13px;color:var(--text);">📅 This Month Due</div>
          </div>
          <div style="font-weight:900;font-size:18px;color:${breakdown.thisMonthDue===0?'var(--green)':'var(--primary)'};">৳${fmt(breakdown.thisMonthDue)}${breakdown.thisMonthDue===0?' ✅':''}</div>
        </div>

        <!-- Remaining Payable -->
        <div style="background:var(--card);padding:10px 12px;border-top:1px solid var(--border);display:flex;justify-content:space-between;align-items:center;">
          <div style="font-weight:700;font-size:13px;color:var(--text);">⏳ Remaining Payable</div>
          <div style="font-weight:900;font-size:18px;color:#f97316;">৳${fmt(Math.max(0,breakdown.totalRepayment-breakdown.paidAmount))}</div>
        </div>

        <!-- Max Payable -->
        <div style="background:rgba(56,189,248,0.05);padding:10px 12px;border-top:1px solid var(--border);display:flex;justify-content:space-between;align-items:center;">
          <div style="font-weight:700;font-size:13px;color:var(--muted);">📊 Max Payable (3 months)</div>
          <div style="font-weight:900;font-size:18px;color:var(--green);">৳${fmt(breakdown.totalRepayment)}</div>
        </div>

      </div>`;
    }
  }
  
  const cardId='card-'+p.id;
  return `<div class="pcard${settled?' settled':''}" id="${cardId}" data-id="${p.id}" data-type="${type}">
    <div class="swipe-action left"><span class="swipe-action-icon">➕</span><span class="swipe-action-lbl">${LANG==='bn'?'যোগ':'Add'}</span></div>
    <div class="swipe-action right"><span class="swipe-action-icon">💸</span><span class="swipe-action-lbl">${LANG==='bn'?'শোধ':'Pay'}</span></div>
    <div class="pcard-inner">
    <div class="pt" onclick="this.nextElementSibling.classList.toggle('on')">
      <div class="pt-l">
        <div class="pname">${p.name}</div>
        <div class="pbadge ${settled?'':b.cls}">${ageLbl}</div>
      </div>
      <div class="pt-r">
        <div class="pamt" style="color:${col}">৳${fmt(displayAmt)}</div>
        <div class="pbar-wrap">
          <div class="pbar"><div class="pbar-fill" style="width:${pct}%;background:${col}"></div></div>
          <div class="pbar-lbl">${pct}% ${LANG==='bn'?'শোধ':'paid'}</div>
        </div>
      </div>
    </div>
    <div class="pbody">
      <div class="psum">
        <div class="ps-i"><div class="ps-l bn">মূল</div><div class="ps-l en">Original</div><div class="ps-v" style="color:${col}">৳${fmt(p.original)}</div></div>
        <div class="ps-i"><div class="ps-l bn">শোধ</div><div class="ps-l en">Paid</div><div class="ps-v" style="color:var(--green)">৳${fmt(type==='receive'&&getLoanBreakdown(p)?getLoanBreakdown(p).paidAmount:(p.original-p.remaining))}</div></div>
        <div class="ps-i"><div class="ps-l bn">লেনদেন</div><div class="ps-l en">Txns</div><div class="ps-v">${p.history.length}</div></div>
      </div>
      ${loanBreakdownHtml}
      <div class="arow">
        <button class="btn-a btn-pay" onclick="openPay('${type}',${p.id})"><svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 5v14"/><path d="m19 12-7 7-7-7"/></svg><span class="bn">শোধ</span><span class="en">Pay</span></button>
        <button class="btn-a btn-add-more" onclick="openAddMore('${type}',${p.id})"><svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12h14"/><path d="M12 5v14"/></svg><span class="bn">যোগ</span><span class="en">Add</span></button>
        <button class="btn-a" onclick="openEdit('${type}',${p.id})"><svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4Z"/></svg><span class="bn">এডিট</span><span class="en">Edit</span></button>
        <button class="btn-a btn-copy" onclick="copyWA('${type}',${p.id})"><svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect width="14" height="14" x="8" y="8" rx="2" ry="2"/><path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2"/></svg></button>
        <button class="btn-a btn-del-bold" onclick="deleteEntry('${type}',${p.id})"><svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M3 6h18"/><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"/><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"/></svg></button>
      </div>
      <div class="hh" style="margin-top:14px;">HISTORY</div>
      ${p.history.slice(0,5).map(h=>`<div class="hi ${h.t==='add'?'ar':'pr'}"><span>${fmtD(h.date)} — ${h.note}</span><b style="color:var(--${h.t==='add'?'green':'red'})">${h.t==='add'?'+':'-'} ৳${fmt(h.amt)}</b></div>`).join('')}
      ${p.history.length>5?`<div style="font-size:11px;color:var(--muted);text-align:center;margin-top:6px;">+${p.history.length-5} more</div>`:''}
    </div>
    </div>
  </div>`;
}
function emptyS(bn,en,ic){return`<div class="empty"><div class="empty-i" style="color:var(--muted)">${ic}</div><div class="empty-t"><span class="bn">${bn}</span><span class="en">${en}</span></div></div>`;}

// ── TOP LISTS ──
function renderTop(){
  const q=document.getElementById('srch').value.toLowerCase().trim();
  const mk=(list,col,bnt,ent)=>{
    if(!list.length)return'';
    return`<div class="top-s"><div class="top-sh"><span class="bn">${bnt}</span><span class="en">${ent}</span></div>${list.map((p,i)=>{const b=ageBadge(ageDays(p));return`<div class="top-row"><span class="top-rank">#${i+1}</span><span class="top-name">${p.name}</span><span class="top-age ${b.cls}">${b.l}</span><span class="top-amt" style="color:${col}">৳${fmt(p.remaining)}</span></div>`;}).join('')}</div>`;
  };
  const tR=[...DB.receive].filter(p=>p.remaining>0&&(!q||p.name.toLowerCase().includes(q))).sort((a,b)=>b.remaining-a.remaining).slice(0,5);
  const tG=[...DB.give].filter(p=>p.remaining>0&&(!q||p.name.toLowerCase().includes(q))).sort((a,b)=>b.remaining-a.remaining).slice(0,5);
  document.getElementById('top-lists').innerHTML=mk(tR,'var(--green)','🏆 সর্বোচ্চ পাওনাদার','🏆 Top Receivables')+mk(tG,'var(--red)','🏆 সর্বোচ্চ দেনাদার','🏆 Top Payables');
}

// ── MAIN RENDER ──
function render(){
  const q=document.getElementById('srch').value.toLowerCase().trim();
  
  const tr=DB.receive.reduce((s,p)=>{
    const breakdown=getLoanBreakdown(p);
    if(breakdown){
      let currentPayable=breakdown.totalRepayment-breakdown.paidAmount;
      if(currentPayable<0) currentPayable=0;
      return s+currentPayable;
    }
    return s+p.remaining;
  },0);
  
  const tg=DB.give.reduce((s,p)=>s+p.remaining,0);
  const net=tr-tg;
  const rc=DB.receive.filter(p=>p.remaining>0).length;
  const gc=DB.give.filter(p=>p.remaining>0).length;
  if(tr!==pTr)countUp(document.getElementById('sv-r'),tr,'৳');
  if(tg!==pTg)countUp(document.getElementById('sv-g'),tg,'৳');
  if(net!==pNet)countUp(document.getElementById('sv-n'),Math.abs(net),(net>0?'+':net<0?'-':'')+'৳');
  pTr=tr;pTg=tg;pNet=net;
  document.getElementById('sv-r-c').textContent=LANG==='bn'?`${rc} জনের কাছে`:`${rc} people`;
  document.getElementById('sv-g-c').textContent=LANG==='bn'?`${gc} জনকে`:`${gc} people`;
  const nv=document.getElementById('sv-n');
  nv.style.color=net>0?'var(--green)':net<0?'var(--red)':'var(--yellow)';
  const nc=document.getElementById('net-card');
  nc.className='sc-net '+(net>0?'pos':net<0?'neg':'zero');
  const ns=document.getElementById('sv-n-s'),ni=document.getElementById('net-ic');
  if(net>0){ns.textContent=LANG==='bn'?'▲ আপনি পাবেন':'▲ In your favor';ni.innerHTML=`<svg xmlns="http://www.w3.org/2000/svg" width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><polyline points="23 6 13.5 15.5 8.5 10.5 1 18"/><polyline points="17 6 23 6 23 12"/></svg>`;}
  else if(net<0){ns.textContent=LANG==='bn'?'▼ আপনি দেবেন':'▼ You owe more';ni.innerHTML=`<svg xmlns="http://www.w3.org/2000/svg" width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><polyline points="23 18 13.5 8.5 8.5 13.5 1 6"/><polyline points="17 18 23 18 23 12"/></svg>`;}
  else{ns.textContent=LANG==='bn'?'= সমান':'= Balanced';ni.innerHTML=`<svg xmlns="http://www.w3.org/2000/svg" width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M5 9h14M5 15h14"/></svg>`;}
  renderTop();
  const fl=list=>q?list.filter(p=>p.name.toLowerCase().includes(q)):list;
  const sR=fl([...DB.receive].filter(p=>p.remaining>0)).sort((a,b)=>b.remaining-a.remaining);
  const shR=SA.r?sR:sR.slice(0,3);
  document.getElementById('lst-r').innerHTML=shR.map(p=>renderCard(p,'receive')).filter(Boolean).join('')||emptyS('কোনো পাওনা নেই','No receivables','<svg xmlns="http://www.w3.org/2000/svg" width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="22 12 16 12 14 15 10 15 8 12 2 12"/><path d="M5.45 5.11 2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6l-3.45-6.89A2 2 0 0 0 16.76 4H7.24a2 2 0 0 0-1.79 1.11z"/></svg>');
  shR.forEach(p=>{const el=document.getElementById('card-'+p.id);if(el)initSwipe(el,'receive',p.id);});
  const bR=document.getElementById('sa-r');
  bR.style.display=sR.length>3?'inline-flex':'none';
  bR.querySelector('.bn').textContent=SA.r?'কম দেখুন':`সব দেখুন (${sR.length})`;
  bR.querySelector('.en').textContent=SA.r?'Show Less':`See All (${sR.length})`;
  const sG=fl([...DB.give].filter(p=>p.remaining>0)).sort((a,b)=>b.remaining-a.remaining);
  const shG=SA.g?sG:sG.slice(0,3);
  document.getElementById('lst-g').innerHTML=shG.map(p=>renderCard(p,'give')).filter(Boolean).join('')||emptyS('কোনো দেনা নেই','No payables','<svg xmlns="http://www.w3.org/2000/svg" width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>');
  shG.forEach(p=>{const el=document.getElementById('card-'+p.id);if(el)initSwipe(el,'give',p.id);});
  const bG=document.getElementById('sa-g');
  bG.style.display=sG.length>3?'inline-flex':'none';
  bG.querySelector('.bn').textContent=SA.g?'কম দেখুন':`সব দেখুন (${sG.length})`;
  bG.querySelector('.en').textContent=SA.g?'Show Less':`See All (${sG.length})`;
  if(TAB==='a') renderAll();
}

// ── BACKUP ──
function exportData(){const b=new Blob([JSON.stringify(DB)],{type:'application/json'});const a=document.createElement('a');a.href=URL.createObjectURL(b);a.download='hisab_backup.json';a.click();}
function triggerImport(){document.getElementById('importFile').click();}
function handleImport(e){
  const r=new FileReader();
  r.onload=ev=>{
    try{
      DB=JSON.parse(ev.target.result);
      if(!DB.activityLog)DB.activityLog=[];
      logActivity('Backup import করা হয়েছে');
      saveData();render();toast('✅ Imported!');
    }catch{toast('❌ Invalid file!');}
  };
  r.readAsText(e.target.files[0]);
}

document.addEventListener('DOMContentLoaded',()=>{
  const noteField=document.getElementById('r-no');
  if(noteField){
    noteField.addEventListener('input',updateLoanNoteFields);
  }
  const edAmtField=document.getElementById('ed-amt');
  const edFeeField=document.getElementById('ed-fee');
  const edDateField=document.getElementById('ed-loan-date');
  if(edAmtField){
    edAmtField.addEventListener('input',()=>{
      const p=DB[CTX.type]?.find(x=>x.id===CTX.id);
      if(p&&(p.loanData||p.history.some(h=>h.note.toLowerCase().includes('loan'))))updateLoanCalcBreakdown(p);
    });
  }
  if(edFeeField){
    edFeeField.addEventListener('input',()=>{
      const p=DB[CTX.type]?.find(x=>x.id===CTX.id);
      if(p)updateLoanCalcBreakdown(p);
    });
  }
  if(edDateField){
    edDateField.addEventListener('input',()=>{
      const p=DB[CTX.type]?.find(x=>x.id===CTX.id);
      if(p)updateLoanCalcBreakdown(p);
    });
  }
  setInterval(()=>{
    const now=new Date();
    if(now.getHours()===0&&now.getMinutes()<1){
      saveData();
      render();
    }
  },60000);
});
