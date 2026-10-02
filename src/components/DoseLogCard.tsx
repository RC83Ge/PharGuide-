import React, { useEffect, useMemo, useState } from 'react';
import { toast } from 'sonner';
import { AlertTriangle, ClipboardList, Clock, Plus, Trash2 } from 'lucide-react';
import { MedicationInfo } from '../types';
import { getDoseLogFromDB, normalizeMedKey, saveDoseLogToDB } from '../services/indexedDbService';
import { DoseEntry, formatMg, nextSafeTime, parseMaxDailyMg, summarizeLast24h } from '../utils/doseLog';

interface DoseLogCardProps {
  med: MedicationInfo;
  className?: string;
}

const formatTime = (ts: number): string => {
  const date = new Date(ts);
  const time = date.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const dayOffset = Math.round((new Date(date).setHours(0, 0, 0, 0) - today.getTime()) / 86400000);
  if (dayOffset === 0) return time;
  if (dayOffset === 1) return `demain ${time}`;
  if (dayOffset === -1) return `hier ${time}`;
  return `${date.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })} ${time}`;
};

const formatElapsed = (ms: number): string => {
  const minutes = Math.max(0, Math.floor(ms / 60000));
  if (minutes < 1) return "à l'instant";
  if (minutes < 60) return `il y a ${minutes} min`;
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  return `il y a ${rest ? `${hours} h ${rest.toString().padStart(2, '0')}` : `${hours} h`}`;
};

const LEVEL_STYLES = {
  ok: { bar: 'bg-emerald-500', text: 'text-emerald-800' },
  near: { bar: 'bg-amber-500', text: 'text-amber-800' },
  over: { bar: 'bg-red-600', text: 'text-red-700' },
  unknown: { bar: 'bg-slate-400', text: 'text-slate-700' }
};

