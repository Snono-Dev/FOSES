// Exams = reminders (تذكير بامتحان من نطاق إلى نطاق + تاريخ), NOT an interactive test.
import { getDB, saveLocal } from '../store.js';
import { esc, uid, now } from '../config.js';
import { toast, modal, closeModal } from '../ui.js';
import { touchActivity, examScopeLabel, daysLabel, orderedTopics, pagesForTopics, topicsForPages, topicsBetween, pagesLabel } from '../models.js';
import { icon } from '../icons.js';

function subjName(db, sid) { return db.subjects.find(s => s.id === sid)?.name || 'بدون مادة'; }
function sortExams(db) {
  return [...db.exams].sort((a, b) => {
    if (!!a.done !== !!b.done) return a.done ? 1 : -1;
    if (!a.date && !b.date) return 0;
    if (!a.date) return 1; if (!b.date) return -1;
    return a.date.localeCompare(b.date);
  });
}
function countdownChip(e) {
  const d = daysLabel(e.date);
  const col = e.done ? 'var(--ok)' : d.cls === 'bad' ? 'var(--bad)' : d.cls === 'warn' ? 'var(--warn)' : '';
  return `<span class="chip" ${col ? `style="border-color:${col};color:${col}"` : ''}>${e.done ? '✅ تم' : '◉ ' + esc(d.txt)}${e.date && !e.done ? ' · ' + esc(e.date) : ''}</span>`;
}

// ---------- القائمة ----------
export async function pExams(el) {
  const db = getDB();
  el.innerHTML = `<span class="eyebrow">تذكيرات الامتحانات</span><div class="row spread"><h2 style="margin-top:0"><span class="h-ic">${icon('exam', 20)}</span> تذكيرات الامتحانات</h2><button class="btn" id="add"><span class="ic">${icon('plus', 16)}</span> تذكير</button></div>
  ${sortExams(db).map(e => `<div class="card xcard" data-open="${e.id}" style="cursor:pointer"><div class="row spread"><b>${e.done ? '✅' : '◉'} ${esc(e.title)}</b>${countdownChip(e)}</div>
    <div class="muted small">${esc(subjName(db, e.subjectId))} · ${esc(examScopeLabel(db, e))}${e.notes ? ' · ' + esc(e.notes.slice(0, 60)) : ''}</div>
    <div class="row" style="margin-top:8px">
      <button class="btn sm ${e.done ? 'ghost' : 'ok'}" data-done="${e.id}"><span class="ic">${icon('check', 15)}</span> ${e.done ? 'إعادة فتح' : 'تم'}</button>
      <a class="btn sm ghost" href="#/exam/${e.id}/edit"><span class="ic">${icon('pencil', 15)}</span></a>
      <button class="btn sm ghost" data-del="${e.id}"><span class="ic">${icon('trash', 15)}</span></button>
    </div></div>`).join('') || '<div class="card muted">لا تذكيرات — أضف تذكيرًا بامتحان قادم (المادة + من موضوع إلى موضوع + التاريخ).</div>'}`;
  el.querySelector('#add').onclick = () => {
    if (!db.subjects.length) return toast('أنشئ مادة أولًا');
    openExamModal(db, () => pExams(el));
  };
  el.querySelectorAll('[data-open]').forEach(c => {
    c.onclick = () => { location.hash = '#/exam/' + c.dataset.open; };
    c.querySelectorAll('a,button').forEach(x => x.addEventListener('click', ev => ev.stopPropagation()));
  });
  el.querySelectorAll('[data-done]').forEach(b => b.onclick = ev => { ev.stopPropagation(); toggleDone(db, b.dataset.done, () => pExams(el)); });
  el.querySelectorAll('[data-del]').forEach(b => b.onclick = ev => {
    ev.stopPropagation();
    if (!confirm('حذف التذكير؟')) return;
    db.exams = db.exams.filter(e => e.id !== b.dataset.del); saveLocal(); pExams(el);
  });
}

export function toggleDone(db, id, rerender) {
  const e = db.exams.find(x => x.id === id); if (!e) return;
  e.done = !e.done; e.doneAt = e.done ? now() : null;
  if (e.done) { db.progress.xp = (db.progress.xp || 0) + 30; touchActivity(db); toast('أُنجز الامتحان! +30 XP 🎉'); }
  else { db.progress.xp = Math.max(0, (db.progress.xp || 0) - 30); toast('أُلغي الإنجاز — 30 XP ⏸️'); }
  saveLocal(); rerender && rerender();
}

