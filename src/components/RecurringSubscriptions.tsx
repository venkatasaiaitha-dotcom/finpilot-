import React, { useState } from 'react';
import { RecurringObligation, Category } from '../types';
import { Repeat, Calendar, AlertCircle, TrendingUp, CheckCircle, Clock, Plus, ShieldAlert, Sparkles } from 'lucide-react';
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
  const [nextDueDate, setNextDueDate] = useState('2026-10-01');
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
  const today = new Date('2026-09-20');
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
    <div id="recurring-subscriptions-card" className="bg-white rounded-xl border border-slate-200 shadow-xs p-5">
      {/* Header & Metrics */}
      <div className="flex flex-col md:flex-row md:items-center justify-between pb-4 border-b border-slate-100 gap-3">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-base font-bold text-slate-900">Recurring Payments & Subscriptions</h2>
            <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full bg-pink-50 text-pink-700 border border-pink-200">
              {subscriptions.length} Subscriptions Active
            </span>
          </div>
          <p className="text-xs text-slate-500 mt-0.5">
            Automated tracking of recurring subscriptions, utilities, and anticipated billing dates
          </p>
        </div>

        <div className="flex items-center gap-4">
          <div className="text-right">
            <span className="text-[11px] text-slate-500 block">Subscription Burden</span>
            <span className="text-sm font-bold text-slate-900">
              {formatINR(totalMonthlySubs)}/mo
            </span>
            <span className="text-[10px] text-slate-400 block">{formatINR(totalMonthlySubs * 12, false)}/year</span>
          </div>
          <div className="text-right border-l border-slate-200 pl-4">
            <span className="text-[11px] text-slate-500 block">Total Fixed Outflows</span>
            <span className="text-sm font-bold text-indigo-700">
              {formatINR(totalMonthlyAll)}/mo
            </span>
            <span className="text-[10px] text-slate-400 block">Rent + Bills + Subs</span>
          </div>
          <button
            onClick={() => setShowAddModal(true)}
            className="p-1.5 rounded-lg border border-slate-200 text-slate-700 hover:bg-slate-50"
            title="Add Recurring Bill or Subscription"
          >
            <Plus className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Filter Tabs */}
      <div className="flex items-center justify-between mt-4 mb-3 flex-wrap gap-2">
        <div className="flex items-center gap-1.5 bg-slate-100 p-1 rounded-lg text-xs">
          <button
            onClick={() => setFilter('all')}
            className={`px-3 py-1 rounded-md font-medium transition-colors ${
              filter === 'all' ? 'bg-white text-slate-900 shadow-2xs' : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            All Recurring ({obligations.length})
          </button>
          <button
            onClick={() => setFilter('subscriptions')}
            className={`px-3 py-1 rounded-md font-medium transition-colors ${
              filter === 'subscriptions' ? 'bg-white text-slate-900 shadow-2xs' : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Subscriptions ({subscriptions.length})
          </button>
          <button
            onClick={() => setFilter('bills')}
            className={`px-3 py-1 rounded-md font-medium transition-colors ${
              filter === 'bills' ? 'bg-white text-slate-900 shadow-2xs' : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Rent & Utilities ({obligations.length - subscriptions.length})
          </button>
          <button
            onClick={() => setFilter('upcoming')}
            className={`px-3 py-1 rounded-md font-medium transition-colors ${
              filter === 'upcoming' ? 'bg-white text-amber-900 shadow-2xs' : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Due in Next 14 Days
          </button>
        </div>
      </div>

      {/* List of Obligations or Empty State */}
      {filteredList.length === 0 ? (
        <div className="py-8 text-center border border-dashed border-slate-200 rounded-xl">
          <p className="text-xs text-slate-500">No recurring bills or subscriptions found.</p>
          <button
            onClick={() => setShowAddModal(true)}
            className="mt-2 text-xs font-semibold text-indigo-600 hover:text-indigo-800"
          >
            + Add your first recurring bill or subscription
          </button>
        </div>
      ) : (
        <div className="divide-y divide-slate-100 max-h-[380px] overflow-y-auto">
          {filteredList.map((item, idx) => {
            const dueDate = new Date(item.nextDueDate);
            const diffDays = Math.ceil((dueDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
            const isUrgent = diffDays >= 0 && diffDays <= 7;
            const isOverdue = diffDays < 0;

            return (
              <div key={item.id ? `${item.id}-${idx}` : `rec-${idx}`} className="py-3 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
                <div className="flex items-start gap-3">
                  <div
                    className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 text-xs font-semibold ${
                      item.isSubscription ? 'bg-pink-50 text-pink-600' : 'bg-blue-50 text-blue-600'
                    }`}
                  >
                    <Repeat className="w-4 h-4" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-bold text-slate-900">{item.name}</span>
                      <span className="text-[10px] px-1.5 py-0.5 rounded bg-slate-100 text-slate-600 font-medium">
                        {item.frequency}
                      </span>
                      {item.priceChangeAlert && (
                        <span className="text-[10px] px-1.5 py-0.5 rounded bg-rose-50 text-rose-700 border border-rose-200 font-semibold flex items-center gap-1">
                          <TrendingUp className="w-3 h-3" />
                          Price +{formatINR(item.priceChangeAlert.difference)}
                        </span>
                      )}
                    </div>
                    <div className="text-[11px] text-slate-500 flex items-center gap-2 mt-0.5">
                      <span>{item.category}</span>
                      <span>•</span>
                      <span>{item.paymentMethod}</span>
                    </div>
                    {item.notes && (
                      <p className="text-[11px] text-amber-700 bg-amber-50/60 rounded px-1.5 py-0.5 mt-1 inline-block">
                        {item.notes}
                      </p>
                    )}
                  </div>
                </div>

                {/* Amount & Due Date Badge */}
                <div className="flex items-center justify-between sm:justify-end gap-3 shrink-0">
                  <div className="text-left sm:text-right">
                    <div className="text-xs font-bold text-slate-900">{formatINR(item.amount)}</div>
                    <div
                      className={`text-[11px] flex items-center gap-1 font-medium ${
                        isOverdue
                          ? 'text-rose-600'
                          : isUrgent
                          ? 'text-amber-600'
                          : 'text-slate-500'
                      }`}
                    >
                      <Clock className="w-3 h-3" />
                      <span>
                        {isOverdue
                          ? `Overdue (${item.nextDueDate})`
                          : isUrgent
                          ? `Due in ${diffDays} day${diffDays === 1 ? '' : 's'} (${item.nextDueDate})`
                          : `Next: ${item.nextDueDate}`}
                      </span>
                    </div>
                  </div>

                  <button
                    onClick={() => onToggleStatus(item.id)}
                    className={`text-[11px] px-2.5 py-1 rounded-md font-medium border transition-colors ${
                      item.status === 'active'
                        ? 'bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-100'
                        : item.status === 'review_suggested'
                        ? 'bg-amber-50 text-amber-700 border-amber-200 hover:bg-amber-100'
                        : 'bg-slate-100 text-slate-500 border-slate-200 hover:bg-slate-200'
                    }`}
                  >
                    {item.status === 'active' ? 'Active' : item.status === 'review_suggested' ? 'Review' : 'Paused'}
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Add Obligation Modal */}
      {showAddModal && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl max-w-sm w-full p-5 shadow-xl border border-slate-200 text-xs">
            <div className="flex justify-between items-center mb-3">
              <h3 className="font-bold text-slate-900">Add Recurring Payment / Subscription</h3>
              <button onClick={() => setShowAddModal(false)} className="text-slate-400 hover:text-slate-600">✕</button>
            </div>
            <form onSubmit={handleCreateObligation} className="space-y-3">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Service / Payee Name</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Jio Fiber, Netflix, Electricity, Rent"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full px-2.5 py-1.5 border border-slate-200 rounded-lg"
                />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Amount (₹)</label>
                  <input
                    type="number"
                    required
                    min="1"
                    value={amount}
                    onChange={(e) => setAmount(Number(e.target.value))}
                    className="w-full px-2.5 py-1.5 border border-slate-200 rounded-lg"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Frequency</label>
                  <select
                    value={frequency}
                    onChange={(e) => setFrequency(e.target.value as any)}
                    className="w-full px-2.5 py-1.5 border border-slate-200 rounded-lg"
                  >
                    <option value="monthly">Monthly</option>
                    <option value="quarterly">Quarterly</option>
                    <option value="yearly">Yearly</option>
                  </select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Category</label>
                  <select
                    value={category}
                    onChange={(e) => setCategory(e.target.value as any)}
                    className="w-full px-2.5 py-1.5 border border-slate-200 rounded-lg"
                  >
                    {CATEGORIES.map((c) => (
                      <option key={c} value={c}>{c}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Next Due Date</label>
                  <input
                    type="date"
                    required
                    value={nextDueDate}
                    onChange={(e) => setNextDueDate(e.target.value)}
                    className="w-full px-2.5 py-1.5 border border-slate-200 rounded-lg"
                  />
                </div>
              </div>
              <div className="flex items-center gap-2 pt-1">
                <input
                  type="checkbox"
                  id="sub-type"
                  checked={isSubscription}
                  onChange={(e) => setIsSubscription(e.target.checked)}
                  className="rounded text-pink-600"
                />
                <label htmlFor="sub-type" className="text-slate-700 font-medium">
                  Count as digital subscription (OTT, software, membership)
                </label>
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="px-3 py-1.5 border border-slate-200 rounded-lg text-slate-600"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-3 py-1.5 bg-slate-900 text-white font-semibold rounded-lg hover:bg-slate-800"
                >
                  Save Recurring Bill
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
