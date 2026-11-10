(function(){
  const params=new URLSearchParams(location.hash.slice(1));
  if(params.get('type')==='signup'||params.get('type')==='email_change') sessionStorage.setItem('ht_verify_flow','1');
})();

const SB_URL='https://hmqckyecenigcjikfjob.supabase.co';
const SB_KEY='eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImhtcWNreWVjZW5pZ2NqaWtmam9iIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzY5MzUzMDMsImV4cCI6MjA5MjUxMTMwM30.1pyoIp6-GegOVERyroNm0MlkPe4VOAiBL-bU-iJP2gU';
const sb=supabase.createClient(SB_URL,SB_KEY);
const escapeHTML=HisabSafety.escapeHTML;
const money=n=>Math.round((Number(n)+Number.EPSILON)*100)/100;
const validAmount=n=>Number.isFinite(n)&&n>0&&n<=1e12;
let _lastId=0;
function nextId(){_lastId=Math.max(_lastId+1,Date.now()*1000+Math.floor(Math.random()*1000));return _lastId;}
let accountSync=null, appLoading=false;
function canonical(input){
  const out=JSON.parse(JSON.stringify(input||{}));
  if(out.profilesData){
    if(!out.pinHash){for(const p of Object.values(out.profilesData)){if(p.pinHash){out.pinHash=p.pinHash;break;}}}
    for(const k of ['receive','give','activityLog','categories','activeProfileId'])delete out[k];
    for(const p of Object.values(out.profilesData))delete p.pinHash;
  }
  if(out._cash?.profilesData){for(const k of ['balance','history','wallets','budget','monthlyBudgets'])delete out._cash[k];}
  if(out.profilesData||Array.isArray(out.receive))HisabSafety.validate(out,out._cash||{balance:0,history:[]});
  return out;
}
function makeSnapshot(){
  ensureProfilesStructure();
  for(const p of Object.values(ROOT_DB.profilesData)){for(const kind of ['receive','give'])for(const x of p[kind]){x.original=money(x.original);x.remaining=money(x.remaining);for(const h of x.history)h.amt=money(h.amt);}}
  for(const p of Object.values(ROOT_CASH_DB.profilesData)){if(p.wallets){for(const k of Object.keys(p.wallets))p.wallets[k]=money(p.wallets[k]);p.balance=money(Object.values(p.wallets).reduce((s,v)=>s+v,0));}for(const h of p.history||[])h.amt=money(h.amt);}
  ROOT_DB._cash=ROOT_CASH_DB;return canonical(ROOT_DB);
}
function applySnapshot(data){
  ROOT_DB=JSON.parse(JSON.stringify(data||{}));
  if(ROOT_DB._cash)ROOT_CASH_DB=ROOT_DB._cash;
  ensureProfilesStructure();

}
function showAccountState(state,error){
  setSyncState('synced');
  document.body.dataset.saveState=state;
  if(error)console.warn('HisabTracker save:',error.message||String(error));
}
function getAccountSync(){
  if(!CUR_USER)throw new Error('Please sign in');
  if(!accountSync||accountSync.userId!==CUR_USER.id){accountSync?.stop();accountSync=new HisabSync.Store({client:sb,storage:localStorage,userId:CUR_USER.id,normalize:canonical,onState:showAccountState});}
  return accountSync;
}
function downloadJSON(value,name){const url=URL.createObjectURL(new Blob([JSON.stringify(value,null,2)],{type:'application/json'}));const a=document.createElement('a');a.href=url;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);}
// Track anonymous visit

let ROOT_DB = null;
let ROOT_CASH_DB = null;
let DB = { receive: [], give: [], activityLog: [] };
let CASH_DB = { balance: 0, history: [] };

function ensureProfilesStructure(){
  if(!ROOT_DB || typeof ROOT_DB !== 'object'){
    ROOT_DB = {};
  }
  if(!ROOT_DB.profiles || !Array.isArray(ROOT_DB.profiles) || ROOT_DB.profiles.length === 0){
    ROOT_DB.profiles = [
      { id: 'default', name: 'ব্যক্তিগত', icon: '👤', isDefault: true, createdAt: Date.now() }
    ];
  }
  if(!ROOT_DB.profilesData || typeof ROOT_DB.profilesData !== 'object'){
    ROOT_DB.profilesData = {};
  }
  if(!ROOT_DB.pinHash&&DB.pinHash)ROOT_DB.pinHash=DB.pinHash;
  if(!ROOT_DB.profilesData['default']){
    ROOT_DB.profilesData['default'] = {
      receive: Array.isArray(ROOT_DB.receive) ? ROOT_DB.receive : (DB.receive || []),
      give: Array.isArray(ROOT_DB.give) ? ROOT_DB.give : (DB.give || []),
      activityLog: Array.isArray(ROOT_DB.activityLog) ? ROOT_DB.activityLog : (DB.activityLog || []),
      categories: ROOT_DB.categories || DB.categories || {}
    };
  }

  // Active profile ID resolution
  const userKey = (typeof CUR_USER !== 'undefined' && CUR_USER) ? CUR_USER.id : 'guest';
  const savedActive = localStorage.getItem('ht_active_profile_' + userKey);
  if(savedActive && ROOT_DB.profiles.some(p => p.id === savedActive)){
    ROOT_DB.activeProfileId = savedActive;
  } else if(!ROOT_DB.activeProfileId || !ROOT_DB.profiles.some(p => p.id === ROOT_DB.activeProfileId)){
    ROOT_DB.activeProfileId = 'default';
  }

  // Bind active profile to DB
  const actId = ROOT_DB.activeProfileId;
  if(!ROOT_DB.profilesData[actId]){
    ROOT_DB.profilesData[actId] = { receive: [], give: [], activityLog: [], categories: {} };
  }
  DB = ROOT_DB.profilesData[actId];
  if(!DB.receive) DB.receive = [];
  if(!DB.give) DB.give = [];
  if(!DB.activityLog) DB.activityLog = [];
  if(!DB.categories) DB.categories = {};

  // CASH_DB Profiles structure
  if(!ROOT_CASH_DB || typeof ROOT_CASH_DB !== 'object'){
    ROOT_CASH_DB = {};
  }
  if(!ROOT_CASH_DB.profilesData || typeof ROOT_CASH_DB.profilesData !== 'object'){
    ROOT_CASH_DB.profilesData = {};
  }
  if(!ROOT_CASH_DB.profilesData['default']){
    ROOT_CASH_DB.profilesData['default'] = {
      balance: typeof ROOT_CASH_DB.balance === 'number' ? ROOT_CASH_DB.balance : (CASH_DB.balance || 0),
      history: Array.isArray(ROOT_CASH_DB.history) ? ROOT_CASH_DB.history : (CASH_DB.history || []),
      wallets: ROOT_CASH_DB.wallets || CASH_DB.wallets || null,
      budget: ROOT_CASH_DB.budget || CASH_DB.budget || 0,
      monthlyBudgets: ROOT_CASH_DB.monthlyBudgets || CASH_DB.monthlyBudgets || {}
    };
  }
  if(!ROOT_CASH_DB.profilesData[actId]){
    ROOT_CASH_DB.profilesData[actId] = {
      balance: 0,
      history: [],
      wallets: { cash: 0, bkash: 0, nagad: 0, bank: 0 },
      budget: 0,
      monthlyBudgets: {}
    };
  }
  CASH_DB = ROOT_CASH_DB.profilesData[actId];
  if(!CASH_DB.history) CASH_DB.history = [];
  if(typeof ensureWallets === 'function') ensureWallets();

  // Sanitize cached cashAdd quick tags (remove Salary, ensure Family & Pocket Money)
  if(DB.categories && Array.isArray(DB.categories.cashAdd)){
    DB.categories.cashAdd = DB.categories.cashAdd.filter(c => !c.l || (!c.l.includes('Salary') && !c.l.includes('বেতন')));
    if(!DB.categories.cashAdd.some(c => c.l && (c.l.includes('Family') || c.l.includes('পরিবার')))){
      DB.categories.cashAdd.unshift({e:'👨‍👩‍👧',l:'Family'});
    }
    if(!DB.categories.cashAdd.some(c => c.l && (c.l.includes('Pocket') || c.l.includes('পকেটমানি')))){
      DB.categories.cashAdd.splice(1, 0, {e:'💵',l:'পকেটমানি / Pocket Money'});
    }
  }
}

