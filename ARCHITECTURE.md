# Architecture — Marketing Automation Platform (MAP)

> Bản đồ kiến trúc theo **vòng đời MAP 6 lớp**, ánh xạ với codebase hiện tại,
> đánh dấu khoảng trống (gap) và roadmap triển khai. Đây là tài liệu định hướng
> (living doc) — cập nhật khi mỗi lớp được hoàn thiện.

## Bối cảnh

UrBox MAP biến hệ thống "CRM email automation" thành một **nền tảng tự động hoá
marketing theo vòng đời khách hàng**: dữ liệu KH (CDP-lite) → phân khúc → điều phối
journey → gửi đa kênh (có Zalo ZNS + voucher) → đo lường & attribution về doanh thu
loyalty. HubSpot là **một nguồn/đích** (connector), không phải lõi.

**Trạng thái tổng thể (sau roadmap A→D):** đã có **v1 chạy được của cả 6 lớp** —
compliance gate (consent + suppression), segmentation engine (static/dynamic), journey
builder (send/wait/exit), delivery đa kênh (email/SMS/Zalo ZNS, simulated) + voucher +
frequency cap, và MEASURE (funnel + attribution ROI). Toàn bộ chạy trên dual backend
(Postgres + in-memory) với admin UI.

**Phase 2 (đã build v1):** real open/click tracking (pixel/redirect), scheduler auto-dispatch
scheduled campaign, dispatch adapters (email qua HubSpot / SMS+Zalo qua webhook, fallback
simulated) + bounce→suppress, identity resolution (merge duplicate), RBAC (API key + role,
opt-in `REQUIRE_AUTH`), HubSpot engagement write-back (adapter).

**Còn lại thật sự (cần infra/creds/ops, không code trong repo được):** credential HubSpot/
SMS/Zalo thật để dispatch & write-back chạy thật; SPF/DKIM DNS + bounce feed từ provider;
journey wait-step worker (per-member enrollment timers); login UI cho RBAC. Các phần
"simulated" đánh dấu `TODO(real)` trong code.

Chú thích trạng thái: ✅ v1 có · 🟡 một phần · ⬜ chưa có.

## Tech stack hiện tại

- **Backend:** Node ≥20, TypeScript (ESM), Express 5, Zod, `pg` (Postgres/Supabase).
- **Data backend kép:** Postgres khi có `DATABASE_URL`; ngược lại **in-memory** (ephemeral)
  để chạy UI không cần DB — `src/db/memory.ts`, chọn impl qua cờ `useInMemory`.
- **Frontend:** React + Vite + TS SPA (`web/`), tự vẽ chart bằng SVG/CSS (không thư viện).
- **Multi-tenant:** mọi bảng nghiệp vụ mang `tenant_id`; credential provider lưu per-tenant
  trong `channel_connections` (không phải env toàn cục).

## Ánh xạ 6 lớp → codebase

| Lớp | Mục tiêu | Trạng thái | Hiện thực (file) | Gap còn lại |
|---|---|---|---|---|
| **1. DATA** | CDP-lite: ingest contact/lead/status + behavioral event, unified profile, identity resolution, **Consent center** | 🟡 | `core/contacts/*`, `channels/hubspot/*` (sync out), `webhooks/router.ts` (sync in), **`core/compliance/consent.*` (consent center ✅)** | behavioral events đầy đủ, identity resolution |
| **2. TARGET** | Static list + **dynamic segment** | ✅ | `core/segments/*`, `services/segment.service.ts` (resolveMembers, static + dynamic theo lifecycle) | rule nâng cao (theo behavior/event) |
| **3. ORCHESTRATE** | Journey: Trigger→Condition→Action, multi-step, wait/delay, A/B, exit | ✅ | `core/journeys/*` (graph: trigger/nodes/edges + templates), `services/journey.service.ts` (engine nhánh if/else), **web Workflows canvas (react-flow)** kéo-thả self-service | A/B split, time-based trigger auto-dispatch (journey worker) |
| **4. DELIVER** | email/SMS/push/**Zalo ZNS** + personalization + **voucher injection** + frequency cap/STO/throttle | 🟡 | `deliver/channel.ts` (email/SMS/**Zalo** registry), `deliver/delivery.service.ts` (gate + **frequency cap** + **voucher inject** + dispatch mô phỏng) | provider dispatch thật, send-time optimization |
| **5. MEASURE** | open/click/conversion, funnel, **attribution → redemption** | 🟡 | `core/events/*`, `services/analytics.service.ts` (funnel + **attribution ROI**), dashboard funnel/ROI | open/click tracking thật (pixel/link), journey funnel |
| **6. FOUNDATION** | HubSpot connector, **Decree 13 + suppression**, RBAC, audit, deliverability | 🟡 | `channels/*` (connector in/out), **`core/compliance/suppression.*` ✅**, multi-tenant, `sync_log` | **RBAC/auth**, deliverability infra, HubSpot write-back |

## Chi tiết từng lớp

### 1. DATA — Lớp dữ liệu khách hàng (nền móng)
- **Có:** `contacts` (attribute + `lifecycle_stage` + `external_ids` map provider→id), upsert theo
  (tenant, email); HubSpot sync 2 chiều — push (`HubSpotChannel.pushContact`) và inbound webhook
  (`webhooks/router.ts` → `contactRepository.upsertByEmail`).
- **Gap:** chưa có **event store** cho behavioral event (mở app, giao dịch, abandon từ app/Zalo/web);
  profile chưa gồm behavior; chưa có **identity resolution/dedup** ngoài unique email; **chưa có
  Consent & preference center** — đây là *gate pháp lý*, không phải feature phụ.

### 2. TARGET — Segmentation engine
- **Có:** nhắm mục tiêu campaign bằng **một** filter `lifecycle_stage` (hoặc tất cả).
- **Gap:** `segments` như một entity (static list + **dynamic segment** tự cập nhật theo
  attribute/behavior/lifecycle). Nguyên tắc: *mọi journey bắt đầu từ segment*.

### 3. ORCHESTRATE — Journey/Campaign builder (trái tim MAP)
- **Có:** **Workflow canvas kéo-thả** (web `pages/Workflows.tsx`, react-flow) cho Marketing
  Operator tự dựng: trigger (vào segment) → node send/wait/**condition (if/else)**/update/
  webhook/exit, nối nhánh yes/no. Engine graph (`journey.service.ts`) chạy mô phỏng, đếm số
  người qua từng node theo nhánh (điều kiện: đã mở/đã click/lifecycle). Templates (Welcome,
  Win-back) để clone, Save/Run/Activate/Pause. Campaign builder cho gửi 1 lần.
