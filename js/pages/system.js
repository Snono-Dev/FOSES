import { getDB, saveLocal, replaceAll, resetDemo } from '../store.js';
import { getSession, setSession, clearSession, getToken, setToken, fetchMe, deviceStart, devicePoll, updateSession } from '../auth.js';
import { ensureDataRepo, getRepo, readFile, writeRawFile, deleteFile, listRepos } from '../github.js';
import { initialSync, pushNow } from '../sync.js';
import { lastSyncError } from '../sync.js';
import { validateCurriculumImport, normalizeImport, DB_DEFAULTS } from '../models.js';
import { esc, CONFIG, now } from '../config.js';
import { toast, modal, closeModal, download } from '../ui.js';
import { ensurePermission, pushSupport, periodicSupport, registerPeriodic, genVapid, subscribePush, pushState, unsubscribePush, mirrorReminders } from '../notify.js';
import { icon } from '../icons.js';
import { SS } from '../storage.js';

export async function pLogin(el){
  const sess=getSession();
  if(sess?.login){
    el.innerHTML=`<img class="login-logo" src="./assets/icons/icon-512.png" alt="FOSES">
    <div class="os-panel" style="text-align:center"><span class="eyebrow">متصل</span>
    <h2>✅ مسجل دخولك بـ GitHub</h2><p class="muted">@${esc(sess.login)} — بياناتك تُزامن مع مستودعك.</p>
    <div class="row" style="justify-content:center"><a class="btn" href="#/dashboard">الرئيسية</a><a class="btn ghost" href="#/repo">المستودع</a><button class="btn ghost" id="out">تسجيل الخروج</button></div></div>`;
    el.querySelector('#out').onclick=()=>{ clearSession(); location.hash='#/login'; location.reload(); };
    return;
  }
  el.innerHTML=`<img class="login-logo" src="./assets/icons/icon-512.png" alt="FOSES"><p class="muted small" style="text-align:center">Free Open Source E-School<br>مدرسة إلكترونية مجانية مفتوحة المصدر</p><h2 style="text-align:center"><span class="h-ic">${icon('key', 20)}</span> تسجيل الدخول بـ GitHub</h2>
  ${sess?.demo?'<div class="card">أنت في <b>الوضع التجريبي</b> — اربط GitHub أدناه لحفظ بياناتك في مستودعك الخاص.</div>':''}
  <div class="card"><b>الطريقة الموصى بها: رمز وصول دقيق (آمن 100%، بدون سيرفر)</b>
  <ol class="small"><li>افتح <a href="https://github.com/settings/tokens?type=beta" target="_blank">github.com/settings/tokens</a></li>
  <li>إنشاء رمز جديد (Generate new token) ← ثم امنحه صلاحية <span class="kbd">Contents: Read & write</span> على مستودع بياناتك فقط</li><li>الصق الرمز هنا 👇</li></ol>
  <label>رمز GitHub (يبدأ بـ github_pat_ أو ghp_)</label><input id="tok" type="password" placeholder="ghp_xxx..." dir="ltr">
  <label class="row" style="flex-direction:row"><input type="checkbox" id="priv" checked style="width:auto"> مستودع البيانات خاص (مستحسن)</label>
  <div class="row" style="margin-top:10px"><button class="btn" id="go">دخول بالرمز</button><button class="btn ghost" id="demo">تجربة بدون حساب</button></div>
  <p class="muted small">الرمز يُحفظ في متصفحك فقط ولا يُرسل إلا إلى api.github.com.</p></div>
  <div class="card"><b>أو: ربط الجهاز (بدون لصق رمز)</b><p class="muted small">يتطلب إنشاء تطبيق OAuth وتفعيل ربط الأجهزة، ثم أدخل معرّف العميل (علني وآمن).</p>
  <label>معرّف العميل</label><input id="cid" placeholder="Ov23li..." dir="ltr"><button class="btn ghost" id="dev" style="margin-top:8px">بدء ربط الجهاز</button><div id="dmsg" class="small muted"></div></div>`;
  el.querySelector('#demo').onclick=async()=>{ setSession({login:null,name:'ضيف',demo:true}, true); location.hash='#/dashboard'; };
  el.querySelector('#go').onclick=async()=>{
    const tok=el.querySelector('#tok').value.trim(); if(!tok) return toast('الصق الرمز أولًا');
    try{
      const me=await fetchMe(tok);
      const isPrivate=el.querySelector('#priv').checked;
      setToken(tok,true); SS.set('foses-token',tok);
      setSession({login:me.login,name:me.name||me.login,avatar:me.avatar_url,email:me.email,id:me.id,repoName:CONFIG.dataRepoName,branch:'main',private:isPrivate}, true);
      document.getElementById('avatar')?.classList.remove('hidden');
      const av=document.getElementById('avatar'); if(av) av.src=me.avatar_url;
      toast('تم الدخول ✅ جارٍ تجهيز مخزن البيانات...');
      await initialSync(); location.hash='#/dashboard';
    }catch{ toast('الرمز غير صالح ❌'); }
  };
  el.querySelector('#dev').onclick=async()=>{
    const cid=el.querySelector('#cid').value.trim(); if(!cid) return toast('أدخل معرّف العميل');
    try{
      const d=await deviceStart(cid);
      el.querySelector('#dmsg').innerHTML=`افتح <a href="${d.verification_uri}" target="_blank">${d.verification_uri}</a> وأدخل الكود <b class="kbd">${d.user_code}</b> ثم انتظر...`;
      const t=await devicePoll(cid,d.device_code,d.interval||5);
      const me=await fetchMe(t.access_token);
      setToken(t.access_token,true); SS.set('foses-token',t.access_token);
      setSession({login:me.login,name:me.name||me.login,avatar:me.avatar_url,email:me.email,id:me.id,repoName:CONFIG.dataRepoName,branch:'main',private:true}, true);
      await initialSync(); location.hash='#/dashboard';
    }catch(e){ toast('فشل الربط: '+e.message); }
  };
}

