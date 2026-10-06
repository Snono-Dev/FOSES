import { CONFIG, now, todayKey } from './config.js';

// يقبل: {pageFrom,pageTo} أو page مفردة أو نص "10-20"
export function parsePages(v) {
  if (v == null || v === '') return { pageFrom: null, pageTo: null };
  if (typeof v === 'number') return { pageFrom: v, pageTo: v };
  if (typeof v === 'object') return { pageFrom: +v.pageFrom || +v.from || +v.page || null, pageTo: +v.pageTo || +v.to || +v.page || +v.pageFrom || +v.from || null };
  const m = String(v).match(/(\d+)\s*[–\-]\s*(\d+)/);
  if (m) return { pageFrom: +m[1], pageTo: +m[2] };
  const n = parseInt(v, 10);
  return isNaN(n) ? { pageFrom: null, pageTo: null } : { pageFrom: n, pageTo: n };
}
export function pagesLabel(pf, pt) {
  if (!pf && !pt) return '';
  if (pf && pt && pf !== pt) return `📄 ص ${pf}–${pt}`;
  return `📄 ص ${pf || pt}`;
}
export function lectureLabel(l) {
  return (l && l.lectureNo != null && l.lectureNo !== '') ? `المحاضرة ${l.lectureNo}` : '';
}

// ---------- الجدول المدرسي الأسبوعي ----------
// timetable: {dayNum(0=الأحد..6=السبت) -> [{subjectId,time}]}
export const DAY_NAMES = ['الأحد', 'الاثنين', 'الثلاثاء', 'الأربعاء', 'الخميس', 'الجمعة', 'السبت'];
export const DAY_ORDER = [6, 0, 1, 2, 3, 4, 5]; // العرض بدءًا من السبت
const DAY_ALIASES = { '0': 0, '1': 1, '2': 2, '3': 3, '4': 4, '5': 5, '6': 6, sunday: 0, monday: 1, tuesday: 2, wednesday: 3, thursday: 4, friday: 5, saturday: 6, 'الأحد': 0, 'الاحد': 0, 'الاثنين': 1, 'الاثنين': 1, 'الثلاثاء': 2, 'الاربعاء': 3, 'الأربعاء': 3, 'الخميس': 4, 'الجمعة': 5, 'الجمعه': 5, 'السبت': 6 };
export function ensureTimetable(db) {
  if (!db.timetable || typeof db.timetable !== 'object') db.timetable = {};
  Object.keys(db.timetable).forEach(k => { if (!Array.isArray(db.timetable[k])) db.timetable[k] = []; });
}
export function todaySubjects(db) {
  ensureTimetable(db);
  const day = new Date().getDay();
  return (db.timetable[day] || []).map(e => ({ ...e, subject: (db.subjects || []).find(s => s.id === e.subjectId) })).filter(x => x.subject);
}
// timetable في الاستيراد: {"السبت":["فيزياء",...]} أو أرقام/إنجليزية، والقيم id أو اسم
export function normalizeTimetable(db, raw) {
  if (!raw || typeof raw !== 'object') return;
  ensureTimetable(db);
  const byId = {}, byName = {};
  (db.subjects || []).forEach(s => { byId[s.id] = s.id; byName[s.name] = s.id; });
  Object.entries(raw).forEach(([day, arr]) => {
    const d = DAY_ALIASES[String(day).trim().toLowerCase()];
    if (d === undefined || !Array.isArray(arr)) return;
    db.timetable[d] = arr.map(v => {
      if (typeof v === 'string') return byId[v] || byName[v] ? { subjectId: byId[v] || byName[v], time: '' } : null;
      if (v && typeof v === 'object') { const sid = byId[v.subjectId || v.id] || byName[v.name] || null; return sid ? { subjectId: sid, time: v.time || '' } : null; }
      return null;
    }).filter(Boolean);
  });
}

