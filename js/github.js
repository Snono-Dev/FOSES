// Minimal GitHub API wrapper: repo ensure + file CRUD with SHA handling.
import { CONFIG } from './config.js';

function H(token){
  return { Authorization:`Bearer ${token}`, Accept:'application/vnd.github+json', 'Content-Type':'application/json' };
}
async function gh(path, token, opts={}){
  const r=await fetch(`https://api.github.com${path}`,{...opts,headers:{...H(token),...(opts.headers||{})}});
  const remain=r.headers.get('x-ratelimit-remaining');
  if(remain!==null && Number(remain)<5) console.warn('GitHub rate-limit low:',remain);
  if(r.status===401) throw Object.assign(new Error('unauthorized'),{code:401});
  if(r.status===403 && remain==='0') throw Object.assign(new Error('rate-limited — حاول لاحقًا'),{code:403});
  if(!r.ok){ const t=await r.text().catch(()=> ''); throw Object.assign(new Error(`GitHub ${r.status}: ${t.slice(0,200)}`),{code:r.status}); }
  if(r.status===204) return null;
  return r.json();
}
const b64encode = o => btoa(unescape(encodeURIComponent(JSON.stringify(o,null,2))));
const b64decode = c => JSON.parse(decodeURIComponent(escape(atob(c.replace(/\n/g,'')))));

export async function getRepo(token, owner, repo){
  try{ return await gh(`/repos/${owner}/${repo}`, token); }catch(e){ if(e.code===404) return null; throw e; }
}
export async function createDataRepo(token, repoName, isPrivate=true){
  return gh('/user/repos', token, { method:'POST', body:JSON.stringify({name:repoName, private:isPrivate, auto_init:true, description:'📚 FOSES study data — نسخة احتياطية تلقائية لبيانات الدراسة (JSON)'}) });
}
export async function ensureDataRepo(token, owner, repoName, isPrivate=true, branch='main'){
  let repo=await getRepo(token,owner,repoName);
  if(!repo) repo=await createDataRepo(token,repoName,isPrivate);
  return repo;
}
export async function readFile(token, owner, repo, path, branch='main'){
  try{
    const j=await gh(`/repos/${owner}/${repo}/contents/${path}?ref=${branch}`, token);
    if(Array.isArray(j)||j.type!=='file') return {exists:false};
    return { exists:true, sha:j.sha, data:b64decode(j.content) };
  }catch(e){ if(e.code===404) return {exists:false}; throw e; }
}
export async function writeFile(token, owner, repo, path, data, msg, branch='main', sha=null){
  const body={ message:msg, content:b64encode(data), branch, ...(sha?{sha}:{}) };
  return gh(`/repos/${owner}/${repo}/contents/${path}`, token, { method:'PUT', body:JSON.stringify(body) });
}
// Raw text files (workflows, scripts) — content is NOT JSON.
export async function writeRawFile(token, owner, repo, path, text, msg, branch='main', sha=null){
  const content=btoa(unescape(encodeURIComponent(text)));
  const body={ message:msg, content, branch, ...(sha?{sha}:{}) };
  return gh(`/repos/${owner}/${repo}/contents/${path}`, token, { method:'PUT', body:JSON.stringify(body) });
}
export async function deleteFile(token, owner, repo, path, sha, msg, branch='main'){
  return gh(`/repos/${owner}/${repo}/contents/${path}`, token, { method:'DELETE', body:JSON.stringify({message:msg, sha, branch}) });
}
export async function listRepos(token){
  return gh('/user/repos?per_page=100&sort=updated&affiliation=owner', token);
}
// Batch pull/push of the known data files
export async function pullAll(token, owner, repo, files, branch){
  const out={}, shas={};
  for(const f of files){
    const r=await readFile(token,owner,repo,f,branch);
    if(r.exists){ out[f.replace('.json','')]=r.data; shas[f]=r.sha; }
  }
  return {out,shas};
}
export async function pushAll(token, owner, repo, snapshot, shas, branch){
  const files=Object.keys(snapshot); const newShas={...shas};
  for(const key of files){
    const path=key+'.json';
    try{
      const r=await writeFile(token,owner,repo,path,snapshot[key],`📚 fos: update ${path}`,branch,newShas[path]);
      newShas[path]=r.content.sha;
    }catch(e){
      if(e.code===409||e.code===422){ // conflict: re-pull sha and retry once
        const cur=await readFile(token,owner,repo,path,branch);
        const r=await writeFile(token,owner,repo,path,snapshot[key],`📚 fos: update ${path} (retry)`,branch,cur.sha);
        newShas[path]=r.content.sha;
      } else throw e;
    }
  }
  return newShas;
}
