import React, { useState, useEffect } from 'react';
import { PayPalScriptProvider, PayPalButtons } from '@paypal/react-paypal-js';
import {
  ShieldAlert,
  ShieldCheck,
  ExternalLink,
  CheckCircle2,
  Loader2,
  AlertCircle,
  RefreshCw,
  CreditCard,
} from 'lucide-react';
import type {
  Category,
  PayPalApiLogEntry,
  PayPalOrderRecord,
  PayPalStatusResponse,
} from '../types';
import {
  capturePayPalOrder,
  createPayPalOrder,
  getPayPalOrder,
} from '../services/paypalApi';
import { convertINRtoUSD, DEFAULT_INR_PER_USD, formatINR, formatUSD } from '../utils/currency';

interface PayPalCheckoutActionProps {
  title: string;
  amountINR: number;
  category: Category;
  purpose: 'purchase' | 'goal_funding';
  goalId?: string;
  aiVerdict: 'healthy' | 'caution' | 'stretched';
  aiReasoning?: string;
  paypalStatus: PayPalStatusResponse | null;
  onOrderActivity?: (orders: PayPalOrderRecord[], logs: PayPalApiLogEntry[]) => void;
  onPaymentCaptured: (capturedOrder: PayPalOrderRecord) => void;
  onOpenPayPalSettings: () => void;
}

