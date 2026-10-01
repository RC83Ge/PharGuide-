import React from 'react';
import { ArrowRightLeft, Search } from 'lucide-react';

interface AlternativesProps {
  alternatives: string[];
  onSelect: (name: string) => void;
}

export const Alternatives: React.FC<AlternativesProps> = ({ alternatives, onSelect }) => {
  if (!alternatives || alternatives.length === 0) return null;

  return (
    <div className="mt-8 p-6 bg-slate-800 rounded-2xl text-white shadow-xl">
      <div className="flex items-center gap-3 mb-4">
        <ArrowRightLeft className="w-6 h-6 text-blue-300" />
        <h3 className="text-lg font-bold text-blue-50">Alternatives Possibles</h3>
      </div>
      
      <p className="text-slate-300 text-sm mb-4">
        Si ce médicament est contre-indiqué, voici des substances souvent considérées comme alternatives. Cliquez pour consulter leur fiche :
      </p>

      <div className="flex flex-wrap gap-2">
        {alternatives.map((alt, index) => (
          <button
            key={index}
            onClick={() => onSelect(alt)}
            className="flex items-center gap-2 px-3 py-2 bg-slate-700/50 border border-slate-600 rounded-lg text-sm font-medium text-blue-100 hover:bg-blue-600 hover:border-blue-500 hover:text-white transition-all cursor-pointer text-left active:scale-95 group"
            title={`Voir la fiche de ${alt}`}
          >
            <Search className="w-3 h-3 opacity-50 group-hover:opacity-100 transition-opacity" />
            {alt}
          </button>
        ))}
      </div>
    </div>
  );
};