export const DB_DEFAULTS = () => ({
  subjects: [],      // {id,name,nameEn,desc,color,icon,createdAt}
  curriculum: {},    // subjectId -> {chapters:[{id,title,topics:[{id,title,lessons:[{id,title,desc,content,duration,completed,favorite,notes,lastStudied}]}]}]}
  exams: [],         // {id,title,subjectId,chapterId,duration,passingScore,questions:[{id,type:'mcq'|'tf'|'text',q,options,answer,points}]}
  results: [],       // {id,examId,score,total,percent,passed,at,answers}
  sessions: [],      // {id,minutes,at,subjectId,kind}
  events: [],        // {id,title,kind,date,refId,notes}
  timetable: {},      // dayNum(0-6, JS getDay) -> [{subjectId,time}]
  progress: { streak:0, lastActiveDay:null, studyMinutes:0, xp:0 },
  settings: { theme:'dark', lang:'ar', repoName: CONFIG.dataRepoName, branch:'main' },
  achievements: [],  // {id,title,at}
});

export function validateCurriculumImport(obj){
  const errors=[];
  if(!obj || typeof obj!=='object'){ errors.push('الملف ليس JSON object صالح'); return {ok:false,errors}; }
  const subjects = obj.subjects || (obj.name ? [obj] : null);
  if(!Array.isArray(subjects)){ errors.push('يجب أن يحتوي على subjects: [...] أو {name, chapters}'); return {ok:false,errors}; }
  subjects.forEach((s,i)=>{
    if(!s.name && !s.title) errors.push(`subject[${i}] بدون name`);
    (s.chapters||[]).forEach((c,ci)=>{
      if(!c.title) errors.push(`chapter[${ci}] في "${s.name||i}" بدون title`);
      (c.topics||[]).forEach((t,ti)=>{
        if(!t.title) errors.push(`topic[${ti}] بدون title`);
        (t.lessons||[]).forEach((l,li)=>{
          if(!l.title) errors.push(`lesson[${li}] بدون title`);
        });
      });
    });
    (s.exams||[]).forEach((e,ei)=>{
      if(!e.title) errors.push(`exam[${ei}] بدون title`);
      if(e.questions && !Array.isArray(e.questions)) errors.push(`exam "${e.title}" questions يجب أن تكون array`);
    });
  });
  return { ok: errors.length===0, errors };
}

