import React, { useState } from 'react';
import { LucideIcon, ChevronDown, ChevronUp } from 'lucide-react';

interface SectionCardProps {
  title: string;
  items: string[];
  icon: LucideIcon;
  variant: 'default' | 'danger' | 'warning' | 'success';
  className?: string;
  initialVisibleCount?: number;
}

export const SectionCard: React.FC<SectionCardProps> = ({ 
  title, 
  items, 
  icon: Icon, 
  variant, 
  className = '',
  initialVisibleCount = 3 
}) => {
  const [isExpanded, setIsExpanded] = useState(false);

  const getColors = () => {
    switch (variant) {
      case 'danger': return 'bg-red-50 border-red-100 text-red-900 icon-red-600';
      case 'warning': return 'bg-orange-50 border-orange-100 text-orange-900 icon-orange-600';
      case 'success': return 'bg-emerald-50 border-emerald-100 text-emerald-900 icon-emerald-600';
      default: return 'bg-white border-slate-100 text-slate-800 icon-blue-600';
    }
  };

  const colors = getColors();
  const iconColor = colors.split(' ').find(c => c.startsWith('icon-'))?.replace('icon-', 'text-') || 'text-slate-600';

  const shouldCollapse = items.length > initialVisibleCount;
  const displayedItems = shouldCollapse && !isExpanded 
    ? items.slice(0, initialVisibleCount) 
    : items;

  return (
    <div className={`p-5 rounded-2xl border ${colors.split(' ').slice(0, 2).join(' ')} shadow-sm transition-all duration-300 ${className}`}>
      <div className="flex items-center justify-between gap-3 mb-3">
        <div className="flex items-center gap-3">
          <div className={`p-2 rounded-lg bg-white/80 shadow-sm ${iconColor}`}>
            <Icon className="w-5 h-5" />
          </div>
          <h3 className={`text-base font-bold tracking-tight ${colors.split(' ')[2]}`}>{title}</h3>
        </div>

        {items.length > 0 && (
          <span className="text-xs text-slate-400 font-medium px-2 py-0.5 bg-slate-100/70 rounded-full">
            {items.length}
          </span>
        )}
      </div>

      <ul className="space-y-2">
        {items.length > 0 ? (
          <>
            {displayedItems.map((item, idx) => (
              <li key={idx} className="flex items-start gap-2.5 text-slate-700 text-sm">
                <span className={`mt-1.5 w-1.5 h-1.5 rounded-full flex-shrink-0 ${iconColor.replace('text', 'bg')}`} />
                <span className="leading-snug">{item}</span>
              </li>
            ))}

            {shouldCollapse && (
              <li className="pt-1.5">
                <button
                  type="button"
                  onClick={() => setIsExpanded(!isExpanded)}
                  className="w-full py-1.5 px-3 text-xs font-semibold text-slate-600 hover:text-slate-800 bg-slate-50 hover:bg-slate-100/80 rounded-xl flex items-center justify-center gap-1.5 transition-colors border border-slate-200/50"
                >
                  <span>
                    {isExpanded 
                      ? "Masquer les indications supplémentaires" 
                      : `Voir plus d'indications (+${items.length - initialVisibleCount})`}
                  </span>
                  {isExpanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                </button>
              </li>
            )}
          </>
        ) : (
          <li className="text-slate-400 italic text-xs">Aucune donnée spécifique listée.</li>
        )}
      </ul>
    </div>
  );
};