// ── DEFAULT CATEGORIES ──
const DEFAULT_CATS={
  cashAdd:   [{e:'👨‍👩‍👧',l:'Family'},{e:'💵',l:'পকেটমানি / Pocket Money'},{e:'🎁',l:'উপহার / Gift'},{e:'✅',l:'পাওনা উসুল / Received'}],
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
    return `<span class="qtag" data-val="${esc(val)}" data-target="${esc(targetInputId)}">${c.e?escapeHTML(c.e)+' ':''}<span>${escapeHTML(c.l)}</span></span>`;
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

function searchText(value){
  return String(value ?? '').normalize('NFKC').toLowerCase().replace(/[০-৯]/g,d=>String('০১২৩৪৫৬৭৮৯'.indexOf(d))).replace(/,/g,'');
}
function matchesSearch(values,query){
  const text=searchText(values.filter(v=>v!==undefined&&v!==null).join(' '));
  return searchText(query).trim().split(/\s+/).every(word=>text.includes(word));
}
function matchesPerson(person,query){
  return matchesSearch([person.name,person.note,person.original,person.remaining,person.date,fmtD(person.date),...(person.history||[]).flatMap(h=>[h.note,h.amt,h.date,fmtD(h.date)])],query);
}

function renderAll(){
  const q=document.getElementById('srch').value.toLowerCase().trim();
  const fl=list=>q?list.filter(p=>matchesPerson(p,q)):list;
  const all=fl([...DB.receive.map(p=>({...p,_type:'receive'})),...DB.give.map(p=>({...p,_type:'give'}))]).sort((a,b)=>b.id-a.id);
  document.getElementById('lst-a').innerHTML=all.length
    ?all.map(p=>renderCard(p,p._type)).filter(Boolean).join('')
    :emptyS(q?'খুঁজে পাওয়া যায়নি — অন্য নাম, নোট বা পরিমাণ দিয়ে দেখুন':'কোনো রেকর্ড নেই',q?'No matches — try another name, note or amount':'No records','<svg xmlns="http://www.w3.org/2000/svg" width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/></svg>');
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

// ── BUDGET (IN-APP MODAL) ──
function getMonthlyBudget(){return CASH_DB.monthlyBudgets?.[CASH_SELECTED_MONTH]??CASH_DB.budget??0;}
function setBudget(){
  const cur = getMonthlyBudget();
  const inp = document.getElementById('budget-modal-amt');
  if(inp){
    inp.value = cur > 0 ? cur : '';
    if(cur > 0) inp.classList.add('has-val');
    else inp.classList.remove('has-val');
  }
  const remBtn = document.getElementById('budget-modal-remove-btn');
  if(remBtn) remBtn.style.display = cur > 0 ? 'block' : 'none';
  document.getElementById('m-budget').classList.add('on');
  setTimeout(()=>{ if(inp) inp.focus(); }, 150);
}

function confirmBudget(){
  const {saveData,saveCashData,saveCats,render,renderCash,renderHisabMiniWallets,renderAllQtags,renderCatMgrSections,updateProfileHeaderUI,cm,closeCashForm,openProfileSwitcher,switchProfile,toast}=confirmedEffects;
  const inp = document.getElementById('budget-modal-amt');
  if(!inp) return;
  const val = inp.value.trim();
  if(!val){
    toast('⚠️ ' + (LANG === 'bn' ? 'সঠিক পরিমাণ দিন' : 'Enter valid amount'));
    return;
  }
  const num = parseFloat(val);
  if(!validAmount(money(num))){
    toast('⚠️ ' + (LANG === 'bn' ? 'সঠিক পরিমাণ দিন' : 'Enter valid amount'));
    return;
  }
  if(!CASH_DB.monthlyBudgets)CASH_DB.monthlyBudgets={};CASH_DB.monthlyBudgets[CASH_SELECTED_MONTH]=money(num);
  saveCashData();
  renderCash();
  cm('m-budget');
  toast('🎯 ' + (LANG === 'bn' ? 'বাজেট সেট হয়েছে' : 'Budget set!'));
}

function removeBudget(){
  const {saveData,saveCashData,saveCats,render,renderCash,renderHisabMiniWallets,renderAllQtags,renderCatMgrSections,updateProfileHeaderUI,cm,closeCashForm,openProfileSwitcher,switchProfile,toast}=confirmedEffects;
  cm('m-budget');
  if(!CASH_DB.monthlyBudgets)CASH_DB.monthlyBudgets={};CASH_DB.monthlyBudgets[CASH_SELECTED_MONTH]=0;
  saveCashData();
  renderCash();
  toast(LANG === 'bn' ? 'বাজেট সরানো হয়েছে' : 'Budget removed');
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
      <span class="settle-text"><span class="bn">${escapeHTML(topG.name)} কে দিলে বড় দেনা শেষ হবে</span><span class="en">Pay ${escapeHTML(topG.name)} to clear biggest debt</span></span>
      <span class="settle-amt">৳${fmt(topG.remaining)}</span>
    </div>`;
  }
  box.innerHTML=html;
  box.style.display='block';
}


// init
function updateDynamicPlaceholders(){
  const cs = document.getElementById('cash-srch');
  if(cs) cs.placeholder = LANG === 'bn' ? 'নোট, টাকা, তারিখ বা ওয়ালেট খুঁজুন' : 'Search note, amount, date or wallet';
  const hs = document.getElementById('srch');
  if(hs) hs.placeholder = LANG === 'bn' ? 'নাম, নোট, টাকা বা তারিখ খুঁজুন' : 'Search name, note, amount or date';
  const qaAmt = document.getElementById('qa-amt');
  if(qaAmt) qaAmt.placeholder = LANG === 'bn' ? 'পরিমাণ ৳' : 'Amount ৳';
  const qaNote = document.getElementById('qa-note');
  if(qaNote) qaNote.placeholder = LANG === 'bn' ? 'নোট / বিবরণ' : 'Note / Description';
  const qaName = document.getElementById('qa-name');
  if(qaName) qaName.placeholder = LANG === 'bn' ? 'ব্যক্তির নাম' : 'Party Name';
  const tfAmt = document.getElementById('tf-amt');
  if(tfAmt) tfAmt.placeholder = LANG === 'bn' ? 'ট্রান্সফারের পরিমাণ ৳' : 'Transfer Amount ৳';
  const tfNote = document.getElementById('tf-note');
  if(tfNote) tfNote.placeholder = LANG === 'bn' ? 'নোট (যেমন: এটিএম ক্যাশ, বিকাশ ইন)' : 'Note (e.g., ATM Cash, bKash In)';
  const bAmt = document.getElementById('budget-modal-amt');
  if(bAmt) bAmt.placeholder = LANG === 'bn' ? 'বাজেটের পরিমাণ ৳' : 'Target Amount ৳';
}
document.documentElement.setAttribute('data-lang',LANG);
updateDynamicPlaceholders();
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
  window.scrollTo({top:0,behavior:'instant'});
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
  const logoSub=document.getElementById('hdr-logo-sub');
  const badge=document.getElementById('mode-badge');
  if(logoText){
    logoText.innerHTML='<span class="bn">হিসাব ট্র্যাকার</span><span class="en">Hisab Tracker</span>';
    logoText.className='logo-main';
  }
  if(isHisab){
    if(logoSub) logoSub.innerHTML='<span class="bn">দেনা-পাওনা • PRO</span><span class="en">HISAB • PRO</span>';
    if(badge){
      badge.innerHTML='<span class="bn">দেনা-পাওনা</span><span class="en">HISAB</span>';
      badge.className='mode-badge hisab';
    }
    renderHisabMiniWallets();
  } else {
    if(logoSub) logoSub.innerHTML='<span class="bn">দৈনন্দিন আয়-ব্যয় • PRO</span><span class="en">EXPENSE • PRO</span>';
    if(badge){
      badge.innerHTML='<span class="bn">আয়-ব্যয়</span><span class="en">CASH</span>';
      badge.className='mode-badge cash';
    }
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
  DB.activityLog.unshift({id:nextId(),ts:Date.now(),action,detail});
  if(DB.activityLog.length>100)DB.activityLog=DB.activityLog.slice(0,100);
}
function openActivityLog(){
  closeDrawer();
  const logs=(DB.activityLog||[]).slice(0,30);
  document.getElementById('log-list').innerHTML=logs.length
    ?logs.map(l=>`<div class="alog-item"><div class="alog-action">${escapeHTML(l.action)}</div>${l.detail?`<div class="alog-meta">${escapeHTML(l.detail)}</div>`:''}<div class="alog-meta">${fmtD(l.ts)}</div></div>`).join('')
    :'<div class="empty"><div class="empty-i" style="color:var(--muted)"><svg xmlns="http://www.w3.org/2000/svg" width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="22 12 16 12 14 15 10 15 8 12 2 12"/><path d="M5.45 5.11 2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6l-3.45-6.89A2 2 0 0 0 16.76 4H7.24a2 2 0 0 0-1.79 1.11z"/></svg></div><div class="empty-t">কোনো log নেই</div></div>';
  document.getElementById('m-log').classList.add('on');
}


// ── ANALYTICS ──
function openAnalytics(){
  closeDrawer();
  const reportText=(bn,en)=>LANG==='bn'?bn:en;
  const hist=CASH_DB.history||[];
  const now=new Date();
  
  // Monthly data last 6 months
  const months=[];
  for(let i=5;i>=0;i--){
    const d=new Date(now.getFullYear(),now.getMonth()-i,1);
    months.push({
      label:d.toLocaleDateString(LANG==='bn'?'bn-BD':'en-GB',{month:'short',year:'2-digit'}),
      year:d.getFullYear(),month:d.getMonth(),
      income:0,expense:0
    });
  }
  hist.forEach(h=>{
    const d=new Date(h.date);
    const m=months.find(x=>x.year===d.getFullYear()&&x.month===d.getMonth());
    if(!m)return;
    if(h.type==='add')m.income+=h.amt;
    else if(h.type==='sub')m.expense+=h.amt;
  });

  // Category breakdown this month
  const thisMonthHist=hist.filter(h=>{
    const d=new Date(h.date);
    return d.getMonth()===now.getMonth()&&d.getFullYear()===now.getFullYear();
  });
  const catMap={};
  thisMonthHist.filter(h=>h.type==='sub').forEach(h=>{
    const key=formatTxnNote(h)||reportText('অন্যান্য','Other');
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
        <span style="font-size:12px;font-weight:600;color:var(--text);">${escapeHTML(name)}</span>
        <span style="font-size:12px;font-weight:700;color:var(--red);">৳${fmt(amt)}</span>
      </div>
      <div style="height:6px;background:var(--border);border-radius:99px;overflow:hidden;">
        <div style="height:100%;width:${Math.round((amt/catTotal)*100)}%;background:var(--red);border-radius:99px;opacity:.8;"></div>
      </div>
    </div>`).join('')
    :'<div style="color:var(--muted);font-size:13px;text-align:center;padding:16px;"><span class="bn">এই মাসে কোনো খরচ নেই</span><span class="en">No expenses this month</span></div>';

  const thisM=months[months.length-1];
  const savings=thisM.income-thisM.expense;

  document.getElementById('analytics-content').innerHTML=`
    <!-- This month summary -->
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-bottom:16px;">
      <div style="background:rgba(16,185,129,.1);border:1px solid rgba(16,185,129,.3);border-radius:12px;padding:12px;">
        <div style="font-size:10px;font-weight:700;color:var(--green);text-transform:uppercase;margin-bottom:4px;">${reportText('এই মাসে আয়','Income this month')}</div>
        <div style="font-size:18px;font-weight:900;color:var(--green);">৳${fmt(thisM.income)}</div>
      </div>
      <div style="background:rgba(239,68,68,.1);border:1px solid rgba(239,68,68,.3);border-radius:12px;padding:12px;">
        <div style="font-size:10px;font-weight:700;color:var(--red);text-transform:uppercase;margin-bottom:4px;">${reportText('এই মাসে খরচ','Expenses this month')}</div>
        <div style="font-size:18px;font-weight:900;color:var(--red);">৳${fmt(thisM.expense)}</div>
      </div>
    </div>
    <div style="background:${savings>=0?'rgba(16,185,129,.08)':'rgba(239,68,68,.08)'};border:1px solid ${savings>=0?'rgba(16,185,129,.3)':'rgba(239,68,68,.3)'};border-radius:12px;padding:12px;margin-bottom:16px;display:flex;justify-content:space-between;align-items:center;">
      <div style="font-size:13px;font-weight:700;color:var(--text);">${reportText('এই মাসে সেভিংস','Net savings this month')}</div>
      <div style="font-size:20px;font-weight:900;color:${savings>=0?'var(--green)':'var(--red)'};">${savings>=0?'+':'-'}৳${fmt(Math.abs(savings))}</div>
    </div>

    <!-- Bar chart -->
    <div style="background:var(--surface);border:1px solid var(--border);border-radius:14px;padding:14px;margin-bottom:16px;">
      <div style="font-size:12px;font-weight:700;color:var(--text);margin-bottom:10px;">${reportText('গত ৬ মাস','Last 6 months')}</div>
      <div style="display:flex;gap:4px;align-items:flex-end;">${barHTML}</div>
      <div style="display:flex;gap:12px;margin-top:8px;justify-content:center;">
        <span style="font-size:10px;color:var(--green);font-weight:700;display:flex;align-items:center;gap:4px;"><span style="width:10px;height:10px;background:var(--green);border-radius:2px;display:inline-block;"></span>${reportText('আয়','Income')}</span>
        <span style="font-size:10px;color:var(--red);font-weight:700;display:flex;align-items:center;gap:4px;"><span style="width:10px;height:10px;background:var(--red);border-radius:2px;display:inline-block;"></span>${reportText('খরচ','Expense')}</span>
      </div>
    </div>

    <!-- Category breakdown -->
    <div style="background:var(--surface);border:1px solid var(--border);border-radius:14px;padding:14px;margin-bottom:16px;">
      <div style="font-size:12px;font-weight:700;color:var(--text);margin-bottom:12px;">${reportText('এই মাসের খরচ — Category অনুযায়ী','Spending by category this month')}</div>
      ${catHTML}
    </div>

    <!-- Hisab summary -->
    <div style="background:var(--surface);border:1px solid var(--border);border-radius:14px;padding:14px;">
      <div style="font-size:12px;font-weight:700;color:var(--text);margin-bottom:12px;">${reportText('হিসাব সারসংক্ষেপ','Account summary')}</div>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;">
        <div style="background:rgba(16,185,129,.08);border-radius:10px;padding:10px;">
          <div style="font-size:10px;color:var(--green);font-weight:700;text-transform:uppercase;margin-bottom:3px;">${reportText('মোট পাওনা','Total receivables')}</div>
          <div style="font-size:16px;font-weight:900;color:var(--green);">৳${fmt(totalReceive)}</div>
        </div>
        <div style="background:rgba(239,68,68,.08);border-radius:10px;padding:10px;">
          <div style="font-size:10px;color:var(--red);font-weight:700;text-transform:uppercase;margin-bottom:3px;">${reportText('মোট দেনা','Total payables')}</div>
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
            <input class="catmgr-emoji" type="text" maxlength="4" value="${escapeHTML(c.e||'')}" placeholder="🏷" onchange="updateCat('${key}',${i},'e',this.value)">
            <input class="catmgr-label" type="text" value="${escapeHTML(c.l||'')}" placeholder="Label" onchange="updateCat('${key}',${i},'l',this.value)">
            <button class="catmgr-del" onclick="deleteCat('${key}',${i})">✕</button>
          </div>`).join('')}
      </div>
      <button class="catmgr-add-btn" onclick="addCat('${key}')">+ Add Tag</button>
    </div>`;
  });
  cont.innerHTML=html;
}
function updateCat(key,idx,field,val){
  const {saveData,saveCashData,saveCats,render,renderCash,renderHisabMiniWallets,renderAllQtags,renderCatMgrSections,updateProfileHeaderUI,cm,closeCashForm,openProfileSwitcher,switchProfile,toast}=confirmedEffects;
  if(!DB.categories[key])return;
  DB.categories[key][idx][field]=val;
  saveCats();
}
function addCat(key){
  const {saveData,saveCashData,saveCats,render,renderCash,renderHisabMiniWallets,renderAllQtags,renderCatMgrSections,updateProfileHeaderUI,cm,closeCashForm,openProfileSwitcher,switchProfile,toast}=confirmedEffects;
  if(!DB.categories[key])DB.categories[key]=[];
  DB.categories[key].push({e:'',l:'New Tag'});
  saveCats();
  renderCatMgrSections();
}
function deleteCat(key,idx){
  const {saveData,saveCashData,saveCats,render,renderCash,renderHisabMiniWallets,renderAllQtags,renderCatMgrSections,updateProfileHeaderUI,cm,closeCashForm,openProfileSwitcher,switchProfile,toast}=confirmedEffects;
  if(!DB.categories[key])return;
  DB.categories[key].splice(idx,1);
  saveCats();
  renderCatMgrSections();
  toast('🗑️ Tag মুছে গেছে');
}

// ── AUTH ──
let authMode='login';
function switchAuthTab(mode,el){
  if(authBusy)return;
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
let authBusy=false;
function lockAuthControls(locked){
  document.querySelectorAll('#auth-screen input,#auth-screen button').forEach(el=>el.disabled=locked);
}
async function authSubmit(){
  if(authBusy)return;
  const email=document.getElementById('au-email').value.trim();
  const pass=document.getElementById('au-pass').value;
  if(!email||!pass){setAuthMsg(LANG==='bn'?'ইমেইল ও পাসওয়ার্ড দিন।':'Enter email and password.','err');return;}
  const mode=authMode;
  const btn=document.getElementById('au-btn');
  authBusy=true;lockAuthControls(true);setAuthMsg('','');
  btn.querySelector('.bn').textContent='অপেক্ষা করুন…';
  btn.querySelector('.en').textContent='Please wait…';
  try{
    const {data,error}=await(mode==='login'
      ?sb.auth.signInWithPassword({email,password:pass})
      :sb.auth.signUp({email,password:pass,options:{data:{display_name:document.getElementById('au-name').value.trim().slice(0,100)}}}));
    if(error){
      const message=error.message||'';
      const pair=message.includes('Invalid login')?['ইমেইল বা পাসওয়ার্ড ভুল।','Incorrect email or password.']:
        message.includes('already')?['এই ইমেইলে অ্যাকাউন্ট আছে। লগইন করুন।','An account already exists. Please sign in.']:
        /password/i.test(message)?['পাসওয়ার্ড কমপক্ষে ৬ অক্ষরের দিন।','Use a password with at least 6 characters.']:
        /confirm/i.test(message)?['আগে ইমেইলের লিংক দিয়ে অ্যাকাউন্ট নিশ্চিত করুন।','Confirm your account using the email link first.']:
        ['এখন লগইন বা নিবন্ধন করা যায়নি। সংযোগ দেখে আবার চেষ্টা করুন।','Could not sign in or register. Check your connection and try again.'];
      setAuthMsg(pair[LANG==='bn'?0:1],'err');return;
    }
    if(mode==='register'&&!data.session)setAuthMsg(LANG==='bn'?'নিবন্ধন হয়েছে। ইমেইল নিশ্চিত করে লগইন করুন।':'Registered. Verify your email, then sign in.','ok');
  }catch(error){
    setAuthMsg(LANG==='bn'?'সংযোগে সমস্যা হয়েছে। আবার চেষ্টা করুন।':'Connection failed. Please try again.','err');
  }finally{
    authBusy=false;lockAuthControls(false);
    btn.querySelector('.bn').textContent=authMode==='login'?'লগইন করুন →':'রেজিস্টার করুন →';
    btn.querySelector('.en').textContent=authMode==='login'?'Login →':'Register →';
  }
}
async function authForgot(){
  if(authBusy)return;
  const email=document.getElementById('au-email').value.trim();
  if(!email){setAuthMsg(LANG==='bn'?'আগে ইমেইল দিন।':'Enter your email first.','err');return;}
  authBusy=true;lockAuthControls(true);
  try{
    const {error}=await sb.auth.resetPasswordForEmail(email,{redirectTo:location.origin+location.pathname});
    if(error)throw error;
    setAuthMsg(LANG==='bn'?'আপনার অ্যাকাউন্ট থাকলে ইমেইলে রিসেট নির্দেশনা পাবেন।':'If an account exists, check your email for reset instructions.','ok');
  }catch(error){setAuthMsg(LANG==='bn'?'রিসেট নির্দেশনা পাঠানো যায়নি। আবার চেষ্টা করুন।':'Could not send reset instructions. Please try again.','err');}
  finally{authBusy=false;lockAuthControls(false);}
}
async function signOut(){
  if(savingChange)return;
  const leavingUser=CUR_USER?.id;
  try{
    const {error}=await sb.auth.signOut();
    if(error)throw error;
  }catch(error){toast(LANG==='bn'?'লগআউট হয়নি। আবার চেষ্টা করুন।':'Sign out failed. Please try again.');return;}
  accountSync?.stop();accountSync=null;_dataLoaded=false;
  localStorage.removeItem('ht_has_session');
  document.documentElement.classList.remove('has-session');
  if(leavingUser)localStorage.removeItem('ht_tr_'+leavingUser);
  CUR_USER=null;
  ROOT_DB=null; ROOT_CASH_DB=null;
  DB={receive:[],give:[],activityLog:[]};
  CASH_DB={balance:0,history:[]};
  closeDrawer();
  document.getElementById('app').style.display='none';
  document.getElementById('pin-screen').style.display='none';
  document.getElementById('auth-screen').style.display='flex';
  document.body.style.overflow='';
  setAuthMsg('','');
}

// Synchronously restore session from Supabase localStorage cache to eliminate 1s login flash
function restoreCachedSession(){
  try {
    let cachedUser = null;
    for(let i = 0; i < localStorage.length; i++){
      const k = localStorage.key(i);
      if(k && k==='sb-hmqckyecenigcjikfjob-auth-token'){
        const item = JSON.parse(localStorage.getItem(k));
        if(item && item.user){
          cachedUser = item.user;
          break;
        }
      }
    }
    if(cachedUser){
      CUR_USER = cachedUser;
      localStorage.setItem('ht_has_session', '1');
      document.documentElement.classList.add('has-session');
      const email = CUR_USER.email || '';
      const av = document.getElementById('drw-av');
      if(av) av.textContent = email.charAt(0).toUpperCase();
      const drwName = document.getElementById('drw-name');
      if(drwName)drwName.textContent='profess0r.null';
      const em = document.getElementById('drw-email');
      if(em) em.textContent = email;

      // Hydrate local data immediately so UI renders in 0ms
      loadCashData();
      const raw = localStorage.getItem('ht_' + CUR_USER.id);
      if(raw){
        try { ROOT_DB = JSON.parse(raw); ensureProfilesStructure(); } catch(e){}
      }

    }
  } catch(e){}
}
restoreCachedSession();

let _appInitialized=false;
sb.auth.onAuthStateChange((event,session)=>{setTimeout(async()=>{
  if(sessionStorage.getItem('ht_verify_flow')==='1'){
    sessionStorage.removeItem('ht_verify_flow');
    localStorage.removeItem('ht_has_session');
    document.documentElement.classList.remove('has-session');
    document.getElementById('app').style.display='none';
    document.getElementById('pin-screen').style.display='none';
    document.getElementById('auth-screen').style.display='flex';
    document.getElementById('verified-banner').style.display='block';
    await sb.auth.signOut();
    return;
  }
  if(event==='PASSWORD_RECOVERY'){sessionStorage.setItem('ht_recovery_flow','1');}
  if(session&&session.user){
    CUR_USER=session.user;
    localStorage.setItem('ht_has_session', '1');
    document.documentElement.classList.add('has-session');
    document.getElementById('auth-screen').style.display='none';
    const email=CUR_USER.email||'';
    const av = document.getElementById('drw-av');
    if(av) av.textContent=email.charAt(0).toUpperCase();
    const drwName = document.getElementById('drw-name');
    if(drwName)drwName.textContent='profess0r.null';
    const em = document.getElementById('drw-email');
    if(em) em.textContent=email;
    if(!_appInitialized){
      _appInitialized=true;
      try{if(sessionStorage.getItem('ht_recovery_flow')==='1'){sessionStorage.removeItem('ht_recovery_flow');await loadData();if(!getPin()){sessionStorage.setItem('ht_open_password_after_pin','1');await checkPin();}else{await showApp();openProfile();}}else await checkPin();}catch(error){_appInitialized=false;setAuthMsg(LANG==='bn'?'হিসাব খুলতে সমস্যা হয়েছে। আবার চেষ্টা করুন।':'Unable to load account. Please retry.','err');document.getElementById('auth-screen').style.display='flex';console.error(error);}
    }
  } else {
    _appInitialized=false;
    localStorage.removeItem('ht_has_session');
    document.documentElement.classList.remove('has-session');
    accountSync?.stop();accountSync=null;_dataLoaded=false;
    CUR_USER=null;
    ROOT_DB=null; ROOT_CASH_DB=null;
    DB={receive:[],give:[],activityLog:[]};
    CASH_DB={balance:0,history:[]};
    document.getElementById('app').style.display='none';
    document.getElementById('pin-screen').style.display='none';
    document.getElementById('auth-screen').style.display='flex';
  }
},0);});

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
let passwordChangeBusy=false;
async function changePassword(){
  if(passwordChangeBusy)return;
  const np=document.getElementById('pr-new').value;
  const cf=document.getElementById('pr-cf').value;
  const msg=document.getElementById('pr-msg');
  if(np.length<6){msg.className='modal-msg err';msg.textContent=LANG==='bn'?'কমপক্ষে ৬ অক্ষর দিন।':'Use at least 6 characters.';return;}
  if(np!==cf){msg.className='modal-msg err';msg.textContent=LANG==='bn'?'দুটি পাসওয়ার্ড মেলেনি।':'Passwords do not match.';return;}
  const controls=[...document.querySelectorAll('#m-profile input,#m-profile button')].map(el=>({el,disabled:el.disabled}));
  passwordChangeBusy=true;controls.forEach(({el})=>el.disabled=true);
  msg.className='modal-msg';msg.textContent=LANG==='bn'?'অপেক্ষা করুন…':'Please wait…';
  try{
    const {error}=await sb.auth.updateUser({password:np});
    if(error)throw error;
    document.getElementById('pr-new').value='';document.getElementById('pr-cf').value='';
    msg.className='modal-msg ok';msg.textContent=LANG==='bn'?'পাসওয়ার্ড পরিবর্তন হয়েছে।':'Password changed.';
  }catch(error){msg.className='modal-msg err';msg.textContent=LANG==='bn'?'পাসওয়ার্ড বদলানো যায়নি। সংযোগ দেখে আবার চেষ্টা করুন।':'Could not change password. Check your connection and try again.';}
  finally{passwordChangeBusy=false;controls.forEach(({el,disabled})=>el.disabled=disabled);}
}

// ── PIN ──
function ph(p){let h=5381;for(let i=0;i<p.length;i++)h=(h*33)^p.charCodeAt(i);return(h>>>0).toString(36);}
function pk(){return'ht_pin_'+CUR_USER.id;}
function tk(){return'ht_tr_'+CUR_USER.id;}
function getPin(){return ROOT_DB?.pinHash||null;}
function isTrusted(){return localStorage.getItem(tk())==='1';}
function setTrusted(){localStorage.setItem(tk(),'1');}

async function checkPin(){
  await loadData();
  await loadCashDataCloud();
  if(!getPin()){beginFirstPin();return;}
  if(isTrusted()){await showApp();return;}
  document.getElementById('auth-screen').style.display='none';document.getElementById('app').style.display='none';
  pinMode='unlock';pinBuf='';updDots('');document.getElementById('pin-err').textContent='';
  document.getElementById('pin-title').textContent=LANG==='bn'?'PIN দিন':'Enter PIN';
  document.getElementById('pin-sub').textContent=LANG==='bn'?'আপনার ৪ সংখ্যার PIN লিখুন':'Enter your 4-digit PIN';document.getElementById('pin-screen').style.display='flex';
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
  if(!getPin()){beginFirstPin();return;}
  closeDrawer();

  localStorage.removeItem(tk());
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
  if(savingChange||!/^\d$/.test(k)||pinBuf.length>=4)return;
  pinBuf+=k;updDots(pinBuf);
  document.getElementById('pin-err').textContent='';
  if(pinBuf.length===4)setTimeout(handlePin,120);
}
function pinDel(){if(savingChange)return;pinBuf=pinBuf.slice(0,-1);updDots(pinBuf);}
function handlePin(){
  const {saveData,saveCashData,saveCats,render,renderCash,renderHisabMiniWallets,renderAllQtags,renderCatMgrSections,updateProfileHeaderUI,cm,closeCashForm,openProfileSwitcher,switchProfile,toast}=confirmedEffects;
  const box=document.querySelector('.pin-box');
  if(pinMode==='unlock'){
    if(getPin()&&ph(pinBuf)===getPin()){
      setTrusted();
      document.getElementById('pin-screen').style.display='none';
      showApp();
    }else{
      updDots('0000','err');
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

      const firstPin=!getPin();
      ROOT_DB.pinHash=hash;
      logActivity(firstPin?'PIN তৈরি করা হয়েছে':'PIN পরিবর্তন করা হয়েছে');
      saveData();
      pinBuf='';pinTmp='';pinMode='unlock';
      document.getElementById('pin-screen').style.display='none';
      document.getElementById('app').style.display='block';
      toast(LANG==='bn'?(firstPin?'PIN তৈরি হয়েছে।':'PIN পরিবর্তন হয়েছে.'):(firstPin?'PIN created.':'PIN changed.'));
      if(firstPin)activeDraft.effects.push(()=>{
        setTrusted();showApp().then(()=>{
          if(sessionStorage.getItem('ht_open_password_after_pin')==='1'){sessionStorage.removeItem('ht_open_password_after_pin');openProfile();}
        }).catch(()=>toast(LANG==='bn'?'অ্যাপ খুলতে সমস্যা হয়েছে। পেজ রিফ্রেশ করুন।':'Unable to open the app. Refresh the page.'));
      });
    }else{
      updDots('0000','err');
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
  if(!getPin()){await checkPin();return;}
  document.getElementById('app').style.display='block';
  setSyncState('saving','Loading...');
    appLoading=true;document.getElementById('app').inert=true;
  if(!_dataLoaded)await loadData();
  await loadCashDataCloud();
  appLoading=false;document.getElementById('app').inert=false;

  updateProfileHeaderUI();


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
  if(!CUR_USER)return;
  let fallback;try{const raw=localStorage.getItem('ht_'+CUR_USER.id);if(raw)fallback=canonical(JSON.parse(raw));}catch(error){}
  const sync=getAccountSync();
  const data=await sync.load(fallback);
  if(data&&Object.keys(data).length)HisabSafety.validate(data,data._cash||{balance:0,history:[]});
  applySnapshot(data);_dataLoaded=true;
}
let _retrySyncTimeout=null;
async function saveData(){
  if(!CUR_USER)return false;
  const sync=getAccountSync(),ok=await sync.save(makeSnapshot(),String(nextId()));
  if(ok)applySnapshot(sync.current);
  return ok;
}

// ── CASH DATA ──
function cashKey(){return'ht_cash_'+(CUR_USER?CUR_USER.id:'guest');}
function loadCashData(){
  const raw=localStorage.getItem(cashKey());
  if(raw)try{ROOT_CASH_DB=JSON.parse(raw);}catch(e){}
  ensureProfilesStructure();
}
async function loadCashDataCloud(){
  if(ROOT_DB?._cash){ROOT_CASH_DB=ROOT_DB._cash;ensureProfilesStructure();return;}
  const {data,error}=await sb.from('hisab_cash').select('data').eq('id',CUR_USER.id).maybeSingle();
  if(error)throw error;
  // The database is authoritative. Old local cash copies are not auto-uploaded.
  ROOT_CASH_DB=data?.data||{balance:0,history:[]};
  HisabSafety.validate(ROOT_DB,ROOT_CASH_DB);ensureProfilesStructure();ROOT_DB._cash=ROOT_CASH_DB;
}

function saveCashData(){
  if(!CUR_USER)return Promise.resolve(false);
  ensureWallets();CASH_DB.balance=money(Object.values(CASH_DB.wallets).reduce((s,v)=>s+v,0));
  ROOT_CASH_DB.profilesData[ROOT_DB.activeProfileId||'default']=CASH_DB;
  if(typeof renderHisabMiniWallets==='function')renderHisabMiniWallets();
  return saveData();
}

// ── MULTI-PROFILE (KHATA / BOOKS) SYSTEM ──
function getActiveProfile(){
  ensureProfilesStructure();
  const actId = ROOT_DB.activeProfileId || 'default';
  return ROOT_DB.profiles.find(p => p.id === actId) || ROOT_DB.profiles[0];
}

function updateProfileHeaderUI(){
  const p = getActiveProfile();
  if(!p) return;
  const pillIcon = document.getElementById('hdr-profile-icon');
  const pillName = document.getElementById('hdr-profile-name');
  const isDefault = (!p.id || p.id === 'default' || p.name === 'ব্যক্তিগত' || p.name === 'Personal');
  const displayName = isDefault ? (LANG === 'bn' ? 'ব্যক্তিগত' : 'Personal') : (p.name || (LANG === 'bn' ? 'ব্যক্তিগত' : 'Personal'));

  if(pillIcon) pillIcon.textContent = p.icon || '📁';
  if(pillName) pillName.textContent = displayName;

  // Drawer profile info
  const drwIcon = document.getElementById('drw-profile-icon');
  const drwName = document.getElementById('drw-profile-name');
  if(drwIcon) drwIcon.textContent = p.icon || '📁';
  if(drwName) drwName.textContent = displayName;
}

function switchProfile(profileId, showToast = true){
  ensureProfilesStructure();
  const target = ROOT_DB.profiles.find(p => p.id === profileId);
  if(!target) return;

  ROOT_DB.activeProfileId = profileId;
  const userKey = (typeof CUR_USER !== 'undefined' && CUR_USER) ? CUR_USER.id : 'guest';
  localStorage.setItem('ht_active_profile_' + userKey, profileId);

  ensureProfilesStructure();
  updateProfileHeaderUI();

  // Re-render both views with the new profile data
  render();
  renderCash();
  renderAllQtags();

  // Sync to storage


  cm('m-profiles');
  if(showToast){
    toast(`${target.icon || '📁'} খাতা পরিবর্তিত: ${target.name}`);
  }
}

function openProfileSwitcher(){
  ensureProfilesStructure();
  const listEl = document.getElementById('profiles-list');
  if(!listEl) return;

  const activeId = ROOT_DB.activeProfileId || 'default';
  
  listEl.innerHTML = ROOT_DB.profiles.map(p => {
    const isActive = p.id === activeId;
    const hData = ROOT_DB.profilesData[p.id] || { receive: [], give: [] };
    const rTot = (hData.receive || []).reduce((s, x) => s + (x.remaining || 0), 0);
    const gTot = (hData.give || []).reduce((s, x) => s + (x.remaining || 0), 0);
    const cData = (ROOT_CASH_DB && ROOT_CASH_DB.profilesData && ROOT_CASH_DB.profilesData[p.id]) || { balance: 0 };
    const cBal = cData.balance || 0;

    const esc = escapeHTML;

    return `
      <div class="profile-card ${isActive ? 'active' : ''}" onclick="switchProfile('${p.id}')">
        <div class="pcard-icon">${escapeHTML(p.icon || '📁')}</div>
        <div class="pcard-info">
          <div class="pcard-title-row">
            <span class="pcard-name">${esc(p.name)}</span>
            ${isActive ? '<span class="pcard-badge-active"><span class="bn">✓ সক্রিয়</span><span class="en">Active</span></span>' : ''}
          </div>
          <div class="pcard-stats">
            <span>পাওনা: ৳${fmt(rTot)}</span>
            <span class="pcard-dot">•</span>
            <span>দেনা: ৳${fmt(gTot)}</span>
            <span class="pcard-dot">•</span>
            <span style="color:var(--text)">ক্যাশ: ৳${fmt(cBal)}</span>
          </div>
        </div>
        <div class="pcard-actions" onclick="event.stopPropagation()">
          <button class="pcard-action-btn" title="সম্পাদনা" onclick="openEditProfile('${p.id}')">
            <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 20h9"/><path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z"/></svg>
          </button>
          ${!p.isDefault && ROOT_DB.profiles.length > 1 ? `
          <button class="pcard-action-btn del" title="মুছুন" onclick="confirmDeleteProfile('${p.id}')">
            <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 6h18"/><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"/><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"/></svg>
          </button>
          ` : ''}
        </div>
      </div>
    `;
  }).join('');

  document.getElementById('m-profiles').classList.add('on');
}

let _editingProfileId = null;
let _selectedProfileEmoji = '📁';
const PROFILE_EMOJI_SUGGESTIONS = ['👤','🏢','💼','🛒','🏠','🍲','🎓','🚗','✈️','📱','🛠️','💰','📦','🤝','🎯','❤️'];

function openCreateProfileModal(){
  _editingProfileId = null;
  _selectedProfileEmoji = '📁';
  document.getElementById('m-pe-title').textContent = LANG === 'bn' ? 'নতুন খাতা / প্রোফাইল তৈরি' : 'Create New Profile / Book';
  document.getElementById('pe-name').value = '';
  document.getElementById('pe-custom-icon').value = '';
  renderEmojiPicker();
  cm('m-profiles');
  document.getElementById('m-profile-edit').classList.add('on');
}

function openEditProfile(id){
  ensureProfilesStructure();
  const p = ROOT_DB.profiles.find(x => x.id === id);
  if(!p) return;
  _editingProfileId = id;
  _selectedProfileEmoji = p.icon || '📁';
  document.getElementById('m-pe-title').textContent = LANG === 'bn' ? 'খাতা সম্পাদনা' : 'Edit Profile / Book';
  document.getElementById('pe-name').value = p.name;
  document.getElementById('pe-custom-icon').value = p.icon || '';
  renderEmojiPicker();
  cm('m-profiles');
  document.getElementById('m-profile-edit').classList.add('on');
}

function selectProfileEmoji(emoji){
  _selectedProfileEmoji = emoji;
  document.getElementById('pe-custom-icon').value = emoji;
  renderEmojiPicker();
}

function renderEmojiPicker(){
  const cont = document.getElementById('pe-emoji-picker');
  if(!cont) return;
  cont.innerHTML = PROFILE_EMOJI_SUGGESTIONS.map(e => {
    const isSel = e === _selectedProfileEmoji;
    return `<button type="button" class="pe-emoji-btn ${isSel ? 'selected' : ''}" onclick="selectProfileEmoji('${e}')">${e}</button>`;
  }).join('');
}

function saveProfileSubmit(){
  const {saveData,saveCashData,saveCats,render,renderCash,renderHisabMiniWallets,renderAllQtags,renderCatMgrSections,updateProfileHeaderUI,cm,closeCashForm,openProfileSwitcher,switchProfile,toast}=confirmedEffects;
  const nameInput = document.getElementById('pe-name');
  const name = nameInput.value.trim();
  if(!name){
    toast('❌ খাতার একটি নাম লিখুন!');
    nameInput.focus();
    return;
  }
  const customIcon = document.getElementById('pe-custom-icon').value.trim();
  const icon = customIcon || _selectedProfileEmoji || '📁';

  ensureProfilesStructure();

  if(_editingProfileId){
    const p = ROOT_DB.profiles.find(x => x.id === _editingProfileId);
    if(p){
      p.name = name;
      p.icon = icon;
    }
    toast(`✅ খাতা আপডেট হয়েছে: ${icon} ${name}`);
    cm('m-profile-edit');
    saveData();
    updateProfileHeaderUI();
    if(ROOT_DB.activeProfileId === _editingProfileId){
      render();
      renderCash();
    }
  } else {
    const newId = 'prof_' + nextId();
    ROOT_DB.profiles.push({
      id: newId,
      name: name,
      icon: icon,
      createdAt: Date.now()
    });
    ROOT_DB.profilesData[newId] = {
      receive: [],
      give: [],
      activityLog: [{ action: `খাতা তৈরি করা হয়েছে: ${name}`, ts: Date.now() }],
      categories: {}
    };
    ROOT_CASH_DB.profilesData[newId] = {
      balance: 0,
      history: [],
      wallets: { cash: 0, bkash: 0, nagad: 0, bank: 0 },
      budget: 0,
      monthlyBudgets: {}
    };
    cm('m-profile-edit');
    switchProfile(newId, false);
    toast(`🎉 নতুন খাতা "${icon} ${name}" তৈরি হয়েছে!`);
  }
}

function confirmDeleteProfile(id){
  const {saveData,saveCashData,saveCats,render,renderCash,renderHisabMiniWallets,renderAllQtags,renderCatMgrSections,updateProfileHeaderUI,cm,closeCashForm,openProfileSwitcher,switchProfile,toast}=confirmedEffects;
  ensureProfilesStructure();
  const p = ROOT_DB.profiles.find(x => x.id === id);
  if(!p) return;
  if(p.isDefault || ROOT_DB.profiles.length <= 1){
    toast('⚠️ প্রাথমিক ব্যক্তিগত খাতাটি মুছে ফেলা যাবে না!');
    return;
  }
  if(!confirm(`আপনি কি নিশ্চিত যে "${p.name}" খাতাটি মুছে ফেলতে চান?\n\nএর ভেতরের সকল দেনা-পাওনা ও আয়-ব্যয় মুছে যাবে!`)){
    return;
  }

  if(ROOT_DB.activeProfileId === id){
    switchProfile('default', false);
  }

  ROOT_DB.profiles = ROOT_DB.profiles.filter(x => x.id !== id);
  delete ROOT_DB.profilesData[id];
  if(ROOT_CASH_DB && ROOT_CASH_DB.profilesData){
    delete ROOT_CASH_DB.profilesData[id];
  }

  saveData();
  saveCashData();
  openProfileSwitcher();
  toast(`🗑️ "${p.name}" খাতাটি মুছে ফেলা হয়েছে`);
}

// ── EXPENSE TRACKER PRO METADATA & DATA STRUCTURES ──
let CASH_SELECTED_MONTH = localDateStr().slice(0, 7);
let CASH_TIME_FILTER = 'month'; // 'month' | 'last_month' | 'all'
let WALLET_FILTER = 'all';
let SELECTED_FORM_WALLET = 'cash';
let SELECTED_FORM_CAT = '';
let SELECTED_QA_WALLET = 'cash';
let SELECTED_QA_CAT = '';
let QA_MODE = 'sub';
let TF_FROM_WALLET = 'bank';
let TF_TO_WALLET = 'bkash';

const WALLET_META = new Proxy({
  cash:  { name: 'নগদ', en: 'Cash', icon: '💵', color: '#10b981' },
  bkash: { name: 'বিকাশ', en: 'bKash', icon: '📱', color: '#e11d48' },
  nagad: { name: 'নগদ (Nagad)', en: 'Nagad', icon: '📱', color: '#f97316' },
  bank:  { name: 'ব্যাংক', en: 'Bank', icon: '🏦', color: '#3b82f6' }
},{get(base,key){
  if(Object.prototype.hasOwnProperty.call(base,key))return base[key];
  const custom=CASH_DB.customWallets?.[key];
  return custom?{name:custom.name,en:custom.name,icon:'▣',iconKind:custom.iconKind||'wallet',color:'#647bbb'}:undefined;
}});

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
  { id: 'debt_out', e: '📤', bn: 'দেনা পরিশোধ', en: 'Due Paid', color: '#ef4444' },
  { id: 'other', e: '📦', bn: 'অন্যান্য', en: 'Other', color: '#64748b' }
];

const INCOME_CATEGORIES = [
  { id: 'family_in', e: '👨‍👩‍👧', bn: 'পরিবার', en: 'Family', color: '#10b981' },
  { id: 'pocket_money', e: '💵', bn: 'পকেটমানি', en: 'Pocket Money', color: '#06b6d4' },
  { id: 'gift', e: '🎁', bn: 'উপহার', en: 'Gift', color: '#ec4899' },
  { id: 'freelance', e: '💻', bn: 'ফ্রিল্যান্সিং', en: 'Freelance', color: '#8b5cf6' },
  { id: 'business', e: '📈', bn: 'ব্যবসা', en: 'Business', color: '#f59e0b' },
  { id: 'debt_in', e: '📥', bn: 'পাওনা আদায়', en: 'Due Collected', color: '#10b981' },
  { id: 'other_in', e: '💰', bn: 'অন্যান্য', en: 'Other', color: '#64748b' }
];

const LEGACY_CATS = [
  { id: 'salary', e: '💼', bn: 'বেতন', en: 'Salary', color: '#10b981' },
  { id: 'bonus', e: '🎁', bn: 'বোনাস', en: 'Bonus', color: '#f59e0b' }
];

function formatTxnNote(h, precomputedCat){
  if(!h) return '';
  const isAdd = h.type === 'add';
  const isSub = h.type === 'sub';
  const cats = isAdd ? INCOME_CATEGORIES : (isSub ? EXPENSE_CATEGORIES : []);
  const allCats = [...INCOME_CATEGORIES, ...EXPENSE_CATEGORIES, ...LEGACY_CATS];
  const catObj = precomputedCat || (h.category ? cats.find(c => c.id === h.category) : null) || 
                 (h.category ? allCats.find(c => c.id === h.category) : null);

  const rawNote = (h.note || '').trim();

  // If note was default "টাকা যোগ" or "খরচ" or "Add Money" or "Expense"
  const isDefaultNote = !rawNote || 
    rawNote === 'টাকা যোগ' || rawNote === 'টাকা যোগ (আয়)' || rawNote === 'Add Money' || rawNote === 'Add Income' ||
    rawNote === 'খরচ' || rawNote === 'খরচ করুন (ব্যয়)' || rawNote === 'Expense' || rawNote === 'Add Expense';

  if(isDefaultNote){
    if(catObj && catObj.en && catObj.bn) return LANG === 'bn' ? catObj.bn : catObj.en;
    if(isAdd) return LANG === 'bn' ? 'টাকা যোগ' : 'Add Money';
    if(isSub) return LANG === 'bn' ? 'খরচ' : 'Expense';
    return LANG === 'bn' ? 'ট্রান্সফার' : 'Transfer';
  }

  // If note matches any category bn or en name (e.g. "বেতন", "Salary", "খাবার", "Food")
  const matchedCat = [...INCOME_CATEGORIES, ...EXPENSE_CATEGORIES].find(c => c.bn === rawNote || c.en.toLowerCase() === rawNote.toLowerCase());
  if(matchedCat){
    return LANG === 'bn' ? matchedCat.bn : matchedCat.en;
  }

  // If note is formatted like "খাওয়া / Food" or "বিল / Bill"
  if(rawNote.includes(' / ')){
    const parts = rawNote.split(' / ');
    return LANG === 'bn' ? parts[0].trim() : parts[1].trim();
  }

  return rawNote;
}

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
  const keys = enabledWalletKeys();
  grid.innerHTML = keys.map(k => {
    const meta = WALLET_META[k];
    const isAct = WALLET_FILTER === k;
    const amt = w[k] || 0;
    const glyph=k.startsWith('wallet_')?customWalletIconPath(WALLET_META[k]?.iconKind):k==='cash'?'<rect x="3" y="5" width="18" height="14" rx="2"/><circle cx="12" cy="12" r="3"/><path d="M6 9h1m10 6h1"/>':k==='bank'?'<path d="m3 9 9-6 9 6H3Zm2 3v6m5-6v6m4-6v6m5-6v6M3 21h18"/>':'<rect x="6" y="2" width="12" height="20" rx="3"/><path d="M10 5h4m-3 14h2"/>';

    return `
      <button type="button" data-wallet="${k}" class="wallet-card ${isAct ? 'active' : ''}" aria-pressed="${isAct}" onclick="toggleWalletFilter('${k}')">
        <div class="wcard-top">
          <span class="wcard-icon" aria-hidden="true"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round">${glyph}</svg></span>
          <span class="wcard-name">${escapeHTML(LANG==='bn'?meta.name:meta.en)}</span>
        </div>
        <div class="wcard-amt">৳${fmt(amt)}</div>
      </button>
    `;
  }).join('');
}

function toggleWalletFilter(k){
  if(WALLET_FILTER === k){
    WALLET_FILTER = 'all';
  } else {
    WALLET_FILTER = k;
  }
  renderCash();
}

function openTransferModal(){
  ensureWallets();
  document.getElementById('tf-amt').value = '';
  document.getElementById('tf-note').value = '';
  const wallets=enabledWalletKeys();
  if(wallets.length<2){toast(LANG==='bn'?'ট্রান্সফার করতে মেনু থেকে আরেকটি ওয়ালেট যোগ করুন।':'Add another wallet from the menu to transfer money.');return;}
  selectTransferWallet('from', wallets[0]);
  selectTransferWallet('to', wallets[1]);
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
  const {saveData,saveCashData,saveCats,render,renderCash,renderHisabMiniWallets,renderAllQtags,renderCatMgrSections,updateProfileHeaderUI,cm,closeCashForm,openProfileSwitcher,switchProfile,toast}=confirmedEffects;
  const amt = money(parseFloat(document.getElementById('tf-amt').value));
  const note = document.getElementById('tf-note').value.trim() || (LANG==='bn'?'ওয়ালেট ফান্ড ট্রান্সফার':'Wallet Fund Transfer');
  if(!validAmount(amt)){
    toast('❌ সঠিক পরিমাণ দিন!');
    return;
  }
  if(!walletEnabled(TF_FROM_WALLET)||!walletEnabled(TF_TO_WALLET)){toast(LANG==='bn'?'চালু ওয়ালেট বাছুন।':'Choose an enabled wallet.');return;}
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
  const ts = Date.now(), txnId=nextId();
  const fromMeta = WALLET_META[TF_FROM_WALLET];
  const toMeta = WALLET_META[TF_TO_WALLET];
  const transferDesc = `${fromMeta.icon} ${fromMeta.name} → ${toMeta.icon} ${toMeta.name} (${note})`;
  CASH_DB.history.unshift({
    id: txnId,
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
  
  const meta = WALLET_META[w] || { name: 'ক্যাশ', en: 'Cash' };
  const wLabel = escapeHTML(LANG === 'bn' ? meta.name : meta.en);
  const submitBtn = document.getElementById('cash-submit-btn');
  const titleEl = document.getElementById('cash-form-title');

  if(cashFormMode === 'add'){
    if(titleEl) titleEl.innerHTML = `<span class="bn">${wLabel}-এ টাকা যোগ</span><span class="en">Add to ${escapeHTML(meta.en)}</span>`;
    if(submitBtn) submitBtn.innerHTML = `<span class="bn">${wLabel}-এ যোগ করুন ✓</span><span class="en">Add to ${escapeHTML(meta.en)} ✓</span>`;
  } else {
    if(titleEl) titleEl.innerHTML = `<span class="bn">${wLabel} থেকে খরচ</span><span class="en">Deduct from ${escapeHTML(meta.en)}</span>`;
    if(submitBtn) submitBtn.innerHTML = `<span class="bn">${wLabel} থেকে রেকর্ড করুন ✓</span><span class="en">Deduct from ${escapeHTML(meta.en)} ✓</span>`;
  }
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
  if(savingChange)return;
  document.getElementById('m-quickadd').classList.add('on');
  if(document.querySelector('#m-quickadd .form-save-notice')){
    document.getElementById('qa-chooser').hidden=true;document.getElementById('qa-editor').hidden=false;return;
  }
  resetQuickPerson();document.getElementById('qa-person-new').value='0';
  document.getElementById('qa-amt').value='';document.getElementById('qa-note').value='';
  document.getElementById('qa-note-details').open=false;
  selectQAWallet(WALLET_FILTER&&WALLET_FILTER!=='all'?WALLET_FILTER:'cash');
  backQuickTask();
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
    updateQuickHisab();
  } else {
    nameWrap.style.display = 'none';
    noteWrap.style.display = 'block';
    walletSec.style.display = 'block';
    catSec.style.display = 'block';
    const w = SELECTED_QA_WALLET || 'cash';
    const meta = WALLET_META[w] || { name: 'ক্যাশ', en: 'Cash' };
    const wLabel = escapeHTML(LANG === 'bn' ? meta.name : meta.en);
    if(t === 'sub'){
      subBtn.className = 'sbtn sbtn-r';
      subBtn.innerHTML = `<span class="bn">${wLabel} থেকে খরচ রেকর্ড করুন ✓</span><span class="en">Deduct from ${escapeHTML(meta.en)} ✓</span>`;
      renderFormCategories('sub', 'qa-cat-grid');
    } else {
      subBtn.className = 'sbtn sbtn-g';
      subBtn.innerHTML = `<span class="bn">${wLabel}-এ আয় যোগ করুন ✓</span><span class="en">Add to ${escapeHTML(meta.en)} ✓</span>`;
      renderFormCategories('add', 'qa-cat-grid');
    }
  }
}

function selectQAWallet(w, btn){
  SELECTED_QA_WALLET = w;
  document.querySelectorAll('#qa-wallet-row .wsel-btn').forEach(b => b.classList.toggle('on', b.dataset.w === w));
  const subBtn = document.getElementById('qa-submit-btn');
  if(!subBtn || QA_MODE === 'hisab') return;
  const meta = WALLET_META[w] || { name: 'ক্যাশ', en: 'Cash' };
  const wLabel = escapeHTML(LANG === 'bn' ? meta.name : meta.en);
  if(QA_MODE === 'add'){
    subBtn.innerHTML = `<span class="bn">${wLabel}-এ আয় যোগ করুন ✓</span><span class="en">Add to ${escapeHTML(meta.en)} ✓</span>`;
  } else {
    subBtn.innerHTML = `<span class="bn">${wLabel} থেকে খরচ রেকর্ড করুন ✓</span><span class="en">Deduct from ${escapeHTML(meta.en)} ✓</span>`;
  }
}

function submitQuickAdd(){
  const {saveData,saveCashData,saveCats,render,renderCash,renderHisabMiniWallets,renderAllQtags,renderCatMgrSections,updateProfileHeaderUI,cm,closeCashForm,openProfileSwitcher,switchProfile,toast}=confirmedEffects;
  const amt = money(parseFloat(document.getElementById('qa-amt').value));
  if(!validAmount(amt)){
    toast('❌ সঠিক পরিমাণ দিন!');
    return;
  }
  if(QA_MODE === 'hisab'){
    const kind=document.getElementById('qa-hisab-kind').value;
    if(!['receive','give'].includes(kind))return;
    const paying=document.getElementById('qa-hisab-action').value==='pay';
    if(paying){
      const id=document.getElementById('qa-person-id').value;
      const person=DB[kind].find(p=>String(p.id)===id);
      if(!person){toast(LANG==='bn'?'তালিকা থেকে ব্যক্তিকে বাছুন।':'Select a person.');return;}
      if(applyHisabPayment(kind,person.id,amt,document.getElementById('qa-note').value,true,SELECTED_QA_WALLET||'cash')){
        cm('m-quickadd');renderCash();
      }
      return;
    }

    const name=document.getElementById('qa-name').value.trim();
    const selected=document.getElementById('qa-person-id').value;
    if(!name){toast(LANG==='bn'?'ব্যক্তির নাম লিখুন।':'Enter a name.');return;}
    if(!selected&&document.getElementById('qa-person-new').value!=='1'){toast(LANG==='bn'?'আগের ব্যক্তি বাছুন অথবা নতুন ব্যক্তি চাপুন।':'Select an existing person or choose New person.');return;}
    const person=selected?DB[kind].find(p=>String(p.id)===selected):null;
    if(selected&&!person){toast(LANG==='bn'?'এই হিসাব পাওয়া যায়নি। আবার বাছুন।':'Account not found. Select again.');return;}
    if(!person&&DB[kind].some(p=>searchText(p.name).trim()===searchText(name).trim())){
      toast(LANG==='bn'?'এই নামে হিসাব আছে। নিচের তালিকা থেকে সঠিক ব্যক্তিকে বাছুন।':'This name already exists. Select the correct person from the list.');return;
    }
    const note=document.getElementById('qa-note').value.trim()||(LANG==='bn'?'হিসাব যোগ':'Added');
    const ts=Date.now(),txnId=nextId();
    const history={id:txnId,t:'add',amt,note,date:ts};
    if(person){
      if(person.remaining<=0){
        person.original=amt;person.remaining=amt;person.clearedAt=ts;person.cycleStartedAt=ts;
        if(person.loanData)person.loanData.loanDate=localDateStr();
      }else{person.original=money(person.original+amt);person.remaining=money(person.remaining+amt);}
      person.history.unshift(history);
    }else{
      DB[kind].unshift({id:txnId,name,original:amt,remaining:amt,history:[history]});
    }
    logActivity('পরিমাণ যোগ',`${person?person.name:name} — ৳${fmt(amt)}`);
    saveData();render();cm('m-quickadd');
    toast(LANG==='bn'?'হিসাব সেভ হয়েছে।':'Account saved.');return;
  }

  ensureWallets();
  const ts = Date.now(), txnId=nextId();
  const w = SELECTED_QA_WALLET;
  if(!walletEnabled(w)){toast(LANG==='bn'?'চালু ওয়ালেট বাছুন।':'Choose an enabled wallet.');return;}
  const cats = QA_MODE === 'add' ? INCOME_CATEGORIES : EXPENSE_CATEGORIES;
  const catObj = cats.find(x => x.id === (SELECTED_QA_CAT || (cats[0] && cats[0].id)));
  const note = document.getElementById('qa-note').value.trim() || (catObj ? (LANG === 'bn' ? catObj.bn : catObj.en) : (QA_MODE === 'add' ? (LANG === 'bn' ? 'টাকা যোগ' : 'Add Money') : (LANG === 'bn' ? 'খরচ' : 'Expense')));

  const wMeta = WALLET_META[w] || { name: w, en: w };
  const wName = LANG === 'bn' ? wMeta.name : wMeta.en;

  if(QA_MODE === 'add'){
    CASH_DB.wallets[w] = (CASH_DB.wallets[w] || 0) + amt;
    CASH_DB.balance += amt;
    CASH_DB.history.unshift({
      id: txnId,
      type: 'add',
      amt: amt,
      note: note,
      category: catObj ? catObj.id : 'other_in',
      wallet: w,
      date: ts
    });
    toast(LANG === 'bn' ? `✅ ৳${fmt(amt)} আয় যোগ হয়েছে! (${wName})` : `✅ Added ৳${fmt(amt)} income! (${wName})`);
  } else {
    CASH_DB.wallets[w] = (CASH_DB.wallets[w] || 0) - amt;
    CASH_DB.balance -= amt;
    CASH_DB.history.unshift({
      id: txnId,
      type: 'sub',
      amt: amt,
      note: note,
      category: catObj ? catObj.id : 'other',
      wallet: w,
      date: ts
    });
    toast(LANG === 'bn' ? `💸 ৳${fmt(amt)} খরচ হয়েছে! (${wName})` : `💸 Deducted ৳${fmt(amt)} expense! (${wName})`);
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
      const comp = LANG === 'bn' 
        ? (diff <= 0 ? `${Math.abs(diff)}% কম খরচ` : `${diff}% বেশি খরচ`)
        : (diff <= 0 ? `${Math.abs(diff)}% less` : `${diff}% more`);
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
      ? `আজ এখনও কোনো খরচ রেকর্ড হয়নি। ${topCatName ? 'এই মাসের শীর্ষ খাত: <b>' + topCatName + '</b>' : ''}`
      : `No expenses recorded today. ${topCatName ? 'Top category this month: <b>' + topCatName + '</b>' : ''}`;
  }

  txt.innerHTML = insightMsg;
}

// ── CASH FORM & CRUD ──
function openCashForm(mode, targetWallet){
  cashFormMode = mode;
  ensureWallets();
  const form = document.getElementById('cash-form');
  const icon = document.getElementById('cash-form-icon');
  const submitBtn = document.getElementById('cash-submit-btn');

  const activeW = targetWallet || (WALLET_FILTER && WALLET_FILTER !== 'all' ? WALLET_FILTER : 'cash');

  if(mode === 'add'){
    form.classList.remove('cf-sub');
    form.classList.add('cf-add');
    icon.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12h14"/><path d="M12 5v14"/></svg>`;
    icon.style.background = 'rgba(16,185,129,.15)';
    icon.style.color = 'var(--green)';
    document.getElementById('cash-form-title').style.color = 'var(--green)';
    submitBtn.className = 'sbtn sbtn-g';
    renderFormCategories('add');
  } else {
    form.classList.remove('cf-add');
    form.classList.add('cf-sub');
    icon.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12h14"/></svg>`;
    icon.style.background = 'rgba(239,68,68,.12)';
    icon.style.color = 'var(--red)';
    document.getElementById('cash-form-title').style.color = 'var(--red)';
    submitBtn.className = 'sbtn sbtn-r';
    renderFormCategories('sub');
  }

  document.getElementById('cash-amt').value = '';
  const noteInput = document.getElementById('cash-note');
  const cats = mode === 'add' ? INCOME_CATEGORIES : EXPENSE_CATEGORIES;
  const firstCat = cats.find(c => c.id === SELECTED_FORM_CAT) || cats[0];
  noteInput.value = firstCat ? (LANG === 'bn' ? firstCat.bn : firstCat.en) : '';
  const todayStr = localDateStr();
  const dateEl = document.getElementById('cash-date');
  dateEl.value = todayStr;
  dateEl.classList.add('has-val');
  document.getElementById('cash-amt').classList.remove('has-val');
  if(noteInput.value) noteInput.classList.add('has-val');
  else noteInput.classList.remove('has-val');

  selectFormWallet(activeW);
  form.classList.remove('hidden');
  document.getElementById('cash-amt').focus();
}