export function normalizeImport(obj){
  const out = DB_DEFAULTS();
  const subjects = obj.subjects || [obj];
  subjects.forEach((s,si)=>{
    const sid = s.id || 'sub-'+Date.now().toString(36)+si;
    out.subjects.push({ id:sid, name:s.name||s.title||'مادة', nameEn:s.nameEn||'', desc:s.description||s.desc||'', color:s.color||['#6366f1','#22d3ee','#22c55e','#f59e0b','#ef4444','#a855f7'][si%6], icon:s.icon||'📘', createdAt:now() });
    const chapters=(s.chapters||[]).map((c,ci)=>{
      const cp=parsePages(c.pages ?? c.page ?? {pageFrom:c.pageFrom,pageTo:c.pageTo});
      return { id:c.id||`ch-${si}-${ci}`, title:c.title||`فصل ${ci+1}`, pageFrom:cp.pageFrom, pageTo:cp.pageTo,
      topics:(c.topics||[]).map((t,ti)=>{
        const tpp=parsePages(t.pages ?? t.page ?? {pageFrom:t.pageFrom,pageTo:t.pageTo});
        return { id:t.id||`tp-${si}-${ci}-${ti}`, title:t.title||`موضوع ${ti+1}`, pageFrom:tpp.pageFrom, pageTo:tpp.pageTo,
        lessons:(t.lessons||[]).map((l,li)=>{
          const lp=parsePages(l.pages ?? l.page ?? {pageFrom:l.pageFrom,pageTo:l.pageTo});
          return { id:l.id||`ls-${si}-${ci}-${ti}-${li}`, title:l.title||`درس ${li+1}`,
          desc:l.description||l.desc||'', content:l.content||'', duration:l.duration||30,
          pageFrom:lp.pageFrom, pageTo:lp.pageTo,
          lectureNo:(l.lectureNo ?? l.lecture ?? l.lectureNumber ?? null),
          completed:false, favorite:false, notes:'', lastStudied:null };
        })
      };
      })
    };
    });
    out.curriculum[sid]={ chapters };
    const allT = []; (out.curriculum[sid]?.chapters || []).forEach(c => (c.topics || []).forEach(t => allT.push({ c, t })));
    const tidOf = v => {
      if (!v) return null;
      return allT.find(x => x.t.id === v)?.t.id || allT.find(x => x.t.title === v)?.t.id || null;
    };
    (s.exams || []).forEach((e, ei) => {
      let from = tidOf(e.fromTopic || e.fromTopicId), to = tidOf(e.toTopic || e.toTopicId);
      if (!from && (e.fromChapterId || e.chapterId)) {
        const chs = out.curriculum[sid]?.chapters || [];
        const ca = chs.find(c => c.id === e.fromChapterId || c.title === e.fromChapterId || c.id === e.chapterId);
        const cb = chs.find(c => c.id === (e.toChapterId || e.fromChapterId) || c.title === (e.toChapterId || e.fromChapterId));
        from = ca?.topics?.[0]?.id || null;
        const bl = cb?.topics || []; to = bl[bl.length - 1]?.id || from;
      }
      const ep = parsePages(e.pages ?? e.page ?? { pageFrom: e.pageFrom, pageTo: e.pageTo });
      out.exams.push({
        id: e.id || `ex-${si}-${ei}`, title: e.title || 'امتحان', subjectId: sid,
        fromTopicId: from, toTopicId: to || from,
        pageFrom: ep.pageFrom, pageTo: ep.pageTo,
        scopeText: e.scope || e.scopeText || '', date: e.date || null, notes: e.notes || '',
        done: false, doneAt: null, createdAt: now()
      });
    });
  });
  if (obj.timetable) {
    const byId = {}, byName = {};
    (out.subjects || []).forEach(s => { byId[s.id] = s.id; byName[s.name] = s.id; });
    Object.entries(obj.timetable).forEach(([day, arr]) => {
      const d = DAY_ALIASES[String(day).trim().toLowerCase()];
      if (d === undefined || !Array.isArray(arr)) return;
      out.timetable[d] = arr.map(v => {
        if (typeof v === 'string') return (byId[v] || byName[v]) ? { subjectId: byId[v] || byName[v], time: '' } : null;
        if (v && typeof v === 'object') { const sid = byId[v.subjectId || v.id] || byName[v.name] || null; return sid ? { subjectId: sid, time: v.time || '' } : null; }
        return null;
      }).filter(Boolean);
    });
  }
  return out;
}

export function computeStats(db){
  let total=0, done=0, subjectsDone=0;
  const perSubject={};
  for(const s of db.subjects){
    const cur=db.curriculum[s.id]; let t=0,d=0;
    (cur?.chapters||[]).forEach(c=>(c.topics||[]).forEach(tp=>(tp.lessons||[]).forEach(l=>{t++;total++;if(l.completed){d++;done++;}})));
    perSubject[s.id]={total:t,done:d,pct:t?Math.round(d/t*100):0,finished:t>0&&d===t};
    if(t>0&&d===t) subjectsDone++;
  }
  const st=Object.keys(perSubject).length;
  return { total, done, left:total-done, pct: total?Math.round(done/total*100):0, perSubject,
    subjectsTotal:st, subjectsDone, subjectsPct: st?Math.round(subjectsDone/st*100):0 };
}

export function levelFor(xp){
  let level=1, need=CONFIG.levelBase;
  while(xp>=need){ xp-=need; level++; need=CONFIG.levelBase+ (level-1)*100; }
  return { level, current:xp, need };
}
export function touchActivity(db){
  const t=todayKey();
  if(db.progress.lastActiveDay!==t){
    const y=new Date(Date.now()-864e5).toISOString().slice(0,10);
    db.progress.streak = (db.progress.lastActiveDay===y) ? (db.progress.streak||0)+1 : 1;
    db.progress.lastActiveDay=t;
    if(db.progress.streak>=3 && !db.achievements.find(a=>a.id==='streak-3'))
      db.achievements.push({id:'streak-3',title:'🔥 3 أيام متتالية',at:now()});
  }
}

