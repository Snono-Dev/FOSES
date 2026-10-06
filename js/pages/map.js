import { getDB } from '../store.js';
import { computeStats, examScopeLabel, daysLabel, pagesLabel, lectureLabel } from '../models.js';
import { esc } from '../config.js';
import { subjColor, ring } from '../components.js';
import { icon } from '../icons.js';

export async function pMap(el, presetSid = null) {
  const db = getDB();
  if (!db.subjects.length) { el.innerHTML = `<h2>◉ خريطة الدراسة</h2><div class="card muted">لا مواد بعد. <a href="#/subjects">أنشئ مادة</a> لتبدأ رحلتك.</div>`; return; }
  const sid = presetSid || db.subjects[0].id;
  const st = computeStats(db);
  el.innerHTML = `<span class="eyebrow">خريطة الدراسة</span><h2 style="margin-top:0"><span class="h-ic">${icon('map', 20)}</span> خريطة الدراسة</h2>
  <div class="subj-pills">${db.subjects.map(s => {
    const p = st.perSubject[s.id] || { pct: 0 };
    return `<button class="chip ${s.id === sid ? 'on' : ''}" data-s="${s.id}"><span class="dot" style="background:${subjColor(s, db.subjects.indexOf(s))};display:inline-block"></span> ${esc(s.name)} · ${p.pct}%</button>`;
  }).join('')}</div><div id="mapBody" style="margin-top:6px"></div>`;
  const draw = (id) => {
    const s = db.subjects.find(x => x.id === id);
    const cur = db.curriculum[id] || { chapters: [] };
    const p = st.perSubject[id] || { total: 0, done: 0, pct: 0 };
    const exams = db.exams.filter(e => e.subjectId === id);
    const chOfTopic = tid => { for (const c of (cur.chapters || [])) if ((c.topics || []).some(t => t.id === tid)) return c.id; return null; };
    const exByCh = {}; exams.forEach(e => { const k = chOfTopic(e.fromTopicId) || chOfTopic(e.toTopicId) || '__end'; (exByCh[k] = exByCh[k] || []).push(e); });
    let h = `<div class="os-panel"><div class="row spread"><div><b style="font-size:17px">${esc(s.icon || '')} ${esc(s.name)}</b><div class="muted small">${p.done}/${p.total} درس · ${exams.length} تذكير</div>${ring(p.pct, subjColor(s, db.subjects.indexOf(s)), 64)}</div></div>`;
    h += `<div class="mpath">`;
    cur.chapters.forEach(c => {
      h += `<div class="mch">${esc(c.title)}${pagesLabel(c.pageFrom,c.pageTo)?' · '+pagesLabel(c.pageFrom,c.pageTo):''}</div>`;
      (c.topics || []).forEach(tp => {
        (tp.lessons || []).forEach(l => {
          const cls = l.completed ? 'done' : '';
          h += `<div class="mstep ${cls}"><a class="mtitle" href="#/lesson/${id}/${c.id}/${tp.id}/${l.id}">${l.completed ? '●' : '○'} ${esc(tp.title)}</a>${lectureLabel(l) ? ` <span class="chip">${lectureLabel(l)}</span>` : ''}<div class="muted small">${l.duration || 30} د${pagesLabel(l.pageFrom, l.pageTo) ? ' · ' + pagesLabel(l.pageFrom, l.pageTo) : ''}${l.favorite ? ' · ⭐' : ''}</div></div>`;
        });
      });
      (exByCh[c.id] || []).forEach(e => {
        const d = daysLabel(e.date);
        h += `<div class="mstep exam ${e.done ? 'passed' : ''}"><a class="mtitle" href="#/exam/${e.id}">◉ تذكير: ${esc(e.title)}</a><div class="muted small">${esc(examScopeLabel(db, e))} · ${e.done ? 'تم ✅' : esc(d.txt) + (e.date ? ' · ' + esc(e.date) : '')}</div></div>`;
      });
    });
    (exByCh.__end || []).forEach(e => {
      const d = daysLabel(e.date);
      h += `<div class="mstep exam ${e.done ? 'passed' : ''}"><a class="mtitle" href="#/exam/${e.id}">◉ تذكير: ${esc(e.title)}</a><div class="muted small">${esc(examScopeLabel(db, e))} · ${e.done ? 'تم ✅' : esc(d.txt)}</div></div>`;
    });
    h += `</div>`;
    if (!cur.chapters.length) h += `<div class="card muted">لا فصول بعد في هذه المادة.</div>`;
    el.querySelector('#mapBody').innerHTML = h;
  };
  el.querySelectorAll('[data-s]').forEach(b => b.onclick = () => {
    el.querySelectorAll('[data-s]').forEach(x => x.classList.remove('on')); b.classList.add('on'); draw(b.dataset.s);
  });
  draw(sid);
}
