// صفحة الجدول المدرسي الأسبوعي — إدارة منظمة: كل يوم بطاقته (إضافة/حذف/وقت الحصة).
import { getDB, saveLocal } from '../store.js';
import { esc } from '../config.js';
import { toast } from '../ui.js';
import { icon } from '../icons.js';
import { DAY_NAMES, DAY_ORDER, ensureTimetable } from '../models.js';

export async function pTimetable(el) {
  const db = getDB();
  ensureTimetable(db);
  const today = new Date().getDay();
  el.innerHTML = `<span class="eyebrow">جدولي المدرسي</span>
  <div class="row spread"><h2 style="margin-top:0"><span class="h-ic">${icon('calendar', 20)}</span> الجدول المدرسي الأسبوعي</h2><a class="btn sm ghost" href="#/calendar">التقويم ←</a></div>
  <p class="muted small">ثابت أسبوعيًا ويتكرر تلقائيًا — يظهر في الرئيسية حسب اليوم. يمكن استيراده من JSON.</p>
  <div class="grid cols2">${DAY_ORDER.map(d => `
    <div class="os-panel" ${d === today ? 'style="border-color:var(--primary)"' : ''}>
      <div class="row spread"><b>${DAY_NAMES[d]}${d === today ? ' · اليوم' : ''}</b><span class="chip">${(db.timetable[d] || []).length}</span></div>
      <div id="ttd-${d}"></div>
      <div class="row" style="margin-top:8px"><select id="tts-${d}" style="flex:1;min-width:0">${db.subjects.map(s => `<option value="${s.id}">${esc(s.name)}</option>`).join('')}</select>
      <input id="ttt-${d}" placeholder="الوقت" style="max-width:100px">
      <button class="btn sm" data-ttadd="${d}"><span class="ic">${icon('plus', 15)}</span></button></div>
    </div>`).join('')}</div>`;

  const drawDay = d => {
    const box = el.querySelector('#ttd-' + d); if (!box) return;
    const list = db.timetable[d] || [];
    box.innerHTML = list.length ? list.map((e, i) => {
      const s = db.subjects.find(x => x.id === e.subjectId);
      return `<div class="list-item"><span>${esc(s?.icon || '🏫')}</span><div style="flex:1"><b>${esc(s?.name || '؟')}</b>${e.time ? `<div class="muted small">${esc(e.time)}</div>` : ''}</div>
      <div class="tt-ctl"><button class="icon-btn" data-ttup="${d}:${i}" title="تحريك لأعلى" ${i === 0 ? 'disabled style="opacity:.35"' : ''}>▲</button><button class="icon-btn" data-ttdn="${d}:${i}" title="تحريك لأسفل" ${i === list.length - 1 ? 'disabled style="opacity:.35"' : ''}>▼</button>
      <select data-ttmv="${d}:${i}" title="نقل ليوم آخر" style="max-width:108px">${DAY_ORDER.map(dd => `<option value="${dd}" ${dd === d ? 'selected' : ''}>${DAY_NAMES[dd]}</option>`).join('')}</select>
      <button class="btn sm ghost" data-ttdel="${d}:${i}"><span class="ic">${icon('trash', 15)}</span></button></div></div>`;
    }).join('') : '<p class="muted small">يوم فارغ.</p>';
    box.querySelectorAll('[data-ttdel]').forEach(b => b.onclick = () => {
      const [dd, i] = b.dataset.ttdel.split(':');
      db.timetable[dd].splice(+i, 1); saveLocal(); drawDay(+dd); refreshCounts();
    });
    box.querySelectorAll('[data-ttup]').forEach(b => b.onclick = () => {
      const [dd, i] = b.dataset.ttup.split(':'); const a = db.timetable[dd]; const j = +i;
      if (j <= 0) return; const t = a[j - 1]; a[j - 1] = a[j]; a[j] = t; saveLocal(); drawDay(+dd);
    });
    box.querySelectorAll('[data-ttdn]').forEach(b => b.onclick = () => {
      const [dd, i] = b.dataset.ttdn.split(':'); const a = db.timetable[dd]; const j = +i;
      if (j >= a.length - 1) return; const t = a[j + 1]; a[j + 1] = a[j]; a[j] = t; saveLocal(); drawDay(+dd);
    });
    box.querySelectorAll('[data-ttmv]').forEach(sel => sel.onchange = () => {
      const [dd, i] = sel.dataset.ttmv.split(':'); const to = +sel.value;
      if (to === +dd) return;
      const mv = db.timetable[dd].splice(+i, 1)[0];
      db.timetable[to] = db.timetable[to] || []; db.timetable[to].push(mv);
      saveLocal(); pTimetable(el); toast(`نُقلت إلى ${DAY_NAMES[to]} ✅`);
    });
  };
  const refreshCounts = () => pTimetable(el);
  DAY_ORDER.forEach(d => {
    drawDay(d);
    el.querySelector(`[data-ttadd="${d}"]`).onclick = () => {
      const sid = el.querySelector('#tts-' + d).value;
      if (!sid) return toast('أنشئ مادة أولًا من صفحة المواد');
      db.timetable[d] = db.timetable[d] || [];
      db.timetable[d].push({ subjectId: sid, time: el.querySelector('#ttt-' + d).value.trim() });
      el.querySelector('#ttt-' + d).value = '';
      saveLocal(); drawDay(d); refreshCounts(); toast('أُضيفت 🏫');
    };
  });
}
