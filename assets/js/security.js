/* Server authority for PINs and owner-only usage; never trusts a stored browser flag. */
(function(root){
 'use strict';
 function purge(storage,userId){
  if(!userId)return;
  for(const key of ['ht_confirmed_v1_','ht_','ht_cash_','ht_pre_online_backup_','ht_pin_','ht_tr_']){
   try{storage.removeItem(key+userId);}catch{}
  }
 }
 function create(client){
  let userId=null,state=null,epoch=0;
  function unlocked(){return !!state?.unlocked&&Date.parse(state.unlocked_until)>Date.now();}
  async function call(name,args){
   const mine=epoch;
   const query=client.rpc(name,args);
   const result=await (typeof query.abortSignal==='function'&&typeof AbortSignal.timeout==='function'?query.abortSignal(AbortSignal.timeout(15000)):query);
   if(mine!==epoch)throw new Error('Session changed');
   if(result.error){if(result.error.code==='42501')state={...state,unlocked:false,unlocked_until:null};const error=new Error(result.error.code==='PGRST202'?'Security update needs to be installed on the server.':result.error.message||'Request failed');error.code=result.error.code;throw error;}
   return result.data;
  }
  function accept(result){if(result?.ok){state={...state,has_pin:true,unlocked:true,unlocked_until:result.unlocked_until,blocked_until:null};}return result;}
  return Object.freeze({
   async connect(id){epoch++;userId=id;state=null;purge(localStorage,id);return this.refresh();},
   async refresh(){
    if(!userId)throw new Error('Sign in required');
    if(sessionStorage.getItem('ht_lock_pending_'+userId)==='1'){
     await call('ht_pin_lock');sessionStorage.removeItem('ht_lock_pending_'+userId);
    }
    state=await call('ht_gate_status');return {...state};
   },
   get hasPin(){return !!state?.has_pin;},
   get isUnlocked(){return unlocked();},
   get isOwner(){return unlocked()&&state?.is_owner===true;},
   async unlock(pin){const result=await call('ht_pin_unlock',{p_pin:pin});if(!result?.ok){state={...state,unlocked:false,blocked_until:result?.blocked_until};}return accept(result);},
   async setPin(pin){return accept(await call('ht_pin_set',{p_pin:pin}));},
   async lock(){
    state={...state,unlocked:false,unlocked_until:null};purge(localStorage,userId);
    if(!userId)return;
    sessionStorage.setItem('ht_lock_pending_'+userId,'1');
    await call('ht_pin_lock');sessionStorage.removeItem('ht_lock_pending_'+userId);
   },
   async touch(){if(!unlocked())return;const data=await call('ht_record_usage');state={...state,unlocked_until:data.unlocked_until};},
   async report(page=0){if(!this.isOwner)throw new Error('Not authorized');return call('ht_usage_report',{p_page:page});},
   clear(){epoch++;purge(localStorage,userId);state=null;userId=null;}
  });
 }
 root.HisabSecurity={create,purge};
 if(typeof module!=='undefined'&&module.exports)module.exports=root.HisabSecurity;
})(typeof globalThis!=='undefined'?globalThis:this);
