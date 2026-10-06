import { pDashboard } from './pages/dashboard.js';
import { pSubjects, pSubject, pTopic, pLesson } from './pages/study.js';
import { pLessons } from './pages/lessons.js';
import { pExams, pExam, pExamEdit } from './pages/exams.js';
import { pMap } from './pages/map.js';
import { pDNA } from './pages/dna.js';
import { pMore } from './pages/more.js';
import { pReminders } from './pages/remind.js';
import { pTimetable } from './pages/timetable.js';
import { pProgress, pTimer, pCalendar } from './pages/tools.js';
import { pLogin, pSettings, pImport, pRepo } from './pages/system.js';
import { paintNav, paintXp, paintBell } from './shell.js';
import { getDB } from './store.js';

const routes=[
  [/^#\/?$/,()=>location.hash='#/dashboard'],
  [/^#\/login$/,pLogin],
  [/^#\/dashboard$/,pDashboard],
  [/^#\/map$/,el=>pMap(el)],
  [/^#\/dna$/,pDNA],
  [/^#\/more$/,pMore],
  [/^#\/reminders$/,pReminders],
  [/^#\/subjects$/,pSubjects],
  [/^#\/lessons$/, el => pLessons(el)],
  [/^#\/lessons\/([^/]+)\/([^/]+)\/([^/]+)$/, el => pLessons(el)],
  [/^#\/subject\/([^/]+)$/,(el,m)=>pSubject(el,decodeURIComponent(m[1]))],
  [/^#\/topic\/([^/]+)\/([^/]+)\/([^/]+)$/,(el,m)=>pTopic(el,m[1],m[2],m[3])],
  [/^#\/lesson\/([^/]+)\/([^/]+)\/([^/]+)\/([^/]+)$/,(el,m)=>pLesson(el,m[1],m[2],m[3],m[4])],
  [/^#\/exams$/,pExams],
  [/^#\/exam\/([^/]+)$/,(el,m)=>pExam(el,m[1])],
  [/^#\/exam\/([^/]+)\/edit$/,(el,m)=>pExamEdit(el,m[1])],
  [/^#\/result\/([^/]+)$/,()=>location.hash='#/exams'],
  [/^#\/progress$/,pProgress],
  [/^#\/timer$/,pTimer],
  [/^#\/calendar$/,pCalendar],
  [/^#\/timetable$/,pTimetable],
  [/^#\/settings$/,pSettings],
  [/^#\/import$/,pImport],
  [/^#\/repo$/,pRepo],
];
export async function router(){
  const h=location.hash||'#/dashboard';
  const el=document.getElementById('app');
  paintNav(h);
  try{
    for(const [re,fn] of routes){ const m=h.match(re); if(m){ await fn(el,m); window.scrollTo(0,0); paintXp(getDB()); paintBell(getDB());
      document.getElementById('splash')?.classList.add('done'); return; } }
    el.innerHTML='<div class="card">صفحة غير موجودة <a href="#/dashboard">الرئيسية</a></div>';
  }catch(e){ console.error(e); el.innerHTML=`<div class="card">خطأ: ${e.message}</div>`; }
}
