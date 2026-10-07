import { getDB, saveLocal } from '../store.js';
import { esc, uid, now } from '../config.js';
import { toast, modal, closeModal } from '../ui.js';
import { touchActivity, pagesLabel, lectureLabel, DAY_NAMES, DAY_ORDER } from '../models.js';
import { subjColor, lessonHead } from '../components.js';
import { icon } from '../icons.js';

function subjectProgress(db, sid) {
  const cur = db.curriculum[sid] || { chapters: [] };
  let total = 0, done = 0, current = null, curChapter = null;
  for (const c of (cur.chapters || [])) {
    let cTotal = 0, cDone = 0;
    for (const t of (c.topics || [])) for (const l of (t.lessons || [])) {
      total++; cTotal++;
      if (l.completed) { done++; cDone++; }
      else if (!current) { current = { c, t, l }; }
    }
    if (!curChapter && cTotal > cDone) curChapter = c;
  }
  return { total, done, pct: total ? Math.round(done / total * 100) : 0, current, curChapter: curChapter || cur.chapters[0] || null };
}

export async function pSubjects(el){
  const db=getDB();
  el.innerHTML=`<span class="eyebrow">المواد · ${db.subjects.length}</span><div class="row spread"><h2 style="margin-top:0"><span class="h-ic">${icon('layers', 20)}</span> المواد</h2><button class="btn" id="addSub"><span class="ic">${icon('plus', 16)}</span> مادة</button></div>
  <div class="grid cols2">${db.subjects.map((s,i)=>{
    const col=subjColor(s,i), p=subjectProgress(db,s.id);
    const num=String(i+1).padStart(2,'0');
    const go=p.current?`#/lesson/${s.id}/${p.current.c.id}/${p.current.t.id}/${p.current.l.id}`:`#/subject/${s.id}`;
    const goLabel=p.current?'متابعة الدرس ←':(p.total?'مراجعة المادة ←':'فتح المادة ←');
    const days=DAY_ORDER.filter(d=>(db.timetable[d]||[]).some(e=>e.subjectId===s.id));
    return `<div class="os-sub" style="--ac:${col}">
      <div class="row spread"><span class="os-num">${num}</span><span class="dot" style="background:${col};color:${col}"></span></div>
      <div class="os-name">${esc(s.icon||'')} ${esc(s.name)}</div>
      ${days.length?`<div class="row" style="gap:4px;margin-bottom:6px">${days.map(d=>`<span class="chip" style="font-size:11px${d===new Date().getDay()?';border-color:var(--ok);color:var(--ok)':''}">🏫 ${DAY_NAMES[d]}</span>`).join('')}</div>`:''}
      <div class="os-bar"><i style="width:${p.pct}%"></i></div>
      <div class="row spread"><span class="muted small">${p.curChapter?esc(p.curChapter.title):'لا فصول'} · ${p.done}/${p.total}</span><span class="chip">${p.pct}%</span></div>
      <div class="row spread"><span class="row"><a class="btn sm" href="${go}">${goLabel}</a>${p.current?`<a class="btn sm ghost" href="#/subject/${s.id}">فتح المادة</a>`:''}</span><button class="btn sm ghost" data-del="${s.id}"><span class="ic">${icon('trash', 15)}</span> حذف</button></div>
    </div>`;}).join('')||'<div class="card muted">لا مواد بعد.</div>'}</div>`;
  el.querySelector('#addSub').onclick=()=>{
    modal(`<h3>مادة جديدة</h3><label>الاسم</label><input id="sn" placeholder="مثال: الفيزياء"><label>الأيقونة</label><input id="si" value="📘"><div class="row" style="margin-top:12px"><button class="btn" id="ok">حفظ</button><button class="btn ghost" onclick="document.getElementById('modalRoot').innerHTML=''">إلغاء</button></div>`);
    document.getElementById('ok').onclick=()=>{
      const name=document.getElementById('sn').value.trim(); if(!name) return toast('أدخل الاسم');
      const id=uid('sub'); db.subjects.push({id,name,icon:document.getElementById('si').value||'📘',color:subjColor({},db.subjects.length),desc:'',createdAt:now()});
      db.curriculum[id]={chapters:[]}; closeModal(); saveLocal(); pSubjects(el); toast('تمت الإضافة ✅');
    };
  };
  el.querySelectorAll('[data-del]').forEach(b=>b.onclick=()=>{
    if(!confirm('حذف المادة وكل محتواها؟')) return;
    const id=b.dataset.del;
    db.subjects=db.subjects.filter(s=>s.id!==id); delete db.curriculum[id];
    db.exams=db.exams.filter(e=>e.subjectId!==id); saveLocal(); pSubjects(el);
  });
}

let editCh = null, editTp = null;

export async function pSubject(el,id){
  const db=getDB(); const s=db.subjects.find(x=>x.id===id);
  if(!s){ el.innerHTML='<div class="card">المادة غير موجودة</div>'; return; }
  const cur=db.curriculum[id]||{chapters:[]};
  el.innerHTML=`<a href="#/subjects">← المواد</a><h2>${esc(s.icon)} ${esc(s.name)}</h2>
  <div class="row"><button class="btn sm" id="addCh"><span class="ic">${icon('plus', 15)}</span> فصل</button><a class="btn sm ghost" href="#/exams">الامتحانات</a></div>
  ${cur.chapters.map(c=>`<div class="card">
    ${editCh===c.id ? `
    <label>اسم الفصل</label><input id="echT" value="${esc(c.title)}">
    <div class="fld-row"><div class="fld"><span>📄 من صفحة</span><input id="echF" type="number" value="${c.pageFrom||''}"></div>
    <div class="fld"><span>📄 إلى صفحة</span><input id="echTo" type="number" value="${c.pageTo||''}"></div></div>
    <div class="row" style="margin-top:8px"><button class="btn sm" data-sch="${c.id}"><span class="ic">${icon('check', 15)}</span> حفظ</button><button class="btn sm ghost" data-cch="${c.id}">إلغاء</button></div>`
    : `<div class="row spread"><b style="font-size:16px">${esc(c.title)}</b><span class="row"><span class="chip">${(c.topics||[]).reduce((a,t)=>a+(t.lessons||[]).length,0)} درسًا</span><button class="btn sm ghost" data-ech="${c.id}" title="تحرير الفصل"><span class="ic">${icon('pencil', 15)}</span></button></span></div>
    ${pagesLabel(c.pageFrom,c.pageTo)?`<div><span class="chip">${pagesLabel(c.pageFrom,c.pageTo)}</span></div>`:''}`}
    ${(c.topics||[]).map(tp=> editTp===tp.id ? `
    <div class="card" style="background:var(--card2)"><label>اسم الموضوع</label><input id="etpT" value="${esc(tp.title)}">
    <div class="fld-row"><div class="fld"><span>📄 من صفحة</span><input id="etpF" type="number" value="${tp.pageFrom||''}"></div>
    <div class="fld"><span>📄 إلى صفحة</span><input id="etpTo" type="number" value="${tp.pageTo||''}"></div></div>
    <div class="row" style="margin-top:8px"><button class="btn sm" data-stp="${tp.id}"><span class="ic">${icon('check', 15)}</span> حفظ</button><button class="btn sm ghost" data-ctp="${tp.id}">إلغاء</button></div></div>`
    : `<div class="list-item"><span>📁</span><div style="flex:1"><b>${esc(tp.title)}</b><div class="muted small">${(tp.lessons||[]).filter(l=>l.completed).length}/${(tp.lessons||[]).length} مكتمل${pagesLabel(tp.pageFrom,tp.pageTo)?' · '+pagesLabel(tp.pageFrom,tp.pageTo):''}</div></div>
    <button class="btn sm ghost" data-etp="${tp.id}" title="تحرير الموضوع"><span class="ic">${icon('pencil', 15)}</span></button>
    <a class="btn sm ghost" href="#/topic/${s.id}/${c.id}/${tp.id}">فتح</a></div>`).join('')}
    <div class="row"><button class="btn sm ghost" data-addtp="${c.id}"><span class="ic">${icon('plus', 15)}</span> موضوع</button><button class="btn sm ghost" data-delch="${c.id}"><span class="ic">${icon('trash', 15)}</span> حذف الفصل</button></div>
    ${(()=>{ const all=[]; (c.topics||[]).forEach(t=>(t.lessons||[]).forEach(l=>all.push({t,l}))); const dn=all.filter(x=>x.l.completed);
      return `<details class="done-box"><summary>✅ الدروس التي أخذتها في هذا الفصل (${dn.length}/${all.length})</summary>`
      + (dn.length?dn.map(x=>`<a class="list-item" href="#/lesson/${s.id}/${c.id}/${x.t.id}/${x.l.id}"><span>✅</span><div>${lessonHead(db, s.id, x.l)}<div class="muted small">${esc(x.t.title)}${pagesLabel(x.l.pageFrom,x.l.pageTo)?' · '+pagesLabel(x.l.pageFrom,x.l.pageTo):''}</div></div></a>`).join(''):'<p class="muted small">لم تُنجز دروسًا هنا بعد.</p>') + `</details>`; })()}</div>`).join('')||'<div class="card muted">لا فصول بعد.</div>'}`;
  el.querySelector('#addCh').onclick=()=>{ cur.chapters.push({id:uid('ch'),title:`فصل ${cur.chapters.length+1}`,pageFrom:null,pageTo:null,topics:[]}); saveLocal(); pSubject(el,id); };
  el.querySelectorAll('[data-ech]').forEach(b=>b.onclick=()=>{ editCh=b.dataset.ech; editTp=null; pSubject(el,id); });
  el.querySelectorAll('[data-cch]').forEach(b=>b.onclick=()=>{ editCh=null; pSubject(el,id); });
  el.querySelectorAll('[data-sch]').forEach(b=>b.onclick=()=>{
    const c=cur.chapters.find(x=>x.id===b.dataset.sch); if(!c) return;
    const t=el.querySelector('#echT').value.trim(); if(t) c.title=t;
    c.pageFrom=+el.querySelector('#echF').value||null; c.pageTo=+el.querySelector('#echTo').value||c.pageFrom;
    editCh=null; saveLocal(); toast('حُفظ الفصل ✅'); pSubject(el,id);
  });
  el.querySelectorAll('[data-addtp]').forEach(b=>b.onclick=()=>{ const c=cur.chapters.find(x=>x.id===b.dataset.addtp); c.topics.push({id:uid('tp'),title:'موضوع جديد',pageFrom:null,pageTo:null,lessons:[]}); saveLocal(); pSubject(el,id); });
  el.querySelectorAll('[data-etp]').forEach(b=>b.onclick=()=>{ editTp=b.dataset.etp; editCh=null; pSubject(el,id); });
  el.querySelectorAll('[data-ctp]').forEach(b=>b.onclick=()=>{ editTp=null; pSubject(el,id); });
  el.querySelectorAll('[data-stp]').forEach(b=>b.onclick=()=>{
    const tp=findTopic(cur,b.dataset.stp); if(!tp) return;
    const t=el.querySelector('#etpT').value.trim(); if(t) tp.title=t;
    tp.pageFrom=+el.querySelector('#etpF').value||null; tp.pageTo=+el.querySelector('#etpTo').value||tp.pageFrom;
    editTp=null; saveLocal(); toast('حُفظ الموضوع ✅'); pSubject(el,id);
  });
  el.querySelectorAll('[data-delch]').forEach(b=>b.onclick=()=>{ if(!confirm('حذف الفصل؟'))return; cur.chapters=cur.chapters.filter(x=>x.id!==b.dataset.delch); saveLocal(); pSubject(el,id); });
}

function findTopic(cur, tid){
  for(const c of (cur?.chapters||[])) for(const t of (c.topics||[])) if(t.id===tid) return t;
  return null;
}

export async function pTopic(el,sid,cid,tid){
  const db=getDB(); const tp=db.curriculum[sid]?.chapters.find(c=>c.id===cid)?.topics.find(t=>t.id===tid);
  if(!tp){ el.innerHTML='<div class="card">غير موجود</div>'; return; }
  const lessons=tp.lessons||[], done=lessons.filter(l=>l.completed).length;
  el.innerHTML=`<a href="#/subject/${sid}">← رجوع للمادة</a><h2>📁 ${esc(tp.title)}</h2>
  ${pagesLabel(tp.pageFrom,tp.pageTo)?`<div><span class="chip">${pagesLabel(tp.pageFrom,tp.pageTo)}</span></div>`:''}
  <div class="os-panel"><div class="row spread"><span class="muted small">${done}/${lessons.length} درس منجز</span><a class="btn sm" href="#/lessons/${sid}/${cid}/${tid}">➕ إدارة الدروس</a></div>
  <div class="progress" style="margin-top:8px"><i style="width:${lessons.length?Math.round(done/lessons.length*100):0}%"></i></div></div>
  ${lessons.map(l=>`<a class="list-item" href="#/lesson/${sid}/${cid}/${tid}/${l.id}"><span>${l.completed?'✅':'⭕'}</span><div>${lessonHead(db, sid, l)}<div class="muted small">${l.duration||30} د${pagesLabel(l.pageFrom,l.pageTo)?' · '+pagesLabel(l.pageFrom,l.pageTo):''}${l.remindAt?' · 🔔 '+esc(l.remindAt):''}</div></div></a>`).join('')||'<div class="card muted">لا دروس في هذا الموضوع بعد — أضفها من تبويب الدروس.</div>'}`;
}

export async function pLesson(el,sid,cid,tid,lid){
  const db=getDB();
  const tp=db.curriculum[sid]?.chapters.find(c=>c.id===cid)?.topics.find(t=>t.id===tid);
  const l=tp?.lessons.find(x=>x.id===lid);
  if(!l){ el.innerHTML='<div class="card">الدرس غير موجود</div>'; return; }
  const sname=db.subjects.find(x=>x.id===sid)?.name||'';
  el.innerHTML=`<a href="#/topic/${sid}/${cid}/${tid}">← رجوع</a>
  <div class="card"><div class="row spread"><div>${lessonHead(db, sid, l)}</div><span>${l.completed?'✅':''} ${l.favorite?'⭐':''}</span></div>
  <div class="fld-row"><div class="fld"><span>المادة</span><select id="ls"></select></div><div class="fld"><span>الفصل</span><select id="lc"></select></div><div class="fld"><span>الموضوع</span><select id="lt"></select></div></div>
  <p class="muted small">تغيير الموقع ينقل الدرس فور الحفظ.</p>
  ${pagesLabel(l.pageFrom,l.pageTo)||lectureLabel(l)?`<div class="row">${pagesLabel(l.pageFrom,l.pageTo)?`<span class="chip">${pagesLabel(l.pageFrom,l.pageTo)}</span>`:''}${lectureLabel(l)?`<span class="chip">${lectureLabel(l)}</span>`:''}</div>`:''}
  <div class="fld-row"><div class="fld"><span>رقم المحاضرة (اختياري — امسحه للإزالة)</span><input id="llec" type="number" placeholder="تلقائي" value="${l.lectureNo ?? ''}"></div>
  <div class="fld"><span>تاريخ الإضافة (تلقائي)</span><input value="${esc((l.createdAt || '').slice(0, 10))}" disabled></div></div>
  <label>المدة (دقيقة)</label><input id="dur" type="number" value="${l.duration||30}">
  <label>ملاحظاتي (اختياري)</label><textarea id="notes" rows="3">${esc(l.notes||'')}</textarea>
  <label>🔔 تذكير بهذا الدرس بتاريخ <span class="hint">(يظهر في التنبيهات والجدول)</span></label>
  <div class="fld-row"><div class="fld"><span>تاريخ التذكير</span><input id="remind" type="date" value="${esc(l.remindAt||'')}"></div>${l.remindAt?`<div class="fld"><span>إدارة</span><button class="btn sm ghost" id="norem">إلغاء التذكير</button></div>`:''}</div>
  <label>📄 صفحات الكتاب لهذا الدرس <span class="hint">(اختياري — للصفحة الواحدة ضع نفس الرقم)</span></label>
  <div class="fld-row"><div class="fld"><span>من صفحة</span><input id="pfrom" type="number" placeholder="مثال: 5" value="${l.pageFrom||''}"></div><div class="fld"><span>إلى صفحة</span><input id="pto" type="number" placeholder="مثال: 9" value="${l.pageTo||''}"></div></div>
  <div class="row" style="margin-top:12px">
    <button class="btn ok" id="done"><span class="ic">${icon('check', 16)}</span> ${l.completed ? 'إلغاء الإكمال' : 'إكمال الدرس (+50 XP)'}</button>
    <button class="btn ghost" id="fav"><span class="ic">${icon('star', 16)}</span> ${l.favorite ? 'إزالة من المفضلة' : 'مفضلة'}</button>
    <button class="btn ghost" id="save"><span class="ic">${icon('check', 16)}</span> حفظ</button>
  </div></div>`;
  const chOf = s2 => db.curriculum[s2]?.chapters || [];
  const tpOf = (s2, c2) => chOf(s2).find(c => c.id === c2)?.topics || [];
  const fLS = () => { el.querySelector('#ls').innerHTML = db.subjects.map(s => `<option value="${s.id}" ${s.id === sid ? 'selected' : ''}>${esc(s.name)}</option>`).join(''); };
  const fLC = s2 => { el.querySelector('#lc').innerHTML = chOf(s2).map(c => `<option value="${c.id}">${esc(c.title)}</option>`).join(''); };
  const fLT = (s2, c2) => { el.querySelector('#lt').innerHTML = tpOf(s2, c2).map(t => `<option value="${t.id}">${esc(t.title)}</option>`).join(''); };
  fLS(); fLC(sid); el.querySelector('#lc').value = cid; fLT(sid, cid); el.querySelector('#lt').value = tid;
  el.querySelector('#ls').onchange = e => { fLC(e.target.value); fLT(e.target.value, el.querySelector('#lc').value); };
  el.querySelector('#lc').onchange = e => fLT(el.querySelector('#ls').value, e.target.value);
  const save=()=>{ l.lectureNo=el.querySelector('#llec').value==='' ? null : +el.querySelector('#llec').value; l.duration=+el.querySelector('#dur').value||30; l.notes=el.querySelector('#notes').value; l.remindAt=el.querySelector('#remind').value||null; l.pageFrom=+el.querySelector('#pfrom').value||null; l.pageTo=+el.querySelector('#pto').value||l.pageFrom;
    const nsid=el.querySelector('#ls').value, ncid=el.querySelector('#lc').value, ntid=el.querySelector('#lt').value;
    if(nsid&&ncid&&ntid&&(nsid!==sid||ncid!==cid||ntid!==tid)){
      const dst=db.curriculum[nsid]?.chapters.find(c=>c.id===ncid)?.topics.find(t=>t.id===ntid);
      if(!dst) return toast('الموقع الجديد غير موجود');
      const ix=(tp.lessons||[]).findIndex(x=>x.id===l.id); if(ix>=0) tp.lessons.splice(ix,1);
      dst.lessons.push(l); saveLocal(); location.hash=`#/lesson/${nsid}/${ncid}/${ntid}/${l.id}`; toast('نُقل الدرس ✅'); return;
    }
    saveLocal(); toast('تم الحفظ 💾'); };
  el.querySelector('#save').onclick=save;
  el.querySelector('#norem') && (el.querySelector('#norem').onclick=()=>{ l.remindAt=null; saveLocal(); pLesson(el,sid,cid,tid,lid); });
  el.querySelector('#fav').onclick=()=>{ l.favorite=!l.favorite; saveLocal(); pLesson(el,sid,cid,tid,lid); };
  el.querySelector('#done').onclick=()=>{
    l.completed=!l.completed;
    if(l.completed){ l.lastStudied=new Date().toISOString(); db.progress.xp=(db.progress.xp||0)+50; db.progress.studyMinutes=(db.progress.studyMinutes||0)+(l.duration||30); touchActivity(db); toast('أحسنت! +50 XP 🎉'); }
    else { db.progress.xp=Math.max(0,(db.progress.xp||0)-50); toast('أُلغي الإكمال — 50 XP ⏸️'); }
    saveLocal(); pLesson(el,sid,cid,tid,lid);
  };
}