// ---------- التفاصيل ----------
export async function pExam(el, id) {
  const db = getDB(); const e = db.exams.find(x => x.id === id);
  if (!e) { el.innerHTML = '<div class="card">غير موجود</div>'; return; }
  el.innerHTML = `<a href="#/exams">← التذكيرات</a>
  <div class="os-panel"><span class="eyebrow">تذكير امتحان</span>
    <h2 style="margin-top:4px">${e.done ? '✅' : '◉'} ${esc(e.title)}</h2>
    <div class="row">${countdownChip(e)}<span class="chip">${esc(subjName(db, e.subjectId))}</span></div>
    <div class="card" style="margin-top:10px;background:var(--card2)"><b>النطاق:</b> ${esc(examScopeLabel(db, e))}</div>
    ${(() => { const tl = topicsBetween(db, e.subjectId, e.fromTopicId, e.toTopicId);
      return tl.length ? `<div class="card"><b>📚 المواضيع المشمولة (${tl.length})</b>${tl.map((x, i) => `<div class="list-item"><span>${i + 1}</span><div><b>${esc(x.t.title)}</b><div class="muted small">${esc(x.c.title)}${pagesLabel(x.t.pageFrom, x.t.pageTo) ? ' · ' + pagesLabel(x.t.pageFrom, x.t.pageTo) : ''}</div></div></div>`).join('')}</div>` : ''; })()}
    ${e.date ? `<p>📅 التاريخ: <b>${esc(e.date)}</b></p>` : '<p class="muted">بلا تاريخ — حدده من التحرير ليظهر في الجدول.</p>'}
    ${e.notes ? `<p>📝 ${esc(e.notes)}</p>` : ''}
    <div class="row" style="margin-top:10px">
      <button class="btn ${e.done ? 'ghost' : 'ok'}" id="done"><span class="ic">${icon('check', 16)}</span> ${e.done ? 'إعادة فتح' : 'تم الامتحان'}</button>
      <a class="btn ghost" href="#/exam/${e.id}/edit"><span class="ic">${icon('pencil', 16)}</span> تحرير</a>
    </div></div>`;
  el.querySelector('#done').onclick = () => toggleDone(db, id, () => pExam(el, id));
}

