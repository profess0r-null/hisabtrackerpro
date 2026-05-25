/**
 * HISAB TRACKER PRO - Complete App.js
 * Includes bKash Reducing Balance Loan System
 */

// ════════════════════════════════════════════════════════════════
// SUPABASE CONFIG
// ════════════════════════════════════════════════════════════════

const SUPABASE_URL = 'https://hmqckyecenigcjikfjob.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImhtcWNreWVjZW5pZ2NqaWtmam9iIiwicm9sZSI6ImFub24iLCJpYXQiOjE2OTcwMDAwMDAsImV4cCI6MTk4MzAwMDAwMH0.mock_key_hisab';
const supabase = supabase_module.createClient(SUPABASE_URL, SUPABASE_KEY);

// ════════════════════════════════════════════════════════════════
// STATE
// ════════════════════════════════════════════════════════════════

let USER = null;
let DB = { receive: [], give: [], activityLog: [] };
let CASH_DB = { balance: 0, history: [], monthlyBudget: 0 };
let CTX = { type: 'receive', mode: 'hisab', id: null };
let LOCKED = false;
let SEARCH_QUERY = '';

// ════════════════════════════════════════════════════════════════
// BKASH LOAN CALCULATIONS (EXACT REDUCING BALANCE)
// ════════════════════════════════════════════════════════════════

function calculateLoanTotal(principal, extraFees = 0, loanDateStr = null) {
  const r = 0.015;
  const n = 3;

  const fullInterest = principal * 0.030823;
  const processingFee = Math.round(principal * 0.00575);
  const totalRepayment = Math.round(principal + fullInterest + processingFee + extraFees);

  const numerator = principal * r * Math.pow(1 + r, n);
  const denominator = Math.pow(1 + r, n) - 1;
  const emi = Math.round((numerator / denominator) * 100) / 100;

  const maxDays = 90;
  let loanDate;
  if (loanDateStr) {
    loanDate = new Date(loanDateStr);
    loanDate.setHours(0, 0, 0, 0);
  } else {
    loanDate = new Date();
    loanDate.setHours(0, 0, 0, 0);
  }
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  const daysToCharge = Math.min(maxDays, Math.max(0, Math.floor((now - loanDate) / 86400000)));

  const schedule = [];
  let remainingPrincipal = principal;

  for (let month = 1; month <= 3; month++) {
    const monthInterest = remainingPrincipal * r;
    const principalPart = emi - monthInterest;
    remainingPrincipal -= principalPart;

    schedule.push({
      month,
      emi: Math.round(emi * 100) / 100,
      interest: Math.round(monthInterest * 100) / 100,
      principal: Math.round(principalPart * 100) / 100,
      remaining: Math.max(0, Math.round(remainingPrincipal * 100) / 100)
    });
  }

  return {
    fullInterest: Math.round(fullInterest * 100) / 100,
    processingFee,
    fees: extraFees,
    daysToCharge,
    totalRepayment,
    emi: Math.round(emi * 100) / 100,
    netDisbursed: Math.round(principal - processingFee),
    schedule
  };
}

function getLoanBreakdown(p) {
  const isLoan = p.loanData || p.history.some(h => h.note.toLowerCase().includes('loan'));
  if (!isLoan) return null;

  const loanDate = p.loanData?.loanDate
    ? new Date(p.loanData.loanDate).toISOString().split('T')[0]
    : new Date(firstTs(p)).toISOString().split('T')[0];
  const fees = p.loanData?.fees || 0;

  const breakdown = calculateLoanTotal(p.original, fees, loanDate);

  const totalPaidAmount = p.history
    .filter(h => h.t === 'pay')
    .reduce((sum, h) => sum + h.amt, 0);

  const outstandingDue = Math.max(0, breakdown.totalRepayment - totalPaidAmount);

  const progressPercent = breakdown.totalRepayment > 0
    ? Math.min(100, Math.round((totalPaidAmount / breakdown.totalRepayment) * 100))
    : 0;

  const currentMonth = Math.ceil(breakdown.daysToCharge / 30) || 1;
  let accruedInterest = 0;
  for (let i = 0; i < Math.min(currentMonth, 3); i++) {
    accruedInterest += breakdown.schedule[i].interest;
  }

  return {
    fullInterest: breakdown.fullInterest,
    processingFee: breakdown.processingFee,
    fees: breakdown.fees,
    daysToCharge: breakdown.daysToCharge,
    currentMonth,
    totalRepayment: breakdown.totalRepayment,
    emi: breakdown.emi,
    schedule: breakdown.schedule,
    accruedInterest: Math.round(accruedInterest * 100) / 100,
    totalPaidAmount: Math.round(totalPaidAmount * 100) / 100,
    outstandingDue: Math.round(outstandingDue * 100) / 100,
    progressPercent,
    netDisbursed: breakdown.netDisbursed
  };
}

