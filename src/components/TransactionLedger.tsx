import React, { useState } from 'react';
import { Transaction, Category } from '../types';
import { Search, Repeat, Plus, FileSpreadsheet, UploadCloud, X, ArrowUpRight, ArrowDownRight } from 'lucide-react';
import { formatINR } from '../utils/currency';

interface TransactionLedgerProps {
  transactions: Transaction[];
  onUpdateCategory: (id: string, category: Category) => void;
  onAddTransaction: (transaction: Transaction) => void;
  onOpenUploadModal?: () => void;
  onOpenGoogleSheets?: () => void;
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
  onOpenGoogleSheets,
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
    <div id="transactions-ledger-card" className="bg-[#111827] rounded-2xl border border-slate-800 shadow-xl p-5 sm:p-6 space-y-4">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between pb-4 border-b border-slate-800 gap-3">
        <div>
          <div className="flex items-center gap-2.5">
            <h2 className="text-base font-bold text-white tracking-tight">Transaction Ledger</h2>
            <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full bg-slate-800 text-slate-300 border border-slate-700">
              {filtered.length} of {transactions.length} Records
            </span>
          </div>
          <p className="text-xs text-slate-400 mt-0.5">
            Auto-categorized records with recurring tracking & anomaly detection
          </p>
        </div>

        <div className="flex items-center gap-2 self-start md:self-auto flex-wrap">
          {onOpenGoogleSheets && (
            <button
              onClick={onOpenGoogleSheets}
              title="Export, sync, or import transactions with Google Sheets"
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold border border-slate-700 bg-slate-900 text-slate-200 hover:bg-slate-800 transition-colors shadow-xs cursor-pointer"
            >
              <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-400" />
              <span>Google Sheets</span>
            </button>
          )}
          {onOpenUploadModal && (
            <button
              onClick={onOpenUploadModal}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold border border-slate-700 bg-slate-900 text-slate-200 hover:bg-slate-800 transition-colors shadow-xs cursor-pointer"
            >
              <UploadCloud className="w-3.5 h-3.5 text-emerald-400" />
              <span>Import Statement</span>
            </button>
          )}
          <button
            onClick={() => setShowAddModal(true)}
            className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl text-xs font-bold bg-emerald-500 hover:bg-emerald-400 text-slate-950 transition-all shadow-md shadow-emerald-950/40 cursor-pointer"
          >
            <Plus className="w-3.5 h-3.5 stroke-[2.5]" />
            <span>+ Add Record</span>
          </button>
        </div>
      </div>

