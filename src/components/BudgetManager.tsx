import React, { useState } from 'react';
import { Budget, Category } from '../types';
import { Target, AlertTriangle, CheckCircle, Plus, Edit2, Check, X } from 'lucide-react';
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
      color: '#6366f1',
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
    <div id="budget-manager-card" className="bg-white rounded-xl border border-slate-200 shadow-xs p-5">
      {/* Header with summary stats */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-4 border-b border-slate-100 gap-3">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-base font-bold text-slate-900">Budget Commitment & Tracking</h2>
            <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full bg-slate-100 text-slate-700">
              {budgets.length} Categories
            </span>
          </div>
          <p className="text-xs text-slate-500 mt-0.5">
            Compare actual spending + scheduled upcoming obligations against monthly limits
          </p>
        </div>

        <div className="flex items-center gap-3">
          <div className="text-right">
            <span className="text-[11px] text-slate-500 block">Overall Committed</span>
            <span className="text-sm font-bold text-slate-900">
              {formatINR(totalCommittedAndSpent, false)} / {formatINR(totalBudgetLimit, false)}
            </span>
          </div>
          <div
            className={`px-2.5 py-1 rounded-lg text-xs font-semibold border ${
              percentCommitted > 100
                ? 'bg-rose-50 border-rose-200 text-rose-700'
                : percentCommitted > 85
                ? 'bg-amber-50 border-amber-200 text-amber-700'
                : 'bg-emerald-50 border-emerald-200 text-emerald-700'
            }`}
          >
            {percentCommitted.toFixed(0)}% Committed
          </div>
          <button
            onClick={() => setShowAddCategory(true)}
            className="p-1.5 rounded-lg border border-slate-200 text-slate-700 hover:bg-slate-50"
            title="Add or Customize Category Budget"
          >
            <Plus className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Global Commitment Progress Bar */}
      {totalBudgetLimit > 0 ? (
        <div className="my-4">
          <div className="flex justify-between text-xs mb-1.5 font-medium">
            <span className="text-slate-600 flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-xs bg-slate-800 inline-block"></span> Spent ({formatINR(totalSpent, false)}) +
              <span className="w-2.5 h-2.5 rounded-xs bg-amber-500 inline-block ml-1"></span> Upcoming Bills (
              {formatINR(totalCommitted, false)})
            </span>
            <span className="text-slate-500">
              Buffer:{' '}
              <strong
                className={totalBudgetLimit - totalCommittedAndSpent >= 0 ? 'text-emerald-600' : 'text-rose-600'}
              >
                {formatINR(totalBudgetLimit - totalCommittedAndSpent, false)}
              </strong>
            </span>
          </div>
          <div className="w-full h-3 bg-slate-100 rounded-full overflow-hidden flex">
            <div
              className="bg-slate-800 h-full transition-all duration-300"
              style={{ width: `${Math.min(100, (totalSpent / totalBudgetLimit) * 100)}%` }}
              title={`Spent: ${formatINR(totalSpent)}`}
            />
            <div
              className="bg-amber-400 h-full transition-all duration-300"
              style={{ width: `${Math.min(100 - (totalSpent / totalBudgetLimit) * 100, (totalCommitted / totalBudgetLimit) * 100)}%` }}
              title={`Upcoming Obligations: ${formatINR(totalCommitted)}`}
            />
          </div>
        </div>
      ) : (
        <div className="my-4 p-3 bg-slate-50 border border-dashed border-slate-200 rounded-xl text-center">
          <p className="text-xs text-slate-500">
            Set your monthly budget limits in Rupees (₹) below to track commitments and cash flow buffer.
          </p>
        </div>
      )}

      {/* Category Budget Items */}
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
              className={`p-3 rounded-xl border transition-all ${
                isOver ? 'bg-rose-50/40 border-rose-200' : isWarning ? 'bg-amber-50/30 border-amber-200' : 'bg-slate-50/40 border-slate-200/80'
              }`}
            >
              <div className="flex items-center justify-between mb-1.5">
                <div className="flex items-center gap-2">
                  <div
                    className="w-3 h-3 rounded-full shrink-0"
                    style={{ backgroundColor: b.color || '#3b82f6' }}
                  />
                  <span className="text-xs font-bold text-slate-900">{b.category}</span>
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
                        className="w-24 px-1.5 py-0.5 text-xs bg-white border border-slate-300 rounded-md font-semibold"
                        autoFocus
                      />
                      <button
                        onClick={saveEdit}
                        className="p-1 rounded bg-emerald-600 text-white hover:bg-emerald-700"
                        title="Save limit"
                      >
                        <Check className="w-3 h-3" />
                      </button>
                      <button
                        onClick={() => setEditingCategory(null)}
                        className="p-1 rounded bg-slate-200 text-slate-700 hover:bg-slate-300"
                        title="Cancel"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    </div>
                  ) : (
                    <div className="flex items-center gap-1">
                      <span className="text-slate-500 font-medium">
                        Limit: <strong className="text-slate-800">{formatINR(b.monthlyLimit, false)}</strong>
                      </span>
                      <button
                        onClick={() => startEdit(b)}
                        className="text-slate-400 hover:text-slate-700 p-0.5 rounded hover:bg-slate-200/50"
                        title="Edit monthly budget limit"
                      >
                        <Edit2 className="w-3 h-3" />
                      </button>
                    </div>
                  )}
                </div>
              </div>

              {/* Progress meter */}
              <div className="w-full h-2 bg-slate-200 rounded-full overflow-hidden flex my-2">
                <div
                  className={`h-full ${isOver ? 'bg-rose-500' : 'bg-slate-800'}`}
                  style={{ width: `${b.monthlyLimit > 0 ? Math.min(100, (b.spent / b.monthlyLimit) * 100) : 0}%` }}
                />
                {b.committedUpcoming > 0 && b.monthlyLimit > 0 && (
                  <div
                    className="h-full bg-amber-400"
                    style={{
                      width: `${Math.min(
                        Math.max(0, 100 - (b.spent / b.monthlyLimit) * 100),
                        (b.committedUpcoming / b.monthlyLimit) * 100
                      )}%`,
                    }}
                  />
                )}
              </div>

              {/* Sub details */}
              <div className="flex items-center justify-between text-[11px] text-slate-600 pt-0.5">
                <span>
                  Spent: <strong>{formatINR(b.spent)}</strong>
                  {b.committedUpcoming > 0 && (
                    <span className="text-amber-700 font-medium ml-1">
                      (+{formatINR(b.committedUpcoming)} upcoming)
                    </span>
                  )}
                </span>
                <span className={isOver ? 'text-rose-600 font-bold' : isWarning ? 'text-amber-700 font-semibold' : 'text-slate-500 font-medium'}>
                  {b.monthlyLimit <= 0
                    ? 'No limit set'
                    : isOver
                    ? `Over by ${formatINR(totalCategoryLoad - b.monthlyLimit)}`
                    : `${formatINR(b.monthlyLimit - totalCategoryLoad)} remaining`}
                </span>
              </div>
            </div>
          );
        })}
      </div>

      {/* Add Custom Category Budget Modal */}
      {showAddCategory && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl max-w-sm w-full p-5 shadow-xl border border-slate-200 text-xs">
            <div className="flex justify-between items-center mb-3">
              <h3 className="font-bold text-slate-900">Set Category Budget Limit</h3>
              <button onClick={() => setShowAddCategory(false)} className="text-slate-400 hover:text-slate-600">✕</button>
            </div>
            <form onSubmit={handleCreateCategory} className="space-y-3">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Category</label>
                <select
                  value={newCategoryName}
                  onChange={(e) => setNewCategoryName(e.target.value as Category)}
                  className="w-full px-2.5 py-1.5 border border-slate-200 rounded-lg"
                >
                  {AVAILABLE_CATEGORIES.map((c) => (
                    <option key={c} value={c}>{c}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Monthly Limit (₹)</label>
                <input
                  type="number"
                  required
                  min="500"
                  step="500"
                  value={newCategoryLimit}
                  onChange={(e) => setNewCategoryLimit(Number(e.target.value))}
                  className="w-full px-2.5 py-1.5 border border-slate-200 rounded-lg"
                />
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowAddCategory(false)}
                  className="px-3 py-1.5 border border-slate-200 rounded-lg text-slate-600"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-3 py-1.5 bg-slate-900 text-white font-semibold rounded-lg hover:bg-slate-800"
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
