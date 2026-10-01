import { MedicationInfo } from '../types';

// Génère et télécharge le bilan texte (.txt) de la pharmacie et du profil santé
export function downloadPharmacyText(medications: MedicationInfo[], userContext: string) {
  let text = `RAPPORT PHARMAGUIDE - ${new Date().toLocaleDateString('fr-FR')}\n`;
  text += `==========================================\n\n`;
  text += `PROFIL SANTÉ :\n`;
  text += `${userContext || "Non renseigné"}\n\n`;
  text += `LISTE DES MÉDICAMENTS :\n`;

  if (medications.length > 0) {
    medications.forEach((med, i) => {
      text += `${i + 1}. ${med.name.toUpperCase()} [${med.isReserve ? 'EN RÉSERVE / SI BESOIN' : 'TRAITEMENT RÉGULIER'}]\n`;
      text += `   - Niveau d'alerte : ${med.warningLevel === 'high' ? 'Élevé' : med.warningLevel === 'medium' ? 'Modéré' : 'Faible'}\n`;
      if (med.maxDailyDosage?.generalMax) {
        text += `   - Dosage max / 24h : ${med.maxDailyDosage.generalMax}\n`;
      }
      text += `   - Description : ${med.description}\n\n`;
    });
  } else {
    text += `Aucun médicament enregistré.\n`;
  }

  text += `\n------------------------------------------\n`;
  text += `Généré par PharmaGuide - Assistant IA Médical`;

  const blob = new Blob([text], { type: 'text/plain' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `pharmaguide_export_${new Date().toISOString().split('T')[0]}.txt`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
