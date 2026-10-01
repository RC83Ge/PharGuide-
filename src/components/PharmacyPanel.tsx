import React, { useState } from 'react';
import {
  Calendar,
  Database,
  FileText,
  HardDrive,
  Package,
  Pill,
  ShieldCheck,
  Stethoscope,
  Trash2,
  UserCircle
} from 'lucide-react';
import { MedicationInfo } from '../types';
import { PharmacyInteractions } from './PharmacyInteractions';

interface PharmacyPanelProps {
  medications: MedicationInfo[];
  userContext: string;
  onUserContextChange: (value: string) => void;
  isDbReady: boolean;
  onExportPDF: () => void;
  onExportText: () => void;
  onSelect: (med: MedicationInfo) => void;
  onToggleReserve: (e: React.MouseEvent, medName: string) => void;
  onRemove: (e: React.MouseEvent, medName: string) => void;
  onClose: () => void;
}

type PharmacyTab = 'all' | 'regular' | 'reserve';

export const PharmacyPanel: React.FC<PharmacyPanelProps> = ({
  medications,
  userContext,
  onUserContextChange,
  isDbReady,
  onExportPDF,
  onExportText,
  onSelect,
  onToggleReserve,
  onRemove,
  onClose
}) => {
  const [pharmacyTab, setPharmacyTab] = useState<PharmacyTab>('all');

  const regularMeds = medications.filter(m => !m.isReserve);
  const reserveMeds = medications.filter(m => m.isReserve);
  const displayedMeds = pharmacyTab === 'regular'
    ? regularMeds
    : pharmacyTab === 'reserve'
      ? reserveMeds
      : medications;

  return (
    <div className="absolute top-full left-0 w-full bg-white border-b border-slate-200 shadow-2xl z-40 animate-fade-in-up max-h-[85vh] overflow-y-auto no-scrollbar">
      <div className="p-4 space-y-5">
        {/* En-tête avec statut de synchronisation */}
        <div className="flex items-center justify-between pb-2 border-b border-slate-100">
          <div>
            <h2 className="text-sm font-bold text-slate-800 flex items-center gap-2">
              <Pill className="w-4 h-4 text-blue-600" /> Ma Pharmacie
            </h2>
            <p className="text-[10px] text-slate-500">Persistance locale permanente sur votre appareil</p>
          </div>
          <div className="flex items-center gap-1.5">
            {isDbReady ? (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
                <Database className="w-3 h-3 text-emerald-600" />
                IndexedDB synchronisé
              </span>
            ) : (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-amber-50 text-amber-700 border border-amber-200">
                <HardDrive className="w-3 h-3 text-amber-600" />
                Stockage local
              </span>
            )}
          </div>
        </div>

        {/* Bloc d'export et bilan médical */}
        <div className="bg-slate-50 p-3 rounded-xl border border-slate-200/80 space-y-2.5">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
              <ShieldCheck className="w-4 h-4 text-emerald-600" />
              Bilan & Partage Médical
            </span>
            <span className="text-[9px] text-blue-700 bg-blue-50 px-1.5 py-0.5 rounded border border-blue-200/60 font-semibold">
              Format Imprimable
            </span>
          </div>

          <p className="text-[10px] text-slate-500 leading-relaxed">
            Générez une fiche récapitulative officielle de vos traitements et antécédents, prête à imprimer ou à présenter à votre médecin traitant ou pharmacien.
          </p>

          <div className="grid grid-cols-2 gap-2 pt-0.5">
            <button 
              onClick={onExportPDF}
              className="py-2 px-3 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-bold flex items-center justify-center gap-2 shadow-xs transition-all active:scale-95"
              title="Télécharger votre bilan en document PDF imprimable"
            >
              <FileText className="w-4 h-4 shrink-0" />
              <span>Fiche PDF (.pdf)</span>
            </button>

            <button 
              onClick={onExportText}
              className="py-2 px-3 bg-white border border-slate-200 hover:border-slate-300 text-slate-700 hover:text-slate-900 rounded-lg text-xs font-semibold flex items-center justify-center gap-1.5 shadow-2xs transition-all active:scale-95"
              title="Copier ou exporter le résumé texte simple"
            >
              <Stethoscope className="w-3.5 h-3.5 text-slate-500 shrink-0" />
              <span>Fiche TXT</span>
            </button>
          </div>
        </div>

        {/* Profil Santé */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <h3 className="text-[10px] font-bold uppercase tracking-widest text-slate-400 flex items-center gap-2">
              <UserCircle className="w-3.5 h-3.5 text-blue-600" /> Mon Profil Santé (Antécédents & Allergies)
            </h3>
          </div>
          <textarea 
            className="w-full p-2.5 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all placeholder:italic"
            placeholder="Ex: Allergique à la pénicilline, asthme, hypertension, enceinte..."
            rows={2}
            value={userContext}
            onChange={(e) => onUserContextChange(e.target.value)}
          />
          <p className="text-[9px] text-slate-400 italic">Mémorisé de façon permanente dans IndexedDB pour ajuster les analyses posologiques de l'IA.</p>
        </div>

        {/* Mes Médicaments */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-[10px] font-bold uppercase tracking-widest text-slate-400 flex items-center gap-2">
              <Pill className="w-3.5 h-3.5 text-blue-600" /> Mes Médicaments ({medications.length})
            </h3>
            {medications.length > 0 && (
              <span className="text-[9px] font-medium text-slate-400">
                Cliquez pour afficher la notice
              </span>
            )}
          </div>

          {medications.length > 0 && (
            <div className="flex items-center gap-1 p-1 bg-slate-100/90 rounded-xl border border-slate-200/60">
              <button
                type="button"
                onClick={() => setPharmacyTab('all')}
                className={`flex-1 py-1.5 text-xs font-semibold rounded-lg transition-all text-center ${
                  pharmacyTab === 'all'
                    ? 'bg-white text-slate-900 shadow-2xs font-bold'
                    : 'text-slate-500 hover:text-slate-800'
                }`}
              >
                Tous ({medications.length})
              </button>
              <button
                type="button"
                onClick={() => setPharmacyTab('regular')}
                className={`flex-1 py-1.5 text-xs font-semibold rounded-lg transition-all flex items-center justify-center gap-1 ${
                  pharmacyTab === 'regular'
                    ? 'bg-white text-blue-700 shadow-2xs font-bold'
                    : 'text-slate-500 hover:text-slate-800'
                }`}
              >
                <Calendar className="w-3 h-3 text-blue-600" />
                <span>Réguliers ({regularMeds.length})</span>
              </button>
              <button
                type="button"
                onClick={() => setPharmacyTab('reserve')}
                className={`flex-1 py-1.5 text-xs font-semibold rounded-lg transition-all flex items-center justify-center gap-1 ${
                  pharmacyTab === 'reserve'
                    ? 'bg-white text-amber-700 shadow-2xs font-bold'
                    : 'text-slate-500 hover:text-slate-800'
                }`}
              >
                <Package className="w-3 h-3 text-amber-600" />
                <span>En réserve ({reserveMeds.length})</span>
              </button>
            </div>
          )}

          {medications.length > 0 ? (
            displayedMeds.length > 0 ? (
              <div className="grid grid-cols-1 gap-2">
                {displayedMeds.map((med, idx) => (
                  <div 
                    key={idx}
                    onClick={() => onSelect(med)}
                    className="flex items-center justify-between p-3 bg-slate-50 hover:bg-blue-50/80 border border-slate-100 rounded-xl cursor-pointer transition-all group"
                  >
                    <div className="flex items-center gap-3">
                      <div className={`w-2.5 h-2.5 rounded-full shrink-0 ${med.warningLevel === 'high' ? 'bg-red-500' : med.warningLevel === 'medium' ? 'bg-orange-500' : 'bg-emerald-500'}`} />
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-semibold text-slate-800">{med.name}</span>
                        </div>
                        <div className="flex items-center gap-1.5 mt-1 flex-wrap">
                          {med.maxDailyDosage?.generalMax && (
                            <span className="text-[10px] text-amber-700 bg-amber-50 px-1.5 py-0.5 rounded border border-amber-200/50 font-medium inline-block">
                              Max : {med.maxDailyDosage.generalMax}
                            </span>
                          )}
                          <button
                            type="button"
                            onClick={(e) => onToggleReserve(e, med.name)}
                            className={`text-[10px] font-bold px-2 py-0.5 rounded-md border flex items-center gap-1 transition-all ${
                              med.isReserve
                                ? 'bg-amber-100 text-amber-900 border-amber-300 hover:bg-amber-200'
                                : 'bg-slate-100 text-slate-600 border-slate-200 hover:bg-slate-200'
                            }`}
                            title={med.isReserve ? "Médicament de réserve (si besoin / secours). Cliquer pour basculer en régulier." : "Traitement habituel. Cliquer pour mettre en réserve."}
                          >
                            <Package className={`w-3 h-3 ${med.isReserve ? 'text-amber-700' : 'text-slate-400'}`} />
                            <span>{med.isReserve ? 'En réserve' : 'Régulier'}</span>
                          </button>
                        </div>
                      </div>
                    </div>
                    <button 
                      onClick={(e) => onRemove(e, med.name)}
                      className="p-1.5 text-slate-300 hover:text-red-500 hover:bg-red-50 rounded-lg transition-all"
                      title="Retirer de ma pharmacie"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-xs text-slate-400 text-center py-5 italic border border-dashed border-slate-200 rounded-xl bg-slate-50/50">
                {pharmacyTab === 'reserve' ? (
                  <>
                    <p className="font-semibold text-slate-600 not-italic">Aucun médicament en réserve</p>
                    <p className="text-[10px] text-slate-400 mt-1 not-italic">Cliquez sur « Régulier » pour basculer un médicament en réserve, ou ajoutez-en un avec l'option « En réserve ».</p>
                  </>
                ) : (
                  <>
                    <p className="font-semibold text-slate-600 not-italic">Aucun traitement régulier</p>
                    <p className="text-[10px] text-slate-400 mt-1 not-italic">Tous vos médicaments enregistrés sont actuellement classés en réserve.</p>
                  </>
                )}
              </div>
            )
          ) : (
            <div className="text-xs text-slate-400 text-center py-6 italic border border-dashed border-slate-200 rounded-xl bg-slate-50/50">
              <p>Aucun médicament enregistré.</p>
              <p className="text-[10px] text-slate-400 mt-1 not-italic">Recherchez un médicament et cliquez sur « Suivre » ou « En réserve ».</p>
            </div>
          )}
        </div>

        {/* Interactions entre mes médicaments */}
        <PharmacyInteractions
          medicationNames={medications.map(m => m.name)}
          userContext={userContext}
        />

        <button 
          onClick={onClose}
          className="w-full py-2 bg-slate-100 text-slate-600 rounded-xl text-xs font-bold uppercase tracking-wider hover:bg-slate-200 transition-all"
        >
          Fermer
        </button>
      </div>
    </div>
  );
};