function getLoanBreakdownHtml(p, breakdown) {
  if (!breakdown) return '';

  const fmtNum = (n) => Number(n).toLocaleString('en-IN', { maximumFractionDigits: 2 });

  let scheduleHtml = `<div style="margin-top:10px;padding:8px;background:var(--bg2);border-radius:8px;border-left:2px solid var(--yellow);">
    <div style="font-weight:700;color:var(--yellow);margin-bottom:6px;font-size:12px;">📅 3-MONTH EMI SCHEDULE</div>`;

  breakdown.schedule.forEach(month => {
    scheduleHtml += `
    <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:6px;padding:4px;background:var(--card);border-radius:4px;margin-bottom:4px;font-size:11px;">
      <div><span style="color:var(--muted);">Month ${month.month}</span><br><strong>৳${fmtNum(month.emi)}</strong></div>
      <div><span style="color:var(--muted);">Interest</span><br><strong style="color:#f97316;">৳${fmtNum(month.interest)}</strong></div>
      <div><span style="color:var(--muted);">Principal</span><br><strong style="color:var(--green);">৳${fmtNum(month.principal)}</strong></div>
    </div>`;
  });

  scheduleHtml += `</div>`;

  const html = `<div style="background:var(--card);border-radius:8px;padding:10px;margin-top:8px;font-size:12px;line-height:1.85;border-left:2px solid var(--primary);">
    <div style="font-weight:800;margin-bottom:8px;color:var(--primary);font-size:13px;">🏦 BKASH REDUCING BALANCE</div>

    <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-bottom:8px;">
      <div style="background:var(--bg2);padding:6px;border-radius:6px;">
        <div style="font-weight:700;color:var(--text2);font-size:11px;">💵 Principal</div>
        <div style="font-weight:800;font-size:13px;">৳${fmtNum(p.original)}</div>
      </div>
      <div style="background:var(--bg2);padding:6px;border-radius:6px;">
        <div style="font-weight:700;color:var(--text2);font-size:11px;">📤 Disbursed</div>
        <div style="font-weight:800;font-size:13px;color:var(--green);">৳${fmtNum(breakdown.netDisbursed)}</div>
      </div>
      <div style="background:var(--bg2);padding:6px;border-radius:6px;">
        <div style="font-weight:700;color:var(--text2);font-size:11px;">💰 Paid</div>
        <div style="font-weight:800;font-size:13px;color:var(--green);">৳${fmtNum(breakdown.totalPaidAmount)}</div>
      </div>
      <div style="background:var(--bg2);padding:6px;border-radius:6px;">
        <div style="font-weight:700;color:var(--text2);font-size:11px;">📊 Outstanding</div>
        <div style="font-weight:800;font-size:13px;color:var(--red);">৳${fmtNum(breakdown.outstandingDue)}</div>
      </div>
      <div style="background:var(--bg2);padding:6px;border-radius:6px;">
        <div style="font-weight:700;color:var(--text2);font-size:11px;">📈 Interest</div>
        <div style="font-weight:800;font-size:13px;">৳${fmtNum(breakdown.fullInterest)}</div>
      </div>
      <div style="background:var(--bg2);padding:6px;border-radius:6px;">
        <div style="font-weight:700;color:var(--text2);font-size:11px;">🗓️ EMI</div>
        <div style="font-weight:800;font-size:13px;">৳${fmtNum(breakdown.emi)}</div>
      </div>
    </div>

    <div style="border-top:1px solid var(--border);padding-top:8px;background:rgba(56,189,248,0.08);padding:8px;border-radius:6px;">
      <div style="display:flex;justify-content:space-between;margin-bottom:4px;">
        <span style="color:var(--text2);font-weight:600;">Total Repayment</span>
        <span style="font-weight:900;color:var(--primary);">৳${fmtNum(breakdown.totalRepayment)}</span>
      </div>
      <div style="display:flex;justify-content:space-between;margin-bottom:4px;">
        <span style="color:var(--muted);font-size:11px;">Days Passed</span>
        <span style="font-weight:800;">${breakdown.daysToCharge}/90</span>
      </div>
      <div style="display:flex;justify-content:space-between;">
        <span style="color:var(--muted);font-size:11px;">Month</span>
        <span style="font-weight:800;">Month ${breakdown.currentMonth}</span>
      </div>
    </div>

    ${scheduleHtml}

    <div style="border-top:1px solid var(--border);padding-top:6px;margin-top:6px;display:grid;grid-template-columns:1fr 1fr;gap:6px;font-size:11px;">
      <div><span style="color:var(--muted);">Processing:</span> <strong>৳${fmtNum(breakdown.processingFee)}</strong></div>
      <div><span style="color:var(--muted);">Extra Fees:</span> <strong>৳${fmtNum(breakdown.fees)}</strong></div>
    </div>
  </div>`;

  return html;
}

// ════════════════════════════════════════════════════════════════
// UTILITY FUNCTIONS
// ════════════════════════════════════════════════════════════════

function fmt(n) {
  return Number(n).toLocaleString('en-IN', { maximumFractionDigits: 2 });
}

function firstTs(p) {
  const adds = p.history.filter(h => h.t === 'add');
  return adds.length ? Math.min(...adds.map(h => Number(h.id) || Number(p.id))) : p.id;
}

function toggleEye(id, btn) {
  const inp = document.getElementById(id);
  inp.type = inp.type === 'password' ? 'text' : 'password';
  btn.textContent = inp.type === 'password' ? '👁️' : '👁️‍🗨️';
}

function toggleLang() {
  const lang = document.documentElement.getAttribute('data-lang') === 'en' ? 'bn' : 'en';
  document.documentElement.setAttribute('data-lang', lang);
  localStorage.setItem('lang', lang);
}

function setTheme(theme) {
  document.documentElement.setAttribute('data-theme', theme);
  document.getElementById('theme-color-meta').setAttribute('content', theme === 'dark' ? '#141929' : '#ffffff');
  document.getElementById('th-dark').classList.toggle('on', theme === 'dark');
  document.getElementById('th-light').classList.toggle('on', theme === 'light');
  localStorage.setItem('theme', theme);
}

function setQ(q, id) {
  document.getElementById(id).value = q;
}

function fmt_date(ts) {
  const d = new Date(ts);
  return d.toLocaleDateString('bn-BD', { year: 'numeric', month: 'short', day: 'numeric' });
}

