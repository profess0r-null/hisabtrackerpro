/* Pick up new app shells without reloading a user's in-progress financial form. */
(function(){
 'use strict';
 if(!('serviceWorker' in navigator))return;
 const release='6.22',reloadKey='ht_release_reload_'+release;
 let hadController=!!navigator.serviceWorker.controller;
 navigator.serviceWorker.addEventListener('controllerchange',()=>{
  if(!hadController){hadController=true;return;}
  const app=document.getElementById('app');
  // Refresh only the locked/sign-in page. Open forms wait for normal navigation.
  if(app&&getComputedStyle(app).display==='none'&&sessionStorage.getItem(reloadKey)!=='1'){
   sessionStorage.setItem(reloadKey,'1');location.reload();
  }
 });
 window.addEventListener('load',()=>{
  navigator.serviceWorker.register('sw.js',{updateViaCache:'none'}).then(reg=>reg.update()).catch(()=>{});
 },{once:true});
})();
