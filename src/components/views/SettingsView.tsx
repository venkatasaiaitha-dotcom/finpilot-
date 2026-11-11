import React, { useState } from 'react';
import {
  FileSpreadsheet,
  UploadCloud,
  RefreshCw,
  Trash2,
  Cpu,
  ShieldCheck,
  CheckCircle2,
  ExternalLink,
  IndianRupee,
  Database,
  Key,
  CreditCard,
  Link2Off,
  Loader2,
  ArrowRight,
  AlertCircle,
} from 'lucide-react';
import { User } from 'firebase/auth';
import { PayPalStatusResponse } from '../../types';
import {
  PayPalFullState,
  getPayPalStatus,
  connectPayPalSandbox,
  disconnectPayPalSandbox,
  refreshPayPalToken,
  updatePayPalExchangeRate,
} from '../../services/paypalApi';

interface SettingsViewProps {
  currentUser: User | null;
  onOpenGoogleSheets: () => void;
  onOpenUpload: () => void;
  onLoadSampleData: () => void;
  onWipeData: () => void;
  hasData: boolean;
  paypalStatus: PayPalStatusResponse | null;
  onPayPalStatusUpdated: (state: PayPalFullState) => void;
  onNavigateToPayPalHub?: () => void;
}

export const SettingsView: React.FC<SettingsViewProps> = ({
  currentUser,
  onOpenGoogleSheets,
  onOpenUpload,
  onLoadSampleData,
  onWipeData,
  hasData,
  paypalStatus,
  onPayPalStatusUpdated,
  onNavigateToPayPalHub,
}) => {
  const [clientIdInput, setClientIdInput] = useState('');
  const [clientSecretInput, setClientSecretInput] = useState('');
  const [rateInput, setRateInput] = useState<string>(
    String(paypalStatus?.inrPerUsd || 84.5)
  );
  const [ppBusy, setPpBusy] = useState(false);
  const [ppError, setPpError] = useState<string | null>(null);
  const [ppSuccess, setPpSuccess] = useState<string | null>(null);

  const handleConnectPayPal = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!clientIdInput.trim() || !clientSecretInput.trim() || ppBusy) return;
    setPpBusy(true);
    setPpError(null);
    setPpSuccess(null);
    try {
      const updated = await connectPayPalSandbox(
        clientIdInput.trim(),
        clientSecretInput.trim(),
        Number(rateInput) || 84.5
      );
      onPayPalStatusUpdated(updated);
      setClientSecretInput('');
      setPpSuccess('PayPal Developer Sandbox OAuth token verified & connected.');
    } catch (err: any) {
      setPpError(err.message || 'Failed to connect PayPal Sandbox');
    } finally {
      setPpBusy(false);
    }
  };

  const handleRefreshToken = async () => {
    if (ppBusy) return;
    setPpBusy(true);
    setPpError(null);
    setPpSuccess(null);
    try {
      const updated = await refreshPayPalToken();
      onPayPalStatusUpdated(updated);
      setPpSuccess('OAuth token terminated & refreshed with latest PayPal App scopes.');
    } catch (err: any) {
      setPpError(err.message || 'Token refresh failed');
    } finally {
      setPpBusy(false);
    }
  };

  const handleDisconnect = async () => {
    if (ppBusy) return;
    setPpBusy(true);
    setPpError(null);
    setPpSuccess(null);
    try {
      const updated = await disconnectPayPalSandbox();
      onPayPalStatusUpdated(updated);
      setPpSuccess('Session PayPal Sandbox credentials cleared.');
    } catch (err: any) {
      setPpError(err.message || 'Disconnect failed');
    } finally {
      setPpBusy(false);
    }
  };

  const handleUpdateRate = async () => {
    const parsed = Number(rateInput);
    if (!Number.isFinite(parsed) || parsed <= 0 || ppBusy) return;
    setPpBusy(true);
    setPpError(null);
    setPpSuccess(null);
    try {
      const res = await updatePayPalExchangeRate(parsed);
      const updated = await getPayPalStatus();
      onPayPalStatusUpdated(updated);
      setPpSuccess(`Conversion rate updated to ₹${res.inrPerUsd.toFixed(2)} / $1 USD.`);
    } catch (err: any) {
      setPpError(err.message || 'Failed to update exchange rate');
    } finally {
      setPpBusy(false);
    }
  };

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      {/* 0. PayPal Developer Sandbox Integration */}
      <div className="bg-[#111827] rounded-2xl border border-[#0070ba]/30 p-5 sm:p-6 shadow-xl">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-slate-800">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-[#0070ba]/15 border border-[#0070ba]/30 text-[#38bdf8] flex items-center justify-center shrink-0">
              <CreditCard className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base font-bold text-white">
                  PayPal Developer Sandbox
                </h2>
                <span
                  className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${
                    paypalStatus?.connected
                      ? 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30'
                      : 'bg-slate-800 text-slate-400 border-slate-700'
                  }`}
                >
                  {paypalStatus?.connected ? 'Connected (Sandbox)' : 'Not Connected'}
                </span>
              </div>
              <p className="text-xs text-slate-400">
                Real OAuth 2.0 integration with api-m.sandbox.paypal.com (Orders v2, Subscriptions v1, Reporting v1)
              </p>
            </div>
          </div>

          {onNavigateToPayPalHub && (
            <button
              onClick={onNavigateToPayPalHub}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold bg-[#0070ba]/20 hover:bg-[#0070ba]/30 text-[#38bdf8] border border-[#0070ba]/40 transition-all cursor-pointer self-start sm:self-auto"
            >
              <span>Open PayPal Hub</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        {ppError && (
          <div className="mt-4 p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 text-xs text-rose-300 flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0 text-rose-400" />
            <span>{ppError}</span>
          </div>
        )}
        {ppSuccess && (
          <div className="mt-4 p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-xs text-emerald-300 flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-400" />
            <span>{ppSuccess}</span>
          </div>
        )}

        <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-4">
          <form
            onSubmit={handleConnectPayPal}
            className="p-4 rounded-xl bg-slate-900/60 border border-slate-800 space-y-3"
          >
            <h3 className="text-xs font-bold text-white uppercase tracking-wider">
              Runtime Sandbox OAuth Credentials
            </h3>
            <p className="text-[11px] text-slate-400 leading-relaxed">
              Stored in backend server memory only (or configure <code className="text-slate-300">PAYPAL_CLIENT_ID</code> &{' '}
              <code className="text-slate-300">PAYPAL_CLIENT_SECRET</code> in <code className="text-slate-300">.env</code>).
            </p>
            <div>
              <label className="block text-[11px] font-semibold text-slate-300 mb-1">
                Sandbox Client ID
              </label>
              <input
                type="text"
                value={clientIdInput}
                onChange={(e) => setClientIdInput(e.target.value)}
                placeholder={paypalStatus?.clientId || 'A... (PayPal Sandbox Client ID)'}
                className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs text-white placeholder:text-slate-600 focus:outline-hidden focus:border-[#38bdf8]"
              />
            </div>
            <div>
              <label className="block text-[11px] font-semibold text-slate-300 mb-1">
                Sandbox Client Secret
              </label>
              <input
                type="password"
                value={clientSecretInput}
                onChange={(e) => setClientSecretInput(e.target.value)}
                placeholder="E... (kept server-side only)"
                className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs text-white placeholder:text-slate-600 focus:outline-hidden focus:border-[#38bdf8]"
              />
            </div>
            <div className="flex flex-wrap items-center gap-2 pt-1">
              <button
                type="submit"
                disabled={ppBusy || !clientIdInput.trim() || !clientSecretInput.trim()}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-xs font-bold bg-[#0070ba] hover:bg-[#005ea6] text-white disabled:opacity-50 transition-all cursor-pointer"
              >
                {ppBusy && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                <span>Connect Sandbox</span>
              </button>
              {paypalStatus?.connected && (
                <>
                  <button
                    type="button"
                    onClick={handleRefreshToken}
                    disabled={ppBusy}
                    className="inline-flex items-center gap-1 px-2.5 py-2 rounded-lg text-xs font-semibold bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 cursor-pointer"
                    title="Terminate & refresh OAuth token to apply new developer.paypal.com scopes"
                  >
                    <RefreshCw className="w-3 h-3" />
                    <span>Refresh Scopes</span>
                  </button>
                  {paypalStatus.source === 'session' && (
                    <button
                      type="button"
                      onClick={handleDisconnect}
                      disabled={ppBusy}
                      className="inline-flex items-center gap-1 px-2.5 py-2 rounded-lg text-xs font-semibold bg-rose-500/10 hover:bg-rose-500/20 text-rose-300 border border-rose-500/30 cursor-pointer"
                    >
                      <Link2Off className="w-3 h-3" />
                      <span>Disconnect</span>
                    </button>
                  )}
                </>
              )}
            </div>
          </form>

          <div className="p-4 rounded-xl bg-slate-900/60 border border-slate-800 flex flex-col justify-between space-y-3">
            <div className="space-y-2.5">
              <h3 className="text-xs font-bold text-white uppercase tracking-wider">
                Currency Bridge & Token Diagnostics
              </h3>
              <p className="text-[11px] text-slate-400 leading-relaxed">
                PayPal Sandbox REST Orders & Subscriptions execute in <strong className="text-slate-200">USD</strong> for universal compatibility. FinPilot translates every <strong className="text-slate-200">₹ INR</strong> purchase & goal deposit at this rate.
              </p>
              <div className="flex items-center gap-2">
                <div className="flex-1">
                  <label className="block text-[11px] font-semibold text-slate-300 mb-1">
                    INR per $1 USD
                  </label>
                  <input
                    type="number"
                    step="0.05"
                    min="1"
                    value={rateInput}
                    onChange={(e) => setRateInput(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs text-white focus:outline-hidden focus:border-emerald-500"
                  />
                </div>
                <button
                  type="button"
                  onClick={handleUpdateRate}
                  disabled={ppBusy}
                  className="mt-5 px-3 py-2 rounded-lg text-xs font-bold bg-slate-800 hover:bg-slate-700 text-emerald-400 border border-slate-700 cursor-pointer"
                >
                  Apply Rate
                </button>
              </div>
            </div>

            <div className="pt-2 border-t border-slate-800 text-[11px] text-slate-400 space-y-1">
              <div className="flex justify-between">
                <span>Auth Source:</span>
                <span className="text-slate-200 font-semibold uppercase">{paypalStatus?.source || 'none'}</span>
              </div>
              <div className="flex justify-between">
                <span>Transaction Search Scope:</span>
                <span className={paypalStatus?.hasTransactionSearchScope ? 'text-emerald-400 font-semibold' : 'text-amber-400 font-semibold'}>
                  {paypalStatus?.hasTransactionSearchScope ? 'Enabled' : 'Check Developer Dashboard'}
                </span>
              </div>
              <a
                href="https://developer.paypal.com/dashboard/applications/sandbox"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 text-[#38bdf8] hover:underline pt-1"
              >
                <span>Open PayPal Developer Sandbox Dashboard</span>
                <ExternalLink className="w-3 h-3" />
              </a>
            </div>
          </div>
        </div>
      </div>

      {/* 1. Cloud & Integrations */}
      <div className="rounded-2xl bg-[#111827] border border-slate-800 p-6 space-y-4">
        <div className="flex items-center gap-2.5 pb-3 border-b border-slate-800">
          <div className="w-8 h-8 rounded-xl bg-emerald-500/15 text-emerald-400 flex items-center justify-center border border-emerald-500/30">
            <FileSpreadsheet className="w-4 h-4" />
          </div>
          <div>
            <h2 className="text-sm font-bold text-white">Google Workspace & Cloud Sync</h2>
            <p className="text-xs text-slate-400">Two-way sync with Google Drive & Google Sheets</p>
          </div>
        </div>

        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-4 rounded-xl bg-slate-900/60 border border-slate-800/80">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold text-white">Google Sheets Integration</span>
              <span
                className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${
                  currentUser
                    ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30'
                    : 'bg-slate-800 text-slate-400'
                }`}
              >
                {currentUser ? 'Authenticated' : 'Not Connected'}
              </span>
            </div>
            <p className="text-xs text-slate-400">
              {currentUser
                ? `Logged in as ${currentUser.email || currentUser.displayName}. Auto-sync enabled.`
                : 'Sign in to export ledgers or sync recurring bills with your Google Drive spreadsheet.'}
            </p>
          </div>

          <button
            onClick={onOpenGoogleSheets}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-semibold bg-emerald-500 hover:bg-emerald-400 text-slate-950 transition-colors shadow-md shadow-emerald-950/40 cursor-pointer shrink-0 font-bold"
          >
            <FileSpreadsheet className="w-3.5 h-3.5" />
            <span>Manage Google Sheets</span>
          </button>
        </div>

        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-4 rounded-xl bg-slate-900/60 border border-slate-800/80">
          <div className="space-y-1">
            <span className="text-xs font-bold text-white">Document & Statement Importer</span>
            <p className="text-xs text-slate-400">
              Extract ledger records from PDF bank statements, credit card bills, UPI screenshots, and CSVs.
            </p>
          </div>

          <button
            onClick={onOpenUpload}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-semibold bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 transition-colors cursor-pointer shrink-0"
          >
            <UploadCloud className="w-3.5 h-3.5 text-emerald-400" />
            <span>Upload File</span>
          </button>
        </div>
      </div>

      {/* 2. AI Intelligence Engine Configuration */}
      <div className="rounded-2xl bg-[#111827] border border-slate-800 p-6 space-y-4">
        <div className="flex items-center gap-2.5 pb-3 border-b border-slate-800">
          <div className="w-8 h-8 rounded-xl bg-indigo-500/15 text-indigo-400 flex items-center justify-center border border-indigo-500/30">
            <Cpu className="w-4 h-4" />
          </div>
          <div>
            <h2 className="text-sm font-bold text-white">AI Engine & Decision Support Model</h2>
            <p className="text-xs text-slate-400">Gemini 3.8 Flash with high-resilience fallback</p>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div className="p-3.5 rounded-xl bg-slate-900/60 border border-slate-800 text-xs space-y-1">
            <span className="text-slate-400 block text-[11px]">Primary Model</span>
            <span className="font-bold text-white block">Gemini 3.8 Flash</span>
            <span className="text-[10px] text-emerald-400">Resilient failover active</span>
          </div>

          <div className="p-3.5 rounded-xl bg-slate-900/60 border border-slate-800 text-xs space-y-1">
            <span className="text-slate-400 block text-[11px]">Currency Standardization</span>
            <span className="font-bold text-white block flex items-center gap-1">
              <IndianRupee className="w-3.5 h-3.5 text-emerald-400" />
              INR (₹) Only
            </span>
            <span className="text-[10px] text-slate-400">Strict zero-USD policy</span>
          </div>

          <div className="p-3.5 rounded-xl bg-slate-900/60 border border-slate-800 text-xs space-y-1">
            <span className="text-slate-400 block text-[11px]">Backend API</span>
            <span className="font-bold text-white block">Express 4.21.2</span>
            <span className="text-[10px] text-emerald-400">Port 3000 Active</span>
          </div>
        </div>
      </div>

      {/* 3. Data Management & Reset */}
      <div className="rounded-2xl bg-[#111827] border border-slate-800 p-6 space-y-4">
        <div className="flex items-center gap-2.5 pb-3 border-b border-slate-800">
          <div className="w-8 h-8 rounded-xl bg-amber-500/15 text-amber-400 flex items-center justify-center border border-amber-500/30">
            <Database className="w-4 h-4" />
          </div>
          <div>
            <h2 className="text-sm font-bold text-white">Data Management & Dataset Controls</h2>
            <p className="text-xs text-slate-400">Locally hydrated cache and sample records</p>
          </div>
        </div>

        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-4 rounded-xl bg-slate-900/60 border border-slate-800/80">
          <div>
            <span className="text-xs font-bold text-white block">Reset to Realistic Indian Dataset</span>
            <p className="text-xs text-slate-400 mt-0.5">
              Populates realistic INR salary credits, UPI debits, grocery bills, subscriptions (Hotstar, Netflix, Spotify), and SIP goals.
            </p>
          </div>

          <button
            onClick={onLoadSampleData}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-semibold bg-slate-800 hover:bg-slate-700 text-indigo-300 border border-indigo-500/30 transition-colors cursor-pointer shrink-0"
          >
            <RefreshCw className="w-3.5 h-3.5 text-indigo-400" />
            <span>Load Sample Dataset</span>
          </button>
        </div>

        {hasData && (
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-4 rounded-xl bg-rose-500/5 border border-rose-500/20">
            <div>
              <span className="text-xs font-bold text-rose-300 block">Wipe All Local Ledger Data</span>
              <p className="text-xs text-slate-400 mt-0.5">
                Permanently clears all transactions, goals, custom budgets, and saved anomalies from browser storage.
              </p>
            </div>

            <button
              onClick={() => {
                if (window.confirm('Are you sure you want to wipe all local transactions, budgets, and goals?')) {
                  onWipeData();
                }
              }}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-semibold bg-rose-500/15 hover:bg-rose-500/25 text-rose-300 border border-rose-500/30 transition-colors cursor-pointer shrink-0"
            >
              <Trash2 className="w-3.5 h-3.5 text-rose-400" />
              <span>Wipe Data</span>
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
