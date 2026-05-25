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

(async()=>{try{await sb.from('visits').insert({user_agent:navigator.userAgent,logged_in:false});}catch(e){}})();

let DB={receive:[],give:[],activityLog:[]};
let CASH_DB={balance:0,history:[]};
let LANG=localStorage.getItem('ht_lang')||'bn';
let THEME=localStorage.getItem('ht_theme')||'dark';
let TAB='r',CTX={},SA={r:false,g:false},CUR_USER=null;
let CASH_FILTER='all';
let cashFormMode='add';
let pTr=0,pTg=0,pNet=0,pinBuf='',pinMode='unlock',pinTmp='';
let syncTimer=null;
let APP_MODE=localStorage.getItem('ht_mode')||'hisab';

function sliderSwitch(type){
  TAB=type;
  const track=document.getElementById('slider-track');
  const btnR=document.getElementById('slider-r');
  const btnG=document.getElementById('slider-g');
  const btnA=document.getElementById('slider-a');
  track.className='type-slider-track'+(type==='g'?' mid':type==='a'?' right':'');
  btnR.className='type-slider-opt '+(type==='r'?'active-r':'inactive');
  btnG.className='type-slider-opt '+(type==='g'?'active-g':'inactive');
  btnA.className='type-slider-opt '+(type==='a'?'active-a':'inactive');
  document.getElementById('sec-r').style.display=type==='r'?'block':'none';
  document.getElementById('sec-g').style.display=type==='g'?'block':'none';
  document.getElementById('sec-a').style.display=type==='a'?'block':'none';
  if(type==='a')renderAll();
}

function renderAll(){
  const q=document.getElementById('srch').value.toLowerCase().trim();
  const fl=list=>q?list.filter(p=>p.name.toLowerCase().includes(q)):list;
  const all=fl([...DB.receive.map(p=>({...p,_type:'receive'})),...DB.give.map(p=>({...p,_type:'give'}))]).sort((a,b)=>b.id-a.id);
  document.getElementById('lst-a').innerHTML=all.length
    ?all.map(p=>renderCard(p,p._type)).filter(Boolean).join('')
    :emptyS('কোনো রেকর্ড নেই','No records','📂');
  all.filter(p=>p.remaining>0).forEach(p=>{const el=document.getElementById('card-'+p.id);if(el)initSwipe(el,p._type,p.id);});
}

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
      inner.style.transition='transform .3s cubic-bezier(.34,1.56,.64,1)';
      inner.style.transform='';
      setHint(0);
      setTimeout(()=>{inner.style.transition='';},350);
    }
  });
}

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

function filterCash(type,el){
  CASH_FILTER=type;
  document.querySelectorAll('.cat-pill').forEach(p=>p.classList.remove('on'));
  el.classList.add('on');
  renderCash();
}

document.documentElement.setAttribute('data-lang',LANG);
applyThemeSilent(THEME);

if('serviceWorker' in navigator) navigator.serviceWorker.register('sw.js').catch(()=>{});

function toggleEye(inputId,btn){
  const inp=document.getElementById(inputId);
  const show=inp.type==='password';
  inp.type=show?'text':'password';
  btn.textContent=show?'🙈':'👁️';
}

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
    switchIcon.textContent='💵';
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

function setSyncState(state,txt){
  const p=document.getElementById('sync-pill');
  const t=document.getElementById('sync-txt');
  if(!p)return;
  p.className='sync-pill show '+(state||'');
  t.textContent=txt;
  clearTimeout(syncTimer);
  if(state==='saved'||state==='fail'){
    syncTimer=setTimeout(()=>{p.classList.remove('show');},2500);
  }
}

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
    :'<div class="empty"><div class="empty-i">📭</div><div class="empty-t">কোনো log নেই</div></div>';
  document.getElementById('m-log').classList.add('on');
}

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
  
  if(!email||!pass){
    setAuthMsg(LANG==='bn'?'Email ও Password দিন!':'Enter email and password!','err');
    return;
  }
  
  if(email==='demo@test.com'&&pass==='demo1234'){
    CUR_USER={id:'demo-user-'+Date.now(),email:email,user_metadata:{}};
    document.getElementById('auth-screen').style.display='none';
    document.getElementById('app').style.display='block';
    document.getElementById('drw-av').textContent='D';
    document.getElementById('drw-name').textContent='Demo User';
    document.getElementById('drw-email').textContent=email;
    showApp();
    return;
  }
  
  setAuthMsg('❌ Use demo@test.com / demo1234','err');
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
  if(CUR_USER)localStorage.removeItem('ht_data_'+CUR_USER.id);
  CUR_USER=null; DB={receive:[],give:[],activityLog:[]};
  closeDrawer();
  document.getElementById('app').style.display='none';
  document.getElementById('pin-screen').style.display='none';
  document.getElementById('auth-screen').style.display='flex';
  document.body.style.overflow='';
  setAuthMsg('','');
}