function closeCashForm(){
  document.getElementById('cash-form').classList.add('hidden');
}

function submitCash(){
  const {saveData,saveCashData,saveCats,render,renderCash,renderHisabMiniWallets,renderAllQtags,renderCatMgrSections,updateProfileHeaderUI,cm,closeCashForm,openProfileSwitcher,switchProfile,toast}=confirmedEffects;
  const amt = money(parseFloat(document.getElementById('cash-amt').value));
  if(!validAmount(amt)){
    toast(LANG === 'bn' ? '❌ সঠিক পরিমাণ দিন!' : '❌ Enter a valid amount!');
    return;
  }
  ensureWallets();
  const ts = Date.now(), txnId=nextId();
  const dateVal = document.getElementById('cash-date').value;
  const entryDate = dateVal ? new Date(dateVal + 'T12:00:00').getTime() : ts;
  const w = SELECTED_FORM_WALLET || 'cash';
  if(!walletEnabled(w)){toast(LANG==='bn'?'চালু ওয়ালেট বাছুন।':'Choose an enabled wallet.');return;}
  const cat = SELECTED_FORM_CAT || (cashFormMode === 'add' ? 'other_in' : 'other');
  const cats = cashFormMode === 'add' ? INCOME_CATEGORIES : EXPENSE_CATEGORIES;
  const catObj = cats.find(c => c.id === cat);
  const note = document.getElementById('cash-note').value.trim() || (catObj ? (LANG === 'bn' ? catObj.bn : catObj.en) : (cashFormMode === 'add' ? (LANG === 'bn' ? 'টাকা যোগ' : 'Add Money') : (LANG === 'bn' ? 'খরচ' : 'Expense')));

  const wMeta = WALLET_META[w] || { name: w, en: w };
  const wName = LANG === 'bn' ? wMeta.name : wMeta.en;

  if(cashFormMode === 'add'){
    CASH_DB.wallets[w] = (CASH_DB.wallets[w] || 0) + amt;
    CASH_DB.balance += amt;
    CASH_DB.history.unshift({
      id: txnId,
      type: 'add',
      amt: amt,
      note: note,
      category: cat,
      wallet: w,
      date: entryDate
    });
    toast(LANG === 'bn' ? `✅ ৳${fmt(amt)} যোগ হয়েছে! (${wName})` : `✅ Added ৳${fmt(amt)}! (${wName})`);
  } else {
    CASH_DB.wallets[w] = (CASH_DB.wallets[w] || 0) - amt;
    CASH_DB.balance -= amt;
    CASH_DB.history.unshift({
      id: txnId,
      type: 'sub',
      amt: amt,
      note: note,
      category: cat,
      wallet: w,
      date: entryDate
    });
    toast(LANG === 'bn' ? `💸 ৳${fmt(amt)} খরচ হয়েছে! (${wName})` : `💸 Deducted ৳${fmt(amt)}! (${wName})`);
  }
  saveCashData();
  closeCashForm();
  renderCash();
}

