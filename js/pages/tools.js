import { getDB, saveLocal } from '../store.js';
import { computeStats, levelFor, touchActivity, nextLessons, examScopeLabel, daysLabel, DAY_NAMES, DAY_ORDER, pagesLabel } from '../models.js';
import { esc, uid, now, todayKey } from '../config.js';
import { toast, modal, closeModal } from '../ui.js';
import { icon } from '../icons.js';
import { subjBadge, lessonHead } from '../components.js';

// ---- Progress ----
export async function pProgress(el){
  const db=getDB(); const st=computeStats(db); const lv=levelFor(db.progress.xp||0);
  el.innerHTML=`<h2><span class="h-ic">${icon('chart', 20)}</span> التقدم</h2>
  <div class="card"><div class="row spread"><b>المستوى ${lv.level}</b><span class="chip">${lv.current}/${lv.need} XP</span></div>
  <div class="progress" style="margin-top:8px"><i style="width:${Math.round(lv.current/lv.need*100)}%"></i></div>
  <p class="muted small">نقاط الخبرة من: إكمال درس +50 · إنجاز تذكير امتحان +30 · كل دقيقة دراسة +2</p></div>
  <div class="card"><b>🎓 إنهاء المواد ${st.subjectsDone}/${st.subjectsTotal} (${st.subjectsPct}%)</b><div class="progress" style="margin:8px 0"><i style="width:${st.subjectsPct}%"></i></div>
  <p class="muted small">المادة تُحسب منجزة عند إكمال كل دروسها.</p></div>
  <div class="card"><b>الإنجاز العام ${st.pct}%</b><div class="progress" style="margin:8px 0"><i style="width:${st.pct}%"></i></div>
  ${Object.entries(st.perSubject).map(([sid,p])=>{const s=db.subjects.find(x=>x.id===sid);return `<div class="bar-row"><span>${esc(s?.icon||'📘')} ${esc(s?.name||sid)}</span><div class="progress"><i style="width:${p.pct}%"></i></div><b>${p.pct}%</b></div>`}).join('')}</div>
  <div class="card"><b>🏅 الإنجازات (${db.achievements.length})</b>${db.achievements.map(a=>`<div class="list-item"><span>🏅</span><div><b>${esc(a.title)}</b><div class="muted small">${esc(a.at?.slice(0,10)||'')}</div></div></div>`).join('')||'<p class="muted">أكمل الدروس والامتحانات لفتح الشارات.</p>'}</div>
  <div class="card"><b>آخر جلسات الدراسة</b>${db.sessions.slice(-6).reverse().map(s=>`<div class="list-item"><span>⏱️</span><div><b>${s.minutes} دقيقة</b><div class="muted small">${esc(s.at?.slice(0,16).replace('T',' '))} · ${esc(s.kind||'')}</div></div></div>`).join('')||'<p class="muted">لا جلسات بعد.</p>'}</div>`;
}

