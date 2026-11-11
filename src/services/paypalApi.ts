import type {
  Category,
  FinancialContextSnapshot,
  PayPalApiLogEntry,
  PayPalOrderRecord,
  PayPalStatusResponse,
  PayPalSubscriptionRecord,
  PayPalWalletBalance,
  Transaction,
} from '../types';

export interface PayPalFullState extends PayPalStatusResponse {
  orders: PayPalOrderRecord[];
  subscriptions: PayPalSubscriptionRecord[];
  apiLogs: PayPalApiLogEntry[];
}

async function handleApiResponse<T>(res: Response): Promise<T> {
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(data.error || `Request failed with status ${res.status}`);
  }
  return data as T;
}

export async function getPayPalStatus(): Promise<PayPalFullState> {
  const res = await fetch('/api/paypal/status');
  return handleApiResponse<PayPalFullState>(res);
}

export async function connectPayPalSandbox(
  clientId: string,
  clientSecret: string,
  inrPerUsd?: number
): Promise<PayPalFullState> {
  const res = await fetch('/api/paypal/connect', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ clientId, clientSecret, inrPerUsd }),
  });
  return handleApiResponse<PayPalFullState>(res);
}

export async function disconnectPayPalSandbox(): Promise<PayPalFullState> {
  const res = await fetch('/api/paypal/disconnect', { method: 'POST' });
  return handleApiResponse<PayPalFullState>(res);
}

export async function refreshPayPalToken(): Promise<PayPalFullState> {
  const res = await fetch('/api/paypal/refresh-token', { method: 'POST' });
  return handleApiResponse<PayPalFullState>(res);
}

export async function updatePayPalExchangeRate(inrPerUsd: number): Promise<{ inrPerUsd: number }> {
  const res = await fetch('/api/paypal/rate', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ inrPerUsd }),
  });
  return handleApiResponse<{ inrPerUsd: number }>(res);
}

export async function evaluatePayPalGuardrail(params: {
  itemName: string;
  amountINR: number;
  category: Category;
  purpose: 'purchase' | 'goal_funding';
  financialContext: FinancialContextSnapshot;
}): Promise<{
  verdict: 'healthy' | 'caution' | 'stretched';
  reasoning: string;
  amountINR: number;
  amountUSD: string;
  inrPerUsd: number;
}> {
  const res = await fetch('/api/paypal/guardrail', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(params),
  });
  return handleApiResponse(res);
}

export async function createPayPalOrder(params: {
  title: string;
  amountINR: number;
  category: Category;
  purpose: 'purchase' | 'goal_funding';
  goalId?: string;
  aiVerdict?: 'healthy' | 'caution' | 'stretched';
  aiReasoning?: string;
}): Promise<{ order: PayPalOrderRecord } & Pick<PayPalFullState, 'orders' | 'subscriptions' | 'apiLogs'>> {
  const res = await fetch('/api/paypal/orders', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(params),
  });
  return handleApiResponse(res);
}

export async function getPayPalOrder(
  orderId: string
): Promise<{ order: PayPalOrderRecord } & Pick<PayPalFullState, 'orders' | 'subscriptions' | 'apiLogs'>> {
  const res = await fetch(`/api/paypal/orders/${encodeURIComponent(orderId)}`);
  return handleApiResponse(res);
}

export async function capturePayPalOrder(
  orderId: string
): Promise<{ order: PayPalOrderRecord } & Pick<PayPalFullState, 'orders' | 'subscriptions' | 'apiLogs'>> {
  const res = await fetch(`/api/paypal/orders/${encodeURIComponent(orderId)}/capture`, {
    method: 'POST',
  });
  return handleApiResponse(res);
}

export async function createPayPalSubscription(params: {
  name: string;
  amountINR: number;
  frequency: 'monthly' | 'yearly';
  goalId?: string;
}): Promise<{ subscription: PayPalSubscriptionRecord } & Pick<PayPalFullState, 'orders' | 'subscriptions' | 'apiLogs'>> {
  const res = await fetch('/api/paypal/subscriptions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(params),
  });
  return handleApiResponse(res);
}

export async function refreshPayPalSubscription(
  subscriptionId: string
): Promise<{ subscription: PayPalSubscriptionRecord } & Pick<PayPalFullState, 'orders' | 'subscriptions' | 'apiLogs'>> {
  const res = await fetch(`/api/paypal/subscriptions/${encodeURIComponent(subscriptionId)}`);
  return handleApiResponse(res);
}

export async function cancelPayPalSubscription(
  subscriptionId: string,
  reason?: string
): Promise<{ subscription: PayPalSubscriptionRecord } & Pick<PayPalFullState, 'orders' | 'subscriptions' | 'apiLogs'>> {
  const res = await fetch(`/api/paypal/subscriptions/${encodeURIComponent(subscriptionId)}/cancel`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ reason }),
  });
  return handleApiResponse(res);
}

export async function syncPayPalSandbox(days = 30): Promise<{
  balances: PayPalWalletBalance[];
  transactions: Transaction[];
  scopeWarning?: string;
  orders: PayPalOrderRecord[];
  subscriptions: PayPalSubscriptionRecord[];
  apiLogs: PayPalApiLogEntry[];
}> {
  const res = await fetch('/api/paypal/sync', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ days }),
  });
  return handleApiResponse(res);
}
