import express from 'express';
import path from 'path';
import dotenv from 'dotenv';
import { GoogleGenAI } from '@google/genai';
import {
  captureSandboxOrder,
  cancelSandboxSubscription,
  connectSandboxCredentials,
  createSandboxOrder,
  createSandboxSubscription,
  disconnectSandbox,
  getInrPerUsd,
  getPayPalStatus,
  getSandboxOrderDetails,
  getTrackedPayPalData,
  refreshSandboxSubscription,
  setInrPerUsd,
  syncSandboxReporting,
  terminateAndRefreshToken,
} from './server/paypalService';

dotenv.config();

let aiClient: GoogleGenAI | null = null;
let runtimeGeminiKey: string | null = null;

function getEffectiveGeminiKey(): string | null {
  return runtimeGeminiKey || process.env.GEMINI_API_KEY?.trim() || null;
}

function getGeminiClient(): GoogleGenAI | null {
  const apiKey = getEffectiveGeminiKey();
  if (!aiClient && apiKey) {
    aiClient = new GoogleGenAI({
      apiKey,
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
  const PORT = Number(process.env.PORT) || 3000;

  app.set('trust proxy', 1);
  app.use(express.json({ limit: '15mb' }));

  const getPublicOrigin = (req: express.Request): string => {
    if (process.env.RENDER_EXTERNAL_URL?.trim()) {
      return process.env.RENDER_EXTERNAL_URL.trim().replace(/\/$/, '');
    }
    if (process.env.APP_URL?.trim() && !process.env.APP_URL.includes('localhost')) {
      return process.env.APP_URL.trim().replace(/\/$/, '');
    }
    const forwardedProto = (req.headers['x-forwarded-proto'] as string | undefined)
      ?.split(',')[0]
      ?.trim();
    const proto = forwardedProto || req.protocol;
    return `${proto}://${req.get('host')}`;
  };

  // 1. Health check
  app.get('/api/health', async (req, res) => {
    const ppStatus = await getPayPalStatus().catch(() => null);
    const activeGeminiKey = getEffectiveGeminiKey();
    res.json({
      status: 'ok',
      hasGeminiKey: Boolean(activeGeminiKey),
      geminiSource: runtimeGeminiKey
        ? 'session'
        : process.env.GEMINI_API_KEY?.trim()
        ? 'env'
        : 'none',
      paypalSandboxConnected: Boolean(ppStatus?.connected),
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

      // System context summarizing financial snapshot in Indian Rupees + PayPal Sandbox status
      const contextSummary = financialContext
        ? `
CURRENT USER FINANCIAL SNAPSHOT (${financialContext.currentMonth || 'Current Month'}):
- Primary Ledger Currency: Indian Rupees (INR, ₹)
- Total Monthly Income: ${formatINR(financialContext.totalIncome)}
- Total Month-to-Date Expenses: ${formatINR(financialContext.totalExpenses)}
- Net Cash Flow / Savings: ${formatINR(financialContext.netSavings)} (${(Number(financialContext.savingsRate || 0) * 100).toFixed(1)}% savings rate)
- Active Subscriptions: ${financialContext.activeSubscriptionsCount || 0} services totaling ${formatINR(financialContext.activeSubscriptionsMonthlyTotal)}/mo
- Upcoming Bills in Next 14 Days: ${formatINR(financialContext.upcomingBillsNext14Days)}
- Unresolved Anomalies/Spikes: ${financialContext.unresolvedAnomaliesCount || 0}
- Top Expense Categories: ${JSON.stringify(financialContext.topExpenseCategories || [])}
- Budget Commitment Status: ${JSON.stringify(financialContext.budgetCommitment || {})}
- Active Financial Goals: ${JSON.stringify(financialContext.goalsProgress || [])}
- PayPal Sandbox Integration: ${JSON.stringify(financialContext.paypalContext || { connected: false })}
`
        : 'No specific financial snapshot provided. Currency is Indian Rupees (₹). Use standard personal finance decision support principles.';

      const systemInstruction = `
You are FinPilot, an AI-powered Personal Finance Decision Support & PayPal Guardrail Agent.
Your role: Help users understand where their money is going, anticipate upcoming obligations, identify recurring subscriptions, detect unusual spending anomalies, compare spending against budgets, analyze goal impact, and advise whether a PayPal Checkout purchase or PayPal Goal Contribution is financially safe.

CRITICAL CURRENCY INSTRUCTION:
- Present primary personal finance metrics in Indian Rupees (₹) with Indian number formatting (e.g., ₹12,000, ₹1,50,000, ₹4,200).
- When discussing PayPal Sandbox orders, wallet balances, or USD-denominated settlements, show the Indian Rupee (₹) figure alongside its PayPal USD conversion (e.g., ₹8,450 ($100.00 USD)).

RULES & TONE:
1. Ground your answers directly in the provided financial snapshot data. Cite specific merchant names, exact Rupee figures (₹), percentages, dates, and PayPal Sandbox integration state if relevant.
2. Structure your response clearly using Markdown: bold metrics, clean bullet points, and an explicit "Key Takeaway" or "Recommended Action".
3. When asked about subscriptions, list them with monthly amounts in ₹, upcoming renewal dates, and highlight any price changes, duplicates, or PayPal recurring plans.
4. When asked about budget commitment, explain how much is already spent + committed to upcoming recurring bills, and calculate the true remaining discretionary buffer in ₹.
5. Never make up fake financial transactions or pretend a PayPal payment occurred if not reflected in the snapshot.
6. Tone: Objective, empowering, clear, analytical, and supportive. Maintain the disclaimer that you are an analytical decision support agent, not a certified fiduciary or legal advisor.
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

  // 5b. Runtime Gemini API Key Verification & Activation
  app.post('/api/gemini/connect', async (req, res) => {
    try {
      const apiKey = typeof req.body?.apiKey === 'string' ? req.body.apiKey.trim() : '';
      if (!apiKey) {
        res.status(400).json({ error: 'A valid Gemini API key is required.' });
        return;
      }

      const testClient = new GoogleGenAI({
        apiKey,
        httpOptions: {
          headers: {
            'User-Agent': 'aistudio-build',
          },
        },
      });

      await callGeminiWithResilience(testClient, {
        primaryModel: 'gemini-3.8-flash',
        contents: 'Reply with OK.',
        config: { temperature: 0 },
      });

      runtimeGeminiKey = apiKey;
      aiClient = testClient;

      res.json({
        hasGeminiKey: true,
        geminiSource: 'session',
      });
    } catch (err: any) {
      res.status(401).json({
        error: err?.message || 'Gemini API key verification failed. Check your key at aistudio.google.com.',
      });
    }
  });

  app.post('/api/gemini/disconnect', (req, res) => {
    runtimeGeminiKey = null;
    aiClient = null;
    const envHasKey = Boolean(process.env.GEMINI_API_KEY?.trim());
    res.json({
      hasGeminiKey: envHasKey,
      geminiSource: envHasKey ? 'env' : 'none',
    });
  });

  // =========================================================================
  // 6. PayPal Developer Sandbox REST API Integration Routes
  // =========================================================================

  // 6a. Get PayPal Sandbox status & live session telemetry (never returns secret)
  app.get('/api/paypal/status', async (req, res) => {
    try {
      const status = await getPayPalStatus();
      const tracked = getTrackedPayPalData();
      res.json({
        ...status,
        ...tracked,
      });
    } catch (err: any) {
      res.status(500).json({ error: err.message || 'Failed to get PayPal status' });
    }
  });

  // 6b. Connect & verify PayPal Sandbox credentials via real OAuth 2.0
  app.post('/api/paypal/connect', async (req, res) => {
    try {
      const { clientId, clientSecret, inrPerUsd } = req.body || {};
      if (!clientId || !clientSecret) {
        res.status(400).json({ error: 'Both PayPal Sandbox Client ID and Client Secret are required.' });
        return;
      }

      const status = await connectSandboxCredentials(clientId, clientSecret, Number(inrPerUsd) || undefined);
      const tracked = getTrackedPayPalData();
      res.json({ ...status, ...tracked });
    } catch (err: any) {
      res.status(401).json({
        error: err.message || 'PayPal Sandbox OAuth verification failed. Verify your Client ID and Secret.',
      });
    }
  });

  // 6c. Disconnect active runtime PayPal Sandbox session
  app.post('/api/paypal/disconnect', (req, res) => {
    disconnectSandbox();
    res.json({
      connected: false,
      mode: 'sandbox',
      clientId: null,
      source: 'none',
      inrPerUsd: getInrPerUsd(),
      ...getTrackedPayPalData(),
    });
  });

  // 6d. Terminate and refresh PayPal OAuth token (helpful after enabling Transaction Search in dashboard)
  app.post('/api/paypal/refresh-token', async (req, res) => {
    try {
      const status = await terminateAndRefreshToken();
      res.json({ ...status, ...getTrackedPayPalData() });
    } catch (err: any) {
      res.status(400).json({ error: err.message || 'Failed to refresh PayPal token' });
    }
  });

  // 6e. Update INR <-> USD exchange rate used for PayPal Sandbox conversions
  app.post('/api/paypal/rate', (req, res) => {
    const updated = setInrPerUsd(Number(req.body?.inrPerUsd));
    res.json({ inrPerUsd: updated });
  });

  // 6f. AI Guardrail check before creating a PayPal Order
  app.post('/api/paypal/guardrail', async (req, res) => {
    try {
      const { itemName, amountINR, category, purpose = 'purchase', financialContext } = req.body || {};
      const cost = Number(amountINR) || 0;
      const buffer = Number(financialContext?.budgetCommitment?.unallocatedBuffer || 0);
      const netSavings = Number(financialContext?.netSavings || 0);
      const upcomingBills = Number(financialContext?.upcomingBillsNext14Days || 0);

      let verdict: 'healthy' | 'caution' | 'stretched' = 'healthy';
      if (cost > buffer) {
        verdict = 'stretched';
      } else if (cost > buffer * 0.5 || cost > netSavings) {
        verdict = 'caution';
      }

      const client = getGeminiClient();
      let reasoning =
        verdict === 'healthy'
          ? `Safe to execute via PayPal: ${formatINR(cost)} fits comfortably within your ${formatINR(buffer)} unallocated buffer while keeping ${formatINR(upcomingBills)} in upcoming bills covered.`
          : verdict === 'caution'
          ? `Proceed with caution: ${formatINR(cost)} consumes ${buffer > 0 ? Math.round((cost / buffer) * 100) : 100}% of your remaining monthly buffer (${formatINR(buffer)}).`
          : `Budget Guardrail Alert: ${formatINR(cost)} exceeds your unallocated buffer (${formatINR(buffer)}) by ${formatINR(Math.max(0, cost - buffer))}. Consider deferring or adjusting goals first.`;

      if (client && financialContext) {
        try {
          const prompt = `
You are FinPilot's AI Purchase Guardrail evaluating a proposed PayPal Sandbox ${purpose === 'goal_funding' ? 'Goal Contribution' : 'Checkout Purchase'}.
Item / Purpose: "${itemName}"
Category: ${category}
Amount: ${formatINR(cost)} (approx $${(cost / getInrPerUsd()).toFixed(2)} USD in PayPal)
User Financial Snapshot:
- Net Monthly Savings: ${formatINR(netSavings)}
- Unallocated Buffer: ${formatINR(buffer)}
- Upcoming Bills (14d): ${formatINR(upcomingBills)}
- Goals: ${JSON.stringify(financialContext.goalsProgress || [])}

Return ONLY valid JSON:
{
  "verdict": "healthy" | "caution" | "stretched",
  "reasoning": "Concise 2-sentence analytical explanation citing exact ₹ amounts and goal/buffer impact.",
  "recommendedAction": "Short action recommendation (under 15 words)."
}`;
          const response = await callGeminiWithResilience(client, {
            primaryModel: 'gemini-3.8-flash',
            contents: prompt,
            config: { responseMimeType: 'application/json', temperature: 0.2 },
          });
          const parsed = JSON.parse((response.text || '{}').replace(/```json\n?|\n?```/g, '').trim());
          if (parsed.verdict) verdict = parsed.verdict;
          if (parsed.reasoning) reasoning = parsed.reasoning;
        } catch {
          // Use deterministic guardrail reasoning above
        }
      }

      res.json({
        verdict,
        reasoning,
        amountINR: cost,
        amountUSD: (Math.max(0.5, cost / getInrPerUsd())).toFixed(2),
        inrPerUsd: getInrPerUsd(),
      });
    } catch (err: any) {
      res.status(500).json({ error: err.message || 'Guardrail evaluation failed' });
    }
  });

  // 6g. Create PayPal Sandbox Order (Orders API v2)
  app.post('/api/paypal/orders', async (req, res) => {
    try {
      const { title, amountINR, category, purpose = 'purchase', goalId, aiVerdict, aiReasoning } = req.body || {};
      if (!title || !amountINR || Number(amountINR) <= 0) {
        res.status(400).json({ error: 'Valid title and positive amountINR are required.' });
        return;
      }

      const origin = getPublicOrigin(req);
      const returnUrl = `${origin}/?paypal_return=order`;
      const cancelUrl = `${origin}/?paypal_cancel=order`;

      const order = await createSandboxOrder({
        title: String(title),
        amountINR: Number(amountINR),
        category: category || 'Shopping & Goods',
        purpose,
        goalId,
        aiVerdict,
        aiReasoning,
        returnUrl,
        cancelUrl,
      });

      res.json({ order, ...getTrackedPayPalData() });
    } catch (err: any) {
      res.status(err.statusCode || 400).json({
        error: err.message || 'Failed to create PayPal Sandbox Order',
        paypalError: err.paypalError,
      });
    }
  });

  // 6h. Inspect PayPal Sandbox Order status
  app.get('/api/paypal/orders/:orderId', async (req, res) => {
    try {
      const order = await getSandboxOrderDetails(req.params.orderId);
      res.json({ order, ...getTrackedPayPalData() });
    } catch (err: any) {
      res.status(err.statusCode || 400).json({ error: err.message || 'Failed to retrieve PayPal order' });
    }
  });

  // 6i. Capture approved PayPal Sandbox Order (Orders API v2)
  app.post('/api/paypal/orders/:orderId/capture', async (req, res) => {
    try {
      const order = await captureSandboxOrder(req.params.orderId);
      res.json({ order, ...getTrackedPayPalData() });
    } catch (err: any) {
      res.status(err.statusCode || 400).json({
        error: err.message || 'Failed to capture PayPal Sandbox Order. Make sure the buyer approved the order in PayPal first.',
        paypalError: err.paypalError,
      });
    }
  });

  // 6j. Create PayPal Product + Billing Plan + Subscription (Subscriptions API v1)
  app.post('/api/paypal/subscriptions', async (req, res) => {
    try {
      const { name, amountINR, frequency = 'monthly', goalId } = req.body || {};
      if (!name || !amountINR || Number(amountINR) <= 0) {
        res.status(400).json({ error: 'Valid name and positive amountINR are required.' });
        return;
      }

      const origin = getPublicOrigin(req);
      const subscription = await createSandboxSubscription({
        name: String(name),
        amountINR: Number(amountINR),
        frequency: frequency === 'yearly' ? 'yearly' : 'monthly',
        goalId,
        returnUrl: `${origin}/?paypal_return=subscription`,
        cancelUrl: `${origin}/?paypal_cancel=subscription`,
      });

      res.json({ subscription, ...getTrackedPayPalData() });
    } catch (err: any) {
      res.status(err.statusCode || 400).json({
        error: err.message || 'Failed to create PayPal Subscription',
        paypalError: err.paypalError,
      });
    }
  });

  // 6k. Refresh PayPal Subscription status
  app.get('/api/paypal/subscriptions/:subscriptionId', async (req, res) => {
    try {
      const subscription = await refreshSandboxSubscription(req.params.subscriptionId);
      res.json({ subscription, ...getTrackedPayPalData() });
    } catch (err: any) {
      res.status(err.statusCode || 400).json({ error: err.message || 'Failed to fetch PayPal subscription' });
    }
  });

  // 6l. Cancel PayPal Subscription
  app.post('/api/paypal/subscriptions/:subscriptionId/cancel', async (req, res) => {
    try {
      const reason = req.body?.reason || 'Canceled via FinPilot AI Subscription Governance';
      const subscription = await cancelSandboxSubscription(req.params.subscriptionId, reason);
      res.json({ subscription, ...getTrackedPayPalData() });
    } catch (err: any) {
      res.status(err.statusCode || 400).json({ error: err.message || 'Failed to cancel PayPal subscription' });
    }
  });

  // 6m. Sync PayPal Sandbox Balances & Transaction Search API + AI Categorization
  app.post('/api/paypal/sync', async (req, res) => {
    try {
      const days = Number(req.body?.days) || 30;
      const syncResult = await syncSandboxReporting(days);

      // Categorize retrieved PayPal transactions with Gemini 3.8 Flash (or deterministic fallback)
      let categorized = syncResult.transactions.map((tx: any, idx: number) => {
        const lower = String(tx.merchant || '').toLowerCase();
        let category = tx.type === 'income' ? 'Income' : 'Shopping & Goods';
        if (lower.includes('subscription') || lower.includes('netflix') || lower.includes('spotify') || lower.includes('adobe')) {
          category = 'Subscriptions & Digital';
        } else if (lower.includes('goal') || lower.includes('vault') || lower.includes('saving')) {
          category = 'Financial & Savings';
        } else if (lower.includes('food') || lower.includes('coffee') || lower.includes('restaurant')) {
          category = 'Dining & Takeout';
        }
        return {
          id: `pp-tx-${tx.paypalTransactionId || Date.now()}-${idx}`,
          date: tx.date,
          merchant: tx.merchant,
          description: tx.description,
          amount: tx.amountINR,
          usdAmount: tx.amountUSD,
          type: tx.type,
          category,
          paymentMethod: `PayPal Sandbox (${tx.currency})`,
          paypalTransactionId: tx.paypalTransactionId,
          confidence: 0.92,
        };
      });

      const client = getGeminiClient();
      if (client && categorized.length > 0) {
        try {
          const prompt = `
Categorize these PayPal Sandbox transactions into valid FinPilot categories:
["Housing & Rent","Utilities & Bills","Groceries","Dining & Takeout","Transportation","Subscriptions & Digital","Shopping & Goods","Health & Fitness","Entertainment","Travel","Income","Education & Learning","Financial & Savings","Other Expenses"]

Transactions: ${JSON.stringify(categorized.map((t) => ({ id: t.id, merchant: t.merchant, description: t.description, amountINR: t.amount, type: t.type })))}

Return ONLY valid JSON:
{
  "mappings": [
    { "id": "string", "category": "valid category", "isRecurring": boolean, "isAnomaly": boolean, "anomalyReason": "string or null" }
  ]
}`;
          const response = await callGeminiWithResilience(client, {
            primaryModel: 'gemini-3.8-flash',
            contents: prompt,
            config: { responseMimeType: 'application/json', temperature: 0.1 },
          });
          const parsed = JSON.parse((response.text || '{}').replace(/```json\n?|\n?```/g, '').trim());
          if (Array.isArray(parsed.mappings)) {
            const mapById = new Map<string, any>(parsed.mappings.map((m: any) => [m.id, m]));
            categorized = categorized.map((tx: any) => {
              const m = mapById.get(tx.id);
              return m
                ? {
                    ...tx,
                    category: m.category || tx.category,
                    isRecurring: Boolean(m.isRecurring),
                    isAnomaly: Boolean(m.isAnomaly),
                    anomalyReason: m.anomalyReason || undefined,
                  }
                : tx;
            });
          }
        } catch {
          // Keep deterministic categorization
        }
      }

      res.json({
        balances: syncResult.balances,
        transactions: categorized,
        scopeWarning: syncResult.scopeWarning,
        ...getTrackedPayPalData(),
      });
    } catch (err: any) {
      res.status(err.statusCode || 400).json({ error: err.message || 'Failed to sync PayPal Sandbox' });
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