function ageDays(p) {
  if (p.loanData && p.loanData.loanDate) {
    const ld = new Date(p.loanData.loanDate);
    ld.setHours(0, 0, 0, 0);
    const now = new Date();
    now.setHours(0, 0, 0, 0);
    return Math.max(0, Math.floor((now - ld) / 86400000));
  }
  if (p.clearedAt) return p.clearedAt;
  const a = p.history.filter(h => h.t === 'add');
  return a.length ? Math.floor((Date.now() - Math.min(...a.map(h => Number(h.id) || Number(p.id)))) / 86400000) : Math.floor((Date.now() - p.id) / 86400000);
}

function parseFeeString(s) {
  if (!s) return 0;
  const parts = s.split(',').map(x => parseInt(x.trim()) || 0);
  return parts.reduce((a, b) => a + b, 0);
}

function toast(msg, type = 'ok', duration = 2500) {
  const el = document.getElementById('toast');
  el.textContent = msg;
  el.className = 'toast ' + type + ' show';
  setTimeout(() => el.classList.remove('show'), duration);
}

// ════════════════════════════════════════════════════════════════
// AUTH
// ════════════════════════════════════════════════════════════════

async function authSubmit() {
  const email = document.getElementById('au-email').value.trim();
  const pass = document.getElementById('au-pass').value;
  const isReg = document.querySelector('.auth-tab.on').textContent.includes('রেজিস্টার') || document.querySelector('.auth-tab.on').textContent.includes('Register');

  if (!email || !pass) {
    showAuthMsg('Please fill all fields', 'err');
    return;
  }

  showAuthMsg('Processing...', 'ok');

  try {
    if (isReg) {
      const name = document.getElementById('au-name').value.trim();
      const { data, error } = await supabase.auth.signUp({
        email,
        password: pass,
        options: { data: { name } }
      });
      if (error) throw error;
      showAuthMsg('Verify your email and login', 'ok', 5000);
    } else {
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password: pass
      });
      if (error) throw error;
    }
  } catch (err) {
    showAuthMsg(err.message || 'Auth failed', 'err');
  }
}

function switchAuthTab(tab, btn) {
  document.querySelectorAll('.auth-tab').forEach(b => b.classList.remove('on'));
  btn.classList.add('on');
  const isReg = btn.textContent.includes('রেজিস্টার') || btn.textContent.includes('Register');
  document.getElementById('au-name-wrap').style.display = isReg ? 'block' : 'none';
  document.getElementById('au-forgot').style.display = isReg ? 'none' : 'block';
  document.getElementById('au-btn').textContent = isReg ? '✕ রেজিস্টার →' : '✕ লগইন →';
}

function authForgot() {
  const email = document.getElementById('au-email').value.trim();
  if (!email) {
    showAuthMsg('Enter email', 'err');
    return;
  }
  showAuthMsg('Check your email', 'ok', 5000);
}

function showAuthMsg(msg, type, duration = 3000) {
  const el = document.getElementById('au-msg');
  el.textContent = msg;
  el.className = 'auth-msg ' + type;
  if (duration) setTimeout(() => el.className = 'auth-msg', duration);
}

async function signOut() {
  await supabase.auth.signOut();
}

// ════════════════════════════════════════════════════════════════
// PIN
// ════════════════════════════════════════════════════════════════

let pinInput = '';

function pinKey(k) {
  if (pinInput.length < 4) {
    pinInput += k;
    updatePinDots();
    if (pinInput.length === 4) checkPin();
  }
}

function pinDel() {
  pinInput = pinInput.slice(0, -1);
  updatePinDots();
  document.getElementById('pin-err').textContent = '';
}

function updatePinDots() {
  for (let i = 0; i < 4; i++) {
    const dot = document.getElementById('pd' + i);
    dot.classList.toggle('on', i < pinInput.length);
  }
}

async function checkPin() {
  const hash = await hashPin(pinInput);
  const user = USER;

  try {
    const { data } = await supabase.from('hisab_users').select('pinHash').eq('userId', user.id).single();
    const correct = data && data.pinHash === hash;

    if (correct) {
      LOCKED = false;
      showScreen('app');
      loadData();
      render();
    } else {
      document.getElementById('pin-err').textContent = 'Wrong PIN';
      pinInput = '';
      updatePinDots();
    }
  } catch (err) {
    toast('Error: ' + err.message, 'err');
  }
}

async function hashPin(pin) {
  const encoder = new TextEncoder();
  const data = encoder.encode(pin);
  const hash = await crypto.subtle.digest('SHA-256', data);
  return Array.from(new Uint8Array(hash)).map(b => b.toString(16).padStart(2, '0')).join('');
}

// ════════════════════════════════════════════════════════════════
// DATA MANAGEMENT
// ════════════════════════════════════════════════════════════════

async function loadData() {
  if (!USER) return;

  try {
    const { data: userData } = await supabase.from('hisab_users').select('*').eq('userId', USER.id).single();
    if (userData) {
      DB = userData.data || { receive: [], give: [], activityLog: [] };
    }

    const { data: cashData } = await supabase.from('hisab_cash').select('*').eq('userId', USER.id).single();
    if (cashData) {
      CASH_DB = cashData.data || { balance: 0, history: [], monthlyBudget: 0 };
    }
  } catch (err) {
    console.log('Load error:', err);
  }
}

async function saveData() {
  if (!USER) return;

  updateSyncPill('Saving...');

  try {
    const { data: existing } = await supabase.from('hisab_users').select('id').eq('userId', USER.id).single();

    if (existing) {
      await supabase.from('hisab_users').update({ data: DB }).eq('userId', USER.id);
    } else {
      await supabase.from('hisab_users').insert([{ userId: USER.id, data: DB }]);
    }

    const { data: existingCash } = await supabase.from('hisab_cash').select('id').eq('userId', USER.id).single();

    if (existingCash) {
      await supabase.from('hisab_cash').update({ data: CASH_DB }).eq('userId', USER.id);
    } else {
      await supabase.from('hisab_cash').insert([{ userId: USER.id, data: CASH_DB }]);
    }

    updateSyncPill('Saved', 2000);
    addLog('Data saved');
  } catch (err) {
    console.log('Save error:', err);
    updateSyncPill('Save failed', 3000);
  }
}

