import React from 'react';
import { SpendingAnomaly } from '../types';
import { AlertOctagon, CheckCircle2, ArrowRight, ShieldAlert, Zap, ExternalLink } from 'lucide-react';
import { formatINR } from '../utils/currency';

interface AnomaliesAlertsProps {
  anomalies: SpendingAnomaly[];
  onResolveAnomaly: (id: string) => void;
}

export const AnomaliesAlerts: React.FC<AnomaliesAlertsProps> = ({ anomalies, onResolveAnomaly }) => {
  const unresolved = anomalies.filter((a) => !a.resolved);

  if (unresolved.length === 0) {
    return (
      <div id="anomalies-section" className="bg-white rounded-xl border border-slate-200 shadow-xs p-4 flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center">
            <CheckCircle2 className="w-5 h-5" />
          </div>
          <div>
            <span className="text-xs font-bold text-slate-900">Spending Patterns Normal</span>
            <p className="text-[11px] text-slate-500">No active duplicate charges or uncharacteristic spending anomalies detected.</p>
          </div>
        </div>
        <span className="text-xs font-semibold text-emerald-600 bg-emerald-50 px-2.5 py-1 rounded-full border border-emerald-200">
          Clean Ledger
        </span>
      </div>
    );
  }

  return (
    <div id="anomalies-section" className="bg-white rounded-xl border border-rose-200 shadow-xs overflow-hidden">
      {/* Alert Header Banner */}
      <div className="bg-rose-50/80 px-4 py-3 border-b border-rose-100 flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-rose-600 text-white flex items-center justify-center shadow-xs">
            <ShieldAlert className="w-4 h-4" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-xs font-bold text-rose-950 uppercase tracking-wider">
                Unusual Spending Patterns & Anomaly Alerts
              </h2>
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-rose-600 text-white">
                {unresolved.length} Attention Required
              </span>
            </div>
            <p className="text-[11px] text-rose-700">
              AI detected sudden price increases, duplicate subscription debits, and out-of-pattern spikes
            </p>
          </div>
        </div>
      </div>

      {/* List of Anomalies */}
      <div className="divide-y divide-slate-100 p-2">
        {unresolved.map((anomaly, idx) => (
          <div key={anomaly.id ? `${anomaly.id}-${idx}` : `anom-${idx}`} className="p-3 hover:bg-slate-50/50 rounded-lg transition-colors flex flex-col md:flex-row md:items-center justify-between gap-3">
            <div className="flex items-start gap-3">
              <div
                className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 mt-0.5 ${
                  anomaly.severity === 'high'
                    ? 'bg-rose-100 text-rose-700'
                    : 'bg-amber-100 text-amber-700'
                }`}
              >
                <AlertOctagon className="w-4 h-4" />
              </div>

              <div>
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-xs font-bold text-slate-900">{anomaly.title}</span>
                  <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded bg-slate-100 text-slate-700">
                    {anomaly.merchant}
                  </span>
                  <span className="text-[10px] font-bold text-rose-600">{formatINR(anomaly.amount)}</span>
                  <span className="text-[10px] text-slate-400">({anomaly.date})</span>
                </div>
                <p className="text-xs text-slate-600 mt-1 leading-relaxed">{anomaly.description}</p>
                <div className="mt-1.5 flex items-center gap-1.5 text-[11px] text-emerald-800 bg-emerald-50/80 px-2 py-1 rounded-md border border-emerald-100 font-medium">
                  <Zap className="w-3 h-3 text-emerald-600 shrink-0" />
                  <span>Recommendation: {anomaly.actionRecommendation}</span>
                </div>
              </div>
            </div>

            <div className="flex items-center gap-2 shrink-0 self-end md:self-center">
              <button
                onClick={() => onResolveAnomaly(anomaly.id)}
                className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-white border border-slate-300 text-slate-700 hover:bg-slate-100 transition-colors flex items-center gap-1 shadow-2xs"
              >
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                <span>Mark Addressed</span>
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
