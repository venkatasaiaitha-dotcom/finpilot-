import React, { useState } from 'react';
import { RecurringObligation, Category } from '../types';
import { Repeat, Calendar, Plus, X, AlertCircle } from 'lucide-react';
import { formatINR } from '../utils/currency';

interface RecurringSubscriptionsProps {
  obligations: RecurringObligation[];
  onToggleStatus: (id: string) => void;
  onAddObligation?: (obligation: RecurringObligation) => void;
}

const CATEGORIES: Category[] = [
  'Housing & Rent',
  'Utilities & Bills',
  'Subscriptions & Digital',
  'Groceries',
  'Transportation',
  'Health & Fitness',
  'Financial & Savings',
  'Other Expenses',
];

export const RecurringSubscriptions: React.FC<RecurringSubscriptionsProps> = ({
  obligations,
  onToggleStatus,
  onAddObligation,
}) => {
  const [filter, setFilter] = useState<'all' | 'subscriptions' | 'bills' | 'upcoming'>('all');
  const [showAddModal, setShowAddModal] = useState(false);

  // Add form fields
  const [name, setName] = useState('');
  const [amount, setAmount] = useState<number>(499);
  const [category, setCategory] = useState<Category>('Subscriptions & Digital');
  const [frequency, setFrequency] = useState<'monthly' | 'yearly' | 'quarterly'>('monthly');
  const [nextDueDate, setNextDueDate] = useState('2026-11-01');
  const [paymentMethod, setPaymentMethod] = useState('UPI / Card');
  const [isSubscription, setIsSubscription] = useState(true);

  // Subscriptions vs Utilities/Rent
  const subscriptions = obligations.filter((o) => o.isSubscription);
  const totalMonthlySubs = subscriptions
    .filter((s) => s.status !== 'canceled')
    .reduce((acc, s) => acc + (s.frequency === 'monthly' ? s.amount : s.amount / 12), 0);

  const totalMonthlyAll = obligations
    .filter((o) => o.status !== 'canceled')
    .reduce((acc, o) => acc + (o.frequency === 'monthly' ? o.amount : o.amount / 12), 0);

  // Filter upcoming in next 14 days
  const today = new Date();
  const filteredList = obligations.filter((item) => {
    if (filter === 'subscriptions') return item.isSubscription;
    if (filter === 'bills') return !item.isSubscription;
    if (filter === 'upcoming') {
      const due = new Date(item.nextDueDate);
      const diffDays = Math.ceil((due.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
      return diffDays >= 0 && diffDays <= 14;
    }
    return true;
  });

  const handleCreateObligation = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || amount <= 0) return;

    if (onAddObligation) {
      onAddObligation({
        id: `rec-${Date.now()}`,
        name: name.trim(),
        category,
        amount: Number(amount),
        frequency,
        nextDueDate,
        paymentMethod,
        isSubscription,
        status: 'active',
      });
    }

    setShowAddModal(false);
    setName('');
  };

  return (
    <div id="recurring-subscriptions-card" className="bg-[#111827] rounded-2xl border border-slate-800 shadow-xl p-5 sm:p-6 space-y-4">
      {/* Header & Metrics */}
      <div className="flex flex-col md:flex-row md:items-center justify-between pb-4 border-b border-slate-800 gap-3">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-base font-bold text-white tracking-tight">Recurring Obligations & Subscriptions</h2>
            <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full bg-pink-500/15 text-pink-400 border border-pink-500/30">
              {subscriptions.length} Subscriptions Active
            </span>
          </div>
          <p className="text-xs text-slate-400 mt-0.5">
            Automated tracking of digital subscriptions, rent, and scheduled billing dates
          </p>
        </div>

        <div className="flex items-center gap-4">
          <div className="text-right">
            <span className="text-[11px] text-slate-400 block">Subscription Total</span>
            <span className="text-sm font-bold text-white">{formatINR(totalMonthlySubs)}/mo</span>
            <span className="text-[10px] text-slate-500 block">{formatINR(totalMonthlySubs * 12, false)}/yr</span>
          </div>
          <div className="text-right border-l border-slate-800 pl-4">
            <span className="text-[11px] text-slate-400 block">Total Fixed Outflow</span>
            <span className="text-sm font-bold text-emerald-400">{formatINR(totalMonthlyAll)}/mo</span>
            <span className="text-[10px] text-slate-500 block">Rent + Bills + Subs</span>
          </div>
          <button
            onClick={() => setShowAddModal(true)}
            className="p-2 rounded-xl bg-slate-900 border border-slate-700 text-slate-300 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer"
            title="Add Recurring Bill or Subscription"
          >
            <Plus className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Filter Tabs */}
      <div className="flex items-center justify-between pt-1 flex-wrap gap-2">
        <div className="flex items-center gap-1.5 bg-slate-900/90 border border-slate-800 p-1 rounded-xl text-xs">
          {(
            [
              { id: 'all', label: `All (${obligations.length})` },
              { id: 'subscriptions', label: `Subscriptions (${subscriptions.length})` },
              { id: 'bills', label: `Bills & Rent (${obligations.length - subscriptions.length})` },
              { id: 'upcoming', label: 'Due in Next 14 Days' },
            ] as const
          ).map((tab) => {
            const isSelected = filter === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setFilter(tab.id)}
                className={`px-3 py-1.5 rounded-lg font-medium text-[11px] transition-all cursor-pointer ${
                  isSelected
                    ? 'bg-emerald-500/15 text-emerald-400 font-bold border border-emerald-500/30 shadow-xs'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                {tab.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* List of Obligations or Empty State */}
      {filteredList.length === 0 ? (
        <div className="py-10 text-center border border-dashed border-slate-800 rounded-2xl">
          <p className="text-xs text-slate-400">No recurring bills or subscriptions found in this view.</p>
          <button
            onClick={() => setShowAddModal(true)}
            className="mt-3 text-xs font-semibold text-emerald-400 hover:text-emerald-300 cursor-pointer"
          >
            + Add recurring bill or subscription
          </button>
        </div>
      ) : (
        <div className="divide-y divide-slate-800/60 max-h-[480px] overflow-y-auto">
          {filteredList.map((item, idx) => {
            const dueDate = new Date(item.nextDueDate);
            const diffDays = Math.ceil((dueDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
            const isUrgent = diffDays >= 0 && diffDays <= 7;

            return (
              <div
                key={item.id ? `${item.id}-${idx}` : `rec-${idx}`}
                className="py-3.5 px-2 hover:bg-slate-800/30 rounded-xl transition-colors flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs"
              >
                <div className="flex items-start gap-3">
                  <div
                    className={`w-8 h-8 rounded-xl flex items-center justify-center shrink-0 font-bold ${
                      item.isSubscription
                        ? 'bg-pink-500/15 text-pink-400 border border-pink-500/30'
                        : 'bg-indigo-500/15 text-indigo-400 border border-indigo-500/30'
                    }`}
                  >
                    <Repeat className="w-4 h-4" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-bold text-white">{item.name}</span>
                      <span className="text-[10px] px-2 py-0.5 rounded-full bg-slate-800 text-slate-300 border border-slate-700 font-medium">
                        {item.frequency}
                      </span>
                      {item.priceChangeAlert && (
                        <span className="text-[10px] px-2 py-0.5 rounded-full bg-rose-500/15 text-rose-300 border border-rose-500/30 font-semibold flex items-center gap-1">
                          <AlertCircle className="w-3 h-3 text-rose-400" />
                          Price jump +{formatINR(item.priceChangeAlert.difference)}
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-2 text-[11px] text-slate-400 mt-0.5">
                      <span className="flex items-center gap-1">
                        <Calendar className="w-3 h-3 text-slate-500" />
                        Due: {item.nextDueDate}
                        {isUrgent && <span className="text-amber-400 font-bold ml-1">({diffDays} days left)</span>}
                      </span>
                      <span>•</span>
                      <span>{item.paymentMethod || 'UPI/Card'}</span>
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-3 self-end sm:self-center">
                  <div className="text-right">
                    <span className="font-bold text-white text-sm">{formatINR(item.amount)}</span>
                    <span className="text-[10px] text-slate-500 block">/{item.frequency}</span>
                  </div>

                  {/* Status Toggle Button */}
                  <button
                    onClick={() => onToggleStatus(item.id)}
                    className={`text-[10px] font-bold px-2.5 py-1 rounded-lg border transition-all cursor-pointer ${
                      item.status === 'active'
                        ? 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30 hover:bg-emerald-500/25'
                        : item.status === 'review_suggested'
                        ? 'bg-amber-500/15 text-amber-300 border-amber-500/30 hover:bg-amber-500/25'
                        : 'bg-rose-500/15 text-rose-400 border-rose-500/30 hover:bg-rose-500/25'
                    }`}
                    title="Click to cycle status: Active -> Review -> Canceled"
                  >
                    {item.status === 'active'
                      ? 'ACTIVE'
                      : item.status === 'review_suggested'
                      ? 'REVIEW'
                      : 'CANCELED'}
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* New Obligation Modal */}
      {showAddModal && (
        <div className="fixed inset-0 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4 z-50 overflow-y-auto">
          <div className="bg-[#111827] rounded-2xl max-w-md w-full p-6 shadow-2xl border border-slate-800 text-slate-200">
            <div className="flex justify-between items-center pb-3 border-b border-slate-800 mb-4">
              <h3 className="text-sm font-bold text-white">Add Recurring Payment / Subscription</h3>
              <button
                onClick={() => setShowAddModal(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreateObligation} className="space-y-3.5 text-xs">
              <div>
                <label className="block font-semibold text-slate-300 mb-1">Service / Bill Name</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Netflix Premium, House Rent, Broadband, Spotify"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full px-3.5 py-2.5 bg-slate-900 border border-slate-800 rounded-xl text-white placeholder:text-slate-500 focus:outline-hidden focus:border-emerald-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-300 mb-1">Amount (₹)</label>
                  <input
                    type="number"
                    step="1"
                    required
                    min="1"
                    value={amount}
                    onChange={(e) => setAmount(Number(e.target.value))}
                    className="w-full px-3.5 py-2.5 bg-slate-900 border border-slate-800 rounded-xl text-white focus:outline-hidden focus:border-emerald-500"
                  />
                </div>

                <div>
                  <label className="block font-semibold text-slate-300 mb-1">Frequency</label>
                  <select
                    value={frequency}
                    onChange={(e) => setFrequency(e.target.value as any)}
                    className="w-full px-3.5 py-2.5 bg-slate-900 border border-slate-800 rounded-xl text-white focus:outline-hidden focus:border-emerald-500"
                  >
                    <option value="monthly">Monthly</option>
                    <option value="quarterly">Quarterly</option>
                    <option value="yearly">Yearly</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-300 mb-1">Category</label>
                  <select
                    value={category}
                    onChange={(e) => setCategory(e.target.value as Category)}
                    className="w-full px-3.5 py-2.5 bg-slate-900 border border-slate-800 rounded-xl text-white focus:outline-hidden focus:border-emerald-500"
                  >
                    {CATEGORIES.map((c) => (
                      <option key={c} value={c}>
                        {c}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block font-semibold text-slate-300 mb-1">Next Billing Date</label>
                  <input
                    type="date"
                    required
                    value={nextDueDate}
                    onChange={(e) => setNextDueDate(e.target.value)}
                    className="w-full px-3.5 py-2.5 bg-slate-900 border border-slate-800 rounded-xl text-white focus:outline-hidden focus:border-emerald-500"
                  />
                </div>
              </div>

              <div className="flex items-center gap-2 pt-1">
                <input
                  type="checkbox"
                  id="is-subscription-toggle"
                  checked={isSubscription}
                  onChange={(e) => setIsSubscription(e.target.checked)}
                  className="rounded text-emerald-500 focus:ring-emerald-500"
                />
                <label htmlFor="is-subscription-toggle" className="text-slate-300 font-medium">
                  Classify as digital entertainment/app subscription
                </label>
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
                  Save Obligation
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
