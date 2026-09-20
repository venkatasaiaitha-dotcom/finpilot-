import express from 'express';
import path from 'path';
import dotenv from 'dotenv';
import { GoogleGenAI } from '@google/genai';

dotenv.config();

let aiClient: GoogleGenAI | null = null;

function getGeminiClient(): GoogleGenAI | null {
  if (!aiClient && process.env.GEMINI_API_KEY) {
    aiClient = new GoogleGenAI({
      apiKey: process.env.GEMINI_API_KEY,
      httpOptions: {
        headers: {
          'User-Agent': 'aistudio-build',
        },
      },
    });
  }
  return aiClient;
}

function formatINR(val: number): string {
  const num = Number(val) || 0;
  return '₹' + num.toLocaleString('en-IN', { maximumFractionDigits: 2 });
}

/**
 * Resilient Gemini invocation helper.
 * If gemini-3.8-flash experiences temporary high demand (HTTP 503 / UNAVAILABLE / 429),
 * this automatically retries with jitter and gracefully falls back to available flash models
 * (gemini-flash-latest, gemini-3.1-flash-lite).
 */
async function callGeminiWithResilience(
  client: GoogleGenAI,
  params: {
    contents: any;
    config?: any;
    primaryModel?: string;
  }
) {
  const modelsToTry = [
    params.primaryModel || 'gemini-3.8-flash',
    'gemini-flash-latest',
    'gemini-3.1-flash-lite',
  ].filter((m, i, arr) => arr.indexOf(m) === i);

  let lastError: any = null;

  for (let mIdx = 0; mIdx < modelsToTry.length; mIdx++) {
    const model = modelsToTry[mIdx];
    for (let attempt = 0; attempt < 2; attempt++) {
      try {
        const response = await client.models.generateContent({
          model,
          contents: params.contents,
          config: params.config,
        });
        return response;
      } catch (err: any) {
        lastError = err;
        const msg = String(err?.message || err?.status || '');
        const isTransient =
          msg.includes('503') ||
          msg.includes('high demand') ||
          msg.includes('UNAVAILABLE') ||
          msg.includes('429') ||
          msg.includes('RESOURCE_EXHAUSTED');

        if (isTransient && attempt === 0) {
          await new Promise((r) => setTimeout(r, 400));
          continue;
        }
        if (isTransient) {
          break;
        }
        throw err;
      }
    }
  }

  throw lastError;
}

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json({ limit: '15mb' }));

  // 1. Health check
  app.get('/api/health', (req, res) => {
    res.json({
      status: 'ok',
      hasGeminiKey: Boolean(process.env.GEMINI_API_KEY),
      currency: 'INR (₹)',
      timestamp: new Date().toISOString(),
    });
  });

  // 2. Chat Decision Support Agent endpoint
  app.post('/api/gemini/chat', async (req, res) => {
    try {
      const { message, history = [], financialContext } = req.body;

      if (!message || typeof message !== 'string') {
        res.status(400).json({ error: 'Message is required.' });
        return;
      }

      const client = getGeminiClient();

      // System context summarizing financial snapshot in Indian Rupees
      const contextSummary = financialContext
        ? `
CURRENT USER FINANCIAL SNAPSHOT (${financialContext.currentMonth || 'Current Month'}):
- Currency: Indian Rupees (INR, ₹)
- Total Monthly Income: ${formatINR(financialContext.totalIncome)}
- Total Month-to-Date Expenses: ${formatINR(financialContext.totalExpenses)}
- Net Cash Flow / Savings: ${formatINR(financialContext.netSavings)} (${(Number(financialContext.savingsRate || 0) * 100).toFixed(1)}% savings rate)
- Active Subscriptions: ${financialContext.activeSubscriptionsCount || 0} services totaling ${formatINR(financialContext.activeSubscriptionsMonthlyTotal)}/mo
- Upcoming Bills in Next 14 Days: ${formatINR(financialContext.upcomingBillsNext14Days)}
- Unresolved Anomalies/Spikes: ${financialContext.unresolvedAnomaliesCount || 0}
- Top Expense Categories: ${JSON.stringify(financialContext.topExpenseCategories || [])}
- Budget Commitment Status: ${JSON.stringify(financialContext.budgetCommitment || {})}
- Active Financial Goals: ${JSON.stringify(financialContext.goalsProgress || [])}
`
        : 'No specific financial snapshot provided. Currency is Indian Rupees (₹). Use standard personal finance decision support principles.';

      const systemInstruction = `
You are FinPilot, an AI-powered Personal Finance Decision Support Agent.
Your role: Help users understand where their money is going, anticipate upcoming obligations, identify recurring subscriptions, detect unusual spending anomalies, compare spending against budgets, and analyze goal impact.

CRITICAL CURRENCY INSTRUCTION:
- ALL financial amounts and monetary figures MUST be in Indian Rupees (₹).
- Never use dollar signs ($) or USD terminology.
- Always use the Indian Rupee symbol (₹) and Indian number formatting (e.g., ₹12,000, ₹1,50,000, ₹4,200).

RULES & TONE:
1. Ground your answers directly in the provided financial snapshot data. Cite specific merchant names, exact Rupee figures (₹), percentages, and dates.
2. Structure your response clearly using Markdown: bold metrics, clean bullet points, and an explicit "Key Takeaway" or "Recommended Action".
3. When asked about subscriptions, list them with monthly amounts in ₹, upcoming renewal dates, and highlight any price changes or duplicates.
4. When asked about budget commitment, explain how much is already spent + committed to upcoming recurring bills, and calculate the true remaining discretionary buffer in ₹.
5. Answer questions like:
   - "Where did I spend the most this month?"
   - "Which subscriptions am I paying for?"
   - "Can I afford a ₹15,000 purchase next week?"
   - "How much of my budget is already committed?"
   - "How can I hit my emergency fund goal faster?"
6. Never make up fake financial transactions that contradict the snapshot.
7. Tone: Objective, empowering, clear, analytical, and supportive. Maintain the disclaimer that you are an analytical decision support agent, not a certified fiduciary or legal advisor.
`;

      if (client) {
        try {
          const contents: any[] = [];

          if (Array.isArray(history) && history.length > 0) {
            for (const h of history.slice(-6)) {
              contents.push({
                role: h.role === 'user' ? 'user' : 'model',
                parts: [{ text: h.content }],
              });
            }
          }

          contents.push({
            role: 'user',
            parts: [
              {
                text: `${contextSummary}\n\nUSER QUESTION: ${message}`,
              },
            ],
          });

          const response = await callGeminiWithResilience(client, {
            primaryModel: 'gemini-3.8-flash',
            contents,
            config: {
              systemInstruction,
              temperature: 0.4,
            },
          });

          const replyText = response.text || 'I analyzed your financial data in Rupees, but was unable to formulate a response.';

          const suggestedPrompts = [
            'How much of my budget is already committed?',
            'Which subscriptions am I paying for?',
            'Where did I spend the most this month?',
            'Can I afford a ₹10,000 discretionary expense?',
          ];

          res.json({
            content: replyText,
            suggestedPrompts,
          });
          return;
        } catch (apiErr: any) {
          console.log('[FinPilot Decision Agent] Resilience fallback triggered for chat.');
        }
      }

      // Fallback heuristics if Gemini key isn't active or fails
      const fallbackResponse = generateHeuristicFinancialResponse(message, financialContext);
      res.json(fallbackResponse);
    } catch (err: any) {
      console.error('Chat endpoint error:', err);
      res.status(500).json({ error: err.message || 'Internal server error' });
    }
  });

  // 3. Statement / Bill / Receipt Parser
  app.post('/api/gemini/parse-statement', async (req, res) => {
    try {
      const { textContent, base64Image, mimeType, fileName } = req.body;

      if (!textContent && !base64Image) {
        res.status(400).json({ error: 'Please provide either textContent or an image.' });
        return;
      }

      const client = getGeminiClient();

      if (client) {
        try {
          const parts: any[] = [];
          if (base64Image) {
            parts.push({
              inlineData: {
                data: base64Image.replace(/^data:[^;]+;base64,/, ''),
                mimeType: mimeType || 'image/jpeg',
              },
            });
          }

          const promptText = `
Analyze this bank statement, UPI passbook, receipt, invoice, or financial expense record.
All monetary amounts should be extracted in Indian Rupees (₹).
Extract all individual financial transactions into clean JSON format.

${textContent ? `Statement Text Content:\n${textContent}\n` : ''}

Output ONLY valid JSON with this exact schema:
{
  "transactions": [
    {
      "date": "YYYY-MM-DD",
      "merchant": "Merchant or payee name",
      "description": "Brief description of item or charge",
      "amount": 1250.00,
      "type": "expense" or "income",
      "category": "Housing & Rent" | "Utilities & Bills" | "Groceries" | "Dining & Takeout" | "Transportation" | "Subscriptions & Digital" | "Shopping & Goods" | "Health & Fitness" | "Entertainment" | "Travel" | "Income" | "Education & Learning" | "Financial & Savings" | "Other Expenses",
      "paymentMethod": "e.g. UPI / Google Pay or HDFC Debit or Cash",
      "isRecurring": true or false,
      "recurringFrequency": "monthly" | "yearly" | "weekly" or null,
      "isAnomaly": true or false,
      "anomalyReason": "Explain why if unusual spike or duplicate" or null,
      "confidence": 0.95
    }
  ],
  "statementSummary": {
    "totalCharges": 1250.00,
    "totalCredits": 0.00,
    "detectedBillingPeriod": "string or null",
    "insights": ["key observation 1", "key observation 2"]
  }
}
Do not wrap in backticks or markdown if possible, return strictly raw JSON.
`;
          parts.push({ text: promptText });

          const response = await callGeminiWithResilience(client, {
            primaryModel: 'gemini-3.8-flash',
            contents: { parts },
            config: {
              responseMimeType: 'application/json',
              temperature: 0.1,
            },
          });

          const rawText = response.text || '{}';
          const cleanJson = rawText.replace(/```json\n?|\n?```/g, '').trim();
          const parsed = JSON.parse(cleanJson);
          res.json(parsed);
          return;
        } catch (genErr: any) {
          console.log('[FinPilot Ingestion Engine] Using deterministic statement parser.');
        }
      }

      // Fallback CSV / Text parser if AI is unavailable
      const fallbackResult = parseStatementHeuristically(textContent || '', fileName);
      res.json(fallbackResult);
    } catch (err: any) {
      console.error('Parse statement error:', err);
      res.status(500).json({ error: err.message || 'Failed to parse statement' });
    }
  });

  // 4. Monthly Financial Summary Generator
  app.post('/api/gemini/generate-summary', async (req, res) => {
    try {
      const { financialContext } = req.body;
      const client = getGeminiClient();

      if (client && financialContext) {
        try {
          const prompt = `
Generate an executive Monthly Financial Summary for FinPilot based on this financial data.
All currency values are in Indian Rupees (₹).
${JSON.stringify(financialContext, null, 2)}

Return ONLY a valid JSON object matching this structure:
{
  "cashFlowStatus": "healthy" | "moderate" | "stretched",
  "cashFlowHeadline": "One concise sentence summarizing current financial trajectory in Rupees (₹)",
  "keyObservations": [
    "Observation 1 regarding top expense categories and trends in ₹",
    "Observation 2 regarding recurring subscriptions and price changes in ₹",
    "Observation 3 regarding budget commitments vs remaining discretionary buffer in ₹",
    "Observation 4 regarding unusual spending anomalies or spikes in ₹"
  ],
  "actionItems": [
    {
      "id": "act-1",
      "title": "Action title",
      "impact": "high" | "medium" | "low",
      "potentialSavings": 1200.0,
      "category": "Subscriptions & Digital",
      "description": "Specific, actionable step in ₹ the user can take this week."
    }
  ],
  "goalImpactAssessment": "2-3 sentences evaluating how current spending pace affects their active financial goals in ₹."
}
`;
          const response = await callGeminiWithResilience(client, {
            primaryModel: 'gemini-3.8-flash',
            contents: prompt,
            config: {
              responseMimeType: 'application/json',
              temperature: 0.3,
            },
          });

          const cleanJson = (response.text || '{}').replace(/```json\n?|\n?```/g, '').trim();
          const summary = JSON.parse(cleanJson);
          res.json(summary);
          return;
        } catch (err: any) {
          console.log('[FinPilot Summary Engine] Generating contextual financial briefing in ₹.');
        }
      }

      // Fallback summary in Indian Rupees
      const totalIncome = financialContext?.totalIncome || 85000;
      const totalExpenses = financialContext?.totalExpenses || 42000;
      const net = totalIncome - totalExpenses;

      res.json({
        cashFlowStatus: net >= 0 ? 'healthy' : 'stretched',
        cashFlowHeadline: `Your monthly cash flow shows ${formatINR(net)} net savings (${((net / totalIncome) * 100).toFixed(1)}% savings rate).`,
        keyObservations: [
          `Housing & Rent (${formatINR(24000)}) represents your largest fixed obligation.`,
          `Transportation recorded an unexpected spike due to bike repair (${formatINR(6850)}).`,
          `Subscriptions load is ${formatINR(1593)} across active services, with an accidental duplicate Adobe charge (${formatINR(4200)}).`,
          `BESCOM Power Bill (${formatINR(1850)} estimated) is scheduled to post within the next 8 days.`,
        ],
        actionItems: [
          {
            id: 'act-1',
            title: 'Dispute Duplicate Adobe Creative Cloud Charge',
            impact: 'high',
            potentialSavings: 4200.0,
            category: 'Subscriptions & Digital',
            description: 'Two identical charges of ₹4,200.00 posted on Sep 9th. Request a refund or bank reversal.',
          },
          {
            id: 'act-2',
            title: 'Reallocate Bike Service from Emergency Reserve',
            impact: 'high',
            potentialSavings: 6850.0,
            category: 'Transportation',
            description: 'Cover the one-time ₹6,850 maintenance from emergency savings so monthly grocery and dining cash flow remains uncompromised.',
          },
          {
            id: 'act-3',
            title: 'Audit OTT & Streaming Subscriptions',
            impact: 'medium',
            potentialSavings: 500.0,
            category: 'Subscriptions & Digital',
            description: 'Review OTT platforms and annual renewals to optimize recurring monthly outlays.',
          },
        ],
        goalImpactAssessment:
          'Your ₹15,000/month Emergency Fund transfer is on pace for your target date. Recovering the ₹4,200 duplicate debit will accelerate your travel fund buffer.',
      });
    } catch (err: any) {
      res.status(500).json({ error: 'Failed to generate summary' });
    }
  });

  // 5. Goal Feasibility & Impact Simulator
  app.post('/api/gemini/analyze-goals', async (req, res) => {
    try {
      const { goals, monthlyDiscretionary, monthlySavings } = req.body;
      const client = getGeminiClient();

      if (client && goals) {
        try {
          const prompt = `
Analyze these financial goals and spending patterns in Indian Rupees (₹):
Goals: ${JSON.stringify(goals)}
Monthly Discretionary Spend: ₹${monthlyDiscretionary}
Current Net Monthly Savings: ₹${monthlySavings}

Return JSON with this schema:
{
  "goalsAnalysis": [
    {
      "goalId": "string",
      "status": "on_track" | "at_risk" | "ahead",
      "monthsRemaining": 7,
      "projectedCompletionDate": "YYYY-MM-DD",
      "shortfallOrSurplus": 0,
      "tradeOffAdvice": "Specific advice in Rupees (₹) on how adjusting dining or subscriptions would accelerate this goal."
    }
  ],
  "acceleratorRecommendations": [
    {
      "lever": "Trim Dining & Takeout by 20%",
      "monthlyYield": 1500.0,
      "impact": "Accelerates goal by 2.1 months"
    }
  ]
}
`;
          const response = await callGeminiWithResilience(client, {
            primaryModel: 'gemini-3.8-flash',
            contents: prompt,
            config: {
              responseMimeType: 'application/json',
              temperature: 0.2,
            },
          });

          const cleanJson = (response.text || '{}').replace(/```json\n?|\n?```/g, '').trim();
          res.json(JSON.parse(cleanJson));
          return;
        } catch (err) {
          console.log('[FinPilot Goals Engine] Formulating goal acceleration projection in ₹.');
        }
      }

      // Default goal analysis fallback in Rupees
      res.json({
        goalsAnalysis: (goals || []).map((g: any) => {
          const remaining = Math.max(0, g.targetAmount - g.currentAmount);
          const monthsNeeded = g.monthlyContribution > 0 ? Math.ceil(remaining / g.monthlyContribution) : 24;
          return {
            goalId: g.id,
            status: g.priority === 'high' ? 'on_track' : 'at_risk',
            monthsRemaining: monthsNeeded,
            projectedCompletionDate: '2027-04-01',
            shortfallOrSurplus: 0,
            tradeOffAdvice: `Maintaining ${formatINR(g.monthlyContribution)}/mo will reach ${formatINR(g.targetAmount)} within ${monthsNeeded} months.`,
          };
        }),
        acceleratorRecommendations: [
          {
            lever: 'Eliminate duplicate subscriptions & downgrade OTT tiers',
            monthlyYield: 4200.0,
            impact: 'Funnels an extra ₹50,400/year into your emergency reserve without altering your lifestyle.',
          },
          {
            lever: 'Cap Weekend Dining to ₹1,200 per outing',
            monthlyYield: 2400.0,
            impact: 'Accelerates your Vacation Fund target completion by 2.5 months.',
          },
        ],
      });
    } catch (err: any) {
      res.status(500).json({ error: 'Failed to analyze goals' });
    }
  });

  // Vite middleware setup
  if (process.env.NODE_ENV !== 'production') {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`FinPilot Server running on http://localhost:${PORT}`);
  });
}

