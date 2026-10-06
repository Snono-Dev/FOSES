# 📚 فوسيز FOSES — نظّم دراستك

**FOSES = Free Open Source E-School** — مدرسة إلكترونية مجانية مفتوحة المصدر.

منصة دراسة شخصية **مجانية 100%** تعمل على **GitHub Pages** بدون أي Backend مدفوع.
بيانات كل مستخدم تُخزَّن في **Repo خاص به** (`fos-study-data`) كملفات JSON + نسخة محلية Offline في المتصفح.

## ✨ المزايا
- مواد ← فصول ← مواضيع ← دروس + ملاحظات + مفضلة + إكمال
- امتحانات (MCQ / صح-خطأ / نصي) + نتائج + أفضل نتيجة + محاولات — محفوظة في Repo
- Dashboard + تقدم كل مادة + Streak + XP ومستويات + شارات
- مؤقت Pomodoro (25/5، 50/10، مخصص) يسجّل الدقائق وXP
- تقويم مواعيد (درس/امتحان/مراجعة) محفوظ في Repo
- استيراد منهج JSON مع فحص ومعاينة ودمج/استبدال + تصدير نسخة احتياطية
- PWA حقيقي: manifest + service worker + offline + تثبيت + RTL + Dark mode + Mobile-first

## 🏗️ البنية
```
index.html 404.html manifest.webmanifest sw.js
css/styles.css
js/ app.js router.js shell.js i18n.js ui.js
    config.js models.js store.js auth.js github.js sync.js
    pages/ dashboard.js study.js exams.js tools.js system.js
data/example-curriculum.json
.github/workflows/ pages.yml validate-data.yml
```
- `store.js`: المصدر المحلي (localStorage offline-first)
- `github.js`: wrapper لـ GitHub REST (repo ensure + read/write مع SHA)
- `sync.js`: سحب عند الدخول + دفع debounced بعد 2.5s + معالجة تعارض (إعادة المحاولة بـ SHA جديد) + مزامنة عند عودة الإنترنت
- `auth.js`: دخول آمن بدون Secret

## 🔐 المصادقة — نقطة أمنية مهمة
**لا يمكن عمل OAuth Code Flow كلاسيكي من GitHub Pages بأمان** لأنه يتطلب `client_secret` في سيرفر، ووضعه في Frontend يكشفه للجميع.
لذلك يدعم التطبيق (بدون أي سيرفر مدفوع):

1. **Fine-grained PAT (موصى به)**: المستخدم يولّد توكن من `github.com/settings/tokens` بصلاحية Contents على ريبو البيانات فقط ويلصقه. التوكن لا يغادر المتصفح إلا نحو `api.github.com`. أقل صلاحيات ممكنة ✅
2. **Device Flow (بدون لصق)**: أنشئ OAuth App وفعّل *Enable Device Flow* ثم أدخل الـ `Client ID` العلني فقط في صفحة الدخول — لا Secret إطلاقًا.
3. **وضع تجريبي**: يعمل محليًا بدون حساب.

> أي حل يدّعي OAuth كامل من Frontend خالص إما يكشف Secret (غير آمن) أو يحتاج وسيطًا. القالب الاختياري لـ Cloudflare Worker **غير مضمّن افتراضيًا** التزامًا بشرط "لا خدمات خارج GitHub".

## 📁 مخزن بيانات المستخدم
عند أول دخول: `GET /repos/{user}/fos-study-data` → إن لم يوجد `POST /user/repos` (خاص افتراضيًا) ثم تُرفع الملفات:
```
subjects.json curriculum.json exams.json results.json
progress.json sessions.json events.json settings.json achievements.json
```
كل تعديل = commit → تحصل تلقائيًا على Git history + Backup + Rollback + Export.

## 🚀 التشغيل محليًا
```powershell
# أي سيرفر استاتيكي
npx serve .
# أو
python -m http.server 8080
```
افتح `http://localhost:8080` — سجّل كضيف أو بالتوكن.

## 🌍 النشر على GitHub Pages
1. ادفع هذا الريبو إلى `USERNAME.github.io` أو أي ريبو ثم `Settings → Pages → Source: GitHub Actions`.
2. ملف `.github/workflows/pages.yml` ينشر تلقائيًا عند Push على `main`.
3. الرابط سيكون `https://USERNAME.github.io/REPO/`.

## 📥 صيغة استيراد المنهج
انظر `data/example-curriculum.json`. الصفحة تفحص الأخطاء قبل الاستيراد وتعرض معاينة.

## ⚠️ Rate limits والأخطاء
- الـ wrapper يحذر عند انخفاض `x-ratelimit-remaining` ويعرض رسالة عند 403.
- فشل الشبكة = بقاء البيانات محليًا + إعادة المحاولة عند `online` — لا فقدان بيانات.

## 🤝 المساهمة
PRs مرحب بها. ملفات المناهج المثال تُفحص آليًا عبر `validate-data.yml`.

## 🔔 تنبيهات الهاتف (مجانية 100%)

ثلاث طبقات بدون أي سيرفر مدفوع:

1. **تنبيه فوري** والمتصفح مفتوح (Notification API + إذن من الإعدادات).
2. **مزامنة خلفية دورية** للـ PWA المثبت على أندرويد (Periodic Sync — best effort، يقرأ نسخة التذكيرات من IndexedDB).
3. **دفع يومي عبر GitHub Actions** (يعمل وهاتفك مغلق): من الإعدادات ← تنبيهات الهاتف: ولّد مفاتيح VAPID، اشترك الجهاز، ثبّت ملفات `push/` في مستودع بياناتك، أضف السر `FOSES_VAPID_PRIVATE`، وشغّل `foses-push` يدويًا (test: true) للاختبار. المرسل `push/send-push.mjs` بدون أي مكتبات (Web Push + VAPID بـ WebCrypto).

## 📄 الرخصة
AGPL-3.0 — انظر `LICENSE`. أي نشر أو تشغيل عام لنسخة معدلة يتطلب إتاحة الكود المصدري (بند الشبكة في AGPL).
