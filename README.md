# FinPilot — Personal Finance Decision Support Agent

FinPilot is an intelligent personal finance decision support application designed for statement parsing, recurring subscription detection, cash-flow forecasting, budget commitment tracking, goal impact analysis, and conversational AI guidance in **Indian Rupees (INR ₹)**.

---

## Features

- **Decision Support Agent**: AI-powered conversational assistant grounded in real-time financial snapshots (spending, subscriptions, budgets, and goals).
- **Transaction & Expense Ledger**: Detailed categorization, search, filtering by expense/income/recurring/anomalies, and manual record entry.
- **Statement & Bill Parser**: Multi-format statement ingestion (images, invoices, UPI passbooks, CSV) powered by Gemini multimodal vision.
- **Budget Commitment Tracking**: Compare month-to-date spending + scheduled upcoming obligations against monthly limits.
- **Recurring Payments & Subscriptions**: Automated tracking of digital services, utilities, and renewal dates with status toggles.
- **Spending Anomalies & Spike Detection**: Proactive alerts for duplicate transactions, unexpected price increases, and irregular spikes.
- **Financial Goals Simulator**: What-if discretionary spending levers to forecast how spending adjustments impact goal timelines.
- **Google Sheets Integration**: Two-way export and sync with Google Drive / Google Sheets using Firebase Google Authentication.
- **Executive Monthly Briefing**: One-click structured AI summary of cash flow health, key observations, and potential savings.

---

## Tech Stack

- **Frontend**: React 19, TypeScript, Vite 8, Tailwind CSS, Lucide Icons, Motion
- **Backend**: Express.js, TypeScript (`tsx`)
- **AI Engine**: Google Gemini API (`@google/genai`)
- **Auth & Cloud**: Firebase Auth (Google OAuth)

---

## Getting Started

### Prerequisites
- Node.js (v18+)
- npm or bun

### Installation

1. Install dependencies:
   ```bash
   npm install
   ```

2. Configure environment variables in `.env`:
   ```env
   GEMINI_API_KEY="your-google-gemini-api-key"
   APP_URL="http://localhost:3000"
   ```

3. Run the development server:
   ```bash
   npm run dev
   ```

4. Open in your browser:
   ```
   http://localhost:3000
   ```

### Build & Production

```bash
# Type check and lint
npm run lint

# Build client and server bundles
npm run build

# Start production server
npm start
```

---

## Disclaimer
FinPilot is an analytical decision support tool. It provides automated financial organization and insights, but is not a licensed fiduciary, legal, or investment advisory service.
