import {initializeApp} from "https://www.gstatic.com/firebasejs/11.6.1/firebase-app.js";
import {getAuth,signInWithEmailAndPassword,signInAnonymously,onAuthStateChanged,signOut,reload,updatePassword} from "https://www.gstatic.com/firebasejs/11.6.1/firebase-auth.js";
import {getFirestore,initializeFirestore,persistentLocalCache,persistentSingleTabManager,doc,getDoc,runTransaction,onSnapshot,deleteDoc} from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";
const firebaseConfig={ apiKey: "AIzaSyDZ8aehJD-hBJRPwEWOeKX-Jag7pysaERU", authDomain: "arjs-bd.firebaseapp.com", projectId: "arjs-bd", storageBucket: "arjs-bd.firebasestorage.app", messagingSenderId: "523640451117", appId: "1:523640451117:web:33a970c5d8aac3ea1ec8a4" };
const appId='default-samiti-app-id';
const app=initializeApp(firebaseConfig),auth=getAuth(app);
let db;
try{
  // Keep Firestore data in the browser cache so the UI can open/use recent data
  // immediately even when the network is slow. Realtime sync continues in background.
  db=initializeFirestore(app,{localCache:persistentLocalCache({tabManager:persistentSingleTabManager()})});
}catch(cacheErr){
  console.warn('Persistent Firestore cache unavailable; using normal Firestore.',cacheErr);
  db=getFirestore(app);
}
const mainRef=doc(db,'artifacts',appId,'public-data','main');
// Fast startup cache: keep the last successfully received app state in IndexedDB.
// Firestore remains the source of truth; this cache is only for instant first paint.
const APP_CACHE_DB='arjs-browser-state-v1',APP_CACHE_STORE='state',APP_CACHE_KEY='public-main-v1';
let appCacheDbPromise=null,lastStateFingerprint='';
function openAppCache(){
  if(!('indexedDB' in window))return Promise.resolve(null);
  if(!appCacheDbPromise)appCacheDbPromise=new Promise(resolve=>{
    try{
      const req=indexedDB.open(APP_CACHE_DB,1);
      req.onupgradeneeded=()=>{if(!req.result.objectStoreNames.contains(APP_CACHE_STORE))req.result.createObjectStore(APP_CACHE_STORE)};
      req.onsuccess=()=>resolve(req.result);
      req.onerror=()=>resolve(null);
      req.onblocked=()=>resolve(null);
    }catch(e){resolve(null)}
  });
  return appCacheDbPromise;
}
async function readAppCache(){
  const idb=await openAppCache();if(!idb)return null;
  return new Promise(resolve=>{try{const tx=idb.transaction(APP_CACHE_STORE,'readonly'),req=tx.objectStore(APP_CACHE_STORE).get(APP_CACHE_KEY);req.onsuccess=()=>resolve(req.result||null);req.onerror=()=>resolve(null)}catch(e){resolve(null)}});
}
async function writeAppCache(state){
  const idb=await openAppCache();if(!idb)return;
  try{const tx=idb.transaction(APP_CACHE_STORE,'readwrite');tx.objectStore(APP_CACHE_STORE).put(state,APP_CACHE_KEY)}catch(e){console.warn('Local app cache write skipped:',e)}
}
const DEFAULT_NOTICE={title:'',text:'',imageUrls:[],linkText:'',linkUrl:'',scrollingText:''};const DEFAULT_BRAND={name:'ARJS BD',tagline:'★ বিশ্বাস ★ মানবিকতা ★ উন্নয়ন ★',established:'২০২৬',logoUrl:''};
let S={members:[],investments:[],profitEntries:[],bankUpdates:[],bankLedger:[],expenses:[],incomeEntries:[],governanceFiles:[],activityLog:[],notifications:[],notice:{...DEFAULT_NOTICE},brand:{...DEFAULT_BRAND}};let unsub=null,pendingProfit=null;
const $=id=>document.getElementById(id),today=()=>new Date().toISOString().slice(0,10),uid=p=>p+Date.now()+Math.random().toString(36).slice(2,7);const money=n=>'৳ '+Number(n||0).toLocaleString('bn-BD',{minimumFractionDigits:2,maximumFractionDigits:2});const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[c]));
function toast(msg,error=false){const t=$('toast');t.textContent=msg;t.className='fixed bottom-5 left-1/2 -translate-x-1/2 z-[200] px-4 py-3 rounded-xl text-white shadow-xl max-w-[90vw] text-sm font-semibold '+(error?'bg-red-600':'bg-emerald-600');t.classList.remove('hidden');clearTimeout(toast.timer);toast.timer=setTimeout(()=>t.classList.add('hidden'),3500)}
function positive(v,label){const n=Number(v);if(!Number.isFinite(n)||n<=0)throw Error(label+' সঠিকভাবে দিন');return n}
function active(m){return m.status!==undefined?m.status==='active':m.isActive!==false}function statusText(m){return active(m)?'সচল':'নিষ্ক্রিয়'}
function photo(m,size=64){return m.photoUrl||m.photoURL||`https://placehold.co/${size}x${size}/EEF2FF/4338CA?text=${encodeURIComponent((m.name||'?').trim().charAt(0)||'?')}`}
function norm(d){return {members:Array.isArray(d.members)?d.members:[],investments:Array.isArray(d.investments)?d.investments:[],profitEntries:Array.isArray(d.profitEntries)?d.profitEntries:[],bankUpdates:Array.isArray(d.bankUpdates)?d.bankUpdates:[],bankLedger:Array.isArray(d.bankLedger)?d.bankLedger:[],expenses:Array.isArray(d.expenses)?d.expenses:[],incomeEntries:Array.isArray(d.incomeEntries)?d.incomeEntries:[],governanceFiles:Array.isArray(d.governanceFiles)?d.governanceFiles:[],activityLog:Array.isArray(d.activityLog)?d.activityLog:[],notifications:Array.isArray(d.notifications)?d.notifications:[],donationDisbursements:Array.isArray(d.donationDisbursements)?d.donationDisbursements:[],netDividendLoans:Array.isArray(d.netDividendLoans)?d.netDividendLoans:[],loanRepayments:Array.isArray(d.loanRepayments)?d.loanRepayments:[],notice:{...DEFAULT_NOTICE,...(d.notice||{})},brand:{...DEFAULT_BRAND,...(d.brand||{})}}}
function availableSavings(m){return (m.transactions||[]).reduce((s,t)=>s+(t.type==='deposit'?Number(t.amount||0):t.type==='bank_deposit'?-Number(t.amount||0):0),0)}
function totalSavings(){return S.members.reduce((s,m)=>s+availableSavings(m),0)}
function investmentStatus(i){if(i.status==='complete')return ['complete','সমাপ্ত'];const end=i.endDate||'';if(end&&end<today())return ['matured','ম্যাচিউর'];return ['running','চলমান']}
function currentBank(){if(S.bankLedger.length)return Number(S.bankLedger[S.bankLedger.length-1].balanceAfter||0);return S.bankUpdates.length?Number(S.bankUpdates[S.bankUpdates.length-1].balance||0):0}
function addNotif(s,type,message,important=true){s.notifications=[{id:uid('N'),at:new Date().toISOString(),type,message,read:false,important},...(s.notifications||[])].slice(0,200)}
function setFirebaseSyncStatus(state,text,spinning=false){
  const el=$('firebaseSyncStatus'),label=$('firebaseSyncText'),spin=$('firebaseSyncSpinner');
  if(!el)return;
  el.dataset.state=state||'idle';
  if(label)label.textContent=text||'ডেটা সিঙ্ক প্রস্তুত';
  if(spin)spin.classList.toggle('hiddenx',!spinning);
}
function showOperationLoading(text='অপেক্ষা করুন...'){
  const el=$('operationLoader');if(!el)return;
  $('operationLoaderText').textContent=text;el.classList.remove('hiddenx');el.classList.add('flex')
}
function hideOperationLoading(){
  const el=$('operationLoader');if(!el)return;
  el.classList.add('hiddenx');el.classList.remove('flex')
}
// Saving is deliberately non-blocking: no full-screen overlay is shown for Firestore sync.
// The user can keep navigating, typing and opening other sections while Firebase works.
async function save(mutator){
  if(window.__READ_ONLY__) throw Error('READ_ONLY_MODE');
  setFirebaseSyncStatus('syncing','ডেটা সিঙ্ক হচ্ছে…',true);
  try{
    const result=await runTransaction(db,async tx=>{
      const snap=await tx.get(mainRef);
      const cur=norm(snap.exists()?snap.data():{});
      mutator(cur);
      tx.set(mainRef,cur,{merge:false});
      return cur
    });
    S=norm(result);
    lastStateFingerprint=JSON.stringify(S);
    void writeAppCache(S);
    scheduleRender();
    setFirebaseSyncStatus('synced','সিঙ্ক সম্পন্ন',false);
    return result;
  }catch(err){
    setFirebaseSyncStatus(navigator.onLine===false?'offline':'error',
      navigator.onLine===false?'অফলাইন — আবার অনলাইনে সিঙ্ক হবে':'সিঙ্ক ব্যর্থ — আবার চেষ্টা করুন',false);
    throw err;
  }
}
function bankAppend(s,delta,type,description,source,reference=''){const prev=s.bankLedger?.length?Number(s.bankLedger[s.bankLedger.length-1].balanceAfter||0):(s.bankUpdates?.length?Number(s.bankUpdates[s.bankUpdates.length-1].balance||0):0);const balanceAfter=prev+Number(delta);if(balanceAfter<0)throw Error('এই লেনদেন করলে ব্যাংক ব্যালেন্স ঋণাত্মক হবে');s.bankLedger=[...(s.bankLedger||[]),{id:uid('BL'),at:new Date().toISOString(),amount:Number(delta),balanceAfter,type,description,source,reference}]}
const IMGBB_API_KEY='eb707133199bb2befb17b86ec8abb279';
let avifEncoderPromise=null;
async function getAVIFEncoder(){
  if(!avifEncoderPromise){
    avifEncoderPromise=import('https://esm.sh/@jsquash/avif@2.1.1').catch(err=>{avifEncoderPromise=null;throw err});
  }
  return avifEncoderPromise;
}
async function fileToImageData(file){
  if(!file) throw Error('ইমেজ নির্বাচন করুন');
  const maxSide=4096;
  if(typeof createImageBitmap==='function'){
    try{
      const bitmap=await createImageBitmap(file);
      try{
        const scale=Math.min(1,maxSide/Math.max(bitmap.width,bitmap.height));
        const canvas=document.createElement('canvas');canvas.width=Math.max(1,Math.round(bitmap.width*scale));canvas.height=Math.max(1,Math.round(bitmap.height*scale));
        const ctx=canvas.getContext('2d',{alpha:true});ctx.drawImage(bitmap,0,0,canvas.width,canvas.height);
        return ctx.getImageData(0,0,canvas.width,canvas.height);
      }finally{bitmap.close();}
    }catch(_){}
  }
  return await new Promise((resolve,reject)=>{
    const url=URL.createObjectURL(file),img=new Image();
    img.onload=()=>{try{const scale=Math.min(1,maxSide/Math.max(img.naturalWidth,img.naturalHeight));const canvas=document.createElement('canvas');canvas.width=Math.max(1,Math.round(img.naturalWidth*scale));canvas.height=Math.max(1,Math.round(img.naturalHeight*scale));const ctx=canvas.getContext('2d',{alpha:true});ctx.drawImage(img,0,0,canvas.width,canvas.height);resolve(ctx.getImageData(0,0,canvas.width,canvas.height));}catch(e){reject(e)}finally{URL.revokeObjectURL(url)}};
    img.onerror=()=>{URL.revokeObjectURL(url);reject(Error('ইমেজটি এই ব্রাউজারে সরাসরি পড়া যাচ্ছে না।'))};img.src=url;
  });
}
async function convertImageToAVIF(file){
  if(!file||!file.type.startsWith('image/')) return file;
  if(file.size>20*1024*1024) throw Error('ইমেজ ২০ MB-এর মধ্যে হতে হবে');
  const base=file.name.replace(/\.[^.]+$/,'').replace(/[^a-zA-Z0-9_-]/g,'_')||'image';
  try{
    const imageData=await fileToImageData(file);
    const {encode}=await getAVIFEncoder();
    const output=await encode(imageData,{quality:60});
    const blob=new Blob([output],{type:'image/avif'});
    if(!blob.size) throw Error('AVIF encoder returned empty data');
    return new File([blob],base+'.avif',{type:'image/avif',lastModified:Date.now()});
  }catch(wasmErr){
    // Native canvas encoder is a compatibility fallback; the WASM encoder above removes the browser AVIF-encoding requirement.
    try{
      const imageData=await fileToImageData(file);const canvas=document.createElement('canvas');canvas.width=imageData.width;canvas.height=imageData.height;canvas.getContext('2d').putImageData(imageData,0,0);
      const blob=await new Promise(r=>canvas.toBlob(r,'image/avif',0.82));
      if(blob&&blob.type==='image/avif') return new File([blob],base+'.avif',{type:'image/avif',lastModified:Date.now()});
    }catch(_){}
    throw Error('AVIF রূপান্তর করা যায়নি। ইন্টারনেট সংযোগ পরীক্ষা করে আবার চেষ্টা করুন।');
  }
}
async function uploadToImgBB(file,showLoader=true){if(!file)return null;if(!file.type.startsWith('image/'))return null;if(showLoader)showOperationLoading('ছবি AVIF করে আপলোড হচ্ছে...');try{const avif=await convertImageToAVIF(file);if(avif.size>10*1024*1024)throw Error('AVIF ইমেজ ১০ MB-এর মধ্যে হতে হবে');const f=new FormData();f.append('key',IMGBB_API_KEY);f.append('image',avif,avif.name);const r=await fetch('https://api.imgbb.com/1/upload',{method:'POST',body:f});const d=await r.json();if(!r.ok||!d.success)throw Error(d.error?.message||'ইমেজ আপলোড ব্যর্থ');return d.data.url}finally{if(showLoader)hideOperationLoading()}}
async function uploadOriginalImageToImgBB(file,showLoader=true){
  if(!file || !file.type || !file.type.startsWith('image/')) throw Error('শুধু ছবি আপলোড করা যাবে');
  if(file.size>20*1024*1024) throw Error('ইমেজ ২০ MB-এর মধ্যে হতে হবে');
  if(showLoader) showOperationLoading('ছবি আপলোড হচ্ছে...');
  try{
    const f=new FormData();
    f.append('key',IMGBB_API_KEY);
    f.append('image',file,file.name);
    const r=await fetch('https://api.imgbb.com/1/upload',{method:'POST',body:f});
    const d=await r.json();
    if(!r.ok||!d.success) throw Error(d.error?.message||'ইমেজ আপলোড ব্যর্থ');
    return d.data.url;
  }finally{if(showLoader)hideOperationLoading()}
}

async function upload(file,folder,showLoader=true){
  if(!file)return null;
  if(!file.type.startsWith('image/')) throw Error('এই অ্যাপে শুধু ছবি আপলোড করা যাবে; Firebase Storage ব্যবহার করা হয় না।');
  return uploadToImgBB(file,showLoader);
}
async function uploadMemberDocuments(files,folder){
  const list=Array.from(files||[]);
  if(!list.length)return [];
  for(const f of list){
    if(!f.type||!f.type.startsWith('image/'))throw Error('সদস্যদের ডকুমেন্টে শুধু ছবি আপলোড করা যাবে');
    if(f.size>20*1024*1024)throw Error('প্রতিটি ছবি ২০ MB-এর মধ্যে হতে হবে');
  }
  showOperationLoading(list.length>1?`${list.length}টি ডকুমেন্ট একসাথে আপলোড হচ্ছে...`:'ডকুমেন্ট আপলোড হচ্ছে...');
  try{
    const results=new Array(list.length);let next=0;
    const worker=async()=>{while(true){const i=next++;if(i>=list.length)return;const f=list[i];const url=await uploadOriginalImageToImgBB(f,false);results[i]={name:f.name,title:f._documentTitle||f.name,url,type:f.type,size:f.size,uploadedAt:new Date().toISOString()};}};
    await Promise.all(Array.from({length:Math.min(3,list.length)},()=>worker()));
    return results.filter(Boolean);
  }finally{hideOperationLoading()}
}
function renderBrand(){const b=S.brand||DEFAULT_BRAND;$('header-tagline').textContent=[b.tagline,b.established?`স্থাপিত: ${b.established}`:'' ].filter(Boolean).join(' • ');$('header-logo').src=b.logoUrl||'https://placehold.co/56x56/EEF2FF/4338CA?text=Logo';$('header-logo').onerror=()=>$('header-logo').src='https://placehold.co/56x56/EEF2FF/4338CA?text=Logo';$('page-title').textContent=(b.name||'সমিতি')}
function renderNotice(){const n=S.notice||DEFAULT_NOTICE;const d=null,home=$('home-notice-content');const date=n.updatedAt?'সর্বশেষ আপডেট: '+new Date(n.updatedAt).toLocaleString('bn-BD'):'';if($('notice-date'))$('notice-date').textContent=date;if($('home-notice-date'))$('home-notice-date').textContent=date;const img=n.imageUrl||((n.imageUrls||[])[0]||'');if(!n.title&&!n.text&&!img){const empty='<div class="text-sm text-slate-400 py-3">আপাতত কোনো নতুন নোটিশ নেই।</div>';if(d)d.innerHTML='<div class="card-soft p-8 text-center text-slate-400">আপাতত কোনো নতুন নোটিশ নেই।</div>';if(home)home.innerHTML=empty;return}const body=`${img?`<img src="${esc(img)}" class="w-full max-h-72 object-cover rounded-2xl border mb-4" onerror="this.remove()">`:''}<div><h4 class="font-extrabold text-lg">${esc(n.title||'অফিসিয়াল নোটিশ')}</h4>${n.text?`<p class="whitespace-pre-line text-sm leading-7 text-slate-600 mt-2">${esc(n.text)}</p>`:''}</div>`;if(d)d.innerHTML=body;if(home)home.innerHTML=body}

