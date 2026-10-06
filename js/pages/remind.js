import { getDB, saveLocal } from '../store.js';
import { esc } from '../config.js';
import { toast } from '../ui.js';
import { collectReminders, touchActivity } from '../models.js';
import { icon } from '../icons.js';
import { subjBadge } from '../components.js';

export async function pReminders(el) {
  const db = getDB();
  const all = collectReminders(db);
  const over = all.filter(r => r.overdue);
  const today = all.filter(r => r.today);
  const up = all.filter(r => !r.overdue && !r.today);
  const card = r => `<div class="card" style="border-inline-start:3px solid ${r.overdue ? 'var(--bad)' : r.kind === 'exam' ? 'var(--warn)' : 'var(--primary)'}">
    <div class="row spread"><b>${r.kind === 'exam' ? '◉' : '📖'} ${esc(r.title)}</b><span class="chip">${r.overdue ? 'متأخر' : r.today ? 'اليوم' : esc(r.date)}</span></div>
    <div style="margin:4px 0">${r.kind === 'lesson' ? subjBadge(db, r.ref.s.id) : ''}</div>
    <div class="muted small">${esc(r.sub)}</div>
    <div class="row" style="margin-top:8px"><a class="btn sm" href="${r.link}">فتح</a>`
    + (r.kind === 'exam'
      ? `<button class="btn sm ok" data-exdone="${r.ref.exam.id}"><span class="ic">${icon('check', 15)}</span> تم</button>`
      : `<button class="btn sm ok" data-lsdone="${r.ref.l.id}"><span class="ic">${icon('check', 15)}</span> إكمال الدرس</button><button class="btn sm ghost" data-lsno="${r.ref.l.id}">إلغاء التذكير</button>`)
    + `</div></div>`;
  const sec = (t, list) => list.length ? `<h3>${t} (${list.length})</h3>` + list.map(card).join('') : '';
  el.innerHTML = `<span class="eyebrow">التنبيهات</span><h2 style="margin-top:0"><span class="h-ic">${icon('bell', 20)}</span> التنبيهات</h2>`
    + `<p class="muted small">تذكيرات الدروس (بتاريخ تحدده من صفحة الدرس) وتذكيرات الامتحانات — تلقائيا بدون اضافة يدوية. 🔔 لتصلك على الهاتف فعّلها من <a href="#/settings">الإعدادات ← تنبيهات الهاتف</a>.</p>`
    + sec('متاخرة', over) + sec('اليوم', today) + sec('قادمة', up)
    + (all.length ? '' : '<div class="card muted">لا تذكيرات — حدد تاريخا لدرس او اضف تذكير امتحان.</div>');
  el.querySelectorAll('[data-exdone]').forEach(b => b.onclick = () => {
    const e = db.exams.find(x => x.id === b.dataset.exdone); if (!e) return;
    e.done = true; db.progress.xp = (db.progress.xp || 0) + 30; touchActivity(db);
    saveLocal(); toast('تم +30 XP'); pReminders(el);
  });
  el.querySelectorAll('[data-lsdone]').forEach(b => b.onclick = () => {
    const l = findLesson(db, b.dataset.lsdone); if (!l) return;
    l.completed = true; db.progress.xp = (db.progress.xp || 0) + 50; touchActivity(db);
    saveLocal(); toast('احسنت +50 XP'); pReminders(el);
  });
  el.querySelectorAll('[data-lsno]').forEach(b => b.onclick = () => {
    const l = findLesson(db, b.dataset.lsno); if (!l) return;
    l.remindAt = null; saveLocal(); pReminders(el);
  });
}
function findLesson(db, lid) {
  for (const s of (db.subjects || [])) for (const c of (db.curriculum[s.id]?.chapters || [])) for (const t of (c.topics || [])) for (const l of (t.lessons || [])) if (l.id === lid) return l;
  return null;
}
