import { getDB, saveLocal } from '../store.js';
import { computeStats, examScopeLabel, daysLabel, dueCount, collectReminders, nextLessons, touchActivity, pagesLabel, todaySubjects, DAY_NAMES } from '../models.js';
import { esc } from '../config.js';
import { getSession } from '../auth.js';
import { toast } from '../ui.js';
import { notifyNow } from '../notify.js';
import { SS } from '../storage.js';
import { subjBadge } from '../components.js';

function greeting() {
  const h = new Date().getHours();
  if (h >= 5 && h < 12) return 'صباح الخير';
  if (h >= 12 && h < 18) return 'مساء النشاط';
  return 'مساء الخير';
}

export async function pDashboard(el) {
  const db = getDB();
  const st = computeStats(db);
  const sess = getSession();
  const due = dueCount(db);
  if (due > 0 && !SS.get('foses-due-toast')) {
    SS.set('foses-due-toast', '1');
    setTimeout(() => toast(`🔔 لديك ${due} تذكير مستحق — راجع التنبيهات`), 1200);
    try { if ('Notification' in window && Notification.permission === 'granted') notifyNow('🔔 FOSES — تذكيرات مستحقة', `لديك ${due} تذكير (دروس وامتحانات) — اضغط للمراجعة`); } catch {}
  }

  const rems = collectReminders(db);
  const todayLessons = rems.filter(r => r.kind === 'lesson' && (r.overdue || r.today));
  const upcoming = [...db.exams].filter(e => !e.done).sort((a, b) => (a.date || '9999').localeCompare(b.date || '9999')).slice(0, 5);
  const schoolToday = todaySubjects(db);
  const dayName = DAY_NAMES[new Date().getDay()];

  el.innerHTML = `
  <div class="greet"><span class="eyebrow">Free Open Source E-School</span>
    <h1>${greeting()}${sess?.name ? '، ' + esc(sess.name.split(' ')[0]) : ''} 👋</h1>
    <div class="os-tag">مدرستك · بياناتك · مفتوح المصدر</div></div>

  <div class="os-panel"><span class="eyebrow">دروس اليوم 📌</span>
    ${todayLessons.map(r => `<div class="list-item" style="border-color:var(--warn)"><button class="icon-btn" data-ldone="${r.ref.l.id}" title="إنجاز">⭕</button>
      <div style="flex:1"><b>${esc(r.title)}</b><div style="margin:4px 0">${subjBadge(db, r.ref.s.id)}</div><div class="muted small">${esc(r.ref.c.title)} · ${r.overdue ? 'متأخر ⚠️' : 'اليوم 📌'}</div></div>
      <a class="btn sm ghost" href="${r.link}">فتح</a></div>`).join('')
      || '<p class="muted">لا دروس لهذا اليوم 🎉.</p>'}
  </div>

  <div class="os-panel"><div class="row spread"><span class="eyebrow">مواد اليوم في المدرسة · ${dayName}</span><a class="os-go" href="#/timetable">الجدول ←</a></div>
    ${schoolToday.map(x => `<a class="list-item" href="#/subject/${x.subject.id}"><span>${esc(x.subject.icon || '🏫')}</span>
      <div><b>${esc(x.subject.name)}</b>${x.time ? `<div class="muted small">${esc(x.time)}</div>` : ''}</div></a>`).join('')
      || '<p class="muted">لا مواد مسجلة لهذا اليوم — حدد جدولك المدرسي من <a href="#/timetable">جدولي المدرسي</a> أو استورده من JSON.</p>'}
  </div>

  <div class="os-panel"><div class="row spread"><span class="eyebrow">الامتحانات القادمة</span><a class="os-go" href="#/exams">الكل ←</a></div>
    ${upcoming.map(e => { const d = daysLabel(e.date); return `<a class="list-item" href="#/exam/${e.id}"><span>◉</span>
      <div><b>${esc(e.title)} · ${esc(d.txt)}</b><div class="muted small">${esc(examScopeLabel(db, e))}${e.date ? ' · ' + esc(e.date) : ''}</div></div></a>`; }).join('')
      || '<p class="muted">لا امتحانات قادمة — أضف تذكيرًا من صفحة الامتحانات.</p>'}
  </div>

  <div class="grid cols2">
    <div class="stat-mini"><div class="v">🔥 ${db.progress?.streak || 0}</div><div class="k">يوم استمرارية</div></div>
    <div class="stat-mini"><div class="v">⭐ ${db.progress?.xp || 0}</div><div class="k">نقطة</div></div>
    <div class="stat-mini"><div class="v">🎓 ${st.subjectsDone}/${st.subjectsTotal}</div><div class="k">مادة منجزة (${st.subjectsPct}%)</div></div>
    <div class="stat-mini"><div class="v">⏱️ ${db.progress?.studyMinutes || 0}</div><div class="k">دقيقة دراسة</div></div>
  </div>

  ${!sess?.login ? `<div class="os-panel"><b>سجّل الدخول بـ GitHub</b><p class="muted small">ليُحفظ تقدمك تلقائيًا في مستودعك الخاص. أو جرّب الوضع التجريبي.</p><a class="btn" href="#/login">تسجيل الدخول</a></div>` : ''}`;

  el.querySelectorAll('[data-ldone]').forEach(b => b.onclick = () => {
    const r = todayLessons.find(x => x.ref.l.id === b.dataset.ldone); if (!r) return;
    r.ref.l.completed = true; r.ref.l.lastStudied = new Date().toISOString();
    db.progress.xp = (db.progress.xp || 0) + 50; touchActivity(db);
    saveLocal(); toast('أحسنت! +50 XP 🎉'); pDashboard(el);
  });
}
