// Shared Open Study OS visual components: rings, activity graph, map preview, sync panel.
import { esc } from './config.js';
import { lectureLabel } from './models.js';
import { syncStatus } from './sync.js';
import { getSession, getToken } from './auth.js';

export const SUBJ_COLORS = ['#4F7CFF', '#22D3A6', '#F59E0B', '#F05252', '#10B981', '#8B7CFF'];
export const subjColor = (s, i) => s?.color || SUBJ_COLORS[(i ?? 0) % SUBJ_COLORS.length];
// عنوان الدرس = اسم المادة دائمًا → شارة فقط + رقم المحاضرة (بلا أي نص مكرر)
export function lessonHead(db, sid, l) {
  const lec = lectureLabel(l) ? `<span class="chip">${lectureLabel(l)}</span>` : '';
  return `<div class="row" style="gap:6px">${subjBadge(db, sid)}${lec}</div>`;
}
// شارة المادة بلونها — لرؤيتها بسهولة داخل بطاقات الدروس
export function subjBadge(db, sid) {
  const subs = db.subjects || [];
  const s = subs.find(x => x.id === sid);
  if (!s) return '';
  const col = subjColor(s, subs.indexOf(s));
  return `<span class="chip subj-badge" style="--ac:${col}">${esc(s.icon || '')} ${esc(s.name)}</span>`;
}

export function ring(pct, color = '#4F7CFF', size = 72, stroke = 8, label = null) {
  pct = Math.max(0, Math.min(100, Math.round(pct)));
  const r = (size - stroke) / 2, c = 2 * Math.PI * r, off = c * (1 - pct / 100);
  const cx = size / 2;
  return `<svg class="ring" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}" role="img" aria-label="${pct}%">
    <circle cx="${cx}" cy="${cx}" r="${r}" fill="none" stroke="var(--line)" stroke-width="${stroke}"/>
    <circle cx="${cx}" cy="${cx}" r="${r}" fill="none" stroke="${color}" stroke-width="${stroke}" stroke-linecap="round" stroke-dasharray="${c.toFixed(1)}" stroke-dashoffset="${off.toFixed(1)}" transform="rotate(-90 ${cx} ${cx})" style="transition:stroke-dashoffset .8s"/>
    <text x="${cx}" y="${cx}" text-anchor="middle" dy=".35em" font-size="${Math.round(size * 0.22)}">${label ?? pct + '%'}</text></svg>`;
}

// Study activity graph (GitHub-style, but for study minutes). Returns HTML.
export function activityGraph(db, weeks = 12) {
  const mins = {};
  (db.sessions || []).forEach(s => { const d = (s.at || '').slice(0, 10); if (d) mins[d] = (mins[d] || 0) + (+s.minutes || 0); });
  (db.results || []).forEach(r => { const d = (r.at || '').slice(0, 10); if (d) mins[d] = (mins[d] || 0) + 10; });
  const days = [];
  const today = new Date();
  const start = new Date(today); start.setDate(start.getDate() - (weeks * 7 - 1));
  for (let i = 0; i < weeks * 7; i++) { const d = new Date(start); d.setDate(start.getDate() + i); days.push(d.toISOString().slice(0, 10)); }
  let cols = '';
  for (let w = 0; w < weeks; w++) {
    let cells = '';
    for (let d = 0; d < 7; d++) {
      const key = days[w * 7 + d], m = mins[key] || 0;
      const lv = m <= 0 ? 0 : m < 15 ? 1 : m < 45 ? 2 : 3;
      cells += `<span class="act-cell l${lv}" title="${key} · ${m} د"></span>`;
    }
    cols += `<span class="act-col">${cells}</span>`;
  }
  const total = Object.values(mins).reduce((a, b) => a + b, 0);
  return `<div class="act-wrap">${cols}</div><div class="muted small" style="margin-top:6px">${total} دقيقة نشاط مسجلة</div>`;
}

