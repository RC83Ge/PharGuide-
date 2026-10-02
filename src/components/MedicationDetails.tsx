import React from 'react';
import {
  Activity,
  Ban,
  Calendar,
  CheckCircle,
  Info as InfoIcon,
  Package,
  Pill,
  PlusCircle,
  Share2
} from 'lucide-react';
import { MedicationInfo } from '../types';
import { AlertBadge } from './AlertBadge';
import { DoseLogCard } from './DoseLogCard';
import { Alternatives } from './Alternatives';
import { MaxDosageCard } from './MaxDosageCard';
import { SectionCard } from './SectionCard';

interface MedicationDetailsProps {
  med: MedicationInfo;
  isInList: boolean;
  isInReserve: boolean;
  onShare: () => void;
  onAdd: (asReserve: boolean) => void;
  onToggleReserve: (e: React.MouseEvent, medName: string) => void;
  onSearch: (query: string) => void;
}

export const MedicationDetails: React.FC<MedicationDetailsProps> = ({
  med,
  isInList,
  isInReserve,
  onShare,
  onAdd,
  onToggleReserve,
  onSearch
}) => (
  <div className="space-y-5 pb-6">
    <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-5 animate-fade-in-up">
      <div className="flex flex-col gap-3">
        <div className="flex justify-between items-start gap-2">
          <div className="flex flex-col gap-1.5">
            <h2 className="text-2xl font-bold text-slate-900 capitalize">{med.name}</h2>
            <div className="flex items-center gap-1.5 flex-wrap">
              <AlertBadge level={med.warningLevel} />
              {isInList && (
                isInReserve ? (
                  <span className="inline-flex items-center gap-1 text-[11px] font-bold px-2 py-0.5 rounded-full bg-amber-100 text-amber-900 border border-amber-300">
                    <Package className="w-3 h-3 text-amber-700" />
                    En réserve (si besoin)
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1 text-[11px] font-medium px-2 py-0.5 rounded-full bg-blue-50 text-blue-800 border border-blue-200">
                    <Calendar className="w-3 h-3 text-blue-600" />
                    Traitement régulier
                  </span>
                )
              )}
            </div>
          </div>

          <div className="flex items-center gap-1.5 shrink-0">
            <button 
              onClick={onShare} 
              className="p-2 bg-slate-50 text-slate-500 hover:text-blue-600 rounded-xl border border-slate-100 shadow-sm transition-all"
              title="Partager"
            >
              <Share2 className="w-4 h-4" />
            </button>

            {isInList ? (
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={(e) => onToggleReserve(e, med.name)}
                  className={`py-2 px-2.5 rounded-xl border text-xs font-bold flex items-center gap-1.5 transition-all shadow-xs ${
                    isInReserve
                      ? 'bg-amber-100 text-amber-900 border-amber-300 hover:bg-amber-200'
                      : 'bg-slate-100 text-slate-700 border-slate-200 hover:bg-slate-200'
                  }`}
                  title={isInReserve ? "Actuellement classé en réserve (si besoin / secours). Cliquer pour passer en régulier." : "Cliquer pour mettre ce médicament en réserve."}
                >
                  <Package className={`w-3.5 h-3.5 ${isInReserve ? 'text-amber-700' : 'text-slate-400'}`} />
                  <span>{isInReserve ? 'En réserve' : 'En réserve ?'}</span>
                </button>

                <button 
                  type="button"
                  onClick={() => onAdd(false)}
                  className="p-2 px-2.5 rounded-xl border shadow-sm transition-all flex items-center gap-1 bg-emerald-50 text-emerald-700 border-emerald-200"
                  title="Traitement enregistré dans votre pharmacie"
                >
                  <CheckCircle className="w-4 h-4 text-emerald-600" />
                  <span className="text-xs font-bold uppercase hidden sm:inline">Suivi</span>
                </button>
              </div>
            ) : (
              <div className="flex items-center gap-1.5">
                <button 
                  type="button"
                  onClick={() => onAdd(true)}
                  className="py-2 px-2.5 rounded-xl border border-amber-300 bg-amber-50 text-amber-800 hover:bg-amber-100 text-xs font-bold flex items-center gap-1.5 transition-all shadow-xs active:scale-95"
                  title="Ajouter directement comme médicament en réserve (si besoin / secours)"
                >
                  <Package className="w-3.5 h-3.5 text-amber-600" />
                  <span>Réserve</span>
                </button>

                <button 
                  type="button"
                  onClick={() => onAdd(false)} 
                  className="py-2 px-3 rounded-xl border shadow-sm transition-all flex items-center gap-1.5 bg-blue-600 text-white hover:bg-blue-700 text-xs font-bold uppercase active:scale-95"
                  title="Ajouter comme traitement habituel / régulier"
                >
                  <PlusCircle className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline">Suivre</span>
                </button>
              </div>
            )}
          </div>
        </div>
        <p className="text-slate-600 text-sm leading-relaxed">{med.description}</p>
      </div>
      <div className="mt-4 pt-4 border-t border-slate-50">
        <div className="flex gap-3 text-sm text-blue-800 bg-blue-50/80 p-3 rounded-xl">
          <InfoIcon className="w-5 h-5 flex-shrink-0 mt-0.5 text-blue-600" />
          <span className="font-medium">{med.usageTips}</span>
        </div>
      </div>
    </div>

    <div className="space-y-4">
      <SectionCard title="Indications" items={med.indications} icon={Pill} variant="default" className="animate-fade-in-up delay-100" />
      {med.maxDailyDosage && (
        <MaxDosageCard dosageInfo={med.maxDailyDosage} className="animate-fade-in-up delay-150" />
      )}
      <DoseLogCard med={med} className="animate-fade-in-up delay-150" />
      <SectionCard title="Contre-indications" items={med.contraindications} icon={Ban} variant="danger" className="animate-fade-in-up delay-200" />
      <SectionCard title="Interactions" items={med.interactions} icon={Activity} variant="warning" className="animate-fade-in-up delay-300" />
    </div>

    {(med.warningLevel === 'high' || med.contraindications.length > 0) && (
      <div className="animate-fade-in-up delay-500">
        <Alternatives alternatives={med.alternatives} onSelect={onSearch} />
      </div>
    )}
  </div>
);