function fundBalances(){
 const donationCredits=S.profitEntries.reduce((a,p)=>a+Number(p.donationAmount??(p.fundSplitVersion==='2-98'?Number(p.totalProfit||0)*0.02:0)),0);
 const netCredits=S.profitEntries.reduce((a,p)=>a+Number(p.netDividendAmount??(p.fundSplitVersion==='2-98'?Number(p.totalProfit||0)*0.98:0)),0);
 const donationPaid=(S.donationDisbursements||[]).reduce((a,x)=>a+Number(x.amount||0),0);
 const netPaid=(S.netDividendLoans||[]).reduce((a,x)=>a+Number(x.amount||0),0);
 return {donation:Math.max(0,donationCredits-donationPaid),netDividend:Math.max(0,netCredits-netPaid),donationCredits,netCredits,donationPaid,netPaid};
}
function renderStats(){
 const inv=S.investments.reduce((s,i)=>s+Number(i.amount||0),0),profit=S.profitEntries.reduce((s,p)=>s+Number(p.totalProfit||0),0),fund=fundBalances();
 $('statMembers').textContent=S.members.length.toLocaleString('bn-BD');
 $('statSavings').textContent=money(totalSavings());
 $('statBank').textContent=money(currentBank());
 $('statInvestment').textContent=money(inv);
 $('statProfit').textContent=money(profit);
 $('statDonationFund').textContent=money(fund.donation);
 $('statNetDividendFund').textContent=money(fund.netDividend);
 $('financeBankMini').textContent=money(currentBank());
 $('investmentTotalMini').textContent=money(inv);
}
function renderMembers(){const q=($('memberSearch').value||'').toLowerCase().trim(),f=$('memberStatusFilter').value;const arr=S.members.filter(m=>(f==='all'||(active(m)?'active':'inactive')===f)&&[m.id,m.name,m.phone,m.nid,m.cardNumber,m.employeeId,m.email].some(v=>String(v||'').toLowerCase().includes(q)));$('memberEmpty').classList.toggle('hiddenx',arr.length>0);$('memberCards').innerHTML=arr.map(m=>{const sv=availableSavings(m),tx=(m.transactions||[]).length,docs=(m.documents||[]).length;const dutyName=(m.responsibilities||[]).find(r=>r.status!=='cancelled')?.title||m.designation||'';return `<div class="card p-4 clickable" data-profile="${esc(m.id)}"><div class="flex items-start gap-4"><div class="w-24 h-24 sm:w-28 sm:h-28 shrink-0 rounded-full overflow-hidden flex items-center justify-center shadow-lg"><img class="member-avatar w-full h-full object-contain cursor-zoom-in" src="${esc(photo(m,112))}" data-member-image="${esc(photo(m,112))}" data-member-id="${esc(m.id)}" data-member-image-type="profile" alt="${esc(m.name||'সদস্যের ছবি')}" onerror="this.src='https://placehold.co/112x112/EEF2FF/4338CA?text=?'"></div><div class="min-w-0 flex-1"><div class="flex items-start justify-between gap-2"><div><h3 class="font-extrabold text-lg truncate">${esc(m.name||'নাম নেই')}${dutyName?` <span class="text-indigo-600 font-bold">(${esc(dutyName)})</span>`:''}</h3><p class="text-xs text-slate-500">ID: ${esc(m.id)} · ${esc(m.phone||'—')}</p></div><span class="status ${active(m)?'status-active':'status-inactive'}">● ${statusText(m)}</span></div><div class="grid grid-cols-3 gap-2 mt-4"><div class="card-soft p-2"><div class="text-[10px] text-slate-500">উপলভ্য সঞ্চয়</div><b class="text-sm text-emerald-700">${money(sv)}</b></div><div class="card-soft p-2"><div class="text-[10px] text-slate-500">লেনদেন</div><b class="text-sm">${tx.toLocaleString('bn-BD')}</b></div><div class="card-soft p-2"><div class="text-[10px] text-slate-500">ডকুমেন্ট</div><b class="text-sm">${docs.toLocaleString('bn-BD')}</b></div></div></div></div><div class="mt-3 pt-3 border-t flex items-center justify-between text-xs text-slate-500"><span>${m.cardNumber?'কার্ড: '+esc(m.cardNumber):'কার্ড নম্বর নেই'}</span><span class="text-indigo-600 font-bold">পূর্ণ প্রোফাইল →</span></div></div>`}).join('')}
function memberOptions(){return '<option value="">সদস্য নির্বাচন করুন</option>'+S.members.map(m=>{const img=photo(m,40);return `<option value="${esc(m.id)}" data-img="${esc(img)}" data-sub="${esc(m.id)} · ${esc(m.phone||'মোবাইল নেই')}">${esc(m.name)}</option>`}).join('')}
function renderFinance(){
 const rows=[];
 const push=(date,txt,amount,kind,bank=null,source='',ref='')=>rows.push({date:date||'',txt,amount:Number(amount||0),kind,bank,source,ref});
 S.bankLedger.forEach(x=>push(x.at?.slice(0,10)||'',x.description,x.amount,x.type,x.balanceAfter,x.source||'bank',x.reference||''));
 S.members.forEach(m=>(m.transactions||[]).forEach(t=>push(t.date,`${m.name} — ${t.type==='deposit'?'সঞ্চয়':t.type==='bank_deposit'?'ব্যাংকে সঞ্চয় জমা':t.type==='due'?'বকেয়া':t.type==='penalty'?'জরিমানা':t.type}`,t.type==='bank_deposit'?-Number(t.amount||0):Number(t.amount||0),t.type,null,'member',t.reference||'')));
 S.incomeEntries.forEach(e=>push(e.date,'আয় — '+e.title,e.amount,'income',null,'income',e.reference||''));
 S.expenses.forEach(e=>push(e.date,'ব্যয় — '+e.title,-Number(e.amount||0),'expense',null,'expense',''));
 S.investments.forEach(i=>{if(i.financialApplied)push(i.startDate,'ইনভেস্টমেন্ট — '+i.title,-Number(i.amount||0),'investment',null,'investment',i.id)});
 S.profitEntries.forEach(p=>{push(p.date,'মুনাফা — '+(S.investments.find(i=>i.id===p.investmentId)?.title||'Investment'),p.bankDeposited?Number(p.totalProfit||0):0,'profit',null,'profit',p.reference||'')});
 S.bankUpdates.forEach(b=>push(b.date,'ব্যাংক ব্যালেন্স সমন্বয়',0,'bank_update',b.balance,'bank_update'));
 rows.sort((a,b)=>String(b.date).localeCompare(String(a.date))||String(b.txt).localeCompare(String(a.txt)));
 const month=$('ledgerMonth')?.value||'';
 const filtered=month?rows.filter(x=>String(x.date).slice(0,7)===month):rows;
 $('ledgerSummary').textContent=`মোট ${filtered.length.toLocaleString('bn-BD')}টি লেনদেন${month?' · নির্বাচিত মাস: '+month:''}`;
 $('financeRows').innerHTML=filtered.map(x=>`<div class="card-soft p-3 flex items-center justify-between gap-3"><div class="min-w-0"><div class="font-semibold truncate">${esc(x.txt)}</div><div class="text-[11px] text-slate-500">${esc(x.date)} · ${esc(x.kind)}${x.source?' · '+esc(x.source):''}${x.ref?' · '+esc(x.ref):''}</div></div><div class="text-right shrink-0"><b class="${Number(x.amount)<0?'text-red-600':Number(x.amount)>0?'text-emerald-600':'text-slate-500'}">${Number(x.amount)>0?'+ ':Number(x.amount)<0?'− ':''}${Number(x.amount)!==0?money(Math.abs(x.amount)):'—'}</b>${x.bank!==null?`<div class="text-[10px] text-slate-500">ব্যাংক ব্যালেন্স: ${money(x.bank)}</div>`:''}</div></div>`).join('')||'<div class="text-center text-slate-400 py-8">এই মাসে কোনো লেনদেন নেই।</div>';
 renderMemberSavingsChart();
 renderFundDashboard();
}
function renderMemberSavingsChart(){
 const el=$('memberSavingsBars'),totalEl=$('memberSavingsChartTotal');if(!el)return;
 /* Only active members are included; savings are calculated directly from Firebase member transactions. */
 const data=S.members.filter(active).map(m=>({id:m.id,name:m.name||'নাম নেই',value:Math.max(0,availableSavings(m))})).sort((a,b)=>b.value-a.value);
 const total=data.reduce((a,x)=>a+x.value,0),max=Math.max(1,...data.map(x=>x.value));
 if(totalEl)totalEl.textContent=`মোট ${money(total)} · ${data.length.toLocaleString('bn-BD')} জন সক্রিয় সদস্য`;
 if(!data.length){el.innerHTML='<div class="member-savings-empty">কোনো সক্রিয় সদস্যের সঞ্চয়ের তথ্য পাওয়া যায়নি।</div>';return}
 el.innerHTML=data.map(x=>{
   const pct=x.value>0?Math.max(2,(x.value/max)*100):0;
   return `<div class="member-savings-row" role="button" tabindex="0" data-savings-profile="${esc(x.id)}" title="${esc(x.name)} — ${esc(money(x.value))} · প্রোফাইল খুলুন">
     <div class="member-savings-name" title="${esc(x.name)}">👤 ${esc(x.name)}</div>
     <div class="member-savings-track" aria-label="${esc(x.name)}: ${esc(money(x.value))}"><div class="member-savings-bar" style="width:${pct}%"></div></div>
     <div class="member-savings-value">${money(x.value)}</div>
   </div>`;
 }).join('');
 bindMemberSavingsChartClicks();
}
function bindMemberSavingsChartClicks(){
 const el=$('memberSavingsBars');if(!el||el.dataset.bound==='1')return;
 el.dataset.bound='1';
 const open=e=>{const row=e.target.closest('[data-savings-profile]');if(row)openProfile(row.dataset.savingsProfile)};
 el.addEventListener('click',open);
 el.addEventListener('keydown',e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();open(e)}});
}
function renderFundDashboard(){
 const el=$('fundDashboard');if(!el)return;
 const savings=S.members.reduce((a,m)=>a+availableSavings(m),0), bank=currentBank(), income=S.incomeEntries.reduce((a,x)=>a+Number(x.amount||0),0), expense=S.expenses.reduce((a,x)=>a+Number(x.amount||0),0), investment=S.investments.filter(x=>x.status!=='complete').reduce((a,x)=>a+Number(x.amount||0),0), profit=S.profitEntries.reduce((a,x)=>a+Number(x.totalProfit||0),0);
 el.innerHTML=`<div class="fund-dashboard-grid"><div class="fund-chip"><span>👤 সঞ্চয়</span><b>${money(savings)}</b></div><div class="fund-chip"><span>🏦 ব্যাংক</span><b>${money(bank)}</b></div><div class="fund-chip"><span>💵 আয়</span><b>${money(income)}</b></div><div class="fund-chip"><span>💸 ব্যয়</span><b>${money(expense)}</b></div><div class="fund-chip"><span>📈 বিনিয়োগ</span><b>${money(investment)}</b></div><div class="fund-chip"><span>💰 মুনাফা</span><b>${money(profit)}</b></div></div>`;
}

function renderBulkMembers(){$('bulkMemberList').innerHTML=S.members.filter(active).map(m=>`<label class="flex items-center gap-3 p-2 rounded-xl hover:bg-white border border-transparent hover:border-slate-200"><input type="checkbox" class="bulk-member w-5 h-5" value="${esc(m.id)}"><img class="member-avatar w-9 h-9 rounded-lg object-cover" src="${esc(photo(m,36))}"><span class="text-sm font-semibold">${esc(m.name)} <small class="text-slate-400">(${esc(m.id)})</small></span></label>`).join('')||'<div class="text-sm text-slate-400">কোনো active সদস্য নেই।</div>'}
function renderInvestments(){let running=0,matured=0,complete=0;const cards=S.investments.map(i=>{const [code,label]=investmentStatus(i);if(code==='running')running++;else if(code==='matured')matured++;else complete++;return `<div class="card overflow-hidden clickable" data-investment="${esc(i.id)}"><div class="h-36 bg-slate-100 overflow-hidden">${i.imageUrl?`<img src="${esc(i.imageUrl)}" class="w-full h-full object-cover" onerror="this.remove()">`:'<div class="h-full flex items-center justify-center text-5xl">📈</div>'}</div><div class="p-4"><div class="flex items-start justify-between gap-2"><div><h4 class="font-extrabold">${esc(i.title)}</h4><p class="text-xs text-slate-500 mt-1">${esc(i.startDate||'')} → ${esc(i.endDate||i.timeline||'')}</p></div><span class="status status-${code}">${label}</span></div><div class="mt-4 flex items-end justify-between"><div><div class="text-[11px] text-slate-500">বিনিয়োগ</div><b class="text-lg text-violet-700">${money(i.amount)}</b></div><span class="text-xs text-indigo-600 font-bold">বিস্তারিত →</span></div></div></div>`}).join('');$('investmentCards').innerHTML=cards||'<div class="md:col-span-2 xl:col-span-3 text-center text-slate-400 py-8">কোনো বিনিয়োগ নেই।</div>';$('investmentCounts').textContent=`চলমান ${running} · ম্যাচিউর ${matured} · সমাপ্ত ${complete}`;renderProfitRows()}
function renderProfitRows(){$('profitRows').innerHTML=S.profitEntries.slice().reverse().map(p=>{const i=S.investments.find(x=>x.id===p.investmentId);return `<div class="card-soft p-3 flex flex-col sm:flex-row sm:items-center justify-between gap-2"><div><b>${esc(i?.title||'Investment')}</b><div class="text-xs text-slate-500">${esc(p.date||'')} · ${p.allocations?.length||0} সদস্য · ${p.bankDeposited?'ব্যাংকে জমা':'ব্যাংকে জমা হয়নি'}</div></div><b class="text-amber-600">${money(p.totalProfit)}</b></div>`}).join('')||'<div class="text-slate-400 text-center py-6">কোনো লাভের এন্ট্রি নেই।</div>'}
function renderGovernance(){const g=S.governanceFiles.slice().reverse();$('governanceRows').innerHTML=g.map(x=>`<div class="card-soft p-3 flex items-center justify-between gap-3"><div class="min-w-0"><b class="block truncate">${esc(x.title)}</b><p class="text-xs text-slate-500">${esc(x.type)} · ${esc(x.date)}</p></div><a href="${esc(x.url)}" target="_blank" rel="noopener" class="btn btn-soft text-xs">ফাইল দেখুন ↗</a></div>`).join('')||'<div class="text-center text-slate-400 py-6">কোনো গভর্ন্যান্স ফাইল নেই।</div>';$('governanceSummary').innerHTML=`<div class="card-soft p-4"><div class="text-xs text-slate-500">নোটিশ</div><b>${S.notice?.title?esc(S.notice.title):'কোনো সক্রিয় নোটিশ নেই'}</b></div><div class="card-soft p-4"><div class="text-xs text-slate-500">ডকুমেন্ট</div><b>${g.length.toLocaleString('bn-BD')}টি ফাইল</b></div>`}
function renderNotifications(){const unread=S.notifications.filter(n=>!n.read).length;const b=$('notification-badge');b.textContent=unread.toLocaleString('bn-BD');b.classList.toggle('hiddenx',unread===0);$('notificationRows').innerHTML=S.notifications.slice(0,100).map(n=>`<div class="p-3 rounded-xl border ${n.read?'bg-white':'bg-indigo-50 border-indigo-100'}"><div class="flex gap-3 items-start"><div class="w-9 h-9 rounded-lg bg-indigo-100 flex items-center justify-center shrink-0">${n.type==='member'?'👤':n.type==='bank'?'🏦':n.type==='income'?'💵':n.type==='expense'?'💸':n.type==='investment'?'📈':n.type==='profit'?'💰':'🔔'}</div><div class="min-w-0 flex-1"><div class="text-sm font-semibold">${esc(n.message)}</div><div class="text-[11px] text-slate-500 mt-1">${new Date(n.at).toLocaleString('bn-BD')}</div></div></div></div>`).join('')||'<div class="text-center text-slate-400 py-8">কোনো notification নেই।</div>'}

function updateAvailable(){const m=S.members.find(x=>x.id===$('sbMember')?.value);$('sbAvailable').innerHTML='উপলভ্য সঞ্চয়: <b>'+money(m?availableSavings(m):0)+'</b>'}
function openModal(title,body){$('modalTitle').textContent=title;$('modalBody').innerHTML=body;$('modal').classList.remove('hiddenx')}function closeModal(){$('modal').classList.add('hiddenx');$('modalBody').innerHTML=''}
function openEdit(id){
 const m=S.members.find(x=>x.id===id);if(!m)return;
 const docs=m.documents||[];
 openModal('সদস্য সম্পাদনা',`<div class="space-y-4">
 <div class="card-soft p-3"><div class="flex items-center gap-3"><img class="member-avatar w-16 h-16 rounded-2xl object-cover border" src="${esc(photo(m,64))}"><div><b class="text-lg">${esc(m.name||'সদস্য')}</b><div class="text-xs text-slate-500">ID: ${esc(m.id)}</div></div></div></div>
 <div class="flex gap-2 overflow-x-auto border-b pb-2"><button type="button" class="edit-profile-tab active" data-edit-tab="personal">♙ ব্যক্তিগত তথ্য</button><button type="button" class="edit-profile-tab" data-edit-tab="documents">▤ ডকুমেন্ট</button></div>
 <div id="editPersonalPanel" class="edit-profile-panel"><form id="editMemberPersonalForm" class="grid sm:grid-cols-2 gap-3">
 <input id="emName" required value="${esc(m.name||'')}" placeholder="সদস্যের নাম" class="field">
 <input id="emPhone" required inputmode="tel" value="${esc(m.phone||'')}" placeholder="মোবাইল নম্বর" class="field">
 <input id="emEmail" type="email" value="${esc(m.email||'')}" placeholder="ইমেইল" class="field">
 <input id="emNid" value="${esc(m.nid||'')}" placeholder="NID নম্বর" class="field">
 <input id="emEmployeeId" value="${esc(m.employeeId||'')}" placeholder="Employee ID" class="field">
 <input id="emCardNumber" value="${esc(m.cardNumber||'')}" placeholder="Card Number" class="field">
 <input id="emDesignation" value="${esc(m.designation||'')}" placeholder="পদবী" class="field">
 <select id="emStatus" class="field"><option value="active" ${active(m)?'selected':''}>সচল (Active)</option><option value="inactive" ${!active(m)?'selected':''}>নিষ্ক্রিয় (Inactive)</option></select>
 <textarea id="emNominee" rows="3" placeholder="নমিনির তথ্য" class="field sm:col-span-2">${esc(m.nominee||'')}</textarea>
 <textarea id="emNotes" rows="3" placeholder="অতিরিক্ত নোট" class="field sm:col-span-2">${esc(m.notes||'')}</textarea>
 <div class="sm:col-span-2"><label class="text-sm font-bold">সদস্যের নতুন ছবি (ঐচ্ছিক)</label><input id="emPhoto" type="file" accept="image/*" class="field mt-1"></div>
 <button class="btn btn-primary sm:col-span-2">💾 ব্যক্তিগত তথ্য সেভ করুন</button>
 </form></div>
 <div id="editDocumentsPanel" class="edit-profile-panel hiddenx"><div class="card-soft p-3"><div class="flex items-center justify-between gap-2 mb-3"><div><b>বর্তমান ডকুমেন্ট</b><div class="text-xs text-slate-500">নতুন ডকুমেন্ট যোগ করতে নিচের ফাইল নির্বাচন করুন।</div></div></div><div id="editDocsList" class="space-y-2">${docs.map((d,i)=>`<div class="card bg-white p-3 flex items-center justify-between gap-2"><span class="truncate">📎 ${esc(d.title||d.name||('ডকুমেন্ট '+(i+1)))}</span><a href="${esc(d.url)}" target="_blank" rel="noopener" class="btn btn-soft text-xs">দেখুন ↗</a> <button type="button" class="btn bg-red-50 text-red-600 px-3 py-1" onclick="window.deleteMemberDocument('${String(id).replace(/'/g, '&#039;')}', ${i})">ডিলেট</button></div>`).join('')||'<div class="text-sm text-slate-400">কোনো ডকুমেন্ট নেই।</div>'}</div><form id="editDocumentsForm" class="mt-4 space-y-3"><input id="emDocumentTitle" required placeholder="ডকুমেন্টের শিরোনাম (যেমন: NID, সদস্য ফর্ম, চুক্তিপত্র)" class="field"><input id="emDocuments" type="file" multiple accept="image/*" class="field"><p class="text-[11px] text-slate-500">একাধিক ফাইল দিলে একই শিরোনাম ব্যবহার হবে; আলাদা শিরোনাম চাইলে একবারে একটি ফাইল আপলোড করুন।</p><button class="btn btn-primary w-full">📎 ডকুমেন্ট যোগ করুন</button></form></div></div>
 </div>`);
 const editTabs=[...document.querySelectorAll('[data-edit-tab]')];const editPanels={personal:$('editPersonalPanel'),documents:$('editDocumentsPanel')};
 const switchEditTab=name=>{editTabs.forEach(t=>t.classList.toggle('active',t.dataset.editTab===name));Object.entries(editPanels).forEach(([k,p])=>p.classList.toggle('hiddenx',k!==name));};editTabs.forEach(t=>t.onclick=()=>switchEditTab(t.dataset.editTab));switchEditTab('personal');
 $('editMemberPersonalForm').onsubmit=async e=>{e.preventDefault();try{let photoUrl=m.photoUrl||m.photoURL||'';if($('emPhoto').files[0])photoUrl=await uploadToImgBB($('emPhoto').files[0]);await save(s=>{const mm=s.members.find(x=>x.id===id);if(!mm)throw Error('সদস্য পাওয়া যায়নি');Object.assign(mm,{name:$('emName').value.trim(),phone:$('emPhone').value.trim(),email:$('emEmail').value.trim(),nid:$('emNid').value.trim(),employeeId:$('emEmployeeId').value.trim(),cardNumber:$('emCardNumber').value.trim(),designation:$('emDesignation').value.trim(),status:$('emStatus').value,isActive:$('emStatus').value==='active',nominee:$('emNominee').value.trim(),notes:$('emNotes').value.trim(),photoUrl});addNotif(s,'member',mm.name+' এর ব্যক্তিগত তথ্য আপডেট হয়েছে')});toast('ব্যক্তিগত তথ্য আপডেট হয়েছে');closeModal();openProfile(id);setTimeout(()=>{const t=document.querySelector('[data-ptab="personal"]');t?.click()},50)}catch(err){toast(err.message,true)}};
 $('editDocumentsForm').onsubmit=async e=>{e.preventDefault();try{const files=Array.from($('emDocuments').files||[]),title=$('emDocumentTitle').value.trim();if(!files.length)throw Error('কমপক্ষে একটি ডকুমেন্ট নির্বাচন করুন');if(!title)throw Error('ডকুমেন্টের শিরোনাম দিন');if(files.some(f=>!f.type.startsWith('image/')))throw Error('সদস্যদের ডকুমেন্টে শুধু ছবি আপলোড করা যাবে');const added=await uploadMemberDocuments(files,'members/'+id);if(!added.length)throw Error('ডকুমেন্ট আপলোড করা যায়নি');const titled=added.map((d,i)=>({...d,title,name:title+(added.length>1?' — '+(i+1):'')}));await save(s=>{const mm=s.members.find(x=>x.id===id);if(!mm)throw Error('সদস্য পাওয়া যায়নি');mm.documents=[...(mm.documents||[]),...titled];addNotif(s,'member',mm.name+' এর ডকুমেন্ট আপডেট হয়েছে: '+title)});toast('ডকুমেন্ট যোগ হয়েছে');closeModal();openProfile(id);setTimeout(()=>{const t=document.querySelector('[data-ptab="documents"]');t?.click()},50)}catch(err){toast(err.message,true)}};
}