export async function pSettings(el){
  const db=getDB(); const sess=getSession();
  el.innerHTML=`<h2><span class="h-ic">${icon('sliders', 20)}</span> الإعدادات</h2>
  <div class="card"><b>الحساب</b><p class="muted small">${sess?esc(sess.login||'ضيف'):''}</p>
  <div class="row"><button class="btn ghost" id="logout">تسجيل الخروج</button><button class="btn ghost" id="sync">🔄 مزامنة الآن</button></div></div>
  <div class="card"><b>المظهر</b><div class="row" style="margin-top:8px"><button class="btn ghost sm" id="th">🌙/☀️ تبديل السمة</button></div></div>
  <div class="card" id="pushCard"><b>🔔 تنبيهات الهاتف</b><div class="muted small">طبقتان مجانيتان بدون أي سيرفر مدفوع: تنبيه فوري والمتصفح مفتوح + دفع يومي عبر GitHub Actions.</div><div id="pushBody" class="muted small">جارٍ الفحص...</div></div>
  <div class="card"><b>⚠️ منطقة الخطر</b><div class="row"><button class="btn danger sm" id="wipe">تصفير البيانات المحلية</button></div></div>`;
  el.querySelector('#logout').onclick=()=>{clearSession();location.hash='#/login';location.reload();};
  el.querySelector('#sync').onclick=async()=>{toast('جارٍ المزامنة...');await pushNow();toast('تم ✅');};
  el.querySelector('#th').onclick=()=>document.getElementById('themeBtn').click();
  el.querySelector('#wipe').onclick=()=>{if(confirm('تصفير؟')){resetDemo();toast('تم التصفير');}};
  pushSetup(el, db);
}

