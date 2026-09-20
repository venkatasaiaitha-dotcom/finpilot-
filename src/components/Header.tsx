import React from 'react';
import { Bot, RefreshCw, Trash2, UploadCloud, Plus, Sparkles, ShieldAlert, IndianRupee } from 'lucide-react';

interface HeaderProps {
  currentMonth: string;
  onOpenUpload: () => void;
  onOpenSummary: () => void;
  onOpenAddTransaction: () => void;
  onWipeData: () => void;
  onLoadSampleData: () => void;
  unresolvedAnomaliesCount: number;
  hasData: boolean;
}

export const Header: React.FC<HeaderProps> = ({
  currentMonth,
  onOpenUpload,
  onOpenSummary,
  onOpenAddTransaction,
  onWipeData,
  onLoadSampleData,
  unresolvedAnomaliesCount,
  hasData,
}) => {
  return (
    <header id="app-header" className="bg-white border-b border-slate-200 sticky top-0 z-30 shadow-xs">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-3 flex flex-col md:flex-row md:items-center md:justify-between gap-3">
        {/* Brand identity & Month Context */}
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-slate-900 text-amber-400 flex items-center justify-center shadow-xs shrink-0">
            <Bot className="w-6 h-6 text-emerald-400" />
          </div>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="text-lg font-bold text-slate-900 tracking-tight">FinPilot</h1>
              <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200">
                Decision Support Agent
              </span>
              <span className="inline-flex items-center gap-0.5 text-[11px] font-bold px-2 py-0.5 rounded-full bg-indigo-50 text-indigo-700 border border-indigo-200">
                <IndianRupee className="w-3 h-3" />
                INR (₹)
              </span>
              <span className="text-xs text-slate-500 font-medium hidden sm:inline-block">
                • {currentMonth}
              </span>
            </div>
            <p className="text-[11px] text-slate-500 hidden sm:block">
              AI-driven cash-flow intelligence, recurring obligation forecasting & goal feasibility in Indian Rupees
            </p>
          </div>
        </div>

        {/* Global Action Toolbar */}
        <div className="flex items-center flex-wrap gap-2">
          {unresolvedAnomaliesCount > 0 && (
            <button
              id="header-anomalies-alert"
              onClick={() => {
                const el = document.getElementById('anomalies-section');
                el?.scrollIntoView({ behavior: 'smooth' });
              }}
              className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-semibold bg-rose-50 text-rose-700 border border-rose-200 hover:bg-rose-100 transition-colors"
            >
              <ShieldAlert className="w-3.5 h-3.5 text-rose-600" />
              <span>{unresolvedAnomaliesCount} Anomalies Flagged</span>
            </button>
          )}

          <button
            id="header-monthly-summary-btn"
            onClick={onOpenSummary}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-indigo-50 text-indigo-700 border border-indigo-200 hover:bg-indigo-100 transition-colors shadow-2xs"
          >
            <Sparkles className="w-3.5 h-3.5 text-indigo-600" />
            <span>AI Executive Briefing</span>
          </button>

          <button
            id="header-upload-statement-btn"
            onClick={onOpenUpload}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-emerald-600 text-white hover:bg-emerald-700 transition-colors shadow-2xs"
          >
            <UploadCloud className="w-3.5 h-3.5" />
            <span>Upload Statement / Bill</span>
          </button>

          <button
            id="header-add-tx-btn"
            onClick={onOpenAddTransaction}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-slate-900 text-white hover:bg-slate-800 transition-colors shadow-2xs"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>+ Add Record</span>
          </button>

          {/* Sample Data & Wipe Controls */}
          <button
            id="header-load-sample-btn"
            onClick={onLoadSampleData}
            title="Load or reset to realistic Indian sample dataset (₹)"
            className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-medium text-indigo-600 hover:text-indigo-800 hover:bg-indigo-50 border border-indigo-200 transition-colors"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            <span>Sample Data (₹)</span>
          </button>

          {hasData && (
            <button
              id="header-wipe-data-btn"
              onClick={onWipeData}
              title="Wipe all transactions, budgets, and goals to start fresh"
              className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-medium text-rose-600 hover:text-rose-800 hover:bg-rose-50 border border-transparent hover:border-rose-200 transition-colors"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span>Wipe</span>
            </button>
          )}
        </div>
      </div>
    </header>
  );
};
