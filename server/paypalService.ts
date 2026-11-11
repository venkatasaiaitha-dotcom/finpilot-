import type {
  Category,
  PayPalApiLogEntry,
  PayPalOrderRecord,
  PayPalStatusResponse,
  PayPalSubscriptionRecord,
  PayPalWalletBalance,
} from '../src/types';

const PAYPAL_SANDBOX_BASE = 'https://api-m.sandbox.paypal.com';
const DEFAULT_INR_PER_USD = Number(process.env.PAYPAL_INR_PER_USD) || 84.5;

interface SandboxSessionState {
  clientId: string | null;
  clientSecret: string | null;
  source: 'env' | 'session' | 'none';
  accessToken: string | null;
  expiresAtMs: number;
  appId?: string;
  scopes: string[];
  inrPerUsd: number;
  lastError: string | null;
}

const sessionState: SandboxSessionState = {
  clientId: process.env.PAYPAL_CLIENT_ID?.trim() || null,
  clientSecret: process.env.PAYPAL_CLIENT_SECRET?.trim() || null,
  source: process.env.PAYPAL_CLIENT_ID && process.env.PAYPAL_CLIENT_SECRET ? 'env' : 'none',
  accessToken: null,
  expiresAtMs: 0,
  scopes: [],
  inrPerUsd: DEFAULT_INR_PER_USD,
  lastError: null,
};

// Rolling in-memory inspection store for hackathon transparency & live telemetry
const apiLogs: PayPalApiLogEntry[] = [];
const trackedOrders = new Map<string, PayPalOrderRecord>();
const trackedSubscriptions = new Map<string, PayPalSubscriptionRecord>();

function recordApiLog(
  method: 'GET' | 'POST',
  endpoint: string,
  statusCode: number,
  summary: string,
  durationMs: number
) {
  apiLogs.unshift({
    id: `pp-log-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    timestamp: new Date().toISOString(),
    method,
    endpoint,
    statusCode,
    summary,
    durationMs,
  });
  if (apiLogs.length > 40) {
    apiLogs.length = 40;
  }
}

export function getInrPerUsd(): number {
  return sessionState.inrPerUsd || DEFAULT_INR_PER_USD;
}

export function setInrPerUsd(rate: number): number {
  if (Number.isFinite(rate) && rate > 1 && rate < 500) {
    sessionState.inrPerUsd = Number(rate.toFixed(2));
  }
  return sessionState.inrPerUsd;
}

export function convertINRToUSDString(amountINR: number): string {
  const usd = Math.max(0.5, Number(amountINR || 0) / getInrPerUsd());
  return usd.toFixed(2);
}

function getEffectiveCredentials(): { clientId: string; clientSecret: string } | null {
  // Check env lazily in case dotenv loaded after module import
  if (!sessionState.clientId && process.env.PAYPAL_CLIENT_ID?.trim()) {
    sessionState.clientId = process.env.PAYPAL_CLIENT_ID.trim();
  }
  if (!sessionState.clientSecret && process.env.PAYPAL_CLIENT_SECRET?.trim()) {
    sessionState.clientSecret = process.env.PAYPAL_CLIENT_SECRET.trim();
  }
  if (
    sessionState.source === 'none' &&
    sessionState.clientId &&
    sessionState.clientSecret
  ) {
    sessionState.source = 'env';
  }

  if (!sessionState.clientId || !sessionState.clientSecret) {
    return null;
  }
  return { clientId: sessionState.clientId, clientSecret: sessionState.clientSecret };
}

export async function fetchSandboxOAuthToken(forceRefresh = false): Promise<string> {
  const creds = getEffectiveCredentials();
  if (!creds) {
    throw new Error(
      'PayPal Sandbox credentials are not configured. Set PAYPAL_CLIENT_ID and PAYPAL_CLIENT_SECRET in .env or connect in Settings.'
    );
  }

  const now = Date.now();
  if (!forceRefresh && sessionState.accessToken && now < sessionState.expiresAtMs - 60_000) {
    return sessionState.accessToken;
  }

  const basicAuth = Buffer.from(`${creds.clientId}:${creds.clientSecret}`).toString('base64');
  const start = Date.now();
  const res = await fetch(`${PAYPAL_SANDBOX_BASE}/v1/oauth2/token`, {
    method: 'POST',
    headers: {
      Authorization: `Basic ${basicAuth}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: 'grant_type=client_credentials',
  });

  const durationMs = Date.now() - start;
  const data = (await res.json().catch(() => ({}))) as any;

  if (!res.ok || !data.access_token) {
    const errMsg = data.error_description || data.message || `OAuth failed with HTTP ${res.status}`;
    sessionState.accessToken = null;
    sessionState.expiresAtMs = 0;
    sessionState.lastError = errMsg;
    recordApiLog('POST', '/v1/oauth2/token', res.status, `OAuth failed: ${errMsg}`, durationMs);
    throw new Error(errMsg);
  }

  sessionState.accessToken = data.access_token;
  sessionState.expiresAtMs = now + (Number(data.expires_in) || 32400) * 1000;
  sessionState.appId = data.app_id;
  sessionState.scopes = typeof data.scope === 'string' ? data.scope.split(/\s+/).filter(Boolean) : [];
  sessionState.lastError = null;

  recordApiLog(
    'POST',
    '/v1/oauth2/token',
    res.status,
    `Issued Sandbox OAuth token (${sessionState.scopes.length} scopes)`,
    durationMs
  );

  return data.access_token;
}