let lastPriv = null; // in-memory only — NEVER saved/synced
async function pushSetup(el, db) {
  const box = el.querySelector('#pushBody'); if (!box) return;
  const st = db.settings;
  const perm = ('Notification' in window) ? Notification.permission : 'unsupported';
  const sub = await pushState();
  const repoName = getSession()?.repoName || CONFIG.dataRepoName;
  const owner = getSession()?.login;
  box.innerHTML = `
  <div class="row" style="margin:8px 0"><span class="chip">المتصفح: ${perm === 'granted' ? '✅ مسموح' : perm === 'denied' ? '❌ مرفوض' : perm === 'unsupported' ? 'غير مدعوم' : 'لم يُطلب'}</span>
  <span class="chip">الاشتراك: ${sub ? '✅ مفعّل' : '—'}</span>
  <span class="chip">الخلفية: ${periodicSupport() ? 'متاحة (أندرويد)' : 'غير مدعومة هنا'}</span></div>
  <div class="row">
    ${perm !== 'granted' ? '<button class="btn sm" id="pPerm">🔔 تفعيل التنبيهات</button>' : ''}
    ${!st.vapidPublic ? '<button class="btn sm ghost" id="pGen">🔑 توليد مفاتيح VAPID</button>' : ''}
    ${st.vapidPublic && !sub ? '<button class="btn sm" id="pSub">📲 اشترك هذا الجهاز</button>' : ''}
    ${sub ? '<button class="btn sm ghost" id="pUnsub">إلغاء الاشتراك</button>' : ''}
  </div>
  ${st.vapidPublic ? `<label>المفتاح العام (يُزامن تلقائيًا)</label><pre class="code" style="word-break:break-all;white-space:pre-wrap">${esc(st.vapidPublic)}</pre>` : '<p>1) فعّل التنبيهات 2) ولّد المفاتيح 3) اشترك — ثم ثبّت الدفع اليومي بالأسفل.</p>'}
  <div id="pPriv">${lastPriv ? `<label>🔑 المفتاح الخاص — انسخه الآن إلى GitHub Secrets باسم FOSES_VAPID_PRIVATE (لن يظهر مجددًا!)</label><textarea rows="4" readonly>${esc(lastPriv)}</textarea>` : ''}</div>
  <h3>الدفع اليومي عبر GitHub Actions (يعمل وهاتفك مغلق)</h3>
  <div class="row">
    <button class="btn sm" id="pInstall">⬆️ تثبيت ملفات الدفع في مستودعي</button>
    <button class="btn sm ghost" id="pDl">⬇️ تنزيل الملفات يدويًا</button>
  </div>
  <ol class="small">
    <li>ثبّت الملفات بالزر أعلاه (يتطلب صلاحية Workflows في الرمز — وإلا نزّلها وارفعها يدويًا).</li>
    <li>انسخ <b>المفتاح الخاص</b> (يظهر بعد التوليد — احتفظ بنسخة!) إلى: مستودعك ← Settings ← Secrets ← Actions ← New secret باسم <span class="kbd">FOSES_VAPID_PRIVATE</span>.</li>
    <li>فعّل Actions في المستودع ثم شغّل <span class="kbd">foses-push</span> يدويًا (Run workflow ← test: true) لاختبار وصول التنبيه.</li>
  </ol><div id="pMsg" class="small"></div>`;
  const msg = t => { box.querySelector('#pMsg').textContent = t; };
  box.querySelector('#pPerm') && (box.querySelector('#pPerm').onclick = async () => {
    const r = await ensurePermission();
    if (r === 'granted') { await registerPeriodic(); await mirrorReminders(db); toast('تم تفعيل التنبيهات 🔔'); }
    else toast('تعذر التفعيل — اسمح من إعدادات المتصفح');
    pushSetup(el, db);
  });
  box.querySelector('#pGen') && (box.querySelector('#pGen').onclick = async () => {
    if (st.vapidPublic && !confirm('لديك مفاتيح — التوليد الجديد يُبطل الاشتراكات الحالية. متابعة؟')) return;
    const v = await genVapid();
    st.vapidPublic = v.public; lastPriv = v.privateJwk; saveLocal();
    toast('وُلّدت المفاتيح — انسخ الخاص الآن 📋'); pushSetup(el, db);
  });
  box.querySelector('#pSub') && (box.querySelector('#pSub').onclick = async () => {
    try {
      const s = await subscribePush(st.vapidPublic);
      st.pushSub = s; saveLocal(); toast('اشترك الجهاز 📲 — سيصلك تنبيه يومي');
    } catch { toast('فشل الاشتراك — تأكد من السماح بالتنبيهات'); }
    pushSetup(el, db);
  });
  box.querySelector('#pUnsub') && (box.querySelector('#pUnsub').onclick = async () => {
    await unsubscribePush(); delete st.pushSub; saveLocal(); pushSetup(el, db);
  });
  box.querySelector('#pInstall') && (box.querySelector('#pInstall').onclick = async () => {
    const tok = getToken();
    if (!tok || !owner) return msg('سجّل الدخول بـ GitHub أولًا.');
    msg('جارٍ التثبيت...');
    try {
      const [wf, sender] = await Promise.all([
        fetch('./push/foses-push.yml').then(r => { if (!r.ok) throw 0; return r.text(); }),
        fetch('./push/send-push.mjs').then(r => { if (!r.ok) throw 0; return r.text(); })
      ]);
      const branch = getSession()?.branch || 'main';
      for (const [path, text] of [['.github/workflows/foses-push.yml', wf], ['.github/foses/send-push.mjs', sender]]) {
        let sha = null;
        try { const cur = await readFile(tok, owner, repoName, path, branch); if (cur.exists) sha = cur.sha; } catch {}
        await writeRawFile(tok, owner, repoName, path, text, '🔔 fos: install push notifier', branch, sha);
      }
      msg('تم التثبيت ✅ — أضف السر FOSES_VAPID_PRIVATE ثم شغّل الـ workflow يدويًا للاختبار.');
    } catch (e) { msg('تعذر التثبيت التلقائي (غالبًا صلاحية Workflows ناقصة في الرمز) — نزّل الملفات وارفعها يدويًا.'); }
  });
  box.querySelector('#pDl') && (box.querySelector('#pDl').onclick = async () => {
    const wf = await fetch('./push/foses-push.yml').then(r => r.text());
    const sender = await fetch('./push/send-push.mjs').then(r => r.text());
    download('foses-push.yml', { _note: 'ضع في data-repo/.github/workflows/', content: wf });
    download('send-push.mjs', { _note: 'ضع في data-repo/.github/foses/', content: sender });
    msg('نُزّل الملفان — ارفعهما للمسارات المذكورة داخل كل ملف.');
  });
}