      {/* Filters & Search Toolbar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-1">
        <div className="relative flex-1 max-w-sm">
          <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-2.5" />
          <input
            type="text"
            placeholder="Search merchant or description..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-9 pr-3 py-2 bg-slate-900 border border-slate-800 rounded-xl text-xs text-white placeholder:text-slate-500 focus:outline-hidden focus:border-emerald-500 transition-colors"
          />
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          {/* Category Dropdown */}
          <select
            value={selectedCategory}
            onChange={(e) => setSelectedCategory(e.target.value)}
            className="px-3 py-2 bg-slate-900 border border-slate-800 rounded-xl text-xs text-slate-300 font-medium focus:outline-hidden focus:border-emerald-500"
          >
            <option value="all">All Categories</option>
            {CATEGORIES.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>

          {/* Type Filter Chips */}
          <div className="flex items-center bg-slate-900/90 border border-slate-800 p-0.5 rounded-xl text-xs">
            {(
              [
                { id: 'all', label: 'All' },
                { id: 'expense', label: 'Expenses' },
                { id: 'income', label: 'Income' },
                { id: 'recurring', label: 'Recurring' },
                { id: 'anomalies', label: 'Anomalies' },
              ] as const
            ).map((tab) => {
              const isSelected = filterType === tab.id;
              return (
                <button
                  key={tab.id}
                  onClick={() => setFilterType(tab.id)}
                  className={`px-3 py-1.5 rounded-lg font-medium text-[11px] transition-all cursor-pointer ${
                    isSelected
                      ? tab.id === 'anomalies'
                        ? 'bg-rose-500/20 text-rose-300 border border-rose-500/30'
                        : 'bg-emerald-500/15 text-emerald-400 font-bold border border-emerald-500/30 shadow-xs'
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  {tab.label}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* Transactions Table */}
      <div className="overflow-x-auto border border-slate-800 rounded-xl">
        <table className="min-w-full divide-y divide-slate-800 text-xs">
          <thead className="bg-[#0d131f] text-slate-400">
            <tr>
              <th className="px-4 py-3 text-left font-semibold">Date</th>
              <th className="px-4 py-3 text-left font-semibold">Merchant / Payee</th>
              <th className="px-4 py-3 text-left font-semibold">Category</th>
              <th className="px-4 py-3 text-left font-semibold">Method</th>
              <th className="px-4 py-3 text-right font-semibold">Amount</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800/60 bg-[#111827]">
            {filtered.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-4 py-12 text-center text-slate-400">
                  <p className="text-xs font-semibold text-slate-300 mb-1">No matching transactions found.</p>
                  <p className="text-[11px] text-slate-500 mb-4">
                    Adjust your search filter, or add transactions manually or from bank statements.
                  </p>
                  <div className="flex items-center justify-center gap-2">
                    <button
                      onClick={() => setShowAddModal(true)}
                      className="px-3.5 py-2 bg-emerald-500 hover:bg-emerald-400 text-slate-950 rounded-xl font-bold text-xs"
                    >
                      + Add Record
                    </button>
                    {onOpenUploadModal && (
                      <button
                        onClick={onOpenUploadModal}
                        className="px-3.5 py-2 border border-slate-700 bg-slate-900 text-slate-200 hover:bg-slate-800 rounded-xl font-semibold text-xs"
                      >
                        Import Statement
                      </button>
                    )}
                  </div>
                </td>
              </tr>
            ) : (
              filtered.map((t, idx) => {
                const isIncome = t.type === 'income';

                return (
                  <tr key={t.id ? `${t.id}-${idx}` : `tx-${idx}`} className="hover:bg-slate-800/30 transition-colors">
                    <td className="px-4 py-3.5 whitespace-nowrap text-slate-400 font-mono text-[11px]">
                      {t.date}
                    </td>

                    <td className="px-4 py-3.5">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-bold text-white">{t.merchant}</span>
                        {t.isRecurring && (
                          <span className="text-[10px] px-1.5 py-0.2 rounded bg-pink-500/15 text-pink-400 border border-pink-500/25 font-medium inline-flex items-center gap-0.5">
                            <Repeat className="w-2.5 h-2.5" />
                            Recurring
                          </span>
                        )}
                        {t.isAnomaly && (
                          <span
                            className="text-[10px] px-1.5 py-0.2 rounded bg-rose-500/20 text-rose-300 border border-rose-500/30 font-semibold cursor-help"
                            title={t.anomalyReason}
                          >
                            ⚠️ Alert
                          </span>
                        )}
                      </div>
                      {t.description && (
                        <p className="text-[11px] text-slate-400 mt-0.5 line-clamp-1">{t.description}</p>
                      )}
                    </td>

                    <td className="px-4 py-3.5 whitespace-nowrap">
                      {/* Re-categorize select */}
                      <select
                        value={t.category}
                        onChange={(e) => onUpdateCategory(t.id, e.target.value as Category)}
                        className="text-[11px] px-2.5 py-1 rounded-lg bg-slate-900 border border-slate-800 text-slate-300 hover:border-slate-700 font-medium focus:outline-hidden focus:border-emerald-500 cursor-pointer"
                      >
                        {CATEGORIES.map((c) => (
                          <option key={c} value={c}>
                            {c}
                          </option>
                        ))}
                      </select>
                    </td>

                    <td className="px-4 py-3.5 whitespace-nowrap text-slate-400 text-[11px]">
                      {t.paymentMethod || 'UPI / Card'}
                    </td>

                    <td className="px-4 py-3.5 whitespace-nowrap text-right font-bold text-sm">
                      <span className={isIncome ? 'text-emerald-400' : 'text-slate-100'}>
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
        <div className="fixed inset-0 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4 z-50 overflow-y-auto">
          <div className="bg-[#111827] rounded-2xl max-w-md w-full p-6 shadow-2xl border border-slate-800 text-slate-200">
            <div className="flex justify-between items-center pb-3 border-b border-slate-800 mb-4">
              <h3 className="text-sm font-bold text-white">Add Transaction or Bill Record</h3>
              <button
                onClick={() => setShowAddModal(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleManualAdd} className="space-y-3.5 text-xs">
              <div>
                <label className="block font-semibold text-slate-300 mb-1">Merchant / Payee Name</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Swiggy, Reliance Fresh, Petrol Pump, Salary"
                  value={merchant}
                  onChange={(e) => setMerchant(e.target.value)}
                  className="w-full px-3.5 py-2.5 bg-slate-900 border border-slate-800 rounded-xl text-white placeholder:text-slate-500 focus:outline-hidden focus:border-emerald-500"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-300 mb-1">Description (Optional)</label>
                <input
                  type="text"
                  placeholder="e.g. Weekly family dinner, Monthly house rent"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
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
                    placeholder="e.g. 1500"
                    value={amount || ''}
                    onChange={(e) => setAmount(Number(e.target.value))}
                    className="w-full px-3.5 py-2.5 bg-slate-900 border border-slate-800 rounded-xl text-white placeholder:text-slate-500 focus:outline-hidden focus:border-emerald-500"
                  />
                </div>

                <div>
                  <label className="block font-semibold text-slate-300 mb-1">Type</label>
                  <select
                    value={type}
                    onChange={(e) => setType(e.target.value as any)}
                    className="w-full px-3.5 py-2.5 bg-slate-900 border border-slate-800 rounded-xl text-white focus:outline-hidden focus:border-emerald-500"
                  >
                    <option value="expense">Expense / Debit</option>
                    <option value="income">Income / Credit</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-300 mb-1">Category</label>
                  <select
                    value={category}
                    onChange={(e) => setCategory(e.target.value as any)}
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
                  <label className="block font-semibold text-slate-300 mb-1">Date</label>
                  <input
                    type="date"
                    required
                    value={date}
                    onChange={(e) => setDate(e.target.value)}
                    className="w-full px-3.5 py-2.5 bg-slate-900 border border-slate-800 rounded-xl text-white focus:outline-hidden focus:border-emerald-500"
                  />
                </div>
              </div>

              <div>
                <label className="block font-semibold text-slate-300 mb-1">Payment Method</label>
                <input
                  type="text"
                  value={paymentMethod}
                  onChange={(e) => setPaymentMethod(e.target.value)}
                  placeholder="e.g. Google Pay UPI, HDFC Debit, SBI, Cash"
                  className="w-full px-3.5 py-2.5 bg-slate-900 border border-slate-800 rounded-xl text-white placeholder:text-slate-500 focus:outline-hidden focus:border-emerald-500"
                />
              </div>

              <div className="flex items-center gap-2 pt-1">
                <input
                  type="checkbox"
                  id="recurring-checkbox"
                  checked={isRecurring}
                  onChange={(e) => setIsRecurring(e.target.checked)}
                  className="rounded text-emerald-500 focus:ring-emerald-500"
                />
                <label htmlFor="recurring-checkbox" className="text-slate-300 font-medium">
                  This is a recurring monthly bill or subscription
                </label>
              </div>

              <div className="flex justify-end gap-2.5 pt-4 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-medium transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold transition-all shadow-md shadow-emerald-950/40 cursor-pointer"
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
