import React from 'react';
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
} from 'lucide-react';
import { User } from 'firebase/auth';

interface SettingsViewProps {
  currentUser: User | null;
  onOpenGoogleSheets: () => void;
  onOpenUpload: () => void;
  onLoadSampleData: () => void;
  onWipeData: () => void;
  hasData: boolean;
}

export const SettingsView: React.FC<SettingsViewProps> = ({
  currentUser,
  onOpenGoogleSheets,
  onOpenUpload,
  onLoadSampleData,
  onWipeData,
  hasData,
}) => {
  return (
    <div className="space-y-6 max-w-4xl mx-auto">
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