// ---------- Exam reminders (تذكير بنطاق + تاريخ، وليس اختبارًا تفاعليًا) ----------
// Exam shape: {id,title,subjectId,fromChapterId,toChapterId,scopeText,date,notes,done,doneAt,createdAt}
export function normalizeExams(db) {
  if (!Array.isArray(db.exams)) db.exams = [];
  db.exams.forEach(e => {
    // ترحيل النطاق القديم (فصل) إلى الجديد (موضوع)
    if (e.fromTopicId === undefined) {
      const chs = db.curriculum[e.subjectId]?.chapters || [];
      const ca = chs.find(c => c.id === (e.fromChapterId || e.chapterId));
      const cb = chs.find(c => c.id === (e.toChapterId || e.fromChapterId || e.chapterId));
      e.fromTopicId = ca?.topics?.[0]?.id || null;
      const bl = cb?.topics || [];
      e.toTopicId = bl[bl.length - 1]?.id || e.fromTopicId;
      delete e.fromChapterId; delete e.toChapterId; delete e.chapterId;
    }
    if (e.scopeText === undefined) e.scopeText = '';
    if (e.pageFrom === undefined) e.pageFrom = null;
    if (e.pageTo === undefined) e.pageTo = null;
    if (e.date === undefined) e.date = null;
    if (e.notes === undefined) e.notes = '';
    if (e.done === undefined) e.done = false;
    if (e.doneAt === undefined) e.doneAt = null;
    if (e.createdAt === undefined) e.createdAt = now();
    // إكمال الصفحات من المواضيع إن غابت
    if ((e.pageFrom == null) && e.fromTopicId) {
      const p = pagesForTopics(db, e.subjectId, e.fromTopicId, e.toTopicId);
      if (p.pageFrom != null) { e.pageFrom = p.pageFrom; e.pageTo = p.pageTo; }
    }
  });
}

export function orderedTopics(db, sid) {
  const out = [];
  ((db.curriculum || {})[sid]?.chapters || []).forEach(c => (c.topics || []).forEach(t => out.push({ c, t })));
  return out;
}
export function findTopicRef(db, sid, tid) {
  return orderedTopics(db, sid).find(x => x.t.id === tid) || null;
}
// كل المواضيع بين موضوعين (شامل) — لعرض نطاق التذكير كاملًا
export function topicsBetween(db, sid, fromTid, toTid) {
  const list = orderedTopics(db, sid);
  let a = list.findIndex(x => x.t.id === fromTid), b = list.findIndex(x => x.t.id === (toTid || fromTid));
  if (a < 0) return [];
  if (b < 0) b = a;
  if (b < a) { const t = a; a = b; b = t; }
  return list.slice(a, b + 1);
}
// صفحات نطاق من موضوع إلى موضوع
export function pagesForTopics(db, sid, fromTid, toTid) {
  const a = findTopicRef(db, sid, fromTid), b = findTopicRef(db, sid, toTid || fromTid);
  if (!a) return { pageFrom: null, pageTo: null };
  return { pageFrom: a.t.pageFrom ?? null, pageTo: (b || a).t.pageTo ?? (b || a).t.pageFrom ?? null };
}
// مواضيع نطاق صفحات (من → إلى) — تُستخدم للتحديد التلقائي
export function topicsForPages(db, sid, pf, pt) {
  const list = orderedTopics(db, sid).filter(x => x.t.pageFrom != null);
  if (!list.length || pf == null) return { from: null, to: null };
  pt = pt ?? pf;
  let from = null, to = null;
  for (const x of list) {
    const a = x.t.pageFrom, b = x.t.pageTo ?? x.t.pageFrom;
    if (!from && a <= pf && pf <= b) from = x;
    if (a <= pt && pt <= b) to = x;
  }
  if (!from) { const c = [...list].reverse().find(x => x.t.pageFrom <= pf); from = c || list[0]; }
  if (!to) { const c = list.find(x => (x.t.pageTo ?? x.t.pageFrom) >= pt); to = c || list[list.length - 1]; }
  if (list.indexOf(to) < list.indexOf(from)) to = from;
  return { from, to };
}

