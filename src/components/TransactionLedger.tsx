import React, { useState } from 'react';
import { Transaction, Category } from '../types';
import { Search, Filter, AlertTriangle, Repeat, Tag, ArrowUpRight, ArrowDownRight, Plus, Check } from 'lucide-react';
import { formatINR } from '../utils/currency';

interface TransactionLedgerProps {
  transactions: Transaction[];
  onUpdateCategory: (id: string, category: Category) => void;
  onAddTransaction: (transaction: Transaction) => void;
  onOpenUploadModal?: () => void;
}

const CATEGORIES: Category[] = [
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
  'Income',
  'Education & Learning',
  'Financial & Savings',
  'Other Expenses',
];

export const TransactionLedger: React.FC<TransactionLedgerProps> = ({
  transactions,
  onUpdateCategory,
  onAddTransaction,
  onOpenUploadModal,
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [filterType, setFilterType] = useState<'all' | 'expense' | 'income' | 'recurring' | 'anomalies'>('all');

  // Manual Add Modal State
  const [showAddModal, setShowAddModal] = useState(false);
  const [merchant, setMerchant] = useState('');
  const [amount, setAmount] = useState<number>(0);
  const [category, setCategory] = useState<Category>('Groceries');
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [type, setType] = useState<'expense' | 'income'>('expense');
  const [paymentMethod, setPaymentMethod] = useState('UPI / GPay');
  const [description, setDescription] = useState('');
  const [isRecurring, setIsRecurring] = useState(false);

  const filtered = transactions.filter((t) => {
    const matchesSearch =
      t.merchant.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (t.description && t.description.toLowerCase().includes(searchTerm.toLowerCase()));

    const matchesCategory = selectedCategory === 'all' || t.category === selectedCategory;

    if (!matchesSearch || !matchesCategory) return false;

    if (filterType === 'expense') return t.type === 'expense';
    if (filterType === 'income') return t.type === 'income';
    if (filterType === 'recurring') return Boolean(t.isRecurring);
    if (filterType === 'anomalies') return Boolean(t.isAnomaly);

    return true;
  });

  const handleManualAdd = (e: React.FormEvent) => {
    e.preventDefault();
    if (!merchant.trim() || amount <= 0) return;

    const newTx: Transaction = {
      id: `tx-${Date.now()}`,
      merchant: merchant.trim(),
      description: description.trim() || undefined,
      amount: Number(amount),
      category,
      date,
      type,
      paymentMethod,
      isRecurring,
      recurringFrequency: isRecurring ? 'monthly' : undefined,
    };

    onAddTransaction(newTx);
    setShowAddModal(false);
    setMerchant('');
    setDescription('');
    setAmount(0);
  };

  return (
    <div id="transactions-ledger-card" className="bg-white rounded-xl border border-slate-200 shadow-xs p-5">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between pb-4 border-b border-slate-100 gap-3">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-base font-bold text-slate-900">Transaction & Expense Ledger</h2>
            <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full bg-slate-100 text-slate-700">
              {filtered.length} of {transactions.length} Records
            </span>
          </div>
          <p className="text-xs text-slate-500 mt-0.5">
            Auto-categorized records with recurring detection and anomaly tags
          </p>
        </div>

        <div className="flex items-center gap-2 self-start md:self-auto">
          {onOpenUploadModal && (
            <button
              onClick={onOpenUploadModal}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold border border-slate-200 text-slate-700 hover:bg-slate-50 transition-colors shadow-2xs"
            >
              <span>Upload Statement</span>
            </button>
          )}
          <button
            onClick={() => setShowAddModal(true)}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-slate-900 text-white hover:bg-slate-800 transition-colors shadow-2xs"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>+ Add Transaction</span>
          </button>
        </div>
      </div>

      {/* Filters & Search Toolbar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 my-3.5">
        <div className="relative flex-1 max-w-sm">
          <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-2.5" />
          <input
            type="text"
            placeholder="Search merchant or description..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-8 pr-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs focus:outline-hidden focus:border-slate-400 focus:bg-white transition-all"
          />
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          {/* Category Dropdown */}
          <select
            value={selectedCategory}
            onChange={(e) => setSelectedCategory(e.target.value)}
            className="px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-700 font-medium focus:outline-hidden"
          >
            <option value="all">All Categories</option>
            {CATEGORIES.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>

          {/* Type Filter Chips */}
          <div className="flex items-center bg-slate-100 p-0.5 rounded-lg text-xs">
            <button
              onClick={() => setFilterType('all')}
              className={`px-2.5 py-1 rounded-md font-medium text-[11px] transition-colors ${
                filterType === 'all' ? 'bg-white text-slate-900 shadow-2xs' : 'text-slate-600'
              }`}
            >
              All
            </button>
            <button
              onClick={() => setFilterType('expense')}
              className={`px-2.5 py-1 rounded-md font-medium text-[11px] transition-colors ${
                filterType === 'expense' ? 'bg-white text-slate-900 shadow-2xs' : 'text-slate-600'
              }`}
            >
              Expenses
            </button>
            <button
              onClick={() => setFilterType('income')}
              className={`px-2.5 py-1 rounded-md font-medium text-[11px] transition-colors ${
                filterType === 'income' ? 'bg-white text-slate-900 shadow-2xs' : 'text-slate-600'
              }`}
            >
              Income
            </button>
            <button
              onClick={() => setFilterType('recurring')}
              className={`px-2.5 py-1 rounded-md font-medium text-[11px] transition-colors ${
                filterType === 'recurring' ? 'bg-white text-slate-900 shadow-2xs' : 'text-slate-600'
              }`}
            >
              Recurring
            </button>
            <button
              onClick={() => setFilterType('anomalies')}
              className={`px-2.5 py-1 rounded-md font-medium text-[11px] transition-colors ${
                filterType === 'anomalies' ? 'bg-white text-rose-700 shadow-2xs' : 'text-slate-600'
              }`}
            >
              Anomalies
            </button>
          </div>
        </div>
      </div>

      {/* Transactions Table */}
      <div className="overflow-x-auto border border-slate-200 rounded-xl">
        <table className="min-w-full divide-y divide-slate-200 text-xs">
          <thead className="bg-slate-50 text-slate-600">
            <tr>
              <th className="px-4 py-2.5 text-left font-semibold">Date</th>
              <th className="px-4 py-2.5 text-left font-semibold">Merchant / Details</th>
              <th className="px-4 py-2.5 text-left font-semibold">Category (Auto-Categorized)</th>
              <th className="px-4 py-2.5 text-left font-semibold">Method</th>
              <th className="px-4 py-2.5 text-right font-semibold">Amount</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 bg-white">
            {filtered.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-4 py-12 text-center text-slate-400">
                  <p className="text-xs font-semibold text-slate-600 mb-1">No transactions recorded yet.</p>
                  <p className="text-[11px] text-slate-400 mb-3">
                    Input your transactions manually or upload your bank/UPI statement.
                  </p>
                  <div className="flex items-center justify-center gap-2">
                    <button
                      onClick={() => setShowAddModal(true)}
                      className="px-3 py-1.5 bg-slate-900 text-white rounded-lg font-semibold hover:bg-slate-800 text-xs"
                    >
                      + Add Transaction
                    </button>
                    {onOpenUploadModal && (
                      <button
                        onClick={onOpenUploadModal}
                        className="px-3 py-1.5 border border-slate-200 text-slate-700 rounded-lg font-semibold hover:bg-slate-50 text-xs"
                      >
                        Upload Statement
                      </button>
                    )}
                  </div>
                </td>
              </tr>
            ) : (
              filtered.map((t, idx) => {
                const isIncome = t.type === 'income';

                return (
                  <tr key={t.id ? `${t.id}-${idx}` : `tx-${idx}`} className="hover:bg-slate-50/70 transition-colors">
                    <td className="px-4 py-3 whitespace-nowrap text-slate-500 font-mono text-[11px]">
                      {t.date}
                    </td>

                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span className="font-bold text-slate-900">{t.merchant}</span>
                        {t.isRecurring && (
                          <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-pink-50 text-pink-700 border border-pink-200 font-medium inline-flex items-center gap-0.5">
                            <Repeat className="w-2.5 h-2.5" />
                            Recurring
                          </span>
                        )}
                        {t.isAnomaly && (
                          <span
                            className="text-[10px] px-1.5 py-0.2 rounded-full bg-rose-50 text-rose-700 border border-rose-200 font-semibold cursor-help"
                            title={t.anomalyReason}
                          >
                            ⚠️ Anomaly
                          </span>
                        )}
                      </div>
                      {t.description && (
                        <p className="text-[11px] text-slate-500 mt-0.5 line-clamp-1">{t.description}</p>
                      )}
                    </td>

                    <td className="px-4 py-3 whitespace-nowrap">
                      {/* Re-categorize select */}
                      <select
                        value={t.category}
                        onChange={(e) => onUpdateCategory(t.id, e.target.value as Category)}
                        className="text-[11px] px-2 py-1 rounded-md bg-slate-100 hover:bg-slate-200/70 text-slate-700 border-none font-medium focus:outline-hidden cursor-pointer"
                      >
                        {CATEGORIES.map((c) => (
                          <option key={c} value={c}>
                            {c}
                          </option>
                        ))}
                      </select>
                    </td>

                    <td className="px-4 py-3 whitespace-nowrap text-slate-500 text-[11px]">
                      {t.paymentMethod || 'UPI / Card'}
                    </td>

                    <td className="px-4 py-3 whitespace-nowrap text-right font-bold">
                      <span className={isIncome ? 'text-emerald-600' : 'text-slate-900'}>
                        {isIncome ? '+' : '-'}{formatINR(t.amount)}
                      </span>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* Manual Add Modal */}
      {showAddModal && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl max-w-md w-full p-5 shadow-xl border border-slate-200">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-sm font-bold text-slate-900">Add Transaction or Bill Record</h3>
              <button
                onClick={() => setShowAddModal(false)}
                className="text-slate-400 hover:text-slate-600 text-xs font-bold"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleManualAdd} className="space-y-3 text-xs">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Merchant / Payee Name</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Swiggy, Reliance Fresh, Petrol Pump, Salary"
                  value={merchant}
                  onChange={(e) => setMerchant(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-hidden focus:border-slate-400"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Description (Optional)</label>
                <input
                  type="text"
                  placeholder="e.g. Weekly family dinner, Monthly house rent"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-hidden focus:border-slate-400"
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Amount (₹)</label>
                  <input
                    type="number"
                    step="1"
                    required
                    min="1"
                    placeholder="e.g. 1500"
                    value={amount || ''}
                    onChange={(e) => setAmount(Number(e.target.value))}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-hidden focus:border-slate-400"
                  />
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Type</label>
                  <select
                    value={type}
                    onChange={(e) => setType(e.target.value as any)}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-hidden focus:border-slate-400"
                  >
                    <option value="expense">Expense / Debit</option>
                    <option value="income">Income / Credit</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Category</label>
                  <select
                    value={category}
                    onChange={(e) => setCategory(e.target.value as any)}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-hidden focus:border-slate-400"
                  >
                    {CATEGORIES.map((c) => (
                      <option key={c} value={c}>
                        {c}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Date</label>
                  <input
                    type="date"
                    required
                    value={date}
                    onChange={(e) => setDate(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-hidden focus:border-slate-400"
                  />
                </div>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Payment Method</label>
                <input
                  type="text"
                  value={paymentMethod}
                  onChange={(e) => setPaymentMethod(e.target.value)}
                  placeholder="e.g. Google Pay UPI, HDFC Debit, SBI, Cash"
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-hidden focus:border-slate-400"
                />
              </div>

              <div className="flex items-center gap-2 pt-1">
                <input
                  type="checkbox"
                  id="recurring-checkbox"
                  checked={isRecurring}
                  onChange={(e) => setIsRecurring(e.target.checked)}
                  className="rounded text-indigo-600 focus:ring-indigo-500"
                />
                <label htmlFor="recurring-checkbox" className="text-slate-700 font-medium">
                  This is a recurring monthly bill or subscription
                </label>
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
                  className="px-4 py-2 rounded-lg bg-slate-900 text-white font-semibold hover:bg-slate-800 transition-colors"
                >
                  Add to Ledger
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