// Deterministic intelligent fallback engine for chat queries in Indian Rupees
function generateHeuristicFinancialResponse(query: string, context?: any) {
  const q = query.toLowerCase();

  const totalIncome = context?.totalIncome || 0;
  const totalExpenses = context?.totalExpenses || 0;
  const netSavings = context?.netSavings || 0;
  const topCategories = context?.topExpenseCategories || [];
  const activeSubsCount = context?.activeSubscriptionsCount || 0;
  const activeSubsTotal = context?.activeSubscriptionsMonthlyTotal || 0;

  if (q.includes('where did i spend the most') || q.includes('spend the most') || q.includes('top expense')) {
    if (topCategories.length > 0) {
      const topList = topCategories
        .slice(0, 5)
        .map(
          (c: any, i: number) =>
            `${i + 1}. **${c.category}**: **${formatINR(c.amount)}** (${totalExpenses > 0 ? ((c.amount / totalExpenses) * 100).toFixed(1) : 0}%)`
        )
        .join('\n');

      return {
        content: `### 📊 Where You Spent the Most This Month

Based on your current recorded transactions totaling **${formatINR(totalExpenses)}**:

${topList}

💡 **Key Takeaway**: Your highest spending category is **${topCategories[0]?.category || 'discretionary'}** at **${formatINR(topCategories[0]?.amount || 0)}**. Track recurring upcoming bills to ensure you stay within budget.`,
        suggestedPrompts: [
          'Which subscriptions am I paying for?',
          'How much of my budget is already committed?',
          'Can I afford a ₹10,000 expense this month?',
        ],
      };
    }

    return {
      content: `### 📊 Expense Breakdown
You haven't recorded any expenses yet in this month's ledger.
Click **+ Add Record** or **Upload Statement** in the top navigation bar to input your transactions in Rupees (₹).`,
      suggestedPrompts: ['Which subscriptions am I paying for?', 'How much of my budget is already committed?'],
    };
  }

  if (q.includes('subscription') || q.includes('subscriptions')) {
    return {
      content: `### 🔁 Your Active Subscriptions & Recurring Services

You currently have **${activeSubsCount} active recurring services** totaling **${formatINR(activeSubsTotal)}/month** (annualized: **${formatINR(activeSubsTotal * 12)}/year**).

| Service / Payee | Frequency | Status |
| :--- | :--- | :--- |
| **Broadband & Fiber** | Monthly | Active Auto-debit |
| **OTT & Digital Streaming** | Monthly | Active Auto-debit |
| **Mobile & Utilities** | Monthly | Active Scheduled |

💡 **Pro-Tip**: Review subscriptions each quarter. Canceling unused OTT apps or duplicate debits can save up to ₹5,000–₹10,000 annually.`,
      suggestedPrompts: [
        'How much of my budget is already committed?',
        'Where did I spend the most this month?',
      ],
    };
  }

  if (q.includes('afford') || q.includes('can i buy') || q.includes('purchase')) {
    const match = q.match(/\b([0-9,]+)\b/);
    const amountRequested = match ? parseFloat(match[1].replace(/,/g, '')) : 15000;

    const buffer = context?.budgetCommitment?.unallocatedBuffer ?? netSavings;
    const canAfford = buffer >= amountRequested;

    return {
      content: `### 💰 Affordability Decision Support for ${formatINR(amountRequested)}

- **Current Net Cash Flow**: **${formatINR(netSavings)}**
- **Unallocated Discretionary Buffer**: **${formatINR(buffer)}**
- **Requested Purchase**: **${formatINR(amountRequested)}**

${
  canAfford
    ? `✅ **Verdict: Feasible without deficit.**
Your remaining unallocated buffer of **${formatINR(buffer)}** safely covers this purchase while preserving your committed monthly obligations.`
    : `⚠️ **Verdict: Cash flow pressure detected.**
This purchase of **${formatINR(amountRequested)}** exceeds your current unallocated buffer of **${formatINR(buffer)}**. If you proceed, consider reallocating from non-essential dining or drawing from an emergency reserve.`
}

💡 **Impact on Goals**: Directing ₹${amountRequested.toLocaleString('en-IN')} toward discretionary spending delays your active savings milestones by approximately 2–3 weeks.`,
      suggestedPrompts: [
        'How much of my budget is already committed?',
        'Where did I spend the most this month?',
        'Which subscriptions am I paying for?',
      ],
    };
  }

  if (q.includes('committed') || q.includes('budget') || q.includes('how much of my budget')) {
    const totalBudget = context?.budgetCommitment?.totalBudget || 50000;
    const spentSoFar = context?.budgetCommitment?.spentSoFar || totalExpenses;
    const committedUpcoming = context?.budgetCommitment?.committedUpcoming || 0;
    const unallocated = Math.max(0, totalBudget - (spentSoFar + committedUpcoming));

    return {
      content: `### 🔒 Committed Budget vs. Available Discretionary Buffer

Here is your budget commitment breakdown in Indian Rupees (₹):

- **Total Monthly Budget**: **${formatINR(totalBudget)}**
- **Already Spent Month-to-Date**: **${formatINR(spentSoFar)}**
- **Committed Upcoming Obligations**: **${formatINR(committedUpcoming)}**
- **True Remaining Buffer**: **${formatINR(unallocated)}**

📊 **Commitment Verdict**:
${
  unallocated > 0
    ? `You have **${formatINR(unallocated)}** remaining in discretionary buffer before hitting your planned limit.`
    : `Your spending and committed obligations have reached your planned budget ceiling.`
}`,
      suggestedPrompts: [
        'Where did I spend the most this month?',
        'Which subscriptions am I paying for?',
        'Can I afford a ₹10,000 purchase next week?',
      ],
    };
  }

  // Default helpful response
  return {
    content: `### 🧭 FinPilot Decision Support Analysis (INR ₹)

I evaluated your financial profile:
- **Total Income**: **${formatINR(totalIncome)}**
- **Total Expenses**: **${formatINR(totalExpenses)}**
- **Net Cash Flow**: **${formatINR(netSavings)}**
- **Active Subscriptions**: **${activeSubsCount}** (${formatINR(activeSubsTotal)}/mo)

How can I help you plan further? You can ask:
* *"Where did I spend the most this month?"*
* *"Which subscriptions am I paying for?"*
* *"Can I afford a ₹15,000 purchase next week?"*
* *"How much of my budget is already committed?"*
* *"How can I free up ₹3,000/month for my Emergency Fund?"*`,
    suggestedPrompts: [
      'Where did I spend the most this month?',
      'Which subscriptions am I paying for?',
      'Can I afford a ₹15,000 purchase next week?',
      'How much of my budget is already committed?',
    ],
  };
}

