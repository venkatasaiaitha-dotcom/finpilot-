import React from 'react';
import {
  Menu,
  Sparkles,
  UploadCloud,
  Plus,
  ShieldAlert,
  Search,
  Calendar,
} from 'lucide-react';
import { NavigationTab } from '../types';

interface HeaderProps {
  activeTab: NavigationTab;
  currentMonth: string;
  onOpenMobileNav: () => void;
  onOpenUpload: () => void;
  onOpenSummary: () => void;
  onOpenAddTransaction: () => void;
  onAnalyzePurchase: () => void;
  unresolvedAnomaliesCount: number;
  onNavigateToAlerts: () => void;
}

const TAB_TITLES: Record<NavigationTab, { title: string; subtitle: string }> = {
  overview: {
    title: 'Financial Overview',
    subtitle: 'Real-time cash flow & decision intelligence',
  },
  assistant: {
    title: 'AI Decision Assistant',
    subtitle: 'Gemini-powered personal finance copilot in INR',
  },
  transactions: {
    title: 'Transactions & Ledger',
    subtitle: 'Unified bank, UPI, and manual records',
  },
  budgets: {
    title: 'Budget Commitment',
    subtitle: 'Category allowances vs. committed obligations',
  },
  goals: {
    title: 'Financial Goals & Simulator',
    subtitle: 'Goal projections & discretionary spending levers',
  },
  recurring: {
    title: 'Recurring Obligations',
    subtitle: 'Subscriptions, bills, and renewal timelines',
  },
  alerts: {
    title: 'Spending Alerts & Anomalies',
    subtitle: 'Spikes, duplicate debits, and price hikes',
  },
  settings: {
    title: 'Settings & Integrations',
    subtitle: 'Cloud sync, data management & preferences',
  },
};

export const Header: React.FC<HeaderProps> = ({
  activeTab,
  currentMonth,
  onOpenMobileNav,
  onOpenUpload,
  onOpenSummary,
  onOpenAddTransaction,
  onAnalyzePurchase,
  unresolvedAnomaliesCount,
  onNavigateToAlerts,
}) => {
  const currentTabInfo = TAB_TITLES[activeTab] || {
    title: 'FinPilot',
    subtitle: 'Personal Finance Agent',
  };

  return (
    <header className="sticky top-0 z-10 bg-[#0d131f]/90 backdrop-blur-md border-b border-slate-800/80 px-4 sm:px-6 py-3">
      <div className="flex items-center justify-between gap-3">
        {/* Left: Hamburger (mobile) + Active View Title */}
        <div className="flex items-center gap-3 min-w-0">
          <button
            onClick={onOpenMobileNav}
            className="md:hidden p-2 rounded-xl bg-slate-900 border border-slate-800 text-slate-300 hover:text-white hover:bg-slate-800"
            aria-label="Open navigation menu"
          >
            <Menu className="w-5 h-5" />
          </button>

          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <h1 className="text-base sm:text-lg font-bold text-white tracking-tight truncate">
                {currentTabInfo.title}
              </h1>
              <span className="hidden sm:inline-flex items-center gap-1 text-[11px] font-medium px-2 py-0.5 rounded-full bg-slate-800/80 text-slate-300 border border-slate-700/60 shrink-0">
                <Calendar className="w-3 h-3 text-emerald-400" />
                {currentMonth}
              </span>
            </div>
            <p className="text-[11px] text-slate-400 truncate hidden sm:block">
              {currentTabInfo.subtitle}
            </p>
          </div>
        </div>

        {/* Right: Quick Action Buttons */}
        <div className="flex items-center gap-2 shrink-0">
          {/* Anomaly Badge Alert Button */}
          {unresolvedAnomaliesCount > 0 && (
            <button
              onClick={onNavigateToAlerts}
              className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl text-xs font-semibold bg-rose-500/15 text-rose-300 border border-rose-500/30 hover:bg-rose-500/25 transition-all shadow-xs cursor-pointer"
              title="View unresolved anomalies"
            >
              <ShieldAlert className="w-3.5 h-3.5 text-rose-400 animate-pulse" />
              <span className="hidden sm:inline">{unresolvedAnomaliesCount} Alerts</span>
              <span className="sm:hidden">{unresolvedAnomaliesCount}</span>
            </button>
          )}

          {/* AI Executive Summary Briefing */}
          <button
            onClick={onOpenSummary}
            className="hidden md:inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold bg-slate-900 hover:bg-slate-800 text-slate-200 border border-slate-700/70 transition-all shadow-xs cursor-pointer"
            title="Generate AI Executive Briefing"
          >
            <Sparkles className="w-3.5 h-3.5 text-amber-400" />
            <span>AI Briefing</span>
          </button>

          {/* Upload Statement Button */}
          <button
            onClick={onOpenUpload}
            className="hidden sm:inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold bg-slate-900 hover:bg-slate-800 text-slate-200 border border-slate-700/70 transition-all shadow-xs cursor-pointer"
            title="Import statements, bills, or UPI receipts"
          >
            <UploadCloud className="w-3.5 h-3.5 text-emerald-400" />
            <span>Import Statement</span>
          </button>

          {/* Analyze a Purchase (Primary Fintech Action) */}
          <button
            onClick={onAnalyzePurchase}
            className="inline-flex items-center gap-1.5 px-3 sm:px-3.5 py-1.5 rounded-xl text-xs font-semibold bg-emerald-500 hover:bg-emerald-400 text-slate-950 transition-all shadow-md shadow-emerald-950/50 cursor-pointer font-medium"
            title="Evaluate purchase affordability with AI"
          >
            <Search className="w-3.5 h-3.5 stroke-[2.5]" />
            <span className="font-bold">Analyze Purchase</span>
          </button>

          {/* Add Record Button */}
          <button
            onClick={onOpenAddTransaction}
            className="inline-flex items-center gap-1 px-2.5 sm:px-3 py-1.5 rounded-xl text-xs font-semibold bg-slate-800 hover:bg-slate-700 text-white border border-slate-700 transition-all shadow-xs cursor-pointer"
            title="Log a transaction manually"
          >
            <Plus className="w-3.5 h-3.5 text-emerald-400" />
            <span className="hidden sm:inline">Add Record</span>
          </button>
        </div>
      </div>
    </header>
  );
};
