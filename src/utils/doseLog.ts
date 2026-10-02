// Journal des prises : calcul du total sur 24 heures glissantes par rapport à la dose maximale.

export interface DoseEntry {
  id: string;
  medKey: string; // Nom normalisé du médicament
  medName: string;
  doseMg: number;
  takenAt: number; // Horodatage en millisecondes
}

export type DoseLevel = 'ok' | 'near' | 'over' | 'unknown';

export interface DoseSummary {
  entries: DoseEntry[]; // Prises des dernières 24 h, la plus récente d'abord
  totalMg: number;
  maxMg: number | null;
  ratio: number | null;
  level: DoseLevel;
  lastTakenAt: number | null;
}

export const DAY_MS = 24 * 60 * 60 * 1000;
export const NEAR_RATIO = 0.8;
// Les prises plus anciennes ne servent plus au calcul et sont oubliées
export const RETENTION_MS = 7 * DAY_MS;

const NUMBER = String.raw`\d+(?:[   ]\d{3})*(?:[.,]\d+)?`;
const UNIT = String.raw`mg|g|µg|μg|mcg`;
// Une quantité ("3 000 mg") ou une fourchette ("20 mg à 40 mg", "2 à 3 g"), hors doses par kilo
const MASS_RE = new RegExp(
  String.raw`(${NUMBER})\s*(?:(${UNIT})\s*)?(?:(?:à|-)\s*(${NUMBER})\s*)?(${UNIT})(?![a-zà-ÿ])(?!\s*\/\s*kg)`,
  'i'
);

const toNumber = (raw: string): number => Number(raw.replace(/[   ]/g, '').replace(',', '.'));

const toMg = (value: number, unit: string): number => {
  const u = unit.toLowerCase();
  if (u === 'g') return value * 1000;
  if (u === 'mg') return value;
  return value / 1000; // µg / mcg
};

// Extrait la dose maximale en mg d'un texte comme "3 000 mg (3 g) par jour".
// Pour une fourchette, on garde la borne haute. Renvoie null si aucune masse n'est lisible
// (bouffées, sachets, dose par kilo...).
export function parseMaxDailyMg(text: string | undefined | null): number | null {
  if (!text) return null;
  const match = text.match(MASS_RE);
  if (!match) return null;
  const [, first, firstUnit, second, unit] = match;
  // "2 à 3 g" : seule la borne haute porte l'unité ; "2000 mg à 3000 mg" : chaque borne a la sienne
  const low = toMg(toNumber(first), firstUnit ?? unit);
  const value = second ? Math.max(low, toMg(toNumber(second), unit)) : low;
  return Number.isFinite(value) && value > 0 ? value : null;
}

export function summarizeLast24h(entries: DoseEntry[], medKey: string, maxMg: number | null, now = Date.now()): DoseSummary {
  const recent = entries
    .filter(e => e.medKey === medKey && e.takenAt <= now && now - e.takenAt < DAY_MS)
    .sort((a, b) => b.takenAt - a.takenAt);
  const totalMg = recent.reduce((sum, e) => sum + e.doseMg, 0);
  const ratio = maxMg ? totalMg / maxMg : null;
  const level: DoseLevel = ratio === null ? 'unknown' : ratio > 1 ? 'over' : ratio >= NEAR_RATIO ? 'near' : 'ok';

  return {
    entries: recent,
    totalMg,
    maxMg,
    ratio,
    level,
    lastTakenAt: recent[0]?.takenAt ?? null
  };
}

// Heure à partir de laquelle une nouvelle dose ne fait plus dépasser le maximum sur 24 h
export function nextSafeTime(entries: DoseEntry[], doseMg: number, maxMg: number, now = Date.now()): number | null {
  const recent = entries.filter(e => now - e.takenAt < DAY_MS).sort((a, b) => a.takenAt - b.takenAt);
  let total = recent.reduce((sum, e) => sum + e.doseMg, 0);
  if (total + doseMg <= maxMg) return null;
  for (const e of recent) {
    total -= e.doseMg;
    if (total + doseMg <= maxMg) return e.takenAt + DAY_MS;
  }
  return null; // La dose seule dépasse déjà le maximum
}

export const pruneOldEntries = (entries: DoseEntry[], now = Date.now()): DoseEntry[] =>
  entries.filter(e => now - e.takenAt < RETENTION_MS);

export const formatMg = (mg: number): string =>
  mg >= 1000 ? `${(mg / 1000).toLocaleString('fr-FR', { maximumFractionDigits: 2 })} g` : `${mg.toLocaleString('fr-FR', { maximumFractionDigits: 2 })} mg`;