/*
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
    document.getElementById('drw-name').textContent='DEV: profess0r.null';
    document.getElementById('drw-email').textContent=email;
    await checkPin();
  }
});
*/

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

function ph(p){let h=5381;for(let i=0;i<p.length;i++)h=(h*33)^p.charCodeAt(i);return(h>>>0).toString(36);}
function pk(){return'ht_pin_'+CUR_USER.id;}
function tk(){return'ht_tr_'+CUR_USER.id;}
function getPin(){return DB.pinHash||ph('1234');}
function isTrusted(){return localStorage.getItem(tk())==='1';}
function setTrusted(){localStorage.setItem(tk(),'1');}

async function checkPin(){
  if(isTrusted()){showApp();return;}
  showApp();
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
  document.getElementById('app').style.display='none';
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

async function showApp(){
  document.getElementById('app').style.display='block';
  setSyncState('saving','Loading...');
  
  loadCashData();
  logActivity('Login সফল',CUR_USER.email);
  applyMode();
  render();
  
  setSyncState('saved','Loaded ✓');
}
async function loadData(){
  const key='ht_data_'+CUR_USER.id;
  const raw=localStorage.getItem(key);
  if(raw)try{DB=JSON.parse(raw);}catch(e){}
  if(!DB.receive)DB.receive=[];
  if(!DB.give)DB.give=[];
  if(!DB.activityLog)DB.activityLog=[];
}
async function saveData(){
  setSyncState('saving','Saving...');
  const key='ht_data_'+CUR_USER.id;
  localStorage.setItem(key,JSON.stringify(DB));
  setSyncState('saved','Saved ✓');
}

function cashKey(){return'ht_cash_'+(CUR_USER?CUR_USER.id:'guest');}
function loadCashData(){
  const raw=localStorage.getItem(cashKey());
  if(raw)try{CASH_DB=JSON.parse(raw);}catch(e){CASH_DB={balance:0,history:[]};}
  if(!CASH_DB.history)CASH_DB.history=[];
}
async function loadCashDataCloud(){
  const raw=localStorage.getItem(cashKey());
  if(raw)try{CASH_DB=JSON.parse(raw);}catch(e){}
  if(!CASH_DB.history)CASH_DB.history=[];
}
function saveCashData(){
  localStorage.setItem(cashKey(),JSON.stringify(CASH_DB));
}

function openCashForm(mode){
  cashFormMode=mode;
  const form=document.getElementById('cash-form');
  const icon=document.getElementById('cash-form-icon');
  const submitBtn=document.getElementById('cash-submit-btn');
  const qtags=document.getElementById('cash-qtags');
  if(mode==='add'){
    icon.textContent='➕';
    submitBtn.className='sbtn sbtn-g';
    submitBtn.innerHTML='<span class="bn">যোগ করুন ✓</span><span class="en">Add ✓</span>';
    document.documentElement.setAttribute('data-lang',LANG);
    qtags.innerHTML=`
      <span class="qtag" onclick="setQ('বেতন / Salary','cash-note')">💰 <span class="bn">বেতন</span><span class="en">Salary</span></span>
      <span class="qtag" onclick="setQ('Family','cash-note')">👨‍👩‍👧 Family</span>
      <span class="qtag" onclick="setQ('বিক্রয় / Sale','cash-note')">🛍️ <span class="bn">বিক্রয়</span><span class="en">Sale</span></span>
      <span class="qtag" onclick="setQ('পাওনা উসুল / Received','cash-note')">✅ <span class="bn">পাওনা</span><span class="en">Received</span></span>
    `;
  } else {
    icon.textContent='➖';
    submitBtn.className='sbtn sbtn-r';
    submitBtn.innerHTML='<span class="bn">বিয়োগ করুন ✓</span><span class="en">Deduct ✓</span>';
    qtags.innerHTML=`
      <span class="qtag" onclick="setQ('খাওয়া / Food','cash-note')">🍔 <span class="bn">খাওয়া</span><span class="en">Food</span></span>
      <span class="qtag" onclick="setQ('যাতায়াত / Transport','cash-note')">🚌 <span class="bn">যাতায়াত</span><span class="en">Transport</span></span>
      <span class="qtag" onclick="setQ('কেনাকাটা / Shopping','cash-note')">🛒 <span class="bn">কেনাকাটা</span><span class="en">Shopping</span></span>
      <span class="qtag" onclick="setQ('বিল / Bill','cash-note')">💡 <span class="bn">বিল</span><span class="en">Bill</span></span>
      <span class="qtag" onclick="setQ('Recharge','cash-note')">📱 Recharge</span>
    `;
  }
  document.getElementById('cash-amt').value='';
  document.getElementById('cash-note').value='';
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
  if(cashFormMode==='add'){
    CASH_DB.balance+=amt;
    CASH_DB.history.unshift({id:ts,type:'add',amt,note,date:ts});
    toast('✅ ৳'+fmt(amt)+' যোগ হয়েছে!');
  } else {
    if(amt>CASH_DB.balance){toast('❌ পর্যাপ্ত ব্যালেন্স নেই!');return;}
    CASH_DB.balance-=amt;
    CASH_DB.history.unshift({id:ts,type:'sub',amt,note,date:ts});
    toast('💸 ৳'+fmt(amt)+' খরচ হয়েছে!');
  }
  saveCashData();
  closeCashForm();
  renderCash();
}
function deleteCashEntry(id){
  const entry=CASH_DB.history.find(h=>h.id===id);
  if(!entry)return;
  if(!confirm('এই লেনদেন মুছবেন?'))return;
  if(entry.type==='add') CASH_DB.balance-=entry.amt;
  else CASH_DB.balance+=entry.amt;
  CASH_DB.balance=Math.max(0,CASH_DB.balance);
  CASH_DB.history=CASH_DB.history.filter(h=>h.id!==id);
  saveCashData();
  renderCash();
  toast('🗑️ মুছে গেছে');
}
function clearCashHistory(){
  if(!confirm('সব ইতিহাস মুছবেন? ব্যালেন্স ০ হয়ে যাবে।'))return;
  CASH_DB={balance:0,history:[]};
  saveCashData();
  renderCash();
  toast('🗑️ সব মুছে গেছে');
}
function renderCash(){
  const bal=CASH_DB.balance||0;
  const hist=CASH_DB.history||[];
  document.getElementById('cash-balance').textContent='৳'+fmt(bal);
  const totalIn=hist.filter(h=>h.type==='add').reduce((s,h)=>s+h.amt,0);
  const totalOut=hist.filter(h=>h.type==='sub').reduce((s,h)=>s+h.amt,0);
  document.getElementById('cash-total-in').textContent='৳'+fmt(totalIn);
  document.getElementById('cash-total-out').textContent='৳'+fmt(totalOut);
  document.getElementById('cash-txn-count').textContent=hist.length;
  const sub=document.getElementById('cash-hero-sub');
  if(hist.length>0){
    const last=hist[0];
    const prefix=last.type==='add'?'↑ ':'↓ ';
    const label=last.type==='add'?(LANG==='bn'?'শেষ যোগ: ':'Last in: '):(LANG==='bn'?'শেষ খরচ: ':'Last out: ');
    sub.textContent=prefix+label+'৳'+fmt(last.amt)+' — '+last.note;
  } else {
    sub.innerHTML='<span class="bn">কোনো লেনদেন নেই</span><span class="en" style="display:none">No transactions yet</span>';
  }
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
  const filtered=CASH_FILTER==='all'?hist:hist.filter(h=>h.type===CASH_FILTER);
  const list=document.getElementById('cash-history-list');
  if(filtered.length===0){
    list.innerHTML=`<div class="empty"><div class="empty-i">💵</div><div class="empty-t"><span class="bn">${CASH_FILTER==='all'?'কোনো লেনদেন নেই':'কোনো রেকর্ড নেই'}</span><span class="en">${CASH_FILTER==='all'?'No transactions yet':'No records found'}</span></div><div class="empty-s"><span class="bn">উপরের বাটন দিয়ে শুরু করুন</span><span class="en">Use the buttons above to get started</span></div></div>`;
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
      <button class="cash-del-btn" onclick="deleteCashEntry(${h.id})">🗑</button>
    </div>
  `).join('');
}

function fmt(n){return Number(n).toLocaleString('en-IN');}
function fmtD(v){
  let d=typeof v==='number'||(typeof v==='string'&&/^\d{10,}$/.test(v))?new Date(Number(v)):new Date(v);
  if(isNaN(d))return String(v);
  return `${String(d.getDate()).padStart(2,'0')}/${String(d.getMonth()+1).padStart(2,'0')}/${d.getFullYear()} ${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')}`;
}

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

function countUp(el,target,pre=''){
  const dur=450,s=performance.now();
  const up=n=>{const p=Math.min((n-s)/dur,1),e=1-Math.pow(1-p,3);el.textContent=pre+fmt(Math.round(target*e));if(p<1)requestAnimationFrame(up);else el.textContent=pre+fmt(target);};
  requestAnimationFrame(up);
}

function toast(msg){
  const t=document.getElementById('toast');
  const p=document.getElementById('sync-pill');
  t.textContent=msg;
  t.classList.add('on');
  if(p.classList.contains('show')){p.style.opacity='0';p.style.transform='translateY(12px)';}
  setTimeout(()=>{
    t.classList.remove('on');
    if(p.classList.contains('show')){p.style.opacity='1';p.style.transform='translateY(0)';}
  },3000);
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
function setQ(v,id){document.getElementById(id).value=v;}
function toggleSA(k){SA[k]=!SA[k];render();}

function parseFeeString(str){
  if(!str||typeof str!=='string')return 0;
  return str.split(',').map(s=>parseFloat(s.trim())).filter(n=>!isNaN(n)&&n>0).reduce((a,b)=>a+b,0);
}
function calculateLoanTotal(principal,fees=0,loanDateStr=null){
  const maxDays=90;
  let loanDate = loanDateStr ? new Date(loanDateStr) : new Date();
  loanDate.setHours(0,0,0,0);
  const now = new Date();
  now.setHours(0,0,0,0);
  const daysToCharge = Math.max(0, Math.min(maxDays, Math.floor((now - loanDate) / 86400000)));
  
  const r = 0.015;
  const emi = (principal * r * Math.pow(1 + r, 3)) / (Math.pow(1 + r, 3) - 1);
  const fullInterest = (emi * 3) - principal;
  const processingFee = Math.round(principal * 0.00575);
  const totalRepayment = principal + fullInterest + processingFee + fees;
  
  return {
    interest: Math.round(fullInterest),
    fullInterest: Math.round(fullInterest),
    processingFee,
    fees,
    daysToCharge,
    totalRepayment: Math.round(totalRepayment),
    emi: Math.round(emi)
  };
}
function getLoanBreakdown(p){
  const isLoan=p.loanData||p.history.some(h=>h.note.toLowerCase().includes('loan'));
  if(!isLoan)return null;
  const loanDate=p.loanData?.loanDate?new Date(p.loanData.loanDate):new Date(firstTs(p));
  const fees=p.loanData?.fees||0;
  
  const breakdown = calculateLoanTotal(p.original, fees, loanDate.toISOString().split('T')[0]);
  const paidAmount = p.history.filter(h => h.t === 'pay').reduce((s, h) => s + h.amt, 0);
  
  const monthsActive = Math.min(3, Math.ceil(breakdown.daysToCharge / 30) || 1);
  let currentInterest = 0;
  let tempPrincipal = p.original;
  for (let i = 1; i <= monthsActive; i++) {
    const monthInterest = Math.round(tempPrincipal * 0.015);
    currentInterest += monthInterest;
    const estimatedEmi = Math.round(breakdown.totalRepayment / 3);
    tempPrincipal = Math.max(0, tempPrincipal - (estimatedEmi - monthInterest));
  }
  
  const interestCovered = Math.min(paidAmount, currentInterest);
  const principalReduction = paidAmount - interestCovered;
  const remainingPrincipal = Math.max(0, p.original - principalReduction);
  
  let progressPercent = 0;
  if (breakdown.totalRepayment > 0) {
    progressPercent = Math.min(100, Math.round((paidAmount / breakdown.totalRepayment) * 100));
  }
  
  return {
    ...breakdown,
    interest: currentInterest,
    paidAmount,
    remainingPrincipal,
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

function addEntry(type){
  const p=type==='receive'?'r':'g';
  const name=document.getElementById(p+'-n').value.trim();
  const amt=parseFloat(document.getElementById(p+'-a').value);
  const note=document.getElementById(p+'-no').value.trim()||'Entry';
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
    DB[type].push({id:ts,name,original:amt,remaining:amt,history:[hist],loanData});
  }
  document.getElementById(p+'-n').value='';
  document.getElementById(p+'-a').value='';
  document.getElementById(p+'-no').value='';
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
  document.getElementById('m-edit-s').textContent=LANG==='bn'?'তথ্য পরিবর্তন করুন':'Edit entry';
  
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
  const breakdown=calculateLoanTotal(newAmt,fees,loanDateStr);
  
  const html=`
    <div>💵 Principal: ৳${fmt(newAmt)}</div>
    <div>📅 Days Passed: ${breakdown.daysToCharge}/90</div>
    <div>⏳ Current Interest: ৳${fmt(breakdown.interest)}</div>
    <div>📈 Amortized Max Interest: ৳${fmt(breakdown.fullInterest)}</div>
    <div>⚙️ Processing Fee: ৳${fmt(breakdown.processingFee)}</div>
    <div>💸 Extra Fees: ৳${fmt(fees)}</div>
    <div style="margin-top:6px;padding-top:4px;border-top:1px dashed var(--border);color:var(--primary);font-weight:700;">🗓️ Target EMI: ৳${fmt(breakdown.emi)}/mo</div>
  `;
  document.getElementById('ed-calc-breakdown').innerHTML=html;
  document.getElementById('ed-total-due').textContent=fmt(breakdown.totalRepayment);
}
function confirmEdit(){
  const amt=parseFloat(document.getElementById('ed-amt').value);
  if(isNaN(amt)||amt<=0)return alert(LANG==='bn'?'সঠিক তথ্য দিন!':'Enter valid data!');
  const p=DB[CTX.type].find(x=>x.id===CTX.id);
  const oldAmt=p.original;
  p.original=amt;
  p.remaining=p.remaining+(amt-oldAmt);
  
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
  if(confirm(LANG==='bn'?'ডিলিট করবেন?':'Confirm Delete?')){
    const p=DB[type].find(x=>x.id===id);
    logActivity('এন্ট্রি ডিলিট',p?p.name:'');
    DB[type]=DB[type].filter(x=>x.id!==id);
    saveData();render();toast(LANG==='bn'?'🗑️ ডিলিট হয়েছে':'🗑️ Deleted');
  }
}

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
      displayAmt=breakdown.totalRepayment-breakdown.paidAmount;
      if(displayAmt<0) displayAmt=0;
      pct=breakdown.progressPercent;
      
      loanBreakdownHtml=`<div style="background:var(--card);border-radius:8px;padding:8px;margin-top:8px;font-size:12px;line-height:1.8;border-left:2px solid var(--primary);">
        <div style="font-weight:700;margin-bottom:6px;color:var(--primary);display:flex;justify-content:space-between;">
          <span>🏦 Reducing Balance Loan Details</span>
          <span style="color:var(--yellow);font-weight:800;">📅 ${breakdown.daysToCharge}/90 Days</span>
        </div>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-bottom:6px;">
          <div>💵 Original Principal<br><span style="font-weight:700;font-size:13px;">৳${fmt(p.original)}</span></div>
          <div>📉 Remaining Principal<br><span style="font-weight:700;color:var(--primary);font-size:13px;">৳${fmt(breakdown.remainingPrincipal)}</span></div>
          <div>💰 Paid Amount<br><span style="font-weight:700;color:var(--green);font-size:13px;">৳${fmt(breakdown.paidAmount)}</span></div>
          <div>⏳ Current Interest<br><span style="font-weight:700;color:#f97316;font-size:13px;">৳${fmt(breakdown.interest)}</span></div>
          <div>📈 Full Interest<br><span style="font-weight:700;color:var(--muted);font-size:13px;">৳${fmt(breakdown.fullInterest)}</span></div>
          <div>⚙️ Processing Fee<br><span style="font-weight:700;color:var(--yellow);font-size:13px;">৳${fmt(breakdown.processingFee)}</span></div>
        </div>
        
        <div style="border-top:1px solid var(--border);padding-top:6px;margin-top:4px;background:rgba(56,189,248,0.05);padding:6px;border-radius:6px;margin-bottom:6px;">
          <div style="display:flex;justify-content:space-between;font-weight:700;color:var(--primary);">
            <span>🗓️ Established EMI:</span>
            <span>৳${fmt(breakdown.emi)} /mo</span>
          </div>
        </div>

        <div style="border-top:1px solid var(--border);padding-top:6px;margin-top:6px;">
          <div style="display:flex;justify-content:space-between;font-weight:700;">
            <span>Total Static Repayment:</span>
            <span style="color:var(--green);font-size:14px;font-weight:900;">৳${fmt(breakdown.totalRepayment)}</span>
          </div>
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
        <button class="btn-a" onclick="openPay('${type}',${p.id})">💸 <span class="bn">শোধ</span><span class="en">Pay</span></button>
        <button class="btn-a" onclick="openAddMore('${type}',${p.id})">➕ <span class="bn">যোগ</span><span class="en">Add</span></button>
        <button class="btn-a" onclick="openEdit('${type}',${p.id})">✏️ <span class="bn">এডিট</span><span class="en">Edit</span></button>
        <button class="btn-a" onclick="copyWA('${type}',${p.id})">📋</button>
        <button class="btn-a" style="color:var(--red);border-color:var(--red);flex:0.5" onclick="deleteEntry('${type}',${p.id})">🗑️</button>
      </div>
      <div class="hh" style="margin-top:14px;">HISTORY</div>
      ${p.history.slice(0,5).map(h=>`<div class="hi ${h.t==='add'?'ar':'pr'}"><span>${fmtD(h.date)} — ${h.note}</span><b style="color:var(--${h.t==='add'?'green':'red'})">${h.t==='add'?'+':'-'} ৳${fmt(h.amt)}</b></div>`).join('')}
      ${p.history.length>5?`<div style="font-size:11px;color:var(--muted);text-align:center;margin-top:6px;">+${p.history.length-5} more</div>`:''}
    </div>
    </div>
  </div>`;
}
function emptyS(bn,en,ic){return`<div class="empty"><div class="empty-i">${ic}</div><div class="empty-t"><span class="bn">${bn}</span><span class="en">${en}</span></div></div>`;}

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
  if(net>0){ns.textContent=LANG==='bn'?'▲ আপনি পাবেন':'▲ In your favor';ni.textContent='📈';}
  else if(net<0){ns.textContent=LANG==='bn'?'▼ আপনি দেবেন':'▼ You owe more';ni.textContent='📉';}
  else{ns.textContent=LANG==='bn'?'= সমান':'= Balanced';ni.textContent='⚖️';}
  renderTop();
  const fl=list=>q?list.filter(p=>p.name.toLowerCase().includes(q)):list;
  const sR=fl([...DB.receive].filter(p=>p.remaining>0)).sort((a,b)=>b.remaining-a.remaining);
  const shR=SA.r?sR:sR.slice(0,3);
  document.getElementById('lst-r').innerHTML=shR.map(p=>renderCard(p,'receive')).filter(Boolean).join('')||emptyS('কোনো পাওনা নেই','No receivables','📭');
  shR.forEach(p=>{const el=document.getElementById('card-'+p.id);if(el)initSwipe(el,'receive',p.id);});
  const bR=document.getElementById('sa-r');
  bR.style.display=sR.length>3?'inline-flex':'none';
  bR.querySelector('.bn').textContent=SA.r?'কম দেখুন':`সব দেখুন (${sR.length})`;
  bR.querySelector('.en').textContent=SA.r?'Show Less':`See All (${sR.length})`;
  const sG=fl([...DB.give].filter(p=>p.remaining>0)).sort((a,b)=>b.remaining-a.remaining);
  const shG=SA.g?sG:sG.slice(0,3);
  document.getElementById('lst-g').innerHTML=shG.map(p=>renderCard(p,'give')).filter(Boolean).join('')||emptyS('কোনো দেনা নেই','No payables','🎉');
  shG.forEach(p=>{const el=document.getElementById('card-'+p.id);if(el)initSwipe(el,'give',p.id);});
  const bG=document.getElementById('sa-g');
  bG.style.display=sG.length>3?'inline-flex':'none';
  bG.querySelector('.bn').textContent=SA.g?'কম দেখুন':`সব দেখুন (${sG.length})`;
  bG.querySelector('.en').textContent=SA.g?'Show Less':`See All (${sG.length})`;
  if(TAB==='a') renderAll();
}

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