export const DoseLogCard: React.FC<DoseLogCardProps> = ({ med, className = '' }) => {
  const medKey = normalizeMedKey(med.name);
  const maxMg = useMemo(() => parseMaxDailyMg(med.maxDailyDosage?.generalMax), [med.maxDailyDosage]);
  const [log, setLog] = useState<DoseEntry[]>([]);
  const [doseInput, setDoseInput] = useState('');
  const [now, setNow] = useState(Date.now());

  useEffect(() => {
    let cancelled = false;
    getDoseLogFromDB().then(entries => {
      if (cancelled) return;
      setLog(entries);
      const last = entries.filter(e => e.medKey === medKey).sort((a, b) => b.takenAt - a.takenAt)[0];
      setDoseInput(last ? String(last.doseMg) : '');
    });
    return () => { cancelled = true; };
  }, [medKey]);

  // Les prises sortent de la fenêtre de 24 h au fil du temps
  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 60000);
    return () => window.clearInterval(timer);
  }, []);

  const summary = summarizeLast24h(log, medKey, maxMg, now);
  const styles = LEVEL_STYLES[summary.level];
  const doseMg = Number(doseInput.replace(',', '.'));
  const isDoseValid = Number.isFinite(doseMg) && doseMg > 0;
  const medEntries = log.filter(e => e.medKey === medKey);
  const wouldExceed = isDoseValid && maxMg !== null && summary.totalMg + doseMg > maxMg;
  const safeAt = wouldExceed ? nextSafeTime(medEntries, doseMg, maxMg, now) : null;

  const updateLog = (entries: DoseEntry[]) => {
    setLog(entries);
    saveDoseLogToDB(entries);
  };

  const addDose = () => {
    if (!isDoseValid) {
      toast.error('Indiquez la dose prise en mg.');
      return;
    }
    const takenAt = Date.now();
    const entry: DoseEntry = { id: `${takenAt}-${Math.random().toString(36).slice(2, 8)}`, medKey, medName: med.name, doseMg, takenAt };
    const next = [entry, ...log];
    updateLog(next);
    setNow(takenAt);

    const after = summarizeLast24h(next, medKey, maxMg, takenAt);
    if (after.level === 'over') {
      toast.error(`Dose maximale dépassée : ${formatMg(after.totalMg)} sur 24 h (max ${formatMg(maxMg!)}). Demandez conseil à un pharmacien ou appelez le 15 en cas de doute.`, { duration: 10000 });
    } else if (after.level === 'near') {
      toast.warning(`Attention : ${formatMg(after.totalMg)} pris sur 24 h, proche du maximum de ${formatMg(maxMg!)}.`);
    } else {
      toast.success(`Prise de ${formatMg(doseMg)} enregistrée.`);
    }
  };

  const removeDose = (id: string) => updateLog(log.filter(e => e.id !== id));

  return (
    <div className={`p-4 rounded-2xl bg-white border border-slate-200 shadow-xs space-y-3 ${className}`}>
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <div className="p-1.5 rounded-lg bg-indigo-50 text-indigo-600 border border-indigo-100">
            <ClipboardList className="w-4 h-4" />
          </div>
          <h3 className="text-sm font-bold text-slate-800 whitespace-nowrap">Journal des prises</h3>
        </div>
        {summary.lastTakenAt !== null && (
          <span className="inline-flex items-center gap-1 text-[11px] text-slate-500">
            <Clock className="w-3 h-3" />
            Dernière prise {formatElapsed(now - summary.lastTakenAt)}
          </span>
        )}
      </div>

      <div className="space-y-1.5">
        <div className="flex items-baseline justify-between text-xs">
          <span className="text-slate-600">Total sur les dernières 24 h</span>
          <span className={`font-bold ${styles.text}`}>
            {formatMg(summary.totalMg)}{maxMg !== null && ` / ${formatMg(maxMg)}`}
          </span>
        </div>
        {maxMg !== null ? (
          <div className="h-2 rounded-full bg-slate-100 overflow-hidden" role="progressbar" aria-valuenow={Math.round((summary.ratio ?? 0) * 100)} aria-valuemin={0} aria-valuemax={100}>
            <div className={`h-full ${styles.bar} transition-all`} style={{ width: `${Math.min(100, (summary.ratio ?? 0) * 100)}%` }} />
          </div>
        ) : (
          <p className="text-[11px] text-slate-500">
            Dose maximale non chiffrée en mg pour ce médicament : le total est affiché sans alerte.
          </p>
        )}
        {summary.level === 'over' && (
          <p className="flex items-start gap-1.5 text-xs font-semibold text-red-700 bg-red-50 border border-red-200 rounded-lg p-2">
            <AlertTriangle className="w-3.5 h-3.5 mt-0.5 shrink-0" />
            Dose maximale sur 24 h dépassée. Ne reprenez pas ce médicament et demandez conseil à un pharmacien, ou appelez le 15 en cas de malaise.
          </p>
        )}
      </div>

      <div className="flex items-center gap-2">
        <div className="relative flex-1">
          <input
            type="number"
            inputMode="decimal"
            min="0"
            step="any"
            value={doseInput}
            onChange={(e) => setDoseInput(e.target.value)}
            placeholder="Dose prise"
            aria-label="Dose prise en mg"
            className="w-full py-2 pl-3 pr-10 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-200"
          />
          <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-slate-400">mg</span>
        </div>
        <button
          type="button"
          onClick={addDose}
          className="py-2 px-3 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold flex items-center gap-1.5 active:scale-95 transition-all"
        >
          <Plus className="w-3.5 h-3.5" />
          Prise maintenant
        </button>
      </div>

      {wouldExceed && (
        <p className="text-[11px] font-medium text-amber-800 bg-amber-50 border border-amber-200 rounded-lg p-2">
          Cette prise ferait dépasser la dose maximale sur 24 h
          {safeAt ? `. Elle sera possible à partir de ${formatTime(safeAt)}.` : '.'}
        </p>
      )}

      {summary.entries.length > 0 && (
        <ul className="divide-y divide-slate-100 border-t border-slate-100">
          {summary.entries.map(entry => (
            <li key={entry.id} className="flex items-center justify-between py-1.5 text-xs">
              <span className="text-slate-600">{formatTime(entry.takenAt)}</span>
              <span className="flex items-center gap-2">
                <span className="font-semibold text-slate-800">{formatMg(entry.doseMg)}</span>
                <button
                  type="button"
                  onClick={() => removeDose(entry.id)}
                  className="p-1 text-slate-400 hover:text-red-600"
                  title="Supprimer cette prise"
                  aria-label="Supprimer cette prise"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
};
