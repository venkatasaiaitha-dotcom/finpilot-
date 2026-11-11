import React, { useState } from 'react';
import {
  CreditCard,
  ShieldCheck,
  ShieldAlert,
  RefreshCw,
  ExternalLink,
  CheckCircle2,
  AlertCircle,
  Loader2,
  Repeat,
  Target,
  Activity,
  Sparkles,
  LogOut,
  KeyRound,
  Wallet,
  XCircle,
} from 'lucide-react';
import type {
  Category,
  FinancialContextSnapshot,
  FinancialGoal,
  PayPalApiLogEntry,
  PayPalOrderRecord,
  PayPalStatusResponse,
  PayPalSubscriptionRecord,
  PayPalWalletBalance,
} from '../../types';
import {
  cancelPayPalSubscription,
  capturePayPalOrder,
  connectPayPalSandbox,
  createPayPalSubscription,
  disconnectPayPalSandbox,
  evaluatePayPalGuardrail,
  getPayPalOrder,
  refreshPayPalSubscription,
  refreshPayPalToken,
  updatePayPalExchangeRate,
} from '../../services/paypalApi';
import { PayPalCheckoutAction } from '../PayPalCheckoutAction';
import { convertINRtoUSD, DEFAULT_INR_PER_USD, formatINR, formatUSD } from '../../utils/currency';

interface PayPalHubViewProps {
  paypalStatus: PayPalStatusResponse | null;
  orders: PayPalOrderRecord[];
  subscriptions: PayPalSubscriptionRecord[];
  balances: PayPalWalletBalance[];
  apiLogs: PayPalApiLogEntry[];
  scopeWarning?: string;
  goals: FinancialGoal[];
  financialContext: FinancialContextSnapshot;
  onStatusUpdated: (status: PayPalStatusResponse, orders: PayPalOrderRecord[], subs: PayPalSubscriptionRecord[], logs: PayPalApiLogEntry[]) => void;
  onOrderActivity: (orders: PayPalOrderRecord[], logs: PayPalApiLogEntry[]) => void;
  onSubscriptionActivity: (subs: PayPalSubscriptionRecord[], logs: PayPalApiLogEntry[]) => void;
  onSyncPayPal: () => Promise<void>;
  onPaymentCaptured: (order: PayPalOrderRecord) => void;
  onOpenSettings: () => void;
}