// ---- Timer (Pomodoro) ----
let timerInt=null, timerLeft=25*60, timerMode='25/5';
export async function pTimer(el){
  el.innerHTML=`<h2><span class="h-ic">${icon('clock', 20)}</span> مؤقت الدراسة</h2>
  <div class="card" style="text-align:center"><div class="row" style="justify-content:center">
  ${['25/5','50/10','15/3'].map(m=>`<button class="btn sm ${timerMode===m?'':'ghost'}" data-m="${m}">${m}</button>`).join('')}
  <input id="custom" type="number" value="25" style="width:80px" title="دقائق مخصصة"></div>
  <div class="timer-big" id="tbig">25:00</div>
  <div class="row" style="justify-content:center"><button class="btn ok" id="start"><span class="ic">${icon('play', 16)}</span> ابدأ</button><button class="btn ghost" id="stop"><span class="ic">${icon('stop', 15)}</span> إنهاء وحفظ</button><button class="btn ghost" id="reset"><span class="ic">${icon('refresh', 15)}</span> تصفير</button></div>
  <p class="muted small">عند الإنهاء: تُسجَّل الدقائق + XP وتُحدَّث الإحصاءات.</p></div>`;
  const paint=()=>{const m=String(Math.floor(timerLeft/60)).padStart(2,'0'),s=String(timerLeft%60).padStart(2,'0');const b=el.querySelector('#tbig');if(b)b.textContent=`${m}:${s}`;};
  el.querySelectorAll('[data-m]').forEach(b=>b.onclick=()=>{timerMode=b.dataset.m;timerLeft=+timerMode.split('/')[0]*60;paint();pTimer(el);});
  el.querySelector('#custom').onchange=e=>{timerLeft=(+e.target.value||25)*60;paint();};
  paint();
  el.querySelector('#start').onclick=()=>{
    clearInterval(timerInt);
    timerInt=setInterval(()=>{timerLeft--;paint();if(timerLeft<=0){clearInterval(timerInt);finish();toast('انتهت الجلسة 🎉');}},1000);
    toast('بدأت الجلسة — ركّز! 🍅');
  };
  el.querySelector('#reset').onclick=()=>{clearInterval(timerInt);timerLeft=+timerMode.split('/')[0]*60;paint();};
  el.querySelector('#stop').onclick=()=>{clearInterval(timerInt);finish();};
  function finish(){
    const mins=Math.max(1,Math.round(((+timerMode.split('/')[0]*60)-timerLeft)/60)||+timerMode.split('/')[0]);
    const db=getDB(); db.sessions.push({id:uid('ses'),minutes:mins,at:now(),kind:'جلسة '+timerMode});
    db.progress.studyMinutes=(db.progress.studyMinutes||0)+mins;
    db.progress.xp=(db.progress.xp||0)+mins*2; touchActivity(db); saveLocal();
    timerLeft=+timerMode.split('/')[0]*60; paint(); toast(`سُجّلت ${mins} دقيقة +${mins*2} XP ✅`);
  }
}

