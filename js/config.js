export const CONFIG = {
  appName: 'فوسيز',
  dataRepoName: 'fos-study-data', // per-user repo owned by the user
  dataBranch: 'main',
  files: ['subjects.json','curriculum.json','exams.json','results.json','progress.json','sessions.json','events.json','timetable.json','settings.json','achievements.json'],
  xpPerLesson: 50,
  xpPerExamPass: 100,
  xpPerSessionMin: 2,
  xpPerStreakDay: 20,
  levelBase: 300, // xp needed grows linearly: level*base
};
export const uid = (p='id') => p+'-'+Math.random().toString(36).slice(2,8)+Date.now().toString(36).slice(-4);
export const now = () => new Date().toISOString();
// تاريخ محلي YYYY-MM-DD (وليس UTC — فرق التوقيت كان يخفي دروس اليوم بعد منتصف الليل)
export const todayKey = (d = new Date()) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
export function esc(s){ return String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])); }
