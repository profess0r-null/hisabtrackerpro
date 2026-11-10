(function(root){'use strict';
const plain=x=>x&&typeof x==='object'&&!Array.isArray(x);function check(c,m){if(!c)throw new Error(m);}
const money=x=>typeof x==='number'&&Number.isFinite(x)&&Math.abs(x)<=1e12;
function scan(x,d=0){check(d<35,'Backup too deeply nested');if(x&&typeof x==='object')for(const k of Object.keys(x)){check(!['__proto__','constructor','prototype'].includes(k),'Unsafe key');scan(x[k],d+1);}}
const walletKey=k=>['cash','bkash','nagad','bank'].includes(k)||/^wallet_[0-9]{1,20}$/.test(k);
const id=x=>typeof x==='number'&&Number.isSafeInteger(x)&&x>0;
function history(list,cash=false){check(Array.isArray(list)&&list.length<=100000,'Invalid history');const seen=new Set();for(const h of list){check(plain(h)&&money(h.amt)&&h.amt>=0&&typeof h.note==='string'&&h.note.length<=5000&&Number.isFinite(new Date(h.date).getTime()),'Invalid transaction');check(cash?['add','sub','transfer'].includes(h.type):['add','pay','adjust'].includes(h.t),'Invalid transaction type');if(h.id!=null){check(id(h.id)&&!seen.has(h.id),'Duplicate/invalid transaction ID');seen.add(h.id);}if(cash){if(h.wallet)check(walletKey(h.wallet),'Invalid wallet');if(h.type==='transfer')check(walletKey(h.fromWallet)&&walletKey(h.toWallet)&&h.fromWallet!==h.toWallet,'Invalid transfer');}}}
function hp(p){check(plain(p),'Invalid book');for(const kind of ['receive','give']){check(Array.isArray(p[kind]),'Missing account list');const ids=new Set();for(const x of p[kind]){check(plain(x)&&id(x.id)&&!ids.has(x.id)&&typeof x.name==='string'&&x.name.length<=200&&money(x.original)&&x.original>=0&&money(x.remaining),'Invalid person');ids.add(x.id);history(x.history);if(x.loanData)check(plain(x.loanData)&&money(x.loanData.fees||0)&&(!x.loanData.loanDate||Number.isFinite(new Date(x.loanData.loanDate).getTime())),'Invalid loan');}}
 if(p.categories){check(plain(p.categories),'Invalid categories');for(const[k,list]of Object.entries(p.categories)){check(['cashAdd','cashSub','hisabReceive','hisabGive','hisabAddMore','hisabPay'].includes(k)&&Array.isArray(list),'Invalid category group');for(const c of list)check(plain(c)&&typeof c.l==='string'&&typeof c.e==='string'&&c.l.length<=200&&c.e.length<=50,'Invalid category');}}
 if(p.activityLog){check(Array.isArray(p.activityLog),'Invalid activity log');for(const x of p.activityLog)check(plain(x)&&typeof x.action==='string'&&(x.detail==null||typeof x.detail==='string'),'Invalid log');}}
function cp(p){
 check(plain(p)&&money(p.balance??0),'Invalid cash account');
 if(p.customWallets){check(plain(p.customWallets)&&Object.keys(p.customWallets).length<=1000,'Invalid custom wallets');for(const[k,v]of Object.entries(p.customWallets))check(/^wallet_[0-9]{1,20}$/.test(k)&&plain(v)&&typeof v.name==='string'&&v.name.trim().length>0&&v.name.length<=40&&(v.iconKind==null||['wallet','mobile','bank','card','business','savings'].includes(v.iconKind)),'Invalid custom wallet');}
 const known=k=>walletKey(k)&&(!k.startsWith('wallet_')||Object.prototype.hasOwnProperty.call(p.customWallets||{},k));
 if(p.enabledWallets!=null)check(Array.isArray(p.enabledWallets)&&p.enabledWallets.includes('cash')&&p.enabledWallets.length<=5&&new Set(p.enabledWallets).size===p.enabledWallets.length&&p.enabledWallets.every(known),'Invalid enabled wallets');
 history(p.history||[],true);
 for(const h of p.history||[]){if(h.wallet)check(known(h.wallet),'Unknown wallet');if(h.type==='transfer')check(known(h.fromWallet)&&known(h.toWallet),'Unknown transfer wallet');}
 if(p.wallets){check(plain(p.wallets),'Invalid wallets');for(const[k,v]of Object.entries(p.wallets))check(known(k)&&money(v),'Invalid balance');}
 const active=new Set(['cash',...(p.enabledWallets||[]),...Object.keys(p.wallets||{}).filter(k=>p.wallets[k]!==0)]);check(active.size<=5,'Maximum 5 active wallets');
 if(p.budget!=null)check(money(p.budget)&&p.budget>=0,'Invalid budget');
 if(p.monthlyBudgets){check(plain(p.monthlyBudgets),'Invalid monthly budgets');for(const[k,v]of Object.entries(p.monthlyBudgets))check(/^\d{4}-\d{2}$/.test(k)&&money(v)&&v>=0,'Invalid monthly budget');}
}
function validate(h,c){scan(h);scan(c);check(plain(h)&&plain(c),'Invalid backup');if(h.profilesData){check(Array.isArray(h.profiles)&&h.profiles.length>0&&h.profiles.length<=100&&plain(h.profilesData),'Invalid profiles');const ids=new Set();for(const p of h.profiles){check(plain(p)&&typeof p.id==='string'&&/^[a-zA-Z0-9_-]{1,100}$/.test(p.id)&&!ids.has(p.id)&&typeof p.name==='string'&&p.name.length<=100&&(p.icon==null||typeof p.icon==='string'),'Invalid profile');ids.add(p.id);check(h.profilesData[p.id],'Missing profile data');}check(ids.has('default'),'Default profile required');for(const p of Object.values(h.profilesData))hp(p);}else hp(h);if(c.profilesData){check(plain(c.profilesData),'Invalid cash profiles');for(const p of Object.values(c.profilesData))cp(p);}else cp(c);return true;}
function escapeHTML(v){return String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));}
root.HisabSafety={validate,escapeHTML};if(typeof module!=='undefined'&&module.exports)module.exports=root.HisabSafety;
})(typeof globalThis!=='undefined'?globalThis:this);
