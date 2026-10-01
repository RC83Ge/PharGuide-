import React from 'react';
import { BookOpen, LifeBuoy, PlusCircle } from 'lucide-react';

interface InfoPanelProps {
  canInstall: boolean;
  onInstall: () => void;
  onClose: () => void;
}

export const InfoPanel: React.FC<InfoPanelProps> = ({ canInstall, onInstall, onClose }) => (
  <div className="absolute top-full left-0 w-full bg-white border-b border-slate-200 shadow-2xl z-40 animate-fade-in-up max-h-[80vh] overflow-y-auto no-scrollbar">
    <div className="p-5 space-y-6">
      <div className="space-y-3">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-blue-50 rounded-lg text-blue-600"><BookOpen className="w-5 h-5" /></div>
          <h3 className="font-bold text-sm text-slate-800 uppercase tracking-tight">À propos de PharmaGuide</h3>
        </div>
        <p className="text-xs text-slate-600 leading-relaxed text-justify">
          PharmaGuide utilise l'intelligence artificielle pour simplifier les notices médicales complexes. Notre mission est de vous offrir une vision claire et immédiate des bénéfices et des risques de vos traitements pour une meilleure sécurité au quotidien.
        </p>
      </div>

      <div className="space-y-3 pt-4 border-t border-slate-50">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-emerald-50 rounded-lg text-emerald-600"><LifeBuoy className="w-5 h-5" /></div>
          <h3 className="font-bold text-sm text-slate-800 uppercase tracking-tight">Guide d'utilisation</h3>
        </div>
        <ul className="space-y-3 text-xs text-slate-600">
          <li className="flex gap-3"><span className="flex-shrink-0 w-5 h-5 bg-blue-100 text-blue-700 rounded-full flex items-center justify-center font-bold text-[10px]">1</span> Recherchez un médicament par son nom ou utilisez le bouton micro.</li>
          <li className="flex gap-3"><span className="flex-shrink-0 w-5 h-5 bg-blue-100 text-blue-700 rounded-full flex items-center justify-center font-bold text-[10px]">2</span> Consultez les fiches simplifiées : Indications, Contre-indications et Interactions.</li>
          <li className="flex gap-3"><span className="flex-shrink-0 w-5 h-5 bg-blue-100 text-blue-700 rounded-full flex items-center justify-center font-bold text-[10px]">3</span> "Suivez" vos traitements dans "Ma Pharmacie" pour les retrouver instantanément.</li>
          <li className="flex gap-3"><span className="flex-shrink-0 w-5 h-5 bg-blue-100 text-blue-700 rounded-full flex items-center justify-center font-bold text-[10px]">4</span> Complétez votre profil (allergies, etc.) pour des alertes personnalisées.</li>
        </ul>
      </div>

      {canInstall && (
        <div className="pt-4 border-t border-slate-50 animate-fade-in">
          <button 
            onClick={onInstall}
            className="w-full p-4 bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-2xl shadow-lg shadow-blue-200 flex items-center justify-center gap-3 active:scale-95 transition-all"
          >
            <PlusCircle className="w-5 h-5" />
            <div className="text-left">
              <div className="font-bold text-sm">Installer l'application</div>
              <div className="text-[10px] opacity-80">Accès rapide depuis votre écran d'accueil</div>
            </div>
          </button>
        </div>
      )}

      <div className="pt-2 border-t border-slate-50">
        <button 
          onClick={onClose}
          className="w-full py-2 bg-indigo-50 text-indigo-600 rounded-xl text-xs font-bold uppercase tracking-wider hover:bg-indigo-100 transition-all"
        >
          J'ai compris
        </button>
      </div>
    </div>
  </div>
);
