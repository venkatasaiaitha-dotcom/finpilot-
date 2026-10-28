import React from 'react';
import { SpendingAnomaly } from '../types';
import { AlertOctagon, CheckCircle2, ShieldAlert, Zap, ShieldCheck } from 'lucide-react';
import { formatINR } from '../utils/currency';

interface AnomaliesAlertsProps {
  anomalies: SpendingAnomaly[];
  onResolveAnomaly: (id: string) => void;
}

export const AnomaliesAlerts: React.FC<AnomaliesAlertsProps> = ({ anomalies, onResolveAnomaly }) => {
  const unresolved = anomalies.filter((a) => !a.resolved);

  if (unresolved.length === 0) {
    return (
      <div id="anomalies-section" className="bg-[#111827] rounded-2xl border border-slate-800 shadow-xl p-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 flex items-center justify-center shrink-0">
            <ShieldCheck className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-white">All Spending Patterns Normal</h3>
            <p className="text-xs text-slate-400 mt-0.5">
              No duplicate debit charges, sudden subscription jumps, or abnormal spikes detected in your ledger.
            </p>
          </div>
        </div>
        <span className="text-xs font-bold text-emerald-400 bg-emerald-500/10 px-3 py-1.5 rounded-full border border-emerald-500/25 self-start sm:self-auto">
          Clean Ledger Verified
        </span>
      </div>
    );
  }

  return (
    <div id="anomalies-section" className="bg-[#111827] rounded-2xl border border-rose-500/30 shadow-xl overflow-hidden space-y-4">
      {/* Alert Header Banner */}
      <div className="bg-rose-500/10 px-5 py-4 border-b border-rose-500/20 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-rose-500/20 text-rose-300 border border-rose-500/30 flex items-center justify-center shrink-0">
            <ShieldAlert className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-xs font-bold text-rose-300 uppercase tracking-wider">
                Unusual Spending Patterns & Anomaly Alerts
              </h2>
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-rose-500 text-slate-950 font-bold">
                {unresolved.length} Attention Required
              </span>
            </div>
            <p className="text-xs text-slate-400 mt-0.5">
              FinPilot detected potential billing spikes, duplicate subscription debits, and abnormal charges
            </p>
          </div>
        </div>
      </div>

      {/* List of Anomalies */}
      <div className="p-4 space-y-3">
        {unresolved.map((anomaly, idx) => (
          <div
            key={anomaly.id ? `${anomaly.id}-${idx}` : `anom-${idx}`}
            className="p-4 rounded-xl bg-slate-900/60 border border-slate-800 hover:border-slate-700 transition-colors flex flex-col md:flex-row md:items-center justify-between gap-4 text-xs"
          >
            <div className="flex items-start gap-3.5">
              <div
                className={`w-8 h-8 rounded-xl flex items-center justify-center shrink-0 mt-0.5 ${
                  anomaly.severity === 'high'
                    ? 'bg-rose-500/20 text-rose-300 border border-rose-500/30'
                    : 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                }`}
              >
                <AlertOctagon className="w-4 h-4" />
              </div>

              <div className="space-y-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-xs font-bold text-white">{anomaly.title}</span>
                  <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-slate-800 text-slate-300 border border-slate-700">
                    {anomaly.merchant}
                  </span>
                  <span className="text-xs font-bold text-rose-400">{formatINR(anomaly.amount)}</span>
                  <span className="text-[10px] text-slate-500">({anomaly.date})</span>
                </div>
                <p className="text-slate-300 text-xs leading-relaxed">{anomaly.description}</p>
                <div className="mt-2 flex items-center gap-1.5 text-xs text-emerald-300 bg-emerald-500/10 px-2.5 py-1 rounded-lg border border-emerald-500/20 font-medium">
                  <Zap className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                  <span>Recommendation: {anomaly.actionRecommendation}</span>
                </div>
              </div>
            </div>

            <div className="flex items-center gap-2 shrink-0 self-end md:self-center">
              <button
                onClick={() => onResolveAnomaly(anomaly.id)}
                className="px-3.5 py-2 rounded-xl text-xs font-semibold bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 hover:border-emerald-500/40 transition-colors flex items-center gap-1.5 cursor-pointer"
              >
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                <span>Mark Addressed</span>
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
