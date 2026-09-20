import React, { useState, useRef } from 'react';
import { UploadCloud, FileText, Check, AlertCircle, Sparkles, X, ArrowRight, Layers } from 'lucide-react';
import { Transaction, Category } from '../types';
import { formatINR } from '../utils/currency';

interface StatementUploaderModalProps {
  isOpen: boolean;
  onClose: () => void;
  onImportTransactions: (transactions: Transaction[]) => void;
}

const SAMPLE_STATEMENTS = [
  {
    name: 'HDFC Bank Account Statement (September INR)',
    description: 'Transactions including groceries, fuel, Swiggy, and digital subscriptions',
    content: `2026-09-18,RELIANCE RETAIL FRESH,Weekly grocery and vegetables,₹2450.00,Groceries
2026-09-17,INDIAN OIL CORP PETROL,Fuel tank refill,₹1850.00,Transportation
2026-09-15,SWIGGY BANGALORE,Family dinner order,₹680.00,Dining & Takeout
2026-09-14,JIO FIBER RECHARGE,Broadband monthly plan,₹825.00,Utilities & Bills
2026-09-12,ZUDIO FASHION RETAIL,Apparel and shoes,₹1890.00,Shopping & Goods
2026-09-10,UBER INDIA TECH,Cab transit to airport,₹640.00,Transportation`,
  },
  {
    name: 'BESCOM Electricity & Gas Utility Bill',
    description: 'Monthly utility power statement in Indian Rupees',
    content: `Statement Date: 2026-09-20
Consumer ID: 08842194
BESCOM Electricity Monthly Consumption: ₹1620.00
Piped Natural Gas Domestic Meter: ₹580.00
Total Payable Due Sep 28: ₹2200.00`,
  },
  {
    name: 'UPI / PhonePe Payment History',
    description: 'Daily UPI debits for groceries, rent advance, and medical prescription',
    content: `2026-09-19,APOLLO PHARMACY,Medicines & vitamins,₹840.00,Health & Fitness
2026-09-16,PRESTIGE FLATS RENT,Maintenance advance,₹12000.00,Housing & Rent
2026-09-14,BLINKIT QUICK COMMERCE,Daily milk & groceries,₹560.00,Groceries
2026-09-11,SPOTIFY INDIA,Monthly family premium,₹179.00,Subscriptions & Digital`,
  },
];