export const PayPalHubView: React.FC<PayPalHubViewProps> = ({
  paypalStatus,
  orders,
  subscriptions,
  balances,
  apiLogs,
  scopeWarning,
  goals,
  financialContext,
  onStatusUpdated,
  onOrderActivity,
  onSubscriptionActivity,
  onSyncPayPal,
  onPaymentCaptured,
  onOpenSettings,
}) => {
  // Connect Sandbox credentials form state
  const [clientIdInput, setClientIdInput] = useState('');
  const [clientSecretInput, setClientSecretInput] = useState('');
  const [rateInput, setRateInput] = useState<number>(paypalStatus?.inrPerUsd || DEFAULT_INR_PER_USD);
  const [connecting, setConnecting] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [statusFeedback, setStatusFeedback] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Guarded Checkout / Goal Funding state
  const [execPurpose, setExecPurpose] = useState<'purchase' | 'goal_funding'>('goal_funding');
  const [selectedGoalId, setSelectedGoalId] = useState<string>(goals[0]?.id || '');
  const [itemTitle, setItemTitle] = useState('Emergency Reserve Top-Up');
  const [itemAmountINR, setItemAmountINR] = useState<number>(4225);
  const [itemCategory, setItemCategory] = useState<Category>('Financial & Savings');
  const [guardrailLoading, setGuardrailLoading] = useState(false);
  const [guardrailResult, setGuardrailResult] = useState<{
    verdict: 'healthy' | 'caution' | 'stretched';
    reasoning: string;
  } | null>(null);

  // PayPal Subscription plan creation state
  const [subName, setSubName] = useState('Monthly Goal Auto-Save Plan');
  const [subAmountINR, setSubAmountINR] = useState<number>(2500);
  const [subFrequency, setSubFrequency] = useState<'monthly' | 'yearly'>('monthly');
  const [subBusy, setSubBusy] = useState(false);
  const [orderBusyId, setOrderBusyId] = useState<string | null>(null);

  const isConnected = Boolean(paypalStatus?.connected);
  const effectiveRate = paypalStatus?.inrPerUsd || DEFAULT_INR_PER_USD;

  const handleConnect = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!clientIdInput.trim() || !clientSecretInput.trim() || connecting) return;
    setConnecting(true);
    setStatusFeedback(null);
    try {
      const res = await connectPayPalSandbox(clientIdInput.trim(), clientSecretInput.trim(), rateInput);
      onStatusUpdated(res, res.orders, res.subscriptions, res.apiLogs);
      setClientSecretInput('');
      setStatusFeedback({
        type: 'success',
        text: `Verified PayPal Sandbox OAuth 2.0 connection (App ID: ${res.appId || 'Active'}).`,
      });
    } catch (err: any) {
      setStatusFeedback({ type: 'error', text: err.message || 'Failed to connect PayPal Sandbox.' });
    } finally {
      setConnecting(false);
    }
  };

  const handleDisconnect = async () => {
    const res = await disconnectPayPalSandbox();
    onStatusUpdated(res, res.orders, res.subscriptions, res.apiLogs);
    setStatusFeedback({ type: 'success', text: 'Disconnected PayPal Sandbox runtime credentials.' });
  };

  const handleRefreshToken = async () => {
    setConnecting(true);
    setStatusFeedback(null);
    try {
      const res = await refreshPayPalToken();
      onStatusUpdated(res, res.orders, res.subscriptions, res.apiLogs);
      setStatusFeedback({ type: 'success', text: 'Refreshed PayPal Sandbox OAuth 2.0 token and scopes.' });
    } catch (err: any) {
      setStatusFeedback({ type: 'error', text: err.message });
    } finally {
      setConnecting(false);
    }
  };

  const handleSync = async () => {
    if (syncing) return;
    setSyncing(true);
    setStatusFeedback(null);
    try {
      await onSyncPayPal();
      setStatusFeedback({ type: 'success', text: 'Synced PayPal Sandbox reporting balances & transactions.' });
    } catch (err: any) {
      setStatusFeedback({ type: 'error', text: err.message || 'PayPal sync error.' });
    } finally {
      setSyncing(false);
    }
  };

  const handleRunGuardrail = async () => {
    if (guardrailLoading || itemAmountINR <= 0) return;
    setGuardrailLoading(true);
    try {
      const targetTitle =
        execPurpose === 'goal_funding'
          ? goals.find((g) => g.id === selectedGoalId)?.name || itemTitle
          : itemTitle;
      const res = await evaluatePayPalGuardrail({
        itemName: targetTitle,
        amountINR: itemAmountINR,
        category: execPurpose === 'goal_funding' ? 'Financial & Savings' : itemCategory,
        purpose: execPurpose,
        financialContext,
      });
      setGuardrailResult({ verdict: res.verdict, reasoning: res.reasoning });
    } catch (err: any) {
      setStatusFeedback({ type: 'error', text: err.message });
    } finally {
      setGuardrailLoading(false);
    }
  };

  const handleCreateSubscription = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!subName.trim() || subAmountINR <= 0 || subBusy) return;
    setSubBusy(true);
    setStatusFeedback(null);
    try {
      const res = await createPayPalSubscription({
        name: subName.trim(),
        amountINR: subAmountINR,
        frequency: subFrequency,
        goalId: goals[0]?.id,
      });
      onSubscriptionActivity(res.subscriptions, res.apiLogs);
      setStatusFeedback({
        type: 'success',
        text: `Created PayPal Billing Plan & Subscription ${res.subscription.subscriptionId}. Click "Approve" to activate in Sandbox.`,
      });
    } catch (err: any) {
      setStatusFeedback({ type: 'error', text: err.message || 'Failed to create subscription.' });
    } finally {
      setSubBusy(false);
    }
  };

  const handleOrderCaptureCheck = async (orderId: string) => {
    setOrderBusyId(orderId);
    setStatusFeedback(null);
    try {
      const check = await getPayPalOrder(orderId);
      onOrderActivity(check.orders, check.apiLogs);
      if (check.order.status === 'CREATED') {
        setStatusFeedback({
          type: 'error',
          text: `Order ${orderId} is awaiting buyer approval. Click "Approve" first using a Sandbox Personal account.`,
        });
        return;
      }
      const cap = await capturePayPalOrder(orderId);
      onOrderActivity(cap.orders, cap.apiLogs);
      if (cap.order.status === 'COMPLETED') {
        onPaymentCaptured(cap.order);
        setStatusFeedback({
          type: 'success',
          text: `Captured PayPal Order ${cap.order.orderId} (${cap.order.captureId}) and updated your FinPilot ledger.`,
        });
      }
    } catch (err: any) {
      setStatusFeedback({ type: 'error', text: err.message });
    } finally {
      setOrderBusyId(null);
    }
  };

  const effectiveExecTitle =
    execPurpose === 'goal_funding'
      ? `Fund Goal: ${goals.find((g) => g.id === selectedGoalId)?.name || itemTitle}`
      : itemTitle;
  const effectiveExecCategory: Category =
    execPurpose === 'goal_funding' ? 'Financial & Savings' : itemCategory;

  const computedVerdict: 'healthy' | 'caution' | 'stretched' =
    guardrailResult?.verdict ||
    (itemAmountINR > financialContext.budgetCommitment.unallocatedBuffer
      ? 'stretched'
      : itemAmountINR > financialContext.budgetCommitment.unallocatedBuffer * 0.5
      ? 'caution'
      : 'healthy');

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* 1. Connection & Sandbox Control Hero */}
      <div className="rounded-2xl bg-[#111827] border border-slate-800 p-5 sm:p-6 shadow-xl space-y-4">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-start gap-3.5">
            <div className="w-11 h-11 rounded-2xl bg-[#0070ba]/20 border border-[#0070ba]/40 text-[#38bdf8] flex items-center justify-center shrink-0">
              <CreditCard className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h2 className="text-base sm:text-lg font-bold text-white tracking-tight">
                  PayPal Developer Sandbox Hub
                </h2>
                <span
                  className={`text-[10px] font-bold px-2.5 py-0.5 rounded-full border ${
                    isConnected
                      ? 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30'
                      : 'bg-amber-500/15 text-amber-300 border-amber-500/30'
                  }`}
                >
                  {isConnected ? `SANDBOX CONNECTED (${paypalStatus?.source?.toUpperCase()})` : 'SANDBOX SETUP NEEDED'}
                </span>
              </div>
              <p className="text-xs text-slate-400 mt-1">
                Real OAuth 2.0, Orders API v2 + Checkout JS SDK, Subscriptions API v1, and Transaction Search API v1 paired with Gemini 3.8 Flash guardrails.
              </p>
            </div>
          </div>

          {isConnected && (
            <div className="flex items-center gap-2 flex-wrap shrink-0">
              <button
                onClick={handleSync}
                disabled={syncing}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold bg-emerald-500 hover:bg-emerald-400 text-slate-950 transition-all cursor-pointer disabled:opacity-50"
              >
                {syncing ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5" />}
                <span>Sync Balances & Transactions</span>
              </button>
              <button
                onClick={handleRefreshToken}
                disabled={connecting}
                className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 cursor-pointer"
                title="Terminate and re-issue OAuth token to pick up newly enabled PayPal App scopes"
              >
                <KeyRound className="w-3.5 h-3.5 text-emerald-400" />
                <span>Refresh Token</span>
              </button>
              {paypalStatus?.source === 'session' && (
                <button
                  onClick={handleDisconnect}
                  className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold bg-rose-500/10 hover:bg-rose-500/20 text-rose-300 border border-rose-500/30 cursor-pointer"
                >
                  <LogOut className="w-3.5 h-3.5" />
                  <span>Disconnect</span>
                </button>
              )}
            </div>
          )}
        </div>

        {statusFeedback && (
          <div
            className={`p-3 rounded-xl border text-xs flex items-center gap-2 ${
              statusFeedback.type === 'success'
                ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300'
                : 'bg-rose-500/15 border-rose-500/30 text-rose-200'
            }`}
          >
            {statusFeedback.type === 'success' ? (
              <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
            ) : (
              <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
            )}
            <span>{statusFeedback.text}</span>
          </div>
        )}

        {/* Inline Connect Form when not connected */}
        {!isConnected && (
          <form onSubmit={handleConnect} className="p-4 rounded-xl bg-slate-900/70 border border-slate-800 space-y-3">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <span className="text-xs font-bold text-white">
                Connect Your Free PayPal Sandbox REST App
              </span>
              <a
                href="https://developer.paypal.com/dashboard/applications/sandbox"
                target="_blank"
                rel="noopener noreferrer"
                className="text-[11px] font-semibold text-[#38bdf8] hover:underline inline-flex items-center gap-1"
              >
                <span>Open developer.paypal.com Sandbox Apps</span>
                <ExternalLink className="w-3 h-3" />
              </a>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-xs">
              <input
                type="text"
                required
                placeholder="Sandbox Client ID"
                value={clientIdInput}
                onChange={(e) => setClientIdInput(e.target.value)}
                className="px-3.5 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-white placeholder:text-slate-500 focus:outline-hidden focus:border-emerald-500 font-mono"
              />
              <input
                type="password"
                required
                placeholder="Sandbox Client Secret"
                value={clientSecretInput}
                onChange={(e) => setClientSecretInput(e.target.value)}
                className="px-3.5 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-white placeholder:text-slate-500 focus:outline-hidden focus:border-emerald-500 font-mono"
              />
              <button
                type="submit"
                disabled={connecting}
                className="px-4 py-2.5 rounded-xl bg-[#0070ba] hover:bg-[#005ea6] text-white font-bold transition-colors flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
              >
                {connecting ? <Loader2 className="w-4 h-4 animate-spin" /> : <ShieldCheck className="w-4 h-4" />}
                <span>Verify & Connect Sandbox</span>
              </button>
            </div>
            <p className="text-[11px] text-slate-400">
              Credentials are verified live via <code className="text-slate-300">POST https://api-m.sandbox.paypal.com/v1/oauth2/token</code> and kept only in local server memory (or configure <code className="text-slate-300">PAYPAL_CLIENT_ID</code> / <code className="text-slate-300">PAYPAL_CLIENT_SECRET</code> in <code className="text-slate-300">.env</code>).
            </p>
          </form>
        )}

        {/* Connected Diagnostics Strip */}
        {isConnected && (
          <div className="grid grid-cols-1 sm:grid-cols-4 gap-3 pt-1 text-xs">
            <div className="p-3 rounded-xl bg-slate-900/60 border border-slate-800">
              <span className="text-[11px] text-slate-400 block">Sandbox Client ID</span>
              <span className="font-mono text-white text-[11px] truncate block mt-0.5">
                {paypalStatus?.clientId?.slice(0, 18)}...
              </span>
            </div>
            <div className="p-3 rounded-xl bg-slate-900/60 border border-slate-800">
              <span className="text-[11px] text-slate-400 block">Conversion Rate</span>
              <div className="flex items-center gap-2 mt-0.5">
                <span className="font-bold text-emerald-400">1 USD = ₹{effectiveRate}</span>
                <button
                  onClick={async () => {
                    const next = window.prompt('Set INR per 1 USD conversion rate:', String(effectiveRate));
                    if (next && Number(next) > 1) {
                      const updated = await updatePayPalExchangeRate(Number(next));
                      setRateInput(updated.inrPerUsd);
                      onStatusUpdated(
                        { ...paypalStatus!, inrPerUsd: updated.inrPerUsd },
                        orders,
                        subscriptions,
                        apiLogs
                      );
                    }
                  }}
                  className="text-[10px] text-slate-400 hover:text-white underline cursor-pointer"
                >
                  Edit
                </button>
              </div>
            </div>
            <div className="p-3 rounded-xl bg-slate-900/60 border border-slate-800">
              <span className="text-[11px] text-slate-400 block">Transaction Search Scope</span>
              <span
                className={`font-semibold text-[11px] mt-0.5 block ${
                  paypalStatus?.hasTransactionSearchScope ? 'text-emerald-400' : 'text-amber-300'
                }`}
              >
                {paypalStatus?.hasTransactionSearchScope ? 'Enabled on Token' : 'Check Dashboard App Features'}
              </span>
            </div>
            <div className="p-3 rounded-xl bg-slate-900/60 border border-slate-800">
              <span className="text-[11px] text-slate-400 block">PayPal Wallet Balance</span>
              {balances.length > 0 ? (
                <span className="font-bold text-white mt-0.5 block">
                  {balances.map((b) => `${b.currency} ${b.availableValue}`).join(' · ')}
                </span>
              ) : (
                <span className="text-slate-400 text-[11px] mt-0.5 block">Click Sync Balances above</span>
              )}
            </div>
          </div>
        )}

        {scopeWarning && (
          <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/30 text-xs text-amber-200 flex items-start gap-2">
            <ShieldAlert className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
            <span>{scopeWarning}</span>
          </div>
        )}
      </div>

      {/* 2. Two-Column Action Hub: Guarded Orders v2 + Subscriptions API v1 */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left: AI-Guarded PayPal Orders & Goal Funding (7 cols) */}
        <div className="lg:col-span-7 space-y-5">
          <div className="rounded-2xl bg-[#111827] border border-slate-800 p-5 sm:p-6 space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-800">
              <div>
                <h3 className="text-sm font-bold text-white flex items-center gap-2">
                  <Sparkles className="w-4 h-4 text-emerald-400" />
                  <span>AI-Guarded PayPal Checkout & Goal Vault</span>
                </h3>
                <p className="text-xs text-slate-400 mt-0.5">
                  Gemini evaluates your buffer & goal impact before creating a real PayPal Sandbox Order
                </p>
              </div>

              <div className="flex bg-slate-900 p-1 rounded-xl border border-slate-800 text-xs self-start">
                <button
                  type="button"
                  onClick={() => {
                    setExecPurpose('goal_funding');
                    setGuardrailResult(null);
                  }}
                  className={`px-3 py-1 rounded-lg font-semibold cursor-pointer ${
                    execPurpose === 'goal_funding'
                      ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30'
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  Fund Goal
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setExecPurpose('purchase');
                    setItemTitle('Sony Noise-Canceling Headphones');
                    setItemCategory('Shopping & Goods');
                    setGuardrailResult(null);
                  }}
                  className={`px-3 py-1 rounded-lg font-semibold cursor-pointer ${
                    execPurpose === 'purchase'
                      ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30'
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  Buy Item
                </button>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
              {execPurpose === 'goal_funding' ? (
                <div>
                  <label className="block font-semibold text-slate-300 mb-1">Target Savings Goal</label>
                  <select
                    value={selectedGoalId}
                    onChange={(e) => {
                      setSelectedGoalId(e.target.value);
                      setGuardrailResult(null);
                    }}
                    className="w-full px-3 py-2.5 bg-slate-900 border border-slate-800 rounded-xl text-white focus:outline-hidden focus:border-emerald-500"
                  >
                    {goals.length === 0 ? (
                      <option value="">General Savings Vault</option>
                    ) : (
                      goals.map((g) => (
                        <option key={g.id} value={g.id}>
                          {g.name} ({formatINR(g.currentAmount, false)} / {formatINR(g.targetAmount, false)})
                        </option>
                      ))
                    )}
                  </select>
                </div>
              ) : (
                <div>
                  <label className="block font-semibold text-slate-300 mb-1">Purchase Description</label>
                  <input
                    type="text"
                    value={itemTitle}
                    onChange={(e) => {
                      setItemTitle(e.target.value);
                      setGuardrailResult(null);
                    }}
                    className="w-full px-3 py-2.5 bg-slate-900 border border-slate-800 rounded-xl text-white focus:outline-hidden focus:border-emerald-500"
                  />
                </div>
              )}

              <div>
                <label className="block font-semibold text-slate-300 mb-1">
                  Amount in INR (≈ {formatUSD(Number(convertINRtoUSD(itemAmountINR, effectiveRate)))} USD)
                </label>
                <div className="flex gap-2">
                  <input
                    type="number"
                    min="50"
                    step="100"
                    value={itemAmountINR}
                    onChange={(e) => {
                      setItemAmountINR(Number(e.target.value));
                      setGuardrailResult(null);
                    }}
                    className="flex-1 px-3 py-2.5 bg-slate-900 border border-slate-800 rounded-xl text-white focus:outline-hidden focus:border-emerald-500"
                  />
                  <button
                    type="button"
                    onClick={handleRunGuardrail}
                    disabled={guardrailLoading || itemAmountINR <= 0}
                    className="px-3 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-emerald-400 border border-slate-700 font-semibold cursor-pointer shrink-0"
                  >
                    {guardrailLoading ? 'Checking...' : 'AI Check'}
                  </button>
                </div>
              </div>
            </div>

            {guardrailResult && (
              <div
                className={`p-3 rounded-xl border text-xs ${
                  guardrailResult.verdict === 'healthy'
                    ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-200'
                    : guardrailResult.verdict === 'caution'
                    ? 'bg-amber-500/10 border-amber-500/30 text-amber-200'
                    : 'bg-rose-500/10 border-rose-500/30 text-rose-200'
                }`}
              >
                <span className="font-bold uppercase tracking-wider text-[10px] block mb-1">
                  Gemini 3.8 Flash Guardrail: {guardrailResult.verdict}
                </span>
                <p className="leading-relaxed text-[11px]">{guardrailResult.reasoning}</p>
              </div>
            )}

            <PayPalCheckoutAction
              title={effectiveExecTitle}
              amountINR={itemAmountINR}
              category={effectiveExecCategory}
              purpose={execPurpose}
              goalId={execPurpose === 'goal_funding' ? selectedGoalId : undefined}
              aiVerdict={computedVerdict}
              aiReasoning={guardrailResult?.reasoning}
              paypalStatus={paypalStatus}
              onOrderActivity={onOrderActivity}
              onPaymentCaptured={onPaymentCaptured}
              onOpenPayPalSettings={onOpenSettings}
            />
          </div>

          {/* Orders History Card */}
          <div className="rounded-2xl bg-[#111827] border border-slate-800 p-5 space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                <Wallet className="w-4 h-4 text-emerald-400" />
                <span>PayPal Sandbox Orders ({orders.length})</span>
              </h3>
              <span className="text-[11px] text-slate-400">Orders API v2</span>
            </div>

            {orders.length === 0 ? (
              <p className="text-xs text-slate-400 py-4 text-center border border-dashed border-slate-800 rounded-xl">
                No PayPal Sandbox orders created in this session yet. Use the checkout panel above to create and capture a real Sandbox order.
              </p>
            ) : (
              <div className="space-y-2.5">
                {orders.map((ord) => (
                  <div
                    key={ord.orderId}
                    className="p-3 rounded-xl bg-slate-900/60 border border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs"
                  >
                    <div className="space-y-0.5 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-bold text-white truncate">{ord.title}</span>
                        <span
                          className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                            ord.status === 'COMPLETED'
                              ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30'
                              : 'bg-amber-500/15 text-amber-300 border border-amber-500/30'
                          }`}
                        >
                          {ord.status}
                        </span>
                      </div>
                      <div className="text-[11px] text-slate-400 font-mono">
                        Order: {ord.orderId}
                        {ord.captureId ? ` · Capture: ${ord.captureId}` : ''}
                      </div>
                    </div>

                    <div className="flex items-center gap-2.5 shrink-0">
                      <div className="text-right">
                        <span className="font-bold text-white block">{formatINR(ord.amountINR)}</span>
                        <span className="text-[10px] text-slate-400">${ord.amountUSD} USD</span>
                      </div>

                      {ord.status !== 'COMPLETED' && (
                        <>
                          {ord.approveUrl && (
                            <a
                              href={ord.approveUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="px-2.5 py-1.5 rounded-lg bg-[#0070ba] hover:bg-[#005ea6] text-white text-[11px] font-semibold inline-flex items-center gap-1"
                            >
                              <span>Approve</span>
                              <ExternalLink className="w-3 h-3" />
                            </a>
                          )}
                          <button
                            onClick={() => handleOrderCaptureCheck(ord.orderId)}
                            disabled={orderBusyId === ord.orderId}
                            className="px-2.5 py-1.5 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-slate-950 text-[11px] font-bold cursor-pointer"
                          >
                            {orderBusyId === ord.orderId ? 'Checking...' : 'Capture'}
                          </button>
                        </>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Right: PayPal Subscriptions API v1 & Live Telemetry (5 cols) */}
        <div className="lg:col-span-5 space-y-5">
          {/* Subscriptions API Card */}
          <div className="rounded-2xl bg-[#111827] border border-slate-800 p-5 space-y-4">
            <div className="pb-3 border-b border-slate-800">
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                <Repeat className="w-4 h-4 text-pink-400" />
                <span>PayPal Recurring Plans & Subscriptions</span>
              </h3>
              <p className="text-xs text-slate-400 mt-0.5">
                Creates real PayPal Catalog Products, Billing Plans & Subscriptions (<code className="text-slate-300">/v1/billing/*</code>)
              </p>
            </div>

            <form onSubmit={handleCreateSubscription} className="space-y-3 text-xs">
              <div>
                <label className="block font-semibold text-slate-300 mb-1">Subscription / Auto-Save Name</label>
                <input
                  type="text"
                  required
                  value={subName}
                  onChange={(e) => setSubName(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-900 border border-slate-800 rounded-xl text-white focus:outline-hidden focus:border-emerald-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-2.5">
                <div>
                  <label className="block font-semibold text-slate-300 mb-1">Amount (₹)</label>
                  <input
                    type="number"
                    min="100"
                    required
                    value={subAmountINR}
                    onChange={(e) => setSubAmountINR(Number(e.target.value))}
                    className="w-full px-3 py-2 bg-slate-900 border border-slate-800 rounded-xl text-white focus:outline-hidden focus:border-emerald-500"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-300 mb-1">Cadence</label>
                  <select
                    value={subFrequency}
                    onChange={(e) => setSubFrequency(e.target.value as 'monthly' | 'yearly')}
                    className="w-full px-3 py-2 bg-slate-900 border border-slate-800 rounded-xl text-white focus:outline-hidden focus:border-emerald-500"
                  >
                    <option value="monthly">Monthly</option>
                    <option value="yearly">Yearly</option>
                  </select>
                </div>
              </div>

              <button
                type="submit"
                disabled={!isConnected || subBusy}
                className="w-full py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold transition-colors disabled:opacity-50 cursor-pointer flex items-center justify-center gap-1.5"
              >
                {subBusy ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Target className="w-3.5 h-3.5" />}
                <span>Create PayPal Billing Plan & Subscription</span>
              </button>
            </form>

            {subscriptions.length > 0 && (
              <div className="space-y-2.5 pt-2 border-t border-slate-800">
                {subscriptions.map((sub) => (
                  <div
                    key={sub.subscriptionId}
                    className="p-3 rounded-xl bg-slate-900/60 border border-slate-800 space-y-2 text-xs"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-bold text-white truncate">{sub.name}</span>
                      <span
                        className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                          sub.status === 'ACTIVE'
                            ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30'
                            : sub.status === 'CANCELLED'
                            ? 'bg-rose-500/15 text-rose-300 border border-rose-500/30'
                            : 'bg-amber-500/15 text-amber-300 border border-amber-500/30'
                        }`}
                      >
                        {sub.status}
                      </span>
                    </div>
                    <div className="text-[11px] text-slate-400 font-mono">
                      Sub: {sub.subscriptionId} · Plan: {sub.planId}
                    </div>
                    <div className="flex items-center justify-between pt-1">
                      <span className="text-slate-300 font-semibold">
                        {formatINR(sub.amountINR)} ({formatUSD(Number(sub.amountUSD))}/{sub.frequency})
                      </span>
                      <div className="flex items-center gap-1.5">
                        {sub.approveUrl && sub.status === 'APPROVAL_PENDING' && (
                          <a
                            href={sub.approveUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="px-2 py-1 rounded-lg bg-[#0070ba] text-white text-[10px] font-semibold inline-flex items-center gap-1"
                          >
                            <span>Approve</span>
                            <ExternalLink className="w-2.5 h-2.5" />
                          </a>
                        )}
                        <button
                          onClick={async () => {
                            const res = await refreshPayPalSubscription(sub.subscriptionId);
                            onSubscriptionActivity(res.subscriptions, res.apiLogs);
                          }}
                          className="p-1 rounded-lg bg-slate-800 text-slate-300 hover:text-white cursor-pointer"
                          title="Refresh status from PayPal"
                        >
                          <RefreshCw className="w-3 h-3" />
                        </button>
                        {sub.status === 'ACTIVE' && (
                          <button
                            onClick={async () => {
                              const res = await cancelPayPalSubscription(sub.subscriptionId);
                              onSubscriptionActivity(res.subscriptions, res.apiLogs);
                            }}
                            className="p-1 rounded-lg bg-rose-500/15 text-rose-300 hover:bg-rose-500/25 cursor-pointer"
                            title="Cancel subscription in PayPal"
                          >
                            <XCircle className="w-3 h-3" />
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Live PayPal API Telemetry Log */}
          <div className="rounded-2xl bg-[#111827] border border-slate-800 p-5 space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                <Activity className="w-4 h-4 text-emerald-400" />
                <span>Live PayPal Sandbox API Log</span>
              </h3>
              <span className="text-[10px] text-slate-400 font-mono">api-m.sandbox.paypal.com</span>
            </div>

            {apiLogs.length === 0 ? (
              <p className="text-xs text-slate-500 text-center py-4">
                Live PayPal REST API calls will appear here as you connect, create orders, sync balances, or manage subscriptions.
              </p>
            ) : (
              <div className="space-y-1.5 max-h-72 overflow-y-auto pr-1">
                {apiLogs.map((log) => (
                  <div
                    key={log.id}
                    className="p-2.5 rounded-xl bg-slate-950/70 border border-slate-800/80 text-[11px] space-y-0.5"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-1.5 font-mono truncate">
                        <span
                          className={`px-1.5 py-0.2 rounded text-[9px] font-bold ${
                            log.statusCode >= 200 && log.statusCode < 300
                              ? 'bg-emerald-500/15 text-emerald-400'
                              : 'bg-rose-500/20 text-rose-300'
                          }`}
                        >
                          {log.statusCode}
                        </span>
                        <span className="text-slate-400">{log.method}</span>
                        <span className="text-white truncate">{log.endpoint}</span>
                      </div>
                      <span className="text-[10px] text-slate-500 shrink-0">{log.durationMs}ms</span>
                    </div>
                    <p className="text-[10px] text-slate-400 truncate">{log.summary}</p>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
