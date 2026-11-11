# FinPilot — AI-Guarded Personal Finance & PayPal Sandbox Copilot

**FinPilot** is a full-stack fintech application built for the **PayPal AI Hackathon**. It combines **real PayPal Developer Sandbox APIs** (`api-m.sandbox.paypal.com`) with **Google Gemini (`gemini-3.8-flash`)** financial intelligence so every checkout, goal contribution, and recurring subscription is evaluated against real-time budget headroom, upcoming bills, and savings goals before money moves.

> FinPilot tracks primary household ledgers in **Indian Rupees (`INR ₹`)** while executing all PayPal Sandbox REST APIs cleanly in **USD (`$`)** using a configurable conversion bridge (`PAYPAL_INR_PER_USD`, default `84.50`), making every flow testable from any PayPal Developer Sandbox account worldwide.

---

## Core PayPal + AI Integration

### 1. PayPal Developer Platform Capabilities (`server/paypalService.ts` + `@paypal/react-paypal-js`)
FinPilot integrates live PayPal Sandbox APIs over HTTPS (no fake checkouts or simulated payment success):

- **OAuth 2.0 Client Credentials & Token Management**:
  - Authenticates with `POST /v1/oauth2/token` (`Basic` client credentials) either from `.env` (`PAYPAL_CLIENT_ID` / `PAYPAL_CLIENT_SECRET`) or dynamically at runtime via the **PayPal Hub** / **Settings** UI (stored only in server memory).
  - Supports `POST /v1/oauth2/token/terminate` (`Refresh Scopes`) so newly enabled developer dashboard scopes take effect immediately.
- **PayPal Orders API v2 + Checkout JS SDK**:
  - `POST /api/paypal/orders` -> `POST /v2/checkout/orders` (`intent: "CAPTURE"`).
  - Embedded directly inside **Analyze a Purchase**, **Financial Goals ("Fund Goal via PayPal")**, and the dedicated **PayPal Hub** using `@paypal/react-paypal-js` (`<PayPalScriptProvider>` + `<PayPalButtons />`), alongside direct Sandbox Buyer approval links (`?paypal_return=order`).
  - `POST /api/paypal/orders/:orderId/capture` -> inspects `GET /v2/checkout/orders/:orderId` and executes `POST /v2/checkout/orders/:orderId/capture`, logging verified captures directly into FinPilot's Transaction Ledger and incrementing linked Goal Vault progress.
- **PayPal Subscriptions API v1**:
  - Dynamically provisions a Catalog Product (`POST /v1/catalogs/products`), Billing Plan (`POST /v1/billing/plans`), and Sandbox Subscription (`POST /v1/billing/subscriptions`) for recurring digital services or automated SIP/goal funding.
  - Supports live status verification (`GET /v1/billing/subscriptions/:id`), automatic synchronization with FinPilot's **Recurring Obligations** tracker, and real API cancellation (`POST /v1/billing/subscriptions/:id/cancel`).
- **PayPal Reporting API v1 (Balances & Transaction Search)**:
  - `POST /api/paypal/sync` queries `GET /v1/reporting/balances` and `GET /v1/reporting/transactions` (with actionable scope diagnostics if Transaction Search is not yet toggled on in the PayPal app dashboard).
- **Live PayPal API Telemetry**:
  - Every outbound request to `api-m.sandbox.paypal.com` (`method`, `endpoint`, HTTP status code, latency in ms, and summary) streams into an inspectable log inside **PayPal Hub**.

### 2. AI Integration (`@google/genai` — `gemini-3.8-flash`)
AI is embedded across both financial decision guardrails and PayPal data enrichment:

- **Pre-Checkout AI Affordability Guardrail (`POST /api/paypal/guardrail`)**:
  - Before generating a PayPal Checkout button, `gemini-3.8-flash` evaluates the purchase/deposit amount against current-month net savings, unallocated budget buffer, upcoming 14-day obligations, and goal timelines, returning a structured `healthy` / `caution` / `stretched` verdict and explanation.
  - When a purchase is flagged `stretched` (over budget buffer), FinPilot requires an explicit guardrail override checkbox before unlocking checkout.