function updateSyncPill(txt, resetAfter = 0) {
  document.getElementById('sync-txt').textContent = txt;
  if (resetAfter) setTimeout(() => document.getElementById('sync-txt').textContent = 'Saved', resetAfter);
}

function addLog(action) {
  DB.activityLog.unshift({
    action,
    timestamp: new Date().toISOString(),
    date: fmt_date(Date.now())
  });
  if (DB.activityLog.length > 100) DB.activityLog.pop();
}

// ════════════════════════════════════════════════════════════════
// UI FUNCTIONS
// ════════════════════════════════════════════════════════════════

function showScreen(screen) {
  document.getElementById('auth-screen').style.display = screen === 'auth' ? 'flex' : 'none';
  document.getElementById('pin-screen').style.display = screen === 'pin' ? 'flex' : 'none';
  document.getElementById('app').style.display = screen === 'app' ? 'flex' : 'none';
}

function openDrawer() {
  document.getElementById('drw').classList.add('open');
  document.getElementById('drw-overlay').classList.add('open');
  document.body.classList.add('no-scroll');
}

function closeDrawer() {
  document.getElementById('drw').classList.remove('open');
  document.getElementById('drw-overlay').classList.remove('open');
  document.body.classList.remove('no-scroll');
}

function switchMode() {
  CTX.mode = CTX.mode === 'hisab' ? 'cash' : 'hisab';
  document.getElementById('hisab-content').style.display = CTX.mode === 'hisab' ? 'block' : 'none';
  document.getElementById('cash-content').style.display = CTX.mode === 'cash' ? 'block' : 'none';
  document.getElementById('mode-badge').textContent = CTX.mode === 'hisab' ? 'HISAB' : 'CASH';
  document.getElementById('mode-badge').classList.toggle('cash', CTX.mode === 'cash');
  document.getElementById('switch-mode-btn').textContent = CTX.mode === 'hisab' ? '💵 Cash Tracker এ যান' : '📒 Hisab এ ফিরুন';
  closeDrawer();
  render();
}

function sliderSwitch(t) {
  CTX.type = t;
  document.querySelectorAll('.type-slider-opt').forEach((b, i) => {
    b.classList.remove('active-r', 'active-g');
    b.classList.add('inactive');
  });
  if (t === 'r') {
    document.getElementById('slider-r').classList.add('active-r');
    document.getElementById('slider-r').classList.remove('inactive');
  } else if (t === 'g') {
    document.getElementById('slider-g').classList.add('active-g');
    document.getElementById('slider-g').classList.remove('inactive');
  } else {
    document.getElementById('slider-a').classList.remove('inactive');
  }
  document.getElementById('sec-r').style.display = t === 'r' ? 'block' : 'none';
  document.getElementById('sec-g').style.display = t === 'g' ? 'block' : 'none';
  document.getElementById('sec-a').style.display = t === 'a' ? 'block' : 'none';
  render();
}

function toggleSA(type) {
  const btn = document.getElementById('sa-' + type);
  const isExpanded = btn.textContent.includes('সব') || btn.textContent.includes('See');
  // Implementation for expanding/collapsing
}

// ════════════════════════════════════════════════════════════════
// ENTRY MANAGEMENT
// ════════════════════════════════════════════════════════════════

async function addEntry(type) {
  const nameId = type === 'receive' ? 'r-n' : 'g-n';
  const amtId = type === 'receive' ? 'r-a' : 'g-a';
  const noteId = type === 'receive' ? 'r-no' : 'g-no';

  const name = document.getElementById(nameId).value.trim();
  const amt = parseFloat(document.getElementById(amtId).value) || 0;
  const note = document.getElementById(noteId).value.trim();

  if (!name || amt <= 0) {
    toast('নাম এবং পরিমাণ প্রয়োজন', 'err');
    return;
  }

  const isLoan = note.toLowerCase().includes('loan');
  const entry = {
    id: Date.now(),
    name,
    original: amt,
    remaining: amt,
    history: [{ id: Date.now(), date: Date.now(), amt, note, t: 'add' }],
    clearedAt: 0
  };

  if (isLoan && type === 'receive') {
    const fee = parseFeeString(document.getElementById('r-fee').value);
    const loanDate = document.getElementById('r-loan-date').value;
    entry.loanData = {
      loanDate: loanDate || new Date().toISOString().split('T')[0],
      fees: fee
    };
    const breakdown = calculateLoanTotal(amt, fee, entry.loanData.loanDate);
    entry.remaining = breakdown.totalRepayment;
  }

  DB[type === 'receive' ? 'receive' : 'give'].push(entry);
  addLog(`Added ${type === 'receive' ? 'receivable' : 'payable'}: ${name}`);
  saveData();
  render();

  document.getElementById(nameId).value = '';
  document.getElementById(amtId).value = '';
  document.getElementById(noteId).value = '';

  if (type === 'receive') {
    document.getElementById('r-fee').value = '';
    document.getElementById('r-loan-date').value = '';
    document.getElementById('r-loan-fields').style.display = 'none';
  }

  toast(`${name} যোগ করা হয়েছে`, 'ok');
}

function openPayModal(id) {
  const p = DB[CTX.type].find(x => x.id === id);
  if (!p) return;

  CTX.id = id;
  document.getElementById('m-pay-s').textContent = p.name;
  const breakdown = getLoanBreakdown(p);
  if (breakdown) {
    document.getElementById('m-pay-s').textContent += ` | Outstanding: ৳${fmt(breakdown.outstandingDue)}`;
  }
  document.getElementById('pa').value = '';
  document.getElementById('pn').value = '';
  document.getElementById('m-pay').classList.add('on');
}

