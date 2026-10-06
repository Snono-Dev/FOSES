// Safe storage — works even when the browser blocks localStorage/sessionStorage
// (Brave Shields, private mode, disabled cookies). Falls back to memory;
// synced data still persists via GitHub when logged in.
const memL = new Map(), memS = new Map();
function ref(name) { try { return Function('return ' + name)(); } catch { return null; } }
function mk(name, mem) {
  return {
    get(k) {
      const st = ref(name);
      if (st) { try { const v = st.getItem(k); if (v !== null) return v; } catch {} }
      return mem.has(k) ? mem.get(k) : null;
    },
    set(k, v) {
      const st = ref(name);
      if (st) { try { st.setItem(k, String(v)); } catch {} }
      try { mem.set(k, String(v)); } catch {}
    },
    del(k) {
      const st = ref(name);
      if (st) { try { st.removeItem(k); } catch {} }
      try { mem.delete(k); } catch {}
    }
  };
}
export const LS = mk('localStorage', memL);
export const SS = mk('sessionStorage', memS);
export function storageOK() {
  try { localStorage.setItem('__fos_t', '1'); localStorage.removeItem('__fos_t'); return true; }
  catch { return false; }
}
