// Auth: PAT (recommended, 100% static-safe) + Device Flow (client_id only) + Demo.
// SECURITY: never store client_secret in frontend. Code-flow with secret is NOT supported here.
import { LS, SS } from './storage.js';
const SESS='foses-sess-v1';
export function getSession(){
  try{ return JSON.parse(SS.get(SESS)||LS.get('foses-remember')||'null'); }catch{ return null; }
}
export function setSession(s, remember=false){
  SS.set(SESS, JSON.stringify(s));
  if(remember) LS.set('foses-remember', JSON.stringify({...s, token: s.token ? 'remembered' : null}));
  else LS.del('foses-remember');
}
export function clearSession(){ SS.del(SESS); LS.del('foses-remember'); LS.del('foses-token'); }
// دمج تحديث في الجلسة المحفوظة (مثل الفرع الصحيح) في المخزنين معًا
export function updateSession(patch){
  try{
    const cur=getSession()||{};
    const next={...cur,...patch};
    SS.set(SESS, JSON.stringify(next));
    if(LS.get('foses-remember')) LS.set('foses-remember', JSON.stringify({...next, token: next.token ? 'remembered' : null}));
  }catch{}
}

export function getToken(){
  return SS.get('foses-token') || LS.get('foses-token') || null;
}
export function setToken(t, persist=false){
  if(persist) LS.set('foses-token', t); else SS.set('foses-token', t);
}

export async function fetchMe(token){
  const r=await fetch('https://api.github.com/user',{headers:{Authorization:`Bearer ${token}`,Accept:'application/vnd.github+json'}});
  if(!r.ok) throw new Error('token-invalid '+r.status);
  return r.json();
}

// --- Device Flow (no secret needed client-side) ---
// 1) POST /login/device/code {client_id, scope} -> user_code, verification_uri, device_code
// 2) poll POST /login/oauth/access_token {client_id, device_code, grant_type}
// Requires an OAuth App with "Enable Device Flow" checked. Client ID is public.
export async function deviceStart(clientId, scope='repo'){
  const r=await fetch('https://github.com/login/device/code',{
    method:'POST', headers:{'Content-Type':'application/json',Accept:'application/json'},
    body:JSON.stringify({client_id:clientId, scope})
  });
  if(!r.ok) throw new Error('device-start-failed');
  return r.json();
}
export async function devicePoll(clientId, device_code, intervalSec=5, timeoutSec=600){
  const t0=Date.now();
  while(Date.now()-t0 < timeoutSec*1000){
    await new Promise(r=>setTimeout(r, intervalSec*1000));
    const r=await fetch('https://github.com/login/oauth/access_token',{
      method:'POST', headers:{'Content-Type':'application/json',Accept:'application/json'},
      body:JSON.stringify({client_id:clientId, device_code, grant_type:'urn:ietf:params:oauth:grant-type:device_code'})
    });
    const j=await r.json();
    if(j.access_token) return j;
    if(j.error && !['authorization_pending','slow_down'].includes(j.error)) throw new Error(j.error_description||j.error);
    if(j.error==='slow_down') await new Promise(r=>setTimeout(r,5000));
  }
  throw new Error('device-timeout');
}
