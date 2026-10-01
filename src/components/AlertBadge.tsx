import React from 'react';
import { TriangleAlert, Info, ShieldCheck } from 'lucide-react';

interface AlertBadgeProps {
  level: 'high' | 'medium' | 'low';
}

export const AlertBadge: React.FC<AlertBadgeProps> = ({ level }) => {
  if (level === 'high') {
    return (
      <div className="flex items-center gap-2 bg-red-50 text-red-700 px-3 py-1.5 rounded-full border border-red-100">
        <TriangleAlert className="w-4 h-4" />
        <span className="text-sm font-semibold">Vigilance Requise</span>
      </div>
    );
  }

  if (level === 'medium') {
    return (
      <div className="flex items-center gap-2 bg-orange-50 text-orange-700 px-3 py-1.5 rounded-full border border-orange-100">
        <Info className="w-4 h-4" />
        <span className="text-sm font-medium">Précautions d'emploi</span>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-2 bg-emerald-50 text-emerald-700 px-3 py-1.5 rounded-full border border-emerald-100">
      <ShieldCheck className="w-4 h-4" />
      <span className="text-sm font-medium">Usage courant</span>
    </div>
  );
};
