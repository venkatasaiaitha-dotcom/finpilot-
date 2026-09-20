import React, { useState } from 'react';
import { FinancialGoal } from '../types';
import { Target, Compass, Sparkles, Plus, Check, ChevronRight, TrendingUp, Sliders, Calendar, ShieldCheck } from 'lucide-react';
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
    <div id="goal-impact-card" className="bg-white rounded-xl border border-slate-200 shadow-xs p-5">
      {/* Card Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-4 border-b border-slate-100 gap-3">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-base font-bold text-slate-900">Financial Goals & Spending Impact Simulator</h2>
            <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full bg-indigo-50 text-indigo-700 border border-indigo-200">
              {goals.length} Active Goals
            </span>
          </div>
          <p className="text-xs text-slate-500 mt-0.5">
            Analyze how everyday discretionary spending, dining, and subscriptions impact your target dates
          </p>
        </div>

        <button
          onClick={() => setShowAddModal(true)}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-slate-900 text-white hover:bg-slate-800 transition-colors shadow-2xs self-start sm:self-auto"
        >
          <Plus className="w-3.5 h-3.5" />
          <span>New Financial Goal</span>
        </button>
      </div>

      {/* Active Goals Grid or Empty State */}
      {goals.length === 0 ? (
        <div className="my-6 p-8 text-center border border-dashed border-slate-200 rounded-xl">
          <Target className="w-8 h-8 text-slate-400 mx-auto mb-2" />
          <p className="text-xs font-semibold text-slate-700">No financial goals set yet.</p>
          <p className="text-[11px] text-slate-500 mt-0.5">
            Create goals like an Emergency Fund, Goa/Kashmir Trip, Vehicle purchase, or Gold/SIP investments.
          </p>
          <button
            onClick={() => setShowAddModal(true)}
            className="mt-3 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-indigo-600 text-white hover:bg-indigo-700"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Create First Goal</span>
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 my-5">
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
              <div key={goal.id ? `${goal.id}-${idx}` : `goal-${idx}`} className="p-4 rounded-xl border border-slate-200 bg-slate-50/40 flex flex-col justify-between">
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">
                      {goal.category}
                    </span>
                    <span
                      className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                        goal.priority === 'high'
                          ? 'bg-rose-50 text-rose-700 border border-rose-200'
                          : 'bg-slate-100 text-slate-700'
                      }`}
                    >
                      {goal.priority.toUpperCase()} PRIORITY
                    </span>
                  </div>

                  <h3 className="text-xs font-bold text-slate-900 leading-tight">{goal.name}</h3>

                  <div className="mt-3 flex items-baseline justify-between">
                    <span className="text-lg font-extrabold text-slate-900">
                      {formatINR(goal.currentAmount, false)}
                    </span>
                    <span className="text-xs text-slate-500 font-medium">
                      of {formatINR(goal.targetAmount, false)}
                    </span>
                  </div>

                  {/* Progress bar */}
                  <div className="w-full h-2 bg-slate-200 rounded-full overflow-hidden my-2">
                    <div
                      className="h-full bg-emerald-600 rounded-full transition-all duration-500"
                      style={{ width: `${percentDone}%` }}
                    />
                  </div>

                  <div className="flex justify-between text-[11px] text-slate-500">
                    <span>{percentDone}% saved</span>
                    <span>Target: {goal.targetDate}</span>
                  </div>
                </div>

                {/* Impact / Pace note */}
                <div className="mt-3 pt-3 border-t border-slate-200/80 text-[11px]">
                  <div className="flex justify-between items-center text-slate-700">
                    <span>Monthly Plan:</span>
                    <strong className="text-slate-900">{formatINR(goal.monthlyContribution)}/mo</strong>
                  </div>
                  {extraMonthlyPool > 0 && monthsSaved > 0 ? (
                    <div className="mt-1.5 p-1.5 bg-emerald-50 border border-emerald-200 rounded text-emerald-800 font-medium text-[10px] flex items-center gap-1">
                      <Sparkles className="w-3 h-3 text-emerald-600 shrink-0" />
                      <span>Levers hit this goal <strong>{monthsSaved} month{monthsSaved === 1 ? '' : 's'} earlier!</strong></span>
                    </div>
                  ) : (
                    <div className="mt-1 text-slate-500 text-[10px]">
                      ~{baselineMonthsNeeded} months remaining to target.
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Interactive Spending Lever / What-If Simulator */}
      <div className="bg-indigo-50/50 rounded-xl p-4 border border-indigo-100 mt-4">
        <div className="flex items-center gap-2 mb-2">
          <Sliders className="w-4 h-4 text-indigo-700" />
          <h3 className="text-xs font-bold text-indigo-950 uppercase tracking-wider">
            Goal Acceleration Levers (Interactive What-If)
          </h3>
        </div>
        <p className="text-xs text-indigo-800/80 mb-3">
          Simulate how redirecting discretionary spending accelerates your financial targets in Rupees:
        </p>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="bg-white p-3 rounded-lg border border-indigo-100">
            <div className="flex justify-between text-xs mb-1">
              <span className="font-semibold text-slate-800">Trim Dining & Food Delivery</span>
              <span className="font-bold text-indigo-700">+{formatINR(diningCutSavings)}/mo</span>
            </div>
            <input
              type="range"
              min="0"
              max="5000"
              step="250"
              value={diningCutSavings}
              onChange={(e) => setDiningCutSavings(Number(e.target.value))}
              className="w-full accent-indigo-600 h-1.5 bg-slate-200 rounded-lg cursor-pointer"
            />
            <span className="text-[10px] text-slate-500 block mt-1">
              Cook at home or pack lunch 2 extra days per week
            </span>
          </div>

          <div className="bg-white p-3 rounded-lg border border-indigo-100">
            <div className="flex justify-between text-xs mb-1">
              <span className="font-semibold text-slate-800">Optimize Subscriptions & Digital Plans</span>
              <span className="font-bold text-indigo-700">+{formatINR(subscriptionTrimSavings)}/mo</span>
            </div>
            <input
              type="range"
              min="0"
              max="3000"
              step="100"
              value={subscriptionTrimSavings}
              onChange={(e) => setSubscriptionTrimSavings(Number(e.target.value))}
              className="w-full accent-indigo-600 h-1.5 bg-slate-200 rounded-lg cursor-pointer"
            />
            <span className="text-[10px] text-slate-500 block mt-1">
              Pause inactive OTT or software subscriptions
            </span>
          </div>
        </div>

        <div className="mt-3 flex items-center justify-between text-xs pt-2 border-t border-indigo-100/80">
          <span className="text-indigo-900 font-medium">
            Total Monthly Capital Unlocked:{' '}
            <strong className="text-indigo-950 font-bold">+{formatINR(extraMonthlyPool)}/mo</strong>
          </span>
          <span className="text-[11px] font-bold text-emerald-700 bg-emerald-100/80 px-2 py-0.5 rounded-md">
            +{formatINR(extraMonthlyPool * 12, false)} redirected to savings per year
          </span>
        </div>
      </div>

      {/* Add Goal Modal */}
      {showAddModal && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl max-w-md w-full p-5 shadow-xl border border-slate-200">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-sm font-bold text-slate-900">Define New Financial Goal</h3>
              <button
                onClick={() => setShowAddModal(false)}
                className="text-slate-400 hover:text-slate-600 text-xs font-bold"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleCreateGoal} className="space-y-3 text-xs">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Goal Name</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Emergency Fund, Vacation, Royal Enfield, SIP Target"
                  value={newGoalName}
                  onChange={(e) => setNewGoalName(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-hidden focus:border-indigo-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Target Amount (₹)</label>
                  <input
                    type="number"
                    required
                    min="1000"
                    step="1000"
                    value={newGoalTarget}
                    onChange={(e) => setNewGoalTarget(Number(e.target.value))}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-hidden focus:border-indigo-500"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Current Saved (₹)</label>
                  <input
                    type="number"
                    min="0"
                    step="500"
                    value={newGoalCurrent}
                    onChange={(e) => setNewGoalCurrent(Number(e.target.value))}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-hidden focus:border-indigo-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Monthly Plan (₹/mo)</label>
                  <input
                    type="number"
                    min="500"
                    step="500"
                    value={newGoalMonthly}
                    onChange={(e) => setNewGoalMonthly(Number(e.target.value))}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-hidden focus:border-indigo-500"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Target Date</label>
                  <input
                    type="date"
                    required
                    value={newGoalDate}
                    onChange={(e) => setNewGoalDate(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-hidden focus:border-indigo-500"
                  />
                </div>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Goal Category</label>
                <select
                  value={newGoalCategory}
                  onChange={(e) => setNewGoalCategory(e.target.value as any)}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-hidden focus:border-indigo-500"
                >
                  <option value="emergency">Emergency Reserve</option>
                  <option value="travel">Travel & Vacation</option>
                  <option value="purchase">Purchase or Tech Gear</option>
                  <option value="savings">General Wealth & SIP/Mutual Funds</option>
                  <option value="debt">Debt Payoff / Loan</option>
                </select>
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="px-3 py-2 rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50 font-medium"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-lg bg-indigo-600 text-white font-semibold hover:bg-indigo-700 transition-colors"
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
