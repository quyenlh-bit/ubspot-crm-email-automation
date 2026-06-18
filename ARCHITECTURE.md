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

**Còn lại (Phase 2 / production):** tích hợp provider thật (HubSpot transactional / SMS
gateway / Zalo ZNS API), scheduler/worker để auto-dispatch journey & scheduled campaign,
real open/click tracking (pixel/link), identity resolution, RBAC/auth, deliverability infra
(SPF/DKIM/bounce), HubSpot engagement write-back. Các phần "simulated" được đánh dấu rõ
trong code (TODO).

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
| **3. ORCHESTRATE** | Journey: Trigger→Condition→Action, multi-step, wait/delay, A/B, exit | 🟡 | `core/journeys/*`, `services/journey.service.ts` (enrol segment → send/wait/exit, run mô phỏng), `services/campaign.service.ts` | branch/condition, A/B split, time-trigger, auto-dispatch (worker) |
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
- **Có:** Campaign builder **1 bước** (audience + template + schedule + gửi *mô phỏng*);
  onboarding workflow viết cứng (`automation.service.ts`).
- **Gap:** **journey engine** dạng `Trigger → Condition/branch → Action`: trigger từ status change
  HubSpot / behavioral event / time / entry-vào-segment / lifecycle milestone; multi-step,
  wait/delay, A/B split, exit condition.

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
| **Phase 2** | Provider dispatch thật, scheduler/worker, real open/click tracking, identity resolution, RBAC/auth, deliverability infra, HubSpot write-back | tất cả | ⬜ chưa làm |

> v1 A→D đã build & verify trên in-memory backend. "Simulated" = không gọi provider
> thật / không có delay thật; logic gate/segment/funnel/attribution là thật.

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