export function examScopeLabel(db, e) {
  if (e.scopeText) return e.scopeText;
  const a = findTopicRef(db, e.subjectId, e.fromTopicId), b = findTopicRef(db, e.subjectId, e.toTopicId);
  if (a && b) {
    if (a.t.id === b.t.id) return `${a.t.title}${a.t.pageFrom ? ' · ' + pagesLabel(a.t.pageFrom, a.t.pageTo) : ''}`;
    const sameCh = a.c.id === b.c.id;
    return sameCh ? `من ${a.t.title} إلى ${b.t.title}` : `من ${a.t.title} (${a.c.title}) إلى ${b.t.title} (${b.c.title})`;
  }
  if (a) return a.t.title;
  return 'نطاق عام';
}

export function daysLabel(dateStr) {
  if (!dateStr) return { txt: 'بلا تاريخ', cls: '' };
  const t = todayKey();
  const diff = Math.round((new Date(dateStr) - new Date(t)) / 864e5);
  if (diff === 0) return { txt: 'اليوم 📌', cls: 'warn' };
  if (diff === 1) return { txt: 'غدًا', cls: '' };
  if (diff > 1) return { txt: `بعد ${diff} يوم`, cls: '' };
  return { txt: `متأخر ${Math.abs(diff)} يوم`, cls: 'bad' };
}

// أول الدروس غير المكتملة بالترتيب (يُستخدم للتركيز والخطة التلقائية)
export function nextLessons(db, limit = 5) {
  const out = [];
  for (const s of db.subjects) {
    const cur = db.curriculum[s.id];
    for (const c of (cur?.chapters || [])) for (const t of (c.topics || [])) for (const l of (t.lessons || [])) {
      if (!l.completed) { out.push({ s, c, t, l }); if (out.length >= limit) return out; }
    }
  }
  return out;
}

// ---------- نظام التذكير الموحد (دروس + امتحانات) ----------
// lesson.remindAt: تاريخ التذكير بالدرس | exam.date: تاريخ الامتحان
export function collectReminders(db) {
  const t = todayKey();
  const out = [];
  for (const s of (db.subjects || [])) {
    const cur = db.curriculum[s.id];
    for (const c of (cur?.chapters || [])) for (const tp of (c.topics || [])) for (const l of (tp.lessons || [])) {
      if (l.remindAt && !l.completed) {
        out.push({ key: `l-${l.id}`, kind: 'lesson', title: l.title, sub: `${s.name} · ${c.title}`,
          date: l.remindAt, done: false, link: `#/lesson/${s.id}/${c.id}/${tp.id}/${l.id}`,
          overdue: l.remindAt < t, today: l.remindAt === t, ref: { s, c, tp, l } });
      }
    }
  }
  (db.exams || []).forEach(e => {
    if (e.date && !e.done) {
      const sub = (db.subjects || []).find(s => s.id === e.subjectId);
      out.push({ key: `e-${e.id}`, kind: 'exam', title: e.title, sub: `${sub?.name || ''} · ${examScopeLabel(db, e)}`,
        date: e.date, done: false, link: `#/exam/${e.id}`,
        overdue: e.date < t, today: e.date === t, ref: { exam: e } });
    }
  });
  out.sort((a, b) => (a.overdue !== b.overdue) ? (a.overdue ? -1 : 1) : a.date.localeCompare(b.date));
  return out;
}
export function dueCount(db) {
  const t = todayKey();
  return collectReminders(db).filter(r => r.date <= t).length;
}
