import React, { useState, useEffect } from 'react';
import { SearchState, MedicationInfo } from './types';
import { fetchMedicationInfo } from './services/geminiService';
import { SearchBar } from './components/SearchBar';
import { BarcodeScannerModal } from './components/BarcodeScannerModal';
import { SectionCard } from './components/SectionCard';
import { MaxDosageCard } from './components/MaxDosageCard';
import { AlertBadge } from './components/AlertBadge';
import { Alternatives } from './components/Alternatives';
import { Toaster, toast } from 'sonner';
import { Logo } from './components/Logo';
import { 
  Pill, 
  Ban, 
  Activity, 
  HelpCircle,
  AlertTriangle,
  Info as InfoIcon,
  Share2,
  PlusCircle,
  CheckCircle,
  Trash2,
  History,
  X,
  UserCircle,
  ShieldAlert,
  BookOpen,
  LifeBuoy,
  Stethoscope,
  Download,
  ExternalLink,
  RefreshCw,
  Database,
  ShieldCheck,
  HardDrive,
  FileText,
  Package,
  Calendar
} from 'lucide-react';
import {
  syncAndMigrateLocalStorageToIndexedDB,
  getAllMedicationsFromDB,
  saveMedicationToDB,
  removeMedicationFromDB,
  saveSettingToDB,
  getSettingFromDB,
  isIndexedDBSupported
} from './services/indexedDbService';
import { generatePharmacyPDF } from './services/pdfExportService';