export async function pImport(el){
  const db=getDB();
  el.innerHTML=`<h2><span class="h-ic">${icon('download', 20)}</span> استيراد / تصدير</h2>
  <div class="card"><b>استيراد منهج (JSON)</b><p class="muted small">ارفع ملفًا بصيغة { subjects:[{name, chapters:[{title, topics:[{title, lessons:[{title}]}]}]}] } — أو ملف نسخة احتياطية كاملة.</p>
  <input type="file" id="f" accept=".json,application/json"><pre class="code" id="prev">اختر ملفًا للمعاينة والفحص...</pre><div class="row"><button class="btn" id="do" disabled>تأكيد الاستيراد</button><button class="btn ghost" id="merge">دمج بدل الاستبدال</button></div><div id="errs" class="small"></div></div>
  <div class="card"><b>نسخ احتياطي</b><div class="row"><button class="btn" id="exp">⬇️ تنزيل بياناتي (JSON)</button><button class="btn ghost" id="expsub">تصدير مادة واحدة</button></div>
  <label>استعادة من نص JSON</label><textarea id="paste" rows="4" placeholder='الصق JSON هنا...'></textarea><button class="btn ghost" id="frompaste" style="margin-top:8px">استيراد من النص</button></div>`;
  let parsed=null, isBackup=false;
  el.querySelector('#f').onchange=e=>{
    const file=e.target.files[0]; if(!file) return;
    const rd=new FileReader();
    rd.onload=()=>{
      try{
        parsed=JSON.parse(rd.result);
        isBackup=!!(parsed.subjects&&parsed.curriculum&&parsed.exams);
        const toCheck=isBackup?{subjects:Object.entries(parsed.curriculum||{}).map(()=>({name:'x'}))}:parsed;
        const v=isBackup?{ok:true,errors:[]}:validateCurriculumImport(parsed);
        el.querySelector('#prev').textContent=JSON.stringify(parsed,null,2).slice(0,3000);
        el.querySelector('#errs').innerHTML=v.ok?'<span class="chip">✅ صالح للاستيراد</span>':v.errors.map(x=>`<div>❌ ${esc(x)}</div>`).join('');
        el.querySelector('#do').disabled=!v.ok;
      }catch{ el.querySelector('#errs').textContent='❌ ملف JSON غير صالح'; }
    };
    rd.readAsText(file);
  };
  const apply=(merge)=>{
    if(!parsed) return;
    if(isBackup){ if(merge){Object.assign(getDB(),parsed);} else replaceAll({...DB_DEFAULTS(),...parsed}); }
    else{ const n=normalizeImport(parsed);
      if(merge){ const db=getDB(); db.subjects.push(...n.subjects); Object.assign(db.curriculum,n.curriculum); db.exams.push(...n.exams); if(n.timetable&&Object.keys(n.timetable).length)db.timetable=n.timetable; saveLocal(); }
      else { const db=getDB(); db.subjects=n.subjects; db.curriculum=n.curriculum; db.exams=[...db.exams,...n.exams]; if(n.timetable&&Object.keys(n.timetable).length)db.timetable=n.timetable; saveLocal(); } }
    saveLocal(); toast('تم الاستيراد ✅'); location.hash='#/subjects';
  };
  el.querySelector('#do').onclick=()=>apply(false);
  el.querySelector('#merge').onclick=()=>apply(true);
  el.querySelector('#exp').onclick=()=>download('foses-backup-'+new Date().toISOString().slice(0,10)+'.json',getDB());
  el.querySelector('#expsub').onclick=()=>{
    const db2=getDB(); const id=prompt('ID المادة؟ أول مادة: '+(db2.subjects[0]?.id||'')); if(!id) return;
    const s=db2.subjects.find(x=>x.id===id); if(!s) return toast('غير موجودة');
    download('subject-'+id+'.json',{name:s.name,description:s.desc,chapters:db2.curriculum[id]?.chapters||[],exams:db2.exams.filter(e=>e.subjectId===id)});
  };
  el.querySelector('#frompaste').onclick=()=>{
    try{ parsed=JSON.parse(el.querySelector('#paste').value); isBackup=!!(parsed.subjects&&parsed.curriculum); apply(false); }
    catch{ toast('نص JSON غير صالح'); }
  };
}

