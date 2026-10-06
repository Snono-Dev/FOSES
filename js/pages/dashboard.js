import { getDB, saveLocal } from '../store.js';
import { computeStats, examScopeLabel, daysLabel, dueCount, collectReminders, nextLessons, touchActivity, pagesLabel, todaySubjects, DAY_NAMES, completedToday, lectureLabel } from '../models.js';
import { esc, todayKey } from '../config.js';
import { getSession } from '../auth.js';
import { toast } from '../ui.js';
import { notifyNow } from '../notify.js';
import { SS } from '../storage.js';
import { subjBadge, lessonHead } from '../components.js';

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
  const tkey = todayKey();
  // دروس اليوم = تذكير بتاريخ اليوم فقط (بلا ترحيل) + دروس مواد اليوم المدرسية (حتى بدون تذكير)
  const todayLessons = rems.filter(r => r.kind === 'lesson' && r.date === tkey);
  const pace = db.settings.lessonsPerDay || 3;
  const schoolIds = new Set(todaySubjects(db).map(x => x.subject.id));
  const schoolLessons = [];
  if (schoolIds.size) {
    outer: for (const s of db.subjects) {
      if (!schoolIds.has(s.id)) continue;
      const cur = db.curriculum[s.id];
      for (const c of (cur?.chapters || [])) for (const t of (c.topics || [])) for (const l of (t.lessons || [])) {
        if (l.completed || todayLessons.some(a => a.ref.l.id === l.id)) continue;
        schoolLessons.push({ s, c, t, l });
        if (schoolLessons.length >= pace) break outer;
      }
    }
  }
  const fallback = (!todayLessons.length && !schoolLessons.length) ? nextLessons(db, pace) : [];
  const upcoming = [...db.exams].filter(e => !e.done).sort((a, b) => (a.date || '9999').localeCompare(b.date || '9999')).slice(0, 5);
  const schoolToday = todaySubjects(db);
  const dayName = DAY_NAMES[new Date().getDay()];
  const doneToday = completedToday(db);

  el.innerHTML = `
  <div class="greet"><span class="eyebrow">Free Open Source E-School</span>
    <h1>${greeting()}${sess?.name ? '، ' + esc(sess.name.split(' ')[0]) : ''} 👋</h1>
    <div class="os-tag">مدرستك · بياناتك · مفتوح المصدر</div></div>

  <div class="os-panel"><span class="eyebrow">دروس اليوم 📌</span>
    ${todayLessons.map(r => `<div class="list-item" style="border-color:var(--warn)"><button class="icon-btn" data-ldone="${r.ref.l.id}" title="إنجاز">⭕</button>
      <div style="flex:1">${lessonHead(db, r.ref.s.id, r.ref.l)}<div class="muted small">${esc(r.ref.c.title)} · <span class="tname">${esc(r.ref.t.title)}</span> · تذكير اليوم 📌</div></div>
      <a class="btn sm ghost" href="${r.link}">فتح</a></div>`).join('')}
    ${schoolLessons.length ? `<p class="muted small" style="margin:10px 0 4px">من مواد اليوم المدرسية:</p>` + schoolLessons.map(n => `<a class="list-item" href="#/lesson/${n.s.id}/${n.c.id}/${n.t.id}/${n.l.id}"><span>📖</span><div>${lessonHead(db, n.s.id, n.l)}<div class="muted small">${esc(n.c.title)} · <span class="tname">${esc(n.t.title)}</span></div></div></a>`).join('') : ''}
    ${!todayLessons.length && !schoolLessons.length ? (fallback.length ? `<p class="muted small" style="margin:10px 0 4px">التالي للدراسة:</p>` + fallback.map(n => `<a class="list-item" href="#/lesson/${n.s.id}/${n.c.id}/${n.t.id}/${n.l.id}"><span>📖</span><div>${lessonHead(db, n.s.id, n.l)}<div class="muted small">${esc(n.c.title)} · <span class="tname">${esc(n.t.title)}</span></div></div></a>`).join('') : '<p class="muted">لا دروس اليوم 🎉.</p>') : ''}
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

  <div class="os-panel"><span class="eyebrow">منجز اليوم ✅</span>
    ${doneToday.lessons.map(n => `<div class="list-item"><span>✅</span><div>${lessonHead(db, n.s.id, n.l)}<div class="muted small">${esc(n.c.title)} · <span class="tname">${esc(n.t.title)}</span></div></div></div>`).join('')}
    ${doneToday.exams.map(e => `<div class="list-item"><span>✅</span><div><b>${esc(e.title)}</b><div class="muted small">تذكير امتحان منجز</div></div></div>`).join('')}
    ${!doneToday.lessons.length && !doneToday.exams.length ? '<p class="muted">لم تُنجز شيئًا اليوم بعد — ابدأ من دروس اليوم بالأعلى 💪.</p>' : ''}
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