function loanStatus(loan){
 const outstanding=Number(loan.outstanding??(Number(loan.amount||0)-Number(loan.repaidAmount||0)));
 if(outstanding<=0 || loan.status==='repaid') return 'paid';
 if(loan.status==='overdue' || (loan.dueDate && loan.dueDate<today())) return 'overdue';
 return 'running';
}
function loanStatusText(status){
 return status==='paid'?'পরিশোধকৃত ঋণ':status==='overdue'?'বকেয়া ঋণ':'চলমান ঋণ';
}
function loanStatusClass(status){
 return status==='paid'?'status-active':status==='overdue'?'status-inactive':'status-running';
}
function memberLoanStats(memberId){
 const loans=(S.netDividendLoans||[]).filter(x=>x.memberId===memberId);
 const calc=loans.map(x=>({...x,_status:loanStatus(x),_outstanding:Number(x.outstanding??(Number(x.amount||0)-Number(x.repaidAmount||0)))}));
 return {
  loans:calc,
  running:calc.filter(x=>x._status==='running'),
  overdue:calc.filter(x=>x._status==='overdue'),
  paid:calc.filter(x=>x._status==='paid')
 };
}
function openLoansView(mode='running'){
 const all=(S.netDividendLoans||[]).map(x=>({...x,_status:loanStatus(x),_outstanding:Number(x.outstanding??(Number(x.amount||0)-Number(x.repaidAmount||0)))}));
 const counts={running:all.filter(x=>x._status==='running').length,overdue:all.filter(x=>x._status==='overdue').length,paid:all.filter(x=>x._status==='paid').length};
 const filtered=all.filter(x=>x._status===mode);
 const title=mode==='paid'?'পরিশোধকৃত ঋণ':mode==='overdue'?'বকেয়া ঋণ':'চলমান ঋণ';
 openModal('ঋণ — '+title,`
  <div class="grid grid-cols-3 gap-2 mb-4">
   <button type="button" class="btn ${mode==='running'?'btn-primary':'btn-soft'} loan-mode-btn" data-loan-mode="running">চলমান<br><b>${counts.running}</b></button>
   <button type="button" class="btn ${mode==='overdue'?'btn-danger':'btn-soft'} loan-mode-btn" data-loan-mode="overdue">বকেয়া<br><b>${counts.overdue}</b></button>
   <button type="button" class="btn ${mode==='paid'?'btn-success':'btn-soft'} loan-mode-btn" data-loan-mode="paid">পরিশোধকৃত<br><b>${counts.paid}</b></button>
  </div>
  <div class="mb-3 text-sm text-slate-500">${title} — মোট ${filtered.length.toLocaleString('bn-BD')} জন</div>
  <div class="space-y-2">
   ${filtered.map(l=>`<button type="button" class="w-full text-left card-soft p-3 flex items-center gap-3 loan-member-card" data-member-id="${esc(l.memberId)}">
    <img src="${esc(l.memberPhoto||photo(S.members.find(m=>m.id===l.memberId)||{},56))}" class="w-14 h-14 rounded-2xl object-cover bg-slate-100 shrink-0">
    <span class="min-w-0 flex-1"><b class="block truncate">${esc(l.memberName||'সদস্য')}</b><span class="text-xs text-slate-500">${esc(l.repaymentFrequency||'—')} · শেষ তারিখ ${esc(l.dueDate||'—')}</span></span>
    <span class="text-right shrink-0"><b class="block text-cyan-700">${money(l.amount)}</b><span class="status ${loanStatusClass(l._status)}">${loanStatusText(l._status)}</span></span>
   </button>`).join('')||'<div class="text-center py-10 text-slate-400">এই বিভাগে কোনো ঋণ পাওয়া যায়নি।</div>'}
  </div>`);
 document.querySelectorAll('.loan-mode-btn').forEach(b=>b.onclick=()=>{closeModal();openLoansView(b.dataset.loanMode)});
 document.querySelectorAll('.loan-member-card').forEach(b=>b.onclick=()=>{const id=b.dataset.memberId;closeModal();openProfile(id,'loans')});
}
function openProfile(id,focusTab='summary'){
const m=S.members.find(x=>x.id===id);if(!m)return;
const docs=m.documents||[];
const loanStats=memberLoanStats(m.id);
const runningLoanTotal=loanStats.running.reduce((a,x)=>a+Number(x._outstanding||0),0);
const overdueLoanTotal=loanStats.overdue.reduce((a,x)=>a+Number(x._outstanding||0),0);
const paidLoanTotal=loanStats.paid.reduce((a,x)=>a+Number(x.amount||0),0);
const dutyName=(m.responsibilities||[]).find(r=>r.status!=='cancelled')?.title||m.designation||'';
const totalDeposit=(m.transactions||[]).filter(t=>t.type==='deposit').reduce((a,t)=>a+Number(t.amount||0),0);
const dividend=S.profitEntries.reduce((a,p)=>(a+(p.allocations||[]).filter(x=>x.memberId===m.id).reduce((b,x)=>b+Number(x.profit||0),0)),0);
const totalBalance=totalDeposit+dividend;
const getCurrent=()=>S.members.find(x=>x.id===id)||m;
const txLabel=t=>t.type==='deposit'?'সঞ্চয়':t.type==='bank_deposit'?'ব্যাংকে সঞ্চয় জমা':t.type==='due'?'বকেয়া':t.type==='fine'?'জরিমানা':(t.type||'লেনদেন');
const txRows=()=>{const current=getCurrent(),rows=(current.transactions||[]).slice().reverse();return rows.map(t=>`<div class="timeline-item"><span class="timeline-dot"></span><div class="card-soft p-3"><div class="flex justify-between gap-3 items-start"><div class="min-w-0"><b>${esc(txLabel(t))}</b><div class="text-xs text-slate-500 mt-1">${esc(t.date||'')} ${t.reference?'· '+esc(t.reference):''}</div></div><div class="text-right shrink-0"><b class="${t.type==='bank_deposit'?'text-blue-600':t.type==='fine'||t.type==='due'?'text-red-600':'text-emerald-600'}">${money(t.amount)}</b><br><button type="button" class="text-xs mt-2 px-2 py-1 rounded-lg bg-red-50 text-red-600 font-bold hover:bg-red-100 delete-member-tx" data-txid="${esc(t.id||'')}">🗑️ ডিলেট</button></div></div></div></div>`).join('')||'<div class="text-sm text-slate-400 text-center py-8">কোনো লেনদেন নেই।</div>';return rows};
const profitHistory=S.profitEntries.flatMap(p=>(p.allocations||[]).filter(a=>a.memberId===m.id).map(a=>({title:(S.investments.find(i=>i.id===p.investmentId)?.title)||'ইনভেস্টমেন্ট',date:p.date,profit:Number(a.profit||0)}))).reverse();
openModal('সদস্য প্রোফাইল',`<div class="member-profile-shell rounded-3xl overflow-hidden">
<div class="profile-cover h-28 sm:h-32"><img class="profile-cover-photo" src="images/embedded-10.jpg" alt="প্রোফাইল কভার"></div>
<div class="px-4 sm:px-6 pb-5 border border-t-0 rounded-b-2xl">
<div class="flex flex-col sm:flex-row sm:items-end gap-4 -mt-14 relative">
<img class="member-avatar w-28 h-28 rounded-3xl object-cover border-4 border-white shadow-lg bg-white" src="${esc(photo(m,112))}">
<div class="flex-1 min-w-0"><div class="flex flex-wrap items-center gap-2"><h2 class="text-2xl font-extrabold">${esc(m.name)}${dutyName?` <span class="text-indigo-600 font-extrabold">(${esc(dutyName)})</span>`:''}</h2><span class="status ${active(m)?'status-active':'status-inactive'}">● ${statusText(m)}</span></div><p class="text-sm text-slate-500 mt-1">ID: ${esc(m.id)} · NID: ${esc(m.nid||'—')} · মোবাইল: ${esc(m.phone||'—')}</p></div>
<div class="flex gap-2"><button id="profileEdit" class="btn btn-primary">✏️ সম্পাদনা</button></div>
</div>
<div class="grid grid-cols-2 lg:grid-cols-7 gap-3 mt-5"><div class="card-soft p-3"><small class="text-slate-500">ব্যক্তিগত মোট জমা</small><b class="block text-lg text-emerald-700 mt-1">${money(totalDeposit)}</b></div><div class="card-soft p-3"><small class="text-slate-500">ইনভেস্টমেন্ট লভাংশ</small><b class="block text-lg text-amber-600 mt-1">${money(dividend)}</b></div><div class="card-soft p-3"><small class="text-slate-500">টোটাল ব্যালেন্স</small><b class="block text-lg text-indigo-700 mt-1">${money(totalBalance)}</b></div><div class="card-soft p-3"><small class="text-slate-500">উপলভ্য সঞ্চয়</small><b class="block text-lg text-blue-700 mt-1">${money(availableSavings(m))}</b></div><button type="button" data-profile-loan-focus="running" class="card-soft p-3 text-left"><small class="text-slate-500">চলমান ঋণ</small><b class="block text-lg text-cyan-700 mt-1">${money(runningLoanTotal)}</b><span class="text-[11px] text-slate-500">${loanStats.running.length}টি</span></button><button type="button" data-profile-loan-focus="overdue" class="card-soft p-3 text-left"><small class="text-slate-500">বকেয়া ঋণ</small><b class="block text-lg text-red-600 mt-1">${money(overdueLoanTotal)}</b><span class="text-[11px] text-slate-500">${loanStats.overdue.length}টি</span></button><button type="button" data-profile-loan-focus="paid" class="card-soft p-3 text-left"><small class="text-slate-500">পরিশোধকৃত ঋণ</small><b class="block text-lg text-emerald-700 mt-1">${money(paidLoanTotal)}</b><span class="text-[11px] text-slate-500">${loanStats.paid.length}টি</span></button></div>
<div class="mt-5 -mx-4 sm:-mx-6 px-4 sm:px-6 border-y bg-white sticky top-0 z-10"><div class="flex gap-1 overflow-x-auto py-2" id="profileTabs"><button data-ptab="summary" class="profile-nav active">⌂ <span>সারসংক্ষেপ</span></button><button data-ptab="personal" class="profile-nav">♙ <span>ব্যক্তিগত তথ্য</span></button><button data-ptab="transactions" class="profile-nav">▣ <span>লেনদেন ইতিহাস</span></button><button data-ptab="profit" class="profile-nav">↗ <span>ইনভেস্টমেন্ট লাভ</span></button><button data-ptab="duty" class="profile-nav">♙ <span>দায়িত্ব ও কর্তব্য</span></button><button data-ptab="loans" class="profile-nav">💳 <span>ঋণ</span></button><button data-ptab="documents" class="profile-nav">▤ <span>ডকুমেন্ট</span></button></div></div>
<div id="profilePanelSummary" class="profile-panel mt-5"><div class="grid lg:grid-cols-2 gap-4"><div class="card-soft p-4"><h3 class="font-extrabold mb-3">সদস্যের সংক্ষিপ্ত তথ্য</h3><div class="grid sm:grid-cols-2 gap-2 text-sm"><div><span class="text-slate-500">ইমেইল</span><div class="font-semibold">${esc(m.email||'—')}</div></div><div><span class="text-slate-500">Employee ID</span><div class="font-semibold">${esc(m.employeeId||'—')}</div></div><div><span class="text-slate-500">কার্ড নম্বর</span><div class="font-semibold">${esc(m.cardNumber||'—')}</div></div><div><span class="text-slate-500">নমিনি</span><div class="font-semibold">${esc(m.nominee||'—')}</div></div></div></div><div class="card-soft p-4"><h3 class="font-extrabold mb-3">সর্বশেষ লভাংশ</h3><div class="space-y-2 max-h-44 overflow-y-auto">${profitHistory.slice(0,5).map(x=>`<div class="flex justify-between gap-3 p-2 rounded-xl bg-white border"><div><b class="text-sm">${esc(x.title)}</b><div class="text-[11px] text-slate-500">${esc(x.date||'')}</div></div><b class="text-amber-600">${money(x.profit)}</b></div>`).join('')||'<div class="text-sm text-slate-400">কোনো লভাংশের ইতিহাস নেই।</div>'}</div></div></div></div>
<div id="profilePanelPersonal" class="profile-panel hiddenx mt-5"><div class="card-soft p-4"><h3 class="font-extrabold text-lg mb-3">ব্যক্তিগত তথ্য</h3><div class="grid sm:grid-cols-2 lg:grid-cols-3 gap-3 text-sm"><div class="card bg-white p-3"><span class="text-slate-500">নাম</span><b class="block mt-1">${esc(m.name)}</b></div><div class="card bg-white p-3"><span class="text-slate-500">পদবী</span><b class="block mt-1 text-indigo-600">${esc(m.designation||'—')}</b></div><div class="card bg-white p-3"><span class="text-slate-500">মোবাইল</span><b class="block mt-1">${esc(m.phone||'—')}</b></div><div class="card bg-white p-3"><span class="text-slate-500">ইমেইল</span><b class="block mt-1">${esc(m.email||'—')}</b></div><div class="card bg-white p-3"><span class="text-slate-500">NID</span><b class="block mt-1">${esc(m.nid||'—')}</b></div><div class="card bg-white p-3"><span class="text-slate-500">Employee ID</span><b class="block mt-1">${esc(m.employeeId||'—')}</b></div><div class="card bg-white p-3 sm:col-span-2 lg:col-span-3"><span class="text-slate-500">নোট</span><div class="mt-1 whitespace-pre-line">${esc(m.notes||'—')}</div></div></div></div></div>
<div id="profilePanelTransactions" class="profile-panel hiddenx mt-5"><div class="card-soft p-4"><div class="flex items-center justify-between gap-3 mb-3"><div><h3 class="font-extrabold text-lg">লেনদেন ইতিহাস</h3><p class="text-xs text-slate-500"></p></div><span class="status status-running">${((m.transactions||[]).length).toLocaleString('bn-BD')}টি</span></div><div id="profileTransactionRows" class="timeline space-y-3">${txRows()}</div></div></div>
<div id="profilePanelProfit" class="profile-panel hiddenx mt-5"><div class="card-soft p-4"><div class="flex items-center justify-between gap-3 mb-3"><div><h3 class="font-extrabold text-lg">ইনভেস্টমেন্ট থেকে প্রাপ্ত লভাংশ</h3><p class="text-xs text-slate-500"></p></div><b class="text-amber-600">মোট ${money(dividend)}</b></div><div class="space-y-2">${profitHistory.map(x=>`<div class="card bg-white p-3 flex justify-between gap-3"><div><b>${esc(x.title)}</b><div class="text-xs text-slate-500">${esc(x.date||'')}</div></div><b class="text-amber-600">${money(x.profit)}</b></div>`).join('')||'<div class="text-sm text-slate-400 text-center py-8">কোনো লভাংশের ইতিহাস নেই।</div>'}</div></div></div>
<div id="profilePanelDuty" class="profile-panel hiddenx mt-5"><div class="card-soft p-4 sm:p-5"><div class="flex flex-wrap items-center justify-between gap-3"><div><div class="text-xs font-bold text-indigo-600 uppercase tracking-wider">MEMBER RESPONSIBILITY</div><h3 class="font-extrabold text-xl mt-1">দায়িত্ব ও কর্তব্য</h3><p class="text-xs text-slate-500 mt-1"></p></div><button id="dutyAddFocus" type="button" class="btn btn-primary">➕ দায়িত্ব যোগ করুন</button></div><div class="card bg-white border mt-4 p-4"><form id="dutyForm" class="grid lg:grid-cols-[1fr_1.5fr_auto] gap-2"><input id="dutyTitle" required placeholder="দায়িত্বের নাম (যেমন: সভাপতি / হিসাব রক্ষণ)" class="field"><input id="dutyDetails" placeholder="দায়িত্ব ও কর্তব্যের বিস্তারিত লিখুন" class="field"><button class="btn btn-primary">➕ বণ্টন করুন</button></form></div><div id="dutyRows" class="space-y-2 mt-4"></div></div></div>
<div id="profilePanelLoans" class="profile-panel hiddenx mt-5"><div class="card-soft p-4"><div class="flex flex-wrap items-center justify-between gap-3 mb-4"><div><h3 class="font-extrabold text-lg">ঋণ হিসাব</h3><p class="text-xs text-slate-500">চলমান, বকেয়া ও পরিশোধকৃত ঋণের পূর্ণ তথ্য।</p></div><span class="status status-running">${loanStats.loans.length.toLocaleString('bn-BD')}টি ঋণ</span></div><div class="grid sm:grid-cols-3 gap-3 mb-4"><button type="button" data-loan-filter="running" class="card-soft p-3 text-left"><small class="text-slate-500">চলমান ঋণ</small><b class="block text-lg text-cyan-700 mt-1">${money(runningLoanTotal)}</b></button><button type="button" data-loan-filter="overdue" class="card-soft p-3 text-left"><small class="text-slate-500">বকেয়া ঋণ</small><b class="block text-lg text-red-600 mt-1">${money(overdueLoanTotal)}</b></button><button type="button" data-loan-filter="paid" class="card-soft p-3 text-left"><small class="text-slate-500">পরিশোধকৃত ঋণ</small><b class="block text-lg text-emerald-700 mt-1">${money(paidLoanTotal)}</b></button></div><div class="space-y-2">${loanStats.loans.map(l=>`<div class="card bg-white border p-3"><div class="flex flex-wrap items-center justify-between gap-3"><div><b>${esc(l.memberName||m.name)}</b><div class="text-xs text-slate-500 mt-1">প্রদান: ${esc(l.date||'—')} · শেষ তারিখ: ${esc(l.dueDate||'—')}</div></div><div class="text-right"><b class="text-cyan-700">${money(l.amount)}</b><div><span class="status ${loanStatusClass(l._status)}">${loanStatusText(l._status)}</span></div></div></div><div class="grid grid-cols-2 sm:grid-cols-5 gap-2 mt-3 text-xs"><div><span class="text-slate-500">মোট ঋণ</span><b class="block">${money(l.amount)}</b></div><div><span class="text-slate-500">বকেয়া</span><b class="block">${money(l._outstanding)}</b></div><div><span class="text-slate-500">জমা ধরন</span><b class="block">${esc(l.repaymentFrequency||'—')}</b></div><div><span class="text-slate-500">মেয়াদ</span><b class="block">${esc(String(l.duration||'—'))} ${esc(l.durationUnit||'')}</b></div><div class="flex items-end justify-end">${l.repayments?.length?`<button type="button" class="btn btn-soft text-xs profile-loan-history" data-loan-id="${esc(l.id)}" title="পরিশোধের ইতিহাস">🕘 ইতিহাস</button>`:'<span class="text-slate-400 text-xs">ইতিহাস নেই</span>'}</div></div></div>`).join('')||'<div class="text-center py-8 text-slate-400">এই সদস্যের কোনো ঋণ নেই।</div>'}</div></div></div>
<div id="profilePanelDocuments" class="profile-panel hiddenx mt-5"><div class="card-soft p-4"><div class="flex items-center justify-between gap-3 mb-3"><div><h3 class="font-extrabold text-lg">প্রয়োজনীয় ডকুমেন্ট</h3><p class="text-xs text-slate-500"></p></div><span class="status status-running">${docs.length.toLocaleString('bn-BD')}টি</span></div><div class="grid sm:grid-cols-2 gap-3">${docs.map((d,idx)=>`<div class="card bg-white p-3 flex items-center gap-3"><button type="button" class="w-16 h-16 rounded-xl bg-slate-50 border overflow-hidden shrink-0 flex items-center justify-center" data-member-doc-view="${esc(d.url)}" data-member-id="${esc(m.id)}" data-doc-index="${idx}" data-doc-title="${esc(d.title||d.name||'ডকুমেন্ট')}" title="ফুল ভিউ"><img src="${esc(d.url)}" class="w-full h-full object-contain" alt="${esc(d.title||d.name||'ডকুমেন্ট')}" onerror="this.style.display='none'"></button><div class="min-w-0 flex-1"><b class="block truncate">📎 ${esc(d.title||d.name||'ডকুমেন্ট')}</b><div class="text-[11px] text-slate-500 mt-1">ফুল ভিউ ও ডিলেট অপশন আছে</div></div><button type="button" class="btn btn-danger text-xs shrink-0" data-member-doc-delete="1" data-member-id="${esc(m.id)}" data-doc-index="${idx}">🗑️</button></div>`).join('')||'<div class="text-sm text-slate-400">কোনো ডকুমেন্ট নেই।</div>'}</div></div></div>
</div></div>`);
$('profileEdit').onclick=()=>{closeModal();openEdit(id)};
const tabs=[...document.querySelectorAll('[data-ptab]')],panels={summary:$('profilePanelSummary'),personal:$('profilePanelPersonal'),transactions:$('profilePanelTransactions'),profit:$('profilePanelProfit'),duty:$('profilePanelDuty'),loans:$('profilePanelLoans'),documents:$('profilePanelDocuments')};
const switchProfileTab=name=>{tabs.forEach(t=>t.classList.toggle('active',t.dataset.ptab===name));Object.entries(panels).forEach(([k,p])=>p.classList.toggle('hiddenx',k!==name));};tabs.forEach(t=>t.onclick=()=>switchProfileTab(t.dataset.ptab));switchProfileTab(focusTab||'summary');
const dutyRows=$('dutyRows');
const renderDutyRows=()=>{const current=getCurrent(),duties=current.responsibilities||[];dutyRows.innerHTML=duties.map(d=>`<div class="card bg-white border p-4 flex flex-col sm:flex-row sm:items-start justify-between gap-3"><div class="flex gap-3"><div class="w-10 h-10 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center shrink-0">🧭</div><div><div class="flex flex-wrap items-center gap-2"><b>${esc(d.title)}</b><span class="status status-active">সক্রিয়</span></div><div class="text-sm text-slate-600 mt-1 whitespace-pre-line">${esc(d.details||'কোনো বিস্তারিত নেই।')}</div><div class="text-[11px] text-slate-400 mt-1">শুরু: ${esc(d.date||'—')}</div></div></div><div class="flex gap-2 shrink-0"><button type="button" class="btn btn-soft text-xs edit-duty" data-dutyid="${esc(d.id)}">✏️ এডিট</button><button type="button" class="btn btn-danger text-xs delete-duty" data-dutyid="${esc(d.id)}">🗑️ বাতিল</button></div></div>`).join('')||'<div class="text-sm text-slate-400 text-center py-8">এখনও কোনো দায়িত্ব বণ্টন করা হয়নি।</div>';};
renderDutyRows();
$('dutyAddFocus').onclick=()=>{$('dutyTitle').focus()};
$('dutyForm').onsubmit=async e=>{e.preventDefault();try{const title=$('dutyTitle').value.trim(),details=$('dutyDetails').value.trim();if(!title)throw Error('দায়িত্বের নাম দিন');await save(s=>{const mm=s.members.find(x=>x.id===id);if(!mm)throw Error('সদস্য পাওয়া যায়নি');mm.responsibilities=[...(mm.responsibilities||[]),{id:uid('R'),title,details,date:today(),createdAt:new Date().toISOString(),status:'active'}];addNotif(s,'member',mm.name+' কে নতুন দায়িত্ব দেওয়া হয়েছে: '+title)});$('dutyForm').reset();toast('দায়িত্ব সফলভাবে বণ্টন হয়েছে');renderDutyRows()}catch(err){toast(err.message,true)}};
dutyRows.onclick=async e=>{const edit=e.target.closest('.edit-duty'),del=e.target.closest('.delete-duty');if(edit){const dutyId=edit.dataset.dutyid,current=getCurrent(),d=(current.responsibilities||[]).find(x=>x.id===dutyId);if(!d)return;openModal('দায়িত্ব সম্পাদনা',`<form id="editDutyForm" class="space-y-3"><input id="editDutyTitle" class="field" required value="${esc(d.title)}"><textarea id="editDutyDetails" class="field" rows="4" placeholder="দায়িত্ব ও কর্তব্য">${esc(d.details||'')}</textarea><button class="btn btn-primary w-full">💾 পরিবর্তন সেভ করুন</button></form>`);$('editDutyForm').onsubmit=async ev=>{ev.preventDefault();try{await save(s=>{const mm=s.members.find(x=>x.id===id);if(!mm)throw Error('সদস্য পাওয়া যায়নি');mm.responsibilities=(mm.responsibilities||[]).map(x=>x.id===dutyId?{...x,title:$('editDutyTitle').value.trim(),details:$('editDutyDetails').value.trim(),updatedAt:new Date().toISOString()}:x);addNotif(s,'member',mm.name+' এর দায়িত্ব আপডেট হয়েছে')});closeModal();toast('দায়িত্ব আপডেট হয়েছে');openProfile(id)}catch(err){toast(err.message,true)}};return}if(del){const dutyId=del.dataset.dutyid;if(!confirm('এই দায়িত্বটি বাতিল করবেন?'))return;try{await save(s=>{const mm=s.members.find(x=>x.id===id);if(!mm)throw Error('সদস্য পাওয়া যায়নি');const d=(mm.responsibilities||[]).find(x=>x.id===dutyId);mm.responsibilities=(mm.responsibilities||[]).filter(x=>x.id!==dutyId);if(d)addNotif(s,'member',mm.name+' এর দায়িত্ব বাতিল করা হয়েছে: '+d.title)});toast('দায়িত্ব বাতিল হয়েছে');renderDutyRows()}catch(err){toast(err.message,true)}}};
document.querySelectorAll('[data-profile-loan-focus]').forEach(b=>b.onclick=()=>{switchProfileTab('loans');document.querySelectorAll('[data-loan-filter]').forEach(x=>x.classList.toggle('ring-2',x.dataset.loanFilter===b.dataset.profileLoanFocus))});
document.querySelectorAll('[data-loan-filter]').forEach(b=>b.onclick=()=>{document.querySelectorAll('[data-loan-filter]').forEach(x=>x.classList.remove('ring-2'));b.classList.add('ring-2')});
document.querySelectorAll('.profile-loan-history').forEach(b=>b.onclick=()=>openLoanHistory(b.dataset.loanId));
document.querySelectorAll('[data-member-doc-view]').forEach(b=>b.onclick=()=>openMemberMediaViewer({url:b.dataset.memberDocView,memberId:b.dataset.memberId,docIndex:Number(b.dataset.docIndex),title:b.dataset.docTitle,type:'document'}));
document.querySelectorAll('[data-member-doc-delete]').forEach(b=>b.onclick=()=>window.deleteMemberDocument(b.dataset.memberId,Number(b.dataset.docIndex)));
const txBox=$('profileTransactionRows');if(txBox)txBox.onclick=async e=>{const b=e.target.closest('.delete-member-tx');if(!b)return;const txid=b.dataset.txid;if(!txid)return;if(!confirm('এই নির্দিষ্ট লেনদেনটি ডিলেট করবেন?'))return;if(!confirm('দ্বিতীয় অনুমতি: এই লেনদেনের হিসাব থেকে এর প্রভাবও সরবে। আপনি কি নিশ্চিত?'))return;if(!confirm('তৃতীয় ও শেষ অনুমতি: এই লেনদেনটি স্থায়ীভাবে মুছে যাবে। নিশ্চিত?'))return;try{await save(s=>{const mm=s.members.find(x=>x.id===id);if(!mm)throw Error('সদস্য পাওয়া যায়নি');const tx0=(mm.transactions||[]).find(x=>x.id===txid);if(!tx0)throw Error('লেনদেন পাওয়া যায়নি');mm.transactions=(mm.transactions||[]).filter(x=>x.id!==txid);if(tx0.type==='bank_deposit')bankAppend(s,Number(tx0.amount||0),'member_transaction_reversal','Member transaction delete reversal — '+mm.name,'member_transaction_delete',tx0.id);addNotif(s,'member',mm.name+' এর একটি লেনদেন ডিলেট করা হয়েছে')});toast('নির্দিষ্ট লেনদেন ডিলেট হয়েছে');closeModal();openProfile(id)}catch(err){toast(err.message,true)}};
}