- **AI Enrichment of Synced PayPal Transactions (`POST /api/paypal/sync`)**:
  - Imported PayPal Sandbox transactions are normalized to `INR` and passed to `gemini-3.8-flash` to infer FinPilot spending categories and flag suspicious spikes or anomalies automatically.
- **PayPal-Aware Conversational Copilot (`POST /api/gemini/chat`)**:
  - The AI Assistant receives live `paypalContext` (OAuth status, `inrPerUsd`, captured Sandbox orders, active PayPal subscriptions, and Sandbox wallet balances) alongside ledger metrics.
- **Multimodal Statement Parser, Executive Briefing & Goal Simulator**:
  - Existing Gemini features (`/api/gemini/parse-statement`, `/api/gemini/generate-summary`, `/api/gemini/analyze-goals`) work alongside PayPal activity and gracefully fall back to grounded local calculations if `GEMINI_API_KEY` is omitted.

---

## Architecture Overview

```text
+-------------------------------------------------------------------+
|                     React 19 + TypeScript UI                      |
|  Overview • PayPal Hub • AI Assistant • Transactions • Budgets    |
|  Goals Simulator • Recurring Auto-Pay • Alerts • Settings         |
|  PayPal Checkout Action (@paypal/react-paypal-js PayPalButtons)   |
+---------------------------------+---------------------------------+
                                  | HTTP (/api/*)
+---------------------------------v---------------------------------+
|                 Express.js API Server (server.ts)                 |
|  - Holds all secrets server-side (.env or session memory)         |
|  - /api/paypal/* (OAuth, Guardrail, Orders, Subs, Sync, Logs)     |
|  - /api/gemini/* (Chat, Statement Parser, Summary, Goals)         |
+----------------+----------------------------------+---------------+
                 | HTTPS (OAuth2 + REST APIs)       | @google/genai
+----------------v----------------+   +-------------v---------------+
|   PayPal Developer Sandbox      |   |   Google Gemini API         |
|   https://api-m.sandbox.paypal  |   |   gemini-3.8-flash          |
|   Orders v2 • Subscriptions v1  |   |   Guardrails • Chat • Sync  |
|   Catalog/Plans • Reporting v1  |   |   Multimodal Statements     |
+---------------------------------+   +-----------------------------+
```

---

## Quick Start for Hackathon Judges