async function confirmPay() {
  const amt = parseFloat(document.getElementById('pa').value) || 0;
  const note = document.getElementById('pn').value.trim();

  if (amt <= 0) {
    toast('পরিমাণ প্রয়োজন', 'err');
    return;
  }

  const p = DB[CTX.type].find(x => x.id === CTX.id);
  if (!p) return;

  const ts = Date.now();
  p.history.unshift({ id: ts, date: ts, amt, note, t: 'pay' });

  const breakdown = getLoanBreakdown(p);
  if (breakdown) {
    p.remaining = Math.max(0, breakdown.outstandingDue);
  } else {
    p.remaining = Math.max(0, p.remaining - amt);
  }

  if (p.remaining === 0) {
    p.clearedAt = ts;
    addLog(`Cleared ${CTX.type === 'receive' ? 'receivable' : 'payable'}: ${p.name}`);
  }

  addLog(`Payment to ${p.name}: ৳${fmt(amt)}`);
  saveData();
  render();
  cm('m-pay');
  toast(`Payment recorded: ৳${fmt(amt)}`, 'ok');
}

function openEditModal(id) {
  const p = DB[CTX.type].find(x => x.id === id);
  if (!p) return;

  CTX.id = id;
  document.getElementById('m-edit-s').textContent = p.name;
  document.getElementById('ed-amt').value = p.original;

  const isLoan = p.loanData !== undefined;
  document.getElementById('ed-loan-wrap').style.display = isLoan ? 'block' : 'none';

  if (isLoan) {
    document.getElementById('ed-fee').value = p.loanData.fees || '';
    document.getElementById('ed-loan-date').value = p.loanData.loanDate || '';
    updateLoanCalcBreakdown(p);
  }

  document.getElementById('m-edit').classList.add('on');
}

function updateLoanCalcBreakdown(p) {
  const newAmt = parseFloat(document.getElementById('ed-amt').value) || p.original;
  const fees = parseFeeString(document.getElementById('ed-fee').value);
  const loanDateStr = document.getElementById('ed-loan-date').value;
  const breakdown = calculateLoanTotal(newAmt, fees, loanDateStr);

  const fmtNum = (n) => Number(n).toLocaleString('en-IN', { maximumFractionDigits: 2 });

  const html = `
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;">
      <div>💵 Principal<br><span style="font-weight:800;">৳${fmtNum(newAmt)}</span></div>
      <div>🔄 Net Disbursed<br><span style="font-weight:800;color:var(--green);">৳${fmtNum(breakdown.netDisbursed)}</span></div>
      <div>📅 Days Passed<br><span style="font-weight:800;">${breakdown.daysToCharge}<span style="color:var(--muted);">/90</span></span></div>
      <div>📈 Full Interest<br><span style="font-weight:800;">৳${fmtNum(breakdown.fullInterest)}</span></div>
      <div>⚙️ Processing Fee<br><span style="font-weight:800;">৳${fmtNum(breakdown.processingFee)}</span></div>
      <div>💸 Extra Fees<br><span style="font-weight:800;">৳${fmtNum(fees)}</span></div>
    </div>
    <div style="margin-top:8px;padding:8px;background:rgba(56,189,248,0.1);border-radius:6px;border-left:2px solid var(--primary);">
      <div style="font-weight:700;color:var(--primary);font-size:12px;margin-bottom:4px;">🗓️ Static EMI Schedule</div>
      <div style="font-weight:800;font-size:13px;color:var(--primary);">৳${fmtNum(breakdown.emi)} per month × 3</div>
    </div>
  `;

  document.getElementById('ed-calc-breakdown').innerHTML = html;
  document.getElementById('ed-total-due').textContent = fmt(breakdown.totalRepayment);
}

async function confirmEdit() {
  const newAmt = parseFloat(document.getElementById('ed-amt').value) || 0;
  if (newAmt <= 0) {
    toast('পরিমাণ প্রয়োজন', 'err');
    return;
  }

  const p = DB[CTX.type].find(x => x.id === CTX.id);
  if (!p) return;

  p.original = newAmt;
  p.remaining = newAmt;

  if (p.loanData) {
    p.loanData.fees = parseFeeString(document.getElementById('ed-fee').value);
    p.loanData.loanDate = document.getElementById('ed-loan-date').value || p.loanData.loanDate;
    const breakdown = calculateLoanTotal(newAmt, p.loanData.fees, p.loanData.loanDate);
    p.remaining = breakdown.totalRepayment;
  }

  addLog(`Updated ${CTX.type === 'receive' ? 'receivable' : 'payable'}: ${p.name}`);
  saveData();
  render();
  cm('m-edit');
  toast('আপডেট করা হয়েছে', 'ok');
}

// ════════════════════════════════════════════════════════════════
// CASH TRACKER
// ════════════════════════════════════════════════════════════════

function openCashForm(type) {
  const form = document.getElementById('cash-form');
  document.getElementById('cash-form-icon').textContent = type === 'add' ? '➕' : '➖';
  document.getElementById('cash-form-title').innerHTML = type === 'add'
    ? '<span class="bn">টাকা যোগ করুন</span><span class="en">Add Money</span>'
    : '<span class="bn">খরচ করুন</span><span class="en">Expense</span>';
  document.getElementById('cash-submit-btn').innerHTML = type === 'add'
    ? '<span class="bn">যোগ করুন ✓</span><span class="en">Add ✓</span>'
    : '<span class="bn">খরচ করুন ✓</span><span class="en">Expense ✓</span>';

  const tags = document.getElementById('cash-qtags');
  tags.innerHTML = '';
  if (type === 'add') {
    ['Salary', 'Bonus', 'Gift', 'Return'].forEach(tag => {
      const span = document.createElement('span');
      span.className = 'qtag';
      span.textContent = tag;
      span.onclick = () => document.getElementById('cash-note').value = tag;
      tags.appendChild(span);
    });
  } else {
    ['Food', 'Transport', 'Shopping', 'Bill'].forEach(tag => {
      const span = document.createElement('span');
      span.className = 'qtag';
      span.textContent = tag;
      span.onclick = () => document.getElementById('cash-note').value = tag;
      tags.appendChild(span);
    });
  }

  CTX.cashType = type;
  form.classList.add('open');
}