export const PayPalCheckoutAction: React.FC<PayPalCheckoutActionProps> = ({
  title,
  amountINR,
  category,
  purpose,
  goalId,
  aiVerdict,
  aiReasoning,
  paypalStatus,
  onOrderActivity,
  onPaymentCaptured,
  onOpenPayPalSettings,
}) => {
  const [overrideConfirmed, setOverrideConfirmed] = useState(false);
  const [pendingOrder, setPendingOrder] = useState<PayPalOrderRecord | null>(null);
  const [capturedOrder, setCapturedOrder] = useState<PayPalOrderRecord | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setOverrideConfirmed(false);
    setPendingOrder(null);
    setCapturedOrder(null);
    setError(null);
  }, [title, amountINR, purpose, goalId]);

  const inrPerUsd = paypalStatus?.inrPerUsd || DEFAULT_INR_PER_USD;
  const amountUSD = convertINRtoUSD(amountINR, inrPerUsd);
  const needsGuardrailOverride = aiVerdict === 'stretched' && !overrideConfirmed;

  if (!paypalStatus?.connected || !paypalStatus.clientId) {
    return (
      <div className="p-4 rounded-xl bg-slate-900/80 border border-slate-800 space-y-2.5 text-xs">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 font-bold text-white">
            <CreditCard className="w-4 h-4 text-[#0070ba]" />
            <span>PayPal Sandbox Execution</span>
          </div>
          <span className="text-[10px] px-2 py-0.5 rounded-full bg-slate-800 text-slate-400 border border-slate-700">
            Not Connected
          </span>
        </div>
        <p className="text-slate-400 text-[11px] leading-relaxed">
          Connect your free PayPal Sandbox REST App in Settings to execute AI-verified purchases ({formatINR(amountINR)} ≈{' '}
          {formatUSD(Number(amountUSD))}) or fund savings goals directly through PayPal Checkout.
        </p>
        <button
          type="button"
          onClick={onOpenPayPalSettings}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#0070ba] hover:bg-[#005ea6] text-white font-semibold text-xs transition-colors cursor-pointer"
        >
          <span>Connect PayPal Sandbox</span>
        </button>
      </div>
    );
  }

  if (capturedOrder && capturedOrder.status === 'COMPLETED') {
    return (
      <div className="p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/30 space-y-2 text-xs">
        <div className="flex items-center gap-2 font-bold text-emerald-300">
          <CheckCircle2 className="w-4 h-4 text-emerald-400" />
          <span>PayPal Sandbox Payment Captured & Synced to FinPilot</span>
        </div>
        <div className="grid grid-cols-2 gap-2 text-[11px] text-slate-300 pt-1">
          <div>
            <span className="text-slate-400 block">Order ID</span>
            <span className="font-mono text-white">{capturedOrder.orderId}</span>
          </div>
          <div>
            <span className="text-slate-400 block">Capture ID</span>
            <span className="font-mono text-emerald-300">{capturedOrder.captureId || 'Settled'}</span>
          </div>
          <div>
            <span className="text-slate-400 block">Amount</span>
            <span className="font-semibold text-white">
              {formatINR(capturedOrder.amountINR)} ({formatUSD(Number(capturedOrder.amountUSD))} USD)
            </span>
          </div>
          {capturedOrder.payerEmail && (
            <div>
              <span className="text-slate-400 block">Sandbox Buyer</span>
              <span className="text-slate-200 truncate block">{capturedOrder.payerEmail}</span>
            </div>
          )}
        </div>
      </div>
    );
  }

  const handleManualCreateOrder = async () => {
    if (!title.trim() || amountINR <= 0 || busy) return;
    setBusy(true);
    setError(null);
    try {
      const res = await createPayPalOrder({
        title: title.trim(),
        amountINR,
        category,
        purpose,
        goalId,
        aiVerdict,
        aiReasoning,
      });
      setPendingOrder(res.order);
      onOrderActivity?.(res.orders, res.apiLogs);
    } catch (err: any) {
      setError(err.message || 'Failed to create PayPal Sandbox Order.');
    } finally {
      setBusy(false);
    }
  };

  const handleVerifyAndCapture = async (orderId: string) => {
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      const check = await getPayPalOrder(orderId);
      setPendingOrder(check.order);
      onOrderActivity?.(check.orders, check.apiLogs);

      if (check.order.status === 'CREATED') {
        setError(
          `Order ${orderId} is still CREATED. Please open the PayPal Sandbox Approval link and sign in with a Sandbox Buyer account first.`
        );
        return;
      }

      const cap = await capturePayPalOrder(orderId);
      setCapturedOrder(cap.order);
      setPendingOrder(null);
      onOrderActivity?.(cap.orders, cap.apiLogs);
      onPaymentCaptured(cap.order);
    } catch (err: any) {
      setError(err.message || 'Failed to capture PayPal Sandbox Order.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="p-4 rounded-xl bg-slate-900/75 border border-slate-800 space-y-3 text-xs">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-emerald-400" />
          <span className="font-bold text-white">PayPal Sandbox Execution</span>
        </div>
        <span className="text-[11px] font-semibold text-slate-300 bg-slate-800 px-2.5 py-0.5 rounded-lg border border-slate-700">
          {formatINR(amountINR)} ≈ {formatUSD(Number(amountUSD))} USD
        </span>
      </div>

      {/* AI Guardrail override check when stretched */}
      {aiVerdict === 'stretched' && (
        <label className="flex items-start gap-2.5 p-2.5 rounded-lg bg-rose-500/10 border border-rose-500/30 cursor-pointer text-[11px] text-rose-200">
          <input
            type="checkbox"
            checked={overrideConfirmed}
            onChange={(e) => setOverrideConfirmed(e.target.checked)}
            className="mt-0.5 accent-rose-500"
          />
          <span>
            <strong className="text-rose-300">AI Guardrail Warning:</strong> This exceeds your unallocated buffer. Check to override guardrail and unlock PayPal Sandbox payment.
          </span>
        </label>
      )}

      {aiVerdict === 'healthy' && (
        <div className="flex items-center gap-1.5 text-[11px] text-emerald-300">
          <ShieldCheck className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
          <span>AI Guardrail passed — safe within your unallocated monthly buffer.</span>
        </div>
      )}

      {error && (
        <div className="p-2.5 rounded-lg bg-rose-500/15 border border-rose-500/30 text-rose-200 text-[11px] flex items-start gap-2">
          <AlertCircle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
          <span>{error}</span>
        </div>
      )}

      {!needsGuardrailOverride && title.trim() && amountINR > 0 && (
        <div className="space-y-2.5">
          {/* Official PayPal JS SDK Smart Buttons */}
          <div className="bg-white rounded-xl p-2.5">
            <PayPalScriptProvider
              options={{
                clientId: paypalStatus.clientId,
                currency: 'USD',
                intent: 'capture',
              }}
            >
              <PayPalButtons
                style={{ layout: 'horizontal', color: 'blue', shape: 'rect', label: 'pay', height: 38, tagline: false }}
                forceReRender={[title, amountINR, purpose, goalId]}
                createOrder={async () => {
                  setError(null);
                  const res = await createPayPalOrder({
                    title: title.trim(),
                    amountINR,
                    category,
                    purpose,
                    goalId,
                    aiVerdict,
                    aiReasoning,
                  });
                  setPendingOrder(res.order);
                  onOrderActivity?.(res.orders, res.apiLogs);
                  return res.order.orderId;
                }}
                onApprove={async (data) => {
                  setBusy(true);
                  try {
                    const cap = await capturePayPalOrder(data.orderID);
                    setCapturedOrder(cap.order);
                    setPendingOrder(null);
                    onOrderActivity?.(cap.orders, cap.apiLogs);
                    onPaymentCaptured(cap.order);
                  } catch (err: any) {
                    setError(err.message || 'Capture failed after approval.');
                  } finally {
                    setBusy(false);
                  }
                }}
                onError={(err) => {
                  console.error('PayPal SDK error:', err);
                  setError('PayPal popup checkout encountered an error or was blocked. You can use the direct Sandbox approval link below.');
                }}
              />
            </PayPalScriptProvider>
          </div>

          {/* Alternative / Explicit Redirect Approval Flow for Restricted Webviews or CLI Testing */}
          <div className="pt-1 border-t border-slate-800/80 flex flex-wrap items-center justify-between gap-2">
            {!pendingOrder ? (
              <button
                type="button"
                onClick={handleManualCreateOrder}
                disabled={busy}
                className="text-[11px] font-semibold text-slate-400 hover:text-emerald-400 flex items-center gap-1 transition-colors cursor-pointer"
              >
                {busy && <Loader2 className="w-3 h-3 animate-spin" />}
                <span>Or create order & get direct Sandbox approval link</span>
              </button>
            ) : (
              <div className="w-full flex flex-wrap items-center justify-between gap-2 bg-slate-950/60 p-2.5 rounded-lg border border-slate-800">
                <div className="text-[11px]">
                  <span className="text-slate-400">Order </span>
                  <span className="font-mono text-white font-semibold">{pendingOrder.orderId}</span>
                  <span className="ml-2 px-1.5 py-0.2 rounded bg-amber-500/15 text-amber-300 border border-amber-500/30 text-[10px]">
                    {pendingOrder.status}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  {pendingOrder.approveUrl && (
                    <a
                      href={pendingOrder.approveUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-[#0070ba] hover:bg-[#005ea6] text-white text-[11px] font-semibold"
                    >
                      <span>Approve in PayPal</span>
                      <ExternalLink className="w-3 h-3" />
                    </a>
                  )}
                  <button
                    type="button"
                    onClick={() => handleVerifyAndCapture(pendingOrder.orderId)}
                    disabled={busy}
                    className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-slate-950 text-[11px] font-bold cursor-pointer disabled:opacity-50"
                  >
                    {busy ? <Loader2 className="w-3 h-3 animate-spin" /> : <RefreshCw className="w-3 h-3" />}
                    <span>Verify & Capture</span>
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {needsGuardrailOverride && (
        <div className="flex items-center gap-2 text-[11px] text-slate-400 py-1">
          <ShieldAlert className="w-3.5 h-3.5 text-rose-400" />
          <span>Checkout locked by FinPilot AI Guardrail until override is confirmed above.</span>
        </div>
      )}
    </div>
  );
};