// ---------- نموذج مشترك (صفحة التحرير + نافذة الإضافة) ----------
function topicGroupedHTML(db, sid, sel) {
  return (db.curriculum[sid]?.chapters || []).map(c =>
    `<optgroup label="${esc(c.title)}">${(c.topics || []).map(t => `<option value="${t.id}" ${t.id === sel ? 'selected' : ''}>${esc(t.title)}</option>`).join('')}</optgroup>`).join('');
}
function examFormHTML(db, e, p) {
  return `<label>عنوان التذكير</label><input id="${p}xt" value="${esc(e.title)}" placeholder="مثال: امتحان الفصل الأول">
  <label>المادة</label><select id="${p}xs">${db.subjects.map(s => `<option value="${s.id}" ${s.id === e.subjectId ? 'selected' : ''}>${esc(s.name)}</option>`).join('')}</select>
  <div class="grid cols2"><div><label>من موضوع</label><select id="${p}xf"><option value="">—</option>${topicGroupedHTML(db, e.subjectId, e.fromTopicId)}</select></div>
  <div><label>إلى موضوع</label><select id="${p}xt2"><option value="">—</option>${topicGroupedHTML(db, e.subjectId, e.toTopicId)}</select></div></div>
  <div class="fld-row"><div class="fld"><span>من صفحة (تُحدد المواضيع تلقائيًا)</span><input id="${p}xpf" type="number" placeholder="مثال: 5" value="${e.pageFrom || ''}"></div>
  <div class="fld"><span>إلى صفحة</span><input id="${p}xpt" type="number" placeholder="مثال: 20" value="${e.pageTo || ''}"></div></div>
  <div class="muted small" id="${p}xhint" style="margin-top:6px"></div>
  <label>وصف النطاق (اختياري)</label><input id="${p}xsc" value="${esc(e.scopeText || '')}" placeholder="يُولّد تلقائيًا من المواضيع">
  <label>تاريخ الامتحان (منتقي — يظهر تلقائيًا في الجدول 📅)</label><input id="${p}xd" type="date" value="${esc(e.date || '')}">
  <label>ملاحظات</label><textarea id="${p}xn" rows="3">${esc(e.notes || '')}</textarea>`;
}
function bindExamForm(root, db, e, p) {
  const q = id => root.querySelector('#' + p + id);
  let pagesAuto = true;
  const hint = t => { q('xhint').textContent = t; };
  const redrawTopics = () => {
    q('xf').innerHTML = '<option value="">—</option>' + topicGroupedHTML(db, e.subjectId, null);
    q('xt2').innerHTML = '<option value="">—</option>' + topicGroupedHTML(db, e.subjectId, null);
    e.fromTopicId = null; e.toTopicId = null; hint('');
  };
  q('xs').onchange = ev => { e.subjectId = ev.target.value; saveDraft(); redrawTopics(); };
  q('xf').onchange = () => { if (!q('xt2').value) q('xt2').value = q('xf').value; if (pagesAuto) syncPagesFromTopics(); };
  q('xt2').onchange = () => { if (pagesAuto) syncPagesFromTopics(); };
  q('xpf').onchange = () => syncTopicsFromPages();
  q('xpt').onchange = () => syncTopicsFromPages();
  function syncPagesFromTopics() {
    const pr = pagesForTopics(db, e.subjectId, q('xf').value || null, q('xt2').value || null);
    if (pr.pageFrom != null) { q('xpf').value = pr.pageFrom; q('xpt').value = pr.pageTo ?? pr.pageFrom; hint(`الصفحات من مواضيعك: ${pr.pageFrom}–${pr.pageTo ?? pr.pageFrom}`); }
    else hint('هذه المواضيع بلا صفحات مسجلة — اكتب الصفحات يدويًا أو سجلها في المواضيع أولًا.');
  }
  function syncTopicsFromPages() {
    const pf = +q('xpf').value || null, pt = +q('xpt').value || pf;
    if (pf == null) { hint(''); return; }
    const m = topicsForPages(db, e.subjectId, pf, pt);
    if (m.from) { q('xf').value = m.from.t.id; q('xt2').value = m.to.t.id; hint(`حُددت المواضيع تلقائيًا: من «${m.from.t.title}» إلى «${m.to.t.title}»`); }
    else hint('لا توجد مواضيع مسجلة بهذه الصفحات — حددها يدويًا.');
  }
  function saveDraft() {
    e.title = q('xt').value;
    e.fromTopicId = q('xf').value || null;
    e.toTopicId = q('xt2').value || e.fromTopicId;
    e.pageFrom = +q('xpf').value || null;
    e.pageTo = +q('xpt').value || e.pageFrom;
    e.scopeText = q('xsc').value.trim();
    e.date = q('xd').value || null;
    e.notes = q('xn').value;
  }
  return saveDraft;
}
function openExamModal(db, onDone) {
  const e = { id: uid('ex'), title: '', subjectId: db.subjects[0]?.id || '', fromTopicId: null, toTopicId: null, pageFrom: null, pageTo: null, scopeText: '', date: '', notes: '', done: false, doneAt: null, createdAt: now() };
  modal(`<h3><span class="h-ic">${icon('plus', 18)}</span> تذكير جديد</h3>${examFormHTML(db, e, 'm')}
  <div class="row" style="margin-top:12px"><button class="btn" id="mok"><span class="ic">${icon('check', 16)}</span> حفظ</button><button class="btn ghost" id="mcancel">إلغاء</button></div>`);
  const root = document.getElementById('modalRoot');
  const saveDraft = bindExamForm(root, db, e, 'm');
  root.querySelector('#mcancel').onclick = () => closeModal();
  root.querySelector('#mok').onclick = () => {
    saveDraft();
    if (!e.title.trim()) return toast('أدخل عنوانًا');
    db.exams.push(e); saveLocal(); closeModal(); toast('حُفظ التذكير 📌'); onDone && onDone();
  };
}
// ---------- إنشاء / تحرير (صفحة كاملة) ----------
export async function pExamEdit(el, id) {
  const db = getDB();
  const isNew = id === 'new';
  const e = isNew ? { id: uid('ex'), title: '', subjectId: db.subjects[0]?.id || '', fromTopicId: null, toTopicId: null, pageFrom: null, pageTo: null, scopeText: '', date: '', notes: '', done: false, doneAt: null, createdAt: now() }
    : db.exams.find(x => x.id === id);
  if (!e) { el.innerHTML = '<div class="card">غير موجود</div>'; return; }
  if (!db.subjects.length) { el.innerHTML = '<div class="card">أنشئ مادة أولًا. <a href="#/subjects">المواد</a></div>'; return; }

  el.innerHTML = `<a href="#/exams">← رجوع</a><h2>${isNew ? `<span class="h-ic">${icon('plus', 20)}</span> تذكير جديد` : `<span class="h-ic">${icon('pencil', 20)}</span> تحرير التذكير`}</h2>
  <div class="card">${examFormHTML(db, e, '')}
  <div class="row" style="margin-top:12px"><button class="btn" id="save"><span class="ic">${icon('check', 16)}</span> حفظ التذكير</button></div></div>`;
  const saveDraft = bindExamForm(el, db, e, '');
  el.querySelector('#save').onclick = () => {
    saveDraft();
    if (!e.title.trim()) return toast('أدخل عنوانًا');
    if (isNew) db.exams.push(e);
    saveLocal(); toast('حُفظ التذكير 📌 — سيظهر في الجدول'); location.hash = '#/exam/' + e.id;
  };
}
