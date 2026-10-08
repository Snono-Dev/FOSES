// Sync engine: offline-first, debounced push, pull-on-login, conflict-safe.
import { getDB } from './store.js';
import { pullAll, pushAll, ensureDataRepo, readFile } from './github.js';
import { getToken, getSession, updateSession } from './auth.js';
import { CONFIG } from './config.js';
import { normalizeExams, ensureTimetable } from './models.js';
import { modal, closeModal } from './ui.js';
import { LS } from './storage.js';
const SYNC_COOLDOWN = 5 * 60 * 1000; // فحص تلقائي كل 5 دقائق كحد أقصى — اليدوي دائمًا فوري

let shas={};
let timer=null, syncing=false, lastStatus='local', lastError='';
const subs=new Set();
export const onSync=s=>{subs.add(s);return()=>subs.delete(s)};
function setStatus(st,msg){ lastStatus=st; if(st==='error'&&msg)lastError=msg; if(st!=='error')lastError=''; subs.forEach(f=>{try{f(st,msg)}catch{}}); paintDot(st); }
function paintDot(st){ const d=document.getElementById('syncDot'); if(!d) return; const paused=!autoSyncOn()&&(st==='local'); d.className='sync-dot'+(st==='synced'?'':st==='syncing'?' busy':st==='offline'?' offline':st==='local'?(paused?' paused':' off'):' err'); d.title='sync: '+st+(st==='syncing'?' (جارٍ المزامنة…)':'')+(paused?' (التلقائية متوقفة)':'')+(st==='offline'?' (لا إنترنت)':'')+(st==='error'&&lastError?' — '+lastError:''); }
const isOffline=()=> (typeof navigator!=='undefined') && ('onLine' in navigator) && !navigator.onLine;
export const syncStatus=()=>lastStatus;
export const lastSyncError=()=>lastError;
export const getShas=()=>shas;
export function autoSyncOn(){ try{ return getDB()?.settings?.autoSync!==false; }catch{ return true; } }
function hasLocalData(db){ return !!((db.subjects||[]).length||(db.exams||[]).length||(db.sessions||[]).length||(db.events||[]).length); }
function sameJSON(a,b){ try{ return JSON.stringify(a??null)===JSON.stringify(b??null); }catch{ return false; } }
function askDirection(){
  return new Promise(res=>{
    modal(`<h3>📦 المستودع فيه بيانات مختلفة</h3>
    <p class="muted small">مستودعك على GitHub فيه بيانات، وجهازك فيه بيانات أخرى مختلفة. اختر:</p>
    <div class="grid cols2"><button class="btn" id="dPull">⬇️ سحب بيانات المستودع واستخدامها</button>
    <button class="btn ghost" id="dPush">⬆️ الكتابة عليها ببيانات جهازي ثم المتابعة</button></div>`);
    document.getElementById('dPull').onclick=()=>{closeModal();res('pull');};
    document.getElementById('dPush').onclick=()=>{closeModal();res('push');};
  });
}

export async function initialSync(force=false){
  const tok=getToken(), sess=getSession();
  if(!tok || !sess?.login){ setStatus('local'); return false; }
  if(!force){
    const last=+LS.get('foses-last-sync')||0;
    if(Date.now()-last<SYNC_COOLDOWN){ setStatus('synced'); return true; }
  }
  const repo=sess.repoName||CONFIG.dataRepoName, branch=sess.branch||'main';
  try{
    setStatus('syncing');
    const created=await ensureDataRepo(tok,sess.login,repo,sess.private!==false,branch);
    // اعتماد الفرع الافتراضي الحقيقي للمستودع (main/master) بدل الافتراض
    if(created?.default_branch && created.default_branch!==branch){
      updateSession({branch:created.default_branch});
      sess.branch=created.default_branch;
    }
    const {out,shas:newShas}=await pullAll(tok,sess.login,repo,CONFIG.files,sess.branch||branch);
    shas=newShas;
    if(Object.keys(out).length){
      const db=getDB();
      const localHas=hasLocalData(db);
      const remoteHas=Object.values(out).some(v=>Array.isArray(v)?v.length:(v&&typeof v==='object'&&Object.keys(v).length>0));
      // توحيد صيغة المسحوب قبل المقارنة (مستودعات قديمة بشكل قديم)
      const fake={subjects:out.subjects,curriculum:out.curriculum,exams:out.exams,timetable:out.timetable};
      try{ normalizeExams(fake); }catch{}
      try{ ensureTimetable(fake); }catch{}
      const normOut={...out};
      ['subjects','curriculum','exams','timetable'].forEach(k=>{ if(out[k]!==undefined) normOut[k]=fake[k]; });
      if(localHas&&remoteHas){
        const same=Object.keys(normOut).every(k=>sameJSON(db[k],normOut[k]));
        if(!same){
          const choice=await askDirection();
          shas=newShas;
          if(choice==='push'){
            await pushNow('📚 fos: overwrite from this device');
            setStatus('synced'); return true;
          }
        }
      }
      for(const [k,v] of Object.entries(normOut)){ if(v!==undefined) db[k]=v; }
      normalizeExams(db);
      ensureTimetable(db);
      const { saveLocal }=await import('./store.js'); saveLocal();
      clearTimeout(timer); // لا تدفع ما سُحب للتو كـ commit ضجيج
    } else {
      await pushNow('init 🌱 تهيئة مخزن الدراسة');
    }
    setStatus('synced'); try{ LS.set('foses-last-sync', String(Date.now())); }catch{} return true;
  }catch(e){ console.warn(e); if(isOffline()){ setStatus('offline'); } else setStatus('error',e.message); return false; }
}

export function schedulePush(){
  const tok=getToken(); if(!tok){ setStatus('local'); return; }
  if(!autoSyncOn()){ setStatus('local'); paintDot('local'); return; }
  setStatus('local');
  clearTimeout(timer); timer=setTimeout(()=>pushNow().catch(()=>{}), 2500);
}
export async function pushNow(msg='📚 fos: sync'){
  const tok=getToken(), sess=getSession();
  if(!tok||!sess?.login||syncing) return false;
  syncing=true; setStatus('syncing');
  try{
    const db=getDB();
    const snap={}; for(const f of CONFIG.files){ snap[f.replace('.json','')]=db[f.replace('.json','')] ?? null; }
    shas=await pushAll(tok,sess.login,sess.repoName||CONFIG.dataRepoName,snap,shas,sess.branch||'main');
    setStatus('synced'); try{ LS.set('foses-last-sync', String(Date.now())); }catch{} return true;
  }catch(e){ console.warn(e); if(isOffline()){ setStatus('offline'); } else setStatus('error',e.message); return false; }
  finally{ syncing=false; }
}

window.addEventListener('foses-dirty', ()=>schedulePush());
window.addEventListener('online', ()=>{ setStatus('local'); if(autoSyncOn()) pushNow('📚 fos: reconnect sync'); });
window.addEventListener('offline', ()=>setStatus('offline'));