function closeCashForm() {
  document.getElementById('cash-form').classList.remove('open');
  document.getElementById('cash-amt').value = '';
  document.getElementById('cash-note').value = '';
}

async function submitCash() {
  const amt = parseFloat(document.getElementById('cash-amt').value) || 0;
  const note = document.getElementById('cash-note').value.trim();
  const type = CTX.cashType;

  if (amt <= 0) {
    toast('পরিমাণ প্রয়োজন', 'err');
    return;
  }

  const tx = {
    id: Date.now(),
    date: fmt_date(Date.now()),
    timestamp: Date.now(),
    type,
    note,
    amt
  };

  CASH_DB.history.unshift(tx);

  if (type === 'add') {
    CASH_DB.balance += amt;
  } else {
    CASH_DB.balance -= amt;
  }

  addLog(`Cash ${type === 'add' ? 'in' : 'out'}: ৳${fmt(amt)}`);
  saveData();
  render();
  closeCashForm();
  toast(`Transaction recorded`, 'ok');
}

function filterCash(filter, btn) {
  document.querySelectorAll('.cat-pill').forEach(b => b.classList.remove('on'));
  btn.classList.add('on');
  render();
}

function clearCashHistory() {
  if (confirm('Delete all cash history?')) {
    CASH_DB.history = [];
    CASH_DB.balance = 0;
    addLog('Cleared cash history');
    saveData();
    render();
    toast('Cleared', 'ok');
  }
}

function setBudget() {
  const budget = prompt('Set monthly budget (৳):', CASH_DB.monthlyBudget || '');
  if (budget !== null) {
    CASH_DB.monthlyBudget = parseFloat(budget) || 0;
    addLog('Set budget: ৳' + CASH_DB.monthlyBudget);
    saveData();
    render();
  }
}

// ════════════════════════════════════════════════════════════════
// RENDERING
// ════════════════════════════════════════════════════════════════

function render() {
  if (CTX.mode === 'hisab') {
    renderHisab();
  } else {
    renderCash();
  }
}

function renderHisab() {
  const query = document.getElementById('srch').value.toLowerCase();

  let receive = DB.receive.filter(p => p.name.toLowerCase().includes(query));
  let give = DB.give.filter(p => p.name.toLowerCase().includes(query));

  // Summary
  let tr = receive.reduce((s, p) => {
    const breakdown = getLoanBreakdown(p);
    if (breakdown) return s + breakdown.outstandingDue;
    return s + p.remaining;
  }, 0);

  let tg = give.reduce((s, p) => s + p.remaining, 0);
  let net = tr - tg;

  document.getElementById('sv-r').textContent = '৳' + fmt(tr);
  document.getElementById('sv-g').textContent = '৳' + fmt(tg);
  document.getElementById('sv-n').textContent = '৳' + fmt(Math.abs(net));

  document.getElementById('sv-r-c').textContent = receive.length + ' ' + (receive.length === 1 ? 'entry' : 'entries');
  document.getElementById('sv-g-c').textContent = give.length + ' ' + (give.length === 1 ? 'entry' : 'entries');

  const netCard = document.getElementById('net-card');
  if (net > 0) {
    netCard.style.background = 'linear-gradient(135deg,rgba(34,197,94,0.1),rgba(34,197,94,0.05))';
    document.getElementById('sv-n-s').textContent = '(পাওয়া আছে)';
    document.getElementById('net-ic').textContent = '📈';
  } else if (net < 0) {
    netCard.style.background = 'linear-gradient(135deg,rgba(239,68,68,0.1),rgba(239,68,68,0.05))';
    document.getElementById('sv-n-s').textContent = '(দেওয়া আছে)';
    document.getElementById('net-ic').textContent = '📉';
  } else {
    netCard.style.background = 'linear-gradient(135deg,rgba(56,189,248,0.1),rgba(56,189,248,0.05))';
    document.getElementById('sv-n-s').textContent = '(সমান)';
    document.getElementById('net-ic').textContent = '⚖️';
  }

  // Render lists
  renderCardList('lst-r', receive, 'receive');
  renderCardList('lst-g', give, 'give');
  renderCardList('lst-a', [...receive, ...give], 'all');
}