export async function connectSandboxCredentials(
  clientId: string,
  clientSecret: string,
  inrPerUsd?: number
): Promise<PayPalStatusResponse> {
  const prev = { ...sessionState };
  sessionState.clientId = clientId.trim();
  sessionState.clientSecret = clientSecret.trim();
  sessionState.source = 'session';
  sessionState.accessToken = null;
  sessionState.expiresAtMs = 0;
  if (inrPerUsd) setInrPerUsd(inrPerUsd);

  try {
    await fetchSandboxOAuthToken(true);
    return await getPayPalStatus();
  } catch (err) {
    // Restore previous credentials if verification fails
    Object.assign(sessionState, prev);
    throw err;
  }
}

export function disconnectSandbox(): void {
  sessionState.clientId = null;
  sessionState.clientSecret = null;
  sessionState.source = 'none';
  sessionState.accessToken = null;
  sessionState.expiresAtMs = 0;
  sessionState.appId = undefined;
  sessionState.scopes = [];
  sessionState.lastError = null;
}

export async function terminateAndRefreshToken(): Promise<PayPalStatusResponse> {
  const creds = getEffectiveCredentials();
  if (!creds) throw new Error('No PayPal Sandbox credentials configured.');

  if (sessionState.accessToken) {
    const basicAuth = Buffer.from(`${creds.clientId}:${creds.clientSecret}`).toString('base64');
    const start = Date.now();
    const res = await fetch(`${PAYPAL_SANDBOX_BASE}/v1/oauth2/token/terminate`, {
      method: 'POST',
      headers: {
        Authorization: `Basic ${basicAuth}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: `token=${encodeURIComponent(sessionState.accessToken)}&token_type_hint=ACCESS_TOKEN`,
    });
    recordApiLog(
      'POST',
      '/v1/oauth2/token/terminate',
      res.status,
      'Terminated cached OAuth token to refresh dashboard scopes',
      Date.now() - start
    );
  }

  await fetchSandboxOAuthToken(true);
  return getPayPalStatus();
}

async function paypalFetch<T = any>(
  method: 'GET' | 'POST',
  endpoint: string,
  body?: unknown,
  summaryOverride?: string
): Promise<T> {
  let token = await fetchSandboxOAuthToken(false);

  const execute = async (bearer: string) => {
    const start = Date.now();
    const res = await fetch(`${PAYPAL_SANDBOX_BASE}${endpoint}`, {
      method,
      headers: {
        Authorization: `Bearer ${bearer}`,
        'Content-Type': 'application/json',
        Prefer: 'return=representation',
      },
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });
    const durationMs = Date.now() - start;
    const raw = await res.text();
    let json: any = {};
    try {
      json = raw ? JSON.parse(raw) : {};
    } catch {
      json = { raw };
    }
    return { res, json, durationMs };
  };

  let attempt = await execute(token);
  if (attempt.res.status === 401) {
    token = await fetchSandboxOAuthToken(true);
    attempt = await execute(token);
  }

  const summary =
    summaryOverride ||
    (attempt.res.ok
      ? `${method} ${endpoint} succeeded`
      : `Error ${attempt.json?.name || attempt.res.status}: ${attempt.json?.message || 'Request failed'}`);

  recordApiLog(method, endpoint, attempt.res.status, summary, attempt.durationMs);

  if (!attempt.res.ok) {
    const detailMsg = attempt.json?.details?.[0]?.description || attempt.json?.message || attempt.json?.error_description;
    const err = new Error(detailMsg || `PayPal API returned HTTP ${attempt.res.status}`) as Error & {
      statusCode?: number;
      paypalError?: any;
    };
    err.statusCode = attempt.res.status;
    err.paypalError = attempt.json;
    throw err;
  }

  return attempt.json as T;
}

export async function getPayPalStatus(): Promise<PayPalStatusResponse> {
  const creds = getEffectiveCredentials();
  if (!creds) {
    return {
      connected: false,
      mode: 'sandbox',
      clientId: null,
      source: 'none',
      inrPerUsd: getInrPerUsd(),
      lastError: sessionState.lastError,
    };
  }

  try {
    if (!sessionState.accessToken || Date.now() >= sessionState.expiresAtMs - 60_000) {
      await fetchSandboxOAuthToken(false);
    }

    const hasSearch = sessionState.scopes.some((s) => s.includes('reporting/search'));
    return {
      connected: Boolean(sessionState.accessToken),
      mode: 'sandbox',
      clientId: creds.clientId,
      source: sessionState.source,
      appId: sessionState.appId,
      scopes: sessionState.scopes,
      hasTransactionSearchScope: hasSearch,
      inrPerUsd: getInrPerUsd(),
      tokenExpiresAt: sessionState.expiresAtMs ? new Date(sessionState.expiresAtMs).toISOString() : undefined,
      lastError: sessionState.lastError,
    };
  } catch (err: any) {
    return {
      connected: false,
      mode: 'sandbox',
      clientId: creds.clientId,
      source: sessionState.source,
      inrPerUsd: getInrPerUsd(),
      lastError: err.message,
    };
  }
}

export async function createSandboxOrder(params: {
  title: string;
  amountINR: number;
  category: Category;
  purpose: 'purchase' | 'goal_funding';
  goalId?: string;
  aiVerdict?: 'healthy' | 'caution' | 'stretched';
  aiReasoning?: string;
  returnUrl: string;
  cancelUrl: string;
}): Promise<PayPalOrderRecord> {
  const amountUSD = convertINRToUSDString(params.amountINR);

  const payload = {
    intent: 'CAPTURE',
    purchase_units: [
      {
        reference_id: `${params.purpose}-${Date.now()}`,
        description: `FinPilot (${params.purpose === 'goal_funding' ? 'Goal Vault' : 'AI-Guarded Purchase'}): ${params.title}`.slice(0, 127),
        custom_id: `${params.purpose}|${params.category}|${params.goalId || 'none'}`.slice(0, 127),
        amount: {
          currency_code: 'USD',
          value: amountUSD,
        },
      },
    ],
    application_context: {
      brand_name: 'FinPilot AI Decision Guard',
      landing_page: 'NO_PREFERENCE',
      shipping_preference: 'NO_SHIPPING',
      user_action: 'PAY_NOW',
      return_url: params.returnUrl,
      cancel_url: params.cancelUrl,
    },
  };

  const data = await paypalFetch<any>(
    'POST',
    '/v2/checkout/orders',
    payload,
    `Created PayPal Order for ${params.title} ($${amountUSD} USD)`
  );

  const approveLink = Array.isArray(data.links)
    ? data.links.find((l: any) => l.rel === 'approve' || l.rel === 'payer-action')?.href
    : undefined;

  const record: PayPalOrderRecord = {
    orderId: data.id,
    status: data.status || 'CREATED',
    purpose: params.purpose,
    title: params.title,
    amountINR: Number(params.amountINR),
    amountUSD,
    category: params.category,
    goalId: params.goalId,
    approveUrl: approveLink,
    aiVerdict: params.aiVerdict,
    aiReasoning: params.aiReasoning,
    createdAt: data.create_time || new Date().toISOString(),
  };

  trackedOrders.set(record.orderId, record);
  return record;
}

export async function getSandboxOrderDetails(orderId: string): Promise<PayPalOrderRecord> {
  const data = await paypalFetch<any>(
    'GET',
    `/v2/checkout/orders/${encodeURIComponent(orderId)}`,
    undefined,
    `Checked order ${orderId}`
  );

  const existing = trackedOrders.get(orderId);
  const unit = data.purchase_units?.[0];
  const capture = unit?.payments?.captures?.[0];
  const customParts = typeof unit?.custom_id === 'string' ? unit.custom_id.split('|') : [];
  const usdVal = Number(unit?.amount?.value || existing?.amountUSD || 0);

  const record: PayPalOrderRecord = {
    orderId: data.id,
    status: data.status,
    purpose: (existing?.purpose || (customParts[0] as any) || 'purchase'),
    title: existing?.title || unit?.description || `PayPal Order ${data.id}`,
    amountINR: existing?.amountINR || Math.round(usdVal * getInrPerUsd()),
    amountUSD: unit?.amount?.value || existing?.amountUSD || '0.00',
    category: (existing?.category || (customParts[1] as Category) || 'Shopping & Goods'),
    goalId: existing?.goalId || (customParts[2] !== 'none' ? customParts[2] : undefined),
    approveUrl: existing?.approveUrl,
    captureId: capture?.id || existing?.captureId,
    payerEmail: data.payer?.email_address || existing?.payerEmail,
    aiVerdict: existing?.aiVerdict,
    aiReasoning: existing?.aiReasoning,
    createdAt: existing?.createdAt || data.create_time || new Date().toISOString(),
    capturedAt: capture?.create_time || existing?.capturedAt,
  };

  trackedOrders.set(orderId, record);
  return record;
}

export async function captureSandboxOrder(orderId: string): Promise<PayPalOrderRecord> {
  // Check order status first so if already completed we return real details cleanly
  const current = await getSandboxOrderDetails(orderId);
  if (current.status === 'COMPLETED' && current.captureId) {
    return current;
  }

  const data = await paypalFetch<any>(
    'POST',
    `/v2/checkout/orders/${encodeURIComponent(orderId)}/capture`,
    {},
    `Captured PayPal Order ${orderId}`
  );

  const unit = data.purchase_units?.[0];
  const capture = unit?.payments?.captures?.[0];
  const existing = trackedOrders.get(orderId);
  const usdVal = Number(capture?.amount?.value || unit?.amount?.value || existing?.amountUSD || 0);

  const record: PayPalOrderRecord = {
    orderId: data.id,
    status: data.status || 'COMPLETED',
    purpose: existing?.purpose || 'purchase',
    title: existing?.title || unit?.description || `PayPal Order ${data.id}`,
    amountINR: existing?.amountINR || Math.round(usdVal * getInrPerUsd()),
    amountUSD: capture?.amount?.value || existing?.amountUSD || usdVal.toFixed(2),
    category: existing?.category || 'Shopping & Goods',
    goalId: existing?.goalId,
    approveUrl: existing?.approveUrl,
    captureId: capture?.id,
    payerEmail: data.payer?.email_address,
    aiVerdict: existing?.aiVerdict,
    aiReasoning: existing?.aiReasoning,
    createdAt: existing?.createdAt || new Date().toISOString(),
    capturedAt: capture?.create_time || new Date().toISOString(),
  };

  trackedOrders.set(orderId, record);
  return record;
}

export async function createSandboxSubscription(params: {
  name: string;
  amountINR: number;
  frequency: 'monthly' | 'yearly';
  goalId?: string;
  returnUrl: string;
  cancelUrl: string;
}): Promise<PayPalSubscriptionRecord> {
  const amountUSD = convertINRToUSDString(params.amountINR);

  // 1. Create Catalog Product
  const product = await paypalFetch<any>(
    'POST',
    '/v1/catalogs/products',
    {
      name: `FinPilot Plan: ${params.name}`.slice(0, 127),
      description: 'Automated recurring contribution / obligation tracked by FinPilot AI',
      type: 'SERVICE',
      category: 'SOFTWARE',
    },
    `Created PayPal Product for ${params.name}`
  );

  // 2. Create Billing Plan
  const intervalUnit = params.frequency === 'yearly' ? 'YEAR' : 'MONTH';
  const plan = await paypalFetch<any>(
    'POST',
    '/v1/billing/plans',
    {
      product_id: product.id,
      name: `${params.name} (${params.frequency})`.slice(0, 127),
      description: `Recurring ${params.frequency} PayPal plan (₹${params.amountINR} ≈ $${amountUSD} USD)`,
      status: 'ACTIVE',
      billing_cycles: [
        {
          frequency: {
            interval_unit: intervalUnit,
            interval_count: 1,
          },
          tenure_type: 'REGULAR',
          sequence: 1,
          total_cycles: 0,
          pricing_scheme: {
            fixed_price: {
              value: amountUSD,
              currency_code: 'USD',
            },
          },
        },
      ],
      payment_preferences: {
        auto_bill_outstanding: true,
        setup_fee_failure_action: 'CONTINUE',
        payment_failure_threshold: 3,
      },
    },
    `Created PayPal Billing Plan ($${amountUSD}/${intervalUnit.toLowerCase()})`
  );

  // 3. Create Subscription
  const sub = await paypalFetch<any>(
    'POST',
    '/v1/billing/subscriptions',
    {
      plan_id: plan.id,
      custom_id: params.goalId ? `goal:${params.goalId}` : 'finpilot-recurring',
      application_context: {
        brand_name: 'FinPilot Auto-Save & Subscriptions',
        user_action: 'SUBSCRIBE_NOW',
        payment_method: {
          payer_selected: 'PAYPAL',
          payee_preferred: 'IMMEDIATE_PAYMENT_REQUIRED',
        },
        return_url: params.returnUrl,
        cancel_url: params.cancelUrl,
      },
    },
    `Created PayPal Subscription (${plan.id})`
  );

  const approveLink = Array.isArray(sub.links)
    ? sub.links.find((l: any) => l.rel === 'approve')?.href
    : undefined;

  const record: PayPalSubscriptionRecord = {
    subscriptionId: sub.id,
    planId: plan.id,
    productId: product.id,
    name: params.name,
    amountINR: Number(params.amountINR),
    amountUSD,
    frequency: params.frequency,
    status: sub.status || 'APPROVAL_PENDING',
    approveUrl: approveLink,
    goalId: params.goalId,
    createdAt: sub.create_time || new Date().toISOString(),
  };

  trackedSubscriptions.set(record.subscriptionId, record);
  return record;
}

export async function refreshSandboxSubscription(subscriptionId: string): Promise<PayPalSubscriptionRecord> {
  const data = await paypalFetch<any>(
    'GET',
    `/v1/billing/subscriptions/${encodeURIComponent(subscriptionId)}`,
    undefined,
    `Fetched subscription ${subscriptionId} status`
  );

  const existing = trackedSubscriptions.get(subscriptionId);
  const record: PayPalSubscriptionRecord = {
    subscriptionId: data.id,
    planId: data.plan_id || existing?.planId || '',
    productId: existing?.productId || '',
    name: existing?.name || `PayPal Subscription ${data.id}`,
    amountINR: existing?.amountINR || 0,
    amountUSD: data.billing_info?.last_payment?.amount?.value || existing?.amountUSD || '0.00',
    frequency: existing?.frequency || 'monthly',
    status: data.status || existing?.status || 'UNKNOWN',
    approveUrl: existing?.approveUrl,
    goalId: existing?.goalId,
    createdAt: existing?.createdAt || data.create_time || new Date().toISOString(),
  };

  trackedSubscriptions.set(subscriptionId, record);
  return record;
}

export async function cancelSandboxSubscription(
  subscriptionId: string,
  reason = 'Canceled via FinPilot AI Subscription Governance'
): Promise<PayPalSubscriptionRecord> {
  await paypalFetch(
    'POST',
    `/v1/billing/subscriptions/${encodeURIComponent(subscriptionId)}/cancel`,
    { reason },
    `Canceled PayPal Subscription ${subscriptionId}`
  );
  return refreshSandboxSubscription(subscriptionId);
}

export async function syncSandboxReporting(days = 30): Promise<{
  balances: PayPalWalletBalance[];
  transactions: any[];
  scopeWarning?: string;
}> {
  const end = new Date();
  const start = new Date(end.getTime() - Math.min(31, Math.max(1, days)) * 24 * 60 * 60 * 1000);
  const startIso = start.toISOString();
  const endIso = end.toISOString();

  const balances: PayPalWalletBalance[] = [];
  let transactions: any[] = [];
  let scopeWarning: string | undefined;

  // 1. Attempt PayPal Balances API
  try {
    const balData = await paypalFetch<any>(
      'GET',
      `/v1/reporting/balances?as_of_time=${encodeURIComponent(endIso)}`,
      undefined,
      'Fetched PayPal Sandbox wallet balances'
    );
    if (Array.isArray(balData.balances)) {
      for (const b of balData.balances) {
        balances.push({
          currency: b.currency,
          totalValue: b.total_balance?.value || '0.00',
          availableValue: b.available_balance?.value || '0.00',
          withheldValue: b.withheld_balance?.value || '0.00',
        });
      }
    }
  } catch (err: any) {
    if (err.statusCode === 403 || err.statusCode === 401) {
      scopeWarning =
        'Transaction Search scope is not enabled on this PayPal Sandbox app yet. Enable "Transaction Search" under Apps & Credentials -> App Features in developer.paypal.com and click Refresh Token.';
    }
  }

  // 2. Attempt PayPal Transaction Search API
  try {
    const txData = await paypalFetch<any>(
      'GET',
      `/v1/reporting/transactions?start_date=${encodeURIComponent(startIso)}&end_date=${encodeURIComponent(
        endIso
      )}&fields=all&page_size=25`,
      undefined,
      `Synced PayPal Sandbox transactions (last ${days} days)`
    );

    if (Array.isArray(txData.transaction_details)) {
      transactions = txData.transaction_details.map((item: any) => {
        const info = item.transaction_info || {};
        const payer = item.payer_info || {};
        const cart = item.cart_info || {};
        const rawAmount = Number(info.transaction_amount?.value || 0);
        const currency = info.transaction_amount?.currency_code || 'USD';
        const isCredit = rawAmount > 0;
        const absUsd = Math.abs(rawAmount);
        const amountINR = currency === 'INR' ? absUsd : Math.round(absUsd * getInrPerUsd() * 100) / 100;

        const merchantName =
          payer.payer_name?.alternate_full_name ||
          cart.item_details?.[0]?.item_name ||
          info.transaction_subject ||
          info.transaction_event_code ||
          'PayPal Sandbox Transaction';

        return {
          paypalTransactionId: info.transaction_id,
          date: (info.transaction_initiation_date || new Date().toISOString()).slice(0, 10),
          merchant: merchantName,
          description: `PayPal ${info.transaction_status || 'S'} (${currency} ${absUsd.toFixed(2)})`,
          amountUSD: absUsd,
          currency,
          amountINR,
          type: isCredit ? 'income' : 'expense',
          status: info.transaction_status,
        };
      });
    }
  } catch (err: any) {
    if (err.statusCode === 403 || err.statusCode === 401) {
      scopeWarning =
        'Transaction Search scope is not enabled on this PayPal Sandbox app yet. Enable "Transaction Search" under Apps & Credentials -> App Features in developer.paypal.com and click Refresh Token.';
    } else if (!scopeWarning) {
      scopeWarning = err.message;
    }
  }

  return { balances, transactions, scopeWarning };
}

export function getTrackedPayPalData() {
  return {
    orders: Array.from(trackedOrders.values()).sort((a, b) => b.createdAt.localeCompare(a.createdAt)),
    subscriptions: Array.from(trackedSubscriptions.values()).sort((a, b) =>
      b.createdAt.localeCompare(a.createdAt)
    ),
    apiLogs: [...apiLogs],
  };
}
