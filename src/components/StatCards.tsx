import React from 'react';
import { ArrowUpRight, ArrowDownRight, Wallet, TrendingUp, CalendarClock, ShieldCheck } from 'lucide-react';
import { formatINR } from '../utils/currency';

interface StatCardsProps {
  totalIncome: number;
  totalExpenses: number;
  netSavings: number;
  savingsRate: number;
  committedUpcoming: number;
  unallocatedBuffer: number;
  expenseChangePercent: number;
  activeSubscriptionsMonthlyTotal: number;
}

export const StatCards: React.FC<StatCardsProps> = ({
  totalIncome,
  totalExpenses,
  netSavings,
  savingsRate,
  committedUpcoming,
  unallocatedBuffer,
  expenseChangePercent,
  activeSubscriptionsMonthlyTotal,
}) => {
  return (
    <div id="stat-cards-grid" className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
      {/* 1. Total Monthly Income */}
      <div id="stat-card-income" className="bg-white rounded-xl p-4 border border-slate-200 shadow-xs flex flex-col justify-between">
        <div className="flex items-center justify-between">
          <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Total Income</span>
          <div className="w-7 h-7 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center">
            <ArrowDownRight className="w-4 h-4" />
          </div>
        </div>
        <div className="mt-2">
          <div className="text-2xl font-bold text-slate-900 tracking-tight">
            {formatINR(totalIncome)}
          </div>
          <p className="text-xs text-slate-500 mt-1 flex items-center gap-1">
            <span className="font-medium text-emerald-600">Total Credits</span> • Current Month
          </p>
        </div>
      </div>

      {/* 2. Total Expenses */}
      <div id="stat-card-expenses" className="bg-white rounded-xl p-4 border border-slate-200 shadow-xs flex flex-col justify-between">
        <div className="flex items-center justify-between">
          <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Month-to-Date Spend</span>
          <div className="w-7 h-7 rounded-lg bg-slate-100 text-slate-700 flex items-center justify-center">
            <ArrowUpRight className="w-4 h-4 text-rose-500" />
          </div>
        </div>
        <div className="mt-2">
          <div className="text-2xl font-bold text-slate-900 tracking-tight">
            {formatINR(totalExpenses)}
          </div>
          <p className="text-xs text-slate-500 mt-1 flex items-center gap-1">
            <span className={expenseChangePercent > 0 ? 'text-amber-600 font-medium' : 'text-emerald-600 font-medium'}>
              {expenseChangePercent !== 0 ? `${expenseChangePercent > 0 ? '+' : ''}${expenseChangePercent.toFixed(1)}% vs prev` : 'Logged debits'}
            </span>
            <span>• Actual spending</span>
          </p>
        </div>
      </div>

      {/* 3. Net Cash Flow & Savings Rate */}
      <div id="stat-card-savings" className="bg-white rounded-xl p-4 border border-slate-200 shadow-xs flex flex-col justify-between">
        <div className="flex items-center justify-between">
          <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Net Cash Flow</span>
          <div className="w-7 h-7 rounded-lg bg-indigo-50 text-indigo-600 flex items-center justify-center">
            <TrendingUp className="w-4 h-4" />
          </div>
        </div>
        <div className="mt-2">
          <div className={`text-2xl font-bold tracking-tight ${netSavings >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
            {netSavings >= 0 ? `+${formatINR(netSavings)}` : formatINR(netSavings)}
          </div>
          <div className="mt-1 flex items-center justify-between text-xs">
            <span className="text-slate-500">Savings Rate:</span>
            <span className="font-semibold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">
              {(savingsRate * 100).toFixed(1)}%
            </span>
          </div>
        </div>
      </div>

      {/* 4. Committed Obligations vs Discretionary Buffer */}
      <div id="stat-card-committed" className="bg-white rounded-xl p-4 border border-slate-200 shadow-xs flex flex-col justify-between">
        <div className="flex items-center justify-between">
          <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Committed Obligations</span>
          <div className="w-7 h-7 rounded-lg bg-amber-50 text-amber-700 flex items-center justify-center">
            <CalendarClock className="w-4 h-4" />
          </div>
        </div>
        <div className="mt-2">
          <div className="text-2xl font-bold text-slate-900 tracking-tight">
            {formatINR(committedUpcoming)}
          </div>
          <p className="text-xs text-slate-500 mt-1 flex items-center justify-between">
            <span>Upcoming bills</span>
            <span className="font-medium text-slate-700">Subs: {formatINR(activeSubscriptionsMonthlyTotal)}/mo</span>
          </p>
        </div>
      </div>
    </div>
  );
};
