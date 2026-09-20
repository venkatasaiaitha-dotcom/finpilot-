import React, { useState } from 'react';
import { Sparkles, CheckCircle2, TrendingDown, TrendingUp, AlertTriangle, ArrowRight, Printer, X, ShieldAlert } from 'lucide-react';
import { FinancialContextSnapshot } from '../types';
import { formatINR } from '../utils/currency';

interface MonthlySummaryModalProps {
  isOpen: boolean;
  onClose: () => void;
  financialContext: FinancialContextSnapshot;
}

export const MonthlySummaryModal: React.FC<MonthlySummaryModalProps> = ({
  isOpen,
  onClose,
  financialContext,
}) => {
  const [loading, setLoading] = useState(false);
  const [summaryData, setSummaryData] = useState<any>(null);

  if (!isOpen) return null;

  const fetchAiSummary = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/gemini/generate-summary', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ financialContext }),
      });
      if (res.ok) {
        const data = await res.json();
        setSummaryData(data);
      }
    } catch (err) {
      console.error('Failed to generate summary:', err);
    } finally {
      setLoading(false);
    }
  };

  const netSavingsFormatted = formatINR(financialContext.netSavings);

  const summary =
    summaryData || {
      cashFlowStatus: financialContext.netSavings >= 0 ? 'healthy' : 'deficit',
      cashFlowHeadline:
        financialContext.totalIncome > 0
          ? `Cash flow currently stands at ${netSavingsFormatted} net monthly savings (${(financialContext.savingsRate * 100).toFixed(1)}% savings rate).`
          : 'No transactions recorded yet. Add your income and expenses to generate a comprehensive financial health summary.',
      keyObservations:
        financialContext.totalExpenses > 0
          ? [
              `Total month-to-date spending is ${formatINR(financialContext.totalExpenses)}.`,
              `Committed upcoming obligations total ${formatINR(financialContext.budgetCommitment?.committedUpcoming || financialContext.upcomingBillsNext14Days || 0)} for the rest of the month.`,
              `Active recurring subscriptions burden is ${formatINR(financialContext.activeSubscriptionsMonthlyTotal)}/month.`,
            ]
          : [
              'Your ledger is currently fresh and ready for data entry.',
              'Add your monthly salary / income and recurring expenses to calculate exact buffer and runway.',
            ],
      actionItems: [
        {
          id: 'act-1',
          title: 'Review Active Recurring Bills & Subscriptions',
          impact: 'medium',
          potentialSavings: 500.0,
          category: 'Subscriptions & Digital',
          description: 'Audit OTT services and autopay debits to ensure no unused plans are draining your monthly buffer.',
        },
        {
          id: 'act-2',
          title: 'Automate Monthly Emergency Fund Transfer',
          impact: 'high',
          potentialSavings: 2500.0,
          category: 'Financial & Savings',
          description: 'Route funds to high-yield recurring deposits or liquid mutual funds immediately following salary credit.',
        },
      ],
      goalImpactAssessment:
        'Maintaining disciplined discretionary spending ensures steady progress toward your active financial goals and wealth reserves.',
    };

  return (
    <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4 z-50 overflow-y-auto">
      <div className="bg-white rounded-2xl max-w-2xl w-full p-6 shadow-2xl border border-slate-200 my-8">
        {/* Header */}
        <div className="flex items-center justify-between pb-4 border-b border-slate-100">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-indigo-600 text-white flex items-center justify-center shadow-xs">
              <Sparkles className="w-5 h-5 text-amber-300" />
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-900">
                Monthly Financial Summary & Intelligence Briefing
              </h2>
              <p className="text-xs text-slate-500">
                {financialContext.currentMonth || 'Current Month'} • AI-synthesized executive overview in Rupees (₹)
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => window.print()}
              className="p-1.5 rounded-lg text-slate-500 hover:text-slate-800 hover:bg-slate-100 transition-colors"
              title="Print Summary"
            >
              <Printer className="w-4 h-4" />
            </button>
            <button
              onClick={onClose}
              className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="mt-4 space-y-4 text-xs">
          {/* Headline Reality Check */}
          <div className="p-3.5 rounded-xl bg-emerald-50/70 border border-emerald-200">
            <div className="flex items-center gap-2 mb-1">
              <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-800 px-2 py-0.5 rounded-full bg-emerald-100">
                Cash Flow Reality Check
              </span>
              <span className="text-[11px] font-semibold text-emerald-900">
                {financialContext.netSavings >= 0 ? `Positive (${netSavingsFormatted} Net Flow)` : `Deficit (${netSavingsFormatted})`}
              </span>
            </div>
            <p className="text-xs text-emerald-950 font-medium leading-relaxed">
              {summary.cashFlowHeadline}
            </p>
          </div>

          {/* Key Observations */}
          <div>
            <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider mb-2">
              Key Observations
            </h3>
            <div className="space-y-2">
              {summary.keyObservations.map((obs: string, idx: number) => (
                <div key={idx} className="flex items-start gap-2 bg-slate-50 p-2.5 rounded-lg border border-slate-100">
                  <span className="w-4 h-4 rounded-full bg-indigo-100 text-indigo-700 font-bold text-[10px] flex items-center justify-center shrink-0 mt-0.5">
                    {idx + 1}
                  </span>
                  <span className="text-xs text-slate-700 leading-relaxed">{obs}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Prioritized Action Items */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider">
                Prioritized Action Items
              </h3>
              <span className="text-[10px] text-slate-500 font-medium">Ranked by financial leverage</span>
            </div>

            <div className="space-y-2.5">
              {summary.actionItems.map((item: any, idx: number) => (
                <div
                  key={item.id ? `${item.id}-${idx}` : `action-${idx}`}
                  className="p-3 rounded-xl border border-slate-200 bg-white shadow-2xs flex flex-col sm:flex-row sm:items-center justify-between gap-2"
                >
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-slate-900">{item.title}</span>
                      <span
                        className={`text-[9px] font-bold px-1.5 py-0.5 rounded-full ${
                          item.impact === 'high'
                            ? 'bg-rose-50 text-rose-700 border border-rose-200'
                            : 'bg-amber-50 text-amber-700 border border-amber-200'
                        }`}
                      >
                        {item.impact.toUpperCase()} IMPACT
                      </span>
                    </div>
                    <p className="text-slate-600 mt-0.5">{item.description}</p>
                  </div>

                  <div className="text-right shrink-0">
                    <span className="text-[10px] text-slate-500 block">Est. Monthly Impact</span>
                    <span className="text-xs font-bold text-emerald-600">+{formatINR(item.potentialSavings)}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Goal Impact Note */}
          <div className="p-3 bg-indigo-50/50 border border-indigo-100 rounded-xl">
            <h4 className="font-bold text-indigo-950 mb-1 text-[11px]">Goal Trajectory Assessment</h4>
            <p className="text-indigo-900/90 leading-relaxed text-xs">{summary.goalImpactAssessment}</p>
          </div>
        </div>

        {/* Footer */}
        <div className="mt-5 pt-4 border-t border-slate-100 flex items-center justify-between">
          <button
            onClick={fetchAiSummary}
            disabled={loading}
            className="inline-flex items-center gap-1.5 text-xs font-semibold text-indigo-600 hover:text-indigo-800 disabled:opacity-50"
          >
            <Sparkles className="w-3.5 h-3.5" />
            <span>{loading ? 'Regenerating with Gemini...' : 'Regenerate Analysis with Gemini'}</span>
          </button>

          <button
            onClick={onClose}
            className="px-4 py-2 rounded-lg bg-slate-900 hover:bg-slate-800 text-white font-semibold text-xs shadow-2xs"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
};