function getLoanById(id){
 const l=(S.netDividendLoans||[]).find(x=>x.id===id);
 if(!l)throw Error('ঋণ পাওয়া যায়নি');
 const outstanding=Number(l.outstanding??(Number(l.amount||0)-Number(l.repaidAmount||0)));
 return {...l,outstanding:Math.max(0,outstanding),_status:loanStatus({...l,outstanding})};
}
function openLoanRepaymentForm(loanId){
 let loan;
 try{loan=getLoanById(loanId)}catch(err){toast(err.message,true);return}
 if(loan.outstanding<=0){toast('এই ঋণ ইতোমধ্যে সম্পূর্ণ পরিশোধ হয়েছে');return}
 const member=S.members.find(m=>m.id===loan.memberId);
 openModal('কিস্তি এন্ট্রি — ঋণ পরিশোধ',`
  <div class="card-soft p-4 mb-4 flex items-center gap-3">
   <img src="${esc(member?photo(member,64):loan.memberPhoto||photo({},64))}" class="w-14 h-14 rounded-2xl object-cover">
   <div class="flex-1"><b class="block">${esc(member?.name||loan.memberName||'সদস্য')}</b><span class="text-xs text-slate-500">মোট ঋণ: ${money(loan.amount)} · বর্তমান বকেয়া: ${money(loan.outstanding)}</span></div>
  </div>
  <form id="loanRepaymentForm" class="space-y-3">
   <label class="text-sm font-bold">ঋণ পরিশোধের পরিমাণ</label>
   <input id="loanRepaymentAmount" required type="number" min="0.01" max="${loan.outstanding}" step="0.01" value="${loan.outstanding}" class="field">
   <select id="loanRepaymentMethod" class="field"><option value="cash">নগদ</option><option value="bank">ব্যাংক</option><option value="online">অনলাইন</option><option value="other">অন্যান্য</option></select>
   <input id="loanRepaymentDate" required type="date" value="${today()}" class="field">
   <input id="loanRepaymentRef" placeholder="রেফারেন্স / মন্তব্য (ঐচ্ছিক)" class="field">
   <div class="card-soft p-3 text-sm"><b>স্বাধীন পরিশোধ:</b> মোট ঋণের উপর আংশিক বা সম্পূর্ণ যে কোনো পরিমাণ আদায় করা যাবে। কোনো সুদ যোগ হবে না।</div>
   <button class="btn btn-success w-full">✓ কিস্তি এন্ট্রি সেভ করুন</button>
  </form>`);
 $('loanRepaymentForm').onsubmit=async e=>{
  e.preventDefault();
  try{
   const amount=positive($('loanRepaymentAmount').value,'ঋণ পরিশোধের পরিমাণ');
   if(amount>loan.outstanding+0.01)throw Error('পরিশোধের টাকা বর্তমান বকেয়ার চেয়ে বেশি হতে পারবে না');
   await save(s=>{
    const l=s.netDividendLoans.find(x=>x.id===loanId);if(!l)throw Error('ঋণ পাওয়া যায়নি');
    const oldOutstanding=Number(l.outstanding??(Number(l.amount||0)-Number(l.repaidAmount||0)));
    const newOutstanding=Math.max(0,Number((oldOutstanding-amount).toFixed(2)));
    l.repaidAmount=Number((Number(l.repaidAmount||0)+amount).toFixed(2));
    l.outstanding=newOutstanding;
    l.status=newOutstanding<=0?'repaid':(l.dueDate&&l.dueDate<today()?'overdue':'active');
    l.lastRepaymentAt=new Date().toISOString();
    l.repayments=[...(l.repayments||[]),{id:uid('LR'),amount,date:$('loanRepaymentDate').value,method:$('loanRepaymentMethod').value,reference:$('loanRepaymentRef').value.trim(),createdAt:new Date().toISOString()}];
    s.loanRepayments=[...(s.loanRepayments||[]),{id:uid('LRH'),loanId,memberId:l.memberId,memberName:l.memberName,amount,date:$('loanRepaymentDate').value,method:$('loanRepaymentMethod').value,reference:$('loanRepaymentRef').value.trim(),createdAt:new Date().toISOString()}];
    addNotif(s,'loan',l.memberName+' এর ঋণ থেকে '+money(amount)+' পরিশোধ গ্রহণ করা হয়েছে; অবশিষ্ট '+money(newOutstanding));
   });
   closeModal();toast('ঋণ পরিশোধ সফলভাবে রেকর্ড হয়েছে');openProfile(loan.memberId,'loans');
  }catch(err){toast(err.message,true)}
 };
}

function renderDonationHistory(){
 const rows=(S.donationDisbursements||[]).slice().reverse();
 const total=rows.reduce((a,x)=>a+Number(x.amount||0),0);
 const named=rows.filter(x=>x.visibility!=='anonymous').length;
 $('donationHistorySummary').innerHTML=`<div class="card-soft p-3"><span class="text-xs text-slate-500">মোট প্রদান</span><b class="block text-xl text-rose-600">${money(total)}</b></div><div class="card-soft p-3"><span class="text-xs text-slate-500">মোট রেকর্ড</span><b class="block text-xl">${rows.length.toLocaleString('bn-BD')}</b></div><div class="card-soft p-3"><span class="text-xs text-slate-500">নাম প্রকাশিত</span><b class="block text-xl">${named.toLocaleString('bn-BD')}</b></div>`;
 $('donationHistoryRows').innerHTML=rows.map(d=>`<div class="card-soft p-4 flex flex-col sm:flex-row gap-3 sm:items-center clickable donation-history-card" data-donation-id="${esc(d.id)}" role="button" tabindex="0" title="বিস্তারিত দেখতে ক্লিক করুন">
  <div class="flex-1 min-w-0"><div class="flex flex-wrap items-center gap-2"><b>${esc(d.visibility==='anonymous'?'বেনামী দাতা':(d.donorName||'দাতা'))}</b><span class="status status-active">${esc(d.frequency||'one-time')}</span></div>
  <div class="text-xs text-slate-500 mt-1">${esc(d.purpose||'general')} · ${esc(d.paymentType||'cash')} · ${esc(d.date||'')}</div>
  ${d.institutionName?`<div class="text-xs text-slate-500 mt-1">প্রতিষ্ঠান: ${esc(d.institutionName)}</div>`:''}</div>
  <div class="text-right"><b class="text-rose-600">${money(d.amount)}</b><div class="mt-2"><span class="btn btn-soft text-xs">বিস্তারিত →</span></div></div>
 </div>`).join('')||'<div class="card-soft p-8 text-center text-slate-400">কোনো অনুদান হিস্ট্রি নেই।</div>';
 document.querySelectorAll('.donation-history-card').forEach(card=>{card.onclick=()=>openDonationHistoryDetail(card.dataset.donationId);card.onkeydown=e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();openDonationHistoryDetail(card.dataset.donationId)}}});
}
function openDonationHistoryDetail(id){
 const d=(S.donationDisbursements||[]).find(x=>x.id===id);if(!d){toast('অনুদান রেকর্ড পাওয়া যায়নি',true);return}
 const title=d.visibility==='anonymous'?'বেনামী দাতা':(d.donorName||'দাতা');
 openModal('অনুদান বিস্তারিত',`<div class="space-y-4">
  <div class="flex flex-wrap items-start justify-between gap-3"><div><h2 class="text-2xl font-extrabold mt-1">${esc(title)}</h2><p class="text-xs text-slate-500 mt-1">রেকর্ড ID: ${esc(d.id||'—')}</p></div><b class="text-2xl text-rose-600">${money(d.amount)}</b></div>
  <div class="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
   <div class="card-soft p-3"><small class="text-slate-500">দাতার নাম</small><b class="block mt-1">${esc(d.donorName||'—')}</b></div>
   <div class="card-soft p-3"><small class="text-slate-500">ফোন</small><b class="block mt-1">${esc(d.donorPhone||'—')}</b></div>
   <div class="card-soft p-3"><small class="text-slate-500">ইমেইল</small><b class="block mt-1">${esc(d.donorEmail||'—')}</b></div>
   <div class="card-soft p-3 sm:col-span-2"><small class="text-slate-500">ঠিকানা</small><b class="block mt-1 whitespace-pre-line">${esc(d.donorAddress||'—')}</b></div>
   <div class="card-soft p-3"><small class="text-slate-500">প্রতিষ্ঠান</small><b class="block mt-1">${esc(d.institutionName||'—')}</b></div>
   <div class="card-soft p-3"><small class="text-slate-500">পরিমাণ</small><b class="block mt-1 text-rose-600">${money(d.amount)}</b></div>
   <div class="card-soft p-3"><small class="text-slate-500">ফ্রিকোয়েন্সি</small><b class="block mt-1">${esc(d.frequency||'one-time')}</b></div>
   <div class="card-soft p-3"><small class="text-slate-500">উদ্দেশ্য</small><b class="block mt-1">${esc(d.purpose||'general')}</b></div>
   <div class="card-soft p-3"><small class="text-slate-500">প্রজেক্ট</small><b class="block mt-1">${esc(d.projectName||'—')}</b></div>
   <div class="card-soft p-3"><small class="text-slate-500">পেমেন্ট পদ্ধতি</small><b class="block mt-1">${esc(d.paymentType||'cash')}</b></div>
   <div class="card-soft p-3"><small class="text-slate-500">Transaction/Cheque</small><b class="block mt-1">${esc(d.transactionId||'—')}</b></div>
   <div class="card-soft p-3"><small class="text-slate-500">ব্যাংক</small><b class="block mt-1">${esc(d.bankName||'—')}${d.branchName?' · '+esc(d.branchName):''}</b></div>
   <div class="card-soft p-3"><small class="text-slate-500">Tax Relief</small><b class="block mt-1">${esc(d.taxRelief||'unknown')}</b></div>
   <div class="card-soft p-3"><small class="text-slate-500">PAN / TIN</small><b class="block mt-1">${esc(d.tin||'—')}</b></div>
   <div class="card-soft p-3"><small class="text-slate-500">তারিখ</small><b class="block mt-1">${esc(d.date||'—')}</b></div>
   <div class="card-soft p-3"><small class="text-slate-500">দৃশ্যমানতা</small><b class="block mt-1">${d.visibility==='anonymous'?'বেনামী':'নাম প্রকাশযোগ্য'}</b></div>
  </div>
  ${d.documentUrl?`<div class="card-soft p-4"><div class="font-extrabold mb-2">📎 ডকুমেন্ট</div><a href="${esc(d.documentUrl)}" target="_blank" rel="noopener" class="btn btn-soft">ডকুমেন্ট দেখুন ↗</a></div>`:''}
  ${d.editNote?`<div class="card-soft p-4"><div class="font-extrabold mb-1">সম্পাদনার মন্তব্য</div><div class="text-sm whitespace-pre-line">${esc(d.editNote)}</div></div>`:''}
  <div class="flex flex-wrap gap-2 pt-2"><button id="editDonationFromDetail" type="button" class="btn btn-primary">✏️ সম্পাদনা</button><button id="closeDonationDetail" type="button" class="btn btn-soft">বন্ধ করুন</button></div>
 </div>`);
 $('editDonationFromDetail').onclick=()=>{closeModal();openDonationHistoryEdit(id)};
 $('closeDonationDetail').onclick=closeModal;
}
function openDonationHistoryEdit(id){
 const d=(S.donationDisbursements||[]).find(x=>x.id===id);if(!d){toast('অনুদান রেকর্ড পাওয়া যায়নি',true);return}
 openModal('অনুদান হিস্ট্রি সম্পাদনা',`<form id="editDonationHistoryForm" class="space-y-3">
  <input id="editDonationAmount" required type="number" min="0.01" step="0.01" value="${Number(d.amount||0)}" class="field" placeholder="অনুদানের পরিমাণ">
  <input id="editDonationName" value="${esc(d.donorName||'')}" class="field" placeholder="দাতার নাম">
  <input id="editDonationPhone" value="${esc(d.donorPhone||'')}" class="field" placeholder="ফোন নম্বর">
  <input id="editDonationDate" required type="datetime-local" value="${esc((d.date||'').slice(0,16))}" class="field">
  <select id="editDonationVisibility" class="field"><option value="named" ${d.visibility!=='anonymous'?'selected':''}>নাম প্রকাশযোগ্য</option><option value="anonymous" ${d.visibility==='anonymous'?'selected':''}>বেনামী</option></select>
  <textarea id="editDonationNote" class="field" rows="3" placeholder="সম্পাদনার মন্তব্য">${esc(d.editNote||'')}</textarea>
  <button class="btn btn-primary w-full">💾 পরিবর্তন সেভ করুন</button>
 </form>`);
 $('editDonationHistoryForm').onsubmit=async e=>{
  e.preventDefault();
  try{
   const amount=positive($('editDonationAmount').value,'অনুদানের পরিমাণ');
   await save(s=>{
    const x=s.donationDisbursements.find(z=>z.id===id);if(!x)throw Error('অনুদান রেকর্ড পাওয়া যায়নি');
    x.amount=amount;x.donorName=$('editDonationName').value.trim();x.donorPhone=$('editDonationPhone').value.trim();x.date=$('editDonationDate').value;x.visibility=$('editDonationVisibility').value;x.editNote=$('editDonationNote').value.trim();x.updatedAt=new Date().toISOString();
    addNotif(s,'donation','অনুদান হিস্ট্রির একটি রেকর্ড সম্পাদনা করা হয়েছে: '+money(amount));
   });
   closeModal();toast('অনুদান হিস্ট্রি আপডেট হয়েছে');renderDonationHistory();
  }catch(err){toast(err.message,true)}
 };
}

function openInvestment(id){const i=S.investments.find(x=>x.id===id);if(!i)return;const [code,label]=investmentStatus(i);const profits=S.profitEntries.filter(p=>p.investmentId===id);const totalProfit=profits.reduce((a,p)=>a+Number(p.totalProfit||0),0);openModal('ইনভেস্টমেন্ট বিস্তারিত',`<div class="overflow-hidden rounded-2xl border"><div class="h-52 bg-slate-100">${i.imageUrl?`<img src="${esc(i.imageUrl)}" data-full-image="${esc(i.imageUrl)}" data-investment-id="${esc(i.id)}" class="w-full h-full object-cover cursor-zoom-in" title="ছবিটি বড় করে দেখতে ক্লিক করুন">`:'<div class="h-full flex items-center justify-center text-6xl">📈</div>'}</div><div class="p-5"><div class="flex flex-wrap items-start justify-between gap-3"><div><h2 class="text-2xl font-extrabold">${esc(i.title)}</h2><p class="text-sm text-slate-500 mt-1">${esc(i.timeline||'')}</p></div><span class="status status-${code}">${label}</span></div><div class="grid sm:grid-cols-4 gap-3 mt-5"><div class="card-soft p-3"><small>ইনভেস্টমেন্ট</small><b class="block text-lg text-violet-700">${money(i.amount)}</b></div><div class="card-soft p-3"><small>শুরু</small><b class="block">${esc(i.startDate||'—')}</b></div><div class="card-soft p-3"><small>শেষ</small><b class="block">${esc(i.endDate||'—')}</b></div><div class="card-soft p-3"><small>মোট লাভ</small><b class="block text-lg text-amber-600">${money(totalProfit)}</b></div></div><div class="card-soft p-4 mt-4 whitespace-pre-line text-sm leading-7">${esc(i.note||'কোনো বিস্তারিত নেই।')}</div><div class="mt-5"><h3 class="font-extrabold mb-3">এই ইনভেস্টমেন্টের লাভ ও সদস্যভিত্তিক বণ্টন</h3>${profits.map(p=>`<div class="card-soft p-3 mb-2"><div class="flex justify-between gap-3 mb-2"><b>${esc(p.date||'')}</b><b class="text-amber-600">মোট ${money(p.totalProfit)}</b></div><div class="space-y-1">${(p.allocations||[]).map(a=>`<div class="flex justify-between text-sm"><span>${esc(a.name)}</span><b>${money(a.profit)}</b></div>`).join('')}</div></div>`).join('')||'<div class="text-sm text-slate-400">এখনও কোনো লাভ সেভ হয়নি।</div>'}</div><div class="flex flex-wrap gap-2 mt-5"><button id="editInv" class="btn btn-primary">✏️ এডিট</button>${i.status!=='complete'?'<button id="completeInv" class="btn btn-success">✓ কার্যক্রম সমাপ্ত</button>':''}<button id="deleteInv" class="btn btn-danger">🗑️ ডিলিট</button></div></div></div>`);$('editInv').onclick=()=>{closeModal();openInvestmentEdit(id)};if($('completeInv'))$('completeInv').onclick=async()=>{if(!confirm('এই ইনভেস্টমেন্ট কার্যক্রম সমাপ্ত ঘোষণা করবেন? সমিতির টাকা ব্যাংকে ফেরত যোগ হবে।'))return;try{await save(s=>{const old=s.investments.find(x=>x.id===id);if(!old)return;s.investments=(s.investments||[]).map(x=>x.id===id?{...x,status:'complete',completedAt:new Date().toISOString(),returnedToBank:old.financialApplied&&!old.returnedToBank}:x);if(old.financialApplied&&!old.returnedToBank)bankAppend(s,Number(old.amount||0),'investment_return','Investment completed — '+old.title,'investment',old.id);addNotif(s,'investment',old.title+' — সমাপ্ত হয়েছে এবং '+(old.financialApplied&&!old.returnedToBank?money(old.amount)+' ব্যাংকে ফেরত যোগ হয়েছে':'') )});closeModal();toast('ইনভেস্টমেন্ট সমাপ্ত হয়েছে এবং প্রযোজ্য টাকা ব্যাংকে ফেরত গেছে')}catch(err){toast(err.message,true)}};$('deleteInv').onclick=async()=>{if(!confirm('ইনভেস্টমেন্ট ডিলিট করবেন?'))return;try{await save(s=>{const old=s.investments.find(x=>x.id===id);s.investments=(s.investments||[]).filter(x=>x.id!==id);if(old?.financialApplied&&!old.returnedToBank&&old.amount)bankAppend(s,Number(old.amount),'investment_reversal','Investment delete — '+old.title,'investment',old.id);addNotif(s,'investment',old.title+' — ডিলিট করা হয়েছে')});closeModal();toast('ইনভেস্টমেন্ট ডিলিট হয়েছে')}catch(err){toast(err.message,true)}}}