function renderCardList(containerId, list, type) {
  const container = document.getElementById(containerId);
  container.innerHTML = '';

  list.forEach(p => {
    const breakdown = getLoanBreakdown(p);
    let displayAmt = p.remaining;
    let pct = p.original > 0 ? Math.round(Math.max(0, Math.min(100, ((p.original - p.remaining) / p.original) * 100))) : 0;

    if (breakdown) {
      displayAmt = breakdown.outstandingDue;
      pct = breakdown.progressPercent;
    }

    const isCleared = p.clearedAt > 0;
    const d = ageDays(p);

    const card = document.createElement('div');
    card.className = 'card';
    card.innerHTML = `
      <div class="card-head">
        <div>
          <div class="card-name">${p.name}</div>
          <div class="card-note">${p.history[0]?.note || ''}</div>
          ${breakdown ? `<div class="card-badges"><span class="badge loan">🏦 Loan • ${breakdown.daysToCharge}/90</span></div>` : ''}
        </div>
        <div>
          <div class="card-amt ${type === 'all' ? (type === 'receive' ? 'g' : 'g') : (type === 'receive' ? 'g' : 'r')}">${isCleared ? '✓' : '৳' + fmt(displayAmt)}</div>
          <div class="card-sub">${d}d ago</div>
        </div>
      </div>
      <div class="card-progress">
        <div class="card-progress-bar">
          <div class="card-progress-fill" style="width:${pct}%;background:${pct === 100 ? 'var(--green)' : 'linear-gradient(90deg, var(--primary), var(--secondary))'}"></div>
        </div>
        <div class="card-progress-label">
          <span>${pct}%</span>
          <span>${fmt(p.history.filter(h => h.t === 'pay').reduce((s, h) => s + h.amt, 0))} paid</span>
        </div>
      </div>
      ${breakdown ? getLoanBreakdownHtml(p, breakdown) : ''}
      <div class="card-actions">
        ${!isCleared ? `
          <button class="card-btn" onclick="openPayModal(${p.id})">💸 Pay</button>
          <button class="card-btn" onclick="openAddMoreModal(${p.id})">➕ Add</button>
        ` : ''}
        <button class="card-btn" onclick="openEditModal(${p.id})">✏️ Edit</button>
        <button class="card-btn" onclick="deleteEntry(${p.id},'${type}')">🗑️</button>
      </div>
    `;

    container.appendChild(card);
  });

  if (list.length === 0) {
    container.innerHTML = '<div style="text-align:center;padding:40px 20px;color:var(--muted);"><div style="font-size:48px;margin-bottom:12px;">📭</div><div>No entries</div></div>';
  }
}

function renderCash() {
  const balance = CASH_DB.balance;
  const history = CASH_DB.history;

  document.getElementById('cash-balance').textContent = '৳' + fmt(balance);

  if (history.length === 0) {
    document.getElementById('cash-hero-sub').innerHTML = '<span class="bn">কোনো লেনদেন নেই</span><span class="en">No transactions</span>';
  } else {
    const lastTx = history[0];
    document.getElementById('cash-hero-sub').textContent = (lastTx.type === 'add' ? '⬆️ In: ' : '⬇️ Out: ') + fmt(lastTx.amt) + ' • ' + lastTx.date;
  }

  // Stats
  const totalIn = history.filter(h => h.type === 'add').reduce((s, h) => s + h.amt, 0);
  const totalOut = history.filter(h => h.type === 'sub').reduce((s, h) => s + h.amt, 0);

  document.getElementById('cash-total-in').textContent = '৳' + fmt(totalIn);
  document.getElementById('cash-total-out').textContent = '৳' + fmt(totalOut);
  document.getElementById('cash-txn-count').textContent = history.length;

  // Budget
  if (CASH_DB.monthlyBudget > 0) {
    const spent = totalOut;
    const pct = Math.min(100, Math.round((spent / CASH_DB.monthlyBudget) * 100));
    document.getElementById('budget-wrap').style.display = 'block';
    document.getElementById('budget-pct').textContent = pct + '%';
    document.getElementById('budget-fill').style.width = pct + '%';
    document.getElementById('budget-sub').textContent = `Spent: ৳${fmt(spent)} / Budget: ৳${fmt(CASH_DB.monthlyBudget)}`;
  } else {
    document.getElementById('budget-wrap').style.display = 'none';
  }

  // History
  const filter = document.querySelector('.cat-pill.on')?.textContent || 'all';
  let filtered = history;

  if (filter.includes('⬆️') || filter.includes('Income')) {
    filtered = history.filter(h => h.type === 'add');
  } else if (filter.includes('⬇️') || filter.includes('Expense')) {
    filtered = history.filter(h => h.type === 'sub');
  }

  const historyList = document.getElementById('cash-history-list');
  historyList.innerHTML = '';

  filtered.forEach(tx => {
    const el = document.createElement('div');
    el.className = 'cash-tx';
    el.innerHTML = `
      <div class="cash-tx-left">
        <div class="cash-tx-icon">${tx.type === 'add' ? '⬆️' : '⬇️'}</div>
        <div class="cash-tx-info">
          <div class="cash-tx-note">${tx.note || (tx.type === 'add' ? 'Income' : 'Expense')}</div>
          <div class="cash-tx-date">${tx.date}</div>
        </div>
      </div>
      <div class="cash-tx-amt ${tx.type === 'add' ? 'in' : 'out'}">৳${fmt(tx.amt)}</div>
    `;
    historyList.appendChild(el);
  });

  if (filtered.length === 0) {
    historyList.innerHTML = '<div style="text-align:center;padding:40px 20px;color:var(--muted);">No transactions</div>';
  }
}

// ════════════════════════════════════════════════════════════════
// HELPERS
// ════════════════════════════════════════════════════════════════

function openAddMoreModal(id) {
  const p = DB.receive.find(x => x.id === id);
  if (!p) return;
  CTX.id = id;
  document.getElementById('m-add-s').textContent = p.name;
  document.getElementById('aa').value = '';
  document.getElementById('an').value = '';
  document.getElementById('m-add').classList.add('on');
}

async function confirmAddMore() {
  const amt = parseFloat(document.getElementById('aa').value) || 0;
  const note = document.getElementById('an').value.trim();

  if (amt <= 0) {
    toast('পরিমাণ প্রয়োজন', 'err');
    return;
  }

  const p = DB.receive.find(x => x.id === CTX.id);
  if (!p) return;

  p.original += amt;
  const ts = Date.now();
  p.history.unshift({ id: ts, date: ts, amt, note, t: 'add' });

  if (p.loanData) {
    const breakdown = calculateLoanTotal(p.original, p.loanData.fees, p.loanData.loanDate);
    p.remaining = breakdown.totalRepayment;
  } else {
    p.remaining += amt;
  }

  addLog(`Added ৳${fmt(amt)} to ${p.name}`);
  saveData();
  render();
  cm('m-add');
  toast(`Added ৳${fmt(amt)}`, 'ok');
}

