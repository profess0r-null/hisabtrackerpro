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
function setAppTab(tab){
  if(tab==='menu'){
    openDrawer();
    return;
  }
  if(tab==='analytics'){
    openAnalytics();
    return;
  }
  APP_MODE=tab;
  localStorage.setItem('ht_mode',APP_MODE);
  applyMode();
}
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
  // Bottom nav sync
  const bHisab=document.getElementById('bnav-hisab');
  const bCash=document.getElementById('bnav-cash');
  if(bHisab) bHisab.classList.toggle('on', isHisab);
  if(bCash) bCash.classList.toggle('on', !isHisab);
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
  const overdueR=0;
  const overdueG=0;

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
        </div>
        <div style="background:rgba(239,68,68,.08);border-radius:10px;padding:10px;">
          <div style="font-size:10px;color:var(--red);font-weight:700;text-transform:uppercase;margin-bottom:3px;">মোট দেনা</div>
          <div style="font-size:16px;font-weight:900;color:var(--red);">৳${fmt(totalGive)}</div>
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
let _dataLoaded = false;
async function showApp(){
  document.getElementById('app').style.display='block';
  setSyncState('saving','Loading...');
  (async()=>{try{await sb.from('visits').insert({user_agent:navigator.userAgent,logged_in:true});}catch(e){}})();
  await loadData();
  await loadCashDataCloud();
  logActivity('Login সফল',CUR_USER.email);
  
  if (_dataLoaded) {
    await saveData(true); // true = login toast
  } else {
    toast('⚠️ Offline / Error: Using local data');
    setSyncState('fail', 'Offline');
  }
  
  applyMode();
  render();
  renderAllQtags();
  // set today default for hisab due dates
  const today=localDateStr();
  ['r-due','g-due'].forEach(id=>{const el=document.getElementById(id);if(el){el.value=today;el.classList.add('has-val');}});
  // floating label: track has-val on all cf-inputs
  document.querySelectorAll('.cf-input').forEach(inp=>{
    inp.addEventListener('input',()=>inp.classList.toggle('has-val',inp.value.length>0));
    inp.addEventListener('change',()=>inp.classList.toggle('has-val',inp.value.length>0));
    if(inp.value.length>0) inp.classList.add('has-val');
  });
}
async function loadData(){
  try {
    const{data,error}=await sb.from('hisab_users').select('data').eq('id',CUR_USER.id).maybeSingle();
    if(data&&data.data){
      DB=data.data;
      if(!DB.receive)DB.receive=[];
      if(!DB.give)DB.give=[];
      if(!DB.activityLog)DB.activityLog=[];
      if(!DB.categories)DB.categories={};
      // PIN cloud থেকে localStorage এ sync
      if(DB.pinHash) localStorage.setItem(pk(),DB.pinHash);
      _dataLoaded = true;
    }else if(!error){
      await sb.from('hisab_users').insert({id:CUR_USER.id,data:DB});
      _dataLoaded = true;
    } else {
      throw error;
    }
  } catch(e) {
    // fallback to local storage
    const raw = localStorage.getItem('ht_'+CUR_USER.id);
    if(raw) {
      try { DB = JSON.parse(raw); } catch(e2) {}
    }
    _dataLoaded = false;
  }
}
let _retrySyncTimeout=null;
async function saveData(showLoginToast=false){
  if(_retrySyncTimeout) { clearTimeout(_retrySyncTimeout); _retrySyncTimeout=null; }
  setSyncState('saving','Saving...');
  localStorage.setItem('ht_'+CUR_USER.id,JSON.stringify(DB));
  try{
    const { error } = await sb.from('hisab_users').upsert({id:CUR_USER.id,data:DB,updated_at:new Date().toISOString()});
    if(error) throw error;
    if(showLoginToast){
      toast(LANG==='bn'?'👋 স্বাগতম!':'👋 Welcome!');
    }
    setSyncState('synced');
  }catch(e){
    setSyncState('fail','Sync failed ✕');
    _retrySyncTimeout = setTimeout(()=>saveData(), 5000);
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
  if(window._retryCashSync) { clearTimeout(window._retryCashSync); window._retryCashSync=null; }
  localStorage.setItem(cashKey(),JSON.stringify(CASH_DB));
  // cloud sync async
  if(CUR_USER){
    setSyncState('saving','Saving...');
    sb.from('hisab_cash').upsert({id:CUR_USER.id,data:CASH_DB,updated_at:new Date().toISOString()}).then(({error})=>{
      if(error){
        setSyncState('fail','Sync failed ✕');
        window._retryCashSync = setTimeout(()=>saveCashData(), 5000);
      } else {
        setSyncState('synced');
      }
    });
  }
}

// ── EXPENSE TRACKER PRO METADATA & DATA STRUCTURES ──
let CASH_SELECTED_MONTH = new Date().toISOString().slice(0, 7);
let CASH_TIME_FILTER = 'month'; // 'month' | 'last_month' | 'all'
let WALLET_FILTER = 'all';
let SELECTED_FORM_WALLET = 'cash';
let SELECTED_FORM_CAT = '';
let SELECTED_QA_WALLET = 'cash';
let SELECTED_QA_CAT = '';
let QA_MODE = 'sub';
let TF_FROM_WALLET = 'bank';
let TF_TO_WALLET = 'bkash';

const WALLET_META = {
  cash:  { name: 'নগদ', en: 'Cash', icon: '💵', color: '#10b981' },
  bkash: { name: 'বিকাশ', en: 'bKash', icon: '📱', color: '#e11d48' },
  nagad: { name: 'নগদ (Nagad)', en: 'Nagad', icon: '📱', color: '#f97316' },
  bank:  { name: 'ব্যাংক', en: 'Bank', icon: '🏦', color: '#3b82f6' }
};

const EXPENSE_CATEGORIES = [
  { id: 'food', e: '🍔', bn: 'খাবার', en: 'Food', color: '#f97316' },
  { id: 'transport', e: '🚌', bn: 'যাতায়াত', en: 'Transport', color: '#3b82f6' },
  { id: 'rent', e: '🏠', bn: 'বাসা ভাড়া', en: 'Rent', color: '#a855f7' },
  { id: 'bills', e: '💡', bn: 'বিল / রিচার্জ', en: 'Bills', color: '#06b6d4' },
  { id: 'shopping', e: '🛍️', bn: 'কেনাকাটা', en: 'Shopping', color: '#ec4899' },
  { id: 'health', e: '💊', bn: 'ওষুধ / স্বাস্থ্য', en: 'Health', color: '#ef4444' },
  { id: 'education', e: '🎓', bn: 'শিক্ষা', en: 'Education', color: '#6366f1' },
  { id: 'entertainment', e: '🍿', bn: 'বিনোদন', en: 'Entertainment', color: '#10b981' },
  { id: 'family', e: '👨‍👩‍👧', bn: 'পরিবার', en: 'Family', color: '#eab308' },
  { id: 'other', e: '📦', bn: 'অন্যান্য', en: 'Other', color: '#64748b' }
];

const INCOME_CATEGORIES = [
  { id: 'salary', e: '💼', bn: 'বেতন', en: 'Salary', color: '#10b981' },
  { id: 'business', e: '📈', bn: 'ব্যবসা', en: 'Business', color: '#06b6d4' },
  { id: 'bonus', e: '🎁', bn: 'বোনাস', en: 'Bonus', color: '#f59e0b' },
  { id: 'freelance', e: '💻', bn: 'ফ্রিল্যান্সিং', en: 'Freelance', color: '#8b5cf6' },
  { id: 'gift', e: '🤝', bn: 'উপহার / সাহায্য', en: 'Gift', color: '#ec4899' },
  { id: 'other_in', e: '💰', bn: 'অন্যান্য আয়', en: 'Other', color: '#3b82f6' }
];

function ensureWallets(){
  if(!CASH_DB.wallets){
    CASH_DB.wallets = {
      cash: CASH_DB.balance || 0,
      bkash: 0,
      nagad: 0,
      bank: 0
    };
  }
}

// ── 2.1 MULTI-WALLET RENDERING & TRANSFERS ──
function renderWallets(){
  ensureWallets();
  const grid = document.getElementById('wallets-grid');
  if(!grid) return;
  const w = CASH_DB.wallets;
  const keys = ['cash', 'bkash', 'nagad', 'bank'];
  grid.innerHTML = keys.map(k => {
    const meta = WALLET_META[k];
    const isAct = WALLET_FILTER === k;
    const amt = w[k] || 0;
    return `
      <div class="wallet-card ${isAct ? 'active' : ''}" onclick="toggleWalletFilter('${k}')">
        <div class="wcard-top">
          <span class="wcard-icon">${meta.icon}</span>
          <span class="wcard-name">${LANG==='bn'?meta.name:meta.en}</span>
        </div>
        <div class="wcard-amt">৳${fmt(amt)}</div>
      </div>
    `;
  }).join('');
}

function toggleWalletFilter(k){
  if(WALLET_FILTER === k){
    WALLET_FILTER = 'all';
    toast(LANG==='bn'?'সব ওয়ালেটের লেনদেন প্রদর্শিত হচ্ছে':'Showing all wallets');
  } else {
    WALLET_FILTER = k;
    const meta = WALLET_META[k];
    toast(`${meta.icon} ${LANG==='bn'?meta.name:meta.en} ফিল্টার করা হয়েছে`);
  }
  renderCash();
}

function openTransferModal(){
  ensureWallets();
  document.getElementById('tf-amt').value = '';
  document.getElementById('tf-note').value = '';
  selectTransferWallet('from', 'bank');
  selectTransferWallet('to', 'bkash');
  document.getElementById('m-transfer').classList.add('on');
}

function selectTransferWallet(type, w, btn){
  if(type === 'from'){
    TF_FROM_WALLET = w;
    document.querySelectorAll('#tf-from-row .wsel-btn').forEach(b => b.classList.toggle('on', b.dataset.w === w));
  } else {
    TF_TO_WALLET = w;
    document.querySelectorAll('#tf-to-row .wsel-btn').forEach(b => b.classList.toggle('on', b.dataset.w === w));
  }
}

function confirmTransfer(){
  const amt = parseFloat(document.getElementById('tf-amt').value);
  const note = document.getElementById('tf-note').value.trim() || (LANG==='bn'?'ওয়ালেট ফান্ড ট্রান্সফার':'Wallet Fund Transfer');
  if(!amt || amt <= 0){
    toast('❌ সঠিক পরিমাণ দিন!');
    return;
  }
  if(TF_FROM_WALLET === TF_TO_WALLET){
    toast('❌ প্রেরক ও প্রাপক অ্যাকাউন্ট একই হতে পারে না!');
    return;
  }
  ensureWallets();
  if((CASH_DB.wallets[TF_FROM_WALLET] || 0) < amt){
    toast('❌ প্রেরক অ্যাকাউন্টে পর্যাপ্ত ব্যালেন্স নেই!');
    return;
  }
  CASH_DB.wallets[TF_FROM_WALLET] -= amt;
  CASH_DB.wallets[TF_TO_WALLET] = (CASH_DB.wallets[TF_TO_WALLET] || 0) + amt;
  const ts = Date.now();
  const fromMeta = WALLET_META[TF_FROM_WALLET];
  const toMeta = WALLET_META[TF_TO_WALLET];
  const transferDesc = `${fromMeta.icon} ${fromMeta.name} → ${toMeta.icon} ${toMeta.name} (${note})`;
  CASH_DB.history.unshift({
    id: ts,
    type: 'transfer',
    amt: amt,
    fromWallet: TF_FROM_WALLET,
    toWallet: TF_TO_WALLET,
    wallet: TF_FROM_WALLET,
    note: transferDesc,
    date: ts
  });
  saveCashData();
  cm('m-transfer');
  renderCash();
  toast(`✅ ৳${fmt(amt)} ট্রান্সফার সফল হয়েছে!`);
}

// ── 3.2 QUICK AMOUNT CHIPS ──
function addQuickAmount(val, targetId = 'cash-amt'){
  const input = document.getElementById(targetId);
  if(!input) return;
  if(val === 'clear'){
    input.value = '';
    input.classList.remove('has-val');
    return;
  }
  const curr = parseFloat(input.value) || 0;
  input.value = curr + val;
  input.classList.add('has-val');
}

// ── 2.2 CATEGORY GRID & SELECTION ──
function selectFormWallet(w, btn){
  SELECTED_FORM_WALLET = w;
  document.querySelectorAll('#form-wallet-row .wsel-btn').forEach(b => b.classList.toggle('on', b.dataset.w === w));
}

function renderFormCategories(mode, containerId = 'form-cat-grid', activeCat = ''){
  const el = document.getElementById(containerId);
  if(!el) return;
  const cats = mode === 'add' ? INCOME_CATEGORIES : EXPENSE_CATEGORIES;
  if(!activeCat && cats.length) activeCat = cats[0].id;
  if(containerId === 'form-cat-grid') SELECTED_FORM_CAT = activeCat;
  else SELECTED_QA_CAT = activeCat;

  el.innerHTML = cats.map(c => `
    <div class="cat-tile ${c.id === activeCat ? 'on' : ''}" onclick="selectCategoryTile('${c.id}', '${containerId}')">
      <span class="cat-tile-icon">${c.e}</span>
      <span class="cat-tile-name">${LANG === 'bn' ? c.bn : c.en}</span>
    </div>
  `).join('');
}

function selectCategoryTile(catId, containerId){
  const isForm = containerId === 'form-cat-grid';
  const isAdd = isForm ? cashFormMode === 'add' : QA_MODE === 'add';
  const cats = isAdd ? INCOME_CATEGORIES : EXPENSE_CATEGORIES;
  const c = cats.find(x => x.id === catId);
  if(isForm){
    SELECTED_FORM_CAT = catId;
    const noteInput = document.getElementById('cash-note');
    if(noteInput && (!noteInput.value.trim() || cats.some(x => x.bn === noteInput.value || x.en === noteInput.value))){
      noteInput.value = LANG === 'bn' ? c.bn : c.en;
      noteInput.classList.add('has-val');
    }
  } else {
    SELECTED_QA_CAT = catId;
    const noteInput = document.getElementById('qa-note');
    if(noteInput && (!noteInput.value.trim() || cats.some(x => x.bn === noteInput.value || x.en === noteInput.value))){
      noteInput.value = LANG === 'bn' ? c.bn : c.en;
    }
  }
  const container = document.getElementById(containerId);
  if(container){
    container.querySelectorAll('.cat-tile').forEach((t, i) => {
      t.classList.toggle('on', cats[i] && cats[i].id === catId);
    });
  }
}

// ── 3.1 QUICK ADD BOTTOM SHEET ──
function openQuickAddSheet(){
  setQuickAddType('sub');
  document.getElementById('qa-amt').value = '';
  document.getElementById('qa-note').value = '';
  document.getElementById('qa-name').value = '';
  document.getElementById('m-quickadd').classList.add('on');
  setTimeout(() => {
    const el = document.getElementById('qa-amt');
    if(el) el.focus();
  }, 180);
}

function setQuickAddType(t){
  QA_MODE = t;
  const tabSub = document.getElementById('qa-tab-sub');
  const tabAdd = document.getElementById('qa-tab-add');
  const tabHisab = document.getElementById('qa-tab-hisab');
  const noteWrap = document.getElementById('qa-note-wrap');
  const nameWrap = document.getElementById('qa-name-wrap');
  const walletSec = document.getElementById('qa-wallet-sec');
  const catSec = document.getElementById('qa-cat-sec');
  const subBtn = document.getElementById('qa-submit-btn');

  tabSub.classList.toggle('on', t === 'sub');
  tabAdd.classList.toggle('on', t === 'add');
  tabHisab.classList.toggle('on', t === 'hisab');

  if(t === 'hisab'){
    nameWrap.style.display = 'block';
    noteWrap.style.display = 'block';
    walletSec.style.display = 'none';
    catSec.style.display = 'none';
    subBtn.className = 'sbtn sbtn-g';
    subBtn.innerHTML = '<span class="bn">পাওনা হিসেবে যোগ ✓</span><span class="en">Add Receivable ✓</span>';
  } else {
    nameWrap.style.display = 'none';
    noteWrap.style.display = 'block';
    walletSec.style.display = 'block';
    catSec.style.display = 'block';
    if(t === 'sub'){
      subBtn.className = 'sbtn sbtn-r';
      subBtn.innerHTML = '<span class="bn">খরচ রেকর্ড করুন ✓</span><span class="en">Deduct Expense ✓</span>';
      renderFormCategories('sub', 'qa-cat-grid');
    } else {
      subBtn.className = 'sbtn sbtn-g';
      subBtn.innerHTML = '<span class="bn">আয় যোগ করুন ✓</span><span class="en">Add Income ✓</span>';
      renderFormCategories('add', 'qa-cat-grid');
    }
  }
}

function selectQAWallet(w, btn){
  SELECTED_QA_WALLET = w;
  document.querySelectorAll('#qa-wallet-row .wsel-btn').forEach(b => b.classList.toggle('on', b.dataset.w === w));
}

function submitQuickAdd(){
  const amt = parseFloat(document.getElementById('qa-amt').value);
  if(!amt || amt <= 0){
    toast('❌ সঠিক পরিমাণ দিন!');
    return;
  }
  if(QA_MODE === 'hisab'){
    const name = document.getElementById('qa-name').value.trim();
    if(!name){
      toast('❌ ব্যক্তির নাম লিখুন!');
      return;
    }
    const note = document.getElementById('qa-note').value.trim() || (LANG==='bn'?'পাওনা হিসাব':'Receivable');
    const ts = Date.now();
    const newEntry = {
      id: ts,
      name: name,
      original: amt,
      remaining: amt,
      history: [{ t: 'add', amt: amt, note: note, date: ts }]
    };
    DB.receive.unshift(newEntry);
    saveData();
    render();
    cm('m-quickadd');
    toast(LANG === 'bn' ? `✅ "${name}" এর কাছে ৳${fmt(amt)} পাওনা যোগ হয়েছে!` : `✅ Added ৳${fmt(amt)} receivable!`);
    return;
  }

  ensureWallets();
  const ts = Date.now();
  const w = SELECTED_QA_WALLET;
  const cats = QA_MODE === 'add' ? INCOME_CATEGORIES : EXPENSE_CATEGORIES;
  const catObj = cats.find(x => x.id === (SELECTED_QA_CAT || (cats[0] && cats[0].id)));
  const note = document.getElementById('qa-note').value.trim() || (catObj ? (LANG === 'bn' ? catObj.bn : catObj.en) : (QA_MODE === 'add' ? 'টাকা যোগ' : 'খরচ'));

  if(QA_MODE === 'add'){
    CASH_DB.wallets[w] = (CASH_DB.wallets[w] || 0) + amt;
    CASH_DB.balance += amt;
    CASH_DB.history.unshift({
      id: ts,
      type: 'add',
      amt: amt,
      note: note,
      category: catObj ? catObj.id : 'other_in',
      wallet: w,
      date: ts
    });
    toast(`✅ ৳${fmt(amt)} আয় যোগ হয়েছে! (${WALLET_META[w]?.name || w})`);
  } else {
    CASH_DB.wallets[w] = (CASH_DB.wallets[w] || 0) - amt;
    CASH_DB.balance -= amt;
    CASH_DB.history.unshift({
      id: ts,
      type: 'sub',
      amt: amt,
      note: note,
      category: catObj ? catObj.id : 'other',
      wallet: w,
      date: ts
    });
    toast(`💸 ৳${fmt(amt)} খরচ হয়েছে! (${WALLET_META[w]?.name || w})`);
  }

  saveCashData();
  cm('m-quickadd');
  renderCash();
}

// ── 4.3 MONTH SWITCHER LOGIC ──
function changeCashMonth(delta){
  const parts = CASH_SELECTED_MONTH.split('-');
  let y = parseInt(parts[0], 10);
  let m = parseInt(parts[1], 10) - 1;
  m += delta;
  if(m < 0){ m = 11; y--; }
  else if(m > 11){ m = 0; y++; }
  const mm = String(m + 1).padStart(2, '0');
  CASH_SELECTED_MONTH = `${y}-${mm}`;
  CASH_TIME_FILTER = 'month';
  updateMonthFilterUI();
  renderCash();
}

function setCashTimeFilter(mode){
  CASH_TIME_FILTER = mode;
  const now = new Date();
  if(mode === 'month'){
    CASH_SELECTED_MONTH = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  } else if(mode === 'last_month'){
    const prev = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    CASH_SELECTED_MONTH = `${prev.getFullYear()}-${String(prev.getMonth() + 1).padStart(2, '0')}`;
  }
  updateMonthFilterUI();
  renderCash();
}

function updateMonthFilterUI(){
  const btnCurr = document.getElementById('mf-curr');
  const btnPrev = document.getElementById('mf-prev');
  const btnAll = document.getElementById('mf-all');
  if(btnCurr) btnCurr.classList.toggle('on', CASH_TIME_FILTER === 'month');
  if(btnPrev) btnPrev.classList.toggle('on', CASH_TIME_FILTER === 'last_month');
  if(btnAll) btnAll.classList.toggle('on', CASH_TIME_FILTER === 'all');

  const lbl = document.getElementById('cash-month-label');
  if(lbl){
    if(CASH_TIME_FILTER === 'all'){
      lbl.textContent = LANG === 'bn' ? 'সব সময়' : 'All Time';
    } else {
      const [y, m] = CASH_SELECTED_MONTH.split('-').map(Number);
      const d = new Date(y, m - 1, 1);
      lbl.textContent = d.toLocaleDateString(LANG === 'bn' ? 'bn-BD' : 'en-GB', { month: 'long', year: 'numeric' });
    }
  }
  const donutTag = document.getElementById('donut-period-tag');
  if(donutTag){
    donutTag.textContent = CASH_TIME_FILTER === 'all' ? (LANG === 'bn' ? 'সব সময়' : 'All Time') : (document.getElementById('cash-month-label')?.textContent || '');
  }
}

// ── 3.3 INTERACTIVE SVG DONUT CHART ──
function renderDonutChart(expenses){
  const wrap = document.getElementById('donut-chart-body');
  if(!wrap) return;
  const total = expenses.reduce((s, h) => s + h.amt, 0);
  if(!expenses.length || total <= 0){
    wrap.innerHTML = `<div style="color:var(--muted);font-size:12px;text-align:center;padding:16px;">${LANG==='bn'?'এই সময়ে কোনো খরচ রেকর্ড করা হয়নি':'No expenses recorded for this period'}</div>`;
    return;
  }

  const map = {};
  expenses.forEach(h => {
    let catId = h.category;
    if(!catId){
      const found = EXPENSE_CATEGORIES.find(c => (h.note && (h.note.includes(c.bn) || h.note.includes(c.en))));
      catId = found ? found.id : 'other';
    }
    map[catId] = (map[catId] || 0) + h.amt;
  });

  const items = Object.entries(map).map(([id, amt]) => {
    const meta = EXPENSE_CATEGORIES.find(c => c.id === id) || { id, e: '📦', bn: 'অন্যান্য', en: 'Other', color: '#64748b' };
    return {
      ...meta,
      amt,
      pct: (amt / total) * 100
    };
  }).sort((a, b) => b.amt - a.amt);

  const r = 58;
  const circ = 2 * Math.PI * r;
  let offset = 0;

  const circles = items.map(it => {
    const slice = (it.amt / total) * circ;
    const svgCircle = `
      <circle cx="80" cy="80" r="${r}" fill="none" stroke="${it.color}" stroke-width="20"
        stroke-dasharray="${slice.toFixed(2)} ${circ.toFixed(2)}"
        stroke-dashoffset="${(-offset).toFixed(2)}"
        style="transition:stroke-dasharray .5s ease, stroke-dashoffset .5s ease;"
      ></circle>
    `;
    offset += slice;
    return svgCircle;
  }).join('');

  const legend = items.map(it => `
    <div class="dleg-item">
      <span class="dleg-dot" style="background:${it.color}"></span>
      <div class="dleg-info">
        <span class="dleg-name">${it.e} ${LANG === 'bn' ? it.bn : it.en}</span>
        <span class="dleg-val">৳${fmt(it.amt)} (${Math.round(it.pct)}%)</span>
      </div>
    </div>
  `).join('');

  wrap.innerHTML = `
    <div class="donut-svg-wrap">
      <svg viewBox="0 0 160 160">
        <circle cx="80" cy="80" r="${r}" fill="none" stroke="var(--border)" stroke-width="20" opacity="0.3"></circle>
        ${circles}
      </svg>
      <div class="donut-center-info">
        <div class="dci-lbl">${LANG === 'bn' ? 'মোট খরচ' : 'Expense'}</div>
        <div class="dci-val" style="color:var(--red);">৳${fmt(total)}</div>
      </div>
    </div>
    <div class="donut-legend-wrap">
      ${legend}
    </div>
  `;
}

// ── 3.4 MICRO-SPENDING INSIGHTS ──
function renderMicroInsights(allHistory){
  const box = document.getElementById('cash-insight-box');
  const txt = document.getElementById('cib-text');
  if(!box || !txt) return;

  const now = new Date();
  const todayStr = localDateStr(now);
  const yesterday = new Date(now.getTime() - 86400000);
  const yestStr = localDateStr(yesterday);

  const todayExpenses = allHistory.filter(h => h.type === 'sub' && localDateStr(new Date(h.date)) === todayStr);
  const yestExpenses = allHistory.filter(h => h.type === 'sub' && localDateStr(new Date(h.date)) === yestStr);

  const todayTot = todayExpenses.reduce((s, h) => s + h.amt, 0);
  const yestTot = yestExpenses.reduce((s, h) => s + h.amt, 0);

  const thisMonth = allHistory.filter(h => h.type === 'sub' && localDateStr(new Date(h.date)).slice(0, 7) === todayStr.slice(0, 7));
  const catMap = {};
  thisMonth.forEach(h => {
    const c = h.category || 'other';
    catMap[c] = (catMap[c] || 0) + h.amt;
  });
  const topCatPair = Object.entries(catMap).sort((a, b) => b[1] - a[1])[0];
  let topCatName = '';
  if(topCatPair){
    const meta = EXPENSE_CATEGORIES.find(c => c.id === topCatPair[0]);
    topCatName = meta ? `${meta.e} ${LANG === 'bn' ? meta.bn : meta.en} (৳${fmt(topCatPair[1])})` : `৳${fmt(topCatPair[1])}`;
  }

  let insightMsg = '';
  if(todayTot > 0){
    if(yestTot > 0){
      const diff = Math.round(((todayTot - yestTot) / yestTot) * 100);
      const comp = diff <= 0 ? `${Math.abs(diff)}% কম খরচ` : `${diff}% বেশি খরচ`;
      insightMsg = LANG === 'bn' 
        ? `আজকের মোট খরচ <b>৳${fmt(todayTot)}</b> (গতকালের চেয়ে ${comp})। ${topCatName ? 'শীর্ষ খাত: <b>' + topCatName + '</b>' : ''}`
        : `Today's spend <b>৳${fmt(todayTot)}</b> (${comp} vs yesterday). ${topCatName ? 'Top: <b>' + topCatName + '</b>' : ''}`;
    } else {
      insightMsg = LANG === 'bn'
        ? `আজকের মোট খরচ <b>৳${fmt(todayTot)}</b>। ${topCatName ? 'এই মাসের শীর্ষ খাত: <b>' + topCatName + '</b>' : ''}`
        : `Today's spend <b>৳${fmt(todayTot)}</b>. ${topCatName ? 'Top category: <b>' + topCatName + '</b>' : ''}`;
    }
  } else {
    insightMsg = LANG === 'bn'
      ? `আজকে এখনো কোনো খরচ রেকর্ড হয়নি! 🎉 ${topCatName ? 'এই মাসের শীর্ষ খাত: <b>' + topCatName + '</b>' : ''}`
      : `No expenses logged today! 🎉 ${topCatName ? 'Top category this month: <b>' + topCatName + '</b>' : ''}`;
  }

  txt.innerHTML = insightMsg;
}

// ── CASH FORM & CRUD ──
function openCashForm(mode){
  cashFormMode = mode;
  ensureWallets();
  const form = document.getElementById('cash-form');
  const icon = document.getElementById('cash-form-icon');
  const submitBtn = document.getElementById('cash-submit-btn');

  if(mode === 'add'){
    icon.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12h14"/><path d="M12 5v14"/></svg>`;
    icon.style.background = 'rgba(16,185,129,.15)';
    icon.style.color = 'var(--green)';
    document.getElementById('cash-form-title').style.color = 'var(--green)';
    submitBtn.className = 'sbtn sbtn-g';
    submitBtn.innerHTML = '<span class="bn">আয় যোগ করুন ✓</span><span class="en">Add Income ✓</span>';
    renderFormCategories('add');
  } else {
    icon.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12h14"/></svg>`;
    icon.style.background = 'rgba(239,68,68,.12)';
    icon.style.color = 'var(--red)';
    document.getElementById('cash-form-title').style.color = 'var(--red)';
    submitBtn.className = 'sbtn sbtn-r';
    submitBtn.innerHTML = '<span class="bn">খরচ রেকর্ড করুন ✓</span><span class="en">Deduct Expense ✓</span>';
    renderFormCategories('sub');
  }

  document.getElementById('cash-amt').value = '';
  document.getElementById('cash-note').value = '';
  const todayStr = localDateStr();
  const dateEl = document.getElementById('cash-date');
  dateEl.value = todayStr;
  dateEl.classList.add('has-val');
  document.getElementById('cash-amt').classList.remove('has-val');
  document.getElementById('cash-note').classList.remove('has-val');

  selectFormWallet('cash');
  form.classList.remove('hidden');
  document.getElementById('cash-amt').focus();
}

function closeCashForm(){
  document.getElementById('cash-form').classList.add('hidden');
}

function submitCash(){
  const amt = parseFloat(document.getElementById('cash-amt').value);
  const note = document.getElementById('cash-note').value.trim() || (cashFormMode === 'add' ? 'টাকা যোগ' : 'খরচ');
  if(isNaN(amt) || amt <= 0){
    toast('❌ সঠিক পরিমাণ দিন!');
    return;
  }
  ensureWallets();
  const ts = Date.now();
  const dateVal = document.getElementById('cash-date').value;
  const entryDate = dateVal ? new Date(dateVal + 'T12:00:00').getTime() : ts;
  const w = SELECTED_FORM_WALLET || 'cash';
  const cat = SELECTED_FORM_CAT || (cashFormMode === 'add' ? 'other_in' : 'other');

  if(cashFormMode === 'add'){
    CASH_DB.wallets[w] = (CASH_DB.wallets[w] || 0) + amt;
    CASH_DB.balance += amt;
    CASH_DB.history.unshift({
      id: ts,
      type: 'add',
      amt: amt,
      note: note,
      category: cat,
      wallet: w,
      date: entryDate
    });
    toast(`✅ ৳${fmt(amt)} যোগ হয়েছে! (${WALLET_META[w]?.name || w})`);
  } else {
    CASH_DB.wallets[w] = (CASH_DB.wallets[w] || 0) - amt;
    CASH_DB.balance -= amt;
    CASH_DB.history.unshift({
      id: ts,
      type: 'sub',
      amt: amt,
      note: note,
      category: cat,
      wallet: w,
      date: entryDate
    });
    toast(`💸 ৳${fmt(amt)} খরচ হয়েছে! (${WALLET_META[w]?.name || w})`);
  }
  saveCashData();
  closeCashForm();
  renderCash();
}

function deleteCashEntry(id){
  const entry = CASH_DB.history.find(h => h.id === id);
  if(!entry) return;
  const idx = CASH_DB.history.findIndex(h => h.id === id);
  const snap = JSON.parse(JSON.stringify(entry));
  ensureWallets();
  const w = entry.wallet || 'cash';
  const balBefore = CASH_DB.balance;
  const walletBefore = CASH_DB.wallets[w] || 0;

  if(entry.type === 'add'){
    CASH_DB.balance -= entry.amt;
    CASH_DB.wallets[w] = (CASH_DB.wallets[w] || 0) - entry.amt;
  } else if(entry.type === 'sub'){
    CASH_DB.balance += entry.amt;
    CASH_DB.wallets[w] = (CASH_DB.wallets[w] || 0) + entry.amt;
  } else if(entry.type === 'transfer'){
    if(entry.fromWallet && entry.toWallet){
      CASH_DB.wallets[entry.fromWallet] = (CASH_DB.wallets[entry.fromWallet] || 0) + entry.amt;
      CASH_DB.wallets[entry.toWallet] = (CASH_DB.wallets[entry.toWallet] || 0) - entry.amt;
    }
  }

  CASH_DB.history = CASH_DB.history.filter(h => h.id !== id);
  saveCashData();
  renderCash();
  toast(LANG === 'bn' ? `🗑️ "${snap.note}" মুছে গেছে` : `🗑️ "${snap.note}" deleted`, () => {
    CASH_DB.history.splice(Math.min(idx, CASH_DB.history.length), 0, snap);
    CASH_DB.balance = balBefore;
    CASH_DB.wallets[w] = walletBefore;
    saveCashData();
    renderCash();
    toast(LANG === 'bn' ? '↩️ ফিরিয়ে আনা হয়েছে' : '↩️ Restored');
  });
}

function clearCashHistory(){
  if(!confirm('সব ইতিহাস মুছবেন? ব্যালেন্স ০ হয়ে যাবে।')) return;
  CASH_DB = { balance: 0, wallets: { cash: 0, bkash: 0, nagad: 0, bank: 0 }, history: [] };
  saveCashData();
  renderCash();
  toast('🗑️ সব মুছে গেছে');
}

function openCashEdit(id){
  const h = CASH_DB.history.find(x => x.id === id);
  if(!h) return;
  document.getElementById('cedit-id').value = id;
  document.getElementById('cedit-amt').value = h.amt;
  document.getElementById('cedit-note').value = h.note || '';
  document.getElementById('cedit-type').value = h.type;
  document.getElementById('m-cedit').classList.add('on');
}

function confirmCashEdit(){
  const id = Number(document.getElementById('cedit-id').value);
  const amt = parseFloat(document.getElementById('cedit-amt').value);
  const note = document.getElementById('cedit-note').value.trim();
  if(!amt || amt <= 0){
    toast('❌ সঠিক পরিমাণ দিন');
    return;
  }
  const h = CASH_DB.history.find(x => x.id === id);
  if(!h) return;
  ensureWallets();
  const w = h.wallet || 'cash';
  const oldAmt = h.amt;
  const diff = amt - oldAmt;

  if(h.type === 'add'){
    CASH_DB.balance += diff;
    CASH_DB.wallets[w] = (CASH_DB.wallets[w] || 0) + diff;
  } else if(h.type === 'sub'){
    CASH_DB.balance -= diff;
    CASH_DB.wallets[w] = (CASH_DB.wallets[w] || 0) - diff;
  }
  h.amt = amt;
  if(note) h.note = note;
  saveCashData();
  renderCash();
  cm('m-cedit');
  toast(LANG === 'bn' ? '✏️ আপডেট হয়েছে' : '✏️ Updated');
}

// ── 4.2 RENDER CASH WITH DATE GROUPING & MODERN FINTECH CARDS ──
function renderCash(){
  ensureWallets();
  const bal = Object.values(CASH_DB.wallets).reduce((s, v) => s + (Number(v) || 0), 0);
  CASH_DB.balance = bal;
  let hist = CASH_DB.history || [];

  // 1. Balance
  document.getElementById('cash-balance').textContent = '৳' + fmt(bal);

  // 2. Multi-Wallets Grid
  renderWallets();

  // 3. Search Filter
  const q = (document.getElementById('cash-srch')?.value || '').toLowerCase().trim();
  if(q){
    hist = hist.filter(h => h.note.toLowerCase().includes(q));
  }

  // 4. Type Filter
  if(CASH_FILTER !== 'all'){
    hist = hist.filter(h => h.type === CASH_FILTER);
  }

  // 5. Wallet Filter
  if(WALLET_FILTER !== 'all'){
    hist = hist.filter(h => (h.wallet === WALLET_FILTER || h.fromWallet === WALLET_FILTER || h.toWallet === WALLET_FILTER));
  }

  // 6. Time Filter (Month / All)
  if(CASH_TIME_FILTER === 'month' || CASH_TIME_FILTER === 'last_month'){
    hist = hist.filter(h => {
      const d = new Date(h.date);
      const mStr = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      return mStr === CASH_SELECTED_MONTH;
    });
  }

  // Stats for filtered view
  const totalIn = hist.filter(h => h.type === 'add').reduce((s, h) => s + h.amt, 0);
  const totalOut = hist.filter(h => h.type === 'sub').reduce((s, h) => s + h.amt, 0);
  const netSavings = totalIn - totalOut;

  document.getElementById('cash-total-in').textContent = '৳' + fmt(totalIn);
  document.getElementById('cash-total-out').textContent = '৳' + fmt(totalOut);
  const savEl = document.getElementById('cash-net-savings');
  if(savEl){
    savEl.textContent = (netSavings >= 0 ? '+' : '-') + '৳' + fmt(Math.abs(netSavings));
    savEl.style.color = netSavings >= 0 ? 'var(--green)' : 'var(--red)';
  }

  // Last transaction snippet
  const sub = document.getElementById('cash-hero-sub');
  const allHist = CASH_DB.history || [];
  if(allHist.length > 0){
    const last = allHist[0];
    const prefix = last.type === 'add' ? '↑ ' : last.type === 'sub' ? '↓ ' : '⇄ ';
    const label = last.type === 'add' ? (LANG === 'bn' ? 'শেষ যোগ: ' : 'Last in: ') : last.type === 'sub' ? (LANG === 'bn' ? 'শেষ খরচ: ' : 'Last out: ') : (LANG === 'bn' ? 'ট্রান্সফার: ' : 'Transfer: ');
    sub.textContent = prefix + label + '৳' + fmt(last.amt) + ' — ' + last.note;
  } else {
    sub.innerHTML = '<span class="bn">কোনো লেনদেন নেই</span><span class="en" style="display:none">No transactions yet</span>';
  }

  // Micro-Insights (3.4)
  renderMicroInsights(allHist);

  // Donut Chart (3.3)
  renderDonutChart(hist.filter(h => h.type === 'sub'));

  // Budget Bar
  const budget = CASH_DB.budget || 0;
  const budgetWrap = document.getElementById('budget-wrap');
  const budgetCta = document.getElementById('budget-cta');
  if(budget > 0){
    budgetWrap.style.display = 'block';
    budgetCta.style.display = 'none';
    const pct = Math.min(100, Math.round((totalOut / budget) * 100));
    const fill = document.getElementById('budget-fill');
    fill.style.width = pct + '%';
    fill.style.background = pct < 60 ? 'var(--green)' : pct < 85 ? 'var(--yellow)' : 'var(--red)';
    document.getElementById('budget-pct').textContent = pct + '%';
    document.getElementById('budget-pct').style.color = pct < 60 ? 'var(--green)' : pct < 85 ? 'var(--yellow)' : 'var(--red)';
    const rem = budget - totalOut;
    document.getElementById('budget-sub').textContent = LANG === 'bn'
      ? (rem > 0 ? `বাকি ৳${fmt(rem)} থেকে ৳${fmt(budget)}` : `বাজেট ৳${fmt(Math.abs(rem))} ছাড়িয়ে গেছে!`)
      : (rem > 0 ? `৳${fmt(rem)} left of ৳${fmt(budget)}` : `Over budget by ৳${fmt(Math.abs(rem))}!`);
  } else {
    budgetWrap.style.display = 'none';
    budgetCta.style.display = 'block';
  }

  // Date-Grouped History List (4.2)
  const list = document.getElementById('cash-history-list');
  if(hist.length === 0){
    list.innerHTML = `<div class="empty"><div class="empty-i" style="color:var(--muted)"><svg xmlns="http://www.w3.org/2000/svg" width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M21 12V7H5a2 2 0 0 1 0-4h14v4"/><path d="M3 5v14a2 2 0 0 0 2 2h16v-5"/><path d="M18 12a2 2 0 0 0 0 4h4v-4Z"/></svg></div><div class="empty-t"><span class="bn">${CASH_FILTER === 'all' ? 'কোনো লেনদেন নেই' : 'কোনো রেকর্ড নেই'}</span><span class="en">${CASH_FILTER === 'all' ? 'No transactions yet' : 'No records found'}</span></div><div class="empty-s"><span class="bn">উপরের বাটন দিয়ে শুরু করুন</span><span class="en">Use the buttons above to get started</span></div></div>`;
    return;
  }

  // Sort descending by date
  hist.sort((a, b) => b.date - a.date);

  // Group by local date string YYYY-MM-DD
  const groups = {};
  hist.forEach(h => {
    const dStr = localDateStr(new Date(h.date));
    if(!groups[dStr]) groups[dStr] = [];
    groups[dStr].push(h);
  });

  const todayStr = localDateStr(new Date());
  const yesterday = new Date(Date.now() - 86400000);
  const yestStr = localDateStr(yesterday);
  const dateKeys = Object.keys(groups).sort((a, b) => b.localeCompare(a));

  list.innerHTML = dateKeys.map(dStr => {
    const dayTxns = groups[dStr];
    const dayOut = dayTxns.filter(h => h.type === 'sub').reduce((s, h) => s + h.amt, 0);
    const dayIn = dayTxns.filter(h => h.type === 'add').reduce((s, h) => s + h.amt, 0);

    let dayTitle = dStr;
    const dObj = new Date(dStr + 'T12:00:00');
    if(dStr === todayStr){
      dayTitle = LANG === 'bn' ? '📅 আজ' : '📅 Today';
    } else if(dStr === yestStr){
      dayTitle = LANG === 'bn' ? '📅 গতকাল' : '📅 Yesterday';
    } else {
      dayTitle = '📅 ' + dObj.toLocaleDateString(LANG === 'bn' ? 'bn-BD' : 'en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
    }

    const itemsHtml = dayTxns.map(h => {
      const isAdd = h.type === 'add';
      const isSub = h.type === 'sub';
      const isTf = h.type === 'transfer';
      const wMeta = WALLET_META[h.wallet] || { icon: '💵', name: 'নগদ', en: 'Cash' };
      let catObj = null;
      if(isSub) catObj = EXPENSE_CATEGORIES.find(c => c.id === h.category) || (EXPENSE_CATEGORIES.find(c => h.note && h.note.includes(c.bn)) || { e: '💸', color: '#ef4444' });
      else if(isAdd) catObj = INCOME_CATEGORIES.find(c => c.id === h.category) || (INCOME_CATEGORIES.find(c => h.note && h.note.includes(c.bn)) || { e: '💰', color: '#10b981' });
      else catObj = { e: '⇄', color: '#3b82f6' };

      const iconChar = catObj.e || (isAdd ? '⬆️' : isSub ? '⬇️' : '⇄');
      const sign = isAdd ? '+' : isSub ? '-' : '';
      const amtColor = isAdd ? 'var(--green)' : isSub ? 'var(--red)' : 'var(--primary)';
      const timeStr = new Date(h.date).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

      return `
        <div class="cash-entry">
          <div class="cash-entry-icon" style="background:${catObj.color}1f;font-size:18px;">${iconChar}</div>
          <div class="cash-entry-info">
            <div class="cash-entry-note">${h.note}</div>
            <div class="cash-entry-date" style="display:flex;align-items:center;gap:6px;">
              <span class="wallet-badge">${wMeta.icon} ${LANG === 'bn' ? wMeta.name : wMeta.en}</span>
              <span>${timeStr}</span>
            </div>
          </div>
          <div class="cash-entry-amt" style="color:${amtColor};font-variant-numeric:tabular-nums;">${sign}৳${fmt(h.amt)}</div>
          ${!isTf ? `<button class="cash-edit-btn" onclick="openCashEdit(${h.id})"><svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4Z"/></svg></button>` : ''}
          <button class="cash-del-btn" onclick="deleteCashEntry(${h.id})"><svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 6h18"/><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"/><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"/></svg></button>
        </div>
      `;
    }).join('');

    return `
      <div class="date-group">
        <div class="date-group-hdr">
          <div class="dgh-title">${dayTitle}</div>
          <div class="dgh-total">
            ${dayOut > 0 ? `<span class="dgh-out">-${LANG === 'bn' ? 'খরচ' : 'Out'}: ৳${fmt(dayOut)}</span>` : ''}
            ${dayIn > 0 ? `<span class="dgh-in">+${LANG === 'bn' ? 'আয়' : 'In'}: ৳${fmt(dayIn)}</span>` : ''}
          </div>
        </div>
        ${itemsHtml}
      </div>
    `;
  }).join('');
}


// ── FORMAT ──
function localDateStr(d=new Date()){return new Date(d.getTime()-(d.getTimezoneOffset()*60000)).toISOString().split('T')[0];}
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
  return a.length?Math.min(...a.map(h=>Number(h.date)||Number(h.id)||Number(p.id))):p.id;
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
let _toastQueue=[];
let _toastTimer=null;
let _toastActive=false;

function toast(msg,undoFn=null){
  _toastQueue.push({msg,undoFn});
  if(!_toastActive) processToastQueue();
}

function processToastQueue(){
  if(_toastQueue.length===0){
    _toastActive=false;
    return;
  }
  _toastActive=true;
  let {msg, undoFn} = _toastQueue.shift();
  
  const t=document.getElementById('toast');
  if(_toastTimer)clearTimeout(_toastTimer);
  t.innerHTML='';
  t.classList.remove('on');

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
      if(undoFn) undoFn();
      t.classList.remove('on');
      clearTimeout(_toastTimer);
      window._pendingUndo=null;
      setTimeout(processToastQueue, 300);
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
    setTimeout(processToastQueue, 300);
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
  const loanDateStr=localDateStr(loanDate);
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
    const today=localDateStr();
    if(!document.getElementById('r-loan-date').value)document.getElementById('r-loan-date').value=today;
  }
}

// ── ENTRIES ──
function addEntry(type){
  const p=type==='receive'?'r':'g';
  const name=document.getElementById(p+'-na').value.trim();
  const amt=parseFloat(document.getElementById(p+'-am').value);
  const note=document.getElementById(p+'-no').value.trim()||'Entry';
  const dateVal=document.getElementById(p+'-date').value;
  if(!name||isNaN(amt)||amt<=0)return alert(LANG==='bn'?'সঠিক তথ্য দিন!':'Enter valid data!');
  
  let loanData=null;
  if(type==='receive'&&note.toLowerCase().includes('loan')){
    const fees=parseFeeString(document.getElementById('r-fee').value);
    const loanDate=document.getElementById('r-loan-date').value;
    loanData={fees,loanDate};
  }
  
  const tsId=Date.now();
  const histDate=dateVal?new Date(dateVal+'T12:00:00').getTime():tsId;
  const hist={id:tsId,date:histDate,amt,note,t:'add'};
  
  let person=DB[type].find(x=>x.name.toLowerCase()===name.toLowerCase());
  if(person){
    const wasSettled=person.remaining===0;
    if(wasSettled){
      person.original=amt;person.remaining=amt;
      person.clearedAt=histDate;
      person.history.unshift(hist);
      if(loanData)person.loanData=loanData;
    } else {
      person.original+=amt;person.remaining+=amt;person.history.unshift(hist);
      if(loanData)person.loanData=loanData;
    }
  } else {
    DB[type].push({id:tsId,name,original:amt,remaining:amt,history:[hist],loanData});
  }
  document.getElementById(p+'-na').value='';
  document.getElementById(p+'-am').value='';
  document.getElementById(p+'-no').value='';
  document.getElementById(p+'-date').value='';
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
  const breakdown=getLoanBreakdown(p);
  const due=(type==='receive'&&breakdown)?Math.max(0,breakdown.totalRepayment-breakdown.paidAmount):p.remaining;
  document.getElementById('m-pay-s').textContent=`${p.name} — Due: ৳${fmt(due)}`;
  document.getElementById('pa').value='';document.getElementById('pn').value='';
  
  const chip=document.getElementById('btn-pay-full-fill');
  if(chip){
    chip.style.display=due>0?'inline-flex':'none';
    chip.innerHTML=`<span class="bn">⚡ সম্পূর্ণ পরিশোধ (৳${fmt(due)})</span><span class="en">⚡ Full Pay (৳${fmt(due)})</span>`;
  }
  
  renderQtags('pay-qtags','hisabPay','pn');
  document.getElementById('m-pay').classList.add('on');
}

function fillFullPayment(){
  const p=DB[CTX.type]?.find(x=>x.id===CTX.id);
  if(!p)return;
  const breakdown=getLoanBreakdown(p);
  const due=(CTX.type==='receive'&&breakdown)?Math.max(0,breakdown.totalRepayment-breakdown.paidAmount):p.remaining;
  document.getElementById('pa').value=due;
  document.getElementById('pn').value=LANG==='bn'?'সম্পূর্ণ পরিশোধ':'Full Payment';
}

let PENDING_ALL_CLEAR = null;

function oneClickAllClear(type, id, ev){
  if(ev) ev.stopPropagation();
  const p=DB[type]?.find(x=>x.id===id);
  if(!p) return;
  
  const breakdown=getLoanBreakdown(p);
  const due=(type==='receive'&&breakdown)?Math.max(0,breakdown.totalRepayment-breakdown.paidAmount):p.remaining;
  if(due<=0){
    toast(LANG==='bn'?'✅ কোনো বকেয়া নেই!':'✅ Already settled!');
    return;
  }
  
  PENDING_ALL_CLEAR = { type, id, due };
  
  const nameEl=document.getElementById('ac-party-name');
  const amtEl=document.getElementById('ac-party-amt');
  if(nameEl) nameEl.textContent=p.name;
  if(amtEl) amtEl.textContent='৳'+fmt(due);
  
  document.getElementById('m-allclear').classList.add('on');
}

function confirmAllClearExecution(){
  if(!PENDING_ALL_CLEAR) return;
  const { type, id, due } = PENDING_ALL_CLEAR;
  PENDING_ALL_CLEAR = null;
  cm('m-allclear');
  
  const p=DB[type]?.find(x=>x.id===id);
  if(!p) return;
  
  const ts=Date.now();
  const hist={
    id: ts,
    date: ts,
    amt: due,
    note: LANG==='bn'?'সম্পূর্ণ পরিশোধ (All Clear)':'Full Payment (All Clear)',
    t: 'pay'
  };
  
  // Snapshots for Undo
  const oldRemaining=p.remaining;
  const oldClearedAt=p.clearedAt;
  
  p.history.unshift(hist);
  p.remaining=0;
  p.clearedAt=ts;
  
  logActivity('সম্পূর্ণ পরিশোধ',`${p.name} — ৳${fmt(due)}`);
  saveData();
  render();
  
  const undoFn = () => {
    p.history = p.history.filter(h => h.id !== ts);
    p.remaining = oldRemaining;
    p.clearedAt = oldClearedAt;
    saveData();
    render();
    toast(LANG==='bn'?'↩️ আনডু করা হয়েছে':'↩️ Undone');
  };
  
  toast(LANG==='bn'?`🎉 ${p.name}-এর ৳${fmt(due)} সম্পূর্ণ শোধ হয়েছে!`:`🎉 ${p.name} fully paid ৳${fmt(due)}!`, undoFn);
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
  document.getElementById('ed-date').value=localDateStr(new Date(firstTs(p)));
  document.getElementById('m-edit-s').textContent=p.name;
  
  const loanWrap=document.getElementById('ed-loan-wrap');
  if(type==='receive'&&isLoan){
    loanWrap.style.display='block';
    document.getElementById('ed-fee').value=p.loanData?.fees||'';
    const loanDate=p.loanData?.loanDate?localDateStr(new Date(p.loanData.loanDate)):localDateStr(new Date(firstTs(p)));
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
  const dateVal=document.getElementById('ed-date').value;
  if(newName)p.name=newName;
  p.original=amt;
  p.remaining=p.remaining+(amt-oldAmt);
  if(dateVal){
    const newTs=new Date(dateVal+'T12:00:00').getTime();
    const addHist=p.history.filter(h=>h.t==='add');
    if(addHist.length) addHist[addHist.length-1].date=newTs;
    if(p.clearedAt) p.clearedAt=newTs;
  }
  
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

// ── MONEY RECEIPT SLIP & WHATSAPP ──
let CURRENT_RECEIPT_DATA = null;

function getReceiptWhatsAppText(p, type) {
  const d = ageDays(p);
  const breakdown = getLoanBreakdown(p);
  let remAmt = p.remaining;
  let paidAmt = p.original - p.remaining;
  if(type === 'receive' && breakdown) {
    remAmt = breakdown.totalRepayment - breakdown.paidAmount;
    paidAmt = breakdown.paidAmount;
  }
  if(remAmt < 0) remAmt = 0;
  const isSettled = remAmt <= 0;
  const isRec = type === 'receive';
  const typeLbl = isRec ? (LANG==='bn'?'পাওনা হিসাব (Receivable)':'Receivable') : (LANG==='bn'?'দেনা হিসাব (Payable)':'Payable');
  
  let t = `🧾 *হিসাব ট্র্যাকার PRO — মানি রিসিট স্লিপ*\n`;
  t += `━━━━━━━━━━━━━━━━━━━━\n`;
  t += `👤 *গ্রাহক/নাম:* ${p.name}\n`;
  t += `📅 *তারিখ:* ${new Date().toLocaleDateString('en-GB', { day:'2-digit', month:'short', year:'numeric' })}\n`;
  t += `🆔 *ভাউচার নং:* #REC-${String(p.id).slice(-6)}\n`;
  t += `📌 *ধরন:* ${typeLbl}\n`;
  t += `📊 *স্ট্যাটাস:* ${isSettled ? (LANG==='bn'?'✅ সম্পূর্ণ শোধ (Full Paid)':'✅ Full Paid') : (LANG==='bn'?`⏳ বকেয়া (${d} দিন ধরে)`:`⏳ Pending (${d} days)`)}\n\n`;

  t += `💵 *${isSettled ? (LANG==='bn'?'পরিশোধিত ব্যালেন্স':'Settled Balance') : (isRec ? (LANG==='bn'?'বকেয়া পাওনা':'Balance Due') : (LANG==='bn'?'বকেয়া দেনা':'Balance Due'))}:* ৳${fmt(remAmt)}\n`;
  t += `💰 *মূল পরিমাণ:* ৳${fmt(p.original)}\n`;
  t += `✅ *মোট পরিশোধ:* ৳${fmt(paidAmt)}\n`;
  
  if (breakdown) {
    t += `🏦 *লোন ফী:* ৳${fmt(breakdown.fees)} | *মোট প্রদেয়:* ৳${fmt(breakdown.totalRepayment)}\n`;
  }

  const recent = p.history.slice(0, 5);
  if (recent.length) {
    t += `\n📝 *সাম্প্রতিক লেনদেনসমূহ:*\n`;
    recent.forEach(h => {
      const sign = h.t === 'add' ? '+' : '-';
      t += `• ${fmtD(h.date)} — ${h.note}: ${sign}৳${fmt(h.amt)}\n`;
    });
    if (p.history.length > 5) {
      t += `• ...এবং আরো ${p.history.length - 5}টি লেনদেন\n`;
    }
  }

  t += `━━━━━━━━━━━━━━━━━━━━\n`;
  t += `✨ _Generated via Hisab Tracker PRO_\n`;
  t += `🌐 https://hisabtracker.profess0r-null.xyz`;
  return t;
}

function openReceipt(type, id) {
  let p = DB[type]?.find(x => x.id === id);
  if(!p) {
    p = DB.receive.find(x => x.id === id) || DB.give.find(x => x.id === id);
    if(!p) return;
  }
  
  CURRENT_RECEIPT_DATA = { p, type };
  const d = ageDays(p);
  const breakdown = getLoanBreakdown(p);
  let remAmt = p.remaining;
  let paidAmt = p.original - p.remaining;
  if(type === 'receive' && breakdown) {
    remAmt = breakdown.totalRepayment - breakdown.paidAmount;
    paidAmt = breakdown.paidAmount;
  }
  if(remAmt < 0) remAmt = 0;
  const isSettled = remAmt <= 0;
  const isRec = type === 'receive';
  
  const formattedDate = new Date().toLocaleDateString('en-GB', { day:'2-digit', month:'short', year:'numeric' }) + ', ' + new Date().toLocaleTimeString([], { hour:'2-digit', minute:'2-digit' });
  
  const recentTxns = p.history.slice(0, 5);
  let historyRowsHtml = '';
  if(recentTxns.length > 0) {
    historyRowsHtml = `
      <div class="rc-history-wrap">
        <div class="rc-hist-title">${LANG==='bn'?'সাম্প্রতিক লেনদেন':'Recent Transactions'} (${Math.min(5, p.history.length)}/${p.history.length})</div>
        ${recentTxns.map(h => `
          <div class="rc-hist-row">
            <span>${fmtD(h.date)} — ${h.note}</span>
            <b style="color:var(--${h.t==='add'?'red':'green'})">${h.t==='add'?'+':'-'}৳${fmt(h.amt)}</b>
          </div>
        `).join('')}
      </div>
    `;
  }
  
  let loanNoticeHtml = '';
  if(breakdown) {
    loanNoticeHtml = `<div class="rc-due-note">${LANG==='bn'?'মূল: ৳':'Orig: ৳'}${fmt(p.original)} + ${LANG==='bn'?'ফী: ৳':'Fee: ৳'}${fmt(breakdown.fees)} = ${LANG==='bn'?'মোট প্রদেয় ৳':'Total ৳'}${fmt(breakdown.totalRepayment)}</div>`;
  }

  const slipHtml = `
    <div class="rc-slip" id="rc-visual-card">
      <div class="rc-header">
        <div class="rc-brand">
          <span class="rc-logo">📒</span>
          <div>
            <div class="rc-title">HISAB TRACKER PRO</div>
            <div class="rc-subtitle">${LANG==='bn'?'ডিজিটাল মানি রিসিট ভাউচার':'DIGITAL MONEY RECEIPT'}</div>
          </div>
        </div>
        <div class="rc-rec-badge">#REC-${String(p.id).slice(-6)}</div>
      </div>
      
      <div class="rc-divider"></div>
      
      <div class="rc-meta-grid">
        <div class="rc-meta-item">
          <span class="rc-meta-lbl">${LANG==='bn'?'গ্রাহক / নাম':'Party / Name'}</span>
          <span class="rc-meta-val rc-client-name">${p.name}</span>
        </div>
        <div class="rc-meta-item">
          <span class="rc-meta-lbl">${LANG==='bn'?'তারিখ ও সময়':'Date & Time'}</span>
          <span class="rc-meta-val">${formattedDate}</span>
        </div>
        <div class="rc-meta-item">
          <span class="rc-meta-lbl">${LANG==='bn'?'হিসাবের ধরন':'Account Type'}</span>
          <span class="rc-meta-val ${isRec?'val-g':'val-r'}">${isRec?(LANG==='bn'?'📥 পাওনা (Receivable)':'📥 Receivable'):(LANG==='bn'?'📤 দেনা (Payable)':'📤 Payable')}</span>
        </div>
        <div class="rc-meta-item">
          <span class="rc-meta-lbl">${LANG==='bn'?'স্ট্যাটাস':'Status'}</span>
          <span class="rc-meta-val">${isSettled?(LANG==='bn'?'✅ পরিশোধিত':'✅ Full Paid'):(LANG==='bn'?`⏳ বকেয়া (${d} দিন)`:`⏳ Pending (${d}d)`)}</span>
        </div>
      </div>
      
      <div class="rc-due-box ${isRec?'due-g':'due-r'}">
        <div class="rc-due-lbl">${isSettled?(LANG==='bn'?'পরিশোধিত ব্যালেন্স':'SETTLED BALANCE'):(LANG==='bn'?'বর্তমান বকেয়া পরিমাণ':'NET BALANCE DUE')}</div>
        <div class="rc-due-amt">৳${fmt(remAmt)}</div>
        ${loanNoticeHtml}
      </div>
      
      <div class="rc-stat-row">
        <div class="rc-stat-col">
          <div class="rc-stat-lbl">${LANG==='bn'?'মূল হিসাব':'Original'}</div>
          <div class="rc-stat-val">৳${fmt(p.original)}</div>
        </div>
        <div class="rc-stat-col">
          <div class="rc-stat-lbl">${LANG==='bn'?'মোট পরিশোধ':'Total Paid'}</div>
          <div class="rc-stat-val val-g">৳${fmt(paidAmt)}</div>
        </div>
        <div class="rc-stat-col">
          <div class="rc-stat-lbl">${LANG==='bn'?'মোট এন্ট্রি':'Entries'}</div>
          <div class="rc-stat-val">${p.history.length}</div>
        </div>
      </div>
      
      ${historyRowsHtml}
      
      <div class="rc-footer">
        <div class="rc-barcode">
          <div class="rc-barcode-lines"></div>
          <div class="rc-barcode-txt">OFFICIAL VOUCHER • VERIFIED RECORD</div>
        </div>
        <div class="rc-verified-stamp">VERIFIED ✓</div>
      </div>
    </div>
  `;
  
  const box = document.getElementById('receipt-slip-box');
  if(box) box.innerHTML = slipHtml;
  document.getElementById('m-receipt').classList.add('on');
}

function shareReceiptWhatsApp() {
  if(!CURRENT_RECEIPT_DATA) return;
  const text = getReceiptWhatsAppText(CURRENT_RECEIPT_DATA.p, CURRENT_RECEIPT_DATA.type);
  const waUrl = 'https://api.whatsapp.com/send?text=' + encodeURIComponent(text);
  window.open(waUrl, '_blank');
}

function copyReceiptText() {
  if(!CURRENT_RECEIPT_DATA) return;
  const text = getReceiptWhatsAppText(CURRENT_RECEIPT_DATA.p, CURRENT_RECEIPT_DATA.type);
  const cp = () => {
    const ta = document.createElement('textarea');
    ta.value = text;
    document.body.appendChild(ta);
    ta.select();
    document.execCommand('copy');
    document.body.removeChild(ta);
    toast(LANG==='bn'?'📋 স্লিপ টেক্সট কপি হয়েছে!':'📋 Slip text copied!');
  };
  navigator.clipboard ? navigator.clipboard.writeText(text).then(() => toast(LANG==='bn'?'📋 স্লিপ টেক্সট কপি হয়েছে!':'📋 Slip text copied!')).catch(cp) : cp();
}

function copyWA(type, id) {
  openReceipt(type, id);
}

function generateReceiptBlob(p, type) {
  return new Promise((resolve, reject) => {
    try {
      const d = ageDays(p);
      const breakdown = getLoanBreakdown(p);
      let remAmt = p.remaining;
      let paidAmt = p.original - p.remaining;
      if(type==='receive' && breakdown){
        remAmt = breakdown.totalRepayment - breakdown.paidAmount;
        paidAmt = breakdown.paidAmount;
      }
      if(remAmt < 0) remAmt = 0;
      const settled = remAmt <= 0;
      const recentTxns = p.history.slice(0, 6);
      
      const W = 620;
      const itemH = 34;
      const H = 540 + (recentTxns.length * itemH);
      const scale = 2; // High-resolution retina render
      
      const canvas = document.createElement('canvas');
      canvas.width = W * scale;
      canvas.height = H * scale;
      const ctx = canvas.getContext('2d');
      ctx.scale(scale, scale);
      
      // Background card
      ctx.fillStyle = '#0f172a';
      ctx.beginPath();
      _rcDrawRound(ctx, 0, 0, W, H, 20);
      ctx.fill();
      
      // Outer border
      ctx.strokeStyle = '#334155';
      ctx.lineWidth = 1.5;
      ctx.stroke();
      
      // Top colored accent bar
      ctx.fillStyle = type === 'receive' ? '#10b981' : '#ef4444';
      ctx.fillRect(0, 0, W, 7);
      
      // Header brand
      ctx.fillStyle = '#f8fafc';
      ctx.font = 'bold 22px Inter, sans-serif';
      ctx.fillText('📒 HISAB TRACKER PRO', 30, 46);
      
      ctx.fillStyle = '#94a3b8';
      ctx.font = '600 11.5px Inter, sans-serif';
      ctx.fillText('DIGITAL MONEY RECEIPT SLIP • মানি রিসিট ভাউচার', 30, 68);
      
      // Voucher badge (right)
      ctx.fillStyle = '#1e293b';
      ctx.beginPath();
      _rcDrawRound(ctx, W - 165, 30, 135, 30, 8);
      ctx.fill();
      ctx.strokeStyle = '#475569';
      ctx.lineWidth = 1;
      ctx.stroke();
      ctx.fillStyle = '#38bdf8';
      ctx.font = 'bold 12px monospace';
      ctx.fillText('#REC-' + String(p.id).slice(-6), W - 153, 50);
      
      // Divider
      ctx.strokeStyle = '#334155';
      ctx.setLineDash([5, 4]);
      ctx.beginPath();
      ctx.moveTo(30, 88);
      ctx.lineTo(W - 30, 88);
      ctx.stroke();
      ctx.setLineDash([]);
      
      // Client info
      ctx.fillStyle = '#94a3b8';
      ctx.font = '11.5px Inter, sans-serif';
      ctx.fillText('PARTY / গ্রাহক:', 30, 114);
      ctx.fillStyle = '#ffffff';
      ctx.font = 'bold 16px Inter, "Hind Siliguri", sans-serif';
      ctx.fillText(p.name, 30, 136);
      
      // Date info
      ctx.fillStyle = '#94a3b8';
      ctx.font = '11.5px Inter, sans-serif';
      ctx.fillText('DATE / তারিখ:', 250, 114);
      ctx.fillStyle = '#e2e8f0';
      ctx.font = '600 13px Inter, sans-serif';
      const dateStr = new Date().toLocaleDateString('en-GB', { day:'2-digit', month:'short', year:'numeric' });
      ctx.fillText(dateStr, 250, 136);
      
      // Status info
      ctx.fillStyle = '#94a3b8';
      ctx.font = '11.5px Inter, sans-serif';
      ctx.fillText('STATUS / অবস্থা:', 440, 114);
      ctx.fillStyle = settled ? '#10b981' : (type==='receive'?'#38bdf8':'#f87171');
      ctx.font = 'bold 13px Inter, sans-serif';
      ctx.fillText(settled ? '✓ FULL PAID' : (type==='receive'?'RECEIVABLE':'PAYABLE'), 440, 136);
      
      // Big Due Box
      const isRec = type === 'receive';
      ctx.fillStyle = isRec ? 'rgba(16, 185, 129, 0.12)' : 'rgba(239, 68, 68, 0.12)';
      ctx.beginPath();
      _rcDrawRound(ctx, 30, 160, W - 60, 88, 14);
      ctx.fill();
      ctx.strokeStyle = isRec ? 'rgba(16, 185, 129, 0.4)' : 'rgba(239, 68, 68, 0.4)';
      ctx.stroke();
      
      ctx.fillStyle = isRec ? '#34d399' : '#f87171';
      ctx.font = 'bold 12px Inter, sans-serif';
      ctx.fillText(settled ? 'SETTLED BALANCE / পরিশোধিত' : (isRec ? 'TOTAL RECEIVABLE / বকেয়া পাওনা' : 'TOTAL PAYABLE / বকেয়া দেনা'), 48, 186);
      
      ctx.fillStyle = isRec ? '#10b981' : '#ef4444';
      ctx.font = '900 36px Inter, sans-serif';
      ctx.fillText('৳ ' + fmt(remAmt), 48, 228);
      
      if(!settled && d > 0) {
        ctx.fillStyle = '#94a3b8';
        ctx.font = '600 12px Inter, sans-serif';
        ctx.fillText(`(Pending ${d} days / ${d} দিন)`, W - 200, 222);
      }
      
      // 3 Summary Cols
      const statY = 268;
      ctx.fillStyle = '#1e293b';
      ctx.beginPath();
      _rcDrawRound(ctx, 30, statY, W - 60, 56, 10);
      ctx.fill();
      
      const colW = (W - 60) / 3;
      ctx.fillStyle = '#94a3b8';
      ctx.font = '10.5px Inter, sans-serif';
      ctx.fillText('ORIGINAL / মূল', 45, statY + 20);
      ctx.fillStyle = '#f8fafc';
      ctx.font = 'bold 14.5px Inter, sans-serif';
      ctx.fillText('৳ ' + fmt(p.original), 45, statY + 42);
      
      ctx.fillStyle = '#94a3b8';
      ctx.font = '10.5px Inter, sans-serif';
      ctx.fillText('TOTAL PAID / পরিশোধ', 45 + colW, statY + 20);
      ctx.fillStyle = '#34d399';
      ctx.font = 'bold 14.5px Inter, sans-serif';
      ctx.fillText('৳ ' + fmt(paidAmt), 45 + colW, statY + 42);
      
      ctx.fillStyle = '#94a3b8';
      ctx.font = '10.5px Inter, sans-serif';
      ctx.fillText('TXNS / মোট এন্ট্রি', 45 + colW * 2, statY + 20);
      ctx.fillStyle = '#38bdf8';
      ctx.font = 'bold 14.5px Inter, sans-serif';
      ctx.fillText(p.history.length + ' entries', 45 + colW * 2, statY + 42);
      
      // Recent History
      const histY = statY + 76;
      ctx.fillStyle = '#94a3b8';
      ctx.font = 'bold 11.5px Inter, sans-serif';
      ctx.fillText('RECENT TRANSACTIONS / সাম্প্রতিক লেনদেন:', 30, histY);
      
      let curY = histY + 12;
      if (recentTxns.length === 0) {
        ctx.fillStyle = '#64748b';
        ctx.font = 'italic 12px Inter, sans-serif';
        ctx.fillText('No transaction history recorded', 30, curY + 20);
        curY += 35;
      } else {
        recentTxns.forEach((h, idx) => {
          curY += 26;
          ctx.fillStyle = idx % 2 === 0 ? 'rgba(30, 41, 59, 0.4)' : 'transparent';
          ctx.fillRect(30, curY - 16, W - 60, 24);
          
          ctx.fillStyle = '#94a3b8';
          ctx.font = '11.5px Inter, sans-serif';
          ctx.fillText(fmtD(h.date), 40, curY);
          
          ctx.fillStyle = '#e2e8f0';
          ctx.font = '500 12px Inter, "Hind Siliguri", sans-serif';
          const n = h.note.length > 28 ? h.note.slice(0, 26) + '..' : h.note;
          ctx.fillText(n, 135, curY);
          
          const isAdd = h.t === 'add';
          ctx.fillStyle = isAdd ? '#f87171' : '#34d399';
          ctx.font = 'bold 12.5px Inter, sans-serif';
          const a = (isAdd ? '+' : '-') + ' ৳' + fmt(h.amt);
          ctx.fillText(a, W - 140, curY);
        });
        curY += 14;
      }
      
      // Divider
      ctx.strokeStyle = '#334155';
      ctx.setLineDash([4, 4]);
      ctx.beginPath();
      ctx.moveTo(30, curY + 8);
      ctx.lineTo(W - 30, curY + 8);
      ctx.stroke();
      ctx.setLineDash([]);
      
      // Footer Barcode
      const footY = curY + 24;
      _rcDrawBarcode(ctx, 30, footY, 180, 22);
      ctx.fillStyle = '#64748b';
      ctx.font = '9.5px Inter, monospace';
      ctx.fillText('HISAB TRACKER PRO • hisabtracker.profess0r-null.xyz', 30, footY + 34);
      
      // Stamp
      ctx.save();
      ctx.translate(W - 110, footY + 12);
      ctx.rotate(-8 * Math.PI / 180);
      ctx.strokeStyle = '#10b981';
      ctx.lineWidth = 1.8;
      ctx.strokeRect(-55, -14, 110, 28);
      ctx.fillStyle = '#10b981';
      ctx.font = 'bold 10.5px Inter, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('VERIFIED SLIP ✓', 0, 4);
      ctx.restore();
      
      canvas.toBlob(blob => {
        if(blob) resolve(blob);
        else reject(new Error('Canvas blob failed'));
      }, 'image/png');
    } catch(err) {
      reject(err);
    }
  });
}

function _rcDrawRound(ctx, x, y, w, h, r) {
  if (w < 2 * r) r = w / 2;
  if (h < 2 * r) r = h / 2;
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

function _rcDrawBarcode(ctx, x, y, w, h) {
  ctx.fillStyle = '#64748b';
  let cx = x;
  const bars = [2, 1, 3, 1, 2, 4, 1, 2, 3, 1, 1, 3, 2, 1, 4, 2, 1, 3, 2, 1, 2, 3, 1, 4, 2, 1, 3, 2, 1];
  for (let b of bars) {
    if (cx + b > x + w) break;
    ctx.fillRect(cx, y, b, h);
    cx += b + 2;
  }
}

async function downloadReceiptImage() {
  if (!CURRENT_RECEIPT_DATA) return;
  const { p, type } = CURRENT_RECEIPT_DATA;
  toast(LANG==='bn'?'🎨 স্লিপ তৈরি হচ্ছে...':'🎨 Generating slip...');
  try {
    const blob = await generateReceiptBlob(p, type);
    const fileName = `Receipt_${p.name.replace(/[^a-zA-Z0-9_\u0980-\u09FF]/g,'_')}_${new Date().toISOString().split('T')[0]}.png`;
    const file = new File([blob], fileName, { type: 'image/png' });
    
    if (navigator.canShare && navigator.canShare({ files: [file] })) {
      await navigator.share({
        files: [file],
        title: `Money Receipt - ${p.name}`,
        text: getReceiptWhatsAppText(p, type)
      });
      toast(LANG==='bn'?'✅ শেয়ার সম্পন্ন হয়েছে!':'✅ Shared successfully!');
      return;
    }
    
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = fileName;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    toast(LANG==='bn'?'📸 স্লিপ ইমেজ ডাউনলোড হয়েছে!':'📸 Receipt image downloaded!');
  } catch(e) {
    console.error(e);
    toast(LANG==='bn'?'❌ ইমেজ তৈরিতে সমস্যা হয়েছে':'❌ Failed to generate image');
  }
}

// ── CARD HISTORY TOGGLE (5 -> MAX 20) ──
const _expandedHistoryCards = new Set();

function renderCardHistoryItems(p, isExp) {
  if (!p || !p.history || !p.history.length) return '';
  const maxShown = isExp ? 20 : 5;
  const list = p.history.slice(0, maxShown);
  const items = list.map(h => `<div class="hi ${h.t==='add'?'ar':'pr'}"><span>${fmtD(h.date)} — ${h.note}</span><b style="color:var(--${h.t==='add'?'green':'red'})">${h.t==='add'?'+':'-'} ৳${fmt(h.amt)}</b></div>`).join('');
  
  if (p.history.length <= 5) {
    return items;
  }
  
  const total = p.history.length;
  const countToDisplay = Math.min(20, total);
  const btnLabel = isExp 
    ? (LANG === 'bn' ? 'কম দেখুন' : 'Show less')
    : (LANG === 'bn' ? `সব ইতিহাস দেখুন (${countToDisplay}টি)` : `View all history (${countToDisplay})`);
  
  const notice = (isExp && total > 20)
    ? `<div class="hist-more-notice">${LANG === 'bn' ? `(সর্বোচ্চ ২০টি প্রদর্শিত, মোট ${total}টি)` : `(Showing max 20 of ${total} total)`}</div>`
    : '';
    
  const cardType = p._type || (DB.receive.some(x=>x.id===p.id)?'receive':'give');
  return `
    ${items}
    <div class="hist-toggle-wrap">
      <button type="button" class="btn-hist-toggle" onclick="toggleCardHistory('${cardType}', ${p.id}, event)">
        <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" style="vertical-align:middle;margin-right:2px;">
          ${isExp ? '<path d="m18 15-6-6-6 6"/>' : '<path d="m6 9 6 6 6-6"/>'}
        </svg>
        <span>${btnLabel}</span>
      </button>
      ${notice}
    </div>
  `;
}

function toggleCardHistory(type, id, ev){
  if (ev) {
    ev.stopPropagation();
    ev.preventDefault();
  }
  let p = DB[type]?.find(x => x.id === id);
  if (!p) {
    p = DB.receive.find(x => x.id === id) || DB.give.find(x => x.id === id);
    if (!p) return;
  }
  
  if (_expandedHistoryCards.has(id)) {
    _expandedHistoryCards.delete(id);
  } else {
    _expandedHistoryCards.add(id);
  }
  
  const wrap = document.getElementById('hist-wrap-' + id);
  if (!wrap) return;
  
  const isExp = _expandedHistoryCards.has(id);
  wrap.innerHTML = renderCardHistoryItems(p, isExp);
}

// ── RENDER CARD ──
function renderCard(p,type){
  const settled=p.remaining<=0;
  if(settled&&TAB!=='a')return'';
  const d=ageDays(p),b=ageBadge(Math.abs(d));
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
      <div class="card-action-grid">
        <div class="cag-row cag-primary">
          <button class="btn-a btn-pay" onclick="openPay('${type}',${p.id})"><svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 5v14"/><path d="m19 12-7 7-7-7"/></svg><span class="bn">পরিশোধ</span><span class="en">Pay</span></button>
          ${!settled ? `<button class="btn-a btn-all-clear" onclick="oneClickAllClear('${type}',${p.id},event)" title="${LANG==='bn'?'১-ক্লিকে সম্পূর্ণ পরিশোধ':'One-Click Full Paid'}"><svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" style="vertical-align:middle;margin-right:2px;"><path d="M18 6 7 17l-5-5"/><path d="m22 10-7.5 7.5L13 16"/></svg><span class="bn">সব শোধ</span><span class="en">All Clear</span></button>` : ''}
          <button class="btn-a btn-add-more" onclick="openAddMore('${type}',${p.id})"><svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12h14"/><path d="M12 5v14"/></svg><span class="bn">আরো যোগ</span><span class="en">Add More</span></button>
        </div>
        <div class="cag-row cag-secondary">
          <button class="btn-a btn-receipt" onclick="openReceipt('${type}',${p.id})" title="WhatsApp Share / রসিদ স্লিপ"><svg xmlns="http://www.w3.org/2000/svg" width="15" height="15" viewBox="0 0 24 24" fill="#25D366" style="flex-shrink:0;"><path d="M12.04 2c-5.46 0-9.91 4.45-9.91 9.91 0 1.75.46 3.45 1.32 4.95L2.05 22l5.25-1.38c1.45.79 3.08 1.21 4.74 1.21 5.46 0 9.91-4.45 9.91-9.91 0-2.65-1.03-5.14-2.9-7.01A9.816 9.816 0 0 0 12.04 2m.01 1.67c2.2 0 4.26.86 5.82 2.42a8.225 8.225 0 0 1 2.41 5.83c0 4.54-3.7 8.24-8.24 8.24-1.48 0-2.93-.4-4.2-1.15l-.3-.18-3.12.82.83-3.04-.2-.31a8.196 8.196 0 0 1-1.26-4.38c0-4.54 3.7-8.24 8.24-8.24m4.52 11.66c-.25-.13-1.47-.72-1.7-.81-.23-.08-.39-.13-.56.13-.17.25-.64.81-.79.97-.14.17-.29.19-.54.06-.25-.13-1.06-.39-2.02-1.25-.75-.67-1.26-1.5-1.4-1.76-.15-.25-.02-.39.11-.51.11-.11.25-.29.37-.44.13-.15.17-.25.25-.42.08-.17.04-.31-.02-.44-.06-.13-.56-1.35-.77-1.85-.2-.49-.41-.42-.56-.43h-.48c-.17 0-.44.06-.67.31-.23.25-.88.86-.88 2.1 0 1.24.9 2.44 1.03 2.61.13.17 1.78 2.71 4.3 3.8 2.53 1.08 2.53.72 2.99.68.45-.05 1.47-.6 1.68-1.18.21-.58.21-1.07.15-1.18-.07-.11-.23-.17-.48-.3"/></svg><span class="bn">WhatsApp স্লিপ</span><span class="en">Receipt Slip</span></button>
          <button class="btn-a btn-edit-entry" onclick="openEdit('${type}',${p.id})"><svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4Z"/></svg><span class="bn">এডিট</span><span class="en">Edit</span></button>
          <button class="btn-a btn-del-bold" onclick="deleteEntry('${type}',${p.id})" title="${LANG==='bn'?'ডিলিট':'Delete'}"><svg xmlns="http://www.w3.org/2000/svg" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 6h18"/><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"/><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"/></svg></button>
        </div>
      </div>
      <div class="hh" style="margin-top:14px;">HISTORY</div>
      <div id="hist-wrap-${p.id}" class="hist-wrap">
        ${renderCardHistoryItems(p, _expandedHistoryCards.has(p.id))}
      </div>
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
  ensureWallets();
  updateMonthFilterUI();
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
