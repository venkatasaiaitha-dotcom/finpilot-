import React, { useState } from 'react';
import { FinancialGoal } from '../types';
import { Target, Sparkles, Plus, Sliders, X } from 'lucide-react';
import { formatINR } from '../utils/currency';

interface GoalImpactAnalyzerProps {
  goals: FinancialGoal[];
  onAddGoal: (goal: FinancialGoal) => void;
  monthlyDiscretionarySpend: number;
  netSavings: number;
}

export const GoalImpactAnalyzer: React.FC<GoalImpactAnalyzerProps> = ({
  goals,
  onAddGoal,
  monthlyDiscretionarySpend,
  netSavings,
}) => {
  const [showAddModal, setShowAddModal] = useState(false);
  const [newGoalName, setNewGoalName] = useState('');
  const [newGoalTarget, setNewGoalTarget] = useState<number>(100000);
  const [newGoalCurrent, setNewGoalCurrent] = useState<number>(20000);
  const [newGoalMonthly, setNewGoalMonthly] = useState<number>(5000);
  const [newGoalDate, setNewGoalDate] = useState('2027-06-30');
  const [newGoalCategory, setNewGoalCategory] = useState<'emergency' | 'travel' | 'purchase' | 'debt' | 'savings'>('savings');

  // Interactive What-If Spending Lever Simulator in Rupees
  const [diningCutSavings, setDiningCutSavings] = useState<number>(1500);
  const [subscriptionTrimSavings, setSubscriptionTrimSavings] = useState<number>(800);

  const extraMonthlyPool = diningCutSavings + subscriptionTrimSavings;

  const handleCreateGoal = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newGoalName.trim() || newGoalTarget <= 0) return;

    const newGoal: FinancialGoal = {
      id: `goal-${Date.now()}`,
      name: newGoalName.trim(),
      targetAmount: Number(newGoalTarget),
      currentAmount: Number(newGoalCurrent),
      monthlyContribution: Number(newGoalMonthly),
      targetDate: newGoalDate,
      category: newGoalCategory,
      priority: 'medium',
      notes: 'Custom user defined goal',
    };

    onAddGoal(newGoal);
    setShowAddModal(false);
    setNewGoalName('');
  };

  return (
    <div id="goal-impact-card" className="bg-[#111827] rounded-2xl border border-slate-800 shadow-xl p-5 sm:p-6 space-y-4">
      {/* Card Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-4 border-b border-slate-800 gap-3">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-base font-bold text-white tracking-tight">Financial Goals & Simulator</h2>
            <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-400 border border-emerald-500/30">
              {goals.length} Active Goals
            </span>
          </div>
          <p className="text-xs text-slate-400 mt-0.5">
            Analyze how discretionary adjustments & savings accelerators impact your target dates
          </p>
        </div>

        <button
          onClick={() => setShowAddModal(true)}
          className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl text-xs font-bold bg-emerald-500 hover:bg-emerald-400 text-slate-950 transition-all shadow-md shadow-emerald-950/40 self-start sm:self-auto cursor-pointer"
        >
          <Plus className="w-3.5 h-3.5 stroke-[2.5]" />
          <span>New Goal</span>
        </button>
      </div>

      {/* Active Goals Grid or Empty State */}
      {goals.length === 0 ? (
        <div className="my-6 p-8 text-center border border-dashed border-slate-800 rounded-2xl">
          <Target className="w-8 h-8 text-slate-500 mx-auto mb-2" />
          <p className="text-xs font-semibold text-slate-300">No financial goals set yet.</p>
          <p className="text-[11px] text-slate-500 mt-1">
            Create goals like an Emergency Fund, Vacation, Vehicle purchase, or Gold/SIP investments.
          </p>
          <button
            onClick={() => setShowAddModal(true)}
            className="mt-4 inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold bg-emerald-500 hover:bg-emerald-400 text-slate-950"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Create First Goal</span>
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 my-4">
          {goals.map((goal, idx) => {
            const remainingAmount = Math.max(0, goal.targetAmount - goal.currentAmount);
            const percentDone = Math.min(100, Math.round((goal.currentAmount / goal.targetAmount) * 100));

            // Base calculation of months needed at baseline monthly contribution
            const baselineMonthsNeeded = goal.monthlyContribution > 0 ? Math.ceil(remainingAmount / goal.monthlyContribution) : 0;

            // Accelerated calculation with What-If spending lever
            const acceleratedMonthly = goal.monthlyContribution + (goal.priority === 'high' ? extraMonthlyPool * 0.7 : extraMonthlyPool * 0.3);
            const acceleratedMonthsNeeded = acceleratedMonthly > 0 ? Math.ceil(remainingAmount / acceleratedMonthly) : baselineMonthsNeeded;
            const monthsSaved = Math.max(0, baselineMonthsNeeded - acceleratedMonthsNeeded);

            return (
              <div
                key={goal.id ? `${goal.id}-${idx}` : `goal-${idx}`}
                className="p-4 rounded-xl border border-slate-800 bg-slate-900/50 flex flex-col justify-between"
              >
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                      {goal.category}
                    </span>
                    <span
                      className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                        goal.priority === 'high'
                          ? 'bg-rose-500/15 text-rose-300 border border-rose-500/30'
                          : 'bg-slate-800 text-slate-300 border border-slate-700'
                      }`}
                    >
                      {goal.priority.toUpperCase()}
                    </span>
                  </div>

                  <h3 className="text-xs font-bold text-white leading-tight">{goal.name}</h3>

                  <div className="mt-3 flex items-baseline justify-between">
                    <span className="text-lg font-extrabold text-white">
                      {formatINR(goal.currentAmount, false)}
                    </span>
                    <span className="text-xs text-slate-400 font-medium">
                      of {formatINR(goal.targetAmount, false)}
                    </span>
                  </div>

                  {/* Progress bar */}
                  <div className="w-full h-2 bg-slate-800 rounded-full overflow-hidden my-2.5">
                    <div
                      className="h-full bg-emerald-500 rounded-full transition-all duration-500"
                      style={{ width: `${percentDone}%` }}
                    />
                  </div>

                  <div className="flex justify-between text-[11px] text-slate-400">
                    <span>{percentDone}% saved</span>
                    <span>Target: {goal.targetDate}</span>
                  </div>
                </div>

                {/* Impact / Pace note */}
                <div className="mt-3 pt-3 border-t border-slate-800 text-[11px]">
                  <div className="flex justify-between items-center text-slate-300">
                    <span>Monthly SIP:</span>
                    <strong className="text-white">{formatINR(goal.monthlyContribution)}/mo</strong>
                  </div>
                  {extraMonthlyPool > 0 && monthsSaved > 0 ? (
                    <div className="mt-2 p-2 bg-emerald-500/10 border border-emerald-500/30 rounded-lg text-emerald-300 font-medium text-[10px] flex items-center gap-1.5">
                      <Sparkles className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                      <span>Levers hit this goal <strong>{monthsSaved} month{monthsSaved === 1 ? '' : 's'} earlier!</strong></span>
                    </div>
                  ) : (
                    <div className="mt-1 text-slate-500 text-[10px]">
                      ~{baselineMonthsNeeded} months remaining to target date.
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Interactive Spending Lever / What-If Simulator */}
      <div className="bg-slate-900/60 rounded-xl p-4 sm:p-5 border border-slate-800 mt-4">
        <div className="flex items-center gap-2 mb-2">
          <Sliders className="w-4 h-4 text-emerald-400" />
          <h3 className="text-xs font-bold text-white uppercase tracking-wider">
            Goal Acceleration Levers (Interactive What-If)
          </h3>
        </div>
        <p className="text-xs text-slate-400 mb-4">
          Simulate how reducing dining or trimming unused subscriptions frees up additional monthly cash flow for your goals:
        </p>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="space-y-1.5 bg-slate-900/80 p-3.5 rounded-xl border border-slate-800">
            <div className="flex justify-between text-xs">
              <span className="text-slate-300 font-medium">Trim Dining & Takeout:</span>
              <strong className="text-emerald-400 font-bold">+{formatINR(diningCutSavings)}/mo</strong>
            </div>
            <input
              type="range"
              min="0"
              max="5000"
              step="250"
              value={diningCutSavings}
              onChange={(e) => setDiningCutSavings(Number(e.target.value))}
              className="w-full accent-emerald-500 cursor-pointer"
            />
          </div>

          <div className="space-y-1.5 bg-slate-900/80 p-3.5 rounded-xl border border-slate-800">
            <div className="flex justify-between text-xs">
              <span className="text-slate-300 font-medium">Cancel / Downgrade Subscriptions:</span>
              <strong className="text-emerald-400 font-bold">+{formatINR(subscriptionTrimSavings)}/mo</strong>
            </div>
            <input
              type="range"
              min="0"
              max="2500"
              step="100"
              value={subscriptionTrimSavings}
              onChange={(e) => setSubscriptionTrimSavings(Number(e.target.value))}
              className="w-full accent-emerald-500 cursor-pointer"
            />
          </div>
        </div>

        <div className="mt-3.5 pt-3 border-t border-slate-800/80 flex items-center justify-between text-xs text-slate-300">
          <span>Combined Monthly Cash Flow Boost:</span>
          <span className="font-extrabold text-emerald-400 text-sm">+{formatINR(extraMonthlyPool)}/month</span>
        </div>
      </div>

      {/* New Goal Modal */}
      {showAddModal && (
        <div className="fixed inset-0 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4 z-50 overflow-y-auto">
          <div className="bg-[#111827] rounded-2xl max-w-md w-full p-6 shadow-2xl border border-slate-800 text-slate-200">
            <div className="flex justify-between items-center pb-3 border-b border-slate-800 mb-4">
              <h3 className="text-sm font-bold text-white">Create Financial Goal</h3>
              <button
                onClick={() => setShowAddModal(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreateGoal} className="space-y-3.5 text-xs">
              <div>
                <label className="block font-semibold text-slate-300 mb-1">Goal Name</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. 6-Month Emergency Fund, Goa Trip, New Laptop"
                  value={newGoalName}
                  onChange={(e) => setNewGoalName(e.target.value)}
                  className="w-full px-3.5 py-2.5 bg-slate-900 border border-slate-800 rounded-xl text-white placeholder:text-slate-500 focus:outline-hidden focus:border-emerald-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-300 mb-1">Target Amount (₹)</label>
                  <input
                    type="number"
                    step="1000"
                    required
                    min="1000"
                    value={newGoalTarget}
                    onChange={(e) => setNewGoalTarget(Number(e.target.value))}
                    className="w-full px-3.5 py-2.5 bg-slate-900 border border-slate-800 rounded-xl text-white focus:outline-hidden focus:border-emerald-500"
                  />
                </div>

                <div>
                  <label className="block font-semibold text-slate-300 mb-1">Current Saved (₹)</label>
                  <input
                    type="number"
                    step="500"
                    min="0"
                    value={newGoalCurrent}
                    onChange={(e) => setNewGoalCurrent(Number(e.target.value))}
                    className="w-full px-3.5 py-2.5 bg-slate-900 border border-slate-800 rounded-xl text-white focus:outline-hidden focus:border-emerald-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-300 mb-1">Monthly Plan (₹/mo)</label>
                  <input
                    type="number"
                    step="500"
                    min="100"
                    value={newGoalMonthly}
                    onChange={(e) => setNewGoalMonthly(Number(e.target.value))}
                    className="w-full px-3.5 py-2.5 bg-slate-900 border border-slate-800 rounded-xl text-white focus:outline-hidden focus:border-emerald-500"
                  />
                </div>

                <div>
                  <label className="block font-semibold text-slate-300 mb-1">Target Date</label>
                  <input
                    type="date"
                    required
                    value={newGoalDate}
                    onChange={(e) => setNewGoalDate(e.target.value)}
                    className="w-full px-3.5 py-2.5 bg-slate-900 border border-slate-800 rounded-xl text-white focus:outline-hidden focus:border-emerald-500"
                  />
                </div>
              </div>

              <div>
                <label className="block font-semibold text-slate-300 mb-1">Category</label>
                <select
                  value={newGoalCategory}
                  onChange={(e) => setNewGoalCategory(e.target.value as any)}
                  className="w-full px-3.5 py-2.5 bg-slate-900 border border-slate-800 rounded-xl text-white focus:outline-hidden focus:border-emerald-500"
                >
                  <option value="emergency">Emergency Fund</option>
                  <option value="savings">Wealth / SIP Investment</option>
                  <option value="travel">Travel & Vacation</option>
                  <option value="purchase">Vehicle / Asset Purchase</option>
                  <option value="debt">Debt Repayment</option>
                </select>
              </div>

              <div className="flex justify-end gap-2.5 pt-4 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-medium"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold"
                >
                  Save Goal
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
