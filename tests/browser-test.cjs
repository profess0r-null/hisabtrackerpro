const http=require('node:http'),fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const {chromium}=require('playwright-core');
let saveDelay=0;
const folder=path.resolve(__dirname,'..'),host='http://127.0.0.1:8765';
const person=(id,name)=>({id,name,original:100,remaining:100,history:[{id:id+100,t:'add',amt:100,note:'Entry',date:Date.now()}]});
let row={id:'audit',updated_at:'2026-11-08T00:00:00.000Z',data:{profiles:[{id:'default',name:'ব্যক্তিগত',icon:'👤',isDefault:true}],profilesData:{default:{receive:[person(1,'Test Receivable')],give:[person(2,'Test Payable')],activityLog:[],categories:{}}},_cash:{profilesData:{default:{balance:1000,wallets:{cash:700,bank:300,bkash:0,nagad:0},history:[],budget:0,monthlyBudgets:{}}}}}};
const mock=`window.supabase={createClient(){const callbacks=[];const user={id:'audit',email:'audit@example.test'};const session=()=>localStorage.getItem('test_session')?{user}:null;return{auth:{onAuthStateChange(cb){callbacks.push(cb);setTimeout(()=>cb('INITIAL_SESSION',session()),0)},async signInWithPassword(){localStorage.setItem('test_session','1');callbacks.forEach(cb=>cb('SIGNED_IN',{user}));return{data:{session:{user}},error:null}},async signUp(){return this.signInWithPassword()},async signOut(){localStorage.removeItem('test_session');callbacks.forEach(cb=>cb('SIGNED_OUT',null));return{error:null}},async updateUser(){return{error:null}},async resetPasswordForEmail(){return{error:{message:'Test reset unavailable'}}}},from(table){let action='get',payload,filters={};let q={select(){if(action!=='get')return exec();return q},eq(k,v){filters[k]=v;return q},is(k,v){filters[k]=v;return q},maybeSingle(){return exec()},insert(value){action='insert';payload=value;return q},update(value){action='update';payload=value;return q},then(a,b){return exec().then(a,b)}};async function exec(){try{return await fetch('/__test/db',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({table,action,payload,filters})}).then(r=>r.json())}catch(e){return{data:null,error:{message:'Offline'}}}}return q}}}};`;
const mime={'.html':'text/html; charset=utf-8','.js':'application/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.json':'application/json','.png':'image/png'};
const server=http.createServer(async(req,res)=>{
 const url=new URL(req.url,host);
 if(url.pathname==='/__test/db'){
  let body='';for await(const part of req)body+=part;const q=JSON.parse(body);if(q.action==='update'&&saveDelay)await new Promise(resolve=>setTimeout(resolve,saveDelay));let value;
  if(q.table==='visits')value={data:[],error:null};else if(q.table==='hisab_cash')value={data:null,error:null};else if(q.action==='get')value={data:row,error:null};else if(q.action==='update'&&q.filters.updated_at!==row.updated_at)value={data:[],error:null};else{row={...row,...q.payload};value={data:[{id:'audit'}],error:null};}
  res.setHeader('Content-Type','application/json');res.end(JSON.stringify(value));return;
 }
 if(url.pathname==='/hisabtracker/vendor/supabase.min.js'){res.setHeader('Content-Type','application/javascript');res.end(mock);return;}
 let rel=decodeURIComponent(url.pathname).replace(/^\/hisabtracker\//,'');if(!rel)rel='index.html';const file=path.resolve(folder,rel);
 if(!file.startsWith(folder+path.sep)){res.writeHead(403);res.end();return;}
 try{const bytes=fs.readFileSync(file);res.setHeader('Content-Type',mime[path.extname(file)]||'application/octet-stream');res.end(bytes);}catch(e){res.writeHead(404);res.end();}
});
(async()=>{await new Promise(r=>server.listen(8765,'127.0.0.1',r));const browser=await chromium.launch({executablePath:process.env.HISAB_CHROME_PATH||'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true});const context=await browser.newContext({viewport:{width:390,height:844}});const page=await context.newPage();const errors=[];page.on('pageerror',e=>errors.push(e.message));
 try{
  await page.goto(host+'/hisabtracker/');await page.locator('#au-email').fill('audit@example.test');await page.locator('#au-pass').fill('test-password');await page.locator('#au-btn').click();await page.locator('#pin-screen').waitFor({state:'visible'});
  for(const digit of '1234')await page.locator(`[onclick="pinKey('${digit}')"]`).click();
  await page.locator('#app').waitFor({state:'visible'});await page.waitForFunction(()=>!appLoading);await page.evaluate(()=>navigator.serviceWorker.ready);await page.reload();await page.waitForFunction(()=>!appLoading&&CUR_USER&&document.getElementById('app').style.display==='block');
  console.log('PASS login, PIN and reload');
  async function add(type,id){await page.evaluate(({type,id})=>{sliderSwitch(type==='receive'?'r':'g');const card=document.querySelector('#card-'+id+' .pt');card.click();},{type,id});await page.locator(`[onclick="openAddMore('${type}',${id})"]`).click();await page.locator('#aa').fill('50');await page.locator('#m-add [onclick="confirmAddMore()"] ').click();}
  saveDelay=700;
  await add('receive',1);
  await page.waitForFunction(()=>savingChange);
  assert.equal(await page.evaluate(()=>DB.receive[0].remaining),100);
  assert.equal(await page.locator('#aa').inputValue(),'50');
  assert.equal(await page.locator('#m-add [onclick="confirmAddMore()"]').isDisabled(),true);
  assert.equal(await page.locator('#m-add').isVisible(),true);
  await page.waitForFunction(()=>!savingChange&&DB.receive[0].remaining===150);
  assert.equal(await page.locator('#m-add').isVisible(),false);
  assert.equal(row.data.profilesData.default.receive[0].remaining,150);
  console.log('PASS delayed save: old amount and open form until database acknowledgment');
  saveDelay=0;await page.reload();await page.waitForFunction(()=>typeof DB!=='undefined'&&DB.receive[0]?.remaining===150&&!appLoading);
  console.log('PASS confirmed receivable survives reload');
  await add('give',2);await page.waitForFunction(()=>!savingChange&&DB.give[0].remaining===150);
  console.log('PASS payable uses the same confirmed-save flow');
  await context.setOffline(true);await add('give',2);
  await page.waitForFunction(()=>!savingChange&&document.querySelector('.form-save-notice'));
  assert.equal(await page.evaluate(()=>DB.give[0].remaining),150);
  assert.equal(await page.locator('#aa').inputValue(),'50');assert.equal(await page.locator('#m-add').isVisible(),true);
  assert.match(await page.locator('.form-save-notice').textContent(),/সেভ হয়নি/);
  assert.equal(await page.locator('#m-add [onclick="confirmAddMore()"]').isDisabled(),false);
  console.log('PASS offline: no amount change, form preserved, explicit retry available');
  await context.setOffline(false);await page.waitForTimeout(250);
  assert.equal(row.data.profilesData.default.give[0].remaining,150);
  console.log('PASS reconnect does not auto-save the failed form');
  await page.locator('.form-save-notice button').click();await page.waitForFunction(()=>!savingChange&&DB.give[0].remaining===200);
  assert.equal(row.data.profilesData.default.give[0].history.filter(h=>h.amt===50).length,2);
  await page.reload();await page.waitForFunction(()=>typeof DB!=='undefined'&&DB.give[0]?.remaining===200&&!appLoading);
  assert.equal(await page.locator('#save-status,.save-conflict-actions').count(),0);
  console.log('PASS explicit retry saves once; copy-choice panel removed');
  await page.evaluate(()=>sliderSwitch('r'));await page.screenshot({path:folder+'/mobile-hisab-online.png',fullPage:true});
  await page.evaluate(()=>setAppTab('cash'));await page.screenshot({path:folder+'/mobile-cash-online.png',fullPage:true});
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);assert.deepEqual(errors,[]);
  console.log('PASS mobile layout and no browser JavaScript errors');
 }finally{await browser.close();await new Promise(r=>server.close(r));}
})().catch(error=>{console.error(error);process.exitCode=1;server.close();});
