import { getDB } from '../store.js';
import { computeStats, levelFor } from '../models.js';
import { esc } from '../config.js';
import { subjColor, ring, activityGraph } from '../components.js';
import { getSession } from '../auth.js';

export async function pDNA(el) {
  const db = getDB();
  const st = computeStats(db);
  const lv = levelFor(db.progress?.xp || 0);
  const sess = getSession();
  const mins = db.progress?.studyMinutes || 0;
  const hh = Math.floor(mins / 60), mm = mins % 60;
  const examsTaken = db.exams.filter(e => e.done).length;
  const maxPct = Math.max(1, ...Object.values(st.perSubject).map(p => p.pct));
  el.innerHTML = `<span class="eyebrow">الحمض الدراسي</span>
  <div class="greet"><h1>الحمض الدراسي ${sess?.name ? '· ' + esc(sess.name) : ''}</h1>
  <div class="os-tag">تعلّم · تتبّع · امتلك</div></div>
  <div class="os-panel"><div class="row spread">
    <div><div class="muted small">المستوى</div><div class="big">${lv.level}</div></div>
    ${ring(Math.round(lv.current / lv.need * 100), '#4F7CFF', 76, 9, lv.level + '')}
    <div style="text-align:end"><div class="muted small">XP</div><div class="big">${db.progress?.xp || 0}</div></div>
  </div>
  <div class="progress" style="margin-top:10px"><i style="width:${Math.round(lv.current / lv.need * 100)}%"></i></div>
  <div class="muted small" style="margin-top:4px">${lv.current} / ${lv.need} XP للمستوى التالي</div></div>
  <div class="os-panel"><span class="eyebrow">المواد</span>
  ${db.subjects.map((s, i) => {
    const p = st.perSubject[s.id] || { pct: 0, done: 0, total: 0 };
    const col = subjColor(s, i);
    return `<div class="dna-row"><span>${esc(s.name)}</span><div class="dna-track"><i style="width:${p.pct}%;background:${col}"></i></div><b>${p.pct}%</b></div>`;
  }).join('') || '<p class="muted">لا مواد بعد.</p>'}</div>
  <div class="grid cols2">
    <div class="stat-mini"><div class="v">🔥 ${db.progress?.streak || 0}</div><div class="k">يوم متتالي</div></div>
    <div class="stat-mini"><div class="v">🎓 ${st.subjectsDone}/${st.subjectsTotal}</div><div class="k">مادة منجزة (${st.subjectsPct}%)</div></div>
    <div class="stat-mini"><div class="v">📖 ${st.done}</div><div class="k">درس مكتمل</div></div>
    <div class="stat-mini"><div class="v">◉ ${examsTaken}</div><div class="k">امتحان منجز</div></div>
    <div class="stat-mini"><div class="v">⏱️ ${hh}h ${mm}m</div><div class="k">وقت الدراسة</div></div>
  </div>
  <div class="os-panel"><span class="eyebrow">النشاط الدراسي</span>${activityGraph(db, 14)}</div>
  <div class="os-panel"><span class="eyebrow">الإنجازات</span>
  ${(db.achievements || []).map(a => `<div class="list-item"><span>🏅</span><div><b>${esc(a.title)}</b><div class="muted small">${esc((a.at || '').slice(0, 10))}</div></div></div>`).join('') || '<p class="muted small">أكمل الدروس والامتحانات لفتح الشارات.</p>'}</div>`;
}
