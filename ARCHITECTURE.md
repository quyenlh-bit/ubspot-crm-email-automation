# Architecture — Marketing Automation Platform (MAP)

> Bản đồ kiến trúc theo **vòng đời MAP 6 lớp**, ánh xạ với codebase hiện tại,
> đánh dấu khoảng trống (gap) và roadmap triển khai. Đây là tài liệu định hướng
> (living doc) — cập nhật khi mỗi lớp được hoàn thiện.

## Bối cảnh

UrBox MAP biến hệ thống "CRM email automation" thành một **nền tảng tự động hoá
marketing theo vòng đời khách hàng**: dữ liệu KH (CDP-lite) → phân khúc → điều phối
journey → gửi đa kênh (có Zalo ZNS + voucher) → đo lường & attribution về doanh thu
loyalty. HubSpot là **một nguồn/đích** (connector), không phải lõi.

**Trạng thái tổng thể:** đã dựng các *lát cắt mỏng* xuyên DATA → ORCHESTRATE(campaign)
→ DELIVER(email) → MEASURE(dashboard) trên nền multi-tenant ⇒ mức **"campaign blast"**.
Các thành phần định nghĩa nên một MAP thật (segmentation engine, journey orchestration,
Zalo ZNS + voucher injection, attribution, và các cổng pháp lý) **chưa có**.

Chú thích trạng thái: ✅ có · 🟡 một phần · ⬜ chưa có.

## Tech stack hiện tại

- **Backend:** Node ≥20, TypeScript (ESM), Express 5, Zod, `pg` (Postgres/Supabase).
- **Data backend kép:** Postgres khi có `DATABASE_URL`; ngược lại **in-memory** (ephemeral)
  để chạy UI không cần DB — `src/db/memory.ts`, chọn impl qua cờ `useInMemory`.
- **Frontend:** React + Vite + TS SPA (`web/`), tự vẽ chart bằng SVG/CSS (không thư viện).
- **Multi-tenant:** mọi bảng nghiệp vụ mang `tenant_id`; credential provider lưu per-tenant
  trong `channel_connections` (không phải env toàn cục).

## Ánh xạ 6 lớp → codebase

| Lớp | Mục tiêu | Trạng thái | Hiện thực (file) | Gap chính |
|---|---|---|---|---|
| **1. DATA** | CDP-lite: ingest contact/lead/status + behavioral event, unified profile, identity resolution, **Consent center** | 🟡 | `core/domain.ts` (Contact/Tenant), `core/contacts/contact.repository.ts`, `channels/hubspot/*` (sync out), `webhooks/router.ts` (sync in) | behavioral events, behavior trong profile, identity resolution, **consent/preference** |
| **2. TARGET** | Static list + **dynamic segment** | 🟡 | campaign `audienceLifecycleStage` + `campaign.service.ts › resolveRecipients` | segment là entity, dynamic segment (auto theo attribute/behavior/lifecycle) |
| **3. ORCHESTRATE** | Journey: Trigger→Condition→Action, multi-step, wait/delay, A/B, exit | 🟡 | `services/campaign.service.ts` (campaign 1 bước), `services/automation.service.ts` (onboarding hardcode) | **journey engine** (trigger/branch/đa bước/A-B/exit) |
| **4. DELIVER** | email/SMS/push/**Zalo ZNS** + personalization + **voucher injection** + frequency cap/STO/throttle | 🟡 | `services/email.service.ts` (HubSpot single-send), `core/campaigns/templates.ts` (merge `{{firstName}}`) | **Zalo ZNS (bắt buộc VN)**, SMS/push, **voucher injection**, frequency cap/throttle, message-channel abstraction riêng |
| **5. MEASURE** | open/click/conversion, funnel, A/B, **attribution → redemption** | 🟡 | `core/sync/sync-log.repository.ts`, dashboard (`web/src/pages/Dashboard.tsx`) | event tracking, journey funnel, **attribution ROI** |
| **6. FOUNDATION** | HubSpot connector, **Decree 13 + suppression**, RBAC, audit, deliverability | 🟡 | `channels/` (connector in/out), `core/channels/connection.repository.ts`, multi-tenant, `sync_log` | **suppression list, Decree 13, RBAC**, deliverability infra |

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

| Phase | Hạng mục | Lớp | Mở khoá |
|---|---|---|---|
| **A** | Consent/preference + suppression list | 1, 6 | Gửi hợp pháp (Decree 13) — *điều kiện cần* để DELIVER thật |
| **B** | Segmentation engine (static + dynamic) → Journey builder (trigger/branch/đa bước/A-B/exit) | 2, 3 | Nhắm mục tiêu thật + điều phối journey — *giá trị lõi MAP* |
| **C** | MessageChannel abstraction + **Zalo ZNS** + **voucher injection** + frequency cap/throttle | 4 | Reach thị trường VN + lợi thế đặc thù UrBox |
| **D** | Event tracking (open/click/conv) + journey funnel + **attribution → redemption** | 5, 1 | Chứng minh ROI; behavioral event cũng làm giàu lớp DATA |
| **Phase 2** | HubSpot engagement write-back; deliverability infra; RBAC | 6 | Đồng bộ 2 chiều nâng cao, vận hành production |

> Phụ thuộc: B cần segment trước journey; C/D cần event store (một phần của A/D ở lớp DATA).

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