### Prerequisites
- **Node.js** v18+ (tested with Node v24) and **npm**
- **Free PayPal Developer Account**: [developer.paypal.com](https://developer.paypal.com) -> **Apps & Credentials** -> **Sandbox** -> copy your app's **Client ID** and **Client Secret**, plus a **Sandbox Personal (Buyer)** test account email/password under **Sandbox Accounts** to approve checkouts.
- *(Optional)* Enable **Transaction Search** on your Sandbox app in developer.paypal.com to test `/v1/reporting/transactions` wallet history sync.
- *(Optional)* **Google Gemini API Key** (`GEMINI_API_KEY`) from [Google AI Studio](https://aistudio.google.com/). *(If omitted, FinPilot runs cleanly with deterministic AI fallbacks for evaluation.)*

### Option A: Configure via `.env` (Recommended for Full Evaluation)

1. Clone the repository and install dependencies:
   ```bash
   git clone https://github.com/venkatasaiaitha-dotcom/finpilot-.git
   cd finpilot-
   npm install
   ```

2. Create a `.env` file from `.env.example`:
   ```env
   GEMINI_API_KEY="your-google-gemini-api-key"
   PAYPAL_CLIENT_ID="your-paypal-sandbox-client-id"
   PAYPAL_CLIENT_SECRET="your-paypal-sandbox-client-secret"
   PAYPAL_MODE="sandbox"
   PAYPAL_INR_PER_USD="84.50"
   APP_URL="http://localhost:3000"
   ```

3. Start the full-stack server (Vite + Express API on port `3000`):
   ```bash
   npm run dev
   ```

4. Open in your browser:
   ```
   http://localhost:3000
   ```

### Option B: Connect PayPal Sandbox Directly in the UI (Zero File Editing)
If you run `npm run dev` without editing `.env`, open **PayPal Hub** (or **Settings & Integrations**) in the left sidebar and paste your **Sandbox Client ID** and **Client Secret** into the **Connect PayPal Sandbox** card. Credentials are verified live against `/v1/oauth2/token` and kept strictly in backend server memory.

---

## Build, Type-Check & Production Commands

```bash
# TypeScript strict check
npm run lint

# Build frontend (Vite) and backend (esbuild -> dist/server.cjs)
npm run build

# Run production build
npm start
```

---

## Key Backend API Routes (`server.ts`)

| Endpoint | Method | Purpose |
| :--- | :--- | :--- |
| `/api/health` | `GET` | Health status of server, Gemini key config, and PayPal Sandbox OAuth |
| `/api/paypal/status` | `GET` | Current Sandbox connection, scopes, orders, subscriptions & API telemetry |
| `/api/paypal/connect` | `POST` | Verify & bind PayPal Sandbox Client ID / Secret at runtime |
| `/api/paypal/refresh-token` | `POST` | Terminate & refresh OAuth token to pick up updated Sandbox app scopes |
| `/api/paypal/guardrail` | `POST` | Evaluate INR/USD spend via `gemini-3.8-flash` before checkout |
| `/api/paypal/orders` | `POST` | Create PayPal Orders v2 checkout order in USD |
| `/api/paypal/orders/:orderId/capture` | `POST` | Inspect & capture buyer-approved PayPal Sandbox order |
| `/api/paypal/subscriptions` | `POST` | Provision Product + Billing Plan + Subscription v1 auto-pay |
| `/api/paypal/subscriptions/:id/cancel` | `POST` | Cancel PayPal Sandbox subscription |
| `/api/paypal/sync` | `POST` | Sync Sandbox Balances & Transactions with Gemini categorization |
| `/api/gemini/chat` | `POST` | Conversational copilot grounded in ledger + PayPal context |
| `/api/gemini/parse-statement` | `POST` | Multimodal bill/statement transaction extraction |
| `/api/gemini/generate-summary` | `POST` | Structured executive monthly briefing |

---

## Tools & Services Used

- **PayPal Developer Platform (Sandbox)**: `@paypal/react-paypal-js` v10, PayPal REST APIs (OAuth 2.0, Orders v2, Catalog Products & Billing Plans, Subscriptions v1, Transaction Search & Balances Reporting v1)
- **AI Model & SDK**: `@google/genai` calling `gemini-3.8-flash`
- **Frontend**: React 19, TypeScript, Vite 8, Tailwind CSS v4, Lucide React
- **Backend**: Node.js, Express 4, `tsx` / `esbuild`
- **Cloud / Auth Integrations**: Firebase Auth (Google Sign-In) & Google Sheets sync

---

## Demo Video Guide (< 3 Minutes)

Suggested walkthrough flow for hackathon judges:
1. **0:00 – 0:25**: Open **Overview** (`http://localhost:3000`) showing live net savings, unallocated budget buffer, and the **PayPal Sandbox Hub** badge.
2. **0:25 – 0:50**: Open **PayPal Hub**, show live OAuth 2.0 connection (`Sandbox` + `Refresh Scopes`) and real outbound PayPal Sandbox API Telemetry.
3. **0:50 – 1:40**: Click **Analyze a Purchase**, test an affordable vs. over-budget item — show the **Gemini 3.8 Flash** guardrail (`caution`/`stretched` warning + safety override), click **Pay with PayPal** (`@paypal/react-paypal-js` Sandbox popup or buyer approval link), approve with a PayPal Sandbox Buyer account, capture, and show the new transaction + `$ USD` amount logged in **Transactions**.
4. **1:40 – 2:20**: Open **Goals** -> click **Fund Goal via PayPal** (or create a **PayPal Auto-Pay Subscription** in **PayPal Hub** -> view it synced in **Recurring Payments** with Cancel/Sync controls).
5. **2:20 – 2:50**: Click **Sync Sandbox Activity** to pull balances/transactions from PayPal Reporting API with Gemini categorization, then ask **AI Assistant** *"Evaluate my PayPal Sandbox orders & subscription spending"*.

---

## License & Security

- Open-source under the **MIT License** — see [`LICENSE`](./LICENSE).
- All sensitive keys (`PAYPAL_CLIENT_SECRET`, `GEMINI_API_KEY`) stay strictly on the Express backend (`server.ts` / `server/paypalService.ts`) and are never exposed in frontend bundles.
- Analytical decision support only; not registered financial, legal, or investment advice.
