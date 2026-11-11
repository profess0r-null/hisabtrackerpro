/* Pick up new app shells without reloading a user's in-progress financial form. */
(function(){
 'use strict';
 if(!('serviceWorker' in navigator))return;
 const release='6.28',reloadKey='ht_release_reload_'+release;
 let hadController=!!navigator.serviceWorker.controller;
 navigator.serviceWorker.addEventListener('controllerchange',()=>{
  if(!hadController){hadController=true;return;}
  const app=document.getElementById('app');
  // Refresh only the locked/sign-in page. Open forms wait for normal navigation.
  if(app&&getComputedStyle(app).display==='none'&&sessionStorage.getItem(reloadKey)!=='1'){
   sessionStorage.setItem(reloadKey,'1');location.reload();
  }
 });
 let registration;
 function checkForUpdate(){
  if(registration)registration.update().catch(()=>{});
 }
 window.addEventListener('load',()=>{
  navigator.serviceWorker.register('sw.js',{updateViaCache:'none'}).then(reg=>{registration=reg;checkForUpdate();}).catch(()=>{});
 },{once:true});
 window.addEventListener('online',checkForUpdate);
 document.addEventListener('visibilitychange',()=>{if(document.visibilityState==='visible')checkForUpdate();});
})();