const App: React.FC = () => {
  console.log("PharmaGuide: App mounting...");
  const [state, setState] = useState<SearchState>({
    query: '',
    loading: false,
    error: null,
    data: null,
  });

  const [patientMedications, setPatientMedications] = useState<MedicationInfo[]>(() => {
    console.log("PharmaGuide: Initializing patientMedications...");
    const saved = localStorage.getItem('pharmaguide_list');
    if (saved) {
      try { return JSON.parse(saved); } catch (e) { console.error("PharmaGuide: Error parsing list", e); }
    }
    return [];
  });
  const [showPharmacy, setShowPharmacy] = useState(false);
  const [showInfo, setShowInfo] = useState(false);
  const [isScannerOpen, setIsScannerOpen] = useState(false);
  const [pharmacyTab, setPharmacyTab] = useState<'all' | 'regular' | 'reserve'>('all');
  
  const [userContext, setUserContext] = useState<string>(() => {
    console.log("PharmaGuide: Initializing userContext...");
    return localStorage.getItem('pharmaguide_context') || '';
  });
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  const [isInstalled, setIsInstalled] = useState(false);
  const [isDbReady, setIsDbReady] = useState(false);

  // Synchronisation et migration automatique avec IndexedDB
  useEffect(() => {
    syncAndMigrateLocalStorageToIndexedDB()
      .then(async ({ medicationsCount, userContext: syncedContext }) => {
        console.log(`[PharmaGuide] IndexedDB synchronisée avec succès (${medicationsCount} médicaments)`);
        const meds = await getAllMedicationsFromDB();
        if (meds && meds.length > 0) {
          setPatientMedications(meds);
        }
        if (syncedContext) {
          setUserContext(syncedContext);
        }
        setIsDbReady(true);
      })
      .catch((err) => {
        console.warn("[PharmaGuide] Repli sur localStorage :", err);
        setIsDbReady(false);
      });
  }, []);

  useEffect(() => {
    // Handle install prompt
    window.addEventListener('beforeinstallprompt', (e) => {
      e.preventDefault();
      setDeferredPrompt(e);
    });

    window.addEventListener('appinstalled', () => {
      setIsInstalled(true);
      setDeferredPrompt(null);
    });

    // Check if already installed
    if (window.matchMedia('(display-mode: standalone)').matches) {
      setIsInstalled(true);
    }

    // Handle shortcut from manifest
    const params = new URLSearchParams(window.location.search);
    if (params.get('view') === 'pharmacy') {
      setShowPharmacy(true);
    }
  }, []);

  useEffect(() => {
    localStorage.setItem('pharmaguide_list', JSON.stringify(patientMedications));
  }, [patientMedications]);

  useEffect(() => {
    localStorage.setItem('pharmaguide_context', userContext);
  }, [userContext]);

  const handleSearch = async (query: string) => {
    if (navigator.vibrate) navigator.vibrate(10);
    setState(prev => ({ ...prev, query, loading: true, error: null, data: null }));
    try {
      const result = await fetchMedicationInfo(query, userContext);
      setState(prev => ({ ...prev, loading: false, data: result }));
      setShowPharmacy(false);
      setShowInfo(false);
      if (navigator.vibrate) navigator.vibrate([10, 30, 10]);
    } catch (err: any) {
      console.error("Search error:", err);
      let errorMessage = "Erreur lors de la récupération des données.";
      
      // Extraction et interprétation conviviale des erreurs (503, 429, API Key, etc.)
      const rawError = typeof err === 'string' ? err : (err?.message || JSON.stringify(err));
      
      if (rawError.includes("leaked") || rawError.includes("fuité") || rawError.includes("publique") || rawError.includes("révoquée") || rawError.includes("permission denied") || rawError.includes("PERMISSION_DENIED") || rawError.includes("Forbidden") || rawError.includes("403") || rawError.includes("api key") || rawError.includes("API_KEY") || rawError.includes("non configurée")) {
        errorMessage = "Service de recherche en ligne temporairement indisponible. Veuillez vérifier votre connexion ou réessayer ultérieurement.";
      } else if (rawError.includes("503") || rawError.includes("high demand") || rawError.includes("UNAVAILABLE")) {
        errorMessage = "Les serveurs de recherche connaissent actuellement une forte affluence. Veuillez patienter quelques secondes et relancer.";
      } else if (rawError.includes("429") || rawError.includes("RESOURCE_EXHAUSTED")) {
        errorMessage = "Limite temporaire de requêtes atteinte. Veuillez patienter une trentaine de secondes avant de réessayer.";
      } else if (rawError.startsWith("{") && rawError.endsWith("}")) {
        try {
          const parsed = JSON.parse(rawError);
          if (parsed?.error?.message) {
            errorMessage = parsed.error.message;
          } else {
            errorMessage = "Une erreur est survenue lors de l'analyse. Veuillez réessayer.";
          }
        } catch {
          errorMessage = "Une erreur est survenue lors de l'analyse. Veuillez réessayer.";
        }
      } else if (rawError !== "{}") {
        errorMessage = rawError;
      }
      
      setState(prev => ({ 
        ...prev, 
        loading: false, 
        error: errorMessage
      }));
    }
  };

  const handleInstall = async () => {
    if (!deferredPrompt) return;
    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    if (outcome === 'accepted') {
      setDeferredPrompt(null);
    }
  };

  const handleShare = async () => {
    if (!state.data) return;
    const maxDosageText = state.data.maxDailyDosage?.generalMax 
      ? `\n\nDosage max / 24h : ${state.data.maxDailyDosage.generalMax}` 
      : '';
    const shareText = `${state.data.name.toUpperCase()}\n\n${state.data.description}\n\nIndications : ${state.data.indications.join(', ')}${maxDosageText}\n\nVia PharmaGuide.`;
    if (navigator.share) {
      try { await navigator.share({ title: `PharmaGuide - ${state.data.name}`, text: shareText, url: window.location.href }); } catch (e) {}
    } else {
      navigator.clipboard.writeText(shareText);
      toast.success("Copié dans le presse-papier !");
    }
  };

  const addToPatientList = async (asReserve: boolean = false) => {
    if (!state.data) return;
    const target: MedicationInfo = {
      ...state.data,
      isReserve: asReserve
    };
    
    const existingIndex = patientMedications.findIndex(
      m => m.name.toLowerCase() === target.name.toLowerCase()
    );

    if (existingIndex >= 0) {
      const updated = [...patientMedications];
      updated[existingIndex] = {
        ...updated[existingIndex],
        isReserve: asReserve
      };
      setPatientMedications(updated);
      setState(prev => prev.data ? { ...prev, data: { ...prev.data, isReserve: asReserve } } : prev);
      try {
        await saveMedicationToDB(updated[existingIndex]);
        toast.success(
          asReserve 
            ? `${target.name} placé dans vos médicaments en réserve.`
            : `${target.name} placé dans vos traitements réguliers.`
        );
      } catch {
        toast.success(`${target.name} mis à jour.`);
      }
      return;
    }

    setPatientMedications(prev => [target, ...prev]);
    setState(prev => prev.data ? { ...prev, data: { ...prev.data, isReserve: asReserve } } : prev);
    try {
      await saveMedicationToDB(target);
      toast.success(
        asReserve
          ? `${target.name} ajouté en réserve (si besoin / secours) !`
          : `${target.name} synchronisé dans votre pharmacie !`,
        {
          description: asReserve
            ? "Classé dans votre réserve pour prises ponctuelles ou secours."
            : "Enregistré de manière permanente dans IndexedDB locale"
        }
      );
    } catch {
      toast.success(`${target.name} ajouté à votre pharmacie !`);
    }
  };

  const toggleMedicationReserve = async (e: React.MouseEvent, medName: string) => {
    e.stopPropagation();
    const medIndex = patientMedications.findIndex(
      m => m.name.toLowerCase() === medName.toLowerCase()
    );
    if (medIndex === -1) {
      // If not yet in list, add it as reserve
      if (state.data && state.data.name.toLowerCase() === medName.toLowerCase()) {
        await addToPatientList(true);
      }
      return;
    }

    const currentMed = patientMedications[medIndex];
    const newReserveStatus = !currentMed.isReserve;
    const updatedMed: MedicationInfo = {
      ...currentMed,
      isReserve: newReserveStatus
    };

    const updatedList = [...patientMedications];
    updatedList[medIndex] = updatedMed;
    setPatientMedications(updatedList);

    if (state.data && state.data.name.toLowerCase() === medName.toLowerCase()) {
      setState(prev => prev.data ? { ...prev, data: { ...prev.data, isReserve: newReserveStatus } } : prev);
    }

    try {
      await saveMedicationToDB(updatedMed);
      toast.success(
        newReserveStatus
          ? `${currentMed.name} placé en réserve (si besoin / secours)`
          : `${currentMed.name} placé en traitement régulier`,
        {
          description: newReserveStatus 
            ? "Ce traitement est identifié pour un usage ponctuel ou d'urgence." 
            : "Ce traitement est identifié comme traitement habituel au quotidien."
        }
      );
    } catch {
      toast.success(`${currentMed.name} mis à jour.`);
    }
  };

  const removeFromPatientList = async (e: React.MouseEvent, name: string) => {
    e.stopPropagation();
    setPatientMedications(prev => prev.filter(m => m.name !== name));
    try {
      await removeMedicationFromDB(name);
      toast.info(`${name} retiré de votre pharmacie.`);
    } catch {
      toast.info(`${name} retiré.`);
    }
  };

  const handleExportPDF = () => {
    if (patientMedications.length === 0 && !userContext.trim()) {
      toast.error("Votre pharmacie est vide, rien à exporter en PDF.");
      return;
    }
    try {
      generatePharmacyPDF(patientMedications, userContext);
      toast.success("Document PDF généré avec succès !", {
        description: "Fiche médicale récapitulative prête à imprimer ou partager."
      });
    } catch (err: any) {
      toast.error("Erreur lors de la génération du PDF : " + (err?.message || "Inconnue"));
    }
  };

  const exportMedications = () => {
    if (patientMedications.length === 0 && !userContext.trim()) {
      toast.error("Rien à exporter.");
      return;
    }
    
    let text = `RAPPORT PHARMAGUIDE - ${new Date().toLocaleDateString('fr-FR')}\n`;
    text += `==========================================\n\n`;
    text += `PROFIL SANTÉ :\n`;
    text += `${userContext || "Non renseigné"}\n\n`;
    text += `LISTE DES MÉDICAMENTS :\n`;
    
    if (patientMedications.length > 0) {
      patientMedications.forEach((med, i) => {
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
    toast.success("Exportation réussie !");
  };

  const selectFromList = (med: MedicationInfo) => {
    setState(prev => ({ ...prev, query: med.name, data: med, error: null }));
    setShowPharmacy(false);
    document.getElementById('main-scroll')?.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const isAlreadyInList = state.data && patientMedications.some(m => m.name.toLowerCase() === state.data!.name.toLowerCase());
  const savedMedData = state.data ? patientMedications.find(m => m.name.toLowerCase() === state.data!.name.toLowerCase()) : null;
  const isCurrentMedInReserve = Boolean(savedMedData?.isReserve ?? state.data?.isReserve);

  const regularMeds = patientMedications.filter(m => !m.isReserve);
  const reserveMeds = patientMedications.filter(m => m.isReserve);
  const displayedMeds = pharmacyTab === 'regular' 
    ? regularMeds 
    : pharmacyTab === 'reserve' 
      ? reserveMeds 
      : patientMedications;

  const togglePharmacy = () => {
    setShowPharmacy(!showPharmacy);
    setShowInfo(false);
  };

  const toggleInfo = () => {
    setShowInfo(!showInfo);
    setShowPharmacy(false);
  };

  return (
    <div className="min-h-screen bg-slate-200 flex justify-center items-center font-sans text-slate-900">
      <Toaster position="top-center" richColors />
      <div className="w-full min-h-screen max-w-[480px] md:h-[92vh] bg-slate-50 md:rounded-[2.5rem] shadow-2xl flex flex-col overflow-hidden relative md:border border-slate-200">
        
        <header className="bg-white border-b border-slate-100 sticky top-0 z-50 pt-safe shadow-sm">
          <div className="px-5 h-16 flex items-center justify-between gap-2">
            <div className="flex items-center gap-2 cursor-pointer shrink-0" onClick={() => window.location.reload()}>
              <Logo className="w-10 h-10" />
              <h1 className="text-2xl font-extrabold bg-clip-text text-transparent bg-gradient-to-r from-blue-700 to-cyan-600 block">PharmaGuide</h1>
            </div>
            
            <div className="flex items-center gap-1">
              <button 
                onClick={togglePharmacy}
                className={`relative p-2 rounded-xl transition-all active:scale-95 flex items-center gap-2 ${showPharmacy ? 'bg-blue-50 text-blue-600 shadow-inner' : 'text-slate-500 hover:bg-slate-50'}`}
                title="Ma Pharmacie"
              >
                <History className="w-5 h-5" />
                {patientMedications.length > 0 && (
                  <span className="absolute -top-1 -right-1 bg-red-500 text-white text-[9px] font-bold w-4 h-4 rounded-full flex items-center justify-center border-2 border-white">
                    {patientMedications.length}
                  </span>
                )}
              </button>

              <button 
                onClick={toggleInfo}
                className={`p-2 rounded-xl transition-all active:scale-95 flex items-center gap-2 ${showInfo ? 'bg-indigo-50 text-indigo-600 shadow-inner' : 'text-slate-400 hover:bg-slate-50'}`}
                title="Aide et Paramètres"
              >
                <HelpCircle className="w-6 h-6" />
              </button>
            </div>
          </div>

          {showPharmacy && (
            <div className="absolute top-full left-0 w-full bg-white border-b border-slate-200 shadow-2xl z-40 animate-fade-in-up max-h-[85vh] overflow-y-auto no-scrollbar">
              <div className="p-4 space-y-5">
                {/* En-tête avec statut de synchronisation */}
                <div className="flex items-center justify-between pb-2 border-b border-slate-100">
                  <div>
                    <h2 className="text-sm font-bold text-slate-800 flex items-center gap-2">
                      <Pill className="w-4 h-4 text-blue-600" /> Ma Pharmacie
                    </h2>
                    <p className="text-[10px] text-slate-500">Persistance locale permanente sur votre appareil</p>
                  </div>
                  <div className="flex items-center gap-1.5">
                    {isDbReady ? (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
                        <Database className="w-3 h-3 text-emerald-600" />
                        IndexedDB synchronisé
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-amber-50 text-amber-700 border border-amber-200">
                        <HardDrive className="w-3 h-3 text-amber-600" />
                        Stockage local
                      </span>
                    )}
                  </div>
                </div>

                {/* Bloc d'export et bilan médical */}
                <div className="bg-slate-50 p-3 rounded-xl border border-slate-200/80 space-y-2.5">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
                      <ShieldCheck className="w-4 h-4 text-emerald-600" />
                      Bilan & Partage Médical
                    </span>
                    <span className="text-[9px] text-blue-700 bg-blue-50 px-1.5 py-0.5 rounded border border-blue-200/60 font-semibold">
                      Format Imprimable
                    </span>
                  </div>

                  <p className="text-[10px] text-slate-500 leading-relaxed">
                    Générez une fiche récapitulative officielle de vos traitements et antécédents, prête à imprimer ou à présenter à votre médecin traitant ou pharmacien.
                  </p>

                  <div className="grid grid-cols-2 gap-2 pt-0.5">
                    <button 
                      onClick={handleExportPDF}
                      className="py-2 px-3 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-bold flex items-center justify-center gap-2 shadow-xs transition-all active:scale-95"
                      title="Télécharger votre bilan en document PDF imprimable"
                    >
                      <FileText className="w-4 h-4 shrink-0" />
                      <span>Fiche PDF (.pdf)</span>
                    </button>

                    <button 
                      onClick={exportMedications}
                      className="py-2 px-3 bg-white border border-slate-200 hover:border-slate-300 text-slate-700 hover:text-slate-900 rounded-lg text-xs font-semibold flex items-center justify-center gap-1.5 shadow-2xs transition-all active:scale-95"
                      title="Copier ou exporter le résumé texte simple"
                    >
                      <Stethoscope className="w-3.5 h-3.5 text-slate-500 shrink-0" />
                      <span>Fiche TXT</span>
                    </button>
                  </div>
                </div>

                {/* Profil Santé */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <h3 className="text-[10px] font-bold uppercase tracking-widest text-slate-400 flex items-center gap-2">
                      <UserCircle className="w-3.5 h-3.5 text-blue-600" /> Mon Profil Santé (Antécédents & Allergies)
                    </h3>
                  </div>
                  <textarea 
                    className="w-full p-2.5 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all placeholder:italic"
                    placeholder="Ex: Allergique à la pénicilline, asthme, hypertension, enceinte..."
                    rows={2}
                    value={userContext}
                    onChange={(e) => {
                      const val = e.target.value;
                      setUserContext(val);
                      saveSettingToDB("context", val).catch(() => {});
                    }}
                  />
                  <p className="text-[9px] text-slate-400 italic">Mémorisé de façon permanente dans IndexedDB pour ajuster les analyses posologiques de l'IA.</p>
                </div>

                {/* Mes Médicaments */}
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <h3 className="text-[10px] font-bold uppercase tracking-widest text-slate-400 flex items-center gap-2">
                      <Pill className="w-3.5 h-3.5 text-blue-600" /> Mes Médicaments ({patientMedications.length})
                    </h3>
                    {patientMedications.length > 0 && (
                      <span className="text-[9px] font-medium text-slate-400">
                        Cliquez pour afficher la notice
                      </span>
                    )}
                  </div>

                  {patientMedications.length > 0 && (
                    <div className="flex items-center gap-1 p-1 bg-slate-100/90 rounded-xl border border-slate-200/60">
                      <button
                        type="button"
                        onClick={() => setPharmacyTab('all')}
                        className={`flex-1 py-1.5 text-xs font-semibold rounded-lg transition-all text-center ${
                          pharmacyTab === 'all'
                            ? 'bg-white text-slate-900 shadow-2xs font-bold'
                            : 'text-slate-500 hover:text-slate-800'
                        }`}
                      >
                        Tous ({patientMedications.length})
                      </button>
                      <button
                        type="button"
                        onClick={() => setPharmacyTab('regular')}
                        className={`flex-1 py-1.5 text-xs font-semibold rounded-lg transition-all flex items-center justify-center gap-1 ${
                          pharmacyTab === 'regular'
                            ? 'bg-white text-blue-700 shadow-2xs font-bold'
                            : 'text-slate-500 hover:text-slate-800'
                        }`}
                      >
                        <Calendar className="w-3 h-3 text-blue-600" />
                        <span>Réguliers ({regularMeds.length})</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => setPharmacyTab('reserve')}
                        className={`flex-1 py-1.5 text-xs font-semibold rounded-lg transition-all flex items-center justify-center gap-1 ${
                          pharmacyTab === 'reserve'
                            ? 'bg-white text-amber-700 shadow-2xs font-bold'
                            : 'text-slate-500 hover:text-slate-800'
                        }`}
                      >
                        <Package className="w-3 h-3 text-amber-600" />
                        <span>En réserve ({reserveMeds.length})</span>
                      </button>
                    </div>
                  )}

                  {patientMedications.length > 0 ? (
                    displayedMeds.length > 0 ? (
                      <div className="grid grid-cols-1 gap-2">
                        {displayedMeds.map((med, idx) => (
                          <div 
                            key={idx}
                            onClick={() => selectFromList(med)}
                            className="flex items-center justify-between p-3 bg-slate-50 hover:bg-blue-50/80 border border-slate-100 rounded-xl cursor-pointer transition-all group"
                          >
                            <div className="flex items-center gap-3">
                              <div className={`w-2.5 h-2.5 rounded-full shrink-0 ${med.warningLevel === 'high' ? 'bg-red-500' : med.warningLevel === 'medium' ? 'bg-orange-500' : 'bg-emerald-500'}`} />
                              <div>
                                <div className="flex items-center gap-2">
                                  <span className="text-sm font-semibold text-slate-800">{med.name}</span>
                                </div>
                                <div className="flex items-center gap-1.5 mt-1 flex-wrap">
                                  {med.maxDailyDosage?.generalMax && (
                                    <span className="text-[10px] text-amber-700 bg-amber-50 px-1.5 py-0.5 rounded border border-amber-200/50 font-medium inline-block">
                                      Max : {med.maxDailyDosage.generalMax}
                                    </span>
                                  )}
                                  <button
                                    type="button"
                                    onClick={(e) => toggleMedicationReserve(e, med.name)}
                                    className={`text-[10px] font-bold px-2 py-0.5 rounded-md border flex items-center gap-1 transition-all ${
                                      med.isReserve
                                        ? 'bg-amber-100 text-amber-900 border-amber-300 hover:bg-amber-200'
                                        : 'bg-slate-100 text-slate-600 border-slate-200 hover:bg-slate-200'
                                    }`}
                                    title={med.isReserve ? "Médicament de réserve (si besoin / secours). Cliquer pour basculer en régulier." : "Traitement habituel. Cliquer pour mettre en réserve."}
                                  >
                                    <Package className={`w-3 h-3 ${med.isReserve ? 'text-amber-700' : 'text-slate-400'}`} />
                                    <span>{med.isReserve ? 'En réserve' : 'Régulier'}</span>
                                  </button>
                                </div>
                              </div>
                            </div>
                            <button 
                              onClick={(e) => removeFromPatientList(e, med.name)}
                              className="p-1.5 text-slate-300 hover:text-red-500 hover:bg-red-50 rounded-lg transition-all"
                              title="Retirer de ma pharmacie"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="text-xs text-slate-400 text-center py-5 italic border border-dashed border-slate-200 rounded-xl bg-slate-50/50">
                        {pharmacyTab === 'reserve' ? (
                          <>
                            <p className="font-semibold text-slate-600 not-italic">Aucun médicament en réserve</p>
                            <p className="text-[10px] text-slate-400 mt-1 not-italic">Cliquez sur « Régulier » pour basculer un médicament en réserve, ou ajoutez-en un avec l'option « En réserve ».</p>
                          </>
                        ) : (
                          <>
                            <p className="font-semibold text-slate-600 not-italic">Aucun traitement régulier</p>
                            <p className="text-[10px] text-slate-400 mt-1 not-italic">Tous vos médicaments enregistrés sont actuellement classés en réserve.</p>
                          </>
                        )}
                      </div>
                    )
                  ) : (
                    <div className="text-xs text-slate-400 text-center py-6 italic border border-dashed border-slate-200 rounded-xl bg-slate-50/50">
                      <p>Aucun médicament enregistré.</p>
                      <p className="text-[10px] text-slate-400 mt-1 not-italic">Recherchez un médicament et cliquez sur « Suivre » ou « En réserve ».</p>
                    </div>
                  )}
                </div>

                <button 
                  onClick={() => setShowPharmacy(false)}
                  className="w-full py-2 bg-slate-100 text-slate-600 rounded-xl text-xs font-bold uppercase tracking-wider hover:bg-slate-200 transition-all"
                >
                  Fermer
                </button>
              </div>
            </div>
          )}

          {showInfo && (
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

                {deferredPrompt && !isInstalled && (
                  <div className="pt-4 border-t border-slate-50 animate-fade-in">
                    <button 
                      onClick={handleInstall}
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
                    onClick={() => setShowInfo(false)}
                    className="w-full py-2 bg-indigo-50 text-indigo-600 rounded-xl text-xs font-bold uppercase tracking-wider hover:bg-indigo-100 transition-all"
                  >
                    J'ai compris
                  </button>
                </div>
              </div>
            </div>
          )}
        </header>

        <main id="main-scroll" className="flex-grow w-full px-5 py-6 overflow-y-auto no-scrollbar pb-10">
          <div className={`transition-all duration-500 ${state.data ? 'mb-4' : 'mb-8 mt-4 text-center'}`}>
            {!state.data && (
              <div className="animate-fade-in-up">
                <h2 className="text-2xl font-extrabold text-slate-900 mb-2">Bonjour, <span className="text-blue-600">PharmaGuide</span></h2>
                <p className="text-sm text-slate-500 mb-6 px-4">L'assistant intelligent pour vos traitements et votre sécurité médicale.</p>
              </div>
            )}
            <SearchBar 
              onSearch={handleSearch} 
              isLoading={state.loading} 
              externalQuery={state.query} 
              onOpenScanner={() => setIsScannerOpen(true)}
            />
          </div>

          {state.error && (
            <div className="p-4 bg-red-50 border border-red-100 rounded-2xl text-red-700 text-sm space-y-3 mb-6 shadow-sm animate-fade-in">
              <div className="flex items-start gap-3">
                <AlertTriangle className="w-5 h-5 flex-shrink-0 text-red-600 mt-0.5" />
                <div className="flex-1 space-y-1">
                  <p className="font-semibold text-red-800">Impossible de compléter la recherche</p>
                  <p className="text-red-700 leading-relaxed text-xs sm:text-sm">{state.error}</p>
                </div>
              </div>

              <div className="flex flex-col sm:flex-row gap-2 pt-1">
                {state.query && (
                  <button
                    onClick={() => handleSearch(state.query)}
                    className="py-2 px-3 bg-red-600 hover:bg-red-700 text-white font-semibold rounded-xl text-xs flex items-center justify-center gap-1.5 transition-all active:scale-95 shadow-2xs"
                  >
                    <RefreshCw className="w-3.5 h-3.5" />
                    Réessayer la recherche
                  </button>
                )}
              </div>
            </div>
          )}

          {state.data && !state.loading && (
            <div className="space-y-5 pb-6">
              <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-5 animate-fade-in-up">
                <div className="flex flex-col gap-3">
                  <div className="flex justify-between items-start gap-2">
                    <div className="flex flex-col gap-1.5">
                      <h2 className="text-2xl font-bold text-slate-900 capitalize">{state.data.name}</h2>
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <AlertBadge level={state.data.warningLevel} />
                        {isAlreadyInList && (
                          isCurrentMedInReserve ? (
                            <span className="inline-flex items-center gap-1 text-[11px] font-bold px-2 py-0.5 rounded-full bg-amber-100 text-amber-900 border border-amber-300">
                              <Package className="w-3 h-3 text-amber-700" />
                              En réserve (si besoin)
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 text-[11px] font-medium px-2 py-0.5 rounded-full bg-blue-50 text-blue-800 border border-blue-200">
                              <Calendar className="w-3 h-3 text-blue-600" />
                              Traitement régulier
                            </span>
                          )
                        )}
                      </div>
                    </div>
                    
                    <div className="flex items-center gap-1.5 shrink-0">
                      <button 
                        onClick={handleShare} 
                        className="p-2 bg-slate-50 text-slate-500 hover:text-blue-600 rounded-xl border border-slate-100 shadow-sm transition-all"
                        title="Partager"
                      >
                        <Share2 className="w-4 h-4" />
                      </button>

                      {isAlreadyInList ? (
                        <div className="flex items-center gap-1.5">
                          <button
                            type="button"
                            onClick={(e) => toggleMedicationReserve(e, state.data!.name)}
                            className={`py-2 px-2.5 rounded-xl border text-xs font-bold flex items-center gap-1.5 transition-all shadow-xs ${
                              isCurrentMedInReserve
                                ? 'bg-amber-100 text-amber-900 border-amber-300 hover:bg-amber-200'
                                : 'bg-slate-100 text-slate-700 border-slate-200 hover:bg-slate-200'
                            }`}
                            title={isCurrentMedInReserve ? "Actuellement classé en réserve (si besoin / secours). Cliquer pour passer en régulier." : "Cliquer pour mettre ce médicament en réserve."}
                          >
                            <Package className={`w-3.5 h-3.5 ${isCurrentMedInReserve ? 'text-amber-700' : 'text-slate-400'}`} />
                            <span>{isCurrentMedInReserve ? 'En réserve' : 'En réserve ?'}</span>
                          </button>

                          <button 
                            type="button"
                            onClick={() => addToPatientList(false)}
                            className="p-2 px-2.5 rounded-xl border shadow-sm transition-all flex items-center gap-1 bg-emerald-50 text-emerald-700 border-emerald-200"
                            title="Traitement enregistré dans votre pharmacie"
                          >
                            <CheckCircle className="w-4 h-4 text-emerald-600" />
                            <span className="text-xs font-bold uppercase hidden sm:inline">Suivi</span>
                          </button>
                        </div>
                      ) : (
                        <div className="flex items-center gap-1.5">
                          <button 
                            type="button"
                            onClick={() => addToPatientList(true)}
                            className="py-2 px-2.5 rounded-xl border border-amber-300 bg-amber-50 text-amber-800 hover:bg-amber-100 text-xs font-bold flex items-center gap-1.5 transition-all shadow-xs active:scale-95"
                            title="Ajouter directement comme médicament en réserve (si besoin / secours)"
                          >
                            <Package className="w-3.5 h-3.5 text-amber-600" />
                            <span>Réserve</span>
                          </button>

                          <button 
                            type="button"
                            onClick={() => addToPatientList(false)} 
                            className="py-2 px-3 rounded-xl border shadow-sm transition-all flex items-center gap-1.5 bg-blue-600 text-white hover:bg-blue-700 text-xs font-bold uppercase active:scale-95"
                            title="Ajouter comme traitement habituel / régulier"
                          >
                            <PlusCircle className="w-3.5 h-3.5" />
                            <span className="hidden sm:inline">Suivre</span>
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                  <p className="text-slate-600 text-sm leading-relaxed">{state.data.description}</p>
                </div>
                <div className="mt-4 pt-4 border-t border-slate-50">
                  <div className="flex gap-3 text-sm text-blue-800 bg-blue-50/80 p-3 rounded-xl">
                    <InfoIcon className="w-5 h-5 flex-shrink-0 mt-0.5 text-blue-600" />
                    <span className="font-medium">{state.data.usageTips}</span>
                  </div>
                </div>
              </div>

              <div className="space-y-4">
                <SectionCard title="Indications" items={state.data.indications} icon={Pill} variant="default" className="animate-fade-in-up delay-100" />
                {state.data.maxDailyDosage && (
                  <MaxDosageCard dosageInfo={state.data.maxDailyDosage} className="animate-fade-in-up delay-150" />
                )}
                <SectionCard title="Contre-indications" items={state.data.contraindications} icon={Ban} variant="danger" className="animate-fade-in-up delay-200" />
                <SectionCard title="Interactions" items={state.data.interactions} icon={Activity} variant="warning" className="animate-fade-in-up delay-300" />
              </div>

              {(state.data.warningLevel === 'high' || state.data.contraindications.length > 0) && (
                <div className="animate-fade-in-up delay-500">
                  <Alternatives alternatives={state.data.alternatives} onSelect={handleSearch} />
                </div>
              )}
            </div>
          )}

          {!state.data && !state.loading && !state.error && (
            <div className="mt-12 flex flex-col items-center justify-center opacity-30 animate-fade-in delay-300">
              <Pill className="w-16 h-16 text-slate-300 mb-4" />
              <p className="text-sm text-slate-400 font-medium text-center">Indiquez vos allergies dans votre profil <br/>avant de rechercher un médicament.</p>
            </div>
          )}

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
        </main>
        <div className="h-safe bg-slate-50"></div>
      </div>

      {/* Modal de Scan Caméra / Code-Barres */}
      <BarcodeScannerModal
        isOpen={isScannerOpen}
        onClose={() => setIsScannerOpen(false)}
        onScanSuccess={(medicationName) => {
          setIsScannerOpen(false);
          handleSearch(medicationName);
        }}
      />
    </div>
  );
};

export default App;