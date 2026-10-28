import React, { useState, useEffect } from 'react';
import { Sparkles, X, Printer, TrendingUp, CheckCircle, ArrowRight, ShieldCheck, IndianRupee } from 'lucide-react';
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
  const [aiSummary, setAiSummary] = useState<any | null>(null);

  useEffect(() => {
    if (isOpen && !aiSummary) {
      fetchAiSummary();
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const fetchAiSummary = async () => {
    setLoading(true);
    try {
      const response = await fetch('/api/gemini/generate-summary', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ financialContext }),
      });

      if (!response.ok) {
        throw new Error('Summary generator endpoint error');
      }

      const data = await response.json();
      setAiSummary(data);
    } catch (err: any) {
      console.log('Using heuristic executive summary:', err.message);
    } finally {
      setLoading(false);
    }
  };

  const netSavingsFormatted = formatINR(financialContext.netSavings);
  const savingsPct = (Number(financialContext.savingsRate || 0) * 100).toFixed(1);

  // Heuristic default if AI endpoint is not connected
  const summary = aiSummary || {
    cashFlowStatus: financialContext.netSavings >= 0 ? 'healthy' : 'stretched',
    cashFlowHeadline:
      financialContext.netSavings >= 0
        ? `Solid surplus trajectory in ${financialContext.currentMonth}. You are retaining ${savingsPct}% of incoming cash flow (${netSavingsFormatted}) after all logged expenses.`
        : `Spending currently exceeds recorded monthly credits by ${netSavingsFormatted}. Consider reviewing discretionary dining, shopping, and recurring OTT subscriptions.`,
    keyObservations:
      financialContext.totalExpenses > 0
        ? [
            `Total month-to-date spending is ${formatINR(financialContext.totalExpenses)}.`,
            `Committed upcoming obligations total ${formatINR(
              financialContext.budgetCommitment?.committedUpcoming || financialContext.upcomingBillsNext14Days || 0
            )} for the rest of the month.`,
            `Active recurring subscriptions burden is ${formatINR(
              financialContext.activeSubscriptionsMonthlyTotal
            )}/month.`,
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
    <div className="fixed inset-0 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4 z-50 overflow-y-auto">
      <div className="bg-[#111827] rounded-2xl max-w-2xl w-full p-6 shadow-2xl border border-slate-800 my-8 text-slate-200">
        {/* Header */}
        <div className="flex items-center justify-between pb-4 border-b border-slate-800">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 flex items-center justify-center">
              <Sparkles className="w-5 h-5 text-emerald-400" />
            </div>
            <div>
              <h2 className="text-base font-bold text-white">
                Monthly Financial Summary & Intelligence Briefing
              </h2>
              <p className="text-xs text-slate-400">
                {financialContext.currentMonth || 'Current Month'} • AI-synthesized executive overview in Rupees (₹)
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => window.print()}
              className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
              title="Print Summary"
            >
              <Printer className="w-4 h-4" />
            </button>
            <button
              onClick={onClose}
              className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="mt-4 space-y-4 text-xs">
          {/* Headline Reality Check */}
          <div className="p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/25">
            <div className="flex items-center gap-2 mb-1">
              <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-300 px-2 py-0.5 rounded-full bg-emerald-500/20">
                Cash Flow Reality Check
              </span>
              <span className="text-[11px] font-semibold text-emerald-200">
                {financialContext.netSavings >= 0 ? `Positive (${netSavingsFormatted} Net Flow)` : `Deficit (${netSavingsFormatted})`}
              </span>
            </div>
            <p className="text-xs text-slate-200 font-medium leading-relaxed">
              {summary.cashFlowHeadline}
            </p>
          </div>

          {/* Key Observations */}
          <div>
            <h3 className="text-xs font-bold text-white uppercase tracking-wider mb-2">
              Key Observations
            </h3>
            <div className="space-y-2">
              {summary.keyObservations.map((obs: string, idx: number) => (
                <div key={idx} className="flex items-start gap-2.5 bg-slate-900/60 p-3 rounded-xl border border-slate-800">
                  <span className="w-4 h-4 rounded-full bg-emerald-500/20 text-emerald-400 font-bold text-[10px] flex items-center justify-center shrink-0 mt-0.5">
                    {idx + 1}
                  </span>
                  <span className="text-xs text-slate-300 leading-relaxed">{obs}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Prioritized Action Items */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-xs font-bold text-white uppercase tracking-wider">
                Prioritized Action Items
              </h3>
              <span className="text-[10px] text-slate-400 font-medium">Ranked by financial leverage</span>
            </div>

            <div className="space-y-2.5">
              {summary.actionItems.map((item: any, idx: number) => (
                <div
                  key={item.id ? `${item.id}-${idx}` : `action-${idx}`}
                  className="p-3.5 rounded-xl border border-slate-800 bg-slate-900/50 flex flex-col sm:flex-row sm:items-center justify-between gap-2"
                >
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-white">{item.title}</span>
                      <span
                        className={`text-[9px] font-bold px-1.5 py-0.5 rounded-full ${
                          item.impact === 'high'
                            ? 'bg-rose-500/15 text-rose-300 border border-rose-500/30'
                            : 'bg-amber-500/15 text-amber-300 border border-amber-500/30'
                        }`}
                      >
                        {item.impact.toUpperCase()} IMPACT
                      </span>
                    </div>
                    <p className="text-slate-400 mt-0.5">{item.description}</p>
                  </div>

                  <div className="text-right shrink-0">
                    <span className="text-[10px] text-slate-400 block">Est. Monthly Impact</span>
                    <span className="text-xs font-bold text-emerald-400">+{formatINR(item.potentialSavings)}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Goal Impact Note */}
          <div className="p-3.5 bg-slate-900/60 border border-slate-800 rounded-xl">
            <h4 className="font-bold text-white mb-1 text-[11px]">Goal Trajectory Assessment</h4>
            <p className="text-slate-300 leading-relaxed text-xs">{summary.goalImpactAssessment}</p>
          </div>
        </div>

        {/* Footer */}
        <div className="mt-6 pt-4 border-t border-slate-800 flex items-center justify-between">
          <button
            onClick={fetchAiSummary}
            disabled={loading}
            className="inline-flex items-center gap-1.5 text-xs font-semibold text-emerald-400 hover:text-emerald-300 disabled:opacity-50 cursor-pointer"
          >
            <Sparkles className="w-3.5 h-3.5" />
            <span>{loading ? 'Regenerating with Gemini...' : 'Regenerate Analysis with Gemini'}</span>
          </button>

          <button
            onClick={onClose}
            className="px-4 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-xs cursor-pointer shadow-md shadow-emerald-950/40"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
};