function deleteCashEntry(id){
  const {saveData,saveCashData,saveCats,render,renderCash,renderHisabMiniWallets,renderAllQtags,renderCatMgrSections,updateProfileHeaderUI,cm,closeCashForm,openProfileSwitcher,switchProfile,toast}=confirmedEffects;
  let book=CASH_DB;const profileId=ROOT_DB.activeProfileId,owner=CUR_USER.id,entry=book.history.find(h=>h.id===id);if(!entry)return;
  if(entry.refHisabId){toast(LANG==='bn'?'❌ এটি দেনা-পাওনার পরিশোধের সঙ্গে যুক্ত। সরাসরি মুছবেন না।':'❌ Linked settlement cannot be deleted independently.');return;}
  const idx=book.history.indexOf(entry),snap=JSON.parse(JSON.stringify(entry));ensureWallets();
  const apply=direction=>{if(entry.type==='transfer'){book.wallets[entry.fromWallet]=money((book.wallets[entry.fromWallet]||0)-direction*entry.amt);book.wallets[entry.toWallet]=money((book.wallets[entry.toWallet]||0)+direction*entry.amt);}else{const delta=(entry.type==='add'?1:-1)*direction*entry.amt,w=entry.wallet||'cash';book.wallets[w]=money((book.wallets[w]||0)+delta);}book.balance=money(Object.values(book.wallets).reduce((s,v)=>s+v,0));};
  apply(-1);book.history.splice(idx,1);saveCashData();renderCash();
  toast(LANG==='bn'?'🗑️ লেনদেন মুছে গেছে':'🗑️ Transaction deleted',()=>{if(CUR_USER?.id!==owner||!ROOT_CASH_DB.profilesData[profileId])return;book=ROOT_CASH_DB.profilesData[profileId];if(book.history.some(h=>h.id===snap.id))return;apply(1);book.history.splice(Math.min(idx,book.history.length),0,snap);saveData();renderCash();});
}

function clearCashHistory(){
  document.getElementById('m-clearcash').classList.add('on');
}