- **Gap:** A/B split node; trigger theo event/time tự kích hoạt (cần journey worker — scheduler
  hiện auto-dispatch scheduled campaign, chưa advance journey theo thời gian).

### 4. DELIVER — Channel & message layer
- **Có:** gửi email qua HubSpot transactional single-send (`email.service.ts`); template +
  merge field. **Lưu ý:** "send" của campaign hiện **mô phỏng** (`campaign.service.ts › markSent`);
  chỉ luồng onboarding mới thực gọi HubSpot.
- **Gap:** trừu tượng **MessageChannel** riêng (tách khỏi `CrmChannel` vốn dành cho CRM sync);
  **Zalo ZNS/OA** (bắt buộc VN), SMS, push; **voucher/offer injection** (đặc thù UrBox);
  frequency capping, send-time optimization, throttling.

### 5. MEASURE — Analytics & attribution
- **Có:** `sync_log` (audit CRM sync) + dashboard (KPI counts, contacts theo lifecycle,
  campaigns theo status).
- **Gap:** tracking **open/click/conversion**, journey funnel, kết quả A/B; **attribution về
  redemption/transaction** để nối marketing ↔ doanh thu loyalty (chỗ chứng minh ROI).

### 6. FOUNDATION
- **Có:** HubSpot connector (inbound webhook + outbound push), connection per-tenant, multi-tenant
  isolation, audit `sync_log`, migration runner (`db/migrate.ts`).
- **Gap:** **suppression list**, tuân thủ **Decree 13/2023/ND-CP** (consent + xoá/ẩn dữ liệu),
  **RBAC**, audit toàn diện hơn, deliverability infra (SPF/DKIM/bounce handling).

## ⚠️ Cổng tuân thủ (chặn DELIVER lên production)

Spec đánh dấu **Consent & Decree 13 là *gate pháp lý***, không phải feature. Trước khi chuyển
campaign từ "mô phỏng" sang **gửi thật**, BẮT BUỘC có: consent/preference center (lớp 1) +
suppression list (lớp 6). Gửi khi chưa có 2 cái này = rủi ro tuân thủ.

## Roadmap đề xuất (phân phase)

| Phase | Hạng mục | Lớp | Trạng thái |
|---|---|---|---|
| **A** | Consent/preference + suppression list | 1, 6 | ✅ v1 (gate enforce trong delivery) |
| **B** | Segmentation engine (static + dynamic) → Journey builder (send/wait/exit) | 2, 3 | ✅ v1 (branch/A-B/time-trigger để Phase 2) |
| **C** | MessageChannel abstraction + **Zalo ZNS** + **voucher injection** + frequency cap | 4 | ✅ v1 (transports simulated) |
| **D** | Event tracking + funnel + **attribution → redemption** | 5 | ✅ v1 (open/click qua tracking endpoint / mô phỏng) |
| **2A** | Real open/click tracking (pixel + redirect) | 5 | ✅ v1 |
| **2B** | Scheduler auto-dispatch (scheduled campaigns) | 3 | ✅ v1 (journey-wait worker còn lại) |
| **2C** | Dispatch adapters (email/SMS/Zalo) + bounce→suppress | 4, 6 | ✅ v1 (real khi có creds/webhook) |
| **2D** | Identity resolution (merge duplicate) | 1 | ✅ v1 |
| **2E** | RBAC (API key + role, opt-in) | 6 | ✅ v1 (login UI còn lại) |
| **2F** | HubSpot engagement write-back | 6 | ✅ v1 (real SDK call = TODO) |
| **Còn lại** | Creds thật, SPF/DKIM DNS, journey-wait worker, login UI | — | ⬜ ops/infra |

> Tất cả v1 build & verify trên in-memory backend, commit từng phần. "Simulated" =
> không gọi provider thật / không delay thật; logic nghiệp vụ (gate/segment/funnel/
> attribution/RBAC/merge) là thật và đã verify.

## Cấu trúc module mục tiêu (khi refactor)

Hiện code tổ chức theo `core/` + `services/` + `channels/`. Khi muốn khớp 1-1 với 6 lớp, đề xuất
gom theo module vòng đời (giữ `CrmChannel` cho FOUNDATION, tách `MessageChannel` cho DELIVER):

```
src/
  data/         # 1 — profiles, events, identity, consent
  target/       # 2 — segments (static + dynamic)
  orchestrate/  # 3 — journeys, campaigns, triggers
  deliver/      # 4 — message channels (email/SMS/Zalo), templating, voucher, capping
  measure/      # 5 — tracking, funnel, attribution
  foundation/   # 6 — connectors (HubSpot), suppression, RBAC, audit, deliverability
```

*(Refactor cấu trúc là một bước riêng — chưa thực hiện trong tài liệu này.)*