export async function pRepo(el){
  const sess=getSession(); const tok=getToken();
  el.innerHTML=`<h2><span class="h-ic">${icon('database', 20)}</span> مخزن GitHub</h2><div class="card" id="box">جارٍ الفحص...</div>`;
  const box=el.querySelector('#box');
  if(!sess?.login||!tok){ box.innerHTML='سجّل الدخول أولًا لربط مخزن البيانات. <a href="#/login">دخول</a>'; return; }
  try{
    const repo=await getRepo(tok,sess.login,sess.repoName||CONFIG.dataRepoName);
    box.innerHTML=repo?`✅ <b>${esc(repo.full_name)}</b> ${repo.private?'🔒 خاص':'🌍 عام'}<br><a class="btn sm" style="margin-top:8px" href="${repo.html_url}" target="_blank">فتح على GitHub</a> <button class="btn sm ghost" id="push">⬆️ دفع البيانات الآن</button><p class="muted small">كل تعديل يُحفظ تلقائيًا — لديك سجل نسخ ونسخة احتياطية مجانية وإمكانية الرجوع لأي نسخة.</p>`
    :'لا يوجد ريبو بعد — سيُنشأ تلقائيًا عند أول مزامنة.';
    box.querySelector('#push')?.addEventListener('click',async()=>{await pushNow('📚 fos: manual backup');toast('تم الدفع ✅');});
  }catch(e){ box.textContent='خطأ: '+e.message; }
  // بطاقة حالة المزامنة + التشخيص
  const err = lastSyncError();
  el.insertAdjacentHTML('beforeend', `<div class="card" id="diagCard"><b>🩺 حالة المزامنة</b>
  <p class="muted small">${err ? 'آخر خطأ: <span class="kbd" dir="ltr">' + esc(err) + '</span>' : 'لا أخطاء مسجلة حاليًا.'}</p>
  <div class="row"><button class="btn sm" id="retry">🔄 إعادة المحاولة</button><button class="btn sm ghost" id="diagBtn">تشغيل التشخيص</button></div>
  <div id="diagOut" class="small" style="margin-top:8px"></div></div>`);
  el.querySelector('#retry').onclick = async () => { toast('جارٍ إعادة المزامنة...'); await initialSync(); pRepo(el); };
  el.querySelector('#diagBtn').onclick = () => runDiag(el.querySelector('#diagOut'));

  // اختيار مستودع البيانات من مستودعاتك
  el.insertAdjacentHTML('beforeend', `<div class="card" id="pickCard"><b>📦 اختيار مستودع البيانات</b>
  <p class="muted small">الحالي: <span class="kbd" dir="ltr">${esc(sess.login)}/${esc(sess.repoName || CONFIG.dataRepoName)}</span> — اختر من مستودعاتك أو اكتب اسمًا جديدًا ليُنشأ.</p>
  <div id="repoList" class="muted small">جارٍ جلب مستودعاتك...</div>
  <div class="fld-row" style="margin-top:8px"><div class="fld"><span>اسم مستودع (جديد أو موجود)</span><input id="repoCustom" placeholder="fos-study-data" dir="ltr"></div></div>
  <div class="row" style="margin-top:8px"><button class="btn sm" id="repoUse">استخدام / إنشاء</button></div></div>`);
  const listBox = el.querySelector('#repoList');
  try {
    const repos = await listRepos(tok);
    listBox.innerHTML = repos.length ? '' : 'لا مستودعات.';
    repos.slice(0, 30).forEach(r => {
      const b = document.createElement('button');
      b.className = 'chip'; b.style.cssText = 'cursor:pointer;margin:2px;font-family:monospace';
      b.textContent = `${r.name}${r.private ? ' 🔒' : ''}`;
      if (r.name === (sess.repoName || CONFIG.dataRepoName)) b.style.borderColor = 'var(--ok)';
      b.onclick = () => switchRepo(r.name);
      listBox.appendChild(b);
    });
  } catch { listBox.textContent = 'تعذر الجلب — تحقق من الرمز.'; }
  el.querySelector('#repoUse').onclick = () => {
    const name = el.querySelector('#repoCustom').value.trim();
    if (!name) return toast('اكتب اسم المستودع');
    if (!/^[A-Za-z0-9._-]+$/.test(name)) return toast('اسم غير صالح (أحرف وأرقام و - _ . فقط)');
    switchRepo(name);
  };
  async function switchRepo(name) {
    if (name === (getSession()?.repoName || CONFIG.dataRepoName)) return toast('هذا هو الحالي بالفعل');
    if (!confirm(`التبديل إلى «${name}»؟\nسيُحفظ الحالي أولًا، ثم تُجلب بيانات الجديد (أو يُرفع الحالي إليه إن كان فارغًا).`)) return;
    toast('حفظ نسخة من الحالي...');
    await pushNow('fos: backup before switch');
    updateSession({ repoName: name, branch: 'main' });
    toast('جارٍ الجلب من الجديد...');
    await initialSync();
    pRepo(el); toast('تم التبديل ✅');
  }
}