function confirmClearCashExecution(){
  const {saveData,saveCashData,saveCats,render,renderCash,renderHisabMiniWallets,renderAllQtags,renderCatMgrSections,updateProfileHeaderUI,cm,closeCashForm,openProfileSwitcher,switchProfile,toast}=confirmedEffects;
  cm('m-clearcash');
  const actId = (ROOT_DB && ROOT_DB.activeProfileId) || 'default';

  const clearProfileId=ROOT_DB.activeProfileId;
  // 1. Snapshot for Undo
  const snapHistory = JSON.parse(JSON.stringify(CASH_DB.history || []));
  const cashIds=new Set(snapHistory.map(h=>h.id));
  const resetLinks=[];
  for(const type of ['receive','give'])for(const person of DB[type])for(let index=0;index<person.history.length;index++){
    const h=person.history[index];if(h.cashTxnId!=null&&cashIds.has(h.cashTxnId)){
      resetLinks.push({type,personId:person.id,historyId:h.id,index,cashTxnId:h.cashTxnId});h.cashTxnId=null;
    }
  }
  const snapWallets = { ...(CASH_DB.wallets || { cash:0 }) };
  const snapBalance = CASH_DB.balance || 0;
  const snapEnabledWallets=enabledWalletKeys();
  const snapCustomWallets=JSON.parse(JSON.stringify(CASH_DB.customWallets||{}));
  const zeroWallets=Object.fromEntries(Object.keys(snapWallets).map(key=>[key,0]));

  // 2. Clear current CASH_DB properties in-place
  CASH_DB.balance = 0;
  CASH_DB.wallets = { ...zeroWallets };
  CASH_DB.history = [];

  // 3. Clear in ROOT_CASH_DB.profilesData
  if(!ROOT_CASH_DB || typeof ROOT_CASH_DB !== 'object') ROOT_CASH_DB = {};
  if(!ROOT_CASH_DB.profilesData || typeof ROOT_CASH_DB.profilesData !== 'object') ROOT_CASH_DB.profilesData = {};
  ROOT_CASH_DB.profilesData[actId] = {
    balance: 0,
    history: [],
    wallets: { ...zeroWallets },
    budget: CASH_DB.budget || 0,
    enabledWallets: snapEnabledWallets,
    customWallets: snapCustomWallets,
    monthlyBudgets: CASH_DB.monthlyBudgets || {}
  };
  CASH_DB = ROOT_CASH_DB.profilesData[actId];

  // 4. Clear legacy top-level if default profile
  if(actId === 'default'){
    ROOT_CASH_DB.balance = 0;
    ROOT_CASH_DB.wallets = { ...zeroWallets };
    ROOT_CASH_DB.history = [];
  }

  saveCashData();
  renderCash();

  toast(LANG === 'bn' ? '🗑️ সব ইতিহাস মুছে ফেলা হয়েছে' : '🗑️ All history cleared', () => {
    const linkedEntry=link=>{const person=DB[link.type].find(p=>p.id===link.personId);return link.historyId!=null?person?.history.find(h=>h.id===link.historyId):person?.history[link.index];};
    if(ROOT_DB.activeProfileId!==clearProfileId||CASH_DB.history.length||resetLinks.some(link=>linkedEntry(link)?.cashTxnId!==null)){toast(LANG==='bn'?'❌ খাতা বা হিসাব বদলানোর পরে এই Undo করা যাবে না।':'❌ Cannot undo after changing books or adding transactions.');return;}
    for(const link of resetLinks)linkedEntry(link).cashTxnId=link.cashTxnId;
    CASH_DB.history = snapHistory;
    CASH_DB.wallets = snapWallets;
    CASH_DB.balance = snapBalance;
    if(ROOT_CASH_DB && ROOT_CASH_DB.profilesData){
      ROOT_CASH_DB.profilesData[actId] = CASH_DB;
    }
    if(actId === 'default' && ROOT_CASH_DB){
      ROOT_CASH_DB.balance = snapBalance;
      ROOT_CASH_DB.wallets = snapWallets;
      ROOT_CASH_DB.history = snapHistory;
    }
    saveCashData();
    renderCash();
    toast(LANG === 'bn' ? '↩️ ফিরিয়ে আনা হয়েছে' : '↩️ Restored');
  });
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
  const {saveData,saveCashData,saveCats,render,renderCash,renderHisabMiniWallets,renderAllQtags,renderCatMgrSections,updateProfileHeaderUI,cm,closeCashForm,openProfileSwitcher,switchProfile,toast}=confirmedEffects;
  const id = Number(document.getElementById('cedit-id').value);
  const amt = money(parseFloat(document.getElementById('cedit-amt').value));
  const note = document.getElementById('cedit-note').value.trim();
  if(!validAmount(amt)){
    toast('❌ সঠিক পরিমাণ দিন');
    return;
  }
  const h = CASH_DB.history.find(x => x.id === id);
  if(!h)return;
  if(h.refHisabId){toast(LANG==='bn'?'❌ যুক্ত পরিশোধ আলাদাভাবে বদলানো যাবে না।':'❌ Linked settlements cannot be edited independently.');return;}
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
  } else if(h.type === 'transfer'){
    if(!h.fromWallet||!h.toWallet||h.fromWallet===h.toWallet||!WALLET_META[h.fromWallet]||!WALLET_META[h.toWallet]){
      toast(LANG==='bn'?'ট্রান্সফারের ওয়ালেটের তথ্য সঠিক নয়।':'Transfer wallet details are invalid.');return;
    }
    CASH_DB.wallets[h.fromWallet]=money((CASH_DB.wallets[h.fromWallet]||0)-diff);
    CASH_DB.wallets[h.toWallet]=money((CASH_DB.wallets[h.toWallet]||0)+diff);
  } else {
    toast(LANG==='bn'?'এই লেনদেন সম্পাদনা করা যাচ্ছে না।':'This transaction cannot be edited.');return;
  }
  h.amt = amt;
  h.note = note;
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
    hist = hist.filter(h => matchesSearch([h.note,h.amt,h.date,fmtD(h.date),h.category,h.type,...[h.wallet,h.fromWallet,h.toWallet].flatMap(w=>[w,WALLET_META[w]?.name,WALLET_META[w]?.en])],q));
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
    sub.textContent = prefix + label + '৳' + fmt(last.amt) + ' — ' + formatTxnNote(last);
  } else {
    sub.innerHTML = '<span class="bn">কোনো লেনদেন নেই</span><span class="en">No transactions yet</span>';
  }

  // Dynamic button labels based on active wallet & conditional display
  const cashActionsWrap = document.getElementById('cash-actions-wrap');
  const addBtnLabel = document.getElementById('btn-add-label');
  const subBtnLabel = document.getElementById('btn-sub-label');
  if(cashActionsWrap){
    if(WALLET_FILTER && WALLET_FILTER !== 'all'){
      cashActionsWrap.style.display = 'grid';
      const meta = WALLET_META[WALLET_FILTER] || { name: WALLET_FILTER, en: WALLET_FILTER };
      if(addBtnLabel) addBtnLabel.innerHTML = `<span class="bn">${escapeHTML(meta.name)}-এ টাকা যোগ</span><span class="en">Add to ${escapeHTML(meta.en)}</span>`;
      if(subBtnLabel) subBtnLabel.innerHTML = `<span class="bn">${escapeHTML(meta.name)} থেকে খরচ</span><span class="en">Deduct from ${escapeHTML(meta.en)}</span>`;
    } else {
      cashActionsWrap.style.display = 'grid';
      if(addBtnLabel) addBtnLabel.innerHTML = `<span class="bn">টাকা যোগ (আয়)</span><span class="en">Add Income</span>`;
      if(subBtnLabel) subBtnLabel.innerHTML = `<span class="bn">খরচ করুন (ব্যয়)</span><span class="en">Add Expense</span>`;
    }
  }

  // Micro-Insights (3.4)
  renderMicroInsights(allHist);

  // Donut Chart (3.3)
  renderDonutChart(hist.filter(h => h.type === 'sub'));

  // Budget Bar
  const budget = getMonthlyBudget();
  const budgetSpent=(CASH_DB.history||[]).filter(h=>h.type==='sub'&&localDateStr(new Date(h.date)).slice(0,7)===CASH_SELECTED_MONTH).reduce((s,h)=>s+h.amt,0);
  const budgetWrap = document.getElementById('budget-wrap');
  const budgetCta = document.getElementById('budget-cta');
  if(budget > 0){
    budgetWrap.style.display = 'block';
    budgetCta.style.display = 'none';
    const pct = Math.min(100, Math.round((budgetSpent / budget) * 100));
    const fill = document.getElementById('budget-fill');
    fill.style.width = pct + '%';
    fill.style.background = pct < 60 ? 'var(--green)' : pct < 85 ? 'var(--yellow)' : 'var(--red)';
    document.getElementById('budget-pct').textContent = pct + '%';
    document.getElementById('budget-pct').style.color = pct < 60 ? 'var(--green)' : pct < 85 ? 'var(--yellow)' : 'var(--red)';
    const rem = budget - budgetSpent;
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
    list.innerHTML = `<div class="empty"><div class="empty-i" style="color:var(--muted)"><svg xmlns="http://www.w3.org/2000/svg" width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M21 12V7H5a2 2 0 0 1 0-4h14v4"/><path d="M3 5v14a2 2 0 0 0 2 2h16v-5"/><path d="M18 12a2 2 0 0 0 0 4h4v-4Z"/></svg></div><div class="empty-t"><span class="bn">${CASH_FILTER === 'all' ? 'কোনো লেনদেন নেই' : 'কোনো রেকর্ড নেই'}</span><span class="en">${CASH_FILTER === 'all' ? 'No transactions yet' : 'No records found'}</span></div><div class="empty-s"><span class="bn">${allHist.length ? 'সার্চ, মাস বা ওয়ালেটের ফিল্টার বদলে দেখুন' : 'উপরের বাটন দিয়ে প্রথম লেনদেন যোগ করুন'}</span><span class="en">${allHist.length ? 'Try changing the search, month or wallet filter' : 'Use the buttons above to add your first transaction'}</span></div></div>`;
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
      if(isSub) catObj = EXPENSE_CATEGORIES.find(c => c.id === h.category) || (EXPENSE_CATEGORIES.find(c => h.note && (h.note.includes(c.bn) || h.note.includes(c.en))) || { e: '💸', color: '#ef4444' });
      else if(isAdd) catObj = INCOME_CATEGORIES.find(c => c.id === h.category) || (INCOME_CATEGORIES.find(c => h.note && (h.note.includes(c.bn) || h.note.includes(c.en))) || { e: '💰', color: '#10b981' });
      else catObj = { e: '⇄', color: '#3b82f6' };

      const displayNote = formatTxnNote(h, catObj);
      const iconChar = catObj.e || (isAdd ? '⬆️' : isSub ? '⬇️' : '⇄');
      const sign = isAdd ? '+' : isSub ? '-' : '';
      const amtColor = isAdd ? 'var(--green)' : isSub ? 'var(--red)' : 'var(--primary)';
      const timeStr = new Date(h.date).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

      return `
        <div class="cash-entry">
          <div class="cash-entry-icon" style="background:${catObj.color}12;color:${catObj.color}" aria-hidden="true">${expenseTransactionIcon(h.category,h.type)}</div>
          <div class="cash-entry-info">
            <div class="cash-entry-note">${escapeHTML(displayNote)}</div>
            <div class="cash-entry-date" style="display:flex;align-items:center;gap:6px;">
              <span class="wallet-badge">${walletChoiceIcon(h.wallet||'cash')} ${escapeHTML(LANG === 'bn' ? wMeta.name : wMeta.en)}</span>
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
function fmt(n){return money(n).toLocaleString('en-IN',{maximumFractionDigits:2});}
function fmtD(v){
  let d=typeof v==='number'||(typeof v==='string'&&/^\d{10,}$/.test(v))?new Date(Number(v)):new Date(v);
  if(isNaN(d))return '—';
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
function countUp(el,target,pre=''){if(el)el.textContent=pre+fmt(target);}

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
function toggleLang(){
  LANG = LANG === 'bn' ? 'en' : 'bn';
  localStorage.setItem('ht_lang', LANG);
  document.documentElement.setAttribute('data-lang', LANG);
  applyMode();
  updateProfileHeaderUI();
  updateDynamicPlaceholders();
  render();
  if(typeof renderCash === 'function') renderCash();
  if(document.getElementById('m-analytics')?.classList.contains('on'))openAnalytics();
  updateMonthFilterUI();

}
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
  const totalRepayment=money(principal+fullInterest+processingFee+fees);

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
  const totalPayable=money(principal+fullInterest+processingFee+fees),monthlyEMI=money(Math.ceil(totalPayable*100/3)/100);
  const currentMonthIndex=Math.min(2,Math.max(0,Math.floor(daysToCharge/30)));
  const totalPaid=money(paidAmount),scheduled=money(Math.min(totalPayable,monthlyEMI*(currentMonthIndex+1)));
  const priorScheduled=money(Math.min(totalPayable,monthlyEMI*currentMonthIndex));
  const priorPaid=payments.filter(p=>new Date(p.date).getTime()<new Date(loanStart).getTime()+currentMonthIndex*30*86400000).reduce((s,p)=>s+p.amt,0);
  return{monthlyEMI,thisMonthDue:money(Math.max(0,scheduled-totalPaid)),currentMonthIndex,carry:money(Math.max(0,priorScheduled-priorPaid))};
}

function getLoanBreakdown(p){
  const isLoan=p.loanData||p.history.some(h=>h.note.toLowerCase().includes('loan'));
  if(!isLoan)return null;
  const loanDate=p.loanData?.loanDate?new Date(p.loanData.loanDate):new Date(firstTs(p));
  const fees=p.loanData?.fees||0;
  const loanDateStr=localDateStr(loanDate);
  const calc=calculateLoanTotal(p.original,fees,loanDateStr);

  const paidAmount=p.history.filter(h=>h.t==='pay'&&(!p.cycleStartedAt||h.date>=p.cycleStartedAt)).reduce((s,h)=>s+h.amt,0);

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
  const payments=p.history.filter(h=>h.t==='pay'&&(!p.cycleStartedAt||h.date>=p.cycleStartedAt)).map(h=>({date:h.date,amt:h.amt})).sort((a,b)=>a.date-b.date);
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
    dailyAmount:money(Math.max(0,Math.min(remainingDue,p.original+currentInterest+calc.processingFee+fees-paidAmount))),
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
  const {saveData,saveCashData,saveCats,render,renderCash,renderHisabMiniWallets,renderAllQtags,renderCatMgrSections,updateProfileHeaderUI,cm,closeCashForm,openProfileSwitcher,switchProfile,toast}=confirmedEffects;
  const p=type==='receive'?'r':'g';
  const name=document.getElementById(p+'-na').value.trim();
  const amt=money(parseFloat(document.getElementById(p+'-am').value));
  const note=document.getElementById(p+'-no').value.trim()||'Entry';
  const dateVal=document.getElementById(p+'-date').value;
  if(!name||!validAmount(amt))return alert(LANG==='bn'?'সঠিক তথ্য দিন!':'Enter valid data!');
  
  let loanData=null;
  if(type==='receive'&&note.toLowerCase().includes('loan')){
    const fees=parseFeeString(document.getElementById('r-fee').value);
    const loanDate=document.getElementById('r-loan-date').value;
    loanData={fees,loanDate};
  }
  
  const tsId=nextId();
  const histDate=dateVal?new Date(dateVal+'T12:00:00').getTime():Date.now();
  const hist={id:tsId,date:histDate,amt,note,t:'add'};
  
  let person=DB[type].find(x=>x.name.toLowerCase()===name.toLowerCase());
  if(person){
    const wasSettled=person.remaining===0;
    if(wasSettled){
      person.original=amt;person.remaining=amt;
      person.clearedAt=histDate;person.cycleStartedAt=histDate;
      person.history.unshift(hist);
      if(loanData)person.loanData=loanData;
    } else {
      person.original=money(person.original+amt);person.remaining=money(person.remaining+amt);person.history.unshift(hist);
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
// ── PAYMENT WALLET CASHFLOW SYNC (PHASE 1) ──
let SELECTED_PAY_WALLET = 'cash';
let SELECTED_AC_WALLET = 'cash';

function selectPayWallet(w, btn) {
  SELECTED_PAY_WALLET = w;
  document.querySelectorAll('#pay-ws-wallets .pws-btn').forEach(b => b.classList.remove('on'));
  if (btn) btn.classList.add('on');
  updatePayWalletHint();
}

function togglePayWalletSync(enabled) {
  const walletsWrap = document.getElementById('pay-ws-wallets');
  if (walletsWrap) {
    if (enabled) walletsWrap.classList.remove('disabled');
    else walletsWrap.classList.add('disabled');
  }
  updatePayWalletHint();
}

function updatePaymentPreview(){
  const el=document.getElementById('payment-preview');
  const p=DB[CTX.type]?.find(x=>x.id===CTX.id);
  if(!el||!p)return;
  const breakdown=CTX.type==='receive'?getLoanBreakdown(p):null;
  const due=money(breakdown?Math.max(0,breakdown.totalRepayment-breakdown.paidAmount):p.remaining);
  const input=document.getElementById('pa');
  const amount=Number(input.value);
  const invalid=input.value!==''&&(!Number.isFinite(amount)||amount<=0||money(amount)>due);
  input.setAttribute('aria-invalid',String(invalid));
  input.max=String(due);
  el.classList.toggle('invalid',invalid);
  el.textContent=invalid
    ?(LANG==='bn'?`পরিমাণ শূন্যের বেশি এবং বাকি ৳${fmt(due)}-এর মধ্যে দিন।`:`Enter an amount above zero and no more than ৳${fmt(due)}.`)
    :(LANG==='bn'?`এখন বাকি ৳${fmt(due)} · পরিশোধের পর বাকি ৳${fmt(Math.max(0,due-money(amount||0)))}`:`Due now ৳${fmt(due)} · Remaining after payment ৳${fmt(Math.max(0,due-money(amount||0)))}`);
}

function updatePayWalletHint() {
  updatePaymentPreview();
  const hintEl = document.getElementById('pay-ws-hint');
  if (!hintEl) return;
  const toggle = document.getElementById('pay-sync-toggle');
  const isSync = toggle ? toggle.checked : true;
  if (!isSync) {
    hintEl.className = 'pay-ws-hint off';
    hintEl.innerHTML = LANG === 'bn' 
      ? '🚫 ওয়ালেটে কোনো প্রভাব পড়বে না (শুধুমাত্র খাতায় হিসাব আপডেট হবে)' 
      : '🚫 No wallet sync (Hisab record only)';
    return;
  }
  const amt = money(parseFloat(document.getElementById('pa')?.value)||0);
  const w = SELECTED_PAY_WALLET || 'cash';
  const wMeta = WALLET_META[w] || { icon: '💵', name: 'নগদ', en: 'Cash' };
  const wLabel = `${wMeta.icon} ${escapeHTML(LANG === 'bn' ? wMeta.name : wMeta.en)}`;
  const isRec = CTX.type === 'receive';
  if (isRec) {
    hintEl.className = 'pay-ws-hint income';
    hintEl.innerHTML = LANG === 'bn'
      ? `📥 <b>${wLabel}</b> ওয়ালেটে আয় হিসেবে +৳${fmt(amt)} জমা হবে`
      : `📥 +৳${fmt(amt)} will be deposited as Income into <b>${wLabel}</b>`;
  } else {
    hintEl.className = 'pay-ws-hint expense';
    hintEl.innerHTML = LANG === 'bn'
      ? `📤 <b>${wLabel}</b> ওয়ালেট থেকে -৳${fmt(amt)} খরচ কাটা হবে`
      : `📤 -৳${fmt(amt)} will be deducted as Expense from <b>${wLabel}</b>`;
  }
}

function selectAcWallet(w, btn) {
  SELECTED_AC_WALLET = w;
  document.querySelectorAll('#ac-ws-wallets .pws-btn').forEach(b => b.classList.remove('on'));
  if (btn) btn.classList.add('on');
  updateAcWalletHint();
}

function toggleAcWalletSync(enabled) {
  const walletsWrap = document.getElementById('ac-ws-wallets');
  if (walletsWrap) {
    if (enabled) walletsWrap.classList.remove('disabled');
    else walletsWrap.classList.add('disabled');
  }
  updateAcWalletHint();
}

function updateAcWalletHint() {
  const hintEl = document.getElementById('ac-ws-hint');
  if (!hintEl) return;
  const toggle = document.getElementById('ac-sync-toggle');
  const isSync = toggle ? toggle.checked : true;
  if (!isSync) {
    hintEl.className = 'pay-ws-hint off';
    hintEl.innerHTML = LANG === 'bn' 
      ? '🚫 ওয়ালেটে কোনো প্রভাব পড়বে না (শুধুমাত্র সম্পূর্ণ শোধ চিহ্নিত হবে)' 
      : '🚫 No wallet sync (Hisab mark settled only)';
    return;
  }
  const due = PENDING_ALL_CLEAR ? PENDING_ALL_CLEAR.due : 0;
  const type = PENDING_ALL_CLEAR ? PENDING_ALL_CLEAR.type : 'receive';
  const w = SELECTED_AC_WALLET || 'cash';
  const wMeta = WALLET_META[w] || { icon: '💵', name: 'নগদ', en: 'Cash' };
  const wLabel = `${wMeta.icon} ${escapeHTML(LANG === 'bn' ? wMeta.name : wMeta.en)}`;
  if (type === 'receive') {
    hintEl.className = 'pay-ws-hint income';
    hintEl.innerHTML = LANG === 'bn'
      ? `📥 <b>${wLabel}</b> ওয়ালেটে আয় হিসেবে +৳${fmt(due)} জমা হবে`
      : `📥 +৳${fmt(due)} will be deposited as Income into <b>${wLabel}</b>`;
  } else {
    hintEl.className = 'pay-ws-hint expense';
    hintEl.innerHTML = LANG === 'bn'
      ? `📤 <b>${wLabel}</b> ওয়ালেট থেকে -৳${fmt(due)} খরচ কাটা হবে`
      : `📤 -৳${fmt(due)} will be deducted as Expense from <b>${wLabel}</b>`;
  }
}

function openPay(type,id){
  const p=DB[type]?.find(x=>x.id===id);if(!p)return;CTX={type,id};
  const breakdown=getLoanBreakdown(p);
  const due=(type==='receive'&&breakdown)?Math.max(0,breakdown.totalRepayment-breakdown.paidAmount):p.remaining;
  document.getElementById('m-pay-s').textContent=`${p.name} — Due: ৳${fmt(due)}`;
  document.getElementById('pa').value='';document.getElementById('pn').value='';
  
  const chip=document.getElementById('btn-pay-full-fill');
  if(chip){
    chip.style.display=due>0?'inline-flex':'none';
    chip.innerHTML=`<span class="bn">⚡ সম্পূর্ণ পরিশোধ (৳${fmt(due)})</span><span class="en">⚡ Full Pay (৳${fmt(due)})</span>`;
  }

  // Configure wallet sync
  const toggle = document.getElementById('pay-sync-toggle');
  if(toggle) toggle.checked = true;
  togglePayWalletSync(true);
  SELECTED_PAY_WALLET = 'cash';
  document.querySelectorAll('#pay-ws-wallets .pws-btn').forEach(b => {
    b.classList.toggle('on', b.getAttribute('data-w') === 'cash');
  });

  const wsLbl = document.getElementById('pay-ws-lbl');
  if(wsLbl){
    if(type === 'receive'){
      wsLbl.innerHTML = '<span class="bn">ওয়ালেটে টাকা জমা করুন (আয়):</span><span class="en">Deposit money to Wallet:</span>';
    } else {
      wsLbl.innerHTML = '<span class="bn">ওয়ালেট থেকে খরচ করুন (ব্যয়):</span><span class="en">Pay from Wallet:</span>';
    }
  }
  updatePayWalletHint();
  
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
  updatePayWalletHint();
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

  // Configure wallet sync for all clear
  const toggle = document.getElementById('ac-sync-toggle');
  if(toggle) toggle.checked = true;
  toggleAcWalletSync(true);
  SELECTED_AC_WALLET = 'cash';
  document.querySelectorAll('#ac-ws-wallets .pws-btn').forEach(b => {
    b.classList.toggle('on', b.getAttribute('data-w') === 'cash');
  });

  const wsLbl = document.getElementById('ac-ws-lbl');
  if(wsLbl){
    if(type === 'receive'){
      wsLbl.innerHTML = '<span class="bn">ওয়ালেটে টাকা জমা করুন (আয়):</span><span class="en">Deposit money to Wallet:</span>';
    } else {
      wsLbl.innerHTML = '<span class="bn">ওয়ালেট থেকে খরচ করুন (ব্যয়):</span><span class="en">Pay from Wallet:</span>';
    }
  }
  updateAcWalletHint();
  
  document.getElementById('m-allclear').classList.add('on');
}

function confirmAllClearExecution(){
  const {saveData,saveCashData,saveCats,render,renderCash,renderHisabMiniWallets,renderAllQtags,renderCatMgrSections,updateProfileHeaderUI,cm,closeCashForm,openProfileSwitcher,switchProfile,toast}=confirmedEffects;
  if(!PENDING_ALL_CLEAR) return;
  const { type, id } = PENDING_ALL_CLEAR;
  PENDING_ALL_CLEAR = null;
  
  const syncToggle = document.getElementById('ac-sync-toggle');
  const syncOn = syncToggle ? syncToggle.checked : true;
  const selectedWallet = SELECTED_AC_WALLET || 'cash';
  if(syncOn&&!walletEnabled(selectedWallet)){toast(LANG==='bn'?'চালু ওয়ালেট বাছুন।':'Choose an enabled wallet.');return;}
  
  cm('m-allclear');
  
  let p=DB[type]?.find(x=>x.id===id);
  if(!p)return;
  const due=money(type==='receive'&&getLoanBreakdown(p)?getLoanBreakdown(p).remainingDue:p.remaining);
  if(due<=0)return;
  const ts=Date.now(), txnId=nextId();
  let cashTxnId = null;

  if (syncOn) {
    ensureWallets();
    cashTxnId = txnId;
    const isRec = type === 'receive';
    if (isRec) {
      CASH_DB.wallets[selectedWallet] = (CASH_DB.wallets[selectedWallet] || 0) + due;
      CASH_DB.balance = (CASH_DB.balance || 0) + due;
      CASH_DB.history.unshift({
        id: cashTxnId,
        type: 'add',
        amt: due,
        note: `সব শোধ (পাওনা আদায়): ${p.name}`,
        category: 'debt_in',
        wallet: selectedWallet,
        date: ts,
        refHisabId: p.id,
        refType: 'receive'
      });
    } else {
      CASH_DB.wallets[selectedWallet] = (CASH_DB.wallets[selectedWallet] || 0) - due;
      CASH_DB.balance = (CASH_DB.balance || 0) - due;
      CASH_DB.history.unshift({
        id: cashTxnId,
        type: 'sub',
        amt: due,
        note: `সব শোধ (দেনা পরিশোধ): ${p.name}`,
        category: 'debt_out',
        wallet: selectedWallet,
        date: ts,
        refHisabId: p.id,
        refType: 'give'
      });
    }
  }

  const hist={
    id: txnId,
    date: ts,
    amt: due,
    note: LANG==='bn'?'সম্পূর্ণ পরিশোধ (All Clear)':'Full Payment (All Clear)',
    t: 'pay',
    wallet: syncOn ? selectedWallet : null,
    cashTxnId: cashTxnId
  };
  
  // Snapshots for Undo
  const undoProfileId=ROOT_DB.activeProfileId, undoOwner=CUR_USER.id;
  const oldRemaining=p.remaining;
  const oldClearedAt=p.clearedAt;
  
  p.history.unshift(hist);
  p.remaining=0;
  p.clearedAt=ts;
  
  const wName = WALLET_META[selectedWallet]?.name || selectedWallet;
  logActivity('সম্পূর্ণ পরিশোধ',`${p.name} — ৳${fmt(due)}${syncOn ? ` (${wName})` : ''}`);
  saveData();
  render();
  
  const undoFn = () => {
    if(cashTxnId&&!CASH_DB.history.some(h=>h.id===cashTxnId)){toast(LANG==='bn'?'ওয়ালেট ক্লিয়ার করার পরে এই পরিশোধ Undo করা যাবে না।':'Cannot undo this payment after clearing wallet history.');return;}
    if(CUR_USER?.id!==undoOwner||ROOT_DB.activeProfileId!==undoProfileId||(p=DB[type]?.find(x=>x.id===id))?.history[0]?.id!==txnId){toast(LANG==='bn'?'❌ পরবর্তী পরিবর্তনের পরে এই Undo করা যাবে না।':'❌ Cannot undo after later changes.');return;}
    p.history = p.history.filter(h => h.id !== txnId);
    p.remaining = oldRemaining;
    p.clearedAt = oldClearedAt;

    if (cashTxnId) {
      ensureWallets();
      const isRec = type === 'receive';
      if (isRec) {
        CASH_DB.wallets[selectedWallet] = (CASH_DB.wallets[selectedWallet] || 0) - due;
        CASH_DB.balance = (CASH_DB.balance || 0) - due;
      } else {
        CASH_DB.wallets[selectedWallet] = (CASH_DB.wallets[selectedWallet] || 0) + due;
        CASH_DB.balance = (CASH_DB.balance || 0) + due;
      }
      CASH_DB.history = CASH_DB.history.filter(h => h.id !== cashTxnId);
      saveCashData();
      if(typeof renderCash === 'function') renderCash();
  if(document.getElementById('m-analytics')?.classList.contains('on'))openAnalytics();
    }

    saveData();
    render();
    toast(LANG==='bn'?'↩️ আনডু করা হয়েছে':'↩️ Undone');
  };
  
  const syncMsg = syncOn ? (type === 'receive' ? ` (+৳${fmt(due)} ${wName}-এ জমা)` : ` (-৳${fmt(due)} ${wName} থেকে খরচ)`) : '';
  toast(LANG==='bn'?`🎉 ${p.name}-এর ৳${fmt(due)} সম্পূর্ণ শোধ হয়েছে!${syncMsg}`:`🎉 ${p.name} fully paid ৳${fmt(due)}!${syncMsg}`, undoFn);
}

function confirmPay(){
  return applyHisabPayment(CTX.type,CTX.id,parseFloat(document.getElementById('pa').value),document.getElementById('pn').value,document.getElementById('pay-sync-toggle')?.checked??true,SELECTED_PAY_WALLET||'cash');
}
function applyHisabPayment(type,id,amount,noteText,syncOn,selectedWallet){
  const CTX={type,id};
  const {saveData,saveCashData,saveCats,render,renderCash,renderHisabMiniWallets,renderAllQtags,renderCatMgrSections,updateProfileHeaderUI,cm,closeCashForm,openProfileSwitcher,switchProfile,toast}=confirmedEffects;
  const amt=money(amount);
  const note=String(noteText||'').trim()||'Payment';
  if(!validAmount(amt))return;
  const p=DB[CTX.type].find(x=>x.id===CTX.id);
  if(!p)return;
  const loan=CTX.type==='receive'?getLoanBreakdown(p):null;
  const outstanding=money(loan?loan.remainingDue:p.remaining);
  if(amt>outstanding){toast(LANG==='bn'?'❌ বকেয়ার বেশি পরিশোধ করা যাবে না।':'❌ Payment exceeds the amount due.');return;}

  if(syncOn&&!walletEnabled(selectedWallet)){toast(LANG==='bn'?'চালু ওয়ালেট বাছুন।':'Choose an enabled wallet.');return;}
  const ts=Date.now(), txnId=nextId();
  let cashTxnId = null;

  if (syncOn) {
    ensureWallets();
    cashTxnId = txnId;
    const isRec = CTX.type === 'receive';
    if (isRec) {
      CASH_DB.wallets[selectedWallet] = (CASH_DB.wallets[selectedWallet] || 0) + amt;
      CASH_DB.balance = (CASH_DB.balance || 0) + amt;
      CASH_DB.history.unshift({
        id: cashTxnId,
        type: 'add',
        amt: amt,
        note: `পাওনা আদায়: ${p.name}${note && note !== 'Payment' ? ' ('+note+')' : ''}`,
        category: 'debt_in',
        wallet: selectedWallet,
        date: ts,
        refHisabId: p.id,
        refType: 'receive'
      });
    } else {
      CASH_DB.wallets[selectedWallet] = (CASH_DB.wallets[selectedWallet] || 0) - amt;
      CASH_DB.balance = (CASH_DB.balance || 0) - amt;
      CASH_DB.history.unshift({
        id: cashTxnId,
        type: 'sub',
        amt: amt,
        note: `দেনা পরিশোধ: ${p.name}${note && note !== 'Payment' ? ' ('+note+')' : ''}`,
        category: 'debt_out',
        wallet: selectedWallet,
        date: ts,
        refHisabId: p.id,
        refType: 'give'
      });
    }
  }

  p.history.unshift({
    id: txnId,
    date: ts,
    amt,
    note,
    t: 'pay',
    wallet: syncOn ? selectedWallet : null,
    cashTxnId: cashTxnId
  });
  
  const breakdown = getLoanBreakdown(p);
  if(breakdown) {
    p.remaining = Math.max(0, breakdown.totalRepayment - breakdown.paidAmount);
  } else {
    p.remaining = Math.max(0, p.remaining - amt);
  }
  
  if(p.remaining===0) p.clearedAt=ts;
  const wName = WALLET_META[selectedWallet]?.name || selectedWallet;
  logActivity('পরিশোধ',`${p.name} — ৳${fmt(amt)}${syncOn ? ` (${wName})` : ''}`);
  cm('m-pay');
  saveData();
  render();
  
  const syncMsg = syncOn ? (CTX.type === 'receive' ? ` (+৳${fmt(amt)} ${wName}-এ জমা)` : ` (-৳${fmt(amt)} ${wName} থেকে খরচ)`) : '';
  toast(LANG==='bn'?`💸 পরিশোধ হয়েছে!${syncMsg}`:`💸 Recorded!${syncMsg}`);
  return true;
}
function openAddMore(type,id){
  const p=DB[type]?.find(x=>x.id===id);if(!p)return;CTX={type,id};
  document.getElementById('m-add-s').textContent=`${p.name} — Current: ৳${fmt(p.remaining)}`;
  document.getElementById('aa').value='';document.getElementById('an').value='';
  renderQtags('addmore-qtags', type==='receive'?'hisabReceive':'hisabGive', 'an');
  document.getElementById('m-add').classList.add('on');
}
function confirmAddMore(){
  const {saveData,saveCashData,saveCats,render,renderCash,renderHisabMiniWallets,renderAllQtags,renderCatMgrSections,updateProfileHeaderUI,cm,closeCashForm,openProfileSwitcher,switchProfile,toast}=confirmedEffects;
  const amt=money(parseFloat(document.getElementById('aa').value));
  const note=document.getElementById('an').value||'Added';
  if(!validAmount(amt))return;
  const p=DB[CTX.type].find(x=>x.id===CTX.id);
  const wasSettled=p.remaining===0;
  const ts=Date.now(), txnId=nextId();
  const hist={id:txnId,date:ts,amt,note,t:'add'};
  if(wasSettled){
    p.original=amt;
    p.remaining=amt;
    p.clearedAt=ts;
    p.history.unshift(hist);
    p.cycleStartedAt=ts;if(p.loanData)p.loanData.loanDate=localDateStr();
  } else {
    p.original=money(p.original+amt);
    p.remaining=money(p.remaining+amt);
    p.history.unshift(hist);
  }
  logActivity('পরিমাণ যোগ',`${p.name} — ৳${fmt(amt)}`);
  cm('m-add');saveData();render();toast(LANG==='bn'?'✅ সেভ হয়েছে।':'✅ Saved.');
}
function openEdit(type,id){
  const p=DB[type]?.find(x=>x.id===id);if(!p)return;CTX={type,id};
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
  const {saveData,saveCashData,saveCats,render,renderCash,renderHisabMiniWallets,renderAllQtags,renderCatMgrSections,updateProfileHeaderUI,cm,closeCashForm,openProfileSwitcher,switchProfile,toast}=confirmedEffects;
  const amt=money(parseFloat(document.getElementById('ed-amt').value));
  if(!validAmount(amt))return alert(LANG==='bn'?'সঠিক তথ্য দিন!':'Enter valid data!');
  const p=DB[CTX.type].find(x=>x.id===CTX.id);
  const oldAmt=p.original;
  const paid=p.history.filter(h=>h.t==='pay'&&(!p.cycleStartedAt||h.date>=p.cycleStartedAt)).reduce((s,h)=>s+h.amt,0);
  const fees=CTX.type==='receive'&&p.loanData?parseFeeString(document.getElementById('ed-fee').value):0;
  const total=CTX.type==='receive'&&p.loanData?calculateLoanTotal(amt,fees,document.getElementById('ed-loan-date').value).totalRepayment:amt;
  if(total<paid){toast(LANG==='bn'?'❌ ইতিমধ্যে পরিশোধ করা টাকার চেয়ে মোট হিসাব কম হতে পারবে না।':'❌ Total cannot be below payments already received.');return;}

  const newName=document.getElementById('ed-name').value.trim();
  const dateVal=document.getElementById('ed-date').value;
  if(newName)p.name=newName;
  p.original=amt;
  p.remaining=money(Math.max(0,total-paid));
  if(amt!==oldAmt)p.history.unshift({id:nextId(),date:Date.now(),t:'adjust',amt:Math.abs(money(amt-oldAmt)),note:`Correction: ${oldAmt} → ${amt}`});
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
  const {saveData,saveCashData,saveCats,render,renderCash,renderHisabMiniWallets,renderAllQtags,renderCatMgrSections,updateProfileHeaderUI,cm,closeCashForm,openProfileSwitcher,switchProfile,toast}=confirmedEffects;
  const profileId=ROOT_DB.activeProfileId,owner=CUR_USER.id;
  const p=DB[type].find(x=>x.id===id);
  if(!p)return;
  const idx=DB[type].findIndex(x=>x.id===id);
  const snapshot=JSON.parse(JSON.stringify(p));
  logActivity('এন্ট্রি ডিলিট',p.name);
  DB[type]=DB[type].filter(x=>x.id!==id);
  saveData();render();
  toast(LANG==='bn'?`🗑️ "${p.name}" ডিলিট হয়েছে`:`🗑️ "${p.name}" deleted`,()=>{
    const target=ROOT_DB?.profilesData?.[profileId];if(CUR_USER?.id!==owner||!target||target[type].some(x=>x.id===id))return;
    target[type].splice(Math.min(idx,target[type].length),0,snapshot);
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
      const wBadge = (h.wallet && WALLET_META[h.wallet]) ? ` [${WALLET_META[h.wallet].icon} ${LANG==='bn'?WALLET_META[h.wallet].name:WALLET_META[h.wallet].en}]` : '';
      t += `• ${fmtD(h.date)} — ${h.note}${wBadge}: ${sign}৳${fmt(h.amt)}\n`;
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
        ${recentTxns.map(h => {
          const wInfo = (h.wallet && WALLET_META[h.wallet]) ? `<span style="font-size:11px;opacity:0.85;margin-left:4px;">(${WALLET_META[h.wallet].icon} ${escapeHTML(LANG==='bn'?WALLET_META[h.wallet].name:WALLET_META[h.wallet].en)})</span>` : '';
          return `
          <div class="rc-hist-row">
            <span>${fmtD(h.date)} — ${escapeHTML(h.note)}${wInfo}</span>
            <b style="color:var(--${h.t==='add'?'red':'green'})">${h.t==='add'?'+':h.t==='pay'?'-':'↔'}৳${fmt(h.amt)}</b>
          </div>
        `;}).join('')}
      </div>
    `;
  }
  
  let loanNoticeHtml = '';
  if(breakdown) {
    loanNoticeHtml = `<div class="rc-due-note">${LANG==='bn'?'মূল: ৳':'Orig: ৳'}${fmt(p.original)} + ${LANG==='bn'?'ফী: ৳':'Fee: ৳'}${fmt(breakdown.fees)} = ${LANG==='bn'?'মোট প্রদেয় ৳':'Total ৳'}${fmt(breakdown.totalRepayment)}</div>`;
  }

  const slipHtml = `
    <div class="rc-slip ${isRec?'slip-receive':'slip-give'}" id="rc-visual-card">
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
          <span class="rc-meta-val rc-client-name">${escapeHTML(p.name)}</span>
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
          <div class="rc-stat-val val-b">${p.history.length}</div>
        </div>
      </div>
      
      ${historyRowsHtml}
      
      <div class="rc-footer">
        <div>
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

function generateReceiptBlob(p, type, mimeType = 'image/jpeg') {
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
      const isRec = type === 'receive';
      const recentTxns = p.history.slice(0, 6);
      
      const W = 620;
      const itemH = 34;
      const H = 550 + (recentTxns.length * itemH);
      const scale = 2.5; // High-resolution retina render
      
      const canvas = document.createElement('canvas');
      canvas.width = W * scale;
      canvas.height = H * scale;
      const ctx = canvas.getContext('2d');
      ctx.scale(scale, scale);
      
      // Pure White Background (Light Theme Luxury Voucher)
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, W, H);
      
      // Outer card border
      ctx.strokeStyle = '#e2e8f0';
      ctx.lineWidth = 1.5;
      _rcDrawRound(ctx, 2, 2, W - 4, H - 4, 18);
      ctx.stroke();
      
      // Top colored accent banner
      ctx.fillStyle = isRec ? '#059669' : '#dc2626';
      ctx.fillRect(2, 2, W - 4, 8);
      
      // Header brand
      ctx.fillStyle = '#0f172a';
      ctx.font = 'bold 22px Inter, sans-serif';
      ctx.fillText('📒 HISAB TRACKER PRO', 32, 48);
      
      ctx.fillStyle = '#64748b';
      ctx.font = '700 11px Inter, sans-serif';
      ctx.fillText('DIGITAL MONEY RECEIPT SLIP • মানি রিসিট ভাউচার', 32, 70);
      
      // Voucher badge (right)
      ctx.fillStyle = '#f1f5f9';
      _rcDrawRound(ctx, W - 165, 32, 135, 30, 8);
      ctx.fill();
      ctx.strokeStyle = '#cbd5e1';
      ctx.lineWidth = 1;
      ctx.stroke();
      ctx.fillStyle = '#1e293b';
      ctx.font = 'bold 12px monospace';
      ctx.fillText('#REC-' + String(p.id).slice(-6), W - 153, 52);
      
      // Perforated ticket divider
      ctx.strokeStyle = '#cbd5e1';
      ctx.setLineDash([5, 4]);
      ctx.beginPath();
      ctx.moveTo(30, 88);
      ctx.lineTo(W - 30, 88);
      ctx.stroke();
      ctx.setLineDash([]);
      
      // Meta cards: Party card & Date/Status card
      const metaY = 104;
      const metaH = 56;
      const halfW = (W - 74) / 2;
      
      // Left meta card (Party)
      ctx.fillStyle = '#f8fafc';
      _rcDrawRound(ctx, 30, metaY, halfW, metaH, 10);
      ctx.fill();
      ctx.strokeStyle = '#e2e8f0';
      ctx.lineWidth = 1;
      ctx.stroke();
      
      ctx.fillStyle = '#64748b';
      ctx.font = '800 10px Inter, sans-serif';
      ctx.fillText('PARTY / গ্রাহক:', 42, metaY + 20);
      ctx.fillStyle = '#1e40af';
      ctx.font = 'bold 16px Inter, "Hind Siliguri", sans-serif';
      ctx.fillText(p.name, 42, metaY + 43);
      
      // Right meta card (Date & Status)
      ctx.fillStyle = '#f8fafc';
      _rcDrawRound(ctx, 30 + halfW + 14, metaY, halfW, metaH, 10);
      ctx.fill();
      ctx.strokeStyle = '#e2e8f0';
      ctx.lineWidth = 1;
      ctx.stroke();
      
      ctx.fillStyle = '#64748b';
      ctx.font = '800 10px Inter, sans-serif';
      ctx.fillText('DATE & STATUS / তারিখ ও অবস্থা:', 44 + halfW + 14, metaY + 20);
      const dateStr = new Date().toLocaleDateString('en-GB', { day:'2-digit', month:'short', year:'numeric' });
      ctx.fillStyle = '#334155';
      ctx.font = '700 12.5px Inter, sans-serif';
      ctx.fillText(dateStr + ' • ' + (settled ? '✓ PAID' : (isRec ? 'RECEIVABLE' : 'PAYABLE')), 44 + halfW + 14, metaY + 43);
      
      // Big Due Box
      const dueY = metaY + metaH + 14;
      ctx.fillStyle = isRec ? '#ecfdf5' : '#fff1f2';
      _rcDrawRound(ctx, 30, dueY, W - 60, 90, 14);
      ctx.fill();
      ctx.strokeStyle = isRec ? '#a7f3d0' : '#fecdd3';
      ctx.lineWidth = 1.5;
      ctx.stroke();
      
      ctx.fillStyle = isRec ? '#059669' : '#dc2626';
      ctx.font = 'bold 11px Inter, sans-serif';
      ctx.fillText(settled ? 'SETTLED BALANCE / পরিশোধিত' : (isRec ? 'NET RECEIVABLE / মোট বকেয়া পাওনা' : 'NET PAYABLE / মোট বকেয়া দেনা'), 48, dueY + 28);
      
      ctx.fillStyle = isRec ? '#047857' : '#9f1239';
      ctx.font = '900 38px Inter, sans-serif';
      ctx.fillText('৳ ' + fmt(remAmt), 48, dueY + 70);
      
      if(!settled && d > 0) {
        ctx.fillStyle = '#64748b';
        ctx.font = '600 12px Inter, sans-serif';
        ctx.fillText(`(Pending ${d} days / ${d} দিন)`, W - 200, dueY + 66);
      }
      
      // 3 Summary Cols
      const statY = dueY + 104;
      ctx.fillStyle = '#f8fafc';
      _rcDrawRound(ctx, 30, statY, W - 60, 58, 12);
      ctx.fill();
      ctx.strokeStyle = '#e2e8f0';
      ctx.lineWidth = 1;
      ctx.stroke();
      
      const colW = (W - 60) / 3;
      ctx.fillStyle = '#64748b';
      ctx.font = '800 10px Inter, sans-serif';
      ctx.fillText('ORIGINAL / মূল', 46, statY + 22);
      ctx.fillStyle = '#0f172a';
      ctx.font = 'bold 15px Inter, sans-serif';
      ctx.fillText('৳ ' + fmt(p.original), 46, statY + 45);
      
      ctx.fillStyle = '#64748b';
      ctx.font = '800 10px Inter, sans-serif';
      ctx.fillText('TOTAL PAID / পরিশোধ', 46 + colW, statY + 22);
      ctx.fillStyle = '#059669';
      ctx.font = 'bold 15px Inter, sans-serif';
      ctx.fillText('৳ ' + fmt(paidAmt), 46 + colW, statY + 45);
      
      ctx.fillStyle = '#64748b';
      ctx.font = '800 10px Inter, sans-serif';
      ctx.fillText('ENTRIES / লেনদেন', 46 + colW * 2, statY + 22);
      ctx.fillStyle = '#2563eb';
      ctx.font = 'bold 15px Inter, sans-serif';
      ctx.fillText(p.history.length + ' txns', 46 + colW * 2, statY + 45);
      
      // Recent History Table
      const histY = statY + 80;
      ctx.fillStyle = '#475569';
      ctx.font = 'bold 11.5px Inter, sans-serif';
      ctx.fillText('RECENT TRANSACTIONS / সাম্প্রতিক লেনদেন:', 32, histY);
      
      let curY = histY + 14;
      if (recentTxns.length === 0) {
        ctx.fillStyle = '#94a3b8';
        ctx.font = 'italic 12px Inter, sans-serif';
        ctx.fillText('No transaction history recorded', 32, curY + 20);
        curY += 36;
      } else {
        recentTxns.forEach((h, idx) => {
          curY += 28;
          ctx.fillStyle = idx % 2 === 0 ? '#f8fafc' : '#ffffff';
          ctx.fillRect(30, curY - 18, W - 60, 26);
          ctx.strokeStyle = '#f1f5f9';
          ctx.strokeRect(30, curY - 18, W - 60, 26);
          
          ctx.fillStyle = '#64748b';
          ctx.font = '600 11.5px Inter, sans-serif';
          ctx.fillText(fmtD(h.date), 42, curY);
          
          ctx.fillStyle = '#1e293b';
          ctx.font = '600 12.5px Inter, "Hind Siliguri", sans-serif';
          const n = h.note.length > 26 ? h.note.slice(0, 24) + '..' : h.note;
          ctx.fillText(n, 140, curY);
          
          const isAdd = h.t === 'add';
          ctx.fillStyle = isAdd ? '#dc2626' : '#059669';
          ctx.font = 'bold 13px Inter, sans-serif';
          const a = (isAdd ? '+' : '-') + ' ৳' + fmt(h.amt);
          ctx.fillText(a, W - 145, curY);
        });
        curY += 16;
      }
      
      // Footer Divider
      ctx.strokeStyle = '#cbd5e1';
      ctx.setLineDash([5, 4]);
      ctx.beginPath();
      ctx.moveTo(30, curY + 8);
      ctx.lineTo(W - 30, curY + 8);
      ctx.stroke();
      ctx.setLineDash([]);
      
      // Barcode & Stamp
      const footY = curY + 24;
      _rcDrawBarcode(ctx, 32, footY, 170, 22);
      ctx.fillStyle = '#64748b';
      ctx.font = '9.5px Inter, monospace';
      ctx.fillText('HISAB TRACKER PRO • profess0r-null.xyz', 32, footY + 36);
      
      // Stamp
      ctx.save();
      ctx.translate(W - 110, footY + 12);
      ctx.rotate(-6 * Math.PI / 180);
      ctx.fillStyle = '#ecfdf5';
      ctx.fillRect(-62, -15, 124, 30);
      ctx.strokeStyle = '#059669';
      ctx.lineWidth = 2;
      ctx.strokeRect(-62, -15, 124, 30);
      ctx.fillStyle = '#059669';
      ctx.font = 'bold 10.5px Inter, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('VERIFIED SLIP ✓', 0, 5);
      ctx.restore();
      
      canvas.toBlob(blob => {
        if(blob) resolve(blob);
        else reject(new Error('Canvas blob failed'));
      }, mimeType, 0.96);
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
  ctx.fillStyle = '#1e293b';
  let cx = x;
  const bars = [2, 1, 3, 1, 2, 4, 1, 2, 3, 1, 1, 3, 2, 1, 4, 2, 1, 3, 2, 1, 2, 3, 1, 4, 2, 1, 3, 2, 1];
  for (let b of bars) {
    if (cx + b > x + w) break;
    ctx.fillRect(cx, y, b, h);
    cx += b + 2;
  }
}

async function downloadReceiptImage(format = 'jpg') {
  if (!CURRENT_RECEIPT_DATA) return;
  const { p, type } = CURRENT_RECEIPT_DATA;
  toast(LANG === 'bn' ? '🎨 রসিদ ইমেজ তৈরি হচ্ছে...' : '🎨 Generating receipt image...');
  try {
    const mime = format === 'png' ? 'image/png' : 'image/jpeg';
    const ext = format === 'png' ? 'png' : 'jpg';
    const blob = await generateReceiptBlob(p, type, mime);
    
    const cleanName = (p.name || 'Party').replace(/[^a-zA-Z0-9_\u0980-\u09FF]/g, '_');
    const fileName = `Receipt_${cleanName}_${new Date().toISOString().split('T')[0]}.${ext}`;
    
    // Direct browser download into Downloads / Gallery
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = fileName;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(url), 2000);
    
    toast(LANG === 'bn' ? '📸 স্লিপ আপনার গ্যালারিতে/ডাউনলোডসে সেভ হয়েছে!' : '📸 Receipt image saved to Gallery!');
  } catch(e) {
    console.error(e);
    toast(LANG === 'bn' ? '❌ ইমেজ সেভ করতে সমস্যা হয়েছে' : '❌ Failed to save image');
  }
}

async function shareReceiptSlip() {
  if (!CURRENT_RECEIPT_DATA) return;
  const { p, type } = CURRENT_RECEIPT_DATA;
  toast(LANG === 'bn' ? '⏳ শেয়ার তৈরি হচ্ছে...' : '⏳ Preparing share...');
  try {
    const blob = await generateReceiptBlob(p, type, 'image/jpeg');
    const cleanName = (p.name || 'Party').replace(/[^a-zA-Z0-9_\u0980-\u09FF]/g, '_');
    const fileName = `Receipt_${cleanName}_${new Date().toISOString().split('T')[0]}.jpg`;
    const file = new File([blob], fileName, { type: 'image/jpeg' });
    
    if (navigator.canShare && navigator.canShare({ files: [file] })) {
      await navigator.share({
        files: [file],
        title: `Money Receipt - ${p.name}`,
        text: getReceiptWhatsAppText(p, type)
      });
      toast(LANG === 'bn' ? '✅ শেয়ার সম্পন্ন হয়েছে!' : '✅ Shared successfully!');
    } else {
      // Fallback: download directly
      downloadReceiptImage('jpg');
    }
  } catch(e) {
    if (e.name !== 'AbortError') {
      console.error(e);
      toast(LANG === 'bn' ? '❌ শেয়ার করতে সমস্যা হয়েছে' : '❌ Share failed');
    }
  }
}

// ── CARD HISTORY: latest five or complete history ──
const _expandedHistoryCards = new Set();

function renderCardHistoryItems(p, isExp) {
  if (!p || !p.history || !p.history.length) return '';
  const maxShown = isExp ? p.history.length : 5;
  const list = p.history.slice(0, maxShown);
  const items = list.map(h => {
    const wBadge = (h.wallet && WALLET_META[h.wallet]) 
      ? `<span class="hist-wbadge" title="${escapeHTML(WALLET_META[h.wallet].name)}">${WALLET_META[h.wallet].icon} ${escapeHTML(LANG==='bn'?WALLET_META[h.wallet].name:WALLET_META[h.wallet].en)}</span>` 
      : '';
    const actionLabel=LANG==='bn'?(h.t==='add'?'যোগ হয়েছে':h.t==='pay'?'পরিশোধ':'সংশোধন'):(h.t==='add'?'Added':h.t==='pay'?'Payment':'Adjusted');
    const paths=h.t==='add'?'<path d="M12 5v14M5 12h14"/>':h.t==='pay'?'<path d="m5 12 4 4L19 6"/>':'<path d="M4 8h16m-4-4 4 4-4 4M20 16H4m4-4-4 4 4 4"/>';
    return `<div class="hi history-row history-${h.t==='add'?'addition':h.t==='pay'?'payment':'adjustment'}"><div class="history-symbol" aria-hidden="true"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round">${paths}</svg></div><div class="history-copy"><div class="history-note">${escapeHTML(h.note||actionLabel)}</div><div class="history-meta"><time>${fmtD(h.date)}</time>${wBadge}</div></div><div class="history-value"><b>${h.t==='add'?'+':h.t==='pay'?'−':'↔'} ৳${fmt(h.amt)}</b></div></div>`;
  }).join('');
  
  if (p.history.length <= 5) {
    return items;
  }
  
  const total = p.history.length;
  const countToDisplay = total;
  const btnLabel = isExp
    ? (LANG==='bn'?'কম দেখুন':'Show less')
    : (LANG==='bn'?`সব ইতিহাস দেখুন (${countToDisplay}টি)`:`View all history (${countToDisplay})`);

  const notice = '';

  const cardType = p._type || (DB.receive.some(x=>x.id===p.id)?'receive':'give');
  return `
    ${items}
    <div class="hist-toggle-wrap">
      <button type="button" class="btn-hist-toggle" aria-expanded="${isExp}" onclick="toggleCardHistory('${cardType}', ${p.id}, event)">
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
    <div class="pt" role="button" tabindex="0" aria-expanded="false" onclick="toggleAccountCard(this)" onkeydown="if(event.key==='Enter'||event.key===' '){event.preventDefault();toggleAccountCard(this)}">
      <div class="pt-l">
        <div class="pname" title="${escapeHTML(p.name)}">${escapeHTML(p.name)}</div>
        <div class="pbadge ${settled?'':b.cls}">${ageLbl}</div>
      </div>
      <div class="pt-r">
        <div class="pamt" style="color:${col}">৳${fmt(displayAmt)}</div>
        <div class="pamt-caption">${pct}% ${LANG==='bn'?'শোধ হয়েছে':'paid'}</div>
        <div class="pbar-wrap">
          <div class="pbar"><div class="pbar-fill" style="width:${pct}%;background:${col}"></div></div>

        </div>
      </div>
    </div>
    <div class="pbody">
      <div class="psum">
        <div class="ps-i"><div class="ps-l bn">${p.cycleStartedAt?'এই দফার মূল':'মূল টাকা'}</div><div class="ps-l en">${p.cycleStartedAt?'Current cycle total':'Original total'}</div><div class="ps-v" style="color:${col}">৳${fmt(p.original)}</div></div>
        <div class="ps-i"><div class="ps-l bn">${p.cycleStartedAt?'এই দফায় শোধ':'পরিশোধ হয়েছে'}</div><div class="ps-l en">${p.cycleStartedAt?'Paid this cycle':'Paid'}</div><div class="ps-v" style="color:var(--green)">৳${fmt(type==='receive'&&getLoanBreakdown(p)?getLoanBreakdown(p).paidAmount:(p.original-p.remaining))}</div></div>
        <div class="ps-i"><div class="ps-l bn">মোট লেনদেন</div><div class="ps-l en">All transactions</div><div class="ps-v">${p.history.length}</div></div>
      </div>
      ${p.cycleStartedAt?`<p class="card-cycle-note">${LANG==='bn'?'মূল ও পরিশোধের অঙ্ক এই দফার হিসাব। নিচে আগের সব লেনদেনও আছে।':'Totals reflect the current cycle. History also includes earlier transactions.'}</p>`:''}
      ${loanBreakdownHtml}
      <div class="person-actions">
        <button type="button" class="person-action person-action-pay" ${settled?'disabled':''} onclick="openPay('${type}',${p.id})"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 4v16m-6-6 6 6 6-6"/></svg><span class="bn">${type==='receive'?'পেয়েছি':'দিয়েছি'}</span><span class="en">${type==='receive'?'Received':'Paid'}</span></button>
        <button type="button" class="person-action person-action-add" onclick="openAddMore('${type}',${p.id})"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 5v14M5 12h14"/></svg><span class="bn">আরও যোগ</span><span class="en">Add more</span></button>
        <button type="button" class="person-action person-action-receipt" onclick="openReceipt('${type}',${p.id})"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 3h12v18l-3-2-3 2-3-2-3 2V3Zm3 5h6m-6 4h6"/></svg><span class="bn">রসিদ</span><span class="en">Receipt</span></button>
        <button type="button" class="person-action person-action-settle" ${settled?'disabled':''} onclick="oneClickAllClear('${type}',${p.id},event)"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="m3 12 4 4 9-9m-5 9 9-9"/></svg><span class="bn">সব শোধ</span><span class="en">All clear</span></button>
        <button type="button" class="person-action person-action-edit" onclick="openEdit('${type}',${p.id})"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="m15 5 4 4M4 20l4-1L20 7a2.8 2.8 0 0 0-4-4L4 15v5Z"/></svg><span class="bn">এডিট</span><span class="en">Edit</span></button>
        <button type="button" class="person-action person-action-delete" onclick="deleteEntry('${type}',${p.id})"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3 6h18M9 6V3h6v3M5 6l1 15h12l1-15M10 10v7m4-7v7"/></svg><span class="bn">মুছুন</span><span class="en">Delete</span></button>
      </div>
      <div class="hh card-history-heading"><span class="bn">লেনদেনের ইতিহাস</span><span class="en">Transaction history</span><span class="history-count">${p.history.length}</span></div>
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
  const mk=(list,col,bnt,ent,type)=>{
    if(!list.length)return'';
    return`<div class="top-s"><div class="top-sh"><span class="bn">${bnt}</span><span class="en">${ent}</span></div>${list.map((p,i)=>{const b=ageBadge(ageDays(p));return`<div class="top-row"><span class="top-rank">#${i+1}</span><button type="button" title="${escapeHTML(p.name)}" class="top-name top-person-link" onclick="openTopPerson('${type}',${p.id})">${escapeHTML(p.name)}</button><span class="top-age ${b.cls}">${b.l}</span><span class="top-amt" style="color:${col}">৳${fmt(p.remaining)}</span></div>`;}).join('')}</div>`;
  };
  const tR=[...DB.receive].filter(p=>p.remaining>0&&(!q||matchesPerson(p,q))).sort((a,b)=>b.remaining-a.remaining).slice(0,5);
  const tG=[...DB.give].filter(p=>p.remaining>0&&(!q||matchesPerson(p,q))).sort((a,b)=>b.remaining-a.remaining).slice(0,5);
  document.getElementById('top-lists').innerHTML=mk(tR,'var(--green)','🏆 সর্বোচ্চ পাওনাদার','🏆 Top Receivables','receive')+mk(tG,'var(--red)','🏆 সর্বোচ্চ দেনাদার','🏆 Top Payables','give');
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
  renderHisabMiniWallets();
  const fl=list=>q?list.filter(p=>matchesPerson(p,q)):list;
  const sR=fl([...DB.receive].filter(p=>p.remaining>0)).sort((a,b)=>b.remaining-a.remaining);
  const shR=SA.r?sR:sR.slice(0,3);
  document.getElementById('lst-r').innerHTML=shR.map(p=>renderCard(p,'receive')).filter(Boolean).join('')||emptyS(q?'এই খোঁজে কোনো পাওনা পাওয়া যায়নি':'কোনো পাওনা নেই — উপরের ফর্মে যোগ করুন',q?'No matching receivables':'No receivables — add one using the form above','<svg xmlns="http://www.w3.org/2000/svg" width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="22 12 16 12 14 15 10 15 8 12 2 12"/><path d="M5.45 5.11 2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6l-3.45-6.89A2 2 0 0 0 16.76 4H7.24a2 2 0 0 0-1.79 1.11z"/></svg>');
  shR.forEach(p=>{const el=document.getElementById('card-'+p.id);if(el)initSwipe(el,'receive',p.id);});
  const bR=document.getElementById('sa-r');
  bR.style.display=sR.length>3?'inline-flex':'none';
  bR.querySelector('.bn').textContent=SA.r?'কম দেখুন':`সব দেখুন (${sR.length})`;
  bR.querySelector('.en').textContent=SA.r?'Show Less':`See All (${sR.length})`;
  const sG=fl([...DB.give].filter(p=>p.remaining>0)).sort((a,b)=>b.remaining-a.remaining);
  const shG=SA.g?sG:sG.slice(0,3);
  document.getElementById('lst-g').innerHTML=shG.map(p=>renderCard(p,'give')).filter(Boolean).join('')||emptyS(q?'এই খোঁজে কোনো দেনা পাওয়া যায়নি':'কোনো দেনা নেই — উপরের ফর্মে যোগ করুন',q?'No matching payables':'No payables — add one using the form above','<svg xmlns="http://www.w3.org/2000/svg" width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>');
  shG.forEach(p=>{const el=document.getElementById('card-'+p.id);if(el)initSwipe(el,'give',p.id);});
  const bG=document.getElementById('sa-g');
  bG.style.display=sG.length>3?'inline-flex':'none';
  bG.querySelector('.bn').textContent=SA.g?'কম দেখুন':`সব দেখুন (${sG.length})`;
  bG.querySelector('.en').textContent=SA.g?'Show Less':`See All (${sG.length})`;
  if(TAB==='a') renderAll();
}

// ── HISAB MINI WALLETS STRIP (OPTION 2) ──
function renderHisabMiniWallets(){
  const wrap = document.getElementById('hisab-mini-wallets');
  if(!wrap) return;

  ensureProfilesStructure();
  ensureWallets();

  const w = CASH_DB.wallets || { cash: 0, bkash: 0, nagad: 0, bank: 0 };
  const totalBal = Object.values(w).reduce((s, v) => s + (Number(v) || 0), 0);

  const totalEl = document.getElementById('hmw-total');
  if(totalEl) totalEl.textContent = '৳' + fmt(totalBal);

  const grid = document.getElementById('hmw-grid');
  if(!grid) return;

  const keys = enabledWalletKeys();
  grid.innerHTML = keys.map(k => {
    const meta = WALLET_META[k] || { icon: '💵', name: 'নগদ', en: 'Cash' };
    const amt = w[k] || 0;
    const nameStr = LANG === 'bn' ? meta.name : meta.en;
    const glyph=k.startsWith('wallet_')?customWalletIconPath(WALLET_META[k]?.iconKind):k==='cash'?'<rect x="3" y="5" width="18" height="14" rx="2"/><circle cx="12" cy="12" r="3"/><path d="M6 9h1m10 6h1"/>':k==='bank'?'<path d="m3 9 9-6 9 6H3Zm2 3v6m5-6v6m4-6v6m5-6v6M3 21h18"/>':'<rect x="6" y="2" width="12" height="20" rx="3"/><path d="M10 5h4m-3 14h2"/>';

    return `
      <div class="hmw-pill" data-wallet="${k}" onclick="goToCashWallet('${k}', event)" title="${escapeHTML(nameStr)}: ৳${fmt(amt)} (${LANG==='bn'?'ক্লিক করে আয়-ব্যয়ে যান':'Click to view in Expense'})">
        <div class="hmw-pill-top">
          <span class="hmw-pill-icon" aria-hidden="true"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round">${glyph}</svg></span>
          <span class="hmw-pill-name" title="${escapeHTML(nameStr)}">${escapeHTML(nameStr)}</span>
        </div>
        <div class="hmw-pill-amt">৳${fmt(amt)}</div>
      </div>
    `;
  }).join('');
}

function goToCashWallet(wKey, ev){
  if(ev) ev.stopPropagation();
  setAppTab('cash');
  if(wKey && typeof toggleWalletFilter === 'function'){
    if(WALLET_FILTER !== wKey){
      toggleWalletFilter(wKey);
    }
  }
}

// ── BACKUP ──
function exportData(){
  ensureProfilesStructure();downloadJSON({version:3,appName:'HisabTrackerPRO',exportedAt:new Date().toISOString(),hisab:makeSnapshot(),cash:ROOT_CASH_DB},'hisab_backup_'+localDateStr()+'.json');
}
function triggerImport(){document.getElementById('importFile').click();}
function handleImport(e){
  const file=e.target.files?.[0];if(!file)return;if(file.size>10*1024*1024){toast('❌ Backup must be smaller than 10 MB');e.target.value='';return;}
  const reader=new FileReader();reader.onload=async event=>{
    try{
      const parsed=JSON.parse(event.target.result);let hisab,cash;
      if(parsed.appName==='HisabTrackerPRO'&&[2,3].includes(parsed.version)&&parsed.hisab&&parsed.cash){hisab=parsed.hisab;cash=parsed.cash;}
      else if(Array.isArray(parsed.receive)&&Array.isArray(parsed.give)){hisab=JSON.parse(JSON.stringify(ROOT_DB));hisab.profilesData[ROOT_DB.activeProfileId]={...DB,...parsed};cash=JSON.parse(JSON.stringify(ROOT_CASH_DB));}
      else throw new Error('Unsupported backup format');
      HisabSafety.validate(hisab,cash);
      if(!confirm(LANG==='bn'?'এই ব্যাকআপ দিয়ে হিসাব প্রতিস্থাপন করবেন? বর্তমান হিসাবের ব্যাকআপ আগে ডাউনলোড হবে।':'Replace account data with this backup? Your current data will be downloaded first.'))return;
      exportData();
      const ok=await runConfirmedChange(()=>{ROOT_DB=JSON.parse(JSON.stringify(hisab));ROOT_CASH_DB=JSON.parse(JSON.stringify(cash));ROOT_DB._cash=ROOT_CASH_DB;ensureProfilesStructure();logActivity('Backup import');confirmedEffects.saveData();confirmedEffects.render();confirmedEffects.renderCash();confirmedEffects.updateProfileHeaderUI();confirmedEffects.toast(LANG==='bn'?'✅ ব্যাকআপ সেভ হয়েছে।':'✅ Backup saved.');},{name:'import',args:[file.name,file.size,file.lastModified,JSON.stringify(hisab),JSON.stringify(cash)]});
      if(ok)e.target.value='';
    }catch(error){toast('❌ Invalid backup: '+error.message);}
  };reader.onerror=()=>{toast('❌ Backup could not be read');e.target.value='';};reader.readAsText(file);
}

document.addEventListener('DOMContentLoaded',()=>{
  ensureProfilesStructure();
  updateProfileHeaderUI();
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
      render();
      renderCash();
    }
  },60000);
});

// Modal keyboard navigation and accessible names.
document.addEventListener('DOMContentLoaded',()=>{
  const previous=new WeakMap();
  for(const overlay of document.querySelectorAll('.overlay')){
    const dialog=overlay.querySelector('.modal')||overlay.firstElementChild;if(!dialog)continue;
    dialog.setAttribute('role','dialog');dialog.setAttribute('aria-modal','true');dialog.tabIndex=-1;
    const title=dialog.querySelector('.modal-title,.sheet-title');if(title)dialog.setAttribute('aria-label',title.textContent.trim());
    new MutationObserver(()=>{
      if(overlay.classList.contains('on')){previous.set(overlay,document.activeElement);const first=dialog.querySelector('input:not([type=hidden]),select,textarea,button');(first||dialog).focus();}
      else{const old=previous.get(overlay);if(old?.isConnected)old.focus();}
    }).observe(overlay,{attributes:true,attributeFilter:['class']});
  }
  const labels={'au-email':'Email','au-pass':'Password','au-name':'Name','r-na':'Receivable person name','g-na':'Payable person name','r-am':'Receivable amount','g-am':'Payable amount','aa':'Additional amount','an':'Additional note','pa':'Payment amount','pn':'Payment note','cash-amt':'Cash amount','cash-note':'Cash note','cash-date':'Transaction date','srch':'Search people','cash-srch':'Search transactions'};
  for(const [id,label]of Object.entries(labels)){const input=document.getElementById(id);if(input)input.setAttribute('aria-label',label);}
  document.addEventListener('keydown',event=>{
    const open=[...document.querySelectorAll('.overlay.on')].at(-1);if(!open)return;
    if(event.key==='Escape'){event.preventDefault();cm(open.id);return;}
    if(event.key!=='Tab')return;
    const items=[...open.querySelectorAll('button,input:not([type=hidden]),select,textarea,a[href],[tabindex="0"]')].filter(x=>!x.disabled&&x.getClientRects().length);
    if(!items.length){event.preventDefault();return;}const first=items[0],last=items.at(-1);
    if(event.shiftKey&&document.activeElement===first){event.preventDefault();last.focus();}else if(!event.shiftKey&&document.activeElement===last){event.preventDefault();first.focus();}
  });
});

// Confirmed command boundary: prepare against a detached account draft, persist it,
// then publish the data and UI effects together. Failed forms stay unchanged.
let activeDraft=null,savingChange=false,failedCommand=null;
function commandFields(){return [...document.querySelectorAll('input,textarea,select')].filter(el=>el.type!=='file').map(el=>({el,value:el.value,checked:el.checked}));}
function restoreFields(fields){for(const f of fields){f.el.value=f.value;if(typeof f.checked==='boolean')f.el.checked=f.checked;}}
function commandUI(){return [...document.querySelectorAll('.overlay,#app,#pin-screen,#cash-form')].map(el=>({el,className:el.className,style:el.getAttribute('style')}));}
function restoreUI(ui){for(const v of ui){v.el.className=v.className;if(v.style==null)v.el.removeAttribute('style');else v.el.setAttribute('style',v.style);}}
function draftEffect(name,args){
  if(activeDraft){activeDraft.effects.push(()=>globalThis[name](...args));return;}
  return globalThis[name](...args);
}
const confirmedEffects={
  saveData(){if(activeDraft)activeDraft.dirty=true;},saveCashData(){if(activeDraft)activeDraft.dirty=true;},saveCats(){if(activeDraft)activeDraft.dirty=true;},
  switchProfile(id,notify=true){
    if(!activeDraft)return switchProfile(id,notify);
    if(!ROOT_DB.profiles.some(p=>p.id===id))return;
    activeDraft.dirty=true;ROOT_DB.activeProfileId=id;localStorage.setItem('ht_active_profile_'+CUR_USER.id,id);ensureProfilesStructure();
    confirmedEffects.render();confirmedEffects.renderCash();confirmedEffects.updateProfileHeaderUI();confirmedEffects.cm('m-profiles');
  },
  toast(message,undo){
    const undoKey=undo?String(nextId()):null;
    const effect=()=>toast(message,undo?()=>runConfirmedChange(undo,{name:'undo',args:[undoKey]}):null);
    if(activeDraft)activeDraft.effects.push(effect);else effect();
  }
};
for(const name of ['render','renderCash','renderHisabMiniWallets','renderAllQtags','renderCatMgrSections','updateProfileHeaderUI','cm','closeCashForm','openProfileSwitcher'])confirmedEffects[name]=(...args)=>draftEffect(name,args);
function clearSaveNotice(){for(const el of document.querySelectorAll('.form-save-notice'))el.remove();}
function saveNotice(target,message,retry){
  clearSaveNotice();const box=document.createElement('div');box.className='form-save-notice';box.setAttribute('role','alert');
  const text=document.createElement('span');text.textContent=message;box.appendChild(text);
  if(retry){const button=document.createElement('button');button.type='button';button.textContent=LANG==='bn'?'আবার চেষ্টা করুন':'Try again';button.addEventListener('click',retry);box.appendChild(button);}
  (target?.isConnected?target:document.querySelector('.overlay.on .modal')||document.getElementById('app')).appendChild(box);
}
async function runConfirmedChange(command,descriptor={name:'change',args:[]}){
  if(savingChange||!CUR_USER)return false;
  const user=CUR_USER.id,key='ht_active_profile_'+user,preference=localStorage.getItem(key),fields=commandFields();
  const signature=JSON.stringify([descriptor.name,descriptor.args,ROOT_DB?.activeProfileId,CTX,pinMode,pinBuf,pinTmp,fields.map(f=>[f.el.id,f.value,f.checked])]);
  const source=document.activeElement,button=source?.closest?.('button'),target=source?.closest?.('.modal,.cash-form,.add-form,.pin-box')||button?.parentElement||document.querySelector('.overlay.on .modal')||document.getElementById('app');
  let prepared=failedCommand?.signature===signature&&failedCommand.user===user?failedCommand:null;
  if(!prepared){
    const original={ROOT_DB,ROOT_CASH_DB,DB,CASH_DB,pinMode,pinBuf,pinTmp,pending:PENDING_ALL_CLEAR},ui=commandUI();
    activeDraft={dirty:false,effects:[]};
    try{
      ROOT_DB=JSON.parse(JSON.stringify(ROOT_DB));ROOT_CASH_DB=JSON.parse(JSON.stringify(ROOT_CASH_DB));ensureProfilesStructure();
      const result=command();if(result&&typeof result.then==='function')throw new Error('Command preparation must be synchronous');
      const after=commandFields();prepared={user,signature,operationId:String(nextId()),dirty:activeDraft.dirty,effects:activeDraft.effects,data:activeDraft.dirty?makeSnapshot():null,after,profile:ROOT_DB.activeProfileId,pin:{pinMode,pinBuf,pinTmp,pending:PENDING_ALL_CLEAR},uiAfter:commandUI()};
    }catch(error){prepared={error};}
    finally{
      ROOT_DB=original.ROOT_DB;ROOT_CASH_DB=original.ROOT_CASH_DB;DB=original.DB;CASH_DB=original.CASH_DB;pinMode=original.pinMode;pinBuf=original.pinBuf;pinTmp=original.pinTmp;PENDING_ALL_CLEAR=original.pending;
      if(preference==null)localStorage.removeItem(key);else localStorage.setItem(key,preference);
      restoreFields(fields);restoreUI(ui);activeDraft=null;
    }
    if(prepared.error){saveNotice(target,LANG==='bn'?'সেভ হয়নি। তথ্য দেখে আবার চেষ্টা করুন।':'Not saved. Check the details and try again.');return false;}
    if(!prepared.dirty){for(const effect of prepared.effects)effect();return false;}
  }
  savingChange=true;clearSaveNotice();
  const controls=[...document.querySelectorAll('button,input,textarea,select')].map(el=>({el,disabled:el.disabled})),label=button?.innerHTML;
  for(const c of controls)c.el.disabled=true;if(button)button.textContent=LANG==='bn'?'সেভ হচ্ছে…':'Saving…';
  document.body.setAttribute('aria-busy','true');
  let saved=false;
  try{
    const sync=getAccountSync();saved=await sync.save(prepared.data,prepared.operationId);
    if(!saved){failedCommand=prepared;const conflict=sync.lastError?.name==='SyncConflict';
      saveNotice(target,conflict?(LANG==='bn'?'হিসাব অন্য জায়গায় বদলেছে। পেজ রিফ্রেশ করে আবার চেষ্টা করুন।':'Account changed elsewhere. Refresh the page and try again.'):(LANG==='bn'?'সেভ হয়নি। ইন্টারনেট সংযোগ দেখে আবার চেষ্টা করুন।':'Not saved. Check your connection and try again.'),conflict?null:()=>runConfirmedChange(command,descriptor));return false;
    }
    if(CUR_USER?.id!==user)return false;
    failedCommand=null;localStorage.setItem(key,prepared.profile);applySnapshot(sync.current);
    restoreFields(prepared.after);restoreUI(prepared.uiAfter);pinMode=prepared.pin.pinMode;pinBuf=prepared.pin.pinBuf;pinTmp=prepared.pin.pinTmp;PENDING_ALL_CLEAR=prepared.pin.pending;
    for(const effect of prepared.effects)effect();return true;
  }catch(error){failedCommand=prepared;saveNotice(target,LANG==='bn'?'সেভ হয়নি। আবার চেষ্টা করুন।':'Not saved. Please try again.',()=>runConfirmedChange(command,descriptor));return false;}
  finally{savingChange=false;for(const c of controls)c.el.disabled=c.disabled;if(button)button.innerHTML=label;document.body.removeAttribute('aria-busy');}
}

{const original=addEntry;addEntry=function(...args){return runConfirmedChange(()=>original(...args),{name:'addEntry',args});}}

{const original=confirmAddMore;confirmAddMore=function(...args){return runConfirmedChange(()=>original(...args),{name:'confirmAddMore',args});}}

{const original=confirmPay;confirmPay=function(...args){return runConfirmedChange(()=>original(...args),{name:'confirmPay',args});}}

{const original=confirmAllClearExecution;confirmAllClearExecution=function(...args){return runConfirmedChange(()=>original(...args),{name:'confirmAllClearExecution',args});}}

{const original=confirmEdit;confirmEdit=function(...args){return runConfirmedChange(()=>original(...args),{name:'confirmEdit',args});}}

{const original=submitCash;submitCash=function(...args){return runConfirmedChange(()=>original(...args),{name:'submitCash',args});}}

{const original=submitQuickAdd;submitQuickAdd=function(...args){if(savingChange)return;return runConfirmedChange(()=>original(...args),{name:'submitQuickAdd',args:[...args,QA_MODE,SELECTED_QA_WALLET,SELECTED_QA_CAT]});}}

{const original=confirmTransfer;confirmTransfer=function(...args){return runConfirmedChange(()=>original(...args),{name:'confirmTransfer',args});}}

{const original=confirmCashEdit;confirmCashEdit=function(...args){return runConfirmedChange(()=>original(...args),{name:'confirmCashEdit',args});}}

{const original=deleteCashEntry;deleteCashEntry=function(...args){return runConfirmedChange(()=>original(...args),{name:'deleteCashEntry',args});}}

{const original=confirmClearCashExecution;confirmClearCashExecution=function(...args){return runConfirmedChange(()=>original(...args),{name:'confirmClearCashExecution',args});}}

{const original=deleteEntry;deleteEntry=function(...args){return runConfirmedChange(()=>original(...args),{name:'deleteEntry',args});}}

{const original=saveProfileSubmit;saveProfileSubmit=function(...args){return runConfirmedChange(()=>original(...args),{name:'saveProfileSubmit',args});}}

{const original=confirmDeleteProfile;confirmDeleteProfile=function(...args){return runConfirmedChange(()=>original(...args),{name:'confirmDeleteProfile',args});}}

{const original=confirmBudget;confirmBudget=function(...args){return runConfirmedChange(()=>original(...args),{name:'confirmBudget',args});}}

{const original=removeBudget;removeBudget=function(...args){return runConfirmedChange(()=>original(...args),{name:'removeBudget',args});}}

{const original=updateCat;updateCat=function(...args){return runConfirmedChange(()=>original(...args),{name:'updateCat',args});}}

{const original=addCat;addCat=function(...args){return runConfirmedChange(()=>original(...args),{name:'addCat',args});}}

{const original=deleteCat;deleteCat=function(...args){return runConfirmedChange(()=>original(...args),{name:'deleteCat',args});}}

{const original=handlePin;handlePin=function(){if(pinMode==='set-new2'&&pinBuf===pinTmp)return runConfirmedChange(()=>original(),{name:'handlePin',args:[]});return original();};}



// Quick hisab selection is stored in form controls so retry signatures include the chosen account.
function resetQuickPerson(){
  document.getElementById('qa-person-new').value='0';
  document.getElementById('qa-person-id').value='';
  document.getElementById('qa-name').value='';
}
function quickPersonDue(person,kind){
  const loan=kind==='receive'?getLoanBreakdown(person):null;
  return money(loan?loan.remainingDue:person.remaining);
}
function chooseQuickPerson(id){
  document.getElementById('qa-person-new').value='0';
  const kind=document.getElementById('qa-hisab-kind').value;
  const p=DB[kind]?.find(p=>p.id===id);if(!p)return;
  document.getElementById('qa-person-id').value=String(p.id);
  document.getElementById('qa-name').value=p.name;
  updateQuickHisab();updateQuickTask();document.getElementById('qa-amt').focus();
}
function updateQuickHisab(){
  const kindOptions=document.getElementById('qa-hisab-kind').options;
  kindOptions[0].textContent=LANG==='bn'?'পাবো':'Receivable';
  kindOptions[1].textContent=LANG==='bn'?'দেবো':'Payable';
  const actionOptions=document.getElementById('qa-hisab-action').options;
  actionOptions[0].textContent=LANG==='bn'?'টাকা যোগ':'Add amount';
  actionOptions[1].textContent=LANG==='bn'?'পরিশোধ':'Payment';
  const kind=document.getElementById('qa-hisab-kind').value;
  const paying=document.getElementById('qa-hisab-action').value==='pay';
  const selected=document.getElementById('qa-person-id').value;
  const query=document.getElementById('qa-name').value.trim();
  const people=DB[kind]||[];
  const person=people.find(p=>String(p.id)===selected);
  const matches=people.filter(p=>(!query||searchText(p.name).includes(searchText(query)))&&(!paying||quickPersonDue(p,kind)>0));
  const results=document.getElementById('qa-person-results');
  results.innerHTML=person?'':matches.slice(0,12).map(p=>`<button type="button" onclick="chooseQuickPerson(${p.id})"><span>${escapeHTML(p.name)}</span><small>${LANG==='bn'?'বাকি':'Due'} ৳${fmt(quickPersonDue(p,kind))} · ${fmtD(firstTs(p))}</small></button>`).join('');
  const info=document.getElementById('qa-person-summary');
  info.textContent=person
    ?(LANG==='bn'?`${person.name} — বাকি ৳${fmt(quickPersonDue(person,kind))}। ${paying?'নিচে ওয়ালেট বেছে পরিশোধ সেভ করুন।':'এই হিসাবেই টাকা যোগ হবে।'}`:`${person.name} — Due ৳${fmt(quickPersonDue(person,kind))}. ${paying?'Choose a wallet below and save the payment.':'Amount will be added to this account.'}`)
    :paying?(LANG==='bn'?'পরিশোধ করতে তালিকা থেকে আগের ব্যক্তিকে বাছুন।':'Select an existing person to record payment.')
    :query&&matches.length===0?(LANG==='bn'?'এই নামে নতুন হিসাব তৈরি হবে।':'A new account will be created for this name.')
    :matches.length>12?(LANG==='bn'?'আরও মিল আছে। পুরো নাম লিখে খুঁজুন।':'More matches available. Type more of the name.')
    :(LANG==='bn'?'আগের হিসাবে যোগ করতে তালিকা থেকে বাছুন।':'Select a result to add to an existing account.');
  if(QA_MODE==='hisab'){
    const btn=document.getElementById('qa-submit-btn');
    btn.className='sbtn '+(kind==='receive'?'sbtn-g':'sbtn-r');
    btn.textContent=paying?(LANG==='bn'?'পরিশোধের পরের ধাপ →':'Review payment →'):(LANG==='bn'?(kind==='receive'?'পাওনা যোগ করুন ✓':'দেনা যোগ করুন ✓'):(kind==='receive'?'Add receivable ✓':'Add payable ✓'));
  }
}

function backQuickTask(){
  if(savingChange)return;
  document.getElementById('qa-editor').hidden=true;document.getElementById('qa-chooser').hidden=false;
  document.querySelector('#qa-chooser button').focus();
}
function chooseQuickTask(task){
  if(savingChange)return;
  document.getElementById('qa-hisab-action').value=task==='pay'?'pay':'add';
  setQuickAddType(task==='pay'?'hisab':task);
  document.getElementById('qa-chooser').hidden=true;document.getElementById('qa-editor').hidden=false;
  updateQuickTask();document.getElementById(QA_MODE==='hisab'?'qa-name':'qa-amt').focus();
}
function quickNewPerson(){
  const creating=document.getElementById('qa-person-new').value!=='1';
  resetQuickPerson();document.getElementById('qa-person-new').value=creating?'1':'0';
  updateQuickHisab();updateQuickTask();document.getElementById('qa-name').focus();
}
function fillQuickPayment(){
  const kind=document.getElementById('qa-hisab-kind').value;
  const p=DB[kind]?.find(p=>String(p.id)===document.getElementById('qa-person-id').value);
  if(p)document.getElementById('qa-amt').value=quickPersonDue(p,kind);
  updateQuickTask();
}
function updateQuickTask(){
  const hisab=QA_MODE==='hisab',paying=hisab&&document.getElementById('qa-hisab-action').value==='pay';
  const kind=document.getElementById('qa-hisab-kind').value;
  const person=hisab?DB[kind]?.find(p=>String(p.id)===document.getElementById('qa-person-id').value):null;
  const creating=document.getElementById('qa-person-new').value==='1'&&!paying;
  const amount=money(Number(document.getElementById('qa-amt').value)||0);
  const label=LANG==='bn'?(paying?(kind==='receive'?'টাকা পেয়েছি':'টাকা দিয়েছি'):hisab?(kind==='receive'?'পাওনা যোগ':'দেনা যোগ'):QA_MODE==='add'?'আয় সেভ':'খরচ সেভ'):(paying?(kind==='receive'?'Record received':'Record paid'):hisab?(kind==='receive'?'Add receivable':'Add payable'):QA_MODE==='add'?'Save income':'Save expense');
  document.getElementById('qa-task-title').textContent=label;
  document.getElementById('qa-wallet-sec').style.display=!hisab||paying?'block':'none';
  document.getElementById('qa-new-person').hidden=paying;
  document.getElementById('qa-new-person').textContent=LANG==='bn'?(creating?'← আগের ব্যক্তি বাছুন':'+ নতুন ব্যক্তি'):(creating?'← Select existing person':'+ New person');
  document.getElementById('qa-full-payment').hidden=!paying||!person;
  if(creating){document.getElementById('qa-person-results').innerHTML='';document.getElementById('qa-person-summary').textContent=LANG==='bn'?'নতুন ব্যক্তির নাম লিখুন।':'Enter the new person’s name.';}
  const hint=document.getElementById('qa-payment-preview');
  const w=WALLET_META[SELECTED_QA_WALLET||'cash'];
  hint.textContent=paying&&person?(LANG==='bn'?`বাকি ৳${fmt(quickPersonDue(person,kind))} · পরিশোধের পর ৳${fmt(Math.max(0,quickPersonDue(person,kind)-amount))}। ${w?.name||''} ওয়ালেটে টাকা ${kind==='receive'?'জমা হবে':'কাটা হবে'}।`:`Due ৳${fmt(quickPersonDue(person,kind))} · After payment ৳${fmt(Math.max(0,quickPersonDue(person,kind)-amount))}. ${w?.en||''} wallet will be ${kind==='receive'?'credited':'debited'}.`):'';
  document.getElementById('qa-submit-btn').textContent=(validAmount(amount)?'৳'+fmt(amount)+' · ':'')+label+' ✓';
}
// Keep preview and amount-specific action labels aligned with selector changes.
{const original=updateQuickHisab;updateQuickHisab=function(){original();updateQuickTask();};}
{const original=selectQAWallet;selectQAWallet=function(...args){original(...args);updateQuickTask();};}

function toggleAccountCard(header){
  const body=header.nextElementSibling;
  if(!body?.classList.contains('pbody'))return;
  body.classList.toggle('on');
  header.setAttribute('aria-expanded',String(body.classList.contains('on')));
}

function openTopPerson(type,id){
  if(!['receive','give'].includes(type)||!DB[type].some(p=>p.id===id))return;
  const tab=type==='receive'?'r':'g';
  SA[tab]=true;
  setAppTab('hisab');sliderSwitch(tab);render();
  const card=document.querySelector('#sec-'+tab+' #card-'+id);
  if(!card)return;
  card.querySelector('.pbody')?.classList.add('on');
  const header=card.querySelector('.pt');
  if(header){header.setAttribute('aria-expanded','true');header.focus({preventScroll:true});}
  card.scrollIntoView({behavior:matchMedia('(prefers-reduced-motion: reduce)').matches?'instant':'smooth',block:'start'});
}

function openAppInfo(kind){
  if(!['privacy','about'].includes(kind))return;
  closeDrawer();const modal=document.getElementById('m-app-'+kind);modal.classList.add('on');modal.querySelector('button')?.focus();
}

// Wallet visibility belongs to the active book. Balances and historical references remain intact.
function enabledWalletKeys(){
  const known=['cash','bkash','nagad','bank',...Object.keys(CASH_DB.customWallets||{})];
  const saved=Array.isArray(CASH_DB.enabledWallets)?CASH_DB.enabledWallets:null;
  // Preserve funded legacy wallets; empty/new books start with Cash only.
  return known.filter(k=>k==='cash'||(saved?saved.includes(k):false)||Math.abs(Number(CASH_DB.wallets?.[k])||0)>0);
}
function walletEnabled(key){return enabledWalletKeys().includes(key);}
function syncEnabledWalletUI(){
  const enabled=enabledWalletKeys();
  if(WALLET_FILTER!=='all'&&!enabled.includes(WALLET_FILTER))WALLET_FILTER='all';
  if(!enabled.includes(SELECTED_FORM_WALLET))SELECTED_FORM_WALLET='cash';
  if(!enabled.includes(SELECTED_QA_WALLET))SELECTED_QA_WALLET='cash';
  if(!enabled.includes(SELECTED_PAY_WALLET))SELECTED_PAY_WALLET='cash';
  if(!enabled.includes(SELECTED_AC_WALLET))SELECTED_AC_WALLET='cash';
  if(!enabled.includes(TF_FROM_WALLET))TF_FROM_WALLET=enabled[0];
  if(!enabled.includes(TF_TO_WALLET))TF_TO_WALLET=enabled.find(k=>k!==TF_FROM_WALLET)||'cash';
  const groups={'form-wallet-row':SELECTED_FORM_WALLET,'qa-wallet-row':SELECTED_QA_WALLET,'pay-ws-wallets':SELECTED_PAY_WALLET,'ac-ws-wallets':SELECTED_AC_WALLET,'tf-from-row':TF_FROM_WALLET,'tf-to-row':TF_TO_WALLET};
  const handlers={'form-wallet-row':"selectFormWallet",'qa-wallet-row':"selectQAWallet",'pay-ws-wallets':"selectPayWallet",'ac-ws-wallets':"selectAcWallet"};
  for(const [id,selected]of Object.entries(groups)){
    const row=document.getElementById(id);if(!row)continue;
    // Preserve controls during a save; otherwise rebuild when profile, locale or settings change.
    const signature=JSON.stringify([enabled,LANG,enabled.map(k=>[WALLET_META[k]?.name,WALLET_META[k]?.iconKind])]);
    if(row.dataset.walletSignature!==signature&&(!savingChange||!accountSync?.busy)){
      row.innerHTML=enabled.map(key=>{
        const handler=id==='tf-from-row'?`selectTransferWallet('from','${key}',this)`:id==='tf-to-row'?`selectTransferWallet('to','${key}',this)`:`${handlers[id]}('${key}',this)`;
        const meta=WALLET_META[key];
        return `<button type="button" class="${id.includes('ws-wallets')?'pws-btn':'wsel-btn'}" data-w="${key}" onclick="${handler}">${walletChoiceIcon(key)}<span title="${escapeHTML(LANG==='bn'?meta.name:meta.en)}">${escapeHTML(LANG==='bn'?meta.name:meta.en)}</span></button>`;
      }).join('');row.dataset.walletSignature=signature;
    }
    row.querySelectorAll('[data-w]').forEach(button=>{button.hidden=!enabled.includes(button.dataset.w);button.classList.toggle('on',button.dataset.w===selected);button.setAttribute('aria-pressed',String(button.dataset.w===selected));});
  }
  for(const el of document.querySelectorAll('#wallets-grid,#hmw-grid,#form-wallet-row,#qa-wallet-row,#pay-ws-wallets,#ac-ws-wallets,#tf-from-row,#tf-to-row')){
    el.style.setProperty('--enabled-wallet-columns',String(enabled.length));
    el.style.setProperty('--wallet-mobile-columns',String(Math.min(2,enabled.length)));
  }
}
function openWalletManager(){
  if(savingChange)return;
  closeDrawer();renderWalletManager();document.getElementById('m-wallet-manager').classList.add('on');
}
function renderWalletManager(){
  const enabled=enabledWalletKeys();
  document.getElementById('wallet-manager-book').textContent=ROOT_DB?.profiles?.find(p=>p.id===ROOT_DB.activeProfileId)?.name||'';
  document.getElementById('wallet-manager-count').textContent=enabled.length+' / 5';
  document.getElementById('wallet-manager-list').innerHTML=['cash','bkash','nagad','bank',...Object.keys(CASH_DB.customWallets||{})].map(key=>{
    const meta=WALLET_META[key],on=enabled.includes(key),balance=money(CASH_DB.wallets?.[key]||0);
    const icon=walletChoiceIcon(key);
    return `<div class="wallet-manager-row" data-w="${key}">${icon}<div class="wallet-manager-copy"><b>${escapeHTML(LANG==='bn'?meta.name:meta.en)}</b><small>${key==='cash'?(LANG==='bn'?'ডিফল্ট · সবসময় চালু':'Default · always enabled'):(LANG==='bn'?'ব্যালেন্স':'Balance')+' ৳'+fmt(balance)}</small></div><button type="button" ${key==='cash'||(!on&&enabled.length>=5)?'disabled':''} class="wallet-manager-action ${on?'enabled':''}" onclick="setManagedWallet('${key}',${!on})">${LANG==='bn'?(key==='cash'?'ডিফল্ট':on?'সরান':'+ যোগ করুন'):(key==='cash'?'Default':on?'Remove':'+ Add')}</button></div>`;
  }).join('');
}
function setManagedWallet(key,enable){
  return runConfirmedChange(()=>{
    if(key==='cash'||!WALLET_META[key]||typeof enable!=='boolean')return;
    ensureWallets();const keys=enabledWalletKeys();
    if(!enable&&money(CASH_DB.wallets[key]||0)!==0){
      confirmedEffects.toast(LANG==='bn'?'ওয়ালেটে টাকা আছে। আগে ব্যালেন্স ট্রান্সফার বা সমন্বয় করে শূন্য করুন।':'This wallet has a balance. Transfer or reconcile it to zero before removing.');return;
    }
    if(keys.includes(key)===enable)return;
    if(enable&&keys.length>=5){confirmedEffects.toast(LANG==='bn'?'Cash-সহ সর্বোচ্চ ৫টি ওয়ালেট রাখা যাবে।':'You can have up to 5 wallets, including Cash.');return;}
    CASH_DB.enabledWallets=enable?[...keys,key]:keys.filter(k=>k!==key);
    confirmedEffects.saveCashData();confirmedEffects.render();confirmedEffects.renderCash();
    activeDraft.effects.push(()=>{syncEnabledWalletUI();renderWalletManager();});
    confirmedEffects.toast(LANG==='bn'?(enable?'ওয়ালেট যোগ হয়েছে।':'ওয়ালেট সরানো হয়েছে। ইতিহাস রাখা আছে.'):(enable?'Wallet added.':'Wallet removed. History retained.'));
  },{name:'manageWallet',args:[key,enable]});
}
// Refresh selector availability before rendering or opening any wallet-related form.
for(const name of ['renderCash','renderHisabMiniWallets','openCashForm','openQuickAddSheet','openPay','oneClickAllClear','openTransferModal']){
  const original=globalThis[name];globalThis[name]=function(...args){syncEnabledWalletUI();const result=original.apply(this,args);syncEnabledWalletUI();return result;};
}

function walletChoiceIcon(key){
  const path=key.startsWith('wallet_')?customWalletIconPath(WALLET_META[key]?.iconKind):key==='cash'?'<rect x="3" y="5" width="18" height="14" rx="2"/><circle cx="12" cy="12" r="3"/>':key==='bkash'||key==='nagad'?'<rect x="6" y="2" width="12" height="20" rx="3"/><path d="M10 5h4m-3 14h2"/>':key==='bank'?'<path d="m3 9 9-6 9 6H3Zm2 3v6m5-6v6m4-6v6m5-6v6M3 21h18"/>':'<path d="M20 8V5H6a3 3 0 0 0 0 6h15v10H6a3 3 0 0 1-3-3V8"/><path d="M21 14h-5v3h5"/>';
  return `<span class="wallet-choice-icon" aria-hidden="true"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round">${path}</svg></span>`;
}
function createManagedWallet(){
  return runConfirmedChange(()=>{
    const name=document.getElementById('new-wallet-name').value.trim().replace(/\s+/g,' ');
    const keys=enabledWalletKeys();
    if(!WALLET_ICON_KINDS.includes(document.getElementById('new-wallet-icon').value))return;
    if(!name||name.length>40){confirmedEffects.toast(LANG==='bn'?'১–৪০ অক্ষরের একটি নাম দিন।':'Enter a name of 1–40 characters.');return;}
    if(keys.length>=5){confirmedEffects.toast(LANG==='bn'?'Cash-সহ সর্বোচ্চ ৫টি ওয়ালেট রাখা যাবে।':'Maximum 5 wallets, including Cash.');return;}
    const known=['cash','bkash','nagad','bank',...Object.keys(CASH_DB.customWallets||{})];
    const same=known.find(k=>[WALLET_META[k].name,WALLET_META[k].en].some(n=>n.normalize('NFKC').toLowerCase()===name.normalize('NFKC').toLowerCase()));
    if(same&&keys.includes(same)){confirmedEffects.toast(LANG==='bn'?'এই নামে ওয়ালেট চালু আছে।':'A wallet with this name is already enabled.');return;}
    if(!same&&Object.keys(CASH_DB.customWallets||{}).length>=1000){confirmedEffects.toast(LANG==='bn'?'পুরোনো তালিকা থেকে একটি ওয়ালেট যোগ করুন।':'Add a wallet from the existing list.');return;}
    ensureWallets();const key=same||'wallet_'+nextId();
    if(!same){if(!CASH_DB.customWallets)CASH_DB.customWallets={};CASH_DB.customWallets[key]={name,iconKind:document.getElementById('new-wallet-icon').value};CASH_DB.wallets[key]=0;}
    CASH_DB.enabledWallets=[...keys,key];
    confirmedEffects.saveCashData();confirmedEffects.render();confirmedEffects.renderCash();
    document.getElementById('new-wallet-name').value='';
    activeDraft.effects.push(()=>{syncEnabledWalletUI();renderWalletManager();});
    confirmedEffects.toast(LANG==='bn'?'ওয়ালেট তৈরি ও যোগ হয়েছে।':'Wallet created and added.');
  },{name:'createWallet',args:[]});
}

