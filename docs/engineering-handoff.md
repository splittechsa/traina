# Traina — موجز بنية تحتية وطريقة عمل (لهندسة التطوير)

**المنتج:** Traina (سابقاً Sahhti في أجزاء من الكود)  
**المستودع:** `splittechsa/traina`  
**اللغة الأساسية للواجهة:** العربية · RTL  
**تاريخ الموجز:** أكتوبر 2026  

هذا المستند يصف **ما هو منفَّذ حالياً** وكيف يتدفق العمل — لإرساله لمهندس تطوير دون الاعتماد على محادثات سابقة.

---

## 1) فكرة المنتج (Product spine)

| الطبقة | الدور |
| --- | --- |
| **يزن (Yazan)** | المنتج الأساسي: مدرب AI مبني على العلم، يتابع المتدرب يومياً |
| **التسجيل اليومي** | بنية تحتية للإدخال (موية، طعام، جلسات، مكملات، وزن) — يزن يقرأها |
| **Onboarding** | **المصدر الوحيد** لبيانات الملف (عمر، جنس، طول، وزن، أهداف، نشاط، وتيرة…) |
| **استطلاع أسبوعي** | المتدرب يرفع استطلاعاً → ملف يُجهَّز لمدرب بشري |

قيود علمية ملزمة في النطاق:

- لا اختراع سعرات محروقة / صوديوم / أطباق بدون مغذيات معلنة.
- أهداف السعرات السلطوية من السيرفر مرفوضة حتى تُعتمد معادلة (`authoritativeTargetFromFormula`).
- تغيير الخطة الغذائية/البرنامج = اقتراح يحتاج تأكيد العضو (لا تعديل صامت).

---

## 2) خريطة المستودع (Monorepo)

```text
app/                          # تراث قديم — لا يُبنى للنشر
apps/mobile/                  # تطبيق Expo (المنتج الذي يُشحن)
packages/
  domain/                     # قواعد العمل النقية (@sahhti/domain)
  contracts/                  # Zod schemas للـ API (@sahhti/contracts)
  design-tokens/              # توكنات تصميم
services/api/                 # Fastify API (@sahhti/api)
database/migrations/          # SQL تراكمي (Neon/Postgres)
docs/                         # ADRs + runbooks + هذا الموجز
```

**ملاحظة أسماء الحزم:** ما زالت `@sahhti/*` في npm workspaces بينما العلامة التجارية Traina.

**Node:** `>=22`  
**Workspaces:** `packages/*` + `services/*`  
**تطبيق الموبايل:** خارج workspace الجذر؛ يُبنى من `apps/mobile` مباشرة (Expo).

---

## 3) الطبقات وكيف تتكلم

```text
┌─────────────────────────────────────────────┐
│  apps/mobile (Expo Router · React Native)   │
│  EXPO_PUBLIC_API_URL → http(s)://host:3040  │
└─────────────────────┬───────────────────────┘
                      │ HTTPS/HTTP JSON + Bearer
┌─────────────────────▼───────────────────────┐
│  services/api (Fastify · /v1/*)             │
│  auth session · member store · coach        │
└─────────────────────┬───────────────────────┘
                      │
        ┌─────────────┼─────────────┐
        ▼             ▼             ▼
  packages/     Postgres/Neon   Coach model
  domain +      migrations      (optional
  contracts                     openai_compatible)
```

| طبقة | مسؤولية |
| --- | --- |
| `@sahhti/domain` | Validation، حسابات، سياسات يزن/تغذية/تدريب — بدون I/O |
| `@sahhti/contracts` | أشكال الطلبات (Zod) على حدود الـ API |
| `@sahhti/api` | Auth، تخزين، مسارات، مزوّد المدرب، ترحيل |
| `apps/mobile` | UI، SecureStore محلي، استدعاءات API |

---

## 4) البنية التحتية للتشغيل

### 4.1 قاعدة البيانات

- **Postgres** (إنتاج/تطوير: غالباً Neon).
- migrations في `database/migrations/00xx_*.sql` تُطبَّق عبر:
  ```bash
  npm run migrate
  # أو: node services/api/dist/migrate.js
  ```
- `DATABASE_URL` = pooled  
- `DATABASE_URL_UNPOOLED` = للـ migrate مباشرة  

### 4.2 المصادقة (Auth)

| الشرط | النتيجة |
| --- | --- |
| DB + `SAHHTI_TOKEN_SECRET` | `auth: "session"` — تسجيل/دخول يعمل |
| بدون سر التوكن | `auth: "unconfigured"` — التطبيق يظهر «تسجيل الدخول غير مفعّل» |

مسار الهوية تقريباً:

1. `POST /v1/auth/register` → بريد تحقق  
2. `POST /v1/auth/verify`  
3. `POST /v1/auth/login` → access + refresh  
4. الطلبات المحمية: `Authorization: Bearer <access>`  

في التطوير يمكن قراءة صندوق البريد عبر `GET /v1/dev/mailbox` (غير إنتاج).

### 4.3 متغيرات بيئة حرجة (جذر المستودع `.env` — لا تُرفع)

```bash
NODE_ENV=development
PORT=3040
DATABASE_URL=...
DATABASE_URL_UNPOOLED=...
SAHHTI_TOKEN_SECRET=...          # إلزامي للدخول
SAHHTI_AUTH_MODE=session

# اختياري — محادثة يزن الحرة
SAHHTI_COACH_PROVIDER=openai_compatible
SAHHTI_COACH_API_KEY=...
SAHHTI_COACH_BASE_URL=...
SAHHTI_COACH_MODEL=...
```

موبايل: `apps/mobile` → `EXPO_PUBLIC_API_URL` (مثال LAN: `http://192.168.x.x:3040`).

### 4.4 أوامر شائعة

```bash
# من جذر المستودع
npm run build
npm test
npm run migrate
npm run dev:api   # أو: node services/api/dist/server.js بعد تحميل .env

# موبايل
cd apps/mobile
npx expo start
```

Health: `GET /v1/health` → `{ live, auth, database }`.

تفاصيل نشر إضافية: `docs/publish.md`.

---

## 5) مسار العضو (كيف يشتغل التطبيق)

### 5.1 Onboarding (مرة واحدة — مصدر الحقيقة)

الشاشة: `apps/mobile/app/(onboarding)/index.tsx`  
API: `POST /v1/onboarding`

يجمع ويخزّن في `user_profiles` (+ snapshot في `onboarding_snapshots`):

- الاسم، العمر، **الجنس**، الطول، الوزن  
- الرياضات، الهدف، الخبرة، الجلسات/الأسبوع، البيئة، النشاط  
- تفضيل غذائي  
- **وتيرة يزن** عند أهداف تنشيف/تضخيم: `sprint | steady | gentle` أو `horizonWeeks`

بعد الحفظ، الموبايل يشتق تقديراً محلياً للماكروز (`SecureStore` / `LOCAL_KEYS.macroTargets`) — **شاشة `/macros` تعرض فقط، لا تعيد جمع البيانات**.

### 5.2 التسجيل اليومي (Input infrastructure)

| الميزة | مسار API تقريبي | ملاحظة |
| --- | --- | --- |
| موية | `GET/POST /v1/water` | هدف محلي اختياري |
| يوميات طعام | `/v1/nutrition/diary`, entries, favorites, copy | slots: breakfast/lunch/dinner/snack |
| جدول وجبات | `GET/PUT /v1/nutrition/meal-plan` + ready-meals | قوالب بمغذيات معلنة أو تخصيص |
| جلسات تمرين | `/v1/training/sessions/*` | وقت مسجّل = سجل التمرين |
| برامج | `/v1/training/programs` + nutrition | مرحلة + pace + maintenance |
| مكملات | `/v1/supplements` | قائمة العضو فقط |
| وزن / مقاسات / نشاط | `/v1/weight`, `/v1/measurements`, `/v1/activity` | حقائق فقط |
| تقدّم | `GET /v1/progress` | أوزان، جلسات، PRs |

انضباط ١٤ يوماً (موية + وجبات): `GET /v1/nutrition/discipline` — يغذي اقتراحات التغذية وتنبيهات يزن.

### 5.3 يزن — المدرب AI

| endpoint | الوظيفة |
| --- | --- |
| `POST /v1/coach/daily-checkin` | رسالة يومية حتمية من اللوقات (مرة/يوم) — تعمل بدون مزوّد نموذج |
| `GET/POST /v1/coach/messages` | محادثة؛ تحتاج `openai_compatible` أو `development_mock` |
| `POST /v1/coach/weekly-brief` | استطلاع + حزمة حقائق → `coach_weekly_briefs` بحالة `queued_for_human` |

Persona النظام: **Yazan / Traina** في `services/api/src/coach/provider.ts`.  
Snapshot الثقة يُبنى في السيرفر (ملف، يوميات، موية، مكملات، مرحلة تغذية، انضباط ١٤ يوم) — النموذج لا يختار `user_id`.

Domain: `packages/domain/src/yazan-coach.ts`, `meal-plan.ts`.

### 5.4 تغذية متكيفة (Traina Training)

ليست عجزاً ثابتاً للجميع:

| Pace / أفق | عجز تنشيفي تقريبي |
| --- | --- |
| sprint (≤٤ أسابيع) | ≈ 1100 kcal |
| steady | ≈ 650 |
| gentle | ≈ 400 |