export const StatementUploaderModal: React.FC<StatementUploaderModalProps> = ({
  isOpen,
  onClose,
  onImportTransactions,
}) => {
  const [activeTab, setActiveTab] = useState<'samples' | 'upload' | 'paste'>('samples');
  const [pastedText, setPastedText] = useState('');
  const [fileName, setFileName] = useState<string | null>(null);
  const [fileBase64, setFileBase64] = useState<string | null>(null);
  const [fileMimeType, setFileMimeType] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [parsedPreview, setParsedPreview] = useState<Transaction[] | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  if (!isOpen) return null;

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setFileName(file.name);
    setError(null);

    const reader = new FileReader();
    if (file.type.startsWith('image/')) {
      reader.onload = () => {
        setFileBase64(reader.result as string);
        setFileMimeType(file.type);
      };
      reader.readAsDataURL(file);
    } else {
      reader.onload = () => {
        setPastedText(reader.result as string);
      };
      reader.readAsText(file);
    }
  };

  const handleProcess = async (textToProcess?: string) => {
    const text = textToProcess !== undefined ? textToProcess : pastedText;
    if (!text && !fileBase64) {
      setError('Please provide text or upload a statement document.');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const res = await fetch('/api/gemini/parse-statement', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          textContent: text,
          base64Image: fileBase64,
          mimeType: fileMimeType,
          fileName: fileName || 'Statement.csv',
        }),
      });

      if (!res.ok) {
        throw new Error(`Server returned ${res.status}`);
      }

      const data = await res.json();
      if (Array.isArray(data.transactions) && data.transactions.length > 0) {
        const formatted = data.transactions.map((t: any, idx: number) => ({
          ...t,
          id: `imported-${Date.now()}-${idx}-${Math.random().toString(36).slice(2, 7)}`,
          type: t.type || 'expense',
          paymentMethod: t.paymentMethod || 'UPI / NetBanking',
          confidence: t.confidence || 0.9,
        }));
        setParsedPreview(formatted);
      } else {
        throw new Error('No transactions could be parsed from this input.');
      }
    } catch (err: any) {
      console.error('Parse error:', err);
      setError(err.message || 'Failed to parse statement.');
    } finally {
      setLoading(false);
    }
  };

  const confirmImport = () => {
    if (parsedPreview && parsedPreview.length > 0) {
      onImportTransactions(parsedPreview);
      onClose();
    }
  };

  return (
    <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4 z-50 overflow-y-auto">
      <div className="bg-white rounded-2xl max-w-xl w-full p-6 shadow-2xl border border-slate-200 my-6">
        {/* Header */}
        <div className="flex items-center justify-between pb-3 border-b border-slate-100">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-emerald-100 text-emerald-700 flex items-center justify-center">
              <UploadCloud className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-900">Upload & Parse Financial Records (₹)</h2>
              <p className="text-xs text-slate-500">
                AI extracts date, merchant, amount in Rupees (₹), category, and detects anomalies
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-700 p-1 rounded-md hover:bg-slate-100 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Tab Selection */}
        {!parsedPreview && (
          <div className="flex border-b border-slate-100 my-4 text-xs font-semibold">
            <button
              onClick={() => setActiveTab('samples')}
              className={`pb-2 px-3 border-b-2 transition-colors ${
                activeTab === 'samples'
                  ? 'border-emerald-600 text-emerald-700'
                  : 'border-transparent text-slate-500 hover:text-slate-800'
              }`}
            >
              Indian Sample Statements (₹)
            </button>
            <button
              onClick={() => setActiveTab('upload')}
              className={`pb-2 px-3 border-b-2 transition-colors ${
                activeTab === 'upload'
                  ? 'border-emerald-600 text-emerald-700'
                  : 'border-transparent text-slate-500 hover:text-slate-800'
              }`}
            >
              Upload File (CSV / Image)
            </button>
            <button
              onClick={() => setActiveTab('paste')}
              className={`pb-2 px-3 border-b-2 transition-colors ${
                activeTab === 'paste'
                  ? 'border-emerald-600 text-emerald-700'
                  : 'border-transparent text-slate-500 hover:text-slate-800'
              }`}
            >
              Paste Statement Text
            </button>
          </div>
        )}

        {/* Tab Content */}
        {!parsedPreview && (
          <div className="space-y-4">
            {activeTab === 'samples' && (
              <div className="space-y-2.5">
                <p className="text-xs text-slate-600">
                  Select a pre-formatted statement sample to test AI extraction in Indian Rupees instantly:
                </p>
                {SAMPLE_STATEMENTS.map((sample, idx) => (
                  <div
                    key={idx}
                    onClick={() => {
                      setPastedText(sample.content);
                      setFileName(sample.name);
                      handleProcess(sample.content);
                    }}
                    className="p-3 border border-slate-200 rounded-xl hover:border-emerald-500 hover:bg-emerald-50/40 cursor-pointer transition-all flex items-center justify-between group"
                  >
                    <div>
                      <span className="text-xs font-bold text-slate-900 group-hover:text-emerald-800">
                        {sample.name}
                      </span>
                      <p className="text-[11px] text-slate-500 mt-0.5">{sample.description}</p>
                    </div>
                    <span className="text-xs font-semibold text-emerald-600 flex items-center gap-1">
                      <span>Parse</span>
                      <ArrowRight className="w-3.5 h-3.5" />
                    </span>
                  </div>
                ))}
              </div>
            )}

            {activeTab === 'upload' && (
              <div>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".csv,.txt,image/*"
                  onChange={handleFileChange}
                  className="hidden"
                />
                <div
                  onClick={() => fileInputRef.current?.click()}
                  className="border-2 border-dashed border-slate-300 hover:border-emerald-500 rounded-xl p-6 text-center cursor-pointer bg-slate-50/50 hover:bg-emerald-50/20 transition-all"
                >
                  <UploadCloud className="w-8 h-8 text-slate-400 mx-auto mb-2" />
                  <span className="text-xs font-bold text-slate-800 block">
                    {fileName ? fileName : 'Choose bank CSV file or receipt image'}
                  </span>
                  <span className="text-[11px] text-slate-500 mt-1 block">
                    Supports Indian bank statements (HDFC, SBI, ICICI, Axis), UPI logs, and receipts in ₹
                  </span>
                </div>
              </div>
            )}

            {activeTab === 'paste' && (
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Paste Raw Transactions or Statement Text (Rupees)
                </label>
                <textarea
                  rows={6}
                  value={pastedText}
                  onChange={(e) => setPastedText(e.target.value)}
                  placeholder="Paste text like:&#10;2026-09-15 SWIGGY BANGALORE ₹650.00 Food&#10;2026-09-16 RELIANCE DIGITAL ₹4500.00 Shopping"
                  className="w-full text-xs font-mono p-3 border border-slate-200 rounded-xl bg-slate-50 focus:outline-hidden focus:border-emerald-500"
                />
              </div>
            )}

            {error && (
              <div className="p-2.5 bg-rose-50 border border-rose-200 rounded-lg text-xs text-rose-700 flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{error}</span>
              </div>
            )}

            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={onClose}
                className="px-3 py-2 text-xs font-medium text-slate-600 hover:bg-slate-100 rounded-lg"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={loading}
                onClick={() => handleProcess()}
                className="px-4 py-2 text-xs font-semibold bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg transition-colors flex items-center gap-1.5 disabled:opacity-50"
              >
                <Sparkles className="w-3.5 h-3.5" />
                <span>{loading ? 'AI Parsing Statement...' : 'Parse Transactions'}</span>
              </button>
            </div>
          </div>
        )}

        {/* Parsed Preview Screen */}
        {parsedPreview && (
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-slate-900">
                Extracted {parsedPreview.length} Transactions
              </span>
              <span className="text-[11px] font-semibold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                AI Categorized in Rupees (₹)
              </span>
            </div>

            <div className="border border-slate-200 rounded-xl max-h-60 overflow-y-auto divide-y divide-slate-100 text-xs">
              {parsedPreview.map((t, idx) => (
                <div key={t.id || `preview-${idx}`} className="p-2.5 flex items-center justify-between hover:bg-slate-50">
                  <div>
                    <div className="flex items-center gap-1.5">
                      <span className="font-bold text-slate-900">{t.merchant}</span>
                      <span className="text-[10px] px-1.5 py-0.2 rounded bg-slate-100 text-slate-600 font-medium">
                        {t.category}
                      </span>
                    </div>
                    <span className="text-[10px] text-slate-400">{t.date}</span>
                  </div>
                  <span className="font-bold text-slate-900">{formatINR(t.amount)}</span>
                </div>
              ))}
            </div>

            <div className="flex justify-between items-center pt-3 border-t border-slate-100">
              <button
                onClick={() => setParsedPreview(null)}
                className="text-xs font-medium text-slate-500 hover:text-slate-800"
              >
                ← Back
              </button>

              <button
                onClick={confirmImport}
                className="px-4 py-2 text-xs font-semibold bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg flex items-center gap-1.5 shadow-xs"
              >
                <Check className="w-3.5 h-3.5" />
                <span>Add {parsedPreview.length} Records to Ledger</span>
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