function beginFirstPin(){
  localStorage.removeItem(tk());
  pinMode='set-new1';pinBuf='';pinTmp='';updDots('');
  document.getElementById('auth-screen').style.display='none';
  document.getElementById('app').style.display='none';
  document.getElementById('pin-screen').style.display='flex';
  document.getElementById('pin-err').textContent='';
  document.getElementById('pin-title').textContent=LANG==='bn'?'নিজের PIN তৈরি করুন':'Create your PIN';
  document.getElementById('pin-sub').textContent=LANG==='bn'?'হিসাব খুলতে প্রথমে নিজের ৪ সংখ্যার PIN দিন।':'Choose your own 4-digit PIN to start using your account.';
}

const WALLET_ICON_KINDS=['wallet','mobile','bank','card','business','savings'];
function customWalletIconPath(kind){
  const icons={
    wallet:'<path d="M20 8V5H6a3 3 0 0 0 0 6h15v10H6a3 3 0 0 1-3-3V8"/><path d="M21 14h-5v3h5"/>',
    mobile:'<rect x="6" y="2" width="12" height="20" rx="3"/><path d="M10 5h4m-3 14h2"/>',
    bank:'<path d="m3 9 9-6 9 6H3Zm2 3v6m5-6v6m4-6v6m5-6v6M3 21h18"/>',
    card:'<rect x="3" y="5" width="18" height="14" rx="3"/><path d="M3 10h18M7 15h4"/>',
    business:'<rect x="3" y="7" width="18" height="14" rx="2"/><path d="M8 7V3h8v4M3 12c5 4 13 4 18 0m-9 0v4"/>',
    savings:'<path d="M4 11c0-4 3-6 7-6h3l3-2v4l3 3h2v5h-3l-2 5h-3v-3H9v3H6l-2-6H2v-3h2Zm6-3h4m2 3h.01"/>'
  };return icons[kind]||icons.wallet;
}
function chooseNewWalletIcon(kind){
  if(!WALLET_ICON_KINDS.includes(kind)||savingChange)return;
  document.getElementById('new-wallet-icon').value=kind;
  document.querySelectorAll('#new-wallet-icons button').forEach(button=>{const on=button.dataset.icon===kind;button.classList.toggle('selected',on);button.setAttribute('aria-pressed',String(on));});
}
function renderNewWalletIcons(){
  const names=LANG==='bn'?['ওয়ালেট','মোবাইল','ব্যাংক','কার্ড','ব্যবসা','সঞ্চয়']:['Wallet','Mobile','Bank','Card','Business','Savings'];
  const selected=document.getElementById('new-wallet-icon').value;
  document.getElementById('new-wallet-icons').innerHTML=WALLET_ICON_KINDS.map((kind,i)=>`<button type="button" data-icon="${kind}" class="${kind===selected?'selected':''}" aria-pressed="${kind===selected}" onclick="chooseNewWalletIcon('${kind}')"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round">${customWalletIconPath(kind)}</svg><span>${names[i]}</span></button>`).join('');
}
{const original=renderWalletManager;renderWalletManager=function(){original();renderNewWalletIcons();};}

