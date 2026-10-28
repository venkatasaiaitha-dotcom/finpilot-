import React, { useState } from 'react';
import { Budget, Category } from '../types';
import { Plus, Edit2, Check, X, Layers } from 'lucide-react';
import { formatINR } from '../utils/currency';

interface BudgetManagerProps {
  budgets: Budget[];
  onUpdateBudget: (category: Category, newLimit: number) => void;
  onAddBudget?: (budget: Budget) => void;
  onAddCategory?: (budget: Budget) => void;
}

const AVAILABLE_CATEGORIES: Category[] = [
  'Housing & Rent',
  'Utilities & Bills',
  'Groceries',
  'Dining & Takeout',
  'Transportation',
  'Subscriptions & Digital',
  'Shopping & Goods',
  'Health & Fitness',
  'Entertainment',
  'Travel',
  'Education & Learning',
  'Financial & Savings',
  'Other Expenses',
];

export const BudgetManager: React.FC<BudgetManagerProps> = ({
  budgets,
  onUpdateBudget,
  onAddBudget,
  onAddCategory,
}) => {
  const [editingCategory, setEditingCategory] = useState<Category | null>(null);
  const [editLimitValue, setEditLimitValue] = useState<number>(0);

  // New Category Budget Modal
  const [showAddCategory, setShowAddCategory] = useState(false);
  const [newCategoryName, setNewCategoryName] = useState<Category>('Groceries');
  const [newCategoryLimit, setNewCategoryLimit] = useState<number>(10000);

  const totalBudgetLimit = budgets.reduce((acc, b) => acc + b.monthlyLimit, 0);
  const totalSpent = budgets.reduce((acc, b) => acc + b.spent, 0);
  const totalCommitted = budgets.reduce((acc, b) => acc + b.committedUpcoming, 0);
  const totalCommittedAndSpent = totalSpent + totalCommitted;
  const percentCommitted = totalBudgetLimit > 0 ? (totalCommittedAndSpent / totalBudgetLimit) * 100 : 0;

  const startEdit = (b: Budget) => {
    setEditingCategory(b.category);
    setEditLimitValue(b.monthlyLimit);
  };

  const saveEdit = () => {
    if (editingCategory && editLimitValue >= 0) {
      onUpdateBudget(editingCategory, editLimitValue);
      setEditingCategory(null);
    }
  };

  const handleCreateCategory = (e: React.FormEvent) => {
    e.preventDefault();
    const newBudgetObj: Budget = {
      category: newCategoryName,
      monthlyLimit: Number(newCategoryLimit),
      spent: 0,
      committedUpcoming: 0,
      color: '#10b981',
    };
    if (onAddCategory) {
      onAddCategory(newBudgetObj);
    } else if (onAddBudget) {
      onAddBudget(newBudgetObj);
    } else {
      onUpdateBudget(newCategoryName, Number(newCategoryLimit));
    }
    setShowAddCategory(false);
  };

  return (
    <div id="budget-manager-card" className="bg-[#111827] rounded-2xl border border-slate-800 shadow-xl p-5 sm:p-6 space-y-4">
      {/* Header with summary stats */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-4 border-b border-slate-800 gap-3">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-base font-bold text-white tracking-tight">Budget Commitment & Tracking</h2>
            <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full bg-slate-800 text-slate-300 border border-slate-700">
              {budgets.length} Categories
            </span>
          </div>
          <p className="text-xs text-slate-400 mt-0.5">
            Compare actual spending + scheduled upcoming obligations against monthly limits
          </p>
        </div>

        <div className="flex items-center gap-3">
          <div className="text-right">
            <span className="text-[11px] text-slate-400 block">Overall Committed</span>
            <span className="text-sm font-bold text-white">
              {formatINR(totalCommittedAndSpent, false)} / {formatINR(totalBudgetLimit, false)}
            </span>
          </div>
          <div
            className={`px-3 py-1 rounded-xl text-xs font-bold border ${
              percentCommitted > 100
                ? 'bg-rose-500/15 border-rose-500/30 text-rose-300'
                : percentCommitted > 85
                ? 'bg-amber-500/15 border-amber-500/30 text-amber-300'
                : 'bg-emerald-500/15 border-emerald-500/30 text-emerald-400'
            }`}
          >
            {percentCommitted.toFixed(0)}% Committed
          </div>
          <button
            onClick={() => setShowAddCategory(true)}
            className="p-2 rounded-xl bg-slate-900 border border-slate-700 text-slate-300 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer"
            title="Add or Customize Category Budget"
          >
            <Plus className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Global Commitment Progress Bar */}
      {totalBudgetLimit > 0 ? (
        <div className="my-4 p-4 rounded-xl bg-slate-900/60 border border-slate-800/80">
          <div className="flex justify-between text-xs mb-2 font-medium">
            <span className="text-slate-300 flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-xs bg-emerald-500 inline-block" /> Spent ({formatINR(totalSpent, false)}) +
              <span className="w-2.5 h-2.5 rounded-xs bg-amber-400 inline-block ml-1" /> Upcoming Obligations ({formatINR(totalCommitted, false)})
            </span>
            <span className="text-slate-400">
              Remaining Buffer:{' '}
              <strong className={totalBudgetLimit - totalCommittedAndSpent >= 0 ? 'text-emerald-400' : 'text-rose-400'}>
                {formatINR(totalBudgetLimit - totalCommittedAndSpent, false)}
              </strong>
            </span>
          </div>
          <div className="w-full h-3 bg-slate-800 rounded-full overflow-hidden flex">
            <div
              className="bg-emerald-500 h-full transition-all duration-300"
              style={{ width: `${Math.min(100, (totalSpent / totalBudgetLimit) * 100)}%` }}
              title={`Spent: ${formatINR(totalSpent)}`}
            />
            <div
              className="bg-amber-400 h-full transition-all duration-300"
              style={{
                width: `${Math.min(
                  100 - (totalSpent / totalBudgetLimit) * 100,
                  (totalCommitted / totalBudgetLimit) * 100
                )}%`,
              }}
              title={`Upcoming Obligations: ${formatINR(totalCommitted)}`}
            />
          </div>
        </div>
      ) : (
        <div className="my-4 p-4 bg-slate-900/60 border border-dashed border-slate-800 rounded-xl text-center">
          <p className="text-xs text-slate-400">
            Set your monthly budget limits in Rupees (₹) below to track commitments and cash flow buffer.
          </p>
        </div>
      )}

      {/* Category Budget Items Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5 mt-4">
        {budgets.map((b) => {
          const totalCategoryLoad = b.spent + b.committedUpcoming;
          const pct = b.monthlyLimit > 0 ? (totalCategoryLoad / b.monthlyLimit) * 100 : 0;
          const isOver = totalCategoryLoad > b.monthlyLimit && b.monthlyLimit > 0;
          const isWarning = !isOver && pct >= 80 && b.monthlyLimit > 0;
          const isEditing = editingCategory === b.category;

          return (
            <div
              key={b.category}
              className={`p-4 rounded-xl border transition-all ${
                isOver
                  ? 'bg-rose-500/5 border-rose-500/30'
                  : isWarning
                  ? 'bg-amber-500/5 border-amber-500/30'
                  : 'bg-slate-900/50 border-slate-800'
              }`}
            >
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <div
                    className="w-3 h-3 rounded-full shrink-0"
                    style={{ backgroundColor: b.color || '#10b981' }}
                  />
                  <span className="text-xs font-bold text-white">{b.category}</span>
                </div>

                {/* Limit & Edit */}
                <div className="flex items-center gap-1.5 text-xs">
                  {isEditing ? (
                    <div className="flex items-center gap-1">
                      <span className="text-slate-400">₹</span>
                      <input
                        type="number"
                        value={editLimitValue}
                        onChange={(e) => setEditLimitValue(Number(e.target.value))}
                        className="w-24 px-2 py-1 text-xs bg-slate-800 border border-slate-700 text-white rounded-lg font-semibold focus:outline-hidden focus:border-emerald-500"
                        autoFocus
                      />
                      <button
                        onClick={saveEdit}
                        className="p-1 rounded-lg bg-emerald-500 text-slate-950 font-bold hover:bg-emerald-400"
                        title="Save limit"
                      >
                        <Check className="w-3.5 h-3.5 stroke-[2.5]" />
                      </button>
                      <button
                        onClick={() => setEditingCategory(null)}
                        className="p-1 rounded-lg bg-slate-800 text-slate-400 hover:text-white"
                        title="Cancel"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ) : (
                    <div className="flex items-center gap-2">
                      <span className="text-slate-400">
                        Limit: <strong className="text-white">{formatINR(b.monthlyLimit, false)}</strong>
                      </span>
                      <button
                        onClick={() => startEdit(b)}
                        className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
                        title="Edit monthly limit"
                      >
                        <Edit2 className="w-3 h-3" />
                      </button>
                    </div>
                  )}
                </div>
              </div>

              {/* Progress Bar for Category */}
              <div className="w-full h-2 bg-slate-800 rounded-full overflow-hidden flex my-2">
                <div
                  className={`h-full transition-all duration-300 ${isOver ? 'bg-rose-500' : 'bg-emerald-500'}`}
                  style={{ width: `${Math.min(100, b.monthlyLimit > 0 ? (b.spent / b.monthlyLimit) * 100 : 0)}%` }}
                />
                <div
                  className="bg-amber-400 h-full transition-all duration-300"
                  style={{
                    width: `${Math.min(
                      100 - (b.monthlyLimit > 0 ? (b.spent / b.monthlyLimit) * 100 : 0),
                      b.monthlyLimit > 0 ? (b.committedUpcoming / b.monthlyLimit) * 100 : 0
                    )}%`,
                  }}
                />
              </div>

              <div className="flex items-center justify-between text-[11px] text-slate-400 pt-1">
                <span>
                  Spent: <strong className="text-slate-200">{formatINR(b.spent, false)}</strong>
                  {b.committedUpcoming > 0 && (
                    <span className="ml-1 text-amber-300">+ {formatINR(b.committedUpcoming, false)} bills</span>
                  )}
                </span>
                <span className={isOver ? 'text-rose-400 font-bold' : isWarning ? 'text-amber-400 font-bold' : 'text-slate-400'}>
                  {pct.toFixed(0)}%
                </span>
              </div>
            </div>
          );
        })}
      </div>

      {/* Add Category Modal */}
      {showAddCategory && (
        <div className="fixed inset-0 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4 z-50 overflow-y-auto">
          <div className="bg-[#111827] rounded-2xl max-w-sm w-full p-6 shadow-2xl border border-slate-800 text-slate-200">
            <div className="flex justify-between items-center pb-3 border-b border-slate-800 mb-4">
              <h3 className="text-sm font-bold text-white">Add Category Budget</h3>
              <button
                onClick={() => setShowAddCategory(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreateCategory} className="space-y-4 text-xs">
              <div>
                <label className="block font-semibold text-slate-300 mb-1">Category</label>
                <select
                  value={newCategoryName}
                  onChange={(e) => setNewCategoryName(e.target.value as Category)}
                  className="w-full px-3.5 py-2.5 bg-slate-900 border border-slate-800 rounded-xl text-white focus:outline-hidden focus:border-emerald-500"
                >
                  {AVAILABLE_CATEGORIES.map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block font-semibold text-slate-300 mb-1">Monthly Limit (₹)</label>
                <input
                  type="number"
                  step="500"
                  min="0"
                  required
                  value={newCategoryLimit}
                  onChange={(e) => setNewCategoryLimit(Number(e.target.value))}
                  className="w-full px-3.5 py-2.5 bg-slate-900 border border-slate-800 rounded-xl text-white focus:outline-hidden focus:border-emerald-500"
                />
              </div>

              <div className="flex justify-end gap-2.5 pt-3 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setShowAddCategory(false)}
                  className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-medium"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold"
                >
                  Save Budget
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