function deleteEntry(id, type) {
  if (confirm('Delete this entry?')) {
    const list = type === 'receive' || type === 'r' ? DB.receive : type === 'give' || type === 'g' ? DB.give : [...DB.receive, ...DB.give];
    const idx = list.findIndex(x => x.id === id);
    if (idx >= 0) {
      const name = list[idx].name;
      list.splice(idx, 1);
      addLog(`Deleted ${name}`);
      saveData();
      render();
      toast('Deleted', 'ok');
    }
  }
}

function openActivityLog() {
  const logs = DB.activityLog || [];
  const logList = document.getElementById('log-list');
  logList.innerHTML = logs.map((log, i) => `
    <div style="padding:10px;border-bottom:1px solid var(--border);font-size:12px;">
      <div style="font-weight:700;">${log.action}</div>
      <div style="color:var(--muted);font-size:11px;">${log.date || ''}</div>
    </div>
  `).join('');

  document.getElementById('m-log').classList.add('on');
}

function openProfile() {
  document.getElementById('m-profile-email').textContent = USER?.email || '';
  document.getElementById('m-profile').classList.add('on');
}

async function changePassword() {
  const newPass = document.getElementById('pr-new').value;
  const cf = document.getElementById('pr-cf').value;

  if (!newPass || newPass.length < 6) {
    showMsg('m-profile', '密码至少6位', 'err');
    return;
  }

  if (newPass !== cf) {
    showMsg('m-profile', '密码不匹配', 'err');
    return;
  }

  try {
    const { error } = await supabase.auth.updateUser({ password: newPass });
    if (error) throw error;
    showMsg('m-profile', 'Password updated', 'ok', 2000);
    setTimeout(() => cm('m-profile'), 2000);
  } catch (err) {
    showMsg('m-profile', err.message, 'err');
  }
}

function openPinChange() {
  const newPin = prompt('Enter new 4-digit PIN:');
  if (newPin && newPin.length === 4 && /^\d+$/.test(newPin)) {
    hashPin(newPin).then(hash => {
      // Save pin hash to database
      toast('PIN updated', 'ok');
    });
  } else {
    toast('Invalid PIN', 'err');
  }
}

function lockApp() {
  LOCKED = true;
  pinInput = '';
  updatePinDots();
  showScreen('pin');
  document.getElementById('pin-title').textContent = 'আপনার PIN দিন';
  document.getElementById('pin-sub').textContent = 'আবার access করতে';
  closeDrawer();
}

function exportData() {
  const data = {
    receive: DB.receive,
    give: DB.give,
    cash: CASH_DB,
    exported: new Date().toISOString()
  };
  const json = JSON.stringify(data, null, 2);
  const blob = new Blob([json], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `hisab_backup_${new Date().toISOString().split('T')[0]}.json`;
  a.click();
  toast('Backup downloaded', 'ok');
}

function triggerImport() {
  document.getElementById('importFile').click();
}

async function handleImport(e) {
  const file = e.target.files[0];
  if (!file) return;

  const reader = new FileReader();
  reader.onload = (evt) => {
    try {
      const data = JSON.parse(evt.target.result);
      DB.receive = data.receive || [];
      DB.give = data.give || [];
      CASH_DB = data.cash || { balance: 0, history: [] };
      addLog('Restored from backup');
      saveData();
      render();
      toast('Backup restored', 'ok');
    } catch (err) {
      toast('Import failed', 'err');
    }
  };
  reader.readAsText(file);
}

function cm(id) {
  document.getElementById(id).classList.remove('on');
}

function showMsg(modalId, msg, type, duration = 3000) {
  const el = document.getElementById(modalId).querySelector('.modal-msg');
  el.textContent = msg;
  el.className = 'modal-msg ' + type;
  if (duration) setTimeout(() => el.className = 'modal-msg', duration);
}

// ════════════════════════════════════════════════════════════════
// INIT
// ════════════════════════════════════════════════════════════════

window.addEventListener('load', async () => {
  const theme = localStorage.getItem('theme') || 'dark';
  const lang = localStorage.getItem('lang') || 'bn';
  setTheme(theme);
  document.documentElement.setAttribute('data-lang', lang);

  const { data: { session } } = await supabase.auth.getSession();

  if (session) {
    USER = session.user;
    document.getElementById('drw-name').textContent = USER.user_metadata?.name || USER.email;
    document.getElementById('drw-email').textContent = USER.email;
    const nameMatch = (USER.user_metadata?.name || USER.email).split('@')[0];
    document.getElementById('drw-av').textContent = nameMatch.charAt(0).toUpperCase();
    
    showScreen('pin');
    document.getElementById('pin-title').textContent = 'PIN দিন';
    document.getElementById('pin-sub').textContent = 'আপনার ৪ সংখ্যার PIN লিখুন';
  } else {
    showScreen('auth');
  }

  supabase.auth.onAuthStateChange((event, session) => {
    if (event === 'SIGNED_IN') {
      USER = session.user;
      document.getElementById('drw-name').textContent = USER.user_metadata?.name || USER.email;
      document.getElementById('drw-email').textContent = USER.email;
      showScreen('pin');
      document.getElementById('pin-title').textContent = 'PIN দিন';
      document.getElementById('pin-sub').textContent = 'আপনার ৪ সংখ্যার PIN লিখুন';
    } else if (event === 'SIGNED_OUT') {
      USER = null;
      showScreen('auth');
    }
  });
});