تضخيم / لياقة: فائض أو عجز خفيف حسب الهدف.  
اقتراح أسبوعي من الوزن + التزام الوجبات/الموية — لا يُطبَّق تلقائياً.

### 5.5 تبويبات الموبايل الأساسية

`home` · `training` · `nutrition` · `progress` · `coach` (يزن) · `community`

شاشات مساعدة: food-log، water، meal-plan، week-report (استطلاع بشري)، supplements، weight، …

---

## 6) قواعد للجداول المهمة

| جدول | غرض |
| --- | --- |
| `users` / sessions | هوية وجلسات |
| `user_profiles` | ملف onboarding (+ sex, nutrition_pace, horizon_weeks) |
| `onboarding_snapshots` | نسخة JSON من كل حفظ |
| `user_goals` | أهداف نشطة |
| `programs` | برنامج نشط + nutrition_phase/pace/maintenance |
| `workout_sessions` / `workout_sets` | تدريب |
| `food_entries` / diary | تغذية |
| `member_meal_plan_*` | خطة يوم وجبات |
| `water_logs` | موية |
| `member_supplements` | مكملات العضو |
| `coach_conversations` / `coach_messages` | محادثة يزن |
| `coach_daily_checkins` | check-in يومي (idempotent) |
| `coach_weekly_briefs` | ملف المدرب البشري |
| `ai_usage` | حصة استخدام النموذج |

ERD أوسع: `docs/architecture/erd.md` (قد يحتاج مزامنة مع migrations الحديثة 0017–0020).

---

## 7) ما هو مدفوع / مجاني (سياسة منتج)

- **مجاني:** تسجيل المدخلات اليومية (موية، طعام، تمارين، مكملات) كبنية تحتية.  
- **مدفوع (Traina Training — رؤية منتج):** التدريب/التغذية الذكية عبر يزن والخطط المتكيفة.  
- التنفيذ التقني للاشتراكات/الدفع موجود جزئياً في docs قديمة؛ شاشات membership في الموبايل كانت stubs وأُزيلت من الإعدادات.

---

## 8) الجودة والاختبارات

```bash
npm test          # domain + contracts + design-tokens + api
# API integration: services/api (vitest + PGlite في بعض الاختبارات)
# Mobile: apps/mobile (vitest لوحدات محددة)
```

سياسات: `docs/quality/test-strategy.md`, ADRs تحت `docs/adr/`  
خاصة: `0004-no-unapproved-coaching`, `0011-auth-fails-closed`, `0015-neon`.

---

## 9) حدود معروفة للمهندس

1. أسماء `@sahhti` vs Traina غير موحّدة بالكامل في الحزم.  
2. مجلدات `app/` و`src/` في الجذر = تراث؛ المنتج الحقيقي `apps/mobile`.  
3. محادثة يزن الحرة تحتاج مزوّد نموذج؛ check-in اليومي لا يحتاج.  
4. لا يوجد بعد inbox UI كامل للمدرب البشري — الملفات تُخزَّن `queued_for_human`.  
5. لا سعرات سلطوية من السيرفر حتى اعتماد معادلة.  
6. باركودات التمارين في الجيم: أنماط `TRN-*` / `traina:exercise:<uuid>` فقط (لا GTIN مخترع).

---

## 10) ملفات اقرأها أولاً

| الملف | لماذا |
| --- | --- |
| `docs/engineering-handoff.md` | هذا الموجز |
| `docs/publish.md` | Checklist نشر |
| `docs/architecture/product-spine.md` | يزن = المنتج |
| `docs/architecture/ai-coaching.md` | مسار المدرب |
| `packages/domain/src/yazan-coach.ts` | منطق الرسائل اليومية/الأسبوعية |
| `packages/domain/src/meal-plan.ts` | وتيرة العجز/الوجبات الجاهزة |
| `packages/domain/src/onboarding.ts` | عقد الملف |
| `services/api/src/server.ts` | boot + اختيار auth |
| `services/api/src/routes/product.ts` | سطح الـ API |
| `services/api/src/member/store.ts` | تخزين العضو |
| `apps/mobile/app/(onboarding)/index.tsx` | جمع البيانات |

---

## 11) جملة واحدة للتسليم

> Traina تطبيق Expo يتحدث مع Fastify/Postgres؛ onboarding يبني الملف مرة واحدة؛ التسجيل اليومي يغذي يزن؛ يزن يرسل check-in يومي ويحاور ويقترح خططاً علمية مع تأكيد العضو، ويرفع ملفاً أسبوعياً لمدرب بشري.

---

*للأسئلة التشغيلية:* `docs/runbooks/operations.md` · `docs/runbooks/database.md`
