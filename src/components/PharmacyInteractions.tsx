import React, { useEffect, useState } from 'react';
import { AlertTriangle, CheckCircle, Loader2, ShieldAlert, Zap } from 'lucide-react';
import {
  InteractionReport,
  checkPharmacyInteractions,
  getCachedInteractionReport
} from '../services/medicationService';

interface PharmacyInteractionsProps {
  medicationNames: string[];
  userContext: string;
}

const SEVERITY_STYLES = {
  high: { label: 'Dangereux', box: 'bg-red-50 border-red-200', badge: 'bg-red-600 text-white' },
  medium: { label: 'Précaution', box: 'bg-orange-50 border-orange-200', badge: 'bg-orange-500 text-white' },
  low: { label: 'À surveiller', box: 'bg-amber-50 border-amber-200', badge: 'bg-amber-400 text-amber-950' }
} as const;

const SEVERITY_ORDER = { high: 0, medium: 1, low: 2 } as const;

export const PharmacyInteractions: React.FC<PharmacyInteractionsProps> = ({ medicationNames, userContext }) => {
  const [report, setReport] = useState<InteractionReport | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const namesKey = medicationNames.join('|');

  // Réafficher le dernier rapport s'il correspond toujours à la pharmacie et au profil
  useEffect(() => {
    setReport(getCachedInteractionReport(medicationNames, userContext));
    setError(null);
  }, [namesKey, userContext]);

  const canCheck = medicationNames.length >= 2 || (medicationNames.length === 1 && userContext.trim().length > 0);

  const runCheck = async () => {
    setLoading(true);
    setError(null);
    try {
      setReport(await checkPharmacyInteractions(medicationNames, userContext));
    } catch (err: any) {
      setError(err?.message || "La vérification a échoué. Veuillez réessayer.");
    } finally {
      setLoading(false);
    }
  };

  const sorted = report
    ? [...report.interactions].sort((a, b) => SEVERITY_ORDER[a.severity] - SEVERITY_ORDER[b.severity])
    : [];

  return (
    <div className="bg-slate-50 p-3 rounded-xl border border-slate-200/80 space-y-2.5">
      <div className="flex items-center justify-between gap-2">
        <span className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
          <Zap className="w-4 h-4 text-violet-600" />
          Interactions entre mes médicaments
        </span>
      </div>

      {!canCheck && (
        <p className="text-[10px] text-slate-500 leading-relaxed">
          Ajoutez au moins deux médicaments (ou un médicament et votre profil santé) pour vérifier leurs interactions.
        </p>
      )}

      {canCheck && !report && (
        <p className="text-[10px] text-slate-500 leading-relaxed">
          Compare tous vos médicaments entre eux et avec votre profil santé pour repérer les associations à risque.
        </p>
      )}

      {canCheck && (
        <button
          type="button"
          onClick={runCheck}
          disabled={loading}
          className="w-full py-2 px-3 bg-violet-600 hover:bg-violet-700 disabled:opacity-60 text-white rounded-lg text-xs font-bold flex items-center justify-center gap-2 transition-all active:scale-95"
        >
          {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Zap className="w-4 h-4" />}
          {loading ? 'Analyse en cours...' : report ? 'Relancer la vérification' : 'Vérifier les interactions'}
        </button>
      )}

      {error && (
        <p className="text-[11px] text-red-700 bg-red-50 border border-red-100 rounded-lg p-2">{error}</p>
      )}

      {report && !loading && (
        <div className="space-y-2">
          {report.summary && (
            <p className="text-[11px] text-slate-700 leading-relaxed font-medium">{report.summary}</p>
          )}

          {sorted.length === 0 && (
            <div className="flex items-center gap-2 text-[11px] text-emerald-800 bg-emerald-50 border border-emerald-200 rounded-lg p-2">
              <CheckCircle className="w-4 h-4 text-emerald-600 shrink-0" />
              Aucune interaction notable détectée entre vos médicaments.
            </div>
          )}

          {sorted.map((item, idx) => {
            const style = SEVERITY_STYLES[item.severity];
            return (
              <div key={idx} className={`border rounded-lg p-2.5 space-y-1 ${style.box}`}>
                <div className="flex items-start justify-between gap-2">
                  <span className="text-[11px] font-bold text-slate-800">{item.medications.join(' + ')}</span>
                  <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded shrink-0 ${style.badge}`}>{style.label}</span>
                </div>
                <p className="text-[11px] text-slate-700 leading-relaxed">{item.description}</p>
                {item.advice && <p className="text-[11px] text-slate-900 font-semibold leading-relaxed">{item.advice}</p>}
              </div>
            );
          })}

          {report.profileWarnings.length > 0 && (
            <div className="border border-blue-200 bg-blue-50 rounded-lg p-2.5 space-y-1">
              <span className="text-[11px] font-bold text-blue-900 flex items-center gap-1.5">
                <ShieldAlert className="w-3.5 h-3.5" /> Selon votre profil santé
              </span>
              <ul className="list-disc pl-4 space-y-0.5">
                {report.profileWarnings.map((w, idx) => (
                  <li key={idx} className="text-[11px] text-blue-900 leading-relaxed">{w}</li>
                ))}
              </ul>
            </div>
          )}

          <p className="text-[9px] text-slate-400 italic flex items-start gap-1">
            <AlertTriangle className="w-3 h-3 shrink-0 mt-px" />
            Analyse générée par l'IA le {new Date(report.checkedAt).toLocaleDateString('fr-FR')}. Elle ne remplace pas l'avis de votre médecin ou pharmacien.
          </p>
        </div>
      )}
    </div>
  );
};