function openInvestmentEdit(id){const i=S.investments.find(x=>x.id===id);if(!i)return;openModal('ইনভেস্টমেন্ট সম্পাদনা',`<form id="editInvForm" class="space-y-3"><input id="eiTitle" required value="${esc(i.title)}" class="field"><input id="eiAmount" required type="number" min="0.01" step="0.01" value="${i.amount}" class="field"><div class="grid sm:grid-cols-2 gap-3"><input id="eiStart" required type="date" value="${esc(i.startDate||'')}" class="field"><input id="eiEnd" type="date" value="${esc(i.endDate||'')}" class="field"></div><input id="eiTimeline" required value="${esc(i.timeline||'')}" class="field"><input id="eiImageUrl" type="url" value="${esc(i.imageUrl||'')}" placeholder="ছবির URL" class="field"><input id="eiImage" type="file" accept="image/*" class="field"><textarea id="eiNote" rows="4" class="field">${esc(i.note||'')}</textarea><button class="btn btn-primary w-full">আপডেট করুন</button></form>`);$('editInvForm').onsubmit=async e=>{e.preventDefault();try{let image=$('eiImageUrl').value.trim();if($('eiImage').files[0])image=await uploadToImgBB($('eiImage').files[0]);await save(s=>{const nextAmount=Number($('eiAmount').value),oldAmount=Number(i.amount||0);s.investments=(s.investments||[]).map(x=>x.id===id?{...x,title:$('eiTitle').value.trim(),amount:nextAmount,startDate:$('eiStart').value,endDate:$('eiEnd').value,timeline:$('eiTimeline').value.trim(),imageUrl:image||x.imageUrl||'',note:$('eiNote').value.trim()}:x);if(i.financialApplied&&nextAmount!==oldAmount)bankAppend(s,oldAmount-nextAmount,'investment_adjustment','Investment edit — '+i.title,'investment',i.id);addNotif(s,'investment','ইনভেস্টমেন্ট '+i.title+' আপডেট হয়েছে')});closeModal();toast('ইনভেস্টমেন্ট আপডেট হয়েছে')}catch(err){toast(err.message,true)}}}
// Profit distribution uses members' contributed savings, not the amount that is
// merely waiting to be deposited in the bank. A bank_deposit is a transfer of
// the member's own savings to the bank, so it must NOT erase their profit share.
function profitEligibleSavings(m,cutoffDate=''){
 const txs=Array.isArray(m?.transactions)?m.transactions:[];
 return txs.reduce((sum,t)=>{
  if(t.type!=='deposit')return sum;
  if(cutoffDate && t.date && String(t.date)>String(cutoffDate))return sum;
  return sum+Number(t.amount||0);
 },0);
}
function buildProfitAllocations(netDividend,profitDate){
 const eligible=S.members.filter(active).map(m=>({member:m,base:profitEligibleSavings(m,profitDate)})).filter(x=>x.base>0);
 const totalBase=eligible.reduce((a,x)=>a+x.base,0);
 if(totalBase<=0)throw Error('লাভ বণ্টনের জন্য সক্রিয় সদস্যদের কোনো সদস্য সঞ্চয় পাওয়া যায়নি। ব্যাংকে জমা করা সঞ্চয়ও লাভ বণ্টনের জন্য গণনা করা হবে।');
 const totalCents=Math.round(Number(netDividend||0)*100);
 let usedCents=0;
 const parts=eligible.map(x=>{
  const rawCents=totalCents*x.base/totalBase;
  const cents=Math.floor(rawCents);
  usedCents+=cents;
  return {...x,rawCents,cents,frac:rawCents-cents};
 });
 let remainder=totalCents-usedCents;
 parts.sort((a,b)=>b.frac-a.frac||String(a.member.id).localeCompare(String(b.member.id)));
 for(let i=0;i<remainder;i++)parts[i%parts.length].cents++;
 return {
  totalBase,
  allocations:parts.map(x=>({
   memberId:x.member.id,
   name:x.member.name||'সদস্য',
   profit:Number((x.cents/100).toFixed(2)),
   baseSavings:Number(x.base.toFixed(2)),
   sharePercent:Number((x.base/totalBase*100).toFixed(6))
  }))
 };
}
function repairLegacyProfitAllocations(){
 if(window.__READ_ONLY__)return;
 if(window.__profitAllocationRepairRunning)return;
 const missing=(S.profitEntries||[]).filter(p=>!Array.isArray(p.allocations)||p.allocations.length===0);
 if(!missing.length)return;
 window.__profitAllocationRepairRunning=true;
 Promise.resolve().then(async()=>{
  try{
   await save(s=>{
    let changed=false;
    s.profitEntries=(s.profitEntries||[]).map(p=>{
     if(Array.isArray(p.allocations)&&p.allocations.length)return p;
     try{
      const built=buildProfitAllocations(Number(p.netDividendAmount??(p.fundSplitVersion==='2-98'?Number(p.totalProfit||0)*0.98:Number(p.totalProfit||0))),p.date||'');
      changed=true;
      return {...p,allocations:built.allocations,allocationBaseTotal:built.totalBase,allocationVersion:'savings-v2'};
     }catch(e){return p;}
    });
    if(!changed)throw Error('NO_PROFIT_ALLOCATION_REPAIR');
   });
  }catch(e){
   if(e?.message!=='NO_PROFIT_ALLOCATION_REPAIR')console.warn('Profit allocation repair skipped:',e);
  }finally{window.__profitAllocationRepairRunning=false;}
 });
}
function openProfitPreview(){
 const inv=S.investments.find(i=>i.id===$('profitInvestment').value);
 const amount=positive($('profitAmount').value,'মুনাফার পরিমাণ');
 const date=$('profitDate').value;
 if(!inv)throw Error('ইনভেস্টমেন্ট নির্বাচন করুন');
 const donation=Number((amount*0.02).toFixed(2));
 const netDividend=Number((amount-donation).toFixed(2));
 const built=buildProfitAllocations(netDividend,date);
 pendingProfit={investmentId:inv.id,totalProfit:amount,date,reference:$('profitRef').value.trim(),donationAmount:donation,netDividendAmount:netDividend,fundSplitVersion:'2-98',allocations:built.allocations,allocationBaseTotal:built.totalBase,allocationVersion:'savings-v2'};
 const rows=built.allocations.map(a=>`<div class="flex items-center justify-between gap-3 py-2 border-b last:border-0"><div><b>${esc(a.name)}</b><div class="text-[11px] text-slate-500">সঞ্চয় ভিত্তি ${money(a.baseSavings)} · ${a.sharePercent.toFixed(2)}%</div></div><b class="text-emerald-700">${money(a.profit)}</b></div>`).join('');
 openModal('মুনাফা কনফার্মেশন — ২% অনুদান / ৯৮% সদস্য লভ্যাংশ',`
  <p class="text-sm text-slate-500 mb-3">${esc(inv.title)} · ${date} · মোট লাভ ${money(amount)}</p>
  <div class="grid sm:grid-cols-2 gap-3">
   <div class="rounded-xl bg-rose-50 border border-rose-100 p-4"><div class="text-xs font-bold text-rose-700">অনুদান — ২%</div><b class="text-2xl text-rose-700">${money(donation)}</b></div>
   <div class="rounded-xl bg-cyan-50 border border-cyan-100 p-4"><div class="text-xs font-bold text-cyan-700">নীট সদস্য লভ্যাংশ — ৯৮%</div><b class="text-2xl text-cyan-700">${money(netDividend)}</b></div>
  </div>
  <div class="card-soft p-3 mt-4 text-sm"><b>সদস্যভিত্তিক লাভ বণ্টন</b><div class="text-xs text-slate-500 mt-1">শুধু সক্রিয় সদস্যদের জমাকৃত সঞ্চয়ের অনুপাতে। ব্যাংকে জমা করা সঞ্চয়ও সদস্যের লাভের ভিত্তিতে থাকবে।</div><div class="mt-2 max-h-64 overflow-auto">${rows}</div></div>
  <label class="flex gap-3 p-4 mt-4 rounded-xl bg-blue-50 border border-blue-100"><input id="profitBanked" type="checkbox" class="w-5 h-5 mt-0.5"><span><b>মুনাফা ব্যাংকে জমা হয়েছে</b><small class="block text-xs text-slate-500">সম্মতি দিলে ব্যাংক balance-এ পুরো profit যোগ হবে।</small></span></label>
  <button id="confirmProfit" type="button" class="btn btn-success w-full mt-4">Confirm — ফাইনাল সেভ</button>`);
 $('confirmProfit').onclick=async()=>{
  try{
   const p=pendingProfit,banked=$('profitBanked').checked;
   await save(s=>{
    s.profitEntries=[...(s.profitEntries||[]),{...p,id:uid('P'),bankDeposited:banked,createdAt:new Date().toISOString()}];
    if(banked)bankAppend(s,p.totalProfit,'profit_deposit','Profit deposit — '+inv.title,'profit',p.reference);
    addNotif(s,'profit','মোট '+money(p.totalProfit)+' মুনাফা — ২% অনুদান '+money(p.donationAmount)+' এবং ৯৮% সদস্য লভ্যাংশ '+money(p.netDividendAmount)+'; '+p.allocations.length+' জন সদস্যের প্রোফাইলে লাভ যুক্ত হয়েছে'+(banked?' এবং ব্যাংকে জমা হয়েছে':''));
   });
   pendingProfit=null;closeModal();$('profitForm').reset();$('profitDate').value=today();toast('মুনাফা বণ্টন হয়েছে এবং সদস্যদের প্রোফাইলে লাভ যুক্ত হয়েছে');
  }catch(err){toast(err.message,true)}
 };
}
function investmentDonationReport(){
 const rows=S.investments.map(i=>{
  const profits=S.profitEntries.filter(p=>p.investmentId===i.id);
  const totalProfit=profits.reduce((a,p)=>a+Number(p.totalProfit||0),0);
  const donation=profits.reduce((a,p)=>a+Number(p.donationAmount??(p.fundSplitVersion==='2-98'?Number(p.totalProfit||0)*0.02:0)),0);
  return {i,totalProfit,donation};
 });
 const totalInv=rows.reduce((a,x)=>a+Number(x.i.amount||0),0);
 const totalProfit=rows.reduce((a,x)=>a+x.totalProfit,0);
 const totalDonation=rows.reduce((a,x)=>a+x.donation,0);
 openModal('মোট ইনভেস্টমেন্ট — অনুদান হিসাব',`
  <div class="grid sm:grid-cols-3 gap-3 mb-4">
   <div class="card-soft p-3"><div class="text-xs text-slate-500">মোট ইনভেস্টমেন্ট</div><b class="text-lg text-violet-700">${money(totalInv)}</b></div>
   <div class="card-soft p-3"><div class="text-xs text-slate-500">মোট লাভ</div><b class="text-lg text-amber-600">${money(totalProfit)}</b></div>
   <div class="card-soft p-3"><div class="text-xs text-slate-500">মোট অনুদান ২%</div><b class="text-lg text-rose-600">${money(totalDonation)}</b></div>
  </div>
  <div class="scroll-x"><table class="table text-sm"><thead><tr><th>ইনভেস্টমেন্ট</th><th>মূলধন</th><th>লাভ</th><th>অনুদান ২%</th></tr></thead><tbody>
   ${rows.map(x=>`<tr><td><b>${esc(x.i.title)}</b></td><td>${money(x.i.amount)}</td><td>${money(x.totalProfit)}</td><td class="font-bold text-rose-600">${money(x.donation)}</td></tr>`).join('')||'<tr><td colspan="4" class="text-center text-slate-400 py-6">কোনো ইনভেস্টমেন্ট নেই।</td></tr>'}
  </tbody></table></div>`);
}

function openDonationForm(){
 const fund=fundBalances();
 if(fund.donation<=0){toast('অনুদান তহবিলে বর্তমানে কোনো ব্যবহারযোগ্য টাকা নেই।',true);return}
 openModal('🤲 অনুদান তহবিল থেকে অর্থ প্রদান',`
  <div class="card-soft p-3 mb-4 flex items-center justify-between"><span class="font-bold">বর্তমান অনুদান জমা</span><b class="text-rose-600">${money(fund.donation)}</b></div>
  <form id="donationDisbursementForm" class="space-y-4">
   <div><div class="font-extrabold mb-2">১. Donor Information</div><div class="grid sm:grid-cols-2 gap-3">
    <input id="donorName" required placeholder="দাতার নাম" class="field">
    <textarea id="donorAddress" required rows="2" placeholder="যোগাযোগের ঠিকানা — বর্তমান ও স্থায়ী" class="field"></textarea>
    <input id="donorEmail" type="email" placeholder="ইমেইল" class="field">
    <input id="donorPhone" required placeholder="ফোন নম্বর" class="field">
    <input id="donorInstitution" placeholder="প্রতিষ্ঠানের নাম (যদি প্রযোজ্য)" class="field">
   </div></div>
   <div><div class="font-extrabold mb-2">২. Donation Details</div>
    <div class="flex flex-wrap gap-2 mb-2">
     <button type="button" class="btn btn-soft donation-preset" data-value="500">৳ ৫০০</button>
     <button type="button" class="btn btn-soft donation-preset" data-value="1000">৳ ১,০০০</button>
     <button type="button" class="btn btn-soft donation-preset" data-value="5000">৳ ৫,০০০</button>
     <button type="button" class="btn btn-soft donation-preset" data-value="">Other</button>
    </div>
    <input id="donationAmount" required type="number" min="0.01" step="0.01" placeholder="অনুদানের পরিমাণ" class="field">
    <div class="grid sm:grid-cols-2 gap-3 mt-3">
     <select id="donationFrequency" class="field"><option value="one-time">এককালীন</option><option value="monthly">মাসিক</option><option value="yearly">বার্ষিক</option></select>
     <select id="donationPurpose" class="field"><option value="general">সাধারণ তহবিল</option><option value="education">শিক্ষা</option><option value="medical">চিকিৎসা</option><option value="food">খাদ্য বিতরণ</option><option value="project">নির্দিষ্ট প্রজেক্ট</option></select>
    </div>
    <input id="donationProject" placeholder="নির্দিষ্ট প্রজেক্টের নাম (ঐচ্ছিক)" class="field mt-3">
   </div>
   <div><div class="font-extrabold mb-2">৩. Payment Methods</div><div class="grid sm:grid-cols-2 gap-3">
    <select id="donationPaymentType" class="field"><option value="cash">নগদ</option><option value="cheque">চেক</option><option value="bank_transfer">ব্যাংক ট্রান্সফার</option><option value="bkash">বিকাশ</option><option value="rocket">রকেট</option><option value="nagad">নগদ (Nagad)</option><option value="card">ডেবিট/ক্রেডিট কার্ড</option><option value="online">অনলাইন পেমেন্ট</option></select>
    <input id="donationTransactionId" placeholder="Transaction ID / Cheque No." class="field">
    <input id="donationBankName" placeholder="ব্যাংকের নাম (প্রয়োজনে)" class="field">
    <input id="donationBranch" placeholder="শাখার নাম (প্রয়োজনে)" class="field">
   </div></div>
   <div><div class="font-extrabold mb-2">৪. Legal & Institutional Info</div><div class="grid sm:grid-cols-2 gap-3">
    <select id="donationTaxRelief" class="field"><option value="unknown">ট্যাক্স ছাড় অজানা/প্রযোজ্য নয়</option><option value="yes">ট্যাক্স ছাড় প্রযোজ্য</option><option value="no">ট্যাক্স ছাড় প্রযোজ্য নয়</option></select>
    <input id="donorTin" placeholder="PAN / TIN নম্বর (ঐচ্ছিক)" class="field">
   </div>
   <label class="flex gap-3 items-start card-soft p-3 mt-3"><input id="donationPrivacy" required type="checkbox" class="w-5 h-5 mt-0.5"><span class="text-sm">দাতার তথ্য সুরক্ষিত রাখার নীতিতে সম্মতি দিচ্ছি।</span></label>
   <select id="donationVisibility" class="field mt-3"><option value="named">নাম প্রকাশযোগ্য</option><option value="anonymous">বেনামী (Anonymous)</option></select></div>
   <div><div class="font-extrabold mb-2">৫. স্বাক্ষর ও তারিখ</div><div class="grid sm:grid-cols-2 gap-3">
    <input id="donationDateTime" required type="datetime-local" class="field">
    <label class="flex gap-3 items-start card-soft p-3"><input id="donationTerms" required type="checkbox" class="w-5 h-5 mt-0.5"><span class="text-sm">Terms & Conditions মেনে নিচ্ছি।</span></label>
   </div></div>
   <div><label class="text-sm font-bold">ডকুমেন্টস (শুধু ছবি)</label><input id="donationDocument" type="file" accept="image/*" class="field mt-1"><p class="text-[11px] text-slate-500 mt-1">শুধু ছবি: JPG/PNG/WebP/AVIF</p></div>
   <button class="btn btn-success w-full">🤲 অর্থ প্রদান নিশ্চিত করুন</button>
  </form>`);
 $('donationDateTime').value=new Date().toISOString().slice(0,16);
 document.querySelectorAll('.donation-preset').forEach(b=>b.onclick=()=>{$('donationAmount').value=b.dataset.value||'';$('donationAmount').focus()});
 $('donationDisbursementForm').onsubmit=async e=>{
  e.preventDefault();
  try{
   const amount=positive($('donationAmount').value,'অনুদানের পরিমাণ');
   if(amount>fundBalances().donation)throw Error('অনুদান তহবিলে পর্যাপ্ত টাকা নেই');
   const file=$('donationDocument').files[0];
   if(file&&!file.type.startsWith('image/'))throw Error('ডকুমেন্টে শুধু ছবি আপলোড করা যাবে');
   const imageUrl=file?await uploadToImgBB(file):'';
   await save(s=>{
    s.donationDisbursements=[...(s.donationDisbursements||[]),{id:uid('D'),amount,donorName:$('donorName').value.trim(),donorAddress:$('donorAddress').value.trim(),donorEmail:$('donorEmail').value.trim(),donorPhone:$('donorPhone').value.trim(),institutionName:$('donorInstitution').value.trim(),frequency:$('donationFrequency').value,purpose:$('donationPurpose').value,projectName:$('donationProject').value.trim(),paymentType:$('donationPaymentType').value,transactionId:$('donationTransactionId').value.trim(),bankName:$('donationBankName').value.trim(),branchName:$('donationBranch').value.trim(),taxRelief:$('donationTaxRelief').value,tin:$('donorTin').value.trim(),privacyAccepted:$('donationPrivacy').checked,visibility:$('donationVisibility').value,date:$('donationDateTime').value,termsAccepted:$('donationTerms').checked,documentUrl:imageUrl,createdAt:new Date().toISOString()}];
    addNotif(s,'donation','অনুদান তহবিল থেকে '+money(amount)+' প্রদান করা হয়েছে');
   });
   closeModal();toast('অনুদান প্রদান সফলভাবে রেকর্ড হয়েছে');
  }catch(err){toast(err.message,true)}
 };
}

function openNetDividendLoanForm(){
 const fund=fundBalances();
 if(fund.netDividend<=0){toast('নীট লভ্যাংশ তহবিলে বর্তমানে কোনো ব্যবহারযোগ্য টাকা নেই।',true);return}
 openModal('💳 নীট লভ্যাংশ থেকে সদস্য ঋণ',`
  <div class="card-soft p-3 mb-4 flex items-center justify-between"><span class="font-bold">বর্তমান নীট লভ্যাংশ জমা</span><b class="text-cyan-700">${money(fund.netDividend)}</b></div>
  <form id="netDividendLoanForm" class="space-y-4">
   <div><div class="font-extrabold mb-2">সদস্য নির্বাচন</div><select id="loanMember" required class="field"></select></div>
   <div class="grid sm:grid-cols-2 gap-3">
    <input id="loanAmount" required type="number" min="0.01" step="0.01" placeholder="ঋণের পরিমাণ" class="field">
    <select id="loanRepaymentFrequency" class="field"><option value="monthly">মাসিক</option><option value="weekly">সাপ্তাহিক</option><option value="daily">দৈনিক</option></select>
   </div>
   <div class="grid sm:grid-cols-3 gap-3">
    <input id="loanDuration" required type="number" min="1" step="1" placeholder="সময়" class="field">
    <select id="loanDurationUnit" class="field"><option value="months">মাস</option><option value="weeks">সপ্তাহ</option><option value="days">দিন</option></select>
    <input id="loanDueDate" readonly class="field" placeholder="শেষ তারিখ">
   </div>
   <div class="card-soft p-3"><div class="font-bold text-sm mb-2">ঐচ্ছিক বিলম্ব ফি</div><div class="grid sm:grid-cols-2 gap-3">
    <select id="loanLateFeeType" class="field"><option value="none">কোনো বিলম্ব ফি নেই</option><option value="fixed">এককালীন নির্দিষ্ট ফি</option><option value="daily">প্রতিদিন নির্দিষ্ট ফি</option><option value="percent">মূল টাকার শতাংশ (%)</option></select>
    <input id="loanLateFeeValue" type="number" min="0" step="0.01" value="0" placeholder="ফি / শতাংশ" class="field">
   </div></div>
   <div><label class="text-sm font-bold">প্রয়োজনীয় ডকুমেন্ট (শুধু ছবি)</label><input id="loanDocument" type="file" accept="image/*" class="field mt-1"><p class="text-[11px] text-slate-500 mt-1">শুধুমাত্র ছবি যুক্ত করা যাবে।</p></div>
   <label class="flex gap-3 items-start card-soft p-3"><input checked disabled type="checkbox" class="w-5 h-5 mt-0.5"><span class="text-sm"><b>বিনা সুদে ঋণ</b><br><span class="text-slate-500">এই ঋণে কোনো সুদ গণনা হবে না।</span></span></label>
   <button class="btn btn-success w-full">💳 ঋণ প্রদান নিশ্চিত করুন</button>
  </form>`);
 $('loanMember').innerHTML=memberOptions();
 upgradeImageSelects();syncAllCustomSelects();
 const updateDue=()=>{
  const duration=Math.max(1,Number($('loanDuration').value)||0),unit=$('loanDurationUnit').value,d=new Date();
  if(unit==='days')d.setDate(d.getDate()+duration);else if(unit==='weeks')d.setDate(d.getDate()+duration*7);else d.setMonth(d.getMonth()+duration);
  $('loanDueDate').value=d.toISOString().slice(0,10);
 };
 $('loanDuration').oninput=updateDue;$('loanDurationUnit').onchange=updateDue;updateDue();
 $('netDividendLoanForm').onsubmit=async e=>{
  e.preventDefault();
  try{
   const memberId=$('loanMember').value,member=S.members.find(m=>m.id===memberId);
   if(!member)throw Error('সদস্য নির্বাচন করুন');
   const amount=positive($('loanAmount').value,'ঋণের পরিমাণ');
   if(amount>fundBalances().netDividend)throw Error('নীট লভ্যাংশ তহবিলে পর্যাপ্ত টাকা নেই');
   const file=$('loanDocument').files[0];
   if(file&&!file.type.startsWith('image/'))throw Error('ডকুমেন্টে শুধু ছবি আপলোড করা যাবে');
   const imageUrl=file?await uploadToImgBB(file):'';
   await save(s=>{
    s.netDividendLoans=[...(s.netDividendLoans||[]),{id:uid('L'),memberId:member.id,memberName:member.name,memberPhoto:photo(member,64),amount,date:today(),repaymentFrequency:$('loanRepaymentFrequency').value,duration:Number($('loanDuration').value),durationUnit:$('loanDurationUnit').value,dueDate:$('loanDueDate').value,interestRate:0,lateFeeType:$('loanLateFeeType').value,lateFeeValue:Number($('loanLateFeeValue').value)||0,documentUrl:imageUrl,repaidAmount:0,outstanding:amount,status:'active',createdAt:new Date().toISOString()}];
    addNotif(s,'loan',member.name+' কে নীট লভ্যাংশ থেকে '+money(amount)+' বিনা সুদে ঋণ প্রদান করা হয়েছে');
   });
   closeModal();toast(member.name+' কে সুদমুক্ত ঋণ প্রদান সফল হয়েছে');
  }catch(err){toast(err.message,true)}
 };
}


