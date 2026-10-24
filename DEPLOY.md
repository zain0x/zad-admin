# نشر لوحة زاد على CloudPanel (Contabo)

مشروع Next.js 15 يعمل بـ Node 22 على المنفذ 3001، مع MySQL 8، ويدار بـ PM2.

## 1) DNS
أضف سجل `A` للدومين (أو النطاق الفرعي) يشير إلى IP سيرفر Contabo.

## 2) إنشاء الموقع في CloudPanel
**Sites ← Add Site ← Create a Node.js Site**
- Domain Name: دومين اللوحة
- Node.js Version: 22
- App Port: `3001`

ثم من تبويب **SSL/TLS ← Actions ← New Let's Encrypt Certificate**.

## 3) قاعدة البيانات
**Databases ← Add Database**: اسم القاعدة `zad_admin`، ومستخدم بكلمة سر قوية.
احفظ البيانات لملف البيئة.

## 4) رفع الكود
ادخل SSH بمستخدم الموقع (يظهر في صفحة الموقع في CloudPanel):
```bash
cd ~/htdocs/<domain>
git clone https://github.com/zain0x/zad-admin.git .
```

## 5) ملف البيئة
```bash
nano .env
```
```
DATABASE_URL="mysql://<db_user>:<db_password>@127.0.0.1:3306/zad_admin"
AUTH_SECRET="<openssl rand -base64 48>"
```
> استخدم `AUTH_SECRET` جديداً للسيرفر (ليس نفس الذي على جهازك)، واحفظه في مكان آمن.

## 6) التثبيت والبناء
```bash
npm ci
npx prisma migrate deploy
npm run build
npm run create-admin -- you@example.com "اسمك"
```

## 7) التشغيل الدائم بـ PM2
```bash
npm install -g pm2
pm2 start npm --name zad-admin -- start
pm2 save
pm2 startup     # انسخ الأمر الذي يطبعه ونفّذه (مرة واحدة)
```

## 8) تحديث بعد أي تعديل
```bash
cd ~/htdocs/<domain>
git pull
npm ci
npx prisma migrate deploy
npm run build
pm2 restart zad-admin
```

## 9) الحماية (لا تتخطاها)

### تقييد الدخول على IP
**Sites ← الموقع ← Vhost**، داخل كتلة `location /`:
```nginx
allow <IP المكتب>;
deny all;
```
وفي المرحلة 2 نضيف استثناء لـ IP سيرفر OVH على مسار `/api/ingest` فقط.

### السيرفر
- **Security ← Firewall**: قيّد المنفذ 8443 (لوحة CloudPanel) والمنفذ 22 (SSH) على IP المكتب.
- SSH بالمفاتيح فقط: `PasswordAuthentication no` في `/etc/ssh/sshd_config`.
- تحديثات أمنية تلقائية:
  ```bash
  sudo apt install unattended-upgrades && sudo dpkg-reconfigure unattended-upgrades
  ```

### النسخ الاحتياطي
- **Backups ← Remote Backups** في CloudPanel: للملفات والقاعدة إلى مكان خارج السيرفر (S3، Dropbox...).
- Snapshot من لوحة Contabo قبل أي تحديث كبير.

## 10) الفحص الدوري للإيميلات (Cron)
في `.env` على السيرفر أضف `HIBP_API_KEY` (نفس مفتاح zad-landing) و`CRON_SECRET` (من `openssl rand -hex 32`).

ثم **Cron Jobs ← Add Cron Job** في CloudPanel، كل ساعة (`0 * * * *`):
```bash
curl -s -X POST -H "Authorization: Bearer <CRON_SECRET>" http://127.0.0.1:3001/api/cron/email-monitor
```
كل تشغيل يفحص حتى 25 إيميلاً حان موعدها (أسبوعي أو شهري حسب كل إيميل)، وما لم يُفحص يُكمل في الساعة التالية.

## فحص سريع بعد النشر
```bash
curl -s https://<domain>/api/health    # {"ok":true}
curl -sI https://<domain>/login | grep -i x-robots-tag
pm2 logs zad-admin --lines 50
```