function expenseTransactionIcon(category,type){
 const paths={food:'<path d="M5 3v7a3 3 0 0 0 6 0V3M8 3v18M19 3c-4 2-4 8 0 9v9M19 3v9"/>',transport:'<rect x="4" y="3" width="16" height="16" rx="3"/><path d="M4 11h16M8 3v8M8 15h.01M16 15h.01M6 19v2m12-2v2"/>',rent:'<path d="m3 10 9-7 9 7M5 9v12h14V9M9 21v-8h6v8"/>',bills:'<path d="m13 2-8 12h6l-1 8 9-12h-6l1-8Z"/>',shopping:'<path d="M5 7h14l2 14H3L5 7Zm3 0V5a4 4 0 0 1 8 0v2"/>',health:'<path d="m8 16 8-8M5 19a5 5 0 0 1 0-7l7-7a5 5 0 0 1 7 7l-7 7a5 5 0 0 1-7 0Z"/>',education:'<path d="m2 8 10-5 10 5-10 5L2 8Zm4 3v7c4 3 8 3 12 0v-7M22 8v8"/>',family:'<circle cx="9" cy="7" r="4"/><path d="M2 21v-3a7 7 0 0 1 14 0v3M17 3a4 4 0 0 1 0 8m5 10v-3a6 6 0 0 0-3-5"/>',debt_in:'<path d="M12 3v12m-5-5 5 5 5-5M4 15v6h16v-6"/>',debt_out:'<path d="M12 16V4m-5 5 5-5 5 5M4 15v6h16v-6"/>',salary:'<rect x="3" y="7" width="18" height="14" rx="2"/><path d="M8 7V3h8v4M3 12c5 4 13 4 18 0"/>'};
 const fallback=type==='transfer'?'<path d="M4 8h16m-4-4 4 4-4 4M20 16H4m4-4-4 4 4 4"/>':type==='add'?paths.debt_in:'<path d="M12 4v16m-6-6 6 6 6-6"/>';
 return '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round">'+(paths[category]||fallback)+'</svg>';
}
