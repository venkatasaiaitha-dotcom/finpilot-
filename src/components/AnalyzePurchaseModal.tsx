import React, { useState } from 'react';
import { X, Search, Sparkles, CheckCircle2, AlertTriangle, AlertCircle, ArrowRight, IndianRupee, Bot } from 'lucide-react';
import { FinancialContextSnapshot, Category } from '../types';
import { formatINR } from '../utils/currency';

interface AnalyzePurchaseModalProps {
  isOpen: boolean;
  onClose: () => void;
  financialContext: FinancialContextSnapshot;
  onNavigateToAssistant: (initialPrompt?: string) => void;
}

export const AnalyzePurchaseModal: React.FC<AnalyzePurchaseModalProps> = ({
  isOpen,
  onClose,
  financialContext,
  onNavigateToAssistant,
}) => {
  const [itemName, setItemName] = useState('');
  const [cost, setCost] = useState<number | ''>('');
  const [category, setCategory] = useState<Category>('Shopping & Goods');
  const [aiVerdict, setAiVerdict] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  if (!isOpen) return null;

  const costNum = Number(cost) || 0;
  const buffer = financialContext.budgetCommitment.unallocatedBuffer;
  const netSavings = financialContext.netSavings;

  // Immediate quantitative affordability check
  let instantAffordability: 'healthy' | 'caution' | 'stretched' = 'healthy';
  let instantMessage = '';

  if (costNum > 0) {
    if (costNum <= buffer * 0.5 && costNum <= netSavings) {
      instantAffordability = 'healthy';
      instantMessage = `Comfortably within unallocated buffer (${formatINR(buffer)}). Leaves ${(
        ((buffer - costNum) / (buffer || 1)) *
        100
      ).toFixed(0)}% safety cushion.`;
    } else if (costNum <= buffer) {
      instantAffordability = 'caution';
      instantMessage = `Absorbs ${Math.round((costNum / (buffer || 1)) * 100)}% of your remaining buffer (${formatINR(
        buffer
      )}). Discretionary spending should be curtailed for the rest of the month.`;
    } else {
      instantAffordability = 'stretched';
      instantMessage = `Exceeds current unallocated buffer by ${formatINR(
        costNum - buffer
      )}. Would require dipping into savings or delaying scheduled goal SIP contributions.`;
    }
  }

  const handleAskAI = async () => {
    if (!itemName.trim() || costNum <= 0 || loading) return;

    setLoading(true);
    setAiVerdict(null);

    try {
      const prompt = `Can I afford to purchase "${itemName.trim()}" for ₹${costNum.toLocaleString(
        'en-IN'
      )}? Evaluate its exact impact on my current month net savings (${formatINR(
        netSavings
      )}), remaining budget buffer (${formatINR(
        buffer
      )}), upcoming bills in next 14 days (${formatINR(
        financialContext.upcomingBillsNext14Days
      )}), and active financial goals. Provide an objective recommendation.`;

      const response = await fetch('/api/gemini/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: prompt,
          financialContext,
        }),
      });

      if (!response.ok) {
        throw new Error('AI analysis service unavailable');
      }

      const data = await response.json();
      setAiVerdict(data.content || 'Unable to generate advice.');
    } catch (err: any) {
      setAiVerdict(
        `Unable to reach AI copilot (${err.message}). Instant analysis: ${instantMessage}`
      );
    } finally {
      setLoading(false);
    }
  };

  const handleTransferToAssistant = () => {
    const prompt = itemName
      ? `Can I afford ${itemName} for ₹${costNum}?`
      : 'Can I afford a discretionary purchase?';
    onClose();
    onNavigateToAssistant(prompt);
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto">
      <div className="bg-[#111827] border border-slate-800 rounded-2xl max-w-lg w-full p-6 shadow-2xl relative text-slate-200">
        {/* Header */}
        <div className="flex items-center justify-between pb-4 border-b border-slate-800">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-emerald-500/15 text-emerald-400 flex items-center justify-center border border-emerald-500/30">
              <Search className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-white tracking-tight">
                Analyze a Purchase
              </h2>
              <p className="text-xs text-slate-400">
                Decision intelligence against your real Rupee buffer & goals
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form Inputs */}
        <div className="mt-5 space-y-4">
          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1.5">
              What do you want to buy?
            </label>
            <input
              type="text"
              value={itemName}
              onChange={(e) => setItemName(e.target.value)}
              placeholder="e.g. New Headphones, Weekend Getaway, Gym Membership"
              className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3.5 py-2.5 text-xs text-white placeholder:text-slate-500 focus:outline-hidden focus:border-emerald-500 transition-colors"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                Estimated Price (₹)
              </label>
              <div className="relative">
                <span className="absolute left-3.5 top-2.5 text-xs text-emerald-400 font-bold">
                  ₹
                </span>
                <input
                  type="number"
                  min="0"
                  value={cost}
                  onChange={(e) => setCost(e.target.value === '' ? '' : Number(e.target.value))}
                  placeholder="5,000"
                  className="w-full bg-slate-900 border border-slate-800 rounded-xl pl-8 pr-3.5 py-2.5 text-xs text-white placeholder:text-slate-500 focus:outline-hidden focus:border-emerald-500 transition-colors"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                Category
              </label>
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value as Category)}
                className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3 py-2.5 text-xs text-white focus:outline-hidden focus:border-emerald-500"
              >
                <option value="Shopping & Goods">Shopping & Goods</option>
                <option value="Entertainment">Entertainment</option>
                <option value="Travel">Travel</option>
                <option value="Dining & Takeout">Dining & Takeout</option>
                <option value="Health & Fitness">Health & Fitness</option>
                <option value="Education & Learning">Education & Learning</option>
                <option value="Other Expenses">Other Expenses</option>
              </select>
            </div>
          </div>

          {/* Instant Financial Impact Preview */}
          {costNum > 0 && (
            <div
              className={`p-3.5 rounded-xl border text-xs space-y-1.5 ${
                instantAffordability === 'healthy'
                  ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300'
                  : instantAffordability === 'caution'
                  ? 'bg-amber-500/10 border-amber-500/30 text-amber-300'
                  : 'bg-rose-500/10 border-rose-500/30 text-rose-300'
              }`}
            >
              <div className="flex items-center gap-2 font-bold">
                {instantAffordability === 'healthy' && <CheckCircle2 className="w-4 h-4 text-emerald-400" />}
                {instantAffordability === 'caution' && <AlertTriangle className="w-4 h-4 text-amber-400" />}
                {instantAffordability === 'stretched' && <AlertCircle className="w-4 h-4 text-rose-400" />}
                <span>
                  {instantAffordability === 'healthy'
                    ? 'Affordable — Positive Buffer'
                    : instantAffordability === 'caution'
                    ? 'Tight Fit — Caution Recommended'
                    : 'Over Budget — Stretches Cash Flow'}
                </span>
              </div>
              <p className="text-[11px] leading-relaxed text-slate-300">{instantMessage}</p>
            </div>
          )}

          {/* AI In-depth evaluation response */}
          {aiVerdict && (
            <div className="p-4 rounded-xl bg-slate-900/90 border border-slate-800 text-xs text-slate-200 max-h-48 overflow-y-auto space-y-2">
              <div className="flex items-center gap-1.5 text-emerald-400 font-bold text-[11px]">
                <Bot className="w-3.5 h-3.5" />
                <span>FinPilot Strategic Evaluation</span>
              </div>
              <p className="text-slate-300 leading-relaxed whitespace-pre-line text-[11px]">
                {aiVerdict}
              </p>
            </div>
          )}
        </div>

        {/* Modal Actions */}
        <div className="mt-6 flex items-center justify-between gap-3 pt-4 border-t border-slate-800">
          <button
            onClick={handleTransferToAssistant}
            className="text-xs text-slate-400 hover:text-emerald-400 flex items-center gap-1 transition-colors"
          >
            <span>Open in AI Assistant</span>
            <ArrowRight className="w-3 h-3" />
          </button>

          <div className="flex items-center gap-2">
            <button
              onClick={onClose}
              className="px-3.5 py-2 rounded-xl text-xs font-semibold bg-slate-800 hover:bg-slate-700 text-slate-300 transition-colors"
            >
              Close
            </button>
            <button
              onClick={handleAskAI}
              disabled={loading || !itemName.trim() || costNum <= 0}
              className="px-4 py-2 rounded-xl text-xs font-bold bg-emerald-500 hover:bg-emerald-400 text-slate-950 transition-all flex items-center gap-1.5 disabled:opacity-50 disabled:cursor-not-allowed shadow-md shadow-emerald-950/50 cursor-pointer"
            >
              <Sparkles className="w-3.5 h-3.5" />
              <span>{loading ? 'Evaluating...' : 'Get AI Verdict'}</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
