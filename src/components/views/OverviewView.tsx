import React, { useState, useEffect } from 'react';
import {
  TrendingUp,
  TrendingDown,
  Wallet,
  ArrowUpRight,
  ArrowDownRight,
  Sparkles,
  ArrowRight,
  Search,
  CheckCircle2,
  Calendar,
  Layers,
  Repeat,
} from 'lucide-react';
import { Transaction, FinancialContextSnapshot, NavigationTab } from '../../types';
import { formatINR } from '../../utils/currency';

interface OverviewViewProps {
  netSavings: number;
  savingsRate: number;
  totalIncome: number;
  totalExpenses: number;
  totalBudget: number;
  spentSoFar: number;
  committedUpcoming: number;
  unallocatedBuffer: number;
  recentTransactions: Transaction[];
  financialContext: FinancialContextSnapshot;
  onNavigateToTab: (tab: NavigationTab) => void;
  onAnalyzePurchase: () => void;
  onOpenUpload: () => void;
  onOpenAddTransaction: () => void;
}

export const OverviewView: React.FC<OverviewViewProps> = ({
  netSavings,
  savingsRate,
  totalIncome,
  totalExpenses,
  totalBudget,
  spentSoFar,
  committedUpcoming,
  unallocatedBuffer,
  recentTransactions,
  financialContext,
  onNavigateToTab,
  onAnalyzePurchase,
  onOpenUpload,
  onOpenAddTransaction,
}) => {
  // Synthesize concise AI insight grounded in real calculations
  const [insightText, setInsightText] = useState<string>('');
  const [insightLoading, setInsightLoading] = useState(false);

  useEffect(() => {
    // Generate an immediate grounded heuristic or fetch an insight
    if (totalIncome === 0 && totalExpenses === 0) {
      setInsightText('No transactions logged yet this month. Import a statement or log records to activate real-time cash flow intelligence.');
      return;
    }

    const commitmentPercent = totalBudget > 0 ? Math.round(((spentSoFar + committedUpcoming) / totalBudget) * 100) : 0;
    const topCat = financialContext.topExpenseCategories[0];

    if (netSavings >= 0) {
      setInsightText(
        `Positive monthly trajectory with ${Math.round(savingsRate * 100)}% savings rate (${formatINR(netSavings)}). You have ${formatINR(unallocatedBuffer)} unallocated buffer remaining after upcoming obligations.` +
        (topCat ? ` Largest spending category is ${topCat.category} (${formatINR(topCat.amount)}).` : '')
      );
    } else {
      setInsightText(
        `Expenses currently exceed income by ${formatINR(Math.abs(netSavings))}. Total commitment is ${commitmentPercent}% of monthly limit. Review upcoming bills and discretionary spending in Budgets.`
      );
    }
  }, [totalIncome, totalExpenses, netSavings, savingsRate, totalBudget, spentSoFar, committedUpcoming, unallocatedBuffer, financialContext]);

  const totalCommitted = spentSoFar + committedUpcoming;
  const commitmentRatio = totalBudget > 0 ? Math.min(100, Math.round((totalCommitted / totalBudget) * 100)) : 0;
  const spentRatio = totalBudget > 0 ? Math.min(100, Math.round((spentSoFar / totalBudget) * 100)) : 0;

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* 1. Primary Action & AI Insight Hero Banner */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-[#111c2e] via-[#0f172a] to-[#0d131f] border border-slate-800 p-5 sm:p-6 shadow-xl">
        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-5">
          <div className="space-y-2 max-w-2xl">
            <div className="flex items-center gap-2">
              <span className="flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1 rounded-full bg-emerald-500/15 text-emerald-400 border border-emerald-500/30">
                <Sparkles className="w-3.5 h-3.5 text-emerald-400" />
                FinPilot AI Snapshot
              </span>
              <span className="text-xs text-slate-400">• {financialContext.currentMonth}</span>
            </div>
            <p className="text-sm sm:text-base text-slate-200 font-medium leading-relaxed">
              {insightText}
            </p>
          </div>

          <div className="flex items-center gap-3 shrink-0">
            <button
              onClick={onAnalyzePurchase}
              className="inline-flex items-center gap-2 px-5 py-3 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-xs sm:text-sm shadow-lg shadow-emerald-950/60 transition-all hover:scale-[1.02] active:scale-[0.98] cursor-pointer"
            >
              <Search className="w-4 h-4 stroke-[2.5]" />
              <span>Analyze a Purchase</span>
            </button>

            <button
              onClick={() => onNavigateToTab('assistant')}
              className="inline-flex items-center gap-1.5 px-4 py-3 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 font-semibold text-xs border border-slate-700 transition-all cursor-pointer"
            >
              <span>Ask FinPilot</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        {/* Subtle background glow */}
        <div className="absolute -top-16 -right-16 w-64 h-64 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none" />
      </div>

      {/* 2. Top-Level Metric Cards Grid (Prioritizing Net Savings, Income vs Expense, Remaining Buffer) */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Metric 1: Net Savings */}
        <div className="rounded-2xl bg-[#111827] border border-slate-800/80 p-5 shadow-xs flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-400 tracking-wider uppercase">
              Net Savings
            </span>
            <div
              className={`w-8 h-8 rounded-xl flex items-center justify-center ${
                netSavings >= 0 ? 'bg-emerald-500/15 text-emerald-400' : 'bg-rose-500/15 text-rose-400'
              }`}
            >
              {netSavings >= 0 ? <TrendingUp className="w-4 h-4" /> : <TrendingDown className="w-4 h-4" />}
            </div>
          </div>

          <div className="my-3">
            <div
              className={`text-2xl sm:text-3xl font-extrabold tracking-tight ${
                netSavings >= 0 ? 'text-emerald-400' : 'text-rose-400'
              }`}
            >
              {netSavings >= 0 ? `+${formatINR(netSavings)}` : formatINR(netSavings)}
            </div>
            <div className="mt-2 flex items-center justify-between text-xs text-slate-400">
              <span>Savings Rate:</span>
              <span className="font-semibold text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-full border border-emerald-500/20">
                {(savingsRate * 100).toFixed(1)}%
              </span>
            </div>
          </div>

          <div className="pt-3 border-t border-slate-800 text-[11px] text-slate-400 flex items-center justify-between">
            <span>Cash Flow Health</span>
            <span className={netSavings >= 0 ? 'text-emerald-400 font-medium' : 'text-rose-400 font-medium'}>
              {netSavings >= 0 ? 'Surplus Track' : 'Deficit Watch'}
            </span>
          </div>
        </div>

        {/* Metric 2: Income vs Expenses */}
        <div className="rounded-2xl bg-[#111827] border border-slate-800/80 p-5 shadow-xs flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-400 tracking-wider uppercase">
              Cash In vs Out
            </span>
            <div className="w-8 h-8 rounded-xl bg-slate-800 flex items-center justify-center text-slate-300">
              <Wallet className="w-4 h-4 text-emerald-400" />
            </div>
          </div>

          <div className="my-3 space-y-2">
            <div className="flex items-center justify-between text-xs">
              <span className="flex items-center gap-1.5 text-slate-300 font-medium">
                <ArrowDownRight className="w-3.5 h-3.5 text-emerald-400" />
                Income
              </span>
              <span className="font-bold text-white text-sm">{formatINR(totalIncome)}</span>
            </div>

            <div className="flex items-center justify-between text-xs">
              <span className="flex items-center gap-1.5 text-slate-400">
                <ArrowUpRight className="w-3.5 h-3.5 text-rose-400" />
                Expenses
              </span>
              <span className="font-bold text-slate-300 text-sm">{formatINR(totalExpenses)}</span>
            </div>

            {/* Income vs expense progress bar */}
            <div className="w-full bg-slate-800 h-2 rounded-full overflow-hidden flex mt-2">
              <div
                className="bg-emerald-500 h-full transition-all duration-300"
                style={{
                  width: `${totalIncome + totalExpenses > 0 ? (totalIncome / (totalIncome + totalExpenses)) * 100 : 50}%`,
                }}
                title="Income proportion"
              />
              <div
                className="bg-rose-500 h-full transition-all duration-300"
                style={{
                  width: `${totalIncome + totalExpenses > 0 ? (totalExpenses / (totalIncome + totalExpenses)) * 100 : 50}%`,
                }}
                title="Expense proportion"
              />
            </div>
          </div>

          <div className="pt-3 border-t border-slate-800 text-[11px] text-slate-400 flex items-center justify-between">
            <span>Logged Transactions</span>
            <span className="text-slate-200 font-semibold">{financialContext.transactionsCount} records</span>
          </div>
        </div>

        {/* Metric 3: Remaining Budget Buffer */}
        <div className="rounded-2xl bg-[#111827] border border-slate-800/80 p-5 shadow-xs flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-400 tracking-wider uppercase">
              Unallocated Buffer
            </span>
            <div className="w-8 h-8 rounded-xl bg-slate-800 flex items-center justify-center text-slate-300">
              <Layers className="w-4 h-4 text-emerald-400" />
            </div>
          </div>

          <div className="my-3">
            <div className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">
              {formatINR(unallocatedBuffer)}
            </div>
            <div className="mt-2 text-xs text-slate-400 flex items-center justify-between">
              <span>Monthly Budget:</span>
              <span className="text-slate-300 font-medium">{formatINR(totalBudget)}</span>
            </div>

            {/* Budget commitment progress */}
            <div className="w-full bg-slate-800 h-2 rounded-full overflow-hidden mt-2">
              <div
                className={`h-full transition-all duration-300 ${
                  commitmentRatio > 90 ? 'bg-rose-500' : commitmentRatio > 75 ? 'bg-amber-500' : 'bg-emerald-500'
                }`}
                style={{ width: `${commitmentRatio}%` }}
              />
            </div>
          </div>

          <div className="pt-3 border-t border-slate-800 text-[11px] text-slate-400 flex items-center justify-between">
            <span>Committed / Scheduled</span>
            <span className="text-slate-200 font-semibold">{commitmentRatio}% allocated</span>
          </div>
        </div>
      </div>

      {/* 3. Compact Recent Transactions & Quick Highlights */}
      <div className="rounded-2xl bg-[#111827] border border-slate-800/80 overflow-hidden shadow-xs">
        <div className="px-5 py-4 border-b border-slate-800/80 flex items-center justify-between">
          <div>
            <h2 className="text-sm font-bold text-white tracking-tight">Recent Transactions</h2>
            <p className="text-[11px] text-slate-400 mt-0.5">Latest account debits, credits, and obligations</p>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={onOpenAddTransaction}
              className="text-xs font-semibold px-2.5 py-1 rounded-lg bg-slate-800 text-slate-300 hover:text-white hover:bg-slate-700 transition-colors cursor-pointer"
            >
              + Add
            </button>
            <button
              onClick={() => onNavigateToTab('transactions')}
              className="inline-flex items-center gap-1 text-xs font-semibold text-emerald-400 hover:text-emerald-300 transition-colors cursor-pointer"
            >
              <span>View all</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        {recentTransactions.length === 0 ? (
          <div className="p-8 text-center text-slate-400">
            <p className="text-xs font-medium text-slate-300">No transactions recorded yet.</p>
            <p className="text-[11px] text-slate-500 mt-1">
              Upload a bank/UPI statement or log a record manually to see your activity.
            </p>
            <div className="mt-4 flex items-center justify-center gap-2">
              <button
                onClick={onOpenAddTransaction}
                className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-white text-xs font-medium"
              >
                + Add Record
              </button>
              <button
                onClick={onOpenUpload}
                className="px-3 py-1.5 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-xs"
              >
                Import Statement
              </button>
            </div>
          </div>
        ) : (
          <div className="divide-y divide-slate-800/60">
            {recentTransactions.slice(0, 6).map((tx, idx) => {
              const isIncome = tx.type === 'income';
              return (
                <div
                  key={tx.id || `recent-${idx}`}
                  className="px-5 py-3 hover:bg-slate-800/30 transition-colors flex items-center justify-between gap-3 text-xs"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div
                      className={`w-8 h-8 rounded-xl flex items-center justify-center shrink-0 ${
                        isIncome ? 'bg-emerald-500/10 text-emerald-400' : 'bg-slate-800 text-slate-300'
                      }`}
                    >
                      {isIncome ? <ArrowDownRight className="w-4 h-4" /> : <ArrowUpRight className="w-4 h-4 text-rose-400" />}
                    </div>

                    <div className="min-w-0">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span className="font-bold text-white truncate">{tx.merchant}</span>
                        {tx.isRecurring && (
                          <span className="inline-flex items-center gap-0.5 text-[10px] font-medium px-1.5 py-0.2 rounded bg-pink-500/15 text-pink-400 border border-pink-500/25">
                            <Repeat className="w-2.5 h-2.5" />
                            Recurring
                          </span>
                        )}
                        {tx.isAnomaly && (
                          <span className="text-[10px] font-semibold px-1.5 py-0.2 rounded bg-rose-500/20 text-rose-300 border border-rose-500/30">
                            Alert
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-2 text-[11px] text-slate-400 mt-0.5">
                        <span>{tx.date}</span>
                        <span>•</span>
                        <span className="truncate">{tx.category}</span>
                      </div>
                    </div>
                  </div>

                  <div className="text-right shrink-0">
                    <span className={`font-bold text-sm ${isIncome ? 'text-emerald-400' : 'text-slate-100'}`}>
                      {isIncome ? '+' : '-'}{formatINR(tx.amount)}
                    </span>
                    <div className="text-[10px] text-slate-400">{tx.paymentMethod || 'UPI/NetBanking'}</div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};
