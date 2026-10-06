// تبويب الدروس: إضافة درس (مادة ← فصل ← موضوع + تذكير) + تصفية + إنجاز — منفصل عن هيكل المواد.
import { getDB, saveLocal } from '../store.js';
import { esc, uid, now } from '../config.js';
import { toast, modal, closeModal } from '../ui.js';
import { touchActivity, pagesLabel, lectureLabel, topicsForPages, topicsBetween } from '../models.js';
import { subjBadge } from '../components.js';
import { icon } from '../icons.js';
import { LS } from '../storage.js';

export async function pLessons(el, preSid = null, preCid = null, preTid = null) {
  const db = getDB();
  if (!db.subjects.length) { el.innerHTML = `<span class="eyebrow">الدروس</span><h2 style="margin-top:0">الدروس</h2><div class="card muted">أنشئ مادة وفصلًا وموضوعًا أولًا من <a href="#/subjects">المواد</a>.</div>`; return; }
  let savedF = {};
  try { savedF = JSON.parse(LS.get('foses-lesson-filter') || '{}'); } catch {}
  const chExists = (sid, cid) => (db.curriculum[sid]?.chapters || []).some(c => c.id === cid);
  const tpExists = (sid, cid, tid) => (db.curriculum[sid]?.chapters || []).find(c => c.id === cid)?.topics?.some(t => t.id === tid);
  let st;
  if (preSid) {
    st = { sid: preSid, cid: preCid || '', tid: preTid || '', q: '', f: savedF.f || 'todo' };
  } else {
    const sid = (savedF.sid && db.subjects.some(s => s.id === savedF.sid)) ? savedF.sid : '';
    const cid = (savedF.cid && chExists(sid, savedF.cid)) ? savedF.cid : '';
    const tid = (cid && savedF.tid && tpExists(sid, cid, savedF.tid)) ? savedF.tid : '';
    st = { sid, cid, tid, q: savedF.q || '', f: savedF.f || 'todo' };
  }
  const saveFilter = () => { try { LS.set('foses-lesson-filter', JSON.stringify({ sid: st.sid, cid: st.cid, tid: st.tid, f: st.f, q: st.q })); } catch {} };

  el.innerHTML = `<span class="eyebrow">الدروس</span><div class="row spread"><h2 style="margin-top:0"><span class="h-ic">${icon('book', 20)}</span> تبويب الدروس</h2><button class="btn" id="naddOpen"><span class="ic">${icon('plus', 16)}</span> إضافة درس</button></div>
  <details class="filter-box"><summary><span class="h-ic">${icon('search', 18)}</span> تصفية وبحث <span class="chip hidden" id="fcount"></span></summary><div class="fld-row">
    <div class="fld"><span>تصفية: المادة</span><select id="fs"></select></div>
    <div class="fld"><span>الفصل</span><select id="fc"><option value="">الكل</option></select></div>
    <div class="fld"><span>الموضوع</span><select id="ft"><option value="">الكل</option></select></div>
    <div class="fld"><span>الحالة</span><select id="ff"><option value="todo">المتبقية</option><option value="all">الكل</option><option value="done">المنجزة</option></select></div>
    <div class="fld"><span>بحث</span><input id="fq" placeholder="ابحث بعنوان الدرس..."></div>
  </div></details>
  <div id="llist"></div>`;

  const $ = id => el.querySelector('#' + id);
  const chaptersOf = sid => db.curriculum[sid]?.chapters || [];
  const topicsOf = (sid, cid) => chaptersOf(sid).find(c => c.id === cid)?.topics || [];

  function fillSubjects(sel, val, withAll) {
    sel.innerHTML = (withAll ? '<option value="">كل المواد</option>' : '') + db.subjects.map(s => `<option value="${s.id}" ${s.id === val ? 'selected' : ''}>${esc(s.name)}</option>`).join('');
  }
  function fillChapters(sel, sid, val) {
    sel.innerHTML = '<option value="">الكل</option>' + chaptersOf(sid).map(c => `<option value="${c.id}" ${c.id === val ? 'selected' : ''}>${esc(c.title)}</option>`).join('');
  }
  function fillTopics(sel, sid, cid, val) {
    sel.innerHTML = '<option value="">الكل</option>' + topicsOf(sid, cid).map(t => `<option value="${t.id}" ${t.id === val ? 'selected' : ''}>${esc(t.title)}</option>`).join('');
  }
  // نافذة الإضافة (تُفتح بزر): المادة + الصفحات ← تُحدد المواضيع تلقائيًا
  $('naddOpen').onclick = () => {
    modal(`<h3><span class="h-ic">${icon('plus', 18)}</span> إضافة درس</h3>
    <div class="grid cols2">
      <div class="fld"><span>المادة</span><select id="mns"></select></div>
      <div class="fld"><span>من صفحة</span><input id="mnpf" type="number" placeholder="مثال: 5"></div>
      <div class="fld"><span>إلى صفحة</span><input id="mnpt" type="number" placeholder="مثال: 9"></div>
      <div class="fld"><span>عنوان الدرس (اسم المادة تلقائيًا)</span><input id="mntitle" readonly></div>
      <div class="fld"><span>المدة (دقيقة)</span><input id="mndur" type="number" value="30"></div>
      <div class="fld"><span>رقم المحاضرة (تلقائي — قابل للتغيير)</span><input id="mnlec" type="number" placeholder="تلقائي"></div>
      <div class="fld"><span>تاريخ تذكير (اختياري)</span><input id="mnrem" type="date"></div>
    </div>
    <div class="card" style="margin-top:10px;background:var(--card2)"><b>📚 المواضيع المشمولة (تلقائي)</b><div id="mdet" class="muted small">أدخل الصفحات لتُحدد المواضيع داخل المادة.</div>
    <div id="mmanual" class="hidden"><div class="fld-row" style="margin-top:8px"><div class="fld"><span>الفصل (يدوي)</span><select id="mnc"></select></div><div class="fld"><span>الموضوع (يدوي)</span><select id="mnt"></select></div></div></div>
    <button class="btn sm ghost" id="mman" style="margin-top:8px">تحديد يدوي</button></div>
    <div class="row" style="margin-top:12px"><button class="btn" id="mok">إضافة الدرس</button><button class="btn ghost" id="mcancel">إلغاء</button></div>`);
    const g = id => document.getElementById(id);
    const fS = () => { g('mns').innerHTML = db.subjects.map(s => `<option value="${s.id}">${esc(s.name)}</option>`).join(''); };
    const fC = sid => { g('mnc').innerHTML = chaptersOf(sid).map(c => `<option value="${c.id}">${esc(c.title)}</option>`).join(''); };
    const fT = (sid, cid) => { g('mnt').innerHTML = topicsOf(sid, cid).map(t => `<option value="${t.id}">${esc(t.title)}</option>`).join(''); };
    let det = null, manual = false;
    const subjName = sid => db.subjects.find(s => s.id === sid)?.name || '';
    const detect = () => {
      const sid = g('mns').value, pf = +g('mnpf').value || null, pt = +g('mnpt').value || pf;
      g('mntitle').value = subjName(sid);
      det = null;
      if (sid && pf != null) {
        const m = topicsForPages(db, sid, pf, pt);
        if (m.from) {
          const all = topicsBetween(db, sid, m.from.t.id, m.to.t.id);
          det = { c: m.from.c, t: m.from.t, all };
          g('mdet').innerHTML = `من «${esc(m.from.t.title)}» إلى «${esc(m.to.t.title)}» — ${all.length} ${all.length === 1 ? 'موضوع' : 'مواضيع'}: ` + all.map(x => esc(x.t.title)).join('، ');
        } else g('mdet').textContent = 'لا مواضيع مسجلة بهذه الصفحات — سجل صفحات المواضيع أولًا أو استخدم التحديد اليدوي.';
      } else g('mdet').textContent = 'أدخل الصفحات لتُحدد المواضيع داخل المادة.';
      fillLec();
    };
    const nextLec = () => {
      const tp = manual ? topicsOf(g('mns').value, g('mnc').value).find(t => t.id === g('mnt').value) : det?.t;
      const nums = (tp?.lessons || []).map(l => +l.lectureNo).filter(n => !isNaN(n));
      return nums.length ? Math.max(...nums) + 1 : 1;
    };
    const fillLec = () => { if (!g('mnlec').value) g('mnlec').value = nextLec(); };
    fS(); g('mns').value = st.sid || db.subjects[0].id;
    g('mns').onchange = () => { g('mnlec').value = ''; detect(); if (manual) { fC(g('mns').value); fT(g('mns').value, g('mnc').value); } };
    g('mnpf').onchange = detect; g('mnpt').onchange = detect;
    g('mman').onclick = () => {
      manual = !manual;
      g('mmanual').classList.toggle('hidden', !manual);
      g('mman').textContent = manual ? 'إخفاء التحديد اليدوي' : 'تحديد يدوي';
      if (manual) { fC(g('mns').value); fT(g('mns').value, g('mnc').value); g('mnc').onchange = () => fT(g('mns').value, g('mnc').value); }
    };
    g('mcancel').onclick = () => closeModal();
    detect();
    g('mok').onclick = () => {
      const sid = g('mns').value;
      let cid, tid;
      if (manual) {
        cid = g('mnc').value; tid = g('mnt').value;
        if (!sid || !cid || !tid) return toast('اختر المادة والفصل والموضوع');
      } else {
        if (!sid) return toast('اختر المادة');
        if (!det) return toast('أدخل الصفحات لتُحدد المواضيع — أو استخدم التحديد اليدوي');
        cid = det.c.id; tid = det.t.id;
      }
      const tp = topicsOf(sid, cid).find(t => t.id === tid); if (!tp) return toast('الموضوع غير موجود');
      const pf = +g('mnpf').value || null;
      const lec = g('mnlec').value === '' ? nextLec() : +g('mnlec').value;
      tp.lessons.push({ id: uid('ls'), title: subjName(sid), desc: '', content: '', duration: +g('mndur').value || 30, pageFrom: pf, pageTo: +g('mnpt').value || pf, lectureNo: lec, remindAt: g('mnrem').value || null, completed: false, favorite: false, notes: '', lastStudied: null, createdAt: now() });
      saveLocal(); closeModal();
      st.sid = ''; st.cid = ''; st.tid = ''; saveFilter(); syncFilters(); drawList(); toast(`أُضيفت المحاضرة ${lec} ✅`);
    };
  };
  // التصفية
  const syncFilters = () => { fillSubjects($('fs'), st.sid, true); fillChapters($('fc'), st.sid, st.cid); fillTopics($('ft'), st.sid, st.cid, st.tid); $('ff').value = st.f; $('fq').value = st.q; };
  syncFilters();
  $('fs').onchange = e => { st.sid = e.target.value; st.cid = ''; st.tid = ''; saveFilter(); syncFilters(); drawList(); };
  $('fc').onchange = e => { st.cid = e.target.value; st.tid = ''; saveFilter(); syncFilters(); drawList(); };
  $('ft').onchange = e => { st.tid = e.target.value; saveFilter(); drawList(); };
  $('ff').onchange = e => { st.f = e.target.value; saveFilter(); drawList(); };
  $('fq').oninput = e => { st.q = e.target.value.trim(); saveFilter(); drawList(); };

  function collect() {
    const out = [];
    const sids = st.sid ? [st.sid] : db.subjects.map(s => s.id);
    for (const sid of sids) {
      const s = db.subjects.find(x => x.id === sid);
      for (const c of chaptersOf(sid)) {
        if (st.cid && c.id !== st.cid) continue;
        for (const t of (c.topics || [])) {
          if (st.tid && t.id !== st.tid) continue;
          for (const l of (t.lessons || [])) out.push({ s, c, t, l });
        }
      }
    }
    return out.filter(n =>
      (st.f === 'all' || (st.f === 'done') === !!n.l.completed) &&
      (!st.q || n.l.title.includes(st.q)));
  }
  function drawList() {
    const rows = collect();
    const n = (st.cid ? 1 : 0) + (st.tid ? 1 : 0) + (st.q ? 1 : 0) + (st.f !== 'todo' ? 1 : 0);
    const fc = el.querySelector('#fcount');
    if (fc) { if (n) { fc.textContent = n; fc.classList.remove('hidden'); } else fc.classList.add('hidden'); }
    el.querySelector('#llist').innerHTML = rows.length ? `<p class="muted small">${rows.length} درس</p>` + rows.map(n => `
      <div class="list-item"><button class="icon-btn" data-done="${n.l.id}" title="إنجاز">${n.l.completed ? icon('checkCircle', 20) : icon('circle', 20)}</button>
      <div style="flex:1"><b>${esc(n.l.title)}${lectureLabel(n.l) ? ' · ' + lectureLabel(n.l) : ''}</b>
      <div style="margin:4px 0">${subjBadge(db, n.s.id)}</div>
      <div class="muted small">${esc(n.c.title)} · ${esc(n.t.title)}${pagesLabel(n.l.pageFrom, n.l.pageTo) ? ' · ' + pagesLabel(n.l.pageFrom, n.l.pageTo) : ''}${n.l.remindAt ? ' · 🔔 ' + esc(n.l.remindAt) : ''}</div></div>
      <a class="btn sm ghost" href="#/lesson/${n.s.id}/${n.c.id}/${n.t.id}/${n.l.id}">فتح</a>
      <button class="btn sm ghost" data-del="${n.l.id}"><span class="ic">${icon('trash', 15)}</span></button></div>`).join('')
      : '<div class="card muted">لا دروس مطابقة — غيّر التصفية أو أضف درسًا بالأعلى.</div>';
    el.querySelectorAll('[data-done]').forEach(b => b.onclick = () => {
      const n = collect().find(x => x.l.id === b.dataset.done); if (!n) return;
      n.l.completed = !n.l.completed;
      if (n.l.completed) { n.l.lastStudied = new Date().toISOString(); db.progress.xp = (db.progress.xp || 0) + 50; db.progress.studyMinutes = (db.progress.studyMinutes || 0) + (n.l.duration || 30); touchActivity(db); toast('أحسنت! +50 XP 🎉'); }
      saveLocal(); drawList();
    });
    el.querySelectorAll('[data-del]').forEach(b => b.onclick = () => {
      if (!confirm('حذف الدرس؟')) return;
      outer: for (const s of db.subjects) for (const c of (db.curriculum[s.id]?.chapters || [])) for (const t of (c.topics || [])) {
        const i = (t.lessons || []).findIndex(l => l.id === b.dataset.del);
        if (i >= 0) { t.lessons.splice(i, 1); break outer; }
      }
      saveLocal(); drawList();
    });
  }
  drawList();
}