function getLocalReadNotificationIds(){
  try{return JSON.parse(localStorage.getItem('arjs_read_notification_ids')||'[]').filter(Boolean)}catch(e){return []}
}
function rememberReadNotificationIds(ids){
  try{
    const merged=[...new Set([...getLocalReadNotificationIds(),...(ids||[])])].slice(-300);
    localStorage.setItem('arjs_read_notification_ids',JSON.stringify(merged));
  }catch(e){}
}
function applyLocalNotificationReadState(){
  const ids=new Set(getLocalReadNotificationIds());
  if(!ids.size)return;
  S.notifications=(S.notifications||[]).map(n=>ids.has(n.id)?{...n,read:true}:n);
}
function markNotificationsRead(){
  const unread=(S.notifications||[]).filter(n=>!n.read);
  if(!unread.length){renderNotifications();return}
  // Persist the read state locally first so a fast refresh cannot restore the old unread badge.
  rememberReadNotificationIds(unread.map(n=>n.id));
  S.notifications=(S.notifications||[]).map(n=>({...n,read:true}));
  renderNotifications();
  // Then persist the same state to Firestore. The transaction reads the latest document
  // and changes only notification read flags, preventing stale snapshots from undoing it.
  runTransaction(db,async tx=>{
    const snap=await tx.get(mainRef);
    const cur=norm(snap.exists()?snap.data():{});
    const ids=new Set(unread.map(n=>n.id));
    cur.notifications=(cur.notifications||[]).map(n=>ids.has(n.id)?{...n,read:true}:n);
    tx.set(mainRef,cur,{merge:false});
  }).catch(err=>console.error('Notification read-state update failed:',err));
}
$('loginForm').onsubmit=async e=>{e.preventDefault();$('loginError').textContent='';const btn=$('loginSubmit');const text=btn?.querySelector('.login-btn-text'),loading=btn?.querySelector('.login-btn-loading');if(btn){btn.disabled=true;btn.classList.add('opacity-80');text?.classList.add('hiddenx');loading?.classList.remove('hiddenx')}try{await signInWithEmailAndPassword(auth,$('email').value.trim(),$('password').value)}catch(err){$('loginError').textContent='লগইন ব্যর্থ: ইমেইল/পাসওয়ার্ড যাচাই করুন';if(btn){btn.disabled=false;btn.classList.remove('opacity-80');text?.classList.remove('hiddenx');loading?.classList.add('hiddenx')}}};
if($('logout')) $('logout').onclick=()=>signOut(auth);$('ledgerMonth')?.addEventListener('change',renderFinance);$('ledgerClearMonth')?.addEventListener('click',()=>{if($('ledgerMonth'))$('ledgerMonth').value='';renderFinance()});$('memberSearch').oninput=renderMembers;$('memberStatusFilter').onchange=renderMembers;$('refreshMembers').onclick=renderMembers;


function loanRepaymentRows(loan){
 const rows=(loan.repayments||[]).slice().reverse();
 return rows.map((r,i)=>`<div class="card-soft p-3"><div class="flex items-start justify-between gap-3"><div class="min-w-0"><b class="block">কিস্তি ${rows.length-i}</b><div class="text-xs text-slate-500 mt-1">${esc(r.date||'—')} · ${esc(r.method==='cash'?'নগদ':r.method==='bank'?'ব্যাংক':r.method==='online'?'অনলাইন':r.method||'অন্যান্য')}</div>${r.reference?`<div class="text-xs text-slate-500 mt-1">রেফারেন্স: ${esc(r.reference)}</div>`:''}</div><b class="text-emerald-700 shrink-0">${money(r.amount)}</b></div></div>`).join('')||'<div class="text-center py-8 text-slate-400">এখনও কোনো পরিশোধের ইতিহাস নেই।</div>';
}
function openLoanHistory(loanId){
 const loan=getLoanById(loanId),member=S.members.find(m=>m.id===loan.memberId),repayments=loan.repayments||[];
 const totalPaid=repayments.reduce((a,r)=>a+Number(r.amount||0),0);
 openModal('ঋণ পরিশোধের ইতিহাস',`<div class="card-soft p-4 mb-4"><div class="flex items-center gap-3"><img src="${esc(member?photo(member,72):loan.memberPhoto||photo({},72))}" class="w-16 h-16 rounded-2xl object-cover shrink-0"><div class="min-w-0 flex-1"><b class="block text-lg truncate">${esc(member?.name||loan.memberName||'সদস্য')}</b><div class="text-xs text-slate-500 mt-1">ঋণ প্রদান: ${esc(loan.date||'—')} · শেষ তারিখ: ${esc(loan.dueDate||'—')}</div></div><span class="status ${loanStatusClass(loan._status)}">${loanStatusText(loan._status)}</span></div></div><div class="grid grid-cols-3 gap-2 mb-4"><div class="card-soft p-3"><span class="text-xs text-slate-500">মোট ঋণ</span><b class="block text-base text-cyan-700">${money(loan.amount)}</b></div><div class="card-soft p-3"><span class="text-xs text-slate-500">মোট পরিশোধ</span><b class="block text-base text-emerald-700">${money(totalPaid||loan.repaidAmount)}</b></div><div class="card-soft p-3"><span class="text-xs text-slate-500">বর্তমান বকেয়া</span><b class="block text-base text-red-600">${money(loan.outstanding)}</b></div></div><div class="flex items-center justify-between gap-2 mb-3"><h3 class="font-extrabold">পূর্বের কিস্তি/পরিশোধ</h3><span class="text-xs text-slate-500">${repayments.length.toLocaleString('bn-BD')}টি রেকর্ড</span></div><div class="space-y-2 max-h-[55vh] overflow-y-auto">${loanRepaymentRows(loan)}</div>${loan.outstanding>0?`<button type="button" id="historyRepayBtn" class="btn btn-success w-full mt-4">➕ নতুন কিস্তি এন্ট্রি</button>`:''}`);
 if($('historyRepayBtn'))$('historyRepayBtn').onclick=()=>{closeModal();openLoanRepaymentForm(loanId)};
}
function openLoanMemberProfile(loanId){
 const loan=getLoanById(loanId),member=S.members.find(m=>m.id===loan.memberId)||{name:loan.memberName,photoUrl:loan.memberPhoto},stats=memberLoanStats(loan.memberId);
 openModal('ঋণ সদস্য প্রোফাইল',`<div class="rounded-2xl overflow-hidden bg-white"><div class="profile-cover h-24"><img class="profile-cover-photo" src="images/embedded-10.jpg" alt="প্রোফাইল কভার"></div><div class="px-4 pb-5 border border-t-0 rounded-b-2xl"><div class="flex items-end gap-3 -mt-10"><img class="member-avatar w-20 h-20 rounded-2xl object-cover border-4 border-white shadow-lg bg-white" src="${esc(photo(member,88))}"><div class="pb-1 min-w-0"><h2 class="text-xl font-extrabold truncate">${esc(member.name||loan.memberName||'সদস্য')}</h2><div class="text-xs text-slate-500">${esc(member.id||loan.memberId||'')} · ${esc(member.phone||'')}</div></div></div><div class="grid grid-cols-3 gap-2 mt-4"><div class="card-soft p-3"><small class="text-slate-500">চলমান</small><b class="block text-cyan-700">${money(stats.running.reduce((a,x)=>a+x._outstanding,0))}</b></div><div class="card-soft p-3"><small class="text-slate-500">বকেয়া</small><b class="block text-red-600">${money(stats.overdue.reduce((a,x)=>a+x._outstanding,0))}</b></div><div class="card-soft p-3"><small class="text-slate-500">পরিশোধকৃত</small><b class="block text-emerald-700">${money(stats.paid.reduce((a,x)=>a+Number(x.amount||0),0))}</b></div></div><div class="card-soft p-4 mt-4"><div class="flex items-start justify-between gap-3"><div><b>নির্বাচিত ঋণ</b><div class="text-xs text-slate-500 mt-1">${esc(loan.date||'—')} · শেষ তারিখ ${esc(loan.dueDate||'—')}</div></div><span class="status ${loanStatusClass(loan._status)}">${loanStatusText(loan._status)}</span></div><div class="grid grid-cols-2 gap-2 mt-3 text-sm"><div><span class="text-slate-500">মোট ঋণ</span><b class="block">${money(loan.amount)}</b></div><div><span class="text-slate-500">বর্তমান বকেয়া</span><b class="block text-red-600">${money(loan.outstanding)}</b></div></div></div><div class="grid grid-cols-2 gap-2 mt-4">${loan.outstanding>0?`<button type="button" id="loanProfileRepay" class="btn btn-success">➕ কিস্তি এন্ট্রি</button>`:''}<button type="button" id="loanProfileHistory" class="btn btn-soft ${loan.outstanding>0?'':'col-span-2'}">🕘 পরিশোধের ইতিহাস</button></div></div></div>`);
 if($('loanProfileRepay'))$('loanProfileRepay').onclick=()=>{closeModal();openLoanRepaymentForm(loanId)};
 $('loanProfileHistory').onclick=()=>{closeModal();openLoanHistory(loanId)};
}

