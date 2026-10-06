// IndexedDB + in-memory store, offline-first. GitHub is the remote.
import { DB_DEFAULTS, normalizeExams, ensureTimetable } from './models.js';
import { LS } from './storage.js';
const LS_KEY='foses-db-v2'; // v2: starts empty, no fake demo data

let db = null;
const listeners=new Set();
export function onChange(fn){ listeners.add(fn); return ()=>listeners.delete(fn); }
function emit(){ listeners.forEach(f=>{try{f(db)}catch{}}); }

// Empty database — user adds their own real subjects (or imports a curriculum JSON).
function emptyDB(){ return DB_DEFAULTS(); }

export async function loadStore(){
  try{
    const raw=LS.get(LS_KEY);
    db = raw ? JSON.parse(raw) : emptyDB();
  }catch{ db=emptyDB(); }
  normalizeExams(db);
  ensureTimetable(db);
  return db;
}
export function getDB(){ return db; }
export function saveLocal(){
  try{ LS.set(LS_KEY, JSON.stringify(db)); }catch{}
  emit();
  window.dispatchEvent(new CustomEvent('foses-dirty'));
  try{ import('./notify.js').then(m=>m.mirrorReminders(db)).catch(()=>{}); }catch{}
}
export function replaceAll(newDB){ db=newDB; saveLocal(); }
export function resetDemo(){ db=emptyDB(); saveLocal(); }
