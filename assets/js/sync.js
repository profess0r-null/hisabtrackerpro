/* Online-only confirmed writes. Unsubmitted/failed forms never become account data. */
(function(root){'use strict';
const copy=x=>x===undefined?undefined:JSON.parse(JSON.stringify(x)),equal=(a,b)=>JSON.stringify(a)===JSON.stringify(b),object=x=>x&&typeof x==='object'&&!Array.isArray(x);
class Conflict extends Error{constructor(path){super('Account changed elsewhere. Refresh and try again.');this.name='SyncConflict';this.path=path;}}
function merge(base,local,remote,path='account'){
 if(equal(local,base))return copy(remote);if(equal(remote,base)||equal(local,remote))return copy(local);
 if(object(local)&&object(remote)&&(object(base)||base===undefined)){const out={};for(const k of new Set([...Object.keys(base||{}),...Object.keys(local),...Object.keys(remote)])){if(['__proto__','constructor','prototype'].includes(k))throw new Error('Invalid data');const value=merge(base?.[k],local[k],remote[k],path+'.'+k);if(value!==undefined)out[k]=value;}return out;}
 if([base,local,remote].every(Array.isArray)){
  const key=x=>object(x)&&x.id!=null?'id:'+x.id:object(x)&&x.ts!=null?'event:'+x.ts+':'+x.action:null;
  if([...base,...local,...remote].every(x=>key(x)!==null)){
   const maps=[base,local,remote].map(a=>new Map(a.map(x=>[key(x),x])));if([base,local,remote].some((a,i)=>a.length!==maps[i].size))throw new Conflict(path);
   const out=[];for(const k of new Set([...remote.map(key),...local.map(key),...base.map(key)])){const value=merge(maps[0].get(k),maps[1].get(k),maps[2].get(k),path+'['+k+']');if(value!==undefined)out.push(value);}return out;
  }
 }throw new Conflict(path);
}
function business(data){const value=copy(data);if(value)for(const k of ['_format','_revision','_receipts'])delete value[k];return value;}
class Store{
 constructor({client,storage,userId,normalize=x=>x,onState=()=>{},onData=()=>{}}){Object.assign(this,{client,storage,userId,normalize,onState,onData});this.stopped=false;this.busy=false;this.base=undefined;this.current=undefined;this.lastError=null;}
 bounded(query){return typeof query.abortSignal==='function'&&typeof AbortSignal!=='undefined'&&typeof AbortSignal.timeout==='function'?query.abortSignal(AbortSignal.timeout(12000)):query;}
 async remote(){const q=this.client.from('hisab_users').select('data,updated_at').eq('id',this.userId);const r=await this.bounded(q).maybeSingle();if(r.error)throw r.error;return r.data?{data:this.normalize(r.data.data),version:r.data.updated_at,exists:true}:{data:undefined,version:null,exists:false};}
 async load(){
  const remote=await this.remote();if(this.stopped)throw new Error('Session ended');
  this.base=copy(remote.data);this.current=copy(remote.data||{});this.onState('synced');return copy(this.current);
 }

 async save(data,operationId){
  if(this.stopped||this.busy)return false;this.busy=true;this.lastError=null;this.onState('saving');
  try{
   if(typeof navigator!=='undefined'&&navigator.onLine===false)throw new Error('Offline');
   for(let i=0;i<3;i++){
    const remote=await this.remote();if(this.stopped)throw new Error('Session ended');
    // A lost response may hide a successful write. Retrying this operation must not apply it twice.
    if(operationId&&remote.data?._receipts?.includes(operationId)){this.accept(remote.data);return true;}
    const base=!remote.exists&&this.base&&Object.keys(this.base).length===0?undefined:this.base;
    const next=merge(business(base),business(data),business(remote.data));
    next._format=3;next._revision=(remote.data?._revision||0)+1;next._receipts=[...(remote.data?._receipts||[]),...(operationId?[operationId]:[])].slice(-100);
    const updated_at=new Date(Math.max(Date.now(),Date.parse(remote.version||0)+1||0)).toISOString();let result;
    if(remote.exists){let q=this.client.from('hisab_users').update({data:next,updated_at}).eq('id',this.userId);q=remote.version==null?q.is('updated_at',null):q.eq('updated_at',remote.version);result=await this.bounded(q).select('id');}
    else result=await this.bounded(this.client.from('hisab_users').insert({id:this.userId,data:next,updated_at})).select('id');
    if(result.error){if(result.error.code==='23505')continue;throw result.error;}
    if(!result.data?.length){if(remote.exists)continue;throw new Error('Save was not acknowledged');}
    if(this.stopped)throw new Error('Session ended');this.accept(next);return true;
   }throw new Conflict('account');
  }catch(error){this.lastError=error;this.onState('failed',error);return false;}finally{this.busy=false;}
 }
 accept(data){this.base=copy(data);this.current=copy(data);this.onData(copy(data));this.onState('synced');}
 stop(){this.stopped=true;}
}
root.HisabSync={Store,merge,Conflict};if(typeof module!=='undefined'&&module.exports)module.exports=root.HisabSync;
})(typeof globalThis!=='undefined'?globalThis:this);
