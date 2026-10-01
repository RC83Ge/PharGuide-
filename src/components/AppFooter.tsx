import React from 'react';
import { ShieldAlert, Stethoscope } from 'lucide-react';

export const AppFooter: React.FC = () => (
  <footer className="mt-8 space-y-8">
    <div className="bg-orange-50/80 border border-orange-200 rounded-2xl p-5 relative overflow-hidden group shadow-sm transition-all hover:bg-orange-50">
      <div className="absolute top-0 right-0 p-4 opacity-5 group-hover:scale-110 group-hover:opacity-10 transition-all">
        <Stethoscope className="w-16 h-16 text-orange-900" />
      </div>
      <div className="flex items-start gap-4">
        <div className="mt-1 p-2 bg-white rounded-full text-orange-600 border border-orange-100 flex-shrink-0 shadow-sm"><ShieldAlert className="w-5 h-5" /></div>
        <div className="space-y-2">
          <h4 className="text-sm font-bold text-orange-900 flex items-center gap-2">Avertissement Médical</h4>
          <p className="text-[11px] leading-relaxed text-orange-800/80 italic font-medium">
            Les informations fournies par cette intelligence artificielle sont à titre informatif uniquement et ne constituent pas un avis médical professionnel.
          </p>
          <div className="pt-2 border-t border-orange-200/50">
            <p className="text-[11px] text-orange-950 font-bold">
              Consultez systématiquement votre médecin ou votre pharmacien avant de prendre, d'arrêter ou de modifier un traitement.
            </p>
          </div>
        </div>
      </div>
    </div>

    {/* Copyright & Branding Simple - Agrandi et plus visible */}
    <div className="flex flex-col items-center justify-center space-y-3 py-10">
      <div className="h-px w-20 bg-indigo-200 mb-2"></div>
      <p className="text-sm sm:text-base text-indigo-700 font-black uppercase tracking-[0.25em]">
        @2026 PharmaGuide
      </p>
      <div className="flex items-center gap-2 text-slate-500 font-semibold text-xs sm:text-sm tracking-wide">
        <span className="w-1.5 h-1.5 bg-blue-500 rounded-full animate-pulse"></span>
        Votre santé, notre priorité
        <span className="w-1.5 h-1.5 bg-blue-500 rounded-full animate-pulse"></span>
      </div>
      <p className="text-[10px] sm:text-xs text-slate-400 font-medium uppercase tracking-widest opacity-80 pt-1">
        Données Sécurisées • IA Médicale
      </p>
    </div>

    <div className="h-10"></div>
  </footer>
);
