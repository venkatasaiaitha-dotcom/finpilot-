# FinPilot — AI-Guarded Personal Finance & PayPal Sandbox Copilot

[![License: MIT](https://img.shields.io/badge/License-MIT-emerald.svg)](./LICENSE)

**FinPilot** is a full-stack fintech application built for the **PayPal AI Hackathon**. It combines **live PayPal Developer Sandbox REST APIs + Checkout SDK** (`https://api-m.sandbox.paypal.com`) with **Google Gemini (`gemini-3.8-flash`)** personal finance intelligence so every discretionary purchase, savings goal contribution, and recurring subscription is evaluated against real-time budget headroom and upcoming bills *before* execution.

> **Currency Bridge (`INR ₹ <-> USD $`)**: FinPilot tracks household ledgers, budgets, bills, and goals in **Indian Rupees (`INR ₹`)**, while executing PayPal Sandbox REST Orders and Subscriptions cleanly in **USD (`$`)** using a configurable conversion rate (`PAYPAL_INR_PER_USD`, default `84.50`). That allows judges worldwide to test real checkouts from any PayPal Developer Sandbox account without currency restrictions.

---

## Table of Contents
1. [Problem & Solution](#problem--solution)
2. [How PayPal Technologies Are Integrated](#how-paypal-technologies-are-integrated)
3. [How AI (Gemini) Is Integrated](#how-ai-gemini-is-integrated)
4. [Architecture & Repository Map](#architecture--repository-map)
5. [Security & Secret Restriction](#security--secret-restriction)
6. [Judge Setup & Evaluation Guide](#judge-setup--evaluation-guide)
7. [Step-by-Step Interactive Walkthrough](#step-by-step-interactive-walkthrough)
8. [Backend API Reference](#backend-api-reference)
9. [Tools & Stack](#tools--stack)
10. [Demo Video Script (< 3 Minutes)](#demo-video-script--3-minutes)
11. [License](#license)

---

## Problem & Solution

Consumer checkout flows make it effortless to spend without seeing the downstream impact on monthly cash flow, upcoming recurring bills, or long-term savings goals. **FinPilot** places an **AI Financial Guardrail** directly in front of **PayPal Checkout**, **PayPal Goal Vault Deposits**, and **PayPal Auto-Pay Subscriptions**:

- If a purchase fits comfortably within your unallocated monthly buffer, FinPilot approves checkout seamlessly via `@paypal/react-paypal-js` and logs the verified capture to your ledger.
- If a purchase stretches your cash flow (`stretched` verdict), FinPilot explains the exact Rupee shortfall and goal delay risk, locking PayPal Checkout behind an explicit risk-acknowledgment override.
- Every PayPal capture automatically updates the **Transaction Ledger**, **Budgets**, **Goal Progress**, and **AI Assistant** context without fake payment simulation.

---

## How PayPal Technologies Are Integrated

All PayPal REST calls execute server-side in [`server/paypalService.ts`](./server/paypalService.ts) against `https://api-m.sandbox.paypal.com` (no fake checkouts or simulated success):

1. **OAuth 2.0 Authentication & Token Lifecycle**
   - Authenticates via `POST /v1/oauth2/token` (`client_credentials`) using `.env` or runtime UI submission (`POST /api/paypal/connect`).
   - Supports live token revocation & re-issuance via `POST /v1/oauth2/token/terminate` (`Refresh Scopes`) so newly enabled PayPal Developer dashboard permissions take effect immediately.
2. **PayPal Orders API v2 + Checkout JS SDK (`@paypal/react-paypal-js`)**
   - Backend creates genuine Orders (`POST /v2/checkout/orders`, `intent: "CAPTURE"`) and inspects/captures approved orders (`GET /v2/checkout/orders/:id`, `POST /v2/checkout/orders/:id/capture`).
   - Frontend component [`PayPalCheckoutAction.tsx`](./src/components/PayPalCheckoutAction.tsx) renders `<PayPalScriptProvider>` + `<PayPalButtons />` as well as a direct Sandbox buyer approval fallback (`?paypal_return=order`) embedded inside:
     - **Analyze a Purchase** modal ([`AnalyzePurchaseModal.tsx`](./src/components/AnalyzePurchaseModal.tsx))
     - **Financial Goals -> Fund Goal via PayPal** ([`GoalImpactAnalyzer.tsx`](./src/components/GoalImpactAnalyzer.tsx))
     - **PayPal Hub** ([`PayPalHubView.tsx`](./src/components/views/PayPalHubView.tsx))
   - Captured orders immediately append to [`TransactionLedger.tsx`](./src/components/TransactionLedger.tsx) (complete with Capture ID and `$ USD` value) and increment linked Goal balances.
3. **PayPal Catalog, Billing Plans & Subscriptions API v1**
   - Creates a Service Product (`POST /v1/catalogs/products`), Billing Plan (`POST /v1/billing/plans`), and Sandbox Subscription (`POST /v1/billing/subscriptions`) for automated recurring bills or SIP savings.
   - Syncs subscription state (`GET /v1/billing/subscriptions/:id`) into **Recurring Payments** ([`RecurringSubscriptions.tsx`](./src/components/RecurringSubscriptions.tsx)) and supports live API cancellation (`POST /v1/billing/subscriptions/:id/cancel`).
4. **PayPal Reporting API v1 (Balances & Transaction Search)**
   - **Sync PayPal** queries `GET /v1/reporting/balances` and `GET /v1/reporting/transactions` (surfacing clear dashboard scope instructions if Transaction Search is not yet toggled on for the Sandbox app).
5. **Live API Telemetry Log**
   - Every outbound PayPal REST request (`method`, `endpoint`, HTTP status, latency in `ms`, and summary) streams into an inspectable telemetry table inside **PayPal Hub**.

---

## How AI (Gemini) Is Integrated

Powered by the official Google GenAI SDK (`@google/genai`) targeting `gemini-3.8-flash` (with resilient failover to `gemini-flash-latest`, `gemini-3.1-flash-lite`, and deterministic local fallback if offline):

- **Pre-Checkout AI Affordability Guardrail (`POST /api/paypal/guardrail`)**: Evaluates each purchase or Goal deposit against current-month net savings, remaining budget buffer, upcoming 14-day obligations, and goal targets, returning a `healthy` / `caution` / `stretched` verdict and actionable explanation.
- **PayPal Transaction Enrichment & Anomaly Flagging (`POST /api/paypal/sync`)**: Automatically normalizes imported PayPal Sandbox transactions into `INR`, infers spending categories, and flags unusual spikes.
- **PayPal-Aware Conversational Copilot (`POST /api/gemini/chat`)**: Injects live `paypalContext` (OAuth connection, conversion rate, captured order count, total USD captured, active PayPal subscriptions, and wallet balances) alongside real ledger state.
- **Multimodal Statement Parser, Executive Briefing & Goal Simulator**: Vision/text statement extraction (`/api/gemini/parse-statement`), monthly briefings (`/api/gemini/generate-summary`), and goal acceleration simulations (`/api/gemini/analyze-goals`).

---

## Architecture & Repository Map

```text
+-------------------------------------------------------------------+
|                     React 19 + TypeScript UI                      |
|  Overview • PayPal Hub • AI Assistant • Transactions • Budgets    |
|  Goals Simulator • Recurring Auto-Pay • Alerts • Settings         |
|  PayPalCheckoutAction (@paypal/react-paypal-js PayPalButtons)     |
+---------------------------------+---------------------------------+
                                  | HTTP (/api/*)
+---------------------------------v---------------------------------+
|                 Express.js API Server (server.ts)                 |
|  - Secrets strictly server-side (.env or in-memory runtime keys)  |
|  - /api/paypal/* (OAuth, Guardrail, Orders, Subs, Sync, Logs)     |
|  - /api/gemini/* (Connect, Chat, Parser, Summary, Goals)          |
+----------------+----------------------------------+---------------+
                 | HTTPS (OAuth2 + REST APIs)       | @google/genai
+----------------v----------------+   +-------------v---------------+
|   PayPal Developer Sandbox      |   |   Google Gemini API         |
|   https://api-m.sandbox.paypal  |   |   gemini-3.8-flash          |
|   Orders v2 • Subscriptions v1  |   |   Guardrails • Chat • Sync  |
|   Catalog/Plans • Reporting v1  |   |   Multimodal Statements     |
+---------------------------------+   +-----------------------------+
```

Key files for reviewers:
- [`server.ts`](./server.ts) — Express API routes, Gemini resilience client, AI guardrail, PayPal sync enrichment, and Vite dev/prod server
- [`server/paypalService.ts`](./server/paypalService.ts) — Complete PayPal Sandbox REST client, OAuth token cache/termination, Orders v2, Subscriptions v1, Reporting v1, and telemetry logs
- [`src/services/paypalApi.ts`](./src/services/paypalApi.ts) — Typed frontend API wrapper
- [`src/components/PayPalCheckoutAction.tsx`](./src/components/PayPalCheckoutAction.tsx) — Reusable AI-gated `@paypal/react-paypal-js` Checkout + Redirect component
- [`src/components/views/PayPalHubView.tsx`](./src/components/views/PayPalHubView.tsx) — Dedicated PayPal Sandbox control center, order/subscription tracker & API telemetry viewer
- [`src/components/views/SettingsView.tsx`](./src/components/views/SettingsView.tsx) — Runtime credential verification panels for both **PayPal Sandbox** and **Gemini API**
- [`src/App.tsx`](./src/App.tsx) — Unified state management, `?paypal_return=` redirect capture, goal balance updates, and subscription synchronization

---

## Security & Secret Restriction

- **Zero Secrets in Git**: [`.gitignore`](./.gitignore) strictly blocks `.env`, `.env*` (except safe template [`.env.example`](./.env.example)), `*.pem`, `*.key`, `*.p12`, and `secrets/`.
- **Backend-Only Secrets**: `PAYPAL_CLIENT_SECRET` and `GEMINI_API_KEY` are read exclusively inside the Express backend (`server.ts` / `server/paypalService.ts`) and are **never** bundled into Vite client code or returned in API JSON responses.
- **Public vs. Private Separation**: Only the public PayPal Sandbox `clientId` (needed to render PayPal's official JS SDK buttons) and non-sensitive status flags (`connected`, `hasGeminiKey`, `geminiSource`, `scopes`) reach the browser.
- **Note on Firebase Config**: [`firebase-applet-config.json`](./firebase-applet-config.json) contains public client-side Firebase Web App configuration for optional Google Sign-In / Google Sheets export (not server/admin secrets).

---

## Judge Setup & Evaluation Guide

### Prerequisites
- **Node.js v18+** (tested on Node v24) and **npm**
- **Free PayPal Developer Account**: From [developer.paypal.com](https://developer.paypal.com) -> **Apps & Credentials** -> **Sandbox**, copy your app's **Client ID** and **Client Secret**, plus a **Sandbox Personal (Buyer)** account under **Testing Tools -> Sandbox Accounts** to approve checkouts.
- *(Optional)* Under **Apps & Credentials -> Features**, enable **Transaction Search** if you want to test `/v1/reporting/balances` and `/v1/reporting/transactions` history sync.
- *(Optional)* **Google Gemini API Key** from [Google AI Studio](https://aistudio.google.com/apikey). *(FinPilot stays functional with deterministic fallbacks if omitted.)*

### Option A: Configure via `.env` (Recommended)

```bash
# 1. Clone and install dependencies
git clone https://github.com/venkatasaiaitha-dotcom/finpilot-.git
cd finpilot-
npm install

# 2. Copy template and add your Sandbox + Gemini keys
cp .env.example .env
```

Edit `.env`:
```env
GEMINI_API_KEY="your-google-gemini-api-key"
PAYPAL_CLIENT_ID="your-paypal-sandbox-client-id"
PAYPAL_CLIENT_SECRET="your-paypal-sandbox-client-secret"
PAYPAL_MODE="sandbox"
PAYPAL_INR_PER_USD="84.50"
APP_URL="http://localhost:3000"
```

Start the development server:
```bash
npm run dev
```
Open **`http://localhost:3000`**.

### Option B: Zero-File-Edit In-App Setup
1. Run `npm install && npm run dev` and open `http://localhost:3000`.
2. Open **PayPal Hub** (or **Settings & Integrations**) -> paste your **Sandbox Client ID** and **Client Secret** -> click **Connect Sandbox**.
3. Under **Settings & Integrations -> AI Engine & Decision Support Model**, paste your **Gemini API Key** -> click **Verify & Enable Gemini**.

Keys entered via the UI are verified live and stored strictly in backend server memory for the session.

### Production Build & Type Verification

```bash
# TypeScript strict check
npm run lint

# Build frontend (Vite -> dist/) and backend (esbuild -> dist/server.cjs)
npm run build

# Start production server
npm start
```

### Deploy to Render (Keeping API Keys Private)
This repository includes a [`render.yaml`](./render.yaml) Blueprint configured with `sync: false` for secret keys:
1. Create a new **Web Service** (or **Blueprint**) on [Render](https://render.com) connected to this GitHub repository.
2. Build Command: `npm install --include=dev && npm run build` | Start Command: `npm start` | Health Check Path: `/api/health`.
3. Add your private keys strictly inside **Render Dashboard -> Environment**:
   - `GEMINI_API_KEY`
   - `PAYPAL_CLIENT_ID`
   - `PAYPAL_CLIENT_SECRET`
   - `APP_URL` = your `https://<your-service>.onrender.com` URL (`NODE_ENV=production`, `PAYPAL_MODE=sandbox`, and `PAYPAL_INR_PER_USD=84.50` are pre-set in `render.yaml`).

---

## Step-by-Step Interactive Walkthrough

Once running on `http://localhost:3000`, judges can verify every core workflow in ~3 minutes:

1. **Verify Live Connections**: Open **Overview** and **PayPal Hub** to confirm **PayPal Sandbox** (`Connected`), **INR <-> USD Bridge** (`₹84.50`), and live outbound PayPal OAuth telemetry (`POST /v1/oauth2/token -> 200`).
2. **Test the AI Affordability Guardrail + PayPal Checkout**:
   - Click **Analyze a Purchase** in the header (or use **PayPal Hub -> AI-Guarded Order Executor**).
   - Enter a test item (try both a small amount like `₹4,225` and a large amount exceeding your unallocated buffer).
   - Click **Evaluate with Gemini** to observe `healthy` / `caution` / `stretched` verdicts (with the mandatory override toggle when `stretched`).
   - Click the **PayPal** button (`@paypal/react-paypal-js`) or open the Sandbox Approval Link, log in with a **Sandbox Personal Buyer** account, approve payment, and capture -> verify the transaction immediately appears in **Transactions** under the **PayPal** filter with Capture ID and `$ USD` value.
3. **Fund a Financial Goal via PayPal**: Open **Goals**, click **Fund Goal via PayPal**, complete a capture, and verify the Goal progress bar increments automatically.
4. **Create & Govern a PayPal Auto-Pay Subscription**: In **PayPal Hub -> Recurring Subscriptions v1**, create a monthly plan (creates a real Product + Billing Plan + Subscription), inspect/sync status, then visit **Recurring Payments** and test **Sync** / **Cancel PayPal**.
5. **Ask the PayPal-Aware AI Assistant**: Open **AI Assistant** and click *"Evaluate my PayPal Sandbox orders & subscription spending"* to see live context-aware analysis.

---

## Backend API Reference

| Endpoint | Method | Purpose |
| :--- | :--- | :--- |
| `/api/health` | `GET` | Health status, `hasGeminiKey`, `geminiSource`, and `paypalSandboxConnected` |
| `/api/gemini/connect` | `POST` | Verify & activate runtime `GEMINI_API_KEY` in server memory |
| `/api/gemini/disconnect` | `POST` | Clear runtime session Gemini key |
| `/api/gemini/chat` | `POST` | Conversational financial copilot grounded in ledger + `paypalContext` |
| `/api/gemini/parse-statement` | `POST` | Multimodal bill/statement/UPI screenshot extraction |
| `/api/gemini/generate-summary` | `POST` | Structured monthly executive financial briefing |
| `/api/gemini/analyze-goals` | `POST` | AI goal timeline acceleration analysis |
| `/api/paypal/status` | `GET` | Sandbox connection status, scopes, orders, subscriptions & telemetry |
| `/api/paypal/connect` | `POST` | Verify & bind runtime PayPal Sandbox Client ID / Secret via OAuth 2.0 |
| `/api/paypal/disconnect` | `POST` | Clear runtime session PayPal credentials |
| `/api/paypal/refresh-token` | `POST` | Terminate & refresh OAuth token to load updated Sandbox app scopes |
| `/api/paypal/rate` | `POST` | Update `INR <-> USD` conversion rate |
| `/api/paypal/guardrail` | `POST` | Evaluate spend with `gemini-3.8-flash` before checkout |
| `/api/paypal/orders` | `POST` | Create PayPal Orders v2 checkout order in USD |
| `/api/paypal/orders/:orderId` | `GET` | Inspect live PayPal Sandbox order status |
| `/api/paypal/orders/:orderId/capture` | `POST` | Capture approved PayPal Sandbox order |
| `/api/paypal/subscriptions` | `POST` | Provision Catalog Product + Billing Plan + Subscription v1 |
| `/api/paypal/subscriptions/:id` | `GET` | Fetch live PayPal subscription status |
| `/api/paypal/subscriptions/:id/cancel` | `POST` | Cancel PayPal Sandbox subscription |
| `/api/paypal/sync` | `POST` | Sync Sandbox Balances & Transactions with Gemini categorization |

---

## Tools & Stack

- **PayPal Developer Platform (Sandbox)**: `@paypal/react-paypal-js` v10, PayPal REST APIs (OAuth 2.0, Orders v2, Catalog Products, Billing Plans, Subscriptions v1, Reporting Balances & Transaction Search v1)
- **AI Model & SDK**: `@google/genai` targeting `gemini-3.8-flash`
- **Frontend**: React 19, TypeScript, Vite 8, Tailwind CSS v4, Lucide React
- **Backend**: Node.js, Express 4, `tsx`, `esbuild`
- **Cloud Sync (Optional)**: Firebase Auth (Google Sign-In) & Google Sheets sync

---

## Demo Video Script (< 3 Minutes)

1. **0:00 – 0:25**: Launch `http://localhost:3000` on **Overview** — highlight INR cash flow metrics, net savings, remaining buffer, and the **PayPal Sandbox** status pill.
2. **0:25 – 0:50**: Open **PayPal Hub** — show OAuth 2.0 active scopes, `INR <-> USD` bridge, and live **PayPal Sandbox API Telemetry**.
3. **0:50 – 1:45**: Open **Analyze a Purchase** — demonstrate an over-budget `stretched` item triggering the **Gemini 3.8 Flash** safety guardrail, unlock with override (or approve an affordable item), execute live `@paypal/react-paypal-js` Sandbox checkout, capture, and inspect the new PayPal record inside **Transactions**.
4. **1:45 – 2:25**: Open **Goals -> Fund Goal via PayPal** (or create a **PayPal Auto-Pay Subscription** in **PayPal Hub** and verify it in **Recurring Payments** with live Sync & Cancel).
5. **2:25 – 2:55**: Open **AI Assistant** and ask *"Evaluate my PayPal Sandbox orders & subscription spending"* to demonstrate real-time PayPal + ledger reasoning.

---

## License

Released under the open-source **MIT License** — see [`LICENSE`](./LICENSE).

*Disclaimer: FinPilot is an analytical personal finance decision-support prototype for educational and hackathon demonstration purposes; it is not registered financial, tax, or legal advice.*