function renderLoanCenter(mode='running'){
 const all=(S.netDividendLoans||[]).map(x=>({...x,_status:loanStatus(x),_outstanding:Number(x.outstanding??(Number(x.amount||0)-Number(x.repaidAmount||0)))}));
 const counts={running:all.filter(x=>x._status==='running').length,overdue:all.filter(x=>x._status==='overdue').length,paid:all.filter(x=>x._status==='paid').length};
 $('loanNavRunningCount').textContent=counts.running.toLocaleString('bn-BD');$('loanNavOverdueCount').textContent=counts.overdue.toLocaleString('bn-BD');$('loanNavPaidCount').textContent=counts.paid.toLocaleString('bn-BD');
 const rows=all.filter(x=>x._status===mode);
 $('loanNavRows').innerHTML=rows.map(l=>`<div class="card-soft p-3"><div class="flex items-center gap-3"><button type="button" class="loan-member-profile flex items-center gap-3 min-w-0 flex-1 text-left" data-loan-id="${esc(l.id)}"><img src="${esc(l.memberPhoto||photo(S.members.find(m=>m.id===l.memberId)||{},64))}" class="w-14 h-14 rounded-2xl object-cover bg-slate-100 shrink-0"><span class="min-w-0"><b class="block truncate">${esc(l.memberName||'সদস্য')}</b><span class="text-xs text-slate-500 block mt-1">ঋণ: ${money(l.amount)} · বকেয়া: ${money(l._outstanding)}</span><span class="text-xs text-slate-500">শেষ তারিখ: ${esc(l.dueDate||'—')}</span></span></button><span class="status ${loanStatusClass(l._status)} shrink-0">${loanStatusText(l._status)}</span></div><div class="grid grid-cols-2 gap-2 mt-3">${l._status!=='paid'?`<button type="button" class="btn btn-success text-xs loan-installment-btn" data-loan-id="${esc(l.id)}">➕ কিস্তি এন্ট্রি</button>`:'<div class="btn bg-slate-100 text-slate-500 text-xs">✓ সম্পূর্ণ পরিশোধ</div>'}<button type="button" class="btn btn-soft text-xs loan-history-btn" data-loan-id="${esc(l.id)}">🕘 পরিশোধের হিস্ট্রি</button></div></div>`).join('')||'<div class="card-soft p-8 text-center text-slate-400">এই বিভাগে কোনো ঋণ নেই।</div>';
 document.querySelectorAll('.loan-member-profile').forEach(b=>b.onclick=()=>openLoanMemberProfile(b.dataset.loanId));
 document.querySelectorAll('.loan-installment-btn').forEach(b=>b.onclick=()=>openLoanRepaymentForm(b.dataset.loanId));
 document.querySelectorAll('.loan-history-btn').forEach(b=>b.onclick=()=>openLoanHistory(b.dataset.loanId));
}
function activateMainView(action){
 const summary=$('dashboardSummary');
 const homeNotice=$('homeCurrentNotice');
 document.querySelectorAll('.tab-panel').forEach(x=>x.classList.add('hiddenx'));
 document.querySelectorAll('.admin-main-nav .tab').forEach(x=>x.classList.remove('tab-active'));
 const btn=document.querySelector(`.admin-main-nav .tab[data-nav-action="${action}"]`);btn?.classList.add('tab-active');
 if(summary)summary.classList.toggle('hiddenx',action!=='home');
 if(homeNotice)homeNotice.classList.toggle('hiddenx',action!=='home');
 if(action==='home')return;
 if(action==='settings'){$('settingsModal').classList.remove('hiddenx');return;}
 const panel=$('tab-'+action);if(panel)panel.classList.remove('hiddenx');
 if(action==='loans')renderLoanCenter('running');if(action==='donation-history')renderDonationHistory();if(action==='analysis')renderAnalysis();
 window.scrollTo({top:0,behavior:'smooth'});
}
/* Hosting-safe sub-links: hash routing keeps every section under the same hosted file. */
const MAIN_ROUTE_ACTIONS=['home','analysis','investment','members','loans','donation-history'];
function normalizeMainRoute(){
 const raw=(location.hash||'').replace(/^#\/?/,'').split('/')[0].trim().toLowerCase();
 return MAIN_ROUTE_ACTIONS.includes(raw)?raw:'home';
}
function openMainRoute(action,{updateHash=true}={}){
 activateMainView(action);
 if(updateHash){
   const next='#/'+action;
   if(location.hash!==next) history.pushState(null,'',next);
 }
}
document.querySelectorAll('.admin-main-nav .tab[data-nav-action]').forEach(b=>b.onclick=()=>{
 const action=b.dataset.navAction;
 if(action==='settings'){activateMainView(action);return;}
 openMainRoute(action);
});
window.addEventListener('hashchange',()=>openMainRoute(normalizeMainRoute(),{updateHash:false}));
window.addEventListener('popstate',()=>openMainRoute(normalizeMainRoute(),{updateHash:false}));
setTimeout(()=>openMainRoute(normalizeMainRoute(),{updateHash:false}),0);
$('loanNavRunning')?.addEventListener('click',()=>renderLoanCenter('running'));$('loanNavOverdue')?.addEventListener('click',()=>renderLoanCenter('overdue'));$('loanNavPaid')?.addEventListener('click',()=>renderLoanCenter('paid'));
activateMainView('home');
$('open-add-member').onclick=()=>$('addMemberModal').classList.remove('hiddenx');$('closeAddMember').onclick=$('cancelAddMember').onclick=()=>$('addMemberModal').classList.add('hiddenx');$('modalClose').onclick=closeModal;
document.addEventListener('click',e=>{const p=e.target.closest('[data-profile]'),i=e.target.closest('[data-investment]');if(e.target.closest('[data-full-image]'))return;if(p)openProfile(p.dataset.profile);if(i)openInvestment(i.dataset.investment)});
$('sbMember').onchange=updateAvailable;$('bulkSelectAll').onclick=()=>document.querySelectorAll('.bulk-member').forEach(x=>x.checked=true);$('toggleBankUpdate').onclick=()=>$('bankForm').classList.toggle('hiddenx');
$('donationFundCard').onclick=openDonationForm;$('netDividendFundCard').onclick=openNetDividendLoanForm;$('statInvestmentCard')?.addEventListener('click',investmentDonationReport);$('open-notifications').onclick=()=>{renderNotifications();$('notificationsModal').classList.remove('hiddenx');markNotificationsRead()};$('close-notifications').onclick=()=>$('notificationsModal').classList.add('hiddenx');
$('settings-logout').onclick=async()=>{if(confirm('আপনি কি অ্যাডমিন প্যানেল থেকে লগ আউট করতে চান?')){try{await signOut(auth)}catch(err){toast(err.message||'লগ আউট করা যায়নি',true)}}};$('open-settings').onclick=()=>{const b=S.brand||DEFAULT_BRAND;$('sName').value=b.name||'';$('sTagline').value=b.tagline||'';$('sEstablished').value=b.established||'';$('sLogoUrl').value=b.logoUrl||'';$('settingsLogoPreview').src=b.logoUrl||'https://placehold.co/80x80/EEF2FF/4338CA?text=Logo';$('settingsModal').classList.remove('hiddenx')};$('close-settings').onclick=$('cancel-settings').onclick=()=>$('settingsModal').classList.add('hiddenx');
$('sLogoFile').onchange=()=>{const f=$('sLogoFile').files[0];if(f)$('settingsLogoPreview').src=URL.createObjectURL(f)};
$('settingsForm').onsubmit=async e=>{e.preventDefault();try{let logo=$('sLogoUrl').value.trim();if($('sLogoFile').files[0])logo=await uploadToImgBB($('sLogoFile').files[0]);await save(s=>{s.brand={name:$('sName').value.trim(),tagline:$('sTagline').value.trim(),established:$('sEstablished').value.trim(),logoUrl:logo||s.brand.logoUrl||''};addNotif(s,'system','হেডার সেটিংস আপডেট হয়েছে')});$('settingsModal').classList.add('hiddenx');e.target.reset();toast('সেটিংস আপডেট হয়েছে')}catch(err){toast(err.message,true)}};$('delete-all-member-transactions-btn').onclick=async()=>{const count=S.members.reduce((n,m)=>n+(m.transactions||[]).length,0);if(!count){toast('কোনো সদস্য লেনদেন নেই',true);return}if(!confirm('প্রথম অনুমতি: সকল সদস্যের মোট '+count+'টি লেনদেন মুছে ফেলতে চান?'))return;if(!confirm('দ্বিতীয় অনুমতি: সকল সদস্যের সঞ্চয়/ব্যাংক জমা/বকেয়া/জরিমানার লেনদেন মুছে যাবে। মুনাফা/লভাংশের ইতিহাস থাকবে। আপনি কি নিশ্চিত?'))return;if(!confirm('তৃতীয় ও শেষ অনুমতি: এই কাজ পূর্বাবস্থায় ফেরানো যাবে না। সত্যিই সকল সদস্যের লেনদেন ডিলেট করবেন?'))return;try{await save(s=>{s.members=(s.members||[]).map(m=>({...m,transactions:[]}));addNotif(s,'member','সকল সদস্যের লেনদেনের ইতিহাস ডিলেট করা হয়েছে')});toast('সকল সদস্যের লেনদেন ডিলেট হয়েছে')}catch(err){toast('লেনদেন ডিলেট করা যায়নি: '+(err.message||err),true)}};$('delete-all-data-btn').onclick=async()=>{if(!confirm('প্রথম অনুমতি: এই অ্যাপের Firestore ডাটাবেজের সকল তথ্য স্থায়ীভাবে মুছে ফেলতে চান?'))return;if(!confirm('দ্বিতীয় অনুমতি: সদস্য, সঞ্চয়, ব্যাংক, আয়, ব্যয়, ইনভেস্টমেন্ট, লাভ, নোটিশ ও notification—সব তথ্য মুছে যাবে। আপনি কি নিশ্চিত?'))return;if(!confirm('তৃতীয় ও শেষ অনুমতি: এই কাজ পূর্বাবস্থায় ফেরানো যাবে না। সত্যিই কি সকল ডাটা স্থায়ীভাবে ডিলেট করবেন?'))return;try{$('settingsModal').classList.add('hiddenx');await deleteDoc(mainRef);S=norm({});render();toast('সকল Firestore ডাটা স্থায়ীভাবে ডিলেট হয়েছে')}catch(err){console.error(err);toast('ডাটা ডিলেট করা যায়নি: '+(err.message||err),true)}};
const markedKeys=['members','investments','profitEntries','donationDisbursements','netDividendLoans','loanRepayments','bankUpdates','bankLedger','incomeEntries','expenses','notifications','activityLog','governanceFiles','notice','brand'];
$('markAllData').onchange=()=>document.querySelectorAll('.marked-data').forEach(x=>x.checked=$('markAllData').checked);
document.querySelectorAll('.marked-data').forEach(x=>x.onchange=()=>{$('markAllData').checked=[...document.querySelectorAll('.marked-data')].every(c=>c.checked)});
$('delete-marked-data-btn').onclick=async()=>{const keys=[...document.querySelectorAll('.marked-data:checked')].map(x=>x.dataset.key);if(!keys.length){toast('কমপক্ষে একটি তথ্য বিভাগ মার্ক করুন',true);return}if(!confirm('প্রথম অনুমতি: '+keys.length+'টি নির্বাচিত তথ্য বিভাগ স্থায়ীভাবে ডিলেট করতে চান?'))return;if(!confirm('দ্বিতীয় অনুমতি: নির্বাচিত বিভাগের সব তথ্য মুছে যাবে। অন্য বিভাগের তথ্য থাকবে। আপনি কি নিশ্চিত?'))return;if(!confirm('তৃতীয় ও শেষ অনুমতি: নির্বাচিত তথ্য পূর্বাবস্থায় ফেরানো যাবে না। সত্যিই ডিলেট করবেন?'))return;try{await save(s=>{for(const k of keys){if(k==='notice')s.notice={...DEFAULT_NOTICE};else if(k==='brand')s.brand={...DEFAULT_BRAND};else if(Object.prototype.hasOwnProperty.call(s,k))s[k]=[]}});document.querySelectorAll('.marked-data').forEach(x=>x.checked=false);$('markAllData').checked=false;toast('নির্বাচিত তথ্য স্থায়ীভাবে ডিলেট হয়েছে')}catch(err){console.error(err);toast('নির্বাচিত তথ্য ডিলেট করা যায়নি: '+(err.message||err),true)}};

$('change-password-btn').onclick=async()=>{const pass=$('sNewPassword').value.trim();if(pass.length<6)return toast('পাসওয়ার্ড অন্তত ৬ অক্ষরের হতে হবে',true);try{await updatePassword(auth.currentUser,pass);$('sNewPassword').value='';toast('পাসওয়ার্ড আপডেট হয়েছে')}catch(err){toast(err.code==='auth/requires-recent-login'?'নিরাপত্তার জন্য আবার লগইন করে চেষ্টা করুন':err.message,true)}};
$('memberForm').onsubmit=async e=>{e.preventDefault();try{const id=$('mId').value.trim();if(S.members.some(m=>m.id===id))throw Error('এই সদস্য ID আগে থেকেই আছে');let photoUrl=$('mPhotoUrl').value.trim();if($('mPhoto').files[0])photoUrl=await uploadToImgBB($('mPhoto').files[0]);const docFiles=Array.from($('mDocuments').files||[]),docTitle=$('mDocumentTitle').value.trim();if(docFiles.length&&!docTitle)throw Error('ডকুমেন্টের শিরোনাম দিন');if(docFiles.some(f=>!f.type.startsWith('image/')))throw Error('সদস্যদের ডকুমেন্টে শুধু ছবি আপলোড করা যাবে');const uploadedDocs=await uploadMemberDocuments(docFiles,'members/'+id);const docs=uploadedDocs.map((d,i)=>({...d,title:docTitle,name:docTitle+(uploadedDocs.length>1?' — '+(i+1):'')}));const member={id,name:$('mName').value.trim(),phone:$('mPhone').value.trim(),email:$('mEmail').value.trim(),nid:$('mNid').value.trim(),employeeId:$('mEmployeeId').value.trim(),cardNumber:$('mCardNumber').value.trim(),designation:$('mDesignation').value.trim(),responsibilities:[],nominee:$('mNominee').value.trim(),notes:$('mNotes').value.trim(),status:$('mStatus').value,isActive:$('mStatus').value==='active',messageEnabled:true,photoUrl:photoUrl||'',documents:docs,transactions:[]};if(!member.name||!member.phone)throw Error('নাম ও মোবাইল আবশ্যক');await save(s=>{s.members=[...(s.members||[]),member];addNotif(s,'member','নতুন সদস্য '+member.name+' যোগ হয়েছে')});e.target.reset();$('addMemberModal').classList.add('hiddenx');toast('সদস্য সফলভাবে সেভ হয়েছে')}catch(err){toast(err.message,true)}};
$('depositForm').onsubmit=async e=>{e.preventDefault();try{const id=$('dMember').value,amount=positive($('dAmount').value,'জমার পরিমাণ');if(!id)throw Error('সদস্য নির্বাচন করুন');const waTx={id:uid('T'),type:'deposit',amount,date:$('dDate').value,reference:$('dRef').value.trim(),createdAt:new Date().toISOString()};let waMember=null;await save(s=>{s.members=(s.members||[]).map(m=>m.id===id?{...m,transactions:[...(m.transactions||[]),waTx]}:m);waMember=s.members.find(x=>x.id===id);addNotif(s,'member',waMember.name+' এর সঞ্চয় '+money(amount)+' এন্ট্রি হয়েছে')});if(waMember&&window.ARJSBD_showEntryWhatsApp)window.ARJSBD_showEntryWhatsApp(waMember,waTx);e.target.reset();function injectBankBalanceCards(){
 const specs=[['depositForm','depositForm','জমা দেওয়ার পর ব্যাংক ব্যালেন্স'],['incomeForm','incomeForm','আয় যোগ হলে ব্যাংক ব্যালেন্স'],['expenseForm','expenseForm','ব্যয় করার আগে বর্তমান ব্যাংক ব্যালেন্স'],['investmentForm','investmentForm','ইনভেস্টমেন্টের আগে বর্তমান ব্যাংক ব্যালেন্স'],['profitForm','profitForm','মুনাফা এন্ট্রির সময় বর্তমান ব্যাংক ব্যালেন্স'],['savingsBankForm','savingsBankForm','সঞ্চয় ব্যাংকে জমার বর্তমান ব্যালেন্স']];specs.forEach(([id])=>{const f=$(id);if(!f||f.dataset.bankCard==='1')return;const card=document.createElement('div');card.className='bank-inline-card';card.innerHTML='<span>🏦 বর্তমান ব্যাংক ব্যালেন্স</span><b>'+money(currentBank())+'</b>';f.parentElement.insertBefore(card,f);f.dataset.bankCard='1'});document.querySelectorAll('.bank-inline-card b').forEach(x=>x.textContent=money(currentBank()))}
$('dDate').value=today();toast('সঞ্চয় এন্ট্রি সেভ হয়েছে')}catch(err){toast(err.message,true)}};
$('bulkDepositBtn').onclick=async()=>{try{const ids=[...document.querySelectorAll('.bulk-member:checked')].map(x=>x.value),amount=positive($('bulkAmount').value,'প্রতি সদস্যের পরিমাণ'),date=$('bulkDate').value;if(!ids.length)throw Error('অন্তত একজন সদস্য নির্বাচন করুন');const waItems=[];await save(s=>{s.members=(s.members||[]).map(m=>{if(!ids.includes(m.id))return m;const tx={id:uid('T'),type:'deposit',amount,date,reference:'Bulk monthly saving',createdAt:new Date().toISOString()};const mm={...m,transactions:[...(m.transactions||[]),tx]};waItems.push({member:mm,tx});return mm});addNotif(s,'member',ids.length+' জন সদস্যের মাসিক সঞ্চয় একসাথে এন্ট্রি হয়েছে')});if(window.ARJSBD_showEntriesWhatsApp)window.ARJSBD_showEntriesWhatsApp(waItems);document.querySelectorAll('.bulk-member').forEach(x=>x.checked=false);$('bulkAmount').value='';toast('Bulk সঞ্চয় এন্ট্রি হয়েছে')}catch(err){toast(err.message,true)}};
$('dueForm').onsubmit=async e=>{e.preventDefault();try{const id=$('dueMember').value,amount=positive($('dueAmount').value,'পরিমাণ');if(!id)throw Error('সদস্য নির্বাচন করুন');const waTx={id:uid('D'),type:$('dueType').value,amount,date:$('dueDate').value,reference:$('dueRef').value.trim(),createdAt:new Date().toISOString()};let waMember=null;await save(s=>{s.members=(s.members||[]).map(m=>m.id===id?{...m,transactions:[...(m.transactions||[]),waTx]}:m);waMember=s.members.find(x=>x.id===id);addNotif(s,'member',waMember.name+' এর '+($('dueType').value==='due'?'বকেয়া':'জরিমানা')+' '+money(amount)+' এন্ট্রি হয়েছে')});if(waMember&&window.ARJSBD_showEntryWhatsApp)window.ARJSBD_showEntryWhatsApp(waMember,waTx);e.target.reset();$('dueDate').value=today();toast('বকেয়া/জরিমানা সেভ হয়েছে')}catch(err){toast(err.message,true)}};
async function bankDepositForMember(id,amount,refText=''){const m=S.members.find(x=>x.id===id);if(!m)throw Error('সদস্য নির্বাচন করুন');const avail=availableSavings(m);if(amount>avail)throw Error(m.name+' এর উপলভ্য সঞ্চয়ের চেয়ে বেশি জমা দেওয়া যাবে না');const waTx={id:uid('BD'),type:'bank_deposit',amount,date:$('sbDate').value,reference:refText,createdAt:new Date().toISOString()};let waMember=null;await save(s=>{s.members=(s.members||[]).map(x=>x.id===id?{...x,transactions:[...(x.transactions||[]),waTx]}:x);waMember=s.members.find(x=>x.id===id);bankAppend(s,amount,'member_savings_deposit','Member savings bank deposit — '+m.name,'member_savings',refText);addNotif(s,'bank',m.name+' এর '+money(amount)+' সঞ্চয় ব্যাংকে জমা নিশ্চিত হয়েছে')});if(waMember&&window.ARJSBD_showEntryWhatsApp)window.ARJSBD_showEntryWhatsApp(waMember,waTx)}
$('savingsBankForm').onsubmit=async e=>{e.preventDefault();try{const id=$('sbMember').value,amount=positive($('sbAmount').value,'ব্যাংকে জমার পরিমাণ');await bankDepositForMember(id,amount,$('sbRef').value.trim());e.target.reset();$('sbDate').value=today();$('sbAvailable').innerHTML='উপলভ্য সঞ্চয়: <b>৳ ০</b>';toast('সঞ্চয় ব্যাংকে জমা হয়েছে')}catch(err){toast(err.message,true)}};
$('sbFullBtn').onclick=async()=>{try{const id=$('sbMember').value;if(!id)throw Error('সদস্য নির্বাচন করুন');const m=S.members.find(x=>x.id===id);const amount=availableSavings(m);if(amount<=0)throw Error('এই সদস্যের available savings নেই');await bankDepositForMember(id,amount,'Full available savings');$('sbAmount').value='';toast('নির্বাচিত সদস্যের সব available savings ব্যাংকে জমা হয়েছে')}catch(err){toast(err.message,true)}};
$('sbAllBtn').onclick=async()=>{try{const members=S.members.filter(m=>availableSavings(m)>0);if(!members.length)throw Error('কোনো available savings নেই');if(!confirm(members.length+' জন সদস্যের সব available savings ব্যাংকে জমা করবেন?'))return;const total=members.reduce((a,m)=>a+availableSavings(m),0);const waItems=[];await save(s=>{s.members=(s.members||[]).map(x=>{const amt=availableSavings(x);if(!amt)return x;const tx={id:uid('BD'),type:'bank_deposit',amount:amt,date:$('sbDate').value,reference:'All available savings',createdAt:new Date().toISOString()};const mm={...x,transactions:[...(x.transactions||[]),tx]};waItems.push({member:mm,tx});return mm});bankAppend(s,total,'member_savings_bulk_deposit','All available member savings deposited','member_savings_bulk','All available savings');addNotif(s,'bank','সকল সদস্যের '+money(total)+' available savings ব্যাংকে জমা হয়েছে')});if(window.ARJSBD_showEntriesWhatsApp)window.ARJSBD_showEntriesWhatsApp(waItems);toast('সকল available savings ব্যাংকে জমা হয়েছে')}catch(err){toast(err.message,true)}};
$('incomeForm').onsubmit=async e=>{e.preventDefault();try{const amount=positive($('incomeAmount').value,'আয়ের পরিমাণ');await save(s=>{const entry={id:uid('IN'),title:$('incomeTitle').value.trim(),amount,date:$('incomeDate').value,reference:$('incomeRef').value.trim(),note:$('incomeNote').value.trim()};s.incomeEntries=[...(s.incomeEntries||[]),entry];bankAppend(s,amount,'income','Income — '+entry.title,'income',entry.reference);addNotif(s,'income','আয় '+entry.title+' — '+money(amount)+' ব্যাংকে যোগ হয়েছে')});e.target.reset();$('incomeDate').value=today();toast('আয় সেভ হয়েছে')}catch(err){toast(err.message,true)}};
$('expenseForm').onsubmit=async e=>{e.preventDefault();try{const amount=positive($('expenseAmount').value,'খরচের পরিমাণ');const url=await upload($('expenseFile').files[0],'expenses');await save(s=>{const entry={id:uid('E'),title:$('expenseTitle').value.trim(),amount,date:$('expenseDate').value,fileUrl:url||'',note:$('expenseNote').value.trim()};s.expenses=[...(s.expenses||[]),entry];bankAppend(s,-amount,'expense','Expense — '+entry.title,'expense');addNotif(s,'expense','খরচ '+entry.title+' — '+money(amount)+' ব্যাংক থেকে কাটা হয়েছে')});e.target.reset();$('expenseDate').value=today();toast('খরচ সেভ হয়েছে')}catch(err){toast(err.message,true)}};
$('bankForm').onsubmit=async e=>{e.preventDefault();try{const target=Number($('bankBalance').value);if(!Number.isFinite(target)||target<0)throw Error('ব্যাংক ব্যালেন্স সঠিকভাবে দিন');const current=currentBank(),delta=target-current,url=await upload($('bankFile').files[0],'bank-statements');await save(s=>{s.bankUpdates=[...(s.bankUpdates||[]),{id:uid('B'),balance:target,date:$('bankDate').value,fileUrl:url||'',updatedAt:new Date().toISOString()}];if(delta)bankAppend(s,delta,'manual_adjustment','Manual bank balance adjustment','bank_update');addNotif(s,'bank','ব্যাংক ব্যালেন্স '+money(target)+' করা হয়েছে')});e.target.reset();$('bankDate').value=today();$('bankForm').classList.add('hiddenx');toast('ব্যাংক ব্যালেন্স আপডেট হয়েছে')}catch(err){toast(err.message,true)}};
$('investmentForm').onsubmit=async e=>{e.preventDefault();try{const amount=positive($('invAmount').value,'ইনভেস্টমেন্ট');const image=$('invImage').files[0]?await uploadToImgBB($('invImage').files[0]):$('invImageUrl').value.trim();await save(s=>{const entry={id:uid('I'),title:$('invTitle').value.trim(),amount,startDate:$('invStart').value,endDate:$('invEnd').value,timeline:$('invTimeline').value.trim(),imageUrl:image||'',note:$('invNote').value.trim(),status:'running',financialApplied:$('invBankConfirmed').checked,createdAt:new Date().toISOString()};s.investments=[...(s.investments||[]),entry];if(entry.financialApplied)bankAppend(s,-amount,'investment','Investment — '+entry.title,'investment',entry.id);addNotif(s,'investment','নতুন ইনভেস্টমেন্ট '+entry.title+' — '+money(amount)+(entry.financialApplied?' ব্যাংক থেকে কাটা হয়েছে':''))});e.target.reset();$('invStart').value=today();toast('ইনভেস্টমেন্ট সেভ হয়েছে')}catch(err){toast(err.message,true)}};
$('profitForm').onsubmit=e=>{e.preventDefault();try{openProfitPreview()}catch(err){toast(err.message,true)}};
$('auditForm').onsubmit=async e=>{e.preventDefault();try{const url=await upload($('auditFile').files[0],'governance/audits');if(!url)throw Error('অডিট PDF নির্বাচন করুন');await save(s=>{s.governanceFiles=[...(s.governanceFiles||[]),{id:uid('G'),type:'Annual Audit Report',title:`অডিট রিপোর্ট — ${$('auditYear').value}`,date:today(),url,note:$('auditNote').value.trim()}];addNotif(s,'system','অডিট রিপোর্ট আপলোড হয়েছে')});e.target.reset();toast('অডিট রিপোর্ট আপলোড হয়েছে')}catch(err){toast(err.message,true)}};
function injectBankBalanceCards(){
 const specs=[['depositForm','depositForm','জমা দেওয়ার পর ব্যাংক ব্যালেন্স'],['incomeForm','incomeForm','আয় যোগ হলে ব্যাংক ব্যালেন্স'],['expenseForm','expenseForm','ব্যয় করার আগে বর্তমান ব্যাংক ব্যালেন্স'],['investmentForm','investmentForm','ইনভেস্টমেন্টের আগে বর্তমান ব্যাংক ব্যালেন্স'],['profitForm','profitForm','মুনাফা এন্ট্রির সময় বর্তমান ব্যাংক ব্যালেন্স'],['savingsBankForm','savingsBankForm','সঞ্চয় ব্যাংকে জমার বর্তমান ব্যালেন্স']];specs.forEach(([id])=>{const f=$(id);if(!f||f.dataset.bankCard==='1')return;const card=document.createElement('div');card.className='bank-inline-card';card.innerHTML='<span>🏦 বর্তমান ব্যাংক ব্যালেন্স</span><b>'+money(currentBank())+'</b>';f.parentElement.insertBefore(card,f);f.dataset.bankCard='1'});document.querySelectorAll('.bank-inline-card b').forEach(x=>x.textContent=money(currentBank()))}
$('dDate').value=today();$('bulkDate').value=today();$('sbDate').value=today();$('dueDate').value=today();$('incomeDate').value=today();$('expenseDate').value=today();$('bankDate').value=today();$('invStart').value=today();$('profitDate').value=today();
function upgradeImageSelects(){
  document.querySelectorAll('select.field').forEach(sel=>{
    if(sel.dataset.customSelect==='1') return;
    const wrap=document.createElement('div');wrap.className='custom-select-wrap';
    sel.parentNode.insertBefore(wrap,sel);wrap.appendChild(sel);sel.dataset.customSelect='1';sel.classList.add('native-select-hidden');
    const trigger=document.createElement('button');trigger.type='button';trigger.className='field custom-select-trigger';
    trigger.setAttribute('aria-haspopup','listbox');trigger.setAttribute('aria-expanded','false');
    const menu=document.createElement('div');menu.className='custom-select-menu hiddenx';menu.setAttribute('role','listbox');
    wrap.appendChild(trigger);wrap.appendChild(menu);
    const rebuild=()=>{
      menu.innerHTML='';
      [...sel.options].forEach((opt,idx)=>{
        const b=document.createElement('button');b.type='button';b.className='custom-select-option'+(opt.selected?' selected':'');b.dataset.value=opt.value;b.setAttribute('role','option');
        const img=opt.dataset.img;
        if(img){const im=document.createElement('img');im.src=img;im.alt='';im.loading='lazy';im.onerror=()=>{im.src='https://placehold.co/40x40/EEF2FF/4338CA?text=?'};b.appendChild(im)}
        const copy=document.createElement('div');copy.className='option-copy';
        const title=document.createElement('div');title.className='option-title';title.textContent=opt.textContent||'নির্বাচন';copy.appendChild(title);
        if(opt.dataset.sub){const sub=document.createElement('div');sub.className='option-sub';sub.textContent=opt.dataset.sub;copy.appendChild(sub)}
        b.appendChild(copy);b.onclick=()=>{sel.value=opt.value;sel.dispatchEvent(new Event('change',{bubbles:true}));closeCustomSelect(wrap)};menu.appendChild(b);
      });
      if(!sel.options.length){menu.innerHTML='<div class="custom-select-empty">কোনো তথ্য নেই</div>'}
      syncCustomSelect(wrap);
    };
    const syncCustomSelect=()=>{
      const opt=sel.options[sel.selectedIndex];
      trigger.innerHTML='';
      const value=document.createElement('span');value.className='select-value';
      if(opt && opt.dataset.img){const im=document.createElement('img');im.src=opt.dataset.img;im.alt='';im.loading='lazy';im.onerror=()=>{im.src='https://placehold.co/34x34/EEF2FF/4338CA?text=?'};value.appendChild(im)}
      const text=document.createElement('span');text.className='select-value-text';text.textContent=opt?.textContent||'নির্বাচন করুন';value.appendChild(text);trigger.appendChild(value);
      const arrow=document.createElement('span');arrow.className='custom-select-arrow';arrow.textContent='▾';trigger.appendChild(arrow);
      menu.querySelectorAll('.custom-select-option').forEach(x=>x.classList.toggle('selected',x.dataset.value===sel.value));
    };
    const close=()=>closeCustomSelect(wrap);
    trigger.onclick=()=>{document.querySelectorAll('.custom-select-wrap.open').forEach(w=>{if(w!==wrap)closeCustomSelect(w)});const open=wrap.classList.toggle('open');menu.classList.toggle('hiddenx',!open);trigger.setAttribute('aria-expanded',String(open))};
    sel.addEventListener('change',syncCustomSelect);
    sel.addEventListener('reset-sync',syncCustomSelect);
    const obs=new MutationObserver(rebuild);obs.observe(sel,{childList:true,subtree:true});
    wrap._rebuild=rebuild;wrap._sync=syncCustomSelect;rebuild();
  });
  document.querySelectorAll('.custom-select-wrap').forEach(w=>w._sync&&w._sync());
}
function closeCustomSelect(wrap){if(!wrap)return;wrap.classList.remove('open');const m=wrap.querySelector('.custom-select-menu');const t=wrap.querySelector('.custom-select-trigger');if(m)m.classList.add('hiddenx');if(t)t.setAttribute('aria-expanded','false')}
function syncAllCustomSelects(){document.querySelectorAll('.custom-select-wrap').forEach(w=>w._sync&&w._sync())}
document.addEventListener('click',e=>{if(!e.target.closest('.custom-select-wrap'))document.querySelectorAll('.custom-select-wrap.open').forEach(closeCustomSelect)});
document.addEventListener('reset',()=>setTimeout(syncAllCustomSelects,0),true);


window.deleteMemberDocument = async function(memberId, docIndex, fromViewer=false){
  const member = S.members.find(m => String(m.id) === String(memberId));
  if(!member || !Array.isArray(member.documents) || !member.documents[docIndex]) return;

  const docItem = member.documents[docIndex];
  const label = docItem.title || docItem.name || 'এই ডকুমেন্ট';

  if(!fromViewer && !confirm(`"${label}" ডকুমেন্টটি ডিলেট করতে চান?`)) return;

  try{
    await save(s=>{
      const mm = s.members.find(m => String(m.id) === String(memberId));
      if(!mm || !Array.isArray(mm.documents) || !mm.documents[docIndex]){
        throw Error('ডকুমেন্ট পাওয়া যায়নি');
      }
      mm.documents.splice(docIndex, 1);
      addNotif(s,'member',mm.name+' এর একটি ডকুমেন্ট ডিলেট হয়েছে');
    });
    toast('ডকুমেন্ট ডিলেট হয়েছে।');
    document.getElementById('memberMediaLightbox')?.remove();

    // Refresh the edit view without relying on the module-local editMember()
    // from an inline/global handler.
    const refreshedMember = S.members.find(m => String(m.id) === String(memberId));
    if(refreshedMember){
      const modal = $('editModal');
      if(modal && !modal.classList.contains('hiddenx')){
        if(typeof window.__refreshEditingMember === 'function'){
          window.__refreshEditingMember(memberId);
        }else{
          // Re-open through the existing edit button when available.
          const btn = document.querySelector(`[data-edit-member="${CSS.escape(String(memberId))}"]`);
          if(btn) btn.click();
        }
      }
    }
  }catch(err){
    console.error(err);
    toast(err.message || 'ডকুমেন্ট ডিলেট করা যায়নি।', true);
  }
};

let renderFrame=0;
function renderAnalysis(){
  const root=$('analysisCharts'); if(!root)return;
  const active=(S.members||[]).filter(m=>m.isActive!==false && m.status!=='inactive');
  const savings=active.map(m=>({id:m.id,name:m.name||m.id||'সদস্য',value:Math.max(0,Number(availableSavings(m)||0))})).sort((a,b)=>b.value-a.value);
  const income=(S.incomeEntries||[]).reduce((a,x)=>a+Number(x.amount||0),0);
  const expense=(S.expenses||[]).reduce((a,x)=>a+Number(x.amount||0),0);
  const investment=(S.investments||[]).reduce((a,x)=>a+Number(x.amount||0),0);
  const loans=(S.netDividendLoans||[]).reduce((a,x)=>a+Math.max(0,Number(x.outstanding??(Number(x.amount||0)-Number(x.repaidAmount||0))),0),0);
  const donationCredits=(S.profitEntries||[]).reduce((a,p)=>a+Number(p.donationAmount??(p.fundSplitVersion==='2-98'?Number(p.totalProfit||0)*0.02:0)),0);
  const donationPaid=(S.donationDisbursements||[]).reduce((a,x)=>a+Number(x.amount||0),0);
  const donation=Math.max(0,donationCredits-donationPaid);
  const totalSavings=savings.reduce((a,x)=>a+x.value,0);

  const fmt=n=>money(Math.max(0,Number(n||0)));
  const maxSavings=Math.max(1,...savings.map(x=>x.value));
  const savingsRows=savings.length?savings.map((x,i)=>`<div class="modern-rank-row" data-profile="${esc(x.id)}" tabindex="0" role="button" title="${esc(x.name)}"><div class="rank-no">${i+1}</div><div class="rank-main"><div class="rank-name">${esc(x.name)}</div><div class="modern-track"><div class="modern-fill savings-fill" style="width:${x.value?Math.max(2,(x.value/maxSavings)*100):0}%"></div></div></div><div class="rank-value">${fmt(x.value)}</div></div>`).join(''):'<div class="analysis-empty">কোনো সক্রিয় সদস্যের সঞ্চয় পাওয়া যায়নি।</div>';

  const metrics=[['আয়',income,'income'],['ব্যয়',expense,'expense'],['বিনিয়োগ',investment,'investment'],['ঋণ বকেয়া',loans,'loan'],['অনুদান',donation,'donation']];
  const maxMetric=Math.max(1,...metrics.map(x=>x[1]));
  const metricBars=metrics.map(x=>`<div class="metric-card"><div class="metric-top"><span>${x[0]}</span><b>${fmt(x[1])}</b></div><div class="modern-track metric-track"><div class="modern-fill ${x[2]}-fill" style="width:${x[1]?Math.max(2,(x[1]/maxMetric)*100):0}%"></div></div></div>`).join('');

  // The financial graph is driven by the canonical Firebase bank ledger.
  // Every actual ledger transaction is included, then grouped by calendar month.
  // This prevents duplicate counting from the individual source collections.
  const now=new Date();
  const monthStart=new Date(now.getFullYear(),now.getMonth()-11,1);
  const monthKeyFromDate=v=>{
    if(!v)return null;
    const d=new Date(v);
    if(isNaN(d))return null;
    return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`;
  };
  const monthMap={};
  for(let i=0;i<12;i++){
    const d=new Date(monthStart.getFullYear(),monthStart.getMonth()+i,1);
    const k=`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`;
    monthMap[k]={inflow:0,outflow:0,net:0,count:0,transactions:[]};
  }

  // Build one unified transaction stream. bankLedger is the canonical cash ledger,
  // while member/loan/donation records that are not mirrored there are added once.
  const graphTxs=[];
  (S.bankLedger||[]).forEach(x=>graphTxs.push({
    date:x.at||x.date||x.createdAt, amount:Number(x.amount||0),
    description:x.description||x.type||'লেনদেন', type:x.type||'', source:x.source||'', reference:x.reference||''
  }));
  (S.members||[]).forEach(m=>(m.transactions||[]).forEach(t=>{
    // bank_deposit is already represented in bankLedger; do not count it twice.
    if(t.type==='bank_deposit')return;
    const amount=Number(t.amount||0);
    graphTxs.push({
      date:t.date||t.createdAt, amount,
      description:`${m.name||'সদস্য'} — ${t.type==='deposit'?'সঞ্চয়':t.type==='due'?'বকেয়া':t.type==='penalty'?'জরিমানা':t.type||'লেনদেন'}`,
      type:t.type||'member_transaction', source:'member', reference:t.reference||''
    });
  }));
  (S.netDividendLoans||[]).forEach(l=>graphTxs.push({
    date:l.date||l.createdAt, amount:-Math.abs(Number(l.amount||0)),
    description:`${l.memberName||'সদস্য'} — ঋণ প্রদান`, type:'loan_disbursement', source:'loan', reference:l.id||''
  }));
  (S.loanRepayments||[]).forEach(r=>graphTxs.push({
    date:r.date||r.createdAt, amount:Math.abs(Number(r.amount||0)),
    description:`${r.memberName||'সদস্য'} — ঋণ পরিশোধ`, type:'loan_repayment', source:'loan', reference:r.reference||r.id||''
  }));
  (S.donationDisbursements||[]).forEach(x=>graphTxs.push({
    date:x.date||x.createdAt, amount:-Math.abs(Number(x.amount||0)),
    description:`অনুদান — ${x.purpose||x.projectName||'প্রদান'}`, type:'donation', source:'donation', reference:x.transactionId||x.id||''
  }));

  graphTxs.forEach(x=>{
    const rawDate=x.date;
    const d=new Date(rawDate);
    if(isNaN(d)||d<monthStart)return;
    const k=monthKeyFromDate(rawDate);
    if(!monthMap[k])return;
    const amount=Number(x.amount||0);
    monthMap[k].net+=amount;
    monthMap[k].count++;
    if(amount>=0)monthMap[k].inflow+=amount;
    else monthMap[k].outflow+=Math.abs(amount);
    monthMap[k].transactions.push(x);
  });
  const months=Object.keys(monthMap).sort();
  let runningBalance=0;
  const beforeStart=graphTxs.filter(x=>{const d=new Date(x.date);return !isNaN(d)&&d<monthStart}).reduce((a,x)=>a+Number(x.amount||0),0);
  runningBalance=beforeStart;
  const graphRows=months.map(k=>{
    const r=monthMap[k];
    runningBalance+=r.net;
    return {...r,k,closingBalance:runningBalance};
  });
  const graphMax=Math.max(1,...graphRows.flatMap(r=>[r.inflow,r.outflow,r.closingBalance]));
  const graphMin=Math.min(0,...graphRows.map(r=>r.closingBalance));
  const graphRange=Math.max(1,graphMax-graphMin);
  const faW=1200,faH=500,faLeft=76,faRight=28,faTop=28,faBottom=62,faPlotW=faW-faLeft-faRight,faPlotH=faH-faTop-faBottom;
  const faY=v=>faTop+faPlotH-((Number(v||0)-graphMin)/graphRange)*faPlotH;
  const faX=i=>faLeft+(graphRows.length<=1?faPlotW/2:(i/(graphRows.length-1))*faPlotW);
  const faBarW=graphRows.length?Math.min(30,Math.max(10,(faPlotW/graphRows.length)*.26)):22;
  const faMoney=v=>money(Math.abs(Number(v||0)));
  const faTicks=5;
  const faGrid=Array.from({length:faTicks+1},(_,i)=>{
    const value=graphMin+(graphRange/faTicks)*i;
    const y=faY(value);
    const label=value<0?'− '+faMoney(value):faMoney(value);
    return `<line class="fa-grid" x1="${faLeft}" y1="${y}" x2="${faW-faRight}" y2="${y}"/><text class="fa-value" x="${faLeft-9}" y="${y+4}" text-anchor="end">${label}</text>`;
  }).join('');
  const balanceLine=graphRows.length?`<polyline class="fa-line-bank" points="${graphRows.map((r,i)=>`${faX(i)},${faY(r.closingBalance)}`).join(' ')}"/>`:'';
  const balanceDots=graphRows.map((r,i)=>`<circle class="fa-dot-bank" cx="${faX(i)}" cy="${faY(r.closingBalance)}" r="4" data-fa-tip="${i}"/>`).join('');
  const faBars=graphRows.map((r,i)=>{
    const x=faX(i),base=faY(0),iy=faY(r.inflow),oy=faY(r.outflow),d=new Date(r.k+'-01'),label=d.toLocaleDateString('bn-BD',{month:'short'});
    const inY=Math.min(iy,base),inH=Math.max(1,Math.abs(base-iy));
    const outY=Math.min(oy,base),outH=Math.max(1,Math.abs(base-oy));
    return `<g class="fa-month-group" data-fa-index="${i}"><rect class="fa-bar-income" x="${x-faBarW-3}" y="${inY}" width="${faBarW}" height="${inH}" rx="6"/><rect class="fa-bar-expense" x="${x+3}" y="${outY}" width="${faBarW}" height="${outH}" rx="6"/><text class="fa-month" x="${x}" y="${faH-20}" text-anchor="middle">${label}</text></g>`;
  }).join('');
  const faSvg=`<svg class="full-analytics-svg" viewBox="0 0 ${faW} ${faH}" preserveAspectRatio="none" role="img" aria-label="সর্বশেষ ১২ মাসের সব আর্থিক লেনদেনের গ্রাফ"><defs><linearGradient id="faIncomeGrad" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stop-color="#34d399"/><stop offset="100%" stop-color="#059669"/></linearGradient><linearGradient id="faExpenseGrad" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stop-color="#fb923c"/><stop offset="100%" stop-color="#ea580c"/></linearGradient></defs>${faGrid}<line class="fa-axis" x1="${faLeft}" y1="${faY(0)}" x2="${faW-faRight}" y2="${faY(0)}"/>${faBars}${balanceLine}${balanceDots}</svg>`;

  const monthBars=graphRows.map(r=>{
    const d=new Date(r.k+'-01');
    const label=d.toLocaleDateString('bn-BD',{month:'short',year:'2-digit'});
    const maxMonth=Math.max(1,...graphRows.flatMap(x=>[x.inflow,x.outflow]));
    return `<div class="month-col"><div class="month-values"><span>${fmt(r.inflow)}</span><span>${fmt(r.outflow)}</span></div><div class="dual-bars"><div class="month-bar income-fill" style="height:${r.inflow?Math.max(3,r.inflow/maxMonth*100):0}%"></div><div class="month-bar expense-fill" style="height:${r.outflow?Math.max(3,r.outflow/maxMonth*100):0}%"></div></div><div class="month-label">${label}</div></div>`;
  }).join('');

  root.innerHTML=`<div class="modern-analysis-grid">
    <div class="modern-analysis-card full-analytics-card">
      <div class="full-analytics-head">
        <h3>📊 আর্থিক লেনদেন</h3>
        <div class="full-analytics-legend"><span><i class="lg-income"></i> জমা</span><span><i class="lg-expense"></i> খরচ</span><span><i class="lg-line2"></i> ক্রমবর্ধমান নিট</span></div>
      </div>
      <div class="full-analytics-wrap">${faSvg}</div>
    </div>
    <div class="modern-analysis-card wide-card">
      <div class="chart-header"><div><h3>👤 সদস্যভিত্তিক সঞ্চয়</h3></div><div class="chart-total"><span>মোট সঞ্চয়</span><b>${fmt(totalSavings)}</b></div></div>
      <div class="rank-chart mt-4">${savingsRows}</div>
    </div>
    <div class="modern-analysis-card">
      <div class="chart-header"><div><h3>💰 আর্থিক আয়তলেখ</h3></div></div>
      <div class="metric-grid mt-4">${metricBars}</div>
    </div>
    <div class="modern-analysis-card">
      <div class="chart-header"><div><h3>📈 মাসভিত্তিক আয়–ব্যয়</h3></div><div class="cash-legend"><span><i class="legend-dot income-fill"></i> জমা</span><span><i class="legend-dot expense-fill"></i> খরচ</span></div></div>
      <div class="month-chart-scroll mt-4"><div class="month-chart">${monthBars}</div></div>
    </div>
    <div class="modern-analysis-card wide-card summary-card">
      <div class="summary-kpi"><span>👥 সক্রিয় সদস্য</span><b>${active.length.toLocaleString('bn-BD')}</b></div>
      <div class="summary-kpi"><span>💰 গড় সঞ্চয় / সদস্য</span><b>${fmt(active.length?totalSavings/active.length:0)}</b></div>
      <div class="summary-kpi"><span>🏦 ব্যাংক ব্যালেন্স</span><b>${fmt(currentBank())}</b></div>
      <div class="summary-kpi"><span>📊 নিট আয়</span><b class="${income-expense>=0?'positive':'negative'}">${money(income-expense)}</b></div>
    </div>
  </div>`;

  root.querySelectorAll('[data-profile]').forEach(el=>{el.onclick=()=>openProfile(el.dataset.profile);el.onkeydown=e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();openProfile(el.dataset.profile)}}});
  const faTip=document.getElementById('faTooltip')||Object.assign(document.createElement('div'),{id:'faTooltip',className:'fa-tooltip'});
  if(!faTip.parentNode)document.body.appendChild(faTip);
  root.querySelectorAll('[data-fa-index]').forEach(g=>{
    const show=e=>{
      const i=Number(g.dataset.faIndex),r=graphRows[i];if(!r)return;
      const d=new Date(r.k+'-01'),label=d.toLocaleDateString('bn-BD',{month:'long',year:'numeric'});
      const tx=r.transactions.slice().sort((a,b)=>new Date(a.date)-new Date(b.date));
      const list=tx.slice(-8).map(t=>`${t.amount>=0?'▲':'▼'} ${esc(t.description)}: ${t.amount>=0?'+':'−'}${faMoney(t.amount)}`).join('<br>');
      faTip.innerHTML=`<b>${label}</b><br><span class="ti">● জমা: ${faMoney(r.inflow)}</span><br><span class="te">● খরচ: ${faMoney(r.outflow)}</span><br><span class="tb">● ক্রমবর্ধমান নিট: ${faMoney(r.closingBalance)}</span><br><span class="ts">● লেনদেন: ${r.count.toLocaleString('bn-BD')}টি</span>${list?`<div class="fa-tip-list">${list}</div>`:''}`;
      faTip.style.left=Math.min(window.innerWidth-320,Math.max(8,e.clientX+12))+'px';
      faTip.style.top=Math.min(window.innerHeight-220,Math.max(8,e.clientY+12))+'px';
      faTip.style.opacity='1';
    };
    const hide=()=>faTip.style.opacity='0';
    g.addEventListener('pointermove',show);g.addEventListener('pointerenter',show);g.addEventListener('pointerleave',hide);
  });
}

function render(){
  renderBrand();
  renderStats();
  renderMembers();
  renderBulkMembers();
  const opts=memberOptions();
  $('dMember').innerHTML=opts;
  $('sbMember').innerHTML=opts;
  $('dueMember').innerHTML=opts;
  $('profitInvestment').innerHTML='<option value="">বিনিয়োগ নির্বাচন করুন</option>'+S.investments.map(i=>`<option value="${esc(i.id)}" data-img="${esc(i.imageUrl||'https://placehold.co/40x40/EEF2FF/4338CA?text=I')}" data-sub="${esc(i.startDate||'')} ${i.endDate?'→ '+esc(i.endDate):''}">${esc(i.title)} — ${money(i.amount)}</option>`).join('');
  renderFinance();
  renderInvestments();
  renderGovernance();
  renderNotice();
  renderAnalysis();
  renderNotifications();
  upgradeImageSelects();
  syncAllCustomSelects();
  updateAvailable();
}
// Firestore callbacks can arrive close together. Render on the next animation frame
// so repeated snapshots do not monopolize the main thread.
function scheduleRender(){
  if(renderFrame)return;
  renderFrame=requestAnimationFrame(()=>{
    renderFrame=0;
    try{render()}catch(err){console.error('Render error:',err);toast('ডেটা দেখাতে সমস্যা হয়েছে।',true)}
  });
}
function hideStartupLoader(){const el=$('loader');if(el){el.classList.add('hiddenx');el.classList.remove('flex')}}
function showLoaderError(msg){$('loaderText').textContent=msg;$('loaderRetry').classList.remove('hiddenx')}
$('loaderRetry').onclick=()=>location.reload();

// Firestore realtime data is always a background operation.
// Cached/local data is rendered first when available; server sync never blocks the UI.
let realtimeStarted=false;
async function startRealtime(){
  if(realtimeStarted)return;
  realtimeStarted=true;
  setFirebaseSyncStatus('syncing','Firebase সংযোগ হচ্ছে…',true);
  try{
    if(unsub)unsub();
    unsub=onSnapshot(
      mainRef,
      {includeMetadataChanges:true},
      snap=>{
        try{
          const nextState=norm(snap.exists()?snap.data():{});
          const nextFingerprint=JSON.stringify(nextState);
          // Metadata-only snapshots do not repaint the whole app.
          if(nextFingerprint!==lastStateFingerprint){
            S=nextState;
            lastStateFingerprint=nextFingerprint;
            applyLocalNotificationReadState();
            scheduleRender();
          }else{
            S=nextState;
          }
          void writeAppCache(S);
          repairLegacyProfitAllocations();
          if(snap.metadata.hasPendingWrites){
            setFirebaseSyncStatus('syncing','ডেটা সিঙ্ক হচ্ছে…',true);
          }else if(snap.metadata.fromCache){
            setFirebaseSyncStatus(navigator.onLine===false?'offline':'syncing',
              navigator.onLine===false?'অফলাইন — ক্যাশ ডেটা চলছে':'ক্যাশ ডেটা চলছে • সার্ভার সিঙ্ক হচ্ছে',navigator.onLine!==false);
          }else{
            setFirebaseSyncStatus('synced','সিঙ্ক সম্পন্ন',false);
          }
        }catch(err){
          console.error('Render error:',err);
          setFirebaseSyncStatus('error','ডেটা দেখাতে সমস্যা হয়েছে',false);
          toast('ডেটা দেখাতে সমস্যা হয়েছে।',true);
        }finally{
          hideStartupLoader();
        }
      },
      err=>{
        console.error('Firestore realtime error:',err);
        hideStartupLoader();
        setFirebaseSyncStatus(navigator.onLine===false?'offline':'error',
          navigator.onLine===false?'অফলাইন — ক্যাশ ডেটা চলছে':'Firebase সংযোগে সমস্যা',false);
        toast('Firebase ডেটা সংযোগে সমস্যা হয়েছে। আবার চেষ্টা করুন।',true);
      }
    );
  }catch(err){
    console.error('Realtime start error:',err);
    hideStartupLoader();
    setFirebaseSyncStatus('error','ডেটা সংযোগ শুরু হয়নি',false);
    toast('ডেটা লোড করা যায়নি।',true);
  }
}
window.addEventListener('online',()=>{setFirebaseSyncStatus('syncing','আবার অনলাইনে — সিঙ্ক হচ্ছে…',true)});
window.addEventListener('offline',()=>{setFirebaseSyncStatus('offline','অফলাইন — ক্যাশ ডেটা চলছে',false)});

setFirebaseSyncStatus(navigator.onLine===false?'offline':'syncing',navigator.onLine===false?'অফলাইন — ক্যাশ ডেটা চলছে':'Firebase প্রস্তুত…',navigator.onLine!==false);

// Public read-only startup: no login page and no admin session is required.
// Firestore remains the source of truth and the existing realtime listener renders the information.
$('auth').classList.add('hiddenx');
$('app').classList.remove('hiddenx');
// Paint the last cached state first, then let Firebase refresh it in the background.
// This keeps repeat visits fast while preserving realtime updates and existing features.
readAppCache().then(cached=>{
  if(cached){
    try{
      S=norm(cached);
      applyLocalNotificationReadState();
      render();
      lastStateFingerprint=JSON.stringify(S);
      hideStartupLoader();
    }catch(err){console.warn('Cached state could not be rendered:',err)}
  }
  if(auth.currentUser){
    startRealtime();
  }else{
    signInAnonymously(auth).then(()=>startRealtime()).catch(()=>startRealtime());
  }
}).catch(()=>{
  if(auth.currentUser)startRealtime();
  else signInAnonymously(auth).then(()=>startRealtime()).catch(()=>startRealtime());
});

// Absolute safety net: a failed Firebase module/network must not leave a permanent
// full-screen spinner. This does NOT bypass Firebase Auth; it only removes the UI overlay.
setTimeout(()=>{
  const loader=$('loader');
  if(loader && !loader.classList.contains('hiddenx')){
    hideStartupLoader();
    $('auth').classList.add('hiddenx');
    $('app').classList.remove('hiddenx');
  }
},7000);
