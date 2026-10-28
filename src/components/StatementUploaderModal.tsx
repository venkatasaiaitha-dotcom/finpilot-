import React, { useState, useRef } from 'react';
import { UploadCloud, Check, AlertCircle, Sparkles, X, ArrowRight } from 'lucide-react';
import { Transaction } from '../types';
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
    setFileMimeType(file.type);
    setError(null);

    const reader = new FileReader();
    if (file.type.startsWith('image/')) {
      reader.onload = () => {
        setFileBase64(reader.result as string);
      };
      reader.readAsDataURL(file);
    } else {
      reader.onload = () => {
        setPastedText(reader.result as string);
      };
      reader.readAsText(file);
    }
  };

  const handleProcess = async (directText?: string) => {
    const content = directText || pastedText;
    if (!content && !fileBase64) {
      setError('Please provide a file, select a sample, or paste statement text.');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const response = await fetch('/api/gemini/parse-statement', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          textContent: content || undefined,
          base64Image: fileBase64 || undefined,
          mimeType: fileMimeType || undefined,
          fileName: fileName || undefined,
        }),
      });

      if (!response.ok) {
        throw new Error(`Server returned error: ${response.status}`);
      }

      const result = await response.json();
      if (result.transactions && Array.isArray(result.transactions)) {
        setParsedPreview(result.transactions);
      } else {
        throw new Error('No transactions could be parsed from the provided document.');
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
    <div className="fixed inset-0 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4 z-50 overflow-y-auto">
      <div className="bg-[#111827] rounded-2xl max-w-xl w-full p-6 shadow-2xl border border-slate-800 my-6 text-slate-200">
        {/* Header */}
        <div className="flex items-center justify-between pb-4 border-b border-slate-800">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 flex items-center justify-center">
              <UploadCloud className="w-5 h-5 text-emerald-400" />
            </div>
            <div>
              <h2 className="text-base font-bold text-white">Upload & Parse Financial Records (₹)</h2>
              <p className="text-xs text-slate-400">
                AI extracts date, merchant, amount in Rupees (₹), category, and detects anomalies
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tab Selection */}
        {!parsedPreview && (
          <div className="flex border-b border-slate-800 my-4 text-xs font-semibold gap-2">
            <button
              onClick={() => setActiveTab('samples')}
              className={`pb-2 px-3 border-b-2 transition-colors cursor-pointer ${
                activeTab === 'samples'
                  ? 'border-emerald-500 text-emerald-400 font-bold'
                  : 'border-transparent text-slate-400 hover:text-slate-200'
              }`}
            >
              Sample Statements (₹)
            </button>
            <button
              onClick={() => setActiveTab('upload')}
              className={`pb-2 px-3 border-b-2 transition-colors cursor-pointer ${
                activeTab === 'upload'
                  ? 'border-emerald-500 text-emerald-400 font-bold'
                  : 'border-transparent text-slate-400 hover:text-slate-200'
              }`}
            >
              Upload File (CSV / Image)
            </button>
            <button
              onClick={() => setActiveTab('paste')}
              className={`pb-2 px-3 border-b-2 transition-colors cursor-pointer ${
                activeTab === 'paste'
                  ? 'border-emerald-500 text-emerald-400 font-bold'
                  : 'border-transparent text-slate-400 hover:text-slate-200'
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
                <p className="text-xs text-slate-400">
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
                    className="p-3.5 border border-slate-800 rounded-xl bg-slate-900/50 hover:border-emerald-500/50 hover:bg-emerald-500/5 cursor-pointer transition-all flex items-center justify-between group"
                  >
                    <div>
                      <span className="text-xs font-bold text-white group-hover:text-emerald-300">
                        {sample.name}
                      </span>
                      <p className="text-[11px] text-slate-400 mt-0.5">{sample.description}</p>
                    </div>
                    <span className="text-xs font-semibold text-emerald-400 flex items-center gap-1 shrink-0">
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
                  className="border-2 border-dashed border-slate-800 hover:border-emerald-500/60 rounded-xl p-8 text-center cursor-pointer bg-slate-900/40 hover:bg-emerald-500/5 transition-all"
                >
                  <UploadCloud className="w-9 h-9 text-slate-400 mx-auto mb-2" />
                  <span className="text-xs font-bold text-white block">
                    {fileName ? fileName : 'Choose bank CSV file or receipt image'}
                  </span>
                  <span className="text-[11px] text-slate-400 mt-1 block">
                    Supports Indian bank statements (HDFC, SBI, ICICI, Axis), UPI logs, and receipts in ₹
                  </span>
                </div>
              </div>
            )}

            {activeTab === 'paste' && (
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                  Paste Raw Transactions or Statement Text (Rupees)
                </label>
                <textarea
                  rows={6}
                  value={pastedText}
                  onChange={(e) => setPastedText(e.target.value)}
                  placeholder="Paste text like:&#10;2026-09-15 SWIGGY BANGALORE ₹650.00 Food&#10;2026-09-16 RELIANCE DIGITAL ₹4500.00 Shopping"
                  className="w-full text-xs font-mono p-3 border border-slate-800 rounded-xl bg-slate-900 text-white placeholder:text-slate-600 focus:outline-hidden focus:border-emerald-500"
                />
              </div>
            )}

            {error && (
              <div className="p-3 bg-rose-500/15 border border-rose-500/30 rounded-xl text-xs text-rose-300 flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{error}</span>
              </div>
            )}

            <div className="flex justify-end gap-2.5 pt-3 border-t border-slate-800">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 text-xs font-medium text-slate-300 hover:bg-slate-800 rounded-xl transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={loading}
                onClick={() => handleProcess()}
                className="px-4 py-2 text-xs font-bold bg-emerald-500 hover:bg-emerald-400 text-slate-950 rounded-xl transition-all flex items-center gap-1.5 disabled:opacity-50 cursor-pointer shadow-md shadow-emerald-950/40"
              >
                <Sparkles className="w-3.5 h-3.5" />
                <span>{loading ? 'AI Parsing Statement...' : 'Parse Transactions'}</span>
              </button>
            </div>
          </div>
        )}

        {/* Parsed Preview Screen */}
        {parsedPreview && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-white">
                Extracted {parsedPreview.length} Transactions
              </span>
              <span className="text-[11px] font-semibold text-emerald-400 bg-emerald-500/15 px-2.5 py-0.5 rounded-full border border-emerald-500/30">
                AI Categorized in Rupees (₹)
              </span>
            </div>

            <div className="border border-slate-800 rounded-xl max-h-64 overflow-y-auto divide-y divide-slate-800/80 text-xs bg-slate-900/50">
              {parsedPreview.map((t, idx) => (
                <div key={t.id || `preview-${idx}`} className="p-3 flex items-center justify-between hover:bg-slate-800/40">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-white">{t.merchant}</span>
                      <span className="text-[10px] px-1.5 py-0.2 rounded bg-slate-800 text-slate-300 font-medium">
                        {t.category}
                      </span>
                    </div>
                    <span className="text-[10px] text-slate-500">{t.date}</span>
                  </div>
                  <span className="font-bold text-emerald-400">{formatINR(t.amount)}</span>
                </div>
              ))}
            </div>

            <div className="flex justify-between items-center pt-3 border-t border-slate-800">
              <button
                onClick={() => setParsedPreview(null)}
                className="text-xs font-medium text-slate-400 hover:text-white"
              >
                ← Back
              </button>

              <button
                onClick={confirmImport}
                className="px-4 py-2 text-xs font-bold bg-emerald-500 hover:bg-emerald-400 text-slate-950 rounded-xl flex items-center gap-1.5 shadow-md shadow-emerald-950/40 cursor-pointer"
              >
                <Check className="w-3.5 h-3.5 stroke-[2.5]" />
                <span>Add {parsedPreview.length} Records to Ledger</span>
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