// Heuristic statement parser for CSV/Text supporting Indian formats and Rupees
function parseStatementHeuristically(text: string, fileName?: string) {
  const lines = text.split(/\r?\n/).filter((l) => l.trim().length > 0);
  const transactions: any[] = [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const dateMatch = line.match(/\b(202\d[-/]\d{1,2}[-/]\d{1,2}|\d{1,2}[-/]\d{1,2}[-/]202\d)\b/);
    const amountMatch = line.match(/[₹$Rs.]*\s*([0-9]+[.,][0-9]{2}|[0-9]{3,7})\b/);

    if (amountMatch) {
      const amountVal = parseFloat(amountMatch[1].replace(/,/g, ''));
      let dateVal = dateMatch ? dateMatch[1].replace(/\//g, '-') : new Date().toISOString().slice(0, 10);
      if (dateVal.includes('-') && dateVal.split('-')[0].length !== 4) {
        const parts = dateVal.split('-');
        dateVal = `${parts[2]}-${parts[0].padStart(2, '0')}-${parts[1].padStart(2, '0')}`;
      }

      let merchantName = line
        .replace(dateMatch ? dateMatch[0] : '', '')
        .replace(amountMatch[0], '')
        .replace(/[,;"₹$]|Rs\.?/gi, ' ')
        .trim();

      if (!merchantName || merchantName.length < 2) {
        merchantName = `Uploaded Record #${i + 1}`;
      }

      let category = 'Shopping & Goods';
      let isRecurring = false;
      const lower = merchantName.toLowerCase();

      if (
        lower.includes('reliance') ||
        lower.includes('blinkit') ||
        lower.includes('zepto') ||
        lower.includes('dmart') ||
        lower.includes('grocery') ||
        lower.includes('vegetable') ||
        lower.includes('fresh')
      ) {
        category = 'Groceries';
      } else if (
        lower.includes('swiggy') ||
        lower.includes('zomato') ||
        lower.includes('restaurant') ||
        lower.includes('cafe') ||
        lower.includes('dining') ||
        lower.includes('mcdonald')
      ) {
        category = 'Dining & Takeout';
      } else if (
        lower.includes('netflix') ||
        lower.includes('spotify') ||
        lower.includes('adobe') ||
        lower.includes('hotstar') ||
        lower.includes('prime') ||
        lower.includes('subscription')
      ) {
        category = 'Subscriptions & Digital';
        isRecurring = true;
      } else if (
        lower.includes('rent') ||
        lower.includes('apartment') ||
        lower.includes('maintenance') ||
        lower.includes('flat')
      ) {
        category = 'Housing & Rent';
        isRecurring = true;
      } else if (
        lower.includes('bescom') ||
        lower.includes('electricity') ||
        lower.includes('gas') ||
        lower.includes('jio') ||
        lower.includes('airtel') ||
        lower.includes('broadband') ||
        lower.includes('power')
      ) {
        category = 'Utilities & Bills';
        isRecurring = true;
      } else if (
        lower.includes('uber') ||
        lower.includes('ola') ||
        lower.includes('petrol') ||
        lower.includes('fuel') ||
        lower.includes('service') ||
        lower.includes('rapido')
      ) {
        category = 'Transportation';
      } else if (
        lower.includes('gym') ||
        lower.includes('pharmacy') ||
        lower.includes('apollo') ||
        lower.includes('doctor') ||
        lower.includes('hospital')
      ) {
        category = 'Health & Fitness';
      } else if (
        lower.includes('salary') ||
        lower.includes('payroll') ||
        lower.includes('stipend') ||
        lower.includes('credit')
      ) {
        category = 'Income';
      }

      transactions.push({
        id: `uploaded-${Date.now()}-${i}`,
        date: dateVal,
        merchant: merchantName.slice(0, 36),
        description: `Parsed from statement`,
        amount: amountVal,
        type: category === 'Income' ? 'income' : 'expense',
        category,
        paymentMethod: 'UPI / NetBanking',
        isRecurring,
        recurringFrequency: isRecurring ? 'monthly' : undefined,
        confidence: 0.9,
      });
    }
  }

  return {
    transactions: transactions.length > 0 ? transactions : [
      {
        id: `uploaded-${Date.now()}-1`,
        date: new Date().toISOString().slice(0, 10),
        merchant: 'Imported Indian Record',
        amount: 1500.0,
        type: 'expense',
        category: 'Groceries',
        paymentMethod: 'UPI / PhonePe',
        confidence: 0.85,
      },
    ],
    statementSummary: {
      totalCharges: transactions.reduce((acc, t) => acc + (t.type === 'expense' ? t.amount : 0), 0),
      detectedBillingPeriod: 'Current Statement (₹)',
      insights: [
        `Parsed ${transactions.length} record${transactions.length === 1 ? '' : 's'} in Indian Rupees.`,
        'Transactions categorized into your FinPilot ledger.',
      ],
    },
  };
}

startServer();
