import jsPDF from "jspdf";
import { MedicationInfo } from "../types";

export const generatePharmacyPDF = (
  medications: MedicationInfo[],
  userContext: string
): void => {
  const doc = new jsPDF({
    orientation: "portrait",
    unit: "mm",
    format: "a4"
  });

  const pageWidth = 210;
  const pageHeight = 297;
  const margin = 15;
  const contentWidth = pageWidth - margin * 2;
  let y = 16;

  const checkPageBreak = (spaceNeeded: number) => {
    if (y + spaceNeeded > pageHeight - 20) {
      doc.addPage();
      y = 16;
      renderPageHeaderMini();
    }
  };

  const renderPageHeaderMini = () => {
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    doc.setTextColor(148, 163, 184); // slate-400
    doc.text("PharmaGuide - Fiche Traitements & Sécurité", margin, 10);
    const dateStr = new Date().toLocaleDateString("fr-FR");
    doc.text(`Date : ${dateStr}`, pageWidth - margin, 10, { align: "right" });
    doc.setDrawColor(226, 232, 240);
    doc.setLineWidth(0.3);
    doc.line(margin, 12, pageWidth - margin, 12);
  };

  // ==========================================
  // EN-TÊTE PRINCIPAL
  // ==========================================
  // Fond bleu doux de l'en-tête
  doc.setFillColor(239, 246, 255); // blue-50
  doc.roundedRect(margin, y, contentWidth, 24, 3, 3, "F");
  doc.setDrawColor(191, 219, 254); // blue-200
  doc.setLineWidth(0.5);
  doc.roundedRect(margin, y, contentWidth, 24, 3, 3, "D");

  // Titre
  doc.setFont("helvetica", "bold");
  doc.setFontSize(16);
  doc.setTextColor(29, 78, 216); // blue-700
  doc.text("PharmaGuide", margin + 5, y + 9);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.setTextColor(71, 85, 105); // slate-600
  doc.text("Fiche Récapitulative de Traitements & Sécurité", margin + 5, y + 16);

  // Date et nombre de médicaments (à droite)
  const dateStr = new Date().toLocaleDateString("fr-FR", {
    year: "numeric",
    month: "long",
    day: "numeric"
  });
  const countRegular = medications.filter(m => !m.isReserve).length;
  const countReserve = medications.filter(m => m.isReserve).length;

  doc.setFontSize(8);
  doc.setTextColor(100, 116, 139);
  doc.text(`Édité le : ${dateStr}`, pageWidth - margin - 5, y + 9, { align: "right" });
  doc.text(`Total : ${medications.length} (${countRegular} réguliers, ${countReserve} en réserve)`, pageWidth - margin - 5, y + 16, { align: "right" });

  y += 29;

  // ==========================================
  // SECTION : PROFIL SANTÉ & ALLERGIES
  // ==========================================
  checkPageBreak(25);
  doc.setFillColor(248, 250, 252); // slate-50
  doc.setDrawColor(226, 232, 240); // slate-200
  doc.roundedRect(margin, y, contentWidth, userContext.trim() ? 22 : 16, 2, 2, "FD");

  doc.setFont("helvetica", "bold");
  doc.setFontSize(10);
  doc.setTextColor(30, 41, 59); // slate-800
  doc.text("Profil Santé du Patient (Allergies & Antécédents)", margin + 4, y + 6);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.setTextColor(71, 85, 105);
  const contextText = userContext.trim()
    ? userContext.trim()
    : "Aucun antécédent ni allergie signalée lors de l'export.";
  const wrappedContext = doc.splitTextToSize(contextText, contentWidth - 8);
  doc.text(wrappedContext, margin + 4, y + 12);

  y += (userContext.trim() ? 27 : 21);

  // ==========================================
  // SECTION : LISTE DES MÉDICAMENTS
  // ==========================================
  doc.setFont("helvetica", "bold");
  doc.setFontSize(12);
  doc.setTextColor(15, 23, 42); // slate-900
  doc.text(`Médicaments Enregistrés (${medications.length})`, margin, y);
  y += 6;

  if (medications.length === 0) {
    doc.setFont("helvetica", "italic");
    doc.setFontSize(9);
    doc.setTextColor(148, 163, 184);
    doc.text("Aucun médicament enregistré dans la pharmacie locale.", margin, y + 4);
    y += 12;
  } else {
    medications.forEach((med, index) => {
      // Calculer l'espace nécessaire pour ce médicament
      checkPageBreak(38);

      // Boîte pour chaque médicament
      const boxStartY = y;
      doc.setFillColor(255, 255, 255);
      doc.setDrawColor(226, 232, 240);
      doc.setLineWidth(0.3);

      // Titre du médicament
      doc.setFont("helvetica", "bold");
      doc.setFontSize(11);
      doc.setTextColor(29, 78, 216); // blue-700
      doc.text(`${index + 1}. ${med.name}`, margin + 3, y + 5);

      const nameWidth = doc.getTextWidth(`${index + 1}. ${med.name}`);
      if (med.isReserve) {
        doc.setFont("helvetica", "bold");
        doc.setFontSize(7.5);
        doc.setTextColor(180, 83, 9); // amber-700
        doc.text("[EN RÉSERVE / SI BESOIN]", margin + 3 + nameWidth + 3, y + 4.8);
      } else {
        doc.setFont("helvetica", "normal");
        doc.setFontSize(7);
        doc.setTextColor(100, 116, 139); // slate-500
        doc.text("[Traitement régulier]", margin + 3 + nameWidth + 3, y + 4.8);
      }

      // Niveau d'attention
      let levelText = "Vigilance standard";
      if (med.warningLevel === "high") levelText = "ATTENTION : Risque élevé";
      else if (med.warningLevel === "medium") levelText = "Vigilance modérée";
      
      doc.setFont("helvetica", "bold");
      doc.setFontSize(8);
      if (med.warningLevel === "high") {
        doc.setTextColor(220, 38, 38); // red-600
      } else if (med.warningLevel === "medium") {
        doc.setTextColor(217, 119, 6); // amber-600
      } else {
        doc.setTextColor(16, 185, 129); // emerald-500
      }
      doc.text(levelText, pageWidth - margin - 3, y + 5, { align: "right" });

      y += 8;

      // Description / Indication
      if (med.description) {
        doc.setFont("helvetica", "italic");
        doc.setFontSize(8.5);
        doc.setTextColor(100, 116, 139);
        const descLines = doc.splitTextToSize(med.description, contentWidth - 6);
        doc.text(descLines, margin + 3, y + 2);
        y += descLines.length * 3.8 + 2;
      }

      // Posologie max
      const posoMax = med.maxDailyDosage?.generalMax || "Non spécifiée";
      doc.setFont("helvetica", "bold");
      doc.setFontSize(8.5);
      doc.setTextColor(15, 23, 42);
      doc.text("• Dose maximale / 24h : ", margin + 3, y + 2);
      doc.setFont("helvetica", "normal");
      doc.setTextColor(51, 65, 85);
      const posoWidth = doc.getTextWidth("• Dose maximale / 24h : ");
      doc.text(posoMax, margin + 3 + posoWidth, y + 2);
      y += 5;

      // Contre-indications clés
      if (med.contraindications && med.contraindications.length > 0) {
        const ciText = med.contraindications.slice(0, 3).join(", ");
        doc.setFont("helvetica", "bold");
        doc.setTextColor(185, 28, 28); // red-700
        doc.text("• Contre-indications : ", margin + 3, y + 2);
        doc.setFont("helvetica", "normal");
        doc.setTextColor(71, 85, 105);
        const ciLines = doc.splitTextToSize(ciText, contentWidth - 45);
        doc.text(ciLines, margin + 37, y + 2);
        y += ciLines.length * 3.8 + 1;
      }

      // Interactions clés
      if (med.interactions && med.interactions.length > 0) {
        const interText = med.interactions.slice(0, 2).join(", ");
        doc.setFont("helvetica", "bold");
        doc.setTextColor(217, 119, 6); // amber-600
        doc.text("• Interactions : ", margin + 3, y + 2);
        doc.setFont("helvetica", "normal");
        doc.setTextColor(71, 85, 105);
        const interLines = doc.splitTextToSize(interText, contentWidth - 35);
        doc.text(interLines, margin + 28, y + 2);
        y += interLines.length * 3.8 + 1;
      }

      // Contour du médicament
      const boxHeight = y - boxStartY + 3;
      doc.roundedRect(margin, boxStartY, contentWidth, boxHeight, 2, 2, "D");
      y += 6;
    });
  }

  // ==========================================
  // PIED DE PAGE ET AVERTISSEMENT LÉGAL
  // ==========================================
  checkPageBreak(18);
  doc.setDrawColor(226, 232, 240);
  doc.setLineWidth(0.4);
  doc.line(margin, y, pageWidth - margin, y);
  y += 4;

  doc.setFont("helvetica", "italic");
  doc.setFontSize(7.5);
  doc.setTextColor(148, 163, 184); // slate-400
  const legalNotice =
    "AVERTISSEMENT : Ce document est généré par PharmaGuide à titre indicatif pour faciliter vos échanges avec votre médecin traitant ou pharmacien. Il ne remplace en aucun cas une ordonnance médicale. En cas d'urgence, contactez immédiatement le SAMU (15) ou les urgences européennes (112).";
  const legalLines = doc.splitTextToSize(legalNotice, contentWidth);
  doc.text(legalLines, margin, y);

  // Pagination sur toutes les pages
  const totalPages = (doc as any).internal.getNumberOfPages();
  for (let i = 1; i <= totalPages; i++) {
    doc.setPage(i);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(7.5);
    doc.setTextColor(148, 163, 184);
    doc.text(
      `Page ${i} sur ${totalPages} - PharmaGuide`,
      pageWidth / 2,
      pageHeight - 6,
      { align: "center" }
    );
  }

  // Téléchargement du fichier PDF
  const filename = `PharmaGuide_Traitements_${new Date().toISOString().split("T")[0]}.pdf`;
  doc.save(filename);
};