// Dashboard study-map preview: central OS node + subject branches with lesson nodes.
export function mapPreview(db) {
  const subs = db.subjects.slice(0, 6);
  if (!subs.length) return `<div class="card muted">لا مواد بعد — أنشئ مادة لترى خريطة رحلتك هنا.</div>`;
  const rowH = 62, top = 34, H = top * 2 + (subs.length - 1) * rowH;
  const cy = H / 2, cx = 84, sx = 218;
  let s = `<svg class="map-svg" viewBox="0 0 640 ${H}" role="img">`;
  subs.forEach((sub, i) => {
    const y = top + i * rowH, col = subjColor(sub, i);
    const lessons = [];
    (db.curriculum[sub.id]?.chapters || []).forEach(c => (c.topics || []).forEach(t => (t.lessons || []).forEach(l => lessons.push(l))));
    const done = lessons.filter(l => l.completed).length;
    s += `<path class="mlink" d="M ${cx} ${cy} C 150 ${cy}, 150 ${y}, ${sx - 12} ${y}" fill="none"/>`;
    s += `<circle class="mnode" cx="${sx}" cy="${y}" r="9" fill="${col}"/>`;
    s += `<text x="${sx + 16}" y="${y + 4}" font-size="13" font-weight="700">${esc(sub.name)} · ${lessons.length ? Math.round(done / lessons.length * 100) : 0}%</text>`;
    const dots = lessons.slice(0, 11);
    dots.forEach((l, di) => {
      const dx = 250 + di * 30;
      s += l.completed
        ? `<circle class="mnode mdone" cx="${dx}" cy="${y}" r="6"/>`
        : `<circle class="mnode mtodo" cx="${dx}" cy="${y}" r="6"/>`;
    });
    if (lessons.length > 11) s += `<text x="${250 + 11 * 30}" y="${y + 4}" font-size="11" fill="var(--muted)">+${lessons.length - 11}</text>`;
  });
  s += `<circle class="mnode" cx="${cx}" cy="${cy}" r="17" fill="var(--primary)"/>`;
  s += `<text x="${cx}" y="${cy - 26}" text-anchor="middle" font-size="12" font-weight="800" letter-spacing="3">FOSES</text>`;
  return s + `</svg>`;
}

// GitHub sync panel (open-source identity block).
export function syncPanel() {
  const sess = getSession(), st = syncStatus();
  const dot = st === 'synced' ? '' : st === 'syncing' ? 'busy' : 'err';
  const label = st === 'synced' ? '● تمت المزامنة' : st === 'syncing' ? '↻ جارٍ المزامنة…' : !getToken() ? '○ محلي فقط' : '⚠ يلزم المزامنة';
  if (!sess?.login) return `<div class="os-panel sync-panel"><span class="eyebrow">بياناتك</span>
    <div class="row spread"><span class="sync-pill err"><i></i> ○ محلي فقط</span><a class="btn sm" href="#/login">ربط GitHub</a></div>
    <p class="muted small">اربط حساب GitHub ليُحفظ كل تقدمك تلقائيًا في مستودعك الخاص.</p></div>`;
  const repo = sess.repoName || 'fos-study-data';
  return `<div class="os-panel sync-panel"><span class="eyebrow">بياناتك · مفتوح المصدر</span>
    <div class="row spread"><span class="sync-pill ${dot}"><i></i> ${label}</span><span class="repo">${esc(sess.login)}/${esc(repo)}</span></div>
    <div class="commit-msg" id="lastCommit">آخر حفظ: …</div>
    <div class="row"><a class="btn sm ghost" href="https://github.com/${esc(sess.login)}/${esc(repo)}" target="_blank">◈ المستودع</a><a class="btn sm ghost" href="#/import">⤓ تصدير البيانات</a><a class="btn sm ghost" href="#/repo">التفاصيل</a></div></div>`;
}

export async function fillLastCommit() {
  const box = document.getElementById('lastCommit'); if (!box) return;
  try {
    const sess = getSession(), tok = getToken();
    if (!sess?.login || !tok) { box.textContent = 'الوضع المحلي — البيانات في متصفحك فقط.'; return; }
    const r = await fetch(`https://api.github.com/repos/${sess.login}/${sess.repoName || 'fos-study-data'}/commits?per_page=1`, { headers: { Authorization: `Bearer ${tok}`, Accept: 'application/vnd.github+json' } });
    if (!r.ok) throw 0;
    const j = await r.json();
    box.textContent = j.length ? `آخر حفظ: "${j[0].commit.message.slice(0, 80)}" · ${j[0].commit.author.date.slice(0, 10)}` : 'المستودع جاهز — أول مزامنة ستظهر هنا.';
  } catch { box.textContent = 'تعذر جلب آخر حفظ (تحقق من الاتصال).'; }
}
