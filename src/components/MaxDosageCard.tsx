import React, { useState } from 'react';
import { Scale, Clock, ChevronDown, ChevronUp, ShieldAlert, AlertTriangle } from 'lucide-react';
import { MaxDailyDosageInfo } from '../types';

interface MaxDosageCardProps {
  dosageInfo?: MaxDailyDosageInfo;
  className?: string;
}

export const MaxDosageCard: React.FC<MaxDosageCardProps> = ({ dosageInfo, className = '' }) => {
  const [isExpanded, setIsExpanded] = useState(false);
  const [showAlertModal, setShowAlertModal] = useState(false);

  if (!dosageInfo) return null;

  const generalMax = typeof dosageInfo === 'string' 
    ? dosageInfo 
    : (dosageInfo.generalMax || "Consultez la notice médicale");

  const byIndication = Array.isArray(dosageInfo.byIndication) ? dosageInfo.byIndication : [];
  const safetyWarning = typeof dosageInfo === 'object' ? dosageInfo.safetyWarning : undefined;

  const hasIndications = byIndication.length > 0;

  return (
    <div className={`p-3.5 sm:p-4 rounded-2xl bg-white border border-rose-100 shadow-xs hover:border-rose-200 transition-all duration-300 ${className}`}>
      
      {/* Ligne principale compacte et horizontale : Logo + Titre + Dose + Badge sur 24 heures */}
      <div className="flex flex-wrap items-center justify-between gap-2.5">
        <div className="flex items-center gap-2 flex-wrap min-w-0">
          {/* Petit logo discret */}
          <div className="p-1.5 rounded-lg bg-rose-50 text-rose-600 border border-rose-100/80 shadow-2xs shrink-0">
            <Scale className="w-4 h-4" />
          </div>

          {/* Intitulé affiné en horizontal */}
          <span className="text-xs font-semibold text-slate-700 whitespace-nowrap">
            Dosage maximum :
          </span>

          {/* Valeur de la dose avec typographie fine et proportionnée */}
          <span className="text-sm sm:text-base font-extrabold text-rose-950 tracking-tight">
            {generalMax}
          </span>

          {/* Badge "sur 24 heures" qui suit immédiatement */}
          <span className="px-2 py-0.5 rounded-md bg-rose-100/80 text-rose-800 font-bold text-[11px] tracking-tight shrink-0 border border-rose-200/60">
            sur 24 heures
          </span>
        </div>
      </div>

      {/* Message d'alerte dépliable au toucher */}
      {showAlertModal && (
        <div className="mt-3 p-3 rounded-xl bg-rose-50/95 border border-rose-200 text-rose-950 text-xs leading-relaxed animate-fade-in space-y-2">
          <div className="flex items-center justify-between gap-2 font-bold text-rose-900">
            <div className="flex items-center gap-1.5">
              <AlertTriangle className="w-3.5 h-3.5 text-rose-600 shrink-0" />
              <span>Mise en garde sur le dépassement de dose</span>
            </div>
            <button
              type="button"
              onClick={() => setShowAlertModal(false)}
              className="text-[11px] text-rose-600 hover:text-rose-800 font-medium"
            >
              Fermer
            </button>
          </div>
          <p className="text-rose-900/90 text-[11.5px]">
            {safetyWarning || "Attention au surdosage : respectez impérativement l'intervalle entre chaque prise, ne cumulez jamais la même molécule sans avis médical et ne dépassez sous aucun prétexte la dose journalière maximale."}
          </p>
        </div>
      )}

      {/* Liste des indications dans le dépliant */}
      {hasIndications && isExpanded && (
        <div className="mt-3.5 pt-3 border-t border-rose-100/80 space-y-2.5 animate-fade-in">
          {byIndication.map((item, idx) => (
            <div 
              key={idx} 
              className="p-3 rounded-xl bg-rose-50/35 border border-rose-100/70 flex flex-col gap-1.5"
            >
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1">
                <span className="text-sm font-semibold text-slate-800">
                  {item.indication}
                </span>
                <span className="self-start sm:self-auto px-2.5 py-0.5 rounded-md bg-white border border-rose-200 text-rose-800 font-bold text-xs shadow-2xs">
                  {item.maxDaily}
                </span>
              </div>

              {item.frequencyOrInterval && (
                <div className="flex items-start gap-1.5 text-xs text-slate-600">
                  <Clock className="w-3.5 h-3.5 text-rose-500 mt-0.5 shrink-0" />
                  <span>
                    <strong className="text-slate-700 font-medium">Intervalle : </strong>
                    {item.frequencyOrInterval}
                  </span>
                </div>
              )}

              {item.notes && (
                <p className="text-xs text-slate-500 bg-white/80 p-2 rounded-lg border border-rose-100/60 leading-relaxed mt-0.5">
                  {item.notes}
                </p>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Zone du bas centrée : Boutons Alerte surdosage et Voir plus d'indications */}
      <div className="mt-3 pt-2.5 border-t border-rose-100/70 flex flex-col items-center justify-center gap-2">
        {/* Bouton d'alerte surdosage centré au bas */}
        <button
          type="button"
          onClick={() => setShowAlertModal(!showAlertModal)}
          className="inline-flex items-center justify-center gap-1.5 px-3 py-1 rounded-xl text-xs font-bold text-rose-700 hover:text-rose-900 bg-rose-50 hover:bg-rose-100/80 border border-rose-200/70 shadow-2xs transition-all active:scale-95"
          title="Consulter l'avertissement de dépassement et de surdosage"
        >
          <ShieldAlert className="w-3.5 h-3.5 text-rose-600 shrink-0" />
          <span>{showAlertModal ? "Masquer l'alerte surdosage" : "Alerte surdosage"}</span>
        </button>

        {/* Bouton Voir plus d'indications centré */}
        {hasIndications && (
          <button
            type="button"
            onClick={() => setIsExpanded(!isExpanded)}
            className="w-full py-1.5 px-3 rounded-xl text-xs font-medium text-rose-800 hover:text-rose-950 bg-rose-50/40 hover:bg-rose-100/50 transition-all border border-rose-200/40 flex items-center justify-center gap-1.5 shadow-2xs active:scale-[0.99]"
          >
            <span>
              {isExpanded 
                ? "Masquer les détails par indication" 
                : `Voir plus d'indications (${byIndication.length})`}
            </span>
            {isExpanded ? (
              <ChevronUp className="w-3.5 h-3.5 text-rose-600" />
            ) : (
              <ChevronDown className="w-3.5 h-3.5 text-rose-600" />
            )}
          </button>
        )}
      </div>

    </div>
  );
};