async function runDiag(out) {
  const tok = getToken(), sess = getSession();
  const repo = sess?.repoName || CONFIG.dataRepoName;
  const owner = sess?.login;
  const line = (ok, t) => { out.innerHTML += `<div>${ok ? '✅' : '❌'} ${t}</div>`; };
  out.innerHTML = '';
  if (!tok || !owner) { line(false, 'غير مسجل الدخول — سجّل الدخول أولًا من صفحة الدخول.'); return; }
  try {
    const me = await fetchMe(tok);
    line(true, `الرمز صالح — الحساب: @${esc(me.login)}`);
    if (me.login !== owner) line(false, `الرمز لحساب مختلف (@${esc(me.login)}) عن الجلسة (@${esc(owner)}) — سجّل الخروج والدخول مجددًا.`);
  } catch (e) { line(false, `الرمز مرفوض (401): ${esc(e.message)}. أنشئ رمزًا جديدًا بصلاحية repo.`); return; }
  let info = null;
  try {
    info = await getRepo(tok, owner, repo);
    if (!info) { line(false, `المستودع ${esc(owner)}/${esc(repo)} غير موجود.`);
      try { await ensureDataRepo(tok, owner, repo, true, 'main'); line(true, 'أُنشئ المستودع تلقائيًا ✅'); }
      catch (e2) { line(false, `تعذر الإنشاء: ${esc(e2.message)} — أنشئه يدويًا أو وسّع صلاحيات الرمز.`); return; }
      info = await getRepo(tok, owner, repo);
    } else line(true, `المستودع موجود (${info.private ? 'خاص 🔒' : 'عام 🌍'}) — الفرع: ${esc(info.default_branch)}`);
  } catch (e) { line(false, `تعذر الوصول للمستودع: ${esc(e.message)}`); return; }
  const branch = info?.default_branch || 'main';
  try {
    await readFile(tok, owner, repo, 'settings.json', branch);
    line(true, `القراءة من الفرع ${esc(branch)} تعمل.`);
  } catch (e) { line(false, `فشل القراءة: ${esc(e.message)}`); }
  try {
    const w = await writeRawFile(tok, owner, repo, '.fos-ping.json', '{"ping":1}', 'fos: ping', branch, null).catch(async err => {
      if (err.code === 422) { const cur = await readFile(tok, owner, repo, '.fos-ping.json', branch); return writeRawFile(tok, owner, repo, '.fos-ping.json', '{"ping":2}', 'fos: ping', branch, cur.sha); }
      throw err;
    });
    await deleteFile(tok, owner, repo, '.fos-ping.json', w.content.sha, 'fos: ping cleanup', branch);
    line(true, 'الكتابة والحذف تعمل ✅ — المزامنة يجب أن تنجح. اضغط إعادة المحاولة.');
  } catch (e) { line(false, `فشل الكتابة: ${esc(e.message)} — الرمز يحتاج صلاحية Contents (كتابة).`); }
}
