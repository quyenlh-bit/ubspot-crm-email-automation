# ubspot-crm-email-automation

HubSpot CRM email automation. Three capabilities in one service:

1. **Automated email** — send transactional emails via HubSpot's single-send API.
2. **Contact sync + automation** — upsert contacts into HubSpot CRM and orchestrate cross-system workflows.
3. **Webhook listener** — receive and verify HubSpot webhooks, then trigger actions.

> **Note on the name:** the project targets **HubSpot**. The repo name `ubspot-…` keeps the original spelling.

## Tech stack

- Node.js ≥ 20 + TypeScript (ESM)
- Express 5 (HTTP + webhook receiver)
- `@hubspot/api-client` (official SDK)
- `zod` (env validation)

## Getting started

```bash
# 1. Install dependencies
npm install

# 2. Configure secrets
cp .env.example .env
#    then fill in HUBSPOT_ACCESS_TOKEN, HUBSPOT_APP_SECRET, etc.

# 3. Run in watch mode
npm run dev
```

Server starts on `http://localhost:3000`.

### HubSpot setup

1. Create a **Private App** in HubSpot (Settings → Integrations → Private Apps) and copy its access token into `HUBSPOT_ACCESS_TOKEN`. Grant scopes: `crm.objects.contacts.read/write`, `transactional-email`.
2. Create a **transactional email** asset and put its ID in `HUBSPOT_TRANSACTIONAL_EMAIL_ID`.
3. For webhooks: configure the app's webhook subscriptions to `POST {PUBLIC_BASE_URL}/webhooks/hubspot` and set `HUBSPOT_APP_SECRET` to the app's client secret (used for signature verification).

## Scripts

| Command | What it does |
|---|---|
| `npm run dev` | Run with hot reload (tsx watch) |
| `npm run build` | Compile TypeScript → `dist/` |
| `npm start` | Run compiled output |
| `npm run typecheck` | Type-check without emitting |

## Endpoints

| Method | Path | Purpose |
|---|---|---|
| `GET` | `/health` | Liveness check |
| `POST` | `/webhooks/hubspot` | HubSpot webhook receiver (signature-verified) |
| `POST` | `/trigger/onboarding` | Manually run the onboarding workflow — `{ "email": "...", "firstname": "..." }` (demo; remove in prod) |

## Project structure

```
src/
├── index.ts                 # Express app + entry point
├── config/env.ts            # Validated environment config
├── hubspot/client.ts        # Shared HubSpot API client
├── services/
│   ├── email.service.ts     # Use case 1: send transactional email
│   ├── contact.service.ts   # Use case 2: upsert/fetch contacts
│   └── automation.service.ts# Use case 3: cross-system workflows
├── webhooks/
│   ├── router.ts            # Webhook endpoint + event routing
│   └── verify.ts            # HubSpot v3 signature verification
└── utils/logger.ts          # Structured logger
```

## Security notes

- **Never commit `.env`** — it is gitignored. Only `.env.example` is tracked.
- Webhook requests are rejected unless their `X-HubSpot-Signature-V3` is valid and the timestamp is within 5 minutes (replay protection).
- Remove the `/trigger/onboarding` demo endpoint before production.