// ---- Calendar ----
export async function pCalendar(el){
  const db=getDB();
  if(db.settings.lessonsPerDay===undefined) db.settings.lessonsPerDay=3;
  const pace=db.settings.lessonsPerDay;
  const today=new Date(); const y=today.getFullYear(), m=today.getMonth();
  const tkey=todayKey(today);
  // أحداث تلقائية: تذكيرات الامتحانات + تذكيرات الدروس (بدون إضافة يدوية)
  const autoExams=(db.exams||[]).filter(e=>e.date).map(e=>({date:e.date,title:e.title,kind:'امتحان',auto:'exam',refId:e.id,done:e.done}));
  const autoLessons=[];
  const autoCreated=[];
  (db.subjects||[]).forEach(s=>{ const cur=db.curriculum[s.id];
    (cur?.chapters||[]).forEach(c=>(c.topics||[]).forEach(t=>(t.lessons||[]).forEach(l=>{
      if(l.remindAt&&!l.completed) autoLessons.push({date:l.remindAt,title:l.title,kind:'درس',auto:'lesson',refId:`${s.id}/${c.id}/${t.id}/${l.id}`,done:false});
      if(l.createdAt) autoCreated.push({date:l.createdAt.slice(0,10),title:l.title,kind:'درس',auto:'created',refId:`${s.id}/${c.id}/${t.id}/${l.id}`,done:!!l.completed});
    })));
  });
  const evsOn=(key)=>[...(db.events||[]).filter(e=>e.date===key).map(e=>({...e,auto:null})),...autoExams.filter(e=>e.date===key),...autoLessons.filter(e=>e.date===key),...autoCreated.filter(e=>e.date===key)];
  const first=new Date(y,m,1); const days=new Date(y,m+1,0).getDate();
  let cells=''; for(let i=0;i<first.getDay();i++) cells+='<div></div>';
  for(let d=1;d<=days;d++){
    const key=`${y}-${String(m+1).padStart(2,'0')}-${String(d).padStart(2,'0')}`;
    const evs=evsOn(key);
    const isT=key===tkey;
    const dot = e => e.auto === 'exam' ? 'var(--warn)' : e.auto === 'lesson' ? 'var(--primary)' : e.auto === 'created' ? 'var(--secondary)' : 'var(--muted)';
    cells += `<div class="cal-day ${isT ? 'today' : ''} ${evs.length ? 'has' : ''}" data-day="${key}"><b>${d}</b>${evs.length ? `<span class="cal-dots">${evs.slice(0, 8).map(e => `<i style="background:${dot(e)}"></i>`).join('')}</span>${evs.length > 8 ? `<div class="muted small">+${evs.length - 8}</div>` : ''}` : ''}</div>`;
  }
  // دروس مقترحة اليوم تلقائيًا (أول الدروس غير المكتملة)
  const suggested=nextLessons(db,pace);
  const upcoming=db.exams.filter(e=>!e.done&&e.date&&e.date>=tkey).sort((a,b)=>a.date.localeCompare(b.date)).slice(0,4);
  el.innerHTML=`<span class="eyebrow">الجدول · تلقائي</span><div class="row spread"><h2 style="margin-top:0"><span class="h-ic">${icon('calendar', 20)}</span> الجدول</h2><button class="btn sm" id="add"><span class="ic">${icon('plus', 15)}</span> موعد يدوي</button></div>
  <div class="os-panel"><div class="row spread"><span class="eyebrow">جدولي المدرسي الأسبوعي</span><a class="os-go" href="#/timetable">إدارة ←</a></div>
  <div class="row" style="gap:6px">${DAY_ORDER.map(d=>{const n=(db.timetable[d]||[]).length;return `<a class="chip" href="#/timetable" style="text-decoration:none${d===today.getDay()?';border-color:var(--primary)':''}">${DAY_NAMES[d]} · ${n}</a>`;}).join('')}</div></div>
  <div class="card"><div class="cal-grid">${['ح','ن','ث','ر','خ','ج','س'].map(d=>`<b class="muted" style="text-align:center">${d}</b>`).join('')}${cells}</div>
  <p class="muted small"><b style="color:var(--warn)">●</b> امتحان · <b style="color:var(--primary)">●</b> تذكير درس · <b style="color:var(--secondary)">●</b> درس مسجل · <b style="color:var(--muted)">●</b> يدوي — اضغط اليوم لعرض التفاصيل.</p></div>
  <div class="os-panel"><div class="row spread"><span class="eyebrow">خطة اليوم · تلقائي</span><span class="row">دروس/يوم: <input id="pace" type="number" min="1" max="20" value="${pace}" style="width:64px"></span></div>
  ${suggested.map(n=>`<a class="list-item" href="#/lesson/${n.s.id}/${n.c.id}/${n.t.id}/${n.l.id}"><span>📖</span><div>${lessonHead(db, n.s.id, n.l)}<div class="muted small">${esc(n.c.title)} · <span class="tname">${esc(n.t.title)}</span> · ${n.l.duration||30} د</div></div></a>`).join('')||'<p class="muted small">لا دروس متبقية 🎉</p>'}
  ${upcoming.map(e=>{const dl=daysLabel(e.date);return `<a class="list-item" href="#/exam/${e.id}"><span>◉</span><div><b>${esc(e.title)} · ${esc(dl.txt)}</b><div class="muted small">${esc(examScopeLabel(db,e))} · ${esc(e.date)}</div></div></a>`;}).join('')}</div>
  <h3>مواعيد يدوية</h3>${(db.events||[]).slice().sort((a,b)=>a.date.localeCompare(b.date)).map(e=>`<div class="list-item"><span>📌</span><div style="flex:1"><b>${esc(e.title)}</b><div class="muted small">${esc(e.date)}${e.time ? ' · ' + esc(e.time) : ''} · ${esc(e.kind || '')} ${esc(e.notes || '')}</div></div><button class="btn sm ghost" data-del="${e.id}">✕</button></div>`).join('')||'<div class="card muted">لا مواعيد يدوية.</div>'}`;
  el.querySelector('#pace').onchange=e=>{ db.settings.lessonsPerDay=Math.max(1,+e.target.value||3); saveLocal(); pCalendar(el); };
  el.querySelector('#add').onclick=()=>{
    modal(`<h3><span class="h-ic">${icon('plus', 18)}</span> موعد جديد</h3>
    <label>العنوان</label><input id="mTitle" placeholder="مثال: مراجعة الفيزياء">
    <div class="fld-row"><div class="fld"><span>التاريخ</span><input id="mDate" type="date" value="${tkey}"></div>
    <div class="fld"><span>الوقت (اختياري)</span><input id="mTime" type="time"></div></div>
    <label>ملاحظات (اختياري)</label><input id="mNotes" placeholder="">
    <div class="row" style="margin-top:12px"><button class="btn" id="mOk"><span class="ic">${icon('check', 16)}</span> حفظ</button><button class="btn ghost" id="mCancel">إلغاء</button></div>`);
    const root=document.getElementById('modalRoot');
    root.querySelector('#mCancel').onclick=()=>closeModal();
    root.querySelector('#mOk').onclick=()=>{
      const title=root.querySelector('#mTitle').value.trim();
      const date=root.querySelector('#mDate').value;
      if(!title) return toast('أدخل عنوان الموعد');
      if(!date) return toast('اختر التاريخ من المنتقي 📅');
      db.events.push({id:uid('ev'),title,kind:'دراسة',date,time:root.querySelector('#mTime').value||'',refId:null,notes:root.querySelector('#mNotes').value.trim()});
      saveLocal(); closeModal(); pCalendar(el); toast('أُضيف الموعد 📌');
    };
  };
  el.querySelectorAll('[data-del]').forEach(b=>b.onclick=()=>{db.events=db.events.filter(e=>e.id!==b.dataset.del);saveLocal();pCalendar(el);});
  el.querySelectorAll('[data-day]').forEach(d=>d.onclick=()=>{
    const key=d.dataset.day;
    const evs=evsOn(key);
    if(!evs.length) return toast('لا شيء في '+key);
    modal(`<h3>📅 ${key}</h3>`
    + evs.map(e=>{ const isLsn=e.auto==='lesson'||e.auto==='created';
      let pg='';
      if(isLsn){ const [sid,cid,tid,lid]=String(e.refId||'').split('/'); const l=db.curriculum[sid]?.chapters.find(c=>c.id===cid)?.topics.find(t=>t.id===tid)?.lessons.find(x=>x.id===lid); pg=pagesLabel(l?.pageFrom,l?.pageTo); }
      return `<a class="list-item" href="${e.auto==='exam'?'#/exam/'+e.refId:isLsn?'#/lesson/'+e.refId:'#/calendar'}"><span>${e.auto==='exam'?'◉':e.auto==='lesson'?'🔔':e.auto==='created'?'📝':'📌'}</span><div><b>${esc(e.title)}</b>${isLsn?`<div style="margin:4px 0">${subjBadge(db, String(e.refId||'').split('/')[0])}${pg?` <span class="chip">${pg}</span>`:''}</div>`:''}<div class="muted small">${e.auto === 'exam' ? 'تذكير امتحان' + (e.done ? ' ✅' : '') : e.auto === 'lesson' ? 'تذكير درس' : e.auto === 'created' ? 'درس سُجل بهذا اليوم' + (e.done ? ' ✅' : '') : 'موعد' + (e.time ? ' · ' + esc(e.time) : '')}</div></div></a>`; }).join(''));
  });
}
