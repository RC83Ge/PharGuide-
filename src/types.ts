export interface DosagePerIndication {
  indication: string; // Ex: "Douleurs et fièvre chez l'adulte (> 50 kg)"
  maxDaily: string; // Ex: "3 000 mg (3 g) par jour"
  frequencyOrInterval?: string; // Ex: "500 mg à 1000 mg par prise, espacer de 4 à 6 heures minimum"
  notes?: string; // Précisions ou restrictions (ex: "Enfant : 60 mg/kg/jour en prises fractionnées")
}

export interface MaxDailyDosageInfo {
  generalMax: string; // Synthèse du dosage maximal absolu par 24h
  byIndication: DosagePerIndication[]; // Dosage maximum détaillé selon les indications
  safetyWarning?: string; // Avertissement surdosage / toxicité
}

export interface MedicationInfo {
  name: string;
  description: string;
  indications: string[]; // Soulagement / Ce que ça traite
  maxDailyDosage?: MaxDailyDosageInfo; // Dosage maximum par jour selon indications
  contraindications: string[]; // Quand ne pas le prendre
  interactions: string[]; // Interactions (alcool, autres meds)
  alternatives: string[]; // Médicaments alternatifs
  warningLevel: 'low' | 'medium' | 'high'; // Niveau d'alerte général
  usageTips: string; // Conseils d'utilisation brefs
  isReserve?: boolean; // Médicament en réserve / si besoin (secours ou prise ponctuelle)
}

export interface SearchState {
  query: string;
  loading: boolean;
  error: string | null;
  data: MedicationInfo | null;
}